-- Somente em PostgreSQL descartável com todas as migrations. Nada é persistido.
begin;
insert into auth.users(id,email) values
 ('41111111-1111-4111-8111-111111111111','refund-a@example.invalid'),
 ('42222222-2222-4222-8222-222222222222','refund-b@example.invalid');
insert into public.accounts(id,user_id,name,opening_balance) values
 ('4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','41111111-1111-4111-8111-111111111111','Refund A',1000),
 ('4bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','42222222-2222-4222-8222-222222222222','Refund B',1000);
insert into public.credit_cards(id,user_id,account_id,name,closing_day,due_day) values
 ('4ccccccc-cccc-4ccc-8ccc-ccccccccccc1','41111111-1111-4111-8111-111111111111','4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Refund card',20,5),
 ('4ccccccc-cccc-4ccc-8ccc-ccccccccccc2','41111111-1111-4111-8111-111111111111','4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Other own card',20,5),
 ('4ddddddd-dddd-4ddd-8ddd-dddddddddddd','42222222-2222-4222-8222-222222222222','4bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Foreign card',20,5);
insert into public.categories(id,user_id,name,kind,budget) values
 ('4eeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','41111111-1111-4111-8111-111111111111','Refund expenses','expense',300),
 ('4eeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','42222222-2222-4222-8222-222222222222','Foreign expenses','expense',300);
insert into public.tags(id,user_id,name) values
 ('4fffffff-ffff-4fff-8fff-fffffffffff1','41111111-1111-4111-8111-111111111111','Refund tag'),
 ('4fffffff-ffff-4fff-8fff-fffffffffff2','42222222-2222-4222-8222-222222222222','Foreign tag');
insert into public.transactions(id,user_id,type,description,amount,date,settlement,card_id,category_id,
  installment_group,installment_no,installment_total) values
 ('45555555-5555-4555-8555-555555555551','41111111-1111-4111-8111-111111111111','expense','Purchase 1/2',100,'2026-09-10','card','4ccccccc-cccc-4ccc-8ccc-ccccccccccc1','4eeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','46666666-6666-4666-8666-666666666666',1,2),
 ('45555555-5555-4555-8555-555555555552','41111111-1111-4111-8111-111111111111','expense','Purchase 2/2',100,'2026-10-10','card','4ccccccc-cccc-4ccc-8ccc-ccccccccccc1','4eeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','46666666-6666-4666-8666-666666666666',2,2);
