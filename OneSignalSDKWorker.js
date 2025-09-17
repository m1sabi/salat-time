/* OneSignal service worker (root scope) */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// When the user taps the push, open/focus the app and pass ?play=azan
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const target = '/salat-time/?play=azan'; // adjust if your app path is different

  e.waitUntil((async () => {
    // Try to focus an existing client first
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of allClients) {
      // Is this our app?
      if (client.url.includes('/salat-time/')) {
        // If it’s already on the play URL, just focus; otherwise navigate to it
        try {
          await client.focus();
          if (!client.url.includes('?play=azan')) {
            await client.navigate(target);
          }
        } catch (_) {}
        return;
      }
    }

    // No open tab? Open a new one
    await clients.openWindow(target);
  })());
});
// Custom Azan Stop integration
self.addEventListener('notificationclick', (event) => {
  if (event.action === 'stop-azan') {
    event.notification.close();
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: 'STOP_AZAN' });
          }
          if (clients.length > 0 && clients[0].focus) return clients[0].focus();
        })
    );
  }
});
