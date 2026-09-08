import * as Sentry from '@sentry/react';

// Типы для событий аналитики
type AnalyticsEvent = {
  name: string;
  properties?: Record<string, string | number | boolean>;
};

// Хранилище для последних ошибок
const recentErrors: Array<{
  id: string;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
}> = [];
const MAX_RECENT_ERRORS = 10;

// Подписчики на ошибки
const errorSubscribers: Array<(errors: typeof recentErrors) => void> = [];

/**
 * Инициализация систем мониторинга
 * Вызывается один раз при старте приложения
 */
export function initMonitoring(): void {
  // Инициализация Sentry (только в продакшене)
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE || 'production',
      
      // Настройка производительности
      tracesSampleRate: 0.1, // 10% транзакций для мониторинга производительности
      
      // Настройка повторных попыток
      replaysOnErrorSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      
      // Игнорировать определенные ошибки
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
      ],
      
      // Перед отправкой события
      beforeSend(event) {
        // Можно добавить дополнительную фильтрацию здесь
        return event;
      },
    });
  }

  // Инициализация Plausible (только в продакшене)
  if (import.meta.env.PROD && import.meta.env.VITE_PLAUSIBLE_DOMAIN) {
    // Plausible автоматически загружается через script tag в index.html
    // Здесь можно добавить дополнительную конфигурацию если нужно
    console.log('[Monitoring] Plausible initialized for', import.meta.env.VITE_PLAUSIBLE_DOMAIN);
  }
}

/**
 * Отправка события в аналитику
 */
export function trackEvent(event: AnalyticsEvent): void {
  // Отправка в Plausible
  if (import.meta.env.PROD && import.meta.env.VITE_PLAUSIBLE_DOMAIN) {
    // Plausible использует глобальную функцию plausible()
    if (typeof window !== 'undefined' && 'plausible' in window) {
      (window as any).plausible(event.name, { props: event.properties });
    }
  }

  // Отправка в Sentry как breadcrumb
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      category: 'analytics',
      message: event.name,
      data: event.properties,
      level: 'info',
    });
  }

  // Логирование в development
  if (import.meta.env.DEV) {
    console.log('[Analytics]', event.name, event.properties);
  }
}

/**
 * Трекинг завершения активности
 */
export function trackActivityComplete(data: {
  activityId: string;
  activityTitle: string;
  paws: number;
  hasPhoto: boolean;
}): void {
  trackEvent({
    name: 'activity_complete',
    properties: {
      activity_id: data.activityId,
      activity_title: data.activityTitle,
      paws: data.paws,
      has_photo: data.hasPhoto,
    },
  });
}

/**
 * Трекинг прикрепления фото
 */
export function trackPhotoAttached(data: {
  activityId: string;
  photoSize: number;
}): void {
  trackEvent({
    name: 'photo_attached',
    properties: {
      activity_id: data.activityId,
      photo_size: data.photoSize,
    },
  });
}

/**
 * Трекинг создания питомца
 */
export function trackPetCreated(data: {
  petId: string;
  species: string;
  hasBirthday: boolean;
}): void {
  trackEvent({
    name: 'pet_created',
    properties: {
      pet_id: data.petId,
      species: data.species,
      has_birthday: data.hasBirthday,
    },
  });
}

/**
 * Трекинг синхронизации с облаком
 */
export function trackSync(data: {
  type: 'push' | 'pull' | 'realtime';
  recordsCount: number;
  success: boolean;
}): void {
  trackEvent({
    name: 'sync',
    properties: {
      type: data.type,
      records_count: data.recordsCount,
      success: data.success,
    },
  });
}

/**
 * Трекинг использования приглашения
 */
export function trackInviteUsed(data: {
  petId: string;
  inviteCode: string;
}): void {
  trackEvent({
    name: 'invite_used',
    properties: {
      pet_id: data.petId,
      invite_code: data.inviteCode,
    },
  });
}

/**
 * Трекинг смены темы
 */
export function trackThemeChange(data: {
  theme: string;
}): void {
  trackEvent({
    name: 'theme_change',
    properties: {
      theme: data.theme,
    },
  });
}

/**
 * Установка контекста пользователя
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  name?: string;
}): void {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
  }
}

/**
 * Очистка контекста пользователя
 */
export function clearUserContext(): void {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

/**
 * Захват ошибки с контекстом
 */
export function captureError(
  error: Error | string,
  context?: Record<string, unknown>
): void {
  // Добавляем в список последних ошибок
  const errorEntry = {
    id: Math.random().toString(36).substring(7),
    message: error instanceof Error ? error.message : error,
    timestamp: Date.now(),
    context,
  };
  
  recentErrors.unshift(errorEntry);
  if (recentErrors.length > MAX_RECENT_ERRORS) {
    recentErrors.pop();
  }
  
  // Уведомляем подписчиков
  errorSubscribers.forEach(subscriber => subscriber([...recentErrors]));

  // Отправка в Sentry
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    if (context) {
      Sentry.setExtras(context);
    }
    
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(error);
    }
  }

  // Логирование в development
  if (import.meta.env.DEV) {
    console.error('[Error]', error, context);
  }
}

/**
 * Подписка на список последних ошибок
 */
export function subscribeErrors(
  callback: (errors: typeof recentErrors) => void
): () => void {
  errorSubscribers.push(callback);
  
  // Возвращаем функцию отписки
  return () => {
    const index = errorSubscribers.indexOf(callback);
    if (index > -1) {
      errorSubscribers.splice(index, 1);
    }
  };
}

/**
 * Получение списка последних ошибок
 */
export function getRecentErrors(): typeof recentErrors {
  return [...recentErrors];
}
