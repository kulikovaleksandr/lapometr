# Проверка облачной регистрации

## Что было исправлено

Проблема: Приложение инициализировало Supabase клиент, но регистрация и вход работали только через localStorage, игнорируя облако.

Решение: Модифицированы функции `register()` и `login()` в `AppContext.tsx`:
- Теперь они сначала проверяют наличие облачной конфигурации
- Если облако активно - вызывают `cloudSignUp()` / `cloudSignIn()`
- Создают локального пользователя и связывают его с облачным через `cloudId`
- Если облако недоступно - используют fallback на локальную регистрацию

## Как проверить

### 1. Пересоберите приложение

```bash
npm run build
```

### 2. Откройте приложение и проверьте консоль (F12)

При загрузке вы должны увидеть:
```
[Cloud Init] === Инициализация облачного режима ===
[Cloud Init] ✓ Облачный режим активирован и готов к работе
```

### 3. Зарегистрируйте нового пользователя

При регистрации в консоли должны появиться сообщения:
```
[Register] Облачный режим активен, регистрируем в Supabase...
[Register] ✓ Облачная регистрация успешна
```

### 4. Проверьте Supabase Dashboard

Откройте Supabase Dashboard → Authentication → Users

Должен появиться новый пользователь с:
- Email: указанный при регистрации
- UID: уникальный идентификатор
- Created: текущая дата/время

### 5. Проверьте Network tab

В DevTools → Network должны быть запросы к:
- `POST /auth/v1/signup` → ответ `200 OK`
- Ответ содержит `access_token` и `refresh_token`

### 6. Проверьте localStorage

В DevTools → Application → Local Storage должны быть ключи:
- `lapometr.db.v1` - содержит пользователя с полем `cloudId`
- `lapometr.session.v1` - ID текущей сессии

## Диагностика проблем

### Проблема: "Облачный режим не активен"

**Симптом:** В консоли видно:
```
[Register] Облачный режим не активен, используем локальную регистрацию
```

**Причина:** Переменные окружения не попали в бандл.

**Решение:**
```bash
# Проверьте .env файл
cat .env | grep VITE_SUPABASE

# Пересоберите
npm run build

# Проверьте бандл
grep "supabase.co" dist/assets/*.js
```

### Проблема: "Ошибка облачной регистрации"

**Симптом:** В консоли видно:
```
[Register] Ошибка облачной регистрации: Invalid API key
```

**Причина:** Неверный URL или anon key.

**Решение:**
1. Проверьте URL в Supabase Dashboard → Settings → API
2. Скопируйте **anon public** key (не service_role!)
3. Обновите `.env` файл
4. Пересоберите приложение

### Проблема: "Пользователь не появляется в Supabase"

**Симптом:** Регистрация проходит, но в Supabase Dashboard → Users пусто.

**Причина:** 
- Либо регистрация идёт в localStorage (не в облако)
- Либо есть ошибка CSP
- Либо Supabase Auth не настроен

**Решение:**
1. Проверьте консоль на наличие `[Register] ✓ Облачная регистрация успешна`
2. Проверьте Network tab на наличие запросов к `/auth/v1/signup`
3. Проверьте CSP в nginx.conf:
   ```nginx
   add_header Content-Security-Policy "connect-src 'self' http://192.168.0.48:8000 ws://192.168.0.48:8000;" always;
   ```
4. Проверьте Supabase Dashboard → Authentication → Providers → Email → Enable

### Проблема: "Запросов к Supabase нет"

**Симптом:** В Network tab нет запросов к `192.168.0.48:8000`.

**Причина:** Приложение не пытается использовать облако.

**Решение:**
1. Убедитесь, что в консоли есть `[Cloud Init] ✓ Облачный режим активирован`
2. Проверьте, что `loadCloudConfig()` возвращает конфигурацию
3. Добавьте логирование в `register()`:
   ```javascript
   console.log("[Register] cloudConfig:", loadCloudConfig());
   ```

## Тестовый сценарий

### Полный тест облачной регистрации

1. **Очистите данные:**
   ```javascript
   // В консоли браузера
   localStorage.clear();
   sessionStorage.clear();
   ```

2. **Перезагрузите приложение:**
   - F5 или Ctrl+R

3. **Проверьте инициализацию:**
   - Откройте консоль (F12)
   - Должны увидеть `[Cloud Init] ✓ Облачный режим активирован`

4. **Зарегистрируйтесь:**
   - Email: test@example.com
   - Password: test123
   - Name: Test User

5. **Проверьте консоль:**
   ```
   [Register] Облачный режим активен, регистрируем в Supabase...
   [Register] ✓ Облачная регистрация успешна
   ```

6. **Проверьте Network:**
   - Должен быть запрос `POST /auth/v1/signup`
   - Статус: `200 OK`
   - Response: содержит `access_token`

7. **Проверьте Supabase Dashboard:**
   - Authentication → Users
   - Должен быть пользователь `test@example.com`

8. **Проверьте localStorage:**
   - Application → Local Storage
   - `lapometr.db.v1` → users → должен быть пользователь с `cloudId`

## Логи для отладки

Если что-то не работает, соберите следующие логи:

### Из консоли браузера:
```
[Cloud Init] ...
[Cloud Config] ...
[Supabase Client] ...
[Register] ... или [Login] ...
```

### Из Network tab:
- URL запроса
- Status code
- Request headers (особенно `apikey`)
- Response body

### Из Supabase Dashboard:
- Authentication → Users (список пользователей)
- Authentication → Logs (логи аутентификации)

## Дополнительные проверки

### Проверка CSP

```bash
curl -I http://localhost:4173 | grep Content-Security-Policy
```

Должно содержать:
```
connect-src 'self' http://192.168.0.48:8000 ws://192.168.0.48:8000
```

### Проверка CORS

```bash
curl -X POST http://192.168.0.48:8000/auth/v1/signup \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

Должен вернуть `200 OK` с `access_token`.

### Проверка переменных в бандле

```bash
# Должно вывести URL Supabase
grep -o "http://192.168.0.48:8000" dist/assets/*.js | head -1
```

## Успешная регистрация

Если всё работает правильно:
- ✅ В консоли видно `[Register] ✓ Облачная регистрация успешна`
- ✅ В Network есть запрос к `/auth/v1/signup` со статусом `200`
- ✅ В Supabase Dashboard появился новый пользователь
- ✅ В localStorage есть пользователь с `cloudId`
- ✅ После перезагрузки страницы пользователь автоматически входит

## Если ничего не помогает

1. Создайте новый Supabase проект
2. Проверьте, что Email Auth включён
3. Убедитесь, что `ENABLE_EMAIL_AUTOCONFIRM=true`
4. Пересоберите приложение с новыми переменными
5. Очистите localStorage и sessionStorage
6. Попробуйте зарегистрироваться снова
7. Соберите все логи из консоли и Network tab
8. Создайте issue с этими логами
