-- Conversations are user-owned. Execution state is writable only through authenticated RPCs.
create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.assistant_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null,
  user_id uuid not null,
  request_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id) references public.assistant_conversations(id, user_id) on delete cascade,
  unique (user_id, request_id, role)
);
create table public.assistant_executions (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  conversation_id uuid not null,
  message text not null check (char_length(message) between 1 and 4000),
  selected_month date not null,
  usage_day date not null,
  status text not null check (status in ('reserved', 'completed', 'failed')),
  lease_id uuid not null default gen_random_uuid(),
  expires_at timestamptz not null,
  response jsonb,
  primary key (user_id, request_id),
  foreign key (conversation_id, user_id) references public.assistant_conversations(id, user_id) on delete cascade
);
-- Independent of conversation deletion: deleting history must not reset the daily quota.
create table public.assistant_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  completed integer not null default 0 check (completed between 0 and 30),
  primary key (user_id, usage_day)
);
create index assistant_conversations_owner on public.assistant_conversations(user_id, updated_at desc);
create index assistant_messages_history on public.assistant_messages(conversation_id, id);
create index assistant_executions_usage on public.assistant_executions(user_id, usage_day, status);
alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_executions enable row level security;
alter table public.assistant_usage enable row level security;
create policy assistant_conversations_read on public.assistant_conversations for select to authenticated using (user_id = auth.uid());
create policy assistant_conversations_create on public.assistant_conversations for insert to authenticated with check (user_id = auth.uid());
create policy assistant_conversations_delete on public.assistant_conversations for delete to authenticated using (
  user_id = auth.uid() and not exists (
    select 1 from public.assistant_executions e where e.conversation_id = assistant_conversations.id and e.user_id = auth.uid() and e.status = 'reserved' and e.expires_at > now()
  )
);
create policy assistant_messages_read on public.assistant_messages for select to authenticated using (user_id = auth.uid());
create policy assistant_executions_read on public.assistant_executions for select to authenticated using (user_id = auth.uid());
create policy assistant_usage_read on public.assistant_usage for select to authenticated using (user_id = auth.uid());
revoke all on public.assistant_conversations, public.assistant_messages, public.assistant_executions from anon, authenticated;
revoke all on public.assistant_usage from anon, authenticated;
grant select, insert on public.assistant_conversations to authenticated;
grant select on public.assistant_messages, public.assistant_executions to authenticated;
grant select on public.assistant_usage to authenticated;

-- Serializes quota reservation across all server instances. No client-supplied identity.
create function public.assistant_reserve(p_conversation_id uuid, p_request_id uuid, p_message text, p_selected_month date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := auth.uid();
  day_key date := (now() at time zone 'America/Sao_Paulo')::date;
  previous public.assistant_executions;
  lease uuid := gen_random_uuid();
  used integer;
begin
  if owner is null then raise exception 'unauthorized'; end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 4000 or p_selected_month is null
    or p_selected_month <> date_trunc('month', p_selected_month)::date then raise exception 'invalid_input'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner::text, 0));
  if not exists (select 1 from public.assistant_conversations where id = p_conversation_id and user_id = owner)
    then return jsonb_build_object('status', 'not_found'); end if;
  update public.assistant_executions set status = 'failed' where user_id = owner and status = 'reserved' and expires_at <= now();
  select * into previous from public.assistant_executions where user_id = owner and request_id = p_request_id;
  if found then
    if previous.conversation_id <> p_conversation_id or previous.message <> p_message or previous.selected_month <> p_selected_month
      then return jsonb_build_object('status', 'conflict'); end if;
    if previous.status = 'completed' then return jsonb_build_object('status', 'completed', 'response', previous.response); end if;
  end if;
  if exists (select 1 from public.assistant_executions where user_id = owner and status = 'reserved')
    then return jsonb_build_object('status', 'busy'); end if;
  select coalesce((select completed from public.assistant_usage where user_id = owner and usage_day = day_key),0)
    + (select count(*) from public.assistant_executions where user_id = owner and usage_day = day_key and status = 'reserved') into used;
  if used >= 30 then return jsonb_build_object('status', 'quota'); end if;
  insert into public.assistant_executions(user_id, request_id, conversation_id, message, selected_month, usage_day, status, expires_at, lease_id)
    values (owner, p_request_id, p_conversation_id, p_message, p_selected_month, day_key, 'reserved', now() + interval '75 seconds', lease)
    on conflict (user_id, request_id) do update set status = 'reserved', usage_day = day_key, expires_at = excluded.expires_at, lease_id = lease;
  insert into public.assistant_messages(conversation_id, user_id, request_id, role, content)
    values (p_conversation_id, owner, p_request_id, 'user', jsonb_build_object('text', p_message, 'selectedMonth', p_selected_month))
    on conflict (user_id, request_id, role) do nothing;
  return jsonb_build_object('status', 'reserved', 'leaseId', lease, 'remaining', 29 - used);
