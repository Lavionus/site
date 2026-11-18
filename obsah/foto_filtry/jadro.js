// Fotofiltry – jádro: čisté funkce nad obrázkem {width, height, data: Uint8ClampedArray RGBA}.
// Běží ve workeru (importScripts) i v node (testy). Rozměry v parametrech typu „px“ jsou
// vztažené k delší straně 1000 px – k = delší strana / 1000, takže náhled i export vypadají stejně.
(function (G) {
'use strict';

const novy = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
const kopie = s => ({ width: s.width, height: s.height, data: new Uint8ClampedArray(s.data) });
const omez = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = omez((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function nahodne(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex(h) {
  const n = parseInt(String(h).replace('#', ''), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// jas 0–255 jako Float32Array
function jasy(s) {
  const n = s.width * s.height, L = new Float32Array(n), d = s.data;
  for (let i = 0; i < n; i++) L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  return L;
}

function kanaly(s) {
  const n = s.width * s.height, d = s.data;
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) { r[i] = d[i * 4]; g[i] = d[i * 4 + 1]; b[i] = d[i * 4 + 2]; }
  return [r, g, b];
}

function zKanalu(s, r, g, b) {
  const o = novy(s.width, s.height), d = o.data, n = s.width * s.height;
  for (let i = 0; i < n; i++) { d[i * 4] = r[i]; d[i * 4 + 1] = g[i]; d[i * 4 + 2] = b[i]; d[i * 4 + 3] = s.data[i * 4 + 3]; }
  return o;
}

// posuvné průměrování (okraje se opakují)
function boxH(a, o, w, h, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const z = y * w;
    let s = 0;
    for (let i = -r; i <= r; i++) s += a[z + omez(i, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      o[z + x] = s / n;
      s += a[z + Math.min(x + r + 1, w - 1)] - a[z + Math.max(x - r, 0)];
    }
  }
}
function boxV(a, o, w, h, r) {
  const n = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += a[omez(i, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      o[y * w + x] = s / n;
      s += a[Math.min(y + r + 1, h - 1) * w + x] - a[Math.max(y - r, 0) * w + x];
    }
  }
}
// přesný Gauss pro malá sigma (krabice by zaokrouhlila poloměr a rozdíl dvou rozmazání by zmizel)
function gauss(o, w, h, sigma, jenVodorovne) {
  const r = Math.ceil(sigma * 3), jadro = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) s += jadro[i + r] = Math.exp(-i * i / (2 * sigma * sigma));
  for (let i = 0; i < jadro.length; i++) jadro[i] /= s;
  const t = new Float32Array(o.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0; for (let i = -r; i <= r; i++) v += o[y * w + omez(x + i, 0, w - 1)] * jadro[i + r];
    t[y * w + x] = v;
  }
  if (jenVodorovne) return t;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0; for (let i = -r; i <= r; i++) v += t[omez(y + i, 0, h - 1) * w + x] * jadro[i + r];
    o[y * w + x] = v;
  }
  return o;
}
// přibližný Gauss třemi průchody krabicového filtru
function rozmaz(a, w, h, sigma, jenVodorovne) {
  const o = Float32Array.from(a);
  if (!(sigma >= 0.3)) return o;
  if (sigma < 3) return gauss(o, w, h, sigma, jenVodorovne);
  const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  const t = new Float32Array(a.length);
  for (let k = 0; k < 3; k++) {
    boxH(o, t, w, h, r);
    if (jenVodorovne) o.set(t); else boxV(t, o, w, h, r);
  }
  return o;
}
function rozmazObr(s, sigma) {
  const [r, g, b] = kanaly(s), w = s.width, h = s.height;
  return zKanalu(s, rozmaz(r, w, h, sigma), rozmaz(g, w, h, sigma), rozmaz(b, w, h, sigma));
}

function sobel(L, w, h) {
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(y - 1, 0) * w, y1 = y * w, y2 = Math.min(y + 1, h - 1) * w;
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(x - 1, 0), x2 = Math.min(x + 1, w - 1);
      const a = L[y0 + x0], b = L[y0 + x], c = L[y0 + x2], d = L[y1 + x0], f = L[y1 + x2], g = L[y2 + x0], i = L[y2 + x], j = L[y2 + x2];
      gx[y1 + x] = (c + 2 * f + j) - (a + 2 * d + g);
      gy[y1 + x] = (g + 2 * i + j) - (a + 2 * b + c);
    }
  }
  return { gx, gy };
}

// bilineární vzorek (souřadnice se ořežou na okraj)
function vzorek(s, x, y, out) {
  const w = s.width, h = s.height, d = s.data;
  x = omez(x, 0, w - 1); y = omez(y, 0, h - 1);
  const x0 = x | 0, y0 = y | 0, x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1), fx = x - x0, fy = y - y0;
  for (let c = 0; c < 4; c++) {
    const a = d[(y0 * w + x0) * 4 + c], b = d[(y0 * w + x1) * 4 + c], e = d[(y1 * w + x0) * 4 + c], f = d[(y1 * w + x1) * 4 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy;
  }
  return out;
}
// zkreslení: mapa(x, y) → [zdrojX, zdrojY]
function deformuj(s, mapa) {
  const w = s.width, h = s.height, o = novy(w, h), d = o.data, v = [0, 0, 0, 0], p = [0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    mapa(x + 0.5, y + 0.5, p);
    vzorek(s, p[0] - 0.5, p[1] - 0.5, v);
    const i = (y * w + x) * 4;
    d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = v[3];
  }
  return o;
}

// po pixelu: fn(r, g, b, i) vrací [r, g, b] (0–255)
function poPixelu(s, fn) {
  const o = novy(s.width, s.height), d = s.data, e = o.data, n = s.width * s.height;
  for (let i = 0; i < n; i++) {
    const j = i * 4, v = fn(d[j], d[j + 1], d[j + 2], i);
    e[j] = v[0]; e[j + 1] = v[1]; e[j + 2] = v[2]; e[j + 3] = d[j + 3];
  }
  return o;
}

// vyplněný kruh s vyhlazeným okrajem
function kruh(o, cx, cy, r, R, Gg, B, a) {
  const w = o.width, h = o.height, d = o.data;
  const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), k = a * omez(r - dist + 0.5, 0, 1);
    if (k <= 0) continue;
    const i = (y * w + x) * 4;
    d[i] += (R - d[i]) * k; d[i + 1] += (Gg - d[i + 1]) * k; d[i + 2] += (B - d[i + 2]) * k;
  }
}
// tah štětce = úsečka s kulatými konci
function tah(o, ax, ay, bx, by, r, R, Gg, B, a) {
  const w = o.width, h = o.height, d = o.data, vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1e-9;
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + r + 1));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + r + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5 - ax, py = y + 0.5 - ay, t = omez((px * vx + py * vy) / l2, 0, 1);
    const k = a * omez(r - Math.hypot(px - t * vx, py - t * vy) + 0.5, 0, 1);
    if (k <= 0) continue;
    const i = (y * w + x) * 4;
    d[i] += (R - d[i]) * k; d[i + 1] += (Gg - d[i + 1]) * k; d[i + 2] += (B - d[i + 2]) * k;
  }
}

function vypln(w, h, rgb, alfaZ) {
  const o = novy(w, h), d = o.data;
  for (let i = 0; i < w * h; i++) { d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = alfaZ ? alfaZ.data[i * 4 + 3] : 255; }
  return o;
}

// sytost kolem jasu
const syt = (r, g, b, f) => { const L = 0.299 * r + 0.587 * g + 0.114 * b; return [L + (r - L) * f, L + (g - L) * f, L + (b - L) * f]; };
// S-křivka 0–255
const skrivka = (v, s) => { const x = v / 255; const y = x + s * x * (1 - x) * (2 * x - 1) * -1; return 255 * omez(y, 0, 1); };

// barevný přechod z palety (pole [poloha, '#rrggbb'])
function prechod(body) {
  const b = body.map(([t, c]) => [t, hex(c)]), tab = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0; while (k < b.length - 2 && t > b[k + 1][0]) k++;
    const [t0, c0] = b[k], [t1, c1] = b[k + 1], f = omez((t - t0) / (t1 - t0 || 1), 0, 1);
    for (let c = 0; c < 3; c++) tab[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * f;
  }
  return tab;
}
function mapujJas(s, tab) {
  return poPixelu(s, (r, g, b) => { const L = Math.round(omez(0.299 * r + 0.587 * g + 0.114 * b, 0, 255)) * 3; return [tab[L], tab[L + 1], tab[L + 2]]; });
}

