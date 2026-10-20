/* Service worker rozcestníku.
   Jádro (index, katalog, styly) se předcachuje; jednotlivé aplikace
   se cachují průběžně při prvním otevření (stale-while-revalidate),
   takže jednou navštívená aplikace funguje i offline. */
/* Při větší aktualizaci webu zvyš číslo verze — stará cache se u návštěvníků
   smaže a vše se stáhne čerstvé (jinak SWR ukáže novou verzi až na druhé načtení). */
const PREFIX = 'webapp-';
const CACHE = PREFIX + 'v439';
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
  './obsah/nastaveni.html',
  './obsah/nastaveni_klice.js',
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


/* Ostrov v obležení (obsah/obleheni.html) – tower defense bez obrázků (vše kreslí kód).
   Že seznam sedí se soubory na disku, hlídá _test/sw_obleheni_check.js. */
const OBLEHENI = [
  './obsah/obleheni.html',
  './obsah/obleheni/data.js',
  './obsah/obleheni/grafika.js',
  './obsah/obleheni/kampan.js',
  './obsah/obleheni/nahoda.js',
  './obsah/obleheni/ostrov.js',
  './obsah/obleheni/sim.js',
  './obsah/obleheni/toky.js',
  './obsah/obleheni/ui.js',
  './obsah/obleheni/zvuk.js',
];

/* Modelář 3D (obsah/modelar.html) – CAD pro 3D tisk, ~1,5 MB skriptů + jádro manifold (WASM 0,7 MB).
   Docachuje se celý při prvním otevření, takže pak funguje offline. Přesné jádro OpenCascade
   (lib/occt, 22 MB) v sadě úmyslně není – stáhne a uloží se samo (SWR), až ho uživatel poprvé použije.
   Úmyslně chybí i manifold.js (ES modul jen pro node testy) a *.wasm.js / *.gz.js (base64 pro file://).
   Že seznam sedí se soubory na disku, hlídá _test/sw_modelar_check.js. */
