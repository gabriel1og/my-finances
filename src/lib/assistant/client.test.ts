import { afterEach, describe, expect, it, vi } from 'vitest';
import { assistantJson, sendAssistantMessage } from './client';
const answer = {
  text: 'R$ 10,00',
  tables: [],
  sources: [],
  period: 'Outubro',
  consultedAt: '2026-10-07T00:00:00Z',
};
const submission = {
  conversationId: 'id',
  requestId: 'req',
  message: 'Quanto gastei?',
  selectedMonth: '2026-10-01',
};
class FakeFetch {
  constructor(private readonly response: Response) {}
  async fetch() {
    return this.response;
  }
}
afterEach(() => vi.unstubAllGlobals());
describe('assistant HTTP transport', () => {
  it('reads fragmented UTF-8 events and recovers a completed response', async () => {
    const payload = new TextEncoder().encode(
      JSON.stringify({ type: 'status', message: 'Consultando…' }) +
        '\n' +
        JSON.stringify({ type: 'done', answer }) +
        '\n',
    );
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < payload.length; i += 7) controller.enqueue(payload.slice(i, i + 7));
        controller.close();
      },
    });
    const fake = new FakeFetch(new Response(stream));
    vi.stubGlobal('fetch', fake.fetch.bind(fake));
    const statuses: string[] = [];
    expect(await sendAssistantMessage(submission, (status) => statuses.push(status))).toEqual(
      answer,
    );
    expect(statuses).toEqual(['Consultando…']);
  });
  it('reports quota/authentication/stream failures instead of parsing HTML', async () => {
    for (const [response, message] of [
      [
        new Response(JSON.stringify({ code: 'unauthorized', message: 'Sessão expirada' }), {
          status: 401,
        }),
        'Sessão expirada',
      ],
      [
        new Response(
          JSON.stringify({ type: 'error', code: 'quota', message: 'Limite diário' }) + '\n',
        ),
        'Limite diário',
      ],
      [new Response(''), 'interrompida'],
    ] as const) {
      const fake = new FakeFetch(response);
      vi.stubGlobal('fetch', fake.fetch.bind(fake));
      await expect(sendAssistantMessage(submission, () => undefined)).rejects.toThrow(message);
    }
  });
  it('handles empty DELETE responses and reads list responses', async () => {
    let fake = new FakeFetch(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fake.fetch.bind(fake));
    expect(
      await assistantJson('/api/assistant/conversations/id', { method: 'DELETE' }),
    ).toBeUndefined();
    fake = new FakeFetch(new Response('{"conversations":[]}'));
    vi.stubGlobal('fetch', fake.fetch.bind(fake));
    expect(await assistantJson('/api/assistant/conversations')).toEqual({ conversations: [] });
  });
});
