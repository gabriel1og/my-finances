import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let supabase: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase.client) }));

const { createCard, payStatement, deleteCard } = await import('@/app/(app)/cards/actions');

const base = {
  name: 'Nubank',
  accountId: 'acc-1',
  brand: 'Mastercard',
  color: '#5B6EF5',
  creditLimit: 5000,
  closingDay: 28,
  dueDay: 5,
};

beforeEach(() => {
  supabase = createSupabaseMock();
});

describe('createCard — validação', () => {
  it('exige a conta que paga a fatura', async () => {
    expect((await createCard({ ...base, accountId: '' })).error).toBe(
      'Escolha a conta que paga a fatura.',
    );
  });

  it('aceita fechamento e vencimento até o dia 31', async () => {
    expect((await createCard({ ...base, closingDay: 31, dueDay: 31 })).error).toBeNull();
  });

  it('recusa dias fora de 1..31 e dias fracionários', async () => {
    expect((await createCard({ ...base, closingDay: 0 })).error).toBe(
      'Dia de fechamento deve estar entre 1 e 31.',
    );
    expect((await createCard({ ...base, closingDay: 32 })).error).toBe(
      'Dia de fechamento deve estar entre 1 e 31.',
    );
    expect((await createCard({ ...base, dueDay: 10.5 })).error).toBe(
      'Dia de vencimento deve estar entre 1 e 31.',
    );
  });
});

describe('payStatement', () => {
  function withCard() {
    return createSupabaseMock({
      responses: {
        'credit_cards.select': { data: [{ id: 'card-1', name: 'Nubank', account_id: 'acc-1' }] },
      },
    });
  }

  const input = {
    cardId: 'card-1',
    statementMonth: '2026-08-01',
    amount: 1200,
    date: '2026-09-05',
  };

  it('recusa valor não positivo e data inválida', async () => {
    expect((await payStatement({ ...input, amount: 0 })).error).toBe(
      'Informe um valor maior que zero.',
    );
    expect((await payStatement({ ...input, date: '05/09/2026' })).error).toBe('Data inválida.');
  });

  it('recusa cartão inexistente', async () => {
    supabase = createSupabaseMock({ responses: { 'credit_cards.select': { data: [] } } });
    expect((await payStatement(input)).error).toBe('Cartão não encontrado.');
  });

  it('debita na conta do cartão e marca o pagamento como tal', async () => {
    supabase = withCard();
    const result = await payStatement(input);

    expect(result.error).toBeNull();
    expect(supabase.firstPayload('transactions')).toMatchObject({
      type: 'expense',
      amount: 1200,
      date: '2026-09-05',
      account_id: 'acc-1',
      settlement: 'account',
      // As views de KPI excluem is_card_payment: a compra já contou como
      // despesa quando foi feita. Sem esta marca, o gasto contaria duas vezes.
      is_card_payment: true,
      card_payment_for: 'card-1',
      category_id: null,
    });
  });

  it('registra qual fatura foi paga, não o mês do pagamento', async () => {
    supabase = withCard();
    // Fatura de agosto paga em setembro: os dois meses são diferentes de
    // propósito, e é o card_payment_month que amarra o pagamento à fatura.
    await payStatement(input);

    const payload = supabase.firstPayload('transactions') as Record<string, unknown>;
    expect(payload.card_payment_month).toBe('2026-08-01');
    expect(payload.description).toContain('Nubank');
  });
});

describe('deleteCard', () => {
  it('propaga o erro do banco', async () => {
    supabase = createSupabaseMock({
      responses: { 'credit_cards.delete': { error: { message: 'still referenced' } } },
    });

    expect((await deleteCard('card-1')).error).toBe('still referenced');
  });
});
