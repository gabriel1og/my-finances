'use client';

import { useEffect } from 'react';

/**
 * Sem isto, qualquer erro do Supabase virava a tela de 500 crua do Next.
 * O erro real fica no log do servidor; aqui mostramos o digest, que é o que
 * permite achar a linha correspondente.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card max-w-md animate-fadeUp text-center">
        <span className="label-caps text-expense">Algo deu errado</span>

        <p className="mt-3 text-sm text-textPrimary">
          Não foi possível carregar esta página. Pode ter sido uma falha de conexão com o banco.
        </p>

        {error.digest ? (
          <p className="num mt-2 text-2xs text-textMuted">digest {error.digest}</p>
        ) : null}

        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={reset}
            className="btn-primary"
          >
            Tentar de novo
          </button>
          <a
            href="/dashboard"
            className="btn-secondary"
          >
            Ir para o dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
