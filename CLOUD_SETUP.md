# Настройка облачного режима (Supabase)

## Краткая диагностика

При запуске приложения в консоли браузера (F12 → Console) вы увидите:

```
=== Лапометр: Диагностика облачного режима ===
Переменные окружения: {
  VITE_SUPABASE_URL: "https://your-project.supabase.co",
  VITE_SUPABASE_ANON_KEY: "задана"
}
Cloud config loaded: да
Cloud mode: enabled
Supabase URL: https://your-project.supabase.co
[Cloud Init] === Инициализация облачного режима ===
[Cloud Init] ✓ Конфигурация найдена, проверяем подключение...
[Cloud Init] ✓ Подключение успешно установлено
[App] ✓ Облачный режим активирован и готов к работе
```

Если видите это — облачный режим работает. Если нет — читайте дальше.

## Как это работает

### Переменные окружения в Vite

Vite (сборщик приложения) подставляет переменные окружения **во время сборки**, а не во время выполнения. Это означает:

1. **Переменные должны быть заданы ДО сборки** (`npm run build`)
2. После сборки они "зашиты" в JavaScript код
3. Изменение `.env` файла после сборки **не повлияет** на приложение

### Проверка переменных в бандле

```bash
# После сборки проверьте, что переменные попали в код
grep -o "VITE_SUPABASE_URL" dist/assets/*.js
# или
grep "supabase.co" dist/assets/*.js
```

## Настройка для продакшена

### Вариант 1: Через .env файл (рекомендуется)

1. Создайте файл `.env` в корне проекта:

```bash
# .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

2. Пересоберите приложение:

```bash
npm run build
```

3. Проверьте, что переменные попали в бандл:

```bash
grep "your-project.supabase.co" dist/assets/*.js
```

### Вариант 2: Через build args в Docker

Если используете Docker, передайте переменные как build args:

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Build args
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Передаём в build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build
```

Сборка:

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-anon-key \
  -t lapometr .
```

### Вариант 3: Через CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
- name: Build
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  run: npm run build
```

## Диагностика проблем

### Проблема 1: "Переменные окружения не заданы"

**Симптом:** В консоли видно:
```
Переменные окружения: {
  VITE_SUPABASE_URL: "не задана",
  VITE_SUPABASE_ANON_KEY: "не задана"
}
```

**Причина:** Переменные не были доступны во время сборки.

**Решение:**
1. Проверьте наличие `.env` файла
2. Убедитесь, что переменные начинаются с `VITE_`
3. Пересоберите приложение: `npm run build`
4. Проверьте бандл: `grep "supabase.co" dist/assets/*.js`

### Проблема 2: "Ошибка подключения"

**Симптом:** В консоли видно:
```
[Cloud Init] ✗ Ошибка подключения: Invalid API key
```

**Причина:** Неверный URL или anon key.

**Решение:**
1. Проверьте URL в Supabase Dashboard → Settings → API
2. Скопируйте **anon public** key (не service_role!)
3. Убедитесь, что в URL нет лишних слешей в конце

### Проблема 3: "CSP блокирует запросы"

**Симптом:** В консоли видно ошибки CSP:
```
Refused to connect to 'https://your-project.supabase.co' because it violates the Content Security Policy directive
```

**Причина:** Content Security Policy блокирует запросы к Supabase.

**Решение:** Добавьте в CSP заголовки nginx:

```nginx
# nginx.conf
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' https://your-project.supabase.co wss://your-project.supabase.co;
" always;
```

### Проблема 4: "Клиент создан, но запросы не идут"

**Симптом:** В консоли видно:
```
[Supabase Client] ✓ Клиент успешно создан
```
Но в Network нет запросов к Supabase.

**Причина:** Приложение не пытается использовать облако, потому что пользователь не вошёл.

**Решение:**
1. Зарегистрируйтесь через UI
2. Проверьте Network → должны появиться запросы к `/auth/v1/...`
3. Если запросов нет — проверьте, что `initializeCloud()` вызывается в `main.tsx`

## Проверка работоспособности

### 1. Проверка переменных в бандле

```bash
# Должно вывести URL Supabase
grep -o "https://[^/]*supabase\.co" dist/assets/*.js | head -1
```

### 2. Проверка в браузере

Откройте консоль (F12) и выполните:

```javascript
// Проверить, что переменные зашиты в код
console.log(import.meta.env.VITE_SUPABASE_URL);
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY);
```

### 3. Проверка подключения

```javascript
// Проверить, что клиент создан
const client = window.__supabaseClient; // если экспортируете
console.log(client);
```

### 4. Проверка регистрации

1. Откройте Network tab
2. Зарегистрируйтесь через UI
3. Должны появиться запросы:
   - `POST /auth/v1/signup`
   - Ответ: `{"access_token": "...", "refresh_token": "..."}`

## Локальный режим (fallback)

Если облако не настроено, приложение автоматически работает в локальном режиме:

- Все данные хранятся в `localStorage`
- Мультипользовательность не работает
- Синхронизация между устройствами не работает
- Push-уведомления не работают

Это нормальное поведение для разработки и тестирования.

## Дополнительные переменные

### Опциональные переменные

```bash
# Для Web Push уведомлений
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key

# Для мониторинга (Sentry)
VITE_SENTRY_DSN=https://your-sentry-dsn

# Для аналитики (Plausible)
VITE_PLAUSIBLE_DOMAIN=your-domain.com
```

Эти переменные не обязательны для работы облачного режима.

## Часто задаваемые вопросы

### Q: Можно ли изменить URL Supabase после сборки?

**A:** Нет. Переменные окружения "зашиваются" в JavaScript код во время сборки. Для изменения URL нужно пересобрать приложение.

### Q: Почему anon key, а не service_role?

**A:** `anon key` предназначен для клиентского кода и имеет ограниченные права. `service_role` имеет полный доступ к БД и должен использоваться только на сервере.

### Q: Как проверить, что приложение использует облако?

**A:** Откройте DevTools → Network → отфильтруйте по `supabase.co`. Если видите запросы — облако работает.

### Q: Можно ли использовать облако и локальное хранилище одновременно?

**A:** Нет. Приложение работает либо в облачном, либо в локальном режиме. Если облако настроено — используется только оно.

## Поддержка

Если проблема не решена:

1. Откройте консоль браузера (F12)
2. Скопируйте все сообщения, начинающиеся с `[Cloud` или `[Supabase`
3. Создайте issue в репозитории с этими логами
