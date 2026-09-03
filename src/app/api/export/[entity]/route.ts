import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { csvNumber, toCsv } from '@/lib/csv';
import { ACCOUNT_KIND_LABEL, PAYMENT_METHOD_LABEL } from '@/lib/constants';
import { isExportEntity, type ExportEntity } from '@/lib/export';
import type {
  Account,
  Category,
  CreditCard,
  RecurringWithRelations,
  Tag,
} from '@/types/database.types';

export const dynamic = 'force-dynamic';

/**
 * Exportação das entidades além de transações. `transactions` tem o handler
 * próprio em `../transactions/route.ts` (segmento estático ganha do dinâmico).
 *
 * Cada CSV inclui o `id`: é o que permite, num restore futuro, religar cartão
 * → conta e fixo → categoria sem depender de nome.
 */
type Csv = { columns: Array<{ key: string; label: string }>; rows: Array<Record<string, unknown>> };

type Client = Awaited<ReturnType<typeof createClient>>;

const BUILDERS: Record<
  Exclude<ExportEntity, 'transactions'>,
  (supabase: Client) => Promise<Csv>
> = {
  async categories(supabase) {
    const { data, error } = await supabase.from('categories').select('*').order('position');
    if (error) throw error;
    return {
      columns: [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Nome' },
        { key: 'kind', label: 'Tipo' },
        { key: 'budget', label: 'Limite mensal' },
        { key: 'color', label: 'Cor' },
        { key: 'rollover', label: 'Rollover' },
        { key: 'rolloverSince', label: 'Rollover desde' },
        { key: 'archived', label: 'Arquivada' },
      ],
      rows: ((data ?? []) as Category[]).map((category) => ({
        id: category.id,
        name: category.name,
        kind: category.kind === 'income' ? 'Receita' : 'Despesa',
        budget: csvNumber(Number(category.budget)),
        color: category.color,
        rollover: category.rollover_enabled ? 'Sim' : 'Não',
        rolloverSince: category.rollover_since?.slice(0, 7) ?? '',
        archived: category.is_archived ? 'Sim' : 'Não',
      })),
    };
  },

  async accounts(supabase) {
    const { data, error } = await supabase.from('accounts').select('*').order('position');
    if (error) throw error;
    return {
      columns: [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Nome' },
        { key: 'kind', label: 'Tipo' },
        { key: 'institution', label: 'Instituição' },
        { key: 'openingBalance', label: 'Saldo inicial' },
        { key: 'color', label: 'Cor' },
        { key: 'archived', label: 'Arquivada' },
      ],
      rows: ((data ?? []) as Account[]).map((account) => ({
        id: account.id,
        name: account.name,
        kind: ACCOUNT_KIND_LABEL[account.kind],
        institution: account.institution ?? '',
        openingBalance: csvNumber(Number(account.opening_balance)),
        color: account.color,
        archived: account.is_archived ? 'Sim' : 'Não',
      })),
    };
  },

  async cards(supabase) {
    const { data, error } = await supabase
      .from('credit_cards')
      .select('*, account:accounts(id,name)')
      .order('position');
    if (error) throw error;
    type Row = CreditCard & { account: { id: string; name: string } | null };
    return {
      columns: [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Nome' },
        { key: 'brand', label: 'Bandeira' },
        { key: 'account', label: 'Conta da fatura' },
        { key: 'accountId', label: 'ID da conta' },
        { key: 'limit', label: 'Limite' },
        { key: 'closingDay', label: 'Fechamento' },
        { key: 'dueDay', label: 'Vencimento' },
        { key: 'color', label: 'Cor' },
        { key: 'archived', label: 'Arquivado' },
      ],
      rows: ((data ?? []) as unknown as Row[]).map((card) => ({
        id: card.id,
        name: card.name,
        brand: card.brand ?? '',
        account: card.account?.name ?? '',
        accountId: card.account_id,
        limit: csvNumber(Number(card.credit_limit)),
        closingDay: card.closing_day,
        dueDay: card.due_day,
        color: card.color,
        archived: card.is_archived ? 'Sim' : 'Não',
      })),
    };
  },

  async recurring(supabase) {
    const { data, error } = await supabase
      .from('recurring_transactions')
      .select(
        '*, category:categories(id,name,color)' +
          ', account:accounts(id,name,color)' +
          ', card:credit_cards(id,name,color)' +
          ', tags(id,name,color)',
      )
      .order('day_of_month');
    if (error) throw error;
    return {
      columns: [
        { key: 'id', label: 'ID' },
        { key: 'description', label: 'Descrição' },
        { key: 'type', label: 'Tipo' },
        { key: 'amount', label: 'Valor' },
        { key: 'day', label: 'Dia' },
        { key: 'category', label: 'Categoria' },
        { key: 'origin', label: 'Conta/Cartão' },
        { key: 'method', label: 'Forma' },
        { key: 'start', label: 'Início' },
        { key: 'end', label: 'Fim' },
        { key: 'active', label: 'Ativo' },
        { key: 'tags', label: 'Tags' },
        { key: 'notes', label: 'Observações' },
      ],
      rows: ((data ?? []) as unknown as RecurringWithRelations[]).map((item) => ({
        id: item.id,
        description: item.description,
        type: item.type === 'income' ? 'Receita' : 'Despesa',
        amount: csvNumber(Number(item.amount)),
        day: item.day_of_month,
        category: item.category?.name ?? '',
        origin: item.card?.name ?? item.account?.name ?? '',
        method: item.payment_method ? PAYMENT_METHOD_LABEL[item.payment_method] : '',
        start: item.start_month.slice(0, 7),
        end: item.end_month?.slice(0, 7) ?? '',
        active: item.is_active ? 'Sim' : 'Não',
        tags: (item.tags ?? []).map((tag) => tag.name).join(', '),
        notes: item.notes ?? '',
      })),
    };
  },

  async tags(supabase) {
    const { data, error } = await supabase.from('tags').select('*').order('name');
    if (error) throw error;
    return {
      columns: [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Nome' },
        { key: 'color', label: 'Cor' },
      ],
      rows: ((data ?? []) as Tag[]).map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
      })),
    };
  },
};

const FILE_NAME: Record<Exclude<ExportEntity, 'transactions'>, string> = {
  categories: 'categorias',
  accounts: 'contas',
  cards: 'cartoes',
  recurring: 'fixos',
  tags: 'tags',
};

export async function GET(_request: NextRequest, context: { params: Promise<{ entity: string }> }) {
  const { entity } = await context.params;
  if (!isExportEntity(entity) || entity === 'transactions') {
    return NextResponse.json({ error: 'Entidade desconhecida.' }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  let csv: string;
  try {
    const { columns, rows } = await BUILDERS[entity](supabase);
    csv = toCsv(rows, columns);
  } catch (error) {
    // O erro do PostgREST é um objeto simples, não um Error: sem esta
    // segunda leitura, a mensagem do banco nunca chegava a quem exportou.
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Falha ao exportar.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return new NextResponse(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="flowly-${FILE_NAME[entity]}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
