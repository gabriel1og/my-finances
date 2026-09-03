import { fileURLToPath } from 'url';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

/**
 * Dois ambientes, um comando.
 *
 * As funções puras e as server actions rodam em `node`: são a maior parte da
 * suíte e não devem pagar o custo de montar um DOM. Os componentes rodam em
 * `jsdom`, com o setup do Testing Library. Separar por projeto evita o erro
 * clássico de um teste de cálculo depender, sem querer, de algo do navegador.
 */
export default [
  {
    resolve: { alias },
    test: {
      name: 'unit',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    resolve: { alias },
    // JSX transformado pelo esbuild no modo automático. Sem isto o esbuild
    // segue o `jsx: "preserve"` do tsconfig do Next, cai no transform clássico
    // e todo teste de componente quebra com "React is not defined" — o Next
    // injeta o runtime na build dele, o Vitest não.
    esbuild: { jsx: 'automatic' as const, jsxImportSource: 'react' },
    test: {
      name: 'ui',
      environment: 'jsdom',
      include: ['src/**/*.test.tsx'],
      setupFiles: ['src/test/setup.ts'],
      globals: true,
    },
  },
];