insert into public.transactions(user_id,type,description,amount,date,settlement,account_id,is_card_payment,card_payment_for,card_payment_month)
 values('41111111-1111-4111-8111-111111111111','expense','Paid September',100,'2026-10-05','account',
 '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'4ccccccc-cccc-4ccc-8ccc-ccccccccccc1','2026-09-01');
set local role authenticated;
select set_config('request.jwt.claim.sub','41111111-1111-4111-8111-111111111111',true);

do $$
declare target uuid; second_target uuid; refund_id uuid; draft jsonb; totals jsonb; before_balance numeric;
  history_count bigint; failed boolean; original_count bigint; preview jsonb;
begin
  select statement_id into target from public.card_statements where card_id = '4ccccccc-cccc-4ccc-8ccc-ccccccccccc1' and statement_month = '2026-09-01';
  select balance into before_balance from public.account_balances where account_id = '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  select count(*) into history_count from public.account_balance_history;
  draft := jsonb_build_object('description','Refund','amount',150,'date','2026-11-02',
    'cardId','4ccccccc-cccc-4ccc-8ccc-ccccccccccc1','statementId',target,
    'categoryId','4eeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','relatedPurchaseId','45555555-5555-4555-8555-555555555551',
    'tagIds',jsonb_build_array('4fffffff-ffff-4fff-8fff-fffffffffff1'));
  -- Parcial, total e excedente em fatura ainda não paga, com categoria opcional.
  select statement_id into second_target from public.card_statements where card_id = '4ccccccc-cccc-4ccc-8ccc-ccccccccccc1' and statement_month = '2026-10-01';
  refund_id := public.save_card_refund(null,draft || jsonb_build_object('amount',40,'statementId',second_target,'categoryId',null,'relatedPurchaseId',null));
  if (select open_amount from public.card_statements where statement_id = second_target) <> 60 then raise exception 'Partial refund'; end if;
  perform public.save_card_refund(refund_id,draft || jsonb_build_object('amount',100,'statementId',second_target,'categoryId',null));
  if (select open_amount from public.card_statements where statement_id = second_target) <> 0 then raise exception 'Full refund'; end if;
  perform public.save_card_refund(refund_id,draft || jsonb_build_object('statementId',second_target,'categoryId',null));
  if (select open_amount from public.card_statements where statement_id = second_target) <> -50 then raise exception 'Excess refund'; end if;
  delete from public.transactions where id = refund_id;
  refund_id := public.save_card_refund(null,draft);
  if (select total from public.card_statements where statement_id = target) <> -50 then raise exception 'Net total'; end if;
  if (select open_amount from public.card_statements where statement_id = target) <> -150 then raise exception 'Paid statement credit'; end if;
  if (select paid from public.card_statements where statement_id = target) <> 100 then raise exception 'Payment changed'; end if;
  if (select purchases_total from public.card_statements where statement_id = target) <> 100 then raise exception 'Gross purchases'; end if;
  if (select refund_total from public.card_statements where statement_id = target) <> 150 then raise exception 'Refund total'; end if;
  if (select income from public.monthly_flow where month = '2026-11-01') <> 0 then raise exception 'Refund counted as income'; end if;
  if (select expense from public.monthly_flow where month = '2026-11-01') <> -150 then raise exception 'Expense month'; end if;
  if (select spent from public.category_month_spending where category_id = '4eeeeeee-eeee-4eee-8eee-eeeeeeeeeee1' and month = '2026-11-01') <> -150 then raise exception 'Category credit'; end if;
  if (select expense from public.tag_month_totals where tag_id = '4fffffff-ffff-4fff-8fff-fffffffffff1' and month = '2026-11-01') <> -150 then raise exception 'Tag credit'; end if;
  if (select expense from public.card_month_totals where card_id = '4ccccccc-cccc-4ccc-8ccc-ccccccccccc1' and month = '2026-11-01') <> -150 then raise exception 'Card report'; end if;
  totals := public.assistant_transaction_totals('2026-11-01','2026-11-30',null,null,null,null,null);
  if (totals->>'income')::numeric <> 0 or (totals->>'expense')::numeric <> -150 or (totals->>'balance')::numeric <> 150 then raise exception 'Assistant totals'; end if;
  if totals->'categories'->0->>'type' <> 'expense' then raise exception 'Assistant category nature'; end if;
  update public.transactions set date = '2026-12-03' where id = refund_id;
  if (select statement_id from public.transactions where id = refund_id) <> target then raise exception 'Date moved refund'; end if;
  if exists(select 1 from public.transactions where installment_group = '46666666-6666-4666-8666-666666666666' and (amount <> 100 or date not in ('2026-09-10','2026-10-10'))) then raise exception 'Purchase history changed'; end if;

  -- Falha em tag/categoria/referência de outro usuário não deixa gravação parcial.
  select count(*) into original_count from public.transactions;
  failed := false;
  begin perform public.save_card_refund(null,draft || '{"tagIds":["4fffffff-ffff-4fff-8fff-fffffffffff2"]}');
  exception when raise_exception then failed := true; end;
  if not failed or (select count(*) from public.transactions) <> original_count then raise exception 'Foreign tag/atomicity'; end if;
  failed := false;
  begin perform public.save_card_refund(refund_id,draft || '{"categoryId":"4eeeeeee-eeee-4eee-8eee-eeeeeeeeeee2"}');
  exception when raise_exception then failed := true; end;
  if not failed or (select count(*) from public.transaction_tags where transaction_id = refund_id) <> 1 then raise exception 'Foreign category/atomic edit'; end if;
  failed := false;
  begin perform public.save_card_refund(null,draft || '{"cardId":"4ddddddd-dddd-4ddd-8ddd-dddddddddddd"}');
  exception when raise_exception then failed := true; end;
  if not failed then raise exception 'Foreign card accepted'; end if;
  failed := false;
  begin update public.transactions set type = 'expense' where id = refund_id;
  exception when raise_exception then failed := true; end;
  if not failed then raise exception 'Nature conversion accepted'; end if;

  -- Mudar o destino explicitamente aceita outro cartão próprio.
  perform public.ensure_statement_month('2026-11-01');
  select statement_id into second_target from public.card_statements where card_id = '4ccccccc-cccc-4ccc-8ccc-ccccccccccc2' and statement_month = '2026-11-01';
  perform public.save_card_refund(refund_id,draft || jsonb_build_object('cardId','4ccccccc-cccc-4ccc-8ccc-ccccccccccc2','statementId',second_target,'relatedPurchaseId',null));
  if (select statement_id from public.transactions where id = refund_id) <> second_target then raise exception 'Explicit card move'; end if;
  perform public.save_card_refund(refund_id,draft);
  delete from public.transactions where id = '45555555-5555-4555-8555-555555555551';
  if (select related_purchase_id from public.transactions where id = refund_id) is not null then raise exception 'Deleted reference'; end if;
  if (select amount from public.transactions where id = refund_id) <> 150 then raise exception 'Reference deletion changed credit'; end if;

  -- Crédito acompanha reunião, mas não ganha transferência bancária.
  draft := jsonb_build_object('cardId','4ccccccc-cccc-4ccc-8ccc-ccccccccccc1','operation','merge',
    'month','2026-09-01','targetMonth','2026-10-01','closingDate','2026-10-25','dueDate','2026-12-05','reason','Refund test merge');
  preview := public.statement_adjustment(draft);
  perform public.statement_adjustment(draft,preview->>'fingerprint');
  if (select statement_id from public.transactions where id = refund_id) = target then raise exception 'Merge lost refund'; end if;
  if (select balance from public.account_balances where account_id = '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> before_balance then raise exception 'Bank balance changed'; end if;
  if (select count(*) from public.account_balance_history) <> history_count then raise exception 'Bank history changed'; end if;
  delete from public.transactions where id = refund_id;
  if exists(select 1 from public.transaction_tags where transaction_id = refund_id) then raise exception 'Orphan refund tags'; end if;
end $$;
rollback;
