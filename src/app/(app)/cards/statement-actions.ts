'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidateFinance } from '@/lib/cache';
import {
  validateStatementChange,
  type StatementChange,
  type StatementPreview,
} from '@/lib/statement-adjustments';
import type { Json } from '@/types/database.types';

export type StatementChangeResult = { error: string | null; preview: StatementPreview | null };

async function runStatementChange(
  change: StatementChange,
  fingerprint: string | null,
): Promise<StatementChangeResult> {
  const invalid = validateStatementChange(change);
  if (invalid) return { error: invalid, preview: null };
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: 'Sessão expirada.', preview: null };
  const { data, error } = await db.rpc('statement_adjustment', {
    p_change: change as unknown as Json,
    p_fingerprint: fingerprint,
  });
  if (error)
    return {
      error:
        error.code === 'P0001'
          ? error.message
          : 'Não foi possível ajustar a fatura. Confira as datas e revise novamente.',
      preview: null,
    };
  if (fingerprint) revalidateFinance();
  return { error: null, preview: data as unknown as StatementPreview };
}

/** Preview with no persisted changes. Example: previewStatementChange(change). */
export async function previewStatementChange(
  change: StatementChange,
): Promise<StatementChangeResult> {
  return runStatementChange(change, null);
}

/** Applies exactly a reviewed proposal, rejecting stale previews. */
export async function applyStatementChange(
  change: StatementChange,
  fingerprint: string,
): Promise<StatementChangeResult> {
  if (!/^[a-f0-9]{32}$/.test(fingerprint))
    return { error: 'Revise a prévia antes de salvar.', preview: null };
  return runStatementChange(change, fingerprint);
}
