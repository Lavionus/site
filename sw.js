/* Service worker rozcestníku.
   Jádro (index, katalog, styly) se předcachuje; jednotlivé aplikace
   se cachují průběžně při prvním otevření (stale-while-revalidate),
   takže jednou navštívená aplikace funguje i offline. */
/* Při větší aktualizaci webu zvyš číslo verze — stará cache se u návštěvníků
   smaže a vše se stáhne čerstvé (jinak SWR ukáže novou verzi až na druhé načtení). */
const PREFIX = 'webapp-';
const CACHE = PREFIX + 'v80';
const JADRO = [
  './',
  './index.html',
  './apps.js',
  './common.css',
  './theme.js',
  './podpis.js',
  './rekord.js',
  './dialog.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './obsah/aplikace.html',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(JADRO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // Mazat jen VLASTNÍ staré cache. Na stejném originu běží i service worker
      // Nodusu (nodus-*) a stránky Předpověď počasí (forecast-*); bez filtru na
      // prefix by si weby navzájem mazaly offline cache při každé aktualizaci.
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // externí API (počasí apod.) necháváme být

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      const zeSite = fetch(e.request)
        .then(resp => {
          if (resp.ok) cache.put(e.request, resp.clone());
          return resp;
        })
        // offline a stránka není v cache -> respondWith(undefined) by
        // vrátil bílou chybovou stránku; místo toho srozumitelná hláška
        .catch(() => cached || new Response(
          '<!DOCTYPE html><html lang="cs"><meta charset="UTF-8">' +
          '<meta name="viewport" content="width=device-width, initial-scale=1">' +
          '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
          'background:#1a1a1a;color:#e0e0e0;font-family:sans-serif;text-align:center;padding:20px">' +
          '<div><h1 style="font-size:1.2rem">📡 Aplikace není dostupná offline</h1>' +
          '<p style="color:#888;margin-top:8px">Tato stránka se uloží při prvním otevření online.</p></div></body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        ));
      return cached || zeSite;
    })
  );
});
