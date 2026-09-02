-- ============================================================
--  Лапометр · миграция 001_init.sql
--  Запуск: Supabase Dashboard → SQL Editor → вставить → Run
--  Затем в Settings приложения укажите Project URL и anon key.
--  Для Google OAuth: Supabase → Authentication → Providers →
--  Google (нужны Client ID/Secret из Google Cloud Console).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Таблицы ----------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  name       text not null default 'Хозяин',
  color      text not null default '#f2b45a',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.pets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  species     text not null default 'cat',
  breed       text,
  birthday    date,
  color       text not null default '#e8a34e',
  avatar_url  text,
  invite_code text unique,
  created_at  timestamptz not null default now()
);

create table public.pet_owners (
  pet_id    uuid not null references public.pets (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'owner',
  joined_at timestamptz not null default now(),
  primary key (pet_id, user_id)
);

create table public.activity_defs (
  id           uuid primary key default gen_random_uuid(),
  pet_id       uuid not null references public.pets (id) on delete cascade,
  title        text not null,
  icon         text not null default 'paw',
  color        text not null default '#e8a34e',
  paws         int  not null default 5 check (paws >= 0),
  limit_day    int  not null default 0,
  limit_week   int  not null default 0,
  limit_month  int  not null default 0,
  remind_hours int  not null default 0,
  is_custom    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.logs (
  id       uuid primary key default gen_random_uuid(),
  pet_id   uuid not null references public.pets (id) on delete cascade,
  act_id   uuid not null references public.activity_defs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  at       timestamptz not null default now()
);
create index logs_pet_at_idx  on public.logs (pet_id, at desc);
create index logs_owner_at_ix on public.logs (owner_id, at desc);

-- Снапшот для быстрой двусторонней синхронизации клиентов
create table public.sync_snapshots (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- RLS ----------

alter table public.profiles      enable row level security;
alter table public.pets          enable row level security;
alter table public.pet_owners    enable row level security;
alter table public.activity_defs enable row level security;
alter table public.logs          enable row level security;
alter table public.sync_snapshots enable row level security;

-- Хелпер: является ли текущий пользователь участником питомца
create or replace function public.is_pet_member(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pet_owners po
                  where po.pet_id = p and po.user_id = auth.uid())
      or exists (select 1 from public.pets pp
                  where pp.id = p and pp.owner_id = auth.uid());
$$;
grant execute on function public.is_pet_member(uuid) to authenticated;

-- profiles: только свои
create policy "profiles_all_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- pets: видят участники, создаёт/меняет владелец
create policy "pets_select" on public.pets for select
  using (owner_id = auth.uid() or public.is_pet_member(id));
create policy "pets_insert" on public.pets for insert
  with check (owner_id = auth.uid());
create policy "pets_update" on public.pets for update
  using (owner_id = auth.uid());
create policy "pets_delete" on public.pets for delete
  using (owner_id = auth.uid());

-- pet_owners: читают участники; запись — через claim_invite или владельцу
create policy "po_select" on public.pet_owners for select
  using (user_id = auth.uid() or public.is_pet_member(pet_id));
create policy "po_insert" on public.pet_owners for insert
  with check (user_id = auth.uid() and public.is_pet_member(pet_id));
create policy "po_delete" on public.pet_owners for delete
  using (user_id = auth.uid()
         or exists (select 1 from public.pets pp where pp.id = pet_id and pp.owner_id = auth.uid()));

-- activity_defs и logs: все участники питомца
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
  with check (public.is_pet_member(pet_id) and owner_id = auth.uid());
create policy "logs_delete" on public.logs for delete
  using (owner_id = auth.uid()
         or exists (select 1 from public.pets pp where pp.id = pet_id and pp.owner_id = auth.uid()));

-- snapshots: строго личные
create policy "snap_all_self" on public.sync_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Анти-чит: лимиты активностей (день/неделя/месяц) ----------

create or replace function public.enforce_log_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a  public.activity_defs;
  c  bigint;
  ds timestamptz; ws timestamptz; ms timestamptz;
begin
  select * into a from public.activity_defs where id = new.act_id;
  if a is null then
    raise exception 'unknown activity';
  end if;
  ds := date_trunc('day',   new.at);
  ws := date_trunc('week',  new.at);  -- Postgres: неделя с понедельника
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

create trigger logs_limit_check
  before insert on public.logs
  for each row execute function public.enforce_log_limits();

-- ---------- Приглашение второго хозяина по коду ----------

create or replace function public.claim_invite(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
begin
  select id into pid from public.pets where invite_code = code;
  if pid is null then
    raise exception 'invalid invite code';
  end if;
  insert into public.pet_owners (pet_id, user_id)
  values (pid, auth.uid())
  on conflict (pet_id, user_id) do nothing;
  return pid;
end $$;

grant execute on function public.claim_invite(text) to authenticated;

-- ---------- Автопрофиль при регистрации ----------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'name', 'Хозяин'))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
