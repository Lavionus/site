/* Kolečka a pojezdy – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Náhradní kolečka pro šuplíky, sprchové dveře, posuvná vrata, vozíky a pojezdy na V-slot: profil běhounu
   (plochý, korunkový, V hrot, V drážka, U drážka, O-kroužek, nalisovaný běhoun z TPU), uložení (ložisko z katalogu
   obsah/loziska, kluzně na ose, hřídel s ploškou), držák (pevná vidlice, otočná vidlice, úchyt s dírami)
   a příslušenství (distance, excentrická distance, kalibrační vzorek pro lisování ložiska).

   Souřadnice KOLA: osa Z = osa kola, z od 0 (spodní čelo) do W (horní čelo), profil běhounu je [r, z].
   SESTAVA: podlaha z = 0, osa kola ve směru X, jízda ve směru Y; střed kola v (0, 0, R).
   Díly jsou v montážní poloze sestavy; d.otocit = tisknout vzhůru nohama (G3D.tiskoveRozlozeni), kolo leží na čele. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const LJ = uzel ? require('../loziska/jadro.js') : window.LoziskaJadro;   // katalog ložisek (d, D, B, C, C0)
  const fmt = G.fmt, kopie = G.kopie;
  const rad = s => s * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const S3 = Math.sqrt(3);

  /* ---------------- tabulky ---------------- */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27 }, PLA: { nazev: 'PLA', hustota: 1.24 }, ASA: { nazev: 'ASA', hustota: 1.07 },
    ABS: { nazev: 'ABS', hustota: 1.04 }, PA: { nazev: 'PA (nylon)', hustota: 1.14 }, PC: { nazev: 'PC', hustota: 1.2 },
    TPU: { nazev: 'TPU 95A', hustota: 1.21 },
  };
  /** Šrouby a matice ISO 4032 / nízké samojistné ISO 7040, hlava šestihranná ISO 4017 (k), zápustná ISO 10642 (dk, kz),
      velká podložka ISO 7093 (DIN 9021: Dp × tp). */
  const SROUBY = {
    M3: { d: 3, s: 5.5, m: 2.4, mn: 4, k: 2, dk: 6, kz: 1.7, Dp: 9, tp: 0.8 },
    M4: { d: 4, s: 7, m: 3.2, mn: 5, k: 2.8, dk: 8, kz: 2.3, Dp: 12, tp: 1 },
    M5: { d: 5, s: 8, m: 4.7, mn: 5, k: 3.5, dk: 10, kz: 2.8, Dp: 15, tp: 1.2 },
    M6: { d: 6, s: 10, m: 5.2, mn: 6, k: 4, dk: 12, kz: 3.3, Dp: 18, tp: 1.6 },
    M8: { d: 8, s: 13, m: 6.8, mn: 8, k: 5.3, dk: 16, kz: 4.4, Dp: 24, tp: 2 },
    M10: { d: 10, s: 16, m: 8.4, mn: 10, k: 6.4, dk: 20, kz: 5.5, Dp: 30, tp: 2.5 },
    M12: { d: 12, s: 18, m: 10.8, mn: 12, k: 7.5, dk: 24, kz: 6.5, Dp: 37, tp: 3 },
  };
  const DELKY = [6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200];
  /** Kuličková radiální ložiska z katalogu ložisek (řady mini, MR, 60, 62, 63, 618, 619, 160) do D 72 mm. */
  const RADY = ['mini', 'MR', '618', '619', '160', '60', '62', '63'];
  const LOZISKA = LJ.LOZISKA.filter(l => RADY.includes(l.rada) && l.D <= 72);
  const PODLE_OZN = new Map(LOZISKA.map(l => [l.o, l]));
  /** Ložiska, která se do koleček dávají nejčastěji (nahoře v nabídce). */
  const CASTA = ['608', '625', '623', '624', '626', '688', '695', 'MR105', '6000', '6001', '6200', '6201', '61800', '61900'];

  const NAZVY = {
    profil: { plochy: 'plochý', korunka: 'korunkový (vypouklý)', vhrot: 'V hrot – do V drážky (V-slot)', vdrazka: 'V drážka – na úhelník / kulatinu',
      u: 'U drážka – na trubku / lanko', oring: 'drážka pro O-kroužek', tpu: 'nalisovaný běhoun z TPU (2 díly)' },
    ulozeni: { lozisko: 'kuličkové ložisko', kluzne: 'kluzně na ose (bez ložiska)', hridel: 'pevně na hřídeli s ploškou' },
    drzak: { zadny: 'bez držáku', vidlice: 'pevná vidlice', otocna: 'otočná vidlice (kluzný čep)', uchyt: 'úchyt s dírami (šuplík, dveře)' },
    deleni: { auto: 'automaticky', cele: 'celé kolo', pulky: 'dvě poloviny' },
    spoj: { srouby: 'šrouby s maticí', lepeni: 'lepení + kolíky z filamentu', loziska: 'drží je ložiska (bez spoje)' },
    mostek: { mustkova: 'můstková vrstva', obetovana: 'obětovaná vrstva' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Kolečko vozíku', diry: 'kapka',
    kolo: {
      prumer: 50, sirka: 18, profil: 'korunka', srazeni: 0.8, korunka: 0.3,
      uhel: 90, hloubka: 3, spicka: 1, trubka: 20, vuleU: 0.5, oring: 2.62, oringu: 1, tpu: 3, tpuPresah: 0.6, lem: 1.5,
      deleni: 'auto', spoj: 'srouby', sroub: 'M3', sroubu: 3, odlehceni: false, disk: 5,
    },
    ulozeni: { typ: 'lozisko', lozisko: '608', pocet: 2, vule: 0.1, osazeni: 1.2, D: 22, d: 8, B: 7, osa: 8, vuleOsy: 0.3, plocha: 6.5 },
    excentr: { pouzit: false, e: 0.8, prumer: 7.1, klic: 10 },
    drzak: {
      typ: 'vidlice', tloustka: 4, sirka: 0, mezera: 1.5, volno: 3,
      a: 54, b: 54, deska: 4, roztecX: 40, roztecY: 40, dira: 4.5,
      zavlek: 14, cep: 'M8',
      delka: 50, vyska: 24, der: 2, roztec: 32, zapustne: true, osaX: 0, osaY: -6, naboj: 3, matice: true,
    },
    tisk: { material: 'PETG', vrstva: 0.2, uhel: 45, kusu: 1, mostek: 'mustkova', krokKalibrace: 0.05 },
    mech: { hmotnost: 40, kol: 4, podlozka: 'beton', drazka: 'uhelnik', rychlost: 1, raz: 1.5, zivot: 2000 },
  };
  const MEZE = {
    'kolo.prumer': [8, 250], 'kolo.sirka': [3, 120], 'kolo.srazeni': [0, 5], 'kolo.korunka': [0, 10],
    'kolo.uhel': [40, 140], 'kolo.hloubka': [0.3, 40], 'kolo.spicka': [0, 20], 'kolo.trubka': [1, 120], 'kolo.vuleU': [0, 5],
    'kolo.oring': [1, 8], 'kolo.oringu': [1, 3, 1], 'kolo.tpu': [1, 20], 'kolo.tpuPresah': [-0.5, 3], 'kolo.lem': [0.6, 10],
    'kolo.sroubu': [2, 8, 1], 'kolo.disk': [1.5, 60],
    'ulozeni.pocet': [1, 2, 1], 'ulozeni.vule': [-0.5, 0.8], 'ulozeni.osazeni': [0.4, 10],
    'ulozeni.D': [3, 120], 'ulozeni.d': [1, 100], 'ulozeni.B': [1, 40], 'ulozeni.osa': [1, 60], 'ulozeni.vuleOsy': [0, 2], 'ulozeni.plocha': [0.5, 60],
    'excentr.e': [0.2, 5], 'excentr.prumer': [3, 40], 'excentr.klic': [5, 50],
    'drzak.tloustka': [1.5, 20], 'drzak.sirka': [0, 80], 'drzak.mezera': [0.3, 30], 'drzak.volno': [0.5, 50],
    'drzak.a': [10, 300], 'drzak.b': [10, 300], 'drzak.deska': [1.5, 30], 'drzak.roztecX': [0, 290], 'drzak.roztecY': [0, 290], 'drzak.dira': [0, 20],
    'drzak.zavlek': [0, 150], 'drzak.delka': [10, 300], 'drzak.vyska': [6, 200], 'drzak.der': [0, 8, 1], 'drzak.roztec': [0, 290],
    'drzak.osaX': [-150, 150], 'drzak.osaY': [-150, 150], 'drzak.naboj': [0.3, 40],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.kusu': [1, 20, 1], 'tisk.krokKalibrace': [0.02, 0.2],
    'mech.hmotnost': [0, 5000], 'mech.kol': [1, 16, 1], 'mech.rychlost': [0, 20], 'mech.raz': [1, 4], 'mech.zivot': [0, 1e6],
  };
  const VYCTY = {
    diry: ['kapka', 'kruh'], 'kolo.profil': Object.keys(NAZVY.profil), 'kolo.deleni': Object.keys(NAZVY.deleni), 'kolo.spoj': Object.keys(NAZVY.spoj),
    'kolo.sroub': ['M3', 'M4', 'M5'],
    'ulozeni.typ': Object.keys(NAZVY.ulozeni), 'ulozeni.lozisko': LOZISKA.map(l => l.o).concat('vlastni'),
    'drzak.typ': Object.keys(NAZVY.drzak), 'drzak.cep': ['M5', 'M6', 'M8', 'M10'],
    'tisk.material': Object.keys(MATERIALY), 'tisk.mostek': Object.keys(NAZVY.mostek),
    'mech.podlozka': ['ocel', 'hlinik', 'beton', 'dlazba', 'drevo', 'pvc', 'sklo'], 'mech.drazka': ['uhelnik', 'kulatina'],
  };

  /** Předvolby (skupina = druh použití) – jen odchylky od výchozího projektu; tisk a mechanika zůstávají uživatelovy. */
  const PREDVOLBY = [
    { id: 'vozik', skupina: 'Vozíky a nábytek', nazev: 'Kolečko vozíku – pevná vidlice', popis: 'Ø 50 × 18, korunka, 2× 608, plotýnka 54 × 54 na 4 vruty', p: {} },
    { id: 'otocne', skupina: 'Vozíky a nábytek', nazev: 'Kolečko vozíku – otočné', popis: 'Ø 50, 2× 608, kluzný čep M8, závlek 14 mm',
      p: { nazev: 'Otočné kolečko', drzak: { typ: 'otocna', deska: 7 } } },
    { id: 'tpu', skupina: 'Vozíky a nábytek', nazev: 'Tiché kolo s běhounem z TPU', popis: 'Ø 60, jádro PETG + nalisovaný běhoun TPU 3 mm, 2× 608, otočné',
      p: { nazev: 'Tiché kolo TPU', kolo: { prumer: 60, sirka: 20, profil: 'tpu', tpu: 3, tpuPresah: 0.6, lem: 1.5 }, drzak: { typ: 'otocna', deska: 7, a: 60, b: 60, roztecX: 46, roztecY: 46, zavlek: 16 } } },
    { id: 'suplik', skupina: 'Šuplíky a dveře', nazev: 'Kolečko šuplíku – úchyt na 2 vruty', popis: 'Ø 24 × 8, plochý, 1× 625, úchyt s 2 zápustnými dírami 32 mm',
      p: { nazev: 'Kolečko šuplíku', kolo: { prumer: 24, sirka: 8, profil: 'plochy', srazeni: 0.6 }, ulozeni: { lozisko: '625', pocet: 1 },
        drzak: { typ: 'uchyt', delka: 50, vyska: 22, deska: 6.5, der: 2, roztec: 32, dira: 4, osaX: 0, osaY: -4, naboj: 2, matice: true },
        mech: { hmotnost: 12, kol: 4, podlozka: 'ocel', rychlost: 0.3, raz: 1.5 } } },
    { id: 'sprcha', skupina: 'Šuplíky a dveře', nazev: 'Sprchové dveře – kolečko s excentrem', popis: 'Ø 23 × 6, plochý, 1× 624, excentrická distance, úchyt na 2 šrouby',
      p: { nazev: 'Kolečko sprchových dveří', kolo: { prumer: 23, sirka: 6, profil: 'plochy', srazeni: 0.5 }, ulozeni: { lozisko: '624', pocet: 1, osazeni: 1 },
        excentr: { pouzit: true, e: 0.8, prumer: 8, klic: 11 },
        drzak: { typ: 'uchyt', delka: 42, vyska: 22, deska: 5, der: 2, roztec: 28, dira: 4.5, osaX: 0, osaY: -3, naboj: 3, matice: true },
        tisk: { material: 'PC' }, mech: { hmotnost: 20, kol: 2, podlozka: 'hlinik', rychlost: 0.3, raz: 1.2 } } },
    { id: 'vrata', skupina: 'Vrata a kolejnice', nazev: 'Posuvná vrátka – V drážka na úhelník', popis: 'Ø 60 × 22, V drážka 90° na hranu úhelníku, 2× 6001, vidlice',
      p: { nazev: 'Kolo vrátek', kolo: { prumer: 60, sirka: 22, profil: 'vdrazka', uhel: 90, hloubka: 6, spicka: 1 }, ulozeni: { lozisko: '6001', pocet: 2 },
        drzak: { typ: 'vidlice', tloustka: 6, a: 64, b: 60, deska: 6, roztecX: 48, roztecY: 44, dira: 6.5 }, mech: { hmotnost: 60, kol: 2, podlozka: 'ocel', drazka: 'uhelnik', rychlost: 0.5 } } },
    { id: 'kladka', skupina: 'Vrata a kolejnice', nazev: 'Kladka na lanko / kolo na trubku Ø 20', popis: 'Ø 44 × 22, U drážka pro trubku Ø 20, 2× 608, dvě poloviny',
      p: { nazev: 'Kolo na trubku', kolo: { prumer: 44, sirka: 22, profil: 'u', trubka: 20, vuleU: 0.5, hloubka: 5, spoj: 'lepeni' }, drzak: { typ: 'zadny' }, mech: { podlozka: 'ocel' } } },
    { id: 'vslot', skupina: '3D tiskárny a CNC', nazev: 'V-slot – plné V kolo', popis: 'typ. Ø 23,9, V 90°, 2× 625, excentr; šířka 11 (orig. 10,2 – ložiska přečnívají), ověřit měřením',
      p: { nazev: 'V kolo', kolo: { prumer: 23.9, sirka: 11, profil: 'vhrot', uhel: 90, hloubka: 2.3, spicka: 1, srazeni: 0.4 },
        ulozeni: { lozisko: '625', pocet: 2, osazeni: 1 }, excentr: { pouzit: true, e: 0.8, prumer: 8.5, klic: 11 }, drzak: { typ: 'zadny', mezera: 6 },
        tisk: { material: 'PC' }, mech: { hmotnost: 2, kol: 4, podlozka: 'hlinik', rychlost: 0.2 } } },
    { id: 'kulatina', skupina: '3D tiskárny a CNC', nazev: 'Pojezd na kulatou tyč Ø 12 – V drážka', popis: 'Ø 36 × 16, V drážka 90°, 2× 608, pevná vidlice',
      p: { nazev: 'Pojezd na tyč', kolo: { prumer: 36, sirka: 16, profil: 'vdrazka', uhel: 90, hloubka: 4, spicka: 0.6 },
        drzak: { typ: 'vidlice', a: 44, b: 44, roztecX: 32, roztecY: 32, dira: 4.5 }, tisk: { material: 'PC' }, mech: { hmotnost: 5, kol: 4, podlozka: 'ocel', drazka: 'kulatina', rychlost: 0.3 } } },
    { id: 'robot', skupina: 'Pohony a roboti', nazev: 'Kolo robota – hřídel 3 mm s ploškou, O-kroužek', popis: 'Ø 42 × 10, drážka pro O-kroužek 2,62 mm, motorek N20 (D 3 mm, ploška 2,5)',
      p: { nazev: 'Kolo robota', kolo: { prumer: 42, sirka: 10, profil: 'oring', oring: 2.62, oringu: 1 },
        ulozeni: { typ: 'hridel', osa: 3, vuleOsy: 0.1, plocha: 2.5 }, drzak: { typ: 'zadny' }, mech: { hmotnost: 0.6, kol: 2, podlozka: 'dlazba', rychlost: 0.3 } } },
  ];

  /* ---------------- normalizace a projekt ---------------- */
  const normalizuj = v => G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  function popis(p) {
    const u = p.ulozeni, L = lozisko(p);
    const ul = u.typ === 'lozisko' ? `${u.pocet}× ${L.o}` : u.typ === 'kluzne' ? `kluzně Ø ${fmt(u.osa)}` : `hřídel Ø ${fmt(u.osa)}`;
    return `Ø ${fmt(p.kolo.prumer)} × ${fmt(p.kolo.sirka)} · ${NAZVY.profil[p.kolo.profil].split(' – ')[0]} · ${ul} · ${NAZVY.drzak[p.drzak.typ]}`;
  }
  const TYP = 'kolecka';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Kolečka a pojezdy');

  /* ---------------- odvozené rozměry ---------------- */
  /** Ložisko podle projektu (z katalogu nebo vlastní rozměry). */
  function lozisko(p) {
    const u = p.ulozeni;
    if (u.lozisko !== 'vlastni' && PODLE_OZN.has(u.lozisko)) return PODLE_OZN.get(u.lozisko);
    return { o: `vlastní ${fmt(u.d)}×${fmt(u.D)}×${fmt(u.B)}`, rada: 'vlastni', d: u.d, D: u.D, B: u.B, C: null, C0: null };
  }
  const sroubNa = d => Object.keys(SROUBY).find(k => SROUBY[k].d === d) || null;
  const delkaSroubu = l => DELKY.find(x => x >= l - 0.01) || Math.ceil(l / 10) * 10;
  const segmenty = r => Math.max(32, Math.min(144, Math.ceil(2 * Math.PI * r / 0.9 / 4) * 4));

  /** Vnější profil běhounu [r, z] od z = 0 do z = W + údaje profilu (střed zc, dno drážky, převis, …). */
  function profil(p) {
    const k = p.kolo, R = k.prumer / 2, W = k.sirka, zc = W / 2, c0 = Math.min(k.srazeni, W / 4), tg = Math.tan(rad(k.uhel / 2));
    const P = { R, W, zc, typ: k.profil, body: [] };
    /** Profil z funkce r(z) se zlomy zl; hrany čel sražené 45° o c. */
    const zFunkce = (f, zl, c) => {
      const b = [[f(c) - c, 0]];
      const z = [...new Set([c, W - c, ...zl.filter(x => x > c + 1e-6 && x < W - c - 1e-6)])].sort((a, b2) => a - b2);
      for (const x of z) b.push([f(x), x]);
      b.push([f(W - c) - c, W]);
      return b;
    };
    if (k.profil === 'plochy' || k.profil === 'oring') {
      P.body = [[R - c0, 0], [R, c0], [R, W - c0], [R - c0, W]];
      P.rDno = R; P.rMin = R - c0;
      if (k.profil === 'oring') {
        const d2 = k.oring, hg = 0.7 * d2, wg = 1.15 * d2, n = k.oringu, krok = W / n;
        P.drazky = [];
        const b = [[R - c0, 0], [R, c0]];
        for (let i = 0; i < n; i++) {
          const z0 = krok * (i + 0.5) - (wg + hg) / 2;   // drážka: dno wg, horní stěna sražená 45° (tisk bez podpor)
          P.drazky.push({ z0, z1: z0 + wg, rg: R - hg });
          b.push([R, z0], [R - hg, z0], [R - hg, z0 + wg], [R, z0 + wg + hg]);
        }
        b.push([R, W - c0], [R - c0, W]);
        P.body = b; P.rMin = Math.min(R - c0, R - hg); P.hg = hg; P.wg = wg;
      }
    } else if (k.profil === 'korunka') {
      const kk = Math.min(k.korunka, R / 3), f = z => R - kk * Math.pow(2 * (z - zc) / W, 2);
      const zl = []; for (let i = 0; i <= 20; i++) zl.push(W * i / 20);
      P.body = zFunkce(f, zl, c0); P.rMin = f(0) - c0; P.rDno = R;
      P.rKor = (W / 2) * (W / 2) / (2 * Math.max(kk, 1e-6)) + kk / 2;   // poloměr korunky napříč
    } else if (k.profil === 'vhrot') {
      const h = Math.min(k.hloubka, R * 0.6), s = k.spicka, rr = R - h;
      const f = z => Math.max(rr, R - Math.max(0, Math.abs(z - zc) - s / 2) / tg);
      const wb = s + 2 * h * tg;
      P.body = zFunkce(f, [zc - wb / 2, zc - s / 2, zc + s / 2, zc + wb / 2], Math.min(c0, Math.max(0, (W - wb) / 2)));
      P.rMin = Math.min(...P.body.map(b => b[0])); P.rDno = rr; P.h = h; P.wb = wb;
      P.rKontakt = R - h / 2; P.lBok = h / Math.cos(rad(k.uhel / 2));
    } else if (k.profil === 'vdrazka') {
      const h = Math.min(k.hloubka, R * 0.6), s = k.spicka, rg = R - h;
      const f = z => Math.min(R, rg + Math.max(0, Math.abs(z - zc) - s / 2) / tg);
      const wb = s + 2 * h * tg;
      P.body = zFunkce(f, [zc - wb / 2, zc - s / 2, zc + s / 2, zc + wb / 2], Math.min(c0, Math.max(0, (W - wb) / 2)));
      P.rMin = Math.min(...P.body.map(b => b[0]), rg); P.rDno = rg; P.h = h; P.wb = wb;
      P.rKontakt = rg + h / 2; P.lBok = h / Math.cos(rad(k.uhel / 2));
    } else if (k.profil === 'u') {
      const ru = k.trubka / 2 + k.vuleU, h = Math.min(k.hloubka, ru, R * 0.6), rb = R - h;
      const pol = Math.sqrt(Math.max(0, ru * ru - (ru - h) * (ru - h)));   // polovina šířky drážky na obvodu
      const f = z => (Math.abs(z - zc) >= pol ? R : rb + ru - Math.sqrt(Math.max(0, ru * ru - (z - zc) * (z - zc))));
      const zl = [zc - pol, zc + pol]; for (let i = 0; i <= 24; i++) zl.push(zc - pol + 2 * pol * i / 24);
      P.body = zFunkce(f, zl, Math.min(c0, Math.max(0, W / 2 - pol)));
      P.rMin = Math.min(...P.body.map(b => b[0]), rb); P.rDno = rb; P.h = h; P.ru = ru; P.wb = 2 * pol;
    } else if (k.profil === 'tpu') {
      // jádro: spodní lem, kanál pro běhoun, horní lem se spodkem sraženým 45°; běhoun = samostatný díl
      const t = Math.min(k.tpu, R * 0.4), Rc = R - t, Rf = Math.min(Rc + k.lem, R - 0.5), f0 = Math.max(1, Math.min(1.6, W * 0.12));
      const ztop = W - f0, z1 = ztop - (Rf - Rc), c1 = Math.min(c0, f0 / 2);
      P.body = [[Rf - c1, 0], [Rf, c1], [Rf, f0], [Rc, f0], [Rc, z1], [Rf, ztop], [Rf, W - c1], [Rf - c1, W]];
      P.rMin = Rc; P.rDno = Rc; P.Rc = Rc; P.Rf = Rf; P.f0 = f0; P.z1 = z1; P.ztop = ztop; P.t = t;
      const pr = k.tpuPresah / 2, cb = Math.min(0.8, (ztop - f0) / 4);
      P.behoun = [[Rc - pr, f0], [R - cb, f0], [R, f0 + cb], [R, ztop - cb], [R - cb, ztop], [Rf - pr, ztop], [Rc - pr, z1]];
      P.sirkaBehounu = ztop - f0;
    }
    P.previs = previsProfilu(P.body);
    return P;
  }
  /** Největší převis (° od svislice) vnějšího profilu tištěného čelem dolů; obraceně = vzhůru nohama. */
  function previsProfilu(b, obraceně) {
    let m = 0;
    for (let i = 1; i < b.length; i++) {
      let [r1, z1] = b[i - 1], [r2, z2] = b[i];
      if (obraceně) { z1 = -z1; z2 = -z2; }
      const dz = z2 - z1, dr = r2 - r1;
      if (Math.abs(dz) < 1e-9 && Math.abs(dr) < 1e-9) continue;
      // úsek, kde se poloměr s výškou zvětšuje = povrch hledí dolů
      if (dz > 1e-9 && dr > 1e-9) m = Math.max(m, deg(Math.atan2(dr, dz)));
      if (dz < -1e-9 && dr < -1e-9) m = Math.max(m, deg(Math.atan2(-dr, -dz)));
      if (Math.abs(dz) <= 1e-9 && r2 > r1 && i > 0) { /* vodorovný schod – řeší se u kanálu TPU zvlášť */ }
    }
    return m;
  }
  /** Část profilu v intervalu z ∈ [za, zb] (s dopočtenými body na hranicích). */
  function vyrez(b, za, zb) {
    const out = [], r = z => { for (let i = 1; i < b.length; i++) { const [r1, z1] = b[i - 1], [r2, z2] = b[i]; if (z >= z1 - 1e-9 && z <= z2 + 1e-9 && z2 > z1) return r1 + (r2 - r1) * (z - z1) / (z2 - z1); } return b[b.length - 1][0]; };
    out.push([r(za), za]);
    for (const q of b) if (q[1] > za + 1e-9 && q[1] < zb - 1e-9) out.push(q);
    out.push([r(zb), zb]);
    return out;
  }

  /** Všechny odvozené rozměry. o.chyba = proč nejde sestavit. */
  function odvozene(p) {
    const k = p.kolo, u = p.ulozeni, dz = p.drzak, o = { chyba: null };
    const P = o.prof = profil(p);
    o.R = P.R; o.W = k.sirka; o.zc = P.zc;
    // dělení na poloviny
    o.konkavni = k.profil === 'vdrazka' || k.profil === 'u';
    const lzeDelit = k.profil === 'vhrot' || o.konkavni;
    o.deleni = !lzeDelit ? 'cele' : k.deleni === 'auto' ? (P.previs > p.tisk.uhel + 0.5 ? 'pulky' : 'cele') : k.deleni;
    o.previsCele = P.previs;
    // uložení
    o.L = u.typ === 'lozisko' ? lozisko(p) : null;
    if (u.typ === 'lozisko') {
      const L = o.L;
      o.osa = L.d; o.rp = (L.D + u.vule) / 2; o.B = L.B; o.pocet = u.pocet;
      o.rr = L.D / 2 - u.osazeni;                         // otvor osazení (podpírá jen vnější kroužek)
      o.rVnitrni = L.d / 2 + (L.D - L.d) * 0.25;          // přibližný vnější průměr vnitřního kroužku / 2
      o.hrbet = u.pocet === 2 ? k.sirka - 2 * L.B : k.sirka - L.B;   // osazení mezi ložisky (tloušťka)
      o.rSedlo = o.rp;
    } else {
      o.osa = u.osa; o.rb = (u.osa + u.vuleOsy) / 2; o.rSedlo = o.rb; o.hrbet = k.sirka;
      if (u.typ === 'hridel') o.plocha = u.plocha + u.vuleOsy / 2;   // přes plošku včetně poloviny vůle
    }
    o.M = sroubNa(o.osa);
    o.Ms = o.M ? SROUBY[o.M] : null;
    o.rOsa = (o.osa + 0.3) / 2;   // díra pro osu v držáku
    // vnitřek kola: kde jsou kapsy ložisek a jak se tisknou (můstková vrstva nad kapsou otevřenou na podložku)
    o.kapsy = [];
    if (u.typ === 'lozisko') {
      if (u.pocet === 2) o.kapsy.push({ z0: 0, z1: o.B, dole: true }, { z0: k.sirka - o.B, z1: k.sirka, dole: false });
      else o.kapsy.push({ z0: k.sirka - o.B, z1: k.sirka, dole: false });
    }
    // poloviny: zc dělicí rovina; tisková poloha polovin
    o.zs = o.zc;
    o.mostky = [];   // {c, s} – strop kapsy v z = c, materiál na straně s
    if (o.deleni === 'cele') { for (const q of o.kapsy) if (q.dole) o.mostky.push({ c: q.z1, s: 1 }); }
    else if (o.konkavni) { for (const q of o.kapsy) o.mostky.push(q.dole ? { c: q.z1, s: 1 } : { c: q.z0, s: -1 }); }
    // stěna náboje a kola
    o.rNabojMax = u.typ === 'lozisko' ? o.rp : o.rb;
    // nejmenší poloměr běhounu mimo sražení hran čel (sražení je jen na okraji, kde je i sražené ústí kapsy)
    const rVnitr = P.body.length > 2 ? Math.min(...P.body.slice(1, -1).map(b => b[0])) : P.rMin;
    o.stenaKola = rVnitr - o.rNabojMax;
    if (k.profil === 'tpu') o.stenaKola = P.Rc - o.rNabojMax;
    if (k.profil === 'oring') o.stenaKola = Math.min(P.R - P.hg, P.R - k.srazeni) - o.rNabojMax;
    // šrouby / kolíky spojující poloviny
    o.spoj = o.deleni === 'pulky' ? (k.spoj === 'srouby' && o.konkavni ? 'lepeni' : k.spoj) : null;
    if (o.spoj === 'srouby' || o.spoj === 'lepeni') {
      const S = SROUBY[k.sroub], rd = o.spoj === 'srouby' ? (S.d + 0.3) / 2 : 0.95, rh = o.spoj === 'srouby' ? Math.max(S.dk, S.s * 1.155) / 2 + 0.3 : rd;
      o.rSpoj = (o.rNabojMax + 0.8 + rh + P.rMin - 1 - rh) / 2;
      o.spojRd = rd; o.spojRh = rh; o.spojS = S;
      o.spojMisto = (P.rMin - 1 - rh) - (o.rNabojMax + 0.8 + rh);   // ≥ 0 = vejde se
    }
    // odlehčení (jen celé kolo): vybrání z horního čela mezi nábojem a věncem
    if (k.odlehceni && o.deleni === 'cele') {
      const r1 = o.rNabojMax + 2.4, r2 = (k.profil === 'tpu' ? P.Rc : P.rMin) - 2.4, hl = k.sirka - k.disk;
      const dolniKapsa = o.kapsy.length ? Math.max(...o.kapsy.filter(q => q.dole).map(q => q.z1), 0) : 0;
      o.odlehceni = r2 - r1 > 3 && hl > 0.8 ? { r1, r2, z: k.sirka - hl, hl, dolniKapsa } : null;
    }
    // distance (vidlice, otočná vidlice)
    o.distD = u.typ === 'lozisko' ? Math.max(o.osa + 1.6, Math.min(2 * o.rVnitrni, o.osa + 4)) : o.osa * 2;
    // držák
    const R = o.R, W = k.sirka;
    o.mezera = dz.mezera;
    if (dz.typ === 'vidlice' || dz.typ === 'otocna') {
      o.xi = W / 2 + dz.mezera; o.xo = o.xi + dz.tloustka;
      o.w = dz.sirka > 0 ? dz.sirka : Math.max(2 * o.rOsa + 2 * Math.max(3, dz.tloustka), (p.excentr.pouzit ? p.excentr.prumer + 6 : 0), 12);
      o.zA = R;
      o.yA = dz.typ === 'otocna' ? -dz.zavlek : 0;
      if (dz.typ === 'vidlice') {
        o.zPB = 2 * R + dz.volno; o.zPT = o.zPB + dz.deska;
      } else {
        const C = SROUBY[dz.cep];
        o.cep = C;
        // pod talířem je samojistná matice čepu – nad kolem musí zbýt místo
        const zKolo = Math.abs(dz.zavlek) < R + C.s / 2 ? R + Math.sqrt(Math.max(0, R * R - Math.max(0, Math.abs(dz.zavlek) - C.s / 2) ** 2)) : 0;
        o.zDB = Math.max(2 * R + dz.volno, zKolo + C.mn + 1);
        o.tTal = Math.max(4, dz.tloustka);
        o.zDT = o.zDB + o.tTal;
        o.rTal = Math.max(Math.min(dz.a, dz.b) / 2 * 0.85, o.xo + 1, C.Dp / 2 + 1);
        o.zPB = o.zDT + C.tp; o.zPT = o.zPB + dz.deska;
      }
      o.vyska = o.zPT;
      o.g = Math.max(0, Math.min(4, dz.volno + dz.mezera - 0.6, o.w / 2));   // výztuha v koutě nohy a desky
    }
    if (dz.typ === 'uchyt') {
      o.tp = dz.deska; o.hn = dz.naboj;
      o.rNab = u.typ === 'lozisko' ? Math.max(o.rOsa + 1.2, Math.min(o.rVnitrni, o.rOsa + 3)) : Math.max(o.rOsa + 1.5, o.osa);
    }
    // osa – šroub a jeho délka
    if (dz.typ === 'vidlice' || dz.typ === 'otocna') o.lOsy = W + 2 * dz.mezera + 2 * dz.tloustka + (o.Ms ? o.Ms.mn : 0) + 2;
    else if (dz.typ === 'uchyt') o.lOsy = W + dz.naboj + dz.deska + (o.Ms ? o.Ms.tp : 0) - 0.5;   // matice je zapuštěná v desce
    else o.lOsy = W + 2 * dz.mezera + (o.Ms ? o.Ms.mn : 0) + 2;
    o.lSroubu = delkaSroubu(o.lOsy);
    o.tiskKolo = o.deleni === 'pulky' ? (k.profil === 'vhrot' ? 'pulky stykem dolů' : 'pulky čelem dolů') : 'čelem dolů';
    return o;
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), k = p.kolo, u = p.ulozeni, dz = p.drzak, P = o.prof;
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = (c, h, d = 1) => ({ zmeny: { [c]: Math.round(h * 10 ** d) / 10 ** d } });
    const W = k.sirka, R = o.R;
    // ložisko
    if (u.typ === 'lozisko') {
      const L = o.L;
      if (u.lozisko === 'vlastni' && L.d >= L.D - 1) chyba(['ulozeni.d', 'ulozeni.D'], `Vlastní ložisko: vnitřní Ø ${fmt(L.d)} musí být menší než vnější Ø ${fmt(L.D)}.`);
      const potrebaW = u.pocet * L.B + (u.pocet === 2 ? 0.8 : 0);
      if (W < potrebaW - 1e-9) chyba(['kolo.sirka', 'ulozeni.pocet'], `Kolo široké ${fmt(W)} mm se na ${u.pocet === 2 ? 'dvě ložiska' : 'ložisko'} ${L.o} (šířka ${fmt(L.B)}) nevejde – potřeba aspoň ${fmt(potrebaW, 1)} mm${u.pocet === 2 ? ' včetně osazení 0,8 mm mezi nimi' : ''}.`,
        u.pocet === 2 && W >= L.B ? { zmeny: { 'ulozeni.pocet': 1 } } : opr('kolo.sirka', Math.ceil(potrebaW * 2) / 2));
      if (u.osazeni > (L.D - L.d) / 4 + 1e-9) chyba(['ulozeni.osazeni'], `Osazení ${fmt(u.osazeni, 1)} mm by se opřelo o vnitřní kroužek ložiska – nejvýš ${fmt((L.D - L.d) / 4, 1)} mm, jinak kolo brzdí.`, opr('ulozeni.osazeni', Math.floor((L.D - L.d) / 4 * 10) / 10));
      if (o.mostky.length && o.hrbet / (u.pocet === 2 && o.deleni === 'pulky' ? 2 : 1) < 2 * p.tisk.vrstva + 0.4 && p.tisk.mostek === 'mustkova')
        var_(['kolo.sirka', 'tisk.mostek'], `Mezi ložisky je jen ${fmt(o.hrbet, 1)} mm – můstková vrstva (2 × ${fmt(p.tisk.vrstva, 2)} mm) se do osazení sotva vejde. Rozšiřte kolo nebo použijte obětovanou vrstvu.`, { zmeny: { 'tisk.mostek': 'obetovana' } });
      if (u.pocet === 1 && W > L.B * 1.8) info(['ulozeni.pocet'], `Jedno ložisko v kole širokém ${fmt(W)} mm – kolo se na ose může viklat. Pro vozík jsou lepší dvě ložiska.`);
      if (u.vule < -0.1) var_(['ulozeni.vule'], `Přesah ${fmt(-u.vule, 2)} mm na průměr je u tištěného dílu velký – kolo může prasknout. Vyzkoušejte kalibrační vzorek.`);
      if (u.vule > 0.3) var_(['ulozeni.vule'], `Vůle ${fmt(u.vule, 2)} mm – ložisko bude v kole volně, bude potřeba lepidlo. Vyzkoušejte kalibrační vzorek.`);
      if (o.deleni === 'cele' && u.pocet === 2) info(['tisk.mostek'], p.tisk.mostek === 'mustkova'
        ? `Strop spodní kapsy ložiska se tiskne přes můstkovou vrstvu (2 × ${fmt(p.tisk.vrstva, 2)} mm) – výšku vrstvy nastavte stejnou jako ve sliceru.`
        : `Nad spodní kapsou ložiska je obětovaná vrstva ${fmt(p.tisk.vrstva, 2)} mm – po tisku ji propíchněte vrtákem.`);
    } else {
      if (u.typ === 'hridel' && u.plocha >= u.osa) chyba(['ulozeni.plocha'], `Rozměr přes plošku ${fmt(u.plocha, 2)} mm musí být menší než průměr hřídele ${fmt(u.osa, 2)} mm.`, opr('ulozeni.plocha', u.osa * 0.83, 2));
      if (u.typ === 'kluzne') info(['ulozeni.vuleOsy'], `Kluzné uložení: díra Ø ${fmt(2 * o.rb, 2)} mm na osu Ø ${fmt(u.osa)} – namazat, hodí se pro pomalé a lehké pojezdy (únosnost a pv v záložce Mechanika).`);
      if (u.typ === 'kluzne' && u.vuleOsy < 0.15) var_(['ulozeni.vuleOsy'], `Vůle ${fmt(u.vuleOsy, 2)} mm je na kluzné uložení malá – tištěná díra bývá menší, kolo se zadře. Doporučeno 0,2–0,4 mm.`, opr('ulozeni.vuleOsy', 0.3, 2));
    }
    // stěna kola
    if (o.stenaKola < 1.2) chyba(['kolo.prumer', 'ulozeni.lozisko', k.profil === 'tpu' ? 'kolo.tpu' : 'kolo.hloubka'], `Mezi ${u.typ === 'lozisko' ? 'ložiskem' : 'otvorem'} a ${k.profil === 'tpu' ? 'kanálem běhounu' : 'dnem profilu'} zbývá jen ${fmt(o.stenaKola, 2)} mm – zvětšete kolo${o.prof.h ? ' nebo zmenšete hloubku profilu' : ''} (aspoň 1,2 mm, lépe 2 mm).`,
      opr('kolo.prumer', Math.ceil(2 * (o.rNabojMax + 2 + (R - (k.profil === 'tpu' ? P.Rc : P.rMin))))));
    else if (o.stenaKola < 1.6 - 1e-6) var_(['kolo.prumer'], `Stěna mezi ${u.typ === 'lozisko' ? 'ložiskem' : 'otvorem'} a běhounem má ${fmt(o.stenaKola, 2)} mm – při lisování může prasknout. Doporučeno aspoň 1,6 mm (4 perimetry), lépe 2 mm.`);
    // profil
    if ((k.profil === 'vhrot' || k.profil === 'vdrazka') && P.wb > W + 1e-6) chyba(['kolo.hloubka', 'kolo.uhel', 'kolo.sirka'], `V ${k.profil === 'vhrot' ? 'hrot' : 'drážka'} je u základny široký ${fmt(P.wb, 1)} mm – víc než kolo (${fmt(W)} mm). Zmenšete hloubku nebo úhel, nebo kolo rozšiřte.`, opr('kolo.sirka', Math.ceil(P.wb + 1)));
    if (k.profil === 'u' && P.wb > W - 0.6) chyba(['kolo.trubka', 'kolo.hloubka', 'kolo.sirka'], `U drážka je na obvodu široká ${fmt(P.wb, 1)} mm – kolo (${fmt(W)} mm) musí být aspoň o 0,6 mm širší, jinak nemá boky.`, opr('kolo.sirka', Math.ceil(P.wb + 2)));
    if (k.profil === 'u' && k.hloubka > o.prof.ru + 1e-6) info(['kolo.hloubka'], `Hloubka drážky je omezena na poloměr drážky ${fmt(o.prof.ru, 1)} mm (půlkruh).`);
    if (k.profil === 'oring') {
      const pot = k.oringu * (P.wg + P.hg) + 2 * k.srazeni + (k.oringu - 1) * 1;
      if (pot > W) chyba(['kolo.sirka', 'kolo.oringu', 'kolo.oring'], `${k.oringu === 1 ? 'Drážka' : 'Drážky'} pro O-kroužek ${fmt(k.oring, 2)} mm se do šířky ${fmt(W)} mm nevejdou – potřeba ${fmt(pot, 1)} mm.`, opr('kolo.sirka', Math.ceil(pot)));
    }
    if (k.profil === 'tpu') {
      if (P.ztop - P.f0 < 2) chyba(['kolo.sirka', 'kolo.lem'], 'Na běhoun nezbývá šířka – rozšiřte kolo nebo zmenšete lem.');
      if (k.tpuPresah < 0.2) var_(['kolo.tpuPresah'], `Přesah běhounu ${fmt(k.tpuPresah, 2)} mm – běhoun se může na jádře protáčet. Doporučeno 0,4–1 mm na průměr.`, opr('kolo.tpuPresah', 0.6, 2));
      const nat = (P.Rf) / (P.Rc - k.tpuPresah / 2) - 1;
      if (nat > 0.25) var_(['kolo.lem', 'kolo.tpuPresah'], `Při navlékání přes lem se běhoun roztáhne o ${fmt(nat * 100, 0)} % – TPU 95A snese asi 25 % bez trvalé deformace. Zmenšete lem.`);
      info(['kolo.profil'], `Běhoun tiskněte z TPU (95A) zvlášť a za tepla (ponořený v horké vodě) přetáhněte přes horní lem jádra.`);
    }
    // tisk a dělení
    const pv = o.deleni === 'cele' ? o.previsCele : 0;
    if (o.deleni === 'cele' && pv > p.tisk.uhel + 0.5) {
      const lze = k.profil === 'vhrot' || o.konkavni;
      var_(['kolo.deleni', 'kolo.uhel'], `Profil běhounu převisá ${fmt(pv, 0)}° od svislice – víc než ${fmt(p.tisk.uhel)}°, které tiskárna zvládne.${lze ? ' Rozdělte kolo na dvě poloviny.' : ' Zmenšete sražení nebo korunku.'}`, lze ? { zmeny: { 'kolo.deleni': 'pulky' } } : undefined);
    }
    if (o.deleni === 'pulky') {
      if (k.spoj === 'srouby' && o.konkavni) info(['kolo.spoj'], 'Poloviny drážkového kola se tisknou vnějším čelem dolů, zápustné šrouby se do nich nedají vytisknout – použijí se kolíky z filamentu a lepidlo.');
      if (o.spoj && o.spojMisto < 0) chyba(['kolo.spoj', 'kolo.prumer', 'kolo.sroub'], `${o.spoj === 'srouby' ? 'Šrouby' : 'Kolíky'} spojující poloviny se mezi ${u.typ === 'lozisko' ? 'ložisko' : 'otvor'} a běhoun nevejdou – zvětšete kolo${o.spoj === 'srouby' ? ', zmenšete šroub' : ''} nebo nechte poloviny držet ložisky.`, { zmeny: { 'kolo.spoj': o.spoj === 'srouby' ? 'lepeni' : 'loziska' } });
      if (o.spoj === 'srouby') {
        const S = SROUBY[k.sroub];
        if (S.k + 1 > o.zs || S.m + 1 > W - o.zs) chyba(['kolo.sroub', 'kolo.sirka'], `Hlava a matice ${k.sroub} se do polovin šířky ${fmt(o.zs, 1)} mm nevejdou.`, { zmeny: { 'kolo.spoj': 'lepeni' } });
      }
      if (o.spoj === 'loziska' && u.typ !== 'lozisko') chyba(['kolo.spoj'], 'Bez ložisek poloviny nic nedrží – zvolte šrouby nebo lepení.', { zmeny: { 'kolo.spoj': 'lepeni' } });
      if (o.spoj === 'loziska' && u.pocet < 2) chyba(['kolo.spoj', 'ulozeni.pocet'], 'Poloviny drží ložiska jen se dvěma ložisky (každé v jedné polovině) – přidejte ložisko nebo zvolte lepení.', { zmeny: { 'ulozeni.pocet': 2 } });
      if (u.typ === 'lozisko' && u.pocet === 2 && o.B > o.zs + 1e-9) chyba(['kolo.sirka'], `Ložisko (${fmt(o.B)} mm) je širší než polovina kola (${fmt(o.zs, 1)} mm) – kolo rozšiřte.`, opr('kolo.sirka', Math.ceil(2 * o.B + 1)));
      if (o.spoj === 'loziska') info(['kolo.spoj'], 'Poloviny drží pohromadě ložiska sevřená na ose – nalisujte je pevně, pro jistotu kapka lepidla na styk.');
    }
    if (k.odlehceni && o.deleni === 'pulky') info(['kolo.odlehceni'], 'Odlehčení se dělá jen u celého kola (vybrání z horního čela).');
    if (k.odlehceni && o.deleni === 'cele' && !o.odlehceni) info(['kolo.odlehceni', 'kolo.disk'], 'Na odlehčení není místo – kolo je malé nebo disk široký jako kolo.');
    if (p.diry === 'kruh' && (dz.typ === 'vidlice' || dz.typ === 'otocna')) info([], 'Kruhové vodorovné díry mají převislý strop – tiskněte s podporami nebo zvolte kapku (👁 Zobrazení → 💧 Díry jako kapka).');
    if (p.tisk.uhel < 45) info(['tisk.uhel'], `Díly jsou navržené na převis 45° (sražení, výztuhy, kapkovité díry). Při ${fmt(p.tisk.uhel)}° může tisk potřebovat podpory – ukáže je tisková poloha.`);
    if (p.tisk.material === 'TPU') var_(['tisk.material'], 'Celé kolo z TPU se prohýbá a ložisko v něm nedrží – na měkký běhoun zvolte profil „nalisovaný běhoun z TPU“ a jádro z PETG.', { zmeny: { 'tisk.material': 'PETG' } });
    if (p.tisk.material === 'PLA') info(['tisk.material'], 'PLA pod trvalým zatížením teče (kolo se „zploští“ a ložisko povolí) – na kolečka je lepší PETG, PC nebo nylon.');
    // excentr
    const e = p.excentr;
    if (e.pouzit) {
      if (e.prumer < o.osa + 0.3 + 2 * e.e + 1.6) chyba(['excentr.prumer', 'excentr.e'], `Excentrická distance Ø ${fmt(e.prumer, 1)} je na osu Ø ${fmt(o.osa)} s výstředností ${fmt(e.e, 1)} mm malá – stěna by měla pod 0,8 mm.`,
        (() => { const d = Math.ceil((o.osa + 0.3 + 2 * e.e + 2) * 10) / 10; return { zmeny: { 'excentr.prumer': d, 'excentr.klic': Math.max(e.klic, Math.ceil(d + 3)) } }; })());
      if (e.klic < e.prumer + 1) chyba(['excentr.klic'], `Šestihran ${fmt(e.klic)} mm musí být větší než čep Ø ${fmt(e.prumer, 1)} mm.`, opr('excentr.klic', Math.ceil(e.prumer + 3)));
      if (dz.typ === 'otocna') info(['excentr.pouzit'], 'U otočné vidlice nemá excentr smysl – použijte ho u úchytu nebo pevné vidlice.');
      if ((dz.typ === 'vidlice' || dz.typ === 'otocna' || dz.typ === 'zadny') && dz.mezera < 3) var_(['drzak.mezera', 'excentr.pouzit'], `Šestihran excentru je dlouhý jako mezera mezi kolem a ${dz.typ === 'zadny' ? 'deskou' : 'nohou'} (${fmt(dz.mezera, 1)} mm) – na klíč aspoň 3 mm.`, opr('drzak.mezera', 3));
      if (u.typ === 'lozisko' && e.klic / 2 > o.rVnitrni + 0.6 && dz.typ !== 'zadny') info(['excentr.klic'], `Šestihran excentru (${fmt(e.klic)} mm) přesahuje vnitřní kroužek ložiska – kolo se o něj může otírat; mezera to musí pokrýt.`);
    }
    // držák
    if (dz.typ === 'vidlice' || dz.typ === 'otocna') {
      const sirkaVid = 2 * o.xo;
      // nová deska i s děrami: rozteč tak, aby díry nebyly u okraje ani v nohou
      const deska = (c, cr, rozm) => ({ zmeny: { [c]: rozm, [cr]: Math.max(0, Math.floor(rozm - (dz.dira > 0 ? dz.dira : 0) - 4)) } });
      if (dz.typ === 'vidlice' && dz.a < sirkaVid) chyba(['drzak.a'], `Deska (${fmt(dz.a)} mm) je užší než vidlice (${fmt(sirkaVid, 1)} mm).`, deska('drzak.a', 'drzak.roztecX', Math.ceil(Math.max(sirkaVid + 4, 2 * o.xo + 2 * dz.dira + 7))));
      if (dz.typ === 'vidlice' && dz.b < o.w) chyba(['drzak.b', 'drzak.sirka'], `Deska (${fmt(dz.b)} mm) je kratší než šířka nohou vidlice (${fmt(o.w, 1)} mm).`, deska('drzak.b', 'drzak.roztecY', Math.ceil(o.w + 4)));
      for (const [c, rz, roz] of [['drzak.roztecX', dz.a, dz.roztecX], ['drzak.roztecY', dz.b, dz.roztecY]])
        if (dz.dira > 0 && roz / 2 + dz.dira / 2 > rz / 2 - 1.5) chyba([c], `Díry desky (rozteč ${fmt(roz)} mm) jsou moc blízko okraje desky ${fmt(rz)} mm.`, opr(c, Math.max(0, Math.floor(rz - dz.dira - 4))));
      if (dz.typ === 'vidlice' && dz.dira > 0 && dz.roztecX / 2 - dz.dira / 2 < o.xo + 0.5 && dz.roztecY / 2 - dz.dira / 2 < o.w / 2 + 0.5)
        chyba(['drzak.roztecX', 'drzak.roztecY'], 'Díry desky padnou do nohou vidlice – zvětšete rozteč.', opr('drzak.roztecX', Math.ceil(2 * (o.xo + dz.dira / 2 + 1.5))));
      if (dz.typ === 'otocna') {
        const C = o.cep;
        if (dz.deska < C.kz + 1.5) chyba(['drzak.deska', 'drzak.cep'], `Zápustná hlava čepu ${dz.cep} (${fmt(C.kz, 1)} mm) se do desky ${fmt(dz.deska, 1)} mm nevejde.`, opr('drzak.deska', Math.ceil(C.kz + 2)));
        if (Math.abs(dz.zavlek) < o.w / 2 + C.s * 0.58 + 0.5 && C.s * 1.16 / 2 > o.xi - 0.3) chyba(['drzak.cep', 'drzak.mezera'], `Matice čepu ${dz.cep} (s ${fmt(C.s)}) se mezi nohy vidlice nevejde.`, { zmeny: { 'drzak.cep': 'M6' } });
        if (dz.dira > 0 && Math.hypot(dz.roztecX, dz.roztecY) / 2 - dz.dira / 2 < C.dk / 2 + 1) chyba(['drzak.roztecX', 'drzak.roztecY'], 'Díry desky jsou moc blízko čepu.');
        if (dz.zavlek < R * 0.15) info(['drzak.zavlek'], `Závlek ${fmt(dz.zavlek)} mm je malý – kolečko se za jízdou nestočí samo. Obvykle 0,2–0,4 × průměr (${fmt(R * 0.4, 0)}–${fmt(R * 0.8, 0)} mm).`);
        if (Math.hypot(Math.abs(dz.zavlek) + R, o.xo) > Math.hypot(dz.a, dz.b) / 2 + R) info(['drzak.zavlek'], 'Kolo se při otáčení vytočí daleko za desku – počítejte s místem kolem.');
        info(['drzak.cep'], `Čep ${dz.cep}: zápustný šroub z horní strany desky, pod talířem samojistná matice – utáhnout jen tak, aby se vidlice volně otáčela. Mezi desku a talíř velká podložka ${dz.cep} (namazat).`);
      }
      if (dz.tloustka < 3) var_(['drzak.tloustka'], `Noha vidlice ${fmt(dz.tloustka, 1)} mm je tenká – v díře osy se plast otlačí.`, opr('drzak.tloustka', 4));
    }
    if (dz.typ === 'uchyt') {
      const S = o.Ms;
      if (dz.der > 0 && dz.roztec * (dz.der - 1) / 2 + dz.dira * (dz.zapustne ? 1 : 0.5) + 1.5 > dz.delka / 2) chyba(['drzak.roztec', 'drzak.delka'], `Díry s roztečí ${fmt(dz.roztec)} mm se na úchyt délky ${fmt(dz.delka)} mm nevejdou.`, opr('drzak.delka', Math.ceil(dz.roztec * (dz.der - 1) + 2 * dz.dira + 6)));
      if (dz.der > 1 && dz.roztec < dz.dira * 2 + 1) chyba(['drzak.roztec'], 'Díry úchytu se překrývají – zvětšete rozteč.', opr('drzak.roztec', Math.ceil(dz.dira * 2 + 3)));
      const rNab = p.excentr.pouzit ? p.excentr.prumer / 2 + 2 : o.rNab;
      for (let i = 0; i < dz.der; i++) {
        const x = (i - (dz.der - 1) / 2) * dz.roztec;
        if (Math.hypot(x - dz.osaX, dz.osaY) < rNab + dz.dira * (dz.zapustne ? 1 : 0.5) + 1) { chyba(['drzak.osaY', 'drzak.roztec'], 'Díra pro vrut padne do náboje osy – posuňte osu kola nebo změňte rozteč děr.'); break; }
      }
      if (dz.matice && S && dz.deska < S.m + 2 * p.tisk.vrstva + 1) chyba(['drzak.deska', 'drzak.matice'], `Do desky ${fmt(dz.deska, 1)} mm se matice osy ${o.M} (${fmt(S.m, 1)} mm) se stropem nevejde.`, opr('drzak.deska', Math.ceil((S.m + 2 * p.tisk.vrstva + 1.2) * 2) / 2));
      if (dz.matice && !S) info(['drzak.matice'], `Osa Ø ${fmt(o.osa)} nemá metrický šroub v tabulce – kapsa matice se nedělá.`);
      if (dz.deska < 3) var_(['drzak.deska'], 'Deska úchytu je tenká – vruty ji mohou protrhnout.');
      if (dz.naboj < 0.8 && !p.excentr.pouzit) var_(['drzak.naboj'], `Kolo bude jen ${fmt(dz.naboj, 1)} mm od desky – může se o ni otírat.`, opr('drzak.naboj', 1.5));
      // vyčnívá kolo pod hranu desky?
      const spodek = dz.osaY - R, hrana = -dz.vyska / 2;
      if (spodek > hrana) info(['drzak.osaY'], `Kolo nevyčnívá pod spodní hranu úchytu (o ${fmt(spodek - hrana, 1)} mm výš) – u šuplíku posuňte osu níž.`);
    }
    if (dz.typ === 'zadny' && !p.excentr.pouzit) info(['drzak.typ'], 'Bez držáku: kolo se nasadí na vlastní osu (šroub, čep) – distance a šroub jsou v kusovníku.');
    for (const h of H) if (h.oprava && !h.oprava.text) h.oprava.text = textOpravy(h.oprava.zmeny);
    return H;
  }
  const POPISKY = {
    'kolo.sirka': h => `šířka kola ${fmt(h, 1)} mm`, 'kolo.prumer': h => `průměr kola ${fmt(h, 1)} mm`, 'kolo.deleni': h => NAZVY.deleni[h],
    'kolo.spoj': h => NAZVY.spoj[h], 'kolo.tpuPresah': h => `přesah běhounu ${fmt(h, 2)} mm`,
    'ulozeni.pocet': h => `${h} ložisko`, 'ulozeni.osazeni': h => `osazení ${fmt(h, 1)} mm`, 'ulozeni.vuleOsy': h => `vůle ${fmt(h, 2)} mm`, 'ulozeni.plocha': h => `přes plošku ${fmt(h, 2)} mm`,
    'excentr.prumer': h => `čep excentru Ø ${fmt(h, 1)} mm`, 'excentr.klic': h => `šestihran ${fmt(h)} mm`,
    'drzak.a': h => `deska ${fmt(h)} mm`, 'drzak.b': h => `deska ${fmt(h)} mm`, 'drzak.roztecX': h => `rozteč ${fmt(h)} mm`, 'drzak.roztecY': h => `rozteč ${fmt(h)} mm`,
    'drzak.deska': h => `deska ${fmt(h, 1)} mm`, 'drzak.cep': h => `čep ${h}`, 'drzak.tloustka': h => `noha ${fmt(h, 1)} mm`, 'drzak.delka': h => `délka úchytu ${fmt(h)} mm`,
    'drzak.roztec': h => `rozteč děr ${fmt(h)} mm`, 'drzak.naboj': h => `náboj ${fmt(h, 1)} mm`, 'drzak.mezera': h => `mezera ${fmt(h, 1)} mm`,
    'tisk.mostek': h => NAZVY.mostek[h], 'tisk.material': h => `materiál ${MATERIALY[h].nazev}`,
  };
  const textOpravy = zmeny => Object.entries(zmeny).map(([c, h]) => (POPISKY[c] ? POPISKY[c](h) : `${c} ${h}`)).join(', ');

  /* ---------------- geometrie ---------------- */
  /** Zaoblený obdélník [x0, y0, x1, y1] s poloměrem r jako body mnohoúhelníku. */
  function obdelnik(x0, y0, x1, y1, r) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01));
    if (r < 0.05) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const b = [], st = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
    for (const [cx, cy, a0] of st) for (let j = 0; j <= 6; j++) { const a = rad(a0 + 15 * j); b.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return b;
  }
  /** Konvexní obálka 2D bodů. */
  function obalka2(b) {
    const q = b.slice().sort((a, c) => a[0] - c[0] || a[1] - c[1]), x = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
    const d = [], h = [];
    for (const t of q) { while (d.length >= 2 && x(d[d.length - 2], d[d.length - 1], t) <= 0) d.pop(); d.push(t); }
    for (const t of q.reverse()) { while (h.length >= 2 && x(h[h.length - 2], h[h.length - 1], t) <= 0) h.pop(); h.push(t); }
    return d.slice(0, -1).concat(h.slice(0, -1));
  }
  const kruh = (r, cx = 0, cy = 0, n) => { const m = n || segmenty(r), b = []; for (let i = 0; i < m; i++) { const a = 2 * Math.PI * i / m; b.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return b; };
  /** Otáčení souřadnic: f(x, y, z) → [x', y', z'] aplikované na síť. */
  function preved(d, f) {
    const P = d.poz, out = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) { const q = f(P[i], P[i + 1], P[i + 2]); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; }
    return Object.assign({}, d, { poz: out });
  }

  /** Sestaví díly přes manifold-3d → {dily (k tisku, montážní poloha + otocit), sestava (náhled), kalibrace, o, cas}. */
  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p), k = p.kolo, u = p.ulozeni, dz = p.drzak, P = o.prof, ex = p.excentr;
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const km = x => { smaz.push(x); return x; };
    const W = k.sirka, R = o.R;
    const N = segmenty(R);
    const otoc = (body, n = N) => km(km(new CS([body], 'NonZero')).revolve(n));
    /** Díra: poloměr korigovaný na vepsaný mnohoúhelník (plošky leží na jmenovitém průměru). */
    const valec = (r, z0, z1, x = 0, y = 0, n, presne) => { const m = n || segmenty(r), rr = presne ? r : r / Math.cos(Math.PI / m); return km(km(M.cylinder(z1 - z0, rr, rr, m)).translate([x, y, z0])); };
    const hranol = (body, z0, z1) => km(km(km(new CS([body], 'NonZero')).extrude(z1 - z0)).translate([0, 0, z0]));
    const kvadr = (x0, y0, z0, x1, y1, z1) => km(km(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const sestihran = (s, z0, z1, x = 0, y = 0, a0 = 0) => { const R6 = s / S3, b = []; for (let i = 0; i < 6; i++) { const a = a0 + i * Math.PI / 3; b.push([x + R6 * Math.cos(a), y + R6 * Math.sin(a)]); } return hranol(b, z0, z1); };
    /** Strop kapsy v rovině z = c (materiál na straně s) s otvorem poloměru rh: můstková / obětovaná vrstva.
        kapsa = funkce (z0, z1) → těleso kapsy (průřez), vrací konec otvoru (kde začíná kruhová díra). */
    const t = p.tisk.vrstva;
    function strop(odeb, kapsa, c, s, rh, x = 0, y = 0) {
      if (p.tisk.mostek === 'obetovana') return c + s * t;
      const z = (a, b) => [Math.min(a, b), Math.max(a, b)];
      const [a1, b1] = z(c - s * 0.01, c + s * t);
      odeb.push(km(kapsa(a1, b1).intersect(kvadr(x - 500, y - rh, a1 - 1, x + 500, y + rh, b1 + 1))));
      const [a2, b2] = z(c + s * (t - 0.01), c + s * 2 * t);
      odeb.push(kvadr(x - rh, y - rh, a2, x + rh, y + rh, b2));
      return c + s * (2 * t - 0.01);
    }

    try {
      /* ---------- kolo (souřadnice kola, osa Z) ---------- */
      const teloBody = [[0, 0], ...P.body, [0, W]];
      let telo = otoc(teloBody);
      const odeb = [];
      const Np = r => segmenty(r);
      if (u.typ === 'lozisko') {
        const rp = o.rp, kor = rp / Math.cos(Math.PI / Np(rp));
        const kapsa = (z0, z1) => valec(rp, z0, z1);
        let zDira0 = -1, zDira1 = W + 1;
        for (const q of o.kapsy) {
          // kapsa se sraženým ústím 0,4 mm (snáz se nasadí a nevadí rozplácnutá první vrstva)
          if (q.dole) { odeb.push(otoc([[0, -1], [kor + 1.4, -1], [kor, 0.4], [kor, q.z1], [0, q.z1]], Np(rp))); zDira0 = q.z1 - 0.01; }
          else { odeb.push(otoc([[0, q.z0], [kor, q.z0], [kor, W - 0.4], [kor + 1.4, W + 1], [0, W + 1]], Np(rp))); zDira1 = q.z0 + 0.01; }
        }
        for (const m of o.mostky) {
          const z = strop(odeb, kapsa, m.c, m.s, o.rr);
          if (m.s > 0) zDira0 = z; else zDira1 = z;
        }
        if (zDira1 > zDira0) odeb.push(valec(o.rr, zDira0, zDira1));
      } else {
        const rb = o.rb, kor = rb / Math.cos(Math.PI / Np(rb));
        odeb.push(otoc([[0, -1], [kor + 1.4, -1], [kor, 0.4], [kor, W - 0.4], [kor + 1.4, W + 1], [0, W + 1]], Np(rb)));
      }
      if (o.odlehceni) {
        const q = o.odlehceni;
        odeb.push(otoc([[q.r1, q.z], [q.r2, q.z], [q.r2, W + 1], [q.r1, W + 1]]));
      }
      // spoj polovin: šrouby (hlava v dolní, matice v horní polovině) nebo kolíky z filamentu
      if (o.deleni === 'pulky' && (o.spoj === 'srouby' || o.spoj === 'lepeni') && o.spojMisto >= 0) {
        const n = o.spoj === 'srouby' ? k.sroubu : 3, S = o.spojS;
        for (let i = 0; i < n; i++) {
          const a = 2 * Math.PI * i / n + Math.PI / 2, x = o.rSpoj * Math.cos(a), y = o.rSpoj * Math.sin(a);
          if (o.spoj === 'srouby') {
            odeb.push(valec(o.spojRd, -1, W + 1, x, y, 16));
            odeb.push(valec(S.dk / 2 + 0.2, -1, S.k + 0.2, x, y, 24));
            odeb.push(sestihran(S.s + 0.3, W - S.m - 0.3, W + 1, x, y, a));
          } else odeb.push(valec(0.95, o.zs - 3.5, o.zs + 3.5, x, y, 12));
        }
      }
      telo = km(M.difference([telo, ...odeb]));
      if (u.typ === 'hridel') {
        // ploška: vrátit materiál kruhové díry za rovinou x = plocha − r
        const rb = o.rb, xp = o.plocha - rb;
        telo = km(telo.add(km(valec(rb + 0.05, -0.5, W + 0.5, 0, 0, Np(rb)).intersect(kvadr(xp, -rb - 1, -1, rb + 2, rb + 1, W + 1)))));   // přes celý mnohoúhelník díry
        telo = km(telo.intersect(otoc(teloBody)));
      }
      const dily = [], sest = [];
      const yA = o.yA || 0;
      const ram = { kolo: (x, y, z) => [z - W / 2, x + yA, y + R] };   // souřadnice kola → sestava
      const barvaKola = '#2F5FA8', barvaDrz = '#E88A2E', barvaPris = '#7A8B99';
      if (o.deleni === 'pulky') {
        const box = (z0, z1) => kvadr(-R - 5, -R - 5, z0, R + 5, R + 5, z1);
        const dol = km(telo.intersect(box(-2, o.zs))), hor = km(telo.intersect(box(o.zs, W + 2)));
        const vh = k.profil === 'vhrot';
        dily.push(Object.assign(sit(km, dol, 'kolo_a', 'Kolo – dolní polovina', barvaKola), { otocit: vh, ram: ram.kolo }));
        dily.push(Object.assign(sit(km, hor, 'kolo_b', 'Kolo – horní polovina', barvaKola), { otocit: !vh, ram: ram.kolo }));
      } else dily.push(Object.assign(sit(km, telo, 'kolo', k.profil === 'tpu' ? 'Jádro kola' : 'Kolo', barvaKola), { ram: ram.kolo }));
      if (k.profil === 'tpu') {
        const beh = otoc(P.behoun);
        dily.push(Object.assign(sit(km, beh, 'behoun', 'Běhoun (TPU)', '#3A3A3A'), { ram: ram.kolo, material: 'TPU' }));
      }

      /* ---------- distance a excentr (v souřadnicích osy Z, pak do sestavy) ---------- */
      if (dz.typ === 'vidlice' || dz.typ === 'otocna' || dz.typ === 'zadny') {
        const ri = o.rOsa, ro = o.distD / 2, l = dz.mezera;
        const dist = () => km(M.difference([valec(ro, 0, l, 0, 0, 0, true), valec(ri, -1, l + 1)]));
        const pocetDist = ex.pouzit ? 1 : 2;
        for (let i = 0; i < pocetDist; i++) {
          const strana = i === 0 ? -1 : 1;
          // distance leží osou Z od z = 0 do l → v sestavě mezi čelem kola a nohou
          dily.push(Object.assign(sit(km, dist(), 'distance_' + (i + 1), 'Distance ' + (i + 1), barvaPris), { prisl: true,
            ram: (x, y, z) => [strana < 0 ? -W / 2 - l + z : W / 2 + z, x + yA, y + R] }));
        }
      }
      if (ex.pouzit) {
        // šestihranné tělo (délka = mezera / náboj) + čep do díry v držáku; otvor pro osu vyosený o e
        const L1 = dz.typ === 'uchyt' ? dz.naboj : dz.mezera;
        const L2 = Math.max(1, (dz.typ === 'uchyt' ? dz.deska : dz.typ === 'zadny' ? 4 : dz.tloustka) - 0.4);
        const telE = km(M.union([sestihran(ex.klic, 0, L1, -ex.e, 0), valec(ex.prumer / 2, L1 - 0.01, L1 + L2, -ex.e, 0, 0, true)]));
        const em = km(M.difference([telE, valec(o.rOsa, -1, L1 + L2 + 1)]));
        const exD = Object.assign(sit(km, em, 'excentr', 'Excentrická distance', '#2EAD5B'), { prisl: true });
        // v sestavě: tělo mezi kolem a nohou/deskou; u úchytu na straně desky (−x), jinak na +x
        if (dz.typ === 'uchyt') exD.ram = (x, y, z) => [-W / 2 - z, -x, y + R];
        else exD.ram = (x, y, z) => [W / 2 + z, -x + yA, y + R];
        dily.push(exD);
      }

      /* ---------- držák ---------- */
      if (dz.typ === 'vidlice' || dz.typ === 'otocna') {
        const zA = o.zA, yA = o.yA, w2 = o.w / 2, tl = dz.tloustka;
        const zTop = dz.typ === 'vidlice' ? o.zPB + 0.5 : o.zDB + 0.5;
        // noha: průřez v rovině (y, z) → CS (u = −z, v = y), vysunutí ve směru x
        const noha = (x0) => {
          const b = [];
          for (let i = 0; i <= 24; i++) { const a = Math.PI + Math.PI * i / 24; b.push([yA + w2 * Math.cos(a), zA + w2 * Math.sin(a)]); }
          b.push([yA + w2, zTop], [yA - w2, zTop]);
          return km(km(km(km(new CS([b.map(([y, z]) => [-z, y])], 'NonZero')).extrude(tl)).rotate([0, 90, 0])).translate([x0, 0, 0]));
        };
        const plne = [noha(o.xi), noha(-o.xo)];
        const odebD = [];
        // díry osy kapkovité se špičkou dolů (−z) – vidlice se tiskne vzhůru nohama, špička pak míří nahoru.
        // Průřez v (u = −z, v = y): špička ve směru +u. p.diry = 'kruh' → kruhová díra (strop převisá).
        const kruhova = p.diry === 'kruh';
        const diraK = (r, yc, zc, x0, x1) => {
          const b = []; const n = 32;
          if (kruhova) for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; b.push([-zc + r * Math.cos(a), yc + r * Math.sin(a)]); }
          else {
            for (let i = 0; i <= n; i++) { const a = rad(45 + 270 * i / n); b.push([-zc + r * Math.cos(a), yc + r * Math.sin(a)]); }
            b.push([-zc + r * Math.SQRT2, yc]);
          }
          return km(km(km(km(new CS([b], 'NonZero')).extrude(x1 - x0)).rotate([0, 90, 0])).translate([x0, 0, 0]));
        };
        if (ex.pouzit) {
          odebD.push(diraK(o.rOsa, yA, zA, -o.xo - 1, -o.xi + 1));
          odebD.push(diraK(ex.prumer / 2 + 0.15, yA + ex.e, zA, o.xi - 1, o.xo + 1));
        } else odebD.push(diraK(o.rOsa, yA, zA, -o.xo - 1, o.xo + 1));
        // výztuhy v koutě noha – deska (při tisku vzhůru nohama 45° nahoru)
        const g = o.g, zPB = dz.typ === 'vidlice' ? o.zPB : o.zDB;
        if (g > 0.8) for (const s of [1, -1]) {
          const tri = [[s * o.xi, zPB + 0.01], [s * o.xi, zPB - g], [s * (o.xi - g), zPB + 0.01]];
          plne.push(km(km(km(km(new CS([tri], 'NonZero')).extrude(o.w)).rotate([90, 0, 0])).translate([0, yA + w2, 0])));
        }
        if (dz.typ === 'vidlice') {
          plne.push(hranol(obdelnik(-dz.a / 2, -dz.b / 2, dz.a / 2, dz.b / 2, 3), o.zPB, o.zPT));
          if (dz.dira > 0) for (const sx of [-1, 1]) for (const sy of [-1, 1]) odebD.push(valec(dz.dira / 2, o.zPB - 1, o.zPT + 1, sx * dz.roztecX / 2, sy * dz.roztecY / 2, 24));
          const vid = km(M.difference([km(M.union(plne)), ...odebD]));
          dily.push(Object.assign(sit(km, vid, 'vidlice', 'Vidlice', barvaDrz), { otocit: true }));
        } else {
          // talíř: obálka kruhu kolem čepu a vršků nohou
          const C = o.cep;
          const tal = obalka2([...kruh(o.rTal, 0, 0, 64), [-o.xo, yA - w2], [o.xo, yA - w2], [-o.xo, yA + w2], [o.xo, yA + w2]]);
          plne.push(hranol(tal, o.zDB, o.zDT));
          odebD.push(valec(C.d / 2 + 0.25, o.zDB - 1, o.zDT + 1, 0, 0, 24));
          const vid = km(M.difference([km(M.union(plne)), ...odebD]));
          dily.push(Object.assign(sit(km, vid, 'vidlice', 'Otočná vidlice', barvaDrz), { otocit: true }));
          // deska: díry, čep se zápustnou hlavou (kužel 90° shora)
          const des = [hranol(obdelnik(-dz.a / 2, -dz.b / 2, dz.a / 2, dz.b / 2, 3), o.zPB, o.zPT)];
          const odd = [valec(C.d / 2 + 0.25, o.zPB - 1, o.zPT + 1, 0, 0, 24)];
          const rk = C.dk / 2 + 0.3;
          odd.push(otoc([[0, o.zPT - rk + C.d / 2], [C.d / 2 + 0.25, o.zPT - rk + C.d / 2 + 0.25], [rk, o.zPT], [rk + 1, o.zPT + 1], [0, o.zPT + 1]], 48));
          if (dz.dira > 0) for (const sx of [-1, 1]) for (const sy of [-1, 1]) odd.push(valec(dz.dira / 2, o.zPB - 1, o.zPT + 1, sx * dz.roztecX / 2, sy * dz.roztecY / 2, 24));
          const desM = km(M.difference([km(M.union(des)), ...odd]));
          dily.push(Object.assign(sit(km, desM, 'deska', 'Deska otočné vidlice', barvaDrz), { otocit: false }));
        }
      }
      if (dz.typ === 'uchyt') {
        // v souřadnicích úchytu: deska z ∈ [0, tp] (zadní strana na podložce), náboj nahoru v (osaX, osaY)
        const tp = dz.deska, hn = dz.naboj, ox = dz.osaX, oy = dz.osaY;
        const rN = ex.pouzit ? ex.prumer / 2 + 2 : o.rNab;
        const obr = obalka2([...obdelnik(-dz.delka / 2, -dz.vyska / 2, dz.delka / 2, dz.vyska / 2, 3), ...kruh(rN + 2.5, ox, oy, 48)]);
        const plne = [hranol(obr, 0, tp)];
        const odd = [];
        if (!ex.pouzit) plne.push(valec(rN, tp - 0.01, tp + hn, ox, oy, 0, true));
        for (let i = 0; i < dz.der; i++) {
          const x = (i - (dz.der - 1) / 2) * dz.roztec, rd = dz.dira / 2 + 0.15;
          odd.push(valec(rd, -1, tp + 1, x, 0, 24));
          if (dz.zapustne) odd.push(otoc([[0, tp - dz.dira / 2 - 0.2], [rd, tp - dz.dira / 2 - 0.2], [dz.dira + 0.2, tp], [dz.dira + 1.2, tp + 1], [0, tp + 1]], 32).translate([x, 0, 0]));
        }
        if (ex.pouzit) odd.push(valec(ex.prumer / 2 + 0.15, -1, tp + 1, ox + ex.e, oy, 32));
        else {
          let z0 = -1;
          const S = o.Ms;
          if (dz.matice && S) {
            const sm = S.s + 0.3;
            odd.push(sestihran(sm, -1, S.m + 0.2, ox, oy, Math.PI / 6));
            z0 = strop(odd, (a, b) => sestihran(sm, a, b, ox, oy, Math.PI / 6), S.m + 0.2, 1, o.rOsa, ox, oy);
          }
          odd.push(valec(o.rOsa, z0, tp + hn + 1, ox, oy));
        }
        const uch = km(M.difference([km(M.union(plne)), ...odd]));
        // úchyt → sestava: osa náboje = osa kola (X), deska za kolem (−x)
        const x0 = -W / 2 - hn - tp;
        dily.push(Object.assign(sit(km, uch, 'uchyt', 'Úchyt', barvaDrz), { ram: (x, y, z) => [x0 + z, x - ox, y - oy + R] }));
      }

      /* ---------- kalibrační vzorek: 5 otvorů sedla s vůlí −2 … +2 kroky ---------- */
      const kalibrace = [];
      if (volby.kalibrace) {
        const sedlo = u.typ === 'lozisko' ? o.L.D : u.osa, v0 = u.typ === 'lozisko' ? u.vule : u.vuleOsy;
        const h = u.typ === 'lozisko' ? o.L.B : 6, krok = p.tisk.krokKalibrace, roz = sedlo + 5;
        const sir = 5 * roz + 4, vys = sedlo + 9;
        const plne = [hranol(obdelnik(-sir / 2, -vys / 2, sir / 2, vys / 2, 2), 0, h)];
        const odd = [];
        const vule = [];
        for (let i = 0; i < 5; i++) {
          const x = (i - 2) * roz, v = Math.round((v0 + (i - 2) * krok) * 1000) / 1000, r = (sedlo + v) / 2;
          vule.push(v);
          const kor = r / Math.cos(Math.PI / Np(r));
          odd.push(otoc([[0, -1], [kor + 1.2, -1], [kor, 0.2], [kor, h - 0.2], [kor + 1.2, h + 1], [0, h + 1]], Np(r)).translate([x, 0, 0]));
          for (let j = 0; j <= i; j++) odd.push(kvadr(x - 2.4 + j * 1.2, vys / 2 - 1.2, -1, x - 1.8 + j * 1.2, vys / 2 + 1, h + 1));
        }
        const kal = km(M.difference([km(M.union(plne)), ...odd]));
        kalibrace.push(Object.assign(sit(km, kal, 'kalibrace', 'Kalibrační vzorek', '#2EAD5B'), { vule, sedlo }));
      }

      // sestava pro náhled (montážní poloha)
      for (const d of dily) {
        const s = d.ram ? preved(d, d.ram) : d;
        sest.push(s);
      }
      return { dily, sestava: sest, kalibrace, o, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  /** Manifold → síť pro náhled a export. */
  function sit(km, m0, jmeno, nazev, barva) {
    const m = km(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const kusy = m.decompose().map(km);
    return { jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, barva, otocit: false };
  }
  /** Díly v tiskové poloze: kolo leží na čele (osa Z už je svislá), držáky podle d.otocit. */
  const kTisku = (model, kalibrace) => model.dily.concat(kalibrace ? model.kalibrace : []);

  function kontrolyModelu(p, model) {
    const H = [];
    for (const d0 of model.dily.concat(model.kalibrace)) {
      if (d0.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d0.nazev}: díl se rozpadl na ${d0.teles} tělesa – některá část není spojená.` });
      const d = G.tiskoveRozlozeni([d0], 1)[0];
      const r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 3) H.push({ uroven: 'varovani', pole: ['tisk.uhel', 'kolo.deleni'], text: `${d0.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v tiskové poloze může potřebovat podpory.` });
      if (r.most > 2) H.push({ uroven: 'info', pole: null, text: `${d0.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu.` });
    }
    return H;
  }

  /** Doporučený O-kroužek na běhoun: dno drážky Ø Dg, natažení 2–12 % (nejblíž 5 %), průřez d2 podle zadání. */
  function okrouzek(p, o) {
    const P = o.prof;
    if (p.kolo.profil !== 'oring') return null;
    const Dg = 2 * (o.R - P.hg);
    let best = null;
    for (const q of LJ.OKROUZKY) {
      if (Math.abs(q.d2 - p.kolo.oring) > 0.06) continue;
      const nat = Dg / q.d1 - 1;
      if (nat < 0.02 || nat > 0.12) continue;
      if (!best || Math.abs(nat - 0.05) < Math.abs(best.natazeni - 0.05)) best = { oznaceni: q.k, d1: q.d1, d2: q.d2, natazeni: nat };
    }
    return { Dg, d1Idealni: Dg / 1.05, krouzek: best };
  }

  /** Vnitřní obrys kola (pravá polovina řezu, z od W do 0) – pro výkres. */
  function vnitrniObrys(p, o) {
    const W = p.kolo.sirka;
    if (p.ulozeni.typ !== 'lozisko') return [[o.rb, W], [o.rb, 0]];
    const b = [];
    const horni = o.kapsy.find(q => !q.dole), dolni = o.kapsy.find(q => q.dole);
    b.push([o.rp, W], [o.rp, horni.z0], [o.rr, horni.z0]);
    if (dolni) b.push([o.rr, dolni.z1], [o.rp, dolni.z1], [o.rp, 0]);
    else b.push([o.rr, 0]);
    return b;
  }

  const API = {
    MATERIALY, SROUBY, LOZISKA, CASTA, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    normalizuj, predvolba, popis, ulozProjekt, nactiProjekt, lozisko, odvozene, profil, previsProfilu, vyrez, kontroly,
    postav, kontrolyModelu, kTisku, vnitrniObrys, okrouzek, preved, obdelnik, obalka2, kruh, sroubNa, delkaSroubu, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt, segmenty,
  };
  if (uzel) module.exports = API; else window.KOLA = API;
})();
