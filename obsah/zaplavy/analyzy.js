/* ============================================================
   zaplavy/analyzy.js – rozšiřující výpočty (čistý modul bez DOM):
   • úpravy terénu: kreslené hráze/stěny (zvýšení) a průrvy (snížení)
     rasterizované tak, aby čára byla 4-souvislá (voda přes ni neprosákne
     ani při 8 sousedech),
   • hladina pro zadaný objem vody (bisekce nad přesným součtem),
   • obrys zatopení jako GeoJSON (hranice buněk, vnější kruhy proti směru
     hodinových ručiček, díry po směru – RFC 7946),
   • dotčené budovy a silnice z OSM podle hloubky,
   • zakódování stavu do odkazu (#…) a zpět.
   ============================================================ */
(function () {
  'use strict';
  const J = typeof module !== 'undefined' ? require('./jadro.js') : window.ZaplavyJadro;

  // ---------- úpravy terénu ----------
  /** Buňky pod lomenou čarou body [{lat,lon}] o šířce sirkaM (m). Vždy aspoň 4-souvislý pás. */
  function bunkyCary(m, body, sirkaM) {
    const W = m.sirka, H = m.vyska, out = new Set();
    if (!body || body.length < 2) return [];
    const bunka = J.rozmerBunky(m);
    const r = Math.max(Math.SQRT1_2 + 1e-9, (sirkaM || 0) / 2 / bunka); // poloměr v buňkách
    const p = body.map(b => J.mercNaMrizku(m, J.lonNaMerc(b.lon), J.latNaMerc(b.lat)));
    for (let k = 0; k + 1 < p.length; k++) {
      const [ax, ay] = p[k], [bx, by] = p[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + r + 1));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + r + 1));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5, cy = y + 0.5;
        let t = L2 ? ((cx - ax) * dx + (cy - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
        const ex = ax + t * dx - cx, ey = ay + t * dy - cy;
        if (ex * ex + ey * ey <= r * r) out.add(y * W + x);
      }
    }
    return [...out];
  }
  /** Nové pole výšek s úpravami: [{typ:'hraz'|'prurva', body, vyska (m), sirka (m), zapnuto}].
   *  Hráz: výška = terén + vyska (u nejvyššího bodu pod čarou nanejvýš – koruna se nevlní).
   *  Průrva: snížení na (nejnižší terén pod čarou − vyska) – voda projde celou délkou. */
  function upravVysky(m, upravy) {
    const v = new Float32Array(m.vysky);
    for (const u of upravy || []) {
      if (u.zapnuto === false) continue;
      const idx = bunkyCary(m, u.body, u.sirka);
      if (!idx.length) continue;
      const h = Math.max(0, +u.vyska || 0);
      if (u.typ === 'prurva') {
        let min = Infinity; for (const i of idx) { const e = m.vysky[i]; if (e === e && e < min) min = e; }
        if (!isFinite(min)) continue;
        for (const i of idx) if (v[i] === v[i]) v[i] = Math.min(v[i], min - h);
      } else {
        for (const i of idx) if (v[i] === v[i]) v[i] = Math.max(v[i], m.vysky[i] + h);
      }
    }
    return v;
  }

  // ---------- objem → hladina ----------
  /** Hladina, při které je objem vody (m³) roven V. Monotónní funkce → bisekce. */
  function hladinaProObjem(m, klic, plochy, V, lo, hi) {
    if (!(V > 0)) return { hladina: lo, objem: 0, presne: true };
    const obj = L => J.vyhodnot(m, klic, L, plochy).objem;
    let vh = obj(hi);
    if (vh < V) return { hladina: hi, objem: vh, presne: false };
    let a = lo, b = hi;
    for (let i = 0; i < 60 && b - a > 1e-4; i++) { const c = (a + b) / 2; if (obj(c) < V) a = c; else b = c; }
    return { hladina: b, objem: obj(b), presne: true };
  }
  /** Objem srážky: mm × km² × odtokový součinitel → m³. */
  const objemSrazky = (mm, km2, koef) => Math.max(0, mm) / 1000 * Math.max(0, km2) * 1e6 * Math.max(0, Math.min(1, koef === undefined ? 1 : koef));

  /** Dotýká se voda okraje rastru? (pak by ve skutečnosti odtékala pryč) */
  function dotykOkraje(m, klic, L) {
    const W = m.sirka, H = m.vyska;
    for (let x = 0; x < W; x++) if (klic[x] < L || klic[(H - 1) * W + x] < L) return true;
    for (let y = 0; y < H; y++) if (klic[y * W] < L || klic[y * W + W - 1] < L) return true;
    return false;
  }

  // ---------- obrys zatopení → GeoJSON ----------
  /** Uzavřené kruhy hranice masky v souřadnicích mřížky (rohy buněk). Mokrá buňka je vlevo od hrany
   *  při průchodu v souřadnicích s osou y dolů → vnější kruhy jsou v zeměpisných souřadnicích CCW. */
  function kruhyMasky(W, H, mokra) {
    const M = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mokra[y * W + x] ? 1 : 0;
    // hrany: z vrcholu (x,y) do (x',y'); index vrcholu = y*(W+1)+x
    const dalsi = new Map(); // vrchol → seznam navazujících vrcholů
    const pridej = (a, b) => { let s = dalsi.get(a); if (!s) dalsi.set(a, s = []); s.push(b); };
    const V = (x, y) => y * (W + 1) + x;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!M(x, y)) continue;
      // obcházíme buňku tak, aby mokrá byla vpravo v obraze (y dolů) = vlevo v mapě (sever nahoře)
      if (!M(x, y - 1)) pridej(V(x + 1, y), V(x, y));       // horní hrana zprava doleva
      if (!M(x - 1, y)) pridej(V(x, y), V(x, y + 1));       // levá dolů
      if (!M(x, y + 1)) pridej(V(x, y + 1), V(x + 1, y + 1)); // dolní doprava
      if (!M(x + 1, y)) pridej(V(x + 1, y + 1), V(x + 1, y)); // pravá nahoru
    }
    const kruhy = [];
    const sm = (a, b) => [b % (W + 1) - a % (W + 1), Math.floor(b / (W + 1)) - Math.floor(a / (W + 1))];
    for (const [start, sez] of dalsi) {
      while (sez.length) {
        const ring = [start]; let pred = start, akt = sez.pop();
        let bezp = 0;
        while (akt !== start && bezp++ < 1e8) {
          ring.push(akt);
          const s = dalsi.get(akt);
          if (s.length === 1) { pred = akt; akt = s.pop(); continue; }
          // sedlový bod (dva mokré rohy úhlopříčně): zatoč k mokré buňce, ze které přicházíme → buňky dotýkající se rohem tvoří samostatné kruhy
          const [dx, dy] = sm(pred, akt);
          let vyber = 0, nej = 9;
          s.forEach((c, i) => { const [ex, ey] = sm(akt, c); const kr = dx * ey - dy * ex; if (kr < nej) { nej = kr; vyber = i; } });
          pred = akt; akt = s.splice(vyber, 1)[0];
        }
        // vynech body uprostřed rovných úseků
        const zj = [];
        for (let i = 0; i < ring.length; i++) {
          const a = ring[(i - 1 + ring.length) % ring.length], b = ring[i], c = ring[(i + 1) % ring.length];
          const [d1x, d1y] = sm(a, b), [d2x, d2y] = sm(b, c);
          if (d1x * d2y - d1y * d2x !== 0) zj.push([b % (W + 1), Math.floor(b / (W + 1))]);
        }
        if (zj.length >= 3) kruhy.push(zj);
      }
    }
    return kruhy;
  }
  const plochaKruhu = r => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  /** GeoJSON FeatureCollection s MultiPolygonem obrysu; vlastnosti = metadata. */
  function obrysGeoJson(m, mokra, vlastnosti) {
    const kruhy = kruhyMasky(m.sirka, m.vyska, mokra);
    // v souřadnicích obrazu (y dolů): vnější kruh má zápornou plochu (po směru hodin na obrazovce = CCW v mapě)
    const vnejsi = [], diry = [];
    for (const r of kruhy) (plochaKruhu(r) < 0 ? vnejsi : diry).push(r);
    const polygony = vnejsi.map(r => [r]);
    for (const d of diry) {
      const [px, py] = [d[0][0] + 0.5 * Math.sign(d[1][0] - d[0][0] || 0), d[0][1] + 0.5 * Math.sign(d[1][1] - d[0][1] || 0)];
      let nej = -1, nejP = Infinity;
      polygony.forEach((p, i) => { const a = Math.abs(plochaKruhu(p[0])); if (a < nejP && J.bodVPolygonu(px, py, p[0])) { nej = i; nejP = a; } });
      if (nej >= 0) polygony[nej].push(d);
    }
    const naLL = ([x, y]) => { const mx = m.x0 + x * m.d, my = m.y0 - y * m.d; return [+J.mercNaLon(mx).toFixed(7), +J.mercNaLat(my).toFixed(7)]; };
    const coords = polygony.map(p => p.map(r => { const c = r.map(naLL); c.push(c[0]); return c; }));
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: vlastnosti || {},
      geometry: { type: 'MultiPolygon', coordinates: coords } }] };
  }

  // ---------- dotčené objekty z OSM ----------
  /** Hloubka v bodě (lat, lon) nebo NaN, když je sucho / mimo. */
  function hloubkaVBode(m, klic, L, lat, lon) {
    const i = J.bunkaZLatLon(m, lat, lon);
    if (i < 0 || !(klic[i] < L)) return NaN;
    return L - m.vysky[i];
  }
  /** budovy: [{id, body:[[lat,lon],…]}] → { pocet, zatopeno, podleTrid:[…], seznam:[{id, hloubka}] }.
   *  Budova je zasažená, když je pod vodou její těžiště nebo některý roh; hloubka = největší z nich. */
  function dotceneBudovy(m, klic, L, budovy, tridy) {
    tridy = tridy || J.TRIDY_HLOUBKY;
    const podle = new Array(tridy.length + 1).fill(0), seznam = []; let v = 0, pocet = 0;
    for (const b of budovy) {
      if (!b.body || !b.body.length) continue;
      let sl = 0, so = 0; for (const [la, lo] of b.body) { sl += la; so += lo; }
      const t = [sl / b.body.length, so / b.body.length];
      if (J.bunkaZLatLon(m, t[0], t[1]) < 0) continue;
      pocet++;
      let max = NaN;
      for (const [la, lo] of [t].concat(b.body)) { const h = hloubkaVBode(m, klic, L, la, lo); if (h === h && !(h <= max)) max = h; }
      if (max === max) {
        v++; seznam.push({ id: b.id, hloubka: max });
        let k = 0; while (k < tridy.length && max >= tridy[k]) k++; podle[k]++;
      }
    }
    return { pocet, zatopeno: v, podleTrid: podle, seznam };
  }
  /** cesty: [{body:[[lat,lon],…]}] → délka celkem a zatopená podle tříd hloubky (m). */
  function delkySilnic(m, klic, L, cesty, tridy) {
    tridy = tridy || J.TRIDY_HLOUBKY;
    const podle = new Array(tridy.length + 1).fill(0); let celkem = 0, zatop = 0;
    const krok = Math.max(0.5, J.rozmerBunky(m) / 2);
    for (const c of cesty) {
      for (let k = 0; k + 1 < (c.body || []).length; k++) {
        const [a1, o1] = c.body[k], [a2, o2] = c.body[k + 1];
        const d = J.haversine(a1, o1, a2, o2); if (!d) continue;
        const n = Math.max(1, Math.ceil(d / krok));
        for (let j = 0; j < n; j++) {
          const t = (j + 0.5) / n, la = a1 + (a2 - a1) * t, lo = o1 + (o2 - o1) * t;
          if (J.bunkaZLatLon(m, la, lo) < 0) continue;
          celkem += d / n;
          const h = hloubkaVBode(m, klic, L, la, lo);
          if (h === h) { zatop += d / n; let q = 0; while (q < tridy.length && h >= tridy[q]) q++; podle[q] += d / n; }
        }
      }
    }
    return { celkem, zatopeno: zatop, podleTrid: podle };
  }
  /** Overpass JSON (out geom) → {budovy, silnice}. */
  function rozdelOsm(json) {
    const budovy = [], silnice = [];
    for (const e of (json && json.elements) || []) {
      if (e.type !== 'way' || !e.geometry) continue;
      const body = e.geometry.filter(g => g && isFinite(g.lat)).map(g => [g.lat, g.lon]);
      if (e.tags && e.tags.building) budovy.push({ id: e.id, body });
      else if (e.tags && e.tags.highway) silnice.push({ id: e.id, typ: e.tags.highway, body });
    }
    return { budovy, silnice };
  }

  // ---------- stav v odkazu ----------
  const r5 = x => +(+x).toFixed(5);
  function stavDoHash(s) {
    const p = new URLSearchParams();
    if (s.zdroj) p.set('z', s.zdroj);
    if (s.oblast) p.set('b', [s.oblast.jih, s.oblast.zapad, s.oblast.sever, s.oblast.vychod].map(r5).join(','));
    if (isFinite(s.hladina)) p.set('h', (+s.hladina).toFixed(2));
    p.set('r', s.rezim === 'propojena' ? 'p' : 'v');
    if (s.sousedstvi === 8) p.set('n', '8');
    if (s.okraj) p.set('o', '1');
    if (s.zdroje && s.zdroje.length) p.set('s', s.zdroje.map(z => r5(z.lat) + ',' + r5(z.lon)).join(';'));
    if (s.upravy && s.upravy.length) p.set('u', s.upravy.map(u => [u.typ === 'prurva' ? 'p' : 'h', +(+u.vyska).toFixed(2), +(+u.sirka).toFixed(1), u.zapnuto === false ? 0 : 1]
      .concat(u.body.map(b => r5(b.lat) + ' ' + r5(b.lon))).join('_')).join(';'));
    return '#' + p.toString();
  }
  function stavZHash(h) {
    const p = new URLSearchParams(String(h || '').replace(/^#/, '')), s = {};
    const cis = t => { const v = parseFloat(t); return isFinite(v) ? v : NaN; };
    if (['cuzk', 'terrarium', 'demo'].includes(p.get('z'))) s.zdroj = p.get('z');
    const b = (p.get('b') || '').split(',').map(cis);
    if (b.length === 4 && b.every(isFinite) && b[0] < b[2] && b[1] < b[3] && b[0] >= -85 && b[2] <= 85) s.oblast = { jih: b[0], zapad: b[1], sever: b[2], vychod: b[3] };
    if (isFinite(cis(p.get('h')))) s.hladina = cis(p.get('h'));
    s.rezim = p.get('r') === 'p' ? 'propojena' : 'vana';
    s.sousedstvi = p.get('n') === '8' ? 8 : 4;
    s.okraj = p.get('o') === '1';
    s.zdroje = (p.get('s') || '').split(';').map(t => t.split(',').map(cis)).filter(a => a.length === 2 && a.every(isFinite)).map(([lat, lon]) => ({ lat, lon })).slice(0, 50);
    s.upravy = (p.get('u') || '').split(';').filter(Boolean).map(t => {
      const c = t.split('_'); if (c.length < 6) return null;
      const body = c.slice(4).map(q => q.split(' ').map(cis)).filter(a => a.length === 2 && a.every(isFinite)).map(([lat, lon]) => ({ lat, lon }));
      const u = { typ: c[0] === 'p' ? 'prurva' : 'hraz', vyska: cis(c[1]), sirka: cis(c[2]), zapnuto: c[3] !== '0', body };
      return body.length >= 2 && isFinite(u.vyska) && isFinite(u.sirka) ? u : null;
    }).filter(Boolean).slice(0, 50);
    return s;
  }

  const API = { bunkyCary, upravVysky, hladinaProObjem, objemSrazky, dotykOkraje, kruhyMasky, obrysGeoJson, plochaKruhu,
    hloubkaVBode, dotceneBudovy, delkySilnic, rozdelOsm, stavDoHash, stavZHash };
  if (typeof module !== 'undefined') module.exports = API; else window.ZaplavyAnalyzy = API;
})();
