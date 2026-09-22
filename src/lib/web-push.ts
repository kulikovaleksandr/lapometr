/**
 * Web Push API клиент
 * Управление подписками на push-уведомления через VAPID
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Проверка поддержки Web Push браузером
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Запрос разрешения на push-уведомления
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error('Web Push не поддерживается браузером');
  }
  return await Notification.requestPermission();
}

/**
 * Получение текущего статуса разрешения
 */
export function getPermissionStatus(): NotificationPermission {
  if (!isPushSupported()) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Подписка на push-уведомления
 */
export async function subscribe(
  vapidPublicKey: string,
  userId: string
): Promise<PushSubscriptionData | null> {
  if (!isPushSupported()) {
    throw new Error('Web Push не поддерживается браузером');
  }

  const permission = await requestPermission();
  if (permission !== 'granted') {
    throw new Error('Пользователь отклонил разрешение на уведомления');
  }

  const registration = await navigator.serviceWorker.ready;
  
  // Проверяем существующую подписку
  let subscription = await registration.pushManager.getSubscription();
  
  if (!subscription) {
    // Создаём новую подписку
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
  }

  const subscriptionData: PushSubscriptionData = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
      auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
    },
  };

  // Отправляем подписку на сервер
  const response = await fetch('/functions/v1/push-subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      subscription: subscriptionData,
    }),
  });

  if (!response.ok) {
    throw new Error('Не удалось сохранить подписку на сервере');
  }

  return subscriptionData;
}

/**
 * Отписка от push-уведомлений
 */
export async function unsubscribe(userId: string): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    // Удаляем подписку с сервера
    await fetch('/functions/v1/push-unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        endpoint: subscription.endpoint,
      }),
    });

    // Отменяем подписку в браузере
    await subscription.unsubscribe();
  }

  return true;
}

/**
 * Отправка тестового уведомления
 */
export async function sendTestNotification(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  const permission = await requestPermission();
  if (permission !== 'granted') {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  
  await registration.showNotification('Лапометр', {
    body: 'Тестовое уведомление работает!',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: 'lapometr-test',
  });

  return true;
}

/**
 * Конвертация VAPID ключа из base64url в Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
