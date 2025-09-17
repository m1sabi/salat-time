/* OneSignal service worker (scoped as configured in index.html) */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// Handle push click (open/focus app and optionally trigger preview play)
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  event.notification.close();

  // "Stop Azan" action → tell the page to stop audio
  if (action === 'stop-azan') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
        for (const c of clientsArr) c.postMessage({ type: 'STOP_AZAN' });
        if (clientsArr.length > 0 && clientsArr[0].focus) return clientsArr[0].focus();
      })
    );
    return;
  }

  // Default click: focus/open the app (adjust path if needed)
  const target = '/salat-time/?play=azan';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if (client.url.includes('/salat-time/')) {
        try {
          await client.focus();
          if (!client.url.includes('?play=azan')) await client.navigate(target);
        } catch (_) {}
        return;
      }
    }
    await clients.openWindow(target);
  })());
});
