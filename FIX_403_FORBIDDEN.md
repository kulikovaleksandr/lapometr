# Исправление ошибки 403 Forbidden для vet_events

## Проблема

При попытке записать ветеринарные события в облако Supabase возникала ошибка:
```
POST http://192.168.0.48:8000/rest/v1/vet_events
Status: 403 Forbidden
```

## Причина

Ошибка 403 Forbidden возникает из-за RLS (Row Level Security) политик в Supabase. 

Таблица `vet_events` имеет политику `vet_insert`, которая проверяет наличие пользователя в таблице `cloud_access` через функцию `is_pet_member(pet_id)`:

```sql
create policy "vet_insert" on public.vet_events for insert
  with check (public.is_pet_member(pet_id));
```

Функция `is_pet_member()` проверяет:
```sql
select exists (select 1 from public.cloud_access ca
                where ca.pet_id = p and ca.cloud_id = auth.uid()::text)
```

**Проблема:** Когда пользователь создавал питомца через `createPet()`, питомец добавлялся только в локальную базу данных. Запись в таблице `cloud_access` не создавалась, поэтому при попытке записать `vet_events` RLS политика отклоняла запрос.

## Решение

Модифицирована функция `createPet()` в `src/state/AppContext.tsx`:

1. После создания питомца в локальной БД
2. Проверяется наличие облачной конфигурации (`loadCloudConfig()`)
3. Если облако активно и у пользователя есть `cloudId`
4. Вызывается `cloudFullPush()` для синхронизации с облаком

Функция `cloudFullPush()` автоматически:
- Загружает питомца в таблицу `pets`
- **Добавляет запись в `cloud_access`** (ключевое исправление!)
- Добавляет запись в `pet_owners`
- Синхронизирует активности, логи, чат и вет-события

## Изменения в коде

### Файл: `src/state/AppContext.tsx`

**Было:**
```typescript
const createPet: Ctx["createPet"] = (data) => {
  // ... создание питомца в локальной БД
  commit(d);
  setActivePet(p.id);
  // ... тосты
};
```

**Стало:**
```typescript
const createPet: Ctx["createPet"] = async (data) => {
  // ... создание питомца в локальной БД
  commit(d);
  setActivePet(p.id);
  // ... тосты
  
  // Синхронизация с облаком, если активен облачный режим
  const cloudConfig = loadCloudConfig();
  if (cloudConfig && user.cloudId) {
    console.log("[CreatePet] Синхронизация питомца с облаком...");
    const result = await cloudFullPush(d, user.id);
    if (result.ok) {
      console.log("[CreatePet] ✓ Питомец синхронизирован с облаком");
    } else {
      console.error("[CreatePet] Ошибка синхронизации:", result.error);
      toast(`Предупреждение: ${result.error}`, "warn");
    }
  }
};
```

Также обновлён тип функции в интерфейсе `Ctx`:
```typescript
createPet: (data: {...}) => Promise<void>;
```

## Проверка исправления

### 1. Пересоберите приложение
```bash
npm run build
```

### 2. Создайте нового питомца
- Откройте приложение
- Создайте нового питомца через UI

### 3. Проверьте консоль браузера (F12)
Должны появиться сообщения:
```
[CreatePet] Синхронизация питомца с облаком...
[CreatePet] ✓ Питомец синхронизирован с облаком
```

### 4. Проверьте Supabase Dashboard
Откройте Supabase Dashboard → Table Editor:

**Таблица `pets`:**
- Должен появиться новый питомец
- Поле `owner_id` должно содержать UUID пользователя из `auth.users`

**Таблица `cloud_access`:**
- Должна появиться запись:
  - `pet_id`: ID нового питомца
  - `cloud_id`: UUID пользователя из `auth.users`
  - `display_name`: Имя пользователя
  - `display_color`: Цвет пользователя

**Таблица `pet_owners`:**
- Должна появиться запись:
  - `pet_id`: ID нового питомца
  - `user_id`: UUID пользователя
  - `role`: "owner"

