-- flowly — 0012_tags.sql
-- Tags como dimensão paralela à categoria.
--
-- Categoria responde "que tipo de gasto é este" e é exclusiva: uma transação
-- tem uma só. Tag responde "a que isso pertence" e é múltipla — "viagem chile
-- 2026" cruza Alimentação, Transporte e Lazer. Daí a tabela de junção em vez
-- de uma coluna em transactions.

create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#7B82A0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_color_hex check (color ~* '^#[0-9a-f]{6}$'),
  constraint tags_name_len  check (char_length(trim(name)) between 1 and 30)
);

create unique index if not exists tags_user_name_uniq
  on public.tags (user_id, lower(name));

create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

-- Junção. on delete cascade nos dois lados: apagar a tag tira o vínculo,
-- apagar a transação idem — o vínculo não tem vida própria.
create table if not exists public.transaction_tags (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  tag_id         uuid not null references public.tags(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (transaction_id, tag_id)
);

create index if not exists transaction_tags_tag_idx on public.transaction_tags (user_id, tag_id);

-- ---------------------------------------------------------------- RLS
alter table public.tags             enable row level security;
alter table public.transaction_tags enable row level security;

create policy "tags_select_own" on public.tags
  for select using (auth.uid() = user_id);
create policy "tags_insert_own" on public.tags
  for insert with check (auth.uid() = user_id);
create policy "tags_update_own" on public.tags
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tags_delete_own" on public.tags
  for delete using (auth.uid() = user_id);

create policy "transaction_tags_select_own" on public.transaction_tags
  for select using (auth.uid() = user_id);
create policy "transaction_tags_insert_own" on public.transaction_tags
  for insert with check (auth.uid() = user_id);
create policy "transaction_tags_delete_own" on public.transaction_tags
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------- totais
-- Quanto cada tag acumulou por mês. Ignora pagamento de fatura e
-- transferência, pelo mesmo motivo das outras views: não são gasto novo.
create or replace view public.tag_month_totals
with (security_invoker = true) as
select
  tt.user_id,
  tt.tag_id,
  g.name,
  g.color,
  date_trunc('month', t.date)::date as month,
  coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::numeric(14,2) as expense,
  coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::numeric(14,2)  as income,
  count(*)                                                                    as items
from public.transaction_tags tt
join public.transactions t on t.id = tt.transaction_id
join public.tags g         on g.id = tt.tag_id
where t.is_card_payment = false and t.is_transfer = false
group by tt.user_id, tt.tag_id, g.name, g.color, date_trunc('month', t.date);
