import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let supabase: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase.client) }));

const {
  createCategory,
  updateCategory,
  setCategoryRollover,
  setMonthlyBudget,
  clearMonthlyBudget,
  deleteCategory,
} = await import('@/app/(app)/categories/actions');

const base = { name: 'Mercado', color: '#5B6EF5', kind: 'expense' as const, budget: 800 };

beforeEach(() => {
  supabase = createSupabaseMock();
});

describe('validação', () => {
  it('exige nome', async () => {
    expect((await createCategory({ ...base, name: '  ' })).error).toBe('Informe um nome.');
  });

  it('exige cor em hexadecimal de 6 dígitos', async () => {
    for (const color of ['azul', '#FFF', '#5B6EF', 'rgb(0,0,0)']) {
      expect((await createCategory({ ...base, color })).error).toBe('Cor inválida.');
    }
    expect((await createCategory({ ...base, color: '#a1b2c3' })).error).toBeNull();
  });

  it('aceita limite zero mas recusa negativo', async () => {
    expect((await createCategory({ ...base, budget: 0 })).error).toBeNull();
    expect((await createCategory({ ...base, budget: -1 })).error).toBe('Limite inválido.');
  });
});

describe('createCategory', () => {
  it('coloca a nova categoria no fim da ordem', async () => {
    supabase = createSupabaseMock({
      responses: { 'categories.select': { data: [{ position: 7 }] } },
    });

    await createCategory(base);
    expect(supabase.firstPayload('categories')).toMatchObject({ position: 8, name: 'Mercado' });
  });

  it('começa em 1 quando ainda não há categoria', async () => {
    await createCategory(base);
    expect(supabase.firstPayload('categories')).toMatchObject({ position: 1 });
  });

  it('traduz violação de unicidade em mensagem legível', async () => {
    supabase = createSupabaseMock({
      responses: {
        'categories.insert': { error: { message: 'duplicate key', code: '23505' } },
      },
    });

    expect((await createCategory(base)).error).toBe('Já existe uma categoria com esse nome.');
  });
});

describe('setCategoryRollover', () => {
  it('ao ligar, ancora o acúmulo no primeiro dia do mês informado', async () => {
    await setCategoryRollover('cat-1', true, '2026-09-15');

    expect(supabase.firstPayload('categories', 'update')).toEqual({
      rollover_enabled: true,
      rollover_since: '2026-09-01',
    });
  });

  it('ao desligar, limpa a data — a constraint exige os dois coerentes', async () => {
    await setCategoryRollover('cat-1', false, '2026-09-15');

    expect(supabase.firstPayload('categories', 'update')).toEqual({
      rollover_enabled: false,
      rollover_since: null,
    });
  });
});

describe('orçamento do mês', () => {
  it('grava por (usuário, categoria, mês), normalizando o mês', async () => {
    await setMonthlyBudget('cat-1', '2026-09-20', 500);

    const [call] = supabase.callsTo('budgets', 'upsert');
    expect(call.payload).toMatchObject({ category_id: 'cat-1', month: '2026-09-01', amount: 500 });
    expect(call.onConflict).toBe('user_id,category_id,month');
  });

  it('recusa limite negativo antes de tocar no banco', async () => {
    expect((await setMonthlyBudget('cat-1', '2026-09-01', -5)).error).toBe('Limite inválido.');
    expect(supabase.calls).toHaveLength(0);
  });

  it('limpar remove só o mês pedido', async () => {
    await clearMonthlyBudget('cat-1', '2026-09-20');

    const [call] = supabase.callsTo('budgets', 'delete');
    expect(call.filters).toEqual([
      { kind: 'eq', column: 'category_id', value: 'cat-1' },
      { kind: 'eq', column: 'month', value: '2026-09-01' },
    ]);
  });
});

describe('updateCategory e deleteCategory', () => {
  it('atualiza pelo id', async () => {
    await updateCategory('cat-1', base);
    const [call] = supabase.callsTo('categories', 'update');
    expect(call.filters).toContainEqual({ kind: 'eq', column: 'id', value: 'cat-1' });
  });

  it('propaga o erro do banco em vez de fingir sucesso', async () => {
    supabase = createSupabaseMock({
      responses: { 'categories.delete': { error: { message: 'foreign key violation' } } },
    });

    expect((await deleteCategory('cat-1')).error).toBe('foreign key violation');
  });
});
