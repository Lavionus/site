/* ============================================================
   anonymizace/jadro.js – výpočty pro Anonymizaci fotek (bez DOM).
   Obraz = RGBA pole (Uint8ClampedArray z ImageData) W*H*4.
   Oblast = { id, tvar: 'obdelnik'|'elipsa'|'stetec'|'polygon', x, y, w, h,
              efekt: 'rozmazat'|'pixely'|'cerna'|'emoji'|'zrneni', sila 0–100, emoji,
              barva '#rrggbb' (efekt 'cerna' = plná barva),
              zdroj: 'rucni'|'oblicej'|'spz', skore, navrh, vypnuta,
              body: [[x,y],…] (štětec a polygon) a r (jen štětec, v pixelech obrazu) }
   V prohlížeči window.ANON, v node module.exports.
   ============================================================ */
(function (koren) {
'use strict';

const EFEKTY = ['rozmazat', 'pixely', 'cerna', 'emoji', 'zrneni'];
const TVARY = ['obdelnik', 'elipsa', 'stetec', 'polygon'];
const jeBarva = b => /^#[0-9a-f]{6}$/i.test(b || '');
const omez = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- oblasti ---------- */
let citac = 0;
function novaOblast(o = {}) {
  const r = {
    id: o.id || ('o' + Date.now().toString(36) + (citac++).toString(36)),
    tvar: TVARY.includes(o.tvar) ? o.tvar : 'obdelnik',
    x: +o.x || 0, y: +o.y || 0, w: Math.max(1, +o.w || 1), h: Math.max(1, +o.h || 1),
    efekt: EFEKTY.includes(o.efekt) ? o.efekt : 'rozmazat',
    sila: omez(o.sila === undefined ? 60 : +o.sila, 0, 100),
    emoji: o.emoji || '😎', barva: jeBarva(o.barva) ? o.barva.toLowerCase() : '#000000',
    zdroj: o.zdroj || 'rucni', skore: o.skore === undefined ? null : o.skore,
    navrh: !!o.navrh, vypnuta: !!o.vypnuta,
  };
  if (r.tvar === 'stetec') { r.body = (o.body || []).map(p => [p[0], p[1]]); r.r = Math.max(1, +o.r || 10); prepocitejStetec(r); }
  if (r.tvar === 'polygon') { r.body = (o.body || []).map(p => [p[0], p[1]]); r.r = 0; prepocitejStetec(r); }
  return r;
}
/** Ohraničení tahu štětce = body ± poloměr (polygon má r = 0). */
function prepocitejStetec(o) {
  if (!o.body || !o.body.length) return o;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of o.body) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  o.x = x0 - o.r; o.y = y0 - o.r; o.w = x1 - x0 + 2 * o.r; o.h = y1 - y0 + 2 * o.r;
  return o;
}
function normObdelnik(x0, y0, x1, y1) {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}
/** Nastaví oblasti nový obdélník; body štětce se přepočtou (posun i změna měřítka). */
function nastavObdelnik(o, r) {
  if (o.tvar === 'polygon' && o.body) {
    const sx = r.w / (o.w || 1), sy = r.h / (o.h || 1);
    o.body = o.body.map(([x, y]) => [r.x + (x - o.x) * sx, r.y + (y - o.y) * sy]);
    o.x = r.x; o.y = r.y; o.w = Math.max(1, r.w); o.h = Math.max(1, r.h);
  } else if (o.tvar === 'stetec' && o.body) {
    const sx = r.w / o.w, sy = r.h / o.h;
    const ix = o.x + o.r, iy = o.y + o.r, nr = Math.max(1, o.r * Math.min(sx, sy));
    o.body = o.body.map(([x, y]) => [r.x + nr + (x - ix) * sx, r.y + nr + (y - iy) * sy]);
    o.r = nr; prepocitejStetec(o);
    // zaokrouhlení po přepočtu – drž přesně zadaný obdélník
    o.x = r.x; o.y = r.y; o.w = r.w; o.h = r.h;
  } else { o.x = r.x; o.y = r.y; o.w = Math.max(1, r.w); o.h = Math.max(1, r.h); }
  return o;
}
function posun(o, dx, dy) { return nastavObdelnik(o, { x: o.x + dx, y: o.y + dy, w: o.w, h: o.h }); }

function vzdalenostKUsecce(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, d = vx * vx + vy * vy;
  const t = d ? omez(((px - ax) * vx + (py - ay) * vy) / d, 0, 1) : 0;
  const qx = ax + t * vx - px, qy = ay + t * vy - py;
  return Math.sqrt(qx * qx + qy * qy);
}
/** Leží bod (střed pixelu) uvnitř tvaru oblasti? */
function obsahuje(o, x, y) {
  if (x < o.x || y < o.y || x > o.x + o.w || y > o.y + o.h) return false;
  if (o.tvar === 'elipsa') {
    const rx = o.w / 2, ry = o.h / 2, dx = (x - o.x - rx) / rx, dy = (y - o.y - ry) / ry;
    return dx * dx + dy * dy <= 1;
  }
  if (o.tvar === 'polygon') return vPolygonu(o.body, x, y);
  if (o.tvar === 'stetec') {
    const b = o.body;
    if (b.length === 1) return Math.hypot(x - b[0][0], y - b[0][1]) <= o.r;
    for (let i = 1; i < b.length; i++) if (vzdalenostKUsecce(x, y, b[i - 1][0], b[i - 1][1], b[i][0], b[i][1]) <= o.r) return true;
    return false;
  }
  return true;
}
/** Bod v mnohoúhelníku (pravidlo sudé–liché). */
function vPolygonu(b, x, y) {
  let uvnitr = false;
  for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
    const [xi, yi] = b[i], [xj, yj] = b[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) uvnitr = !uvnitr;
  }
  return uvnitr;
}
/** Nejvyšší oblast pod bodem (poslední v seznamu je nahoře). */
function najdiOblast(oblasti, x, y) {
  for (let i = oblasti.length - 1; i >= 0; i--) if (obsahuje(oblasti[i], x, y)) return oblasti[i];
  return null;
}
const UCHYTY = ['sz', 's', 'sv', 'v', 'jv', 'j', 'jz', 'z'];
function uchyty(o) {
  const x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h, cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  return { sz: [x0, y0], s: [cx, y0], sv: [x1, y0], v: [x1, cy], jv: [x1, y1], j: [cx, y1], jz: [x0, y1], z: [x0, cy] };
}
function najdiUchyt(o, x, y, tol) {
  const u = uchyty(o);
  for (const k of UCHYTY) if (Math.abs(u[k][0] - x) <= tol && Math.abs(u[k][1] - y) <= tol) return k;
  return null;
}
/** Tah úchytem: z původního obdélníku r0 a posunu (dx, dy) nový obdélník (nepřevrátí se, min. velikost). */
function tahUchytem(r0, uchyt, dx, dy, min = 4) {
  let x0 = r0.x, y0 = r0.y, x1 = r0.x + r0.w, y1 = r0.y + r0.h;
  if (uchyt.includes('z')) x0 = Math.min(x0 + dx, x1 - min);
  if (uchyt.includes('v')) x1 = Math.max(x1 + dx, x0 + min);
  if (uchyt[0] === 's') y0 = Math.min(y0 + dy, y1 - min);
  if (uchyt[0] === 'j') y1 = Math.max(y1 + dy, y0 + min);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* ---------- maska oblasti ---------- */
/** Maska tvaru oříznutá na obraz: { x0, y0, w, h, a: Uint8Array(w*h) } nebo null. */
function maska(o, W, H) {
  const x0 = omez(Math.floor(o.x), 0, W), y0 = omez(Math.floor(o.y), 0, H);
  const x1 = omez(Math.ceil(o.x + o.w), 0, W), y1 = omez(Math.ceil(o.y + o.h), 0, H);
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return null;
  const a = new Uint8Array(w * h);
  if (o.tvar === 'obdelnik') a.fill(1);
  else if (o.tvar === 'polygon') {
    // řádkové vyplnění: průsečíky hran se středem řádku, mezi dvojicemi plno
    const b = o.body;
    for (let y = 0; y < h; y++) {
      const py = y0 + y + 0.5, xs = [];
      for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
        const [xi, yi] = b[i], [xj, yj] = b[j];
        if ((yi > py) !== (yj > py)) xs.push((xj - xi) * (py - yi) / (yj - yi) + xi);
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a0 = omez(Math.ceil(xs[k] - 0.5 - x0), 0, w), a1 = omez(Math.floor(xs[k + 1] - 0.5 - x0) + 1, 0, w);
        for (let x = a0; x < a1; x++) a[y * w + x] = 1;
      }
    }
  } else if (o.tvar === 'elipsa') {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (obsahuje(o, x0 + x + 0.5, y0 + y + 0.5)) a[y * w + x] = 1;
  } else {
    // štětec: každý úsek jako „kapsle“ – projdi jen jeho okolí
    const b = o.body, r = o.r;
    const kresli = (ax, ay, bx, by) => {
      const sx0 = omez(Math.floor(Math.min(ax, bx) - r) - x0, 0, w), sx1 = omez(Math.ceil(Math.max(ax, bx) + r) - x0, 0, w);
      const sy0 = omez(Math.floor(Math.min(ay, by) - r) - y0, 0, h), sy1 = omez(Math.ceil(Math.max(ay, by) + r) - y0, 0, h);
      for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++)
        if (!a[y * w + x] && vzdalenostKUsecce(x0 + x + 0.5, y0 + y + 0.5, ax, ay, bx, by) <= r) a[y * w + x] = 1;
    };
    if (b.length === 1) kresli(b[0][0], b[0][1], b[0][0], b[0][1]);
    for (let i = 1; i < b.length; i++) kresli(b[i - 1][0], b[i - 1][1], b[i][0], b[i][1]);
  }
  return { x0, y0, w, h, a };
}

