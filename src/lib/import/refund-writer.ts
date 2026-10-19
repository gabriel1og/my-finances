import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { ParsedRow, PlanItem } from './types';
import { normalizeName } from './plan';

type RefundImportContext = {
  db: SupabaseClient<Database>;
  items: PlanItem[];
  cards: Map<string, string>;
  categories: Map<string, string | null>;
  tags: Map<string, string>;
  sourceIds: Map<string, string>;
  statements?: Map<string, string>;
};

async function importStatement(db: SupabaseClient<Database>, cardId: string, month: string) {
  const ensured = await db.rpc('ensure_statement_month', { p_month: `${month}-01` });
  if (ensured.error) throw new Error(ensured.error.message);
  const cycle = await db
    .from('card_statements')
    .select('statement_id,merged_into')
    .eq('card_id', cardId)
    .eq('statement_month', `${month}-01`)
    .single();
  if (cycle.error || !cycle.data) throw new Error('Fatura não encontrada para o estorno.');
  return cycle.data.merged_into ?? cycle.data.statement_id;
}

async function importReference(context: RefundImportContext, row: ParsedRow, cardId: string) {
  const source = row.relatedPurchaseSourceId;
  if (!source) return null;
  const candidate = context.sourceIds.get(source) ?? source;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(candidate)) return null;
  const result = await context.db
    .from('transactions')
    .select('id')
    .eq('id', candidate)
    .eq('card_id', cardId)
    .eq('type', 'expense')
    .eq('settlement', 'card')
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data?.id ?? null;
}

async function importOneRefund(context: RefundImportContext, row: ParsedRow) {
  const cardId = context.cards.get(`card:${normalizeName(row.origin ?? '')}`);
  if (!cardId || !row.statementMonth)
    throw new Error(`Linha ${row.line}: escolha cartão e fatura do estorno.`);
  const statementId =
    context.statements?.get(`${cardId}|${row.statementMonth}`) ??
    (await importStatement(context.db, cardId, row.statementMonth));
  const reference = await importReference(context, row, cardId);
  const { error } = await context.db.rpc('save_card_refund', {
    p_id: null,
    p_input: {
      description: row.description,
      date: row.date,
      amount: row.amount,
      cardId,
      statementId,
      categoryId: row.category
        ? (context.categories.get(normalizeName(row.category)) ?? null)
        : null,
      relatedPurchaseId: reference,
      notes: row.notes,
      tagIds: row.tags.flatMap((tag) => context.tags.get(normalizeName(tag)) ?? []),
    },
  });
  if (error) throw new Error(error.message);
  return row.relatedPurchaseSourceId && !reference
    ? `Linha ${row.line}: compra relacionada não encontrada; estorno importado sem vínculo.`
    : null;
}

/** Importa créditos após as compras, para resolver IDs do próprio arquivo. Ex.: importCardRefunds(context). */
export async function importCardRefunds(context: RefundImportContext) {
  const warnings: string[] = [];
  let imported = 0;
  for (const item of context.items) {
    if (item.kind !== 'transaction' || item.row.nature !== 'card_refund') continue;
    try {
      const warning = await importOneRefund(context, item.row);
      if (warning) warnings.push(warning);
      imported += 1;
    } catch (failure) {
      return {
        imported,
        warnings,
        error: `Linha ${item.row.line}: ${failure instanceof Error ? failure.message : 'Falha ao importar estorno.'}`,
      };
    }
  }
  return { imported, warnings, error: null };
}

/** Resolve todos os destinos antes de gravar compras. Ex.: prepareRefundDestinations(db, items, cards). */
export async function prepareRefundDestinations(
  db: SupabaseClient<Database>,
  items: PlanItem[],
  cards: Map<string, string>,
) {
  const statements = new Map<string, string>();
  for (const item of items) {
    if (item.kind !== 'transaction' || item.row.nature !== 'card_refund') continue;
    const { row } = item;
    const card = cards.get(`card:${normalizeName(row.origin ?? '')}`);
    if (!card || !row.statementMonth)
      return { statements, error: `Linha ${row.line}: escolha cartão e fatura do estorno.` };
    try {
      statements.set(
        `${card}|${row.statementMonth}`,
        await importStatement(db, card, row.statementMonth),
      );
    } catch {
      return {
        statements,
        error: `Linha ${row.line}: cartão ou fatura do estorno não encontrado para este usuário.`,
      };
    }
  }
  return { statements, error: null };
}
