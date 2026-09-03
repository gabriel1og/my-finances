import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { Modal, ModalTrigger } from '@/components/ui/Modal';

function Harness({
  onClose = vi.fn(),
  initiallyOpen = true,
}: {
  onClose?: () => void;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        title="Novo lançamento"
      >
        <input aria-label="Descrição" />
        <button>Salvar</button>
      </Modal>
    </>
  );
}

describe('Modal — semântica', () => {
  it('é um diálogo modal rotulado pelo próprio título', () => {
    renderWithProviders(<Harness />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Novo lançamento');
  });

  it('não renderiza nada quando fechado', () => {
    renderWithProviders(
      <Modal open={false} onClose={vi.fn()} title="Oculto">
        <p>conteúdo</p>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Modal — foco', () => {
  it('foca o primeiro campo de digitação, não o botão de fechar', () => {
    renderWithProviders(<Harness />);

    // Quem abre um modal quer digitar; começar o foco no "×" faria a primeira
    // tecla fechar o formulário.
    expect(screen.getByLabelText('Descrição')).toHaveFocus();
  });

  it('devolve o foco ao gatilho quando fecha', async () => {
    const { user } = renderWithProviders(<Harness initiallyOpen={false} />);

    // Abrir pelo clique é o caminho real: o modal guarda quem estava em foco
    // no momento da abertura, e é para lá que o foco volta.
    const trigger = screen.getByRole('button', { name: 'Abrir' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(trigger).toHaveFocus();
  });

  // Com `fireEvent`, e não `user.tab()`: o user-event emula a navegação por
  // Tab por conta própria e ignora o `preventDefault` do nosso handler, então
  // mediria o comportamento dele, não o do componente.
  it('do último elemento, o Tab volta ao primeiro', () => {
    renderWithProviders(<Harness />);

    const close = screen.getByRole('button', { name: 'Fechar' });
    const save = screen.getByRole('button', { name: 'Salvar' });

    save.focus();
    fireEvent.keyDown(save, { key: 'Tab' });

    expect(close).toHaveFocus();
  });

  it('do primeiro elemento, o Shift+Tab vai ao último', () => {
    renderWithProviders(<Harness />);

    const close = screen.getByRole('button', { name: 'Fechar' });
    const save = screen.getByRole('button', { name: 'Salvar' });

    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });

    // Sem o ciclo, o Shift+Tab levaria o foco para a página atrás do modal.
    expect(save).toHaveFocus();
  });

  it('trava o scroll do fundo enquanto aberto e devolve ao fechar', async () => {
    const { user } = renderWithProviders(<Harness />);
    expect(document.body.style.overflow).toBe('hidden');

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('Modal — fechamento', () => {
  it('fecha no Esc', async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(<Harness onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fecha no clique no fundo, mas não no clique dentro do painel', async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(<Harness onClose={onClose} />);

    await user.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ModalTrigger', () => {
  it('usa o gatilho recebido, sem aninhar interativos', async () => {
    const onOpen = vi.fn();
    const { user } = renderWithProviders(
      <ModalTrigger
        trigger={<button>Editar</button>}
        onOpen={onOpen}
        fallback={<button>Novo</button>}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Novo' })).not.toBeInTheDocument();
  });

  it('cai no fallback quando nenhum gatilho é passado', async () => {
    const onOpen = vi.fn();
    const { user } = renderWithProviders(
      <ModalTrigger onOpen={onOpen} fallback={<button>Novo</button>} />,
    );

    await user.click(screen.getByRole('button', { name: 'Novo' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('Modal dentro de Modal — regressão', () => {
  it('mantém o foco no campo enquanto o usuário digita', async () => {
    function Typing() {
      const [value, setValue] = useState('');
      const ref = useRef<HTMLInputElement>(null);
      return (
        <Modal open onClose={vi.fn()} title="Digitação">
          <input
            ref={ref}
            aria-label="Descrição"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <input aria-label="Valor" />
        </Modal>
      );
    }

    const { user } = renderWithProviders(<Typing />);
    const field = screen.getByLabelText('Valor');
    field.focus();
    await user.keyboard('abc');

    // O efeito de foco só depende de `open`: se dependesse de `onClose`, cada
    // tecla jogaria o cursor de volta para o primeiro campo.
    expect(field).toHaveFocus();
  });
});
