'use client';

import { useState, useTransition } from 'react';
import { CATEGORY_PALETTE } from '@/lib/constants';
import { createCard, updateCard } from '@/app/(app)/cards/actions';
import type { Account, CreditCard } from '@/types/database.types';

const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

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
    };

    startTransition(async () => {
      const result = editing ? await updateCard(card!.id, input) : await createCard(input);
      if (result.error) return setError(result.error);
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
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <button
            disabled={!accounts.length}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Novo cartão
          </button>
        )}
      </span>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md animate-fadeUp rounded-lg border border-border bg-surface p-6">
            <h2 className="text-base font-medium">{editing ? 'Editar cartão' : 'Novo cartão'}</h2>

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
                  className="input-base mt-1"
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
                    className="input-base num mt-1"
                    value={closingDay}
                    onChange={(e) => setClosingDay(Number(e.target.value))}
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
                    className="input-base num mt-1"
                    value={dueDay}
                    onChange={(e) => setDueDay(Number(e.target.value))}
                  >
                    {DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-textMuted">
                Compras feitas antes do dia {closingDay} entram na fatura do próprio mês; do dia{' '}
                {closingDay} em diante, na fatura do mês seguinte. Só dias de 1 a 28, para o mesmo
                comportamento em fevereiro.
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
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm text-textSecondary transition-colors hover:text-textPrimary"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={pending}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
