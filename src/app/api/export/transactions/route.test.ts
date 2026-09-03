import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';

let supabase: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase.client) }));

const { GET } = await import('@/app/api/export/transactions/route');

const request = (search: string) =>
  ({ nextUrl: new URL(`http://localhost/api/export/transactions${search}`) }) as NextRequest;

function withTransactions(rows: Array<Record<string, unknown>>) {
  return createSupabaseMock({ responses: { 'transactions.select': { data: rows } } });
}

const base = {
  id: 't-1',
  date: '2026-09-10',
  description: 'Mercado',
  type: 'expense',
  amount: 150.4,
  category: { id: 'cat-1', name: 'Alimentação', color: '#5B6EF5' },
  account: { id: 'acc-1', name: 'Nubank', color: '#5B6EF5' },
  card: null,
  paid_card: null,
  payment_method: 'debit',
  tags: [],
  is_transfer: false,
  is_card_payment: false,
  notes: null,
};

beforeEach(() => {
  supabase = withTransactions([base]);
});

describe('GET /api/export/transactions', () => {
  it('responde 401 sem sessão', async () => {
    supabase = createSupabaseMock({ user: null });
    expect((await GET(request('?month=2026-09-01'))).status).toBe(401);
  });

  it('filtra pelo mês pedido', async () => {
    await GET(request('?month=2026-09-01'));

    const [call] = supabase.callsTo('transactions', 'select');
    expect(call.filters).toEqual([
      { kind: 'gte', column: 'date', value: '2026-09-01' },
      { kind: 'lte', column: 'date', value: '2026-09-30' },
    ]);
  });

  it('com scope=all, exporta sem recorte de data', async () => {
    await GET(request('?scope=all'));

    const [call] = supabase.callsTo('transactions', 'select');
    expect(call.filters).toEqual([]);
  });

  it('nomeia o arquivo pelo recorte', async () => {
    const month = await GET(request('?month=2026-09-01'));
    expect(month.headers.get('Content-Disposition')).toContain('flowly-transacoes-2026-09.csv');

    const all = await GET(request('?scope=all'));
    expect(all.headers.get('Content-Disposition')).toContain('flowly-transacoes-completo.csv');
  });

  it('escreve valor com vírgula e traduz tipo e forma', async () => {
    const body = await (await GET(request('?month=2026-09-01'))).text();

    expect(body).toContain('150,40');
    expect(body).toContain('Despesa');
    expect(body).toContain('Débito');
    expect(body).toContain('Alimentação');
  });

  it('diz a natureza da linha — é o que evita somar duas vezes ao reimportar', async () => {
    supabase = withTransactions([
      { ...base, is_transfer: true },
      {
        ...base,
        id: 't-2',
        is_card_payment: true,
        paid_card: { id: 'card-1', name: 'Nubank Card' },
        card_payment_month: '2026-08-01',
      },
      base,
    ]);

    const body = await (await GET(request('?scope=all'))).text();

    expect(body).toContain('Transferência');
    expect(body).toContain('Pagamento de fatura');
    expect(body).toContain('Lançamento');
    // O pagamento carrega qual cartão e qual fatura foram quitados.
    expect(body).toContain('Nubank Card');
    expect(body).toContain('2026-08');
  });

  it('junta as tags numa coluna só', async () => {
    supabase = withTransactions([
      {
        ...base,
        tags: [
          { id: 'tag-1', name: 'Viagem', color: '#22D3EE' },
          { id: 'tag-2', name: 'Casa', color: '#2ECC9A' },
        ],
      },
    ]);

    const body = await (await GET(request('?scope=all'))).text();
    expect(body).toContain('Viagem, Casa');
  });

  it('mostra a parcela quando existe', async () => {
    supabase = withTransactions([{ ...base, installment_no: 2, installment_total: 6 }]);

    const body = await (await GET(request('?scope=all'))).text();
    expect(body).toContain('2/6');
  });

  it('devolve 500 com a mensagem quando a consulta falha', async () => {
    supabase = createSupabaseMock({
      responses: { 'transactions.select': { error: { message: 'permission denied' } } },
    });

    const response = await GET(request('?scope=all'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'permission denied' });
  });
});
