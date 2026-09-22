# Инструкция по применению всех миграций

## 📋 Порядок применения миграций

### Шаг 1: Создайте все таблицы (если ещё не созданы)

Откройте Supabase Dashboard → SQL Editor и выполните:

```sql
-- Файл: supabase/migrations/001_init.sql
```

Эта миграция создаёт:
- ✅ 12 таблиц (profiles, pets, pet_owners, cloud_access, activity_defs, logs, chat_messages, vet_events, weights, expenses, sync_snapshots, push_subscriptions)
- ✅ Все индексы для оптимизации запросов
- ✅ RLS (Row Level Security) для всех таблиц
- ✅ RLS политики для безопасности данных
- ✅ Триггеры для автоматического обновления updated_at

### Шаг 2: Добавьте таблицы в Realtime (миграция 007)

```sql
-- Файл: supabase/migrations/007_add_pets_to_realtime.sql
```

Эта миграция добавляет в Realtime:
- ✅ pets (питомцы)
- ✅ activity_defs (определения активностей)
- ✅ cloud_access (доступ пользователей)
- ✅ pet_owners (владельцы питомцев)

### Шаг 3: Добавьте таблицы в Realtime (миграция 008)

```sql
-- Файл: supabase/migrations/008_add_weights_expenses_to_realtime.sql
```

Эта миграция добавляет в Realtime:
- ✅ weights (записи веса)
- ✅ expenses (расходы)

### Шаг 4: Добавьте таблицы в Realtime (миграция 009)

```sql
-- Файл: supabase/migrations/009_add_logs_chat_vet_to_realtime.sql
```

Эта миграция добавляет в Realtime:
- ✅ logs (записи журнала активностей)
- ✅ chat_messages (сообщения чата)
- ✅ vet_events (ветеринарные события)

## 🔍 Проверка результата

### Проверка 1: Список таблиц в Realtime

```sql
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
```

**Ожидаемый результат (9 таблиц):**
```
activity_defs
chat_messages
cloud_access
expenses
logs
pet_owners
pets
vet_events
weights
```

### Проверка 2: Replica identity

```sql
select 
  tablename,
  case 
    when relreplident = 'f' then '✓ FULL'
    when relreplident = 'd' then '⚠ DEFAULT'
    when relreplident = 'n' then '✗ NOTHING'
    else '? UNKNOWN'
  end as replica_identity
from pg_class
join pg_namespace on pg_class.relnamespace = pg_namespace.oid
where nspname = 'public'
  and relname in (
    'logs', 'chat_messages', 'vet_events',
    'pets', 'activity_defs', 'cloud_access', 'pet_owners',
    'weights', 'expenses'
  )
order by relname;
```

**Ожидаемый результат:** Все 9 таблиц должны иметь "✓ FULL"

### Проверка 3: RLS включён

```sql
select 
  tablename,
  case when rowsecurity then '✓ Включён' else '✗ Выключен' end as rls_status
from pg_tables
where schemaname = 'public'
  and tablename in (
    'logs', 'chat_messages', 'vet_events',
    'pets', 'activity_defs', 'cloud_access', 'pet_owners',
    'weights', 'expenses'
  )
order by tablename;
```

**Ожидаемый результат:** Все 9 таблиц должны иметь "✓ Включён"

### Проверка 4: Полный отчёт

```sql
select 
  t.tablename as table_name,
  case when pt.tablename is not null then '✓ В Realtime' else '✗ Не в Realtime' end as realtime_status,
  case 
    when c.relreplident = 'f' then '✓ FULL'
    when c.relreplident = 'd' then '⚠ DEFAULT'
    when c.relreplident = 'n' then '✗ NOTHING'
    else '? UNKNOWN'
  end as replica_identity,
  case when s.rowsecurity then '✓ RLS' else '✗ No RLS' end as rls_status
from pg_tables t
left join pg_publication_tables pt on pt.tablename = t.tablename and pt.pubname = 'supabase_realtime'
left join pg_class c on c.relname = t.tablename
left join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.schemaname
left join (select tablename, rowsecurity from pg_tables where schemaname = 'public') s on s.tablename = t.tablename
where t.schemaname = 'public'
  and t.tablename in (
    'logs', 'chat_messages', 'vet_events',
    'pets', 'activity_defs', 'cloud_access', 'pet_owners',
    'weights', 'expenses'
  )
order by t.tablename;
```

**Ожидаемый результат:**
- Все 9 таблиц: "✓ В Realtime", "✓ FULL", "✓ RLS"

## 🧪 Тестирование синхронизации

### Тест 1: Создание питомца

1. Откройте приложение в двух браузерах (Chrome + Firefox)
2. Войдите под одним пользователем в обоих браузерах
3. В браузере A создайте нового питомца
4. В браузере B питомец должен появиться автоматически (< 1 сек)

