// VAJRA §5.5 Web Push Service Worker.
// Real use case: an instant browser notification for a supervisor's pending
// approval/high-severity alert, instead of waiting on the next poll cycle.
// This file is deliberately tiny and dependency-free -- a Service Worker
// runs outside the React bundle, so it can't import app code or use ES
// modules by default (no "type: module" registration is used here).

self.addEventListener("push", (event) => {
  let payload = { title: "VAJRA Alert", body: "New alert requires your attention.", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {
    // Not JSON (shouldn't happen -- backend always sends JSON) -- fall back
    // to the raw text rather than dropping the notification silently.
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/vite.svg",
      badge: "/vite.svg",
      data: { url: payload.url || "/" },
      tag: "vajra-alert", // collapses rapid-fire duplicates into one notification instead of stacking
      renotify: true,
    })
  );
});

// Clicking the notification focuses an already-open VAJRA tab if one exists,
// instead of always opening a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
