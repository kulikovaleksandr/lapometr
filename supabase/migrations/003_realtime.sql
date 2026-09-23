-- ============================================================================
-- Лапометр · миграция 3 (после 002_chat_photos.sql)
-- Realtime-синхронизация журнала, чата и вет-событий между устройствами.
--
-- Что делает:
--  1. Переводит id-колонки в text и снимает FK: локальные id клиентов —
--     произвольные строки, зеркалируются в облако как есть.
--  2. Добавляет cloud_access — «кто из auth-пользователей видит питомца»
--     (вместо pet_owners для RLS; локальные id хозяев не равны auth.uid()).
--  3. Добавляет vet_events + политики.
--  4. Пересоздаёт is_pet_member(text), claim_invite(text), политики DML.
--  5. mirror_upsert_logs() — зеркальная загрузка истории в обход анти-чит
--     триггера (живые вставки по-прежнему проходят проверку лимитов).
--  6. Подключает logs, chat_messages, vet_events к supabase_realtime.
-- ============================================================================

-- ---------- 1. text-ид, без FK (зеркало локальных коллекций) ----------

alter table public.pets          alter column id type text using id::text;
alter table public.pets          alter column id set default gen_random_uuid()::text;

alter table public.pet_owners    alter column pet_id  type text using pet_id::text;
alter table public.pet_owners    alter column user_id type text using user_id::text;

alter table public.activity_defs alter column id     type text using id::text;
alter table public.activity_defs alter column id set default gen_random_uuid()::text;
alter table public.activity_defs alter column pet_id type text using pet_id::text;

alter table public.logs          alter column id       type text using id::text;
alter table public.logs          alter column id set default gen_random_uuid()::text;
alter table public.logs          alter column pet_id   type text using pet_id::text;
alter table public.logs          alter column act_id   type text using act_id::text;
alter table public.logs          alter column owner_id type text using owner_id::text;

alter table public.chat_messages alter column id        type text using id::text;
alter table public.chat_messages alter column id set default gen_random_uuid()::text;
alter table public.chat_messages alter column pet_id    type text using pet_id::text;
alter table public.chat_messages alter column author_id type text using author_id::text;
alter table public.chat_messages alter column author_id set default auth.uid()::text;

alter table public.pet_owners    drop constraint if exists pet_owners_pet_id_fkey;
alter table public.pet_owners    drop constraint if exists pet_owners_user_id_fkey;
alter table public.activity_defs drop constraint if exists activity_defs_pet_id_fkey;
alter table public.logs          drop constraint if exists logs_pet_id_fkey;
alter table public.logs          drop constraint if exists logs_act_id_fkey;
alter table public.logs          drop constraint if exists logs_owner_id_fkey;
alter table public.chat_messages drop constraint if exists chat_messages_pet_id_fkey;
alter table public.chat_messages drop constraint if exists chat_messages_author_id_fkey;

-- ---------- 2. cloud_access: участники питомца (auth.uid) ----------

create table if not exists public.cloud_access (
  pet_id        text not null,
  cloud_id      text not null,               -- auth.uid()::text
  display_name  text,
  display_color text,
  primary key (pet_id, cloud_id)
);

alter table public.cloud_access enable row level security;

-- хелпер без рекурсии RLS: питомцы, где я участник
create or replace function public.my_pet_ids()
returns setof text language sql stable security definer set search_path = public as $$
  select pet_id from public.cloud_access where cloud_id = auth.uid()::text;
$$;

create policy "ca_select" on public.cloud_access for select
  using (cloud_id = auth.uid()::text or pet_id in (select public.my_pet_ids()));
create policy "ca_insert" on public.cloud_access for insert
  with check (cloud_id = auth.uid()::text);
create policy "ca_update" on public.cloud_access for update
  using (cloud_id = auth.uid()::text);
create policy "ca_delete" on public.cloud_access for delete
  using (cloud_id = auth.uid()::text);

-- ---------- 3. vet_events ----------

