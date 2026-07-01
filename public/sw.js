// Service Worker for Gestão Financeira Pessoal PWA
const CACHE_NAME = "financas-staff-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network first fallback to Cache
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and local domains
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Push Event Listener (Critical for Web Push notifications!)
self.addEventListener("push", (event) => {
  let data = {
    notification: {
      title: "⚠️ Finanças Alerta",
      body: "Você tem um novo compromisso financeiro próximo!",
      icon: "/icon-192.png",
      vibrate: [200, 100, 200]
    }
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      // Fallback text payload
      data = {
        notification: {
          title: "⚠️ Finanças Alerta",
          body: event.data.text(),
          icon: "/icon-192.png",
          vibrate: [200, 100, 200]
        }
      };
    }
  }

  const title = data.notification.title;
  const options = {
    body: data.notification.body,
    icon: data.notification.icon || "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: data.notification.vibrate || [200, 100, 200],
    data: data.notification.data || { url: "/" },
    actions: [
      { action: "open", title: "Ver no App" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Event Listener
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and redirect
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "navigate", url: urlToOpen });
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
