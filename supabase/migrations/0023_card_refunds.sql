-- Crédito avulso, com fatura explícita e referência apenas informativa.
alter table public.transactions
  add column related_purchase_id uuid references public.transactions(id) on delete set null;
create index transactions_related_purchase_idx on public.transactions(related_purchase_id)
  where related_purchase_id is not null;
alter table public.transactions drop constraint transactions_income_not_on_card;
alter table public.transactions add constraint transactions_refund_shape check (
  not (type = 'income' and settlement = 'card') or (
    account_id is null and card_id is not null and payment_method is not distinct from 'credit'::public.payment_method
    and statement_id is not null and statement_manual
    and not is_transfer and not is_card_payment and recurring_id is null
    and installment_group is null and installment_no is null and installment_total is null
  )
);
alter table public.transactions add constraint transactions_purchase_reference_shape check (
  related_purchase_id is null or (type = 'income' and settlement = 'card' and related_purchase_id <> id)
);

create function public.guard_card_refund() returns trigger
language plpgsql security definer set search_path = public as $$
declare refund boolean := new.type = 'income' and new.settlement = 'card';
begin
  if tg_op = 'UPDATE' and refund <> (old.type = 'income' and old.settlement = 'card') then
    raise exception 'A natureza do estorno é fixa. Exclua e cadastre outro lançamento.';
  end if;
  if not refund then return new; end if;
  if new.category_id is not null and not exists (
    select 1 from public.categories where id = new.category_id and user_id = new.user_id and kind = 'expense'
  ) then raise exception 'Categoria %: esperada categoria de despesa do usuário.', new.category_id; end if;
  if new.related_purchase_id is not null and (tg_op = 'INSERT'
    or new.related_purchase_id is distinct from old.related_purchase_id or new.card_id is distinct from old.card_id) then
    if not exists (select 1 from public.transactions where id = new.related_purchase_id
      and user_id = new.user_id and card_id = new.card_id and settlement = 'card' and type = 'expense'
      and not is_card_payment and not is_transfer) then
      raise exception 'Compra %: esperada compra do mesmo cartão e usuário.', new.related_purchase_id;
    end if;
  end if;
  return new;
end $$;
create trigger transactions_guard_refund before insert or update on public.transactions
for each row execute function public.guard_card_refund();

-- Todo o crédito e suas tags são confirmados juntos; falhas desfazem a operação.
create function public.save_card_refund(p_id uuid, p_input jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare saved_id uuid; owner_id uuid := auth.uid(); tag_ids uuid[];
begin
  if owner_id is null then raise exception 'Sessão expirada.'; end if;
  if nullif(p_input->>'statementId','') is null then raise exception 'Escolha a fatura do estorno.'; end if;
  select coalesce(array_agg(distinct value::uuid), '{}'::uuid[]) into tag_ids
    from jsonb_array_elements_text(coalesce(p_input->'tagIds','[]'::jsonb));
  if exists (select 1 from unnest(tag_ids) requested(id) where not exists (
    select 1 from public.tags where id = requested.id and user_id = owner_id
  )) then raise exception 'Tags inválidas: esperadas tags do usuário.'; end if;
  if p_id is null then
    insert into public.transactions(user_id,type,settlement,description,amount,date,category_id,
      account_id,card_id,payment_method,statement_id,statement_manual,related_purchase_id,notes)
    values(owner_id,'income','card',trim(p_input->>'description'),(p_input->>'amount')::numeric,
      (p_input->>'date')::date,nullif(p_input->>'categoryId','')::uuid,null,(p_input->>'cardId')::uuid,
      'credit',(p_input->>'statementId')::uuid,true,nullif(p_input->>'relatedPurchaseId','')::uuid,p_input->>'notes')
    returning id into saved_id;
  else
    update public.transactions set description = trim(p_input->>'description'), amount = (p_input->>'amount')::numeric,
      date = (p_input->>'date')::date, category_id = nullif(p_input->>'categoryId','')::uuid,
      card_id = (p_input->>'cardId')::uuid, statement_id = (p_input->>'statementId')::uuid,
      statement_manual = true, related_purchase_id = nullif(p_input->>'relatedPurchaseId','')::uuid
    where id = p_id and user_id = owner_id and type = 'income' and settlement = 'card'
    returning id into saved_id;
    if saved_id is null then raise exception 'Estorno % não encontrado para edição.', p_id; end if;
    delete from public.transaction_tags where transaction_id = saved_id;
  end if;
  insert into public.transaction_tags(transaction_id,tag_id,user_id)
    select saved_id, id, owner_id from unnest(tag_ids) requested(id);
  return saved_id;
end $$;
revoke all on function public.save_card_refund(uuid,jsonb) from public, anon;
grant execute on function public.save_card_refund(uuid,jsonb) to authenticated;

-- As funções de ciclo já verificam dono e resolvem faturas incorporadas.

create or replace function public.bind_transaction_cycle() returns trigger
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
  if tg_op = 'UPDATE' and not (new.type = 'income' and new.settlement = 'card') and (new.card_id is distinct from old.card_id or new.card_payment_for is distinct from old.card_payment_for
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

-- Busca textual, por data ISO ou valor; limite no banco para cartões com histórico grande.
create function public.search_card_purchases(p_card uuid, p_search text, p_offset integer)
returns table(id uuid, description text, date date, amount numeric)
language sql stable security invoker set search_path = public as $$
  select t.id,t.description,t.date,t.amount from public.transactions t
  where t.user_id = auth.uid() and t.card_id = p_card and t.settlement = 'card' and t.type = 'expense'
    and (strpos(lower(t.description),lower(p_search)) > 0 or strpos(t.date::text,p_search) > 0
      or strpos(to_char(t.date,'DD/MM/YYYY'),p_search) > 0
      or strpos(t.amount::text,replace(p_search,',','.')) > 0)
  order by t.date desc,t.id limit 20 offset greatest(p_offset,0);
$$;
revoke all on function public.search_card_purchases(uuid,text,integer) from public, anon;
grant execute on function public.search_card_purchases(uuid,text,integer) to authenticated;
