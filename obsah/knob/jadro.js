/* Knob – generátor tvarů (jen knob): jádro bez DOM (běží i v node).
   Souřadnice: osa knobu = z, z = 0 je spodní plocha (odsazení / začátek krčku), nahoru vrchol hlavy.
   Od spodu: odsazení (límec nebo čep) → krček → hlava. Zapuštění (otvor pro hřídel) jde zespodu,
   jisticí šroubek míří ve směru −y kolmo na osu.
   Tvary hlavy, generátor ze semínka, krček a skicu bere z kliky/jadro.js (KLIKY), tiskové funkce ze spojky/jadro.js. */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('../kliky/jadro.js') : window.KLIKY;
  const SP = typeof module !== 'undefined' ? require('../spojky/jadro.js') : window.SPOJKY;
  const { kopie, cislo, fmt, vezmi, poloz, V } = K;
  const VERZE_FORMATU = 1;

  /* ---------- tabulky ---------- */
  const ZAPUSTENI = {
    ctyrhran: { nazev: 'čtyřhran', popisRozmeru: 'Strana' },
    kruh: { nazev: 'kulatý', popisRozmeru: 'Průměr' },
    d: { nazev: 'D-profil (kulatý s ploškou)', popisRozmeru: 'Průměr' },
    sestihran: { nazev: 'šestihran', popisRozmeru: 'Přes plošky' },
  };
  // typické rozměry hřídelí (změřte posuvkou)
  const ROZMERY_ZAPUSTENI = [
    { nazev: 'čtyřhran 8 mm (dveře EU)', typ: 'ctyrhran', rozmer: 8 },
    { nazev: 'čtyřhran 7 mm', typ: 'ctyrhran', rozmer: 7 },
    { nazev: 'čtyřhran 5/16″ (US mortise)', typ: 'ctyrhran', rozmer: 7.94 },
    { nazev: 'čtyřhran 9/32″ (US starší)', typ: 'ctyrhran', rozmer: 7.14 },
    { nazev: 'kulatý 6 mm (hřídel)', typ: 'kruh', rozmer: 6 },
    { nazev: 'kulatý 1/4″', typ: 'kruh', rozmer: 6.35 },
    { nazev: 'kulatý 8 mm', typ: 'kruh', rozmer: 8 },
    { nazev: 'D 6 mm, plocha 4,5 mm', typ: 'd', rozmer: 6, ploska: 4.5 },
    { nazev: 'šestihran 10 mm (matice M6)', typ: 'sestihran', rozmer: 10 },
    { nazev: 'šestihran 13 mm (matice M8)', typ: 'sestihran', rozmer: 13 },
  ];
  const UCHYCENI = {
    matice: 'matice vložená do kapsy',
    vlozka: 'zalisovací vložka (teplem)',
    zavit: 'závit do plastu (předvrt)',
    samorez: 'samořezný vrut do plastu',
    vrut: 'vrut do dřeva se zápustnou hlavou',
    zadne: 'bez jisticího šroubku',
  };
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, pozn: 'houževnaté, dobrá volba na knoby' },
    PLA: { nazev: 'PLA', hustota: 1.24, pozn: 'tuhé a křehčí, na slunci měkne (≈ 55 °C)' },
    ASA: { nazev: 'ASA', hustota: 1.07, pozn: 'odolné UV a teplu – venkovní dveře a branky' },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, pozn: 'nejhouževnatější, otvor se nevytluče; nasává vlhkost' },
    PC: { nazev: 'PC', hustota: 1.2, pozn: 'pevné a teplu odolné, náročný tisk' },
  };

  const VYCHOZI = {
    nazev: 'Knob',
    typ: 'knob',
    knob: { tvar: 'generator', seminko: 2026, prumer: 54, hlava: 48, podrez: true, pudorys: 'kruh', pocet: 8, hloubka: 1.5, krcek: 24, stoupani: 90, pomer: 0.8 },
    krcek: { tvar: 'valec', mira: 1, hrany: 0, seminko: 1, delka: 18 },
    odsazeni: { prumer: 30, vyska: 4 },
    otvor: { typ: 'ctyrhran', rozmer: 8, ploska: 4.5, vule: 0.15, hloubka: 30 },
    sroub: { velikost: 'M4', prumer: 4, uchyceni: 'matice', odsazeni: 6, predvrt: 0, hlava: 0, hlavaHloubka: 0, hlavaTvar: 'auto' },
    tisk: { material: 'PETG', vypln: 100, previs: 45, orientace: 'auto' },
    pevnost: { moment: 8 },
  };
  const ROZSAHY = {
    'knob.prumer': [15, 120], 'knob.hlava': [8, 120], 'knob.krcek': [6, 60], 'knob.pocet': [3, 40], 'knob.hloubka': [0, 6], 'knob.seminko': [1, 999999],
    'krcek.delka': [0, 120], 'krcek.mira': [0, 2.5], 'krcek.seminko': [1, 999999],
    'odsazeni.prumer': [0, 120], 'odsazeni.vyska': [0, 40],
    'otvor.rozmer': [2, 40], 'otvor.ploska': [1, 40], 'otvor.vule': [-0.2, 0.8], 'otvor.hloubka': [0, 200],
    'sroub.prumer': [2, 8], 'sroub.odsazeni': [-40, 120], 'sroub.predvrt': [0, 10], 'sroub.hlava': [0, 20], 'sroub.hlavaHloubka': [0, 30],
    'knob.stoupani': [-720, 720], 'knob.pomer': [0.4, 1],
    'tisk.vypln': [0, 100], 'tisk.previs': [20, 70], 'pevnost.moment': [0, 60],
  };
  const PREDVOLBY = [
    { nazev: 'Knob ze semínka 🎲', popis: 'hlava z generátoru, čtyřhran 8 mm, límec Ø 30',
      p: { knob: { tvar: 'generator', seminko: 2026 } } },
    { nazev: 'Koule US 2 1/4″ – 5/16″', popis: 'kulatá hlava Ø 57, krček Ø 26, čtyřhran 5/16″',
      p: { nazev: 'Knob koule', knob: { tvar: 'koule', prumer: 57, hlava: 52, krcek: 26 }, krcek: { delka: 16 }, odsazeni: { prumer: 32, vyska: 5 },
        otvor: { typ: 'ctyrhran', rozmer: 7.94, hloubka: 34 } } },
    { nazev: 'Úl (beehive) s prstencovým krčkem', popis: 'historický americký tvar, krček s prstenci',
      p: { nazev: 'Knob úl', knob: { tvar: 'ul', prumer: 56, hlava: 40, krcek: 22 }, krcek: { tvar: 'prstence', delka: 22, mira: 1 },
        otvor: { typ: 'ctyrhran', rozmer: 7.14, hloubka: 34 }, sroub: { velikost: 'M3', odsazeni: 7 } } },
    { nazev: 'Krystal – 8 faset, trumpeta', popis: 'osmiboká hlava, krček rozšířený k límci',
      p: { nazev: 'Knob krystal', knob: { tvar: 'koule', prumer: 52, hlava: 46, krcek: 20, pudorys: 'hrany', pocet: 8 }, krcek: { tvar: 'zvon', delka: 20, mira: 1.2 }, odsazeni: { prumer: 40, vyska: 4 } } },
    { nazev: 'Nábytkový knopek na šroub', popis: 'hřib Ø 32, šestihran pro matici M6, bez šroubku',
      p: { nazev: 'Knopek', knob: { tvar: 'hrib', prumer: 32, hlava: 16, krcek: 17 }, krcek: { delka: 6 }, odsazeni: { prumer: 0, vyska: 0 },
        otvor: { typ: 'sestihran', rozmer: 10, vule: 0.1, hloubka: 6 }, sroub: { uchyceni: 'zadne' } } },
    { nazev: 'Knoflík na hřídel D 6 mm', popis: 'puk s rýhami, D-profil, šroubek do plošky',
      p: { nazev: 'Knoflík D6', knob: { tvar: 'valec', prumer: 30, hlava: 14, krcek: 14, pudorys: 'ryhy', pocet: 18, hloubka: 0.8 }, krcek: { delka: 6 },
        odsazeni: { prumer: 0, vyska: 0 }, otvor: { typ: 'd', rozmer: 6, ploska: 4.5, vule: 0.1, hloubka: 14 }, sroub: { velikost: 'M3', uchyceni: 'zavit', odsazeni: 3 } } },
    { nazev: 'Passage knob (US) – vroubkovaný', popis: 'plochá čelní plocha, kosočtverečné vroubkování, čtyřhran 5/16″',
      p: { nazev: 'Knob passage', knob: { tvar: 'pasazni', prumer: 54, hlava: 30, krcek: 24, pudorys: 'vrubkovani', pocet: 14, hloubka: 0.8, stoupani: 70 },
        krcek: { tvar: 'zvon', delka: 20, mira: 0.8 }, odsazeni: { prumer: 36, vyska: 4 }, otvor: { typ: 'ctyrhran', rozmer: 7.94, hloubka: 34 } } },
    { nazev: 'Tulipán s květem a vrutem', popis: 'tulipánová hlava s laloky, vrut do dřeva se zápustnou hlavou',
      p: { nazev: 'Knob tulipán', knob: { tvar: 'tulipan', prumer: 52, hlava: 44, krcek: 24, pudorys: 'kvet', pocet: 8, hloubka: 1.6 },
        krcek: { tvar: 'patka', delka: 18 }, sroub: { uchyceni: 'vrut', velikost: 'vlastni', prumer: 3.5, odsazeni: 7 } } },
    { nazev: 'Vlastní skica', popis: 'obrys hlavy tažením bodů',
      p: { nazev: 'Knob skica', knob: { tvar: 'vlastni' } } },
  ];

  /* ---------- normalizace ---------- */
  const sl = (o, z) => { for (const k of Object.keys(z)) if (z[k] && typeof z[k] === 'object' && !Array.isArray(z[k]) && o[k] && typeof o[k] === 'object') sl(o[k], z[k]); else o[k] = z[k]; return o; };
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hl = [];
    if (vstup && typeof vstup === 'object') sl(p, kopie(vstup));
    p.typ = 'knob';
    if (!K.TVARY_KNOBU[p.knob.tvar]) p.knob.tvar = 'koule';
    if (!K.PUDORYSY[p.knob.pudorys]) p.knob.pudorys = 'kruh';
    p.knob.podrez = !!p.knob.podrez;
    if (!K.TVARY_KRCKU[p.krcek.tvar]) p.krcek.tvar = 'valec';
    p.krcek.hrany = 0;
    if (!ZAPUSTENI[p.otvor.typ]) p.otvor.typ = 'ctyrhran';
    if (!(p.sroub.velikost in K.STAVECI)) p.sroub.velikost = 'M4';
    if (!UCHYCENI[p.sroub.uchyceni]) p.sroub.uchyceni = 'matice';
    if (!['auto', 'kuzel', 'valec'].includes(p.sroub.hlavaTvar)) p.sroub.hlavaTvar = 'auto';
    if (!MATERIALY[p.tisk.material]) p.tisk.material = 'PETG';
    p.tisk.orientace = ['auto', '-Z', '+Z'].includes(p.tisk.orientace) ? p.tisk.orientace : 'auto';
    p.nazev = String(p.nazev == null ? '' : p.nazev).slice(0, 120);
    for (const [c, [mn, mx]] of Object.entries(ROZSAHY)) {
      let h = cislo(vezmi(p, c), vezmi(VYCHOZI, c));
      if (h < mn || h > mx) { const o = Math.max(mn, Math.min(mx, h)); hl.push(`${c} ${fmt(h, 2)} → ${fmt(o, 2)}`); h = o; }
      poloz(p, c, h);
    }
    for (const c of ['knob.pocet', 'knob.seminko', 'krcek.seminko']) poloz(p, c, Math.round(vezmi(p, c)));
    if (K.STAVECI[p.sroub.velikost]) p.sroub.prumer = K.STAVECI[p.sroub.velikost].d;
    // skici hlavy a krčku (stejný formát jako u klik)
    const vychozi = K.normalizuj({}).p;
    p.knob.vlastni = { body: K.normalizujBodySkici(p.knob.vlastni && p.knob.vlastni.body, vychozi.knob.vlastni.body, { u: [0.005, 0.995], r: [0.02, 1] }) };
    const kb = K.normalizujBodySkici(p.krcek.vlastni && p.krcek.vlastni.body, vychozi.krcek.vlastni.body, { u: [0, 1], r: [0.4, 3] }).sort((a, b) => a.u - b.u);
    kb[0].u = 0; kb[kb.length - 1].u = 1; kb[kb.length - 1].r = 1;
    p.krcek.vlastni = { body: kb };
    // KLIKY.profilKnobu potřebuje vyložení = výška vrcholu
    p.knob.vylozeni = p.odsazeni.vyska + p.krcek.delka + p.knob.hlava;
    return { p, hlaseni: hl };
  }
  function zPredvolby(i) {
    const v = PREDVOLBY[i], p = normalizuj({}).p;
    sl(p, kopie(v.p));
    if (!v.p.nazev) p.nazev = 'Knob';
    return normalizuj(p).p;
  }

  /* ---------- otvor (zapuštění) ---------- */
  /** Obrys otvoru v rovině xy (s vůlí), plošky / D-ploška míří k −y (proti šroubku). */
  function obrysOtvoru(o) {
    const t = o.typ, v = o.vule, out = [];
    if (t === 'ctyrhran') { const a = o.rozmer / 2 + v; return [[-a, -a], [a, -a], [a, a], [-a, a]]; }
    if (t === 'sestihran') {
      const rc = (o.rozmer / 2 + v) / Math.cos(Math.PI / 6);
      for (let i = 0; i < 6; i++) { const f = Math.PI / 6 * (2 * i); out.push([rc * Math.cos(f), rc * Math.sin(f)]); }   // vrcholy na ±x, plošky na ±y
      return out;
    }
    const r = (o.rozmer / 2 + v) / Math.cos(Math.PI / 64);   // opsaný 64úhelník – hřídel se vejde celá
    if (t === 'kruh') { for (let i = 0; i < 64; i++) { const f = 2 * Math.PI * i / 64; out.push([r * Math.cos(f), r * Math.sin(f)]); } return out; }
    // D: kruh odříznutý přímkou y = −(ploska − d/2) − v … plocha je vzdálenost od plošky k protější straně
    const yp = -(o.ploska - o.rozmer / 2) - v;
    const f0 = Math.asin(Math.max(-1, Math.min(1, yp / r)));
    for (let i = 0; i <= 64; i++) { const f = f0 + (Math.PI - 2 * f0) * i / 64; out.push([r * Math.cos(f), r * Math.sin(f)]); }
    return out;   // poslední bod se spojí s prvním přes plošku
  }
  /** Opsaný poloměr otvoru (nejvzdálenější bod od osy) a vzdálenost plošky / stěny ve směru šroubku (−y). */
  function miryOtvoru(o) {
    const ob = obrysOtvoru(o);
    return { rOpsany: Math.max(...ob.map(([x, y]) => Math.hypot(x, y))), kSroubu: Math.max(...ob.map(([, y]) => -y)), obrys: ob };
  }

  /* ---------- odvozené rozměry ---------- */
  function odvozene(p) {
    const o = {};
    const q = p.knob, hO = p.odsazeni.vyska, rO = p.odsazeni.prumer / 2;
    o.maOdsazeni = hO > 0 && rO > 0;
    o.zN = o.maOdsazeni ? hO : 0;                // začátek krčku
    o.zHlavy = o.zN + p.krcek.delka;             // spodek hlavy
    o.zt = o.zHlavy + q.hlava;                    // vrchol
    o.krcekF = K.krcekFunkce(p.krcek);
    o.prof = K.profilKnobu(Object.assign({}, q, { vylozeni: o.zt }), o.zN, o.krcekF.f, Infinity, 0.4);   // krček smí být i užší (skica)
    o.rO = o.maOdsazeni ? rO : 0;
    o.rn = q.krcek / 2;
    // poloměr tělesa ve výšce z (bez otvorů): odsazení + rotační profil
    const rProf = z => { const b = o.prof.body; if (z < b[0][1]) return 0; for (let i = 1; i < b.length; i++) if (b[i][1] >= z) { const t = (z - b[i - 1][1]) / ((b[i][1] - b[i - 1][1]) || 1); return b[i - 1][0] + (b[i][0] - b[i - 1][0]) * t; } return 0; };
    o.rV = z => Math.max(z < hO && o.maOdsazeni ? rO : 0, rProf(z));
    // otvor
    const mo = miryOtvoru(p.otvor);
    o.otvor = mo; o.zVrcholOsy = o.prof.body[o.prof.body.length - 1][1];   // u misky je vrchol na ose níž než okraj
    o.zDiry1 = Math.min(p.otvor.hloubka, o.zVrcholOsy - 1.5); o.hloubkaDiry = Math.max(0, o.zDiry1);
    // nejtenčí stěna kolem otvoru po jeho délce (u D a šestihranu proti nejvzdálenějšímu rohu)
    let stena = Infinity, zStena = 0;
    for (let i = 0; i <= 60 && o.hloubkaDiry > 0; i++) { const z = o.zDiry1 * i / 60, w = o.rV(z) - mo.rOpsany; if (w < stena) { stena = w; zStena = z; } }
    o.stena = stena; o.zStena = zStena;
    // jisticí šroubek: odsazení od začátku krčku
    const st = p.sroub.velikost === 'vlastni' ? K.staveciZPrumeru(p.sroub.prumer) : K.STAVECI[p.sroub.velikost];
    o.staveci = st;
    if (p.sroub.uchyceni !== 'zadne') {
      o.zs = o.zN + p.sroub.odsazeni;
      o.zahl = K.zahloubeniSroubu(p, st);
      o.samorez = p.sroub.uchyceni === 'samorez' ? o.zahl : null;
      o.vrut = p.sroub.uchyceni === 'vrut' ? o.zahl : null;
      o.rSroub = o.rV(o.zs);
      o.stenaSroubu = o.rSroub - mo.kSroubu;
      o.ven = Math.max(...Array.from({ length: 21 }, (_, i) => o.rV(o.zs - st.d + i * st.d / 10))) + 2;
      const delka = o.stenaSroubu + 0.5;
      o.delkaStav = K.delkaSroubu([3, 4, 5, 6, 8, 10, 12, 16], o.stenaSroubu, 0.5).L;   // bez hlavy – raději kratší než vyčnívající
    }
    o.vyska = o.zt;
    o.rMax = Math.max(o.rO, ...o.prof.body.map(b => b[0]));
    return o;
  }

  /* ---------- kontroly ---------- */
  function kontroly(p, o) {
    const H = [], pridej = (uroven, text, pole = [], oprava) => H.push({ uroven, text, pole: [].concat(pole), oprava });
    const q = p.knob, st = o.staveci, ot = p.otvor, velikost = K.jmenoSroubu(p);
    if (o.hloubkaDiry > 0) {
      if (o.stena < 1.2) pridej('chyba', `Kolem zapuštění zbývá jen ${fmt(o.stena)} mm stěny (ve výšce ${fmt(o.zStena)} mm) – zvětšete průměr krčku nebo odsazení, nebo zmenšete hloubku.`, ['knob.krcek', 'odsazeni.prumer', 'otvor.hloubka']);
      else if (o.stena < 2.5) pridej('varovani', `Stěna kolem zapuštění ${fmt(o.stena)} mm je tenká (ve výšce ${fmt(o.zStena)} mm) – doporučeno ≥ 2,5 mm.`, ['knob.krcek', 'odsazeni.prumer']);
    }
    if (p.otvor.hloubka > o.zVrcholOsy - 1.5) pridej('info', `Hloubka zapuštění omezena na ${fmt(o.zDiry1)} mm – nad otvorem musí zůstat materiál.`, 'otvor.hloubka');
    if (o.hloubkaDiry > 0 && o.hloubkaDiry < 8 && ot.typ !== 'sestihran') pridej('varovani', `Zapuštění ${fmt(o.hloubkaDiry)} mm je mělké – knob se bude viklat (doporučeno ≥ 1,5 × rozměr).`, 'otvor.hloubka');
    if (ot.typ === 'd' && (ot.ploska >= ot.rozmer || ot.ploska < ot.rozmer * 0.5)) pridej('chyba', `Rozměr přes plošku ${fmt(ot.ploska)} mm musí být menší než průměr ${fmt(ot.rozmer)} mm (a větší než polovina).`, 'otvor.ploska');
    if (ot.vule < 0) pridej('varovani', 'Záporná vůle = nalisování; knob půjde na hřídel ztuha a může prasknout.', 'otvor.vule');
    // hlava a krček
    if (q.tvar === 'vlastni' && K.protinaSe(K.krivkaProfilu(q.vlastni.body, true))) pridej('chyba', 'Obrys skici hlavy se kříží sám se sebou – posuňte body nebo úchyty.', 'knob.tvar');
    if (p.krcek.tvar === 'vlastni' && K.protinaSe(K.krivkaProfilu(p.krcek.vlastni.body, false))) pridej('chyba', 'Obrys skici krčku se kříží sám se sebou.', 'krcek.tvar');
    if (q.krcek >= q.prumer - 2) pridej('chyba', `Krček Ø ${fmt(q.krcek)} mm je skoro stejně široký jako hlava Ø ${fmt(q.prumer)} mm.`, ['knob.krcek', 'knob.prumer']);
    if (q.podrez && o.prof.podstava > o.prof.rn + 0.01) pridej('info', `Podřez 45° pod hlavou začíná už u začátku krčku (krček je na podřez krátký) – pata Ø ${fmt(2 * o.prof.podstava)} mm.`, ['krcek.delka', 'knob.hlava']);
    if (p.krcek.delka < 4 && q.prumer > 40) pridej('varovani', `Krček ${fmt(p.krcek.delka)} mm je krátký – pod hlavu se nevejdou prsty (dveřní knoby mívají krček 15–25 mm).`, 'krcek.delka');
    if (o.maOdsazeni && Math.abs(o.rO - o.rn) < 0.5) pridej('info', 'Odsazení je stejně široké jako krček – nevznikne žádný schod.', 'odsazeni.prumer');
    if (o.maOdsazeni && o.rO < o.otvor.rOpsany + 1.2) pridej('chyba', `Odsazení Ø ${fmt(2 * o.rO)} mm je na zapuštění úzké.`, 'odsazeni.prumer');
    // šroubek
    if (p.sroub.uchyceni !== 'zadne') {
      if (o.zs - st.d / 2 < 0.8) pridej('chyba', `Jisticí šroubek ve výšce ${fmt(o.zs)} mm vychází ze spodní plochy – zvětšete odsazení od začátku krčku.`, 'sroub.odsazeni');
      if (o.zs + st.d / 2 > o.zDiry1 - 0.5) pridej('chyba', `Jisticí šroubek (výška ${fmt(o.zs)} mm) je nad koncem zapuštění (${fmt(o.zDiry1)} mm) – nedosáhne na hřídel.`, ['sroub.odsazeni', 'otvor.hloubka'],
        { pole: 'sroub.odsazeni', hodnota: Math.max(st.d / 2 + 1 - o.zN, Math.floor((o.zDiry1 - st.d / 2 - 1 - o.zN) * 2) / 2), text: 'posunout níž' });
      if (o.maOdsazeni && o.zs < o.zN) pridej('info', 'Šroubek je v odsazení – je-li odsazení zapuštěné v rozetě, nedosáhnete na něj.', 'sroub.odsazeni');
      if (o.zs > o.zHlavy - st.d / 2) pridej('info', 'Šroubek vychází v hlavě – otvor bude vidět na spodku hlavy.', 'sroub.odsazeni');
      const w = o.stenaSroubu;
      if (p.sroub.uchyceni === 'matice' && w >= st.mVyska + 2 && K.kapsaProrazi(o.rSroub, o.otvor.kSroubu, w, st)) pridej('chyba', `Kapsa pro matici ${velikost} (šířka ${fmt(st.matice + 0.3)} mm) prorazí bok krčku – zvolte menší šroub, vložku nebo závit, nebo širší krček.`, ['sroub.velikost', 'knob.krcek'],
        { pole: 'sroub.uchyceni', hodnota: 'zavit', text: 'závit do plastu' });
      if (p.sroub.uchyceni === 'matice' && w < st.mVyska + 0.4 + 1.6) pridej('chyba', `Na kapsu pro matici ${velikost} je stěna ${fmt(w)} mm tenká (potřeba ≥ ${fmt(st.mVyska + 2)} mm).`, ['sroub.uchyceni', 'knob.krcek'],
        { pole: 'sroub.uchyceni', hodnota: 'zavit', text: 'závit do plastu' });
      if (p.sroub.uchyceni === 'vlozka' && w < st.vDelka * 0.6) pridej('chyba', `Zalisovací vložka ${velikost} se do stěny ${fmt(w)} mm nevejde.`, ['sroub.uchyceni', 'knob.krcek']);
      if (p.sroub.uchyceni === 'vrut') {
        const zb = w - o.vrut.zahloubeni;
        if (zb < 1.5) pridej('chyba', `Vrut ${velikost}: po zahloubení hlavy zbývá jen ${fmt(zb)} mm stěny – vrut nebude mít v čem držet.`, ['sroub.prumer', 'knob.krcek']);
        else if (zb < 2.5) pridej('varovani', `Vrut ${velikost} má po zahloubení hlavy jen ${fmt(zb)} mm stěny na závit.`, ['sroub.prumer', 'knob.krcek']);
        pridej('info', `Vrut do dřeva se zápustnou hlavou: předvrt Ø ${fmt(o.vrut.predvrt, 1)} mm, zahloubení 90° pro hlavu Ø ${fmt(o.vrut.hlava, 1)} mm; špička se zaryje do hřídele.`, 'sroub.uchyceni');
      }
      if (p.sroub.uchyceni === 'samorez' && w - o.samorez.vyskaHlavy < 1.2 * st.d) pridej('varovani', `Samořezný vrut ${velikost} má po zahloubení hlavy jen ${fmt(w - o.samorez.vyskaHlavy)} mm stěny na závit.`, ['sroub.velikost', 'knob.krcek']);
      if (p.sroub.uchyceni === 'zavit' && w < 2 * st.d) pridej('varovani', `Závit do plastu má jen ${fmt(w)} mm – snadno se strhne.`, 'sroub.uchyceni');
      if (ot.typ === 'kruh') pridej('info', 'U kulatého zapuštění drží knob jen šroubek – na hřídeli je dobré vybrousit plošku.', 'otvor.typ');
    } else if (ot.typ === 'kruh') pridej('varovani', 'Kulaté zapuštění bez šroubku – knob se bude na hřídeli protáčet (přilepte ho, nebo přidejte šroubek).', ['sroub.uchyceni', 'otvor.typ']);
    if (p.tisk.vypln < 60) pridej('varovani', `Výplň ${fmt(p.tisk.vypln, 0)} % je na knob málo – tiskněte 100 %.`, 'tisk.vypln', { pole: 'tisk.vypln', hodnota: 100, text: 'výplň 100 %' });
    return H;
  }

  /* ---------- pevnost (otáčení) ---------- */
  function pevnost(p, o) {
    const T = p.pevnost.moment * 1000, L = Math.min(o.hloubkaDiry, 30), ot = p.otvor;
    if (ot.typ === 'kruh' || !L) return null;
    const s = ot.typ === 'd' ? ot.rozmer * 0.6 : ot.rozmer;
    const tlak = 3 * T / (s * s * L), dov = { PLA: 50, PETG: 45, ASA: 40, PA: 50, PC: 60 }[p.tisk.material] * (0.55 + 0.45 * p.tisk.vypln / 100) * 0.6;
    return { tlak, dovolene: dov, k: dov / tlak };
  }

  /* ---------- tisk ---------- */
  /** Maska přemostitelných míst (strop otvoru, otvor šroubku, kapsa matice) pro rozbor převisů. */
  function maskaMostu(sit, p, o) {
    const P = sit.poz, I = sit.idx, m = new Uint8Array(I.length / 3), R = o.otvor.rOpsany + 0.1, st = o.staveci;
    const rS = Math.max(st.d / 2, o.samorez ? o.samorez.hlava / 2 : 0, o.vrut ? o.vrut.hlava / 2 : 0, st.vlozka / 2, st.matice * 0.6) + 0.6;
    for (let t = 0; t < m.length; t++) {
      const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
      const x = (P[a] + P[b] + P[c]) / 3, y = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, z = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
      if (z < o.zDiry1 + 0.05 && Math.hypot(x, y) < R) m[t] = 1;
      else if (o.zs !== undefined && y < 0 && Math.abs(x) < rS && z < o.zs + rS + 0.3) m[t] = 1;
      // úzké schody (krček ↔ odsazení) do 3 mm vytiskne tiskárna jako krátký převis
      else if (o.maOdsazeni && Math.abs(z - o.zN) < 0.45 && Math.abs(o.rO - o.rn) <= 3) m[t] = 1;
    }
    return m;
  }
  function rozborTisku(sit, p, o) {
    const maska = maskaMostu(sit, p, o), out = [], sinS = Math.sin(Math.min(89, p.tisk.previs + 15) * Math.PI / 180);
    for (const k of [{ klic: '-Z', nazev: 'spodkem dolů', dolu: [0, 0, -1] }, { klic: '+Z', nazev: 'vrcholem dolů', dolu: [0, 0, 1] }]) {
      const R = SP.rotaceDolu(k.dolu), pol = SP.tiskovaPoloha(sit, R), pv = SP.previsy(pol.poz, sit.idx, p.tisk.previs);
      const Pp = pol.poz, I = sit.idx;
      for (let t = 0; t < pv.tridy.length; t++) {
        if (!maska[t] || pv.tridy[t] !== 2) continue;
        const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
        const n = V.cross(V.sub([Pp[b], Pp[b + 1], Pp[b + 2]], [Pp[a], Pp[a + 1], Pp[a + 2]]), V.sub([Pp[c], Pp[c + 1], Pp[c + 2]], [Pp[a], Pp[a + 1], Pp[a + 2]]));
        const l = V.len(n); pv.volne -= l / 2; pv.most += l / 2; if (-n[2] / l > sinS) pv.strme -= l / 2; pv.tridy[t] = 1;
      }
      pv.volne = Math.max(0, pv.volne); pv.strme = Math.max(0, pv.strme);
      const skore = pv.volne * 5 + pv.strme * 20 + pv.vyska * 0.3 + (pv.podlozka < 20 ? 10000 : 0);
      out.push(Object.assign({}, k, { R, poz: pol.poz, tridy: pv.tridy, volne: pv.volne, strme: pv.strme, most: pv.most, podlozka: pv.podlozka, vyska: pv.vyska, skore }));
    }
    out.sort((a, b) => a.skore - b.skore);
    return { kandidati: out, nejlepsi: out[0], vybrana: out.find(v => v.klic === p.tisk.orientace) || out[0] };
  }
  function odhadTisku(objem, plocha, vyska, p) {
    const mat = MATERIALY[p.tisk.material];
    const plast = Math.min(objem, plocha * 1.2), V3 = plast + Math.max(0, objem - plast) * p.tisk.vypln / 100;
    return { gramy: V3 / 1000 * mat.hustota, metru: V3 / (Math.PI * 0.875 * 0.875) / 1000, minut: (V3 / 7 + vyska / 0.2 * 1.5) / 60 * 1.1 };
  }

  /* ---------- kusovník ---------- */
  function kusovnik(p, o) {
    const out = [], st = o.staveci, velikost = K.jmenoSroubu(p);
    if (p.sroub.uchyceni === 'zadne') return out;
    if (o.vrut) {
      const dv = K.delkaVrutu(o.vrut, o.stenaSroubu, true), L = dv.L;
      out.push({ ks: 1, co: `Vrut do dřeva ${velikost} × ${L} se zápustnou hlavou`, chyba: dv.vycniva > 0.5,
        pozn: dv.vycniva > 0.5 ? `nejkratší běžný vrut bude vyčnívat o ${fmt(dv.vycniva)} mm – zkraťte ho, nebo prohlubte zahloubení` : `předvrt Ø ${fmt(o.vrut.predvrt, 1)} a zahloubení hlavy jsou v modelu; špička se zaryje do hřídele` });
    } else if (o.samorez) {
      const ds = K.delkaVrutu(o.samorez, o.stenaSroubu, false), L = ds.L;
      out.push({ ks: 1, co: `Samořezný vrut do plastu ${velikost} × ${L} ${o.samorez.tvar === 'kuzel' ? 'se zápustnou' : 's válcovou'} hlavou (typ PT / Delta PT)`, chyba: ds.vycniva > 0.5,
        pozn: ds.vycniva > 0.5 ? `nejkratší běžný bude vyčnívat o ${fmt(ds.vycniva)} mm – prohlubte zahloubení` : `předvrt Ø ${fmt(o.samorez.predvrt, 1)} a zahloubení hlavy jsou v modelu` });
    } else out.push({ ks: 1, co: `Stavěcí šroub ${velikost} × ${o.delkaStav} s vnitřním šestihranem (ISO 4026 / 4029)`, pozn: `imbus ${fmt(st.klic, 1)} mm; ${fmt(p.sroub.odsazeni)} mm od začátku krčku` });
    if (p.sroub.uchyceni === 'matice') out.push({ ks: 1, co: `Matice ${velikost} (ISO 4032)`, pozn: 'zasune se do kapsy ze spodní plochy' });
    if (p.sroub.uchyceni === 'vlozka') out.push({ ks: 1, co: `Zalisovací vložka ${velikost} (otvor Ø ${fmt(st.vlozka, 1)})`, pozn: 'zatavit páječkou' });
    if (p.sroub.uchyceni === 'zavit') out.push({ ks: 1, co: `Závit ${velikost} vyříznout závitníkem`, pozn: `předvrt Ø ${fmt(st.predvrt, 1)} je v modelu` });
    return out;
  }

  /* ---------- náhodný knob ---------- */
  /** Vylosuje hlavu, krček, odsazení a půdorys; zapuštění, šroubek a tisk nechá. Zkouší, dokud kontroly nehlásí chybu. */
  function nahodnyKnob(p, nahoda = Math.random) {
    const mezi = (a, b) => a + (b - a) * nahoda(), vyber = a => a[Math.floor(nahoda() * a.length)];
    const tvary = Object.keys(K.TVARY_KNOBU).filter(t => t !== 'vlastni').concat(['generator', 'generator', 'generator']);
    const krcky = Object.keys(K.TVARY_KRCKU).filter(t => t !== 'vlastni').concat(['generator', 'generator']);
    const pudorysy = ['kruh', 'kruh', 'kruh'].concat(Object.keys(K.PUDORYSY));
    let posledni = null;
    for (let pokus = 0; pokus < 40; pokus++) {
      const q = kopie(p);
      const D = Math.round(mezi(40, 64));
      Object.assign(q.knob, {
        tvar: vyber(tvary), seminko: 1 + Math.floor(mezi(0, 999998)), prumer: D, hlava: Math.round(D * mezi(0.55, 1.05)),
        krcek: Math.round(mezi(Math.max(17, q.otvor.rozmer * 1.41 + 7), Math.min(30, D * 0.55))), podrez: nahoda() < 0.85,
        pudorys: vyber(pudorysy), pocet: Math.round(mezi(6, 18)), hloubka: Math.round(mezi(0.6, 2) * 10) / 10,
        stoupani: Math.round(mezi(-150, 150)), pomer: Math.round(mezi(0.65, 0.9) * 100) / 100,
      });
      Object.assign(q.krcek, { tvar: vyber(krcky), seminko: 1 + Math.floor(mezi(0, 999998)), mira: Math.round(mezi(0.6, 1.6) * 10) / 10, delka: Math.round(mezi(12, 26)) });
      const lim = nahoda() < 0.75;
      q.odsazeni = lim ? { prumer: Math.round(q.knob.krcek + mezi(4, 12)), vyska: Math.round(mezi(2, 6)) } : { prumer: 0, vyska: 0 };
      const r = normalizuj(q).p, o = odvozene(r);
      posledni = r;
      if (!kontroly(r, o).some(h => h.uroven === 'chyba')) return r;
    }
    return posledni;
  }

  /* ---------- projekt ---------- */
  function ulozProjekt(p) { return JSON.stringify({ format: 'webapp_knob', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2); }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || o.format !== 'webapp_knob') throw new Error('Soubor není projekt knobu (chybí "format": "webapp_knob").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }
  function popis(p) {
    const q = p.knob, t = q.tvar === 'generator' ? `🎲 ${q.seminko}` : K.TVARY_KNOBU[q.tvar].nazev.toLowerCase();
    return `${t} Ø ${fmt(q.prumer)}, krček Ø ${fmt(q.krcek)} × ${fmt(p.krcek.delka)}, ${ZAPUSTENI[p.otvor.typ].nazev} ${fmt(p.otvor.rozmer, 2)}`;
  }

  const API = {
    VERZE_FORMATU, ZAPUSTENI, ROZMERY_ZAPUSTENI, UCHYCENI, MATERIALY, VYCHOZI, ROZSAHY, PREDVOLBY,
    normalizuj, zPredvolby, nahodnyKnob, obrysOtvoru, miryOtvoru, odvozene, kontroly, pevnost, maskaMostu, rozborTisku, odhadTisku, kusovnik,
    ulozProjekt, nactiProjekt, popis, fmt,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.KNOB = API;
})();
