/* OneSignal worker for GitHub Pages project scope (/salat-time/) */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  event.notification.close();

  if (action === 'stop-azan') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
        for (const c of clientsArr) c.postMessage({ type: 'STOP_AZAN' });
        if (clientsArr.length > 0 && clientsArr[0].focus) return clientsArr[0].focus();
      })
    );
    return;
  }

  // Default click: focus your page and (optionally) navigate with ?play=azan
  const target = './?play=azan';
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      try {
        await client.focus();
        if (!client.url.includes('?play=azan')) await client.navigate(target);
        return;
      } catch (e) {}
    }
    await clients.openWindow(target);
  })());
});
