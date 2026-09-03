import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';

const createTag = vi.fn(async () => ({
  error: null as string | null,
  id: 'tag-novo' as string | undefined,
}));
vi.mock('@/app/(app)/tags/actions', () => ({
  createTag: (...args: unknown[]) => createTag(...(args as [])),
}));

const { TagPicker } = await import('@/components/ui/TagPicker');

const tags = [
  { id: 'tag-1', name: 'Viagem', color: '#22D3EE' },
  { id: 'tag-2', name: 'Casa', color: '#2ECC9A' },
] as Parameters<typeof TagPicker>[0]['tags'];

function Harness({ initial = [] as string[] }) {
  const [selected, setSelected] = useState(initial);
  return <TagPicker tags={tags} selected={selected} onChange={setSelected} />;
}

const search = () => screen.getByPlaceholderText(/Buscar ou criar/);

describe('TagPicker — seleção', () => {
  it('sugere as tags existentes', () => {
    renderWithProviders(<Harness />);

    expect(screen.getByRole('button', { name: /Viagem/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();
  });

  it('escolher move a tag para os selecionados e limpa a busca', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.type(search(), 'via');
    await user.click(screen.getByRole('button', { name: /Viagem/ }));

    expect(search()).toHaveValue('');
    // Já escolhida, sai das sugestões: escolher duas vezes não faz sentido.
    expect(screen.queryByRole('button', { name: /^Viagem$/ })).not.toBeInTheDocument();
  });

  it('remover devolve a tag para as sugestões', async () => {
    const { user } = renderWithProviders(<Harness initial={['tag-1']} />);

    await user.click(screen.getByRole('button', { name: /Remover|Viagem/ }));
    expect(screen.getByRole('button', { name: /Viagem/ })).toBeInTheDocument();
  });

  it('filtra por trecho do nome, sem diferenciar maiúsculas', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.type(search(), 'CAS');
    expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Viagem/ })).not.toBeInTheDocument();
  });
});

describe('TagPicker — criação no fluxo', () => {
  it('oferece criar quando o termo não existe', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.type(search(), 'Pets');
    expect(screen.getByRole('button', { name: 'Criar "Pets"' })).toBeInTheDocument();
  });

  it('não oferece criar quando já existe tag com o nome exato', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.type(search(), 'viagem');
    expect(screen.queryByRole('button', { name: /Criar/ })).not.toBeInTheDocument();
  });

  it('criar chama a action e já marca a tag nova', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.type(search(), 'Pets');
    await user.click(screen.getByRole('button', { name: 'Criar "Pets"' }));

    expect(createTag).toHaveBeenCalledWith({ name: 'Pets', color: expect.any(String) });
  });

  it('mostra o erro da action sem perder o que foi digitado', async () => {
    createTag.mockResolvedValueOnce({ error: 'Já existe uma tag com esse nome.', id: undefined });
    const { user } = renderWithProviders(<Harness />);

    await user.type(search(), 'Pets');
    await user.click(screen.getByRole('button', { name: 'Criar "Pets"' }));

    expect(await screen.findByText('Já existe uma tag com esse nome.')).toBeInTheDocument();
    expect(search()).toHaveValue('Pets');
  });

  it('Enter escolhe a primeira sugestão em vez de submeter o formulário', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const { user } = renderWithProviders(
      <form onSubmit={onSubmit}>
        <Harness />
      </form>,
    );

    await user.type(search(), 'via{Enter}');

    // Dentro do modal de lançamento, um Enter distraído salvaria a transação
    // pela metade.
    expect(onSubmit).not.toHaveBeenCalled();
    expect(search()).toHaveValue('');
  });
});
