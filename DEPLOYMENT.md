# Инструкция по обновлению и развертыванию Лапометра

## Предварительные требования

- Docker и Docker Compose установлены
- Доступ к серверу с правами sudo
- Резервная копия базы данных перед обновлением

## Перед обновлением: Backup

**ВСЕГДА** делайте backup перед обновлением:

```bash
# Backup базы данных Supabase
sudo docker exec supabase-db pg_dump -U postgres postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup конфигурации
sudo docker compose config > docker-compose-backup.yml
```

## Сценарий 1: Только изменения в коде (UI, логика, стили)

```bash
cd /opt/apps/lapometr

# 1. Получаем новые исходники
git pull origin main

# 2. Пересобираем образ (Docker использует кэш для неизмененных слоев)
sudo docker compose up -d --build

# 3. Проверяем статус контейнеров
sudo docker compose ps

# 4. Проверяем логи на наличие ошибок
sudo docker compose logs --tail=50 app

# 5. Проверяем доступность приложения
curl -I http://localhost:3000
```

## Сценарий 2: Изменения в схеме базы данных

### Вариант A: Автоматическое применение миграций (рекомендуется)

Если у вас настроена система автоматических миграций:

```bash
cd /opt/apps/lapometr

# 1. Получаем новые исходники (включая новые миграции)
git pull origin main

# 2. Применяем миграции автоматически
sudo docker compose run --rm migrate

# 3. Проверяем статус миграций
sudo docker compose run --rm migrate status

# 4. Пересобираем фронтенд
sudo docker compose up -d --build

# 5. Проверяем логи
sudo docker compose logs --tail=50 app
```

### Вариант B: Ручное применение миграций

Если автоматические миграции не настроены:

```bash
cd /opt/apps/lapometr

# 1. Получаем новые исходники
git pull origin main

# 2. Определяем, какие миграции нужно применить
ls -la supabase/migrations/*.sql | grep -E '00[6-9]|0[1-9][0-9]'

# 3. Применяем миграции по одной
for f in supabase/migrations/006_*.sql supabase/migrations/007_*.sql; do
  if [ -f "$f" ]; then
    echo "=== Applying $f ==="
    sudo docker exec -i supabase-db psql -U postgres -d postgres -f /dev/stdin < "$f"
    if [ $? -eq 0 ]; then
      echo "✓ $f applied successfully"
    else
      echo "✗ Failed to apply $f"
      exit 1
    fi
  fi
done

# 4. Пересобираем фронтенд
sudo docker compose up -d --build

# 5. Проверяем статус
sudo docker compose ps
```

### Вариант C: Создание таблицы для отслеживания миграций

Для автоматизации создайте таблицу для отслеживания примененных миграций:

```sql
-- Выполните один раз в Supabase
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Затем используйте скрипт для применения миграций:

```bash
#!/bin/bash
# apply-migrations.sh

MIGRATIONS_DIR="supabase/migrations"

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
  version=$(basename "$migration_file" .sql)
  
  # Проверяем, применена ли уже эта миграция
  applied=$(sudo docker exec -i supabase-db psql -U postgres -d postgres -t -c \
    "SELECT COUNT(*) FROM schema_migrations WHERE version = '$version';")
  
  if [ "$applied" -eq 0 ]; then
    echo "Applying migration: $version"
    
    # Применяем миграцию
    sudo docker exec -i supabase-db psql -U postgres -d postgres < "$migration_file"
    
    if [ $? -eq 0 ]; then
      # Записываем в таблицу миграций
      sudo docker exec -i supabase-db psql -U postgres -d postgres -c \
        "INSERT INTO schema_migrations (version) VALUES ('$version');"
      echo "✓ Migration $version applied successfully"
    else
      echo "✗ Failed to apply migration $version"
      exit 1
    fi
  else
    echo "Migration $version already applied, skipping"
  fi
done
```

## Важные правила миграций

### ✅ Идемполентность

Все миграции должны быть идемпотентными:

```sql
-- Правильно
CREATE TABLE IF NOT EXISTS new_table (...);
ALTER TABLE existing_table ADD COLUMN IF NOT EXISTS new_column TEXT;

-- Неправильно
CREATE TABLE new_table (...);  -- Ошибка, если таблица уже существует
ALTER TABLE existing_table ADD COLUMN new_column TEXT;  -- Ошибка, если колонка уже есть
```

### ✅ Инкрементальные номера

Используйте инкрементальные номера для миграций:

```
supabase/migrations/
├── 001_init.sql
├── 002_add_chat.sql
├── 003_add_realtime.sql
├── 004_add_storage.sql
├── 005_add_push.sql
├── 006_add_reminders.sql
└── 007_add_new_feature.sql  ← Новая миграция
```

**НИКОГДА** не изменяйте старые миграции после их применения!

### ✅ Однократное применение

Миграции применяются один раз. Повторное применение должно быть безопасным (благодаря идемпотентности).

## Rollback процедуры

### Откат кода (без изменения БД)

```bash
cd /opt/apps/lapometr

