/* ============================================================
   Přípravky pro pilu a vrtačku – jádro (bez DOM, čisté funkce)
   Jednotky mm, úhly ve stupních (není-li řečeno jinak).
   Model výsledku navrh(projekt) → {rezim, dily, vysledky, kusovnik, bezpecnost, varovani, vykresy, sestava, info}
   Díl:
     deska: {id, nazev, druh:'deska', material, tl, ks, w, h, obrys:[[x,y]], otvory:[{x,y,d,zap}], vyrezy:[[...]], cary:[{b,d,popis}], um, pohyb}
     tisk:  {id, nazev, druh:'tisk', material, ks, csg, pohledy:[Vykres], um, pohyb, napis, pozn}
   um (umístění do 3D): {o:[x,y,z], u:[..], v:[..]} – lokální x → u, y → v, z → n = u × v.
   Svět 3D: x vpravo, y od obsluhy (směr posuvu), z nahoru; stůl stroje z = 0.
   CSG uzly: {p:'box',a,b} {p:'cyl',osa,c,r,r2,z0,z1} {p:'prism',b,z0,z1} {p:'hex',osa,c,s,z0,z1} {op:'add'|'sub',a:[...]}
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;
  const r2 = (x) => Math.round(x * 100) / 100;
  const r1 = (x) => Math.round(x * 10) / 10;
  const cislo = (v, d) => { const x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : d; };
  const omez = (x, a, b) => Math.max(a, Math.min(b, x));
  const cz = (x, d) => (x == null || !isFinite(x) ? '–' : String(Math.round(x * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).replace('.', ',').replace('-', '−'));

  /* ---------------- 2D geometrie ---------------- */
  const obd = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  function plocha(b) { let s = 0; for (let i = 0; i < b.length; i++) { const p = b[i], q = b[(i + 1) % b.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; }
  const ccw = (b) => (plocha(b) < 0 ? b.slice().reverse() : b);
  function kruhPoly(cx, cy, r, n) { n = n || Math.max(16, Math.min(72, Math.round(r * 3))); const o = []; for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return o; }
  function zaoblObd(x0, y0, x1, y1, r, n) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2 - 1e-6, (y1 - y0) / 2 - 1e-6)); n = n || 8;
    if (r < 0.01) return obd(x0, y0, x1, y1);
    const o = [], roh = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const a = (a0 + 90 * i / n) * RAD; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    roh(x1 - r, y0 + r, -90); roh(x1 - r, y1 - r, 0); roh(x0 + r, y1 - r, 90); roh(x0 + r, y0 + r, 180);
    return o;
  }
  /** drážka se zaoblenými konci mezi středy (ax, ay) a (bx, by), šířka w */
  function obround(ax, ay, bx, by, w, n) {
    n = n || 10; const r = w / 2, u = Math.atan2(by - ay, bx - ax), o = [];
    for (let i = 0; i <= n; i++) { const a = u - Math.PI / 2 + Math.PI * i / n; o.push([bx + r * Math.cos(a), by + r * Math.sin(a)]); }
    for (let i = 0; i <= n; i++) { const a = u + Math.PI / 2 + Math.PI * i / n; o.push([ax + r * Math.cos(a), ay + r * Math.sin(a)]); }
    return o;
  }
  const posun = (b, dx, dy) => b.map((p) => [p[0] + dx, p[1] + dy]);
  function bbox(b) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of b) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }
  /** oblouková drážka (střed cx, cy, poloměr R, úhly a0..a1 ve stupních, šířka w) */
  function obloukDrazka(cx, cy, R, a0, a1, w, n) {
    n = n || 24; const o = [], r = w / 2;
    for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * RAD; o.push([cx + (R + r) * Math.cos(a), cy + (R + r) * Math.sin(a)]); }
    for (let i = 0; i <= 8; i++) { const a = a1 * RAD + Math.PI * i / 8, ex = cx + R * Math.cos(a1 * RAD), ey = cy + R * Math.sin(a1 * RAD); o.push([ex + r * Math.cos(a), ey + r * Math.sin(a)]); }
    for (let i = n; i >= 0; i--) { const a = (a0 + (a1 - a0) * i / n) * RAD; o.push([cx + (R - r) * Math.cos(a), cy + (R - r) * Math.sin(a)]); }
    for (let i = 0; i <= 8; i++) { const a = a0 * RAD + Math.PI + Math.PI * i / 8, ex = cx + R * Math.cos(a0 * RAD), ey = cy + R * Math.sin(a0 * RAD); o.push([ex + r * Math.cos(a), ey + r * Math.sin(a)]); }
    return o;
  }

  /* ---------------- CSG ---------------- */
  const C = {
    box: (a, b) => ({ p: 'box', a: a.slice(), b: b.slice() }),
    cyl: (osa, c, r, z0, z1, r2v) => ({ p: 'cyl', osa, c: c.slice(), r, r2: r2v == null ? r : r2v, z0, z1 }),
    prism: (b, z0, z1) => ({ p: 'prism', b: ccw(b), z0, z1 }),
    hex: (osa, c, s, z0, z1) => ({ p: 'hex', osa, c: c.slice(), s, z0, z1 }),
    add: (...a) => ({ op: 'add', a: a.flat().filter(Boolean) }),
    sub: (a, ...b) => ({ op: 'sub', a: [a].concat(b.flat().filter(Boolean)) }),
  };
  /** zrcadlení CSG v ose x (x → X − x) */
  function zrcadliX(n, X) {
    if (n.op) return { op: n.op, a: n.a.map((q) => zrcadliX(q, X)) };
    const q = JSON.parse(JSON.stringify(n));
    if (q.p === 'box') { const a = X - n.b[0], b = X - n.a[0]; q.a[0] = a; q.b[0] = b; }
    else if (q.p === 'prism') q.b = ccw(n.b.map((p) => [X - p[0], p[1]]));
    else if (q.p === 'cyl' || q.p === 'hex') {
      if (q.osa === 'z' || q.osa === 'y') q.c[0] = X - n.c[0];
      else { const z0 = X - n.z1, z1 = X - n.z0; q.z0 = z0; q.z1 = z1; if (q.p === 'cyl') { q.r = n.r2; q.r2 = n.r; } }
    }
    return q;
  }
  /** obalový kvádr CSG (přibližně – odečtené tvary nezmenšují) */
  function bboxCSG(n) {
    if (n.op === 'sub') return bboxCSG(n.a[0]);
    if (n.op === 'add') { const b = n.a.map(bboxCSG); return { a: [0, 1, 2].map((i) => Math.min(...b.map((q) => q.a[i]))), b: [0, 1, 2].map((i) => Math.max(...b.map((q) => q.b[i]))) }; }
    if (n.p === 'box') return { a: n.a, b: n.b };
    if (n.p === 'prism') { const bb = bbox(n.b); return { a: [bb.x0, bb.y0, n.z0], b: [bb.x1, bb.y1, n.z1] }; }
    const r = n.p === 'hex' ? n.s / Math.sqrt(3) : Math.max(n.r, n.r2);
    if (n.osa === 'z') return { a: [n.c[0] - r, n.c[1] - r, n.z0], b: [n.c[0] + r, n.c[1] + r, n.z1] };
    if (n.osa === 'x') return { a: [n.z0, n.c[0] - r, n.c[1] - r], b: [n.z1, n.c[0] + r, n.c[1] + r] };
    return { a: [n.c[0] - r, n.z0, n.c[1] - r], b: [n.c[0] + r, n.z1, n.c[1] + r] };
  }

  /* ---------------- výkres (prvky v mm, y nahoru) ---------------- */
  function Vykres(id, nazev, popis) { this.id = id; this.nazev = nazev; this.popis = popis || ''; this.prvky = []; }
  Vykres.prototype = {
    l(b, o) { o = o || {}; this.prvky.push({ t: 'l', b, s: o.s || 0.35, c: o.c || '#000000', d: o.d, z: o.z, v: o.v || 'obrys', f: o.f }); return this; },
    poly(b, o) { return this.l(b, Object.assign({ z: true }, o || {})); },
    obd(x0, y0, x1, y1, o) { return this.poly(obd(x0, y0, x1, y1), o); },
    k(x, y, r, o) { o = o || {}; this.prvky.push({ t: 'k', x, y, r, s: o.s || 0.3, c: o.c || '#000000', d: o.d, f: o.f, v: o.v || 'otvory' }); return this; },
    t(x, y, txt, o) { o = o || {}; this.prvky.push({ t: 'txt', x, y, txt: String(txt), h: o.h || 3.5, a: o.a || 'l', u: o.u || 0, c: o.c || '#000000', v: o.v || 'popis' }); return this; },
    /** kóta mezi body a, b; off = odsazení kolmo (kladné = vlevo od směru a→b) */
    kota(a, b, off, txt, o) { o = o || {}; this.prvky.push({ t: 'kota', a, b, off, txt: txt == null ? cz(Math.hypot(b[0] - a[0], b[1] - a[1]), 1) : String(txt), h: o.h || 3.2, c: o.c || '#1f5fa8', v: 'koty' }); return this; },
    bbox() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const p = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
      for (const e of this.prvky) {
        if (e.t === 'l') e.b.forEach((q) => p(q[0], q[1]));
        else if (e.t === 'k') { p(e.x - e.r, e.y - e.r); p(e.x + e.r, e.y + e.r); }
        else if (e.t === 'txt') { const w = e.txt.length * e.h * 0.55; p(e.x - (e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0), e.y - e.h * 0.3); p(e.x + (e.a === 'l' ? w : e.a === 'c' ? w / 2 : 0), e.y + e.h); }
        else if (e.t === 'kota') { const n = normala(e.a, e.b); for (const q of [e.a, e.b]) { p(q[0], q[1]); p(q[0] + n[0] * (e.off + Math.sign(e.off || 1) * (e.h + 2)), q[1] + n[1] * (e.off + Math.sign(e.off || 1) * (e.h + 2))); } }
      }
      if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 10, y1: 10 };
      return { x0, y0, x1, y1 };
    },
  };
  function normala(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; }

  /** kreslení obrysu desky do výkresu s posunem (x, y) a přepočtem lokálních souřadnic */
  function kresliDesku(V, d, x, y, o) {
    o = o || {}; const T = (b) => b.map((q) => [x + q[0], y + q[1]]);
    V.poly(T(d.obrys), { s: 0.45, v: 'obrys', c: o.c });
    for (const q of d.vyrezy || []) V.poly(T(q), { s: 0.35, v: 'vyrezy' });
    for (const q of d.otvory || []) V.k(x + q.x, y + q.y, q.d / 2, { s: 0.3 });
    for (const q of d.cary || []) V.l(T(q.b), { s: 0.2, d: q.d || 'c', c: q.c || '#777777', v: 'znacky' });
  }

  /* ---------------- výchozí hodnoty ---------------- */
  const STROJ = {
    drazkaS: 19.05, drazkaH: 9.5, drazkaTyp: 'obd', tSirka: 25.4, tVyska: 4, drazkaL: 150, drazkaP: 150,
    stulHloubka: 700, stulL: 500, stulP: 400, kotoucD: 254, kerf: 3.0, vyskaMax: 80, podelV: 60, podelS: 50,
  };
  const NASTAVENI = {
    papir: 'a4', papirW: 210, papirH: 297, okraj: 8, prekryv: 12, kalibX: 100, kalibY: 100,
    vule: 0.2, stul: 220, stulZ: 250, oznaceni: true, materialTisk: 'PETG', velke11: false,
    formatL: 2500, formatS: 1250, prorez: 4, okrajFormatu: 10,
  };
  const SKUPINY = [['stolni', 'Stolní okružní pila'], ['rucni', 'Ruční okružní a pokosová pila'], ['vrtacka', 'Stojanová vrtačka']];

  // pole: {k, n, t:'n'|'v'|'b'|'h', min, max, krok, m:[[hodnota,text]], s:true (stroj), ukaz(p)}
  const S_DRAZKA = [
    { t: 'h', n: 'Drážka stolu (miter slot) – typické hodnoty, změřte svůj stůl' },
    { k: 'drazkaTyp', n: 'Profil drážky', t: 'v', s: true, m: [['obd', 'obdélníková'], ['T', 'T-drážka']] },
    { k: 'drazkaS', n: 'Šířka drážky', t: 'n', s: true, min: 6, max: 40, krok: 0.05 },
    { k: 'drazkaH', n: 'Hloubka drážky', t: 'n', s: true, min: 3, max: 25, krok: 0.1 },
    { k: 'tSirka', n: 'Šířka spodku T', t: 'n', s: true, min: 8, max: 50, krok: 0.1, ukaz: (p, st) => st.drazkaTyp === 'T' },
    { k: 'tVyska', n: 'Výška spodku T', t: 'n', s: true, min: 1.5, max: 15, krok: 0.1, ukaz: (p, st) => st.drazkaTyp === 'T' },
  ];
  const REZIMY = {
    sane: {
      nazev: 'Úhlové saně', ikona: '📐', skupina: 'stolni', stroj: 'stolni',
      popis: 'Saně na příčné řezy (crosscut sled) pro stolní pilu: rozměry podle stolu a drážek, lišty do drážek, bezpečnostní blok a kalibrace pravého úhlu metodou 5 řezů.',
      pole: [
        { t: 'h', n: 'Stůl a kotouč' },
        { k: 'drazkaL', n: 'Osa levé drážky od kotouče', t: 'n', s: true, min: 0, max: 600 },
        { k: 'drazkaP', n: 'Osa pravé drážky od kotouče (0 = není)', t: 'n', s: true, min: 0, max: 600 },
        { k: 'stulHloubka', n: 'Hloubka stolu (předozadní)', t: 'n', s: true, min: 200, max: 2000 },
        { k: 'kotoucD', n: 'Průměr kotouče', t: 'n', s: true, min: 100, max: 400 },
        { k: 'kerf', n: 'Šířka řezu (kerf)', t: 'n', s: true, min: 1, max: 6, krok: 0.1 },
        { k: 'vyskaMax', n: 'Max. vysunutí kotouče', t: 'n', s: true, min: 20, max: 150 },
      ].concat(S_DRAZKA, [
        { t: 'h', n: 'Saně' },
        { k: 'sirkaL', n: 'Šířka vlevo od kotouče', t: 'n', min: 150, max: 1500 },
        { k: 'sirkaP', n: 'Šířka vpravo od kotouče', t: 'n', min: 80, max: 1500 },
        { k: 'hloubka', n: 'Hloubka saní (předozadní)', t: 'n', min: 250, max: 1500 },
        { k: 'zakladTl', n: 'Tloušťka základny', t: 'n', min: 6, max: 25 },
        { k: 'tlDilu', n: 'Max. tloušťka řezaného dílu', t: 'n', min: 5, max: 120 },
        { k: 'predniV', n: 'Výška předního pravítka', t: 'n', min: 40, max: 200 },
        { k: 'predniTl', n: 'Tloušťka předního pravítka', t: 'n', min: 18, max: 80 },
        { k: 'zadniV', n: 'Výška zadního pravítka', t: 'n', min: 30, max: 200 },
        { k: 'zadniTl', n: 'Tloušťka zadního pravítka', t: 'n', min: 12, max: 60 },
        { k: 'listaMat', n: 'Lišty do drážek', t: 'v', m: [['tisk', '3D tisk (PETG)'], ['drevo', 'tvrdé dřevo / HDPE z desky']] },
        { k: 'vuleLista', n: 'Vůle lišty v drážce (na šířce)', t: 'n', min: 0, max: 1.5, krok: 0.05 },
        { t: 'h', n: 'Kalibrace 5 řezů (zadejte naměřené hodnoty)' },
        { k: 'pA', n: 'Šířka proužku u pravítka (A)', t: 'n', min: 0, max: 200, krok: 0.01 },
        { k: 'pB', n: 'Šířka proužku na druhém konci (B)', t: 'n', min: 0, max: 200, krok: 0.01 },
        { k: 'pL', n: 'Délka proužku (mezi místy měření)', t: 'n', min: 50, max: 2000 },
        { k: 'pF', n: 'Rameno pravítka: čep → stavěcí šroub (0 = auto)', t: 'n', min: 0, max: 2000 },
      ]),
    },
    pokos: {
      nazev: 'Pokosové saně 45°', ikona: '🖼️', skupina: 'stolni', stroj: 'stolni',
      popis: 'Desková šablona na rámové pokosy: dvě pravítka pod 45° (dohromady 90°) na saních v drážkách, korekce úhlu ze spáry zkušebního rámu.',
      pole: [
        { t: 'h', n: 'Stůl' },
        { k: 'drazkaL', n: 'Osa levé drážky od kotouče', t: 'n', s: true, min: 0, max: 600 },
        { k: 'drazkaP', n: 'Osa pravé drážky od kotouče (0 = není)', t: 'n', s: true, min: 0, max: 600 },
        { k: 'kotoucD', n: 'Průměr kotouče', t: 'n', s: true, min: 100, max: 400 },
        { k: 'kerf', n: 'Šířka řezu (kerf)', t: 'n', s: true, min: 1, max: 6, krok: 0.1 },
      ].concat(S_DRAZKA, [
        { t: 'h', n: 'Saně' },
        { k: 'sirka', n: 'Šířka základny', t: 'n', min: 300, max: 1500 },
        { k: 'hloubka', n: 'Hloubka základny', t: 'n', min: 250, max: 1200 },
        { k: 'zakladTl', n: 'Tloušťka základny', t: 'n', min: 6, max: 25 },
        { k: 'rameno', n: 'Délka pravítka (ramene)', t: 'n', min: 100, max: 800 },
        { k: 'pravV', n: 'Výška pravítek', t: 'n', min: 20, max: 120 },
        { k: 'pravTl', n: 'Tloušťka pravítek', t: 'n', min: 9, max: 40 },
        { k: 'mezera', n: 'Mezera pravítka od řezu', t: 'n', min: 3, max: 40 },
        { k: 'listaMax', n: 'Max. šířka rámové lišty', t: 'n', min: 15, max: 150 },
        { k: 'tlDilu', n: 'Max. výška lišty', t: 'n', min: 5, max: 80 },
        { k: 'listaMat', n: 'Lišty do drážek', t: 'v', m: [['tisk', '3D tisk (PETG)'], ['drevo', 'tvrdé dřevo / HDPE z desky']] },
        { k: 'vuleLista', n: 'Vůle lišty v drážce (na šířce)', t: 'n', min: 0, max: 1.5, krok: 0.05 },
        { t: 'h', n: 'Korekce ze zkušebního rámu (4 rohy)' },
        { k: 'rSirka', n: 'Šířka lišty zkušebního rámu', t: 'n', min: 10, max: 200 },
        { k: 'rMezera', n: 'Spára posledního rohu', t: 'n', min: 0, max: 10, krok: 0.05 },
        { k: 'rStrana', n: 'Spára je', t: 'v', m: [['vnejsi', 'na vnější straně (u špičky)'], ['vnitrni', 'na vnitřní straně (u paty)']] },
      ]),
    },
    cepy: {
      nazev: 'Šablona na čepy', ikona: '🪵', skupina: 'stolni', stroj: 'stolni',
      popis: 'Desková šablona (tenoning jig) jezdící po podélném pravítku: čelo, bočnice, můstek a svislý doraz. Výpočet nastavení pro vystředěný čep.',
      pole: [
        { t: 'h', n: 'Podélné pravítko pily (rip fence)' },
        { k: 'podelV', n: 'Výška podélného pravítka', t: 'n', s: true, min: 30, max: 150 },
        { k: 'podelS', n: 'Šířka (tloušťka) pravítka', t: 'n', s: true, min: 15, max: 120 },
        { k: 'kerf', n: 'Šířka řezu (kerf)', t: 'n', s: true, min: 1, max: 6, krok: 0.1 },
        { k: 'kotoucD', n: 'Průměr kotouče', t: 'n', s: true, min: 100, max: 400 },
        { t: 'h', n: 'Šablona' },
        { k: 'deskaTl', n: 'Tloušťka desek šablony', t: 'n', min: 12, max: 25 },
        { k: 'celoV', n: 'Výška čela', t: 'n', min: 150, max: 500 },
        { k: 'celoS', n: 'Délka čela (ve směru posuvu)', t: 'n', min: 150, max: 500 },
        { k: 'vule', n: 'Vůle na pravítku', t: 'n', min: 0, max: 3, krok: 0.1 },
        { t: 'h', n: 'Čep' },
        { k: 'tb', n: 'Tloušťka dílu', t: 'n', min: 10, max: 120, krok: 0.1 },
        { k: 'tc', n: 'Tloušťka čepu', t: 'n', min: 3, max: 100, krok: 0.1 },
        { k: 'lc', n: 'Délka čepu (= výška kotouče)', t: 'n', min: 5, max: 100 },
      ],
    },
    hrebinek: {
      nazev: 'Hřebínková přítlačka', ikona: '🪶', skupina: 'stolni', stroj: 'stolni',
      popis: 'Featherboard pro 3D tisk s pružnými prsty pod úhlem a s lištou do drážky stolu (T-drážka nebo rozpěrná lišta pro obdélníkovou drážku).',
      pole: [
        { k: 'drazkaL', n: 'Osa drážky od kotouče (pro 3D náhled)', t: 'n', s: true, min: 0, max: 600 },
      ].concat(S_DRAZKA, [
        { t: 'h', n: 'Tělo a prsty' },
        { k: 'delka', n: 'Délka (vč. prstů)', t: 'n', min: 100, max: 300 },
        { k: 'sirka', n: 'Šířka (ve směru posuvu)', t: 'n', min: 40, max: 200 },
        { k: 'tl', n: 'Tloušťka', t: 'n', min: 6, max: 30 },
        { k: 'uhel', n: 'Sklon prstů od kolmice', t: 'n', min: 0, max: 50 },
        { k: 'prst', n: 'Šířka prstu', t: 'n', min: 2, max: 8, krok: 0.1 },
        { k: 'mezera', n: 'Mezera mezi prsty', t: 'n', min: 1.2, max: 8, krok: 0.1 },
        { k: 'delkaPrstu', n: 'Délka prstů', t: 'n', min: 20, max: 120 },
        { k: 'drazkaUp', n: 'Délka upínacích drážek', t: 'n', min: 20, max: 150 },
        { k: 'upevneni', n: 'Upevnění', t: 'v', m: [['lista', 'lišta do drážky stolu'], ['zadne', 'bez lišty (svěrkou)']] },
        { k: 'delkaListy', n: 'Délka lišty', t: 'n', min: 60, max: 210 },
      ]),
    },
    vlozka: {
      nazev: 'Nulová vložka', ikona: '⬭', skupina: 'stolni', stroj: 'stolni',
      popis: 'Šablona tvaru výplně stolu (zero-clearance insert) k frézování kopírovací frézou s ložiskem nebo kopírovacím kroužkem, s otvory pro stavěcí šrouby a startovací drážkou kotouče.',
      pole: [
        { k: 'kotoucD', n: 'Průměr kotouče', t: 'n', s: true, min: 100, max: 400 },
        { k: 'kerf', n: 'Šířka řezu (kerf)', t: 'n', s: true, min: 1, max: 6, krok: 0.1 },
        { t: 'h', n: 'Tvar vložky (obkreslete původní)' },
        { k: 'L', n: 'Délka vložky', t: 'n', min: 100, max: 700 },
        { k: 'W', n: 'Šířka vložky', t: 'n', min: 40, max: 250 },
        { k: 'r', n: 'Poloměr rohů (konce)', t: 'n', min: 0, max: 125 },
        { k: 'tl', n: 'Tloušťka vložky', t: 'n', min: 3, max: 25, krok: 0.1 },
        { k: 'kotoucY', n: 'Levý bok kotouče od levé hrany vložky', t: 'n', min: 5, max: 240 },
        { k: 'kotoucX', n: 'Střed kotouče od přední hrany', t: 'n', min: 30, max: 650 },
        { k: 'startD', n: 'Délka startovací drážky (0 = bez)', t: 'n', min: 0, max: 400 },
        { k: 'srouby', n: 'Stavěcí šrouby (počet)', t: 'v', m: [['0', 'žádné'], ['2', '2'], ['4', '4'], ['6', '6']] },
        { k: 'sroubD', n: 'Průměr otvoru stavěcích šroubů', t: 'n', min: 2, max: 10, krok: 0.1 },
        { k: 'prstD', n: 'Otvor na prst (0 = bez)', t: 'n', min: 0, max: 40 },
        { t: 'h', n: 'Frézování podle šablony' },
        { k: 'zpusob', n: 'Kopírování', t: 'v', m: [['lozisko', 'fréza s ložiskem (šablona = obrys)'], ['krouzek', 'kopírovací kroužek (šablona zmenšená)']] },
        { k: 'krouzekD', n: 'Vnější Ø kopírovacího kroužku', t: 'n', min: 8, max: 60, krok: 0.1, ukaz: (p) => p.zpusob === 'krouzek' },
        { k: 'frezaD', n: 'Ø frézy', t: 'n', min: 3, max: 30, krok: 0.1, ukaz: (p) => p.zpusob === 'krouzek' },
      ],
    },
    voditko: {
      nazev: 'Vodítko ruční pily', ikona: '🪚', skupina: 'rucni', stroj: 'okruzni',
      popis: 'Vodicí lišta pro ruční okružní pilu: změřený offset kotouče od hrany patky, základna + pravítko z desky (řezný plán, DXF), tištěné koncovky a přítlačné botky svěrek.',
      pole: [
        { t: 'h', n: 'Měření pily' },
        { k: 'a1', n: 'Hrana patky → bok zubů, vpředu', t: 'n', min: 5, max: 200, krok: 0.05 },
        { k: 'a2', n: 'Hrana patky → bok zubů, vzadu', t: 'n', min: 5, max: 200, krok: 0.05 },
        { k: 'lm', n: 'Vzdálenost obou měření podél kotouče', t: 'n', min: 30, max: 400 },
        { k: 'kerf', n: 'Šířka řezu (rozvod zubů)', t: 'n', min: 1, max: 5, krok: 0.05 },
        { k: 'patkaW', n: 'Šířka patky pily', t: 'n', min: 60, max: 400 },
        { t: 'h', n: 'Vodítko' },
        { k: 'delka', n: 'Délka řezu', t: 'n', min: 200, max: 5000 },
        { k: 'nabeh', n: 'Náběh a výběh (každý konec)', t: 'n', min: 0, max: 500 },
        { k: 'zakladTl', n: 'Tloušťka základny (MDF/HDF)', t: 'n', min: 3, max: 12 },
        { k: 'pravW', n: 'Šířka pravítka', t: 'n', min: 30, max: 200 },
        { k: 'pravTl', n: 'Tloušťka pravítka', t: 'n', min: 6, max: 25 },
        { k: 'prorez', n: 'Přídavek na zaříznutí hrany', t: 'n', min: 3, max: 40 },
        { k: 'maxDeska', n: 'Max. délka dílu z desky', t: 'n', min: 500, max: 3100 },
        { k: 'svorek', n: 'Přítlačné botky svěrek (ks)', t: 'n', min: 0, max: 8 },
      ],
    },
    doraz: {
      nazev: 'Doraz na délku', ikona: '⛔', skupina: 'rucni', stroj: 'pokosova',
      popis: 'Posuvný doraz (stop block) pro opakované délky na pravítku pokosové pily nebo saní: nasazuje se přes pravítko, svírá šroubem M6, s drážkou na prach.',
      pole: [
        { k: 'pravV', n: 'Výška pravítka (fence)', t: 'n', min: 15, max: 150, krok: 0.1 },
        { k: 'pravTl', n: 'Tloušťka pravítka', t: 'n', min: 5, max: 60, krok: 0.1 },
        { k: 'presah', n: 'Přesah dorazu před pravítko', t: 'n', min: 10, max: 80 },
        { k: 'sirka', n: 'Šířka dorazu (podél pravítka)', t: 'n', min: 15, max: 100 },
        { k: 'stena', n: 'Tloušťka stěn', t: 'n', min: 3, max: 12, krok: 0.5 },
        { k: 'zadniNoha', n: 'Délka zadní nohy (se šroubem)', t: 'n', min: 14, max: 80 },
        { k: 'zkoseni', n: 'Drážka na prach (zkosení)', t: 'n', min: 0, max: 10, krok: 0.5 },
        { k: 'delkaDilu', n: 'Nastavovaná délka dílu', t: 'n', min: 10, max: 3000 },
      ],
    },
    posunovac: {
      nazev: 'Posunovače', ikona: '✋', skupina: 'stolni', stroj: 'stolni',
      popis: 'Posunovací tyč (push stick) z desky (DXF) nebo z tisku a posunovací blok (push block) pro 3D tisk. Drží ruce mimo dosah kotouče.',
      pole: [
        { t: 'h', n: 'Posunovací tyč' },
        { k: 'delka', n: 'Délka tyče', t: 'n', min: 200, max: 600 },
        { k: 'vyska', n: 'Výška těla', t: 'n', min: 30, max: 120 },
        { k: 'patka', n: 'Výška patky (háčku)', t: 'n', min: 3, max: 25 },
        { k: 'delkaBota', n: 'Délka botky (dosedá na díl)', t: 'n', min: 60, max: 300 },
        { k: 'uhel', n: 'Sklon rukojeti', t: 'n', min: 10, max: 60 },
        { k: 'sirkaRuk', n: 'Šířka rukojeti', t: 'n', min: 22, max: 50 },
        { k: 'tl', n: 'Tloušťka tyče', t: 'n', min: 6, max: 25 },
        { t: 'h', n: 'Posunovací blok' },
        { k: 'blokL', n: 'Délka bloku', t: 'n', min: 80, max: 210 },
        { k: 'blokS', n: 'Šířka bloku', t: 'n', min: 20, max: 120 },
        { k: 'blokV', n: 'Výška bloku', t: 'n', min: 50, max: 140 },
        { k: 'blokPatka', n: 'Výška patky bloku', t: 'n', min: 2, max: 20 },
        { k: 'tlDilu', n: 'Nejtenčí posunovaný díl', t: 'n', min: 3, max: 100 },
      ],
    },
    klin: {
      nazev: 'Úhlová podložka', ikona: '📏', skupina: 'vrtacka', stroj: 'vrtacka',
      popis: 'Podložka pod úhlem pro vrtání šikmých děr: pevný klín pro 3D tisk nebo sklopná desková deska s obloukovou drážkou a stupnicí.',
      pole: [
        { k: 'varianta', n: 'Provedení', t: 'v', m: [['klin', 'pevný klín (3D tisk)'], ['sklopna', 'sklopná deska (z desek)']] },
        { k: 'uhel', n: 'Úhel', t: 'n', min: 1, max: 60, krok: 0.5 },
        { k: 'delka', n: 'Délka', t: 'n', min: 40, max: 600 },
        { k: 'sirka', n: 'Šířka', t: 'n', min: 20, max: 500 },
        { k: 'tlMin', n: 'Min. tloušťka klínu', t: 'n', min: 2, max: 30, ukaz: (p) => p.varianta === 'klin' },
        { k: 'deskaTl', n: 'Tloušťka desek', t: 'n', min: 9, max: 25, ukaz: (p) => p.varianta === 'sklopna' },
        { k: 'uhelMax', n: 'Max. sklon sklopné desky', t: 'n', min: 10, max: 75, ukaz: (p) => p.varianta === 'sklopna' },
        { k: 'polomer', n: 'Poloměr drážky (od čepu)', t: 'n', min: 60, max: 500, ukaz: (p) => p.varianta === 'sklopna' },
      ],
    },
    vblok: {
      nazev: 'V-blok na kulatinu', ikona: '🔻', skupina: 'vrtacka', stroj: 'vrtacka',
      popis: 'Kolébka pro vrtání kulatiny (kolíky, tyče, trubky) na stojanové vrtačce: V-drážka 90°, odlehčovací drážka pro výjezd vrtáku, tabulka výšky osy.',
      pole: [
        { k: 'dMin', n: 'Nejmenší průměr', t: 'n', min: 2, max: 200 },
        { k: 'dMax', n: 'Největší průměr', t: 'n', min: 4, max: 300 },
        { k: 'uhelV', n: 'Úhel V', t: 'n', min: 60, max: 120 },
        { k: 'delka', n: 'Délka bloku', t: 'n', min: 20, max: 250 },
        { k: 'zaklad', n: 'Materiál pod vrcholem V', t: 'n', min: 4, max: 60 },
        { k: 'stena', n: 'Boční stěna nad V', t: 'n', min: 3, max: 30 },
        { k: 'relS', n: 'Šířka odlehčovací drážky', t: 'n', min: 0, max: 30, krok: 0.5 },
        { k: 'relH', n: 'Hloubka odlehčovací drážky', t: 'n', min: 0, max: 40, krok: 0.5 },
      ],
    },
    kolik: {
      nazev: 'Kolíky do čela', ikona: '🔩', skupina: 'vrtacka', stroj: 'dilna',
      popis: 'Středicí přípravek s dorazem pro vrtání děr na kolíky do čela desky: nasadí se přes tloušťku desky, díry jsou přesně v polovině tloušťky.',
      pole: [
        { k: 'T', n: 'Tloušťka desky', t: 'n', min: 8, max: 60, krok: 0.1 },
        { k: 'd', n: 'Průměr kolíku / vrtáku', t: 'n', min: 3, max: 16, krok: 0.5 },
        { k: 'n', n: 'Počet děr', t: 'n', min: 1, max: 6 },
        { k: 's', n: 'Rozteč děr', t: 'n', min: 8, max: 100 },
        { k: 'e1', n: 'První díra od boční hrany', t: 'n', min: 5, max: 150 },
        { k: 'hloubka', n: 'Hloubka díry', t: 'n', min: 5, max: 80 },
        { k: 'otvor', n: 'Otvory', t: 'v', m: [['vule', 'pro vrták s vůlí'], ['pouzdro', 'pro ocelové pouzdro']] },
        { k: 'vuleD', n: 'Vůle na průměru', t: 'n', min: 0, max: 1, krok: 0.05, ukaz: (p) => p.otvor !== 'pouzdro' },
        { k: 'pouzdroD', n: 'Vnější Ø pouzdra', t: 'n', min: 4, max: 30, krok: 0.1, ukaz: (p) => p.otvor === 'pouzdro' },
        { k: 'vedeni', n: 'Výška vedení', t: 'n', min: 8, max: 50 },
        { k: 'bocnice', n: 'Tloušťka bočnic', t: 'n', min: 2, max: 15, krok: 0.5 },
        { k: 'hloubkaB', n: 'Délka bočnic', t: 'n', min: 8, max: 60 },
      ],
    },
  };

  const VYCHOZI = {
    sane: { sirkaL: 450, sirkaP: 300, hloubka: 560, zakladTl: 12, tlDilu: 50, predniV: 90, predniTl: 36, zadniV: 80, zadniTl: 18, listaMat: 'tisk', vuleLista: 0.2, pA: 20.0, pB: 20.0, pL: 500, pF: 0 },
    pokos: { sirka: 600, hloubka: 480, zakladTl: 12, rameno: 260, pravV: 50, pravTl: 18, mezera: 12, listaMax: 60, tlDilu: 40, listaMat: 'tisk', vuleLista: 0.2, rSirka: 40, rMezera: 0, rStrana: 'vnejsi' },
    cepy: { deskaTl: 18, celoV: 300, celoS: 280, vule: 0.5, tb: 40, tc: 13, lc: 35 },
    hrebinek: { delka: 200, sirka: 70, tl: 15, uhel: 30, prst: 3, mezera: 2.5, delkaPrstu: 55, drazkaUp: 50, upevneni: 'lista', delkaListy: 120 },
    vlozka: { L: 350, W: 95, r: 12, tl: 12.7, kotoucY: 40, kotoucX: 175, startD: 120, srouby: '4', sroubD: 4.2, prstD: 22, zpusob: 'lozisko', krouzekD: 17, frezaD: 12.7 },
    voditko: { a1: 38.0, a2: 38.0, lm: 150, kerf: 2.4, patkaW: 150, delka: 1250, nabeh: 150, zakladTl: 6, pravW: 70, pravTl: 12, prorez: 10, maxDeska: 2440, svorek: 2 },
    doraz: { pravV: 60, pravTl: 18, presah: 30, sirka: 40, stena: 5, zadniNoha: 26, zkoseni: 3, delkaDilu: 300 },
    posunovac: { delka: 380, vyska: 55, patka: 8, delkaBota: 150, uhel: 30, sirkaRuk: 32, tl: 15, blokL: 150, blokS: 40, blokV: 85, blokPatka: 6, tlDilu: 12 },
    klin: { varianta: 'klin', uhel: 15, delka: 150, sirka: 100, tlMin: 5, deskaTl: 18, uhelMax: 45, polomer: 220 },
    vblok: { dMin: 8, dMax: 60, uhelV: 90, delka: 100, zaklad: 15, stena: 8, relS: 3.5, relH: 6 },
    kolik: { T: 18, d: 8, n: 2, s: 32, e1: 20, hloubka: 25, otvor: 'vule', vuleD: 0.2, pouzdroD: 12, vedeni: 20, bocnice: 5, hloubkaB: 25 },
  };

  /** sloučení parametrů s výchozími a převod čísel */
  function normalizuj(rezim, p, stroj) {
    const R = REZIMY[rezim], o = Object.assign({}, VYCHOZI[rezim], p || {}), s = Object.assign({}, STROJ, stroj || {});
    for (const f of R.pole) {
      if (!f.k) continue;
      const cil = f.s ? s : o, d = f.s ? STROJ[f.k] : VYCHOZI[rezim][f.k];
      if (f.t === 'n') cil[f.k] = omez(cislo(cil[f.k], d), f.min != null ? f.min : -Infinity, f.max != null ? f.max : Infinity);
      else if (f.t === 'v' && !f.m.some((m) => String(m[0]) === String(cil[f.k]))) cil[f.k] = d;
    }
    return { p: o, s };
  }
  function vychoziProjekt(rezim) {
    const P = { rezim: rezim && REZIMY[rezim] ? rezim : 'sane', p: {}, stroj: Object.assign({}, STROJ), nast: Object.assign({}, NASTAVENI), nazev: '' };
    for (const k of Object.keys(REZIMY)) P.p[k] = JSON.parse(JSON.stringify(VYCHOZI[k]));
    return P;
  }

  /* ================= samostatné výpočty (testované) ================= */

  /**
   * Metoda 5 řezů. A = šířka odřezaného proužku u pravítka (konec, kde řez skončil),
   * B = šířka na vzdáleném konci, L = vzdálenost míst měření, F = rameno pravítka (čep → stavěcí šroub).
   * Chyba se 4 řezy sčítá: ε = (A − B) / (4 L). ε > 0 ⇔ konec pravítka vzdálený od kotouče je
   * předsunutý k obsluze (úhel mezi pravítkem a řezem je menší než 90° na straně dílu).
   */
  function petRezu(A, B, L, F) {
    A = cislo(A, 0); B = cislo(B, 0); L = Math.max(1e-6, cislo(L, 1)); F = cislo(F, 0);
    const eps = Math.atan((A - B) / (4 * L));
    const posunF = F * Math.tan(eps);
    return {
      eps, stupne: eps / RAD, uhelMin: eps / RAD * 60, mmNaMetr: Math.tan(eps) * 1000,
      chybaNaDelce: (A - B) / 4,      // odchylka jednoho řezu od kolmice na délce L
      posun: Math.abs(posunF),
      smer: Math.abs(A - B) < 1e-9 ? 'ok' : (eps > 0 ? 'od' : 'k'),   // posunout vzdálený konec pravítka od obsluhy / k obsluze
    };
  }
  /** geometrická simulace metody 5 řezů (pro ověření vzorce): pravítko pootočené o eps (rad) */
  function simulacePetRezu(eps, S, t, t5) {
    S = S || 500; t = t || 8; t5 = t5 || 20;
    const clip = (P, vlevo) => {
      const out = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length], ia = vlevo ? a[0] <= 0 : a[0] >= 0, ib = vlevo ? b[0] <= 0 : b[0] >= 0;
        if (ia) out.push(a);
        if (ia !== ib) { const k = a[0] / (a[0] - b[0]); out.push([0, a[1] + k * (b[1] - a[1])]); }
      }
      return out;
    };
    const rot = (P, u) => P.map(([x, y]) => [x * Math.cos(u) - y * Math.sin(u), x * Math.sin(u) + y * Math.cos(u)]);
    let P = rot(obd(-S + t, 0, t, S), eps), pruh = null;
    for (let k = 1; k <= 5; k++) {
      const odrez = clip(P, false); P = clip(P, true);
      if (k === 5) { pruh = odrez; break; }
      P = rot(P.map(([x, y]) => [y, -x]), eps);           // otočit o 90°, řezaná hrana k pravítku
      const mx = Math.max(...P.map((q) => q[0])), d = mx - (k === 4 ? t5 : t);
      P = P.map(([x, y]) => [x - d * Math.cos(eps), y - d * Math.sin(eps)]);    // posun podél pravítka
    }
    const s = pruh.filter((q) => q[0] > 1e-6).sort((a, b) => a[1] - b[1]), ys = pruh.map((q) => q[1]);
    return { A: s[0][0], B: s[s.length - 1][0], L: Math.max(...ys) - Math.min(...ys) };
  }

  /** offset kotouče ruční pily od hrany patky ze dvou měření */
  function offsetVoditka(a1, a2, lm, kerf, patkaW) {
    a1 = cislo(a1, 0); a2 = cislo(a2, a1); lm = Math.max(1, cislo(lm, 150)); kerf = cislo(kerf, 0); patkaW = cislo(patkaW, 0);
    const o = (a1 + a2) / 2, d = a2 - a1;
    return { offset: o, odchylka: d, uhel: Math.atan2(d, lm) / RAD, mmNaMetr: d / lm * 1000, druhaStrana: patkaW - o - kerf, rovnobezne: Math.abs(d) <= 0.15 };
  }
  /** šířka lišty do drážky a kontrola vůle */
  function listaDoDrazky(s, h, vule) {
    s = cislo(s, STROJ.drazkaS); h = cislo(h, STROJ.drazkaH); vule = cislo(vule, 0.2);
    return { sirka: r2(s - vule), vyska: r2(h - 1), vulePrumer: vule, vuleStrana: vule / 2 };
  }
  /** korekce pokosu ze spáry zkušebního rámu se 4 rohy (8 řezů) */
  function korekceRamu(sirkaListy, spara, rameno) {
    const m = cislo(sirkaListy, 40) * Math.SQRT2, g = Math.max(0, cislo(spara, 0));
    const delta = Math.atan(g / m) / 8;          // chyba jednoho pokosu (rad)
    return { delta, stupne: delta / RAD, rohChyba: 2 * delta / RAD, posun: cislo(rameno, 0) * Math.tan(2 * delta), delkaPokosu: m };
  }
  /** výška klínu */
  function vyskaKlinu(uhel, delka, tlMin) { return cislo(tlMin, 0) + cislo(delka, 0) * Math.tan(cislo(uhel, 0) * RAD); }
  /** V-blok: výška osy a dotykových bodů nad vrcholem V */
  function vBlokOsa(d, uhelV) {
    const th = cislo(uhelV, 90) / 2 * RAD, r = cislo(d, 0) / 2;
    return { stred: r / Math.sin(th), dotykV: r / Math.sin(th) - r * Math.sin(th), dotykX: r * Math.cos(th) };
  }
  /** šablona vložky: offset obrysu pro kopírovací kroužek */
  function offsetKrouzku(krouzekD, frezaD) { return (cislo(krouzekD, 0) - cislo(frezaD, 0)) / 2; }

  /* ---------- tětiva kotouče nad základnou ---------- */
  /** polovina tětivy kotouče poloměru R vysunutého o e nad rovinu, ve výšce z nad rovinou */
  function polotetiva(R, e, z) { const q = R - e + (z || 0); return q >= R ? 0 : Math.sqrt(R * R - q * q); }

  /* ================= pomocné díly ================= */
  function deska(o) { const bb = bbox(o.obrys); return Object.assign({ druh: 'deska', ks: 1, otvory: [], vyrezy: [], cary: [], w: r2(bb.w), h: r2(bb.h) }, o); }
  function tisk(o) { const b = bboxCSG(o.csg); return Object.assign({ druh: 'tisk', ks: 1, pohledy: [], rozmer: [0, 1, 2].map((i) => r2(b.b[i] - b.a[i])) }, o); }
  const um = (o, u, v) => ({ o, u, v });
  const S2 = Math.SQRT1_2;

  /** lišty do drážky (deska nebo tisk po segmentech) pro saně; vrací {dily, polohy děr} */
  function listySani(N, s, p, D, xs, idPref, ox) {
    const dily = [], w = r2(s.drazkaS - p.vuleLista), hr = r2(s.drazkaH - 1), T = s.drazkaTyp === 'T';
    const tw = r2(s.tSirka - p.vuleLista), th = r2(Math.max(1, s.tVyska - 0.5));
    // polohy šroubů po délce: od 25 mm po ~100 mm
    const nS = Math.max(2, Math.round((D - 50) / 100) + 1), ys = [];
    for (let i = 0; i < nS; i++) ys.push(r2(25 + (D - 50) * i / (nS - 1)));
    const bed = Math.max(60, N.stul - 10), nSeg = p.listaMat === 'tisk' ? Math.ceil(D / bed - 1e-9) : 1, Ls = D / nSeg;
    xs.forEach((x, j) => {
      if (p.listaMat !== 'tisk') {
        dily.push(deska({ id: idPref + (j + 1), nazev: `Lišta do ${x < 0 ? 'levé' : 'pravé'} drážky`, material: 'tvrdé dřevo / HDPE', tl: hr, ks: 1, obrys: obd(0, 0, D, w), pozn: `průřez ${cz(w, 2)} × ${cz(hr, 1)} mm${T ? ' (T-drážka: dřevěná lišta jen obdélníková)' : ''}`,
          um: um([ox + x - w / 2, 0, -hr], [0, 1, 0], [1, 0, 0]), pohyb: true }));
        // um: lokální x → svět y, lokální y → svět x, n = (0,1,0)×(1,0,0) = (0,0,−1) → tloušťka dolů; posun o hr nahoru: z ∈ [−hr, 0]
        dily[dily.length - 1].um.o[2] = 0;
        return;
      }
      for (let i = 0; i < nSeg; i++) {
        const y0 = i * Ls, y1 = (i + 1) * Ls, L = y1 - y0;
        let csg = T ? C.add(C.box([0, 0, 0], [L, tw, th]), C.box([0, (tw - w) / 2, th - 0.01], [L, (tw + w) / 2, hr])) : C.box([0, 0, 0], [L, w, hr]);
        const cy = T ? tw / 2 : w / 2, diry = ys.filter((y) => y > y0 + 6 && y < y1 - 6);
        if (!diry.length) diry.push((y0 + y1) / 2);
        csg = C.sub(csg, diry.map((y) => C.cyl('z', [y - y0, cy], 1.5, 1.5, hr + 1)));
        const V = new Vykres('pr', 'Průřez lišty');
        if (T) V.poly([[0, 0], [tw, 0], [tw, th], [(tw + w) / 2, th], [(tw + w) / 2, hr], [(tw - w) / 2, hr], [(tw - w) / 2, th], [0, th]]);
        else V.obd(0, 0, w, hr);
        V.l([[cy, 1.5], [cy, hr]], { d: 'o', s: 0.2, c: '#777777' });
        V.kota([T ? (tw - w) / 2 : 0, hr], [T ? (tw + w) / 2 : w, hr], 4, cz(w, 2)).kota([T ? tw : w, 0], [T ? tw : w, hr], -4, cz(hr, 1));
        if (T) V.kota([0, 0], [tw, 0], -4, cz(tw, 2));
        const V2 = new Vykres('bok', 'Lišta – pohled shora');
        V2.obd(0, 0, L, T ? tw : w); diry.forEach((y) => V2.k(y - y0, cy, 1.5));
        V2.kota([0, 0], [L, 0], -5, cz(L, 1));
        dily.push(tisk({
          id: `${idPref}${j + 1}${nSeg > 1 ? '.' + (i + 1) : ''}`, nazev: `Lišta do ${x < 0 ? 'levé' : 'pravé'} drážky${nSeg > 1 ? ` – díl ${i + 1}/${nSeg}` : ''}`, material: N.materialTisk, csg, pohledy: [V, V2],
          pozn: `šířka ${cz(w, 2)} mm = drážka ${cz(s.drazkaS, 2)} − vůle ${cz(p.vuleLista, 2)}; výška ${cz(hr, 1)} (1 mm pod dnem drážky); předvrty Ø3 pro vruty 3,5×${Math.ceil((p.zakladTl || 12) + hr * 0.7)}`,
          tiskPozn: 'tiskne se ve stejné poloze jako v drážce, bez podpěr; označení nevyryto – horní plocha je dosedací, spodní kluzná',
          um: um([ox + x + (T ? tw : w) / 2, y0, -(s.drazkaH - 1)], [0, 1, 0], [-1, 0, 0]), pohyb: true,
        }));
        // kontrola orientace: lokální x → +y, lokální y → −x, n = (0,1,0)×(−1,0,0) = (0,0,1) ✓
      }
    });
    return { dily, ys, w, hr, nSeg };
  }

  /* ================= režimy ================= */
  const VYP = {};

  /* ---------- úhlové saně ---------- */
  VYP.sane = function (p, s, N) {
    const R = s.kotoucD / 2, varovani = [], tl = p.zakladTl, W = p.sirkaL + p.sirkaP, D = p.hloubka;
    const hb = p.tlDilu + 5, e = hb + tl;               // vysunutí nad základnu / nad stůl
    if (e > s.vyskaMax) varovani.push(`Kotouč musí vyjet ${cz(e)} mm nad stůl, pila umí ${cz(s.vyskaMax)} mm – zmenšete tloušťku dílu nebo základny.`);
    const a0 = polotetiva(R, hb, 0), aT = polotetiva(R, hb, p.tlDilu);
    const pruniknuti = a0 - aT + 5;                      // jak daleko kotouč zajede do předního pravítka (na úrovni základny)
    const Lb = r1(Math.max(50, a0 + 20 - p.predniTl * 0.5));   // bezpečnostní blok před pravítkem
    const yF = Lb, K = D - Lb - p.predniTl - p.zadniTl;
    if (K < 80) varovani.push('Mezi pravítky zbývá méně než 80 mm – zvětšete hloubku saní.');
    if (p.zadniV < hb + 20) varovani.push(`Zadní pravítko by mělo být aspoň ${cz(hb + 20)} mm vysoké (kotouč ${cz(hb)} mm + 20 mm materiálu nad prořezem), jinak se rozpadne na dvě části.`);
    if (p.predniV < hb + 25) varovani.push(`Přední pravítko by mělo být aspoň ${cz(hb + 25)} mm vysoké – kotouč nesmí vyjet nad pravítko.`);
    if (D > s.stulHloubka + 150) varovani.push('Saně jsou o víc než 150 mm hlubší než stůl – na začátku a konci zdvihu se budou překlápět.');
    const xs = [];
    if (p.sirkaL >= s.drazkaL + s.drazkaS / 2 + 15) xs.push(-s.drazkaL); else varovani.push('Levá drážka leží mimo základnu – zvětšete šířku vlevo.');
    if (s.drazkaP > 0) { if (p.sirkaP >= s.drazkaP + s.drazkaS / 2 + 15) xs.push(s.kerf + s.drazkaP); else varovani.push('Pravá drážka leží mimo základnu – saně pojedou jen v levé drážce (horší vedení).'); }
    if (!xs.length) varovani.push('Saně nemají žádnou lištu v drážce!');
    const L = listySani(N, s, p, D, xs, 'L', 0);
    // šrouby pravítka: čep u kotouče, stavěcí šroub na vzdáleném konci
    const xCep = p.sirkaL - 50, xStav = 30, F = p.pF > 0 ? p.pF : xCep - xStav;
    const P5 = petRezu(p.pA, p.pB, p.pL, F);
    const zakl = deska({
      id: 'A', nazev: 'Základna', material: 'překližka', tl, ks: 1, obrys: obd(0, 0, W, D),
      otvory: [].concat(...xs.map((x) => L.ys.map((y) => ({ x: r2(p.sirkaL + x), y, d: 4, zap: true }))), [{ x: xCep, y: r2(yF + p.predniTl / 2), d: 5, zap: true }, { x: xStav, y: r2(yF + p.predniTl / 2), d: 5, zap: true }]),
      cary: [{ b: [[p.sirkaL, 0], [p.sirkaL, D]], d: 'o', popis: 'osa prořezu' }, { b: [[0, yF], [W, yF]] }, { b: [[0, yF + p.predniTl], [W, yF + p.predniTl]] }, { b: [[0, D - p.zadniTl], [W, D - p.zadniTl]] }]
        .concat(xs.map((x) => ({ b: obd(p.sirkaL + x - L.w / 2, 0, p.sirkaL + x + L.w / 2, D).concat([[p.sirkaL + x - L.w / 2, 0]]) }))),
      pozn: 'prořez kotoučem vznikne po montáži prvním průjezdem',
      um: um([-p.sirkaL, 0, 0], [1, 0, 0], [0, 1, 0]), pohyb: true,
    });
    const vrstvy = Math.max(1, Math.round(p.predniTl / 18)), tlV = r1(p.predniTl / vrstvy);
    const predni = deska({ id: 'B', nazev: 'Přední pravítko' + (vrstvy > 1 ? ` (${vrstvy} vrstvy slepit)` : ''), material: 'překližka', tl: tlV, tl3d: p.predniTl, ks: vrstvy, obrys: obd(0, 0, W, p.predniV), um: um([-p.sirkaL, yF + p.predniTl, tl], [1, 0, 0], [0, 0, 1]), pohyb: true, pozn: 'spodní hrana musí být rovná, pracovní plocha kolmá k základně' });
    const zadni = deska({ id: 'C', nazev: 'Zadní pravítko', material: 'překližka', tl: p.zadniTl, ks: 1, obrys: obd(0, 0, W, p.zadniV), um: um([-p.sirkaL, D, tl], [1, 0, 0], [0, 0, 1]), pohyb: true });
    const bH = r1(hb + 15), bW = 90;
    const vrB = Math.ceil(bH / 18 - 1e-9);
    const blok = deska({ id: 'D', nazev: `Bezpečnostní blok (${vrB} vrstvy slepit)`, material: 'překližka', tl: 18, tl3d: bH, ks: vrB, obrys: obd(0, 0, bW, Lb), pozn: `výška ${cz(bH)} mm z ${vrB} vrstev 18 mm (zbrousit na výšku), střed na ose prořezu`, um: um([-bW / 2 + s.kerf / 2, 0, tl], [1, 0, 0], [0, 1, 0]), pohyb: true });
    const dily = [zakl, predni, zadni, blok].concat(L.dily);

    // výkresy
    const V1 = new Vykres('pudorys', 'Půdorys saní na stole', 'pohled shora, kotouč v ose prořezu');
    const ox = p.sirkaL;
    V1.obd(0, 0, W, D, { s: 0.5 });
    V1.obd(0, yF, W, yF + p.predniTl, { s: 0.35 }); V1.obd(0, D - p.zadniTl, W, D, { s: 0.35 });
    V1.obd(ox - bW / 2 + s.kerf / 2, 0, ox + bW / 2 + s.kerf / 2, Lb, { s: 0.3, c: '#b3261e' });
    V1.t(ox + bW / 2 + 40, Lb / 2, 'bezpečnostní blok', { h: 3.2, c: '#b3261e' });
    V1.l([[ox, -15], [ox, D + 15]], { d: 'o', s: 0.25, c: '#b3261e' }); V1.l([[ox + s.kerf, 0], [ox + s.kerf, D]], { s: 0.15, c: '#b3261e' });
    V1.t(ox + 3, D + 8, 'osa prořezu', { h: 3 });
    for (const x of xs) { V1.obd(ox + x - L.w / 2, 0, ox + x + L.w / 2, D, { d: 'c', s: 0.25, c: '#555555' }); L.ys.forEach((y) => V1.k(ox + x, y, 2, { s: 0.2 })); }
    V1.k(xCep, yF + p.predniTl / 2, 2.5).k(xStav, yF + p.predniTl / 2, 2.5);
    V1.t(xCep - 4, yF + p.predniTl + 5, 'čep', { h: 3, a: 'r' }).t(xStav + 4, yF + p.predniTl + 5, 'stavěcí šroub', { h: 3 });
    V1.kota([0, 0], [W, 0], -12).kota([0, 0], [ox, 0], -24).kota([W, 0], [W, D], -10);
    V1.kota([0, yF + p.predniTl], [0, D - p.zadniTl], 10, 'K = ' + cz(K)).kota([ox - bW / 2 - 10, 0], [ox - bW / 2 - 10, Lb], 4);
    xs.forEach((x, i) => V1.kota([ox, D], [ox + x, D], 10 + i * 10, cz(Math.abs(x))));
    V1.kota([xStav, yF + p.predniTl + 14], [xCep, yF + p.predniTl + 14], 4, 'F = ' + cz(xCep - xStav));

    const V2 = new Vykres('bok', 'Řez v rovině kotouče', 'kotouč v koncové poloze (doraz pojezdu)');
    const cY = aT, zc = -(R - e);           // střed kotouče v koncové poloze: zuby právě prošly dílem u pravítka
    V2.l([[-60, 0], [D + 60, 0]], { s: 0.25, c: '#777777' }); V2.t(D + 62, -1, 'stůl', { h: 3 });
    V2.obd(0, 0, D, tl, { s: 0.45 });
    V2.obd(yF, tl, yF + p.predniTl, tl + p.predniV); V2.obd(D - p.zadniTl, tl, D, tl + p.zadniV);
    V2.obd(0, tl, Lb, tl + bH, { c: '#b3261e' });
    V2.obd(yF + p.predniTl, tl, D - p.zadniTl, tl + p.tlDilu, { d: 'c', s: 0.25, c: '#8a6a3e' }); V2.t(yF + p.predniTl + 4, tl + p.tlDilu + 3, 'díl ' + cz(p.tlDilu), { h: 3, c: '#8a6a3e' });
    V2.k(yF + p.predniTl + cY, zc, R, { s: 0.3, d: 'c', c: '#b3261e' }); V2.k(yF + p.predniTl + cY, zc, 2, { c: '#b3261e' });
    V2.kota([D + 12, tl], [D + 12, tl + hb], -4, 'h = ' + cz(hb)).kota([D + 30, 0], [D + 30, tl + p.zadniV], -4).kota([-12, tl], [-12, tl + p.predniV], 4).kota([-30, 0], [-30, tl + bH], 4, cz(bH + tl));
    V2.kota([0, -8], [D, -8], -4);

    const V3 = new Vykres('drazka', 'Detail lišty v drážce', 'řez kolmo k drážce');
    const sw = s.drazkaS, sh = s.drazkaH;
    if (s.drazkaTyp === 'T') {
      const tw = s.tSirka, th = s.tVyska;
      V3.poly([[-20, 0], [-sw / 2, 0], [-sw / 2, -(sh - th)], [-tw / 2, -(sh - th)], [-tw / 2, -sh], [tw / 2, -sh], [tw / 2, -(sh - th)], [sw / 2, -(sh - th)], [sw / 2, 0], [20, 0], [20, -sh - 6], [-20, -sh - 6]], { s: 0.3, c: '#777777' });
      const lw = L.w / 2, ltw = (s.tSirka - p.vuleLista) / 2, lth = Math.max(1, s.tVyska - 0.5);
      V3.poly([[-ltw, -sh + 0.25], [ltw, -sh + 0.25], [ltw, -sh + 0.25 + lth], [lw, -sh + 0.25 + lth], [lw, 0], [-lw, 0], [-lw, -sh + 0.25 + lth], [-ltw, -sh + 0.25 + lth]], { s: 0.45 });
    } else {
      V3.poly([[-20, 0], [-sw / 2, 0], [-sw / 2, -sh], [sw / 2, -sh], [sw / 2, 0], [20, 0], [20, -sh - 6], [-20, -sh - 6]], { s: 0.3, c: '#777777' });
      V3.obd(-L.w / 2, -L.hr, L.w / 2, 0, { s: 0.45 });
    }
    V3.obd(-20, 0, 20, tl, { s: 0.35 });
    V3.kota([-sw / 2, -sh - 6], [sw / 2, -sh - 6], -4, cz(sw, 2)).kota([-L.w / 2, tl], [L.w / 2, tl], 4, cz(L.w, 2)).kota([sw / 2 + 4, -sh], [sw / 2 + 4, 0], -4, cz(sh, 1)).kota([-sw / 2 - 4, -L.hr], [-sw / 2 - 4, 0], 4, cz(L.hr, 1));

    const zdvih = K + a0 + aT;
    return {
      dily, varovani, vykresy: [V1, V2, V3],
      vysledky: [
        { n: 'Základna', v: `${cz(W)} × ${cz(D)} × ${cz(tl)} mm` },
        { n: 'Kapacita mezi pravítky K', v: cz(K) + ' mm' },
        { n: 'Max. šířka řezu vlevo od kotouče', v: cz(p.sirkaL - 10) + ' mm' },
        { n: 'Vysunutí kotouče nad základnu', v: `${cz(hb)} mm (nad stůl ${cz(e)} mm)` },
        { n: 'Tětiva kotouče na základně', v: cz(2 * a0) + ' mm' },
        { n: 'Kotouč zajede do předního pravítka', v: cz(pruniknuti) + ' mm', zv: pruniknuti > p.predniTl - 5 },
        { n: 'Bezpečnostní blok', v: `${cz(bW)} × ${cz(Lb)} × ${cz(bH)} mm` },
        { n: 'Lišta do drážky', v: `${cz(L.w, 2)} × ${cz(L.hr, 1)} × ${cz(D)} mm${L.nSeg > 1 ? ` (${L.nSeg} díly)` : ''}` },
        { n: 'Pracovní zdvih saní', v: '≈ ' + cz(zdvih) + ' mm' },
        { n: '5 řezů – chyba úhlu', v: `${cz(P5.stupne, 4)}° (${cz(P5.mmNaMetr, 3)} mm/m)`, zv: Math.abs(P5.mmNaMetr) > 0.1 },
        { n: '5 řezů – oprava', v: P5.smer === 'ok' ? 'žádná (A = B)' : `posuňte konec pravítka u stavěcího šroubu o ${cz(P5.posun, 3)} mm ${P5.smer === 'od' ? 'od sebe (dozadu)' : 'k sobě (dopředu)'}` , zv: true },
      ],
      petRezu: P5,
      kusovnik: [
        { p: 'Vrut se zápustnou hlavou 4×' + Math.ceil(tl + L.hr * 0.7 + 2), ks: xs.length * L.ys.length, pozn: 'lišty k základně (předvrtat, zahloubit)' },
        { p: 'Vrut 5×' + (Math.ceil((tl + p.predniTl * 0.8) / 5) * 5), ks: 2, pozn: 'přední pravítko: čep + stavěcí (otvor u stavěcího převrtat na Ø7 pro seřízení)' },
        { p: 'Vrut 4×' + (Math.ceil((tl + p.zadniTl * 0.8) / 5) * 5), ks: Math.max(4, Math.round(W / 120)), pozn: 'zadní pravítko a blok, + lepidlo PVAc' },
        { p: 'Lepidlo PVAc (D3)', ks: 1, pozn: 'vrstvy předního pravítka, bezpečnostní blok' },
        { p: 'Parafín / vosk na kluzné plochy', ks: 1, pozn: 'lišty a spodek základny' },
      ],
      bezpecnost: [
        'Bezpečnostní blok musí krýt místo, kde kotouč vyjíždí z předního pravítka – ruce držte vždy mimo osu prořezu.',
        `Doraz pojezdu: saně zastavte tak, aby kotouč zajel nejvýš ${cz(Math.max(5, p.predniTl - 5))} mm do předního pravítka (výpočet: ${cz(pruniknuti)} mm). Doraz připevněte pod stůl nebo na lištu.`,
        'Kotouč vysuňte jen 3–5 mm nad díl. Odřezky nechte ležet, dokud kotouč nedoběhne a saně nevrátíte zpět.',
        'Nikdy nedržte odřezek v mezeře mezi kotoučem a podélným pravítkem – podélné pravítko při příčném řezu odsuňte.',
        'Rozvírací klín (riving knife) se saněmi obvykle nejde použít – o to víc dbejte na pevné přidržení dílu u předního pravítka.',
      ],
      sestava: { stroj: 'stolni', pohyb: { v: [0, 1, 0], od: -D * 0.9, do: s.stulHloubka / 2 - D + 40 }, obrobky: [{ a: [-p.sirkaL + 40, yF + p.predniTl, tl], b: [80, yF + p.predniTl + Math.min(K, 180), tl + Math.min(p.tlDilu, 25)], pohyb: true }], vyskaKotouce: e },
      info: `Kapacita ${cz(K)} mm mezi pravítky, kotouč ${cz(hb)} mm nad základnou.`,
    };
  };

  /* ---------- pokosové saně 45° ---------- */
  VYP.pokos = function (p, s, N) {
    const varovani = [], tl = p.zakladTl, W = p.sirka, D = p.hloubka, ox = W / 2, R = s.kotoucD / 2;
    const zadniPas = 40, predniPas = 40, ya = D - zadniPas - p.listaMax * Math.SQRT2 - 15;
    const t0 = p.pravTl + p.mezera * Math.SQRT2, t1 = t0 + p.rameno;
    const yKonec = ya - t1 * S2 - p.pravTl * S2;
    if (yKonec < predniPas + 5) varovani.push(`Pravítka jsou pro hloubku saní moc dlouhá – zkraťte rameno na ${cz(Math.max(50, (ya - predniPas - 5 - p.pravTl * S2) / S2 - t0))} mm nebo zvětšete hloubku.`);
    if (ox - t1 * S2 < 10) varovani.push('Pravítka přesahují šířku základny.');
    const hb = p.tlDilu + 5, zH = r1(Math.max(hb + 20, 50));
    const xs = [];
    if (ox >= s.drazkaL + s.drazkaS / 2 + 15) xs.push(-s.drazkaL);
    if (s.drazkaP > 0 && W - ox >= s.drazkaP + s.drazkaS / 2 + 15) xs.push(s.kerf + s.drazkaP);
    if (!xs.length) varovani.push('Žádná drážka neleží pod základnou.');
    const L = listySani(N, s, p, D, xs, 'L', 0);
    const KR = korekceRamu(p.rSirka, p.rMezera, p.rameno);
    // čáry pravítek na základně (pracovní plochy): levé z vrcholu (ox, ya) směrem (−1,−1)
    const bodL = (t) => [ox - t * S2, ya - t * S2], bodP = (t) => [ox + s.kerf + t * S2, ya - t * S2];
    const zakl = deska({
      id: 'A', nazev: 'Základna', material: 'překližka', tl, obrys: obd(0, 0, W, D),
      otvory: [].concat(...xs.map((x) => L.ys.map((y) => ({ x: r2(ox + x), y, d: 4, zap: true }))), [bodL(t0 + 25), bodL(t1 - 25), bodP(t0 + 25), bodP(t1 - 25)].map((q) => ({ x: r2(q[0] + p.pravTl / 2 * S2), y: r2(q[1] - p.pravTl / 2 * S2), d: 4, zap: true }))),
      cary: [{ b: [[ox, 0], [ox, D]], d: 'o' }, { b: [bodL(0), bodL(t1)] }, { b: [bodP(0), bodP(t1)] }, { b: [[0, D - zadniPas], [W, D - zadniPas]] }, { b: [[0, predniPas], [W, predniPas]] }],
      um: um([-ox, 0, 0], [1, 0, 0], [0, 1, 0]), pohyb: true,
    });
    const pl = deska({ id: 'B', nazev: 'Pravítko 45° (levé a pravé)', material: 'překližka / MDF', tl: p.pravTl, ks: 2, obrys: obd(0, 0, p.rameno, p.pravV), pozn: 'pracovní hrana rovná, kolmá k základně', um: um([bodL(t1)[0] - ox, bodL(t1)[1], tl], [S2, S2, 0], [0, 0, 1]), pohyb: true });
    const pp = Object.assign({}, pl, { id: 'B′', um: um([bodP(t0)[0] - ox, bodP(t0)[1], tl], [S2, -S2, 0], [0, 0, 1]), jenNahled: true });
    const zp = deska({ id: 'C', nazev: 'Zadní příčka', material: 'překližka', tl: 18, obrys: obd(0, 0, W, zH), um: um([-ox, D, tl], [1, 0, 0], [0, 0, 1]), pohyb: true, pozn: `výška ≥ ${cz(hb + 20)} mm, aby zůstala celistvá nad prořezem` });
    const pr = deska({ id: 'D', nazev: 'Přední příčka (držadlo a kryt), 2 vrstvy', material: 'překližka', tl: 18, tl3d: 36, ks: 2, obrys: obd(0, 0, W, zH), pozn: 'z 2 × 18 mm, kryje výjezd kotouče', um: um([-ox, predniPas, tl], [1, 0, 0], [0, 0, 1]), pohyb: true });
    const dily = [zakl, pl, pp, zp, pr].concat(L.dily);

    const V1 = new Vykres('pudorys', 'Půdorys pokosových saní', 'pracovní plochy pravítek pod 45° k řezu, vrchol na ose prořezu');
    V1.obd(0, 0, W, D, { s: 0.5 });
    V1.obd(0, D - zadniPas, W, D); V1.obd(0, predniPas - 36, W, predniPas);
    const desk = (A, smer) => { const n = smer < 0 ? [S2, -S2] : [-S2, -S2]; return [A(t0), A(t1), [A(t1)[0] + n[0] * p.pravTl, A(t1)[1] + n[1] * p.pravTl], [A(t0)[0] + n[0] * p.pravTl, A(t0)[1] + n[1] * p.pravTl]]; };
    V1.poly(desk(bodL, -1), { s: 0.45 }); V1.poly(desk(bodP, 1), { s: 0.45 });
    V1.l([bodL(0), bodL(t0)], { d: 'c', s: 0.2, c: '#777777' }); V1.l([bodP(0), bodP(t0)], { d: 'c', s: 0.2, c: '#777777' });
    V1.l([[ox, -10], [ox, D + 10]], { d: 'o', s: 0.25, c: '#b3261e' });
    for (const x of xs) V1.obd(ox + x - L.w / 2, 0, ox + x + L.w / 2, D, { d: 'c', s: 0.25, c: '#555555' });
    V1.t(ox - 10, ya + 18, '90°', { h: 4, a: 'r' }); V1.t(bodL(t1)[0], bodL(t1)[1] + 12, '45°', { h: 4 }); V1.t(bodP(t1)[0], bodP(t1)[1] + 12, '45°', { h: 4, a: 'r' });
    V1.kota([0, 0], [W, 0], -12).kota([W, 0], [W, D], -10).kota(bodL(t0), bodL(t1), 8, cz(p.rameno)).kota([0, ya], [0, 0], 0 + 12, cz(ya));
    V1.kota([ox, D + 4], [ox + xs[0] || ox, D + 4], 8, xs.length ? cz(Math.abs(xs[0])) : '');
    const V2 = new Vykres('ram', 'Kontrola zkušebním rámem', 'spára posledního rohu po slepení tří rohů');
    const rw = p.rSirka, rl = 160;
    V2.poly([[0, 0], [rl, 0], [rl - rw, rw], [rw, rw]]); V2.poly([[0, 0], [rw, rw], [rw, rl - rw], [0, rl]]);
    V2.poly([[0, rl], [rw, rl - rw], [rl - rw, rl - rw], [rl, rl]]); V2.poly([[rl, 0], [rl, rl], [rl - rw, rl - rw], [rl - rw, rw]]);
    V2.t(rl + 8, rl - 4, 'spára g = ' + cz(p.rMezera, 2) + ' mm', { h: 4 }); V2.kota([0, -6], [rl, -6], -4, 'rám');
    V2.kota([rl, rl], [rl - rw, rl - rw], -6, 'm = ' + cz(KR.delkaPokosu, 1));
    return {
      dily, varovani, vykresy: [V1, V2],
      vysledky: [
        { n: 'Základna', v: `${cz(W)} × ${cz(D)} × ${cz(tl)} mm` },
        { n: 'Vrchol pravítek od přední hrany', v: cz(ya) + ' mm' },
        { n: 'Začátek pravítka od vrcholu', v: cz(t0) + ' mm (po pracovní ploše)' },
        { n: 'Max. šířka lišty', v: cz(p.listaMax) + ' mm' },
        { n: 'Délka pokosové plochy zkušebního rámu m', v: cz(KR.delkaPokosu, 1) + ' mm' },
        { n: 'Chyba jednoho pokosu', v: cz(KR.stupne, 4) + '°', zv: KR.stupne > 0.02 },
        { n: 'Úhel mezi pravítky', v: KR.delta === 0 ? '90° (bez spáry)' : `${p.rStrana === 'vnejsi' ? '90° + ' : '90° − '}${cz(KR.rohChyba, 4)}° → opravit` },
        { n: 'Oprava (jedno pravítko)', v: KR.delta === 0 ? '–' : `vzdálený konec pravítka posunout o ${cz(KR.posun, 2)} mm ${p.rStrana === 'vnejsi' ? 'tak, aby se úhel mezi pravítky zmenšil' : 'tak, aby se úhel mezi pravítky zvětšil'}`, zv: KR.delta > 0 },
      ],
      kusovnik: [
        { p: 'Vrut se zápustnou hlavou 4×' + Math.ceil(tl + L.hr * 0.7 + 2), ks: xs.length * L.ys.length, pozn: 'lišty' },
        { p: 'Vrut 4×' + (Math.ceil((tl + p.pravV * 0.5) / 5) * 5), ks: 4, pozn: 'pravítka zespodu (jeden otvor převrtat na Ø6 pro seřízení)' },
        { p: 'Vrut 4×40', ks: 8, pozn: 'příčky + lepidlo' },
        { p: 'Rychloupínka nebo svěrka', ks: 2, pozn: 'přidržení lišty na pravítku (doporučeno)' },
      ],
      bezpecnost: [
        'Lištu přitiskněte k pravítku svěrkou nebo upínkou – u úzkých lišt nikdy nedržte konec rukou u kotouče.',
        'Přední příčka kryje výjezd kotouče: saně posouvejte jen tak daleko, aby kotouč nevyjel z příčky.',
        'Odřezky u vrcholu V odstraňujte až po zastavení kotouče.',
        'Kotouč vysuňte jen 3–5 mm nad lištu; jemnozubý kotouč (60–80 zubů) omezí vytrhávání.',
      ],
      sestava: { stroj: 'stolni', pohyb: { v: [0, 1, 0], od: -D * 0.8, do: 0 }, obrobky: [], vyskaKotouce: tl + hb },
      info: `Pravítka ${cz(p.rameno)} mm pod 45°, vrchol ${cz(ya)} mm od přední hrany.`,
    };
  };

  /* ---------- šablona na čepy ---------- */
  VYP.cepy = function (p, s) {
    const varovani = [], t = p.deskaTl, d = (p.tb + p.tc) / 2;
    if (p.tc >= p.tb) varovani.push('Čep musí být tenčí než díl.');
    if (p.lc > s.kotoucD / 2 - 30) varovani.push('Délka čepu je na tento kotouč příliš velká.');
    const xF = s.kerf + d, mezera = s.podelS + p.vule;
    const cheekH = r1(s.podelV + t - 5), zpet = r1(Math.max(12, Math.min(70, d - 8)));
    if (d - 8 < 15) varovani.push(`Svislý doraz smí vyčnívat z čela jen ${cz(d - 8)} mm (nesmí do kotouče) – je to málo, díl jistěte upínkou.`);
    const celo = deska({ id: 'A', nazev: 'Čelo (dosedací plocha)', material: 'překližka bříza', tl: t, obrys: obd(0, 0, p.celoS, p.celoV), vyrezy: [obround(p.celoS * 0.55, p.celoV - 35, p.celoS * 0.85, p.celoV - 35, 32)], pozn: 'rukojeť = otvor nahoře vzadu',
      um: um([xF, 0, 1], [0, 1, 0], [0, 0, 1]), pohyb: true });
    // um: x → +y, y → +z, n = (0,1,0)×(0,0,1) = (1,0,0) → tloušťka od kotouče ✓
    const bocnice = deska({ id: 'B', nazev: 'Bočnice (druhá strana pravítka)', material: 'překližka', tl: t, obrys: obd(0, 0, p.celoS, cheekH), um: um([xF + t + mezera, 0, s.podelV + t - cheekH], [0, 1, 0], [0, 0, 1]), pohyb: true });
    const most = deska({ id: 'C', nazev: 'Můstek přes pravítko', material: 'překližka', tl: t, obrys: obd(0, 0, p.celoS, r2(mezera)), pozn: `šířka = pravítko ${cz(s.podelS)} + vůle ${cz(p.vule)} mm`, um: um([xF + t, 0, s.podelV], [0, 1, 0], [1, 0, 0]), pohyb: true });
    // um můstku: x → y, y → x, n = (0,1,0)×(1,0,0) = (0,0,−1) → posun o t nahoru
    most.um.o[2] = s.podelV + t;
    const doraz = deska({ id: 'D', nazev: 'Svislý doraz 90°', material: 'překližka', tl: t, obrys: obd(0, 0, zpet, p.celoV - 40), pozn: 'přesně kolmo ke stolu – ověřit úhelníkem', um: um([xF, 20, 1], [-1, 0, 0], [0, 0, 1]), pohyb: true });
    // n = (−1,0,0)×(0,0,1) = (0·1−0·0, 0·0−(−1)·1, 0) = (0,1,0) ✓
    const dily = [celo, bocnice, most, doraz];
    const V1 = new Vykres('cela', 'Pohled ve směru posuvu', 'díl upnutý na čele, odpad na vnější straně kotouče');
    V1.l([[-60, 0], [xF + 2 * t + mezera + 40, 0]], { s: 0.25, c: '#777777' });
    V1.obd(0, -20, s.kerf, p.lc, { c: '#b3261e', s: 0.35 }); V1.t(-3, p.lc + 4, 'kotouč', { h: 3, a: 'r', c: '#b3261e' });
    V1.obd(xF + t + p.vule / 2, 0, xF + t + p.vule / 2 + s.podelS, s.podelV, { c: '#555555' }); V1.t(xF + t + mezera / 2, s.podelV / 2, 'pravítko', { h: 3, a: 'c', c: '#555555' });
    V1.obd(xF, 1, xF + t, p.celoV); V1.obd(xF + t, s.podelV, xF + t + mezera, s.podelV + t); V1.obd(xF + t + mezera, s.podelV + t - cheekH, xF + 2 * t + mezera, s.podelV + t);
    V1.obd(xF - p.tb, 0, xF, Math.min(p.celoV - 20, 160), { d: 'c', c: '#8a6a3e' });
    V1.l([[s.kerf, 0], [s.kerf, p.lc]], { s: 0.2 });
    V1.kota([s.kerf, p.lc + 14], [xF, p.lc + 14], 6, cz(d, 2)).kota([xF - p.tb, -8], [xF, -8], -4, 'díl ' + cz(p.tb)).kota([0, -18], [s.kerf, -18], -4, cz(s.kerf, 1));
    V1.kota([xF - (p.tb + p.tc) / 2, p.lc], [xF - (p.tb - p.tc) / 2, p.lc], -4, 'čep ' + cz(p.tc));
    V1.kota([xF + t, s.podelV + t + 8], [xF + t + mezera, s.podelV + t + 8], 4, cz(mezera, 1));
    V1.kota([xF + 2 * t + mezera + 10, 0], [xF + 2 * t + mezera + 10, p.celoV], -4);
    const V2 = new Vykres('bok', 'Čelo – pohled z boku kotouče');
    kresliDesku(V2, celo, 0, 0);
    V2.obd(20, 1, 20 + t, p.celoV - 39, { c: '#555555' }); V2.t(20 + t + 3, p.celoV - 50, 'doraz', { h: 3 });
    V2.obd(20 + t, 0, 20 + t + 60, Math.min(p.celoV - 20, 160), { d: 'c', c: '#8a6a3e' }); V2.t(20 + t + 4, 8, 'díl', { h: 3, c: '#8a6a3e' });
    V2.kota([0, 0], [p.celoS, 0], -8).kota([p.celoS, 0], [p.celoS, p.celoV], -8);
    return {
      dily, varovani, vykresy: [V1, V2],
      vysledky: [
        { n: 'Čelo šablony → bok kotouče (blíž šabloně)', v: cz(d, 2) + ' mm', zv: true },
        { n: 'Tloušťka odpadu na každé straně', v: cz((p.tb - p.tc) / 2, 2) + ' mm' },
        { n: 'Výška kotouče = délka čepu', v: cz(p.lc) + ' mm' },
        { n: 'Mezera mezi čelem a bočnicí', v: cz(mezera, 1) + ' mm' },
        { n: 'Doraz vyčnívá z čela', v: cz(zpet) + ' mm' },
        { n: 'Postup', v: 'řez 1 → otočit díl druhou plochou k čelu → řez 2 (stejné nastavení = vystředěný čep)' },
      ],
      kusovnik: [
        { p: 'Vodorovná rychloupínka (typická, upínací síla ~ 100 kg)', ks: 1, pozn: 'přitlačí díl k čelu – typ a rozteč děr podle výrobce' },
        { p: 'Vrut 4×40', ks: 10, pozn: 'spoje desek + lepidlo PVAc' },
        { p: 'Vrut 4×30', ks: 4, pozn: 'doraz' },
        { p: 'Vosk / parafín', ks: 1, pozn: 'vnitřní plochy na pravítku' },
      ],
      bezpecnost: [
        'Odpad je na vnější straně kotouče (mimo pravítko) – nikdy nesmí zůstat sevřený mezi kotoučem a šablonou.',
        'Díl vždy upněte upínkou; ruce držte na rukojeti nad pravítkem, ne nad kotoučem.',
        'Ochranný kryt nad kotoučem zde obvykle nejde použít – kotouč vysuňte jen na délku čepu a pracujte pomalu.',
        'Šablona musí jít po pravítku bez vůle do strany, ale bez zadrhávání (vosk).',
        'Osazení (příčný řez) dělejte zvlášť na saních s dorazem, ne na šabloně.',
      ],
      sestava: { stroj: 'stolni', ripX: xF + t + p.vule / 2, ripV: s.podelV, ripS: s.podelS, pohyb: { v: [0, 1, 0], od: -p.celoS - 80, do: 140 }, obrobky: [{ a: [xF - p.tb, 30 + t, 0.5], b: [xF, 30 + t + 60, Math.min(p.celoV - 20, 160)], pohyb: true }], vyskaKotouce: p.lc },
      info: `Nastavte čelo šablony ${cz(d, 2)} mm od kotouče.`,
    };
  };

  /* ---------- hřebínková přítlačka ---------- */
  VYP.hrebinek = function (p, s, N) {
    const varovani = [], al = p.uhel * RAD, Lb = p.delka - p.delkaPrstu, W = p.sirka, tl = p.tl;
    if (Lb < 40) varovani.push('Tělo bez prstů je kratší než 40 mm – zkraťte prsty.');
    if (p.delka > N.stul) varovani.push(`Délka ${cz(p.delka)} mm je větší než tisková plocha ${cz(N.stul)} mm.`);
    if (p.prst < 2) varovani.push('Prsty tenčí než 2 mm se při FDM tisku lámou.');
    const dx = p.delkaPrstu * Math.tan(al);
    // obrys: obdélník těla + rovnoběžník prstů (prsty skloněné o úhel α ke směru posuvu +y)
    const obrys = [[0, 0], [Lb, 0], [Lb + p.delkaPrstu, dx], [Lb + p.delkaPrstu, W + dx], [Lb, W], [0, W]];
    // mezery mezi prsty (tenké rovnoběžníky), krok kolmo = prst + mezera; po ose y krok / cos α
    const krok = (p.prst + p.mezera) / Math.cos(al), mz = p.mezera / Math.cos(al), mezery = [];
    for (let y = p.prst / Math.cos(al); y + mz <= W - p.prst / Math.cos(al) * 0.5; y += krok) mezery.push([[Lb, y], [Lb + p.delkaPrstu + 1, y + dx + Math.tan(al)], [Lb + p.delkaPrstu + 1, y + mz + dx + Math.tan(al)], [Lb, y + mz]]);
    const pocetPrstu = mezery.length + 1;
    const u0 = 12, u1 = u0 + p.drazkaUp, u0p = u0, u1p = u1, yU = [W / 4, (3 * W) / 4], sw = 6.6;
    let telo = C.prism(obrys, 0, tl);
    const sub = mezery.map((m) => C.prism(m, -1, tl + 1)).concat(yU.map((y) => C.prism(obround(u0, y, u1, y, sw), -1, tl + 1)));
    // zahloubení pro podložku nahoře (Ø18, 2 mm)
    sub.push(...yU.map((y) => C.prism(obround(u0, y, u1, y, 18.5), tl - 2, tl + 1)));
    telo = C.sub(telo, sub);
    const V1 = new Vykres('shora', 'Přítlačka – pohled shora');
    V1.poly(obrys, { s: 0.45 }); mezery.forEach((m) => V1.poly(m, { s: 0.2 })); yU.forEach((y) => { V1.poly(obround(u0, y, u1, y, sw), { s: 0.3 }); V1.poly(obround(u0, y, u1, y, 18.5), { s: 0.15, d: 'c' }); });
    V1.kota([0, 0], [p.delka, 0], -8).kota([0, 0], [0, W], 8).kota([Lb, W + dx + 4], [p.delka, W + dx + 4], 4, cz(p.delkaPrstu));
    V1.t(Lb + p.delkaPrstu / 2, -14, `${pocetPrstu} prstů ${cz(p.prst, 1)} mm, mezera ${cz(p.mezera, 1)}, sklon ${cz(p.uhel)}°`, { h: 3.2, a: 'c' });
    V1.l([[p.delka + 10, W / 2 - 15], [p.delka + 10, W / 2 + 15]], { s: 0.4 }).l([[p.delka + 7, W / 2 + 10], [p.delka + 10, W / 2 + 15], [p.delka + 13, W / 2 + 10]], { s: 0.4 }).t(p.delka + 15, W / 2, 'posuv', { h: 3.5 });
    const dily = [];
    const xSlot = -s.drazkaL, xTip = xSlot - (u0p + u1p) / 2 + p.delka, y0w = 200;
    dily.push(tisk({ id: 'A', nazev: 'Hřebínková přítlačka', material: N.materialTisk, csg: telo, pohledy: [V1],
      napis: N.oznaceni ? { txt: 'PT' + Math.round(p.uhel), plocha: 'z+', f: tl, x: 4, y: W / 2 - 3, h: 6 } : null,
      pozn: `tiskněte naplocho; ${N.materialTisk === 'PLA' ? 'PLA je křehčí – prsty raději z PETG' : 'PETG pruží a nepraská'}; 3–4 perimetry, výplň 30 %`,
      um: um([xTip - p.delka, y0w - W / 2, 0], [1, 0, 0], [0, 1, 0]) }));
    let lista = null;
    if (p.upevneni === 'lista') {
      const T = s.drazkaTyp === 'T', w = r2(s.drazkaS - N.vule), h = r2(s.drazkaH - 0.5), Lr = Math.max(p.delkaListy, W + 20);
      if (Lr > N.stul) varovani.push('Lišta je delší než tisková plocha.');
      const yb = [Lr / 2 - W / 4, Lr / 2 + W / 4];
      let csg, V2 = new Vykres('pr', 'Lišta – průřez'), pozn;
      if (T) {
        const tw = r2(s.tSirka - N.vule), th = r2(Math.max(1.2, s.tVyska - 0.5)), cy = tw / 2;
        csg = C.sub(C.add(C.box([0, 0, 0], [Lr, tw, th]), C.box([0, (tw - w) / 2, th - 0.01], [Lr, (tw + w) / 2, h])),
          yb.map((x) => C.cyl('z', [x, cy], 3.25, -1, h + 1)), yb.map((x) => C.hex('z', [x, cy], 10.2, -1, Math.min(5.2, th + 2))));
        V2.poly([[0, 0], [tw, 0], [tw, th], [(tw + w) / 2, th], [(tw + w) / 2, h], [(tw - w) / 2, h], [(tw - w) / 2, th], [0, th]]);
        V2.kota([0, 0], [tw, 0], -4, cz(tw, 2)).kota([(tw - w) / 2, h], [(tw + w) / 2, h], 4, cz(w, 2)).kota([tw + 3, 0], [tw + 3, h], -4, cz(h, 1));
        pozn = 'T-lišta: šroub M6 s maticí v kapse, při utažení se lišta zapře o hrany T-drážky. Lištu zasuňte z konce drážky.';
        if (th + 2 > h - 2) varovani.push('Kapsa na matici je v T-liště moc vysoká – zvětšete výšku spodku T.');
      } else {
        // rozpěrná lišta: podélný prořez + kuželové zahloubení zespodu pro šroub se zápustnou hlavou M6
        csg = C.sub(C.box([0, 0, 0], [Lr, w, h]), C.box([12, w / 2 - 0.75, -1], [Lr - 12, w / 2 + 0.75, h + 1]),
          yb.map((x) => C.cyl('z', [x, w / 2], 3.25, -1, h + 1)), yb.map((x) => C.cyl('z', [x, w / 2], 6.3, -0.01, 3.1, 3.2)));
        V2.obd(0, 0, w, h); V2.l([[w / 2 - 0.75, 0], [w / 2 - 0.75, h]], { s: 0.2 }); V2.l([[w / 2 + 0.75, 0], [w / 2 + 0.75, h]], { s: 0.2 });
        V2.poly([[w / 2 - 6.3, 0], [w / 2 + 6.3, 0], [w / 2 + 3.2, 3.1], [w / 2 - 3.2, 3.1]], { s: 0.2, d: 'c' });
        V2.kota([0, h], [w, h], 4, cz(w, 2)).kota([w + 3, 0], [w + 3, h], -4, cz(h, 1));
        pozn = 'Rozpěrná lišta: šroub M6 se zápustnou hlavou zespodu; utažením knoflíku se kužel hlavy vtáhne a roztáhne lištu v drážce.';
        if (w < 14) varovani.push('Drážka je úzká pro zápustnou hlavu M6 (Ø12) – použijte M5.');
      }
      const V3 = new Vykres('shora', 'Lišta – pohled shora'); V3.obd(0, 0, Lr, T ? s.tSirka - N.vule : w); yb.forEach((x) => V3.k(x, (T ? s.tSirka - N.vule : w) / 2, 3.25)); V3.kota([0, 0], [Lr, 0], -5).kota([yb[0], -2], [yb[1], -2], -10, cz(W / 2));
      const tw2 = T ? s.tSirka - N.vule : w;
      lista = tisk({ id: 'B', nazev: T ? 'T-lišta do drážky' : 'Rozpěrná lišta do drážky', material: N.materialTisk, csg, pohledy: [V2, V3], pozn,
        tiskPozn: T ? 'spodkem T na podložce, bez podpěr' : 'tiskne se vleže, kuželové zahloubení zespodu má převis 45° – bez podpěr',
        napis: null, um: um([xSlot + tw2 / 2, y0w - Lr / 2, -(s.drazkaH - 0.25)], [0, 1, 0], [-1, 0, 0]) });
      dily.push(lista);
    }
    const sroub = Math.ceil((tl + (s.drazkaH - 0.5) + 4) / 5) * 5;
    return {
      dily, varovani, vykresy: [V1].concat(lista ? lista.pohledy : []),
      vysledky: [
        { n: 'Počet prstů', v: String(pocetPrstu) },
        { n: 'Sklon prstů', v: cz(p.uhel) + '° od kolmice ke směru posuvu' },
        { n: 'Posun konců prstů', v: cz(dx, 1) + ' mm' },
        { n: 'Lišta', v: p.upevneni === 'lista' ? `${cz(s.drazkaS - N.vule, 2)} mm (drážka ${cz(s.drazkaS, 2)} − vůle ${cz(N.vule, 2)})` : 'bez lišty' },
        { n: 'Předpětí', v: 'prsty nastavte tak, aby se díl vsunul s prohnutím 2–3 mm' },
      ],
      kusovnik: p.upevneni === 'lista' ? [
        { p: s.drazkaTyp === 'T' ? `Šroub M6×${sroub} s šestihrannou hlavou (nebo závitová tyč)` : `Šroub M6×${sroub} se zápustnou hlavou (DIN 7991 / ISO 10642)`, ks: 2, pozn: 'zespodu lišty' },
        { p: s.drazkaTyp === 'T' ? 'Matice M6 (do kapsy v liště)' : '–', ks: s.drazkaTyp === 'T' ? 2 : 0, pozn: '' },
        { p: 'Knoflík s vnitřním závitem M6 / křídlová matice M6', ks: 2, pozn: 'nahoře' },
        { p: 'Podložka M6 velká (Ø18)', ks: 2, pozn: 'do zahloubení' },
      ].filter((q) => q.ks) : [{ p: 'Svěrka (F-svěrka)', ks: 1, pozn: 'přichycení ke stolu' }],
      bezpecnost: [
        'Přítlačku umístěte PŘED kotouč (na straně přívodu) – nikdy ne vedle kotouče, jinak sevře řez a hrozí zpětný vrh.',
        'Přítlačka tlačí díl k pravítku; odřezek mezi kotoučem a pravítkem nesmí být sevřen – při podélném řezu používejte rozvírací klín.',
        'Prsty musí ukazovat ve směru posuvu: díl jde dopředu volně, dozadu se zasekne (brání zpětnému vrhu).',
        'Konec dílu dotlačte posunovací tyčí – ruka nesmí jít mezi přítlačku a kotouč.',
      ],
      sestava: { stroj: 'stolni', ripX: 80, ripV: s.podelV, ripS: s.podelS, pohyb: { v: [0, 1, 0], od: 0, do: 300 }, obrobky: [{ a: [xTip, y0w - 300, 0], b: [80, y0w + 100, 19], pohyb: true }], vyskaKotouce: 24 },
      info: `${pocetPrstu} prstů, lišta ${p.upevneni === 'lista' ? (s.drazkaTyp === 'T' ? 'T' : 'rozpěrná') : 'žádná'}.`,
    };
  };

  /* ---------- nulová vložka ---------- */
  VYP.vlozka = function (p, s) {
    const varovani = [], L = p.L, W = p.W, r = Math.min(p.r, W / 2), R = s.kotoucD / 2;
    const obrys = zaoblObd(0, 0, L, W, r, 12);
    const yk = p.kotoucY, ns = +p.srouby, otvory = [];
    if (yk + s.kerf > W - 8) varovani.push('Kotouč je moc blízko pravé hrany vložky.');
    const sx = [Math.max(r * 0.6, 12) + 4, L - Math.max(r * 0.6, 12) - 4];
    if (ns === 6) sx.splice(1, 0, L / 2);
    if (ns >= 2) for (const x of sx.slice(0, ns === 2 ? 2 : sx.length)) for (const y of (ns === 2 ? [W / 2 + (yk < W / 2 ? 1 : -1) * W * 0.3] : [8, W - 8])) {
      const yy = ns === 2 ? (x === sx[0] ? 8 : W - 8) : y;
      if (Math.abs(yy - (yk + s.kerf / 2)) < 8) continue;
      otvory.push({ x: r2(x), y: r2(yy), d: p.sroubD, pozn: 'stavěcí šroub' });
    }
    if (p.prstD > 0) otvory.push({ x: r2(Math.max(p.prstD / 2 + 10, r)), y: r2(yk + s.kerf + (W - yk - s.kerf) / 2), d: p.prstD, pozn: 'otvor na prst' });
    const vyrezy = [];
    if (p.startD > 0) {
      const a = Math.max(15, p.kotoucX - p.startD / 2), b = Math.min(L - 15, p.kotoucX + p.startD / 2);
      vyrezy.push(obround(a, yk + s.kerf / 2, b, yk + s.kerf / 2, Math.max(s.kerf + 3, 6)));
    }
    const ch = 2 * polotetiva(R, 25 + p.tl, 0);
    if (p.kotoucX - ch / 2 < 10 || p.kotoucX + ch / 2 > L - 10) varovani.push('Při vysunutí 25 mm by kotouč prořízl konec vložky – zkontrolujte polohu středu kotouče.');
    const v = deska({ id: 'A', nazev: 'Nulová vložka', material: 'překližka / MDF / HPL', tl: p.tl, obrys, otvory, vyrezy,
      cary: [{ b: [[0, yk], [L, yk]], d: 'o' }, { b: [[p.kotoucX, 0], [p.kotoucX, W]], d: 'o' }], pozn: 'hrany sražené 0,5 mm; stavěcí šrouby do závitu M5 / zarážecí matice',
      um: um([-yk, s.stulHloubka / 2 - p.kotoucX, 0.3], [0, 1, 0], [1, 0, 0]) });
    const o = p.zpusob === 'krouzek' ? offsetKrouzku(p.krouzekD, p.frezaD) : 0;
    if (p.zpusob === 'krouzek' && o <= 0) varovani.push('Kopírovací kroužek musí být větší než fréza.');
    const sab = deska({ id: 'B', nazev: p.zpusob === 'krouzek' ? `Šablona pro kroužek (zmenšená o ${cz(o, 2)} mm)` : 'Šablona pro frézu s ložiskem', material: 'MDF 12 mm', tl: 12,
      obrys: o > 0 ? zaoblObd(o, o, L - o, W - o, Math.max(0, r - o), 12) : obrys, cary: [{ b: [[0, yk], [L, yk]], d: 'o' }], pozn: 'z rovného MDF; hrany přebrousit do hladka – každá vada se okopíruje',
      um: um([-yk, s.stulHloubka / 2 - p.kotoucX, 80], [0, 1, 0], [1, 0, 0]), jenNahled: true });
    const V1 = new Vykres('vlozka', 'Nulová vložka – pohled shora');
    kresliDesku(V1, v, 0, 0);
    V1.kota([0, 0], [L, 0], -8).kota([L, 0], [L, W], -8).kota([0, W], [p.kotoucX, W], 8, cz(p.kotoucX)).kota([0, 0], [0, yk], 10, cz(yk));
    if (r > 0) V1.t(L - r, W + 4, 'R ' + cz(r), { h: 3.2 });
    otvory.forEach((q) => V1.t(q.x + q.d / 2 + 1, q.y + 1, 'Ø' + cz(q.d, 1), { h: 2.6 }));
    const V2 = new Vykres('sablona', 'Šablona tvaru');
    kresliDesku(V2, sab, 0, 0); if (o > 0) V2.poly(obrys, { d: 'c', s: 0.2, c: '#777777' });
    V2.kota([o, o], [L - o, o], -8).kota([L - o, o], [L - o, W - o], -8);
    return {
      dily: [v, sab], varovani, vykresy: [V1, V2],
      vysledky: [
        { n: 'Vložka', v: `${cz(L)} × ${cz(W)} × ${cz(p.tl, 1)} mm, R ${cz(r)}` },
        { n: 'Šablona', v: o > 0 ? `zmenšená o ${cz(o, 2)} mm = (Ø kroužku ${cz(p.krouzekD, 1)} − Ø frézy ${cz(p.frezaD, 1)}) / 2` : 'stejný obrys jako vložka' },
        { n: 'Prořez kotoučem', v: `od ${cz(yk)} do ${cz(yk + s.kerf, 1)} mm od levé hrany` },
        { n: 'Délka prořezu při vysunutí 25 mm', v: cz(ch) + ' mm' },
      ],
      kusovnik: [
        { p: 'Stavěcí šroub M5×10 s vnitřním šestihranem (červík)', ks: otvory.filter((q) => q.pozn === 'stavěcí šroub').length, pozn: 'do závitu vyřezaného ve vložce nebo zarážecí matice' },
        { p: 'Oboustranná lepicí páska', ks: 1, pozn: 'přichycení šablony na polotovar' },
        { p: 'Kopírovací fréza s ložiskem / kopírovací kroužek', ks: 1, pozn: p.zpusob === 'krouzek' ? `kroužek Ø${cz(p.krouzekD, 1)}, fréza Ø${cz(p.frezaD, 1)}` : 'ložisko nahoře (šablona navrchu)' },
      ],
      bezpecnost: [
        'Prořez vytvořte zvedáním kotouče skrz vložku, kterou přidržuje přes ni položená deska upnutá k pravítku – NE rukou.',
        'Vložka musí lícovat se stolem (stavěcí šrouby) – vyčnívající přední hrana zachytí díl a hrozí zpětný vrh.',
        'Zadní zámek (kolík / jazýček) vložky musí bránit jejímu vytržení kotoučem nahoru.',
        'Pro každý kotouč (tloušťka, náklon) zvláštní vložku; s rozvíracím klínem prořízněte drážku i pro klín.',
      ],
      sestava: { stroj: 'stolni', vlozka: { L, W, yk, kx: p.kotoucX }, pohyb: { typ: 'kotouc', od: 0, do: 25 + p.tl }, obrobky: [], vyskaKotouce: 25 },
      info: `Šablona ${o > 0 ? 'zmenšená o ' + cz(o, 2) + ' mm' : '1:1'}.`,
    };
  };

  /* ---------- vodítko ruční okružní pily ---------- */
  VYP.voditko = function (p, s, N) {
    const varovani = [], M = offsetVoditka(p.a1, p.a2, p.lm, p.kerf, p.patkaW), o = M.offset;
    if (!M.rovnobezne) varovani.push(`Kotouč není rovnoběžný s hranou patky (rozdíl ${cz(M.odchylka, 2)} mm na ${cz(p.lm)} mm) – seřiďte pilu, jinak se řez pálí a hrozí zpětný vrh.`);
    if (o > p.patkaW - 10) varovani.push('Offset je větší než šířka patky – zkontrolujte měření.');
    const Wz = r1(p.pravW + o + p.prorez), Lr = p.delka + 2 * p.nabeh, nSeg = Math.ceil(Lr / p.maxDeska - 1e-9), segL = r1(Lr / nSeg);
    const dily = [], tlZ = p.zakladTl, tlP = p.pravTl;
    // šrouby po 150 mm v ose pravítka
    const nS = Math.max(2, Math.ceil(Lr / 150) + 1), xsS = []; for (let i = 0; i < nS; i++) xsS.push(r1(20 + (Lr - 40) * i / (nS - 1)));
    for (let i = 0; i < nSeg; i++) dily.push(deska({ id: 'Z' + (i + 1), nazev: 'Základna' + (nSeg > 1 ? ` ${i + 1}/${nSeg}` : ''), material: 'MDF / HDF (hladká)', tl: tlZ, obrys: obd(0, 0, segL, Wz),
      cary: [{ b: [[0, p.pravW], [segL, p.pravW]] }, { b: [[0, p.pravW + o], [segL, p.pravW + o]], d: 'o' }], pozn: `hrana vznikne zaříznutím: ${cz(p.prorez)} mm odpadne`, um: um([i * segL, 0, 0], [1, 0, 0], [0, 1, 0]) }));
    // pravítko: spoje přesazené o polovinu segmentu
    const delky = nSeg === 1 ? [Lr] : [segL / 2].concat(Array(nSeg - 1).fill(segL), [segL / 2]);
    let x0 = 0;
    delky.forEach((d, i) => {
      const otv = xsS.filter((x) => x > x0 + 8 && x < x0 + d - 8).map((x) => ({ x: r2(x - x0), y: r2(p.pravW / 2), d: 3.5, zap: true }));
      dily.push(deska({ id: 'P' + (i + 1), nazev: 'Pravítko' + (delky.length > 1 ? ` ${i + 1}/${delky.length}` : ''), material: 'překližka (tovární rovná hrana na straně pily)', tl: tlP, obrys: obd(0, 0, d, p.pravW), otvory: otv, um: um([x0, 0, tlZ], [1, 0, 0], [0, 1, 0]) }));
      x0 += d;
    });
    // tisk: koncovky (pravá a zrcadlová levá) a přítlačné botky
    const st = 3, Lc = 30, Hc = st + tlP + tlZ, Xc = st + p.pravW - 1;
    const koncovka = () => C.sub(C.add(C.box([0, 0, 0], [Xc, Lc + st, st]), C.box([0, 0, 0], [st, Lc + st, Hc]), C.box([0, Lc, 0], [Xc, Lc + st, Hc])),
      [10, 22].map((y) => C.cyl('z', [st + p.pravW / 2, y], 2.25, -1, st + 1)), [10, 22].map((y) => C.cyl('z', [st + p.pravW / 2, y], 4.3, -0.01, 2.05, 2.25)));
    const Vk = new Vykres('k', 'Koncovka – řez'); Vk.poly([[0, 0], [Xc, 0], [Xc, st], [st, st], [st, Hc], [0, Hc]]); Vk.obd(st, st, st + p.pravW, st + tlP, { d: 'c', s: 0.2, c: '#777777' });
    Vk.kota([0, 0], [Xc, 0], -4).kota([0, 0], [0, Hc], 4).t(st + 4, st + tlP + 3, 'pravítko (obráceně – tisk)', { h: 2.6, c: '#777777' });
    const kc = koncovka();
    dily.push(tisk({ id: 'K1', nazev: 'Koncovka pravítka – konec', material: N.materialTisk, csg: kc, pohledy: [Vk], pozn: 'přišroubovat 2 vruty 4×20, kryje čela pravítka i základny', tiskPozn: 'horní plochou na podložce; bez podpěr; označení vynecháno (malá plocha)',
      um: um([Lr - Lc, -st, tlZ + tlP + st], [0, 1, 0], [1, 0, 0]) }));
    // K1: x → +y, y → +x, n = (0,1,0)×(1,0,0) = (0,0,−1) ✓ (tisková z dolů)
    dily.push(tisk({ id: 'K2', nazev: 'Koncovka pravítka – začátek (zrcadlová)', material: N.materialTisk, csg: zrcadliX(kc, Xc), pohledy: [Vk], pozn: 'zrcadlový kus ke K1', tiskPozn: 'jako K1',
      um: um([Lc, -st + Xc, tlZ + tlP + st], [0, -1, 0], [-1, 0, 0]) }));
    // K2: x → −y (zrcadlo kompenzuje), y → −x, n = (0,−1,0)×(−1,0,0) = (0,0,−1) ✓
    if (p.svorek > 0) {
      const H0 = tlZ + tlP, Wf = p.pravW - 8, prof = [[0, 1], [st + 1, 1], [st + 1, H0], [st + Wf, H0], [st + Wf, H0 + 6 + 2.5], [st + Wf - 4, H0 + 6 + 2.5], [st + Wf - 4, H0 + 6], [0, H0 + 6]];
      const Vb = new Vykres('b', 'Přítlačná botka – profil'); Vb.poly(prof); Vb.obd(st + 1, 0, st + 1 + p.pravW, H0, { d: 'c', s: 0.2, c: '#777777' }); Vb.kota([0, H0 + 9], [st + Wf, H0 + 9], 4).kota([-4, 1], [-4, H0 + 6], 4);
      dily.push(tisk({ id: 'S1', nazev: 'Přítlačná botka svěrky', material: N.materialTisk, ks: p.svorek, csg: C.prism(prof, 0, 40), pohledy: [Vb],
        napis: N.oznaceni ? { txt: 'S1', plocha: 'z+', f: 40, x: 0.6, y: H0 * 0.35, h: Math.min(6, H0 * 0.5) } : null,
        pozn: 'čelist F-svěrky tlačí na botku nad pravítkem; okraj u pily drží čelist mimo dráhu patky', tiskPozn: 'profilem na podložce (výška tisku 40 mm), bez podpěr',
        um: um([Lr * 0.3, -st - 1, 0], [0, 1, 0], [0, 0, 1]) }));
    }
    const V1 = new Vykres('rez', 'Řez vodítkem s pilou', 'základna po zaříznutí, kotouč na hraně');
    V1.obd(-20, -18, p.pravW + o + 120, 0, { s: 0.25, c: '#8a6a3e' }); V1.t(-18, -12, 'řezaný díl', { h: 3, c: '#8a6a3e' });
    V1.obd(0, 0, p.pravW + o, tlZ); V1.obd(p.pravW + o, 0, Wz, tlZ, { d: 'c', s: 0.2, c: '#777777' });
    V1.obd(0, tlZ, p.pravW, tlZ + tlP);
    V1.obd(p.pravW, tlZ, p.pravW + p.patkaW, tlZ + 4, { c: '#555555' }); V1.t(p.pravW + p.patkaW / 2, tlZ + 7, 'patka pily', { h: 3, a: 'c', c: '#555555' });
    V1.obd(p.pravW + o, -22, p.pravW + o + p.kerf, tlZ + 40, { c: '#b3261e' }); V1.t(p.pravW + o + p.kerf + 2, tlZ + 34, 'kotouč', { h: 3, c: '#b3261e' });
    V1.kota([p.pravW, tlZ + 50], [p.pravW + o, tlZ + 50], 4, 'offset ' + cz(o, 2)).kota([0, tlZ + tlP + 8], [p.pravW, tlZ + tlP + 8], 4).kota([0, -26], [Wz, -26], -4, cz(Wz) + ' před zaříznutím').kota([p.pravW + o, -34], [p.pravW + o + p.kerf, -34], -4, cz(p.kerf, 2));
    V1.kota([-8, 0], [-8, tlZ], 4, cz(tlZ)).kota([-8, tlZ], [-8, tlZ + tlP], 4, cz(tlP));
    const V2 = new Vykres('pud', 'Půdorys vodítka', 'spoje pravítka přesazené proti spojům základny');
    V2.obd(0, 0, Lr, Wz, { s: 0.4 }); for (let i = 1; i < nSeg; i++) V2.l([[i * segL, 0], [i * segL, Wz]], { s: 0.3 });
    x0 = 0; delky.forEach((d) => { V2.obd(x0, 0, x0 + d, p.pravW, { s: 0.35 }); x0 += d; });
    xsS.forEach((x) => V2.k(x, p.pravW / 2, 3));
    V2.l([[-10, p.pravW + o], [Lr + 10, p.pravW + o]], { d: 'o', s: 0.2, c: '#b3261e' });
    V2.kota([0, 0], [Lr, 0], -10).kota([0, 0], [p.nabeh, 0], -22, 'náběh ' + cz(p.nabeh)).kota([Lr, 0], [Lr, Wz], -8);
    return {
      dily, varovani, vykresy: [V1, V2],
      vysledky: [
        { n: 'Offset kotouče (hrana patky → bok zubů)', v: cz(o, 2) + ' mm', zv: true },
        { n: 'Rovnoběžnost kotouče', v: `${cz(M.odchylka, 2)} mm na ${cz(p.lm)} mm (${cz(M.uhel, 3)}°)`, zv: !M.rovnobezne },
        { n: 'Pravítko bez základny – od rysky (patka u pravítka)', v: cz(o, 2) + ' mm (ryska na straně dílu, odpad za kotoučem)' },
        { n: 'Pravítko u druhé hrany patky – od rysky', v: cz(M.druhaStrana, 2) + ' mm (k bližšímu boku zubů)' },
        { n: 'Šířka základny před zaříznutím', v: cz(Wz) + ' mm' },
        { n: 'Délka vodítka', v: `${cz(Lr)} mm (${nSeg} ${nSeg === 1 ? 'díl' : 'díly'} základny, ${delky.length} pravítka)` },
      ],
      kusovnik: [
        { p: 'Vrut se zápustnou hlavou 3,5×' + Math.max(10, Math.floor((tlZ + tlP - 2) / 2) * 2), ks: nS, pozn: 'pravítko k základně shora, po 150 mm (hlavy zapustit)' },
        { p: 'Lepidlo PVAc', ks: 1, pozn: 'pravítko na základnu' },
        { p: 'Vrut 4×20', ks: 4, pozn: 'koncovky' },
        { p: 'F-svěrka', ks: Math.max(2, p.svorek), pozn: 'upnutí vodítka k dílu' },
        { p: 'Protiskluzová páska / brusné plátno', ks: 1, pozn: 'spodek základny (volitelně)' },
      ],
      bezpecnost: [
        'Vodítko vždy upněte svěrkami – volně ležící vodítko se při zpětném vrhu posune.',
        'Pilu veďte patkou stále u pravítka, rovnoměrným posuvem; nezvedejte zadní část patky.',
        'Díl podepřete po obou stranách řezu tak, aby se prořez nesvíral (riziko zpětného vrhu). Rozvírací klín pily nechte namontovaný.',
        'Hloubku řezu nastavte jen o 3–5 mm víc než tloušťka dílu + základny.',
        'Svěrky ani kabel nesmí ležet v dráze patky a motoru.',
      ],
      sestava: { stroj: 'okruzni', offset: o, patkaW: p.patkaW, kerf: p.kerf, pravW: p.pravW, Lr, tlZ, tlP, pohyb: { v: [1, 0, 0], od: 0, do: Lr - 300 }, obrobky: [{ a: [p.nabeh - 40, -150, -18], b: [Lr - p.nabeh + 40, p.pravW + o + 300, 0] }] },
      info: `Offset ${cz(o, 2)} mm, základna ${cz(Wz)} mm.`,
    };
  };

  /* ---------- doraz na délku ---------- */
  VYP.doraz = function (p, s, N) {
    const varovani = [], st = p.stena, g = p.pravTl + N.vule, H = p.pravV, zn = Math.max(st, 11);
    if (p.zadniNoha < 14) varovani.push('Zadní noha je krátká pro šroub M6.');
    // profil (x = u + presah, y = v); u = 0 je přední plocha pravítka
    const u = (x) => x + p.presah, zk = Math.min(p.zkoseni, p.presah - 3, 8);
    const prof = [[u(-p.presah), 0.5], [u(-zk), 0.5], [u(0), 0.5 + zk], [u(0), H], [u(g), H], [u(g), H - p.zadniNoha], [u(g + zn), H - p.zadniNoha], [u(g + zn), H + st], [u(-p.presah), H + st]];
    const vb = H - p.zadniNoha / 2;
    const csg = C.sub(C.prism(prof, 0, p.sirka), C.cyl('x', [vb, p.sirka / 2], 3.3, u(g) - 1, u(g + zn) + 1), C.hex('x', [vb, p.sirka / 2], 10.2, u(g + zn) - 5.5, u(g + zn) + 1));
    const V1 = new Vykres('prof', 'Doraz – profil', 'nasazený přes pravítko, šroub M6 tlačí na zadní plochu');
    V1.obd(u(0) + N.vule / 2, 0, u(p.pravTl) + N.vule / 2, H, { d: 'c', s: 0.2, c: '#777777' }); V1.t(u(p.pravTl / 2), H / 3, 'pravítko', { h: 3, a: 'c', u: 90, c: '#777777' });
    V1.l([[-10, 0], [u(g + zn) + 20, 0]], { s: 0.2, c: '#777777' });
    V1.poly(prof); V1.l([[u(g), vb], [u(g + zn) + 8, vb]], { d: 'o', s: 0.2 });
    V1.kota([u(-p.presah), H + st + 6], [u(0), H + st + 6], 4).kota([u(0), H + st + 14], [u(g), H + st + 14], 4, cz(g, 2)).kota([u(-p.presah) - 6, 0.5], [u(-p.presah) - 6, H + st], 4).kota([u(g + zn) + 6, H - p.zadniNoha], [u(g + zn) + 6, H + st], -4);
    const V2 = new Vykres('cel', 'Doraz – pohled zepředu');
    V2.obd(0, 0.5, p.sirka, H + st); V2.l([[0, 0.5 + zk], [p.sirka, 0.5 + zk]], { s: 0.2, d: 'c' }); V2.kota([0, -4], [p.sirka, -4], -4);
    const dil = tisk({ id: 'A', nazev: 'Doraz na délku', material: N.materialTisk, csg, pohledy: [V1, V2],
      napis: N.oznaceni ? { txt: String(Math.round(p.pravV)) + '-' + String(Math.round(p.pravTl)), plocha: 'z+', f: p.sirka, x: u(-p.presah) + 2, y: H - 16, h: 5 } : null,
      pozn: 'čelní plocha (z = 0 při tisku) je doraz – leží na podložce, je proto rovná', tiskPozn: 'profilem na podložce, bez podpěr; vodorovný otvor Ø6,6 a kapsa matice se tisknou přemostěním',
      um: um([p.delkaDilu, -p.presah, 0], [0, 1, 0], [0, 0, 1]) });
    // um: x → +y (u), y → +z, n = (0,1,0)×(0,0,1) = (1,0,0) → šířka dorazu od délky dílu dál od kotouče ✓
    return {
      dily: [dil], varovani, vykresy: [V1, V2],
      vysledky: [
        { n: 'Vnitřní mezera na pravítko', v: `${cz(g, 2)} mm (pravítko ${cz(p.pravTl, 1)} + vůle ${cz(N.vule, 2)})` },
        { n: 'Doraz nad stolem', v: '0,5 mm (nedře o stůl)' },
        { n: 'Drážka na prach', v: cz(zk, 1) + ' mm zkosení v rohu pravítko/stůl' },
        { n: 'Nastavení', v: `délka dílu ${cz(p.delkaDilu)} mm = od boku zubů na straně dorazu k čelní ploše dorazu` },
      ],
      kusovnik: [
        { p: 'Šroub M6×' + (Math.ceil((zn + 6) / 5) * 5) + ' s rýhovanou / křídlovou hlavou', ks: 1, pozn: 'zezadu, tlačí na pravítko' },
        { p: 'Matice M6', ks: 1, pozn: 'do šestihranné kapsy' },
        { p: 'Kroužek z gumy / PU (volitelně)', ks: 1, pozn: 'pod hrot šroubu, nepoškodí pravítko' },
      ],
      bezpecnost: [
        'U pokosové pily nikdy nepoužívejte doraz na straně odřezku pro krátké kusy, které by se sevřely mezi doraz a kotouč – doraz dejte na stranu dílu a odřezek nechte volný.',
        'Odřezky odstraňujte až po zastavení kotouče a zvednutí hlavy.',
        'Ruku na dílu držte nejméně 150 mm od kotouče (podle značky na stole pily).',
        'Při řezání krátkých dílů použijte přítlak nebo upínku – nedržte je prsty u kotouče.',
      ],
      sestava: { stroj: 'pokosova', pravV: p.pravV, pravTl: p.pravTl, pohyb: { typ: 'hlava' }, obrobky: [{ a: [-200, -60, 0], b: [p.delkaDilu, 0, 30] }] },
      info: `Na pravítko ${cz(p.pravV)} × ${cz(p.pravTl)} mm.`,
    };
  };

  /* ---------- posunovače ---------- */
  VYP.posunovac = function (p, s, N) {
    const varovani = [], al = p.uhel * RAD, L = p.delka, hn = p.patka, Ls = p.delkaBota, Lt = 14, H = p.vyska, g = p.sirkaRuk;
    if (hn >= p.tlDilu) varovani.push(`Patka tyče (${cz(hn)} mm) je vyšší než nejtenčí díl (${cz(p.tlDilu)} mm) – zachytila by o stůl/kotouč.`);
    if (p.blokPatka >= p.tlDilu) varovani.push(`Patka bloku (${cz(p.blokPatka)} mm) je vyšší než nejtenčí díl.`);
    // tyč: x dozadu od špičky, y nahoru (y = 0 je spodek patky)
    const x1 = Ls + Lt, yL = hn + (L - x1) * Math.tan(al);
    const Q = [L - g * Math.sin(al), yL + g * Math.cos(al)], tt = (Q[1] - (hn + H)) / Math.sin(al), xk = Q[0] - tt * Math.cos(al);
    const tyc = [[0, hn], [Ls, hn], [Ls, 0], [x1, 0], [L, yL], Q, [Math.max(Ls * 0.4, xk), hn + H], [0, hn + H]];
    const ph = [L - g * 0.8 * Math.sin(al) - 18 * Math.cos(al), yL + g * 0.5 * Math.cos(al) - 18 * Math.sin(al)];
    const bb = bbox(tyc);
    const fit = bb.w <= N.stul && bb.h <= N.stul ? 'rovně' : Math.hypot(bb.w, bb.h) * 0.92 <= N.stul * Math.SQRT2 && bb.h < N.stul * 0.5 ? 'úhlopříčně' : 'ne';
    if (fit === 'ne') varovani.push(`Posunovací tyč (${cz(bb.w)} mm) se nevejde na tiskovou plochu – vyřízněte ji z desky (DXF).`);
    const Vt = new Vykres('tyc', 'Posunovací tyč');
    Vt.poly(tyc); Vt.k(ph[0], ph[1], 4);
    Vt.kota([0, 0], [L, 0], -10).kota([0, hn], [Ls, hn], 6, 'botka ' + cz(Ls)).kota([Ls + Lt + 8, 0], [Ls + Lt + 8, hn], -4, cz(hn)).kota([-8, 0], [-8, hn + H], 4);
    Vt.t(L * 0.62, hn + 4, cz(p.uhel) + '°', { h: 3.5 });
    const tycD = deska({ id: 'A', nazev: 'Posunovací tyč', material: 'překližka bříza', tl: p.tl, obrys: tyc, otvory: [{ x: r2(ph[0]), y: r2(ph[1]), d: 8, pozn: 'na pověšení' }], pozn: 'hrany zaoblit; patka je opotřebitelná – po naříznutí vyrobte novou',
      um: um([55, s.stulHloubka / 2 - 160, 19 - hn], [0, -1, 0], [0, 0, 1]), pohyb: true });
    // um: x → −y (dozadu), y → z, n = (0,−1,0)×(0,0,1) = (−1,0,0) ✓
    const tycT = tisk({ id: 'A-T', nazev: 'Posunovací tyč – tisk', material: N.materialTisk, csg: C.sub(C.prism(tyc, 0, p.tl), C.cyl('z', ph, 4, -1, p.tl + 1)), pohledy: [Vt],
      pozn: fit === 'úhlopříčně' ? 'vejde se jen úhlopříčně přes podložku' : '', tiskPozn: 'naplocho, 4 perimetry, výplň 40 %', napis: null, jenStl: true });
    const B = p.blokL, hb = 18, Hv = p.blokV, kp = p.blokPatka;
    // blok: profil (x po směru posuvu dozadu, y nahoru), y = 0 je spodek patky, spodek bloku y = kp
    const blokP = [[0, kp], [B - 12, kp], [B - 12, 0], [B, 0], [B, kp + hb + 10], [B - 22, Hv], [B * 0.18, Hv], [0, kp + hb + 8]];
    const otvor = zaoblObd(B * 0.25, kp + hb + 6, B - 34, Hv - 14, 8, 6);
    const sv = Hv - 14 - (kp + hb + 6);
    if (sv < 22) varovani.push('Otvor na prsty v bloku je nízký – zvětšete výšku bloku.');
    const Vb = new Vykres('blok', 'Posunovací blok – profil'); Vb.poly(blokP); Vb.poly(otvor, { s: 0.3 });
    Vb.kota([0, -6], [B, -6], -4).kota([B + 6, 0], [B + 6, Hv], -4).kota([B - 12, -14], [B, -14], -4, 'patka ' + cz(kp));
    const blok = tisk({ id: 'B', nazev: 'Posunovací blok', material: N.materialTisk, csg: C.sub(C.prism(blokP, 0, p.blokS), C.prism(otvor, -1, p.blokS + 1)), pohledy: [Vb],
      napis: N.oznaceni ? { txt: 'B' + Math.round(kp), plocha: 'z+', f: p.blokS, x: 6, y: kp + 4, h: Math.min(8, hb - 6) } : null,
      pozn: 'spodek polepte protiskluzovou páskou nebo gumou; patka je opotřebitelná', tiskPozn: 'profilem na podložce (výška tisku = šířka bloku), bez podpěr, výplň 30 %',
      um: um([-200, s.stulHloubka / 2 - 100, 0], [0, -1, 0], [0, 0, 1]) });
    if (p.blokS > N.stulZ) varovani.push('Šířka bloku je větší než výška tisku.');
    const tycDily = [tycD]; if (fit !== 'ne') tycDily.push(tycT);
    return {
      dily: tycDily.concat([blok]), varovani, vykresy: [Vt, Vb],
      vysledky: [
        { n: 'Tyč', v: `${cz(bb.w)} × ${cz(bb.h)} × ${cz(p.tl)} mm` },
        { n: 'Tisk tyče', v: fit === 'ne' ? 'nevejde se – z desky' : fit },
        { n: 'Blok', v: `${cz(B)} × ${cz(p.blokS)} × ${cz(Hv)} mm` },
        { n: 'Patky', v: `tyč ${cz(hn)} mm, blok ${cz(kp)} mm (< nejtenčí díl ${cz(p.tlDilu)} mm)` },
        { n: 'Kdy použít', v: 'vždy, když by ruka byla blíž než ~150 mm od kotouče (úzké podélné řezy)' },
      ],
      kusovnik: [{ p: 'Protiskluzová páska / guma 2 mm', ks: 1, pozn: 'spodek bloku' }],
      bezpecnost: [
        'Posunovač vede díl mezi kotoučem a pravítkem – ruka zůstává za kotoučem a mimo jeho osu.',
        'Tlačte dolů i dopředu: botka přidržuje díl na stole, patka ho posouvá.',
        'Posunovač je spotřební díl: naříznutý nebo zlomený hned vyměňte.',
        'Při podélném řezu používejte rozvírací klín a kryt kotouče; nikdy nesahejte přes kotouč pro odřezek.',
      ],
      sestava: { stroj: 'stolni', ripX: 60, ripV: s.podelV, ripS: s.podelS, pohyb: { v: [0, 1, 0], od: -120, do: 150 }, obrobky: [{ a: [s.kerf + 2, s.stulHloubka / 2 - 160 - Ls, 0], b: [60, s.stulHloubka / 2 - 160 - Ls + 500, 19], pohyb: true }], vyskaKotouce: 24 },
      info: `Tyč ${cz(L)} mm, blok ${cz(B)} mm.`,
    };
  };

  /* ---------- úhlová podložka ---------- */
  VYP.klin = function (p, s, N) {
    const varovani = [], a = p.uhel * RAD;
    if (p.varianta === 'klin') {
      const h = vyskaKlinu(p.uhel, p.delka, p.tlMin);
      if (h > 120) varovani.push(`Klín je vysoký ${cz(h)} mm – pro velké úhly je vhodnější sklopná deska.`);
      const nSeg = Math.ceil(Math.max(p.delka, h) / (N.stul - 10) - 1e-9), dily = [];
      if (p.sirka > N.stulZ) varovani.push('Šířka klínu je větší než výška tisku – zmenšete ji nebo tiskněte dva klíny vedle sebe.');
      const segL = p.delka / nSeg;
      for (let i = 0; i < nSeg; i++) {
        const xa = i * segL, xb = (i + 1) * segL, prof = [[0, 0], [segL, 0], [segL, p.tlMin + xb * Math.tan(a)], [0, p.tlMin + xa * Math.tan(a)]];
        let csg = C.prism(prof, 0, p.sirka);
        const kol = [];
        if (nSeg > 1) { const yk = Math.min(p.tlMin + xa * Math.tan(a), p.tlMin + xb * Math.tan(a)) / 2; for (const zz of [p.sirka * 0.25, p.sirka * 0.75]) { if (i > 0) kol.push(C.cyl('x', [yk, zz], 2.1, -1, 8)); if (i < nSeg - 1) kol.push(C.cyl('x', [yk, zz], 2.1, segL - 8, segL + 1)); } }
        if (kol.length) csg = C.sub(csg, kol);
        const V = new Vykres('k' + i, 'Klín – profil' + (nSeg > 1 ? ` díl ${i + 1}` : '')); V.poly(prof);
        V.kota([0, -6], [segL, -6], -4).kota([segL + 6, 0], [segL + 6, prof[2][1]], -4).kota([-6, 0], [-6, prof[3][1]], 4); V.t(segL * 0.35, prof[3][1] + 4, cz(p.uhel, 1) + '°', { h: 4 });
        dily.push(tisk({ id: 'A' + (nSeg > 1 ? i + 1 : ''), nazev: 'Úhlový klín ' + cz(p.uhel, 1) + '°' + (nSeg > 1 ? ` – díl ${i + 1}/${nSeg}` : ''), material: N.materialTisk, csg, pohledy: [V],
          napis: null, pozn: nSeg > 1 ? 'díly spojte kolíky Ø4 (ocel / filament) a lepidlem' : '', tiskPozn: 'profilem na podložce – šikmá plocha je pak hladká a úhel přesný (tvoří ji osy XY tiskárny); označení vynecháno, všechny velké plochy jsou funkční',
          um: um([-p.delka / 2 + xa, p.sirka / 2, 0], [1, 0, 0], [0, 0, 1]) }));
        // n = (1,0,0)×(0,0,1) = (0·1−0·0, 0·0−1·1, 0) = (0,−1,0) ✓
      }
      const V = new Vykres('tab', 'Výška klínu pro úhly');
      [5, 10, 15, 20, 30, 45].forEach((u, i) => V.t(0, -i * 6, `${u}° → ${cz(vyskaKlinu(u, p.delka, p.tlMin))} mm`, { h: 3.6 }));
      return {
        dily, varovani, vykresy: dily.map((d) => d.pohledy[0]).concat([V]),
        vysledky: [
          { n: 'Výška klínu', v: `${cz(p.tlMin)} → ${cz(h, 2)} mm na délce ${cz(p.delka)} mm` },
          { n: 'Stoupání', v: cz(Math.tan(a) * 100, 2) + ' mm / 100 mm' },
          { n: 'Dílů tisku', v: String(nSeg) },
        ],
        kusovnik: [{ p: 'Svěrky (2×) nebo upínky stolu vrtačky', ks: 2, pozn: 'klín i díl upnout ke stolu' }, { p: 'Brusné plátno P120 / korek', ks: 1, pozn: 'na šikmou plochu proti klouzání' }].concat(nSeg > 1 ? [{ p: 'Kolík Ø4×14 (ocel / filament)', ks: (nSeg - 1) * 2, pozn: 'spojení dílů' }] : []),
        bezpecnost: bezpVrtacka().concat(['Na šikmé ploše díl i klín vždy upněte – díl má snahu sjet po svahu a vrták se smeká; začněte navrtávacím (centrovacím) vrtákem nebo Forstnerovým.']),
        sestava: { stroj: 'vrtacka', pohyb: { typ: 'vrtani' }, obrobky: [{ naklon: p.uhel, a: [-p.delka / 2 - 10, -p.sirka / 2, 0], b: [p.delka / 2 + 10, p.sirka / 2, 18], z0: p.tlMin }] },
        info: `Klín ${cz(p.uhel, 1)}°, výška ${cz(h, 1)} mm.`,
      };
    }
    // sklopná deska
    const t = p.deskaTl, L = p.delka, W = p.sirka, Rs = Math.min(p.polomer, L - 30), hz = 30;
    const r = Math.hypot(Rs, hz), b0 = -Math.atan2(hz, Rs) / RAD, amx = p.uhelMax;
    const bocH = r1(Math.max(r * Math.sin((b0 + amx) * RAD) + 40, 60)), bocL = r1(Math.max(Rs + 40, L * 0.8));
    // bočnice: počátek = osa závěsu (horní hrana základny vpředu); bočnice z ∈ [−t, bocH]
    const slot = obloukDrazka(0, t, r, b0, b0 + amx, 6.6, 36);
    const cary = []; for (let u = 0; u <= amx + 1e-6; u += 5) { const q = (b0 + u) * RAD; cary.push({ b: [[(r + 6) * Math.cos(q), t + (r + 6) * Math.sin(q)], [(r + (u % 15 ? 10 : 14)) * Math.cos(q), t + (r + (u % 15 ? 10 : 14)) * Math.sin(q)]], d: null, c: '#000000' }); }
    const boc = deska({ id: 'C', nazev: 'Bočnice s obloukovou drážkou', material: 'překližka', tl: t, ks: 2, obrys: [[0, 0], [bocL, 0], [bocL, bocH], [Math.min(25, bocL * 0.15), bocH]], vyrezy: [slot], cary, pozn: 'drážka Ø6,6 pro M6; stupnice po 5°, delší ryska po 15°',
      um: um([-L / 2, -W / 2, 0], [1, 0, 0], [0, 0, 1]) });
    const zakl = deska({ id: 'A', nazev: 'Základna', material: 'překližka', tl: t, obrys: obd(0, 0, L, W + 2 * t), um: um([-L / 2, -W / 2 - t, -t], [1, 0, 0], [0, 1, 0]) });
    zakl.um.o[2] = 0; boc.um.o[2] = 0;
    const horni = deska({ id: 'B', nazev: 'Sklopná deska', material: 'překližka', tl: t, obrys: obd(0, 0, L, W), um: um([-L / 2, -W / 2, t], [Math.cos(Math.min(p.uhel, amx) * RAD), 0, Math.sin(Math.min(p.uhel, amx) * RAD)], [0, 1, 0]), pozn: 'na přední hraně klavírový závěs' });
    const drz = deska({ id: 'D', nazev: 'Držák šroubu (pod sklopnou deskou)', material: 'překližka', tl: t, ks: 2, obrys: obd(0, 0, Rs + 25, hz + 12), otvory: [{ x: Rs, y: 12, d: 6.6 }], pozn: `otvor ${cz(Rs)} mm od osy závěsu a ${cz(hz)} mm pod deskou` });
    const V = new Vykres('boc', 'Bočnice a sklopná deska', 'osa závěsu v počátku');
    kresliDesku(V, boc, 0, 0); V.l([[0, t], [L, t]], { s: 0.25, d: 'c' });
    const q = Math.min(p.uhel, amx) * RAD; V.l([[0, t], [L * Math.cos(q), t + L * Math.sin(q)]], { s: 0.45, c: '#1f5fa8' });
    V.kota([0, -6], [bocL, -6], -4).kota([bocL + 6, 0], [bocL + 6, bocH], -4).t(r * 0.55, t + 10, 'R ' + cz(r, 1), { h: 3.4 });
    for (let u = 0; u <= amx + 1e-6; u += 15) { const qq = (b0 + u) * RAD; V.t((r + 17) * Math.cos(qq), t + (r + 17) * Math.sin(qq), u + '°', { h: 3, a: 'c' }); }
    return {
      dily: [zakl, horni, boc, drz], varovani, vykresy: [V],
      vysledky: [
        { n: 'Poloměr drážky', v: cz(r, 1) + ' mm (od osy závěsu)' },
        { n: 'Rozsah', v: `0–${cz(amx)}°` },
        { n: 'Bočnice', v: `${cz(bocL)} × ${cz(bocH)} mm` },
        { n: 'Výška přední hrany při ' + cz(p.uhel) + '°', v: cz(L * Math.sin(q), 1) + ' mm' },
      ],
      kusovnik: [
        { p: `Klavírový závěs ${Math.round(W)} mm`, ks: 1, pozn: 's vruty' },
        { p: 'Šroub M6×50 s podložkami', ks: 2, pozn: 'přes drážku do držáku' },
        { p: 'Křídlová matice M6 / knoflík', ks: 2, pozn: 'aretace úhlu' },
        { p: 'Vrut 4×40', ks: 12, pozn: 'bočnice, držáky + lepidlo' },
      ],
      bezpecnost: bezpVrtacka().concat(['Před vrtáním obě křídlové matice pevně dotáhněte – povolená deska se pod tlakem vrtáku sklopí.']),
      sestava: { stroj: 'vrtacka', pohyb: { typ: 'vrtani' }, obrobky: [] },
      info: `Sklopná deska 0–${cz(amx)}°.`,
    };
  };
  function bezpVrtacka() {
    return [
      'Díl i přípravek upněte ke stolu vrtačky – nikdy nedržte díl rukou proti otáčení vrtáku.',
      'Rukavice ke stojanové vrtačce nepatří (namotání); dlouhé vlasy a volné rukávy zajistěte.',
      'Otáčky volte podle průměru vrtáku, sklíčidlový klíč vždy vyjměte.',
    ];
  }

  /* ---------- V-blok ---------- */
  VYP.vblok = function (p, s, N) {
    const varovani = [], th = p.uhelV / 2 * RAD;
    const dMax = Math.max(p.dMin, p.dMax), O = vBlokOsa(dMax, p.uhelV), Om = vBlokOsa(p.dMin, p.uhelV);
    const Hv = r1(O.dotykV + Math.max(3, dMax * 0.08)), Bv = 2 * Hv * Math.tan(th), B = r1(Bv + 2 * p.stena), H = r1(p.zaklad + Hv);
    if (p.relS > 0 && Om.dotykX * 2 <= p.relS + 1) varovani.push(`Nejmenší průměr ${cz(p.dMin)} mm by spadl do odlehčovací drážky – zúžte drážku pod ${cz(Om.dotykX * 2 - 1, 1)} mm.`);
    if (p.relH >= p.zaklad - 2) varovani.push('Odlehčovací drážka je hlubší než materiál pod V.');
    if (B > N.stul || H > N.stul) varovani.push('Profil se nevejde na tiskovou plochu.');
    if (p.delka > N.stulZ) varovani.push('Délka bloku je větší než výška tisku.');
    const cx = B / 2, prof = [[0, 0], [B, 0], [B, H], [cx + Bv / 2, H], [cx, p.zaklad], [cx - Bv / 2, H], [0, H]];
    let csg = C.prism(prof, 0, p.delka);
    if (p.relS > 0 && p.relH > 0) csg = C.sub(csg, C.prism(obd(cx - p.relS / 2, p.zaklad - p.relH, cx + p.relS / 2, p.zaklad + p.relS / 2 / Math.tan(th) + 0.5), -1, p.delka + 1));
    // zářez pro upínací pásek po stranách
    const V = new Vykres('prof', 'V-blok – profil', 'kruhy: nejmenší a největší průměr');
    V.poly(prof); if (p.relS > 0 && p.relH > 0) V.obd(cx - p.relS / 2, p.zaklad - p.relH, cx + p.relS / 2, p.zaklad + 0.5, { s: 0.3 });
    V.k(cx, p.zaklad + O.stred, dMax / 2, { d: 'c', c: '#1f5fa8' }); V.k(cx, p.zaklad + Om.stred, p.dMin / 2, { d: 'c', c: '#1f5fa8' });
    V.l([[cx, -6], [cx, H + 8]], { d: 'o', s: 0.2, c: '#b3261e' });
    V.kota([0, -6], [B, -6], -4).kota([B + 6, 0], [B + 6, H], -4).kota([-6, 0], [-6, p.zaklad], 4).kota([cx - Bv / 2, H + 4], [cx + Bv / 2, H + 4], 4).t(cx + 3, p.zaklad + 4, cz(p.uhelV) + '°', { h: 3.4 });
    const dil = tisk({ id: 'A', nazev: 'V-blok', material: N.materialTisk, csg, pohledy: [V],
      napis: N.oznaceni ? { txt: 'V' + Math.round(p.uhelV), plocha: 'z+', f: p.delka, x: 2, y: 2, h: Math.min(6, p.zaklad - 4) } : null,
      pozn: 'osa vrtání = osa V (nad odlehčovací drážkou)', tiskPozn: 'profilem na podložce: boky V jsou svislé stěny – přesný úhel, bez podpěr',
      um: um([-B / 2, p.delka / 2, 0], [1, 0, 0], [0, 0, 1]) });
    const tab = [], krok = (dMax - p.dMin) / 5;
    for (let i = 0; i <= 5; i++) { const d = p.dMin + krok * i, q = vBlokOsa(d, p.uhelV); tab.push({ n: `Ø ${cz(d, 1)} mm – osa nad stolem`, v: cz(p.zaklad + q.stred, 2) + ' mm' }); }
    return {
      dily: [dil], varovani, vykresy: [V],
      vysledky: [
        { n: 'Profil', v: `${cz(B)} × ${cz(H)} mm, délka ${cz(p.delka)} mm` },
        { n: 'Hloubka V', v: cz(Hv) + ' mm' },
        { n: 'Osa nad vrcholem V', v: `Ø/2 ÷ sin(${cz(p.uhelV / 2)}°) = ${cz(1 / Math.sin(th) / 2, 3)} × Ø` },
      ].concat(tab),
      kusovnik: [{ p: 'Upínka / svěrka', ks: 2, pozn: 'V-blok ke stolu a kulatinu do V (např. pásek s napínací matkou)' }],
      bezpecnost: bezpVrtacka().concat(['Kulatina se v V-bloku sama netočí jen tehdy, když je upnutá – nikdy ji nedržte rukou.', 'Navrtejte nejdřív malým vrtákem nebo důlčíkem, aby vrták nesklouzl po oblé ploše.']),
      sestava: { stroj: 'vrtacka', pohyb: { typ: 'vrtani' }, obrobky: [{ valec: true, d: Math.min(dMax, Math.max(p.dMin, (p.dMin + dMax) / 2)), z: p.zaklad + vBlokOsa(Math.min(dMax, Math.max(p.dMin, (p.dMin + dMax) / 2)), p.uhelV).stred, L: p.delka + 80 }] },
      info: `V ${cz(p.uhelV)}° pro Ø${cz(p.dMin)}–${cz(dMax)} mm.`,
    };
  };

  /* ---------- kolíky do čela ---------- */
  VYP.kolik = function (p, s, N) {
    const varovani = [], c = p.bocnice, g = p.T + N.vule, Bj = 2 * c + g, n = Math.round(p.n), Hb = p.vedeni;
    const e2 = Math.max(12, p.d), Lj = r1(p.e1 + (n - 1) * p.s + e2), dOtv = p.otvor === 'pouzdro' ? p.pouzdroD - 0.1 : p.d + p.vuleD;
    if (p.d > p.T - 6) varovani.push(`Kolík Ø${cz(p.d)} je na desku ${cz(p.T)} mm moc silný (zůstane méně než 3 mm materiálu na každé straně).`);
    if (dOtv / 2 + 2 > c + g / 2) varovani.push('Otvor je širší než přípravek.');
    if (p.otvor === 'pouzdro' && p.pouzdroD <= p.d) varovani.push('Pouzdro musí mít větší průměr než vrták.');
    const xs = []; for (let i = 0; i < n; i++) xs.push(r2(p.e1 + i * p.s));
    const yc = c + g / 2, dt = c, Hc = p.hloubkaB;
    const csg = C.sub(C.add(C.box([0, 0, 0], [Lj, Bj, Hb]), C.box([0, 0, Hb - 0.01], [Lj, c, Hb + Hc]), C.box([0, c + g, Hb - 0.01], [Lj, Bj, Hb + Hc]), C.box([-dt, 0, 0], [0.01, Bj, Hb + Hc])),
      xs.map((x) => C.cyl('z', [x, yc], dOtv / 2, -1, Hb + 1)));
    const V1 = new Vykres('bok', 'Přípravek – řez kolmo k desce', 'tisková poloha: vedení dole, bočnice nahoru');
    V1.poly([[0, 0], [Bj, 0], [Bj, Hb + Hc], [c + g, Hb + Hc], [c + g, Hb], [c, Hb], [c, Hb + Hc], [0, Hb + Hc]]);
    V1.obd(c + N.vule / 2, Hb, c + N.vule / 2 + p.T, Hb + Hc + 15, { d: 'c', s: 0.2, c: '#8a6a3e' });
    V1.obd(yc - dOtv / 2, 0, yc + dOtv / 2, Hb, { s: 0.25 }); V1.l([[yc, -5], [yc, Hb + Hc + 18]], { d: 'o', s: 0.2, c: '#b3261e' });
    V1.kota([0, -6], [Bj, -6], -4).kota([c, Hb + Hc + 6], [c + g, Hb + Hc + 6], 4, cz(g, 2)).kota([Bj + 6, 0], [Bj + 6, Hb], -4).kota([-6, 0], [-6, Hb + Hc], 4).kota([0, Hb * 0.5], [yc, Hb * 0.5], 0, cz(yc, 2));
    const V2 = new Vykres('shora', 'Přípravek – pohled na vedení');
    V2.obd(-dt, 0, Lj, Bj); V2.l([[0, 0], [0, Bj]], { s: 0.25 }); xs.forEach((x) => V2.k(x, yc, dOtv / 2));
    V2.kota([0, -6], [xs[0], -6], -4, cz(p.e1)); if (n > 1) V2.kota([xs[0], Bj + 6], [xs[n - 1], Bj + 6], 4, `${n - 1} × ${cz(p.s)}`); V2.kota([-dt, -16], [Lj, -16], -4);
    V2.t(-dt - 2, Bj / 2, 'doraz', { h: 3, a: 'r' });
    const dil = tisk({ id: 'A', nazev: `Přípravek na kolíky Ø${cz(p.d)} do desky ${cz(p.T)} mm`, material: N.materialTisk, csg, pohledy: [V1, V2],
      napis: null, pozn: p.otvor === 'pouzdro' ? `pouzdra Ø${cz(p.pouzdroD, 1)} nalisovat (otvor ${cz(dOtv, 2)} mm)` : `otvory ${cz(dOtv, 2)} mm – pro sériovou práci raději ocelová pouzdra`,
      tiskPozn: 'vedením na podložce, bočnice a doraz rostou nahoru – bez podpěr; označení vynecháno: dosedací plocha je funkční a tisková je spodní',
      um: um([0, Hb, -c - N.vule / 2], [1, 0, 0], [0, 0, 1]) });
    // um: x → x, y → z, n = (1,0,0)×(0,0,1) = (0,−1,0): tisková z = 0 je y = Hb, z = Hb je čelo desky y = 0 ✓
    return {
      dily: [dil], varovani, vykresy: [V1, V2],
      vysledky: [
        { n: 'Osa děr od líce', v: cz(p.T / 2, 2) + ' mm (polovina tloušťky)' },
        { n: 'Mezera na desku', v: `${cz(g, 2)} mm (deska ${cz(p.T, 1)} + vůle ${cz(N.vule, 2)})` },
        { n: 'Polohy děr od hrany (dorazu)', v: xs.map((x) => cz(x)).join(', ') + ' mm' },
        { n: 'Hloubkový doraz na vrtáku', v: `${cz(p.hloubka + Hb)} mm od špičky (hloubka ${cz(p.hloubka)} + vedení ${cz(Hb)})`, zv: true },
        { n: 'Otvor v přípravku', v: cz(dOtv, 2) + ' mm' },
      ],
      kusovnik: [
        p.otvor === 'pouzdro' ? { p: `Vrtací pouzdro ocelové Ø${cz(p.d)} / vnější Ø${cz(p.pouzdroD, 1)} (typické, ověřte rozměr)`, ks: n, pozn: `délka ≤ ${cz(Hb)} mm` } : null,
        { p: `Hloubkový kroužek na vrták Ø${cz(p.d)}`, ks: 1, pozn: `nastavit ${cz(p.hloubka + Hb)} mm od špičky` },
        { p: `Kolíky Ø${cz(p.d)}×${Math.round(p.hloubka * 2 - 2)}`, ks: n, pozn: 'na jeden spoj' },
        { p: 'Svěrka', ks: 1, pozn: 'přípravek k desce' },
      ].filter(Boolean),
      bezpecnost: [
        'Desku upněte do svěráku nebo ke stolu a přípravek k desce svěrkou – při vrtání do čela se vrták rád stáčí.',
        'Vrtejte s hloubkovým dorazem a vrták často vytahujte (odvod třísek z čela).',
        'Ruku, která přidržuje přípravek, mějte mimo osu vrtáku.',
        'Stejnou stranu přípravku (doraz) přikládejte vždy ke stejné referenční hraně obou dílů.',
      ],
      sestava: { stroj: 'dilna', T: p.T, pohyb: { typ: 'vrtak', xs, z: p.T / 2, d: p.d }, obrobky: [{ a: [-40, -400, 0], b: [Math.max(Lj + 60, 200), 0, p.T] }] },
      info: `${n} ${n === 1 ? 'díra' : 'díry'} Ø${cz(p.d)} v ose desky ${cz(p.T)} mm.`,
    };
  };

  /* ================= řezný plán (pruhové skládání) ================= */
  /**
   * kusy: [{id, w, h, tl, material}] (už rozepsané po kusech), format [L, S], prorez, okraj
   * → [{tl, material, listy:[{kusy:[{id, x, y, w, h, otoceno}]}], vyuziti}]
   */
  function reznyPlan(kusy, L, S, prorez, okraj) {
    L = cislo(L, 2500); S = cislo(S, 1250); prorez = cislo(prorez, 4); okraj = cislo(okraj, 10);
    const UL = L - 2 * okraj, US = S - 2 * okraj, skupiny = {};
    for (const k of kusy) { const kl = `${k.material}|${k.tl}`; (skupiny[kl] = skupiny[kl] || []).push(k); }
    const out = [];
    for (const kl of Object.keys(skupiny)) {
      const ks = skupiny[kl].map((k) => { let w = Math.max(k.w, k.h), h = Math.min(k.w, k.h); return Object.assign({}, k, { w, h, otoceno: k.w < k.h }); }).sort((a, b) => b.h - a.h || b.w - a.w);
      const listy = [], nevejde = [];
      for (const k of ks) {
        if (k.w > UL || k.h > US) { if (k.h <= UL && k.w <= US) { const t = k.w; k.w = k.h; k.h = t; k.otoceno = !k.otoceno; } else { nevejde.push(k); continue; } }
        let umisteno = false;
        for (const l of listy) {
          for (const pr of l.pruhy) if (k.h <= pr.h + 1e-6 && pr.x + k.w <= UL + 1e-6) { l.kusy.push({ id: k.id, x: okraj + pr.x, y: okraj + pr.y, w: k.w, h: k.h, otoceno: k.otoceno }); pr.x += k.w + prorez; umisteno = true; break; }
          if (umisteno) break;
          if (l.vyska + k.h <= US + 1e-6) { const pr = { y: l.vyska, h: k.h, x: k.w + prorez }; l.pruhy.push(pr); l.kusy.push({ id: k.id, x: okraj, y: okraj + l.vyska, w: k.w, h: k.h, otoceno: k.otoceno }); l.vyska += k.h + prorez; umisteno = true; break; }
        }
        if (!umisteno) { const l = { pruhy: [{ y: 0, h: k.h, x: k.w + prorez }], kusy: [{ id: k.id, x: okraj, y: okraj, w: k.w, h: k.h, otoceno: k.otoceno }], vyska: k.h + prorez }; listy.push(l); }
      }
      const pl = ks.reduce((a, k) => a + k.w * k.h, 0);
      const [material, tl] = kl.split('|');
      out.push({ material, tl: +tl, L, S, listy: listy.map((l) => ({ kusy: l.kusy })), nevejde, vyuziti: listy.length ? pl / (listy.length * L * S) : 0 });
    }
    return out;
  }
  /** kusy z dílů (deskové, bez jenNahled) pro řezný plán */
  function kusyDesek(dily) {
    const o = [];
    for (const d of dily) if (d.druh === 'deska' && !d.jenNahled) for (let i = 0; i < (d.ks || 1); i++) o.push({ id: d.id + (d.ks > 1 ? `·${i + 1}` : ''), w: d.w, h: d.h, tl: d.tl, material: d.material });
    return o;
  }

  /* ================= hlavní návrh ================= */
  function navrh(P) {
    const rezim = REZIMY[P.rezim] ? P.rezim : 'sane', N = Object.assign({}, NASTAVENI, P.nast || {});
    N.stul = Math.max(60, cislo(N.stul, 220)); N.stulZ = Math.max(30, cislo(N.stulZ, 250)); N.vule = omez(cislo(N.vule, 0.2), 0, 2);
    const { p, s } = normalizuj(rezim, (P.p || {})[rezim], P.stroj);
    const V = VYP[rezim](p, s, N);
    V.rezim = rezim; V.p = p; V.s = s; V.N = N;
    for (const d of V.dily) if (d.druh === 'tisk') {
      const r = d.rozmer, ok = r[0] <= N.stul + 1e-6 && r[1] <= N.stul + 1e-6 && r[2] <= N.stulZ + 1e-6;
      if (!ok && !d.jenStl) V.varovani.push(`Díl ${d.id} (${cz(r[0])} × ${cz(r[1])} × ${cz(r[2])} mm) se nevejde do tiskového prostoru ${cz(N.stul)} × ${cz(N.stul)} × ${cz(N.stulZ)} mm.`);
      d.vejdeSe = ok;
    }
    V.rezny = reznyPlan(kusyDesek(V.dily), N.formatL, N.formatS, N.prorez, N.okrajFormatu);
    return V;
  }

  const API = {
    REZIMY, SKUPINY, STROJ, NASTAVENI, VYCHOZI, normalizuj, vychoziProjekt, navrh,
    petRezu, simulacePetRezu, offsetVoditka, listaDoDrazky, korekceRamu, vyskaKlinu, vBlokOsa, offsetKrouzku, polotetiva, reznyPlan, kusyDesek,
    obd, plocha, ccw, kruhPoly, zaoblObd, obround, obloukDrazka, bbox, bboxCSG, zrcadliX, C, Vykres, kresliDesku, cislo, cz, r2, RAD,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PP = API;
})(typeof window !== 'undefined' ? window : globalThis);
