-- Миграция 005: Push subscriptions для Web Push уведомлений

-- Таблица для хранения push subscriptions пользователей
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Индексы для быстрого поиска
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index if not exists push_subscriptions_endpoint_idx on public.push_subscriptions(endpoint);

-- Включаем RLS
alter table public.push_subscriptions enable row level security;

-- Политики RLS
-- Пользователи могут читать только свои подписки
create policy "Users can view own subscriptions"
  on public.push_subscriptions
  for select
  using (auth.uid() = user_id);

-- Пользователи могут создавать только свои подписки
create policy "Users can create own subscriptions"
  on public.push_subscriptions
  for insert
  with check (auth.uid() = user_id);

-- Пользователи могут обновлять только свои подписки
create policy "Users can update own subscriptions"
  on public.push_subscriptions
  for update
  using (auth.uid() = user_id);

-- Пользователи могут удалять только свои подписки
create policy "Users can delete own subscriptions"
  on public.push_subscriptions
  for delete
  using (auth.uid() = user_id);

-- Функция для автоматического обновления updated_at
create or replace function public.handle_push_subscription_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Триггер для автоматического обновления updated_at
create trigger on_push_subscription_updated
  before update on public.push_subscriptions
  for each row
  execute procedure public.handle_push_subscription_updated_at();
