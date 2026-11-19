/* Kloubová hadice – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Stavitelný článkový krk pro ostřik, ofuk a odsávání: řetěz stejných článků „koule + jamka“, na začátku patka
   (závit, příruba, hadicový trn, magnet, rozbočka), na konci tryska.
   Plán a rozhodnutí: docs/plany/KloubovaHadice_PLAN.md.

   Souřadnice: osa Z = osa článku, z roste od patky k trysce. Článek má KOULI DOLE (střed z = 0, spodek seříznutý
   na 45°) a JAMKU NAHOŘE (střed z = L, ústí míří nahoru). Tak se každý díl tiskne nastojato bez podpor:
   koule leží seříznutou ploškou na podložce, každé rozšíření směrem nahoru je kužel 45° (patky leží spodkem
   na podložce, trysky stojí na kouli). Koule následujícího článku se zacvakne do jamky shora.

   Kloub: koule Rk, jamka Rs = Rk + vůle (záporná vůle = přesah, kloub drží pevněji), hrdlo jamky má poloměr
   rl = Rk − přesah (koule se přes něj protlačí) a nad ním sražení 45°. Mezní ohyb článku se počítá
   ze srážky krčku/kuželu dalšího článku s hrdlem jamky (řez rovinou ohybu). */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const ZG = uzel ? require('../ibc/geometrie.js') : window.IBC_GEOM;   // zavitovaTyc (šroubovice závitu)
  const fmt = G.fmt;
  const S2 = Math.SQRT1_2;
  const rad = s => s * Math.PI / 180, deg = r => r * 180 / Math.PI;

  /* ---------------- tabulky ---------------- */
  /** eps = přípustné přetvoření hrdla při jednorázovém zacvaknutí (%) – hrubé hodnoty pro tištěný díl. */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, eps: 6 },
    PP: { nazev: 'PP (polypropylen)', hustota: 0.9, eps: 10 },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, eps: 8 },
    ASA: { nazev: 'ASA', hustota: 1.07, eps: 5 },
    ABS: { nazev: 'ABS', hustota: 1.04, eps: 5 },
    PLA: { nazev: 'PLA', hustota: 1.24, eps: 3 },
  };
  // vnější trubkový závit G (ISO 228-1): profil 55°, hloubka 0,640327 P; metrický jemný: 60°, hloubka 0,6134 P
  const zG = (nazev, d, tpi) => ({ nazev, d, p: 25.4 / tpi, h: 0.640327 * 25.4 / tpi, bok: 27.5 });
  const zM = (nazev, d, p) => ({ nazev, d, p, h: 0.6134 * p, bok: 30 });
  const ZAVITY = {
    'G1/8': zG('G 1/8″', 9.728, 28), 'G1/4': zG('G 1/4″', 13.157, 19), 'G3/8': zG('G 3/8″', 16.662, 19),
    'G1/2': zG('G 1/2″', 20.955, 14), 'G3/4': zG('G 3/4″', 26.441, 14),
    M10: zM('M10 × 1', 10, 1), M12: zM('M12 × 1,5', 12, 1.5), M14: zM('M14 × 1,5', 14, 1.5), M16: zM('M16 × 1,5', 16, 1.5), M20: zM('M20 × 1,5', 20, 1.5),
  };
  const NAZVY = {
    vstup: { zavit: 'závit se šestihranem', priruba: 'příruba na šrouby', trn: 'trn na hadici', magnet: 'magnetická patka', rozbocka: 'rozbočka' },
    tryska: { plocha: 'plochá vějířová', kulata: 'kulatá', sprcha: 'sprcha (více otvorů)', hubice: 'sací hubice', zatka: 'zátka' },
    tvar: { rovne: 'rovně', oblouk: 'oblouk', s: 'esíčko', hak: 'hák', vlastni: 'vlastní (po kloubech)' },
    medium: { voda: 'voda', emulze: 'emulze (chladicí kapalina)', olej: 'olej (VG 32)', vzduch: 'vzduch' },
    dilPatky: { zavit: 'Patka se závitem', rozbocka: 'Rozbočka', priruba: 'Patka s přírubou', trn: 'Patka s trnem', magnet: 'Magnetická patka' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Kloubová hadice',
    kloub: { kanal: 6, koule: 15, stena: 1.6, presah: 0.4, vule: 0.05, roztec: 17, zkoseni: 0.5, zarezu: 0, sirkaZarezu: 1 },
    retez: { pocet: 8, tvar: 'oblouk', ohyb: 10, klouby: [] },   // klouby: [[úhel °, natočení roviny °], …] pro tvar „vlastni“
    vstup: {
      typ: 'zavit', zavit: 'G1/4', tisknoutZavit: true, delkaZavitu: 10, klic: 0,
      priruba: 40, tloustka: 5, der: 3, dira: 4.5, roztecDer: 30,
      hadice: 8, delkaTrnu: 18, magnet: 20, vyskaMagnetu: 5, patka: 36,
      vetvi: 2, roztecVetvi: 0,
    },
    tryska: { typ: 'plocha', delka: 22, sirka: 24, sterbina: 1.4, usti: 3, prumer: 16, otvoru: 6, otvor: 1.2, vyska: 10, stena: 1.4 },
    tisk: { vrstva: 0.2, uhel: 45, material: 'PETG', sad: 1, kalibrace: false, krokKalibrace: 0.05, podlozka: 220, podlozkaY: 220 },
    proud: { medium: 'emulze', prutok: 4, drsnost: 0.05 },        // průtok: kapaliny l/min, vzduch m³/h (na celý přívod)
    mech: { moment: 0, naplnena: true },                         // mezní moment kloubu z testu se závažím (N·mm), 0 = nezměřeno
    cil: { x: 120, z: 140, smer: 120, hlidatSmer: false },        // cíl ústí trysky od osy a spodku patky (mm), směr od svislice (°)
  };
  /** Meze číselných polí [min, max, celé?]. */
  const MEZE = {
    'kloub.kanal': [0, 40], 'kloub.koule': [6, 80], 'kloub.stena': [0.6, 8], 'kloub.presah': [0, 6], 'kloub.vule': [-0.5, 1],
    'kloub.roztec': [4, 150], 'kloub.zkoseni': [0, 4], 'kloub.zarezu': [0, 12, 1], 'kloub.sirkaZarezu': [0.4, 4],
    'retez.pocet': [1, 60, 1], 'retez.ohyb': [-60, 60],
    'vstup.delkaZavitu': [4, 40], 'vstup.klic': [0, 80],
    'vstup.priruba': [10, 160], 'vstup.tloustka': [1.5, 20], 'vstup.der': [0, 8, 1], 'vstup.dira': [1.5, 12], 'vstup.roztecDer': [4, 150],
    'vstup.hadice': [2, 60], 'vstup.delkaTrnu': [5, 80], 'vstup.magnet': [3, 80], 'vstup.vyskaMagnetu': [0.5, 30], 'vstup.patka': [10, 160],
    'vstup.vetvi': [2, 4, 1], 'vstup.roztecVetvi': [0, 150],
    'tryska.delka': [2, 150], 'tryska.sirka': [2, 200], 'tryska.sterbina': [0.3, 40], 'tryska.usti': [0.5, 60], 'tryska.prumer': [4, 120],
    'tryska.otvoru': [1, 40, 1], 'tryska.otvor': [0.4, 10], 'tryska.vyska': [2, 120], 'tryska.stena': [0.6, 6],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.sad': [1, 10, 1], 'tisk.krokKalibrace': [0.02, 0.2], 'tisk.podlozka': [80, 600], 'tisk.podlozkaY': [80, 600],
    'proud.prutok': [0, 5000], 'proud.drsnost': [0, 1], 'mech.moment': [0, 1e6],
    'cil.x': [-2000, 2000], 'cil.z': [-2000, 2000], 'cil.smer': [-180, 180],
  };
  const VYCTY = {
    'retez.tvar': Object.keys(NAZVY.tvar), 'vstup.typ': Object.keys(NAZVY.vstup), 'vstup.zavit': Object.keys(ZAVITY),
    'tryska.typ': Object.keys(NAZVY.tryska), 'tisk.material': Object.keys(MATERIALY), 'proud.medium': Object.keys(NAZVY.medium),
  };

  /** Předvolby: jen odchylky od výchozího projektu (tisk zůstává uživatelův). */
  const PREDVOLBY = [
    { id: 'ostrik6', nazev: 'Ostřik 6 mm – plochá tryska', popis: 'kanál Ø 6, koule Ø 15, závit G 1/4″, 8 článků', p: {} },
    { id: 'ostrik6kul', nazev: 'Ostřik 6 mm – kulatá tryska', popis: 'ústí Ø 3, závit G 1/8″, 10 článků',
      p: { nazev: 'Ostřik kulatý', retez: { pocet: 10 }, vstup: { zavit: 'G1/8', delkaZavitu: 8, tisknoutZavit: false }, tryska: { typ: 'kulata', delka: 18, usti: 3 } } },
    { id: 'ofuk', nazev: 'Ofuk vzduchem – rozbočka na 2 větve', popis: 'G 1/4″, 2 × 6 článků, ploché trysky',
      p: { nazev: 'Ofuk 2 větve', retez: { pocet: 6, tvar: 'oblouk', ohyb: 8 }, vstup: { typ: 'rozbocka', vetvi: 2 }, proud: { medium: 'vzduch', prutok: 6 } } },
    { id: 'sprcha', nazev: 'Sprcha – více otvorů', popis: 'kanál Ø 6, hlava Ø 16 se 6 otvory, trn na hadici 8 mm',
      p: { nazev: 'Sprcha', vstup: { typ: 'trn', hadice: 8 }, tryska: { typ: 'sprcha', prumer: 16, otvoru: 6, otvor: 1.2, delka: 12 } } },
    { id: 'ostrik12', nazev: 'Ostřik 12 mm (½″) – plochá tryska', popis: 'kanál Ø 12, koule Ø 26, závit G 1/2″, 8 článků',
      p: { nazev: 'Hadice 12 mm', kloub: { kanal: 12, koule: 26, stena: 2.2, presah: 0.7, vule: 0.1, roztec: 29, zkoseni: 0.7 },
        vstup: { zavit: 'G1/2', delkaZavitu: 14 }, tryska: { typ: 'plocha', delka: 34, sirka: 44, sterbina: 2.4, stena: 1.8 } } },
    { id: 'odsavani19', nazev: 'Odsávání 19 mm (¾″) – sací hubice', popis: 'kanál Ø 19, koule Ø 38, trn na hadici 25 mm, hubice 60 × 14',
      p: { nazev: 'Odsávání 19 mm', retez: { pocet: 6, tvar: 'hak', ohyb: 12 },
        kloub: { kanal: 19, koule: 38, stena: 2.6, presah: 1, vule: 0.15, roztec: 41, zkoseni: 0.8 },
        vstup: { typ: 'trn', hadice: 25, delkaTrnu: 28 }, proud: { medium: 'vzduch', prutok: 22 },
        tryska: { typ: 'hubice', delka: 34, sirka: 60, vyska: 14, stena: 2 } } },
    { id: 'odsavani12', nazev: 'Odsávání 12 mm – kulatá hubice', popis: 'kanál Ø 12, příruba na 3 šrouby, široké ústí Ø 16',
      p: { nazev: 'Odsávání 12 mm', retez: { pocet: 7 },
        kloub: { kanal: 12, koule: 26, stena: 2.2, presah: 0.7, vule: 0.1, roztec: 29, zkoseni: 0.7 },
        vstup: { typ: 'priruba', priruba: 54, tloustka: 6, der: 3, dira: 5.5, roztecDer: 42 }, proud: { medium: 'vzduch', prutok: 9 },
        tryska: { typ: 'kulata', delka: 14, usti: 16, stena: 1.8 } } },
    { id: 'drzak', nazev: 'Stavitelný držák (bez průtoku)', popis: 'magnetická patka, plný článek bez kanálu, zátka na konci – pro lampičku, sondu',
      p: { nazev: 'Stavitelný držák', kloub: { kanal: 0, presah: 0.4 }, retez: { pocet: 10, tvar: 'hak' }, vstup: { typ: 'magnet', patka: 40 }, tryska: { typ: 'zatka' } } },
  ];

  const kopie = G.kopie;
  /** Normalizace + klouby vlastního tvaru (pole dvojic, úhel ±90°, natočení ±180°, nejvýš 61 kloubů). */
  function normalizuj(v) {
    const r = G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
    const k = Array.isArray(r.p.retez.klouby) ? r.p.retez.klouby : [];
    let orez = 0;
    r.p.retez.klouby = k.slice(0, 61).map(x => {
      const a = Array.isArray(x) ? x : [x, 0], u = G.ctiCislo(a[0]), az = G.ctiCislo(a[1]);
      const q = [Number.isFinite(u) ? Math.max(-90, Math.min(90, Math.round(u * 100) / 100)) : 0, Number.isFinite(az) ? Math.max(-180, Math.min(180, Math.round(az))) : 0];
      if (!Number.isFinite(u) || Math.abs(u) > 90 || (a.length > 1 && (!Number.isFinite(az) || Math.abs(az) > 180))) orez++;
      return q;
    });
    if (orez) r.hlaseni.push(`retez.klouby: oříznuto mimo rozsah (ohyb ±90°, natočení ±180°): ${orez}`);
    return r;
  }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }

  /* ---------------- odvozené rozměry ---------------- */
  /** Rozměry kloubu a mezní ohyb. o.chyba = důvod, proč nejde sestavit (kontroly ho hlásí srozumitelně). */
  function odvozene(p) {
    const k = p.kloub;
    const rc = k.kanal / 2, Rk = k.koule / 2, t = k.stena, L = k.roztec;
    const o = { rc, Rk, t, L, c: k.zkoseni };
    o.rn = rc + t;                                   // krček (kanál + stěna; u plného článku aspoň třetina koule)
    if (rc < 0.01) o.rn = Math.max(t, Rk * 0.4);
    o.Rs = Rk + k.vule;                               // jamka
    o.Ro = o.Rs + t;                                  // vnějšek jamky
    o.a = Rk * S2; o.aR = Rk * S2;                    // seříznutí koule (plocha na podložce)
    o.rl = Rk - k.presah;                             // hrdlo
    if (o.rl >= o.Rs) { o.zl = 0; o.chyba = 'presah'; } else o.zl = Math.sqrt(o.Rs * o.Rs - o.rl * o.rl);
    o.ztop = o.zl + o.c;                              // čelo ústí nad středem jamky
    o.phi = deg(Math.asin(Math.min(1, o.zl / o.Rs)));  // převis hrdla od svislice
    if (o.ztop >= o.Ro - 0.3) { o.chyba = o.chyba || 'usti'; o.rf = o.rl + o.c; } else o.rf = Math.sqrt(o.Ro * o.Ro - o.ztop * o.ztop);
    o.celo = o.rf - (o.rl + o.c);                      // šířka čela ústí
    o.zn0 = o.rn < Rk ? Math.sqrt(Rk * Rk - o.rn * o.rn) : 0;   // kde krček vychází z koule
    o.rt = o.Ro * S2;                                 // kužel 45° tečný ke kouli jamky v –45°
    o.zt = L - o.Ro * S2;
    o.zk = o.zt - (o.rt - o.rn);                      // začátek kužele (konec krčku)
    o.krcek = o.zk - o.zn0;
    o.Lmin = o.zn0 + 2 * o.rt - o.rn;                 // nejkratší rozteč (krček nulové délky)
    if (o.krcek < 0) o.chyba = o.chyba || 'roztec';
    if (o.rn >= o.rl) o.chyba = o.chyba || 'hrdlo';
    o.vyska = o.a + L + o.ztop;                       // výška článku
    o.stenaKoule = o.aR - rc;                         // mezikruží na podložce
    o.prurez = Math.PI * rc * rc;
    // přetvoření hrdla při zacvaknutí: obvod hrdla se roztáhne z rl na Rk (zářezy ho výrazně sníží – hrubý odhad)
    o.preth = k.presah / Math.max(0.1, o.rl) * 100 * (k.zarezu >= 2 ? 0.35 : 1);
    o.ohybMax = o.chyba ? 0 : mezniOhyb(o);
    return o;
  }

  /** Bod uvnitř mnohoúhelníku (r, z). */
  function uvnitr(b, x, y) {
    let v = false;
    for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
      const [xi, yi] = b[i], [xj, yj] = b[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) v = !v;
    }
    return v;
  }
  /** Mezní ohyb (°) jednoho kloubu: krček, kužel a jamka dalšího článku natočené kolem středu koule
      nesmí vniknout do hrdla jamky (řez rovinou ohybu – obě tělesa jsou rotační, první dotyk leží v ní). */
  function mezniOhyb(o) {
    const lem = [[o.rl, o.zl], [o.rl + o.c, o.ztop], ...oblouk(0, 0, o.Ro, Math.atan2(o.ztop, o.rf), 0, 12), [o.Rs, 0], ...oblouk(0, 0, o.Rs, 0, Math.atan2(o.zl, o.rl), 12)];
    const body = [];
    for (let z = o.zn0; z <= o.zk; z += 0.25) body.push([o.rn, z]);
    for (let i = 0; i <= 20; i++) { const s = i / 20; body.push([o.rn + (o.rt - o.rn) * s, o.zk + (o.zt - o.zk) * s]); }
    for (const q of oblouk(0, o.L, o.Ro, -Math.PI / 4, Math.PI / 2, 24)) body.push(q);
    for (let a = 0.25; a <= 75; a += 0.25) {
      const c = Math.cos(rad(a)), s = Math.sin(rad(a));
      for (const [r, z] of body) for (const x of [r, -r]) {
        const X = c * x + s * z, Z = -s * x + c * z;
        if (uvnitr(lem, Math.abs(X), Z)) return a - 0.25;
      }
    }
    return 75;
  }
  /** Body oblouku kružnice (střed r = cr, z = cz) od úhlu a0 do a1 (rad, 0 = +r, π/2 = +z), n úseků. */
  function oblouk(cr, cz, R, a0, a1, n) {
    const b = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; b.push([cr + R * Math.cos(a), cz + R * Math.sin(a)]); }
    return b;
  }
  // tětiva 0,7 mm na kouli Ø 15 = odchylka ≈ 0,01 mm (koule i dutina jsou vepsané stejně, vůle se nemění)
  const useku = (R, a0, a1) => Math.max(4, Math.ceil(Math.abs(a1 - a0) * R / 0.7));
  const segmenty = r => Math.max(32, Math.min(120, Math.ceil(2 * Math.PI * r / 0.9 / 4) * 4));

  /** Profil koule s krčkem od seříznutí po (rn, zk) – vnější body (r, z) bez osy. */
  const kouleBodyO = o => [[o.aR, -o.a], ...oblouk(0, 0, o.Rk, -Math.PI / 4, Math.atan2(o.zn0, o.rn), useku(o.Rk, -Math.PI / 4, Math.PI / 2)), [o.rn, o.zk]];
  /** Vnějšek jamky se středem zS: kužel od (rStart, …) přes tečný bod na kouli jamky k čelu ústí (končí na ose). */
  function jamkaBodyO(o, zS, rStart) {
    const zt = zS - o.Ro * S2, z0 = zt - (o.rt - rStart), aF = Math.atan2(o.ztop, o.rf);
    return [[rStart, z0], [o.rt, zt], ...oblouk(0, zS, o.Ro, -Math.PI / 4, aF, useku(o.Ro, -Math.PI / 4, aF)).slice(1), [0, zS + o.ztop]];
  }
  /** Řez článkem v rovině osy – pravá polovina materiálu (r ≥ rc): vnějšek, ústí, dutina jamky, kanál (výkres). */
  function sekceClanku(o) {
    const ven = [...kouleBodyO(o), ...jamkaBodyO(o, o.L, o.rn).slice(1, -1)];
    const aL = Math.atan2(o.zl, o.rl), rc = Math.max(o.rc, 0);
    const dut = [];
    const a0 = aL, a1 = rc > 0 ? -Math.acos(Math.min(1, rc / o.Rs)) : -Math.PI / 2, n = useku(o.Rs, a1, a0);
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; dut.push([o.Rs * Math.cos(a), o.L + o.Rs * Math.sin(a)]); }
    const vnitrek = [[o.rl + o.c, o.L + o.ztop], [o.rl, o.L + o.zl], ...dut.slice(1)];
    return [[rc, -o.a], ...ven, ...vnitrek];   // uzavře se zpět na (rc, −a) podél kanálu
  }

  /** Vůle jamek kalibrační sady (−2 … +2 kroky), které jdou postavit; rozteč u zkušební jamky nehraje roli. */
  function vuleKalibrace(p) {
    const out = [];
    for (let i = 0; i < 5; i++) {
      const vu = Math.round((p.kloub.vule + (i - 2) * p.tisk.krokKalibrace) * 1000) / 1000;
      const pk = kopie(p); pk.kloub.vule = vu;
      const ok = odvozene(pk);
      if (ok.chyba && ok.chyba !== 'roztec') continue;
      out.push({ i, vu, ok });
    }
    return out;
  }

  /** Údaje závitu patky (vnější závit). */
  function zavitPatky(p) {
    const z = ZAVITY[p.vstup.zavit];
    return Object.assign({ rMaj: z.d / 2 - 0.1, rMin: z.d / 2 - 0.1 - z.h }, z);
  }
  /** Rozměry patky: výška jejího těla (kde začíná jamka), průchozí otvor, šestihran, rozbočka. */
  function patka(p, o) {
    const v = p.vstup, P = { typ: v.typ };
    const rb0 = o.rc;
    if (v.typ === 'zavit' || v.typ === 'rozbocka') {
      const z = zavitPatky(p);
      P.zavit = z;
      P.Lz = v.delkaZavitu;
      P.rb = Math.min(rb0, z.rMin - 1.2);           // otvor ve stěně závitu
      const s = v.klic > 0 ? v.klic : Math.ceil(Math.max(z.d * 1.3, z.d + 5, (o.rn + 1) * Math.sqrt(3)));
      P.s = s; P.Re = s / Math.sqrt(3);
      P.zh0 = P.Lz; P.hh = Math.max(Math.max(5, z.d * 0.4), P.Re - z.rMaj + 2);   // spodek šestihranu sražený 45° od závitu
      P.zh1 = P.Lz + P.hh;
      P.z0 = P.zh1;
      if (v.typ === 'rozbocka') {
        const n = v.vetvi, rozt = v.roztecVetvi > 0 ? v.roztecVetvi : Math.ceil(2 * o.Ro + 3);
        P.roztec = rozt; P.vetve = [];
        for (let j = 0; j < n; j++) P.vetve.push((j - (n - 1) / 2) * rozt);
        const ymax = (n - 1) / 2 * rozt;
        P.ymax = ymax;
        P.zq = P.zh1 - 0.5 + Math.max(1, ymax + o.rc - P.rb);     // strop rozdělovací komory (45°)
        P.z1 = P.zh1 + Math.max(1, ymax + o.rt - P.s / 2);         // tělo dosáhne plné šíře (45°)
        P.z0 = Math.max(P.z1 + 0.5, P.zq + 2);                    // horní plocha těla = začátek kuželů jamek v o.rt
      }
    } else if (v.typ === 'priruba') {
      P.rb = rb0; P.z0 = v.tloustka; P.R = v.priruba / 2;
    } else if (v.typ === 'trn') {
      const D = v.hadice;
      P.rmin = D * 0.43; P.rmax = D * 0.56; P.rb = Math.min(rb0, P.rmin - 1.2);
      P.Rkol = Math.max(P.rmax + 1.5, o.rn);
      P.Lb = v.delkaTrnu; P.zKol = P.Lb + (P.Rkol - P.rmax); P.z0 = P.zKol + 2.5;
    } else if (v.typ === 'magnet') {
      P.rb = 0; P.R = v.patka / 2; P.z0 = Math.max(v.vyskaMagnetu + 1.6, 4);
    }
    if (P.rb < 0) P.rb = 0;
    // jamka nad patkou: kužel od krčku o.rn (u rozbočky od o.rt na horní ploše těla)
    P.zS = v.typ === 'rozbocka' ? P.z0 + o.Ro * S2 : P.z0 + (o.rt - o.rn) + o.Ro * S2;
    P.vyska = P.zS + o.ztop;
    return P;
  }
  /** Rozměry trysky (rámec koule: střed koule z = 0, krček končí v o.zk, tělo trysky do zE). */
  function tryska(p, o) {
    const q = p.tryska, T = { typ: q.typ, tw: q.stena, z0: o.zk, zE: o.zk + q.delka };
    if (q.typ === 'kulata') { T.ru = q.usti / 2; T.Rv = T.ru + T.tw; }
    if (q.typ === 'plocha') { T.W = q.sirka; T.Ts = q.sterbina + 2 * T.tw; }
    if (q.typ === 'hubice') { T.W = q.sirka + 2 * T.tw; T.H = q.vyska + 2 * T.tw; }
    if (q.typ === 'sprcha') {
      T.R = Math.max(q.prumer / 2, o.rn); T.Ri = T.R - T.tw;
      T.zC = T.z0 + Math.max(0, T.R - o.rn) + 0.5;               // od tud válec hlavy
      T.zE = Math.max(T.zE, T.zC + 1);                            // konec válce, pak kužel 45°
      T.zVrch = T.zE + T.Ri + T.tw * Math.SQRT2;                  // vrchol vnějšího kužele
      T.rOtv = T.Ri * 0.55;
    }
    if (q.typ === 'zatka') { T.zE = T.z0 + Math.max(1, q.stena); T.zVrch = T.zE + o.rn; }
    // sklony stěn od svislice v tiskové poloze (rozšíření vnějšku nahoru / zúžení vnitřku nahoru = převis)
    const L = Math.max(0.01, T.zE - T.z0), sk = [];
    if (q.typ === 'kulata') { sk.push(['vnějšek', T.Rv - o.rn]); sk.push(['kanál', o.rc - T.ru]); }
    if (q.typ === 'plocha') { sk.push(['šířka vějíře', T.W / 2 - o.rn]); sk.push(['tloušťka vějíře', T.Ts / 2 - o.rn]); sk.push(['štěrbina', o.rc - q.sterbina / 2]); }
    if (q.typ === 'hubice') { sk.push(['šířka hubice', T.W / 2 - o.rn]); sk.push(['výška hubice', T.H / 2 - o.rn]); sk.push(['vnitřek hubice', o.rc - q.vyska / 2]); sk.push(['vnitřek hubice', o.rc - q.sirka / 2]); }
    T.sklony = sk.map(([n, d]) => ({ nazev: n, uhel: deg(Math.atan2(Math.max(0, d), L)), d }));
    T.delkaCelkem = T.zVrch !== undefined ? T.zVrch + o.a : T.zE + o.a;
    return T;
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), k = p.kloub, v = p.vstup, q = p.tryska, m = MATERIALY[p.tisk.material];
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = (c, h) => ({ zmeny: { [c]: Math.round(h * 100) / 100 } });
    // kloub
    if (o.rc > 0 && o.rn >= o.Rk * 0.8) chyba(['kloub.kanal', 'kloub.koule'], `Kanál Ø ${fmt(k.kanal)} mm se stěnou ${fmt(k.stena)} mm je na kouli Ø ${fmt(k.koule)} mm moc široký – zvětšete kouli (aspoň Ø ${fmt(Math.ceil(2 * o.rn / 0.75))}) nebo zmenšete kanál.`, opr('kloub.koule', Math.ceil(2 * o.rn / 0.75)));
    if (o.chyba === 'presah') chyba(['kloub.presah', 'kloub.vule'], 'Hrdlo není užší než jamka – koule by z jamky vypadla. Přesah musí být větší než záporná vůle; zvětšete ho.', opr('kloub.presah', Math.max(0.3, Math.ceil((0.3 - k.vule) * 20) / 20)));
    if (o.chyba === 'usti') chyba(['kloub.presah', 'kloub.zkoseni', 'kloub.stena'], 'Ústí jamky vychází nad vnějšek jamky – zmenšete přesah nebo sražení, nebo zesilte stěnu.');
    if (o.chyba === 'hrdlo' || (!o.chyba && o.rn > o.rl - 0.5)) chyba(['kloub.presah', 'kloub.kanal', 'kloub.stena'], `Krček (Ø ${fmt(2 * o.rn, 1)}) je skoro tak široký jako hrdlo jamky (Ø ${fmt(2 * o.rl, 1)}) – kloub by se neohnul. Zmenšete kanál nebo přesah.`);
    if (o.chyba === 'roztec') chyba(['kloub.roztec'], `Rozteč článků ${fmt(L(k))} mm je na tuto kouli a jamku krátká – nejméně ${fmt(Math.ceil(o.Lmin * 10) / 10, 1)} mm.`, opr('kloub.roztec', Math.ceil(o.Lmin + 2)));
    if (o.chyba) { for (const h of H) if (h.oprava && !h.oprava.text) h.oprava.text = textOpravy(h.oprava.zmeny); return H; }
    // přesah, při kterém přetvoření hrdla vyjde na 80 % meze materiálu (oprava nesmí vyrobit nové hlášení)
    // … ale vždy aspoň o 0,15 mm víc než záporná vůle, jinak by hrdlo nebylo užší než jamka
    const pMez = fz => Math.max(Math.floor(0.8 * m.eps / 100 * o.Rk / fz / (1 + 0.8 * m.eps / 100 / fz) * 20) / 20, Math.ceil((0.15 - k.vule) * 20) / 20);
    const presahMez = pMez(k.zarezu >= 2 ? 0.35 : 1);
    // kolik zářezů dané šířky se do hrdla vejde (nejvýš třetina obvodu); méně než 2 = zářezy nepomohou
    const zarezuMoz = Math.min(4, Math.floor(0.3 * 2 * Math.PI * o.rl / k.sirkaZarezu)), zarezyOk = zarezuMoz >= 2;
    if (k.presah < 0.05) chyba(['kloub.presah'], 'Přesah hrdla je nulový – hrdlo kouli nedrží a vypadne z jamky.', opr('kloub.presah', Math.min(0.4, Math.max(0.3, presahMez))));
    else if (k.presah < 0.3) var_(['kloub.presah'], `Přesah hrdla ${fmt(k.presah, 2)} mm je malý – koule bude z jamky vyskakovat.`, presahMez >= 0.3 ? opr('kloub.presah', Math.min(0.4, presahMez)) : undefined);
    if (o.preth > m.eps * 2) chyba(['kloub.presah', 'kloub.zarezu', 'tisk.material'], `Při zacvaknutí se hrdlo roztáhne asi o ${fmt(o.preth, 1)} % – ${m.nazev} snese asi ${fmt(m.eps, 0)} %, hrdlo praskne. Zmenšete přesah, přidejte zářezy (pružné jazýčky) nebo zvolte pružnější materiál (PP, PA).`,
      presahMez < 0.3 && (k.zarezu >= 2 || !zarezyOk) && p.tisk.material !== 'PP' ? { zmeny: { 'tisk.material': 'PP' } }
        : k.zarezu >= 2 || !zarezyOk ? opr('kloub.presah', presahMez) : o.preth * 0.35 <= m.eps ? { zmeny: { 'kloub.zarezu': zarezuMoz } }
        : presahMez >= 0.3 ? opr('kloub.presah', presahMez) : { zmeny: { 'kloub.zarezu': zarezuMoz, 'kloub.presah': Math.max(0.3, pMez(0.35)) } });
    else if (o.preth > m.eps) var_(['kloub.presah', 'kloub.zarezu', 'tisk.material'], `Hrdlo se při zacvaknutí roztáhne asi o ${fmt(o.preth, 1)} % – na hraně meze ${m.nazev} (${fmt(m.eps, 0)} %). Zacvakávejte zahřáté nebo přidejte zářezy.`, k.zarezu < 2 && zarezyOk ? { zmeny: { 'kloub.zarezu': zarezuMoz } } : opr('kloub.presah', presahMez));
    if (k.zarezu === 1) info(['kloub.zarezu'], 'Jeden zářez nic nepruží – počítá se jako hrdlo bez zářezů (zadejte 0 nebo aspoň 2).');
    if (o.phi > p.tisk.uhel + 0.5) var_(['kloub.presah', 'kloub.vule', 'tisk.uhel'], `Hrdlo jamky převisá ${fmt(o.phi, 0)}° od svislice – víc než ${fmt(p.tisk.uhel)}°, které tiskárna zvládne. Zmenšete přesah.`);
    if (p.tisk.uhel < 45) info(['tisk.uhel'], `Díly jsou navržené na převis 45° (kužely, seříznutá koule). Při ${fmt(p.tisk.uhel)}° budou potřebovat podpory – kontrola tisku je u každého dílu ukáže.`);
    if (k.stena < 1.2) var_(['kloub.stena'], `Stěna ${fmt(k.stena, 1)} mm je tenká – aspoň 3 dráhy trysky (≈ 1,2 mm).`, opr('kloub.stena', 1.2));
    if (o.celo < 0.6) chyba(['kloub.stena', 'kloub.zkoseni', 'kloub.presah'], `Čelo ústí jamky má jen ${fmt(o.celo, 2)} mm – zesilte stěnu nebo zmenšete sražení.`, (() => {
      // nejdřív ubrat sražení (do 0,3 mm), zbytek dorovnat stěnou
      const treba = 0.6 - o.celo + 0.1, ubrat = Math.max(0, Math.min(treba, k.zkoseni - 0.3)), z = {};
      let celo = o.celo;
      if (ubrat > 0) {
        z['kloub.zkoseni'] = Math.round((k.zkoseni - ubrat) * 20) / 20;
        const pk = kopie(p); pk.kloub.zkoseni = z['kloub.zkoseni']; celo = odvozene(pk).celo;   // skutečné čelo po ubrání
      }
      if (celo < 0.65) z['kloub.stena'] = Math.ceil((k.stena + 0.7 - celo) * 20) / 20;
      return { zmeny: z };
    })());
    if (o.rc > 0 && o.stenaKoule < 1) chyba(['kloub.kanal', 'kloub.koule'], `Koule kolem kanálu má na spodní plošce jen ${fmt(o.stenaKoule, 2)} mm – zvětšete kouli nebo zmenšete kanál.`);
    if (k.vule < -0.2) var_(['kloub.vule'], `Vůle ${fmt(k.vule, 2)} mm (přesah koule v jamce) je velká – kloub půjde velmi ztuha. Vyzkoušejte kalibrační sadu.`);
    if (k.vule > 0.25) var_(['kloub.vule'], `Vůle ${fmt(k.vule, 2)} mm – kloub bude volný a hadice nebude držet tvar. Vyzkoušejte kalibrační sadu.`);
    if (o.ohybMax < 8) var_(['kloub.presah', 'kloub.kanal', 'kloub.roztec'], `Kloub se ohne jen o ${fmt(o.ohybMax, 1)}° – krček naráží do hrdla jamky. Zmenšete přesah nebo kanál (tenčí krček), u krátkého krčku prodlužte rozteč.`);
    if (p.retez.tvar === 'vlastni') {
      const pres = p.retez.klouby.slice(0, p.retez.pocet + 1).filter(q => Math.abs(q[0]) > o.ohybMax + 1e-9).length;
      if (pres === 1) info(['retez.tvar'], `Jeden kloub má ohyb nad mezí kloubu ${fmt(o.ohybMax, 1)}° – náhled ho omezí.`);
      else if (pres > 1 && pres < 5) info(['retez.tvar'], `${pres} klouby mají ohyb nad mezí kloubu ${fmt(o.ohybMax, 1)}° – náhled je omezí.`);
      else if (pres >= 5) info(['retez.tvar'], `${pres} kloubů má ohyb nad mezí kloubu ${fmt(o.ohybMax, 1)}° – náhled je omezí.`);
    } else if (Math.abs(p.retez.ohyb) > o.ohybMax + 1e-9 && p.retez.tvar !== 'rovne') info(['retez.ohyb'], `Ohyb ${fmt(Math.abs(p.retez.ohyb))}° na kloub je víc, než kloub dovolí (${fmt(o.ohybMax, 1)}°) – náhled ho omezí.`);
    const jamek = vuleKalibrace(p).length;
    if (jamek < 5) info(['tisk.krokKalibrace', 'kloub.presah', 'kloub.vule'], `Kalibrační sada bude mít jen ${jamek} jamky – u nejmenších vůlí by hrdlo nebylo užší než jamka. Zvětšete přesah nebo zmenšete krok.`);
    if (k.zarezu >= 2) {
      const obvod = 2 * Math.PI * o.rl;
      if (k.zarezu * k.sirkaZarezu > obvod * 0.35) var_(['kloub.zarezu', 'kloub.sirkaZarezu'], 'Zářezy zabírají víc než třetinu obvodu hrdla – jazýčky budou slabé.');
      if (k.sirkaZarezu < 2 * 0.4) info(['kloub.sirkaZarezu'], 'Úzký zářez se při tisku může zalít – aspoň dvě šířky dráhy (0,8 mm).');
      info(['kloub.zarezu'], 'Zářezy zjednoduší zacvaknutí, ale spoj méně těsní – vhodné pro vzduch a odsávání, ne pro kapalinu.');
    }
    if (k.kanal === 0) info(['kloub.kanal'], 'Kanál 0 – plné články bez průtoku (stavitelný držák).');
    // patka
    const P = patka(p, o);
    if (v.typ === 'zavit' || v.typ === 'rozbocka') {
      const z = P.zavit;
      if (p.vstup.tisknoutZavit && z.p < 1.2) var_(['vstup.tisknoutZavit', 'vstup.zavit'], `Stoupání ${fmt(z.p, 2)} mm je na tisk jemné – závit vyjde nepřesně. Vytiskněte hladký dřík a závit vyřízněte závitovou čelistí.`, { zmeny: { 'vstup.tisknoutZavit': false } });
      if (o.rc > 0 && P.rb < o.rc - 0.05) info(['vstup.zavit'], `Závit ${z.nazev} zúží průtok z Ø ${fmt(k.kanal, 1)} na Ø ${fmt(2 * P.rb, 1)} mm.`);
      if (o.rc > 0 && P.rb < 1) chyba(['vstup.zavit', 'kloub.kanal'], `Závit ${z.nazev} je na průtok příliš malý – otvor by měl jen Ø ${fmt(2 * Math.max(0, P.rb), 1)} mm.`);
      if (P.s / 2 < z.rMaj + 1) chyba(['vstup.klic'], `Šestihran ${fmt(P.s)} mm je užší než závit.`, opr('vstup.klic', Math.ceil(z.d + 4)));
      else if (P.Re < o.rn + 0.5) chyba(['vstup.klic'], `Šestihran ${fmt(P.s)} mm je užší než krček jamky (Ø ${fmt(2 * o.rn, 1)}) – jamka by visela přes okraj.`, opr('vstup.klic', Math.ceil((o.rn + 1) * Math.sqrt(3))));
      if (v.typ === 'rozbocka' && v.roztecVetvi > 0 && v.roztecVetvi < 2 * o.Ro + 1) chyba(['vstup.roztecVetvi'], `Rozteč větví ${fmt(v.roztecVetvi)} mm je menší než šířka jamky (${fmt(2 * o.Ro, 1)} mm) – jamky by se slily.`, opr('vstup.roztecVetvi', Math.ceil(2 * o.Ro + 3)));
      if (v.typ === 'rozbocka' && P.s / 2 - P.rb < Math.SQRT2 * k.stena) var_(['vstup.klic'], 'Stěna mezi rozdělovací komorou a pláštěm je tenká – zvětšete šestihran.');
      info(['vstup.zavit'], /^G/.test(v.zavit)
        ? `Závit ${z.nazev} je válcový – do stroje utěsnit teflonovou páskou nebo těsnicím kroužkem pod šestihran; kuželový NPT/R závit nepasuje přesně.`
        : `Závit ${z.nazev} je válcový – do stroje utěsnit teflonovou páskou nebo těsnicím kroužkem pod šestihran.`);
    }
    if (v.typ === 'priruba') {
      const rd = v.roztecDer / 2;
      if (v.der > 0) {
        if (rd + v.dira / 2 > P.R - 1.5) chyba(['vstup.roztecDer', 'vstup.priruba'], 'Díry příruby jsou moc blízko okraje.', opr('vstup.priruba', Math.ceil(2 * (rd + v.dira / 2 + 2.5))));
        const hlava = v.dira * 1.9;
        if (rd - hlava / 2 < o.rn + v.dira * 0.7 + 0.5) chyba(['vstup.roztecDer', 'vstup.priruba'], `Hlavy šroubů (asi Ø ${fmt(hlava, 0)} mm) by narazily do kužele pod jamkou – zvětšete rozteč děr.`, (() => {
          const rr = Math.ceil(2 * (o.rn + v.dira * 0.7 + 1 + hlava / 2));
          return { zmeny: { 'vstup.roztecDer': rr, 'vstup.priruba': Math.max(v.priruba, Math.ceil(rr + v.dira + 5)) } };
        })());
      }
      if (P.R < o.rn + 2) chyba(['vstup.priruba'], 'Příruba je užší než krček jamky.');
    }
    if (v.typ === 'trn') {
      if (o.rc > 0 && P.rb < o.rc - 0.05) info(['vstup.hadice'], `Trn pro hadici ${fmt(v.hadice)} mm zúží průtok na Ø ${fmt(2 * P.rb, 1)} mm.`);
      if (o.rc > 0 && P.rb < 1) chyba(['vstup.hadice'], 'Hadice je na kanál příliš úzká – trn by neměl otvor.');
      if (v.delkaTrnu < v.hadice * 0.8) var_(['vstup.delkaTrnu'], 'Trn je krátký – hadice nebude držet. Doporučeno aspoň 1× průměr hadice a stahovací páska.');
    }
    if (v.typ === 'magnet') {
      if (P.R < o.rn + 1) chyba(['vstup.patka'], `Patka Ø ${fmt(v.patka)} je užší než krček jamky (Ø ${fmt(2 * o.rn, 1)}) – jamka by visela přes okraj.`, opr('vstup.patka', Math.ceil(2 * o.rn + 6)));
      if (v.magnet > v.patka - 4) chyba(['vstup.magnet', 'vstup.patka'], 'Magnet se do patky nevejde.', opr('vstup.patka', v.magnet + 8));
      info(['vstup.magnet'], `Magnet Ø ${fmt(v.magnet)} × ${fmt(v.vyskaMagnetu)} mm se zalepí zespodu do kapsy; strop kapsy tiskárna přemostí. Patka nemá průtok – hodí se pro držák, lampičku nebo hubici s vlastní hadicí.`);
    }
    // tryska
    const T = tryska(p, o);
    for (const s of T.sklony) if (s.uhel > p.tisk.uhel + 0.5) {
      const Lpot = Math.ceil(s.d / Math.tan(rad(p.tisk.uhel)) + 0.5);
      if (Lpot <= MEZE['tryska.delka'][1]) var_(['tryska.delka'], `Tryska: ${s.nazev} se mění pod úhlem ${fmt(s.uhel, 0)}° od svislice – převis pro tisk. Prodlužte trysku aspoň na ${fmt(Lpot)} mm.`, opr('tryska.delka', Lpot));
      else var_(['tryska.sirka', 'tryska.delka'], `Tryska: ${s.nazev} se mění pod úhlem ${fmt(s.uhel, 0)}° od svislice – převis pro tisk. Ústí je na tento kanál příliš široké, zmenšete ho.`);
    }
    if (q.typ === 'kulata' && o.rc > 0 && T.ru > o.rc + 0.01) info(['tryska.usti'], 'Ústí je širší než kanál – tryska se rozšiřuje (hubice).');
    if (q.typ === 'plocha' && q.sirka - 2 * q.stena <= q.sterbina) chyba(['tryska.sirka', 'tryska.sterbina', 'tryska.stena'], 'Vějíř je na tuto štěrbinu a stěnu úzký – šířka ústí musí být větší než štěrbina a dvě stěny.', opr('tryska.sirka', Math.ceil(q.sterbina + 2 * q.stena + 4)));
    if (q.typ === 'plocha' && o.rc > 0 && q.sterbina * (q.sirka - 2 * q.stena) < o.prurez * 0.6) info(['tryska.sterbina'], `Průřez štěrbiny (${fmt(q.sterbina * (q.sirka - 2 * q.stena), 0)} mm²) je menší než kanál (${fmt(o.prurez, 0)} mm²) – tryska bude škrtit a stříkat dál.`);
    if (q.typ === 'sprcha') {
      const pl = q.otvoru * Math.PI * q.otvor * q.otvor / 4;
      if (o.rc > 0 && pl < o.prurez * 0.3) info(['tryska.otvoru', 'tryska.otvor'], `Otvory mají dohromady ${fmt(pl, 1)} mm² – kanál ${fmt(o.prurez, 0)} mm²; tlak vzroste, průtok klesne.`);
      const obv = 2 * Math.PI * T.rOtv;
      if (q.prumer / 2 < o.rn) info(['tryska.prumer'], `Hlava sprchy nemůže být užší než krček – použije se Ø ${fmt(2 * o.rn, 1)} mm.`);
      if (T.Ri < Math.max(o.rc, 1) + 0.5) chyba(['tryska.prumer', 'tryska.stena'], 'Hlava sprchy je na tuto stěnu malá – vnitřek by byl užší než kanál. Zvětšete hlavu nebo zmenšete stěnu trysky.', opr('tryska.prumer', Math.ceil(2 * (Math.max(o.rc, 1) + 1 + q.stena))));
      else if (T.rOtv + q.otvor / 2 > T.Ri - 0.4) chyba(['tryska.otvor', 'tryska.prumer'], `Otvory Ø ${fmt(q.otvor, 1)} mm by na hlavě Ø ${fmt(2 * T.R, 1)} prořízly plášť – zmenšete otvory nebo zvětšete hlavu.`);
      else if (q.otvoru * (q.otvor + 0.8) > obv) chyba(['tryska.otvoru', 'tryska.otvor', 'tryska.prumer'], 'Otvory se na hlavu sprchy nevejdou – zmenšete jejich počet nebo průměr, nebo zvětšete hlavu.');
      if (q.otvor < 0.8) info(['tryska.otvor'], 'Otvor pod 0,8 mm tiskárna s tryskou 0,4 mm sotva udělá – raději provrtat.');
    }
    if (q.typ === 'hubice' && o.rc > 0 && q.sirka * q.vyska < o.prurez) info(['tryska.sirka', 'tryska.vyska'], 'Ústí hubice je menší než kanál – sání bude škrtit.');
    if (q.stena < 1) var_(['tryska.stena'], `Stěna trysky ${fmt(q.stena, 1)} mm je tenká.`);
    if (k.kanal === 0 && q.typ !== 'zatka') info(['tryska.typ', 'kloub.kanal'], 'Články nemají kanál – tryska nemá smysl, vhodná je zátka.');
    if (p.tisk.material === 'PLA') info(['tisk.material'], 'PLA je na zacvakávací kloub křehké a s olejem a teplem měkne – lepší je PETG, PP nebo nylon.');
    if (k.kanal > 0 && k.zarezu < 2) info(['kloub.vule'], 'Na kapalinu pod tlakem spoje mírně prosakují (jako u kupovaných hadic). Pro vzduch a odsávání bez potíží.');
    for (const h of H) if (h.oprava && !h.oprava.text) h.oprava.text = textOpravy(h.oprava.zmeny);
    return H;
  }
  const L = k => k.roztec;
  /** Krátký popis opravy na tlačítko 🔧 – celé věty kvůli překladu („stěna 1,2 mm“). */
  const POPISKY = {
    'kloub.koule': h => `koule Ø ${fmt(h, 2)} mm`, 'kloub.presah': h => `přesah ${fmt(h, 2)} mm`, 'kloub.roztec': h => `rozteč ${fmt(h, 2)} mm`,
    'kloub.stena': h => `stěna ${fmt(h, 2)} mm`, 'kloub.zarezu': h => `${h} zářezy hrdla`, 'vstup.klic': h => `šestihran ${fmt(h, 2)} mm`,
    'vstup.roztecVetvi': h => `rozteč větví ${fmt(h, 2)} mm`, 'vstup.priruba': h => `příruba Ø ${fmt(h, 2)} mm`, 'vstup.roztecDer': h => `rozteč děr Ø ${fmt(h, 2)} mm`,
    'vstup.patka': h => `patka Ø ${fmt(h, 2)} mm`, 'tisk.material': h => `materiál ${MATERIALY[h].nazev}`, 'kloub.zkoseni': h => `sražení ${fmt(h, 2)} mm`, 'tryska.delka': h => `délka trysky ${fmt(h, 2)} mm`, 'vstup.tisknoutZavit': () => 'hladký dřík na závitovou čelist',
  };
  const textOpravy = zmeny => Object.entries(zmeny).map(([c, h]) => (POPISKY[c] ? POPISKY[c](h) : `${c} ${h}`)).join(', ');

  /* ---------------- tvar řetězu (náhled) ---------------- */
  /** Úhly ohybu kloubů (°) – první kloub je patka/první článek, poslední článek/tryska; počet = pocet + 1. */
  function uhlyRetezu(p, ohybMax) {
    const n = p.retez.pocet + 1, a = Math.max(-ohybMax, Math.min(ohybMax, p.retez.ohyb)), u = [];
    for (let i = 0; i < n; i++) {
      if (p.retez.tvar === 'vlastni') { const q = p.retez.klouby[i]; u.push(q ? Math.max(-ohybMax, Math.min(ohybMax, q[0])) : 0); continue; }
      if (p.retez.tvar === 'rovne') u.push(0);
      else if (p.retez.tvar === 'oblouk') u.push(a);
      else if (p.retez.tvar === 's') u.push(i < n / 2 ? a : -a);
      else u.push(i < Math.floor(n / 3) ? 0 : a);   // hák: rovný začátek, pak oblouk
    }
    return u;
  }
  /** Natočení roviny ohybu jednotlivých kloubů (°, kolem osy předchozího dílu) – jen u vlastního tvaru. */
  const natoceniRetezu = p => Array.from({ length: p.retez.pocet + 1 }, (_, i) => (p.retez.tvar === 'vlastni' && p.retez.klouby[i] ? p.retez.klouby[i][1] : 0));
  /** Rámy (počátek = střed koule, matice 3×3 po sloupcích) článků a trysky jedné větve; start = střed jamky patky. */
  function ramyRetezu(p, o, start) {
    const u = uhlyRetezu(p, o.ohybMax), az = natoceniRetezu(p), ramy = [];
    let P = start.slice(), R = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const krat = (A, B) => { const C = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[3 * j + i] = A[i] * B[3 * j] + A[3 + i] * B[3 * j + 1] + A[6 + i] * B[3 * j + 2]; return C; };
    for (let i = 0; i < u.length; i++) {
      const c = Math.cos(rad(u[i])), s = Math.sin(rad(u[i])), ca = Math.cos(rad(az[i])), sa = Math.sin(rad(az[i]));
      // ohyb o úhel u v rovině natočené o az kolem osy dílu: Rz(az) · Ry(u) · Rz(−az)
      const Rz = [ca, sa, 0, -sa, ca, 0, 0, 0, 1], Rzi = [ca, -sa, 0, sa, ca, 0, 0, 0, 1];
      R = krat(R, krat(Rz, krat([c, 0, -s, 0, 1, 0, s, 0, c], Rzi)));
      ramy.push({ P: P.slice(), R: R.slice() });
      P = [P[0] + R[6] * o.L, P[1] + R[7] * o.L, P[2] + R[8] * o.L];
    }
    return ramy;   // posledních = tryska
  }
  function presun(d, ram) {
    const p = d.poz, out = new Float32Array(p.length), R = ram.R, P = ram.P;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      out[i] = P[0] + R[0] * x + R[3] * y + R[6] * z;
      out[i + 1] = P[1] + R[1] * x + R[4] * y + R[7] * z;
      out[i + 2] = P[2] + R[2] * x + R[5] * y + R[8] * z;
    }
    return out;
  }
  /** Spojí víc sítí do jedné (náhled). */
  function slouc(site, nazev, jmeno, barva) {
    let np = 0, ni = 0;
    for (const s of site) { np += s.poz.length; ni += s.idx.length; }
    const poz = new Float32Array(np), idx = new Uint32Array(ni);
    let a = 0, b = 0;
    for (const s of site) { poz.set(s.poz, a); for (let i = 0; i < s.idx.length; i++) idx[b + i] = s.idx[i] + a / 3; a += s.poz.length; b += s.idx.length; }
    return { nazev, jmeno, poz, idx, barva };
  }

  /* ---------------- stavba těles ---------------- */
  /** Sestaví díly přes manifold-3d →
      {clanek, patka, tryska, kalibrace: [], sestava: [díly náhledu], tisk: [díly k tisku], ramy, cas}. */
  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p);
    if (o.chyba) throw new Error('rozměry kloubu nejdou sestavit (' + o.chyba + ')');
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const N = segmenty(o.Ro);
    const otoc = (body, n = N) => k(k(new CS([body], 'NonZero')).revolve(n));
    const valec = (r, z0, z1, x = 0, y = 0, n) => k(k(M.cylinder(z1 - z0, r, r, n || segmenty(r))).translate([x, y, z0]));
    const kruhBody = (r, z, x = 0, y = 0, n) => { const b = [], m = n || segmenty(r); for (let i = 0; i < m; i++) { const a = 2 * Math.PI * i / m; b.push([x + r * Math.cos(a), y + r * Math.sin(a), z]); } return b; };
    /** Zaoblený obdélník šířky a (x) a výšky b (y) v rovině z (body pro obálku). */
    const obdBody = (a, b, z, rz) => {
      const r = Math.max(0.05, Math.min(rz, a / 2 - 0.01, b / 2 - 0.01)), out = [];
      const st = [[a / 2 - r, b / 2 - r], [-a / 2 + r, b / 2 - r], [-a / 2 + r, -b / 2 + r], [a / 2 - r, -b / 2 + r]];
      st.forEach(([cx, cy], i) => { for (let j = 0; j <= 6; j++) { const u = Math.PI / 2 * (i + j / 6); out.push([cx + r * Math.cos(u), cy + r * Math.sin(u), z]); } });
      return out;
    };
    const obalka = body => k(M.hull(body));

    /** Profil koule s krčkem od seříznutí po (rn, zk) – vnější body (r, z) bez osy. */
    const kouleBody = () => kouleBodyO(o);
    /** Vnějšek jamky se středem zS: kužel od (rStart, zS − …) přes tečný bod na kouli jamky k čelu ústí. */
    const jamkaBody = (zS, rStart) => jamkaBodyO(o, zS, rStart);
    /** Dutina jamky (koule Rs) se sražením ústí, otevřená nahoru; dnoR = poloměr kanálu pod ní. */
    const dutina = (zS, ox = 0, oy = 0) => {
      const aL = Math.atan2(o.zl, o.rl);
      const b = [[0, zS - o.Rs], ...oblouk(0, zS, o.Rs, -Math.PI / 2, aL, useku(o.Rs, -Math.PI / 2, aL)).slice(1),
        [o.rl + o.c, zS + o.ztop], [o.rl + o.c + 3, zS + o.ztop + 3], [0, zS + o.ztop + 3]];
      return k(otoc(b).translate([ox, oy, 0]));
    };
    const zarezy = (zS, ox = 0, oy = 0) => {
      const n = p.kloub.zarezu, out = [];
      if (n < 2) return out;
      const w2 = p.kloub.sirkaZarezu, zd = zS - 0.15 * o.Rs, r0 = Math.max(o.rc + 0.4, o.rl * 0.5);
      for (let i = 0; i < n; i++) out.push(k(k(k(k(M.cube([o.Ro + 2 - r0, w2, zS + o.ztop + 2 - zd])).translate([r0, -w2 / 2, zd])).rotate([0, 0, 360 * i / n + 180 / n])).translate([ox, oy, 0])));
      return out;
    };

    try {
      /* ---- článek ---- */
      const clanekM = (() => {
        const tel = otoc([[0, -o.a], ...kouleBody(), ...jamkaBody(o.L, o.rn).slice(1)]);
        const odeb = [dutina(o.L), ...zarezy(o.L)];
        if (o.rc > 0) odeb.push(valec(o.rc, -o.a - 1, o.L));
        return k(M.difference([tel, ...odeb]));
      })();
      /* ---- patka ---- */
      const P = patka(p, o), v = p.vstup;
      const patkaM = (() => {
        const plne = [], odeb = [];
        const jamka = (x, y, zS, rStart) => { plne.push(k(otoc([[0, zS - o.Ro * S2 - (o.rt - rStart) - 0.02], ...jamkaBody(zS, rStart)]).translate([x, y, 0]))); odeb.push(dutina(zS, x, y), ...zarezy(zS, x, y)); };
        const sestihran = (z0, z1) => {
          const b = []; for (let i = 0; i < 6; i++) b.push([P.Re * Math.cos(i * Math.PI / 3), P.Re * Math.sin(i * Math.PI / 3)]);
          const hr = k(k(k(new CS([b])).extrude(z1 - z0)).translate([0, 0, z0]));
          // spodek sražený 45° od závitu (tisk bez podpor), horní hrana sražená 0,6 mm
          const ob = otoc([[0, z0], [P.zavit.rMaj, z0], [P.Re + 0.6, z0 + P.Re + 0.6 - P.zavit.rMaj], [P.Re + 0.6, z1 - 0.6], [P.Re - 0.2, z1], [0, z1]]);
          return k(hr.intersect(ob));
        };
        if (v.typ === 'zavit' || v.typ === 'rozbocka') {
          const z = P.zavit;
          if (v.tisknoutZavit) plne.push(k(ZG.zavitovaTyc(w, k, { p: z.p, h: z.h, bok: z.bok, rMaj: z.rMaj }, P.Lz + 0.3, Math.max(48, Math.min(120, Math.ceil(2 * Math.PI * z.rMaj / 0.9 / 4) * 4)), 'dole')));
          else plne.push(otoc([[0, 0], [z.rMaj - 0.6, 0], [z.rMaj, 0.6], [z.rMaj, P.Lz + 0.3], [0, P.Lz + 0.3]]));
          plne.push(sestihran(P.zh0, P.zh1));
          if (v.typ === 'zavit') jamka(0, 0, P.zS, o.rn);
          else {
            // tělo rozbočky: obálka šestihranu nahoře a válců pod jamkami (boky 45°)
            const body = [];
            for (let i = 0; i < 6; i++) body.push([P.Re * Math.cos(i * Math.PI / 3), P.Re * Math.sin(i * Math.PI / 3), P.zh1 - 0.3]);
            for (const y of P.vetve) { body.push(...kruhBody(o.rt, P.z1, 0, y), ...kruhBody(o.rt, P.z0, 0, y)); }
            plne.push(obalka(body));
            for (const y of P.vetve) jamka(0, y, P.zS, o.rt);
            if (P.rb > 0) {
              // šikmý kanál z otvoru závitu do každé větve (strop nejvýš 45° – společná komora by měla vodorovný strop)
              for (const y of P.vetve) {
                const zq = P.zh1 - 0.5 + Math.max(1, Math.abs(y) + o.rc - P.rb);
                odeb.push(obalka([...kruhBody(P.rb, P.zh1 - 0.5), ...kruhBody(o.rc, zq, 0, y)]));
                odeb.push(valec(o.rc, zq - 0.05, P.zS, 0, y));
              }
            }
          }
          if (P.rb > 0) odeb.push(valec(P.rb, -1, v.typ === 'zavit' ? P.zS : P.zh1 - 0.45));
        } else if (v.typ === 'priruba') {
          const ch = Math.min(0.8, v.tloustka / 3);
          plne.push(otoc([[0, 0], [P.R - ch, 0], [P.R, ch], [P.R, P.z0 - ch], [P.R - ch, P.z0], [0, P.z0]]));
          jamka(0, 0, P.zS, o.rn);
          for (let i = 0; i < v.der; i++) { const a = 2 * Math.PI * i / v.der; odeb.push(valec(v.dira / 2 + 0.1, -1, P.z0 + 1, v.roztecDer / 2 * Math.cos(a), v.roztecDer / 2 * Math.sin(a))); }
          if (P.rb > 0) odeb.push(valec(P.rb, -1, P.zS));
        } else if (v.typ === 'trn') {
          // trn: od volného konce (z = 0) zuby s mírným náběhem a ostrou hranou k tělu, poslední zub přejde 45° do límce
          const n = Math.max(2, Math.round(P.Lb / Math.max(4, v.hadice * 0.45))), lz = P.Lb / n, b = [[0, 0]];
          for (let i = 0; i < n; i++) {
            const z0 = i * lz;
            b.push([P.rmin, z0], [P.rmax, z0 + lz * 0.82]);
            if (i < n - 1) b.push([P.rmin, z0 + lz * 0.82 + (P.rmax - P.rmin) * 0.6 + 0.001 > z0 + lz ? z0 + lz - 0.001 : z0 + lz * 0.82 + (P.rmax - P.rmin) * 0.6]);
          }
          b[1] = [P.rmin - 0.4, 0];
          b.push([P.rmax, P.Lb], [P.Rkol, P.zKol], [P.Rkol, P.z0], [0, P.z0]);
          plne.push(otoc(b));
          jamka(0, 0, P.zS, o.rn);
          if (P.rb > 0) odeb.push(valec(P.rb, -1, P.zS));
        } else if (v.typ === 'magnet') {
          const ch = 0.8;
          plne.push(otoc([[0, 0], [P.R - ch, 0], [P.R, ch], [P.R, P.z0 - ch], [P.R - ch, P.z0], [0, P.z0]]));
          jamka(0, 0, P.zS, o.rn);
          odeb.push(valec(v.magnet / 2 + 0.15, -1, v.vyskaMagnetu + 0.2));
          if (o.rc > 0) odeb.push(valec(o.rc, P.z0 + 0.6, P.zS));   // jamka bez průtoku: slepý kanál pod dutinou
        }
        return k(M.difference([k(M.union(plne)), ...odeb]));
      })();
      /* ---- tryska ---- */
      const T = tryska(p, o), q = p.tryska;
      const tryskaM = (() => {
        const koule = [[0, -o.a], ...kouleBody()];
        const plne = [], odeb = [];
        if (q.typ === 'kulata') plne.push(otoc([...koule, [T.Rv, T.zE], [0, T.zE]]));
        else if (q.typ === 'sprcha') plne.push(otoc([...koule, [T.R, T.zC], [T.R, T.zE + (T.tw * Math.SQRT2 - T.tw)], [0, T.zVrch]]));
        else if (q.typ === 'zatka') plne.push(otoc([...koule, [o.rn, T.zE], [0, T.zVrch]]));
        else {
          plne.push(otoc([...koule, [0, o.zk]]));
          const nah = q.typ === 'plocha' ? obdBody(T.W, T.Ts, T.zE, T.Ts / 2) : obdBody(T.W, T.H, T.zE, Math.min(4, T.tw * 2));
          plne.push(obalka([...kruhBody(o.rn, o.zk - 0.01), ...nah]));
        }
        if (o.rc > 0) {
          odeb.push(valec(o.rc, -o.a - 1, o.zk + 0.01));
          if (q.typ === 'kulata') odeb.push(otoc([[0, o.zk], [o.rc, o.zk], [T.ru, T.zE], [T.ru, T.zE + 1], [0, T.zE + 1]]));
          if (q.typ === 'plocha') odeb.push(obalka([...kruhBody(o.rc, o.zk - 0.01), ...obdBody(q.sirka - 2 * T.tw, q.sterbina, T.zE, q.sterbina / 2), ...obdBody(q.sirka - 2 * T.tw, q.sterbina, T.zE + 1, q.sterbina / 2)]));
          if (q.typ === 'hubice') odeb.push(obalka([...kruhBody(o.rc, o.zk - 0.01), ...obdBody(q.sirka, q.vyska, T.zE, Math.min(4, T.tw * 2) - T.tw), ...obdBody(q.sirka, q.vyska, T.zE + 1, Math.min(4, T.tw * 2) - T.tw)]));
          if (q.typ === 'sprcha') {
            odeb.push(otoc([[0, o.zk], [o.rc, o.zk], [T.Ri, o.zk + Math.max(0, T.Ri - o.rc)], [T.Ri, T.zE], [0, T.zE + T.Ri]]));
            const n = q.otvoru;
            for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; odeb.push(valec(q.otvor / 2, T.zE - 1, T.zVrch + 1, T.rOtv * Math.cos(a), T.rOtv * Math.sin(a), 16)); }
          }
        }
        return k(M.difference([k(M.union(plne)), ...odeb]));
      })();
      /* ---- kalibrační sada: 1 koule + jamky s odstupňovanou vůlí, značené zářezy na patce ---- */
      const kalibrace = [];
      if (volby.kalibrace || p.tisk.kalibrace) {
        const Rg = o.Ro + 2.5;
        const kk = otoc([[0, -o.a], ...kouleBody(), [Rg, o.zk + Rg - o.rn], [Rg, o.zk + Rg - o.rn + 3], [0, o.zk + Rg - o.rn + 3]]);
        kalibrace.push({ m: o.rc > 0 ? k(kk.subtract(valec(o.rc, -o.a - 1, o.zk + Rg - o.rn + 4))) : kk, nazev: 'Zkušební koule', jmeno: 'kal_koule', vule: null });
        for (const { i, vu, ok } of vuleKalibrace(p)) {
          const zS = 2 + (ok.rt - o.rn) + ok.Ro * S2, Rgi = ok.Ro + 2.5;
          const zt = zS - ok.Ro * S2, aF = Math.atan2(ok.ztop, ok.rf);
          const tel = otoc([[0, 0], [Rgi, 0], [Rgi, 2], [ok.rn, 2], [ok.rt, zt], ...oblouk(0, zS, ok.Ro, -Math.PI / 4, aF, useku(ok.Ro, -Math.PI / 4, aF)).slice(1), [0, zS + ok.ztop]]);
          const aL = Math.atan2(ok.zl, ok.rl);
          const dut = otoc([[0, zS - ok.Rs], ...oblouk(0, zS, ok.Rs, -Math.PI / 2, aL, useku(ok.Rs, -Math.PI / 2, aL)).slice(1), [ok.rl + ok.c, zS + ok.ztop], [ok.rl + ok.c + 3, zS + ok.ztop + 3], [0, zS + ok.ztop + 3]]);
          const odeb = [dut, ...zarezy(zS)];   // zářezy jako na článku – kalibruje se stejné hrdlo
          for (let j = 0; j <= i; j++) odeb.push(k(k(k(M.cube([1.6, 1.2, 3])).translate([Rgi - 1, -0.6, -0.5])).rotate([0, 0, 18 * j])));
          kalibrace.push({ m: k(M.difference([tel, ...odeb])), nazev: `Zkušební jamka ${i + 1} (vůle ${fmt(vu, 2)})`, jmeno: `kal_jamka_${i + 1}`, vule: vu });
        }
      }

      const clanek = sit(k, clanekM, 'clanek', 'Článek', '#2F5FA8');
      const patkaD = sit(k, patkaM, 'patka', NAZVY.dilPatky[v.typ], '#E88A2E');
      const tryskaD = sit(k, tryskaM, 'tryska', 'Tryska – ' + NAZVY.tryska[q.typ], '#E88A2E');
      const kal = kalibrace.map(x => Object.assign(sit(k, x.m, x.jmeno, x.nazev, x.vule === null ? '#2F5FA8' : '#E88A2E'), { vule: x.vule }));

      // sestava pro náhled: patka v počátku, větve s články a tryskou
      const starty = v.typ === 'rozbocka' ? P.vetve.map(y => [0, y, P.zS]) : [[0, 0, P.zS]];
      const ramy = starty.map(s => ramyRetezu(p, o, s));
      const clanky = [], trysky = [];
      for (const r of ramy) {
        for (let i = 0; i < p.retez.pocet; i++) clanky.push({ poz: presun(clanek, r[i]), idx: clanek.idx });
        trysky.push({ poz: presun(tryskaD, r[p.retez.pocet]), idx: tryskaD.idx });
      }
      const sestava = [Object.assign({}, patkaD), slouc(clanky, 'Články', 'clanky', '#2F5FA8'), slouc(trysky, tryskaD.nazev, 'trysky', '#E88A2E')];
      // díly k tisku (každý kus zvlášť)
      const vetvi = starty.length, tisk = [patkaD];
      for (let i = 0; i < vetvi * p.retez.pocet; i++) tisk.push(Object.assign({}, clanek, { nazev: `Článek ${i + 1}` }));
      for (let i = 0; i < vetvi; i++) tisk.push(Object.assign({}, tryskaD, { nazev: vetvi > 1 ? `${tryskaD.nazev} ${i + 1}` : tryskaD.nazev }));
      return { clanek, patka: patkaD, tryska: tryskaD, kalibrace: kal, sestava, tisk, ramy, P, T, o, vetvi, cas: Date.now() - t0 };
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
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const kusy = m.decompose().map(k), idx = new Uint32Array(mesh.triVerts);
    return { jmeno, nazev, poz, idx, objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, barva, otocit: false, tez: teziste(poz, idx) };
  }
  /** Těžiště uzavřené sítě (součet čtyřstěnů s počátkem). */
  function teziste(P, I) {
    let V = 0, x = 0, y = 0, z = 0;
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      const v = (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
      V += v; x += v * (P[a] + P[b] + P[c]) / 4; y += v * (P[a + 1] + P[b + 1] + P[c + 1]) / 4; z += v * (P[a + 2] + P[b + 2] + P[c + 2]) / 4;
    }
    return V > 1e-9 ? [x / V, y / V, z / V] : [0, 0, 0];
  }

  /** Síť jen s trojúhelníky, které sahají nad zMin (rozbor převisů bez závitu); z = 0 zůstává podložkou. */
  function bezSpodku(d, zMin) {
    const I = [], P = d.poz, X = d.idx;
    for (let t = 0; t < X.length; t += 3) if (Math.max(P[3 * X[t] + 2], P[3 * X[t + 1] + 2], P[3 * X[t + 2] + 2]) > zMin) I.push(X[t], X[t + 1], X[t + 2]);
    return Object.assign({}, d, { idx: new Uint32Array(I) });
  }
  function kontrolyModelu(p, model) {
    const H = [];
    const dily = [model.patka, model.clanek, model.tryska, ...model.kalibrace];
    for (const d0 of dily) {
      // boky tištěného závitu patky (≈ 60° od svislice) se nastojato tisknou běžně – do rozboru převisů nepatří
      const d = d0 === model.patka && model.P.Lz ? bezSpodku(d0, model.P.Lz + 0.4) : d0;
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      const r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 3) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v místě převisu může potřebovat podpory.` });
      if (r.most > 1) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu.` });
    }
    return H;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    return `kanál Ø ${fmt(p.kloub.kanal)}, koule Ø ${fmt(p.kloub.koule)} · ${p.retez.pocet} článků · ${NAZVY.vstup[p.vstup.typ]}${p.vstup.typ === 'zavit' || p.vstup.typ === 'rozbocka' ? ' ' + ZAVITY[p.vstup.zavit].nazev : ''} · ${NAZVY.tryska[p.tryska.typ]}`;
  }
  const TYP = 'kloubova_hadice';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Kloubové hadice');

  const API = {
    MATERIALY, ZAVITY, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    normalizuj, predvolba, odvozene, vuleKalibrace, mezniOhyb, patka, tryska, kontroly, uhlyRetezu, natoceniRetezu, ramyRetezu, postav, kontrolyModelu, sekceClanku, presun, slouc, teziste, oblouk,
    popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt, segmenty,
  };
  if (uzel) module.exports = API; else window.KHAD = API;
})();
