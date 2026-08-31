-- flowly — 0010_installments_and_transfers.sql
-- Compra parcelada no cartão e transferência entre contas.
--
-- Parcelamento: cada parcela é uma transação real, com sua própria data — e
-- portanto cai sozinha na fatura certa via statement_month(). Elas se
-- reconhecem pelo installment_group. Sem "transação-mãe": o modelo continua
-- sendo uma linha = um lançamento.
--
-- Transferência: duas linhas irmãs (saída de uma conta, entrada em outra)
-- ligadas por transfer_group. Como o dinheiro não entrou nem saiu do
-- patrimônio, ficam fora dos KPIs de receita/despesa — mesmo tratamento já
-- dado ao pagamento de fatura.

alter table public.transactions
  add column if not exists installment_group uuid,
  add column if not exists installment_no    smallint,
  add column if not exists installment_total smallint,
  add column if not exists is_transfer       boolean not null default false,
  add column if not exists transfer_group    uuid;

alter table public.transactions drop constraint if exists transactions_installment_shape;
alter table public.transactions add constraint transactions_installment_shape check (
  (installment_group is null and installment_no is null and installment_total is null)
  or (
    installment_group is not null
    and installment_total between 2 and 72
    and installment_no between 1 and installment_total
  )
);

alter table public.transactions drop constraint if exists transactions_transfer_shape;
alter table public.transactions add constraint transactions_transfer_shape check (
  is_transfer = false
  or (
    transfer_group is not null
    and settlement = 'account'
    and account_id is not null
    and card_id is null
    and category_id is null
    and is_card_payment = false
  )
);

create index if not exists transactions_installment_group_idx
  on public.transactions (installment_group) where installment_group is not null;
create index if not exists transactions_transfer_group_idx
  on public.transactions (transfer_group) where transfer_group is not null;

-- ---------------------------------------------------------------- views
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
where t.is_card_payment = false and t.is_transfer = false
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
    and t.is_transfer = false
    and date_trunc('month', t.date)::date = m.month
) s on true
left join public.budgets b
  on b.category_id = c.id and b.month = m.month
where c.is_archived = false;
