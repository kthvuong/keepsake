// Shows push notifications and opens the app when one is tapped.
// There is no fetch handler on purpose: the app is never cached, so it always loads the latest version.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || "keepsake", {
    body: d.body || "",
    icon: "icon-512.png",
    badge: "icon-512.png",
    tag: d.tag || undefined,
    data: { url: d.url || "/" }
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "/";
  // Only ever open this app, whatever the notification says.
  try { if (new URL(url, self.location.origin).origin !== self.location.origin) url = "/"; } catch (err) { url = "/"; }
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if ("focus" in list[i]) { list[i].postMessage({ url: url }); return list[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
