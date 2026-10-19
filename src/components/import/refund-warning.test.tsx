import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import type { Account, CreditCard } from '@/types/database.types';

vi.mock('@/app/(app)/settings/import/actions', () => ({
  findDuplicates: vi.fn(async () => ({ error: null, duplicates: [] })),
  runImport: vi.fn(async () => ({
    error: null,
    outcome: {
      transactions: 1,
      transfers: 0,
      created: { accounts: 0, cards: 0, categories: 0, tags: 0 },
      firstMonth: '2026-10-01',
      warnings: ['Linha 2: compra relacionada não encontrada; estorno importado sem vínculo.'],
    },
  })),
}));
vi.mock('@/components/import/ImportDropzone', () => ({
  ImportDropzone: ({ onFile }: { onFile: (file: File) => void }) => (
    <button
      onClick={() => {
        const file = new File([''], 'refund.csv');
        Object.defineProperty(file, 'text', {
          value: async () =>
            'Data;Descrição;Tipo;Valor;Categoria;Conta/Cartão;Forma;Natureza;Mês da fatura\n2026-10-19;Estorno;Receita;150,00;;Visa;Crédito;Estorno no cartão;2026-09',
        });
        onFile(file);
      }}
    >
      Carregar CSV
    </button>
  ),
}));
const { ImportWizard } = await import('./ImportWizard');

describe('aviso após importar estorno', () => {
  it('mostra na conclusão que a referência não foi recuperada', async () => {
    const { user } = renderWithProviders(
      <ImportWizard
        accounts={[{ id: 'account', name: 'Conta' }] as Account[]}
        cards={[{ id: 'card', name: 'Visa' }] as CreditCard[]}
        categories={[]}
        tags={[]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Carregar CSV' }));
    await user.click(await screen.findByRole('button', { name: 'Importar 1 linha(s)' }));
    expect(await screen.findByRole('status')).toHaveTextContent('estorno importado sem vínculo');
  });
});