// XDoG – kresebné čáry: vrací Float32Array 0 (inkoust) … 1 (papír)
function xdog(L, w, h, sigma, ostrost) {
  const g1 = rozmaz(L, w, h, sigma), g2 = rozmaz(L, w, h, sigma * 1.6), o = new Float32Array(w * h);
  for (let i = 0; i < o.length; i++) {
    const D = (g1[i] - 0.985 * g2[i]) / 255;
    o[i] = D >= 0 ? 1 : 1 + Math.tanh(ostrost * D);
  }
  return o;
}

function hue(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
  if (c === 0) return [0, 0];
  let hh;
  if (mx === r) hh = ((g - b) / c) % 6; else if (mx === g) hh = (b - r) / c + 2; else hh = (r - g) / c + 4;
  return [(hh * 60 + 360) % 360, c / (mx || 1)];
}

// otočení odstínu (matice jako CSS hue-rotate)
function maticeOdstinu(st) {
  const a = st * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072];
}

function zrno(o, sila, seed) {
  const d = o.data, rnd = nahodne(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() + rnd() + rnd() - 1.5) * sila;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  return o;
}
function vinetace(o, sila) {
  const w = o.width, h = o.height, d = o.data, cx = w / 2, cy = h / 2, R = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const m = sila * smooth(0.35, 1.05, Math.hypot(x - cx, y - cy) / R), i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) d[i + c] = m >= 0 ? d[i + c] * (1 - m) : d[i + c] + (255 - d[i + c]) * -m;
  }
  return o;
}

// ─────────────────────────── základní úpravy ───────────────────────────
const UPRAVY = [
  { id: 'expozice', nazev: 'Expozice', min: -2, max: 2, krok: 0.05, vychozi: 0 },
  { id: 'jas', nazev: 'Jas', min: -100, max: 100, vychozi: 0 },
  { id: 'kontrast', nazev: 'Kontrast', min: -100, max: 100, vychozi: 0 },
  { id: 'svetla', nazev: 'Světla', min: -100, max: 100, vychozi: 0 },
  { id: 'stiny', nazev: 'Stíny', min: -100, max: 100, vychozi: 0 },
  { id: 'sytost', nazev: 'Sytost', min: -100, max: 100, vychozi: 0 },
  { id: 'zivost', nazev: 'Živost', min: -100, max: 100, vychozi: 0 },
  { id: 'teplota', nazev: 'Teplota', min: -100, max: 100, vychozi: 0 },
  { id: 'tonovani', nazev: 'Tónování (zelená ↔ purpurová)', min: -100, max: 100, vychozi: 0 },
  { id: 'odstin', nazev: 'Posun odstínu', min: -180, max: 180, vychozi: 0, jednotka: '°' },
  { id: 'ostrost', nazev: 'Ostrost', min: 0, max: 100, vychozi: 0 },
  { id: 'rozmazani', nazev: 'Rozmazání', min: 0, max: 30, krok: 0.5, vychozi: 0, jednotka: 'px' },
  { id: 'zrno', nazev: 'Zrno filmu', min: 0, max: 100, vychozi: 0 },
  { id: 'vinetace', nazev: 'Vinětace', min: -100, max: 100, vychozi: 0 }
];
const vychoziUpravy = () => Object.fromEntries(UPRAVY.map(u => [u.id, u.vychozi]));
const jsouVychozi = p => UPRAVY.every(u => (p[u.id] ?? u.vychozi) === u.vychozi);

function upravy(s, p, k) {
  p = Object.assign(vychoziUpravy(), p);
  if (jsouVychozi(p)) return s;
  const ev = Math.pow(2, p.expozice), jas = p.jas / 100 * 0.35, c = p.kontrast / 100;
  const kf = c > 0 ? 1 / (1 - c * 0.85) : 1 + c, sf = 1 + p.sytost / 100, zv = p.zivost / 100;
  const t = p.teplota / 100, tn = p.tonovani / 100, sv = p.svetla / 100, st = p.stiny / 100;
  const M = p.odstin ? maticeOdstinu(p.odstin) : null;
  let o = poPixelu(s, (r, g, b) => {
    r = r / 255 * ev; g = g / 255 * ev; b = b / 255 * ev;
    r *= 1 + 0.18 * t; b *= 1 - 0.18 * t; g *= 1 - 0.12 * tn;
    if (M) { const R = r, Gg = g, B = b; r = M[0] * R + M[1] * Gg + M[2] * B; g = M[3] * R + M[4] * Gg + M[5] * B; b = M[6] * R + M[7] * Gg + M[8] * B; }
    const L = omez(0.299 * r + 0.587 * g + 0.114 * b, 0, 1), dv = st * 0.45 * (1 - L) * (1 - L) + sv * 0.45 * L * L;
    r += dv + jas; g += dv + jas; b += dv + jas;
    r = (r - 0.5) * kf + 0.5; g = (g - 0.5) * kf + 0.5; b = (b - 0.5) * kf + 0.5;
    let f = sf;
    if (zv) { const sat = Math.max(r, g, b) - Math.min(r, g, b); f *= 1 + zv * (1 - omez(sat, 0, 1)); }
    if (f !== 1) { const L2 = 0.299 * r + 0.587 * g + 0.114 * b; r = L2 + (r - L2) * f; g = L2 + (g - L2) * f; b = L2 + (b - L2) * f; }
    return [r * 255, g * 255, b * 255];
  });
  if (p.ostrost > 0) {
    const bl = rozmazObr(o, Math.max(0.8, 1.2 * k)), a = p.ostrost / 100 * 1.6, d = o.data;
    for (let i = 0; i < d.length; i++) if ((i & 3) !== 3) d[i] += (d[i] - bl.data[i]) * a;
  }
  if (p.rozmazani > 0) o = rozmazObr(o, p.rozmazani * k);
  if (p.zrno > 0) zrno(o, p.zrno * 0.5, 7);
  if (p.vinetace) vinetace(o, p.vinetace / 100);
  return o;
}

// ─────────────────────────── filtry ───────────────────────────
// parametr: {id, nazev, min, max, krok?, vychozi, jednotka?} | {typ:'barva'} | {typ:'volba', moznosti:[[hodnota, popis]]}
const F = [];
const pridej = (kategorie, id, nazev, popis, param, fn) => F.push({ kategorie, id, nazev, popis, param, fn });

