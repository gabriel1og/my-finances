-- Run after migrations in a disposable PostgreSQL/Supabase database. All data rolls back.
begin;
insert into auth.users(id,email) values
 ('31111111-1111-4111-8111-111111111111','cycles-a@example.invalid'),
 ('32222222-2222-4222-8222-222222222222','cycles-b@example.invalid');
insert into public.accounts(id,user_id,name,opening_balance) values
 ('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','31111111-1111-4111-8111-111111111111','Cycles A',1000),
 ('3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','32222222-2222-4222-8222-222222222222','Cycles B',1000);
insert into public.credit_cards(id,user_id,account_id,name,closing_day,due_day) values
 ('3ccccccc-cccc-4ccc-8ccc-cccccccccccc','31111111-1111-4111-8111-111111111111','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Cycles card',20,5),
 ('3ddddddd-dddd-4ddd-8ddd-dddddddddddd','32222222-2222-4222-8222-222222222222','3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Foreign card',20,5);
insert into public.transactions(id,user_id,type,description,amount,date,settlement,card_id) values
 ('3eeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','31111111-1111-4111-8111-111111111111','expense','First month',100,'2026-09-10','card','3ccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('3eeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','31111111-1111-4111-8111-111111111111','expense','Second month (2/3)',200,'2026-10-10','card','3ccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('3eeeeeee-eeee-4eee-8eee-eeeeeeeeeee3','31111111-1111-4111-8111-111111111111','expense','Closing boundary',25,'2026-10-20','card','3ccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into public.transactions(user_id,type,description,amount,date,settlement,account_id,is_card_payment,card_payment_for,card_payment_month)
values('31111111-1111-4111-8111-111111111111','expense','Partial payment',30,'2026-10-05','account',
 '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'3ccccccc-cccc-4ccc-8ccc-cccccccccccc','2026-09-01');
set local role authenticated;
select set_config('request.jwt.claim.sub','31111111-1111-4111-8111-111111111111',true);

do $$
declare proposal jsonb; preview jsonb; balance_before numeric; target uuid; failed boolean;
begin
  if (select count(*) from public.card_billing_rules) <> 1 then raise exception 'Rules RLS leak'; end if;
  if exists(select 1 from public.statement_cycles where user_id <> auth.uid()) then raise exception 'Cycle RLS leak'; end if;
  if (select statement_month from public.card_statement_items where transaction_id = '3eeeeeee-eeee-4eee-8eee-eeeeeeeeeee3') <> '2026-11-01' then raise exception 'Closing day allocation'; end if;
  select balance into balance_before from public.account_balances where account_id = '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  proposal := jsonb_build_object('cardId','3ccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'operation','merge','month','2026-09-01','targetMonth','2026-10-01',
    'closingDate','2026-10-25','dueDate','2026-12-05','reason','Bank combined two cycles',
    'effectiveMonth','2026-11-01','closingDay',25,'dueDay',5);
  preview := public.statement_adjustment(proposal);
  if (select total from public.card_statements where card_id = '3ccccccc-cccc-4ccc-8ccc-cccccccccccc' and statement_month = '2026-09-01') <> 100 then raise exception 'Preview persisted purchase movement'; end if;
  if exists(select 1 from public.statement_adjustments) then raise exception 'Preview persisted history'; end if;
  if (select closing_day from public.credit_cards where id = '3ccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 20 then raise exception 'Preview persisted rule'; end if;
  perform public.statement_adjustment(proposal, preview->>'fingerprint');
  select statement_id into strict target from public.card_statements where card_id = '3ccccccc-cccc-4ccc-8ccc-cccccccccccc' and statement_month = '2026-10-01';
  if (select total from public.card_statements where statement_id = target) <> 325 then raise exception 'Merge lost or duplicated purchases'; end if;
  if (select paid from public.card_statements where statement_id = target) <> 30 then raise exception 'Merge lost payment'; end if;
  if (select open_amount from public.card_statements where statement_id = target) <> 295 then raise exception 'Wrong merged balance'; end if;
  if (select due_date from public.card_statements where statement_id = target) <> '2026-12-05' then raise exception 'Wrong postponed due date'; end if;
  if (select balance from public.account_balances where account_id = '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> balance_before then raise exception 'Adjustment changed bank balance'; end if;
  if (select count(*) from public.transactions where statement_id = target) <> 4 then raise exception 'Wrong transaction count'; end if;
  if (select count(*) from public.statement_adjustments) <> 1 then raise exception 'Missing audit'; end if;
  failed := false;
  begin perform public.statement_adjustment(proposal, preview->>'fingerprint'); exception when raise_exception then failed := true; end;
  if not failed then raise exception 'Stale confirmation accepted'; end if;
end $$;

-- New/imported/recurring purchases all follow the same trigger; dates remain untouched.
insert into public.transactions(user_id,type,description,amount,date,settlement,card_id)
values(auth.uid(),'expense','Late import into extended cycle',40,'2026-10-24','card','3ccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 (auth.uid(),'expense','Next cycle boundary',50,'2026-10-25','card','3ccccccc-cccc-4ccc-8ccc-cccccccccccc');
do $$
declare proposal jsonb; preview jsonb; original_payment_id uuid; failed boolean;
begin
  if (select statement_month from public.card_statement_items where description = 'Late import into extended cycle') <> '2026-10-01' then raise exception 'Extended period allocation'; end if;
  if (select statement_month from public.card_statement_items where description = 'Next cycle boundary') <> '2026-11-01' then raise exception 'Next-cycle boundary allocation'; end if;
  proposal := jsonb_build_object('cardId','3ccccccc-cccc-4ccc-8ccc-cccccccccccc','operation','move',
    'month','2026-10-01','targetMonth','2026-12-01','transactionIds',jsonb_build_array('3eeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),'reason','Bank assigned one installment elsewhere');
  select statement_id into original_payment_id from public.transactions where description = 'Partial payment';
  preview := public.statement_adjustment(proposal);
  perform public.statement_adjustment(proposal, preview->>'fingerprint');
  if (select statement_month from public.card_statement_items where transaction_id = '3eeeeeee-eeee-4eee-8eee-eeeeeeeeeee2') <> '2026-12-01' then raise exception 'Manual installment assignment'; end if;
  if (select statement_id from public.transactions where description = 'Partial payment') <> original_payment_id then raise exception 'Moving purchase moved payment'; end if;
  update public.transactions set description = 'Edited installment' where id = '3eeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
  if (select statement_month from public.card_statement_items where transaction_id = '3eeeeeee-eeee-4eee-8eee-eeeeeeeeeee2') <> '2026-12-01' then raise exception 'Editing cleared manual allocation'; end if;
  proposal := jsonb_build_object('cardId','3ddddddd-dddd-4ddd-8ddd-dddddddddddd','operation','due','month','2026-10-01','dueDate','2026-12-05','reason','Foreign card');
  failed := false;
  begin perform public.statement_adjustment(proposal); exception when raise_exception then failed := true; end;
  if not failed then raise exception 'Foreign card adjustment allowed'; end if;
end $$;

-- Due-date changes and invalid boundaries must not change composition.
do $$
declare proposal jsonb; preview jsonb; original_total numeric; failed boolean; fingerprint text;
begin
  proposal := jsonb_build_object('cardId','3ccccccc-cccc-4ccc-8ccc-cccccccccccc','operation','due','month','2026-12-01','dueDate','2027-02-05','reason','Due only');
  select total into original_total from public.card_statements where card_id = '3ccccccc-cccc-4ccc-8ccc-cccccccccccc' and statement_month = '2026-12-01';
  preview := public.statement_adjustment(proposal);
  perform public.statement_adjustment(proposal, preview->>'fingerprint');
  if (select total from public.card_statements where card_id = '3ccccccc-cccc-4ccc-8ccc-cccccccccccc' and statement_month = '2026-12-01') <> original_total then raise exception 'Due change altered composition'; end if;
  fingerprint := md5(public.statement_adjustment(proposal)::text);
  failed := false;
  begin
    perform public.statement_adjustment(jsonb_build_object('cardId','3ccccccc-cccc-4ccc-8ccc-cccccccccccc','operation','closing','month','2026-11-01','closingDate','2027-05-20','reason','Invalid overlap'));
  exception when raise_exception then failed := true;
  end;
  if not failed then raise exception 'Overlapping cycles accepted'; end if;
  if md5(public.statement_adjustment(proposal)::text) <> fingerprint then raise exception 'Failed preview changed state'; end if;
end $$;

-- A changed transaction invalidates a reviewed adjustment, including partial payments.
do $$
declare proposal jsonb; preview jsonb; failed boolean;
begin
  proposal := jsonb_build_object('cardId','3ccccccc-cccc-4ccc-8ccc-cccccccccccc','operation','due','month','2026-10-01','dueDate','2027-01-05','reason','Concurrent change');
  preview := public.statement_adjustment(proposal);
  update public.transactions set amount = 31 where description = 'Partial payment';
  failed := false;
  begin perform public.statement_adjustment(proposal, preview->>'fingerprint'); exception when raise_exception then failed := true; end;
  if not failed then raise exception 'Changed payment did not invalidate preview'; end if;
end $$;

-- Calendar clamping and legacy payments resolve in the database, including year boundaries.
insert into public.transactions(user_id,type,description,amount,date,settlement,card_id)
values(auth.uid(),'expense','Boundary redistribution',15,'2026-11-23','card','3ccccccc-cccc-4ccc-8ccc-cccccccccccc');
do $$
declare proposal jsonb; preview jsonb;
begin
  proposal := jsonb_build_object('cardId','3ccccccc-cccc-4ccc-8ccc-cccccccccccc','operation','closing','month','2026-11-01','closingDate','2026-11-20','reason','Shorter period');
  preview := public.statement_adjustment(proposal);
  perform public.statement_adjustment(proposal, preview->>'fingerprint');
  if (select statement_month from public.card_statement_items where description = 'Boundary redistribution') <> '2026-12-01' then raise exception 'Shorter period redistribution'; end if;
  proposal := jsonb_set(proposal,'{closingDate}','"2026-11-26"');
  preview := public.statement_adjustment(proposal);
  perform public.statement_adjustment(proposal, preview->>'fingerprint');
  if (select statement_month from public.card_statement_items where description = 'Boundary redistribution') <> '2026-11-01' then raise exception 'Longer period redistribution'; end if;
  if (select statement_month from public.card_statement_items where transaction_id = '3eeeeeee-eeee-4eee-8eee-eeeeeeeeeee2') <> '2026-12-01' then raise exception 'Boundary change moved manual installment'; end if;
end $$;
insert into public.transactions(user_id,type,description,amount,date,settlement,account_id,is_card_payment,card_payment_for,card_payment_month)
values(auth.uid(),'expense','Excess payment',200,'2026-12-05','account','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'3ccccccc-cccc-4ccc-8ccc-cccccccccccc','2026-10-01');
do $$
begin
  if (select open_amount from public.card_statements where card_id = '3ccccccc-cccc-4ccc-8ccc-cccccccccccc' and statement_month = '2026-10-01') >= 0 then raise exception 'Credit lost'; end if;
end $$;

reset role;
insert into public.credit_cards(id,user_id,account_id,name,closing_day,due_day) values
 ('3fffffff-ffff-4fff-8fff-ffffffffffff','31111111-1111-4111-8111-111111111111','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Leap card',31,31);
set local role authenticated;
insert into public.transactions(user_id,type,description,amount,date,settlement,card_id)
values(auth.uid(),'expense','Leap eve',10,'2028-02-28','card','3fffffff-ffff-4fff-8fff-ffffffffffff'),
 (auth.uid(),'expense','Leap closing',10,'2028-02-29','card','3fffffff-ffff-4fff-8fff-ffffffffffff'),
 (auth.uid(),'expense','Ordinary closing',10,'2027-02-28','card','3fffffff-ffff-4fff-8fff-ffffffffffff'),
 (auth.uid(),'expense','Year closing',10,'2026-12-31','card','3fffffff-ffff-4fff-8fff-ffffffffffff');
insert into public.transactions(user_id,type,description,amount,date,settlement,account_id,is_card_payment,card_payment_for)
values(auth.uid(),'expense','Legacy payment without month',5,'2028-03-10','account','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'3fffffff-ffff-4fff-8fff-ffffffffffff');
do $$
begin
  if (select statement_month from public.card_statement_items where description = 'Leap eve') <> '2028-02-01' then raise exception 'Leap eve'; end if;
  if (select statement_month from public.card_statement_items where description = 'Leap closing') <> '2028-03-01' then raise exception 'Leap closing'; end if;
  if (select statement_month from public.card_statement_items where description = 'Ordinary closing') <> '2027-03-01' then raise exception 'Ordinary February closing'; end if;
  if (select statement_month from public.card_statement_items where description = 'Year closing') <> '2027-01-01' then raise exception 'Year boundary'; end if;
  if (select card_payment_month from public.transactions where description = 'Legacy payment without month') <> '2028-02-01' then raise exception 'Legacy payment binding'; end if;
  if exists(select 1 from public.transactions where (settlement = 'card' or is_card_payment) and statement_id is null) then raise exception 'Unbound transaction'; end if;
end $$;
-- New monthly rules redistribute only the selected/future cycles; history and payments stay bound.
do $$
declare proposal jsonb; preview jsonb; old_closing date;
begin
  select closing_date into old_closing from public.card_statements
    where card_id = '3fffffff-ffff-4fff-8fff-ffffffffffff' and statement_month = '2027-01-01';
  proposal := jsonb_build_object('cardId','3fffffff-ffff-4fff-8fff-ffffffffffff','operation','rule',
    'month','2028-02-01','effectiveMonth','2028-02-01','closingDay',25,'dueDay',10,'reason','New monthly rule');
  preview := public.statement_adjustment(proposal);
  perform public.statement_adjustment(proposal, preview->>'fingerprint');
  if (select statement_month from public.card_statement_items where description = 'Leap eve') <> '2028-03-01' then raise exception 'New rule failed to reallocate purchases'; end if;
  if (select closing_date from public.card_statements where card_id = '3fffffff-ffff-4fff-8fff-ffffffffffff' and statement_month = '2027-01-01') <> old_closing then raise exception 'New rule changed history'; end if;
  if (select card_payment_month from public.transactions where description = 'Legacy payment without month') <> '2028-02-01' then raise exception 'New rule moved payment'; end if;
end $$;
rollback;
