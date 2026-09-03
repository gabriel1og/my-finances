import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';
import { duplicateKey } from '@/lib/import/plan';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let supabase: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase.client) }));

const { findDuplicates, runImport } = await import('@/app/(app)/settings/import/actions');

beforeEach(() => {
  supabase = createSupabaseMock();
});

describe('findDuplicates', () => {
  it('sem chaves, não consulta o banco', async () => {
    const result = await findDuplicates([]);

    expect(result).toEqual({ error: null, duplicates: [] });
    expect(supabase.calls).toHaveLength(0);
  });

  it('consulta só o intervalo de datas do arquivo', async () => {
    await findDuplicates([
      duplicateKey('2026-09-10', 100, 'Mercado'),
      duplicateKey('2026-07-02', 50, 'Padaria'),
      duplicateKey('2026-08-15', 30, 'Farmácia'),
    ]);

    const [call] = supabase.callsTo('transactions', 'select');
    // Ler o histórico inteiro para conferir 3 linhas seria caro à toa.
    expect(call.filters).toEqual([
      { kind: 'gte', column: 'date', value: '2026-07-02' },
      { kind: 'lte', column: 'date', value: '2026-09-10' },
    ]);
  });

  it('marca como duplicada só a linha que já existe', async () => {
    supabase = createSupabaseMock({
      responses: {
        'transactions.select': {
          data: [
            {
              date: '2026-09-10',
              amount: '100.00',
              description: 'Mercado',
              is_transfer: false,
              type: 'expense',
            },
          ],
        },
      },
    });

    const existing = duplicateKey('2026-09-10', 100, 'Mercado');
    const novel = duplicateKey('2026-09-11', 100, 'Mercado');

    const result = await findDuplicates([existing, novel]);
    expect(result.duplicates).toEqual([existing]);
  });

  it('conta a transferência uma vez só, pela ponta de saída', async () => {
    supabase = createSupabaseMock({
      responses: {
        'transactions.select': {
          data: [
            {
              date: '2026-09-10',
              amount: '500.00',
              description: 'Transferência',
              is_transfer: true,
              type: 'expense',
            },
            {
              date: '2026-09-10',
              amount: '500.00',
              description: 'Transferência',
              is_transfer: true,
              type: 'income',
            },
          ],
        },
      },
    });

    const key = '2026-09-10|500.00|transfer';
    const result = await findDuplicates([key]);

    expect(result.duplicates).toEqual([key]);
  });

  it('propaga erro do banco', async () => {
    supabase = createSupabaseMock({
      responses: { 'transactions.select': { error: { message: 'permission denied' } } },
    });

    expect((await findDuplicates(['2026-09-10|1.00|x'])).error).toBe('permission denied');
  });
});

describe('runImport — validação antes de gravar', () => {
  const payload = {
    origins: {},
    categories: {},
    items: [],
  } as unknown as Parameters<typeof runImport>[0];

  function transaction(row: Record<string, unknown>) {
    return {
      ...payload,
      items: [
        {
          kind: 'transaction',
          row: {
            line: 4,
            date: '2026-09-10',
            amount: 150,
            description: 'Mercado',
            type: 'expense',
            settlement: 'account',
            ...row,
          },
        },
      ],
    } as unknown as Parameters<typeof runImport>[0];
  }

  it('aponta a linha do arquivo, não um erro genérico', async () => {
    // Quem revisa 200 linhas precisa saber qual conserta.
    expect((await runImport(transaction({ date: '10/09/2026' }))).error).toBe(
      'Linha 4: data inválida.',
    );
    expect((await runImport(transaction({ amount: 0 }))).error).toBe('Linha 4: valor inválido.');
    expect((await runImport(transaction({ description: '   ' }))).error).toBe(
      'Linha 4: sem descrição.',
    );
  });

  it('recusa receita em cartão, como no lançamento manual', async () => {
    const result = await runImport(transaction({ type: 'income', settlement: 'card' }));
    expect(result.error).toBe('Linha 4: receita não entra em cartão.');
  });

  it('recusa transferência com origem e destino iguais', async () => {
    const result = await runImport({
      ...payload,
      items: [
        {
          kind: 'transfer',
          transfer: {
            lines: [7],
            date: '2026-09-10',
            from: 'Nubank',
            to: 'nubank ',
            amount: 100,
            description: 'Ajuste',
          },
        },
      ],
    } as unknown as Parameters<typeof runImport>[0]);

    // A comparação é por nome normalizado: "Nubank" e "nubank " são a mesma.
    expect(result.error).toBe('Transferência da linha 7: origem e destino iguais.');
  });

  it('nada é gravado quando a validação falha', async () => {
    await runImport(transaction({ amount: -1 }));
    expect(supabase.calls).toHaveLength(0);
  });

  it('recusa plano vazio — a validação vem antes de qualquer escrita', async () => {
    expect((await runImport(payload)).error).toBe('Nenhuma linha selecionada.');
    expect(supabase.calls).toHaveLength(0);
  });

  it('recusa sessão expirada antes de criar qualquer entidade', async () => {
    supabase = createSupabaseMock({ user: null });
    const result = await runImport(transaction({}));

    expect(result.error).toBe('Sessão expirada.');
    // Nenhuma conta, categoria ou tag criada por um import que não vai rodar.
    expect(supabase.callsTo('accounts', 'insert')).toHaveLength(0);
    expect(supabase.callsTo('categories', 'insert')).toHaveLength(0);
  });
});
