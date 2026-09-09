# Supabase Edge Functions для Web Push

Этот каталог содержит Edge Functions для работы с Web Push уведомлениями.

## Функции

### `push-subscribe`

Принимает push subscription от клиента и сохраняет в базу данных.

**Endpoint:** `POST /functions/v1/push-subscribe`

**Request:**
```json
{
  "userId": "uuid",
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

**Response:**
```json
{
  "success": true
}
```

### `push-send`

Отправляет push-уведомления всем подпискам пользователя.

**Endpoint:** `POST /functions/v1/push-send`

**Request:**
```json
{
  "userId": "uuid",
  "payload": {
    "title": "Лапометр",
    "body": "Пора покормить Булку!",
    "icon": "/icon.svg",
    "badge": "/icon.svg",
    "tag": "lapometr-reminder",
    "url": "/"
  }
}
```

**Response:**
```json
{
  "success": true,
  "sent": 2,
  "failed": 0
}
```

## Настройка

### 1. Генерация VAPID ключей

Установите `web-push` локально:
```bash
npm install -g web-push
```

Сгенерируйте ключи:
```bash
web-push generate-vapid-keys
```

Вы получите:
```
=======================================

Public Key:
BNqX...

Private Key:
8KjB...

=======================================
```

### 2. Настройка переменных окружения

В Supabase Dashboard → Settings → Secrets добавьте:

```
VAPID_PUBLIC_KEY=BNqX...
VAPID_PRIVATE_KEY=8KjB...
VAPID_SUBJECT=mailto:your-email@example.com
```

### 3. Настройка клиента

В `.env` файла проекта добавьте:

```
VITE_VAPID_PUBLIC_KEY=BNqX...
VITE_SUPABASE_FUNCTIONS_URL=https://your-project.supabase.co
```

### 4. Деплой функций

```bash
# Установите Supabase CLI
npm install -g supabase

# Войдите в аккаунт
supabase login

# Задеплойте функции
supabase functions deploy push-subscribe
supabase functions deploy push-send
```

### 5. Применение миграции

```bash
supabase db push
```

Или выполните SQL из `supabase/migrations/005_push_subscriptions.sql` в Supabase SQL Editor.

## Использование

### В клиентском коде

```typescript
import { subscribe, unsubscribe, sendTestNotification } from "./lib/web-push";

// Подписка на push
const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const userId = "user-uuid";

try {
  await subscribe(vapidKey, userId);
  console.log("Push notifications enabled");
} catch (error) {
  console.error("Failed to subscribe:", error);
}

// Отправка тестового уведомления
await sendTestNotification();

// Отписка
await unsubscribe(userId);
```

### Отправка уведомлений с сервера

```typescript
// Из Edge Function или серверного кода
const response = await fetch(`${SUPABASE_URL}/functions/v1/push-send`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({
    userId: "user-uuid",
    payload: {
      title: "Лапометр",
      body: "Пора покормить Булку!",
      icon: "/icon.svg",
      tag: "lapometr-reminder",
    }
  })
});
```

## Безопасность

- **VAPID_PRIVATE_KEY** должен храниться только на сервере (в Supabase Secrets)
- **VAPID_PUBLIC_KEY** может быть в клиентском коде (это публичный ключ)
- Таблица `push_subscriptions` защищена RLS — пользователи видят только свои subscriptions
- Edge Functions используют `SUPABASE_SERVICE_ROLE_KEY` для доступа к БД

## Отладка

### Проверка подписки

```sql
SELECT * FROM push_subscriptions WHERE user_id = 'user-uuid';
```

### Тест отправки

```bash
curl -X POST https://your-project.supabase.co/functions/v1/push-send \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "payload": {
      "title": "Тест",
      "body": "Проверка работы push"
    }
  }'
```

### Логи Edge Functions

```bash
supabase functions logs push-subscribe
supabase functions logs push-send
```

## Серверные напоминания

Edge Function `reminders-send` автоматически собирает просроченные активности и due вет-события, отправляя сводку в Telegram и Web Push **без открытого браузера**.

### Как это работает

1. **Ежечасный запуск** через pg_cron (платный план) или внешний cron (GitHub Actions, cron-job.org)
2. **Сбор данных** из `sync_snapshots` — просроченные активности и due вет-события
3. **Отправка сводки** в Telegram и через Web Push

Пример уведомления:
```
🐾 Лапометр: пора позаботиться

• Булка: «Покормить» — просрочено на 3 ч
• Булка: «Прививка» — сегодня в 15:00

Отметьте выполнение в журнале!
```

### Настройка

**Для платного плана Supabase (с pg_cron):**

1. Включите pg_cron в Supabase Dashboard → Database → Extensions
2. Выполните миграцию `006_pg_cron_reminders.sql`
3. Замените `YOUR_PROJECT_ID` и `YOUR_SERVICE_ROLE_KEY` в миграции
4. Задеплойте функцию:
   ```bash
   supabase functions deploy reminders-send
   ```

**Для бесплатного плана (внешний cron):**

Используйте GitHub Actions workflow `.github/workflows/reminders-cron.yml`:

1. Добавьте секреты в GitHub → Settings → Secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Workflow запускается автоматически каждый час

Альтернативы: cron-job.org, системный cron (скрипт `supabase/functions/external-cron.sh`)

### Деплой функции

```bash
supabase functions deploy reminders-send
```

### Тестирование

```bash
curl -X POST https://your-project.supabase.co/functions/v1/reminders-send \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Ответ:
```json
{
  "success": true,
  "sent": 2,
  "users": 1
}
```

### Ограничения

- **pg_cron** доступен только на платных планах Supabase (Pro и выше)
- На бесплатном плане используйте внешний cron (GitHub Actions, cron-job.org)
- Функция читает `sync_snapshots` — клиенты должны хотя бы раз синхронизироваться с облаком
- Telegram-напоминания работают только если пользователь настроил Telegram в приложении
- Web Push требует настроенных VAPID ключей и подписки клиента

---

## Ограничения

- Web Push работает только в браузерах с поддержкой Service Workers (Chrome, Firefox, Edge, Safari 16.4+)
- Для iOS требуется Safari 16.4+ и добавление сайта на домашний экран
- Каждый браузер имеет лимит на количество push-уведомлений (обычно ~100 в день)
- Подписки могут истекать — функция `push-send` автоматически удаляет невалидные subscriptions (410 Gone)
