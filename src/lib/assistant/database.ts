import { AssistantError } from './contracts';

/** Loads every database page, aborting rather than silently truncating. Example: readAll((a,b)=>query.range(a,b)). */
export async function readAll<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  signal?: AbortSignal,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < 100000; from += 500) {
    signal?.throwIfAborted();
    const { data, error } = await fetchPage(from, from + 499);
    if (error)
      throw new AssistantError('database_error', 'Não foi possível consultar os dados.', 503);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) return rows;
  }
  throw new AssistantError('query_too_large', 'Consulta muito extensa; informe um período menor.');
}
