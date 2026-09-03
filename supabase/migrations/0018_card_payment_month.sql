-- flowly — 0018_card_payment_month.sql
-- Pagamento de fatura passa a dizer QUAL fatura está pagando.
--
-- Até aqui a view casava o pagamento com a fatura pelo mês da data do
-- pagamento. Com o vencimento sempre no mês seguinte (0017), pagar a fatura
-- de fevereiro em março atribuía o valor à fatura de março: fevereiro ficava
-- "em aberto" (vermelha, com o botão de pagar) e março aparecia com mais pago
-- do que devia. O mês da fatura é informação do lançamento, não algo a
-- adivinhar pela data.
--
-- 1. Coluna card_payment_month (dia 1 do mês da fatura).
-- 2. Backfill: os pagamentos gerados pelo app têm a descrição
--    "Fatura <cartão> — <mês> de <ano>", de onde o mês sai exato.
-- 3. A view usa a coluna; quando ela é nula (importações antigas), assume a
--    última fatura já fechada na data do pagamento.

alter table public.transactions
  add column if not exists card_payment_month date;

alter table public.transactions drop constraint if exists transactions_card_payment_month_shape;
alter table public.transactions add constraint transactions_card_payment_month_shape check (
  card_payment_month is null
  or (is_card_payment = true and card_payment_month = date_trunc('month', card_payment_month)::date)
);

with parsed as (
  select
    t.id,
    regexp_match(
      t.description,
      '— (janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de (\d{4})\s*$'
    ) as m
  from public.transactions t
  where t.is_card_payment = true and t.card_payment_month is null
)
update public.transactions t
set card_payment_month = make_date(
  (parsed.m[2])::int,
  array_position(
    array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'],
    parsed.m[1]
  ),
  1
)
from parsed
where parsed.id = t.id and parsed.m is not null;

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
    -- Sem o mês explícito, o pagamento vale para a última fatura fechada na
    -- data em que foi feito: statement_month() dá a fatura ainda aberta.
    coalesce(
      t.card_payment_month,
      (public.statement_month(t.date, c.closing_day) - interval '1 month')::date
    ) as statement_month,
    sum(t.amount) as paid
  from public.transactions t
  join public.credit_cards c on c.id = t.card_payment_for
  where t.is_card_payment = true and t.card_payment_for is not null
  group by t.user_id, t.card_payment_for, 3
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
  public.day_in_month((m.statement_month + interval '1 month')::date, c.due_day) as due_date,
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
left join payments p on p.card_id = c.id and p.statement_month = m.statement_month;
