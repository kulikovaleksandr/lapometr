# Проверка и настройка Realtime-синхронизации

## Обзор всех таблиц в базе данных

### ✅ Таблицы, которые ДОЛЖНЫ быть в Realtime (9 таблиц):

1. **logs** - записи журнала активностей
   - Синхронизируются при отметке активности
   - Критично для мультидевайс синхронизации

2. **chat_messages** - сообщения чата между хозяевами
   - Синхронизируются в реальном времени
   - Необходимы для живого общения

3. **vet_events** - ветеринарные события
   - Прививки, обработки, осмотры
   - Должны быть синхронизированы между устройствами

4. **pets** - информация о питомцах
   - Создание, редактирование питомцев
   - Критично для мультидевайс синхронизации

5. **activity_defs** - определения активностей
   - Пользовательские активности
   - Должны синхронизироваться при создании/изменении

6. **cloud_access** - связь локальных и облачных пользователей
   - Необходима для мультидевайс доступа

7. **pet_owners** - владельцы питомцев
   - Мультипользовательский доступ к питомцам

8. **weights** - записи веса
   - Отслеживание веса питомца
   - Должны синхронизироваться между устройствами

9. **expenses** - расходы на питомцев
   - Учёт расходов
   - Должны синхронизироваться между устройствами

### ❌ Таблицы, которые НЕ нужны в Realtime (3 таблицы):

1. **profiles** - данные пользователей
   - Меняются редко (только при обновлении профиля)
   - Не требуют мгновенной синхронизации

2. **sync_snapshots** - резервные копии данных
   - Серверные данные для восстановления
   - Не нужны для realtime синхронизации

3. **push_subscriptions** - подписки на push-уведомления
   - Серверные данные для уведомлений
   - Не нужны для realtime синхронизации

## Как проверить текущее состояние

### Шаг 1: Выполните SQL-запрос в Supabase

Откройте Supabase Dashboard → SQL Editor и выполните содержимое файла:
```
supabase/check_realtime_status.sql
```

Этот запрос покажет:
- Все таблицы в базе данных
- Какие таблицы уже в Realtime-публикации
- Статус replica identity для каждой таблицы
- Статус RLS (Row Level Security)
- Полный отчёт с рекомендациями

### Шаг 2: Проверьте результат

В результате запроса №5 вы увидите таблицу со следующими колонками:
- `table_name` - имя таблицы
- `realtime_status` - "✓ В Realtime" или "✗ Не в Realtime"
- `replica_identity` - "✓ FULL", "⚠ DEFAULT" или "✗ NOTHING"
- `rls_status` - "✓ Включён" или "✗ Выключен"

### Шаг 3: Определите недостающие таблицы

Сравните результат с списком из 9 таблиц, которые должны быть в Realtime.

## Применение миграций

### Если таблицы ещё не созданы

Выполните миграцию `001_init.sql`:

```bash
# В Supabase SQL Editor выполните содержимое файла:
supabase/migrations/001_init.sql
```

Эта миграция:
- Создаёт все 12 таблиц
- Настраивает индексы
- Включает RLS
- Создаёт политики безопасности
- Настраивает триггеры для auto-update

### Если таблицы созданы, но не в Realtime

Выполните миграции 007 и 008:

```bash
# Миграция 007: Добавляет pets, activity_defs, cloud_access, pet_owners
supabase/migrations/007_add_pets_to_realtime.sql

# Миграция 008: Добавляет weights, expenses
supabase/migrations/008_add_weights_expenses_to_realtime.sql
```

### Если таблицы в Realtime, но без replica identity full

Выполните дополнительный SQL:

```sql
-- Устанавливаем replica identity full для всех таблиц в Realtime
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

## Проверка работы Realtime

### Тест 1: Создание питомца

1. Откройте приложение в двух браузерах (Chrome + Firefox или два окна Chrome)
2. Войдите под одним и тем же пользователем в обоих браузерах
3. В первом браузере создайте нового питомца
4. Во втором браузере питомец должен появиться **автоматически** (без обновления страницы)

**Ожидаемое поведение:**
- Время синхронизации: < 1 секунды
- Питомец появляется в обоих браузерах одновременно
- В консоли второго браузера должны быть логи:
  ```
  [Realtime] Получено изменение: { type: 'INSERT', table: 'pets', ... }
  [Realtime] ✓ Изменение применено
  ```

### Тест 2: Добавление записи веса

1. Откройте вкладку "Здоровье" в обоих браузерах
2. В первом браузере добавьте запись веса
3. Во втором браузере запись должна появиться автоматически

### Тест 3: Сообщение в чате

1. Откройте вкладку "Дуэль" в обоих браузерах
2. В первом браузере отправьте сообщение
3. Во втором браузере сообщение должно появиться автоматически

### Тест 4: Отметка активности

1. Откройте главную страницу в обоих браузерах
2. В первом браузере отметьте активность
3. Во втором браузере активность должна появиться в журнале автоматически

## Диагностика проблем

### Проблема 1: Таблицы не в Realtime

**Симптом:** В результате запроса №5 видите "✗ Не в Realtime"

**Решение:**
```sql
-- Добавьте таблицы в Realtime-публикацию
alter publication supabase_realtime
  add table public.logs,
            public.chat_messages,
            public.vet_events,
            public.pets,
            public.activity_defs,
            public.cloud_access,
            public.pet_owners,
            public.weights,
            public.expenses;
