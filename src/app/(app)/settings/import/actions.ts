'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { CATEGORY_PALETTE } from '@/lib/constants';
import { duplicateKey, normalizeName } from '@/lib/import/plan';
import type { PlanItem } from '@/lib/import/types';
import type { AccountKind, Database, TransactionType } from '@/types/database.types';

type Result<T = object> = ({ error: string } & Partial<T>) | ({ error: null } & T);

// ---------------------------------------------------------------------------
// Duplicatas
// ---------------------------------------------------------------------------

/**
 * Devolve as chaves (data|valor|descrição) que já existem no banco, dentro do
 * intervalo de datas do arquivo. A comparação fica no servidor porque é ele
 * que tem as transações — o cliente só manda as chaves e marca as linhas.
 */
export async function findDuplicates(keys: string[]): Promise<Result<{ duplicates: string[] }>> {
  if (keys.length === 0) return { error: null, duplicates: [] };

  const dates = keys.map((key) => key.slice(0, 10)).sort();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount, description, is_transfer, type')
    .gte('date', dates[0])
    .lte('date', dates[dates.length - 1]);

  if (error) return { error: error.message };

  const existing = new Set<string>();
  for (const tx of data ?? []) {
    const date = tx.date.slice(0, 10);
    const amount = Number(tx.amount);
    existing.add(duplicateKey(date, amount, tx.description));
    // Só a ponta de saída representa a transferência, senão contaria duas vezes.
    if (tx.is_transfer && tx.type === 'expense')
      existing.add(`${date}|${amount.toFixed(2)}|transfer`);
  }

  return { error: null, duplicates: keys.filter((key) => existing.has(key)) };
}

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------

/** `new` cria a entidade com o nome do arquivo; senão é o id de uma existente. */
export type OriginMapping = {
  name: string;
  kind: 'account' | 'card';
  target: 'new' | string;
  /** Conta nova: tipo. */
  accountKind?: AccountKind;
  /** Cartão novo: conta que paga a fatura (id ou chave de conta nova) e dias. */
  card?: { accountTarget: string; closingDay: number; dueDay: number };
};

export type CategoryMapping = {
  name: string;
  kind: TransactionType;
  /** `none` importa sem categoria. */
  target: 'new' | 'none' | string;
};

export type ImportPayload = {
  items: PlanItem[];
  origins: Record<string, OriginMapping>;
  categories: Record<string, CategoryMapping>;
  /** Tags citadas: as que não existem são criadas. */
  tags: string[];
};

export type ImportOutcome = {
  transactions: number;
  transfers: number;
  created: { accounts: number; cards: number; categories: number; tags: number };
  firstMonth: string | null;
};

const CHUNK = 200;

function minDate(current: string | null, candidate: string): string {
  return current === null || candidate < current ? candidate : current;
}

function validatePayload(payload: ImportPayload): string | null {
  if (payload.items.length === 0) return 'Nenhuma linha selecionada.';
  if (payload.items.length > 5000)
    return 'Arquivo grande demais para uma importação só (máx. 5000).';

  for (const origin of Object.values(payload.origins)) {
    if (!origin.target) return `Escolha o destino de "${origin.name}".`;
    if (origin.target === 'new') {
      if (!origin.name.trim() || origin.name.trim().length > 40) {
        return `Nome inválido para "${origin.name}" (1 a 40 caracteres).`;
      }
      if (origin.kind === 'card') {
        const card = origin.card;
        if (!card?.accountTarget)
          return `Cartão "${origin.name}": escolha a conta que paga a fatura.`;
        for (const day of [card.closingDay, card.dueDay]) {
          if (!Number.isInteger(day) || day < 1 || day > 31) {
            return `Cartão "${origin.name}": dias de fechamento e vencimento entre 1 e 31.`;
          }
        }
        if (card.accountTarget.startsWith('account:') && !payload.origins[card.accountTarget]) {
          return `Cartão "${origin.name}": a conta da fatura não está no plano.`;
        }
      }
    }
  }

  for (const category of Object.values(payload.categories)) {
    if (!category.target) return `Escolha o destino da categoria "${category.name}".`;
  }

  for (const item of payload.items) {
    if (item.kind === 'transaction') {
      const { row } = item;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return `Linha ${row.line}: data inválida.`;
      if (!Number.isFinite(row.amount) || row.amount <= 0)
        return `Linha ${row.line}: valor inválido.`;
      if (!row.description.trim()) return `Linha ${row.line}: sem descrição.`;
      if (row.settlement === 'card' && row.type === 'income') {
        return `Linha ${row.line}: receita não entra em cartão.`;
      }
    } else {
      const { transfer } = item;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(transfer.date))
        return `Transferência da linha ${transfer.lines[0]}: data inválida.`;
      if (normalizeName(transfer.from) === normalizeName(transfer.to)) {
        return `Transferência da linha ${transfer.lines[0]}: origem e destino iguais.`;
      }
    }
  }

  return null;
}

