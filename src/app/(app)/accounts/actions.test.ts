import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let supabase: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase.client) }));

const { createAccount, archiveAccount, deleteAccount, getAccountBalanceHistory } =
  await import('@/app/(app)/accounts/actions');

const base = {
  name: 'Nubank',
  kind: 'checking' as const,
  institution: 'Nu',
  color: '#5B6EF5',
  openingBalance: 1000,
};

beforeEach(() => {
  supabase = createSupabaseMock();
});

describe('createAccount', () => {
  it('aceita saldo inicial negativo — conta pode nascer no vermelho', async () => {
    expect((await createAccount({ ...base, openingBalance: -250 })).error).toBeNull();
  });

  it('recusa saldo não numérico', async () => {
    expect((await createAccount({ ...base, openingBalance: Number.NaN })).error).toBe(
      'Saldo inicial inválido.',
    );
  });

  it('grava o nome sem espaços nas pontas', async () => {
    await createAccount({ ...base, name: '  Itaú  ' });
    expect(supabase.firstPayload('accounts')).toMatchObject({ name: 'Itaú' });
  });
});

describe('deleteAccount — guardas antes de apagar', () => {
  it('recusa conta com lançamentos e sugere arquivar', async () => {
    supabase = createSupabaseMock({
      responses: { 'transactions.select': { count: 12 } },
    });

    expect((await deleteAccount('acc-1')).error).toBe(
      'Conta com 12 lançamento(s). Arquive-a em vez de excluir.',
    );
    expect(supabase.callsTo('accounts', 'delete')).toHaveLength(0);
  });

  it('recusa conta com cartão vinculado', async () => {
    supabase = createSupabaseMock({
      responses: { 'transactions.select': { count: 0 }, 'credit_cards.select': { count: 1 } },
    });

    expect((await deleteAccount('acc-1')).error).toBe('Existe cartão vinculado a esta conta.');
    expect(supabase.callsTo('accounts', 'delete')).toHaveLength(0);
  });

  it('apaga quando não há histórico nem cartão', async () => {
    supabase = createSupabaseMock({
      responses: { 'transactions.select': { count: 0 }, 'credit_cards.select': { count: 0 } },
    });

    expect((await deleteAccount('acc-1')).error).toBeNull();
    expect(supabase.callsTo('accounts', 'delete')).toHaveLength(1);
  });
});

describe('archiveAccount', () => {
  it('marca como arquivada em vez de excluir', async () => {
    await archiveAccount('acc-1');

    expect(supabase.firstPayload('accounts', 'update')).toMatchObject({ is_archived: true });
    expect(supabase.callsTo('accounts', 'delete')).toHaveLength(0);
  });
});

describe('getAccountBalanceHistory', () => {
  it('busca a conta em ordem decrescente e usa cursor na página seguinte', async () => {
    supabase = createSupabaseMock({
      responses: {
        'account_balance_history.select': {
          data: [{ sequence_no: 29, balance: 150, delta: 50 }],
        },
      },
    });

    const result = await getAccountBalanceHistory('acc-1', 30);
    const call = supabase.callsTo('account_balance_history', 'select')[0];

    expect(result.entries).toHaveLength(1);
    expect(call.filters).toContainEqual({ kind: 'eq', column: 'account_id', value: 'acc-1' });
    expect(call.filters).toContainEqual({ kind: 'lt', column: 'sequence_no', value: 30 });
  });

  it('não expõe a mensagem técnica quando a consulta falha', async () => {
    supabase = createSupabaseMock({
      responses: {
        'account_balance_history.select': {
          error: { code: '42P01', message: 'relation does not exist' },
        },
      },
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await getAccountBalanceHistory('acc-1');

    expect(result.error).toBe('Não foi possível carregar o histórico agora.');
    expect(result.error).not.toContain('relation');
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('account_balance_history_load_failed'),
    );
    log.mockRestore();
  });
});
