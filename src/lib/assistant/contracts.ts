export type AssistantTable = { title: string; columns: string[]; rows: string[][] };
export type AssistantSource = { label: string; href: string; period: string };
export type AssistantAnswer = {
  text: string;
  tables: AssistantTable[];
  sources: AssistantSource[];
  period: string;
  consultedAt: string;
};
export type AssistantConversation = { id: string; title: string; updated_at: string };
export type AssistantMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: unknown;
  created_at: string;
  requestId?: string;
  requestStatus?: string;
};
export type AssistantSubmission = {
  conversationId: string;
  requestId: string;
  message: string;
  selectedMonth: string;
};
export type AssistantEvent =
  | { type: 'status'; message: string }
  | { type: 'done'; answer: AssistantAnswer }
  | { type: 'error'; code: string; message: string };

export class AssistantError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Validates plain objects from HTTP/model output. Example: objectValue(JSON.parse(body)). */
export function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AssistantError('invalid_input', 'Esperado objeto JSON válido.');
  }
  return value as Record<string, unknown>;
}

/** UUID validation before using IDs in a query. Example: uuidValue(conversationId). */
export function uuidValue(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new AssistantError('invalid_input', 'Esperado identificador UUID válido.');
  }
  return value;
}

/** Checks actual calendar dates. Example: dateValue('2026-10-01'). */
export function dateValue(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < '1900-01-01' ||
    value > '9999-12-31'
  ) {
    throw new AssistantError('invalid_input', 'Esperada data no formato AAAA-MM-DD.');
  }
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AssistantError('invalid_input', `Data inválida: ${value}; esperada data existente.`);
  }
  return value;
}

/** Validates the request, independent of provider. Example: parseSubmission(await request.json()). */
export function parseSubmission(value: unknown): AssistantSubmission {
  const input = objectValue(value);
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!message || message.length > 4000)
    throw new AssistantError('invalid_input', 'A pergunta deve ter entre 1 e 4.000 caracteres.');
  const selectedMonth = dateValue(input.selectedMonth);
  if (!selectedMonth.endsWith('-01'))
    throw new AssistantError('invalid_input', 'O mês deve usar o primeiro dia, AAAA-MM-01.');
  return {
    conversationId: uuidValue(input.conversationId),
    requestId: uuidValue(input.requestId),
    message,
    selectedMonth,
  };
}

/** Validates display content; sources are attached by the server. Example: parseModelAnswer(json). */
export function parseModelAnswer(value: unknown): Pick<AssistantAnswer, 'text' | 'tables'> {
  const answer = objectValue(value);
  if (
    typeof answer.text !== 'string' ||
    !answer.text.trim() ||
    answer.text.length > 20000 ||
    !Array.isArray(answer.tables) ||
    answer.tables.length > 5
  ) {
    throw new AssistantError('invalid_response', 'A IA retornou uma resposta inválida.', 502);
  }
  const tables = answer.tables.map(parseTable);
  return { text: answer.text, tables };
}

function parseTable(value: unknown): AssistantTable {
  const table = objectValue(value);
  if (
    typeof table.title !== 'string' ||
    !Array.isArray(table.columns) ||
    !Array.isArray(table.rows) ||
    table.columns.length < 1 ||
    table.columns.length > 10 ||
    table.rows.length > 100
  ) {
    throw new AssistantError('invalid_response', 'A IA retornou uma tabela inválida.', 502);
  }
  if (
    !table.columns.every((cell) => typeof cell === 'string' && cell.length <= 200) ||
    !table.rows.every(
      (row) =>
        Array.isArray(row) &&
        row.length === (table.columns as unknown[]).length &&
        row.every((cell) => typeof cell === 'string' && cell.length <= 1000),
    )
  ) {
    throw new AssistantError('invalid_response', 'A IA retornou células inválidas.', 502);
  }
  return { title: table.title, columns: table.columns as string[], rows: table.rows as string[][] };
}

/** Validates persisted or streamed responses. Example: parseAnswer(event.answer). */
export function parseAnswer(value: unknown): AssistantAnswer {
  const answer = objectValue(value);
  const body = parseModelAnswer(answer);
  if (
    typeof answer.period !== 'string' ||
    typeof answer.consultedAt !== 'string' ||
    !Number.isFinite(Date.parse(answer.consultedAt)) ||
    !Array.isArray(answer.sources)
  ) {
    throw new AssistantError('invalid_response', 'Resposta armazenada inválida.', 502);
  }
  const sources = answer.sources.map((value) => {
    const source = objectValue(value);
    if (
      typeof source.label !== 'string' ||
      typeof source.period !== 'string' ||
      typeof source.href !== 'string' ||
      !/^\/(dashboard|transactions|accounts|cards|categories|reports|recurring|forecast|settings)(\?|$)/.test(
        source.href,
      )
    ) {
      throw new AssistantError('invalid_response', 'Fonte inválida.', 502);
    }
    return { label: source.label, period: source.period, href: source.href };
  });
  return { ...body, sources, period: answer.period, consultedAt: answer.consultedAt };
}