/* ---------- rozmazání (5× box blur ≈ Gauss) ----------
   Proč 5 a ne obvyklé 3: přenos n boxů je sinc^n. Při 3 průchodech mají postranní laloky ~1 % amplitudy,
   takže jemný vzor (písmena) určité periody projde se ~1,3 úrovně jasu a jde zesílit (dekonvoluce).
   Při 5 průchodech je to ~0,05 % (< 0,1 úrovně) a zaokrouhlení na 8 bitů ho smaže. */
const PRUCHODY = 5;
function boxyProGauss(sigma, n = PRUCHODY) {
  const wIdeal = Math.sqrt(12 * sigma * sigma / n + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  const r = [];
  for (let i = 0; i < n; i++) r.push(((i < m ? wl : wu) - 1) / 2);
  return r; // poloměry
}
function boxH(src, dst, w, h, r) {
  const d = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 3;
    let a0 = 0, a1 = 0, a2 = 0;
    for (let k = -r; k <= r; k++) { const i = row + omez(k, 0, w - 1) * 3; a0 += src[i]; a1 += src[i + 1]; a2 += src[i + 2]; }
    for (let x = 0; x < w; x++) {
      const o = row + x * 3, p = row + Math.min(w - 1, x + r + 1) * 3, m = row + Math.max(0, x - r) * 3;
      dst[o] = a0 / d; dst[o + 1] = a1 / d; dst[o + 2] = a2 / d;
      a0 += src[p] - src[m]; a1 += src[p + 1] - src[m + 1]; a2 += src[p + 2] - src[m + 2];
    }
  }
}
function boxV(src, dst, w, h, r) {
  // po řádcích se součtem pro každý sloupec zvlášť – průchod po sloupcích je kvůli cache několikrát pomalejší
  const d = 2 * r + 1, n = w * 3, acc = new Float64Array(n);
  for (let k = -r; k <= r; k++) { const row = omez(k, 0, h - 1) * n; for (let i = 0; i < n; i++) acc[i] += src[row + i]; }
  for (let y = 0; y < h; y++) {
    const o = y * n, plus = Math.min(h - 1, y + r + 1) * n, minus = Math.max(0, y - r) * n;
    for (let i = 0; i < n; i++) { dst[o + i] = acc[i] / d; acc[i] += src[plus + i] - src[minus + i]; }
  }
}
/** Gaussovské rozmazání výřezu RGBA (W×H) – vrátí Float32Array w*h*3 (RGB) výřezu. */
function rozmazVyrez(rgba, W, H, vx, vy, w, h, sigma) {
  let a = new Float32Array(w * h * 3), b = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((vy + y) * W + vx + x) * 4, d = (y * w + x) * 3;
    a[d] = rgba[s]; a[d + 1] = rgba[s + 1]; a[d + 2] = rgba[s + 2];
  }
  if (sigma < 0.5) return a;
  for (const r of boxyProGauss(sigma)) {
    if (r < 1) continue;
    boxH(a, b, w, h, r); boxV(b, a, w, h, r);
  }
  return a;
}
/** Síla 0–100 → sigma rozmazání / velikost bloku pixelizace podle velikosti oblasti. */
// u štětce rozhoduje šířka stopy, ne obdélník kolem celého tahu (dlouhý tah by rozmazával skoro celou fotku a trval sekundy)
const delsiStrana = o => o.tvar === 'stetec' ? 2 * o.r : Math.max(o.w, o.h);
const kratsiStrana = o => o.tvar === 'stetec' ? 2 * o.r : Math.min(o.w, o.h);
function sigmaZeSily(o) { return Math.max(2, (0.03 + o.sila / 100 * 0.22) * delsiStrana(o)); }
function blokZeSily(o) { return Math.max(3, Math.round((0.05 + o.sila / 100 * 0.25) * delsiStrana(o))); }

/**
 * Nevratnost efektu. Gauss se σ zeslabí detail o periodě p na exp(−2π²σ²/p²). Plný kontrast má amplitudu 127,5,
 * po zeslabení pod 0,5 (polovina kroku 8bit) ho zaokrouhlení smaže → zničí se detaily s periodou p < σ·1,887.
 * Pixelizace blokem B zachová jen průměry bloků → detaily menší než B. Barva/emoji zničí vše.
 * Vrátí { detail: px, podil: detail / kratší strana oblasti, uroven: 'bezpecne'|'stredni'|'slabe' }.
 * Prahy: podíl ≥ 0,25 = rysy obličeje (oči, ústa ≈ 1/4–1/5 šířky) i znaky SPZ (≈ 2/3 výšky) zaniknou.
 */
const MEZ_DETAILU = Math.sqrt(2 * Math.PI * Math.PI / Math.log(127.5 / 0.5));
function hodnoceni(o) {
  if (o.efekt === 'cerna' || o.efekt === 'emoji') return { detail: Infinity, podil: Infinity, uroven: 'bezpecne' };
  const detail = o.efekt === 'pixely' ? blokZeSily(o) : sigmaZeSily(o) * MEZ_DETAILU;
  const podil = detail / Math.max(1, kratsiStrana(o));
  return { detail, podil, uroven: podil >= 0.25 ? 'bezpecne' : podil >= 0.12 ? 'stredni' : 'slabe' };
}
/** Deterministický generátor (mulberry32) – šum stejný při každém překreslení. */
function nahoda(semeno) {
  let a = semeno >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashTextu(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
const hexNaRgb = b => [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];

/** Přímo do obrazu (in place) použije efekt oblasti. Emoji = silná pixelizace (emoji kreslí stránka navrch). */
function aplikujOblast(rgba, W, H, o) {
  const m = maska(o, W, H);
  if (!m) return;
  const { x0, y0, w, h, a } = m;
  if (o.efekt === 'rozmazat' || o.efekt === 'zrneni') {
    const sigma = sigmaZeSily(o), pr = Math.ceil(sigma * 3);
    const vx = Math.max(0, x0 - pr), vy = Math.max(0, y0 - pr);
    const vw = Math.min(W, x0 + w + pr) - vx, vh = Math.min(H, y0 + h + pr) - vy;
    const r = rozmazVyrez(rgba, W, H, vx, vy, vw, vh, sigma);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!a[y * w + x]) continue;
      const s = ((y0 + y - vy) * vw + x0 + x - vx) * 3, d = ((y0 + y) * W + x0 + x) * 4;
      rgba[d] = r[s]; rgba[d + 1] = r[s + 1]; rgba[d + 2] = r[s + 2];
    }
    if (o.efekt === 'zrneni') { // hrubé zrno navrch rozmazání: amplituda podle síly (±20 až ±80)
      const rnd = nahoda(hashTextu(String(o.id))), amp = 20 + o.sila * 0.6;
      for (let i = 0; i < w * h; i++) {
        if (!a[i]) continue;
        const d = ((y0 + Math.floor(i / w)) * W + x0 + i % w) * 4, n = (rnd() * 2 - 1) * amp;
        rgba[d] += n; rgba[d + 1] += n; rgba[d + 2] += n;
      }
    }
  } else if (o.efekt === 'pixely' || o.efekt === 'emoji') {
    const B = o.efekt === 'emoji' ? Math.max(3, Math.round(Math.max(o.w, o.h) / 6)) : blokZeSily(o);
    // bloky zarovnané na roh oblasti, průměr počítán přes celý blok (i mimo masku)
    const bx0 = Math.floor(o.x), by0 = Math.floor(o.y);
    for (let by = by0; by < y0 + h; by += B) for (let bx = bx0; bx < x0 + w; bx += B) {
      const sx0 = Math.max(0, bx), sy0 = Math.max(0, by), sx1 = Math.min(W, bx + B), sy1 = Math.min(H, by + B);
      if (sx1 <= sx0 || sy1 <= sy0) continue;
      let r = 0, g = 0, bb = 0, n = 0;
      for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) { const i = (y * W + x) * 4; r += rgba[i]; g += rgba[i + 1]; bb += rgba[i + 2]; n++; }
      r /= n; g /= n; bb /= n;
      for (let y = Math.max(sy0, y0); y < Math.min(sy1, y0 + h); y++) for (let x = Math.max(sx0, x0); x < Math.min(sx1, x0 + w); x++) {
        if (!a[(y - y0) * w + x - x0]) continue;
        const i = (y * W + x) * 4; rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = bb;
      }
    }
  } else { // cerna = plná barva
    const [cr, cg, cb] = hexNaRgb(o.barva || '#000000');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!a[y * w + x]) continue;
      const i = ((y0 + y) * W + x0 + x) * 4; rgba[i] = cr; rgba[i + 1] = cg; rgba[i + 2] = cb;
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[y * w + x]) rgba[((y0 + y) * W + x0 + x) * 4 + 3] = 255;
}
/** Kopie obrazu se všemi aktivními oblastmi (vypnuté a nepřijaté návrhy se přeskočí). */
function vykresli(orig, W, H, oblasti) {
  const out = new Uint8ClampedArray(orig);
  for (const o of oblasti) if (aktivni(o)) aplikujOblast(out, W, H, o);
  return out;
}
const aktivni = o => !o.vypnuta && !o.navrh;

