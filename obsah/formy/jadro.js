/* Formy na odlévání – výpočetní jádro bez DOM, bez three.js a bez manifoldu (spustitelné v node).
   Parametry (výchozí, rozsahy, normalizace, předvolby), materiály odlitků, načtení STL (binární i ASCII)
   a 3MF, svaření vrcholů a pokus o opravu sítě, natočení modelu, průřez v rovině, návrh dělicí roviny,
   analýza podkosů (normála + zákryt svislým paprskem), místa zachycení vzduchu, kontroly, odhad tisku,
   projekt JSON.
   Souřadnice: mm, osa Z nahoru = směr vyjímání (nahoru horní díl / odlitek z otevřené formy),
   model se středem půdorysu v počátku a spodkem v z = 0. */
(function () {
  'use strict';

  const VERZE_FORMATU = 1;

  /* ---------- materiály odlitku: hustota hotového odlitku (g/cm³), složky pro míchání ---------- */
  const MATERIALY = {
    sadra: { nazev: 'Sádra (modelářská)', hustota: 1.65, slozky: ['sádra', 'voda'], pomer: [100, 60], tekutost: 'stredni',
      pozn: 'hustota kaše; hotový odlitek po vyschnutí lehčí' },
    beton: { nazev: 'Beton / jemná malta', hustota: 2.3, slozky: null, tekutost: 'husta', pozn: 'drobné kamenivo do 2 mm, vibrovat' },
    epoxid: { nazev: 'Epoxidová pryskyřice', hustota: 1.15, slozky: ['složka A', 'tužidlo B'], pomer: [100, 50], tekutost: 'ridka',
      pozn: 'poměr podle výrobce, často 2 : 1 nebo 100 : 45' },
    polyuretan: { nazev: 'Polyuretanová pryskyřice', hustota: 1.05, slozky: ['složka A', 'složka B'], pomer: [100, 100], tekutost: 'ridka', pozn: '' },
    silikon: { nazev: 'Silikon adiční (Pt)', hustota: 1.1, slozky: ['složka A', 'složka B'], pomer: [100, 100], tekutost: 'stredni',
      pozn: 'PLA a PETG s Pt silikonem obvykle nevadí, pryskyřičné tisky ano' },
    silikonCin: { nazev: 'Silikon kondenzační (Sn)', hustota: 1.15, slozky: ['silikon', 'katalyzátor'], pomer: [100, 5], tekutost: 'stredni', pozn: '' },
    vosk: { nazev: 'Vosk (parafín, sojový)', hustota: 0.9, slozky: null, tekutost: 'ridka', pozn: 'PLA měkne nad 55 °C – lít vosk do 70 °C a formu chladit' },
    mydlo: { nazev: 'Mýdlová báze (glycerinová)', hustota: 1.05, slozky: null, tekutost: 'ridka', pozn: 'lít do 60 °C' },
    cokolada: { nazev: 'Čokoláda', hustota: 1.3, slozky: null, tekutost: 'husta', pozn: 'na potraviny jen potravinářský materiál a hladký povrch' },
  };
  /* Materiály tisku formy (g/cm³). */
  const TISK_MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24 },
    PETG: { nazev: 'PETG', hustota: 1.27 },
    ABS: { nazev: 'ABS / ASA', hustota: 1.05 },
  };
  const UKAZKY = { koule: 'Koule', kostka: 'Kostka se zaoblením', figurka: 'Figurka (pěšec)' };
  const REZIMY = { dvoudilna: 'Dvoudílná pevná forma', box: 'Box pro lití silikonu', otevrena: 'Otevřená jednodílná forma' };

  /* ---------- výchozí projekt ---------- */
  const VYCHOZI = {
    nazev: 'Forma',
    rezim: 'dvoudilna',
    model: { zdroj: 'figurka', rozmer: 40, meritko: 100, osa: 'x', prevratit: false },
    smrsteni: 0,          // % zvětšení dutiny proti modelu (kompenzace smrštění odlitku)
    ukos: 2,              // ° – plochy s menším úkosem se hlásí (vyjímání ztuha)
    minStena: 2,          // mm – nejtenčí materiál formy kolem otvorů a dutiny
    material: 'sadra', rezerva: 10,
    rovina: { rezim: 'prurez', vyska: 20 },   // výška dělicí roviny / hladiny od spodku modelu (mm)
    forma: { tvar: 'kvadr', stena: 8, zaobleni: 3 },
    zamky: { pocet: 4, prumer: 8, vyska: 5, uhel: 10, vule: 0.3 },
    vtok: { prumer: 8, lijavka: true },
    vzduch: { pocet: 2, prumer: 2 },
    srouby: { pocet: 0, prumer: 4, vule: 0.4 },
    box: { odstup: 10, stena: 2.4, podstavec: 3, osazeni: 3, cepPrumer: 6, cepVyska: 6, vule: 0.3 },
    otevrena: { stena: 5, dno: 4, nx: 1, ny: 1, mezera: 6 },
    tisk: { material: 'PLA', vypln: 20 },
  };

  const ROZSAHY = {
    'model.rozmer': [5, 300], 'model.meritko': [1, 2000], smrsteni: [0, 10], ukos: [0, 15], minStena: [0.8, 10], rezerva: [0, 100],
    'rovina.vyska': [0, 2000],
    'forma.stena': [2, 60], 'forma.zaobleni': [0, 30],
    'zamky.pocet': [0, 8], 'zamky.prumer': [3, 30], 'zamky.vyska': [2, 20], 'zamky.uhel': [0, 30], 'zamky.vule': [0, 1],
    'vtok.prumer': [2, 30], 'vzduch.pocet': [0, 8], 'vzduch.prumer': [1, 6],
    'srouby.pocet': [0, 8], 'srouby.prumer': [2, 10], 'srouby.vule': [0, 2],
    'box.odstup': [3, 60], 'box.stena': [1.2, 10], 'box.podstavec': [1.5, 10], 'box.osazeni': [1, 10],
    'box.cepPrumer': [2, 20], 'box.cepVyska': [0, 30], 'box.vule': [0, 1],
    'otevrena.stena': [1.2, 50], 'otevrena.dno': [1.2, 50], 'otevrena.nx': [1, 10], 'otevrena.ny': [1, 10], 'otevrena.mezera': [2, 60],
    'tisk.vypln': [5, 100],
  };
  const CELA = ['zamky.pocet', 'vzduch.pocet', 'srouby.pocet', 'otevrena.nx', 'otevrena.ny'];

  /* ---------- předvolby (přepíší jen uvedené hodnoty) ---------- */
  const PREDVOLBY = [
    { nazev: 'Sádrová figurka – dvoudílná', popis: 'pěšec, kvádr se zámky, vtok a odvzdušnění, sádra',
      p: { rezim: 'dvoudilna', model: { zdroj: 'figurka', rozmer: 40, osa: 'x' }, material: 'sadra', smrsteni: 0, rovina: { rezim: 'prurez' },
        forma: { tvar: 'kvadr', stena: 8, zaobleni: 3 }, zamky: { pocet: 4, prumer: 8, vyska: 5, uhel: 10, vule: 0.3 },
        vtok: { prumer: 8, lijavka: true }, vzduch: { pocet: 2, prumer: 2 }, srouby: { pocet: 0 } } },
    { nazev: 'Epoxidová koule – sešroubovaná', popis: 'obrysová skořepina, 4 zámky, 4 šrouby M4, epoxid',
      p: { rezim: 'dvoudilna', model: { zdroj: 'koule', rozmer: 40, osa: 'z' }, material: 'epoxid', smrsteni: 0.5, rovina: { rezim: 'prurez' },
        forma: { tvar: 'obrys', stena: 12, zaobleni: 0 }, zamky: { pocet: 3, prumer: 6, vyska: 4, uhel: 10, vule: 0.25 },
        vtok: { prumer: 6, lijavka: true }, vzduch: { pocet: 1, prumer: 2 }, srouby: { pocet: 4, prumer: 4, vule: 0.4 } } },
    { nazev: 'Box na silikonovou formu', popis: 'model na čepu, rámeček na podstavci, objem silikonu',
      p: { rezim: 'box', model: { zdroj: 'figurka', rozmer: 50, osa: 'z' }, material: 'silikon',
        box: { odstup: 10, stena: 2.4, podstavec: 3, osazeni: 3, cepPrumer: 6, cepVyska: 6, vule: 0.3 } } },
    { nazev: 'Mýdlo – otevřená forma 2 × 2', popis: 'zaoblená kostka, hladina nejvýš bez podkosů, čtyři dutiny',
      p: { rezim: 'otevrena', model: { zdroj: 'kostka', rozmer: 45, osa: 'z' }, material: 'mydlo', rovina: { rezim: 'podkosy' },
        otevrena: { stena: 5, dno: 3, nx: 2, ny: 2, mezera: 8 } } },
    { nazev: 'Betonová dlaždice – polokoule', popis: 'otevřená forma, rovina v největším průřezu, beton',
      p: { rezim: 'otevrena', model: { zdroj: 'koule', rozmer: 80, osa: 'z' }, material: 'beton', rovina: { rezim: 'prurez' },
        otevrena: { stena: 8, dno: 6, nx: 1, ny: 1, mezera: 6 } } },
    { nazev: 'Čokoládové pralinky 3 × 2', popis: 'malé polokoule, rovina bez podkosů',
      p: { rezim: 'otevrena', model: { zdroj: 'koule', rozmer: 25, osa: 'z' }, material: 'cokolada', rovina: { rezim: 'podkosy' },
        otevrena: { stena: 4, dno: 2, nx: 3, ny: 2, mezera: 5 } } },
  ];

  /* ---------- pomocné ---------- */
  const kopie = o => JSON.parse(JSON.stringify(o));
  const cislo = (x, d) => {
    const n = typeof x === 'string' ? parseFloat(x.trim().replace(/\s/g, '').replace(',', '.').replace('−', '-')) : Number(x);
    return Number.isFinite(n) ? n : d;
  };
  function fmt(x, des = 1) {
    if (!Number.isFinite(x)) return '–';
    let s = (Math.round(x * 10 ** des) / 10 ** des).toFixed(des);
    if (des > 0) s = s.replace(/\.?0+$/, '');
    return s.replace('-', '−').replace('.', ',');
  }
  const vezmi = (o, cesta) => cesta.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, cesta, h) { const k = cesta.split('.'); const p = k.pop(); k.reduce((a, x) => a[x], o)[p] = h; }
  const NAZVY_POLI = {
    'model.rozmer': 'velikost ukázky', 'model.meritko': 'měřítko modelu', smrsteni: 'smrštění', ukos: 'nejmenší úkos', minStena: 'nejmenší stěna',
    rezerva: 'rezerva materiálu', 'rovina.vyska': 'výška roviny', 'forma.stena': 'stěna formy', 'forma.zaobleni': 'zaoblení rohů',
    'zamky.pocet': 'počet zámků', 'zamky.prumer': 'průměr zámku', 'zamky.vyska': 'výška zámku', 'zamky.uhel': 'úkos zámku', 'zamky.vule': 'vůle zámků',
    'vtok.prumer': 'průměr vtoku', 'vzduch.pocet': 'počet odvzdušnění', 'vzduch.prumer': 'průměr odvzdušnění',
    'srouby.pocet': 'počet šroubů', 'srouby.prumer': 'průměr šroubu', 'srouby.vule': 'vůle šroubu',
    'box.odstup': 'odstup stěn', 'box.stena': 'stěna rámečku', 'box.podstavec': 'tloušťka podstavce', 'box.osazeni': 'výška osazení',
    'box.cepPrumer': 'průměr čepu', 'box.cepVyska': 'výška čepu', 'box.vule': 'vůle rámečku',
    'otevrena.stena': 'stěna bloku', 'otevrena.dno': 'dno bloku', 'otevrena.nx': 'dutin v řadě', 'otevrena.ny': 'řad', 'otevrena.mezera': 'mezera dutin',
    'tisk.vypln': 'výplň',
  };

  /** Doplní chybějící hodnoty, převede na čísla, ořízne do rozsahů. Vrací {p, hlaseni}. */
  function normalizuj(vstup) {
    const hlaseni = [];
    const p = kopie(VYCHOZI);
    const slij = (cil, zdroj) => {
      if (!zdroj || typeof zdroj !== 'object') return;
      for (const k of Object.keys(cil)) {
        if (!(k in zdroj)) continue;
        if (cil[k] && typeof cil[k] === 'object') slij(cil[k], zdroj[k]);
        else cil[k] = zdroj[k];
      }
    };
    slij(p, vstup || {});
    p.nazev = String(p.nazev || 'Forma').slice(0, 120);
    for (const [cesta, [mn, mx]] of Object.entries(ROZSAHY)) {
      const puv = vezmi(p, cesta), vych = vezmi(VYCHOZI, cesta), jm = NAZVY_POLI[cesta] || cesta;
      let h = cislo(puv, NaN);
      if (!Number.isFinite(h)) { hlaseni.push(`${jm}: neplatná hodnota „${puv}“, použito ${fmt(vych, 2)}`); h = vych; }
      if (h < mn) { hlaseni.push(`${jm}: ${fmt(h, 2)} je pod minimem ${fmt(mn, 2)}`); h = mn; }
      if (h > mx) { hlaseni.push(`${jm}: ${fmt(h, 2)} je nad maximem ${fmt(mx, 2)}`); h = mx; }
      if (CELA.includes(cesta)) h = Math.round(h);
      poloz(p, cesta, h);
    }
    const vyber = (cesta, mozne) => { if (!mozne.includes(vezmi(p, cesta))) { hlaseni.push(`${cesta}: neznámá volba, použito ${vezmi(VYCHOZI, cesta)}`); poloz(p, cesta, vezmi(VYCHOZI, cesta)); } };
    vyber('rezim', Object.keys(REZIMY));
    vyber('model.zdroj', [...Object.keys(UKAZKY), 'soubor']);
    vyber('model.osa', ['z', 'x', 'y']);
    vyber('rovina.rezim', ['prurez', 'podkosy', 'rucne']);
    vyber('forma.tvar', ['kvadr', 'obrys']);
    vyber('material', Object.keys(MATERIALY));
    vyber('tisk.material', Object.keys(TISK_MATERIALY));
    p.model.prevratit = !!p.model.prevratit; p.vtok.lijavka = !!p.vtok.lijavka;
    return { p, hlaseni };
  }

  /* ======================= načtení sítí ======================= */
  const naU8 = b => (b instanceof Uint8Array ? b : new Uint8Array(b));

  /** STL binární i ASCII → „polévka“ trojúhelníků {poz: Float32Array (9 čísel na trojúhelník), format}. */
  function nactiStl(buf) {
    const u8 = naU8(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const binarni = () => {
      const n = dv.getUint32(80, true);
      if (84 + 50 * n > u8.length) throw new Error('Soubor STL je zkrácený nebo poškozený.');
      const poz = new Float32Array(9 * n);
      for (let t = 0; t < n; t++) for (let k = 0; k < 9; k++) poz[9 * t + k] = dv.getFloat32(84 + 50 * t + 12 + 4 * k, true);
      return { poz, format: 'STL binární' };
    };
    if (u8.length >= 84 && 84 + 50 * dv.getUint32(80, true) === u8.length) return binarni();
    const zac = String.fromCharCode(...u8.subarray(0, Math.min(400, u8.length))).trimStart();
    if (/^solid/i.test(zac)) {
      const text = typeof TextDecoder !== 'undefined' ? new TextDecoder('latin1').decode(u8) : Buffer.from(u8).toString('latin1');
      const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g, cisla = [];
      let m;
      while ((m = re.exec(text))) cisla.push(+m[1], +m[2], +m[3]);
      if (cisla.length >= 9) {
        if (cisla.length % 9 || cisla.some(x => !Number.isFinite(x))) throw new Error('ASCII STL: neplatné souřadnice vrcholů.');
        return { poz: new Float32Array(cisla), format: 'STL ASCII' };
      }
    }
    if (u8.length >= 84 && 84 + 50 * dv.getUint32(80, true) <= u8.length) return binarni();
    throw new Error('Soubor není STL (ani binární, ani ASCII).');
  }

  /* --- ZIP (jen čtení) pro 3MF: metoda 0 (uloženo) a 8 (deflate přes DecompressionStream) --- */
  async function rozbalZip(buf) {
    const u8 = naU8(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Soubor 3MF není platný ZIP.');
    const pocet = dv.getUint16(eocd + 10, true);
    let o = dv.getUint32(eocd + 16, true);
    const out = {};
    const dek = new TextDecoder('utf-8');
    for (let i = 0; i < pocet; i++) {
      if (dv.getUint32(o, true) !== 0x02014b50) throw new Error('Poškozený adresář ZIP.');
      const metoda = dv.getUint16(o + 10, true), vel = dv.getUint32(o + 20, true);
      const nJm = dv.getUint16(o + 28, true), nEx = dv.getUint16(o + 30, true), nKom = dv.getUint16(o + 32, true), lok = dv.getUint32(o + 42, true);
      const jmeno = dek.decode(u8.subarray(o + 46, o + 46 + nJm));
      o += 46 + nJm + nEx + nKom;
      if (!/\.model$/i.test(jmeno)) continue;
      const zac = lok + 30 + dv.getUint16(lok + 26, true) + dv.getUint16(lok + 28, true);
      const data = u8.subarray(zac, zac + vel);
      if (metoda === 0) out[jmeno] = dek.decode(data);
      else if (metoda === 8) {
        if (typeof DecompressionStream === 'undefined') throw new Error('Prohlížeč neumí rozbalit 3MF (chybí DecompressionStream).');
        const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        out[jmeno] = await new Response(s).text();
      } else throw new Error(`3MF: nepodporovaná komprese ${metoda}.`);
    }
    return out;
  }
  const atributy = s => { const o = {}; s.replace(/([\w:]+)\s*=\s*"([^"]*)"/g, (_, k, v) => { o[k] = v; return ''; }); return o; };
  const JEDNOTKY = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };
  /** 3MF → {poz, idx, format}: všechny položky sestavení (build items) s transformacemi a komponentami. */
  async function nacti3mf(buf) {
    const soubory = await rozbalZip(buf);
    const objekty = {};
    let jednotka = 1;
    for (const xml of Object.values(soubory)) {
      const mm = /<model\b([^>]*)>/.exec(xml);
      if (mm) { const a = atributy(mm[1]); if (a.unit && JEDNOTKY[a.unit]) jednotka = JEDNOTKY[a.unit]; }
      const reObj = /<object\b([^>]*)>([\s\S]*?)<\/object>/g; let m;
      while ((m = reObj.exec(xml))) {
        const a = atributy(m[1]), telo = m[2], ob = { v: [], t: [], komp: [] };
        let r; const reV = /<vertex\b([^>]*)\/?>/g;
        while ((r = reV.exec(telo))) { const q = atributy(r[1]); ob.v.push(+q.x, +q.y, +q.z); }
        const reT = /<triangle\b([^>]*)\/?>/g;
        while ((r = reT.exec(telo))) { const q = atributy(r[1]); ob.t.push(+q.v1, +q.v2, +q.v3); }
        const reK = /<component\b([^>]*)\/?>/g;
        while ((r = reK.exec(telo))) { const q = atributy(r[1]); ob.komp.push({ id: q.objectid, tr: q.transform }); }
        objekty[a.id] = ob;
      }
    }
    const items = [];
    for (const xml of Object.values(soubory)) {
      const b = /<build\b[^>]*>([\s\S]*?)<\/build>/.exec(xml);
      if (b) { let r; const re = /<item\b([^>]*)\/?>/g; while ((r = re.exec(b[1]))) { const q = atributy(r[1]); items.push({ id: q.objectid, tr: q.transform }); } }
    }
    if (!items.length) Object.keys(objekty).forEach(id => items.push({ id }));
    const matice = s => { const m = (s || '').trim().split(/\s+/).map(Number); return m.length === 12 && m.every(Number.isFinite) ? m : [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; };
    // složení: bod × A potom × B (3MF: řádkové vektory, poslední řádek posun)
    const slozit = (A, B) => {
      const r = new Array(12);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
        r[3 * i + j] = A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j] + (i === 3 ? B[9 + j] : 0);
      }
      return r;
    };
    const P = [], I = [];
    const pridej = (id, M, hloubka) => {
      const ob = objekty[id]; if (!ob || hloubka > 8) return;
      const z = P.length / 3;
      for (let k = 0; k < ob.v.length; k += 3) {
        const x = ob.v[k], y = ob.v[k + 1], q = ob.v[k + 2];
        P.push((x * M[0] + y * M[3] + q * M[6] + M[9]) * jednotka, (x * M[1] + y * M[4] + q * M[7] + M[10]) * jednotka, (x * M[2] + y * M[5] + q * M[8] + M[11]) * jednotka);
      }
      const nv = ob.v.length / 3;
      for (const v of ob.t) { if (!(v >= 0 && v < nv)) throw new Error('3MF: trojúhelník odkazuje na neexistující vrchol.'); I.push(z + v); }
      for (const k of ob.komp) pridej(k.id, slozit(matice(k.tr), M), hloubka + 1);
    };
    for (const it of items) pridej(it.id, matice(it.tr), 0);
    if (!I.length) throw new Error('3MF neobsahuje žádnou síť.');
    return { poz: new Float32Array(P), idx: new Uint32Array(I), format: '3MF' };
  }

  /** Svaření vrcholů do vzdálenosti tol (mřížka s krokem tol, hledá se i v sousedních buňkách)
      + vyhození degenerovaných trojúhelníků. Vstup polévka nebo indexovaná síť. */
  function svar(sit, tol) {
    const src = sit.poz, idxIn = sit.idx || null;
    const nT = idxIn ? idxIn.length / 3 : src.length / 9;
    const mapa = new Map(), poz = [], idx = [];
    const t = tol > 0 ? tol : 1e-6, t2 = t * t;
    const vrchol = i => {
      const x = src[3 * i], y = src[3 * i + 1], z = src[3 * i + 2];
      const cx = Math.round(x / t), cy = Math.round(y / t), cz = Math.round(z / t);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const s = mapa.get((cx + a) + ',' + (cy + b) + ',' + (cz + c));
        if (s) for (const j of s) if ((poz[3 * j] - x) ** 2 + (poz[3 * j + 1] - y) ** 2 + (poz[3 * j + 2] - z) ** 2 <= t2) return j;
      }
      const j = poz.length / 3, k = cx + ',' + cy + ',' + cz;
      poz.push(x, y, z);
      const s = mapa.get(k); if (s) s.push(j); else mapa.set(k, [j]);
      return j;
    };
    let degen = 0;
    for (let f = 0; f < nT; f++) {
      const a = vrchol(idxIn ? idxIn[3 * f] : 3 * f), b = vrchol(idxIn ? idxIn[3 * f + 1] : 3 * f + 1), c = vrchol(idxIn ? idxIn[3 * f + 2] : 3 * f + 2);
      if (a === b || b === c || a === c) { degen++; continue; }
      idx.push(a, b, c);
    }
    return { poz: new Float32Array(poz), idx: new Uint32Array(idx), degen };
  }

  /** Zahodí zdvojené trojúhelníky (stejné: jeden nechá; protisměrné páry: oba – vnitřní stěny). */
  function bezDuplicit(sit) {
    const I = sit.idx, nT = I.length / 3, mapa = new Map(), zahodit = new Uint8Array(nT);
    let n = 0;
    for (let t = 0; t < nT; t++) {
      const a = I[3 * t], b = I[3 * t + 1], c = I[3 * t + 2];
      const s = [a, b, c].sort((x, y) => x - y).join(',');
      // orientace jako parita permutace k seřazenému pořadí
      const m = Math.min(a, b, c), r = m === a ? [a, b, c] : m === b ? [b, c, a] : [c, a, b], par = r[1] < r[2] ? 1 : -1;
      const pred = mapa.get(s);
      if (pred === undefined) { mapa.set(s, { t, par }); continue; }
      if (zahodit[pred.t]) { mapa.set(s, { t, par }); continue; }
      if (pred.par === par) { zahodit[t] = 1; n++; } else { zahodit[t] = 1; zahodit[pred.t] = 1; n += 2; }
    }
    if (!n) return { sit, zahozeno: 0 };
    const idx = [];
    for (let t = 0; t < nT; t++) if (!zahodit[t]) idx.push(I[3 * t], I[3 * t + 1], I[3 * t + 2]);
    return { sit: { poz: sit.poz, idx: new Uint32Array(idx) }, zahozeno: n };
  }

  /** Sjednotí orientaci trojúhelníků v každé souvislé části (průchod přes sdílené hrany) a otočí části se záporným objemem. */
  function sjednotOrientaci(sit) {
    const I = Uint32Array.from(sit.idx), P = sit.poz, nT = I.length / 3, nV = P.length / 3;
    const hrany = new Map();
    const klic = (a, b) => (a < b ? a * nV + b : b * nV + a);
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) {
      const a = I[3 * t + k], b = I[3 * t + (k + 1) % 3], key = klic(a, b);
      let s = hrany.get(key); if (!s) hrany.set(key, s = []); s.push(t);
    }
    const ma = (t, a, b) => { for (let k = 0; k < 3; k++) if (I[3 * t + k] === a && I[3 * t + (k + 1) % 3] === b) return true; return false; };
    const otoc = t => { const x = I[3 * t + 1]; I[3 * t + 1] = I[3 * t + 2]; I[3 * t + 2] = x; };
    const cast = new Int32Array(nT).fill(-1);
    let otoceno = 0, casti = 0;
    for (let s = 0; s < nT; s++) {
      if (cast[s] >= 0) continue;
      const fronta = [s]; cast[s] = casti;
      const clen = [];
      while (fronta.length) {
        const t = fronta.pop(); clen.push(t);
        for (let k = 0; k < 3; k++) {
          const a = I[3 * t + k], b = I[3 * t + (k + 1) % 3], sous = hrany.get(klic(a, b));
          if (sous.length !== 2) continue;
          const u = sous[0] === t ? sous[1] : sous[0];
          if (cast[u] >= 0) continue;
          if (ma(u, a, b)) { otoc(u); otoceno++; }
          cast[u] = casti; fronta.push(u);
        }
      }
      // objem části; záporný = obrácená celá část
      let V = 0;
      for (const t of clen) {
        const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
        V += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
      }
      if (V < 0) { for (const t of clen) otoc(t); otoceno += clen.length; }
      casti++;
    }
    return { sit: { poz: P, idx: I }, otoceno, casti };
  }

  const obal = poz => {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) { const v = poz[i + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; }
    return b;
  };

  /** Kontrola těsnosti (stejná pravidla jako KRAB.kontrolaSite, tady bez závislosti): okrajové a nevarietní hrany.
      bezOrientace = jen počet trojúhelníků u hrany (2), směr se nehlídá – orientace se opraví zvlášť. */
  function tesnost(sit, bezOrientace) {
    const I = sit.idx, nV = sit.poz.length / 3, smer = new Map();
    for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) {
      let a = I[t + k], b = I[t + (k + 1) % 3];
      if (bezOrientace && a > b) [a, b] = [b, a];
      const key = a * nV + b; smer.set(key, (smer.get(key) || 0) + 1);
    }
    let okraj = 0, nevar = 0;
    for (const [key, n] of smer) {
      const a = Math.floor(key / nV), b = key - a * nV;
      if (bezOrientace) { if (n === 1) okraj++; else if (n !== 2) nevar++; continue; }
      const r = smer.get(b * nV + a) || 0;
      if (!r) okraj++; else if (n !== 1 || r !== 1) { if (a < b) nevar++; }
    }
    return { okraj, nevar, uzavrena: I.length > 0 && !okraj && !nevar };
  }

  /** Z načteného souboru udělá indexovanou síť a pokusí se ji opravit (svaření s rostoucí tolerancí,
      duplicity, orientace). Vrací {sit, kroky: [text], tesnost}. */
  function pripravSit(surova) {
    const kroky = [];
    const b = obal(surova.poz), diag = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) || 1;
    let sit = null;
    for (const rel of [1e-7, 1e-5, 1e-4, 1e-3]) {
      const tol = Math.max(1e-6, rel * diag), s = svar(surova, tol), d = bezDuplicit(s);
      sit = d.sit;
      const k = [];
      if (rel > 1e-7) k.push(`svaření vrcholů s tolerancí ${fmt(tol, 4)} mm`);
      if (d.zahozeno) k.push(`odstraněno ${d.zahozeno} zdvojených trojúhelníků`);
      if (s.degen && rel > 1e-7) k.push(`vyhozeno ${s.degen} degenerovaných trojúhelníků`);
      if (tesnost(sit, true).uzavrena || rel === 1e-3) { kroky.push(...k); break; }
    }
    const o = sjednotOrientaci(sit);
    if (o.otoceno) kroky.push(`otočeno ${o.otoceno} trojúhelníků na jednotnou orientaci (normály ven)`);
    return { sit: o.sit, kroky, tesnost: tesnost(o.sit), casti: o.casti };
  }

  /* ======================= transformace modelu ======================= */
  /** Natočí (osa vyjímání → Z, převrácení), změní měřítko a posadí model: střed půdorysu v počátku, spodek v z = 0. */
  function umisti(sit, m) {
    const s = (m.meritko || 100) / 100, P = sit.poz, n = P.length / 3, poz = new Float32Array(P.length);
    for (let i = 0; i < n; i++) {
      let x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2];
      if (m.osa === 'x') [x, y, z] = [y, z, x];        // cyklická záměna zachová orientaci
      else if (m.osa === 'y') [x, y, z] = [z, x, y];
      if (m.prevratit) { y = -y; z = -z; }
      poz[3 * i] = x * s; poz[3 * i + 1] = y * s; poz[3 * i + 2] = z * s;
    }
    const b = obal(poz), cx = (b[0] + b[3]) / 2, cy = (b[1] + b[4]) / 2;
    for (let i = 0; i < n; i++) { poz[3 * i] -= cx; poz[3 * i + 1] -= cy; poz[3 * i + 2] -= b[2]; }
    return { poz, idx: sit.idx };
  }
  /** Zvětšení dutiny o smrštění (%) kolem středu obalového kvádru – spodek zůstane v z = 0. */
  function zvetsi(sit, procent) {
    const f = 1 + procent / 100, b = obal(sit.poz), c = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, b[2]];
    const poz = new Float32Array(sit.poz.length);
    for (let i = 0; i < poz.length; i++) poz[i] = c[i % 3] + (sit.poz[i] - c[i % 3]) * f;
    return { poz, idx: sit.idx };
  }

  /* ======================= analýza ======================= */
  function objemAPlocha(sit) {
    const P = sit.poz, I = sit.idx; let V = 0, A = 0;
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      V += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      A += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
    return { objem: V, plocha: A };
  }

  /** Plocha průřezu uzavřené orientované sítě rovinou z = h (součet orientovaných úseček řezu). */
  function prurez(sit, h) {
    const P = sit.poz, I = sit.idx; let A = 0;
    for (let t = 0; t < I.length; t += 3) {
      const v = [3 * I[t], 3 * I[t + 1], 3 * I[t + 2]];
      const pod = v.map(i => P[i + 2] < h);
      if (pod[0] === pod[1] && pod[1] === pod[2]) continue;
      const body = [];
      for (let k = 0; k < 3; k++) {
        const i = v[k], j = v[(k + 1) % 3];
        if (pod[k] === pod[(k + 1) % 3]) continue;
        const s = (h - P[i + 2]) / (P[j + 2] - P[i + 2]);
        body.push([P[i] + s * (P[j] - P[i]), P[i + 1] + s * (P[j + 1] - P[i + 1])]);
      }
      if (body.length !== 2) continue;
      // směr úsečky: vnější normála po pravé ruce (d = (−ny, nx))
      const a = v[0], b = v[1], c = v[2];
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz;
      let [p, q] = body;
      if ((q[0] - p[0]) * -ny + (q[1] - p[1]) * nx < 0) [p, q] = [q, p];
      A += (p[0] * q[1] - q[0] * p[1]) / 2;
    }
    return A;
  }

  /** Zákryt svislým paprskem: pro každý trojúhelník, zda nad ním (nahoru) / pod ním (dolu) leží jiná část modelu.
      Mřížka v půdorysu, paprsek z těžiště posunutého kousek ven po normále. */
  function zakryti(sit) {
    const P = sit.poz, I = sit.idx, nT = I.length / 3, b = obal(P);
    const diag = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) || 1, eps = 1e-3 * diag;
    const N = Math.max(4, Math.min(256, Math.ceil(Math.sqrt(nT) / 1.5)));
    const sx = (b[3] - b[0]) / N || 1, sy = (b[4] - b[1]) / N || 1;
    const bunky = Array.from({ length: N * N }, () => []);
    const cel = (x, s, o) => Math.max(0, Math.min(N - 1, Math.floor((x - o) / s)));
    const T = new Float64Array(9 * nT);
    for (let t = 0; t < nT; t++) {
      for (let k = 0; k < 3; k++) for (let q = 0; q < 3; q++) T[9 * t + 3 * k + q] = P[3 * I[3 * t + k] + q];
      const xs = [T[9 * t], T[9 * t + 3], T[9 * t + 6]], ys = [T[9 * t + 1], T[9 * t + 4], T[9 * t + 7]];
      const i0 = cel(Math.min(...xs), sx, b[0]), i1 = cel(Math.max(...xs), sx, b[0]), j0 = cel(Math.min(...ys), sy, b[1]), j1 = cel(Math.max(...ys), sy, b[1]);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) bunky[j * N + i].push(t);
    }
    const nahoru = new Uint8Array(nT), dolu = new Uint8Array(nT);
    for (let t = 0; t < nT; t++) {
      const o = 9 * t;
      const ux = T[o + 3] - T[o], uy = T[o + 4] - T[o + 1], uz = T[o + 5] - T[o + 2], vx = T[o + 6] - T[o], vy = T[o + 7] - T[o + 1], vz = T[o + 8] - T[o + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const cx = (T[o] + T[o + 3] + T[o + 6]) / 3 + nx * eps, cy = (T[o + 1] + T[o + 4] + T[o + 7]) / 3 + ny * eps, cz = (T[o + 2] + T[o + 5] + T[o + 8]) / 3 + nz * eps;
      // zákryt má smysl jen ve směru, kam ploška hledí (nebo pro svislé stěny)
      const hledNahoru = nz > -0.01, hledDolu = nz < 0.01;
      for (const u of bunky[cel(cy, sy, b[1]) * N + cel(cx, sx, b[0])]) {
        if (u === t || ((nahoru[t] || !hledNahoru) && (dolu[t] || !hledDolu))) continue;
        const r = 9 * u;
        const x0 = T[r], y0 = T[r + 1], x1 = T[r + 3], y1 = T[r + 4], x2 = T[r + 6], y2 = T[r + 7];
        const D = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
        if (Math.abs(D) < 1e-12) continue;
        const l0 = ((y1 - y2) * (cx - x2) + (x2 - x1) * (cy - y2)) / D, l1 = ((y2 - y0) * (cx - x2) + (x0 - x2) * (cy - y2)) / D, l2 = 1 - l0 - l1;
        if (l0 < 0 || l1 < 0 || l2 < 0) continue;
        const z = l0 * T[r + 2] + l1 * T[r + 5] + l2 * T[r + 8];
        if (z > cz + eps && hledNahoru) nahoru[t] = 1; else if (z < cz - eps && hledDolu) dolu[t] = 1;
      }
    }
    return { nahoru, dolu };
  }

  /** Stav ploch pro vyjímání: 0 = v pořádku, 1 = malý úkos, 2 = podkos, 3 = netýká se (mimo dutinu / pružný silikon).
      rezim 'dvoudilna': nad rovinou h se vyjímá nahoru, pod ní dolů; 'otevrena': pod h nahoru, nad h mimo. */
  function podkosy(sit, h, rezim, ukosDeg, zak) {
    const P = sit.poz, I = sit.idx, nT = I.length / 3, stav = new Uint8Array(nT);
    const sinU = Math.sin(ukosDeg * Math.PI / 180), mez = Math.sin(0.5 * Math.PI / 180);
    let plocha = 0, aPodkos = 0, aMaly = 0;
    for (let t = 0; t < nT; t++) {
      const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1, A = l / 2;
      const cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
      // otevřená forma: plošky v hladině a nad ní nejsou v dutině
      if (rezim === 'box' || (rezim === 'otevrena' && cz > h - 1e-3)) { stav[t] = 3; continue; }
      // směr pohybu formy vůči odlitku: horní díl nahoru, dolní dolů, otevřená forma dolů (odlitek ven nahoru)
      const smer = rezim === 'otevrena' ? -1 : (cz >= h ? 1 : -1);
      const s = smer * nz / l;
      const zakryt = zak ? (smer > 0 ? zak.nahoru[t] : zak.dolu[t]) : 0;
      if (s < -mez || zakryt) stav[t] = 2; else if (s < sinU) stav[t] = 1;
      plocha += A; if (stav[t] === 2) aPodkos += A; else if (stav[t] === 1) aMaly += A;
    }
    return { stav, plocha, aPodkos, aMaly };
  }

  /** Návrh výšky roviny: 'prurez' = největší průřez; 'podkosy' = nejmenší plocha podkosů (otevřená forma: nejvyšší rovina s minimem). */
  function navrhRoviny(sit, rezimRoviny, rezimFormy, ukos, zak) {
    const b = obal(sit.poz), H = b[5] - b[2], n = 64;
    const kand = [];
    for (let i = 1; i < n; i++) {
      const h = Math.round((b[2] + H * i / n) * 100) / 100;
      kand.push({ h, A: prurez(sit, h) });
    }
    if (rezimFormy === 'otevrena') kand.push({ h: b[5], A: 0 });
    if (rezimRoviny !== 'podkosy') return kand.reduce((m, k) => (k.A > m.A + 1e-9 ? k : m)).h;
    for (const k of kand) k.P = podkosy(sit, k.h, rezimFormy, 0, zak).aPodkos;
    const min = Math.min(...kand.map(k => k.P)), tol = min + 0.002 * (objemAPlocha(sit).plocha);
    const dobre = kand.filter(k => k.P <= tol);
    if (rezimFormy === 'otevrena') return dobre.reduce((m, k) => (k.h > m.h ? k : m)).h;
    return dobre.reduce((m, k) => (k.A > m.A + 1e-9 ? k : m)).h;
  }

  /** Vrcholy, které jsou místním maximem výšky (nahoře se chytá vzduch), seřazené od nejvyššího. */
  function mistniMaxima(sit) {
    const P = sit.poz, I = sit.idx, nV = P.length / 3, nej = new Uint8Array(nV).fill(1), pouz = new Uint8Array(nV);
    for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) {
      const a = I[t + k], b = I[t + (k + 1) % 3]; pouz[a] = 1;
      if (P[3 * b + 2] > P[3 * a + 2]) nej[a] = 0; if (P[3 * a + 2] > P[3 * b + 2]) nej[b] = 0;
    }
    const out = [];
    for (let v = 0; v < nV; v++) if (pouz[v] && nej[v]) out.push([P[3 * v], P[3 * v + 1], P[3 * v + 2]]);
    return out.sort((x, y) => y[2] - x[2]);
  }

  /** Výběr nejvzdálenějších bodů (rovnoměrné rozmístění): první nejdál od středu, další s největší nejmenší vzdáleností. */
  function vyberRozlozene(kandidati, pocet, uz = [], minVzd = 0, stred = [0, 0]) {
    const vybrane = [];
    const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    for (let i = 0; i < pocet; i++) {
      let nej = null, nejD = -1;
      for (const k of kandidati) {
        const vse = [...uz, ...vybrane];
        const d = vse.length ? Math.min(...vse.map(q => d2(q, k))) : d2(k, stred);
        if (vse.length && d < minVzd * minVzd) continue;
        if (d > nejD + 1e-9) { nejD = d; nej = k; }
      }
      if (!nej) break;
      vybrane.push(nej);
    }
    return vybrane;
  }

  /** Bod v mnohoúhelnících (pravidlo sudý–lichý; díry jsou samostatné obrysy). */
  function vMnohouhelniku(bod, polygony) {
    let uvnitr = false;
    for (const pol of polygony) {
      for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
        const [xi, yi] = pol[i], [xj, yj] = pol[j];
        if ((yi > bod[1]) !== (yj > bod[1]) && bod[0] < (xj - xi) * (bod[1] - yi) / (yj - yi) + xi) uvnitr = !uvnitr;
      }
    }
    return uvnitr;
  }

  /* Geometrie zámku: čep komolý kužel (spodní poloměr r, úkos α), jamka = čep zvětšený o vůli kolmo k ploše. */
  function zamek(z) {
    const r = z.prumer / 2, a = z.uhel * Math.PI / 180, tg = Math.tan(a), v = z.vule;
    const cep = { r1: r, r2: r - z.vyska * tg, h: z.vyska };
    const R = r + v / Math.cos(a);
    const jamka = { r1: R, r2: R - (z.vyska + v) * tg, h: z.vyska + v };
    return { cep, jamka, vuleBok: v / Math.cos(a) };
  }

  /* ======================= kontroly ======================= */
  /** info = výsledek stavby a analýzy (viz FORMY_GEO.postav + podkosy). Hlášení {typ, text, pole}. */
  function kontroly(p, info) {
    const H = [], h = (typ, text, pole) => H.push({ typ, text, pole });
    if (!info || info.chyba) { h('chyba', info ? info.chyba : 'Model není načtený.', 'f_zdroj'); return H; }
    const mat = MATERIALY[p.material];
    if (info.tesnost && !info.tesnost.uzavrena) h('chyba', 'Model není uzavřený.', 'f_zdroj');
    if (info.opravy && info.opravy.length) h('info', 'Model opraven: ' + info.opravy.join('; ') + '.', 'f_zdroj');
    if (info.trojuhelniku > 300000) h('varovani', `Model má ${info.trojuhelniku.toLocaleString('cs-CZ')} trojúhelníků – výpočet bude pomalý; zjednodušte ho ve sliceru nebo CADu.`, 'f_zdroj');
    if (p.rezim !== 'box' && info.podkosy) {
      const pk = info.podkosy, pct = pk.plocha ? 100 * pk.aPodkos / pk.plocha : 0;
      if (pk.aPodkos > 0.002 * pk.plocha) h('chyba', `Podkosy na ${fmt(pct, 1)} % plochy dutiny (${fmt(pk.aPodkos / 100, 1)} cm², v náhledu červeně) – odlitek nepůjde z pevné formy vyjmout. Zkuste jinou rovinu nebo osu vyjímání, případně silikonovou formu (box).`, p.rovina.rezim === 'rucne' ? 'f_rovina' : 'f_rovRezim');
      else if (pk.aPodkos > 0) h('varovani', `Drobné podkosy (${fmt(pk.aPodkos, 1)} mm²) – nejspíš jen fazetky na rovině; zkontrolujte červená místa v náhledu.`, 'f_rovina');
      else h('ok', 'Bez podkosů – odlitek jde vyjmout ve směru vyjímání.');
      if (pk.aMaly > 0.05 * pk.plocha) h('varovani', `${fmt(100 * pk.aMaly / pk.plocha, 0)} % plochy má úkos pod ${fmt(p.ukos, 1)}° (oranžově) – vyjímání půjde ztuha, pomůže separátor.`, 'f_ukos');
    }
    if (p.rezim === 'dvoudilna') {
      const z = zamek(p.zamky);
      if (p.forma.stena < p.minStena) h('chyba', `Stěna formy ${fmt(p.forma.stena)} mm je tenčí než nejmenší stěna ${fmt(p.minStena)} mm.`, 'f_stena');
      if (p.zamky.pocet > 0) {
        if (z.jamka.r2 <= 0.3 || z.cep.r2 <= 0.3) h('chyba', 'Zámek je při tomto úkosu a výšce špičatý – zmenšete úkos nebo výšku, nebo zvětšete průměr.', 'f_zUhel');
        if (info.zamky.length < p.zamky.pocet) h('varovani', `Vešlo se jen ${info.zamky.length} z ${p.zamky.pocet} zámků – zvětšete stěnu formy nebo zmenšete průměr zámku.`, 'f_stena');
        if (p.zamky.vule < 0.1) h('varovani', 'Vůle zámků pod 0,1 mm – díly půjdou na běžné tiskárně ztuha nebo vůbec.', 'f_zVule');
        if (p.zamky.vule > 0.6) h('varovani', 'Vůle zámků nad 0,6 mm – díly se budou proti sobě viklat a odlitek dostane přesazený šev.', 'f_zVule');
        if (p.zamky.vyska + p.zamky.vule > info.vyskaHorni - p.minStena) h('chyba', 'Jamka zámku by prošla horním dílem – zmenšete výšku zámku nebo zvyšte stěnu.', 'f_zVyska');
      } else h('varovani', 'Bez zámků se díly snadno posunou – přesazený šev odlitku.', 'f_zPocet');
      if (p.srouby.pocet > info.srouby.length) h('varovani', `Vešlo se jen ${info.srouby.length} z ${p.srouby.pocet} otvorů na šrouby – zvětšete stěnu.`, 'f_sPocet');
      const minVtok = mat.tekutost === 'husta' ? 8 : mat.tekutost === 'stredni' ? 5 : 3;
      if (p.vtok.prumer < minVtok) h('varovani', `${mat.nazev}: vtok ${fmt(p.vtok.prumer)} mm je úzký, doporučeno aspoň ${minVtok} mm.`, 'f_vtok');
      if (info.vtok && p.vtok.prumer > 0.8 * Math.min(info.rozmery[0], info.rozmery[1])) h('varovani', 'Vtok je širší než skoro celý model – zmenšete průměr vtoku.', 'f_vtok');
      if (info.vzduchZbyva > 0) h('info', `Dalších ${info.vzduchZbyva} míst může zachytit vzduch (místní vrcholy pod stropem dutiny) – přidejte odvzdušnění.`, 'f_vzPocet');
      if (info.rovinaMimo) h('chyba', 'Dělicí rovina leží mimo model – zadejte výšku mezi spodkem a vrškem modelu.', 'f_rovina');
    }
    if (p.rezim === 'box') {
      if (p.box.odstup < 5) h('varovani', 'Odstup pod 5 mm – silikonová forma bude tenká a při vyjímání se trhá.', 'f_bOdstup');
      if (p.box.cepVyska < 3) h('varovani', 'Čep nižší než 3 mm – pod modelem bude tenká vrstva silikonu.', 'f_bCepV');
      if (p.box.cepPrumer > 0.6 * Math.min(info.rozmery[0], info.rozmery[1])) h('varovani', 'Čep je široký vůči modelu – v odlitku zůstane velká plocha po vtoku.', 'f_bCepD');
      if (p.box.stena < p.minStena) h('varovani', `Stěna rámečku ${fmt(p.box.stena)} mm je tenčí než nejmenší stěna – silikon ji může vyboulit.`, 'f_bStena');
      if (p.box.vule < 0.1) h('varovani', 'Vůle rámečku pod 0,1 mm – rámeček na podstavec nepůjde nasadit.', 'f_bVule');
      if (p.box.vule > 0.5) h('varovani', 'Vůle rámečku nad 0,5 mm – řídký silikon může spárou vytéct (utěsněte plastelínou).', 'f_bVule');
      if (/^silikon/.test(p.material)) h('ok', 'Silikonová forma je pružná – podkosy nevadí, model se vyloupne.');
      else h('varovani', `Box je na lití silikonu – zvolený materiál je ${mat.nazev.toLowerCase()}.`, 'f_material');
    }
    if (p.rezim === 'otevrena') {
      if (p.otevrena.dno < p.minStena) h('chyba', `Dno ${fmt(p.otevrena.dno)} mm je tenčí než nejmenší stěna.`, 'f_oDno');
      if (p.otevrena.stena < p.minStena) h('chyba', `Stěna ${fmt(p.otevrena.stena)} mm je tenčí než nejmenší stěna.`, 'f_oStena');
      if (p.otevrena.mezera < p.minStena && p.otevrena.nx * p.otevrena.ny > 1) h('varovani', 'Mezera mezi dutinami je tenčí než nejmenší stěna.', 'f_oMezera');
      if (info.rovinaMimo) h('chyba', 'Hladina leží mimo model – zadejte výšku mezi spodkem a vrškem modelu.', 'f_rovina');
    }
    if (p.smrsteni > 0) h('info', `Dutina je zvětšená o ${fmt(p.smrsteni, 2)} % (smrštění odlitku).`, 'f_smrst');
    for (const d of info.dily || []) {
      const b = d.bbox;
      if (b && Math.max(b[3] - b[0], b[4] - b[1]) > 250) { h('varovani', `${d.nazev}: ${fmt(b[3] - b[0], 0)} × ${fmt(b[4] - b[1], 0)} mm – nevejde se na běžnou tiskárnu (do 250 mm).`, 'f_meritko'); break; }
    }
    if (!H.some(x => x.typ === 'chyba' || x.typ === 'varovani')) h('ok', 'Kontroly bez výhrad.');
    return H;
  }

  /** Spotřeba materiálu odlitku: objem (mm³) → ml, g, složky podle poměru míchání, s rezervou. */
  function spotreba(objemMm3, materialKlic, rezervaPct, kusu = 1) {
    const m = MATERIALY[materialKlic], ml = objemMm3 / 1000 * kusu, g = ml * m.hustota, sR = 1 + rezervaPct / 100;
    const out = { ml, g, mlR: ml * sR, gR: g * sR, slozky: null };
    if (m.slozky) { const s = m.pomer[0] + m.pomer[1]; out.slozky = m.slozky.map((n, i) => ({ nazev: n, g: out.gR * m.pomer[i] / s })); }
    return out;
  }

  /** Hrubý odhad tisku dílu: obvodová skořepina 1,2 mm + výplň, průtok ~7 mm³/s. */
  function odhadTisku(objem, plocha, tisk) {
    const skor = Math.min(objem, plocha * 1.2), vypl = Math.max(0, objem - skor) * tisk.vypln / 100, V = skor + vypl;
    return { g: V / 1000 * TISK_MATERIALY[tisk.material].hustota, hodin: V / 7 / 3600 * 1.25 };
  }

  /** Příprava pro stavbu: natočení, dutina se smrštěním, zákryt, výška roviny a podkosy. src = surová síť modelu. */
  function priprava(p, src) {
    const model = umisti(src, p.model), dutina = p.smrsteni ? zvetsi(model, p.smrsteni) : model;
    const zak = zakryti(dutina), b = obal(dutina.poz);
    const h = p.rezim === 'box' ? b[5] : p.rovina.rezim === 'rucne' ? b[2] + p.rovina.vyska
      : navrhRoviny(dutina, p.rovina.rezim, p.rezim, p.ukos, zak);
    return { model, dutina, zak, h, bbox: b, podkosy: podkosy(dutina, h, p.rezim, p.ukos, zak) };
  }

  /* ---------- projekt ---------- */
  const b64 = {
    z: u8 => (typeof Buffer !== 'undefined' ? Buffer.from(u8).toString('base64') : btoa(Array.from(u8, c => String.fromCharCode(c)).join(''))),
    na: s => (typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(s, 'base64')) : Uint8Array.from(atob(s), c => c.charCodeAt(0))),
  };
  /** Projekt JSON; vlastní model (síť) se přibalí v base64, aby projekt šel otevřít jinde. */
  function ulozProjekt(p, sit, nazevModelu) {
    const o = { format: 'webapp_formy', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p };
    if (p.model.zdroj === 'soubor' && sit) o.model = { nazev: nazevModelu || 'model', poz: b64.z(new Uint8Array(new Float32Array(sit.poz).buffer)), idx: b64.z(new Uint8Array(new Uint32Array(sit.idx).buffer)) };
    return JSON.stringify(o);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || o.format !== 'webapp_formy') throw new Error('Soubor není projekt formy (chybí "format": "webapp_formy").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    const r = normalizuj(o.projekt);
    if (o.model) {
      const poz = b64.na(o.model.poz), idx = b64.na(o.model.idx);
      r.model = { nazev: String(o.model.nazev || 'model'), sit: { poz: new Float32Array(poz.buffer.slice(poz.byteOffset, poz.byteOffset + poz.byteLength)), idx: new Uint32Array(idx.buffer.slice(idx.byteOffset, idx.byteOffset + idx.byteLength)) } };
    } else if (r.p.model.zdroj === 'soubor') r.hlaseni.push('projekt neobsahuje síť modelu – nahrajte STL znovu');
    return r;
  }

  const API = {
    VERZE_FORMATU, MATERIALY, TISK_MATERIALY, UKAZKY, REZIMY, VYCHOZI, ROZSAHY, PREDVOLBY, NAZVY_POLI,
    kopie, cislo, fmt, vezmi, poloz, normalizuj,
    nactiStl, nacti3mf, rozbalZip, svar, bezDuplicit, sjednotOrientaci, tesnost, pripravSit, obal,
    umisti, zvetsi, priprava, objemAPlocha, prurez, zakryti, podkosy, navrhRoviny, mistniMaxima, vyberRozlozene, vMnohouhelniku, zamek,
    kontroly, spotreba, odhadTisku, ulozProjekt, nactiProjekt,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.FORMY = API;
})();
