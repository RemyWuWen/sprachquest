/* ============================================================
   sw.js — service worker
   ------------------------------------------------------------
   Makes Sprachquest work with no connection at all: the whole
   game (1 MB of chunks included) is precached on first visit, so
   a train with no signal is still a study session. Only the AI
   boss conversations need the network.

   Bump CACHE whenever you redeploy — the activate handler deletes
   every older cache, so a stale service worker can never pin an
   old build.
   ============================================================ */

const CACHE = 'sprachquest-d1539e45';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './css/style.css?v=d1539e45',
  './data/chunks.js?v=d1539e45',
  './js/ai.js?v=d1539e45',
  './js/audio.js?v=d1539e45',
  './js/battle.js?v=d1539e45',
  './js/fx.js?v=d1539e45',
  './js/game.js?v=d1539e45',
  './js/lookup.js?v=d1539e45',
  './js/meta.js?v=d1539e45',
  './js/srs.js?v=d1539e45',
  './js/world.js?v=d1539e45'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // Individually, so one 404 can't abort the whole precache.
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never touch the Anthropic API — it must always hit the network.
  if (url.origin !== self.location.origin) return;

  // Navigations go network-first so a redeploy is picked up immediately;
  // the cache is the fallback when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Everything else is content-addressed by ?v= — cache-first is safe and fast.
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
