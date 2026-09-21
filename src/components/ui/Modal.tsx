'use client';

import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef } from 'react';
import { CloseIcon } from '@/components/layout/NavIcons';

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
  placement = 'dialog',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  placement?: 'dialog' | 'drawer';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // `onClose` é recriado a cada render do componente pai (cada tecla digitada
  // num input muda o estado dele). Guardar num ref mantém o handler abaixo
  // estável, senão o efeito de foco rodava de novo a cada caractere e jogava o
  // cursor de volta para o primeiro campo do modal.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }

    if (event.key !== 'Tab' || !panelRef.current) return;

    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null,
    );

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
  }, []);

  // Só depende de `open`: abre -> foca o primeiro campo e trava o scroll;
  // fecha -> devolve o foco ao gatilho. Nunca reexecuta durante a digitação.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Foca o primeiro campo de digitação, não o "×" nem um toggle — quem abre
    // o modal quer digitar.
    const focusables = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const usable = focusables.filter((element) => !element.hasAttribute('data-modal-close'));
    const firstField =
      usable.find((element) => element instanceof HTMLInputElement) ?? usable[0] ?? focusables[0];
    firstField?.focus();

    const trigger = previouslyFocused.current;
    return () => {
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const overlayClass =
    placement === 'drawer'
      ? 'items-end justify-center p-0 sm:items-stretch sm:justify-end'
      : 'items-end justify-center p-0 sm:items-center sm:p-4';
  const panelClass =
    placement === 'drawer'
      ? 'max-h-[92vh] w-full overflow-y-auto rounded-t-lg border border-border bg-surface p-5 sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:border-y-0 sm:border-r-0 sm:p-6'
      : 'max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-lg border border-border bg-surface p-5 sm:max-h-[90vh] sm:rounded-lg sm:p-6';

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/60 ${overlayClass}`}
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
        className={`animate-fadeUp ${panelClass}`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-base font-medium tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            data-modal-close=""
            // Área de toque de 32px com o ícone de 20px: o "×" em texto ficava
            // pequeno demais para acertar, principalmente no celular.
            className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-textMuted transition-colors hover:bg-surfaceAlt hover:text-textPrimary"
          >
            <CloseIcon />
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
