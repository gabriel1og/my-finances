-- Persisted billing periods. Existing purchases/payments retain their current allocation.
-- Keep the baseline in the same anonymous block as the migration. It must not
-- depend on a temporary relation surviving across SQL editor statements/sessions.
do $statement_cycles_migration$
declare
  legacy_statement_totals jsonb;
  persisted_statement_totals jsonb;
begin
select coalesce(jsonb_agg(to_jsonb(totals) order by card_id, statement_month), '[]'::jsonb)
into legacy_statement_totals
from (
  select card_id, statement_month, total, paid
  from public.card_statements where total <> 0 or paid <> 0
) totals;
create extension if not exists btree_gist;

create table public.card_billing_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete cascade,
  effective_month date not null check (extract(day from effective_month) = 1),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  created_at timestamptz not null default now(),
  unique(card_id, effective_month)
);
create table public.statement_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete cascade,
  statement_month date not null check (extract(day from statement_month) = 1),
  period_start date not null,
  closing_date date not null,
  due_date date not null,
  merged_into uuid references public.statement_cycles(id) on delete restrict,
  is_adjusted boolean not null default false,
  unique(card_id, statement_month),
  check (period_start < closing_date and due_date >= closing_date),
  check (merged_into is null or merged_into <> id),
  constraint statement_cycles_no_overlap exclude using gist (card_id with =, daterange(period_start, closing_date, '[)') with &&)
    where (merged_into is null) deferrable initially deferred
);
create table public.statement_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete cascade,
  operation text not null,
  reason text not null,
  before_state jsonb not null,
  after_state jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.transactions
  add column statement_id uuid references public.statement_cycles(id) on delete restrict,
  add column statement_manual boolean not null default false;
create index transactions_statement_idx on public.transactions(statement_id);
create index statement_adjustments_card_idx on public.statement_adjustments(card_id, created_at desc);

alter table public.card_billing_rules enable row level security;
alter table public.statement_cycles enable row level security;
alter table public.statement_adjustments enable row level security;
create policy billing_rules_own on public.card_billing_rules for select using (user_id = auth.uid());
create policy statement_cycles_own on public.statement_cycles for select using (user_id = auth.uid());
create policy statement_adjustments_own on public.statement_adjustments for select using (user_id = auth.uid());
revoke all on public.card_billing_rules, public.statement_cycles, public.statement_adjustments from anon, authenticated;
grant select on public.card_billing_rules, public.statement_cycles, public.statement_adjustments to authenticated;

insert into public.card_billing_rules(user_id, card_id, effective_month, closing_day, due_day)
select user_id, id, '0001-01-01', closing_day, due_day from public.credit_cards;

-- Card row lock serializes allocation, cycle creation and adjustments.
create function public.ensure_card_cycles(p_card uuid, p_month date) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.credit_cards; r public.card_billing_rules; m date; first_month date;
  start_date date; end_date date; result uuid; neighbor date;
begin
  select * into strict c from public.credit_cards where id = p_card for update;
  p_month := date_trunc('month', p_month)::date;
  if p_month < '1900-01-01' or p_month > '2200-12-01' then
    raise exception 'Mês % fora do intervalo 1900–2200.', p_month;
  end if;
  select id into result from public.statement_cycles where card_id = p_card and statement_month = p_month;
  if result is not null then return result; end if;
  select least(p_month, coalesce(max(statement_month) + interval '1 month', p_month))::date
    into first_month from public.statement_cycles where card_id = p_card;
  for m in select generate_series(first_month, p_month, interval '1 month')::date loop
    select * into strict r from public.card_billing_rules
      where card_id = p_card and effective_month <= m order by effective_month desc limit 1;
    start_date := public.day_in_month((m - interval '1 month')::date, r.closing_day);
    end_date := public.day_in_month(m, r.closing_day);
    select closing_date into neighbor from public.statement_cycles
      where card_id = p_card and merged_into is null and statement_month = (m - interval '1 month')::date;
    start_date := coalesce(neighbor, start_date);
    select period_start into neighbor from public.statement_cycles
      where card_id = p_card and merged_into is null and statement_month = (m + interval '1 month')::date;
    end_date := coalesce(neighbor, end_date);
    insert into public.statement_cycles(user_id, card_id, statement_month, period_start, closing_date, due_date)
      values(c.user_id, p_card, m, start_date, end_date,
        public.day_in_month((m + interval '1 month')::date, r.due_day))
      on conflict (card_id, statement_month) do nothing;
  end loop;
  select id into strict result from public.statement_cycles where card_id = p_card and statement_month = p_month;
  return result;
