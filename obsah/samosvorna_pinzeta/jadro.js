/* Samosvorná pinzeta – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Tvar podle náčrtu: nahoře pružné oko, z něj dvě tuhá ramena, která se kříží v kloubu, pod křížením přejdou
   na opačnou stranu, rozbíhají se do kosočtverce a sbíhají v čelisti.
   Souřadnice: pinzeta leží na podložce, z = 0 je podložka, výška nástroje v ose Z; špička je v y = 0, oko nahoře (+y),
   osa souměrnosti x = 0. Rameno A začíná na oku vlevo a čelist má vpravo, B je zrcadlo.

   Sestavená poloha = jak pinzeta vypadá složená (čelisti u sebe). Tisk:
     otevrena  – oko se při tisku rozevře o úhel δ (ramena otočená ven kolem konců oka, oblouk oka se stejnou délkou
                 a menším úhlem), ramena nejsou překřížená; po složení vznikne předpětí – špičky tlačí k sobě,
     sestavena – tiskne se složená s mezerou mezi čelistmi, bez předpětí (jen tak jde čep tištěný v sestavě).
   Mechanika: ramena se při otevírání otáčejí kolem konců oka, takže se v křížení po sobě posouvají vodorovně
   (relativní posun s). Pevný čep by z pinzety udělal nůžky (stisk by zavíral) – čep proto jede v drážce v rameni B. */
