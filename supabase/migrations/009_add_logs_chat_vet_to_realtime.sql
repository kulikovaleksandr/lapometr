-- Миграция 009: Добавляем таблицы logs, chat_messages и vet_events в Realtime
-- Эти таблицы были созданы в миграции 001, но не добавлены в Realtime-публикацию

-- Устанавливаем replica identity full для таблиц
-- Это позволяет Realtime отслеживать все изменения (INSERT, UPDATE, DELETE)
alter table public.logs replica identity full;
alter table public.chat_messages replica identity full;
alter table public.vet_events replica identity full;

-- Добавляем таблицы в публикацию supabase_realtime
-- Теперь изменения в этих таблицах будут автоматически передаваться через Realtime
alter publication supabase_realtime
  add table public.logs,
            public.chat_messages,
            public.vet_events;

-- Проверка: убедитесь, что таблицы добавлены
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Итоговый список всех 9 таблиц в Realtime-публикации:
-- 1. logs - записи журнала активностей
-- 2. chat_messages - сообщения чата
-- 3. vet_events - ветеринарные события
-- 4. pets - питомцы
-- 5. activity_defs - определения активностей
-- 6. cloud_access - доступ пользователей к питомцам
-- 7. pet_owners - владельцы питомцев
-- 8. weights - записи веса
-- 9. expenses - расходы
