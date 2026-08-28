'use client';

import { useState, useTransition } from 'react';
import { createTransaction } from '@/app/(app)/transactions/actions';
import type { Category, TransactionType } from '@/types/database.types';

export function AddModal({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setDescription('');
    setAmount('');
    setCategoryId('');
    setError(null);
  }

  function submit() {
    const parsed = Number(amount.replace(',', '.'));
    if (!description.trim()) return setError('Informe uma descrição.');
    if (!Number.isFinite(parsed) || parsed <= 0) return setError('Informe um valor maior que zero.');

    startTransition(async () => {
      const result = await createTransaction({
        type,
        description,
        amount: parsed,
        date,
        categoryId: categoryId || null,
      });
      if (result.error) return setError(result.error);
      reset();
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Novo lançamento
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md animate-fadeUp rounded-lg border border-border bg-surface p-6">
            <h2 className="text-base font-medium">Novo lançamento</h2>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-md border border-border p-1">
              {(['income', 'expense'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setType(option)}
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
                  <option value="">Sem categoria</option>
                  {categories.map((category) => (
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
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
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
