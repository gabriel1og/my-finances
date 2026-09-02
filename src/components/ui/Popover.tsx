'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Position = { top: number; left: number };

/**
 * Painel flutuante ancorado a um gatilho.
 *
 * Renderiza em portal com posição fixa, e não como filho absoluto do gatilho,
 * porque os dois lugares onde ele aparece cortariam: o painel do `Modal` tem
 * `overflow-y-auto` e a sidebar recolhida tem 64px de largura. Em portal, o
 * popover nunca é clipado por um ancestral.
 *
 * Fecha no Esc e no clique fora — as duas expectativas que todo popover
 * precisa cumprir para não parecer travado. Não prende o foco como o `Modal`:
 * popover não bloqueia a página.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  label,
  align = 'left',
  width = 232,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  label: string;
  align?: 'left' | 'right';
  width?: number;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const height = panelRef.current?.offsetHeight ?? 320;
      const margin = 8;

      // Abre para baixo; se não couber, sobe. Assim o painel nunca fica meio
      // fora da janela em tela baixa.
      const opensDown = rect.bottom + margin + height <= window.innerHeight;
      const top = opensDown ? rect.bottom + margin : Math.max(margin, rect.top - margin - height);

      const rawLeft = align === 'right' ? rect.right - width : rect.left;
      const left = Math.min(Math.max(margin, rawLeft), window.innerWidth - width - margin);

      setPosition({ top, left });
    }

    place();
    window.addEventListener('resize', place);
    // `true` para capturar o scroll de qualquer container, não só o da janela.
    window.addEventListener('scroll', place, true);

    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, width, anchorRef]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      // O clique no gatilho é tratado por ele (toggle).
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // Impede que o Esc feche também o Modal que envolve o campo.
      event.stopImmediatePropagation();
      onClose();
    }

    document.addEventListener('mousedown', onPointerDown);
    // Fase de captura: roda antes do handler do Modal, que está no bubble.
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width,
      }}
      className="fixed z-[60] animate-fadeUp rounded-lg border border-border bg-surface p-3 shadow-lg"
    >
      {children}
    </div>,
    document.body,
  );
}
