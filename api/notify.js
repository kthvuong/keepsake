var webpush = require("web-push");

// The public half of the key pair. The private half lives only in the VAPID_PRIVATE_KEY env var.
var VAPID_PUBLIC_KEY = "BA6E426UxMLzXZqpilZimE6YeORrECneasX6WgygNDrRh8s6_QKhZF2L9jOr9T2oyPYUHglVBC95H0LJVwMNVYo";
var SUBJECT = "https://keepsake-azure.vercel.app";

// Only real browser push services, so this can't be pointed at arbitrary URLs.
var PUSH_HOSTS = [
  /^https:\/\/[a-z0-9-]+\.push\.apple\.com\//,
  /^https:\/\/fcm\.googleapis\.com\//,
  /^https:\/\/updates\.push\.services\.mozilla\.com\//,
  /^https:\/\/[a-z0-9.-]+\.notify\.windows\.com\//
];

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  var privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) {
    res.status(500).json({ error: "Push is not configured" });
    return;
  }
  var body = req.body || {};
  var subs = Array.isArray(body.subs) ? body.subs.slice(0, 10) : [];
  var url = typeof body.url === "string" && body.url.charAt(0) === "/" ? body.url.slice(0, 200) : "/";
  var payload = JSON.stringify({
    title: String(body.title || "keepsake").slice(0, 80),
    body: String(body.body || "").slice(0, 180),
    tag: String(body.tag || "").slice(0, 60),
    url: url
  });
  try {
    webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC_KEY, privateKey.trim());
  } catch (err) {
    // web-push's message describes what's wrong with the key's shape and never includes the key itself.
    res.status(500).json({ error: "Push key is invalid", detail: String((err && err.message) || "").slice(0, 120), length: privateKey.trim().length });
    return;
  }
  var sent = 0, failed = 0, gone = [];
  await Promise.all(subs.map(async function (s) {
    var ok = s && typeof s.endpoint === "string" && s.keys && s.keys.p256dh && s.keys.auth &&
      PUSH_HOSTS.some(function (h) { return h.test(s.endpoint); });
    if (!ok) { failed++; return; }
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, payload, { TTL: 86400 });
      sent++;
    } catch (err) {
      // 404 and 410 mean the phone dropped this subscription, so the app can forget it.
      if (err && (err.statusCode === 404 || err.statusCode === 410)) gone.push(s.endpoint);
      else failed++;
    }
  }));
  res.status(200).json({ sent: sent, failed: failed, gone: gone });
};