# 1. Откатываем к предыдущему коммиту
git checkout HEAD~1

# 2. Пересобираем образ
sudo docker compose up -d --build

# 3. Проверяем статус
sudo docker compose ps
```

### Откат миграций (если возможно)

**ВНИМАНИЕ**: Откат миграций может привести к потере данных!

```bash
# 1. Восстанавливаем БД из backup
sudo docker exec -i supabase-db psql -U postgres -d postgres < backup_20240101_120000.sql

# 2. Откатываем код
git checkout HEAD~1

# 3. Пересобираем образ
sudo docker compose up -d --build
```

## Мониторинг после обновления

### Проверка логов

```bash
# Логи приложения
sudo docker compose logs -f app

# Логи базы данных
sudo docker compose logs -f supabase-db

# Логи всех сервисов
sudo docker compose logs -f
```

### Проверка здоровья сервисов

```bash
# Статус контейнеров
sudo docker compose ps

# Использование ресурсов
sudo docker stats

# Проверка доступности
curl http://localhost:3000/health
```

### Проверка миграций

```bash
# Список примененных миграций
sudo docker exec -i supabase-db psql -U postgres -d postgres -c \
  "SELECT version, applied_at FROM schema_migrations ORDER BY applied_at DESC;"
```

## Автоматизация обновления

### Скрипт для полного обновления

```bash
#!/bin/bash
# update.sh

set -e  # Остановка при ошибке

echo "=== Starting update process ==="

# 1. Backup
echo "Creating backup..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
sudo docker exec supabase-db pg_dump -U postgres postgres > "$BACKUP_FILE"
echo "✓ Backup created: $BACKUP_FILE"

# 2. Pull changes
echo "Pulling latest changes..."
git pull origin main
echo "✓ Changes pulled"

# 3. Apply migrations
echo "Applying migrations..."
if [ -f "apply-migrations.sh" ]; then
  bash apply-migrations.sh
else
  echo "No migration script found, skipping migrations"
fi
echo "✓ Migrations applied"

# 4. Rebuild and restart
echo "Rebuilding application..."
sudo docker compose up -d --build
echo "✓ Application rebuilt"

# 5. Health check
echo "Checking application health..."
sleep 5
if curl -f http://localhost:3000 > /dev/null 2>&1; then
  echo "✓ Application is healthy"
else
  echo "✗ Application health check failed"
  echo "Check logs: sudo docker compose logs app"
  exit 1
fi

echo "=== Update completed successfully ==="
```

### Cron job для автоматического обновления (опционально)

```bash
# Добавляем в crontab (каждое воскресенье в 3:00)
0 3 * * 0 /opt/apps/lapometr/update.sh >> /var/log/lapometr-update.log 2>&1
```

## Troubleshooting

### Проблема: Миграция не применяется

**Решение**:
```bash
# Проверяем логи миграции
sudo docker compose logs migrate

# Применяем миграцию вручную
sudo docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/006_*.sql

# Проверяем синтаксис SQL
cat supabase/migrations/006_*.sql | sudo docker exec -i supabase-db psql -U postgres -d postgres --echo-errors
```

### Проблема: Контейнер не запускается

**Решение**:
```bash
# Проверяем логи
sudo docker compose logs app

# Перезапускаем контейнер
sudo docker compose restart app

# Пересобираем с нуля
sudo docker compose down
sudo docker compose up -d --build
```

### Проблема: Ошибка после обновления

**Решение**:
```bash
# 1. Откатываем к предыдущей версии
git checkout HEAD~1

# 2. Восстанавливаем БД из backup
sudo docker exec -i supabase-db psql -U postgres -d postgres < backup_*.sql

# 3. Пересобираем
sudo docker compose up -d --build
```

## Чеклист перед обновлением

- [ ] Создан backup базы данных
- [ ] Создан backup конфигурации
- [ ] Проверены новые миграции на идемпотентность
- [ ] Прочитаны release notes (если есть)
- [ ] Уведомлены пользователи о плановых работах
- [ ] Подготовлен план отката

## Чеклист после обновления

- [ ] Приложение доступно и работает
- [ ] Логи не содержат ошибок
- [ ] Все миграции применены успешно
- [ ] Функциональность проверена вручную
- [ ] Пользователи уведомлены о завершении работ
