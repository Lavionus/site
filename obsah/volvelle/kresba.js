/* ============================================================
   Volvelle – kreslicí stavebnice (bez DOM)
   Prvky v mm, střed kotouče (0, 0), y dolů. Typy:
     {t:'l', b:[[x,y]…], z (uzavřít), s (tloušťka), c (role barvy), f (role výplně), vypl (dekorativní výplň), d (čárkovaně)}
     {t:'k', x, y, r, s, c, f, vypl}
     {t:'txt', x, y, h (výška písma), txt, u (° po směru ručiček), a ('c'|'l'|'r'), c, n (písmo nadpisů)}
   Vrstva: {id, nazev, tvar:{typ:'kruh', r} | {typ:'poly', b}, okna:[{b}|{kruh:[x,y,r]}], otoc, krok, prvky, R (obalový poloměr)}
   ============================================================ */
(function (koren) {
  'use strict';
  const V = koren.VOLV || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const ST = koren.VOLV_STYLY || (typeof require !== 'undefined' ? require('./styly.js') : null);
  const { P, mod, RAD } = V;

  const cara = (b, c, s, o) => Object.assign({ t: 'l', b, c: c || 'cara', s: s == null ? 0.25 : s }, o || {});
  const kruh = (r, c, s, o) => Object.assign({ t: 'k', x: 0, y: 0, r, c: c || 'cara', s: s == null ? 0.25 : s }, o || {});
  const bod = (x, y, r, f, o) => Object.assign({ t: 'k', x, y, r, f: f || 'cara', s: 0 }, o || {});
  const txt = (x, y, h, t, u, c, o) => Object.assign({ t: 'txt', x, y, h, txt: String(t), u: u || 0, a: 'c', c: c || 'text' }, o || {});
  /** výplň výseče mezikruží */
  const vysecF = (r1, r2, a1, a2, f, o) => Object.assign({ t: 'l', b: V.vysec(r1, r2, a1, a2, 1.5), z: true, f, s: 0, vypl: true }, o || {});
  /** paprsek (radiální čárka) */
  const paprsek = (r1, r2, a, c, s) => cara([P(r1, a), P(r2, a)], c, s);
  /** otočení textu tečně k obvodu; citelne = spodní polovina hlavou ke středu (čte se zvenku i zespodu) */
  const uTecna = (a, citelne) => { const m = mod(a, 360); return citelne && m > 90 && m < 270 ? m + 180 : m; };
  /** text tečně k obvodu v poloměru r */
  const textTecne = (r, a, h, t, c, o) => { const q = P(r, a); return txt(q[0], q[1], h, t, uTecna(a, o && o.citelne), c, o); };
  /** text radiálně (čte se od středu ven v pravé polovině, v levé dovnitř) */
  const textRadial = (r, a, h, t, c, o) => { const q = P(r, a), m = mod(a, 360); return txt(q[0], q[1], h, t, m <= 180 ? m - 90 : m + 90, c, o); };
  /** text podél oblouku po písmenech (nadpisy na okraji) */
  function textObloukem(st, r, a, h, t, c, o) {
    o = o || {};
    const dole = o.dole, sir = ST.sirkaTextu(st, 'x', h, o.n), znaky = [...String(t)];
    const delka = znaky.reduce((s, z) => s + (z === ' ' ? 0.6 : /[mwMWŠŽ]/.test(z) ? 1.35 : /[iljtfrí.,:;'!]/.test(z) ? 0.55 : 1) * sir, 0);
    const out = []; let s = -delka / 2;
    for (const z of znaky) {
      const w = (z === ' ' ? 0.6 : /[mwMWŠŽ]/.test(z) ? 1.35 : /[iljtfrí.,:;'!]/.test(z) ? 0.55 : 1) * sir;
      const ua = a + (dole ? -1 : 1) * (s + w / 2) / r / RAD;
      if (z !== ' ') { const q = P(r, ua); out.push(txt(q[0], q[1], h, z, dole ? ua + 180 : ua, c, { n: o.n })); }
      s += w;
    }
    return out;
  }

  /**
   * rozvrhne položky textu do řádků uvnitř výseče (r1..r2, střed a, rozpětí span °) – řádky tečně, odshora (od r2).
   * vrací {prvky, h}; položky = řetězce nebo {t, c}
   */
  function blokVeVyseci(st, polozky, r1, r2, a, span, o) {
    o = o || {};
    const pol = polozky.map((p) => (typeof p === 'string' ? { t: p } : p));
    if (!pol.length) return { prvky: [], h: 0 };
    const mezera = o.mezera == null ? 0.9 : o.mezera;
    let h = Math.min(o.hMax || 4, (r2 - r1) * 0.8);
    const rozvrh = (h) => {
      const radky = []; let r = r2 - h * 0.75, i = 0;
      while (i < pol.length && r - h * 0.35 >= r1) {
        const kap = Math.max(0.1, (r * span * RAD) * (o.vyuziti || 0.86));
        let w = 0; const rad = [];
        while (i < pol.length) {
          const wi = ST.sirkaTextu(st, pol[i].t, h, o.n) + (rad.length ? h * mezera : 0);
          if (rad.length && w + wi > kap) break;
          rad.push(pol[i]); w += wi; i++;
          if (o.poJedne) break;
        }
        radky.push({ r, rad, w }); r -= h * (o.radkovani || 1.22);
      }
      return i >= pol.length ? radky : null;
    };
    let radky = null;
    for (let k = 0; k < 60 && h > 0.6; k++) { radky = rozvrh(h); if (radky) break; h *= 0.94; }
    if (!radky) radky = rozvrh(h) || [];
    // svisle vystředit ve výseči
    const pouzito = radky.length ? (radky[0].r - radky[radky.length - 1].r) : 0, volno = (r2 - r1) - pouzito - h * 1.1;
    const posun = o.nahoru ? 0 : Math.max(0, volno / 2);
    const prvky = [];
    for (const rd of radky) {
      const r = rd.r - posun;
      let x = -rd.w / 2;
      for (let j = 0; j < rd.rad.length; j++) {
        const p = rd.rad[j], w = ST.sirkaTextu(st, p.t, h, o.n);
        if (j) x += h * mezera;
        const ua = a + (x + w / 2) / r / RAD;
        prvky.push(textTecne(r, ua, h, p.t, p.c || o.c || 'text', { n: o.n, citelne: o.citelne }));
        x += w;
      }
    }
    return { prvky, h };
  }
  /** odstavec vodorovných řádků uvnitř kruhu (souřadnice středu y0 = horní řádek) */
  function odstavec(st, radky, y0, h, sirkaMax, c, o) {
    const out = [];
    let y = y0;
    for (const r of radky) {
      let hh = h;
      const w = ST.sirkaTextu(st, r, hh, o && o.n);
      if (sirkaMax && w > sirkaMax) hh = h * sirkaMax / w;
      out.push(txt(0, y, hh, r, 0, c || 'text', o));
      y += h * 1.35;
    }
    return out;
  }

  /** stupnice na kruhu: dilky [{x, uroven, popis}], uhel(x) → °, r = čára základny, smer +1 ven / −1 dovnitř */
  function stupnice(dilky, uhel, r, smer, o) {
    o = o || {};
    const delky = o.delky || [3, 2, 1.2], out = [], s = o.s || [0.3, 0.22, 0.15], kandidati = [];
    const rp = r + smer * (delky[0] + (o.h || 0) * 0.75 + (o.mezera || 0.4));
    for (const d of dilky) {
      const a = uhel(d.x);
      if (!isFinite(a)) continue;
      const l = delky[d.uroven] || 1;
      out.push(paprsek(r, r + smer * l, a, o.c || 'cara', s[d.uroven] || 0.15));
      if (d.popis && o.h) { const h = d.uroven === 0 ? o.h : o.h * 0.8; kandidati.push({ a, h, t: d.popis, u: d.uroven, w: String(d.popis).length * h * 0.56 + h * 0.5 }); }
    }
    // popisky bez překrytí: nejdřív hlavní, pak ostatní, jen kde je místo (oblouková vzdálenost)
    const prijate = [];
    kandidati.sort((x, y) => x.u - y.u);
    for (const k of kandidati) {
      const ok = prijate.every((q) => { const da = Math.abs(mod(k.a - q.a + 180, 360) - 180); return Math.abs(rp) * da * RAD >= (k.w + q.w) / 2; });
      if (ok) prijate.push(k);
    }
    for (const k of prijate) out.push(textTecne(rp, k.a, k.h, k.t, o.ct || 'text', { citelne: o.citelne }));
    if (o.zakladna !== false) out.push(kruh(r, o.c || 'cara', s[0]));
    return out;
  }

  /** ozdobný okraj kotouče podle stylu (r = vnější okraj) */
  function ozdoba(st, r, o) {
    o = o || {};
    const out = [];
    const sila = st.silaCar || 1;
    if (st.ozdoba === 'rukopis') {
      out.push(kruh(r - 1, 'cara', 0.45 * sila), kruh(r - 2.4, 'cara', 0.2 * sila));
      const n = Math.round(2 * Math.PI * (r - 1.7) / 3.2);
      for (let i = 0; i < n; i++) { const q = P(r - 1.7, i * 360 / n); out.push(bod(q[0], q[1], 0.32, 'akcent')); }
    } else if (st.ozdoba === 'apianus') {
      // šachovnicový pás jako na kolorovaných dřevorytech Astronomica Caesareum
      const n = Math.max(24, Math.round(2 * Math.PI * r / 4.2 / 2) * 2);
      for (let i = 0; i < n; i += 2) out.push(vysecF(r - 2.6, r - 0.8, i * 360 / n, (i + 1) * 360 / n, 'cara', { vypl: false }));
      out.push(kruh(r - 0.8, 'cara', 0.3 * sila), kruh(r - 2.6, 'cara', 0.3 * sila));
    } else if (st.ozdoba === 'detska') {
      const n = Math.round(2 * Math.PI * (r - 1.8) / 4.5);
      for (let i = 0; i < n; i++) { const q = P(r - 1.8, i * 360 / n); out.push(bod(q[0], q[1], 0.9, 'v' + (i % 8), { vypl: true })); }
      out.push(kruh(r - 3.3, 'cara', 0.35));
    } else {
      out.push(kruh(r - 1.2, 'cara', 0.3 * sila));
    }
    if (o.vnitrni) out.push(kruh(o.vnitrni, 'cara', 0.25 * sila));
    return out;
  }
  /** šíře okraje, kterou ozdoba zabere */
  const sireOzdoby = (st) => (st.ozdoba === 'rukopis' ? 2.8 : st.ozdoba === 'apianus' ? 3 : st.ozdoba === 'detska' ? 3.6 : 1.5);

  /** šipka (vyplněný trojúhelník) mířící ven v úhlu a od r1 k r2 */
  function sipka(r1, r2, a, sirka, f) {
    const w = sirka / 2 / r1 / RAD;
    return { t: 'l', b: [P(r1, a - w), P(r2, a), P(r1, a + w)], z: true, f: f || 'akcent', s: 0 };
  }

  /* ---------------- vektorové ikony (jednotkový čtverec −1..1) ---------------- */
  const kr = (n, r, cx, cy, a0) => { const b = []; for (let i = 0; i < n; i++) { const a = (a0 || 0) + i * 2 * Math.PI / n; b.push([(cx || 0) + r * Math.sin(a), (cy || 0) - r * Math.cos(a)]); } return b; };
  const IKONY = {
    slunce: () => { const o = [{ t: 'k', x: 0, y: 0, r: 0.45, f: 'akcent2', s: 0 }]; for (let i = 0; i < 12; i++) { const a = i * 30 * RAD; o.push({ t: 'l', b: [[0.58 * Math.sin(a), -0.58 * Math.cos(a)], [0.95 * Math.sin(a), -0.95 * Math.cos(a)]], c: 'akcent2', s: 0.13 }); } return o; },
    mesic: () => { const b = []; for (let i = 0; i <= 24; i++) { const a = (-150 + i * 300 / 24) * RAD; b.push([0.85 * Math.sin(a), -0.85 * Math.cos(a)]); } for (let i = 24; i >= 0; i--) { const a = (-150 + i * 300 / 24) * RAD; b.push([0.3 + 0.62 * Math.sin(a) - 0.05, -0.62 * Math.cos(a)]); } return [{ t: 'l', b: b.map((q) => [q[0] - 0.12, q[1]]), z: true, f: 'akcent2', s: 0 }]; },
    hvezda: () => { const b = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.4 : 0.95, a = i * 36 * RAD; b.push([r * Math.sin(a), -r * Math.cos(a)]); } return [{ t: 'l', b, z: true, f: 'akcent', s: 0 }]; },
    srdce: () => { const b = []; for (let i = 0; i <= 40; i++) { const t = i / 40 * 2 * Math.PI; b.push([0.058 * 16 * Math.pow(Math.sin(t), 3), -0.058 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 0.08]); } return [{ t: 'l', b, z: true, f: 'akcent', s: 0 }]; },
    list: () => { const b = []; for (let i = 0; i <= 20; i++) { const t = i / 20; b.push([0.5 * Math.sin(Math.PI * t), 0.9 - 1.8 * t]); } for (let i = 20; i >= 0; i--) { const t = i / 20; b.push([-0.5 * Math.sin(Math.PI * t), 0.9 - 1.8 * t]); } return [{ t: 'l', b, z: true, f: '#d0742c', s: 0 }, { t: 'l', b: [[0, 0.95], [0, -0.7]], c: 'cara', s: 0.08 }]; },
    vlocka: () => { const o = []; for (let i = 0; i < 6; i++) { const a = i * 60 * RAD, s = Math.sin(a), c = -Math.cos(a); o.push({ t: 'l', b: [[0, 0], [0.92 * s, 0.92 * c]], c: 'akcent2', s: 0.12 }); const m = [0.55 * s, 0.55 * c]; for (const d of [-1, 1]) { const b2 = (i * 60 + d * 40) * RAD; o.push({ t: 'l', b: [m, [m[0] + 0.28 * Math.sin(b2), m[1] - 0.28 * Math.cos(b2)]], c: 'akcent2', s: 0.1 }); } } return o; },
    kvet: () => { const o = []; for (let i = 0; i < 6; i++) { const a = i * 60 * RAD; o.push({ t: 'k', x: 0.5 * Math.sin(a), y: -0.5 * Math.cos(a), r: 0.36, f: '#e86fa0', s: 0 }); } o.push({ t: 'k', x: 0, y: 0, r: 0.3, f: '#f5c518', s: 0 }); return o; },
    kapka: () => { const b = []; for (let i = 0; i <= 30; i++) { const t = i / 30 * 2 * Math.PI; b.push([0.62 * Math.sin(t) * Math.sin(t / 2), -0.95 * Math.cos(t / 2) * 0.9 + 0.1]); } return [{ t: 'l', b, z: true, f: 'akcent2', s: 0 }]; },
    mrak: () => [{ t: 'k', x: -0.42, y: 0.12, r: 0.36, f: 'jemna', s: 0 }, { t: 'k', x: 0.05, y: -0.12, r: 0.5, f: 'jemna', s: 0 }, { t: 'k', x: 0.5, y: 0.15, r: 0.34, f: 'jemna', s: 0 }, { t: 'l', b: [[-0.75, 0.45], [0.82, 0.45], [0.82, 0.2], [-0.75, 0.2]], z: true, f: 'jemna', s: 0 }],
    klic: () => [{ t: 'k', x: -0.5, y: 0, r: 0.38, c: 'akcent', s: 0.14 }, { t: 'l', b: [[-0.12, 0], [0.9, 0], [0.9, 0.3], [0.65, 0], [0.65, 0.25]], c: 'akcent', s: 0.14 }],
    darek: () => [{ t: 'l', b: [[-0.75, -0.25], [0.75, -0.25], [0.75, 0.85], [-0.75, 0.85]], z: true, f: 'akcent', s: 0 }, { t: 'l', b: [[0, -0.25], [0, 0.85]], c: 'papir', s: 0.18 }, { t: 'l', b: [[-0.85, -0.55], [0.85, -0.55], [0.85, -0.25], [-0.85, -0.25]], z: true, f: 'akcent2', s: 0 }, { t: 'k', x: -0.22, y: -0.75, r: 0.2, c: 'akcent2', s: 0.12 }, { t: 'k', x: 0.22, y: -0.75, r: 0.2, c: 'akcent2', s: 0.12 }],
    stromek: () => [{ t: 'l', b: [[0, -0.95], [0.55, -0.15], [0.3, -0.15], [0.75, 0.55], [-0.75, 0.55], [-0.3, -0.15], [-0.55, -0.15]], z: true, f: '#2e8b57', s: 0 }, { t: 'l', b: [[-0.14, 0.55], [0.14, 0.55], [0.14, 0.92], [-0.14, 0.92]], z: true, f: '#8b5a2b', s: 0 }],
    vejce: () => { const b = []; for (let i = 0; i < 32; i++) { const t = i / 32 * 2 * Math.PI; b.push([0.62 * Math.sin(t), -0.88 * Math.cos(t) * (Math.cos(t) > 0 ? 1.05 : 0.9) + 0.05]); } return [{ t: 'l', b, z: true, f: '#f4a259', s: 0 }, { t: 'l', b: [[-0.6, 0.05], [-0.3, -0.12], [0, 0.05], [0.3, -0.12], [0.6, 0.05]], c: 'papir', s: 0.12 }]; },
  };
  const JMENA_IKON = Object.keys(IKONY);
  /** ikona přepočtená na mm: střed (x, y), vel = poloměr, u = otočení */
  function ikona(jmeno, x, y, vel, u) {
    const f = IKONY[jmeno];
    if (!f) return [];
    const c = Math.cos((u || 0) * RAD), s = Math.sin((u || 0) * RAD);
    const T = (q) => [x + vel * (q[0] * c - q[1] * s), y + vel * (q[0] * s + q[1] * c)];
    return f().map((e) => {
      const o = Object.assign({}, e);
      if (o.b) o.b = o.b.map(T);
      if (o.t === 'k') { const q = T([o.x, o.y]); o.x = q[0]; o.y = q[1]; o.r *= vel; }
      if (o.s) o.s *= vel;
      return o;
    });
  }

  /** obrázek fáze Měsíce: stáří v dnech, r = poloměr; jih = zrcadlově */
  function obrazekMesice(x, y, r, stari, delka, jih, rot) {
    const out = [{ t: 'k', x, y, r, f: 'tma', s: 0 }];
    const S = delka || V.SYNODICKY, f = mod(stari / S, 1), cosv = Math.cos(2 * Math.PI * f);
    if (f > 0.012 && f < 0.988) {
      const vpravo = (f < 0.5) !== !!jih, sg = vpravo ? 1 : -1, b = [];
      const cr = Math.cos((rot || 0) * RAD), sr = Math.sin((rot || 0) * RAD), T = (q) => [x + q[0] * cr - q[1] * sr, y + q[0] * sr + q[1] * cr];
      for (let i = 0; i <= 36; i++) { const t = -90 + i * 5; b.push(T([sg * r * Math.cos(t * RAD), r * Math.sin(t * RAD)])); }
      for (let i = 36; i >= 0; i--) { const t = -90 + i * 5; b.push(T([sg * r * cosv * Math.cos(t * RAD), r * Math.sin(t * RAD)])); }
      out.push({ t: 'l', b, z: true, f: 'svetlo', s: 0 });
    }
    out.push({ t: 'k', x, y, r, c: 'cara', s: 0.15 });
    return out;
  }

  /** otočí a posune seznam prvků (pro skládání) */
  function transformuj(prvky, rho, dx, dy) {
    const T = (q) => { const p = V.otoc(q, rho || 0); return [p[0] + (dx || 0), p[1] + (dy || 0)]; };
    return prvky.map((e) => {
      const o = Object.assign({}, e);
      if (o.b) o.b = o.b.map(T);
      if (o.t === 'k' || o.t === 'txt') { const q = T([o.x, o.y]); o.x = q[0]; o.y = q[1]; }
      if (o.t === 'txt') o.u = (o.u || 0) + (rho || 0);
      return o;
    });
  }
  /** obrys vrstvy jako mnohoúhelník */
  function obrysBody(tvar, n) { return tvar.typ === 'kruh' ? V.kruhBody(tvar.r, n || 180) : tvar.b; }
  /** okno jako mnohoúhelník */
  const oknoBody = (o) => (o.kruh ? V.kruhBody(o.kruh[2], 72, o.kruh[0], o.kruh[1]) : o.b);
  /** je bod na papíře vrstvy (v obrysu a ne v okně)? souřadnice vrstvy */
  function naPapiru(v, q) {
    const ob = v.tvar.typ === 'kruh' ? Math.hypot(q[0], q[1]) <= v.tvar.r : V.vMnohouhelniku(q, v.tvar.b);
    if (!ob) return false;
    for (const o of v.okna || []) if (o.kruh ? Math.hypot(q[0] - o.kruh[0], q[1] - o.kruh[1]) <= o.kruh[2] : V.vMnohouhelniku(q, o.b)) return false;
    return true;
  }
  /** obalový poloměr vrstvy */
  function obalR(v) { if (v.tvar.typ === 'kruh') return v.tvar.r; let m = 0; for (const q of v.tvar.b) m = Math.max(m, Math.hypot(q[0], q[1])); return m; }

  const API = {
    cara, kruh, bod, txt, vysecF, paprsek, uTecna, textTecne, textRadial, textObloukem, blokVeVyseci, odstavec, stupnice,
    ozdoba, sireOzdoby, sipka, IKONY, JMENA_IKON, ikona, obrazekMesice, transformuj, obrysBody, oknoBody, naPapiru, obalR,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.VOLV_KRESBA = API;
})(typeof window !== 'undefined' ? window : globalThis);
