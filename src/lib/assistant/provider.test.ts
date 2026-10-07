import { describe, expect, it } from 'vitest';
import type { Response, ResponseInputItem } from 'openai/resources/responses/responses';
import { runAssistant, OpenAIAssistantProvider, type AssistantProvider } from './provider';
import type { FinancialResult } from './tools';

const args = {
  domain: 'totals',
  start: '2026-10-01',
  end: '2026-10-31',
  categoryId: null,
  accountId: null,
  cardId: null,
  tagId: null,
  search: null,
  page: 1,
};
function response(output: unknown[], text = ''): Response {
  return { status: 'completed', output, output_text: text } as Response;
}
function tool(name = 'query_finances') {
  return {
    type: 'function_call',
    id: 'fc_1',
    call_id: 'call_1',
    name,
    arguments: JSON.stringify(args),
  };
}
class FakeProvider implements AssistantProvider {
  inputs: ResponseInputItem[][] = [];
  finalOnly: boolean[] = [];
  constructor(private readonly responses: Response[]) {}
  async respond(input: ResponseInputItem[], final: boolean) {
    this.inputs.push([...input]);
    this.finalOnly.push(final);
    const next = this.responses.shift();
    if (!next) throw new Error('Fake response exhausted');
    return next;
  }
}
class FakeFinancialReader {
  calls = 0;
  async query(): Promise<FinancialResult> {
    this.calls++;
    return {
      result: { expense: 10 },
      source: {
        label: 'Transações',
        href: '/transactions?month=2026-10-01',
        period: '2026-10-01 a 2026-10-31',
      },
    };
  }
}

describe('assistant tool orchestration', () => {
  it('passes fresh tool evidence and server sources into a validated answer', async () => {
    const provider = new FakeProvider([
      response([tool()]),
      response([], JSON.stringify({ text: 'R$ 10,00', tables: [] })),
    ]);
    const reader = new FakeFinancialReader();
    const answer = await runAssistant(
      { provider, query: reader.query.bind(reader) },
      [{ id: 1, role: 'user', content: { text: 'Quanto gastei?' }, created_at: '' }],
      '2026-10-01',
      new AbortController().signal,
      () => undefined,
    );
    expect(reader.calls).toBe(1);
    expect(provider.inputs[1]).toContainEqual(
      expect.objectContaining({
        type: 'function_call_output',
        output: expect.stringContaining('"expense":10'),
      }),
    );
    expect(answer.sources[0].href).toBe('/transactions?month=2026-10-01');
    expect(answer.period).toBe('2026-10-01 a 2026-10-31');
    expect(Date.parse(answer.consultedAt)).not.toBeNaN();
  });
  it('blocks unsupported tools and stops after eight calls', async () => {
    const reader = new FakeFinancialReader();
    await expect(
      runAssistant(
        {
          provider: new FakeProvider([response([tool('execute_sql')])]),
          query: reader.query.bind(reader),
        },
        [],
        '2026-10-01',
        new AbortController().signal,
        () => undefined,
      ),
    ).rejects.toThrow('muitas consultas');
    expect(reader.calls).toBe(0);
    const provider = new FakeProvider(Array.from({ length: 9 }, () => response([tool()])));
    await expect(
      runAssistant(
        { provider, query: reader.query.bind(reader) },
        [],
        '2026-10-01',
        new AbortController().signal,
        () => undefined,
      ),
    ).rejects.toThrow();
    expect(reader.calls).toBe(8);
    expect(provider.finalOnly[8]).toBe(true);
  });
  it('propagates timeout and rejects malformed or incomplete answers', async () => {
    const reader = new FakeFinancialReader();
    for (const next of [
      response([], '{bad'),
      { ...response([], '{}'), status: 'incomplete' } as Response,
    ])
      await expect(
        runAssistant(
          { provider: new FakeProvider([next]), query: reader.query.bind(reader) },
          [],
          '2026-10-01',
          new AbortController().signal,
          () => undefined,
        ),
      ).rejects.toThrow();
    const controller = new AbortController();
    controller.abort();
    await expect(
      runAssistant(
        { provider: new FakeProvider([]), query: reader.query.bind(reader) },
        [],
        '2026-10-01',
        controller.signal,
        () => undefined,
      ),
    ).rejects.toThrow();
  });
  it('does not expose secrets when OpenAI is not configured', () => {
    const prior = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      expect(() => new OpenAIAssistantProvider('BRL')).toThrow('não foi configurado');
    } finally {
      if (prior !== undefined) process.env.OPENAI_API_KEY = prior;
    }
  });
});
