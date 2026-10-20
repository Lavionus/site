/* Plakát s útržky – jádro bez DOM.
   Vše v milimetrech, osa y dolů. Výsledkem rozvržení je seznam primitiv (obd, cara, kruh, mnoho, text, obraz, qr),
   které stejně vykreslí SVG (náhled, tisk), plátno (PNG) i jsPDF (vektorové PDF).
   Text se láme a zmenšuje podle skutečných šířek glyfů (metrika z opentype.js) – bez kerningu a ligatur,
   stejně jako ho kreslí jsPDF, takže náhled odpovídá PDF.
   Export: window.PU i module.exports. */
(function (koren) {
  'use strict';
  const PU = {};

  /* ---------------- katalogy ---------------- */
  PU.FORMATY = {
    A3: { nazev: 'A3', w: 297, h: 420 },
    A4: { nazev: 'A4', w: 210, h: 297 },
    A5: { nazev: 'A5', w: 148, h: 210 },
    A6: { nazev: 'A6', w: 105, h: 148 },
    Letter: { nazev: 'Letter', w: 215.9, h: 279.4 },
    vlastni: { nazev: 'vlastní', w: 0, h: 0 }
  };
  PU.LISTY = { stejny: 'stejný jako plakát', A4: 'A4', A3: 'A3', Letter: 'Letter' };

  /* Písma: soubor = klíč ve window.FONTY_JS, js = cesta ke skriptu s base64 (relativně k obsah/). tucny = řez pro **tučné**, null = umělé ztučnění. */
  PU.PISMA = {
    lib_sans: { nazev: 'Liberation Sans', soubor: 'LiberationSans-Regular.ttf', js: 'stitky_panely/fonty/LiberationSans-Regular.ttf.js', tucny: 'lib_sans_b' },
    lib_sans_b: { nazev: 'Liberation Sans tučné', soubor: 'LiberationSans-Bold.ttf', js: 'fonty/js/LiberationSans-Bold.ttf.js', tucny: 'lib_sans_b' },
    lib_serif_b: { nazev: 'Liberation Serif tučné', soubor: 'LiberationSerif-Bold.ttf', js: 'fonty/js/LiberationSerif-Bold.ttf.js', tucny: 'lib_serif_b' },
    anton: { nazev: 'Anton (úzké výrazné)', soubor: 'Anton-Regular.ttf', js: 'fonty/js/Anton-Regular.ttf.js', tucny: 'anton' },
    bebas: { nazev: 'Bebas Neue (verzálky)', soubor: 'BebasNeue-Regular.ttf', js: 'fonty/js/BebasNeue-Regular.ttf.js', tucny: 'bebas' },
    archivo: { nazev: 'Archivo Black', soubor: 'ArchivoBlack-Regular.ttf', js: 'fonty/js/ArchivoBlack-Regular.ttf.js', tucny: 'archivo' },
    patrick: { nazev: 'Patrick Hand (ručně psané)', soubor: 'PatrickHand-Regular.ttf', js: 'fonty/js/PatrickHand-Regular.ttf.js', tucny: null },
    special: { nazev: 'Special Elite (psací stroj)', soubor: 'SpecialElite-Regular.ttf', js: 'fonty/js/SpecialElite-Regular.ttf.js', tucny: null },
    lobster: { nazev: 'Lobster', soubor: 'Lobster-Regular.ttf', js: 'fonty/js/Lobster-Regular.ttf.js', tucny: 'lobster' },
    pacifico: { nazev: 'Pacifico', soubor: 'Pacifico-Regular.ttf', js: 'fonty/js/Pacifico-Regular.ttf.js', tucny: 'pacifico' },
    amatic: { nazev: 'Amatic SC', soubor: 'AmaticSC-Bold.ttf', js: 'fonty/js/AmaticSC-Bold.ttf.js', tucny: 'amatic' }
  };
  PU.PISMA_NADPISU = ['lib_sans_b', 'lib_serif_b', 'anton', 'bebas', 'archivo', 'patrick', 'special', 'lobster', 'pacifico', 'amatic'];
  PU.PISMA_TEXTU = ['lib_sans', 'patrick', 'special'];

  PU.SCHEMATA = {
    modra: { nazev: 'Modrá', pozadi: '#ffffff', akcent: '#1f5fbf', naAkcentu: '#ffffff', text: '#1b1f24', jemny: '#e6eefa', cara: '#555b63' },
    cervena: { nazev: 'Červená', pozadi: '#ffffff', akcent: '#c62828', naAkcentu: '#ffffff', text: '#1b1b1b', jemny: '#fbe7e7', cara: '#5a5555' },
    zelena: { nazev: 'Zelená', pozadi: '#ffffff', akcent: '#2e7d32', naAkcentu: '#ffffff', text: '#1a1f1a', jemny: '#e5f3e6', cara: '#535a53' },
    oranzova: { nazev: 'Oranžová', pozadi: '#ffffff', akcent: '#d84315', naAkcentu: '#ffffff', text: '#1f1a17', jemny: '#fdebe3', cara: '#5c5652' },
    fialova: { nazev: 'Fialová', pozadi: '#ffffff', akcent: '#6a1b9a', naAkcentu: '#ffffff', text: '#1d1a20', jemny: '#f1e6f6', cara: '#58535c' },
    tyrkys: { nazev: 'Tyrkysová', pozadi: '#ffffff', akcent: '#00796b', naAkcentu: '#ffffff', text: '#162020', jemny: '#e0f2ef', cara: '#4f5958' },
    papir: { nazev: 'Žlutý papír', pozadi: '#fff6bf', akcent: '#3b3324', naAkcentu: '#fff6bf', text: '#2a2418', jemny: '#f5e9a3', cara: '#6b6248' },
    noc: { nazev: 'Tmavá', pozadi: '#1f2a36', akcent: '#ffc928', naAkcentu: '#1f2a36', text: '#f4f6f8', jemny: '#2c3a49', cara: '#aab4bf' },
    cb: { nazev: 'Černobílá', pozadi: '#ffffff', akcent: '#111111', naAkcentu: '#ffffff', text: '#111111', jemny: '#eeeeee', cara: '#444444' }
  };
  /* Úsporný tisk: bílý papír, černá, žádné plné plochy (jen obrysy). */
  PU.barvy = function (schema, usporny) {
    const s = PU.SCHEMATA[schema] || PU.SCHEMATA.modra;
    if (!usporny) return Object.assign({ bezPloch: false }, s);
    return { nazev: s.nazev + ' (úsporně)', pozadi: '#ffffff', akcent: '#000000', naAkcentu: '#000000', text: '#000000', jemny: '#ffffff', cara: '#000000', bezPloch: true };
  };

  PU.ROZLOZENI = {
    klasicke: 'Klasické (obrázek pod nadpisem)',
    obrazek_vlevo: 'Obrázek vlevo',
    obrazek_vpravo: 'Obrázek vpravo',
    pruh: 'Barevný pruh nahoře'
  };

  PU.PREDVOLBY = {
    nabizim: { nazev: 'Nabízím', stitek: 'NABÍZÍM', schema: 'modra', nadpis: 'Doučování matematiky', podnadpis: 'ZŠ i střední škola, příprava na přijímačky',
      text: '**Zkušený student MFF UK** nabízí doučování:\n- matematika 6.–9. třída\n- příprava na přijímací zkoušky\n- středoškolská matematika a fyzika\nU vás doma nebo online.', cena: '300 Kč / hod', popisUtrzku: 'Doučování matematiky' },
    hledam: { nazev: 'Hledám', stitek: 'HLEDÁM', schema: 'tyrkys', nadpis: 'Hledám pronájem bytu 2+kk', podnadpis: 'v okolí centra, nejlépe od prosince',
      text: 'Mladý pár bez zvířat hledá **dlouhodobý pronájem**.\n- 2+kk nebo 2+1\n- do 18 000 Kč včetně energií\n- MHD do 10 minut\nSpolehlivé platby, reference rádi doložíme.', cena: '', popisUtrzku: 'Hledáme byt 2+kk' },
    prodam: { nazev: 'Prodám', stitek: 'PRODÁM', schema: 'zelena', nadpis: 'Prodám dětské kolo', podnadpis: '20" kola, věk 6–9 let, málo jeté',
      text: '**Stav:** velmi dobrý, garážované\n- nové brzdové špalky\n- světla a zvonek\n- stojánek\nMožno vyzkoušet po domluvě.', cena: '1 800 Kč', popisUtrzku: 'Dětské kolo 1 800 Kč' },
    daruji: { nazev: 'Daruji', stitek: 'DARUJI', schema: 'oranzova', nadpis: 'Daruji koťátka', podnadpis: 'do dobrých rukou, odčervená, zvyklá na lidi',
      text: 'Tři koťátka (2 kocouři, 1 kočička) hledají nový domov.\n- věk 10 týdnů\n- čistotná, zvyklá na děti\nPřijeďte se podívat!', cena: 'ZDARMA', popisUtrzku: 'Koťátka zdarma' },
    ztratil: { nazev: 'Ztratil se', stitek: 'ZTRATIL SE', schema: 'cervena', nadpis: 'Ztratil se pes Ben', podnadpis: 'naposledy viděn 18. 10. v parku u nádraží',
      text: '**Kříženec labradora**, černý, bílá skvrna na hrudi.\n- červený obojek se jmenovkou\n- je přátelský, ale bojácný\nProsím nehoňte ho, zavolejte.', cena: 'Odměna 2 000 Kč', popisUtrzku: 'Pes Ben – volejte' },
    nalezeno: { nazev: 'Nalezeno', stitek: 'NALEZENO', schema: 'tyrkys', nadpis: 'Našli jsme klíče', podnadpis: 'svazek tří klíčů s modrou přívěskou',
      text: 'Nalezeno **20. 10.** na lavičce u dětského hřiště.\nMajitel si je může vyzvednout po popisu.', cena: '', popisUtrzku: 'Nalezené klíče' },
    akce: { nazev: 'Akce', stitek: 'POZVÁNKA', schema: 'fialova', nadpis: 'Sousedská burza', podnadpis: 'sobota 8. 11. od 9 do 13 hodin, dvůr domu č. 12',
      text: 'Přineste, co doma nepotřebujete, a odneste si, co se hodí.\n- oblečení, hračky, knihy\n- domácí koláče a káva\n**Vstup volný.**', cena: '', popisUtrzku: 'Burza 8. 11.' },
    sluzby: { nazev: 'Služby', stitek: 'SLUŽBY', schema: 'modra', nadpis: 'Hlídání dětí a doprovod', podnadpis: 'odpoledne, večery i víkendy',
      text: 'Studentka pedagogiky, **první pomoc**, řidičský průkaz.\n- vyzvednutí ze školy a kroužků\n- pomoc s úkoly\n- hlídání nemocných dětí', cena: '200 Kč / hod', popisUtrzku: 'Hlídání dětí' },
    vlastni: { nazev: 'Vlastní', stitek: '', schema: 'cb', nadpis: 'Nadpis', podnadpis: '', text: 'Sem napište text inzerátu.', cena: '', popisUtrzku: '' }
  };

  PU.vychoziStav = function () {
    const p = PU.PREDVOLBY.nabizim;
    return {
      v: 1, nazev: '', predvolba: 'nabizim',
      stitek: p.stitek, nadpis: p.nadpis, podnadpis: p.podnadpis, text: p.text, cena: p.cena,
      zarovnani: 'stred', rozlozeni: 'klasicke', schema: p.schema, usporny: false, ramecek: true,
      pismoNadpis: 'lib_sans_b', pismoText: 'lib_sans',
      obrazek: { id: '', sirkaPx: 0, vyskaPx: 0, prizpusobeni: 'vyplnit', podil: 35, zoom: 1, posunX: 0, posunY: 0, sedy: false },
      qr: { zapnuto: false, obsah: '', popisek: 'Více informací' },
      format: { papir: 'A4', orientace: 'p', w: 210, h: 297 },
      tisk: { list: 'stejny', kusu: 'auto', okraj: 4, mezera: 0, znacky: true, meritko50: false },
      utrzky: { pocet: 'auto', vyska: 'auto', smer: 'nahoru', popis: p.popisUtrzku, jmeno: 'Petr', telefon: '777 123 456', email: 'petr@example.cz', miniQr: 'zadne', qrVlastni: '' }
    };
  };
  /* doplní chybějící klíče (import starších/cizích JSON) */
  PU.normalizuj = function (s) {
    const z = PU.vychoziStav();
    if (!s || typeof s !== 'object') return z;
    const o = Object.assign({}, z, s);
    for (const k of ['obrazek', 'qr', 'format', 'tisk', 'utrzky']) o[k] = Object.assign({}, z[k], s[k] && typeof s[k] === 'object' ? s[k] : {});
    if (!PU.SCHEMATA[o.schema]) o.schema = 'modra';
    if (!PU.ROZLOZENI[o.rozlozeni]) o.rozlozeni = 'klasicke';
    if (!PU.PISMA[o.pismoNadpis]) o.pismoNadpis = 'lib_sans_b';
    if (PU.PISMA_TEXTU.indexOf(o.pismoText) < 0) o.pismoText = 'lib_sans';
    for (const k of ['stitek', 'nadpis', 'podnadpis', 'text', 'cena', 'nazev']) o[k] = String(o[k] == null ? '' : o[k]);
    return o;
  };

  /* ---------------- rozměry ---------------- */
  PU.rozmer = function (format) {
    const f = format || {};
    let w, h;
    if (f.papir === 'vlastni') { w = +f.w; h = +f.h; }
    else { const z = PU.FORMATY[f.papir] || PU.FORMATY.A4; w = z.w; h = z.h; }
    if (!(w > 0)) w = 210; if (!(h > 0)) h = 297;
    w = Math.min(1200, Math.max(60, w)); h = Math.min(1200, Math.max(60, h));
    if (f.papir !== 'vlastni') {
      const a = Math.min(w, h), b = Math.max(w, h);
      if (f.orientace === 'l') { w = b; h = a; } else { w = a; h = b; }
    }
    return { w, h };
  };

  /* ---------------- metrika písma ---------------- */
  /* z objektu opentype.js Font (čistá funkce, nepotřebuje DOM) */
  PU.metrikaZOpentype = function (font) {
    const upm = font.unitsPerEm || 1000, cache = new Map();
    const hh = font.tables.hhea || {}, os2 = font.tables.os2 || {};
    return {
      asc: (hh.ascender || 0.8 * upm) / upm,
      desc: Math.abs(hh.descender || 0.2 * upm) / upm,
      cap: (os2.sCapHeight || 0.7 * upm) / upm,
      adv(kod) {
        if (cache.has(kod)) return cache.get(kod);
        let v = null;
        try {
          const gi = font.charToGlyphIndex(String.fromCodePoint(kod));
          if (gi > 0) v = font.glyphs.get(gi).advanceWidth / upm;
        } catch (e) { v = null; }
        cache.set(kod, v); return v;
      }
    };
  };
  /* náhradní metrika (když písmo není načtené) – hrubý odhad */
  PU.metrikaOdhad = function () {
    return { asc: 0.9, desc: 0.21, cap: 0.72, odhad: true, adv(k) { if (k === 32) return 0.28; if (k < 32) return null; return (k >= 65 && k <= 90) ? 0.66 : (k === 105 || k === 108 || k === 106) ? 0.24 : 0.55; } };
  };
  const NAHRADY = { 0x2009: ' ', 0x202f: ' ', 0x00a0: ' ', 0x2002: ' ', 0x2003: ' ', 0x2212: '-', 0x2010: '-', 0x2011: '-' };
  /* nahradí znaky, které písmo nemá (emoji…), aby PDF i náhled kreslily totéž */
  PU.ocisti = function (m, text) {
    let o = '';
    for (const ch of String(text).replace(/\t/g, ' ')) {
      const kod = ch.codePointAt(0);
      if (kod < 32) continue;
      if (NAHRADY[kod]) { o += NAHRADY[kod]; continue; }
      if (kod >= 0xfe00 && kod <= 0xfe0f) continue; // variantní selektory
      if (m.adv(kod) == null) { if (kod > 0xffff || (kod >= 0x2600 && kod <= 0x27bf)) continue; o += '?'; continue; }
      o += ch;
    }
    return o;
  };
  PU.sirkaEm = function (m, text) {
    let s = 0;
    for (const ch of text) { const a = m.adv(ch.codePointAt(0)); s += a == null ? 0.5 : a; }
    return s;
  };
  PU.sirka = function (m, text, vel) { return PU.sirkaEm(m, text) * vel; };

  /* metriky pro řez: { r: běžný, b: tučný, fauxB: umělé ztučnění } */
  PU.rezy = function (metriky, klic) {
    const p = PU.PISMA[klic] || PU.PISMA.lib_sans;
    const tk = p.tucny || klic;
    return { kR: klic, kB: tk, r: metriky[klic] || PU.metrikaOdhad(), b: metriky[tk] || metriky[klic] || PU.metrikaOdhad(), fauxB: !p.tucny };
  };

  /* ---------------- formátovaný text ---------------- */
  /* Rozloží řádek na slova; **tučné** přepíná řez. Slovo = pole běhů {text, tucne}. */
  function slovaRadku(radek) {
    const slova = []; let tucne = false, slovo = [], beh = '';
    const zavriBeh = () => { if (beh) { slovo.push({ text: beh, tucne }); beh = ''; } };
    const zavriSlovo = () => { zavriBeh(); if (slovo.length) slova.push(slovo); slovo = []; };
    for (let i = 0; i < radek.length; i++) {
      if (radek[i] === '*' && radek[i + 1] === '*') { zavriBeh(); tucne = !tucne; i++; continue; }
      if (radek[i] === ' ') { zavriSlovo(); continue; }
      beh += radek[i];
    }
    zavriSlovo();
    return slova;
  }
  PU.slovaRadku = slovaRadku;
  const ODRAZKA = /^\s*(?:[-*•–]\s+)/;

  /* Zalomí formátovaný text do šířky.
     o = { lh: násobek řádkování, zarovnani: 'vlevo'|'stred', odstavec: mezera po prázdném řádku (násobek lh) }
     Vrací { radky:[{ runy:[{text,tucne,x,s}], sirka, y (účaří od vrchu bloku), odrazka }], vyska, vel }. */
  PU.zalom = function (text, maxSirka, vel, rezy, o) {
    o = o || {};
    const lh = vel * (o.lh || 1.25), mB = rezy.b, mR = rezy.r;
    const cap = mR.cap || 0.7;
    const radky = []; let y = 0, prvni = true;
    const zdroj = String(text || '').replace(/\r/g, '').split('\n');
    const odsazOdrazky = vel * 1.05;
    for (let zr of zdroj) {
      if (!zr.trim()) { if (!prvni) y += lh * (o.odstavec == null ? 0.45 : o.odstavec); continue; }
      let odr = false;
      if (!o.bezOdrazek && ODRAZKA.test(zr) && !/^\s*\*\*/.test(zr)) { odr = true; zr = zr.replace(ODRAZKA, ''); }
      const slova = slovaRadku(zr).map(sl => sl.map(b => ({ text: PU.ocisti(b.tucne ? mB : mR, b.text), tucne: b.tucne })).filter(b => b.text)).filter(sl => sl.length);
      const odsaz = odr ? odsazOdrazky : 0, sir = maxSirka - odsaz;
      let rad = null;
      const novy = () => {
        rad = { runy: [], sirka: odsaz, x: 0, odrazka: false, odsaz };
        radky.push(rad);
      };
      const zarazBeh = (b, w) => {
        const posl = rad.runy[rad.runy.length - 1];
        if (posl && posl.tucne === b.tucne) { posl.text += b.text; posl.s += w; }
        else rad.runy.push({ text: b.text, tucne: b.tucne, x: rad.x, s: w });
        rad.x += w;
      };
      let prvniRadekZdroje = true;
      const zacni = () => { novy(); rad.odrazka = odr && prvniRadekZdroje; prvniRadekZdroje = false; };
      zacni();
      for (const sl of slova) {
        const ws = sl.map(b => PU.sirka(b.tucne ? mB : mR, b.text, vel));
        const wSl = ws.reduce((a, b) => a + b, 0);
        const tucMez = sl[0].tucne && rad.runy.length && rad.runy[rad.runy.length - 1].tucne;
        const mez = PU.sirka(tucMez ? mB : mR, ' ', vel);
        if (rad.runy.length && rad.x + mez + wSl > sir + 1e-9) zacni();
        if (rad.runy.length) zarazBeh({ text: ' ', tucne: !!tucMez }, mez);
        if (wSl <= sir + 1e-9) { sl.forEach((b, i) => zarazBeh(b, ws[i])); continue; }
        // příliš dlouhé slovo – lámeme po znacích
        for (const b of sl) {
          for (const ch of b.text) {
            const w = PU.sirka(b.tucne ? mB : mR, ch, vel);
            if (rad.x + w > sir + 1e-9 && rad.x > 0) zacni();
            zarazBeh({ text: ch, tucne: b.tucne }, w);
          }
        }
      }
      for (const r of radky) if (r.y == null) { r.y = y + (lh + cap * vel) / 2; y += lh; }
      prvni = false;
    }
    // konečné souřadnice: posun o odsazení, šířka, zarovnání
    for (const r of radky) {
      r.sirka = r.odsaz + r.x;
      const dx = o.zarovnani === 'stred' ? (maxSirka - r.sirka) / 2 : 0;
      r.dx = dx;
      for (const b of r.runy) b.x += r.odsaz + dx;
      if (r.odrazka) r.xOdrazky = dx + vel * 0.18;
      delete r.x; delete r.odsaz;
    }
    return { radky, vyska: y, vel, lh };
  };

  /* Největší velikost písma (v mm) v mezích, při které se text vejde do rámečku a nemá víc než maxRadku řádků. */
  PU.prizpusob = function (text, sirka, vyska, rezy, velMin, velMax, o) {
    o = o || {};
    const vejde = (v) => { const z = PU.zalom(text, sirka, v, rezy, o); return { z, ok: z.vyska <= vyska + 1e-6 && (!o.maxRadku || z.radky.length <= o.maxRadku) }; };
    let hi = vejde(velMax);
    if (hi.ok) return Object.assign(hi.z, { vejde: true });
    let lo = vejde(velMin);
    if (!lo.ok) return Object.assign(lo.z, { vejde: false });
    let a = velMin, b = velMax, nej = lo.z;
    for (let i = 0; i < 22; i++) {
      const m = (a + b) / 2, t = vejde(m);
      if (t.ok) { a = m; nej = t.z; } else b = m;
      if (b - a < 0.005) break;
    }
    return Object.assign(nej, { vejde: true });
  };

  /* ---------------- ořez obrázku ---------------- */
  /* Výřez zdroje (px) pro rámeček ramW×ramH: „cover“, zoom ≥ 1, posun −1…1 v rámci volného místa. */
  PU.vyrez = function (imgW, imgH, ramW, ramH, zoom, posunX, posunY) {
    const z = Math.max(1, +zoom || 1), a = ramW / ramH;
    let sw = imgW, sh = imgW / a;
    if (sh > imgH) { sh = imgH; sw = imgH * a; }
    sw /= z; sh /= z;
    const px = Math.max(-1, Math.min(1, +posunX || 0)), py = Math.max(-1, Math.min(1, +posunY || 0));
    const sx = (imgW - sw) / 2 * (1 + px), sy = (imgH - sh) / 2 * (1 + py);
    return { sx, sy, sw, sh };
  };
  /* „celý obrázek“: největší obdélník poměru stran obrázku uvnitř rámečku, vystředěný */
  PU.vepsat = function (imgW, imgH, x, y, w, h, svisle) {
    const a = imgW / imgH; let ww = w, hh = w / a;
    if (hh > h) { hh = h; ww = h * a; }
    return { x: x + (w - ww) / 2, y: svisle === 'nahoru' ? y : y + (h - hh) / 2, w: ww, h: hh };
  };

  /* ---------------- QR ---------------- */
  /* matice z qrcode-generator (předán parametrem), UTF-8 */
  PU.qrMatice = function (qrcode, text, uroven) {
    if (!qrcode || !text) return null;
    const puv = qrcode.stringToBytes;
    try {
      if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      const q = qrcode(0, uroven || 'M'); q.addData(String(text), 'Byte'); q.make();
      const n = q.getModuleCount(), m = [];
      for (let r = 0; r < n; r++) { const rad = []; for (let c = 0; c < n; c++) rad.push(q.isDark(r, c)); m.push(rad); }
      return m;
    } catch (e) { return null; } finally { qrcode.stringToBytes = puv; }
  };
  /* vodorovné běhy tmavých modulů [radek, sloupec, delka] */
  PU.qrBehy = function (matice) {
    const b = [];
    for (let r = 0; r < matice.length; r++) {
      let c = 0; const rad = matice[r];
      while (c < rad.length) {
        if (!rad[c]) { c++; continue; }
        let d = 0; while (c + d < rad.length && rad[c + d]) d++;
        b.push([r, c, d]); c += d;
      }
    }
    return b;
  };
  PU.obsahQrUtrzku = function (u) {
    const tel = String(u.telefon || '').replace(/[^\d+]/g, '');
    if (u.miniQr === 'telefon') return tel ? 'tel:' + (tel.startsWith('+') || tel.length !== 9 ? tel : '+420' + tel) : '';
    if (u.miniQr === 'email') return u.email ? 'mailto:' + String(u.email).trim() : '';
    if (u.miniQr === 'vlastni') return String(u.qrVlastni || '').trim();
    return '';
  };

  /* ---------------- útržky ---------------- */
  PU.MIN_SIRKA_UTRZKU = 10;      // mm – užší se špatně trhají
  PU.MIN_SIRKA_UTRZKU_QR = 13;   // s mini QR
  PU.MIN_PISMO_UTRZKU = 2.12;    // mm ≈ 6 pt
  PU.MIN_PISMO_TEXTU = 2.3;      // mm ≈ 6,5 pt
  const PT = 72 / 25.4;
  PU.mmNaPt = (mm) => mm * PT;

  PU.vyskaUtrzku = function (stav, w, h) {
    const u = stav.utrzky;
    if (u.vyska !== 'auto' && +u.vyska > 0) return Math.max(15, Math.min(h * 0.5, +u.vyska));
    return Math.max(28, Math.min(70, h * 0.2));
  };

  /* Šířky útržků: všechny stejné, součet přesně = šířka plakátu. */
  PU.pocetUtrzku = function (w, pocet, minSirka) {
    const maxN = Math.max(1, Math.floor(w / minSirka + 1e-9));
    let n;
    if (pocet === 'auto' || !(+pocet > 0)) n = Math.max(6, Math.min(14, Math.round(w / 18)));
    else n = Math.round(+pocet);
    const zadano = n;
    n = Math.max(1, Math.min(n, maxN, 40));
    return { n, omezeno: n < zadano };
  };
  PU.rozdelSirku = function (w, n) {
    const xs = []; for (let i = 0; i <= n; i++) xs.push(i === n ? w : w * i / n);
    return xs;
  };

  /* Řádky útržku (pořadí ve čtení): popis tučně, jméno, telefon tučně a větší, e-mail. */
  PU.radkyUtrzku = function (u) {
    const r = [];
    if (String(u.popis || '').trim()) r.push({ text: String(u.popis).trim(), tucne: true, k: 1 });
    if (String(u.jmeno || '').trim()) r.push({ text: String(u.jmeno).trim(), tucne: false, k: 0.95 });
    if (String(u.telefon || '').trim()) r.push({ text: String(u.telefon).trim(), tucne: true, k: 1.15 });
    if (String(u.email || '').trim()) r.push({ text: String(u.email).trim(), tucne: false, k: 0.9 });
    return r;
  };

  /* Rozvržení jednoho útržku v jeho rámečku (x0,y0,sw,sh). Vrací primitiva a velikost písma. */
  PU.utrzek = function (x0, y0, sw, sh, u, rezy, barvy, qrM, k) {
    const prim = [];
    const padU = 1.6 + 1.6 * k, padV = Math.max(0.7, sw * 0.09);
    let delka = sh - 2 * padU;
    const pricne = sw - 2 * padV;
    let qrVel = 0, qr = null;
    if (qrM) {
      qrVel = Math.min(pricne, delka * 0.42);
      const n = qrM.length, m = qrVel / (n + 2);
      const qx = x0 + (sw - qrVel) / 2, qy = y0 + sh - padU - qrVel;
      prim.push({ t: 'obd', x: qx, y: qy, w: qrVel, h: qrVel, vypln: '#ffffff' });
      prim.push({ t: 'qr', x: qx + m, y: qy + m, m, behy: PU.qrBehy(qrM), barva: '#000000' });
      qr = { vel: qrVel, modul: m };
      delka -= qrVel + Math.max(1.2, 1.5 * k);
    }
    const radky = PU.radkyUtrzku(u).map(r => {
      const met = r.tucne ? rezy.b : rezy.r;
      const text = PU.ocisti(met, r.text);
      return Object.assign({}, r, { text, em: PU.sirkaEm(met, text) });
    }).filter(r => r.text);
    const LH = 1.18;
    let vel = 4.2 * Math.max(0.75, Math.min(1.25, k)) + 0.4;
    if (radky.length) {
      const sk = radky.reduce((a, r) => a + r.k * LH, 0);
      vel = Math.min(vel, pricne / sk);
      for (const r of radky) if (r.em > 0) vel = Math.min(vel, delka / (r.em * r.k));
    }
    vel = Math.max(0.1, vel);
    // svislý text: směr čtení u, „dolů“ v
    const nahoru = u.smer !== 'dolu';
    const tl = radky.reduce((a, r) => a + r.k * vel * LH, 0);
    let v = (pricne - tl) / 2;
    const textY0 = y0 + padU, textY1 = textY0 + delka;
    for (const r of radky) {
      const vr = r.k * vel, lhr = vr * LH, met = r.tucne ? rezy.b : rezy.r;
      const capH = (met.cap || 0.7) * vr;
      const base = v + (lhr + capH) / 2;   // účaří od „vrchu“ bloku
      const delkaR = r.em * vr;
      const u0 = (delka - delkaR) / 2;
      let x, y;
      if (nahoru) { x = x0 + padV + base; y = textY1 - u0; }       // čte se zdola nahoru, vršky písmen vlevo
      else { x = x0 + sw - padV - base; y = textY0 + u0; }          // čte se shora dolů, vršky vpravo
      prim.push({ t: 'text', x, y, text: r.text, pismo: r.tucne ? rezy.kB : rezy.kR, faux: r.tucne && rezy.fauxB, vel: vr, barva: barvy.text, uhel: nahoru ? 90 : -90, delka: delkaR });
      v += lhr;
    }
    return { prim, vel, radky: radky.length, qr, delka, pricne };
  };

  /* nůžky (vektorově – Liberation znak ✂ nemá); střed cx,cy, velikost s, ostří doprava */
  PU.nuzky = function (cx, cy, s, barva, pozadi) {
    const P = (x, y) => [cx + x * s, cy + y * s];
    const p = [];
    p.push({ t: 'obd', x: cx - 0.55 * s, y: cy - 0.42 * s, w: 1.15 * s, h: 0.84 * s, vypln: pozadi });
    p.push({ t: 'mnoho', body: [P(-0.20, -0.11), P(-0.12, -0.19), P(0.58, 0.08), P(0.08, 0.075)], vypln: barva });
    p.push({ t: 'mnoho', body: [P(-0.20, 0.11), P(-0.12, 0.19), P(0.58, -0.08), P(0.08, -0.075)], vypln: barva });
    p.push({ t: 'kruh', cx: cx - 0.31 * s, cy: cy - 0.22 * s, r: 0.13 * s, obrys: barva, s: 0.06 * s });
    p.push({ t: 'kruh', cx: cx - 0.31 * s, cy: cy + 0.22 * s, r: 0.13 * s, obrys: barva, s: 0.06 * s });
    p.push({ t: 'kruh', cx: cx + 0.05 * s, cy, r: 0.035 * s, vypln: pozadi });
    return p;
  };

  /* ---------------- plakát ---------------- */
  /* extra = { obrazek: {w,h} | null, qr: matice | null, qrUtrzku: matice | null } */
  PU.rozvrhni = function (stav, metriky, extra) {
    stav = PU.normalizuj(stav); extra = extra || {};
    const { w, h } = PU.rozmer(stav.format);
    const b = PU.barvy(stav.schema, stav.usporny);
    const k = Math.sqrt(w * h / (210 * 297));
    const pad = Math.max(5, 9 * k);
    const prim = [], varovani = [], info = { w, h, k };
    const rT = PU.rezy(metriky, stav.pismoText), rN = PU.rezy(metriky, stav.pismoNadpis);
    const rTB = { kR: rT.kB, kB: rT.kB, r: rT.b, b: rT.b, fauxB: rT.fauxB };   // vše tučně (štítek, cena)
    const stred = stav.zarovnani === 'stred';
    const ramec = !!stav.ramecek && stav.rozlozeni !== 'pruh';

    prim.push({ t: 'obd', x: 0, y: 0, w, h, vypln: b.pozadi, pozadi: true });

    // ---- útržky ----
    const u = stav.utrzky;
    const hU = PU.vyskaUtrzku(stav, w, h);
    const yCut = h - hU;
    const qrUtrzkuM = extra.qrUtrzku || null;
    const minS = qrUtrzkuM ? PU.MIN_SIRKA_UTRZKU_QR : PU.MIN_SIRKA_UTRZKU;
    const pu = PU.pocetUtrzku(w, u.pocet, minS);
    if (pu.omezeno) varovani.push(`Útržků je méně (${pu.n}), než bylo zadáno – užší než ${minS} mm by se špatně trhaly.`);
    const xs = PU.rozdelSirku(w, pu.n);
    const utrzky = [];
    let velU = Infinity;
    for (let i = 0; i < pu.n; i++) {
      const r = PU.utrzek(xs[i], yCut, xs[i + 1] - xs[i], hU, u, rT, b, qrUtrzkuM, k);
      utrzky.push({ x: xs[i], y: yCut, w: xs[i + 1] - xs[i], h: hU, vel: r.vel, qr: r.qr });
      velU = Math.min(velU, r.vel);
      prim.push(...r.prim);
    }
    if (!PU.radkyUtrzku(u).length) varovani.push('Útržky jsou prázdné – vyplňte jméno, telefon nebo e-mail.');
    else if (velU < PU.MIN_PISMO_UTRZKU) varovani.push(`Písmo na útržcích je jen ${PU.mmNaPt(velU).toFixed(1)} pt (doporučeno aspoň 6 pt) – zkraťte text, ubírejte řádky, zvětšete výšku útržků nebo snižte jejich počet.`);
    const qrU = utrzky[0] && utrzky[0].qr;
    if (qrU && qrU.vel < 9) varovani.push(`Mini QR na útržku má jen ${qrU.vel.toFixed(1)} mm – telefon ho nemusí přečíst (doporučeno ≥ 10 mm).`);
    info.utrzky = { n: pu.n, sirka: xs[1] - xs[0], vyska: hU, vel: velU, velPt: PU.mmNaPt(velU), xs, seznam: utrzky };
    // čáry střihu
    const cs = 0.25, carky = [2, 1.4];
    prim.push({ t: 'cara', x1: 0, y1: yCut, x2: w, y2: yCut, barva: b.cara, s: cs, carky });
    for (let i = 1; i < pu.n; i++) prim.push({ t: 'cara', x1: xs[i], y1: yCut, x2: xs[i], y2: h, barva: b.cara, s: cs, carky });
    const sN = Math.max(4.5, 6 * k);
    prim.push(...PU.nuzky(Math.max(pad * 0.5, 3) + sN * 0.55, yCut, sN, b.cara, b.pozadi));

    // ---- hlavní část ----
    const hlTop = 0, hlBot = yCut - Math.max(2.5, 3.5 * k);
    if (ramec) {
      const o = Math.max(2.5, pad * 0.42);
      prim.push({ t: 'obd', x: o, y: o, w: w - 2 * o, h: hlBot - o, obrys: b.akcent, s: Math.max(0.35, 0.7 * k), r: 2 * k });
    }
    const innerW = w - 2 * pad;
    let y = hlTop + pad;
    const textBlok = (z, x0, y0, rez, barva, barvaOdr) => {
      for (const r of z.radky) {
        if (r.odrazka) prim.push({ t: 'text', x: x0 + r.xOdrazky, y: y0 + r.y, text: '•', pismo: rez.kR, vel: z.vel, barva: barvaOdr || barva });
        for (const bh of r.runy) {
          if (!bh.text.trim() && bh === r.runy[r.runy.length - 1]) continue;
          prim.push({ t: 'text', x: x0 + bh.x, y: y0 + r.y, text: bh.text, pismo: bh.tucne ? rez.kB : rez.kR, faux: bh.tucne && rez.fauxB, vel: z.vel, barva, sirka: bh.s });
        }
      }
    };
    const zarov = stred ? 'stred' : 'vlevo';

    // pruh: plný pás akcentem za hlavičkou (výška se dopočte)
    const pruh = stav.rozlozeni === 'pruh';
    let iPruh = -1;
    if (pruh) { iPruh = prim.length; prim.push(null); }
    const barvaHl = pruh && !b.bezPloch ? b.naAkcentu : b.text;
    const barvaPod = pruh && !b.bezPloch ? b.naAkcentu : b.akcent;
    const plochaH = hlBot - hlTop - 2 * pad;

    // štítek
    const stitek = PU.ocisti(rTB.r, String(stav.stitek || '').trim().toUpperCase());
    if (stitek) {
      const vS = Math.max(3, 5.2 * k);
      if (pruh) {
        const z = PU.prizpusob(stitek, innerW, vS * 1.4, rTB, vS * 0.5, vS, { maxRadku: 1, zarovnani: zarov, lh: 1.2, bezOdrazek: true });
        textBlok(z, pad, y, rTB, barvaHl);
        y += z.vyska + 1.2 * k;
      } else {
        const z = PU.prizpusob(stitek, innerW - vS * 1.8, vS * 1.4, rTB, vS * 0.5, vS, { maxRadku: 1, lh: 1.2, bezOdrazek: true });
        const tw = z.radky.length ? z.radky[0].sirka : 0, ph = z.vel * 1.75, pw = tw + z.vel * 1.8;
        const px = stred ? (w - pw) / 2 : pad;
        if (b.bezPloch) prim.push({ t: 'obd', x: px, y, w: pw, h: ph, obrys: b.text, s: 0.5, r: ph / 2 });
        else prim.push({ t: 'obd', x: px, y, w: pw, h: ph, vypln: b.akcent, r: ph / 2 });
        const capH = (rTB.r.cap || 0.7) * z.vel;
        for (const bh of (z.radky[0] || { runy: [] }).runy) prim.push({ t: 'text', x: px + z.vel * 0.9 + bh.x, y: y + (ph + capH) / 2, text: bh.text, pismo: rTB.kR, faux: rTB.fauxB, vel: z.vel, barva: b.bezPloch ? b.text : b.naAkcentu });
        y += ph + 2.6 * k;
      }
    }
    // nadpis
    if (String(stav.nadpis || '').trim()) {
      const z = PU.prizpusob(stav.nadpis, innerW, plochaH * 0.3, rN, 5 * k, 22 * k, { maxRadku: 3, zarovnani: zarov, lh: 1.1, bezOdrazek: true, odstavec: 0 });
      textBlok(z, pad, y, rN, barvaHl);
      if (!z.vejde) varovani.push('Nadpis je příliš dlouhý – zkraťte ho.');
      info.nadpisVel = z.vel; y += z.vyska + 1.6 * k;
    }
    // podnadpis
    if (String(stav.podnadpis || '').trim()) {
      const z = PU.prizpusob(stav.podnadpis, innerW, plochaH * 0.13, rT, 3 * k, 7 * k, { maxRadku: 2, zarovnani: zarov, lh: 1.2, bezOdrazek: true, odstavec: 0 });
      textBlok(z, pad, y, rT, barvaPod);
      y += z.vyska;
    }
    if (pruh) {
      const yb = y + pad * 0.75;
      prim[iPruh] = b.bezPloch ? { t: 'cara', x1: 0, y1: yb, x2: w, y2: yb, barva: b.text, s: 0.6 } : { t: 'obd', x: 0, y: 0, w, h: yb, vypln: b.akcent };
      y = yb + pad * 0.7;
    } else y += 3.2 * k;

    // spodní řádek: cena + QR
    const qrM = extra.qr || null;
    const cena = PU.ocisti(rTB.r, String(stav.cena || '').trim());
    const qrVel = qrM ? Math.max(15, Math.min(42, 27 * k)) : 0;
    const popQr = qrM ? PU.ocisti(rT.r, String(stav.qr.popisek || '').trim()) : '';
    const velPopQr = Math.max(2.2, 3 * k);
    const qrBlokH = qrM ? qrVel + (popQr ? velPopQr * 1.4 : 0) : 0;
    let cenaH = 0, zC = null;
    const cenaW = innerW - (qrM ? qrVel + 4 * k : 0);
    if (cena) {
      zC = PU.prizpusob(cena, cenaW - 6 * k, 12 * k * 1.3, rTB, 3.5 * k, 10 * k, { maxRadku: 1, lh: 1.2, bezOdrazek: true });
      cenaH = zC.vel * 1.75;
    }
    const radekH = Math.max(qrBlokH, cenaH);
    const radekTop = hlBot - pad * 0.8 - radekH;
    if (zC) {
      const tw = zC.radky.length ? zC.radky[0].sirka : 0, bw = Math.min(cenaW, tw + zC.vel * 1.9);
      const bx = stred && !qrM ? (w - bw) / 2 : pad, by = radekTop + (radekH - cenaH) / 2;
      if (b.bezPloch) prim.push({ t: 'obd', x: bx, y: by, w: bw, h: cenaH, obrys: b.text, s: 0.6, r: 1.6 * k });
      else prim.push({ t: 'obd', x: bx, y: by, w: bw, h: cenaH, vypln: b.akcent, r: 1.6 * k });
      const capH = (rTB.r.cap || 0.7) * zC.vel;
      for (const bh of (zC.radky[0] || { runy: [] }).runy) prim.push({ t: 'text', x: bx + (bw - tw) / 2 + bh.x, y: by + (cenaH + capH) / 2, text: bh.text, pismo: rTB.kR, faux: rTB.fauxB, vel: zC.vel, barva: b.bezPloch ? b.text : b.naAkcentu });
      if (!zC.vejde) varovani.push('Cena / štítek dole je příliš dlouhý.');
    }
    if (qrM) {
      const qx = (stred && !cena) ? (w - qrVel) / 2 : w - pad - qrVel, qy = radekTop + (radekH - qrBlokH) / 2;
      const n = qrM.length, m = qrVel / (n + 4);
      prim.push({ t: 'obd', x: qx, y: qy, w: qrVel, h: qrVel, vypln: '#ffffff' });
      prim.push({ t: 'qr', x: qx + 2 * m, y: qy + 2 * m, m, behy: PU.qrBehy(qrM), barva: '#000000' });
      if (popQr) {
        const z = PU.prizpusob(popQr, qrVel + 8 * k, velPopQr * 1.3, rT, 1.6, velPopQr, { maxRadku: 1, zarovnani: 'stred', lh: 1.2, bezOdrazek: true });
        textBlok(z, qx - 4 * k, qy + qrVel + 0.2, rT, b.text);
      }
      if (qrVel / (n + 4) < 0.33) varovani.push('QR kód je hustý – zkraťte jeho obsah nebo zvětšete plakát.');
      info.qr = { vel: qrVel, modul: m };
    }

    // střední plocha: obrázek + text
    const zonaTop = y, zonaBot = radekH ? radekTop - 3 * k : hlBot - pad * 0.8;
    const zonaH = Math.max(0, zonaBot - zonaTop);
    const img = extra.obrazek && extra.obrazek.w > 0 ? extra.obrazek : null;
    const ob = stav.obrazek;
    const maText = !!String(stav.text || '').trim();
    let tx = pad, ty = zonaTop, tw2 = innerW, th = zonaH;
    if (img && zonaH > 8) {
      const podil = Math.max(15, Math.min(85, +ob.podil || 35)) / 100;
      const mez = 4 * k;
      let ram;
      if (stav.rozlozeni === 'obrazek_vlevo' || stav.rozlozeni === 'obrazek_vpravo') {
        const cw = maText ? innerW * Math.min(0.65, podil + 0.1) : innerW;
        const cx = stav.rozlozeni === 'obrazek_vlevo' || !maText ? pad : w - pad - cw;
        ram = { x: cx, y: zonaTop, w: cw, h: zonaH };
        if (maText) { tw2 = innerW - cw - mez; tx = stav.rozlozeni === 'obrazek_vlevo' ? pad + cw + mez : pad; }
      } else {
        const ih = maText ? zonaH * podil : zonaH;
        ram = { x: pad, y: zonaTop, w: innerW, h: ih };
        ty = zonaTop + ih + mez; th = zonaBot - ty;
      }
      let r = ram;
      if (ob.prizpusobeni === 'cely') r = PU.vepsat(img.w, img.h, ram.x, ram.y, ram.w, ram.h, stav.rozlozeni === 'klasicke' || stav.rozlozeni === 'pruh' ? 'stred' : 'nahoru');
      if (r.w > 1 && r.h > 1) {
        prim.push({ t: 'obraz', id: 'foto', x: r.x, y: r.y, w: r.w, h: r.h, cely: ob.prizpusobeni === 'cely' });
        if (b.bezPloch || stav.ramecek) prim.push({ t: 'obd', x: r.x, y: r.y, w: r.w, h: r.h, obrys: b.cara, s: 0.25 });
        info.obrazek = r;
      }
    }
    if (maText && th > 3 && tw2 > 10) {
      const velMax = Math.max(3, 8.5 * k), velMin = PU.MIN_PISMO_TEXTU;
      const z = PU.prizpusob(stav.text, tw2, th, rT, Math.min(velMin, velMax), velMax, { zarovnani: zarov, lh: 1.28 });
      let yy = ty + Math.max(0, (th - z.vyska) / 2);
      if (!z.vejde) {
        varovani.push('Text se nevejde ani nejmenším písmem – zkraťte ho nebo zmenšete obrázek.');
        z.radky = z.radky.filter(r => r.y + z.vel * 0.25 <= th); yy = ty;
      }
      textBlok(z, tx, yy, rT, b.text, b.bezPloch ? b.text : b.akcent);
      info.text = { vel: z.vel, velPt: PU.mmNaPt(z.vel), x: tx, y: ty, w: tw2, h: th, vejde: z.vejde };
    } else if (maText) varovani.push('Na text nezbylo místo – zmenšete obrázek nebo útržky.');
    info.hlavni = { y0: hlTop, y1: hlBot };
    return { w, h, prim, varovani, info, barvy: b };
  };

  /* ---------------- rozložení kusů na list ---------------- */
  PU.ZNACKA_DELKA = 4; PU.ZNACKA_ODSTUP = 1.5;
  PU.rozlozNaList = function (pw, ph, tisk) {
    tisk = tisk || {};
    if (!tisk.list || tisk.list === 'stejny') return { W: pw, H: ph, kusy: [{ x: 0, y: 0, s: 1, w: pw, h: ph }], meritko: 1, sloupcu: 1, radku: 1, znacky: [], okraj: 0 };
    const L = PU.FORMATY[tisk.list] || PU.FORMATY.A4;
    const okraj = Math.max(0, Math.min(25, +tisk.okraj || 0)), mez = Math.max(0, Math.min(30, +tisk.mezera || 0));
    const rez = tisk.znacky !== false ? PU.ZNACKA_DELKA + PU.ZNACKA_ODSTUP : 0;
    const chce = tisk.kusu === 'auto' || !(+tisk.kusu > 0) ? 'auto' : Math.min(32, Math.round(+tisk.kusu));
    let nej = null;
    for (const [W, H] of [[L.w, L.h], [L.h, L.w]]) {
      const aw = W - 2 * (okraj + rez), ah = H - 2 * (okraj + rez);
      if (aw <= 10 || ah <= 10) continue;
      for (let c = 1; c <= 8; c++) for (let r = 1; r <= 8; r++) {
        const n = c * r;
        if (chce !== 'auto' && (n < chce || n >= chce + Math.min(c, r))) continue;
        const s = Math.min(1, (aw - (c - 1) * mez) / (c * pw), (ah - (r - 1) * mez) / (r * ph));
        if (s <= 0) continue;
        const pocet = chce === 'auto' ? n : chce;
        if (chce === 'auto' && s < 0.85 && n > 1) continue;
        const kand = { W, H, c, r, s, pocet, ztrata: c * r - pocet };
        const lepsi = !nej || (chce === 'auto' ? (pocet > nej.pocet || (pocet === nej.pocet && s > nej.s + 1e-9)) : (s > nej.s + 1e-9 || (Math.abs(s - nej.s) < 1e-9 && kand.ztrata < nej.ztrata)));
        if (lepsi) nej = kand;
      }
    }
    if (!nej) return { W: L.w, H: L.h, kusy: [], meritko: 0, sloupcu: 0, radku: 0, znacky: [], okraj };
    const { W, H, c, r, s, pocet } = nej;
    const kw = pw * s, kh = ph * s;
    const gw = c * kw + (c - 1) * mez, gh = r * kh + (r - 1) * mez;
    const ox = (W - gw) / 2, oy = (H - gh) / 2;
    const kusy = [];
    for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) {
      if (kusy.length >= pocet) break;
      kusy.push({ x: ox + i * (kw + mez), y: oy + j * (kh + mez), s, w: kw, h: kh });
    }
    // ořezové značky vně mřížky na prodloužení každé hrany střihu
    const znacky = [];
    if (tisk.znacky !== false) {
      const d = PU.ZNACKA_DELKA, od = PU.ZNACKA_ODSTUP;
      const sx = new Set(), sy = new Set();
      for (const q of kusy) { sx.add(+q.x.toFixed(4)); sx.add(+(q.x + kw).toFixed(4)); sy.add(+q.y.toFixed(4)); sy.add(+(q.y + kh).toFixed(4)); }
      for (const x of sx) { znacky.push({ x1: x, y1: oy - od - d, x2: x, y2: oy - od }); znacky.push({ x1: x, y1: oy + gh + od, x2: x, y2: oy + gh + od + d }); }
      for (const yv of sy) { znacky.push({ x1: ox - od - d, y1: yv, x2: ox - od, y2: yv }); znacky.push({ x1: ox + gw + od, y1: yv, x2: ox + gw + od + d, y2: yv }); }
    }
    return { W, H, kusy, meritko: s, sloupcu: c, radku: r, znacky, okraj, ox, oy, gw, gh };
  };

  /* posune a zvětší primitivum plakátu do souřadnic listu */
  PU.transformuj = function (p, ox, oy, s) {
    const X = (x) => ox + x * s, Y = (y) => oy + y * s;
    const q = Object.assign({}, p);
    switch (p.t) {
      case 'obd': case 'obraz': q.x = X(p.x); q.y = Y(p.y); q.w = p.w * s; q.h = p.h * s; if (p.r) q.r = p.r * s; break;
      case 'cara': q.x1 = X(p.x1); q.y1 = Y(p.y1); q.x2 = X(p.x2); q.y2 = Y(p.y2); if (p.carky) q.carky = p.carky.map(v => v * s); break;
      case 'kruh': q.cx = X(p.cx); q.cy = Y(p.cy); q.r = p.r * s; break;
      case 'mnoho': q.body = p.body.map(([x, y]) => [X(x), Y(y)]); break;
      case 'text': q.x = X(p.x); q.y = Y(p.y); q.vel = p.vel * s; if (p.sirka) q.sirka = p.sirka * s; if (p.delka) q.delka = p.delka * s; break;
      case 'qr': q.x = X(p.x); q.y = Y(p.y); q.m = p.m * s; break;
    }
    if (p.s) q.s = p.s * s;
    return q;
  };

  /* celý list: kusy plakátu + ořezové značky + volitelně kontrolní úsečka 50 mm */
  PU.sestavList = function (plakat, tisk) {
    const roz = PU.rozlozNaList(plakat.w, plakat.h, tisk);
    const prim = [{ t: 'obd', x: 0, y: 0, w: roz.W, h: roz.H, vypln: '#ffffff', pozadi: true }];
    for (const q of roz.kusy) for (const p of plakat.prim) prim.push(PU.transformuj(p, q.x, q.y, q.s));
    for (const z of roz.znacky) prim.push(Object.assign({ t: 'cara', barva: '#000000', s: 0.2 }, z));
    if (tisk && tisk.meritko50 && roz.kusy.length && roz.oy + roz.gh + 4.2 <= roz.H - (roz.okraj || 0)) {
      const y = roz.oy + roz.gh + 1.5, x = roz.ox + 12;
      prim.push({ t: 'cara', x1: x, y1: y + 1, x2: x + 50, y2: y + 1, barva: '#000000', s: 0.2 });
      prim.push({ t: 'cara', x1: x, y1: y, x2: x, y2: y + 2, barva: '#000000', s: 0.2 });
      prim.push({ t: 'cara', x1: x + 50, y1: y, x2: x + 50, y2: y + 2, barva: '#000000', s: 0.2 });
      prim.push({ t: 'text', x: x + 52, y: y + 1.9, text: 'kontrola 50 mm', pismo: 'lib_sans', vel: 2.2, barva: '#000000' });
    }
    return { w: roz.W, h: roz.H, prim, rozlozeni: roz };
  };

  /* ---------------- pomocné pro testy a UI ---------------- */
  /* obálka textového primitiva (pro kontrolu, že se vejde) – výška od účaří: nahoru cap, dolů desc */
  PU.obalkaTextu = function (p, metriky) {
    const m = metriky[p.pismo] || PU.metrikaOdhad();
    const del = p.delka != null ? p.delka : (p.sirka != null ? p.sirka : PU.sirka(m, p.text, p.vel));
    const nad = (m.cap || 0.7) * p.vel, pod = 0.0 * p.vel;
    if (!p.uhel) return { x0: p.x, x1: p.x + del, y0: p.y - nad, y1: p.y + pod };
    if (p.uhel === 90) return { x0: p.x - nad, x1: p.x + pod, y0: p.y - del, y1: p.y };
    return { x0: p.x - pod, x1: p.x + nad, y0: p.y, y1: p.y + del };
  };
  PU.znakyTextu = function (prim) {
    const z = {};
    for (const p of prim) if (p.t === 'text') { (z[p.pismo] = z[p.pismo] || new Set()); for (const ch of p.text) z[p.pismo].add(ch); }
    return z;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PU;
  koren.PU = PU;
})(typeof window !== 'undefined' ? window : globalThis);
