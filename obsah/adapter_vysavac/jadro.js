/* Adaptér nářadí → vysavač – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Přechod z vývodu odsávání nářadí (konec A) na koncovku hadice vysavače (konec B).

   Každý díl je rotační trubka podél dráhy osy (rovně, ohyb v rovině XZ, esíčko). Dráha má délku s (mm),
   s = 0 je spodek dílu (leží na podložce), osa jde nahoru (+Z) a ohýbá se k +X. Tvar dílu popisují dva seznamy
   [s, r] – poloměr dutiny (rIn) a vnějšku (rOut); každá změna poloměru je kužel nejvýš „tisk.uhel“ od svislice,
   takže díl jde tisknout nastojato bez podpor. Ohyb je nejvýš tisk.uhel na díl, větší ohyb se rozdělí na díly
   spojené zasunutím (lepený spoj). Konec A je dole (svisle), konec B nahoře.

   Konec: protikus je ČEP (typ 'vnejsi' – adaptér je HRDLO a nasouvá se na něj) nebo HRDLO (typ 'vnitrni' – adaptér
   je ČEP a zasouvá se do něj). Spoj s protikusem: kužel (vůle u ústí + přídavný kužel = sevření v hloubce), rovný
   s vůlí, závit. Volitelně drážka pro O-kroužek. Rychlospojka (bajonet / klip) rozdělí konec na dva díly:
   na adaptéru zůstane zásuvka spojky, protikus nese nástrčku spojky a lícování na vývod / hadici.
   Seznamy konce jsou v souřadnici u = hloubka od čela dílu dovnitř. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const ZG = uzel ? require('../ibc/geometrie.js') : window.IBC_GEOM;   // zavitovaTyc
  const DB = uzel ? require('./databaze.js') : window.ADVYS_DB;
  const fmt = G.fmt, kopie = G.kopie;
  const rad = s => s * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const RHO = 1.2, NU = 1.5e-5;   // vzduch 20 °C
  const BOK = 50;                   // bok závitu od roviny kolmé k ose (°) – strmější než 45°, tiskne se bez podpor

  /* ---------------- tabulky ---------------- */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27 },
    ASA: { nazev: 'ASA', hustota: 1.07 },
    ABS: { nazev: 'ABS', hustota: 1.04 },
    PA: { nazev: 'PA (nylon)', hustota: 1.14 },
    PLA: { nazev: 'PLA', hustota: 1.24 },
    TPU: { nazev: 'TPU 95A (pružný)', hustota: 1.21 },
  };
  const NAZVY = {
    typ: { vnejsi: 'nasunout NA čep (vnější Ø)', vnitrni: 'zasunout DO hrdla (vnitřní Ø)' },
    spoj: { kuzel: 'kónické nasunutí', rovne: 'rovné s vůlí', zavit: 'závit' },
    spojka: { zadna: 'bez rychlospojky', bajonet: 'bajonet', klip: 'rychlospojka s klipem' },
    osa: { rovna: 'rovná', ohyb: 'ohnutá', posun: 'posunutá (esíčko)' },
    konec: { A: 'nářadí', B: 'vysavač' },
  };

  /** Vlastní rozměry uživatele (stránka je nastaví z localStorage) – hledají se stejně jako databáze. */
  let MOJE = [];
  const nastavMoje = seznam => { MOJE = Array.isArray(seznam) ? seznam : []; };
  const najdi = id => DB.najdi(id) || MOJE.find(x => x.id === id) || null;
  /** Parametry konce z databáze (+ odchylky). */
  function konecZDb(id, navic) {
    const x = najdi(id), e = { zdroj: id };
    if (x) {
      Object.assign(e, { typ: x.typ, d0: x.d0, d1: x.d1, L: x.L });
      if (x.spoj) e.spoj = x.spoj;
      if (x.stoupani) e.stoupani = x.stoupani;
      if (x.hloubka) e.hloubka = x.hloubka;
    }
    return Object.assign(e, navic || {});
  }
  const KONEC = { zdroj: 'vlastni', typ: 'vnejsi', d0: 35, d1: 34, L: 25, spoj: 'kuzel', vule: 0.15, kuzel: 0.5, stoupani: 6, hloubka: 1.5, oring: false, snura: 2.5, doraz: 2, spojka: 'zadna' };
  const VYCHOZI = {
    verze: 1, nazev: 'Adaptér na vysavač',
    A: Object.assign(kopie(KONEC), konecZDb('bosch_zelena')),
    B: Object.assign(kopie(KONEC), konecZDb('karcher_wd')),
    stena: 2,
    prechod: { delka: 0 },                                    // 0 = automaticky
    osa: { typ: 'rovna', uhel: 45, posun: 20, polomer: 0 },   // polomer 0 = automaticky (1,5 × Ø)
    sterbina: { zap: false, pocet: 3, sirka: 3, vyska: 12, vule: 0.25 },
    spojka: { prumer: 0, delka: 20, vule: 0.25, zubu: 3, uhel: 30, jazycku: 2, presah: 0.8 },
    kalibrace: { konec: 'A', krok: 0.1, kusu: 5, vyska: 12 },
    tisk: { material: 'PETG', uhel: 45, vrstva: 0.2, sad: 1 },
    proud: { prutok: 80, podtlak: 4, drsnost: 0.05 },        // m³/h, kPa v místě adaptéru, mm
  };
  const MEZE = {
    stena: [0.8, 6], 'prechod.delka': [0, 300],
    'osa.uhel': [0, 90], 'osa.posun': [0, 150], 'osa.polomer': [0, 400],
    'sterbina.pocet': [1, 8, 1], 'sterbina.sirka': [1.5, 10], 'sterbina.vyska': [4, 40], 'sterbina.vule': [0, 1],
    'spojka.prumer': [0, 200], 'spojka.delka': [8, 60], 'spojka.vule': [0, 1], 'spojka.zubu': [2, 6, 1], 'spojka.uhel': [10, 90],
    'spojka.jazycku': [2, 4, 1], 'spojka.presah': [0.3, 2],
    'kalibrace.krok': [0.02, 0.5], 'kalibrace.kusu': [3, 7, 1], 'kalibrace.vyska': [5, 30],
    'tisk.uhel': [30, 60], 'tisk.vrstva': [0.05, 0.5], 'tisk.sad': [1, 10, 1],
    'proud.prutok': [0, 2000], 'proud.podtlak': [0.1, 60], 'proud.drsnost': [0, 1],
  };
  for (const X of ['A', 'B']) {
    Object.assign(MEZE, {
      [X + '.d0']: [3, 200], [X + '.d1']: [3, 200], [X + '.L']: [5, 120], [X + '.vule']: [-0.5, 2], [X + '.kuzel']: [0, 5],
      [X + '.stoupani']: [1, 20], [X + '.hloubka']: [0.3, 6], [X + '.snura']: [1, 6], [X + '.doraz']: [0, 10],
    });
  }
  const VYCTY = {
    'A.typ': ['vnejsi', 'vnitrni'], 'B.typ': ['vnejsi', 'vnitrni'], 'A.spoj': Object.keys(NAZVY.spoj), 'B.spoj': Object.keys(NAZVY.spoj),
    'A.spojka': Object.keys(NAZVY.spojka), 'B.spojka': Object.keys(NAZVY.spojka), 'osa.typ': Object.keys(NAZVY.osa),
    'kalibrace.konec': ['A', 'B'], 'tisk.material': Object.keys(MATERIALY),
  };

  /** Předvolby: jen odchylky od výchozího projektu (tisk zůstává uživatelův). */
  const PREDVOLBY = [
    { id: 'pex_karcher', nazev: 'Bruska Bosch PEX → Kärcher WD', popis: 'kónické nasunutí na oba čepy, Ø 26,5 → Ø 35,5', p: {} },
    { id: 'festool_std32', nazev: 'Festool D27 → trubka 32 mm', popis: 'čep do vývodu Festool, hrdlo na standardní trubku', p: { nazev: 'Festool D27 – trubka 32', A: konecZDb('festool_d27'), B: konecZDb('std32') } },
    { id: 'pila_bajonet', nazev: 'Pila Makita → Kärcher s bajonetem', popis: 'bajonetová rychlospojka na straně hadice (3 zuby, 30°)', p: { nazev: 'Pila – Kärcher bajonet', A: konecZDb('makita_hs'), B: konecZDb('karcher_wd', { spojka: 'bajonet' }) } },
    { id: 'bruska_klip', nazev: 'Bruska Parkside → vysavač Parkside s klipem', popis: 'rychlospojka s pružnými západkami', p: { nazev: 'Parkside klip', A: konecZDb('parkside_pexs'), B: konecZDb('parkside_pnts', { spojka: 'klip' }) } },
    { id: 'dewalt_ohyb', nazev: 'Stolní pila 2½″ → trubka 35 mm, ohyb 60°', popis: 'ohyb rozdělený na 2 díly po 30°', p: { nazev: 'Pila 2,5″ – 35 mm ohyb', A: konecZDb('dewalt_25', { doraz: 3 }), B: konecZDb('std35'), osa: { typ: 'ohyb', uhel: 60 } } },
    { id: 'hoblik_posun', nazev: 'Hoblík → Makita 38 mm, posunutá osa', popis: 'esíčko s posunem 25 mm', p: { nazev: 'Hoblík – posun', A: konecZDb('makita_kp'), B: konecZDb('makita_vc38'), osa: { typ: 'posun', posun: 25 } } },
    { id: 'frezka_vlnita', nazev: 'Frézka → vlnitá hadice 32 mm (závit)', popis: 'hadice se našroubuje na vnější závit', p: { nazev: 'Frézka – vlnitá hadice', A: konecZDb('makita_rt'), B: konecZDb('vlnita32', { vule: 0.3 }) } },
    { id: 'sterbina', nazev: 'Pila Bosch → Nilfisk Attix se štěrbinou', popis: 'regulace podtlaku otočnou objímkou', p: { nazev: 'Bosch – Nilfisk štěrbina', A: konecZDb('bosch_modra'), B: konecZDb('nilfisk_attix'), sterbina: { zap: true } } },
    { id: 'festool_oring', nazev: 'Festool D36 → Kärcher, O-kroužek', popis: 'rovné nasunutí s O-kroužkem 2,5 mm na straně hadice', p: { nazev: 'Festool D36 – Kärcher O-kroužek', A: konecZDb('festool_d36'), B: konecZDb('karcher_wd', { spoj: 'rovne', vule: 0.4, oring: true }) } },
  ];

  function normalizuj(v) {
    const r = G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
    for (const X of ['A', 'B']) r.p[X].zdroj = String(r.p[X].zdroj || 'vlastni').slice(0, 80);
    return r;
  }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  /** Lze konec odvodit z databáze beze změn rozměrů? → položka, jinak null. */
  function zdrojKonce(e) {
    const x = najdi(e.zdroj);
    if (!x) return null;
    const stejne = x.typ === e.typ && Math.abs(x.d0 - e.d0) < 1e-6 && Math.abs(x.d1 - e.d1) < 1e-6 && Math.abs(x.L - e.L) < 1e-6;
    return Object.assign({ upraveno: !stejne }, x);
  }
  function nazevKonce(e) {
    const x = zdrojKonce(e);
    if (!x) return `vlastní ${e.typ === 'vnejsi' ? 'čep' : 'hrdlo'} Ø ${fmt(e.d0, 1)}`;
    return `${x.znacka ? x.znacka + ' ' : ''}${x.nazev}${x.upraveno ? ' (upraveno)' : ''}`;
  }

  /* ---------------- konce ---------------- */
  /** Definice konce (u = hloubka od čela dílu): {hrdlo, L, rIn, rOut, Lend, bore, ven, zavit, oring, r(u), lic}. */
  function defKonce(e, t) {
    const hrdlo = e.typ === 'vnejsi', L = e.L, doraz = e.doraz;
    const D = { hrdlo, L, t, spoj: e.spoj, zavit: null, oring: null, oringNevejde: false };
    if (e.spoj === 'zavit') {
      const h = e.hloubka, pz = e.stoupani;
      if (hrdlo) {
        const rMaj = e.d0 / 2 + e.vule, rMin = rMaj - h;
        D.zavit = { vnitrni: true, p: pz, h, bok: BOK, rMaj, rMin, u0: -0.5, u1: L };
        D.rIn = [[0, rMaj + 0.3], [rMaj + 0.3 - rMin, rMin], [L, rMin]];
        D.Lend = L;
        if (doraz > 0) { D.rIn.push([L + doraz, rMin - doraz]); D.Lend += doraz; }
        const ro = rMaj + t;
        D.rOut = [[0, ro - 0.5], [0.5, ro], [D.Lend, ro]];
        D.lic = [2 * rMaj, 2 * rMaj];
      } else {
        const rMin = e.d0 / 2 - e.vule, rMaj = rMin + h;
        D.zavit = { vnitrni: false, p: pz, h, bok: BOK, rMaj, rMin, u0: 0, u1: L };
        D.rOut = [[0, rMin], [L, rMin], [L + h + doraz, rMaj + doraz]];
        D.Lend = L + h + doraz;
        D.rIn = [[0, rMin - t], [D.Lend, rMin - t]];
        D.lic = [2 * rMin, 2 * rMin];
      }
    } else {
      const k = e.spoj === 'kuzel' ? Math.tan(rad(e.kuzel)) : 0, c = e.vule;
      const cp = d => (e.d0 + (e.d1 - e.d0) * d / L) / 2;   // poloměr protikusu v hloubce d od jeho ústí
      const r = hrdlo ? (u => cp(u) + c - u * k) : (u => { const d = L - u; return cp(d) - c - d * k; });
      // náběh u čela: zk na poloměr, sklon nejvýš ~41° i na strmém kuželu protikusu
      const zk = Math.min(0.8, L * 0.04 + 0.3), zk2 = zk / Math.max(0.3, 0.87 - Math.abs(r(L) - r(0)) / L);
      let og = null;
      if (e.oring) {
        // boky drážky ~39° od osy (i na kuželu protikusu pod 45°), dno 0,6 šňůry
        const d = 0.75 * e.snura, f = 1.25 * d, w = 2 * f + 0.6 * e.snura, g0 = Math.max(zk2 + 1.5, L * 0.5 - w / 2);
        if (g0 + w <= L - 1) og = { d, f, w, g0, snura: e.snura }; else D.oringNevejde = true;
      }
      D.oring = og;
      const sg = hrdlo ? 1 : -1, dr = og ? og.d * sg : 0;
      const lic = [[0, r(0) + sg * zk], [zk2, r(zk2)]];
      if (og) lic.push([og.g0, r(og.g0)], [og.g0 + og.f, r(og.g0 + og.f) + dr], [og.g0 + og.w - og.f, r(og.g0 + og.w - og.f) + dr], [og.g0 + og.w, r(og.g0 + og.w)]);
      lic.push([L, r(L)]);
      D.Lend = L;
      if (doraz > 0) { lic.push([L + doraz, r(L) - sg * doraz]); D.Lend += doraz; }
      if (hrdlo) {
        const ro = Math.max(r(0) + zk, r(L)) + t + (og ? og.d : 0);
        D.rIn = lic; D.rOut = [[0, ro - 0.5], [0.5, ro], [D.Lend, ro]];
      } else {
        const ri = Math.min(r(0) - zk, r(L)) - t - (og ? og.d : 0);
        D.rOut = lic; D.rIn = [[0, ri], [D.Lend, ri]];
      }
      D.r = r; D.zk = zk;
      D.lic = [2 * r(0), 2 * r(L)];
    }
    D.bore = D.rIn[D.rIn.length - 1][1];
    D.ven = D.rOut[D.rOut.length - 1][1];
    return D;
  }
  /** Kalibrační kroužek: jen lícovaná část konce (u hrdla od ústí, u čepu u kořene), bez dorazu a drážky. */
  function defKalibrace(e, t, Lr) {
    const hrdlo = e.typ === 'vnejsi';
    const D = { hrdlo, L: Lr, Lend: Lr, zavit: null };
    if (e.spoj === 'zavit') {
      const h = e.hloubka;
      if (hrdlo) {
        const rMaj = e.d0 / 2 + e.vule, rMin = rMaj - h;
        D.zavit = { vnitrni: true, p: e.stoupani, h, bok: BOK, rMaj, rMin, u0: -0.5, u1: Lr + 0.5 };
        D.rIn = [[0, rMaj + 0.3], [rMaj + 0.3 - rMin, rMin], [Lr, rMin]];
        D.rOut = [[0, rMaj + t], [Lr, rMaj + t]];
        D.lic = 2 * rMaj;
      } else {
        const rMin = e.d0 / 2 - e.vule;
        D.zavit = { vnitrni: false, p: e.stoupani, h, bok: BOK, rMaj: rMin + h, rMin, u0: 0, u1: Lr };
        D.rOut = [[0, rMin], [Lr, rMin]];
        D.rIn = [[0, rMin - t], [Lr, rMin - t]];
        D.lic = 2 * rMin;
      }
      return D;
    }
    const k = e.spoj === 'kuzel' ? Math.tan(rad(e.kuzel)) : 0, c = e.vule, L = e.L;
    const cp = d => (e.d0 + (e.d1 - e.d0) * d / L) / 2;
    if (hrdlo) {
      const r = u => cp(u) + c - u * k, zk = 0.6;
      D.rIn = [[0, r(0) + zk], [zk, r(zk)], [Lr, r(Lr)]];
      const ro = r(0) + zk + t;
      D.rOut = [[0, ro], [Lr, ro]];
      D.lic = 2 * r(0);
    } else {
      const ua = L - Lr, r = u => { const d = L - (ua + u); return cp(d) - c - d * k; }, zk = 0.6;
      D.rOut = [[0, r(0) - zk], [zk, r(zk)], [Lr, r(Lr)]];
      const ri = Math.min(r(0) - zk, r(Lr)) - t;
      D.rIn = [[0, ri], [Lr, ri]];
      D.lic = 2 * r(Lr);
    }
    return D;
  }
  /** Zásuvka rychlospojky (na adaptéru): hrdlo Rc, doraz na průměr nástrčky. */
  function defZasuvka(Rc, Lc, vs, t) {
    const Lend = Lc + vs + t;
    return { hrdlo: true, spojka: true, L: Lc, Lend, rIn: [[0, Rc + 0.6], [0.6, Rc], [Lc, Rc], [Lend, Rc - vs - t]], rOut: [[0, Rc + t - 0.5], [0.5, Rc + t], [Lend, Rc + t]], bore: Rc - vs - t, ven: Rc + t, lic: [2 * Rc, 2 * Rc] };
  }
  /** Nástrčka rychlospojky (na protikusu): čep Rc − vůle, límec do Rc + stěna. */
  function defNastrcka(Rc, Lc, vs, t) {
    const Lm = Lc - 0.5, Rm = Rc - vs, Lend = Lm + vs + t;
    return { hrdlo: false, spojka: true, L: Lm, Lend, rOut: [[0, Rm - 0.6], [0.6, Rm], [Lm, Rm], [Lend, Rc + t]], rIn: [[0, Rm - t], [Lend, Rm - t]], bore: Rm - t, ven: Rc + t, Rm, lic: [2 * Rm, 2 * Rm] };
  }
  /** Spoj dílů děleného ohybu: čep nahoře dílu i (vnitřek = trubka), hrdlo dole dílu i + 1. */
  function defSpojCep(rb, vo, t, Lj) {
    const rj = rb + t, L = Lj - 0.3, rOut = [[0, rj - 0.4], [0.4, rj], [L, rj]];
    if (vo > rj + 0.05) rOut.push([L + vo - rj, vo]);
    const Lend = rOut[rOut.length - 1][0];
    return { hrdlo: false, spojDilu: true, L, Lend, rOut, rIn: [[0, rb], [Lend, rb]], bore: rb, ven: Math.max(vo, rj), lic: [2 * rj, 2 * rj] };
  }
  function defSpojHrdlo(rb, t, Lj, vj) {
    const rh = rb + t + vj, Lend = Lj + rh - rb;
    return { hrdlo: true, spojDilu: true, L: Lj, Lend, rIn: [[0, rh + 0.4], [0.4, rh], [Lj, rh], [Lend, rb]], rOut: [[0, rh + t - 0.5], [0.5, rh + t], [Lend, rh + t]], bore: rb, ven: rh + t, lic: [2 * rh, 2 * rh] };
  }

  /* ---------------- dráha osy a díl ---------------- */
  /** Rám dráhy v délce s: {P, T (tečna), X (v rovině ohybu), Y}. Kusy: {typ:'rovna'|'oblouk', s0, s1, R, smer}. */
  function ramec(cesta, s) {
    let x = 0, z = 0, psi = 0;
    for (const c of cesta) {
      const d = Math.min(Math.max(s, c.s0), c.s1) - c.s0;
      if (c.typ === 'rovna') { x += d * Math.sin(psi); z += d * Math.cos(psi); }
      else {
        const sg = c.smer, cx = x + sg * c.R * Math.cos(psi), cz = z - sg * c.R * Math.sin(psi), psi2 = psi + sg * d / c.R;
        x = cx - sg * c.R * Math.cos(psi2); z = cz + sg * c.R * Math.sin(psi2); psi = psi2;
      }
      if (s <= c.s1) break;
    }
    if (cesta.length && s > cesta[cesta.length - 1].s1) { const d = s - cesta[cesta.length - 1].s1; x += d * Math.sin(psi); z += d * Math.cos(psi); }
    if (s < 0) z += s;   // prodloužení pod spodek (první kus je vždy rovný a svislý)
    return { P: [x, 0, z], T: [Math.sin(psi), 0, Math.cos(psi)], X: [Math.cos(psi), 0, -Math.sin(psi)], Y: [0, 1, 0], psi };
  }
  /** Rám konce dílu: osa u míří do dílu (dole +T, nahoře −T; X otočené, aby rám zůstal pravotočivý). */
  function ramecKonce(n, kde) {
    if (kde === 'spodek') return ramec(n.cesta, 0);
    const F = ramec(n.cesta, n.S), m = v => v.map(x => -x);
    return { P: F.P, T: m(F.T), X: m(F.X), Y: F.Y };
  }
  const doSveta = (F, x, y, z) => [F.P[0] + x * F.X[0] + y * F.Y[0] + z * F.T[0], F.P[1] + x * F.X[1] + y * F.Y[1] + z * F.T[1], F.P[2] + x * F.X[2] + y * F.Y[2] + z * F.T[2]];
  /** Složení umístění: rám F zadaný v souřadnicích M → svět. */
  function sloz(M, F) {
    const R = v => [v[0] * M.X[0] + v[1] * M.Y[0] + v[2] * M.T[0], v[0] * M.X[1] + v[1] * M.Y[1] + v[2] * M.T[1], v[0] * M.X[2] + v[1] * M.Y[2] + v[2] * M.T[2]];
    return { P: doSveta(M, F.P[0], F.P[1], F.P[2]), X: R(F.X), Y: R(F.Y), T: R(F.T) };
  }
  const JEDNOTKA = { P: [0, 0, 0], X: [1, 0, 0], Y: [0, 1, 0], T: [0, 0, 1] };
  /** Inverzní rám (tuhé těleso). */
  function inverzni(F) {
    const X = [F.X[0], F.Y[0], F.T[0]], Y = [F.X[1], F.Y[1], F.T[1]], T = [F.X[2], F.Y[2], F.T[2]];
    const P = [0, 1, 2].map(i => -(X[i] * F.P[0] + Y[i] * F.P[1] + T[i] * F.P[2]));
    return { P, X, Y, T };
  }
  /** Otočení rámu kolem jeho osy T o úhel γ (°). */
  function otocRam(F, g) {
    const c = Math.cos(rad(g)), s = Math.sin(rad(g)), X = F.X, Y = F.Y;
    return { P: F.P, T: F.T, X: [0, 1, 2].map(i => c * X[i] + s * Y[i]), Y: [0, 1, 2].map(i => -s * X[i] + c * Y[i]) };
  }

  /** Návrh jednoho dílu: spodní konec, přechod na rozhraní horního konce, krk se štěrbinou, ohyby, horní konec. */
  function navrhDilu(spodek, vrch, vol) {
    const tg = Math.tan(rad(vol.uhel));
    const dIn = Math.abs(vrch.bore - spodek.bore), dOut = Math.abs(vrch.ven - spodek.ven);
    const Lmin = Math.max(dIn, dOut) / tg;
    const Lauto = Math.max(Lmin, dIn / Math.tan(rad(15)), dIn + dOut > 0.01 ? 3 : 0);
    const Lp = vol.Lp > 0 ? vol.Lp : Lauto;
    const rIn = spodek.rIn.map(q => q.slice()), rOut = spodek.rOut.map(q => q.slice());
    let s = spodek.Lend + Lp;
    if (Lp > 0) { rIn.push([s, vrch.bore]); rOut.push([s, vrch.ven]); }
    let krk = null;
    if (vol.krk) {
      const vo = vrch.ven, s0 = s + 1, z0 = s0 + 3, z1 = z0 + vol.krk.hO + 1;
      rOut.push([s0, vo], [s0 + 1, vo + 1], [s0 + 2, vo + 1], [z0, vo], [z1, vo], [z1 + 1, vo + 1], [z1 + 2, vo + 1], [z1 + 3, vo]);
      krk = { s0: z0, s1: z1, sc: (z0 + z1) / 2, vo, ri: vrch.bore };
      s = z1 + 4;
    }
    const cesta = [];
    const ohyby = vol.ohyby || [];
    if (ohyby.length) {
      s += 2;
      cesta.push({ typ: 'rovna', s0: 0, s1: s });
      for (const o of ohyby) {
        const l = o.typ === 'oblouk' ? rad(o.uhel) * o.R : o.delka;
        cesta.push(Object.assign({}, o, { s0: s, s1: s + l }));
        s += l;
      }
      s += 2;
    }
    const S = Math.max(s + vrch.Lend, spodek.Lend + vrch.Lend);
    if (ohyby.length) cesta.push({ typ: 'rovna', s0: cesta[cesta.length - 1].s1, s1: S });
    else cesta.push({ typ: 'rovna', s0: 0, s1: S });
    for (const [u, r] of vrch.rIn.slice().reverse()) rIn.push([S - u, r]);
    for (const [u, r] of vrch.rOut.slice().reverse()) rOut.push([S - u, r]);
    return { spodek, vrch, rIn: vycisti(rIn), rOut: vycisti(rOut), S, cesta, krk, Lp, Lmin, Lauto, uhelPrechodu: Lp > 0 ? deg(Math.atan(dIn / Lp)) : (dIn > 0.01 ? 90 : 0) };
  }
  /** Seznam [s, r] seřazený, bez opakovaných bodů. */
  function vycisti(b) {
    const out = [];
    for (const q of b) {
      const l = out[out.length - 1];
      if (l && Math.abs(l[0] - q[0]) < 1e-7 && Math.abs(l[1] - q[1]) < 1e-7) continue;
      out.push(q);
    }
    return out;
  }
  /** Poloměr v délce s (lineárně; mimo rozsah krajní hodnota). */
  function rV(b, s) {
    if (s <= b[0][0]) return b[0][1];
    for (let i = 1; i < b.length; i++) if (s <= b[i][0]) { const [s0, r0] = b[i - 1], [s1, r1] = b[i]; return s1 - s0 < 1e-9 ? r1 : r0 + (r1 - r0) * (s - s0) / (s1 - s0); }
    return b[b.length - 1][1];
  }

  /** Doporučený O-kroužek do drážky konce: {ID, snura} (hrdlo: kroužek ve vnitřní drážce, čep: navléknutý s napětím ~3 %). */
  function oringKonce(fit) {
    const og = fit.oring;
    if (!og) return null;
    const rs = fit.r(og.g0 + og.w / 2), dno = 2 * (fit.hrdlo ? rs + og.d : rs - og.d);
    const ID = fit.hrdlo ? dno - 2 * og.snura : 0.97 * dno;
    return { ID: Math.round(ID * 2) / 2, snura: og.snura, dno };
  }

  /* ---------------- rychlospojka ---------------- */
  /** Rozměry bajonetu / klipu pro zásuvku Rc. */
  function rozmerySpojky(p, Rc) {
    const sp = p.spojka, t = p.stena, vs = sp.vule, Lm = sp.delka - 0.5, Rm = Rc - vs;
    const B = { Rc, Rm, Lm, t, vs };
    // bajonet: zub (radiální hranol se spodkem 45°), vstupní drážka a obvodová drážka v zásuvce
    const pr = vs + 0.6 * t + 0.5;
    B.bw = Math.max(3, Math.min(8, 2 * Math.PI * Rc / sp.zubu * 0.18));
    B.bh = Math.max(pr + 1.5, Math.min(6, 0.25 * Rc));
    B.pr = pr;
    B.we = B.bw + 2 * vs + 0.4; B.hs = B.bh + 2 * vs + 0.3;
    B.df = Math.min(Lm - B.bh / 2 - 1, B.bh / 2 + 5);            // hloubka obvodové drážky od ústí zásuvky
    B.zabrano = 2 * deg(B.we / Rc) + sp.uhel + deg(3 / Rc);      // úhel na jeden zub (vstup + otočení + šířka zubu + můstek)
    // klip: jazýček vyříznutý ve stěně nástrčky, háček se spodkem 45°, okénko v zásuvce
    const n = sp.jazycku, e = sp.presah;
    B.tw = Math.max(5, Math.min(10, 2 * Math.PI * Rm / n * 0.22)); B.ws = 1.2;
    B.lt = Lm - 2; B.u1 = 1.2; B.a = 1.5 * e; B.c = 1.2; B.e = e;
    B.yh = (B.tw - 1) / 2; B.x0 = Math.sqrt(Rm * Rm - B.yh * B.yh) - 0.3;   // pata háčku zapuštěná do jazýčku
    B.hak = B.u1 + B.a + B.c + 1.15 * (Rm + e - B.x0);                         // spodek háčku strmější než 45°
    B.zf0 = Lm - B.hak - 0.2; B.zf1 = Lm - B.u1 + 0.3;           // okénko v zásuvce (hloubka od ústí)
    B.pretvoreni = 1.5 * t * e / (B.lt * B.lt) * 100;            // % – vetknutý nosník s posuvem e na konci
    return B;
  }

  /* ---------------- celý návrh (bez geometrie) ---------------- */
  function navrh(p) {
    const t = p.stena, sp = p.spojka, uh = p.tisk.uhel;
    const konce = {};
    for (const X of ['A', 'B']) {
      const e = p[X], fit = defKonce(e, t), K = { X, e, fit };
      if (e.spojka !== 'zadna') {
        K.Rc = sp.prumer > 0 ? sp.prumer / 2 : Math.ceil((fit.bore + t + sp.vule) * 4) / 4;
        K.zasuvka = defZasuvka(K.Rc, sp.delka, sp.vule, t);
        K.nastrcka = defNastrcka(K.Rc, sp.delka, sp.vule, t);
        K.adapter = K.zasuvka;
        K.protikus = navrhDilu(fit, K.nastrcka, { uhel: uh, Lp: 0 });
        K.sp = rozmerySpojky(p, K.Rc);
      } else K.adapter = fit;
      konce[X] = K;
    }
    const A = konce.A.adapter, B = konce.B.adapter, rb = B.bore, vo = B.ven, os = p.osa;
    const Rb = os.polomer > 0 ? os.polomer : Math.ceil(Math.max(vo + 3, 3 * rb));
    let dilu = 1, ohyby = [], beta = 0, mezi = 0, otocitB = false;
    // drážka, závit nebo zásuvka spojky na šikmém horním konci by převisaly → díl s koncem B se tiskne obráceně
    // (konec B dole na podložce); mají-li je oba konce, ohyb se rozdělí aspoň na 2 díly
    const slozity = d => !!(d.oring || d.zavit || d.spojka);
    if (os.typ === 'ohyb' && os.uhel > 0.01) {
      dilu = Math.max(1, Math.ceil(os.uhel / uh - 1e-9));
      if (slozity(B) && slozity(A)) dilu = Math.max(2, dilu);
      otocitB = slozity(B);
      ohyby = [{ typ: 'oblouk', R: Rb, uhel: os.uhel / dilu, smer: 1 }];
    } else if (os.typ === 'posun' && os.posun > 0.01) {
      const e = os.posun, mez = 2 * Rb * (1 - Math.cos(rad(uh)));
      if (mez >= e) { beta = deg(Math.acos(1 - e / (2 * Rb))); mezi = 0; } else { beta = uh; mezi = (e - mez) / Math.sin(rad(uh)); }
      ohyby = [{ typ: 'oblouk', R: Rb, uhel: beta, smer: 1 }];
      if (mezi > 0.01) ohyby.push({ typ: 'rovna', delka: mezi });
      ohyby.push({ typ: 'oblouk', R: Rb, uhel: beta, smer: -1 });
    }
    const Lj = Math.max(10, Math.min(20, rb)), vj = 0.15;
    const cepJ = defSpojCep(rb, vo, t, Lj), hrdJ = defSpojHrdlo(rb, t, Lj, vj);
    const krk = p.sterbina.zap ? { hO: p.sterbina.vyska + 4 } : null;
    const dily = [];
    for (let i = 0; i < dilu; i++) {
      let dol = i === 0 ? A : hrdJ, nah = i === dilu - 1 ? B : cepJ;
      const obr = otocitB && i === dilu - 1;
      if (obr) [dol, nah] = [nah, dol];
      const d = navrhDilu(dol, nah, { uhel: uh, Lp: i === 0 ? p.prechod.delka : 0, krk: i === 0 ? krk : null, ohyby });
      d.obraceny = obr;
      d.kdeA = obr ? 'vrch' : 'spodek'; d.kdeB = obr ? 'spodek' : 'vrch';   // konec ke straně nářadí / vysavače
      dily.push(d);
    }
    // umístění v sestavě: hrdlo spoje dílu i + 1 sedí ústím na límci čepu dílu i
    const ramA = d => (d.obraceny ? otocRam(ramecKonce(d, d.kdeA), 180) : ramecKonce(d, d.kdeA));
    const ramy = [dily[0].obraceny ? inverzni(ramA(dily[0])) : JEDNOTKA];   // konec A vždy v počátku, osa nahoru
    for (let i = 1; i < dilu; i++) {
      const Fc = sloz(ramy[i - 1], ramecKonce(dily[i - 1], dily[i - 1].kdeB));
      const Fh = { P: doSveta(Fc, 0, 0, cepJ.L), T: Fc.T.map(x => -x), X: Fc.X.map(x => -x), Y: Fc.Y };
      // obrácený díl: rám jeho horního konce otočený o 180° kolem osy, jinak by se ohyb zrcadlil (esíčko místo oblouku)
      ramy.push(sloz(Fh, inverzni(ramA(dily[i]))));
    }
    const umisteni = {}, umisteniVykres = {};
    for (const X of ['A', 'B']) {
      const K = konce[X];
      if (!K.protikus) continue;
      const dp = K.protikus, posun = dp.S - K.nastrcka.L;
      let F;
      if (X === 'A') F = { P: [0, 0, 0], X: [1, 0, 0], Y: [0, 1, 0], T: [0, 0, 1] };
      else F = sloz(ramy[dilu - 1], ramecKonce(dily[dilu - 1], dily[dilu - 1].kdeB));
      umisteniVykres[X] = { P: doSveta(F, 0, 0, -posun), X: F.X, Y: F.Y, T: F.T };   // výkres: bez natočení bajonetu (rovina řezu)
      F = otocRam(F, p[X].spojka === 'bajonet' ? sp.uhel : 0);
      umisteni[X] = { P: doSveta(F, 0, 0, -posun), X: F.X, Y: F.Y, T: F.T };
    }
    const posl = dily[dilu - 1], rTrubky = otocitB ? posl.vrch.bore : rb;
    return { konce, dily, dilu, Rb, beta, mezi, Lj, vj, cepJ, hrdJ, ramy, umisteni, umisteniVykres, rb, vo, otocitB, rTrubky };
  }

  /* ---------------- proudění ---------------- */
  /** Body dutiny ve směru proudění (nářadí → vysavač): [x (mm), r (mm)] + ohyby. */
  function drahaProudu(p, nv) {
    const body = [];
    let x0 = 0;
    const pridej = (n, sa, sb, obratit) => {
      const b = [[sa, rV(n.rIn, sa)], ...n.rIn.filter(q => q[0] > sa + 1e-9 && q[0] < sb - 1e-9), [sb, rV(n.rIn, sb)]];
      const c = obratit ? b.map(([s, r]) => [sb - s, r]).reverse() : b.map(([s, r]) => [s - sa, r]);
      for (const [x, r] of c) body.push([x0 + x, r]);
      x0 += sb - sa;
    };
    const kA = nv.konce.A, kB = nv.konce.B;
    if (kA.protikus) pridej(kA.protikus, kA.fit.hrdlo ? kA.fit.Lend : 0, kA.protikus.S, false);
    for (const d of nv.dily) {   // v hrdlech proudí vzduch zasunutým protikusem / čepem
      const sa = d.spodek.hrdlo ? d.spodek.Lend : 0, sb = d.vrch.hrdlo ? d.S - d.vrch.Lend : d.S;
      pridej(d, sa, Math.max(sa, sb), d.obraceny);
    }
    if (kB.protikus) pridej(kB.protikus, kB.fit.hrdlo ? kB.fit.Lend : 0, kB.protikus.S, true);
    let uhel = 0;
    if (p.osa.typ === 'ohyb') uhel = p.osa.uhel; else if (p.osa.typ === 'posun' && p.osa.posun > 0.01) uhel = 2 * nv.beta;
    return { body, uhelOhybu: uhel, rOhybu: nv.rTrubky };
  }
  /** Tlaková ztráta a rychlosti při průtoku Q (m³/h). */
  function proudeni(p, nv, Q) {
    if (Q === undefined) Q = p.proud.prutok;
    const { body, uhelOhybu, rOhybu } = drahaProudu(p, nv);
    const q = Q / 3600, eps = p.proud.drsnost / 1000;
    const v = r => q / (Math.PI * (r / 1000) ** 2);
    let treni = 0, zmeny = 0;
    for (let i = 0; i + 1 < body.length; i++) {
      const [xa, ra] = body[i], [xb, rb] = body[i + 1], L = (xb - xa) / 1000;
      const rm = (ra + rb) / 2, D = 2 * rm / 1000, vm = v(rm), Re = vm * D / NU;
      if (L > 0 && Re > 1) {
        const lam = Re < 2300 ? 64 / Re : 0.25 / Math.log10(eps / (3.7 * D) + 5.74 / Re ** 0.9) ** 2;
        treni += lam * L / D * RHO * vm * vm / 2;
      }
      if (Math.abs(rb - ra) > 1e-4) {
        const th = 2 * Math.atan(Math.abs(rb - ra) / Math.max(1e-6, xb - xa)), b2 = (Math.min(ra, rb) / Math.max(ra, rb)) ** 2, vs = v(Math.min(ra, rb));
        let K;
        if (rb > ra) K = th <= rad(45) ? 2.6 * Math.sin(th / 2) * (1 - b2) ** 2 : (1 - b2) ** 2;
        else K = th <= rad(45) ? 0.8 * Math.sin(th / 2) * (1 - b2) : 0.5 * Math.sqrt(Math.sin(th / 2)) * (1 - b2);
        zmeny += K * RHO * vs * vs / 2;
      }
    }
    const vb = v(rOhybu), ohyb = 0.25 * uhelOhybu / 90 * RHO * vb * vb / 2;
    const rMin = Math.min(...body.map(b => b[1])), rMax = Math.max(...body.map(b => b[1]));
    const dp = treni + zmeny + ohyb;
    const vMin = v(rMax), vMax = v(rMin), Re = vMax * 2 * rMin / 1000 / NU;
    const sb = p.sterbina, As = sb.zap ? sb.pocet * (sb.sirka * sb.vyska - sb.sirka * sb.sirka / 2) : 0;
    const Qb = As > 0 ? 0.62 * As * 1e-6 * Math.sqrt(2 * p.proud.podtlak * 1000 / RHO) * 3600 : 0;
    return { Q, dp, treni, zmeny, ohyb, vMin, vMax, Re, dMin: 2 * rMin, dMax: 2 * rMax, delka: body.length ? body[body.length - 1][0] : 0, As, Qb, body,
      vA: v(body[0][1]), vB: v(body[body.length - 1][1]), podil: dp / (p.proud.podtlak * 1000) * 100,
      doporuceno: [18, 25].map(c => c * Math.PI * (rMax / 1000) ** 2 * 3600) };
  }
  function krivkaProudeni(p, nv, Qmax, n = 30) {
    const out = [];
    for (let i = 0; i <= n; i++) { const Q = Qmax * i / n; out.push({ Q, dp: i ? proudeni(p, nv, Q).dp : 0 }); }
    return out;
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], nv = navrh(p), t = p.stena, uh = p.tisk.uhel, sp = p.spojka;
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = (c, h) => ({ zmeny: { [c]: Math.round(h * 100) / 100 } });
    for (const X of ['A', 'B']) {
      const e = p[X], K = nv.konce[X], fit = K.fit, jm = X === 'A' ? 'Konec nářadí' : 'Konec vysavače', c = s => X + '.' + s;
      if (e.spoj !== 'zavit' && e.d1 > e.d0 + 0.01) info([c('d0'), c('d1')], `${jm}: Ø v hloubce je větší než u ústí – zkontrolujte, zda nejsou rozměry prohozené (kužel se do hloubky zužuje).`);
      const kuzelProtikusu = deg(Math.atan(Math.abs(e.d0 - e.d1) / 2 / e.L));
      if (e.spoj !== 'zavit' && kuzelProtikusu > 3) info([c('d0'), c('d1'), c('L')], `${jm}: protikus se kónicky mění o ${fmt(kuzelProtikusu, 1)}° na stranu – adaptér kopíruje jeho kužel.`);
      if (e.L < 15) var_([c('L')], `${jm}: délka zasunutí ${fmt(e.L)} mm je krátká – spoj nebude držet ani těsnit. Doporučeno aspoň 20 mm.`, opr(c('L'), 20));
      if (e.spoj === 'rovne' && e.vule > 0.6 && !e.oring) var_([c('vule')], `${jm}: vůle ${fmt(e.vule, 2)} mm na poloměr je velká – adaptér bude volně viset. Zvolte kužel nebo O-kroužek.`, opr(c('vule'), 0.25));
      if (e.spoj === 'rovne' && e.vule < 0) info([c('vule')], `${jm}: záporná vůle = lisovaný spoj, nasazuje se silou (zahřátý adaptér).`);
      if (e.spoj === 'kuzel') {
        const sev = e.L * Math.tan(rad(e.kuzel)) - e.vule;
        if (sev > 0.6) var_([c('kuzel'), c('vule')], `${jm}: v hloubce ${fmt(e.L)} mm sevře kužel protikus o ${fmt(sev, 2)} mm na poloměr – adaptér nepůjde nasadit až na doraz nebo praskne. Zmenšete přídavný kužel.`, opr(c('kuzel'), Math.max(0, Math.floor(deg(Math.atan((e.vule + 0.3) / e.L)) * 20) / 20)));
        else if (sev < -0.3) info([c('kuzel'), c('vule')], `${jm}: kužel protikus nesevře (vůle v hloubce ${fmt(-sev, 2)} mm) – spoj bude volný. Zvětšete přídavný kužel nebo zmenšete vůli.`);
      }
      if (e.spoj === 'zavit') {
        if (e.hloubka > 0.38 * e.stoupani) chyba([c('hloubka'), c('stoupani')], `${jm}: závit je na stoupání ${fmt(e.stoupani, 1)} mm moc hluboký (${fmt(e.hloubka, 1)} mm) – strmé boky pro tisk bez podpor by se nevešly. Nejvýš ${fmt(Math.floor(3.8 * e.stoupani) / 10, 1)} mm.`, opr(c('hloubka'), Math.floor(3.8 * e.stoupani) / 10));
        if (e.stoupani < 1.5) var_([c('stoupani')], `${jm}: stoupání ${fmt(e.stoupani, 1)} mm se tiskne nepřesně.`);
        if (e.oring) info([c('oring')], `${jm}: drážka pro O-kroužek se u závitu nedělá – těsní závit (případně páska).`);
      }
      if (fit.oringNevejde) chyba([c('oring'), c('L'), c('snura')], `${jm}: drážka pro O-kroužek ${fmt(e.snura, 1)} mm se do délky zasunutí nevejde – prodlužte zasunutí nebo zmenšete šňůru.`, opr(c('L'), Math.ceil(2.5 * e.snura + 5)));
      if (fit.oring && e.spoj === 'kuzel') info([c('spoj')], `${jm}: s O-kroužkem volte rovný spoj s vůlí 0,3–0,5 mm – těsní kroužek, ne kužel.`);
      if (fit.bore < 3) chyba([c('d0'), 'stena', c('doraz')], `${jm}: průchod konce vychází jen Ø ${fmt(2 * Math.max(0, fit.bore), 1)} mm – zmenšete stěnu nebo doraz.`);
      if (fit.hrdlo && e.doraz > 0 && e.doraz < 1) info([c('doraz')], `${jm}: doraz ${fmt(e.doraz, 1)} mm je úzký – protikus se může zaseknout do přechodu.`);
      if (e.spojka !== 'zadna') {
        const B = K.sp;
        if (sp.prumer > 0 && K.Rc < fit.bore + t + sp.vule - 0.01) chyba(['spojka.prumer'], `${jm}: rychlospojka Ø ${fmt(sp.prumer, 1)} mm je užší než průchod konce – zvětšete ji aspoň na Ø ${fmt(2 * Math.ceil((fit.bore + t + sp.vule) * 4) / 4, 2)} mm (0 = automaticky).`, opr('spojka.prumer', 0));
        if (e.spojka === 'bajonet') {
          if (B.zabrano > 360 / sp.zubu - 2) chyba(['spojka.zubu', 'spojka.uhel'], `${jm}: ${sp.zubu} zuby s natočením ${fmt(sp.uhel)}° se na obvod spojky nevejdou – zmenšete úhel nebo počet zubů.`, opr('spojka.uhel', Math.max(10, Math.floor(360 / sp.zubu - 2 - 2 * deg(B.we / K.Rc) - deg(3 / K.Rc)))));
          if (B.df < B.bh / 2 + 2) chyba(['spojka.delka'], `${jm}: rychlospojka je na bajonet krátká – prodlužte ji.`, opr('spojka.delka', Math.ceil(B.bh * 2 + 8)));
        } else {
          if (sp.jazycku * (B.tw + 2 * B.ws + 3) > 2 * Math.PI * B.Rm) chyba(['spojka.jazycku'], `${jm}: ${sp.jazycku} jazýčky se na nástrčku nevejdou – zmenšete jejich počet.`, opr('spojka.jazycku', 2));
          if (B.zf0 < 2.5) chyba(['spojka.delka'], `${jm}: rychlospojka je na klip krátká – nad okénkem západky nezbude materiál. Prodlužte ji.`, opr('spojka.delka', Math.ceil(B.hak + 6)));
          if (B.pretvoreni > 4) var_(['spojka.presah', 'spojka.delka', 'stena'], `${jm}: jazýček západky se při zacvaknutí přetvoří asi o ${fmt(B.pretvoreni, 1)} % – může prasknout. Zmenšete přesah západky nebo prodlužte spojku.`, opr('spojka.presah', Math.max(0.3, Math.floor(3.5 * B.lt * B.lt / (1.5 * t * 100) * 10) / 10)));
          if (sp.vule >= sp.presah) chyba(['spojka.presah', 'spojka.vule'], `${jm}: přesah západky (${fmt(sp.presah, 2)} mm) musí být větší než vůle spojky (${fmt(sp.vule, 2)} mm), jinak klip nedrží.`, opr('spojka.presah', sp.vule + 0.5));
        }
        if (sp.vule < 0.1) var_(['spojka.vule'], `Vůle rychlospojky ${fmt(sp.vule, 2)} mm je malá – díly do sebe nepůjdou zasunout. Vytiskněte kalibraci, obvykle 0,2–0,3 mm.`, opr('spojka.vule', 0.25));
        if (p.tisk.material === 'TPU') info(['tisk.material'], 'Pružné TPU se na rychlospojku nehodí – bajonet ani klip nebudou držet. Spojku tiskněte z PETG.');
      }
    }
    // přechod
    const d1 = nv.dily[0];
    if (p.prechod.delka > 0 && p.prechod.delka < d1.Lmin - 0.01) chyba(['prechod.delka'], `Přechod ${fmt(p.prechod.delka)} mm je na změnu průměru krátký – kužel by převisal víc než ${fmt(uh)}°. Nejméně ${fmt(Math.ceil(d1.Lmin * 10) / 10, 1)} mm.`, opr('prechod.delka', Math.ceil(d1.Lmin)));
    else if (d1.uhelPrechodu > 30) info(['prechod.delka'], `Přechod rozšiřuje průchod pod úhlem ${fmt(d1.uhelPrechodu, 0)}° na stranu – proud se odtrhne a ztráta vzroste. Delší přechod je plynulejší.`);
    // osa
    const os = p.osa;
    if (os.typ !== 'rovna') {
      if (nv.Rb < nv.vo + 1) chyba(['osa.polomer'], `Poloměr ohybu ${fmt(nv.Rb)} mm je menší než vnějšek trubky – vnitřní strana by se protnula. Nejméně ${fmt(Math.ceil(nv.vo + 2))} mm (0 = automaticky).`, opr('osa.polomer', Math.ceil(nv.vo + 2)));
      if (os.typ === 'ohyb' && os.uhel < 0.01) info(['osa.uhel'], 'Ohyb 0° – adaptér je rovný.');
      if (os.typ === 'ohyb' && nv.dilu > 1) info(['osa.uhel', 'tisk.uhel'], `Ohyb ${fmt(os.uhel)}° je víc než ${fmt(uh)}° na díl – adaptér se rozdělí na ${nv.dilu} díly po ${fmt(os.uhel / nv.dilu, 1)}°, které se zasunou do sebe a slepí (tisk bez podpor).`);
      if (os.typ === 'posun' && os.posun < 0.01) info(['osa.posun'], 'Posun 0 mm – adaptér je rovný.');
      if (nv.otocitB) info(['osa.uhel', 'B.oring', 'B.spoj', 'B.spojka'], 'Ohnutý díl s koncem vysavače se tiskne obráceně – konec B dole na podložce. Drážka, závit nebo zásuvka spojky by na šikmém horním konci převisaly.');
    }
    // štěrbina
    const sb = p.sterbina;
    if (sb.zap) {
      const sektor = (sb.pocet - 1) * deg((sb.sirka + 2.5) / nv.vo) + deg(sb.sirka / nv.vo);
      if (sektor > 100) chyba(['sterbina.pocet', 'sterbina.sirka'], `Štěrbiny zabírají ${fmt(sektor, 0)}° obvodu – objímka je zakryje jen do 100°. Zmenšete počet nebo šířku štěrbin.`, opr('sterbina.pocet', Math.max(1, Math.floor((100 - deg(sb.sirka / nv.vo)) / deg((sb.sirka + 2.5) / nv.vo)) + 1)));
      if (sb.vyska < sb.sirka + 2) chyba(['sterbina.vyska'], 'Štěrbina musí být aspoň o 2 mm vyšší než široká – konce jsou zahrocené 45° kvůli tisku bez podpor.', opr('sterbina.vyska', Math.ceil(sb.sirka + 4)));
    }
    if (t < 1.2) var_(['stena'], `Stěna ${fmt(t, 1)} mm je tenká – aspoň 3 dráhy trysky (1,2 mm), lépe 2 mm.`, opr('stena', 1.6));
    const a = p.A, b = p.B;
    if (a.typ === b.typ && Math.abs(a.d0 - b.d0) < 0.3 && Math.abs(a.d1 - b.d1) < 0.3 && a.spojka === 'zadna' && b.spojka === 'zadna' && os.typ === 'rovna' && !sb.zap)
      info(['A.d0', 'B.d0'], 'Oba konce mají stejný rozměr – vznikne obyčejná spojka.');
    if (p.tisk.material === 'PLA') info(['tisk.material'], 'PLA měkne už kolem 55 °C – adaptér u motoru nářadí se může zdeformovat. Lepší je PETG nebo ASA.');
    for (const h of H) if (h.oprava && !h.oprava.text) h.oprava.text = textOpravy(h.oprava.zmeny);
    return H;
  }
  const POPISKY = {
    'A.L': h => `zasunutí nářadí ${fmt(h, 2)} mm`, 'B.L': h => `zasunutí vysavače ${fmt(h, 2)} mm`,
    'A.vule': h => `vůle nářadí ${fmt(h, 2)} mm`, 'B.vule': h => `vůle vysavače ${fmt(h, 2)} mm`,
    'A.kuzel': h => `kužel nářadí ${fmt(h, 2)}°`, 'B.kuzel': h => `kužel vysavače ${fmt(h, 2)}°`,
    'A.hloubka': h => `hloubka závitu ${fmt(h, 2)} mm`, 'B.hloubka': h => `hloubka závitu ${fmt(h, 2)} mm`,
    'prechod.delka': h => `přechod ${fmt(h, 2)} mm`, 'osa.polomer': h => `poloměr ohybu ${fmt(h, 2)} mm`,
    'spojka.prumer': () => 'spojka automaticky', 'spojka.uhel': h => `natočení ${fmt(h, 2)}°`, 'spojka.delka': h => `délka spojky ${fmt(h, 2)} mm`,
    'spojka.jazycku': h => `${h} jazýčky`, 'spojka.presah': h => `přesah západky ${fmt(h, 2)} mm`, 'spojka.vule': h => `vůle spojky ${fmt(h, 2)} mm`,
    'sterbina.pocet': h => `${h} štěrbiny`, 'sterbina.vyska': h => `výška štěrbiny ${fmt(h, 2)} mm`, stena: h => `stěna ${fmt(h, 2)} mm`,
  };
  const textOpravy = zmeny => Object.entries(zmeny).map(([c, h]) => (POPISKY[c] ? POPISKY[c](h) : `${c} ${h}`)).join(', ');

  /* ---------------- stavba těles ---------------- */
  const segmenty = r => Math.max(48, Math.min(160, Math.ceil(2 * Math.PI * r / 0.9 / 4) * 4));

  /** Sestaví díly přes manifold-3d → {dily, protikusy, objimka, kalibrace, tisk, sestava, nv, cas}. */
  function postav(w, p, volby = {}) {
    const t0 = Date.now(), nv = navrh(p), t = p.stena, sp = p.spojka;
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const doRamu = (m, F) => k(m.warp(v => { const q = doSveta(F, v[0], v[1], v[2]); v[0] = q[0]; v[1] = q[1]; v[2] = q[2]; }));
    const kostka = (x0, x1, y0, y1, z0, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const otocZ = (m, g) => k(m.rotate([0, 0, g]));
    const obalka = body => k(M.hull(body));

    /** Těleso ze seznamu [s, r] podél dráhy: rovné kusy rotací profilu, oblouky obálkami prstenců. */
    function teleso(seznam, n, rozsir) {
      const N = segmenty(Math.max(...seznam.map(q => q[1])));
      const kusy = [];
      for (const c of n.cesta) {
        let a = c.s0, b = c.s1;
        if (b - a < 1e-6) continue;
        // sousední kusy se o 0,05 mm překrývají – jen dotyk ploch by manifold nechal jako dvě tělesa
        if (a > 1e-9) a -= 0.05; else if (rozsir) a = -1;
        if (b < n.S - 1e-9) b += 0.05; else if (rozsir) b = n.S + 1;
        if (c.typ === 'rovna') {
          const pr = [[0, 0], [rV(seznam, a), 0]];
          for (const q of seznam) if (q[0] > a + 1e-9 && q[0] < b - 1e-9) pr.push([q[1], q[0] - a]);
          pr.push([rV(seznam, b), b - a], [0, b - a]);
          const rot = k(k(new CS([pr], 'NonZero')).revolve(N));
          const F = ramec(n.cesta, Math.max(a, c.s0)), F0 = a < c.s0 ? { P: doSveta(F, 0, 0, a - c.s0), X: F.X, Y: F.Y, T: F.T } : F;
          kusy.push(doRamu(rot, F0));
        } else {
          const m = Math.max(2, Math.ceil(deg((c.s1 - c.s0) / c.R) / 3));
          const kruh = (s, dz) => {
            const F = ramec(n.cesta, s), r = rV(seznam, s), out = [];
            for (let j = 0; j < N; j++) { const al = 2 * Math.PI * j / N; out.push(doSveta(F, r * Math.cos(al), r * Math.sin(al), dz)); }
            return out;
          };
          for (let i = 0; i < m; i++) {
            const sa = c.s0 + (c.s1 - c.s0) * i / m, sb = c.s0 + (c.s1 - c.s0) * (i + 1) / m;
            kusy.push(obalka(kruh(sa, -0.05).concat(kruh(sb, 0.05))));
          }
        }
      }
      return kusy.length === 1 ? kusy[0] : k(M.union(kusy));
    }
    /** Závitová tyč konce v rámu konce (u od čela). */
    function zavitKonce(z, F) {
      const N = Math.max(48, Math.min(120, Math.ceil(2 * Math.PI * z.rMaj / 0.9 / 4) * 4));
      const tyc = zavitTyc(w, k, { p: z.p, h: z.h, bok: z.bok, rMaj: z.rMaj }, z.u1 - z.u0, N);
      return doRamu(k(tyc.translate([0, 0, z.u0])), F);
    }
    /** Díl z návrhu + prvky: {plne: [], odeb: []} (manifoldy ve světě dílu). */
    function dil(n, prvky) {
      const plne = [teleso(n.rOut, n, false)], odeb = [teleso(n.rIn, n, true)];
      for (const [def, kde] of [[n.spodek, 'spodek'], [n.vrch, 'vrch']]) {
        if (def.zavit) (def.zavit.vnitrni ? odeb : plne).push(zavitKonce(def.zavit, ramecKonce(n, kde)));
      }
      if (prvky) { plne.push(...(prvky.plne || [])); odeb.push(...(prvky.odeb || [])); }
      return k(k(M.union(plne)).subtract(k(M.union(odeb))));
    }
    /** Drážky bajonetu / okénka klipu v zásuvce (rám zásuvky: u = hloubka od ústí). */
    function zasuvkaPrvky(K, F, druh) {
      const B = K.sp, Rc = K.Rc, n = druh === 'bajonet' ? sp.zubu : sp.jazycku, out = [];
      for (let i = 0; i < n; i++) {
        const fi = 360 * i / n;
        if (druh === 'bajonet') {
          out.push(doRamu(otocZ(kostka(Rc - 1, Rc + t + 1, -B.we / 2, B.we / 2, -1, B.df + B.hs / 2), fi), F));
          const wd = deg(B.we / Rc);
          const ob = k(k(new CS([[[Rc - 1, B.df - B.hs / 2], [Rc + t + 1, B.df - B.hs / 2], [Rc + t + 1, B.df + B.hs / 2], [Rc - 1, B.df + B.hs / 2]]], 'NonZero')).revolve(segmenty(Rc), sp.uhel + wd));
          out.push(doRamu(otocZ(ob, fi - wd / 2), F));
        } else {
          out.push(doRamu(otocZ(kostka(Rc - 1, Rc + t + 1, -(B.tw + 0.6) / 2, (B.tw + 0.6) / 2, B.zf0, B.zf1), fi), F));
        }
      }
      return out;
    }
    /** Zuby bajonetu / jazýčky klipu na nástrčce protikusu (souřadnice protikusu, nástrčka nahoře v S). */
    function nastrckaPrvky(K, S, druh) {
      const B = K.sp, Rm = B.Rm, Rc = K.Rc, plne = [], odeb = [];
      if (druh === 'bajonet') {
        const zb = S - B.Lm + B.df, xi = Rm - 0.5, xo = Rc + 0.6 * t;
        for (let i = 0; i < sp.zubu; i++) {
          const b = [];
          for (const y of [-B.bw / 2, B.bw / 2]) b.push([xi, y, zb - B.bh / 2], [xi, y, zb + B.bh / 2], [xo, y, zb - B.bh / 2 + (xo - xi)], [xo, y, zb + B.bh / 2]);
          plne.push(otocZ(obalka(b), 360 * i / sp.zubu));
        }
      } else {
        for (let i = 0; i < sp.jazycku; i++) {
          const fi = 360 * i / sp.jazycku;
          for (const sg of [-1, 1]) {
            const y0 = sg * (B.tw / 2 + B.ws / 2);
            odeb.push(otocZ(kostka(Rm - t - 1, Rm + 1, y0 - B.ws / 2, y0 + B.ws / 2, S - B.lt, S + 1), fi));
          }
          const yh = B.yh, x0 = B.x0, b = [];
          const z = u => S - u;
          for (const y of [-yh, yh]) b.push([x0, y, z(B.u1)], [Rm + B.e, y, z(B.u1 + B.a)], [Rm + B.e, y, z(B.u1 + B.a + B.c)], [x0, y, z(B.hak)]);
          plne.push(otocZ(obalka(b), fi));
        }
      }
      return { plne, odeb };
    }

    try {
      /* ---- díly adaptéru ---- */
      const dilyM = nv.dily.map((n, i) => {
        const pr = { plne: [], odeb: [] };
        for (const X of ['A', 'B']) for (const kde of ['spodek', 'vrch']) {
          if (n[kde] === nv.konce[X].zasuvka) pr.odeb.push(...zasuvkaPrvky(nv.konce[X], ramecKonce(n, kde), p[X].spojka));
        }
        if (n.krk) {
          const sb = p.sterbina, F = ramec(n.cesta, n.krk.sc), krok = deg((sb.sirka + 2.5) / n.krk.vo);
          for (let j = 0; j < sb.pocet; j++) {
            const fi = (j - (sb.pocet - 1) / 2) * krok, a = sb.sirka / 2, h = sb.vyska / 2, b = [];
            for (const x of [n.krk.ri - 0.5, n.krk.vo + 2]) b.push([x, 0, -h], [x, a, -h + a], [x, a, h - a], [x, 0, h], [x, -a, h - a], [x, -a, -h + a]);
            pr.odeb.push(doRamu(otocZ(obalka(b), fi), F));
          }
        }
        return dil(n, pr);
      });
      /* ---- protikusy rychlospojky ---- */
      const protM = {};
      for (const X of ['A', 'B']) {
        const K = nv.konce[X];
        if (K.protikus) protM[X] = dil(K.protikus, nastrckaPrvky(K, K.protikus.S, p[X].spojka));
      }
      /* ---- regulační objímka (C) ---- */
      let objM = null;
      const krk = nv.dily[0].krk;
      if (krk) {
        const Ri = krk.vo + p.sterbina.vule, hO = p.sterbina.vyska + 4;
        objM = k(k(new CS([[[Ri, 0], [Ri + 2.4, 0], [Ri + 2.4, hO], [Ri, hO]]], 'NonZero')).revolve(segmenty(Ri), 240));
      }
      /* ---- kalibrační kroužky ---- */
      const kalM = [];
      if (volby.kalibrace) {
        const kal = p.kalibrace, e0 = p[kal.konec];
        for (let i = 0; i < kal.kusu; i++) {
          const vu = Math.round((e0.vule + (i - (kal.kusu - 1) / 2) * kal.krok) * 1000) / 1000;
          const D = defKalibrace(Object.assign({}, e0, { vule: vu }), t, Math.min(kal.vyska, e0.L));
          const n = { rIn: D.rIn, rOut: D.rOut, S: D.Lend, cesta: [{ typ: 'rovna', s0: 0, s1: D.Lend }], spodek: D, vrch: { Lend: 0 } };
          const ro = Math.max(...D.rOut.map(q => q[1])) + (D.zavit && !D.zavit.vnitrni ? D.zavit.h : 0);
          const odeb = [];
          for (let j = 0; j <= i; j++) odeb.push(otocZ(kostka(ro - 1, ro + 1, -0.6, 0.6, D.Lend - 1.2, D.Lend + 1), 15 * j));
          kalM.push({ m: dil(n, { odeb }), vule: vu, lic: D.lic, i });
        }
      }

      const B1 = '#2F5FA8', B2 = '#E88A2E', B3 = '#3FA06B';
      const dily = dilyM.map((m, i) => sit(k, m, 'adapter' + (nv.dilu > 1 ? '_' + (i + 1) : ''), nv.dilu > 1 ? `Adaptér – díl ${i + 1}` : 'Adaptér', B1));
      const protikusy = {};
      for (const X of Object.keys(protM)) protikusy[X] = sit(k, protM[X], 'protikus_' + X, `Nástrčka spojky – ${NAZVY.konec[X]}`, B2);
      const objimka = objM ? sit(k, objM, 'objimka', 'Regulační objímka', B3) : null;
      const kalibrace = kalM.map(x => Object.assign(sit(k, x.m, `kal_${x.i + 1}`, `Kalibrační kroužek ${x.i + 1} (vůle ${fmt(x.vule, 2)})`, x.i === (p.kalibrace.kusu - 1) / 2 ? B1 : B2), { vule: x.vule, lic: x.lic }));
      // sestava
      const sestava = dily.map((d, i) => Object.assign({}, d, { poz: presun(d.poz, nv.ramy[i]) }));
      for (const X of Object.keys(protikusy)) sestava.push(Object.assign({}, protikusy[X], { poz: presun(protikusy[X].poz, nv.umisteni[X]) }));
      if (objimka) sestava.push(Object.assign({}, objimka, { poz: presun(objimka.poz, otocRam(ramec(nv.dily[0].cesta, krk.s0 + 0.5), 60)) }));
      const tisk = dily.concat(Object.values(protikusy), objimka ? [objimka] : []);
      return { dily, protikusy, objimka, kalibrace, tisk, sestava, nv, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  /** Závitová tyč od z = 0 do delka (profil IBC_GEOM.profilZavitu). Na rozdíl od IBC_GEOM.zavitovaTyc se každá vrstva
      vytlačení pootočí právě o jeden vrchol průřezu – trojúhelníky pak sledují šroubovici a boky nehlásí falešné převisy.
      Oba konce se seříznou kuželem strmějším než 45° (závit vybíhá plynule – žádná vodorovná plocha v žádné poloze). */
  function zavitTyc(w, k, z, delka, N) {
    const { CrossSection: CS } = w, ot = delka / z.p, b = [];
    for (let i = 0; i < N; i++) { const t = i / N, a = 2 * Math.PI * t, r = ZG.profilZavitu(t, z); b.push([r * Math.cos(a), r * Math.sin(a)]); }
    const tyc = k(k(new CS([b], 'NonZero')).extrude(delka, Math.max(1, Math.round(ot * N)), 360 * ot));
    const c = Math.min(1.2 * z.h, delka / 3), R = z.rMaj + 0.3, hc = 1.2 * (c + 0.3);
    return k(tyc.intersect(k(k(new CS([[[0, 0], [z.rMaj - c, 0], [R, hc], [R, delka - hc], [z.rMaj - c, delka], [0, delka]]], 'NonZero')).revolve(N))));
  }
  function presun(P, F) {
    const out = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) { const q = doSveta(F, P[i], P[i + 1], P[i + 2]); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; }
    return out;
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
    const H = [];
    for (const d of model.tisk.concat(model.kalibrace)) {
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      const r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 5) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v místě převisu může potřebovat podpory.` });
      if (r.most > 1) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu.` });
    }
    return H;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const sp = X => (p[X].spojka !== 'zadna' ? ` + ${NAZVY.spojka[p[X].spojka]}` : '');
    const osa = p.osa.typ === 'ohyb' ? ` · ohyb ${fmt(p.osa.uhel)}°` : p.osa.typ === 'posun' ? ` · posun ${fmt(p.osa.posun)} mm` : '';
    return `${nazevKonce(p.A)} → ${nazevKonce(p.B)}${sp('B')}${sp('A')}${osa}`;
  }
  const TYP = 'adapter_vysavac';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Adaptéru na vysavač');

  const API = {
    MATERIALY, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY, DB, KONEC,
    normalizuj, predvolba, konecZDb, nastavMoje, najdi, zdrojKonce, nazevKonce, defKonce, defKalibrace, navrh, navrhDilu, ramec, ramecKonce, rV,
    proudeni, krivkaProudeni, drahaProudu, oringKonce, sloz, doSveta, otocRam, inverzni, JEDNOTKA, kontroly, postav, kontrolyModelu, presun, rozmerySpojky,
    popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt, segmenty,
  };
  if (uzel) module.exports = API; else window.ADVYS = API;
})();
