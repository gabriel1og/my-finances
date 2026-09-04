import { describe, expect, it, vi } from 'vitest';
import { FINANCE_ROUTES, revalidateFinance } from '@/lib/cache';
import { NAV_ITEMS, SUB_ROUTES } from '@/lib/constants';

/** As rotas que a aplicação declara ter — a mesma fonte que o cabeçalho usa. */
const DECLARED_ROUTES: string[] = [
  ...NAV_ITEMS.map((item) => item.href as string),
  ...SUB_ROUTES.map((sub) => sub.href as string),
];

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

describe('FINANCE_ROUTES', () => {
  it('cobre toda rota declarada pela aplicação', () => {
    // Este é o teste que existe por causa do bug: `/forecast` ficou de fora de
    // todas as seis listas antigas. Rota nova no menu sem entrada aqui volta a
    // servir dado velho depois de um lançamento — e falha aqui antes disso.
    for (const route of DECLARED_ROUTES) {
      expect(FINANCE_ROUTES, `rota fora da invalidação: ${route}`).toContain(route);
    }
  });

  it('não invalida rota que não existe', () => {
    for (const route of FINANCE_ROUTES) {
      expect(DECLARED_ROUTES, `rota inexistente na invalidação: ${route}`).toContain(route);
    }
  });

  it('não repete rota', () => {
    expect(new Set(FINANCE_ROUTES).size).toBe(FINANCE_ROUTES.length);
  });
});

describe('revalidateFinance', () => {
  it('invalida cada rota uma vez', () => {
    revalidatePath.mockClear();
    revalidateFinance();

    expect(revalidatePath).toHaveBeenCalledTimes(FINANCE_ROUTES.length);
    for (const route of FINANCE_ROUTES) {
      // A rota dinâmica só é invalidada com o tipo 'page'.
      if (route.includes('[')) expect(revalidatePath).toHaveBeenCalledWith(route, 'page');
      else expect(revalidatePath).toHaveBeenCalledWith(route);
    }
  });
});
