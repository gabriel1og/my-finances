import { describe, expect, it } from 'vitest';
import { createSupabaseMock } from '@/test/supabaseMock';
import { budgets, forecast } from './projections';
import { parseFinancialQuery, type AssistantDatabase } from './tools';

const query = {
  domain: 'forecast',
  start: '2026-10-01',
  end: '2026-11-30',
  categoryId: null,
  accountId: null,
  cardId: null,
  tagId: null,
  search: null,
  page: 1,
};
class FakeProjectionDatabase {
  readonly db: AssistantDatabase;
  constructor(responses: Parameters<typeof createSupabaseMock>[0]) {
    const fake = createSupabaseMock(responses);
    this.db = {
      from: (table: string) => {
        const builder = fake.client.from(table);
        Object.assign(builder, { abortSignal: () => builder, not: () => builder });
        return builder;
      },
    } as unknown as AssistantDatabase;
  }
}
describe('assistant projections', () => {
  it('does not count a posted recurrence again, independently for each month', async () => {
    const fake = new FakeProjectionDatabase({
      responses: {
        'card_statements.select': {
          data: [
            {
              card_id: 'card',
              statement_month: '2026-09-01',
              due_date: '2026-10-10',
              total: 250,
              open_amount: 200,
            },
            {
              card_id: 'card',
              statement_month: '2026-10-01',
              due_date: '2026-11-10',
              total: 100,
              open_amount: 100,
            },
          ],
        },
        'recurring_transactions.select': {
          data: [
            {
              id: 'fixed',
              is_active: true,
              start_month: '2026-01-01',
              end_month: null,
              type: 'expense',
              amount: 50,
            },
          ],
        },
        'transactions.select': {
          data: [{ id: 'tx', recurring_id: 'fixed', recurring_month: '2026-10-01' }],
        },
      },
    });
    const result = await forecast(
      fake.db,
      parseFinancialQuery(query),
      new AbortController().signal,
    );
    expect(result.estimate).toBe(true);
    expect(result.months.map((row) => row.committed)).toEqual([200, 150]);
    expect(result.months.map((row) => row.recurringExpense)).toEqual([0, 50]);
  });
  it('uses monthly override and rollover, including a month with no spending row', async () => {
    const fake = new FakeProjectionDatabase({
      responses: {
        'categories.select': {
          data: [
            {
              id: 'food',
              name: 'Alimentação',
              kind: 'expense',
              budget: 100,
              rollover_enabled: true,
              rollover_since: '2026-09-01',
            },
          ],
        },
        'category_month_spending.select': {
          data: [
            { category_id: 'food', kind: 'expense', month: '2026-09-01', budget: 100, spent: 80 },
            { category_id: 'food', kind: 'expense', month: '2026-10-01', budget: 150, spent: 170 },
          ],
        },
        'budgets.select': { data: [{ category_id: 'food', month: '2026-10-01', amount: 150 }] },
      },
    });
    const result = await budgets(
      fake.db,
      parseFinancialQuery({ ...query, domain: 'budgets' }),
      new AbortController().signal,
    );
    expect(result[0]).toMatchObject({ budget: 150, carry: 20, available: 170, spent: 170 });
    expect(result[1]).toMatchObject({ budget: 100, carry: 0, available: 100, spent: 0 });
  });
  it('rejects an unbounded projection before loading data', async () => {
    await expect(
      forecast(
        {} as AssistantDatabase,
        parseFinancialQuery({ ...query, end: '2040-01-01' }),
        new AbortController().signal,
      ),
    ).rejects.toThrow('120 meses');
  });
});