create table if not exists public.vet_events (
  id         text primary key,
  pet_id     text not null,
  kind       text not null default 'other',
  title      text not null,
  date       text not null,
  time       text,
  repeat     text not null default 'none',
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists vet_events_pet_idx on public.vet_events (pet_id);
alter table public.vet_events enable row level security;

-- ---------- 4. is_pet_member(text) и политики ----------

-- Каскадно убирает старые политики, зависящие от is_pet_member(uuid):
-- pets_select, po_select, po_insert, acts_*, logs_select, logs_insert, chat_*
drop function if exists public.is_pet_member(uuid) cascade;

create or replace function public.is_pet_member(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cloud_access ca
                  where ca.pet_id = p and ca.cloud_id = auth.uid()::text)
      or exists (select 1 from public.pets pp
                  where pp.id = p and pp.owner_id = auth.uid());
$$;

create policy "pets_select" on public.pets for select
  using (owner_id = auth.uid() or public.is_pet_member(id));

create policy "acts_select" on public.activity_defs for select
  using (public.is_pet_member(pet_id));
create policy "acts_insert" on public.activity_defs for insert
  with check (public.is_pet_member(pet_id));
create policy "acts_update" on public.activity_defs for update
  using (public.is_pet_member(pet_id));
create policy "acts_delete" on public.activity_defs for delete
  using (public.is_pet_member(pet_id));

create policy "logs_select" on public.logs for select
  using (public.is_pet_member(pet_id));
create policy "logs_insert" on public.logs for insert
  with check (public.is_pet_member(pet_id) and owner_id = auth.uid()::text);
create policy "logs_delete" on public.logs for delete
  using (owner_id = auth.uid()::text
         or exists (select 1 from public.pets pp where pp.id = pet_id and pp.owner_id = auth.uid()));

create policy "chat_select" on public.chat_messages for select
  using (public.is_pet_member(pet_id));
create policy "chat_insert" on public.chat_messages for insert
  with check (public.is_pet_member(pet_id) and author_id = auth.uid()::text);

create policy "vet_select" on public.vet_events for select
  using (public.is_pet_member(pet_id));
create policy "vet_insert" on public.vet_events for insert
  with check (public.is_pet_member(pet_id));
create policy "vet_update" on public.vet_events for update
  using (public.is_pet_member(pet_id));
create policy "vet_delete" on public.vet_events for delete
  using (public.is_pet_member(pet_id));

-- claim_invite теперь даёт доступ через cloud_access и возвращает text-id
drop function if exists public.claim_invite(text) cascade;
create or replace function public.claim_invite(code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  pid text;
begin
  select id into pid from public.pets where invite_code = upper(code);
  if pid is null then
    raise exception 'invalid invite code';
  end if;
  insert into public.cloud_access (pet_id, cloud_id)
  values (pid, auth.uid()::text)
  on conflict (pet_id, cloud_id) do nothing;
  return pid;
end $$;
grant execute on function public.claim_invite(text) to authenticated;

-- ---------- 5. Зеркальная загрузка истории (в обход анти-чита) ----------

create or replace function public.enforce_log_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a  public.activity_defs;
  c  bigint;
  ds timestamptz; ws timestamptz; ms timestamptz;
begin
  -- зеркальная загрузка истории помечается сессией и не проверяется
  if current_setting('lapometr.mirror', true) = 'on' then return new; end if;

  select * into a from public.activity_defs where id = new.act_id;
  if a is null then
    raise exception 'unknown activity';
  end if;
  ds := date_trunc('day',   new.at);
  ws := date_trunc('week',  new.at);
  ms := date_trunc('month', new.at);

  if a.limit_day > 0 then
    select count(*) into c from public.logs
     where act_id = new.act_id and at >= ds and at < ds + interval '1 day';
    if c >= a.limit_day then raise exception 'day limit reached'; end if;
  end if;
  if a.limit_week > 0 then
    select count(*) into c from public.logs
     where act_id = new.act_id and at >= ws and at < ws + interval '1 week';
    if c >= a.limit_week then raise exception 'week limit reached'; end if;
  end if;
  if a.limit_month > 0 then
    select count(*) into c from public.logs
     where act_id = new.act_id and at >= ms and at < ms + interval '1 month';
    if c >= a.limit_month then raise exception 'month limit reached'; end if;
  end if;
  return new;
end $$;

-- Вставка пачки истории: на мгновение гасит триггер лимитов.
-- Живые одиночные вставки клиентов по-прежнему проходят анти-чит.
create or replace function public.mirror_upsert_logs(rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  set local lapometr.mirror = 'on';
  insert into public.logs (id, pet_id, act_id, owner_id, at, img)
  select x.id, x.pet_id, x.act_id, x.owner_id, x.at, x.img
  from jsonb_to_recordset(rows)
    as x(id text, pet_id text, act_id text, owner_id text, at timestamptz, img text)
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.mirror_upsert_logs(jsonb) to authenticated;

-- ---------- 6. Realtime ----------

alter table public.logs          replica identity full;
alter table public.chat_messages replica identity full;
alter table public.vet_events    replica identity full;

do $$ begin
  alter publication supabase_realtime
    add table public.logs, public.chat_messages, public.vet_events;
exception when duplicate_object then null; end $$;
