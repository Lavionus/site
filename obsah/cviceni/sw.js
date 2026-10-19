/*
 * Service worker Časovače cvičení (scope obsah/cviceni/ – přednost před
 * service workerem rozcestníku, který má scope celého webu).
 *
 * Strategie: NETWORK-FIRST s krátkým limitem. Vždy se zkusí čerstvá verze,
 * ale v posilovně se slabým signálem se nečeká – po 2,5 s se vezme uložená.
 * Offline jede vše z cache (soubory níže se uloží hned při instalaci).
 *
 * Při vydání nové verze zvyš VERZE – stará cache se při aktivaci smaže.
 */
const PREFIX = 'cviceni-';
const VERZE = 'v2';
const CACHE = PREFIX + VERZE;
const SOUBORY = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  '../../common.css',
  '../../theme.js',
  '../../podpis.js',
  '../../dialog.js',
  '../../apps.js',
];
const LIMIT_MS = 2500;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SOUBORY))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // jen vlastní staré cache – na stejném originu běží i rozcestník (webapp-*) a další
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(new Promise(resolve => {
    let hotovo = false;
    const zCache = () => caches.match(req, { ignoreSearch: req.mode === 'navigate' });
    const dej = r => { if (!hotovo && r) { hotovo = true; resolve(r); } };

    const sit = fetch(req).then(resp => {
      if (resp.ok) {
        const kopie = resp.clone();
        caches.open(CACHE).then(c => c.put(req, kopie));
      }
      dej(resp);
    }).catch(() => zCache().then(r => dej(r || Response.error())));

    // pomalá síť: po limitu použij uloženou verzi, pokud nějaká je
    setTimeout(() => { if (!hotovo) zCache().then(dej); }, LIMIT_MS);
    e.waitUntil(sit);
  }));
});
