-- flowly — 0003_seed_defaults.sql
-- Cria o profile e as 6 categorias default automaticamente no signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, color, kind, budget, position)
  values
    (new.id, 'Alimentação', '#5B6EF5', 'expense', 0, 1),
    (new.id, 'Moradia',     '#2ECC9A', 'expense', 0, 2),
    (new.id, 'Saúde',       '#F05C5C', 'expense', 0, 3),
    (new.id, 'Transporte',  '#F5A623', 'expense', 0, 4),
    (new.id, 'Lazer',       '#A78BFA', 'expense', 0, 5),
    (new.id, 'Educação',    '#38BDF8', 'expense', 0, 6)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill para usuários que já existiam antes deste trigger
insert into public.profiles (id)
select u.id from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
