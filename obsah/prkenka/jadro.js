/* ============================================================
   Prkénka a lepené vzory – jádro (bez DOM, čisté funkce)
   Model: každý kus dřeva je hranol = mnohoúhelník v rovině kolmé na osu vytažení × rozsah [w0, w1].
     osa 'z' → mnohoúhelník v (x, y), osa 'x' → v (y, z), osa 'y' → v (z, x).
   Kus nese dřevinu d, směr vláken v (jednotkový vektor) a polohu dřeně st (střed letokruhů) – z nich se
   kreslí textura (letokruhy na čele, pruhy na boku) shodně ve 2D i ve 3D.
   Operace: otočení (matice se znaménkovou permutací nebo rotace kolem z), posun, ořez rovinou, řez přímkou.
   Postup výroby = kroky; každý krok má stav po kroku (kusy ve světových souřadnicích) a animaci
   (skupiny kusů v poloze před krokem + transformace R, t → poloha po kroku).
   Souřadnice: x = délka prkénka, y = šířka, z = tloušťka (nahoru); mm.
   ============================================================ */
(function (koren) {
  'use strict';
  const EPS = 1e-6;
  const fmt = (x, d = 1) => {
    if (!Number.isFinite(x)) return '–';
    let s = (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
    if (d > 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s.replace('.', ',');
  };

  /* ---------------- dřeviny (typické hodnoty při ~12 % vlhkosti, editovatelné v UI) ---------------- */
  // vhodnost: ok | porezni (otevřené póry) | alergen (senzibilizace, toxický prach) | mekke (nevhodně měkké)
  const DREVINY = {
    javor: { nazev: 'Javor cukrový', en: 'hard maple', svetla: '#ecd9b2', tmava: '#d2b688', hustota: 705, letokruh: 3.2, vhodnost: 'ok', pozn: 'klasika čelních prkének – tvrdý, jemné póry' },
    klen: { nazev: 'Javor klen', en: 'sycamore', svetla: '#ebdec2', tmava: '#d4c19c', hustota: 610, letokruh: 3.5, vhodnost: 'ok', pozn: 'světlý domácí javor' },
    orech: { nazev: 'Ořešák černý', en: 'black walnut', svetla: '#6e4b33', tmava: '#47301f', hustota: 610, letokruh: 4, vhodnost: 'ok', pozn: 'tmavý kontrast, šetrný k noži' },
    orech_k: { nazev: 'Ořešák královský', en: 'English walnut', svetla: '#8c6446', tmava: '#5f412b', hustota: 640, letokruh: 4, vhodnost: 'ok', pozn: 'domácí ořech, teplejší tón' },
    tresen: { nazev: 'Třešeň', en: 'cherry', svetla: '#c47f56', tmava: '#9a5a3a', hustota: 580, letokruh: 3, vhodnost: 'ok', pozn: 'na světle tmavne' },
    buk: { nazev: 'Buk', en: 'beech', svetla: '#e2be95', tmava: '#c9a074', hustota: 720, letokruh: 3, vhodnost: 'ok', pozn: 'tvrdý, ale výrazně sesychá – nechat dobře vyschnout' },
    habr: { nazev: 'Habr', en: 'hornbeam', svetla: '#e7ddc5', tmava: '#cfc2a2', hustota: 790, letokruh: 2.5, vhodnost: 'ok', pozn: 'velmi tvrdý a houževnatý' },
    hrusen: { nazev: 'Hrušeň', en: 'pear', svetla: '#d5a486', tmava: '#b9866a', hustota: 700, letokruh: 2.8, vhodnost: 'ok', pozn: 'jemná homogenní struktura' },
    jablon: { nazev: 'Jabloň', en: 'apple', svetla: '#d3a784', tmava: '#b48764', hustota: 720, letokruh: 2.8, vhodnost: 'ok', pozn: 'tvrdá, sklon k borcení' },
    svestka: { nazev: 'Švestka', en: 'plum', svetla: '#9d5843', tmava: '#6f3828', hustota: 790, letokruh: 2.6, vhodnost: 'ok', pozn: 'barevná, malé rozměry řeziva' },
    akat: { nazev: 'Trnovník akát', en: 'black locust', svetla: '#cdb158', tmava: '#a68834', hustota: 770, letokruh: 3.5, vhodnost: 'ok', pozn: 'velmi tvrdý, odolný vlhku' },
    briza: { nazev: 'Bříza', en: 'birch', svetla: '#eadab6', tmava: '#d3bf96', hustota: 650, letokruh: 3, vhodnost: 'ok', pozn: 'světlá, méně odolná vlhku' },
    dub: { nazev: 'Dub', en: 'oak', svetla: '#cfa874', tmava: '#a7804f', hustota: 690, letokruh: 3.5, vhodnost: 'porezni', pozn: 'otevřené póry nasávají šťávy, tanin černá s železem – raději na podnosy' },
    jasan: { nazev: 'Jasan', en: 'ash', svetla: '#e3cfa4', tmava: '#c2a676', hustota: 680, letokruh: 4.5, vhodnost: 'porezni', pozn: 'otevřené póry – na krájení méně vhodný' },
    padouk: { nazev: 'Padouk', en: 'padauk', svetla: '#b9472d', tmava: '#8c2f1c', hustota: 750, letokruh: 3, vhodnost: 'alergen', pozn: 'prach dráždí, barvivo se vymývá – jen jako akcent, ne na krájecí plochu' },
    wenge: { nazev: 'Wenge', en: 'wenge', svetla: '#43302a', tmava: '#221612', hustota: 870, letokruh: 2.5, vhodnost: 'alergen', pozn: 'třísky se zanítí, senzibilizuje – na krájecí prkénka nevhodné' },
    smrk: { nazev: 'Smrk', en: 'spruce', svetla: '#eedcb3', tmava: '#cfae78', hustota: 450, letokruh: 4, vhodnost: 'mekke', pozn: 'příliš měkký, pryskyřice – nevhodný' },
  };
  const hustota = (p, slot) => {
    const o = p['hustota' + slot];
    if (Number.isFinite(o) && o > 100) return o;
    return (DREVINY[p['drev' + slot]] || DREVINY.javor).hustota;
  };

  /* ---------------- vzory ---------------- */
  const VZORY = {
    podelne: { nazev: 'Podélné vlákno', en: 'edge grain', klavesa: 1 },
    sachovnice: { nazev: 'Šachovnice (čelní)', en: 'end grain checker', klavesa: 2 },
    cihla: { nazev: 'Cihlová vazba (čelní)', en: 'end grain brick', klavesa: 3 },
    kostky: { nazev: '3D kostky', en: 'tumbling blocks', klavesa: 4 },
    chevron: { nazev: 'Cikcak / chevron', en: 'chevron', klavesa: 5 },
    sachy: { nazev: 'Šachovnice na hru', en: 'chess board 8×8', klavesa: 6 },
    vlny: { nazev: 'Vlny (řez křivkou)', en: 'curve cut inlay', klavesa: 7 },
    vkladane: { nazev: 'Vkládané proužky', en: 'inlay strips', klavesa: 8 },
  };

  const VYCHOZI = {
    vzor: 'sachovnice', drevA: 'javor', drevB: 'orech', drevC: 'tresen',
    hustotaA: 0, hustotaB: 0, hustotaC: 0,
    delka: 400, sirka: 300, tloustka: 38, pocetKusu: 1,
    kerf: 3.2, uberPanel: 2, uberFinal: 3, orezKonce: 15, pridavekPruh: 1, prorez: 15, seed: 1,
    sekvence: 'A40 B12 A40 C20 A40 B12', opakovat: true,
    bunka: 40,
    cihlaDelka: 70, cihlaVyska: 35, spara: 0,
    kostka: 32,
    chevronUhel: 45, chevronPruh: 20, chevronSloupec: 50, chevronSled: 'AB',
    sachyPole: 45, sachyOkraj: 30,
    vlnyPocet: 3, vlnyAmplituda: 18, vlnyDelka: 260, vlnyZilka: 3, vlnyKerf: 1.2, vlnyFaze: 0,
    vklPocet: 3, vklUhel: 60, vklZilka: 4,
    rohR: 12, hrana: 3, hranaTyp: 'zkoseni',
    drazka: true, drazkaOdstup: 16, drazkaSirka: 10, drazkaHloubka: 5, drazkaR: 18,
    uchyty: 'bocni', uchytDelka: 110, uchytHloubka: 18, uchytVyska: 14, otvorPrumer: 25,
    nozicky: 4, nozickyPrumer: 20, nozickyOdstup: 30,
  };
  const MEZE = {
    delka: [80, 1200], sirka: [60, 800], tloustka: [8, 80], pocetKusu: [1, 20], kerf: [0.5, 6], uberPanel: [0, 10], uberFinal: [0, 10],
    orezKonce: [0, 60], pridavekPruh: [0, 5], prorez: [0, 100], bunka: [10, 120], cihlaDelka: [15, 200], cihlaVyska: [10, 120], spara: [0, 20],
    kostka: [12, 80], chevronUhel: [25, 65], chevronPruh: [4, 80], chevronSloupec: [15, 150], sachyPole: [15, 100], sachyOkraj: [5, 100],
    vlnyPocet: [1, 8], vlnyAmplituda: [0, 80], vlnyDelka: [40, 1200], vlnyZilka: [0.5, 10], vlnyKerf: [0.3, 3], vlnyFaze: [0, 180],
    vklPocet: [1, 10], vklUhel: [20, 90], vklZilka: [0.5, 15], rohR: [0, 100], hrana: [0, 10], drazkaOdstup: [5, 80], drazkaSirka: [3, 30],
    drazkaHloubka: [1, 15], drazkaR: [0, 150], uchytDelka: [30, 300], uchytHloubka: [5, 40], uchytVyska: [5, 30], otvorPrumer: [6, 60],
    nozicky: [0, 8], nozickyPrumer: [8, 50], nozickyOdstup: [8, 150], seed: [1, 1e9],
  };
  function normalizuj(vstup) {
    const p = Object.assign({}, VYCHOZI, vstup || {});
    for (const [k, [a, b]] of Object.entries(MEZE)) {
      let v = Number(p[k]); if (!Number.isFinite(v)) v = VYCHOZI[k];
      p[k] = Math.min(b, Math.max(a, v));
    }
    p.pocetKusu = Math.round(p.pocetKusu); p.vlnyPocet = Math.round(p.vlnyPocet); p.vklPocet = Math.round(p.vklPocet); p.nozicky = Math.round(p.nozicky);
    if (!VZORY[p.vzor]) p.vzor = VYCHOZI.vzor;
    for (const s of ['A', 'B', 'C']) if (!DREVINY[p['drev' + s]]) p['drev' + s] = VYCHOZI['drev' + s];
    if (!['zkoseni', 'zaobleni', 'zadna'].includes(p.hranaTyp)) p.hranaTyp = 'zkoseni';
    if (!['zadne', 'bocni', 'otvor'].includes(p.uchyty)) p.uchyty = 'zadne';
    p.drazka = !!p.drazka; p.opakovat = !!p.opakovat;
    p.sekvence = String(p.sekvence || VYCHOZI.sekvence).slice(0, 400);
    p.chevronSled = String(p.chevronSled || 'AB').toUpperCase().replace(/[^ABC]/g, '').slice(0, 12) || 'AB';
    return p;
  }

  /* ---------------- geometrie ---------------- */
  const OSA_I = { x: 0, y: 1, z: 2 };
  const UV = { z: [0, 1], x: [1, 2], y: [2, 0] };
  const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const mv = (A, p) => [0, 1, 2].map((i) => A[i][0] * p[0] + A[i][1] * p[1] + A[i][2] * p[2]);
  const RY90 = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];      // čelo řezu (normála x) nahoru
  const RY90T = [[0, 0, -1], [0, 1, 0], [1, 0, 0]];
  const RZ180 = [[-1, 0, 0], [0, -1, 0], [0, 0, 1]];    // otočení konec za konec
  const RY180 = [[-1, 0, 0], [0, 1, 0], [0, 0, -1]];    // překlopení kolem osy y
  const rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };

  function plocha(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function bodVPolygonu(q, P) {
    let uvnitr = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i], b = P[j];
      if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) uvnitr = !uvnitr;
    }
    return uvnitr;
  }
  /** Sutherland–Hodgman: ponechá část a·u + b·v ≤ c */
  function orizniPolorovinou(P, a, b, c) {
    const out = [], f = (q) => a * q[0] + b * q[1] - c;
    for (let i = 0; i < P.length; i++) {
      const cur = P[i], prev = P[(i + P.length - 1) % P.length], fc = f(cur), fp = f(prev);
      const pr = () => { const t = fp / (fp - fc); return [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]; };
      if (fc <= EPS) { if (fp > EPS) out.push(pr()); out.push(cur); } else if (fp <= EPS) out.push(pr());
    }
    // vyhodit duplicitní body
    const r = [];
    for (const q of out) { const l = r[r.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 1e-7) r.push(q); }
    if (r.length > 1 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 1e-7) r.pop();
    return r;
  }
  const bod3 = (osa, u, v, w) => { const p = [0, 0, 0], [iu, iv] = UV[osa]; p[iu] = u; p[iv] = v; p[OSA_I[osa]] = w; return p; };
  function kus(poly, osa, w0, w1, d, v, st, extra) {
    if (plocha(poly) < 0) poly = poly.slice().reverse();
    return Object.assign({ poly, osa, w0: Math.min(w0, w1), w1: Math.max(w0, w1), d, v, st }, extra || {});
  }
  const kvadr = (x0, y0, z0, x1, y1, z1, d, v, st, extra) => kus([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 'z', z0, z1, d, v, st, extra);

  const GEOM = { poly: 1, osa: 1, w0: 1, w1: 1, d: 1, v: 1, st: 1 };
  /** kus → R·p + t; osa vytažení se musí zobrazit na souřadnou osu */
  function transformuj(k, R, t) {
    t = t || [0, 0, 0];
    const io = OSA_I[k.osa], e = [R[0][io], R[1][io], R[2][io]];
    const no = e.findIndex((x) => Math.abs(x) > 0.5);
    if (no < 0 || Math.abs(Math.abs(e[no]) - 1) > 1e-6) throw new Error('transformace nezachová osu hranolu');
    const nOsa = 'xyz'[no], [iu, iv] = UV[nOsa];
    const mp = (p) => { const q = mv(R, p); return [q[0] + t[0], q[1] + t[1], q[2] + t[2]]; };
    const poly = k.poly.map(([u, v]) => { const q = mp(bod3(k.osa, u, v, k.w0)); return [q[iu], q[iv]]; });
    const a = mp(bod3(k.osa, k.poly[0][0], k.poly[0][1], k.w0))[no], b = mp(bod3(k.osa, k.poly[0][0], k.poly[0][1], k.w1))[no];
    const extra = {}; for (const kk in k) if (!GEOM[kk]) extra[kk] = k[kk];
    return kus(poly, nOsa, a, b, k.d, mv(R, k.v), mp(k.st), extra);
  }
  const posun = (k, t) => transformuj(k, I3, t);
  function obalka(kusy) {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const k of kusy) {
      const [iu, iv] = UV[k.osa], io = OSA_I[k.osa];
      for (const q of k.poly) { mn[iu] = Math.min(mn[iu], q[0]); mx[iu] = Math.max(mx[iu], q[0]); mn[iv] = Math.min(mn[iv], q[1]); mx[iv] = Math.max(mx[iv], q[1]); }
      mn[io] = Math.min(mn[io], k.w0); mx[io] = Math.max(mx[io], k.w1);
    }
    return { min: mn, max: mx, roz: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] };
  }
  /** ořez kusu deskou lo ≤ souřadnice[ai] ≤ hi */
  function orizniOsou(k, ai, lo, hi) {
    if (OSA_I[k.osa] === ai) { const w0 = Math.max(k.w0, lo), w1 = Math.min(k.w1, hi); return w1 - w0 > 1e-6 ? Object.assign({}, k, { w0, w1 }) : null; }
    const [iu] = UV[k.osa];
    let P = k.poly;
    if (iu === ai) { P = orizniPolorovinou(P, 1, 0, hi); P = orizniPolorovinou(P, -1, 0, -lo); }
    else { P = orizniPolorovinou(P, 0, 1, hi); P = orizniPolorovinou(P, 0, -1, -lo); }
    return P.length >= 3 && Math.abs(plocha(P)) > 1e-6 ? Object.assign({}, k, { poly: P }) : null;
  }
  /** řez kusu s osou z polorovinou a·x + b·y ≤ c */
  function orizniPrimkou(k, a, b, c) {
    if (k.osa !== 'z') throw new Error('řez přímkou jen pro kusy s osou z');
    const P = orizniPolorovinou(k.poly, a, b, c);
    return P.length >= 3 && Math.abs(plocha(P)) > 1e-6 ? Object.assign({}, k, { poly: P }) : null;
  }
  const objem = (k) => Math.abs(plocha(k.poly)) * (k.w1 - k.w0);
  function obsahuje(k, p) {
    const [iu, iv] = UV[k.osa], w = p[OSA_I[k.osa]];
    if (w < k.w0 - 1e-9 || w > k.w1 + 1e-9) return false;
    return bodVPolygonu([p[iu], p[iv]], k.poly);
  }
  const kusVBode = (kusy, p) => { for (const k of kusy) if (!k.odpad && obsahuje(k, p)) return k; return null; };
  /** úhly mnohoúhelníku ve stupních (vnitřní) */
  function uhly(P) {
    return P.map((b, i) => {
      const a = P[(i + P.length - 1) % P.length], c = P[(i + 1) % P.length];
      const u = [a[0] - b[0], a[1] - b[1]], w = [c[0] - b[0], c[1] - b[1]];
      return Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w))))) * 180 / Math.PI;
    });
  }

  /* ---------------- projekce (pohledy) ---------------- */
  // pohled: 'z' shora (x, y), 'y' zepředu (x, z), 'x' z boku (y, z)
  const POHLED = { z: [0, 1], y: [0, 2], x: [1, 2] };
  function projekce(k, n) {
    const [ia, ib] = POHLED[n], io = OSA_I[k.osa], [iu, iv] = UV[k.osa];
    let poly;
    if (k.osa === n) poly = k.poly.map((q) => { const p = [0, 0, 0]; p[iu] = q[0]; p[iv] = q[1]; return [p[ia], p[ib]]; });
    else {
      // skutečné čelo: vrcholy na krajní hodnotě souřadnice normály (shora/z boku max, zepředu min)
      const inn = OSA_I[n], jn = inn === iu ? 0 : inn === iv ? 1 : -1;
      let P = k.poly;
      if (jn >= 0) {
        const ext = n === 'y' ? Math.min(...P.map((q) => q[jn])) : Math.max(...P.map((q) => q[jn]));
        const tol = 1e-4 * (1 + Math.abs(ext));
        const F = P.filter((q) => Math.abs(q[jn] - ext) <= tol);
        if (F.length < 2) return null;
        P = F;
      }
      const rozsah = (i) => {
        if (i === io) return [k.w0, k.w1];
        const j = i === iu ? 0 : 1; let a = Infinity, b = -Infinity;
        for (const q of P) { a = Math.min(a, q[j]); b = Math.max(b, q[j]); }
        return [a, b];
      };
      const [a0, a1] = rozsah(ia), [b0, b1] = rozsah(ib);
      poly = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];
    }
    if (plocha(poly) < 0) poly.reverse();
    // hloubka: shora = nejvyšší z (kreslit vzestupně), zepředu = nejmenší y (kreslit sestupně → záporně), z boku = největší x
    const ob = obalka([k]), hl = n === 'z' ? ob.max[2] : n === 'y' ? -ob.min[1] : ob.max[0];
    // souřadnice roviny čela (pro texturu) a normála
    const rovina = n === 'z' ? ob.max[2] : n === 'y' ? ob.min[1] : ob.max[0];
    return { poly, hl, kus: k, n, rovina };
  }
  function pohled(kusy, n) { return kusy.map((k) => projekce(k, n)).filter(Boolean).sort((a, b) => a.hl - b.hl); }

  /* ---------------- náhodnost (deterministická kresba) ---------------- */
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // dřeň pro podélný pruh (osa x): bočně → na horní ploše rovné husté pruhy (stojaté letokruhy)
  const drenBokem = (R, yc, zc) => [0, yc + (R() < 0.5 ? -1 : 1) * (90 + R() * 260), zc + (R() - 0.5) * 80];
  // dřeň pro pruh, který skončí čelem nahoru: šikmo pod pruhem → na čele oblouky letokruhů
  const dren = (R, yc, zc) => { const a = R() * Math.PI * 2, r = 70 + R() * 180; return [0, yc + Math.cos(a) * r, zc + Math.sin(a) * r]; };

  /* ---------------- sekvence pruhů ---------------- */
  /** "A40 B12 C20" → [{slot:'A', s:40}] */
  function parsujSekvenci(t) {
    const out = [];
    for (const m of String(t).toUpperCase().matchAll(/([ABC])\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*[X×*]\s*(\d+))?/g)) {
      const s = parseFloat(m[2].replace(',', '.')), n = m[3] ? Math.min(50, parseInt(m[3], 10)) : 1;
      if (s >= 2 && s <= 400) for (let i = 0; i < n; i++) out.push({ slot: m[1], s });
    }
    return out.length ? out : [{ slot: 'A', s: 40 }, { slot: 'B', s: 40 }];
  }
  function pruhySekvence(p) {
    const zakl = parsujSekvenci(p.sekvence);
    if (!p.opakovat) return zakl.slice(0, 80);
    const out = []; let sum = 0, i = 0;
    while (sum < p.sirka - 0.5 && out.length < 80) {
      const q = zakl[i % zakl.length], zb = p.sirka - sum;
      if (q.s > zb + 0.01) { if (zb >= 8) out.push({ slot: q.slot, s: Math.round(zb * 10) / 10, dorez: true }); else if (out.length) out[out.length - 1] = Object.assign({}, out[out.length - 1], { s: out[out.length - 1].s + zb, dorez: true }); break; }
      out.push(q); sum += q.s; i++;
    }
    return out;
  }

  /* ---------------- pomocníci kroků ---------------- */
  const sumy = (a) => a.reduce((x, y) => x + y, 0);
  function presunSkupinu(kusy, R, cilMin) {
    const rot = kusy.map((k) => transformuj(k, R, [0, 0, 0])), ob = obalka(rot);
    const t = [cilMin[0] - ob.min[0], cilMin[1] - ob.min[1], cilMin[2] - ob.min[2]];
    return { po: rot.map((k) => posun(k, t)), R, t };
  }
  const anim = (skupiny) => ({ typ: 'presun', skupiny });
  const animNahrada = (pred) => ({ typ: 'nahrada', pred });
  const kota = (pohled, a, b, odsaz, text) => ({ pohled, a, b, odsaz, text });

  /** hoblování / broušení: z z [0, H] na [0, H − u] – odebírá se půl úbytku z každé strany */
  function hobluj(kusy, H, u) {
    const po = [];
    for (const k of kusy) { if (k.odpad) continue; const q = orizniOsou(k, 2, u / 2, H - u / 2); if (q) po.push(posun(q, [0, 0, -u / 2])); }
    return po;
  }

  /* ---------------- obecný generátor čelního dřeva (šachovnice, cihla, šachy) ---------------- */
  /**
   * panely: [{id, nazev, pruhy:[{slot, s}], h (hotová výška po hoblování)}]
   * sloupce: [{panel, otoc (180° konec za konec), posunY}] v pořadí podél x
   * orezY: [y0, y1] okno ořezu boků po druhém lepení (nebo null)
   */
  function genCelni(p, def) {
    const R = rng(p.seed), k = p.kerf, oK = p.orezKonce, uP = p.uberPanel, uF = p.uberFinal, T = p.tloustka;
    const c = T + uF, mez = 60, g = 10;
    const kroky = [];
    const nPlatku = {};
    for (const s of def.sloupce) nPlatku[s.panel] = (nPlatku[s.panel] || 0) + 1;
    // délka panelu: zarovnání konce + n × (plátek + řez) + zbytek
    const L1 = {};
    for (const P of def.panely) L1[P.id] = 2 * oK + nPlatku[P.id] * (c + k);
    // 1) pruhy
    let y0 = 0;
    const pruhy = [], rozmPanelu = {};
    for (const P of def.panely) {
      const H = P.h + uP;
      let y = 0;
      P.pruhy.forEach((q, i) => {
        const st = P.mono ? drenBokem(R, y + q.s / 2, H / 2) : dren(R, y + q.s / 2, H / 2);
        pruhy.push(kvadr(0, y0 + y + i * g, 0, L1[P.id], y0 + y + i * g + q.s, H, p['drev' + q.slot], [1, 0, 0], [st[0], st[1] + y0 + i * g, st[2]], { slot: q.slot, panel: P.id, i, yLep: y0 + y }));
        y += q.s;
      });
      rozmPanelu[P.id] = { W: y, H, y0, L: L1[P.id] };
      y0 += y + P.pruhy.length * g + mez;
    }
    const k1 = { typ: 'pruhy', nazev: 'Příprava pruhů', kusy: pruhy, pohledy: ['z', 'x'], koty: [], popisky: [], text: [], tabulka: [] };
    for (const P of def.panely) {
      const RP = rozmPanelu[P.id];
      k1.text.push(`${P.nazev}: ${P.pruhy.length} ${P.pruhy.length === 1 ? 'deska' : 'pruhů'} průřezu ${P.pruhy.map((q) => fmt(q.s)).filter((v, i, a) => a.indexOf(v) === i).join('/')} × ${fmt(RP.H)} mm, délka ${fmt(RP.L)} mm (výška ${fmt(P.h)} + ${fmt(uP)} na hoblování).`);
    }
    k1.text.push(`Délka panelu = 2 × ${fmt(oK)} (zarovnání konců) + počet plátků × (${fmt(c)} plátek + ${fmt(k)} řez kotouče).`);
    const prv = pruhy[0]; k1.koty.push(kota('z', [0, prv.poly[0][1]], [L1[def.panely[0].id], prv.poly[0][1]], -8, fmt(L1[def.panely[0].id]) + ' mm'));
    kroky.push(k1);
    // 2) lepení 1
    const sk2 = pruhy.map((q) => { const ob = obalka([q]); return { kusy: [q], R: I3, t: [0, q.yLep - ob.min[1], 0] }; });
    const lep1 = sk2.map((s) => posun(s.kusy[0], s.t));
    const k2 = { typ: 'lepeni', nazev: 'Lepení panelu', kusy: lep1, anim: anim(sk2), pohledy: ['z', 'x'], koty: [], popisky: [], text: [] };
    for (const P of def.panely) {
      const RP = rozmPanelu[P.id];
      if (P.pruhy.length > 1) k2.text.push(`${P.nazev}: slepit ${P.pruhy.length} pruhů v pořadí ${P.pruhy.map((q) => q.slot).join(' ')} → panel ${fmt(RP.L)} × ${fmt(RP.W)} × ${fmt(RP.H)} mm.`);
      else k2.text.push(`${P.nazev}: jedna deska ${fmt(RP.W)} mm široká (lepí se jen pokud je třeba ji nastavit).`);
      k2.koty.push(kota('x', [RP.y0, 0], [RP.y0 + RP.W, 0], -8, fmt(RP.W)));
      k2.koty.push(kota('x', [RP.y0 + RP.W, 0], [RP.y0 + RP.W, RP.H], 8, fmt(RP.H)));
    }
    k2.text.push('Svěrky střídavě shora a zespodu, mezi panel a svěrky přítlačné lišty (cauls) proti prohnutí. Přebytek lepidla po zgumovatění seškrábnout.');
    kroky.push(k2);
    // 3) hoblování panelů na výšku h
    const hob = [];
    for (const q of lep1) { const P = def.panely.find((x) => x.id === q.panel); const H = P.h + uP; const r = orizniOsou(q, 2, uP / 2, H - uP / 2); if (r) hob.push(posun(r, [0, 0, -uP / 2])); }
    const k3 = { typ: 'hoblovani', nazev: 'Hoblování panelu', kusy: hob, anim: animNahrada(lep1), pohledy: ['z', 'x'], koty: [], popisky: [], text: [] };
    for (const P of def.panely) { const RP = rozmPanelu[P.id]; k3.text.push(`${P.nazev}: srovnat obě plochy z ${fmt(RP.H)} na ${fmt(P.h)} mm (úbytek ${fmt(uP)} mm – po ${fmt(uP / 2)} z každé strany). Tato výška = šířka sloupce na hotovém prkénku.`); k3.koty.push(kota('x', [RP.y0 + RP.W, 0], [RP.y0 + RP.W, P.h], 8, fmt(P.h))); }
    k3.text.push('Panel musí mít obě plochy rovnoběžné, jinak plátky po otočení nedosednou a spáry se otevřou.');
    kroky.push(k3);
    // 4) příčné řezy
    const platky = {}, rezy = [], odpadR = [];
    for (const P of def.panely) {
      platky[P.id] = [];
      const kusyP = hob.filter((q) => q.panel === P.id);
      for (let i = 0; i < nPlatku[P.id]; i++) {
        const xa = oK + i * (c + k), xb = xa + c;
        const pl = kusyP.map((q) => orizniOsou(q, 0, xa, xb)).filter(Boolean).map((q) => Object.assign(q, { platek: i }));
        platky[P.id].push(pl); rezy.push(...pl);
      }
      const konec = oK + nPlatku[P.id] * (c + k);
      for (const q of kusyP) {
        const a = orizniOsou(q, 0, 0, oK - k); if (a) odpadR.push(Object.assign(a, { odpad: true }));
        const b = orizniOsou(q, 0, konec, L1[P.id]); if (b) odpadR.push(Object.assign(b, { odpad: true }));
      }
    }
    const k4 = { typ: 'rez', nazev: 'Příčné řezy na plátky', kusy: rezy.concat(odpadR), anim: animNahrada(hob), pohledy: ['z'], koty: [], popisky: [], text: [] };
    for (const P of def.panely) {
      const RP = rozmPanelu[P.id];
      k4.text.push(`${P.nazev}: nejprve zarovnat konec (odřez ${fmt(oK)} mm), pak ${nPlatku[P.id]} plátků po ${fmt(c)} mm; každý řez ubere ${fmt(k)} mm (šířka kotouče).`);
      k4.koty.push(kota('z', [oK, RP.y0], [oK + c, RP.y0], -8, fmt(c)));
      if (nPlatku[P.id] > 1) k4.koty.push(kota('z', [oK + c, RP.y0], [oK + c + k, RP.y0], -16, 'řez ' + fmt(k, 1)));
    }
    k4.text.push(`Plátek ${fmt(c)} mm = hotová tloušťka ${fmt(T)} + ${fmt(uF)} mm na broušení po druhém lepení.`);
    k4.bezpecnost = true;
    kroky.push(k4);
    // 5) otočení čelem nahoru, střídavé otočení / posun
    const sk5 = [], poOt = [];
    const pouzite = {};
    let x = 0;
    def.sloupce.forEach((s, j) => {
      const i = pouzite[s.panel] = (pouzite[s.panel] === undefined ? 0 : pouzite[s.panel] + 1);
      const pl = platky[s.panel][i];
      const Rm = s.otoc ? mul(RZ180, RY90) : RY90;
      const h = def.panely.find((q) => q.id === s.panel).h;
      const r = presunSkupinu(pl, Rm, [x + j * g, s.posunY || 0, 0]);
      r.po.forEach((q) => { q.sloupec = j; q.otoc = !!s.otoc; });
      sk5.push({ kusy: pl, R: r.R, t: r.t }); poOt.push(...r.po);
      x += h;
    });
    const k5 = { typ: 'otoceni', nazev: def.nazevOtoceni || 'Otočení plátků čelem nahoru', kusy: poOt, anim: anim(sk5), pohledy: ['z', 'y'], koty: [], popisky: [], text: def.textOtoceni.slice() };
    def.sloupce.forEach((s, j) => { if (s.otoc) { const ob = obalka(poOt.filter((q) => q.sloupec === j)); k5.popisky.push({ pohled: 'z', x: (ob.min[0] + ob.max[0]) / 2, y: ob.max[1] + 6, text: '180°' }); } });
    kroky.push(k5);
    // 6) lepení 2 – sevřít mezery
    const sk6 = [], lep2 = [];
    let xx = 0;
    def.sloupce.forEach((s, j) => {
      const sl = poOt.filter((q) => q.sloupec === j), ob = obalka(sl);
      const t = [xx - ob.min[0], 0, 0];
      sk6.push({ kusy: sl, R: I3, t }); lep2.push(...sl.map((q) => posun(q, t)));
      xx += ob.roz[0];
    });
    const ob6 = obalka(lep2);
    const k6 = { typ: 'lepeni', nazev: 'Druhé lepení', kusy: lep2, anim: anim(sk6), pohledy: ['z', 'y'], koty: [kota('z', [0, ob6.min[1]], [ob6.max[0], ob6.min[1]], -8, fmt(ob6.roz[0])), kota('z', [ob6.max[0], ob6.min[1]], [ob6.max[0], ob6.max[1]], 8, fmt(ob6.roz[1]))], popisky: [], text: [] };
    k6.text.push(`Slepit ${def.sloupce.length} sloupců čelem nahoru → ${fmt(ob6.roz[0])} × ${fmt(ob6.roz[1])} × ${fmt(c)} mm. Na čelní spoje víc lepidla (čelo saje) – nanést, nechat 5 min nasáknout, nanést znovu.`);
    k6.text.push('Lepit na rovné podložce, nejdřív lehce stáhnout, srovnat spáry (paličkou přes podložku), pak dotáhnout; přítlačné lišty proti vyboulení.');
    kroky.push(k6);
    let akt = lep2;
    // 7) ořez boků
    if (def.orezY) {
      const [ya, yb] = def.orezY, po = [], od = [];
      for (const q of akt) {
        const a = orizniOsou(q, 1, ya, yb); if (a) po.push(posun(a, [0, -ya, 0]));
        const b1 = orizniOsou(q, 1, -1e6, ya - k); if (b1) od.push(Object.assign(posun(b1, [0, -ya - 15, 0]), { odpad: true }));
        const b2 = orizniOsou(q, 1, yb + k, 1e6); if (b2) od.push(Object.assign(posun(b2, [0, -ya + 15, 0]), { odpad: true }));
      }
      const W = yb - ya;
      kroky.push({ typ: 'orez', nazev: 'Ořez zubatých boků', kusy: po.concat(od), anim: animNahrada(akt), pohledy: ['z'], koty: [kota('z', [ob6.max[0], 0], [ob6.max[0], W], 8, fmt(W))], popisky: [], text: [`Posunuté sloupce mají zubaté boky – podélně oříznout na šířku ${fmt(W)} mm (zarovnat jednu hranu na srovnávačce nebo přes saně s přiloženou rovnou lištou, pak řez podél pravítka).`], bezpecnost: true });
      akt = po;
    }
    return { kroky, akt, c, L1, nPlatku, rozmPanelu, panely: def.panely };
  }

  /** společný konec: broušení, dokončení */
  function dokonciKroky(p, kroky, akt, H, cel) {
    const T = p.tloustka, u = H - T;
    if (u > 1e-6) {
      const po = hobluj(akt, H, u);
      kroky.push({ typ: 'hoblovani', nazev: cel ? 'Broušení čela na tloušťku' : 'Hoblování na tloušťku', kusy: po, anim: animNahrada(akt), pohledy: ['z', 'y'], koty: [kota('y', [obalka(po).max[0], 0], [obalka(po).max[0], T], 8, fmt(T))], popisky: [], text: cel
        ? [`Srovnat obě plochy z ${fmt(H)} na ${fmt(T)} mm: pásová / válcová bruska nebo frézovací saně (router sled). Čelní dřevo NEDÁVAT do tloušťkovačky – nože vytrhávají hrany a kusy může vystřelit.`]
        : [`Hoblovat / brousit obě plochy z ${fmt(H)} na ${fmt(T)} mm (po ${fmt(u / 2)} mm z každé strany).`], bezpecnost: cel });
      akt = po;
    }
    const ob = obalka(akt);
    kroky.push({ typ: 'dokonceni', nazev: 'Dokončení', kusy: akt, anim: null, pohledy: ['z', 'y'], dokonceni: true,
      koty: [kota('z', [0, 0], [ob.max[0], 0], -10, fmt(ob.roz[0])), kota('z', [ob.max[0], 0], [ob.max[0], ob.max[1]], 10, fmt(ob.roz[1])), kota('y', [ob.max[0], 0], [ob.max[0], ob.max[2]], 10, fmt(ob.roz[2]))],
      popisky: [], text: textDokonceni(p, cel) });
    return akt;
  }
  function textDokonceni(p, cel) {
    const t = [];
    if (p.rohR > 0) t.push(`Rohy zaoblit R ${fmt(p.rohR)} mm (pásová pila + bruska, nebo frézka podle šablony).`);
    if (p.hranaTyp !== 'zadna' && p.hrana > 0) t.push(`Horní i spodní hrany: ${p.hranaTyp === 'zkoseni' ? 'zkosení 45° × ' + fmt(p.hrana) : 'zaoblení R ' + fmt(p.hrana)} mm (ohraňovací fréza s ložiskem).${cel ? ' U čelního dřeva frézovat po obvodu nejdřív čela (napříč vláknem), pak boky – vytrhnuté rohy se odfrézují.' : ''}`);
    if (p.drazka) t.push(`Šťávová drážka: odstup ${fmt(p.drazkaOdstup)} mm od hrany, šířka ${fmt(p.drazkaSirka)}, hloubka ${fmt(p.drazkaHloubka)} mm, rohy R ${fmt(p.drazkaR)} – žlábková fréza (core box) Ø ${fmt(p.drazkaSirka)} mm podle šablony nebo dorazu, ve 2–3 záběrech.`);
    if (p.uchyty === 'bocni') t.push(`Úchyty: na obou kratších stranách zespodu vyfrézovat prohlubeň ${fmt(p.uchytDelka)} × ${fmt(p.uchytHloubka)} mm, výška ${fmt(p.uchytVyska)} mm (žlábková fréza / fréza na úchyty).`);
    if (p.uchyty === 'otvor') t.push(`Otvor na zavěšení Ø ${fmt(p.otvorPrumer)} mm u jednoho konce – Forstnerův vrták z obou stran (proti vytržení), hrany zaoblit.`);
    if (p.nozicky > 0) t.push(`Nožičky: ${p.nozicky} × pryžové Ø ${fmt(p.nozickyPrumer)} mm, ${fmt(p.nozickyOdstup)} mm od hran, nerezové vruty. (Prkénko s nožičkami se používá jen jednostranně.)`);
    t.push('Brousit postupně zrnitostí 80 → 120 → 180 (→ 220), po 120 navlhčit, nechat vyschnout a přebrousit (zvednutá vlákna). Napustit minerálním olejem (potravinářský parafinový), přebytek po 20 min setřít, opakovat do nasycení; na závěr vosk (směs oleje a včelího vosku).');
    return t;
  }

  /* ---------------- vzory ---------------- */
  function genPodelne(p) {
    const R = rng(p.seed), seq = pruhySekvence(p), L = p.delka, T = p.tloustka, oK = p.orezKonce, uF = p.uberFinal, g = 10;
    const H = T + uF, Ls = L + 2 * oK;
    const kroky = [], pr = [];
    let y = 0;
    seq.forEach((q, i) => {
      const st = drenBokem(R, y + q.s / 2, H / 2);
      pr.push(kvadr(0, y + i * g, 0, Ls, y + i * g + q.s, H, p['drev' + q.slot], [1, 0, 0], [0, st[1] + i * g, st[2]], { slot: q.slot, i, yLep: y }));
      y += q.s;
    });
    const W = y;
    kroky.push({ typ: 'pruhy', nazev: 'Příprava pruhů', kusy: pr, pohledy: ['z', 'x'], koty: [kota('z', [0, 0], [Ls, 0], -8, fmt(Ls))], popisky: [], text: [
      `${seq.length} pruhů výšky ${fmt(H)} mm (tloušťka ${fmt(T)} + ${fmt(uF)} na hoblování), délka ${fmt(Ls)} mm (${fmt(L)} + 2 × ${fmt(oK)} na zarovnání konců).`,
      'Pruhy podélně rozřezat (hrana k pravítku, posunovač!) a hrany srovnat. Pruhy se lepí „na hranu“ – nahoru přijde hrana prkna (stojaté letokruhy, méně se kroutí).',
      `Pořadí: ${seq.map((q) => q.slot + fmt(q.s)).join(' ')}.`] });
    const sk = pr.map((q) => ({ kusy: [q], R: I3, t: [0, q.yLep - obalka([q]).min[1], 0] }));
    const lep = sk.map((s) => posun(s.kusy[0], s.t));
    kroky.push({ typ: 'lepeni', nazev: 'Lepení panelu', kusy: lep, anim: anim(sk), pohledy: ['z', 'x'], koty: [kota('x', [0, 0], [W, 0], -8, fmt(W)), kota('x', [W, 0], [W, H], 8, fmt(H))], popisky: [], text: [`Slepit ${seq.length} pruhů → ${fmt(Ls)} × ${fmt(W)} × ${fmt(H)} mm. Svěrky střídavě nahoře a dole, přítlačné lišty.`] });
    return { kroky, akt: lep, H, Ls, W, oK, seq };
  }
  function orezKoncu(p, kroky, akt, Ls, L) {
    const oK = (Ls - L) / 2, po = [], od = [];
    for (const q of akt) {
      if (q.odpad) continue;
      const a = orizniOsou(q, 0, oK, oK + L); if (a) po.push(posun(a, [-oK, 0, 0]));
      const b1 = orizniOsou(q, 0, -1e6, oK - Math.min(oK, 3)); if (b1) od.push(Object.assign(posun(b1, [-oK - 20, 0, 0]), { odpad: true }));
      const b2 = orizniOsou(q, 0, oK + L + Math.min(oK, 3), 1e6); if (b2) od.push(Object.assign(posun(b2, [-oK + 20, 0, 0]), { odpad: true }));
    }
    const ob = obalka(po);
    kroky.push({ typ: 'orez', nazev: 'Zarovnání konců', kusy: po.concat(od), anim: animNahrada(akt), pohledy: ['z'], koty: [kota('z', [0, 0], [L, 0], -8, fmt(L))], popisky: [], text: [`Zarovnat oba konce na délku ${fmt(L)} mm (přířezné saně / pokosová pila, odřezky ${fmt(oK)} mm).`], bezpecnost: true, sirka: ob.roz[1] });
    return po;
  }

  function vzorPodelne(p) {
    const r = genPodelne(p);
    let akt = r.akt;
    const H = r.H;
    akt = orezKoncu(p, r.kroky, akt, r.Ls, p.delka);
    akt = dokonciKroky(p, r.kroky, akt, H, false);
    const rez = r.seq.reduce((m, q) => { const kk = q.slot + q.s; (m[kk] = m[kk] || { slot: q.slot, ks: 0, tl: q.s + p.pridavekPruh, sir: H, del: r.Ls, nazev: 'Pruh (na hranu)' }).ks++; return m; }, {});
    return { kroky: r.kroky, akt, rezny: Object.values(rez), cel: false, info: { 'Pruhů': r.seq.length } };
  }

  function vzorSachovnice(p) {
    const a = p.bunka, nx = Math.max(2, Math.round(p.delka / a)), ny = Math.max(2, Math.round(p.sirka / a));
    const sude = ny % 2 === 0, n1 = sude ? ny : ny + 1;
    const pruhy = []; for (let i = 0; i < n1; i++) pruhy.push({ slot: i % 2 ? 'B' : 'A', s: a });
    const sloupce = []; for (let j = 0; j < nx; j++) sloupce.push(sude ? { panel: 'P', otoc: j % 2 === 1 } : { panel: 'P', posunY: j % 2 ? -a : 0 });
    const r = genCelni(p, { panely: [{ id: 'P', nazev: 'Panel A/B', pruhy, h: a }], sloupce, orezY: sude ? null : [0, ny * a],
      textOtoceni: sude
        ? [`Každý plátek otočit o 90° čelem nahoru. Každý druhý plátek navíc otočit o 180° (konec za konec) – pořadí A B A B se obrátí na B A B A a vznikne šachovnice ${nx} × ${ny}.`]
        : [`Každý plátek otočit čelem nahoru. Lichý počet polí ${ny}: panel má ${n1} pruhů a každý druhý plátek se posune o jedno pole (${fmt(a)} mm); přečnívající pole se po slepení odříznou.`] });
    let akt = dokonciKroky(p, r.kroky, r.akt, r.c, true);
    return { kroky: r.kroky, akt, rezny: reznyCelni(p, r, r.panely), cel: true, info: { 'Polí': `${nx} × ${ny}`, 'Pole': `${fmt(a)} × ${fmt(a)} mm` }, mrizka: { nx, ny, a } };
  }

  function vzorCihla(p) {
    const b = p.cihlaDelka, h = p.cihlaVyska, m = p.spara, nx = Math.max(2, Math.round((p.delka + m) / (h + m)));
    const per = b + m, s = per / 2, W = p.sirka;
    const n = Math.ceil((W + m + s) / per) + 1;
    const pruhy = [];
    for (let i = 0; i < n; i++) { pruhy.push({ slot: i % 2 ? 'B' : 'A', s: b }); if (m > 0 && i < n - 1) pruhy.push({ slot: 'C', s: m }); }
    const Wp = n * b + (n - 1) * m;
    const panely = [{ id: 'P', nazev: 'Panel cihel', pruhy, h }];
    if (m > 0) panely.push({ id: 'S', nazev: 'Deska spár', pruhy: [{ slot: 'C', s: Wp }], h: m, mono: true });
    const sloupce = [];
    for (let j = 0; j < nx; j++) { sloupce.push({ panel: 'P', posunY: j % 2 ? s : 0 }); if (m > 0 && j < nx - 1) sloupce.push({ panel: 'S', posunY: 0 }); }
    // okno ořezu: průnik pokrytí [s, Wp] – vystředit
    const lo = s, hi = Wp, ya = lo + (hi - lo - W) / 2;
    const r = genCelni(p, { panely, sloupce, orezY: [ya, ya + W], nazevOtoceni: 'Otočení a posun o půl cihly',
      textOtoceni: [`Každý plátek otočit o 90° čelem nahoru. Každý druhý sloupec posunout o půl cihly (${fmt(s)} mm) – vazba jako ve zdi.${m > 0 ? ` Mezi sloupce vložit plátky z desky spár (${fmt(m)} mm).` : ''}`] });
    let akt = dokonciKroky(p, r.kroky, r.akt, r.c, true);
    return { kroky: r.kroky, akt, rezny: reznyCelni(p, r, panely), cel: true, info: { 'Cihla': `${fmt(b)} × ${fmt(h)} mm`, 'Sloupců': nx, 'Spára': m > 0 ? fmt(m) + ' mm' : 'bez spár' }, cihla: { b, h, m, nx, s, ya } };
  }

  function vzorSachy(p) {
    const a = p.sachyPole, o = p.sachyOkraj;
    const pruhy = [{ slot: 'C', s: o }]; for (let i = 0; i < 8; i++) pruhy.push({ slot: i % 2 ? 'B' : 'A', s: a }); pruhy.push({ slot: 'C', s: o });
    const Wp = 8 * a + 2 * o;
    const sloupce = [{ panel: 'S' }]; for (let j = 0; j < 8; j++) sloupce.push({ panel: 'P', otoc: j % 2 === 1 }); sloupce.push({ panel: 'S' });
    const panely = [{ id: 'P', nazev: 'Panel polí s okrajem', pruhy, h: a }, { id: 'S', nazev: 'Deska okraje', pruhy: [{ slot: 'C', s: Wp }], h: o, mono: true }];
    const r = genCelni(p, { panely, sloupce, orezY: null,
      textOtoceni: ['Plátky otočit čelem nahoru; každý druhý plátek s poli otočit o 180° (konec za konec). Okrajové pruhy C jsou na obou koncích, takže zůstanou na místě. Na začátek a konec přijde plátek z desky okraje.'] });
    let akt = dokonciKroky(p, r.kroky, r.akt, r.c, true);
    return { kroky: r.kroky, akt, rezny: reznyCelni(p, r, panely), cel: true, info: { 'Pole': `8 × 8 po ${fmt(a)} mm`, 'Okraj': fmt(o) + ' mm', 'Hrací plocha': fmt(8 * a) + ' mm' }, sachy: { a, o } };
  }

  function reznyCelni(p, r, panely) {
    const out = [], N = p.pocetKusu;
    for (const P of panely) {
      const Lp = 2 * p.orezKonce + N * r.nPlatku[P.id] * (r.c + p.kerf);
      const sk = {};
      for (const q of P.pruhy) { const kk = q.slot + '_' + q.s; (sk[kk] = sk[kk] || { slot: q.slot, ks: 0, tl: q.s + p.pridavekPruh, sir: P.h + p.uberPanel, del: Lp, nazev: P.mono ? 'Deska (' + P.nazev.toLowerCase() + ')' : 'Pruh – ' + P.nazev.toLowerCase() }).ks++; }
      out.push(...Object.values(sk));
    }
    return out;
  }

  /* 3D kostky (tumbling blocks) – kosočtverce 60°/120° */
  function geometrieKostek(p) {
    const s = p.kostka, L = p.delka, W = p.sirka, sq = Math.sqrt(3), dx = sq * s, dy = 1.5 * s;
    const ox = (L - Math.floor(L / dx) * dx) / 2, oy = s / 2 + ((W - s) % dy) / 2;
    const hexy = [];
    for (let r = -2; r * dy + oy - s < W + dy; r++) {
      const row = [];
      for (let c = -2; c * dx + ox < L + dx; c++) {
        const cx = ox + c * dx + (r & 1 ? dx / 2 : 0), cy = oy + r * dy;
        if (cx + dx / 2 <= 0.01 || cx - dx / 2 >= L - 0.01 || cy + s <= 0.01 || cy - s >= W - 0.01) continue;
        const P = []; for (let k = 0; k < 6; k++) { const u = (90 + 60 * k) * Math.PI / 180; P.push([cx + s * Math.cos(u), cy + s * Math.sin(u)]); }
        const O = [cx, cy];
        // vrchní (A, světlá), levá (B), pravá (C)
        const ploch = [{ slot: 'A', poly: [O, P[5], P[0], P[1]] }, { slot: 'B', poly: [O, P[1], P[2], P[3]] }, { slot: 'C', poly: [O, P[3], P[4], P[5]] }];
        // vyhodit kosočtverce zcela mimo obdélník
        const uvnitr = ploch.filter((f) => { const xs = f.poly.map((q) => q[0]), ys = f.poly.map((q) => q[1]); return Math.max(...xs) > 0.01 && Math.min(...xs) < L - 0.01 && Math.max(...ys) > 0.01 && Math.min(...ys) < W - 0.01; });
        if (uvnitr.length) row.push({ cx, cy, ploch: uvnitr, r, c });
      }
      if (row.length) hexy.push(row);
    }
    return { hexy, s, h: s * sq / 2, dx, dy };
  }
  function vzorKostky(p) {
    const R = rng(p.seed), G = geometrieKostek(p), T = p.tloustka, uF = p.uberFinal, k = p.kerf, oK = p.orezKonce, N = p.pocetKusu;
    const c = T + uF, Llog = 2 * oK + N * (c + k), L = p.delka, W = p.sirka;
    // stojící poleno: kosočtverce s osou z, z ∈ [0, Llog]; ke každému kusu jeho šestiúhelník a řada
    const zaklad = [];
    G.hexy.forEach((row, ri) => row.forEach((hx, ci) => hx.ploch.forEach((f, fi) => {
      const st = dren(R, 0, 0); // dřeň v rovině průřezu kolem středu kosočtverce
      const cx = (f.poly[0][0] + f.poly[2][0]) / 2, cy = (f.poly[0][1] + f.poly[2][1]) / 2;
      zaklad.push({ k: kus(f.poly.map((q) => q.slice()), 'z', 0, Llog, p['drev' + f.slot], [0, 0, 1], [cx + st[1], cy + st[2], 0], { slot: f.slot }), ri, ci, fi, hx }); })));
    const smer = { A: [0, 1], B: [-Math.sqrt(3) / 2, -0.5], C: [Math.sqrt(3) / 2, -0.5] };
    const e = 4, gH = 7, gR = 12;
    const offs = (z, faze) => {
      const o = [0, 0, 0];
      if (faze <= 0) { const d = smer[z.k.slot]; o[0] += d[0] * e; o[1] += d[1] * e; }
      if (faze <= 1) o[0] += z.ci * gH;
      if (faze <= 2) o[1] += z.ri * gR;
      return o;
    };
    const obZ = obalka(zaklad.map((z) => z.k));
    // ležící poloha: R = RY90ᵀ, posun tak, aby základní poleno začínalo v 0
    const lez = (kk, o) => { const q = transformuj(posun(kk, o), RY90T, [0, 0, 0]); return q; };
    const obL = obalka(zaklad.map((z) => lez(z.k, [0, 0, 0])));
    const tL = [-obL.min[0], -obL.min[1], -obL.min[2]];
    const stav = (faze) => zaklad.map((z) => Object.assign(posun(lez(z.k, offs(z, faze)), tL), { hex: z.ri + '_' + z.ci, rada: z.ri }));
    const s0 = stav(0), s1 = stav(1), s2 = stav(2), s3 = stav(3);
    const delta = (a, b) => { const A = obalka([a]).min, B = obalka([b]).min; return [B[0] - A[0], B[1] - A[1], B[2] - A[2]]; };
    const skup = (pred, po, klic) => { const m = new Map(); pred.forEach((q, i) => { const kk = klic(q, i); if (!m.has(kk)) m.set(kk, { kusy: [], R: I3, t: delta(q, po[i]) }); m.get(kk).kusy.push(q); }); return [...m.values()]; };
    const nA = zaklad.filter((z) => z.k.slot === 'A').length, nB = zaklad.filter((z) => z.k.slot === 'B').length, nC = zaklad.filter((z) => z.k.slot === 'C').length;
    const h = G.h, s = G.s, sin60 = Math.sqrt(3) / 2;
    const kroky = [];
    kroky.push({ typ: 'pruhy', nazev: 'Lišty kosočtverečného průřezu', kusy: s0, pohledy: ['x', 'z'], koty: [kota('z', [0, 0], [Llog, 0], -8, fmt(Llog))], popisky: [], text: [
      `Desky vyhoblovat na tloušťku ${fmt(h, 2)} mm (= výška kosočtverce s·sin 60°). Kotouč naklonit o 30° od svislice a nařezat lišty kosočtverečného průřezu se stranou ${fmt(s)} mm a úhly 60° / 120°.`,
      `Na každou lištu padne ${fmt(s + k / sin60, 2)} mm šířky desky (strana + šikmý řez ${fmt(k)} / sin 60°). Potřeba: ${nA} × ${DREVINY[p.drevA].nazev} (vršky), ${nB} × ${DREVINY[p.drevB].nazev} (levé stěny), ${nC} × ${DREVINY[p.drevC].nazev} (pravé stěny), délka ${fmt(Llog)} mm.`,
      'Při úkosovém řezu musí lišta odcházet mezi kotouč a pravítko jen tehdy, je-li dost široká pro posunovač; úzké lišty řezat z širší desky (odřezek mimo pravítko) a pravítko po každém řezu posunout.'], bezpecnost: true });
    kroky.push({ typ: 'lepeni', nazev: 'Slepení kostek', kusy: s1, anim: anim(skup(s0, s1, (q, i) => 'r' + i)), pohledy: ['x'], koty: [], popisky: [], text: ['Po třech lištách (vršek A, levá B, pravá C) slepit do šestibokých hranolů – úhly 3 × 120° se v ose sejdou. Nejlépe na lepicí pásku: lišty položit vedle sebe na pásku, natřít a srolovat, pásku dotáhnout; nebo stahovací pásky.'] });
    kroky.push({ typ: 'lepeni', nazev: 'Slepení řad', kusy: s2, anim: anim(skup(s1, s2, (q) => q.hex)), pohledy: ['x'], koty: [], popisky: [], text: [`Šestiboké hranoly slepit svislými stěnami do ${G.hexy.length} řad (po ${Math.max(...G.hexy.map((r) => r.length))}).`] });
    const obB = obalka(s3);
    kroky.push({ typ: 'lepeni', nazev: 'Slepení bloku', kusy: s3, anim: anim(skup(s2, s3, (q) => 'r' + q.rada)), pohledy: ['x'], koty: [kota('x', [obB.min[1], 0], [obB.max[1], 0], -8, fmt(obB.roz[1])), kota('x', [obB.max[1], 0], [obB.max[1], obB.max[2]], 8, fmt(obB.roz[2]))], popisky: [], text: ['Řady do sebe zapadají zuby – slepit do bloku (polena). Svěrky přes tvarované příložky (vyřezané do zubů), aby tlak šel kolmo na spáry.'] });
    // příčné řezy
    const pl = [], od = [];
    for (let i = 0; i < N; i++) { const xa = oK + i * (c + k); for (const q of s3) { const r = orizniOsou(q, 0, xa, xa + c); if (r) pl.push(Object.assign(r, { platek: i })); } }
    for (const q of s3) { const a = orizniOsou(q, 0, 0, oK - k); if (a) od.push(Object.assign(a, { odpad: true })); const b = orizniOsou(q, 0, oK + N * (c + k), 1e6); if (b) od.push(Object.assign(b, { odpad: true })); }
    kroky.push({ typ: 'rez', nazev: 'Příčné řezy na plátky', kusy: pl.concat(od), anim: animNahrada(s3), pohledy: ['z'], koty: [kota('z', [oK, 0], [oK + c, 0], -8, fmt(c))], popisky: [], text: [`Zarovnat konec a uříznout ${N} ${N === 1 ? 'plátek' : 'plátky'} po ${fmt(c)} mm (tloušťka ${fmt(T)} + ${fmt(uF)} na broušení), řez ${fmt(k)} mm. Každý plátek = jedno prkénko.`], bezpecnost: true });
    // otočení
    const sk = [], po = [];
    const obS = obalka(stav(3).map((q) => q)); // ležící blok
    for (let i = 0; i < N; i++) {
      const kk = pl.filter((q) => q.platek === i);
      const r = presunSkupinu(kk, RY90, [i * (obB.roz[1] + 40), 0, 0]);
      r.po.forEach((q) => { q.platek = i; }); sk.push({ kusy: kk, R: r.R, t: r.t }); po.push(...r.po);
    }
    kroky.push({ typ: 'otoceni', nazev: 'Otočení plátků čelem nahoru', kusy: po, anim: anim(sk), pohledy: ['z'], koty: [], popisky: [], text: ['Plátky položit čelem nahoru – na ploše se objeví šestiúhelníky, které oko čte jako kostky (světlý vršek, střední a tmavá stěna).'] });
    // ořez na obdélník: v souřadnicích stojícího polena je obdélník [0, L] × [0, W]
    const fin = [], odp = [];
    for (let i = 0; i < N; i++) {
      const kk = po.filter((q) => q.platek === i), ob = obalka(kk);
      const x0 = ob.min[0] - obZ.min[0], y0 = ob.min[1] - obZ.min[1];
      for (const q of kk) {
        let a = orizniOsou(q, 0, x0, x0 + L); a = a && orizniOsou(a, 1, y0, y0 + W);
        if (a) fin.push(Object.assign(posun(a, [-x0 + i * (L + 40), -y0, 0]), { platek: i }));
      }
    }
    const k1 = fin.filter((q) => q.platek === 0);
    kroky.push({ typ: 'orez', nazev: 'Ořez na obdélník', kusy: fin, anim: animNahrada(po), pohledy: ['z'], koty: [kota('z', [0, 0], [L, 0], -8, fmt(L)), kota('z', [L, 0], [L, W], 8, fmt(W))], popisky: [], text: [`Zubaté okraje oříznout na ${fmt(L)} × ${fmt(W)} mm. Plátek čelního dřeva je křehký – řezat na saních s přítlakem, nikdy podél pravítka volnou rukou.`], bezpecnost: true });
    const akt = dokonciKroky(p, kroky, k1, c, true);
    const rezny = [{ slot: 'A', ks: nA, tl: h, sir: s, del: Llog, nazev: 'Lišta ◇ 60° (vršek)', kosoctverec: true }, { slot: 'B', ks: nB, tl: h, sir: s, del: Llog, nazev: 'Lišta ◇ 60° (levá stěna)', kosoctverec: true }, { slot: 'C', ks: nC, tl: h, sir: s, del: Llog, nazev: 'Lišta ◇ 60° (pravá stěna)', kosoctverec: true }];
    return { kroky, akt, rezny, cel: true, info: { 'Strana kosočtverce': fmt(s) + ' mm', 'Výška kosočtverce': fmt(h, 2) + ' mm', 'Úhly': '60° / 120°', 'Kostek (šestiúhelníků)': G.hexy.reduce((a, r) => a + r.length, 0), 'Délka polena': fmt(Llog) + ' mm' }, kostky: G };
  }

  /* chevron – pruhy rozřezané šikmo, každý druhý pás překlopený */
  function vzorChevron(p) {
    const R = rng(p.seed), al = p.chevronUhel * Math.PI / 180, w = p.chevronPruh, ps = p.chevronSloupec, k = p.kerf, oK = p.orezKonce;
    const T = p.tloustka, uP = p.uberPanel, uF = p.uberFinal, H = T + uP + uF, sin = Math.sin(al), cot = 1 / Math.tan(al);
    const N = Math.max(2, Math.round(p.delka / ps)), W = p.sirka, okr = 4;
    const WpPotreba = (W + 2 * okr + ps * cot) * sin, m = Math.max(2, Math.ceil(WpPotreba / w)), Wp = m * w;
    const krok = (ps + k) / sin, Lp = 2 * oK + N * krok + Wp * cot;
    const sled = p.chevronSled, g = 8, kroky = [];
    const pr = [];
    for (let i = 0; i < m; i++) { const sl = sled[i % sled.length], st = drenBokem(R, i * w + w / 2, H / 2); pr.push(kvadr(0, i * (w + g), 0, Lp, i * (w + g) + w, H, p['drev' + sl], [1, 0, 0], [0, st[1] + i * g, st[2]], { slot: sl, i, yLep: i * w })); }
    kroky.push({ typ: 'pruhy', nazev: 'Příprava pruhů', kusy: pr, pohledy: ['z', 'x'], koty: [kota('z', [0, 0], [Lp, 0], -8, fmt(Lp))], popisky: [], text: [`${m} pruhů šířky ${fmt(w)} mm v pořadí ${sled.split('').join(' ')}…, výška ${fmt(H)} mm (${fmt(T)} + ${fmt(uP)} + ${fmt(uF)} na dvoje hoblování), délka ${fmt(Lp)} mm.`, `Délka = 2 × ${fmt(oK)} + ${N} pásů × (${fmt(ps)} + ${fmt(k)}) / sin ${fmt(p.chevronUhel)}° + šikmý náběh ${fmt(Wp * cot)} mm.`] });
    const sk = pr.map((q) => ({ kusy: [q], R: I3, t: [0, q.yLep - obalka([q]).min[1], 0] })), lep = sk.map((s) => posun(s.kusy[0], s.t));
    kroky.push({ typ: 'lepeni', nazev: 'Lepení panelu', kusy: lep, anim: anim(sk), pohledy: ['z', 'x'], koty: [kota('x', [0, 0], [Wp, 0], -8, fmt(Wp))], popisky: [], text: [`Slepit panel ${fmt(Lp)} × ${fmt(Wp)} × ${fmt(H)} mm.`] });
    const hob = hobluj(lep, H, uP), H2 = H - uP;
    kroky.push({ typ: 'hoblovani', nazev: 'Hoblování panelu', kusy: hob, anim: animNahrada(lep), pohledy: ['z', 'x'], koty: [kota('x', [Wp, 0], [Wp, H2], 8, fmt(H2))], popisky: [], text: [`Srovnat plochy na ${fmt(H2)} mm – šikmé pásy musí mít rovnoběžné plochy, jinak po překlopení nesedí.`] });
    // šikmé řezy: x − y·cot ∈ [X_j, X_j + ps/sin]
    const pasy = [], od = [];
    for (let j = 0; j < N; j++) {
      const X = oK + j * krok;
      for (const q of hob) { let a = orizniPrimkou(q, -1, cot, -X); a = a && orizniPrimkou(a, 1, -cot, X + ps / sin); if (a) pasy.push(Object.assign(a, { sloupec: j })); }
    }
    for (const q of hob) { const a = orizniPrimkou(q, 1, -cot, oK - k / sin); if (a) od.push(Object.assign(a, { odpad: true })); const b = orizniPrimkou(q, -1, cot, -(oK + N * krok)); if (b) od.push(Object.assign(b, { odpad: true })); }
    kroky.push({ typ: 'rez', nazev: `Šikmé řezy pod ${fmt(p.chevronUhel)}°`, kusy: pasy.concat(od), anim: animNahrada(hob), pohledy: ['z'], koty: [], popisky: [], text: [`Na přířezných saních s úhlovým dorazem ${fmt(p.chevronUhel)}° uříznout ${N} rovnoběžníkových pásů šířky ${fmt(ps)} mm (měřeno kolmo k řezu), vodorovná rozteč ${fmt(krok, 2)} mm včetně řezu ${fmt(k)} mm.`, 'Doraz pro šířku pásu upnout na saně před kotouč, nikdy ne na podélné pravítko za kotoučem (sevřený kus vystřelí).'], bezpecnost: true });
    // otočení do sloupců + překlopení každého druhého
    const th = Math.PI / 2 - al, sk5 = [], po5 = [];
    let maxY = 0;
    const rot = [];
    for (let j = 0; j < N; j++) { const Rm = j % 2 ? mul(RY180, rz(th)) : rz(th); const kk = pasy.filter((q) => q.sloupec === j); const r0 = kk.map((q) => transformuj(q, Rm)); maxY = Math.max(maxY, obalka(r0).roz[1]); rot.push({ kk, Rm }); }
    rot.forEach(({ kk, Rm }, j) => {
      const r0 = obalka(kk.map((q) => transformuj(q, Rm))).roz[1];
      const r = presunSkupinu(kk, Rm, [j * (ps + g), (maxY - r0) / 2, 0]);
      r.po.forEach((q) => { q.sloupec = j; q.otoc = j % 2 === 1; }); sk5.push({ kusy: kk, R: r.R, t: r.t }); po5.push(...r.po);
    });
    const k5 = { typ: 'otoceni', nazev: 'Natočení a překlopení pásů', kusy: po5, anim: anim(sk5), pohledy: ['z'], koty: [], popisky: [], text: [`Pásy postavit vedle sebe; každý druhý pás překlopit (otočit spodní plochou nahoru) – pruhy se zrcadlí a na spárách vznikne „V“ (chevron).`, 'Pásy vystředit na výšku tak, aby se pruhy na spárách potkaly.'] };
    for (let j = 1; j < N; j += 2) k5.popisky.push({ pohled: 'z', x: j * (ps + g) + ps / 2, y: maxY + 6, text: 'překlopit' });
    kroky.push(k5);
    const sk6 = [], lep2 = [];
    for (let j = 0; j < N; j++) { const kk = po5.filter((q) => q.sloupec === j), t = [-j * g, 0, 0]; sk6.push({ kusy: kk, R: I3, t }); lep2.push(...kk.map((q) => posun(q, t))); }
    kroky.push({ typ: 'lepeni', nazev: 'Druhé lepení', kusy: lep2, anim: anim(sk6), pohledy: ['z'], koty: [kota('z', [0, 0], [N * ps, 0], -8, fmt(N * ps))], popisky: [], text: ['Slepit pásy; spáry jsou podélné-na-podélné (vlákno šikmo), drží dobře. Pásy mají sklon „ujíždět“ do strany – lepit na podložce s dorazovou lištou a krátce předem stáhnout bez lepidla.'] });
    const yc = maxY / 2, ya = yc - W / 2, poO = [], odO = [];
    for (const q of lep2) { const a = orizniOsou(q, 1, ya, ya + W); if (a) poO.push(posun(a, [0, -ya, 0])); const b = orizniOsou(q, 1, -1e6, ya); if (b) odO.push(Object.assign(posun(b, [0, -ya - 15, 0]), { odpad: true })); const c2 = orizniOsou(q, 1, ya + W, 1e6); if (c2) odO.push(Object.assign(posun(c2, [0, -ya + 15, 0]), { odpad: true })); }
    kroky.push({ typ: 'orez', nazev: 'Ořez zubatých konců', kusy: poO.concat(odO), anim: animNahrada(lep2), pohledy: ['z'], koty: [kota('z', [N * ps, 0], [N * ps, W], 8, fmt(W))], popisky: [], text: [`Zubaté konce pásů oříznout na ${fmt(W)} mm (čistá délka pásu ${fmt(Wp / sin - ps * cot)} mm).`], bezpecnost: true });
    const akt = dokonciKroky(p, kroky, poO, H2, false);
    const rez = {};
    for (let i = 0; i < m; i++) { const sl = sled[i % sled.length]; (rez[sl] = rez[sl] || { slot: sl, ks: 0, tl: w + p.pridavekPruh, sir: H, del: Lp, nazev: 'Pruh (na hranu)' }).ks++; }
    return { kroky, akt, rezny: Object.values(rez), cel: false, info: { 'Pásů': N, 'Úhel': fmt(p.chevronUhel) + '°', 'Šířka panelu': fmt(Wp) + ' mm', 'Čistá délka pásu': fmt(Wp / sin - ps * cot) + ' mm' }, chevron: { N, ps, al, Wp } };
  }

  /* vkládané proužky – šikmé / příčné řezy s vloženou žilkou */
  function vzorVkladane(p) {
    const R = rng(p.seed), seq = pruhySekvence(p), K = p.vklPocet, be = p.vklUhel * Math.PI / 180, tz = p.vklZilka, k = p.kerf, oK = p.orezKonce;
    const sin = Math.sin(be), cot = Math.abs(Math.tan(be)) < 1e-9 ? 0 : 1 / Math.tan(be), T = p.tloustka, uP = p.uberPanel, uF = p.uberFinal, H = T + uP + uF;
    const D = (tz - k) / sin, L = p.delka, Ls = L + 2 * oK, L0 = Ls - K * D, kroky = [], g = 10;
    const pr = []; let y = 0;
    seq.forEach((q, i) => { const st = drenBokem(R, y + q.s / 2, H / 2); pr.push(kvadr(0, y + i * g, 0, L0, y + i * g + q.s, H, p['drev' + q.slot], [1, 0, 0], [0, st[1] + i * g, st[2]], { slot: q.slot, i, yLep: y })); y += q.s; });
    const W = y, ym = W / 2;
    kroky.push({ typ: 'pruhy', nazev: 'Příprava pruhů', kusy: pr, pohledy: ['z', 'x'], koty: [kota('z', [0, 0], [L0, 0], -8, fmt(L0))], popisky: [], text: [`${seq.length} pruhů výšky ${fmt(H)} mm, délka ${fmt(L0)} mm = ${fmt(Ls)} − ${K} × (${fmt(tz)} žilka − ${fmt(k)} řez) / sin ${fmt(p.vklUhel)}°.`] });
    const sk = pr.map((q) => ({ kusy: [q], R: I3, t: [0, q.yLep - obalka([q]).min[1], 0] })), lep = sk.map((s) => posun(s.kusy[0], s.t));
    kroky.push({ typ: 'lepeni', nazev: 'Lepení panelu', kusy: lep, anim: anim(sk), pohledy: ['z', 'x'], koty: [kota('x', [0, 0], [W, 0], -8, fmt(W))], popisky: [], text: [`Slepit panel ${fmt(L0)} × ${fmt(W)} × ${fmt(H)} mm.`] });
    const hob = hobluj(lep, H, uP), H2 = H - uP;
    kroky.push({ typ: 'hoblovani', nazev: 'Hoblování panelu', kusy: hob, anim: animNahrada(lep), pohledy: ['z'], koty: [], popisky: [], text: [`Srovnat na ${fmt(H2)} mm.`] });
    // řezy: přímka x − (y − ym)·cot = xb_i, pásmo řezu ± k/(2 sin)
    const xb = []; for (let i = 0; i < K; i++) xb.push(oK + L * (i + 1) / (K + 1) - (i + 0.5) * D);
    const kusyR = [];
    for (let i = 0; i <= K; i++) {
      const a = i === 0 ? -1e6 : xb[i - 1] + k / (2 * sin), b = i === K ? 1e6 : xb[i] - k / (2 * sin);
      for (const q of hob) { let r = orizniPrimkou(q, -1, cot, -(a - ym * cot)); r = r && orizniPrimkou(r, 1, -cot, b - ym * cot); if (r) kusyR.push(Object.assign(r, { dil: i })); }
    }
    kroky.push({ typ: 'rez', nazev: K > 1 ? `${K} řezy pod ${fmt(p.vklUhel)}°` : `Řez pod ${fmt(p.vklUhel)}°`, kusy: kusyR, anim: animNahrada(hob), pohledy: ['z'], koty: [], popisky: [], text: [`Na přířezných saních (úhlový doraz ${fmt(p.vklUhel)}°) rozříznout panel ve ${K} místech; každý řez ubere ${fmt(k)} mm.`, 'Díly si očíslujte a označte lícní stranu, ať se vrátí na stejné místo.'], bezpecnost: true });
    // vložení žilek: díl i posunout o i·D v x; žilky jako rovnoběžníky
    const sk5 = [], po5 = [];
    for (let i = 0; i <= K; i++) { const kk = kusyR.filter((q) => q.dil === i), t = [i * D, 0, 0]; sk5.push({ kusy: kk, R: I3, t }); po5.push(...kk.map((q) => posun(q, t))); }
    const zilky = [];
    for (let i = 0; i < K; i++) {
      const x0 = xb[i] - k / (2 * sin) + i * D, x1 = x0 + tz / sin;
      const P = [[x0 - ym * cot, 0], [x1 - ym * cot, 0], [x1 + ym * cot, W], [x0 + ym * cot, W]];
      const zk = kus(P, 'z', 0, H2, p.drevC, [cot * sin, sin, 0], [(x0 + x1) / 2, ym, H2 / 2 + 200], { slot: 'C', zilka: true });
      zilky.push(zk); sk5.push({ kusy: [posun(zk, [0, 0, 60])], R: I3, t: [0, 0, -60] });
    }
    po5.push(...zilky);
    kroky.push({ typ: 'lepeni', nazev: 'Vložení proužků a lepení', kusy: po5, anim: anim(sk5), pohledy: ['z'], koty: [], popisky: [], text: [`Mezi díly vložit proužky ${DREVINY[p.drevC].nazev} tl. ${fmt(tz)} mm, výšky ${fmt(H2 + 2)} mm a délky ${fmt(W / sin + 30)} mm. Díly se posunou jen podélně, hrany zůstanou v zákrytu.`, 'Lepit po jednom nebo vše najednou s podélnými svěrkami a příčnými přítlačnými lištami; pozor na „ujíždění“ šikmých dílů – zajistit dorazem.'] });
    const hob2 = hobluj(po5, H2, uF);
    kroky.push({ typ: 'hoblovani', nazev: 'Hoblování na tloušťku', kusy: hob2, anim: animNahrada(po5), pohledy: ['z'], koty: [], popisky: [], text: [`Srovnat na ${fmt(T)} mm.`] });
    let akt = orezKoncu(p, kroky, hob2, Ls, L);
    akt = dokonciKroky(p, kroky, akt, T, false);
    const rez = seq.reduce((m, q) => { const kk = q.slot + q.s; (m[kk] = m[kk] || { slot: q.slot, ks: 0, tl: q.s + p.pridavekPruh, sir: H, del: L0, nazev: 'Pruh (na hranu)' }).ks++; return m; }, {});
    const out = Object.values(rez); out.push({ slot: 'C', ks: K, tl: tz, sir: H2 + 2, del: W / sin + 30, nazev: 'Vkládaný proužek' });
    return { kroky, akt, rezny: out, cel: false, info: { 'Proužků': K, 'Úhel': fmt(p.vklUhel) + '°', 'Prodloužení na proužek': fmt(D, 2) + ' mm' }, vkladane: { xb, D } };
  }

  /* vlny – řez pásovou pilou po křivce, vložená žilka */
  function vzorVlny(p) {
    const R = rng(p.seed), M = p.vlnyPocet, Am = p.vlnyAmplituda, lam = p.vlnyDelka, tz = p.vlnyZilka, kb = p.vlnyKerf, oK = p.orezKonce;
    const T = p.tloustka, uF = p.uberFinal, H = T + uF, L = p.delka, W = p.sirka, Ls = L + 2 * oK, D = tz - kb, W0 = W - M * D;
    const fz = p.vlnyFaze * Math.PI / 180;
    const yb = []; for (let i = 0; i < M; i++) yb.push(W * (i + 1) / (M + 1) - (i + 0.5) * D);
    const kr = (i, x) => yb[i] + Am * Math.sin(2 * Math.PI * x / lam + i * fz);
    const nS = Math.max(24, Math.ceil(Ls / 4)), xs = []; for (let j = 0; j <= nS; j++) xs.push(Ls * j / nS);
    const kroky = [];
    const zak = kvadr(0, 0, 0, Ls, W0, H, p.drevA, [1, 0, 0], drenBokem(R, W0 / 2, H / 2), { slot: 'A' });
    kroky.push({ typ: 'pruhy', nazev: 'Základní deska', kusy: [zak], pohledy: ['z', 'x'], koty: [kota('z', [0, 0], [Ls, 0], -8, fmt(Ls)), kota('z', [Ls, 0], [Ls, W0], 8, fmt(W0))], popisky: [], text: [`Deska (nebo slepený panel) ${DREVINY[p.drevA].nazev} ${fmt(Ls)} × ${fmt(W0)} × ${fmt(H)} mm. Šířka = ${fmt(W)} − ${M} × (${fmt(tz)} žilka − ${fmt(kb)} řez pásovou pilou).`] });
    // díly mezi křivkami
    const dily = [];
    for (let i = 0; i <= M; i++) {
      const dol = i === 0 ? xs.map((x) => [x, 0]) : xs.map((x) => [x, kr(i - 1, x) + kb / 2]);
      const hor = i === M ? xs.map((x) => [x, W0]) : xs.map((x) => [x, kr(i, x) - kb / 2]);
      dily.push(kus(dol.concat(hor.reverse()), 'z', 0, H, p.drevA, [1, 0, 0], zak.st, { slot: 'A', dil: i }));
    }
    kroky.push({ typ: 'rez', nazev: 'Řezy po křivkách', kusy: dily, anim: animNahrada([zak]), pohledy: ['z'], koty: [], popisky: [], text: [`Obkreslit ${M} křivek podle šablony (vlna ${fmt(lam)} mm, amplituda ${fmt(Am)} mm) a rozříznout pásovou pilou (řez ${fmt(kb)} mm). Hrany řezu přebrousit válcovou bruskou do plynulé křivky.`], bezpecnost: true });
    const sk = [], po = [];
    dily.forEach((q, i) => { const t = [0, i * D, 0]; sk.push({ kusy: [q], R: I3, t }); po.push(posun(q, t)); });
    for (let i = 0; i < M; i++) {
      const dol = xs.map((x) => [x, kr(i, x) - kb / 2 + i * D]), hor = xs.map((x) => [x, kr(i, x) - kb / 2 + i * D + tz]);
      const z = kus(dol.concat(hor.reverse()), 'z', 0, H, p.drevB, [1, 0, 0], [0, yb[i] + i * D - 300, H / 2], { slot: 'B', zilka: true });
      po.push(z); sk.push({ kusy: [posun(z, [0, 0, 60])], R: I3, t: [0, 0, -60] });
    }
    const Rmin = Am > 0 ? lam * lam / (4 * Math.PI * Math.PI * Am) : Infinity;
    kroky.push({ typ: 'lepeni', nazev: 'Vložení žilek a lepení', kusy: po, anim: anim(sk), pohledy: ['z'], koty: [kota('z', [Ls, 0], [Ls, W], 8, fmt(W))], popisky: [], text: [`Do každého řezu vložit ohnutou žilku ${DREVINY[p.drevB].nazev} tl. ${fmt(tz)} mm a sevřít; nejmenší poloměr křivky ${Number.isFinite(Rmin) ? fmt(Rmin) : '∞'} mm. Lepit po jedné křivce (polyuretanové nebo PVAc D3 lepidlo).`, 'Žilka z rovnovláknitého dřeva, ohýbat za sucha, při malém poloměru napařit nebo použít dvě tenčí vrstvy.'] });
    const hob = hobluj(po, H, uF);
    kroky.push({ typ: 'hoblovani', nazev: 'Hoblování na tloušťku', kusy: hob, anim: animNahrada(po), pohledy: ['z'], koty: [], popisky: [], text: [`Srovnat na ${fmt(T)} mm.`] });
    let akt = orezKoncu(p, kroky, hob, Ls, L);
    akt = dokonciKroky(p, kroky, akt, T, false);
    const rezny = [{ slot: 'A', ks: 1, tl: H, sir: W0 + 2 * p.pridavekPruh, del: Ls, nazev: 'Základní deska' }, { slot: 'B', ks: M, tl: tz, sir: H + 2, del: Ls + 20, nazev: 'Žilka (ohýbaná)' }];
    return { kroky, akt, rezny, cel: false, info: { 'Křivek': M, 'Nejmenší poloměr': Number.isFinite(Rmin) ? fmt(Rmin) + ' mm' : '–' }, vlny: { Rmin, W0, D } };
  }

  /* ---------------- hlavní výpočet ---------------- */
  const GEN = { podelne: vzorPodelne, sachovnice: vzorSachovnice, cihla: vzorCihla, kostky: vzorKostky, chevron: vzorChevron, sachy: vzorSachy, vlny: vzorVlny, vkladane: vzorVkladane };
  function spocitej(vstup) {
    const p = normalizuj(vstup);
    const v = GEN[p.vzor](p);
    v.p = p; v.vzor = p.vzor;
    v.kroky.forEach((kk, i) => { kk.n = i + 1; });
    const ob = obalka(v.akt);
    v.rozmer = { L: ob.roz[0], W: ob.roz[1], T: ob.roz[2] };
    // řezný seznam: dřevina, objem, materiál
    for (const r of v.rezny) { r.ks *= (p.vzor === 'kostky' || v.cel ? 1 : p.pocetKusu); r.drevina = p['drev' + r.slot]; r.objem = r.ks * (r.kosoctverec ? r.tl * r.sir : r.tl * r.sir) * r.del / 1e9; }
    const mat = {};
    for (const r of v.rezny) {
      const m = mat[r.slot] = mat[r.slot] || { slot: r.slot, drevina: r.drevina, delka: 0, objem: 0, hmotnost: 0, polozek: 0 };
      m.delka += r.ks * r.del / 1000; m.objem += r.objem; m.polozek += r.ks;
    }
    for (const m of Object.values(mat)) { m.hmotnost = m.objem * hustota(p, m.slot); m.nakup = m.objem * (1 + p.prorez / 100); }
    v.material = mat;
    v.hmotnost = hmotnostHotova(p, v.akt, v.rozmer);
    v.dokonceni = geometrieDokonceni(p, v.rozmer);
    v.varovani = kontrola(p, v);
    v.nazev = `${VZORY[p.vzor].nazev} ${fmt(v.rozmer.L, 0)} × ${fmt(v.rozmer.W, 0)} × ${fmt(v.rozmer.T, 0)} mm`;
    return v;
  }
  function hmotnostHotova(p, kusy, roz) {
    let V = 0, m = 0;
    for (const k of kusy) { if (k.odpad) continue; const o = objem(k) / 1e9; V += o; m += o * hustota(p, k.slot || 'A'); }
    const L = roz.L, W = roz.W, T = roz.T, r = Math.min(p.rohR, L / 2, W / 2), c = p.hranaTyp === 'zadna' ? 0 : p.hrana;
    const obvod = 2 * (L + W) - 8 * r + 2 * Math.PI * r;
    let odber = (4 - Math.PI) * r * r * T;
    odber += 2 * obvod * (p.hranaTyp === 'zkoseni' ? c * c / 2 : (1 - Math.PI / 4) * c * c);
    const D = geometrieDokonceni(p, roz);
    if (p.drazka && D.drazka) odber += D.drazka.delka * Math.PI * p.drazkaSirka * p.drazkaHloubka / 4;
    if (p.uchyty === 'bocni') odber += 2 * p.uchytDelka * p.uchytHloubka * p.uchytVyska * 0.75;
    if (p.uchyty === 'otvor') odber += Math.PI * p.otvorPrumer ** 2 / 4 * T;
    const Vh = Math.max(0, V - odber / 1e9);
    return { objemHruby: V, objem: Vh, kg: V > 0 ? m * Vh / V : 0, hustota: V > 0 ? m / V : 0 };
  }

  /* ---------------- dokončení: obrys, drážka, nožičky, úchyty ---------------- */
  function zaoblenyObdelnik(x0, y0, x1, y1, r, krokUhlu) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
    if (r < 1e-6) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const n = Math.max(2, Math.ceil(90 / (krokUhlu || 7.5))), out = [];
    const rohy = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
    for (const [cx, cy, a0] of rohy) for (let i = 0; i <= n; i++) { const a = (a0 + 90 * i / n) * Math.PI / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return out;
  }
  const delkaPolylinie = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; };
  function geometrieDokonceni(p, roz) {
    const L = roz.L, W = roz.W, out = { L, W, obrys: zaoblenyObdelnik(0, 0, L, W, p.rohR), rohR: Math.min(p.rohR, L / 2, W / 2) };
    if (p.drazka) {
      const e = p.drazkaOdstup + p.drazkaSirka / 2, r = Math.max(p.drazkaSirka / 2 + 1, p.drazkaR);
      if (L - 2 * e > 2 * p.drazkaSirka && W - 2 * e > 2 * p.drazkaSirka) {
        const osa = zaoblenyObdelnik(e, e, L - e, W - e, r);
        out.drazka = { osa, vnejsi: zaoblenyObdelnik(e - p.drazkaSirka / 2, e - p.drazkaSirka / 2, L - e + p.drazkaSirka / 2, W - e + p.drazkaSirka / 2, r + p.drazkaSirka / 2), vnitrni: zaoblenyObdelnik(e + p.drazkaSirka / 2, e + p.drazkaSirka / 2, L - e - p.drazkaSirka / 2, W - e - p.drazkaSirka / 2, Math.max(0, r - p.drazkaSirka / 2)), delka: delkaPolylinie(osa), odstupOsy: e, r };
      }
    }
    out.nozicky = [];
    if (p.nozicky > 0) {
      const o = p.nozickyOdstup, n = p.nozicky;
      const body = n <= 3 ? [[o, o], [o, W - o], [L - o, W / 2]] : [[o, o], [L - o, o], [L - o, W - o], [o, W - o]];
      if (n > 4) for (let i = 0; i < n - 4; i++) body.push(i % 2 ? [L / 2, W - o] : [L / 2, o]);
      out.nozicky = body.slice(0, n).map(([x, y]) => ({ x, y, r: p.nozickyPrumer / 2 }));
    }
    if (p.uchyty === 'bocni') {
      const d = p.uchytDelka, h = Math.min(p.uchytHloubka, L / 4);
      out.uchyty = [[[0, W / 2 - d / 2], [h, W / 2 - d / 2], [h, W / 2 + d / 2], [0, W / 2 + d / 2]], [[L, W / 2 - d / 2], [L - h, W / 2 - d / 2], [L - h, W / 2 + d / 2], [L, W / 2 + d / 2]]];
    }
    if (p.uchyty === 'otvor') out.otvor = { x: L - Math.max(p.otvorPrumer / 2 + 18, (out.drazka ? out.drazka.odstupOsy - p.drazkaSirka / 2 : 30) / 2 + p.otvorPrumer / 2 - 4), y: W / 2, r: p.otvorPrumer / 2 };
    return out;
  }

  /* ---------------- kontrola návrhu ---------------- */
  function kontrola(p, v) {
    const V = [], add = (uroven, text) => V.push({ uroven, text });
    const T = p.tloustka, roz = v.rozmer;
    if (v.cel && T < 30) add('varovani', `Čelní prkénko ${fmt(T)} mm je tenké – doporučuje se 32–50 mm, jinak hrozí praskání ve spárách.`);
    if (!v.cel && T < 16) add('varovani', `Tloušťka ${fmt(T)} mm je na krájecí prkénko malá (typicky 20–40 mm), deska se bude kroutit.`);
    for (const s of ['A', 'B', 'C']) {
      if (!v.rezny.some((r) => r.slot === s)) continue;
      const D = DREVINY[p['drev' + s]];
      if (D.vhodnost === 'porezni') add('varovani', `${s}: ${D.nazev} – ${D.pozn}.`);
      if (D.vhodnost === 'alergen') add('chyba', `${s}: ${D.nazev} – ${D.pozn}.`);
      if (D.vhodnost === 'mekke') add('chyba', `${s}: ${D.nazev} – ${D.pozn}.`);
    }
    const sloty = [...new Set(v.rezny.map((r) => r.slot))];
    if (sloty.length > 1 && new Set(sloty.map((s) => p['drev' + s])).size === 1) add('info', 'Všechny pozice mají stejnou dřevinu – vzor bude vidět jen na kresbě letokruhů.');
    if (v.cel && (p.vzor === 'sachovnice' && (p.bunka < 20 || p.bunka > 70))) add('varovani', `Pole ${fmt(p.bunka)} mm: méně než 20 mm = hodně spár, víc než 70 mm = větší napětí na spárách. Obvyklé 25–50 mm.`);
    if (v.cel) add('info', 'Bezpečnost: plátky čelního dřeva řezat na přířezných saních s dorazem upnutým PŘED kotoučem; podélné pravítko jako doraz pro krátké kusy nepoužívat (sevření → zpětný vrh).');
    if (v.cel) add('info', 'Čelní dřevo nezarovnávat v tloušťkovačce – použít válcovou brusku nebo frézovací saně.');
    for (const r of v.rezny) if (r.del > 1300) add('varovani', `Pruh ${r.nazev} ${DREVINY[r.drevina].nazev} je dlouhý ${fmt(r.del)} mm – lepte víc kratších panelů.`);
    if (roz.W > 310 && !v.cel) add('info', `Šířka ${fmt(roz.W)} mm přesahuje běžnou šířku protahovačky (~310 mm) – hoblujte na dvě poloviny a slepte až nakonec, nebo použijte válcovou brusku.`);
    if (p.vzor === 'chevron' || p.vzor === 'vkladane') add('info', 'Šikmo orientovaná vlákna mezi sebou: spáry jsou podélné-podélné, ale při změnách vlhkosti se deska může mírně zvlnit. Nemyjte v myčce.');
    if (p.vzor === 'vlny' && v.vlny && v.vlny.Rmin < 60 * p.vlnyZilka) add('varovani', `Nejmenší poloměr křivky ${fmt(v.vlny.Rmin)} mm je na žilku ${fmt(p.vlnyZilka)} mm malý (za sucha typicky ≥ 60 × tloušťka) – zmenšete amplitudu, prodlužte vlnu, napařte nebo použijte tenčí vrstvy.`);
    if (p.vzor === 'vlny' && v.vlny && p.vlnyAmplituda * 2 + p.vlnyZilka > p.sirka / (p.vlnyPocet + 1)) add('varovani', 'Vlny jsou na šířku desky velké – sousední křivky se mohou přiblížit nebo vyjet z desky.');
    const D = v.dokonceni;
    if (p.drazka && !D.drazka) add('varovani', 'Šťávová drážka se na prkénko nevejde – zmenšete odstup nebo šířku.');
    if (p.drazka && p.drazkaHloubka > T / 3) add('varovani', `Hloubka drážky ${fmt(p.drazkaHloubka)} mm je větší než třetina tloušťky.`);
    if (p.drazka && D.drazka && p.nozicky && D.nozicky.some((n) => n.x + n.r > D.drazka.odstupOsy - p.drazkaSirka / 2 && n.x - n.r < D.drazka.odstupOsy + p.drazkaSirka / 2) && p.drazkaHloubka + 12 > T) add('varovani', 'Vrut nožičky může prorazit do drážky – zkraťte vrut nebo posuňte nožičky.');
    if (p.uchyty === 'bocni' && p.uchytVyska > T * 0.6) add('varovani', 'Úchyt je na tloušťku desky příliš vysoký.');
    if (p.nozicky && v.cel) add('info', 'Nožičky u čelního prkénka: deska lépe větrá zespodu a nekroutí se, ale používá se jen jedna strana.');
    if (!V.some((q) => q.uroven === 'chyba' || q.uroven === 'varovani')) add('ok', 'Návrh je v pořádku.');
    return V;
  }

  /* ---------------- pomocníci pro testy a výstupy ---------------- */
  /** mřížka dřevin horní plochy: vzorkuje střed buněk nx × ny v okně [x0..x1] × [y0..y1] */
  function mrizkaShora(kusy, x0, y0, x1, y1, nx, ny) {
    const ob = obalka(kusy.filter((q) => !q.odpad)), z = ob.max[2] - 0.01, out = [];
    for (let j = 0; j < ny; j++) {
      const r = [];
      for (let i = 0; i < nx; i++) { const k = kusVBode(kusy, [x0 + (i + 0.5) * (x1 - x0) / nx, y0 + (j + 0.5) * (y1 - y0) / ny, z]); r.push(k ? (k.slot || '?') : '.'); }
      out.push(r.join(''));
    }
    return out;
  }

  const API = { fmt, DREVINY, VZORY, VYCHOZI, MEZE, normalizuj, spocitej, parsujSekvenci, pruhySekvence, transformuj, posun, orizniOsou, orizniPrimkou, obalka, objem, plocha, uhly, obsahuje, kusVBode, projekce, pohled, mrizkaShora, geometrieKostek, geometrieDokonceni, zaoblenyObdelnik, bodVPolygonu, hustota, kvadr, mul, mv, RY90, RZ180, RY180, rz, I3, UV, OSA_I, rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PKJ = API;
})(typeof window !== 'undefined' ? window : globalThis);
