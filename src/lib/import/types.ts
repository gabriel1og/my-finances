import type { PaymentMethod, SettlementKind, TransactionType } from '@/types/database.types';

/** Formatos que o importador reconhece pelo cabeçalho. */
export type ImportFormat = 'flowly' | 'fortuno';

/**
 * O que cada linha do arquivo é de fato. Uma transferência chega como duas
 * linhas (saída e entrada) e precisa ser casada antes de gravar; um pagamento
 * de fatura precisa saber de qual cartão — senão vira despesa comum e conta
 * duas vezes nos KPIs.
 */
export type ImportNature = 'transaction' | 'transfer_out' | 'transfer_in' | 'card_payment';

/** Uma linha do arquivo já traduzida para o vocabulário do flowly. */
export type ParsedRow = {
  /** Linha no arquivo (1 = cabeçalho), para apontar problemas. */
  line: number;
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: number;
  type: TransactionType;
  nature: ImportNature;
  settlement: SettlementKind;
  /** Nome da conta ou do cartão como está no arquivo. */
  origin: string | null;
  category: string | null;
  /** Pagamento de fatura: nome do cartão pago. */
  paidCard: string | null;
  /** Pagamento de fatura: mês da fatura (YYYY-MM). Null = o banco deduz pela data. */
  paidMonth: string | null;
  method: PaymentMethod | null;
  tags: string[];
  notes: string | null;
  warnings: string[];
};

export type SkippedLine = { line: number; reason: string };

export type ParseResult = {
  format: ImportFormat;
  rows: ParsedRow[];
  skipped: SkippedLine[];
};

/** Transferência já casada: as duas pontas viraram uma só. */
export type PlannedTransfer = {
  date: string;
  amount: number;
  description: string;
  from: string;
  to: string;
  lines: [number, number];
};

export type PlanItem =
  | { id: string; kind: 'transaction'; row: ParsedRow }
  | { id: string; kind: 'transfer'; transfer: PlannedTransfer };

export type OriginKind = 'account' | 'card';

/** Conta ou cartão citado no arquivo; a chave junta tipo e nome normalizado. */
export type ImportOrigin = { key: string; name: string; kind: OriginKind; uses: number };

export type ImportCategory = {
  key: string;
  name: string;
  kind: TransactionType;
  uses: number;
  /** Usada como receita e despesa no arquivo — no flowly categoria tem um tipo só. */
  mixed: boolean;
};

export type ImportPlan = {
  items: PlanItem[];
  origins: ImportOrigin[];
  categories: ImportCategory[];
  tags: string[];
  /** Pontas de transferência sem par, já convertidas em lançamento comum. */
  orphanTransfers: number;
};
