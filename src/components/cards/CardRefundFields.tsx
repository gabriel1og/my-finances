'use client';

import { useEffect, useState } from 'react';
import { MonthField } from '@/components/ui/MonthField';
import {
  findRefundPurchases,
  getRefundPurchaseReference,
  resolveRefundStatement,
} from '@/app/(app)/transactions/refund-options';
import { formatDate, formatMonthLong, formatCurrency } from '@/lib/format';
import { useMoney, useCurrency } from '@/lib/currency';
import type { CreditCard } from '@/types/database.types';

type PurchaseOption = { id: string; description: string; date: string; amount: number };

/** Destino explícito e referência opcional, sem modificar a compra. */
export function CardRefundFields({
  cards,
  cardId,
  onCardChange,
  initialStatementId,
  initialMonth,
  onStatementChange,
  relatedPurchaseId,
  onPurchaseChange,
}: {
  cards: CreditCard[];
  cardId: string;
  onCardChange: (id: string) => void;
  initialStatementId?: string;
  initialMonth?: string;
  onStatementChange: (id: string | null) => void;
  relatedPurchaseId: string;
  onPurchaseChange: (id: string) => void;
}) {
  const money = useMoney();
  const currency = useCurrency();
  const [month, setMonth] = useState(initialMonth?.slice(0, 7) ?? '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [purchases, setPurchases] = useState<PurchaseOption[]>([]);
  const [destination, setDestination] = useState('');
  const [referencedPurchase, setReferencedPurchase] = useState<PurchaseOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [useInitial, setUseInitial] = useState(Boolean(initialStatementId));

  useEffect(() => {
    let active = true;
    onStatementChange(null);
    setDestination('');
    if (!cardId || (!month && !useInitial)) return;
    resolveRefundStatement(cardId, month, useInitial ? initialStatementId : undefined)
      .then((result) => {
        if (!active) return;
        setError(result.error);
        if (!result.statement) return;
        onStatementChange(result.statement.statement_id);
        setDestination(
          `Fatura de ${formatMonthLong(result.statement.statement_month)} · em aberto ${formatCurrency(result.statement.open_amount, currency)}`,
        );
        if (useInitial) setMonth(result.statement.statement_month.slice(0, 7));
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar a fatura. Tente novamente.');
      });
    return () => {
      active = false;
    };
  }, [cardId, month, useInitial, initialStatementId, onStatementChange, currency]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      findRefundPurchases(cardId, search, page)
        .then((result) => {
          if (!active) return;
          setPurchases(result.purchases);
          setSearchError(result.error);
        })
        .catch(() => {
          if (active) setSearchError('Não foi possível buscar as compras.');
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cardId, search, page]);

  useEffect(() => {
    let active = true;
    setReferencedPurchase(null);
    if (!relatedPurchaseId) return;
    getRefundPurchaseReference(relatedPurchaseId)
      .then((result) => {
        if (!active) return;
        setReferencedPurchase(result.purchase);
        if (result.error) setSearchError(result.error);
      })
      .catch(() => {
        if (active) setSearchError('Não foi possível carregar a compra relacionada.');
      });
    return () => {
      active = false;
    };
  }, [relatedPurchaseId]);

  function changeCard(id: string) {
    onStatementChange(null);
    onPurchaseChange('');
    onCardChange(id);
    setUseInitial(false);
    setMonth('');
    setSearch('');
    setPage(0);
    setPurchases([]);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label-caps" htmlFor="refund-card">
          Cartão
        </label>
        <select
          id="refund-card"
          className="select-base mt-1"
          value={cardId}
          onChange={(e) => changeCard(e.target.value)}
        >
          <option value="">Escolha o cartão</option>
          {cards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label-caps">Fatura do estorno</label>
        <MonthField
          value={month}
          label="Fatura do estorno"
          onChange={(value) => {
            onStatementChange(null);
            setUseInitial(false);
            setMonth(value);
          }}
        />
        <p className="num mt-1 text-xs text-textSecondary" aria-live="polite">
          {destination || 'Escolha o mês da fatura que recebeu o crédito.'}
        </p>
        {error && (
          <p className="text-xs text-expense" role="alert">
            {error}
          </p>
        )}
      </div>
      <p className="text-2xs text-textMuted">
        Abate a fatura escolhida e os gastos no mês da data do estorno. Não aumenta a renda nem o
        saldo da conta.
      </p>
      <div>
        <label className="label-caps" htmlFor="refund-purchase-search">
          Compra relacionada (opcional)
        </label>
        <input
          id="refund-purchase-search"
          className="input-base mt-1"
          placeholder="Buscar descrição, data ou valor"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Compra relacionada"
          className="select-base mt-1 font-mono"
          value={relatedPurchaseId}
          onChange={(e) => onPurchaseChange(e.target.value)}
        >
          <option value="">Sem referência</option>
          {relatedPurchaseId &&
            !purchases.some((purchase) => purchase.id === relatedPurchaseId) && (
              <option value={relatedPurchaseId}>
                {referencedPurchase
                  ? `${referencedPurchase.description} · ${formatDate(referencedPurchase.date)} · ${money(referencedPurchase.amount)}`
                  : 'Compra relacionada selecionada'}
              </option>
            )}
          {purchases.map((purchase) => (
            <option key={purchase.id} value={purchase.id}>
              {purchase.description} · {formatDate(purchase.date)} · {money(purchase.amount)}
            </option>
          ))}
        </select>
        <div className="mt-1 flex gap-3 text-xs">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="text-accent disabled:opacity-40"
          >
            Anteriores
          </button>
          <button
            type="button"
            disabled={purchases.length < 20}
            onClick={() => setPage(page + 1)}
            className="text-accent disabled:opacity-40"
          >
            Próximas
          </button>
        </div>
        {searchError && (
          <p role="alert" className="text-xs text-expense">
            {searchError}
          </p>
        )}
        <p className="mt-1 text-2xs text-textMuted">
          Referência informativa: não altera compra, parcelas, datas, valores ou categoria.
        </p>
      </div>
    </div>
  );
}
