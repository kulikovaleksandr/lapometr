-- Миграция 001: Базовая структура базы данных
-- Создаёт основные таблицы для приложения Лапометр

-- Таблица профилей пользователей
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Таблица питомцев
create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  species text not null,
  breed text,
  birthday date,
  color text,
  img text,
  invite_code text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Таблица владельцев питомцев (для мультипользовательского доступа)
create table if not exists public.pet_owners (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null default 'owner',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(pet_id, user_id)
);

-- Таблица облачного доступа
create table if not exists public.cloud_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  cloud_id text unique not null,
  display_name text,
  display_color text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Таблица определений активностей
create table if not exists public.activity_defs (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete cascade not null,
  title text not null,
  icon text not null,
  color text not null,
  paws integer not null default 1,
  limit_day integer,
  limit_week integer,
  limit_month integer,
  remind_h integer,
  custom boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Таблица записей журнала
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete cascade not null,
  act_id uuid references public.activity_defs(id) on delete cascade not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  at timestamp with time zone default timezone('utc'::text, now()) not null,
  img text,
  on_behalf_of uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Таблица сообщений чата
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Таблица ветеринарных событий
create table if not exists public.vet_events (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete cascade not null,
  kind text not null,
  title text not null,
  date date not null,
  time time,
  repeat text,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Таблица записей веса
create table if not exists public.weights (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete cascade not null,
  weight numeric(5,2) not null,
  date date not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Таблица расходов
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete cascade not null,
  category text not null,
  amount numeric(10,2) not null,
  date date not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Таблица снапшотов для синхронизации
create table if not exists public.sync_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
   jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Таблица подписок на push-уведомления
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Индексы для оптимизации запросов
create index if not exists idx_pets_owner_id on public.pets(owner_id);
create index if not exists idx_pet_owners_pet_id on public.pet_owners(pet_id);
create index if not exists idx_pet_owners_user_id on public.pet_owners(user_id);
create index if not exists idx_activity_defs_pet_id on public.activity_defs(pet_id);
create index if not exists idx_logs_pet_id on public.logs(pet_id);
create index if not exists idx_logs_owner_id on public.logs(owner_id);
create index if not exists idx_logs_at on public.logs(at);
create index if not exists idx_chat_messages_pet_id on public.chat_messages(pet_id);
create index if not exists idx_chat_messages_at on public.chat_messages(at);
create index if not exists idx_vet_events_pet_id on public.vet_events(pet_id);
create index if not exists idx_vet_events_date on public.vet_events(date);
create index if not exists idx_weights_pet_id on public.weights(pet_id);
create index if not exists idx_weights_date on public.weights(date);
create index if not exists idx_expenses_pet_id on public.expenses(pet_id);
create index if not exists idx_expenses_date on public.expenses(date);
create index if not exists idx_sync_snapshots_user_id on public.sync_snapshots(user_id);
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);

-- Включаем RLS для всех таблиц
alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.pet_owners enable row level security;
alter table public.cloud_access enable row level security;
alter table public.activity_defs enable row level security;
alter table public.logs enable row level security;
alter table public.chat_messages enable row level security;
alter table public.vet_events enable row level security;
alter table public.weights enable row level security;
alter table public.expenses enable row level security;
alter table public.sync_snapshots enable row level security;
alter table public.push_subscriptions enable row level security;

-- RLS политики для profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- RLS политики для pets
create policy "Users can view own pets"
  on public.pets for select
  using (auth.uid() = owner_id);

create policy "Users can insert own pets"
  on public.pets for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own pets"
  on public.pets for update
  using (auth.uid() = owner_id);

create policy "Users can delete own pets"
  on public.pets for delete
  using (auth.uid() = owner_id);

-- RLS политики для pet_owners
create policy "Users can view pet owners"
  on public.pet_owners for select
  using (auth.uid() = user_id);

create policy "Users can insert pet owners"
  on public.pet_owners for insert
  with check (auth.uid() = user_id);

create policy "Users can delete pet owners"
  on public.pet_owners for delete
  using (auth.uid() = user_id);

-- RLS политики для cloud_access
create policy "Users can view own cloud access"
  on public.cloud_access for select
  using (auth.uid() = user_id);

create policy "Users can insert own cloud access"
  on public.cloud_access for insert
  with check (auth.uid() = user_id);

create policy "Users can update own cloud access"
  on public.cloud_access for update
  using (auth.uid() = user_id);

-- RLS политики для activity_defs
create policy "Users can view activity defs for own pets"
  on public.activity_defs for select
  using (
    exists (
      select 1 from public.pets
      where pets.id = activity_defs.pet_id
      and pets.owner_id = auth.uid()
    )
  );

create policy "Users can insert activity defs for own pets"
  on public.activity_defs for insert
  with check (
    exists (
      select 1 from public.pets
      where pets.id = activity_defs.pet_id
      and pets.owner_id = auth.uid()
    )
  );

create policy "Users can update activity defs for own pets"
  on public.activity_defs for update
  using (
    exists (
      select 1 from public.pets
      where pets.id = activity_defs.pet_id
      and pets.owner_id = auth.uid()
    )
  );

create policy "Users can delete activity defs for own pets"
  on public.activity_defs for delete
  using (
    exists (
      select 1 from public.pets
      where pets.id = activity_defs.pet_id
      and pets.owner_id = auth.uid()
    )
  );

-- RLS политики для logs
create policy "Users can view logs for own pets"
  on public.logs for select
  using (
    exists (
      select 1 from public.pets
      where pets.id = logs.pet_id
      and pets.owner_id = auth.uid()
    )
  );

create policy "Users can insert logs for own pets"
  on public.logs for insert
  with check (auth.uid() = owner_id);

create policy "Users can delete own logs"
  on public.logs for delete
  using (auth.uid() = owner_id);

-- RLS политики для chat_messages
create policy "Users can view chat messages for own pets"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.pets
      where pets.id = chat_messages.pet_id
      and pets.owner_id = auth.uid()
    )
  );

