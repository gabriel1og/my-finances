import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock } from '@/test/supabaseMock';
import type { AssistantDatabase } from '@/lib/assistant/tools';
import { AssistantError } from '@/lib/assistant/contracts';

let database: FakeAssistantDatabase;
let runFailure = false;
const answer = {
  text: 'R$ 10,00',
  tables: [],
  sources: [],
  period: 'Outubro',
  consultedAt: '2026-10-07T00:00:00Z',
};
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => database.client }));
vi.mock('@/lib/assistant/provider', () => ({
  OpenAIAssistantProvider: class FakeConfiguredProvider {},
  runAssistant: async () => {
    if (runFailure) throw new AssistantError('provider_failed', 'API indisponível', 503);
    return answer;
  },
}));
const { GET: listConversations, POST: createConversation } = await import('./conversations/route');
const { GET: getConversation, DELETE: deleteConversation } =
  await import('./conversations/[id]/route');
const { POST: sendMessage } = await import('./messages/route');
const { assistantRequestJson, safeAssistantError } = await import('@/lib/assistant/http');
const id = '11111111-1111-4111-8111-111111111111';
const lease = '22222222-2222-4222-8222-222222222222';
const body = {
  conversationId: id,
  requestId: id,
  message: 'Quanto gastei?',
  selectedMonth: '2026-10-01',
};

class FakeAssistantDatabase {
  readonly supabase = createSupabaseMock({
    responses: {
      'profiles.select': { data: { currency: 'BRL' } },
      'assistant_messages.select': { data: [] },
      'assistant_conversations.select': { data: { id, title: 'Conversa', updated_at: '' } },
    },
  });
  rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  reservation: unknown = { status: 'reserved', leaseId: lease };
  finishSuccess = true;
  client = {
    auth: this.supabase.client.auth,
    from: (table: string) => {
      const builder = this.supabase.client.from(table);
      Object.assign(builder, { abortSignal: () => builder });
      return builder;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      this.rpcCalls.push({ name, args });
      return {
        data:
          name === 'assistant_reserve'
            ? this.reservation
            : name === 'assistant_delete'
              ? 'deleted'
              : this.finishSuccess,
        error: null,
      };
    },
  } as unknown as AssistantDatabase;
}
function request(
  path: string,
  method = 'POST',
  payload: unknown = body,
  origin = 'http://localhost',
) {
  return new Request(`http://localhost/api/assistant/${path}`, {
    method,
    headers: { origin, 'Content-Type': 'application/json' },
    body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(payload),
  });
}
beforeEach(() => {
  database = new FakeAssistantDatabase();
  runFailure = false;
});
afterEach(() => vi.restoreAllMocks());

describe('assistant routes', () => {
  it('rejects cross-origin mutations and expired authentication', async () => {
    expect(
      (
        await createConversation(
          request('conversations', 'POST', { title: 'Test' }, 'https://attacker.example'),
        )
      ).status,
    ).toBe(403);
    database.supabase.client.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const response = await listConversations(request('conversations', 'GET'));
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('scopes history/deletion to the session owner and hides foreign conversations', async () => {
    await getConversation(request(`conversations/${id}`, 'GET'), {
      params: Promise.resolve({ id }),
    });
    expect(database.supabase.callsTo('assistant_conversations')[0].filters).toContainEqual({
      kind: 'eq',
      column: 'user_id',
      value: 'user-1',
    });
    expect(database.supabase.callsTo('assistant_messages')[0].filters).toContainEqual({
      kind: 'eq',
      column: 'user_id',
      value: 'user-1',
    });
    await deleteConversation(request(`conversations/${id}`, 'DELETE'), {
      params: Promise.resolve({ id }),
    });
    expect(database.rpcCalls.at(-1)).toEqual({
      name: 'assistant_delete',
      args: { p_conversation_id: id },
    });
    database.client.from = () => {
      const fake = createSupabaseMock({
        responses: { 'assistant_conversations.select': { data: null } },
      });
      return fake.client.from('assistant_conversations') as never;
    };
    expect(
      (
        await getConversation(request(`conversations/${id}`, 'GET'), {
          params: Promise.resolve({ id }),
        })
      ).status,
    ).toBe(404);
  });
  it('returns quota/busy/conflict before calling a model and recovers completed requests', async () => {
    for (const [status, code] of [
      ['quota', 429],
      ['busy', 409],
      ['conflict', 409],
      ['not_found', 404],
    ] as const) {
      database.reservation = { status };
      expect((await sendMessage(request('messages'))).status).toBe(code);
    }
    database.reservation = { status: 'completed', response: answer };
    const response = await sendMessage(request('messages'));
    expect(await response.text()).toContain('"type":"done"');
    expect(database.rpcCalls.filter((call) => call.name === 'assistant_finish')).toHaveLength(0);
  });
  it('persists before returning success and releases quota on failure', async () => {
    let response = await sendMessage(request('messages'));
    expect(await response.text()).toContain('"type":"done"');
    expect(database.rpcCalls.at(-1)?.args.p_response).toEqual(answer);
    runFailure = true;
    response = await sendMessage(request('messages'));
    expect(await response.text()).toContain('"type":"error"');
    expect(database.rpcCalls.at(-1)?.args.p_response).toBeNull();
    expect(database.rpcCalls.at(-1)?.args.p_lease_id).toBe(lease);
  });
  it('does not present an unsaved answer as completed', async () => {
    database.finishSuccess = false;
    const response = await sendMessage(request('messages'));
    expect(await response.text()).toContain('persistence_error');
    expect(database.rpcCalls.at(-1)?.args.p_response).toBeNull();
  });
  it('bounds chunked JSON bodies and sanitizes technical errors', async () => {
    await expect(
      assistantRequestJson(
        new Request('http://localhost', { method: 'POST', body: 'a'.repeat(20001) }),
      ),
    ).rejects.toThrow('20 KB');
    await expect(
      assistantRequestJson(new Request('http://localhost', { method: 'POST', body: '{bad' })),
    ).rejects.toThrow('JSON válido');
    expect(safeAssistantError(new Error('secret-api-key')).message).not.toContain('secret');
    expect(safeAssistantError(new DOMException('timeout', 'TimeoutError')).code).toBe('timeout');
  });
});