(function () {
  'use strict';
  const G = typeof module !== 'undefined' ? require('../gen3d/zaklad.js') : window.G3D;
  const fmt = G.fmt;

  /** E modul pružnosti (MPa) a přípustné přetvoření pružiny (%) – hrubé hodnoty pro tištěný díl. */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, E: 2000, eps: 2.0 },
    PLA: { nazev: 'PLA', hustota: 1.24, E: 3300, eps: 1.2 },
    ASA: { nazev: 'ASA', hustota: 1.07, E: 2000, eps: 1.8 },
    ABS: { nazev: 'ABS', hustota: 1.04, E: 2100, eps: 1.8 },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, E: 1400, eps: 3.0 },
  };
  const NAZVY = {
    kloub: { vlastni: 'vlastní čep (šroub, kolík)', rovny: 'tištěný rovný čep', zacvak: 'tištěný zacvakávací čep', cep: 'tištěný pojištěný čep (jen v sestavě)', volne: 'volné křížení' },
    spicka: { ostra: 'ostrá', plocha: 'plochá' },
    vzor: { hladke: 'hladké', zoubky: 'zoubky', vlnky: 'vlnky', ryhy: 'příčné rýhy', drazka: 'drážka na drát' },
    stav: { otevrena: 'otevřená (předpětí složením)', sestavena: 'sestavená (bez předpětí)' },
    uchop: { zadny: 'bez úchopu', ryhy: 'rýhy na ramenech' },
  };

  const VYCHOZI = {
    verze: 2, nazev: 'Samosvorná pinzeta',
    tvar: { delka: 110, oko: 50, krizeni: 36, rozpeti: 20, vyska: 6 },
    pruz: { oko: 1.8, rameno: 4, vyskaOka: 0 },
    uchop: { typ: 'ryhy', pocet: 6, hloubka: 0.6 },
    celist: {
      delka: 12, sirka: 3, spicka: 'ostra', konec: 1.2, vyskaSpicky: 3, mezera: 0, sbihavost: 0.4,
      zahnuti: 0, vzor: 'hladke', roztec: 1.2, hloubkaVzoru: 0.5, delkaVzoru: 0, drazka: 1.6, polohaDrazky: 5,
    },
    kloub: {
      typ: 'vlastni', prumer: 11, otevreni: 8, vule: 0.4, cep: 3.5, podil: 50,
      prumerCepu: 3, vuleOtvoru: 0.1, hlava: 0, hlavaHloubka: 1.2, matice: 0, maticeHloubka: 1.6,
    },
    tisk: { stav: 'otevrena', rozevreni: 40, usi: false, usiPrumer: 8, vrstva: 0.2, uhel: 45, material: 'PETG', kusu: 1 },
  };
  /** Meze číselných polí [min, max, celé?]. */
  const MEZE = {
    'tvar.delka': [50, 260], 'tvar.oko': [14, 140], 'tvar.krizeni': [10, 200], 'tvar.rozpeti': [4, 80], 'tvar.vyska': [2, 30],
    'pruz.oko': [0.8, 8], 'pruz.rameno': [1.5, 15], 'pruz.vyskaOka': [0, 30], 'celist.zahnuti': [-45, 45],
    'uchop.pocet': [1, 30, 1], 'uchop.hloubka': [0.2, 3],
    'celist.delka': [0, 80], 'celist.sirka': [1, 15], 'celist.konec': [0.4, 15], 'celist.vyskaSpicky': [0.8, 30],
    'celist.mezera': [0, 5], 'celist.sbihavost': [0, 3],
    'celist.roztec': [0.4, 10], 'celist.hloubkaVzoru': [0.1, 3], 'celist.delkaVzoru': [0, 80], 'celist.drazka': [0.4, 10], 'celist.polohaDrazky': [0, 80],
    'kloub.prumer': [4, 40], 'kloub.otevreni': [0, 40], 'kloub.vule': [0.15, 1.2], 'kloub.cep': [1.5, 20], 'kloub.podil': [25, 75],
    'kloub.prumerCepu': [0.8, 10], 'kloub.vuleOtvoru': [-0.2, 1], 'kloub.hlava': [0, 20], 'kloub.hlavaHloubka': [0.2, 10],
    'kloub.matice': [0, 20], 'kloub.maticeHloubka': [0.2, 10],
    'tisk.rozevreni': [0, 80], 'tisk.usiPrumer': [3, 20], 'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.kusu': [1, 20, 1],
  };
  const VYCTY = {
    'celist.spicka': Object.keys(NAZVY.spicka), 'celist.vzor': Object.keys(NAZVY.vzor), 'kloub.typ': Object.keys(NAZVY.kloub),
    'uchop.typ': Object.keys(NAZVY.uchop), 'tisk.stav': Object.keys(NAZVY.stav), 'tisk.material': Object.keys(MATERIALY),
  };

  /** Předvolby: jen odchylky od výchozího projektu (vůle a tisk zůstávají uživatelovy). */
  const PREDVOLBY = [
    { id: 'nacrt', nazev: 'Podle náčrtu', popis: '110 mm, oko Ø 50, tisk otevřená, šroubek M3 v kloubu', p: {} },
    { id: 'jemna', nazev: 'Jemná – elektronika', popis: '90 mm, ostré špičky 0,8 mm, jemné zoubky',
      p: { nazev: 'Jemná pinzeta', tvar: { delka: 90, oko: 40, krizeni: 30, rozpeti: 14, vyska: 5 }, pruz: { oko: 1.4, rameno: 3.4 },
        celist: { delka: 12, sirka: 2.4, konec: 0.8, vyskaSpicky: 2, vzor: 'zoubky', roztec: 0.8, hloubkaVzoru: 0.3, delkaVzoru: 6 },
        kloub: { prumer: 10, otevreni: 6, prumerCepu: 2 } } },
    { id: 'pajeci', nazev: 'Držák při pájení', popis: 'ploché čelisti s drážkou na drát, tuhé oko',
      p: { nazev: 'Pájecí pinzeta', tvar: { delka: 120, oko: 46, krizeni: 48, rozpeti: 20, vyska: 7 }, pruz: { oko: 2.2, rameno: 4.5 },
        celist: { delka: 12, sirka: 4, spicka: 'plocha', konec: 4, vyskaSpicky: 5, vzor: 'drazka', drazka: 1.8, polohaDrazky: 5 },
        kloub: { prumer: 12, otevreni: 10 } } },
    { id: 'kuchyn', nazev: 'Kuchyňská – rybí kosti', popis: '150 mm, široké vlnité čelisti, velké oko',
      p: { nazev: 'Pinzeta na kosti', tvar: { delka: 150, oko: 66, krizeni: 58, rozpeti: 26, vyska: 8 }, pruz: { oko: 2.2, rameno: 5 },
        celist: { delka: 16, sirka: 5, spicka: 'plocha', konec: 5, vyskaSpicky: 6, vzor: 'vlnky', roztec: 2.4, hloubkaVzoru: 0.8 },
        kloub: { prumer: 14, otevreni: 12, prumerCepu: 4 } } },
    { id: 'sestavena', nazev: 'Tištěná v sestavě s čepem', popis: 'bez skládání, čep tištěný v drážce, mezera 0,4 mm',
      p: { nazev: 'Pinzeta v sestavě', celist: { mezera: 0.4 }, kloub: { typ: 'cep', prumer: 12 }, tisk: { stav: 'sestavena' } } },
    { id: 'volna', nazev: 'Bez čepu – volné křížení', popis: 'ramena po sobě jen kloužou',
      p: { nazev: 'Pinzeta bez čepu', kloub: { typ: 'volne' } } },
  ];

  const kopie = G.kopie;
  const normalizuj = v => G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }

  /* ---------------- geometrie osy (2D) a mechanika ---------------- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const delka = a => Math.hypot(a[0], a[1]);
  const rad = s => s * Math.PI / 180;
  /** Odvozené body osy ramene A (B je zrcadlo podle x = 0). o.chyba = 'krizeni' → nejde sestavit. */
  function odvozene(p) {
    const T = p.tvar, R = T.oko / 2, to = p.pruz.oko, ta = p.pruz.rameno, c = p.celist, k = p.kloub;
    const C = [0, T.delka - R - to / 2];               // střed oka (osa pásu), vrchol oka = delka
    const X = [0, T.krizeni];
    const d = C[1] - X[1];
    const o = { R, C, X, d, to, ta, h: T.vyska, cl: k.vule };
    if (d <= R + ta / 2 + 0.5) return Object.assign(o, { chyba: 'krizeni' });
    const cosF = R / d, sinF = Math.sqrt(1 - cosF * cosF);
    o.T = [-R * sinF, C[1] - R * cosF];                // tečný bod na oku vlevo
    const u0 = sub(X, o.T), lu = delka(u0), u = [u0[0] / lu, u0[1] / lu];
    o.u = u; o.horni = lu;
    o.theta = Math.atan2(u[0], -u[1]);                 // odklon ramene od svislice
    const sK = T.rozpeti / 2 / u[0];
    o.K = [X[0] + u[0] * sK, X[1] + u[1] * sK];        // roh kosočtverce
    o.dolni = sK;
    // čelist: vnitřní hrana od špičky (mezera) dozadu se rozevírá o sbíhavost → tlak je na špičkách
    o.yS = c.delka;
    o.e = y => (c.mezera + c.sbihavost * (o.yS > 0 ? y / o.yS : 0)) / 2;
    o.S = [o.e(o.yS) + c.sirka / 2, o.yS];
    o.konec = c.spicka === 'plocha' ? c.sirka : Math.min(c.konec, c.sirka);
    o.zahnuti = rad(c.zahnuti);                          // zahnutí rovné části čelistí kolem (0, yS), kladné = špička doprava
    o.rotS = q => {
      const cz = Math.cos(o.zahnuti), sz = Math.sin(o.zahnuti), y = q[1] - c.delka;
      return [cz * q[0] - sz * y, c.delka + sz * q[0] + cz * y];
    };
    o.hOko = p.pruz.vyskaOka > 0 ? Math.min(p.pruz.vyskaOka, T.vyska) : T.vyska;   // nižší oko = měkčí pružina
    o.P1 = [o.T[0] + u[0] * Math.min(lu * 0.3, 10), o.T[1] + u[1] * Math.min(lu * 0.3, 10)];
    // oko: oblouk osy od pravého tečného bodu přes vrchol k levému
    o.aL = Math.atan2(o.T[1] - C[1], o.T[0] - C[0]);
    o.aR = -Math.PI - o.aL;
    o.psi = o.aL + 2 * Math.PI - o.aR;                 // úhel oblouku oka
    o.Loko = R * o.psi;
    // pohyb: ramena se otáčejí kolem konců oka; otevření špiček o celkem `otevreni` → úhel ε na rameno
    const yT = o.T[1];
    // kinematika stejná jako v náhledu: oko se ohne (oblouk stejné délky), ramena se otočí s konci oka
    o.stavOka = dl => stavOka(o, T.delka, dl);
    const TR = [-o.T[0], o.T[1]];
    const vA = (q, dl) => {   // bod ramene A v poloze dl
      const so = o.stavOka(dl), a = so.st * Math.PI / 180, x = q[0] - o.T[0], y = q[1] - o.T[1];
      return [so.TL2[0] + Math.cos(a) * x - Math.sin(a) * y, so.TL2[1] + Math.sin(a) * x + Math.cos(a) * y];
    };
    const doB = (q, dl) => {  // bod v poloze dl → souřadnice ramene B ve složené poloze
      const so = o.stavOka(dl), a = so.st * Math.PI / 180, x = q[0] - so.TR2[0], y = q[1] - so.TR2[1];
      return [TR[0] + Math.cos(a) * x - Math.sin(a) * y, TR[1] + Math.sin(a) * x + Math.cos(a) * y];
    };
    const spicka = o.rotS([o.e(0) + o.konec / 2, 0]), otev = e => 2 * (vA(spicka, -e)[0] - spicka[0]);
    let lo = 0, hi = 0.6;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (otev(m) < k.otevreni) lo = m; else hi = m; }
    o.eps = hi;                                        // natočení pro plné otevření (rad)
    o.draha = [];                                      // dráha čepu ramene A v rameni B (od klidu po plné otevření)
    for (let i = 0; i <= 8; i++) o.draha.push(doB(vA(X, -o.eps * i / 8), -o.eps * i / 8));
    o.posun = Math.max(...o.draha.map(q => Math.hypot(q[0] - X[0], q[1] - X[1])));
    const Gs = [(o.T[0] + X[0]) / 2, (o.T[1] + X[1]) / 2], de = 1e-4;
    o.paka = Math.abs((vA(spicka, -de)[0] - spicka[0]) / (vA(Gs, -de)[0] - Gs[0]));   // stisk v půlce horního ramene → pohyb špičky
    // zóny křížení: kde je A v dolní a B v horní polovině výšky
    o.Rb = k.typ === 'volne' ? 0 : k.prumer / 2;      // patka kloubu (u B protažená o posun)
    const a = ta / 2 + o.cl / 2;
    o.Rz = a / Math.min(Math.sin(o.theta), Math.cos(o.theta)) + 0.5;
    o.tz = o.posun / (2 * u[0]) + 0.5;                // posun bodu křížení po ose ramene
    o.zh = (T.vyska - o.cl) * k.podil / 100;          // výška dolního (levého) ramene v křížení
    o.lem = Math.min(0.6, Math.max(0.3, (T.vyska - o.zh - o.cl) * 0.2));   // rozšíření hlavy tištěného čepu
    o.dosahZony = Math.max(o.Rz + o.tz, o.Rb ? o.posun + o.Rb + o.cl : 0);
    // předpětí z otevřeného tisku: oblouk oka stejné délky s úhlem ψ − 2δ
    o.otevrena = p.tisk.stav === 'otevrena';
    o.delta = o.otevrena ? rad(p.tisk.rozevreni) : 0;
    o.psiTisk = o.psi - 2 * o.delta;
    const m = MATERIALY[p.tisk.material], I = o.hOko * to ** 3 / 12;
    o.dKappa = 2 * o.delta / o.Loko;                   // změna křivosti oka po složení (1/mm)
    o.preth = (to / 2) * o.dKappa * 100;               // přetvoření krajních vláken oka (%)
    o.moment = m.E * I * o.dKappa;                     // N·mm
    o.sila = o.moment / yT;                            // N na špičkách (rameno se opírá jen o špičku)
    const dOtev = 2 * o.eps / o.Loko;                  // přídavek křivosti při plném otevření
    o.prethMax = (to / 2) * (o.dKappa + dOtev) * 100;
    o.silaStisku = (o.moment + m.E * I * dOtev) / yT * o.paka;
    return o;
  }

  /** Oko pro natočení ramen o dl (rad, kladné = rozevřít ven jako při tisku, záporné = otevřít čelisti):
      oblouk stejné délky s úhlem ψ − 2·dl, vrchol oka zůstává na místě; TL/TR = nové konce oka, st = natočení ramene A (°). */
  function stavOka(o, vrchol, dl) {
    const ps = o.psi - 2 * dl, R = o.Loko / ps, C = [0, vrchol - R - o.to / 2];
    const aL = -1.5 * Math.PI + ps / 2, aR = -Math.PI - aL;
    const TL = [C[0] + R * Math.cos(aL), C[1] + R * Math.sin(aL)];
    return { psi: ps, R, C, aL, aR, TL2: TL, TR2: [-TL[0], TL[1]], st: -dl * 180 / Math.PI };
  }
  /** Díly pinzety (model.casti) přepočtené do polohy natočení dl – pro náhled pohybu bez manifoldu.
      Ramena se otočí kolem konců oka, body oka se přemapují podél oblouku (tloušťka pásu zůstává). */
  function prevedCasti(p, casti, dl) {
    const o = odvozene(p), so = o.stavOka(dl), out = [];
    const otoc = (d, T1, T2, st) => {
      const c = Math.cos(st * Math.PI / 180), s = Math.sin(st * Math.PI / 180), P = new Float32Array(d.poz.length);
      for (let i = 0; i < P.length; i += 3) {
        const x = d.poz[i] - T1[0], y = d.poz[i + 1] - T1[1];
        P[i] = T2[0] + c * x - s * y; P[i + 1] = T2[1] + s * x + c * y; P[i + 2] = d.poz[i + 2];
      }
      return Object.assign({}, d, { poz: P });
    };
    const TR = [-o.T[0], o.T[1]];
    out.push(otoc(casti.A, o.T, so.TL2, so.st), otoc(casti.B, TR, so.TR2, -so.st));
    if (casti.cep) out.push(otoc(casti.cep, o.T, so.TL2, so.st));
    const d = casti.oko, P = new Float32Array(d.poz.length);
    for (let i = 0; i < P.length; i += 3) {
      const x = d.poz[i] - o.C[0], y = d.poz[i + 1] - o.C[1];
      let a = Math.atan2(y, x);
      while (a < o.aR - 0.3) a += 2 * Math.PI;
      const t = (a - o.aR) / o.psi, r = Math.hypot(x, y) - o.R + so.R, a2 = so.aR + t * so.psi;
      P[i] = so.C[0] + r * Math.cos(a2); P[i + 1] = so.C[1] + r * Math.sin(a2); P[i + 2] = d.poz[i + 2];
    }
    out.push(Object.assign({}, d, { poz: P }));
    return out;
  }

  /** Průběh při otevírání (n + 1 bodů od klidu po plné otevření): otevření špiček (mm), síla stisku v půlce
      horních ramen (N) a přetvoření oka (%). Stejná kinematika jako náhled (ohyb oka, ramena s konci oka). */
  function prubehSily(p, n = 20) {
    const o = odvozene(p), m = MATERIALY[p.tisk.material], I = o.hOko * o.to ** 3 / 12, out = [];
    if (o.chyba) return out;
    const sp = o.rotS([o.e(0) + o.konec / 2, 0]);
    for (let i = 0; i <= n; i++) {
      const e = o.eps * i / n, so = o.stavOka(-e), a = so.st * Math.PI / 180, x = sp[0] - o.T[0], y = sp[1] - o.T[1];
      const otev = 2 * (so.TL2[0] + Math.cos(a) * x - Math.sin(a) * y - sp[0]);
      const dk = 2 * (o.delta + e) / o.Loko;
      out.push({ otev, sila: m.E * I * dk / o.T[1] * o.paka, preth: o.to / 2 * dk * 100 });
    }
    return out;
  }

  /* ---------------- profil čelisti ---------------- */
  /** Posun vnitřní hrany čelisti ven (+) v místě y. Druhá čelist: zoubky a vlnky posunuté o půl rozteče (zapadnou),
      rýhy proti sobě. Drážka se vyřízne zvlášť kruhem. */
  function profil(p, o, y, druha) {
    const c = p.celist, P = c.roztec, A = c.hloubkaVzoru;
    if (c.vzor === 'hladke' || c.vzor === 'drazka' || o.yS <= 0) return 0;
    const krok = c.vzor === 'ryhy' ? P : P / 2;
    const konec = Math.floor(((c.delkaVzoru > 0 ? Math.min(c.delkaVzoru, o.yS) : o.yS) - 0.3) / krok + 1e-9) * krok;
    if (y < 0 || y > konec) return 0;
    const t = y / P + (druha && c.vzor !== 'ryhy' ? 0.5 : 0);
    const fr = x => x - Math.floor(x);
    if (c.vzor === 'zoubky') return A / 2 * (4 * Math.abs(fr(t - 0.25) - 0.5) - 1);
    if (c.vzor === 'vlnky') return A / 2 * Math.sin(2 * Math.PI * t);
    return A * Math.max(0, 1 - Math.abs(fr(t) - 0.5) / 0.25);   // rýhy: V-zářez šířky P/2
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), T = p.tvar, c = p.celist, k = p.kloub, m = MATERIALY[p.tisk.material];
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    if (o.chyba === 'krizeni') {
      chyba(['tvar.krizeni', 'tvar.oko'], `Křížení (${fmt(T.krizeni)} mm od špičky) je příliš blízko oka – ramena by nevyšla z oka jako tečny. Posuňte křížení níž, zmenšete oko nebo prodlužte pinzetu.`,
        (() => {   // posunout křížení níž, a když to nejde (pod rovné čelisti), prodloužit pinzetu
          const maxK = Math.floor(T.delka - T.oko - p.pruz.oko / 2 - p.pruz.rameno / 2 - 2.5), minK = Math.max(10, c.delka + p.pruz.rameno + 8);
          return maxK >= minK ? { zmeny: { 'tvar.krizeni': maxK } } : { zmeny: { 'tvar.delka': Math.ceil(T.oko + p.pruz.oko / 2 + p.pruz.rameno / 2 + 2.5 + Math.max(T.krizeni, minK)) } };
        })());
      H[0].oprava.text = textOpravy(H[0].oprava.zmeny);
      return H;
    }
    // tisk a kloub
    if (o.otevrena && k.typ === 'cep') chyba(['kloub.typ', 'tisk.stav'], 'Pojištěný čep (s rozšířenou hlavou) jde vytisknout jen v sestavě – u otevřené pinzety by se přes něj pravé rameno nenasadilo. Zvolte rovný nebo zacvakávací čep, vlastní čep, nebo tisk sestavené.', { zmeny: { 'kloub.typ': 'zacvak' } });
    if (!o.otevrena && c.mezera < 2 * p.tisk.vrstva - 1e-9) chyba(['celist.mezera', 'tisk.stav'], `Pinzeta se tiskne sestavená, ale mezera mezi špičkami je ${fmt(c.mezera, 2)} mm – čelisti se slepí. Nastavte mezeru aspoň na dvě vrstvy.`, { zmeny: { 'celist.mezera': Math.max(0.4, 2 * p.tisk.vrstva) } });
    if (o.otevrena) {
      if (o.psiTisk < Math.PI / 3) chyba(['tisk.rozevreni'], `Rozevření při tisku ${fmt(p.tisk.rozevreni)}° je na toto oko příliš velké – oko by se narovnalo.`, { zmeny: { 'tisk.rozevreni': Math.floor((o.psi - Math.PI / 3) / 2 * 180 / Math.PI) } });
      if (o.preth > m.eps) chyba(['tisk.rozevreni', 'pruz.oko'], `Po složení se oko ohne na přetvoření ${fmt(o.preth, 2)} % – ${m.nazev} snese asi ${fmt(m.eps, 1)} %, praskne nebo se trvale ohne. Zmenšete rozevření při tisku nebo tloušťku pásu oka.`,
        { zmeny: { 'tisk.rozevreni': Math.floor(p.tisk.rozevreni * m.eps / o.preth * 0.9) } });
      else if (o.prethMax > m.eps) var_(['kloub.otevreni', 'tisk.rozevreni'], `Při plném otevření (${fmt(k.otevreni)} mm) dosáhne oko přetvoření ${fmt(o.prethMax, 2)} % – nad mezí ${fmt(m.eps, 1)} % pro ${m.nazev}. Neotvírejte naplno nebo zmenšete předpětí.`);
      if (p.tisk.rozevreni === 0) var_(['tisk.rozevreni'], 'Rozevření při tisku je 0° – pinzeta nebude mít předpětí a ramena se při tisku překříží.');
      else if (o.sila < 0.15) info(['tisk.rozevreni', 'pruz.oko'], `Síla na špičkách je jen ${fmt(o.sila, 2)} N – pinzeta bude držet slabě.`);
    }
    // geometrie
    if (o.K[1] < c.delka + p.pruz.rameno) chyba(['tvar.rozpeti', 'celist.delka'], `Rohy kosočtverce (y = ${fmt(o.K[1])} mm) leží níž než začátek rovných čelistí – zmenšete rozpětí, délku čelistí nebo posuňte křížení výš.`);
    else if (o.K[1] - c.delka < 2 * c.sirka) var_(['tvar.rozpeti', 'celist.delka'], 'Šikmé části čelistí jsou velmi krátké – ohyb u rovné části bude ostrý.');
    if (o.dosahZony > o.dolni - p.pruz.rameno / 2 || o.dosahZony > o.horni * 0.6)
      chyba(['kloub.prumer', 'kloub.otevreni', 'tvar.rozpeti'], `Kloub i s drážkou (dosah ${fmt(o.dosahZony)} mm od středu) se mezi oko a rohy kosočtverce nevejde – zmenšete patku nebo největší otevření, nebo zvětšete rozpětí.`);
    if (o.theta < rad(10)) var_(['tvar.oko', 'tvar.krizeni'], `Ramena se kříží pod ostrým úhlem ${fmt(2 * o.theta * 180 / Math.PI, 0)}° – překryv v křížení je dlouhý. Zvětšete oko nebo posuňte křížení výš.`);
    const zh = o.zh, zB = T.vyska - zh - k.vule;
    if (Math.min(zh, zB) < 1.2) chyba(['tvar.vyska', 'kloub.podil', 'kloub.vule'], zh < zB
      ? `V křížení zbývá levému (dolnímu) rameni jen ${fmt(zh, 2)} mm výšky – zvyšte výšku pinzety nebo změňte rozdělení výšky.`
      : `V křížení zbývá pravému (hornímu) rameni jen ${fmt(zB, 2)} mm výšky – zvyšte výšku pinzety nebo změňte rozdělení výšky.`);
    if (k.typ === 'zacvak' && zB < 2.2) chyba(['kloub.typ', 'tvar.vyska', 'kloub.podil'], `Na zacvaknutí je horní rameno v křížení nízké (${fmt(zB, 1)} mm, potřeba aspoň 2,2 mm) – zvyšte pinzetu, posuňte rozdělení výšky nebo zvolte rovný čep.`);
    if (k.vule < 2 * p.tisk.vrstva - 1e-9) var_(['kloub.vule', 'tisk.vrstva'], `Vůle ${fmt(k.vule, 2)} mm je méně než dvě vrstvy (${fmt(2 * p.tisk.vrstva, 2)} mm) – ramena v křížení se mohou slepit.`);
    if (k.typ !== 'volne') {
      if (o.Rb < p.pruz.rameno / 2 + 0.5) var_(['kloub.prumer'], 'Patka kloubu je užší než rameno – kolem čepu nezbude materiál.', { zmeny: { 'kloub.prumer': Math.ceil(p.pruz.rameno + 3) } });
      const tisteny = ['cep', 'rovny', 'zacvak'].includes(k.typ);
      const rCep = tisteny ? k.cep / 2 + k.vule + (k.typ === 'rovny' ? 0 : o.lem) : Math.max(k.prumerCepu / 2 + k.vule / 2, k.hlava / 2 + k.vule / 2);
      const stena = o.Rb - rCep;
      if (stena < 1.2) chyba([tisteny ? 'kloub.cep' : (k.hlava > k.prumerCepu ? 'kloub.hlava' : 'kloub.prumerCepu'), 'kloub.prumer'],
        tisteny ? `Kolem čepu zbývá stěna ${fmt(stena, 2)} mm – potřeba aspoň 1,2 mm. Zvětšete patku nebo zmenšete čep.`
          : `Kolem drážky čepu zbývá stěna ${fmt(stena, 2)} mm – potřeba aspoň 1,2 mm. Zvětšete patku nebo zmenšete čep.`,
        { zmeny: { 'kloub.prumer': Math.ceil(2 * (rCep + 1.3)) } });
      if (tisteny && k.cep < 2.5) var_(['kloub.cep'], `Čep Ø ${fmt(k.cep, 1)} mm je tenký – snadno se ulomí.`);
      if (k.typ === 'vlastni') {
        if (k.hlava > 0 && k.hlava < k.prumerCepu + 0.5) var_(['kloub.hlava'], 'Zahloubení hlavy je užší než čep.');
        if (k.hlava > 0 && k.hlavaHloubka > zB - 0.6) chyba(['kloub.hlavaHloubka', 'tvar.vyska'], `Zahloubení hlavy ${fmt(k.hlavaHloubka, 1)} mm je hlubší, než dovolí horní rameno (${fmt(zB - 0.6, 1)} mm).`, (zB - 0.6 >= 0.2 ? { zmeny: { 'kloub.hlavaHloubka': Math.floor((zB - 0.6) * 10) / 10 } } : undefined));
        if (k.matice > 0 && k.maticeHloubka > zh - 0.6) chyba(['kloub.maticeHloubka', 'tvar.vyska'], `Kapsa matice ${fmt(k.maticeHloubka, 1)} mm je hlubší, než dovolí dolní rameno (${fmt(zh - 0.6, 1)} mm).`, (zh - 0.6 >= 0.2 ? { zmeny: { 'kloub.maticeHloubka': Math.floor((zh - 0.6) * 10) / 10 } } : undefined));
        if (k.matice > 0 && (k.matice + k.vule / 2) / Math.sqrt(3) > o.Rb - 1) chyba(['kloub.matice', 'kloub.prumer'], 'Kapsa matice se do patky kloubu nevejde.');
      }
    }
    if (k.otevreni < 2) var_(['kloub.otevreni'], `Největší otevření ${fmt(k.otevreni)} mm je malé – pinzeta se skoro neotevře.`);
    // čelisti
    const vz = c.vzor;
    if (vz === 'drazka') {
      if (c.sirka - c.drazka / 2 < 0.8) chyba(['celist.drazka', 'celist.sirka'], `Drážka Ø ${fmt(c.drazka, 1)} mm je na čelist šířky ${fmt(c.sirka, 1)} mm moc velká.`);
      if (c.polohaDrazky - c.drazka / 2 < 0.5 || c.polohaDrazky + c.drazka / 2 > c.delka) var_(['celist.polohaDrazky', 'celist.delka'], 'Drážka není celá v rovné části čelisti.');
    } else if (vz !== 'hladke') {
      if (c.delka < 2 * c.roztec) var_(['celist.delka', 'celist.roztec'], 'Rovná část čelisti je kratší než dvě rozteče – vzor se skoro neprojeví.');
      if (c.hloubkaVzoru > c.roztec) var_(['celist.hloubkaVzoru', 'celist.roztec'], 'Vzor je hlubší než rozteč – zuby budou strmé a křehké.');
      if (c.spicka === 'ostra' && Math.min(c.konec, c.sirka) <= c.hloubkaVzoru) var_(['celist.konec', 'celist.hloubkaVzoru'], 'Konec ostré špičky je užší než hloubka vzoru – zuby ho prořežou.');
      if ((vz === 'zoubky' || vz === 'vlnky') && c.roztec < 0.8) info(['celist.roztec'], 'Velmi jemný vzor – tryska 0,4 mm ho nemusí vykreslit.');
    }
    if (c.mezera === 0 && c.sbihavost === 0 && vz !== 'drazka') info(['celist.sbihavost'], 'Čelisti dosednou po celé délce – tlak nebude soustředěný na špičky. Sbíhavost 0,2–0,5 mm ho přesune na špičky.');
    if (c.spicka === 'ostra' && c.konec > c.sirka) info(['celist.konec'], 'Šířka konce je větší než šířka čelisti – použije se šířka čelisti.');
    if (c.vyskaSpicky > T.vyska) info(['celist.vyskaSpicky'], 'Výška špičky je větší než výška pinzety – špička se nezužuje.');
    // pružina
    const tO = p.pruz.oko;
    if (tO / o.R > 0.12) var_(['pruz.oko', 'tvar.oko'], `Oko je vůči svému průměru tlusté (${fmt(tO, 1)} mm na Ø ${fmt(T.oko)}) – pinzeta půjde ztuha. Zmenšete tloušťku pásu nebo zvětšete oko.`);
    if (p.pruz.vyskaOka > 0 && p.pruz.vyskaOka < 2) var_(['pruz.vyskaOka'], `Oko vysoké ${fmt(p.pruz.vyskaOka, 1)} mm se bude snadno kroutit a vybočovat z roviny.`);
    if (p.pruz.vyskaOka > T.vyska) info(['pruz.vyskaOka'], 'Oko nemůže být vyšší než pinzeta – použije se výška pinzety.');
    if (c.zahnuti !== 0 && c.delka < 4) info(['celist.zahnuti', 'celist.delka'], 'Zahnutí se natáčí jen rovná část čelisti – u krátké rovné části se skoro neprojeví.');
    if (tO < 1.2) var_(['pruz.oko'], `Pás oka ${fmt(tO, 1)} mm je tenký – pružina bude slabá a citlivá na kvalitu vrstev.`);
    if (p.pruz.rameno < 1.6 * tO) var_(['pruz.rameno'], 'Ramena nejsou o moc tužší než oko – budou se prohýbat místo oka.');
    if (p.uchop.typ === 'ryhy' && p.uchop.hloubka > p.pruz.rameno / 3) var_(['uchop.hloubka'], 'Rýhy úchopu jsou hlubší než třetina ramene – rameno zeslábne.');
    if (p.tisk.material === 'PLA') info(['tisk.material'], 'PLA je na pružinu křehké a časem se „usadí“ (creep) – na oko je lepší PETG, ASA nebo nylon.');
    for (const h of H) if (h.oprava && !h.oprava.text) h.oprava.text = textOpravy(h.oprava.zmeny);
    return H;
  }

  /** Krátký popis opravy na tlačítko 🔧 („křížení 22 mm“). */
  const POPISKY = {
    'tvar.krizeni': ['křížení', 'mm'], 'tvar.delka': ['délka', 'mm'], 'celist.mezera': ['mezera', 'mm'], 'tisk.rozevreni': ['rozevření při tisku', '°'],
    'kloub.prumer': ['patka Ø', 'mm'], 'kloub.hlavaHloubka': ['hloubka zahloubení', 'mm'], 'kloub.maticeHloubka': ['hloubka kapsy', 'mm'],
  };
  function textOpravy(zmeny) {
    return Object.entries(zmeny).map(([c, v]) => {
      if (c === 'kloub.typ') return NAZVY.kloub[v];
      const [n, j] = POPISKY[c] || [c, ''];
      return `${n} ${fmt(v, 2)} ${j}`.trim();
    }).join(', ');
  }

  /* ---------------- stavba těles ---------------- */
  const segmenty = r => Math.max(16, Math.min(96, Math.ceil(2 * Math.PI * r / 0.4)));
  /** Sestaví model přes manifold-3d →
      {dily: [sestavená pinzeta (+ vlastní čep jen pro náhled)], tisk: [pinzeta v tiskovém tvaru], info, cas}. */
  function postav(w, p) {
    const t0 = Date.now(), o = odvozene(p);
    if (o.chyba) throw new Error('křížení je příliš blízko oka');
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const h = o.h, ta = o.ta, to = o.to, cl = o.cl, c = p.celist, kl = p.kloub;
    const zh = o.zh;
    const kruh = (r, x, y, n) => k(k(CS.circle(r, n || segmenty(r))).translate([x, y]));
    const poly = body => k(new CS([body], 'Positive'));
    const obal = (...cs) => k(CS.hull(cs));
    const pas = (a, b, ra, rb) => obal(kruh(ra, a[0], a[1]), kruh(rb, b[0], b[1]));
    const vysun = (cs, za, zb) => k(k(cs.extrude(zb - za)).translate([0, 0, za]));
    const deska = (za, zb) => k(k(M.cube([2e3, 2e3, zb - za])).translate([-1e3, -1e3, za]));
    /** Otočení kolem T1 o st° a přesun T1 → T2 (2D i 3D). */
    const presun2 = (g, T1, T2, st) => k(k(k(g.translate([-T1[0], -T1[1]])).rotate(st)).translate(T2));
    const presun3 = (g, T1, T2, st) => k(k(k(g.translate([-T1[0], -T1[1], 0])).rotate([0, 0, st])).translate([T2[0], T2[1], 0]));
    const X = o.X, draha = o.draha;                    // dráha čepu A v rameni B → drážka
    const podel = (r, body) => obal(...body.map(q => kruh(r, q[0], q[1])));
    try {
      /* ---- 2D ramena ---- */
      function surove(druha) {
        const casti = [pas(o.T, o.P1, to / 2, ta / 2), pas(o.P1, X, ta / 2, ta / 2), pas(X, o.K, ta / 2, ta / 2), pas(o.K, o.S, ta / 2, c.sirka / 2)];
        const nadSpickou = k(k(CS.square([2e3, 2e3])).translate([-1e3, 0]));   // nic pod špičku (kulatý konec u krátké čelisti)
        // rovná čelist (i s koncem ramene v S) zvlášť – u zahnutých špiček se natočí kolem (0, yS)
        let celist = null;
        if (o.yS > 0.01) {
          const n = Math.min(800, Math.max(8, Math.ceil(o.yS / Math.min(0.15, c.roztec / 12)))), vnitrni = [];
          for (let i = 0; i <= n; i++) { const y = o.yS * i / n; vnitrni.push([o.e(y) + profil(p, o, y, druha), y]); }
          celist = k(k(poly(vnitrni.concat([[o.e(o.yS) + c.sirka, o.yS], [o.e(0) + o.konec, 0]]).reverse()).add(kruh(c.sirka / 2, o.S[0], o.S[1]))).intersect(nadSpickou));
          if (c.vzor === 'drazka') celist = k(celist.subtract(kruh(c.drazka / 2, o.e(c.polohaDrazky), c.polohaDrazky)));
        }
        let cs = k(k(CS.union(casti)).intersect(nadSpickou));
        // rýhy úchopu na vnější hraně horního ramene
        if (p.uchop.typ === 'ryhy') {
          const n = p.uchop.pocet, rg = 0.9, ven = [o.u[1], -o.u[0]];
          const sa = delka(sub(o.P1, o.T)) + 2, sb = o.horni - o.dosahZony - 2;
          if (sb > sa) {
            const ryhy = [];
            for (let i = 0; i < n; i++) {
              const s = n === 1 ? (sa + sb) / 2 : sa + (sb - sa) * i / (n - 1), q = [o.T[0] + o.u[0] * s, o.T[1] + o.u[1] * s];
              const dd = ta / 2 + rg - p.uchop.hloubka;
              ryhy.push(kruh(rg, q[0] + ven[0] * dd, q[1] + ven[1] * dd, 24));
            }
            cs = k(cs.subtract(k(CS.union(ryhy))));
          }
        }
        return { telo: cs, celist };
      }
      const zahni = cs => (o.zahnuti ? k(k(k(cs.translate([0, -o.yS])).rotate(c.zahnuti)).translate([0, o.yS])) : cs);
      const sA = surove(false), sB = surove(true);
      let A2 = sA.celist ? k(sA.telo.add(zahni(sA.celist))) : sA.telo;
      let B2 = k(sB.telo.mirror([1, 0]));
      if (sB.celist) B2 = k(B2.add(zahni(k(sB.celist.mirror([1, 0])))));
      if (o.Rb) {
        A2 = k(A2.add(kruh(o.Rb, X[0], X[1])));
        B2 = k(B2.add(podel(o.Rb, draha)));
      }
      /* ---- zóny křížení (A dole, B nahoře) – pokrývají i posun při otevření ---- */
      const uB = [-o.u[0], o.u[1]];
      const ZA2 = obal(kruh(o.Rz, X[0], X[1]), kruh(o.Rz, X[0] - o.u[0] * o.tz, X[1] - o.u[1] * o.tz),
        ...(o.Rb ? draha.flatMap(q => [kruh(o.Rb + cl, q[0], q[1]), kruh(o.Rb + cl, -q[0], q[1])]) : []));
      const ZB2 = obal(kruh(o.Rz, X[0], X[1]), kruh(o.Rz, X[0] - uB[0] * o.tz, X[1] - uB[1] * o.tz),
        ...(o.Rb ? draha.map(q => kruh(o.Rb + cl, q[0], q[1])) : []));
      const ZA = vysun(ZA2, -1, h + 1), ZB = vysun(ZB2, -1, h + 1);
      const Af = vysun(A2, 0, h), Bf = vysun(B2, 0, h);
      let A = k(k(Af.subtract(ZA)).add(k(k(Af.intersect(ZA)).intersect(deska(0, zh)))));
      let B = k(k(Bf.subtract(ZB)).add(k(k(Bf.intersect(ZB)).intersect(deska(zh + cl, h)))));
      const drazka = (r, za, zb) => vysun(podel(r, draha), za, zb);
      const otoc = (prof, x, y) => k(k(poly(prof).revolve(segmenty(prof.reduce((m, q) => Math.max(m, q[0]), 1)))).translate([x, y, 0]));
      let cepNahled = null;
      const rc = kl.cep / 2, rozs = o.lem;
      /** Drážka v B pro čep s hlavou: úzká do výšky zL (+vůle), nad ní rozšířená s ramenem 45°. */
      const drazkaHlavy = zL => {
        const kuzel = [[0, zL + cl], [rc + cl, zL + cl], [rc + rozs + cl, zL + rozs + cl], [rc + rozs + cl, h + 2], [0, h + 2]];
        return k(M.union([drazka(rc + cl, -1, zL + cl + 0.01), k(M.hull(draha.map(q => otoc(kuzel, q[0], q[1]))))]));
      };
      if (kl.typ === 'cep') {
        // pojištěný čep (jen tisk v sestavě): nahoře kužel 45° až k horní ploše → B nesklouzne
        const zK = h - rozs;
        A = k(A.add(otoc([[0, zh - 0.01], [rc, zh - 0.01], [rc, zK], [rc + rozs, h], [0, h]], X[0], X[1])));
        B = k(B.subtract(drazkaHlavy(zK)));
      } else if (kl.typ === 'rovny') {
        // rovný čep: nic nejistí, ramena drží na sobě napětí oka; o 0,2 mm pod horní plochou
        A = k(A.add(k(k(M.cylinder(h - 0.2 - zh + 0.01, rc, rc, segmenty(rc))).translate([X[0], X[1], zh - 0.01]))));
        B = k(B.subtract(drazka(rc + cl, -1, h + 1)));
      } else if (kl.typ === 'zacvak') {
        // zacvakávací čep: hlava s náběhem 45° nahoře i dole, rozříznutá – při skládání se stiskne a zacvakne za rameno v drážce
        const vrch = h - 0.15, zL = vrch - 2 * rozs;
        const cep = otoc([[0, zh - 0.01], [rc, zh - 0.01], [rc, zL], [rc + rozs, zL + rozs], [rc + 0.05, vrch], [0, vrch]], X[0], X[1]);
        const sirkaRezu = Math.max(0.6, rc * 0.4), zRez = zh + cl + Math.max(0.6, (zL - zh - cl) * 0.3);
        const rez = k(k(M.cube([2 * rc + 4, sirkaRezu, vrch - zRez + 1])).translate([X[0] - rc - 2, X[1] - sirkaRezu / 2, zRez]));
        A = k(A.add(k(cep.subtract(rez))));
        B = k(B.subtract(drazkaHlavy(zL)));
      } else if (kl.typ === 'vlastni') {
        const d = kl.prumerCepu, rA = d / 2 + kl.vuleOtvoru / 2;
        A = k(A.subtract(k(k(M.cylinder(h + 2, rA, rA, segmenty(rA))).translate([X[0], X[1], -1]))));
        if (kl.matice > 0) {
          const re = (kl.matice + cl / 2) / Math.sqrt(3);
          A = k(A.subtract(k(k(k(M.cylinder(kl.maticeHloubka + 1, re, re, 6)).rotate([0, 0, 30])).translate([X[0], X[1], -1]))));
        }
        B = k(B.subtract(drazka(d / 2 + cl / 2, -1, h + 1)));
        if (kl.hlava > 0) B = k(B.subtract(drazka(kl.hlava / 2 + cl / 2, h - kl.hlavaHloubka, h + 1)));
        cepNahled = k(k(M.cylinder(h + 1, d / 2, d / 2, segmenty(d / 2))).translate([X[0], X[1], -0.5]));
      }
      // špička zúžená i ve výšce: horní plocha se svažuje k podložce (bez převisu)
      if (c.vyskaSpicky < h - 0.05 && o.yS > 0.5) {
        const yE = o.yS * 1.4, sk = (h - c.vyskaSpicky) / yE, W = p.tvar.rozpeti + 2 * ta + 10, body = [];
        for (const x of [-W, W]) body.push([x, -1, c.vyskaSpicky - sk], [x, yE, h], [x, yE, h + 5], [x, -1, h + 5]);
        const klin = k(M.hull(body));
        A = k(A.subtract(klin)); B = k(B.subtract(klin));
      }
      /* ---- oko ---- */
      function oko2(C, R, aR, aL) {
        const a1 = aL + 2 * Math.PI, n = Math.max(48, Math.ceil(segmenty(R) * (a1 - aR) / (2 * Math.PI))), vnej = [], vnit = [];
        for (let i = 0; i <= n; i++) {
          const a = aR + (a1 - aR) * i / n, cx = Math.cos(a), sy = Math.sin(a);
          vnej.push([C[0] + (R + to / 2) * cx, C[1] + (R + to / 2) * sy]);
          vnit.push([C[0] + (R - to / 2) * cx, C[1] + (R - to / 2) * sy]);
        }
        return poly(vnej.concat(vnit.reverse()));
      }
      const nazev = (p.nazev || '').trim() || 'Samosvorná pinzeta';
      const okoM = vysun(oko2(o.C, o.R, o.aR, o.aL), 0, o.hOko);
      const sestavena = k(M.union([A, B, okoM]));
      // díly zvlášť pro náhled pohybu (rozevřená pinzeta): ramena se otáčejí, oko se ohýbá
      const casti = { A: sit(k, A, 'A', 'levé rameno', '#4F86D9'), B: sit(k, B, 'B', 'pravé rameno', '#4F86D9'), oko: sit(k, okoM, 'oko', 'oko', '#4F86D9') };
      // uši proti odlepení špiček (jen v tiskovém tvaru): kotouček jedné-dvou vrstev vně špičky, mezery se nedotkne
      let usiA = null, usiB = null;
      if (p.tisk.usi) {
        const ru = p.tisk.usiPrumer / 2, hu = Math.max(2 * p.tisk.vrstva, 0.3), xu = o.e(0) + o.konec + ru - Math.min(0.8, o.konec * 0.6);
        const uA = o.rotS([xu, 0]), uB = o.rotS([-xu, 0]);
        usiA = vysun(kruh(ru, uA[0], uA[1]), 0, hu); usiB = vysun(kruh(ru, uB[0], uB[1]), 0, hu);
      }
      const dily = [sit(k, sestavena, 'pinzeta', nazev, '#4F86D9')];
      if (cepNahled) dily.push(Object.assign(sit(k, cepNahled, 'cep', 'Vlastní čep (kupovaný, jen náhled)', '#9AA0A6'), { nahled: true }));
      const info = { prekryv: 0, minRozevreni: null };
      let tisk = usiA ? null : dily[0];
      if (!o.otevrena && usiA) tisk = sit(k, k(M.union([sestavena, usiA, usiB])), 'pinzeta', nazev, '#4F86D9');
      if (o.otevrena) {
        /** Tiskový tvar pro rozevření δ: oblouk oka stejné délky, ramena otočená kolem konců oka. */
        const tvarTisku = dl => { const so = o.stavOka(dl); return Object.assign(so, { oko: oko2(so.C, so.R, so.aR, so.aL) }); };
        const TR = [-o.T[0], o.T[1]];
        /** Překryv v tiskovém tvaru (2D): ramena navzájem a ramena s okem mimo napojení. */
        const prekryv = dl => {
          const t = tvarTisku(dl);
          const a = presun2(A2, o.T, t.TL2, t.st), b = presun2(B2, TR, t.TR2, -t.st);
          const r = Math.max(ta, to) * 1.5 + 1;
          const oko = k(k(t.oko.subtract(kruh(r, t.TL2[0], t.TL2[1]))).subtract(kruh(r, t.TR2[0], t.TR2[1])));
          return k(a.intersect(b)).area() + k(a.intersect(oko)).area() + k(b.intersect(oko)).area();
        };
        info.prekryv = prekryv(o.delta);
        if (info.prekryv > 0.01) {
          for (let st = Math.ceil(p.tisk.rozevreni) + 1; st <= 80 && o.psi - 2 * rad(st) > Math.PI / 3; st++) {
            if (prekryv(rad(st)) <= 0.01) { info.minRozevreni = Math.min(st + 2, 80, Math.floor((o.psi - Math.PI / 3) / 2 * 180 / Math.PI)); break; }
          }
        }
        const t = tvarTisku(o.delta);
        const Au = usiA ? k(A.add(usiA)) : A, Bu = usiB ? k(B.add(usiB)) : B;
        tisk = sit(k, k(M.union([presun3(Au, o.T, t.TL2, t.st), presun3(Bu, TR, t.TR2, -t.st), vysun(t.oko, 0, o.hOko)])), 'pinzeta', nazev, '#4F86D9');
      }
      if (dily[1]) casti.cep = dily[1];
      return { dily, tisk: [tisk], casti, info, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  /** Manifold → síť pro náhled a export. */
  function sit(k, m0, jmeno, nazev, barva) {
    const m = k(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    return { jmeno, nazev, poz, idx: new Uint32Array(tv), objem: m.volume(), teles: m.decompose().map(k).length, barva, otocit: false };
  }

  function kontrolyModelu(p, model) {
    const H = [];
    if (model.info.prekryv > 0.01) H.push({ uroven: 'chyba', pole: ['tisk.rozevreni'],
      text: `V tiskovém tvaru se ramena překrývají (${fmt(model.info.prekryv, 1)} mm²) – rozevřete pinzetu při tisku víc${model.info.minRozevreni ? ` (aspoň ${model.info.minRozevreni}°)` : ''}.`,
      oprava: model.info.minRozevreni ? { zmeny: { 'tisk.rozevreni': model.info.minRozevreni }, text: textOpravy({ 'tisk.rozevreni': model.info.minRozevreni }) } : undefined });
    for (const d of model.tisk) {
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: ['kloub.vule'], text: `${d.nazev}: tiskový díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      const r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 2) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – potřebuje podpory.` });
      if (r.most > 0.5) H.push({ uroven: 'info', pole: ['kloub.vule'], text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² (horní polovina ramene v křížení, stropy kapes).` });
    }
    return H;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    return `${fmt(p.tvar.delka)} mm, oko Ø ${fmt(p.tvar.oko)}${p.celist.zahnuti ? `, špičky zahnuté ${fmt(p.celist.zahnuti)}°` : ''} · ${NAZVY.kloub[p.kloub.typ]} · ${NAZVY.vzor[p.celist.vzor]} · tisk ${p.tisk.stav === 'otevrena' ? 'otevřená' : 'sestavená'}`;
  }
  const TYP = 'samosvorna_pinzeta';
  const ulozProjekt = p => G.projektJson(TYP, p, 2);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Samosvorné pinzety');

  const API = {
    MATERIALY, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    normalizuj, predvolba, odvozene, stavOka, prevedCasti, prubehSily, profil, kontroly, postav, kontrolyModelu, popis, ulozProjekt, nactiProjekt,
    kopie, vezmi: G.vezmi, poloz: G.poloz, fmt, segmenty,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.SPINZ = API;
})();
