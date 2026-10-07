'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { DateField } from '@/components/ui/DateField';
import { MonthField } from '@/components/ui/MonthField';
import { StatementAdjustmentReview } from './StatementAdjustmentReview';
import { previewStatementChange, applyStatementChange } from '@/app/(app)/cards/statement-actions';
import { monthSequence } from '@/lib/forecast';
import { formatDate } from '@/lib/format';
import type {
  StatementChange,
  StatementOperation,
  StatementPreview,
} from '@/lib/statement-adjustments';
import type { CardStatement, CreditCard, TransactionWithCategory } from '@/types/database.types';

const OPERATIONS = [
  ['due', 'Alterar vencimento'],
  ['closing', 'Alterar fechamento'],
  ['merge', 'Reunir faturas'],
  ['move', 'Mover lançamentos'],
] as const;

export function StatementAdjustmentModal({
  card,
  statement,
  transactions,
}: {
  card: CreditCard;
  statement: CardStatement;
  transactions: TransactionWithCategory[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [operation, setOperation] = useState<StatementOperation>('due');
  const [dueDate, setDueDate] = useState(statement.due_date);
  const [closingDate, setClosingDate] = useState(statement.closing_date);
  const [targetMonth, setTargetMonth] = useState(monthSequence(statement.statement_month, 2)[1]);
  const [transactionIds, setTransactionIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [applyRule, setApplyRule] = useState(false);
  const [closingDay, setClosingDay] = useState(card.closing_day);
  const [dueDay, setDueDay] = useState(card.due_day);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(): StatementChange {
    return {
      cardId: card.id,
      month: statement.statement_month,
      operation,
      reason,
      ...(['due', 'merge'].includes(operation) ? { dueDate } : {}),
      ...(['closing', 'merge'].includes(operation) ? { closingDate } : {}),
      ...(['merge', 'move'].includes(operation) ? { targetMonth } : {}),
      ...(operation === 'move' ? { transactionIds } : {}),
      ...(applyRule && operation === 'merge'
        ? { closingDay, dueDay, effectiveMonth: monthSequence(targetMonth, 2)[1] }
        : {}),
    };
  }

  function review() {
    setError(null);
    startTransition(async () => {
      const result = await previewStatementChange(change());
      setPreview(result.preview);
      setError(result.error);
    });
  }

  function save() {
    if (!preview) return;
    setError(null);
    startTransition(async () => {
      const result = await applyStatementChange(change(), preview.fingerprint);
      if (result.error) {
        setError(result.error);
        setPreview(null);
        return;
      }
      setOpen(false);
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="btn-secondary btn-sm"
        onClick={() => {
          setPreview(null);
          setError(null);
          setOpen(true);
        }}
      >
        Ajustar fatura
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ajustar fatura">
        <fieldset disabled={pending} className="mt-4 space-y-3" onChange={() => setPreview(null)}>
          <label className="block text-xs">
            Tipo de ajuste
            <select
              className="input-base mt-1"
              value={operation}
              onChange={(event) => setOperation(event.target.value as StatementOperation)}
            >
              {OPERATIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {['merge', 'move'].includes(operation) && (
            <div className="text-xs">
              <p>Mês de destino</p>
              <MonthField
                className="mt-1"
                label="Mês de destino"
                value={targetMonth.slice(0, 7)}
                onChange={(value) => {
                  setTargetMonth(`${value}-01`);
                  setPreview(null);
                }}
              />
            </div>
          )}
          {['closing', 'merge'].includes(operation) && (
            <div className="text-xs">
              <p>Novo fechamento (dia em que começa o próximo ciclo)</p>
              <DateField
                className="mt-1"
                label="Novo fechamento"
                value={closingDate}
                onChange={(value) => {
                  setClosingDate(value);
                  setPreview(null);
                }}
              />
            </div>
          )}
          {['due', 'merge'].includes(operation) && (
            <div className="text-xs">
              <p>Novo vencimento</p>
              <DateField
                className="mt-1"
                label="Novo vencimento"
                value={dueDate}
                onChange={(value) => {
                  setDueDate(value);
                  setPreview(null);
                }}
              />
            </div>
          )}
          {operation === 'merge' && (
            <>
              <p className="text-xs text-textMuted">
                Todos os ciclos entre esta fatura e o destino serão reunidos, incluindo seus
                pagamentos. Informe as datas confirmadas pelo banco.
              </p>
              <label className="flex gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={applyRule}
                  onChange={(event) => setApplyRule(event.target.checked)}
                />
                Aplicar nova regra mensal após a fatura reunida
              </label>
              {applyRule && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs">
                    Novo dia de fechamento
                    <input
                      className="input-base mt-1"
                      type="number"
                      min="1"
                      max="31"
                      value={closingDay}
                      onChange={(event) => setClosingDay(Number(event.target.value))}
                    />
                  </label>
                  <label className="text-xs">
                    Novo dia de vencimento
                    <input
                      className="input-base mt-1"
                      type="number"
                      min="1"
                      max="31"
                      value={dueDay}
                      onChange={(event) => setDueDay(Number(event.target.value))}
                    />
                  </label>
                </div>
              )}
            </>
          )}
          {operation === 'move' && (
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {transactions.map((tx) => (
                <label key={tx.id} className="flex gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={transactionIds.includes(tx.id)}
                    onChange={(event) =>
                      setTransactionIds((ids) =>
                        event.target.checked ? [...ids, tx.id] : ids.filter((id) => id !== tx.id),
                      )
                    }
                  />
                  {tx.description} · {formatDate(tx.date)}
                </label>
              ))}
              <p className="text-xs text-textMuted">
                A seleção move apenas estas compras ou parcelas. Pagamentos permanecem na fatura
                original.
              </p>
            </div>
          )}
          <label className="block text-xs">
            Motivo do ajuste
            <textarea
              className="input-base mt-1"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </fieldset>
        {preview && <StatementAdjustmentReview preview={preview} />}
        {error && (
          <p role="alert" className="mt-3 text-xs text-expense">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button disabled={pending} className="btn-secondary" onClick={() => setOpen(false)}>
            Cancelar
          </button>
          <button disabled={pending} className="btn-primary" onClick={preview ? save : review}>
            {pending ? 'Calculando...' : preview ? 'Confirmar ajuste' : 'Revisar ajuste'}
          </button>
        </div>
      </Modal>
    </>
  );
}
