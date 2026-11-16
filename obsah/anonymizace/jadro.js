/* ============================================================
   anonymizace/jadro.js – výpočty pro Anonymizaci fotek (bez DOM).
   Obraz = RGBA pole (Uint8ClampedArray z ImageData) W*H*4.
   Oblast = { id, tvar: 'obdelnik'|'elipsa'|'stetec', x, y, w, h,
              efekt: 'rozmazat'|'pixely'|'cerna'|'emoji', sila 0–100, emoji,
              zdroj: 'rucni'|'oblicej'|'spz', skore, navrh, vypnuta,
              body: [[x,y],…] a r (jen štětec, v pixelech obrazu) }
   V prohlížeči window.ANON, v node module.exports.
   ============================================================ */
(function (koren) {
'use strict';

const EFEKTY = ['rozmazat', 'pixely', 'cerna', 'emoji'];
const TVARY = ['obdelnik', 'elipsa', 'stetec'];
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
    emoji: o.emoji || '😎',
    zdroj: o.zdroj || 'rucni', skore: o.skore === undefined ? null : o.skore,
    navrh: !!o.navrh, vypnuta: !!o.vypnuta,
  };
  if (r.tvar === 'stetec') { r.body = (o.body || []).map(p => [p[0], p[1]]); r.r = Math.max(1, +o.r || 10); prepocitejStetec(r); }
  return r;
}
/** Ohraničení tahu štětce = body ± poloměr. */
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
  if (o.tvar === 'stetec' && o.body) {
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
  if (o.tvar === 'stetec') {
    const b = o.body;
    if (b.length === 1) return Math.hypot(x - b[0][0], y - b[0][1]) <= o.r;
    for (let i = 1; i < b.length; i++) if (vzdalenostKUsecce(x, y, b[i - 1][0], b[i - 1][1], b[i][0], b[i][1]) <= o.r) return true;
    return false;
  }
  return true;
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
  else if (o.tvar === 'elipsa') {
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

/* ---------- rozmazání (3× box blur ≈ Gauss) ---------- */
function boxyProGauss(sigma, n = 3) {
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
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[row + omez(k, 0, w - 1) * 3 + c];
      for (let x = 0; x < w; x++) {
        dst[row + x * 3 + c] = acc / d;
        acc += src[row + Math.min(w - 1, x + r + 1) * 3 + c] - src[row + Math.max(0, x - r) * 3 + c];
      }
    }
  }
}
function boxV(src, dst, w, h, r) {
  const d = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[omez(k, 0, h - 1) * w * 3 + x * 3 + c];
      for (let y = 0; y < h; y++) {
        dst[y * w * 3 + x * 3 + c] = acc / d;
        acc += src[Math.min(h - 1, y + r + 1) * w * 3 + x * 3 + c] - src[Math.max(0, y - r) * w * 3 + x * 3 + c];
      }
    }
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
function sigmaZeSily(o) { return Math.max(2, (0.03 + o.sila / 100 * 0.22) * Math.max(o.w, o.h)); }
function blokZeSily(o) { return Math.max(3, Math.round((0.05 + o.sila / 100 * 0.25) * Math.max(o.w, o.h))); }

/** Přímo do obrazu (in place) použije efekt oblasti. Emoji = silná pixelizace (emoji kreslí stránka navrch). */
function aplikujOblast(rgba, W, H, o) {
  const m = maska(o, W, H);
  if (!m) return;
  const { x0, y0, w, h, a } = m;
  if (o.efekt === 'rozmazat') {
    const sigma = sigmaZeSily(o), pr = Math.ceil(sigma * 3);
    const vx = Math.max(0, x0 - pr), vy = Math.max(0, y0 - pr);
    const vw = Math.min(W, x0 + w + pr) - vx, vh = Math.min(H, y0 + h + pr) - vy;
    const r = rozmazVyrez(rgba, W, H, vx, vy, vw, vh, sigma);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!a[y * w + x]) continue;
      const s = ((y0 + y - vy) * vw + x0 + x - vx) * 3, d = ((y0 + y) * W + x0 + x) * 4;
      rgba[d] = r[s]; rgba[d + 1] = r[s + 1]; rgba[d + 2] = r[s + 2];
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
  } else { // cerna
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!a[y * w + x]) continue;
      const i = ((y0 + y) * W + x0 + x) * 4; rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
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
  0x9C9C: 'Komentář (Windows)', 0x9C9D: 'Autor (Windows)', 0x9286: 'Uživatelský komentář',
};
const GPS_TAGY = { 1: 'LatRef', 2: 'Lat', 3: 'LonRef', 4: 'Lon', 5: 'AltRef', 6: 'Alt', 29: 'Datum' };
const CITLIVE = new Set(['Autor', 'Copyright', 'Sériové číslo těla', 'Sériové číslo objektivu', 'Majitel fotoaparátu', 'Jedinečné ID snímku',
  'Popis obrázku', 'Autor (Windows)', 'Komentář (Windows)', 'Uživatelský komentář', 'Datum pořízení']);

