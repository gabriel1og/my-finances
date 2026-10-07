import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';

let fake: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fake.client }));
const { getCardCommitmentsForMonth, getStatementAdjustments, getStatementsDue } =
  await import('./statement-queries');
beforeEach(() => {
  fake = createSupabaseMock();
});

describe('persisted statement queries', () => {
  it('consulta vencimentos reais, incluindo ciclos antigos adiados', async () => {
    await getStatementsDue('2026-11-01', 3);
    expect(fake.callsTo('card_statements')[0].filters).toEqual([
      { kind: 'gte', column: 'due_date', value: '2026-11-01' },
      { kind: 'lt', column: 'due_date', value: '2027-02-01' },
      { kind: 'is', column: 'merged_into', value: null },
    ]);
  });
  it('referência incorporada mantém o compromisso na conta usando a fatura resultante', async () => {
    const source = { card_id: 'card', statement_id: 'source', merged_into: 'dest', open_amount: 0 };
    const dest = { card_id: 'card', statement_id: 'dest', merged_into: null, open_amount: 300 };
    fake = createSupabaseMock({
      responses: {
        'card_statements.select': (call) => ({
          data: call.filters.some((filter) => filter.kind === 'in') ? [dest] : [source],
        }),
      },
    });
    expect(await getCardCommitmentsForMonth('2026-10-01')).toEqual([dest]);
    expect(fake.callsTo('card_statements')[1].filters).toContainEqual({
      kind: 'in',
      column: 'statement_id',
      value: ['dest'],
    });
  });
  it('histórico restringe o cartão e falhas de consulta não viram lista vazia', async () => {
    await getStatementAdjustments('card');
    expect(fake.callsTo('statement_adjustments')[0].filters).toContainEqual({
      kind: 'eq',
      column: 'card_id',
      value: 'card',
    });
    fake = createSupabaseMock({
      responses: { 'card_statements.select': { error: { message: 'Unavailable' } } },
    });
    await expect(getStatementsDue('2026-11-01')).rejects.toEqual({ message: 'Unavailable' });
  });
});