/**
 * Grava tudo que foi revisado. A ordem importa: contas → cartões (dependem da
 * conta) → categorias e tags → transações → vínculos de tag.
 *
 * Não é uma transação de banco: o PostgREST não abre uma entre chamadas. O
 * que protege o usuário é (1) as transações irem num único insert por lote,
 * (2) as entidades criadas antes de uma falha serem inofensivas sozinhas e
 * (3) a checagem de duplicatas deixar reimportar o mesmo arquivo sem dobrar.
 */
export async function runImport(
  payload: ImportPayload,
): Promise<Result<{ outcome: ImportOutcome }>> {
  const invalid = validatePayload(payload);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const created = { accounts: 0, cards: 0, categories: 0, tags: 0 };
  const colorAt = (index: number) => CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];

  // --- Contas -------------------------------------------------------------
  const accountIdByKey = new Map<string, string>();
  const newAccounts = Object.entries(payload.origins).filter(
    ([, origin]) => origin.kind === 'account' && origin.target === 'new',
  );

  if (newAccounts.length > 0) {
    const { data: last } = await supabase
      .from('accounts')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { count } = await supabase.from('accounts').select('id', { count: 'exact', head: true });

    const { data, error } = await supabase
      .from('accounts')
      .insert(
        newAccounts.map(([, origin], index) => ({
          user_id: user.id,
          name: origin.name.trim(),
          kind: origin.accountKind ?? 'checking',
          color: colorAt((count ?? 0) + index),
          opening_balance: 0,
          position: (last?.position ?? 0) + index + 1,
        })),
      )
      .select('id, name');

    if (error) {
      return {
        error: error.code === '23505' ? 'Já existe uma conta com um desses nomes.' : error.message,
      };
    }
    for (const [key, origin] of newAccounts) {
      const row = data?.find((entry) => normalizeName(entry.name) === normalizeName(origin.name));
      if (!row) return { error: `Conta "${origin.name}" não foi criada.` };
      accountIdByKey.set(key, row.id);
    }
    created.accounts = newAccounts.length;
  }

  for (const [key, origin] of Object.entries(payload.origins)) {
    if (origin.kind === 'account' && origin.target !== 'new')
      accountIdByKey.set(key, origin.target);
  }

  // --- Cartões ------------------------------------------------------------
  const cardIdByKey = new Map<string, string>();
  const newCards = Object.entries(payload.origins).filter(
    ([, origin]) => origin.kind === 'card' && origin.target === 'new',
  );

  if (newCards.length > 0) {
    const { data: last } = await supabase
      .from('credit_cards')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { count } = await supabase
      .from('credit_cards')
      .select('id', { count: 'exact', head: true });

    const rows = [];
    for (const [, origin] of newCards) {
      const card = origin.card!;
      const accountId = card.accountTarget.startsWith('account:')
        ? accountIdByKey.get(card.accountTarget)
        : card.accountTarget;
      if (!accountId) return { error: `Cartão "${origin.name}": conta da fatura não encontrada.` };
      rows.push({
        user_id: user.id,
        account_id: accountId,
        name: origin.name.trim(),
        brand: null,
        color: colorAt((count ?? 0) + rows.length),
        credit_limit: 0,
        closing_day: card.closingDay,
        due_day: card.dueDay,
        position: (last?.position ?? 0) + rows.length + 1,
      });
    }

    const { data, error } = await supabase.from('credit_cards').insert(rows).select('id, name');
    if (error) {
      return {
        error: error.code === '23505' ? 'Já existe um cartão com um desses nomes.' : error.message,
      };
    }
    for (const [key, origin] of newCards) {
      const row = data?.find((entry) => normalizeName(entry.name) === normalizeName(origin.name));
      if (!row) return { error: `Cartão "${origin.name}" não foi criado.` };
      cardIdByKey.set(key, row.id);
    }
    created.cards = newCards.length;
  }

  for (const [key, origin] of Object.entries(payload.origins)) {
    if (origin.kind === 'card' && origin.target !== 'new') cardIdByKey.set(key, origin.target);
  }

  // --- Categorias ---------------------------------------------------------
  const categoryIdByKey = new Map<string, string | null>();
  const newCategories = Object.entries(payload.categories).filter(
    ([, category]) => category.target === 'new',
  );

  if (newCategories.length > 0) {
    const { data: last } = await supabase
      .from('categories')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { count } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true });

    const { data, error } = await supabase
      .from('categories')
      .insert(
        newCategories.map(([, category], index) => ({
          user_id: user.id,
          name: category.name.trim(),
          kind: category.kind,
          color: colorAt((count ?? 0) + index),
          budget: 0,
          position: (last?.position ?? 0) + index + 1,
        })),
      )
      .select('id, name');

    if (error) {
      return {
        error:
          error.code === '23505' ? 'Já existe uma categoria com um desses nomes.' : error.message,
      };
    }
    for (const [key, category] of newCategories) {
      const row = data?.find((entry) => normalizeName(entry.name) === normalizeName(category.name));
      if (!row) return { error: `Categoria "${category.name}" não foi criada.` };
      categoryIdByKey.set(key, row.id);
    }
    created.categories = newCategories.length;
  }

  for (const [key, category] of Object.entries(payload.categories)) {
    if (category.target === 'none') categoryIdByKey.set(key, null);
    else if (category.target !== 'new') categoryIdByKey.set(key, category.target);
  }

  // --- Tags ---------------------------------------------------------------
  const tagIdByName = new Map<string, string>();
  if (payload.tags.length > 0) {
    const { data: existing, error } = await supabase.from('tags').select('id, name');
    if (error) return { error: error.message };
    for (const tag of existing ?? []) tagIdByName.set(normalizeName(tag.name), tag.id);

    const missing = payload.tags.filter((name) => !tagIdByName.has(normalizeName(name)));
    if (missing.length > 0) {
      const { data, error: tagError } = await supabase
        .from('tags')
        .insert(
          missing.map((name, index) => ({
            user_id: user.id,
            name: name.trim(),
            color: colorAt(tagIdByName.size + index),
          })),
        )
        .select('id, name');
      if (tagError) return { error: tagError.message };
      for (const tag of data ?? []) tagIdByName.set(normalizeName(tag.name), tag.id);
      created.tags = missing.length;
    }
  }

  // --- Transações ---------------------------------------------------------
  type TxInsert = Database['public']['Tables']['transactions']['Insert'];

  // Num insert em lote o PostgREST usa a UNIÃO das chaves de todas as linhas
  // e preenche o que falta com null — não com o default da coluna. Por isso
  // toda linha (lançamento ou ponta de transferência) carrega o mesmo conjunto
  // completo de colunas; faltar `is_transfer` numa delas derruba o lote inteiro.
  const rows: Array<{ insert: TxInsert; tags: string[] }> = [];
  let firstMonth: string | null = null;

  const resolveOrigin = (kind: 'account' | 'card', name: string | null) => {
    if (!name) return null;
    const key = `${kind}:${normalizeName(name)}`;
    return (kind === 'account' ? accountIdByKey : cardIdByKey).get(key) ?? null;
  };

  for (const item of payload.items) {
    if (item.kind === 'transfer') {
      const { transfer } = item;
      const from = resolveOrigin('account', transfer.from);
      const to = resolveOrigin('account', transfer.to);
      if (!from || !to) {
        return { error: `Transferência da linha ${transfer.lines[0]}: conta não mapeada.` };
      }
      if (from === to) {
        return {
          error: `Transferência da linha ${transfer.lines[0]}: origem e destino caíram na mesma conta.`,
        };
      }
      const fromName =
        payload.origins[`account:${normalizeName(transfer.from)}`]?.name ?? transfer.from;
      const toName = payload.origins[`account:${normalizeName(transfer.to)}`]?.name ?? transfer.to;
      const shared = {
        user_id: user.id,
        amount: transfer.amount,
        date: transfer.date,
        description: transfer.description.trim() || `Transferência ${fromName} → ${toName}`,
        notes: null,
        settlement: 'account' as const,
        card_id: null,
        payment_method: 'transfer' as const,
        category_id: null,
        is_card_payment: false,
        card_payment_for: null,
        card_payment_month: null,
        is_transfer: true,
        transfer_group: crypto.randomUUID(),
      };
      rows.push({ insert: { ...shared, type: 'expense', account_id: from }, tags: [] });
      rows.push({ insert: { ...shared, type: 'income', account_id: to }, tags: [] });
      firstMonth = minDate(firstMonth, transfer.date);
      continue;
    }

    const { row } = item;
    const isCard = row.settlement === 'card';
    const accountId = isCard ? null : resolveOrigin('account', row.origin);
    const cardId = isCard ? resolveOrigin('card', row.origin) : null;
    if (isCard && !cardId)
      return { error: `Linha ${row.line}: cartão "${row.origin}" não mapeado.` };

    const categoryId = row.category
      ? (categoryIdByKey.get(normalizeName(row.category)) ?? null)
      : null;
    const paidCardId = row.nature === 'card_payment' ? resolveOrigin('card', row.paidCard) : null;
    const isCardPayment = row.nature === 'card_payment' && paidCardId !== null && !isCard;

    rows.push({
      insert: {
        user_id: user.id,
        type: row.type,
        description: row.description.trim().slice(0, 120),
        amount: row.amount,
        date: row.date,
        notes: row.notes,
        category_id: isCardPayment ? null : categoryId,
        settlement: row.settlement,
        account_id: accountId,
        card_id: cardId,
        payment_method: isCard ? 'credit' : row.method,
        is_card_payment: isCardPayment,
        card_payment_for: isCardPayment ? paidCardId : null,
        card_payment_month: isCardPayment && row.paidMonth ? `${row.paidMonth}-01` : null,
        is_transfer: false,
        transfer_group: null,
      },
      tags: row.tags,
    });
    firstMonth = minDate(firstMonth, row.date);
  }

  let transactions = 0;
  let transfers = 0;
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    const { data, error } = await supabase
      .from('transactions')
      .insert(chunk.map((entry) => entry.insert))
      .select('id, is_transfer');

    if (error) {
      return {
        error: `Falha ao gravar (${transactions} lançamentos já entraram): ${error.message}`,
      };
    }

    const links = (data ?? []).flatMap((inserted, index) =>
      chunk[index].tags.flatMap((tag) => {
        const tagId = tagIdByName.get(normalizeName(tag));
        return tagId ? [{ transaction_id: inserted.id, tag_id: tagId, user_id: user.id }] : [];
      }),
    );
    if (links.length > 0) {
      const { error: linkError } = await supabase.from('transaction_tags').insert(links);
      if (linkError) return { error: linkError.message };
    }

    for (const inserted of data ?? []) {
      if (inserted.is_transfer) transfers += 0.5;
      else transactions += 1;
    }
  }

  for (const path of [
    '/dashboard',
    '/transactions',
    '/categories',
    '/reports',
    '/accounts',
    '/cards',
    '/forecast',
    '/settings',
  ]) {
    revalidatePath(path);
  }

  return {
    error: null,
    outcome: {
      transactions,
      transfers: Math.round(transfers),
      created,
      firstMonth: firstMonth ? `${firstMonth.slice(0, 7)}-01` : null,
    },
  };
}
