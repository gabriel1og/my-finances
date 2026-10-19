import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
let db: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db.client) }));
const { createTransaction, updateTransaction } = await import('./actions');
const refund = {
  type: 'income' as const,
  settlement: 'card' as const,
  description: 'Estorno loja',
  amount: 150,
  date: '2026-10-19',
  categoryId: 'category',
  accountId: null,
  cardId: 'card',
  paymentMethod: 'credit' as const,
  statementId: 'statement',
  relatedPurchaseId: 'purchase',
  tagIds: ['tag'],
};
beforeEach(() => {
  db = createSupabaseMock();
});
describe('cadastro de estorno', () => {
  it('grava estorno e tags por uma operação atômica', async () => {
    expect((await createTransaction(refund)).error).toBeNull();
    expect(db.callsTo('save_card_refund', 'rpc')[0]?.payload).toMatchObject({
      p_id: null,
      p_input: { statementId: 'statement', relatedPurchaseId: 'purchase', tagIds: ['tag'] },
    });
    expect(db.callsTo('transactions', 'insert')).toHaveLength(0);
  });
  it('exige fatura e não permite parcelamento', async () => {
    expect((await createTransaction({ ...refund, statementId: null })).error).toBe(
      'Escolha a fatura do estorno.',
    );
    expect((await createTransaction({ ...refund, installments: 2 })).error).toBe(
      'Estorno não pode ser parcelado.',
    );
    expect(db.calls).toHaveLength(0);
  });
  it('edita pelo mesmo contrato e propaga falha sem outra escrita', async () => {
    db = createSupabaseMock({
      responses: { 'save_card_refund.rpc': { error: { message: 'Fatura incompatível.' } } },
    });
    expect((await updateTransaction('refund', refund)).error).toBe('Fatura incompatível.');
    expect(db.callsTo('save_card_refund', 'rpc')[0]?.payload).toMatchObject({ p_id: 'refund' });
    expect(db.callsTo('transaction_tags')).toHaveLength(0);
  });
});