create policy "Users can insert chat messages for own pets"
  on public.chat_messages for insert
  with check (auth.uid() = author_id);

-- RLS политики для vet_events
create policy "Users can view vet events for own pets"
  on public.vet_events for select
  using (
    exists (
      select 1 from public.pets
      where pets.id = vet_events.pet_id
      and pets.owner_id = auth.uid()
    )
  );

create policy "Users can insert vet events for own pets"
  on public.vet_events for insert
  with check (
    exists (
      select 1 from public.pets
      where pets.id = vet_events.pet_id
      and pets.owner_id = auth.uid()
    )
  );

create policy "Users can update vet events for own pets"
  on public.vet_events for update
  using (
    exists (
      select 1 from public.pets
      where pets.id = vet_events.pet_id
      and pets.owner_id = auth.uid()
    )
  );

create policy "Users can delete vet events for own pets"
  on public.vet_events for delete
  using (
    exists (
      select 1 from public.pets
      where pets.id = vet_events.pet_id
      and pets.owner_id = auth.uid()
    )
  );

-- RLS политики для weights
create policy "Users can view weights for own pets"
  on public.weights for select
  using (
    exists (
      select 1 from public.pets
      where pets.id = weights.pet_id
      and pets.owner_id = auth.uid()
    )
  );

create policy "Users can insert weights for own pets"
  on public.weights for insert
  with check (
    exists (
      select 1 from public.pets
      where pets.id = weights.pet_id
      and pets.owner_id = auth.uid()
    )
  );

create policy "Users can delete weights for own pets"
  on public.weights for delete
  using (
    exists (
      select 1 from public.pets
      where pets.id = weights.pet_id
      and pets.owner_id = auth.uid()
    )
  );

-- RLS политики для expenses
create policy "Users can view expenses for own pets"
  on public.expenses for select
  using (
    exists (
      select 1 from public.pets
      where pets.id = expenses.pet_id
      and pets.owner_id = auth.uid()
    )
  );

create policy "Users can insert expenses for own pets"
  on public.expenses for insert
  with check (
    exists (
      select 1 from public.pets
      where pets.id = expenses.pet_id
      and pets.owner_id = auth.uid()
    )
  );

create policy "Users can delete expenses for own pets"
  on public.expenses for delete
  using (
    exists (
      select 1 from public.pets
      where pets.id = expenses.pet_id
      and pets.owner_id = auth.uid()
    )
  );

-- RLS политики для sync_snapshots
create policy "Users can view own snapshots"
  on public.sync_snapshots for select
  using (auth.uid() = user_id);

create policy "Users can insert own snapshots"
  on public.sync_snapshots for insert
  with check (auth.uid() = user_id);

create policy "Users can update own snapshots"
  on public.sync_snapshots for update
  using (auth.uid() = user_id);

create policy "Users can delete own snapshots"
  on public.sync_snapshots for delete
  using (auth.uid() = user_id);

-- RLS политики для push_subscriptions
create policy "Users can view own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- Функция для автоматического обновления updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Триггеры для автоматического обновления updated_at
create trigger on_profiles_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger on_pets_updated
  before update on public.pets
  for each row execute procedure public.handle_updated_at();

create trigger on_activity_defs_updated
  before update on public.activity_defs
  for each row execute procedure public.handle_updated_at();

create trigger on_vet_events_updated
  before update on public.vet_events
  for each row execute procedure public.handle_updated_at();
