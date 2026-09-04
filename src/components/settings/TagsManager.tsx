'use client';

import { useState, useTransition } from 'react';
import { createTag, deleteTag, updateTag } from '@/app/(app)/tags/actions';
import { CATEGORY_PALETTE } from '@/lib/constants';
import type { Tag } from '@/types/database.types';

export function TagsManager({ tags }: { tags: Tag[] }) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string | null }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) return setError(result.error);
      after?.();
    });
  }

  return (
    <div className="card flex flex-col">
      <span className="label-caps">Tags</span>
      <p className="mt-1 text-xs text-textSecondary">
        Dimensão paralela à categoria: uma transação tem uma categoria, mas pode ter várias tags.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          className="input-base"
          value={name}
          maxLength={30}
          placeholder="Nova tag..."
          onChange={(e) => setName(e.target.value)}
        />
        <button
          disabled={pending || !name.trim()}
          onClick={() =>
            run(
              () =>
                createTag({
                  name,
                  color: CATEGORY_PALETTE[tags.length % CATEGORY_PALETTE.length],
                }),
              () => setName(''),
            )
          }
          className="btn-primary shrink-0"
        >
          Criar
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-expense">{error}</p> : null}

      <div className="mt-4 flex-1">
        {tags.length === 0 ? (
          <p className="text-xs text-textMuted">Nenhuma tag ainda.</p>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="flex flex-wrap items-center gap-2 border-b border-border py-2 last:border-b-0"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color }}
              />

              {editingId === tag.id ? (
                <>
                  <input
                    className="input-base py-1"
                    value={editName}
                    maxLength={30}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <button
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => updateTag(tag.id, { name: editName, color: tag.color }),
                        () => setEditingId(null),
                      )
                    }
                    className="shrink-0 text-xs text-accent"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="shrink-0 text-xs text-textSecondary"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-textPrimary">{tag.name}</span>
                  <div className="flex shrink-0 gap-2">
                    {CATEGORY_PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Cor ${color} para ${tag.name}`}
                        onClick={() => run(() => updateTag(tag.id, { name: tag.name, color }))}
                        className={[
                          'h-3 w-3 rounded-full border transition-colors',
                          tag.color.toLowerCase() === color.toLowerCase()
                            ? 'border-textPrimary'
                            : 'border-transparent',
                        ].join(' ')}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  |
                  <button
                    onClick={() => {
                      setEditingId(tag.id);
                      setEditName(tag.name);
                    }}
                    className="shrink-0 text-xs text-textSecondary transition-colors hover:text-textPrimary"
                  >
                    Renomear
                  </button>
                  {confirmingId === tag.id ? (
                    <>
                      <span className="shrink-0 text-xs text-textSecondary">Excluir?</span>
                      <button
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => deleteTag(tag.id),
                            () => setConfirmingId(null),
                          )
                        }
                        className="shrink-0 text-xs text-expense"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="shrink-0 text-xs text-textSecondary"
                      >
                        Não
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmingId(tag.id)}
                      className="shrink-0 text-xs text-textMuted transition-colors hover:text-expense"
                    >
                      Excluir
                    </button>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      <p className="mt-3 text-2xs text-textMuted">
        Excluir uma tag remove o rótulo das transações; os lançamentos continuam intactos.
      </p>
    </div>
  );
}
