-- Проверка текущего состояния Realtime-публикации
-- Выполните этот запрос в Supabase SQL Editor, чтобы увидеть, какие таблицы уже добавлены в realtime

-- 1. Список всех таблиц в базе данных
select 
  table_schema,
  table_name,
  table_type
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;

-- 2. Список таблиц в Realtime-публикации
select 
  pubname,
  schemaname,
  tablename,
  rowfilter
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;

-- 3. Проверка replica identity для всех таблиц
select 
  schemaname,
  tablename,
  case 
    when relreplident = 'd' then 'DEFAULT (primary key)'
    when relreplident = 'n' then 'NOTHING'
    when relreplident = 'f' then 'FULL (all columns)'
    when relreplident = 'i' then 'INDEX'
  end as replica_identity
from pg_class
join pg_namespace on pg_class.relnamespace = pg_namespace.oid
where nspname = 'public'
  and relkind = 'r'
order by relname;

-- 4. Проверка RLS для всех таблиц
select 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
order by tablename;

-- 5. Полный отчёт о состоянии Realtime
select 
  t.tablename as table_name,
  case when pt.tablename is not null then '✓ В Realtime' else '✗ Не в Realtime' end as realtime_status,
  case 
    when c.relreplident = 'f' then '✓ FULL'
    when c.relreplident = 'd' then '⚠ DEFAULT'
    when c.relreplident = 'n' then '✗ NOTHING'
    else '? UNKNOWN'
  end as replica_identity,
  case when s.rowsecurity then '✓ Включён' else '✗ Выключен' end as rls_status
from pg_tables t
left join pg_publication_tables pt on pt.tablename = t.tablename and pt.pubname = 'supabase_realtime'
left join pg_class c on c.relname = t.tablename
left join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.schemaname
left join (select tablename, rowsecurity from pg_tables where schemaname = 'public') s on s.tablename = t.tablename
where t.schemaname = 'public'
order by t.tablename;

-- 6. Рекомендации по добавлению таблиц в Realtime
-- Таблицы, которые должны быть в Realtime для автоматической синхронизации:
-- ✓ logs - записи журнала активностей
-- ✓ chat_messages - сообщения чата
-- ✓ vet_events - ветеринарные события
-- ✓ pets - питомцы
-- ✓ activity_defs - определения активностей
-- ✓ cloud_access - доступ пользователей
-- ✓ pet_owners - владельцы питомцев
-- ✓ weights - записи веса
-- ✓ expenses - расходы

-- Таблицы, которые НЕ нужны в Realtime:
-- ✗ profiles - данные пользователей (редко меняются)
-- ✗ sync_snapshots - резервные копии (серверные данные)
-- ✗ push_subscriptions - подписки на push (серверные данные)
