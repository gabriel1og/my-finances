import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let supabase: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase.client) }));

const { updateProfile } = await import('@/app/(app)/settings/actions');

const base = {
  displayName: 'Gabriel',
  currency: 'BRL',
  monthlyGoal: 1000,
  monthlySpendingCap: 4000,
};

beforeEach(() => {
  supabase = createSupabaseMock();
});

describe('updateProfile', () => {
  it('exige código ISO de três letras maiúsculas', async () => {
    for (const currency of ['brl', 'R$', 'BRLL', '']) {
      expect((await updateProfile({ ...base, currency })).error).toBe(
        'Moeda inválida (use o código ISO, ex.: BRL).',
      );
    }
  });

  it('aceita metas nulas — as duas são opcionais', async () => {
    const result = await updateProfile({
      ...base,
      monthlyGoal: null,
      monthlySpendingCap: null,
    });

    expect(result.error).toBeNull();
    expect(supabase.firstPayload('profiles', 'update')).toMatchObject({
      monthly_goal: null,
      monthly_spending_cap: null,
    });
  });

  it('recusa metas negativas', async () => {
    expect((await updateProfile({ ...base, monthlyGoal: -1 })).error).toBe(
      'Meta de economia inválida.',
    );
    expect((await updateProfile({ ...base, monthlySpendingCap: -1 })).error).toBe(
      'Teto de gastos inválido.',
    );
  });

  it('guarda nome vazio como null, não como string vazia', async () => {
    await updateProfile({ ...base, displayName: '   ' });

    expect(supabase.firstPayload('profiles', 'update')).toMatchObject({ display_name: null });
  });

  it('atualiza só o perfil da sessão', async () => {
    await updateProfile(base);

    const [call] = supabase.callsTo('profiles', 'update');
    expect(call.filters).toEqual([{ kind: 'eq', column: 'id', value: 'user-1' }]);
  });
});
