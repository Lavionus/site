/* Dózy a víčka se závitem – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Druhy dílu:
   • doza   – válcová dóza (plášť hladký / mnohoúhelník / vroubky) s vnějším závitem a víčko s vnitřním závitem;
              zadání vnitřním průměrem a výškou, nebo objemem (dopočet výšky / průměru);
   • vicko  – jen víčko na existující hrdlo (databáze HRDLA nebo vlastní rozměr), hrdlo je v náhledu jako kontext;
   • hrdlo  – nátrubek s vnějším závitem a přírubou (k přilepení, základ vlastní nádoby);
   • zatka  – zátka s vnějším závitem a hlavou;
   • vzorek – kalibrační kroužek(y) s vnitřním závitem + čep (sada 3 vůlí, číslo kroužku = počet zářezů).

   Závit: pravý, 1–6 chodů, profil lichoběžník. Profil se popisuje na VNĚJŠÍM závitu se špičkou nahoru:
   spodní bok = nosný (úhel `bok` od kolmice k ose; při tisku je to převis, proto 45°), horní bok = volný.
   Souměrný profil (vlastní dóza): oba boky stejné, hřbet = dno. Profil podle cizího hrdla: hřbet = změřená šířka
   hřbetu závitu hrdla, volný bok 20°, hloubka omezená tak, aby zub protikusu měl aspoň ZUB_MIN.
   Vůle se přičítá jen k vnitřnímu závitu (víčko, kroužek): poloměr + vůle, boky osově tak, aby kolmá mezera
   byla aspoň 0,7 × vůle. Vnější závit má jmenovitý rozměr.
   Závitová tyč = zkroucený výtah příčného řezu; každá vrstva se pootočí právě o jeden vrchol (trojúhelníky sledují
   šroubovici – boky nehlásí falešné převisy). Vnější i vnitřní závit se staví ze stejného počátku a se stejným
   počtem úseček, takže plochy leží přesně proti sobě (při vůli 0 se dotýkají, průnik = 0).

   Díly se staví v montážní poloze (osa z, dóza dnem dolů); d.otocit = tiskne se vzhůru nohama (víčko, kroužek).
   Každý díl: {jmeno, nazev, poz, idx, objem, teles, barva, otocit, ks, posun?: [x,y,z] v sestavě, rozpad?: zdvih v rozloženém pohledu}. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const LJ = uzel ? require('../loziska/jadro.js') : window.LoziskaJadro;   // katalog O-kroužků
  const fmt = G.fmt, kopie = G.kopie;
  const rad = s => s * Math.PI / 180;
  const AKTUALIZACE = '11/2026';
  const OVERIT = 'typické – ověřit měřením';

  /* ---------------- tabulky ---------------- */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27 }, PLA: { nazev: 'PLA', hustota: 1.24 }, ASA: { nazev: 'ASA', hustota: 1.07 },
    ABS: { nazev: 'ABS', hustota: 1.04 }, PP: { nazev: 'PP', hustota: 0.9 }, PA: { nazev: 'PA (nylon)', hustota: 1.14 },
  };
  /** Hrdla se závitem – NEOVĚŘENO normou: d (vnější Ø závitu), p (stoupání) a otvor jsou z tabulek prodejců a sekundárních
      zdrojů (stav 11/2026), h = (d − Ø jádra) / 2; vrchol (šířka hřbetu závitu) a vyska (výška závitové části od okraje)
      jsou ODHAD. Vždy ověřit posuvkou a kalibračním kroužkem. */
  const HRDLA = [
    { id: 'pco1881', nazev: 'PET láhev PCO 1881 (28 mm, nízké hrdlo)', d: 27.4, p: 2.7, chodu: 1, h: 1.2, vrchol: 1.2, vyska: 9, otvor: 21.7 },
    { id: 'pco1810', nazev: 'PET láhev PCO 1810 (28 mm, vyšší hrdlo)', d: 27.43, p: 3.18, chodu: 1, h: 1.45, vrchol: 1.3, vyska: 11, otvor: 21.7 },
    { id: 'gl45', nazev: 'Laboratorní láhev GL 45 (DIN 168)', d: 45, p: 4, chodu: 1, h: 1.35, vrchol: 1.6, vyska: 13, otvor: 30 },
    { id: 'gl32', nazev: 'Laboratorní láhev GL 32 (DIN 168)', d: 32, p: 4, chodu: 1, h: 1.35, vrchol: 1.6, vyska: 11, otvor: 20 },
    { id: 'din45', nazev: 'Kanystr DIN 45', d: 44.6, p: 4, chodu: 1, h: 1.8, vrchol: 1.6, vyska: 12, otvor: 35 },
    { id: 'din51', nazev: 'Kanystr DIN 51', d: 54.8, p: 5, chodu: 1, h: 2.3, vrchol: 2, vyska: 14, otvor: 44 },
    { id: 'din61', nazev: 'Kanystr DIN 61 (S60×6)', d: 60.5, p: 6, chodu: 1, h: 2.45, vrchol: 2.4, vyska: 16, otvor: 49 },
    { id: 'din71', nazev: 'Kanystr DIN 71', d: 71, p: 6, chodu: 1, h: 1.75, vrchol: 2.4, vyska: 16, otvor: 58 },
  ];
  const BOK_VOLNY = 20;     // volný (nenosný) bok profilu podle cizího hrdla (°)
  const ZUB_MIN = 0.4;      // nejmenší šířka dna profilu = hřbet zubu protikusu (mm)
  const VROUBEK = 1;        // hloubka vroubků pláště a víčka (mm)
  const MEZERA = 1;         // mezera mezi okrajem víčka a pláštěm dózy (mm)
  const STLACENI = 0.2;     // stlačení plochého těsnění (podíl tloušťky)
  const SRAZENI = 0.6;      // sražení hran na podložce (mm)

  const NAZVY = {
    druh: { doza: 'dóza s víčkem', vicko: 'víčko na hrdlo', hrdlo: 'hrdlo se závitem', zatka: 'zátka', vzorek: 'kalibrační vzorek závitu' },
    zadani: { rozmery: 'průměr a výška', objem: 'objem' },
    dopocet: { vyska: 'dopočítat výšku', prumer: 'dopočítat průměr' },
    plast: { valec: 'hladký válec', hran: 'mnohoúhelník', vroubky: 'vroubky' },
    uchop: { vroubky: 'vroubky', hrany: 'mnohoúhelník', hladky: 'hladké' },
    tesneni: { zadne: 'bez těsnění', ploche: 'ploché těsnění', oring: 'O-kroužek v drážce' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Dóza 250 ml', druh: 'doza',
    doza: { zadani: 'rozmery', prumer: 70, vyska: 65, objem: 250, dopocet: 'vyska', stena: 2, dno: 2, plast: 'valec', hran: 8, vroubku: 24 },
    zavit: { rozmer: 'doza', d: 40, p: 4, chodu: 2, h: 1.2, vrchol: 0, bok: 45, vyska: 12, otvor: 30, vule: 0.3, nabeh: 1 },
    vicko: { stena: 2, dno: 2, uchop: 'vroubky', vroubku: 36, hran: 8, tesneni: 'zadne', oring: 2, tlTesneni: 1.5 },
    hrdlo: { priruba: 8, tPriruby: 2.4, odsazeni: 3 },
    zatka: { hlava: 4, presah: 4, duta: true, stena: 2 },
    vzorek: { sada: true, krok: 0.1 },
    tisk: { material: 'PETG', vrstva: 0.2, tryska: 0.4, uhel: 45, podlozkaX: 220, podlozkaY: 220 },
    mech: { mu: 0.25 },
  };
  const MEZE = {
    'doza.prumer': [10, 300], 'doza.vyska': [8, 400], 'doza.objem': [2, 20000], 'doza.stena': [0.8, 10], 'doza.dno': [0.6, 10],
    'doza.hran': [3, 24, 1], 'doza.vroubku': [6, 120, 1],
    'zavit.d': [8, 320], 'zavit.p': [1, 12], 'zavit.chodu': [1, 6, 1], 'zavit.h': [0.4, 5], 'zavit.vrchol': [0, 8], 'zavit.bok': [20, 60],
    'zavit.vyska': [3, 80], 'zavit.otvor': [0, 300], 'zavit.vule': [0, 1.5], 'zavit.nabeh': [0, 4],
    'vicko.stena': [0.8, 10], 'vicko.dno': [0.6, 10], 'vicko.vroubku': [6, 120, 1], 'vicko.hran': [3, 24, 1], 'vicko.oring': [1, 5], 'vicko.tlTesneni': [0.5, 2.5],
    'hrdlo.priruba': [0, 60], 'hrdlo.tPriruby': [0.8, 10], 'hrdlo.odsazeni': [0, 60],
    'zatka.hlava': [1.5, 20], 'zatka.presah': [0.5, 30], 'zatka.stena': [0.8, 10],
    'vzorek.krok': [0.02, 0.3],
    'tisk.vrstva': [0.05, 0.5], 'tisk.tryska': [0.2, 1.2], 'tisk.uhel': [20, 75], 'tisk.podlozkaX': [60, 1000], 'tisk.podlozkaY': [60, 1000],
    'mech.mu': [0.05, 0.8],
  };
  const VYCTY = {
    druh: Object.keys(NAZVY.druh), 'doza.zadani': Object.keys(NAZVY.zadani), 'doza.dopocet': Object.keys(NAZVY.dopocet), 'doza.plast': Object.keys(NAZVY.plast),
    'zavit.rozmer': ['doza', 'vlastni'].concat(HRDLA.map(x => x.id)),
    'vicko.uchop': Object.keys(NAZVY.uchop), 'vicko.tesneni': Object.keys(NAZVY.tesneni), 'tisk.material': Object.keys(MATERIALY),
  };

  /** Předvolby (skupina = druh) – jen odchylky od výchozího projektu; tisk a výpočty zůstávají uživatelovy. */
  const PREDVOLBY = [
    { id: 'doza250', skupina: 'Dóza s víčkem', nazev: 'Dóza 250 ml – dvouchodý závit', popis: 'Ø 70 × 65 mm uvnitř, zavření na 1 otáčku, vroubkované víčko', p: {} },
    { id: 'doza500', skupina: 'Dóza s víčkem', nazev: 'Dóza 500 ml podle objemu', popis: 'vnitřní Ø 90, výška se dopočítá, ploché těsnění', p: { nazev: 'Dóza 500 ml', doza: { zadani: 'objem', objem: 500, prumer: 90, dopocet: 'vyska' }, zavit: { vyska: 14 }, vicko: { tesneni: 'ploche' } } },
    { id: 'dozaRychla', skupina: 'Dóza s víčkem', nazev: 'Rychlouzávěr – 4 chody', popis: 'Ø 60 × 40, stoupání 4 × 4 mm, osmihran, zavření na třetinu otáčky', p: { nazev: 'Dóza s rychlouzávěrem', doza: { prumer: 60, vyska: 40, plast: 'hran' }, zavit: { chodu: 4, vyska: 8 }, vicko: { uchop: 'hrany' } } },
    { id: 'dozaMala', skupina: 'Dóza s víčkem', nazev: 'Kelímek 30 ml (mast, koření)', popis: 'Ø 40 × 24, jemný jednochodý závit 2,5 mm', p: { nazev: 'Kelímek 30 ml', doza: { prumer: 40, vyska: 24, stena: 1.6, dno: 1.6 }, zavit: { p: 2.5, chodu: 1, h: 0.8, vyska: 8 }, vicko: { stena: 1.6, dno: 1.6, vroubku: 30 } } },
    { id: 'dozaTesna', skupina: 'Dóza s víčkem', nazev: 'Těsná dóza s O-kroužkem', popis: 'Ø 78 × 60, stěna 4 mm, O-kroužek 80 × 2 v drážce víčka', p: { nazev: 'Těsná dóza', doza: { prumer: 78, vyska: 60, stena: 4, plast: 'vroubky' }, zavit: { chodu: 1, vyska: 14 }, vicko: { tesneni: 'oring', oring: 2, dno: 3 } } },
    { id: 'vickoPet', skupina: 'Víčko na existující hrdlo', nazev: 'Víčko na PET láhev (PCO 1881)', popis: 'závit 27,4 × 2,7 – typické, ověřit kroužkem', p: { nazev: 'Víčko PET 1881', druh: 'vicko', zavit: { rozmer: 'pco1881', vule: 0.25 }, vicko: { vroubku: 24, tesneni: 'ploche', tlTesneni: 1 } } },
    { id: 'vickoPet1810', skupina: 'Víčko na existující hrdlo', nazev: 'Víčko na PET láhev (PCO 1810)', popis: 'starší vyšší hrdlo, závit 27,43 × 3,18', p: { nazev: 'Víčko PET 1810', druh: 'vicko', zavit: { rozmer: 'pco1810', vule: 0.25 }, vicko: { vroubku: 24, tesneni: 'ploche', tlTesneni: 1 } } },
    { id: 'vickoGl45', skupina: 'Víčko na existující hrdlo', nazev: 'Víčko na laboratorní láhev GL 45', popis: 'závit 45 × 4 – typické, ověřit kroužkem', p: { nazev: 'Víčko GL 45', druh: 'vicko', zavit: { rozmer: 'gl45' }, vicko: { tesneni: 'ploche' } } },
    { id: 'vickoKanystr', skupina: 'Víčko na existující hrdlo', nazev: 'Víčko na kanystr DIN 61', popis: 'závit 60,5 × 6, ploché těsnění', p: { nazev: 'Víčko kanystru DIN 61', druh: 'vicko', zavit: { rozmer: 'din61', vule: 0.4 }, vicko: { stena: 2.4, dno: 2.4, vroubku: 40, tesneni: 'ploche', tlTesneni: 2 } } },
    { id: 'hrdlo40', skupina: 'Hrdlo a zátka', nazev: 'Hrdlo Ø 40 × 4 s přírubou', popis: 'k přilepení na vlastní nádobu, víčko = druh Víčko', p: { nazev: 'Hrdlo 40', druh: 'hrdlo', zavit: { rozmer: 'vlastni', d: 40, p: 4, chodu: 1, h: 1.2, vyska: 12, otvor: 32 } } },
    { id: 'zatka40', skupina: 'Hrdlo a zátka', nazev: 'Zátka Ø 40 × 4 dutá', popis: 'vnější závit s vroubkovanou hlavou', p: { nazev: 'Zátka 40', druh: 'zatka', zavit: { rozmer: 'vlastni', d: 40, p: 4, chodu: 1, h: 1.2, vyska: 12, otvor: 32 } } },
    { id: 'vzorekDoza', skupina: 'Kalibrační vzorek', nazev: 'Vzorek závitu dózy – 3 vůle', popis: 'čep + kroužky s vůlí −1 / 0 / +1 krok', p: { nazev: 'Vzorek závitu', druh: 'vzorek' } },
    { id: 'vzorekPet', skupina: 'Kalibrační vzorek', nazev: 'Kroužky na PET láhev (PCO 1881)', popis: 'vyzkoušejte na skutečné láhvi před tiskem víčka', p: { nazev: 'Vzorek PET 1881', druh: 'vzorek', zavit: { rozmer: 'pco1881', vule: 0.25 } } },
  ];

  /* ---------------- normalizace a projekt ---------------- */
  const normalizuj = v => G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  const TYP = 'dozy_zavit';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Dózy a víčka se závitem');
  function popis(p) {
    const o = odvozene(p), Z = o.Z, z = `závit Ø ${fmt(Z.d, 2)} × ${fmt(Z.p, 2)}, chodů: ${Z.chodu}`;
    if (p.druh === 'doza') return `dóza ${fmt(o.objem, 0)} ml · Ø ${fmt(2 * o.Ri, 1)} × ${fmt(o.hv, 1)} · ${z}`;
    return `${NAZVY.druh[p.druh]} · ${Z.db ? Z.db.nazev : z}`;
  }

  /* ---------------- pomocné ---------------- */
  const segmenty = r => Math.max(48, Math.min(96, Math.ceil(2 * Math.PI * r / 0.9 / 4) * 4));
  const naPodlozku = (a, b, p) => (a <= p.tisk.podlozkaX + 1e-6 && b <= p.tisk.podlozkaY + 1e-6) || (a <= p.tisk.podlozkaY + 1e-6 && b <= p.tisk.podlozkaX + 1e-6);
  /** Osový posun boku (úhel b° od kolmice k ose), aby při radiální vůli v byla kolmá mezera aspoň 0,7 v (u 45° stačí radiální). */
  const osovaVule = (v, b) => v * Math.max(0, (Math.SQRT1_2 - Math.sin(rad(b))) / Math.cos(rad(b)));
  /** Obrys pláště: kruh (n úseček, vrcholy na R), mnohoúhelník opsaný kružnici R, nebo vlnky R … R + VROUBEK. */
  function obrys(R, tvar, pocet, n) {
    const b = [];
    if (tvar === 'hran' || tvar === 'hrany') { const Rv = R / Math.cos(Math.PI / pocet); for (let i = 0; i < pocet; i++) { const a = 2 * Math.PI * (i + 0.5) / pocet; b.push([Rv * Math.cos(a), Rv * Math.sin(a)]); } return b; }
    const m = tvar === 'vroubky' ? pocet * 8 : n || segmenty(R);
    for (let i = 0; i < m; i++) { const a = 2 * Math.PI * i / m, r = tvar === 'vroubky' ? R + VROUBEK * (0.5 - 0.5 * Math.cos(pocet * a)) : R; b.push([r * Math.cos(a), r * Math.sin(a)]); }
    return b;
  }
  const rMaxObrysu = (R, tvar, pocet) => (tvar === 'hran' || tvar === 'hrany' ? R / Math.cos(Math.PI / pocet) : tvar === 'vroubky' ? R + VROUBEK : R);

  /* ---------------- závit ---------------- */
  /** Jmenovitý závit podle zdroje: dóza (Ø z průměru a stěny), databáze hrdel, vlastní. */
  function zavit(p, Ri) {
    const z = p.zavit, zdroj = p.druh === 'doza' ? 'doza' : z.rozmer, db = HRDLA.find(x => x.id === zdroj) || null;
    const Z = db ? { d: db.d, p: db.p, chodu: db.chodu, hZad: db.h, vrchol: db.vrchol, vyska: db.vyska, otvor: db.otvor }
      : { d: z.d, p: z.p, chodu: z.chodu, hZad: z.h, vrchol: zdroj === 'doza' ? 0 : z.vrchol, vyska: z.vyska, otvor: z.otvor };
    if (zdroj === 'doza') { Z.d = 2 * (Ri + p.doza.stena + z.h); Z.otvor = 2 * Ri; }
    Z.zdroj = zdroj; Z.db = db; Z.bok = z.bok; Z.lead = Z.p * Z.chodu;
    Z.soumerny = !(Z.vrchol > 0);
    Z.bok2 = Z.soumerny ? Z.bok : BOK_VOLNY;
    const tA = Math.tan(rad(Z.bok)), tB = Math.tan(rad(Z.bok2));
    // vnitřní závit se tiskne u všech druhů kromě hrdla a zátky – jen tam ubírá vůle místo zubu
    const v = p.druh === 'hrdlo' || p.druh === 'zatka' ? 0 : z.vule;
    if (Z.soumerny) { Z.h = Z.hZad; Z.wc = (Z.p - Z.h * (tA + tB)) / 2; }
    else { Z.wc = Z.vrchol; Z.h = Math.max(0.05, Math.min(Z.hZad, (Z.p - Z.vrchol - osovaVule(v, Z.bok) - osovaVule(v, Z.bok2) - ZUB_MIN) / (tA + tB))); }
    Z.tA = tA; Z.tB = tB;
    Z.rMaj = Z.d / 2; Z.rMin = Z.rMaj - Z.h; Z.rKoren = Z.rMaj - Z.hZad;
    Z.L = Z.vyska;
    // počet úseček po obvodu: stejný pro vnější i vnitřní závit; rozpočet ~160 tisíc čtyřúhelníků na tyč
    Z.N = Math.max(32, Math.min(segmenty(Z.rMaj), Math.floor(Math.sqrt(160000 * Z.lead / (Z.L + 5)) / 4) * 4));
    return Z;
  }
  /** Profil závitové tyče: vule = 0 jmenovitý (vnější závit), vule > 0 zvětšený (nástroj pro vnitřní závit). */
  function profil(Z, vule = 0) {
    const aA = osovaVule(vule, Z.bok), aB = osovaVule(vule, Z.bok2);
    return { rMaj: Z.rMaj + vule, h: Z.h, p: Z.p, lead: Z.lead, wc: Z.wc + aA + aB, c0: -Z.wc / 2 - aA, fA: Z.h * Z.tA, fB: Z.h * Z.tB, N: Z.N };
  }
  /** Poloměr profilu v osové poloze z (hřbet od c0 nahoru, pak volný bok, dno, nosný bok). */
  function polomer(z, P) {
    const t = (((z - P.c0) % P.p) + P.p) % P.p;
    if (t <= P.wc) return P.rMaj;
    if (t <= P.wc + P.fB) return P.rMaj - P.h * (t - P.wc) / P.fB;
    if (t <= P.p - P.fA) return P.rMaj - P.h;
    return P.rMaj - P.h * (P.p - t) / P.fA;
  }
  /** Poloměr závitu v řezu rovinou procházející osou pod úhlem fi (rad), místní z od paty závitu. */
  const polomerVRezu = (z, P, fi) => polomer(z - P.lead * fi / (2 * Math.PI), P);
  const PRESAH = 3;   // o kolik závitová tyč přesahuje závitovou část na obou koncích (společný počátek všech tyčí)
  /** Obálka vnějšího závitu (místní r–z, pata z = 0, konec z = L): dole výběh kuželem strmějším než 45° (bez převisu), nahoře náběh 45°. */
  function obalkaVnejsi(P, L, nabeh) {
    const R = P.rMaj + 0.3, rr = P.rMaj - P.h - 0.1, n = Math.min(nabeh, P.h + 0.1);
    const b = [[0, -1], [rr - 1 / 1.2, -1]], zd = 1.2 * (R - rr), zh = n > 0.01 ? L - (R - P.rMaj + n) : L;
    if (zd < zh) b.push([R, zd], [R, zh]);
    else if (n > 0.01) { const zs = (P.rMaj - n + L - rr) / (1 + 1 / 1.2); b.push([rr + zs / 1.2, zs]); }   // krátký závit: kužely se potkají dřív, než dosáhnou hřbetu
    else b.push([rr + L / 1.2, L]);
    if (n > 0.01) b.push([P.rMaj - n, L]);
    b.push([0, L]);
    return b;
  }
  /** Největší poloměr mnohoúhelníku r–z ve výšce z (obálky jsou hvězdicové vůči ose). */
  function rObalky(b, z) {
    let r = 0;
    for (let i = 0; i < b.length; i++) {
      const [r1, z1] = b[i], [r2, z2] = b[(i + 1) % b.length];
      if ((z1 <= z && z2 >= z) || (z2 <= z && z1 >= z)) r = Math.max(r, Math.abs(z2 - z1) < 1e-12 ? Math.max(r1, r2) : r1 + (r2 - r1) * (z - z1) / (z2 - z1));
    }
    return r;
  }

  /* ---------------- odvozené rozměry ---------------- */
  function odvozene(p) {
    const o = { druh: p.druh }, d = p.doza, vk = p.vicko, v = p.zavit.vule;
    let Ri = d.prumer / 2, hv = d.vyska;
    if (d.zadani === 'objem') { const V = d.objem * 1000; if (d.dopocet === 'vyska') hv = V / (Math.PI * Ri * Ri); else Ri = Math.sqrt(V / (Math.PI * hv)); }
    o.Ri = Ri; o.hv = hv; o.objem = Math.PI * Ri * Ri * hv / 1000;
    const Z = o.Z = zavit(p, Ri);
    o.PE = profil(Z, 0); o.PI = profil(Z, v);
    o.nabeh = Math.min(p.zavit.nabeh, Z.h);
    o.zaber = Z.h - v;                                            // radiální překrytí zubů
    if (p.druh === 'doza') {
      o.Ro = Z.rMin; o.H = d.dno + hv; o.zT = o.H - Z.L; o.zRim = o.H;
      o.Rplast = rMaxObrysu(o.Ro, d.plast, d.plast === 'hran' ? d.hran : d.vroubku);
    } else if (p.druh === 'vicko') { o.zT = 6; o.zRim = o.zT + Z.L; }
    else if (p.druh === 'hrdlo') {
      const h = p.hrdlo;
      o.ri = Z.otvor / 2; o.Rp = Z.rMaj + h.priruba; o.tp = h.tPriruby; o.zT = o.tp + h.odsazeni; o.H = o.zT + Z.L; o.zRim = o.H;
    } else if (p.druh === 'zatka') {
      const t = p.zatka;
      o.th = t.hlava; o.Rh = Z.rMaj + t.presah; o.zT = o.th; o.H = o.th + Z.L; o.zRim = o.H;
      o.rd = Z.rMin - t.stena; o.duta = t.duta && o.rd >= 2;
    } else {
      // vzorek: čep s patkou, kroužek sedí na patce
      o.hk = Math.min(Z.L, Math.max(6, 2 * Z.p)); o.tb = 2.4; o.zT = o.tb; o.Lc = o.hk + 2; o.H = o.tb + o.Lc;
      o.rd = Z.rMin - 2.4; o.duta = o.rd >= 5;
      const k = p.vzorek.krok, z0 = p.vzorek.sada ? (v - k >= -1e-9 ? v - k : v) : v;
      o.vule = (p.vzorek.sada ? [z0, z0 + k, z0 + 2 * k] : [v]).map(x => Math.max(0, Math.round(x * 1000) / 1000));
      o.iStred = p.vzorek.sada && z0 < v - 1e-9 ? 1 : 0;           // kroužek se zadanou vůlí – v sestavě sedí na čepu
      o.Rb = Z.rMaj + 2.5; o.Rk = Z.rMaj + o.vule[o.vule.length - 1] + 3;
    }
    // víčko (dóza, víčko na hrdlo): strop dosedá na okraj hrdla (přes těsnění), okraj víčka končí MEZERA nad pláštěm dózy
    if (p.druh === 'doza' || p.druh === 'vicko') {
      o.tes = vk.tesneni === 'ploche' ? vk.tlTesneni * (1 - STLACENI) : 0;
      o.zC = o.zRim + o.tes; o.top = o.zC + vk.dno;
      o.zOpen = o.zRim - (Z.zdroj === 'doza' ? Z.L - MEZERA : Z.L);
      o.rI = o.PI.rMaj; o.rIm = o.PI.rMaj - Z.h; o.RL = o.rI + vk.stena;
      o.RLmax = rMaxObrysu(o.RL, vk.uchop, vk.uchop === 'hrany' ? vk.hran : vk.vroubku);
      o.zavitu = o.zRim - o.zOpen - 2 * o.nabeh;                   // osová délka závitu v plném záběru
      o.otacek = Math.max(0, o.zavitu) / Z.lead;
      if (vk.tesneni === 'oring') {
        const d2 = vk.oring, rs = (Z.otvor / 2 + Z.rKoren) / 2;
        o.oring = { d2, hg: 0.75 * d2, bg: 1.3 * d2, rg0: rs - 0.65 * d2, rg1: rs + 0.65 * d2, okraj: Z.rKoren - Z.otvor / 2, krouzek: null };
        let best = null;
        for (const q of LJ.OKROUZKY) {
          if (Math.abs(q.d2 - d2) > 0.06 || q.d1 < 2 * o.oring.rg0 - 0.5 || q.d1 > 2 * o.oring.rg0 + 2) continue;
          if (!best || Math.abs(q.d1 - 2 * o.oring.rg0 - 0.3) < Math.abs(best.d1 - 2 * o.oring.rg0 - 0.3)) best = q;
        }
        o.oring.krouzek = best;
      }
      if (vk.tesneni === 'ploche') o.ploche = { D: Math.floor((2 * o.rIm - 0.6) * 2) / 2, d: Math.ceil(Z.otvor * 2) / 2, t: vk.tlTesneni };
    }
    return o;
  }

  /* ---------------- kontroly (bez geometrie) ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), Z = o.Z, z = p.zavit, d = p.doza, vk = p.vicko, v = z.vule;
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = (cesta, h, des = 1) => ({ zmeny: { [cesta]: Math.round(h * 10 ** des) / 10 ** des } });
    const vnitrni = p.druh !== 'hrdlo' && p.druh !== 'zatka';
    const poleZ = Z.db ? ['zavit.rozmer'] : ['zavit.p', 'zavit.h'];
    // profil závitu
    if (Z.soumerny) {
      if (Z.wc < 0.3) chyba(['zavit.p', 'zavit.h'], `Stoupání ${fmt(Z.p, 2)} mm je na hloubku ${fmt(Z.h, 2)} mm a boky ${fmt(Z.bok, 0)}° malé – hřbet závitu by měl ${fmt(Z.wc, 2)} mm (aspoň 0,3).`, opr('zavit.p', Math.ceil((Z.h * (Z.tA + Z.tB) + 0.8) * 2) / 2));
    } else {
      if (Z.h < 0.3) {
        // největší úhel nosného boku, při kterém vyjde hloubka aspoň 0,5 mm
        const tMax = (Z.p - Z.vrchol - ZUB_MIN - 2 * osovaVule(vnitrni ? v : 0, BOK_VOLNY)) / 0.5 - Z.tB, uhel = Math.floor(Math.atan(tMax) * 180 / Math.PI);
        const jde = uhel >= 20 && uhel < Z.bok;
        chyba(Z.db ? ['zavit.bok', 'zavit.vule'] : ['zavit.vrchol', 'zavit.bok', 'zavit.p'], jde
          ? `Do rozteče ${fmt(Z.p, 2)} mm se vedle hřbetu hrdla ${fmt(Z.vrchol, 2)} mm zub s nosným bokem ${fmt(Z.bok, 0)}° nevejde – zmenšete úhel nosného boku.`
          : `Do rozteče ${fmt(Z.p, 2)} mm se vedle hřbetu hrdla ${fmt(Z.vrchol, 2)} mm zub nevejde – zkontrolujte změřenou rozteč a šířku hřbetu.`, jde ? opr('zavit.bok', uhel, 0) : undefined);
      }
      else if (Z.h < Z.hZad - 0.01) info(['zavit.bok'], `Hloubka závitu je omezena na ${fmt(Z.h, 2)} mm (hrdlo má ${fmt(Z.hZad, 2)} mm), aby zub měl hřbet aspoň ${fmt(ZUB_MIN, 1)} mm. Větší záběr dá menší úhel nosného boku (30° – krátký převis se u jemného závitu obvykle vytiskne).`);
    }
    if (vnitrni && Z.h >= 0.3) {
      if (o.zaber < 0.2) chyba(['zavit.vule'], `Vůle ${fmt(v, 2)} mm je skoro jako hloubka závitu ${fmt(Z.h, 2)} mm – zuby by nezabíraly.`, opr('zavit.vule', Math.max(0, Math.floor(Z.h * 4) / 20), 2));
      else if (o.zaber < 0.4) var_(['zavit.vule', ...poleZ], Z.soumerny ? `Zuby závitu se překrývají jen o ${fmt(o.zaber, 2)} mm – víčko může při dotažení přeskočit.`
        : `Zuby závitu se překrývají jen o ${fmt(o.zaber, 2)} mm – víčko může při dotažení přeskočit. Zmenšete vůli nebo úhel nosného boku.`, Z.soumerny ? opr('zavit.h', v + 0.9) : opr('zavit.bok', 30, 0));
      const dop = Math.round(0.75 * p.tisk.tryska * 20) / 20;
      if (v < 0.4 * p.tisk.tryska) var_(['zavit.vule', 'tisk.tryska'], `Vůle ${fmt(v, 2)} mm je na trysku ${fmt(p.tisk.tryska, 2)} mm malá – závit půjde ztuha nebo vůbec. Doporučeno asi ${fmt(dop, 2)} mm; ověřte kalibračním vzorkem.`, opr('zavit.vule', dop, 2));
      else if (v > 1.5 * p.tisk.tryska) info(['zavit.vule'], `Vůle ${fmt(v, 2)} mm je velká – víčko bude na závitu volné (doporučeno asi ${fmt(dop, 2)} mm).`);
    }
    if (Z.h < 2 * p.tisk.vrstva) var_(['zavit.h', 'tisk.vrstva'], `Závit hluboký ${fmt(Z.h, 2)} mm se vrstvou ${fmt(p.tisk.vrstva, 2)} mm vytiskne nepřesně – tiskněte tenčí vrstvou.`, opr('tisk.vrstva', Math.max(0.05, Math.floor(Z.h / 3 * 20) / 20), 2));
    if (Z.bok < 90 - p.tisk.uhel - 0.01) info(['zavit.bok', 'tisk.uhel'], `Nosný bok ${fmt(Z.bok, 0)}° znamená převis ${fmt(90 - Z.bok, 0)}° od svislice – u závitu hlubokého ${fmt(Z.h, 1)} mm se obvykle vytiskne i bez podpor, ale spodní bok bude hrubší.`);
    if (Z.L < Z.p + 2 * o.nabeh) var_(['zavit.vyska'], `Závit vysoký ${fmt(Z.L, 1)} mm je po odečtení náběhů kratší než jedna rozteč (${fmt(Z.p, 2)} mm).`, Z.db ? undefined : opr('zavit.vyska', Math.ceil(Z.p + 2 * o.nabeh + 2)));
    if (Z.db) info(['zavit.rozmer'], `${Z.db.nazev}: rozměry jsou ${OVERIT} (stav ${AKTUALIZACE}); šířka hřbetu závitu a výška závitové části jsou odhad. Vytiskněte nejdřív kalibrační kroužek a vyzkoušejte ho na skutečném hrdle.`);
    else if (Z.zdroj === 'vlastni' && !Z.soumerny) info(['zavit.vrchol'], 'Profil podle cizího hrdla: hřbet = změřená šířka hřbetu závitu hrdla, volný bok 20°. Ověřte kalibračním kroužkem.');

    if (p.druh === 'doza') {
      if (d.zadani === 'objem') {
        if (d.dopocet === 'vyska' && (o.hv < 8 || o.hv > 400)) chyba(['doza.objem', 'doza.prumer'], `Na ${fmt(d.objem, 0)} ml by dóza Ø ${fmt(d.prumer, 1)} mm měla výšku ${fmt(o.hv, 1)} mm (povoleno 8–400) – změňte průměr.`, opr('doza.prumer', Math.max(10, Math.min(300, Math.round(2 * Math.cbrt(d.objem * 1000 / (2 * Math.PI))))), 0));
        if (d.dopocet === 'prumer' && (o.Ri < 5 || o.Ri > 150)) chyba(['doza.objem', 'doza.vyska'], `Na ${fmt(d.objem, 0)} ml by dóza vysoká ${fmt(d.vyska, 1)} mm měla průměr ${fmt(2 * o.Ri, 1)} mm (povoleno 10–300) – změňte výšku.`, opr('doza.vyska', Math.max(8, Math.min(400, Math.round(Math.cbrt(d.objem * 1000 * 4 / Math.PI)))), 0));
      }
      if (Z.L > o.hv - 1) chyba(['zavit.vyska', 'doza.vyska'], `Závit vysoký ${fmt(Z.L, 1)} mm se na dózu s vnitřní výškou ${fmt(o.hv, 1)} mm nevejde.`, opr('zavit.vyska', Math.max(3, Math.floor(o.hv / 2))));
      if (d.stena < 2 * p.tisk.tryska - 1e-9) var_(['doza.stena', 'tisk.tryska'], `Stěna ${fmt(d.stena, 2)} mm jsou méně než dvě dráhy trysky ${fmt(p.tisk.tryska, 2)} mm – dóza nebude těsná ani pevná.`, opr('doza.stena', Math.ceil(2 * p.tisk.tryska * 10) / 10));
      if (!naPodlozku(2 * Math.max(o.RLmax, o.Rplast), 2 * Math.max(o.RLmax, o.Rplast), p)) chyba(['doza.prumer', 'tisk.podlozkaX'], `Dóza s víčkem Ø ${fmt(2 * Math.max(o.RLmax, o.Rplast), 0)} mm se nevejde na podložku ${fmt(p.tisk.podlozkaX)} × ${fmt(p.tisk.podlozkaY)}.`);
    }
    if (p.druh === 'doza' || p.druh === 'vicko') {
      if (o.otacek < 0.2 && Z.L >= Z.p + 2 * o.nabeh) var_(['zavit.chodu', 'zavit.vyska'], `Závit je v záběru jen ${fmt(o.otacek * 360, 0)}° otáčky – víčko drží málo. Uberte chody nebo zvyšte závit.`, opr('zavit.chodu', Math.max(1, Math.floor(o.zavitu / Z.p / 0.5)), 0));
      if (vk.stena < 2 * p.tisk.tryska - 1e-9) var_(['vicko.stena', 'tisk.tryska'], `Stěna víčka ${fmt(vk.stena, 2)} mm jsou méně než dvě dráhy trysky.`, opr('vicko.stena', Math.ceil(2 * p.tisk.tryska * 10) / 10));
      if (o.oring) {
        const g = o.oring;
        if (vk.dno < g.hg + 0.8) chyba(['vicko.dno', 'vicko.oring'], `Dno víčka ${fmt(vk.dno, 1)} mm je na drážku O-kroužku hlubokou ${fmt(g.hg, 2)} mm tenké.`, opr('vicko.dno', Math.ceil((g.hg + 1) * 2) / 2));
        if (g.rg1 > o.rIm - 0.3 || g.rg0 < 1) chyba(['vicko.oring'], `Drážka pro O-kroužek ${fmt(g.d2, 1)} mm (šířka ${fmt(g.bg, 2)} mm) se nad okraj hrdla nevejde – zvolte tenčí šňůru nebo ploché těsnění.`, { zmeny: { 'vicko.tesneni': 'ploche' } });
        else {
          if (g.okraj < g.bg) info(['vicko.oring', 'doza.stena'], `Okraj hrdla (${fmt(g.okraj, 1)} mm) je užší než drážka (${fmt(g.bg, 2)} mm): O-kroužek těsní, ale víčko nemá pevný doraz – dotahujte citem, nebo zesilte stěnu.`);
          if (g.krouzek) info(['vicko.oring'], `O-kroužek ${g.krouzek.k} do čelní drážky Ø ${fmt(2 * g.rg0, 1)} / ${fmt(2 * g.rg1, 1)} × ${fmt(g.hg, 2)} mm ve stropu víčka.`);
          else info(['vicko.oring'], `O-kroužek Ø ${fmt(2 * g.rg0, 1)} × ${fmt(g.d2, 1)} v katalogu není – použijte nejbližší, nebo ploché těsnění.`);
        }
      }
      if (o.ploche) {
        if (o.ploche.D - o.ploche.d < 2) var_(['vicko.tesneni'], `Ploché těsnění Ø ${fmt(o.ploche.D, 1)} / ${fmt(o.ploche.d, 1)} mm by bylo příliš úzké.`);
        else info(['vicko.tlTesneni'], `Ploché těsnění Ø ${fmt(o.ploche.D, 1)} / ${fmt(o.ploche.d, 1)} × ${fmt(o.ploche.t, 1)} mm (pryž, silikon, pěnový PE) se vloží do víčka; počítá se stlačení o ${fmt(STLACENI * 100, 0)} %.`);
      }
    }
    if (p.druh === 'hrdlo') {
      if (Z.rMin - o.ri < 1.2) chyba(['zavit.otvor'], `Stěna hrdla pod závitem má jen ${fmt(Z.rMin - o.ri, 2)} mm – zmenšete vnitřní průměr.`, Z.db ? undefined : opr('zavit.otvor', Math.max(0, Math.floor(2 * (Z.rMin - 1.6))), 0));
      if (p.hrdlo.priruba < 3) info(['hrdlo.priruba'], 'Příruba užší než 3 mm dává malou plochu na lepení.');
    }
    if (p.druh === 'zatka' && p.zatka.duta && !o.duta) info(['zatka.duta'], 'Na dutinu není v zátce místo – tiskne se plná.');
    if (!vnitrni) info(['zavit.d'], 'Vnější závit se tiskne ve jmenovitém rozměru (vůle se přičítá jen k vnitřnímu závitu). Pro cizí protikus zadejte změřený vnější průměr původního dílu.');
    if (p.druh === 'vzorek') info(['vzorek.sada'], o.vule.length > 1
      ? `Kroužky mají vůli ${o.vule.map(x => fmt(x, 2)).join(' / ')} mm – číslo kroužku = počet zářezů. Vyberte ten, který jde našroubovat lehce a neviklá se, a jeho vůli zapište do pole Vůle závitu.`
      : `Kroužek s vůlí ${fmt(o.vule[0], 2)} mm a čep – ověřte lícování před velkým tiskem.`);
    if (p.tisk.uhel < 45) info(['tisk.uhel'], `Díly jsou navržené na převis 45°. Při ${fmt(p.tisk.uhel)}° může tisk potřebovat podpory – ukáže je tisková poloha.`);
    return H;
  }

  /* ---------------- geometrie ---------------- */
  function sit(km, m0, jmeno, nazev, barva, navic) {
    const m = km(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const kusy = m.decompose().map(km);
    return Object.assign({ jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, barva, otocit: false, ks: 1 }, navic);
  }
  const BARVY = { doza: '#4F86D9', vicko: '#E07B39', kontext: '#8E99A6', vzorek: '#2EAD5B' };

  /** Sestaví díly přes manifold-3d → {dily, kontext, o, cas}. */
  function postav(w, p) {
    const t0 = Date.now(), o = odvozene(p), Z = o.Z;
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const km = x => { smaz.push(x); return x; };
    const otoc = (body, n) => {
      const b = body.filter((q, i) => !i || Math.hypot(q[0] - body[i - 1][0], q[1] - body[i - 1][1]) > 1e-9);   // bez zdvojených bodů (sražení 0)
      return km(km(new CS([b], 'NonZero')).revolve(n || segmenty(Math.max(...b.map(q => q[0])))));
    };
    const hranol = (b, z0, z1) => km(km(km(new CS([b], 'NonZero')).extrude(z1 - z0)).translate([0, 0, z0]));
    const zdvih = (m, dz) => km(m.translate([0, 0, dz]));
    const rozdil = (a, b) => (b.length ? km(M.difference([a, ...b])) : a);
    /** Závitová tyč (jádro + závit) v místních souřadnicích závitu, z ∈ ⟨−PRESAH, L + PRESAH⟩ – společný počátek všech tyčí. */
    function tyc(P, L) {
      const N = P.N, krok = P.lead / N, vrstev = Math.ceil((L + 2 * PRESAH) / krok), b = [];
      for (let i = 0; i < N; i++) { const a = 2 * Math.PI * i / N, r = polomer(-PRESAH - i * krok, P); b.push([r * Math.cos(a), r * Math.sin(a)]); }
      return km(km(km(new CS([b], 'NonZero')).extrude(vrstev * krok, vrstev, 360 * vrstev / N)).translate([0, 0, -PRESAH]));
    }
    /** Vnější závit s výběhem a náběhem, pata v z = zT, délka L. */
    const vnejsi = (L, zT, nabeh) => zdvih(km(tyc(o.PE, L).intersect(otoc(obalkaVnejsi(o.PE, L, nabeh), Z.N))), zT);
    /** Nástroj vnitřního závitu s vůlí v pro z ∈ ⟨z0, z1⟩ (v souřadnicích sestavy) + náběhový kužel u z0. */
    function vnitrni(v, L, zT, z0, z1, nabeh) {
      const P = profil(Z, v), R = P.rMaj + 1, rm = P.rMaj - P.h, n = Math.min(nabeh, P.h);
      const out = [zdvih(km(tyc(P, L).intersect(otoc([[0, z0 - 1 - zT], [R, z0 - 1 - zT], [R, z1 - zT], [0, z1 - zT]], Z.N))), zT)];
      if (n > 0.01) out.push(otoc([[0, z0 - 1], [rm + n + 1, z0 - 1], [rm, z0 + n], [0, z0 + n]], Z.N));
      return out;
    }
    /** Plášť s obrysem (hladký / mnohoúhelník / vroubky) od z0 do z1; sražení 45° dole (cd) a nahoře (ch). */
    function plast(R, tvar, pocet, z0, z1, cd, ch) {
      if (tvar === 'valec' || tvar === 'hladky') return otoc([[0, z0], [R - cd, z0], [R, z0 + cd], [R, z1 - ch], [R - ch, z1], [0, z1]], Z.N);
      // obálka seřízne rohy a vroubky kuželem 45° (dole kvůli tisku, nahoře plynulý přechod); u nízkého dílu se kužely potkají
      const Rm = rMaxObrysu(R, tvar, pocet) + 0.5, s = Rm - R, za = z0 + cd + s, zb = z1 - ch - s, zs = (z0 + z1 + cd - ch) / 2;
      const bok = za < zb ? [[Rm, za], [Rm, zb]] : [[R - cd + zs - z0, zs]];
      return km(hranol(obrys(R, tvar, pocet), z0, z1).intersect(otoc([[0, z0], [R - cd, z0], ...bok, [R - ch, z1], [0, z1]], segmenty(Rm))));
    }
    const valecEkv = (r, z0, z1) => { const n = segmenty(r), re = r * Math.sqrt(2 * Math.PI / (n * Math.sin(2 * Math.PI / n))); return km(km(M.cylinder(z1 - z0, re, re, n)).translate([0, 0, z0])); };   // mnohoúhelník se stejnou plochou jako kruh (objem dutiny přesně)

    function postavVicko() {
      const vk = p.vicko, pocet = vk.uchop === 'hrany' ? vk.hran : vk.vroubku;
      const telo = plast(o.RL, vk.uchop, pocet, o.zOpen, o.top, 0.3, Math.min(SRAZENI, vk.dno / 2));
      const odeb = vnitrni(p.zavit.vule, Z.L, o.zT, o.zOpen, o.zC, o.nabeh);
      if (o.oring) { const g = o.oring; odeb.push(otoc([[g.rg0, o.zC - 0.5], [g.rg1, o.zC - 0.5], [g.rg1, o.zC + g.hg], [g.rg0, o.zC + g.hg]])); }
      return sit(km, rozdil(telo, odeb), 'vicko', 'Víčko', BARVY.vicko, { otocit: true, rozpad: Z.L + 12 });
    }
    try {
      const dily = [], kontext = [];
      if (p.druh === 'doza') {
        const d = p.doza, pocet = d.plast === 'hran' ? d.hran : d.vroubku;
        const telo = km(M.union([plast(o.Ro, d.plast, pocet, 0, o.zT, Math.min(SRAZENI, d.dno / 2), 0), vnejsi(Z.L, o.zT, o.nabeh)]));
        dily.push(sit(km, rozdil(telo, [valecEkv(o.Ri, d.dno, o.H + 1)]), 'doza', 'Dóza', BARVY.doza));
        dily.push(postavVicko());
      } else if (p.druh === 'vicko') {
        dily.push(postavVicko());
        const ri = Math.min(Z.otvor / 2, Z.rMin - 1), hrdlo = km(M.union([otoc([[0, 0], [Z.rMin, 0], [Z.rMin, o.zT], [0, o.zT]], Z.N), vnejsi(Z.L, o.zT, Math.min(0.5, Z.h))]));
        kontext.push(sit(km, ri > 1 ? rozdil(hrdlo, [valecEkv(ri, -1, o.zRim + 1)]) : hrdlo, 'hrdlo', 'Hrdlo (stávající)', BARVY.kontext, { kontext: true }));
      } else if (p.druh === 'hrdlo') {
        const c = Math.min(SRAZENI, o.tp / 2);
        const telo = km(M.union([otoc([[0, 0], [o.Rp - c, 0], [o.Rp, c], [o.Rp, o.tp], [0, o.tp]]), otoc([[0, 0], [Z.rMin, 0], [Z.rMin, o.zT], [0, o.zT]], Z.N), vnejsi(Z.L, o.zT, o.nabeh)]));
        dily.push(sit(km, o.ri > 0.5 ? rozdil(telo, [valecEkv(o.ri, -1, o.H + 1)]) : telo, 'hrdlo', 'Hrdlo', BARVY.doza));
      } else if (p.druh === 'zatka') {
        const vk = p.vicko, pocet = vk.uchop === 'hrany' ? vk.hran : vk.vroubku;
        const telo = km(M.union([plast(o.Rh, vk.uchop, pocet, 0, o.th, Math.min(SRAZENI, o.th / 3), 0), vnejsi(Z.L, o.zT, o.nabeh)]));
        dily.push(sit(km, o.duta ? rozdil(telo, [valecEkv(o.rd, o.th, o.H + 1)]) : telo, 'zatka', 'Zátka', BARVY.vicko));
      } else {
        const cep = km(M.union([otoc([[0, 0], [o.Rb - SRAZENI, 0], [o.Rb, SRAZENI], [o.Rb, o.tb], [0, o.tb]]), vnejsi(o.Lc, o.zT, o.nabeh)]));
        dily.push(sit(km, o.duta ? rozdil(cep, [valecEkv(o.rd, -1, o.H + 1)]) : cep, 'cep', 'Čep', BARVY.doza));
        let vedle = 0;
        o.vule.forEach((v, i) => {
          const z0 = o.zT, z1 = o.zT + o.hk, odeb = vnitrni(v, o.Lc, o.zT, z0, z1 + 1, o.nabeh), stred = i === o.iStred;
          // zářezy na obvodu: číslo kroužku = počet zářezů
          for (let j = 0; j <= i && o.vule.length > 1; j++) odeb.push(km(km(M.cube([2.4, 1.2, o.hk + 2], true)).translate([o.Rk, 0, (z0 + z1) / 2]).rotate([0, 0, j * 14])));
          const telo = otoc([[0, z0], [o.Rk, z0], [o.Rk, z1 - 0.3], [o.Rk - 0.3, z1], [0, z1]]);
          dily.push(sit(km, rozdil(telo, odeb), 'krouzek' + (i + 1), o.vule.length > 1 ? `Kroužek ${i + 1} (vůle ${fmt(v, 2)} mm)` : `Kroužek (vůle ${fmt(v, 2)} mm)`, BARVY.vzorek,
            { otocit: true, vule: v, posun: stred ? null : [(vedle++ ? 1 : -1) * (2 * o.Rk + 6), 0, -o.zT], rozpad: stred ? o.hk + 10 : 0 }));
        });
      }
      return { dily, kontext, o, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  /** Díl posunutý pro sestavu (d.posun) a případně zdvižený v rozloženém pohledu (d.rozpad). */
  function umisti(d, rozlozit) {
    const s = d.posun || [0, 0, 0], dz = s[2] + (rozlozit ? d.rozpad || 0 : 0);
    if (!s[0] && !s[1] && !dz) return d;
    const P = new Float32Array(d.poz.length);
    for (let i = 0; i < P.length; i += 3) { P[i] = d.poz[i] + s[0]; P[i + 1] = d.poz[i + 1] + s[1]; P[i + 2] = d.poz[i + 2] + dz; }
    return Object.assign({}, d, { poz: P });
  }
  /** Díl v tiskové poloze (otočený, na podložce). */
  const tiskove = d => G.tiskoveRozlozeni([d], 1, 6, 1e9)[0];

  /* ---------------- řez pro výkres ---------------- */
  /** Poloviční řezy dílů rovinou osy pod úhlem fi: [{jmeno, kontext, b: [[r, z], …]}] v souřadnicích sestavy. */
  function rezy(p, o, fi = 0) {
    const Z = o.Z, out = [], krok = Z.p / 24;
    const vz = (z0, z1) => { const a = []; for (let z = z0; z < z1 - 1e-9; z += krok) a.push(z); a.push(z1); return a; };
    /** Obrys vnějšího závitu zdola nahoru (pata zT, délka L). */
    const vnejsi = (L, zT, nabeh) => { const ob = obalkaVnejsi(o.PE, L, nabeh); return vz(0, L).map(z => [Math.min(polomerVRezu(z, o.PE, fi), rObalky(ob, z)), zT + z]); };
    /** Obrys vnitřního závitu zdola nahoru mezi z0 a z1 (souřadnice sestavy). */
    const vnitrni = (v, zT, z0, z1, nabeh) => { const P = profil(Z, v), rm = P.rMaj - P.h, n = Math.min(nabeh, P.h); return vz(z0, z1).map(z => [Math.max(polomerVRezu(z - zT, P, fi), rm + n - (z - z0)), z]); };
    const vicko = () => {
      const c = Math.min(SRAZENI, p.vicko.dno / 2), b = [[o.RL, o.zOpen], [o.RL, o.top - c], [o.RL - c, o.top], [0, o.top], [0, o.zC]];
      if (o.oring) { const g = o.oring; b.push([g.rg0, o.zC], [g.rg0, o.zC + g.hg], [g.rg1, o.zC + g.hg], [g.rg1, o.zC]); }
      return { jmeno: 'vicko', b: b.concat(vnitrni(p.zavit.vule, o.zT, o.zOpen, o.zC, o.nabeh).reverse()) };
    };
    if (p.druh === 'doza') {
      const d = p.doza, c = Math.min(SRAZENI, d.dno / 2);
      out.push({ jmeno: 'doza', b: [[0, 0], [o.Ro - c, 0], [o.Ro, c], [o.Ro, o.zT]].concat(vnejsi(Z.L, o.zT, o.nabeh), [[o.Ri, o.H], [o.Ri, d.dno], [0, d.dno]]) });
      out.push(vicko());
    } else if (p.druh === 'vicko') {
      const ri = Math.max(0, Math.min(Z.otvor / 2, Z.rMin - 1));
      out.push({ jmeno: 'hrdlo', kontext: true, b: [[ri, 0], [Z.rMin, 0], [Z.rMin, o.zT]].concat(vnejsi(Z.L, o.zT, Math.min(0.5, Z.h)), [[ri, o.zRim]]) });
      out.push(vicko());
    } else if (p.druh === 'hrdlo') {
      const c = Math.min(SRAZENI, o.tp / 2);
      out.push({ jmeno: 'hrdlo', b: [[o.ri, 0], [o.Rp - c, 0], [o.Rp, c], [o.Rp, o.tp], [Z.rMin, o.tp], [Z.rMin, o.zT]].concat(vnejsi(Z.L, o.zT, o.nabeh), [[o.ri, o.H]]) });
    } else if (p.druh === 'zatka') {
      const c = Math.min(SRAZENI, o.th / 3), b = [[0, 0], [o.Rh - c, 0], [o.Rh, c], [o.Rh, o.th]].concat(vnejsi(Z.L, o.zT, o.nabeh));
      out.push({ jmeno: 'zatka', b: b.concat(o.duta ? [[o.rd, o.H], [o.rd, o.th], [0, o.th]] : [[0, o.H]]) });
    } else {
      const b = [[o.duta ? o.rd : 0, 0], [o.Rb - SRAZENI, 0], [o.Rb, SRAZENI], [o.Rb, o.tb]].concat(vnejsi(o.Lc, o.zT, o.nabeh), [[o.duta ? o.rd : 0, o.H]]);
      out.push({ jmeno: 'cep', b });
      const v = o.vule[o.iStred], z0 = o.zT, z1 = o.zT + o.hk;
      out.push({ jmeno: 'krouzek', b: [[o.Rk, z0], [o.Rk, z1 - 0.3], [o.Rk - 0.3, z1]].concat(vnitrni(v, o.zT, z0, z1, o.nabeh).reverse()) });
    }
    return out;
  }

  /* ---------------- tisk, kontroly modelu, kusovník ---------------- */
  function kontrolyModelu(p, model) {
    const H = [];
    for (const d0 of model.dily) {
      if (d0.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d0.nazev}: díl se rozpadl na ${d0.teles} tělesa – některá část není spojená.` });
      const d = tiskove(d0), r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 3) H.push({ uroven: 'varovani', pole: ['tisk.uhel', 'zavit.bok'], text: `${d0.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v tiskové poloze může potřebovat podpory.` });
      if (r.most > 2) H.push({ uroven: 'info', pole: null, text: `${d0.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu.` });
      const b = G.obal(d.poz);
      if (!naPodlozku(b[3] - b[0], b[4] - b[1], p)) H.push({ uroven: 'chyba', pole: ['tisk.podlozkaX', 'tisk.podlozkaY'], text: `${d0.nazev} (${fmt(b[3] - b[0], 0)} × ${fmt(b[4] - b[1], 0)} mm) se nevejde na podložku ${fmt(p.tisk.podlozkaX)} × ${fmt(p.tisk.podlozkaY)}.` });
    }
    return H;
  }
  /** Kusovník: [{nazev, ks, pozn, druh: 'tisk'|'nakup', d?}] */
  function kusovnik(p, model) {
    const o = model ? model.o : odvozene(p), out = [], mat = MATERIALY[p.tisk.material].nazev;
    if (model) for (const d of model.dily) out.push({ nazev: d.nazev, ks: d.ks, pozn: d.otocit ? `${mat}, tiskne se otočené` : mat, druh: 'tisk', d });
    if (o.oring) out.push({ nazev: `O-kroužek do víčka: ${o.oring.krouzek ? o.oring.krouzek.k : `Ø ${fmt(2 * o.oring.rg0, 1)} × ${fmt(o.oring.d2, 1)}`}`, ks: 1, pozn: 'NBR / silikon, do drážky ve víčku', druh: 'nakup' });
    if (o.ploche) out.push({ nazev: `Ploché těsnění do víčka: Ø ${fmt(o.ploche.D, 1)} / ${fmt(o.ploche.d, 1)} × ${fmt(o.ploche.t, 1)} mm`, ks: 1, pozn: 'vystřihnout z pryže, silikonu nebo pěny', druh: 'nakup' });
    if (p.druh === 'hrdlo') out.push({ nazev: 'Lepidlo podle materiálu nádoby', ks: 1, pozn: 'příruba = lepená plocha', druh: 'nakup' });
    return out;
  }

  const API = {
    AKTUALIZACE, OVERIT, MATERIALY, HRDLA, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY, BOK_VOLNY, ZUB_MIN, VROUBEK, MEZERA, STLACENI,
    normalizuj, predvolba, popis, ulozProjekt, nactiProjekt, odvozene, kontroly, postav, kontrolyModelu, kusovnik,
    profil, polomer, polomerVRezu, rezy, umisti, tiskove,
    kopie, vezmi: G.vezmi, poloz: G.poloz, fmt,
  };
  if (uzel) module.exports = API; else window.DOZY = API;
})();
