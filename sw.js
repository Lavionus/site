/* Service worker rozcestníku.
   Jádro (index, katalog, styly) se předcachuje; jednotlivé aplikace
   se cachují průběžně při prvním otevření (stale-while-revalidate),
   takže jednou navštívená aplikace funguje i offline. */
/* Při větší aktualizaci webu zvyš číslo verze — stará cache se u návštěvníků
   smaže a vše se stáhne čerstvé (jinak SWR ukáže novou verzi až na druhé načtení). */
const PREFIX = 'webapp-';
const CACHE = PREFIX + 'v284';
const JADRO = [
  './',
  './index.html',
  './apps.js',
  './common.css',
  './theme.js',
  './podpis.js',
  './rekord.js',
  './dialog.js',
  './tvary.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './obsah/aplikace.html',
];

/* Srdce hory (obsah/trpaslici.html) – hra si většinu souborů dotahuje až za běhu
   (obrázky událostí a konce hry, ~117 ikon GUI), takže by je samotné SWR offline
   nemělo. Celá sada se proto stáhne na pozadí hned při prvním otevření hry
   (do instalace ji nedáváme – má ~2 MB a většina návštěvníků hru nespustí).
   Seznam se píše ručně; že sedí se soubory na disku, hlídá _test/sw_trpaslici_check.js.
   Úmyslně chybí: zálohy *.bak*, *-original.png, srdce-hory-keyart.png, *.prompt.txt,
   generate-ui-icons.py (vše v .gitignore) a srdce-hory-keyart.jpg (jen záložní
   obrázek v <picture> pro prohlížeče bez WebP a og:image pro sdílení). */
const TRPASLICI_IKONY = [
  '1f6d7', '1faa3', '1f4cd', '1f514', '1f3af', '1f465',   // výtah, studna, místo zprávy, poplach, pracoviště, klan
  '1f198', '1f30b', '1f31f', '1f332', '1f338', '1f33e', '1f342', '1f344', '1f356', '1f372', '1f37a', '1f37d',
  '1f3a5', '1f3a8', '1f3b2', '1f3b5', '1f3c6', '1f3ee', '1f42b', '1f479', '1f47a', '1f480', '1f48d', '1f48e',
  '1f4a0', '1f4a4', '1f4a5', '1f4a7', '1f4be', '1f4c2', '1f4c5', '1f4dc', '1f4e6', '1f4ef', '1f50a', '1f50d',
  '1f512', '1f525', '1f526', '1f528', '1f529', '1f550', '1f56f', '1f577', '1f578', '1f590', '1f5dd', '1f5e1',
  '1f5fa', '1f5ff', '1f600', '1f610', '1f620', '1f641', '1f642', '1f6a7', '1f6a9', '1f6aa', '1f6cf', '1f6e1',
  '1f7e0', '1f7e1', '1f7e3', '1f7e5', '1f7e7', '1f7eb', '1f91d', '1f947', '1f948', '1f987', '1f9d4', '1f9ed',
  '1f9f0', '1f9f1', '1f9f9', '1fa79', '1fa91', '1fa93', '1fa9a', '1fa9c', '1faa4', '1faa6', '1faa8', '1fab5',
  '2328', '23f8', '25b6', '2600', '2605', '2639', '2668', '267e', '2692', '2694', '2699', '26a0', '26aa',
  '26ab', '26cf', '26f0', '26f2', '2702', '2705', '2714', '2716', '2728', '2734', '2744', '2753', '2764',
  '2b06', '2b07', '2b50',
  '23f3', '1f4cb', '1f4ad', '1f4ca', '1f3c1', '1f517', '2696', '24d8', '1f6a8', '1f393', '1f4d0', '274c', '26d4',   // revize 4: čas, seznam, nečinnost,
  '1f442', '1f441', '1f3ba', '1f451', '1f3db', '1f319',                                                            // bilance, konec, odkaz, váhy, info…
];
const TRPASLICI = [
  './obsah/trpaslici.html',
  './obsah/trpaslici/cesty.js',
  './obsah/trpaslici/grafika.js',
  './obsah/trpaslici/hora.js',
  './obsah/trpaslici/hra.js',
  './obsah/trpaslici/hrozby.js',
  './obsah/trpaslici/nahoda.js',
  './obsah/trpaslici/obdobi.js',
  './obsah/trpaslici/potreby.js',
  './obsah/trpaslici/prace.js',
  './obsah/trpaslici/pribeh.js',
  './obsah/trpaslici/priroda.js',
  './obsah/trpaslici/stavby.js',
  './obsah/trpaslici/svetlo.js',
  './obsah/trpaslici/udalosti.js',
  './obsah/trpaslici/ui-skin.css',
  './obsah/trpaslici/ui-skin.js',
  './obsah/trpaslici/ui.js',
  './obsah/trpaslici/ulozeni.js',
  './obsah/trpaslici/zvuk.js',
  './obsah/trpaslici/assets/event-klan.webp',
  './obsah/trpaslici/assets/event-navstevnik.webp',
  './obsah/trpaslici/assets/event-objev.webp',
  './obsah/trpaslici/assets/gui-iron.webp',
  './obsah/trpaslici/assets/gui-stone.webp',
  './obsah/trpaslici/assets/gui-wood.webp',
  './obsah/trpaslici/assets/karavana.webp',
  './obsah/trpaslici/assets/konec-porazka.webp',
  './obsah/trpaslici/assets/konec-vitezstvi.webp',
  './obsah/trpaslici/assets/srdce-hory-icon.png',
  './obsah/trpaslici/assets/srdce-hory-keyart.webp',
  './obsah/trpaslici/assets/ui-icons/home.svg',
  './obsah/trpaslici/assets/ui-icons/menu.svg',
  './obsah/trpaslici/assets/ui-icons/zoom-in.svg',
  './obsah/trpaslici/assets/ui-icons/zoom-out.svg',
  ...TRPASLICI_IKONY.map(n => `./obsah/trpaslici/assets/ui-icons/${n}.png`),
];

