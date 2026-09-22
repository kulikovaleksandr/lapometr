#!/bin/bash
# Внешний cron-скрипт для запуска reminders-send
# Используйте для бесплатного плана Supabase (без pg_cron)
#
# Настройка:
# 1. Замените SUPABASE_URL и SERVICE_ROLE_KEY на ваши значения
# 2. Добавьте в crontab: 0 * * * * /path/to/external-cron.sh
# 3. Или используйте cron-job.org / GitHub Actions

SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"

curl -X POST "${SUPABASE_URL}/functions/v1/reminders-send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -d '{}' \
  --silent \
  --output /dev/null
