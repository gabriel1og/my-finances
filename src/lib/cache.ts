import { revalidatePath } from 'next/cache';

/**
 * Toda rota autenticada que lê dado financeiro.
 *
 * Antes cada arquivo de actions tinha o seu `revalidateAll()` com uma lista
 * própria — seis listas diferentes, e nenhuma delas citava `/forecast`. O
 * efeito era uma compra parcelada não aparecer na Previsão até o cache expirar
 * sozinho. Uma lista só, num lugar só, é o que fecha essa classe de bug.
 *
 * A lista é escrita à mão de propósito: derivá-la de NAV_ITEMS acoplaria a
 * invalidação de cache à configuração do menu, e mexer no menu passaria a
 * mexer no cache sem querer. Quem garante que ela não fica para trás é o
 * teste em `cache.test.ts`, que falha se uma rota nova do menu não estiver
 * aqui.
 */
export const FINANCE_ROUTES = [
  '/dashboard',
  '/transactions',
  '/accounts',
  '/cards',
  '/recurring',
  '/categories',
  '/forecast',
  '/reports',
  '/settings',
  '/settings/import',
  '/cards/[id]',
] as const;

/**
 * Invalida o cache de todas as rotas financeiras.
 *
 * Revalidar a lista inteira quando talvez só uma rota mudou desperdiça algum
 * trabalho de servidor. Num app de um usuário isso é irrelevante perto do custo
 * de mostrar número errado. Se um dia pesar, a saída é `revalidateTag` com
 * tags por entidade — não voltar a manter listas parciais na mão.
 */
export function revalidateFinance() {
  for (const path of FINANCE_ROUTES) {
    // Rota dinâmica precisa do segundo argumento: sem ele o Next trata
    // "/cards/[id]" como um caminho literal e nenhuma fatura é invalidada.
    if (path.includes('[')) revalidatePath(path, 'page');
    else revalidatePath(path);
  }
}
