/* ============================================================
   Barefoot vložky – vlastní obrysy z předloh (jádro bez DOM).
   Obrázek (sken / fotka obkreslené nohy nebo staré vložky) → měřítko (homografie
   px → mm, i perspektiva listu papíru) → maska → obrysy → zarovnání nohy →
   kalibrace délky/šířky → offset v osách X/Y (elipsa přes Clipper) → přídavek ve špičce.
   Souřadnice předlohy: mm, osa y dolů (jako obrázek). Výsledek: jako BFJ.spocitej
   (pravá noha shora, x do strany, y od paty ke špičce), aby šel do BFV a 3D.
   ============================================================ */
(function (koren) {
  'use strict';
  const uzel = typeof module !== 'undefined' && module.exports;
  const J = koren.BFJ || (uzel ? require('./jadro.js') : null);
  const CL = koren.ClipperLib || (uzel ? require('../lib/clipper.min.js') : null);
  const fmt = J.fmt;

  const PAPIRY = { a4: [210, 297], a3: [297, 420], a5: [148, 210], letter: [215.9, 279.4] };
  const DETEKCE = { rezim: 'cara', prah: 'auto', citlivost: 0.5, uzavrit: 0.6, hrana: 'stred', korekce: 0, vyhlazeni: 2, minPlocha: 2500 };
  const SABLONA = { strana: 'P', aktivni: true, role: 'noha', zarovnani: 'osa', uhelPlus: 0, zrcadlit: false, sx: 1, sy: 1, ox: 0, oy: 0, spicka: 0, prsty: { rezim: 'zadne', sila: 4, od: 0.62 } };
  /* co šablona představuje: chodidlo (obkreslené), stará vložka, stélka vyjmutá z boty */
  const ROLE = { noha: 'chodidlo', vlozka: 'stará vložka', stelka: 'stélka z boty' };
  /* kalibrační karta A4: čtyři plné čtverce 10 × 10 mm, středy 15 mm od okrajů */
  const KARTA = { w: 210, h: 297, inset: 15, strana: 10 };
  const ZAKAZKA = { stav: ['rozpracovano', 'zmereno', 'vyrobeno', 'predano'], nazvy: { rozpracovano: 'rozpracováno', zmereno: 'změřeno', vyrobeno: 'vyrobeno', predano: 'předáno' } };

  /* ---------- lineární algebra, homografie ---------- */
  function resLin(A, b) {
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-12) return null;
      [M[c], M[piv]] = [M[piv], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  /* H (3×3 po řádcích) převádí body z → d */
  function homografie(z, d) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = z[i], [u, v] = d[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = resLin(A, b);
    return h ? [...h, 1] : null;
  }
  const hBod = (H, x, y) => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };
  function inverze3(m) {
    const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-15) return null;
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  }
  /* rohy listu v libovolném pořadí → [levý horní, pravý horní, pravý dolní, levý dolní] */
  function seradRohy(R) {
    const s = R.slice(), tl = s.reduce((a, q) => (q[0] + q[1] < a[0] + a[1] ? q : a)), br = s.reduce((a, q) => (q[0] + q[1] > a[0] + a[1] ? q : a));
    const zb = s.filter((q) => q !== tl && q !== br);
    if (zb.length !== 2) return null;
    const [tr, bl] = zb[0][1] - zb[0][0] < zb[1][1] - zb[1][0] ? zb : [zb[1], zb[0]];
    return [tl, tr, br, bl];
  }
  /* měřítko obrázku → { H: px → mm, sirka, vyska (mm) }; k = { typ, … }, w/h = rozměr obrázku v px */
  function meritko(k, w, h) {
    const rovne = (s) => ({ H: [s, 0, 0, 0, s, 0, 0, 0, 1], sirka: w * s, vyska: h * s, odhad: false });
    k = k || { typ: 'odhad' };
    if (k.typ === 'dpi' && k.dpi > 10) return rovne(25.4 / k.dpi);
    if (k.typ === 'body' && k.a && k.b && k.mm > 0) { const d = Math.hypot(k.b[0] - k.a[0], k.b[1] - k.a[1]); if (d > 2) return rovne(k.mm / d); }
    if (k.typ === 'list' && k.rohy && k.rohy.length === 4) {
      const r = seradRohy(k.rohy);
      if (r) {
        let [W, Hh] = PAPIRY[k.papir] || [k.w || 210, k.h || 297];
        const horni = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]), bocni = Math.hypot(r[3][0] - r[0][0], r[3][1] - r[0][1]);
        if ((horni > bocni) !== (W > Hh)) [W, Hh] = [Hh, W];
        const H = homografie(r, [[0, 0], [W, 0], [W, Hh], [0, Hh]]);
        if (H) return { H, sirka: W, vyska: Hh, odhad: false };
      }
    }
    if (k.typ === 'karta' && k.rohy && k.rohy.length === 4) {
      const r = seradRohy(k.rohy);
      if (r) {
        const horni = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]), bocni = Math.hypot(r[3][0] - r[0][0], r[3][1] - r[0][1]);
        const [W, Hh] = horni > bocni ? [KARTA.h, KARTA.w] : [KARTA.w, KARTA.h], a = KARTA.inset;
        const H = homografie(r, [[a, a], [W - a, a], [W - a, Hh - a], [a, Hh - a]]);
        if (H) return { H, sirka: W, vyska: Hh, odhad: false };
      }
    }
    return Object.assign(rovne(210 / w), { odhad: true });
  }
  /* rozlišení pracovního obrázku (px/mm) – do 2400 px na delší stranu */
  const rozliseni = (m) => Math.min(4, 2400 / Math.max(m.sirka, m.vyska));

  /* srovnání obrázku do mm: zdroj {w, h, data RGBA}, m = meritko(), R px/mm → {w, h, R, rgba, seda} */
  function srovnej(zdroj, m, R) {
    const W = Math.max(1, Math.ceil(m.sirka * R)), Hh = Math.max(1, Math.ceil(m.vyska * R)), Hi = inverze3(m.H);
    const rgba = new Uint8ClampedArray(W * Hh * 4), seda = new Uint8Array(W * Hh), d = zdroj.data, sw = zdroj.w, sh = zdroj.h;
    for (let v = 0; v < Hh; v++) for (let u = 0; u < W; u++) {
      const q = hBod(Hi, (u + 0.5) / R, (v + 0.5) / R), o = (v * W + u) * 4;
      /* souřadnice v px mají střed pixelu i na i + 0,5 (kliky, rohy listu); vzorek d[i] leží ve středu → posun o půl pixelu */
      const x = Math.min(sw - 1, Math.max(0, q[0] - 0.5)), y = Math.min(sh - 1, Math.max(0, q[1] - 0.5));
      let r = 255, gg = 255, bb = 255;   // bez alokací – miliony pixelů
      if (q[0] >= 0 && q[1] >= 0 && q[0] <= sw && q[1] <= sh) {
        const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1), fx = x - x0, fy = y - y0;
        const i00 = (y0 * sw + x0) * 4, i01 = (y0 * sw + x1) * 4, i10 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
        const w00 = (1 - fx) * (1 - fy), w01 = fx * (1 - fy), w10 = (1 - fx) * fy, w11 = fx * fy;
        r = d[i00] * w00 + d[i01] * w01 + d[i10] * w10 + d[i11] * w11;
        gg = d[i00 + 1] * w00 + d[i01 + 1] * w01 + d[i10 + 1] * w10 + d[i11 + 1] * w11;
        bb = d[i00 + 2] * w00 + d[i01 + 2] * w01 + d[i10 + 2] * w10 + d[i11 + 2] * w11;
      }
      rgba[o] = r; rgba[o + 1] = gg; rgba[o + 2] = bb; rgba[o + 3] = 255;
      seda[v * W + u] = 0.299 * r + 0.587 * gg + 0.114 * bb;
    }
    return { w: W, h: Hh, R, rgba, seda };
  }

  /* ---------- práh a maska ---------- */
  function otsu(g) {
    const hist = new Float64Array(256); for (let i = 0; i < g.length; i++) hist[g[i]]++;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let wB = 0, sB = 0, max = -1, t = 128;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue; const wF = g.length - wB; if (!wF) break;
      sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF, s = wB * wF * (mB - mF) * (mB - mF);
      if (s > max) { max = s; t = i; }
    }
    return t;
  }
  /* tmavé pixely: auto = adaptivní (místní průměr, pro tenké čáry a nerovné světlo) u čáry, Otsu u plných předmětů */
  function tmave(img, det) {
    const { w, h, seda: g } = img, M = new Uint8Array(w * h), c = det.citlivost;
    if (det.rezim === 'cara') {
      /* práh vůči místnímu jasu papíru (maximum v okolí 4 mm): na rozdíl od průměru ho neposune sousední čára
         ani tmavý stůl za okrajem listu, takže čára zůstane souměrná a střed sedí */
      const k = Math.max(3, Math.round(4 * img.R)), A = new Uint8Array(w * h), B = new Uint8Array(w * h);
      const maxRad = (src, dst, n, krok, delka, start) => {   // posuvné maximum s frontou (O(n))
        const q = new Int32Array(delka); let hl = 0, ko = 0;
        for (let i = 0; i < delka + k; i++) {
          if (i < delka) { const v = src[start + i * krok]; while (ko > hl && src[start + q[ko - 1] * krok] <= v) ko--; q[ko++] = i; }
          const c = i - k; if (c < 0) continue;
          while (q[hl] < c - k) hl++;
          dst[start + c * krok] = src[start + q[hl] * krok];
        }
      };
      for (let y = 0; y < h; y++) maxRad(g, A, w, 1, w, y * w);
      for (let x = 0; x < w; x++) maxRad(A, B, h, w, h, x);
      const pod = 0.08 + 0.3 * c;
      for (let i = 0; i < w * h; i++) if (g[i] < B[i] * (1 - pod)) M[i] = 1;
    } else {
      const t = otsu(g) + (c - 0.5) * 80;
      for (let i = 0; i < g.length; i++) M[i] = det.rezim === 'svetly' ? (g[i] > t ? 1 : 0) : (g[i] < t ? 1 : 0);
    }
    return M;
  }
  /* kruhová dilatace o r px: vzdálenostní transformace (zkosení 5-7, chyba do ~2 %) – čtverec by šikmé čáry rozšířil až √2× víc */
  function dilatuj(M, w, h, r) {
    if (r < 1) return M;
    const N = w * h, D = new Int32Array(N), INF = 1 << 29, lim = Math.round(r * 5);
    for (let i = 0; i < N; i++) D[i] = M[i] ? 0 : INF;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; let d = D[i]; if (!d) continue;
      if (x > 0) d = Math.min(d, D[i - 1] + 5);
      if (y > 0) { d = Math.min(d, D[i - w] + 5); if (x > 0) d = Math.min(d, D[i - w - 1] + 7); if (x < w - 1) d = Math.min(d, D[i - w + 1] + 7); }
      D[i] = d;
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x; let d = D[i]; if (!d) continue;
      if (x < w - 1) d = Math.min(d, D[i + 1] + 5);
      if (y < h - 1) { d = Math.min(d, D[i + w] + 5); if (x < w - 1) d = Math.min(d, D[i + w + 1] + 7); if (x > 0) d = Math.min(d, D[i + w - 1] + 7); }
      D[i] = d;
    }
    const B = new Uint8Array(N); for (let i = 0; i < N; i++) if (D[i] <= lim) B[i] = 1;
    return B;
  }
  /* úsečky (mm) do masky s hodnotou val, tloušťka t px */
  function kresliRezy(M, w, h, R, rezy, val, t) {
    for (const [ax, ay, bx, by] of rezy || []) {
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * R * 2) + 1;
      for (let i = 0; i <= n; i++) {
        const x = Math.round((ax + (bx - ax) * i / n) * R - 0.5), y = Math.round((ay + (by - ay) * i / n) * R - 0.5);
        for (let dy = -t; dy <= t; dy++) for (let dx = -t; dx <= t; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) M[yy * w + xx] = val; }
      }
    }
  }
  /* záplava (4-sousedství) z počátečních bodů přes pixely, kde volne(i) */
  function zaplav(w, h, starty, volne, znacka, hodnota) {
    const st = new Int32Array(w * h); let n = 0;
    for (const i of starty) if (volne(i) && znacka[i] === 0) { znacka[i] = hodnota; st[n++] = i; }
    let pocet = n;
    while (n) {
      const i = st[--n], x = i % w;
      const sous = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1];
      for (const j of sous) if (j >= 0 && znacka[j] === 0 && volne(j)) { znacka[j] = hodnota; st[n++] = j; pocet++; }
    }
    return pocet;
  }
  function okraj(w, h) { const o = []; for (let x = 0; x < w; x++) o.push(x, (h - 1) * w + x); for (let y = 1; y < h - 1; y++) o.push(y * w, y * w + w - 1); return o; }

  /* obrysový sled pixelů složky (Moore, 8-sousedství), body ve středech pixelů */
  const DX = [-1, -1, 0, 1, 1, 1, 0, -1], DY = [0, -1, -1, -1, 0, 1, 1, 1];
  function obrysSlozky(lab, w, h, id, start) {
    const uvnitr = (x, y) => x >= 0 && y >= 0 && x < w && y < h && lab[y * w + x] === id;
    const sx = start % w, sy = (start / w) | 0, out = [[sx, sy]];
    let x = sx, y = sy, zpet = 0, naStartu = false;   // soused na západ je vně (start = první pixel v řádkovém pořadí)
    const max = 4 * w * h;
    for (let krok = 0; krok < max; krok++) {
      let nasel = false;
      for (let i = 1; i <= 8; i++) {
        const d = (zpet + i) % 8, nx = x + DX[d], ny = y + DY[d];
        if (uvnitr(nx, ny)) {
          const pd = (zpet + i - 1) % 8, bx = x + DX[pd], by = y + DY[pd];
          x = nx; y = ny;
          zpet = DX.findIndex((q, k) => q === bx - x && DY[k] === by - y);
          nasel = true; break;
        }
      }
      if (!nasel) break;
      /* Jacobovo kritérium: konec až při návratu na start a stejném dalším kroku (start může být kloub dvou větví) */
      if (naStartu) { if (out.length > 1 && x === out[1][0] && y === out[1][1]) break; out.push([sx, sy]); naStartu = false; }
      if (x === sx && y === sy) { if (out.length < 2) break; naStartu = true; continue; }
      out.push([x, y]);
    }
    return out;
  }

  /* ---------- automatické měřítko: list papíru a kalibrační karta ---------- */
  /* zmenšená šedá kopie (průměr bloků) – hledání listu stačí v hrubém rozlišení */
  function zmensiSedou(z, max) {
    const k = Math.min(1, max / Math.max(z.w, z.h)), w = Math.max(1, Math.round(z.w * k)), h = Math.max(1, Math.round(z.h * k));
    const g = new Uint8Array(w * h), sx = z.w / w, sy = z.h / h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.min(z.h, Math.floor((y + 1) * sy) || 1); yy++) for (let xx = Math.floor(x * sx); xx < Math.min(z.w, Math.floor((x + 1) * sx) || 1); xx++) { const o = (yy * z.w + xx) * 4; s += 0.299 * z.data[o] + 0.587 * z.data[o + 1] + 0.114 * z.data[o + 2]; n++; }
      g[y * w + x] = n ? s / n : 255;
    }
    return { w, h, g, sx, sy };
  }
  function slozky(M, w, h) {   // označení souvislých oblastí (4-sousedství) + plocha, obálka, těžiště
    const lab = new Int32Array(w * h), L = [];
    let id = 0;
    for (let i = 0; i < w * h; i++) {
      if (!M[i] || lab[i]) continue;
      id++;
      const st = [i]; lab[i] = id; let n = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
      while (st.length) {
        const j = st.pop(), x = j % w, y = (j / w) | 0; n++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const q of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j >= w ? j - w : -1, j < w * (h - 1) ? j + w : -1]) if (q >= 0 && M[q] && !lab[q]) { lab[q] = id; st.push(q); }
      }
      L.push({ id, start: i, n, cx: sx / n, cy: sy / n, x0, y0, x1, y1 });
    }
    return { lab, L };
  }
  const plochaQ = (Q) => Math.abs(J.plocha(Q));
  /* čtyřúhelník největší plochy z vrcholů konvexního obalu (start: extrémy úhlopříček, pak místní zlepšování) */
  function nejvetsiCtyruhelnik(H) {
    const n = H.length; if (n < 4) return null;
    const arg = (f) => H.reduce((m, q, i) => (f(q) > f(H[m]) ? i : m), 0);
    let ix = [arg((q) => -q[0] - q[1]), arg((q) => q[0] - q[1]), arg((q) => q[0] + q[1]), arg((q) => q[1] - q[0])].sort((a, b) => a - b);
    if (new Set(ix).size < 4) ix = [0, n >> 2, n >> 1, (3 * n) >> 2];
    let best = plochaQ(ix.map((i) => H[i])), lepsi = true;
    while (lepsi) {
      lepsi = false;
      for (let k = 0; k < 4; k++) for (const d of [-1, 1]) {
        const z = ix.slice(); z[k] = (z[k] + d + n) % n;
        if (new Set(z).size < 4) continue;
        const zs = z.slice().sort((a, b) => a - b), a = plochaQ(zs.map((i) => H[i]));
        if (a > best + 1e-9) { best = a; ix = zs; lepsi = true; }
      }
    }
    return ix.map((i) => H[i]);
  }
  /* přímka proložená body (nejmenší kolmé čtverce) → { c (bod), d (směr) } */
  function primka(P) {
    const c = teziste(P); let a = 0, b = 0, e = 0;
    for (const [x, y] of P) { const dx = x - c[0], dy = y - c[1]; a += dx * dx; b += dx * dy; e += dy * dy; }
    const u = 0.5 * Math.atan2(2 * b, a - e); return { c, d: [Math.cos(u), Math.sin(u)] };
  }
  function prusecik(p, q) {
    const det = p.d[0] * q.d[1] - p.d[1] * q.d[0]; if (Math.abs(det) < 1e-9) return null;
    const t = ((q.c[0] - p.c[0]) * q.d[1] - (q.c[1] - p.c[1]) * q.d[0]) / det;
    return [p.c[0] + p.d[0] * t, p.c[1] + p.d[1] * t];
  }
  /* list papíru: největší světlá oblast tvaru čtyřúhelníku; rohy zpřesněné průsečíky přímek proložených hranami. Vrací rohy v px zdroje. */
  function najdiList(z) {
    const S = zmensiSedou(z, 640), N = S.w * S.h, t = otsu(S.g), M = new Uint8Array(N);
    for (let i = 0; i < N; i++) M[i] = S.g[i] > t ? 1 : 0;
    const { lab, L } = slozky(M, S.w, S.h);
    const nej = L.reduce((m, q) => (!m || q.n > m.n ? q : m), null);
    if (!nej || nej.n < 0.12 * N) return null;
    /* plocha listu i s dírami (obkreslená noha uvnitř je samostatná oblast) */
    const pozadi = new Uint8Array(N);
    const nVen = zaplav(S.w, S.h, okraj(S.w, S.h), (i) => lab[i] !== nej.id, pozadi, 1);
    const plnaPlocha = N - nVen;
    const obr = obrysSlozky(lab, S.w, S.h, nej.id, nej.start), Q = nejvetsiCtyruhelnik(obalovy(obr));
    if (!Q || plochaQ(Q) < 0.1 * N || plnaPlocha < 0.9 * plochaQ(Q)) return null;   // musí to být opravdu čtyřúhelník
    /* list uříznutý okrajem snímku (nebo celý bílý snímek): rohy by byly rohy záběru a měřítko by tiše ujelo */
    const uOkraje = Q.filter(([x, y]) => x < 2 || y < 2 || x > S.w - 3 || y > S.h - 3).length;
    if (uOkraje >= 2) return null;
    /* hrany: body obrysu mezi rohy (bez 12 % u rohů), proložit přímku, posunout o půl pixelu ven */
    const ci = Q.map((q) => obr.reduce((m, p, i) => (Math.hypot(p[0] - q[0], p[1] - q[1]) < Math.hypot(obr[m][0] - q[0], obr[m][1] - q[1]) ? i : m), 0));
    const stred = teziste(Q), hrany = [];
    for (let k = 0; k < 4; k++) {
      const a = ci[k], b = ci[(k + 1) % 4], n = obr.length, delka = (b - a + n) % n, B = [];
      for (let j = Math.round(delka * 0.12); j <= Math.round(delka * 0.88); j++) B.push(obr[(a + j) % n]);
      if (B.length < 5) return Q.map(([x, y]) => [(x + 0.5) * S.sx, (y + 0.5) * S.sy]);
      const p = primka(B), nn = [-p.d[1], p.d[0]], ven = Math.sign((p.c[0] - stred[0]) * nn[0] + (p.c[1] - stred[1]) * nn[1]) || 1;
      hrany.push({ c: [p.c[0] + nn[0] * 0.5 * ven, p.c[1] + nn[1] * 0.5 * ven], d: p.d });
    }
    const R = [];
    for (let k = 0; k < 4; k++) { const q = prusecik(hrany[(k + 3) % 4], hrany[k]); if (!q) return null; R.push([(q[0] + 0.5) * S.sx, (q[1] + 0.5) * S.sy]); }
    return R;
  }
  /* kalibrační karta: čtyři plné tmavé čtverce (vyplnění obálky > 72 %), z kandidátů ta čtveřice s největší plochou */
  function najdiKartu(z) {
    const S = zmensiSedou(z, 1000), N = S.w * S.h, t = otsu(S.g), M = new Uint8Array(N);
    for (let i = 0; i < N; i++) M[i] = S.g[i] < t * 0.85 ? 1 : 0;
    const { L } = slozky(M, S.w, S.h);
    let K = L.filter((q) => { const bw = q.x1 - q.x0 + 1, bh = q.y1 - q.y0 + 1; return q.n > 0.00008 * N && q.n < 0.01 * N && q.n / (bw * bh) > 0.72 && bw / bh > 0.4 && bw / bh < 2.5; });
    K.sort((a, b) => b.n - a.n); K = K.slice(0, 12);
    let nej = null;
    for (let a = 0; a < K.length; a++) for (let b = a + 1; b < K.length; b++) for (let c = b + 1; c < K.length; c++) for (let d = c + 1; d < K.length; d++) {
      const Z = [K[a], K[b], K[c], K[d]], ns = Z.map((q) => q.n);
      if (Math.max(...ns) > 3 * Math.min(...ns)) continue;
      const R = seradRohy(Z.map((q) => [q.cx, q.cy])); if (!R) continue;
      const pl = plochaQ(R);
      if (pl > 0.15 * N && (!nej || pl > nej.pl)) nej = { pl, R };
    }
    return nej ? nej.R.map(([x, y]) => [(x + 0.5) * S.sx, (y + 0.5) * S.sy]) : null;
  }

  /* ---------- detekce obrysů ---------- */
  /* img = srovnej(); det = parametry; rezy = dělicí úsečky (mm) → [{ body (mm, y dolů), plocha mm², cara mm }] */
  function najdiObrysy(img, det, rezy) {
    det = Object.assign({}, DETEKCE, det || {});
    const { w, h, R } = img, N = w * h;
    const D = tmave(img, det);
    let obj, L = null;
    const rZac = det.rezim === 'cara' ? Math.round(det.uzavrit * R) : 0;   // zacelení posune vnitřní hranu čáry o rZac px dovnitř
    if (det.rezim === 'cara') {
      L = dilatuj(D, w, h, rZac);
      kresliRezy(L, w, h, R, rezy, 1, 1);
      const z = new Uint8Array(N);
      zaplav(w, h, okraj(w, h), (i) => !L[i], z, 1);
      obj = new Uint8Array(N); for (let i = 0; i < N; i++) obj[i] = !L[i] && !z[i] ? 1 : 0;
    } else {
      obj = D.slice();
      kresliRezy(obj, w, h, R, rezy, 0, 1);
      const z = new Uint8Array(N);
      zaplav(w, h, okraj(w, h), (i) => !obj[i], z, 1);
      for (let i = 0; i < N; i++) if (!obj[i] && !z[i]) obj[i] = 1;   // díry vyplnit
    }
    const lab = new Int32Array(N), slozky = [];
    let id = 0;
    for (let i = 0; i < N; i++) {
      if (!obj[i] || lab[i]) continue;
      id++;
      const pocet = zaplav(w, h, [i], (j) => obj[j] === 1, lab, id);
      slozky.push({ id, start: i, pocet });
    }
    const minPx = det.minPlocha * R * R;
    let vybrane = slozky.filter((s) => s.pocet >= minPx);
    /* obálky složek; oblast, která v sobě má jiný obrys (list papíru kolem nohou), vynechat */
    const ob = new Map(vybrane.map((s) => [s.id, { x0: w, y0: h, x1: -1, y1: -1 }]));
    for (let i = 0; i < N; i++) { const b = ob.get(lab[i]); if (b) { const x = i % w, y = (i / w) | 0; if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; } }
    vybrane = vybrane.filter((a) => { const A = ob.get(a.id); return !vybrane.some((b) => { const B = ob.get(b.id); return b !== a && B.x0 > A.x0 && B.x1 < A.x1 && B.y0 > A.y0 && B.y1 < A.y1; }); });
    if (det.rezim !== 'cara') {   // předměty dotýkající se okraje snímku (stín, okraj papíru) vynechat
      const naOkraji = new Set(); for (const i of okraj(w, h)) if (lab[i]) naOkraji.add(lab[i]);
      vybrane = vybrane.filter((s) => !naOkraji.has(s.id));
    }
    const obrysy = vybrane.map((s) => ({ s, px: obrysSlozky(lab, w, h, s.id, s.start) }));
    let cara = 0;
    if (det.rezim === 'cara' && obrysy.length) {
      /* šířka čáry = pixely zacelené čáry v pásu kolem obrysů / obvod, minus zacelení (to čáru rozšířilo o rZac na každou stranu);
         z nezacelené masky by vyšla u rozmazané fotky menší, protože okraje čáry nepřejdou prahem */
      const vyb = new Set(vybrane.map((s) => s.id)), M = new Uint8Array(N);
      for (let i = 0; i < N; i++) if (vyb.has(lab[i])) M[i] = 1;
      const P = dilatuj(M, w, h, Math.round(4 * R) + rZac);
      let v = 0; for (let i = 0; i < N; i++) if (P[i] && !M[i] && L[i]) v++;
      const obvodPx = obrysy.reduce((a, o) => a + J.obvod(o.px), 0);
      cara = Math.max(0, Math.min(5, (v / Math.max(1, obvodPx) - 2 * rZac) / R));
    }
    const kor = (det.rezim === 'cara' ? rZac / R + ({ vnitrni: 0, stred: cara / 2, vnejsi: cara }[det.hrana] || 0) : 0) + 0.5 / R + det.korekce;
    return obrysy.map(({ s, px }) => {
      let P = px.map(([x, y]) => [(x + 0.5) / R, (y + 0.5) / R]);
      P = upravObrys(P, det.vyhlazeni, kor);
      return { body: P, plocha: s.pocet / R / R, cara };
    }).filter((o) => o.body.length >= 8).sort((a, b) => J.obalka(a.body).x0 - J.obalka(b.body).x0);
  }
  /* převzorkovat → vyhladit → posunout o korekci → zjednodušit na řídící body */
  function upravObrys(P, vyhlazeni, kor) {
    let Q = prevzorkuj(P, 1);
    const k = Math.max(0, Math.round(vyhlazeni));
    if (k) Q = vyhlad(Q, k);
    if (Math.abs(kor) > 0.01) { const o = odsad(orientuj(Q, false), kor, kor); if (o.length > 8) Q = prevzorkuj(o, 1); }
    return ridiciBody(Q, 0.15);   // odchylka do 0,15 mm, úsek nejvýš 12 mm, aby spline nezakrojil špičku
  }

  /* ---------- obrysy: převzorkování, vyhlazení, zjednodušení ---------- */
  function prevzorkuj(P, krok) {
    const N = P.length, out = [];
    if (N < 3) return P.slice();
    let zbyva = 0;
    for (let i = 0; i < N; i++) {
      const a = P[i], b = P[(i + 1) % N], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let t = zbyva;
      while (t < l) { out.push([a[0] + (b[0] - a[0]) * t / l, a[1] + (b[1] - a[1]) * t / l]); t += krok; }
      zbyva = t - l;
    }
    return out;
  }
  function vyhlad(P, k) {
    const N = P.length, out = [];
    for (let i = 0; i < N; i++) { let x = 0, y = 0; for (let j = -k; j <= k; j++) { const q = P[(i + j + N) % N]; x += q[0]; y += q[1]; } out.push([x / (2 * k + 1), y / (2 * k + 1)]); }
    return out;
  }
  function dp(P, tol, a, b, keep) {
    let m = -1, idx = -1;
    const [ax, ay] = P[a], [bx, by] = P[b], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((P[i][0] - ax) * dy - (P[i][1] - ay) * dx) / l; if (d > m) { m = d; idx = i; } }
    if (m > tol) { keep[idx] = 1; dp(P, tol, a, idx, keep); dp(P, tol, idx, b, keep); }
  }
  function zjednodus(P, tol) {
    const N = P.length; if (N < 8) return P.slice();
    let f = 0, m = 0; for (let i = 1; i < N; i++) { const d = Math.hypot(P[i][0] - P[0][0], P[i][1] - P[0][1]); if (d > m) { m = d; f = i; } }
    const keep = new Uint8Array(N); keep[0] = 1; keep[f] = 1;
    const Q = P.concat([P[0]]);
    dp(Q, tol, 0, f, keep); const keep2 = new Uint8Array(N + 1); dp(Q, tol, f, N, keep2);
    for (let i = 0; i < N; i++) if (keep2[i]) keep[i] = 1;
    return P.filter((_, i) => keep[i]);
  }
  /* proti směru hodin v souřadnicích s osou y nahoru (yDolu = obrys v souřadnicích obrázku) */
  function orientuj(P, yDolu) { const a = J.plocha(P) * (yDolu ? -1 : 1); return a < 0 ? P.slice().reverse() : P; }

  /* ---------- offset v osách X/Y: Minkowského součet s elipsou (Clipper) ---------- */
  const SC = 1000;
  function odsad(P, ox, oy) {
    if (Math.abs(ox) < 1e-3 && Math.abs(oy) < 1e-3) return P;
    if (ox * oy < 0) return odsad(odsad(P, ox, 0), 0, oy);   // opačná znaménka: postupně
    const a = Math.max(Math.abs(ox), 0.02), b = Math.max(Math.abs(oy), 0.02), r = Math.max(a, b), kx = r / a, ky = r / b, zn = Math.sign(ox || oy);
    const o = new CL.ClipperOffset(2, 0.01 * SC);
    o.AddPath(P.map(([x, y]) => ({ X: Math.round(x * kx * SC), Y: Math.round(y * ky * SC) })), CL.JoinType.jtRound, CL.EndType.etClosedPolygon);
    const res = new CL.Paths(); o.Execute(res, zn * r * SC);
    if (!res.length) return [];
    const nej = res.reduce((m, q) => (Math.abs(CL.Clipper.Area(q)) > Math.abs(CL.Clipper.Area(m)) ? q : m));
    const Q = nej.map((q) => [q.X / SC / kx, q.Y / SC / ky]);
    return J.plocha(Q) * J.plocha(P) < 0 ? Q.reverse() : Q;
  }
  /* přídavek ve špičce: přední 40 % délky se plynule protáhne o e mm */
  function spicka(P, e) {
    if (Math.abs(e) < 1e-3) return P;
    const o = J.obalka(P), y0 = o.y0 + 0.6 * o.h;
    return P.map(([x, y]) => { if (y <= y0) return [x, y]; const t = (y - y0) / (o.y1 - y0); return [x, y + e * t * t * (3 - 2 * t)]; });
  }

  /* ---------- zarovnání nohy ---------- */
  function teziste(P) { let x = 0, y = 0; for (const q of P) { x += q[0]; y += q[1]; } return [x / P.length, y / P.length]; }
  const otoc = (P, u, c) => { const cs = Math.cos(u), sn = Math.sin(u); return P.map(([x, y]) => [c[0] + (x - c[0]) * cs - (y - c[1]) * sn, c[1] + (x - c[0]) * sn + (y - c[1]) * cs]); };
  function obalovy(P) {   // konvexní obal (monotónní řetězec)
    const S = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), x = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const d = [], h = [];
    for (const p of S) { while (d.length >= 2 && x(d[d.length - 2], d[d.length - 1], p) <= 0) d.pop(); d.push(p); }
    for (let i = S.length - 1; i >= 0; i--) { const p = S[i]; while (h.length >= 2 && x(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); }
    return d.slice(0, -1).concat(h.slice(0, -1));
  }
  /* úhel (rad), o který se obrys (osa y nahoru) otočí kolem těžiště: hlavní osa svisle, širší konec (prsty) nahoru.
     zarovnani 'tecna': vnitřní tečna pata–kloub palce svisle (medialVlevo = vnitřní strana vlevo) */
  function uhelZarovnani(P, zarovnani, medialVlevo) {
    P = prevzorkuj(P, 1);   // rovnoměrně po obvodu, jinak by hustší úseky natáčely hlavní osu
    const c = teziste(P);
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of P) { const dx = x - c[0], dy = y - c[1]; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    let u = Math.PI / 2 - 0.5 * Math.atan2(2 * sxy, sxx - syy);
    let Q = otoc(P, u, c), o = J.obalka(Q);
    const sir = (t) => { const r = J.rezNaY(Q, o.y0 + t * o.h); return r ? r[1] - r[0] : 0; };
    if (sir(0.2) > sir(0.75)) { u += Math.PI; Q = otoc(P, u, c); o = J.obalka(Q); }
    if (zarovnani === 'tecna') {
      const Hh = obalovy(Q), N = Hh.length;
      let nej = null;
      for (let i = 0; i < N; i++) {
        const a = Hh[i], b = Hh[(i + 1) % N], ya = Math.min(a[1], b[1]), yb = Math.max(a[1], b[1]);
        if (ya > o.y0 + 0.45 * o.h || yb < o.y0 + 0.5 * o.h) continue;   // musí spojit zadní a přední část
        const xm = (a[0] + b[0]) / 2;
        if (medialVlevo ? xm > o.x0 + o.w / 2 : xm < o.x0 + o.w / 2) continue;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (!nej || l > nej.l) nej = { a, b, l };
      }
      if (nej) { const [a, b] = nej.a[1] < nej.b[1] ? [nej.a, nej.b] : [nej.b, nej.a]; u += Math.PI / 2 - Math.atan2(b[1] - a[1], b[0] - a[0]); }
    }
    return u;
  }
  /* odhad strany: po zarovnání je u pravé nohy (shora) nejdelší prst vlevo od středu */
  function odhadStrany(body) {
    const P = body.map(([x, y]) => [x, -y]), c = teziste(P), Q = otoc(P, uhelZarovnani(P, 'osa'), c), o = J.obalka(Q);
    const spicka = Q.reduce((a, q) => (q[1] > a[1] ? q : a));
    return spicka[0] < o.x0 + o.w / 2 ? 'P' : 'L';
  }

  /* ---------- vyhlazení obrysu kolem prstů ---------- */
  /* P: obrys zarovnaný (y nahoru, prsty nahoře). n = { rezim: 'zadne' | 'vyhladit' | 'obalka', sila 0–10, od: podíl délky, kde začínají prsty }.
     'vyhladit' = Taubinovo vyhlazení (nesmršťuje: krok λ střídá s krokem μ < −λ), jen v přední části s plynulým náběhem;
     'obalka' = vlnky mezi prsty nahradí konvexní obálka přední části, pak lehce vyhladí. */
  function upravPrsty(P, n) {
    if (!n || !n.rezim || n.rezim === 'zadne' || !(P.length > 8)) return P;
    const krok = 1.5;
    let Q = prevzorkuj(P, krok);
    const naPatu = (A) => { const i0 = A.reduce((m, q, i) => (q[1] < A[m][1] ? i : m), 0); return A.slice(i0).concat(A.slice(0, i0)); };
    Q = naPatu(Q);
    const o = J.obalka(Q), od = Math.min(0.85, Math.max(0.4, n.od || 0.62)), y0 = o.y0 + od * o.h, y1 = y0 + 0.08 * o.h;
    const vahy = (A) => A.map(([, y]) => { const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0))); return t * t * (3 - 2 * t); });
    if (n.rezim === 'obalka') {
      const idx = Q.map((q, i) => (q[1] > y0 ? i : -1)).filter((i) => i >= 0);
      if (idx.length > 3) {
        const a = idx[0], b = idx[idx.length - 1], H = obalovy(Q.slice(a, b + 1));
        const nejbl = (q) => H.reduce((m, h, i) => (Math.hypot(h[0] - q[0], h[1] - q[1]) < Math.hypot(H[m][0] - q[0], H[m][1] - q[1]) ? i : m), 0);
        const ha = nejbl(Q[a]), hb = nejbl(Q[b]), ret = [];
        for (let i = ha; ; i = (i + 1) % H.length) { ret.push(H[i]); if (i === hb || ret.length > H.length) break; }
        Q = prevzorkuj(Q.slice(0, a).concat(ret, Q.slice(b + 1)), krok);
        Q = naPatu(Q);
      }
    }
    const W = vahy(Q), R = taubin(Q, W, Math.round(Math.max(n.rezim === 'obalka' ? 1 : 0, Math.min(10, +n.sila || 0)) ** 2 * 6));
    /* Taubin špičku mírně protáhne – delší než předloha být nesmí; srovná se jen přední část (pata a bok zůstanou) */
    const dy = Math.min(0, o.y1 - J.obalka(R).y1);
    /* totéž pro šířku přední části */
    const oF = J.obalka(Q.filter((_, i) => W[i] > 0)), rF = J.obalka(R.filter((_, i) => W[i] > 0)), k = rF.w > oF.w && rF.w > 0 ? oF.w / rF.w : 1, cx = rF.x0 + rF.w / 2;
    return R.map(([x, y], i) => [cx + (x - cx) * (1 - W[i] * (1 - k)), y + dy * W[i]]);
  }
  /* Taubin obrys mírně nafukuje (u prstů o milimetry, opakováním víc) – vrátit délku a šířku na obálku o (pata a bok na místě) */
  function drzObalku(Q, o) {
    const q = J.obalka(Q); if (!(q.w > 0 && q.h > 0)) return Q;
    const kx = o.w / q.w, ky = o.h / q.h;
    return Q.map(([x, y]) => [o.x0 + (x - q.x0) * kx, o.y0 + (y - q.y0) * ky]);
  }
  /* Taubinovo vyhlazení uzavřeného obrysu: krok λ = 0,5 a zpětný krok μ = −0,53 – vlnky zmizí, obrys se nesmrští.
     w = váha bodu (0 = nehýbat), it = počet opakování */
  function taubin(Q, w, it) {
    const N = Q.length;
    for (let k = 0; k < it; k++) for (const f of [0.5, -0.53]) {
      Q = Q.map((q, i) => { const a = Q[(i - 1 + N) % N], b = Q[(i + 1) % N], g = f * (w ? w[i] : 1); return [q[0] + g * ((a[0] + b[0]) / 2 - q[0]), q[1] + g * ((a[1] + b[1]) / 2 - q[1])]; });
    }
    return Q;
  }
  /* řídící body z hustého obrysu: odchylka do tol, úsek nejvýš 12 mm */
  /* řídící body: rovnoměrně po obvodu s co největším krokem, při kterém spline obrysem neodbočí víc než tol.
     (Body z Douglas-Peuckera leží v rozích lomené čáry a spline mezi nimi dělá viditelné zlomy.) */
  function ridiciBody(Q, tol) {
    const D = prevzorkuj(Q, 1), vzorek = D.filter((_, i) => i % 3 === 0);
    let B = null;
    for (const krok of [10, 9, 8, 7, 6, 5, 4, 3]) {
      B = prevzorkuj(D, krok);
      if (B.length < 8) continue;
      const S = J.spline(B, 8);
      if (vzorek.every(([x, y]) => J.vzdalenostKObrysu(S, x, y) <= tol)) return B;
    }
    return B;
  }
  /* „Vyhladit vlnky“: trasa šablony se narovná – u prstů obálka (vyplní zářezy od tužky) a silné vyhlazení,
     jinde jen mírné; výsledek jako rovnoměrné řídící body v souřadnicích předlohy. o = { prsty 0–10, celek 0–10, obalka, od, tol } */
  function vyhladObrys(s, o) {
    o = Object.assign({ prsty: 6, celek: 2, obalka: true, od: 0.55, tol: 0.2 }, o);
    o.prsty = Math.min(10, Math.max(0, +o.prsty || 0));
    const s0 = Object.assign({}, s, { sx: 1, sy: 1, ox: 0, oy: 0, spicka: 0, prsty: { rezim: o.obalka ? 'obalka' : 'vyhladit', sila: o.prsty, od: o.od } });
    const g = geometrie(s0), cel = Math.min(10, Math.max(0, +o.celek || 0));
    let Q = prevzorkuj(g.noha, 1.5);
    Q = drzObalku(taubin(Q, null, Math.round(cel * cel * 6)), J.obalka(Q));
    return ridiciBody(Q.map(g.zpet), o.tol);
  }
  /* zapéct úpravy obrysu (vyhlazení prstů) do uzlů šablony a zjednodušit s tolerancí tol mm */
  function zapect(s, tol) {
    const g = geometrie(Object.assign({}, s, { sx: 1, sy: 1, ox: 0, oy: 0, spicka: 0 }));
    return ridiciBody(prevzorkuj(g.noha.map(g.zpet), 1), tol || 0.15);
  }

  /* ---------- šablona → obrys chodidla a vložky ---------- */
  /* s = šablona (body v mm předlohy, y dolů); vrací { noha, vlozka (normované, y nahoru, CCW, start u paty), off (součet společného a vlastního offsetu),
     zmereno (délka/šířka před kalibrací), tam(bod předlohy) → výsledné souřadnice, zpet(…) } */
  /* obrys, který sám sebe protíná (motýlek z přetažených uzlů): Clipper ho rozloží na víc ploch nebo změní plochu */
  function sebeprotnuty(P) {
    if (!CL || P.length < 4) return false;
    const K = 100, cesta = P.map(([x, y]) => ({ X: Math.round(x * K), Y: Math.round(y * K) }));
    const R = CL.Clipper.SimplifyPolygon(cesta, CL.PolyFillType.pftNonZero).filter((q) => Math.abs(CL.Clipper.Area(q)) > 4 * K * K);   // smyčky pod 4 mm² nevadí
    const a0 = Math.abs(CL.Clipper.Area(cesta)), a1 = R.reduce((a, q) => a + Math.abs(CL.Clipper.Area(q)), 0);
    return R.length > 1 || Math.abs(a1 - a0) > 0.02 * a0;
  }
  function geometrie(s, spol) {
    s = Object.assign({}, SABLONA, s);
    const sp = spol || {}, off = { ox: (sp.ox || 0) + (s.ox || 0), oy: (sp.oy || 0) + (s.oy || 0), spicka: (sp.spicka || 0) + (s.spicka || 0) };   // společný + vlastní
    const D = J.spline(s.body, 6).map(([x, y]) => [x, -y]);
    const c = teziste(D);
    const medialVlevo = (s.strana === 'P') !== !!s.zrcadlit;
    const u = uhelZarovnani(D, s.zarovnani, medialVlevo) + (s.uhelPlus || 0) * Math.PI / 180;
    const zr = s.zrcadlit ? -1 : 1, cs = Math.cos(u), sn = Math.sin(u);
    const zakl = (x, y) => { const X = c[0] + (x - c[0]) * cs - (-y - c[1]) * sn, Y = c[1] + (x - c[0]) * sn + (-y - c[1]) * cs; return [zr * X, Y]; };
    let raw = s.body.length ? D.map(([x, y]) => zakl(x, -y)) : [];
    raw = orientuj(upravPrsty(orientuj(raw, false), s.prsty), false);
    const ob0 = J.obalka(raw), zmereno = { delka: ob0.h, sirka: ob0.w };
    const noha = raw.map(([x, y]) => [x * s.sx, y * s.sy]);
    let vl = spicka(odsad(noha, off.ox || 0, off.oy || 0), off.spicka || 0), zkolaboval = false;
    if (vl.length < 8) { vl = noha; zkolaboval = true; }
    vl = prevzorkuj(vl, 1);
    const o = J.obalka(vl), t = [o.x0, o.y0];
    const posun = (P) => P.map(([x, y]) => [x - t[0], y - t[1]]);
    let V = posun(vl);
    const i0 = V.reduce((m, q, i) => (q[1] < V[m][1] ? i : m), 0);
    V = V.slice(i0).concat(V.slice(0, i0));
    const tam = ([x, y]) => { const [a, b] = zakl(x, y); return [a * s.sx - t[0], b * s.sy - t[1]]; };
    const zpet = ([X, Y]) => {
      const a = (X + t[0]) / s.sx / zr, b = (Y + t[1]) / s.sy;
      const x = c[0] + (a - c[0]) * cs + (b - c[1]) * sn, y = c[1] - (a - c[0]) * sn + (b - c[1]) * cs;
      return [x, -y];
    };
    return { noha: posun(noha), vlozka: V, zmereno, tam, zpet, off, zkolaboval };
  }

  /* ---------- projekt → výsledek pro BFV (scéna, SVG, DXF, PDF) a 3D ---------- */
  /* volby.vse: i vypnuté šablony a stélky (porovnání); jinak jen aktivní k tisku */
  function sestav(projekt, q, volby) {
    volby = volby || {};
    const p = J.normalizuj(Object.assign({}, q, { jmeno: projekt.klient || projekt.nazev || (q && q.jmeno) || '' }));
    const nohy = [], varovani = [], vv = (uroven, text) => varovani.push({ uroven, text });
    const obr = new Map((projekt.obrazky || []).map((o) => [o.id, o]));
    const aktivni = (projekt.sablony || []).filter((s) => (volby.vse || s.aktivni !== false) && s.body && s.body.length >= 8).map((s) => Object.assign({}, SABLONA, s));
    aktivni.sort((a, b) => (a.strana === b.strana ? 0 : a.strana === 'L' ? -1 : 1));
    const pocty = { L: 0, P: 0 };
    for (const s of aktivni) {
      let g = null;
      try { g = volby.geo ? volby.geo(s) : geometrie(s, projekt.spolecne); } catch (e) { g = null; }   // volby.geo = mezipaměť z UI
      /* rozbitý obrys (jeden bod, úsečka – např. z podvrženého odkazu) nesmí shodit ostatní šablony */
      if (!g || !(Math.abs(J.plocha(g.noha)) > 500)) { vv('chyba', `Šablona ${s.strana}: obrys je poškozený (nemá plochu) – smažte ji nebo najděte obrysy znovu.`); continue; }
      if (!(g.vlozka.length >= 8) || !(Math.abs(J.plocha(g.vlozka)) > 500)) { vv('chyba', `Šablona ${s.strana}: záporný offset vložku skoro celou ubral – zmenšete ho.`); continue; }
      if (sebeprotnuty(g.noha)) vv('chyba', `Šablona ${s.strana}: obrys sám sebe protíná (překřížené uzly) – upravte uzly v editoru, jinak offset a vložka nedávají smysl.`);
      const V = g.vlozka, N = g.noha, roz = J.rozmery(V), rozN = J.rozmery(N), Lt = roz.delka, Wt = roz.sirka;
      const m = { delka: rozN.delka, sirka: rozN.sirka, pata: rozN.pata };
      const yNoha = J.obalka(N).y1;
      let tab = null;
      if (p.rezim === 'kontrolni') { const r = J.rezNaY(V, 0.12 * Lt); tab = J.jazycek(V, p, r ? (r[0] + r[1]) / 2 : Wt / 2); }
      const orez = J.orezoveCary(V, p, Lt);
      for (const r of orez) r.velikost = J.velikosti(m.delka, r.vnitrni);
      pocty[s.strana]++;
      const nazev = (s.strana === 'P' ? 'pravá' : 'levá') + (pocty[s.strana] > 1 ? ' ' + pocty[s.strana] : '');
      /* značky kontrolní šablony od špičky předlohy po špičku šablony (rezerva = offset + přídavek) */
      const znacky = J.znackyDelky(V, Object.assign({}, p, { rezPrsty: Lt - yNoha }), yNoha, Lt);
      nohy.push({ id: s.id, strana: s.strana, role: s.role || 'noha', aktivni: s.aktivni !== false, nazev, m, r: { f: 0, s: 0, h: 0 }, vlozka: V, noha: N, tab, orez, perf: J.perforace(V, p), znacky, prsty: [], osa: [], Lt, Wt, roz, rozN, vel: J.velikosti(m.delka, Lt), sirka: J.tridaSirky(m.delka, m.sirka), zmereno: g.zmereno, off: g.off });
      const o = obr.get(s.obr);
      if (o && meritko(o.kalibrace, o.w, o.h).odhad && Math.abs(s.sx - 1) < 1e-9 && Math.abs(s.sy - 1) < 1e-9) vv('varovani', `${nazev}: předloha nemá změřené měřítko a šablona není zkalibrovaná – rozměry jsou jen odhad. Zadejte skutečnou délku a šířku nebo měřítko obrázku.`);
      const rr = m.sirka / m.delka;
      if (rr < 0.28 || rr > 0.5) vv('varovani', `${nazev}: poměr šířky k délce ${fmt(rr * 100)} % je neobvyklý – zkontrolujte zarovnání a kalibraci.`);
      if (Math.abs(s.sx / s.sy - 1) > 0.08) vv('info', `${nazev}: kalibrace v osách se liší o ${fmt(Math.abs(s.sx / s.sy - 1) * 100)} % – fotka mohla být šikmo; zvažte měřítko podle rohů listu.`);
      if (g.zkolaboval) vv('chyba', `${nazev}: záporný offset je větší než polovina šířky předlohy – vložka by zmizela, offset se nepoužil.`);
      else if ((g.off.ox || 0) < -4 || (g.off.oy || 0) < -4) vv('info', `${nazev}: záporný offset zmenšuje vložku pod obrys předlohy.`);
    }
    const L = nohy.filter((n) => n.strana === 'L'), P = nohy.filter((n) => n.strana === 'P');
    if (L.length && P.length) {
      const dl = Math.abs(L[0].m.delka - P[0].m.delka), ds = Math.abs(L[0].m.sirka - P[0].m.sirka);
      if (dl >= 4 || ds >= 3) vv('info', `Nohy se liší (délka o ${fmt(dl)} mm, šířka o ${fmt(ds)} mm) – každá vložka má vlastní obrys.`);
    }
    if (!nohy.length && !varovani.some((x) => x.uroven === 'chyba')) vv('info', 'Zatím žádná šablona – načtěte předlohu a najděte obrysy.');
    else if (!varovani.some((x) => x.uroven !== 'info')) vv('ok', 'Šablony vypadají věrohodně.');
    const nazev = (p.rezim === 'kontrolni' ? 'Kontrolní šablona' : 'Vložky na míru') + (p.jmeno ? ' – ' + p.jmeno : '') + (nohy.length ? ` (${nohy.map((n) => n.strana + ' ' + fmt(n.roz.delka) + '×' + fmt(n.roz.sirka)).join(', ')} mm)` : '');
    const popis = [
      'Obrys podle předlohy' + (projekt.nazev ? ` „${projekt.nazev}“` : '') + (projekt.poznamka ? ` – ${projekt.poznamka}` : '') + '.',
      ...nohy.map((n) => `${n.nazev}: předloha ${fmt(n.m.delka)} × ${fmt(n.m.sirka)} mm, offset X ${fmt(n.off.ox || 0, 1)} / Y ${fmt(n.off.oy || 0, 1)} mm, ve špičce +${fmt(n.off.spicka || 0, 1)} mm` + (p.rezim === 'vlozka' ? ` · ${J.MATERIALY[p.material].nazev.toLowerCase()} ${fmt(p.tloustka, 1)} mm.` : '.')),
    ];
    return J.doplnVyrobu({ p, nohy, varovani, nazev, popis, vlastni: true });
  }

  /* ---------- čištění projektu (import ze souboru, starší verze) ---------- */
  const novId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const VYROBA = ['rezim', 'material', 'tloustka', 'orez', 'orezKrok', 'orezPocet', 'perforace', 'perfRozt', 'perfPrumer', 'perfOkraj', 'popisky', 'noha', 'jazyk', 'znacky',
    'delkaBoty', 'vrstvy', 'material2', 'tloustka2', 'vrstvaOds', 'pelota', 'pelotaDelka', 'pelotaSirka', 'pelotaPoz', 'podpatenka', 'podpatenkaPrumer'];
  function ocisti(x) {
    x = x && typeof x === 'object' ? x : {};
    const cis = (v, d, a, b) => { const n = +v; return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
    const txt = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);
    const vyb = (v, L, d) => (L.includes(v) ? v : d);
    const bod = (q) => (Array.isArray(q) && Math.abs(+q[0]) < 1e5 && Math.abs(+q[1]) < 1e5 ? [+q[0], +q[1]] : null);
    const ident = (v) => (typeof v === 'string' && /^[a-z0-9_-]{1,40}$/i.test(v) ? v : null);
    const mapaId = new Map();
    const datum = (v) => (typeof v === 'string' && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : new Date().toISOString());
    const TYPY = ['odhad', 'dpi', 'body', 'list', 'karta'];
    /* metadata předlohy (bez obrázku) – i pro záznamy historie */
    const metaObr = (o) => {
      const k = o.kalibrace || {}, kal = { typ: vyb(k.typ, TYPY, 'odhad') };
      if (kal.typ === 'dpi') kal.dpi = cis(k.dpi, 300, 10, 10000);
      if (kal.typ === 'body') { kal.a = bod(k.a); kal.b = bod(k.b); kal.mm = cis(k.mm, 100, 0.1, 5000); if (!kal.a || !kal.b) kal.typ = 'odhad'; }
      if (kal.typ === 'list' || kal.typ === 'karta') { kal.rohy = (Array.isArray(k.rohy) ? k.rohy : []).map(bod).filter(Boolean); if (kal.typ === 'list') kal.papir = vyb(k.papir, Object.keys(PAPIRY), 'a4'); if (kal.rohy.length !== 4) kal.typ = 'odhad'; }
      const d = o.detekce || {};
      return {
        kalibrace: kal, kalVolba: vyb(o.kalVolba, TYPY, kal.typ),
        detekce: { rezim: vyb(d.rezim, ['cara', 'tmavy', 'svetly'], DETEKCE.rezim), prah: 'auto', citlivost: cis(d.citlivost, DETEKCE.citlivost, 0, 1), uzavrit: cis(d.uzavrit, DETEKCE.uzavrit, 0, 4), hrana: vyb(d.hrana, ['stred', 'vnitrni', 'vnejsi'], 'stred'), korekce: cis(d.korekce, 0, -5, 5), vyhlazeni: cis(d.vyhlazeni, DETEKCE.vyhlazeni, 0, 10), minPlocha: cis(d.minPlocha, DETEKCE.minPlocha, 100, 1e6) },
        rezy: (Array.isArray(o.rezy) ? o.rezy : []).slice(0, 200).filter((r) => Array.isArray(r) && r.length === 4 && r.every((c) => Math.abs(+c) < 1e5)).map((r) => r.map(Number)),
      };
    };
    const sab = (t, mapa) => {
      const pr = t.prsty || {};
      return {
        id: ident(t.id) || novId(), obr: mapa.get(t.obr), body: t.body.map(bod).filter(Boolean),
        strana: vyb(t.strana, ['L', 'P'], 'P'), aktivni: t.aktivni !== false, role: vyb(t.role, Object.keys(ROLE), 'noha'), zarovnani: vyb(t.zarovnani, ['osa', 'tecna'], 'osa'), uhelPlus: cis(t.uhelPlus, 0, -180, 180), zrcadlit: !!t.zrcadlit,
        sx: cis(t.sx, 1, 0.3, 3), sy: cis(t.sy, 1, 0.3, 3), ox: cis(t.ox, 0, -20, 40), oy: cis(t.oy, 0, -20, 40), spicka: cis(t.spicka, 0, -20, 40), upraveno: !!t.upraveno,
        prsty: { rezim: vyb(pr.rezim, ['zadne', 'vyhladit', 'obalka'], 'zadne'), sila: cis(pr.sila, 4, 0, 10), od: cis(pr.od, 0.62, 0.4, 0.85) },
      };
    };
    const sablonyZ = (L, mapa) => (Array.isArray(L) ? L : []).slice(0, 100).filter((t) => t && mapa.has(t.obr) && Array.isArray(t.body) && t.body.length <= 20000).map((t) => sab(t, mapa)).filter((t) => t.body.length >= 8 && Math.abs(J.plocha(t.body)) > 100);   // obrys bez plochy (jeden bod, úsečka) zahodit
    const pouzite = new Set();
    const obrazky = (Array.isArray(x.obrazky) ? x.obrazky : []).slice(0, 40).filter((o) => o && typeof o.src === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(o.src)).map((o) => {
      let id = ident(o.id) || novId();
      if (pouzite.has(id)) id = novId();   // duplicitní id → nové, šablony zůstanou u první předlohy s tím id
      pouzite.add(id);
      if (o.id !== undefined && !mapaId.has(o.id)) mapaId.set(o.id, id);
      const kv = o.kvalita && typeof o.kvalita === 'object' ? { skore: cis(o.kvalita.skore, 100, 0, 100), varovani: (Array.isArray(o.kvalita.varovani) ? o.kvalita.varovani : []).slice(0, 8).map((q) => ({ uroven: vyb(q && q.uroven, ['info', 'varovani'], 'info'), text: txt(q && q.text, 200) })) } : null;
      return Object.assign({ id, nazev: txt(o.nazev, 80) || 'předloha', src: o.src, w: cis(o.w, 1, 1, 20000) | 0, h: cis(o.h, 1, 1, 20000) | 0, kvalita: kv }, metaObr(o));
    });
    /* celkový strop bodů (šablony + historie) – obří import by vyčerpal paměť */
    let zbyva = 300000;
    const strop = (L) => L.filter((t) => { zbyva -= t.body.length; return zbyva >= 0; });
    const sablony = strop(sablonyZ(x.sablony, mapaId));
    /* historie verzí: šablony, společný offset a metadata předloh (obrázky se neukládají znovu) */
    const vlastniId = new Map(obrazky.map((o) => [o.id, o.id]));
    for (const [a, b] of mapaId) vlastniId.set(a, b);
    const historie = (Array.isArray(x.historie) ? x.historie : []).slice(-30).filter((h) => h && h.data && typeof h.data === 'object').map((h) => ({
      cas: datum(h.cas), popis: txt(h.popis, 80) || 'verze',
      data: {
        sablony: strop(sablonyZ(h.data.sablony, vlastniId)),
        spolecne: { ox: cis((h.data.spolecne || {}).ox, 0, -20, 40), oy: cis((h.data.spolecne || {}).oy, 0, -20, 40), spicka: cis((h.data.spolecne || {}).spicka, 0, -20, 40) },
        obrazky: (Array.isArray(h.data.obrazky) ? h.data.obrazky : []).filter((o) => o && vlastniId.has(o.id)).map((o) => Object.assign({ id: vlastniId.get(o.id) }, metaObr(o))),
      },
    }));
    const sp = x.spolecne || {}, vyr = x.vyroba && typeof x.vyroba === 'object' ? x.vyroba : null;
    return {
      id: ident(x.id) || novId(), nazev: txt(x.nazev, 80) || 'Projekt', klient: txt(x.klient, 60), poznamka: txt(x.poznamka, 600),
      vytvoreno: datum(x.vytvoreno), upraveno: datum(x.upraveno), obrazky, sablony, historie,
      stav: vyb(x.stav, ZAKAZKA.stav, 'rozpracovano'), termin: typeof x.termin === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.termin) ? x.termin : '', pary: cis(x.pary, 1, 1, 100) | 0,
      spolecne: { ox: cis(sp.ox, 0, -20, 40), oy: cis(sp.oy, 0, -20, 40), spicka: cis(sp.spicka, 0, -20, 40) },
      vyroba: vyr ? Object.fromEntries(VYROBA.filter((k) => ['number', 'string', 'boolean'].includes(typeof vyr[k])).map((k) => [k, vyr[k]])) : null,
    };
  }

  /* ---------- kvalita fotky ---------- */
  /* ostrost (rozptyl Laplaceova operátoru), přepal, jas, kontrast, šikmost snímku podle rohů listu/karty */
  function hodnotKvalitu(z, rohy) {
    const S = zmensiSedou(z, 800), { w, h, g } = S, N = w * h;
    let sum = 0, sum2 = 0, prepal = 0, lap = 0, lap2 = 0, n = 0;
    for (let i = 0; i < N; i++) { sum += g[i]; sum2 += g[i] * g[i]; if (g[i] >= 250) prepal++; }
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, L = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i];
      lap += L; lap2 += L * L; n++;
    }
    const jas = sum / N, kontrast = Math.sqrt(Math.max(0, sum2 / N - jas * jas)), ostrost = n ? lap2 / n - (lap / n) ** 2 : 0;
    let sikmost = 0;
    const R = rohy && rohy.length === 4 ? seradRohy(rohy) : null;
    if (R) {
      const d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
      sikmost = Math.max(Math.abs(d(R[0], R[1]) / d(R[3], R[2]) - 1), Math.abs(d(R[0], R[3]) / d(R[1], R[2]) - 1));
    }
    const varovani = [];
    if (ostrost < 25) varovani.push({ uroven: 'varovani', text: 'Fotka je rozmazaná – obrys bude nepřesný. Vyfoťte znovu, telefon opřete a nechte zaostřit.' });
    else if (ostrost < 60) varovani.push({ uroven: 'info', text: 'Fotka je méně ostrá – zkontrolujte obrys u prstů.' });
    if (prepal / N > 0.15) varovani.push({ uroven: 'varovani', text: 'Fotka je přesvícená – světlé části splývají. Stínte blesk nebo přesuňte papír ze slunce.' });
    if (jas < 80) varovani.push({ uroven: 'varovani', text: 'Fotka je tmavá – přidejte světlo.' });
    if (kontrast < 25) varovani.push({ uroven: 'varovani', text: 'Málo kontrastu – obkreslete tmavší tužkou nebo fixem.' });
    if (sikmost > 0.3) varovani.push({ uroven: 'varovani', text: `Fotka je hodně šikmo (${Math.round(sikmost * 100)} %) – perspektiva se srovná, ale vzdálenější část má menší rozlišení. Foťte kolmo shora.` });
    else if (sikmost > 0.12) varovani.push({ uroven: 'info', text: 'Fotka je mírně šikmo – srovná se automaticky.' });
    const skore = Math.max(0, Math.min(100, Math.round(100 - (ostrost < 25 ? 45 : ostrost < 60 ? 15 : 0) - (prepal / N > 0.15 ? 25 : 0) - (jas < 80 ? 20 : 0) - (kontrast < 25 ? 25 : 0) - Math.min(30, sikmost * 80))));
    return { ostrost: Math.round(ostrost), jas: Math.round(jas), kontrast: Math.round(kontrast), prepal: Math.round(prepal / N * 1000) / 10, sikmost: Math.round(sikmost * 100) / 100, skore, varovani };
  }

  /* ---------- dvě šablony téže nohy: průměr, dorovnání podle druhé nohy ---------- */
  /* obrys (y nahoru, CCW) → N bodů rovnoměrně po obvodu od nejnižšího bodu paty */
  function obvodoveBody(P, N) {
    const o = obvodDelka(P), Q = prevzorkuj(P, o / N).slice(0, N);
    const i0 = Q.reduce((m, q, i) => (q[1] < Q[m][1] ? i : m), 0);
    return Q.slice(i0).concat(Q.slice(0, i0));
  }
  const obvodDelka = (P) => P.reduce((s, q, i) => s + Math.hypot(P[(i + 1) % P.length][0] - q[0], P[(i + 1) % P.length][1] - q[1]), 0);
  const stredPaty = (P) => { const o = J.obalka(P), r = J.rezNaY(P, o.y0 + 0.1 * o.h); return [r ? (r[0] + r[1]) / 2 : (o.x0 + o.x1) / 2, o.y0]; };
  /* průměr dvou obrysů téže nohy (přiložených patou); vrací body nové šablony v souřadnicích předlohy A a odchylky */
  function prumerSablon(sA, sB, spol) {
    const gA = geometrie(sA, spol), gB = geometrie(sB, spol), N = 400;
    let B = gB.noha;
    if (sA.strana !== sB.strana) { const o = J.obalka(B); B = J.zrcadli(B, o.x0 + o.x1); }
    const pa = stredPaty(gA.noha), pb = stredPaty(B);
    const A1 = obvodoveBody(gA.noha, N), B1 = obvodoveBody(B.map(([x, y]) => [x - pb[0] + pa[0], y - pb[1] + pa[1]]), N);
    let max = 0, sum = 0;
    const M = A1.map((a, i) => { const b = B1[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); max = Math.max(max, d); sum += d; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; });
    return { body: ridiciBody(M.map(gA.zpet), 0.2), max, prumer: sum / N, delkaA: gA.zmereno.delka * (sA.sy || 1), delkaB: gB.zmereno.delka * (sB.sy || 1) };
  }
  /* tvar druhé nohy (zrcadlený) přeškálovaný na délku a šířku cílové šablony – pro poškozenou předlohu jedné nohy */
  function dorovnatPodle(sCil, sVzor, spol) {
    const gC = geometrie(sCil, spol), gV = geometrie(sVzor, spol), oc = J.obalka(gC.noha);
    let V = gV.noha;
    if (sCil.strana !== sVzor.strana) { const o = J.obalka(V); V = J.zrcadli(V, o.x0 + o.x1); }
    const ov = J.obalka(V);
    const T = V.map(([x, y]) => [oc.x0 + (x - ov.x0) * oc.w / ov.w, oc.y0 + (y - ov.y0) * oc.h / ov.h]);
    return ridiciBody(prevzorkuj(T, 1).map(gC.zpet), 0.2);
  }

  /* ---------- sdílení obrysů odkazem (bez obrázků, data přímo v odkazu) ---------- */
  const b64url = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return (typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const zB64url = (t) => { const s = (typeof atob !== 'undefined' ? atob : (x) => Buffer.from(x, 'base64').toString('binary'))(t.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  /* limit = nejvíc bajtů výstupu (rozbalení podvrženého odkazu nesmí zahltit paměť) */
  async function proud(data, tam, limit) {
    const cs = tam ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw');
    const w = cs.writable.getWriter();
    w.write(data).catch(() => {}); w.close().catch(() => {});   // chybu poškozených dat ohlásí čtení níže, ne nezachycená výjimka
    const rd = cs.readable.getReader(), kusy = []; let n = 0;
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      n += value.length; if (limit && n > limit) { rd.cancel().catch(() => {}); throw new Error('odkaz je příliš velký'); }
      kusy.push(value);
    }
    const out = new Uint8Array(n); let i = 0; for (const k of kusy) { out.set(k, i); i += k.length; }
    return out;
  }
  /* projekt → krátký řetězec: body po 0,1 mm, rozdílově (dobře se komprimují); každá šablona posunutá na počátek */
  /* volby.osobni = přiložit i klienta a poznámku (výchozí ne: odkaz může putovat dál) */
  async function zakoduj(pr, volby) {
    const sab = pr.sablony.map((t) => {
      const o = J.obalka(t.body); let px = 0, py = 0;
      const b = []; for (const [x, y] of t.body) { const X = Math.round((x - o.x0) * 10), Y = Math.round((y - o.y0) * 10); b.push(X - px, Y - py); px = X; py = Y; }
      return { s: t.strana, r: t.role, a: t.aktivni !== false ? 1 : 0, b, k: [t.sx, t.sy, t.ox, t.oy, t.spicka, t.uhelPlus].map((x) => Math.round((+x || 0) * 10000) / 10000), z: t.zarovnani, m: t.zrcadlit ? 1 : 0, p: t.prsty };
    });
    const os = volby && volby.osobni, json = JSON.stringify({ v: 1, n: pr.nazev, kl: os ? pr.klient : '', po: os ? pr.poznamka : '', sp: pr.spolecne, vy: pr.vyroba, t: sab });
    return b64url(await proud(new TextEncoder().encode(json), true));
  }
  /* řetězec → surový projekt; obrázek (bílá plocha 1 px = 1 mm) dodá volající jako data URL podle rozměru */
  async function dekoduj(kod, bilyObrazek) {
    let d = null;
    try { d = JSON.parse(new TextDecoder().decode(await proud(zB64url(kod), false, 2e6))); }
    catch (e) { throw new Error(/příliš velký/.test(e.message) ? e.message : 'odkaz je poškozený (neúplně zkopírovaný?)'); }
    if (!d || typeof d !== 'object' || d.v !== 1 || !Array.isArray(d.t)) throw new Error('odkaz neobsahuje obrysy vložek');
    let x0 = 10; const H = [];
    const sablony = d.t.slice(0, 40).filter((t) => t && typeof t === 'object' && Array.isArray(t.b)).map((t) => {
      let X = 0, Y = 0; const body = [];
      for (let i = 0; i + 1 < t.b.length && i < 40000; i += 2) {
        const a = t.b[i], b = t.b[i + 1];
        if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 1e5 || Math.abs(b) > 1e5) throw new Error('odkaz je poškozený');
        X += a; Y += b; body.push([X / 10 + x0, Y / 10 + 10]);
      }
      if (body.some(([x, y]) => Math.abs(x) > 5000 || Math.abs(y) > 5000)) throw new Error('odkaz je poškozený (obrys mimo rozsah)');
      const o = J.obalka(body.length ? body : [[x0, 10]]); x0 = o.x1 + 20; H.push(o.y1 + 10);
      const k = Array.isArray(t.k) ? t.k : [];
      return { id: novId(), obr: 'sdileno', body, strana: t.s, role: t.r, aktivni: t.a !== 0, sx: k[0], sy: k[1], ox: k[2], oy: k[3], spicka: k[4], uhelPlus: k[5], zarovnani: t.z, zrcadlit: !!t.m, prsty: t.p };
    });
    if (!sablony.length) throw new Error('odkaz neobsahuje obrysy vložek');
    const w = Math.min(20000, Math.ceil(x0 - 10)), h = Math.min(20000, Math.ceil(Math.max(100, ...H)));
    return { nazev: d.n, klient: d.kl, poznamka: d.po, spolecne: d.sp, vyroba: d.vy, sablony, obrazky: [{ id: 'sdileno', nazev: 'sdílené obrysy', src: bilyObrazek(w, h), w, h, kalibrace: { typ: 'dpi', dpi: 25.4 } }] };
  }

  /* záznam historie: stav šablon a předloh bez obrázků */
  function snimek(pr, popis) {
    return { cas: new Date().toISOString(), popis: popis || 'verze', data: JSON.parse(JSON.stringify({ sablony: pr.sablony, spolecne: pr.spolecne, obrazky: pr.obrazky.map((o) => ({ id: o.id, kalibrace: o.kalibrace, kalVolba: o.kalVolba, detekce: o.detekce, rezy: o.rezy })) })) };
  }
  /* obnova záznamu: šablony a nastavení předloh, které v projektu ještě jsou */
  function obnovSnimek(pr, h) {
    const ids = new Set(pr.obrazky.map((o) => o.id));
    pr.sablony = JSON.parse(JSON.stringify(h.data.sablony.filter((t) => ids.has(t.obr))));
    pr.spolecne = Object.assign({}, h.data.spolecne);
    for (const m of h.data.obrazky) { const o = pr.obrazky.find((q) => q.id === m.id); if (o) Object.assign(o, JSON.parse(JSON.stringify({ kalibrace: m.kalibrace, kalVolba: m.kalVolba, detekce: m.detekce, rezy: m.rezy }))); }
    return pr;
  }

  const API = { PAPIRY, VYROBA, ROLE, KARTA, ZAKAZKA, ocisti, snimek, obnovSnimek, najdiList, najdiKartu, zmensiSedou, nejvetsiCtyruhelnik, upravPrsty, ridiciBody, zapect, taubin, vyhladObrys, hodnotKvalitu, prumerSablon, dorovnatPodle, zakoduj, dekoduj, DETEKCE, SABLONA, homografie, hBod, inverze3, seradRohy, meritko, rozliseni, srovnej, otsu, tmave, dilatuj, najdiObrysy, obrysSlozky, upravObrys, prevzorkuj, vyhlad, zjednodus, orientuj, odsad, spicka, teziste, otoc, uhelZarovnani, odhadStrany, geometrie, sestav };
  if (uzel) module.exports = API;
  koren.BFC = API;
})(typeof window !== 'undefined' ? window : globalThis);
