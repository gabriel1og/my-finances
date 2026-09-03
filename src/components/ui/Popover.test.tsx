import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { Popover } from '@/components/ui/Popover';

/**
 * jsdom não faz layout: todo getBoundingClientRect devolve zeros. Para testar
 * o posicionamento é preciso ditar o retângulo da âncora — é o único jeito de
 * verificar o clamp, que é justamente a regra que já falhou na prática.
 */
function anchorAt(rect: Partial<DOMRect>) {
  return () =>
    ({
      top: 100,
      bottom: 130,
      left: 0,
      right: 0,
      width: 0,
      height: 30,
      x: 0,
      y: 100,
      toJSON: () => ({}),
      ...rect,
    }) as DOMRect;
}

function Harness({
  align = 'left',
  width = 232,
  rect,
  onClose = vi.fn(),
  open = true,
}: {
  align?: 'left' | 'center' | 'right';
  width?: number;
  rect?: Partial<DOMRect>;
  onClose?: () => void;
  open?: boolean;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);

  // O retângulo é aplicado no callback do ref, e não no corpo do render: o
  // Popover mede a âncora num useLayoutEffect, que roda depois dos refs — se
  // a substituição viesse num render seguinte, o cálculo já teria acontecido
  // com os zeros do jsdom.
  const attach = (node: HTMLButtonElement | null) => {
    if (node && rect) node.getBoundingClientRect = anchorAt(rect);
    anchorRef.current = node;
  };

  return (
    <div>
      <button ref={attach}>Âncora</button>
      <Popover
        open={open}
        onClose={onClose}
        anchorRef={anchorRef}
        label="Escolher mês"
        align={align}
        width={width}
      >
        <button>Mês atual</button>
      </Popover>
    </div>
  );
}

function panel() {
  return screen.getByRole('dialog', { name: 'Escolher mês' });
}

describe('Popover — renderização', () => {
  it('não renderiza fechado', () => {
    renderWithProviders(<Harness open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renderiza em portal, fora da árvore do gatilho', () => {
    renderWithProviders(<Harness />);

    // Como filho do gatilho, ele seria recortado pelo `overflow-y-auto` do
    // Modal e pela largura da sidebar recolhida.
    expect(panel().parentElement).toBe(document.body);
    expect(panel()).toHaveClass('fixed');
  });
});

describe('Popover — posicionamento', () => {
  it('prende o painel à margem quando a âncora está colada na borda direita', () => {
    // Janela de 1024px no jsdom; âncora a 1010 pediria left ≈ 1010.
    window.innerWidth = 1024;
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 1024,
      configurable: true,
    });

    renderWithProviders(<Harness rect={{ left: 1010, right: 1020, width: 10 }} />);
    fireEvent.resize(window);

    const left = Number.parseFloat(panel().style.left);
    // 1024 − 232 − 16 = 776: encostou na margem em vez de sair da tela.
    expect(left).toBeLessThanOrEqual(776);
    expect(left).toBeGreaterThanOrEqual(0);
  });

  it('centra no meio da âncora quando align=center e há espaço', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 1024,
      configurable: true,
    });

    renderWithProviders(<Harness align="center" rect={{ left: 400, right: 500, width: 100 }} />);
    fireEvent.resize(window);

    // 400 + 100/2 − 232/2 = 334.
    expect(Number.parseFloat(panel().style.left)).toBe(334);
  });

  it('abre para cima quando não cabe abaixo', () => {
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: 200,
      configurable: true,
    });

    renderWithProviders(<Harness rect={{ top: 150, bottom: 180 }} />);
    fireEvent.resize(window);

    // Abaixo não cabe (180 + margem + altura > 200), então sobe.
    expect(Number.parseFloat(panel().style.top)).toBeLessThan(180);
  });
});

describe('Popover — fechamento', () => {
  it('fecha no Esc', () => {
    const onClose = vi.fn();
    renderWithProviders(<Harness onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('impede que o Esc chegue ao Modal que envolve o campo', () => {
    const onModalEscape = vi.fn();
    document.addEventListener('keydown', onModalEscape);

    renderWithProviders(<Harness />);
    fireEvent.keyDown(document, { key: 'Escape' });

    // O listener do popover roda em captura com stopImmediatePropagation:
    // sem isso, fechar o calendário fecharia o formulário junto.
    expect(onModalEscape).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onModalEscape);
  });

  it('fecha no clique fora, e não no clique dentro do painel', () => {
    const onClose = vi.fn();
    renderWithProviders(<Harness onClose={onClose} />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Mês atual' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('não fecha ao clicar no próprio gatilho — quem alterna é ele', () => {
    const onClose = vi.fn();
    renderWithProviders(<Harness onClose={onClose} />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Âncora' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
