'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  findDuplicates,
  runImport,
  type CategoryMapping,
  type ImportOutcome,
  type ImportPayload,
  type OriginMapping,
} from '@/app/(app)/settings/import/actions';
import { ImportDropzone } from '@/components/import/ImportDropzone';
import { ImportRows } from '@/components/import/ImportRows';
import { MappingPanel } from '@/components/import/MappingPanel';
import { useMoney } from '@/lib/currency';
import { FORMAT_LABEL, parseImportFile } from '@/lib/import/formats';
import { buildPlan, itemDuplicateKeys, normalizeName, summarize } from '@/lib/import/plan';
import type { ImportPlan, ParseResult } from '@/lib/import/types';
import type { Account, Category, CreditCard, Tag } from '@/types/database.types';

type Loaded = {
  fileName: string;
  result: ParseResult;
  plan: ImportPlan;
  duplicates: Set<string>;
};

type Stage =
  { step: 'pick' } | { step: 'review'; loaded: Loaded } | { step: 'done'; outcome: ImportOutcome };

/**
 * Três passos numa página só: escolher o arquivo, revisar (mapear e marcar
 * linhas) e o resultado. O estado inteiro mora aqui; os painéis só desenham
 * e devolvem mudanças.
 *
 * O parse roda no navegador — é puro e o arquivo já está na mão do usuário.
 * O servidor entra duas vezes: para dizer o que já existe (duplicatas) e
 * para gravar.
 */
