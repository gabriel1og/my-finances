import { NextResponse } from 'next/server';
import { assistantSession, assistantHttpError, PRIVATE_HEADERS } from '@/lib/assistant/http';
import { AssistantError, uuidValue } from '@/lib/assistant/contracts';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { db, user } = await assistantSession(request);
    const id = uuidValue((await context.params).id);
    const { data: conversation, error } = await db
      .from('assistant_conversations')
      .select('id,title,updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!conversation) throw new AssistantError('not_found', 'Conversa não encontrada.', 404);
    const before = new URL(request.url).searchParams.get('before');
    if (before && (!/^\d+$/.test(before) || !Number.isSafeInteger(Number(before))))
      throw new AssistantError('invalid_input', 'Cursor de mensagem inválido.');
    let query = db
      .from('assistant_messages')
      .select('id,role,content,created_at,request_id')
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .order('id', { ascending: false })
      .limit(51);
    if (before) query = query.lt('id', Number(before));
    const { data: messages, error: messageError } = await query;
    if (messageError) throw messageError;
    const page = (messages ?? []).slice(0, 50).reverse();
    const { data: executions, error: executionError } = await db
      .from('assistant_executions')
      .select('request_id,status,expires_at')
      .eq('user_id', user.id)
      .eq('conversation_id', id)
      .in(
        'request_id',
        page.map((message) => message.request_id),
      );
    if (executionError) throw executionError;
    const states = new Map(
      (executions ?? []).map((execution) => [
        execution.request_id,
        execution.status === 'reserved' && Date.parse(execution.expires_at) < Date.now()
          ? 'failed'
          : execution.status,
      ]),
    );
    return NextResponse.json(
      {
        conversation,
        messages: page.map((message) => ({
          ...message,
          requestId: message.request_id,
          requestStatus: states.get(message.request_id),
        })),
        hasMore: (messages?.length ?? 0) > 50,
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return assistantHttpError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { db } = await assistantSession(request, true);
    const id = uuidValue((await context.params).id);
    const { data, error } = await db.rpc('assistant_delete', { p_conversation_id: id });
    if (error) throw error;
    if (data === 'busy')
      throw new AssistantError(
        'busy',
        'Aguarde a consulta terminar antes de excluir esta conversa.',
        409,
      );
    return new NextResponse(null, { status: 204, headers: PRIVATE_HEADERS });
  } catch (error) {
    return assistantHttpError(error);
  }
}
