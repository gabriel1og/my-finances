-- flowly — 0004_fix_category_month_spending.sql
-- Correção: a view anterior derivava os meses apenas de transactions, então
-- categorias sem nenhum lançamento (ex.: as 6 defaults recém-criadas) não apareciam.
-- Agora o conjunto de meses inclui também os meses com orçamento e o mês corrente.

create or replace view public.category_month_spending
with (security_invoker = true) as
with user_months as (
  select t.user_id, date_trunc('month', t.date)::date as month
  from public.transactions t
  union
  select b.user_id, b.month
  from public.budgets b
  union
  select p.id, date_trunc('month', current_date)::date
  from public.profiles p
)
select
  c.user_id,
  c.id                                        as category_id,
  c.name,
  c.color,
  m.month,
  coalesce(s.spent, 0)::numeric(14,2)         as spent,
  coalesce(b.amount, c.budget)::numeric(14,2) as budget,
  case
    when coalesce(b.amount, c.budget) > 0
      then round(coalesce(s.spent, 0) / coalesce(b.amount, c.budget) * 100, 1)
    else null
  end                                         as pct_used
from public.categories c
join user_months m on m.user_id = c.user_id
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
