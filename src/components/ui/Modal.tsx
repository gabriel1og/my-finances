'use client';

import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo acessível: fecha no Esc e no clique fora, prende o foco enquanto
 * aberto, devolve o foco para o gatilho ao fechar e trava o scroll do fundo.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Ciclo: Tab no último volta ao primeiro, Shift+Tab no primeiro vai ao
      // último. Sem isso o foco escapa para a página atrás do modal.
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Foca o primeiro campo, não o "×" — quem abre o modal quer digitar.
    const focusables = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const firstField =
      focusables.find((element) => !element.hasAttribute('data-modal-close')) ?? focusables[0];
    firstField?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        // Só o clique no fundo fecha; um arraste iniciado dentro do painel não.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-md animate-fadeUp overflow-y-auto rounded-lg border border-border bg-surface p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-base font-medium">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            data-modal-close=""
            className="-mr-1 -mt-1 rounded-sm px-2 text-textMuted transition-colors hover:text-textPrimary"
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

/**
 * Antes o gatilho era um <button> dentro de um <span onClick>, o que aninhava
 * elementos interativos e não respondia a teclado. Aqui o onClick vai para o
 * próprio elemento recebido.
 */
export function ModalTrigger({
  trigger,
  onOpen,
  fallback,
}: {
  trigger?: React.ReactNode;
  onOpen: () => void;
  fallback: React.ReactElement<{ onClick?: () => void }>;
}) {
  const element = isValidElement(trigger) ? trigger : fallback;
  return cloneElement(element as React.ReactElement<{ onClick?: () => void }>, {
    onClick: onOpen,
  });
}