function parsujTiff(v, start, konec) {
  const little = v.getUint16(start) === 0x4949;
  const u16 = o => v.getUint16(o, little), u32 = o => v.getUint32(o, little);
  const polozky = {}, gps = {};
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
  ctiIfd(start + u32(start + 4), polozky, TAGY, 0);
  let poloha = null;
  if (Array.isArray(gps.Lat) && Array.isArray(gps.Lon)) {
    const dms = a => a[0] + (a[1] || 0) / 60 + (a[2] || 0) / 3600;
    const lat = dms(gps.Lat) * (gps.LatRef === 'S' ? -1 : 1), lon = dms(gps.Lon) * (gps.LonRef === 'W' ? -1 : 1);
    if (isFinite(lat) && isFinite(lon) && (lat || lon)) {
      poloha = { lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
      if (typeof gps.Alt === 'number') poloha.alt = Math.round(gps.Alt * (gps.AltRef === 1 ? -1 : 1));
    }
  }
  return { polozky, gps: poloha };
}
const ascii = (v, o, n) => { let s = ''; for (let i = 0; i < n && o + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(o + i)); return s; };

/**
 * Najde metadata v souboru (ArrayBuffer). Vrátí { format, bloky: ['EXIF', 'XMP', …], polozky: [[název, hodnota, citlivé]], gps }.
 * Při exportu přes plátno se zahodí všechny – tohle slouží jen k ukázání, co soubor obsahoval.
 */
function ctiMetadata(buf) {
  const v = new DataView(buf), L = v.byteLength, bloky = [], vys = { format: '?', bloky, polozky: [], gps: null };
  const pridejTiff = (start, konec) => {
    try { const t = parsujTiff(v, start, konec); Object.assign(vys._p || (vys._p = {}), t.polozky); if (t.gps) vys.gps = t.gps; }
    catch (e) { /* poškozený blok – stačí vědět, že tam byl */ }
  };
  try {
    if (L > 4 && v.getUint16(0) === 0xFFD8) {
      vys.format = 'JPEG';
      let o = 2;
      while (o + 4 <= L && v.getUint8(o) === 0xFF) {
        const m = v.getUint8(o + 1);
        if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { o += 2; continue; }
        if (m === 0xDA || m === 0xD9) break;
        const len = v.getUint16(o + 2), d = o + 4;
        if (m === 0xE1 && ascii(v, d, 4) === 'Exif') { bloky.push('EXIF'); pridejTiff(d + 6, Math.min(L, o + 2 + len)); }
        else if (m === 0xE1 && ascii(v, d, 28).startsWith('http://ns.adobe.com/xap')) bloky.push('XMP');
        else if (m === 0xED) bloky.push('IPTC / Photoshop');
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
        else if (typ === 'XMP ') bloky.push('XMP');
        else if (typ === 'ICCP') bloky.push('Barevný profil ICC');
        o += 8 + len + (len & 1);
      }
    }
  } catch (e) { /* zkrácený soubor */ }
  const p = vys._p || {}; delete vys._p;
  for (const k of Object.keys(p)) vys.polozky.push([k, formatHodnoty(k, p[k]), CITLIVE.has(k)]);
  if (vys.gps) vys.polozky.unshift(['GPS poloha', vys.gps.lat + ', ' + vys.gps.lon + (vys.gps.alt !== undefined ? ' (' + vys.gps.alt + ' m n. m.)' : ''), true]);
  return vys;
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

const API = {
  EFEKTY, TVARY, UCHYTY, UF_W, UF_H,
  novaOblast, prepocitejStetec, normObdelnik, nastavObdelnik, posun, obsahuje, najdiOblast, uchyty, najdiUchyt, tahUchytem,
  maska, boxyProGauss, rozmazVyrez, sigmaZeSily, blokZeSily, aplikujOblast, vykresli, aktivni,
  vyrezNa, tenzorUltraFace, dekodujUltraFace, iou, nms, planDlazdic, naObraz, slucDetekce, oblastZObliceje,
  sedotisk, hledejSpz, ctiMetadata, nazevVystupu, unikatniNazvy, crc32, zip,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else koren.ANON = API;
})(typeof window !== 'undefined' ? window : globalThis);
