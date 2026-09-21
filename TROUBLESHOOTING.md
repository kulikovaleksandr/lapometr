# Быстрая диагностика облачного режима

## Проверка за 3 шага

### 1. Проверьте переменные окружения в консоли браузера

Откройте приложение, нажмите F12 → Console. Вы должны увидеть:

```
=== Лапометр: Диагностика облачного режима ===
Переменные окружения: {
  VITE_SUPABASE_URL: "https://your-project.supabase.co",
  VITE_SUPABASE_ANON_KEY: "задана"
}
Cloud config loaded: да
Cloud mode: enabled
```

**Если видите "не задана"** → переменные не попали в бандл при сборке.

### 2. Проверьте инициализацию клиента

В той же консоли ищите:

```
[Cloud Init] === Инициализация облачного режима ===
[Cloud Init] ✓ Конфигурация найдена, проверяем подключение...
[Supabase Client] Создание клиента Supabase...
[Supabase Client] ✓ Клиент успешно создан
[Cloud Init] ✓ Подключение успешно установлено
[App] ✓ Облачный режим активирован и готов к работе
```

**Если видите "✗"** → читайте сообщение об ошибке.

### 3. Проверьте сетевые запросы

Откройте F12 → Network → отфильтруйте по `supabase.co`.

При регистрации должны появиться запросы:
- `POST /auth/v1/signup` → ответ `200 OK`

**Если запросов нет** → приложение не использует облако.

---

## Частые проблемы

### Проблема: "Переменные окружения не заданы"

**Причина:** Переменные не были доступны во время сборки.

**Решение:**
```bash
# 1. Создайте .env файл
cat > .env << EOF
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
EOF

# 2. Пересоберите
npm run build

# 3. Проверьте, что переменные попали в бандл
grep "supabase.co" dist/assets/*.js
```

### Проблема: "Ошибка подключения"

**Причина:** Неверный URL или anon key.

**Решение:**
1. Откройте Supabase Dashboard → Settings → API
2. Скопируйте **Project URL** и **anon public key**
3. Обновите `.env` файл
4. Пересоберите приложение

### Проблема: "CSP блокирует запросы"

**Причина:** Content Security Policy блокирует запросы к Supabase.

**Решение:** Добавьте в nginx.conf:
```nginx
add_header Content-Security-Policy "
  connect-src 'self' https://your-project.supabase.co wss://your-project.supabase.co;
" always;
```

### Проблема: "Клиент создан, но запросы не идут"

**Причина:** Пользователь не зарегистрирован в облаке.

**Решение:**
1. Зарегистрируйтесь через UI
2. Проверьте Network → должны появиться запросы к `/auth/v1/...`
3. Если запросов нет → очистите localStorage и попробуйте снова

---

## Проверка работоспособности

### Быстрый тест

```bash
# 1. Проверьте, что переменные зашиты в код
grep -o "https://[^/]*supabase\.co" dist/assets/*.js | head -1

# 2. Запустите приложение
npm run preview

# 3. Откройте http://localhost:4173
# 4. Откройте консоль (F12)
# 5. Проверьте логи инициализации
```

### Полная проверка

1. **Переменные окружения:**
   ```bash
   grep "VITE_SUPABASE" dist/assets/*.js
   ```

2. **Сетевые запросы:**
   - F12 → Network
   - Фильтр: `supabase.co`
   - Должны быть запросы при регистрации

3. **База данных:**
   - Supabase Dashboard → Table Editor
   - Должны появиться записи в `auth.users`

4. **localStorage:**
   - F12 → Application → Local Storage
   - Должны быть ключи `lapometr.*`

---

## Диагностические команды

### В консоли браузера

```javascript
// Проверить переменные окружения
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Key:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');

// Проверить конфигурацию
const config = localStorage.getItem('lapometr.cloud.v1');
console.log('Cloud config:', config ? JSON.parse(config) : 'not set');

// Проверить сессию
const session = localStorage.getItem('lapometr.session.v1');
console.log('Session:', session ? 'active' : 'none');
```

### В терминале

```bash
# Проверить бандл
grep -c "supabase.co" dist/assets/*.js

# Проверить .env файл
cat .env | grep VITE_SUPABASE

# Проверить сборку
npm run build 2>&1 | grep -i "error\|warning"
```

---

## Если ничего не помогло

1. **Очистите всё:**
   ```bash
   rm -rf node_modules dist .env
   npm install
   ```

2. **Создайте .env заново:**
   ```bash
   cat > .env << EOF
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   EOF
   ```

3. **Пересоберите:**
   ```bash
   npm run build
   ```

4. **Проверьте логи:**
   - Откройте приложение
   - F12 → Console
   - Скопируйте все сообщения `[Cloud` и `[Supabase`

5. **Создайте issue** с логами из консоли

---

## Полезные ссылки

- [Полная документация по облаку](CLOUD_SETUP.md)
- [Supabase Docs](https://supabase.com/docs)
- [Vite Env Variables](https://vitejs.dev/guide/env-and-mode.html)
