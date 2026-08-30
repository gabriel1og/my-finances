-- flowly — 0008_accounts_views.sql
-- Views de saldo de conta, itens de fatura e faturas por mês.
-- Também atualiza monthly_flow e category_month_spending para ignorar
-- pagamentos de fatura (o gasto já foi contado na compra).

-- ---------------------------------------------------------------- saldo das contas
create or replace view public.account_balances
with (security_invoker = true) as
select
  a.user_id,
  a.id                                  as account_id,
  a.name,
  a.kind,
  a.color,
  a.opening_balance,
  a.is_archived,
  (a.opening_balance
    + coalesce(sum(t.amount) filter (where t.type = 'income'), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)
  )::numeric(14,2)                      as balance
from public.accounts a
left join public.transactions t
  on t.account_id = a.id and t.settlement = 'account'
group by a.user_id, a.id, a.name, a.kind, a.color, a.opening_balance, a.is_archived;

-- ---------------------------------------------------------------- itens de fatura
create or replace view public.card_statement_items
with (security_invoker = true) as
select
  t.user_id,
  t.card_id,
  public.statement_month(t.date, c.closing_day) as statement_month,
  t.id                                          as transaction_id,
  t.description,
  t.amount,
  t.date,
  t.category_id
from public.transactions t
join public.credit_cards c on c.id = t.card_id
where t.settlement = 'card';

-- ---------------------------------------------------------------- faturas por mês
-- `paid` casa os pagamentos (is_card_payment) pelo mês da própria transação
-- de pagamento, que é o mês de vencimento da fatura.
create or replace view public.card_statements
with (security_invoker = true) as
with items as (
  select user_id, card_id, statement_month, sum(amount) as total, count(*) as items
  from public.card_statement_items
  group by user_id, card_id, statement_month
),
payments as (
  select
    t.user_id,
    t.card_payment_for as card_id,
    date_trunc('month', t.date)::date as statement_month,
    sum(t.amount) as paid
  from public.transactions t
  where t.is_card_payment = true and t.card_payment_for is not null
  group by t.user_id, t.card_payment_for, date_trunc('month', t.date)
)
select
  c.user_id,
  c.id                              as card_id,
  c.name,
  c.color,
  c.credit_limit,
  c.closing_day,
  c.due_day,
  m.statement_month,
  coalesce(i.total, 0)::numeric(14,2) as total,
  coalesce(p.paid, 0)::numeric(14,2)  as paid,
  (coalesce(i.total, 0) - coalesce(p.paid, 0))::numeric(14,2) as open_amount,
  (date_trunc('month', m.statement_month) + make_interval(days => c.due_day - 1))::date as due_date,
  (date_trunc('month', m.statement_month) - interval '1 month'
     + make_interval(days => c.closing_day - 1))::date as closing_date
from public.credit_cards c
join lateral (
  select distinct statement_month from (
    select statement_month from items where card_id = c.id
    union
    select statement_month from payments where card_id = c.id
    union
    select public.statement_month(current_date, c.closing_day)
  ) s
) m on true
left join items    i on i.card_id = c.id and i.statement_month = m.statement_month
left join payments p on p.card_id = c.id and p.statement_month = m.statement_month
where c.is_archived = false;

-- ---------------------------------------------------------------- KPIs sem dupla contagem
create or replace view public.monthly_flow
with (security_invoker = true) as
select
  t.user_id,
  date_trunc('month', t.date)::date as month,
  coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::numeric(14,2)  as income,
  coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::numeric(14,2) as expense,
  (coalesce(sum(t.amount) filter (where t.type = 'income'), 0)
   - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0))::numeric(14,2) as balance
from public.transactions t
where t.is_card_payment = false
group by t.user_id, date_trunc('month', t.date);

drop view if exists public.category_month_spending;

create view public.category_month_spending
with (security_invoker = true) as
with user_months as (
  select t.user_id, date_trunc('month', t.date)::date as month
  from public.transactions t
  union
  select b.user_id, b.month from public.budgets b
  union
  select p.id, date_trunc('month', current_date)::date from public.profiles p
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
    and t.is_card_payment = false
    and date_trunc('month', t.date)::date = m.month
) s on true
left join public.budgets b
  on b.category_id = c.id and b.month = m.month
where c.is_archived = false;
