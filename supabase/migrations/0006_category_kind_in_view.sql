-- flowly — 0006_category_kind_in_view.sql
-- A view somava apenas transações de despesa, então categorias de receita
-- apareciam sempre zeradas. Agora o total segue o `kind` da categoria:
-- categoria de despesa soma despesas, categoria de receita soma receitas.
-- Também expõe `kind` para a UI separar as duas listas.
--
-- Nota: `create or replace view` só permite ACRESCENTAR colunas no fim da lista.
-- Como `kind` entra no meio, é preciso dropar a view antes (não há nada dependendo
-- dela no banco — o consumo é todo via PostgREST).

drop view if exists public.category_month_spending;

create view public.category_month_spending
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
  c.kind,
  m.month,
  coalesce(s.total, 0)::numeric(14,2)         as spent,
  coalesce(b.amount, c.budget)::numeric(14,2) as budget,
  case
    when c.kind = 'expense' and coalesce(b.amount, c.budget) > 0
      then round(coalesce(s.total, 0) / coalesce(b.amount, c.budget) * 100, 1)
    else null
  end                                         as pct_used
from public.categories c
join user_months m on m.user_id = c.user_id
left join lateral (
  select sum(t.amount) as total
  from public.transactions t
  where t.category_id = c.id
    and t.type = c.kind
    and date_trunc('month', t.date)::date = m.month
) s on true
left join public.budgets b
  on b.category_id = c.id and b.month = m.month
where c.is_archived = false;
