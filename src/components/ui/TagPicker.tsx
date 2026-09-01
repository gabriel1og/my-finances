'use client';

import { useState, useTransition } from 'react';
import { TagChip } from '@/components/ui/TagChip';
import { createTag } from '@/app/(app)/tags/actions';
import { CATEGORY_PALETTE } from '@/lib/constants';
import type { Tag } from '@/types/database.types';

/**
 * Seleção múltipla com criação no fluxo: obrigar a sair do lançamento para
 * cadastrar uma tag mataria o hábito de usar tags.
 */
export function TagPicker({
  tags,
  selected,
  onChange,
}: {
  tags: Tag[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const term = query.trim().toLowerCase();
  const chosen = tags.filter((tag) => selected.includes(tag.id));
  const suggestions = tags
    .filter((tag) => !selected.includes(tag.id))
    .filter((tag) => (term ? tag.name.toLowerCase().includes(term) : true))
    .slice(0, 6);

  const exactExists = tags.some((tag) => tag.name.toLowerCase() === term);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  function create() {
    setError(null);
    const name = query.trim();
    if (!name) return;

    startTransition(async () => {
      // Cor determinística pelo tamanho da lista: evita pedir mais uma decisão
      // no meio do lançamento. Dá para trocar depois em Configurações.
      const color = CATEGORY_PALETTE[tags.length % CATEGORY_PALETTE.length];
      const result = await createTag({ name, color });
      if (result.error) return setError(result.error);
      if (result.id) onChange([...selected, result.id]);
      setQuery('');
    });
  }

  return (
    <div>
      <label className="label-caps">Tags</label>

      {chosen.length ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {chosen.map((tag) => (
            <TagChip
              key={tag.id}
              name={tag.name}
              color={tag.color}
              onRemove={() => toggle(tag.id)}
            />
          ))}
        </div>
      ) : null}

      <input
        className="input-base mt-2"
        value={query}
        maxLength={30}
        placeholder="Buscar ou criar tag..."
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          // Enter dentro do modal não deve submeter o lançamento.
          e.preventDefault();
          if (suggestions.length > 0 && !exactExists) {
            toggle(suggestions[0].id);
            setQuery('');
          } else if (term && !exactExists) {
            create();
          }
        }}
      />

      {suggestions.length || (term && !exactExists) ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                toggle(tag.id);
                setQuery('');
              }}
              className="rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-textSecondary transition-colors hover:border-borderHover hover:text-textPrimary"
            >
              <span
                className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </button>
          ))}

          {term && !exactExists ? (
            <button
              type="button"
              disabled={pending}
              onClick={create}
              className="rounded-sm border border-dashed border-borderHover px-1.5 py-0.5 text-[11px] text-accent transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {pending ? 'Criando...' : `Criar "${query.trim()}"`}
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-1 text-[11px] text-expense">{error}</p> : null}
    </div>
  );
}
