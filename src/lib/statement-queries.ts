import { createClient } from '@/lib/supabase/server';
import { getCardStatements } from './queries';
import type { CardStatement } from '@/types/database.types';

/** Audit of reviewed cycle changes for this card, newest first. */
export async function getStatementAdjustments(cardId: string) {
  const db = await createClient();
  const { data, error } = await db
    .from('statement_adjustments')
    .select('id,operation,reason,created_at')
    .eq('card_id', cardId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

/** Commitments use due dates, so postponed older cycles remain in the requested window. */
export async function getStatementsDue(fromMonth: string, monthsAhead = 6) {
  const db = await createClient();
  const start = `${fromMonth.slice(0, 7)}-01`;
  const [year, month] = start.slice(0, 7).split('-').map(Number);
  const last = new Date(Date.UTC(year, month - 1 + monthsAhead, 1)).toISOString().slice(0, 10);
  const { data, error } = await db
    .from('card_statements')
    .select('*')
    .gte('due_date', start)
    .lt('due_date', last)
    .is('merged_into', null)
    .order('due_date');
  if (error) throw error;
  return (data ?? []) as CardStatement[];
}

/** Resolve an incorporated reference for account commitments without losing its debt. */
export async function getCardCommitmentsForMonth(month: string): Promise<CardStatement[]> {
  const statements = await getCardStatements(month);
  const destinations = statements.flatMap((row) => (row.merged_into ? [row.merged_into] : []));
  if (!destinations.length) return statements;
  const db = await createClient();
  const { data, error } = await db
    .from('card_statements')
    .select('*')
    .in('statement_id', destinations);
  if (error) throw error;
  return statements.map((row) =>
    row.merged_into ? (data?.find((dest) => dest.statement_id === row.merged_into) ?? row) : row,
  );
}