export function ImportWizard({
  accounts,
  cards,
  categories,
  tags,
}: {
  accounts: Account[];
  cards: CreditCard[];
  categories: Category[];
  tags: Tag[];
}) {
  const money = useMoney();
  const [stage, setStage] = useState<Stage>({ step: 'pick' });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [origins, setOrigins] = useState<Record<string, OriginMapping>>({});
  const [cats, setCats] = useState<Record<string, CategoryMapping>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setStage({ step: 'pick' });
    setLoadError(null);
    setSubmitError(null);
    setSelected(new Set());
    setOrigins({});
    setCats({});
  }

  function load(file: File) {
    setLoadError(null);
    startTransition(async () => {
      const text = await file.text();
      const parsed = parseImportFile(text);
      if (!parsed.ok) return setLoadError(parsed.error);
      if (parsed.result.rows.length === 0) {
        return setLoadError('Nenhuma linha válida encontrada no arquivo.');
      }

      const plan = buildPlan(parsed.result.rows);
      const keys = plan.items.flatMap(itemDuplicateKeys);
      const dupes = await findDuplicates(keys);
      if (dupes.error) return setLoadError(dupes.error);
      const duplicates = new Set(dupes.duplicates ?? []);

      // Duplicata começa desmarcada; o resto, marcado.
      setSelected(
        new Set(
          plan.items
            .filter((item) => !itemDuplicateKeys(item).some((key) => duplicates.has(key)))
            .map((item) => item.id),
        ),
      );

      // Mapeamento inicial: nome igual (sem caixa) casa com o que já existe;
      // o resto nasce como "criar".
      const byName = <T extends { id: string; name: string }>(list: T[]) =>
        new Map(list.map((entry) => [normalizeName(entry.name), entry.id]));
      const accountByName = byName(accounts);
      const cardByName = byName(cards);
      const categoryByName = byName(categories);

      const nextOrigins: Record<string, OriginMapping> = {};
      for (const origin of plan.origins) {
        const existing = (origin.kind === 'account' ? accountByName : cardByName).get(
          normalizeName(origin.name),
        );
        nextOrigins[origin.key] = {
          name: origin.name,
          kind: origin.kind,
          target: existing ?? 'new',
          accountKind: 'checking',
          card:
            origin.kind === 'card'
              ? {
                  // Cartão com o mesmo nome de uma conta do arquivo (ex.: "Itaú")
                  // provavelmente é pago por ela.
                  accountTarget:
                    accountByName.get(normalizeName(origin.name)) ??
                    (plan.origins.some(
                      (o) =>
                        o.kind === 'account' &&
                        normalizeName(o.name) === normalizeName(origin.name),
                    )
                      ? `account:${normalizeName(origin.name)}`
                      : (accounts[0]?.id ?? '')),
                  closingDay: 0,
                  dueDay: 0,
                }
              : undefined,
        };
      }
      setOrigins(nextOrigins);

      const nextCats: Record<string, CategoryMapping> = {};
      for (const category of plan.categories) {
        nextCats[category.key] = {
          name: category.name,
          kind: category.kind,
          target: categoryByName.get(normalizeName(category.name)) ?? 'new',
        };
      }
      setCats(nextCats);

      setStage({
        step: 'review',
        loaded: { fileName: file.name, result: parsed.result, plan, duplicates },
      });
    });
  }

  const loaded = stage.step === 'review' ? stage.loaded : null;
  const selectedItems = useMemo(
    () => (loaded ? loaded.plan.items.filter((item) => selected.has(item.id)) : []),
    [loaded, selected],
  );
  const summary = useMemo(() => summarize(selectedItems), [selectedItems]);

  /** O que ainda impede gravar — mostrado no rodapé, no lugar do botão cego. */
  const blocker = useMemo(() => {
    if (!loaded) return null;
    if (selectedItems.length === 0) return 'Marque ao menos uma linha.';
    for (const origin of Object.values(origins)) {
      if (!origin.target) return `Escolha o destino de "${origin.name}".`;
      if (origin.target === 'new' && origin.kind === 'card') {
        const card = origin.card;
        if (!card?.accountTarget)
          return `Cartão "${origin.name}": escolha a conta que paga a fatura.`;
        if (!card.closingDay || !card.dueDay) {
          return `Cartão "${origin.name}": informe fechamento e vencimento.`;
        }
      }
    }
    return null;
  }, [loaded, selectedItems, origins]);

  function submit() {
    if (!loaded || blocker) return;
    setSubmitError(null);

    const usedTags = new Set<string>();
    for (const item of selectedItems) {
      if (item.kind === 'transaction') item.row.tags.forEach((tag) => usedTags.add(tag));
    }

    const payload: ImportPayload = {
      items: selectedItems,
      origins,
      categories: cats,
      tags: [...usedTags],
    };

    startTransition(async () => {
      const result = await runImport(payload);
      if (result.error) return setSubmitError(result.error);
      setStage({ step: 'done', outcome: result.outcome! });
    });
  }

  // -------------------------------------------------------------------------

  if (stage.step === 'pick') {
    return (
      <div className="mx-auto max-w-2xl">
        <ImportDropzone onFile={load} pending={pending} error={loadError} />
      </div>
    );
  }

  if (stage.step === 'done') {
    const { outcome } = stage;
    const createdParts = [
      outcome.created.accounts > 0 && `${outcome.created.accounts} conta(s)`,
      outcome.created.cards > 0 && `${outcome.created.cards} cartão(ões)`,
      outcome.created.categories > 0 && `${outcome.created.categories} categoria(s)`,
      outcome.created.tags > 0 && `${outcome.created.tags} tag(s)`,
    ].filter(Boolean);
    const target = (
      outcome.firstMonth ? `/transactions?month=${outcome.firstMonth}` : '/transactions'
    ) as Route;

    return (
      <div className="mx-auto max-w-2xl">
        <div className="card animate-fadeUp">
          <span className="label-caps">Importação concluída</span>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Stat label="Lançamentos" value={outcome.transactions} />
            <Stat label="Transferências" value={outcome.transfers} />
          </div>
          <p className="mt-4 text-xs text-textSecondary">
            {createdParts.length > 0
              ? `Criado junto: ${createdParts.join(', ')}.`
              : 'Nenhuma conta, cartão ou categoria precisou ser criada.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={target} className="btn-primary">
              Ver transações
            </Link>
            <button type="button" onClick={reset} className="btn-secondary">
              Importar outro arquivo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { fileName, result, plan, duplicates } = stage.loaded;
  const duplicateCount = plan.items.filter((item) =>
    itemDuplicateKeys(item).some((key) => duplicates.has(key)),
  ).length;

  return (
    <div className="animate-fadeUp pb-24">
      {/* Arquivo lido */}
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          <span className="label-caps">Arquivo</span>
          <p className="mt-0.5 truncate text-sm text-textPrimary">{fileName}</p>
        </div>
        <Meta label="Formato" value={FORMAT_LABEL[result.format]} />
        <Meta label="Linhas lidas" value={String(result.rows.length)} mono />
        <Meta label="Ignoradas" value={String(result.skipped.length)} mono />
        <button type="button" onClick={reset} className="btn-secondary btn-sm">
          Trocar arquivo
        </button>
        {result.skipped.length > 0 ? (
          <details className="w-full">
            <summary className="cursor-pointer text-xs text-textSecondary transition-colors hover:text-textPrimary">
              Ver linhas ignoradas
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-textSecondary">
              {result.skipped.map((entry) => (
                <li key={entry.line}>
                  <span className="num text-textMuted">L{entry.line}</span> — {entry.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {/* Resumo do que vai entrar */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Stat label="Lançamentos" value={summary.transactions} />
        <Stat label="Transferências" value={summary.transfers} />
        <Stat label="Receitas" text={money(summary.income)} tone="income" />
        <Stat label="Despesas" text={money(summary.expense)} tone="expense" />
        <Stat
          label="Já existentes"
          value={duplicateCount}
          hint={duplicateCount > 0 ? 'desmarcadas por padrão' : undefined}
        />
      </div>

      {/* Mapeamento */}
      <MappingPanel
        plan={plan}
        accounts={accounts}
        cards={cards}
        categories={categories}
        tags={tags}
        origins={origins}
        onOriginChange={(key, next) => setOrigins((prev) => ({ ...prev, [key]: next }))}
        cats={cats}
        onCategoryChange={(key, next) => setCats((prev) => ({ ...prev, [key]: next }))}
      />

      {/* Linhas */}
      <ImportRows
        items={plan.items}
        selected={selected}
        duplicates={duplicates}
        onToggle={(id) =>
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onToggleAll={(ids, on) =>
          setSelected((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
            return next;
          })
        }
      />

      {/* Rodapé fixo: a decisão fica sempre à vista, mesmo com 200 linhas. */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="min-w-0 flex-1 text-xs text-textSecondary">
            <span className="num text-textPrimary">{selectedItems.length}</span> de{' '}
            <span className="num">{plan.items.length}</span> linhas selecionadas
            {submitError ? <span className="ml-3 text-expense">{submitError}</span> : null}
            {!submitError && blocker ? <span className="ml-3 text-warning">{blocker}</span> : null}
          </p>
          <button type="button" onClick={reset} className="btn-secondary" disabled={pending}>
            Descartar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || Boolean(blocker)}
            className="btn-primary"
          >
            {pending ? 'Gravando…' : `Importar ${selectedItems.length} linha(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="shrink-0">
      <span className="label-caps">{label}</span>
      <p className={`mt-0.5 text-sm text-textPrimary ${mono ? 'num' : ''}`}>{value}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  text,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value?: number;
  text?: string;
  tone?: 'neutral' | 'income' | 'expense';
  hint?: string;
}) {
  const color =
    tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-textPrimary';
  return (
    <div className="rounded-lg border border-border bg-surface p-3 sm:p-4">
      <span className="label-caps">{label}</span>
      <p className={`num mt-1.5 text-xl font-medium tracking-tight ${color}`}>{text ?? value}</p>
      {hint ? <p className="mt-0.5 text-2xs text-textMuted">{hint}</p> : null}
    </div>
  );
}
