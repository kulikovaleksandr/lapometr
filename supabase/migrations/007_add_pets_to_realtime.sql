-- Миграция 007: Добавляем таблицы pets и связанные в Realtime
-- Это необходимо для автоматической синхронизации питомцев между устройствами

-- Устанавливаем replica identity full для всех таблиц
-- Это позволяет Realtime отслеживать все изменения (INSERT, UPDATE, DELETE)
alter table public.pets replica identity full;
alter table public.activity_defs replica identity full;
alter table public.cloud_access replica identity full;
alter table public.pet_owners replica identity full;

-- Добавляем таблицы в публикацию supabase_realtime
-- Теперь изменения в этих таблицах будут автоматически передаваться через Realtime
alter publication supabase_realtime
  add table public.pets,
            public.activity_defs,
            public.cloud_access,
            public.pet_owners;

-- Проверка: убедитесь, что таблицы добавлены
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
