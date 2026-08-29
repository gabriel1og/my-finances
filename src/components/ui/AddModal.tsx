'use client';

import { useState, useTransition } from 'react';
import { createTransaction, updateTransaction } from '@/app/(app)/transactions/actions';
import type { Category, TransactionType, TransactionWithCategory } from '@/types/database.types';

/**
 * Serve para criar e editar lançamentos.
 * Sem `transaction` -> modo criação (botão "Novo lançamento").
 * Com `transaction`  -> modo edição, acionado pelo `trigger` recebido.
 */
export function TransactionModal({
  categories,
  transaction,
  trigger,
}: {
  categories: Category[];
  transaction?: TransactionWithCategory;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(transaction);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount).replace('.', ',') : '',
  );
  const [date, setDate] = useState(
    transaction?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Categoria de receita não faz sentido num lançamento de despesa e vice-versa.
  const options = categories.filter((category) => category.kind === type);

  function changeType(next: TransactionType) {
    setType(next);
    const stillValid = categories.some(
      (category) => category.id === categoryId && category.kind === next,
    );
    if (!stillValid) setCategoryId('');
  }

  function close() {
    setError(null);
    setOpen(false);
    if (!editing) {
      setDescription('');
      setAmount('');
      setCategoryId('');
    }
  }

  function submit() {
    setError(null);
    const parsed = Number(amount.replace(',', '.'));
    const input = { type, description, amount: parsed, date, categoryId: categoryId || null };

    startTransition(async () => {
      const result = editing
        ? await updateTransaction(transaction!.id, input)
        : await createTransaction(input);

      if (result.error) return setError(result.error);
      close();
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
            Novo lançamento
          </button>
        )}
      </span>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md animate-fadeUp rounded-lg border border-border bg-surface p-6">
            <h2 className="text-base font-medium">
              {editing ? 'Editar lançamento' : 'Novo lançamento'}
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-md border border-border p-1">
              {(['income', 'expense'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => changeType(option)}
                  className={[
                    'rounded-sm py-1.5 text-sm transition-colors',
                    type === option
                      ? option === 'income'
                        ? 'bg-incomeDim text-income'
                        : 'bg-expenseDim text-expense'
                      : 'text-textSecondary hover:text-textPrimary',
                  ].join(' ')}
                >
                  {option === 'income' ? 'Receita' : 'Despesa'}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label-caps">Descrição</label>
                <input
                  className="input-base mt-1"
                  value={description}
                  maxLength={120}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mercado, salário, aluguel..."
                />
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
                <label className="label-caps">Categoria</label>
                <select
                  className="input-base mt-1"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">
                    {options.length ? 'Sem categoria' : 'Nenhuma categoria deste tipo'}
                  </option>
                  {options.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error ? <p className="mt-3 text-xs text-expense">{error}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={close}
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

/** Alias mantido para as chamadas existentes no dashboard e em /transactions. */
export const AddModal = TransactionModal;