/* Síně pod horou (obsah/sine.html) – malá hra bez obrázků (vše kreslí kód), ~0,4 MB skriptů.
   Docachuje se celá na pozadí při prvním otevření, stejně jako Srdce hory.
   Že seznam sedí se soubory na disku, hlídá _test/sw_sine_check.js. */
const SINE = [
  './obsah/sine.html',
  './obsah/sine/castice.js',
  './obsah/sine/cesty.js',
  './obsah/sine/hra.js',
  './obsah/sine/hrozby.js',
  './obsah/sine/ilustrace.js',
  './obsah/sine/kresba.js',
  './obsah/sine/mistnosti.js',
  './obsah/sine/nahoda.js',
  './obsah/sine/obdobi.js',
  './obsah/sine/postavy.js',
  './obsah/sine/potreby.js',
  './obsah/sine/prace.js',
  './obsah/sine/pribeh.js',
  './obsah/sine/priroda.js',
  './obsah/sine/stavby.js',
  './obsah/sine/svet.js',
  './obsah/sine/svetlo.js',
  './obsah/sine/udalosti.js',
  './obsah/sine/ui.js',
  './obsah/sine/ulozeni.js',
  './obsah/sine/zvuk.js',
];


// Dotáhne do cache, co z dané sady ještě chybí (po jednom, chyby ignoruje – při
// příštím otevření se zkusí znovu). Běží jen jednou naráz pro každou sadu.
const dotahuje = new Map();
function dotahniSadu(nazev, seznam) {
  if (dotahuje.has(nazev)) return dotahuje.get(nazev);
  const p = caches.open(CACHE).then(async cache => {
    for (const u of seznam) {
      try {
        if (await cache.match(u)) continue;
        // no-cache: hned po nasazení by HTTP cache (GitHub Pages: max-age 600) mohla vrátit starý soubor
        const resp = await fetch(u, { cache: 'no-cache' });
        if (resp.ok) await cache.put(u, resp);
      } catch (_) { /* offline nebo chyba sítě – zkusí se příště */ }
    }
  }).finally(() => dotahuje.delete(nazev));
  dotahuje.set(nazev, p);
  return p;
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(JADRO.map(u => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
});

// stránka hry si o docachování řekne sama (postMessage po navigator.serviceWorker.ready): při prvním
// otevření hry přímo (ne přes rozcestník) se SW registruje až po načtení a navigaci na hru tedy neviděl
self.addEventListener('message', e => {
  if (e.data && e.data.typ === 'dotahni' && e.data.sada === 'trpaslici') e.waitUntil(dotahniSadu('trpaslici', TRPASLICI));
  if (e.data && e.data.typ === 'dotahni' && e.data.sada === 'sine') e.waitUntil(dotahniSadu('sine', SINE));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // Mazat jen VLASTNÍ staré cache. Na stejném originu běží i service worker
      // stránky Předpověď počasí (forecast-*); bez filtru na prefix by si weby
      // navzájem mazaly offline cache při každé aktualizaci. (Výukový web má
      // dnes vlastní origin, jeho cache metodus-* se odsud nedají ani vidět.)
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

  // otevření Srdce hory → na pozadí docachovat celou hru (obrázky, ikony, skripty)
  if (url.pathname.endsWith('/obsah/trpaslici.html')) e.waitUntil(dotahniSadu('trpaslici', TRPASLICI));
  if (url.pathname.endsWith('/obsah/sine.html')) e.waitUntil(dotahniSadu('sine', SINE));

  // navigace s dotazem (trpaslici.html?seed=…&velikost=…) je pořád táž stránka: hledat bez dotazu a ukládat bez něj
  const navigace = e.request.mode === 'navigate';
  const klic = navigace ? url.origin + url.pathname : e.request;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(klic, { ignoreSearch: navigace });
      const zeSite = fetch(e.request)
        .then(resp => {
          if (resp.ok) cache.put(klic, resp.clone());
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
