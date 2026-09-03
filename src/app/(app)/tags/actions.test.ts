import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/test/supabaseMock';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let supabase: SupabaseMock;
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase.client) }));

const { createTag, deleteTag, setTransactionTags } = await import('@/app/(app)/tags/actions');

beforeEach(() => {
  supabase = createSupabaseMock({ responses: { 'tags.insert': { data: [{ id: 'tag-1' }] } } });
});

describe('createTag', () => {
  it('devolve o id da tag criada — o modal usa para já marcá-la', async () => {
    const result = await createTag({ name: 'Viagem', color: '#22D3EE' });

    expect(result).toEqual({ error: null, id: 'tag-1' });
  });

  it('traduz nome duplicado', async () => {
    supabase = createSupabaseMock({
      responses: { 'tags.insert': { error: { message: 'duplicate', code: '23505' } } },
    });

    expect((await createTag({ name: 'Viagem', color: '#22D3EE' })).error).toBe(
      'Já existe uma tag com esse nome.',
    );
  });

  it('recusa nome vazio e cor inválida', async () => {
    expect((await createTag({ name: ' ', color: '#22D3EE' })).error).toBe('Informe um nome.');
    expect((await createTag({ name: 'Viagem', color: 'ciano' })).error).toBe('Cor inválida.');
  });
});

describe('deleteTag', () => {
  it('apaga a tag e nada mais — as transações só perdem o rótulo', async () => {
    await deleteTag('tag-1');

    expect(supabase.callsTo('tags', 'delete')).toHaveLength(1);
    expect(supabase.callsTo('transactions')).toHaveLength(0);
  });
});

describe('setTransactionTags', () => {
  it('substitui o conjunto: limpa e insere', async () => {
    await setTransactionTags('t-1', ['tag-1', 'tag-2']);

    const [clear] = supabase.callsTo('transaction_tags', 'delete');
    expect(clear.filters).toEqual([{ kind: 'eq', column: 'transaction_id', value: 't-1' }]);
    expect(supabase.firstPayload('transaction_tags')).toHaveLength(2);
  });

  it('lista vazia só limpa, sem inserir linha nenhuma', async () => {
    await setTransactionTags('t-1', []);

    expect(supabase.callsTo('transaction_tags', 'delete')).toHaveLength(1);
    expect(supabase.callsTo('transaction_tags', 'insert')).toHaveLength(0);
  });
});
