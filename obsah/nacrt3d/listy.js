/* Z náčrtu do 3D – tisknutelné listy (bez DOM, jde v node).
   Souřadnice listu v mm, počátek vlevo nahoře, y dolů. Mřížka je globální od počátku listu,
   takže rámečky na stejných sloupcích/řádcích mřížky jsou přesně zarovnané (nárys ↔ půdorys ↔ bokorys).
   Rohové značky: čtverec 6 × 6 modulů, vnější prstenec černý, uvnitř 4 × 4 bity (řádky shora, bit 15 = vlevo nahoře).
   Kódová kniha se staví hladově: každé slovo má od všech ostatních slov i jejich otočení vzdálenost ≥ 4
   a od vlastních otočení také ≥ 4 → přečtení určí roh, typ listu i natočení a opraví 1 chybný bit.
   kresliList(rozvrh, k) kreslí přes obecný „kreslič“ k (plátno i jsPDF mají vlastní adaptér v ui). */
var N3D = globalThis.N3D = globalThis.N3D || {};
(function (N) {
  'use strict';

  N.MRIZKA = 5;                                   // mm
  N.FORMATY = { A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 } };
  N.TYPY_LISTU = {
    plochy: { kod: 0, nazev: 'Plochý díl', popis: 'Jeden pohled shora a tloušťka – destičky, držáky, podložky.' },
    rotacni: { kod: 1, nazev: 'Rotační díl', popis: 'Půlprofil vpravo od osy – knoflíky, hřídele, pouzdra.' },
    pohledy: { kod: 2, nazev: 'Tři pohledy', popis: 'Nárys, půdorys a bokorys zleva (evropské promítání).' },
  };
  N.BARVY = {
    mrizka: '#a9cdee',      // „slepá“ světle modrá – z fotky se odfiltruje
    ramec: '#7fb3e3',
    popis: '#6f9fcf',
    text: '#555555',
    znacka: '#000000',
    obrys: '#1a1a1a',
    kota: '#d0302a',
  };

  // ------------------------------------------------------------ značky
  const ZN_MODUL = 2.5, ZN_MODULU = 6;
  N.ZNACKA = { modul: ZN_MODUL, velikost: ZN_MODUL * ZN_MODULU, okraj: 8 };
  const ROHY = ['lh', 'ph', 'pd', 'ld'];          // levý horní, pravý horní, pravý dolní, levý dolní

  /** Otočení 4×4 bitů o 90° po směru hodinových ručiček (bit 15 = řádek 0, sloupec 0). */
  function otoc(w) {
    let v = 0;
    for (let r = 0; r < 4; r++) for (let s = 0; s < 4; s++) {
      if (w >> (15 - (r * 4 + s)) & 1) { const nr = s, ns = 3 - r; v |= 1 << (15 - (nr * 4 + ns)); }
    }
    return v;
  }
  const otocN = (w, n) => { for (let i = 0; i < n; i++) w = otoc(w); return w; };
  const vzdal = (a, b) => { let x = a ^ b, n = 0; while (x) { x &= x - 1; n++; } return n; };
  N.otocBity = otocN;

  let kniha = null;
  /** 64 slov (6 datových bitů: roh * 16 + typ). */
  function kodovaKniha() {
    if (kniha) return kniha;
    kniha = [];
    const vsechna = [];                            // přijatá slova i jejich otočení
    for (let c = 1; c < 65536 && kniha.length < 64; c++) {
      const n = vzdal(c, 0);
      if (n < 5 || n > 11) continue;               // ani skoro bílé, ani skoro černé
      const rot = [1, 2, 3].map(r => otocN(c, r));
      if (rot.some(x => vzdal(x, c) < 4)) continue;
      if ([c, ...rot].some(x => vsechna.some(y => vzdal(x, y) < 4))) continue;
      kniha.push(c);
      vsechna.push(c, ...rot);
    }
    return kniha;
  }

  /** Bity značky pro roh (0–3) a typ listu (0–15). */
  N.koduj = (roh, typ) => kodovaKniha()[roh * 16 + typ];
  /** Přečtené bity → {roh, typ, otoceni (počet otočení o 90° po směru, o které je značka na obraze pootočená), chyb} nebo null. */
  N.dekoduj = function (w) {
    const K = kodovaKniha();
    let nej = null;
    for (let r = 0; r < 4; r++) {
      const x = otocN(w, (4 - r) % 4);             // vrátit natočení zpět
      for (let i = 0; i < K.length; i++) {
        const d = vzdal(x, K[i]);
        if (d <= 1 && (!nej || d < nej.chyb)) nej = { roh: i >> 4, typ: i & 15, otoceni: r, chyb: d };
      }
    }
    return nej;
  };
  /** Matice 6×6 (true = černá) pro značku. */
  N.maticeZnacky = function (bity) {
    const m = [];
    for (let r = 0; r < ZN_MODULU; r++) {
      const radek = [];
      for (let s = 0; s < ZN_MODULU; s++) {
        const okraj = r === 0 || s === 0 || r === ZN_MODULU - 1 || s === ZN_MODULU - 1;
        radek.push(okraj || !!(bity >> (15 - ((r - 1) * 4 + (s - 1))) & 1));
      }
      m.push(radek);
    }
    return m;
  };

  // ------------------------------------------------------------ rozvrh
  const naMrizku = (v, dolu) => (dolu ? Math.floor : Math.ceil)(v / N.MRIZKA - 1e-9) * N.MRIZKA;
  const ramec = (id, druh, x0, y0, x1, y1, navic) => Object.assign({ id, druh, x0, y0, x1, y1 }, navic || {});

  /** Rozvrh listu: {typ, format, w, h, mrizka, znacky, ramy, osa?, pole, hlavicka, legenda, plocha}. */
  N.rozvrh = function (typ, format) {
    if (!N.TYPY_LISTU[typ]) typ = 'plochy';
    if (!N.FORMATY[format]) format = 'A4';
    const { w, h } = N.FORMATY[format];
    const Z = N.ZNACKA, zv = Z.velikost, o = Z.okraj;
    const znacky = [[o, o], [w - o - zv, o], [w - o - zv, h - o - zv], [o, h - o - zv]]
      .map(([x, y], roh) => ({ roh: ROHY[roh], x, y, vel: zv, bity: N.koduj(roh, N.TYPY_LISTU[typ].kod) }));
    // pracovní plocha mezi hlavičkou a legendou, na mřížce
    const plocha = { x0: naMrizku(o), y0: naMrizku(o + zv + 5), x1: naMrizku(w - o, true), y1: naMrizku(h - o - zv - 5, true) };
    const P = plocha, ramy = [], pole = [];
    let osa = null;
    if (typ === 'plochy') {
      ramy.push(ramec('pudorys', 'pohled', P.x0, P.y0, P.x1, P.y1, { nazev: 'Pohled shora', osy: ['X', 'Y'] }));
      pole.push({ id: 'tloustka', popis: 'Tloušťka', jednotka: 'mm', x: w - o - zv - 62, y: o + 8.5, w: 40 });
    } else if (typ === 'rotacni') {
      ramy.push(ramec('profil', 'pohled', P.x0, P.y0, P.x1, P.y1, { nazev: 'Půlprofil (vpravo od osy)', osy: ['R', 'Z'] }));
      const x = naMrizku(P.x0 + (P.x1 - P.x0) * 0.2);
      osa = { x1: x, y1: P.y0, x2: x, y2: P.y1 };
    } else {
      // nárys vlevo nahoře, bokorys zleva vpravo od něj, půdorys pod nárysem; mezera jeden čtverec
      const g = N.MRIZKA;
      const xs = naMrizku(P.x0 + (P.x1 - P.x0) * 0.6), ys = naMrizku(P.y0 + (P.y1 - P.y0) * 0.5);
      ramy.push(ramec('narys', 'pohled', P.x0, P.y0, xs, ys, { nazev: 'Nárys (zepředu)', osy: ['X', 'Z'] }));
      ramy.push(ramec('bokorys', 'pohled', xs + g, P.y0, P.x1, ys, { nazev: 'Bokorys zleva', osy: ['Y', 'Z'] }));
      ramy.push(ramec('pudorys', 'pohled', P.x0, ys + g, xs, P.y1, { nazev: 'Půdorys (shora)', osy: ['X', 'Y'] }));
      ramy.push(ramec('poznamky', 'poznamky', xs + g, ys + g, P.x1, P.y1, { nazev: 'Poznámky' }));
    }
    const hlavicka = { x: o + zv + 5, y: o, w: w - 2 * (o + zv + 5), h: zv };
    const legenda = { x: o + zv + 5, y: h - o - zv, w: w - 2 * (o + zv + 5), h: zv };
    return { typ, format, w, h, mrizka: N.MRIZKA, znacky, ramy, osa, pole, hlavicka, legenda, plocha };
  };

  /** Rámeček pohledu, ve kterém leží bod listu (nebo null). */
  N.ramecVBode = (rv, x, y) => rv.ramy.find(r => r.druh === 'pohled' && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) || null;

  // ------------------------------------------------------------ kreslení
  const CARKY = { obrys: null, skryta: [2.5, 1.5], osa: [6, 1.5, 1, 1.5] };

  /** Kreslí list přes kreslič k:
      k.obdelnik(x, y, w, h, {barva, sila, plny}), k.cara(x1, y1, x2, y2, {barva, sila, carky}),
      k.kruh(x, y, r, {barva, sila, plny}), k.text(x, y, s, {vel (mm), barva, zarovnani, tucne}),
      k.tecky(body [[x, y]...], r, barva). volby: {mrizka: true, nazev: ''}. */
  N.kresliList = function (rv, k, volby = {}) {
    const B = N.BARVY, g = rv.mrizka;
    // mřížka teček jen v rámečcích pohledů
    if (volby.mrizka !== false) {
      for (const r of rv.ramy) {
        if (r.druh !== 'pohled') continue;
        const body = [], krizky = [];
        for (let x = r.x0; x <= r.x1 + 1e-6; x += g) for (let y = r.y0; y <= r.y1 + 1e-6; y += g) {
          // každé 2 cm výraznější křížek pro orientaci (globálně, takže sedí přes pohledy)
          (Math.round(x / g) % 4 || Math.round(y / g) % 4 ? body : krizky).push([x, y]);
        }
        k.tecky(body, 0.28, B.mrizka);
        for (const [x, y] of krizky) {
          k.cara(x - 1, y, x + 1, y, { barva: B.mrizka, sila: 0.2 });
          k.cara(x, y - 1, x, y + 1, { barva: B.mrizka, sila: 0.2 });
        }
      }
    }
    for (const r of rv.ramy) {
      k.obdelnik(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, { barva: B.ramec, sila: 0.35 });
      k.text(r.x0 + 1.5, r.y0 + 3.6, r.nazev.toUpperCase(), { vel: 2.6, barva: B.popis, tucne: true });
    }
    if (rv.osa) {
      const a = rv.osa;
      k.cara(a.x1, a.y1, a.x2, a.y2, { barva: B.ramec, sila: 0.35, carky: CARKY.osa });
      k.text(a.x1 - 1.5, a.y2 - 2, 'osa', { vel: 2.6, barva: B.popis, zarovnani: 'right' });
    }
    // značky
    for (const z of rv.znacky) {
      const m = N.maticeZnacky(z.bity), md = z.vel / ZN_MODULU;
      for (let r = 0; r < ZN_MODULU; r++) for (let s = 0; s < ZN_MODULU; s++) {
        if (m[r][s]) k.obdelnik(z.x + s * md, z.y + r * md, md, md, { barva: B.znacka, plny: true });
      }
    }
    // hlavička
    const H = rv.hlavicka, typ = N.TYPY_LISTU[rv.typ];
    k.text(H.x, H.y + 5, 'Z náčrtu do 3D · ' + typ.nazev, { vel: 4.2, barva: B.text, tucne: true });
    k.text(H.x, H.y + 11, 'Název:', { vel: 3, barva: B.text });
    k.cara(H.x + 11, H.y + 11.6, H.x + 70, H.y + 11.6, { barva: B.ramec, sila: 0.25 });
    if (volby.nazev) k.text(H.x + 12, H.y + 10.6, volby.nazev, { vel: 3.4, barva: B.obrys });
    k.text(H.x + H.w, H.y + 5, 'mřížka ' + g + ' mm · ' + rv.format, { vel: 2.8, barva: B.popis, zarovnani: 'right' });
    for (const p of rv.pole) {
      k.text(p.x, p.y + 2.5, p.popis + ':', { vel: 3, barva: B.text });
      k.cara(p.x + 15, p.y + 3.1, p.x + p.w + 15, p.y + 3.1, { barva: B.ramec, sila: 0.25 });
      k.text(p.x + p.w + 16, p.y + 2.5, p.jednotka, { vel: 3, barva: B.text });
      if (volby.pole && volby.pole[p.id] != null) k.text(p.x + 17, p.y + 2.1, String(volby.pole[p.id]), { vel: 3.4, barva: B.obrys });
    }
    // legenda
    const L = rv.legenda, sir = L.w / 5, yl = L.y + 7;
    const vzorek = (i, popis, kresli) => {
      const x = L.x + i * sir;
      kresli(x, yl);
      k.text(x, yl + 5.5, popis, { vel: 2.5, barva: B.text });
    };
    vzorek(0, 'obrys', (x, y) => k.cara(x, y, x + 14, y, { barva: B.obrys, sila: 0.5 }));
    vzorek(1, 'skrytá hrana', (x, y) => k.cara(x, y, x + 14, y, { barva: B.obrys, sila: 0.35, carky: CARKY.skryta }));
    vzorek(2, 'osa', (x, y) => k.cara(x, y, x + 14, y, { barva: B.obrys, sila: 0.25, carky: CARKY.osa }));
    vzorek(3, 'díra', (x, y) => {
      k.kruh(x + 4, y, 2.6, { barva: B.obrys, sila: 0.4 });
      k.cara(x + 0.4, y, x + 7.6, y, { barva: B.obrys, sila: 0.2, carky: [1.5, 0.6, 0.4, 0.6] });
      k.cara(x + 4, y - 3.6, x + 4, y + 3.6, { barva: B.obrys, sila: 0.2, carky: [1.5, 0.6, 0.4, 0.6] });
    });
    vzorek(4, 'kóta (červeně)', (x, y) => {
      k.cara(x, y, x + 14, y, { barva: B.kota, sila: 0.3 });
      k.cara(x, y, x + 1.6, y - 0.7, { barva: B.kota, sila: 0.3 }); k.cara(x, y, x + 1.6, y + 0.7, { barva: B.kota, sila: 0.3 });
      k.cara(x + 14, y, x + 12.4, y - 0.7, { barva: B.kota, sila: 0.3 }); k.cara(x + 14, y, x + 12.4, y + 0.7, { barva: B.kota, sila: 0.3 });
      k.text(x + 7, y - 1.2, '40', { vel: 2.6, barva: B.kota, zarovnani: 'center' });
    });
  };

  N.CARKY = CARKY;
  if (typeof module !== 'undefined') module.exports = N;
})(N3D);
