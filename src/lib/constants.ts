export const CATEGORY_PALETTE = [
  '#635bf5',
  '#2ECC9A',
  '#F05C5C',
  '#f5c123',
  '#A78BFA',
  '#38BDF8',
  '#FB7185',
  '#34D399',
  '#ee2222',
  '#FB923C',
  '#fc84d8',
  '#949494',
] as const;

export const BUDGET_ALERT_THRESHOLD = 85;

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', monthAware: true },
  { href: '/transactions', label: 'Transações', monthAware: true },
  { href: '/accounts', label: 'Contas', monthAware: true },
  { href: '/cards', label: 'Cartões', monthAware: true },
  { href: '/recurring', label: 'Fixos', monthAware: true },
  { href: '/categories', label: 'Categorias', monthAware: true },
  { href: '/forecast', label: 'Previsão', monthAware: true },
  { href: '/reports', label: 'Relatórios', monthAware: true },
  { href: '/settings', label: 'Configurações', monthAware: false },
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
