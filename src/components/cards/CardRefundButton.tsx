'use client';

import { TransactionModal } from '@/components/ui/AddModal';
import type { Account, Category, CreditCard, Tag } from '@/types/database.types';

/** Abre o mesmo formulário já no destino da fatura atual. */
export function CardRefundButton({
  cardId,
  statementId,
  month,
  categories,
  accounts,
  cards,
  tags,
}: {
  cardId: string;
  statementId: string;
  month: string;
  categories: Category[];
  accounts: Account[];
  cards: CreditCard[];
  tags: Tag[];
}) {
  return (
    <TransactionModal
      categories={categories}
      accounts={accounts}
      cards={cards}
      tags={tags}
      initialRefund={{ cardId, statementId, month }}
      trigger={<button className="btn-secondary btn-sm">Registrar estorno</button>}
    />
  );
}