```

### Проблема 2: Replica identity не FULL

**Симптом:** В результате запроса №5 видите "⚠ DEFAULT" или "✗ NOTHING"

**Решение:**
```sql
-- Установите replica identity full
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

### Проблема 3: RLS выключен

**Симптом:** В результате запроса №5 видите "✗ Выключен"

**Решение:**
```sql
-- Включите RLS для всех таблиц
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

### Проблема 4: Изменения не синхронизируются

**Симптом:** Тесты 1-4 не работают, изменения не появляются в другом браузере

**Проверка:**
1. Откройте DevTools → Network → WS в обоих браузерах
2. Должно быть активное WebSocket соединение с Supabase
3. Проверьте консоль на наличие ошибок Realtime

**Решение:**
```javascript
// В консоли браузера проверьте статус Realtime
const channel = supabase.channel('test-channel');
channel.subscribe((status) => {
  console.log('Realtime status:', status);
});
```

Должно вывести: `Realtime status: SUBSCRIBED`

### Проблема 5: Ошибки 403 Forbidden

**Симптом:** В Network tab видите ошибки 403 при запросах к Supabase

**Причина:** RLS политики блокируют доступ

**Решение:**
1. Проверьте, что пользователь вошёл в облако
2. Проверьте таблицу `cloud_access` - должна быть запись для пользователя
3. Проверьте RLS политики для таблицы (см. миграцию 001)

## Оптимизация производительности

### 1. Фильтрация событий

Подписывайтесь только на нужные события:

```javascript
// Плохо: получаем все события
.on('postgres_changes', { event: '*', table: 'pets' }, ...)

// Хорошо: получаем только INSERT
.on('postgres_changes', { event: 'INSERT', table: 'pets' }, ...)
```

### 2. Debounce обновлений

Если изменения происходят часто:

```javascript
const debouncedUpdate = debounce((data) => {
  updateUI(data);
}, 100);

.on('postgres_changes', { event: '*', table: 'logs' }, (payload) => {
  debouncedUpdate(payload.new);
});
```

### 3. Batch обработка

Обрабатывайте несколько изменений за раз:

```javascript
const changes = [];

.on('postgres_changes', { event: '*', table: 'logs' }, (payload) => {
  changes.push(payload);
  
  if (changes.length >= 10) {
    processBatch(changes);
    changes.length = 0;
  }
});
```

## Мониторинг

### Логи Realtime

Добавьте логирование для отладки:

```javascript
.on('postgres_changes', { event: '*', table: 'pets' }, (payload) => {
  console.log('[Realtime] Получено изменение:', {
    table: 'pets',
    event: payload.eventType,
    timestamp: new Date().toISOString(),
     payload.new || payload.old
  });
});
```

### Метрики

Отслеживайте количество Realtime событий:

```javascript
let realtimeEventsCount = 0;

.on('postgres_changes', { event: '*', table: '*' }, () => {
  realtimeEventsCount++;
  
  // Отправляем метрику каждые 100 событий
  if (realtimeEventsCount % 100 === 0) {
    sendMetric('realtime_events', realtimeEventsCount);
  }
});
```

## Итоговая проверка

### Чеклист перед завершением настройки:

- [ ] Все 9 таблиц созданы в базе данных
- [ ] Все 9 таблиц добавлены в Realtime-публикацию
- [ ] Все 9 таблиц имеют replica identity full
- [ ] Все 9 таблиц имеют включённый RLS
- [ ] RLS политики настроены корректно
- [ ] Тест 1 (создание питомца) работает
- [ ] Тест 2 (добавление веса) работает
- [ ] Тест 3 (сообщение в чате) работает
- [ ] Тест 4 (отметка активности) работает
- [ ] В консоли браузера нет ошибок Realtime
- [ ] WebSocket соединение активно в обоих браузерах

### Финальная проверка SQL:

```sql
-- Должно вернуть 9 строк (все таблицы в Realtime)
select count(*) as realtime_tables_count
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in (
    'logs', 'chat_messages', 'vet_events',
    'pets', 'activity_defs', 'cloud_access', 'pet_owners',
    'weights', 'expenses'
  );

-- Все 9 таблиц должны иметь replica identity = 'f' (FULL)
select 
  tablename,
  case when relreplident = 'f' then '✓ FULL' else '✗ NOT FULL' end as status
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

Ожидаемый результат:
- `realtime_tables_count` = 9
- Все таблицы имеют статус "✓ FULL"

## Заключение

После выполнения всех шагов:
1. Все 9 таблиц будут в Realtime-публикации
2. Все таблицы будут иметь replica identity full
3. RLS будет включён и настроен
4. Синхронизация между устройствами будет работать автоматически
5. Изменения будут появляться в реальном времени (< 1 секунды)

Для проверки используйте файл `supabase/check_realtime_status.sql` и тесты из раздела "Проверка работы Realtime".
