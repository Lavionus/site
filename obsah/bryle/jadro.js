/* Brýlové obroučky – jádro bez DOM (běží i v node).
   Parametry a meze, předvolby, tvary očnic (boxing systém ISO 8624: A × B, DBL), odvozené rozměry
   (drážka, most, pant, stranice, obtékání), kontroly zadání, optické míry, rozbor tisku po dílech,
   rozložení dílů na podložku, projekt JSON. Obecné funkce tisku (převisy, otočení) bere ze spojky/jadro.js.
   Geometrii skládá bryle/geometrie.js přes manifold-3d. */
(function () {
  'use strict';
  const SP = typeof module !== 'undefined' ? require('../spojky/jadro.js') : window.SPOJKY;
  const { kopie, cislo, fmt, vezmi, poloz, rotaceDolu, otoc, tiskovaPoloha, previsy, potrebujePodpory } = SP;
  const VERZE_FORMATU = 1;
  const RAD = Math.PI / 180;

  /* ---------- tabulky ---------- */
  const TVARY = {
    kulate: { nazev: 'Kulaté', znak: '◯', pole: [] },
    ovalne: { nazev: 'Oválné', znak: '⬭', pole: [] },
    obdelnik: { nazev: 'Obdélník', znak: '▭', pole: ['zaobleni'] },
    wayfarer: { nazev: 'Wayfarer', znak: '⏢', pole: ['zaobleni', 'zuzeni'] },
    kocici: { nazev: 'Kočičí oko', znak: '◠', pole: [] },
    pilotky: { nazev: 'Pilotky (kapka)', znak: '◖', pole: [] },
    sestiuhelnik: { nazev: 'Šestiúhelník', znak: '⬡', pole: ['zaobleni'] },
    panto: { nazev: 'Panto', znak: '◡', pole: [] },
  };
  const PROFILY_DRAZKY = { V: 'V – pro brýlová skla s fazetou', U: 'U – pro ploché sklo / zkušební čočku', falc: 'polodrážka zezadu – sklo / plexi vlepit' };
  const PANTY = { cep: 'čepový pant (tisknutelný)', vcelku: 'bez pantu – vcelku' };
  const CEPY = {
    filament: { nazev: 'filament 1,75 mm', d: 1.75 },
    M14: { nazev: 'šroubek M1,4', d: 1.4 },
    M16: { nazev: 'šroubek M1,6', d: 1.6 },
    M2: { nazev: 'šroubek M2', d: 2 },
  };
  const KDE_TEXT = { prava: 'pravá stranice', leva: 'levá stranice', obe: 'obě stranice' };
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, pozn: 'houževnaté, při ohnutí stranice nepraskne, snese pot a vodu – dobrá volba na nošení' },
    PLA: { nazev: 'PLA', hustota: 1.24, pozn: 'tuhé a křehčí, v autě na slunci měkne (≈ 55 °C) – hlavně na zkoušku tvaru a velikosti' },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, pozn: 'pružný a odolný (z PA12 se tisknou i komerční obruby), nasává vlhkost – tisknout ze sušeného' },
    ASA: { nazev: 'ASA', hustota: 1.07, pozn: 'odolné UV a teplu – sluneční brýle, tiskne se v uzavřené tiskárně' },
    TPU: { nazev: 'TPU 95A', hustota: 1.21, pozn: 'pružné – na návleky koncovek a opěrky, celý přední díl by byl moc měkký' },
  };

  const VYCHOZI = {
    nazev: 'Brýle',
    ocnice: { tvar: 'wayfarer', A: 52, B: 40, zaobleni: 35, zuzeni: 15, sklon: 0 },
    most: { dbl: 18, sirka: 12, uhel: 22, vyska: 5, tloustka: 5 },
    predni: { sirka: 0, obruba: 5, hloubka: 5, wrap: 0 },
    drazka: { profil: 'V', sirka: 2, hloubka: 1, vule: 0.15 },
    cocky: { zapnuto: false, tloustka: 2 },
    pant: { druh: 'cep', cep: 'filament', vule: 0.15, mezera: 0.3 },
    stranice: { delka: 140, vyska: 7, tloustka: 4.5, panto: 8, ohyb: 35, koncovka: 35 },
    text: { zapnuto: true, obsah: '', vyska: 2.4, hloubka: 0.4, kde: 'prava' },
    opt: { pd: 0, hlava: 0 },
    tisk: { material: 'PETG', vypln: 100, previs: 45, orientace: { predni: 'auto', stranice: 'auto' } },
  };

  const ROZSAHY = {
    'ocnice.A': [30, 70], 'ocnice.B': [18, 60], 'ocnice.zaobleni': [0, 100], 'ocnice.zuzeni': [0, 40], 'ocnice.sklon': [-10, 25],
    'most.dbl': [10, 28], 'most.sirka': [6, 26], 'most.uhel': [5, 50], 'most.vyska': [-10, 20], 'most.tloustka': [1.5, 15],
    'predni.sirka': [0, 190], 'predni.obruba': [1.5, 15], 'predni.hloubka': [2, 12], 'predni.wrap': [0, 25],
    'drazka.sirka': [0.6, 6], 'drazka.hloubka': [0.3, 3], 'drazka.vule': [-0.2, 0.6],
    'cocky.tloustka': [0.8, 5],
    'pant.vule': [0, 0.6], 'pant.mezera': [0.1, 1.5],
    'stranice.delka': [90, 170], 'stranice.vyska': [3, 20], 'stranice.tloustka': [2, 10], 'stranice.panto': [0, 20],
    'stranice.ohyb': [0, 70], 'stranice.koncovka': [0, 80],
    'text.vyska': [1, 8], 'text.hloubka': [0.2, 1.5],
    'opt.pd': [0, 80], 'opt.hlava': [0, 200],
    'tisk.vypln': [0, 100], 'tisk.previs': [20, 70],
  };

  const PREDVOLBY = [
    { nazev: 'Pánský wayfarer 54□18-145', popis: 'lichoběžník, silná obruba 6 mm, stranice 9 mm',
      p: { ocnice: { tvar: 'wayfarer', A: 54, B: 42, zaobleni: 30, zuzeni: 18, sklon: 2 }, most: { dbl: 18, sirka: 12, uhel: 22, vyska: 6, tloustka: 6 },
        predni: { obruba: 6, hloubka: 5.5, wrap: 0 }, stranice: { delka: 145, vyska: 9, tloustka: 5, panto: 8, ohyb: 35, koncovka: 35 } } },
    { nazev: 'Dámské kočičí oko 52□17-140', popis: 'zvednuté vnější rohy, sklon horní hrany',
      p: { ocnice: { tvar: 'kocici', A: 52, B: 40, sklon: 8 }, most: { dbl: 17, sirka: 11, uhel: 22, vyska: 6, tloustka: 5 },
        predni: { obruba: 5.5, hloubka: 5, wrap: 0 }, stranice: { delka: 140, vyska: 7, tloustka: 4.5, panto: 8, ohyb: 35, koncovka: 33 } } },
    { nazev: 'Kulaté „lenonky“ 46□20-140', popis: 'kruhové očnice, tenká obruba, nízký most',
      p: { ocnice: { tvar: 'kulate', A: 46, B: 46, sklon: 0 }, most: { dbl: 20, sirka: 14, uhel: 22, vyska: 8, tloustka: 4 },
        predni: { obruba: 4, hloubka: 4.5, wrap: 0 }, stranice: { delka: 140, vyska: 6, tloustka: 4.2, panto: 6, ohyb: 40, koncovka: 32 } } },
    { nazev: 'Dětské 44□15-125', popis: 'oválné, kratší stranice, menší most',
      p: { ocnice: { tvar: 'ovalne', A: 44, B: 32, sklon: 0 }, most: { dbl: 15, sirka: 9, uhel: 22, vyska: 4, tloustka: 5 },
        predni: { obruba: 5, hloubka: 5, wrap: 0 }, stranice: { delka: 125, vyska: 6.5, tloustka: 4.5, panto: 6, ohyb: 35, koncovka: 28 } } },
    { nazev: 'Sportovní obtékavé 60□16-130', popis: 'obdélník, obtékání 14°, výrazný ohyb',
      p: { ocnice: { tvar: 'obdelnik', A: 60, B: 38, zaobleni: 55, sklon: 3 }, most: { dbl: 16, sirka: 10, uhel: 22, vyska: 5, tloustka: 6 },
        predni: { obruba: 5, hloubka: 6, wrap: 14 }, stranice: { delka: 130, vyska: 9, tloustka: 5, panto: 10, ohyb: 25, koncovka: 30 } } },
    { nazev: 'Pilotky 58□14-140', popis: 'kapka, tenčí obruba, úzký most',
      p: { ocnice: { tvar: 'pilotky', A: 58, B: 48, sklon: 0 }, most: { dbl: 14, sirka: 9, uhel: 22, vyska: 10, tloustka: 4 },
        predni: { obruba: 4, hloubka: 4.5, wrap: 0 }, stranice: { delka: 140, vyska: 6, tloustka: 4.2, panto: 6, ohyb: 38, koncovka: 33 } } },
    { nazev: 'Šestiúhelník 50□20-145', popis: 'geometrický tvar se zaoblenými rohy',
      p: { ocnice: { tvar: 'sestiuhelnik', A: 50, B: 42, zaobleni: 30, sklon: 0 }, most: { dbl: 20, sirka: 14, uhel: 22, vyska: 6, tloustka: 5 },
        predni: { obruba: 5, hloubka: 5, wrap: 0 }, stranice: { delka: 145, vyska: 7, tloustka: 4.5, panto: 8, ohyb: 35, koncovka: 35 } } },
    { nazev: 'Zkušební panto vcelku + čočky', popis: 'bez pantu, U drážka 2 mm a dvě ploché zkušební čočky',
      p: { ocnice: { tvar: 'panto', A: 48, B: 42, sklon: 0 }, most: { dbl: 20, sirka: 14, uhel: 22, vyska: 6, tloustka: 5 },
        predni: { obruba: 5, hloubka: 5, wrap: 0 }, drazka: { profil: 'U', sirka: 2.2, hloubka: 1, vule: 0.15 }, cocky: { zapnuto: true, tloustka: 2 },
        pant: { druh: 'vcelku' }, stranice: { delka: 140, vyska: 7, tloustka: 4.5, panto: 8, ohyb: 35, koncovka: 35 }, text: { zapnuto: false } } },
  ];

  /* ---------- normalizace ---------- */
  const sl = (o, z) => { for (const k of Object.keys(z)) if (z[k] && typeof z[k] === 'object' && !Array.isArray(z[k]) && o[k] && typeof o[k] === 'object') sl(o[k], z[k]); else o[k] = z[k]; return o; };
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hl = [];
    if (vstup && typeof vstup === 'object') sl(p, kopie(vstup));
    const vyber = (cesta, obj) => { if (!Object.prototype.hasOwnProperty.call(obj, vezmi(p, cesta))) poloz(p, cesta, vezmi(VYCHOZI, cesta)); };
    vyber('ocnice.tvar', TVARY); vyber('drazka.profil', PROFILY_DRAZKY); vyber('pant.druh', PANTY); vyber('pant.cep', CEPY);
    vyber('text.kde', KDE_TEXT); vyber('tisk.material', MATERIALY);
    p.nazev = String(p.nazev == null ? '' : p.nazev).slice(0, 120);
    p.text.obsah = String(p.text.obsah == null ? '' : p.text.obsah).replace(/[\r\n]+/g, ' ').slice(0, 40);
    p.cocky.zapnuto = !!p.cocky.zapnuto; p.text.zapnuto = !!p.text.zapnuto;
    if (!p.tisk.orientace || typeof p.tisk.orientace !== 'object') p.tisk.orientace = {};
    p.tisk.orientace = { predni: String(p.tisk.orientace.predni || 'auto').slice(0, 20), stranice: String(p.tisk.orientace.stranice || 'auto').slice(0, 20) };
    for (const [c, [mn, mx]] of Object.entries(ROZSAHY)) {
      let h = cislo(vezmi(p, c), vezmi(VYCHOZI, c));
      if (h < mn || h > mx) { const o = Math.min(mx, Math.max(mn, h)); hl.push(`${c} ${fmt(h, 2)} → ${fmt(o, 2)}`); h = o; }
      poloz(p, c, h);
    }
    return { p, hlaseni: hl };
  }
  function zPredvolby(i) {
    const v = PREDVOLBY[i], p = normalizuj({}).p;
    sl(p, kopie(v.p));
    p.nazev = v.nazev;
    return normalizuj(p).p;
  }

  /* ---------- 2D pomůcky ---------- */
  const plochaPolygonu = P => { let s = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += P[j][0] * P[i][1] - P[i][0] * P[j][1]; return s / 2; };
  const ccw = P => (plochaPolygonu(P) < 0 ? P.slice().reverse() : P);
  /** Zaoblí rohy konvexního mnohoúhelníku (CCW) obloukem poloměru r (u krátkých hran menším). */
  function zaobliPolygon(P, r) {
    if (r <= 0.01) return P;
    const out = [], n = P.length;
    for (let i = 0; i < n; i++) {
      const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n];
      const la = Math.hypot(a[0] - b[0], a[1] - b[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const d1 = [(a[0] - b[0]) / la, (a[1] - b[1]) / la], d2 = [(c[0] - b[0]) / lc, (c[1] - b[1]) / lc];
      const th = Math.acos(Math.max(-1, Math.min(1, d1[0] * d2[0] + d1[1] * d2[1])));
      const t = Math.min(r / Math.tan(th / 2), 0.49 * Math.min(la, lc)), re = t * Math.tan(th / 2);
      const bis = [d1[0] + d2[0], d1[1] + d2[1]], lb = Math.hypot(bis[0], bis[1]) || 1;
      const st = [b[0] + bis[0] / lb * re / Math.sin(th / 2), b[1] + bis[1] / lb * re / Math.sin(th / 2)];
      const t1 = [b[0] + d1[0] * t, b[1] + d1[1] * t], t2 = [b[0] + d2[0] * t, b[1] + d2[1] * t];
      let u0 = Math.atan2(t1[1] - st[1], t1[0] - st[0]), u1 = Math.atan2(t2[1] - st[1], t2[0] - st[0]);
      while (u1 < u0) u1 += 2 * Math.PI;
      const k = Math.max(2, Math.ceil((u1 - u0) / (6 * RAD)));
      for (let j = 0; j <= k; j++) { const u = u0 + (u1 - u0) * j / k; out.push([st[0] + re * Math.cos(u), st[1] + re * Math.sin(u)]); }
    }
    return out;
  }
  /** Uzavřený Catmull-Rom přes řídicí body. */
  function catmull(P, n = 20) {
    const out = [], m = P.length;
    for (let i = 0; i < m; i++) {
      const p0 = P[(i + m - 1) % m], p1 = P[i], p2 = P[(i + 1) % m], p3 = P[(i + 2) % m];
      for (let j = 0; j < n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    return out;
  }
  const obalBodu = P => P.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
  /** Přeškáluje body tak, aby jejich obal měl přesně A × B a střed v počátku (boxing). */
  function naRozmer(P, A, B) {
    const b = obalBodu(P), sx = A / (b[2] - b[0]), sy = B / (b[3] - b[1]), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    return P.map(([x, y]) => [(x - cx) * sx, (y - cy) * sy]);
  }
  /** Doplní body na dlouhé hrany (nejvýš `krok` mm) – kvůli kontrole nosu a ohybu při obtékání. */
  function zhusti(P, krok = 0.8) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / krok));
      for (let j = 0; j < n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
    }
    return out;
  }
  /** Bod uvnitř mnohoúhelníku (sudo-liché pravidlo). */
  function uvnitr(P, x, y) {
    let u = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) u = !u;
    }
    return u;
  }

  /** Obrys pravé očnice (u nosu x < 0, ke spánku x > 0) se středem boxu v počátku, CCW. */
  function obrysOcnice(oc) {
    const A = oc.A, B = oc.tvar === 'kulate' ? oc.A : oc.B, r = oc.zaobleni / 100 * Math.min(A, B) / 2, z = oc.zuzeni / 100;
    let P;
    const elipsa = (a, b, f) => Array.from({ length: 144 }, (_, i) => { const t = 2 * Math.PI * i / 144; return f ? f(Math.cos(t), Math.sin(t)) : [a * Math.cos(t), b * Math.sin(t)]; });
    switch (oc.tvar) {
      case 'kulate': case 'ovalne': P = elipsa(A / 2, B / 2); break;
      case 'obdelnik': P = zaobliPolygon([[-A / 2, -B / 2], [A / 2, -B / 2], [A / 2, B / 2], [-A / 2, B / 2]], r); break;
      case 'wayfarer': P = zaobliPolygon([[-A / 2 + z * A * 0.35, -B / 2], [A / 2 - z * A, -B / 2], [A / 2, B / 2], [-A / 2, B / 2 * 0.86]], r); break;
      case 'sestiuhelnik': P = zaobliPolygon([[-A / 2, 0], [-A / 4, -B / 2], [A / 4, -B / 2], [A / 2, 0], [A / 4, B / 2], [-A / 4, B / 2]], r); break;
      case 'kocici': P = catmull([[-1, 0.05], [-0.82, -0.62], [-0.2, -1], [0.45, -0.86], [0.88, -0.25], [1, 0.62], [0.82, 1], [0.1, 0.84], [-0.7, 0.68]]); break;
      case 'pilotky': P = catmull([[-1, 0.45], [-0.95, -0.25], [-0.62, -0.82], [0, -1], [0.62, -0.78], [0.97, -0.15], [1, 0.55], [0.6, 0.97], [-0.15, 1], [-0.8, 0.9]]); break;
      default: P = elipsa(1, 1, (c, s) => [c, s > 0 ? Math.pow(s, 0.55) : s]);   // panto: kulaté dole, zploštělé nahoře
    }
    P = naRozmer(ccw(P), A, B);
    if (oc.sklon) {
      // sklon horní hrany: horní polovina se ke spánku zvedá
      const tg = Math.tan(oc.sklon * RAD);
      P = naRozmer(P.map(([x, y]) => [x, y > 0 ? y + tg * (x + A / 2) * (y / (B / 2)) : y]), A, B);
    }
    return zhusti(P);
  }

  /* ---------- obtékání (face wrap) ---------- */
  /** Ohnutí přední části: bod (x, z) přední roviny (z = 0 čelo, z+ dozadu) na válec; za okrajem očnic rovně. */
  function zahni(o, x, z) {
    if (!o.R) return [x, z];
    const s = x < 0 ? -1 : 1, ax = Math.abs(x), R = o.R, xw = o.xWrap;
    if (ax <= xw) { const f = ax / R; return [s * (R - z) * Math.sin(f), R - (R - z) * Math.cos(f)]; }
    const f = xw / R, c = Math.cos(f), sn = Math.sin(f);
    return [s * ((R - z) * sn + (ax - xw) * c), R - (R - z) * c + (ax - xw) * sn];
  }
  /** x před ohnutím, pro které leží bod (x, z) po ohnutí na X (X ≥ 0, monotónní – půlení). */
  function zpetX(o, X, z) {
    let a = 0, b = 400;
    for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (zahni(o, m, z)[0] < X) a = m; else b = m; }
    return (a + b) / 2;
  }

  /* ---------- nos ---------- */
  /** Je bod (x, y) v prostoru nosu? Nos = oblouk šířky most.sirka s vrcholem ve výšce most.vyska a boky skloněné o most.uhel. */
  function vNosu(m, x, y) {
    const rn = m.sirka / 2, yc = m.vyska - rn;
    if (y >= yc) return x * x + (y - yc) * (y - yc) < rn * rn;
    return Math.abs(x) < rn + (yc - y) * Math.tan(m.uhel * RAD);
  }
  function obrysNosu(m, yDno) {
    const rn = m.sirka / 2, yc = m.vyska - rn, xd = rn + (yc - yDno) * Math.tan(m.uhel * RAD), P = [[xd, yDno]];
    for (let i = 0; i <= 24; i++) { const t = Math.PI * i / 24; P.push([rn * Math.cos(t), yc + rn * Math.sin(t)]); }
    P.push([-xd, yDno]);
    return P;
  }
  // nos se opírá o most a sedla v pásu ~12 mm pod vrcholem; níž už skla stojí před nosem (jiná hloubka), proto se nekontroluje
  const PAS_NOSU = 12;
  const narazNos = (m, obrys, xc) => obrys.some(([x, y]) => y >= m.vyska - PAS_NOSU && (vNosu(m, x + xc, y) || vNosu(m, -(x + xc), y)));
  /** Nejmenší DBL (po 0,5 mm), při kterém se nos nedotkne očnic. */
  function potrebneDbl(p, obrys) {
    for (let d = 10; d <= 40; d += 0.5) if (!narazNos(p.most, obrys, d / 2 + p.ocnice.A / 2)) return d;
    return 40;
  }

  /* ---------- odvozené rozměry ---------- */
  function odvozene(p) {
    const oc = p.ocnice, A = oc.A, B = oc.tvar === 'kulate' ? oc.A : oc.B, dbl = p.most.dbl, xc = dbl / 2 + A / 2;
    const obrys = obrysOcnice(oc), dr = p.drazka, T = p.predni.hloubka;
    const o = { A, B, dbl, xc, obrys, T, profil: dr.profil, hd: dr.hloubka, w: dr.sirka, vule: dr.vule, zc: dr.profil === 'falc' ? T - dr.sirka / 2 : T / 2 };
    o.ED = 2 * Math.max(...obrys.map(([x, y]) => Math.hypot(x, y)));
    o.otvor = -o.hd;                                  // otvor (světlost) = obrys skla − hloubka drážky
    o.vnejsi = p.predni.obruba - o.hd;               // vnější okraj obruby od obrysu skla
    o.zaDnem = o.vnejsi;                             // materiál za dnem drážky
    // drážka po schodech (V), jeden schod (U); {off: posun obrysu, hw: polovina šířky}
    if (dr.profil === 'V') {
      const n = Math.max(4, Math.min(12, Math.ceil(o.hd / 0.12)));
      o.kroky = Array.from({ length: n }, (_, i) => ({ off: -o.hd + (i + 1) * o.hd / n, hw: Math.max(0.15, o.w / 2 * (1 - (i + 1) / n)) }));
      o.kroky[n - 1].hw = Math.max(o.kroky[n - 1].hw, 0.15);
    } else if (dr.profil === 'U') o.kroky = [{ off: 0, hw: o.w / 2 }];
    else o.kroky = [];
    // obtékání
    o.xWrap = xc + A / 2 + Math.max(0, o.vnejsi);
    o.R = p.predni.wrap > 0 ? xc / (p.predni.wrap * RAD) : 0;
    // most
    o.yDnoNosu = -B - 30;
    o.narazNos = narazNos(p.most, obrys, xc);
    o.potrebneDbl = o.narazNos ? potrebneDbl(p, obrys) : null;
    o.horniHrana = B / 2 + o.vnejsi;
    // pant a koncovky
    const st = p.stranice, pa = p.pant;
    o.cep = CEPY[pa.cep];
    o.tS = st.tloustka; o.H = st.vyska; o.g = pa.mezera;
    o.rP = o.cep.d / 2 + pa.vule;
    o.rO = Math.max(o.tS / 2, o.rP + 1.2);
    o.k = (o.H - 2 * o.g) / 3;                         // výška jednoho oka (3 oka: přední nahoře a dole, stranice uprostřed)
    o.stenaOka = o.tS / 2 - o.rP;
    o.hK = o.H + 2;                                  // výška koncovky přední části
    o.yH = Math.min(0.3 * B, o.horniHrana - o.hK / 2);
    o.xEndMin = xc + A / 2 + Math.max(0, o.vnejsi) + 1.5;
    if (p.predni.sirka > 0) {
      const x = zpetX(o, p.predni.sirka / 2, 0);
      o.xEnd = Math.max(x, o.xEndMin); o.sirkaMala = x < o.xEndMin - 1e-6;
    } else o.xEnd = o.xEndMin;
    const zo = zahni(o, o.xEnd, T);
    o.xEndW = zo[0]; o.zBack = zo[1];
    o.xh = o.xEndW - o.tS / 2;                        // osa pantu (svislá)
    // patka pantu nesmí zasáhnout do drážky u krátké koncovky
    o.xBlok = Math.min(o.xh, Math.max(o.xh - o.rO, zahni(o, xc + A / 2 + 0.6, T)[0]));
    o.zi = zahni(o, zpetX(o, o.xBlok, T), T)[1];
    o.zStart = o.zi - 0.45 * T;
    o.zh = o.zBack + o.g + o.rO;
    o.sirkaPredni = 2 * zahni(o, o.xEnd, 0)[0];        // přes vnější přední roh koncovky
    o.vnitrniSirka = 2 * (o.xEndW - o.tS);            // mezi stranicemi u pantu
    // stranice – střednice v rovině stranice (s dozadu od osy pantu, v nahoru), poloviční výšky
    o.Lk = Math.min(st.koncovka, st.delka * 0.6);
    o.L1 = st.delka - o.Lk;
    const fo = st.ohyb * RAD;
    o.rOhyb = fo > 0 ? Math.min(14, o.Lk * 0.8 / fo) : 0;
    o.h0 = o.H / 2; o.h1 = Math.max(1.5, o.H * 0.32); o.h2 = Math.max(1.3, o.H * 0.26);
    o.strednice = strednice(o, st);
    // optika
    o.gcd = A + dbl;
    o.oznaceni = `${fmt(A, 1)}□${fmt(dbl, 1)}-${fmt(st.delka, 0)}`;
    if (p.opt.pd > 0) { o.decentrace = (o.gcd - p.opt.pd) / 2; o.mbs = o.ED + 2 * Math.abs(o.decentrace) + 2; }
    o.text = p.text.obsah.trim() || o.oznaceni;
    return o;
  }
  /** Body střednice stranice [{x, y, h}] – rovně se sklonem panto, pak oblouk ohybu a koncovka. */
  function strednice(o, st) {
    const out = [], th0 = -st.panto * RAD, fo = st.ohyb * RAD;
    let x = 0, y = 0, th = th0, s = 0;
    const h = s1 => (s1 <= o.L1 ? o.h0 + (o.h1 - o.h0) * s1 / o.L1 : o.h1 + (o.h2 - o.h1) * (s1 - o.L1) / Math.max(1e-6, o.Lk));
    const krok = (ds, dth) => {
      if (dth) { const th2 = th + dth, r = ds / dth; x += r * (Math.sin(th) - Math.sin(th2)) * -1; y += r * (Math.cos(th) - Math.cos(th2)); th = th2; }
      else { x += ds * Math.cos(th); y += ds * Math.sin(th); }
      s += ds; out.push({ x, y, h: h(s), s });
    };
    out.push({ x, y, h: h(0), s: 0 });
    const n1 = Math.max(4, Math.ceil(o.L1 / 6));
    for (let i = 0; i < n1; i++) krok(o.L1 / n1, 0);
    const la = o.rOhyb * fo;
    if (la > 0) { const n = Math.max(3, Math.ceil(fo / (5 * RAD))); for (let i = 0; i < n; i++) krok(la / n, -fo / n); }
    const zb = o.Lk - la;
    if (zb > 0.01) { const n = Math.max(1, Math.ceil(zb / 6)); for (let i = 0; i < n; i++) krok(zb / n, 0); }
    return out;
  }

  /* ---------- kontroly ---------- */
  function kontroly(p, o) {
    const H = [], pridej = (uroven, text, pole = [], oprava) => H.push({ uroven, text, pole: [].concat(pole), oprava });
    const dr = p.drazka, pr = p.predni, st = p.stranice;
    if (p.ocnice.tvar === 'kulate' && Math.abs(p.ocnice.B - p.ocnice.A) > 0.01) pridej('info', `Kulaté očnice mají výšku B = A = ${fmt(o.A)} mm (zadaná výška se nepoužije).`, 'ocnice.B');
    // obruba a drážka
    if (o.zaDnem < 1.2) {
      const ob = Math.ceil((o.hd + 1.6) * 2) / 2;
      pridej('chyba', `Drážka (hloubka ${fmt(o.hd, 2)} mm) je skoro tak hluboká jako obruba ${fmt(pr.obruba)} mm – za dnem drážky zbývá ${fmt(o.zaDnem, 2)} mm (nejméně 1,2 mm).`,
        ['predni.obruba', 'drazka.hloubka'], { pole: 'predni.obruba', hodnota: ob, text: `obruba ${fmt(ob)} mm` });
    } else if (pr.obruba < 2.5) pridej('varovani', `Obruba ${fmt(pr.obruba)} mm je tenká – zezadu ji ohne tlak skla (doporučeno ≥ 3 mm).`, 'predni.obruba');
    if (dr.profil !== 'falc') {
      const stena = (o.T - o.w) / 2;
      if (stena < 0.8) {
        const t = Math.ceil((o.w + 2) * 2) / 2;
        pridej('chyba', `Drážka široká ${fmt(o.w, 2)} mm v rámečku hlubokém ${fmt(o.T)} mm – před a za drážkou zbývá ${fmt(stena, 2)} mm (nejméně 0,8 mm).`,
          ['drazka.sirka', 'predni.hloubka'], { pole: 'predni.hloubka', hodnota: t, text: `hloubka rámečku ${fmt(t)} mm` });
      }
      if (o.hd < 0.6) pridej('varovani', `Drážka hluboká ${fmt(o.hd, 2)} mm sklo neudrží – vypadne při ohnutí obruby (doporučeno 0,8–1,2 mm).`, 'drazka.hloubka');
      if (dr.profil === 'V' && (o.w < 1.4 || o.w > 3)) pridej('info', `Fazeta brýlových skel bývá 110–120° a ≈ 1 mm vysoká – V drážka ${fmt(o.w, 2)} mm široká ji nemusí pojmout (obvyklé 1,8–2,4 mm).`, 'drazka.sirka');
    } else if (o.T - o.w < 1.2) {
      pridej('chyba', `Polodrážka hluboká ${fmt(o.w, 2)} mm v rámečku ${fmt(o.T)} mm – vpředu zbývá ${fmt(o.T - o.w, 2)} mm (nejméně 1,2 mm).`, ['drazka.sirka', 'predni.hloubka']);
    }
    if (2 * o.hd >= Math.min(o.A, o.B) - 6) pridej('chyba', 'Drážka je na tak malou očnici příliš hluboká – otvor by zmizel.', ['drazka.hloubka', 'ocnice.B']);
    // most
    if (o.narazNos) pridej('chyba', `Most je na nos šířky ${fmt(p.most.sirka)} mm (boky ${fmt(p.most.uhel)}°) úzký – nos by se opřel o skla. Potřeba DBL ≥ ${fmt(o.potrebneDbl)} mm nebo užší / výš posazený nos.`,
      ['most.dbl', 'most.sirka', 'most.uhel'], { pole: 'most.dbl', hodnota: o.potrebneDbl, text: `DBL ${fmt(o.potrebneDbl)} mm` });
    if (p.most.vyska + p.most.tloustka > o.horniHrana - 0.5) {
      const v = Math.floor((o.horniHrana - p.most.tloustka - 1) * 2) / 2;
      pridej('chyba', `Most (vrchol nosu ${fmt(p.most.vyska)} mm + tloušťka ${fmt(p.most.tloustka)} mm) přesahuje horní hranu obroučky (${fmt(o.horniHrana)} mm) – přední díl by se rozpadl na dvě půlky.`,
        ['most.vyska', 'most.tloustka'], { pole: 'most.vyska', hodnota: v, text: `vrchol nosu ${fmt(v)} mm` });
    }
    if (p.most.tloustka < 2.5) pridej('varovani', `Most tenký ${fmt(p.most.tloustka)} mm se bude lámat (doporučeno ≥ 3,5 mm).`, 'most.tloustka');
    if (o.dbl < 14) pridej('info', `DBL ${fmt(o.dbl)} mm je malý – hodí se jen pro úzký nos nebo dětské brýle.`, 'most.dbl');
    // šířka
    if (o.sirkaMala) pridej('chyba', `Celková šířka ${fmt(pr.sirka)} mm je menší, než vyjde z očnic a obruby (${fmt(2 * zahni(o, o.xEndMin, 0)[0])} mm) – použita nejmenší.`, 'predni.sirka',
      { pole: 'predni.sirka', hodnota: 0, text: 'šířka automaticky' });
    if (p.opt.hlava > 0) {
      const d = o.vnitrniSirka - p.opt.hlava;
      if (d < -4) pridej('varovani', `Mezi stranicemi je u pantu ${fmt(o.vnitrniSirka)} mm, hlava má ${fmt(p.opt.hlava)} mm – brýle budou tlačit ve spáncích.`, ['predni.sirka', 'opt.hlava'],
        { pole: 'predni.sirka', hodnota: Math.ceil(p.opt.hlava + 2 * o.tS + 2), text: `celková šířka ${Math.ceil(p.opt.hlava + 2 * o.tS + 2)} mm` });
      else if (d > 14) pridej('varovani', `Mezi stranicemi je ${fmt(o.vnitrniSirka)} mm na hlavu ${fmt(p.opt.hlava)} mm – brýle budou volné a sjíždět.`, ['predni.sirka', 'opt.hlava', 'ocnice.A']);
      else pridej('ok', `Šířka sedí: mezi stranicemi ${fmt(o.vnitrniSirka)} mm na hlavu ${fmt(p.opt.hlava)} mm.`, 'opt.hlava');
    }
    // optika
    if (p.opt.pd > 0) {
      const pd2 = p.opt.pd / 2;
      if (pd2 < o.dbl / 2 + 0.15 * o.A || pd2 > o.dbl / 2 + 0.85 * o.A)
        pridej('chyba', `Zornice (PD ${fmt(p.opt.pd)} mm) vycházejí mimo střední část očnic – zvolte jinou šířku A nebo most.`, ['opt.pd', 'ocnice.A', 'most.dbl']);
      else if (Math.abs(o.decentrace) > 5)
        pridej('varovani', `Decentrace ${fmt(o.decentrace, 1)} mm na oko je velká – skla budou na jedné straně silná a optik potřebuje polotovar Ø ${fmt(Math.ceil(o.mbs))} mm.`, ['opt.pd', 'ocnice.A', 'most.dbl']);
      else pridej('ok', `Optické středy: decentrace ${fmt(o.decentrace, 1)} mm na oko (${o.decentrace >= 0 ? 'k nosu' : 'ke spánku'}), polotovar skla ≥ Ø ${fmt(Math.ceil(o.mbs))} mm.`, 'opt.pd');
    }
    // obtékání a sklon
    if (pr.wrap > 15) pridej('varovani', `Obtékání ${fmt(pr.wrap)}° je velké – dioptrická skla pak potřebují korekci (wrap kompenzaci); rovná skla se do drážky prohnou.`, 'predni.wrap');
    else if (pr.wrap > 0 && p.cocky.zapnuto) pridej('info', `Zkušební čočky jsou rovné – do drážky ohnuté o ${fmt(pr.wrap)}° se trochu prohnou.`, 'predni.wrap');
    if (pr.wrap > 0) pridej('info', `Ohnutý přední díl neleží na podložce celou plochou – čelem dolů potřebuje podpory na krajích, nebo tiskněte s obtékáním 0° a ohněte horkým vzduchem.`, ['predni.wrap', 'tisk.orientace']);
    if (st.panto > 15) pridej('varovani', `Pantoskopický sklon ${fmt(st.panto)}° je velký (obvykle 6–12°).`, 'stranice.panto');
    // pant
    if (p.pant.druh === 'cep') {
      if (o.stenaOka < 1) {
        const t = Math.ceil((o.rP + 1.1) * 2 * 10) / 10;
        pridej('chyba', `Oko pantu má kolem čepu Ø ${fmt(2 * o.rP, 2)} mm jen ${fmt(o.stenaOka, 2)} mm stěny – praskne (nejméně 1 mm).`, ['stranice.tloustka', 'pant.cep'],
          { pole: 'stranice.tloustka', hodnota: t, text: `stranice ${fmt(t)} mm` });
      }
      if (o.k < 1.6) {
        const v = Math.ceil((3 * 1.6 + 2 * o.g) * 2) / 2;
        pridej('chyba', `Oka pantu vyjdou jen ${fmt(o.k, 2)} mm vysoká (výška stranice ${fmt(o.H)} mm na 3 oka a 2 mezery) – nejméně 1,6 mm.`, ['stranice.vyska', 'pant.mezera'],
          { pole: 'stranice.vyska', hodnota: v, text: `výška stranice ${fmt(v)} mm` });
      }
      if (p.pant.cep !== 'filament') pridej('info', `Šroubek ${o.cep.nazev.replace('šroubek ', '')}: otvor Ø ${fmt(2 * o.rP, 2)} mm, závit si šroubek vyřízne ve spodním oku – nebo matice / kapka lepidla.`, 'pant.cep');
    }
    // stranice
    if (o.tS < 3) pridej('varovani', `Stranice tlustá ${fmt(o.tS)} mm se snadno zlomí (doporučeno ≥ 3,5 mm).`, 'stranice.tloustka');
    if (o.H < 4.5) pridej('varovani', `Stranice vysoká ${fmt(o.H)} mm je ohebná do stran (doporučeno ≥ 5 mm).`, 'stranice.vyska');
    // dosah sklopené stranice ve výšce pantů (koncovka za ohybem bývá už níž)
    const dosah = Math.max(...o.strednice.filter(q => Math.abs(q.y) < o.H / 2 + q.h).map(q => q.x));
    if (p.pant.druh === 'cep' && dosah > 2 * o.xh - o.rO - 1)
      pridej('varovani', `Stranice sahá ve výšce pantů ${fmt(dosah)} mm daleko, mezi panty je jen ${fmt(2 * o.xh)} mm – sklopená stranice narazí do protějšího pantu. Zkraťte stranici nebo prodlužte koncovku.`,
        ['stranice.delka', 'stranice.koncovka']);
    if (st.koncovka > st.delka * 0.6) pridej('chyba', `Koncovka ${fmt(st.koncovka)} mm je delší než 60 % stranice – použito ${fmt(o.Lk)} mm.`, 'stranice.koncovka');
    if (st.ohyb > 0 && o.Lk < 10) pridej('varovani', 'Koncovka kratší než 10 mm za uchem nedrží.', 'stranice.koncovka');
    if (p.text.zapnuto && p.text.vyska > o.h1 * 2 - 1) pridej('info', `Text ${fmt(p.text.vyska)} mm je na stranici (${fmt(o.h1 * 2)} mm za pantem) vysoký – zmenší se.`, 'text.vyska');
    if (p.text.zapnuto && p.text.hloubka > o.tS / 3) pridej('varovani', `Rytina ${fmt(p.text.hloubka, 2)} mm zeslabí stranici o třetinu.`, 'text.hloubka');
    if (p.tisk.material === 'TPU') pridej('varovani', 'TPU je na přední díl a stranice moc měkké – brýle se budou kroutit. Použijte PETG nebo PA.', 'tisk.material',
      { pole: 'tisk.material', hodnota: 'PETG', text: 'PETG' });
    return H;
  }

  /* ---------- tisk ---------- */
  const KANDIDATI = {
    predni: [
      { klic: 'celo', nazev: 'čelem dolů (naplocho)', dolu: [0, 0, -1] },
      { klic: 'zada', nazev: 'zády dolů', dolu: [0, 0, 1] },
      { klic: 'dolni', nazev: 'na spodní hraně', dolu: [0, -1, 0] },
      { klic: 'horni', nazev: 'na horní hraně', dolu: [0, 1, 0] },
    ],
    stranice: [
      { klic: 'vnejsi', nazev: 'naplocho, vnější stranou dolů', dolu: [0, 0, -1] },
      { klic: 'vnitrni', nazev: 'naplocho, vnitřní stranou dolů', dolu: [0, 0, 1] },
      { klic: 'hrana', nazev: 'na spodní hraně', dolu: [0, -1, 0] },
    ],
    cocka: [{ klic: 'plocha', nazev: 'naplocho', dolu: [0, 0, -1] }],
  };
  /** Ohodnotí orientace dílu (role predni / stranice / cocka), vybraná = podle p.tisk.orientace nebo nejlepší. */
  function rozborTisku(sit, role, p) {
    const lim = p.tisk.previs, vysl = [];
    for (const k of KANDIDATI[role]) {
      const R = rotaceDolu(k.dolu), poloha = tiskovaPoloha(sit, R), pv = previsy(poloha.poz, sit.idx, lim);
      const skore = pv.volne * 5 + pv.strme * 20 + pv.most * 0.3 + pv.vyska * 0.5 - Math.min(pv.podlozka, 400) * 0.2 + (pv.podlozka < 20 ? 10000 : 0);
      vysl.push(Object.assign({}, k, { R, volne: pv.volne, strme: pv.strme, most: pv.most, podlozka: pv.podlozka, vyska: pv.vyska, skore }));
    }
    vysl.sort((a, b) => a.skore - b.skore);
    const chci = p.tisk.orientace[role === 'cocka' ? 'x' : role];
    const vybrana = vysl.find(v => v.klic === chci) || vysl[0];
    return { kandidati: vysl, nejlepsi: vysl[0], vybrana };
  }
  function kontrolyTisku(nazev, role, rozbor, plocha) {
    const H = [], v = rozbor.vybrana, best = rozbor.nejlepsi, pole = role === 'cocka' ? [] : ['tisk.orientace'];
    if (v.volne > 2 && potrebujePodpory(v, plocha)) {
      const lepsi = best !== v && best.volne + 4 * best.strme < 0.5 * (v.volne + 4 * v.strme);
      H.push({ uroven: 'varovani', text: `${nazev}: v poloze „${v.nazev}“ visí ${fmt(v.volne, 0)} mm² bez opory – tiskněte s podporami.` + (lepsi ? ` Méně převisů má „${best.nazev}“.` : ''), pole,
        oprava: lepsi ? { pole: 'tisk.orientace.' + role, hodnota: best.klic, text: 'použít lepší polohu' } : undefined });
    } else H.push({ uroven: 'ok', text: `${nazev}: tiskne se bez podpor – „${v.nazev}“, výška ${fmt(v.vyska)} mm.`, pole });
    if (v.podlozka < 15) H.push({ uroven: 'varovani', text: `${nazev}: na podložce leží jen ${fmt(v.podlozka, 0)} mm² – přidejte límec (brim).`, pole });
    return H;
  }
  /** Hmotnost a čas: obvod 1,2 mm + výplň, průtok ≈ 7 mm³/s, 1,5 s na vrstvu 0,2 mm. Hrubý odhad. */
  function odhadTisku(objem, plocha, vyska, p) {
    const mat = MATERIALY[p.tisk.material];
    const plast = Math.min(objem, plocha * 1.2), V3 = plast + Math.max(0, objem - plast) * p.tisk.vypln / 100;
    return { gramy: V3 / 1000 * mat.hustota, metru: V3 / (Math.PI * 0.875 * 0.875) / 1000, minut: (V3 / 7 + vyska / 0.2 * 1.5) / 60 * 1.1, plny: objem / 1000 * mat.hustota };
  }
  /** Rozložení dílů (už na z = 0) na podložku po řádcích do šířky `sirka`; vrací nové {poz} a obal sestavy. */
  function rozlozNaPodlozku(dily, mezera = 6, sirka = 220) {
    const obal = poz => { const b = [Infinity, Infinity, -Infinity, -Infinity]; for (let i = 0; i < poz.length; i += 3) { b[0] = Math.min(b[0], poz[i]); b[1] = Math.min(b[1], poz[i + 1]); b[2] = Math.max(b[2], poz[i]); b[3] = Math.max(b[3], poz[i + 1]); } return b; };
    const out = []; let x = 0, y = 0, radek = 0;
    for (const d of dily) {
      const b = obal(d.poz), w = b[2] - b[0], h = b[3] - b[1];
      if (x > 0 && x + w > sirka) { x = 0; y -= radek + mezera; radek = 0; }
      const poz = new Float32Array(d.poz.length), dx = x - b[0], dy = y - b[3];
      for (let i = 0; i < poz.length; i += 3) { poz[i] = d.poz[i] + dx; poz[i + 1] = d.poz[i + 1] + dy; poz[i + 2] = d.poz[i + 2]; }
      out.push(Object.assign({}, d, { poz }));
      x += w + mezera; radek = Math.max(radek, h);
    }
    // vystředit
    const B = out.reduce((b, d) => { const o = obal(d.poz); return [Math.min(b[0], o[0]), Math.min(b[1], o[1]), Math.max(b[2], o[2]), Math.max(b[3], o[3])]; }, [Infinity, Infinity, -Infinity, -Infinity]);
    const cx = (B[0] + B[2]) / 2, cy = (B[1] + B[3]) / 2;
    for (const d of out) for (let i = 0; i < d.poz.length; i += 3) { d.poz[i] -= cx; d.poz[i + 1] -= cy; }
    return { dily: out, sirka: B[2] - B[0], hloubka: B[3] - B[1] };
  }

  /* ---------- projekt ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_bryle', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || typeof o !== 'object') throw new Error('Soubor neobsahuje projekt.');
    if (o.format !== 'webapp_bryle') throw new Error('Soubor není projekt obroučky (chybí "format": "webapp_bryle").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }
  const popis = p => `${TVARY[p.ocnice.tvar].nazev} ${fmt(p.ocnice.A, 1)}□${fmt(p.most.dbl, 1)}-${fmt(p.stranice.delka, 0)}${p.pant.druh === 'vcelku' ? ', vcelku' : ''}`;

  const API = {
    VERZE_FORMATU, TVARY, PROFILY_DRAZKY, PANTY, CEPY, KDE_TEXT, MATERIALY, VYCHOZI, ROZSAHY, PREDVOLBY, KANDIDATI,
    kopie, cislo, fmt, vezmi, poloz, normalizuj, zPredvolby, plochaPolygonu, zaobliPolygon, catmull, naRozmer, obalBodu, uvnitr,
    obrysOcnice, zahni, zpetX, vNosu, obrysNosu, potrebneDbl, odvozene, kontroly, rozborTisku, kontrolyTisku, odhadTisku,
    rozlozNaPodlozku, otoc, tiskovaPoloha, previsy, potrebujePodpory, ulozProjekt, nactiProjekt, popis,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.BRYLE = API;
})();
