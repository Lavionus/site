/* Z náčrtu do 3D – chytré přichytávání (bez DOM, jde v node). Potřebuje geom.js.
   N.pripravPrichyt(prvky, voditka) → mezipaměť {prim, body} (přepočítat po změně kresby).
   N.chytBod(C, x, y, o) → {x, y, druh, popis, stopy: [[x1, y1, x2, y2]]}
     o = {tol (mm), volby: {konce, stredy, pruseciky, kvadranty, voditka, zarovnani, naCare, uhly, mrizka},
          krok (mm), predchozi: [x, y] | null, vyjmout: Set id prvků (třeba právě tažených), vypnuto}
   Pořadí: body (konec, průsečík, střed, střed kružnice, kvadrant) → vodicí linka → zarovnání s body
   (svisle/vodorovně, i s předchozím bodem) → bod na čáře → úhel po 15° od předchozího bodu → mřížka. */
var N3D = globalThis.N3D = globalThis.N3D || {};
(function (N) {
  'use strict';
  const { hypot, round, abs, atan2, cos, sin, PI, min } = Math;
  N.VOLBY_PRICHYTU = {
    konce: 'Konce a vrcholy', pruseciky: 'Průsečíky', stredy: 'Středy úseček a oblouků', kvadranty: 'Kvadranty kružnic',
    voditka: 'Vodicí linky', zarovnani: 'Zarovnání s body', naCare: 'Na čáře', uhly: 'Úhly po 15°', mrizka: 'Mřížka',
  };
  const POPIS = { konec: 'konec', prusecik: 'průsečík', stred: 'střed', stredKruhu: 'střed kružnice', kvadrant: 'kvadrant' };
  const VAHA = { konec: 1, prusecik: 1, stredKruhu: 1, stred: 1.15, kvadrant: 1.2 };
  const SKUPINA = { konec: 'konce', prusecik: 'pruseciky', stred: 'stredy', stredKruhu: 'stredy', kvadrant: 'kvadranty' };
  const MAX_PRIM_PRUSECIKY = 700;

  N.pripravPrichyt = function (prvky, voditka) {
    const prim = [], body = [];
    for (const p of prvky || []) {
      if (p.druh === 'kota') continue;
      const ps = N.primitivaPrvku(p);
      prim.push(...ps);
      if (p.druh === 'cara') for (const b of p.body) body.push({ x: b.x, y: b.y, druh: 'konec', prvek: p.id });
      else if (p.druh === 'kruh') {
        body.push({ x: p.x, y: p.y, druh: 'stredKruhu', prvek: p.id });
        for (let k = 0; k < 4; k++) body.push({ x: p.x + p.r * cos(k * PI / 2), y: p.y + p.r * sin(k * PI / 2), druh: 'kvadrant', prvek: p.id });
      }
      for (const q of ps) {
        if (q.typ === 'k') continue;
        const [mx, my] = N.bodPrimitiva(q, 0.5);
        body.push({ x: mx, y: my, druh: 'stred', prvek: p.id });
        if (q.typ === 'o') {
          body.push({ x: q.c[0], y: q.c[1], druh: 'stredKruhu', prvek: p.id });
          for (let k = 0; k < 4; k++) {
            const x = q.c[0] + q.r * cos(k * PI / 2), y = q.c[1] + q.r * sin(k * PI / 2), t = N.parametr(q, x, y);
            if (t > 1e-6 && t < 1 - 1e-6) body.push({ x, y, druh: 'kvadrant', prvek: p.id });
          }
        }
      }
    }
    for (const v of voditka || []) prim.push(N.primitivumVoditka(v));
    // průsečíky (u velké kresby jen prvních MAX_PRIM_PRUSECIKY primitiv – O(n²))
    const n = min(prim.length, MAX_PRIM_PRUSECIKY);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const p = prim[i], q = prim[j];
      if (p.prvek === q.prvek && !p.voditko && abs(p.i - q.i) <= 1) continue;    // sousední úseky téže čáry = vrchol
      for (const s of N.pruseciky(p, q)) body.push({ x: s.x, y: s.y, druh: 'prusecik', prvek: p.voditko ? null : p.prvek, prvek2: q.voditko ? null : q.prvek });
    }
    return { prim, body };
  };

  N.chytBod = function (C, x, y, o = {}) {
    const vol = Object.assign({ konce: true, pruseciky: true, stredy: true, kvadranty: true, voditka: true, zarovnani: true, naCare: true, uhly: true, mrizka: true }, o.volby);
    const tol = o.tol || 1.5, vyj = o.vyjmout || new Set(), krok = o.krok || 5;
    if (o.vypnuto || !C) return { x, y, druh: null };
    const smi = b => !vyj.has(b.prvek) && !(b.prvek2 && vyj.has(b.prvek2));
    // 1) body
    let nej = null, sk = Infinity;
    for (const b of C.body) {
      if (!vol[SKUPINA[b.druh]] || !smi(b)) continue;
      const d = hypot(b.x - x, b.y - y);
      if (d <= tol && d * VAHA[b.druh] < sk) { sk = d * VAHA[b.druh]; nej = b; }
    }
    if (nej) return { x: nej.x, y: nej.y, druh: nej.druh, popis: POPIS[nej.druh], stopy: [] };
    // 2) vodicí linka
    if (vol.voditka) {
      let v = null;
      for (const q of C.prim) if (q.voditko) { const r = N.nejblizsiNaPrimitivu(q, x, y); if (r.d <= tol && (!v || r.d < v.d)) v = r; }
      if (v) return { x: v.x, y: v.y, druh: 'voditko', popis: 'vodicí linka', stopy: [] };
    }
    // 3) zarovnání svisle / vodorovně s body (konce, středy kružnic, předchozí bod)
    let zx = null, zy = null;
    if (vol.zarovnani) {
      const kand = C.body.filter(b => (b.druh === 'konec' || b.druh === 'stredKruhu') && smi(b));
      if (o.predchozi) kand.push({ x: o.predchozi[0], y: o.predchozi[1] });
      const tz = tol * 0.8;
      for (const b of kand) {
        const dx = abs(b.x - x), dy = abs(b.y - y);
        if (dx <= tz && dy > tol && (!zx || dx < abs(zx.x - x))) zx = b;
        if (dy <= tz && dx > tol && (!zy || dy < abs(zy.y - y))) zy = b;
      }
    }
    // 4) na čáře (bez zarovnání)
    if (!zx && !zy && vol.naCare) {
      let c = null;
      for (const q of C.prim) if (!q.voditko && !vyj.has(q.prvek)) { const r = N.nejblizsiNaPrimitivu(q, x, y); if (r.d <= tol * 0.8 && (!c || r.d < c.d)) c = r; }
      if (c) return { x: c.x, y: c.y, druh: 'naCare', popis: 'na čáře', stopy: [] };
    }
    const mr = v => vol.mrizka ? round(v / krok) * krok : v;
    if (zx || zy) {
      const rx = zx ? zx.x : mr(x), ry = zy ? zy.y : mr(y), stopy = [];
      if (zx) stopy.push([zx.x, zx.y, rx, ry]);
      if (zy) stopy.push([zy.x, zy.y, rx, ry]);
      return { x: rx, y: ry, druh: 'zarovnani', popis: zx && zy ? 'zarovnání ⊥' : 'zarovnání', stopy };
    }
    // 5) úhel po 15° od předchozího bodu (vzdálenost na krok mřížky)
    if (vol.uhly && o.predchozi) {
      const [px, py] = o.predchozi, d = hypot(x - px, y - py);
      if (d > tol) {
        const u = atan2(y - py, x - px), k = round(u / (PI / 12)) * (PI / 12);
        if (abs(u - k) < 2.5 * PI / 180 && round(k / (PI / 2)) * (PI / 2) !== k) {      // vodorovně/svisle řeší mřížka a zarovnání
          const L = vol.mrizka ? Math.max(krok, round(d / krok) * krok) : d;
          let st = -k * 180 / PI; if (st < 0) st += 360;
          return { x: px + L * cos(k), y: py + L * sin(k), druh: 'uhel', popis: 'úhel ' + round(st) + '°', stopy: [[px, py, px + L * cos(k), py + L * sin(k)]] };
        }
      }
    }
    // 6) mřížka
    return { x: mr(x), y: mr(y), druh: vol.mrizka ? 'mrizka' : null, popis: '', stopy: [] };
  };

  if (typeof module !== 'undefined') module.exports = N;
})(N3D);