end;
$$;

-- Completion and its message are one transaction; stale workers cannot commit.
create function public.assistant_delete(p_conversation_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if not exists(select 1 from public.assistant_conversations where id = p_conversation_id and user_id = auth.uid()) then return 'not_found'; end if;
  if exists(select 1 from public.assistant_executions where conversation_id = p_conversation_id and user_id = auth.uid() and status = 'reserved' and expires_at > now()) then return 'busy'; end if;
  delete from public.assistant_conversations where id = p_conversation_id and user_id = auth.uid();
  return 'deleted';
end;
$$;
revoke all on function public.assistant_delete(uuid) from public, anon;
grant execute on function public.assistant_delete(uuid) to authenticated;

-- Completion and its message are one transaction; stale workers cannot commit.
create function public.assistant_finish(p_request_id uuid, p_lease_id uuid, p_response jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare execution public.assistant_executions;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into execution from public.assistant_executions where user_id = auth.uid() and request_id = p_request_id and lease_id = p_lease_id and status = 'reserved' for update;
  if not found then return false; end if;
  if p_response is null then
    update public.assistant_executions set status = 'failed' where user_id = auth.uid() and request_id = p_request_id;
    return true;
  end if;
  if execution.expires_at <= now() then return false; end if;
  insert into public.assistant_usage(user_id, usage_day, completed) values(auth.uid(), execution.usage_day, 1)
    on conflict (user_id, usage_day) do update set completed = public.assistant_usage.completed + 1;
  insert into public.assistant_messages(conversation_id, user_id, request_id, role, content)
    values (execution.conversation_id, auth.uid(), p_request_id, 'assistant', p_response);
  update public.assistant_executions set status = 'completed', response = p_response where user_id = auth.uid() and request_id = p_request_id;
  update public.assistant_conversations set updated_at = now() where id = execution.conversation_id;
  return true;
end;
$$;

-- Aggregate ALL matching rows in Postgres; never aggregate a truncated PostgREST page.
create function public.assistant_transaction_totals(p_start date, p_end date, p_category_id uuid, p_account_id uuid, p_card_id uuid, p_tag_id uuid, p_search text)
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
    coalesce(sum(t.amount) filter (where t.type = 'income'),0) as income,
    coalesce(sum(t.amount) filter (where t.type = 'expense'),0) as expense, count(t.id) as items
  from generate_series(date_trunc('month', p_start::timestamp), date_trunc('month', p_end::timestamp), interval '1 month') m(month)
  left join matching t on date_trunc('month', t.date) = m.month group by m.month order by m.month
), category_totals as (
  select t.category_id, c.name, t.type, sum(t.amount) as amount, count(*) as items
  from matching t left join public.categories c on c.id = t.category_id group by 1,2,3 order by amount desc
)
select jsonb_build_object(
  'income', coalesce(sum(amount) filter (where type = 'income'),0),
  'expense', coalesce(sum(amount) filter (where type = 'expense'),0),
  'balance', coalesce(sum(case when type = 'income' then amount else -amount end),0),
  'items', count(*), 'monthly', coalesce((select jsonb_agg(monthly) from monthly),'[]'::jsonb),
  'categories', coalesce((select jsonb_agg(category_totals) from category_totals),'[]'::jsonb)
) from matching;
$$;
revoke all on function public.assistant_reserve(uuid,uuid,text,date), public.assistant_finish(uuid,uuid,jsonb), public.assistant_transaction_totals(date,date,uuid,uuid,uuid,uuid,text) from public, anon;
grant execute on function public.assistant_reserve(uuid,uuid,text,date), public.assistant_finish(uuid,uuid,jsonb), public.assistant_transaction_totals(date,date,uuid,uuid,uuid,uuid,text) to authenticated;
