// App shell cached for offline use; content bundles are fetched fresh when online, cached copy otherwise.
const SHELL = "dd-shell-v1";
const FILES = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== "dd-data").map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes("/data/")) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open("dd-data").then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request)));
});
