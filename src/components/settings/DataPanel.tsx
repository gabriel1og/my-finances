import Link from 'next/link';
import type { Route } from 'next';
import { EXPORT_ENTITIES } from '@/lib/export';

/**
 * Backup e importação. Cada entidade sai num CSV próprio — abre no Excel sem
 * lib de zip e cada arquivo tem o cabeçalho que o importador reconhece.
 * Server component: são só links para route handlers.
 */
export function DataPanel() {
  return (
    <div className="card flex flex-col">
      <span className="label-caps">Dados</span>
      <p className="mt-1 text-xs text-textSecondary">
        Exportar gera um CSV por entidade, com separador &ldquo;;&rdquo; para abrir direto no Excel
        em português. A importação lê a exportação do flowly e o CSV do Fortuno.
      </p>

      {/* O respiro de baixo fica aqui, e não no bloco seguinte: lá o
          `margin-top` é `auto` (empurra a chamada para a base do card) e vale
          zero quando não sobra espaço. */}
      <ul className="mb-4 mt-4">
        {EXPORT_ENTITIES.map((entity) => (
          <li key={entity.key} className="row-divider flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-textPrimary">{entity.label}</p>
              <p className="truncate text-2xs text-textMuted">{entity.description}</p>
            </div>
            <a
              href={`/api/export/${entity.key}?scope=all`}
              className="btn-secondary btn-sm shrink-0"
              download
            >
              Exportar
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-textSecondary">
          Trazer lançamentos de um arquivo, com revisão antes de gravar.
        </p>
        <Link href={'/settings/import' as Route} className="btn-primary btn-sm">
          Importar CSV
        </Link>
      </div>
    </div>
  );
}
