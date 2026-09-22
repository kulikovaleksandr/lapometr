-- Миграция 008: Добавляем таблицы weights и expenses в Realtime
-- Это необходимо для автоматической синхронизации записей веса и расходов между устройствами

-- Устанавливаем replica identity full для таблиц
-- Это позволяет Realtime отслеживать все изменения (INSERT, UPDATE, DELETE)
alter table public.weights replica identity full;
alter table public.expenses replica identity full;

-- Добавляем таблицы в публикацию supabase_realtime
-- Теперь изменения в этих таблицах будут автоматически передаваться через Realtime
alter publication supabase_realtime
  add table public.weights,
            public.expenses;

-- Проверка: убедитесь, что таблицы добавлены
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Итоговый список таблиц в Realtime-публикации:
-- 1. logs - записи журнала активностей
-- 2. chat_messages - сообщения чата
-- 3. vet_events - ветеринарные события
-- 4. pets - питомцы
-- 5. activity_defs - определения активностей
-- 6. cloud_access - доступ пользователей к питомцам
-- 7. pet_owners - владельцы питомцев
-- 8. weights - записи веса
-- 9. expenses - расходы
