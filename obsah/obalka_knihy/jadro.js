/* ============================================================
   obalka_knihy/jadro.js – výpočty obálky knihy bez DOM
   (rozměry archu, šířka hřbetu, ISBN, vzory EAN-13 a EAN-5,
   geometrie čárového kódu, zalomení textu, pHYs v PNG).
   Všechny délky v milimetrech, pokud není řečeno jinak.
   Prohlížeč: window.OBALKA, node: module.exports.
   ============================================================ */
(function (koren, tvorba) {
  if (typeof module === 'object' && module.exports) module.exports = tvorba();
  else koren.OBALKA = tvorba();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const PALEC = 25.4;

  /* ---------- formáty knižního bloku (ořezaný rozměr) ---------- */
  const FORMATY = {
    a5:   { nazev: 'A5 (148 × 210 mm)', sirka: 148, vyska: 210 },
    b6:   { nazev: 'B6 (125 × 176 mm)', sirka: 125, vyska: 176 },
    f1320:{ nazev: '13 × 20 cm', sirka: 130, vyska: 200 },
    us6x9:{ nazev: '6 × 9" (152,4 × 228,6 mm)', sirka: 6 * PALEC, vyska: 9 * PALEC },
    vlastni: { nazev: 'Vlastní rozměr' },
  };

  /* ---------- papíry ----------
     typ 'kdp'  – vzorec Amazon KDP: šířka hřbetu = počet stran × koeficient (palce na stranu)
     typ 'list' – tloušťka listu = gramáž × objemnost (µm = g/m² × cm³/g); hřbet = listy × tloušťka */
  const PAPIRY = {
    offset80:   { nazev: 'Offset 80 g (objemnost 1,25)', typ: 'list', gramaz: 80, objemnost: 1.25 },
    kniha90:    { nazev: 'Knižní 90 g krémový (objemnost 1,5)', typ: 'list', gramaz: 90, objemnost: 1.5 },
    kdp_bily:   { nazev: 'KDP bílý (0,002252" na stranu)', typ: 'kdp', naStranu: 0.002252 },
    kdp_kremovy:{ nazev: 'KDP krémový (0,0025" na stranu)', typ: 'kdp', naStranu: 0.0025 },
    vlastni:    { nazev: 'Vlastní (gramáž a objemnost / tloušťka listu)', typ: 'list' },
  };

  /* ---------- tiskárny ---------- */
  const TISKARNY = {
    obecna: { nazev: 'Obecná tiskárna', spad: 3, bezpecna: 5, pridavek: 0.5, okrajHrbetu: 1 },
    kdp: { nazev: 'Amazon KDP – brožura (paperback)', spad: 0.125 * PALEC, bezpecna: 0.125 * PALEC,
      pridavek: 0, okrajHrbetu: 0.0625 * PALEC, minStran: 24, maxStran: { kdp_bily: 828, kdp_kremovy: 776 },
      textHrbetuOd: 80, kod: { sirka: 2 * PALEC, vyska: 1.2 * PALEC, odHrbetu: 0.25 * PALEC, odSpodu: 0.25 * PALEC } },
  };
  /* Pevná vazba (předpoklady – ověřit u knihárny):
     deska široká = šířka bloku + přesah − odsazení u kloubu, vysoká = výška bloku + 2 × přesah,
     hřbet desek = tloušťka bloku + 2 × tloušťka lepenky (rovný hřbet),
     mezi deskou a hřbetem drážka (kloub), kolem dokola obtah (přehyb na vnitřní stranu desek). */
  const PEVNA = { presah: 3, odsazeni: 3, lepenka: 2.5, drazka: 8, obtah: 15, bezpecna: 6 };

  const mmNaPalce = mm => mm / PALEC;

  /* tloušťka listu v µm podle papíru (objekt z PAPIRY + vlastní hodnoty) */
  function tloustkaListu(p) {
    if (p.tloustka > 0) return p.tloustka;
    return (p.gramaz || 0) * (p.objemnost || 0);
  }

  /* šířka hřbetu knižního bloku v mm (bez přídavku)
     strany = počet stran (2 strany = 1 list) */
  function hrbetBloku(strany, papir) {
    strany = Math.max(0, Math.round(strany || 0));
    if (papir.typ === 'kdp') return strany * papir.naStranu * PALEC;
    return Math.ceil(strany / 2) * tloustkaListu(papir) / 1000;
  }

  /* Rozměry celého archu obálky.
     o = {sirka, vyska, hrbet (mm, už s přídavkem), spad, vazba:'mekka'|'pevna', pevna:{...}}
     Vrací souřadnice (počátek vlevo nahoře na hraně archu, osa y dolů):
       sirka, vyska     – celý arch včetně spadávky / obtahu
       orez             – obdélník ořezu (měkká) / vnější hrana desek (pevná)
       zadni, hrbet, predni – panely (bez spadávky)
       drazky           – svislé čáry drážek (x), u měkké vazby přehyby hřbetu */
  function arch(o) {
    const W = +o.sirka, H = +o.vyska, S = Math.max(0, +o.hrbet || 0);
    if (o.vazba === 'pevna') {
      const p = Object.assign({}, PEVNA, o.pevna || {});
      const Bw = W + p.presah - p.odsazeni, Bh = H + 2 * p.presah;
      const Sd = S + 2 * p.lepenka;
      const sirka = 2 * p.obtah + 2 * Bw + 2 * p.drazka + Sd, vyska = 2 * p.obtah + Bh;
      const y = p.obtah;
      const zadni = { x: p.obtah, y, w: Bw, h: Bh };
      const hrbet = { x: p.obtah + Bw + p.drazka, y, w: Sd, h: Bh };
      const predni = { x: hrbet.x + Sd + p.drazka, y, w: Bw, h: Bh };
      return {
        vazba: 'pevna', sirka, vyska, spad: p.obtah, zadni, hrbet, predni,
        orez: { x: p.obtah, y, w: sirka - 2 * p.obtah, h: Bh },
        drazky: [zadni.x + Bw, hrbet.x, hrbet.x + Sd, predni.x],
        deska: { w: Bw, h: Bh }, hrbetDesek: Sd, parametry: p,
      };
    }
    const spad = Math.max(0, +o.spad || 0);
    const zadni = { x: spad, y: spad, w: W, h: H };
    const hrbet = { x: spad + W, y: spad, w: S, h: H };
    const predni = { x: spad + W + S, y: spad, w: W, h: H };
    return {
      vazba: 'mekka', sirka: 2 * spad + 2 * W + S, vyska: 2 * spad + H, spad, zadni, hrbet, predni,
      orez: { x: spad, y: spad, w: 2 * W + S, h: H }, drazky: [hrbet.x, hrbet.x + S],
    };
  }

  /* obdélník zmenšený o d na všech stranách */
  const zmensi = (r, d) => ({ x: r.x + d, y: r.y + d, w: Math.max(0, r.w - 2 * d), h: Math.max(0, r.h - 2 * d) });

  /* ---------- ISBN ---------- */
  function cisti(s) { return String(s || '').toUpperCase().replace(/[^0-9X]/g, ''); }

  function kontrolni13(dvanact) {
    let s = 0;
    for (let i = 0; i < 12; i++) s += (+dvanact[i]) * (i % 2 ? 3 : 1);
    return String((10 - s % 10) % 10);
  }
  function kontrolni10(devet) {
    let s = 0;
    for (let i = 0; i < 9; i++) s += (+devet[i]) * (10 - i);
    const c = (11 - s % 11) % 11;
    return c === 10 ? 'X' : String(c);
  }
  function isbn10na13(isbn10) {
    const c = cisti(isbn10);
    if (!/^\d{9}[\dX]$/.test(c)) throw new Error('ISBN-10 musí mít 9 číslic a kontrolní znak');
    const z = '978' + c.slice(0, 9);
    return z + kontrolni13(z);
  }
  function isbn13na10(isbn13) {
    const c = cisti(isbn13);
    if (!/^978\d{10}$/.test(c)) return null;     // 979… nemá ISBN-10
    const z = c.slice(3, 12);
    return z + kontrolni10(z);
  }

  /* Rozbor zadaného ISBN. Vrací {platne, typ, isbn13, isbn10, chyba, ocekavana} */
  function rozborIsbn(vstup) {
    const c = cisti(vstup);
    if (!c) return { platne: false, chyba: 'prazdne' };
    if (c.length === 10) {
      if (!/^\d{9}[\dX]$/.test(c)) return { platne: false, typ: 10, chyba: 'znaky' };
      const k = kontrolni10(c.slice(0, 9));
      if (k !== c[9]) return { platne: false, typ: 10, chyba: 'kontrolni', ocekavana: k };
      return { platne: true, typ: 10, isbn10: c, isbn13: isbn10na13(c) };
    }
    if (c.length === 13) {
      if (!/^\d{13}$/.test(c)) return { platne: false, typ: 13, chyba: 'znaky' };
      if (!/^97[89]/.test(c)) return { platne: false, typ: 13, chyba: 'predpona' };
      const k = kontrolni13(c.slice(0, 12));
      if (k !== c[12]) return { platne: false, typ: 13, chyba: 'kontrolni', ocekavana: k };
      return { platne: true, typ: 13, isbn13: c, isbn10: isbn13na10(c) };
    }
    return { platne: false, chyba: 'delka', delka: c.length };
  }

  /* Text nad kódem: zachová pomlčky, jak je autor napsal (dělení ISBN
     na skupiny závisí na tabulkách agentury – nehádáme ho). */
  function textIsbn(vstup, isbn13) {
    const s = String(vstup || '').trim().replace(/^ISBN[\s:-]*/i, '').replace(/\s+/g, '-');
    if (s && cisti(s).length === 13 && cisti(s) === isbn13) return 'ISBN ' + s.toUpperCase();
    return 'ISBN ' + isbn13;
  }

  /* ---------- EAN-13 ---------- */
  const KOD_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const KOD_R = KOD_L.map(k => k.replace(/./g, b => (b === '1' ? '0' : '1')));
  const KOD_G = KOD_R.map(k => k.split('').reverse().join(''));
  const PARITA13 = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  const PARITA5 = ['GGLLL', 'GLGLL', 'GLLGL', 'GLLLG', 'LGGLL', 'LLGGL', 'LLLGG', 'LGLGL', 'LGLLG', 'LLGLG'];
  const kodZnaku = (d, p) => (p === 'L' ? KOD_L : p === 'G' ? KOD_G : KOD_R)[+d];

  /* 95 modulů ('1' = tmavý) */
  function ean13Vzor(kod) {
    kod = String(kod);
    if (!/^\d{13}$/.test(kod)) throw new Error('EAN-13 potřebuje 13 číslic');
    if (kontrolni13(kod) !== kod[12]) throw new Error('Chybná kontrolní číslice EAN-13');
    const par = PARITA13[+kod[0]];
    let s = '101';
    for (let i = 1; i <= 6; i++) s += kodZnaku(kod[i], par[i - 1]);
    s += '01010';
    for (let i = 7; i <= 12; i++) s += kodZnaku(kod[i], 'R');
    return s + '101';
  }

  function ean5Kontrolni(pet) {
    const d = String(pet).split('').map(Number);
    return (3 * (d[0] + d[2] + d[4]) + 9 * (d[1] + d[3])) % 10;
  }
  /* 47 modulů: start 1011, číslice po 7, mezi nimi oddělovač 01 */
  function ean5Vzor(pet) {
    pet = String(pet);
    if (!/^\d{5}$/.test(pet)) throw new Error('Doplněk EAN-5 potřebuje 5 číslic');
    const par = PARITA5[ean5Kontrolni(pet)];
    let s = '1011';
    for (let i = 0; i < 5; i++) { if (i) s += '01'; s += kodZnaku(pet[i], par[i]); }
    return s;
  }

  /* Doplněk s cenou podle zvyklostí knižního trhu:
     5 = USD, 6 = CAD, 0/1 = GBP, 3 = AUD, 4 = NZD; 90000 = bez ceny. */
  const MENY_EAN5 = { USD: '5', CAD: '6', GBP: '0', AUD: '3', NZD: '4' };
  function cenaNaEan5(mena, castka) {
    const c = MENY_EAN5[mena];
    if (!c) throw new Error('Neznámá měna');
    const centy = Math.round((+castka) * 100);
    if (!(centy >= 0) || centy > 9999) throw new Error('Cena musí být 0–99,99');
    return c + String(centy).padStart(4, '0');
  }

  /* běhy tmavých modulů: [{od, delka}] */
  function behy(vzor) {
    const v = [];
    for (let i = 0; i < vzor.length; i++) {
      if (vzor[i] !== '1') continue;
      let j = i; while (vzor[j + 1] === '1') j++;
      v.push({ od: i, delka: j - i + 1 }); i = j;
    }
    return v;
  }

  /* Geometrie čárového kódu ISBN (EAN-13 + volitelně EAN-5) v mm, počátek vlevo nahoře
     bílého pole. o = {isbn13, doplnek, zvetseni (1 = 100 %, modul 0,33 mm), bwr (zúžení pruhů, mm),
     vyskaPruhu (poměr 0,5–1 k nominální výšce), textIsbn}.
     Vrací {sirka, vyska, pruhy:[{x,y,w,h}], texty:[{text,x,y,velikost,zarovnani,krok}]} – y textu = účaří;
     'roztec' = znak i má střed v x + i·krok + 3,5 modulu. */
  function carovyKod(o) {
    const X = 0.33 * (o.zvetseni || 1);
    const bwr = Math.max(0, o.bwr || 0);
    const pomer = Math.min(1, Math.max(0.5, o.vyskaPruhu || 1));
    const hPruh = 22.85 * (o.zvetseni || 1) * pomer;     // nominální výška běžných pruhů
    const hStraz = hPruh + 5 * X;                       // ochranné pruhy jsou o 5 modulů delší
    const velCislic = 2.75 * (o.zvetseni || 1);         // výška číslic (≈ OCR-B 9 bodů při 100 %)
    const nad = o.textIsbn ? velCislic * 1.25 : 0;      // řádek „ISBN …“ nad kódem
    const tichaL = 11 * X, tichaP = 7 * X;
    const y0 = nad + X;
    const pruhy = [], texty = [];
    const vzor = ean13Vzor(o.isbn13);
    const STRAZ = new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]);
    for (const b of behy(vzor)) {
      const straz = STRAZ.has(b.od);
      pruhy.push({ x: tichaL + b.od * X + bwr / 2, y: y0, w: b.delka * X - bwr, h: straz ? hStraz : hPruh });
    }
    const yCis = y0 + hPruh + velCislic * 0.95 + X;
    texty.push({ text: o.isbn13[0], x: tichaL - 2 * X, y: yCis, velikost: velCislic, zarovnani: 'vpravo' });
    texty.push({ text: o.isbn13.slice(1, 7), x: tichaL + 3 * X, y: yCis, velikost: velCislic, zarovnani: 'roztec', krok: 7 * X });
    texty.push({ text: o.isbn13.slice(7), x: tichaL + 50 * X, y: yCis, velikost: velCislic, zarovnani: 'roztec', krok: 7 * X });
    let sirka = tichaL + 95 * X + tichaP;
    if (o.doplnek) {
      const v5 = ean5Vzor(o.doplnek);
      const x5 = tichaL + 95 * X + 9 * X;               // mezera 9 modulů (norma 7–12)
      const yb = y0 + velCislic * 1.1;                  // nad pruhy doplňku jsou jeho číslice
      for (const b of behy(v5)) pruhy.push({ x: x5 + b.od * X + bwr / 2, y: yb, w: b.delka * X - bwr, h: y0 + hStraz - yb });
      texty.push({ text: o.doplnek, x: x5 + 4 * X, y: y0 + velCislic * 0.9, velikost: velCislic, zarovnani: 'roztec', krok: 9 * X });
      sirka = x5 + 47 * X + 5 * X;
    }
    if (o.textIsbn) texty.push({ text: o.textIsbn, x: tichaL, y: nad * 0.8 + X * 0.5, velikost: velCislic * 0.95, zarovnani: 'vlevo', sirka: 95 * X });
    return { sirka, vyska: yCis + X * 2, pruhy, texty, modul: X };
  }

  /* ---------- zalomení textu ----------
     odstavce oddělené koncem řádku; mer(slovo) → šířka; vrací [{slova:[...], posledni:bool}] */
  function zalom(text, sirka, mer) {
    const mezera = mer(' ');
    const radky = [];
    for (const odst of String(text || '').replace(/\r/g, '').split('\n')) {
      const slova = odst.split(/\s+/).filter(Boolean);
      if (!slova.length) { radky.push({ slova: [], posledni: true, prazdny: true }); continue; }
      let r = [], w = 0;
      for (const s of slova) {
        const ws = mer(s);
        if (r.length && w + mezera + ws > sirka) { radky.push({ slova: r, posledni: false }); r = [s]; w = ws; }
        else { w += (r.length ? mezera : 0) + ws; r.push(s); }
      }
      radky.push({ slova: r, posledni: true });
    }
    return radky;
  }

  /* ---------- PNG: vložení chunku pHYs (rozlišení) ---------- */
  let CRC_T = null;
  function crc32(u8) {
    if (!CRC_T) { CRC_T = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c; } }
    let c = -1;
    for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }
  /* vrátí nové bajty PNG s pHYs = dpi (vloží za IHDR, starý pHYs vynechá) */
  function pngSDpi(u8, dpi) {
    const ppm = Math.round(dpi / 0.0254);
    const ch = new Uint8Array(21), dv = new DataView(ch.buffer);
    dv.setUint32(0, 9); ch.set([0x70, 0x48, 0x59, 0x73], 4);
    dv.setUint32(8, ppm); dv.setUint32(12, ppm); ch[16] = 1;
    dv.setUint32(17, crc32(ch.subarray(4, 17)));
    const vst = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const casti = [u8.subarray(0, 8)];
    let i = 8;
    while (i < u8.length) {
      const del = vst.getUint32(i), typ = String.fromCharCode(u8[i + 4], u8[i + 5], u8[i + 6], u8[i + 7]);
      const kus = u8.subarray(i, i + 12 + del);
      if (typ !== 'pHYs') casti.push(kus);
      if (typ === 'IHDR') casti.push(ch);
      i += 12 + del;
    }
    const ven = new Uint8Array(casti.reduce((s, c) => s + c.length, 0));
    let p = 0; for (const c of casti) { ven.set(c, p); p += c.length; }
    return ven;
  }

  /* ---------- kontrola návrhu → seznam upozornění ----------
     v = {tiskarna, papir, strany, hrbet, hrbetTextVyska, hrbetTextDelka, vyska} */
  function kontrola(v) {
    const z = [];
    const t = TISKARNY[v.tiskarna] || TISKARNY.obecna;
    if (v.tiskarna === 'kdp') {
      if (v.strany < t.minStran) z.push({ uroven: 'chyba', text: `KDP tiskne brožury od ${t.minStran} stran.` });
      const max = t.maxStran[v.papir];
      if (max && v.strany > max) z.push({ uroven: 'chyba', text: `KDP na tomto papíru tiskne nejvýš ${max} stran.` });
      if (!max) z.push({ uroven: 'varovani', text: 'Pro KDP zvolte papír KDP bílý nebo krémový – jiný vzorec hřbetu KDP nepřijme.' });
      if (v.maHrbetText && v.strany < t.textHrbetuOd) z.push({ uroven: 'chyba', text: `KDP dovolí text na hřbetu až od ${t.textHrbetuOd} stran.` });
    }
    if (v.strany % 2) z.push({ uroven: 'varovani', text: 'Lichý počet stran – kniha má vždy sudý počet (poslední strana bývá prázdná).' });
    if (v.maHrbetText) {
      const volno = v.hrbet - 2 * t.okrajHrbetu;
      if (v.hrbetTextVyska > volno) z.push({ uroven: 'chyba', text: 'Text na hřbetu je vyšší než hřbet (s okraji). Zmenšete písmo.' });
      if (v.hrbetTextDelka > v.vyska - 2 * (v.bezpecna || 0)) z.push({ uroven: 'chyba', text: 'Text na hřbetu je delší než hřbet. Zkraťte ho nebo zmenšete písmo.' });
    }
    if (v.hrbet < 3 && v.maHrbetText) z.push({ uroven: 'varovani', text: 'Hřbet užší než 3 mm – text na něm se při vazbě snadno posune na desky.' });
    return z;
  }


  /* ---------- návrh → rozměry ---------- */
  const VYCHOZI = {
    verze: 1,
    kniha: { format: 'a5', sirka: 148, vyska: 210, strany: 240, papir: 'offset80', gramaz: 80, objemnost: 1.25, tloustka: 0,
      tiskarna: 'obecna', vazba: 'mekka', spad: 3, bezpecna: 5, pridavek: 0.5, pevna: Object.assign({}, PEVNA) },
    pozadi: { typ: 'prechod', barva1: '#1d3557', barva2: '#5b8db8', uhel: 160 },
    obrArch: { id: null, zoom: 1, posX: 0, posY: 0, kryti: 100 },
    obrPredni: { id: null, zoom: 1, posX: 0, posY: 0, okraj: 0, vyska: 100, svisle: 'nahore' },
    nazev: { text: 'Název knihy', pismo: 'libserif', velikost: 30, barva: '#ffffff', y: 16, zarovnani: 'stred', prostrkani: 0, radkovani: 1.1 },
    podtitul: { text: 'Podtitul knihy', pismo: 'lserif-i', velikost: 14, barva: '#e8eef5', y: 33, zarovnani: 'stred', prostrkani: 0, radkovani: 1.2 },
    autor: { text: 'Jméno Autora', pismo: 'lserif', velikost: 16, barva: '#ffffff', y: 86, zarovnani: 'stred', prostrkani: 60, radkovani: 1.2 },
    hrbet: { text: 'Jméno Autora · Název knihy', pismo: 'libserif', velikost: 10, barva: '#ffffff', smer: 'shora', posun: 0, prostrkani: 40 },
    anotace: { text: 'Sem patří anotace – krátké shrnutí příběhu, které čtenáře přiměje knihu otevřít. Odstavce oddělte novým řádkem.\nDruhý odstavec může nést citát z recenze nebo pár slov o autorovi.', pismo: 'lserif', velikost: 10, barva: '#ffffff', y: 12, zarovnani: 'blok', okraj: 10, radkovani: 1.4 },
    logo: { id: null, sirka: 12, kde: 'hrbet' },
    isbn: { text: '', doplnek: '', zvetseni: 85, bwr: 0, pozice: 'vpravo', vyskaPruhu: 100, popisek: true },
  };

  function papirNavrhu(k) {
    if (k.papir === 'vlastni') return { typ: 'list', gramaz: +k.gramaz, objemnost: +k.objemnost, tloustka: +k.tloustka };
    return PAPIRY[k.papir] || PAPIRY.offset80;
  }
  /* k = navrh.kniha → {hrbetBloku, hrbet, arch, papir, bezpecna} */
  function zNavrhu(k) {
    const papir = papirNavrhu(k);
    const blok = hrbetBloku(k.strany, papir);
    const hrbet = blok + (+k.pridavek || 0);
    const a = arch({ sirka: +k.sirka, vyska: +k.vyska, hrbet, spad: +k.spad, vazba: k.vazba, pevna: k.pevna });
    const bezpecna = k.vazba === 'pevna' ? +((k.pevna && k.pevna.bezpecna) ?? PEVNA.bezpecna) : +k.bezpecna;
    return { hrbetBloku: blok, hrbet, arch: a, papir, bezpecna };
  }

  /* odhad počtu stran z počtu slov (A5 sazba ≈ 280 slov na stranu, jiné formáty podle plochy), zaokrouhleno na sudé */
  function odhadStran(slov, sirka, vyska) {
    const naStranu = 280 * (sirka * vyska) / (148 * 210);
    const s = Math.ceil(slov / naStranu) + 4;           // + titul, tiráž, obsah
    return Math.max(4, s + (s % 2));
  }

  return {
    VYCHOZI, papirNavrhu, zNavrhu, odhadStran,
    PALEC, FORMATY, PAPIRY, TISKARNY, PEVNA, mmNaPalce, tloustkaListu, hrbetBloku, arch, zmensi,
    cisti, kontrolni10, kontrolni13, isbn10na13, isbn13na10, rozborIsbn, textIsbn,
    KOD_L, KOD_G, KOD_R, ean13Vzor, ean5Kontrolni, ean5Vzor, cenaNaEan5, MENY_EAN5, behy, carovyKod,
    zalom, crc32, pngSDpi, kontrola,
  };
});
