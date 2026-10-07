import { NextResponse } from 'next/server';
import {
  assistantSession,
  assistantHttpError,
  PRIVATE_HEADERS,
  assistantRequestJson,
} from '@/lib/assistant/http';
import { AssistantError, objectValue, uuidValue } from '@/lib/assistant/contracts';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { db, user } = await assistantSession(request);
    const before = new URL(request.url).searchParams.get('before');
    let query = db
      .from('assistant_conversations')
      .select('id,title,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(31);
    if (before) {
      const cursor = objectValue(JSON.parse(before));
      const id = uuidValue(cursor.id);
      if (typeof cursor.updated_at !== 'string' || !Number.isFinite(Date.parse(cursor.updated_at)))
        throw new AssistantError('invalid_input', 'Cursor inválido.');
      const timestamp = new Date(cursor.updated_at).toISOString();
      query = query.or(`updated_at.lt.${timestamp},and(updated_at.eq.${timestamp},id.lt.${id})`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(
      { conversations: data?.slice(0, 30) ?? [], hasMore: (data?.length ?? 0) > 30 },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return assistantHttpError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, user } = await assistantSession(request, true);
    const input = objectValue(await assistantRequestJson(request));
    if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 120)
      throw new AssistantError('invalid_input', 'Título deve ter de 1 a 120 caracteres.');
    const { data, error } = await db
      .from('assistant_conversations')
      .insert({ user_id: user.id, title: input.title.trim() })
      .select('id,title,updated_at')
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    return assistantHttpError(error);
  }
}
