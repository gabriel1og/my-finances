'use client';

import { useState, useTransition } from 'react';
import { Modal, ModalTrigger } from '@/components/ui/Modal';
import { CATEGORY_PALETTE } from '@/lib/constants';
import { createCategory, updateCategory } from '@/app/(app)/categories/actions';
import type { Category, TransactionType } from '@/types/database.types';

export function CategoryFormModal({
  category,
  trigger,
}: {
  category?: Category;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(category);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? CATEGORY_PALETTE[0]);
  const [kind, setKind] = useState<TransactionType>(category?.kind ?? 'expense');
  const [budget, setBudget] = useState(String(category?.budget ?? '0').replace('.', ','));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const parsedBudget = Number(budget.replace(',', '.') || '0');
    const input = { name, color, kind, budget: parsedBudget };

    startTransition(async () => {
      const result = editing
        ? await updateCategory(category!.id, input)
        : await createCategory(input);

      if (result.error) return setError(result.error);
      setOpen(false);
      if (!editing) {
        setName('');
        setBudget('0');
      }
    });
  }

  return (
    <>
      <ModalTrigger
        trigger={trigger}
        onOpen={() => setOpen(true)}
        fallback={
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
            Nova categoria
          </button>
        }
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar categoria' : 'Nova categoria'}
      >
        <div className="mt-4 space-y-3">
          <div>
            <label className="label-caps">Nome</label>
            <input
              className="input-base mt-1"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alimentação, Moradia..."
            />
          </div>

          <div>
            <label className="label-caps">Tipo</label>
            <div className="mt-1 grid grid-cols-2 gap-2 rounded-md border border-border p-1">
              {(['expense', 'income'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setKind(option)}
                  className={[
                    'rounded-sm py-1.5 text-sm transition-colors',
                    kind === option
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
          </div>

          <div>
            <label className="label-caps">Limite mensal padrão</label>
            <input
              className="input-base num mt-1"
              inputMode="decimal"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0,00"
            />
            <p className="mt-1 text-[11px] text-textMuted">
              Use 0 para categoria sem limite definido.
            </p>
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
      </Modal>
    </>
  );
}
