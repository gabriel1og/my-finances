import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';

let supabase: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabase.client),
}));

const { buildTransactionSearchFilter, getTransactionsPage } = await import('@/lib/queries');

beforeEach(() => {
  supabase = createSupabaseMock({ responses: { 'transactions.select': { count: 0 } } });
});

describe('buildTransactionSearchFilter', () => {
  it('busca descrição e notas quando o texto não tem valor', () => {
    expect(buildTransactionSearchFilter('mercado')).toBe(
      'description.ilike.%mercado%,notes.ilike.%mercado%',
    );
  });

  it('inclui valor exato com vírgula decimal', () => {
    expect(buildTransactionSearchFilter('aquele lançamento de 175,68')).toBe(
      'description.ilike.%aquele lançamento de 175 68%,notes.ilike.%aquele lançamento de 175 68%,amount.eq.175.68',
    );
  });

  it('entende valor com separador de milhar', () => {
    expect(buildTransactionSearchFilter('R$ 1.234,56')).toBe(
      'description.ilike.%R$ 1.234 56%,notes.ilike.%R$ 1.234 56%,amount.eq.1234.56',
    );
  });
});

describe('getTransactionsPage', () => {
  it('envia busca por descrição, notas e valor para o banco', async () => {
    await getTransactionsPage({ month: null, search: '175,68' });

    const [call] = supabase.callsTo('transactions', 'select');
    expect(call.filters).toContainEqual({
      kind: 'or',
      column: 'or',
      value: 'description.ilike.%175 68%,notes.ilike.%175 68%,amount.eq.175.68',
    });
  });
});