**Ожидаемые логи в консоли браузера B:**
```
[Realtime] Получено изменение: { type: 'INSERT', table: 'pets', ... }
[Realtime] ✓ Изменение применено
```

### Тест 2: Добавление записи веса

1. Откройте вкладку "Здоровье" в обоих браузерах
2. В браузере A добавьте запись веса
3. В браузере B запись должна появиться автоматически

### Тест 3: Сообщение в чате

1. Откройте вкладку "Дуэль" в обоих браузерах
2. В браузере A отправьте сообщение
3. В браузере B сообщение должно появиться автоматически

### Тест 4: Отметка активности

1. Откройте главную страницу в обоих браузерах
2. В браузере A отметьте активность
3. В браузере B активность должна появиться в журнале автоматически

## 🔧 Решение проблем

### Проблема: Таблицы не созданы

**Симптом:** Ошибка "relation does not exist"

**Решение:** Примените миграцию 001_init.sql

### Проблема: Таблицы не в Realtime

**Симптом:** В проверке №1 видите меньше 9 таблиц

**Решение:** Примените миграции 007, 008, 009

### Проблема: Replica identity не FULL

**Симптом:** В проверке №2 видите "⚠ DEFAULT" или "✗ NOTHING"

**Решение:**
```sql
alter table public.logs replica identity full;
alter table public.chat_messages replica identity full;
alter table public.vet_events replica identity full;
alter table public.pets replica identity full;
alter table public.activity_defs replica identity full;
alter table public.cloud_access replica identity full;
alter table public.pet_owners replica identity full;
alter table public.weights replica identity full;
alter table public.expenses replica identity full;
```

### Проблема: RLS выключен

**Симптом:** В проверке №3 видите "✗ Выключен"

**Решение:**
```sql
alter table public.logs enable row level security;
alter table public.chat_messages enable row level security;
alter table public.vet_events enable row level security;
alter table public.pets enable row level security;
alter table public.activity_defs enable row level security;
alter table public.cloud_access enable row level security;
alter table public.pet_owners enable row level security;
alter table public.weights enable row level security;
alter table public.expenses enable row level security;
```

### Проблема: Синхронизация не работает

**Симптом:** Тесты 1-4 не работают

**Решение:**
1. Проверьте WebSocket соединение в DevTools → Network → WS
2. Проверьте консоль на наличие ошибок
3. Пересоберите приложение: `npm run build`
4. Очистите кэш браузера: Ctrl+Shift+R

## 📊 Итоговая статистика

### Таблицы в Realtime: 9 из 12 (75%)

**В Realtime (9):**
1. logs
2. chat_messages
3. vet_events
4. pets
5. activity_defs
6. cloud_access
7. pet_owners
8. weights
9. expenses

**Не в Realtime (3):**
1. profiles (данные пользователей)
2. sync_snapshots (резервные копии)
3. push_subscriptions (push-уведомления)

### Миграции: 4 файла

1. `001_init.sql` - создание всех таблиц + RLS + индексы
2. `007_add_pets_to_realtime.sql` - добавление 4 таблиц
3. `008_add_weights_expenses_to_realtime.sql` - добавление 2 таблиц
4. `009_add_logs_chat_vet_to_realtime.sql` - добавление 3 таблиц

## ✅ Чеклист перед завершением

- [ ] Миграция 001 применена (все 12 таблиц созданы)
- [ ] Миграция 007 применена (4 таблицы в Realtime)
- [ ] Миграция 008 применена (2 таблицы в Realtime)
- [ ] Миграция 009 применена (3 таблицы в Realtime)
- [ ] Проверка №1: 9 таблиц в Realtime
- [ ] Проверка №2: Все 9 таблиц имеют replica identity FULL
- [ ] Проверка №3: Все 9 таблиц имеют RLS включён
- [ ] Проверка №4: Полный отчёт показывает все ✓
- [ ] Тест 1: Создание питомца работает
- [ ] Тест 2: Добавление веса работает
- [ ] Тест 3: Сообщение в чате работает
- [ ] Тест 4: Отметка активности работает
- [ ] Приложение пересобрано: `npm run build`

## 🎯 Заключение

После применения всех миграций:
- ✅ Все 9 необходимых таблиц в Realtime-публикации
- ✅ Все таблицы имеют replica identity full
- ✅ Все таблицы имеют включённый RLS
- ✅ RLS политики настроены корректно
- ✅ Синхронизация работает в реальном времени (< 1 сек)

Теперь все данные (питомцы, активности, журнал, чат, вет-события, вес, расходы) будут автоматически синхронизироваться между устройствами без необходимости ручных кнопок синхронизации.
