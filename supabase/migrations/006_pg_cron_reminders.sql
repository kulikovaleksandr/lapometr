-- Миграция 006: pg_cron для серверных напоминаний
-- Настройка ежечасного запуска Edge Function reminders-send
--
-- ВАЖНО: pg_cron доступно только на платных планах Supabase (Pro и выше).
-- На бесплатном плане используйте внешний cron (GitHub Actions, cron-job.org и т.д.)

-- Включаем расширение pg_cron (требует прав суперпользователя)
-- В Supabase Cloud это делается через Dashboard → Database → Extensions
create extension if not exists pg_cron;

-- Создаём задачу для ежечасного запуска reminders-send
-- Расписание: '0 * * * *' = каждый час в 0 минут
-- Заменяем существующую задачу если она есть
select cron.schedule(
  'send-reminders-hourly',
  '0 * * * *',
  $$
  select
    net.http_post(
      url => current_setting('app.settings.supabase_url') || '/functions/v1/reminders-send',
      headers => jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body => '{}'::jsonb
    ) as request_id;
  $$
);

-- Альтернатива: если current_setting не работает, используйте прямые значения
-- Замените YOUR_SUPABASE_URL и YOUR_SERVICE_ROLE_KEY на реальные значения
/*
select cron.schedule(
  'send-reminders-hourly',
  '0 * * * *',
  $$
  select
    net.http_post(
      url => 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/reminders-send',
      headers => jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body => '{}'::jsonb
    ) as request_id;
  $$
);
*/

-- Проверка задач
-- select * from cron.job;

-- Удаление задачи (если нужно)
-- select cron.unschedule('send-reminders-hourly');

-- Комментарии
comment on function cron.schedule is 'Schedule a recurring job using pg_cron';
