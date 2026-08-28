'use client';

import { useState, useTransition } from 'react';
import { CategoryBar } from '@/components/ui/CategoryBar';
import { CategoryFormModal } from '@/components/categories/CategoryFormModal';
import { formatCurrency } from '@/lib/format';
import {
  archiveCategory,
  clearMonthlyBudget,
  deleteCategory,
  restoreCategory,
  setMonthlyBudget,
} from '@/app/(app)/categories/actions';
import type { Category } from '@/types/database.types';

export function CategoryCard({
  category,
  month,
  spent,
  budget,
  monthOverride,
}: {
  category: Category;
  month: string;
  spent: number;
  budget: number;
  monthOverride: number | null;
}) {
  const [editingBudget, setEditingBudget] = useState(false);
  const [value, setValue] = useState(String(budget).replace('.', ','));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else setEditingBudget(false);
    });
  }

  return (
    <div className={`card ${category.is_archived ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <span className="flex items-center gap-2 text-sm text-textPrimary">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
          {category.name}
          {category.is_archived ? (
            <span className="label-caps text-textMuted">arquivada</span>
          ) : null}
        </span>

        <span className="num text-xs text-textMuted">
          restam {formatCurrency(Math.max(budget - spent, 0))}
        </span>
      </div>

      <CategoryBar name={category.name} color={category.color} spent={spent} budget={budget} />

      {monthOverride !== null ? (
        <p className="num mt-1 text-[11px] text-accent">limite específico deste mês</p>
      ) : null}

      {editingBudget ? (
        <div className="mt-3 flex gap-2">
          <input
            className="input-base num"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            disabled={pending}
            onClick={() =>
              run(() => setMonthlyBudget(category.id, month, Number(value.replace(',', '.') || '0')))
            }
            className="rounded-md bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            Aplicar
          </button>
          <button
            onClick={() => setEditingBudget(false)}
            className="rounded-md border border-border px-3 py-2 text-xs text-textSecondary"
          >
            Cancelar
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-expense">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3 text-xs">
        <CategoryFormModal
          category={category}
          trigger={
            <button className="text-textSecondary transition-colors hover:text-textPrimary">
              Editar
            </button>
          }
        />

        <button
          onClick={() => setEditingBudget((v) => !v)}
          className="text-textSecondary transition-colors hover:text-textPrimary"
        >
          Limite do mês
        </button>

        {monthOverride !== null ? (
          <button
            disabled={pending}
            onClick={() => run(() => clearMonthlyBudget(category.id, month))}
            className="text-textSecondary transition-colors hover:text-textPrimary"
          >
            Usar limite padrão
          </button>
        ) : null}

        {category.is_archived ? (
          <>
            <button
              disabled={pending}
              onClick={() => run(() => restoreCategory(category.id))}
              className="text-textSecondary transition-colors hover:text-income"
            >
              Restaurar
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => deleteCategory(category.id))}
              className="ml-auto text-textMuted transition-colors hover:text-expense"
            >
              Excluir
            </button>
          </>
        ) : (
          <button
            disabled={pending}
            onClick={() => run(() => archiveCategory(category.id))}
            className="ml-auto text-textMuted transition-colors hover:text-warning"
          >
            Arquivar
          </button>
        )}
      </div>
    </div>
  );
}
