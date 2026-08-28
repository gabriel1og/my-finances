import { createClient } from '@/lib/supabase/server';
import { monthRange } from '@/lib/format';
import type { CategorySpending, MonthlyFlow, TransactionWithCategory } from '@/types/database.types';

export async function getTransactions(month?: string, limit?: number) {
  const supabase = await createClient();
  let query = supabase
    .from('transactions')
    .select('*, category:categories(id, name, color)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (month) {
    const { start, end } = monthRange(month);
    query = query.gte('date', start).lte('date', end);
  }
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as TransactionWithCategory[];
}

export async function getMonthlyFlow(months = 6) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('monthly_flow')
    .select('*')
    .order('month', { ascending: false })
    .limit(months);
  if (error) throw error;
  return ((data ?? []) as MonthlyFlow[]).reverse();
}

export async function getCategorySpending(month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('category_month_spending')
    .select('*')
    .eq('month', `${month.slice(0, 7)}-01`)
    .order('spent', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CategorySpending[];
}

export async function getCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_archived', false)
    .order('position');
  if (error) throw error;
  return data ?? [];
}
