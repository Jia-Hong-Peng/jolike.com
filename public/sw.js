/**
 * JoLike Service Worker
 * Handles push notifications for SRS review reminders.
 */

const CACHE_NAME = 'jolike-v1'
const STATIC_ASSETS = ['/', '/feed/', '/review/', '/progress/']

// --- Install: pre-cache shell assets ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

// --- Activate: clean up old caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// --- Push: show review reminder notification ---
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json().catch(() => ({})) : {}
  const title = data.title || 'JoLike English'
  const body  = data.body  || '你有單字需要複習！打開 JoLike 繼續練習。'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'srs-review',
      renotify: true,
      data: { url: '/review/' },
    })
  )
})

// --- Notification click: open or focus review page ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/review/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      return clients.openWindow(targetUrl)
    })
  )
})
