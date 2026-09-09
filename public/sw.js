/* Лапометр — service worker: офлайн-режим и быстрый повторный запуск */
const CACHE = "lapometr-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = FONT_HOSTS.includes(url.host);
  if (!sameOrigin && !isFont) return; // остальное — как обычно

  /* Навигация: сеть → кэш (офлайн открывает приложение) */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/").then((hit) => hit || Response.error()))
    );
    return;
  }

/* Статика и шрифты: stale-while-revalidate */
e.respondWith(
  caches.match(req).then((hit) => {
    const fresh = fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => hit);
    return hit || fresh;
  })
);
});

/* Web Push: обработка push-уведомлений */
self.addEventListener("push", (e) => {
  if (!e.data) return;
  
  let payload;
  try {
    payload = e.data.json();
  } catch {
    payload = { title: "Лапометр", body: e.data.text() };
  }
  
  const { title, body, icon, badge, tag, url } = payload;
  
  e.waitUntil(
    self.registration.showNotification(title || "Лапометр", {
      body: body || "",
      icon: icon || "/icon.svg",
      badge: badge || "/icon.svg",
      tag: tag || "lapometr-default",
       url: url || "/",
      vibrate: [200, 100, 200],
      actions: [
        { action: "open", title: "Открыть" },
        { action: "dismiss", title: "Закрыть" }
      ]
    })
  );
});

/* Обработка клика по уведомлению */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  
  if (e.action === "dismiss") return;
  
  const url = e.notification.data?.url || "/";
  
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Если вкладка уже открыта — фокусируем её
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Иначе открываем новую вкладку
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

/* Обработка закрытия уведомления */
self.addEventListener("notificationclose", (e) => {
  // Можно отправить аналитику о закрытии
  console.log("[SW] Notification closed:", e.notification.tag);
});