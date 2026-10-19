/* ============================================================
   zaplavy/jadro.js – výpočetní jádro orientačního modelu zaplavení.
   Čistý modul bez DOM (testuje se v node).

   Mřížka (DEM) je vždy pravidelná síť ve Web Mercatoru (EPSG:3857):
     { sirka, vyska, x0, y0 (levý horní roh v metrech Mercatoru), d (velikost buňky
       v metrech Mercatoru), vysky: Float32Array (řádky shora, NaN = bez dat) }
   Skutečná velikost buňky na zemi je d·cos φ, plocha (d·cos φ)² – počítáme ji
   přesně jako plochu sférického lichoběžníku R²·Δλ·(sin φ₂ − sin φ₁).

   Dva režimy zaplavení (oba vracejí „klíč“ = hladina, nad kterou je buňka mokrá):
     • vana: buňka je pod vodou, když výška < hladina (klíč = výška),
     • propojená: buňka je pod vodou, když z ní vede k některému zdroji cesta
       přes buňky s výškou < hladina (4 nebo 8 sousedů). Klíč = minimax výška
       cesty („přelivová výška“), spočtený prioritním zaplavováním (Dijkstra
       s maximem místo součtu) – posun hladiny pak nevyžaduje nový výpočet.
   ============================================================ */