/* ---------- detekce obličejů (UltraFace RFB-320) ---------- */
const UF_W = 320, UF_H = 240;
/** Výřez obrazu (r = {x,y,w,h}) převzorkovaný na nw×nh (průměr plochy) → Uint8ClampedArray RGBA. */
function vyrezNa(rgba, W, H, r, nw, nh) {
  const out = new Uint8ClampedArray(nw * nh * 4), sx = r.w / nw, sy = r.h / nh;
  for (let ty = 0; ty < nh; ty++) {
    const ya = r.y + ty * sy, yb = ya + sy;
    const iy0 = omez(Math.floor(ya), 0, H - 1), iy1 = omez(Math.max(Math.ceil(yb), iy0 + 1), 1, H);
    for (let tx = 0; tx < nw; tx++) {
      const xa = r.x + tx * sx, xb = xa + sx;
      const ix0 = omez(Math.floor(xa), 0, W - 1), ix1 = omez(Math.max(Math.ceil(xb), ix0 + 1), 1, W);
      let cr = 0, cg = 0, cb = 0, n = 0;
      for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) { const i = (y * W + x) * 4; cr += rgba[i]; cg += rgba[i + 1]; cb += rgba[i + 2]; n++; }
      const d = (ty * nw + tx) * 4;
      out[d] = cr / n; out[d + 1] = cg / n; out[d + 2] = cb / n; out[d + 3] = 255;
    }
  }
  return out;
}
/** Vstup modelu [1,3,240,320] CHW: (RGB − 127) / 128. */
function tenzorUltraFace(rgba, w = UF_W, h = UF_H) {
  const t = new Float32Array(3 * w * h), n = w * h;
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) t[c * n + i] = (rgba[i * 4 + c] - 127) / 128;
  return t;
}
/** Výstupy scores [N,2] a boxes [N,4] (normované x0,y0,x1,y1) → detekce nad prahem, po NMS. */
function dekodujUltraFace(scores, boxes, prah = 0.7) {
  const r = [], n = scores.length / 2;
  for (let i = 0; i < n; i++) {
    const s = scores[i * 2 + 1];
    if (s < prah) continue;
    r.push({ x0: omez(boxes[i * 4], 0, 1), y0: omez(boxes[i * 4 + 1], 0, 1), x1: omez(boxes[i * 4 + 2], 0, 1), y1: omez(boxes[i * 4 + 3], 0, 1), skore: s });
  }
  return nms(r, 0.3);
}
function plocha(b) { return Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0); }
function prunik(a, b) {
  return Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
}
function iou(a, b) { const p = prunik(a, b); return p / (plocha(a) + plocha(b) - p || 1); }
function nms(boxy, prah) {
  const s = boxy.slice().sort((a, b) => b.skore - a.skore), ven = [];
  for (const b of s) if (!ven.some(k => iou(k, b) > prah)) ven.push(b);
  return ven;
}
/** Dlaždice pro hledání malých obličejů: celý obraz + mřížky 4:3 s překryvem, dokud dlaždice není menší než vstup modelu. */
function planDlazdic(W, H) {
  const plan = [{ x: 0, y: 0, w: W, h: H }];
  for (let n = 2; n <= 4; n++) {
    const tw = Math.min(W, Math.round(W / n * 1.35)), th = Math.min(H, Math.round(tw * 0.75));
    if (tw < UF_W * 1.2) break;
    const nx = Math.max(1, Math.ceil((W - tw) / (tw * 0.75)) + 1), ny = Math.max(1, Math.ceil((H - th) / (th * 0.75)) + 1);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = nx === 1 ? 0 : Math.round(i * (W - tw) / (nx - 1)), y = ny === 1 ? 0 : Math.round(j * (H - th) / (ny - 1));
      plan.push({ x, y, w: tw, h: th });
    }
  }
  return plan;
}
/** Detekce z dlaždice (normované) → souřadnice obrazu. */
function naObraz(det, d) {
  return { x0: d.x + det.x0 * d.w, y0: d.y + det.y0 * d.h, x1: d.x + det.x1 * d.w, y1: d.y + det.y1 * d.h, skore: det.skore };
}
/** Sloučí detekce z více dlaždic: překryvy (IoU nebo velký podíl menšího) spojí do sjednocení. */
function slucDetekce(boxy) {
  const s = boxy.slice().sort((a, b) => b.skore - a.skore), ven = [];
  for (const b of s) {
    const k = ven.find(k => iou(k, b) > 0.3 || prunik(k, b) / Math.min(plocha(k), plocha(b) || 1) > 0.6);
    if (!k) { ven.push({ ...b }); continue; }
    if (iou(k, b) < 0.5) { // část obličeje na hraně dlaždice → rozšiř
      k.x0 = Math.min(k.x0, b.x0); k.y0 = Math.min(k.y0, b.y0); k.x1 = Math.max(k.x1, b.x1); k.y1 = Math.max(k.y1, b.y1);
    }
  }
  return ven;
}
/** Detekce → oblast (elipsa s okrajem, aby zakryla i čelo a bradu). */
function oblastZObliceje(b, W, H, okraj = 0.18, vychozi = {}) {
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  const x0 = omez(b.x0 - w * okraj, 0, W), y0 = omez(b.y0 - h * okraj, 0, H);
  const x1 = omez(b.x1 + w * okraj, 0, W), y1 = omez(b.y1 + h * okraj * 0.8, 0, H);
  return novaOblast({ ...vychozi, tvar: 'elipsa', x: x0, y: y0, w: x1 - x0, h: y1 - y0, zdroj: 'oblicej', skore: Math.round(b.skore * 100) / 100 });
}

/* ---------- SPZ – heuristika ---------- */
function sedotisk(rgba, w, h) {
  const g = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = (rgba[i * 4] * 77 + rgba[i * 4 + 1] * 150 + rgba[i * 4 + 2] * 29) >> 8;
  return g;
}
/**
 * Kandidáti na registrační značku v šedotónu: husté svislé hrany znaků → vodorovné spojení → komponenty
 * s poměrem stran pruhu znaků EU značky (520 mm × ~80 mm znaků ≈ 6,5; povoleno 2,5–11 kvůli záběru ze strany),
 * dost přechodů a kontrastem. Vrácený obdélník je o čtvrtinu výšky rozšířený na celou značku.
 * Vrátí [{x,y,w,h,skore}] seřazené podle skóre (nejvýš max).
 */