// ── Barvy & tóny
pridej('barvy', 'cernobila', '⚫ Černobílá', 'Převod do šedi s barevným filtrem jako na černobílý film.', [
  { id: 'filtr', nazev: 'Barevný filtr', typ: 'volba', vychozi: 'n', moznosti: [['n', 'neutrální'], ['r', 'červený (tmavé nebe)'], ['o', 'oranžový'], ['z', 'zelený (pleť, listí)'], ['m', 'modrý']] },
  { id: 'kontrast', nazev: 'Kontrast', min: 0, max: 100, vychozi: 20 }
], (s, p) => {
  const W = { n: [0.299, 0.587, 0.114], r: [0.75, 0.25, 0], o: [0.55, 0.4, 0.05], z: [0.2, 0.7, 0.1], m: [0.1, 0.3, 0.6] }[p.filtr] || [0.299, 0.587, 0.114];
  return poPixelu(s, (r, g, b) => { const v = skrivka(W[0] * r + W[1] * g + W[2] * b, p.kontrast / 100 * 1.5); return [v, v, v]; });
});
pridej('barvy', 'sepie', '🟤 Sépie', 'Teplý hnědý tón starých fotografií.', [{ id: 'sila', nazev: 'Síla', min: 0, max: 100, vychozi: 100 }], (s, p) => {
  const k = p.sila / 100;
  return poPixelu(s, (r, g, b) => {
    const R = 0.393 * r + 0.769 * g + 0.189 * b, Gg = 0.349 * r + 0.686 * g + 0.168 * b, B = 0.272 * r + 0.534 * g + 0.131 * b;
    return [r + (R - r) * k, g + (Gg - g) * k, b + (B - b) * k];
  });
});
pridej('barvy', 'vintage', '📼 Vintage', 'Vybledlé černé, teplé světlo, vinětace a zrno.', [{ id: 'sila', nazev: 'Síla', min: 0, max: 100, vychozi: 80 }], (s, p, k) => {
  const f = p.sila / 100;
  const o = poPixelu(s, (r, g, b) => {
    let [R, Gg, B] = syt(r, g, b, 0.75);
    R = 20 + R * 0.9 * 1.06; Gg = 15 + Gg * 0.88; B = 35 + B * 0.72;
    return [r + (R - r) * f, g + (Gg - g) * f, b + (B - b) * f];
  });
  return zrno(vinetace(o, 0.45 * f), 10 * f, 3);
});
pridej('barvy', 'lomo', '📸 Lomo', 'Syté barvy, tvrdý kontrast a výrazná tmavá vinětace.', [{ id: 'vin', nazev: 'Vinětace', min: 0, max: 100, vychozi: 70 }], (s, p) => {
  const o = poPixelu(s, (r, g, b) => syt(skrivka(r, 0.9), skrivka(g, 0.8), skrivka(b, 0.6), 1.35));
  return vinetace(o, p.vin / 100);
});
pridej('barvy', 'crossproces', '🧪 Křížové vyvolání', 'Barevné posuny jako diapozitiv vyvolaný v negativní lázni.', [{ id: 'sila', nazev: 'Síla', min: 0, max: 100, vychozi: 100 }], (s, p) => {
  const f = p.sila / 100;
  return poPixelu(s, (r, g, b) => {
    const R = skrivka(r, 1.2), Gg = skrivka(g, 0.7), B = b * 0.65 + 45;
    return [r + (R - r) * f, g + (Gg - g) * f, b + (B - b) * f];
  });
});
pridej('barvy', 'duoton', '🌗 Duotón', 'Stíny jednou barvou, světla druhou.', [
  { id: 'c1', nazev: 'Stíny', typ: 'barva', vychozi: '#1d1b5e' },
  { id: 'c2', nazev: 'Světla', typ: 'barva', vychozi: '#ffb36b' }
], (s, p) => mapujJas(s, prechod([[0, p.c1], [1, p.c2]])));
pridej('barvy', 'kyanotypie', '🔷 Kyanotypie', 'Pruská modř starých světlotisků.', [], s => mapujJas(s, prechod([[0, '#0a2149'], [0.55, '#2f6aa3'], [1, '#eef4f8']])));
pridej('barvy', 'termovize', '🌡️ Termovize', 'Falešné barvy podle jasu jako termokamera.', [
  { id: 'paleta', nazev: 'Paleta', typ: 'volba', vychozi: 'zelezo', moznosti: [['zelezo', 'železo'], ['duha', 'duha'], ['led', 'led']] }
], (s, p) => {
  const P = {
    zelezo: [[0, '#000010'], [0.25, '#3a0a8c'], [0.5, '#c4206a'], [0.75, '#ff8a00'], [0.92, '#ffe24a'], [1, '#ffffff']],
    duha: [[0, '#1a0060'], [0.2, '#0050ff'], [0.4, '#00e0c0'], [0.6, '#5aff00'], [0.8, '#ffd000'], [1, '#ff1a00']],
    led: [[0, '#000000'], [0.4, '#073a7a'], [0.7, '#36b6ff'], [1, '#ffffff']]
  };
  return mapujJas(s, prechod(P[p.paleta] || P.zelezo));
});
pridej('barvy', 'infra', '🌿 Infračervená', 'Zeleň zbělá, nebe ztmavne – vzhled infračerveného filmu.', [{ id: 'zar', nazev: 'Záře', min: 0, max: 100, vychozi: 40 }], (s, p, k) => {
  const o = poPixelu(s, (r, g, b) => { const v = omez(-0.25 * r + 1.45 * g - 0.2 * b, 0, 255); return [v, v, v]; });
  if (p.zar > 0) { const bl = rozmazObr(o, 6 * k), a = p.zar / 100; for (let i = 0; i < o.data.length; i++) if ((i & 3) !== 3) o.data[i] = 255 - (255 - o.data[i]) * (255 - bl.data[i] * a) / 255; }
  return o;
});
pridej('barvy', 'vyberbarvy', '🎯 Výběr barvy', 'Jedna barva zůstane, zbytek zešedne.', [
  { id: 'odstin', nazev: 'Odstín', min: 0, max: 359, vychozi: 0, jednotka: '°' },
  { id: 'tolerance', nazev: 'Tolerance', min: 5, max: 90, vychozi: 25, jednotka: '°' }
], (s, p) => poPixelu(s, (r, g, b) => {
  const [hh, sat] = hue(r, g, b), dd = Math.abs(((hh - p.odstin + 540) % 360) - 180);
  const keep = (1 - smooth(p.tolerance * 0.6, p.tolerance, dd)) * smooth(0.12, 0.3, sat);
  return syt(r, g, b, keep);
}));
pridej('barvy', 'posterizace', '🎚️ Posterizace', 'Omezí počet barevných úrovní.', [{ id: 'urovne', nazev: 'Úrovně', min: 2, max: 12, vychozi: 4 }], (s, p) => {
  const n = p.urovne - 1, q = v => Math.round(v / 255 * n) / n * 255;
  return poPixelu(s, (r, g, b) => [q(r), q(g), q(b)]);
});
pridej('barvy', 'inverze', '🔄 Negativ', 'Převrácené barvy jako na negativu.', [], s => poPixelu(s, (r, g, b) => [255 - r, 255 - g, 255 - b]));

// ── Malba
pridej('malba', 'pointilismus', '🔴 Pointilismus', 'Obraz složený z barevných teček jako u Seurata.', [
  { id: 'velikost', nazev: 'Velikost tečky', min: 2, max: 20, krok: 0.5, vychozi: 5, jednotka: 'px' },
  { id: 'hustota', nazev: 'Hustota', min: 50, max: 400, vychozi: 240, jednotka: '%' },
  { id: 'sytost', nazev: 'Sytost', min: 0, max: 100, vychozi: 40 },
  { id: 'pestrost', nazev: 'Pestrost teček', min: 0, max: 100, vychozi: 35 },
  { id: 'papir', nazev: 'Podklad', typ: 'barva', vychozi: '#f4efe4' }
], (s, p, k) => {
  const w = s.width, h = s.height, r = Math.max(0.8, p.velikost * k), rnd = nahodne(11);
  const zdroj = rozmazObr(s, r * 0.5), o = vypln(w, h, hex(p.papir), s), d = zdroj.data;
  const N = Math.round(w * h / (r * r) * p.hustota / 100 * 0.9), fs = 1 + p.sytost / 100, j = p.pestrost / 100 * 60;
  for (let n = 0; n < N; n++) {
    const x = rnd() * w, y = rnd() * h, i = ((y | 0) * w + (x | 0)) * 4;
    let [R, Gg, B] = syt(d[i], d[i + 1], d[i + 2], fs);
    R += (rnd() - 0.5) * j; Gg += (rnd() - 0.5) * j; B += (rnd() - 0.5) * j;
    kruh(o, x, y, r * (0.7 + rnd() * 0.5), omez(R, 0, 255), omez(Gg, 0, 255), omez(B, 0, 255), 0.92);
  }
  return o;
});

