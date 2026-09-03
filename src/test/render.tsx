import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CurrencyProvider } from '@/lib/currency';

/**
 * Render com os providers que a árvore real tem.
 *
 * Sem o CurrencyProvider, qualquer componente que formate dinheiro quebra ou
 * cai num default silencioso — e o teste passaria a medir o default, não o
 * comportamento. Devolve também o `user` já configurado, para não repetir
 * `userEvent.setup()` em cada arquivo.
 */
export function renderWithProviders(ui: ReactElement, { currency = 'BRL' } = {}) {
  return {
    user: userEvent.setup(),
    ...render(<CurrencyProvider currency={currency}>{ui}</CurrencyProvider>),
  };
}

export * from '@testing-library/react';
