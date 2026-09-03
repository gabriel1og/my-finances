import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

/**
 * Config raiz: alias e cobertura. Os ambientes ficam em `vitest.workspace.ts`,
 * porque funções puras e componentes precisam de mundos diferentes.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      /**
       * O escopo da meta é onde mora decisão: regras puras, server actions,
       * route handlers e os componentes de interação. O que fica de fora está
       * de fora por decisão, não por esquecimento — ver `claude/testes.md`:
       *
       * - `lib/supabase/**` e `lib/queries.ts`: fiação com o PostgREST. Um
       *   teste com dublê só repetiria a string do `select`; quem verifica de
       *   verdade é o banco.
       * - `components/charts/**`: invólucros do Recharts, que não renderiza
       *   em jsdom sem layout.
       * - formulários longos (`*FormModal`, `import/**`): a lógica deles já
       *   está coberta nas actions e em `lib/import`; o que sobra é ligação
       *   de campo, melhor verificada por E2E.
       */
      include: [
        'src/lib/**',
        'src/components/ui/**',
        'src/components/layout/**',
        'src/app/**/actions.ts',
        'src/app/api/**/route.ts',
      ],
      exclude: [
        'src/types/**',
        'src/lib/supabase/**',
        'src/lib/queries.ts',
        'src/components/ui/AddModal.tsx',
        'src/components/**/*FormModal.tsx',
        'src/**/*.test.*',
        'src/test/**',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
