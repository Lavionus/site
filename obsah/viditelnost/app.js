/* viditelnost/app.js – rozhraní stránky Viditelnost z bodu (mapa, načítání terénu, překryv, panorama, čára pohledu). */
(function () {
  'use strict';
  const J = window.VIDITELNOST;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fm = J.cislo, km = J.delkaText;
  if (window.self === window.top) document.body.classList.add('samostatne');

  /* ---------- nastavení ---------- */
  const KLIC = 'webapp_viditelnost_nastaveni';
  const VYCHOZI = { vyskaOka: 1.7, dosah: 30, vyskaCile: 0, rezimPrekryvu: 'vid', pruhlednost: 55, podklad: 'topo', vrcholy: true, kruh: true,
    zdroj: 'terrarium', detail: 4000000, k: J.K_REFR, zakriveni: true, hB: 1.7, panMeritko: 8, panPrevyseni: 'auto', smer: 0, vyskaPanelu: 0, panCela: false, panSkryte: false,
    karta: 'vysledek', panel: true, lat: 49.8, lon: 15.5, z: 7, A: null, B: null,
    // profi rozšíření 17. 11. 2026 (staré uložené nastavení je doplní výchozími)
    obraceny: false, vyskaObjektu: 150, vyskaPozor: 1.7, stanoviste: [], radio: false, fMHz: 433, slunce: true, mesic: true, datum: '' };
  let N = Object.assign({}, VYCHOZI);
  try { Object.assign(N, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* poškozené nastavení */ }
  const ulozN = () => { try { localStorage.setItem(KLIC, JSON.stringify(N)); } catch (e) { /* plné úložiště */ } };
  if (!Array.isArray(N.stanoviste)) N.stanoviste = [];
  /** Úloha „odkud je vidět objekt“: počítá se z objektu (jeho výška) na pozorovatele (výška oka) – viditelnost je vzájemná. */
  const hOka = () => N.obraceny ? N.vyskaObjektu : N.vyskaOka;
  const tCile = () => N.obraceny ? N.vyskaPozor : N.vyskaCile;
  const setHOka = x => { if (N.obraceny) N.vyskaObjektu = x; else N.vyskaOka = x; };
  const setTCile = x => { if (N.obraceny) N.vyskaPozor = x; else N.vyskaCile = x; };

  /* ---------- Zpět / Znovu (pozorovatel, bod B, stanoviště, výšky) ---------- */
  const snimek = () => JSON.stringify({ A: N.A, B: N.B, stanoviste: N.stanoviste, vyskaOka: N.vyskaOka, vyskaObjektu: N.vyskaObjektu, hB: N.hB });
  const HIST = { zpet: [], znovu: [] };
  function zaznamenej() {
    const s = snimek();
    if (HIST.zpet[HIST.zpet.length - 1] !== s) HIST.zpet.push(s);
    if (HIST.zpet.length > 100) HIST.zpet.shift();
    HIST.znovu = [];
  }

  const S = { A: null, B: null, rezim: 'a', dem: null, demLos: null, vs: null, pan: null, stat: null, vrcholy: [], vrcholyOh: [],
    vrcholyKlic: '', los: null, nacitani: null, poradi: 0, demId: 0, overlayUrl: null };

  /* ---------- mapa ---------- */
  const OSM_ATR = '© přispěvatelé <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  // tile.openstreetmap.org webové aplikace blokuje (usage policy) – podklady jako ve Výletním deníku + záložní
  const PODKLADY = {
    topo: { nazev: 'Turistická (OpenTopoMap)', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', max: 17, atr: OSM_ATR + ', SRTM | styl © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC BY-SA)', zaloha: 'osmde' },
    osmde: { nazev: 'Základní (OSM Německo)', url: 'https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', max: 18, atr: OSM_ATR + ', dlaždice openstreetmap.de', zaloha: 'hot' },
    hot: { nazev: 'Základní (OSM France HOT)', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', max: 19, atr: OSM_ATR + ', styl HOT, hosting OSM France', zaloha: 'esritopo' },
    esritopo: { nazev: 'Topografická (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', max: 19, atr: 'Podklad © Esri a dodavatelé (World Topo Map)', zaloha: 'osmde' },
    satelit: { nazev: 'Letecké snímky (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', max: 19, atr: 'Snímky © Esri, Maxar, Earthstar Geographics', zaloha: 'esritopo' }
  };
  const ATRIB = {
    terrarium: 'Výšky: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a> – EU-DEM © Copernicus, SRTM © USGS a <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">další</a>',
    dmr5g: 'Výšky: <a href="https://geoportal.cuzk.cz/" target="_blank" rel="noopener">© ČÚZK</a> DMR 5G (CC BY 4.0)',
    dmp1g: 'Výšky: <a href="https://geoportal.cuzk.cz/" target="_blank" rel="noopener">© ČÚZK</a> DMP 1G (CC BY 4.0)'
  };
  const ATR_OSM_VRCHOLY = 'Vrcholy: ' + OSM_ATR + ' (ODbL) přes Overpass API';
  const mapa = L.map('mapa', { zoomControl: true }).setView([N.lat, N.lon], N.z);
  L.control.scale({ imperial: false }).addTo(mapa);
  let podkladVrstva = null;
  function nastavPodklad() {
    if (podkladVrstva) mapa.removeLayer(podkladVrstva);
    const p = PODKLADY[N.podklad] || PODKLADY.topo;
    const v = podkladVrstva = L.tileLayer(p.url, { maxZoom: 19, maxNativeZoom: p.max, attribution: p.atr, crossOrigin: 'anonymous', subdomains: 'abc' }).addTo(mapa);
    v.bringToBack();
    // ≥ 6 chyb bez jediné načtené dlaždice → záložní podklad
    let chyb = 0, ok = 0;
    v.on('tileload', () => { ok++; });
    v.on('tileerror', () => {
      if (++chyb < 6 || ok || v !== podkladVrstva || !p.zaloha) return;
      N.podklad = p.zaloha; ulozN(); $('podklad').value = N.podklad; nastavPodklad();
      stav(`Podklad „${p.nazev}“ se nenačítá – přepnuto na „${PODKLADY[N.podklad].nazev}“.`, true);
    });
  }
  if (!PODKLADY[N.podklad]) N.podklad = 'topo';
  $('podklad').innerHTML = Object.entries(PODKLADY).map(([k, p]) => `<option value="${k}">${esc(p.nazev)}</option>`).join('');
  nastavPodklad();
  mapa.on('moveend', () => { const c = mapa.getCenter(); N.lat = +c.lat.toFixed(5); N.lon = +c.lng.toFixed(5); N.z = mapa.getZoom(); ulozN(); });

  const ikona = (znak, tr) => L.divIcon({ className: '', html: `<div style="font-size:24px;line-height:1;transform:translate(-50%,-90%);filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))" class="${tr}">${znak}</div>`, iconSize: [0, 0] });
  const mkA = L.marker([0, 0], { icon: ikona('📍', 'mkA'), draggable: true, keyboard: false, title: 'Pozorovatel A' });
  const mkB = L.marker([0, 0], { icon: ikona('🎯', 'mkB'), draggable: true, keyboard: false, title: 'Bod B' });
  const kruh = L.circle([0, 0], { radius: 1, color: '#2563eb', weight: 1.5, dashArray: '6 6', fill: false, interactive: false });
  const caraAB = L.polyline([], { weight: 3, interactive: false });
  const mkPrekazka = L.circleMarker([0, 0], { radius: 6, color: '#dc2626', weight: 2, fillColor: '#fff', fillOpacity: 1 });
  const mkNejdal = L.circleMarker([0, 0], { radius: 5, color: '#16a34a', weight: 2, fillColor: '#fff', fillOpacity: 1 });
  const mkPan = L.circleMarker([0, 0], { radius: 7, color: '#7c3aed', weight: 3, fill: false });
  const vrstvaVrcholu = L.layerGroup().addTo(mapa);
  // výřez panoramatu na mapě (kam se díváme) a čára k místu pod myší v panoramatu
  const vyrez = L.polygon([], { color: '#7c3aed', weight: 1.5, fillColor: '#a78bfa', fillOpacity: 0.16, interactive: false });
  const osaVyrezu = L.polyline([], { color: '#7c3aed', weight: 2, dashArray: '6 5', interactive: false });
  const caraMysi = L.polyline([], { color: '#f59e0b', weight: 2.5, interactive: false });
  const mkSmer = L.marker([0, 0], { interactive: false, keyboard: false, zIndexOffset: -100, icon: L.divIcon({ className: '', iconSize: [0, 0],
    html: '<svg width="56" height="56" viewBox="-28 -28 56 56" style="position:absolute;left:-28px;top:-28px;overflow:visible;pointer-events:none"><g><path d="M0,-27 L8,-11 L0,-15 L-8,-11Z" fill="#7c3aed" stroke="#fff" stroke-width="1.5"/></g></svg>' }) });
  const bodMysi = L.circleMarker([0, 0], { radius: 5, color: '#f59e0b', weight: 2, fillColor: '#fff', fillOpacity: 1, interactive: false });
  let overlay = null;
  mkA.on('dragstart', zaznamenej); mkB.on('dragstart', zaznamenej);
  mkA.on('dragend', () => { const p = mkA.getLatLng(); nastavA(p.lat, p.lng); });
  mkB.on('dragend', () => { const p = mkB.getLatLng(); nastavB(p.lat, p.lng); });
  mapa.on('click', e => {
    const { lat, lng } = e.latlng;
    zaznamenej();
    if (S.rezim === 's') pridejStanoviste(lat, lng);
    else if (S.rezim === 'b' && S.A) nastavB(lat, lng); else nastavA(lat, lng);
  });

  /* ---------- stav a průběh ---------- */
  let casStavu = 0;
  function stav(text, chyba) {
    clearTimeout(casStavu);
    const el = $('stav');
    el.hidden = !text; el.textContent = text || ''; el.classList.toggle('chyba', !!chyba);
    if (chyba) casStavu = setTimeout(() => { el.hidden = true; }, 9000);
  }
  const prubeh = f => { $('prubeh').style.width = f ? Math.round(f * 100) + '%' : '0'; };

  /* ---------- načtení terénu ---------- */
  const CUZK_URL = { dmr5g: 'https://ags.cuzk.cz/arcgis2/rest/services/dmr5g/ImageServer/exportImage', dmp1g: 'https://ags.cuzk.cz/arcgis2/rest/services/dmp1g/ImageServer/exportImage' };
  const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
  const CUZK_BLOK = 2048, MAX_ZOOM = 13;
  /** Velikost buňky (m Mercatoru), se kterou by se oblast načetla. */
  function planBunky(o, zdroj, maxBunek) {
    if (zdroj === 'terrarium') return J.OBVOD / (256 * 2 ** J.volbaZoomu(o.xmin, o.ymin, o.xmax, o.ymax, maxBunek, MAX_ZOOM));
    const c = Math.cos(J.mercNaLat((o.ymin + o.ymax) / 2) * Math.PI / 180);
    return Math.max(2, Math.sqrt((o.xmax - o.xmin) * (o.ymax - o.ymin) * c * c / maxBunek)) / c;
  }
  const pokryva = (m, o) => o.xmin >= m.x0 && o.xmax <= m.x0 + m.sirka * m.d && o.ymax <= m.y0 && o.ymin >= m.y0 - m.vyska * m.d;
  const vhodny = (dem, o, maxBunek) => dem && dem.zdroj === N.zdroj && pokryva(dem.m, o) && dem.m.d <= planBunky(o, N.zdroj, maxBunek) * 1.01;

  async function dekodujPng(blob) {
    const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
    return cx.getImageData(0, 0, cv.width, cv.height).data;
  }
  async function nactiTerrarium(o, maxBunek, signal) {
    const z = J.volbaZoomu(o.xmin, o.ymin, o.xmax, o.ymax, maxBunek, MAX_ZOOM);
    const p = J.pixelyProObdelnik(z, o.xmin, o.ymin, o.xmax, o.ymax), m = J.mrizkaZPixelu(z, p), n = 2 ** z;
    const fronta = [];
    for (let ty = p.ty0; ty <= p.ty1; ty++) for (let tx = p.tx0; tx <= p.tx1; tx++) if (ty >= 0 && ty < n) fronta.push([tx, ty]);
    const celkem = fronta.length; let hotovo = 0, chyb = 0;
    async function pracovnik() {
      while (fronta.length) {
        const [tx, ty] = fronta.shift(), x = ((tx % n) + n) % n;
        try {
          const odp = await fetch(`${TERRARIUM_URL}${z}/${x}/${ty}.png`, { signal });
          if (!odp.ok) throw new Error('HTTP ' + odp.status);
          const d = await dekodujPng(await odp.blob());
          for (let py = 0; py < 256; py++) {
            const gy = ty * 256 + py - p.py0; if (gy < 0 || gy >= m.vyska) continue;
            for (let px = 0; px < 256; px++) {
              const gx = tx * 256 + px - p.px0; if (gx < 0 || gx >= m.sirka) continue;
              const k = (py * 256 + px) * 4;
              m.vysky[gy * m.sirka + gx] = J.terrariumVyska(d[k], d[k + 1], d[k + 2]);
            }
          }
        } catch (e) { if (e.name === 'AbortError') throw e; chyb++; }
        hotovo++; prubeh(hotovo / celkem);
        stav(`Stahuji výškový model Terrain Tiles (zoom ${z}): ${hotovo}/${celkem} dlaždic…`);
      }
    }
    await Promise.all(Array.from({ length: Math.min(6, celkem) }, pracovnik));
    if (chyb === celkem) throw new Error('Dlaždice výškového modelu (Terrain Tiles, AWS) se nepodařilo stáhnout. Zkontrolujte připojení k internetu.');
    return { m, zdroj: 'terrarium', popis: `Terrain Tiles, zoom ${z}`, chyb };
  }
  async function nactiCuzk(o, maxBunek, signal) {
    const d = planBunky(o, N.zdroj, maxBunek);
    const W = Math.max(2, Math.ceil((o.xmax - o.xmin) / d)), H = Math.max(2, Math.ceil((o.ymax - o.ymin) / d));
    const m = J.vytvorMrizku(W, H, o.xmin, o.ymax, d), nazev = N.zdroj === 'dmp1g' ? 'DMP 1G' : 'DMR 5G';
    const bloky = [];
    for (let j = 0; j < H; j += CUZK_BLOK) for (let i = 0; i < W; i += CUZK_BLOK) bloky.push([i, j, Math.min(W, i + CUZK_BLOK), Math.min(H, j + CUZK_BLOK)]);
    let hotovo = 0;
    for (const [i0, j0, i1, j1] of bloky) {
      const bx0 = m.x0 + i0 * d, bx1 = m.x0 + i1 * d, by1 = m.y0 - j0 * d, by0 = m.y0 - j1 * d;
      const url = `${CUZK_URL[N.zdroj]}?bbox=${bx0.toFixed(3)},${by0.toFixed(3)},${bx1.toFixed(3)},${by1.toFixed(3)}&bboxSR=3857&imageSR=3857&size=${i1 - i0},${j1 - j0}` +
        '&format=tiff&compression=None&pixelType=F32&noData=-9999&noDataInterpretation=esriNoDataMatchAny&interpolation=RSP_BilinearInterpolation&f=image';
      stav(`Stahuji ${nazev} z ČÚZK (${hotovo + 1}/${bloky.length})…`);
      let odp;
      try { odp = await fetch(url, { signal }); } catch (e) { if (e.name === 'AbortError') throw e; throw new Error('Server ČÚZK neodpovídá (' + e.message + '). Zkuste to později, nebo zvolte Terrain Tiles.'); }
      if (!odp.ok) throw new Error('Server ČÚZK vrátil chybu ' + odp.status + '. Zkuste to později, nebo zvolte Terrain Tiles.');
      const buf = new Uint8Array(await odp.arrayBuffer());
      if (!(buf[0] === 0x49 && buf[1] === 0x49) && !(buf[0] === 0x4d && buf[1] === 0x4d)) {
        let zprava = ''; try { zprava = JSON.parse(new TextDecoder().decode(buf)).error.message; } catch (e) { /* není JSON */ }
        throw new Error('ČÚZK nevrátil výškový rastr' + (zprava ? ': ' + zprava : '.'));
      }
      const r = J.ctiTiffF32(buf);
      if (r.sirka !== i1 - i0 || r.vyska !== j1 - j0) throw new Error('ČÚZK vrátil rastr jiné velikosti, než byl vyžádán.');
      for (let y = 0; y < r.vyska; y++) m.vysky.set(r.data.subarray(y * r.sirka, (y + 1) * r.sirka), (j0 + y) * W + i0);
      hotovo++; prubeh(hotovo / bloky.length);
    }
    let plat = 0; for (let i = 0; i < m.vysky.length; i++) if (m.vysky[i] === m.vysky[i]) plat++;
    if (!plat) throw new Error(`Oblast leží mimo pokrytí ČÚZK ${nazev} (data jsou jen pro Česko). Zvolte Terrain Tiles.`);
    return { m, zdroj: N.zdroj, popis: `ČÚZK ${nazev}`, bezDat: 1 - plat / m.vysky.length };
  }
  async function nactiDem(o, maxBunek, signal) {
    prubeh(0.02);
    try { return N.zdroj === 'terrarium' ? await nactiTerrarium(o, maxBunek, signal) : await nactiCuzk(o, maxBunek, signal); }
    finally { prubeh(0); }
  }
  function ukazAtribuci() {
    Object.values(ATRIB).forEach(a => mapa.attributionControl.removeAttribution(a));
    mapa.attributionControl.addAttribution(ATRIB[N.zdroj]);
  }

  /* ---------- worker ---------- */
  let worker = null;
  const cekajici = new Map(); let idZpravy = 0;
  function zWorkeru(zprava, prenos) {
    if (!worker) {
      worker = new Worker('viditelnost/worker.js');
      worker.onmessage = e => { if (e.data.typ === 'prubeh') { prubeh(e.data.f); return; } const c = cekajici.get(e.data.id); if (!c) return; cekajici.delete(e.data.id); e.data.typ === 'chyba' ? c.chyba(new Error(e.data.zprava)) : c.ok(e.data); };
      worker.onerror = e => { cekajici.forEach(c => c.chyba(new Error('Výpočet selhal: ' + (e.message || 'chyba workeru')))); cekajici.clear(); worker = null; S.demId = 0; };
    }
    const id = ++idZpravy;
    return new Promise((ok, chyba) => { cekajici.set(id, { ok, chyba }); worker.postMessage(Object.assign({ id }, zprava), prenos || []); });
  }

  /* ---------- pozorovatel a výpočet ---------- */
  function nastavA(lat, lon, bezVypoctu) {
    S.A = { lat, lon }; N.A = [+lat.toFixed(6), +lon.toFixed(6)]; ulozN();
    mkA.setLatLng([lat, lon]).addTo(mapa);
    bodKliku = null; mkPan.remove();
    vyrezNaMape(); doMinimapy();
    if (!bezVypoctu) spocitej();
  }
  const kParam = () => N.zakriveni ? N.k : 1; // k = 1 → nulový pokles (bez zakřivení)
  let casPlanu = 0;
  const planuj = (ms) => { clearTimeout(casPlanu); casPlanu = setTimeout(spocitej, ms === undefined ? 500 : ms); };

  async function spocitej() {
    if (!S.A) { stav('Nejdřív klikněte do mapy na místo pozorovatele.', true); return; }
    if (S.nacitani) S.nacitani.abort();
    const ac = new AbortController(); S.nacitani = ac;
    const poradi = ++S.poradi, dosah = N.dosah * 1000;
    const o = J.oblastKolem(S.A.lat, S.A.lon, dosah);
    $('btnSpocitat').disabled = true;
    try {
      if (!vhodny(S.dem, o, N.detail)) {
        const dem = await nactiDem(o, N.detail, ac.signal);
        if (poradi !== S.poradi) return;
        S.dem = dem; S.demId = 0; ukazAtribuci();
      }
      if (S.demId !== S.dem) { stav('Předávám terén výpočtu…'); await zWorkeru({ typ: 'dem', m: S.dem.m }); S.demId = S.dem; }
      if (poradi !== S.poradi) return;
      const m = S.dem.m, b = J.bodNaBunku(m, S.A.lat, S.A.lon);
      stav('Počítám viditelnost a panorama…');
      const p = { x: b.x, y: b.y, vyskaOka: hOka(), dosah, k: N.k, zakriveni: N.zakriveni };
      const r = await zWorkeru({ typ: 'vypocet', p });
      if (poradi !== S.poradi) return;
      S.vs = r.vs; S.pan = r.pan; S.msVypoctu = r.ms; S.vsParam = p;
      stav('');
      kresliPrekryv(); obnovStatistiku(); kresliPanoramu();
      if (N.vrcholy) nactiVrcholy(); else { S.vrcholyOh = []; kresliVrcholy(); }
      if (S.B) spocitejLos();
      ulozHash();
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (poradi === S.poradi) stav(e.message, true);
    } finally {
      if (poradi === S.poradi) { $('btnSpocitat').disabled = false; S.nacitani = null; }
    }
  }

  /* ---------- překryv na mapě ---------- */
  const BARVY_POTREBY = [[0, [34, 197, 94]], [5, [163, 230, 53]], [20, [250, 204, 21]], [50, [249, 115, 22]], [150, [220, 38, 38]], [Infinity, [126, 34, 206]]];
  const kumulRezim = () => N.rezimPrekryvu === 'kumul' && S.kum;
  /** Barva kumulace: 1 stanoviště žlutá → všechna tmavě zelená/modrá. */
  const barvaPoctu = (p, n) => n <= 1 ? [34, 197, 94] : p / n <= 0.5 ? mix([250, 204, 21], [34, 197, 94], (p - 1) / Math.max(1, n / 2 - 1)) : mix([34, 197, 94], [30, 64, 175], (p / n - 0.5) * 2);
  function obrazekPrekryvu() {
    if (kumulRezim()) {
      const m = S.kum.m, pc = S.kum.pocet, n = S.kum.n;
      const cv = document.createElement('canvas'); cv.width = m.sirka; cv.height = m.vyska;
      const cx = cv.getContext('2d'), img = cx.createImageData(m.sirka, m.vyska), px = img.data;
      const barvy = Array.from({ length: n + 1 }, (_, p) => barvaPoctu(p, n));
      for (let i = 0; i < pc.length; i++) {
        const p = pc[i]; if (p === 255) continue;
        const o = i * 4;
        if (p) { const c = barvy[p]; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; }
        else { px[o] = 15; px[o + 1] = 23; px[o + 2] = 42; px[o + 3] = 120; }
      }
      cx.putImageData(img, 0, 0);
      return cv;
    }
    const m = S.dem.m, q = S.vs.potreba, t = tCile(), rez = N.rezimPrekryvu === 'kumul' ? 'vid' : N.rezimPrekryvu;
    const cv = document.createElement('canvas'); cv.width = m.sirka; cv.height = m.vyska;
    const cx = cv.getContext('2d'), img = cx.createImageData(m.sirka, m.vyska), px = img.data;
    for (let i = 0; i < q.length; i++) {
      const v = q[i]; if (!(v === v)) continue;
      const o = i * 4;
      if (rez === 'potreba') {
        const c = BARVY_POTREBY.find(([h]) => v - t <= h)[1];
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
      } else if (v <= t) { px[o] = 34; px[o + 1] = 197; px[o + 2] = 94; px[o + 3] = 255; }
      else if (rez === 'vidskryte') { px[o] = 15; px[o + 1] = 23; px[o + 2] = 42; px[o + 3] = 150; }
    }
    cx.putImageData(img, 0, 0);
    return cv;
  }
  function kresliPrekryv() {
    if (!S.vs && !kumulRezim()) return;
    const m = kumulRezim() ? S.kum.m : S.dem.m, h = J.hranice(m);
    obrazekPrekryvu().toBlob(b => {
      if (S.overlayUrl) URL.revokeObjectURL(S.overlayUrl);
      S.overlayUrl = URL.createObjectURL(b);
      const meze = [[h.jih, h.zapad], [h.sever, h.vychod]];
      if (overlay) overlay.setUrl(S.overlayUrl).setBounds(L.latLngBounds(meze));
      else overlay = L.imageOverlay(S.overlayUrl, meze, { className: 'pixely', interactive: false }).addTo(mapa);
      overlay.setOpacity(N.pruhlednost / 100);
    });
    if (N.kruh && S.A) kruh.setLatLng([S.A.lat, S.A.lon]).setRadius(N.dosah * 1000).addTo(mapa); else kruh.remove();
  }

  function obnovStatistiku() {
    if (!S.vs) return;
    const m = S.dem.m, st = J.statistika(m, S.vs, tCile(), N.dosah * 1000);
    S.stat = st;
    if (st.maxBod) { const p = J.bunkaNaBod(m, st.maxBod.x, st.maxBod.y); S.nejdal = p; mkNejdal.setLatLng([p.lat, p.lon]).bindTooltip('Nejvzdálenější viditelné místo').addTo(mapa); }
    else mkNejdal.remove();
    vykresliVysledek();
  }

  const popisTridy = (g, i) => i === 0 ? 'vidět' : g === Infinity ? `chybí přes ${BARVY_POTREBY[i - 1][0]} m` : `chybí do ${g} m`;
  function vykresliVysledek() {
    const vs = S.vs, st = S.stat; if (!vs || !st) return;
    const m = S.dem.m, bunka = J.bunkaMetru(m, S.A.lat), t = tCile();
    const azN = S.nejdal ? J.azimut(S.A.lat, S.A.lon, S.nejdal.lat, S.nejdal.lon) : null;
    const obzorKoule = J.vzdalenostObzoru(hOka(), kParam());
    let h = `<div class="souhrn">
      <div class="dlazdice"><b>${J.plochaText(st.plocha)}</b><span>${N.obraceny ? `odkud je objekt vidět (oko ${fm(t, 1)} m)` : t ? `viditelná plocha pro cíl ${fm(t, t % 1 ? 1 : 0)} m` : 'viditelná plocha'}</span></div>
      <div class="dlazdice"><b>${fm(st.podil * 100, 1)} %</b><span>z kruhu o poloměru ${fm(N.dosah)} km</span></div>
      <div class="dlazdice"><b>${st.maxD ? km(st.maxD) : '–'}</b><span>${azN !== null ? `nejdál vidět – ${J.smer(azN)} (${fm(azN)}°)` : 'nejdál vidět'}</span></div>
      <div class="dlazdice"><b>${fm(vs.zOka)} m</b><span>${N.obraceny ? 'vrchol objektu' : 'oko'} n. m. (terén ${fm(vs.zTer)} m + ${fm(hOka(), 1)} m)</span></div>
      <div class="dlazdice"><b>${N.zakriveni ? km(obzorKoule) : '∞'}</b><span>obzor nad hladkou koulí z ${fm(hOka(), 1)} m</span></div>
    </div>`;
    h += `<div class="legenda">${N.rezimPrekryvu === 'potreba'
      ? BARVY_POTREBY.map(([g, c], i) => `<span><i style="background:rgb(${c})"></i>${popisTridy(g, i)}</span>`).join('')
      : kumulRezim() ? legendaKumulace()
      : '<span><i style="background:rgb(34,197,94)"></i>vidět</span>' + (N.rezimPrekryvu === 'vidskryte' ? '<span><i style="background:rgba(15,23,42,.6)"></i>skryto</span>' : '')}</div>`;
    const casti = [`Terén: ${esc(S.dem.popis)}, buňka ${km(bunka)}, ${fm(m.sirka)} × ${fm(m.vyska)} buněk`,
      N.zakriveni ? `refrakce k = ${fm(N.k, 2)}` : 'bez zakřivení Země', `výpočet ${fm(S.msVypoctu)} ms`];
    if (st.bezDat > 0.001) casti.push(`<b>${fm(st.bezDat * 100, 1)} % oblasti bez výškových dat</b>`);
    if (S.dem.chyb) casti.push(`nestažené dlaždice: ${S.dem.chyb}`);
    h += `<p class="pozn">${casti.join(' · ')}</p>`;
    h += `<p class="pozn">${esc(presnostText(S.dem, bunka))}</p>`;
    if (N.obraceny) h += `<p class="pozn"><b>Obrácená úloha:</b> zelená místa jsou ta, odkud pozorovatel s okem ${fm(tCile(), 1)} m nad terénem uvidí objekt v bodě A vysoký ${fm(hOka(), 1)} m (jeho vrchol). Viditelnost je vzájemná.</p>`;
    h += vrcholyHtml();
    $('vysledek').innerHTML = h;
  }

  /* ---------- vrcholy z OSM ---------- */
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  let stavVrcholu = '';
  async function nactiVrcholy() {
    const A = S.A, dosah = N.dosah * 1000;
    const sv = J.cilovyBod(A.lat, A.lon, 0, dosah), jv = J.cilovyBod(A.lat, A.lon, 90, dosah), jz = J.cilovyBod(A.lat, A.lon, 180, dosah), zz = J.cilovyBod(A.lat, A.lon, 270, dosah);
    const bb = [jz.lat, zz.lon, sv.lat, jv.lon].map(x => x.toFixed(3));
    const klic = bb.join(',');
    if (klic !== S.vrcholyKlic) {
      stavVrcholu = 'Načítám vrcholy z OpenStreetMap (Overpass API odpovídá i desítky sekund)…'; vykresliVysledek();
      const q = `[out:json][timeout:60];(node["natural"="peak"]["name"](${klic});node["man_made"="tower"]["tower:type"="observation"]["name"](${klic});way["man_made"="tower"]["tower:type"="observation"]["name"](${klic}););out center;`;
      let json = null, chyba = '';
      for (const url of OVERPASS.concat(OVERPASS)) {
        if (chyba) await new Promise(r => setTimeout(r, 2500));
        try {
          const odp = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
          if (!odp.ok) { chyba = 'HTTP ' + odp.status + (odp.status === 429 ? ' – příliš mnoho dotazů' : odp.status >= 500 ? ' – server přetížený' : ''); continue; }
          json = await odp.json(); break;
        } catch (e) { chyba = e.message; }
      }
      if (!json) { stavVrcholu = `Vrcholy z OpenStreetMap se nepodařilo načíst (Overpass API: ${chyba}). Veřejné servery bývají přetížené – zkuste „▶ Spočítat“ za chvíli. Viditelnost tím není dotčena.`; S.vrcholyOh = []; vykresliVysledek(); kresliPanoramu(); return; }
      S.vrcholy = J.vrcholyZOsm(json); S.vrcholyKlic = klic;
      mapa.attributionControl.removeAttribution(ATR_OSM_VRCHOLY); mapa.attributionControl.addAttribution(ATR_OSM_VRCHOLY);
    }
    stavVrcholu = '';
    ohodnotVrcholy();
  }
  function ohodnotVrcholy() {
    if (!S.vs) return;
    const tol = Math.max(3, J.bunkaMetru(S.dem.m, S.A.lat) * 0.15);
    S.vrcholyOh = J.ohodnotVrcholy(S.dem.m, S.vs, S.A, S.vrcholy, N.dosah * 1000, tol, kParam());
    kresliVrcholy(); vykresliVysledek(); kresliPanoramu();
  }
  function kresliVrcholy() {
    vrstvaVrcholu.clearLayers();
    if (!N.vrcholy) return;
    // na mapě jen viditelné (u stovek „vrcholů“ z OSM by skryté mapu zahltily), nejvýš 500 nejvyšších
    const seznam = S.vrcholyOh.filter(v => v.vidi).sort((a, b) => (b.ele || b.zDem) - (a.ele || a.zDem)).slice(0, 500);
    for (const v of seznam) {
      L.circleMarker([v.lat, v.lon], { radius: v.vidi ? 5 : 3.5, color: v.vidi ? '#15803d' : '#6b7280', weight: 1.5, fillColor: v.vidi ? '#4ade80' : '#d1d5db', fillOpacity: 0.95 })
        .bindTooltip(`${esc(v.nazev)}${v.ele ? ' ' + fm(v.ele) + ' m' : ''} · ${km(v.d)} · ${v.vidi ? 'vidět' : 'skrytý'}`, { className: 'vrchol-stitek' })
        .addTo(vrstvaVrcholu);
    }
  }
  function vrcholyHtml() {
    if (!N.vrcholy) return '';
    if (stavVrcholu) return `<p class="pozn">${esc(stavVrcholu)}</p>`;
    const vid = S.vrcholyOh.filter(v => v.vidi);
    if (!S.vrcholyOh.length) return S.vrcholyKlic ? '<p class="pozn">V dosahu nejsou žádné pojmenované vrcholy z OpenStreetMap.</p>' : '';
    const radky = vid.slice().sort((a, b) => a.d - b.d).slice(0, 300).map(v => `<tr data-vrchol="${esc(v.id)}">
      <td>${v.druh === 'rozhledna' ? '🗼' : '⛰'} ${esc(v.nazev)}</td><td class="c">${v.ele ? fm(v.ele) : fm(v.zDem)} m</td><td class="c">${km(v.d)}</td>
      <td class="c">${fm(v.az)}° ${J.smer(v.az)}</td><td class="c">${fm(v.uhel, 2)}°</td></tr>`).join('');
    return `<h3 style="font-size:.86rem;margin:10px 0 4px">Viditelné vrcholy a rozhledny: ${vid.length} z ${S.vrcholyOh.length} v dosahu</h3>
      ${vid.length ? `<div class="tab-obal"><table><thead><tr><th>Název</th><th class="c">Výška</th><th class="c">Vzdálenost</th><th class="c">Azimut</th><th class="c">Výšk. úhel</th></tr></thead><tbody>${radky}</tbody></table></div>` : ''}
      <p class="pozn">Výška z OSM (jinak z modelu terénu); výškový úhel z modelu terénu se zakřivením. Klik na řádek ukáže vrchol na mapě.</p>${vid.length > 300 ? '<p class="pozn">Zobrazeno 300 nejbližších.</p>' : ''}`;
  }
  $('vysledek').addEventListener('click', e => {
    const r = e.target.closest('[data-vrchol]'); if (!r) return;
    const v = S.vrcholyOh.find(x => x.id === r.dataset.vrchol); if (!v) return;
    mapa.setView([v.lat, v.lon], Math.max(mapa.getZoom(), 12));
    mkPan.setLatLng([v.lat, v.lon]).addTo(mapa);
  });

  /* ---------- panorama ---------- */
  const tmave = () => document.documentElement.dataset.theme !== 'light';
  const mix = (a, b, f) => a.map((x, i) => Math.round(x + (b[i] - x) * f));
  let PAN_HORNI = 120;   // místo pro popisky vrcholů (v režimu „přizpůsobit“ úměrné výšce panelu)
  let panGeom = null;
  function kresliPanoramu() {
    const cv = $('panorama'), pan = S.pan;
    if (!pan) { $('panInfo').textContent = 'Panorama se ukáže po výpočtu viditelnosti.'; return; }
    const pxDeg = +N.panMeritko, dosah = N.dosah * 1000;
    let lo = Infinity, hi = -Infinity;
    for (let a = 0; a < pan.pocet; a++) { const u = pan.obzor[a]; if (u === u) { lo = Math.min(lo, u); hi = Math.max(hi, u); } }
    if (!(lo < Infinity)) return;
    lo = Math.max(-45, lo - 3); hi = Math.max(hi + (N.slunce || N.mesic ? 6 : 1.5), 1);
    let pr = +N.panPrevyseni; PAN_HORNI = 120;
    if (N.panPrevyseni === 'auto') {   // převýšení tak, aby panorama vyplnilo výšku panelu
      const k = $('panObal').clientHeight - 4;
      PAN_HORNI = Math.round(Math.min(120, Math.max(46, k * 0.3)));
      pr = k > 100 ? Math.min(16, Math.max(1, (k - PAN_HORNI - 22) / ((hi - lo) * pxDeg))) : 4;
    }
    const sirka = Math.round(360 * pxDeg), vyska = Math.min(2400, Math.round(PAN_HORNI + (hi - lo) * pxDeg * pr + 22));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = sirka * dpr; cv.height = vyska * dpr; cv.style.width = sirka + 'px'; cv.style.height = vyska + 'px';
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dno = vyska - 22, Y = u => dno - (u - lo) * pxDeg * pr;
    panGeom = { pxDeg, pr, Y, lo, dno, sirka, vyska, dpr };
    const tm = tmave();
    const nebe = g.createLinearGradient(0, 0, 0, dno);
    nebe.addColorStop(0, tm ? '#0b1220' : '#7fb0e6'); nebe.addColorStop(1, tm ? '#33435e' : '#e4eef9');
    g.fillStyle = nebe; g.fillRect(0, 0, sirka, vyska);
    const blizko = tm ? [38, 56, 34] : [52, 84, 44], daleko = tm ? [92, 106, 130] : [186, 200, 218];
    const sloupec = pan.krokAz * pxDeg;
    for (let a = 0; a < pan.pocet; a++) {
      const x = a * sloupec, w = Math.ceil(sloupec + 0.5);
      let dolni = dno;
      for (let i = pan.start[a]; i < pan.start[a + 1]; i++) {
        const y = Y(pan.uhel[i]);
        if (y < dolni) {
          const c = mix(blizko, daleko, Math.pow(Math.min(1, pan.vzd[i] / dosah), 0.6));
          g.fillStyle = `rgb(${c})`; g.fillRect(x, y, w, dolni - y + 0.6); dolni = y;
        }
      }
    }
    // obrys obzoru
    g.strokeStyle = tm ? 'rgba(230,236,245,.55)' : 'rgba(20,30,45,.55)'; g.lineWidth = 1; g.beginPath();
    for (let a = 0; a < pan.pocet; a++) { const u = pan.obzor[a]; if (u === u) g[a ? 'lineTo' : 'moveTo'](a * sloupec, Y(u)); }
    g.stroke();
    // vodorovná rovina oka a stupnice
    g.setLineDash([4, 4]); g.strokeStyle = tm ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)';
    g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(sirka, Y(0)); g.stroke(); g.setLineDash([]);
    g.fillStyle = tm ? '#111827' : '#f3f4f6'; g.fillRect(0, dno, sirka, 22);   // pod pásem kompasu (kreslí se v popředí)
    g.fillStyle = tm ? '#e5e7eb' : '#111827'; g.font = '11px system-ui, sans-serif';
    g.textAlign = 'left'; g.fillText(fm(0) + '°', 3, Y(0) - 3);
    kresliAstro(g, Y, pxDeg, dno);
    const nejdal = (() => { let m = 0, a0 = 0; for (let a = 0; a < pan.pocet; a++) if (pan.obzorVzd[a] > m) { m = pan.obzorVzd[a]; a0 = a; } return { m, az: a0 * pan.krokAz }; })();
    if (!bodKliku) $('panInfo').textContent = `Obzor od ${fm(Math.min(...pan.obzor), 2)}° do ${fm(Math.max(...pan.obzor), 2)}° nad vodorovnou rovinou oka; nejvzdálenější obzor ${km(nejdal.m)} na azimutu ${fm(nejdal.az)}° (${J.smer(nejdal.az)}). Převýšení ${fm(pr, 1)}×.`;
    kresliPohled();
  }
  /** Popředí panoramatu: popisky vrcholů, bod B a pás kompasu u dolní hrany (vždy vidět).
   *  azL = azimut na levém okraji, W × H = plocha v CSS px, y0 = svislé posunutí obrázku panoramatu. */
  function kresliPopredi(g, azL, W, H, y0) {
    const g0 = panGeom, px = g0.pxDeg, tm = tmave(), pan = S.pan, dole = H - 22;
    const pozice = az => { const xs = []; for (let x = (((az - azL) % 360) + 360) % 360 * px; x <= W; x += 360 * px) xs.push(x); return xs; };
    // vrcholy – vodorovné popisky v řádcích nad terénem, přednost mají vrcholy na siluetě obzoru, pak vyšší
    const naObzoru = v => v.uhel >= pan.obzor[Math.round(v.az / pan.krokAz) % pan.pocet] - 0.06;
    const vrcholy = S.vrcholyOh.filter(v => v.vidi || N.panSkryte).map(v => Object.assign({ silueta: naObzoru(v) }, v))
      .sort((a, b) => (b.vidi - a.vidi) || (b.silueta - a.silueta) || ((b.ele || b.zDem) - (a.ele || a.zDem)));
    const RADEK = 15, MAX_RADKU = 6, horni = Math.max(0, y0) + 13, radky = [], body = [];
    // v režimu celé plochy se popisky vyhnou minimapě v pravém horním rohu
    const mm = W !== g0.sirka && N.panCela ? $('mapaObal') : null, mmX = mm ? W - mm.offsetWidth - 14 : 0, mmY = mm ? mm.offsetHeight + 18 : 0;
    for (const v of vrcholy) {
      const py = Math.min(dole - 2, y0 + g0.Y(v.uhel));
      for (const x of pozice(v.az)) {
        if (body.some(b => Math.abs(b - x) < 5)) continue;
        const text = `${v.nazev}${v.ele ? ' ' + fm(v.ele) : ''}`;
        g.font = (v.silueta ? 'bold ' : '') + '11px system-ui, sans-serif';
        const x1 = x - 3, x2 = x + g.measureText(text).width + 8;
        let r = 0;
        const volno = r => !(radky[r] || []).some(([a, b]) => x1 < b && x2 > a) && !(mm && horni + r * RADEK - 12 < mmY && x2 > mmX);
        for (; r < MAX_RADKU && horni + r * RADEK < py - 12; r++) if (volno(r)) break;
        const yr = horni + r * RADEK;
        if (r >= MAX_RADKU || yr >= py - 12 || (mm && x > mmX && yr < mmY)) continue;
        (radky[r] = radky[r] || []).push([x1, x2]); body.push(x);
        g.strokeStyle = v.vidi ? (tm ? 'rgba(255,255,255,.65)' : 'rgba(0,0,0,.55)') : 'rgba(128,128,128,.55)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x + 0.5, py - 2); g.lineTo(x + 0.5, yr + 3); g.stroke();
        g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(x + 0.5, py - 2, 2, 0, 7); g.fill();
        g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = tm ? 'rgba(11,18,32,.85)' : 'rgba(255,255,255,.85)';
        g.strokeText(text, x + 3, yr);
        g.fillStyle = v.vidi ? (tm ? '#f9fafb' : '#111827') : (tm ? '#9ca3af' : '#6b7280');
        g.fillText(text, x + 3, yr);
      }
    }
    // bod B
    if (S.A && S.B) for (const x of pozice(J.azimut(S.A.lat, S.A.lon, S.B.lat, S.B.lon))) {
      g.strokeStyle = '#2563eb'; g.lineWidth = 2; g.setLineDash([5, 4]);
      g.beginPath(); g.moveTo(x, 4); g.lineTo(x, dole); g.stroke(); g.setLineDash([]);
      if (S.los) { const y = Math.min(dole - 4, y0 + g0.Y(S.los.uhelAB)); g.fillStyle = S.los.vidi ? '#16a34a' : '#dc2626'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
      g.font = 'bold 12px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#2563eb';
      g.fillText('🎯 B' + (S.los ? ' · ' + km(S.los.D) : ''), x, dole - 6); g.textAlign = 'left';
    }
    // kompas
    g.fillStyle = tm ? '#111827' : '#f3f4f6'; g.fillRect(0, dole, W, 22);
    g.fillStyle = tm ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.2)'; g.fillRect(0, dole, W, 1);
    g.fillStyle = tm ? '#e5e7eb' : '#111827'; g.textAlign = 'center';
    const SV = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'], krok = px >= 8 ? 5 : 10;
    for (let a = Math.ceil(azL / krok) * krok; (a - azL) * px <= W; a += krok) {
      const x = (a - azL) * px, an = ((Math.round(a) % 360) + 360) % 360, hl = an % 45 === 0;
      g.fillRect(x, dole, 1, hl ? 7 : 4);
      if (hl) { g.font = 'bold 12px system-ui, sans-serif'; g.fillText(SV[an / 45], x, dole + 18); }
      else if (an % (px >= 16 ? 5 : 15) === 0) { g.font = '11px system-ui, sans-serif'; g.fillText(an + '°', x, dole + 17); }
    }
    g.textAlign = 'left';
  }
  /** Celé panorama 360° i s popředím – pro export PNG a zprávu k tisku. */
  function panoramaKomplet() {
    const src = $('panorama'), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    if (panGeom) { g.setTransform(panGeom.dpr, 0, 0, panGeom.dpr, 0, 0); kresliPopredi(g, 0, panGeom.sirka, panGeom.vyska, 0); }
    return c;
  }
  /* Viditelné okno panoramatu: výřez 360° obrázku kolem azimutu N.smer, plynule dokola. */
  const norm = a => ((a % 360) + 360) % 360;
  let snimekPohledu = 0, odspodu = 0;   // odspodu = o kolik px je obrázek posunutý nahoru (svislé tažení)
  const prekresliPohled = () => { if (!snimekPohledu) snimekPohledu = requestAnimationFrame(() => { snimekPohledu = 0; kresliPohled(); }); };
  function kresliPohled() {
    vyrezNaMape();
    const g0 = panGeom, cv = $('panPohled'), obal = $('panObal');
    $('panSmer').textContent = `${fm(norm(N.smer))}° ${J.smer(norm(N.smer))}`;
    $('btnNaB').disabled = !(S.A && S.B);
    if (!g0 || $('k-panorama').hidden) return;
    const W = Math.max(50, obal.clientWidth), H = Math.max(60, obal.clientHeight), d = g0.dpr;
    if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) {
      cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    odspodu = Math.min(Math.max(0, g0.vyska - H), Math.max(0, odspodu));
    const y0 = g0.y0 = H - g0.vyska + odspodu;
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    if (y0 > 0) { g.fillStyle = tmave() ? '#0b1220' : '#7fb0e6'; g.fillRect(0, 0, cv.width, Math.ceil(y0 * d) + 1); }
    const azL = N.smer - W / 2 / g0.pxDeg, x0 = ((azL * g0.pxDeg) % g0.sirka + g0.sirka) % g0.sirka;
    for (let x = -x0; x < W; x += g0.sirka) g.drawImage($('panorama'), Math.round(x * d), Math.round(y0 * d));
    g.setTransform(d, 0, 0, d, 0, 0);
    kresliPopredi(g, azL, W, H, y0);
    // značka středu pohledu a čára myši
    g.fillStyle = '#7c3aed'; g.beginPath(); g.moveTo(W / 2 - 6, H - 22); g.lineTo(W / 2 + 6, H - 22); g.lineTo(W / 2, H - 30); g.fill();
    if (mys && mys.x >= 0) { g.strokeStyle = 'rgba(245,158,11,.85)'; g.lineWidth = 1; g.beginPath(); g.moveTo(mys.x + 0.5, 0); g.lineTo(mys.x + 0.5, H - 22); g.stroke(); }
  }
  function vyrezNaMape() {
    if (!S.A || !panGeom || !N.panel || $('k-panorama').hidden) { vyrez.remove(); osaVyrezu.remove(); mkSmer.remove(); return; }
    const pul = Math.min(180, $('panObal').clientWidth / 2 / panGeom.pxDeg), R = N.dosah * 1000, A = [S.A.lat, S.A.lon];
    const body = pul >= 180 ? [] : [A], n = Math.max(8, Math.ceil(pul / 2));
    for (let i = 0; i <= n; i++) { const p = J.cilovyBod(S.A.lat, S.A.lon, N.smer - pul + 2 * pul * i / n, R); body.push([p.lat, p.lon]); }
    vyrez.setLatLngs(body).addTo(mapa);
    const c = J.cilovyBod(S.A.lat, S.A.lon, N.smer, R);
    osaVyrezu.setLatLngs([A, [c.lat, c.lon]]).addTo(mapa);
    mkSmer.setLatLng(A).addTo(mapa);
    const sip = mkSmer.getElement() && mkSmer.getElement().querySelector('g');
    if (sip) sip.setAttribute('transform', `rotate(${N.smer})`);
  }
  /* Režim „panorama přes celou plochu“: mapa se přesune do rohu panoramatu jako minimapa. */
  function doMinimapy() { if (N.panCela && S.A) mapa.fitBounds(L.latLng(S.A.lat, S.A.lon).toBounds(N.dosah * 2100), { animate: false }); }
  function panCela(zap) {
    N.panCela = zap === undefined ? !N.panCela : !!zap; ulozN();
    document.body.classList.toggle('pan-cela', N.panCela);
    if (N.panCela) vrstvaVrcholu.remove(); else vrstvaVrcholu.addTo(mapa);
    if (N.panCela) { if (!N.panel) prepniPanel(true); if (N.karta !== 'panorama') ukazKartu('panorama'); $('panObal').appendChild($('mapaObal')); }
    else $('delic').before($('mapaObal'));
    $('btnPanCela').innerHTML = N.panCela ? '🗺️ Velká mapa' : '⛶ Celá plocha';
    $('btnPanCela').setAttribute('aria-pressed', String(N.panCela));
    setTimeout(() => { mapa.invalidateSize(); doMinimapy(); kresliPohled(); }, 0);
  }
  $('btnPanCela').addEventListener('click', () => panCela());
  /** Bod panoramatu pod souřadnicemi x, y (CSS px ve viditelném okně) → azimut, výškový úhel, vzdálenost terénu. */
  function bodPanoramy(x, y) {
    const pan = S.pan, W = $('panObal').clientWidth;
    const az = norm(N.smer + (x - W / 2) / panGeom.pxDeg), a = Math.round(az / pan.krokAz) % pan.pocet;
    const u = panGeom.lo + (panGeom.dno - (y - (panGeom.y0 || 0))) / (panGeom.pxDeg * panGeom.pr);
    let d = null;
    for (let i = pan.start[a]; i < pan.start[a + 1]; i++) if (pan.uhel[i] >= u) { d = pan.vzd[i]; break; }
    return { az, u, d };
  }
  function otoc(az, plynule) {
    const cil = norm(az);
    if (!plynule) { N.smer = cil; ulozN(); prekresliPohled(); return; }
    const od = N.smer, rozdil = ((cil - od) % 360 + 540) % 360 - 180, t0 = performance.now();
    const krok = t => { const f = Math.min(1, (t - t0) / 350); N.smer = norm(od + rozdil * (1 - (1 - f) ** 3)); kresliPohled(); if (f < 1) requestAnimationFrame(krok); else ulozN(); };
    requestAnimationFrame(krok);
  }
  let mys = null, taz = null, bodKliku = null;
  const cvPohled = $('panPohled');
  cvPohled.addEventListener('pointerdown', e => {
    if (!panGeom || e.button) return;
    cvPohled.setPointerCapture(e.pointerId);
    taz = { x: e.clientX, y: e.clientY, smer: N.smer, odspodu, posun: false };
  });
  cvPohled.addEventListener('pointermove', e => {
    if (!panGeom || !S.pan) return;
    const r = cvPohled.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (taz) {
      const dx = e.clientX - taz.x, dy = e.clientY - taz.y;
      if (!taz.posun && Math.hypot(dx, dy) > 4) { taz.posun = true; cvPohled.classList.add('tazeni'); }
      if (taz.posun) { N.smer = norm(taz.smer - dx / panGeom.pxDeg); odspodu = taz.odspodu + dy; mys = null; caraMysi.remove(); bodMysi.remove(); prekresliPohled(); return; }
    }
    mys = { x };
    const b = bodPanoramy(x, y), R = b.d === null ? N.dosah * 1000 : b.d, p = J.cilovyBod(S.A.lat, S.A.lon, b.az, R);
    caraMysi.setLatLngs([[S.A.lat, S.A.lon], [p.lat, p.lon]]).setStyle({ dashArray: b.d === null ? '3 6' : null }).addTo(mapa);
    if (b.d === null) bodMysi.remove(); else bodMysi.setLatLng([p.lat, p.lon]).addTo(mapa);
    prekresliPohled();
  });
  cvPohled.addEventListener('pointerleave', () => { if (taz) return; mys = null; caraMysi.remove(); bodMysi.remove(); prekresliPohled(); });
  const konecTazeni = e => {
    if (!taz) return;
    const posun = taz.posun; taz = null; cvPohled.classList.remove('tazeni');
    if (posun) { ulozN(); return; }
    if (e.type !== 'pointerup') return;
    const r = cvPohled.getBoundingClientRect(); klikPanorama(e.clientX - r.left, e.clientY - r.top);
  };
  cvPohled.addEventListener('pointerup', konecTazeni);
  cvPohled.addEventListener('pointercancel', konecTazeni);
  cvPohled.addEventListener('wheel', e => {
    if (!panGeom || e.ctrlKey) return;
    e.preventDefault();
    const dd = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    N.smer = norm(N.smer + dd * (e.deltaMode ? 16 : 1) / panGeom.pxDeg); prekresliPohled();
    clearTimeout(cvPohled._ul); cvPohled._ul = setTimeout(ulozN, 300);
  }, { passive: false });
  function klikPanorama(x, y) {
    const pan = S.pan; if (!pan || !panGeom || !S.A) return;
    const { az, u, d } = bodPanoramy(x, y);
    if (d === null) { bodKliku = null; $('panInfo').textContent = `Azimut ${fm(az, 1)}° (${J.smer(az)}), výškový úhel ${fm(u, 2)}° – nad obzorem je nebe.`; mkPan.remove(); return; }
    const p = J.cilovyBod(S.A.lat, S.A.lon, az, d);
    bodKliku = p;
    mkPan.setLatLng([p.lat, p.lon]).addTo(mapa);
    const blizky = S.vrcholyOh.filter(v => Math.abs(((v.az - az + 540) % 360) - 180) < 1 && Math.abs(v.d - d) < Math.max(1500, d * 0.08)).sort((a, b) => Math.abs(a.d - d) - Math.abs(b.d - d))[0];
    $('panInfo').innerHTML = `Azimut ${fm(az, 1)}° (${J.smer(az)}), výškový úhel ${fm(u, 2)}°, terén ve vzdálenosti ${km(d)}${blizky ? ` – poblíž <b>${esc(blizky.nazev)}</b>` : ''}. Na mapě fialový kroužek.` +
      `<button class="tl" data-pan="sem" title="Přesunout pozorovatele A sem – díváte se dál stejným směrem">📍 Stoupnout si sem</button><button class="tl" data-pan="b" title="Nastavit sem bod B – čára pohledu z A">🎯 Bod B sem</button>`;
    if (!mapa.getBounds().contains([p.lat, p.lon])) mapa.panTo([p.lat, p.lon]);
  }
  $('panInfo').addEventListener('click', e => {
    const t = e.target.closest('[data-pan]'); if (!t || !bodKliku) return;
    const p = bodKliku; bodKliku = null; zaznamenej(); mkPan.remove();
    if (t.dataset.pan === 'sem') { nastavA(p.lat, p.lon); stav('Pozorovatel přesunut – počítám výhled z nového místa…'); }
    else { nastavB(p.lat, p.lon, true); spocitejLos(); }
    $('panInfo').textContent = '';
  });
  $('btnPanVlevo').addEventListener('click', () => otoc(N.smer - 30, true));
  $('btnPanVpravo').addEventListener('click', () => otoc(N.smer + 30, true));
  $('btnPanSever').addEventListener('click', () => otoc(0, true));
  $('btnNaB').addEventListener('click', () => { if (S.A && S.B) otoc(J.azimut(S.A.lat, S.A.lon, S.B.lat, S.B.lon), true); });
  new ResizeObserver(() => requestAnimationFrame(() => { if (N.panPrevyseni === 'auto') kresliPanoramu(); else kresliPohled(); })).observe($('panObal'));

  /* ---------- čára pohledu A → B ---------- */
  function nastavB(lat, lon, bezVypoctu) {
    S.B = { lat, lon }; N.B = [+lat.toFixed(6), +lon.toFixed(6)]; ulozN();
    mkB.setLatLng([lat, lon]).addTo(mapa);
    if (!bezVypoctu) { ukazKartu('cara'); spocitejLos(); }
  }
  let poradiLos = 0;
  async function spocitejLos() {
    if (!S.A || !S.B) return;
    const A = Object.assign({ h: hOka() }, S.A), B = Object.assign({ h: N.hB }, S.B), poradi = ++poradiLos;
    const D = J.vzdalenost(A.lat, A.lon, B.lat, B.lon);
    if (D > 400000) { stav('Body A a B jsou od sebe přes 400 km – to už je mimo rozumný dohled.', true); return; }
    try {
      let dem = [S.dem, S.demLos].find(x => x && x.zdroj === N.zdroj && J.obsahujeBod(x.m, A.lat, A.lon) && J.obsahujeBod(x.m, B.lat, B.lon));
      if (!dem) {
        const ac = new AbortController();
        dem = await nactiDem(J.oblastUsecky(A, B), 2000000, ac.signal);
        S.demLos = dem; ukazAtribuci(); stav('');
      }
      if (poradi !== poradiLos) return;
      S.los = J.caraPohledu(dem.m, A, B, { k: N.k, zakriveni: N.zakriveni });
      S.los.bunka = J.bunkaMetru(dem.m, A.lat); S.los.popis = dem.popis;
      S.los.radio = N.radio && N.fMHz > 0 ? J.radioSpoj(S.los, N.fMHz) : null;
      vykresliLos(); ulozHash();
    } catch (e) { if (poradi === poradiLos) stav(e.message, true); }
  }
  function vykresliLos() {
    const l = S.los; if (!l) return;
    caraAB.setLatLngs([[S.A.lat, S.A.lon], [S.B.lat, S.B.lon]]).setStyle({ color: l.vidi ? '#16a34a' : '#dc2626', dashArray: l.vidi ? null : '8 6' }).addTo(mapa);
    if (l.prekazka && !l.vidi) {
      const f = l.prekazka.d / l.D;
      mkPrekazka.setLatLng([S.A.lat + (S.B.lat - S.A.lat) * f, S.A.lon + (S.B.lon - S.A.lon) * f]).bindTooltip('Překážka v čáře pohledu').addTo(mapa);
    } else mkPrekazka.remove();
    const vyrok = l.vidi ? '<span class="ano">✓ B je z A vidět</span> (a A z B – viditelnost je vzájemná)' : '<span class="ne">✗ B není z A vidět</span> – terén zakrývá čáru pohledu';
    const p = l.prekazka;
    $('cara').innerHTML = `<p class="vyrok">${vyrok}</p>
      <div class="souhrn">
        <div class="dlazdice"><b>${km(l.D)}</b><span>vzdálenost A–B</span></div>
        <div class="dlazdice"><b>${fm(l.azAB, 1)}° ${J.smer(l.azAB)}</b><span>azimut A → B (zpět ${fm(l.azBA, 1)}°)</span></div>
        <div class="dlazdice"><b>${fm(l.uhelAB, 2)}°</b><span>výškový úhel A → B (z B ${fm(l.uhelBA, 2)}°)</span></div>
        <div class="dlazdice"><b>${fm(l.minVule, 1)} m</b><span>${l.vidi ? 'nejmenší vůle nad terénem' : 'terén přečnívá čáru pohledu'}${p ? ` (${km(p.d)} od A)` : ''}</span></div>
        ${l.vidi ? '' : `<div class="dlazdice"><b>+${fm(l.zvysitB, 1)} m</b><span>o tolik výš by musel být B</span></div>
        <div class="dlazdice"><b>+${fm(l.zvysitA, 1)} m</b><span>nebo o tolik výš A</span></div>`}
      </div>
      <p class="pozn">A: terén ${fm(l.zA)} m, oko ${fm(l.oA, 1)} m n. m. · B: terén ${fm(l.zB)} m, cíl ${fm(l.oB, 1)} m n. m. · ${esc(l.popis)}, buňka ${km(l.bunka)}.
      Profil je kreslený se zakřivením Země (terén se „vyboulí“ o d·(D−d)/2R'), čára pohledu je pak přímka. Nad hladkou koulí by se tyto výšky viděly na ${N.zakriveni ? km(J.dohledDvou(hOka(), N.hB, N.k)) : '∞'}.</p>${radioHtml(l)}`;
    $('profil').hidden = false;
    kresliProfil(); prekresliPohled();
  }
  function kresliProfil() {
    const l = S.los, cv = $('profil'); if (!l || cv.hidden) return;
    const sirka = Math.max(280, cv.clientWidth), vyska = cv.clientHeight || 220, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = sirka * dpr; cv.height = vyska * dpr;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tm = tmave(), L0 = 48, R0 = 12, T0 = 14, B0 = 26;
    let lo = Infinity, hi = -Infinity;
    for (const v of l.vzorky) if (v.zEf === v.zEf) { lo = Math.min(lo, v.zEf); hi = Math.max(hi, v.zEf); }
    lo = Math.min(lo, l.zA, l.zB); hi = Math.max(hi, l.oA, l.oB);
    if (l.radio) { const r = l.radio.r1Stred, st = (l.oA + l.oB) / 2; lo = Math.min(lo, st - r); hi = Math.max(hi, st + r); }
    const pad = (hi - lo) * 0.08 + 5; lo -= pad; hi += pad;
    const X = d => L0 + d / l.D * (sirka - L0 - R0), Y = z => T0 + (hi - z) / (hi - lo) * (vyska - T0 - B0);
    g.fillStyle = tm ? '#0f172a' : '#eef5fc'; g.fillRect(0, 0, sirka, vyska);
    // mřížka
    g.font = '10px system-ui, sans-serif'; g.fillStyle = tm ? '#9ca3af' : '#4b5563'; g.strokeStyle = tm ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
    const krokZ = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find(k => (hi - lo) / k <= 6) || 2000;
    g.textAlign = 'right';
    for (let z = Math.ceil(lo / krokZ) * krokZ; z <= hi; z += krokZ) { g.beginPath(); g.moveTo(L0, Y(z)); g.lineTo(sirka - R0, Y(z)); g.stroke(); g.fillText(fm(z) + ' m', L0 - 4, Y(z) + 3); }
    const krokD = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].find(k => l.D / k <= 8) || 100000;
    g.textAlign = 'center';
    for (let d = 0; d <= l.D; d += krokD) { g.beginPath(); g.moveTo(X(d), T0); g.lineTo(X(d), vyska - B0); g.stroke(); g.fillText(km(d), X(d), vyska - 9); }
    // terén
    g.beginPath(); g.moveTo(X(0), vyska - B0);
    for (const v of l.vzorky) if (v.zEf === v.zEf) g.lineTo(X(v.d), Y(v.zEf));
    g.lineTo(X(l.D), vyska - B0); g.closePath();
    g.fillStyle = tm ? '#3f5a3a' : '#9bbf87'; g.fill();
    g.strokeStyle = tm ? '#86b07a' : '#4d7a3c'; g.lineWidth = 1.2; g.stroke();
    // Fresnelova zóna (1. zóna plně, 60 % čárkovaně) – elipsa kolem čáry pohledu
    if (l.radio) {
      const lam = l.radio.lambda, okraj = (f, zn) => { g.beginPath(); let prvni = true;
        for (const v of l.vzorky) { const r = J.fresnelR(lam, v.d, l.D - v.d) * f, y = Y(v.cara + zn * r); g[prvni ? 'moveTo' : 'lineTo'](X(v.d), y); prvni = false; } g.stroke(); };
      g.strokeStyle = 'rgba(37,99,235,.75)'; g.lineWidth = 1.2; okraj(1, 1); okraj(1, -1);
      g.setLineDash([3, 3]); g.strokeStyle = 'rgba(37,99,235,.6)'; okraj(0.6, -1); g.setLineDash([]);
      const nh = l.radio.nejhorsi; g.fillStyle = l.radio.verdikt === 'volno' ? '#16a34a' : '#f59e0b';
      if (l.radio.verdikt !== 'volno') { g.beginPath(); g.arc(X(nh.d), Y(l.vzorky.find(v => v.d >= nh.d).zEf), 4, 0, 7); g.fill(); }
    }
    // čára pohledu
    g.strokeStyle = l.vidi ? '#16a34a' : '#dc2626'; g.lineWidth = 2; g.setLineDash(l.vidi ? [] : [7, 5]);
    g.beginPath(); g.moveTo(X(0), Y(l.oA)); g.lineTo(X(l.D), Y(l.oB)); g.stroke(); g.setLineDash([]);
    // konce a překážka
    const bod = (x, y, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); };
    bod(X(0), Y(l.oA), '#2563eb'); bod(X(l.D), Y(l.oB), '#2563eb');
    g.fillStyle = tm ? '#f9fafb' : '#111827'; g.font = 'bold 12px system-ui, sans-serif';
    g.textAlign = 'left'; g.fillText('A', X(0) + 6, Y(l.oA) - 6); g.textAlign = 'right'; g.fillText('B', X(l.D) - 6, Y(l.oB) - 6);
    if (l.prekazka && !l.vidi) { const p = l.prekazka; g.strokeStyle = '#dc2626'; g.lineWidth = 2; g.beginPath(); g.arc(X(p.d), Y(p.zEf), 6, 0, 7); g.stroke(); }
  }
  $('btnProhodit').addEventListener('click', () => {
    if (!S.A || !S.B) return;
    zaznamenej();
    const a = S.A, b = S.B, h = hOka();
    setHOka(N.hB); N.hB = h; zapisVstupy();
    nastavB(a.lat, a.lon, true); nastavA(b.lat, b.lon);
  });
  $('btnZrusB').addEventListener('click', () => { zaznamenej(); zrusB(); });
  function zrusB() {
    S.B = null; S.los = null; N.B = null; ulozN();
    [mkB, caraAB, mkPrekazka].forEach(x => x.remove());
    $('profil').hidden = true;
    $('cara').innerHTML = '<div class="prazdno">Zvolte nahoře „🎯 Bod B“ a klikněte do mapy.</div>';
    ulozHash();
  }

  /* ---------- export ---------- */
  function stahni(blob, jmeno) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const jmenoSouboru = pripona => 'viditelnost' + (S.A ? `_${S.A.lat.toFixed(4)}_${S.A.lon.toFixed(4)}` : '') + pripona;
  const potrebaVysledek = () => { if (!S.vs && !kumulRezim()) { Dialog.chyba('Nejdřív spočítejte viditelnost – klikněte do mapy.'); return false; } return true; };
  const doPng = cv => new Promise((ok, chyba) => { try { cv.toBlob(b => b ? ok(b) : chyba(new Error('prázdný obrázek'))); } catch (e) { chyba(e); } });

  async function obrazMapy() {
    const kont = mapa.getContainer(), r0 = kont.getBoundingClientRect();
    const cv = document.createElement('canvas'); cv.width = r0.width; cv.height = r0.height;
    const g = cv.getContext('2d');
    g.fillStyle = '#ddd'; g.fillRect(0, 0, cv.width, cv.height);
    kont.querySelectorAll('.leaflet-tile-pane img.leaflet-tile-loaded').forEach(img => {
      const r = img.getBoundingClientRect(); g.drawImage(img, r.left - r0.left, r.top - r0.top, r.width, r.height);
    });
    const ov = kont.querySelector('img.leaflet-image-layer');
    if (ov) { const r = ov.getBoundingClientRect(); g.globalAlpha = N.pruhlednost / 100; g.imageSmoothingEnabled = false; g.drawImage(ov, r.left - r0.left, r.top - r0.top, r.width, r.height); g.globalAlpha = 1; g.imageSmoothingEnabled = true; }
    const P = (lat, lon) => mapa.latLngToContainerPoint([lat, lon]);
    if (S.A && N.kruh && S.vs) {
      const c = P(S.A.lat, S.A.lon), e = P(J.cilovyBod(S.A.lat, S.A.lon, 90, N.dosah * 1000).lat, J.cilovyBod(S.A.lat, S.A.lon, 90, N.dosah * 1000).lon);
      g.strokeStyle = '#2563eb'; g.setLineDash([6, 6]); g.lineWidth = 1.5; g.beginPath(); g.arc(c.x, c.y, Math.abs(e.x - c.x), 0, 7); g.stroke(); g.setLineDash([]);
    }
    g.font = '11px system-ui, sans-serif';
    for (const v of S.vrcholyOh.filter(x => x.vidi)) {
      const p = P(v.lat, v.lon); if (p.x < 0 || p.y < 0 || p.x > cv.width || p.y > cv.height) continue;
      g.fillStyle = '#4ade80'; g.strokeStyle = '#15803d'; g.beginPath(); g.arc(p.x, p.y, 4, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#111'; g.fillText(v.nazev, p.x + 6, p.y + 4);
    }
    if (S.los) {
      const a = P(S.A.lat, S.A.lon), b = P(S.B.lat, S.B.lon);
      g.strokeStyle = S.los.vidi ? '#16a34a' : '#dc2626'; g.lineWidth = 3; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    const znacka = (bod, txt, c) => { if (!bod) return; const p = P(bod.lat, bod.lon); g.fillStyle = c; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 7, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.fillText(txt, p.x, p.y + 3.5); g.textAlign = 'left'; };
    N.stanoviste.forEach(st => znacka(st, st.nazev.slice(0, 2), '#b45309'));
    znacka(S.A, 'A', '#2563eb'); znacka(S.B, 'B', '#7c3aed');
    const pata = `Viditelnost z bodu · ${N.obraceny ? 'objekt' : 'oko'} ${fm(hOka(), 1)} m, dosah ${fm(N.dosah)} km, ${N.obraceny ? 'pozorovatel' : 'cíl'} ${fm(tCile(), 1)} m · ${S.dem ? S.dem.popis : ''} · podklad: ${PODKLADY[N.podklad].nazev}, © OpenStreetMap`;
    g.font = '11px system-ui, sans-serif'; const w = g.measureText(pata).width + 12;
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(cv.width - w, cv.height - 18, w, 18); g.fillStyle = '#111'; g.fillText(pata, cv.width - w + 6, cv.height - 5);
    cv.toDataURL();   // vyhodí výjimku, když plátno „zašpinil“ podklad bez CORS
    return cv;
  }
  async function pngMapa() {
    try { stahni(await doPng(await obrazMapy()), jmenoSouboru('_mapa.png')); }
    catch (e) { Dialog.chyba('Mapu se nepodařilo uložit jako obrázek (server podkladu nepovolil čtení dlaždic). Zkuste jiný podklad mapy.'); }
  }
  /** Aktivní rastr viditelnosti pro export: jedno stanoviště, nebo kumulace (vidí aspoň jedno). */
  function aktivniRastr() {
    if (kumulRezim()) {
      const pc = S.kum.pocet, q = new Float32Array(pc.length);
      for (let i = 0; i < pc.length; i++) q[i] = pc[i] === 255 ? NaN : pc[i] ? 0 : 1;
      return { m: S.kum.m, q, t: 0.5, kumul: true };
    }
    return S.vs ? { m: S.dem.m, q: S.vs.potreba, t: tCile(), kumul: false } : null;
  }
  const PRIKAZY = {
    pngMapa,
    async pngPanorama() { if (!potrebaVysledek()) return; stahni(await doPng(panoramaKomplet()), jmenoSouboru('_panorama.png')); },
    async pngProfil() { if (!S.los) { Dialog.chyba('Nejdřív zvolte bod B (🎯 Bod B a klik do mapy).'); return; } stahni(await doPng($('profil')), jmenoSouboru('_profil.png')); },
    geojson() {
      if (!potrebaVysledek()) return;
      const r = aktivniRastr(), m = r.m, krok = Math.max(1, Math.ceil(Math.sqrt(m.sirka * m.vyska / 1.5e6)));
      const ob = J.obdelnikyViditelnosti(m, r.q, r.t, krok);
      const vl = { nazev: r.kumul ? 'vidí aspoň jedno stanoviště' : 'viditelná oblast', vyska_oka_m: r.kumul ? null : hOka(), dosah_km: N.dosah, vyska_cile_m: tCile(), obracena: !!N.obraceny,
        refrakce_k: N.zakriveni ? N.k : null, zakriveni: N.zakriveni, teren: (r.kumul ? S.kum.dem : S.dem).popis, bunka_m: Math.round(J.bunkaMetru(m) * krok * 10) / 10,
        plocha_km2: r.kumul ? Math.round(S.kum.stat.aspon1 / 1e4) / 100 : Math.round(S.stat.plocha / 1e4) / 100, vytvoreno: new Date().toISOString() };
      if (S.A && !r.kumul) Object.assign(vl, { pozorovatel_lat: S.A.lat, pozorovatel_lon: S.A.lon });
      const f = [J.geojsonViditelnosti(ob, vl)];
      if (S.A && S.vs) f.push({ type: 'Feature', properties: { nazev: N.obraceny ? 'objekt A' : 'pozorovatel A', vyska_oka_m: hOka(), teren_m: Math.round(S.vs.zTer * 10) / 10 }, geometry: { type: 'Point', coordinates: [S.A.lon, S.A.lat] } });
      N.stanoviste.forEach((st, i) => f.push({ type: 'Feature', properties: { nazev: st.nazev, druh: 'stanoviště', vyska_oka_m: st.h,
        vidi_km2: S.kum && S.kum.stat && S.kum.n === N.stanoviste.length ? Math.round(S.kum.stat.stan[i].plocha / 1e4) / 100 : null }, geometry: { type: 'Point', coordinates: [st.lon, st.lat] } }));
      if (S.B && S.los) {
        f.push({ type: 'Feature', properties: { nazev: 'bod B', vyska_m: N.hB }, geometry: { type: 'Point', coordinates: [S.B.lon, S.B.lat] } });
        f.push({ type: 'Feature', properties: { nazev: 'čára pohledu A–B', vidi: S.los.vidi, vzdalenost_m: Math.round(S.los.D), vule_m: Math.round(S.los.minVule * 10) / 10,
          fresnel_vule_procent: S.los.radio ? Math.round(S.los.radio.minPomer * 100) : null, frekvence_mhz: S.los.radio ? N.fMHz : null }, geometry: { type: 'LineString', coordinates: [[S.A.lon, S.A.lat], [S.B.lon, S.B.lat]] } });
      }
      for (const v of S.vrcholyOh) f.push({ type: 'Feature', properties: { nazev: v.nazev, druh: v.druh, ele: v.ele, vidi: v.vidi, vzdalenost_m: Math.round(v.d), azimut: Math.round(v.az * 10) / 10, osm: v.id }, geometry: { type: 'Point', coordinates: [v.lon, v.lat] } });
      stahni(new Blob([JSON.stringify({ type: 'FeatureCollection', features: f })], { type: 'application/geo+json' }), jmenoSouboru('.geojson'));
    },
    kml() {
      if (!potrebaVysledek()) return;
      const r = aktivniRastr(), m = r.m, krok = Math.max(1, Math.ceil(Math.sqrt(m.sirka * m.vyska / 1e6)));
      const body = [];
      if (S.A) body.push({ nazev: N.obraceny ? 'Objekt A' : 'Pozorovatel A', lat: S.A.lat, lon: S.A.lon, popis: `${N.obraceny ? 'výška objektu' : 'oko'} ${hOka()} m nad terénem` });
      if (S.B) body.push({ nazev: 'Bod B', lat: S.B.lat, lon: S.B.lon, popis: `${N.hB} m nad terénem` });
      N.stanoviste.forEach(st => body.push({ nazev: st.nazev, lat: st.lat, lon: st.lon, popis: `stanoviště, oko ${st.h} m` }));
      S.vrcholyOh.filter(v => v.vidi).forEach(v => body.push({ nazev: v.nazev, lat: v.lat, lon: v.lon, popis: `${v.ele ? fm(v.ele) + ' m, ' : ''}${km(v.d)}, azimut ${fm(v.az, 1)}°` }));
      const nazev = r.kumul ? `Kumulativní viditelnost (${S.kum.n} stanovišť, cíl ${tCile()} m)` : `Viditelnost (oko ${hOka()} m, cíl ${tCile()} m, ${N.dosah} km)`;
      stahni(new Blob([J.kmlViditelnosti(J.obdelnikyViditelnosti(m, r.q, r.t, krok), body, nazev)], { type: 'application/vnd.google-earth.kml+xml' }), jmenoSouboru('.kml'));
    },
    geotiff() {
      if (!potrebaVysledek()) return;
      const r = aktivniRastr();
      const data = r.kumul ? S.kum.pocet : J.maskaViditelnosti(r.q, r.t);
      stahni(new Blob([J.geotiffU8(r.m, data)], { type: 'image/tiff' }), jmenoSouboru(r.kumul ? '_kumulace.tif' : '_maska.tif'));
      Dialog.info(r.kumul ? 'GeoTIFF (EPSG:3857, uint8): hodnota = počet stanovišť, která místo vidí; 255 = mimo dosah / bez dat.'
        : 'GeoTIFF (EPSG:3857, uint8): 1 = vidět, 0 = skryto, 255 = mimo dosah / bez dat. Otevře ho QGIS i jiný GIS.');
    },
    async pngGis() {
      if (!potrebaVysledek()) return;
      const m = aktivniRastr().m;
      stahni(await doPng(obrazekPrekryvu()), jmenoSouboru('_rastr.png'));
      setTimeout(() => stahni(new Blob([J.worldFile(m)], { type: 'text/plain' }), jmenoSouboru('_rastr.pgw')), 400);
      Dialog.info('Rastr je ve Web Mercatoru (EPSG:3857); soubor .pgw ho v GIS (QGIS) umístí na mapu.');
    },
    csvVrcholy() {
      if (!S.vrcholyOh.length) { Dialog.chyba('Žádné vrcholy k exportu – spočítejte viditelnost se zapnutými vrcholy.'); return; }
      const r = [['nazev', 'druh', 'vyska_osm_m', 'vyska_modelu_m', 'vzdalenost_km', 'azimut', 'vyskovy_uhel', 'vidi', 'lat', 'lon']];
      for (const v of S.vrcholyOh.slice().sort((a, b) => a.az - b.az)) r.push([v.nazev, v.druh, v.ele ?? '', v.zDem.toFixed(0), (v.d / 1000).toFixed(2), v.az.toFixed(1), v.uhel.toFixed(3), v.vidi ? 1 : 0, v.lat.toFixed(6), v.lon.toFixed(6)]);
      stahni(new Blob(['﻿' + r.map(x => x.map(c => /[",;\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(';')).join('\n')], { type: 'text/csv' }), jmenoSouboru('_vrcholy.csv'));
    },
    async odkaz() {
      if (!S.A) { Dialog.chyba('Nejdřív zvolte pozorovatele.'); return; }
      ulozHash();
      const url = location.href;
      try { await navigator.clipboard.writeText(url); Dialog.info('Odkaz zkopírován do schránky.'); }
      catch (e) { await Dialog.zeptej('Odkaz na tento výhled (zkopírujte):', url); }
    },
    napoveda() { $('dlgNapoveda').showModal(); },
    novy: async () => { if (!await Dialog.potvrd('Začít nový projekt? Pozorovatel, bod B a stanoviště se odeberou (Ctrl+Z vrátí).')) return; zaznamenej(); N.A = null; N.B = null; N.stanoviste = []; S.projekt = null; aplikujBody(false); $('vysledek').innerHTML = '<div class="prazdno">Klikněte do mapy na místo pozorovatele.</div>'; },
    otevrit() { seznamProjektu(); $('dlgProjekty').showModal(); },
    ulozit: () => ulozProjekt(false),
    ulozitJako: () => ulozProjekt(true),
    importProjektu() { $('souborProjektu').click(); },
    exportProjektu() { stahni(new Blob([JSON.stringify({ format: 'viditelnost-projekt', verze: 1, nazev: S.projekt ? S.projekt.nazev : 'Viditelnost', data: dataProjektu() }, null, 1)], { type: 'application/json' }), jmenoSouboru('.viditelnost.json')); },
    report,
    tisk() { window.print(); },
    zpet, znovu,
    kumul: spocitejKumulaci,
    spocitat() { clearTimeout(casPlanu); spocitej(); }
  };

  /* ---------- přesnost výškového modelu ---------- */
  function presnostText(dem, bunka) {
    const b = `buňka výpočtu ${km(bunka)}`;
    if (dem.zdroj === 'dmr5g') return `Přesnost: DMR 5G – úplná střední chyba výšky 0,18 m v odkrytém a 0,3 m v zalesněném terénu (ČÚZK), rozlišení 2 m; ${b}${bunka > 3 ? ' (model převzorkován – drobné terénní hrany se vyhladí)' : ''}. Les a budovy nezakrývají.`;
    if (dem.zdroj === 'dmp1g') return `Přesnost: DMP 1G – střední chyba výšky 0,4 m u budov a 0,7 m u vegetace (ČÚZK), rozlišení 2 m; ${b}. Povrch včetně korun stromů a střech.`;
    return `Přesnost: Terrain Tiles – v Evropě EU-DEM (svislá RMSE ≈ 3 m, rozlišení ~30 m), jinde SRTM ~30–90 m; ${b}. Kde rozhodují metry, použijte v Česku ČÚZK DMR 5G.`;
  }

  /* ---------- rádiový spoj ---------- */
  function radioHtml(l) {
    if (!N.radio) return '<p class="pozn">Pro rádiový spoj zapněte výše „📡 Fresnelova zóna“ a zadejte frekvenci – ukáže se 1. Fresnelova zóna, vůle a útlum.</p>';
    const r = l.radio; if (!r) return '';
    const vyrok = { volno: '<span class="ano">✓ Volných je aspoň 60 % první Fresnelovy zóny</span> – spoj bez ohybových ztrát',
      zasah: '<span class="varovani">⚠ Přímá viditelnost je, ale terén zasahuje do Fresnelovy zóny</span> – počítejte s útlumem',
      zakryto: '<span class="ne">✗ Terén zakrývá přímou viditelnost</span> – spojení jen ohybem přes překážku' }[r.verdikt];
    const vlna = r.lambda >= 1 ? fm(r.lambda, 2) + ' m' : fm(r.lambda * 100, r.lambda < 0.1 ? 2 : 1) + ' cm';
    return `<h3 class="podnadpis">📡 Rádiový spoj ${fm(r.fMHz, r.fMHz % 1 ? 3 : 0)} MHz (λ = ${vlna})</h3>
      <p class="vyrok">${vyrok}</p>
      <div class="souhrn">
        <div class="dlazdice"><b>${fm(r.minPomer * 100, 0)} %</b><span>nejmenší vůle v poloměrech 1. Fresnelovy zóny (${fm(r.nejhorsi.vule, 1)} m z ${fm(r.nejhorsi.r1, 1)} m, ${km(r.nejhorsi.d)} od A)</span></div>
        <div class="dlazdice"><b>${fm(r.r1Stred, 1)} m</b><span>poloměr 1. Fresnelovy zóny uprostřed trasy</span></div>
        <div class="dlazdice"><b>${fm(r.difrakce, 1)} dB</b><span>ohybový útlum ostří nože (ν = ${fm(r.nu, 2)})</span></div>
        <div class="dlazdice"><b>${fm(r.volny, 1)} dB</b><span>útlum volného prostoru</span></div>
        <div class="dlazdice"><b>${fm(r.celkem, 1)} dB</b><span>celkem (bez zisku antén, kabelů a rezervy)</span></div>
      </div>
      <p class="pozn">Ohyb podle ITU-R P.526 pro jedinou (nejhorší) překážku jako ostří nože; více překážek, odrazy, les a budovy (u DMR 5G) se nezapočítávají.
      Pro rádio se běžně volí refrakce k = 0,25 (ekvivalentní Země 4/3), pro horší podmínky k = −0,5 (Terén ▾). V profilu modře 1. Fresnelova zóna, čárkovaně 60 %.</p>`;
  }

  /* ---------- Slunce a Měsíc nad skutečným obzorem ---------- */
  const casText = t => new Date(t).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const datumDne = () => { const d = N.datum ? new Date(N.datum + 'T00:00') : new Date(); d.setHours(0, 0, 0, 0); return d; };
  const zonaText = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ''; } };
  function spocitejAstro() {
    if (!S.pan || !S.A) return null;
    const t0 = datumDne().getTime(), t1 = t0 + 86400000, klic = [t0, S.A.lat, S.A.lon, S.pan.zOka, hOka()].join();
    if (S.astro && S.astro.klic === klic) return S.astro;
    const obzor = az => J.obzorVAzimutu(S.pan, az), nula = () => 0, out = { klic, t0 };
    for (const tel of ['slunce', 'mesic']) {
      out[tel] = { skutecne: J.vychodyZapady(tel, S.A.lat, S.A.lon, t0, t1, obzor, 2), astro: J.vychodyZapady(tel, S.A.lat, S.A.lon, t0, t1, nula, 2),
        draha: J.drahaTelesa(tel, S.A.lat, S.A.lon, t0, t1, 4) };
    }
    out.mesicFaze = J.poziceMesice(t0 + 43200000, S.A.lat, S.A.lon);
    return (S.astro = out);
  }
  function kresliAstro(g, Y, pxDeg, dno) {
    const a = (N.slunce || N.mesic) ? spocitejAstro() : null;
    vypisAstro(a);
    if (!a) return;
    const tm = tmave();
    // dráhy jen na obloze – ořez podle siluety obzoru
    const pan = S.pan, sl = pan.krokAz * pxDeg;
    g.save(); g.beginPath(); g.moveTo(0, 0);
    for (let i = 0; i <= pan.pocet; i++) { const u = pan.obzor[i % pan.pocet]; g.lineTo(i * sl, u === u ? Y(u) : dno); }
    g.lineTo(pan.pocet * sl, 0); g.closePath(); g.clip();
    for (const [tel, barva, zap] of [['slunce', '#f59e0b', N.slunce], ['mesic', tm ? '#e5e7eb' : '#6b7280', N.mesic]]) {
      if (!zap) continue;
      const d = a[tel].draha;
      g.strokeStyle = barva; g.lineWidth = 2; g.setLineDash(tel === 'mesic' ? [5, 3] : []);
      g.beginPath(); let pred = null;
      for (const p of d) {
        const x = p.az * pxDeg, y = Y(p.alt);
        if (!pred || Math.abs(p.az - pred.az) > 180 || p.alt < -8) g.moveTo(x, y); else g.lineTo(x, y);
        pred = p.alt < -8 ? null : p;
      }
      g.stroke(); g.setLineDash([]);
    }
    g.restore();
    for (const [tel, barva, zap] of [['slunce', '#f59e0b', N.slunce], ['mesic', tm ? '#e5e7eb' : '#6b7280', N.mesic]]) {
      if (!zap) continue;
      const d = a[tel].draha;
      // hodinové značky
      g.fillStyle = barva; g.font = '10px system-ui, sans-serif'; g.textAlign = 'center';
      for (const p of d) {
        const dt = new Date(p.t); if (dt.getMinutes() !== 0 || p.alt < -3) continue;
        const x = p.az * pxDeg, y = Y(p.alt); if (y > Y(J.obzorVAzimutu(pan, p.az)) || y < 8) continue;
        g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); g.fillText(dt.getHours() + 'h', x, y - 5);
      }
      // východy a západy nad skutečným obzorem
      for (const u of a[tel].skutecne) {
        const x = u.az * pxDeg, y = Y(J.obzorVAzimutu(S.pan, u.az));
        g.strokeStyle = barva; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6, 0, 7); g.stroke();
        g.fillStyle = tm ? '#f9fafb' : '#111827'; g.font = 'bold 11px system-ui, sans-serif';
        g.fillText((u.typ === 'vychod' ? '↑' : '↓') + casText(u.t), x, y + 18 > dno ? y - 10 : y + 18);
      }
    }
    g.textAlign = 'left';
  }
  function vypisAstro(a) {
    const el = $('astroInfo'); if (!el) return;
    if (!a) { el.innerHTML = ''; return; }
    const radky = [];
    for (const [tel, nazev, zap] of [['slunce', '☀️ Slunce', N.slunce], ['mesic', '🌙 Měsíc', N.mesic]]) {
      if (!zap) continue;
      const astro = typ => a[tel].astro.find(u => u.typ === typ);
      const sk = a[tel].skutecne;
      if (!sk.length) radky.push(`<tr><td>${nazev}</td><td colspan="4">${a[tel].draha.some(p => p.alt > J.obzorVAzimutu(S.pan, p.az)) ? 'celý den nad obzorem' : 'celý den pod skutečným obzorem'}</td></tr>`);
      for (const u of sk) {
        const as = astro(u.typ), roz = as ? Math.round((u.t - as.t) / 60000) : null;
        radky.push(`<tr><td>${nazev}</td><td>${u.typ === 'vychod' ? '↑ východ' : '↓ západ'}</td><td class="c"><b>${casText(u.t)}</b></td><td class="c">${fm(u.az, 1)}° ${J.smer(u.az)}</td>
          <td class="c">${as ? casText(as.t) + (roz !== null ? ` (${roz > 0 ? '+' : ''}${roz} min)` : '') : '–'}</td></tr>`);
      }
    }
    const f = a.mesicFaze;
    el.innerHTML = radky.length ? `<div class="tab-obal"><table><thead><tr><th>Těleso</th><th>Úkaz</th><th class="c">Nad skutečným obzorem</th><th class="c">Azimut</th><th class="c">Astronomicky (rozdíl)</th></tr></thead><tbody>${radky.join('')}</tbody></table></div>
      <p class="pozn">${datumDne().toLocaleDateString('cs-CZ')} · časy v pásmu prohlížeče (${esc(zonaText())}) · horní okraj kotouče, atmosférická refrakce; Měsíc ${fm(f.osvetleni * 100, 0)} % osvětlen, ${f.dorusta ? 'dorůstá' : 'couvá'}.
      „Astronomicky“ = nad ideálním obzorem 0° (jak udávají kalendáře). Přesnost Slunce ~1 min, Měsíce ~2–4 min; v horách navíc podle přesnosti terénu.</p>` : '';
  }

  /* ---------- stanoviště a kumulativní viditelnost ---------- */
  const vrstvaStanovist = L.layerGroup().addTo(mapa);
  function pridejStanoviste(lat, lon) {
    if (N.stanoviste.length >= 32) { stav('Nejvýš 32 stanovišť.', true); return; }
    let i = N.stanoviste.length + 1; while (N.stanoviste.some(s => s.nazev === 'S' + i)) i++;
    N.stanoviste.push({ lat: +lat.toFixed(6), lon: +lon.toFixed(6), h: hOka(), nazev: 'S' + i });
    ulozN(); kresliStanoviste(); ukazKartu('stanoviste');
  }
  function kresliStanoviste() {
    vrstvaStanovist.clearLayers();
    N.stanoviste.forEach((s, i) => {
      const mk = L.marker([s.lat, s.lon], { draggable: true, keyboard: false, title: s.nazev,
        icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="mk-stan">${esc(s.nazev)}</div>` }) }).addTo(vrstvaStanovist);
      mk.on('dragstart', zaznamenej);
      mk.on('dragend', () => { const p = mk.getLatLng(); s.lat = +p.lat.toFixed(6); s.lon = +p.lng.toFixed(6); ulozN(); vykresliStanoviste(); });
      mk.on('click', () => ukazKartu('stanoviste'));
    });
    vykresliStanoviste();
  }
  function legendaKumulace() {
    const n = S.kum.n;
    const tridy = n <= 6 ? Array.from({ length: n }, (_, i) => i + 1) : [1, Math.round(n / 4), Math.round(n / 2), Math.round(n * 3 / 4), n];
    return '<span><i style="background:rgba(15,23,42,.5)"></i>žádné</span>' + [...new Set(tridy)].map(p => `<span><i style="background:rgb(${barvaPoctu(p, n)})"></i>${p === n ? (n > 1 ? 'všechna ' : '') + p : p}</span>`).join('') + ' <span>stanovišť vidí</span>';
  }
  function vykresliStanoviste() {
    const el = $('stanSeznam'); if (!el) return;
    if (!N.stanoviste.length) {
      el.innerHTML = `<div class="prazdno">Zvolte nahoře „➕ Stanoviště“ a klikejte do mapy, nebo přidejte současného pozorovatele A.<br>
        Kumulativní viditelnost ukáže, kolik stanovišť vidí každé místo – např. pokrytí území hlídkami, vysílači nebo pozorovatelnami.</div>`;
      $('kumVysledek').innerHTML = ''; return;
    }
    const st = S.kum && S.kum.stat && S.kum.n === N.stanoviste.length ? S.kum.stat : null;
    el.innerHTML = `<div class="tab-obal"><table><thead><tr><th>Název</th><th class="c">Oko (m)</th><th class="c">Poloha</th>${st ? '<th class="c">Vidí</th><th class="c">Jen odsud</th>' : ''}<th></th></tr></thead><tbody>
      ${N.stanoviste.map((s, i) => `<tr data-stan="${i}"><td><input class="vstup" data-pole="nazev" value="${esc(s.nazev)}" aria-label="Název stanoviště" style="width:9em"></td>
        <td class="c"><input class="vstup cis" type="number" min="0" max="2000" step="0.5" data-pole="h" value="${s.h}" aria-label="Výška oka (m)"></td>
        <td class="c">${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}</td>
        ${st ? `<td class="c">${J.plochaText(st.stan[i].plocha)}</td><td class="c">${J.plochaText(st.stan[i].jen)}</td>` : ''}
        <td><button class="tl" data-akce="ukaz" title="Ukázat na mapě">🔍</button> <button class="tl" data-akce="jakoA" title="Udělat z něj pozorovatele A">📍</button> <button class="tl" data-akce="smaz" title="Odebrat" aria-label="Odebrat">✕</button></td></tr>`).join('')}
      </tbody></table></div>`;
    if (!S.kum) { $('kumVysledek').innerHTML = '<p class="pozn">Výpočet spustíte tlačítkem „▶ Kumulativní viditelnost“ (klávesa K).</p>'; return; }
    if (!st) { $('kumVysledek').innerHTML = '<p class="pozn">Seznam stanovišť se změnil – spusťte výpočet znovu.</p>'; return; }
    const n = S.kum.n, chyby = (S.kum.info || []).map((x, i) => x.chyba ? `${N.stanoviste[i] ? esc(N.stanoviste[i].nazev) : i + 1}: ${esc(x.chyba)}` : '').filter(Boolean);
    $('kumVysledek').innerHTML = `<div class="souhrn">
        <div class="dlazdice"><b>${J.plochaText(st.aspon1)}</b><span>vidí aspoň jedno stanoviště (${fm(st.aspon1 / (st.pokryto || 1) * 100, 1)} %)</span></div>
        ${n > 1 ? `<div class="dlazdice"><b>${J.plochaText(st.vsechna)}</b><span>vidí všechna ${n}</span></div>` : ''}
        ${n > 1 ? `<div class="dlazdice"><b>${J.plochaText(st.poPoctu.slice(2).reduce((a, b) => a + b, 0))}</b><span>vidí aspoň dvě (překryv)</span></div>` : ''}
        <div class="dlazdice"><b>${J.plochaText(st.poPoctu[0])}</b><span>nevidí žádné (v dosahu ${fm(N.dosah)} km)</span></div>
      </div>
      <div class="legenda">${legendaKumulace()}</div>
      <p class="pozn">Cíl ${fm(tCile(), 1)} m nad terénem · ${esc(S.kum.dem.popis)}, buňka ${km(J.bunkaMetru(S.kum.m))} · výpočet ${fm(S.kum.ms)} ms. Překryv mapy přepnete v Zobrazení ▾.
      ${chyby.length ? '<br><b>Bez výsledku:</b> ' + chyby.join('; ') : ''}</p>`;
  }
  $('k-stanoviste').addEventListener('change', e => {
    const r = e.target.closest('[data-stan]'), pole = e.target.dataset.pole; if (!r || !pole) return;
    zaznamenej();
    const s = N.stanoviste[+r.dataset.stan];
    if (pole === 'nazev') s.nazev = e.target.value.trim().slice(0, 40) || s.nazev;
    else { const x = parseFloat(String(e.target.value).replace(',', '.')); if (isFinite(x)) s.h = Math.min(2000, Math.max(0, x)); }
    ulozN(); kresliStanoviste();
  });
  $('k-stanoviste').addEventListener('click', e => {
    const b = e.target.closest('[data-akce]'), r = e.target.closest('[data-stan]'); if (!b) return;
    const s = r ? N.stanoviste[+r.dataset.stan] : null;
    if (b.dataset.akce === 'ukaz') mapa.setView([s.lat, s.lon], Math.max(mapa.getZoom(), 12));
    if (b.dataset.akce === 'jakoA') { zaznamenej(); setHOka(s.h); zapisVstupy(); nastavA(s.lat, s.lon); }
    if (b.dataset.akce === 'smaz') { zaznamenej(); N.stanoviste.splice(+r.dataset.stan, 1); ulozN(); kresliStanoviste(); }
    if (b.dataset.akce === 'pridatA') { if (!S.A) { stav('Nejdřív umístěte pozorovatele A.', true); return; } zaznamenej(); pridejStanoviste(S.A.lat, S.A.lon); }
    if (b.dataset.akce === 'kumul') spocitejKumulaci();
    if (b.dataset.akce === 'smazVse') smazStanoviste();
  });
  async function smazStanoviste() {
    if (!N.stanoviste.length || !await Dialog.potvrd('Odebrat všechna stanoviště?')) return;
    zaznamenej(); N.stanoviste = []; S.kum = null; if (N.rezimPrekryvu === 'kumul') N.rezimPrekryvu = 'vid';
    ulozN(); zapisVstupy(); kresliStanoviste(); if (overlay && !S.vs) { overlay.remove(); overlay = null; } else kresliPrekryv();
  }
  async function spocitejKumulaci() {
    const sez = N.stanoviste;
    if (!sez.length) { stav('Nejdřív přidejte stanoviště (➕ Stanoviště a klik do mapy).', true); return; }
    if (S.nacitani) S.nacitani.abort();
    const ac = new AbortController(); S.nacitani = ac;
    const poradi = ++S.poradi, dosah = N.dosah * 1000;
    // paměť workeru: n výsledků float32 – celkem nejvýš ~60 mil. buněk
    const maxBunek = Math.max(250000, Math.min(N.detail, Math.floor(6e7 / sez.length)));
    const o = J.oblastStanovist(sez, dosah);
    try {
      let dem = [S.kumDem, S.dem].find(d => vhodny(d, o, maxBunek));
      if (!dem) { dem = await nactiDem(o, maxBunek, ac.signal); ukazAtribuci(); }
      if (poradi !== S.poradi) return;
      S.kumDem = dem;
      if (S.demId !== dem) { stav('Předávám terén výpočtu…'); await zWorkeru({ typ: 'dem', m: dem.m }); S.demId = dem; }
      stav(`Počítám viditelnost z ${sez.length} stanovišť…`);
      const seznam = sez.map(s => { const b = J.bodNaBunku(dem.m, s.lat, s.lon); return { x: b.x, y: b.y, vyskaOka: s.h, dosah, k: N.k, zakriveni: N.zakriveni }; });
      const r = await zWorkeru({ typ: 'kumul', seznam, t: tCile() });
      prubeh(0);
      if (poradi !== S.poradi) return;
      S.kum = { m: dem.m, dem, n: sez.length, maska: r.kum.maska, pocet: r.kum.pocet, info: r.info, ms: r.ms };
      S.kum.stat = J.statistikaKumulace(S.kum.m, S.kum, S.kum.n);
      N.rezimPrekryvu = 'kumul'; ulozN(); zapisVstupy(); stav('');
      kresliPrekryv(); vykresliStanoviste(); vykresliVysledek(); ukazKartu('stanoviste');
    } catch (e) {
      prubeh(0);
      if (e.name !== 'AbortError' && poradi === S.poradi) stav(e.message, true);
    } finally { if (poradi === S.poradi) S.nacitani = null; }
  }
  async function zmenaCile() {
    if (S.vs) obnovStatistiku();
    if (S.kum) {
      if (S.demId !== S.kumDem) { spocitejKumulaci(); return; }
      try {
        const r = await zWorkeru({ typ: 'kumulT', t: tCile() });
        S.kum.maska = r.kum.maska; S.kum.pocet = r.kum.pocet; S.kum.stat = J.statistikaKumulace(S.kum.m, S.kum, S.kum.n);
        vykresliStanoviste();
      } catch (e) { spocitejKumulaci(); return; }
    }
    kresliPrekryv();
  }

  /* ---------- obnova bodů (Zpět/Znovu, projekty) ---------- */
  function aplikujBody(prepocitat) {
    if (N.A) { S.A = { lat: N.A[0], lon: N.A[1] }; mkA.setLatLng(N.A).addTo(mapa); }
    else { S.A = null; S.vs = null; mkA.remove(); }
    if (N.B && N.A) nastavB(N.B[0], N.B[1], true); else zrusB();
    S.kum = null; if (N.rezimPrekryvu === 'kumul') N.rezimPrekryvu = 'vid';
    kresliStanoviste(); zapisVstupy(); ulozN();
    if (prepocitat && S.A) spocitej(); else if (!S.A && overlay) { overlay.remove(); overlay = null; }
  }
  function obnovSnimek(s) { Object.assign(N, JSON.parse(s)); aplikujBody(true); }
  function zpet() { if (!HIST.zpet.length) { stav('Není co vrátit.', true); return; } HIST.znovu.push(snimek()); obnovSnimek(HIST.zpet.pop()); }
  function znovu() { if (!HIST.znovu.length) { stav('Není co opakovat.', true); return; } HIST.zpet.push(snimek()); obnovSnimek(HIST.znovu.pop()); }

  /* ---------- projekty (IndexedDB) ---------- */
  const PROJ_KLICE = ['A', 'B', 'stanoviste', 'vyskaOka', 'vyskaObjektu', 'vyskaPozor', 'obraceny', 'dosah', 'vyskaCile', 'hB', 'zdroj', 'detail', 'k', 'zakriveni',
    'radio', 'fMHz', 'datum', 'slunce', 'mesic', 'rezimPrekryvu', 'lat', 'lon', 'z'];
  function db() {
    return new Promise((ok, chyba) => {
      const r = indexedDB.open('webapp_viditelnost', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('projekty', { keyPath: 'id' });
      r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error || new Error('IndexedDB nejde otevřít'));
    });
  }
  async function dbOp(rezim, fn) {
    const d = await db();
    return new Promise((ok, chyba) => {
      const tx = d.transaction('projekty', rezim), r = fn(tx.objectStore('projekty'));
      tx.oncomplete = () => { d.close(); ok(r && r.result); }; tx.onerror = () => { d.close(); chyba(tx.error); };
    });
  }
  const dataProjektu = () => { const o = {}; PROJ_KLICE.forEach(k => { o[k] = N[k]; }); return JSON.parse(JSON.stringify(o)); };
  function nactiDataProjektu(d) {
    zaznamenej();
    PROJ_KLICE.forEach(k => { if (d[k] !== undefined) N[k] = d[k]; });
    if (!Array.isArray(N.stanoviste)) N.stanoviste = [];
    const rez = N.rezimPrekryvu;
    mapa.setView([N.lat, N.lon], N.z);
    aplikujBody(true);
    if (rez === 'kumul' && N.stanoviste.length) spocitejKumulaci();
  }
  async function ulozProjekt(jako) {
    let nazev = S.projekt && !jako ? S.projekt.nazev : null;
    if (!nazev) {
      nazev = await Dialog.zeptej('Název projektu:', S.projekt ? S.projekt.nazev : (S.A ? `Výhled ${S.A.lat.toFixed(3)}, ${S.A.lon.toFixed(3)}` : 'Projekt'));
      if (!nazev || !nazev.trim()) return;
      nazev = nazev.trim().slice(0, 80);
    }
    const id = S.projekt && S.projekt.nazev === nazev ? S.projekt.id : 'p' + Date.now().toString(36);
    const zaznam = { id, nazev, cas: Date.now(), data: dataProjektu() };
    try { await dbOp('readwrite', st => st.put(zaznam)); S.projekt = { id, nazev }; stav(`Projekt „${nazev}“ uložen.`); setTimeout(() => stav(''), 2500); }
    catch (e) { Dialog.chyba('Projekt se nepodařilo uložit: ' + e.message); }
  }
  async function seznamProjektu() {
    const el = $('projSeznam');
    let vse = [];
    try { vse = (await dbOp('readonly', st => st.getAll())) || []; } catch (e) { el.innerHTML = `<p class="pozn">Úložiště prohlížeče není dostupné (${esc(e.message)}).</p>`; return; }
    vse.sort((a, b) => b.cas - a.cas);
    el.innerHTML = vse.length ? `<div class="tab-obal"><table><thead><tr><th>Projekt</th><th>Uloženo</th><th class="c">Stanoviště</th><th></th></tr></thead><tbody>
      ${vse.map(p => `<tr data-proj="${esc(p.id)}"><td>${esc(p.nazev)}</td><td>${new Date(p.cas).toLocaleString('cs-CZ')}</td><td class="c">${(p.data.stanoviste || []).length}</td>
        <td><button class="tl" type="button" data-pakce="otevri">📂 Otevřít</button> <button class="tl" type="button" data-pakce="export" title="Stáhnout jako JSON">⤓</button> <button class="tl" type="button" data-pakce="smaz" aria-label="Smazat">🗑</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="prazdno">Zatím žádné uložené projekty. Uložíte je v Soubor ▾ → Uložit projekt (Ctrl+S).</div>';
    el._data = vse;
  }
  $('projSeznam').addEventListener('click', async e => {
    const b = e.target.closest('[data-pakce]'), r = e.target.closest('[data-proj]'); if (!b || !r) return;
    const p = $('projSeznam')._data.find(x => x.id === r.dataset.proj); if (!p) return;
    if (b.dataset.pakce === 'otevri') { $('dlgProjekty').close(); S.projekt = { id: p.id, nazev: p.nazev }; nactiDataProjektu(p.data); }
    if (b.dataset.pakce === 'export') stahni(new Blob([JSON.stringify({ format: 'viditelnost-projekt', verze: 1, nazev: p.nazev, data: p.data }, null, 1)], { type: 'application/json' }), p.nazev.replace(/[^\w\-]+/g, '_') + '.viditelnost.json');
    if (b.dataset.pakce === 'smaz' && await Dialog.potvrd(`Smazat projekt „${p.nazev}“?`)) {
      await dbOp('readwrite', st => st.delete(p.id)); if (S.projekt && S.projekt.id === p.id) S.projekt = null; seznamProjektu();
    }
  });
  $('souborProjektu').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.format !== 'viditelnost-projekt' || !j.data) throw new Error('soubor není projekt Viditelnosti');
      S.projekt = null; nactiDataProjektu(j.data);
      stav(`Načten projekt „${j.nazev || f.name}“ – uložte ho (Ctrl+S), chcete-li ho mít v seznamu.`); setTimeout(() => stav(''), 4000);
    } catch (err) { Dialog.chyba('Projekt nejde načíst: ' + err.message); }
  });

  /* ---------- report k tisku ---------- */
  const tab = (hlavicka, radky) => `<table><thead><tr>${hlavicka.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${radky.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  async function report() {
    if (!S.A && !N.stanoviste.length) { Dialog.chyba('Nejdřív umístěte pozorovatele nebo stanoviště a spočítejte viditelnost.'); return; }
    let h = `<h2>👁️ Viditelnost – zpráva</h2><p class="pozn">${new Date().toLocaleString('cs-CZ')}${S.projekt ? ' · projekt „' + esc(S.projekt.nazev) + '“' : ''}</p>`;
    const par = [['Úloha', N.obraceny ? 'odkud je vidět objekt v A' : 'co je vidět z A'],
      [N.obraceny ? 'Objekt A' : 'Pozorovatel A', S.A ? `${S.A.lat.toFixed(6)}, ${S.A.lon.toFixed(6)}` : '–'],
      [N.obraceny ? 'Výška objektu' : 'Výška oka', fm(hOka(), 1) + ' m nad terénem'], [N.obraceny ? 'Oko pozorovatele' : 'Výška cíle', fm(tCile(), 1) + ' m nad terénem'],
      ['Dosah', fm(N.dosah) + ' km'], ['Zakřivení a refrakce', N.zakriveni ? 'ano, k = ' + fm(N.k, 2) : 'ne'], ['Výškový model', S.dem ? esc(S.dem.popis) : '–']];
    h += `<h3>Parametry</h3>${tab(['Parametr', 'Hodnota'], par)}`;
    try { const cv = await obrazMapy(); h += `<h3>Mapa</h3><img class="rep-obr" src="${cv.toDataURL('image/jpeg', 0.85)}" alt="Mapa viditelnosti">`; }
    catch (e) { h += '<p class="pozn">Mapu nelze vložit (podklad nepovolil čtení dlaždic).</p>'; }
    if (S.vs && S.stat) {
      const st = S.stat, b = J.bunkaMetru(S.dem.m, S.A.lat);
      h += `<h3>Výsledek</h3>${tab(['Veličina', 'Hodnota'], [['Viditelná plocha', J.plochaText(st.plocha)], ['Podíl kruhu dosahu', fm(st.podil * 100, 1) + ' %'],
        ['Nejdál vidět', st.maxD ? km(st.maxD) : '–'], ['Oko n. m.', fm(S.vs.zOka, 1) + ' m'], ['Bez výškových dat', fm(st.bezDat * 100, 1) + ' %']])}<p class="pozn">${esc(presnostText(S.dem, b))}</p>`;
    }
    if (S.kum && S.kum.stat && S.kum.n === N.stanoviste.length) {
      const st = S.kum.stat;
      h += `<h3>Stanoviště a kumulativní viditelnost</h3>${tab(['Stanoviště', 'Oko', 'Poloha', 'Vidí', 'Jen odsud'], N.stanoviste.map((s, i) => [esc(s.nazev), fm(s.h, 1) + ' m', s.lat.toFixed(5) + ', ' + s.lon.toFixed(5), J.plochaText(st.stan[i].plocha), J.plochaText(st.stan[i].jen)]))}
        <p class="pozn">Vidí aspoň jedno: ${J.plochaText(st.aspon1)} · všechna: ${J.plochaText(st.vsechna)} · žádné: ${J.plochaText(st.poPoctu[0])}.</p>`;
    }
    const vid = S.vrcholyOh.filter(v => v.vidi).sort((a, b) => a.az - b.az);
    if (vid.length) h += `<h3>Viditelné vrcholy (${vid.length}${vid.length > 60 ? ', 60 nejvyšších' : ''})</h3>` + tab(['Název', 'Výška', 'Vzdálenost', 'Azimut', 'Výšk. úhel'],
      vid.slice().sort((a, b) => (b.ele || b.zDem) - (a.ele || a.zDem)).slice(0, 60).sort((a, b) => a.az - b.az).map(v => [esc(v.nazev), fm(v.ele || v.zDem) + ' m', km(v.d), fm(v.az, 1) + '° ' + J.smer(v.az), fm(v.uhel, 2) + '°']));
    if (S.pan) {
      const cv = panoramaKomplet(), pol = cv.width / 2, obr = x0 => { const c = document.createElement('canvas'); c.width = pol; c.height = cv.height; c.getContext('2d').drawImage(cv, -x0, 0); return c.toDataURL('image/jpeg', 0.85); };
      h += `<h3>Panorama obzoru</h3><img class="rep-obr" src="${obr(0)}" alt="Panorama 0–180°"><img class="rep-obr" src="${obr(pol)}" alt="Panorama 180–360°">`;
      if ($('astroInfo').innerHTML) h += `<h3>Slunce a Měsíc</h3>${$('astroInfo').innerHTML}`;
    }
    if (S.los) h += `<h3>Čára pohledu A–B</h3>${$('cara').innerHTML}<img class="rep-obr" src="${$('profil').toDataURL('image/png')}" alt="Profil">`;
    h += `<h3>Zdroje</h3><p class="pozn">Mapy © přispěvatelé OpenStreetMap (ODbL), podklad ${esc(PODKLADY[N.podklad].nazev)}. ${S.dem ? ATRIB[S.dem.zdroj].replace(/<[^>]+>/g, '') : ''}. Vrcholy OpenStreetMap přes Overpass API. Výpočet: paprsky R2 se zakřivením Země a refrakcí.</p>`;
    $('tiskObsah').innerHTML = h;
    $('dlgReport').showModal();
  }

  /* ---------- odkaz v adrese ---------- */
  function ulozHash() {
    if (!S.A) return;
    const p = new URLSearchParams();
    p.set('a', S.A.lat.toFixed(5) + ',' + S.A.lon.toFixed(5)); p.set('h', hOka()); p.set('r', N.dosah);
    if (N.obraceny) { p.set('u', 'o'); p.set('t', tCile()); }
    if (S.B) { p.set('b', S.B.lat.toFixed(5) + ',' + S.B.lon.toFixed(5)); p.set('hb', N.hB); }
    if (N.zdroj !== 'terrarium') p.set('z', N.zdroj);
    history.replaceState(null, '', '#' + p.toString());
  }
  function ctiHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const bod = s => { const c = (s || '').split(',').map(Number); return c.length === 2 && c.every(isFinite) && Math.abs(c[0]) <= 85 && Math.abs(c[1]) <= 180 ? c : null; };
    const a = bod(p.get('a')); if (!a) return false;
    const cis = (k, lo, hi) => { const x = parseFloat(p.get(k)); return isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null; };
    N.obraceny = p.get('u') === 'o';
    if (cis('h', 0, 2000) !== null) setHOka(cis('h', 0, 2000));
    if (N.obraceny && cis('t', 0, 1000) !== null) N.vyskaPozor = cis('t', 0, 1000);
    if (cis('r', 1, 100) !== null) N.dosah = cis('r', 1, 100);
    if (cis('hb', 0, 2000) !== null) N.hB = cis('hb', 0, 2000);
    if (['terrarium', 'dmr5g', 'dmp1g'].includes(p.get('z'))) N.zdroj = p.get('z');
    N.A = a; N.B = bod(p.get('b'));
    return true;
  }

  /* ---------- hledání místa (Nominatim) ---------- */
  $('hledat').addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = $('hledat').value.trim(); if (!q) return;
    const box = $('vysledkyHledani');
    box.innerHTML = '<div class="pozn" style="padding:6px 10px">Hledám…</div>'; box.hidden = false; umistiNabidku(box, $('hledat'));
    try {
      const odp = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=cs&q=' + encodeURIComponent(q));
      if (!odp.ok) throw new Error('HTTP ' + odp.status);
      const v = await odp.json();
      box.innerHTML = v.length ? v.map(x => `<button class="tl" data-lat="${x.lat}" data-lon="${x.lon}">${esc(x.display_name)}</button>`).join('') + '<div class="pozn">Hledání: Nominatim © OpenStreetMap</div>'
        : '<div class="pozn" style="padding:6px 10px">Nic nenalezeno.</div>';
    } catch (err) { box.innerHTML = `<div class="pozn" style="padding:6px 10px">Hledání selhalo (${esc(err.message)}). Zkontrolujte připojení, nebo klikněte přímo do mapy.</div>`; }
  });
  $('vysledkyHledani').addEventListener('click', e => {
    const b = e.target.closest('[data-lat]'); if (!b) return;
    zavriNabidky();
    const lat = +b.dataset.lat, lon = +b.dataset.lon;
    mapa.setView([lat, lon], Math.max(11, Math.min(13, 15 - Math.round(Math.log2(N.dosah)))));
    zaznamenej(); if (S.rezim === 's') pridejStanoviste(lat, lon); else nastavA(lat, lon);
  });

  /* ---------- nabídky, karty, vstupy ---------- */
  function umistiNabidku(n, b) {
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky(); if (bylo) return;
    n.hidden = false; b.setAttribute('aria-expanded', 'true'); umistiNabidku(n, b);
  }));
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-prikaz]');
    if (p) { e.stopPropagation(); zavriNabidky(); PRIKAZY[p.dataset.prikaz](); return; }
    if (!e.target.closest('.nabidka') && e.target !== $('hledat')) zavriNabidky();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') zavriNabidky(); });
  addEventListener('resize', () => { zavriNabidky(); kresliProfil(); });

  /** Kurzor mapy podle režimu kliknutí: zaměřovač s písmenem (A pozorovatel, B bod, S stanoviště). */
  const kurzor = (c, p) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><g fill='none' stroke-linecap='round'><path d='M16 1v10M16 21v10M1 16h10M21 16h10' stroke='#fff' stroke-width='4'/><path d='M16 1v10M16 21v10M1 16h10M21 16h10' stroke='${c}' stroke-width='2'/><circle cx='16' cy='16' r='5' stroke='#fff' stroke-width='3.5'/><circle cx='16' cy='16' r='5' stroke='${c}' stroke-width='1.6'/></g><circle cx='16' cy='16' r='1.4' fill='${c}'/><text x='26' y='10' text-anchor='middle' font-family='sans-serif' font-weight='bold' font-size='11' fill='${c}' stroke='#fff' stroke-width='2.5' paint-order='stroke'>${p}</text></svg>`)}") 16 16, crosshair`;
  const KURZORY = { a: kurzor('#dc2626', 'A'), b: kurzor('#2563eb', 'B'), s: kurzor('#b45309', 'S') };
  function nastavRezim(r) {
    S.rezim = r;
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === r)));
    $('mapa').style.setProperty('--kurzor', KURZORY[r] || 'crosshair');
    if (r === 'b' && !S.A) stav('Nejdřív umístěte pozorovatele A, potom bod B.', true);
    if (r === 's') { stav('Klikáním do mapy přidáváte stanoviště. Zpět na pozorovatele: klávesa A.'); setTimeout(() => { if (S.rezim === 's') stav(''); }, 3500); }
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));

  function ukazKartu(k) {
    N.karta = k; ulozN();
    if (N.panCela && k !== 'panorama') panCela(false);
    document.querySelectorAll('[data-karta]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.karta === k)));
    if (!['vysledek', 'panorama', 'cara', 'stanoviste'].includes(k)) k = 'vysledek';
    ['vysledek', 'panorama', 'cara', 'stanoviste'].forEach(x => { $('k-' + x).hidden = x !== k; });
    if (!N.panel) prepniPanel(true);
    if (k === 'cara') kresliProfil();
    if (k !== 'panorama') { caraMysi.remove(); bodMysi.remove(); }
    kresliPohled();
  }
  document.querySelectorAll('[data-karta]').forEach(b => b.addEventListener('click', () => ukazKartu(b.dataset.karta)));
  function prepniPanel(otevrit) {
    N.panel = otevrit === undefined ? !N.panel : otevrit; ulozN();
    if (!N.panel && N.panCela) panCela(false);
    $('panel').classList.toggle('zavreny', !N.panel); $('btnPanel').textContent = N.panel ? '▾' : '▴';
    $('panel').style.height = N.panel && N.vyskaPanelu ? Math.min(N.vyskaPanelu, innerHeight - 140) + 'px' : '';
    $('delic').hidden = !N.panel;
    setTimeout(() => { mapa.invalidateSize(); kresliProfil(); kresliPohled(); }, 0);
  }
  $('btnPanel').addEventListener('click', () => prepniPanel());
  // předěl mapa / panel – tažením se mění výška panelu
  $('delic').addEventListener('pointerdown', e => {
    e.preventDefault();
    const d = $('delic'), y0 = e.clientY, h0 = $('panel').offsetHeight;
    d.setPointerCapture(e.pointerId); d.classList.add('tazeni');
    const pohyb = ev => { N.vyskaPanelu = Math.round(Math.max(90, Math.min(innerHeight - 140, h0 - (ev.clientY - y0)))); $('panel').style.height = N.vyskaPanelu + 'px'; };
    const konec = () => { d.removeEventListener('pointermove', pohyb); d.classList.remove('tazeni'); ulozN(); mapa.invalidateSize(); kresliProfil(); };
    d.addEventListener('pointermove', pohyb);
    d.addEventListener('pointerup', konec, { once: true }); d.addEventListener('pointercancel', konec, { once: true });
  });
  $('delic').addEventListener('dblclick', () => { N.vyskaPanelu = Math.round(innerHeight / 2); prepniPanel(true); });

  const cislo = (id, lo, hi) => { const x = parseFloat(String($(id).value).replace(',', '.')); return isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null; };
  function zapisVstupy() {
    $('vyskaOka').value = hOka(); $('vyskaA').value = hOka(); $('vyskaB').value = N.hB; $('dosah').value = N.dosah;
    $('vyskaCile').value = tCile(); $('rezimPrekryvu').value = N.rezimPrekryvu; $('pruhlednost').value = N.pruhlednost;
    $('podklad').value = N.podklad; $('chkVrcholy').checked = N.vrcholy; $('chkKruh').checked = N.kruh;
    $('detail').value = String(N.detail); $('refrakce').value = N.k; $('chkZakriveni').checked = N.zakriveni;
    $('panMeritko').value = String(N.panMeritko); $('panPrevyseni').value = String(N.panPrevyseni); $('panSkryte').checked = N.panSkryte;
    document.querySelectorAll('[data-zdroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.zdroj === N.zdroj)));
    $('uloha').value = N.obraceny ? 'obraceny' : 'vyhled';
    $('popisOka').textContent = N.obraceny ? '🗼' : '👁';
    $('vyskaOka').title = N.obraceny ? 'Výška objektu nad terénem (vrchol větrníku, stožáru, rozhledny)' : 'Výška oka nad terénem';
    $('popisCile').firstChild.textContent = N.obraceny ? 'Výška oka pozorovatele nad terénem (m) – odkud se na objekt dívá ' : 'Výška cíle nad terénem (m) – co musí vyčnívat, aby bylo vidět ';
    $('popisA').firstChild.textContent = N.obraceny ? 'A (objekt): výška ' : 'A: výška nad terénem ';
    $('chkRadio').checked = N.radio; $('fMHz').value = N.fMHz; $('datum').value = N.datum || '';
    $('chkSlunce').checked = N.slunce; $('chkMesic').checked = N.mesic;
    infoDetailu();
  }
  function infoDetailu() {
    const o = J.oblastKolem(S.A ? S.A.lat : N.lat, S.A ? S.A.lon : N.lon, N.dosah * 1000);
    const d = planBunky(o, N.zdroj, N.detail), c = Math.cos((S.A ? S.A.lat : N.lat) * Math.PI / 180);
    let t = `Pro dosah ${fm(N.dosah)} km vyjde buňka ≈ ${km(d * c)}.`;
    if (N.zdroj === 'terrarium' && d * c < 30) t += ' Skutečný detail Terrain Tiles je v Evropě ~30 m.';
    if (N.zdroj !== 'terrarium' && d * c > 10) t += ' Model ČÚZK (2 m) se převzorkuje – pro velký dosah stačí Terrain Tiles.';
    $('detailInfo').textContent = t;
  }
  function zmenaVypoctu() { ulozN(); zapisVstupy(); if (S.A) planuj(); }
  $('vyskaOka').addEventListener('change', () => { const x = cislo('vyskaOka', 0, 2000); if (x !== null) { zaznamenej(); setHOka(x); } zmenaVypoctu(); });
  $('vyskaA').addEventListener('change', () => { const x = cislo('vyskaA', 0, 2000); if (x !== null) { zaznamenej(); setHOka(x); } zmenaVypoctu(); });
  $('vyskaB').addEventListener('change', () => { const x = cislo('vyskaB', 0, 2000); if (x !== null) N.hB = x; ulozN(); zapisVstupy(); spocitejLos(); });
  $('dosah').addEventListener('change', () => { const x = cislo('dosah', 1, 100); if (x !== null) N.dosah = x; zmenaVypoctu(); });
  [$('vyskaOka'), $('dosah')].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') { el.dispatchEvent(new Event('change')); } }));
  $('refrakce').addEventListener('change', () => { const x = cislo('refrakce', -1, 0.9); if (x !== null) N.k = x; zmenaVypoctu(); });
  $('chkZakriveni').addEventListener('change', () => { N.zakriveni = $('chkZakriveni').checked; zmenaVypoctu(); });
  $('detail').addEventListener('change', () => { N.detail = +$('detail').value; zmenaVypoctu(); });
  document.querySelectorAll('[data-zdroj]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); N.zdroj = b.dataset.zdroj; zmenaVypoctu(); }));
  $('btnSpocitat').addEventListener('click', () => { clearTimeout(casPlanu); spocitej(); });
  $('vyskaCile').addEventListener('input', () => { const x = cislo('vyskaCile', 0, 1000); if (x === null) return; setTCile(x); ulozN(); clearTimeout(casPlanu); casPlanu = setTimeout(zmenaCile, 150); });
  $('rezimPrekryvu').addEventListener('change', () => { N.rezimPrekryvu = $('rezimPrekryvu').value; ulozN(); kresliPrekryv(); vykresliVysledek(); });
  $('pruhlednost').addEventListener('input', () => { N.pruhlednost = +$('pruhlednost').value; ulozN(); if (overlay) overlay.setOpacity(N.pruhlednost / 100); });
  $('podklad').addEventListener('change', () => { N.podklad = $('podklad').value; ulozN(); nastavPodklad(); });
  $('chkVrcholy').addEventListener('change', () => { N.vrcholy = $('chkVrcholy').checked; ulozN(); if (N.vrcholy && S.vs) nactiVrcholy(); else { kresliVrcholy(); vykresliVysledek(); kresliPanoramu(); } });
  $('chkKruh').addEventListener('change', () => { N.kruh = $('chkKruh').checked; ulozN(); kresliPrekryv(); });
  $('panMeritko').addEventListener('change', () => { N.panMeritko = +$('panMeritko').value; ulozN(); kresliPanoramu(); });
  $('panPrevyseni').addEventListener('change', () => { const v = $('panPrevyseni').value; N.panPrevyseni = v === 'auto' ? v : +v; ulozN(); kresliPanoramu(); });
  $('panSkryte').addEventListener('change', () => { N.panSkryte = $('panSkryte').checked; ulozN(); kresliPanoramu(); });
  $('uloha').addEventListener('change', () => { N.obraceny = $('uloha').value === 'obraceny'; zmenaVypoctu(); if (S.kum) zmenaCile(); });
  $('chkRadio').addEventListener('change', () => { N.radio = $('chkRadio').checked; ulozN(); spocitejLos(); });
  $('fMHz').addEventListener('change', () => { const x = cislo('fMHz', 0.1, 300000); if (x !== null) N.fMHz = x; N.radio = true; ulozN(); zapisVstupy(); spocitejLos(); });
  $('datum').addEventListener('change', () => { N.datum = $('datum').value; ulozN(); kresliPanoramu(); });
  $('btnDnes').addEventListener('click', () => { N.datum = ''; ulozN(); zapisVstupy(); kresliPanoramu(); });
  $('btnDen').addEventListener('click', () => { const d = datumDne(); d.setDate(d.getDate() + 1); posunDen(d); });
  $('btnDenZpet').addEventListener('click', () => { const d = datumDne(); d.setDate(d.getDate() - 1); posunDen(d); });
  function posunDen(d) { N.datum = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; ulozN(); zapisVstupy(); kresliPanoramu(); }
  $('chkSlunce').addEventListener('change', () => { N.slunce = $('chkSlunce').checked; ulozN(); kresliPanoramu(); });
  $('chkMesic').addEventListener('change', () => { N.mesic = $('chkMesic').checked; ulozN(); kresliPanoramu(); });
  document.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); N.k = +b.dataset.k; N.zakriveni = true; zmenaVypoctu(); }));

  /* ---------- klávesové zkratky ---------- */
  document.addEventListener('keydown', e => {
    const vPoli = e.target.closest && e.target.closest('input, select, textarea');
    if (document.querySelector('dialog[open]') && !e.ctrlKey) return;
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    let akce = null;
    if (ctrl) {
      if (k === 'z' && !e.shiftKey && !vPoli) akce = zpet;
      else if ((k === 'y' || (k === 'z' && e.shiftKey)) && !vPoli) akce = znovu;
      else if (k === 's') akce = PRIKAZY[e.shiftKey ? 'ulozitJako' : 'ulozit'];
      else if (k === 'o') akce = PRIKAZY.otevrit;
      else if (k === 'p') akce = report;
      else if (k === 'enter') akce = PRIKAZY.spocitat;
    } else if (!vPoli && !e.altKey) {
      akce = { a: () => nastavRezim('a'), b: () => nastavRezim('b'), s: () => nastavRezim('s'), k: spocitejKumulaci, '1': () => ukazKartu('vysledek'), '2': () => ukazKartu('panorama'),
        '3': () => ukazKartu('cara'), '4': () => ukazKartu('stanoviste'), '?': PRIKAZY.napoveda, f1: PRIKAZY.napoveda, p: () => panCela() }[k] || null;
      if (!akce && N.karta === 'panorama' && N.panel && (k === 'arrowleft' || k === 'arrowright')) {
        const krok = (e.shiftKey ? 30 : 5) * (k === 'arrowleft' ? -1 : 1); akce = () => otoc(N.smer + krok, e.shiftKey);
      }
    }
    if (akce) { e.preventDefault(); zavriNabidky(); akce(); }
  });
  new MutationObserver(() => { kresliPanoramu(); kresliProfil(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- start ---------- */
  const zOdkazu = ctiHash();
  nastavRezim('a');
  zapisVstupy(); ukazKartu(N.karta || 'vysledek'); prepniPanel(N.panel !== false); kresliStanoviste();
  if (N.panCela) panCela(true);
  if (N.B && N.A) nastavB(N.B[0], N.B[1], true);
  if (N.A) {
    if (zOdkazu) mapa.setView(N.A, Math.max(9, Math.min(13, 15 - Math.round(Math.log2(N.dosah)))));
    nastavA(N.A[0], N.A[1], !zOdkazu);
    if (!zOdkazu) $('vysledek').innerHTML = '<div class="prazdno">Pozorovatel z minula je na mapě. Výpočet spustíte tlačítkem <b>▶ Spočítat</b> nebo kliknutím jinam do mapy.</div>';
  }
  window.VIDITELNOST_APP = { S, N, spocitej, nastavA, nastavB, ukazKartu, mapa, pridejStanoviste, spocitejKumulaci, nastavRezim, zpet, znovu, report, PRIKAZY, HIST, zaznamenej, zapisVstupy };
})();
