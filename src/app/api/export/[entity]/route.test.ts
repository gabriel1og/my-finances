import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';

let supabase: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase.client) }));

const { GET } = await import('@/app/api/export/[entity]/route');

const request = {} as NextRequest;
const context = (entity: string) => ({ params: Promise.resolve({ entity }) });

beforeEach(() => {
  supabase = createSupabaseMock();
});

describe('GET /api/export/[entity]', () => {
  it('recusa entidade desconhecida com 404', async () => {
    const response = await GET(request, context('planilha'));
    expect(response.status).toBe(404);
  });

  it('recusa `transactions`, que tem handler próprio', async () => {
    // O segmento estático ganha do dinâmico no App Router; se esta rota
    // respondesse, o CSV sairia sem as colunas de transação.
    const response = await GET(request, context('transactions'));
    expect(response.status).toBe(404);
  });

  it('responde 401 sem sessão', async () => {
    supabase = createSupabaseMock({ user: null });
    const response = await GET(request, context('tags'));
    expect(response.status).toBe(401);
  });

  it('devolve CSV com BOM e nome de arquivo em português', async () => {
    supabase = createSupabaseMock({
      responses: { 'tags.select': { data: [{ id: 'tag-1', name: 'Viagem', color: '#22D3EE' }] } },
    });

    const response = await GET(request, context('tags'));
    // Nos bytes, não em `text()`: a decodificação UTF-8 do fetch remove o BOM
    // silenciosamente, e o teste passaria a medir o decodificador.
    const bytes = new Uint8Array(await response.clone().arrayBuffer());
    const body = await response.text();

    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('flowly-tags.csv');
    // O BOM é o que faz o Excel pt-BR abrir acentos corretamente.
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    expect(body).toContain('ID;Nome;Cor');
    expect(body).toContain('Viagem');
  });

  it('traduz enums e booleanos para leitura humana', async () => {
    supabase = createSupabaseMock({
      responses: {
        'accounts.select': {
          data: [
            {
              id: 'acc-1',
              name: 'Nubank',
              kind: 'checking',
              institution: null,
              opening_balance: 1500.5,
              color: '#5B6EF5',
              is_archived: true,
            },
          ],
        },
      },
    });

    const body = await (await GET(request, context('accounts'))).text();

    expect(body).toContain('Conta corrente');
    expect(body).toContain('Sim');
    // Decimal com vírgula: é o que o Excel pt-BR entende como número.
    expect(body).toContain('1500,50');
  });

  it('devolve 500 com a mensagem quando a consulta falha', async () => {
    supabase = createSupabaseMock({
      responses: { 'tags.select': { error: { message: 'permission denied' } } },
    });

    const response = await GET(request, context('tags'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'permission denied' });
  });
});
