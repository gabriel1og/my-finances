import { describe, expect, it } from 'vitest';
import {
  executeFinancialQuery,
  monthlyChanges,
  parseFinancialQuery,
  readAll,
  type AssistantDatabase,
} from './tools';
import { createSupabaseMock } from '@/test/supabaseMock';

const id = '11111111-1111-4111-8111-111111111111';
const query = {
  domain: 'totals',
  start: '2026-08-01',
  end: '2026-10-31',
  categoryId: null,
  accountId: null,
  cardId: null,
  tagId: null,
  search: null,
  page: 1,
};

class FakePages {
  calls: number[] = [];
  constructor(
    private readonly count: number,
    private readonly fail = false,
  ) {}
  async fetch(from: number, to: number) {
    this.calls.push(from);
    return {
      data: Array.from(
        { length: Math.max(0, Math.min(this.count - from, to - from + 1)) },
        (_, index) => ({ id: from + index }),
      ),
      error: this.fail ? { message: 'private database details' } : null,
    };
  }
}

describe('financial queries', () => {
  it('rejects unsupported domains, arbitrary SQL, unknown keys, inverted intervals and forged IDs', () => {
    expect(parseFinancialQuery(query).domain).toBe('totals');
    for (const value of [
      { ...query, domain: 'delete' },
      { ...query, sql: 'select * from users' },
      { ...query, accountId: 'another-user' },
      { ...query, start: '2027-01-01' },
      { ...query, page: 0 },
      { ...query, search: 'a'.repeat(201) },
    ])
      expect(() => parseFinancialQuery(value)).toThrow();
  });
  it('loads beyond the Supabase row cap instead of treating a page as a total', async () => {
    const pages = new FakePages(1205);
    expect(await readAll(pages.fetch.bind(pages))).toHaveLength(1205);
    expect(pages.calls).toEqual([0, 500, 1000]);
    await expect(
      readAll(new FakePages(1, true).fetch.bind(new FakePages(1, true))),
    ).rejects.toThrow('Não foi possível consultar');
    const controller = new AbortController();
    controller.abort();
    await expect(readAll(pages.fetch.bind(pages), controller.signal)).rejects.toThrow();
  });
  it('computes differences including zero baseline without dividing by zero', () => {
    expect(
      monthlyChanges({
        monthly: [
          { month: '2026-08-01', expense: 100 },
          { month: '2026-09-01', expense: 0 },
          { month: '2026-10-01', expense: 150 },
        ],
      }),
    ).toEqual([
      { month: '2026-09-01', expenseChange: -100, percentChange: -100 },
      { month: '2026-10-01', expenseChange: 150, percentChange: null },
    ]);
  });
  it('requires a specific account for balance history', async () => {
    await expect(
      executeFinancialQuery(
        {} as AssistantDatabase,
        parseFinancialQuery({ ...query, domain: 'balance_history' }),
        new AbortController().signal,
      ),
    ).rejects.toThrow('Identifique a conta');
  });
  it('builds links using existing filters instead of provider URLs', async () => {
    const fake = createSupabaseMock({ responses: { 'transactions.select': { data: [] } } });
    const db = fake.client as unknown as AssistantDatabase;
    // Existing test double does not need network cancellation, so keep a thin named wrapper.
    const client = new AbortableFakeDatabase(db);
    const result = await executeFinancialQuery(
      client.db,
      parseFinancialQuery({ ...query, domain: 'transactions', categoryId: id }),
      new AbortController().signal,
    );
    expect(result.source.href).toContain('scope=all');
    expect(result.source.href).toContain(`category=${id}`);
    expect(result.source.period).toBe('2026-08-01 a 2026-10-31');
  });
});

class AbortableFakeDatabase {
  db: AssistantDatabase;
  constructor(client: AssistantDatabase) {
    this.db = {
      from: (table: string) => {
        const builder = client.from(table as 'transactions');
        Object.assign(builder, { abortSignal: () => builder });
        return builder;
      },
    } as unknown as AssistantDatabase;
  }
}
