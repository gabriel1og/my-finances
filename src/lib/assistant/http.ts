import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AssistantError } from './contracts';
export const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

/** Bounds request size even for chunked bodies. Example: await assistantRequestJson(request). */
export async function assistantRequestJson(request: Request): Promise<unknown> {
  if (!request.body) throw new AssistantError('invalid_input', 'Esperado corpo JSON.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0,
    body = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 20000)
        throw new AssistantError('invalid_input', 'Solicitação maior que 20 KB.', 413);
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    try {
      return JSON.parse(body);
    } catch {
      throw new AssistantError('invalid_input', 'Esperado corpo JSON válido.');
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Validates identity at each API entry point. Example: await assistantSession(request). */
export async function assistantSession(request: Request, mutation = false) {
  if (mutation && request.headers.get('origin') !== new URL(request.url).origin)
    throw new AssistantError('forbidden', 'Origem da solicitação inválida.', 403);
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    throw new AssistantError('unauthorized', 'Sua sessão expirou. Entre novamente.', 401);
  return { db, user };
}

/** Hides provider/database messages from the browser. Example: safeAssistantError(error). */
export function safeAssistantError(error: unknown): AssistantError {
  if (error instanceof AssistantError) return error;
  if (
    error instanceof Error &&
    (error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      error.name === 'APIUserAbortError')
  )
    return new AssistantError(
      'timeout',
      'A consulta foi interrompida ou demorou demais. Tente novamente.',
      504,
    );
  return new AssistantError(
    'unavailable',
    'Não foi possível concluir a consulta. Tente novamente.',
    503,
  );
}

/** Consistent JSON errors, never redirects/technical logs. Example: assistantHttpError(error). */
export function assistantHttpError(error: unknown) {
  const safe = safeAssistantError(error);
  return NextResponse.json(
    { code: safe.code, message: safe.message },
    { status: safe.status, headers: PRIVATE_HEADERS },
  );
}
