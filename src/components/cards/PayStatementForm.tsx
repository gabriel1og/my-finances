'use client';

import { useState, useTransition } from 'react';
import { DateField } from '@/components/ui/DateField';
import { payStatement } from '@/app/(app)/cards/actions';
import type { Account, CreditCard } from '@/types/database.types';

/**
 * Registro do pagamento de uma fatura.
 *
 * Vive fora do CardPanel porque a página da fatura (`/cards/[id]`) precisa da
 * mesma ação: duas cópias do formulário seriam duas regras de valor inicial e
 * duas mensagens diferentes para o mesmo lançamento.
 *
 * `suggested` é o que entra no campo ao abrir — o que falta pagar, ou o total
 * quando nada foi pago ainda.
 */
export function PayStatementForm({
  card,
  account,
  month,
  suggested,
  onDone,
  onCancel,
}: {
  card: CreditCard;
  account?: Account;
  month: string;
  suggested: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(suggested || '').replace('.', ','));
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await payStatement({
        cardId: card.id,
        statementMonth: month,
        amount: Number(amount.replace(',', '.') || '0'),
        date,
      });

      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label-caps" htmlFor={`pay-amount-${card.id}`}>
            Valor
          </label>
          <input
            id={`pay-amount-${card.id}`}
            className="input-base num mt-1"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="label-caps">Data do pagamento</label>
          <DateField value={date} onChange={setDate} label="Data do pagamento" className="mt-1" />
        </div>
      </div>

      <p className="text-2xs text-textMuted">
        Gera uma saída de {account?.name ?? 'conta vinculada'}. Não conta como despesa nova — as
        compras já entraram no mês em que foram feitas.
      </p>

      {error ? <p className="text-xs text-expense">{error}</p> : null}

      <div className="flex gap-2">
        <button disabled={pending} onClick={submit} className="btn-primary btn-sm">
          {pending ? 'Registrando...' : 'Confirmar pagamento'}
        </button>
        <button onClick={onCancel} className="btn-secondary btn-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}