### 5. Добавьте ветеринарное событие
- Откройте вкладку "Здоровье"
- Добавьте новое ветеринарное событие
- В Network tab должен быть успешный запрос (200/201) к `/rest/v1/vet_events`
- В Supabase Dashboard → Table Editor → `vet_events` должна появиться новая запись

## Диагностика проблем

### Проблема: "Облако не подключено"

**Симптом:** В консоли видно:
```
[CreatePet] Ошибка синхронизации: Облако не подключено
```

**Причина:** Переменные окружения не заданы или не попали в бандл.

**Решение:**
```bash
# Проверьте .env файл
cat .env | grep VITE_SUPABASE

# Пересоберите
npm run build
```

### Проблема: "Войдите в облако"

**Симптом:** В консоли видно:
```
[CreatePet] Ошибка синхронизации: Войдите в облако, чтобы синхронизировать
```

**Причина:** Пользователь зарегистрирован локально, но не в облаке.

**Решение:**
1. Выйдите из приложения
2. Зарегистрируйтесь снова (теперь регистрация идёт через облако)
3. Создайте питомца заново

### Проблема: "Локальный профиль не связан с облачным аккаунтом"

**Симптом:** В консоли видно:
```
[CreatePet] Ошибка синхронизации: Локальный профиль не связан с облачным аккаунтом
```

**Причина:** У локального пользователя нет поля `cloudId`.

**Решение:**
1. Очистите localStorage:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   ```
2. Перезагрузите приложение
3. Зарегистрируйтесь заново

### Проблема: RLS всё ещё блокирует

**Симптом:** Ошибка 403 сохраняется после исправления.

**Причина:** Запись в `cloud_access` не создана.

**Решение:**
1. Проверьте Supabase Dashboard → Table Editor → `cloud_access`
2. Если записи нет, создайте её вручную:
   ```sql
   INSERT INTO cloud_access (pet_id, cloud_id, display_name, display_color)
   VALUES (
     'your-pet-id',
     'your-cloud-user-id',
     'Your Name',
     '#f59e0b'
   );
   ```
3. Или пересоздайте питомца через UI

## Проверка RLS политик

Убедитесь, что все необходимые политики созданы:

```sql
-- Проверить политики для vet_events
SELECT * FROM pg_policies WHERE tablename = 'vet_events';
```

Должны быть политики:
- `vet_select` - для чтения
- `vet_insert` - для вставки
- `vet_update` - для обновления
- `vet_delete` - для удаления

Если политик нет, выполните миграцию:
```bash
# В Supabase Dashboard → SQL Editor
-- Выполните содержимое supabase/migrations/003_realtime.sql
```

## Дополнительные проверки

### Проверка функции is_pet_member

```sql
-- Проверить, что функция существует
SELECT * FROM pg_proc WHERE proname = 'is_pet_member';

-- Тестировать функцию
SELECT public.is_pet_member('your-pet-id');
```

Должно вернуть `true`, если пользователь есть в `cloud_access`.

### Проверка cloud_access

```sql
-- Посмотреть все записи
SELECT * FROM cloud_access;

-- Проверить конкретную запись
SELECT * FROM cloud_access 
WHERE pet_id = 'your-pet-id' 
  AND cloud_id = 'your-cloud-user-id';
```

## Успешная синхронизация

Если всё работает правильно:
- ✅ В консоли видно `[CreatePet] ✓ Питомец синхронизирован с облаком`
- ✅ В Supabase Dashboard есть записи в `pets`, `cloud_access`, `pet_owners`
- ✅ Ветеринарные события успешно записываются в `vet_events`
- ✅ Нет ошибок 403 Forbidden

## Связанные файлы

- `src/state/AppContext.tsx` - функция `createPet()`
- `src/lib/cloud.ts` - функция `cloudFullPush()`
- `supabase/migrations/003_realtime.sql` - RLS политики
- `CLOUD_REGISTRATION_TEST.md` - проверка облачной регистрации
