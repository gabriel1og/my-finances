import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';
import type { StatementChange } from '@/lib/statement-adjustments';

let fake: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fake.client }));
vi.mock('@/lib/cache', () => ({ revalidateFinance: vi.fn() }));
const { previewStatementChange, applyStatementChange } = await import('./statement-actions');
const { updateCard } = await import('./actions');
const { revalidateFinance } = await import('@/lib/cache');
const change: StatementChange = {
  cardId: 'card',
  month: '2026-10-01',
  operation: 'due',
  dueDate: '2026-12-05',
  reason: 'Banco adiou',
};
const fingerprint = 'a'.repeat(32);

beforeEach(() => {
  vi.clearAllMocks();
  fake = createSupabaseMock();
});
describe('reviewed statement changes', () => {
  it('salva cadastro e regra por uma única operação com vigência e revisão', async () => {
    const input = {
      name: 'Cartão',
      accountId: 'account',
      brand: null,
      color: '#A78BFA',
      creditLimit: 1000,
      closingDay: 25,
      dueDay: 5,
      effectiveMonth: '2026-11-01',
      ruleFingerprint: fingerprint,
    };
    expect((await updateCard('card', input)).error).toBeNull();
    expect(fake.firstPayload('update_card_with_rule', 'rpc')).toEqual({
      p_card: 'card',
      p_input: input,
      p_effective_month: '2026-11-01',
      p_fingerprint: fingerprint,
    });
    expect(fake.callsTo('credit_cards', 'update')).toHaveLength(0);
    fake = createSupabaseMock({ user: null });
    expect((await updateCard('card', input)).error).toBe('Sessão expirada.');
    expect(fake.calls).toHaveLength(0);
  });
  it('validação e sessão expirada impedem chamar a operação financeira', async () => {
    expect((await previewStatementChange({ ...change, dueDate: '2026-11-31' })).error).toBe(
      'Vencimento inválido.',
    );
    expect(fake.calls).toHaveLength(0);
    fake = createSupabaseMock({ user: null });
    expect((await previewStatementChange(change)).error).toBe('Sessão expirada.');
    expect(fake.calls).toHaveLength(0);
  });
  it('prévia não invalida cache; salvar exige o fingerprint revisado', async () => {
    await previewStatementChange(change);
    expect(fake.firstPayload('statement_adjustment', 'rpc')).toEqual({
      p_change: change,
      p_fingerprint: null,
    });
    expect(revalidateFinance).not.toHaveBeenCalled();
    await applyStatementChange(change, fingerprint);
    expect(fake.callsTo('statement_adjustment')[1].payload).toEqual({
      p_change: change,
      p_fingerprint: fingerprint,
    });
    expect(revalidateFinance).toHaveBeenCalledOnce();
  });
  it('rejeita uma confirmação sem prévia e preserva erro de concorrência', async () => {
    expect((await applyStatementChange(change, '')).error).toContain('prévia');
    expect(fake.calls).toHaveLength(0);
    fake = createSupabaseMock({
      responses: {
        'statement_adjustment.rpc': {
          error: { code: 'P0001', message: 'A fatura mudou desde a prévia.' },
        },
      },
    });
    expect((await applyStatementChange(change, fingerprint)).error).toContain('mudou');
    expect(revalidateFinance).not.toHaveBeenCalled();
  });
});
