/* Odsávací botka – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Botka (dust shoe) na vřeteno CNC frézky / horní frézky: OBJÍMKA na vřeteno s deskou (víko komory),
   odnímatelná KOMORA (stěna s přírubou nahoře a lištou pro kartáč dole) a VÝVOD na hadici vysavače
   (z desky šikmo nahoru, nebo z boku komory, volitelně tečně). Komora drží na magnetech nebo v zásuvném vedení,
   kartáč je kupovaný pásek s vlasem v drážce, nebo tištěná sukně z TPU s lamelami.

   Souřadnice: osa Z = osa vřetene, z = 0 = čelo vřetene (spodní hrana matice kleštiny), špička nástroje v z = −vyložení.
   Půdorys komory = zaoblený obdélník (kruh, ovál = dráha, obdélník) s delší osou podél +X, posunutý o „posun“ od osy vřetene.
   Úhel natočení vývodu (°) se měří od +X proti směru hodinových ručiček (při pohledu shora).
   Všechny díly se tisknou v montážní poloze bez podpor: objímka deskou na podložce, komora lištou kartáče na podložce
   (drážka kartáče = můstek), převisy ≤ 45° (sražení pod přírubou, náběhy lišty, šikmý vývod ≥ 45°). */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const fmt = G.fmt;
  const rad = s => s * Math.PI / 180, deg = r => r * 180 / Math.PI;

  /* ---------------- tabulky ---------------- */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27 }, ASA: { nazev: 'ASA', hustota: 1.07 }, ABS: { nazev: 'ABS', hustota: 1.04 },
    PLA: { nazev: 'PLA', hustota: 1.24 }, PA: { nazev: 'PA (nylon)', hustota: 1.14 },
  };
  const HUSTOTA_TPU = 1.21;
  /** Šrouby ISO 4762 + matice ISO 4032: d, otvor, s (klíč matice), m (výška matice), hlava Ø. */
  const SROUBY = {
    M3: { d: 3, otvor: 3.4, s: 5.5, m: 2.4, hlava: 5.5 }, M4: { d: 4, otvor: 4.5, s: 7, m: 3.2, hlava: 7 },
    M5: { d: 5, otvor: 5.5, s: 8, m: 4, hlava: 8.5 }, M6: { d: 6, otvor: 6.6, s: 10, m: 5, hlava: 10 },
  };
  const DELKY = [8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60];
  /** Běžné průměry krku vřetene (mm): Euro krk 43, vřetena 52/65/80. */
  const VRETENA = [43, 52, 65, 80];
  /** Hadice a koncovky – typické rozměry, ověřit měřením (stav 19. 11. 2026). */
  const HADICE = [
    { id: 'vys35', nazev: 'Dílenský vysavač – koncovka Ø 35', prumer: 35, usazeni: 'zasun', pozn: 'Kärcher, Makita, Bosch… koncovka se zasune do hrdla' },
    { id: 'vys32', nazev: 'Domácí vysavač – trubka Ø 32', prumer: 32, usazeni: 'zasun', pozn: 'kovová / plastová trubka se zasune' },
    { id: 'd27', nazev: 'Hadice D 27 – koncovka', prumer: 27, usazeni: 'zasun', pozn: 'např. Festool D 27 – vnější Ø koncovky ověřit' },
    { id: 'd36', nazev: 'Hadice D 36 – koncovka', prumer: 36, usazeni: 'zasun', pozn: 'např. Festool D 36 – vnější Ø koncovky ověřit' },
    { id: 'ht40', nazev: 'HT trubka Ø 40', prumer: 40, usazeni: 'zasun', pozn: 'odpadní trubka (vnější Ø 40)' },
    { id: 'ht50', nazev: 'HT trubka Ø 50', prumer: 50, usazeni: 'zasun', pozn: 'odpadní trubka (vnější Ø 50)' },
    { id: 'vzt60', nazev: 'Trubka Ø 60 – k rozbočce VZT', prumer: 60, usazeni: 'zasun', pozn: 'stejná trubka jde do hrdla rozbočky' },
    { id: 'kloub25', nazev: 'Měkká hadice Ø 25 navlečená', prumer: 25, usazeni: 'nasun', pozn: 'jako u kloubové hadice (trn 25)' },
    { id: 'ods100', nazev: 'Odsávačka – hadice Ø 100 navlečená', prumer: 100, usazeni: 'nasun', pozn: 'spirálová hadice přes hrdlo, stáhnout sponou' },
  ];
  /** Průtoky vysavačů – typické hodnoty při zatížení (m³/h), ověřit. */
  const VYSAVACE = [
    { nazev: 'Domácí vysavač', prutok: 110 }, { nazev: 'Dílenský vysavač 1200 W', prutok: 160 },
    { nazev: 'Silný dílenský vysavač', prutok: 220 }, { nazev: 'Odsávačka 1,5 kW', prutok: 700 },
  ];
  const NAZVY = {
    tvar: { kruh: 'kruh', oval: 'ovál (dráha)', obdelnik: 'obdélník' },
    upnuti: { sroub: 'stahovací šroub s maticí', pasek: 'štěrbiny + spona' },
    uchyceni: { magnety: 'magnety', zasuv: 'zásuvné vedení' },
    montaz: { lepeni: 'lepení', lis: 'zalisování' },
    kartac: { pasek: 'kartáčová lišta (vlas v pásku)', tpu: 'sukně z TPU s lamelami' },
    umisteni: { deska: 'z desky šikmo nahoru', bok: 'z boku komory' },
    usazeni: { zasun: 'koncovka se zasune do hrdla', nasun: 'hadice se navlékne na hrdlo' },
    tecny: { osa: 'radiálně (v ose)', vlevo: 'tečně vlevo', vpravo: 'tečně vpravo' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Odsávací botka',
    vreteno: { prumer: 52, vule: 0.4, vylozeni: 30 },                       // vyložení = špička nástroje pod čelem vřetene
    objimka: { upnuti: 'sroub', vyska: 30, stena: 4, odsazeni: 20, sroub: 'M5', natoceni: 180, sterbina: 2, deska: 5, sirkaSpony: 9 },
    komora: { tvar: 'oval', prumer: 150, delka: 150, sirka: 96, polomer: 15, posun: 27, stena: 2.4, priruba: 12, prirubaVyska: 4 },
    uchyceni: { typ: 'magnety', pocet: 6, prumer: 8, vyska: 3, vule: 0.2, montaz: 'lepeni', vuleZasuvu: 0.3, lista: 4 },
    kartac: { typ: 'pasek', pasek: 6, hloubka: 8, vlas: 30, vule: 0.2, presah: 2, lamela: 6, sterbina: 1 },
    vyvod: { umisteni: 'deska', prumer: 35, usazeni: 'zasun', delka: 30, stena: 2.4, vule: 0.3, kuzel: 1, doraz: 2, natoceni: 0, sklon: 60, tecny: 'osa' },
    tisk: { material: 'PETG', vrstva: 0.2, uhel: 45, kalibrace: false, krokKalibrace: 0.1 },
    proud: { prutok: 160, propustnost: 30, mezera: 0 },
  };
  /** Meze číselných polí [min, max, celé?]. */
  const MEZE = {
    'vreteno.prumer': [20, 125], 'vreteno.vule': [-0.5, 2], 'vreteno.vylozeni': [0, 120],
    'objimka.vyska': [8, 120], 'objimka.stena': [1.6, 15], 'objimka.odsazeni': [0, 250], 'objimka.natoceni': [-360, 360],
    'objimka.sterbina': [0.8, 6], 'objimka.deska': [2, 15], 'objimka.sirkaSpony': [4, 20],
    'komora.prumer': [40, 400], 'komora.delka': [40, 500], 'komora.sirka': [40, 400], 'komora.polomer': [1, 200], 'komora.posun': [-200, 200],
    'komora.stena': [1.2, 8], 'komora.priruba': [4, 40], 'komora.prirubaVyska': [2, 15],
    'uchyceni.pocet': [2, 16, 1], 'uchyceni.prumer': [3, 25], 'uchyceni.vyska': [1, 10], 'uchyceni.vule': [-0.3, 1],
    'uchyceni.vuleZasuvu': [0, 1.5], 'uchyceni.lista': [2, 12],
    'kartac.pasek': [2, 16], 'kartac.hloubka': [3, 25], 'kartac.vlas': [8, 120], 'kartac.vule': [-0.3, 1.5], 'kartac.presah': [-20, 30],
    'kartac.lamela': [2, 30], 'kartac.sterbina': [0.4, 4],
    'vyvod.prumer': [10, 160], 'vyvod.delka': [8, 150], 'vyvod.stena': [1.2, 8], 'vyvod.vule': [-0.5, 2], 'vyvod.kuzel': [0, 5],
    'vyvod.doraz': [0, 8], 'vyvod.natoceni': [-360, 360], 'vyvod.sklon': [0, 90],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.krokKalibrace': [0.02, 0.3],
    'proud.prutok': [0, 5000], 'proud.propustnost': [1, 90], 'proud.mezera': [0, 20],
  };
  const VYCTY = {
    'objimka.upnuti': Object.keys(NAZVY.upnuti), 'objimka.sroub': Object.keys(SROUBY), 'komora.tvar': Object.keys(NAZVY.tvar),
    'uchyceni.typ': Object.keys(NAZVY.uchyceni), 'uchyceni.montaz': Object.keys(NAZVY.montaz), 'kartac.typ': Object.keys(NAZVY.kartac),
    'vyvod.umisteni': Object.keys(NAZVY.umisteni), 'vyvod.usazeni': Object.keys(NAZVY.usazeni), 'vyvod.tecny': Object.keys(NAZVY.tecny),
    'tisk.material': Object.keys(MATERIALY),
  };

  /** Předvolby: jen odchylky od výchozího projektu (tisk a proudění zůstávají uživatelovy). */
  const PREDVOLBY = [
    { id: 'oval52', nazev: 'Vřeteno Ø 52 – ovál, vývod nahoru Ø 35', popis: 'magnety 6 × Ø 8 × 3, kartáčová lišta 6 mm, dílenský vysavač', p: {} },
    { id: 'oval43', nazev: 'Euro krk Ø 43 – ovál, domácí vysavač Ø 32', popis: 'horní frézka, menší komora 136 × 86, magnety 4 ×',
      p: { nazev: 'Botka 43', vreteno: { prumer: 43, vylozeni: 25 }, objimka: { vyska: 24, sroub: 'M4', odsazeni: 25 },
        komora: { delka: 136, sirka: 86, posun: 25 }, uchyceni: { pocet: 4 }, vyvod: { prumer: 32 } } },
    { id: 'kruh65', nazev: 'Vřeteno Ø 65 – kruh Ø 170, vývod nahoru', popis: 'kruhová komora, osa vřetene uprostřed, hadice Ø 35',
      p: { nazev: 'Botka 65 kruh', vreteno: { prumer: 65 }, komora: { tvar: 'kruh', prumer: 170, posun: 0 }, uchyceni: { pocet: 8 } } },
    { id: 'obd80', nazev: 'Vřeteno Ø 80 – obdélník, odsávačka Ø 100', popis: 'vodou chlazené vřeteno 2,2 kW, hadice Ø 100 navlečená',
      p: { nazev: 'Botka 80 odsávačka', vreteno: { prumer: 80, vylozeni: 35 }, objimka: { vyska: 40, stena: 5, sroub: 'M6', odsazeni: 28, deska: 6 },
        komora: { tvar: 'obdelnik', delka: 290, sirka: 140, polomer: 30, posun: 70, stena: 3, priruba: 14, prirubaVyska: 5 },
        uchyceni: { pocet: 8, prumer: 10 }, kartac: { pasek: 8, hloubka: 10, vlas: 40 },
        vyvod: { prumer: 100, usazeni: 'nasun', delka: 45, stena: 3, vule: 0.5, doraz: 3 } } },
    { id: 'bok52', nazev: 'Vřeteno Ø 52 – vývod z boku tečně', popis: 'vývod šikmo 45° ze stěny komory, tečný vstup pro vír',
      p: { nazev: 'Botka 52 boční vývod', objimka: { odsazeni: 78 }, komora: { priruba: 10 },
        uchyceni: { prumer: 6 }, vyvod: { umisteni: 'bok', sklon: 45, tecny: 'vlevo', delka: 28 } } },
    { id: 'zasuv52', nazev: 'Vřeteno Ø 52 – zásuvné vedení', popis: 'komora se vysouvá směrem k hadici, bez magnetů',
      p: { nazev: 'Botka 52 zásuvná', uchyceni: { typ: 'zasuv' } } },
    { id: 'tpu52', nazev: 'Vřeteno Ø 52 – sukně z TPU', popis: 'místo kupovaného kartáče tištěné lamely z TPU',
      p: { nazev: 'Botka 52 TPU', kartac: { typ: 'tpu', pasek: 3, hloubka: 6, vlas: 26 } } },
    { id: 'hadice25', nazev: 'Malá frézka – hadice Ø 25 navlečená', popis: 'Euro krk 43, kruh Ø 140, měkká hadice jako u kloubové hadice',
      p: { nazev: 'Botka 43 hadice 25', vreteno: { prumer: 43, vylozeni: 25 }, objimka: { vyska: 24, sroub: 'M4', odsazeni: 25 },
        komora: { tvar: 'kruh', prumer: 140, posun: 0 }, uchyceni: { pocet: 6 }, vyvod: { prumer: 25, usazeni: 'nasun', delka: 25, stena: 2 } } },
  ];

  const kopie = G.kopie;
  const normalizuj = v => G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }

  /* ---------------- 2D: půdorys ---------------- */
  /** Rozměry půdorysu: L (podél X), W, poloměr rohu rr, střed cx. */
  function tvarKomory(k) {
    if (k.tvar === 'kruh') return { tvar: 'kruh', L: k.prumer, W: k.prumer, rr: k.prumer / 2, cx: k.posun };
    if (k.tvar === 'oval') { const W = k.sirka, L = Math.max(k.delka, W + 1); return { tvar: 'oval', L, W, rr: W / 2, cx: k.posun }; }
    const L = k.delka, W = k.sirka;
    return { tvar: 'obdelnik', L, W, rr: Math.max(0.5, Math.min(k.polomer, L / 2 - 0.5, W / 2 - 0.5)), cx: k.posun };
  }
  /** Obrys půdorysu odsazený o d (mm, kladné ven) – konvexní mnohoúhelník CCW; stejný počet vrcholů pro každé d
      (smyčky stěn se pak sešijí bod na bod). K = úseků na roh. */
  function obrys(T, d, K) {
    const a = T.L / 2 + d, b = T.W / 2 + d, r = Math.max(0.3, Math.min(T.rr + d, a, b));
    const nulaH = T.tvar === 'kruh', nulaV = T.tvar !== 'obdelnik';   // vodorovné / svislé rovné úseky nulové délky
    const rohy = [[1, 1], [-1, 1], [-1, -1], [1, -1]], out = [];
    rohy.forEach(([sx, sy], i) => {
      const cx = T.cx + sx * (a - r), cy = sy * (b - r);
      for (let j = 0; j <= K; j++) {
        if (j === 0 && ((i % 2 === 0 && nulaV) || (i % 2 === 1 && nulaH))) continue;
        const u = Math.PI / 2 * (i + j / K);
        out.push([cx + r * Math.cos(u), cy + r * Math.sin(u)]);
      }
    });
    return out;
  }
  const useku = T => Math.max(6, Math.min(36, Math.ceil(T.rr * Math.PI / 2 / 1.6)));
  /** Délka obrysu odsazeného o d. */
  function obvod(T, d) {
    const a = T.L / 2 + d, b = T.W / 2 + d, r = Math.max(0.3, Math.min(T.rr + d, a, b));
    return 4 * (a - r) + 4 * (b - r) + 2 * Math.PI * r;
  }
  /** Paprsek z bodu P ve směru u: vzdálenost k obrysu (konvexní mnohoúhelník, P uvnitř); −1 když nic. */
  function paprsek(poly, P, u) {
    let t = -1;
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length];
      const ex = B[0] - A[0], ey = B[1] - A[1], den = u[0] * ey - u[1] * ex;
      if (Math.abs(den) < 1e-12) continue;
      const qx = A[0] - P[0], qy = A[1] - P[1];
      const tt = (qx * ey - qy * ex) / den, s = (qx * u[1] - qy * u[0]) / den;
      if (s >= -1e-9 && s <= 1 + 1e-9 && tt > t) t = tt;
    }
    return t;
  }
  const opora = (poly, u) => Math.max(...poly.map(q => q[0] * u[0] + q[1] * u[1]));
  /** Nejmenší vzdálenost bodu od obrysu (bod uvnitř). */
  function vzdalenostObrysu(poly, P) {
    let m = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length], ex = B[0] - A[0], ey = B[1] - A[1];
      const t = Math.max(0, Math.min(1, ((P[0] - A[0]) * ex + (P[1] - A[1]) * ey) / (ex * ex + ey * ey || 1)));
      m = Math.min(m, Math.hypot(A[0] + t * ex - P[0], A[1] + t * ey - P[1]));
    }
    return m;
  }
  const uvnitr = (poly, P) => poly.every((A, i) => { const B = poly[(i + 1) % poly.length]; return (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]) >= -1e-9; });
  /** Ořízne konvexní mnohoúhelník polorovinou n·x ≤ c. */
  function orizni(poly, n, c) {
    const out = [], f = q => q[0] * n[0] + q[1] * n[1] - c;
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length], fa = f(A), fb = f(B);
      if (fa <= 0) out.push(A);
      if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]); }
    }
    return out;
  }
  /** Body rozmístěné rovnoměrně po obvodu mnohoúhelníku: n bodů od fáze f (0–1); vrací [x, y, nx, ny] (vnější normála). */
  function poObvodu(poly, n, f = 0) {
    const del = [], m = poly.length;
    let P = 0;
    for (let i = 0; i < m; i++) { const A = poly[i], B = poly[(i + 1) % m]; del.push(Math.hypot(B[0] - A[0], B[1] - A[1])); P += del[i]; }
    const out = [];
    for (let k = 0; k < n; k++) {
      let s = ((f + k / n) % 1) * P, i = 0;
      while (i < m - 1 && s > del[i]) { s -= del[i]; i++; }
      const A = poly[i], B = poly[(i + 1) % m], t = del[i] > 0 ? s / del[i] : 0, l = del[i] || 1;
      out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1]), (B[1] - A[1]) / l, -(B[0] - A[0]) / l]);
    }
    return out;
  }

  /* ---------------- odvozené rozměry ---------------- */
  /** Průřezy vývodu (poloměry v ose hrdla). */
  function hrdlo(v) {
    const dk = Math.tan(rad(v.kuzel)) * v.delka;
    if (v.usazeni === 'zasun') {
      const rs = v.prumer / 2 + v.vule, rs0 = rs - dk / 2, rs1 = rs + dk / 2;    // koncovka: hrdlo se k ústí rozšiřuje
      const rn = Math.max(1, rs0 - v.doraz), ro = rs1 + v.stena;
      return { zasun: true, rs0, rs1, rn, ro, rb: rn, roMax: ro, prumerHadice: v.prumer };
    }
    const os = v.prumer / 2 - v.vule, os0 = os + dk / 2, os1 = os - dk / 2;       // navlékaná hadice: hrdlo se k ústí zužuje
    const on = os0 + v.doraz, ri = Math.max(1, os1 - v.stena);
    return { zasun: false, os0, os1, on, ri, rb: ri, ro: on, roMax: on, prumerHadice: v.prumer };
  }
  /** Profil hrdla (r, s) podél osy: vnějšek a vrtání; sO = začátek vnějšku, sB = začátek vrtání, sN = začátek hrdla, sE = ústí. */
  function profilHrdla(h, sO, sB, sN, sE) {
    const ven = h.zasun
      ? [[0, sO], [h.ro, sO], [h.ro, sE], [0, sE]]
      : [[0, sO], [h.on, sO], [h.on, sN - (h.on - h.os0)], [h.os0, sN], [h.os1, sE - 0.8], [h.os1 - 0.8, sE], [0, sE]];
    const vrt = h.zasun
      ? [[0, sB], [h.rn, sB], [h.rn, sN - (h.rs0 - h.rn)], [h.rs0, sN], [h.rs1, sE], [h.rs1, sE + 1], [0, sE + 1]]
      : [[0, sB], [h.ri, sB], [h.ri, sE + 1], [0, sE + 1]];
    const bez = b => b.filter((q, i) => i === 0 || Math.hypot(q[0] - b[i - 1][0], q[1] - b[i - 1][1]) > 1e-6);
    return { ven: bez(ven), vrt: bez(vrt) };
  }

  /** Všechny odvozené rozměry; o.chyby = důvody, proč nejde sestavit (kontroly je hlásí srozumitelně). */
  function odvozene(p) {
    const k = p.komora, ob = p.objimka, kc = p.kartac, u = p.uchyceni, v = p.vyvod;
    const o = { chyby: [] };
    o.T = tvarKomory(k); o.K = useku(Object.assign({}, o.T, { rr: o.T.rr + k.stena + k.priruba }));
    o.Rb = (p.vreteno.prumer + p.vreteno.vule) / 2;
    o.Rring = o.Rb + ob.stena;
    o.t = k.stena; o.f = k.priruba; o.hfl = k.prirubaVyska; o.tp = ob.deska;
    // kartáč: drážka ve spodní liště komory (osa drážky = osa stěny)
    o.wg = kc.pasek + kc.vule; o.hd = kc.hloubka; o.sL = 1.6;
    o.dc = o.t / 2;
    o.dOut = Math.max(o.t, o.dc + o.wg / 2 + o.sL); o.dIn = Math.min(0, o.dc - o.wg / 2 - o.sL);
    o.hL = o.hd + 1.2;
    o.nabehVen = o.dOut - o.t; o.nabehDovnitr = -o.dIn;
    o.zTip = -p.vreteno.vylozeni;
    o.zBr = o.zTip - kc.presah;                        // konec vlasu / lamel
    o.Lv = kc.vlas - o.hd;                              // viditelná délka vlasu
    o.zkb = o.zBr + o.Lv;                               // spodek komory
    o.zpb = ob.odsazeni; o.zpt = o.zpb + o.tp; o.zTop = o.zpt + ob.vyska;
    o.Hk = o.zpb - o.zkb;
    o.zLipTop = o.zkb + o.hL + Math.max(o.nabehVen, o.nabehDovnitr);
    o.zfb0 = o.zpb - o.hfl - o.f;                       // kde začíná sražení 45° pod přírubou
    if (o.zfb0 < o.zLipTop) o.chyby.push({ druh: 'vyska', chybi: o.zLipTop - o.zfb0 });
    o.obvodKartace = obvod(o.T, o.dc);
    o.lipVnitrni = vzdalenostObrysu(obrys(o.T, o.dIn, o.K), [0, 0]);   // volno od osy vřetene k liště
    if (!uvnitr(obrys(o.T, o.dIn, o.K), [0, 0])) o.lipVnitrni = -1;
    o.vrtaniKomory = obrys(o.T, 0, o.K);
    // magnety
    o.mR = (u.prumer + u.vule) / 2; o.mH = u.vyska + (u.montaz === 'lis' ? 0.1 : 0.3);
    o.dm = (o.t + o.f) / 2;                             // osa magnetů = střed plochy příruby (od vnitřní stěny po okraj)
    // objímka – šroub
    const s = SROUBY[ob.sroub];
    o.sroub = s; o.psiC = rad(ob.natoceni);
    o.sw = ob.sterbina;
    o.rS = o.Rb + 1.5 + (s.s + 0.3) / 2;               // osa šroubu od osy vřetene
    o.ucho = { wh: Math.max(5, s.d * 1.2), wn: s.m + 0.3 + 3.6 };
    o.ucho.r1 = o.rS + (s.s + 0.3) / 2 + 2;
    o.zS = o.zpt + ob.vyska / 2;
    o.Esroub = s.s / Math.cos(Math.PI / 6);
    o.delkaPotrebna = o.ucho.wh + o.sw + o.ucho.wn / 2 + s.m / 2 + 1;
    o.delkaSroubu = DELKY.find(x => x >= o.delkaPotrebna) || DELKY[DELKY.length - 1];
    // vývod
    o.h = hrdlo(v);
    o.alfa = rad(v.sklon);
    o.psiV = rad(v.natoceni);
    o.u = [Math.cos(o.psiV), Math.sin(o.psiV)]; o.v = [-o.u[1], o.u[0]];
    if (v.umisteni === 'deska') vyvodDeska(p, o); else vyvodBok(p, o);
    // zásuvné vedení: komora se vysouvá ve směru vývodu, deska vyjíždí na opačnou stranu, doraz u vývodu
    if (u.typ === 'zasuv') {
      o.zas = { vz: u.vuleZasuvu, wr: u.lista, c: Math.min(1.5, o.tp - 1.2), lt: 1.6 };
      const dp = o.t + o.f - o.zas.vz - o.zas.wr - 0.5;
      o.zas.dp = dp;
      if (dp < o.t + 1.5) o.chyby.push({ druh: 'zasuv', chybi: o.t + 1.5 - dp });
      const P = obrys(o.T, dp, o.K);
      o.zas.Yl = opora(P, o.v); o.zas.Yp = opora(P, [-o.v[0], -o.v[1]]); o.zas.Xf = opora(P, o.u);
      const Pf = obrys(o.T, o.t + o.f, o.K);
      // délka lišty = tětiva vnějšku příruby ve vzdálenosti vnitřní hrany lišty
      const tetiva = Y => { let a = Infinity, b = -Infinity; for (let i = 0; i < Pf.length; i++) { const A = Pf[i], B = Pf[(i + 1) % Pf.length]; const ya = A[0] * o.v[0] + A[1] * o.v[1], yb = B[0] * o.v[0] + B[1] * o.v[1]; if ((ya - Y) * (yb - Y) <= 0 && ya !== yb) { const t = (Y - ya) / (yb - ya), x = (A[0] + t * (B[0] - A[0])) * o.u[0] + (A[1] + t * (B[1] - A[1])) * o.u[1]; a = Math.min(a, x); b = Math.max(b, x); } } return b > a ? b - a : 0; };
      o.zas.delkaListy = Math.min(tetiva(o.zas.Yl + o.zas.vz + o.zas.wr), tetiva(-(o.zas.Yp + o.zas.vz + o.zas.wr)));
    }
    o.magnety = u.typ === 'magnety' ? rozmistiMagnety(p, o) : { body: [], vynechano: 0 };
    return o;
  }

  /** Vývod z desky: hrdlo šikmo nahoru (sklon od vodorovné), pata na desce ve vzdálenosti rp od osy vřetene ve směru u. */
  function vyvodDeska(p, o) {
    const h = o.h, a = o.alfa, sa = Math.sin(a), ca = Math.cos(a), cot = ca / Math.max(sa, 1e-6);
    // meze polohy paty (vzdálenost středu vrtání na spodku desky od osy vřetene)
    const rDut = paprsek(o.vrtaniKomory, [0, 0], o.u);
    const minOd = Math.max(o.Rb + 1.5 + h.rb / sa, o.Rring + 0.3 + h.roMax / sa - o.tp * cot);
    const maxDo = rDut - 0.5 - h.rb / sa;
    o.vyvodMeze = [minOd, maxDo];
    if (minOd > maxDo) o.chyby.push({ druh: 'vyvodDeska', chybi: minOd - maxDo });
    o.rp = minOd <= maxDo ? (minOd + maxDo) / 2 : minOd;
    // boční místo v komoře u paty
    const P = [o.u[0] * o.rp, o.u[1] * o.rp];
    o.vyvodBokem = Math.min(paprsek(o.vrtaniKomory, P, o.v), paprsek(o.vrtaniKomory, P, [-o.v[0], -o.v[1]])) - h.rb;
    o.base = [P[0], P[1], o.zpb];
    o.sO = -(h.roMax * ca + 0.3) / Math.max(sa, 0.05); o.sB = o.sO - 1;
    o.sN = (o.tp + 2 + (h.roMax + 2) * ca) / Math.max(sa, 0.05);
    o.sE = o.sN + p.vyvod.delka;
    o.usti = bodNaOse(o, o.sE);
  }
  /** Vývod z boku: osa prochází vnější stěnou ve výšce zAxis, volitelně posunutá do strany (tečný vstup). */
  function vyvodBok(p, o) {
    const h = o.h, a = o.alfa, sa = Math.sin(a), ca = Math.max(Math.cos(a), 0.2), ta = sa / ca;
    const Pin = o.vrtaniKomory, Pout = obrys(o.T, o.t, o.K);
    const sg = p.vyvod.tecny === 'vlevo' ? 1 : p.vyvod.tecny === 'vpravo' ? -1 : 0;
    o.e = sg ? sg * Math.max(0, (sg > 0 ? opora(Pin, o.v) : opora(Pin, [-o.v[0], -o.v[1]])) - h.rb - 0.8) : 0;
    const bodLat = l => [o.v[0] * l, o.v[1] * l];
    const Ro = paprsek(Pout, bodLat(o.e), o.u);
    const Ri = l => paprsek(Pin, bodLat(l), o.u);
    o.Ro_e = Ro;
    // vrtání začíná v dutině (střed čela kus za vnitřní stěnou); co z něj leží mimo dutinu, obaluje vnějšek hrdla
    o.sB = (Ri(o.e) - Ro - h.rb * sa - 0.8) / ca;
    o.sO = o.sB - 1.2;
    // konec hrdla v komoře: svislá rovina za vrtáním (čelo kolmé na osu by převisalo), vnějšek začíná dost daleko za ní
    const P = bodLat(o.e), bu = P[0] * o.u[0] + P[1] * o.u[1] + Ro;
    o.rovina = bu + o.sB * ca - h.rb * sa - 1.2;
    o.sO2 = o.sB - (h.roMax * sa + h.rb * sa + 2) / ca;
    // výška osy: hrdlo smí s přírubou komory splynout, ale pod deskou (a pod kapsami magnetů) musí zůstat – měřeno po povrchu hrdla
    const Pf = obrys(o.T, o.t + o.f, o.K), n2 = [-o.u[0] * sa, -o.u[1] * sa, ca];
    const bodPlaste = (s, fi, r) => [P[0] + o.u[0] * (Ro + s * ca) + o.v[0] * Math.cos(fi) * r + n2[0] * Math.sin(fi) * r,
      P[1] + o.u[1] * (Ro + s * ca) + o.v[1] * Math.cos(fi) * r + n2[1] * Math.sin(fi) * r];
    // hrdlo pro hadici začíná, až je celé (i s hadicí) za obrysem příruby – pod deskou by hadice narazila do příruby
    let sN = 0;
    while (sN < 600 && Array.from({ length: 32 }, (_, i) => bodPlaste(sN, 2 * Math.PI * i / 32, h.roMax + 2)).some(q => uvnitr(Pf, q))) sN += 0.5;
    o.sN = sN + 1; o.sE = o.sN + p.vyvod.delka;
    let maxZ = -Infinity;
    for (let s = o.sO2; s <= o.sE; s += 1) for (let i = 0; i < 32; i++) {
      const fi = 2 * Math.PI * i / 32, d = Math.sin(fi) * h.roMax, [x, y] = bodPlaste(s, fi, h.roMax);
      if (x * o.u[0] + y * o.u[1] < o.rovina || !uvnitr(Pf, [x, y])) continue;
      maxZ = Math.max(maxZ, s * sa + n2[2] * d);
    }
    const horni = o.zpb - (p.uchyceni.typ === 'magnety' ? o.mH : 0) - 0.8 - maxZ;
    const dolni = Math.max(o.zLipTop + 0.5 - o.sB * sa + h.rb * Math.cos(a), o.zkb + 0.5 + h.roMax / ca);
    o.zAxis = horni;
    o.vyvodMeze = [dolni, horni];
    if (dolni > horni) o.chyby.push({ druh: 'vyvodBok', chybi: dolni - horni });
    o.base = [P[0] + o.u[0] * Ro, P[1] + o.u[1] * Ro, o.zAxis];
    o.usti = bodNaOse(o, o.sE);
  }
  const bodNaOse = (o, s) => [o.base[0] + o.u[0] * Math.cos(o.alfa) * s, o.base[1] + o.u[1] * Math.cos(o.alfa) * s, o.base[2] + Math.sin(o.alfa) * s];

  /** Magnety po obvodu příruby; fáze se hledá tak, aby žádný nepadl do štěrbiny objímky ani do vývodu desky. */
  function rozmistiMagnety(p, o) {
    const n = p.uchyceni.pocet, poly = obrys(o.T, o.dm, o.K);
    const kolize = ([x, y]) => {
      if (p.objimka.upnuti === 'sroub') {   // štěrbina od osy ve směru uší
        const cx = Math.cos(o.psiC), cy = Math.sin(o.psiC), pr = x * cx + y * cy, kol = Math.abs(-x * cy + y * cx);
        if (pr > 0 && kol < o.mR + o.sw / 2 + 1.5) return true;
      }
      if (p.vyvod.umisteni === 'deska') {
        const sa = Math.sin(o.alfa), cot = Math.cos(o.alfa) / Math.max(sa, 1e-6);
        const c0 = [o.base[0], o.base[1]], c1 = [o.base[0] + o.u[0] * o.tp * cot, o.base[1] + o.u[1] * o.tp * cot];
        for (const c of [c0, c1]) if (Math.hypot(x - c[0], y - c[1]) < o.mR + o.h.rb / sa + 1.5) return true;
      }
      return false;
    };
    let nej = null;
    for (let i = 0; i < 48; i++) {
      const body = poObvodu(poly, n, i / 48 / n), spatne = body.filter(kolize).length;
      if (!nej || spatne < nej.spatne) nej = { body, spatne };
      if (!spatne) break;
    }
    return { body: nej.body.filter(b => !kolize(b)), vynechano: nej.spatne };
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), k = p.komora, u = p.uchyceni, kc = p.kartac, v = p.vyvod, ob = p.objimka;
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = (c, h) => ({ zmeny: { [c]: Math.round(h * 10) / 10 } });
    const rozmerKomory = k.tvar === 'kruh' ? 'komora.prumer' : 'komora.delka';
    for (const ch of o.chyby) {
      if (ch.druh === 'vyska') chyba(['objimka.odsazeni', 'kartac.vlas', 'vreteno.vylozeni'], `Komora je nízká: mezi lištou kartáče a přírubou chybí ${fmt(ch.chybi, 1)} mm (komora ${fmt(o.Hk, 1)} mm). Posuňte objímku výš po vřetenu, prodlužte vlas nebo zmenšete přírubu.`, opr('objimka.odsazeni', ob.odsazeni + Math.ceil(ch.chybi)));
      if (ch.druh === 'vyvodDeska') chyba(['vyvod.prumer', rozmerKomory, 'komora.posun', 'vyvod.sklon'], `Vývod Ø ${fmt(v.prumer)} se nevejde mezi objímku a stěnu komory – chybí ${fmt(ch.chybi, 1)} mm. Prodlužte komoru směrem k vývodu (posun), zmenšete hadici nebo zvětšete sklon.`,
        opr(rozmerKomory, (k.tvar === 'kruh' ? k.prumer : k.delka) + 2 * Math.ceil(ch.chybi + 1)));
      if (ch.druh === 'vyvodBok') chyba(['objimka.odsazeni', 'vyvod.prumer', 'vyvod.sklon'], `Boční vývod Ø ${fmt(v.prumer)} se nevejde do výšky komory – chybí ${fmt(ch.chybi, 1)} mm. Posuňte objímku výš (komora bude vyšší) nebo zmenšete hadici.`, opr('objimka.odsazeni', ob.odsazeni + Math.ceil(ch.chybi + 0.5)));
      if (ch.druh === 'zasuv') chyba(['komora.priruba', 'uchyceni.lista'], `Na přírubě ${fmt(k.priruba)} mm se nevejde lišta zásuvného vedení ${fmt(u.lista)} mm s vůlí – rozšiřte přírubu.`, opr('komora.priruba', k.priruba + Math.ceil(ch.chybi + 1)));
    }
    if (o.lipVnitrni < o.Rb + 2) chyba(['komora.posun', rozmerKomory, 'komora.sirka'], `Vřeteno Ø ${fmt(p.vreteno.prumer)} se nevejde do otvoru v liště kartáče – zvětšete komoru nebo upravte posun.`);
    else if (o.lipVnitrni < o.Rb + 6) var_(['komora.posun', 'komora.sirka'], `Mezi vřetenem a lištou kartáče zbývá jen ${fmt(o.lipVnitrni - p.vreteno.prumer / 2, 1)} mm – třísky se tam ucpou.`);
    if (k.tvar === 'oval' && k.delka < k.sirka + 1) info(['komora.delka'], 'U oválu je délka menší než šířka – počítá se s délkou o 1 mm větší než šířka.');
    if (k.tvar === 'obdelnik' && k.polomer < 5) info(['komora.polomer'], 'Ostré rohy komory zachytávají prach – poloměr rohu aspoň 5 mm.');
    if (o.chyby.some(c => c.druh === 'vyska')) return H;
    // objímka
    const s = o.sroub;
    if (ob.upnuti === 'sroub') {
      if (ob.vyska < o.Esroub + 6) chyba(['objimka.vyska', 'objimka.sroub'], `Objímka ${fmt(ob.vyska)} mm je na matici ${ob.sroub} nízká – aspoň ${fmt(Math.ceil(o.Esroub + 6))} mm.`, opr('objimka.vyska', Math.ceil(o.Esroub + 6)));
      if (ob.sterbina < 1) var_(['objimka.sterbina'], 'Štěrbina pod 1 mm se při tisku zalije.', opr('objimka.sterbina', 1.5));
    } else if (ob.stena < 2.8) var_(['objimka.stena'], `Se štěrbinami a drážkou pro sponu potřebuje stěna objímky aspoň 2,8 mm.`, opr('objimka.stena', 3));
    if (ob.vyska < 15) var_(['objimka.vyska'], `Výška upnutí ${fmt(ob.vyska)} mm je malá – botka se bude na vřetenu kývat.`, opr('objimka.vyska', 20));
    if (ob.stena < 2.4) var_(['objimka.stena'], `Stěna objímky ${fmt(ob.stena, 1)} mm je tenká.`, opr('objimka.stena', 3));
    if (p.vreteno.vule < 0) var_(['vreteno.vule'], 'Záporná vůle – objímka půjde na vřeteno jen nasilu.');
    if (ob.upnuti === 'pasek' && p.vreteno.vule > 0.6) var_(['vreteno.vule'], `Vůle ${fmt(p.vreteno.vule, 2)} mm je na stažení sponou velká – vytiskněte zkušební kroužek.`);
    // kartáč
    if (o.Lv < 6) chyba(['kartac.vlas', 'kartac.hloubka'], `Z drážky vyčnívá jen ${fmt(o.Lv, 1)} mm ${kc.typ === 'tpu' ? 'lamel' : 'vlasu'} – prodlužte ho nebo změlčete drážku.`, opr('kartac.hloubka', Math.max(3, kc.vlas - 15)));
    if (kc.typ === 'pasek' && o.hd < 5) var_(['kartac.hloubka'], 'Mělká drážka – pásek kartáče z ní bude vypadávat (aspoň 5 mm).');
    if (kc.presah < 0) info(['kartac.presah'], 'Kartáč končí nad špičkou nástroje – při zanoření se ho obrobek nedotkne hned.');
    if (kc.presah > 10) var_(['kartac.presah'], `Kartáč přečnívá ${fmt(kc.presah)} mm pod špičku – bude se ohýbat a tlačit na obrobek.`);
    if (kc.typ === 'tpu' && kc.pasek < 1.6) var_(['kartac.pasek'], 'Sukně z TPU tenčí než 1,6 mm se snadno utrhne.');
    if (kc.typ === 'tpu' && kc.sterbina >= kc.lamela * 0.5) var_(['kartac.sterbina', 'kartac.lamela'], 'Štěrbiny mezi lamelami jsou široké – sukně nebude těsnit.');
    if (kc.vule < 0 && kc.typ === 'pasek') info(['kartac.vule'], 'Záporná vůle drážky – pásek se do ní bude zatloukat.');
    // magnety / zásuv
    if (u.typ === 'magnety') {
      const plocha = o.t + o.f;
      if (2 * o.mR + 2.4 > plocha) chyba(['uchyceni.prumer', 'komora.priruba'], `Magnet Ø ${fmt(u.prumer)} se nevejde na přírubu (plocha ${fmt(plocha, 1)} mm se stěnou) – rozšiřte přírubu nebo zmenšete magnet.`, opr('komora.priruba', Math.ceil(2 * o.mR + 2.4 - o.t + 0.5)));
      if (o.mH > o.tp - 0.8) chyba(['objimka.deska', 'uchyceni.vyska'], `Kapsa magnetu (${fmt(o.mH, 1)} mm) je na desku ${fmt(o.tp)} mm hluboká – zesilte desku.`, opr('objimka.deska', Math.ceil(o.mH + 1)));
      if (o.mH > o.hfl + o.f / 2 - 0.8) chyba(['komora.prirubaVyska', 'uchyceni.vyska'], 'Kapsa magnetu v přírubě komory je hlubší než příruba.', opr('komora.prirubaVyska', Math.ceil(o.mH + 1)));
      if (o.magnety.vynechano) var_(['uchyceni.pocet'], `${o.magnety.vynechano} z ${u.pocet} magnetů by padlo do štěrbiny objímky nebo vývodu – vynechány (zbývá ${o.magnety.body.length}).`);
      if (o.magnety.body.length < 3) chyba(['uchyceni.pocet'], 'Komoru drží méně než 3 magnety – bude se viklat.', opr('uchyceni.pocet', u.pocet + 2));
      if (u.montaz === 'lis' && u.vule > 0.1) var_(['uchyceni.vule', 'uchyceni.montaz'], `Na zalisování je vůle ${fmt(u.vule, 2)} mm velká – magnet vypadne (zkuste 0 až 0,05, ověřte kalibrací).`, opr('uchyceni.vule', 0.05));
      if (u.montaz === 'lepeni' && u.vule < 0.1) info(['uchyceni.vule'], 'Na lepení nechte vůli aspoň 0,1 mm, jinak lepidlo vytlačí magnet ven.');
    } else if (o.zas) {
      if (o.zas.c < 0.8) chyba(['objimka.deska'], 'Deska je na zásuvné vedení tenká (aspoň 2,5 mm).', opr('objimka.deska', 4));
      if (o.zas.delkaListy < 20 && !o.chyby.length) var_(['komora.tvar', 'komora.priruba'], `Lišty zásuvného vedení vycházejí krátké (${fmt(o.zas.delkaListy, 0)} mm) – u kruhu je lepší ovál nebo obdélník, případně širší příruba.`);
    }
    // vývod
    const h = o.h;
    if (v.sklon < p.tisk.uhel - 0.5 && v.umisteni) var_(['vyvod.sklon', 'tisk.uhel'], `Vývod se sklonem ${fmt(v.sklon)}° od vodorovné převisá víc než ${fmt(p.tisk.uhel)}° – bez podpor ho tiskárna nezvládne. Sklon aspoň ${fmt(90 - p.tisk.uhel)}°.`, opr('vyvod.sklon', 90 - p.tisk.uhel));
    if (v.umisteni === 'bok' && v.sklon > 75) var_(['vyvod.sklon'], 'Boční vývod strměji než 75° už je skoro svislý – použijte vývod z desky.', { zmeny: { 'vyvod.umisteni': 'deska' } });
    if (v.delka < 15) var_(['vyvod.delka'], `Hrdlo ${fmt(v.delka)} mm je krátké – hadice nebude držet (aspoň 20 mm).`, opr('vyvod.delka', 20));
    if (v.stena < 1.6) var_(['vyvod.stena'], `Stěna hrdla ${fmt(v.stena, 1)} mm je tenká.`, opr('vyvod.stena', 2));
    if (!h.zasun && h.ri * 2 < v.prumer * 0.7) var_(['vyvod.stena', 'vyvod.kuzel'], `Navlékané hrdlo zúží průchod na Ø ${fmt(2 * h.ri, 1)} mm – velká ztráta.`);
    if (v.doraz === 0) info(['vyvod.doraz'], 'Bez dorazu hadice v hrdle nemá kde skončit.');
    if (v.umisteni === 'deska') {
      if (v.tecny !== 'osa') info(['vyvod.tecny'], 'Tečný vstup se uplatní jen u vývodu z boku komory.');
      if (!o.chyby.some(c => c.druh === 'vyvodDeska') && o.vyvodBokem < 0.5) chyba(['vyvod.prumer', 'komora.sirka'], `Otvor vývodu Ø ${fmt(2 * h.rb, 1)} je širší než komora u paty – rozšiřte komoru.`, opr('komora.sirka', Math.ceil(k.sirka + 2 * (1 - o.vyvodBokem))));
      if (ob.upnuti === 'sroub') {
        let dv = Math.abs(((ob.natoceni - v.natoceni) % 360 + 540) % 360 - 180);
        if (dv < 45) chyba(['objimka.natoceni', 'vyvod.natoceni'], `Uši objímky (${fmt(ob.natoceni)}°) jsou moc blízko vývodu (${fmt(v.natoceni)}°) – otočte je na druhou stranu.`, opr('objimka.natoceni', v.natoceni + 180));
      }
    } else {
      if (v.tecny !== 'osa' && Math.abs(o.e) < 1) info(['vyvod.tecny'], 'Komora je na tečný vstup úzká – vývod zůstal v ose.');
    }
    if (u.typ === 'magnety' && p.objimka.upnuti === 'sroub') info(['uchyceni.montaz'], 'Magnety v desce a v komoře vložte s opačnou polaritou (vyzkoušejte, že se přitahují).');
    return H;
  }

  /* ---------------- stavba těles ---------------- */
  /** Sestaví díly přes manifold-3d → {dily: [objímka, komora, (sukně)], vizual: [vřeteno, kartáč], kalibrace: [], o, prunik, cas}. */
  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p);
    if (o.chyby.length) throw new Error('rozměry nejdou sestavit (' + o.chyby.map(c => c.druh).join(', ') + ')');
    const { Manifold: M, CrossSection: CS, Mesh } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const segmenty = r => Math.max(32, Math.min(144, Math.ceil(2 * Math.PI * r / 1.2 / 4) * 4));

    /** Smyčky obrysů (stejný počet vrcholů) sešité do uzavřeného tělesa. vrstvy = [[d, z], …] zdola nahoru. */
    function loft(vrstvy, T = o.T) {
      const kr = vrstvy.filter((q, i) => i === 0 || q[0] !== vrstvy[i - 1][0] || q[1] !== vrstvy[i - 1][1]);
      const kruhy = kr.map(([d]) => obrys(T, d, o.K)), n = kruhy[0].length, m = kr.length;
      const V = new Float32Array(n * m * 3), I = [];
      kruhy.forEach((poly, i) => poly.forEach(([x, y], j) => { const q = 3 * (i * n + j); V[q] = x; V[q + 1] = y; V[q + 2] = kr[i][1]; }));
      for (let i = 0; i < m - 1; i++) for (let j = 0; j < n; j++) {
        const a = i * n + j, b = i * n + (j + 1) % n, c = (i + 1) * n + (j + 1) % n, d = (i + 1) * n + j;
        I.push(a, b, c, a, c, d);
      }
      const t = (m - 1) * n;
      for (let j = 1; j < n - 1; j++) I.push(0, j + 1, j, t, t + j, t + j + 1);
      const mm = k(new M(new Mesh({ numProp: 3, vertProperties: V, triVerts: new Uint32Array(I) })));
      if (mm.status() !== 'NoError') throw new Error('obrys komory: ' + mm.status());
      return mm;
    }
    const hranol = (poly, z0, z1) => k(k(k(new CS([poly], 'Positive')).extrude(z1 - z0)).translate([0, 0, z0]));
    const valec = (r, z0, z1, x = 0, y = 0, n) => k(k(M.cylinder(z1 - z0, r, r, n || segmenty(r))).translate([x, y, z0]));
    const kvadr = (x0, y0, z0, x1, y1, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const otoc = body => k(k(new CS([body], 'Positive')).revolve(segmenty(Math.max(...body.map(q => q[0])))));
    const natoc = (m, stupne) => k(m.rotate([0, 0, stupne]));
    const rozdil = (a, b) => (b.length ? k(M.difference([a, ...b])) : a);
    const sjednot = a => (a.length > 1 ? k(M.union(a)) : a[0]);
    /** Hrdlo v osách vývodu: profil (r, s) → rotace osy z → směr (u, sklon) → posun na patu. */
    function hrdloTeleso(profil) {
      return k(k(k(otoc(profil).rotate([0, 90 - p.vyvod.sklon, 0])).rotate([0, 0, p.vyvod.natoceni])).translate(o.base));
    }
    const prof = profilHrdla(o.h, o.sO, o.sB, o.sN, o.sE);

    try {
      /* ---- komora ---- */
      const vnejsek = [[o.dOut, o.zkb], [o.dOut, o.zkb + o.hL], [o.t, o.zkb + o.hL + o.nabehVen], [o.t, o.zfb0], [o.t + o.f, o.zfb0 + o.f], [o.t + o.f, o.zpb]];
      const dutina = [[o.dIn, o.zkb - 1], [o.dIn, o.zkb + o.hL], [0, o.zkb + o.hL + o.nabehDovnitr], [0, o.zpb + 1]];
      let komora = loft(vnejsek);
      const plneK = [], odebK = [loft(dutina)];
      if (p.vyvod.umisteni === 'bok') {
        // konec hrdla v komoře seříznutý svislou rovinou (čelo kolmé na osu by převisalo); vrtání zůstává uvnitř vnějšku
        const ven = hrdloTeleso(profilHrdla(o.h, o.sO2, o.sB, o.sN, o.sE).ven), rovina = o.rovina;
        plneK.push(k(ven.intersect(natoc(kvadr(rovina, -4000, -4000, 4000, 4000, 4000), p.vyvod.natoceni))));
      }
      if (plneK.length) komora = sjednot([komora, ...plneK]);
      if (p.vyvod.umisteni === 'bok') odebK.push(hrdloTeleso(prof.vrt));
      // drážka kartáče
      odebK.push(k(M.difference([loft([[o.dc + o.wg / 2, o.zkb - 1], [o.dc + o.wg / 2, o.zkb + o.hd]]), loft([[o.dc - o.wg / 2, o.zkb - 1.5], [o.dc - o.wg / 2, o.zkb + o.hd + 0.5]])])));
      for (const [x, y] of o.magnety.body) odebK.push(valec(o.mR, o.zpb - o.mH, o.zpb + 1, x, y, segmenty(o.mR)));
      komora = rozdil(komora, odebK);
      if (o.zas) komora = sjednot([komora, ...listyZasuvu()]);
      komora = k(komora.intersect(kvadr(-2000, -2000, o.zkb, 2000, 2000, 2000)));

      /* ---- objímka ---- */
      let deska = o.zas ? zasuvDeska() : obrys(o.T, o.t + o.f, o.K);
      const plneO = [hranol(deska, o.zpb, o.zpt), valec(o.Rring, o.zpb, o.zTop)], odebO = [];
      const psiC = p.objimka.natoceni;
      if (p.objimka.upnuti === 'sroub') {
        const s = o.sroub, U = o.ucho;
        plneO.push(natoc(kvadr(o.Rb + 0.8, -(o.sw / 2 + U.wn), o.zpt, U.r1, o.sw / 2 + U.wh, o.zTop), psiC));
        odebO.push(natoc(kvadr(0, -o.sw / 2, o.zpb - 1, 4000, o.sw / 2, o.zTop + 1), psiC));
        // kapkový otvor šroubu (vodorovně, špička nahoru) přes obě uši
        const rh = s.otvor / 2, kapka = [];
        kapka.push([rh * Math.SQRT1_2, rh * Math.SQRT1_2], [0, rh * Math.SQRT2]);
        for (let i = 0; i <= 24; i++) { const a = Math.PI * 3 / 4 + i / 24 * Math.PI * 3 / 2; kapka.push([rh * Math.cos(a), rh * Math.sin(a)]); }
        kapka.pop();
        const delka = 2 * (U.wh + U.wn + o.sw) + 2;
        const otvor = k(k(k(k(new CS([kapka], 'Positive')).extrude(delka)).translate([0, 0, -delka / 2])).rotate([90, 0, 0]));
        odebO.push(natoc(k(otvor.translate([o.rS, 0, o.zS])), psiC));
        // kapsa matice shora: matice padá plochami ke stěnám, dosedne rohem v ose šroubu
        const yN = -(o.sw / 2 + U.wn / 2);
        odebO.push(natoc(kvadr(o.rS - (s.s + 0.3) / 2, yN - (s.m + 0.3) / 2, o.zS - o.Esroub / 2 - 0.15, o.rS + (s.s + 0.3) / 2, yN + (s.m + 0.3) / 2, o.zTop + 1), psiC));
      } else {
        // 4 štěrbiny shora + drážka pro sponu se sražením 45° nahoře
        for (let i = 0; i < 4; i++) odebO.push(natoc(kvadr(o.Rb - 1, -0.75, o.zpt + 2, o.Rring + 1, 0.75, o.zTop + 1), psiC + 45 + 90 * i));
        const gd = 1, zb0 = o.zpt + p.objimka.vyska / 2 - p.objimka.sirkaSpony / 2 - 0.5, zb1 = zb0 + p.objimka.sirkaSpony + 1;
        odebO.push(otoc([[o.Rring - gd, zb0], [o.Rring + 1, zb0], [o.Rring + 1, zb1 + gd + 1], [o.Rring - gd, zb1]]));
      }
      if (p.vyvod.umisteni === 'deska') {
        plneO.push(k(hrdloTeleso(prof.ven).intersect(kvadr(-2000, -2000, o.zpb, 2000, 2000, 2000))));
        odebO.push(hrdloTeleso(prof.vrt));
      }
      odebO.push(valec(o.Rb, o.zpb - 1, o.zTop + 1));
      for (const [x, y] of o.magnety.body) odebO.push(valec(o.mR, o.zpb - 1, o.zpb + o.mH, x, y, segmenty(o.mR)));
      if (o.zas) odebO.push(...zkoseniDesky());
      let objimka = rozdil(sjednot(plneO), odebO);

      /* ---- sukně z TPU ---- */
      let sukne = null;
      if (p.kartac.typ === 'tpu') {
        const sir = o.wg - 0.05, z0 = o.zBr, z1 = o.zkb + o.hd - 0.2;
        sukne = k(M.difference([loft([[o.dc + sir / 2, z0], [o.dc + sir / 2, z1]]), loft([[o.dc - sir / 2, z0 - 0.5], [o.dc - sir / 2, z1 + 0.5]])]));
        const n = Math.max(8, Math.round(o.obvodKartace / p.kartac.lamela));
        const rezy = poObvodu(obrys(o.T, o.dc, o.K), n, 0.5 / n).map(([x, y, nx, ny]) =>
          k(k(kvadr(-6, -p.kartac.sterbina / 2, z0 - 1, 6, p.kartac.sterbina / 2, o.zkb - 1).rotate([0, 0, deg(Math.atan2(ny, nx))])).translate([x, y, 0])));
        sukne = rozdil(sukne, rezy);
        o.lamel = n;
      }

      /* ---- vizualizace: vřeteno s nástrojem, kartáč ---- */
      const vizual = [];
      if (volby.vizual !== false) {
        const vr = sjednot([valec(p.vreteno.prumer / 2, 0, o.zTop + 25), valec(p.vreteno.prumer * 0.3, -Math.min(8, p.vreteno.vylozeni * 0.3), 0.01, 0, 0, 32),
          valec(3, o.zTip, 0, 0, 0, 24)]);
        vizual.push(sit(k, vr, 'vreteno', 'Vřeteno s nástrojem', '#8a9099'));
        if (p.kartac.typ === 'pasek') {
          const sir = p.kartac.pasek;
          const kr = k(M.difference([loft([[o.dc + sir / 2, o.zBr], [o.dc + sir / 2, o.zkb + o.hd - 0.1]]), loft([[o.dc - sir / 2, o.zBr - 0.5], [o.dc - sir / 2, o.zkb + o.hd + 0.5]])]));
          vizual.push(sit(k, kr, 'kartac', 'Kartáč', '#3b3b3b'));
        }
      }

      /* ---- kalibrační vzorek ---- */
      const kalibrace = [];
      if (volby.kalibrace) {
        const u = p.uchyceni, krok = p.tisk.krokKalibrace, rozt = u.prumer + 5 + 4 * krok, Lb = 5 * rozt + 4;
        const Hb = Math.max(o.mH, o.hd) + 1.5, Wb = rozt + o.wg + 7;
        const blok = kvadr(0, 0, 0, Lb, Wb, Hb), odeb = [];
        for (let i = 0; i < 5; i++) {
          const r = (u.prumer + u.vule + (i - 2) * krok) / 2, x = 2 + rozt / 2 + i * rozt;
          odeb.push(valec(r, Hb - o.mH, Hb + 1, x, rozt / 2 + 1, segmenty(r)));
          for (let j = 0; j <= i; j++) odeb.push(kvadr(x - rozt / 2 + 1.5 + j * 1.6, -0.5, Hb - 1, x - rozt / 2 + 2.3 + j * 1.6, 0.8, Hb + 1));
        }
        odeb.push(kvadr(-1, rozt + 3, Hb - o.hd, Lb + 1, rozt + 3 + o.wg, Hb + 1));
        kalibrace.push(sit(k, rozdil(blok, odeb), 'kal_magnety', 'Kalibrace – kapsy magnetů a drážka kartáče', '#E88A2E'));
        const kr = k(M.difference([valec(o.Rb + 2, 0, 8), valec(o.Rb, -1, 9)]));
        kalibrace.push(sit(k, kr, 'kal_vreteno', 'Kalibrace – zkušební kroužek vřetene', '#E88A2E'));
      }

      // průnik sestavy (objímka × komora, vřeteno × díly) – měřeno na tělesech
      const vreteno = valec(p.vreteno.prumer / 2 - 0.01, o.zpb - 200, o.zTop + 5);
      const prunik = {
        objimkaKomora: k(objimka.intersect(komora)).volume(),
        vretenoKomora: k(komora.intersect(vreteno)).volume(),
        vretenoObjimka: k(objimka.intersect(vreteno)).volume(),
      };
      const dily = [sit(k, objimka, 'objimka', 'Objímka s deskou', '#2F5FA8'), sit(k, komora, 'komora', 'Komora', '#E88A2E')];
      if (sukne) dily.push(sit(k, sukne, 'sukne', 'Sukně z TPU', '#5BAF5B'));
      return { dily, vizual, kalibrace, o, prunik, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }

    /* ---- zásuvné vedení (v souřadnicích u = směr vysouvání, v = do strany) ---- */
    function zasuvDeska() {
      const z = o.zas;
      let P = obrys(o.T, o.t + o.f, o.K);
      P = orizni(P, o.v, z.Yl); P = orizni(P, [-o.v[0], -o.v[1]], z.Yp); P = orizni(P, o.u, z.Xf);
      return P;
    }
    /** Sražení horních hran desky pod lišty (klín 45° po celé délce strany). */
    function zkoseniDesky() {
      const z = o.zas, out = [];
      for (const [sg, Y] of [[1, z.Yl], [-1, z.Yp]]) {
        const body = [];
        for (const t of [-2000, 2000]) for (const [yy, zz] of [[Y - z.c, o.zpt + 0.01], [Y + 0.01, o.zpt - z.c], [Y + 2, o.zpt + 2], [Y - z.c, o.zpt + 2]]) {
          body.push([o.u[0] * t + o.v[0] * sg * yy, o.u[1] * t + o.v[1] * sg * yy, zz]);
        }
        out.push(k(M.hull(body)));
      }
      return out;
    }
    /** Lišty s náběhem 45° nad hranami desky + doraz u vývodu; oříznuté na obrys příruby. */
    function listyZasuvu() {
      const z = o.zas, out = [], psi = deg(Math.atan2(o.u[1], o.u[0]));
      const prof = Y => [[Y + z.vz, o.zpb - 0.5], [Y + z.vz + z.wr, o.zpb - 0.5], [Y + z.vz + z.wr, o.zpt + z.lt], [Y - z.c + z.vz, o.zpt + z.lt], [Y - z.c + z.vz, o.zpt], [Y + z.vz, o.zpt - z.c]];
      const orez = hranol(obrys(o.T, o.t + o.f - 0.01, o.K), o.zpb - 0.6, o.zpt + z.lt + 0.5);
      for (const [sg, Y] of [[1, z.Yl], [-1, z.Yp]]) {
        // profil v rovině (v, z), vytažený podél u: CS (x = v, y = z) → extrude z → rotace [90,0,0] (z → −y) → otočení k u
        const b = prof(Y).map(([yy, zz]) => [yy * sg, zz]);
        if (sg < 0) b.reverse();
        let m = k(k(k(new CS([b], 'Positive')).extrude(4000)).translate([0, 0, -2000]));
        m = k(k(m.rotate([90, 0, 0])).rotate([0, 0, psi - 90 + 180]));
        out.push(k(m.intersect(orez)));
      }
      // doraz na straně vývodu: příčka přes celou šířku
      const d0 = z.Xf + z.vz, body = [];
      for (const t of [d0, d0 + z.wr]) for (const s of [-2000, 2000]) for (const zz of [o.zpb - 0.5, o.zpt + z.lt]) body.push([o.u[0] * t + o.v[0] * s, o.u[1] * t + o.v[1] * s, zz]);
      out.push(k(k(M.hull(body)).intersect(orez)));
      return out;
    }
  }

  /** Manifold → síť pro náhled a export. */
  function sit(k, m0, jmeno, nazev, barva) {
    const m = k(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const kusy = m.decompose().map(k);
    return { jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, barva, otocit: false };
  }

  function kontrolyModelu(p, model) {
    const H = [], pr = model.prunik;
    if (pr.objimkaKomora > 1) H.push({ uroven: 'chyba', pole: ['vyvod.prumer', 'objimka.odsazeni'], text: `Objímka a komora se v sestavě prolínají (${fmt(pr.objimkaKomora, 0)} mm³) – zkontrolujte vývod a přírubu.` });
    if (pr.vretenoKomora > 0.5 || pr.vretenoObjimka > 0.5) H.push({ uroven: 'chyba', pole: ['vreteno.prumer'], text: 'Vřeteno naráží do dílu botky.' });
    for (const d of model.dily.concat(model.kalibrace)) {
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      const r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 3) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v tom místě může potřebovat podpory.` });
      if (r.most > 1) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu (drážka, kapsy).` });
    }
    return H;
  }

  /* ---------------- proudění ---------------- */
  /** Rychlost vzduchu u kartáče a ve vývodu, tlakové ztráty (hrubý odhad). prutok v m³/h. */
  function proudeni(p, o, prutok = p.proud.prutok) {
    const Q = prutok / 3600, rho = 1.2, P = o.obvodKartace;
    const plochaK = p.kartac.typ === 'tpu'
      ? (o.lamel || Math.max(8, Math.round(P / p.kartac.lamela))) * p.kartac.sterbina * o.Lv + P * p.proud.mezera
      : p.proud.propustnost / 100 * P * o.Lv + P * p.proud.mezera;          // mm²
    const dV = 2 * o.h.rb, plochaV = Math.PI * dV * dV / 4;
    const vK = Q / (plochaK * 1e-6), vV = Q / (plochaV * 1e-6);
    const zetaK = 2.5, zetaV = p.vyvod.umisteni === 'bok' && p.vyvod.tecny !== 'osa' ? 0.3 : 0.5;
    const dpK = zetaK * rho * vK * vK / 2, dpV = zetaV * rho * vV * vV / 2;
    return { Q: prutok, plochaK, vK, dV, plochaV, vV, dpK, dpV, dp: dpK + dpV,
      Q20: 20 * plochaV * 1e-6 * 3600, Q10k: 10 * plochaK * 1e-6 * 3600, zetaK, zetaV };
  }

  /* ---------------- kusovník ---------------- */
  /** Řádky kusovníku [název, množství, poznámka]; model (nepovinný) doplní hmotnosti tištěných dílů. */
  function kusovnik(p, o, model) {
    const mat = MATERIALY[p.tisk.material], r = [];
    const g = jm => { const d = model && model.dily.find(x => x.jmeno === jm); return d ? ` · ${fmt(d.objem / 1000 * (jm === 'sukne' ? HUSTOTA_TPU : mat.hustota), 0)} g` : ''; };
    r.push(['Objímka s deskou (tisk)', '1 ks', `${mat.nazev}${g('objimka')}`]);
    r.push(['Komora (tisk)', '1 ks', `${mat.nazev}${g('komora')}`]);
    if (p.kartac.typ === 'pasek') r.push(['Kartáčová lišta – pásek ' + fmt(p.kartac.pasek) + ' mm, vlas ' + fmt(p.kartac.vlas) + ' mm', `${fmt(Math.ceil(o.obvodKartace / 10) * 10 + 20, 0)} mm`, `obvod drážky ${fmt(o.obvodKartace, 0)} mm + 20 mm na střih`]);
    else r.push(['Sukně z TPU (tisk)', '1 ks', `TPU 95A${g('sukne')} · ${o.lamel || Math.round(o.obvodKartace / p.kartac.lamela)} lamel`]);
    if (p.uchyceni.typ === 'magnety') {
      const n = o.magnety.body.length;
      r.push([`Magnet neodymový Ø ${fmt(p.uchyceni.prumer)} × ${fmt(p.uchyceni.vyska)} mm`, `${2 * n} ks`, `${n} do desky + ${n} do komory, opačná polarita`]);
      if (p.uchyceni.montaz === 'lepeni') r.push(['Lepidlo na magnety', '–', 'kyanoakrylát nebo epoxid']);
    }
    if (p.objimka.upnuti === 'sroub') {
      r.push([`Šroub ISO 4762 ${p.objimka.sroub} × ${o.delkaSroubu}`, '1 ks', 'imbus, stahuje objímku']);
      r.push([`Matice ISO 4032 ${p.objimka.sroub}`, '1 ks', 'do kapsy shora']);
      r.push([`Podložka ${p.objimka.sroub}`, '1 ks', 'pod hlavu']);
    } else r.push([`Hadicová spona ${fmt(p.objimka.sirkaSpony)} mm`, '1 ks', `rozsah kolem Ø ${fmt(2 * o.Rring - 2, 0)} mm`]);
    const h = o.h;
    r.push([h.zasun ? `Hadice s koncovkou Ø ${fmt(p.vyvod.prumer)}` : `Hadice vnitřní Ø ${fmt(p.vyvod.prumer)}`, '–', h.zasun ? 'koncovka se zasune do hrdla' : 'navléknout, stáhnout sponou']);
    return r;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const k = p.komora, tv = k.tvar === 'kruh' ? `kruh Ø ${fmt(k.prumer)}` : `${NAZVY.tvar[k.tvar]} ${fmt(k.delka)} × ${fmt(k.sirka)}`;
    return `vřeteno Ø ${fmt(p.vreteno.prumer)} · ${tv} · ${p.uchyceni.typ === 'magnety' ? p.uchyceni.pocet + ' magnetů' : 'zásuv'} · vývod Ø ${fmt(p.vyvod.prumer)} ${p.vyvod.umisteni === 'deska' ? 'z desky' : 'z boku'}`;
  }
  const TYP = 'odsavaci_botka';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Odsávací botky');

  const API = {
    MATERIALY, HUSTOTA_TPU, SROUBY, DELKY, VRETENA, HADICE, VYSAVACE, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    normalizuj, predvolba, tvarKomory, obrys, obvod, paprsek, opora, poObvodu, orizni, hrdlo, profilHrdla, odvozene, kontroly,
    postav, kontrolyModelu, proudeni, kusovnik, bodNaOse,
    popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt,
  };
  if (uzel) module.exports = API; else window.BOTKA = API;
})();
