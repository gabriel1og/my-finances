import { vi } from 'vitest';

/**
 * Dublê do cliente Supabase para testar server actions.
 *
 * As actions são a camada onde mais regra de negócio mora — validação,
 * parcelamento, as duas pontas de uma transferência — e nenhuma delas estava
 * coberta, porque testar de verdade exigiria um Postgres. Este dublê troca o
 * banco por um gravador: as consultas devolvem o que o teste configurar, e
 * cada escrita fica registrada com tabela, operação, payload e filtros.
 *
 * O que ele NÃO testa, e é bom não esquecer: RLS, constraints, triggers e as
 * views. Isso só um banco de verdade verifica — está registrado no backlog
 * como a lacuna que sobra.
 */

export type RecordedCall = {
  table: string;
  op: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
  payload?: unknown;
  filters: Array<{ kind: string; column: string; value: unknown }>;
  single?: boolean;
  counted?: boolean;
  onConflict?: string;
};

type Response = {
  data?: unknown;
  /** `code` importa: 23505 (unique) vira mensagem própria em várias actions. */
  error?: { message: string; code?: string } | null;
  /** Para as consultas com `{ count: 'exact', head: true }`. */
  count?: number;
};

export type SupabaseMockOptions = {
  /** null simula sessão expirada. */
  user?: { id: string } | null;
  /**
   * Respostas por `tabela.operação` (ex.: `accounts.select`). O valor pode ser
   * uma função, para responder conforme os filtros da chamada.
   */
  responses?: Record<string, Response | ((call: RecordedCall) => Response)>;
};

export function createSupabaseMock({
  user = { id: 'user-1' },
  responses = {},
}: SupabaseMockOptions = {}) {
  const calls: RecordedCall[] = [];

  function resolve(call: RecordedCall): Response {
    const configured = responses[`${call.table}.${call.op}`];
    const response = typeof configured === 'function' ? configured(call) : (configured ?? {});
    const filled: Response = {
      data: response.data ?? [],
      error: response.error ?? null,
      count: response.count,
    };

    if (call.single && Array.isArray(filled.data)) {
      return { ...filled, data: filled.data[0] ?? null };
    }
    return filled;
  }

  function builder(call: RecordedCall) {
    const chain = {
      select(_columns?: string, options?: { count?: string; head?: boolean }) {
        if (options?.count) call.counted = true;
        // `.select()` depois de insert/update não muda a operação gravada:
        // o que interessa é o que foi escrito.
        if (call.op === 'select') call.payload = _columns;
        return chain;
      },
      upsert(payload: unknown, options?: { onConflict?: string }) {
        call.op = 'upsert';
        call.payload = payload;
        call.onConflict = options?.onConflict;
        return chain;
      },
      insert(payload: unknown) {
        call.op = 'insert';
        call.payload = payload;
        return chain;
      },
      update(payload: unknown) {
        call.op = 'update';
        call.payload = payload;
        return chain;
      },
      delete() {
        call.op = 'delete';
        return chain;
      },
      eq(column: string, value: unknown) {
        call.filters.push({ kind: 'eq', column, value });
        return chain;
      },
      neq(column: string, value: unknown) {
        call.filters.push({ kind: 'neq', column, value });
        return chain;
      },
      in(column: string, value: unknown) {
        call.filters.push({ kind: 'in', column, value });
        return chain;
      },
      gte(column: string, value: unknown) {
        call.filters.push({ kind: 'gte', column, value });
        return chain;
      },
      lte(column: string, value: unknown) {
        call.filters.push({ kind: 'lte', column, value });
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      range() {
        return chain;
      },
      maybeSingle() {
        call.single = true;
        return chain;
      },
      single() {
        call.single = true;
        return chain;
      },
      // Thenable: a chain pode ser aguardada em qualquer ponto, como no
      // cliente real.
      then(onFulfilled: (value: Response) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(resolve(call)).then(onFulfilled, onRejected);
      },
    };

    return chain;
  }

  const client = {
    from(table: string) {
      const call: RecordedCall = { table, op: 'select', filters: [] };
      calls.push(call);
      return builder(call);
    },
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
    },
  };

  return {
    client,
    calls,
    /** Chamadas de uma tabela, opcionalmente filtradas pela operação. */
    callsTo(table: string, op?: RecordedCall['op']) {
      return calls.filter((call) => call.table === table && (!op || call.op === op));
    },
    /** Payload da primeira escrita numa tabela — o caso comum nas asserções. */
    firstPayload(table: string, op: RecordedCall['op'] = 'insert') {
      return this.callsTo(table, op)[0]?.payload;
    },
  };
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
