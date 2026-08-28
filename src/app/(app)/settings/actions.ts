'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ProfileInput = {
  displayName: string;
  currency: string;
  monthlyGoal: number | null;
};

export async function updateProfile(input: ProfileInput): Promise<{ error: string | null }> {
  if (input.displayName.length > 60) return { error: 'Nome muito longo (máx. 60).' };
  if (!/^[A-Z]{3}$/.test(input.currency)) return { error: 'Moeda inválida (use o código ISO, ex.: BRL).' };
  if (input.monthlyGoal !== null && (!Number.isFinite(input.monthlyGoal) || input.monthlyGoal < 0)) {
    return { error: 'Meta inválida.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: input.displayName.trim() || null,
      currency: input.currency,
      monthly_goal: input.monthlyGoal,
    })
    .eq('id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { error: null };
}
