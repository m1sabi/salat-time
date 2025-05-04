if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

self.addEventListener("install", (event) => {
    console.log("Service Worker Installed ✅");
    self.skipWaiting(); // Activate immediately
});

self.addEventListener("push", (event) => {
  const options = {
    body: event.data ? event.data.text() : "It's prayer time! ⏰",
    icon: "azan_icon.png",
    badge: "azan_icon.png",
    vibrate: [200, 100, 200],
    data: { primaryKey: 1 },
    actions: [{ action: "stop", title: "Stop Azan", icon: "stop_icon.png" }]
  };

  event.waitUntil(
    self.registration.showNotification("📢 Azan Alert", options)
  );
});


// Handle user clicking on notification
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    if (event.action === "stop") {
        // Stop Azan when user clicks "Stop Azan"
        self.clients.matchAll().then((clients) => {
            clients.forEach((client) => client.postMessage({ action: "stopAzan" }));
        });
    }
});
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data.type === "azan") {
    const options = {
      body: data.body,
      icon: data.icon,
      badge: data.icon,
      actions: [{ action: "stop", title: "إيقاف الأذان", icon: "stop_icon.png" }]
    };
    self.registration.showNotification(data.title, options);
  }
});
