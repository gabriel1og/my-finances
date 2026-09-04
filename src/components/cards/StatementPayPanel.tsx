'use client';

import { useState } from 'react';
import { PayStatementForm } from '@/components/cards/PayStatementForm';
import type { Account, CreditCard } from '@/types/database.types';

/**
 * O botão de pagar da página da fatura. Existe como componente próprio só
 * para guardar o estado de aberto/fechado — a ação e o formulário são os
 * mesmos do card em /cards.
 */
export function StatementPayPanel({
  card,
  account,
  month,
  suggested,
}: {
  card: CreditCard;
  account?: Account;
  month: string;
  suggested: number;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary btn-sm">
        Pagar fatura
      </button>
    );
  }

  return (
    <div className="w-full">
      <PayStatementForm
        card={card}
        account={account}
        month={month}
        suggested={suggested}
        onDone={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
