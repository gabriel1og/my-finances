-- Run AFTER all migrations, in a disposable database. Everything rolls back.
begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','assistant-test-a@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','assistant-test-b@example.invalid');
insert into public.accounts(id,user_id,name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Test A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Test B');
insert into public.credit_cards(id,user_id,account_id,name,closing_day,due_day) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test card',28,5);
insert into public.transactions(user_id,type,description,amount,date,account_id)
 select '11111111-1111-4111-8111-111111111111','expense','Test expense',1,'2026-10-01','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' from generate_series(1,1205);
insert into public.transactions(user_id,type,description,amount,date,account_id) values
 ('22222222-2222-4222-8222-222222222222','expense','Other user',90000,'2026-10-01','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.transactions(user_id,type,description,amount,date,account_id,is_transfer,transfer_group) values
 ('11111111-1111-4111-8111-111111111111','expense','Transfer',100,'2026-10-01','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,gen_random_uuid());
insert into public.transactions(user_id,type,description,amount,date,account_id,is_card_payment,card_payment_for,card_payment_month) values
 ('11111111-1111-4111-8111-111111111111','expense','Card payment',100,'2026-10-01','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','2026-10-01');
insert into public.assistant_conversations(id,user_id,title) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','A'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222222','B');
insert into public.assistant_executions(user_id,request_id,conversation_id,message,selected_month,usage_day,status,expires_at) values
 ('22222222-2222-4222-8222-222222222222',gen_random_uuid(),'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','expired','2026-10-01',(now() at time zone 'America/Sao_Paulo')::date,'reserved',now()-interval '1 minute'),
 ('22222222-2222-4222-8222-222222222222',gen_random_uuid(),'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','yesterday','2026-10-01',(now() at time zone 'America/Sao_Paulo')::date-1,'completed',now()-interval '1 day');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare reservation jsonb; repeated jsonb; totals jsonb; req uuid := gen_random_uuid(); lease uuid;
begin
 if (select count(*) from public.assistant_conversations) <> 1 then raise exception 'Conversation RLS leak'; end if;
 totals := public.assistant_transaction_totals('2026-09-01','2026-10-31',null,null,null,null,null);
 if (totals->>'expense')::numeric <> 1205 then raise exception 'Wrong total or financial RLS leak: %',totals; end if;
 if totals->'monthly'->0->>'expense' <> '0' then raise exception 'Missing zero month'; end if;
 reservation := public.assistant_reserve('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',req,'test','2026-10-01');
 if reservation->>'status' <> 'not_found' then raise exception 'Foreign conversation accessible'; end if;
 reservation := public.assistant_reserve('dddddddd-dddd-4ddd-8ddd-dddddddddddd',req,'test','2026-10-01');
 if reservation->>'status' <> 'reserved' then raise exception 'Reservation failed: %',reservation; end if;
 if public.assistant_delete('dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 'busy' then raise exception 'Active conversation deleted'; end if;
 lease := (reservation->>'leaseId')::uuid;
 repeated := public.assistant_reserve('dddddddd-dddd-4ddd-8ddd-dddddddddddd',req,'different','2026-10-01');
 if repeated->>'status' <> 'conflict' then raise exception 'Request payload not deduplicated'; end if;
 repeated := public.assistant_reserve('dddddddd-dddd-4ddd-8ddd-dddddddddddd',gen_random_uuid(),'second','2026-10-01');
 if repeated->>'status' <> 'busy' then raise exception 'Simultaneous reservation allowed'; end if;
 if public.assistant_finish(req,gen_random_uuid(),'{}') then raise exception 'Forged lease committed'; end if;
 if not public.assistant_finish(req,lease,null) then raise exception 'Failure release failed'; end if;
 reservation := public.assistant_reserve('dddddddd-dddd-4ddd-8ddd-dddddddddddd',req,'test','2026-10-01');
 if reservation->>'remaining' <> '29' then raise exception 'Failed request charged quota'; end if;
 if public.assistant_finish(req,lease,'{}') then raise exception 'Stale worker committed'; end if;
 if not public.assistant_finish(req,(reservation->>'leaseId')::uuid,'{"text":"ok","tables":[],"sources":[],"period":"test","consultedAt":"2026-10-07T00:00:00Z"}') then raise exception 'Commit failed'; end if;
 repeated := public.assistant_reserve('dddddddd-dddd-4ddd-8ddd-dddddddddddd',req,'test','2026-10-01');
 if repeated->>'status' <> 'completed' or repeated->'response'->>'text' <> 'ok' then raise exception 'Completed request not recovered'; end if;
 if (select count(*) from public.assistant_messages) <> 2 then raise exception 'Duplicate messages'; end if;
 begin
  insert into public.assistant_messages(conversation_id,user_id,request_id,role,content) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd',auth.uid(),gen_random_uuid(),'assistant','{}');
  raise exception 'Direct message writes permitted';
 exception when insufficient_privilege then null; end;
 for i in 2..30 loop
  req := gen_random_uuid();
  reservation := public.assistant_reserve('dddddddd-dddd-4ddd-8ddd-dddddddddddd',req,'test quota','2026-10-01');
  if reservation->>'status' <> 'reserved' then raise exception 'Quota reached too soon'; end if;
  perform public.assistant_finish(req,(reservation->>'leaseId')::uuid,'{}');
 end loop;
 reservation := public.assistant_reserve('dddddddd-dddd-4ddd-8ddd-dddddddddddd',gen_random_uuid(),'31st','2026-10-01');
 if reservation->>'status' <> 'quota' then raise exception 'Quota not enforced'; end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ declare reservation jsonb; begin
 if exists(select 1 from public.assistant_messages) then raise exception 'Message RLS leak'; end if;
 if (select count(*) from public.assistant_executions) <> 2 then raise exception 'Execution RLS leak'; end if;
 reservation := public.assistant_reserve('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',gen_random_uuid(),'retry expired lease','2026-10-01');
 if reservation->>'status' <> 'reserved' or reservation->>'remaining' <> '29' then raise exception 'Expired lease or previous day charged quota: %',reservation; end if;
 if public.assistant_delete('dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 'not_found' then raise exception 'Foreign delete permitted'; end if;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
 if not exists(select 1 from public.assistant_conversations) then raise exception 'Foreign delete succeeded'; end if;
 if public.assistant_delete('dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 'deleted' then raise exception 'Own delete failed'; end if;
 if exists(select 1 from public.assistant_messages) or exists(select 1 from public.assistant_executions) then raise exception 'Delete cascade failed'; end if;
 insert into public.assistant_conversations(id,user_id,title) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd',auth.uid(),'After deletion');
 if public.assistant_reserve('dddddddd-dddd-4ddd-8ddd-dddddddddddd',gen_random_uuid(),'bypass quota by deleting history','2026-10-01')->>'status' <> 'quota' then raise exception 'Conversation deletion bypassed quota'; end if;
end $$;
rollback;
select 'Assistant database assertions passed' as result;
