# Flowly — Finanças Pessoais

App desktop web de finanças pessoais com lançamento 100% manual (sem integração bancária).
Referências: YNAB (orçamento base zero) + Organizze (UX limpa).

## Stack

Next.js 15 (App Router) · TypeScript · Supabase (auth + Postgres + RLS) · Tailwind CSS · Recharts · Deploy na Vercel.

## Estrutura

```
src/
  app/
    (app)/            layout com Sidebar + rotas autenticadas
      dashboard/      KPIs, fluxo mensal, orçamento, últimas transações
      transactions/   listagem com filtros + server actions
      categories/     cards com barra de progresso e alerta de 85%
      reports/        resumo trimestral + despesas por categoria
      settings/       metas e preferências
    login/            signin / signup via Supabase Auth
  components/         layout, ui, charts, transactions
  lib/                supabase (client/server/middleware), format, queries, constants
  types/              database.types.ts
supabase/migrations/  schema, views e seeds
```

## Convenções do design system

- Tokens de cor e animações estão em `tailwind.config.ts` — usar sempre as classes (`bg-surface`, `text-income`, ...).
- **JetBrains Mono (`font-mono` / classe `.num`) é obrigatório para todo valor monetário, data e percentual.**
- Border-radius: sm 4 / md 8 / lg 12. Sem glassmorphism, sem gradientes genéricos, sombras mínimas.
- Alerta de orçamento a partir de 85% do limite (`BUDGET_ALERT_THRESHOLD`).
