/* ============================================================
   app.js – uživatelské rozhraní stránky „Světelné znečištění
   a tmavá obloha“. Výpočty: jadro.js (model jasu), astro.js
   (Slunce a Měsíc), worker.js (pole jasu mimo hlavní vlákno).
   ============================================================ */
(function () {
  'use strict';
  const J = window.SZ_JADRO, A = window.SZ_ASTRO;
  const KLIC = 'webapp_svetelne_znecisteni_';
  const $ = s => document.querySelector(s);
  const el = (tag, attrs = {}, ...deti) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const d of deti) if (d != null) e.append(d);
    return e;
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nacti = (k, def) => { try { const v = localStorage.getItem(KLIC + k); return v ? JSON.parse(v) : def; } catch { return def; } };
  const uloz = (k, v) => { try { localStorage.setItem(KLIC + k, JSON.stringify(v)); } catch { /* úložiště nedostupné */ } };
  const C = J.cislo;
  const MIN = 60000, HOD = 3600000, DEN = 86400000;
  const cas = d => d ? d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : '—';
  const datum = d => d.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
  const datumDlouhe = d => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  const hodMin = min => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;
  const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'místní čas'; } catch { return 'místní čas'; } })();

  /* ---------------- stav ---------------- */
  const nast = Object.assign({ podklad: 'sedy', vrstva: 'odhad', kryti: 0.75, oblaka: 'zadna', stred: [49.8, 15.5], zoom: 7, jenObl: false }, nacti('nastaveni', {}));
  let mista = (nacti('mista', []) || []).filter(J.platneMisto);
  let vybrane = null;                      // {lat, lon, nazev, id?}
  const ulozNast = () => uloz('nastaveni', nast);
  const ulozMista = () => uloz('mista', mista);
  const noveId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------------- data VIIRS (NASA GIBS) ---------------- */
  const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/';
  const DNB = 'VIIRS_SNPP_GapFilled_BRDF_Corrected_DayNightBand_Radiance';
  const NOCI = J.referencniNoci(new Date());
  const pouziteNoci = new Map(NOCI.map(d => [d, { ok: 0, chybi: 0 }]));
  const dlazdice = new Map();
  let fronta = [], bezi = 0;
  const MAX_SOUBEZNE = 6;
  function pustFrontu() {
    while (bezi < MAX_SOUBEZNE && fronta.length) {
      const u = fronta.shift(); bezi++;
      u().finally(() => { bezi--; pustFrontu(); });
    }
  }
  const doFronty = fn => new Promise((ok, chyba) => { fronta.push(() => fn().then(ok, chyba)); pustFrontu(); });
  let platno = null;
  async function dekoduj(blob) {
    const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    if (!platno) platno = document.createElement('canvas');
    platno.width = bmp.width; platno.height = bmp.height;
    const ctx = platno.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, bmp.width, bmp.height); ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data, kody = new Uint8Array(bmp.width * bmp.height);
    for (let i = 0; i < kody.length; i++) kody[i] = J.kodPixelu(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]);
    bmp.close && bmp.close();
    return kody;
  }
  // → Uint8Array kódů 256×256, nebo null (dlaždice pro noc neexistuje)
  function kodyDlazdice(noc, z, x, y) {
    const k = `${noc}/${z}/${x}/${y}`;
    if (dlazdice.has(k)) return dlazdice.get(k);
    const p = doFronty(async () => {
      const r = await fetch(`${GIBS}${DNB}/default/${noc}/GoogleMapsCompatible_Level8/${z}/${y}/${x}.png`, { mode: 'cors' });
      if (r.status === 404 || r.status === 400) { pouziteNoci.get(noc).chybi++; return null; }
      if (!r.ok) throw new Error(`NASA GIBS vrátil ${r.status}`);
      const kody = await dekoduj(await r.blob());
      pouziteNoci.get(noc).ok++;
      return kody;
    });
    p.catch(() => dlazdice.delete(k));
    dlazdice.set(k, p);
    if (dlazdice.size > 900) dlazdice.delete(dlazdice.keys().next().value);
    return p;
  }
  // mozaika (2m+1)² dlaždic pro každou noc
  async function mozaika(z, tx, ty, m) {
    const strana = 2 * m + 1, W = strana * 256, n = 2 ** z;
    const vrstvy = await Promise.all(NOCI.map(async noc => {
      const buf = new Uint8Array(W * W); let neco = false;
      await Promise.all(Array.from({ length: strana * strana }, async (_, idx) => {
        const i = idx % strana, j = Math.floor(idx / strana), y = ty - m + j;
        if (y < 0 || y >= n) return;
        const x = ((tx - m + i) % n + n) % n;
        const kody = await kodyDlazdice(noc, z, x, y);
        if (!kody) return;
        neco = true;
        for (let r = 0; r < 256; r++) buf.set(kody.subarray(r * 256, r * 256 + 256), (j * 256 + r) * W + i * 256);
      }));
      return neco ? buf : null;
    }));
    return { vrstvy, W };
  }

  /* ---------------- web worker ---------------- */
  let worker = null, wid = 0;
  const cekaji = new Map();
  try {
    worker = new Worker('svetelne_znecisteni/worker.js');
    worker.onmessage = e => { const c = cekaji.get(e.data.id); if (c) { cekaji.delete(e.data.id); e.data.ok ? c.ok(e.data) : c.chyba(new Error(e.data.chyba)); } };
    worker.onerror = () => { worker = null; };
  } catch { worker = null; }
  function spocti(zprava) {
    if (worker) return new Promise((ok, chyba) => { const id = ++wid; cekaji.set(id, { ok, chyba }); worker.postMessage({ ...zprava, id }); });
    // záloha bez workeru (např. file://)
    return new Promise(ok => setTimeout(() => {
      const { r } = J.medianRadiance(zprava.vrstvy, zprava.w * zprava.h);
      if (zprava.typ === 'pole') ok({ pole: J.orizni(J.poleUmelehoJasu(r, zprava.w, zprava.h, zprava.px), zprava.w, zprava.x0, zprava.y0, zprava.sw, zprava.sh) });
      else { const b = J.umelyJasBodu(r, zprava.w, zprava.h, zprava.cx, zprava.cy, zprava.px); ok({ mcd: b.mcd, podilDo10km: b.podilDo10km, satOkoli: 0, chybiOkoli: 0 }); }
    }, 0));
  }

  /* ---------------- odhad pro bod ---------------- */
  const odhady = new Map();
  function odhadMista(lat, lon) {
    const k = lat.toFixed(4) + ',' + lon.toFixed(4);
    if (odhady.has(k)) return odhady.get(k);
    const p = (async () => {
      const z = J.MODEL.ZOOM, info = J.dlazdiceKolem(lat, lon, z);
      const { vrstvy, W } = await mozaika(z, info.tx, info.ty, info.m);
      const platne = vrstvy.filter(Boolean).length;
      if (!platne) throw new Error('Pro toto místo nejsou dostupná data VIIRS (výpadek služby nebo oblast bez dat).');
      const cx = info.X - (info.tx - info.m) * 256, cy = info.Y - (info.ty - info.m) * 256;
      const v = await spocti({ typ: 'bod', vrstvy, w: W, h: W, cx, cy, px: J.pixelKm(lat, z) });
      const vys = J.vysledek(v.mcd);
      vys.noci = NOCI.filter((_, i) => vrstvy[i]);
      vys.podilDo10km = v.podilDo10km; vys.satOkoli = v.satOkoli; vys.chybiOkoli = v.chybiOkoli;
      vys.spocteno = new Date().toISOString();
      return vys;
    })();
    p.catch(() => odhady.delete(k));
    odhady.set(k, p);
    return p;
  }

  /* ---------------- Open-Meteo ---------------- */
  const vysky = new Map();
  function vyskaMista(lat, lon) {
    const k = lat.toFixed(4) + ',' + lon.toFixed(4);
    if (vysky.has(k)) return vysky.get(k);
    const p = fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(5)}&longitude=${lon.toFixed(5)}`)
      .then(r => { if (!r.ok) throw new Error('Open-Meteo ' + r.status); return r.json(); })
      .then(j => { const v = j.elevation && j.elevation[0]; if (!Number.isFinite(v)) throw new Error('bez výšky'); return v; });
    p.catch(() => vysky.delete(k));
    vysky.set(k, p);
    return p;
  }
  const pocasi = new Map();
  function pocasiMista(lat, lon) {
    const k = lat.toFixed(2) + ',' + lon.toFixed(2), c = pocasi.get(k);
    if (c && Date.now() - c.t < 30 * MIN) return c.p;
    const p = fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      '&hourly=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,wind_speed_10m,temperature_2m,dew_point_2m' +
      '&forecast_days=7&timezone=GMT&timeformat=unixtime&wind_speed_unit=ms')
      .then(r => { if (!r.ok) throw new Error('Open-Meteo ' + r.status); return r.json(); })
      .then(j => ({ ...j.hourly, nacteno: new Date(), model: 'best_match' }));
    p.catch(() => pocasi.delete(k));
    pocasi.set(k, { t: Date.now(), p });
    return p;
  }
  // průměr hodinové veličiny v intervalech [{od, do}] (hodina se počítá, pokud její střed padne do intervalu)
  function prumerVOkne(h, klic, intervaly) {
    if (!h || !h.time) return null;
    let s = 0, n = 0;
    for (let i = 0; i < h.time.length; i++) {
      const t = h.time[i] * 1000 + 30 * MIN;
      if (intervaly.some(x => t >= x.od.getTime() && t <= x.do.getTime()) && Number.isFinite(h[klic][i])) { s += h[klic][i]; n++; }
    }
    return n ? s / n : null;
  }

  /* ---------------- astronomie pro místo ---------------- */
  // datum (UTC Y/M/D) „dnešní“ noci: do 6:00 místního středního času ještě běží včerejší noc, potom už platí nadcházející večer
  function nocDatum(lon, i = 0, ted = new Date()) {
    const t = new Date(ted.getTime() + lon / 15 * HOD - 6 * HOD + i * DEN);
    return [t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()];
  }
  function noc(lat, lon, i = 0) { const [r, m, d] = nocDatum(lon, i); return A.tmaveOkno(r, m, d, lat, lon); }
  const intervalyNoci = o => o.noc.astronomicky.vecer && o.noc.astronomicky.rano ? [{ od: o.noc.astronomicky.vecer, do: o.noc.astronomicky.rano }] : [];

  /* ---------------- mapa ---------------- */
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const svetle = () => document.documentElement.dataset.theme === 'light';
  const PODKLADY = {
    sedy: { nazev: 'Šedý (podle tématu)', max: 16, atr: 'Podklad © Esri, HERE, Garmin, © OpenStreetMap',
      url: () => ESRI + `Canvas/World_${svetle() ? 'Light' : 'Dark'}_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
      popisky: () => ESRI + `Canvas/World_${svetle() ? 'Light' : 'Dark'}_Gray_Reference/MapServer/tile/{z}/{y}/{x}` },
    osm: { nazev: 'OSM – humanitární', max: 19, url: () => 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      atr: 'Podklad © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, styl HOT, server OSM France' },
    topo: { nazev: 'Turistická (OpenTopoMap)', max: 17, url: () => 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      atr: 'Podklad © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, SRTM, styl © OpenTopoMap (CC-BY-SA)' },
    teren: { nazev: 'Topografická (Esri)', max: 18, atr: 'Podklad © Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap',
      url: () => ESRI + 'World_Topo_Map/MapServer/tile/{z}/{y}/{x}' },
    satelit: { nazev: 'Satelitní (Esri)', max: 18, atr: 'Podklad © Esri, Maxar, Earthstar Geographics',
      url: () => ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}',
      popisky: () => ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}' },
  };
  if (!PODKLADY[nast.podklad]) nast.podklad = 'sedy';
  const mapa = L.map('mapa', { zoomSnap: 0.5, minZoom: 3, maxZoom: 14, worldCopyJump: true })
    .setView(nast.stred, nast.zoom);
  mapa.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  mapa.createPane('svetlo').style.zIndex = 350;
  mapa.createPane('oblaka').style.zIndex = 380;
  mapa.createPane('popisky').style.zIndex = 390;
  for (const p of ['svetlo', 'oblaka', 'popisky']) mapa.getPane(p).style.pointerEvents = 'none';
  let vrstvaPodkladu = null, vrstvaPopisku = null;
  function nastavPodklad() {
    vrstvaPodkladu?.remove(); vrstvaPopisku?.remove(); vrstvaPopisku = null;
    const p = PODKLADY[nast.podklad];
    vrstvaPodkladu = L.tileLayer(p.url(), { maxZoom: 14, maxNativeZoom: p.max, attribution: p.atr }).addTo(mapa);
    if (p.popisky) vrstvaPopisku = L.tileLayer(p.popisky(), { maxZoom: 14, maxNativeZoom: p.max, pane: 'popisky' }).addTo(mapa);
  }
  const volbaPodkladu = $('#volbaPodkladu');
  for (const [k, p] of Object.entries(PODKLADY)) volbaPodkladu.append(el('option', { value: k, text: p.nazev }));
  volbaPodkladu.value = nast.podklad;
  volbaPodkladu.addEventListener('change', () => { nast.podklad = volbaPodkladu.value; ulozNast(); nastavPodklad(); });
  nastavPodklad();
  new MutationObserver(() => { if (nast.podklad === 'sedy') nastavPodklad(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  mapa.on('moveend', () => { const c = mapa.getCenter(); nast.stred = [+c.lat.toFixed(4), +c.lng.toFixed(4)]; nast.zoom = mapa.getZoom(); ulozNast(); });

  /* ----- vrstva odhadu jasu (vlastní GridLayer) ----- */
  const ATR_VIIRS = 'Noční světla: NASA Black Marble VIIRS (GIBS/ESDIS)';
  const pole = new Map();          // `${z}/${x}/${y}` → Promise<Float32Array 256×256 (umělý jas mcd/m²)>
  let cekajiciPole = 0, chybaPole = null;
  function poleDlazdice(z, x, y) {
    const k = `${z}/${x}/${y}`;
    if (pole.has(k)) return pole.get(k);
    cekajiciPole++; aktualizujStav();
    const p = (async () => {
      const lat = J.yNaLat((y + 0.5) * 256, z), px = J.pixelKm(lat, z);
      const m = Math.max(1, Math.ceil(J.MODEL.R_MAX_KM / px / 256));
      const { vrstvy, W } = await mozaika(z, x, y, m);
      if (!vrstvy.some(Boolean)) return null;
      const v = await spocti({ typ: 'pole', vrstvy, w: W, h: W, px, x0: m * 256, y0: m * 256, sw: 256, sh: 256 });
      return v.pole;
    })();
    p.then(() => { chybaPole = null; }, e => { chybaPole = e; pole.delete(k); })
      .finally(() => { cekajiciPole--; aktualizujStav(); });
    pole.set(k, p);
    if (pole.size > 80) pole.delete(pole.keys().next().value);
    return p;
  }
  const VrstvaOdhadu = L.GridLayer.extend({
    createTile(c, hotovo) {
      const t = document.createElement('canvas'); t.width = 256; t.height = 256;
      if (c.z < 4) { setTimeout(() => hotovo(null, t), 0); return t; }
      const zs = Math.min(c.z, J.MODEL.ZOOM), f = 2 ** (c.z - zs);
      const ax = Math.floor(c.x / f), ay = Math.floor(c.y / f), ox = (c.x - ax * f) * 256 / f, oy = (c.y - ay * f) * 256 / f;
      const n = 2 ** zs;
      poleDlazdice(zs, ((ax % n) + n) % n, ay).then(P => {
        if (!P) return hotovo(null, t);
        const ctx = t.getContext('2d'), img = ctx.createImageData(256, 256), d = img.data, nat = J.MODEL.PRIROZENY_MCD;
        for (let y = 0; y < 256; y++) {
          const fy = Math.min(255, Math.max(0, oy + (y + 0.5) / f - 0.5)), y0 = Math.floor(fy), y1 = Math.min(255, y0 + 1), ty = fy - y0;
          for (let x = 0; x < 256; x++) {
            const fx = Math.min(255, Math.max(0, ox + (x + 0.5) / f - 0.5)), x0 = Math.floor(fx), x1 = Math.min(255, x0 + 1), tx = fx - x0;
            const v = (P[y0 * 256 + x0] * (1 - tx) + P[y0 * 256 + x1] * tx) * (1 - ty) + (P[y1 * 256 + x0] * (1 - tx) + P[y1 * 256 + x1] * tx) * ty;
            J.barvaRychle(J.mcdNaMag(nat + v), d, (y * 256 + x) * 4);
          }
        }
        ctx.putImageData(img, 0, 0);
        hotovo(null, t);
      }, e => hotovo(e, t));
      return t;
    },
  });
  const vrstvy = {
    odhad: () => new VrstvaOdhadu({ pane: 'svetlo', minZoom: 3, maxZoom: 14, attribution: ATR_VIIRS + ' · model jasu: tato stránka' }),
    radiance: () => L.tileLayer(`${GIBS}${DNB}/default/${NOCI[0]}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
      { pane: 'svetlo', maxNativeZoom: 8, maxZoom: 14, attribution: ATR_VIIRS + ` (noc ${NOCI[0]})` }),
    bm2016: () => L.tileLayer(`${GIBS}VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
      { pane: 'svetlo', maxNativeZoom: 8, maxZoom: 14, attribution: 'NASA Earth Observatory Black Marble 2016 (GIBS)' }),
  };
  let vrstvaSvetla = null;
  function nastavVrstvu() {
    vrstvaSvetla?.remove(); vrstvaSvetla = null;
    if (vrstvy[nast.vrstva]) { vrstvaSvetla = vrstvy[nast.vrstva]().addTo(mapa); vrstvaSvetla.setOpacity(nast.kryti); }
    if (nast.vrstva === 'radiance') {
      // dlaždice konkrétní noci – při výpadku (404) zkusit starší noc
      let pokus = 0;
      vrstvaSvetla.on('tileerror', () => { if (pokus++ === 6 && NOCI[1]) { vrstvaSvetla.setUrl(`${GIBS}${DNB}/default/${NOCI[1]}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`); } });
    }
    kresliLegendu(); aktualizujStav();
  }
  const volbaVrstvy = $('#volbaVrstvy'), kryti = $('#pruhlednost');
  volbaVrstvy.value = nast.vrstva; kryti.value = nast.kryti;
  volbaVrstvy.addEventListener('change', () => { nast.vrstva = volbaVrstvy.value; ulozNast(); nastavVrstvu(); });
  kryti.addEventListener('input', () => { nast.kryti = +kryti.value; vrstvaSvetla?.setOpacity(nast.kryti); ulozNast(); });

  /* ----- oblačnost ----- */
  let vrstvaOblaku = null, mrizkaOblaku = null, casovacOblaku = null, cisloDotazu = 0;
  const volbaOblaku = $('#volbaOblaku'), hodina = $('#hodinaOblaku'), hodinaText = $('#hodinaText');
  volbaOblaku.value = nast.oblaka;
  const vcera = () => new Date(Date.now() - DEN).toISOString().slice(0, 10);
  async function nactiMrizkuOblaku() {
    const b = mapa.getBounds().pad(0.15), z = 10;
    const Y0 = J.latNaY(Math.min(84, b.getNorth()), z), Y1 = J.latNaY(Math.max(-84, b.getSouth()), z);
    const sl = 10, ra = 8, X0 = J.lonNaX(b.getWest(), z), X1 = J.lonNaX(b.getEast(), z);
    const body = [];
    for (let j = 0; j < ra; j++) for (let i = 0; i < sl; i++) {
      const lat = J.yNaLat(Y0 + (j + 0.5) * (Y1 - Y0) / ra, z), lon = J.xNaLon(X0 + (i + 0.5) * (X1 - X0) / sl, z);
      body.push([lat, ((lon + 540) % 360) - 180]);
    }
    const id = ++cisloDotazu;
    stavOblaku('Načítám předpověď oblačnosti…');
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + body.map(p => p[0].toFixed(3)).join(',') +
      '&longitude=' + body.map(p => p[1].toFixed(3)).join(',') + '&hourly=cloud_cover&forecast_days=3&timezone=GMT&timeformat=unixtime';
    try {
      const r = await fetch(url); if (!r.ok) throw new Error('Open-Meteo vrátil ' + r.status);
      const j = await r.json(); if (id !== cisloDotazu) return;
      const pole = Array.isArray(j) ? j : [j];
      mrizkaOblaku = { sl, ra, cas: pole[0].hourly.time, hodnoty: pole.map(p => p.hourly.cloud_cover),
        hranice: [[J.yNaLat(Y1, z), J.xNaLon(X0, z)], [J.yNaLat(Y0, z), J.xNaLon(X1, z)]], nacteno: new Date() };
      kresliOblaka(); stavOblaku('');
    } catch (e) { if (id === cisloDotazu) stavOblaku('Předpověď oblačnosti se nepodařilo načíst (' + e.message + '). Zkuste to později.', true); }
  }
  let zpravaOblaku = '', chybaOblaku = false;
  function stavOblaku(t, ch) { zpravaOblaku = t; chybaOblaku = !!ch; aktualizujStav(); }
  function indexHodiny() {
    if (!mrizkaOblaku) return -1;
    const cil = Math.floor(Date.now() / HOD) * 3600 + (+hodina.value) * 3600;
    return mrizkaOblaku.cas.findIndex(t => t >= cil);
  }
  function kresliOblaka() {
    if (nast.oblaka !== 'predpoved' || !mrizkaOblaku) return;
    const i = indexHodiny(); if (i < 0) return;
    const { sl, ra, hodnoty } = mrizkaOblaku;
    const c = document.createElement('canvas'); c.width = sl; c.height = ra;
    const ctx = c.getContext('2d'), img = ctx.createImageData(sl, ra);
    for (let k = 0; k < sl * ra; k++) {
      const v = hodnoty[k] ? hodnoty[k][i] : null, o = k * 4;
      img.data[o] = 205; img.data[o + 1] = 212; img.data[o + 2] = 224;
      img.data[o + 3] = Number.isFinite(v) ? Math.round(v / 100 * 220) : 0;
    }
    ctx.putImageData(img, 0, 0);
    // zvětšit s vyhlazením
    const v = document.createElement('canvas'); v.width = sl * 32; v.height = ra * 32;
    const vc = v.getContext('2d'); vc.imageSmoothingEnabled = true; vc.imageSmoothingQuality = 'high'; vc.drawImage(c, 0, 0, v.width, v.height);
    const url = v.toDataURL('image/png');
    if (vrstvaOblaku instanceof L.ImageOverlay) { vrstvaOblaku.setUrl(url); vrstvaOblaku.setBounds(L.latLngBounds(mrizkaOblaku.hranice)); }
    else { vrstvaOblaku?.remove(); vrstvaOblaku = L.imageOverlay(url, mrizkaOblaku.hranice, { pane: 'oblaka', opacity: 1, attribution: 'Oblačnost: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> (CC BY 4.0)' }).addTo(mapa); }
    const t = new Date(mrizkaOblaku.cas[i] * 1000);
    hodinaText.textContent = `${datum(t)} ${cas(t)}`;
  }
  function nastavOblaka() {
    vrstvaOblaku?.remove(); vrstvaOblaku = null; clearTimeout(casovacOblaku);
    $('#poleHodiny').classList.toggle('skryto', nast.oblaka !== 'predpoved');
    stavOblaku('');
    if (nast.oblaka === 'predpoved') {
      // výchozí čas předpovědi: nejbližších 22:00 (večer, kdy se pozoruje)
      const d = new Date(), h = (22 - d.getHours() + 24) % 24;
      hodina.value = String(Math.min(47, h));
      mrizkaOblaku = null; nactiMrizkuOblaku();
    }
    else if (nast.oblaka === 'modis') {
      const d = vcera();
      vrstvaOblaku = L.tileLayer(`${GIBS}MODIS_Terra_Cloud_Fraction_Night/default/${d}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
        { pane: 'oblaka', maxNativeZoom: 6, maxZoom: 14, opacity: 0.75, attribution: `Oblačnost: NASA MODIS Terra, noc ${d} (GIBS)` }).addTo(mapa);
      vrstvaOblaku.on('tileerror', () => stavOblaku('Část dlaždic MODIS chybí (data ještě nemusí být zpracovaná nebo služba neodpovídá).', true));
    }
    kresliLegendu();
  }
  volbaOblaku.addEventListener('change', () => { nast.oblaka = volbaOblaku.value; ulozNast(); nastavOblaka(); });
  hodina.addEventListener('input', kresliOblaka);
  mapa.on('moveend', () => {
    if (nast.oblaka !== 'predpoved') return;
    clearTimeout(casovacOblaku);
    casovacOblaku = setTimeout(nactiMrizkuOblaku, 900);     // šetrně k API: až po dokončení posunu
  });

  /* ----- stav a legenda ----- */
  function aktualizujStav() {
    const s = $('#stavMapy'); if (!s) return;
    const casti = [];
    let chyba = false;
    if (nast.vrstva === 'odhad') {
      if (cekajiciPole > 0) casti.push(`Počítám odhad jasu oblohy z dat VIIRS (zbývá ${cekajiciPole} ${cekajiciPole === 1 ? 'dlaždice' : cekajiciPole < 5 ? 'dlaždice' : 'dlaždic'})…`);
      else if (chybaPole) { casti.push('Data VIIRS se nepodařilo načíst: ' + chybaPole.message + '. Bez připojení k NASA GIBS vrstva odhadu nefunguje – uložená místa a astronomické výpočty fungují dál.'); chyba = true; }
      const pouzite = NOCI.filter(d => pouziteNoci.get(d).ok > 0);
      if (pouzite.length) casti.push(`Odhad (model) z mediánu nocí VIIRS: ${pouzite.map(d => datumDlouhe(new Date(d + 'T12:00Z'))).join(', ')}.`);
    }
    if (nast.vrstva === 'radiance') casti.push(`Radiance VIIRS DNB z noci ${datumDlouhe(new Date(NOCI[0] + 'T12:00Z'))} (zdroje světla, nikoli jas oblohy).`);
    if (nast.vrstva === 'bm2016') casti.push('Black Marble 2016 – roční kompozit, data jsou deset let stará.');
    if (zpravaOblaku) { casti.push(zpravaOblaku); chyba = chyba || chybaOblaku; }
    else if (nast.oblaka === 'predpoved' && mrizkaOblaku) casti.push(`Oblačnost: předpověď modelu (Open-Meteo), načteno ${cas(mrizkaOblaku.nacteno)}; mřížka 10 × 8 bodů – jemné detaily chybí.`);
    else if (nast.oblaka === 'modis') casti.push(`Oblačnost: pozorování MODIS Terra z noci ${datumDlouhe(new Date(vcera() + 'T12:00Z'))} (jeden přelet, ne aktuální stav).`);
    s.textContent = casti.join(' ');
    s.classList.toggle('chyba', chyba);
  }
  function gradientOdhadu() {
    const st = J.STUPNICE, rozsah = 22 - 17;
    return 'linear-gradient(to right,' + st.filter(s => s[0] >= 17).map(([m, c]) => `rgb(${c[0]},${c[1]},${c[2]}) ${((22 - m) / rozsah * 100).toFixed(1)}%`).join(',') + ')';
  }
  function kresliLegendu() {
    const L1 = $('#legenda'); L1.innerHTML = '';
    if (nast.vrstva === 'odhad') {
      const pos = m => ((22 - m) / 5 * 100);
      const okraje = [22, ...J.BORTLE.slice(0, 7).map(x => x.od), 17];
      L1.append(el('div', { text: 'Odhad zenitového jasu oblohy (mag/arcsec²; vyšší číslo = tmavší). Na mapě poloprůhledně; nejtmavší místa jsou průhledná.' }));
      L1.append(el('div', { class: 'pruh', style: `background:${gradientOdhadu()}` }));
      const st = el('div', { class: 'stupnice' });
      for (const m of [22, 21.5, 21, 20.5, 20, 19.5, 19, 18.5, 18, 17.5, 17]) st.append(el('span', { text: C(m, 1) }));
      L1.append(st);
      const bo = el('div', { class: 'bortle', 'aria-label': 'Orientační třídy Bortle' });
      for (let i = 0; i < 8; i++) {
        const sirka = pos(Math.max(17, okraje[i + 1])) - pos(Math.min(22, okraje[i]));
        if (sirka > 0) bo.append(el('span', { style: `flex:0 0 ${sirka}%`, text: J.textBortle(J.BORTLE[i].t), title: 'Bortle ' + J.textBortle(J.BORTLE[i].t) }));
      }
      L1.append(el('div', { text: 'Orientační třída Bortle:', style: 'margin-top:4px' }), bo);
    } else if (nast.vrstva === 'radiance') {
      const stops = [0, 1, 2, 5, 10, 20, 38.2].map(v => { const i = J.DOLNI.findIndex(x => x >= v); return [v, J.SEDI[Math.max(0, i)]]; });
      L1.append(el('div', { text: 'Radiance pozorovaná družicí směrem vzhůru, nW/(cm²·sr). Bílá = 38,2 a více (saturace barevné škály).' }));
      L1.append(el('div', { class: 'pruh', style: 'background:linear-gradient(to right,' + stops.map(([, g]) => `rgb(${g},${g},${g}) ${(g / 255 * 100).toFixed(1)}%`).join(',') + ')' }));
      const st = el('div', { class: 'stupnice', style: 'position:relative;height:1.2em;display:block' });
      for (const [v, g] of stops) st.append(el('span', { text: C(v, v % 1 ? 1 : 0), style: `position:absolute;left:${(g / 255 * 100).toFixed(1)}%;transform:translateX(-${g > 240 ? 100 : g < 15 ? 0 : 50}%)` }));
      L1.append(st);
    } else if (nast.vrstva === 'bm2016') {
      L1.append(el('div', { text: 'Black Marble 2016: vizualizační roční kompozit nočních světel (NASA Earth Observatory). Jas pixelů je upravený pro vzhled – nelze jej převést na radianci.' }));
    }
    if (nast.oblaka === 'predpoved') {
      L1.append(el('div', { text: 'Oblačnost (předpověď): průhledná = jasno, šedobílá = zataženo (0–100 %).', style: 'margin-top:8px' }));
      L1.append(el('div', { class: 'pruh', style: 'background:linear-gradient(to right, rgba(205,212,224,0), rgba(205,212,224,.86)), repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0/10px 10px' }));
      const st = el('div', { class: 'stupnice' }); for (const v of ['0 %', '25 %', '50 %', '75 %', '100 %']) st.append(el('span', { text: v })); L1.append(st);
    } else if (nast.oblaka === 'modis') {
      L1.append(el('div', { text: 'Podíl oblačnosti z MODIS (0–1), barevná škála NASA GIBS:', style: 'margin-top:8px' }));
      L1.append(el('img', { src: 'https://gibs.earthdata.nasa.gov/legends/MODIS_Cloud_Fraction_H.svg', alt: 'Legenda podílu oblačnosti MODIS 0 až 1', style: 'max-width:100%;height:auto;background:#fff;border-radius:4px;margin-top:4px' }));
    }
  }

  /* ---------------- značky na mapě ---------------- */
  const vrstvaZnacek = L.layerGroup().addTo(mapa);
  let znackaVyberu = null;
  const ikona = (cls, title) => L.divIcon({ className: '', html: `<div class="znacka ${cls}" title="${esc(title)}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
  function kresliZnacky() {
    vrstvaZnacek.clearLayers();
    for (const m of mista) {
      const z = L.marker([m.lat, m.lon], { icon: ikona(m.oblibene ? 'obl' : '', m.nazev), title: m.nazev, keyboard: true, riseOnHover: true });
      z.on('click', () => vyberMisto({ ...m }, false));
      z.addTo(vrstvaZnacek);
    }
  }
  let rezimZnacek = false;
  $('#rezimZnacky').addEventListener('click', e => { rezimZnacek = !rezimZnacek; e.currentTarget.setAttribute('aria-pressed', rezimZnacek); mapa.getContainer().style.cursor = rezimZnacek ? 'crosshair' : ''; });
  mapa.on('click', async e => {
    const lat = e.latlng.lat, lon = L.Util.wrapNum(e.latlng.lng, [-180, 180], true);
    if (rezimZnacek) {
      const nazev = await Dialog.zeptej('Název značky', `Značka ${mista.length + 1}`);
      if (nazev === null) return;
      const m = { id: noveId(), nazev: nazev.trim() || `Značka ${mista.length + 1}`, lat, lon, oblibene: false, porovnat: false, poznamka: '' };
      mista.push(m); ulozMista(); kresliZnacky(); kresliSeznam();
      vyberMisto({ ...m }, false);
    } else vyberMisto({ lat, lon, nazev: null }, false);
  });

  /* ---------------- vyhledávání (Nominatim) ---------------- */
  let posledniHledani = 0;
  const cacheHledani = new Map();
  function parsujSouradnice(t) {
    const s = t.trim().replace(/°/g, '');
    let m = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(s);
    if (!m) { const casti = s.split(/\s*;\s*|\s+/).filter(Boolean); if (casti.length === 2) m = [null, ...casti.map(x => x.replace(',', '.'))]; }
    if (!m) return null;
    const lat = +m[1], lon = +m[2];
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
  }
  $('#formHledani').addEventListener('submit', async e => {
    e.preventDefault();
    const q = $('#hledat').value.trim(), ul = $('#vysledkyHledani');
    if (!q) return;
    const s = parsujSouradnice(q);
    if (s) { ul.innerHTML = ''; mapa.setView([s.lat, s.lon], Math.max(mapa.getZoom(), 9)); vyberMisto({ ...s, nazev: null }, false); return; }
    if (q.length < 3) { Dialog.chyba('Zadejte alespoň 3 znaky.'); return; }
    let vys = cacheHledani.get(q);
    if (!vys) {
      // Nominatim usage policy: max. 1 dotaz za sekundu, žádné našeptávání
      const cekat = posledniHledani + 1100 - Date.now();
      if (cekat > 0) await new Promise(r => setTimeout(r, cekat));
      posledniHledani = Date.now();
      ul.innerHTML = '<li class="prazdne" style="padding:6px">Hledám…</li>';
      try {
        const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=cs&q=' + encodeURIComponent(q));
        if (!r.ok) throw new Error('Nominatim vrátil ' + r.status);
        vys = await r.json(); cacheHledani.set(q, vys);
      } catch (err) { ul.innerHTML = ''; ul.append(el('li', { class: 'prazdne', style: 'padding:6px', text: 'Vyhledávání se nezdařilo (' + err.message + '). Můžete zadat souřadnice, např. 50.08, 14.42.' })); return; }
    }
    ul.innerHTML = '';
    if (!vys.length) { ul.append(el('li', { class: 'prazdne', style: 'padding:6px', text: 'Nic nenalezeno.' })); return; }
    for (const v of vys) {
      ul.append(el('li', {}, el('button', { type: 'button', text: v.display_name, onclick: () => {
        const lat = +v.lat, lon = +v.lon;
        if (v.boundingbox) mapa.fitBounds([[+v.boundingbox[0], +v.boundingbox[2]], [+v.boundingbox[1], +v.boundingbox[3]]], { maxZoom: 11 });
        else mapa.setView([lat, lon], 10);
        ul.innerHTML = '';
        vyberMisto({ lat, lon, nazev: v.name || v.display_name.split(',')[0] }, false);
      } })));
    }
    ul.append(el('li', { class: 'prazdne', style: 'padding:4px 8px;font-size:.7rem', text: 'Vyhledávání: Nominatim, data © přispěvatelé OpenStreetMap (ODbL).' }));
  });

  /* ---------------- Měsíc – ikona ---------------- */
  function ikonaMesice(k, roste, vel = 34) {
    const r = vel / 2 - 2, c = vel / 2, rx = r * Math.abs(1 - 2 * k);
    const vnejsi = roste ? 1 : 0, vnitrni = k < 0.5 ? (roste ? 0 : 1) : (roste ? 1 : 0);
    const cesta = k < 0.005 ? '' : k > 0.995 ? `<circle cx="${c}" cy="${c}" r="${r}" fill="#f4eccb"/>` :
      `<path d="M${c} ${c - r} A${r} ${r} 0 0 ${vnejsi} ${c} ${c + r} A${rx.toFixed(2)} ${r} 0 0 ${vnitrni} ${c} ${c - r}Z" fill="#f4eccb"/>`;
    return `<svg class="mesic-ikona" viewBox="0 0 ${vel} ${vel}" role="img" aria-label="Fáze Měsíce, osvětleno ${Math.round(k * 100)} %"><circle cx="${c}" cy="${c}" r="${r}" fill="#2b2f3d" stroke="#888" stroke-width="1"/>${cesta}</svg>`;
  }
  const smer = az => ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'][Math.round(az / 45) % 8];

  /* ---------------- panel vybraného místa ---------------- */
  let poradiVyberu = 0;
  function vyberMisto(m, posun = true) {
    vybrane = m;
    if (posun) mapa.setView([m.lat, m.lon], Math.max(mapa.getZoom(), 9));
    if (znackaVyberu) znackaVyberu.setLatLng([m.lat, m.lon]);
    else znackaVyberu = L.marker([m.lat, m.lon], { icon: ikona('vyber', 'Vybrané místo'), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(mapa);
    kresliMisto();
    kresliNoci();
  }
  function ulozeneK(m) { return m.id ? mista.find(x => x.id === m.id) : mista.find(x => Math.abs(x.lat - m.lat) < 1e-6 && Math.abs(x.lon - m.lon) < 1e-6); }
  function kresliMisto() {
    const m = vybrane, box = $('#misto'), id = ++poradiVyberu;
    const ulozene = ulozeneK(m);
    const nazev = ulozene ? ulozene.nazev : (m.nazev || 'Vybraný bod');
    const tedy = new Date(), o = noc(m.lat, m.lon, 0), il = A.osvetleni(tedy), pm = A.polohaMesice(tedy, m.lat, m.lon);
    const n = o.noc, astro = n.astronomicky;
    const [r0, m0, d0] = nocDatum(m.lon, 0);
    const vm = A.vychodyMesice(n.od.getTime(), n.do.getTime(), m.lat, m.lon);
    const faze = A.fazeVObdobi(new Date(), 35).filter(f => f.faze === 0 || f.faze === 180).slice(0, 2);
    let astroText;
    if (astro.stav === 'normal') astroText = `${cas(astro.vecer)} – ${cas(astro.rano)} (${hodMin(o.minutNoci)})`;
    else if (astro.stav === 'nenastane') astroText = 'nenastane – Slunce neklesne pod −18° (letní bílé noci)';
    else if (astro.stav === 'cela') astroText = 'celý den (polární noc)';
    else astroText = 'jen částečně';
    const okno = o.intervaly.length ? o.intervaly.map(x => `${cas(x.od)}–${cas(x.do)}`).join(', ') + ` (${hodMin(o.minut)})` : 'žádné';
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:start;flex-wrap:wrap">
        <div><div style="font-weight:700;font-size:1rem;overflow-wrap:anywhere">${esc(nazev)}</div>
        <div class="pozn" style="margin:2px 0 0">${J.souradnice(m.lat, m.lon)}</div></div>
      </div>
      <div class="vysledky">
        <div class="box"><div class="popis">Jas oblohy v zenitu <span class="stitek" title="Modelový odhad, ne měření">odhad</span></div><div class="cislo" id="mOdhad">…</div><div class="dalsi" id="mOdhadDalsi">počítám z dat VIIRS</div></div>
        <div class="box"><div class="popis">Bortle <span class="stitek">orientačně</span></div><div class="cislo" id="mBortle">…</div><div class="dalsi" id="mBortleDalsi"></div></div>
        <div class="box"><div class="popis">Umělý / přirozený jas</div><div class="cislo" id="mPomer">…</div><div class="dalsi" id="mPomerDalsi"></div></div>
        <div class="box"><div class="popis">Nadmořská výška</div><div class="cislo" id="mVyska">…</div><div class="dalsi">Copernicus DEM 90 m (Open-Meteo)</div></div>
      </div>
      <div class="pozn" id="mVarovani"></div>
      <h3>Měsíc teď</h3>
      <div class="mesic-radek">${ikonaMesice(il.k, il.roste)}
        <div style="font-size:.82rem;line-height:1.45">${A.nazevFaze(il.uhelFaze)}, osvětleno ${C(il.k * 100, 0)} %<br>
        ${pm.altZdanliva > -0.3 ? `nad obzorem: výška ${C(pm.altZdanliva, 1)}°, azimut ${C(pm.az, 0)}° (${smer(pm.az)})` : `pod obzorem (výška ${C(pm.altTopo, 1)}°)`}</div></div>
      <div class="pozn">Další ${faze.map(f => `${f.nazev} ${datum(f.cas)} ${cas(f.cas)}`).join(', ')}.</div>
      <h3>Noc ${datum(new Date(Date.UTC(r0, m0, d0, 12)))} → ${datum(new Date(Date.UTC(r0, m0, d0 + 1, 12)))}</h3>
      <dl class="seznam-casu">
        <dt>Západ Slunce</dt><dd>${cas(n.zapad.vecer)}</dd>
        <dt>Konec nautického soumraku</dt><dd>${cas(n.nauticky.vecer)}</dd>
        <dt>Astronomická noc (−18°)</dt><dd>${astroText}</dd>
        <dt>Měsíc</dt><dd>${vm.length ? vm.map(x => `${x.druh} ${cas(x.cas)}`).join(', ') : (A.mesicNadObzorem(n.od.getTime() + DEN / 2, m.lat, m.lon) > 0 ? 'celou noc nad obzorem' : 'celou noc pod obzorem')}</dd>
        <dt>Tmavé okno <span class="pozn">(astr. noc bez Měsíce)</span></dt><dd><b>${okno}</b></dd>
        <dt>Oblačnost v okně</dt><dd id="mOblaka">…</dd>
        <dt>Východ Slunce</dt><dd>${cas(n.zapad.rano)}</dd>
      </dl>
      <div class="pozn">Časy v časovém pásmu zařízení (${esc(TZ)}). Soumraky geometricky (střed Slunce −6°, −12°, −18°).</div>
      <div class="tlacitka">
        ${ulozene ? '' : '<button type="button" class="hlavni" data-akce="ulozit">📍 Uložit značku</button>'}
        <button type="button" data-akce="oblibene" aria-pressed="${ulozene && ulozene.oblibene ? 'true' : 'false'}">★ Oblíbené</button>
        <button type="button" data-akce="porovnat" aria-pressed="${ulozene && ulozene.porovnat ? 'true' : 'false'}">⇄ Porovnat</button>
        <button type="button" data-akce="mapa">Na mapě</button>
      </div>`;
    box.querySelectorAll('[data-akce]').forEach(b => b.addEventListener('click', () => akceMista(b.dataset.akce)));
    // asynchronní části
    odhadMista(m.lat, m.lon).then(v => {
      if (id !== poradiVyberu) return;
      $('#mOdhad').textContent = `${C(v.mag, 2)} mag/arcsec²`;
      $('#mOdhadDalsi').textContent = `rozsah ${C(v.mMax, 1)}–${C(v.mMin, 1)} (±${C(J.MODEL.NEJISTOTA_MAG, 1)}); medián nocí ${v.noci.map(d => d.slice(8, 10) + '. ' + (+d.slice(5, 7)) + '.').join(', ')}`;
      $('#mBortle').textContent = v.bortleRozsah.map(J.textBortle).join('–');
      $('#mBortleDalsi').textContent = (J.BORTLE.find(b => b.t === v.bortle) || {}).nazev || '';
      $('#mPomer').textContent = v.pomer < 0.01 ? '< 1 %' : v.pomer < 10 ? `${C(v.pomer * 100, 0)} %` : `${C(v.pomer, 0)}×`;
      $('#mPomerDalsi').textContent = J.kategoriePomeru(v.pomer);
      const varov = [];
      if (v.satOkoli > 0.02) varov.push('V okolí jsou pixely nad hranicí škály (38,2 nW/(cm²·sr)) – jas ve městě je spíše podhodnocený.');
      if (v.chybiOkoli > 0.2) varov.push('Pro část okolí chybí data VIIRS – odhad je méně spolehlivý.');
      if (v.podilDo10km > 0.6) varov.push(`${C(v.podilDo10km * 100, 0)} % odhadovaného umělého jasu pochází ze světel do 10 km – stačí se kousek vzdálit nebo schovat za terén.`);
      if (Math.abs(m.lat) > 60) varov.push('Ve vysokých zeměpisných šířkách mohou data ovlivnit polární záře a světlé noci.');
      $('#mVarovani').innerHTML = varov.map(t => `<span class="varovani">⚠ ${esc(t)}</span>`).join('<br>');
      if (ulozene) { ulozene.odhad = v; ulozMista(); kresliPorovnani(); }
    }, e => {
      if (id !== poradiVyberu) return;
      $('#mOdhad').textContent = 'nedostupný'; $('#mOdhadDalsi').textContent = e.message;
      $('#mBortle').textContent = '—'; $('#mPomer').textContent = '—';
    });
    vyskaMista(m.lat, m.lon).then(v => {
      if (id !== poradiVyberu) return;
      $('#mVyska').textContent = `${C(v, 0)} m n. m.`;
      if (ulozene && ulozene.vyska !== v) { ulozene.vyska = v; ulozMista(); kresliSeznam(); }
    }, () => { if (id === poradiVyberu) $('#mVyska').textContent = 'nedostupná'; });
    pocasiMista(m.lat, m.lon).then(h => {
      if (id !== poradiVyberu) return;
      const okn = o.intervaly.length ? o.intervaly : intervalyNoci(o);
      const cc = prumerVOkne(h, 'cloud_cover', okn);
      if (cc === null) { $('#mOblaka').textContent = okn.length ? 'mimo rozsah předpovědi' : '—'; return; }
      const nizka = prumerVOkne(h, 'cloud_cover_low', okn), vlh = prumerVOkne(h, 'relative_humidity_2m', okn), vitr = prumerVOkne(h, 'wind_speed_10m', okn);
      $('#mOblaka').innerHTML = `<b>${C(cc, 0)} %</b> <span class="pozn">(nízká ${C(nizka, 0)} %, vlhkost ${C(vlh, 0)} %, vítr ${C(vitr, 1)} m/s; předpověď, ne pozorování)</span>`;
    }, () => { if (id === poradiVyberu) $('#mOblaka').textContent = 'předpověď nedostupná'; });
  }
  async function akceMista(a) {
    const m = vybrane; let u = ulozeneK(m);
    if (a === 'mapa') { mapa.setView([m.lat, m.lon], Math.max(mapa.getZoom(), 10)); return; }
    if (!u) {
      const navrh = m.nazev || `Místo ${mista.length + 1}`;
      const nazev = a === 'ulozit' ? await Dialog.zeptej('Název místa', navrh) : navrh;
      if (nazev === null) return;
      u = { id: noveId(), nazev: nazev.trim() || navrh, lat: m.lat, lon: m.lon, oblibene: false, porovnat: false, poznamka: '' };
      mista.push(u);
      odhadMista(m.lat, m.lon).then(v => { u.odhad = v; ulozMista(); kresliPorovnani(); kresliSeznam(); }, () => {});
      vyskaMista(m.lat, m.lon).then(v => { u.vyska = v; ulozMista(); kresliSeznam(); kresliPorovnani(); }, () => {});
    }
    if (a === 'oblibene') u.oblibene = !u.oblibene;
    if (a === 'porovnat') u.porovnat = !u.porovnat;
    vybrane = { ...u };
    ulozMista(); kresliZnacky(); kresliSeznam(); kresliPorovnani(); kresliMisto();
    if (a === 'porovnat' && u.porovnat) Dialog.info('Přidáno do porovnání');
  }

  /* ---------------- kalendář nocí ---------------- */
  async function kresliNoci() {
    const m = vybrane, box = $('#noci'); if (!m) return;
    const id = poradiVyberu;
    const noci = Array.from({ length: 30 }, (_, i) => noc(m.lat, m.lon, i));
    const faze = A.fazeVObdobi(new Date(Date.now() - DEN), 32);
    const OKNO_OD = 4, OKNO_DO = 20;                  // zobrazit 16:00–08:00 místního středního času (h od poledne)
    const pozice = (n, t) => ((t - n.noc.od.getTime()) / HOD - OKNO_OD) / (OKNO_DO - OKNO_OD) * 100;
    const usek = (n, a, b, cls, title) => {
      let x0 = pozice(n, a.getTime()), x1 = pozice(n, b.getTime());
      x0 = Math.max(0, x0); x1 = Math.min(100, x1); if (x1 <= x0) return '';
      return `<span class="${cls}" style="left:${x0.toFixed(2)}%;width:${(x1 - x0).toFixed(2)}%"${title ? ` title="${esc(title)}"` : ''}></span>`;
    };
    let h = null;
    const vykresli = () => {
      if (id !== poradiVyberu) return;
      const ted = Date.now();
      let html = '<div class="noci" role="list">';
      noci.forEach((o, i) => {
        const n = o.noc, a = n.astronomicky, z = n.zapad;
        let osa = '';
        if (z.vecer && a.vecer) osa += usek(o, z.vecer, a.vecer, 'soumrak', 'soumrak');
        if (a.rano && z.rano) osa += usek(o, a.rano, z.rano, 'soumrak', 'soumrak');
        if (a.stav === 'nenastane' && z.vecer && z.rano) osa += usek(o, z.vecer, z.rano, 'soumrak', 'soumrak – astronomická noc nenastane');
        const ai = intervalyNoci(o);
        if (a.stav === 'cela') ai.push({ od: n.od, do: n.do });
        for (const x of ai) osa += usek(o, x.od, x.do, o.minutSMesicem > 1 ? 'mesic' : 'astro', o.minutSMesicem > 1 ? 'astronomická noc, Měsíc nad obzorem' : 'astronomická noc');
        for (const x of o.intervaly) osa += usek(o, x.od, x.do, 'tma', `tmavé okno ${cas(x.od)}–${cas(x.do)}`);
        let mraky = null;
        if (h && h.time) {
          for (let k = 0; k < h.time.length; k++) {
            const t0 = h.time[k] * 1000;
            if (t0 < n.od.getTime() || t0 >= n.do.getTime()) continue;
            const v = h.cloud_cover[k]; if (!Number.isFinite(v)) continue;
            const x0 = Math.max(0, pozice(o, t0)), x1 = Math.min(100, pozice(o, t0 + HOD));
            if (x1 > x0 && v > 5) osa += `<span class="mrak" style="left:${x0.toFixed(2)}%;width:${(x1 - x0).toFixed(2)}%;opacity:${(v / 100).toFixed(2)}"></span>`;
          }
          const okn = o.intervaly.length ? o.intervaly : ai;
          mraky = prumerVOkne(h, 'cloud_cover', okn);
        }
        if (ted > n.od.getTime() && ted < n.do.getTime()) osa += `<span class="ted" style="left:${pozice(o, ted).toFixed(2)}%" title="teď"></span>`;
        const f = faze.find(x => x.cas >= n.od && x.cas < n.do);
        const dobra = o.minut >= 180 && (mraky === null || mraky < 35);
        const den = new Date(n.od.getTime() + 12 * HOD - (m.lon / 15) * HOD);
        html += `<div class="noc${dobra ? ' dobra' : ''}" role="listitem">
          <div class="dat"><b>${datum(new Date(n.od.getTime() + m.lon / 15 * HOD))}</b>${f ? ` <span title="${esc(f.nazev)} ${cas(f.cas)}">${['🌑', '🌓', '🌕', '🌗'][f.faze / 90]}</span>` : ''}</div>
          <div class="osa" aria-hidden="true">${osa}</div>
          <div class="info">${o.minut > 0 ? `${dobra ? '★ ' : ''}tma ${hodMin(o.minut)}` : (a.stav === 'nenastane' ? 'bez astr. noci' : 'Měsíc celou noc')}
            · ☾ ${C(o.osvetleni ? o.osvetleni.k * 100 : A.osvetleni(den).k * 100, 0)} %${mraky !== null ? ` · ☁ ${C(mraky, 0)} %` : ''}</div>
        </div>`;
      });
      html += '</div>';
      html += `<div class="klic-osy"><span><i style="background:#3c4a78"></i>soumrak</span><span><i style="background:#1d2547"></i>astronomická noc</span>
        <span><i style="background:repeating-linear-gradient(45deg,#9a8d4a 0 3px,#6d6435 3px 6px)"></i>Měsíc nad obzorem</span>
        <span><i style="background:#0a0d1c;box-shadow:inset 0 0 0 1px #6aa6fd"></i>tmavé okno</span><span><i style="background:#d8dde6"></i>oblačnost (předpověď, 7 dní)</span>
        <span><i style="background:#ff6b6b"></i>teď</span></div>
        <p class="pozn">Osa každé noci ukazuje zhruba 16:00–08:00 místního slunečního času. ★ = alespoň 3 h tmavého okna a (je-li k dispozici předpověď) průměrná oblačnost pod 35 %.
        Nejvhodnější období jsou kolem novu; v okolí letního slunovratu astronomická noc v ČR nenastává (přibližně od konce května do poloviny července).
        Oblačnost je předpověď modelu Open-Meteo, po 2–3 dnech výrazně méně spolehlivá.</p>`;
      box.innerHTML = html;
    };
    vykresli();
    try { h = await pocasiMista(m.lat, m.lon); vykresli(); } catch { /* bez předpovědi */ }
  }

  /* ---------------- porovnání ---------------- */
  let razeni = { sloupec: 'mag', smer: -1 };
  const detailyPorovnani = new Map();
  function kresliPorovnani() {
    const box = $('#porovnani'), sada = mista.filter(m => m.porovnat);
    if (!sada.length) { box.innerHTML = '<p class="prazdne">Zatím nic k porovnání. Vyberte místo a stiskněte „⇄ Porovnat“.</p>'; return; }
    const radky = sada.map(m => {
      const o = noc(m.lat, m.lon, 0);
      const k = m.id + o.noc.od.getTime();
      const d = detailyPorovnani.get(k) || {};
      if (!detailyPorovnani.has(k)) {
        detailyPorovnani.set(k, d);
        pocasiMista(m.lat, m.lon).then(h => { d.mraky = prumerVOkne(h, 'cloud_cover', o.intervaly.length ? o.intervaly : intervalyNoci(o)); kresliPorovnani(); }, () => { d.mraky = undefined; });
        if (!m.odhad) odhadMista(m.lat, m.lon).then(v => { m.odhad = v; ulozMista(); kresliPorovnani(); }, () => {});
        if (!Number.isFinite(m.vyska)) vyskaMista(m.lat, m.lon).then(v => { m.vyska = v; ulozMista(); kresliPorovnani(); kresliSeznam(); }, () => {});
      }
      return { m, mag: m.odhad ? m.odhad.mag : NaN, vyska: Number.isFinite(m.vyska) ? m.vyska : NaN, tma: o.minut, mesic: o.osvetleni ? o.osvetleni.k : NaN, mraky: d.mraky ?? NaN,
        vzd: vybrane ? J.vzdalenostKm(vybrane, m) : NaN };
    });
    const s = razeni.sloupec;
    radky.sort((a, b) => {
      const x = s === 'nazev' ? a.m.nazev.localeCompare(b.m.nazev, 'cs') : (Number.isFinite(a[s]) ? a[s] : -Infinity) - (Number.isFinite(b[s]) ? b[s] : -Infinity);
      return razeni.smer * x;
    });
    const nejlepsi = radky.reduce((b, r) => Number.isFinite(r.mag) && (!b || r.mag > b.mag) ? r : b, null);
    const hl = (k, t, title) => `<th${k === 'nazev' ? ' class="vlevo"' : ''}${title ? ` title="${esc(title)}"` : ''}><button type="button" class="razeni" data-s="${k}">${t}${razeni.sloupec === k ? (razeni.smer > 0 ? ' ▲' : ' ▼') : ''}</button></th>`;
    box.innerHTML = `<div class="obal-tab"><table>
      <thead><tr>${hl('nazev', 'Místo')}${hl('mag', 'Jas oblohy (odhad)', 'mag/arcsec², vyšší = tmavší; nejistota ±0,5')}<th>Bortle (orient.)</th>
      ${hl('vyska', 'Výška')}${hl('tma', 'Tmavé okno dnes')}${hl('mesic', 'Měsíc')}${hl('mraky', 'Oblačnost v okně', 'předpověď Open-Meteo pro nejbližší noc')}${hl('vzd', 'Od vybraného')}<th></th></tr></thead>
      <tbody>${radky.map(r => `<tr${r === nejlepsi && radky.length > 1 ? ' class="nejlepsi" title="nejtmavší odhad"' : ''}>
        <td class="zalom"><button type="button" class="male" data-jdi="${r.m.id}" style="text-align:left">${r.m.oblibene ? '★ ' : ''}${esc(r.m.nazev)}</button></td>
        <td>${Number.isFinite(r.mag) ? `${C(r.mag, 2)} <span class="pozn">(${C(r.m.odhad.mMax, 1)}–${C(r.m.odhad.mMin, 1)})</span>` : '…'}</td>
        <td>${r.m.odhad ? r.m.odhad.bortleRozsah.map(J.textBortle).join('–') : '…'}</td>
        <td>${Number.isFinite(r.vyska) ? C(r.vyska, 0) + ' m' : '…'}</td>
        <td>${hodMin(r.tma)}</td>
        <td>${Number.isFinite(r.mesic) ? C(r.mesic * 100, 0) + ' %' : '—'}</td>
        <td>${Number.isFinite(r.mraky) ? C(r.mraky, 0) + ' %' : '…'}</td>
        <td>${Number.isFinite(r.vzd) ? C(r.vzd, r.vzd < 10 ? 1 : 0) + ' km' : '—'}</td>
        <td><button type="button" class="male" data-odeber="${r.m.id}" title="Odebrat z porovnání" aria-label="Odebrat ${esc(r.m.nazev)} z porovnání">✕</button></td></tr>`).join('')}</tbody></table></div>
      <p class="pozn">Jas je modelový odhad (nejistota ±0,5 mag/arcsec²), rozdíly pod ~0,3 mag nejsou průkazné. Vyšší nadmořská výška obvykle znamená méně oparu
        a inverzní mlhy pod sebou, model ji ale nezahrnuje.</p>`;
    box.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => {
      razeni = { sloupec: b.dataset.s, smer: razeni.sloupec === b.dataset.s ? -razeni.smer : (b.dataset.s === 'nazev' || b.dataset.s === 'mesic' || b.dataset.s === 'mraky' || b.dataset.s === 'vzd' ? 1 : -1) };
      kresliPorovnani();
    }));
    box.querySelectorAll('[data-jdi]').forEach(b => b.addEventListener('click', () => { const m = mista.find(x => x.id === b.dataset.jdi); if (m) vyberMisto({ ...m }); }));
    box.querySelectorAll('[data-odeber]').forEach(b => b.addEventListener('click', () => { const m = mista.find(x => x.id === b.dataset.odeber); if (m) { m.porovnat = false; ulozMista(); kresliPorovnani(); if (vybrane && vybrane.id === m.id) kresliMisto(); } }));
  }

  /* ---------------- seznam značek a oblíbených ---------------- */
  const jenObl = $('#jenOblibene');
  jenObl.checked = !!nast.jenObl;
  jenObl.addEventListener('change', () => { nast.jenObl = jenObl.checked; ulozNast(); kresliSeznam(); });
  function kresliSeznam() {
    const ul = $('#seznamMist'); ul.innerHTML = '';
    const sada = mista.filter(m => !nast.jenObl || m.oblibene);
    if (!sada.length) { ul.append(el('li', { class: 'prazdne', style: 'display:block;background:none;border:0', text: nast.jenObl ? 'Žádná oblíbená místa.' : 'Zatím žádné značky. Uložte vybrané místo nebo zapněte „📍 Přidávat značky“ a klikněte do mapy.' })); return; }
    for (const m of sada) {
      const det = [J.souradnice(m.lat, m.lon)];
      if (Number.isFinite(m.vyska)) det.push(`${C(m.vyska, 0)} m n. m.`);
      if (m.odhad && Number.isFinite(m.odhad.mag)) det.push(`odhad ${C(m.odhad.mag, 2)} mag/arcsec², Bortle ~${m.odhad.bortleRozsah.map(J.textBortle).join('–')}`);
      const li = el('li', {},
        el('button', { type: 'button', class: 'hvezda', 'aria-pressed': m.oblibene ? 'true' : 'false', title: m.oblibene ? 'Odebrat z oblíbených' : 'Přidat do oblíbených', 'aria-label': 'Oblíbené: ' + m.nazev, text: '★',
          onclick: () => { m.oblibene = !m.oblibene; ulozMista(); kresliZnacky(); kresliSeznam(); kresliPorovnani(); if (vybrane && vybrane.id === m.id) kresliMisto(); } }),
        el('div', {}, el('div', { class: 'jmeno', text: m.nazev }), el('div', { class: 'detail', text: det.join(' · ') }), m.poznamka ? el('div', { class: 'detail', text: m.poznamka }) : null),
        el('div', { class: 'akce' },
          el('button', { type: 'button', class: 'male', text: 'Ukázat', onclick: () => vyberMisto({ ...m }) }),
          el('button', { type: 'button', class: 'male', 'aria-pressed': m.porovnat ? 'true' : 'false', text: '⇄', title: 'Porovnat', 'aria-label': 'Porovnat ' + m.nazev,
            onclick: () => { m.porovnat = !m.porovnat; ulozMista(); kresliSeznam(); kresliPorovnani(); } }),
          el('button', { type: 'button', class: 'male', text: '✎', title: 'Přejmenovat / poznámka', 'aria-label': 'Upravit ' + m.nazev, onclick: async () => {
            const n = await Dialog.zeptej('Název místa', m.nazev); if (n === null) return;
            const p = await Dialog.zeptej('Poznámka (nepovinné)', m.poznamka || ''); m.nazev = n.trim() || m.nazev; if (p !== null) m.poznamka = p.trim();
            ulozMista(); kresliZnacky(); kresliSeznam(); kresliPorovnani(); if (vybrane && vybrane.id === m.id) { vybrane = { ...m }; kresliMisto(); }
          } }),
          el('button', { type: 'button', class: 'male', text: '🗑', title: 'Smazat', 'aria-label': 'Smazat ' + m.nazev, onclick: async () => {
            if (!(await Dialog.potvrd(`Smazat „${m.nazev}“?`))) return;
            mista = mista.filter(x => x !== m); ulozMista(); kresliZnacky(); kresliSeznam(); kresliPorovnani();
            if (vybrane && vybrane.id === m.id) { delete vybrane.id; kresliMisto(); }
          } })));
      ul.append(li);
    }
  }
  function stahni(text, nazev, typ) {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: typ })), download: nazev });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const proExport = () => mista.filter(m => !nast.jenObl || m.oblibene);
  const dnes = () => new Date().toISOString().slice(0, 10);
  $('#exportGpx').addEventListener('click', () => { const s = proExport(); if (!s.length) return Dialog.chyba('Není co exportovat.'); stahni(J.exportGpx(s), `tmava-obloha-${dnes()}.gpx`, 'application/gpx+xml'); });
  $('#exportJson').addEventListener('click', () => { const s = proExport(); if (!s.length) return Dialog.chyba('Není co exportovat.'); stahni(J.exportJson(s), `tmava-obloha-${dnes()}.json`, 'application/json'); });
  $('#importBtn').addEventListener('click', () => $('#importSoubor').click());
  $('#importSoubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 5e6) return Dialog.chyba('Soubor je příliš velký (max. 5 MB).');
    try {
      const { mista: nova, vyrazeno } = J.importText(await f.text());
      let pridano = 0;
      for (const n of nova) {
        if (mista.some(m => Math.abs(m.lat - n.lat) < 1e-5 && Math.abs(m.lon - n.lon) < 1e-5)) continue;
        mista.push({ id: noveId(), porovnat: false, ...n }); pridano++;
      }
      ulozMista(); kresliZnacky(); kresliSeznam();
      Dialog.info(`Importováno ${pridano} míst${vyrazeno ? `, ${vyrazeno} neplatných vyřazeno` : ''}${nova.length - pridano ? `, ${nova.length - pridano} duplicit přeskočeno` : ''}.`);
      if (pridano) mapa.fitBounds(L.latLngBounds(nova.map(n => [n.lat, n.lon])).pad(0.2), { maxZoom: 10 });
    } catch (err) { Dialog.chyba('Import selhal: ' + err.message); }
  });

  /* ---------------- tabulky Bortle a zdrojů ---------------- */
  (function () {
    const t = $('#tabBortle');
    let h = '<thead><tr><th>Třída</th><th class="vlevo">Název</th><th>SQM (mag/arcsec²)</th><th>MHV</th><th class="zalom vlevo">Co je vidět</th></tr></thead><tbody>';
    J.BORTLE.forEach((b, i) => {
      const horni = i === 0 ? '22,0' : C(J.BORTLE[i - 1].od, 2);
      const sqm = i === 0 ? `≥ ${C(b.od, 2)}` : b.od === -Infinity ? `< ${horni}` : `${C(b.od, 2)}–${horni}`;
      h += `<tr><td>${J.textBortle(b.t)}</td><td class="vlevo">${b.nazev}</td><td>${sqm}</td><td>${b.mhv}</td><td class="zalom vlevo">${b.popis}</td></tr>`;
    });
    t.innerHTML = h + '</tbody>';
    const z = $('#tabZdroje'), a = (u, t) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
    const r = [
      ['Odhad jasu oblohy (vrstva i bod)', `NASA Black Marble VNP46A2 – VIIRS DNB „Gap-Filled BRDF-Corrected“ radiance (Suomi NPP), dlaždice z ${a('https://nasa-gibs.github.io/gibs-api-docs/', 'NASA GIBS')}; převod barvy na radianci podle colormapy GIBS`,
        `Medián nocí ${NOCI.map(d => datumDlouhe(new Date(d + 'T12:00Z'))).join(', ')} (data mají zpoždění ~2–3 dny; chybějící noci se přeskočí)`,
        'Data 15″ (~500 m), použito na zoomu 7 (~0,8 km/px na 50° s. š.)',
        'NASA – otevřená data bez omezení užití; citace GIBS/ESDIS',
        'Radiance ≠ jas oblohy. Saturace barevné škály nad 38,2 nW/(cm²·sr) (centra měst podhodnocena). Pásmo DNB 500–900 nm téměř nevidí modrou složku bílých LED. Sníh, mraky (výplň mezer), polární záře. Model šíření (Walkerův zákon) nezohledňuje terén ani atmosféru.'],
      ['Kalibrace modelu', 'Orientační zenitové hodnoty SQM pro 9 míst v ČR (oblasti tmavé oblohy Jizerka, Manětín, Beskydy; Šumava, Ondřejov; centra Prahy, Brna, Ostravy, Plzně) z veřejně uváděných měření',
        'Měření z let ~2015–2024', '1 volný parametr, RMS 0,14 mag', '—', 'Kalibrační body jsou přibližné (±0,2–0,3 mag) a jen ze střední Evropy; jinde (jiné osvětlení, klima) může být chyba větší. Proto nejistota ±0,5 mag.'],
      ['Radiance VIIRS (vrstva „zdroje světla“)', 'Stejný produkt, jedna noc', NOCI[0], '~500 m (max. zoom dlaždic 8)', 'NASA – otevřená data', 'Jedna noc – mohou být vidět mraky, šum a výplň mezer.'],
      ['Black Marble 2016', 'NASA Earth Observatory, roční kompozit VIIRS', '2016 (10 let staré)', '~500 m', 'NASA – otevřená data', 'Vizualizace s upraveným jasem, ne radiance; nové osvětlení (LED) chybí.'],
      ['Oblačnost – předpověď', `${a('https://open-meteo.com', 'Open-Meteo')} Forecast API (cloud_cover, nízká/střední/vysoká), „best match“ modelů (pro ČR hlavně DWD ICON)`, 'Aktualizace modelů několikrát denně; načítá se živě', '1–11 km podle modelu; ve vrstvě mřížka 10 × 8 bodů', 'CC BY 4.0 (Open-Meteo), zdrojové modely podle jejich licencí', 'Předpověď, ne pozorování. Po 2–3 dnech spolehlivost oblačnosti rychle klesá. Lokální mlhy a inverze model často mine.'],
      ['Oblačnost – pozorování', 'NASA MODIS Terra Cloud Fraction (Night) přes GIBS', 'Předchozí noc (jeden přelet kolem 22:30 místního času)', '5 km (produkt MOD06), dlaždice zoom ≤ 6', 'NASA – otevřená data', 'Jen okamžik přeletu, mezery mezi drahami; nejde o aktuální stav.'],
      ['Nadmořská výška', 'Open-Meteo Elevation API – Copernicus DEM GLO-90', 'DEM 2011–2015', '90 m', 'Copernicus DEM © DLR e.V. 2010–2014 a © Airbus Defence and Space GmbH 2014–2018, poskytnuto v rámci programu Copernicus EU a ESA; API CC BY 4.0', 'Výška terénu, ne horizontu; zakrytí obzoru kopci se nepočítá.'],
      ['Vyhledávání míst', `${a('https://nominatim.org', 'Nominatim')} nad daty ${a('https://www.openstreetmap.org/copyright', 'OpenStreetMap')}`, 'Živě', '—', 'ODbL; dodržujeme pravidla použití (max. 1 dotaz/s, bez našeptávání, s mezipamětí)', 'Při výpadku lze zadat souřadnice ručně.'],
      ['Měsíc, Slunce, soumraky', 'Výpočet v prohlížeči podle J. Meeus: Astronomical Algorithms (1998)', 'Počítá se pro zvolený čas', '—', 'vlastní kód', 'Fáze ±2 min, polohy ±0,02°; refrakce u obzoru se mění s počasím (±1–2 min u východů).'],
      ['Nepoužito', `Atlas umělého jasu oblohy ${a('https://doi.org/10.5880/GFZ.1.4.2016.001', 'Falchi et al. 2016')} a dlaždice ${a('https://www.lightpollutionmap.info', 'lightpollutionmap.info')}`, 'Atlas: data 2014', '30″', 'Data atlasu: CC BY-NC 4.0 (nekomerční); dlaždice služby mají vlastní podmínky', 'Kvůli licenci je stránka nepřebírá – pro srovnání otevřete odkazy. Atlas je přesnější model, ale starý (před masivním přechodem na LED).'],
    ];
    z.innerHTML = '<thead><tr><th>Co</th><th>Zdroj</th><th>Stáří</th><th>Rozlišení</th><th>Licence</th><th>Omezení</th></tr></thead><tbody>' +
      r.map(x => '<tr>' + x.map(y => `<td>${y}</td>`).join('') + '</tr>').join('') + '</tbody>';
    $('#popisModelu').innerHTML = `
      <ol style="padding-left:18px;margin:4px 0">
        <li>Pro okolí ${J.MODEL.R_MAX_KM} km se stáhnou dlaždice radiance VIIRS z několika nocí a v každém pixelu se vezme medián (potlačí mraky a šum).</li>
        <li>Odečte se „podlaha“ ${C(J.MODEL.PODLAHA, 2)} nW/(cm²·sr) (šum senzoru, airglow, odraz).</li>
        <li>Každý pixel se bere jako zdroj světla, jehož příspěvek k jasu v zenitu klesá se vzdáleností d jako (d² + ${J.MODEL.D0_KM}²)<sup>−1,25</sup>
          (Walkerův zákon: jas ∝ d<sup>−2,5</sup>; Walker 1977, Garstang 1986).</li>
        <li>Součet se převede jednou konstantou na jas v mcd/m²; konstanta je nastavená podle 9 přibližných měření SQM v ČR.</li>
        <li>Přičte se přirozený jas oblohy 0,171 mcd/m² (22,0 mag/arcsec²) a převede se na mag/arcsec²: m = 20,08 − 2,5·log<sub>10</sub>(L [mcd/m²]).</li>
        <li>Mapová vrstva počítá totéž rychleji – jádro je nahrazené součtem 10 Gaussových rozmazání (odchylka od přesného součtu do ~5 %).</li>
      </ol>
      Model nezná: směrování a spektrum svítidel, terén a stínění kopci, výšku místa, opar, sníh, aktuální osvětlení (vypínání v noci), Měsíc a oblačnost konkrétní noci.
      Na velmi tmavých místech je výsledek citlivý na airglow a na šum dat, ve městech na saturaci barevné škály.`;
  })();

  /* ---------------- start ---------------- */
  kresliZnacky(); kresliSeznam(); kresliPorovnani();
  nastavVrstvu(); nastavOblaka();
  // pro testy a ladění
  window.SZ_APP = { mapa, vyberMisto, odhadMista, get mista() { return mista; }, akceMista, NOCI, nast };
})();
