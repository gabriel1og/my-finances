import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';

// As actions chamam revalidatePath, que só existe no runtime do Next.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let supabase: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabase.client),
}));

const {
  createTransaction,
  updateTransaction,
  deleteInstallmentGroup,
  createTransfer,
  updateTransfer,
} = await import('@/app/(app)/transactions/actions');

const base = {
  type: 'expense' as const,
  description: 'Mercado',
  amount: 150,
  date: '2026-09-10',
  categoryId: 'cat-1',
  settlement: 'account' as const,
  accountId: 'acc-1',
  cardId: null,
  paymentMethod: 'debit' as const,
};

beforeEach(() => {
  supabase = createSupabaseMock();
});

describe('createTransaction — validação', () => {
  it('recusa descrição vazia e não toca no banco', async () => {
    const result = await createTransaction({ ...base, description: '   ' });

    expect(result.error).toBe('Informe uma descrição.');
    // A validação vem antes do cliente: nenhuma consulta deve ter saído.
    expect(supabase.calls).toHaveLength(0);
  });

  it('recusa valor zero, negativo ou não numérico', async () => {
    for (const amount of [0, -10, Number.NaN]) {
      const result = await createTransaction({ ...base, amount });
      expect(result.error).toBe('Informe um valor maior que zero.');
    }
  });

  it('recusa data fora do formato ISO', async () => {
    expect((await createTransaction({ ...base, date: '10/09/2026' })).error).toBe('Data inválida.');
  });

  it('recusa receita lançada em fatura de cartão', async () => {
    const result = await createTransaction({
      ...base,
      type: 'income',
      settlement: 'card',
      cardId: 'card-1',
    });

    expect(result.error).toBe('Receita não entra em fatura de cartão.');
  });

  it('recusa parcelamento fora do cartão', async () => {
    const result = await createTransaction({ ...base, installments: 3 });
    expect(result.error).toBe('Parcelamento só existe em compra no cartão.');
  });

  it('recusa parcela que ficaria abaixo de um centavo', async () => {
    const result = await createTransaction({
      ...base,
      settlement: 'card',
      cardId: 'card-1',
      accountId: null,
      amount: 0.05,
      installments: 12,
    });

    expect(result.error).toBe('Valor baixo demais para esse número de parcelas.');
  });

  it('recusa sessão expirada', async () => {
    supabase = createSupabaseMock({ user: null });
    expect((await createTransaction(base)).error).toBe('Sessão expirada.');
  });
});

describe('createTransaction — gravação', () => {
  it('grava uma linha só quando é à vista', async () => {
    const result = await createTransaction(base);

    expect(result.error).toBeNull();
    const rows = supabase.firstPayload('transactions') as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      description: 'Mercado',
      amount: 150,
      date: '2026-09-10',
      account_id: 'acc-1',
      card_id: null,
      user_id: 'user-1',
    });
  });

  it('zera a conta quando a compra é no cartão, e vice-versa', async () => {
    await createTransaction({ ...base, settlement: 'card', cardId: 'card-1' });

    const [row] = supabase.firstPayload('transactions') as Array<Record<string, unknown>>;
    // accountId veio preenchido no input: a action precisa anulá-lo, senão a
    // compra apareceria ao mesmo tempo na conta e na fatura.
    expect(row.account_id).toBeNull();
    expect(row.card_id).toBe('card-1');
  });

  it('quebra a compra parcelada em linhas com data e rótulo próprios', async () => {
    await createTransaction({
      ...base,
      settlement: 'card',
      cardId: 'card-1',
      amount: 100,
      installments: 3,
    });

    const rows = supabase.firstPayload('transactions') as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.description)).toEqual([
      'Mercado (1/3)',
      'Mercado (2/3)',
      'Mercado (3/3)',
    ]);
    expect(rows.map((row) => row.date)).toEqual(['2026-09-10', '2026-10-10', '2026-11-10']);
    // O resto de centavos fica na primeira parcela, e a soma fecha.
    expect(rows.reduce((sum, row) => sum + Number(row.amount), 0)).toBeCloseTo(100, 2);
    // Todas as parcelas compartilham o grupo, que é o que permite excluir a
    // compra inteira depois.
    expect(new Set(rows.map((row) => row.installment_group)).size).toBe(1);
  });

  it('aplica as tags a todas as parcelas', async () => {
    supabase = createSupabaseMock({
      responses: {
        'transactions.insert': { data: [{ id: 't1' }, { id: 't2' }], error: null },
      },
    });

    await createTransaction({
      ...base,
      settlement: 'card',
      cardId: 'card-1',
      installments: 2,
      tagIds: ['tag-1'],
    });

    const links = supabase.firstPayload('transaction_tags') as Array<Record<string, unknown>>;
    expect(links).toEqual([
      { transaction_id: 't1', tag_id: 'tag-1', user_id: 'user-1' },
      { transaction_id: 't2', tag_id: 'tag-1', user_id: 'user-1' },
    ]);
  });

  it('devolve a mensagem do banco quando a inserção falha', async () => {
    supabase = createSupabaseMock({
      responses: { 'transactions.insert': { data: null, error: { message: 'violates check' } } },
    });

    expect((await createTransaction(base)).error).toBe('violates check');
  });
});