function olej(s, r, urovne) {
  const w = s.width, h = s.height, n = w * h, d = s.data, L = new Uint8Array(n);
  for (let i = 0; i < n; i++) L[i] = Math.min(urovne - 1, ((0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * urovne / 256) | 0);
  const o = novy(w, h), e = o.data, cnt = new Int32Array(urovne), sr = new Float64Array(urovne), sg = new Float64Array(urovne), sb = new Float64Array(urovne);
  const sloupec = (x, y, zn) => {
    if (x < 0 || x >= w) return;
    for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) {
      const i = yy * w + x, l = L[i];
      cnt[l] += zn; sr[l] += zn * d[i * 4]; sg[l] += zn * d[i * 4 + 1]; sb[l] += zn * d[i * 4 + 2];
    }
  };
  for (let y = 0; y < h; y++) {
    cnt.fill(0); sr.fill(0); sg.fill(0); sb.fill(0);
    for (let x = -r; x < r; x++) sloupec(x, y, 1);
    for (let x = 0; x < w; x++) {
      sloupec(x + r, y, 1);
      let m = 0; for (let l = 1; l < urovne; l++) if (cnt[l] > cnt[m]) m = l;
      const i = (y * w + x) * 4;
      e[i] = sr[m] / cnt[m]; e[i + 1] = sg[m] / cnt[m]; e[i + 2] = sb[m] / cnt[m]; e[i + 3] = d[i + 3];
      sloupec(x - r, y, -1);
    }
  }
  return o;
}
pridej('malba', 'olej', '🖼️ Olejomalba', 'Splývavé plochy barvy jako olej na plátně.', [
  { id: 'stetec', nazev: 'Velikost štětce', min: 1, max: 12, vychozi: 4, jednotka: 'px' },
  { id: 'urovne', nazev: 'Úrovně barvy', min: 6, max: 40, vychozi: 20 },
  { id: 'platno', nazev: 'Struktura plátna', min: 0, max: 100, vychozi: 30 }
], (s, p, k) => {
  const o = olej(s, Math.max(1, Math.round(p.stetec * k)), p.urovne);
  if (p.platno > 0) {
    const w = o.width, h = o.height, a = p.platno / 100 * 18, per = Math.max(2, 3 * k);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = (Math.sin(x / per * Math.PI) * Math.sin(y / per * Math.PI)) * a, i = (y * w + x) * 4;
      o.data[i] += t; o.data[i + 1] += t; o.data[i + 2] += t;
    }
  }
  return o;
});
pridej('malba', 'akvarel', '💧 Akvarel', 'Rozpité barvy, ztmavlé okraje skvrn a papír.', [
  { id: 'stetec', nazev: 'Velikost skvrn', min: 1, max: 10, vychozi: 4, jednotka: 'px' },
  { id: 'okraje', nazev: 'Okraje skvrn', min: 0, max: 100, vychozi: 50 },
  { id: 'papir', nazev: 'Textura papíru', min: 0, max: 100, vychozi: 50 }
], (s, p, k) => {
  const w = s.width, h = s.height;
  let o = olej(s, Math.max(1, Math.round(p.stetec * k)), 12);
  const bl = rozmazObr(o, 2 * k);
  const L = jasy(o), { gx, gy } = sobel(rozmaz(L, w, h, 0.8 * k), w, h);
  let sum = rozmaz(Float32Array.from({ length: w * h }, nahodne(5)), w, h, 1.2 * k);
  const pa = p.papir / 100, ok = p.okraje / 100;
  const d = o.data;
  for (let i = 0; i < w * h; i++) {
    const hrana = Math.min(1, Math.hypot(gx[i], gy[i]) / 220) * ok * 0.5, pap = 1 - pa * 0.18 * (sum[i] - 0.5) * 4;
    for (let c = 0; c < 3; c++) {
      let v = d[i * 4 + c] * 0.55 + bl.data[i * 4 + c] * 0.45;
      v = v * 0.82 + 255 * 0.18;
      d[i * 4 + c] = v * (1 - hrana) * pap;
    }
  }
  return o;
});
pridej('malba', 'impresionismus', '🖌️ Tahy štětcem', 'Impresionistické tahy natočené podle tvarů v obraze.', [
  { id: 'delka', nazev: 'Délka tahu', min: 3, max: 40, vychozi: 10, jednotka: 'px' },
  { id: 'sirka', nazev: 'Šířka tahu', min: 1, max: 12, krok: 0.5, vychozi: 2.5, jednotka: 'px' },
  { id: 'pestrost', nazev: 'Pestrost', min: 0, max: 100, vychozi: 25 },
  { id: 'sytost', nazev: 'Sytost', min: 0, max: 100, vychozi: 25 }
], (s, p, k) => {
  const w = s.width, h = s.height, r = Math.max(0.6, p.sirka * k / 2), del = p.delka * k, rnd = nahodne(21);
  const zdroj = rozmazObr(s, r * 0.7), o = rozmazObr(s, r * 2), d = zdroj.data;
  const L = rozmaz(jasy(s), w, h, Math.max(1, del / 4)), { gx, gy } = sobel(L, w, h);
  const krok = Math.max(1, r * 1.3), body = [];
  for (let y = 0; y < h; y += krok) for (let x = 0; x < w; x += krok) body.push(x + rnd() * krok, y + rnd() * krok);
  const N = body.length / 2, poradi = new Uint32Array(N).map((_, i) => i);
  for (let i = N - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = poradi[i]; poradi[i] = poradi[j]; poradi[j] = t; }
  const j = p.pestrost / 100 * 50, fs = 1 + p.sytost / 100;
  for (const n of poradi) {
    const x = body[n * 2], y = body[n * 2 + 1], ix = Math.min(w - 1, x | 0), iy = Math.min(h - 1, y | 0), i = iy * w + ix;
    const a = Math.atan2(gy[i], gx[i]) + Math.PI / 2 + (rnd() - 0.5) * 0.4, l = del * (0.6 + rnd() * 0.6) / 2;
    const dx = Math.cos(a) * l, dy = Math.sin(a) * l, sh = (rnd() - 0.5) * j;
    const [R, Gg, B] = syt(d[i * 4] + sh, d[i * 4 + 1] + sh, d[i * 4 + 2] + sh, fs);
    tah(o, x - dx, y - dy, x + dx, y + dy, r, omez(R, 0, 255), omez(Gg, 0, 255), omez(B, 0, 255), 0.9);
  }
  return o;
});
pridej('malba', 'pastel', '🖍️ Pastel', 'Měkké křídové pastely na zrnitém papíře.', [
  { id: 'zrnitost', nazev: 'Zrnitost papíru', min: 0, max: 100, vychozi: 40 }
], (s, p, k) => {
  const w = s.width, h = s.height, rnd = nahodne(9);
  const o = olej(s, Math.max(1, Math.round(3 * k)), 10);
  const sum = rozmaz(Float32Array.from({ length: w * h }, rnd), w, h, Math.max(0.8, 1.2 * k)), z = p.zrnitost / 100;
  const d = o.data;
  for (let i = 0; i < w * h; i++) {
    const tz = omez(0.5 + (sum[i] - 0.5) * 6, 0, 1), kryti = 1 - z * 0.5 * (1 - tz);
    for (let c = 0; c < 3; c++) { const v = 255 * 0.2 + d[i * 4 + c] * 0.85; d[i * 4 + c] = 250 - (250 - v) * kryti; }
  }
  return o;
});

