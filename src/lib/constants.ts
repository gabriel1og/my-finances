export const CATEGORY_PALETTE = [
  '#5B6EF5',
  '#2ECC9A',
  '#F05C5C',
  '#F5A623',
  '#A78BFA',
  '#38BDF8',
  '#FB7185',
  '#34D399',
] as const;

export const BUDGET_ALERT_THRESHOLD = 85;

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/transactions', label: 'Transações' },
  { href: '/accounts', label: 'Contas' },
  { href: '/cards', label: 'Cartões' },
  { href: '/categories', label: 'Categorias' },
  { href: '/reports', label: 'Relatórios' },
  { href: '/settings', label: 'Configurações' },
] as const;

export const ACCOUNT_KIND_LABEL = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Dinheiro',
  investment: 'Investimento',
} as const;

export const PAYMENT_METHOD_LABEL = {
  debit: 'Débito',
  pix: 'Pix',
  cash: 'Dinheiro',
  transfer: 'Transferência',
  boleto: 'Boleto',
  credit: 'Crédito',
} as const;

/** Formas de pagamento que saem direto da conta. */
export const ACCOUNT_METHODS = ['debit', 'pix', 'transfer', 'boleto', 'cash'] as const;
