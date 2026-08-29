-- flowly — 0005_spending_cap.sql
-- Segunda meta: teto de gastos do mês, complementar à meta de economia.
-- monthly_goal      -> quanto quero que SOBRE no fim do mês (barra cheia = bom)
-- monthly_spending_cap -> quanto no máximo quero GASTAR no mês (barra cheia = alerta)

alter table public.profiles
  add column if not exists monthly_spending_cap numeric(14,2);

alter table public.profiles
  drop constraint if exists profiles_monthly_goal_positive;
alter table public.profiles
  add constraint profiles_monthly_goal_positive
  check (monthly_goal is null or monthly_goal >= 0);

alter table public.profiles
  drop constraint if exists profiles_spending_cap_positive;
alter table public.profiles
  add constraint profiles_spending_cap_positive
  check (monthly_spending_cap is null or monthly_spending_cap >= 0);
