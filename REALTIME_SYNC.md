# Realtime-синхронизация в Лапометре

## Обзор

Приложение использует Supabase Realtime для автоматической синхронизации данных между устройствами в реальном времени. Когда пользователь вносит изменения на одном устройстве, они автоматически появляются на всех других устройствах без необходимости ручного обновления.

## Таблицы в Realtime-синхронизации

### ✅ Таблицы, добавленные в Realtime:

**Миграция 003 (базовые данные):**
1. `logs` - записи журнала активностей
2. `chat_messages` - сообщения чата между хозяевами
3. `vet_events` - ветеринарные события (прививки, обработки, осмотры)

**Миграция 007 (питомцы и активности):**
4. `pets` - информация о питомцах
5. `activity_defs` - определения активностей (стандартные и пользовательские)
6. `cloud_access` - связь между локальными пользователями и облачными аккаунтами
7. `pet_owners` - связь питомцев с владельцами

**Миграция 008 (здоровье и финансы):**
8. `weights` - записи веса питомцев
9. `expenses` - расходы на питомцев

### ❌ Таблицы, НЕ добавленные в Realtime:

- `users` / `profiles` - данные аутентификации (не меняются часто)
- `sync_snapshots` - резервные копии данных (используются для первичной синхронизации)
- `push_subscriptions` - подписки на push-уведомления (серверные данные)

## Как это работает

### 1. Изменение данных на устройстве A

```javascript
// Пользователь создаёт питомца
const createPet = async (data) => {
  // 1. Создаём питомца локально
  const pet = { ...data, id: uid() };
  localDB.pets.push(pet);
  
  // 2. Сохраняем в localStorage
  saveDB(localDB);
  
  // 3. Отправляем в Supabase через cloudFullPush()
  await cloudFullPush(localDB, userId);
  
  // 4. Supabase записывает изменения в таблицу pets
  // 5. Realtime автоматически уведомляет все подключённые устройства
};
```

### 2. Получение изменений на устройстве B

```javascript
// Подписка на Realtime изменения
useEffect(() => {
  const channel = supabase
    .channel('pets-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'pets' },
      (payload) => {
        // payload содержит тип события и данные
        if (payload.eventType === 'INSERT') {
          // Добавляем нового питомца в локальную БД
          localDB.pets.push(payload.new);
          saveDB(localDB);
          updateUI();
        } else if (payload.eventType === 'UPDATE') {
          // Обновляем существующего питомца
          const index = localDB.pets.findIndex(p => p.id === payload.new.id);
          if (index !== -1) {
            localDB.pets[index] = payload.new;
            saveDB(localDB);
            updateUI();
          }
        } else if (payload.eventType === 'DELETE') {
          // Удаляем питомца из локальной БД
          localDB.pets = localDB.pets.filter(p => p.id !== payload.old.id);
          saveDB(localDB);
          updateUI();
        }
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

### 3. Поток данных

```
Устройство A                    Supabase Cloud                  Устройство B
    |                                |                                |
    |-- Изменение данных ----------->|                                |
    |                                |-- Realtime notification ------>|
    |                                |                                |
    |                                |<--- Запрос данных -------------|
    |                                |---- Данные ------------------>|
    |                                |                                |
    |                                |                                |-- Обновление UI
    |                                |                                |
```

## Применение миграций

### Шаг 1: Применить миграцию 007

Откройте Supabase Dashboard → SQL Editor и выполните:

```sql
-- Миграция 007: Добавляем таблицы pets и связанные в Realtime
alter table public.pets replica identity full;
alter table public.activity_defs replica identity full;
alter table public.cloud_access replica identity full;
alter table public.pet_owners replica identity full;

alter publication supabase_realtime
  add table public.pets,
            public.activity_defs,
            public.cloud_access,
            public.pet_owners;
```

### Шаг 2: Применить миграцию 008

```sql
-- Миграция 008: Добавляем таблицы weights и expenses в Realtime
alter table public.weights replica identity full;
alter table public.expenses replica identity full;

