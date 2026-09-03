import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom não implementa estas duas, e os componentes de layout as usam:
// o Popover reposiciona no resize e a sidebar lê preferência de mídia.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// jsdom não faz layout, então `offsetParent` é sempre null e qualquer filtro
// de "está visível?" descarta tudo — é assim que o focus trap do Modal some
// nos testes. O shim devolve o pai, que é o suficiente para distinguir
// elemento na árvore de elemento removido.
// jsdom já define a propriedade (devolvendo null sempre), então a redefinição
// é incondicional.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get(this: HTMLElement) {
    return this.parentElement;
  },
});

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
