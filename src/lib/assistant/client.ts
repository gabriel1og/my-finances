import {
  AssistantError,
  objectValue,
  parseAnswer,
  type AssistantAnswer,
  type AssistantSubmission,
} from './contracts';

/** Browser JSON transport with explicit auth errors. Example: assistantJson('/api/assistant/conversations'). */
export async function assistantJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) await throwHttpError(response);
  return response.status === 204 ? (undefined as T) : response.json();
}

async function throwHttpError(response: Response): Promise<never> {
  const body = await response
    .json()
    .catch(() => ({ message: 'Não foi possível concluir a solicitação.' }));
  throw new AssistantError(
    String(body.code ?? 'unavailable'),
    String(body.message),
    response.status,
  );
}

/** Reads newline events incrementally, including split UTF-8 packets. Example: sendAssistantMessage(input,onStatus). */
export async function sendAssistantMessage(
  input: AssistantSubmission,
  onStatus: (status: string) => void,
): Promise<AssistantAnswer> {
  const response = await fetch('/api/assistant/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!response.ok) await throwHttpError(response);
  if (!response.body) throw new AssistantError('unavailable', 'Resposta vazia. Tente novamente.');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      if (done && buffer) lines.push(buffer);
      for (const line of lines.filter(Boolean)) {
        const event = objectValue(JSON.parse(line));
        if (event.type === 'status' && typeof event.message === 'string') onStatus(event.message);
        if (event.type === 'error')
          throw new AssistantError(String(event.code), String(event.message));
        if (event.type === 'done') return parseAnswer(event.answer);
      }
      if (done)
        throw new AssistantError(
          'interrupted',
          'A conexão foi interrompida. Repita a solicitação para recuperar a resposta.',
        );
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
