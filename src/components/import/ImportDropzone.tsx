'use client';

import { useId, useRef, useState } from 'react';

/**
 * Área de soltar arquivo que também é um botão de escolher. O `<input>` fica
 * escondido mas continua no fluxo de foco: Enter ou Espaço no rótulo abre o
 * seletor, e o leitor de tela anuncia o campo de arquivo.
 */
export function ImportDropzone({
  onFile,
  pending,
  error,
}: {
  onFile: (file: File) => void;
  pending: boolean;
  error: string | null;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function accept(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    onFile(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="card">
      <span className="label-caps">Importar CSV</span>
      <p className="mt-1 text-xs text-textSecondary">
        Nada é gravado nesta etapa. Depois de ler o arquivo você revisa linha a linha, decide onde
        cada conta e categoria cai, e só então confirma.
      </p>

      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          accept(event.dataTransfer.files);
        }}
        className={[
          'mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-8 text-center transition-colors',
          over ? 'border-accent bg-accentDim/40' : 'border-border hover:border-borderHover',
          pending ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          disabled={pending}
          onChange={(event) => accept(event.target.files)}
        />
        <span className="text-sm text-textPrimary">
          {pending ? 'Lendo o arquivo…' : 'Arraste o CSV aqui ou clique para escolher'}
        </span>
        <span className="mt-1 text-2xs text-textMuted">Até 5000 linhas por arquivo</span>
      </label>

      {error ? (
        <p role="alert" className="mt-3 text-xs text-expense">
          {error}
        </p>
      ) : null}

      <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-textPrimary">Exportação do flowly</dt>
          <dd className="mt-0.5 text-textSecondary">
            O arquivo gerado em Transações ou aqui em Configurações. Transferências e pagamentos de
            fatura voltam como eram; parcelas entram como lançamentos avulsos.
          </dd>
        </div>
        <div>
          <dt className="text-textPrimary">Fortuno</dt>
          <dd className="mt-0.5 text-textSecondary">
            Exportação padrão (Data, Transação, Descrição, Valor, Status, Categoria, Conta/Cartão,
            Observações). &ldquo;Despesas no crédito&rdquo; viram compras no cartão e as duas linhas
            de uma transferência viram uma só.
          </dd>
        </div>
      </dl>
    </div>
  );
}
