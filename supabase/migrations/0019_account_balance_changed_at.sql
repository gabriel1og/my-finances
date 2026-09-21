-- flowly — 0019_account_balance_changed_at.sql
-- Histórico imutável do saldo calculado de cada conta.

alter table public.accounts
  add column if not exists balance_changed_at timestamptz not null default now();

create table if not exists public.account_balance_history (
  sequence_no   bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  account_id    uuid not null references public.accounts(id) on delete cascade,
  change_kind   text not null check (change_kind in (
    'account_created',
    'opening_balance_updated',
    'transaction_created',
    'transaction_updated',
    'transaction_deleted',
    'transaction_moved_out',
    'transaction_moved_in'
  )),
  delta          numeric(14,2) not null,
  balance        numeric(14,2) not null,
  description    text not null,
  transaction_id uuid,
  changed_at     timestamptz not null,
  recorded_at    timestamptz not null default clock_timestamp()
);

create index if not exists account_balance_history_account_sequence_idx
  on public.account_balance_history (account_id, sequence_no desc);

alter table public.account_balance_history enable row level security;

create policy "account_balance_history_select_own"
  on public.account_balance_history
  for select using (auth.uid() = user_id);

-- O primeiro snapshot usa o saldo inicial atual. Para contas antigas, não há
-- como reconstruir ajustes anteriores do saldo inicial sem inventar dados.
insert into public.account_balance_history (
  user_id, account_id, change_kind, delta, balance, description, changed_at
)
select
  a.user_id,
  a.id,
  'account_created',
  a.opening_balance,
  a.opening_balance,
  'Saldo inicial registrado',
  a.created_at
from public.accounts a
where not exists (
  select 1 from public.account_balance_history h where h.account_id = a.id
);

-- O legado vira uma sequência coerente a partir do estado atual de cada
-- lançamento. Edições e exclusões anteriores à migration não são recuperáveis.
with transaction_effects as (
  select
    t.user_id,
    t.account_id,
    t.id,
    t.description,
    t.updated_at as changed_at,
    case when t.type = 'income' then t.amount else -t.amount end as delta
  from public.transactions t
  where t.settlement = 'account' and t.account_id is not null
), historical_snapshots as (
  select
    e.*,
    a.opening_balance + sum(e.delta) over (
      partition by e.account_id
      order by e.changed_at, e.id
      rows between unbounded preceding and current row
    ) as balance
  from transaction_effects e
  join public.accounts a on a.id = e.account_id
)
insert into public.account_balance_history (
  user_id, account_id, change_kind, delta, balance, description,
  transaction_id, changed_at
)
select
  s.user_id,
  s.account_id,
  'transaction_created',
  s.delta,
  s.balance,
  s.description,
  s.id,
  s.changed_at
from historical_snapshots s
where not exists (
  select 1 from public.account_balance_history h where h.transaction_id = s.id
)
order by s.account_id, s.changed_at, s.id;

update public.accounts a
set balance_changed_at = latest.changed_at
from (
  select distinct on (h.account_id) h.account_id, h.changed_at
  from public.account_balance_history h
  order by h.account_id, h.sequence_no desc
) latest
where a.id = latest.account_id;

create or replace function public.append_account_balance_history(
  target_user_id uuid,
  target_account_id uuid,
  target_change_kind text,
  target_delta numeric,
  target_description text,
  target_transaction_id uuid,
  target_changed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_balance numeric(14,2);
begin
  perform 1
  from public.accounts a
  where a.id = target_account_id and a.user_id = target_user_id
  for update;

  select h.balance
  into previous_balance
  from public.account_balance_history h
  where h.account_id = target_account_id
  order by h.sequence_no desc
  limit 1;

  insert into public.account_balance_history (
    user_id, account_id, change_kind, delta, balance, description,
    transaction_id, changed_at
  ) values (
    target_user_id, target_account_id, target_change_kind, target_delta,
    coalesce(previous_balance, 0) + target_delta, target_description,
    target_transaction_id, target_changed_at
  );

  update public.accounts
  set balance_changed_at = target_changed_at
  where id = target_account_id and user_id = target_user_id;
end;
$$;

revoke all on function public.append_account_balance_history(
  uuid, uuid, text, numeric, text, uuid, timestamptz
) from public, anon, authenticated;

create or replace function public.record_account_opening_balance_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  history_kind text;
  history_delta numeric(14,2);
  history_description text;
  history_changed_at timestamptz;
begin
  if tg_op = 'INSERT' then
    history_kind := 'account_created';
    history_delta := new.opening_balance;
    history_description := 'Saldo inicial registrado';
    history_changed_at := new.created_at;
  else
    history_kind := 'opening_balance_updated';
    history_delta := new.opening_balance - old.opening_balance;
    history_description := 'Saldo inicial ajustado';
    history_changed_at := clock_timestamp();
  end if;

  perform public.append_account_balance_history(
    new.user_id, new.id, history_kind, history_delta, history_description,
    null, history_changed_at
  );
  return new;
end;
$$;

drop trigger if exists accounts_created_balance_history on public.accounts;
create trigger accounts_created_balance_history
  after insert on public.accounts
  for each row execute function public.record_account_opening_balance_history();

drop trigger if exists accounts_opening_balance_history on public.accounts;
create trigger accounts_opening_balance_history
  after update of opening_balance on public.accounts
  for each row
  when (old.opening_balance is distinct from new.opening_balance)
  execute function public.record_account_opening_balance_history();

create or replace function public.transaction_balance_effect(
  transaction_type public.transaction_type,
  transaction_amount numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when transaction_type = 'income' then transaction_amount
    else -transaction_amount
  end;
$$;

create or replace function public.record_transaction_balance_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_at timestamptz := clock_timestamp();
  old_effect numeric(14,2);
  new_effect numeric(14,2);
begin
  if tg_op = 'INSERT' then
    if new.settlement = 'account' and new.account_id is not null then
      perform public.append_account_balance_history(
        new.user_id, new.account_id, 'transaction_created',
        public.transaction_balance_effect(new.type, new.amount),
        new.description, new.id, changed_at
      );
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.settlement = 'account' and old.account_id is not null then
      perform public.append_account_balance_history(
        old.user_id, old.account_id, 'transaction_deleted',
        -public.transaction_balance_effect(old.type, old.amount),
        old.description, old.id, changed_at
      );
    end if;
    return old;
  end if;

  if old.settlement is not distinct from new.settlement
    and old.account_id is not distinct from new.account_id
    and old.type is not distinct from new.type
    and old.amount is not distinct from new.amount then
    return new;
  end if;

  old_effect := public.transaction_balance_effect(old.type, old.amount);
  new_effect := public.transaction_balance_effect(new.type, new.amount);

  if old.settlement = 'account'
    and new.settlement = 'account'
    and old.account_id = new.account_id then
    perform public.append_account_balance_history(
      new.user_id, new.account_id, 'transaction_updated',
      new_effect - old_effect, new.description, new.id, changed_at
    );
    return new;
  end if;

  if old.settlement = 'account' and old.account_id is not null then
    perform public.append_account_balance_history(
      old.user_id, old.account_id, 'transaction_moved_out',
      -old_effect, old.description, old.id, changed_at
    );
  end if;

  if new.settlement = 'account' and new.account_id is not null then
    perform public.append_account_balance_history(
      new.user_id, new.account_id, 'transaction_moved_in',
      new_effect, new.description, new.id, changed_at
    );
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_account_balance_history on public.transactions;
create trigger transactions_account_balance_history
  after insert or update or delete on public.transactions
  for each row execute function public.record_transaction_balance_history();
