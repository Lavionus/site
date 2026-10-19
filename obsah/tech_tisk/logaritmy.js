/* ============================================================
   Technický generátor pro tisk – logaritmické pravítko a funkční papíry.
   Dva režimy:
     logpravitko – funkční papírové logaritmické pravítko (rovné: tělo-pouzdro + jazyk + běžec;
                   kruhové: dva kotouče + rameno běžce),
     logpapir    – funkční papíry (semilog, log-log, šestiúhelníky, ternární, pravděpodobnostní,
                   polární logaritmický).
   Jádrem obou je obecná „funkční stupnice“: poloha x = L·f(v); mezi uzly (číslovanými
   hodnotami) se pro každý úsek volí nejjemnější krok řady 1–2–5 tak, aby rysky byly od sebe
   aspoň minR (≈ 0,7 mm), délky rysek podle hierarchie (uzel / polovina / desetina / …).
   ============================================================ */
(function (koren) {
  'use strict';
  const TT = typeof module !== 'undefined' ? require('./jadro.js') : koren.TT;
  const { cara, kruh, oblouk, cesta, text } = TT.prvky;
  const { F, C, H } = TT.pole;
  const fmt = TT.fmt, sirka = TT.sirkaTextu, bodK = TT.bodK;
  const PI = Math.PI, LOG = Math.log10, ln = Math.log;
  const rad = (d) => d * PI / 180, deg = (r) => r * 180 / PI;
  const CERVENA = '#c0392b', MODRA = '#2c6fb1', SEDA = '#7f8c8d';
  const jeCele = (x) => Math.abs(x - Math.round(x)) < 1e-6;

  /* ---------- pomocné ---------- */
  const mocnina = (m, e) => +(e < 0 ? m / Math.pow(10, -e) : m * Math.pow(10, e)).toPrecision(12);
  function dek(e0, e1) {                 // uzly 1,2,…,9 v každé dekádě 10^e0 … 10^e1
    const u = [];
    for (let e = e0; e < e1; e++) for (let m = 1; m <= 9; m++) u.push(mocnina(m, e));
    u.push(mocnina(1, e1));
    return u;
  }
  function rada(a, b, k) { const u = [], n = Math.round((b - a) / k); for (let i = 0; i <= n; i++) u.push(+(a + i * k).toPrecision(12)); return u; }
  const mant = (v) => v / Math.pow(10, Math.floor(LOG(v) + 1e-9));
  const cifra = (v) => fmt(mant(v), 2);

  /* čárkovaná čára (přehyb) poskládaná z úseček */
  function carkovana(P, x1, y1, x2, y2, s, v, b, c, m) {
    c = c || 3; m = m || 2;
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 1e-9) return;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    for (let t = 0; t < L - 1e-9; t += c + m) {
      const e = Math.min(L, t + c);
      P.push(cara(x1 + ux * t, y1 + uy * t, x1 + ux * e, y1 + uy * e, s, v, b));
    }
  }

  /* text s horním indexem: t = 'řetězec' nebo [[část, horníIndex?], …] (jen bez otočení) */
  const velSup = (vel) => Math.max(1.6, vel * 0.72);
  const casti = (t) => (Array.isArray(t) ? t : [[String(t)]]);
  function sirkaC(t, vel) { return casti(t).reduce((a, c) => a + sirka(c[0], c[1] ? velSup(vel) : vel), 0); }
  function textC(P, x, y, t, vel, o) {
    o = o || {};
    const c = casti(t);
    if (c.length === 1 && !c[0][1]) { P.push(text(x, y, c[0][0], vel, o)); return; }
    const w = sirkaC(c, vel), zar = o.zar || 's';
    let xx = zar === 'l' ? x : zar === 'p' ? x - w : x - w / 2;
    for (const [s, sup] of c) {
      const vv = sup ? velSup(vel) : vel;
      P.push(text(xx, sup ? y + 0.1 * vel - vv / 2 : y, s, vv, { zar: 'l', b: o.b }));
      xx += sirka(s, vv);
    }
  }
  const plain = (t) => casti(t).map((c) => (c[1] ? '^' + c[0] : c[0])).join('');

  /* zalomení textu na šířku */
  function zalom(txt, vel, w) {
    const out = [];
    for (const odst of String(txt).split('\n')) {
      let r = '';
      for (const slovo of odst.split(' ')) {
        const zk = r ? r + ' ' + slovo : slovo;
        if (sirka(zk, vel) > w && r) { out.push(r); r = slovo; } else r = zk;
      }
      out.push(r);
    }
    return out;
  }

  /* ============================================================
     OBECNÁ FUNKČNÍ STUPNICE
     sc = { f(v) → poměr délky (0…1), od, do, uzly:[…], popis(v)→text|null,
            pod:[[od, do, krok, fn?]] (drobné popisky mezi uzly), znacky:[[v, text]] }
     Vrací { rysky:[{v,u,r}], popisky:[{v,u,txt,mal,pri}], znacky:[{v,u,txt}], minRoz }
       u = poloha (poměr L), r = poměr úseku uzlů k jednotce rysky (1 = uzel, 2 = polovina, 10 = desetina…)
     ============================================================ */
  function kandidati(d) {                 // kroky m·10^k (m = 5, 2, 1) menší než d, které d dělí; sestupně
    const out = [], e = Math.ceil(LOG(d)) + 1;
    for (let k = e; k >= e - 7; k--) for (const m of [5, 2, 1]) {
      const s = mocnina(m, k);
      if (s < d * (1 - 1e-9) && jeCele(d / s)) out.push(s);
    }
    return out;
  }
  function jednotky(d, s) {               // hierarchie rysek v úseku d s krokem s (5 a 1 × 10^k, dvojky jen jako krok)
    const out = [], e = Math.ceil(LOG(d)) + 1;
    for (let k = e; k >= e - 8; k--) for (const m of [5, 2, 1]) {
      const u = mocnina(m, k);
      if (u >= d * (1 - 1e-9) || u < s * (1 - 1e-9)) continue;
      if (m === 2 && Math.abs(u - s) > s * 1e-9) continue;
      if (jeCele(d / u) && jeCele(u / s)) out.push(u);
    }
    return out;
  }
  function delkaPomer(r) {
    return r <= 1.0001 ? 1 : r <= 2.0001 ? 0.8 : r <= 5.0001 ? 0.7 : r <= 10.0001 ? 0.62 : r <= 20.0001 ? 0.5 : r <= 50.0001 ? 0.44 : 0.38;
  }
  function trida(v) { const m = Math.round(mant(v) * 1000) / 1000; return m === 1 ? 0 : m === 5 ? 1 : m === 2 ? 2 : 3; }

  function funkcniStupnice(sc, Leff, minR) {
    const g = sc.f, a0 = Math.min(sc.od, sc.do), a1 = Math.max(sc.od, sc.do);
    const eps = (a1 - a0) * 1e-9;
    const vRozsahu = (v) => v >= a0 - eps && v <= a1 + eps;
    const uzly = sc.uzly.slice().sort((p, q) => p - q);
    const mapa = new Map();
    const klic = (v) => v.toPrecision(10);
    const pridej = (v, r) => {
      if (!vRozsahu(v)) return;
      const k = klic(v), s = mapa.get(k);
      if (!s || s.r > r) mapa.set(k, { v, u: g(v), r });
    };
    // nejmenší rozestup (mm) rysek n0 + k·s v intervalu [lo, hi] ∩ rozsah
    const roz = (n0, lo, hi, s) => {
      const l = Math.max(lo, a0), h = Math.min(hi, a1);
      if (h < l - eps) return Infinity;
      const k0 = Math.ceil((l - n0) / s - 1e-7), k1 = Math.floor((h - n0) / s + 1e-7);
      if (k1 - k0 > 20000) return 0;
      let prev = null, m = Infinity;
      for (let k = k0; k <= k1; k++) {
        const x = g(+(n0 + k * s).toPrecision(12)) * Leff;
        if (prev !== null) m = Math.min(m, Math.abs(x - prev));
        prev = x;
      }
      return m;
    };
    const krok = (n0, d, lo, hi) => {
      let best = null;
      for (const s of kandidati(d)) {
        if (!jeCele((lo - n0) / s) || !jeCele((hi - n0) / s)) continue;
        if (roz(n0, lo, hi, s) >= minR) best = s; else break;
      }
      return best;
    };
    const kroky = [];
    for (let i = 0; i + 1 < uzly.length; i++) {
      const n0 = uzly[i], n1 = uzly[i + 1], d = +(n1 - n0).toPrecision(12);
      if (n1 < a0 - eps || n0 > a1 + eps || d <= 0) continue;
      const cely = krok(n0, d, n0, n1);
      let seg = [[n0, n1, cely]];
      const h = +(n0 + d / 2).toPrecision(12);
      const s1 = krok(n0, d, n0, h), s2 = krok(n0, d, h, n1);
      // půlení úseku jen v „hezké“ polovině (0,5; 5; 50 …) a jen když žádná polovina nezhrubne
      const pul = trida(d / 2) <= 1;
      if (pul && cely && s1 && s2 && s1 <= cely * (1 + 1e-9) && s2 <= cely * (1 + 1e-9) && (s1 < cely * (1 - 1e-9) || s2 < cely * (1 - 1e-9))) seg = [[n0, h, s1], [h, n1, s2]];
      for (const [lo, hi, s] of seg) {
        kroky.push({ od: lo, do: hi, krok: s });
        if (!s) continue;
        const U = jednotky(d, s);
        const k0 = Math.round((lo - n0) / s), k1 = Math.round((hi - n0) / s);
        for (let k = k0; k <= k1; k++) {
          const v = +(n0 + k * s).toPrecision(12);
          if (Math.abs(v - n0) < d * 1e-9 || Math.abs(v - n1) < d * 1e-9) continue;
          const off = v - n0;
          let r = d / s;
          for (const u of U) if (jeCele(off / u)) { r = d / u; break; }
          pridej(v, r);
        }
      }
    }
    for (const v of uzly) pridej(v, 1);
    const rysky = [...mapa.values()].sort((p, q) => p.u - q.u);
    let minRoz = Infinity;
    for (let i = 1; i < rysky.length; i++) minRoz = Math.min(minRoz, (rysky[i].u - rysky[i - 1].u) * Leff);
    // popisky
    const popisky = [], oznacene = new Set();
    for (const v of uzly) {
      if (!vRozsahu(v) || !sc.popis) continue;
      const t = sc.popis(v);
      if (t == null || t === '') continue;
      popisky.push({ v, u: g(v), txt: t, mal: false, pri: 2 + trida(v) });
      oznacene.add(klic(v));
    }
    if (popisky.length) {
      let iMin = 0, iMax = 0;
      popisky.forEach((p, i) => { if (p.u < popisky[iMin].u) iMin = i; if (p.u > popisky[iMax].u) iMax = i; });
      popisky[iMin].pri = 0; popisky[iMax].pri = 0;
    }
    const znacky = [];
    for (const z of sc.znacky || []) if (vRozsahu(z[0])) {
      znacky.push({ v: z[0], u: g(z[0]), txt: z[1] });
      popisky.push({ v: z[0], u: g(z[0]), txt: z[1], mal: false, pri: z[2] != null ? z[2] : 6, znacka: true });
    }
    for (const [a, b, k, fn] of sc.pod || []) {
      const n = Math.round((b - a) / k);
      for (let i = 1; i < n; i++) {
        const v = +(a + i * k).toPrecision(12);
        if (!vRozsahu(v) || !mapa.has(klic(v)) || oznacene.has(klic(v))) continue;
        popisky.push({ v, u: g(v), txt: fn ? fn(v) : Math.round(mant(k)) === 1 ? String(Math.round(v / mocnina(1, Math.floor(LOG(k) + 1e-9))) % 10) : cifra(v), mal: true, pri: 10, skup: 'p' + a + '_' + b });
        oznacene.add(klic(v));
      }
    }
    return { rysky, popisky, znacky, minRoz, kroky };
  }

  /* rozmístění popisků bez překryvu (priorita: konce, značky, uzly, drobné); Lp = mm na jednotku u */
  function rozmisti(popisky, Lp, vel, velMal, mezera, kruhovy, obsazeno, napric) {
    const ser = popisky.map((p, i) => ({ p, i })).sort((a, b) => a.p.pri - b.p.pri || a.i - b.i);
    const obs = (obsazeno || []).slice(), out = [];
    const kol = (a0, a1) => obs.some(([b0, b1]) => a0 < b1 && a1 > b0);
    // napric = popisky stojí napříč osou (svislá osa papíru) – rozhoduje výška písma, ne šířka
    const meze = (p) => { const w = napric ? (p.mal ? velMal : vel) * 1.1 : sirkaC(p.txt, p.mal ? velMal : vel), x = p.u * Lp; return [x - w / 2 - mezera / 2, x + w / 2 + mezera / 2]; };
    const volno = ([x0, x1]) => !(kol(x0, x1) || (kruhovy && (kol(x0 - Lp, x1 - Lp) || kol(x0 + Lp, x1 + Lp))));
    const hotove = new Set();
    for (const { p } of ser) {
      if (p.skup) {                       // drobné popisky jednoho úseku: všechny, nebo žádný
        if (hotove.has(p.skup)) continue;
        hotove.add(p.skup);
        const cl = popisky.filter((q) => q.skup === p.skup), m = cl.map(meze);
        const ok = m.every(volno) && m.every((a, i) => m.every((b, j) => j <= i || !(a[0] < b[1] && a[1] > b[0])));
        if (ok) { obs.push(...m); out.push(...cl); }
        continue;
      }
      const m = meze(p);
      if (!volno(m)) continue;
      obs.push(m); out.push(p);
    }
    return out;
  }

  /* ============================================================
     STUPNICE LOGARITMICKÉHO PRAVÍTKA
     f(v) = poloha jako poměr délky L základní stupnice (C/D = log10 v)
     ============================================================ */
  const sin10 = (a) => LOG(10 * Math.sin(rad(a)));
  const STUPNICE = {
    C: { nazev: 'základní (jazyk)', f: (v) => LOG(v), od: 1, do: 10, uzly: dek(0, 1), popis: cifra, pod: [[1, 2, 0.1]],
      znacky: [[PI, 'π'], [Math.sqrt(4 / PI), 'c', 11]], vzorec: [['x']] },
    D: { nazev: 'základní (tělo)', f: (v) => LOG(v), od: 1, do: 10, uzly: dek(0, 1), popis: cifra, pod: [[1, 2, 0.1]],
      znacky: [[PI, 'π']], vzorec: [['x']] },
    A: { nazev: 'čtverce (tělo)', f: (v) => LOG(v) / 2, od: 1, do: 100, uzly: dek(0, 2), popis: cifra, pod: [[1, 2, 0.1], [10, 20, 1]],
      znacky: [[PI, 'π'], [10 * PI, 'π']], vzorec: [['x'], ['2', 1]] },
    B: { nazev: 'čtverce (jazyk)', f: (v) => LOG(v) / 2, od: 1, do: 100, uzly: dek(0, 2), popis: cifra, pod: [[1, 2, 0.1], [10, 20, 1]],
      znacky: [[PI, 'π'], [10 * PI, 'π']], vzorec: [['x'], ['2', 1]] },
    K: { nazev: 'krychle', f: (v) => LOG(v) / 3, od: 1, do: 1000, uzly: dek(0, 3), popis: cifra, vzorec: [['x'], ['3', 1]] },
    CI: { nazev: 'převrácené hodnoty (jazyk)', f: (v) => 1 - LOG(v), od: 1, do: 10, uzly: dek(0, 1), popis: cifra, pod: [[1, 2, 0.1]],
      cervena: true, vzorec: [['1/x']] },
    DI: { nazev: 'převrácené hodnoty (tělo)', f: (v) => 1 - LOG(v), od: 1, do: 10, uzly: dek(0, 1), popis: cifra, pod: [[1, 2, 0.1]],
      cervena: true, vzorec: [['1/x']] },
    CF: { nazev: 'posunutá o π (jazyk)', f: (v) => LOG(v / PI), od: PI, do: 10 * PI, uzly: rada(3, 10, 1).concat([20, 30, 40]), popis: cifra,
      pod: [[10, 40, 5]], znacky: [[PI, 'π'], [10 * PI, 'π']], vzorec: [['πx']] },
    DF: { nazev: 'posunutá o π (tělo)', f: (v) => LOG(v / PI), od: PI, do: 10 * PI, uzly: rada(3, 10, 1).concat([20, 30, 40]), popis: cifra,
      pod: [[10, 40, 5]], znacky: [[PI, 'π'], [10 * PI, 'π']], vzorec: [['πx']] },
    L: { nazev: 'dekadické logaritmy (mantisy)', f: (v) => v, od: 0, do: 1, uzly: rada(0, 1, 0.1), popis: (v) => fmt(v, 1), vzorec: [['lg x']] },
    Ln: { nazev: 'přirozené logaritmy', f: (v) => v / Math.LN10, od: 0, do: Math.LN10, uzly: rada(0, 2.4, 0.1),
      popis: (v) => (jeCele(v / 0.5) ? fmt(v, 1) : null), pod: [[0, 2.4, 0.1, (v) => fmt(v, 1)]], vzorec: [['ln x']] },
    S: { nazev: 'sinus 5,74°–90°', f: sin10, od: deg(Math.asin(0.1)), do: 90,
      uzly: rada(5, 10, 1).concat([15, 20, 25, 30, 40, 50, 60, 70, 80, 90]), popis: (v) => fmt(v), vzorec: [['sin']] },
    T: { nazev: 'tangens 5,71°–45°', f: (a) => LOG(10 * Math.tan(rad(a))), od: deg(Math.atan(0.1)), do: 45,
      uzly: rada(5, 10, 1).concat([15, 20, 25, 30, 35, 40, 45]), popis: (v) => fmt(v), vzorec: [['tg']] },
    ST: { nazev: 'malé úhly 0,57°–5,73° (sin ≈ tg ≈ oblouk)', f: (a) => LOG(100 * rad(a)), od: deg(0.01), do: deg(0.1),
      uzly: rada(0.5, 1, 0.1).concat([1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]), popis: (v) => fmt(v), vzorec: [['arc']] },
    LL1: { nazev: 'exponenciální e^0,01x (1,010–1,105)', f: (v) => LOG(100 * ln(v)), od: 1.01, do: Math.exp(0.1),
      uzly: [1.01, 1.015, 1.02, 1.025, 1.03, 1.035, 1.04, 1.045, 1.05, 1.06, 1.07, 1.08, 1.09, 1.1, 1.11], popis: (v) => fmt(v, 3),
      vzorec: [['e'], ['0,01x', 1]] },
    LL2: { nazev: 'exponenciální e^0,1x (1,105–2,718)', f: (v) => LOG(10 * ln(v)), od: 1.1, do: Math.E,
      uzly: [1.1, 1.15, 1.2, 1.25, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.5, 3], popis: (v) => fmt(v, 2), znacky: [[Math.E, 'e']],
      vzorec: [['e'], ['0,1x', 1]] },
    LL3: { nazev: 'exponenciální eˣ (2,718–22 026)', f: (v) => LOG(ln(v)), od: Math.E, do: Math.exp(10),
      uzly: [2.5, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 40, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 30000], popis: (v) => fmt(v),
      znacky: [[Math.E, 'e']], vzorec: [['e'], ['x', 1]] },
  };
  for (const id of Object.keys(STUPNICE)) STUPNICE[id].id = id;
  const ID_MAPA = {};
  for (const id of Object.keys(STUPNICE)) ID_MAPA[id.toUpperCase()] = id;

  function ctiStupnice(txt, chyby, kde) {
    const out = [];
    for (const s of String(txt || '').split(/[\s,;/|]+/)) {
      if (!s) continue;
      const id = ID_MAPA[s.toUpperCase()];
      if (id) out.push(STUPNICE[id]); else chyby.push(`Neznámá stupnice „${s}“ (${kde}). Dostupné: ${Object.keys(STUPNICE).join(', ')}.`);
    }
    return out;
  }

  /* ============================================================
     REŽIM A – LOGARITMICKÉ PRAVÍTKO
     ============================================================ */
  const VYCHOZI_PR = {
    typ: 'rovne', delka: 125, r: 50, horni: 'K A', jazyk: 'B CI C', dolni: 'D', rub: '',
    rysky: 4, pismo: 2, minR: 0.7, tl: 0.15, vule: 0.5, okraj: 0, papir: 0.3, bezec: true, sirkaBezce: 18, navod: true,
  };

  function geometrieRadku(o) {
    const T = Math.max(2, +o.rysky), vel = Math.max(1.6, +o.pismo);
    return { T, vel, velMal: Math.max(1.6, vel * 0.8), rowH: T + 0.6 + vel + 0.9, tl: Math.min(0.25, Math.max(0.1, +o.tl)), minR: Math.max(0.3, +o.minR || 0.7) };
  }

  /* jedna řada stupnice na rovném pravítku */
  function radekLin(P, sc, sk, g, X0, L, y0, dir, W) {
    const c = sc.cervena ? CERVENA : undefined;
    if (!sk.rysky.length) return;
    const u0 = sk.rysky[0].u, u1 = sk.rysky[sk.rysky.length - 1].u;
    P.push(cara(X0 + u0 * L, y0, X0 + u1 * L, y0, g.tl));
    for (const r of sk.rysky) {
      const x = X0 + r.u * L;
      P.push(cara(x, y0, x, y0 + dir * g.T * delkaPomer(r.r), r.r <= 1 ? g.tl * 1.35 : g.tl, 'kresba', c));
    }
    for (const p of rozmisti(sk.popisky, L, g.vel, g.velMal, 0.6)) {
      const v = p.mal ? g.velMal : g.vel;
      if (p.znacka) { const x = X0 + p.u * L; P.push(cara(x, y0, x, y0 + dir * g.T * 0.9, g.tl, 'kresba', c)); }
      textC(P, X0 + p.u * L, y0 + dir * (g.T + 0.6 + v / 2), p.txt, v, { b: c });
    }
    const ym = y0 + dir * (g.rowH - 0.9) / 2;
    textC(P, 1.2, ym, sc.id, g.vel * 1.05, { zar: 'l', b: c });
    textC(P, W - 1.2, ym, sc.vzorec, g.vel, { zar: 'p', b: c });
  }

  /* potřebný náběh (místo pro písmeno vlevo, vzorec vpravo a krajní popisky) */
  function potrebnyNabeh(seznam, g, L) {
    let n = 6;
    for (const { sc, sk } of seznam) {
      let pulL = 0, pulP = 0;
      for (const p of sk.popisky) {
        const w = sirkaC(p.txt, p.mal ? g.velMal : g.vel) / 2;
        pulL = Math.max(pulL, w - p.u * L);
        pulP = Math.max(pulP, w - (1 - p.u) * L);
      }
      n = Math.max(n, 1.2 + sirkaC(sc.id, g.vel * 1.05) + 1.5 + pulL, 1.2 + sirkaC(sc.vzorec, g.vel) + 1.5 + pulP);
    }
    return Math.ceil(n * 2) / 2;
  }

  function pravitkoRovne(o, chyby) {
    const P = [], g = geometrieRadku(o);
    const L = Math.min(1000, Math.max(50, +o.delka || 125));
    if (+o.delka < 50 || +o.delka > 1000) chyby.push('Délka základní stupnice je omezena na 50–1000 mm.');
    const horni = ctiStupnice(o.horni, chyby, 'horní pás'), jazyk = ctiStupnice(o.jazyk, chyby, 'jazyk');
    const dolni = ctiStupnice(o.dolni, chyby, 'dolní pás'), rub = ctiStupnice(o.rub, chyby, 'rub jazyka');
    if (!jazyk.length) { chyby.push('Jazyk nemá žádnou stupnici – doplňte aspoň C.'); jazyk.push(STUPNICE.C); }
    if (!dolni.length && !horni.length) chyby.push('Tělo nemá žádnou stupnici – doplňte aspoň D.');
    if (jazyk.length > 4 || rub.length > 4) chyby.push('Na jazyk se vejdou nejvýš 4 stupnice – ostatní se kreslí, ale jazyk bude široký.');
    const vse = [...horni, ...jazyk, ...dolni, ...rub].map((sc) => ({ sc, sk: funkcniStupnice(sc, L, g.minR) }));
    for (const { sc, sk } of vse) if (sk.minRoz < 0.6 - 1e-9) chyby.push(`Stupnice ${sc.id}: číslované rysky jsou jen ${fmt(sk.minRoz, 2)} mm od sebe – prodlužte stupnici.`);
    const sk = (sc) => vse.find((q) => q.sc === sc).sk;
    const nab = Math.max(+o.okraj || 0, potrebnyNabeh(vse, g, L));
    const W = L + 2 * nab, X0 = nab, rowH = g.rowH;
    const vule = Math.max(0.1, +o.vule), tp = Math.max(0, +o.papir);
    const hTop = horni.length ? horni.length * rowH + 1.5 : 7;
    const gap = jazyk.length * rowH;
    const hBot = (dolni.length ? dolni.length * rowH : 2) + 5;
    const Hf = hTop + gap + hBot, Hb = Hf + tp, Hs = Hf - vule;
    const radky = [];
    // ---------- tělo (pouzdro) – rozvinutý tvar: dolní lišta | zadní stěna | horní lišta ----------
    const yB = 0, yZad = hBot, yA = hBot + Hb, Htelo = yA + hTop;
    P.push(cesta([[0, 0], [W, 0], [W, Htelo], [0, Htelo]], true, 0.2, 'rez'));
    carkovana(P, 0, yZad, W, yZad, 0.15, 'pomoc');
    carkovana(P, 0, yA, W, yA, 0.15, 'pomoc');
    // dolní lišta: hrana u jazyka nahoře (y = 0), řady směrem dolů
    dolni.forEach((sc, i) => {
      const y0 = yB + i * rowH;
      radekLin(P, sc, sk(sc), g, X0, L, y0, 1, W);
      radky.push({ id: sc.id, dil: 'telo', X0, L, y0, dir: 1 });
    });
    const titul = `logaritmické pravítko · L = ${fmt(L)} mm · ${[horni, jazyk, dolni].map((s) => s.map((q) => q.id).join(' ')).join(' | ')}${rub.length ? ' · rub: ' + rub.map((q) => q.id).join(' ') : ''}`;
    P.push(text(W / 2, yZad - 2.6, titul, 1.7, { b: SEDA }));
    // horní lišta: hrana u jazyka dole, poslední stupnice u hrany
    horni.forEach((sc, i) => {
      const y0 = yA + hTop - (horni.length - 1 - i) * rowH;
      radekLin(P, sc, sk(sc), g, X0, L, y0, -1, W);
      radky.push({ id: sc.id, dil: 'telo', X0, L, y0, dir: -1 });
    });
    // zadní stěna: popisky přehybů a návod (otočený o 180°, aby se po otočení pravítka četl)
    P.push(text(W - 2, yZad + 2.2, '↑ přehnout dozadu', 1.6, { zar: 'p', b: SEDA }), text(W - 2, yA - 2.2, '↓ přehnout dozadu', 1.6, { zar: 'p', b: SEDA }));
    if (o.navod) {
      const vel = 1.7, sir = Math.min(W - 16, 150);
      const radkyN = [];
      radkyN.push('ZADNÍ STĚNA – sestavení:');
      radkyN.push(...zalom(`1) Vystřihněte tělo, jazyk${rub.length ? ', rub jazyka' : ''} a běžec. 2) Obě lišty se stupnicemi přehněte podél čárkovaných čar dozadu přes zadní stěnu, potištěnou stranou ven; vznikne pouzdro se štěrbinou ${fmt(gap, 1)} mm. ${rub.length ? '3) Rub jazyka přilepte zezadu na jazyk (konce lícují). ' : ''}${rub.length ? 4 : 3}) Jazyk (${fmt(W, 1)} × ${fmt(Hs, 1)} mm, vůle ${fmt(vule, 2)} mm) zasuňte do pouzdra z boku. ${rub.length ? 5 : 4}) Běžec z průhledné fólie oviňte kolem těla a slepte přesahem; vlasová čára musí být kolmá ke stupnicím.`, vel, sir));
      radkyN.push(...zalom('Použití: násobení a·b – nastavte 1 na C proti a na D, nad b na C čtěte výsledek na D. Dělení a/b – b na C proti a na D, výsledek na D pod 1 (nebo 10) jazyka.', vel, sir));
      const lh = vel * 1.65, n = radkyN.length;
      const yc = yZad + Hb / 2;
      if (n * lh < Hb - 6) radkyN.forEach((t, i) => P.push(text(W / 2, yc + (n - 1) * lh / 2 - i * lh, t, vel, { rot: 180, b: SEDA })));
    }
    // ---------- jazyk ----------
    let y = Htelo + 6;
    const kresliJazyk = (seznam, nazev) => {
      const yj = y;
      P.push(cesta([[0, yj], [W, yj], [W, yj + Hs], [0, yj + Hs]], true, 0.2, 'rez'));
      const yOkno = yj + hTop - vule / 2;                 // horní hrana viditelné části (štěrbiny)
      const nd = Math.floor(seznam.length / 2);
      seznam.forEach((sc, j) => {
        const dolu = j < nd;
        const y0 = dolu ? yOkno + j * rowH : yOkno + (j + 1) * rowH;
        radekLin(P, sc, sk(sc), g, X0, L, y0, dolu ? 1 : -1, W);
        radky.push({ id: sc.id, dil: nazev, X0, L, y0, dir: dolu ? 1 : -1 });
      });
      // pomocné meze viditelné části (štěrbiny) a popis ve skryté části
      carkovana(P, 0, yOkno, X0 * 0.6, yOkno, 0.1, 'pomoc', undefined, 1.5, 1.5);
      carkovana(P, 0, yOkno + gap, X0 * 0.6, yOkno + gap, 0.1, 'pomoc', undefined, 1.5, 1.5);
      if (hTop - vule / 2 > 3.5) P.push(text(W / 2, yj + (hTop - vule / 2) / 2, `${nazev === 'rub' ? 'RUB JAZYKA (přilepit zezadu)' : 'JAZYK'} · ${fmt(W, 1)} × ${fmt(Hs, 1)} mm · viditelná část ${fmt(gap, 1)} mm`, 1.7, { b: SEDA }));
      y += Hs + 6;
    };
    kresliJazyk(jazyk, 'jazyk');
    if (rub.length) {
      if (rub.length * rowH > gap + 1e-6) chyby.push('Rub jazyka má víc stupnic, než kolik je vidět ve štěrbině – přidejte stupnici na líc nebo ji uberte z rubu.');
      kresliJazyk(rub, 'rub');
    }
    // ---------- běžec (fólie) – vodorovně: přední díl | zadní díl | přesah ----------
    let bezecInfo = '';
    if (o.bezec) {
      const wB = Math.max(8, +o.sirkaBezce), t = 3 * tp + 0.4;     // tloušťka pouzdra s jazykem
      const a = Hf + t, Hc = 2 * a + 8;
      const xb = 0, yb = y;
      P.push(cesta([[xb, yb], [xb + Hc, yb], [xb + Hc, yb + wB], [xb, yb + wB]], true, 0.2, 'rez'));
      carkovana(P, xb + a, yb, xb + a, yb + wB, 0.15, 'pomoc');
      carkovana(P, xb + 2 * a, yb, xb + 2 * a, yb + wB, 0.15, 'pomoc');
      P.push(cara(xb + t / 2, yb + wB / 2, xb + a - t / 2, yb + wB / 2, 0.15, 'kresba', CERVENA));
      P.push(text(xb + 2 * a + 4, yb + wB / 2, 'lepit', 1.6, { zar: 's', b: SEDA }));
      const xt = xb + Hc + 4;
      P.push(text(xt, yb + 2.2, 'BĚŽEC – tiskněte na průhlednou fólii', 1.8, { zar: 'l' }));
      P.push(text(xt, yb + 5.4, `přehyby po ${fmt(a, 1)} mm (výška těla ${fmt(Hf, 1)} + tloušťka ${fmt(t, 1)} mm)`, 1.6, { zar: 'l', b: SEDA }));
      P.push(text(xt, yb + 8.4, 'červená vlasová čára = ryska běžce', 1.6, { zar: 'l', b: SEDA }));
      bezecInfo = ` · běžec ${fmt(Hc, 1)} × ${fmt(wB, 1)} mm`;
      y += wB + 2;
    }
    const info = [`Logaritmické pravítko L = ${fmt(L)} mm · ${[horni, jazyk, dolni].map((s) => s.map((q) => q.id).join(' ')).join(' / ')}${rub.length ? ' · rub ' + rub.map((q) => q.id).join(' ') : ''}`,
      `tělo ${fmt(W, 1)} × ${fmt(Hf, 1)} mm, štěrbina ${fmt(gap, 1)} mm, jazyk ${fmt(Hs, 1)} mm${bezecInfo}`];
    return { P, info, radky, rozmer: { W, Hf, Hs, gap, nab, hTop, hBot, rowH } };
  }

  /* ---------- kruhové pravítko ---------- */
  function radekKruh(P, sc, g, R0, dir, cx, cy, minR) {
    const c = sc.cervena ? CERVENA : undefined;
    const rTick = dir > 0 ? R0 : R0 - g.T;                     // nejhustší místo rysek
    const sk = funkcniStupnice(sc, 2 * PI * rTick, minR);
    // plný kruh: hodnota na konci = začátek
    const rys = sk.rysky.filter((r) => !(r.u > 1 - 1e-9 && sk.rysky.some((q) => q.u < 1e-9)));
    P.push(kruh(cx, cy, R0, g.tl));
    for (const r of rys) {
      const t = 360 * r.u, a = bodK(cx, cy, R0, t), b = bodK(cx, cy, R0 + dir * g.T * delkaPomer(r.r), t);
      P.push(cara(a[0], a[1], b[0], b[1], r.r <= 1 ? g.tl * 1.35 : g.tl, 'kresba', c));
    }
    const rL = R0 + dir * (g.T + 0.6 + g.vel / 2), Lp = 2 * PI * rL;
    // písmeno stupnice těsně před indexem (modře), konec = začátek se nepopisuje dvakrát
    const pop = sk.popisky.filter((p) => !(p.u > 1 - 1e-9 && sk.popisky.some((q) => q.u < 1e-9)));
    const p0 = pop.find((p) => p.u < 1e-9);
    const wP = sirkaC(sc.id, g.vel), d = (wP / 2 + (p0 ? sirkaC(p0.txt, g.vel) / 2 : 0) + 1.2) / Lp;
    pop.push({ u: 1 - d, txt: sc.id, pri: -1, pismeno: true, mal: false });
    for (const p of rozmisti(pop, Lp, g.vel, g.velMal, 0.6, true)) {
      const v = p.mal ? g.velMal : g.vel, t = 360 * p.u;
      if (p.znacka) { const a = bodK(cx, cy, R0, t), b = bodK(cx, cy, R0 + dir * g.T * 0.9, t); P.push(cara(a[0], a[1], b[0], b[1], g.tl, 'kresba', c)); }
      const q = bodK(cx, cy, R0 + dir * (g.T + 0.6 + v / 2), t);
      P.push(text(q[0], q[1], plain(p.txt).replace('^', ''), v, { rot: t, b: p.pismeno ? MODRA : c }));
    }
    return sk;
  }

  function pravitkoKruh(o, chyby) {
    const P = [], g = geometrieRadku(o);
    const R = Math.min(300, Math.max(25, +o.r || 50));
    const rotor = ctiStupnice(o.jazyk, chyby, 'jazyk – vnitřní kotouč').reverse();
    const stator = ctiStupnice(o.dolni, chyby, 'dolní pás – vnější kotouč').concat(ctiStupnice(o.horni, chyby, 'horní pás – vnější kotouč').reverse());
    if (!rotor.length) { chyby.push('Vnitřní kotouč nemá stupnici – doplňte do pole „jazyk“ aspoň C.'); rotor.push(STUPNICE.C); }
    if (!stator.length) { chyby.push('Vnější kotouč nemá stupnici – doplňte do pole „dolní pás“ aspoň D.'); stator.push(STUPNICE.D); }
    const radky = [];
    const Rs = R + stator.length * g.rowH + 2.5;               // vnější kotouč
    const rIn = R - rotor.length * g.rowH;
    if (rIn < 8) chyby.push(`Vnitřní kotouč je na ${rotor.length} stupnic malý (zbývá Ø ${fmt(2 * Math.max(0, rIn), 1)} mm) – zvětšete poloměr.`);
    // vnější kotouč (stator) se středem (0,0)
    P.push(kruh(0, 0, Rs, 0.2, 'rez'), kruh(0, 0, 1.6, 0.2, 'rez'));
    stator.forEach((sc, i) => {
      const sk = radekKruh(P, sc, g, R + i * g.rowH, 1, 0, 0, g.minR);
      radky.push({ id: sc.id, dil: 'stator', cx: 0, cy: 0, r: R + i * g.rowH, dir: 1 });
      if (sk.minRoz < 0.6 - 1e-9) chyby.push(`Stupnice ${sc.id}: číslované rysky jsou jen ${fmt(sk.minRoz, 2)} mm od sebe.`);
    });
    // ukazatel indexu na vnějším kotouči
    const ti = bodK(0, 0, Rs - 0.6, 0);
    P.push(Object.assign(cesta([[ti[0], ti[1]], [ti[0] - 1.4, ti[1] - 2.2], [ti[0] + 1.4, ti[1] - 2.2]], true, 0.1), { vypln: true }));
    // vnitřní kotouč (rotor) pod ním
    const cy2 = Rs + 8 + R, cx2 = -Rs + R;
    P.push(kruh(cx2, cy2, R, 0.2, 'rez'), kruh(cx2, cy2, 1.6, 0.2, 'rez'));
    rotor.forEach((sc, j) => {
      const sk = radekKruh(P, sc, g, R - j * g.rowH, -1, cx2, cy2, g.minR);
      radky.push({ id: sc.id, dil: 'rotor', cx: cx2, cy: cy2, r: R - j * g.rowH, dir: -1 });
      if (sk.minRoz < 0.6 - 1e-9) chyby.push(`Stupnice ${sc.id}: číslované rysky jsou jen ${fmt(sk.minRoz, 2)} mm od sebe.`);
    });
    // legenda uprostřed rotoru (vzorce)
    const leg = [...rotor, ...stator], lh = g.velMal * 1.6;
    if (rIn - 3 > leg.length * lh / 2 + 4) {
      leg.forEach((sc, i) => {
        const yy = cy2 + 4 + g.velMal / 2 + i * lh;
        if (yy + g.velMal / 2 < cy2 + rIn - 2) {
          textC(P, cx2 - 0.6, yy, sc.id + ' ', g.velMal, { zar: 'p', b: MODRA });
          textC(P, cx2 + 0.6, yy, sc.vzorec, g.velMal, { zar: 'l' });
        }
      });
      P.push(text(cx2, cy2 - 4 - g.velMal / 2, `R = ${fmt(R)} mm`, g.velMal, { b: SEDA }));
    }
    // rameno běžce (fólie)
    if (o.bezec) {
      const wB = Math.max(8, Math.min(20, +o.sirkaBezce)), Lr = Rs + 4;
      const xa = cx2 + R + 10 + wB / 2, ya = cy2 - R + wB / 2;
      P.push(...TT.obdelnikZaobleny(xa - wB / 2, ya - wB / 2, wB, Lr + wB / 2, wB / 2, 0.2, 'rez'));
      P.push(kruh(xa, ya, 1.6, 0.2, 'rez'));
      P.push(cara(xa, ya + 3, xa, ya + Lr - 1, 0.15, 'kresba', CERVENA));
      P.push(text(xa + wB / 2 + 2, ya + 2, 'BĚŽEC (fólie)', 1.7, { zar: 'l', rot: 90 }));
    }
    const info = [`Kruhové logaritmické pravítko · R = ${fmt(R)} mm (obvod ${fmt(2 * PI * R, 1)} mm = 1 dekáda)`,
      `vnější kotouč Ø ${fmt(2 * Rs, 1)}: ${stator.map((s) => s.id).join(' ')} · vnitřní Ø ${fmt(2 * R, 1)}: ${rotor.map((s) => s.id).join(' ')}`];
    return { P, info, radky, rozmer: { R, Rs, rIn } };
  }

  function genPravitko(vst) {
    const o = Object.assign({}, VYCHOZI_PR, vst), chyby = [];
    const v = o.typ === 'kruh' ? pravitkoKruh(o, chyby) : pravitkoRovne(o, chyby);
    if (+o.minR < 0.6) chyby.push('Nejmenší rozestup rysek pod 0,6 mm – jemné dělení při tisku splyne.');
    return TT.kresba(v.P, 'Logaritmické pravítko', v.info, 0.6, { chyby, radky: v.radky, rozmer: v.rozmer });
  }

  const nap = 'Zkratky oddělené mezerou, shora dolů: ' + Object.keys(STUPNICE).join(', ') + '.';
  TT.registruj({
    id: 'logpravitko', ikona: '🧮', nazev: 'Logaritmické pravítko', poradi: 75,
    popis: 'Funkční papírové logaritmické pravítko k vystřižení: tělo-pouzdro, jazyk a běžec z fólie (nebo kruhové se dvěma kotouči). Stupnice A, B, C, D, CI, CF/DF, K, L, S, T, ST, LL1–LL3, Ln s automatickým dělením.',
    vychozi: VYCHOZI_PR,
    schema: [
      H('Typ a délka'),
      F('typ', 'vyber', 'Provedení', { moznosti: [['rovne', 'rovné (tělo + jazyk + běžec)'], ['kruh', 'kruhové (dva kotouče)']] }),
      C('delka', 'Délka stupnice C/D', 'mm', { min: 50, max: 1000, pul: true, kdy: (o) => o.typ !== 'kruh' }),
      C('r', 'Poloměr stupnice C/D', 'mm', { min: 25, max: 300, pul: true, kdy: (o) => o.typ === 'kruh' }),
      H('Stupnice'),
      F('horni', 'text', 'Horní pás těla (u kruhového: vnější kotouč, vně)', { napoveda: nap }),
      F('jazyk', 'text', 'Jazyk (u kruhového: vnitřní kotouč)'),
      F('dolni', 'text', 'Dolní pás těla (u kruhového: vnější kotouč u okraje)'),
      F('rub', 'text', 'Rub jazyka', { kdy: (o) => o.typ !== 'kruh' }),
      H('Rysky a písmo'),
      C('rysky', 'Nejdelší ryska', 'mm', { min: 2, max: 10, pul: true }), C('pismo', 'Písmo', 'mm', { min: 1.6, max: 5, pul: true }),
      C('minR', 'Nejmenší rozestup rysek', 'mm', { min: 0.3, max: 3, pul: true, napoveda: 'Automatické dělení zvolí nejjemnější krok, jehož rysky jsou aspoň takto daleko.' }),
      C('tl', 'Tloušťka rysek', 'mm', { min: 0.1, max: 0.25, pul: true }),
      H('Konstrukce'),
      C('vule', 'Vůle jazyka', 'mm', { min: 0.1, max: 3, pul: true, kdy: (o) => o.typ !== 'kruh' }),
      C('papir', 'Tloušťka kartonu', 'mm', { min: 0, max: 1, pul: true, kdy: (o) => o.typ !== 'kruh' }),
      C('okraj', 'Náběh (0 = automaticky)', 'mm', { min: 0, max: 60, pul: true, kdy: (o) => o.typ !== 'kruh' }),
      F('bezec', 'zaskrt', 'Běžec z fólie', { pul: true }), C('sirkaBezce', 'Šířka běžce', 'mm', { min: 8, max: 60, pul: true, kdy: (o) => o.bezec }),
      F('navod', 'zaskrt', 'Návod na zadní stěnu', { kdy: (o) => o.typ !== 'kruh' }),
    ],
    predvolby: [
      ['Školní C/D 125 mm', { typ: 'rovne', delka: 125, horni: '', jazyk: 'C', dolni: 'D', rub: '' }],
      ['Mannheim 125 mm (K A / B CI C / D)', { typ: 'rovne', delka: 125, horni: 'K A', jazyk: 'B CI C', dolni: 'D', rub: '' }],
      ['Rietz 125 mm (S ST T na rubu jazyka)', { typ: 'rovne', delka: 125, horni: 'K A', jazyk: 'B CI C', dolni: 'D L', rub: 'S ST T' }],
      ['Rietz 125 mm (S T dole na těle)', { typ: 'rovne', delka: 125, horni: 'K A', jazyk: 'B CI C', dolni: 'D L S T', rub: '' }],
      ['Darmstadt zjednodušeně (LL1–LL3)', { typ: 'rovne', delka: 125, horni: 'K A', jazyk: 'B CI C', dolni: 'D LL1 LL2 LL3', rub: 'S ST T' }],
      ['Posunuté CF/DF + Ln', { typ: 'rovne', delka: 125, horni: 'DF', jazyk: 'CF CI C', dolni: 'D LL2 LL3 Ln', rub: '' }],
      ['Dlouhé 250 mm Rietz (A3)', { typ: 'rovne', delka: 250, horni: 'K A', jazyk: 'B CI C', dolni: 'D L S T', rub: '' }],
      ['Kruhové C/D, R 50 mm', { typ: 'kruh', r: 50, horni: '', jazyk: 'C', dolni: 'D' }],
      ['Kruhové Mannheim, R 60 mm', { typ: 'kruh', r: 60, horni: 'K A', jazyk: 'B CI C', dolni: 'D' }],
    ],
    gen: genPravitko,
  });

  /* ============================================================
     REŽIM B – FUNKČNÍ PAPÍRY
     ============================================================ */

  /* inverzní distribuční funkce normálního rozdělení – Wichura, AS 241 (PPND16), přesnost ~1e-16 */
  function normInv(p) {
    if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
    const q = p - 0.5;
    let r, v;
    if (Math.abs(q) <= 0.425) {
      r = 0.180625 - q * q;
      return q * (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r + 67265.770927008700853) * r + 45921.953931549871457) * r
        + 13731.693765509461125) * r + 1971.5909503065514427) * r + 133.14166789178437745) * r + 3.387132872796366608)
        / (((((((r * 5226.495278852545925 + 28729.085735721942674) * r + 39307.89580009271061) * r + 21213.794301586595867) * r
        + 5394.1960214247511077) * r + 687.1870074920579083) * r + 42.313330701600911252) * r + 1);
    }
    r = Math.sqrt(-Math.log(q < 0 ? p : 1 - p));
    if (r <= 5) {
      r -= 1.6;
      v = (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r + 0.24178072517745061177) * r + 1.27045825245236838258) * r
        + 3.64784832476320460504) * r + 5.7694972214606914055) * r + 4.6303378461565452959) * r + 1.42343711074968357734)
        / (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r + 0.14810397642748007459) * r
        + 0.68976733498510000455) * r + 1.6763848301838038494) * r + 2.05319162663775882187) * r + 1);
    } else {
      r -= 5;
      v = (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r + 0.026532189526576123093) * r
        + 0.29656057182850489123) * r + 1.7848265399172913358) * r + 5.4637849111641143699) * r + 6.6579046435011037772)
        / (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r + 7.868691311456132591e-4) * r
        + 0.0148753612908506148525) * r + 0.13692988092273580531) * r + 0.59983220655588793769) * r + 1);
    }
    return q < 0 ? -v : v;
  }

  const VYCHOZI_PA = {
    typ: 'semilog', w: 180, h: 250, osaLog: 'y', dekady: 3, odExp: 0, dekX: 2, dekY: 3,
    linKrok: 2, linPopis: 10, krok: 5, orientace: 'spicate', tecky: false, cisla: false,
    a: 200, krokT: 'auto', nazvy: 'A, B, C', pMin: 0.01, pMax: 99.99, osaP: 'x', sigma: true, uhel: 15,
    barva: 'seda', tlJemna: 0.07, tlHlavni: 0.25, pismo: 2, minR: 1, popisy: true, ramec: true,
  };

  /* popisek mocniny 10^k */
  function popisMocniny(k) {
    if (k >= -3 && k <= 4) return fmt(Math.pow(10, k), 3);
    return [['10'], [fmt(k), 1]];
  }
  function stupniceLog(e0, n) {
    const pod = [];
    for (let e = e0; e < e0 + n; e++) pod.push([mocnina(1, e), mocnina(1, e + 1), mocnina(1, e), (v) => String(Math.round(mant(v)))]);
    return {
      f: (v) => (LOG(v) - e0) / n, od: mocnina(1, e0), do: mocnina(1, e0 + n), uzly: dek(e0, e0 + n),
      popis: (v) => (trida(v) === 0 ? popisMocniny(Math.round(LOG(v))) : null), pod,
      hlavni: (v) => trida(v) === 0,
    };
  }
  const UZLY_P = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99, 99.5, 99.8, 99.9, 99.95, 99.98, 99.99];
  const HLAVNI_P = [0.1, 1, 10, 50, 90, 99, 99.9];
  function stupniceP(pMin, pMax) {
    const z0 = normInv(pMin / 100), z1 = normInv(pMax / 100);
    return {
      f: (p) => (normInv(p / 100) - z0) / (z1 - z0), od: pMin, do: pMax,
      uzly: [...new Set([pMin, ...UZLY_P.filter((p) => p > pMin && p < pMax), pMax])],
      popis: (p) => fmt(p, 2), hlavni: (p) => HLAVNI_P.some((q) => Math.abs(q - p) < 1e-9), z0, z1,
    };
  }

  /* Liang–Barsky: ořez úsečky obdélníkem [0,W]×[0,H] */
  function orez(x1, y1, x2, y2, W, H) {
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    for (const [p, q] of [[-dx, x1], [dx, W - x1], [-dy, y1], [dy, H - y1]]) {
      if (Math.abs(p) < 1e-12) { if (q < -1e-9) return null; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    if (t1 - t0 < 1e-9) return null;
    return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
  }

  function genPapir(vst) {
    const o = Object.assign({}, VYCHOZI_PA, vst), chyby = [], P = [];
    const b = TT.SCHEMATA_MRIZKY[o.barva] || TT.SCHEMATA_MRIZKY.seda;
    const tj = Math.max(0.03, +o.tlJemna), th = Math.max(tj, +o.tlHlavni), ts = (tj + th) / 2;
    const vel = Math.max(1.6, +o.pismo), velMal = Math.max(1.6, vel * 0.8);
    const minR = Math.max(0.4, +o.minR || 1);
    if (+o.minR < 0.6) chyby.push('Rozestup čar pod 0,6 mm – mřížka při tisku splyne.');
    const W = Math.min(2000, Math.max(20, +o.w || 180)), Hh = Math.min(2000, Math.max(20, +o.h || 250));
    const lc = (x1, y1, x2, y2, s, barva) => P.push(cara(x1, y1, x2, y2, s, 'kresba', barva));
    const styl = (r, hl) => (hl ? [th, b.hlavni] : r <= 1 ? [ts, b.stredni] : r <= 2 ? [tj * 1.4, b.jemna] : [tj, b.jemna]);
    let info, nazev = 'Funkční papír';

    /* osa (log / pravděpodobnostní) přes celou plochu: svisle = čáry x, vodorovně = čáry y */
    function osaFunkcni(sc, svisle, W, H) {
      const Ld = svisle ? W : H;
      const sk = funkcniStupnice(sc, Ld, minR);
      const pos = (u) => (svisle ? u * W : H - u * H);      // osa y roste nahoru
      const ser = sk.rysky.map((r) => ({ r, hl: sc.hlavni && r.r <= 1 && sc.hlavni(r.v) }))
        .sort((a, c) => (a.hl - c.hl) || (c.r.r - a.r.r));
      for (const { r, hl } of ser) {
        const [s, barva] = styl(r.r, hl), p = pos(r.u);
        if (svisle) lc(p, 0, p, H, s, barva); else lc(0, p, W, p, s, barva);
      }
      if (o.popisy) {
        for (const p of rozmisti(sk.popisky, Ld, vel, velMal, 0.8, false, null, !svisle)) {
          const v = p.mal ? velMal : vel, q = pos(p.u);
          if (svisle) textC(P, q, H + 1.2 + v / 2, p.txt, v, { b: b.text });
          else textC(P, -1.2, q, p.txt, v, { zar: 'p', b: b.text });
        }
      }
      if (sk.minRoz < 0.6 - 1e-9) chyby.push(`Čáry uzlů jsou místy jen ${fmt(sk.minRoz, 2)} mm od sebe – zvětšete plochu nebo uberte dekády.`);
      return sk;
    }
    function osaLin(svisle, W, H) {
      const k = Math.max(0.5, +o.linKrok), Ld = svisle ? W : H, n = Math.floor(Ld / k + 1e-9);
      // zvýraznění po 10 mm a 5 mm – jen když na ně krok přesně padne
      const kh = jeCele(10 / k) ? Math.round(10 / k) : 10, ks = jeCele(5 / k) && kh > 1 ? Math.round(5 / k) : kh;
      for (const u of [0, 1, 2]) for (let i = 0; i <= n; i++) {
        const lev = i % kh === 0 ? 2 : i % ks === 0 ? 1 : 0;
        if (lev !== u) continue;
        const p = svisle ? i * k : H - i * k;
        const s = [tj, ts, th][lev], barva = [b.jemna, b.stredni, b.hlavni][lev];
        if (svisle) lc(p, 0, p, H, s, barva); else lc(0, p, W, p, s, barva);
      }
      if (o.popisy) {
        const pk = Math.max(k, +o.linPopis || 10);
        const kk = Math.max(1, Math.round(pk / k));
        for (let i = 0; i <= n; i += kk) {
          const t = fmt(i * k, 2);
          if (svisle) P.push(text(i * k, Hh + 1.2 + vel / 2, t, vel, { b: b.text }));
          else P.push(text(-1.2, Hh - i * k, t, vel, { zar: 'p', b: b.text }));
        }
      }
      if (k * 1 < 0.8) chyby.push('Krok lineární osy pod 0,8 mm tiskárna nevykreslí čitelně.');
    }

    if (o.typ === 'semilog') {
      const n = Math.max(1, Math.min(10, Math.round(+o.dekady))), e0 = Math.round(+o.odExp) || 0;
      const logX = o.osaLog === 'x';
      osaLin(!logX, W, Hh);
      osaFunkcni(stupniceLog(e0, n), logX, W, Hh);
      const dl = (logX ? W : Hh) / n;
      nazev = 'Semilogaritmický papír';
      info = [`Semilogaritmický papír ${fmt(W)} × ${fmt(Hh)} mm · ${n} dekád na ose ${logX ? 'X' : 'Y'} (${fmt(dl, 2)} mm/dekádu)`, `lineární osa: krok ${fmt(+o.linKrok)} mm`];
      P.push(text(W, -1.6 - vel / 2, `1 dekáda = ${fmt(dl, 2)} mm`, velMal, { zar: 'p', b: b.text }));
    } else if (o.typ === 'loglog') {
      const nx = Math.max(1, Math.min(10, Math.round(+o.dekX))), ny = Math.max(1, Math.min(10, Math.round(+o.dekY))), e0 = Math.round(+o.odExp) || 0;
      osaFunkcni(stupniceLog(e0, nx), true, W, Hh);
      osaFunkcni(stupniceLog(e0, ny), false, W, Hh);
      nazev = 'Logaritmický papír (log-log)';
      info = [`Log-log papír ${fmt(W)} × ${fmt(Hh)} mm · ${nx} × ${ny} dekád`, `dekáda X ${fmt(W / nx, 2)} mm, Y ${fmt(Hh / ny, 2)} mm`];
      P.push(text(W, -1.6 - vel / 2, `dekáda X ${fmt(W / nx, 2)} mm · Y ${fmt(Hh / ny, 2)} mm`, velMal, { zar: 'p', b: b.text }));
    } else if (o.typ === 'normal') {
      let pMin = +o.pMin, pMax = +o.pMax;
      if (!(pMin > 0 && pMax < 100 && pMin < pMax)) { chyby.push('Rozsah pravděpodobnosti musí splňovat 0 < od < do < 100 %.'); pMin = 0.01; pMax = 99.99; }
      if (pMin < 0.001 || pMax > 99.999) { chyby.push('Rozsah omezen na 0,001–99,999 %.'); pMin = Math.max(0.001, pMin); pMax = Math.min(99.999, pMax); }
      const pX = o.osaP !== 'y';
      const sc = stupniceP(pMin, pMax);
      osaLin(!pX, W, Hh);
      osaFunkcni(sc, pX, W, Hh);
      if (o.sigma) {                                          // z (násobky σ) na protější straně
        const Ld = pX ? W : Hh;
        for (let z = Math.ceil(sc.z0); z <= Math.floor(sc.z1); z++) {
          const u = (z - sc.z0) / (sc.z1 - sc.z0), t = z === 0 ? 'μ' : (z > 0 ? '+' : '−') + Math.abs(z) + 'σ';
          if (pX) { const x = u * Ld; lc(x, 0, x, -1.8, th, b.osa); P.push(text(x, -2.6 - velMal / 2, t, velMal, { b: b.text })); }
          else { const y = Hh - u * Ld; lc(W, y, W + 1.8, y, th, b.osa); P.push(text(W + 2.6, y, t, velMal, { zar: 'l', b: b.text })); }
        }
      }
      nazev = 'Pravděpodobnostní papír';
      info = [`Pravděpodobnostní (normální) papír ${fmt(W)} × ${fmt(Hh)} mm · ${fmt(pMin, 3)}–${fmt(pMax, 3)} % na ose ${pX ? 'X' : 'Y'}`,
        `osa = Φ⁻¹(p): z od ${fmt(sc.z0, 3)} do ${fmt(sc.z1, 3)} (${fmt((pX ? W : Hh) / (sc.z1 - sc.z0), 2)} mm/σ)`];
      P.push(text(0, pX ? Hh + 2.8 + vel * 1.6 : -2 - velMal / 2, `kumulativní četnost [%]${pX ? '' : ' ↑'} · ${fmt((pX ? W : Hh) / (sc.z1 - sc.z0), 2)} mm na 1 σ`, velMal, { zar: 'l', b: b.text }));
    } else if (o.typ === 'hex') {
      const s = Math.max(1, +o.krok), a = s / Math.sqrt(3), spic = o.orientace !== 'ploche';
      // spic: vrchol nahoře; středy po řádcích s rozestupem 1,5a, liché řádky posunuté o s/2
      const stredy = [];
      const ni = Math.ceil((spic ? W : Hh) / s) + 2, nj = Math.ceil((spic ? Hh : W) / (1.5 * a)) + 2;
      if (ni * nj > 60000) chyby.push('Příliš malý krok šestiúhelníků pro tuto plochu (limit 60 000 buněk).');
      else {
        for (let j = -1; j < nj; j++) for (let i = -1; i < ni; i++) {
          // posun tak, aby buňka (0,0) ležela celá v ploše u levého horního rohu
          const p = i * s + (Math.abs(j) % 2 === 1 ? s / 2 : 0) + s / 2, q = j * 1.5 * a + a;
          const cx = spic ? p : q, cy = spic ? q : p;
          stredy.push([cx, cy, i, j]);
          const vr = [];
          for (let k = 0; k < 6; k++) { const t = rad(60 * k + (spic ? -90 : 0)); vr.push([cx + a * Math.cos(t), cy + a * Math.sin(t)]); }
          // každá buňka kreslí jen 3 „své“ hrany (zbylé tři patří sousedům) – žádné zdvojené čáry
          for (let k = 0; k < 3; k++) {
            const A = vr[k], B = vr[k + 1];
            const c = orez(A[0], A[1], B[0], B[1], W, Hh);
            if (c) lc(c[0], c[1], c[2], c[3], ts, b.stredni);
          }
        }
        if (o.tecky) for (const [cx, cy] of stredy) if (cx >= 0 && cx <= W && cy >= 0 && cy <= Hh) P.push(Object.assign(kruh(cx, cy, Math.max(0.12, th * 0.8), 0, 'kresba', true), { b: b.hlavni }));
        if (o.cisla) {
          const vc = Math.min(vel, s * 0.17);
          if (vc < 1.6) chyby.push('Číslování buněk potřebuje krok aspoň 9,5 mm (písmo ≥ 1,6 mm).');
          else for (const [cx, cy, i, j] of stredy) {
            const hx = spic ? s / 2 : a, hy = spic ? a : s / 2;
            if (cx - hx < -1e-6 || cx + hx > W + 1e-6 || cy - hy < -1e-6 || cy + hy > Hh + 1e-6) continue;
            const t = String(spic ? i + 1 : j + 1).padStart(2, '0') + String(spic ? j + 1 : i + 1).padStart(2, '0');
            P.push(text(cx, cy - a * 0.52, t, vc, { b: b.text }));
          }
        }
      }
      if (s / Math.sqrt(3) < 0.8) chyby.push('Strana šestiúhelníku pod 0,8 mm je nečitelná.');
      nazev = 'Šestiúhelníková mřížka';
      info = [`Šestiúhelníková mřížka ${fmt(W)} × ${fmt(Hh)} mm · rozteč (přes plochy) ${fmt(s)} mm`, `strana ${fmt(a, 3)} mm, přes vrcholy ${fmt(2 * a, 3)} mm · ${spic ? 'vrchol nahoře' : 'plocha nahoře'}`];
    } else if (o.typ === 'ternar') {
      const A = Math.min(600, Math.max(40, +o.a || 200)), h = A * Math.sqrt(3) / 2;
      const top = [A / 2, 0], BL = [0, h], BR = [A, h];
      const bod = (a, bb, c) => [a * top[0] + bb * BL[0] + c * BR[0], a * top[1] + bb * BL[1] + c * BR[1]];
      let krokT = +o.krokT;
      if (!(krokT > 0)) krokT = [1, 2, 5, 10].find((k) => h * k / 100 >= minR) || 10;
      if (!jeCele(100 / krokT)) { chyby.push('Krok ternární mřížky musí dělit 100 %.'); krokT = 10; }
      if (h * krokT / 100 < 0.6) chyby.push(`Čáry ternární mřížky jsou jen ${fmt(h * krokT / 100, 2)} mm od sebe.`);
      const n = Math.round(100 / krokT);
      for (const u of [0, 1, 2]) for (let i = 1; i < n; i++) {
        const t = i * krokT, lev = jeCele(t / 10) ? 2 : jeCele(t / 5) && krokT < 5 ? 1 : 0;
        if (lev !== u) continue;
        const f = t / 100, s = [tj, ts, th][lev], barva = [b.jemna, b.stredni, b.hlavni][lev];
        let p = bod(f, 1 - f, 0), q = bod(f, 0, 1 - f); lc(p[0], p[1], q[0], q[1], s, barva);       // A = konst. (vodorovně)
        p = bod(1 - f, f, 0); q = bod(0, f, 1 - f); lc(p[0], p[1], q[0], q[1], s, barva);           // B = konst. (‖ pravé hraně)
        p = bod(1 - f, 0, f); q = bod(0, 1 - f, f); lc(p[0], p[1], q[0], q[1], s, barva);           // C = konst. (‖ levé hraně)
      }
      P.push(cesta([top, BR, BL], true, th * 1.3, 'kresba'));
      P[P.length - 1].b = b.osa;
      const jm = String(o.nazvy || '').split(/\s*[,;]\s*/).map((x) => x.trim());
      const [nA, nB, nC] = [jm[0] || 'A', jm[1] || 'B', jm[2] || 'C'];
      const tik = 1.8, mz = 0.8;
      const sm = { A: [-1, 0], B: [0.5, Math.sqrt(3) / 2], C: [0.5, -Math.sqrt(3) / 2] };
      let wMax = 0;
      if (o.popisy) for (let t = 0; t <= 100 + 1e-9; t += 10) {
        const f = t / 100, txt = fmt(t);
        wMax = Math.max(wMax, sirka(txt, vel));
        for (const [osa, p] of [['A', bod(f, 1 - f, 0)], ['B', bod(0, f, 1 - f)], ['C', bod(1 - f, 0, f)]]) {
          const [dx, dy] = sm[osa];
          lc(p[0], p[1], p[0] + dx * tik, p[1] + dy * tik, th, b.osa);
          const tx = p[0] + dx * (tik + mz), ty = p[1] + dy * (tik + mz);
          if (osa === 'A') P.push(text(tx, ty, txt, vel, { zar: 'p', b: b.text }));
          else P.push(text(tx, ty, txt, vel, { zar: 'l', rot: osa === 'B' ? 60 : -60, b: b.text }));
        }
      }
      // názvy os podél hran a vrcholů
      const odst = tik + mz + wMax * 0.9 + 2.5 + vel / 2;
      const stredH = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      let m = stredH(BL, top); P.push(text(m[0] - 0.866 * odst, m[1] - 0.5 * odst, `${nA} [%] →`, vel, { rot: -60, b: b.text }));
      m = stredH(BL, BR); P.push(text(m[0], m[1] + odst, `← ${nB} [%]`, vel, { b: b.text }));
      m = stredH(top, BR); P.push(text(m[0] + 0.866 * odst, m[1] - 0.5 * odst, `${nC} [%] →`, vel, { rot: 60, b: b.text }));
      P.push(text(top[0], top[1] - (tik + mz + sirka('0', vel)) * 0.87 - 1.5 - vel * 0.6, nA, vel * 1.15, { b: b.text }));
      P.push(text(BL[0] - 0.866 * 9, BL[1] + 0.5 * 9, nB, vel * 1.15, { zar: 'p', b: b.text }));
      P.push(text(BR[0] + 0.866 * 9, BR[1] + 0.5 * 9, nC, vel * 1.15, { zar: 'l', b: b.text }));
      nazev = 'Ternární diagram';
      info = [`Ternární (trojúhelníkový) diagram · strana ${fmt(A)} mm, výška ${fmt(h, 2)} mm`, `mřížka po ${fmt(krokT)} % (${fmt(h * krokT / 100, 2)} mm) · ${nA} + ${nB} + ${nC} = 100 %`];
      return TT.kresba(P, nazev, info, 0.5, { chyby });
    } else if (o.typ === 'polarlog') {
      const n = Math.max(1, Math.min(6, Math.round(+o.dekady))), e0 = Math.round(+o.odExp) || 0;
      const cx = W / 2, cy = Hh / 2, Rm = Math.min(W, Hh) / 2 - (vel + 3);
      const sc = stupniceLog(e0, n), sk = funkcniStupnice(sc, Rm, minR);
      const ser = sk.rysky.map((r) => ({ r, hl: r.r <= 1 && sc.hlavni(r.v) })).sort((a, c) => (a.hl - c.hl) || (c.r.r - a.r.r));
      for (const { r, hl } of ser) if (r.u > 1e-9) { const [s, barva] = styl(r.r, hl); P.push(Object.assign(kruh(cx, cy, r.u * Rm, s), { b: barva })); }
      const uh = Math.max(1, +o.uhel), uj = uh >= 10 ? uh / (jeCele(uh / 15) ? 3 : 2) : uh;
      const nj = Math.round(360 / uj);
      for (let j = 0; j < nj; j++) {
        const t = j * uj, hl = jeCele(t / uh), r0 = hl ? (jeCele(t / 90) ? 0 : Rm / n / 2) : Rm / n;
        const p = bodK(cx, cy, r0, t), q = bodK(cx, cy, Rm, t);
        lc(p[0], p[1], q[0], q[1], hl ? ts : tj, hl ? b.stredni : b.jemna);
        if (hl && o.popisy) { const z = bodK(cx, cy, Rm + 1.2 + vel / 2, t); P.push(text(z[0], z[1], fmt(((90 - t) % 360 + 360) % 360) + '°', vel, { rot: t, b: b.text })); }
      }
      if (o.popisy) for (const p of rozmisti(sk.popisky, Rm, vel, velMal, 0.8)) {
        const v = p.mal ? velMal : vel;
        const w = sirkaC(p.txt, v), x = p.u * Rm;
        if (x + w / 2 > Rm - 0.4) textC(P, cx + Rm - 0.4, cy - 0.9 - v / 2, p.txt, v, { zar: 'p', b: b.text });
        else textC(P, cx + Math.max(x, w / 2 + 0.4), cy - 0.9 - v / 2, p.txt, v, { b: b.text });
      }
      nazev = 'Polární logaritmický papír';
      info = [`Polární logaritmický papír · Ø ${fmt(2 * Rm, 1)} mm · ${n} dekád (${fmt(Rm / n, 2)} mm/dekádu)`, `paprsky po ${fmt(uj)}° (zvýrazněné po ${fmt(uh)}°)`];
      return TT.kresba(P, nazev, info, 0.5, { chyby });
    } else {
      chyby.push('Neznámý druh papíru.');
      info = ['Funkční papír'];
    }
    if (o.ramec) P.push(Object.assign(cesta([[0, 0], [W, 0], [W, Hh], [0, Hh]], true, th, 'kresba'), { b: b.osa }));
    return TT.kresba(P, nazev, info, 0.5, { chyby });
  }

  const je = (...t) => (o) => t.indexOf(o.typ) >= 0;
  TT.registruj({
    id: 'logpapir', ikona: '📈', nazev: 'Funkční papíry', poradi: 76,
    popis: 'Semilogaritmický a logaritmický (log-log) papír, šestiúhelníková mřížka, ternární diagram a pravděpodobnostní (normální) papír s přesně spočtenými osami – pro ruční vynášení dat a odečítání závislostí.',
    vychozi: VYCHOZI_PA,
    schema: [
      H('Druh papíru'),
      F('typ', 'vyber', 'Papír', { moznosti: [['semilog', 'semilogaritmický'], ['loglog', 'logaritmický (log-log)'], ['normal', 'pravděpodobnostní (normální)'],
        ['hex', 'šestiúhelníková mřížka'], ['ternar', 'ternární (trojúhelníkový) diagram'], ['polarlog', 'polární logaritmický']] }),
      C('w', 'Šířka plochy', 'mm', { min: 20, max: 2000, pul: true, kdy: (o) => o.typ !== 'ternar' }),
      C('h', 'Výška plochy', 'mm', { min: 20, max: 2000, pul: true, kdy: (o) => o.typ !== 'ternar' }),
      C('a', 'Strana trojúhelníku', 'mm', { min: 40, max: 600, kdy: je('ternar') }),
      H('Osy'),
      F('osaLog', 'vyber', 'Logaritmická osa', { moznosti: [['y', 'svislá (Y)'], ['x', 'vodorovná (X)']], pul: true, kdy: je('semilog') }),
      C('dekady', 'Počet dekád', '', { min: 1, max: 10, cele: true, pul: true, kdy: je('semilog', 'polarlog') }),
      C('dekX', 'Dekád na ose X', '', { min: 1, max: 10, cele: true, pul: true, kdy: je('loglog') }),
      C('dekY', 'Dekád na ose Y', '', { min: 1, max: 10, cele: true, pul: true, kdy: je('loglog') }),
      C('odExp', 'Začátek osy 10^n, n =', '', { min: -9, max: 9, cele: true, pul: true, kdy: je('semilog', 'loglog', 'polarlog') }),
      F('osaP', 'vyber', 'Osa pravděpodobnosti', { moznosti: [['x', 'vodorovná (X)'], ['y', 'svislá (Y)']], pul: true, kdy: je('normal') }),
      C('pMin', 'Od', '%', { min: 0.001, max: 50, pul: true, kdy: je('normal') }), C('pMax', 'Do', '%', { min: 50, max: 99.999, pul: true, kdy: je('normal') }),
      F('sigma', 'zaskrt', 'Značky ±σ na protější straně', { kdy: je('normal') }),
      C('linKrok', 'Krok lineární osy', 'mm', { min: 0.5, max: 50, pul: true, kdy: je('semilog', 'normal') }),
      C('linPopis', 'Popis lineární osy po', 'mm', { min: 1, max: 200, pul: true, kdy: je('semilog', 'normal') }),
      C('krok', 'Rozteč šestiúhelníků (přes plochy)', 'mm', { min: 1, max: 100, pul: true, kdy: je('hex') }),
      F('orientace', 'vyber', 'Natočení', { moznosti: [['spicate', 'vrchol nahoře'], ['ploche', 'plocha nahoře']], pul: true, kdy: je('hex') }),
      F('tecky', 'zaskrt', 'Tečky ve středech', { pul: true, kdy: je('hex') }), F('cisla', 'zaskrt', 'Číslovat buňky (SSRR)', { pul: true, kdy: je('hex') }),
      F('krokT', 'vyber', 'Krok mřížky', { moznosti: [['auto', 'automaticky'], ['1', '1 %'], ['2', '2 %'], ['5', '5 %'], ['10', '10 %']], pul: true, kdy: je('ternar') }),
      F('nazvy', 'text', 'Názvy složek (horní, levá dolní, pravá dolní)', { kdy: je('ternar') }),
      C('uhel', 'Paprsky po', '°', { min: 1, max: 90, pul: true, kdy: je('polarlog') }),
      H('Vzhled'),
      F('barva', 'vyber', 'Barvy', { moznosti: [['seda', 'šedá'], ['modra', 'modrá'], ['oranzova', 'oranžová'], ['cerna', 'černá']], pul: true }),
      C('minR', 'Nejmenší rozestup čar', 'mm', { min: 0.4, max: 5, pul: true }),
      C('tlJemna', 'Tloušťka jemných čar', 'mm', { min: 0.03, max: 0.3, pul: true }), C('tlHlavni', 'Tloušťka hlavních čar', 'mm', { min: 0.05, max: 0.6, pul: true }),
      C('pismo', 'Písmo', 'mm', { min: 1.6, max: 5, pul: true }),
      F('popisy', 'zaskrt', 'Popisy os', { pul: true }), F('ramec', 'zaskrt', 'Rámeček', { pul: true, kdy: (o) => o.typ !== 'ternar' && o.typ !== 'polarlog' }),
    ],
    predvolby: [
      ['Semilog 3 dekády (Y), A4', { typ: 'semilog', w: 180, h: 255, osaLog: 'y', dekady: 3, odExp: 0, linKrok: 2, linPopis: 10, barva: 'seda' }],
      ['Semilog 5 dekád (X), A4 na šířku', { typ: 'semilog', w: 260, h: 170, osaLog: 'x', dekady: 5, odExp: 0, linKrok: 2, linPopis: 10, barva: 'modra' }],
      ['Semilog 2 dekády, oranžový', { typ: 'semilog', w: 180, h: 250, osaLog: 'y', dekady: 2, odExp: 0, linKrok: 1, linPopis: 10, barva: 'oranzova' }],
      ['Log-log 2 × 3 dekády, A4', { typ: 'loglog', w: 170, h: 255, dekX: 2, dekY: 3, odExp: 0, barva: 'seda' }],
      ['Log-log 3 × 3 dekády, čtverec 180 mm', { typ: 'loglog', w: 180, h: 180, dekX: 3, dekY: 3, odExp: 0, barva: 'modra' }],
      ['Pravděpodobnostní 0,01–99,99 % (X)', { typ: 'normal', w: 180, h: 250, osaP: 'x', pMin: 0.01, pMax: 99.99, linKrok: 2, linPopis: 10, sigma: true }],
      ['Pravděpodobnostní 1–99 % (Y), na šířku', { typ: 'normal', w: 260, h: 170, osaP: 'y', pMin: 1, pMax: 99, linKrok: 2, linPopis: 10, sigma: true, barva: 'modra' }],
      ['Šestiúhelníky 5 mm', { typ: 'hex', w: 180, h: 260, krok: 5, orientace: 'spicate', tecky: false, cisla: false }],
      ['Šestiúhelníky 19 mm (¾″) s čísly – hry', { typ: 'hex', w: 190, h: 270, krok: 19.05, orientace: 'ploche', tecky: true, cisla: true, barva: 'cerna' }],
      ['Ternární 200 mm po 1 %', { typ: 'ternar', a: 200, krokT: 'auto', nazvy: 'A, B, C' }],
      ['Ternární – půdní textura (jíl/písek/prach)', { typ: 'ternar', a: 170, krokT: '2', nazvy: 'Jíl, Písek, Prach', barva: 'oranzova' }],
      ['Polární logaritmický 3 dekády', { typ: 'polarlog', w: 180, h: 180, dekady: 3, odExp: 0, uhel: 15 }],
    ],
    gen: genPapir,
  });

  TT.logaritmy = { STUPNICE, funkcniStupnice, kandidati, jednotky, delkaPomer, rozmisti, normInv, stupniceLog, stupniceP, orez, genPravitko, genPapir };
  if (typeof module !== 'undefined' && module.exports) module.exports = TT;
})(typeof window !== 'undefined' ? window : globalThis);
