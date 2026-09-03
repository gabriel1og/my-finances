import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_METHODS,
  CATEGORY_PALETTE,
  NAV_ITEMS,
  NAV_SECTIONS,
  PAYMENT_METHOD_LABEL,
  SUB_ROUTES,
} from '@/lib/constants';

describe('NAV_ITEMS', () => {
  it('não repete rota', () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('descreve toda rota — o cabeçalho global lê daqui', () => {
    for (const item of NAV_ITEMS) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.subtitle.length).toBeGreaterThan(0);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it('só usa seções declaradas', () => {
    const sections = NAV_SECTIONS.map((section) => section.key);
    for (const item of NAV_ITEMS) {
      expect(sections).toContain(item.section);
    }
  });

  it('deixa /settings fora da propagação de mês', () => {
    // Configurações não é sensível a mês; anexar ?month= só sujaria a URL.
    const settings = NAV_ITEMS.find((item) => item.href === '/settings');
    expect(settings?.monthAware).toBe(false);
  });

  it('resolve cada rota do menu para um item só pelo prefixo', () => {
    // O cabeçalho usa `startsWith`: dois itens de menu em que um é prefixo do
    // outro fariam a página errada ganhar o título.
    for (const item of NAV_ITEMS) {
      const matches = NAV_ITEMS.filter((other) => item.href.startsWith(other.href));
      expect(matches).toHaveLength(1);
    }
  });
});

describe('SUB_ROUTES', () => {
  it('toda sub-rota mora sob um item do menu', () => {
    // É o que permite ao nav manter o pai ativo enquanto o cabeçalho mostra o
    // título da sub-rota.
    for (const sub of SUB_ROUTES) {
      const parent = NAV_ITEMS.find((item) => sub.href.startsWith(`${item.href}/`));
      expect(parent, `sem pai no menu: ${sub.href}`).toBeDefined();
    }
  });

  it('nenhuma sub-rota duplica uma rota de menu', () => {
    for (const sub of SUB_ROUTES) {
      // Comparação por string: os tipos literais das duas listas não se
      // cruzam hoje, mas é justamente a duplicata futura que se quer barrar.
      expect(NAV_ITEMS.some((item) => (item.href as string) === (sub.href as string))).toBe(false);
    }
  });

  it('toda sub-rota descreve a si mesma', () => {
    for (const sub of SUB_ROUTES) {
      expect(sub.title.length).toBeGreaterThan(0);
      expect(sub.subtitle.length).toBeGreaterThan(0);
    }
  });
});

describe('CATEGORY_PALETTE', () => {
  it('não repete cor — contas, cartões, categorias e tags dividem a lista', () => {
    const colors = CATEGORY_PALETTE.map((color) => color.toUpperCase());
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('usa hexadecimal de 6 dígitos, que é o que as actions validam', () => {
    for (const color of CATEGORY_PALETTE) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('formas de pagamento', () => {
  it('toda forma que sai da conta tem rótulo', () => {
    for (const method of ACCOUNT_METHODS) {
      expect(PAYMENT_METHOD_LABEL[method]).toBeTruthy();
    }
  });

  it('crédito não sai direto da conta', () => {
    // Compra no crédito entra na fatura; quem debita a conta é o pagamento.
    expect(ACCOUNT_METHODS).not.toContain('credit');
  });
});