// ── Kresba
function tuzka(s, jemnost, tmavost, k) {
  const w = s.width, h = s.height, L = jasy(s), inv = L.map(v => 255 - v), b = rozmaz(inv, w, h, jemnost * k), o = new Float32Array(w * h);
  for (let i = 0; i < o.length; i++) o[i] = 255 * Math.pow(omez(L[i] / Math.max(1, 255 - b[i]), 0, 1), tmavost);
  return o;
}
pridej('kresba', 'tuzka', '✏️ Kresba tužkou', 'Fotka převedená na kresbu grafitem.', [
  { id: 'jemnost', nazev: 'Šířka čar', min: 1, max: 20, krok: 0.5, vychozi: 5, jednotka: 'px' },
  { id: 'tmavost', nazev: 'Tmavost', min: 100, max: 400, vychozi: 180, jednotka: '%' },
  { id: 'textura', nazev: 'Papír', min: 0, max: 100, vychozi: 30 }
], (s, p, k) => {
  const w = s.width, h = s.height, t = tuzka(s, p.jemnost, p.tmavost / 100, k);
  const sum = rozmaz(Float32Array.from({ length: w * h }, nahodne(4)), w, h, 0.6 * k), a = p.textura / 100 * 40;
  return poPixelu(s, (r, g, b, i) => { const v = t[i] - (255 - t[i]) / 255 * (sum[i] - 0.5) * a * 2 - a * 0.05; return [v, v, v * 0.98]; });
});
pridej('kresba', 'pastelky', '🖍️ Barevné pastelky', 'Kresba tužkou vybarvená pastelkami.', [
  { id: 'jemnost', nazev: 'Šířka čar', min: 1, max: 20, krok: 0.5, vychozi: 5, jednotka: 'px' },
  { id: 'barva', nazev: 'Množství barvy', min: 0, max: 100, vychozi: 70 }
], (s, p, k) => {
  const t = tuzka(s, p.jemnost, 1.6, k), a = p.barva / 100;
  return poPixelu(s, (r, g, b, i) => { const f = t[i] / 255; const [R, Gg, B] = syt(r, g, b, 1.3); return [(255 + (R - 255) * a * 0.75) * f, (255 + (Gg - 255) * a * 0.75) * f, (255 + (B - 255) * a * 0.75) * f]; });
});
pridej('kresba', 'uhel', '⬛ Kresba uhlem', 'Tmavé rozmazané plochy a hrubé tahy uhlu.', [
  { id: 'tmavost', nazev: 'Tmavost', min: 0, max: 100, vychozi: 60 },
  { id: 'smer', nazev: 'Směr šmouh', min: 0, max: 180, vychozi: 30, jednotka: '°' }
], (s, p, k) => {
  const w = s.width, h = s.height, L = rozmaz(jasy(s), w, h, 1.2 * k), linie = xdog(jasy(s), w, h, 1.4 * k, 70);
  const t = 0.6 + p.tmavost / 100 * 0.9, a = p.smer * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), rnd = nahodne(8);
  // šmouhy: šum rozmazaný pohybem ve zvoleném směru
  const sum = new Float32Array(w * h).map(rnd), str = new Float32Array(w * h), n = Math.max(3, Math.round(8 * k)), krok = Math.max(1, 1.5 * k);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let q = -n; q <= n; q++) v += sum[omez(Math.round(y + q * krok * sa), 0, h - 1) * w + omez(Math.round(x + q * krok * ca), 0, w - 1)];
    str[y * w + x] = v / (2 * n + 1);
  }
  const roz = 1 / (0.29 / Math.sqrt(2 * n + 1));   // normalizace rozptylu průměru
  return poPixelu(s, (r, g, b, i) => {
    const tma = Math.pow(smooth(0.08, 0.9, 1 - L[i] / 255), 1 / t) * omez(1 + (str[i] - 0.5) * roz * 0.18, 0.4, 1.4);
    const v = (246 - 236 * omez(tma, 0, 1)) * (0.3 + 0.7 * linie[i]);
    return [v, v, v * 0.97];
  });
});
pridej('kresba', 'perokresba', '🖋️ Perokresba', 'Čisté obrysy tuší, volitelně s vyplněnými stíny.', [
  { id: 'tloustka', nazev: 'Tloušťka čar', min: 0.5, max: 6, krok: 0.1, vychozi: 1.4, jednotka: 'px' },
  { id: 'detail', nazev: 'Detail', min: 10, max: 300, vychozi: 90 },
  { id: 'stiny', nazev: 'Černé stíny', min: 0, max: 100, vychozi: 15 },
  { id: 'inkoust', nazev: 'Inkoust', typ: 'barva', vychozi: '#16161a' }
], (s, p, k) => {
  const w = s.width, h = s.height, L = jasy(s), x = xdog(L, w, h, p.tloustka * k, p.detail), Lb = rozmaz(L, w, h, 1.5 * k), ink = hex(p.inkoust), prah = p.stiny / 100 * 110;
  return poPixelu(s, (r, g, b, i) => {
    const t = prah > 0 ? Math.min(x[i], smooth(prah - 6, prah + 6, Lb[i])) : x[i];
    return [255 + (ink[0] - 255) * (1 - t), 255 + (ink[1] - 255) * (1 - t), 255 + (ink[2] - 255) * (1 - t)];
  });
});
pridej('kresba', 'srafovani', '#️⃣ Křížové šrafování', 'Tóny vyjádřené vrstvami šrafů jako v rytině perem.', [
  { id: 'rozestup', nazev: 'Rozestup čar', min: 3, max: 16, krok: 0.5, vychozi: 6, jednotka: 'px' },
  { id: 'tloustka', nazev: 'Tloušťka', min: 0.5, max: 4, krok: 0.1, vychozi: 1.1, jednotka: 'px' },
  { id: 'obrys', nazev: 'Obrysy', min: 0, max: 100, vychozi: 60 }
], (s, p, k) => {
  const w = s.width, h = s.height, L0 = jasy(s), L = rozmaz(L0, w, h, 1.2 * k), sp = p.rozestup * k, tl = p.tloustka * k / 2;
  const obr = p.obrys > 0 ? xdog(L0, w, h, 1.2 * k, 40 + p.obrys) : null;
  const vrstvy = [[0.82, 45], [0.62, -45], [0.42, 0], [0.24, 90]].map(([t, u]) => [t * 255, Math.cos(u * Math.PI / 180), Math.sin(u * Math.PI / 180)]);
  return poPixelu(s, (r, g, b, i) => {
    const x = i % w, y = (i / w) | 0;
    let v = 1;
    for (const [t, c, sn] of vrstvy) {
      if (L[i] >= t) continue;
      const u = x * c + y * sn + Math.sin((x * sn - y * c) / (11 * k)) * 0.6 * k, m = ((u % sp) + sp) % sp, dd = Math.abs(m - sp / 2);
      const hl = omez((t - L[i]) / 40, 0.3, 1);
      v = Math.min(v, 1 - hl * omez(tl - dd + 0.5, 0, 1));
    }
    if (obr) v = Math.min(v, 1 - (1 - obr[i]) * p.obrys / 100);
    const c = 250 * v + 20 * (1 - v);
    return [c, c, c * 0.97];
  });
});
pridej('kresba', 'rytina', '🪵 Rytina / linoryt', 'Rovnoběžné linky, jejichž tloušťka nese tóny obrazu.', [
  { id: 'rozestup', nazev: 'Rozestup linek', min: 3, max: 20, krok: 0.5, vychozi: 6, jednotka: 'px' },
  { id: 'uhel', nazev: 'Úhel', min: 0, max: 180, vychozi: 20, jednotka: '°' },
  { id: 'vlneni', nazev: 'Vlnění podle tvaru', min: 0, max: 100, vychozi: 50 },
  { id: 'inkoust', nazev: 'Inkoust', typ: 'barva', vychozi: '#14110d' },
  { id: 'papir', nazev: 'Papír', typ: 'barva', vychozi: '#f3ead6' }
], (s, p, k) => {
  const w = s.width, h = s.height, L = rozmaz(jasy(s), w, h, 1.2 * k), sp = p.rozestup * k, a = p.uhel * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const ink = hex(p.inkoust), pap = hex(p.papir), vl = p.vlneni / 100;
  return poPixelu(s, (r, g, b, i) => {
    const x = i % w, y = (i / w) | 0, l = L[i] / 255;
    const u = -x * sa + y * ca + (l - 0.5) * sp * 1.6 * vl, m = ((u % sp) + sp) % sp, dd = Math.abs(m - sp / 2);
    const t = omez(sp / 2 * Math.pow(1 - l, 0.9) - dd + 0.5, 0, 1);
    return [pap[0] + (ink[0] - pap[0]) * t, pap[1] + (ink[1] - pap[1]) * t, pap[2] + (ink[2] - pap[2]) * t];
  });
});

