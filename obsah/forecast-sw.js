/*
 * Service worker pro Předpověď počasí.
 *
 * Strategie (pečlivě zvolená, aby se NIKDY nedržela stará verze stránky):
 *  - HTML a soubory z vlastní domény: NETWORK-FIRST → vždy se zkusí stáhnout
 *    čerstvá verze, cache slouží jen jako offline záloha.
 *  - CDN knihovny (cdnjs – Chart.js, Leaflet): CACHE-FIRST → URL jsou verzované,
 *    obsah se nemění, offline pak grafy fungují.
 *  - API data (Open-Meteo, RainViewer) a mapové dlaždice: SW je vůbec neobsluhuje.
 *    O offline předpověď se stará localStorage cache přímo v aplikaci.
 *
 * Při vydání nové verze zvyšte VERSION – stará cache se při aktivaci smaže.
 */
const VERSION = 'v1';
const CACHE_NAME = 'forecast-cache-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(['./forecast.html']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Data a mapové dlaždice nikdy neukládej ani neobsluhuj
  if (/(^|\.)(open-meteo\.com|rainviewer\.com|openstreetmap\.org|opentopomap\.org|cartocdn\.com)$/.test(url.hostname)) {
    return;
  }

  // Vlastní doména (HTML, ikony, manifest): network-first
  if (req.mode === 'navigate' || url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return resp;
        })
        // Offline: u navigace ignoruj query string (?kiosk=1 apod.), ať se najde uložená stránka
        .catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }))
    );
    return;
  }

  // CDN knihovny: cache-first
  if (/(^|\.)cdnjs\.cloudflare\.com$/.test(url.hostname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit ||
        fetch(req).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return resp;
        })
      )
    );
  }
  // Vše ostatní projde bez zásahu service workeru
});
