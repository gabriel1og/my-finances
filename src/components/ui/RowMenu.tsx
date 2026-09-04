'use client';

import { useRef, useState } from 'react';
import { MoreIcon } from '@/components/layout/NavIcons';
import { Popover } from '@/components/ui/Popover';

/**
 * Ações de uma linha de lista atrás de um único alvo de 44px.
 *
 * "Editar" e "Excluir" como links de texto nasciam no meio da linha: no
 * celular atravessavam a descrição, empurravam a categoria para uma segunda
 * linha e consumiam justamente a largura que faltava para o valor — e a
 * confirmação de exclusão, com até quatro botões, piorava tudo de uma vez.
 * Fora do fluxo, a linha volta a ser só conteúdo e a confirmação ganha o
 * espaço de que precisa.
 *
 * `children` recebe o `close` do painel: quem abre um modal a partir daqui
 * precisa fechar o menu antes, senão o popover (z-60) fica por cima do
 * diálogo (z-50).
 */
export function RowMenu({
  label,
  children,
}: {
  /** Diz de qual linha são as ações — numa lista, todas teriam o mesmo rótulo. */
  label: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="icon-btn -mr-2 text-textMuted"
      >
        <MoreIcon />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label={label}
        align="right"
        width={220}
      >
        <div className="flex flex-col">{children(() => setOpen(false))}</div>
      </Popover>
    </>
  );
}

/** Item do painel: largura inteira, texto à esquerda, alvo de 44px. */
export function RowMenuItem({
  children,
  onClick,
  disabled = false,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex min-h-11 w-full items-center rounded-md px-2 text-left text-sm transition-colors disabled:opacity-50',
        tone === 'danger'
          ? 'text-expense hover:bg-expenseDim'
          : 'text-textSecondary hover:bg-surfaceAlt hover:text-textPrimary',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/** Pergunta acima dos itens de confirmação. */
export function RowMenuNote({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pb-1 pt-0.5 text-2xs text-textSecondary">{children}</p>;
}
