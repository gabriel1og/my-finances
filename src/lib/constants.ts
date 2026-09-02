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

/**
 * Rotas do app com o que o cabeçalho precisa saber sobre cada uma.
 *
 * `title` e `subtitle` são a fonte única do cabeçalho global — antes cada
 * página repetia os dois no corpo, e o mesmo texto vivia em dois lugares.
 * `label` é o nome curto do menu; `section` divide o menu como na navegação
 * de referência (Menu / Suporte).
 */
export const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    title: 'Dashboard',
    subtitle: 'Visão geral do mês',
    section: 'menu',
    monthAware: true,
  },
  {
    href: '/transactions',
    label: 'Transações',
    title: 'Transações',
    subtitle: 'Lançamentos do mês selecionado',
    section: 'menu',
    monthAware: true,
  },
  {
    href: '/accounts',
    label: 'Contas',
    title: 'Contas bancárias',
    subtitle: 'Saldo atual e faturas vinculadas',
    section: 'menu',
    monthAware: true,
  },
  {
    href: '/cards',
    label: 'Cartões',
    title: 'Cartões de crédito',
    subtitle: 'Faturas do mês selecionado',
    section: 'menu',
    monthAware: true,
  },
  {
    href: '/recurring',
    label: 'Fixos',
    title: 'Lançamentos fixos',
    subtitle: 'Modelos que você confirma a cada mês — nada é lançado sozinho',
    section: 'menu',
    monthAware: true,
  },
  {
    href: '/categories',
    label: 'Categorias',
    title: 'Categorias',
    subtitle: 'Limites e consumo do mês',
    section: 'menu',
    monthAware: true,
  },
  {
    href: '/forecast',
    label: 'Previsão',
    title: 'Previsão',
    subtitle: 'O que já está comprometido nos próximos meses',
    section: 'menu',
    monthAware: true,
  },
  {
    href: '/reports',
    label: 'Relatórios',
    title: 'Relatórios',
    subtitle: 'Comparativos e evolução do período',
    section: 'menu',
    monthAware: true,
  },
  {
    href: '/settings',
    label: 'Configurações',
    title: 'Configurações',
    subtitle: 'Metas e preferências',
    section: 'support',
    monthAware: false,
  },
] as const;

export const NAV_SECTIONS = [
  { key: 'menu', label: 'Menu' },
  { key: 'support', label: 'Suporte' },
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
