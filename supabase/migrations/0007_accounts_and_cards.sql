-- flowly — 0007_accounts_and_cards.sql
-- Contas bancárias, cartões de crédito e o vínculo das transações com eles.
--
-- Modelo:
--   accounts      -> onde o dinheiro fica. Saldo = saldo inicial + receitas − saídas.
--   credit_cards  -> vinculado a uma conta (a que paga a fatura). Não tem saldo próprio:
--                    tem faturas mensais, definidas pelo dia de fechamento.
--   transactions  -> ganham `settlement` ('account' | 'card'), `account_id`, `card_id`
--                    e `payment_method`.
--
-- Regra da fatura (definida pelo usuário): a compra entra na fatura que ainda não fechou.
-- Compra no dia 26 com fechamento no 28 -> fatura do próprio mês.
-- Compra no dia 28 ou depois            -> fatura do mês seguinte.
-- Ou seja: dia_da_compra < closing_day  -> mês corrente; senão -> mês seguinte.
--
-- Pagamento de fatura é uma transação comum marcada com `is_card_payment`,
-- que sai da conta mas NÃO conta como despesa nos KPIs (as compras já contaram).

-- ---------------------------------------------------------------- enums
do $$ begin
  create type public.account_kind as enum ('checking', 'savings', 'cash', 'investment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.settlement_kind as enum ('account', 'card');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('debit', 'pix', 'cash', 'transfer', 'boleto', 'credit');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- accounts
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  kind            public.account_kind not null default 'checking',
  institution     text,
  color           text not null default '#5B6EF5',
  opening_balance numeric(14,2) not null default 0,
  is_archived     boolean not null default false,
  position        smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint accounts_color_hex check (color ~* '^#[0-9a-f]{6}$'),
  constraint accounts_name_len  check (char_length(trim(name)) between 1 and 40)
);

create unique index if not exists accounts_user_name_uniq
  on public.accounts (user_id, lower(name));

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- credit_cards
create table if not exists public.credit_cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  account_id   uuid not null references public.accounts(id) on delete restrict,
  name         text not null,
  brand        text,
  color        text not null default '#A78BFA',
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  closing_day  smallint not null check (closing_day between 1 and 31),
  due_day      smallint not null check (due_day between 1 and 31),
  is_archived  boolean not null default false,
  position     smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint credit_cards_color_hex check (color ~* '^#[0-9a-f]{6}$'),
  constraint credit_cards_name_len  check (char_length(trim(name)) between 1 and 40)
);

create unique index if not exists credit_cards_user_name_uniq
  on public.credit_cards (user_id, lower(name));

create trigger credit_cards_set_updated_at
  before update on public.credit_cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- transactions
alter table public.transactions
  add column if not exists settlement     public.settlement_kind not null default 'account',
  add column if not exists account_id     uuid references public.accounts(id) on delete set null,
  add column if not exists card_id        uuid references public.credit_cards(id) on delete set null,
  add column if not exists payment_method public.payment_method,
  add column if not exists is_card_payment boolean not null default false,
  add column if not exists card_payment_for uuid references public.credit_cards(id) on delete set null;

-- Crédito exige cartão; o resto não pode ter cartão.
alter table public.transactions drop constraint if exists transactions_settlement_coherent;
alter table public.transactions add constraint transactions_settlement_coherent check (
  (settlement = 'card'    and card_id is not null) or
  (settlement = 'account' and card_id is null)
);

-- Receita nunca entra em fatura de cartão.
alter table public.transactions drop constraint if exists transactions_income_not_on_card;
alter table public.transactions add constraint transactions_income_not_on_card check (
  type = 'expense' or settlement = 'account'
);

-- Pagamento de fatura sai da conta e é sempre despesa.
alter table public.transactions drop constraint if exists transactions_card_payment_shape;
alter table public.transactions add constraint transactions_card_payment_shape check (
  is_card_payment = false
  or (settlement = 'account' and type = 'expense' and card_id is null and card_payment_for is not null)
);

create index if not exists transactions_account_idx on public.transactions (user_id, account_id);
create index if not exists transactions_card_idx    on public.transactions (user_id, card_id);
create index if not exists transactions_card_payment_idx
  on public.transactions (user_id, card_payment_for) where is_card_payment;

-- ---------------------------------------------------------------- RLS
alter table public.accounts     enable row level security;
alter table public.credit_cards enable row level security;

create policy "accounts_select_own" on public.accounts
  for select using (auth.uid() = user_id);
create policy "accounts_insert_own" on public.accounts
  for insert with check (auth.uid() = user_id);
create policy "accounts_update_own" on public.accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "accounts_delete_own" on public.accounts
  for delete using (auth.uid() = user_id);

create policy "credit_cards_select_own" on public.credit_cards
  for select using (auth.uid() = user_id);
create policy "credit_cards_insert_own" on public.credit_cards
  for insert with check (auth.uid() = user_id);
create policy "credit_cards_update_own" on public.credit_cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "credit_cards_delete_own" on public.credit_cards
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------- fatura
-- Mês da fatura em que a compra cai, conforme o dia de fechamento.
create or replace function public.statement_month(purchase_date date, closing_day smallint)
returns date
language sql
immutable
as $$
  select case
    when extract(day from purchase_date) < closing_day
      then date_trunc('month', purchase_date)::date
    else (date_trunc('month', purchase_date) + interval '1 month')::date
  end;
$$;
