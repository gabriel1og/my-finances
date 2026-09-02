-- flowly — 0014_report_views.sql
-- Views para os relatórios: gastos por conta, por cartão e evolução do
-- patrimônio. Todas ignoram pagamento de fatura e transferência quando o
-- assunto é "gasto" — só o saldo/patrimônio considera essas linhas, porque
-- ali o que importa é o dinheiro saindo da conta.

-- ---------------------------------------------------------------- por conta
create or replace view public.account_month_totals
with (security_invoker = true) as
select
  t.user_id,
  t.account_id,
  a.name,
  a.color,
  date_trunc('month', t.date)::date as month,
  coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::numeric(14,2) as expense,
  coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::numeric(14,2)  as income,
  count(*) as items
from public.transactions t
join public.accounts a on a.id = t.account_id
where t.settlement = 'account'
  and t.is_card_payment = false
  and t.is_transfer = false
group by t.user_id, t.account_id, a.name, a.color, date_trunc('month', t.date);

-- ---------------------------------------------------------------- por cartão
-- Aqui o mês é o da COMPRA, não o da fatura: a pergunta do relatório é
-- "quanto gastei em setembro", não "quanto vou pagar em setembro".
create or replace view public.card_month_totals
with (security_invoker = true) as
select
  t.user_id,
  t.card_id,
  c.name,
  c.color,
  date_trunc('month', t.date)::date as month,
  coalesce(sum(t.amount), 0)::numeric(14,2) as expense,
  count(*) as items
from public.transactions t
join public.credit_cards c on c.id = t.card_id
where t.settlement = 'card'
group by t.user_id, t.card_id, c.name, c.color, date_trunc('month', t.date);

-- ---------------------------------------------------------------- patrimônio
-- Saldo acumulado das contas ao fim de cada mês: saldo inicial de todas as
-- contas + soma corrente das movimentações. Transferência entra e sai, então
-- se anula sozinha; pagamento de fatura conta, porque o dinheiro saiu mesmo.
create or replace view public.net_worth_by_month
with (security_invoker = true) as
with movements as (
  select
    t.user_id,
    date_trunc('month', t.date)::date as month,
    sum(case when t.type = 'income' then t.amount else -t.amount end) as delta
  from public.transactions t
  where t.settlement = 'account' and t.account_id is not null
  group by t.user_id, date_trunc('month', t.date)
),
opening as (
  select user_id, coalesce(sum(opening_balance), 0) as base
  from public.accounts
  group by user_id
)
select
  m.user_id,
  m.month,
  m.delta::numeric(14,2) as delta,
  (o.base + sum(m.delta) over (partition by m.user_id order by m.month))::numeric(14,2) as net_worth
from movements m
join opening o on o.user_id = m.user_id;