end $$;

-- Materialize the known range before binding transactions; no date/amount is rewritten.
do $$
declare c public.credit_cards; m date; first_month date; last_month date;
begin
  for c in select * from public.credit_cards loop
    select least(min(date_trunc('month', date)::date), date_trunc('month', current_date)::date),
      greatest(max(date_trunc('month', date)::date), date_trunc('month', current_date)::date)
      into first_month, last_month from public.transactions where card_id = c.id or card_payment_for = c.id;
    for m in select generate_series(first_month - interval '1 month', last_month + interval '2 months', interval '1 month')::date loop
      perform public.ensure_card_cycles(c.id, m);
    end loop;
  end loop;
end $$;
update public.transactions t set statement_id = s.id
from public.credit_cards c, public.statement_cycles s
where t.settlement = 'card' and t.card_id = c.id and s.card_id = c.id
  and s.statement_month = public.statement_month(t.date, c.closing_day);
update public.transactions t set statement_id = s.id, card_payment_month = s.statement_month
from public.credit_cards c, public.statement_cycles s
where t.is_card_payment and t.card_payment_for = c.id and s.card_id = c.id
  and s.statement_month = coalesce(t.card_payment_month,
    (public.statement_month(t.date, c.closing_day) - interval '1 month')::date);
-- Explicit payment months can lie outside the date range above.
do $$
declare t public.transactions;
begin
  for t in select * from public.transactions where is_card_payment and statement_id is null loop
    update public.transactions set statement_id = public.ensure_card_cycles(t.card_payment_for, t.card_payment_month) where id = t.id;
  end loop;
  if exists(select 1 from public.transactions where (settlement = 'card' or is_card_payment) and statement_id is null) then
    raise exception 'Migração incompleta: lançamento de cartão sem fatura.';
  end if;
end $$;

create function public.resolve_purchase_cycle(p_card uuid, p_date date) returns uuid
language plpgsql security definer set search_path = public as $$
declare result uuid; r public.card_billing_rules; m date;
begin
  perform 1 from public.credit_cards where id = p_card for update;
  select id into result from public.statement_cycles where card_id = p_card and merged_into is null
    and p_date >= period_start and p_date < closing_date;
  if result is not null then return result; end if;
  m := date_trunc('month', p_date)::date;
  perform public.ensure_card_cycles(p_card, m);
  perform public.ensure_card_cycles(p_card, (m + interval '1 month')::date);
  select id into result from public.statement_cycles where card_id = p_card and merged_into is null
    and p_date >= period_start and p_date < closing_date;
  if result is null then raise exception 'Nenhum ciclo cobre a data %.', p_date; end if;
  return result;
end $$;

create function public.bind_transaction_cycle() returns trigger
language plpgsql security definer set search_path = public as $$
declare target_card uuid; s public.statement_cycles; owner_id uuid;
begin
  if tg_op = 'UPDATE' then
    perform 1 from public.credit_cards where id in (old.card_id, old.card_payment_for, new.card_id, new.card_payment_for)
      order by id for update;
  end if;
  target_card := case when new.is_card_payment then new.card_payment_for else new.card_id end;
  if target_card is null then new.statement_id := null; new.statement_manual := false; return new; end if;
  select user_id into strict owner_id from public.credit_cards where id = target_card for update;
  if owner_id <> new.user_id then raise exception 'Cartão não pertence ao usuário do lançamento.'; end if;
  if tg_op = 'UPDATE' and (new.card_id is distinct from old.card_id or new.card_payment_for is distinct from old.card_payment_for
    or new.is_card_payment is distinct from old.is_card_payment) then
    new.statement_id := null; new.statement_manual := false;
  end if;
  if new.is_card_payment then
    if tg_op = 'UPDATE' and new.card_payment_month is distinct from old.card_payment_month
      and new.statement_id is not distinct from old.statement_id then new.statement_id := null; end if;
    if new.statement_id is null then
      if new.card_payment_month is not null then
        new.statement_id := public.ensure_card_cycles(target_card, new.card_payment_month);
      else
        perform public.ensure_card_cycles(target_card, date_trunc('month', new.date)::date);
        perform public.ensure_card_cycles(target_card, (date_trunc('month', new.date) - interval '1 month')::date);
        select id into new.statement_id from public.statement_cycles where card_id = target_card
          and merged_into is null and closing_date <= new.date order by closing_date desc limit 1;
      end if;
    end if;
  elsif not new.statement_manual then
    new.statement_id := public.resolve_purchase_cycle(target_card, new.date);
  end if;
  select * into strict s from public.statement_cycles where id = new.statement_id;
  while s.merged_into is not null loop select * into strict s from public.statement_cycles where id = s.merged_into; end loop;
  if s.card_id <> target_card or s.user_id <> new.user_id then raise exception 'Fatura incompatível com o cartão.'; end if;
  new.statement_id := s.id;
  if new.is_card_payment then new.card_payment_month := s.statement_month; end if;
  return new;