// ── Grafika & pop-art
pridej('grafika', 'komiks', '💥 Komiks', 'Ploché barvy s černými obrysy.', [
  { id: 'urovne', nazev: 'Barevné úrovně', min: 2, max: 8, vychozi: 4 },
  { id: 'obrysy', nazev: 'Obrysy', min: 0, max: 100, vychozi: 70 },
  { id: 'sytost', nazev: 'Sytost', min: 0, max: 100, vychozi: 40 }
], (s, p, k) => {
  const w = s.width, h = s.height, hlad = olej(s, Math.max(1, Math.round(3 * k)), 16), x = xdog(jasy(s), w, h, 1.3 * k, 40 + p.obrysy * 1.5);
  const n = p.urovne - 1, q = v => Math.round(omez(v, 0, 255) / 255 * n) / n * 255, fs = 1 + p.sytost / 100, ob = p.obrysy / 100;
  return poPixelu(hlad, (r, g, b, i) => { const [R, Gg, B] = syt(r, g, b, fs); const t = 1 - (1 - x[i]) * ob; return [q(R) * t, q(Gg) * t, q(B) * t]; });
});
pridej('grafika', 'popart', '🟨 Pop-art (4 okna)', 'Čtyři kopie v křiklavých barvách jako sítotisky 60. let.', [
  { id: 'urovne', nazev: 'Tóny', min: 2, max: 4, vychozi: 3 }
], (s, p) => {
  const w = s.width, h = s.height, o = novy(w, h), pal = [
    ['#1b1464', '#ff2d95', '#ffe600', '#ffffff'], ['#0b3d20', '#ff7a00', '#7df9ff', '#ffffff'],
    ['#4a0072', '#00c853', '#ff4081', '#fff59d'], ['#b71c1c', '#2962ff', '#ffd600', '#ffffff']].map(a => a.map(hex));
  const v = [0, 0, 0, 0], n = p.urovne;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const qx = x < w / 2 ? 0 : 1, qy = y < h / 2 ? 0 : 1, P = pal[qy * 2 + qx];
    vzorek(s, (x - qx * w / 2) * 2, (y - qy * h / 2) * 2, v);
    const l = Math.min(n - 1, ((0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) / 256 * n) | 0), c = P[Math.round(l * 3 / (n - 1))];
    const i = (y * w + x) * 4;
    o.data[i] = c[0]; o.data[i + 1] = c[1]; o.data[i + 2] = c[2]; o.data[i + 3] = 255;
  }
  return o;
});
pridej('grafika', 'rastr', '🔘 Tiskový rastr', 'Tečkový rastr novin nebo barevný CMYK tisk.', [
  { id: 'bunka', nazev: 'Velikost buňky', min: 3, max: 40, krok: 0.5, vychozi: 8, jednotka: 'px' },
  { id: 'rezim', nazev: 'Režim', typ: 'volba', vychozi: 'cmyk', moznosti: [['cmyk', 'barevný CMYK'], ['cb', 'černobílý'], ['barva', 'barevné tečky na bílé']] },
  { id: 'uhel', nazev: 'Úhel', min: 0, max: 90, vychozi: 45, jednotka: '°' }
], (s, p, k) => {
  const w = s.width, h = s.height, c = p.bunka * k, zdroj = rozmazObr(s, c * 0.35), v = [0, 0, 0, 0];
  // pokrytí bodu (x,y) rastrem s úhlem u; hodnotaF(vzorek) → 0–1 (podíl inkoustu)
  const vrstva = (x, y, u, hodnotaF) => {
    const ca = Math.cos(u), sa = Math.sin(u), rx = x * ca + y * sa, ry = -x * sa + y * ca;
    const cx = (Math.floor(rx / c) + 0.5) * c, cy = (Math.floor(ry / c) + 0.5) * c;
    vzorek(zdroj, cx * ca - cy * sa, cx * sa + cy * ca, v);
    const r = c * 0.5 * Math.SQRT2 * Math.sqrt(omez(hodnotaF(v), 0, 1));
    return omez(r - Math.hypot(rx - cx, ry - cy) + 0.5, 0, 1);
  };
  const u0 = p.uhel * Math.PI / 180, o = novy(w, h), d = o.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, X = x + 0.5, Y = y + 0.5;
    let R, Gg, B;
    if (p.rezim === 'cmyk') {
      const K = q => { const m = Math.max(q[0], q[1], q[2]) / 255; return 1 - m; };
      const C = vrstva(X, Y, u0 - Math.PI / 6, q => { const kk = K(q); return kk > 0.99 ? 0 : (1 - q[0] / 255 - kk) / (1 - kk); });
      const M = vrstva(X, Y, u0 + Math.PI / 6, q => { const kk = K(q); return kk > 0.99 ? 0 : (1 - q[1] / 255 - kk) / (1 - kk); });
      const Y2 = vrstva(X, Y, u0 - Math.PI / 4, q => { const kk = K(q); return kk > 0.99 ? 0 : (1 - q[2] / 255 - kk) / (1 - kk); });
      const Kk = vrstva(X, Y, u0, q => K(q) * 0.9);
      R = 255 * (1 - C) * (1 - Kk); Gg = 255 * (1 - M) * (1 - Kk); B = 255 * (1 - Y2) * (1 - Kk);
    } else if (p.rezim === 'cb') {
      const t = vrstva(X, Y, u0, q => 1 - (0.299 * q[0] + 0.587 * q[1] + 0.114 * q[2]) / 255);
      R = Gg = B = 250 - 235 * t;
    } else {
      const t = vrstva(X, Y, u0, q => 0.25 + 0.75 * (1 - (0.299 * q[0] + 0.587 * q[1] + 0.114 * q[2]) / 255));
      R = 255 + (v[0] - 255) * t; Gg = 255 + (v[1] - 255) * t; B = 255 + (v[2] - 255) * t;
    }
    d[i] = R; d[i + 1] = Gg; d[i + 2] = B; d[i + 3] = s.data[i + 3];
  }
  return o;
});
pridej('grafika', 'mozaika', '🟦 Mozaika', 'Obraz z kostiček – čtverce, kruhy nebo dlaždice se spárou.', [
  { id: 'velikost', nazev: 'Velikost kostky', min: 3, max: 60, vychozi: 14, jednotka: 'px' },
  { id: 'tvar', nazev: 'Tvar', typ: 'volba', vychozi: 'ctverec', moznosti: [['ctverec', 'čtverce (pixelace)'], ['dlazdice', 'dlaždice se spárou'], ['kruh', 'kruhy'], ['hexa', 'šestiúhelníky']] }
], (s, p, k) => {
  const w = s.width, h = s.height, c = Math.max(2, p.velikost * k), d = s.data;
  if (p.tvar === 'hexa') {
    const R = c / Math.sqrt(3), dx = c, dy = 1.5 * R, sum = new Map();
    const stred = (x, y) => {
      const row = Math.round(y / dy); let best = null, bd = 1e9;
      for (let rr = row - 1; rr <= row + 1; rr++) {
        const off = (rr & 1) ? dx / 2 : 0, col = Math.round((x - off) / dx);
        for (let cc = col - 1; cc <= col + 1; cc++) { const cx = cc * dx + off, cy = rr * dy, dd = (x - cx) ** 2 + (y - cy) ** 2; if (dd < bd) { bd = dd; best = rr * 100000 + cc; } }
      }
      return best;
    };
    const id = new Float64Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const key = stred(x + 0.5, y + 0.5), i = y * w + x; id[i] = key;
      let a = sum.get(key); if (!a) sum.set(key, a = [0, 0, 0, 0]);
      a[0] += d[i * 4]; a[1] += d[i * 4 + 1]; a[2] += d[i * 4 + 2]; a[3]++;
    }
    return poPixelu(s, (r, g, b, i) => { const a = sum.get(id[i]); return [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
  }
  const nx = Math.ceil(w / c), ny = Math.ceil(h / c), prum = new Float32Array(nx * ny * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = (Math.floor(y / c) * nx + Math.floor(x / c)) * 4, i = (y * w + x) * 4;
    prum[j] += d[i]; prum[j + 1] += d[i + 1]; prum[j + 2] += d[i + 2]; prum[j + 3]++;
  }
  const spara = p.tvar === 'dlazdice' ? Math.max(1, c * 0.08) : 0;
  return poPixelu(s, (r, g, b, i) => {
    const x = i % w + 0.5, y = (i / w | 0) + 0.5, bx = Math.floor(x / c), by = Math.floor(y / c), j = (by * nx + bx) * 4;
    let R = prum[j] / prum[j + 3], Gg = prum[j + 1] / prum[j + 3], B = prum[j + 2] / prum[j + 3];
    const lx = x - bx * c, ly = y - by * c;
    if (p.tvar === 'kruh') {
      const t = omez(c * 0.46 - Math.hypot(lx - c / 2, ly - c / 2) + 0.5, 0, 1), sv = 1 + 0.25 * omez(1 - Math.hypot(lx - c * 0.35, ly - c * 0.35) / (c * 0.3), 0, 1);
      return [20 + (R * sv - 20) * t, 20 + (Gg * sv - 20) * t, 20 + (B * sv - 20) * t];
    }
    if (spara) { const e = Math.min(lx, ly, c - lx, c - ly); if (e < spara) return [200, 196, 188]; const sv = 1 + 0.12 * (1 - (lx + ly) / c); return [R * sv, Gg * sv, B * sv]; }
    return [R, Gg, B];
  });
});
function voronoi(s, vel, k, seed) {
  const w = s.width, h = s.height, c = Math.max(3, vel * k), nx = Math.ceil(w / c) + 1, ny = Math.ceil(h / c) + 1, rnd = nahodne(seed);
  const sx = new Float32Array(nx * ny), sy = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { sx[j * nx + i] = (i + 0.1 + rnd() * 0.8) * c; sy[j * nx + i] = (j + 0.1 + rnd() * 0.8) * c; }
  const id = new Int32Array(w * h), okraj = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = Math.floor(x / c), gy = Math.floor(y / c);
    let d1 = 1e18, d2 = 1e18, b1 = 0, b2 = 0;
    for (let j = gy - 1; j <= gy + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) {
      if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      const q = j * nx + i, dd = (x + 0.5 - sx[q]) ** 2 + (y + 0.5 - sy[q]) ** 2;
      if (dd < d1) { d2 = d1; b2 = b1; d1 = dd; b1 = q; } else if (dd < d2) { d2 = dd; b2 = q; }
    }
    id[y * w + x] = b1;
    // vzdálenost k hranici buněk (kolmice na osu dvou nejbližších středů)
    const ax = sx[b2] - sx[b1], ay = sy[b2] - sy[b1], l = Math.hypot(ax, ay) || 1;
    okraj[y * w + x] = ((x + 0.5 - (sx[b1] + sx[b2]) / 2) * -ax + (y + 0.5 - (sy[b1] + sy[b2]) / 2) * -ay) / l;
  }
  const sum = new Float64Array(nx * ny * 4), d = s.data;
  for (let i = 0; i < w * h; i++) { const q = id[i] * 4; sum[q] += d[i * 4]; sum[q + 1] += d[i * 4 + 1]; sum[q + 2] += d[i * 4 + 2]; sum[q + 3]++; }
  return { id, okraj, sum, c };
}
pridej('grafika', 'vitraz', '⛪ Vitráž', 'Barevná skla v olověných rámech (bez rámů = krystalizace).', [
  { id: 'velikost', nazev: 'Velikost skel', min: 6, max: 80, vychozi: 22, jednotka: 'px' },
  { id: 'olovo', nazev: 'Šířka olova', min: 0, max: 8, krok: 0.5, vychozi: 2, jednotka: 'px' },
  { id: 'sytost', nazev: 'Sytost', min: 0, max: 100, vychozi: 35 }
], (s, p, k) => {
  const { id, okraj, sum, c } = voronoi(s, p.velikost, k, 31), ol = p.olovo * k / 2, fs = 1 + p.sytost / 100;
  return poPixelu(s, (r, g, b, i) => {
    const q = id[i] * 4, n = sum[q + 3];
    let [R, Gg, B] = syt(sum[q] / n, sum[q + 1] / n, sum[q + 2] / n, fs);
    if (ol > 0) {
      const sv = 1 + 0.18 * omez(okraj[i] / (c * 0.5), 0, 1);
      R *= sv; Gg *= sv; B *= sv;
      const t = omez(ol - okraj[i] + 0.5, 0, 1);
      R += (28 - R) * t; Gg += (26 - Gg) * t; B += (24 - B) * t;
    }
    return [R, Gg, B];
  });
});
pridej('grafika', 'ascii', '🔤 ASCII art', 'Obraz poskládaný ze znaků.', [
  { id: 'velikost', nazev: 'Velikost znaku', min: 4, max: 30, vychozi: 10, jednotka: 'px' },
  { id: 'barvy', nazev: 'Barvy', typ: 'volba', vychozi: 'barevne', moznosti: [['barevne', 'barevné na černé'], ['zelene', 'zelený terminál'], ['papir', 'černé na bílé']] },
  { id: 'sada', nazev: 'Znaky', typ: 'volba', vychozi: 'klasika', moznosti: [['klasika', ' .:-=+*#%@'], ['bloky', ' ░▒▓█'], ['binar', ' 01']] }
], (s, p, k) => {
  const w = s.width, h = s.height, c = Math.max(3, p.velikost * k), cw = c * 0.62;
  const pl = G.FF_platno ? G.FF_platno(w, h) : null;
  if (!pl) return s;
  const ctx = pl.getContext('2d'), sada = { klasika: ' .:-=+*#%@', bloky: ' ░▒▓█', binar: ' 01' }[p.sada] || ' .:-=+*#%@';
  ctx.fillStyle = p.barvy === 'papir' ? '#fff' : '#000'; ctx.fillRect(0, 0, w, h);
  ctx.font = `bold ${c}px ui-monospace, Consolas, monospace`; ctx.textBaseline = 'top';
  const zdroj = rozmazObr(s, c * 0.3), v = [0, 0, 0, 0];
  for (let y = 0; y < h; y += c) for (let x = 0; x < w; x += cw) {
    vzorek(zdroj, x + cw / 2, y + c / 2, v);
    let l = (0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) / 255;
    if (p.barvy === 'papir') l = 1 - l;
    const ch = sada[Math.min(sada.length - 1, Math.floor(l * sada.length))];
    if (ch === ' ') continue;
    ctx.fillStyle = p.barvy === 'barevne' ? `rgb(${v[0] | 0},${v[1] | 0},${v[2] | 0})` : p.barvy === 'zelene' ? `rgb(40,${(120 + 135 * l) | 0},60)` : '#111';
    ctx.fillText(ch, x, y);
  }
  const id = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data: id.data };
});
pridej('grafika', 'neon', '🌈 Neonové hrany', 'Zářící barevné obrysy na tmavém pozadí.', [
  { id: 'sila', nazev: 'Síla', min: 20, max: 300, vychozi: 120, jednotka: '%' },
  { id: 'zar', nazev: 'Záře', min: 0, max: 100, vychozi: 60 }
], (s, p, k) => {
  const w = s.width, h = s.height, b = rozmazObr(s, 1 * k), [r, g, bb] = kanaly(b), out = [r, g, bb].map(ch => { const { gx, gy } = sobel(ch, w, h); return gx.map((v, i) => Math.hypot(v, gy[i]) * p.sila / 100 * 0.6); });
  const zar = out.map(ch => rozmaz(ch, w, h, 5 * k)), z = p.zar / 100 * 1.5;
  return zKanalu(s, ...out.map((ch, c) => ch.map((v, i) => v + zar[c][i] * z)));
});
pridej('grafika', 'relief', '🪨 Reliéf', 'Obraz vytlačený do kovu nebo kamene.', [
  { id: 'sila', nazev: 'Hloubka', min: 20, max: 400, vychozi: 150, jednotka: '%' },
  { id: 'uhel', nazev: 'Směr světla', min: 0, max: 359, vychozi: 135, jednotka: '°' },
  { id: 'barva', nazev: 'Zachovat barvy', min: 0, max: 100, vychozi: 0 }
], (s, p, k) => {
  const w = s.width, h = s.height, L = rozmaz(jasy(s), w, h, 0.7 * k), { gx, gy } = sobel(L, w, h), a = p.uhel * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), f = p.sila / 100 * 0.35, bz = p.barva / 100;
  return poPixelu(s, (r, g, b, i) => {
    const e = (gx[i] * ca + gy[i] * sa) * f, v = 128 + e;
    return [r, g, b].map(c => (1 - bz) * v + bz * (c + e));
  });
});

