// ちびそだて：オフライン用。新しい版があればそちらを優先し、つながらないときだけ保存した版を使う
const CACHE = "chibisodate-0.2.1";
const FILES = ["./", "index.html", "style.css", "boot.js", "data.js", "game.js", "data.ko.js", "game.ko.js", "manifest.webmanifest",
  "sprites/egg.png", "sprites/baby.png", "sprites/kdj.png", "sprites/yjh.png", "sprites/hsy.png",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // 天気APIなどはそのまま
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
