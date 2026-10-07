import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/render';
import { waitFor } from '@testing-library/react';
import type { CardStatement, CreditCard, TransactionWithCategory } from '@/types/database.types';
import type { StatementPreview } from '@/lib/statement-adjustments';

const { previewChange, applyChange, refresh } = vi.hoisted(() => ({
  previewChange: vi.fn(),
  applyChange: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/app/(app)/cards/statement-actions', () => ({
  previewStatementChange: previewChange,
  applyStatementChange: applyChange,
}));
const { StatementAdjustmentModal } = await import('./StatementAdjustmentModal');
const card = { id: 'card', closing_day: 20, due_day: 5 } as CreditCard;
const statement = {
  statement_id: 'cycle',
  card_id: 'card',
  statement_month: '2026-10-01',
  period_start: '2026-09-20',
  closing_date: '2026-10-20',
  due_date: '2026-11-05',
  total: 100,
  paid: 20,
  open_amount: 80,
} as CardStatement;
const preview: StatementPreview = {
  fingerprint: 'a'.repeat(32),
  before: { cycles: [statement], transactions: [] },
  after: {
    cycles: [{ ...statement, due_date: '2026-12-05', is_adjusted: true }],
    transactions: [],
  },
};
const transactions = [
  { id: 'tx', description: 'Compra (2/3)', date: '2026-10-10' },
] as TransactionWithCategory[];

beforeEach(() => {
  vi.clearAllMocks();
  previewChange.mockResolvedValue({ error: null, preview });
  applyChange.mockResolvedValue({ error: null, preview });
});

async function openReview() {
  const rendered = renderWithProviders(
    <StatementAdjustmentModal card={card} statement={statement} transactions={transactions} />,
  );
  await rendered.user.click(screen.getByRole('button', { name: 'Ajustar fatura' }));
  await rendered.user.clear(screen.getByLabelText('Novo vencimento'));
  await rendered.user.type(screen.getByLabelText('Novo vencimento'), '05/12/2026');
  await rendered.user.type(screen.getByLabelText('Motivo do ajuste'), 'Banco adiou');
  await rendered.user.click(screen.getByRole('button', { name: 'Revisar ajuste' }));
  await screen.findByRole('button', { name: 'Confirmar ajuste' });
  return rendered;
}

describe('statement adjustment modal', () => {
  it('mostra impacto e exige confirmação antes de aplicar', async () => {
    const { user } = await openReview();
    expect(applyChange).not.toHaveBeenCalled();
    const review = screen.getByRole('region', { name: 'Prévia do ajuste' });
    expect(within(review).getByText('Impacto na previsão mensal')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar ajuste' }));
    expect(applyChange).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'due', dueDate: '2026-12-05', reason: 'Banco adiou' }),
      preview.fingerprint,
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
  it('editar a proposta invalida a prévia e pede revisão novamente', async () => {
    const { user } = await openReview();
    await user.type(screen.getByLabelText('Motivo do ajuste'), ' novamente');
    expect(screen.queryByRole('button', { name: 'Confirmar ajuste' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revisar ajuste' })).toBeInTheDocument();
    expect(applyChange).not.toHaveBeenCalled();
  });
  it('erro de concorrência mantém o diálogo e remove confirmação antiga', async () => {
    const { user } = await openReview();
    applyChange.mockResolvedValueOnce({ error: 'A fatura mudou desde a prévia.', preview: null });
    await user.click(screen.getByRole('button', { name: 'Confirmar ajuste' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('mudou');
    expect(screen.getByRole('button', { name: 'Revisar ajuste' })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
  it('permite selecionar uma parcela sem selecionar outras compras', async () => {
    const { user } = renderWithProviders(
      <StatementAdjustmentModal card={card} statement={statement} transactions={transactions} />,
    );
    await user.click(screen.getByRole('button', { name: 'Ajustar fatura' }));
    await user.selectOptions(screen.getByLabelText('Tipo de ajuste'), 'move');
    await user.click(screen.getByRole('checkbox', { name: /Compra \(2\/3\)/ }));
    await user.type(screen.getByLabelText('Motivo do ajuste'), 'Processamento pelo banco');
    await user.click(screen.getByRole('button', { name: 'Revisar ajuste' }));
    expect(previewChange).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'move',
        transactionIds: ['tx'],
        targetMonth: '2026-11-01',
      }),
    );
  });
});
