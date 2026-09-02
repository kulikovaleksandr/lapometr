# Лапометр — архитектура

## 1. Стек

| Слой | Технология | Обоснование |
|------|-----------|-------------|
| Язык | TypeScript 5 (strict) | типизация доменной модели |
| UI | React 18 + Vite 6 | быстрый HMR, SPA без установки |
| Стили | Tailwind CSS v4 (`@theme inline`) + CSS-переменные | 5 тем через один набор токенов |
| Шрифты | Unbounded (дисплейный, кириллица) + Golos Text (текстовый) | характерный, не «детский» вид |
| Состояние | React Context + иммутальные обновления | один источник правды, без лишних зависимостей |
| Данные (MVP) | localStorage-«база» + репозиторий-адаптер | синхронная работа офлайн |
| Графики | собственные SVG/div-компоненты | контроль дизайна, ноль зависимостей |
| Анимации | CSS keyframes + framer-motion (точечно) | микро-фидбек на каждое действие |

## 2. Схема приложения

```
┌──────────────────────────  UI (React)  ──────────────────────────┐
│  screens/  Auth → Onboarding → Shell{ Home, Journal, Duel,       │
│              Stats, Settings }                                   │
│  components/ icons.tsx · ui.tsx (Btn, Modal, Ring, CountUp...)   │
└───────────────┬──────────────────────────────────────────────────┘
                │ useApp() (state/AppContext.tsx)
┌───────────────▼──────────────────────────────────────────────────┐
│  Доменный слой  lib/db.ts                                        │
│  register/login · complete (лимиты) · computeDue (напоминания)   │
│  streaks · totals · пригласительные коды                         │
└───────────────┬──────────────────────────────────────────────────┘
                │ load/save (JSON)
┌───────────────▼──────────────────────────────────────────────────┐
│  Хранилище: localStorage                                         │
│  lapometr.db.v1 · lapometr.session.v1 · lapometr.theme.v1        │
│  sync: событие `storage` + кастомное событие (мульти-вкладки)    │
└──────────────────────────────────────────────────────────────────┘
```

## 3. Модель данных (MVP, localStorage)

```ts
User     { id, email, name, pass(hash), color, img?, createdAt, demo? }
Pet      { id, name, species, breed, birthday, color, img?,
           ownerIds[], invite, createdAt }
ActDef   { id, petId, title, icon, color, paws,
           limitDay, limitWeek, limitMonth,   // 0 = без лимита
           remindH,                           // 0 = напоминание выключено
           custom? }
LogEntry { id, petId, actId, ownerId, at }
DB       { v, users[], pets[], acts[], logs[] }
```

### 3.1. Реляционная схема для миграции (PostgreSQL / Supabase)

```sql
create table users   (id uuid pk, email text unique, name text, avatar_url text, created_at timestamptz);
create table pets    (id uuid pk, name text, species text, breed text, birthday date,
                      avatar_url text, color text, invite_code text unique, created_at timestamptz);
create table pet_owners (pet_id uuid fk, user_id uuid fk, role text, primary key(pet_id,user_id));
create table activity_defs (id uuid pk, pet_id uuid fk, title text, icon text, color text,
                      paws int, limit_day int, limit_week int, limit_month int, remind_hours int);
create table logs    (id uuid pk, pet_id uuid fk, act_id uuid fk, owner_id uuid fk, at timestamptz);
create index on logs(pet_id, at desc);
-- анти-чит лимиты: check-функция на insert logs через window count по диапазону
```

### 3.2. Авторизация
- **MVP:** локальные учётки (e-mail + пароль, djb2-хэш) в localStorage; сессия —
  `lapometr.session.v1`; гостевой режим.
- **Production:** Supabase Auth: Google OAuth + e-mail/пароль; RLS-политики
  «владелец видит своего питомца»; мультиустройство из коробки.

## 4. Ключевые механизмы

### 4.1. Лапки и уровни
`paws = Σ actDef.paws по logs`. Уровни заботы (пороги): 0 «Знакомство»,
150 «Заботливый хвост», 400 «Хранитель миски», 900 «Укротитель когтей»,
1800 «Шёпот усов», 3200 «Лапа-легенда».

### 4.2. Анти-чит лимиты
Перед записью `complete(actId)` считает записи активности за текущие
день/неделю(пн)/месяц; при превышении — блокировка с причиной.
Лимиты общие на питомца (все хозяева), чтобы нельзя было «накрутить».

### 4.3. Напоминания
У активности поле `remindH`. `computeDue()`:
`dueAt = lastLog.at + remindH·3600e3` (или «никогда не выполнялось»).
UI: список «Пора позаботиться» с «просрочено на …» / «через …».
Фоновый тик (30 c): при разрешении — браузерное `Notification`
(дедупликация по ключу `actId@dueAt`).

### 4.4. Второй хозяин
Владелец генерирует код (`PAW-XXXX`), второй пользователь регистрируется
и вводит код → добавляется в `pet.ownerIds`. Синхронизация вкладок через
событие `storage` — оба видят общий журнал и дуэль в реальном времени.

### 4.5. Темы
`<html data-theme="night|day|latte|forest|olive">` → наборы CSS-переменных
(фон, поверхности, чернила, акцент, шалфей, роза, статусы).
Tailwind-токены прокинуты через `@theme inline`, поэтому все утилиты
(`bg-surface`, `text-ink`, `border-line`…) автоматически темизируются.
Основная тема — **night** (тёплый эспрессо + медовый акцент): кошачья,
но строгая.

## 5. Модули и ответственность

```
src/
  lib/types.ts        доменные типы, уровни, метаданные тем
  lib/data.ts         дефолтные активности, палитры, генератор демо-данных
  lib/db.ts           «база»: load/save, auth, лимиты, due, серии, даты
  state/AppContext.tsx провайдер: состояние + все действия + уведомления
  components/icons.tsx ~35 рукописных SVG-иконок + морды питомцев + лого
  components/ui.tsx    Btn, Modal, Field, Seg, Ring, Bar, CountUp, Burst…
  screens/Auth.tsx     вход/регистрация/демо/гость
  screens/Onboarding   профиль → питомец
  screens/Home.tsx     карточка питомца, «пора», быстрые активности, дуэль-мини
  screens/Journal.tsx  таймлайн-шкала (главная идея №1)
  screens/Duel.tsx     соревнование хозяев (главная идея №2)
  screens/Stats.tsx    разрезы: дни/активности/хозяева/часы/регулярность
  screens/Settings.tsx профиль, темы, хозяева+код, CRUD активностей, данные
  App.tsx              оболочка: фон, шапка, навигация, тосты, роутинг экрана
```

## 6. Безопасность и производительность
- Пароли хэшируются (djb2) — для production заменить на bcrypt (сервер).
- Фото даунскейлятся до 256 px перед записью (защита квоты).
- Все выборки — O(n) по логам с индексами-кэшами в `useMemo`;
  при росте данных — пагинация журнала по месяцам.

## 7. Дорожная карта (после MVP)
1. Supabase: Postgres + Auth (Google OAuth) + RLS → настоящий мультидевайс.
2. PWA: manifest + service worker, иконка на домашний экран.
3. Несколько питомцев на аккаунт, переключатель.
4. Чат хозяев, фото к записям, ветеринарный календарь прививок.
