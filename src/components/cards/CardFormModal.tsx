'use client';

import { useState, useTransition } from 'react';
import { Modal, ModalTrigger } from '@/components/ui/Modal';
import { CATEGORY_PALETTE } from '@/lib/constants';
import { createCard, updateCard } from '@/app/(app)/cards/actions';
import type { Account, CreditCard } from '@/types/database.types';
import { cardRuleChange, type StatementPreview } from '@/lib/statement-adjustments';
import { previewStatementChange } from '@/app/(app)/cards/statement-actions';
import { StatementAdjustmentReview } from './StatementAdjustmentReview';
import { currentMonth } from '@/lib/format';
import { MonthField } from '@/components/ui/MonthField';

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

export function CardFormModal({
  accounts,
  card,
  trigger,
}: {
  accounts: Account[];
  card?: CreditCard;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(card);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(card?.name ?? '');
  const [accountId, setAccountId] = useState(card?.account_id ?? accounts[0]?.id ?? '');
  const [brand, setBrand] = useState(card?.brand ?? '');
  const [color, setColor] = useState(card?.color ?? '#A78BFA');
  const [creditLimit, setCreditLimit] = useState(
    String(card?.credit_limit ?? '0').replace('.', ','),
  );
  const [closingDay, setClosingDay] = useState(card?.closing_day ?? 1);
  const [dueDay, setDueDay] = useState(card?.due_day ?? 10);
  const [effectiveMonth, setEffectiveMonth] = useState(currentMonth());
  const [rulePreview, setRulePreview] = useState<StatementPreview | null>(null);
  const daysChanged = Boolean(card && (card.closing_day !== closingDay || card.due_day !== dueDay));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const input = {
      name,
      accountId,
      brand: brand || null,
      color,
      creditLimit: Number(creditLimit.replace(',', '.') || '0'),
      closingDay,
      dueDay,
      ...(daysChanged ? { effectiveMonth, ruleFingerprint: rulePreview?.fingerprint } : {}),
    };

    startTransition(async () => {
      if (daysChanged && !rulePreview) {
        const result = await previewStatementChange(
          cardRuleChange(card!.id, effectiveMonth, closingDay, dueDay),
        );
        setRulePreview(result.preview);
        setError(result.error);
        return;
      }
      const result = editing ? await updateCard(card!.id, input) : await createCard(input);
      if (result.error) {
        setRulePreview(null);
        setError(result.error);
        return;
      }
      setRulePreview(null);
      setOpen(false);
      if (!editing) {
        setName('');
        setBrand('');
        setCreditLimit('0');
      }
    });
  }

  return (
    <>
      <ModalTrigger
        trigger={trigger}
        onOpen={() => setOpen(true)}
        fallback={
          <button disabled={!accounts.length} className="btn-primary">
            Novo cartão
          </button>
        }
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar cartão' : 'Novo cartão'}
      >
        <div className="mt-4 space-y-3">
          <div>
            <label className="label-caps">Nome</label>
            <input
              className="input-base mt-1"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nubank, Inter..."
            />
          </div>

          <div>
            <label className="label-caps">Conta que paga a fatura</label>
            <select
              className="select-base mt-1"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps">Dia de fechamento</label>
              <select
                className="select-base num mt-1"
                value={closingDay}
                onChange={(e) => {
                  setClosingDay(Number(e.target.value));
                  setRulePreview(null);
                }}
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-caps">Dia de vencimento</label>
              <select
                className="select-base num mt-1"
                value={dueDay}
                onChange={(e) => {
                  setDueDay(Number(e.target.value));
                  setRulePreview(null);
                }}
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {daysChanged && (
            <div className="space-y-2">
              <div className="text-xs">
                <p>Primeiro ciclo da nova regra</p>
                <MonthField
                  className="mt-1"
                  label="Primeiro ciclo da nova regra"
                  value={effectiveMonth.slice(0, 7)}
                  onChange={(value) => {
                    setEffectiveMonth(`${value}-01`);
                    setRulePreview(null);
                  }}
                />
              </div>
              <p className="text-xs text-textMuted">
                Faturas anteriores serão preservadas. Se o banco reuniu meses na transição, use
                “Ajustar fatura → Reunir faturas” e informe a nova regra nesse ajuste.
              </p>
              {rulePreview && <StatementAdjustmentReview preview={rulePreview} />}
            </div>
          )}
          <p className="text-2xs text-textMuted">
            A regra mensal fecha no dia {closingDay} e vence no dia {dueDay} do mês seguinte.
            Compras no dia do fechamento entram no próximo ciclo. A transição preserva o fim do
            ciclo anterior.
            {closingDay > 28 || dueDay > 28
              ? ' Em meses mais curtos, como fevereiro, vale o último dia do mês.'
              : ''}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps">Limite</label>
              <input
                className="input-base num mt-1"
                inputMode="decimal"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="label-caps">Bandeira</label>
              <input
                className="input-base mt-1"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div>
            <label className="label-caps">Cor</label>
            <div className="mt-2 flex gap-2">
              {CATEGORY_PALETTE.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  aria-label={`Cor ${option}`}
                  className={[
                    'h-6 w-6 rounded-full border-2 transition-colors',
                    color.toLowerCase() === option.toLowerCase()
                      ? 'border-textPrimary'
                      : 'border-transparent',
                  ].join(' ')}
                  style={{ backgroundColor: option }}
                />
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="mt-3 text-xs text-expense">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={submit} disabled={pending} className="btn-primary">
            {pending
              ? 'Calculando...'
              : daysChanged && !rulePreview
                ? 'Revisar nova regra'
                : 'Salvar'}
          </button>
        </div>
      </Modal>
    </>
  );
}
