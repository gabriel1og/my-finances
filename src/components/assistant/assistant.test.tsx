import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import { AssistantChat } from './AssistantChat';
import { AssistantResponse } from './AssistantResponse';
import type { AssistantAnswer } from '@/lib/assistant/contracts';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('month=2026-10-01'),
}));
const id = '11111111-1111-4111-8111-111111111111';
const answer: AssistantAnswer = {
  text: 'Total: R$ 10,00',
  tables: [
    { title: 'Gastos', columns: ['Categoria', 'Valor'], rows: [['Alimentação', 'R$ 10,00']] },
  ],
  sources: [
    {
      label: 'Transações',
      href: '/transactions?month=2026-10-01',
      period: '2026-10-01 a 2026-10-31',
    },
  ],
  period: 'Outubro',
  consultedAt: '2026-10-07T00:00:00Z',
};
class FakeAssistantApi {
  submissions: Record<string, unknown>[] = [];
  createCount = 0;
  async fetch(url: string, options?: RequestInit) {
    if (url === '/api/assistant/messages') {
      this.submissions.push(JSON.parse(String(options?.body)));
      const event =
        this.submissions.length === 1
          ? { type: 'error', code: 'provider_failed', message: 'Falha temporária.' }
          : { type: 'done', answer };
      return new Response(JSON.stringify(event) + '\n');
    }
    if (url === '/api/assistant/conversations' && options?.method === 'POST') {
      this.createCount++;
      return new Response(JSON.stringify({ id, title: 'Pergunta', updated_at: '' }));
    }
    if (url.startsWith(`/api/assistant/conversations/${id}`))
      return new Response(
        JSON.stringify({
          conversation: { id, title: 'Pergunta' },
          messages: [
            { id: 1, role: 'user', content: { text: 'Quanto gastei?' }, created_at: '' },
            { id: 2, role: 'assistant', content: answer, created_at: '' },
          ],
          hasMore: false,
        }),
      );
    return new Response(
      JSON.stringify({
        conversations: this.createCount ? [{ id, title: 'Pergunta', updated_at: '' }] : [],
        hasMore: false,
      }),
    );
  }
}
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());
describe('assistant interface', () => {
  it('shows accessible tables, timestamp and internal sources, and copies plain text', async () => {
    const { user } = renderWithProviders(<AssistantResponse answer={answer} />);
    expect(screen.getByRole('table', { name: 'Gastos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Transações' })).toHaveAttribute(
      'href',
      '/transactions?month=2026-10-01',
    );
    expect(screen.getByText(/Consultado em/)).toHaveClass('font-mono');
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: 'Copiar resposta' }));
    expect(copy).toHaveBeenCalledWith(expect.stringContaining('Alimentação\tR$ 10,00'));
    expect(screen.getByRole('status')).toHaveTextContent('Resposta copiada');
  });
  it('preserves the draft and same request ID after failure, then loads the saved answer', async () => {
    const fake = new FakeAssistantApi();
    vi.stubGlobal('fetch', fake.fetch.bind(fake));
    const { user } = renderWithProviders(<AssistantChat />);
    const input = screen.getByRole('textbox', { name: 'Sua pergunta' });
    await user.type(input, 'Quanto gastei?');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Falha temporária.');
    expect(input).toHaveValue('Quanto gastei?');
    await user.click(screen.getByRole('button', { name: 'Repetir solicitação' }));
    await screen.findByText('Total: R$ 10,00');
    await waitFor(() => expect(input).toHaveValue(''));
    expect(fake.submissions).toHaveLength(2);
    expect(fake.submissions[0].requestId).toBe(fake.submissions[1].requestId);
    expect(fake.submissions[0].selectedMonth).toBe('2026-10-01');
    expect(fake.createCount).toBe(1);
  });
  it('offers suggestions and supports a new conversation without losing saved history', async () => {
    const fake = new FakeAssistantApi();
    vi.stubGlobal('fetch', fake.fetch.bind(fake));
    const { user } = renderWithProviders(<AssistantChat />);
    await user.click(
      screen.getByRole('button', { name: 'Quais categorias ultrapassaram o orçamento?' }),
    );
    expect(screen.getByRole('textbox')).toHaveValue('Quais categorias ultrapassaram o orçamento?');
    await user.click(screen.getByRole('button', { name: 'Nova conversa' }));
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });
});