// ── Efekty
pridej('efekty', 'glitch', '📺 Glitch', 'Rozsypaný digitální signál – posunuté pruhy a barevné kanály.', [
  { id: 'sila', nazev: 'Síla', min: 0, max: 100, vychozi: 50 },
  { id: 'seed', nazev: 'Náhoda', min: 1, max: 99, vychozi: 7 }
], (s, p, k) => {
  const w = s.width, h = s.height, rnd = nahodne(p.seed * 7919), f = p.sila / 100, o = novy(w, h), d = s.data, e = o.data;
  const posun = new Float32Array(h);
  let y = 0;
  while (y < h) { const vy = Math.max(1, (rnd() * 40 + 2) * k), sh = rnd() < 0.35 * f ? (rnd() - 0.5) * w * 0.25 * f : 0; for (let i = 0; i < vy && y < h; i++, y++) posun[y] = sh; }
  const ch = Math.round(12 * f * k);
  for (y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x - posun[y], i = (y * w + x) * 4;
    const pr = (xx, c) => d[(y * w + omez(Math.round(xx), 0, w - 1)) * 4 + c];
    e[i] = pr(sx + ch, 0); e[i + 1] = pr(sx, 1); e[i + 2] = pr(sx - ch, 2); e[i + 3] = d[i + 3];
  }
  const bloky = Math.round(10 * f);
  for (let b = 0; b < bloky; b++) {
    const bx = rnd() * w | 0, by = rnd() * h | 0, bw = (rnd() * 120 + 20) * k | 0, bh = (rnd() * 18 + 4) * k | 0;
    for (let yy = by; yy < Math.min(h, by + bh); yy++) for (let xx = bx; xx < Math.min(w, bx + bw); xx++) { const i = (yy * w + xx) * 4, t = e[i]; e[i] = e[i + 2]; e[i + 2] = t; e[i + 1] = 255 - e[i + 1]; }
  }
  return o;
});
pridej('efekty', 'vhs', '📼 VHS kazeta', 'Rozmazaná barva, řádky, šum a vlnění obrazu.', [
  { id: 'sila', nazev: 'Síla', min: 0, max: 100, vychozi: 60 }
], (s, p, k) => {
  const w = s.width, h = s.height, f = p.sila / 100, rnd = nahodne(13), d = s.data;
  const [r, g, b] = kanaly(s), Y = new Float32Array(w * h), U = new Float32Array(w * h), V = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { Y[i] = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i]; U[i] = b[i] - Y[i]; V[i] = r[i] - Y[i]; }
  const U2 = rozmaz(U, w, h, 6 * k * f + 0.5, true), V2 = rozmaz(V, w, h, 6 * k * f + 0.5, true), sh = Math.round(4 * k * f);
  const o = novy(w, h), e = o.data, perioda = Math.max(2, Math.round(3 * k)), pasmo = h * (0.7 + rnd() * 0.2);
  for (let y = 0; y < h; y++) {
    const vln = Math.sin(y / (h / 6)) * 2 * k * f + (Math.abs(y - pasmo) < 12 * k ? (rnd() - 0.5) * 30 * k * f : 0);
    const rad = (y % perioda) === 0 ? 1 - 0.25 * f : 1;
    for (let x = 0; x < w; x++) {
      const sx = omez(Math.round(x - vln), 0, w - 1), i = y * w + sx, ci = y * w + omez(sx - sh, 0, w - 1), n = (rnd() - 0.5) * 30 * f;
      const yy = Y[i] + n, R = yy + V2[ci] * 1.1, B = yy + U2[ci], Gg = (yy - 0.299 * R - 0.114 * B) / 0.587;
      const j = (y * w + x) * 4;
      e[j] = (R * 1.04 + 8) * rad; e[j + 1] = Gg * rad; e[j + 2] = (B * 0.95 + 10) * rad; e[j + 3] = d[j + 3];
    }
  }
  return o;
});
pridej('efekty', 'crt', '🖥️ CRT obrazovka', 'Starý monitor: maska luminoforů, řádky a vypouklé sklo.', [
  { id: 'velikost', nazev: 'Velikost bodu', min: 2, max: 10, vychozi: 3, jednotka: 'px' },
  { id: 'zakriveni', nazev: 'Zakřivení', min: 0, max: 100, vychozi: 30 }
], (s, p, k) => {
  const w = s.width, h = s.height, z = p.zakriveni / 100 * 0.25, c = Math.max(1, p.velikost * k);
  const o = deformuj(s, (x, y, out) => {
    const u = x / w * 2 - 1, v = y / h * 2 - 1, r2 = u * u + v * v;
    out[0] = (u * (1 + z * r2) + 1) / 2 * w; out[1] = (v * (1 + z * r2) + 1) / 2 * h;
  });
  const d = o.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, u = x / w * 2 - 1, v = y / h * 2 - 1, r2 = u * u + v * v;
    const ux = Math.abs(u * (1 + z * r2)), vy = Math.abs(v * (1 + z * r2));
    if (ux > 1 || vy > 1) { d[i] = d[i + 1] = d[i + 2] = 8; continue; }
    const sl = Math.floor(x / c) % 3, radek = 0.65 + 0.35 * Math.sin((y / c) * Math.PI) ** 2, vin = 1 - 0.5 * smooth(0.6, 1.4, r2);
    const m = [sl === 0 ? 1.35 : 0.7, sl === 1 ? 1.35 : 0.7, sl === 2 ? 1.35 : 0.7];
    for (let ch = 0; ch < 3; ch++) d[i + ch] = d[i + ch] * m[ch] * radek * vin * 1.1;
  }
  return o;
});
pridej('efekty', 'tiltshift', '🏙️ Miniatura (tilt-shift)', 'Rozostření mimo ostrý pás – krajina vypadá jako model.', [
  { id: 'poloha', nazev: 'Poloha ostrého pásu', min: 0, max: 100, vychozi: 55, jednotka: '%' },
  { id: 'sirka', nazev: 'Šířka pásu', min: 2, max: 60, vychozi: 15, jednotka: '%' },
  { id: 'rozmazani', nazev: 'Rozmazání', min: 1, max: 30, vychozi: 10, jednotka: 'px' }
], (s, p, k) => {
  const w = s.width, h = s.height, bl = rozmazObr(s, p.rozmazani * k), st = p.poloha / 100 * h, sir = p.sirka / 100 * h / 2;
  return poPixelu(s, (r, g, b, i) => {
    const y = (i / w) | 0, t = smooth(sir, sir + h * 0.18, Math.abs(y - st)), j = i * 4;
    return syt(skrivka(r + (bl.data[j] - r) * t, 0.3), skrivka(g + (bl.data[j + 1] - g) * t, 0.3), skrivka(b + (bl.data[j + 2] - b) * t, 0.3), 1.3);
  });
});
pridej('efekty', 'vir', '🌀 Vír', 'Obraz zatočený kolem středu.', [
  { id: 'uhel', nazev: 'Úhel', min: -720, max: 720, vychozi: 240, jednotka: '°' },
  { id: 'polomer', nazev: 'Poloměr', min: 10, max: 100, vychozi: 60, jednotka: '%' }
], (s, p) => {
  const w = s.width, h = s.height, cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 * p.polomer / 100 * 1.4, A = p.uhel * Math.PI / 180;
  return deformuj(s, (x, y, o) => {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
    if (r >= R) { o[0] = x; o[1] = y; return; }
    const a = A * (1 - r / R) ** 2, c = Math.cos(a), sn = Math.sin(a);
    o[0] = cx + dx * c - dy * sn; o[1] = cy + dx * sn + dy * c;
  });
});
pridej('efekty', 'boule', '🔮 Boule / smrštění', 'Vypoukne nebo vtáhne střed obrazu.', [
  { id: 'sila', nazev: 'Síla (záporná = smrštění)', min: -80, max: 150, vychozi: 70, jednotka: '%' },
  { id: 'polomer', nazev: 'Poloměr', min: 10, max: 100, vychozi: 60, jednotka: '%' }
], (s, p) => {
  const w = s.width, h = s.height, cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 * p.polomer / 100 * 1.4, e = 1 + p.sila / 100;
  return deformuj(s, (x, y, o) => {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
    if (r >= R || r === 0) { o[0] = x; o[1] = y; return; }
    const f = Math.pow(r / R, e - 1);
    o[0] = cx + dx * f; o[1] = cy + dy * f;
  });
});
pridej('efekty', 'vlny', '🌊 Vlny', 'Obraz zvlněný jako odraz na vodě.', [
  { id: 'amplituda', nazev: 'Amplituda', min: 1, max: 40, vychozi: 8, jednotka: 'px' },
  { id: 'delka', nazev: 'Délka vlny', min: 10, max: 300, vychozi: 70, jednotka: 'px' }
], (s, p, k) => {
  const A = p.amplituda * k, L = p.delka * k;
  return deformuj(s, (x, y, o) => { o[0] = x + A * Math.sin(2 * Math.PI * y / L); o[1] = y + A * Math.sin(2 * Math.PI * x / L * 0.8); });
});
pridej('efekty', 'kaleidoskop', '❄️ Kaleidoskop', 'Zrcadlené výseče kolem středu.', [
  { id: 'vysece', nazev: 'Počet výsečí', min: 2, max: 16, vychozi: 6 },
  { id: 'otoceni', nazev: 'Otočení', min: 0, max: 359, vychozi: 0, jednotka: '°' },
  { id: 'zoom', nazev: 'Přiblížení', min: 30, max: 200, vychozi: 100, jednotka: '%' }
], (s, p) => {
  const w = s.width, h = s.height, cx = w / 2, cy = h / 2, seg = Math.PI / p.vysece, rot = p.otoceni * Math.PI / 180, z = 100 / p.zoom;
  return deformuj(s, (x, y, o) => {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) * z;
    let a = Math.atan2(dy, dx) + Math.PI; a = a % (2 * seg); if (a > seg) a = 2 * seg - a;
    a += rot;
    o[0] = cx + r * Math.cos(a); o[1] = cy + r * Math.sin(a);
    // odraz od okrajů místo ořezu
    const zr = (v, m) => { v = ((v % (2 * m)) + 2 * m) % (2 * m); return v > m ? 2 * m - v : v; };
    o[0] = zr(o[0], w); o[1] = zr(o[1], h);
  });
});
pridej('efekty', 'zrcadlo', '🪞 Zrcadlení', 'Jedna polovina obrazu se zrcadlí do druhé.', [
  { id: 'smer', nazev: 'Směr', typ: 'volba', vychozi: 'lp', moznosti: [['lp', 'levá → pravá'], ['pl', 'pravá → levá'], ['hd', 'horní → dolní'], ['dh', 'dolní → horní']] }
], (s, p) => {
  const w = s.width, h = s.height;
  return deformuj(s, (x, y, o) => {
    o[0] = x; o[1] = y;
    if (p.smer === 'lp' && x > w / 2) o[0] = w - x;
    if (p.smer === 'pl' && x < w / 2) o[0] = w - x;
    if (p.smer === 'hd' && y > h / 2) o[1] = h - y;
    if (p.smer === 'dh' && y < h / 2) o[1] = h - y;
  });
});
pridej('efekty', 'planeta', '🪐 Malá planeta', 'Panorama stočené do kulaté planetky (nejlíp s krajinou a nebem).', [
  { id: 'otoceni', nazev: 'Otočení', min: 0, max: 359, vychozi: 0, jednotka: '°' },
  { id: 'velikost', nazev: 'Velikost planety', min: 30, max: 200, vychozi: 100, jednotka: '%' }
], (s, p) => {
  const w = s.width, h = s.height, cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 * p.velikost / 100, rot = p.otoceni / 360;
  return deformuj(s, (x, y, o) => {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) / R;
    let a = (Math.atan2(dx, dy) + Math.PI) / (2 * Math.PI) + rot; a -= Math.floor(a);
    o[0] = a * w; o[1] = h * (1 - Math.min(1, r) ** 0.9) + 0.5;
  });
});