(function () {
  'use strict';
  const R = 6378137, D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const OBVOD = 2 * Math.PI * R;

  // ---------- Mercator ----------
  const mercNaLat = y => (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * R2D;
  const mercNaLon = x => x / R * R2D;
  const latNaMerc = lat => R * Math.log(Math.tan(Math.PI / 4 + Math.max(-85.0511287798, Math.min(85.0511287798, lat)) * D2R / 2));
  const lonNaMerc = lon => R * lon * D2R;

  function vytvorMrizku(sirka, vyska, x0, y0, d, vysky) {
    if (!(sirka > 0 && vyska > 0 && d > 0)) throw new Error('Neplatné rozměry mřížky.');
    if (!vysky) vysky = new Float32Array(sirka * vyska).fill(NaN);
    if (vysky.length !== sirka * vyska) throw new Error('Počet výšek neodpovídá rozměrům mřížky.');
    return { sirka, vyska, x0, y0, d, vysky };
  }
  /** Střed buňky (sl, r) v metrech Mercatoru. */
  const stredBunky = (m, sl, r) => [m.x0 + (sl + 0.5) * m.d, m.y0 - (r + 0.5) * m.d];
  /** Spojité souřadnice v mřížce (0,0 = levý horní roh) z Mercatoru. */
  const mercNaMrizku = (m, x, y) => [(x - m.x0) / m.d, (m.y0 - y) / m.d];
  function bunkaZLatLon(m, lat, lon) {
    const [u, v] = mercNaMrizku(m, lonNaMerc(lon), latNaMerc(lat));
    const sl = Math.floor(u), r = Math.floor(v);
    if (sl < 0 || r < 0 || sl >= m.sirka || r >= m.vyska) return -1;
    return r * m.sirka + sl;
  }
  function hranice(m) {
    return { sever: mercNaLat(m.y0), jih: mercNaLat(m.y0 - m.vyska * m.d), zapad: mercNaLon(m.x0), vychod: mercNaLon(m.x0 + m.sirka * m.d) };
  }
  /** Plocha jedné buňky v každém řádku (m²) – přesně na kouli R = 6 378 137 m. */
  function plochyRadku(m) {
    const p = new Float64Array(m.vyska), dl = m.d / R;
    for (let r = 0; r < m.vyska; r++) {
      const f1 = mercNaLat(m.y0 - r * m.d) * D2R, f2 = mercNaLat(m.y0 - (r + 1) * m.d) * D2R;
      p[r] = R * R * dl * (Math.sin(f1) - Math.sin(f2));
    }
    return p;
  }
  /** Rozměr buňky na zemi (m) ve středu mřížky. */
  function rozmerBunky(m) {
    return m.d * Math.cos(mercNaLat(m.y0 - m.vyska * m.d / 2) * D2R);
  }
  function rozsahVysek(m) {
    let min = Infinity, max = -Infinity, n = 0;
    const v = m.vysky;
    for (let i = 0; i < v.length; i++) { const e = v[i]; if (e === e) { if (e < min) min = e; if (e > max) max = e; n++; } }
    return { min, max, platnych: n, chybi: v.length - n };
  }

  // ---------- zaplavení ----------
  function zaplavaVana(m) { return m.vysky; }

  /** Prioritní zaplavení: klíč[i] = nejnižší hladina, při které je buňka i propojená se zdrojem.
   *  zdroje = pole indexů buněk; okraj = voda přitéká i z okraje rastru. Nedosažitelné = Infinity. */
  function zaplavaPropojena(m, zdroje, sousedstvi, okraj) {
    const W = m.sirka, H = m.vyska, N = W * H, v = m.vysky;
    const klic = new Float32Array(N).fill(Infinity);
    const navst = new Uint8Array(N);
    const halda = new Int32Array(N); let n = 0;
    const mensi = (a, b) => klic[a] < klic[b];
    function vloz(i) {
      let k = n++; halda[k] = i;
      while (k > 0) { const p = (k - 1) >> 1; if (mensi(halda[k], halda[p])) { const t = halda[k]; halda[k] = halda[p]; halda[p] = t; k = p; } else break; }
    }
    function vyjmi() {
      const top = halda[0]; halda[0] = halda[--n];
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1; let s = k;
        if (l < n && mensi(halda[l], halda[s])) s = l;
        if (r < n && mensi(halda[r], halda[s])) s = r;
        if (s === k) break;
        const t = halda[k]; halda[k] = halda[s]; halda[s] = t; k = s;
      }
      return top;
    }
    const zasej = i => { if (i < 0 || i >= N || navst[i] || !(v[i] === v[i])) return; navst[i] = 1; klic[i] = v[i]; vloz(i); };
    for (const i of zdroje || []) zasej(i);
    if (okraj) {
      for (let x = 0; x < W; x++) { zasej(x); zasej((H - 1) * W + x); }
      for (let y = 0; y < H; y++) { zasej(y * W); zasej(y * W + W - 1); }
    }
    const osm = sousedstvi === 8;
    const DX = osm ? [1, -1, 0, 0, 1, 1, -1, -1] : [1, -1, 0, 0], DY = osm ? [0, 0, 1, -1, 1, -1, 1, -1] : [0, 0, 1, -1];
    while (n > 0) {
      const i = vyjmi(), x = i % W, y = (i - x) / W, k = klic[i];
      for (let s = 0; s < DX.length; s++) {
        const nx = x + DX[s], ny = y + DY[s];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (navst[j]) continue;
        const e = v[j];
        if (!(e === e)) { navst[j] = 1; continue; }
        navst[j] = 1; klic[j] = e > k ? e : k; vloz(j);
      }
    }
    return klic;
  }

  /** Přímé (nezávislé) zaplavení prohledáváním do šířky pro jednu hladinu – referenční metoda. */
  function zaplavaBfs(m, zdroje, hladina, sousedstvi, okraj) {
    const W = m.sirka, H = m.vyska, N = W * H, v = m.vysky;
    const mokra = new Uint8Array(N), fronta = new Int32Array(N); let a = 0, b = 0;
    const zkus = i => { if (i >= 0 && i < N && !mokra[i] && v[i] < hladina) { mokra[i] = 1; fronta[b++] = i; } };
    for (const i of zdroje || []) zkus(i);
    if (okraj) { for (let x = 0; x < W; x++) { zkus(x); zkus((H - 1) * W + x); } for (let y = 0; y < H; y++) { zkus(y * W); zkus(y * W + W - 1); } }
    while (a < b) {
      const i = fronta[a++], x = i % W, y = (i - x) / W;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (sousedstvi !== 8 && dx && dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) zkus(ny * W + nx);
      }
    }
    return mokra;
  }

  /** Statistika pro hladinu: plocha (m²), objem (m³), max a průměrná hloubka (m). */
  function vyhodnot(m, klic, hladina, plochy, maska) {
    const W = m.sirka, v = m.vysky;
    let pocet = 0, plocha = 0, objem = 0, maxH = 0;
    for (let r = 0; r < m.vyska; r++) {
      const a = plochy[r], z = r * W;
      for (let s = 0; s < W; s++) {
        const i = z + s;
        if (klic[i] < hladina && (!maska || maska[i])) {
          const h = hladina - v[i];
          pocet++; plocha += a; objem += h * a; if (h > maxH) maxH = h;
        }
      }
    }
    return { pocet, plocha, objem, maxHloubka: maxH, prumHloubka: plocha > 0 ? objem / plocha : 0 };
  }

  /** Křivka plocha/objem v závislosti na hladině (hodnoty přesné v uzlech). */
  function krivka(m, klic, plochy, hMin, hMax, kroku) {
    kroku = Math.max(2, kroku | 0);
    const krok = (hMax - hMin) / kroku;
    const A = new Float64Array(kroku + 1), EA = new Float64Array(kroku + 1);
    const W = m.sirka, v = m.vysky;
    for (let r = 0; r < m.vyska; r++) {
      const a = plochy[r];
      for (let s = 0; s < W; s++) {
        const i = r * W + s, k = klic[i];
        if (!(k < hMax)) continue;
        // buňka je mokrá pro všechny uzly L_j > k → první takový uzel
        let j = k < hMin ? 0 : Math.floor((k - hMin) / krok) + 1;
        while (j > 0 && hMin + (j - 1) * krok > k) j--;        // ošetření zaokrouhlení
        while (j <= kroku && !(hMin + j * krok > k)) j++;
        if (j > kroku) continue;
        A[j] += a; EA[j] += v[i] * a;
      }
    }
    const hladiny = [], plocha = [], objem = [];
    let sa = 0, se = 0;
    for (let j = 0; j <= kroku; j++) {
      sa += A[j]; se += EA[j];
      const L = hMin + j * krok;
      hladiny.push(L); plocha.push(sa); objem.push(Math.max(0, L * sa - se));
    }
    return { hladiny, plocha, objem };
  }

  // ---------- interpolace, profil ----------
  function vyskaBilin(m, u, v) {
    // u, v spojité souřadnice (0 = hrana); středy buněk na +0,5
    const W = m.sirka, H = m.vyska, z = m.vysky;
    const x = u - 0.5, y = v - 0.5;
    if (x < -0.5 || y < -0.5 || x > W - 0.5 || y > H - 0.5) return NaN;
    const x0 = Math.max(0, Math.min(W - 1, Math.floor(x))), y0 = Math.max(0, Math.min(H - 1, Math.floor(y)));
    const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
    const fx = Math.max(0, Math.min(1, x - x0)), fy = Math.max(0, Math.min(1, y - y0));
    const a = z[y0 * W + x0], b = z[y0 * W + x1], c = z[y1 * W + x0], d = z[y1 * W + x1];
    if (a === a && b === b && c === c && d === d) return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    const nx = Math.min(W - 1, Math.max(0, Math.round(x))), ny = Math.min(H - 1, Math.max(0, Math.round(y)));
    return z[ny * W + nx];
  }
  function haversine(lat1, lon1, lat2, lon2) {
    const f1 = lat1 * D2R, f2 = lat2 * D2R, df = f2 - f1, dl = (lon2 - lon1) * D2R;
    const h = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  /** Výškový profil mezi body a, b ({lat, lon}); vzorky po přímce na mapě (Mercator). */
  function profil(m, a, b, vzorku) {
    const n = Math.max(2, vzorku | 0);
    const ax = lonNaMerc(a.lon), ay = latNaMerc(a.lat), bx = lonNaMerc(b.lon), by = latNaMerc(b.lat);
    const body = []; let dist = 0, pl = a.lat, po = a.lon;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1), x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      const lat = mercNaLat(y), lon = mercNaLon(x);
      if (k) dist += haversine(pl, po, lat, lon);
      pl = lat; po = lon;
      const [u, v] = mercNaMrizku(m, x, y);
      const sl = Math.floor(u), r = Math.floor(v);
      const idx = sl >= 0 && r >= 0 && sl < m.sirka && r < m.vyska ? r * m.sirka + sl : -1;
      body.push({ vzdalenost: dist, vyska: vyskaBilin(m, u, v), lat, lon, idx });
    }
    return body;
  }

  // ---------- polygony ----------
  /** Plocha polygonu na kouli (m²), body [{lat, lon}]. Přesné pro hrany podél rovnoběžek a poledníků. */
  function plochaPolygonu(body) {
    if (!body || body.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < body.length; i++) {
      const p = body[i], q = body[(i + 1) % body.length];
      s += (q.lon - p.lon) * D2R * (2 + Math.sin(p.lat * D2R) + Math.sin(q.lat * D2R));
    }
    return Math.abs(s * R * R / 2);
  }
  function obvodPolygonu(body, uzavrit) {
    let s = 0;
    for (let i = 0; i + 1 < body.length; i++) s += haversine(body[i].lat, body[i].lon, body[i + 1].lat, body[i + 1].lon);
    if (uzavrit && body.length > 2) { const a = body[body.length - 1], b = body[0]; s += haversine(a.lat, a.lon, b.lat, b.lon); }
    return s;
  }
  function bodVPolygonu(x, y, poly) {
    let uvnitr = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) uvnitr = !uvnitr;
    }
    return uvnitr;
  }
  /** Maska buněk, jejichž střed leží v polygonu ({lat, lon}[]). */
  function maskaPolygonu(m, body) {
    const poly = body.map(b => mercNaMrizku(m, lonNaMerc(b.lon), latNaMerc(b.lat)));
    const maska = new Uint8Array(m.sirka * m.vyska);
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const [x, y] of poly) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    const s0 = Math.max(0, Math.floor(xmin)), s1 = Math.min(m.sirka - 1, Math.ceil(xmax));
    const r0 = Math.max(0, Math.floor(ymin)), r1 = Math.min(m.vyska - 1, Math.ceil(ymax));
    let n = 0;
    for (let r = r0; r <= r1; r++) for (let s = s0; s <= s1; s++) if (bodVPolygonu(s + 0.5, r + 0.5, poly)) { maska[r * m.sirka + s] = 1; n++; }
    return { maska, pocet: n };
  }

  // ---------- dlaždice Terrarium ----------
  const terrariumVyska = (r, g, b) => r * 256 + g + b / 256 - 32768;
  /** Velikost pixelu dlaždice 256 px na zemi (m) pro zoom z a šířku lat. */
  const pixelDlazdice = (z, lat) => OBVOD * Math.cos(lat * D2R) / (256 * Math.pow(2, z));
  /** Rozsah pixelů (globálních, zoom z) pokrývající obdélník v Mercatoru. */
  function pixelyProObdelnik(z, xmin, ymin, xmax, ymax) {
    const k = 256 * Math.pow(2, z) / OBVOD;
    const px0 = Math.floor((xmin + OBVOD / 2) * k), px1 = Math.ceil((xmax + OBVOD / 2) * k);
    const py0 = Math.floor((OBVOD / 2 - ymax) * k), py1 = Math.ceil((OBVOD / 2 - ymin) * k);
    return { px0, py0, px1, py1, sirka: px1 - px0, vyska: py1 - py0,
      tx0: Math.floor(px0 / 256), ty0: Math.floor(py0 / 256), tx1: Math.floor((px1 - 1) / 256), ty1: Math.floor((py1 - 1) / 256) };
  }
  /** Nejvyšší zoom (≤ maxZoom), při kterém má oblast nejvýš maxBunek pixelů. */
  function volbaZoomu(xmin, ymin, xmax, ymax, maxBunek, maxZoom) {
    for (let z = maxZoom; z >= 0; z--) {
      const p = pixelyProObdelnik(z, xmin, ymin, xmax, ymax);
      if (p.sirka * p.vyska <= maxBunek) return z;
    }
    return 0;
  }
  /** Mřížka z pixelového rozsahu Terrarium (zoom z). */
  function mrizkaZPixelu(z, p) {
    const d = OBVOD / (256 * Math.pow(2, z));
    return vytvorMrizku(p.sirka, p.vyska, -OBVOD / 2 + p.px0 * d, OBVOD / 2 - p.py0 * d, d);
  }

  // ---------- stínování reliéfu (Horn, azimut 315°, výška Slunce 45°) ----------
  function stinovani(m, azimut, vyskaSlunce, prevyseni) {
    azimut = azimut === undefined ? 315 : azimut; vyskaSlunce = vyskaSlunce === undefined ? 45 : vyskaSlunce;
    const zf = prevyseni || 1;
    const W = m.sirka, H = m.vyska, v = m.vysky, out = new Uint8Array(W * H);
    const zen = (90 - vyskaSlunce) * D2R, az = (360 - azimut + 90) % 360 * D2R;
    const cz = Math.cos(zen), sz = Math.sin(zen);
    const g = (x, y, c) => { x = Math.max(0, Math.min(W - 1, x)); y = Math.max(0, Math.min(H - 1, y)); const e = v[y * W + x]; return e === e ? e : c; };
    for (let y = 0; y < H; y++) {
      const ds = m.d * Math.cos(mercNaLat(m.y0 - (y + 0.5) * m.d) * D2R);
      for (let x = 0; x < W; x++) {
        const c = v[y * W + x];
        if (!(c === c)) { out[y * W + x] = 0; continue; }
        const a = g(x - 1, y - 1, c), b = g(x, y - 1, c), cc = g(x + 1, y - 1, c);
        const d = g(x - 1, y, c), f = g(x + 1, y, c);
        const gg = g(x - 1, y + 1, c), h = g(x, y + 1, c), i = g(x + 1, y + 1, c);
        const dzdx = ((cc + 2 * f + i) - (a + 2 * d + gg)) / (8 * ds) * zf;
        const dzdy = ((gg + 2 * h + i) - (a + 2 * b + cc)) / (8 * ds) * zf;
        const sklon = Math.atan(Math.hypot(dzdx, dzdy));
        let aspekt = 0;
        if (dzdx !== 0) { aspekt = Math.atan2(dzdy, -dzdx); if (aspekt < 0) aspekt += 2 * Math.PI; }
        else aspekt = dzdy > 0 ? Math.PI / 2 : dzdy < 0 ? 1.5 * Math.PI : 0;
        const hs = 255 * (cz * Math.cos(sklon) + sz * Math.sin(sklon) * Math.cos(az - aspekt));
        out[y * W + x] = Math.max(1, Math.min(255, Math.round(hs)));
      }
    }
    return out;
  }

  // ---------- převzorkování importovaného rastru do Mercatoru ----------
  /** src: výstup rastry.ctiTiff/ctiAsc; sys: projekce.system(kód); maxBunek: limit buněk.
   *  Výsledek: mřížka v Mercatoru s rozlišením odpovídajícím zdroji (bilineárně). */
  function prevzorkuj(src, sys, maxBunek) {
    const A = src.afinni, W = src.sirka, H = src.vyska;
    const det = A[1] * A[5] - A[2] * A[4];
    if (!det) throw new Error('Neplatná georeference rastru.');
    const naPix = (x, y) => { const dx = x - A[0], dy = y - A[3]; return [(A[5] * dx - A[2] * dy) / det, (-A[4] * dx + A[1] * dy) / det]; };
    const naSrc = (c, r) => [A[0] + c * A[1] + r * A[2], A[3] + c * A[4] + r * A[5]];
    // obrys rastru → zeměpisné souřadnice → Mercator
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    const K = 24;
    for (let k = 0; k <= K; k++) for (const [c, r] of [[k / K * W, 0], [k / K * W, H], [0, k / K * H], [W, k / K * H]]) {
      const [sx, sy] = naSrc(c, r), [lon, lat] = sys.zpet(sx, sy);
      if (!isFinite(lon) || !isFinite(lat) || Math.abs(lat) > 85.05) throw new Error('Souřadnice rastru neodpovídají zvolenému systému (' + sys.nazev + ').');
      const mx = lonNaMerc(lon), my = latNaMerc(lat);
      xmin = Math.min(xmin, mx); xmax = Math.max(xmax, mx); ymin = Math.min(ymin, my); ymax = Math.max(ymax, my);
    }
    const latS = mercNaLat((ymin + ymax) / 2), cs = Math.cos(latS * D2R);
    // rozlišení zdroje na zemi
    const [c0lon, c0lat] = sys.zpet(...naSrc(W / 2, H / 2)), [c1lon, c1lat] = sys.zpet(...naSrc(W / 2 + 1, H / 2)), [c2lon, c2lat] = sys.zpet(...naSrc(W / 2, H / 2 + 1));
    const krokZeme = Math.min(haversine(c0lat, c0lon, c1lat, c1lon), haversine(c0lat, c0lon, c2lat, c2lon));
    let d = krokZeme / cs;
    let sirka = Math.ceil((xmax - xmin) / d), vyska = Math.ceil((ymax - ymin) / d);
    if (sirka * vyska > maxBunek) { const f = Math.sqrt(sirka * vyska / maxBunek); d *= f; sirka = Math.ceil((xmax - xmin) / d); vyska = Math.ceil((ymax - ymin) / d); }
    const m = vytvorMrizku(sirka, vyska, xmin, ymax, d);
    const s = src.data, out = m.vysky;
    // přesná transformace v řídké síti (krok 16 buněk), mezi uzly bilineárně
    const KR = 16, gw = Math.ceil(sirka / KR) + 1, gh = Math.ceil(vyska / KR) + 1;
    const gu = new Float64Array(gw * gh), gv = new Float64Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const mx = xmin + (i * KR + 0.5) * d, my = ymax - (j * KR + 0.5) * d;
      const [px, py] = naPix(...sys.vpred(mercNaLon(mx), mercNaLat(my)));
      gu[j * gw + i] = px; gv[j * gw + i] = py;
    }
    const zmen = Math.max(1, d * cs / krokZeme); // při zmenšení průměrujeme okolí
    for (let r = 0; r < vyska; r++) {
      const j = Math.floor(r / KR), fy = (r - j * KR) / KR;
      for (let c = 0; c < sirka; c++) {
        const i = Math.floor(c / KR), fx = (c - i * KR) / KR;
        const a = j * gw + i, b = a + 1, cc = a + gw, dd = cc + 1;
        const u = (gu[a] * (1 - fx) + gu[b] * fx) * (1 - fy) + (gu[cc] * (1 - fx) + gu[dd] * fx) * fy;
        const v = (gv[a] * (1 - fx) + gv[b] * fx) * (1 - fy) + (gv[cc] * (1 - fx) + gv[dd] * fx) * fy;
        out[r * sirka + c] = zmen > 1.5 ? prumerOkna(s, W, H, u, v, zmen) : bilinRastr(s, W, H, u, v);
      }
    }
    return m;
  }
  function bilinRastr(s, W, H, u, v) {
    const x = u - 0.5, y = v - 0.5;
    if (x < -0.5 || y < -0.5 || x > W - 0.5 || y > H - 0.5) return NaN;
    const x0 = Math.max(0, Math.min(W - 1, Math.floor(x))), y0 = Math.max(0, Math.min(H - 1, Math.floor(y)));
    const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
    const fx = Math.max(0, Math.min(1, x - x0)), fy = Math.max(0, Math.min(1, y - y0));
    const a = s[y0 * W + x0], b = s[y0 * W + x1], c = s[y1 * W + x0], d = s[y1 * W + x1];
    if (a === a && b === b && c === c && d === d) return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    const nx = Math.min(W - 1, Math.max(0, Math.round(x))), ny = Math.min(H - 1, Math.max(0, Math.round(y)));
    return s[ny * W + nx];
  }
  function prumerOkna(s, W, H, u, v, k) {
    const h = k / 2;
    const x0 = Math.max(0, Math.floor(u - h)), x1 = Math.min(W - 1, Math.ceil(u + h) - 1);
    const y0 = Math.max(0, Math.floor(v - h)), y1 = Math.min(H - 1, Math.ceil(v + h) - 1);
    if (x0 > x1 || y0 > y1) return NaN;
    let sum = 0, n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const e = s[y * W + x]; if (e === e) { sum += e; n++; } }
    return n ? sum / n : NaN;
  }

  // ---------- demonstrační terén ----------
  function nahoda(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function sumMrizka(W, H, krok, seed) {
    const rnd = nahoda(seed), gw = Math.ceil(W / krok) + 2, gh = Math.ceil(H / krok) + 2, g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = rnd() * 2 - 1;
    return (x, y) => {
      const u = x / krok, v = y / krok, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = g[j * gw + i], b = g[j * gw + i + 1], c = g[(j + 1) * gw + i], d = g[(j + 1) * gw + i + 1];
      return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
    };
  }
  /** Smyšlené údolí ~4 × 3 km: meandrující řeka (sklon 1 ‰), niva, terasy, přítok
   *  a uzavřená sníženina za valem – na ní je vidět rozdíl mezi oběma režimy. */
  function demoTeren(lat, lon, sirka, vyska, krokM) {
    sirka = sirka || 400; vyska = vyska || 300; krokM = krokM || 10;
    const d = krokM / Math.cos(lat * D2R);
    const x0 = lonNaMerc(lon) - sirka * d / 2, y0 = latNaMerc(lat) + vyska * d / 2;
    const m = vytvorMrizku(sirka, vyska, x0, y0, d);
    const n1 = sumMrizka(sirka, vyska, 40, 11), n2 = sumMrizka(sirka, vyska, 12, 23), n3 = sumMrizka(sirka, vyska, 90, 37);
    const v = m.vysky;
    for (let r = 0; r < vyska; r++) for (let s = 0; s < sirka; s++) {
      const x = s * krokM, y = r * krokM;               // metry od levého horního rohu
      const osa = vyska * krokM * 0.52 + 260 * Math.sin(x / 700) + 90 * Math.sin(x / 230 + 1);
      const dist = Math.abs(y - osa);
      const dno = 250 - x * 0.001;                         // spád řeky 1 ‰
      let z;
      if (dist < 14) z = dno - 2.2 * (1 - (dist / 14) ** 2);       // koryto ~2 m
      else if (dist < 420) z = dno + 0.6 + (dist - 14) * 0.004 + 0.4 * n2(s, r); // niva, mírný příčný sklon
      else z = dno + 0.6 + 406 * 0.004 + (dist - 420) * 0.06 + 6 * n1(s, r) + 10 * n3(s, r); // svahy a terasy
      // přítok od severu
      const px = 2600 + 120 * Math.sin(y / 260), pd = Math.abs(x - px);
      if (y < osa - 30 && pd < 160) z = Math.min(z, dno + 0.8 + (osa - y) * 0.012 + pd * 0.02);
      // uzavřená sníženina jižně od řeky za valem (dno pod úrovní nivy)
      const cx = 1300, cy = osa + 300, rr = Math.hypot((x - cx) / 1.4, y - cy);
      if (rr < 150) z = Math.min(z, dno - 1.2 + (rr / 150) ** 2 * 3);
      const val = Math.abs(rr - 175);
      if (val < 14 && rr >= 150) z = Math.max(z, dno + 3.2 - val * 0.05);
      v[r * sirka + s] = Math.round(z * 100) / 100;
    }
    return m;
  }

  // ---------- formátování (cs) ----------
  function cislo(v, des) {
    if (!isFinite(v)) return '–';
    const s = Math.abs(v).toFixed(des === undefined ? 0 : des).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (v < 0 && +s.join('.') !== 0 ? '−' : '') + s.join(',');
  }
  function plochaText(m2) {
    if (!isFinite(m2)) return '–';
    if (m2 >= 1e6) return cislo(m2 / 1e6, m2 >= 1e8 ? 1 : 2) + ' km²';
    if (m2 >= 1e4) return cislo(m2 / 1e4, 2) + ' ha';
    return cislo(m2, 0) + ' m²';
  }
  function objemText(m3) {
    if (!isFinite(m3)) return '–';
    if (m3 >= 1e6) return cislo(m3 / 1e6, 2) + ' mil. m³';
    if (m3 >= 1e3) return cislo(m3 / 1e3, 1) + ' tis. m³';
    return cislo(m3, 0) + ' m³';
  }
  function delkaText(m) {
    if (!isFinite(m)) return '–';
    return m >= 1000 ? cislo(m / 1000, m >= 1e5 ? 0 : 2) + ' km' : cislo(m, m < 10 ? 1 : 0) + ' m';
  }

  const TRIDY_HLOUBKY = [0.5, 1, 2, 3, 5, 10];

  const API = { R, mercNaLat, mercNaLon, latNaMerc, lonNaMerc, vytvorMrizku, stredBunky, mercNaMrizku, bunkaZLatLon, hranice,
    plochyRadku, rozmerBunky, rozsahVysek, zaplavaVana, zaplavaPropojena, zaplavaBfs, vyhodnot, krivka, vyskaBilin, haversine,
    profil, plochaPolygonu, obvodPolygonu, bodVPolygonu, maskaPolygonu, terrariumVyska, pixelDlazdice, pixelyProObdelnik,
    volbaZoomu, mrizkaZPixelu, stinovani, prevzorkuj, demoTeren, cislo, plochaText, objemText, delkaText, TRIDY_HLOUBKY };
  if (typeof module !== 'undefined') module.exports = API; else (typeof window !== 'undefined' ? window : self).ZaplavyJadro = API;
})();
