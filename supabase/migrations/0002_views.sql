-- flowly — 0002_views.sql
-- Views auxiliares para KPIs, fluxo mensal e progresso de orçamento.
-- security_invoker garante que a RLS das tabelas base continue valendo.

-- Fluxo mensal: receitas x despesas por mês (alimenta o FlowChart)
create or replace view public.monthly_flow
with (security_invoker = true) as
select
  t.user_id,
  date_trunc('month', t.date)::date                                   as month,
  coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::numeric(14,2)  as income,
  coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::numeric(14,2) as expense,
  (coalesce(sum(t.amount) filter (where t.type = 'income'), 0)
   - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0))::numeric(14,2) as balance
from public.transactions t
group by t.user_id, date_trunc('month', t.date);

-- Gasto por categoria/mês + limite efetivo (budgets sobrescreve categories.budget)
create or replace view public.category_month_spending
with (security_invoker = true) as
select
  c.user_id,
  c.id                                as category_id,
  c.name,
  c.color,
  m.month,
  coalesce(s.spent, 0)::numeric(14,2) as spent,
  coalesce(b.amount, c.budget)::numeric(14,2) as budget,
  case
    when coalesce(b.amount, c.budget) > 0
      then round(coalesce(s.spent, 0) / coalesce(b.amount, c.budget) * 100, 1)
    else null
  end                                 as pct_used
from public.categories c
cross join lateral (
  select distinct date_trunc('month', t.date)::date as month
  from public.transactions t
  where t.user_id = c.user_id
) m
left join lateral (
  select sum(t.amount) as spent
  from public.transactions t
  where t.category_id = c.id
    and t.type = 'expense'
    and date_trunc('month', t.date)::date = m.month
) s on true
left join public.budgets b
  on b.category_id = c.id and b.month = m.month
where c.is_archived = false;
