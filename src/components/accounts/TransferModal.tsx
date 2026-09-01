'use client';

import { useState, useTransition } from 'react';
import { createTransfer, updateTransfer } from '@/app/(app)/transactions/actions';
import type { Account } from '@/types/database.types';

/** Valores de uma transferência existente, para o modo edição. */
export type TransferDraft = {
  group: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  description: string;
};

export function TransferModal({
  accounts,
  transfer,
  trigger,
}: {
  accounts: Account[];
  transfer?: TransferDraft;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(transfer);
  const [open, setOpen] = useState(false);
  const [fromAccountId, setFromAccountId] = useState(
    transfer?.fromAccountId ?? accounts[0]?.id ?? '',
  );
  const [toAccountId, setToAccountId] = useState(transfer?.toAccountId ?? accounts[1]?.id ?? '');
  const [amount, setAmount] = useState(
    transfer ? String(transfer.amount).replace('.', ',') : '',
  );
  const [date, setDate] = useState(
    transfer?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState(transfer?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const input = {
      fromAccountId,
      toAccountId,
      amount: Number(amount.replace(',', '.')),
      date,
      description,
    };

    startTransition(async () => {
      const result = editing
        ? await updateTransfer(transfer!.group, input)
        : await createTransfer(input);

      if (result.error) return setError(result.error);
      if (!editing) {
        setAmount('');
        setDescription('');
      }
      setOpen(false);
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <button
            disabled={accounts.length < 2}
            title={accounts.length < 2 ? 'Cadastre ao menos duas contas' : undefined}
            className="rounded-md border border-border px-4 py-2 text-sm text-textSecondary transition-colors hover:border-borderHover hover:text-textPrimary disabled:opacity-40"
          >
            Transferir
          </button>
        )}
      </span>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md animate-fadeUp rounded-lg border border-border bg-surface p-6">
            <h2 className="text-base font-medium">
              {editing ? 'Editar transferência' : 'Transferência entre contas'}
            </h2>
            <p className="mt-1 text-xs text-textSecondary">
              Move saldo de uma conta para outra. Não conta como receita nem despesa.
            </p>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-caps">De</label>
                  <select
                    className="input-base mt-1"
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-caps">Para</label>
                  <select
                    className="input-base mt-1"
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-caps">Valor</label>
                  <input
                    className="input-base num mt-1"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="label-caps">Data</label>
                  <input
                    type="date"
                    className="input-base num mt-1"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label-caps">Descrição</label>
                <input
                  className="input-base mt-1"
                  value={description}
                  maxLength={120}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Opcional — por padrão, De → Para"
                />
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
                {pending ? 'Salvando...' : editing ? 'Salvar' : 'Transferir'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
