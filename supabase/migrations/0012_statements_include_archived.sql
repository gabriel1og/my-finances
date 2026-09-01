-- flowly — 0011_statements_include_archived.sql
-- A view filtrava is_archived = false, então cartão arquivado aparecia com
-- fatura zerada mesmo tendo saldo em aberto — uma dívida real sumia da tela.
-- Arquivar é organização da UI, não apagamento de histórico: a view passa a
-- devolver todos os cartões e expõe is_archived para o app decidir o que
-- mostrar.

drop view if exists public.card_statements;

create view public.card_statements
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
  c.is_archived,
  m.statement_month,
  coalesce(i.total, 0)::numeric(14,2) as total,
  coalesce(p.paid, 0)::numeric(14,2)  as paid,
  (coalesce(i.total, 0) - coalesce(p.paid, 0))::numeric(14,2) as open_amount,
  public.day_in_month(m.statement_month, c.due_day) as due_date,
  public.day_in_month((m.statement_month - interval '1 month')::date, c.closing_day) as closing_date
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
left join payments p on p.card_id = c.id and p.statement_month = m.statement_month;