function hledejSpz(g, w, h, max = 6) {
  const e = new Uint8Array(w * h);
  let sum = 0, sum2 = 0, n = 0;
  const gx = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 1; x < w - 1; x++) {
    const v = Math.abs(g[y * w + x + 1] - g[y * w + x - 1]);
    gx[y * w + x] = v; sum += v; sum2 += v * v; n++;
  }
  const prum = sum / (n || 1), sd = Math.sqrt(Math.max(0, sum2 / (n || 1) - prum * prum));
  const T = Math.max(40, prum + 1.5 * sd);
  for (let i = 0; i < w * h; i++) e[i] = gx[i] >= T ? 1 : 0;
  // vodorovné uzavření – spojí znaky do jednoho pruhu
  const k = Math.max(4, Math.round(w / 100));
  const d = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let posl = -1e9;
    for (let x = 0; x < w; x++) { if (e[y * w + x]) posl = x; if (x - posl <= k) d[y * w + x] = 1; }
    posl = 1e9;
    for (let x = w - 1; x >= 0; x--) { if (e[y * w + x]) posl = x; if (posl - x <= k && d[y * w + x]) d[y * w + x] = 2; }
  }
  for (let i = 0; i < w * h; i++) d[i] = d[i] === 2 ? 1 : 0;
  // komponenty (4-sousedství)
  const lab = new Int32Array(w * h), zas = [], komp = [], kand = [];
  let id = 0;
  for (let s = 0; s < w * h; s++) {
    if (!d[s] || lab[s]) continue;
    id++; lab[s] = id; zas.push(s);
    let x0 = w, y0 = h, x1 = 0, y1 = 0, pocet = 0;
    while (zas.length) {
      const p = zas.pop(), px = p % w, py = (p - px) / w;
      pocet++; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      if (px > 0 && d[p - 1] && !lab[p - 1]) { lab[p - 1] = id; zas.push(p - 1); }
      if (px < w - 1 && d[p + 1] && !lab[p + 1]) { lab[p + 1] = id; zas.push(p + 1); }
      if (py > 0 && d[p - w] && !lab[p - w]) { lab[p - w] = id; zas.push(p - w); }
      if (py < h - 1 && d[p + w] && !lab[p + w]) { lab[p + w] = id; zas.push(p + w); }
    }
    if (y1 - y0 >= 5 && y1 - y0 <= h * 0.25) komp.push({ x0, y0, x1, y1, pocet });
  }
  // skupiny znaků oddělené mezerou (např. „1AB 2345“) spoj, když leží v řadě a mají podobnou výšku
  komp.sort((a, b) => a.x0 - b.x0);
  for (let zmena = true; zmena;) {
    zmena = false;
    for (let i = 0; i < komp.length; i++) {
      const a = komp[i], ha = a.y1 - a.y0 + 1;
      for (let j = i + 1; j < komp.length; j++) {
        const b = komp[j], hb = b.y1 - b.y0 + 1;
        if (b.x0 - a.x1 > 1.2 * Math.max(ha, hb)) break;
        const prekryv = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1;
        if (prekryv < 0.6 * Math.min(ha, hb) || Math.max(ha, hb) > 1.6 * Math.min(ha, hb) || b.x0 - a.x1 > 0.9 * Math.min(ha, hb)) continue;
        a.x0 = Math.min(a.x0, b.x0); a.x1 = Math.max(a.x1, b.x1); a.y0 = Math.min(a.y0, b.y0); a.y1 = Math.max(a.y1, b.y1); a.pocet += b.pocet;
        komp.splice(j, 1); zmena = true; break;
      }
    }
  }
  for (const { x0, y0, x1, y1, pocet } of komp) {
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, pomer = bw / bh;
    if (bh < 6 || bw < w * 0.03 || bw > w * 0.5 || bh > h * 0.25 || pomer < 2.5 || pomer > 11) continue;
    const vyplneni = pocet / (bw * bh);
    if (vyplneni < 0.4) continue;
    // přechody hran (znaky) ve třech řádcích uprostřed, hustota hran a kontrast
    let prechody = 0;
    for (const fy of [0.35, 0.5, 0.65]) {
      const yy = y0 + Math.round(bh * fy); let pred = 0;
      for (let x = x0; x <= x1; x++) { const v = e[yy * w + x]; if (v && !pred) prechody++; pred = v; }
    }
    prechody /= 3;
    let hrany = 0, mi = 255, ma = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * w + x; hrany += e[i]; if (g[i] < mi) mi = g[i]; if (g[i] > ma) ma = g[i]; }
    const hustota = hrany / (bw * bh);
    if (prechody < 5 || hustota < 0.08 || ma - mi < 80) continue;
    const blizkoPomeru = 1 - Math.min(1, Math.abs(Math.log(pomer / 5.5)) / Math.log(2.5));
    const skore = Math.min(1, prechody / 14) * 0.4 + vyplneni * 0.2 + Math.min(1, hustota * 3) * 0.2 + blizkoPomeru * 0.2;
    // pruh znaků je ~70 % výšky značky → rozšiř nahoru a dolů
    const ky0 = Math.max(0, Math.round(y0 - bh * 0.25)), ky1 = Math.min(h, Math.round(y1 + 1 + bh * 0.25));
    const px = Math.round(bw * 0.06) + 2, kx0 = Math.max(0, x0 - px), kx1 = Math.min(w, x1 + 1 + px);
    kand.push({ x: kx0, y: ky0, w: kx1 - kx0, h: ky1 - ky0, skore: Math.round(skore * 100) / 100 });
  }
  kand.sort((a, b) => b.skore - a.skore);
  const ven = [];
  for (const c of kand) {
    const b = { x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h };
    if (ven.some(v => iou({ x0: v.x, y0: v.y, x1: v.x + v.w, y1: v.y + v.h }, b) > 0.2)) continue;
    ven.push(c); if (ven.length >= max) break;
  }
  return ven;
}

/* ---------- metadata (JPEG / PNG / WebP) ---------- */
const TAGY = {
  0x010E: 'Popis obrázku', 0x010F: 'Výrobce fotoaparátu', 0x0110: 'Model fotoaparátu', 0x0112: 'Orientace', 0x0131: 'Software',
  0x0132: 'Datum změny', 0x013B: 'Autor', 0x8298: 'Copyright', 0x9003: 'Datum pořízení', 0x9004: 'Datum digitalizace',
  0x9010: 'Časové pásmo', 0x9011: 'Časové pásmo pořízení', 0x829A: 'Expoziční čas', 0x829D: 'Clona (F)', 0x8827: 'ISO',
  0x920A: 'Ohnisková vzdálenost', 0xA420: 'Jedinečné ID snímku', 0xA430: 'Majitel fotoaparátu', 0xA431: 'Sériové číslo těla',
  0xA433: 'Výrobce objektivu', 0xA434: 'Objektiv', 0xA435: 'Sériové číslo objektivu', 0x9C9B: 'Název (Windows)',
  0x9C9C: 'Komentář (Windows)', 0x9C9D: 'Autor (Windows)', 0x9286: 'Uživatelský komentář', 0x9C9E: 'Klíčová slova (Windows)',
  0x9C9F: 'Předmět (Windows)', 0x010D: 'Název dokumentu', 0x013C: 'Počítač', 0xA436: 'Název snímku', 0xA437: 'Fotograf', 0xA438: 'Editor',
};
const GPS_TAGY = { 1: 'LatRef', 2: 'Lat', 3: 'LonRef', 4: 'Lon', 5: 'AltRef', 6: 'Alt', 29: 'Datum', 17: 'Směr' };
const CITLIVE = new Set(['Autor', 'Copyright', 'Sériové číslo těla', 'Sériové číslo objektivu', 'Majitel fotoaparátu', 'Jedinečné ID snímku',
  'Popis obrázku', 'Autor (Windows)', 'Komentář (Windows)', 'Uživatelský komentář', 'Datum pořízení', 'Klíčová slova (Windows)',
  'Předmět (Windows)', 'Název dokumentu', 'Počítač', 'Fotograf', 'Editor', 'Název snímku']);

function parsujTiff(v, start, konec) {
  const little = v.getUint16(start) === 0x4949;
  const u16 = o => v.getUint16(o, little), u32 = o => v.getUint32(o, little);
  const polozky = {}, gps = {}, ifd1 = {};
  const VEL = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const ctiIfd = (off, cil, mapa, hloubka) => {
    if (hloubka > 3 || off < start || off + 2 > konec) return;
    const n = u16(off);
    for (let i = 0; i < n && off + 2 + i * 12 + 12 <= konec; i++) {
      const e = off + 2 + i * 12, tag = u16(e), typ = u16(e + 2), cnt = u32(e + 4);
      const bajtu = (VEL[typ] || 1) * cnt;
      const ho = bajtu > 4 ? start + u32(e + 8) : e + 8;
      if (ho + bajtu > konec || cnt > 1e5) continue;
      if (tag === 0x8769 || tag === 0x8825) { ctiIfd(start + u32(e + 8), tag === 0x8825 ? gps : polozky, tag === 0x8825 ? GPS_TAGY : TAGY, hloubka + 1); continue; }
      if (mapa === TAGY && tag === 0x927C) { polozky.MakerNote = bajtu; continue; }
      if (cil === ifd1) { if (tag === 0x0201 || tag === 0x0202) ifd1[tag] = typ === 3 ? u16(ho) : u32(ho); continue; }
      const nazev = mapa[tag];
      if (!nazev) continue;
      let h;
      if (typ === 2) { // ASCII – v praxi často UTF-8, jinak Latin-1
        const b = []; for (let j = 0; j < cnt; j++) { const c = v.getUint8(ho + j); if (!c) break; b.push(c); }
        try { h = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(b)).trim(); } catch (e) { h = String.fromCharCode(...b).trim(); }
      }
      else if (typ === 1 && tag >= 0x9C9B && tag <= 0x9C9F) { // UCS-2 (Windows XP tagy)
        let s = ''; for (let j = 0; j + 1 < cnt; j += 2) { const c = v.getUint16(ho + j, true); if (!c) break; s += String.fromCharCode(c); } h = s.trim();
      } else if (typ === 7) { let s = ''; for (let j = 8; j < cnt; j++) { const c = v.getUint8(ho + j); if (c >= 32 && c < 127) s += String.fromCharCode(c); } h = s.trim(); }
      else if (typ === 3) h = cnt === 1 ? u16(ho) : Array.from({ length: Math.min(cnt, 8) }, (_, j) => u16(ho + j * 2));
      else if (typ === 4) h = u32(ho);
      else if (typ === 5 || typ === 10) {
        const arr = [];
        for (let j = 0; j < Math.min(cnt, 8); j++) {
          const a = typ === 5 ? u32(ho + j * 8) : v.getInt32(ho + j * 8, little), b = typ === 5 ? u32(ho + j * 8 + 4) : v.getInt32(ho + j * 8 + 4, little);
          arr.push(b ? a / b : 0);
        }
        h = cnt === 1 ? arr[0] : arr;
      } else continue;
      if (h === '' || h === undefined) continue;
      cil[nazev] = h;
    }
  };
  if (start + 8 > konec) return { polozky, gps: null };
  const off0 = start + u32(start + 4);
  ctiIfd(off0, polozky, TAGY, 0);
  // IFD1 = miniatura (náhled JPEG uvnitř EXIF) – často zůstane NEUPRAVENÁ i po oříznutí/zakrytí v editoru
  let miniatura = null;
  if (off0 + 2 <= konec) {
    const dalsi = off0 + 2 + u16(off0) * 12;
    if (dalsi + 4 <= konec && u32(dalsi)) {
      ctiIfd(start + u32(dalsi), ifd1, {}, 0);
      const mo = start + (ifd1[0x0201] || 0), ml = ifd1[0x0202] || 0;
      if (ifd1[0x0201] && ml > 0 && mo + ml <= konec) miniatura = { od: mo, delka: ml };
    }
  }
  let poloha = null;
  if (Array.isArray(gps.Lat) && Array.isArray(gps.Lon)) {
    const dms = a => a[0] + (a[1] || 0) / 60 + (a[2] || 0) / 3600;
    const lat = dms(gps.Lat) * (gps.LatRef === 'S' ? -1 : 1), lon = dms(gps.Lon) * (gps.LonRef === 'W' ? -1 : 1);
    if (isFinite(lat) && isFinite(lon) && (lat || lon)) {
      poloha = { lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
      if (typeof gps.Alt === 'number') poloha.alt = Math.round(gps.Alt * (gps.AltRef === 1 ? -1 : 1));
    }
  }
  if (typeof gps.Směr === 'number' && poloha) poloha.smer = Math.round(gps.Směr);
  return { polozky, gps: poloha, miniatura };
}
const ascii = (v, o, n) => { let s = ''; for (let i = 0; i < n && o + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(o + i)); return s; };

