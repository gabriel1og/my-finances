'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { formatTimestampDateTime } from '@/lib/format';
import type { AssistantAnswer } from '@/lib/assistant/contracts';

/** Accessible answer with server-provided sources. Example: <AssistantResponse answer={answer} />. */
export function AssistantResponse({ answer }: { answer: AssistantAnswer }) {
  const [copyStatus, setCopyStatus] = useState('');
  async function copyAnswer() {
    try {
      const tables = answer.tables
        .map(
          (table) =>
            `${table.title}\n${table.columns.join('\t')}\n${table.rows.map((row) => row.join('\t')).join('\n')}`,
        )
        .join('\n\n');
      await navigator.clipboard.writeText(
        [answer.text, tables, `Período: ${answer.period}`].filter(Boolean).join('\n\n'),
      );
      setCopyStatus('Resposta copiada.');
    } catch {
      setCopyStatus('Não foi possível copiar.');
    }
  }
  return (
    <article className="min-w-0 rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-accent">Assistente Flowly</span>
        <button className="text-xs text-textSecondary hover:text-textPrimary" onClick={copyAnswer}>
          Copiar resposta
        </button>
      </div>
      <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
        {answer.text}
      </p>
      {answer.tables.map((table, index) => (
        <div
          key={index}
          className="mt-4 overflow-x-auto rounded-md border border-border"
          tabIndex={0}
          aria-label={`Tabela: ${table.title}`}
        >
          <table className="w-full text-left text-xs">
            <caption className="p-3 text-left font-semibold">{table.title}</caption>
            <thead className="bg-surfaceAlt">
              <tr>
                {table.columns.map((column, index) => (
                  <th key={index} className="whitespace-nowrap px-3 py-2">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index} className="border-t border-border">
                  {row.map((cell, index) => (
                    <td key={index} className="px-3 py-2 font-mono">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <div className="mt-4 border-t border-border pt-3 text-xs text-textSecondary">
        <p className="font-mono">Período: {answer.period}</p>
        <p className="mt-1 font-mono">
          Consultado em {formatTimestampDateTime(answer.consultedAt)}
        </p>
        {answer.sources.length ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Fontes da resposta">
            {answer.sources.map((source, index) => (
              <li key={index}>
                <Link className="text-accent underline" href={source.href as Route}>
                  {source.label}
                </Link>
                <span className="ml-1 font-mono">({source.period})</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <span role="status" className="text-xs text-textMuted">
        {copyStatus}
      </span>
    </article>
  );
}
