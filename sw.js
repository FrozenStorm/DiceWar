const CACHE_NAME = "dicewar-v35";

const PRECACHE_ASSETS = [
  "./",
  "index.html",
  "site.webmanifest",
  "engine/board.js",
  "engine/core.js",
  "engine/paths.js",
  "engine/sets/index.js",
  "engine/sets/rox.js",
  "engine/sets/bod.js",
  "engine/sets/lod.js",
  "engine/sets/rom.js",
  "engine/sets/kos.js",
  "engine/sets/doa.js",
  "engine/locations/index.js",
  "ui/rules-mode.js",
  "ui/animate.js",
  "ui/ring.js",
  "ui/hud.js",
  "net/online.js", "net/backend-firebase.js", "net/firebase-config.js",
  "img/ui/board.jpg", "img/ui/crown.png", "img/ui/claw.png", "img/ui/exile.png", "img/ui/reserve.png",
  "fonts/cinzel.woff2", "fonts/crimson-text-400.woff2", "fonts/crimson-text-600.woff2", "fonts/crimson-text-400-italic.woff2",
  "ui/ai-worker.js", "ui/expert-worker.js",
  "ai/ai.js", "ai/eval.js", "ai/common.js", "ai/setup.js", "ai/expert.js", "ai/expert-parallel.js",
  "ai/rng.js",
  "lab/runner.js", "lab/stats.js", "lab/report.js", "lab/zip.js", "lab/lab-worker.js",
  "ui/lab.js",
  "icon/favicon.ico",
  "icon/favicon-16x16.png",
  "icon/favicon-32x32.png",
  "icon/apple-touch-icon.png",
  "icon/android-chrome-192x192.png",
  "icon/android-chrome-512x512.png",
  "img/global/zugablauf.png",
  "img/global/glossar.png",
  "img/BoD/marker.png",
  "img/BoD/1.png", "img/BoD/2.png", "img/BoD/3.png", "img/BoD/4.png", "img/BoD/5.png", "img/BoD/6.png",
  "img/BoD/1b.png", "img/BoD/2b.png", "img/BoD/3b.png", "img/BoD/4b.png", "img/BoD/5b.png", "img/BoD/6b.png",
  "img/BoD/rules/artwork.png", "img/BoD/rules/marker.png",
  "img/BoD/rules/1.png", "img/BoD/rules/2.png", "img/BoD/rules/3.png", "img/BoD/rules/4.png", "img/BoD/rules/5.png", "img/BoD/rules/6.png",
  "img/DoA/marker.png",
  "img/DoA/1.png", "img/DoA/2.png", "img/DoA/3.png", "img/DoA/4.png", "img/DoA/5.png", "img/DoA/6.png",
  "img/DoA/1b.png", "img/DoA/2b.png", "img/DoA/3b.png", "img/DoA/4b.png", "img/DoA/5b.png", "img/DoA/6b.png",
  "img/DoA/rules/artwork.png", "img/DoA/rules/marker.png",
  "img/DoA/rules/1.png", "img/DoA/rules/2.png", "img/DoA/rules/3.png", "img/DoA/rules/4.png", "img/DoA/rules/5.png", "img/DoA/rules/6.png",
  "img/KoS/marker.png",
  "img/KoS/1.png", "img/KoS/2.png", "img/KoS/3.png", "img/KoS/4.png", "img/KoS/5.png", "img/KoS/6.png",
  "img/KoS/1b.png", "img/KoS/2b.png", "img/KoS/3b.png", "img/KoS/4b.png", "img/KoS/5b.png", "img/KoS/6b.png",
  "img/KoS/rules/artwork.png", "img/KoS/rules/marker.png",
  "img/KoS/rules/1.png", "img/KoS/rules/2.png", "img/KoS/rules/3.png", "img/KoS/rules/4.png", "img/KoS/rules/5.png", "img/KoS/rules/6.png",
  "img/KoS/rules/rules_1.png", "img/KoS/rules/rules_2.png",
  "img/LoD/marker.png",
  "img/LoD/1.png", "img/LoD/2.png", "img/LoD/3.png", "img/LoD/4.png", "img/LoD/5.png", "img/LoD/6.png",
  "img/LoD/1b.png", "img/LoD/2b.png", "img/LoD/3b.png", "img/LoD/4b.png", "img/LoD/5b.png", "img/LoD/6b.png",
  "img/LoD/rules/artwork.png", "img/LoD/rules/marker.png",
  "img/LoD/rules/1.png", "img/LoD/rules/2.png", "img/LoD/rules/3.png", "img/LoD/rules/4.png", "img/LoD/rules/5.png", "img/LoD/rules/6.png",
  "img/RoM/marker.png",
  "img/RoM/1.png", "img/RoM/2.png", "img/RoM/3.png", "img/RoM/4.png", "img/RoM/5.png", "img/RoM/6.png",
  "img/RoM/1b.png", "img/RoM/2b.png", "img/RoM/3b.png", "img/RoM/4b.png", "img/RoM/5b.png", "img/RoM/6b.png",
  "img/RoM/rules/artwork.png", "img/RoM/rules/marker.png",
  "img/RoM/rules/1.png", "img/RoM/rules/2.png", "img/RoM/rules/3.png", "img/RoM/rules/4.png", "img/RoM/rules/5.png", "img/RoM/rules/6.png",
  "img/RoX/marker.png",
  "img/RoX/1.png", "img/RoX/2.png", "img/RoX/3.png", "img/RoX/4.png", "img/RoX/5.png", "img/RoX/6.png",
  "img/RoX/1b.png", "img/RoX/2b.png", "img/RoX/3b.png", "img/RoX/4b.png", "img/RoX/5b.png", "img/RoX/6b.png",
  "img/RoX/rules/artwork.png", "img/RoX/rules/marker.png",
  "img/RoX/rules/1.png", "img/RoX/rules/2.png", "img/RoX/rules/3.png", "img/RoX/rules/4.png", "img/RoX/rules/5.png", "img/RoX/rules/6.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS.map((u) => new Request(u, { cache: "reload" }))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first, so every update shows on the first reload. The cache is only
// the offline fallback. "no-cache" makes the browser revalidate with the server
// instead of reusing its own HTTP cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      fetch(event.request, { cache: "no-cache" })
        .then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() =>
          cache.match(event.request, { ignoreSearch: true }).then((cached) => cached || Response.error())
        )
    )
  );
});