const MODELAR = [
  './obsah/modelar-licence.html',
  './obsah/modelar.html',
  './obsah/tinkercad.html',
  './obsah/fonty/LiberationSans-Bold.ttf',
  // písma štítku a textu (offline i bez předchozího použití, ~1 MB)
  './obsah/fonty/BebasNeue-Regular.ttf',
  './obsah/fonty/Anton-Regular.ttf',
  './obsah/fonty/ArchivoBlack-Regular.ttf',
  './obsah/fonty/RussoOne-Regular.ttf',
  './obsah/fonty/AlfaSlabOne-Regular.ttf',
  './obsah/fonty/Bungee-Regular.ttf',
  './obsah/fonty/TitanOne-Regular.ttf',
  './obsah/fonty/Righteous-Regular.ttf',
  './obsah/fonty/LuckiestGuy-Regular.ttf',
  './obsah/fonty/SairaStencilOne-Regular.ttf',
  './obsah/fonty/BlackOpsOne-Regular.ttf',
  './obsah/fonty/fonty.js',
  './obsah/lib/clipper.min.js',
  './obsah/lib/jspdf.umd.min.js',
  './obsah/lib/opentype.min.js',
  './obsah/lib/three.0.160.0.min.js',
  './obsah/modelar/deska.js',
  './obsah/modelar/kamera.js',
  './obsah/modelar/kostka.js',
  './obsah/modelar/scena.js',
  './obsah/modelar/spolecne.js',
  './obsah/modelar/stav.js',
  './obsah/modelar/telesa.js',
  './obsah/modelar/uchyty.js',
  './obsah/modelar/ui.js',
  './obsah/modelar/ulozeni.js',
  './obsah/modelar/vyber.js',
  './obsah/modelar/vypocty.js',
  './obsah/modelar/worker.js',
  './obsah/modelar/worker_occt.js',
  './obsah/lib/manifold/manifold.klasicky.js',
  './obsah/lib/manifold/manifold.wasm',
  './obsah/modelar/jadro/booleany.js',
  './obsah/modelar/jadro/dilna.js',
  './obsah/modelar/jadro/dily.js',
  './obsah/modelar/jadro/historie.js',
  './obsah/modelar/jadro/model.js',
  './obsah/modelar/jadro/promenne.js',
  './obsah/modelar/jadro/sestava.js',
  './obsah/modelar/jadro/textNaPlose.js',
  './obsah/modelar/jadro/zjednoduseni.js',
  './obsah/modelar/jadro/occt.js',
  './obsah/modelar/jadro/sit.js',
  './obsah/modelar/jadro/skica.js',
  './obsah/modelar/jadro/vazby.js',
  './obsah/modelar/jadro/tazeni.js',
  './obsah/modelar/jadro/transformace.js',
  './obsah/modelar/jadro/tvary.js',
  './obsah/modelar/jadro/upravy.js',
  './obsah/modelar/jadro/struktura.js',
  './obsah/modelar/jadro/sablony.js',
  './obsah/modelar/jadro/vykres.js',
  './obsah/modelar/ui/dilna.js',
  './obsah/modelar/ui/dily.js',
  './obsah/modelar/ui/inspektor.js',
  './obsah/modelar/ui/knihovna.js',
  './obsah/modelar/ui/napoveda.js',
  './obsah/modelar/ui/occt.js',
  './obsah/modelar/ui/prikazy.js',
  './obsah/modelar/ui/projekty.js',
  './obsah/modelar/ui/seznam.js',
  './obsah/modelar/ui/skica.js',
  './obsah/modelar/ui/soubory.js',
  './obsah/modelar/ui/upravy.js',
  './obsah/modelar/ui/struktura.js',
  './obsah/modelar/ui/reliefy.js',
  './obsah/povrch3d/vzory.js',
  './obsah/povrch3d/jadro.js',
  './obsah/modelar/ui/zarovnani.js',
  './obsah/modelar/ui/zrcadleni.js',
  './obsah/modelar/ui/pivot.js',
  './obsah/modelar/jadro/tisk.js',
  './obsah/modelar/ui/tisk.js',
  './obsah/modelar/ui/koty.js',
  './obsah/modelar/ui/promenne.js',
  './obsah/modelar/ui/sestava.js',
  './obsah/modelar/ui/zjednoduseni.js',
  './obsah/modelar/ui/obrazek.js',
  './obsah/modelar/ui/tazeni.js',
  './obsah/modelar/ui/rychleKoty.js',
  './obsah/modelar/ui/magnet.js',
  './obsah/modelar/assets/icons-cad/ui/magnet.webp',
  './obsah/modelar/ui/ikony.js',
  './obsah/modelar/assets/icons-cad/ui/add-shape.webp',
  './obsah/modelar/assets/icons-cad/ui/align-x-center.webp',
  './obsah/modelar/assets/icons-cad/ui/align-x-max.webp',
  './obsah/modelar/assets/icons-cad/ui/align-x-min.webp',
  './obsah/modelar/assets/icons-cad/ui/align-y-center.webp',
  './obsah/modelar/assets/icons-cad/ui/align-y-max.webp',
  './obsah/modelar/assets/icons-cad/ui/align-y-min.webp',
  './obsah/modelar/assets/icons-cad/ui/align-z-center.webp',
  './obsah/modelar/assets/icons-cad/ui/align-z-max.webp',
  './obsah/modelar/assets/icons-cad/ui/align-z-min.webp',
  './obsah/modelar/assets/icons-cad/ui/align.webp',
  './obsah/modelar/assets/icons-cad/ui/arrange-on-bed.webp',
  './obsah/modelar/assets/icons-cad/ui/array.webp',
  './obsah/modelar/assets/icons-cad/ui/assembly.webp',
  './obsah/modelar/assets/icons-cad/ui/best-orientation.webp',
  './obsah/modelar/assets/icons-cad/ui/chamfer.webp',
  './obsah/modelar/assets/icons-cad/ui/clearance-check.webp',
  './obsah/modelar/assets/icons-cad/ui/clearance.webp',
  './obsah/modelar/assets/icons-cad/ui/command-palette.webp',
  './obsah/modelar/assets/icons-cad/ui/dimensions.webp',
  './obsah/modelar/assets/icons-cad/ui/duplicate.webp',
  './obsah/modelar/assets/icons-cad/ui/export-library.webp',
  './obsah/modelar/assets/icons-cad/ui/export.webp',
  './obsah/modelar/assets/icons-cad/ui/fillet.webp',
  './obsah/modelar/assets/icons-cad/ui/focus-selection.webp',
  './obsah/modelar/assets/icons-cad/ui/group.webp',
  './obsah/modelar/assets/icons-cad/ui/help.webp',
  './obsah/modelar/assets/icons-cad/ui/history.webp',
  './obsah/modelar/assets/icons-cad/ui/hole-pattern.webp',
  './obsah/modelar/assets/icons-cad/ui/home-view.webp',
  './obsah/modelar/assets/icons-cad/ui/import-library.webp',
  './obsah/modelar/assets/icons-cad/ui/import-svg.webp',
  './obsah/modelar/assets/icons-cad/ui/measure.webp',
  './obsah/modelar/assets/icons-cad/ui/mirror-x.webp',
  './obsah/modelar/assets/icons-cad/ui/mirror-y.webp',
  './obsah/modelar/assets/icons-cad/ui/mirror-z.webp',
  './obsah/modelar/assets/icons-cad/ui/mirror.webp',
  './obsah/modelar/assets/icons-cad/ui/my-projects.webp',
  './obsah/modelar/assets/icons-cad/ui/new-project.webp',
  './obsah/modelar/assets/icons-cad/ui/new-sketch.webp',
  './obsah/modelar/assets/icons-cad/ui/new-template.webp',
  './obsah/modelar/assets/icons-cad/ui/note.webp',
  './obsah/modelar/assets/icons-cad/ui/offset.webp',
  './obsah/modelar/assets/icons-cad/ui/open-file.webp',
  './obsah/modelar/assets/icons-cad/ui/orbit-view.webp',
  './obsah/modelar/assets/icons-cad/ui/overhangs.webp',
  './obsah/modelar/assets/icons-cad/ui/pivot.webp',
  './obsah/modelar/assets/icons-cad/ui/place-on-bed.webp',
  './obsah/modelar/assets/icons-cad/ui/pocket.webp',
  './obsah/modelar/assets/icons-cad/ui/print-calibration.webp',
  './obsah/modelar/assets/icons-cad/ui/print-check.webp',
  './obsah/modelar/assets/icons-cad/ui/project.webp',
  './obsah/modelar/assets/icons-cad/ui/projection.webp',
  './obsah/modelar/assets/icons-cad/ui/puzzle-assembly.webp',
  './obsah/modelar/assets/icons-cad/ui/redo.webp',
  './obsah/modelar/assets/icons-cad/ui/relief.webp',
  './obsah/modelar/assets/icons-cad/ui/rotate-pivot.webp',
  './obsah/modelar/assets/icons-cad/ui/save-custom-shape.webp',
  './obsah/modelar/assets/icons-cad/ui/save-file.webp',
  './obsah/modelar/assets/icons-cad/ui/save-image.webp',
  './obsah/modelar/assets/icons-cad/ui/section-view.webp',
  './obsah/modelar/assets/icons-cad/ui/shell.webp',
  './obsah/modelar/assets/icons-cad/ui/sketch-on-face.webp',
  './obsah/modelar/assets/icons-cad/ui/split-plane.webp',
  './obsah/modelar/assets/icons-cad/ui/surface-texture.webp',
  './obsah/modelar/assets/icons-cad/ui/sweep.webp',
  './obsah/modelar/assets/icons-cad/ui/technical-drawing.webp',
  './obsah/modelar/assets/icons-cad/ui/text-around.webp',
  './obsah/modelar/assets/icons-cad/ui/thread.webp',
  './obsah/modelar/assets/icons-cad/ui/toggle-notes.webp',
  './obsah/modelar/assets/icons-cad/ui/tools.webp',
  './obsah/modelar/assets/icons-cad/ui/undo.webp',
  './obsah/modelar/assets/icons-cad/ui/ungroup.webp',
  './obsah/modelar/assets/icons-cad/ui/variables.webp',
  './obsah/modelar/assets/icons-cad/ui/view-back.webp',
  './obsah/modelar/assets/icons-cad/ui/view-bottom.webp',
  './obsah/modelar/assets/icons-cad/ui/view-front.webp',
  './obsah/modelar/assets/icons-cad/ui/view-left.webp',
  './obsah/modelar/assets/icons-cad/ui/view-right.webp',
  './obsah/modelar/assets/icons-cad/ui/view-top.webp',
  './obsah/modelar/assets/icons-cad/ui/workplane.webp',
  './obsah/modelar/assets/icons-cad/ui/workshop.webp',
  './obsah/modelar/assets/icons-cad/ui/workspace-theme.webp',
  './obsah/modelar/assets/icons-cad/ui/wrap-svg.webp',
  './obsah/modelar/jadro/soubory/export.js',
  './obsah/modelar/jadro/soubory/obj.js',
  './obsah/modelar/jadro/soubory/projekt.js',
  './obsah/modelar/jadro/soubory/stl.js',
  './obsah/modelar/jadro/soubory/svg.js',
  './obsah/modelar/jadro/soubory/trojmf.js',
  './obsah/modelar/jadro/soubory/zip.js',
];

