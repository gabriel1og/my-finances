import type { CardStatement, StatementAdjustmentHistory } from '@/types/database.types';

export type StatementOperation = 'due' | 'closing' | 'merge' | 'move' | 'rule';
export type StatementChange = {
  cardId: string;
  operation: StatementOperation;
  month: string;
  reason: string;
  dueDate?: string;
  closingDate?: string;
  targetMonth?: string;
  transactionIds?: string[];
  effectiveMonth?: string;
  closingDay?: number;
  dueDay?: number;
};
export type StatementSnapshotTransaction = {
  id: string;
  statement_id: string;
  date: string;
  description: string;
  amount: number;
  is_card_payment: boolean;
  manual: boolean;
};
export type StatementSnapshot = {
  cycles: CardStatement[];
  transactions: StatementSnapshotTransaction[];
};
export type StatementPreview = {
  fingerprint: string;
  before: StatementSnapshot;
  after: StatementSnapshot;
};
export type StatementHistory = Pick<
  StatementAdjustmentHistory,
  'id' | 'reason' | 'created_at' | 'operation'
>;

/** Stable proposal shared with update_card_with_rule. Example: cardRuleChange(id, month, 20, 5). */
export function cardRuleChange(
  cardId: string,
  month: string,
  closingDay: number,
  dueDay: number,
): StatementChange {
  return {
    cardId,
    month,
    operation: 'rule',
    reason: 'Alteração da regra mensal do cartão',
    effectiveMonth: month,
    closingDay,
    dueDay,
  };
}

/** Real calendar date, not just a matching mask. Example: validStatementDate('2028-02-29'). */
export function validStatementDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Validate the editable contract before the database repeats the financial checks. */
export function validateStatementChange(change: StatementChange): string | null {
  if (!['due', 'closing', 'merge', 'move', 'rule'].includes(change.operation))
    return 'Operação inválida.';
  if (!validStatementDate(change.month) || !change.month.endsWith('-01'))
    return 'Mês da fatura inválido.';
  if (
    typeof change.reason !== 'string' ||
    !change.reason.trim() ||
    change.reason.trim().length > 500
  )
    return 'Informe um motivo de até 500 caracteres.';
  if (['due', 'merge'].includes(change.operation) && !validStatementDate(change.dueDate ?? ''))
    return 'Vencimento inválido.';
  if (
    ['closing', 'merge'].includes(change.operation) &&
    !validStatementDate(change.closingDate ?? '')
  )
    return 'Fechamento inválido.';
  if (
    ['merge', 'move'].includes(change.operation) &&
    (!validStatementDate(change.targetMonth ?? '') || !change.targetMonth?.endsWith('-01'))
  )
    return 'Mês de destino inválido.';
  if (change.operation === 'move' && !change.transactionIds?.length)
    return 'Selecione ao menos um lançamento.';
  return validateStatementRule(change);
}

function validateStatementRule(change: StatementChange): string | null {
  if (change.operation !== 'rule' && !change.effectiveMonth) return null;
  if (!validStatementDate(change.effectiveMonth ?? '') || !change.effectiveMonth?.endsWith('-01'))
    return 'Informe o primeiro ciclo da nova regra.';
  if (
    ![change.closingDay, change.dueDay].every(
      (day) => Number.isInteger(day) && Number(day) >= 1 && Number(day) <= 31,
    )
  )
    return 'Dias devem estar entre 1 e 31.';
  return null;
}

/** Aggregate outstanding commitments by actual due month. Example: statementDueTotals(preview.after). */
export function statementDueTotals(snapshot: StatementSnapshot): Map<string, number> {
  const totals = new Map<string, number>();
  for (const cycle of snapshot.cycles) {
    if (cycle.merged_into) continue;
    const month = cycle.due_date.slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + Math.max(Number(cycle.open_amount), 0));
  }
  return totals;
}

/** Only affected cycles are shown in a review. Example: changedStatementCycles(preview). */
export function changedStatementCycles(preview: StatementPreview): CardStatement[] {
  return preview.after.cycles.filter((cycle) => {
    const before = preview.before.cycles.find(
      (row) => row.statement_month === cycle.statement_month,
    );
    return (
      !before ||
      [
        'period_start',
        'closing_date',
        'due_date',
        'total',
        'paid',
        'open_amount',
        'merged_into',
      ].some((key) => before[key as keyof CardStatement] !== cycle[key as keyof CardStatement])
    );
  });
}
