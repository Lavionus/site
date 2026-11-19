/* Trychtýře a násypky na míru – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Trychtýř = tělo (kužel, dvojkužel, plochý oválný, násypka s válcem) + výpust (rovná, zahnutá, vlnovec) zakončená spojem
   s hrdlem nádoby: kónus k zasunutí, stupňovitý kónus, závit (našroubovat), límec (nasadit), volný konec.
   Doplňky: odvzdušnění (drážky, žebra, trubička), ucho, zesílený okraj, stupnice objemu (rysky uvnitř), dělení těla
   na 2 díly se závitem, prodloužení výpusti zasouvanými díly, víčko, zátka výpusti, stojánek, kalibrační vzorky hrdla.

   Souřadnice (montážní poloha): osa Z = osa těla, z = 0 je spodek těla (napojení výpusti), ústí nahoře, výpust míří dolů.
   Zahnutá výpust se ohýbá do +X. Tisk: tělo a samostatná výpust ÚSTÍM (resp. spojem) DOLŮ – vnitřek kuželu je pak převis
   rovný polovičnímu úhlu kuželu od svislice (kontrola proti povolenému převisu), okraj a ucho leží na podložce,
   každé rozšíření směrem k výpusti je kužel 45° (osazení, límec, závitová čepička). Díly prodloužení stojí hrdlem dolů.
   postav(w, p, {kalibrace}) → {tisk: [díly], sestava: [díly], kalibrace: [díly], cas}. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const ZG = uzel ? require('../ibc/geometrie.js') : window.IBC_GEOM;   // profilZavitu
  const fmt = G.fmt, kopie = G.kopie;
  const rad = s => s * Math.PI / 180;
  const S2 = Math.SQRT2;

  /* ---------------- databáze hrdel ---------------- */
  const DATUM = '19. 11. 2026';
  const POZNAMKA = 'typické – ověřit měřením';
  /** vnitrni = světlost hrdla (otvor), vnejsi = vnější Ø hrdla / vrcholy závitu, zavit = {p stoupání, h hloubka, delka zašroubování}
      nebo null (přerušený závit sklenic twist-off, neznámý vícechodý), rezim = doporučený spoj. */
  const h = (id, skupina, nazev, vnitrni, vnejsi, zavit, rezim, pozn) => ({ id, skupina, nazev, vnitrni, vnejsi, zavit, rezim, pozn: pozn || '' });
  const HRDLA = [
    h('pco1881', 'PET láhve', 'PET PCO 1881 – 28 mm (nápoje, nízké hrdlo)', 21.7, 27.4, { p: 2.7, h: 1.2, delka: 9 }, 'zavit', 'jednochodý pilový závit, T 27,4, stoupání 2,7 mm'),
    h('pco1810', 'PET láhve', 'PET PCO 1810 – 28 mm (starší, vyšší hrdlo)', 21.7, 27.4, { p: 3.18, h: 1.2, delka: 11 }, 'zavit', 'T 27,4, stoupání se uvádí 3,18 mm'),
    h('pet38', 'PET láhve', 'PET 38 mm (džusy, mléko)', 33, 37.7, null, 'zasun', 'třichodý závit – jen zasunutí nebo límec'),
    h('vino', 'PET láhve', 'Skleněná láhev – víno, sirup (hrdlo 18,5)', 18.5, 29, null, 'zasun'),
    h('to53', 'Sklenice twist-off', 'Sklenice TO 53', 43, 51.9, null, 'limec', 'přerušený závit (4 výstupky víčka) – nasadit límcem; světlost odhadnutá'),
    h('to63', 'Sklenice twist-off', 'Sklenice TO 63', 53, 62.05, null, 'limec', 'přerušený závit (4 výstupky) – nasadit límcem; světlost odhadnutá'),
    h('to66', 'Sklenice twist-off', 'Sklenice TO 66', 56, 65, null, 'limec', 'přerušený závit (4 výstupky) – nasadit límcem; světlost odhadnutá'),
    h('to82', 'Sklenice twist-off', 'Sklenice TO 82 (zavařovací)', 71, 80.75, null, 'limec', 'přerušený závit (6 výstupků) – nasadit límcem; světlost odhadnutá'),
    h('din45', 'Kanystry', 'Kanystr DIN 45', 35, 44.3, { p: 4, h: 2, delka: 12 }, 'zavit', 'pilový závit, stoupání 4 mm'),
    h('din51', 'Kanystry', 'Kanystr DIN 51', 43.6, 53.5, { p: 5, h: 2.1, delka: 13 }, 'zavit', 'pilový závit, stoupání 5 mm'),
    h('din61', 'Kanystry', 'Kanystr DIN 61 (S60×6)', 48.5, 59.8, { p: 6, h: 2.8, delka: 14 }, 'zavit', 'pilový závit, stoupání 6 mm'),
    h('din71', 'Kanystry', 'Kanystr DIN 71', 57.4, 71, { p: 6, h: 3, delka: 14 }, 'zavit', 'stoupání 6 mm'),
    h('auto_benzin', 'Nádrže a motory', 'Auto – plnicí hrdlo benzín (pistole Ø 21)', 23, 0, null, 'zasun', 'zúžené hrdlo s klapkou; u hrdla bez víčka (capless) otevřít klapku dodávanou nálevkou'),
    h('auto_nafta', 'Nádrže a motory', 'Auto – plnicí hrdlo nafta', 26, 0, null, 'zasun', 'hrdlo s klapkou nebo bez víčka – ověřit'),
    h('adblue', 'Nádrže a motory', 'Auto – hrdlo AdBlue', 24, 0, null, 'zasun'),
    h('olej_motor', 'Nádrže a motory', 'Motor – plnicí hrdlo oleje', 30, 0, null, 'zasun', 'liší se podle motoru'),
    h('sekacka', 'Nádrže a motory', 'Sekačka – hrdlo nádrže', 32, 0, null, 'zasun'),
    h('krovinorez', 'Nádrže a motory', 'Křovinořez, motorová pila – hrdlo nádrže', 22, 0, null, 'zasun'),
    h('ibc_dn150', 'IBC', 'IBC – plnicí hrdlo DN150 (místo víka)', 145, 160, { p: 6, h: 3, delka: 16 }, 'zavit', 'u výrobců Ø 150–165, stoupání 6–8'),
    h('ibc_s60', 'IBC', 'IBC – výpust S60×6 (DN50)', 49, 60, { p: 6, h: 2.5, delka: 14 }, 'zavit'),
  ];
  const najdiHrdlo = id => HRDLA.find(x => x.id === id) || null;

  /* ---------------- tabulky ---------------- */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27 },
    PP: { nazev: 'PP (polypropylen)', hustota: 0.9 },
    PLA: { nazev: 'PLA', hustota: 1.24 },
    ASA: { nazev: 'ASA', hustota: 1.07 },
    ABS: { nazev: 'ABS', hustota: 1.04 },
    PA: { nazev: 'PA (nylon)', hustota: 1.14 },
    TPU: { nazev: 'TPU 95A (pružný)', hustota: 1.21 },
  };
  /** Kapaliny: hustota kg/m³, kinematická viskozita mm²/s při ~20 °C (orientační). Sypké: sypná hustota kg/m³, zrno mm,
      největší polovina vrcholového úhlu pro tok celou hmotou (°), soudrzna = Beverloo neplatí. */
  const MEDIA = {
    voda: { nazev: 'voda', rho: 1000, nu: 1.0 },
    benzin: { nazev: 'benzín', rho: 740, nu: 0.6, palivo: true },
    nafta: { nazev: 'nafta', rho: 835, nu: 4, palivo: true },
    olej: { nazev: 'motorový olej 5W-30', rho: 860, nu: 120 },
    jedly: { nazev: 'jedlý olej', rho: 915, nu: 65 },
    adblue: { nazev: 'AdBlue', rho: 1090, nu: 1.4 },
    med: { nazev: 'med', rho: 1420, nu: 7000 },
    cukr: { nazev: 'cukr krystal', sypke: true, rho: 850, zrno: 0.6, uhel: 30 },
    sul: { nazev: 'sůl', sypke: true, rho: 1200, zrno: 0.5, uhel: 30 },
    ryze: { nazev: 'rýže', sypke: true, rho: 800, zrno: 2.5, uhel: 30 },
    granulat: { nazev: 'plastový granulát', sypke: true, rho: 600, zrno: 3.5, uhel: 35 },
    kava: { nazev: 'kávová zrna', sypke: true, rho: 380, zrno: 8, uhel: 30 },
    pisek: { nazev: 'suchý písek', sypke: true, rho: 1500, zrno: 0.4, uhel: 30 },
    mouka: { nazev: 'mouka', sypke: true, rho: 550, zrno: 0.05, uhel: 20, soudrzna: true },
  };
  const NAZVY = {
    rezim: { zasun: 'kónus k zasunutí', stupne: 'stupňovitý kónus', zavit: 'závit – našroubovat', limec: 'límec – nasadit', volne: 'volná výpust' },
    tvar: { kuzel: 'kužel', dvoj: 'dvojkužel', plochy: 'plochý oválný', nasypka: 'násypka s válcem' },
    vypust: { rovna: 'rovná', zahnuta: 'zahnutá', vlnovec: 'vlnovec (ohebná)' },
    odvz: { zadne: 'bez odvzdušnění', drazky: 'drážky', zebra: 'žebra', trubicka: 'trubička' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Trychtýř',
    hrdlo: {
      zdroj: 'pco1881', rezim: 'zasun', vnitrni: 21.7, vnejsi: 27.4, stoupani: 2.7, hloubkaZ: 1.2, delkaZ: 9,
      vule: 0.3, kuzel: 3, hloubka: 12, dMin: 18, dMax: 34, stupnu: 3, vyskaStupne: 7, mezera: 1.2, limec: 4, tlLimce: 3, sukne: 4,
    },
    vypust: { delka: 30, stena: 1.6, prumer: 14, tvar: 'rovna', uhel: 30, polomer: 0, horni: 8, vln: 4, vyskaVlny: 2, dil: false, spoj: 12, vuleSpoje: 0.2 },
    odvz: { typ: 'drazky', pocet: 4, sirka: 2.5, hloubka: 0.8, trubicka: 3, delkaTrubicky: 25 },
    telo: { tvar: 'kuzel', prumer: 100, uhel: 30, prumer2: 50, uhel2: 15, sirka: 120, hloubkaO: 50, valec: 30, lem: 5, stena: 1.6, okraj: 2, vyskaOkraje: 2, ucho: true, otvorUcha: 6 },
    stupnice: { zap: false, krok: 50, hlavni: 2 },
    deleni: { zap: false, vyska: 0, delka: 10, stoupani: 4, hloubka: 1.5, vule: 0.35 },
    prodlouzeni: { dilu: 0, delka: 80 },
    doplnky: { vicko: false, zatka: false, stojanek: false, seda: 0.6 },
    kalibrace: { kusu: 5, krok: 0.1 },
    tisk: { material: 'PETG', vrstva: 0.2, extruze: 0.45, uhel: 45, sad: 1, podlozka: 220 },
    vypocty: { medium: 'voda', plneni: 90 },
  };
  const MEZE = {
    'hrdlo.vnitrni': [4, 200], 'hrdlo.vnejsi': [0, 230], 'hrdlo.stoupani': [0.5, 12], 'hrdlo.hloubkaZ': [0.3, 5], 'hrdlo.delkaZ': [3, 40],
    'hrdlo.vule': [-0.5, 2], 'hrdlo.kuzel': [0.5, 15], 'hrdlo.hloubka': [3, 80], 'hrdlo.dMin': [4, 200], 'hrdlo.dMax': [5, 220],
    'hrdlo.stupnu': [2, 8, 1], 'hrdlo.vyskaStupne': [2, 40], 'hrdlo.mezera': [0.3, 10], 'hrdlo.limec': [1, 30], 'hrdlo.tlLimce': [1.2, 10], 'hrdlo.sukne': [0, 30],
    'vypust.delka': [3, 300], 'vypust.stena': [0.8, 6], 'vypust.prumer': [4, 150], 'vypust.uhel': [0, 90], 'vypust.polomer': [0, 300],
    'vypust.horni': [0, 200], 'vypust.vln': [2, 30, 1], 'vypust.vyskaVlny': [0.8, 6], 'vypust.spoj': [5, 40], 'vypust.vuleSpoje': [-0.2, 1],
    'odvz.pocet': [1, 8, 1], 'odvz.sirka': [0.8, 8], 'odvz.hloubka': [0.3, 4], 'odvz.trubicka': [1.5, 8], 'odvz.delkaTrubicky': [2, 200],
    'telo.prumer': [20, 400], 'telo.uhel': [10, 70], 'telo.prumer2': [10, 400], 'telo.uhel2': [5, 60], 'telo.sirka': [20, 400], 'telo.hloubkaO': [10, 300],
    'telo.valec': [0, 300], 'telo.lem': [0, 60], 'telo.stena': [0.8, 6], 'telo.okraj': [0, 15], 'telo.vyskaOkraje': [0.6, 10], 'telo.otvorUcha': [2, 20],
    'stupnice.krok': [1, 5000], 'stupnice.hlavni': [1, 10, 1],
    'deleni.vyska': [0, 400], 'deleni.delka': [5, 30], 'deleni.stoupani': [2, 8], 'deleni.hloubka': [0.6, 3], 'deleni.vule': [0, 1],
    'prodlouzeni.dilu': [0, 6, 1], 'prodlouzeni.delka': [20, 300], 'doplnky.seda': [0.3, 0.95],
    'kalibrace.kusu': [2, 9, 1], 'kalibrace.krok': [0.02, 0.5],
    'tisk.vrstva': [0.05, 0.5], 'tisk.extruze': [0.2, 1.2], 'tisk.uhel': [20, 75], 'tisk.sad': [1, 10, 1], 'tisk.podlozka': [80, 600],
    'vypocty.plneni': [5, 100],
  };
  const VYCTY = {
    'hrdlo.rezim': Object.keys(NAZVY.rezim), 'telo.tvar': Object.keys(NAZVY.tvar), 'vypust.tvar': Object.keys(NAZVY.vypust),
    'odvz.typ': Object.keys(NAZVY.odvz), 'tisk.material': Object.keys(MATERIALY), 'vypocty.medium': Object.keys(MEDIA),
  };

  /** Předvolby: odchylky od výchozího projektu (tisk zůstává uživatelův). */
  const PREDVOLBY = [
    { id: 'pet_zasun', nazev: 'Do PET láhve – zasunout', popis: 'kónus do hrdla 28 mm, drážky na vzduch, Ø 100', p: {} },
    { id: 'pet_sroub', nazev: 'Na PET láhev – našroubovat', popis: 'závit PCO 1881, drážky přes závit, Ø 100',
      p: { nazev: 'Trychtýř na PET – závit', hrdlo: { rezim: 'zavit' }, vypust: { delka: 12 } } },
    { id: 'sklenice82', nazev: 'Zavařovací – sklenice TO 82', popis: 'široká výpust s límcem a sukní, Ø 150',
      p: { nazev: 'Zavařovací trychtýř', hrdlo: { zdroj: 'to82', rezim: 'limec', vnitrni: 71, vnejsi: 80.75, mezera: 1.5, limec: 4, sukne: 5 },
        vypust: { delka: 12, stena: 2 }, odvz: { pocet: 6, sirka: 4, hloubka: 1.5 }, telo: { prumer: 150, uhel: 35, lem: 8, stena: 2 } } },
    { id: 'kanystr61', nazev: 'Kanystr DIN 61 – našroubovat', popis: 'závit S60×6, trubička hlídá hladinu, Ø 160',
      p: { nazev: 'Kanystr DIN 61', hrdlo: { zdroj: 'din61', rezim: 'zavit', vnitrni: 48.5, vnejsi: 59.8, stoupani: 6, hloubkaZ: 2.8, delkaZ: 14, vule: 0.4, mezera: 6.5 },
        vypust: { delka: 15, stena: 3.2 }, odvz: { typ: 'trubicka', trubicka: 4, delkaTrubicky: 40 }, telo: { prumer: 160, uhel: 35, stena: 2 } } },
    { id: 'nadrz_auto', nazev: 'Nádrž auta – zahnutá výpust', popis: 'kónus do hrdla nafty, ohyb 30°, Ø 140',
      p: { nazev: 'Nádrž – zahnutá', hrdlo: { zdroj: 'auto_nafta', rezim: 'zasun', vnitrni: 26, vnejsi: 0, hloubka: 25, kuzel: 2 },
        vypust: { tvar: 'zahnuta', uhel: 30, horni: 15, delka: 45, stena: 1.8 }, telo: { prumer: 140, uhel: 32, stena: 1.8 } } },
    { id: 'dlouhy', nazev: 'Dlouhá výpust – 3 díly', popis: 'výpust zvlášť + 2 prodloužení se zasouvacím spojem',
      p: { nazev: 'Trychtýř s prodloužením', hrdlo: { zdroj: 'auto_benzin', rezim: 'zasun', vnitrni: 23, vnejsi: 0, hloubka: 20, kuzel: 2 },
        vypust: { delka: 40, dil: true }, prodlouzeni: { dilu: 2, delka: 90 }, telo: { prumer: 120 } } },
    { id: 'sekacka', nazev: 'Sekačka, křovinořez – krátký', popis: 'stupňovitý kónus 20–34 mm, žebra, vlnovec',
      p: { nazev: 'Nádrž nářadí', hrdlo: { zdroj: 'vlastni', rezim: 'stupne', dMin: 20, dMax: 34, stupnu: 3, vyskaStupne: 6, vule: 0 },
        vypust: { tvar: 'vlnovec', vln: 4, vyskaVlny: 1.6 }, odvz: { typ: 'zebra', pocet: 4, sirka: 1.6, hloubka: 1 }, telo: { prumer: 90 } } },
    { id: 'olej_plochy', nazev: 'Plochý na olej do motoru', popis: 'oválné ústí 130 × 50 do úzkého místa',
      p: { nazev: 'Plochý na olej', hrdlo: { zdroj: 'olej_motor', rezim: 'zasun', vnitrni: 30, vnejsi: 0, hloubka: 15 },
        telo: { tvar: 'plochy', sirka: 130, hloubkaO: 50, uhel: 40, lem: 6 }, vypocty: { medium: 'olej' } } },
    { id: 'granulat', nazev: 'Násypka na granulát / zrní', popis: 'kužel 25° s válcem, volná výpust Ø 30, stojánek',
      p: { nazev: 'Násypka', hrdlo: { zdroj: 'vlastni', rezim: 'volne' }, vypust: { prumer: 30, delka: 20, stena: 2 }, odvz: { typ: 'zadne' },
        telo: { tvar: 'nasypka', prumer: 150, uhel: 25, valec: 40, stena: 2 }, doplnky: { stojanek: true }, vypocty: { medium: 'granulat' } } },
    { id: 'odmerny', nazev: 'Odměrný se stupnicí', popis: 'dvojkužel Ø 110, rysky po 25 ml, zátka výpusti',
      p: { nazev: 'Odměrný trychtýř', hrdlo: { zdroj: 'vlastni', rezim: 'volne' }, vypust: { prumer: 14, delka: 30 }, odvz: { typ: 'zadne' },
        telo: { tvar: 'dvoj', prumer: 110, uhel: 35, prumer2: 60, uhel2: 15 }, stupnice: { zap: true, krok: 25, hlavni: 4 }, doplnky: { zatka: true, vicko: true } } },
    { id: 'ibc_deleny', nazev: 'IBC DN150 – velký dělený', popis: 'našroubuje se místo víka, tělo Ø 196 ze 2 dílů',
      p: { nazev: 'IBC trychtýř', hrdlo: { zdroj: 'ibc_dn150', rezim: 'zavit', vnitrni: 145, vnejsi: 160, stoupani: 6, hloubkaZ: 3, delkaZ: 16, vule: 0.5 },
        vypust: { delka: 10, stena: 2.4 }, odvz: { pocet: 6, sirka: 4, hloubka: 1.5 }, telo: { prumer: 196, uhel: 40, stena: 2.4, lem: 6 }, deleni: { zap: true } } },
  ];

  function normalizuj(v) { return G.normalizuj(v, { VYCHOZI, MEZE, VYCTY }); }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  /** Rozměry hrdla z databáze do projektu (zdroj, světlost, vnější Ø, závit, doporučený spoj). */
  function hrdloZDb(q, id) {
    const x = najdiHrdlo(id);
    if (!x) { q.hrdlo.zdroj = 'vlastni'; return q; }
    Object.assign(q.hrdlo, { zdroj: id, vnitrni: x.vnitrni, vnejsi: x.vnejsi, rezim: x.rezim });
    if (x.zavit) Object.assign(q.hrdlo, { stoupani: x.zavit.p, hloubkaZ: x.zavit.h, delkaZ: x.zavit.delka });
    if (x.rezim === 'stupne') Object.assign(q.hrdlo, { dMin: x.vnitrni - 4, dMax: x.vnitrni + 8 });
    return q;
  }
  /** Zdroj z databáze, jen když rozměry v projektu odpovídají položce (jinak „vlastní“). */
  function zdrojHrdla(p) {
    const x = najdiHrdlo(p.hrdlo.zdroj), e = p.hrdlo;
    if (!x) return null;
    if (Math.abs(x.vnitrni - e.vnitrni) > 1e-6 || Math.abs(x.vnejsi - e.vnejsi) > 1e-6) return null;
    if (x.zavit && e.rezim === 'zavit' && (Math.abs(x.zavit.p - e.stoupani) > 1e-6 || Math.abs(x.zavit.h - e.hloubkaZ) > 1e-6)) return Object.assign({ upraveno: true }, x);
    return x;
  }
  const segmenty = r => Math.max(40, Math.min(160, Math.ceil(2 * Math.PI * Math.max(r, 1) / 0.9 / 4) * 4));

  /* ---------------- odvozené rozměry ---------------- */
  /** Odsazení lomené čáry (r, z) o t doprava (ven, pro čáru vedenou nahoru) s ostrými spoji. */
  function odsad(P, t) {
    const n = (a, b) => { const dr = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dr, dz) || 1; return [dz / l, -dr / l]; };
    const out = [];
    for (let i = 0; i < P.length; i++) {
      if (i === 0) { const m = n(P[0], P[1]); out.push([P[0][0] + t * m[0], P[0][1] + t * m[1]]); continue; }
      if (i === P.length - 1) { const m = n(P[i - 1], P[i]); out.push([P[i][0] + t * m[0], P[i][1] + t * m[1]]); continue; }
      const m1 = n(P[i - 1], P[i]), m2 = n(P[i], P[i + 1]), s = [m1[0] + m2[0], m1[1] + m2[1]], c = 1 + m1[0] * m2[0] + m1[1] * m2[1];
      out.push([P[i][0] + t * s[0] / c, P[i][1] + t * s[1] / c]);
    }
    return out;
  }
  /** Poloměr lomené čáry v (r, z) ve výšce z (lineárně; mimo rozsah krajní hodnota). */
  function rV(P, z) {
    if (z <= P[0][1]) return P[0][0];
    for (let i = 1; i < P.length; i++) if (z <= P[i][1] + 1e-9) { const a = P[i - 1], b = P[i], u = b[1] - a[1] > 1e-9 ? (z - a[1]) / (b[1] - a[1]) : 1; return a[0] + (b[0] - a[0]) * u; }
    return P[P.length - 1][0];
  }
  const perimElipsy = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

  function odvozene(p) {
    const H = p.hrdlo, V = p.vypust, T = p.telo, o = { chyba: '' };
    o.rezim = H.rezim;
    o.hrot = ['zasun', 'stupne', 'volne'].includes(H.rezim);   // spoj je na konci výpusti
    const tv = V.stena;
    o.tv = tv;
    // profil hrotu (vnější r podle s od konce výpusti)
    let prof;
    if (H.rezim === 'zasun') {
      const k = Math.tan(rad(H.kuzel)), rw = H.vnitrni / 2 - H.vule, L = Math.max(V.delka, H.hloubka + 1);
      prof = [[rw - H.hloubka * k, 0], [rw + (L - H.hloubka) * k, L]];
      o.rw = rw; o.hz = H.hloubka;
    } else if (H.rezim === 'stupne') {
      const n = H.stupnu, prof2 = [];
      let s = 0;
      for (let i = 0; i < n; i++) {
        const r = (H.dMin + (H.dMax - H.dMin) * i / (n - 1)) / 2 - H.vule;
        if (i > 0) { const r0 = prof2[prof2.length - 1][0]; s += Math.max(0, r - r0); }
        prof2.push([r, s]); s += H.vyskaStupne; prof2.push([r, s]);
      }
      prof = prof2;
      o.stupne = prof2.filter((_, i) => i % 2 === 0).map(q => 2 * (q[0] + H.vule));
    } else if (H.rezim === 'volne') prof = [[V.prumer / 2, 0], [V.prumer / 2, V.delka]];
    else { const r = H.vnitrni / 2 - H.mezera; prof = [[r, 0], [r, V.delka]]; }
    o.prof = prof;
    // žebra: trubka výpusti je o výšku žeber užší, obálku spoje drží žebra
    o.sniz = o.hrot && p.odvz.typ === 'zebra' ? p.odvz.hloubka : 0;
    o.ri = prof[0][0] - o.sniz - tv;
    o.ro = o.ri + tv;
    o.rT = prof[prof.length - 1][0] - o.sniz;
    o.Ltip = prof[prof.length - 1][1];
    if (!(o.ri > 1)) o.chyba = 'výpust je příliš úzká – průchod by vyšel ' + fmt(2 * o.ri, 1) + ' mm';
    // výpust jako samostatný díl (vlastní volba nebo kvůli prodloužení)
    o.dilVypusti = o.hrot && (V.dil || p.prodlouzeni.dilu > 0);
    o.ohyb = o.hrot && V.tvar === 'zahnuta' ? V.uhel : 0;
    o.vlnovec = o.hrot && V.tvar === 'vlnovec';
    o.Rb = V.polomer > 0 ? V.polomer : Math.max(1.5 * 2 * o.ro, o.ro + 3);
    o.Lspoj = V.spoj; o.vs = V.vuleSpoje;
    o.Lp = (o.dilVypusti ? V.spoj : 0) + (o.ohyb > 0 ? V.horni : 0);
    o.Lb = o.vlnovec ? V.vln * 2 * V.vyskaVlny : 0;
    o.Lh = o.Lp + o.Lb;
    o.horniCast = o.Lh > 0 || o.ohyb > 0;                       // nad hrotem je trubka (přechod 45° z hrotu na trubku)
    // přechod hrotu na trubku: u nakloněného hrotu strmější, aby i v tiskové poloze zůstal do povoleného převisu
    o.tgPrechodu = Math.tan(rad(o.ohyb > 0 ? Math.max(10, p.tisk.uhel - o.ohyb) : 45));
    o.prechod = o.horniCast ? Math.max(0, o.rT - o.ro) / o.tgPrechodu : 0;
    o.Lt = o.Ltip + o.prechod;
    // konec výpusti (vodorovné vyložení a pokles od spodku těla)
    const b = rad(o.ohyb);
    o.pokles = o.Lh + o.Rb * Math.sin(b) + o.Lt * Math.cos(b);
    o.vylozeni = o.Rb * (1 - Math.cos(b)) + o.Lt * Math.sin(b);
    o.delkaVypusti = o.Lh + o.Rb * b + o.Lt;
    // spoj nahoře výpusti: čepička se závitem / límec
    if (H.rezim === 'zavit') {
      const rMaj = H.vnejsi / 2 + H.vule;
      o.cap = { rMaj, h: H.hloubkaZ, p: H.stoupani, Lz: H.delkaZ, rMin: rMaj - H.hloubkaZ, Rc: rMaj + Math.max(2, p.telo.stena + 0.6) };
    }
    if (H.rezim === 'limec') {
      const tl = H.tlLimce, rsi = H.vnejsi / 2 + Math.max(0, H.vule), rso = rsi + Math.max(1.6, T.stena);
      o.lim = { tl, rsi, rso, hs: H.sukne, Rl: Math.max(H.vnejsi / 2 + H.limec, H.sukne > 0 ? rso : 0) };
    }
    // tělo – vnitřní obrys
    const t = T.stena;
    o.t = t;
    o.plochy = T.tvar === 'plochy';
    const ri = o.ri;
    if (o.plochy) {
      const a = T.sirka / 2, bb = Math.min(T.hloubkaO, T.sirka) / 2;
      o.a = a; o.b = bb;
      o.Hk = Math.max(2, (a - t - ri) / Math.tan(rad(T.uhel)));
      const tgA = (a - t - ri) / o.Hk, tgB = (bb - t - ri) / o.Hk;
      o.ai = a - t * Math.sqrt(1 + tgA * tgA); o.bi = bb - t * Math.sqrt(1 + tgB * tgB);
      o.zTop = o.Hk + T.lem;
      o.uhelMax = T.uhel; o.uhelB = Math.atan(Math.max(0, tgB)) * 180 / Math.PI;
      if (!(o.bi > ri + 0.5)) o.chyba = o.chyba || 'plochý trychtýř je mělčí než výpust – zvětšete hloubku ústí';
      o.Rout = a;
    } else {
      const Rin = T.prumer / 2 - t;
      const P = [[ri, 0]];
      let z = 0;
      if (T.tvar === 'dvoj') {
        const R2 = Math.min(T.prumer2 / 2 - t, Rin - 0.5);
        if (R2 > ri) { z += (R2 - ri) / Math.tan(rad(T.uhel2)); P.push([R2, z]); }
      }
      const r0 = P[P.length - 1][0];
      if (Rin > r0) { z += (Rin - r0) / Math.tan(rad(T.uhel)); P.push([Rin, z]); }
      o.Hk = z;
      z += T.lem + (T.tvar === 'nasypka' ? T.valec : 0);
      if (z > o.Hk + 1e-9) P.push([Rin, z]); else { P.push([Rin, z + 0.8]); z += 0.8; }
      o.zTop = z;
      o.Pin = P;
      o.Pout = odsad(P, t);
      // spodek vnějšku na z = 0
      const a0 = o.Pout[0], a1 = o.Pout[1];
      const u = (0 - a0[1]) / (a1[1] - a0[1]);
      o.Pout[0] = [a0[0] + (a1[0] - a0[0]) * u, 0];
      o.Pout[o.Pout.length - 1] = [Rin + t, z];
      o.Rout = Rin + t;
      o.uhelMax = Math.max(T.uhel, T.tvar === 'dvoj' ? T.uhel2 : 0);
      if (!(Rin > ri + 1)) o.chyba = o.chyba || 'ústí je užší než výpust';
    }
    // okraj (zesílení) a ucho
    o.Rokraj = o.Rout + T.okraj;
    o.hOkraj = Math.min(T.vyskaOkraje, o.zTop);
    o.ucho = T.ucho ? { r: T.otvorUcha / 2 + 4, d: T.otvorUcha, tl: Math.min(3, o.zTop) } : null;
    if (o.ucho) o.ucho.x = o.Rokraj + o.ucho.r - 1;
    o.sirkaCelkem = 2 * o.Rokraj + (o.ucho ? 2 * o.ucho.r - 1 : 0);
    // dělení těla
    if (p.deleni.zap && !o.plochy) {
      const D = p.deleni, Lj = D.delka;
      const zs = D.vyska > 0 ? D.vyska : Math.max(5, o.Hk * 0.45);
      const rTop = rV(o.Pin, zs + Lj);
      const Rj = rTop + Math.max(1.6, t) + D.hloubka;
      o.del = { zs, Lj, Rj, h: D.hloubka, p: D.stoupani, v: D.vule, Rf: Rj + D.vule + Math.max(2, t) };
      if (zs < 3 || zs + Lj > o.zTop - 3) o.chyba = o.chyba || 'dělení je mimo tělo – výška dělení musí být mezi 3 mm a ' + fmt(o.zTop - Lj - 3, 0) + ' mm';
    }
    // vnitřní objem (ml) podle výšky hladiny v těle
    const Abore = Math.PI * ri * ri;
    o.objemVypusti = Abore * (o.delkaVypusti + (o.dilVypusti ? p.prodlouzeni.dilu * p.prodlouzeni.delka : 0) + (o.lim ? o.lim.tl : 0)) / 1000;
    o.plocha = z0 => {
      if (o.plochy) {
        const u = Math.max(0, Math.min(1, z0 / o.Hk));
        if (z0 > o.Hk) return Math.PI * o.ai * o.bi;
        return u * u * Math.PI * o.ai * o.bi + u * (1 - u) * ri * perimElipsy(o.ai, o.bi) + (1 - u) * (1 - u) * Math.PI * ri * ri;
      }
      const r = rV(o.Pin, z0); return Math.PI * r * r;
    };
    o.objem = z0 => {   // ml od konce výpusti po hladinu z0 v těle (Simpson po úsecích)
      const n = 120, zz = Math.max(0, Math.min(o.zTop, z0)), hh = zz / n;
      let s = 0;
      for (let i = 0; i < n; i++) { const a = i * hh, m = a + hh / 2, c = a + hh; s += hh / 6 * (o.plocha(a) + 4 * o.plocha(m) + o.plocha(c)); }
      return o.objemVypusti + s / 1000;
    };
    o.objemCelkem = o.objem(o.zTop);
    // stupnice
    o.rysky = [];
    if (p.stupnice.zap && !o.plochy) {
      const krok = p.stupnice.krok, zMax = o.zTop - 2, zMin = 3;
      for (let i = 1; i < 400; i++) {
        const Vc = i * krok;
        if (Vc > o.objem(zMax)) break;
        let lo = 0, hi = zMax;
        for (let j = 0; j < 40; j++) { const m = (lo + hi) / 2; if (o.objem(m) < Vc) lo = m; else hi = m; }
        if (lo >= zMin) o.rysky.push({ z: lo, V: Vc, dlouha: i % p.stupnice.hlavni === 0 });
      }
    }
    return o;
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), Hr = p.hrdlo, T = p.telo, V = p.vypust, tk = p.tisk;
    const add = (uroven, text, pole, oprava) => H.push(Object.assign({ uroven, text, pole }, oprava ? { oprava } : {}));
    if (o.chyba) add('chyba', 'Model nelze sestavit: ' + o.chyba + '.', ['vypust.prumer', 'hrdlo.vnitrni', 'telo.prumer']);
    const ext = tk.extruze;
    if (T.stena < 2 * ext - 1e-9) add('varovani', `Stěna těla ${fmt(T.stena, 2)} mm je tenčí než 2 extruze (${fmt(2 * ext, 2)} mm) – slicer ji vyplní jen jednou čárou.`, 'telo.stena', { text: `Nastavit ${fmt(2 * ext, 2)} mm`, pole: 'telo.stena', hodnota: Math.round(2 * ext * 100) / 100 });
    if (V.stena < 2 * ext - 1e-9) add('varovani', `Stěna výpusti ${fmt(V.stena, 2)} mm je tenčí než 2 extruze (${fmt(2 * ext, 2)} mm).`, 'vypust.stena', { text: `Nastavit ${fmt(2 * ext, 2)} mm`, pole: 'vypust.stena', hodnota: Math.round(2 * ext * 100) / 100 });
    // převis vnitřku (tisk ústím dolů)
    if (o.uhelMax > tk.uhel + 1e-9) add('varovani', `Kužel má polovinu vrcholového úhlu ${fmt(o.uhelMax, 0)}° od osy – při tisku ústím dolů je vnitřek převis ${fmt(o.uhelMax, 0)}° od svislice, víc než povolených ${fmt(tk.uhel, 0)}°. Zužte kužel (vyšší trychtýř) nebo tiskněte s podporami.`, ['telo.uhel', 'tisk.uhel'],
      { text: `Úhel kuželu ${fmt(tk.uhel, 0)}°`, pole: T.tvar === 'dvoj' && T.uhel2 > tk.uhel ? 'telo.uhel2' : 'telo.uhel', hodnota: tk.uhel });
    if (T.tvar === 'dvoj' && T.uhel2 >= T.uhel) add('info', 'Dvojkužel: spodní kužel bývá strmější (menší úhel) než horní – jinak je to obyčejný kužel.', 'telo.uhel2');
    if (T.tvar === 'dvoj' && T.prumer2 >= T.prumer) add('varovani', 'Průměr zlomu dvojkuželu je větší než ústí – zlom se vynechá.', 'telo.prumer2');
    if (o.sirkaCelkem > tk.podlozka) add('varovani', `Trychtýř je široký ${fmt(o.sirkaCelkem, 0)} mm (s uchem a okrajem) – víc než podložka ${fmt(tk.podlozka, 0)} mm.`, ['telo.prumer', 'tisk.podlozka']);
    // spoj s hrdlem
    if (!o.hrot) {
      if (V.tvar !== 'rovna') add('chyba', `Se spojem „${NAZVY.rezim[Hr.rezim]}“ musí být výpust rovná – ${Hr.rezim === 'zavit' ? 'zahnutou výpust nejde našroubovat' : 'límec sedí na hrdle nad výpustí'}.`, 'vypust.tvar', { text: 'Rovná výpust', pole: 'vypust.tvar', hodnota: 'rovna' });
      if (V.dil) add('info', 'Se závitem nebo límcem zůstává výpust součástí těla (samostatný díl jen u kónusu a volné výpusti).', 'vypust.dil');
      if (p.prodlouzeni.dilu > 0) add('chyba', 'Prodloužení jde jen u spoje na konci výpusti (kónus, stupně, volná) – se závitem nebo límcem by trubka visela pod hrdlem.', 'prodlouzeni.dilu', { text: 'Bez prodloužení', pole: 'prodlouzeni.dilu', hodnota: 0 });
    }
    if (Hr.rezim === 'zasun') {
      if (V.delka < Hr.hloubka + 3) add('chyba', `Výpust (${fmt(V.delka)} mm) je kratší než hloubka zasunutí + 3 mm – kónus by nesedl v hrdle a drážky by nevedly nad hrdlo.`, ['vypust.delka', 'hrdlo.hloubka'], { text: `Délka výpusti ${fmt(Hr.hloubka + 8)} mm`, pole: 'vypust.delka', hodnota: Hr.hloubka + 8 });
      if (Hr.vnitrni < 2 * (V.stena + 1.5) + 2 * Hr.hloubka * Math.tan(rad(Hr.kuzel))) add('chyba', 'Hrdlo je na tento kónus a stěnu výpusti příliš úzké – zmenšete kužel, hloubku zasunutí nebo stěnu.', ['hrdlo.kuzel', 'hrdlo.hloubka', 'vypust.stena']);
    }
    if (Hr.rezim === 'stupne' && Hr.dMax <= Hr.dMin + 1) add('chyba', 'Stupňovitý kónus: největší průměr musí být větší než nejmenší.', ['hrdlo.dMax', 'hrdlo.dMin'], { text: 'Rozsah +12 mm', pole: 'hrdlo.dMax', hodnota: Hr.dMin + 12 });
    if (Hr.rezim === 'zavit') {
      const x = najdiHrdlo(Hr.zdroj);
      if (x && !x.zavit && zdrojHrdla(p)) add('chyba', `${x.nazev}: závit v databázi není (${x.pozn || 'přerušený nebo vícechodý'}). Použijte límec nebo zasunutí, nebo zadejte vlastní závit.`, 'hrdlo.rezim', { text: 'Nasadit límcem', pole: 'hrdlo.rezim', hodnota: 'limec' });
      if (!(Hr.vnejsi > 0)) add('chyba', 'Pro závit zadejte vnější průměr závitu hrdla (vrcholy).', 'hrdlo.vnejsi');
      else if (o.cap && o.ro > o.cap.rMin - 0.4) add('chyba', `Výpust (Ø ${fmt(2 * o.ro, 1)}) se nevejde do závitu čepičky (Ø ${fmt(2 * o.cap.rMin, 1)} přes vrcholy) – zvětšete mezeru k hrdlu.`, ['hrdlo.mezera', 'hrdlo.vnitrni']);
      if (Hr.vnejsi > 0 && Hr.vnitrni > Hr.vnejsi - 2 * Hr.hloubkaZ - 1) add('varovani', 'Světlost hrdla je skoro stejná jako průměr závitu – zkontrolujte rozměry (světlost = otvor, vnější Ø = přes závit).', ['hrdlo.vnitrni', 'hrdlo.vnejsi']);
      if (Hr.hloubkaZ > 0.45 * Hr.stoupani * 2) add('varovani', 'Hloubka závitu je na toto stoupání velká – boky závitu se slijí.', 'hrdlo.hloubkaZ');
    }
    if (Hr.rezim === 'limec' && !(Hr.vnejsi > Hr.vnitrni)) add('chyba', 'Límec: vnější průměr hrdla musí být větší než světlost.', ['hrdlo.vnejsi', 'hrdlo.vnitrni']);
    if ((Hr.rezim === 'zavit' || Hr.rezim === 'limec') && o.ro > Hr.vnitrni / 2 - 0.3) add('chyba', 'Výpust je širší než otvor hrdla.', 'hrdlo.mezera');
    // výpust
    if (o.ohyb > tk.uhel + 1e-9) add('varovani', `Ohyb výpusti ${fmt(o.ohyb, 0)}° je víc než povolený převis ${fmt(tk.uhel, 0)}° – spodek oblouku bude potřebovat podpory.`, ['vypust.uhel', 'tisk.uhel'], { text: `Ohyb ${fmt(tk.uhel, 0)}°`, pole: 'vypust.uhel', hodnota: tk.uhel });
    if (V.tvar === 'vlnovec' && o.hrot) add('info', 'Vlnovec ohne jen pružný materiál (TPU, PP) nebo tenká stěna – z PETG / PLA je spíš tuhý. Tiskněte výpust zvlášť z TPU (volba Samostatný díl).', ['vypust.tvar', 'vypust.dil']);
    // odvzdušnění
    const O = p.odvz;
    const tesny = ['zasun', 'stupne', 'zavit', 'limec'].includes(Hr.rezim);
    if (O.typ === 'zadne' && tesny) add('varovani', 'Bez odvzdušnění: výpust v hrdle těsní a vzduch z nádoby nemá kudy ven – kapalina bude bublat nebo se úplně zastaví.', 'odvz.typ', { text: 'Přidat drážky', pole: 'odvz.typ', hodnota: 'drazky' });
    if (O.typ === 'drazky' && o.hrot && O.hloubka > V.stena - 0.8 + 1e-9) add('varovani', `Drážky hluboké ${fmt(O.hloubka, 2)} mm nechají ve stěně výpusti méně než 0,8 mm.`, ['odvz.hloubka', 'vypust.stena'], { text: `Hloubka ${fmt(Math.max(0.3, V.stena - 0.8), 2)} mm`, pole: 'odvz.hloubka', hodnota: Math.max(0.3, Math.round((V.stena - 0.8) * 100) / 100) });
    if (O.typ === 'trubicka') {
      if (o.hrot) add(Hr.rezim === 'volne' ? 'info' : 'chyba', Hr.rezim === 'volne' ? 'Volná výpust v hrdle netěsní – trubička není potřeba.' : 'Trubička vede vedle výpusti a zasunutí by netěsnilo – u kónusu použijte drážky nebo žebra.', 'odvz.typ', Hr.rezim === 'volne' ? null : { text: 'Drážky', pole: 'odvz.typ', hodnota: 'drazky' });
      else {
        const tr = trubicka(p, o);
        if (tr.rc + tr.ro > Hr.vnitrni / 2 - 0.3) add('chyba', `Trubička se nevejde do hrdla vedle výpusti – zmenšete její průměr nebo mezeru (potřeba ${fmt(2 * (tr.rc + tr.ro), 1)} mm, hrdlo ${fmt(Hr.vnitrni, 1)} mm).`, ['odvz.trubicka', 'hrdlo.mezera']);
        if (tr.vule < 0.6) add('varovani', 'Kanálek trubičky vede těsně u vnitřku trychtýře – zesilte stěnu výpusti.', ['vypust.stena', 'odvz.trubicka']);
      }
    }
    // dělení, prodloužení, doplňky
    if (p.deleni.zap && o.plochy) add('chyba', 'Dělení na 2 díly jde jen u kulatého těla.', 'deleni.zap', { text: 'Bez dělení', pole: 'deleni.zap', hodnota: false });
    if (p.stupnice.zap && o.plochy) add('info', 'Stupnice se dělá jen v kulatém těle.', 'stupnice.zap');
    if (p.stupnice.zap && !o.plochy && !o.rysky.length) add('varovani', 'Krok stupnice je větší než objem trychtýře – žádná ryska.', 'stupnice.krok');
    if (p.stupnice.zap && o.rysky.length > 30) add('varovani', `${o.rysky.length} rysek je moc – zvětšete krok.`, 'stupnice.krok');
    if (p.stupnice.zap && o.rysky.length) add('info', `Stupnice počítá objem od konce výpusti (zavřené zátkou nebo prstem) – ${o.rysky.length} rysek po ${fmt(p.stupnice.krok)} ml.`, 'stupnice.krok');
    if (p.doplnky.stojanek && o.plochy) add('info', 'Stojánek je jen pro kulaté tělo.', 'doplnky.stojanek');
    if (p.doplnky.stojanek && !o.plochy && (o.vylozeni > p.doplnky.seda * p.telo.prumer / 2 - o.rT - 3 || p.doplnky.seda * o.Rout < o.rT + 4)) add('varovani', 'Výpust se do stojánku nevejde – zvětšete místo sedla (podíl průměru) nebo zmenšete ohyb výpusti.', ['doplnky.seda', 'vypust.uhel']);
    if (!['zasun', 'zavit', 'limec'].includes(Hr.rezim)) { /* kalibrace jen pro lícované spoje */ }
    // médium a materiál
    const m = MEDIA[p.vypocty.medium];
    if (m.palivo && ['ABS', 'ASA'].includes(tk.material)) add('varovani', `${MATERIALY[tk.material].nazev} benzín a nafta naleptávají – na paliva tiskněte z PETG, PP nebo PA.`, 'tisk.material', { text: 'PETG', pole: 'tisk.material', hodnota: 'PETG' });
    else if (m.palivo && tk.material === 'PLA') add('info', 'PLA v palivech časem křehne a bobtná – na častý styk s palivem je lepší PETG, PP nebo PA.', 'tisk.material');
    if (m.sypke) {
      const D = 2 * o.ri;
      if (m.soudrzna) add('info', `${m.nazev[0].toUpperCase() + m.nazev.slice(1)} je soudržná – tvoří klenby a sama nepoteče; pomůže strmý kužel (do ${m.uhel}°), široká výpust a poklepání.`, ['telo.uhel', 'vypust.prumer']);
      else if (D < 6 * m.zrno) add('varovani', `Výpust Ø ${fmt(D, 1)} mm je na ${m.nazev} (zrno ≈ ${fmt(m.zrno, 1)} mm) úzká – pod 6 průměry zrna se zrna zaklíní a tok se zastaví.`, 'vypust.prumer');
      if (o.uhelMax > m.uhel) add('info', `Na ${m.nazev} je kužel ${fmt(o.uhelMax, 0)}° mírný – materiál u stěn zůstane stát (tok jádrem); pro tok celou hmotou do ${m.uhel}°.`, 'telo.uhel');
    }
    return H;
  }

  /* ---------------- trubička odvzdušnění ---------------- */
  function trubicka(p, o) {
    const d = p.odvz.trubicka, ro = d / 2 + 0.8, rc = o.ro + ro - 0.3, s = d, e = s / S2;
    const zc = o.lim ? -o.lim.tl : 0, zh = e + 0.7;
    const Rven = o.cap ? o.cap.Rc : o.lim ? o.lim.Rl : o.ro + 6;
    // vůle kanálku k vnitřku těla ve výšce zh (nejbližší okraj kanálku vs. vnitřní kužel)
    const vn = z => (o.plochy ? o.ri + z * (o.bi - o.ri) / o.Hk : rV(o.Pin, z));
    return { d, ro, rc, s, e, zc, zh, z0: zc - p.odvz.delkaTrubicky, Rven, vule: Math.min(rc - d / 2 - vn(zh), rc - vn(zh + e)) };
  }

  /* ---------------- výpočty proudění ---------------- */
  /** Rychlost výtoku výpustí při spádu Hm (m): Bernoulli se ztrátami (vtok, ohyb, vlnovec, tření – laminárně přesně, turbulentně Swamee–Jain). */
  function vytok(Hm, D, L, nu, K) {
    if (Hm <= 0) return { v: 0, Re: 0 };
    const g = 9.81, ny = nu * 1e-6, b = 32 * ny * L / (D * D);
    let v = (-b + Math.sqrt(b * b + 2 * (1 + K) * g * Hm)) / (1 + K);
    let Re = v * D / ny;
    if (Re > 2300) {
      for (let i = 0; i < 40; i++) {
        Re = Math.max(2300, v * D / ny);
        const f = 0.25 / Math.pow(Math.log10(0.05e-3 / (3.7 * D) + 5.74 / Math.pow(Re, 0.9)), 2);
        v = 0.5 * v + 0.5 * Math.sqrt(2 * g * Hm / (1 + K + f * L / D));
      }
      Re = v * D / ny;
    }
    return { v, Re };
  }
  function vypocty(p, o) {
    if (o.chyba) return null;
    const m = MEDIA[p.vypocty.medium], D = 2 * o.ri / 1000, A = Math.PI * D * D / 4;
    const L = (o.delkaVypusti + (o.dilVypusti ? p.prodlouzeni.dilu * p.prodlouzeni.delka : 0)) / 1000;
    const pokles = (o.pokles + (o.dilVypusti ? p.prodlouzeni.dilu * p.prodlouzeni.delka : 0)) / 1000;
    const zPln = (o.zTop - (o.plochy ? 0 : p.telo.lem)) * p.vypocty.plneni / 100;
    const r = { medium: m, D: D * 1000, L: L * 1000, pokles: pokles * 1000, zPln, objem: o.objem(zPln), objemCelkem: o.objemCelkem };
    if (m.sypke) {
      // Beverloo: W = C ρb √g (D − k d)^2,5, C ≈ 0,58, k ≈ 1,5 – nezávisí na výšce násypu
      const De = D - 1.5 * m.zrno / 1000;
      r.W = De > 0 && !m.soudrzna ? 0.58 * m.rho * Math.sqrt(9.81) * Math.pow(De, 2.5) : 0;
      r.Q = r.W / m.rho * 1000;   // l/s
      r.cas = r.Q > 0 ? r.objem / 1000 / r.Q : Infinity;
      r.zaklineni = D * 1000 < 6 * m.zrno;
      return r;
    }
    const K = 0.15 + 0.25 * o.ohyb / 90 + (o.vlnovec ? 0.08 * p.vypust.vln : 0);
    const Q = z => vytok(z / 1000 + pokles, D, L, m.nu, K).v * A;   // m³/s při hladině z (mm v těle)
    const plny = vytok(zPln / 1000 + pokles, D, L, m.nu, K);
    r.v = plny.v; r.Re = plny.Re; r.rezim = plny.Re < 2300 ? 'laminární' : plny.Re < 4000 ? 'přechodové' : 'turbulentní';
    r.Q = plny.v * A * 1000;                                       // l/s
    r.torricelli = Math.sqrt(2 * 9.81 * (zPln / 1000 + pokles)) * A * 1000;
    // doba vyprázdnění: ∫ A(z)/Q(z) dz od plnění po spodek těla + výpust
    let t = 0;
    const n = 200;
    for (let i = 0; i < n; i++) {
      const z = zPln * (i + 0.5) / n, q = Q(z);
      t += q > 0 ? o.plocha(z) * 1e-6 * (zPln / n / 1000) / q : Infinity;
    }
    const q0 = Q(0);
    t += q0 > 0 ? o.objemVypusti * 1e-6 / q0 : 0;
    r.cas = t;
    // odvzdušnění: vzduch musí ven stejným průtokem – tlak na protlačení vzduchu vs. tlak sloupce kapaliny
    const O = p.odvz, tesny = ['zasun', 'stupne', 'zavit', 'limec'].includes(p.hrdlo.rezim);
    let Av = 0;
    if (O.typ === 'drazky') Av = O.pocet * O.sirka * O.hloubka;
    else if (O.typ === 'zebra') Av = Math.max(0, O.pocet * ((2 * Math.PI * o.prof[0][0]) / O.pocet - O.sirka) * O.hloubka);
    else if (O.typ === 'trubicka') Av = Math.PI * O.trubicka * O.trubicka / 4;
    r.Avzduch = Av;
    r.tesny = tesny;
    r.Qvolny = r.Q;
    if (tesny && Av > 0) {
      // rovnováha: sloupec kapaliny = ztráty kapaliny ve výpusti + tlak na protlačení vzduchu odvzdušněním (K ≈ 1,5)
      const Hm = zPln / 1000 + pokles, Avm = Av * 1e-6;
      const potreba = v => {   // potřebná výška sloupce (m) pro rychlost v ve výpusti
        const Re = v * D / (m.nu * 1e-6);
        const f = Re < 2300 ? 64 / Math.max(Re, 1e-9) : 0.25 / Math.pow(Math.log10(0.05e-3 / (3.7 * D) + 5.74 / Math.pow(Re, 0.9)), 2);
        const va = v * A / Avm;
        return (1 + K + f * L / D) * v * v / (2 * 9.81) + 1.5 * 0.5 * 1.2 * va * va / (m.rho * 9.81);
      };
      let lo = 0, hi = r.v;
      for (let i = 0; i < 60; i++) { const v = (lo + hi) / 2; if (potreba(v) > Hm) hi = v; else lo = v; }
      r.Q = lo * A * 1000;
      r.vVzduch = lo * A / Avm;
      r.omezeni = 1 - r.Q / r.Qvolny;   // o kolik odvzdušnění zpomalí nalévání
      r.cas = r.cas * r.Qvolny / Math.max(r.Q, 1e-9);
    } else if (tesny) r.omezeni = 1;
    return r;
  }

  /* ---------------- stavba ---------------- */
  /** Manifold → síť pro náhled a export. */
  function sit(k, m0, jmeno, nazev, barva, volby = {}) {
    const m = k(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const kusy = m.decompose().map(k);
    return Object.assign({ jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, barva, otocit: false }, volby);
  }
  /** Závitová tyč od z = 0 do delka; vrstvy vytlačení se pootočí právě o jeden vrchol průřezu (žádné falešné převisy),
      oba konce seříznuté kuželem (převzato z adapter_vysavac/jadro.js – zavitTyc). */
  function zavitTyc(w, k, z, delka, N) {
    const { CrossSection: CS } = w, ot = delka / z.p, b = [];
    for (let i = 0; i < N; i++) { const t = i / N, a = 2 * Math.PI * t, r = ZG.profilZavitu(t, z); b.push([r * Math.cos(a), r * Math.sin(a)]); }
    const tyc = k(k(new CS([b], 'NonZero')).extrude(delka, Math.max(1, Math.round(ot * N)), 360 * ot));
    const c = Math.min(1.2 * z.h, delka / 3), R = z.rMaj + 0.3, hc = 1.2 * (c + 0.3);
    return k(tyc.intersect(k(k(new CS([[[0, 0], [z.rMaj - c, 0], [R, hc], [R, delka - hc], [z.rMaj - c, delka], [0, delka]]], 'NonZero')).revolve(N))));
  }

  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p);
    if (o.chyba) throw new Error(o.chyba);
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const rev = (body, n, deg) => k(k(new CS([body], 'NonZero')).revolve(n || segmenty(Math.max(...body.map(q => q[0]))), deg || 360));
    const valec = (r0, r1, z0, z1, n) => k(k(M.cylinder(z1 - z0, r0, r1, n || segmenty(Math.max(r0, r1)))).translate([0, 0, z0]));
    const sjed = a => (a.length === 1 ? a[0] : k(M.union(a)));
    const krabice = (x0, x1, y0, y1, z0, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    /** Výplň 45° nad prstencem poloměru R ve výšce z (kužel s vrcholem nahoře) – rozšíření k výpusti bez převisu při tisku ústím dolů. */
    const vypln45 = (R, z) => rev([[0, z], [R, z], [0, z + R]]);
    const Hr = p.hrdlo, Tl = p.telo, O = p.odvz, N0 = segmenty(o.Rout);

    /* ---- výpust: trasa (lokálně: vršek výpusti z = 0, dolů) ---- */
    const b = rad(o.ohyb), Rb = o.Rb, Lh = o.Lh;
    const bodOblouku = f => [Rb - Rb * Math.cos(f), 0, -Lh - Rb * Math.sin(f)];
    const smerOblouku = f => [Math.sin(f), 0, -Math.cos(f)];
    const E = bodOblouku(b), d = smerOblouku(b), ex = [Math.cos(b), 0, Math.sin(b)];
    /** Rám hrotu: lokální (x, y, s) se s od konce výpusti → výpust (konec v E + Lt·d). */
    const doHrotu = (x, y, s) => { const u = o.Lt - s; return [E[0] + u * d[0] + x * ex[0], E[1] + y, E[2] + u * d[2] + x * ex[2]]; };
    const warpHrot = m => k(m.warp(v => { const q = doHrotu(v[0], v[1], v[2]); v[0] = q[0]; v[1] = q[1]; v[2] = q[2]; }));
    /** Hrot výpusti (lokálně, s od konce): {plne, odeb}; prof = vnější obrys spoje. */
    function hrot(prof, ri, sOdvz) {
      const plne = [], odeb = [];
      const n = segmenty(Math.max(...prof.map(q => q[0])) + 2);
      const zebra = O.typ === 'zebra' && sOdvz;
      const sniz = zebra ? o.sniz : 0;
      const obrys = prof.map(([r, s]) => [r - sniz, s]);
      const sT = prof[prof.length - 1][1];
      const vrsek = [];
      if (o.horniCast) {
        const rT = obrys[obrys.length - 1][0];
        if (rT > o.ro) vrsek.push([o.ro, sT + (rT - o.ro) / o.tgPrechodu]);
        else vrsek.push([o.ro, sT]);
        const top = vrsek[vrsek.length - 1][1];
        vrsek.push([o.ro - 0.02, top + 0.3]);
        plne.push(rev([[0, 0], ...obrys, ...vrsek, [0, top + 0.3]], n));
      } else {
        const rT = obrys[obrys.length - 1][0];
        plne.push(rev([[0, 0], ...obrys, [0, sT + rT]], n));
      }
      odeb.push(valec(ri, ri, -1, o.Lt + (o.horniCast ? 0.8 : 1.2), segmenty(ri)));
      if (sOdvz && (O.typ === 'drazky' || zebra)) {
        // drážky / žebra po úsecích obrysu (obálka dvou kvádrů na koncích úseku)
        const w2 = O.sirka / 2, kusy = [];
        for (let i = 0; i < O.pocet; i++) {
          const fi = 360 * i / O.pocet + 90;
          for (let j = 1; j < prof.length; j++) {
            const [ra, sa] = prof[j - 1], [rb, sb] = prof[j];
            if (sb - sa < 1e-6) continue;
            const s0 = j === 1 ? -1 : sa, s1 = j === prof.length - 1 ? sb + (zebra ? 0 : 0.6) : sb;
            const B = [];
            for (const [r, s] of [[ra, s0], [rb, s1]]) {
              const x0 = zebra ? r - sniz - 0.3 : r - O.hloubka, x1 = zebra ? r : r + 3;
              for (const x of [x0, x1]) for (const y of [-w2, w2]) B.push([x, y, s]);
            }
            kusy.push(k(k(M.hull(B)).rotate([0, 0, fi])));
          }
        }
        if (kusy.length) (zebra ? plne : odeb).push(sjed(kusy));
      }
      return { plne, odeb };
    }
    /** Celá výpust v lokálních souřadnicích (vršek z = 0): {plne, odeb}. */
    function vypust(spigot) {
      const plne = [], odeb = [];
      const n = segmenty(o.ro + 2);
      // horní rovná část a vlnovec (z = 0 … −Lh)
      if (Lh > 0) {
        // vnitřek vedený zdola nahoru: rovně, u vlnovce cik-cak s boky 45°; vnějšek = odsazení o stěnu kolmo
        const vin = [[o.ri, -Lh - 0.3]];
        if (o.vlnovec) {
          const a = p.vypust.vyskaVlny;
          for (let i = 0; i < p.vypust.vln; i++) { vin.push([o.ri, -Lh + 2 * i * a]); vin.push([o.ri + a, -Lh + (2 * i + 1) * a]); }
          vin.push([o.ri, -o.Lp]);
        }
        vin.push([o.ri, 0]);
        for (let i = vin.length - 1; i > 0; i--) if (Math.abs(vin[i][0] - vin[i - 1][0]) + Math.abs(vin[i][1] - vin[i - 1][1]) < 1e-6) vin.splice(i, 1);
        const ven = odsad(vin, o.tv);
        plne.push(rev([[0, -Lh - 0.3], ...ven, ...(spigot ? [[0, 0]] : [[0, o.ro]])], n));
        odeb.push(rev([[0, -Lh - 1], [o.ri, -Lh - 1], ...vin.slice(1), [o.ri, 1], [0, 1]], n));
      }
      // oblouk
      if (o.ohyb > 0) {
        // trubka vytlačená po délce oblouku a ohnutá (warp) – plynulý povrch bez schůdků mezi úseky
        const La = Rb * b, nd = Math.max(4, Math.ceil(o.ohyb / 1.5));
        const ohni = (r, s0, s1) => {
          const kr = []; for (let i = 0; i < n; i++) { const a = 2 * Math.PI * (i + 0.5) / n; kr.push([r * Math.cos(a), r * Math.sin(a)]); }
          const m0 = k(k(k(new CS([kr], 'NonZero')).extrude(s1 - s0, nd)).translate([0, 0, s0]));
          return k(m0.warp(v => { const f = v[2] / Rb, P = bodOblouku(f), x = v[0]; v[0] = P[0] - x * Math.cos(f); v[2] = P[2] - x * Math.sin(f); }));   // −u: pravotočivý rám (jinak převrácená síť)
        };
        plne.push(ohni(o.ro, 0, La)); odeb.push(ohni(o.ri, -0.5, La + 0.5));
        if (Lh <= 0) {   // oblouk přímo pod tělem: kužel 45° nad začátkem
          plne.push(vypln45(o.ro, 0));
          odeb.push(valec(o.ri, o.ri, -0.5, 1, segmenty(o.ri)));
        }
      }
      // hrot
      const H = hrot(o.prof, o.ri, o.hrot);
      for (const x of H.plne) plne.push(warpHrot(x));
      for (const x of H.odeb) odeb.push(warpHrot(x));
      return { plne, odeb };
    }

    /* ---- tělo (z = 0 spodek, ústí nahoře) ---- */
    function telo() {
      const plne = [], odeb = [];
      if (o.plochy) {
        const n = 96, elip = (a, bb, z) => { const out = []; for (let i = 0; i < n; i++) { const f = 2 * Math.PI * (i + 0.5) / n; out.push([a * Math.cos(f), bb * Math.sin(f), z]); } return out; };
        const kruh = (r, z) => elip(r, r, z);
        const rb0 = o.ri + o.t * 1.15;
        plne.push(k(M.hull([...kruh(rb0, 0), ...elip(o.a, o.b, o.Hk)])));
        plne.push(k(M.hull([...elip(o.a, o.b, o.Hk - 0.01), ...elip(o.a, o.b, o.zTop)])));
        odeb.push(k(M.hull([...kruh(o.ri, -0.6), ...kruh(o.ri, 0), ...elip(o.ai, o.bi, o.Hk)])));
        odeb.push(k(M.hull([...elip(o.ai, o.bi, o.Hk - 0.01), ...elip(o.ai, o.bi, o.zTop + 1)])));
        if (Tl.okraj > 0) plne.push(k(M.hull([...elip(o.a + Tl.okraj, o.b + Tl.okraj, o.zTop - o.hOkraj), ...elip(o.a + Tl.okraj, o.b + Tl.okraj, o.zTop)])));
      } else {
        plne.push(rev([...o.Pout, [0, o.zTop], [0, 0]].reverse(), N0));
        odeb.push(rev([[0, -0.6], [o.ri, -0.6], ...o.Pin.slice(0, -1), [o.Pin[o.Pin.length - 1][0], o.zTop + 1], [0, o.zTop + 1]], N0));
        if (Tl.okraj > 0) plne.push(valec(o.Rokraj, o.Rokraj, o.zTop - o.hOkraj, o.zTop, segmenty(o.Rokraj)));
        // rysky stupnice: V drážka 45° v úseku oblouku (dlouhá 40°, krátká 20°) na straně +Y
        for (const r of o.rysky) {
          const rr = rV(o.Pin, r.z), dd = 0.5, u = r.dlouha ? 40 : 20;
          const tr = rev([[rr - 0.3, r.z - dd - 0.3], [rr + dd, r.z], [rr - 0.3, r.z + dd + 0.3]], N0, u);
          odeb.push(k(tr.rotate([0, 0, 90 - u / 2])));
        }
      }
      if (o.ucho) {
        const u = o.ucho, z0 = o.zTop - u.tl, rIn = o.plochy ? o.a - 1 : o.Rout - 1;
        const kr = (x, r, z) => { const out = []; for (let i = 0; i < 32; i++) { const a = 2 * Math.PI * i / 32; out.push([x + r * Math.cos(a), r * Math.sin(a), z]); } return out; };
        plne.push(k(M.hull([...kr(u.x, u.r, z0), ...kr(u.x, u.r, o.zTop), ...kr(rIn, u.r, z0), ...kr(rIn, u.r, o.zTop)])));
        odeb.push(k(k(M.cylinder(u.tl + 2, u.d / 2, u.d / 2, 32)).translate([u.x, 0, z0 - 1])));
      }
      return { plne, odeb };
    }

    /** Hrdlo (zásuvka) zavěšené pod zTop pro výpust / prodloužení: {plne, odeb}, dalsi = kam sahá zasunutý konec. */
    function zasuvka(zTop) {
      const ri = o.ri, ro = o.ro, rs = ro + o.vs, Ro = rs + o.tv, c = Math.max(0.2, rs - ri), Ls = o.Lspoj;
      const plne = [rev([[0, zTop - c - Ls], [Ro, zTop - c - Ls], [Ro, zTop - c], [0, zTop - c + Ro]])];
      const odeb = [rev([[0, zTop - c - Ls - 1], [rs, zTop - c - Ls - 1], [rs, zTop - c], [ri, zTop], [ri, zTop + 1], [0, zTop + 1]])];
      return { plne, odeb, dalsi: zTop - c };
    }

    try {
      const tisk = [], sestava = [], kalibrace = [];
      const BARVY = { telo: '#2F6FC2', vypust: '#E08A2E', prodl: '#3FA36B', dopl: '#8C6BC8', kal: '#C2544F' };
      /* ---- tělo + výpust (nebo zásuvka) + spoj s hrdlem ---- */
      const T = telo();
      let A = sjed(T.plne);
      const odeb = T.odeb.slice();
      const bezRozboru = [];
      let dalsi = 0;
      if (o.dilVypusti) {
        const Z = zasuvka(0);
        A = k(M.union([A, ...Z.plne])); odeb.push(...Z.odeb); dalsi = Z.dalsi;
      } else if (o.cap) {
        // čepička se závitem: plný válec, odečíst otvor a závit, pak přidat výpust
        const c = o.cap;
        A = k(M.union([A, rev([[0, -c.Lz], [c.Rc, -c.Lz], [c.Rc, 0], [0, c.Rc]])]));
        const nz = Math.max(48, Math.min(160, Math.ceil(2 * Math.PI * c.rMaj / 0.9 / 4) * 4));
        const tyc = k(zavitTyc(w, k, { p: c.p, h: c.h, bok: 30, rMaj: c.rMaj }, c.Lz + 0.6 - 0.4, nz).translate([0, 0, -c.Lz - 0.6]));
        const vstup = rev([[0, -c.Lz - 0.01], [c.rMaj + 0.5, -c.Lz - 0.01], [c.rMin, -c.Lz + c.h + 0.5], [0, -c.Lz + c.h + 0.5]]);
        const odebC = [valec(c.rMin, c.rMin, -c.Lz - 1, 0), tyc, vstup];
        if (O.typ === 'drazky') {
          for (let i = 0; i < O.pocet; i++) {
            const fi = 360 * i / O.pocet + 90, w2 = O.sirka / 2;
            odebC.push(k(krabice(o.ro + 0.3, c.rMaj + 0.3, -w2, w2, -0.5, O.hloubka).rotate([0, 0, fi])));          // přes čelo hrdla
            odebC.push(k(krabice(c.rMin - 0.3, c.rMaj + O.hloubka, -w2, w2, -c.Lz - 1, O.hloubka).rotate([0, 0, fi])));   // podél závitu ven
          }
        }
        A = k(A.subtract(sjed(odebC)));
        bezRozboru.push({ r0: c.rMin - 0.6, r1: c.rMaj + 0.6, z0: -c.Lz - 0.1, z1: 0.1 });
      } else if (o.lim) {
        const L = o.lim;
        A = k(M.union([A, rev([[0, -L.tl], [L.Rl, -L.tl], [L.Rl, 0], [0, L.Rl]]), ...(L.hs > 0 ? [rev([[L.rsi, -L.tl - L.hs], [L.rso, -L.tl - L.hs], [L.rso, -L.tl + 0.3], [L.rsi, -L.tl + 0.3]])] : [])]));
        if (O.typ === 'drazky') {
          for (let i = 0; i < O.pocet; i++) {
            const fi = 360 * i / O.pocet + 90, w2 = O.sirka / 2;
            odeb.push(k(krabice(o.ro + 0.3, Math.max(L.Rl, L.rso) + 1, -w2, w2, -L.tl - L.hs - 1, -L.tl + O.hloubka).rotate([0, 0, fi])));
          }
        }
      }
      if (!o.dilVypusti) {
        // výpust přímo pod tělem (u límce pod límcem)
        const zV = o.lim ? -o.lim.tl : 0, V = vypust(false);
        const posun = m => k(m.translate([0, 0, zV]));
        A = k(M.union([A, ...V.plne.map(posun)]));
        odeb.push(...V.odeb.map(posun));
        if (o.lim) odeb.push(valec(o.ri, o.ri, zV - 0.5, 0.5, segmenty(o.ri)));
      }
      if (O.typ === 'trubicka' && !o.hrot) {
        const tr = trubicka(p, o);
        A = k(M.union([A, k(k(M.cylinder(tr.zc + 0.5 - tr.z0, tr.ro, tr.ro, 24)).translate([tr.rc, 0, tr.z0]))]));
        odeb.push(k(k(M.cylinder(tr.zh - tr.z0 + 1, tr.d / 2, tr.d / 2, 24)).translate([tr.rc, 0, tr.z0 - 1])));
        odeb.push(k(k(k(M.cube([tr.Rven + 3 - tr.rc, tr.s, tr.s])).translate([0, -tr.s / 2, -tr.s / 2])).rotate([45, 0, 0])).translate([tr.rc, 0, tr.zh]));
      }
      const nadUstim = krabice(-1e4, 1e4, -1e4, 1e4, o.zTop, 1e4);   // výplně 45° nesmí vyčnívat nad ústí
      const zaklad = k(k(A.subtract(sjed(odeb))).subtract(nadUstim));
      // dělení těla na 2 díly
      let dilyTela;
      if (o.del) {
        const D = o.del, Rv = o.Rokraj + 40, nz = Math.max(48, Math.min(200, Math.ceil(2 * Math.PI * D.Rj / 0.9 / 4) * 4));
        const vnitrek = rev([[0, -1], [o.ri, -1], ...o.Pin.slice(0, -1), [o.Pin[o.Pin.length - 1][0], o.zTop + 1], [0, o.zTop + 1]], N0);
        const spodni0 = k(zaklad.intersect(krabice(-Rv, Rv, -Rv, Rv, -1000, D.zs)));
        const samec = k(M.union([valec(D.Rj - D.h, D.Rj - D.h, D.zs - 0.3, D.zs + D.Lj, nz), k(zavitTyc(w, k, { p: D.p, h: D.h, bok: 30, rMaj: D.Rj }, D.Lj, nz).translate([0, 0, D.zs]))]));
        const spodni = k(k(M.union([spodni0, samec])).subtract(vnitrek));
        const horni0 = k(zaklad.intersect(krabice(-Rv, Rv, -Rv, Rv, D.zs + D.Lj, 1000)));
        const plast = rev([[0, D.zs], [D.Rf, D.zs], [D.Rf, D.zs + D.Lj], [0, D.zs + D.Lj + D.Rf]], nz);
        const zavitF = k(zavitTyc(w, k, { p: D.p, h: D.h, bok: 30, rMaj: D.Rj + D.v }, D.Lj + 1.2, nz).translate([0, 0, D.zs - 0.6]));
        const horniPlast = k(k(plast.subtract(k(M.union([valec(D.Rj + D.v - D.h, D.Rj + D.v - D.h, D.zs - 1, D.zs + D.Lj, nz), zavitF])))).subtract(vnitrek));
        const horni = k(k(k(M.union([horni0, horniPlast])).subtract(k(krabice(-Rv, Rv, -Rv, Rv, -1000, D.zs)))).subtract(nadUstim));
        dilyTela = [sit(k, horni, 'telo_horni', 'Tělo – horní díl', BARVY.telo, { otocit: true, bezRozboru: [{ r0: D.Rj + D.v - D.h - 0.6, r1: D.Rj + D.v + 0.6, z0: D.zs - 0.1, z1: D.zs + D.Lj + 0.1 }] }),
          sit(k, spodni, 'telo_spodni', 'Tělo – spodní díl s výpustí', '#3E86D6', { otocit: true, bezRozboru: bezRozboru.concat([{ r0: D.Rj - D.h - 0.6, r1: D.Rj + 0.6, z0: D.zs - 0.1, z1: D.zs + D.Lj + 0.1 }]) })];
      } else dilyTela = [sit(k, zaklad, 'trychtyr', o.dilVypusti ? 'Tělo trychtýře' : 'Trychtýř', BARVY.telo, { otocit: true, bezRozboru })];
      tisk.push(...dilyTela);
      sestava.push(...dilyTela);

      /* ---- prodloužení a samostatná výpust ---- */
      if (o.dilVypusti) {
        let zOff = dalsi;
        const Le = p.prodlouzeni.delka;
        for (let i = 0; i < p.prodlouzeni.dilu; i++) {
          const Z = zasuvka(-Le);
          const tr = k(k(M.union([rev([[0, -Le - 0.3], [o.ro, -Le - 0.3], [o.ro, 0], [0, 0]]), ...Z.plne])).subtract(k(M.union([valec(o.ri, o.ri, -Le - 1, 1), ...Z.odeb]))));
          const d1 = sit(k, tr, 'prodlouzeni' + (i + 1), `Prodloužení ${i + 1}`, BARVY.prodl);
          tisk.push(d1);
          sestava.push(Object.assign({}, d1, { poz: posunPoz(d1.poz, 0, 0, zOff) }));
          zOff += Z.dalsi;
        }
        const V = vypust(true);
        const vm = k(k(M.union(V.plne)).subtract(sjed(V.odeb)));
        const dv = sit(k, vm, 'vypust', 'Výpust', BARVY.vypust, { otocit: true });
        tisk.push(dv);
        sestava.push(Object.assign({}, dv, { poz: posunPoz(dv.poz, 0, 0, zOff) }));
        o.zKonec = zOff;
      }

      /* ---- doplňky ---- */
      const Dp = p.doplnky;
      if (Dp.vicko) {
        const tl = 2, sk = 6, v = 0.4;
        let vm;
        if (o.plochy) {
          const n = 96, elip = (a, bb, z) => { const out = []; for (let i = 0; i < n; i++) { const f = 2 * Math.PI * (i + 0.5) / n; out.push([a * Math.cos(f), bb * Math.sin(f), z]); } return out; };
          const ra = o.a + Tl.okraj + v, rb = o.b + Tl.okraj + v;
          const ven = k(M.hull([...elip(ra + 1.6, rb + 1.6, -sk), ...elip(ra + 1.6, rb + 1.6, tl)]));
          vm = k(ven.subtract(k(M.hull([...elip(ra, rb, -sk - 1), ...elip(ra, rb, 0)]))));
        } else {
          const R = o.Rokraj + v;
          vm = rev([[0, 0], [R, 0], [R, -sk], [R + 1.6, -sk], [R + 1.6, tl], [0, tl]]);
        }
        const xj = o.plochy ? o.a + Tl.okraj + v + 1.6 : o.Rokraj + v + 1.6;
        vm = k(M.union([vm, krabice(xj - 0.5, xj + 8, -6, 6, tl - 1.6, tl)]));
        if (o.ucho) vm = k(vm.rotate([0, 0, 180]));
        const dv = sit(k, vm, 'vicko', 'Víčko ústí', BARVY.dopl, { otocit: true });
        tisk.push(dv);
        sestava.push(Object.assign({}, dv, { poz: posunPoz(dv.poz, 0, 0, o.zTop + 12) }));
      }
      if (Dp.zatka) {
        const r = o.ri - 0.05, Lz = Math.min(10, o.Ltip), hl = 2.5, Rh = o.prof[0][0] + 2;
        const zm = k(M.union([rev([[0, 0], [Rh, 0], [Rh, hl], [r, hl], [r, hl + Lz - 0.8], [r - 0.8, hl + Lz], [0, hl + Lz]]), krabice(Rh - 1, Rh + 6, -4, 4, 0, 1.6)]));
        const dz = sit(k, zm, 'zatka', 'Zátka výpusti', BARVY.dopl);
        tisk.push(dz);
        // v sestavě pod koncem výpusti (jen u rovné výpusti přesně)
        const kon = konecVypusti(o);
        sestava.push(Object.assign({}, dz, { poz: posunPoz(dz.poz, kon[0], 0, kon[2] - hl - 8) }));
      }
      if (Dp.stojanek && !o.plochy) {
        const Rs = Dp.seda * (o.Rout), zs = Math.max(0, Math.min(o.Hk, rozZ(o.Pout, Rs)));
        const Rsedla = rV(o.Pout, zs) + 0.4;
        const hl = o.pokles + (o.dilVypusti ? p.prodlouzeni.dilu * p.prodlouzeni.delka : 0) + zs + 6, sten = 2.2, dno = 2;
        const tg = Math.tan(rad(p.telo.tvar === 'dvoj' && zs < (o.Pin[1] ? o.Pin[1][1] : 0) ? p.telo.uhel2 : p.telo.uhel));
        const c = Math.min(8, hl / 3), Rin2 = Math.min(Rsedla - 0.5, Math.max(Rsedla - c * tg, o.rT + 2));
        const Rb2 = Rsedla + sten, Rpat = Rb2 + 10;
        const prof = [[0, 0], [Rpat, 0], [Rpat, 2], [Rb2 + 0.01, 2 + Math.min(10, Rpat - Rb2)], [Rb2, hl + dno], [Rsedla, hl + dno], [Rin2, hl + dno - c], [Rin2, dno], [0, dno]];
        const sm = rev(prof);
        const ds = sit(k, sm, 'stojanek', 'Stojánek s odkapem', BARVY.dopl);
        tisk.push(ds);
        sestava.push(Object.assign({}, ds, { poz: posunPoz(ds.poz, o.Rokraj * 2 + Rpat + 20, 0, -hl - dno + zs) }));
      }

      /* ---- kalibrační vzorky spoje ---- */
      if (volby.kalibrace && ['zasun', 'zavit', 'limec'].includes(o.rezim)) {
        const kal = p.kalibrace;
        for (let i = 0; i < kal.kusu; i++) {
          const q = kopie(p);
          q.hrdlo.vule = p.hrdlo.vule + (i - (kal.kusu - 1) / 2) * kal.krok;
          Object.assign(q.vypust, { tvar: 'rovna', dil: false });
          q.prodlouzeni.dilu = 0;
          q.odvz.typ = o.rezim === 'zavit' ? 'zadne' : q.odvz.typ === 'trubicka' ? 'zadne' : q.odvz.typ;
          if (o.rezim === 'zasun') q.vypust.delka = q.hrdlo.hloubka + 5;
          else q.vypust.delka = 3;
          const ok = odvozene(q);
          const plne = [], odebK = [];
          const R0 = o.rezim === 'zavit' ? ok.cap.Rc : o.rezim === 'limec' ? Math.max(ok.lim.Rl, ok.lim.rso) : ok.rT;
          const Rf = R0 + 3;
          plne.push(valec(Rf, Rf, 0, 2));
          if (o.rezim === 'zavit') {
            const c = ok.cap, nz = Math.max(48, Math.min(160, Math.ceil(2 * Math.PI * c.rMaj / 0.9 / 4) * 4));
            plne.push(valec(c.Rc, c.Rc, -c.Lz, 0.5));
            odebK.push(valec(c.rMin, c.rMin, -c.Lz - 1, 0), k(zavitTyc(w, k, { p: c.p, h: c.h, bok: 30, rMaj: c.rMaj }, c.Lz + 0.2, nz).translate([0, 0, -c.Lz - 0.6])),
              rev([[0, -c.Lz - 0.01], [c.rMaj + 0.5, -c.Lz - 0.01], [c.rMin, -c.Lz + c.h + 0.5], [0, -c.Lz + c.h + 0.5]]));
            odebK.push(valec(Math.max(1, c.rMin - 4), Math.max(1, c.rMin - 4), -1, 3));
          } else if (o.rezim === 'limec') {
            const L = ok.lim;
            plne.push(valec(L.Rl, L.Rl, -L.tl, 0.5));
            if (L.hs > 0) plne.push(rev([[L.rsi, -L.tl - L.hs], [L.rso, -L.tl - L.hs], [L.rso, -L.tl + 0.3], [L.rsi, -L.tl + 0.3]]));
            plne.push(rev([[ok.ri, -L.tl - 3], [ok.ro, -L.tl - 3], [ok.ro, 0], [ok.ri, 0]]));
            odebK.push(valec(ok.ri, ok.ri, -L.tl - 4, 3));
          } else {
            // kónus s přírubou nahoře (hrot dole), bez drážek
            const L = ok.Ltip;
            plne.push(rev([[0, -L], ...ok.prof.map(([r, s]) => [r, s - L]), [0, 0.5]]));
            odebK.push(valec(ok.ri, ok.ri, -L - 2, 3));
          }
          // zářezy na obvodu příruby = číslo vzorku
          for (let j = 0; j <= i; j++) odebK.push(k(krabice(Rf - 1.2, Rf + 1, -0.6, 0.6, -0.1, 2.1).rotate([0, 0, j * 12])));
          const km = k(k(M.union(plne)).subtract(sjed(odebK)));
          kalibrace.push(sit(k, km, 'kalibrace' + (i + 1), `Vzorek ${i + 1} – vůle ${fmt(q.hrdlo.vule, 2)}`, BARVY.kal, { otocit: true, vule: q.hrdlo.vule,
            bezRozboru: o.rezim === 'zavit' ? [{ r0: ok.cap.rMin - 0.6, r1: ok.cap.rMaj + 0.6, z0: -ok.cap.Lz - 0.1, z1: 0.1 }] : [] }));
        }
      }
      return { tisk, sestava, kalibrace, o, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  /** Výška, ve které má lomená čára (r rostoucí se z) poloměr R. */
  function rozZ(P, R) {
    for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; if (R <= b[0] + 1e-9 && b[0] > a[0]) return a[1] + (b[1] - a[1]) * Math.max(0, (R - a[0])) / (b[0] - a[0]); }
    return P[P.length - 1][1];
  }
  function posunPoz(P, x, y, z) {
    const out = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) { out[i] = P[i] + x; out[i + 1] = P[i + 1] + y; out[i + 2] = P[i + 2] + z; }
    return out;
  }
  /** Konec výpusti (střed ústí) v souřadnicích sestavy. */
  function konecVypusti(o) {
    const b = rad(o.ohyb), z0 = o.dilVypusti ? (o.zKonec || 0) : o.lim ? -o.lim.tl : 0;
    return [o.Rb * (1 - Math.cos(b)) + o.Lt * Math.sin(b), 0, z0 - o.Lh - o.Rb * Math.sin(b) - o.Lt * Math.cos(b)];
  }

  /** Rozbor převisů v tiskové poloze bez zón závitu (boky závitu 60° se tisknou běžně). */
  function rozborDilu(d, uhel) {
    if (!d.bezRozboru || !d.bezRozboru.length) return G.rozborTisku(d.otocit ? otoc(d) : d, uhel);
    const P = d.poz, I = d.idx, J = [];
    for (let t = 0; t < I.length; t += 3) {
      let x = 0, y = 0, z = 0;
      for (let j = 0; j < 3; j++) { x += P[3 * I[t + j]]; y += P[3 * I[t + j] + 1]; z += P[3 * I[t + j] + 2]; }
      x /= 3; y /= 3; z /= 3;
      const r = Math.hypot(x, y);
      if (d.bezRozboru.some(q => r >= q.r0 && r <= q.r1 && z >= q.z0 && z <= q.z1)) continue;
      J.push(I[t], I[t + 1], I[t + 2]);
    }
    const e = Object.assign({}, d, { idx: new Uint32Array(J) });
    return G.rozborTisku(d.otocit ? otoc(e) : e, uhel);
  }
  function otoc(d) {
    const P = new Float32Array(d.poz.length);
    for (let i = 0; i < P.length; i += 3) { P[i] = d.poz[i]; P[i + 1] = -d.poz[i + 1]; P[i + 2] = -d.poz[i + 2]; }
    // podložka = nejnižší bod celého dílu (i když jsou trojúhelníky závitu vynechané)
    return Object.assign({}, d, { poz: P });
  }
  function kontrolyModelu(p, model) {
    const H = [];
    for (const d of model.tisk.concat(model.kalibrace)) {
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      const r = rozborDilu(d, p.tisk.uhel);
      if (r.previs > 5) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v místě převisu může potřebovat podpory.` });
      if (r.most > 2) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu.` });
    }
    const o = model.o;
    if (o.dilVypusti || o.del) H.push({ uroven: 'info', pole: null, text: `Díly se spojí ${o.del ? 'závitem (horní díl tělo našroubovat na spodní)' : ''}${o.del && o.dilVypusti ? ' a ' : ''}${o.dilVypusti ? `zasunutím ${fmt(o.Lspoj)} mm s vůlí ${fmt(o.vs, 2)} mm (natěsno, případně kapka lepidla)` : ''}.` });
    return H;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const T = p.telo, Hr = p.hrdlo;
    const tvar = T.tvar === 'plochy' ? `plochý ${fmt(T.sirka)} × ${fmt(T.hloubkaO)}` : `${NAZVY.tvar[T.tvar]} Ø ${fmt(T.prumer)}`;
    const x = najdiHrdlo(Hr.zdroj);
    return `${tvar} · ${NAZVY.rezim[Hr.rezim]}${x ? ' · ' + x.nazev : ''}`;
  }
  const TYP = 'trychtyre';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Trychtýře');

  const API = {
    DATUM, POZNAMKA, HRDLA, MATERIALY, MEDIA, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    normalizuj, predvolba, hrdloZDb, zdrojHrdla, najdiHrdlo, odvozene, kontroly, vypocty, vytok, trubicka, postav, kontrolyModelu, rozborDilu,
    konecVypusti, odsad, rV, popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt, segmenty,
  };
  if (uzel) module.exports = API; else window.TRYCH = API;
})();