end $$;
create trigger transactions_bind_cycle before insert or update on public.transactions
for each row execute function public.bind_transaction_cycle();

create function public.initialize_card_cycles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.card_billing_rules(user_id, card_id, effective_month, closing_day, due_day)
    values(new.user_id, new.id, '0001-01-01', new.closing_day, new.due_day);
  perform public.ensure_card_cycles(new.id, date_trunc('month', current_date)::date);
  return new;
end $$;
create trigger credit_cards_initialize_cycles after insert on public.credit_cards
for each row execute function public.initialize_card_cycles();

drop view public.card_statements;
create or replace view public.card_statement_items with (security_invoker = true) as
select t.user_id, t.card_id, s.statement_month, t.id as transaction_id, t.description,
  t.amount, t.date, t.category_id, s.id as statement_id
from public.transactions t join public.statement_cycles s on s.id = t.statement_id
where t.settlement = 'card';
create view public.card_statements with (security_invoker = true) as
select c.user_id, c.id as card_id, c.name, c.color, c.credit_limit, c.closing_day, c.due_day,
  c.is_archived, s.statement_month,
  coalesce(sum(t.amount) filter(where t.settlement = 'card'),0)::numeric(14,2) as total,
  coalesce(sum(t.amount) filter(where t.is_card_payment),0)::numeric(14,2) as paid,
  (coalesce(sum(t.amount) filter(where t.settlement = 'card'),0) -
   coalesce(sum(t.amount) filter(where t.is_card_payment),0))::numeric(14,2) as open_amount,
  s.due_date, s.closing_date, s.id as statement_id, s.period_start, s.is_adjusted,
  s.merged_into, dest.statement_month as merged_into_month
from public.statement_cycles s join public.credit_cards c on c.id = s.card_id
left join public.statement_cycles dest on dest.id = s.merged_into
left join public.transactions t on t.statement_id = s.id
group by c.id, s.id, dest.statement_month;
grant select on public.card_statements, public.card_statement_items to authenticated;

select coalesce(jsonb_agg(to_jsonb(totals) order by card_id, statement_month), '[]'::jsonb)
into persisted_statement_totals
from (
  select card_id, statement_month, total, paid
  from public.card_statements where total <> 0 or paid <> 0
) totals;
  if persisted_statement_totals is distinct from legacy_statement_totals then
    raise exception 'Totais divergentes na migração dos ciclos. Nenhum ajuste deve ser liberado.';
  end if;

create function public.ensure_statement_month(p_month date) returns void
language plpgsql security definer set search_path = public as $$
declare c public.credit_cards;
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  for c in select * from public.credit_cards where user_id = auth.uid() order by id loop
    perform public.ensure_card_cycles(c.id, p_month);
  end loop;
end $$;
revoke all on function public.ensure_card_cycles(uuid,date), public.resolve_purchase_cycle(uuid,date),
  public.bind_transaction_cycle(), public.initialize_card_cycles() from public, anon, authenticated;
revoke all on function public.ensure_statement_month(date) from public, anon;
grant execute on function public.ensure_statement_month(date) to authenticated;
end;
$statement_cycles_migration$;
