-- flowly — 0014_recurring.sql
-- Lançamentos recorrentes (fixos): aluguel, salário, assinaturas.
--
-- São MODELOS, não lançamentos. Nada é criado sozinho — o app mostra o que
-- está pendente no mês e o usuário confirma. A filosofia do projeto é
-- lançamento manual; a recorrência tira o trabalho de digitar de novo, não a
-- decisão de registrar.
--
-- Para saber o que já foi lançado, a transação gerada guarda `recurring_id` e
-- `recurring_month`, com unique nos dois: é o que impede lançar o mesmo fixo
-- duas vezes no mesmo mês.

create table if not exists public.recurring_transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  description    text not null,
  amount         numeric(14,2) not null check (amount > 0),
  type           public.transaction_type not null,
  day_of_month   smallint not null check (day_of_month between 1 and 31),
  category_id    uuid references public.categories(id) on delete set null,
  settlement     public.settlement_kind not null default 'account',
  account_id     uuid references public.accounts(id) on delete set null,
  card_id        uuid references public.credit_cards(id) on delete set null,
  payment_method public.payment_method,
  start_month    date not null default date_trunc('month', current_date)::date,
  end_month      date,
  is_active      boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint recurring_desc_len check (char_length(trim(description)) between 1 and 120),
  constraint recurring_months_ordered check (end_month is null or end_month >= start_month),
  -- Mesmas regras de coerência de transactions.
  constraint recurring_settlement_coherent check (
    (settlement = 'card'    and card_id is not null) or
    (settlement = 'account' and card_id is null)
  ),
  constraint recurring_income_not_on_card check (
    type = 'expense' or settlement = 'account'
  )
);

create index if not exists recurring_user_active_idx
  on public.recurring_transactions (user_id, is_active);

create trigger recurring_set_updated_at
  before update on public.recurring_transactions
  for each row execute function public.set_updated_at();

-- Tags do modelo, copiadas para cada lançamento gerado.
create table if not exists public.recurring_tags (
  recurring_id uuid not null references public.recurring_transactions(id) on delete cascade,
  tag_id       uuid not null references public.tags(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  primary key (recurring_id, tag_id)
);

-- ---------------------------------------------------------------- transactions
alter table public.transactions
  add column if not exists recurring_id    uuid references public.recurring_transactions(id) on delete set null,
  add column if not exists recurring_month date;

-- Um modelo só pode gerar um lançamento por mês. É esta constraint — e não a
-- UI — que garante que clicar duas vezes em "Lançar" não duplique a despesa.
create unique index if not exists transactions_recurring_month_uniq
  on public.transactions (recurring_id, recurring_month)
  where recurring_id is not null;

alter table public.transactions drop constraint if exists transactions_recurring_shape;
alter table public.transactions add constraint transactions_recurring_shape check (
  (recurring_id is null and recurring_month is null)
  or (recurring_id is not null and recurring_month is not null)
);

-- ---------------------------------------------------------------- RLS
alter table public.recurring_transactions enable row level security;
alter table public.recurring_tags         enable row level security;

create policy "recurring_select_own" on public.recurring_transactions
  for select using (auth.uid() = user_id);
create policy "recurring_insert_own" on public.recurring_transactions
  for insert with check (auth.uid() = user_id);
create policy "recurring_update_own" on public.recurring_transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recurring_delete_own" on public.recurring_transactions
  for delete using (auth.uid() = user_id);

create policy "recurring_tags_select_own" on public.recurring_tags
  for select using (auth.uid() = user_id);
create policy "recurring_tags_insert_own" on public.recurring_tags
  for insert with check (auth.uid() = user_id);
create policy "recurring_tags_delete_own" on public.recurring_tags
  for delete using (auth.uid() = user_id);
