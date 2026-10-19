-- Um único significado contábil para views e assistente, sem alterar o valor gravado.
create function public.refund_income(p_type public.transaction_type, p_settlement public.settlement_kind, p_amount numeric)
returns numeric language sql immutable as $$ select case when p_type = 'income' and p_settlement = 'account' then p_amount else 0 end $$;
create function public.refund_expense(p_type public.transaction_type, p_settlement public.settlement_kind, p_amount numeric)
returns numeric language sql immutable as $$ select case when p_type = 'expense' then p_amount when p_settlement = 'card' then -p_amount else 0 end $$;

create or replace view public.monthly_flow
with (security_invoker = true) as
select
  t.user_id,
  date_trunc('month', t.date)::date as month,
  coalesce(sum(public.refund_income(t.type,t.settlement,t.amount)), 0)::numeric(14,2)  as income,
  coalesce(sum(public.refund_expense(t.type,t.settlement,t.amount)), 0)::numeric(14,2) as expense,
  (coalesce(sum(public.refund_income(t.type,t.settlement,t.amount)), 0)
   - coalesce(sum(public.refund_expense(t.type,t.settlement,t.amount)), 0))::numeric(14,2) as balance
from public.transactions t
where t.is_card_payment = false and t.is_transfer = false
group by t.user_id, date_trunc('month', t.date);



create or replace view public.category_month_spending
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
  select sum(case when c.kind = 'expense' then public.refund_expense(t.type,t.settlement,t.amount) else public.refund_income(t.type,t.settlement,t.amount) end) as total
  from public.transactions t
  where t.category_id = c.id
    and (t.type = c.kind or (c.kind = 'expense' and t.type = 'income' and t.settlement = 'card'))
    and t.is_card_payment = false
    and t.is_transfer = false
    and date_trunc('month', t.date)::date = m.month
) s on true
left join public.budgets b
  on b.category_id = c.id and b.month = m.month
where c.is_archived = false;

create or replace view public.card_statement_items with (security_invoker = true) as
select t.user_id, t.card_id, s.statement_month, t.id as transaction_id, t.description,
  t.amount, t.date, t.category_id, s.id as statement_id, t.type
from public.transactions t join public.statement_cycles s on s.id = t.statement_id
where t.settlement = 'card';
create or replace view public.card_statements with (security_invoker = true) as
select c.user_id, c.id as card_id, c.name, c.color, c.credit_limit, c.closing_day, c.due_day,
  c.is_archived, s.statement_month,
  coalesce(sum(case when t.type = 'income' then -t.amount else t.amount end) filter(where t.settlement = 'card'),0)::numeric(14,2) as total,
  coalesce(sum(t.amount) filter(where t.is_card_payment),0)::numeric(14,2) as paid,
  (coalesce(sum(case when t.type = 'income' then -t.amount else t.amount end) filter(where t.settlement = 'card'),0) -
   coalesce(sum(t.amount) filter(where t.is_card_payment),0))::numeric(14,2) as open_amount,
  s.due_date, s.closing_date, s.id as statement_id, s.period_start, s.is_adjusted,
  s.merged_into, dest.statement_month as merged_into_month,
  coalesce(sum(t.amount) filter(where t.settlement = 'card' and t.type = 'expense'),0)::numeric(14,2) as purchases_total,
  coalesce(sum(t.amount) filter(where t.settlement = 'card' and t.type = 'income'),0)::numeric(14,2) as refund_total
from public.statement_cycles s join public.credit_cards c on c.id = s.card_id
left join public.statement_cycles dest on dest.id = s.merged_into
left join public.transactions t on t.statement_id = s.id
group by c.id, s.id, dest.statement_month;

create or replace view public.tag_month_totals
with (security_invoker = true) as
select
  tt.user_id,
  tt.tag_id,
  g.name,
  g.color,
  date_trunc('month', t.date)::date as month,
  coalesce(sum(public.refund_expense(t.type,t.settlement,t.amount)), 0)::numeric(14,2) as expense,
  coalesce(sum(public.refund_income(t.type,t.settlement,t.amount)), 0)::numeric(14,2)  as income,
  count(*)                                                                    as items
