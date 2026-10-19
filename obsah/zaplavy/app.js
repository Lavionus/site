/* ============================================================
   zaplavy/app.js – uživatelské rozhraní stránky obsah/zaplavy.html
   (mapa Leaflet, načítání DEM, vykreslení, nástroje, export).
   Výpočty jsou v zaplavy/jadro.js, čtení rastrů v rastry.js,
   souřadnicové systémy v projekce.js.
   ============================================================ */
(function () {
  'use strict';
  const J = window.ZaplavyJadro, P = window.ZaplavyProjekce, RS = window.ZaplavyRastry, A = window.ZaplavyAnalyzy;
  const $ = id => document.getElementById(id);
  const LS = 'webapp_zaplavy_';
  const CUZK_URL = 'https://ags.cuzk.cz/arcgis2/rest/services/dmr5g/ImageServer/exportImage';
  const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
  const CUZK_BLOK = 2048;
  const ATRIB = {
    cuzk: 'Výšky: <a href="https://geoportal.cuzk.cz/" target="_blank" rel="noopener">© ČÚZK</a> DMR 5G (CC BY 4.0)',
    terrarium: 'Výšky: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a> (Mapzen/Tilezen) – EU-DEM © Copernicus, SRTM/GMTED © USGS, ETOPO1 © NOAA a <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">další</a>',
    soubor: 'Výšky: importovaný soubor',
    demo: 'Výšky: smyšlený demonstrační terén'
  };
  const ZDROJE_TT = {
    eudem: 'EU-DEM v1.0 (Copernicus), ~30 m, EVRS2000', srtm: 'SRTM (NASA/USGS), 1″ ≈ 30 m, EGM96', gmted: 'GMTED2010 (USGS), 7,5″ ≈ 250 m, EGM96',
    etopo1: 'ETOPO1 (NOAA), 1′ ≈ 1,8 km, MSL', ned: 'USGS NED/3DEP, NAVD88', ned13: 'USGS 3DEP 1/3″ ≈ 10 m, NAVD88', ned_topobathy: 'USGS topobatymetrie',
    austria: 'DGM Rakousko 10 m', norway: 'Kartverket Norsko 10 m', uk_lidar: 'UK lidar (OGL) 2 m', canada: 'CDEM Kanada', au: 'Geoscience Australia 5 m',
    nzdem: 'LINZ Nový Zéland 8 m', mx: 'INEGI Mexiko', arcticdem: 'ArcticDEM', geoscience_au: 'Geoscience Australia', kartverket: 'Kartverket Norsko'
  };

  // ---------- uložená nastavení ----------
  function ctiLS(k, def) { try { const v = localStorage.getItem(LS + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } }
  function pisLS(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) { /* plné úložiště / soukromé okno */ } }
  const N = Object.assign({ zdroj: 'cuzk', maxBunek: 1000000, rezim: 'vana', sousedstvi: 4, okraj: false, pruhlednost: 80,
    relief: 'stin', podklad: 'osm', rychlost: 1, smycka: false, pohled: null }, ctiLS('nastaveni', {}));
  const ulozN = () => pisLS('nastaveni', N);

  // ---------- stav ----------
  const S = {
    m: null, plochy: null, rozsah: null, stin: null, meta: null,
    hladina: 0, ref: null, klic: null, klicRezim: '', zdroje: [], oblast: null,
    nastroj: '', body: [], profil: null, polygon: null, polyMaska: null,
    krivka: null, anim: null, nacitani: null, importRaster: null, importSoubory: null,
    m0: null, upravy: [], upravyVypnute: false, klicBez: null, klicBezRezim: '', osm: null, p3d: null, poNacteni: null
  };

  // ---------- mapa ----------
  const PODKLADY = {
    osm: { nazev: 'OpenStreetMap (Humanitarian)', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', max: 19,
      atr: '© přispěvatelé <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, styl HOT (OSM France)' },
    topo: { nazev: 'OpenTopoMap (vrstevnice)', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', max: 17,
      atr: '© přispěvatelé OpenStreetMap, SRTM | styl © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC BY-SA)' },
    satelit: { nazev: 'Letecké snímky (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', max: 19,
      atr: 'Snímky © Esri, Maxar, Earthstar Geographics a komunita uživatelů GIS' },
    esritopo: { nazev: 'Topografická (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', max: 19,
      atr: '© Esri, HERE, Garmin, USGS, NGA, EPA, NPS a přispěvatelé OpenStreetMap' },
    nic: { nazev: 'bez podkladu', url: null }
  };
  const selPodklad = $('podklad');
  for (const [k, p] of Object.entries(PODKLADY)) selPodklad.add(new Option(p.nazev, k));

  const mapa = L.map('mapa', { zoomControl: true, attributionControl: true, doubleClickZoom: true, zoomSnap: 0.5 });
  mapa.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  mapa.createPane('teren').style.zIndex = 300;
  mapa.createPane('voda').style.zIndex = 350;
  mapa.createPane('vrstvyNahore').style.zIndex = 450;
  const pohled = N.pohled && isFinite(N.pohled.lat) ? N.pohled : { lat: 49.8, lon: 15.5, z: 7 };
  mapa.setView([pohled.lat, pohled.lon], pohled.z);
  mapa.on('moveend', () => { const c = mapa.getCenter(); N.pohled = { lat: +c.lat.toFixed(5), lon: +c.lng.toFixed(5), z: mapa.getZoom() }; ulozN(); aktualizujOblastInfo(); });
  let podkladVrstva = null;
  function nastavPodklad(k) {
    if (!PODKLADY[k]) k = 'osm';
    N.podklad = k; selPodklad.value = k; ulozN();
    if (podkladVrstva) { mapa.removeLayer(podkladVrstva); podkladVrstva = null; }
    const p = PODKLADY[k];
    if (p.url) podkladVrstva = L.tileLayer(p.url, { maxZoom: 20, maxNativeZoom: p.max, attribution: p.atr, crossOrigin: 'anonymous', subdomains: 'abc' }).addTo(mapa);
  }
  selPodklad.addEventListener('change', () => { N.podkladPredDemem = null; nastavPodklad(selPodklad.value); vykresliTeren(); });

  // plátno jako vrstva mapy (jako L.ImageOverlay, jen s <canvas>)
  const PlatnoVrstva = L.ImageOverlay.extend({
    _initImage: function () {
      const el = this._image = this._url;
      L.DomUtil.addClass(el, 'leaflet-image-layer');
      if (this._zoomAnimated) L.DomUtil.addClass(el, 'leaflet-zoom-animated');
      el.onselectstart = L.Util.falseFn; el.onmousemove = L.Util.falseFn;
    }
  });
  const platnoTeren = document.createElement('canvas'), platnoVoda = document.createElement('canvas');
  let vrstvaTeren = null, vrstvaVoda = null, obrysDat = null;
  const skupZdroje = L.layerGroup().addTo(mapa), skupNastroj = L.layerGroup().addTo(mapa), skupProfil = L.layerGroup().addTo(mapa),
    skupPlocha = L.layerGroup().addTo(mapa), skupOblast = L.layerGroup().addTo(mapa);
  let profilZnacka = null;

  // ---------- barvy ----------
  const BARVY_HL = [[198, 219, 239], [158, 202, 225], [107, 174, 214], [66, 146, 198], [33, 113, 181], [8, 81, 156], [8, 48, 107]];
  const BARVA_NOVA = [255, 127, 14], BARVA_USTUP = [214, 42, 208];
  const tridaHloubky = h => { const t = J.TRIDY_HLOUBKY; for (let i = 0; i < t.length; i++) if (h < t[i]) return i; return t.length; };
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
  function hypso(t) { // 0..1 → barva výšky (zelená → žlutá → hnědá → bílá)
    const st = [[0, [46, 125, 50]], [0.3, [139, 195, 74]], [0.55, [240, 220, 130]], [0.8, [170, 120, 70]], [1, [245, 245, 245]]];
    for (let i = 1; i < st.length; i++) if (t <= st[i][0]) {
      const a = st[i - 1], b = st[i], f = (t - a[0]) / (b[0] - a[0]);
      return [a[1][0] + (b[1][0] - a[1][0]) * f, a[1][1] + (b[1][1] - a[1][1]) * f, a[1][2] + (b[1][2] - a[1][2]) * f];
    }
    return st[st.length - 1][1];
  }

  // ---------- pomocné UI ----------
  const fm = (v, d) => J.cislo(v, d === undefined ? 2 : d);
  function stav(text, typ) { const e = $('stavData'); e.textContent = text || ''; e.className = 'stav' + (typ ? ' ' + typ : ''); }
  function prubeh(f) { const p = $('prubeh'); if (f === null) { p.hidden = true; return; } p.hidden = false; p.firstElementChild.style.width = Math.round(f * 100) + '%'; }
  const pracuji = zap => { $('pracuji').hidden = !zap; };
  const cekej = () => new Promise(r => setTimeout(r, 30));
  function stahni(blob, jmeno) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const datumSouboru = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/(\d{8})(\d{4})/, '$1_$2');

  // ---------- volba zdroje ----------
  function nastavZdroj(z) {
    N.zdroj = z; ulozN();
    document.querySelectorAll('[data-zdroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.zdroj === z)));
    $('volbyOnline').hidden = !(z === 'cuzk' || z === 'terrarium');
    $('volbySoubor').hidden = z !== 'soubor';
    $('volbyDemo').hidden = z !== 'demo';
    aktualizujOblastInfo();
  }
  document.querySelectorAll('[data-zdroj]').forEach(b => b.addEventListener('click', () => nastavZdroj(b.dataset.zdroj)));
  $('maxBunek').value = String(N.maxBunek);
  if (!$('maxBunek').value) $('maxBunek').value = '1000000';
  $('maxBunek').addEventListener('change', () => { N.maxBunek = +$('maxBunek').value; ulozN(); aktualizujOblastInfo(); });

  function oblastMerc() {
    if (S.oblast) return S.oblast;
    const b = mapa.getBounds();
    return { xmin: J.lonNaMerc(b.getWest()), xmax: J.lonNaMerc(b.getEast()), ymin: J.latNaMerc(b.getSouth()), ymax: J.latNaMerc(b.getNorth()) };
  }
  function odhadOblasti(o) {
    const lat = J.mercNaLat((o.ymin + o.ymax) / 2), c = Math.cos(lat * Math.PI / 180);
    const sx = (o.xmax - o.xmin) * c, sy = (o.ymax - o.ymin) * c;
    let rozl, popis = '';
    if (N.zdroj === 'terrarium') {
      const z = J.volbaZoomu(o.xmin, o.ymin, o.xmax, o.ymax, N.maxBunek, 15);
      rozl = J.pixelDlazdice(z, lat); popis = `zoom dlaždic ${z}, pixel ${J.delkaText(rozl)}`;
      if (rozl < 25) popis += ' (detail ale omezuje zdroj – v Evropě EU-DEM ~30 m)';
    } else {
      rozl = Math.max(2, Math.sqrt(sx * sy / N.maxBunek)); popis = `buňka ${J.delkaText(rozl)}` + (rozl > 2.01 ? ' (DMR 5G má 2 m – pro plné rozlišení zmenšete oblast nebo zvyšte počet buněk)' : ' (plné rozlišení DMR 5G)');
    }
    return { sx, sy, rozl, popis, plocha: J.plochaPolygonu([{ lat: J.mercNaLat(o.ymin), lon: J.mercNaLon(o.xmin) }, { lat: J.mercNaLat(o.ymin), lon: J.mercNaLon(o.xmax) },
      { lat: J.mercNaLat(o.ymax), lon: J.mercNaLon(o.xmax) }, { lat: J.mercNaLat(o.ymax), lon: J.mercNaLon(o.xmin) }]) };
  }
  function aktualizujOblastInfo() {
    if ($('volbyOnline').hidden) return;
    const o = oblastMerc(), od = odhadOblasti(o);
    $('oblastInfo').textContent = (S.oblast ? 'Vyznačená oblast' : 'Aktuální výřez mapy') + `: ${J.delkaText(od.sx)} × ${J.delkaText(od.sy)} (${J.plochaText(od.plocha)}), ${od.popis}.`;
  }

  // ---------- načítání: ČÚZK DMR 5G ----------
  async function nactiCuzk(o, signal) {
    const lat = J.mercNaLat((o.ymin + o.ymax) / 2), c = Math.cos(lat * Math.PI / 180);
    const sx = (o.xmax - o.xmin) * c, sy = (o.ymax - o.ymin) * c;
    const zem = Math.max(2, Math.sqrt(sx * sy / N.maxBunek)), d = zem / c;
    const W = Math.max(2, Math.ceil((o.xmax - o.xmin) / d)), H = Math.max(2, Math.ceil((o.ymax - o.ymin) / d));
    const m = J.vytvorMrizku(W, H, o.xmin, o.ymax, d);
    const bloky = [];
    for (let j = 0; j < H; j += CUZK_BLOK) for (let i = 0; i < W; i += CUZK_BLOK) bloky.push([i, j, Math.min(W, i + CUZK_BLOK), Math.min(H, j + CUZK_BLOK)]);
    let hotovo = 0;
    for (const [i0, j0, i1, j1] of bloky) {
      const bx0 = m.x0 + i0 * d, bx1 = m.x0 + i1 * d, by1 = m.y0 - j0 * d, by0 = m.y0 - j1 * d;
      const url = `${CUZK_URL}?bbox=${bx0.toFixed(3)},${by0.toFixed(3)},${bx1.toFixed(3)},${by1.toFixed(3)}&bboxSR=3857&imageSR=3857&size=${i1 - i0},${j1 - j0}` +
        '&format=tiff&pixelType=F32&noData=-9999&noDataInterpretation=esriNoDataMatchAny&interpolation=RSP_BilinearInterpolation&f=image';
      stav(`Stahuji DMR 5G z ČÚZK (${hotovo + 1}/${bloky.length}, ${i1 - i0} × ${j1 - j0} buněk)…`);
      let odp;
      try { odp = await fetch(url, { signal }); } catch (e) { if (e.name === 'AbortError') throw e; throw new Error('Server ČÚZK neodpovídá (' + e.message + '). Zkuste to později, nebo zvolte Terrain Tiles či import souboru.'); }
      if (!odp.ok) throw new Error('Server ČÚZK vrátil chybu ' + odp.status + '.');
      const typ = odp.headers.get('content-type') || '';
      const buf = new Uint8Array(await odp.arrayBuffer());
      if (!/tiff/.test(typ) && RS.rozpoznej(buf) !== 'tiff') {
        let zprava = ''; try { zprava = JSON.parse(new TextDecoder().decode(buf)).error.message; } catch (e) { /* ne JSON */ }
        throw new Error('ČÚZK nevrátil rastr' + (zprava ? ': ' + zprava : '.'));
      }
      const r = await RS.ctiTiff(buf);
      if (r.sirka !== i1 - i0 || r.vyska !== j1 - j0) throw new Error('ČÚZK vrátil rastr jiné velikosti, než byl vyžádán.');
      for (let y = 0; y < r.vyska; y++) m.vysky.set(r.data.subarray(y * r.sirka, (y + 1) * r.sirka), (j0 + y) * W + i0);
      hotovo++; prubeh(hotovo / bloky.length);
    }
    const rz = J.rozsahVysek(m);
    if (!rz.platnych) throw new Error('Vybraná oblast leží mimo pokrytí DMR 5G (data jsou jen pro území Česka). Zvolte Terrain Tiles.');
    return { m, meta: {
      zdroj: 'cuzk', nazev: 'ČÚZK – DMR 5G (digitální model reliéfu 5. generace)',
      rozliseni: `buňka ${J.delkaText(zem)}` + (zem > 2.01 ? ' (převzorkováno z 2 m)' : ''),
      vertikal: 'Bpv – Balt po vyrovnání (EPSG:8357)', jednotka: 'm n. m. Bpv',
      presnost: 'úplná střední chyba výšky 0,18 m (odkrytý terén), 0,3 m (les)',
      licence: '© ČÚZK, CC BY 4.0', stari: 'letecké laserové skenování 2009–2013, průběžně aktualizováno',
      pokryti: rz.chybi ? `${fm(100 * rz.chybi / (W * H), 1)} % buněk bez dat (mimo ČR)` : 'celá oblast' } };
  }

  // ---------- načítání: Terrain Tiles (Terrarium) ----------
  async function dekodujPng(blob) {
    const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(bmp, 0, 0); bmp.close && bmp.close();
    return cx.getImageData(0, 0, cv.width, cv.height);
  }
  async function nactiTerrarium(o, signal) {
    const z = J.volbaZoomu(o.xmin, o.ymin, o.xmax, o.ymax, N.maxBunek, 15);
    const p = J.pixelyProObdelnik(z, o.xmin, o.ymin, o.xmax, o.ymax);
    const m = J.mrizkaZPixelu(z, p), n = 2 ** z;
    const dlazdice = [];
    for (let ty = p.ty0; ty <= p.ty1; ty++) for (let tx = p.tx0; tx <= p.tx1; tx++) if (ty >= 0 && ty < n) dlazdice.push([tx, ty]);
    const zdroje = new Set(); let hotovo = 0, chyb = 0;
    const fronta = dlazdice.slice();
    async function pracovnik() {
      while (fronta.length) {
        const [tx, ty] = fronta.shift();
        const x = ((tx % n) + n) % n;
        try {
          const odp = await fetch(`${TERRARIUM_URL}${z}/${x}/${ty}.png`, { signal });
          if (!odp.ok) throw new Error('HTTP ' + odp.status);
          const h = odp.headers.get('x-amz-meta-x-imagery-sources');
          if (h) h.split(',').forEach(s => { const k = s.trim().split('/')[0]; if (k) zdroje.add(k); });
          const img = await dekodujPng(await odp.blob());
          const d = img.data;
          for (let py = 0; py < 256; py++) {
            const gy = ty * 256 + py - p.py0; if (gy < 0 || gy >= m.vyska) continue;
            for (let px = 0; px < 256; px++) {
              const gx = tx * 256 + px - p.px0; if (gx < 0 || gx >= m.sirka) continue;
              const k = (py * 256 + px) * 4;
              m.vysky[gy * m.sirka + gx] = J.terrariumVyska(d[k], d[k + 1], d[k + 2]);
            }
          }
        } catch (e) { if (e.name === 'AbortError') throw e; chyb++; }
        hotovo++; prubeh(hotovo / dlazdice.length);
        stav(`Stahuji dlaždice Terrain Tiles (z${z}): ${hotovo}/${dlazdice.length}…`);
      }
    }
    await Promise.all(Array.from({ length: Math.min(6, dlazdice.length) }, pracovnik));
    if (chyb === dlazdice.length) throw new Error('Dlaždice Terrain Tiles se nepodařilo stáhnout (síť nebo server AWS). Zkuste import souboru nebo demonstrační terén.');
    const lat = J.mercNaLat((o.ymin + o.ymax) / 2), px = J.pixelDlazdice(z, lat);
    const seznam = [...zdroje].map(k => ZDROJE_TT[k] || k);
    return { m, meta: {
      zdroj: 'terrarium', nazev: 'Terrain Tiles (Mapzen/Tilezen, AWS Open Data), kódování Terrarium',
      rozliseni: `dlaždice z${z}, pixel ${J.delkaText(px)}; skutečný detail podle zdroje níže`,
      podklady: seznam.length ? seznam.join('; ') : 'neuvedeno',
      vertikal: 'nesjednocený – podle zdroje (EU-DEM: EVRS2000, SRTM/GMTED: EGM96, ETOPO1: střední hladina moře)', jednotka: 'm n. m. (přibližně)',
      presnost: 'EU-DEM svisle RMSE řádově 2–7 m, SRTM ~5–10 m; vegetace a zástavba mohou zvedat povrch',
      licence: 'podle zdrojů – EU-DEM © Copernicus, SRTM/GMTED © USGS, ETOPO1 © NOAA aj.',
      stari: 'dlaždice vytvořeny 2016–2017, zdrojová data 2000–2016',
      pokryti: chyb ? `${chyb} z ${dlazdice.length} dlaždic se nepodařilo stáhnout` : 'celá oblast' } };
  }

  async function nactiOnline() {
    if (S.nacitani) return;
    stopAnimace(); zrusNastroj();
    const o = S.oblast ? oblastMerc() : omezOblast(oblastMerc());
    const od = odhadOblasti(o);
    if (od.plocha > 4e10) { Dialog.chyba('Oblast je příliš velká (' + J.plochaText(od.plocha) + '). Přibližte mapu nebo vyznačte menší obdélník.'); return; }
    const ac = new AbortController();
    S.nacitani = ac;
    $('btnNacist').disabled = true; $('btnZrusitNacitani').hidden = false; prubeh(0);
    try {
      const r = N.zdroj === 'terrarium' ? await nactiTerrarium(o, ac.signal) : await nactiCuzk(o, ac.signal);
      await nastavMrizku(r.m, r.meta, true);
    } catch (e) {
      if (e.name === 'AbortError') stav('Načítání zrušeno.');
      else { stav(e.message, 'chyba'); Dialog.chyba(e.message); }
    } finally {
      S.nacitani = null; $('btnNacist').disabled = false; $('btnZrusitNacitani').hidden = true; prubeh(null);
    }
  }
  $('btnNacist').addEventListener('click', nactiOnline);
  $('btnZrusitNacitani').addEventListener('click', () => S.nacitani && S.nacitani.abort());
  $('btnVyrez').addEventListener('click', () => { S.oblast = null; skupOblast.clearLayers(); zrusNastroj(); aktualizujOblastInfo(); });
  $('btnObdelnik').addEventListener('click', () => prepniNastroj('obdelnik'));

  // ---------- import souboru ----------
  for (const [k, t] of P.NABIDKA) $('crsImport').add(new Option(t + ' – EPSG:' + k, k));
  $('soubor').addEventListener('change', async () => {
    const soubory = [...$('soubor').files];
    if (!soubory.length) return;
    S.importSoubory = soubory; S.importRaster = null;
    await zpracujImport();
  });
  $('btnZnovuImport').addEventListener('click', () => zpracujImport());
  async function zpracujImport() {
    const soubory = S.importSoubory; if (!soubory) return;
    stopAnimace(); zrusNastroj();
    try {
      let raster = S.importRaster, jmeno = '';
      const prj = soubory.find(f => /\.prj$/i.test(f.name));
      const tfw = soubory.find(f => /\.(tfw|tifw|tiffw)$/i.test(f.name));
      if (!raster) {
        const hl = soubory.find(f => /\.(tif|tiff|asc|txt)$/i.test(f.name)) || soubory.find(f => f !== prj && f !== tfw);
        if (!hl) throw new Error('Vyberte soubor .tif nebo .asc (soubor .prj / .tfw samotný nestačí).');
        jmeno = hl.name;
        if (hl.size > 600e6) throw new Error('Soubor je příliš velký (' + J.cislo(hl.size / 1e6, 0) + ' MB). Ořízněte ho nebo zmenšete rozlišení.');
        stav('Čtu ' + hl.name + '…'); prubeh(0.1); await cekej();
        const buf = new Uint8Array(await hl.arrayBuffer());
        const fmt = RS.rozpoznej(buf);
        if (fmt === 'tiff') raster = await RS.ctiTiff(buf);
        else if (fmt === 'asc') raster = RS.ctiAsc(new TextDecoder().decode(buf));
        else throw new Error('Neznámý formát souboru ' + hl.name + ' – podporovaný je GeoTIFF a ESRI ASCII grid (.asc).');
        if (tfw) {
          const c = (await tfw.text()).trim().split(/\s+/).map(Number);
          if (c.length >= 6 && c.every(isFinite)) raster.afinni = [c[4] - c[0] / 2 - c[2] / 2, c[0], c[2], c[5] - c[1] / 2 - c[3] / 2, c[1], c[3]];
        }
        if (prj) raster.prjText = await prj.text();
        raster.jmeno = jmeno;
        S.importRaster = raster;
      }
      if (!raster.afinni) throw new Error('Rastr nemá georeferenci (chybí značky GeoTIFF i soubor .tfw).');
      $('btnZnovuImport').disabled = false;
      // souřadnicový systém
      let kod = +$('crsImport').value, puvod = 'zvoleno ručně';
      if (!kod) {
        if (raster.epsg && P.system(raster.epsg)) { kod = raster.epsg; puvod = 'z GeoTIFF'; }
        else if (raster.prjText && P.kodZWkt(raster.prjText)) { kod = P.kodZWkt(raster.prjText); puvod = 'ze souboru .prj'; }
        else if (raster.popisCrs && P.kodZNazvu(raster.popisCrs)) { kod = P.kodZNazvu(raster.popisCrs); puvod = 'z popisu v GeoTIFF'; }
        else {
          const A = raster.afinni, x1 = A[0] + raster.sirka * A[1], y1 = A[3] + raster.vyska * A[5];
          kod = P.hadejZRozsahu(Math.min(A[0], x1), Math.min(A[3], y1), Math.max(A[0], x1), Math.max(A[3], y1)); puvod = 'odhadnuto z rozsahu souřadnic';
        }
      }
      const sys = P.system(kod);
      if (!sys) {
        const zn = raster.epsg ? 'EPSG:' + raster.epsg : (raster.popisCrs || 'neuvedený');
        $('crsImport').focus();
        throw new Error(`Souřadnicový systém souboru (${zn}) neumím určit nebo převést. Vyberte ho ze seznamu a klikněte na „Načíst znovu“.`);
      }
      stav(`Převzorkovávám ${raster.sirka} × ${raster.vyska} buněk (${sys.nazev}, ${puvod}) do Web Mercatoru…`); prubeh(0.5); await cekej();
      const m = J.prevzorkuj(raster, sys, Math.max(N.maxBunek, 1000000));
      const rz = J.rozsahVysek(m);
      if (!rz.platnych) throw new Error('Soubor neobsahuje žádné platné výšky.');
      const A = raster.afinni, krok = Math.abs(A[1]);
      await nastavMrizku(m, {
        zdroj: 'soubor', nazev: 'Soubor ' + (raster.jmeno || ''),
        rozliseni: `zdroj ${raster.sirka} × ${raster.vyska}, krok ${sys.geograficky ? J.cislo(krok * 3600, 2) + '″' : J.delkaText(krok)}; v mapě buňka ${J.delkaText(J.rozmerBunky(m))}`,
        crs: `${sys.nazev} (EPSG:${sys.kod}, ${puvod})`,
        vertikal: raster.vertikal || 'neuvedeno v souboru – stránka výšky nepřepočítává', jednotka: 'm (podle souboru)',
        licence: 'podle zdroje souboru', presnost: 'podle zdroje souboru', stari: '–',
        pokryti: rz.chybi ? `${fm(100 * rz.chybi / (m.sirka * m.vyska), 1)} % buněk bez dat` : 'bez mezer' }, true);
    } catch (e) { stav(e.message, 'chyba'); Dialog.chyba(e.message); }
    finally { prubeh(null); }
  }

  // ---------- demonstrační terén ----------
  async function nactiDemo() {
    stopAnimace(); zrusNastroj();
    const m = J.demoTeren(49.95, 15.25);
    if (N.podklad !== 'nic') { N.podkladPredDemem = N.podklad; nastavPodklad('nic'); }
    await nastavMrizku(m, { zdroj: 'demo', nazev: 'Demonstrační terén (smyšlený, neodpovídá skutečnému místu)',
      rozliseni: 'buňka 10 m, 400 × 300 buněk', vertikal: 'smyšlené výšky', jednotka: 'm (smyšlené)', licence: 'volně', presnost: '–', stari: '–', pokryti: 'celá oblast' }, true);
    if (!S.zdroje.length) { // zdroj v korytě u západního okraje
      const osa = 300 * 10 * 0.52 + 260 * Math.sin(50 / 700) + 90 * Math.sin(50 / 230 + 1);
      const [mx, my] = J.stredBunky(m, 5, Math.round(osa / 10 - 0.5));
      S.zdroje = [{ lat: J.mercNaLat(my), lon: J.mercNaLon(mx) }]; S.klic = null; aktualizujZdroje();
    }
    nastavHladinu(250.6);
  }
  $('btnDemo').addEventListener('click', nactiDemo);

  // ---------- nastavení nové mřížky ----------
  async function nastavMrizku(m, meta, prizpusobit) {
    if (meta.zdroj !== 'demo' && N.podklad === 'nic' && N.podkladPredDemem) { nastavPodklad(N.podkladPredDemem); N.podkladPredDemem = null; ulozN(); }
    S.m0 = m; S.meta = meta; S.plochy = J.plochyRadku(m); S.rozsah = J.rozsahVysek(m);
    m = S.m = J.vytvorMrizku(m.sirka, m.vyska, m.x0, m.y0, m.d, A.upravVysky(m, aktivniUpravy()));
    S.klic = null; S.klicBez = null; S.ref = null; S.krivka = null; S.polyMaska = null; S.osm = null; vykresliOsm();
    S.zdroje = S.zdroje.filter(z => J.bunkaZLatLon(m, z.lat, z.lon) >= 0);
    stav('Počítám stínování reliéfu…'); await cekej();
    S.stin = J.stinovani(m);
    platnoTeren.width = platnoVoda.width = m.sirka; platnoTeren.height = platnoVoda.height = m.vyska;
    const h = J.hranice(m), meze = L.latLngBounds([h.jih, h.zapad], [h.sever, h.vychod]);
    if (vrstvaTeren) { vrstvaTeren.setBounds(meze); } else vrstvaTeren = new PlatnoVrstva(platnoTeren, meze, { pane: 'teren', interactive: false }).addTo(mapa);
    if (vrstvaVoda) { vrstvaVoda.setBounds(meze); } else vrstvaVoda = new PlatnoVrstva(platnoVoda, meze, { pane: 'voda', interactive: false, opacity: N.pruhlednost / 100 }).addTo(mapa);
    if (obrysDat) mapa.removeLayer(obrysDat);
    obrysDat = L.rectangle(meze, { color: css('--accent'), weight: 1, dashArray: '4 4', fill: false, interactive: false }).addTo(mapa);
    mapa.attributionControl.removeAttribution(ATRIB.cuzk); mapa.attributionControl.removeAttribution(ATRIB.terrarium);
    mapa.attributionControl.removeAttribution(ATRIB.soubor); mapa.attributionControl.removeAttribution(ATRIB.demo);
    mapa.attributionControl.addAttribution(ATRIB[meta.zdroj]);
    S.oblast = null; skupOblast.clearLayers();
    if (prizpusobit) mapa.fitBounds(meze, { padding: [10, 10], animate: false });
    vykresliTeren();
    // rozsah hladiny
    const lo = Math.floor(S.rozsah.min * 10) / 10, hi = Math.ceil(S.rozsah.max * 10) / 10;
    const r = $('hladinaRozsah'); r.min = lo; r.max = hi; r.disabled = false; $('hladina').disabled = false;
    document.querySelectorAll('[data-krok]').forEach(b => b.disabled = false);
    ['btnRef', 'btnAnim', 'btnAnimPodle', 'btnProfil', 'btnPlocha', 'btnPng', 'btnTiff', 'btnGeojson', 'btnSdilet', 'btn3d', 'btnOsm', 'btnHraz', 'btnPrurva', 'btnObjem'].forEach(id => $(id).disabled = false);
    $('kartaOsm').hidden = true;
    $('vertJednotka').textContent = '(' + meta.jednotka + ')';
    $('animOd').value = lo.toFixed(1); $('animDo').value = (lo + Math.min(10, (hi - lo) * 0.25)).toFixed(1);
    let L0 = S.hladina;
    if (!(L0 >= lo && L0 <= hi)) L0 = Math.round((lo + Math.min(3, (hi - lo) * 0.1)) * 10) / 10;
    zobrazMeta();
    aktualizujZdroje();
    stav(`Načteno ${m.sirka} × ${m.vyska} buněk, výšky ${fm(S.rozsah.min)} – ${fm(S.rozsah.max)} m.`, 'ok');
    nastavHladinu(L0);
    if (S.profil) prepoctiProfil();
    if (S.polygon) prepoctiPolygon();
    nakresliUpravy();
    aktualizuj3dTeren();
    ulozDoIdb();
    aktualizujKroky();
    await zajistiKlic(); pozadujVykresleni();
    if (S.poNacteni) { const f = S.poNacteni; S.poNacteni = null; await f(); }
  }
  function zobrazMeta() {
    const m = S.meta, el = $('meta'); el.hidden = false; el.innerHTML = '';
    const pole = [['Zdroj', m.nazev], ['Rozlišení', m.rozliseni], ['Podklady', m.podklady], ['Souřadnice', m.crs], ['Výšky', m.vertikal],
      ['Přesnost', m.presnost], ['Stáří', m.stari], ['Licence', m.licence], ['Pokrytí', m.pokryti],
      ['Rozsah', S.rozsah ? `${fm(S.rozsah.min)} – ${fm(S.rozsah.max)} m` : '']];
    for (const [k, v] of pole) if (v) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; el.append(dt, dd); }
  }

  // ---------- vykreslení ----------
  function vykresliTeren() {
    if (!S.m) return;
    const m = S.m, W = m.sirka, H = m.vyska, cx = platnoTeren.getContext('2d');
    const img = cx.createImageData(W, H), d = img.data, v = m.vysky, st = S.stin;
    const rez = N.relief, lo = S.rozsah.min, rng = Math.max(1e-6, S.rozsah.max - S.rozsah.min);
    if (rez !== 'nic') for (let i = 0; i < W * H; i++) {
      const e = v[i], k = i * 4;
      if (!(e === e)) { d[k] = 128; d[k + 1] = 128; d[k + 2] = 128; d[k + 3] = 90; continue; }
      const s = st[i];
      if (rez === 'barvy') {
        const c = hypso((e - lo) / rng), f = 0.35 + 0.65 * s / 255;
        d[k] = c[0] * f; d[k + 1] = c[1] * f; d[k + 2] = c[2] * f; d[k + 3] = 235;
      } else if (N.podklad === 'nic') { d[k] = d[k + 1] = d[k + 2] = 40 + s * 0.75; d[k + 3] = 255; }
      else if (s < 180) { d[k] = d[k + 1] = d[k + 2] = 0; d[k + 3] = (180 - s) / 180 * 190; }
      else { d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = (s - 180) / 75 * 90; }
    }
    cx.putImageData(img, 0, 0);
  }
  $('relief').value = N.relief;
  $('relief').addEventListener('change', () => { N.relief = $('relief').value; ulozN(); vykresliTeren(); });
  $('pruhlednost').value = N.pruhlednost; $('pruhlednostHod').textContent = N.pruhlednost + ' %';
  $('pruhlednost').addEventListener('input', () => {
    N.pruhlednost = +$('pruhlednost').value; $('pruhlednostHod').textContent = N.pruhlednost + ' %'; ulozN();
    if (vrstvaVoda) vrstvaVoda.setOpacity(N.pruhlednost / 100);
  });

  function aktualniKlic() {
    if (!S.m) return null;
    if (N.rezim === 'vana') return J.zaplavaVana(S.m);
    const podpis = podpisKlice();
    if (S.klic && S.klicRezim === podpis) return S.klic;
    const idx = S.zdroje.map(z => J.bunkaZLatLon(S.m, z.lat, z.lon)).filter(i => i >= 0);
    S.klic = J.zaplavaPropojena(S.m, idx, N.sousedstvi, N.okraj); S.klicRezim = podpis; S.krivka = null;
    return S.klic;
  }
  const podpisKlice = () => N.sousedstvi + '|' + N.okraj + '|' + S.zdroje.map(z => z.lat.toFixed(7) + ',' + z.lon.toFixed(7)).join(';') + '|' + S.upravyVerze;
  S.upravyVerze = 0;
  let worker = null, workerId = 0;
  /** Přelivové výšky ve Workeru (stránka nezamrzne); bez Workeru (file://) v hlavním vlákně. */
  function klicAsync(vysky) {
    const m = S.m, idx = S.zdroje.map(z => J.bunkaZLatLon(m, z.lat, z.lon)).filter(i => i >= 0);
    const synchronne = () => J.zaplavaPropojena({ sirka: m.sirka, vyska: m.vyska, vysky }, idx, N.sousedstvi, N.okraj);
    if (worker === null) { try { worker = new Worker('zaplavy/worker.js'); } catch (e) { worker = false; } }
    if (!worker) return Promise.resolve(synchronne());
    const id = ++workerId;
    return new Promise(res => {
      const hotovo = e => {
        if (e.data.id !== id) return;
        worker.removeEventListener('message', hotovo);
        res(e.data.chyba ? synchronne() : new Float32Array(e.data.klic));
      };
      worker.addEventListener('message', hotovo);
      worker.onerror = () => { worker.removeEventListener('message', hotovo); worker = false; res(synchronne()); };
      worker.postMessage({ id, sirka: m.sirka, vyska: m.vyska, vysky: vysky.slice().buffer, zdroje: idx, sousedstvi: N.sousedstvi, okraj: N.okraj });
    });
  }
  let pocitaSe = null;
  /** Zajistí platné přelivové výšky (i pro porovnání bez úprav). */
  async function zajistiKlic() {
    if (N.rezim !== 'propojena' || !S.m) return;
    while (pocitaSe) await pocitaSe;
    const podpis = podpisKlice();
    const trebaBez = aktivniUpravy().length > 0 && S.klicBezRezim !== podpis;
    if (S.klic && S.klicRezim === podpis && !trebaBez) return;
    pracuji(true);
    pocitaSe = (async () => {
      if (!(S.klic && S.klicRezim === podpis)) { const k = await klicAsync(S.m.vysky); S.klic = k; S.klicRezim = podpis; S.krivka = null; }
      if (trebaBez) { S.klicBez = await klicAsync(S.m0.vysky); S.klicBezRezim = podpis; }
    })();
    try { await pocitaSe; } finally { pocitaSe = null; pracuji(false); }
  }

  let cekaVykresleni = false;
  function pozadujVykresleni() {
    if (cekaVykresleni) return; cekaVykresleni = true;
    requestAnimationFrame(() => { cekaVykresleni = false; vykresliVodu(); });
  }
  function vykresliVodu() {
    if (!S.m) return;
    if (N.rezim === 'propojena' && !(S.klic && S.klicRezim === podpisKlice())) { zajistiKlic().then(pozadujVykresleni); return; }
    const m = S.m, W = m.sirka, H = m.vyska, L = S.hladina, ref = S.ref, v = m.vysky;
    const klic = aktualniKlic();
    const cx = platnoVoda.getContext('2d'), img = cx.createImageData(W, H), d = img.data;
    const bezZdroje = N.rezim === 'propojena' && !S.zdroje.length && !N.okraj;
    if (!bezZdroje) {
      const lut = BARVY_HL;
      for (let i = 0; i < W * H; i++) {
        const k = klic[i], mokra = k < L, refM = ref !== null && k < ref;
        if (!mokra && !refM) continue;
        const o = i * 4;
        let c;
        if (mokra) c = ref !== null && !refM ? BARVA_NOVA : lut[tridaHloubky(L - v[i])];
        else c = BARVA_USTUP;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = mokra ? 255 : 150;
      }
    }
    cx.putImageData(img, 0, 0);
    // statistiky
    const s = bezZdroje ? { plocha: 0, objem: 0, maxHloubka: 0, prumHloubka: 0, pocet: 0 } : J.vyhodnot(m, klic, L, S.plochy);
    $('vPlocha').textContent = J.plochaText(s.plocha);
    $('vObjem').textContent = J.objemText(s.objem);
    $('vMax').textContent = s.pocet ? fm(s.maxHloubka) + ' m' : '–';
    $('vPrum').textContent = s.pocet ? fm(s.prumHloubka) + ' m' : '–';
    const celkem = S.plochy.reduce((a, b) => a + b, 0) * W;
    let dP = fm(100 * s.plocha / celkem, 1) + ' % oblasti', dV = '';
    if (ref !== null && !bezZdroje) {
      const r = J.vyhodnot(m, klic, ref, S.plochy), zn = x => (x >= 0 ? '+' : '−');
      dP += ` · ${zn(s.plocha - r.plocha)}${J.plochaText(Math.abs(s.plocha - r.plocha))} proti ${fm(ref)} m`;
      dV = `${zn(s.objem - r.objem)}${J.objemText(Math.abs(s.objem - r.objem))} proti ${fm(ref)} m`;
    }
    $('vPlochaD').textContent = dP; $('vObjemD').textContent = dV;
    S.stat = s;
    let info = `Hladina ${fm(L)} m je ${fm(L - S.rozsah.min)} m nad nejnižším bodem oblasti.`;
    if (bezZdroje) info = 'Režim „propojené se zdrojem“: klikněte na „Přidat zdroj“ a zvolte na mapě místo, odkud voda přichází (např. koryto řeky).';
    else if (N.rezim === 'propojena') {
      const vys = S.zdroje.map(z => { const i = J.bunkaZLatLon(m, z.lat, z.lon); return i >= 0 ? v[i] : NaN; }).filter(isFinite);
      if (vys.length && Math.min(...vys) >= L) info = `Hladina je pod úrovní všech zdrojů (nejnižší ${fm(Math.min(...vys))} m) – voda nemá kam téct.`;
    }
    $('hladinaInfo').textContent = info;
    aktualizujLegendu();
    kresliProfil(); kresliKrivku();
    if (S.polygon) aktualizujPolygonStat();
    porovnejUpravy(s, bezZdroje);
    aktualizuj3dVodu();
    planujOsm();
    aktualizujKroky();
  }

  // ---------- hladina ----------
  function nastavHladinu(L, zdroj) {
    if (!S.m || !isFinite(L)) return;
    const r = $('hladinaRozsah');
    L = Math.max(+r.min - 50, Math.min(+r.max + 50, L));
    S.hladina = Math.round(L * 100) / 100;
    if (zdroj !== 'rozsah') r.value = S.hladina;
    if (zdroj !== 'cislo') $('hladina').value = S.hladina.toFixed(2);
    pisLS('hladina', S.hladina);
    pozadujVykresleni();
  }
  $('hladinaRozsah').addEventListener('input', e => nastavHladinu(+e.target.value, 'rozsah'));
  $('hladina').addEventListener('input', e => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (isFinite(v)) nastavHladinu(v, 'cislo'); });
  document.querySelectorAll('[data-krok]').forEach(b => b.addEventListener('click', () => nastavHladinu(S.hladina + +b.dataset.krok)));
  $('btnRef').addEventListener('click', () => { S.ref = S.hladina; $('btnRefZrus').hidden = false; $('btnRef').textContent = 'Srovnávací hladina: ' + fm(S.ref) + ' m'; pozadujVykresleni(); });
  $('btnRefZrus').addEventListener('click', () => { S.ref = null; $('btnRefZrus').hidden = true; $('btnRef').textContent = 'Zafixovat pro srovnání'; pozadujVykresleni(); });

  // ---------- režim ----------
  document.querySelectorAll('input[name=rezim]').forEach(r => {
    r.checked = r.value === N.rezim;
    r.addEventListener('change', async () => { if (!r.checked) return; N.rezim = r.value; ulozN(); $('volbyPropojeni').hidden = N.rezim !== 'propojena'; S.krivka = null; await zajistiKlic(); pozadujVykresleni(); });
  });
  $('volbyPropojeni').hidden = N.rezim !== 'propojena';
  $('okraj').checked = !!N.okraj; $('sousedstvi').value = String(N.sousedstvi === 8 ? 8 : 4);
  $('okraj').addEventListener('change', async () => { N.okraj = $('okraj').checked; ulozN(); await zajistiKlic(); pozadujVykresleni(); });
  $('sousedstvi').addEventListener('change', async () => { N.sousedstvi = +$('sousedstvi').value; ulozN(); await zajistiKlic(); pozadujVykresleni(); });
  $('btnZdroj').addEventListener('click', () => prepniNastroj('zdroj'));
  $('btnSmazZdroje').addEventListener('click', async () => { S.zdroje = []; aktualizujZdroje(); await zajistiKlic(); pozadujVykresleni(); });

  function aktualizujZdroje() {
    skupZdroje.clearLayers();
    const ul = $('seznamZdroju'); ul.innerHTML = '';
    S.zdroje.forEach((z, k) => {
      const i = S.m ? J.bunkaZLatLon(S.m, z.lat, z.lon) : -1, e = i >= 0 ? S.m.vysky[i] : NaN;
      L.circleMarker([z.lat, z.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#0b63ce', fillOpacity: 1, pane: 'vrstvyNahore' })
        .bindTooltip(`Zdroj ${k + 1}: terén ${isFinite(e) ? fm(e) + ' m' : 'mimo data'}`).addTo(skupZdroje);
      const li = document.createElement('li');
      li.innerHTML = `<span>💧 Zdroj ${k + 1} – terén ${isFinite(e) ? fm(e) + ' m' : '<i>mimo data</i>'}</span>`;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'male'; b.textContent = '×'; b.title = 'Odebrat zdroj'; b.setAttribute('aria-label', 'Odebrat zdroj ' + (k + 1));
      b.addEventListener('click', async () => { S.zdroje.splice(k, 1); aktualizujZdroje(); await zajistiKlic(); pozadujVykresleni(); });
      li.appendChild(b); ul.appendChild(li);
    });
    pisLS('zdroje', S.zdroje);
  }

  // ---------- legenda a údaje pod kurzorem ----------
  const Legenda = L.Control.extend({ options: { position: 'bottomright' }, onAdd() { const d = L.DomUtil.create('div', 'mapa-info'); L.DomEvent.disableClickPropagation(d); return d; } });
  const legenda = new Legenda(); legenda.addTo(mapa);
  const Kurzor = L.Control.extend({ options: { position: 'bottomleft' }, onAdd() { return L.DomUtil.create('div', 'mapa-info'); } });
  const kurzor = new Kurzor(); kurzor.addTo(mapa); kurzor.getContainer().hidden = true;
  function popisyTrid() {
    const t = J.TRIDY_HLOUBKY, out = [];
    for (let i = 0; i <= t.length; i++) out.push(i === 0 ? `do ${fm(t[0], 1)} m` : i === t.length ? `nad ${J.cislo(t[i - 1])} m` : `${J.cislo(t[i - 1], t[i - 1] % 1 ? 1 : 0)}–${J.cislo(t[i], t[i] % 1 ? 1 : 0)} m`);
    return out;
  }
  function aktualizujLegendu() {
    const el = legenda.getContainer();
    if (!S.m) { el.innerHTML = '<b>Načtěte výšková data</b>'; return; }
    let h = `<b>Hloubka vody</b> · ${fm(S.hladina)} m`;
    popisyTrid().forEach((t, i) => { h += `<div class="radek"><i style="background:${rgb(BARVY_HL[i])}"></i>${t}</div>`; });
    if (S.ref !== null) h += `<div class="radek"><i style="background:${rgb(BARVA_NOVA)}"></i>nově zatopeno proti ${fm(S.ref)} m</div><div class="radek"><i style="background:${rgb(BARVA_USTUP)};opacity:.6"></i>voda opadla</div>`;
    h += `<div class="radek" style="color:var(--text-muted)">${N.rezim === 'vana' ? 'režim: vše pod hladinou' : 'režim: propojené se zdrojem (' + N.sousedstvi + ' sous.)'}</div>`;
    el.innerHTML = h;
  }
  mapa.on('mousemove', e => {
    const el = kurzor.getContainer();
    if (!S.m) { el.hidden = true; return; }
    const i = J.bunkaZLatLon(S.m, e.latlng.lat, e.latlng.lng);
    if (i < 0) { el.hidden = true; return; }
    el.hidden = false;
    const z = S.m.vysky[i];
    if (!(z === z)) { el.textContent = 'bez dat'; return; }
    const k = aktualniKlic(), mokra = !(N.rezim === 'propojena' && !S.zdroje.length && !N.okraj) && k[i] < S.hladina;
    el.innerHTML = `terén <b>${fm(z)} m</b>` + (mokra ? ` · hloubka <b>${fm(S.hladina - z)} m</b>` : ' · sucho') +
      (N.rezim === 'propojena' && isFinite(k[i]) && !mokra ? `<br><span style="color:var(--text-muted)">zaplaví se od ${fm(k[i])} m</span>` : '');
  });
  mapa.on('mouseout', () => { kurzor.getContainer().hidden = true; });

  // ---------- nástroje na mapě ----------
  const TEXTY = {
    obdelnik: 'Klikněte na dva protilehlé rohy oblasti.',
    zdroj: 'Klikněte do mapy na místo, odkud přichází voda (např. koryto řeky).',
    profil: 'Klikněte na začátek a konec profilu.',
    plocha: 'Klikejte na vrcholy plochy; dokončete tlačítkem Hotovo nebo dvojklikem.',
    hraz: 'Klikejte na body hráze / stěny; dokončete tlačítkem Hotovo nebo dvojklikem.',
    prurva: 'Klikejte na body průrvy (napříč valem); dokončete tlačítkem Hotovo nebo dvojklikem.'
  };
  function prepniNastroj(n) {
    if (S.nastroj === n) { zrusNastroj(); return; }
    zrusNastroj();
    S.nastroj = n; S.body = [];
    $('nastrojText').textContent = TEXTY[n];
    $('nastrojPruh').hidden = false; $('nastrojHotovo').hidden = !['plocha', 'hraz', 'prurva'].includes(n);
    mapa.getContainer().style.cursor = 'crosshair';
    if (['plocha', 'hraz', 'prurva'].includes(n)) mapa.doubleClickZoom.disable();
    const tl = { obdelnik: 'btnObdelnik', zdroj: 'btnZdroj', profil: 'btnProfil', plocha: 'btnPlocha', hraz: 'btnHraz', prurva: 'btnPrurva' }[n];
    if (tl) $(tl).setAttribute('aria-pressed', 'true');
  }
  function zrusNastroj() {
    if (S.nastroj === 'plocha' && S.body.length >= 3) dokonciPolygon();
    if ((S.nastroj === 'hraz' || S.nastroj === 'prurva') && S.body.length >= 2) pridejUpravu(S.nastroj, S.body.slice());
    S.nastroj = ''; S.body = []; skupNastroj.clearLayers();
    $('nastrojPruh').hidden = true; mapa.getContainer().style.cursor = '';
    mapa.doubleClickZoom.enable();
    ['btnObdelnik', 'btnZdroj', 'btnProfil', 'btnPlocha', 'btnHraz', 'btnPrurva'].forEach(id => $(id).setAttribute('aria-pressed', 'false'));
  }
  $('nastrojZrus').addEventListener('click', () => { S.body = []; zrusNastroj(); });
  $('nastrojHotovo').addEventListener('click', () => zrusNastroj());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.nastroj) { S.body = []; zrusNastroj(); } });

  mapa.on('click', async e => {
    const n = S.nastroj; if (!n) return;
    const b = { lat: e.latlng.lat, lon: e.latlng.lng };
    if (n === 'zdroj') {
      if (!S.m || J.bunkaZLatLon(S.m, b.lat, b.lon) < 0) { Dialog.info('Zdroj musí ležet uvnitř načtené oblasti.'); return; }
      S.zdroje.push(b); aktualizujZdroje(); zrusNastroj();
      if (N.rezim !== 'propojena') { N.rezim = 'propojena'; ulozN(); document.querySelector('input[name=rezim][value=propojena]').checked = true; $('volbyPropojeni').hidden = false; }
      await zajistiKlic(); pozadujVykresleni(); return;
    }
    S.body.push(b);
    if (n === 'obdelnik' && S.body.length === 2) {
      const [a, c] = S.body;
      S.oblast = { xmin: J.lonNaMerc(Math.min(a.lon, c.lon)), xmax: J.lonNaMerc(Math.max(a.lon, c.lon)), ymin: J.latNaMerc(Math.min(a.lat, c.lat)), ymax: J.latNaMerc(Math.max(a.lat, c.lat)) };
      skupOblast.clearLayers();
      L.rectangle([[a.lat, a.lon], [c.lat, c.lon]], { color: css('--warn'), weight: 2, dashArray: '6 4', fillOpacity: 0.05, interactive: false }).addTo(skupOblast);
      zrusNastroj(); aktualizujOblastInfo(); return;
    }
    if (n === 'profil' && S.body.length === 2) {
      S.profil = { a: S.body[0], b: S.body[1] }; zrusNastroj(); prepoctiProfil(); return;
    }
    nakresliRozpracovane();
  });
  mapa.on('dblclick', () => { if (['plocha', 'hraz', 'prurva'].includes(S.nastroj)) { S.body.pop(); zrusNastroj(); } });
  mapa.on('mousemove', e => { if (S.nastroj && S.body.length) nakresliRozpracovane(e.latlng); });
  function nakresliRozpracovane(mys) {
    skupNastroj.clearLayers();
    const pts = S.body.map(b => [b.lat, b.lon]);
    const barva = css('--warn');
    if (S.nastroj === 'obdelnik' && mys) L.rectangle([pts[0], mys], { color: barva, weight: 2, dashArray: '6 4', fillOpacity: 0.05, interactive: false }).addTo(skupNastroj);
    else if (S.nastroj === 'plocha') {
      const p = mys ? pts.concat([[mys.lat, mys.lng]]) : pts;
      if (p.length >= 3) L.polygon(p, { color: barva, weight: 2, fillOpacity: 0.1, interactive: false }).addTo(skupNastroj);
      else L.polyline(p, { color: barva, weight: 2, interactive: false }).addTo(skupNastroj);
    } else if (S.nastroj === 'hraz' || S.nastroj === 'prurva') {
      L.polyline(mys ? pts.concat([[mys.lat, mys.lng]]) : pts, { color: S.nastroj === 'hraz' ? '#8d5524' : '#e03131', weight: 4, interactive: false }).addTo(skupNastroj);
    } else if (mys) L.polyline(pts.concat([mys]), { color: barva, weight: 2, dashArray: '6 4', interactive: false }).addTo(skupNastroj);
    pts.forEach(p => L.circleMarker(p, { radius: 4, color: barva, weight: 2, fillOpacity: 1, interactive: false }).addTo(skupNastroj));
  }

  // ---------- profil ----------
  function prepoctiProfil() {
    skupProfil.clearLayers(); profilZnacka = null;
    if (!S.profil) return;
    const { a, b } = S.profil;
    L.polyline([[a.lat, a.lon], [b.lat, b.lon]], { color: '#e8590c', weight: 3, interactive: false }).addTo(skupProfil);
    [['A', a], ['B', b]].forEach(([t, p]) => L.marker([p.lat, p.lon], { interactive: false, icon: L.divIcon({ className: '',
      html: `<div style="background:#e8590c;color:#fff;border-radius:50%;width:20px;height:20px;line-height:20px;text-align:center;font:700 12px sans-serif;border:2px solid #fff">${t}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(skupProfil));
    if (S.m) {
      const delka = J.haversine(a.lat, a.lon, b.lat, b.lon), krok = J.rozmerBunky(S.m) / 2;
      S.profilBody = J.profil(S.m, a, b, Math.max(50, Math.min(2000, Math.ceil(delka / krok))));
    }
    $('btnCsv').disabled = !S.profilBody;
    kresliProfil();
  }

  // ---------- grafy ----------
  function pripravPlatno(cv) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const cx = cv.getContext('2d'); cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, w, h);
    return { cx, w, h };
  }
  function pekneKroky(min, max, n) {
    const rozsah = max - min || 1, hrubý = rozsah / n, mag = Math.pow(10, Math.floor(Math.log10(hrubý)));
    const k = [1, 2, 2.5, 5, 10].map(f => f * mag).find(f => f >= hrubý) || 10 * mag;
    const out = []; for (let v = Math.ceil(min / k) * k; v <= max + k * 1e-6; v += k) out.push(+v.toFixed(10));
    return { kroky: out, krok: k };
  }
  const desetiny = k => k >= 1 ? 0 : k >= 0.1 ? 1 : 2;
  function osy(cx, w, h, ok, xr, yr, xpopis, ypopis, yPrava) {
    const barvaT = css('--text-muted'), barvaM = css('--border');
    cx.font = '11px ' + (css('--font') || 'sans-serif'); cx.fillStyle = barvaT; cx.strokeStyle = barvaM; cx.lineWidth = 1;
    const X = v => ok.l + (v - xr[0]) / (xr[1] - xr[0] || 1) * (w - ok.l - ok.r), Y = v => h - ok.b - (v - yr[0]) / (yr[1] - yr[0] || 1) * (h - ok.t - ok.b);
    const yk = pekneKroky(yr[0], yr[1], 5);
    cx.textAlign = 'right'; cx.textBaseline = 'middle';
    for (const v of yk.kroky) { const y = Y(v); cx.beginPath(); cx.moveTo(ok.l, y); cx.lineTo(w - ok.r, y); cx.stroke(); cx.fillText(J.cislo(v, desetiny(yk.krok)), ok.l - 4, y); }
    const xk = pekneKroky(xr[0], xr[1], Math.max(2, Math.floor((w - ok.l - ok.r) / 70)));
    cx.textAlign = 'center'; cx.textBaseline = 'top';
    for (const v of xk.kroky) { const x = X(v); cx.beginPath(); cx.moveTo(x, h - ok.b); cx.lineTo(x, h - ok.b + 3); cx.stroke(); cx.fillText(J.cislo(v, desetiny(xk.krok)), x, h - ok.b + 4); }
    cx.textAlign = 'left'; cx.fillText(xpopis, ok.l, h - 13);
    cx.save(); cx.translate(10, ok.t); cx.textAlign = 'left'; cx.textBaseline = 'top'; cx.fillText(ypopis, 0, -12); cx.restore();
    return { X, Y };
  }
  function kresliProfil(hoverX) {
    const cv = $('grafProfil'), { cx, w, h } = pripravPlatno(cv);
    const body = S.profilBody;
    if (!body || !S.m) { cx.fillStyle = css('--text-muted'); cx.font = '13px sans-serif'; cx.textAlign = 'center'; cx.fillText('Profil zatím není zadaný', w / 2, h / 2); return; }
    const zs = body.map(p => p.vyska).filter(isFinite);
    if (!zs.length) { $('profilInfo').textContent = 'Profil leží mimo načtená data.'; return; }
    const Lh = S.hladina, klic = aktualniKlic(), bezZdroje = N.rezim === 'propojena' && !S.zdroje.length && !N.okraj;
    let lo = Math.min(...zs), hi = Math.max(...zs);
    if (Lh > hi - (hi - lo) * 0.05) hi = Lh + (hi - lo) * 0.08 + 0.5;
    if (Lh < lo) lo = Lh - 0.5;
    const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    const D = body[body.length - 1].vzdalenost, km = D > 3000;
    const ok = { l: 52, r: 12, t: 18, b: 30 };
    const { X, Y } = osy(cx, w, h, ok, [0, km ? D / 1000 : D], [lo, hi], km ? 'vzdálenost (km)' : 'vzdálenost (m)', 'výška (m)');
    const sx = p => X(km ? p.vzdalenost / 1000 : p.vzdalenost);
    // voda
    let mokreM = 0, maxH = 0;
    cx.fillStyle = 'rgba(33,113,181,0.55)';
    for (let k = 1; k < body.length; k++) {
      const p = body[k], q = body[k - 1];
      const m1 = !bezZdroje && p.idx >= 0 && klic[p.idx] < Lh && isFinite(p.vyska), m0 = !bezZdroje && q.idx >= 0 && klic[q.idx] < Lh && isFinite(q.vyska);
      if (m1 && m0) {
        cx.beginPath(); cx.moveTo(sx(q), Y(Lh)); cx.lineTo(sx(p), Y(Lh)); cx.lineTo(sx(p), Y(Math.min(Lh, p.vyska))); cx.lineTo(sx(q), Y(Math.min(Lh, q.vyska))); cx.closePath(); cx.fill();
        mokreM += p.vzdalenost - q.vzdalenost; maxH = Math.max(maxH, Lh - p.vyska, Lh - q.vyska);
      }
    }
    // terén
    cx.beginPath(); let zac = false;
    for (const p of body) { if (!isFinite(p.vyska)) { zac = false; continue; } if (!zac) { cx.moveTo(sx(p), Y(p.vyska)); zac = true; } else cx.lineTo(sx(p), Y(p.vyska)); }
    cx.strokeStyle = css('--text'); cx.lineWidth = 1.6; cx.stroke();
    // hladina
    cx.setLineDash([5, 4]); cx.strokeStyle = '#2171b5'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(ok.l, Y(Lh)); cx.lineTo(w - ok.r, Y(Lh)); cx.stroke(); cx.setLineDash([]);
    cx.fillStyle = css('--text-muted'); cx.textAlign = 'left'; cx.font = '11px sans-serif'; cx.fillText('A', ok.l + 4, ok.t + 2); cx.textAlign = 'right'; cx.fillText('B', w - ok.r - 4, ok.t + 2);
    let info = `Délka ${J.delkaText(D)} · terén ${fm(Math.min(...zs))} – ${fm(Math.max(...zs))} m · pod vodou ${J.delkaText(mokreM)}` + (mokreM ? `, největší hloubka ${fm(maxH)} m` : '');
    if (hoverX !== undefined) {
      const t = (hoverX - ok.l) / (w - ok.l - ok.r); const k = Math.max(0, Math.min(body.length - 1, Math.round(t * (body.length - 1)))), p = body[k];
      cx.strokeStyle = css('--accent'); cx.beginPath(); cx.moveTo(sx(p), ok.t); cx.lineTo(sx(p), h - ok.b); cx.stroke();
      info = `${J.delkaText(p.vzdalenost)} od A: terén ${isFinite(p.vyska) ? fm(p.vyska) + ' m' : 'bez dat'}` + (isFinite(p.vyska) && p.idx >= 0 && !bezZdroje && klic[p.idx] < Lh ? `, hloubka ${fm(Lh - p.vyska)} m` : '');
      if (!profilZnacka) profilZnacka = L.circleMarker([p.lat, p.lon], { radius: 5, color: '#fff', weight: 2, fillColor: '#e8590c', fillOpacity: 1, interactive: false }).addTo(skupProfil);
      else profilZnacka.setLatLng([p.lat, p.lon]);
    }
    $('profilInfo').textContent = info;
  }
  $('grafProfil').addEventListener('pointermove', e => { if (S.profilBody) kresliProfil(e.clientX - $('grafProfil').getBoundingClientRect().left); });
  $('grafProfil').addEventListener('pointerleave', () => { if (profilZnacka) { skupProfil.removeLayer(profilZnacka); profilZnacka = null; } kresliProfil(); });

  function kresliKrivku() {
    const cv = $('grafKrivka'), { cx, w, h } = pripravPlatno(cv);
    if (!S.m) { cx.fillStyle = css('--text-muted'); cx.font = '13px sans-serif'; cx.textAlign = 'center'; cx.fillText('Načtěte výšková data', w / 2, h / 2); return; }
    const bezZdroje = N.rezim === 'propojena' && !S.zdroje.length && !N.okraj;
    if (bezZdroje) { cx.fillStyle = css('--text-muted'); cx.font = '13px sans-serif'; cx.textAlign = 'center'; cx.fillText('Zadejte zdroj vody', w / 2, h / 2); return; }
    const lo = +$('hladinaRozsah').min, hi = +$('hladinaRozsah').max;
    if (!S.krivka) S.krivka = J.krivka(S.m, aktualniKlic(), S.plochy, lo, hi, 200);
    const k = S.krivka, maxA = Math.max(...k.plocha) || 1, maxV = Math.max(...k.objem) || 1;
    const jA = maxA >= 1e6 ? 1e6 : 1e4, jV = maxV >= 1e6 ? 1e6 : 1e3;
    const ok = { l: 52, r: 52, t: 18, b: 30 };
    const { X, Y } = osy(cx, w, h, ok, [lo, hi], [0, maxA / jA * 1.05], 'hladina (m)', jA === 1e6 ? 'plocha (km²)' : 'plocha (ha)');
    // objem – pravá osa
    const Yv = v => h - ok.b - v / (maxV * 1.05) * (h - ok.t - ok.b);
    const vk = pekneKroky(0, maxV / jV * 1.05, 5);
    cx.textAlign = 'left'; cx.textBaseline = 'middle'; cx.fillStyle = '#c2410c';
    for (const v of vk.kroky) cx.fillText(J.cislo(v, desetiny(vk.krok)), w - ok.r + 4, Yv(v * jV));
    cx.textBaseline = 'top'; cx.textAlign = 'right'; cx.fillText(jV === 1e6 ? 'objem (mil. m³)' : 'objem (tis. m³)', w - 4, ok.t - 14);
    const cara = (pole, Yf, barva) => { cx.beginPath(); pole.forEach((v, j) => { const x = X(k.hladiny[j]), y = Yf(v); j ? cx.lineTo(x, y) : cx.moveTo(x, y); }); cx.strokeStyle = barva; cx.lineWidth = 2; cx.stroke(); };
    cara(k.plocha, v => Y(v / jA), '#2171b5');
    cara(k.objem, Yv, '#c2410c');
    const svisla = (L, barva, carky) => { cx.setLineDash(carky); cx.strokeStyle = barva; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(X(L), ok.t); cx.lineTo(X(L), h - ok.b); cx.stroke(); cx.setLineDash([]); };
    if (S.ref !== null) svisla(S.ref, rgb(BARVA_NOVA), [3, 3]);
    svisla(S.hladina, css('--accent'), []);
    $('krivkaInfo').innerHTML = `<span style="color:#2171b5">━</span> plocha · <span style="color:#c2410c">━</span> objem · svislice = hladina ${fm(S.hladina)} m. Kliknutím do grafu nastavíte hladinu.`;
    cv._X = X; cv._ok = ok; cv._rozsah = [lo, hi]; cv._w = w;
  }
  $('grafKrivka').addEventListener('click', e => {
    const cv = $('grafKrivka'); if (!S.m || !cv._ok) return;
    const x = e.clientX - cv.getBoundingClientRect().left, t = (x - cv._ok.l) / (cv._w - cv._ok.l - cv._ok.r);
    if (t >= 0 && t <= 1) nastavHladinu(cv._rozsah[0] + t * (cv._rozsah[1] - cv._rozsah[0]));
  });

  // ---------- měření plochy ----------
  function dokonciPolygon() {
    S.polygon = S.body.slice(); S.body = [];
    prepoctiPolygon();
  }
  function prepoctiPolygon() {
    skupPlocha.clearLayers();
    if (!S.polygon) { $('kartaPlocha').hidden = true; return; }
    L.polygon(S.polygon.map(b => [b.lat, b.lon]), { color: '#7048e8', weight: 2, fillOpacity: 0.08, interactive: false }).addTo(skupPlocha);
    S.polyMaska = S.m ? J.maskaPolygonu(S.m, S.polygon) : null;
    $('kartaPlocha').hidden = false;
    aktualizujPolygonStat();
  }
  function aktualizujPolygonStat() {
    const p = S.polygon; if (!p) return;
    const A = J.plochaPolygonu(p);
    $('pPlocha').textContent = J.plochaText(A); $('pObvod').textContent = J.delkaText(J.obvodPolygonu(p, true));
    if (S.m && S.polyMaska) {
      const bez = N.rezim === 'propojena' && !S.zdroje.length && !N.okraj;
      const s = bez ? { plocha: 0, objem: 0 } : J.vyhodnot(S.m, aktualniKlic(), S.hladina, S.plochy, S.polyMaska.maska);
      $('pZatop').textContent = J.plochaText(s.plocha); $('pObjem').textContent = J.objemText(s.objem);
      $('pZatopD').textContent = A > 0 ? fm(Math.min(100, 100 * s.plocha / A), 1) + ' % plochy' + (S.polyMaska.pocet < 20 ? ' (málo buněk – nepřesné)' : '') : '';
    }
  }

  // ---------- animace ----------
  function stopAnimace() {
    if (S.anim) { cancelAnimationFrame(S.anim.raf); S.anim = null; }
    $('btnAnim').textContent = '▶ Spustit';
  }
  $('animRychlost').value = N.rychlost; $('animSmycka').checked = !!N.smycka;
  $('animRychlost').addEventListener('change', () => { N.rychlost = Math.max(0.01, +$('animRychlost').value || 1); ulozN(); });
  $('animSmycka').addEventListener('change', () => { N.smycka = $('animSmycka').checked; ulozN(); });
  $('btnAnimPodle').addEventListener('click', () => {
    let od = S.rozsah.min;
    if (N.rezim === 'propojena' && S.zdroje.length) {
      const v = S.zdroje.map(z => { const i = J.bunkaZLatLon(S.m, z.lat, z.lon); return i >= 0 ? S.m.vysky[i] : NaN; }).filter(isFinite);
      if (v.length) od = Math.min(...v);
    }
    $('animOd').value = (Math.floor(od * 10) / 10).toFixed(1);
    $('animDo').value = Math.max(S.hladina, od + 0.5).toFixed(1);
  });
  $('btnAnim').addEventListener('click', async () => {
    if (S.anim) { stopAnimace(); return; }
    const od = parseFloat($('animOd').value.replace(',', '.')), doo = parseFloat($('animDo').value.replace(',', '.'));
    const v = Math.max(0.01, parseFloat(String($('animRychlost').value).replace(',', '.')) || 1);
    if (!isFinite(od) || !isFinite(doo) || doo <= od) { Dialog.chyba('Zadejte výšku „Od“ menší než „Do“.'); return; }
    await zajistiKlic();
    S.anim = { t0: performance.now(), od, doo, v };
    $('btnAnim').textContent = '⏸ Zastavit';
    const krok = t => {
      if (!S.anim) return;
      let L = S.anim.od + (t - S.anim.t0) / 1000 * S.anim.v;
      if (L >= S.anim.doo) {
        if ($('animSmycka').checked) { S.anim.t0 = t; L = S.anim.od; }
        else { nastavHladinu(S.anim.doo); stopAnimace(); return; }
      }
      nastavHladinu(L);
      S.anim.raf = requestAnimationFrame(krok);
    };
    S.anim.raf = requestAnimationFrame(krok);
  });

  // ---------- export ----------
  $('btnTiff').addEventListener('click', () => {
    if (!S.m) return;
    const m = S.m, k = aktualniKlic(), L = S.hladina, out = new Float32Array(m.sirka * m.vyska).fill(NaN);
    const bez = N.rezim === 'propojena' && !S.zdroje.length && !N.okraj;
    if (!bez) for (let i = 0; i < out.length; i++) if (k[i] < L) out[i] = L - m.vysky[i];
    const t = RS.zapisGeoTiff(m.sirka, m.vyska, out, [m.x0, m.d, 0, m.y0, 0, -m.d], 3857, -9999);
    stahni(new Blob([t], { type: 'image/tiff' }), `zaplava_hloubky_${J.cislo(L, 2).replace(',', '_')}m_${datumSouboru()}.tif`);
  });
  $('btnCsv').addEventListener('click', () => {
    if (!S.profilBody) return;
    const k = aktualniKlic(), L = S.hladina, bez = N.rezim === 'propojena' && !S.zdroje.length && !N.okraj;
    const r = ['vzdalenost_m;sirka;delka;teren_m;hladina_m;hloubka_m'];
    for (const p of S.profilBody) {
      const mokra = !bez && p.idx >= 0 && k[p.idx] < L && isFinite(p.vyska);
      r.push([p.vzdalenost.toFixed(2), p.lat.toFixed(7), p.lon.toFixed(7), isFinite(p.vyska) ? p.vyska.toFixed(3) : '', L.toFixed(2), mokra ? (L - p.vyska).toFixed(3) : '0'].join(';').replace(/\./g, ','));
    }
    stahni(new Blob(['﻿' + r.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `profil_${datumSouboru()}.csv`);
  });
  $('btnPng').addEventListener('click', async () => {
    try { await exportPng(true); }
    catch (e) {
      if (e && e.name === 'SecurityError') { await exportPng(false); Dialog.info('Podkladová mapa nepovolila export (CORS) – obrázek je bez podkladu.'); }
      else Dialog.chyba('Export se nepodařil: ' + (e && e.message || e));
    }
  });
  async function exportPng(sPodkladem) {
    const kont = mapa.getContainer(), r0 = kont.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(r0.width), H = Math.round(r0.height);
    const cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr;
    const cx = cv.getContext('2d'); cx.scale(dpr, dpr);
    cx.fillStyle = '#e8eaed'; cx.fillRect(0, 0, W, H);
    const rel = el => { const r = el.getBoundingClientRect(); return [r.left - r0.left, r.top - r0.top, r.width, r.height]; };
    if (sPodkladem) kont.querySelectorAll('.leaflet-tile-pane img.leaflet-tile').forEach(img => {
      if (img.complete && img.naturalWidth && img.classList.contains('leaflet-tile-loaded')) { const [x, y, w, h] = rel(img); cx.drawImage(img, x, y, w, h); }
    });
    cx.imageSmoothingEnabled = false;
    if (vrstvaTeren && N.relief !== 'nic') { const [x, y, w, h] = rel(platnoTeren); cx.drawImage(platnoTeren, x, y, w, h); }
    if (vrstvaVoda) { const [x, y, w, h] = rel(platnoVoda); cx.globalAlpha = N.pruhlednost / 100; cx.drawImage(platnoVoda, x, y, w, h); cx.globalAlpha = 1; }
    if (vrstvaOsm) { const [x, y, w, h] = rel(platnoOsm); cx.imageSmoothingEnabled = true; cx.drawImage(platnoOsm, x, y, w, h); }
    if (S.upravy.length) aktivniUpravy().forEach(u => { cx.strokeStyle = u.typ === 'prurva' ? '#e03131' : '#8d5524'; cx.lineWidth = 5; cx.beginPath(); u.body.forEach((q, i) => { const p = mapa.latLngToContainerPoint([q.lat, q.lon]); i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y); }); cx.stroke(); });
    cx.imageSmoothingEnabled = true;
    const bod = (lat, lon) => mapa.latLngToContainerPoint([lat, lon]);
    // vektory
    if (S.profil) { const a = bod(S.profil.a.lat, S.profil.a.lon), b = bod(S.profil.b.lat, S.profil.b.lon);
      cx.strokeStyle = '#e8590c'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
      [['A', a], ['B', b]].forEach(([t, p]) => { cx.fillStyle = '#e8590c'; cx.beginPath(); cx.arc(p.x, p.y, 10, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.font = 'bold 12px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, p.x, p.y); }); }
    if (S.polygon) { cx.strokeStyle = '#7048e8'; cx.lineWidth = 2; cx.beginPath(); S.polygon.forEach((q, i) => { const p = bod(q.lat, q.lon); i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y); }); cx.closePath(); cx.stroke(); }
    if (N.rezim === 'propojena') S.zdroje.forEach(z => { const p = bod(z.lat, z.lon); cx.fillStyle = '#0b63ce'; cx.strokeStyle = '#fff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(p.x, p.y, 7, 0, 7); cx.fill(); cx.stroke(); });
    // hlavička
    const panel = (x, y, w, h) => { cx.fillStyle = 'rgba(255,255,255,0.92)'; cx.strokeStyle = 'rgba(0,0,0,0.25)'; cx.lineWidth = 1; cx.beginPath(); cx.rect(x, y, w, h); cx.fill(); cx.stroke(); };
    cx.textAlign = 'left'; cx.textBaseline = 'top';
    const s = S.stat || {};
    const r1 = `Hladina ${fm(S.hladina)} ${S.meta ? S.meta.jednotka : 'm'} · ${N.rezim === 'vana' ? 'vše pod hladinou' : 'propojené se zdrojem (' + N.sousedstvi + ' sousedé)'}`;
    const r2 = `Zatopeno ${J.plochaText(s.plocha)} · objem ${J.objemText(s.objem)} · max. hloubka ${s.pocet ? fm(s.maxHloubka) + ' m' : '–'}`;
    const r3 = 'Orientační model (bathtub) – NEJDE o předpověď povodně, nezohledňuje průtok, hráze ani proudění.';
    cx.font = 'bold 13px sans-serif'; const sirkaH = Math.min(W - 20, Math.max(cx.measureText(r1).width, (cx.font = '12px sans-serif', cx.measureText(r3).width), cx.measureText(r2).width) + 20);
    panel(10, 10, sirkaH, 62);
    cx.fillStyle = '#111'; cx.font = 'bold 13px sans-serif'; cx.fillText(r1, 20, 17, sirkaH - 20);
    cx.font = '12px sans-serif'; cx.fillText(r2, 20, 35, sirkaH - 20); cx.fillStyle = '#9a3412'; cx.fillText(r3, 20, 52, sirkaH - 20);
    // legenda
    const tridy = popisyTrid(), lh = 16, lw = 132, lH = 22 + tridy.length * lh + (S.ref !== null ? 2 * lh : 0);
    const lx = W - lw - 10, ly = H - lH - 46;
    panel(lx, ly, lw, lH);
    cx.fillStyle = '#111'; cx.font = 'bold 12px sans-serif'; cx.fillText('Hloubka vody', lx + 8, ly + 6);
    cx.font = '11px sans-serif';
    const pol = (c, t, i) => { cx.fillStyle = rgb(c); cx.fillRect(lx + 8, ly + 24 + i * lh, 14, 10); cx.fillStyle = '#111'; cx.fillText(t, lx + 28, ly + 22 + i * lh); };
    tridy.forEach((t, i) => pol(BARVY_HL[i], t, i));
    if (S.ref !== null) { pol(BARVA_NOVA, 'nově (od ' + fm(S.ref) + ' m)', tridy.length); pol(BARVA_USTUP, 'opadlo', tridy.length + 1); }
    // měřítko
    const c = mapa.getCenter(), p1 = mapa.latLngToContainerPoint(c), ll2 = mapa.containerPointToLatLng([p1.x + 100, p1.y]);
    const m100 = J.haversine(c.lat, c.lng, ll2.lat, ll2.lng), pk = pekneKroky(0, m100, 1).krok, delkaPx = 100 * pk / m100;
    panel(10, H - 66, delkaPx + 20, 26);
    cx.fillStyle = '#111'; cx.fillRect(20, H - 50, delkaPx, 4); cx.font = '11px sans-serif'; cx.fillText(J.delkaText(pk), 20, H - 63);
    // atribuce
    const tmp = document.createElement('div'); tmp.innerHTML = mapa.attributionControl.getContainer().innerHTML;
    const atr = tmp.textContent.replace(/\s+/g, ' ').trim() + (sPodkladem ? '' : ' (bez podkladové mapy)');
    cx.font = '10px sans-serif';
    const radky = []; let rad = '';
    for (const slovo of atr.split(' ')) { if (cx.measureText(rad + ' ' + slovo).width > W - 20) { radky.push(rad); rad = slovo; } else rad = rad ? rad + ' ' + slovo : slovo; }
    radky.push(rad);
    panel(0, H - 6 - radky.length * 12 - 4, W, radky.length * 12 + 10);
    cx.fillStyle = '#333'; radky.forEach((t, i) => cx.fillText(t, 6, H - 6 - radky.length * 12 + i * 12));
    const blob = await new Promise((res, rej) => { try { cv.toBlob(b => b ? res(b) : rej(new Error('prázdný obrázek')), 'image/png'); } catch (e) { rej(e); } });
    stahni(blob, `zaplava_${J.cislo(S.hladina, 2).replace(',', '_')}m_${datumSouboru()}.png`);
    return blob;
  }

  // ---------- IndexedDB: poslední oblast ----------
  function idb() {
    return new Promise((res, rej) => {
      try {
        const r = indexedDB.open('webapp_zaplavy', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('data');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  }
  async function ulozDoIdb() {
    if (!S.m || S.meta.zdroj === 'demo') { try { const db = await idb(); db.transaction('data', 'readwrite').objectStore('data').delete('posledni'); } catch (e) { /* bez IDB */ } return; }
    try {
      const db = await idb(), m = S.m0;
      db.transaction('data', 'readwrite').objectStore('data').put({ sirka: m.sirka, vyska: m.vyska, x0: m.x0, y0: m.y0, d: m.d, vysky: m.vysky, meta: S.meta }, 'posledni');
    } catch (e) { /* plné úložiště – nevadí */ }
  }
  async function obnovZIdb() {
    try {
      const db = await idb();
      const z = await new Promise((res, rej) => { const r = db.transaction('data').objectStore('data').get('posledni'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      if (!z || !z.vysky) return false;
      S.zdroje = ctiLS('zdroje', []).filter(b => b && isFinite(b.lat) && isFinite(b.lon));
      S.hladina = ctiLS('hladina', NaN);
      S.upravy = (ctiLS('upravy', []) || []).filter(u => u && Array.isArray(u.body) && u.body.length >= 2);
      await nastavMrizku(J.vytvorMrizku(z.sirka, z.vyska, z.x0, z.y0, z.d, z.vysky), z.meta, false);
      stav('Obnovena naposledy načtená oblast (' + z.meta.nazev + ').', 'ok');
      return true;
    } catch (e) { return false; }
  }

  // ---------- průvodce v krocích ----------
  function aktualizujKroky() {
    const li = k => document.querySelector(`#kroky [data-krok="${k}"]`);
    const stavK = {
      misto: !!S.m || !!S.oblast || (mapa.getZoom() >= 12),
      teren: !!S.m,
      zdroj: N.rezim === 'vana' ? 'vynechat' : (S.zdroje.length > 0 || N.okraj),
      hladina: !!(S.m && S.stat && S.stat.pocet > 0)
    };
    let aktivni = '';
    for (const k of ['misto', 'teren', 'zdroj', 'hladina']) {
      const e = li(k), h = stavK[k];
      e.classList.toggle('hotovo', h === true); e.classList.toggle('vynechat', h === 'vynechat'); e.classList.remove('aktivni');
      if (!aktivni && h === false) { aktivni = k; e.classList.add('aktivni'); }
    }
    const RADY = {
      misto: 'Najděte místo (hledání nebo ukázka), nebo přibližte mapu na oblast velkou nejvýš několik km.',
      teren: 'Klikněte na „⛰ Načíst terén zde“ vpravo nahoře v mapě – načte se výřez mapy (v Česku DMR 5G s rozlišením 2 m).',
      zdroj: 'Klikněte na „💧 Přidat zdroj kliknutím“ a pak do koryta řeky v mapě – voda se bude šířit odtud.',
      hladina: 'Posuňte hladinu posuvníkem (nebo ji dopočítejte z objemu vody) – zatopené plochy se zbarví podle hloubky.'
    };
    $('krokRada').textContent = aktivni ? RADY[aktivni] : '';
  }
  mapa.on('zoomend', aktualizujKroky);

  // ---------- hledání místa a ukázky ----------
  // [název, střed oblasti lat, lon, poloviční strana (km), bod na korytě hlavní řeky lat, lon, hladina nad tokem v tom bodě (m)].
  // Body na korytě jsou z OSM (waterway=river), většinou ~700 m proti proudu od centra (Krnov, Malá Strana, Jeseník, Litovel přímo v centru): vodorovná hladina pak zasáhne
  // centrum a směrem po proudu (kde je údolí níž) přibývá hloubka – u řeky s jednotným spádem by to jinak „zatopilo“ jen dolní konec.
  const UKAZKY = [
    ['Praha – Karlín a Holešovice (Vltava, 2002)', 50.0985, 14.452, 1.6, 50.097579, 14.441381, 4],
    ['Praha – Malá Strana a Kampa (Vltava, 2002)', 50.0855, 14.4085, 1.1, 50.086328, 14.411296, 4],
    ['Ústí nad Labem (Labe, 2002)', 50.6607, 14.040, 1.8, 50.651763, 14.043293, 7],
    ['Český Krumlov (Vltava, 2002)', 48.8115, 14.316, 1.0, 48.809335, 14.315331, 4],
    ['Krnov (Opava, 2024)', 50.0897, 17.704, 1.6, 50.087706, 17.703470, 3],
    ['Opava (Opava, 2024)', 49.9387, 17.903, 1.8, 49.946407, 17.901771, 3],
    ['Jeseník (Bělá, 2024)', 50.2294, 17.205, 1.2, 50.228145, 17.208897, 2.5],
    ['Litovel (Morava, 1997)', 49.7012, 17.076, 1.4, 49.705114, 17.076001, 3],
    ['Troubky (Bečva, 1997)', 49.4317, 17.345, 1.4, 49.440598, 17.344387, 3.5]
  ];
  UKAZKY.forEach((u, i) => $('ukazky').add(new Option(u[0], i)));
  $('ukazky').addEventListener('change', () => { if ($('ukazky').value !== '') vyberUkazku(+$('ukazky').value); });
  async function vyberUkazku(i) {
    const [nazev, lat, lon, km, rLat, rLon, nad] = UKAZKY[i];
    const dLat = km * 1000 / 111320, dLon = dLat / Math.cos(lat * Math.PI / 180);
    S.oblast = { xmin: J.lonNaMerc(lon - dLon), xmax: J.lonNaMerc(lon + dLon), ymin: J.latNaMerc(lat - dLat), ymax: J.latNaMerc(lat + dLat) };
    mapa.fitBounds([[lat - dLat, lon - dLon], [lat + dLat, lon + dLon]], { animate: false });
    S.upravy = []; S.zdroje = []; nakresliUpravy(); nastavZdroj('cuzk');
    S.poNacteni = async () => {
      const m = S.m0, W = m.sirka, i0 = J.bunkaZLatLon(m, rLat, rLon);
      if (i0 < 0) return;
      // hladina toku = nejnižší terén do ~15 m od bodu (DMR 5G má na vodní ploše výšku hladiny při snímkování)
      const c0 = i0 % W, r0 = Math.floor(i0 / W), rad = Math.max(1, Math.round(15 / J.rozmerBunky(m)));
      let min = Infinity;
      for (let r = r0 - rad; r <= r0 + rad; r++) for (let c = c0 - rad; c <= c0 + rad; c++) {
        if (r < 0 || c < 0 || r >= m.vyska || c >= W) continue; const e = m.vysky[r * W + c]; if (e < min) min = e;
      }
      S.zdroje = [{ lat: rLat, lon: rLon }]; aktualizujZdroje();
      document.querySelector('input[name=rezim][value=propojena]').checked = true; N.rezim = 'propojena'; ulozN(); $('volbyPropojeni').hidden = false;
      await zajistiKlic();
      nastavHladinu(Math.round((min + nad) * 10) / 10);
      Dialog.info(`${nazev}: zdroj na korytě, hladina ${J.cislo(nad, 1)} m nad tokem. Jen ilustrace výšek – ne rekonstrukce povodně.`);
    };
    await nactiOnline();
  }
  let posledniHledani = 0;
  $('formHledat').addEventListener('submit', async e => {
    e.preventDefault();
    const q = $('hledat').value.trim(); if (!q) return;
    if (Date.now() - posledniHledani < 1100) return; // Nominatim: nejvýš 1 dotaz za sekundu
    posledniHledani = Date.now();
    const ul = $('vysledkyHledani'); ul.hidden = false; ul.innerHTML = '<li class="napoveda">Hledám…</li>';
    try {
      const odp = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=cs&q=' + encodeURIComponent(q));
      if (!odp.ok) throw new Error('HTTP ' + odp.status);
      const v = await odp.json();
      ul.innerHTML = '';
      if (!v.length) { ul.innerHTML = '<li class="napoveda">Nic nenalezeno.</li>'; return; }
      for (const x of v) {
        const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.textContent = x.display_name;
        b.addEventListener('click', () => {
          const bb = (x.boundingbox || []).map(Number);
          S.oblast = null; skupOblast.clearLayers();
          if (bb.length === 4 && bb.every(isFinite)) mapa.fitBounds([[bb[0], bb[2]], [bb[1], bb[3]]], { maxZoom: 15, animate: false }); else mapa.setView([+x.lat, +x.lon], 14, { animate: false });
          if (mapa.getZoom() < 12) mapa.setZoom(12, { animate: false });
          ul.hidden = true; aktualizujKroky(); aktualizujOblastInfo();
        });
        li.appendChild(b); ul.appendChild(li);
      }
    } catch (err) { ul.innerHTML = '<li class="napoveda">Hledání se nepodařilo (' + err.message + '). Posuňte mapu ručně.</li>'; }
  });
  // tlačítko přímo v mapě
  const TlacZde = L.Control.extend({ options: { position: 'topright' }, onAdd() {
    const b = L.DomUtil.create('button', 'mapa-tlacitko'); b.type = 'button'; b.id = 'btnZde'; b.textContent = '⛰ Načíst terén zde';
    b.title = 'Načte výšková data pro výřez mapy (nebo vyznačenou oblast)';
    L.DomEvent.disableClickPropagation(b); L.DomEvent.on(b, 'click', () => nactiZde()); return b; } });
  new TlacZde().addTo(mapa);
  function nactiZde() {
    if (N.zdroj !== 'cuzk' && N.zdroj !== 'terrarium') nastavZdroj('cuzk');
    return nactiOnline();
  }
  /** Výřez mapy větší než rozumná oblast → vezmi střed. */
  function omezOblast(o) {
    const lat = J.mercNaLat((o.ymin + o.ymax) / 2), c = Math.cos(lat * Math.PI / 180);
    const max = (N.zdroj === 'terrarium' ? 40000 : 8000) / c; // m Mercatoru
    const sx = o.xmax - o.xmin, sy = o.ymax - o.ymin;
    if (sx <= max && sy <= max) return o;
    const cx = (o.xmin + o.xmax) / 2, cy = (o.ymin + o.ymax) / 2, hx = Math.min(sx, max) / 2, hy = Math.min(sy, max) / 2;
    Dialog.info(`Výřez mapy je velký – načítám jen střed ${J.delkaText(2 * hx * c)} × ${J.delkaText(2 * hy * c)}. Pro jinou oblast přibližte mapu nebo vyznačte obdélník.`);
    return { xmin: cx - hx, xmax: cx + hx, ymin: cy - hy, ymax: cy + hy };
  }

  // ---------- hráze a průrvy ----------
  const skupUpravy = L.layerGroup().addTo(mapa);
  const textUpravyPuvodni = $('upravyPorovnani').textContent;
  function aktivniUpravy() { return S.upravyVypnute ? [] : S.upravy.filter(u => u.zapnuto !== false); }
  $('btnHraz').addEventListener('click', () => prepniNastroj('hraz'));
  $('btnPrurva').addEventListener('click', () => prepniNastroj('prurva'));
  $('upravyVypnout').addEventListener('change', () => { S.upravyVypnute = $('upravyVypnout').checked; prepoctiUpravy(); });
  function pridejUpravu(typ, body, vyska, sirka) {
    S.upravy.push({ typ, body, vyska: vyska !== undefined ? vyska : Math.max(0, parseFloat(String($('upravaVyska').value).replace(',', '.')) || 0),
      sirka: sirka !== undefined ? sirka : Math.max(0, parseFloat(String($('upravaSirka').value).replace(',', '.')) || 0), zapnuto: true });
    return prepoctiUpravy();
  }
  async function prepoctiUpravy() {
    pisLS('upravy', S.upravy);
    nakresliUpravy();
    if (!S.m0) return;
    S.upravyVerze++;
    const m0 = S.m0;
    S.m = J.vytvorMrizku(m0.sirka, m0.vyska, m0.x0, m0.y0, m0.d, A.upravVysky(m0, aktivniUpravy()));
    S.stin = J.stinovani(S.m); vykresliTeren();
    S.klic = null; S.krivka = null;
    if (S.profil) prepoctiProfil();
    aktualizuj3dTeren();
    await zajistiKlic(); pozadujVykresleni();
  }
  function nakresliUpravy() {
    skupUpravy.clearLayers();
    const ul = $('seznamUprav'); ul.innerHTML = '';
    S.upravy.forEach((u, k) => {
      const hraz = u.typ !== 'prurva', vyp = u.zapnuto === false || S.upravyVypnute;
      L.polyline(u.body.map(b => [b.lat, b.lon]), { color: hraz ? '#8d5524' : '#e03131', weight: 5, opacity: vyp ? 0.4 : 0.95, dashArray: vyp ? '6 6' : null, pane: 'vrstvyNahore' })
        .bindTooltip(`${hraz ? 'Hráz' : 'Průrva'} ${k + 1}: ${hraz ? '+' : '−'}${fm(u.vyska)} m, šířka ${fm(u.sirka, 0)} m`).addTo(skupUpravy);
      const li = document.createElement('li');
      const lab = document.createElement('label'); lab.className = 'zaskrt'; lab.style.margin = '0';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = u.zapnuto !== false;
      cb.addEventListener('change', () => { u.zapnuto = cb.checked; prepoctiUpravy(); });
      lab.append(cb, document.createTextNode(`${hraz ? '🧱 Hráz' : '⛏️ Průrva'} ${k + 1}: ${hraz ? '+' : '−'}${fm(u.vyska)} m, ${fm(u.sirka, 0)} m, ${J.delkaText(J.obvodPolygonu(u.body, false))}`));
      const b = document.createElement('button'); b.type = 'button'; b.className = 'male'; b.textContent = '×'; b.setAttribute('aria-label', 'Odebrat úpravu ' + (k + 1));
      b.addEventListener('click', () => { S.upravy.splice(k, 1); prepoctiUpravy(); });
      li.append(lab, b); ul.appendChild(li);
    });
  }
  function porovnejUpravy(s, bez) {
    const el = $('upravyPorovnani');
    if (!aktivniUpravy().length || !S.m0) { el.textContent = textUpravyPuvodni; return; }
    const klicB = N.rezim === 'vana' ? S.m0.vysky : (S.klicBez && S.klicBezRezim === podpisKlice() ? S.klicBez : null);
    if (!klicB) { el.textContent = 'Počítám porovnání bez úprav…'; zajistiKlic().then(pozadujVykresleni); return; }
    const b = bez ? { plocha: 0, objem: 0 } : J.vyhodnot(S.m0, klicB, S.hladina, S.plochy);
    const dP = s.plocha - b.plocha, zn = x => x >= 0 ? '+' : '−';
    el.innerHTML = `<b>Porovnání při ${fm(S.hladina)} m:</b> bez úprav ${J.plochaText(b.plocha)} (${J.objemText(b.objem)}), s úpravami ${J.plochaText(s.plocha)} (${J.objemText(s.objem)}) – rozdíl <b>${zn(dP)}${J.plochaText(Math.abs(dP))}</b>.`;
  }

  // ---------- objem → hladina ----------
  $('objemTyp').addEventListener('change', () => { const sr = $('objemTyp').value === 'srazka'; $('objemM3').hidden = sr; $('objemSrazka').hidden = !sr; });
  $('btnObjem').addEventListener('click', () => dopoctiObjem());
  async function dopoctiObjem(V) {
    if (!S.m) return null;
    const cis = id => parseFloat(String($(id).value).replace(',', '.'));
    if (V === undefined) V = $('objemTyp').value === 'srazka' ? A.objemSrazky(cis('srazkaMm'), cis('srazkaKm2'), cis('srazkaKoef')) : cis('objemHod');
    if (!(V > 0)) { Dialog.chyba('Zadejte kladný objem.'); return null; }
    if (N.rezim === 'propojena' && !S.zdroje.length && !N.okraj) { Dialog.chyba('V režimu „propojené se zdrojem“ nejdřív přidejte zdroj vody.'); return null; }
    stopAnimace();
    await zajistiKlic();
    const klic = aktualniKlic(), lo = S.rozsah.min, hi = S.rozsah.max + 30;
    const r = A.hladinaProObjem(S.m, klic, S.plochy, V, lo, hi);
    nastavHladinu(r.hladina);
    let t = `Objem ${J.objemText(V)} → hladina <b>${fm(r.hladina)} m</b>.`;
    if (!r.presne) t += ' ⚠️ Objem se do oblasti nevejde ani při nejvyšší hladině – oblast je pro takový objem malá.';
    else if (r.objem > V * 1.05) t += ` ⚠️ Při této hladině voda přetekla přes práh do další sníženiny a objem skočil na ${J.objemText(r.objem)} – skutečná hladina by se zastavila těsně pod přelivem a sníženina by se plnila postupně.`;
    if (A.dotykOkraje(S.m, klic, r.hladina)) t += ' ⚠️ Voda dosahuje okraje oblasti – ve skutečnosti by část odtekla pryč. Zvětšete oblast.';
    $('objemInfo').innerHTML = t;
    return r;
  }

  // ---------- GeoJSON a odkaz ----------
  function maskaVody() {
    const k = aktualniKlic(), L = S.hladina, mk = new Uint8Array(S.m.sirka * S.m.vyska);
    if (!(N.rezim === 'propojena' && !S.zdroje.length && !N.okraj)) for (let i = 0; i < mk.length; i++) if (k[i] < L) mk[i] = 1;
    return mk;
  }
  async function exportGeojson() {
    if (!S.m) return null;
    await zajistiKlic();
    const s = S.stat || {};
    const gj = A.obrysGeoJson(S.m, maskaVody(), { hladina_m: S.hladina, vyskovy_system: S.meta.vertikal, rezim: N.rezim === 'vana' ? 'vše pod hladinou' : 'propojené se zdrojem',
      sousedstvi: N.rezim === 'vana' ? null : N.sousedstvi, zdroj_dat: S.meta.nazev, rozliseni: S.meta.rozliseni, plocha_m2: Math.round(s.plocha || 0), objem_m3: Math.round(s.objem || 0),
      upravy_terenu: aktivniUpravy().length, vytvoreno: new Date().toISOString(),
      upozorneni: 'Orientační model (bathtub) – nejde o hydrodynamickou předpověď, nezohledňuje průtok, hráze mimo DEM ani proudění.' });
    stahni(new Blob([JSON.stringify(gj)], { type: 'application/geo+json' }), `zaplava_obrys_${J.cislo(S.hladina, 2).replace(',', '_')}m_${datumSouboru()}.geojson`);
    return gj;
  }
  $('btnGeojson').addEventListener('click', () => exportGeojson());
  function odkazSeStavem() {
    if (!S.m0) return '';
    const h = J.hranice(S.m0);
    let zdroj = S.meta.zdroj;
    if (zdroj === 'soubor') zdroj = N.zdroj === 'terrarium' ? 'terrarium' : 'cuzk';
    const hash = A.stavDoHash({ zdroj, oblast: zdroj === 'demo' ? null : h, hladina: S.hladina, rezim: N.rezim, sousedstvi: N.sousedstvi, okraj: N.okraj, zdroje: S.zdroje, upravy: S.upravy });
    try { history.replaceState(null, '', hash); } catch (e) { /* sandbox */ }
    return location.href.split('#')[0] + hash;
  }
  $('btnSdilet').addEventListener('click', async () => {
    const url = odkazSeStavem();
    if (S.meta.zdroj === 'soubor') Dialog.info('Data ze souboru odkaz nepřenese – příjemci se oblast načte z online zdroje.');
    try { await navigator.clipboard.writeText(url); Dialog.info('Odkaz se stavem je ve schránce.'); }
    catch (e) { await Dialog.zeptej('Zkopírujte odkaz:', url); }
  });
  function nactiZHash() {
    const st = A.stavZHash(location.hash);
    if (!st.zdroj) return false;
    N.rezim = st.rezim; N.sousedstvi = st.sousedstvi; N.okraj = st.okraj; ulozN();
    document.querySelectorAll('input[name=rezim]').forEach(r => { r.checked = r.value === N.rezim; });
    $('volbyPropojeni').hidden = N.rezim !== 'propojena'; $('sousedstvi').value = String(N.sousedstvi); $('okraj').checked = N.okraj;
    S.zdroje = st.zdroje; S.upravy = st.upravy; nakresliUpravy();
    if (isFinite(st.hladina)) S.hladina = st.hladina;
    if (st.zdroj === 'demo') {
      nastavZdroj('demo');
      nactiDemo().then(() => { if (isFinite(st.hladina)) nastavHladinu(st.hladina); });
    } else if (st.oblast) {
      nastavZdroj(st.zdroj);
      const o = st.oblast;
      S.oblast = { xmin: J.lonNaMerc(o.zapad), xmax: J.lonNaMerc(o.vychod), ymin: J.latNaMerc(o.jih), ymax: J.latNaMerc(o.sever) };
      mapa.fitBounds([[o.jih, o.zapad], [o.sever, o.vychod]], { animate: false });
      S.poNacteni = async () => { if (isFinite(st.hladina)) nastavHladinu(st.hladina); };
      nactiOnline();
    } else return false;
    return true;
  }

  // ---------- 3D pohled ----------
  function nactiSkript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Nepodařilo se načíst ' + src)); document.head.appendChild(s); });
  }
  async function prepni3d(zap) {
    if (zap === undefined) zap = !S.p3d;
    if (!zap) { if (S.p3d) { S.p3d.zrus(); S.p3d = null; } $('karta3d').hidden = true; $('btn3d').setAttribute('aria-pressed', 'false'); return; }
    $('karta3d').hidden = false; $('btn3d').setAttribute('aria-pressed', 'true');
    try {
      if (!window.THREE) await nactiSkript('lib/three.r128.min.js');
      if (!S.p3d) S.p3d = window.ZaplavyPohled3d.vytvor($('pohled3d'));
      S.p3d.nastavPrevyseni(+$('prevyseni').value);
      aktualizuj3dTeren();
      $('karta3d').scrollIntoView({ block: 'nearest' });
    } catch (e) { $('pohled3d').textContent = '3D pohled není k dispozici (WebGL): ' + e.message; }
  }
  $('btn3d').addEventListener('click', () => prepni3d());
  $('prevyseni').addEventListener('change', () => { if (S.p3d) S.p3d.nastavPrevyseni(+$('prevyseni').value); });
  $('btn3dPng').addEventListener('click', () => {
    if (!S.p3d) return;
    fetch(S.p3d.snimek()).then(r => r.blob()).then(b => stahni(b, `zaplava_3d_${datumSouboru()}.png`));
  });
  function aktualizuj3dTeren() {
    if (!S.p3d || !S.m) return;
    const lo = S.rozsah.min, rng = Math.max(1e-6, S.rozsah.max - lo);
    S.p3d.nastavTeren(S.m, S.stin, e => hypso((e - lo) / rng), J.rozmerBunky(S.m));
    aktualizuj3dVodu();
  }
  function aktualizuj3dVodu() {
    if (!S.p3d || !S.m) return;
    const bez = N.rezim === 'propojena' && !S.zdroje.length && !N.okraj;
    S.p3d.nastavVodu(aktualniKlic(), S.hladina, h => BARVY_HL[tridaHloubky(h)], bez);
  }

  // ---------- dotčené objekty z OSM ----------
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  const ATRIB_OSM = 'Budovy a silnice: © přispěvatelé <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (ODbL) přes Overpass API';
  mapa.createPane('osm').style.zIndex = 380;
  const platnoOsm = document.createElement('canvas'); let vrstvaOsm = null;
  $('btnOsm').addEventListener('click', () => nactiOsm());
  async function nactiOsm() {
    if (!S.m) return;
    const h = J.hranice(S.m), v = mapa.getBounds();
    const s = Math.max(h.jih, v.getSouth()), n = Math.min(h.sever, v.getNorth()), w = Math.max(h.zapad, v.getWest()), e = Math.min(h.vychod, v.getEast());
    if (!(s < n && w < e)) { Dialog.chyba('Načtená oblast není ve výřezu mapy.'); return; }
    const pl = J.plochaPolygonu([{ lat: s, lon: w }, { lat: s, lon: e }, { lat: n, lon: e }, { lat: n, lon: w }]);
    if (pl > 30e6) { Dialog.chyba(`Budovy se načítají pro průnik oblasti s výřezem mapy do 30 km² (teď ${J.plochaText(pl)}). Přibližte mapu.`); return; }
    const bb = [s, w, n, e].map(x => x.toFixed(6)).join(',');
    const q = `[out:json][timeout:60];(way["building"](${bb});way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|track|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](${bb}););out geom;`;
    $('btnOsm').disabled = true; $('kartaOsm').hidden = false; $('osmInfo').textContent = 'Stahuji budovy a silnice z OpenStreetMap (Overpass API)…'; $('osmTabulka').innerHTML = '';
    let json = null, chyba = '';
    for (const url of OVERPASS.concat(OVERPASS)) {
      if (chyba) await new Promise(r => setTimeout(r, 2500)); // přetížený server: krátká pauza a další pokus
      try {
        const odp = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        if (!odp.ok) { chyba = 'HTTP ' + odp.status + (odp.status === 429 ? ' (příliš mnoho dotazů)' : odp.status >= 500 ? ' (server přetížený)' : ''); continue; }
        json = await odp.json(); break;
      } catch (err) { chyba = err.message; }
    }
    $('btnOsm').disabled = false;
    if (!json) { $('osmInfo').textContent = 'Overpass API neodpovídá (' + chyba + '). Veřejné servery bývají přetížené – zkuste to za chvíli.'; return; }
    const o = A.rozdelOsm(json), m = S.m;
    S.osm = Object.assign(o, { cas: json.osm3s && json.osm3s.timestamp_osm_base, plocha: pl });
    mapa.attributionControl.removeAttribution(ATRIB_OSM); mapa.attributionControl.addAttribution(ATRIB_OSM);
    planujOsm(0);
  }
  let casOsm = 0;
  function planujOsm(zpozdeni) { if (!S.osm) return; clearTimeout(casOsm); casOsm = setTimeout(spoctiOsm, zpozdeni === undefined ? 150 : zpozdeni); }
  function spoctiOsm() {
    if (!S.osm || !S.m) return;
    const bez = N.rezim === 'propojena' && !S.zdroje.length && !N.okraj, k = aktualniKlic(), L = S.hladina;
    const prazdne = { pocet: 0, zatopeno: 0, podleTrid: new Array(J.TRIDY_HLOUBKY.length + 1).fill(0), seznam: [] };
    const rb = bez ? Object.assign(prazdne, { pocet: S.osm.budovy.length }) : A.dotceneBudovy(S.m, k, L, S.osm.budovy);
    const rs = bez ? { celkem: 0, zatopeno: 0, podleTrid: new Array(J.TRIDY_HLOUBKY.length + 1).fill(0) } : A.delkySilnic(S.m, k, L, S.osm.silnice);
    const tr = popisyTrid();
    let h = '';
    tr.forEach((t, i) => { h += `<tr><td><i style="background:${rgb(BARVY_HL[i])}"></i>${t}</td><td>${J.cislo(rb.podleTrid[i])}</td><td>${J.delkaText(rs.podleTrid[i])}</td></tr>`; });
    h += `<tr class="soucet"><td>Zasaženo celkem</td><td>${J.cislo(rb.zatopeno)} z ${J.cislo(rb.pocet)}</td><td>${J.delkaText(rs.zatopeno)} z ${J.delkaText(rs.celkem)}</td></tr>`;
    $('osmTabulka').innerHTML = h;
    $('osmInfo').textContent = `Výřez ${J.plochaText(S.osm.plocha)}, data OSM k ${S.osm.cas ? new Date(S.osm.cas).toLocaleDateString('cs-CZ') : '?'}. Budova je zasažená, když je pod vodou její těžiště nebo některý roh; hloubka je největší z těchto bodů (sklepy a výška podlahy se neuvažují). Úplnost OSM se liší podle místa.`;
    vykresliOsm(new Map(rb.seznam.map(b => [b.id, b.hloubka])));
  }
  function vykresliOsm(zasazene) {
    if (!S.osm || !S.m) { if (vrstvaOsm) { mapa.removeLayer(vrstvaOsm); vrstvaOsm = null; } return; }
    const m = S.m, f = Math.max(1, Math.min(4, Math.floor(4096 / Math.max(m.sirka, m.vyska))));
    platnoOsm.width = m.sirka * f; platnoOsm.height = m.vyska * f;
    const cx = platnoOsm.getContext('2d'), X = lon => (J.lonNaMerc(lon) - m.x0) / m.d * f, Y = lat => (m.y0 - J.latNaMerc(lat)) / m.d * f;
    cx.lineWidth = Math.max(1, f * 0.5);
    for (const b of S.osm.budovy) {
      if (b.body.length < 3) continue;
      cx.beginPath(); b.body.forEach(([la, lo], i) => i ? cx.lineTo(X(lo), Y(la)) : cx.moveTo(X(lo), Y(la))); cx.closePath();
      const hl = zasazene && zasazene.get(b.id);
      if (hl !== undefined) { cx.fillStyle = 'rgba(214,51,108,0.85)'; cx.fill(); cx.strokeStyle = '#7a0b2f'; cx.stroke(); }
      else { cx.strokeStyle = 'rgba(80,80,80,0.6)'; cx.stroke(); }
    }
    const meze = vrstvaVoda.getBounds();
    if (!vrstvaOsm) vrstvaOsm = new PlatnoVrstva(platnoOsm, meze, { pane: 'osm', interactive: false }).addTo(mapa); else vrstvaOsm.setBounds(meze);
  }

  // ---------- překreslení při změně velikosti / tématu ----------
  let casovacResize = 0;
  window.addEventListener('resize', () => { clearTimeout(casovacResize); casovacResize = setTimeout(() => { mapa.invalidateSize(); kresliProfil(); kresliKrivku(); }, 120); });
  new MutationObserver(() => { kresliProfil(); kresliKrivku(); if (obrysDat) obrysDat.setStyle({ color: css('--accent') }); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------- start ----------
  nastavPodklad(N.podklad);
  nastavZdroj(N.zdroj);
  aktualizujLegendu();
  kresliProfil(); kresliKrivku();
  if (!nactiZHash()) obnovZIdb();
  aktualizujKroky();

  // pro testy a ladění
  window.Zaplavy = { S, N, A, mapa, nactiDemo, pridejUpravu, dopoctiObjem, nactiOsm, prepni3d, odkazSeStavem, exportGeojson, vyberUkazku, nactiZde, nastavHladinu, nastavMrizku, prepniNastroj, exportPng, nactiOnline, zajistiKlic,
    nastavProfil: (a, b) => { S.profil = { a, b }; prepoctiProfil(); },
    nastavPolygon: body => { S.polygon = body; prepoctiPolygon(); },
    nastavOblast: (s, z, j, v) => { S.oblast = { xmin: J.lonNaMerc(z), xmax: J.lonNaMerc(v), ymin: J.latNaMerc(j), ymax: J.latNaMerc(s) }; aktualizujOblastInfo(); },
    nastavRezim: async r => { document.querySelector(`input[name=rezim][value=${r}]`).click(); await zajistiKlic(); },
    zdroj: z => { N.zdroj = z; nastavZdroj(z); } };
})();
