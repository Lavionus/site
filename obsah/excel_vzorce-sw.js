/*
 * Service worker aplikace „Vzorce v Excelu“ (instalace na plochu, běh bez internetu).
 * Rozsah jen ./excel_vzorce (stránka + složka excel_vzorce/) – ostatní stránky dál obsluhuje sw.js rozcestníku.
 * Vlastní soubory: NETWORK-FIRST (vždy čerstvá verze, cache = záloha bez internetu).
 * Při změně seznamu PREDEM zvyšte VERSION – stará cache se při aktivaci smaže.
 */
const VERSION = 'v2';
/* stejný web (site) i jeho kopie v Metodu běží na jednom originu – cache se odliší cestou rozsahu */
const PREFIX = 'excel-vzorce-' + new URL(self.registration.scope).pathname + '-';
const CACHE_NAME = PREFIX + VERSION;
const PREDEM = [
  './excel_vzorce.html', './excel_vzorce.webmanifest',
  './excel_vzorce/jadro.js', './excel_vzorce/lekce.js', './excel_vzorce/rozbor.js', './excel_vzorce/procvic.js',
  './excel_vzorce/pruvodce.js', './excel_vzorce/ui.js', './excel_vzorce/styl.css',
  './excel_vzorce/ikona-192.png', './excel_vzorce/ikona-512.png',
  '../common.css', '../theme.js', '../podpis.js', '../dialog.js', '../i18n.js', '../i18n/jazyky.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      /* po jednom: chybějící soubor (třeba i18n v kopii webu) nesmí zablokovat instalaci */
      .then((cache) => Promise.all(PREDEM.map((u) => cache.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  /* jen vlastní cache (ne cache rozcestníku se staršími kopiemi) – offline se tak nesmíchají verze souborů */
  const zCache = () => caches.open(CACHE_NAME).then((c) => c.match(req, { ignoreSearch: req.mode === 'navigate' }));
  const sit = fetch(req).then((resp) => {
    /* ukládá se i to, co stránka načte až za běhu (slovník angličtiny, knihovna xlsx) */
    if (resp.ok) { const kopie = resp.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, kopie)); }
    return resp;
  });
  sit.catch(() => {});   /* odmítnutí po vypršení limitu jen tiše */
  /* pomalá síť: po 5 s vrátit uloženou kopii (je-li), síťová odpověď ji pak aspoň obnoví v cache */
  const limit = new Promise((ok) => setTimeout(ok, 5000)).then(zCache).then((r) => r || sit);
  event.respondWith(Promise.race([sit, limit]).catch(() => zCache().then((r) => r || Response.error())));
});
