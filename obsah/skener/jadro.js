/* Skener dokumentů – jádro bez DOM (běží i v node).
   Obraz = { data: Uint8ClampedArray RGBA, w, h }, šedý obraz = { g: Uint8Array, w, h }.
   Rohy = [[x,y] ×4] v pořadí levý horní, pravý horní, pravý dolní, levý dolní. */
(function (koren) {
  'use strict';

  const novy = (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), w, h });
  const kopie = img => ({ data: new Uint8ClampedArray(img.data), w: img.w, h: img.h });

  function seda(img) {
    const n = img.w * img.h, g = new Uint8Array(n), d = img.data;
    for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    return { g, w: img.w, h: img.h };
  }

  // integrální obraz (w+1)×(h+1) pro rychlé součty obdélníků
  function integral(g, w, h) {
    const I = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let r = 0;
      for (let x = 0; x < w; x++) { r += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + r; }
    }
    return I;
  }
  // průměr ve čtverci o poloměru r (u okraje oříznutém)
  function rozmaz(s, r) {
    const { g, w, h } = s, I = integral(g, w, h), o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        const sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
        o[y * w + x] = sum / ((x1 - x0) * (y1 - y0));
      }
    }
    return { g: o, w, h };
  }

  function otsu(g) {
    const hist = new Float64Array(256);
    for (let i = 0; i < g.length; i++) hist[g[i]]++;
    let celk = 0; for (let i = 0; i < 256; i++) celk += i * hist[i];
    let wB = 0, sB = 0, nej = -1, prah = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = g.length - wB; if (!wF) break;
      sB += t * hist[t];
      const mB = sB / wB, mF = (celk - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
      if (v > nej) { nej = v; prah = t; }
    }
    return prah;
  }

  // největší souvislá oblast pixelů s maska[i]=1 → { pocet, body (okraj po řádcích) }
  function nejvetsiOblast(maska, w, h) {
    const zn = new Int32Array(w * h), fronta = new Int32Array(w * h);
    let nej = { pocet: 0, id: 0 }, id = 0;
    for (let s = 0; s < w * h; s++) {
      if (!maska[s] || zn[s]) continue;
      id++; let hl = 0, kon = 0; fronta[kon++] = s; zn[s] = id;
      while (hl < kon) {
        const p = fronta[hl++], x = p % w;
        if (x > 0 && maska[p - 1] && !zn[p - 1]) { zn[p - 1] = id; fronta[kon++] = p - 1; }
        if (x < w - 1 && maska[p + 1] && !zn[p + 1]) { zn[p + 1] = id; fronta[kon++] = p + 1; }
        if (p >= w && maska[p - w] && !zn[p - w]) { zn[p - w] = id; fronta[kon++] = p - w; }
        if (p < w * (h - 1) && maska[p + w] && !zn[p + w]) { zn[p + w] = id; fronta[kon++] = p + w; }
      }
      if (kon > nej.pocet) nej = { pocet: kon, id };
    }
    const body = [];
    for (let y = 0; y < h; y++) {
      let a = -1, b = -1;
      for (let x = 0; x < w; x++) if (zn[y * w + x] === nej.id && nej.id) { if (a < 0) a = x; b = x; }
      if (a >= 0) { body.push([a, y]); if (b !== a) body.push([b, y]); }
    }
    return { pocet: nej.pocet, body };
  }

  const kriz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  function obal(body) { // konvexní obal (monotónní řetěz)
    const p = body.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const d = [], hr = [];
    for (const b of p) { while (d.length >= 2 && kriz(d[d.length - 2], d[d.length - 1], b) <= 0) d.pop(); d.push(b); }
    for (let i = p.length - 1; i >= 0; i--) { const b = p[i]; while (hr.length >= 2 && kriz(hr[hr.length - 2], hr[hr.length - 1], b) <= 0) hr.pop(); hr.push(b); }
    return d.slice(0, -1).concat(hr.slice(0, -1));
  }
  function plocha(q) {
    let s = 0;
    for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(s) / 2;
  }
  // seřadí 4 body na LH, PH, PD, LD
  function seradRohy(q) {
    const cx = q.reduce((s, b) => s + b[0], 0) / 4, cy = q.reduce((s, b) => s + b[1], 0) / 4;
    const p = q.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
    let z = 0; for (let i = 1; i < 4; i++) if (p[i][0] + p[i][1] < p[z][0] + p[z][1]) z = i;
    return [0, 1, 2, 3].map(i => p[(z + i) % 4].slice());
  }
  // čtyřúhelník největší plochy s vrcholy na obalu (iterativně po rozích)
  function ctyruhelnik(h) {
    if (h.length < 4) return null;
    const ext = f => h.reduce((m, b) => (f(b) > f(m) ? b : m), h[0]);
    let q = [ext(b => -b[0] - b[1]), ext(b => b[0] - b[1]), ext(b => b[0] + b[1]), ext(b => b[1] - b[0])];
    for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) {
      let nej = plocha(q);
      for (const b of h) { const t = q.slice(); t[i] = b; const a = plocha(t); if (a > nej + 1e-9) { nej = a; q = t; } }
    }
    return seradRohy(q);
  }
  function konvexni(q) {
    let zn = 0;
    for (let i = 0; i < 4; i++) {
      const c = kriz(q[i], q[(i + 1) % 4], q[(i + 2) % 4]);
      if (Math.abs(c) < 1e-9) return false;
      if (!zn) zn = Math.sign(c); else if (Math.sign(c) !== zn) return false;
    }
    return true;
  }

  // Detekce listu na šedém obraze (ideálně zmenšeném na ~300–400 px).
  // List = největší světlá souvislá oblast podle Otsuova prahu; vrací { rohy, nalezeno, jistota }.
  function detekujRohy(s) {
    const { w, h } = s, r = Math.max(1, Math.round(Math.min(w, h) / 120));
    const b = rozmaz(rozmaz(s, r), r);
    const t = otsu(b.g), maska = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) maska[i] = b.g[i] > t ? 1 : 0;
    // odříznout 1px tenké spoje s pozadím (eroze křížem)
    const er = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      er[i] = maska[i] & maska[i - 1] & maska[i + 1] & maska[i - w] & maska[i + w];
    }
    const obl = nejvetsiOblast(er, w, h);
    const vychozi = celyObraz(w, h);
    if (!obl.pocet) return { rohy: vychozi, nalezeno: false, jistota: 0 };
    const q = ctyruhelnik(obal(obl.body));
    if (!q || !konvexni(q)) return { rohy: vychozi, nalezeno: false, jistota: 0 };
    const A = plocha(q), podil = A / (w * h), vypln = Math.min(1, obl.pocet / A);
    const nalezeno = podil > 0.12 && podil < 0.985 && vypln > 0.8;
    // o kousek dovnitř: lepší uříznout okraj listu než nechat proužek stolu
    const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2;
    const rohy = q.map(([x, y]) => {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
      return [Math.max(0, Math.min(w - 1, x - dx / d)), Math.max(0, Math.min(h - 1, y - dy / d))];
    });
    return { rohy: nalezeno ? rohy : vychozi, nalezeno, jistota: nalezeno ? Math.round(vypln * 100) / 100 : 0 };
  }
  const celyObraz = (w, h) => [[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]];

  // ---------- homografie ----------
  function resLin(A, b) { // Gauss s výběrem hlavního prvku
    const n = b.length, M = A.map((r, i) => r.concat(b[i]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  // matice 3×3 (pole 9 čísel) zobrazující body z → na
  function homografie(z, na) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = z[i], [u, v] = na[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = resLin(A, b);
    return h ? h.concat(1) : null;
  }
  function zobraz(H, x, y) {
    const d = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
  }

  const POMERY = { a4: Math.SQRT2, letter: 11 / 8.5 };
  // rozměr výsledku podle délek hran; pomer 'auto' | 'a4' | 'letter'
  function rozmerVystupu(rohy, max, pomer) {
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let w = Math.max(d(rohy[0], rohy[1]), d(rohy[3], rohy[2]));
    let h = Math.max(d(rohy[0], rohy[3]), d(rohy[1], rohy[2]));
    const p = POMERY[pomer];
    if (p) { if (w > h) w = h * p; else h = w * p; }
    const k = Math.min(1, (max || 1e9) / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }

  // srovnání perspektivy: čtyřúhelník rohy → obdélník ow×oh, bilineární vzorkování
  function narovnej(img, rohy, ow, oh) {
    const H = homografie([[0, 0], [ow, 0], [ow, oh], [0, oh]], rohy);
    const o = novy(ow, oh), s = img.data, d = o.data, w = img.w, h = img.h;
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      const X = x + 0.5, Y = y + 0.5, q = H[6] * X + H[7] * Y + H[8];
      let sx = (H[0] * X + H[1] * Y + H[2]) / q - 0.5, sy = (H[3] * X + H[4] * Y + H[5]) / q - 0.5;
      sx = Math.max(0, Math.min(w - 1, sx)); sy = Math.max(0, Math.min(h - 1, sy));
      const x0 = sx | 0, y0 = sy | 0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = sx - x0, fy = sy - y0;
      const a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, e = (y1 * w + x1) * 4, j = (y * ow + x) * 4;
      for (let k = 0; k < 3; k++) {
        const t = s[a + k] + (s[b + k] - s[a + k]) * fx, u = s[c + k] + (s[e + k] - s[c + k]) * fx;
        d[j + k] = t + (u - t) * fy;
      }
      d[j + 3] = 255;
    }
    return o;
  }

  // otočení o násobek 90° po směru hodin
  function otoc(img, stupne) {
    const k = (((stupne / 90) | 0) % 4 + 4) % 4;
    if (!k) return img;
    const { w, h } = img, ow = k === 2 ? w : h, oh = k === 2 ? h : w, o = novy(ow, oh);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = k === 1 ? h - 1 - y : k === 2 ? w - 1 - x : y, ny = k === 1 ? x : k === 2 ? h - 1 - y : w - 1 - x;
      o.data.set(img.data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), (ny * ow + nx) * 4);
    }
    return o;
  }

  // ---------- filtry (vrací nový obraz) ----------
  function filtrSeda(img) {
    const o = kopie(img), d = o.data;
    for (let j = 0; j < d.length; j += 4) { const v = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8; d[j] = d[j + 1] = d[j + 2] = v; }
    return o;
  }
  // černobílý sken: adaptivní práh (Bradley) – pixel je černý, je-li o citlivost tmavší než okolí
  function filtrCernobily(img, citlivost) {
    const T = citlivost == null ? 0.15 : citlivost, s = seda(img), { g, w, h } = s;
    const r = Math.max(7, Math.round(Math.max(w, h) / 50)), I = integral(g, w, h), o = novy(w, h), d = o.data;
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        const sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
        const v = g[y * w + x] * (x1 - x0) * (y1 - y0) < sum * (1 - T) ? 0 : 255, j = (y * w + x) * 4;
        d[j] = d[j + 1] = d[j + 2] = v; d[j + 3] = 255;
      }
    }
    return o;
  }
  // jas pozadí: maximum v blocích → rozmazání → bilineárně zpět (text pozadí neztmaví)
  function pozadi(s) {
    const { g, w, h } = s, B = Math.max(8, Math.round(Math.max(w, h) / 40)), bw = Math.ceil(w / B), bh = Math.ceil(h / B);
    const m = new Uint8Array(bw * bh);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((y / B) | 0) * bw + ((x / B) | 0); if (g[y * w + x] > m[i]) m[i] = g[y * w + x]; }
    const r = rozmaz({ g: m, w: bw, h: bh }, 1).g, o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const fy = Math.max(0, Math.min(bh - 1, (y + 0.5) / B - 0.5)), y0 = fy | 0, y1 = Math.min(bh - 1, y0 + 1), ty = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = Math.max(0, Math.min(bw - 1, (x + 0.5) / B - 0.5)), x0 = fx | 0, x1 = Math.min(bw - 1, x0 + 1), tx = fx - x0;
        const a = r[y0 * bw + x0] + (r[y0 * bw + x1] - r[y0 * bw + x0]) * tx, b = r[y1 * bw + x0] + (r[y1 * bw + x1] - r[y1 * bw + x0]) * tx;
        o[y * w + x] = a + (b - a) * ty;
      }
    }
    return o;
  }
  // zvýraznění: vyrovná osvětlení (stín, přechod), pozadí vybělí, barvy a text ztmaví
  function filtrZvyrazni(img) {
    const bg = pozadi(seda(img)), o = kopie(img), d = o.data;
    for (let i = 0, j = 0; i < bg.length; i++, j += 4) {
      const k = 255 / Math.max(40, bg[i]);
      for (let c = 0; c < 3; c++) { const v = d[j + c] * k; d[j + c] = 255 - (255 - v) * 1.35; }
    }
    return o;
  }
  const FILTRY = { barva: 'Barevně', zvyrazni: 'Zvýraznit', seda: 'Šedá', cb: 'Černobíle' };
  function filtr(img, druh, citlivost) {
    if (druh === 'seda') return filtrSeda(img);
    if (druh === 'cb') return filtrCernobily(img, citlivost);
    if (druh === 'zvyrazni') return filtrZvyrazni(img);
    return img;
  }

  // ---------- stránky a export ----------
  function presun(pole, z, na) {
    const p = pole.slice();
    if (z < 0 || z >= p.length) return p;
    na = Math.max(0, Math.min(p.length - 1, na));
    p.splice(na, 0, p.splice(z, 1)[0]);
    return p;
  }
  // rozměr stránky PDF v mm a umístění obrázku; format 'a4' | 'letter' | 'obrazek'
  const FORMATY = { a4: [210, 297], letter: [215.9, 279.4] };
  function strankaPdf(wPx, hPx, format, okraj) {
    const m = okraj || 0, nasirku = wPx > hPx;
    if (!FORMATY[format]) {
      const sirka = nasirku ? 297 : 210, vyska = sirka * hPx / wPx; // šířka jako u A4
      return { sirka: sirka + 2 * m, vyska: vyska + 2 * m, x: m, y: m, w: sirka, h: vyska, orientace: nasirku ? 'l' : 'p' };
    }
    let [sirka, vyska] = FORMATY[format];
    if (nasirku) [sirka, vyska] = [vyska, sirka];
    const k = Math.min((sirka - 2 * m) / wPx, (vyska - 2 * m) / hPx), w = wPx * k, h = hPx * k;
    return { sirka, vyska, x: (sirka - w) / 2, y: (vyska - h) / 2, w, h, orientace: nasirku ? 'l' : 'p' };
  }
  function nazevSouboru(zaklad, datum, pripona) {
    const z = String(zaklad || '').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'sken-' + datum;
    return z.replace(/\.(pdf|jpe?g|png|txt)$/i, '') + pripona;
  }
  // převod rohů mezi měřítky (detekce běží na zmenšenině)
  const skaluj = (rohy, k) => rohy.map(([x, y]) => [x * k, y * k]);

  const SKENER = {
    novy, kopie, seda, rozmaz, otsu, nejvetsiOblast, obal, plocha, seradRohy, ctyruhelnik, konvexni, detekujRohy, celyObraz,
    homografie, zobraz, rozmerVystupu, narovnej, otoc, filtrSeda, filtrCernobily, filtrZvyrazni, FILTRY, filtr,
    presun, strankaPdf, nazevSouboru, skaluj,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SKENER;
  koren.SKENER = SKENER;
})(typeof window !== 'undefined' ? window : globalThis);
