'use client';

import { createContext, useContext } from 'react';
import { formatCurrency } from '@/lib/format';

/**
 * A moeda vem de profiles.currency e é lida uma vez no layout de (app).
 * Componentes de exibição consomem daqui em vez de assumir BRL.
 */
const CurrencyContext = createContext('BRL');

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: string;
  children: React.ReactNode;
}) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

/** Formata na moeda do perfil. */
export function useMoney() {
  const currency = useCurrency();
  return (value: number) => formatCurrency(value, currency);
}

/** Para usar dentro de server components, que não leem contexto. */
export function Money({ value, className }: { value: number; className?: string }) {
  const money = useMoney();
  return <span className={className}>{money(value)}</span>;
}
