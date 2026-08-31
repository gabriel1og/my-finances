-- flowly — 0011_statement_due_next_month.sql
-- Corrige o vencimento (e o fechamento) exibido na fatura.
--
-- O ciclo de uma fatura de mês M vai do closing_day de M-1 até o dia anterior
-- ao closing_day de M — é o que statement_month() já faz ao jogar a compra
-- para o mês seguinte quando o dia da compra >= closing_day. Ou seja: a fatura
-- de M FECHA no closing_day de M, e não no mês anterior.
--
-- Daí os dois ajustes:
--   * closing_date passa a ser o closing_day do próprio statement_month
--     (antes apontava para o início do ciclo, um mês atrás);
--   * due_date só cai no próprio statement_month quando o vencimento é
--     depois do fechamento (ex.: fecha dia 20, vence dia 27). Quando o dia de
--     vencimento é menor ou igual ao de fechamento (ex.: fecha dia 28, vence
--     dia 8), o vencimento é no mês seguinte — uma fatura não pode vencer
--     antes de fechar.

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
  public.day_in_month(
    case
      when c.due_day > c.closing_day then m.statement_month
      else (m.statement_month + interval '1 month')::date
    end,
    c.due_day
  ) as due_date,
  public.day_in_month(m.statement_month, c.closing_day) as closing_date
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
