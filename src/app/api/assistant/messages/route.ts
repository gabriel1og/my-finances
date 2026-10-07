import {
  assistantSession,
  assistantHttpError,
  PRIVATE_HEADERS,
  safeAssistantError,
  assistantRequestJson,
} from '@/lib/assistant/http';
import {
  AssistantError,
  objectValue,
  parseAnswer,
  parseSubmission,
  uuidValue,
  type AssistantEvent,
} from '@/lib/assistant/contracts';
import { OpenAIAssistantProvider, runAssistant } from '@/lib/assistant/provider';
import { executeFinancialQuery } from '@/lib/assistant/tools';
import type { Json } from '@/types/database.types';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 70;

const reservationErrors: Record<string, [number, string]> = {
  not_found: [404, 'Conversa não encontrada.'],
  conflict: [409, 'Identificador já utilizado para outra pergunta.'],
  busy: [409, 'Você já tem uma consulta em andamento. Aguarde.'],
  quota: [429, 'Você atingiu 30 perguntas hoje. A cota renova à meia-noite em São Paulo.'],
};

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 20000)
      throw new AssistantError('invalid_input', 'Pergunta muito extensa.', 413);
    const started = Date.now();
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60000)]);
    const { db, user } = await assistantSession(request, true);
    const submission = parseSubmission(await assistantRequestJson(request));
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('currency')
      .eq('id', user.id)
      .abortSignal(signal)
      .single();
    if (profileError) throw profileError;
    const provider = new OpenAIAssistantProvider(profile.currency);
    const { data, error } = await db.rpc('assistant_reserve', {
      p_conversation_id: submission.conversationId,
      p_request_id: submission.requestId,
      p_message: submission.message,
      p_selected_month: submission.selectedMonth,
    });
    if (error) throw error;
    const reservation = objectValue(data);
    const failure = reservationErrors[String(reservation.status)];
    if (failure) throw new AssistantError(String(reservation.status), failure[1], failure[0]);
    if (reservation.status === 'completed')
      return eventResponse({ type: 'done', answer: parseAnswer(reservation.response) });
    if (reservation.status !== 'reserved')
      throw new AssistantError('unavailable', 'Não foi possível reservar a consulta.', 503);
    const leaseId = uuidValue(reservation.leaseId);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        const emit = (event: AssistantEvent) => {
          if (!closed) {
            try {
              controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
            } catch {
              closed = true;
            }
          }
        };
        try {
          const { data: history, error: historyError } = await db
            .from('assistant_messages')
            .select('id,role,content,created_at')
            .eq('conversation_id', submission.conversationId)
            .eq('user_id', user.id)
            .neq('request_id', submission.requestId)
            .order('id', { ascending: false })
            .limit(40)
            .abortSignal(signal);
          if (historyError) throw historyError;
          const context = [
            ...(history ?? []).reverse(),
            {
              id: 0,
              role: 'user' as const,
              content: { text: submission.message, selectedMonth: submission.selectedMonth },
              created_at: new Date().toISOString(),
            },
          ];
          const answer = parseAnswer(
            await runAssistant(
              { provider, query: (query, abort) => executeFinancialQuery(db, query, abort) },
              context,
              submission.selectedMonth,
              signal,
              (message) => emit({ type: 'status', message }),
            ),
          );
          signal.throwIfAborted();
          const { data: committed, error: commitError } = await db.rpc('assistant_finish', {
            p_request_id: submission.requestId,
            p_lease_id: leaseId,
            p_response: answer as unknown as Json,
          });
          if (commitError || !committed)
            throw new AssistantError(
              'persistence_error',
              'Não foi possível salvar a resposta. Tente novamente.',
              503,
            );
          emit({ type: 'done', answer });
          console.info(
            JSON.stringify({ event: 'assistant_completed', durationMs: Date.now() - started }),
          );
        } catch (error) {
          const safe = safeAssistantError(error);
          const { error: releaseError } = await db.rpc('assistant_finish', {
            p_request_id: submission.requestId,
            p_lease_id: leaseId,
            p_response: null,
          });
          console.error(
            JSON.stringify({
              event: 'assistant_failed',
              code: safe.code,
              durationMs: Date.now() - started,
              releaseFailed: Boolean(releaseError),
            }),
          );
          emit({ type: 'error', code: safe.code, message: safe.message });
        } finally {
          if (!closed) {
            try {
              controller.close();
            } catch {
              /* Client disconnected. */
            }
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return assistantHttpError(error);
  }
}

function eventResponse(event: AssistantEvent) {
  return new Response(JSON.stringify(event) + '\n', {
    headers: { ...PRIVATE_HEADERS, 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  });
}
