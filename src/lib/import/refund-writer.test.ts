import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { createSupabaseMock } from '@/test/supabaseMock';
import { importCardRefunds, prepareRefundDestinations } from './refund-writer';
import type { PlanItem } from './types';

const item: PlanItem = {
  id: 'refund',
  kind: 'transaction',
  row: {
    line: 2,
    type: 'income',
    nature: 'card_refund',
    settlement: 'card',
    date: '2026-10-19',
    description: 'Estorno',
    amount: 150,
    origin: 'Visa',
    statementMonth: '2026-09',
    category: 'Compras',
    paidCard: null,
    paidMonth: null,
    method: 'credit',
    tags: ['Loja'],
    notes: 'Referência',
    relatedPurchaseSourceId: 'source-purchase',
    warnings: [],
  },
};
const purchaseId = '45555555-5555-4555-8555-555555555551';
function refundContext(db: ReturnType<typeof createSupabaseMock>) {
  return {
    db: db.client as unknown as SupabaseClient<Database>,
    items: [item],
    cards: new Map([['card:visa', 'card']]),
    categories: new Map([['compras', 'category']]),
    tags: new Map([['loja', 'tag']]),
    sourceIds: new Map([['source-purchase', purchaseId]]),
  };
}
describe('gravação de CSV de estorno', () => {
  it('resolve compra importada e grava tags e destino atomicamente', async () => {
    const db = createSupabaseMock({
      responses: {
        'card_statements.select': { data: [{ statement_id: 'old', merged_into: 'merged' }] },
        'transactions.select': { data: [{ id: purchaseId }] },
      },
    });
    const result = await importCardRefunds(refundContext(db));
    expect(result).toMatchObject({ imported: 1, warnings: [], error: null });
    expect(db.callsTo('save_card_refund', 'rpc')[0].payload).toMatchObject({
      p_id: null,
      p_input: {
        statementId: 'merged',
        relatedPurchaseId: purchaseId,
        categoryId: 'category',
        tagIds: ['tag'],
      },
    });
  });
  it('importa sem compra ausente e entrega aviso ao chamador', async () => {
    const db = createSupabaseMock({
      responses: { 'card_statements.select': { data: [{ statement_id: 'target' }] } },
    });
    const result = await importCardRefunds(refundContext(db));
    expect(result.imported).toBe(1);
    expect(result.warnings[0]).toContain('importado sem vínculo');
    expect(db.callsTo('save_card_refund', 'rpc')[0].payload).toMatchObject({
      p_input: { relatedPurchaseId: null },
    });
  });
  it('recusa fatura inacessível na preparação, antes da escrita', async () => {
    const db = createSupabaseMock();
    const context = refundContext(db);
    const result = await prepareRefundDestinations(context.db, context.items, context.cards);
    expect(result.error).toContain('não encontrado para este usuário');
    expect(db.callsTo('save_card_refund')).toHaveLength(0);
    expect(db.callsTo('transactions', 'insert')).toHaveLength(0);
  });
});