const KATEGORIE = [
  ['barvy', '🎨 Barvy a tóny'], ['malba', '🖌️ Malba'], ['kresba', '✏️ Kresba'], ['grafika', '💥 Grafika'], ['efekty', '🌀 Efekty']
];
const vychozi = f => Object.fromEntries(f.param.map(q => [q.id, q.vychozi]));
const najdi = id => F.find(f => f.id === id);

// jeden krok: {id, p, sila 0–100}
function aplikuj(s, krok, k) {
  const f = najdi(krok.id);
  if (!f) return s;
  const o = f.fn(s, Object.assign(vychozi(f), krok.p), k);
  const sila = krok.sila ?? 100;
  if (sila >= 100 || o === s) return o;
  const a = sila / 100, d = o.data, z = s.data;
  for (let i = 0; i < d.length; i++) d[i] = z[i] + (d[i] - z[i]) * a;
  return o;
}
// celý řetězec: úpravy → kroky
function zpracuj(s, upr, kroky, k) {
  let o = upravy(s, upr || {}, k);
  for (const kr of kroky || []) o = aplikuj(o, kr, k);
  return o;
}

G.FOTOFILTRY = { FILTRY: F, KATEGORIE, UPRAVY, vychozi, vychoziUpravy, najdi, upravy, aplikuj, zpracuj, novy, kopie };
})(typeof self !== 'undefined' ? self : globalThis);
