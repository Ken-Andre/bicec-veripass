import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  let data = { title: 'BICEC VeriPass', body: '' }
  try {
    data = event.data?.json() ?? data
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title || 'BICEC VeriPass', {
      body: data.body || '',
      icon: data.icon || '/mobile/favicon.svg',
      badge: data.badge || '/mobile/pwa-192x192.png',
      tag: data.tag || 'default',
      data: { url: data.url || '/mobile/' },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/mobile/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})

registerRoute(
  ({ url }) => url.origin === 'https://localhost:3000' && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
  })
)

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
  })
)