/**
 * Najde metadata v souboru (ArrayBuffer). Vrátí { format, bloky: ['EXIF', 'XMP', …], polozky: [[název, hodnota, citlivé]], gps }.
 * Při exportu přes plátno se zahodí všechny – tohle slouží jen k ukázání, co soubor obsahoval.
 */
function ctiMetadata(buf) {
  const v = new DataView(buf), L = v.byteLength, bloky = [], vys = { format: '?', bloky, polozky: [], gps: null, miniatura: null, orientace: 1, konecDat: L };
  const xmp = [], iptc = [];
  const pridejTiff = (start, konec) => {
    try {
      const t = parsujTiff(v, start, konec); Object.assign(vys._p || (vys._p = {}), t.polozky); if (t.gps) vys.gps = t.gps;
      if (t.miniatura && !vys.miniatura) vys.miniatura = new Uint8Array(buf.slice(t.miniatura.od, t.miniatura.od + t.miniatura.delka));
    }
    catch (e) { /* poškozený blok – stačí vědět, že tam byl */ }
  };
  try {
    if (L > 4 && v.getUint16(0) === 0xFFD8) {
      vys.format = 'JPEG';
      let o = 2;
      while (o + 4 <= L && v.getUint8(o) === 0xFF) {
        const m = v.getUint8(o + 1);
        if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { o += 2; continue; }
        if (m === 0xD9) break;
        if (m === 0xDA) { // obrazová data: najdi konec (FFD9) – za ním bývá skrytý obsah (pohyblivá fotka, další snímky)
          const k = konecJpeg(v, o);
          if (k > 0) { vys.konecDat = k; if (L - k > 16) bloky.push('Data za koncem obrázku (' + Math.round((L - k) / 1024) + ' kB)'); }
          break;
        }
        const len = v.getUint16(o + 2), d = o + 4;
        if (m === 0xE1 && ascii(v, d, 4) === 'Exif') { bloky.push('EXIF'); pridejTiff(d + 6, Math.min(L, o + 2 + len)); }
        else if (m === 0xE1 && ascii(v, d, 29) === 'http://ns.adobe.com/xap/1.0/\0') { bloky.push('XMP'); xmp.push(utf8(new Uint8Array(buf, d + 29, Math.max(0, Math.min(L, o + 2 + len) - d - 29)))); }
        else if (m === 0xE1 && ascii(v, d, 28).startsWith('http://ns.adobe.com/xmp/exte')) { if (!bloky.includes('XMP (rozšířené)')) bloky.push('XMP (rozšířené)'); }
        else if (m === 0xED) { bloky.push('IPTC / Photoshop'); iptc.push(...ctiPhotoshop(v, d, Math.min(L, o + 2 + len))); }
        else if (m === 0xE2 && ascii(v, d, 4) === 'MPF\0') bloky.push('MPF (více snímků v souboru)');
        else if (m === 0xE2 && ascii(v, d, 11) === 'ICC_PROFILE') { if (!bloky.includes('Barevný profil ICC')) bloky.push('Barevný profil ICC'); }
        else if (m === 0xFE) bloky.push('Komentář');
        else if (m >= 0xE3 && m <= 0xEF) bloky.push('APP' + (m - 0xE0) + ' (' + ascii(v, d, 8).replace(/[^\x20-\x7e]/g, '').trim() + ')');
        o += 2 + len;
      }
    } else if (L > 8 && v.getUint32(0) === 0x89504E47) {
      vys.format = 'PNG';
      let o = 8;
      while (o + 8 <= L) {
        const len = v.getUint32(o), typ = ascii(v, o + 4, 4), d = o + 8;
        if (typ === 'eXIf') { bloky.push('EXIF'); pridejTiff(d, Math.min(L, d + len)); }
        else if (typ === 'tEXt' || typ === 'iTXt' || typ === 'zTXt') {
          const kl = ascii(v, d, Math.min(len, 79)).split('\0')[0];
          bloky.push(kl === 'XML:com.adobe.xmp' ? 'XMP' : 'Text: ' + kl);
          if (kl === 'XML:com.adobe.xmp' && typ === 'iTXt' && v.getUint8(d + kl.length + 1) === 0) { // nekomprimovaný iTXt
            let t = d + kl.length + 3; for (let z = 0; z < 2; z++) { while (t < d + len && v.getUint8(t)) t++; t++; }
            if (t < d + len) xmp.push(utf8(new Uint8Array(buf, t, d + len - t)));
          }
        } else if (typ === 'iCCP') bloky.push('Barevný profil ICC');
        else if (typ === 'tIME') bloky.push('Čas změny');
        if (typ === 'IEND') break;
        o += 12 + len;
      }
    } else if (L > 12 && ascii(v, 0, 4) === 'RIFF' && ascii(v, 8, 4) === 'WEBP') {
      vys.format = 'WebP';
      let o = 12;
      while (o + 8 <= L) {
        const typ = ascii(v, o, 4), len = v.getUint32(o + 4, true), d = o + 8;
        if (typ === 'EXIF') { bloky.push('EXIF'); const s = ascii(v, d, 6) === 'Exif\0\0' ? d + 6 : d; pridejTiff(s, Math.min(L, d + len)); }
        else if (typ === 'XMP ') { bloky.push('XMP'); xmp.push(utf8(new Uint8Array(buf, d, Math.min(len, L - d)))); }
        else if (typ === 'ICCP') bloky.push('Barevný profil ICC');
        o += 8 + len + (len & 1);
      }
    }
  } catch (e) { /* zkrácený soubor */ }
  const p = vys._p || {}; delete vys._p;
  if (typeof p.Orientace === 'number') vys.orientace = p.Orientace;
  if (p.MakerNote) { bloky.push('MakerNote (data výrobce, ' + Math.round(p.MakerNote / 1024) + ' kB)'); delete p.MakerNote; }
  if (vys.miniatura) bloky.push('Miniatura v EXIF (' + Math.max(1, Math.round(vys.miniatura.length / 1024)) + ' kB)');
  for (const k of Object.keys(p)) vys.polozky.push([k, formatHodnoty(k, p[k]), CITLIVE.has(k)]);
  for (const t of xmp) for (const [k, h] of ctiXmp(t)) { vys.polozky.push(['XMP: ' + k, h, true]); if (!vys.gps && /GPS/.test(k)) vys._xg = 1; }
  for (const [k, h] of iptc) vys.polozky.push(['IPTC: ' + k, h, true]);
  if (!vys.gps) { // poloha jen v XMP
    const g = n => (vys.polozky.find(q => q[0] === 'XMP: ' + n) || [])[1];
    const lat = xmpSouradnice(g('GPS šířka')), lon = xmpSouradnice(g('GPS délka'));
    if (lat !== null && lon !== null) vys.gps = { lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
  }
  delete vys._xg;
  if (vys.gps) vys.polozky.unshift(['GPS poloha', vys.gps.lat + ', ' + vys.gps.lon + (vys.gps.alt !== undefined ? ' (' + vys.gps.alt + ' m n. m.)' : ''), true]);
  return vys;
}
function utf8(b) { try { return new TextDecoder('utf-8').decode(b); } catch (e) { return ''; } }
/** Najde konec entropických dat JPEG (marker FFD9) od segmentu SOS na pozici o. Vrátí index za FFD9 nebo −1. */
function konecJpeg(v, o) {
  const L = v.byteLength;
  for (let i = o + 2 + v.getUint16(o + 2); i + 1 < L; i++) {
    if (v.getUint8(i) !== 0xFF) continue;
    const m = v.getUint8(i + 1);
    if (m === 0xD9) return i + 2;
    if (m === 0x00 || m === 0xFF || (m >= 0xD0 && m <= 0xD7)) { if (m !== 0xFF) i++; continue; }
    // další segment (progresivní JPEG má víc SOS / DHT) – přeskoč jeho délku
    if (i + 3 < L) i += 1 + v.getUint16(i + 2);
  }
  return -1;
}
const XMP_POLE = [
  ['dc:creator', 'Autor'], ['dc:rights', 'Práva'], ['dc:description', 'Popis'], ['dc:title', 'Název'], ['dc:subject', 'Klíčová slova'],
  ['photoshop:City', 'Město'], ['photoshop:State', 'Kraj'], ['photoshop:Country', 'Země'], ['Iptc4xmpCore:Location', 'Místo'],
  ['photoshop:Credit', 'Kredit'], ['photoshop:AuthorsPosition', 'Pozice autora'], ['xmp:CreatorTool', 'Program'], ['xmp:CreateDate', 'Datum vytvoření'],
  ['exif:GPSLatitude', 'GPS šířka'], ['exif:GPSLongitude', 'GPS délka'], ['xmpMM:DocumentID', 'ID dokumentu'],
  ['xmpMM:OriginalDocumentID', 'ID původního dokumentu'], ['Iptc4xmpCore:CreatorContactInfo', 'Kontakt autora'], ['aux:SerialNumber', 'Sériové číslo těla'],
  ['exifEX:BodySerialNumber', 'Sériové číslo těla'], ['photoshop:Instructions', 'Pokyny'],
];
/** Vybraná pole z XMP (atributy i prvky, včetně rdf:Seq/Alt/Bag). Vrátí [[název, hodnota]]. Historie úprav → počet kroků. */
function ctiXmp(t) {
  const ven = [], vid = new Set();
  const cist = s => s.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  for (const [tag, nazev] of XMP_POLE) {
    const e = tag.replace(':', '\\:');
    let m = t.match(new RegExp('[\\s<]' + e + '="([^"]*)"')) || t.match(new RegExp('<' + e + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + e + '>'));
    if (!m) continue;
    let h = cist(m[1]);
    if (tag === 'Iptc4xmpCore:CreatorContactInfo' && !h) { // kontakt bývá v atributech
      const a = (t.match(/<Iptc4xmpCore:CreatorContactInfo([^>]*)>/) || [])[1] || '';
      h = [...a.matchAll(/Iptc4xmpCore:Ci\w+="([^"]*)"/g)].map(x => x[1]).join(', ');
    }
    if (!h || vid.has(nazev + h)) continue;
    vid.add(nazev + h); ven.push([nazev, h.length > 200 ? h.slice(0, 200) + '…' : h]);
  }
  const hist = (t.match(/stEvt:action/g) || []).length;
  if (hist) ven.push(['Historie úprav', hist + ' kroků' + ((t.match(/stEvt:softwareAgent="([^"]*)"/) || [])[1] ? ' (' + t.match(/stEvt:softwareAgent="([^"]*)"/)[1] + ')' : '')]);
  return ven;
}
/** XMP souřadnice „50,5.25N“ nebo „50,5,15N“ → stupně. */
function xmpSouradnice(s) {
  const m = /^(\d+),(\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?))?([NSEW])$/.exec(String(s || '').trim());
  if (!m) return null;
  const st = +m[1] + m[2] / 60 + (m[3] ? m[3] / 3600 : 0);
  return m[4] === 'S' || m[4] === 'W' ? -st : st;
}
const IPTC_POLE = { 5: 'Název', 25: 'Klíčové slovo', 40: 'Pokyny', 55: 'Datum vytvoření', 80: 'Autor', 85: 'Pozice autora', 90: 'Město',
  92: 'Část obce', 95: 'Kraj', 101: 'Země', 103: 'Číslo zakázky', 105: 'Titulek', 110: 'Kredit', 115: 'Zdroj', 116: 'Copyright',
  118: 'Kontakt', 120: 'Popis', 122: 'Autor popisu' };
/** Photoshop APP13: bloky 8BIM, z nich 0x0404 = IPTC IIM. Vrátí [[název, hodnota]]. */
function ctiPhotoshop(v, d, konec) {
  const ven = [];
  if (ascii(v, d, 14) !== 'Photoshop 3.0\0') return ven;
  let o = d + 14;
  while (o + 12 <= konec && ascii(v, o, 4) === '8BIM') {
    const id = v.getUint16(o + 4), nl = v.getUint8(o + 6);
    let p = o + 6 + 1 + nl; if ((1 + nl) & 1) p++;
    const vel = v.getUint32(p); p += 4;
    if (id === 0x0404) {
      for (let i = p; i + 5 <= Math.min(p + vel, konec);) {
        if (v.getUint8(i) !== 0x1C) break;
        const rec = v.getUint8(i + 1), ds = v.getUint8(i + 2), n = v.getUint16(i + 3);
        if (rec === 2 && IPTC_POLE[ds] && i + 5 + n <= konec) {
          const b = new Uint8Array(v.buffer, v.byteOffset + i + 5, n);
          let h; try { h = new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { h = String.fromCharCode(...b); }
          if (h.trim()) ven.push([IPTC_POLE[ds], h.trim()]);
        }
        i += 5 + n;
      }
    }
    o = p + vel + (vel & 1);
  }
  return ven;
}
function formatHodnoty(k, h) {
  if (k === 'Expoziční čas' && h > 0 && h < 1) return '1/' + Math.round(1 / h) + ' s';
  if (k === 'Clona (F)') return 'f/' + (+h).toFixed(1);
  if (k === 'Ohnisková vzdálenost') return Math.round(h) + ' mm';
  if (k === 'Orientace') return ({ 1: 'normální', 3: '180°', 6: '90° po směru', 8: '90° proti směru' })[h] || String(h);
  if (Array.isArray(h)) return h.map(x => Math.round(x * 100) / 100).join(', ');
  return String(h);
}

/* ---------- export: názvy a ZIP (bez komprese) ---------- */
const PRIPONY = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
function nazevVystupu(puvodni, typ, pripona = '_anonym') {
  const zaklad = String(puvodni || 'foto').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_') || 'foto';
  return zaklad + pripona + '.' + (PRIPONY[typ] || 'jpg');
}
function unikatniNazvy(nazvy) {
  const pouzite = new Set();
  return nazvy.map(n => {
    let k = n, i = 2;
    while (pouzite.has(k.toLowerCase())) k = n.replace(/(\.[^.]+)?$/, m => '_' + (i++) + m);
    pouzite.add(k.toLowerCase()); return k;
  });
}
let CRC_TAB = null;
function crc32(data) {
  if (!CRC_TAB) {
    CRC_TAB = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_TAB[n] = c >>> 0; }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) c = CRC_TAB[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
/** ZIP (metoda „uloženo“ – JPG/PNG/WebP už jsou komprimované). soubory = [{ nazev, data: Uint8Array }]. */
function zip(soubory, datum = new Date()) {
  const enc = new TextEncoder();
  const cas = (datum.getHours() << 11) | (datum.getMinutes() << 5) | (datum.getSeconds() >> 1);
  const den = ((Math.max(1980, datum.getFullYear()) - 1980) << 9) | ((datum.getMonth() + 1) << 5) | datum.getDate();
  const casti = [], centralni = [];
  let off = 0;
  for (const s of soubory) {
    const jm = enc.encode(s.nazev), crc = crc32(s.data), n = s.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, cas, true); lh.setUint16(12, den, true); lh.setUint32(14, crc, true); lh.setUint32(18, n, true); lh.setUint32(22, n, true);
    lh.setUint16(26, jm.length, true); lh.setUint16(28, 0, true);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, cas, true); ch.setUint16(14, den, true); ch.setUint32(16, crc, true); ch.setUint32(20, n, true); ch.setUint32(24, n, true);
    ch.setUint16(28, jm.length, true); ch.setUint32(42, off, true);
    casti.push(new Uint8Array(lh.buffer), jm, s.data);
    centralni.push(new Uint8Array(ch.buffer), jm);
    off += 30 + jm.length + n;
  }
  const velC = centralni.reduce((a, b) => a + b.length, 0);
  const konec = new DataView(new ArrayBuffer(22));
  konec.setUint32(0, 0x06054b50, true); konec.setUint16(8, soubory.length, true); konec.setUint16(10, soubory.length, true);
  konec.setUint32(12, velC, true); konec.setUint32(16, off, true);
  const vse = [...casti, ...centralni, new Uint8Array(konec.buffer)];
  const ven = new Uint8Array(vse.reduce((a, b) => a + b.length, 0));
  let o = 0; for (const c of vse) { ven.set(c, o); o += c.length; }
  return ven;
}

/* ---------- bezeztrátové odstranění metadat (bez překódování) ---------- */
/**
 * JPEG: ponechá jen to, co je potřeba k dekódování (DQT, SOF, DHT, DRI, SOS + data), APP0 JFIF, APP14 Adobe
 * (barevná transformace) a volitelně APP2 ICC. Zahodí EXIF, XMP, IPTC, MPF, komentáře a vše za koncem obrázku.
 * Vrátí Uint8Array nebo null (není JPEG / poškozený).
 */
function ocistiJpeg(buf, { icc = false } = {}) {
  const v = new DataView(buf), L = v.byteLength, kusy = [new Uint8Array([0xFF, 0xD8])];
  if (L < 4 || v.getUint16(0) !== 0xFFD8) return null;
  let o = 2;
  while (o + 4 <= L) {
    if (v.getUint8(o) !== 0xFF) return null;
    const m = v.getUint8(o + 1);
    if (m === 0xFF) { o++; continue; }
    if (m === 0xDA) {
      const k = konecJpeg(v, o);
      if (k < 0) return null;
      kusy.push(new Uint8Array(buf, o, k - o)); break;
    }
    const len = v.getUint16(o + 2), d = o + 4;
    if (o + 2 + len > L) return null;
    const app = m >= 0xE0 && m <= 0xEF;
    const nechat = !app && m !== 0xFE ||
      (m === 0xE0 && ascii(v, d, 5) === 'JFIF\0') || (m === 0xEE && ascii(v, d, 5) === 'Adobe') ||
      (icc && m === 0xE2 && ascii(v, d, 12) === 'ICC_PROFILE\0');
    if (nechat) kusy.push(new Uint8Array(buf, o, 2 + len));
    o += 2 + len;
  }
  const ven = new Uint8Array(kusy.reduce((a, b) => a + b.length, 0));
  let i = 0; for (const k of kusy) { ven.set(k, i); i += k.length; }
  return ven;
}
const PNG_NECHAT = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'sBIT', 'acTL', 'fcTL', 'fdAT', 'cICP']);
/** PNG: ponechá bloky potřebné k zobrazení (+ volitelně iCCP), zahodí text, EXIF, čas a neznámé. */
function ocistiPng(buf, { icc = false } = {}) {
  const v = new DataView(buf), L = v.byteLength;
  if (L < 8 || v.getUint32(0) !== 0x89504E47) return null;
  const kusy = [new Uint8Array(buf, 0, 8)];
  let o = 8, konec = false;
  while (o + 12 <= L) {
    const len = v.getUint32(o), typ = ascii(v, o + 4, 4);
    if (o + 12 + len > L) return null;
    if (PNG_NECHAT.has(typ) || (icc && typ === 'iCCP')) kusy.push(new Uint8Array(buf, o, 12 + len));
    o += 12 + len;
    if (typ === 'IEND') { konec = true; break; }
  }
  if (!konec) return null;
  const ven = new Uint8Array(kusy.reduce((a, b) => a + b.length, 0));
  let i = 0; for (const k of kusy) { ven.set(k, i); i += k.length; }
  return ven;
}

