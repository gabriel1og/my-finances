# Flowly — Personal Finance

A desktop web app for personal finance with 100% manual entry (no bank integration).
Inspiration: YNAB (zero-based budgeting) + Organizze (clean UX).

## Stack

Next.js 15 (App Router) · TypeScript · Supabase (auth + Postgres + RLS) · Tailwind CSS · Recharts · Deploy na Vercel.

## Structure

```
src/
  app/
    (app)/            layout with sidebar + authenticated routes
      dashboard/      KPIs, monthly flow, budget, latest transactions
      transactions/   list with filters + server actions
      categories/     cards with progress bar and 85% alert
      reports/        quarterly summary + expenses by category
      settings/       goals and preferences
    login/            sign-in / sign-up via Supabase Auth
  components/         layout, UI, charts, transactions
  lib/                Supabase (client/server/middleware), format, queries, constants
  types/              database.types.ts
supabase/migrations/  schema, views, and seeds
```

## Design System Conventions

- Color tokens and animations are in `tailwind.config.ts` — always use the classes (`bg-surface`, `text-income`, ...).
- **JetBrains Mono (`font-mono` / `.num` class) is required for all monetary values, dates, and percentages.**
- Border-radius: sm 4 / md 8 / lg 12. No glassmorphism, no generic gradients, minimal shadows.
- Budget alert starting at 85% of the limit (`BUDGET_ALERT_THRESHOLD`).
