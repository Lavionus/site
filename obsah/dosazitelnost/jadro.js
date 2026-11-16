/* Dosažitelnost za čas (izochrony) – jádro bez DOM (test: _test/dosazitelnost_test.js).
   Dotazy na Valhallu (FOSSGIS), parsování izochron a tras, průnik/sjednocení polygonů
   přes Clipper, plocha na kouli, body v polygonu, Overpass, GeoJSON, uložený stav.
   Geometrie = pole polygonů [[obvod, díra…], …], kruh = [[lon, lat], …] (jako GeoJSON MultiPolygon). */
(function () {
  'use strict';

  const KLIC = 'webapp_dosazitelnost';
  const VALHALLA = 'https://valhalla1.openstreetmap.de';
  /* Limity veřejného serveru FOSSGIS (ověřeno 16. 11. 2026): max 4 kontury v dotazu, max 60 min. */
  const MAX_KONTUR = 4, MAX_MINUT = 60;
  const INTERVALY = [5, 10, 15, 20, 30, 45, 60];
  const MODY = {
    pesky: { nazev: 'Pěšky', ikona: '🚶', costing: 'pedestrian' },
    kolo: { nazev: 'Na kole', ikona: '🚲', costing: 'bicycle' },
    auto: { nazev: 'Autem', ikona: '🚗', costing: 'auto' }
  };
  const BARVY = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#4f46e5', '#0d9488'];
  const BARVA_KOMBINACE = '#e11d48';
  const KATEGORIE_POI = {
    skoly: { nazev: 'Školy a školky', ikona: '🏫', filtry: ['["amenity"~"^(school|kindergarten)$"]'] },
    obchody: { nazev: 'Obchody s potravinami', ikona: '🛒', filtry: ['["shop"~"^(supermarket|convenience|greengrocer|bakery)$"]'] },
    zastavky: { nazev: 'Zastávky MHD a vlaku', ikona: '🚏', filtry: ['["highway"="bus_stop"]', '["railway"~"^(tram_stop|station|halt)$"]'] },
    lekarny: { nazev: 'Lékárny', ikona: '💊', filtry: ['["amenity"="pharmacy"]'] },
    lekari: { nazev: 'Lékaři a nemocnice', ikona: '🩺', filtry: ['["amenity"~"^(doctors|clinic|hospital|dentist)$"]'] },
    sport: { nazev: 'Hřiště a sportoviště', ikona: '⚽', filtry: ['["leisure"~"^(playground|sports_centre|pitch|swimming_pool)$"]'] }
  };
  const R = 6378137; // poloměr Země (WGS84, rovník) – stejný jako u běžných GIS knihoven
  const MERITKO = 1e6; // stupně → celá čísla pro Clipper (~0,1 m)

  /* ---------- Valhalla ---------- */
  function rozdelKontury(minuty, max) {
    max = max || MAX_KONTUR;
    const s = [...new Set(minuty.map(Number).filter(m => m > 0 && m <= MAX_MINUT))].sort((a, b) => a - b);
    const ven = [];
    for (let i = 0; i < s.length; i += max) ven.push(s.slice(i, i + max));
    return ven;
  }
  function urlIsochrony(bod, mod, minuty) {
    const q = { locations: [{ lat: +(+bod.lat).toFixed(6), lon: +(+bod.lon).toFixed(6) }], costing: MODY[mod].costing,
      contours: minuty.map(m => ({ time: m })), polygons: true, denoise: 0.5, generalize: 15 };
    return VALHALLA + '/isochrone?json=' + encodeURIComponent(JSON.stringify(q));
  }
  function urlTrasy(od, kam, mod, jazyk) {
    const q = { locations: [{ lat: +od.lat, lon: +od.lon }, { lat: +kam.lat, lon: +kam.lon }], costing: MODY[mod].costing,
      language: jazyk === 'en' ? 'en-US' : 'cs-CZ', directions_options: { units: 'kilometers' } };
    return VALHALLA + '/route?json=' + encodeURIComponent(JSON.stringify(q));
  }
  /* Srozumitelná zpráva z chybové odpovědi Valhally (nebo HTTP stavu). */
  function chybaValhally(json, status) {
    const k = json && json.error_code;
    if (k === 152 || k === 151) return 'Server odmítl dotaz: ' + json.error + ' (veřejný server povoluje nejvýš ' + MAX_KONTUR + ' intervaly a ' + MAX_MINUT + ' minut).';
    if (k === 171 || k === 442 || k === 443) return 'V blízkosti bodu není žádná cesta pro zvolený druh dopravy, nebo trasa neexistuje. Posuňte bod blíž k silnici či cestě.';
    if (k === 170 || k === 154) return 'Trasa je pro veřejný server příliš dlouhá.';
    if (status === 429) return 'Příliš mnoho dotazů na veřejný server Valhalla – počkejte chvíli a zkuste to znovu.';
    if (status >= 500) return 'Server Valhalla je přetížený nebo nedostupný (HTTP ' + status + '). Zkuste to později.';
    if (json && json.error) return 'Server Valhalla: ' + json.error + (k ? ' (kód ' + k + ')' : '');
    return 'Neočekávaná odpověď serveru' + (status ? ' (HTTP ' + status + ')' : '') + '.';
  }
  /* Odpověď /isochrone → { minuty: geometrie }. Polygon i MultiPolygon, prázdné kruhy vypadnou. */
  function parsujIsochronu(json) {
    if (!json || !Array.isArray(json.features)) throw new Error(chybaValhally(json));
    const ven = {};
    for (const f of json.features) {
      const m = f && f.properties && +f.properties.contour, g = f && f.geometry;
      if (!(m > 0) || !g) continue;
      let pol = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null;
      if (g.type === 'LineString') pol = [[g.coordinates]];
      if (!pol) continue;
      pol = pol.map(p => p.map(uzavriKruh).filter(k => k.length >= 4)).filter(p => p.length);
      ven[m] = (ven[m] || []).concat(pol);
    }
    return ven;
  }
  function uzavriKruh(k) {
    const r = k.map(b => [+b[0], +b[1]]).filter(b => isFinite(b[0]) && isFinite(b[1]));
    if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0].slice());
    return r;
  }
  /* Zakódovaná lomená čára Valhally (polyline, přesnost 6 míst) → [[lat, lon], …] */
  function dekodujPolyline(s, presnost) {
    const f = Math.pow(10, presnost || 6), ven = [];
    let i = 0, lat = 0, lon = 0;
    while (i < s.length) {
      for (const k of [0, 1]) {
        let v = 0, posun = 0, b;
        do { b = s.charCodeAt(i++) - 63; v |= (b & 0x1f) << posun; posun += 5; } while (b >= 0x20);
        const d = (v & 1) ? ~(v >> 1) : (v >> 1);
        if (k === 0) lat += d; else lon += d;
      }
      ven.push([lat / f, lon / f]);
    }
    return ven;
  }
  function parsujTrasu(json) {
    const t = json && json.trip;
    if (!t || !Array.isArray(t.legs) || !t.legs.length) throw new Error(chybaValhally(json));
    const body = [], kroky = [];
    for (const l of t.legs) {
      body.push(...dekodujPolyline(l.shape || ''));
      for (const m of l.maneuvers || []) kroky.push({ text: m.instruction || '', km: +m.length || 0, s: +m.time || 0 });
    }
    return { body, kroky, km: +(t.summary && t.summary.length) || 0, s: +(t.summary && t.summary.time) || 0 };
  }

  /* ---------- plocha na kouli ---------- */
  /* Plocha kruhu na kouli v m² (Chamberlain & Duquette, NASA JPL 2007) – stejná metoda jako turf/Leaflet.draw. */
  function plochaKruhu(k) {
    const n = k.length;
    if (n < 3) return 0;
    let s = 0;
    const rad = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const a = k[i], b = k[(i + 1) % n], c = k[(i + 2) % n];
      s += ((c[0] - a[0]) * rad) * Math.sin(b[1] * rad);
    }
    return Math.abs(s * R * R / 2);
  }
  function plochaGeometrie(g) {
    let s = 0;
    for (const p of g || []) p.forEach((k, i) => { s += i ? -plochaKruhu(k) : plochaKruhu(k); });
    return Math.max(0, s);
  }

  /* ---------- Clipper ---------- */
  function cesty(g) {
    const ven = [];
    for (const p of g || []) for (const k of p) {
      const c = k.map(b => ({ X: Math.round(b[0] * MERITKO), Y: Math.round(b[1] * MERITKO) }));
      if (c.length > 1 && c[0].X === c[c.length - 1].X && c[0].Y === c[c.length - 1].Y) c.pop();
      if (c.length >= 3) ven.push(c);
    }
    return ven;
  }
  function zCesty(c) { const k = c.map(b => [b.X / MERITKO, b.Y / MERITKO]); k.push(k[0].slice()); return k; }
  /* Strom výsledku Clipperu → polygony s dírami (ostrůvky uvnitř děr jsou další polygony). */
  function zeStromu(strom) {
    const ven = [];
    const projdi = uzly => {
      for (const u of uzly) {
        if (u.IsHole()) { projdi(u.Childs()); continue; }
        const p = [zCesty(u.Contour())];
        for (const d of u.Childs()) { p.push(zCesty(d.Contour())); projdi(d.Childs()); }
        ven.push(p);
      }
    };
    projdi(strom.Childs());
    return ven;
  }
  /* Každá geometrie se nejdřív „sjednotí sama se sebou" (sudá-lichá výplň → díry), pak se kombinuje. */
  function kombinuj(CL, geometrie, druh) {
    const g = geometrie.filter(x => x && x.length);
    if (!g.length) return [];
    if (druh === 'prunik' && g.length < geometrie.length) return [];
    const typ = druh === 'prunik' ? CL.ClipType.ctIntersection : CL.ClipType.ctUnion;
    const normuj = x => {
      const c = new CL.Clipper(), t = new CL.PolyTree();
      c.AddPaths(cesty(x), CL.PolyType.ptSubject, true);
      c.Execute(CL.ClipType.ctUnion, t, CL.PolyFillType.pftEvenOdd, CL.PolyFillType.pftEvenOdd);
      return CL.Clipper.PolyTreeToPaths(t);
    };
    let akt = normuj(g[0]);
    for (let i = 1; i < g.length; i++) {
      const c = new CL.Clipper();
      c.AddPaths(akt, CL.PolyType.ptSubject, true);
      c.AddPaths(normuj(g[i]), CL.PolyType.ptClip, true);
      const vys = new CL.Paths();
      c.Execute(typ, vys, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
      akt = vys;
      if (!akt.length && druh === 'prunik') return [];
    }
    const c = new CL.Clipper(), t = new CL.PolyTree();
    c.AddPaths(akt, CL.PolyType.ptSubject, true);
    c.Execute(CL.ClipType.ctUnion, t, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    return zeStromu(t);
  }

  /* ---------- body v polygonu, obálka ---------- */
  function vKruhu(x, y, k) {
    let uvnitr = false;
    for (let i = 0, j = k.length - 1; i < k.length; j = i++) {
      const xi = k[i][0], yi = k[i][1], xj = k[j][0], yj = k[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) uvnitr = !uvnitr;
    }
    return uvnitr;
  }
  function bodVGeometrii(lon, lat, g) {
    for (const p of g || []) if (p.length && vKruhu(lon, lat, p[0]) && !p.slice(1).some(d => vKruhu(lon, lat, d))) return true;
    return false;
  }
  function obalka(g) {
    let z = Infinity, j = Infinity, v = -Infinity, s = -Infinity;
    for (const p of g || []) for (const b of p[0] || []) { z = Math.min(z, b[0]); v = Math.max(v, b[0]); j = Math.min(j, b[1]); s = Math.max(s, b[1]); }
    return isFinite(z) ? { zapad: z, jih: j, vychod: v, sever: s } : null;
  }

  /* ---------- Overpass ---------- */
  function dotazOverpass(ob, kategorie) {
    const bb = [ob.jih, ob.zapad, ob.sever, ob.vychod].map(x => (+x).toFixed(6)).join(',');
    const casti = [];
    for (const k of kategorie) for (const f of (KATEGORIE_POI[k] || { filtry: [] }).filtry) casti.push('nwr' + f + '(' + bb + ');');
    return '[out:json][timeout:60];(' + casti.join('') + ');out center tags 3000;';
  }
  function kategorieObjektu(t) {
    for (const k in KATEGORIE_POI) for (const f of KATEGORIE_POI[k].filtry) {
      const m = /^\["([^"]+)"(=|~)"([^"]+)"\]$/.exec(f);
      const v = t[m[1]];
      if (v !== undefined && (m[2] === '=' ? v === m[3] : new RegExp(m[3]).test(v))) return k;
    }
    return null;
  }
  /* Odpověď Overpassu → body uvnitř geometrie, bez duplicit (stejný název a kategorie do 60 m = jedna zastávka). */
  function parsujOverpass(json, g) {
    const ven = [];
    for (const e of (json && json.elements) || []) {
      const lat = e.lat !== undefined ? e.lat : e.center && e.center.lat, lon = e.lon !== undefined ? e.lon : e.center && e.center.lon;
      const t = e.tags || {};
      if (!isFinite(lat) || !isFinite(lon)) continue;
      const kat = kategorieObjektu(t);
      if (!kat || !bodVGeometrii(lon, lat, g)) continue;
      const nazev = t.name || '';
      if (nazev && ven.some(o => o.kat === kat && o.nazev === nazev && vzdalenost(o.lat, o.lon, lat, lon) < 60)) continue;
      ven.push({ kat, nazev, lat, lon, id: e.type + '/' + e.id });
    }
    return ven;
  }
  function vzdalenost(la1, lo1, la2, lo2) {
    const r = Math.PI / 180, dl = (la2 - la1) * r, dn = (lo2 - lo1) * r;
    const a = Math.sin(dl / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dn / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /* ---------- výstupy ---------- */
  function geojsonGeometrie(g) {
    return g.length === 1 ? { type: 'Polygon', coordinates: g[0] } : { type: 'MultiPolygon', coordinates: g };
  }
  /* vrstvy = [{ geometrie, vlastnosti }] → FeatureCollection (prázdné vrstvy vypadnou) */
  function doGeoJSON(vrstvy) {
    return {
      type: 'FeatureCollection',
      features: vrstvy.filter(v => v.geometrie && v.geometrie.length).map(v => ({
        type: 'Feature', properties: Object.assign({ plocha_km2: +(plochaGeometrie(v.geometrie) / 1e6).toFixed(4) }, v.vlastnosti),
        geometry: geojsonGeometrie(v.geometrie)
      }))
    };
  }
  const cislo = (x, d) => x.toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });
  function formatPlocha(m2) {
    if (!(m2 > 0)) return '0 m²';
    if (m2 < 1e5) return cislo(Math.round(m2 / 10) * 10, 0) + ' m²';
    const km = m2 / 1e6;
    return cislo(km, km < 10 ? 2 : km < 100 ? 1 : 0) + ' km²';
  }
  function formatCas(s) {
    s = Math.round(s / 60);
    return s < 60 ? s + ' min' : Math.floor(s / 60) + ' h ' + (s % 60) + ' min';
  }
  function formatDelka(km) { return km < 1 ? Math.round(km * 1000) + ' m' : cislo(km, km < 10 ? 2 : 1) + ' km'; }

  /* ---------- uložený stav ---------- */
  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const souradnice = (x, min, max) => { x = +x; return isFinite(x) && x >= min && x <= max ? x : null; };
  function normBod(b, i) {
    b = b || {};
    const lat = souradnice(b.lat, -90, 90), lon = souradnice(b.lon, -180, 180);
    if (lat === null || lon === null) return null;
    const limit = Math.round(+b.limit);
    return {
      id: String(b.id || id()), nazev: String(b.nazev || 'Místo ' + ((i || 0) + 1)).slice(0, 80), lat, lon,
      mod: MODY[b.mod] ? b.mod : 'pesky', limit: limit >= 1 && limit <= MAX_MINUT ? limit : 20,
      barva: /^#[0-9a-f]{6}$/i.test(b.barva) ? b.barva : BARVY[(i || 0) % BARVY.length], skryty: !!b.skryty
    };
  }
  function prazdny() { return { body: [], oblibena: [], intervaly: [5, 10, 15, 30], kombinace: 'prunik', poi: ['skoly', 'obchody', 'zastavky'] }; }
  function migruj(d) {
    const p = prazdny();
    if (!d || typeof d !== 'object') return p;
    p.body = (Array.isArray(d.body) ? d.body : []).map(normBod).filter(Boolean).slice(0, 8);
    p.oblibena = (Array.isArray(d.oblibena) ? d.oblibena : []).map((b, i) => normBod(b, i)).filter(Boolean)
      .map(b => ({ id: b.id, nazev: b.nazev, lat: b.lat, lon: b.lon, mod: b.mod, limit: b.limit }));
    if (Array.isArray(d.intervaly)) {
      const iv = rozdelKontury(d.intervaly, 99).flat().slice(0, MAX_KONTUR);
      if (iv.length) p.intervaly = iv;
    }
    if (['prunik', 'sjednoceni', 'zadna'].includes(d.kombinace)) p.kombinace = d.kombinace;
    if (Array.isArray(d.poi)) p.poi = d.poi.filter(k => KATEGORIE_POI[k]);
    if (typeof d.podklad === 'string' && /^[a-z]{1,20}$/.test(d.podklad)) p.podklad = d.podklad;
    if (d.mapa && isFinite(d.mapa.lat) && isFinite(d.mapa.lon) && isFinite(d.mapa.z)) p.mapa = { lat: +d.mapa.lat, lon: +d.mapa.lon, z: +d.mapa.z };
    return p;
  }
  /* Minuty, které je pro bod potřeba spočítat: zvolené intervaly + jeho limit pro kombinaci. */
  function potrebneMinuty(stav, bod) {
    const m = stav.intervaly.slice();
    if (stav.kombinace !== 'zadna' && !m.includes(bod.limit)) m.push(bod.limit);
    return rozdelKontury(m, 99).flat();
  }
  const klicIsochrony = (bod, minuty) => [(+bod.lat).toFixed(5), (+bod.lon).toFixed(5), bod.mod, minuty].join('|');

  const API = {
    KLIC, VALHALLA, MAX_KONTUR, MAX_MINUT, INTERVALY, MODY, BARVY, BARVA_KOMBINACE, KATEGORIE_POI,
    rozdelKontury, urlIsochrony, urlTrasy, chybaValhally, parsujIsochronu, dekodujPolyline, parsujTrasu,
    plochaKruhu, plochaGeometrie, kombinuj, bodVGeometrii, obalka, dotazOverpass, parsujOverpass, vzdalenost,
    doGeoJSON, formatPlocha, formatCas, formatDelka, normBod, prazdny, migruj, potrebneMinuty, klicIsochrony
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.DOSAZ = API;
})();
