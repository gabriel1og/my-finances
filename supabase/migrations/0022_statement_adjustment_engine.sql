-- Internal adjustment primitives. Only preview/apply wrappers are exposed to clients.
create function public.statement_card_snapshot(p_card uuid) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'card', (select to_jsonb(c) from public.credit_cards c where id = p_card),
    'cycles', coalesce((select jsonb_agg(to_jsonb(s) order by s.statement_month)
      from public.card_statements s where s.card_id = p_card), '[]'::jsonb),
    'rules', coalesce((select jsonb_agg(to_jsonb(r) order by r.effective_month)
      from public.card_billing_rules r where r.card_id = p_card), '[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(jsonb_build_object(
      'id',t.id,'statement_id',t.statement_id,'date',t.date,'description',t.description,
      'amount',t.amount,'is_card_payment',t.is_card_payment,'manual',t.statement_manual,
      'account_id',t.account_id,'updated_at',t.updated_at) order by t.id)
      from public.transactions t where t.card_id = p_card or t.card_payment_for = p_card), '[]'::jsonb))
$$;

create function public.change_cycle_boundary(p_cycle uuid, p_closing date, p_due date default null) returns void
language plpgsql security definer set search_path = public as $$
declare s public.statement_cycles; n public.statement_cycles;
begin
  select * into strict s from public.statement_cycles where id = p_cycle;
  perform public.ensure_card_cycles(s.card_id, (s.statement_month + interval '1 month')::date);
  select * into strict n from public.statement_cycles where card_id = s.card_id
    and merged_into is null and statement_month > s.statement_month order by statement_month limit 1;
  if p_closing is null or p_closing <= s.period_start or p_closing >= n.closing_date then
    raise exception 'Fechamento % deve ser posterior ao início e anterior ao próximo fechamento %.', p_closing, n.closing_date;
  end if;
  update public.statement_cycles set closing_date = p_closing, due_date = coalesce(p_due, due_date), is_adjusted = true where id = s.id;
  update public.statement_cycles set period_start = p_closing, is_adjusted = true where id = n.id;
end $$;

