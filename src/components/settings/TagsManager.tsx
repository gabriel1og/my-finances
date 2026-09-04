'use client';

import { useRef, useState, useTransition } from 'react';
import { createTag, deleteTag, updateTag } from '@/app/(app)/tags/actions';
import { Popover } from '@/components/ui/Popover';
import { RowMenu, RowMenuItem, RowMenuNote } from '@/components/ui/RowMenu';
import { CATEGORY_PALETTE } from '@/lib/constants';
import type { Tag } from '@/types/database.types';

/**
 * A paleta em painel — só abaixo de `lg`.
 *
 * Nas larguras grandes as doze bolinhas cabem na linha e trocar a cor é um
 * clique; no celular elas empurravam o nome da tag para duas ou três linhas,
 * espremendo justamente o conteúdo principal, e cada uma era um alvo de 12px.
 * Ali a cor vira um alvo só, o próprio ponto colorido, e a escolha acontece
 * numa grade 6×2 com folga.
 */
function ColorPicker({
  tag,
  disabled,
  onPick,
}: {
  tag: Tag;
  disabled: boolean;
  onPick: (color: string) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={`Cor de ${tag.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="icon-btn -ml-2"
      >
        <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: tag.color }} />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label={`Cor de ${tag.name}`}
        width={288}
      >
        <div className="grid grid-cols-6 gap-1">
          {CATEGORY_PALETTE.map((color) => {
            const active = tag.color.toLowerCase() === color.toLowerCase();

            return (
              <button
                key={color}
                type="button"
                disabled={disabled}
                aria-label={`Cor ${color} para ${tag.name}`}
                aria-pressed={active}
                onClick={() => {
                  onPick(color);
                  setOpen(false);
                }}
                className="flex h-11 w-full items-center justify-center rounded-md transition-colors hover:bg-surfaceAlt disabled:opacity-50"
              >
                {/* Anel com offset, não borda clara: a borda de 1px na cor do
                    texto quase não se lia sobre os tons mais claros da paleta. */}
                <span
                  className={`h-7 w-7 rounded-full ${
                    active ? 'ring-2 ring-textPrimary ring-offset-2 ring-offset-surface' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}

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
              className="flex items-center gap-2 border-b border-border py-1 last:border-b-0 lg:flex-wrap lg:py-2"
            >
              <div className="lg:hidden">
                <ColorPicker
                  tag={tag}
                  disabled={pending}
                  onPick={(color) => run(() => updateTag(tag.id, { name: tag.name, color }))}
                />
              </div>

              <span
                className="hidden h-2 w-2 shrink-0 rounded-full lg:block"
                style={{ backgroundColor: tag.color }}
              />

              {editingId === tag.id ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 py-1 lg:py-0">
                  <input
                    className="input-base min-w-0 flex-1 lg:py-1"
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
                    className="btn-primary btn-sm shrink-0"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="btn-secondary btn-sm shrink-0"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-textPrimary">
                    {tag.name}
                  </span>

                  <div className="hidden shrink-0 gap-2 lg:flex">
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

                  <div className="hidden shrink-0 items-center gap-2 lg:flex">
                    <button
                      onClick={() => {
                        setEditingId(tag.id);
                        setEditName(tag.name);
                      }}
                      className="text-xs text-textSecondary transition-colors hover:text-textPrimary"
                    >
                      Renomear
                    </button>
                    {confirmingId === tag.id ? (
                      <>
                        <span className="text-xs text-textSecondary">Excluir?</span>
                        <button
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => deleteTag(tag.id),
                              () => setConfirmingId(null),
                            )
                          }
                          className="text-xs text-expense"
                        >
                          Sim
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          className="text-xs text-textSecondary"
                        >
                          Não
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmingId(tag.id)}
                        className="text-xs text-textMuted transition-colors hover:text-expense"
                      >
                        Excluir
                      </button>
                    )}
                  </div>

                  <div className="lg:hidden">
                    <RowMenu label={`Ações de ${tag.name}`}>
                      {(close) =>
                        confirmingId === tag.id ? (
                          <>
                            <RowMenuNote>
                              O rótulo sai das transações; os lançamentos continuam intactos.
                            </RowMenuNote>
                            <RowMenuItem
                              tone="danger"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () => deleteTag(tag.id),
                                  () => setConfirmingId(null),
                                )
                              }
                            >
                              {pending ? 'Excluindo...' : 'Sim'}
                            </RowMenuItem>
                            <RowMenuItem
                              onClick={() => {
                                setConfirmingId(null);
                                close();
                              }}
                            >
                              Não
                            </RowMenuItem>
                          </>
                        ) : (
                          <>
                            <RowMenuItem
                              onClick={() => {
                                setEditingId(tag.id);
                                setEditName(tag.name);
                                close();
                              }}
                            >
                              Renomear
                            </RowMenuItem>
                            <RowMenuItem tone="danger" onClick={() => setConfirmingId(tag.id)}>
                              Excluir
                            </RowMenuItem>
                          </>
                        )
                      }
                    </RowMenu>
                  </div>
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
