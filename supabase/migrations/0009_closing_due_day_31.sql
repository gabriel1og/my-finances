-- flowly — 0009_closing_due_day_31.sql
-- Fechamento e vencimento passam a aceitar dias 29, 30 e 31.
--
-- O motivo do limite anterior (28) era fevereiro: um dia 31 não existe em todo
-- mês. A solução aqui é grampear o dia ao último dia do mês em questão, que é
-- o que os emissores fazem na prática — fatura que fecha dia 31 fecha dia 28
-- (ou 29) em fevereiro.

alter table public.credit_cards drop constraint if exists credit_cards_closing_day_check;
alter table public.credit_cards add constraint credit_cards_closing_day_check
  check (closing_day between 1 and 31);

alter table public.credit_cards drop constraint if exists credit_cards_due_day_check;
alter table public.credit_cards add constraint credit_cards_due_day_check
  check (due_day between 1 and 31);

-- Dia `wanted` dentro do mês de `reference`, limitado ao último dia desse mês.
create or replace function public.day_in_month(reference date, wanted smallint)
returns date
language sql
immutable
as $$
  select (date_trunc('month', reference)
    + make_interval(days =>
        least(
          wanted,
          extract(day from (date_trunc('month', reference) + interval '1 month - 1 day'))::int
        ) - 1
      ))::date;
$$;

-- Mesma regra de antes, agora com o fechamento grampeado ao mês da compra.
create or replace function public.statement_month(purchase_date date, closing_day smallint)
returns date
language sql
immutable
as $$
  select case
    when extract(day from purchase_date)
         < extract(day from public.day_in_month(purchase_date, closing_day))
      then date_trunc('month', purchase_date)::date
    else (date_trunc('month', purchase_date) + interval '1 month')::date
  end;
$$;

-- due_date e closing_date precisam do mesmo grampeamento, senão dia 31 em
-- fevereiro transbordaria para março.
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
left join payments p on p.card_id = c.id and p.statement_month = m.statement_month
where c.is_archived = false;
