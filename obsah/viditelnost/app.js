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
    zdroj: 'terrarium', detail: 4000000, k: J.K_REFR, zakriveni: true, hB: 1.7, panMeritko: 8, panPrevyseni: 2, panSkryte: false,
    karta: 'vysledek', panel: true, lat: 49.8, lon: 15.5, z: 7, A: null, B: null };
  let N = Object.assign({}, VYCHOZI);
  try { Object.assign(N, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* poškozené nastavení */ }
  const ulozN = () => { try { localStorage.setItem(KLIC, JSON.stringify(N)); } catch (e) { /* plné úložiště */ } };

  const S = { A: null, B: null, rezim: 'a', dem: null, demLos: null, vs: null, pan: null, stat: null, vrcholy: [], vrcholyOh: [],
    vrcholyKlic: '', los: null, nacitani: null, poradi: 0, demId: 0, overlayUrl: null };

  /* ---------- mapa ---------- */
  const OSM_ATR = '© přispěvatelé <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  const PODKLADY = {
    topo: { nazev: 'OpenTopoMap', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', max: 17, atr: OSM_ATR + ', SRTM | styl © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC BY-SA)' },
    osm: { nazev: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, atr: OSM_ATR },
    satelit: { nazev: 'Letecké snímky (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', max: 19, atr: 'Snímky © Esri, Maxar, Earthstar Geographics' }
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
    podkladVrstva = L.tileLayer(p.url, { maxZoom: 19, maxNativeZoom: p.max, attribution: p.atr, crossOrigin: 'anonymous', subdomains: 'abc' }).addTo(mapa);
    podkladVrstva.bringToBack();
  }
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
  let overlay = null;
  mkA.on('dragend', () => { const p = mkA.getLatLng(); nastavA(p.lat, p.lng); });
  mkB.on('dragend', () => { const p = mkB.getLatLng(); nastavB(p.lat, p.lng); });
  mapa.on('click', e => { if (S.rezim === 'b' && S.A) nastavB(e.latlng.lat, e.latlng.lng); else nastavA(e.latlng.lat, e.latlng.lng); });

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
      worker.onmessage = e => { const c = cekajici.get(e.data.id); if (!c) return; cekajici.delete(e.data.id); e.data.typ === 'chyba' ? c.chyba(new Error(e.data.zprava)) : c.ok(e.data); };
      worker.onerror = e => { cekajici.forEach(c => c.chyba(new Error('Výpočet selhal: ' + (e.message || 'chyba workeru')))); cekajici.clear(); worker = null; S.demId = 0; };
    }
    const id = ++idZpravy;
    return new Promise((ok, chyba) => { cekajici.set(id, { ok, chyba }); worker.postMessage(Object.assign({ id }, zprava), prenos || []); });
  }

  /* ---------- pozorovatel a výpočet ---------- */
  function nastavA(lat, lon, bezVypoctu) {
    S.A = { lat, lon }; N.A = [+lat.toFixed(6), +lon.toFixed(6)]; ulozN();
    mkA.setLatLng([lat, lon]).addTo(mapa);
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
      const p = { x: b.x, y: b.y, vyskaOka: N.vyskaOka, dosah, k: N.k, zakriveni: N.zakriveni };
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
  function obrazekPrekryvu() {
    const m = S.dem.m, q = S.vs.potreba, t = N.vyskaCile, rez = N.rezimPrekryvu;
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
    if (!S.vs) return;
    const m = S.dem.m, h = J.hranice(m);
    obrazekPrekryvu().toBlob(b => {
      if (S.overlayUrl) URL.revokeObjectURL(S.overlayUrl);
      S.overlayUrl = URL.createObjectURL(b);
      const meze = [[h.jih, h.zapad], [h.sever, h.vychod]];
      if (overlay) overlay.setUrl(S.overlayUrl).setBounds(L.latLngBounds(meze));
      else overlay = L.imageOverlay(S.overlayUrl, meze, { className: 'pixely', interactive: false }).addTo(mapa);
      overlay.setOpacity(N.pruhlednost / 100);
    });
    if (N.kruh) kruh.setLatLng([S.A.lat, S.A.lon]).setRadius(N.dosah * 1000).addTo(mapa); else kruh.remove();
  }

  function obnovStatistiku() {
    if (!S.vs) return;
    const m = S.dem.m, st = J.statistika(m, S.vs, N.vyskaCile, N.dosah * 1000);
    S.stat = st;
    if (st.maxBod) { const p = J.bunkaNaBod(m, st.maxBod.x, st.maxBod.y); S.nejdal = p; mkNejdal.setLatLng([p.lat, p.lon]).bindTooltip('Nejvzdálenější viditelné místo').addTo(mapa); }
    else mkNejdal.remove();
    vykresliVysledek();
  }

  const popisTridy = (g, i) => i === 0 ? 'vidět' : g === Infinity ? `chybí přes ${BARVY_POTREBY[i - 1][0]} m` : `chybí do ${g} m`;
  function vykresliVysledek() {
    const vs = S.vs, st = S.stat; if (!vs || !st) return;
    const m = S.dem.m, bunka = J.bunkaMetru(m, S.A.lat), t = N.vyskaCile;
    const azN = S.nejdal ? J.azimut(S.A.lat, S.A.lon, S.nejdal.lat, S.nejdal.lon) : null;
    const obzorKoule = J.vzdalenostObzoru(N.vyskaOka, kParam());
    let h = `<div class="souhrn">
      <div class="dlazdice"><b>${J.plochaText(st.plocha)}</b><span>${t ? `viditelná plocha pro cíl ${fm(t, t % 1 ? 1 : 0)} m` : 'viditelná plocha'}</span></div>
      <div class="dlazdice"><b>${fm(st.podil * 100, 1)} %</b><span>z kruhu o poloměru ${fm(N.dosah)} km</span></div>
      <div class="dlazdice"><b>${st.maxD ? km(st.maxD) : '–'}</b><span>${azN !== null ? `nejdál vidět – ${J.smer(azN)} (${fm(azN)}°)` : 'nejdál vidět'}</span></div>
      <div class="dlazdice"><b>${fm(vs.zOka)} m</b><span>oko n. m. (terén ${fm(vs.zTer)} m + ${fm(N.vyskaOka, 1)} m)</span></div>
      <div class="dlazdice"><b>${N.zakriveni ? km(obzorKoule) : '∞'}</b><span>obzor nad hladkou koulí z ${fm(N.vyskaOka, 1)} m</span></div>
    </div>`;
    h += `<div class="legenda">${N.rezimPrekryvu === 'potreba'
      ? BARVY_POTREBY.map(([g, c], i) => `<span><i style="background:rgb(${c})"></i>${popisTridy(g, i)}</span>`).join('')
      : '<span><i style="background:rgb(34,197,94)"></i>vidět</span>' + (N.rezimPrekryvu === 'vidskryte' ? '<span><i style="background:rgba(15,23,42,.6)"></i>skryto</span>' : '')}</div>`;
    const casti = [`Terén: ${esc(S.dem.popis)}, buňka ${km(bunka)}, ${fm(m.sirka)} × ${fm(m.vyska)} buněk`,
      N.zakriveni ? `refrakce k = ${fm(N.k, 2)}` : 'bez zakřivení Země', `výpočet ${fm(S.msVypoctu)} ms`];
    if (st.bezDat > 0.001) casti.push(`<b>${fm(st.bezDat * 100, 1)} % oblasti bez výškových dat</b>`);
    if (S.dem.chyb) casti.push(`nestažené dlaždice: ${S.dem.chyb}`);
    h += `<p class="pozn">${casti.join(' · ')}</p>`;
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
    const seznam = S.vrcholyOh.slice().sort((a, b) => (b.vidi - a.vidi) || ((b.ele || b.zDem) - (a.ele || a.zDem))).slice(0, 800);
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
  const PAN_HORNI = 120;   // místo pro popisky vrcholů
  let panGeom = null;
  function kresliPanoramu() {
    const cv = $('panorama'), pan = S.pan;
    if (!pan) { $('panInfo').textContent = 'Panorama se ukáže po výpočtu viditelnosti.'; return; }
    const pxDeg = +N.panMeritko, pr = +N.panPrevyseni, dosah = N.dosah * 1000;
    let lo = Infinity, hi = -Infinity;
    for (let a = 0; a < pan.pocet; a++) { const u = pan.obzor[a]; if (u === u) { lo = Math.min(lo, u); hi = Math.max(hi, u); } }
    if (!(lo < Infinity)) return;
    lo = Math.max(-45, lo - 3); hi = Math.max(hi + 1.5, 1);
    const sirka = Math.round(360 * pxDeg), vyska = Math.min(2400, Math.round(PAN_HORNI + (hi - lo) * pxDeg * pr + 22));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = sirka * dpr; cv.height = vyska * dpr; cv.style.width = sirka + 'px'; cv.style.height = vyska + 'px';
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dno = vyska - 22, Y = u => dno - (u - lo) * pxDeg * pr;
    panGeom = { pxDeg, Y, lo, dno };
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
    g.fillStyle = tm ? '#111827' : '#f3f4f6'; g.fillRect(0, dno, sirka, 22);
    g.fillStyle = tm ? '#e5e7eb' : '#111827'; g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
    const SV = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'];
    for (let az = 0; az < 360; az += pxDeg >= 8 ? 5 : 10) {
      const x = az * pxDeg, hl = az % 45 === 0;
      g.fillRect(x, dno, 1, hl ? 7 : 4);
      if (hl) { g.font = 'bold 12px system-ui, sans-serif'; g.fillText(SV[az / 45], x + (az ? 0 : 8), dno + 18); g.font = '11px system-ui, sans-serif'; }
      else if (az % (pxDeg >= 16 ? 5 : 15) === 0) g.fillText(az + '°', x, dno + 17);
    }
    g.textAlign = 'left'; g.fillText(fm(0) + '°', 3, Y(0) - 3);
    // vrcholy
    const vrcholy = S.vrcholyOh.filter(v => v.vidi || N.panSkryte).sort((a, b) => (b.vidi - a.vidi) || ((b.ele || b.zDem) - (a.ele || a.zDem)));
    const obsazeno = [];
    g.font = '11px system-ui, sans-serif';
    for (const v of vrcholy) {
      const x = v.az * pxDeg;
      if (obsazeno.some(o => Math.abs(o - x) < 13)) continue;
      obsazeno.push(x);
      const y = Math.max(PAN_HORNI - 4, Y(v.uhel));
      g.strokeStyle = v.vidi ? (tm ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.6)') : 'rgba(128,128,128,.6)';
      g.beginPath(); g.moveTo(x + 0.5, y - 2); g.lineTo(x + 0.5, PAN_HORNI - 8); g.stroke();
      g.save(); g.translate(x + 3, PAN_HORNI - 10); g.rotate(-Math.PI / 3);
      g.fillStyle = v.vidi ? (tm ? '#f9fafb' : '#111827') : (tm ? '#9ca3af' : '#6b7280');
      g.fillText(`${v.nazev} ${v.ele ? fm(v.ele) + ' m' : ''} · ${km(v.d)}`, 0, 0);
      g.restore();
    }
    const nejdal = (() => { let m = 0, a0 = 0; for (let a = 0; a < pan.pocet; a++) if (pan.obzorVzd[a] > m) { m = pan.obzorVzd[a]; a0 = a; } return { m, az: a0 * pan.krokAz }; })();
    $('panInfo').textContent = `Obzor od ${fm(Math.min(...pan.obzor), 2)}° do ${fm(Math.max(...pan.obzor), 2)}° nad vodorovnou rovinou oka; nejvzdálenější obzor ${km(nejdal.m)} na azimutu ${fm(nejdal.az)}° (${J.smer(nejdal.az)}). Převýšení ${pr}×.`;
  }
  $('panorama').addEventListener('click', e => {
    const pan = S.pan; if (!pan || !panGeom) return;
    const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const az = ((x / panGeom.pxDeg) % 360 + 360) % 360, a = Math.min(pan.pocet - 1, Math.round(az / pan.krokAz));
    const u = panGeom.lo + (panGeom.dno - y) / (panGeom.pxDeg * +N.panPrevyseni);
    let d = null;
    for (let i = pan.start[a]; i < pan.start[a + 1]; i++) if (pan.uhel[i] >= u) { d = pan.vzd[i]; break; }
    if (d === null) { $('panInfo').textContent = `Azimut ${fm(az, 1)}° (${J.smer(az)}), výškový úhel ${fm(u, 2)}° – nad obzorem je nebe.`; mkPan.remove(); return; }
    const p = J.cilovyBod(S.A.lat, S.A.lon, az, d);
    mkPan.setLatLng([p.lat, p.lon]).addTo(mapa);
    const blizky = S.vrcholyOh.filter(v => Math.abs(((v.az - az + 540) % 360) - 180) < 1 && Math.abs(v.d - d) < Math.max(1500, d * 0.08)).sort((a, b) => Math.abs(a.d - d) - Math.abs(b.d - d))[0];
    $('panInfo').textContent = `Azimut ${fm(az, 1)}° (${J.smer(az)}), výškový úhel ${fm(u, 2)}°, terén ve vzdálenosti ${km(d)}. Místo je na mapě označené fialovým kroužkem.` + (blizky ? ` Poblíž: ${blizky.nazev}.` : '');
    if (!mapa.getBounds().contains([p.lat, p.lon])) mapa.panTo([p.lat, p.lon]);
  });

  /* ---------- čára pohledu A → B ---------- */
  function nastavB(lat, lon, bezVypoctu) {
    S.B = { lat, lon }; N.B = [+lat.toFixed(6), +lon.toFixed(6)]; ulozN();
    mkB.setLatLng([lat, lon]).addTo(mapa);
    if (!bezVypoctu) { ukazKartu('cara'); spocitejLos(); }
  }
  let poradiLos = 0;
  async function spocitejLos() {
    if (!S.A || !S.B) return;
    const A = Object.assign({ h: N.vyskaOka }, S.A), B = Object.assign({ h: N.hB }, S.B), poradi = ++poradiLos;
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
      Profil je kreslený se zakřivením Země (terén se „vyboulí“ o d·(D−d)/2R'), čára pohledu je pak přímka. Nad hladkou koulí by se tyto výšky viděly na ${N.zakriveni ? km(J.dohledDvou(N.vyskaOka, N.hB, N.k)) : '∞'}.</p>`;
    $('profil').hidden = false;
    kresliProfil();
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
    const a = S.A, b = S.B, h = N.vyskaOka;
    N.vyskaOka = N.hB; N.hB = h; zapisVstupy();
    nastavB(a.lat, a.lon, true); nastavA(b.lat, b.lon);
  });
  $('btnZrusB').addEventListener('click', zrusB);
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
  const potrebaVysledek = () => { if (!S.vs) { Dialog.chyba('Nejdřív spočítejte viditelnost – klikněte do mapy.'); return false; } return true; };
  const doPng = cv => new Promise((ok, chyba) => { try { cv.toBlob(b => b ? ok(b) : chyba(new Error('prázdný obrázek'))); } catch (e) { chyba(e); } });

  async function pngMapa() {
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
    znacka(S.A, 'A', '#2563eb'); znacka(S.B, 'B', '#7c3aed');
    const pata = `Viditelnost z bodu · oko ${fm(N.vyskaOka, 1)} m, dosah ${fm(N.dosah)} km, cíl ${fm(N.vyskaCile)} m · ${S.dem ? S.dem.popis : ''} · podklad: ${PODKLADY[N.podklad].nazev}, © OpenStreetMap`;
    g.font = '11px system-ui, sans-serif'; const w = g.measureText(pata).width + 12;
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(cv.width - w, cv.height - 18, w, 18); g.fillStyle = '#111'; g.fillText(pata, cv.width - w + 6, cv.height - 5);
    try { stahni(await doPng(cv), jmenoSouboru('_mapa.png')); }
    catch (e) { Dialog.chyba('Mapu se nepodařilo uložit jako obrázek (server podkladu nepovolil čtení dlaždic). Zkuste jiný podklad mapy.'); }
  }
  const PRIKAZY = {
    pngMapa,
    async pngPanorama() { if (!potrebaVysledek()) return; stahni(await doPng($('panorama')), jmenoSouboru('_panorama.png')); },
    async pngProfil() { if (!S.los) { Dialog.chyba('Nejdřív zvolte bod B (🎯 Bod B a klik do mapy).'); return; } stahni(await doPng($('profil')), jmenoSouboru('_profil.png')); },
    geojson() {
      if (!potrebaVysledek()) return;
      const m = S.dem.m, krok = Math.max(1, Math.ceil(Math.sqrt(m.sirka * m.vyska / 1.5e6)));
      const ob = J.obdelnikyViditelnosti(m, S.vs.potreba, N.vyskaCile, krok);
      const vl = { nazev: 'viditelná oblast', pozorovatel_lat: S.A.lat, pozorovatel_lon: S.A.lon, vyska_oka_m: N.vyskaOka, dosah_km: N.dosah, vyska_cile_m: N.vyskaCile,
        refrakce_k: N.zakriveni ? N.k : null, zakriveni: N.zakriveni, teren: S.dem.popis, bunka_m: Math.round(J.bunkaMetru(m, S.A.lat) * krok * 10) / 10,
        plocha_km2: Math.round(S.stat.plocha / 1e4) / 100, vytvoreno: new Date().toISOString() };
      const f = [J.geojsonViditelnosti(ob, vl), { type: 'Feature', properties: { nazev: 'pozorovatel A', vyska_oka_m: N.vyskaOka, teren_m: Math.round(S.vs.zTer * 10) / 10 }, geometry: { type: 'Point', coordinates: [S.A.lon, S.A.lat] } }];
      if (S.B && S.los) {
        f.push({ type: 'Feature', properties: { nazev: 'bod B', vyska_m: N.hB }, geometry: { type: 'Point', coordinates: [S.B.lon, S.B.lat] } });
        f.push({ type: 'Feature', properties: { nazev: 'čára pohledu A–B', vidi: S.los.vidi, vzdalenost_m: Math.round(S.los.D), vule_m: Math.round(S.los.minVule * 10) / 10 }, geometry: { type: 'LineString', coordinates: [[S.A.lon, S.A.lat], [S.B.lon, S.B.lat]] } });
      }
      for (const v of S.vrcholyOh) f.push({ type: 'Feature', properties: { nazev: v.nazev, druh: v.druh, ele: v.ele, vidi: v.vidi, vzdalenost_m: Math.round(v.d), azimut: Math.round(v.az * 10) / 10, osm: v.id }, geometry: { type: 'Point', coordinates: [v.lon, v.lat] } });
      stahni(new Blob([JSON.stringify({ type: 'FeatureCollection', features: f })], { type: 'application/geo+json' }), jmenoSouboru('.geojson'));
    },
    async pngGis() {
      if (!potrebaVysledek()) return;
      stahni(await doPng(obrazekPrekryvu()), jmenoSouboru('_rastr.png'));
      setTimeout(() => stahni(new Blob([J.worldFile(S.dem.m)], { type: 'text/plain' }), jmenoSouboru('_rastr.pgw')), 400);
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
    napoveda() { $('dlgNapoveda').showModal(); }
  };

  /* ---------- odkaz v adrese ---------- */
  function ulozHash() {
    if (!S.A) return;
    const p = new URLSearchParams();
    p.set('a', S.A.lat.toFixed(5) + ',' + S.A.lon.toFixed(5)); p.set('h', N.vyskaOka); p.set('r', N.dosah);
    if (S.B) { p.set('b', S.B.lat.toFixed(5) + ',' + S.B.lon.toFixed(5)); p.set('hb', N.hB); }
    if (N.zdroj !== 'terrarium') p.set('z', N.zdroj);
    history.replaceState(null, '', '#' + p.toString());
  }
  function ctiHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const bod = s => { const c = (s || '').split(',').map(Number); return c.length === 2 && c.every(isFinite) && Math.abs(c[0]) <= 85 && Math.abs(c[1]) <= 180 ? c : null; };
    const a = bod(p.get('a')); if (!a) return false;
    const cis = (k, lo, hi) => { const x = parseFloat(p.get(k)); return isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null; };
    if (cis('h', 0, 2000) !== null) N.vyskaOka = cis('h', 0, 2000);
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
    nastavA(lat, lon);
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

  function nastavRezim(r) {
    S.rezim = r;
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === r)));
    $('mapa').classList.toggle('rezim-b', r === 'b');
    if (r === 'b' && !S.A) stav('Nejdřív umístěte pozorovatele A, potom bod B.', true);
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));

  function ukazKartu(k) {
    N.karta = k; ulozN();
    document.querySelectorAll('[data-karta]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.karta === k)));
    ['vysledek', 'panorama', 'cara'].forEach(x => { $('k-' + x).hidden = x !== k; });
    if (!N.panel) prepniPanel(true);
    if (k === 'cara') kresliProfil();
    if (k === 'panorama' && S.pan && S.A) {   // posunout panorama na sever uprostřed
      const o = $('panObal'); if (!o.dataset.posunuto) { o.scrollLeft = 0; o.dataset.posunuto = '1'; }
    }
  }
  document.querySelectorAll('[data-karta]').forEach(b => b.addEventListener('click', () => ukazKartu(b.dataset.karta)));
  function prepniPanel(otevrit) {
    N.panel = otevrit === undefined ? !N.panel : otevrit; ulozN();
    $('panel').classList.toggle('zavreny', !N.panel); $('btnPanel').textContent = N.panel ? '▾' : '▴';
    setTimeout(() => { mapa.invalidateSize(); kresliProfil(); }, 0);
  }
  $('btnPanel').addEventListener('click', () => prepniPanel());

  const cislo = (id, lo, hi) => { const x = parseFloat(String($(id).value).replace(',', '.')); return isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null; };
  function zapisVstupy() {
    $('vyskaOka').value = N.vyskaOka; $('vyskaA').value = N.vyskaOka; $('vyskaB').value = N.hB; $('dosah').value = N.dosah;
    $('vyskaCile').value = N.vyskaCile; $('rezimPrekryvu').value = N.rezimPrekryvu; $('pruhlednost').value = N.pruhlednost;
    $('podklad').value = N.podklad; $('chkVrcholy').checked = N.vrcholy; $('chkKruh').checked = N.kruh;
    $('detail').value = String(N.detail); $('refrakce').value = N.k; $('chkZakriveni').checked = N.zakriveni;
    $('panMeritko').value = String(N.panMeritko); $('panPrevyseni').value = String(N.panPrevyseni); $('panSkryte').checked = N.panSkryte;
    document.querySelectorAll('[data-zdroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.zdroj === N.zdroj)));
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
  $('vyskaOka').addEventListener('change', () => { const x = cislo('vyskaOka', 0, 2000); if (x !== null) N.vyskaOka = x; zmenaVypoctu(); });
  $('vyskaA').addEventListener('change', () => { const x = cislo('vyskaA', 0, 2000); if (x !== null) N.vyskaOka = x; zmenaVypoctu(); });
  $('vyskaB').addEventListener('change', () => { const x = cislo('vyskaB', 0, 2000); if (x !== null) N.hB = x; ulozN(); zapisVstupy(); spocitejLos(); });
  $('dosah').addEventListener('change', () => { const x = cislo('dosah', 1, 100); if (x !== null) N.dosah = x; zmenaVypoctu(); });
  [$('vyskaOka'), $('dosah')].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') { el.dispatchEvent(new Event('change')); } }));
  $('refrakce').addEventListener('change', () => { const x = cislo('refrakce', -1, 0.9); if (x !== null) N.k = x; zmenaVypoctu(); });
  $('chkZakriveni').addEventListener('change', () => { N.zakriveni = $('chkZakriveni').checked; zmenaVypoctu(); });
  $('detail').addEventListener('change', () => { N.detail = +$('detail').value; zmenaVypoctu(); });
  document.querySelectorAll('[data-zdroj]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); N.zdroj = b.dataset.zdroj; zmenaVypoctu(); }));
  $('btnSpocitat').addEventListener('click', () => { clearTimeout(casPlanu); spocitej(); });
  $('vyskaCile').addEventListener('input', () => { const x = cislo('vyskaCile', 0, 1000); if (x === null) return; N.vyskaCile = x; ulozN(); clearTimeout(casPlanu); casPlanu = setTimeout(() => { kresliPrekryv(); obnovStatistiku(); }, 150); });
  $('rezimPrekryvu').addEventListener('change', () => { N.rezimPrekryvu = $('rezimPrekryvu').value; ulozN(); kresliPrekryv(); vykresliVysledek(); });
  $('pruhlednost').addEventListener('input', () => { N.pruhlednost = +$('pruhlednost').value; ulozN(); if (overlay) overlay.setOpacity(N.pruhlednost / 100); });
  $('podklad').addEventListener('change', () => { N.podklad = $('podklad').value; ulozN(); nastavPodklad(); });
  $('chkVrcholy').addEventListener('change', () => { N.vrcholy = $('chkVrcholy').checked; ulozN(); if (N.vrcholy && S.vs) nactiVrcholy(); else { kresliVrcholy(); vykresliVysledek(); kresliPanoramu(); } });
  $('chkKruh').addEventListener('change', () => { N.kruh = $('chkKruh').checked; ulozN(); kresliPrekryv(); });
  $('panMeritko').addEventListener('change', () => { N.panMeritko = +$('panMeritko').value; ulozN(); kresliPanoramu(); });
  $('panPrevyseni').addEventListener('change', () => { N.panPrevyseni = +$('panPrevyseni').value; ulozN(); kresliPanoramu(); });
  $('panSkryte').addEventListener('change', () => { N.panSkryte = $('panSkryte').checked; ulozN(); kresliPanoramu(); });
  new MutationObserver(() => { kresliPanoramu(); kresliProfil(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- start ---------- */
  const zOdkazu = ctiHash();
  zapisVstupy(); ukazKartu(N.karta || 'vysledek'); prepniPanel(N.panel !== false);
  if (N.B && N.A) nastavB(N.B[0], N.B[1], true);
  if (N.A) {
    if (zOdkazu) mapa.setView(N.A, Math.max(9, Math.min(13, 15 - Math.round(Math.log2(N.dosah)))));
    nastavA(N.A[0], N.A[1], !zOdkazu);
    if (!zOdkazu) $('vysledek').innerHTML = '<div class="prazdno">Pozorovatel z minula je na mapě. Výpočet spustíte tlačítkem <b>▶ Spočítat</b> nebo kliknutím jinam do mapy.</div>';
  }
  window.VIDITELNOST_APP = { S, N, spocitej, nastavA, nastavB, ukazKartu, mapa };
})();
