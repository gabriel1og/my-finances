/**
 * O que pode ser exportado, num lugar só: o painel de Configurações lista, o
 * route handler valida a URL contra esta lista.
 */
export const EXPORT_ENTITIES = [
  {
    key: 'transactions',
    label: 'Transações',
    description: 'Todo o histórico, com natureza, origem, forma e tags',
  },
  { key: 'categories', label: 'Categorias', description: 'Nome, tipo, limite, cor e rollover' },
  { key: 'accounts', label: 'Contas', description: 'Tipo, instituição e saldo inicial' },
  {
    key: 'cards',
    label: 'Cartões',
    description: 'Conta da fatura, limite, fechamento e vencimento',
  },
  {
    key: 'recurring',
    label: 'Lançamentos fixos',
    description: 'Modelos com dia, valor, categoria e origem',
  },
  { key: 'tags', label: 'Tags', description: 'Nome e cor' },
] as const;

export type ExportEntity = (typeof EXPORT_ENTITIES)[number]['key'];

export function isExportEntity(value: string): value is ExportEntity {
  return EXPORT_ENTITIES.some((entity) => entity.key === value);
}