alter publication supabase_realtime
  add table public.weights,
            public.expenses;
```

### Шаг 3: Проверить результат

Выполните в SQL Editor:

```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

Должны появиться все 9 таблиц:
- logs
- chat_messages
- vet_events
- pets
- activity_defs
- cloud_access
- pet_owners
- weights
- expenses

## Проверка работы Realtime

### Тест 1: Создание питомца

1. Откройте приложение в двух браузерах (или двух устройствах)
2. Войдите под одним и тем же пользователем
3. В первом браузере создайте нового питомца
4. Во втором браузере питомец должен появиться автоматически (без обновления страницы)

### Тест 2: Добавление записи веса

1. Откройте вкладку "Здоровье" в обоих браузерах
2. В первом браузере добавьте запись веса
3. Во втором браузере запись должна появиться автоматически

### Тест 3: Сообщение в чате

1. Откройте вкладку "Дуэль" в обоих браузерах
2. В первом браузере отправьте сообщение
3. Во втором браузере сообщение должно появиться автоматически

## Диагностика проблем

### Проблема: Изменения не синхронизируются

**Проверка 1: Realtime включён в Supabase**
- Откройте Supabase Dashboard → Database → Replication
- Убедитесь, что все таблицы включены для Realtime

**Проверка 2: WebSocket соединение активно**
- Откройте DevTools → Network → WS
- Должно быть активное WebSocket соединение с Supabase

**Проверка 3: Логи в консоли**
- Откройте консоль браузера (F12)
- Проверьте наличие сообщений:
  ```
  [Realtime] Подписка активна
  [Realtime] Получено изменение: { ... }
  [Realtime] ✓ Изменение применено
  ```

### Проблема: Ошибки 403 Forbidden

**Причина:** RLS политики блокируют доступ

**Решение:**
1. Проверьте, что пользователь вошёл в облако
2. Проверьте таблицу `cloud_access` - должна быть запись для пользователя
3. Проверьте RLS политики для таблицы

### Проблема: Дублирование данных

**Причина:** Конфликт между Realtime и ручной синхронизацией

**Решение:**
1. Используйте `onConflict: 'id'` при вставке данных
2. Проверяйте существование записи перед вставкой
3. Используйте `mergeRemoteRows()` для безопасного слияния

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

Если изменения происходят часто, используйте debounce:

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

## Безопасность

### RLS политики для Realtime

Все таблицы в Realtime должны иметь RLS политики:

```sql
-- Пример для таблицы pets
create policy "Users can view own pets"
  on public.pets
  for select
  using (auth.uid() = owner_id);

create policy "Users can insert own pets"
  on public.pets
  for insert
  with check (auth.uid() = owner_id);
```

### Проверка прав доступа

Перед обработкой Realtime события проверяйте права:

```javascript
.on('postgres_changes', { event: '*', table: 'pets' }, async (payload) => {
  // Проверяем, что пользователь имеет доступ к этому питомцу
  const hasAccess = await checkPetAccess(payload.new.id, currentUser.id);
  
  if (!hasAccess) {
    console.warn('Попытка доступа к чужому питомцу');
    return;
  }
  
  // Обрабатываем изменение
  processChange(payload);
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
    data: payload.new || payload.old
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

## Заключение

Realtime-синхронизация обеспечивает мгновенное обновление данных между устройствами без необходимости ручного обновления. Все основные таблицы приложения добавлены в Realtime-публикацию через миграции 003, 007 и 008.

Для корректной работы:
1. Примените все миграции в Supabase
2. Проверьте наличие всех 9 таблиц в `pg_publication_tables`
3. Убедитесь, что RLS политики настроены корректно
4. Проверьте WebSocket соединение в DevTools
5. Тестируйте синхронизацию на нескольких устройствах

При возникновении проблем используйте раздел "Диагностика проблем" для поиска и устранения ошибок.