from public.transaction_tags tt
join public.transactions t on t.id = tt.transaction_id
join public.tags g         on g.id = tt.tag_id
where t.is_card_payment = false and t.is_transfer = false
group by tt.user_id, tt.tag_id, g.name, g.color, date_trunc('month', t.date);

create or replace view public.card_month_totals
with (security_invoker = true) as
select
  t.user_id,
  t.card_id,
  c.name,
  c.color,
  date_trunc('month', t.date)::date as month,
  coalesce(sum(public.refund_expense(t.type,t.settlement,t.amount)), 0)::numeric(14,2) as expense,
  count(*) as items
from public.transactions t
join public.credit_cards c on c.id = t.card_id
where t.settlement = 'card'
group by t.user_id, t.card_id, c.name, c.color, date_trunc('month', t.date);

create or replace function public.assistant_transaction_totals(p_start date, p_end date, p_category_id uuid, p_account_id uuid, p_card_id uuid, p_tag_id uuid, p_search text)
returns jsonb language sql stable security invoker set search_path = '' as $$
with matching as (
  select t.* from public.transactions t
  where t.user_id = auth.uid() and t.date between p_start and p_end
    and not t.is_transfer and not t.is_card_payment
    and (p_category_id is null or t.category_id = p_category_id)
    and (p_account_id is null or t.account_id = p_account_id)
    and (p_card_id is null or t.card_id = p_card_id)
    and (p_tag_id is null or exists (select 1 from public.transaction_tags tt where tt.transaction_id = t.id and tt.tag_id = p_tag_id))
    and (p_search is null or strpos(lower(t.description), lower(p_search)) > 0 or strpos(lower(coalesce(t.notes,'')), lower(p_search)) > 0)
), monthly as (
  select m.month::date as month,
    coalesce(sum(public.refund_income(t.type,t.settlement,t.amount)),0) as income,
    coalesce(sum(public.refund_expense(t.type,t.settlement,t.amount)),0) as expense, count(t.id) as items
  from generate_series(date_trunc('month', p_start::timestamp), date_trunc('month', p_end::timestamp), interval '1 month') m(month)
  left join matching t on date_trunc('month', t.date) = m.month group by m.month order by m.month
), category_totals as (
  select t.category_id, c.name, case when t.settlement = 'card' then 'expense'::public.transaction_type else t.type end as type,
    sum(case when t.settlement = 'card' then public.refund_expense(t.type,t.settlement,t.amount) else t.amount end) as amount, count(*) as items
  from matching t left join public.categories c on c.id = t.category_id group by 1,2,3 order by amount desc
)
select jsonb_build_object(
  'income', coalesce(sum(public.refund_income(type,settlement,amount)),0),
  'expense', coalesce(sum(public.refund_expense(type,settlement,amount)),0),
  'balance', coalesce(sum(public.refund_income(type,settlement,amount) - public.refund_expense(type,settlement,amount)),0),
  'items', count(*), 'monthly', coalesce((select jsonb_agg(monthly) from monthly),'[]'::jsonb),
  'categories', coalesce((select jsonb_agg(category_totals) from category_totals),'[]'::jsonb)
) from matching;
$$;

-- Internal adjustment primitives. Only preview/apply wrappers are exposed to clients.
create or replace function public.statement_card_snapshot(p_card uuid) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'card', (select to_jsonb(c) from public.credit_cards c where id = p_card),
    'cycles', coalesce((select jsonb_agg(to_jsonb(s) order by s.statement_month)
      from public.card_statements s where s.card_id = p_card), '[]'::jsonb),
    'rules', coalesce((select jsonb_agg(to_jsonb(r) order by r.effective_month)
      from public.card_billing_rules r where r.card_id = p_card), '[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(jsonb_build_object(
      'id',t.id,'statement_id',t.statement_id,'date',t.date,'description',t.description,
      'amount',t.amount,'type',t.type,'is_card_payment',t.is_card_payment,'manual',t.statement_manual,
      'account_id',t.account_id,'updated_at',t.updated_at) order by t.id)
      from public.transactions t where t.card_id = p_card or t.card_payment_for = p_card), '[]'::jsonb))
$$;