describe('updateTransaction', () => {
  it('reescreve as tags: limpa antes de inserir', async () => {
    await updateTransaction('t1', { ...base, tagIds: ['tag-2'] });

    const [clear] = supabase.callsTo('transaction_tags', 'delete');
    expect(clear.filters).toContainEqual({ kind: 'eq', column: 'transaction_id', value: 't1' });
    expect(supabase.firstPayload('transaction_tags')).toEqual([
      { transaction_id: 't1', tag_id: 'tag-2', user_id: 'user-1' },
    ]);
  });

  it('não mexe nas tags quando o campo não é enviado', async () => {
    await updateTransaction('t1', base);
    expect(supabase.callsTo('transaction_tags')).toHaveLength(0);
  });
});

describe('deleteInstallmentGroup', () => {
  it('apaga pelo grupo, não pela linha', async () => {
    await deleteInstallmentGroup('grupo-1');

    const [call] = supabase.callsTo('transactions', 'delete');
    expect(call.filters).toEqual([{ kind: 'eq', column: 'installment_group', value: 'grupo-1' }]);
  });
});

describe('createTransfer', () => {
  const transfer = {
    fromAccountId: 'acc-1',
    toAccountId: 'acc-2',
    amount: 200,
    date: '2026-09-10',
    description: '',
  };

  function withAccounts() {
    return createSupabaseMock({
      responses: {
        'accounts.select': {
          data: [
            { id: 'acc-1', name: 'Nubank' },
            { id: 'acc-2', name: 'Itaú' },
          ],
          error: null,
        },
      },
    });
  }

  it('recusa origem igual ao destino', async () => {
    const result = await createTransfer({ ...transfer, toAccountId: 'acc-1' });
    expect(result.error).toBe('Origem e destino precisam ser contas diferentes.');
  });

  it('recusa conta inexistente', async () => {
    supabase = createSupabaseMock({
      responses: { 'accounts.select': { data: [{ id: 'acc-1', name: 'Nubank' }], error: null } },
    });

    expect((await createTransfer(transfer)).error).toBe('Conta não encontrada.');
  });

  it('grava duas pontas com o mesmo grupo, marcadas como transferência', async () => {
    supabase = withAccounts();
    await createTransfer(transfer);

    const rows = supabase.firstPayload('transactions') as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.type)).toEqual(['expense', 'income']);
    expect(rows.map((row) => row.account_id)).toEqual(['acc-1', 'acc-2']);
    expect(rows.every((row) => row.is_transfer === true)).toBe(true);
    expect(rows[0].transfer_group).toBe(rows[1].transfer_group);
    // Sem categoria: transferência não é gasto nem receita de nada.
    expect(rows.every((row) => row.category_id === null)).toBe(true);
  });

  it('descreve pelas contas quando a descrição vem vazia', async () => {
    supabase = withAccounts();
    await createTransfer(transfer);

    const [row] = supabase.firstPayload('transactions') as Array<Record<string, unknown>>;
    expect(row.description).toBe('Transferência Nubank → Itaú');
  });
});

describe('updateTransfer', () => {
  const input = {
    fromAccountId: 'acc-1',
    toAccountId: 'acc-2',
    amount: 300,
    date: '2026-09-12',
    description: 'Reserva',
  };

  it('recusa par incompleto em vez de gravar meia transferência', async () => {
    supabase = createSupabaseMock({
      responses: { 'transactions.select': { data: [{ id: 't1', type: 'expense' }], error: null } },
    });

    expect((await updateTransfer('grupo-1', input)).error).toBe(
      'Transferência incompleta. Exclua e registre de novo.',
    );
    expect(supabase.callsTo('transactions', 'update')).toHaveLength(0);
  });

  it('reescreve cada ponta com a conta certa', async () => {
    supabase = createSupabaseMock({
      responses: {
        'transactions.select': {
          data: [
            { id: 'out-1', type: 'expense' },
            { id: 'in-1', type: 'income' },
          ],
          error: null,
        },
        'accounts.select': {
          data: [
            { id: 'acc-1', name: 'Nubank' },
            { id: 'acc-2', name: 'Itaú' },
          ],
          error: null,
        },
      },
    });

    const result = await updateTransfer('grupo-1', input);
    expect(result.error).toBeNull();

    const updates = supabase.callsTo('transactions', 'update');
    expect(updates).toHaveLength(2);
    expect(updates[0].payload).toMatchObject({ account_id: 'acc-1', amount: 300 });
    expect(updates[0].filters).toContainEqual({ kind: 'eq', column: 'id', value: 'out-1' });
    expect(updates[1].payload).toMatchObject({ account_id: 'acc-2' });
    expect(updates[1].filters).toContainEqual({ kind: 'eq', column: 'id', value: 'in-1' });
  });
});