/* Deník jídla (obsah/potraviny.html) – databáze potravin (~8 MB nekomprimovaně) a čtečka
   čárových kódů (wasm) se stahují až za běhu; aby deník fungoval offline i při prvním
   skenování bez sítě, dotáhne se celá sada na pozadí při prvním otevření stránky. */
const POTRAVINY = [
  './obsah/potraviny.html',
  './obsah/potraviny/start.js',
  './obsah/potraviny/jadro.js',
  './obsah/potraviny/aplikace.js',
  './obsah/potraviny/grafy.js',
  './obsah/potraviny/ctecka.js',
  './obsah/potraviny/prenos.js',
  './obsah/potraviny/etiketa.js',
  './obsah/lib/qrcode/qrcode.js',
  './obsah/potraviny/manifest.webmanifest',
  './obsah/potraviny/ikona-192.png',
  './obsah/potraviny/ikona-512.png',
  './obsah/potraviny/ikona-maskovatelna-512.png',
  './obsah/potraviny/ikona-apple-180.png',
  './obsah/potraviny/data/vyrobky.json',
  './obsah/potraviny/data/suroviny.json',
  './obsah/potraviny/data/ciselniky.json',
  './obsah/potraviny/data/doplnky.json',
  './obsah/potraviny/data/pohyby.json',
  './obsah/potraviny/data/slozeni.json',
  './obsah/lib/zxing/zxing-reader.js',
  './obsah/lib/zxing/zxing_reader.wasm',
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
  if (e.data && e.data.typ === 'dotahni' && e.data.sada === 'obleheni') e.waitUntil(dotahniSadu('obleheni', OBLEHENI));
  if (e.data && e.data.typ === 'dotahni' && e.data.sada === 'modelar') e.waitUntil(dotahniSadu('modelar', MODELAR));
  if (e.data && e.data.typ === 'dotahni' && e.data.sada === 'potraviny') e.waitUntil(dotahniSadu('potraviny', POTRAVINY));
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
  if (url.pathname.endsWith('/obsah/obleheni.html')) e.waitUntil(dotahniSadu('obleheni', OBLEHENI));
  if (url.pathname.endsWith('/obsah/modelar.html')) e.waitUntil(dotahniSadu('modelar', MODELAR));
  if (url.pathname.endsWith('/obsah/potraviny.html')) e.waitUntil(dotahniSadu('potraviny', POTRAVINY));

  // společné doplňky Deníku jídla: nejdřív ze sítě (po nahrání je uvidí všichni hned, bez zvyšování verze cache)
  if (url.pathname.endsWith('/obsah/potraviny/data/doplnky.json')) {
    e.respondWith(caches.open(CACHE).then(cache => fetch(e.request)
      .then(resp => { if (resp.ok) cache.put(e.request.url, resp.clone()); return resp; })
      .catch(() => cache.match(e.request.url).then(c => c || new Response('{"format":"denik-doplnky","verze":1,"polozky":[]}', { headers: { 'Content-Type': 'application/json' } })))));
    return;
  }

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
