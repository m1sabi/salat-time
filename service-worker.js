self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Optional: if the page decides to tell us to show a notification
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'show-azan') {
    const title = data.title || 'Azan';
    const options = {
      body: data.body || 'It is time.',
      icon: data.icon || 'images/omawi.png',
      requireInteraction: true,
      tag: `azan-${data.prayer || 'prayer'}`,
      vibrate: [200, 100, 200],
      actions: [{ action: 'stop-azan', title: 'Stop Azan' }]
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Clicks on notification or on action buttons
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  event.notification.close();

  if (action === 'stop-azan') {
    // Tell all open pages to stop the audio immediately
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: 'STOP_AZAN' });
          }
          // Focus the first client if available
          if (clients.length > 0 && clients[0].focus) return clients[0].focus();
        })
    );
  } else {
    // Focus an existing client or open the app (optional)
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientsArr) => {
          for (const c of clientsArr) {
            if ('focus' in c) return c.focus();
          }
          // Optionally open a URL:
          // return self.clients.openWindow('/');
        })
    );
  }
});
