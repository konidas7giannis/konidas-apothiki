/* Konidas Αποθήκη — λειτουργία χωρίς σήμα. Πρώτα δίκτυο (για ενημερώσεις), αλλιώς ό,τι είναι αποθηκευμένο. */
const CACHE = "apothiki-v5.6";
const SHELL = ["./", "index.html", "manifest.json", "lib/barcode-detector.js", "lib/zxing_reader.wasm", "icons/icon-180.png", "icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match("index.html"))));
});