create function public.change_card_rule(p_card uuid, p_change jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare m date := (p_change->>'effectiveMonth')::date; s public.statement_cycles;
  new_closing smallint := (p_change->>'closingDay')::smallint;
  new_due smallint := (p_change->>'dueDay')::smallint; previous_end date;
begin
  if m is null or extract(day from m) <> 1 or new_closing is null or new_due is null then
    raise exception 'Informe primeiro ciclo, fechamento e vencimento da nova regra.';
  end if;
  if exists(select 1 from public.statement_cycles where card_id = p_card and statement_month >= m and is_adjusted)
    or exists(select 1 from public.card_billing_rules where card_id = p_card and effective_month > m) then
    raise exception 'Há ajustes ou regras posteriores. Escolha um primeiro ciclo após esses ajustes.';
  end if;
  perform public.ensure_card_cycles(p_card, (m - interval '1 month')::date);
  perform public.ensure_card_cycles(p_card, m);
  insert into public.card_billing_rules(user_id, card_id, effective_month, closing_day, due_day)
    select user_id, id, m, new_closing, new_due from public.credit_cards where id = p_card
    on conflict (card_id, effective_month) do update set closing_day = excluded.closing_day, due_day = excluded.due_day;
  select closing_date into strict previous_end from public.statement_cycles
    where card_id = p_card and statement_month = (m - interval '1 month')::date;
  for s in select * from public.statement_cycles where card_id = p_card and statement_month >= m order by statement_month loop
    update public.statement_cycles set period_start = previous_end,
      closing_date = public.day_in_month(s.statement_month, new_closing),
      due_date = public.day_in_month((s.statement_month + interval '1 month')::date, new_due) where id = s.id;
    previous_end := public.day_in_month(s.statement_month, new_closing);
  end loop;
  update public.credit_cards set closing_day = new_closing, due_day = new_due where id = p_card;
end $$;

create function public.merge_statement_cycles(p_card uuid, p_change jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare first_month date := (p_change->>'month')::date;
  last_month date := (p_change->>'targetMonth')::date; dest public.statement_cycles; first_cycle public.statement_cycles; m date;
begin
  if last_month is null or last_month <= first_month or extract(day from last_month) <> 1 then
    raise exception 'Destino deve ser um mês posterior à origem.';
  end if;
  if first_month < '1900-01-01' or last_month > '2200-12-01' then raise exception 'Ciclos devem estar entre 1900 e 2200.'; end if;
  for m in select generate_series(first_month, last_month, interval '1 month')::date loop
    perform public.ensure_card_cycles(p_card, m);
  end loop;
  if exists(select 1 from public.statement_cycles where card_id = p_card
    and statement_month between first_month and last_month and merged_into is not null) then
    raise exception 'Selecione apenas ciclos ainda não incorporados.';
  end if;
  select * into strict dest from public.statement_cycles where card_id = p_card and statement_month = last_month;
  select * into strict first_cycle from public.statement_cycles where card_id = p_card and statement_month = first_month;
  update public.statement_cycles set merged_into = dest.id, is_adjusted = true
    where card_id = p_card and statement_month >= first_month and statement_month < last_month;
  -- Redirect earlier aliases too; chains never grow as subsequent merges occur.
  update public.statement_cycles set merged_into = dest.id where card_id = p_card and merged_into in
    (select id from public.statement_cycles where card_id = p_card and merged_into = dest.id);
  update public.statement_cycles set period_start = first_cycle.period_start, is_adjusted = true where id = dest.id;
  update public.transactions set statement_id = dest.id,
    card_payment_month = case when is_card_payment then last_month else card_payment_month end
    where statement_id in (select id from public.statement_cycles where card_id = p_card and merged_into = dest.id);
  if p_change->>'dueDate' is null then raise exception 'Informe o vencimento da fatura reunida.'; end if;
  perform public.change_cycle_boundary(dest.id, (p_change->>'closingDate')::date, (p_change->>'dueDate')::date);
end $$;

create function public.move_statement_purchases(p_card uuid, p_change jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare dest uuid; source_id uuid; ids uuid[];
begin
  if jsonb_typeof(p_change->'transactionIds') is distinct from 'array' then raise exception 'Selecione os lançamentos.'; end if;
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(p_change->'transactionIds');
  if coalesce(cardinality(ids),0) = 0 then raise exception 'Selecione ao menos um lançamento.'; end if;
  dest := public.ensure_card_cycles(p_card, (p_change->>'targetMonth')::date);
  select id into strict source_id from public.statement_cycles where card_id = p_card and statement_month = (p_change->>'month')::date;
  if dest = source_id or exists(select 1 from public.statement_cycles where id = dest and merged_into is not null) then
    raise exception 'Escolha outra fatura ativa do mesmo cartão.';
  end if;
  if (select count(distinct id) from public.transactions where id = any(ids) and card_id = p_card
    and settlement = 'card' and statement_id = source_id) <> cardinality(ids) then
    raise exception 'Seleção contém lançamentos duplicados ou que não pertencem à fatura.';
  end if;
  update public.transactions set statement_id = dest, statement_manual = true where id = any(ids);
  update public.statement_cycles set is_adjusted = true where id in (source_id, dest);
end $$;

create function public.execute_statement_change(p_card uuid, p_change jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s public.statement_cycles; op text := p_change->>'operation'; m date := (p_change->>'month')::date;
begin
  set constraints statement_cycles_no_overlap deferred;
  if op not in ('due','closing','merge','move','rule') or op is null then raise exception 'Operação de fatura inválida.'; end if;
  if m is null or extract(day from m) <> 1 then raise exception 'Mês de referência deve ser o primeiro dia do mês.'; end if;
  if length(trim(coalesce(p_change->>'reason',''))) not between 1 and 500 then raise exception 'Informe um motivo de até 500 caracteres.'; end if;
  perform public.ensure_card_cycles(p_card, m);
  select * into strict s from public.statement_cycles where card_id = p_card and statement_month = m;
  if s.merged_into is not null then raise exception 'Ajuste a fatura que incorporou este ciclo.'; end if;
  if op = 'rule' then perform public.change_card_rule(p_card, p_change); end if;
  if op <> 'rule' and p_change->>'effectiveMonth' is not null then perform public.change_card_rule(p_card, p_change); end if;
  if op = 'merge' then perform public.merge_statement_cycles(p_card, p_change); end if;
  if op = 'move' then perform public.move_statement_purchases(p_card, p_change); return; end if;
  if op = 'closing' then perform public.change_cycle_boundary(s.id, (p_change->>'closingDate')::date); end if;
  if op = 'due' then
    update public.statement_cycles set due_date = (p_change->>'dueDate')::date, is_adjusted = true where id = s.id;
  end if;
  -- Reallocate by actual periods; explicitly moved purchases retain their assignment.
  update public.transactions set statement_id = statement_id
    where card_id = p_card and settlement = 'card' and not statement_manual
      and statement_id is distinct from public.resolve_purchase_cycle(card_id, date);
end $$;

create function public.statement_adjustment(p_change jsonb, p_fingerprint text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare card_id uuid := (p_change->>'cardId')::uuid; before_state jsonb; after_state jsonb; fingerprint text;
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  perform 1 from public.credit_cards where id = card_id and user_id = auth.uid() for update;
  if not found then raise exception 'Cartão não encontrado.'; end if;
  before_state := public.statement_card_snapshot(card_id);
  fingerprint := md5(before_state::text || p_change::text);
  if p_fingerprint is not null and p_fingerprint <> fingerprint then
    raise exception 'A fatura mudou desde a prévia. Revise o ajuste novamente.';
  end if;
  if p_fingerprint is null then
    begin
      perform public.execute_statement_change(card_id, p_change);
      set constraints statement_cycles_no_overlap immediate;
      after_state := public.statement_card_snapshot(card_id);
      -- PL/pgSQL preserves variables but rolls back writes in this subtransaction.
      raise sqlstate 'PT001' using message = 'rollback preview';
    exception when sqlstate 'PT001' then null;
    end;
  else
    perform public.execute_statement_change(card_id, p_change);
    set constraints statement_cycles_no_overlap immediate;
    after_state := public.statement_card_snapshot(card_id);
    insert into public.statement_adjustments(user_id, card_id, operation, reason, before_state, after_state)
      values(auth.uid(), card_id, p_change->>'operation', trim(p_change->>'reason'), before_state, after_state);
  end if;
  return jsonb_build_object('fingerprint', fingerprint, 'before', before_state, 'after', after_state);
end $$;

-- Deletions also invalidate previews and serialize with adjustments.
create function public.lock_deleted_transaction_card() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.credit_cards where id in (old.card_id, old.card_payment_for) order by id for update;
  return old;
end $$;
create trigger transactions_lock_deleted_card before delete on public.transactions
for each row execute function public.lock_deleted_transaction_card();

-- Metadata changes cannot silently rewrite billing rules outside the reviewed RPC.
create function public.guard_card_billing_days() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.closing_day, new.due_day) is distinct from (old.closing_day, old.due_day)
    and current_user not in ('postgres','supabase_admin') then
    raise exception 'Altere os dias pelo ajuste de ciclo com prévia.';
  end if;
  return new;
end $$;
create trigger credit_cards_guard_billing_days before update on public.credit_cards
for each row execute function public.guard_card_billing_days();

revoke all on function public.statement_card_snapshot(uuid), public.change_cycle_boundary(uuid,date,date),
  public.change_card_rule(uuid,jsonb), public.merge_statement_cycles(uuid,jsonb),
  public.move_statement_purchases(uuid,jsonb), public.execute_statement_change(uuid,jsonb),
  public.lock_deleted_transaction_card(), public.guard_card_billing_days() from public, anon, authenticated;
revoke all on function public.statement_adjustment(jsonb,text) from public, anon;
grant execute on function public.statement_adjustment(jsonb,text) to authenticated;

create function public.update_card_with_rule(p_card uuid, p_input jsonb,
  p_effective_month date default null, p_fingerprint text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c public.credit_cards; proposal jsonb;
begin
  select * into strict c from public.credit_cards where id = p_card and user_id = auth.uid() for update;
  if not exists(select 1 from public.accounts where id = (p_input->>'accountId')::uuid and user_id = auth.uid()) then
    raise exception 'Conta não encontrada.';
  end if;
  if (c.closing_day, c.due_day) is distinct from
    ((p_input->>'closingDay')::smallint, (p_input->>'dueDay')::smallint) then
    if p_effective_month is null or p_fingerprint is null then raise exception 'Revise a nova regra antes de salvar.'; end if;
    proposal := jsonb_build_object('cardId',p_card,'operation','rule','month',p_effective_month,
      'reason','Alteração da regra mensal do cartão','effectiveMonth',p_effective_month,
      'closingDay',(p_input->>'closingDay')::smallint,'dueDay',(p_input->>'dueDay')::smallint);
    perform public.statement_adjustment(proposal, p_fingerprint);
  end if;
  update public.credit_cards set account_id = (p_input->>'accountId')::uuid,
    name = trim(p_input->>'name'), brand = nullif(trim(p_input->>'brand'),''),
    color = p_input->>'color', credit_limit = (p_input->>'creditLimit')::numeric where id = p_card;
end $$;
revoke all on function public.update_card_with_rule(uuid,jsonb,date,text) from public, anon;
grant execute on function public.update_card_with_rule(uuid,jsonb,date,text) to authenticated;