/* ---------- historie Zpět / Znovu ---------- */
function novaHistorie() { return { zpet: [], znovu: [] }; }
function hZapamatuj(h, stav, max = 100) { h.zpet.push(stav); if (h.zpet.length > max) h.zpet.shift(); h.znovu.length = 0; }
function hZpet(h, akt) { if (!h.zpet.length) return null; h.znovu.push(akt); return h.zpet.pop(); }
function hZnovu(h, akt) { if (!h.znovu.length) return null; h.zpet.push(akt); return h.znovu.pop(); }

/* ---------- šablony nastavení ---------- */
const NAST_POVOLENE = {
  efekt: v => EFEKTY.includes(v), sila: v => Number.isFinite(+v) && +v >= 0 && +v <= 100, emoji: v => typeof v === 'string' && v.length <= 8,
  barva: jeBarva, tvar: v => ['elipsa', 'obdelnik'].includes(v), format: v => ['orig', 'image/jpeg', 'image/webp', 'image/png'].includes(v),
  kvalita: v => ['1', '0.95', '0.9', '0.85', '0.75'].includes(String(v)), maxStrana: v => ['0', '4096', '2560', '2048', '1600', '1080'].includes(String(v)),
  pripona: v => typeof v === 'string' && v.length <= 30 && !/[\\/:*?"<>|]/.test(v), citlivost: v => +v >= 0.3 && +v <= 0.95,
  navrhyObliceju: v => typeof v === 'boolean', bezeztrat: v => typeof v === 'boolean', protokol: v => typeof v === 'boolean',
  icc: v => typeof v === 'boolean', spzEfekt: v => EFEKTY.includes(v),
};
/** Ze šablony/importu vezme jen známé klíče s platnou hodnotou. */
function cistaNastaveni(p) {
  const ven = {};
  for (const k of Object.keys(NAST_POVOLENE)) if (p && p[k] !== undefined && NAST_POVOLENE[k](p[k])) ven[k] = k === 'sila' ? +p[k] : k === 'citlivost' ? String(+p[k]) : p[k];
  return ven;
}
const SABLONY = [
  { id: 'novinar', nazev: '📰 Novinář – zpravodajská fotka', popis: 'Obličeje i SPZ pixelizací (velké bloky), JPG 90 %, max. 2560 px, protokol.',
    nast: { efekt: 'pixely', sila: 70, tvar: 'elipsa', format: 'image/jpeg', kvalita: '0.9', maxStrana: '2560', pripona: '_anonym', citlivost: '0.6', navrhyObliceju: true, spzEfekt: 'pixely', protokol: true } },
  { id: 'gdpr', nazev: '🏛️ GDPR / úřad – nevratné začernění', popis: 'Plná černá, obdélníky, PNG bez ztrát, protokol pro spis, nálezy k potvrzení.',
    nast: { efekt: 'cerna', barva: '#000000', tvar: 'obdelnik', format: 'image/png', maxStrana: '0', pripona: '_anonym', citlivost: '0.5', navrhyObliceju: true, spzEfekt: 'cerna', protokol: true } },
  { id: 'realitka', nazev: '🏠 Realitní inzerát', popis: 'Silné rozmazání (vzhledné), SPZ pixely, JPG 85 % max. 2048 px, stejné názvy souborů.',
    nast: { efekt: 'rozmazat', sila: 80, tvar: 'elipsa', format: 'image/jpeg', kvalita: '0.85', maxStrana: '2048', pripona: '', citlivost: '0.65', navrhyObliceju: false, spzEfekt: 'pixely', protokol: false } },
  { id: 'site', nazev: '📱 Sociální sítě', popis: 'Emoji přes obličeje, JPG 90 %, max. 1080 px.',
    nast: { efekt: 'emoji', emoji: '😎', tvar: 'elipsa', format: 'image/jpeg', kvalita: '0.9', maxStrana: '1080', pripona: '_anonym', citlivost: '0.65', navrhyObliceju: false, spzEfekt: 'pixely' } },
  { id: 'metadata', nazev: '🧾 Jen metadata, bez překódování', popis: 'Formát jako originál, JPG/PNG bez úprav se jen bezeztrátově očistí.',
    nast: { format: 'orig', kvalita: '0.95', maxStrana: '0', pripona: '', bezeztrat: true, protokol: true } },
];

/* ---------- export / import oblastí ---------- */
const POLE_OBLASTI = ['tvar', 'x', 'y', 'w', 'h', 'efekt', 'sila', 'emoji', 'barva', 'zdroj', 'skore', 'navrh', 'vypnuta', 'body', 'r'];
function exportOblasti(fotky) {
  return { typ: 'anonymizace-oblasti', verze: 1, vytvoreno: new Date().toISOString(),
    fotky: fotky.map(f => ({ nazev: f.nazev, W: f.W, H: f.H, zkontrolovano: !!f.zkontrolovano,
      oblasti: f.oblasti.map(o => Object.fromEntries(POLE_OBLASTI.filter(k => o[k] !== undefined).map(k => [k, o[k]]))) })) };
}
/** Přiřadí oblasti podle názvu souboru; při jiném rozlišení přepočte měřítko. Vrátí { fotek, oblasti, nenalezene: [názvy] }. */
function importOblasti(data, fotky, pridat = false) {
  if (!data || data.typ !== 'anonymizace-oblasti' || !Array.isArray(data.fotky)) throw new Error('Soubor není export oblastí z Anonymizace.');
  const vys = { fotek: 0, oblasti: 0, nenalezene: [] };
  for (const z of data.fotky) {
    const f = fotky.find(q => q.nazev === z.nazev);
    if (!f) { vys.nenalezene.push(z.nazev); continue; }
    const kx = z.W ? f.W / z.W : 1, ky = z.H ? f.H / z.H : 1;
    const nove = (z.oblasti || []).map(o => {
      const n = novaOblast({ ...o, id: undefined });
      if (kx !== 1 || ky !== 1) {
        nastavObdelnik(n, { x: n.x * kx, y: n.y * ky, w: n.w * kx, h: n.h * ky });
      }
      return n;
    });
    f.oblasti = pridat ? f.oblasti.concat(nove) : nove;
    if (z.zkontrolovano) f.zkontrolovano = true;
    vys.fotek++; vys.oblasti += nove.length;
  }
  return vys;
}

/* ---------- protokol anonymizace ---------- */
const POPIS_EFEKTU = { rozmazat: 'rozmazání', pixely: 'pixelizace', cerna: 'plná barva', emoji: 'emoji', zrneni: 'zrnění' };
/**
 * zaznamy = [{ nazev, vystup, meta, W, H, oblasti, overeni, bezeztrat, zkontrolovano }] → text protokolu (pro spis / redakci).
 */
function protokolText(zaznamy, datum = new Date()) {
  const r = ['PROTOKOL ANONYMIZACE', 'Vytvořeno: ' + datum.toLocaleString('cs-CZ'), 'Nástroj: Anonymizace fotek (zpracování lokálně v prohlížeči)', 'Souborů: ' + zaznamy.length, ''];
  zaznamy.forEach((z, i) => {
    const akt = z.oblasti.filter(aktivni), poc = {};
    for (const o of akt) { const k = (o.zdroj === 'oblicej' ? 'obličej' : o.zdroj === 'spz' ? 'SPZ' : 'ruční') + ' – ' + POPIS_EFEKTU[o.efekt]; poc[k] = (poc[k] || 0) + 1; }
    const slabe = akt.filter(o => hodnoceni(o).uroven === 'slabe').length;
    r.push(`${i + 1}. ${z.nazev}  →  ${z.vystup}`);
    r.push(`   Původní formát: ${z.meta.format}, ${z.W}×${z.H} px${z.zkontrolovano ? ', zkontrolováno člověkem' : ', NEOZNAČENO jako zkontrolované'}`);
    r.push('   Upravené oblasti: ' + (akt.length ? akt.length + ' (' + Object.entries(poc).map(([k, n]) => n + '× ' + k).join(', ') + ')' : 'žádné'));
    if (slabe) r.push(`   POZOR: ${slabe} oblast(í) se slabým efektem – detail může zůstat rozpoznatelný.`);
    const nep = z.oblasti.filter(o => o.navrh).length, vyp = z.oblasti.filter(o => o.vypnuta).length;
    if (nep || vyp) r.push(`   Neuplatněno: ${nep} nepotvrzených návrhů, ${vyp} vypnutých oblastí.`);
    r.push('   Odstraněné bloky metadat: ' + (z.meta.bloky.length ? z.meta.bloky.join(', ') : 'žádné nebyly'));
    if (z.meta.gps) r.push(`   Odstraněná GPS poloha: ${z.meta.gps.lat}, ${z.meta.gps.lon}`);
    const cit = z.meta.polozky.filter(p => p[2] && p[0] !== 'GPS poloha');
    if (cit.length) r.push('   Odstraněné citlivé údaje: ' + cit.map(p => p[0] + ' = ' + p[1]).join('; '));
    r.push('   Způsob uložení: ' + (z.bezeztrat ? 'bezeztrátové odstranění metadat (obraz nepřekódován)' : 'překresleno přes plátno a znovu zakódováno'));
    if (z.overeni) r.push('   Kontrola výsledku: ' + z.overeni);
    r.push('');
  });
  return r.join('\n');
}
const csvBunka = v => { const t = String(v === undefined || v === null ? '' : v); return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
function protokolCsv(zaznamy) {
  const r = [['soubor', 'vystup', 'format', 'sirka', 'vyska', 'oblasti', 'obliceje', 'spz', 'rucni', 'slabe', 'navrhy_neuplatnene', 'gps', 'bloky_metadat', 'zkontrolovano', 'bezeztratove', 'overeni']];
  for (const z of zaznamy) {
    const akt = z.oblasti.filter(aktivni), n = zd => akt.filter(o => o.zdroj === zd).length;
    r.push([z.nazev, z.vystup, z.meta.format, z.W, z.H, akt.length, n('oblicej'), n('spz'), n('rucni'), akt.filter(o => hodnoceni(o).uroven === 'slabe').length,
      z.oblasti.filter(o => o.navrh).length, z.meta.gps ? z.meta.gps.lat + ' ' + z.meta.gps.lon : '', z.meta.bloky.join(' | '), z.zkontrolovano ? 'ano' : 'ne', z.bezeztrat ? 'ano' : 'ne', z.overeni || '']);
  }
  return '\ufeff' + r.map(x => x.map(csvBunka).join(';')).join('\r\n');
}

/* ---------- video: klíčové snímky, interpolace, sledování ---------- */
/**
 * Stopa = { id, tvar, efekt, sila, emoji, barva, zdroj, od, do, klice: [{ t, x, y, w, h }] } (čas v sekundách).
 * Mezi klíči lineárně, před prvním / za posledním drží polohu; mimo [od, do] neplatí.
 */
function oblastVCase(st, t) {
  const k = st.klice;
  if (!k || !k.length || t < st.od - 1e-6 || t > st.do + 1e-6) return null;
  let r;
  if (t <= k[0].t) r = k[0];
  else if (t >= k[k.length - 1].t) r = k[k.length - 1];
  else {
    let i = 1; while (k[i].t < t) i++;
    const a = k[i - 1], b = k[i], u = (t - a.t) / (b.t - a.t || 1);
    r = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, w: a.w + (b.w - a.w) * u, h: a.h + (b.h - a.h) * u };
  }
  return novaOblast({ id: st.id, tvar: st.tvar, efekt: st.efekt, sila: st.sila, emoji: st.emoji, barva: st.barva, zdroj: st.zdroj, x: r.x, y: r.y, w: r.w, h: r.h });
}
/** Vloží / přepíše klíč v čase t (seřazeně) a rozšíří rozsah stopy. */
function nastavKlic(st, t, r) {
  const k = { t, x: r.x, y: r.y, w: r.w, h: r.h }, i = st.klice.findIndex(q => Math.abs(q.t - t) < 1e-3);
  if (i >= 0) st.klice[i] = k; else { st.klice.push(k); st.klice.sort((a, b) => a.t - b.t); }
  st.od = Math.min(st.od, t); st.do = Math.max(st.do, t);
  return st;
}
/**
 * Spojí detekce z jednotlivých časů do stop (chamtivé párování podle IoU s posledním boxem stopy).
 * snimky = [{ t, boxy: [{x0,y0,x1,y1,skore}] }] seřazené podle t. Stopa, která chybí déle než maxMezera s, končí.
 * Krátké stopy (méně než minDetekci) se zahodí jako šum. Konec stopy se prodlouží o půl kroku (obličej mezi vzorky).
 */
function sledujDetekce(snimky, { prahIou = 0.25, maxMezera = 1, minDetekci = 2, krok = 0 } = {}) {
  const aktivni = [], hotove = [];
  for (const s of snimky) {
    for (let i = aktivni.length - 1; i >= 0; i--) if (s.t - aktivni[i].posl.t > maxMezera) hotove.push(aktivni.splice(i, 1)[0]);
    const pary = [];
    s.boxy.forEach((b, bi) => aktivni.forEach((st, si) => { const q = iou(st.posl.b, b); if (q >= prahIou) pary.push([q, bi, si]); }));
    pary.sort((a, b) => b[0] - a[0]);
    const pouzB = new Set(), pouzS = new Set();
    for (const [, bi, si] of pary) {
      if (pouzB.has(bi) || pouzS.has(si)) continue;
      pouzB.add(bi); pouzS.add(si);
      aktivni[si].body.push({ t: s.t, b: s.boxy[bi] }); aktivni[si].posl = { t: s.t, b: s.boxy[bi] };
    }
    s.boxy.forEach((b, bi) => { if (!pouzB.has(bi)) aktivni.push({ body: [{ t: s.t, b }], posl: { t: s.t, b } }); });
  }
  return hotove.concat(aktivni).filter(st => st.body.length >= minDetekci).map(st => ({
    od: Math.max(0, st.body[0].t - krok / 2), do: st.body[st.body.length - 1].t + krok / 2,
    klice: st.body.map(({ t, b }) => ({ t, x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 })),
    skore: Math.max(...st.body.map(q => q.b.skore || 0)),
  })).sort((a, b) => a.od - b.od);
}

const API = {
  EFEKTY, TVARY, UCHYTY, UF_W, UF_H, PRUCHODY, MEZ_DETAILU, SABLONY,
  novaOblast, prepocitejStetec, normObdelnik, nastavObdelnik, posun, obsahuje, vPolygonu, najdiOblast, uchyty, najdiUchyt, tahUchytem,
  maska, boxyProGauss, rozmazVyrez, sigmaZeSily, blokZeSily, hodnoceni, nahoda, aplikujOblast, vykresli, aktivni,
  ocistiJpeg, ocistiPng, ctiXmp, ctiPhotoshop, xmpSouradnice, novaHistorie, hZapamatuj, hZpet, hZnovu, cistaNastaveni,
  exportOblasti, importOblasti, protokolText, protokolCsv, oblastVCase, nastavKlic, sledujDetekce,
  vyrezNa, tenzorUltraFace, dekodujUltraFace, iou, nms, planDlazdic, naObraz, slucDetekce, oblastZObliceje,
  sedotisk, hledejSpz, ctiMetadata, nazevVystupu, unikatniNazvy, crc32, zip,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else koren.ANON = API;
})(typeof window !== 'undefined' ? window : globalThis);
