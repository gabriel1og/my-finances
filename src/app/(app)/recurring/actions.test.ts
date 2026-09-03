import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let supabase: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase.client) }));

const { createRecurring, postRecurring, setRecurringActive } =
  await import('@/app/(app)/recurring/actions');

const base = {
  description: 'Aluguel',
  amount: 2200,
  type: 'expense' as const,
  dayOfMonth: 5,
  categoryId: 'cat-1',
  settlement: 'account' as const,
  accountId: 'acc-1',
  cardId: null,
  paymentMethod: 'transfer' as const,
  startMonth: '2026-09-01',
  endMonth: null,
  tagIds: [],
};

beforeEach(() => {
  supabase = createSupabaseMock({
    responses: { 'recurring_transactions.insert': { data: [{ id: 'rec-1' }] } },
  });
});

describe('createRecurring — validação', () => {
  it('recusa dia fora de 1..31', async () => {
    expect((await createRecurring({ ...base, dayOfMonth: 0 })).error).toBe(
      'Dia do mês deve estar entre 1 e 31.',
    );
    expect((await createRecurring({ ...base, dayOfMonth: 32 })).error).toBe(
      'Dia do mês deve estar entre 1 e 31.',
    );
  });

  it('recusa fim anterior ao início', async () => {
    expect((await createRecurring({ ...base, endMonth: '2026-08-01' })).error).toBe(
      'O fim precisa ser depois do início.',
    );
  });

  it('recusa receita em fatura de cartão', async () => {
    const result = await createRecurring({
      ...base,
      type: 'income',
      settlement: 'card',
      cardId: 'card-1',
    });
    expect(result.error).toBe('Receita não entra em fatura de cartão.');
  });

  it('normaliza os meses para o primeiro dia', async () => {
    await createRecurring({ ...base, startMonth: '2026-09-20', endMonth: '2026-12-15' });

    expect(supabase.firstPayload('recurring_transactions')).toMatchObject({
      start_month: '2026-09-01',
      end_month: '2026-12-01',
    });
  });

  it('força crédito e zera a conta quando o fixo é no cartão', async () => {
    await createRecurring({ ...base, settlement: 'card', cardId: 'card-1' });

    expect(supabase.firstPayload('recurring_transactions')).toMatchObject({
      settlement: 'card',
      card_id: 'card-1',
      account_id: null,
      payment_method: 'credit',
    });
  });
});

describe('postRecurring', () => {
  function withModel(overrides: Record<string, unknown> = {}) {
    return createSupabaseMock({
      responses: {
        'recurring_transactions.select': {
          data: [
            {
              id: 'rec-1',
              type: 'expense',
              description: 'Aluguel',
              amount: 2200,
              day_of_month: 31,
              category_id: 'cat-1',
              settlement: 'account',
              account_id: 'acc-1',
              card_id: null,
              payment_method: 'transfer',
              ...overrides,
            },
          ],
        },
        'transactions.insert': { data: [{ id: 't-1' }] },
      },
    });
  }

  it('lança o modelo no mês pedido, grampeando o dia ao fim do mês curto', async () => {
    supabase = withModel();
    // Dia 31 num mês de 30 dias: precisa virar 30, não transbordar para o mês
    // seguinte — senão o fixo cairia fora do mês em que foi confirmado.
    const result = await postRecurring({ recurringId: 'rec-1', month: '2026-11-01' });

    expect(result.error).toBeNull();
    expect(supabase.firstPayload('transactions')).toMatchObject({
      date: '2026-11-30',
      recurring_id: 'rec-1',
      recurring_month: '2026-11-01',
      amount: 2200,
    });
  });

  it('aceita valor e data ajustados no ato da confirmação', async () => {
    supabase = withModel();
    await postRecurring({
      recurringId: 'rec-1',
      month: '2026-09-01',
      amount: 2350.5,
      date: '2026-09-07',
    });

    expect(supabase.firstPayload('transactions')).toMatchObject({
      amount: 2350.5,
      date: '2026-09-07',
    });
  });

  it('traduz o unique (recurring_id, recurring_month) em aviso, não em erro cru', async () => {
    supabase = createSupabaseMock({
      responses: {
        'recurring_transactions.select': {
          data: [{ id: 'rec-1', amount: 100, day_of_month: 5, type: 'expense' }],
        },
        'transactions.insert': { error: { message: 'duplicate key', code: '23505' } },
      },
    });

    expect((await postRecurring({ recurringId: 'rec-1', month: '2026-09-01' })).error).toBe(
      'Este fixo já foi lançado neste mês.',
    );
  });

  it('recusa modelo inexistente', async () => {
    supabase = createSupabaseMock({ responses: { 'recurring_transactions.select': { data: [] } } });

    expect((await postRecurring({ recurringId: 'rec-x', month: '2026-09-01' })).error).toBe(
      'Modelo não encontrado.',
    );
  });

  it('copia as tags do modelo para o lançamento', async () => {
    supabase = createSupabaseMock({
      responses: {
        'recurring_transactions.select': {
          data: [{ id: 'rec-1', amount: 100, day_of_month: 5, type: 'expense' }],
        },
        'recurring_tags.select': { data: [{ tag_id: 'tag-1' }, { tag_id: 'tag-2' }] },
        'transactions.insert': { data: [{ id: 't-1' }] },
      },
    });

    await postRecurring({ recurringId: 'rec-1', month: '2026-09-01' });

    expect(supabase.firstPayload('transaction_tags')).toEqual([
      { transaction_id: 't-1', tag_id: 'tag-1', user_id: 'user-1' },
      { transaction_id: 't-1', tag_id: 'tag-2', user_id: 'user-1' },
    ]);
  });
});

describe('setRecurringActive', () => {
  it('pausa sem apagar o modelo', async () => {
    supabase = createSupabaseMock();
    await setRecurringActive('rec-1', false);

    expect(supabase.firstPayload('recurring_transactions', 'update')).toMatchObject({
      is_active: false,
    });
    expect(supabase.callsTo('recurring_transactions', 'delete')).toHaveLength(0);
  });
});
