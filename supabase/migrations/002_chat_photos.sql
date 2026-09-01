-- ============================================================================
-- Лапометр · миграция 2 (после 001_init.sql)
-- Чат хозяев + фотографии у записей журнала
-- ============================================================================

-- Фото у записи (data-URL или путь к storage)
alter table public.logs add column if not exists img text;

-- Чат: сообщения видят только хозяева питомца, пишет только автор
create table if not exists public.chat_messages (
  id        uuid primary key default gen_random_uuid(),
  pet_id    uuid not null references public.pets (id) on delete cascade,
  author_id uuid not null default auth.uid(),
  text      text not null check (char_length(btrim(text)) between 1 and 500),
  at        timestamptz not null default now()
);

create index if not exists chat_messages_pet_at_idx
  on public.chat_messages (pet_id, at);

alter table public.chat_messages enable row level security;

create policy "chat_select" on public.chat_messages for select
  using (public.is_pet_member(pet_id));

create policy "chat_insert" on public.chat_messages for insert
  with check (public.is_pet_member(pet_id) and author_id = auth.uid());
