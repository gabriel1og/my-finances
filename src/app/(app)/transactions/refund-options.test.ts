import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';
let db: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db.client) }));
vi.mock('@/lib/queries', () => ({ getCardStatement: vi.fn(async () => null) }));
const { resolveRefundStatement, findRefundPurchases, getRefundPurchaseReference } =
  await import('./refund-options');
beforeEach(() => {
  db = createSupabaseMock();
});
describe('opções autorizadas de estorno', () => {
  it('resolve fatura incorporada para seu destino', async () => {
    db = createSupabaseMock({
      responses: {
        'card_statements.select': (call) => ({
          data: call.filters.some((filter) => filter.value === 'source')
            ? [{ statement_id: 'source', merged_into: 'target' }]
            : [{ statement_id: 'target', merged_into: null }],
        }),
      },
    });
    expect((await resolveRefundStatement('card', '', 'source')).statement?.statement_id).toBe(
      'target',
    );
  });
  it('não retorna identidade ao falhar e limita a busca', async () => {
    expect((await resolveRefundStatement('card', '2026-09')).statement).toBeNull();
    await findRefundPurchases('card', 'loja', 2);
    expect(db.callsTo('search_card_purchases', 'rpc')[0].payload).toMatchObject({
      p_offset: 40,
      p_search: 'loja',
    });
  });
  it('recupera descrição da referência pela leitura sujeita a RLS', async () => {
    db = createSupabaseMock({
      responses: { 'transactions.select': { data: [{ id: 'purchase', description: 'Loja' }] } },
    });
    expect((await getRefundPurchaseReference('purchase')).purchase?.description).toBe('Loja');
    expect(db.callsTo('transactions')[0].filters).toContainEqual({
      kind: 'eq',
      column: 'id',
      value: 'purchase',
    });
  });
});
