-- flowly — 0016_budget_rollover.sql
-- Orçamento com rollover: o que sobrou (ou faltou) num mês entra no seguinte.
--
-- Duas colunas em categories, e nada de tabela nova: o acumulado é DERIVADO do
-- histórico que já existe em category_month_spending. Guardar o saldo
-- acumulado numa coluna criaria uma segunda fonte da verdade, que sai de
-- sincronia na primeira transação editada com data retroativa.
--
-- `rollover_since` marca a partir de qual mês o acúmulo começa a contar. Sem
-- isso, ligar o rollover hoje traria de volta todo o histórico do usuário —
-- que ele nunca orçou com essa regra.

alter table public.categories
  add column if not exists rollover_enabled boolean not null default false,
  add column if not exists rollover_since   date;

alter table public.categories drop constraint if exists categories_rollover_shape;
alter table public.categories add constraint categories_rollover_shape check (
  rollover_enabled = false or rollover_since is not null
);

alter table public.categories drop constraint if exists categories_rollover_month_start;
alter table public.categories add constraint categories_rollover_month_start check (
  rollover_since is null or date_trunc('month', rollover_since)::date = rollover_since
);
