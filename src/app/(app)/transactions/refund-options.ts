'use server';

import { createClient } from '@/lib/supabase/server';
import { getCardStatement } from '@/lib/queries';

/** Resolve a identidade persistida do destino. Ex.: resolveRefundStatement(card, '2026-10'). */
export async function resolveRefundStatement(cardId: string, month: string, statementId?: string) {
  try {
    const db = await createClient();
    const result = statementId
      ? await db
          .from('card_statements')
          .select('*')
          .eq('card_id', cardId)
          .eq('statement_id', statementId)
          .maybeSingle()
      : { data: await getCardStatement(cardId, month), error: null };
    if (result.error) throw result.error;
    if (!result.data) return { statement: null, error: 'Fatura não encontrada.' };
    if (result.data.merged_into) {
      const target = await db
        .from('card_statements')
        .select('*')
        .eq('statement_id', result.data.merged_into)
        .single();
      if (target.error) throw target.error;
      return { statement: target.data, error: null };
    }
    return { statement: result.data, error: null };
  } catch {
    return { statement: null, error: 'Não foi possível carregar a fatura. Tente novamente.' };
  }
}

/** Busca limitada pelo banco. Ex.: findRefundPurchases(card, 'loja', 0). */
export async function findRefundPurchases(cardId: string, search: string, page = 0) {
  const db = await createClient();
  const { data, error } = await db.rpc('search_card_purchases', {
    p_card: cardId,
    p_search: search.slice(0, 120),
    p_offset: Math.max(0, page) * 20,
  });
  return { purchases: data ?? [], error: error ? 'Não foi possível buscar as compras.' : null };
}

/** Recupera o rótulo da referência na edição, mesmo fora da página da busca. */
export async function getRefundPurchaseReference(id: string) {
  const db = await createClient();
  const { data, error } = await db
    .from('transactions')
    .select('id,description,date,amount')
    .eq('id', id)
    .maybeSingle();
  return {
    purchase: data,
    error: error ? 'Não foi possível carregar a compra relacionada.' : null,
  };
}
