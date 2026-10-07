import { describe, expect, it } from 'vitest';
import {
  cardRuleChange,
  changedStatementCycles,
  statementDueTotals,
  validStatementDate,
  validateStatementChange,
  type StatementChange,
  type StatementSnapshot,
} from './statement-adjustments';
import type { CardStatement } from '@/types/database.types';

const change: StatementChange = {
  cardId: 'card',
  month: '2026-10-01',
  operation: 'due',
  dueDate: '2026-12-05',
  reason: 'Mudança pelo banco',
};
const cycle = {
  statement_id: 'a',
  statement_month: '2026-10-01',
  due_date: '2026-11-05',
  open_amount: 100,
  total: 120,
  paid: 20,
  merged_into: null,
} as CardStatement;
const snapshot: StatementSnapshot = { cycles: [cycle], transactions: [] };

describe('statement adjustments', () => {
  it('valida datas reais, incluindo fevereiro e ano bissexto', () => {
    expect(validStatementDate('2028-02-29')).toBe(true);
    expect(validStatementDate('2026-02-29')).toBe(false);
    expect(validStatementDate('2026-04-31')).toBe(false);
    expect(validStatementDate('2026-12-31')).toBe(true);
    expect(validStatementDate('2026-13-01')).toBe(false);
  });
  it('exige mês, motivo, seleção e datas conforme a operação', () => {
    expect(validateStatementChange(change)).toBeNull();
    expect(validateStatementChange({ ...change, month: '2026-10-12' })).toContain('Mês');
    expect(validateStatementChange({ ...change, reason: ' ' })).toContain('motivo');
    expect(validateStatementChange({ ...change, dueDate: '2026-11-31' })).toContain('Vencimento');
    expect(validateStatementChange({ ...change, operation: 'closing' })).toContain('Fechamento');
    expect(
      validateStatementChange({ ...change, operation: 'merge', closingDate: '2026-11-20' }),
    ).toContain('destino');
    expect(
      validateStatementChange({ ...change, operation: 'move', targetMonth: '2026-12-01' }),
    ).toContain('lançamento');
  });
  it('usa uma proposta estável para a nova regra e valida os dias', () => {
    const proposal = cardRuleChange('card', '2027-01-01', 20, 5);
    expect(proposal.month).toBe(proposal.effectiveMonth);
    expect(validateStatementChange(proposal)).toBeNull();
    expect(validateStatementChange({ ...proposal, dueDay: 32 })).toContain('Dias');
    expect(validateStatementChange({ ...proposal, effectiveMonth: undefined })).toContain(
      'primeiro ciclo',
    );
  });
  it('agrupa saldo pelo vencimento e mantém créditos fora dos compromissos', () => {
    const totals = statementDueTotals({
      transactions: [],
      cycles: [
        cycle,
        { ...cycle, open_amount: -20 },
        { ...cycle, open_amount: 900, merged_into: 'a' },
        { ...cycle, open_amount: 50, due_date: '2027-01-05' },
      ],
    });
    expect([...totals]).toEqual([
      ['2026-11', 100],
      ['2027-01', 50],
    ]);
  });
  it('revisão mostra só os ciclos afetados, incluindo alterações de pagamento', () => {
    const updated = { ...cycle, paid: 50, open_amount: 70 };
    expect(
      changedStatementCycles({
        fingerprint: '',
        before: snapshot,
        after: { transactions: [], cycles: [updated] },
      }),
    ).toEqual([updated]);
    expect(changedStatementCycles({ fingerprint: '', before: snapshot, after: snapshot })).toEqual(
      [],
    );
  });
});
