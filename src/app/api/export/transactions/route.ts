import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { csvNumber, toCsv } from '@/lib/csv';
import { monthRange } from '@/lib/format';
import { PAYMENT_METHOD_LABEL } from '@/lib/constants';
import type { TransactionWithCategory } from '@/types/database.types';

export const dynamic = 'force-dynamic';

const COLUMNS = [
  { key: 'date', label: 'Data' },
  { key: 'description', label: 'Descrição' },
  { key: 'type', label: 'Tipo' },
  { key: 'amount', label: 'Valor' },
  { key: 'category', label: 'Categoria' },
  { key: 'origin', label: 'Conta/Cartão' },
  { key: 'method', label: 'Forma' },
  { key: 'installment', label: 'Parcela' },
  { key: 'tags', label: 'Tags' },
  { key: 'kind', label: 'Natureza' },
  { key: 'notes', label: 'Observações' },
];

/** Rótulo do que a linha é de fato — importa para não somar duas vezes ao reimportar. */
function natureOf(tx: TransactionWithCategory): string {
  if (tx.is_transfer) return 'Transferência';
  if (tx.is_card_payment) return 'Pagamento de fatura';
  return 'Lançamento';
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A RLS já barraria os dados de outro usuário, mas responder 401 é mais
  // honesto do que devolver um CSV vazio.
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const month = params.get('month');
  const scope = params.get('scope') ?? 'month';

  let query = supabase
    .from('transactions')
    .select(
      '*, category:categories!transactions_category_id_fkey(id,name,color)' +
        ', account:accounts!transactions_account_id_fkey(id,name,color)' +
        ', card:credit_cards!transactions_card_id_fkey(id,name,color)' +
        ', tags(id,name,color)',
    )
    .order('date', { ascending: false });

  if (scope !== 'all' && month) {
    const { start, end } = monthRange(month);
    query = query.gte('date', start).lte('date', end);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const transactions = (data ?? []) as unknown as TransactionWithCategory[];

  const rows = transactions.map((tx) => ({
    date: tx.date.slice(0, 10),
    description: tx.description,
    type: tx.type === 'income' ? 'Receita' : 'Despesa',
    amount: csvNumber(Number(tx.amount)),
    category: tx.category?.name ?? '',
    origin: tx.card?.name ?? tx.account?.name ?? '',
    method: tx.payment_method ? PAYMENT_METHOD_LABEL[tx.payment_method] : '',
    installment:
      tx.installment_no && tx.installment_total
        ? `${tx.installment_no}/${tx.installment_total}`
        : '',
    tags: (tx.tags ?? []).map((tag) => tag.name).join(', '),
    kind: natureOf(tx),
    notes: tx.notes ?? '',
  }));

  const csv = toCsv(rows, COLUMNS);
  const suffix = scope === 'all' ? 'completo' : (month ?? '').slice(0, 7);

  return new NextResponse(
    // BOM: sem ele o Excel abre os acentos quebrados.
    `﻿${csv}`,
    {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="flowly-transacoes-${suffix}.csv"`,
        'Cache-Control': 'no-store',
      },
    },
  );
}
