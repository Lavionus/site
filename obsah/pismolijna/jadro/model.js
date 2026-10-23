/* ============================================================
   Písmolijna – jadro/model.js
   Datový model fontu (smlouva viz Pismolijna_PLAN.md): nový font
   a glyf, názvy glyfů podle Adobe Glyph List pro latinku, cmap,
   rozložení komponent, obálka a postranní mezery, bloky Unicode.
   Bez DOM – běží i v node.
   ============================================================ */
(function (G) {
  'use strict';
  const P = G.PSL || (G.PSL = {});

  /* ---------- názvy glyfů (AGL) ----------
     Jen to, co se v latince a české sazbě opravdu potkává; ostatní znaky
     dostanou název uniXXXX / uXXXXX, což je platné podle specifikace. */
  const AGL_TEXT =
    '20 space 21 exclam 22 quotedbl 23 numbersign 24 dollar 25 percent 26 ampersand 27 quotesingle ' +
    '28 parenleft 29 parenright 2A asterisk 2B plus 2C comma 2D hyphen 2E period 2F slash ' +
    '30 zero 31 one 32 two 33 three 34 four 35 five 36 six 37 seven 38 eight 39 nine ' +
    '3A colon 3B semicolon 3C less 3D equal 3E greater 3F question 40 at 5B bracketleft 5C backslash ' +
    '5D bracketright 5E asciicircum 5F underscore 60 grave 7B braceleft 7C bar 7D braceright 7E asciitilde ' +
    'A0 uni00A0 A1 exclamdown A2 cent A3 sterling A4 currency A5 yen A6 brokenbar A7 section A8 dieresis ' +
    'A9 copyright AA ordfeminine AB guillemotleft AC logicalnot AD uni00AD AE registered AF macron ' +
    'B0 degree B1 plusminus B2 twosuperior B3 threesuperior B4 acute B5 mu B6 paragraph B7 periodcentered ' +
    'B8 cedilla B9 onesuperior BA ordmasculine BB guillemotright BC onequarter BD onehalf BE threequarters ' +
    'BF questiondown C0 Agrave C1 Aacute C2 Acircumflex C3 Atilde C4 Adieresis C5 Aring C6 AE C7 Ccedilla ' +
    'C8 Egrave C9 Eacute CA Ecircumflex CB Edieresis CC Igrave CD Iacute CE Icircumflex CF Idieresis ' +
    'D0 Eth D1 Ntilde D2 Ograve D3 Oacute D4 Ocircumflex D5 Otilde D6 Odieresis D7 multiply D8 Oslash ' +
    'D9 Ugrave DA Uacute DB Ucircumflex DC Udieresis DD Yacute DE Thorn DF germandbls E0 agrave E1 aacute ' +
    'E2 acircumflex E3 atilde E4 adieresis E5 aring E6 ae E7 ccedilla E8 egrave E9 eacute EA ecircumflex ' +
    'EB edieresis EC igrave ED iacute EE icircumflex EF idieresis F0 eth F1 ntilde F2 ograve F3 oacute ' +
    'F4 ocircumflex F5 otilde F6 odieresis F7 divide F8 oslash F9 ugrave FA uacute FB ucircumflex ' +
    'FC udieresis FD yacute FE thorn FF ydieresis ' +
    '100 Amacron 101 amacron 102 Abreve 103 abreve 104 Aogonek 105 aogonek 106 Cacute 107 cacute ' +
    '108 Ccircumflex 109 ccircumflex 10A Cdotaccent 10B cdotaccent 10C Ccaron 10D ccaron 10E Dcaron ' +
    '10F dcaron 110 Dcroat 111 dcroat 112 Emacron 113 emacron 114 Ebreve 115 ebreve 116 Edotaccent ' +
    '117 edotaccent 118 Eogonek 119 eogonek 11A Ecaron 11B ecaron 11C Gcircumflex 11D gcircumflex ' +
    '11E Gbreve 11F gbreve 120 Gdotaccent 121 gdotaccent 122 uni0122 123 uni0123 124 Hcircumflex ' +
    '125 hcircumflex 126 Hbar 127 hbar 128 Itilde 129 itilde 12A Imacron 12B imacron 12C Ibreve ' +
    '12D ibreve 12E Iogonek 12F iogonek 130 Idotaccent 131 dotlessi 132 IJ 133 ij 134 Jcircumflex ' +
    '135 jcircumflex 136 uni0136 137 uni0137 138 kgreenlandic 139 Lacute 13A lacute 13B uni013B ' +
    '13C uni013C 13D Lcaron 13E lcaron 13F Ldot 140 ldot 141 Lslash 142 lslash 143 Nacute 144 nacute ' +
    '145 uni0145 146 uni0146 147 Ncaron 148 ncaron 149 napostrophe 14A Eng 14B eng 14C Omacron ' +
    '14D omacron 14E Obreve 14F obreve 150 Ohungarumlaut 151 ohungarumlaut 152 OE 153 oe 154 Racute ' +
    '155 racute 156 uni0156 157 uni0157 158 Rcaron 159 rcaron 15A Sacute 15B sacute 15C Scircumflex ' +
    '15D scircumflex 15E Scedilla 15F scedilla 160 Scaron 161 scaron 162 uni0162 163 uni0163 ' +
    '164 Tcaron 165 tcaron 166 Tbar 167 tbar 168 Utilde 169 utilde 16A Umacron 16B umacron 16C Ubreve ' +
    '16D ubreve 16E Uring 16F uring 170 Uhungarumlaut 171 uhungarumlaut 172 Uogonek 173 uogonek ' +
    '174 Wcircumflex 175 wcircumflex 176 Ycircumflex 177 ycircumflex 178 Ydieresis 179 Zacute ' +
    '17A zacute 17B Zdotaccent 17C zdotaccent 17D Zcaron 17E zcaron 17F longs 192 florin ' +
    '218 uni0218 219 uni0219 21A uni021A 21B uni021B 237 uni0237 ' +
    '2C6 circumflex 2C7 caron 2C9 uni02C9 2D8 breve 2D9 dotaccent 2DA ring 2DB ogonek 2DC tilde ' +
    '2DD hungarumlaut 300 gravecomb 301 acutecomb 302 uni0302 303 tildecomb 304 uni0304 306 uni0306 ' +
    '307 uni0307 308 uni0308 30A uni030A 30B uni030B 30C uni030C 326 uni0326 327 uni0327 328 uni0328 ' +
    '2013 endash 2014 emdash 2018 quoteleft 2019 quoteright 201A quotesinglbase 201C quotedblleft ' +
    '201D quotedblright 201E quotedblbase 2020 dagger 2021 daggerdbl 2022 bullet 2026 ellipsis ' +
    '2030 perthousand 2039 guilsinglleft 203A guilsinglright 2044 fraction 20AC Euro 2116 uni2116 ' +
    '2122 trademark 2190 arrowleft 2191 arrowup 2192 arrowright 2193 arrowdown 2212 minus 2215 uni2215 ' +
    '221E infinity 2248 approxequal 2260 notequal 2264 lessequal 2265 greaterequal 25CA lozenge ' +
    'FB01 fi FB02 fl';
  const AGL = new Map(), AGL_ZPET = new Map();
  (function () {
    const t = AGL_TEXT.split(' ');
    for (let i = 0; i + 1 < t.length; i += 2) {
      const cp = parseInt(t[i], 16);
      AGL.set(cp, t[i + 1]); AGL_ZPET.set(t[i + 1], cp);
    }
    for (let c = 0x41; c <= 0x5A; c++) { AGL.set(c, String.fromCharCode(c)); AGL_ZPET.set(String.fromCharCode(c), c); }
    for (let c = 0x61; c <= 0x7A; c++) { AGL.set(c, String.fromCharCode(c)); AGL_ZPET.set(String.fromCharCode(c), c); }
  })();

  function hex(cp, n) { return cp.toString(16).toUpperCase().padStart(n, '0'); }

  P.nazevProUnicode = function (cp) {
    if (AGL.has(cp)) return AGL.get(cp);
    return cp <= 0xFFFF ? 'uni' + hex(cp, 4) : 'u' + hex(cp, 5);
  };

  /* Název → kódový bod (nebo null). Zvládá AGL, uniXXXX, uXXXXX[X]
     a přípony za tečkou („a.alt“ → null, ten Unicode nemá). */
  P.unicodeZNazvu = function (nazev) {
    if (!nazev || nazev.indexOf('.') > 0) return null;
    if (AGL_ZPET.has(nazev)) return AGL_ZPET.get(nazev);
    let m = /^uni([0-9A-F]{4})$/.exec(nazev);
    if (m) return parseInt(m[1], 16);
    m = /^u([0-9A-F]{4,6})$/.exec(nazev);
    if (m) return parseInt(m[1], 16);
    return null;
  };

  /* Platný název glyfu podle specifikace post: [A-Za-z0-9._], nezačíná číslicí
     (kromě .notdef), max. 63 znaků. */
  P.platnyNazev = function (n) {
    return typeof n === 'string' && n.length > 0 && n.length <= 63 &&
      (n === '.notdef' || /^[A-Za-z_.][A-Za-z0-9_.]*$/.test(n));
  };

  /* ---------- bloky Unicode pro mřížku znaků ---------- */
  function rozsah(a, b) { const r = []; for (let c = a; c <= b; c++) r.push(c); return r; }
  const CESKE = 'ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž'.split('').map(c => c.codePointAt(0));
  P.BLOKY = [
    { id: 'zaklad', nazev: 'Základní latinka (ASCII)', znaky: rozsah(0x20, 0x7E) },
    { id: 'cesky', nazev: 'Česká abeceda', znaky: rozsah(0x41, 0x5A).concat(rozsah(0x61, 0x7A), CESKE) },
    { id: 'latin1', nazev: 'Latin-1 doplněk', znaky: rozsah(0xA0, 0xFF) },
    { id: 'latinA', nazev: 'Latinka rozšířená A', znaky: rozsah(0x100, 0x17F) },
    { id: 'latinB', nazev: 'Latinka rozšířená B', znaky: rozsah(0x180, 0x24F) },
    { id: 'akcenty', nazev: 'Diakritika (samostatná a kombinační)', znaky: rozsah(0x2C6, 0x2DD).concat(rozsah(0x300, 0x328)) },
    { id: 'recke', nazev: 'Řecké písmo', znaky: rozsah(0x391, 0x3A9).filter(c => c !== 0x3A2).concat(rozsah(0x3B1, 0x3C9)) },
    { id: 'azbuka', nazev: 'Azbuka', znaky: rozsah(0x410, 0x44F).concat([0x401, 0x451]) },
    { id: 'interpunkce', nazev: 'Interpunkce a symboly', znaky: rozsah(0x2010, 0x203A).concat([0x20AC, 0x2116, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x221E, 0x2248, 0x2260, 0x2264, 0x2265, 0x25CA]) },
    { id: 'cisla', nazev: 'Číslice a zlomky', znaky: rozsah(0x30, 0x39).concat([0xBC, 0xBD, 0xBE, 0x2070, 0x00B9, 0x00B2, 0x00B3], rozsah(0x2074, 0x2079), rozsah(0x2080, 0x2089), [0x2044]) },
    { id: 'tvary', nazev: 'Geometrické tvary', znaky: rozsah(0x25A0, 0x25FF) },
    { id: 'sipky', nazev: 'Šipky', znaky: rozsah(0x2190, 0x21FF) },
    { id: 'ramecky', nazev: 'Rámečky', znaky: rozsah(0x2500, 0x257F) },
    { id: 'pua', nazev: 'Soukromá oblast (PUA) – vlastní značky', znaky: rozsah(0xE000, 0xE0FF) }
  ];

  /* ---------- tvorba ---------- */
  P.novyGlyf = function (nazev, uni, sirka) {
    return {
      nazev: nazev,
      uni: uni == null ? [] : (Array.isArray(uni) ? uni.slice() : [uni]),
      sirka: sirka == null ? 500 : sirka,
      obrysy: [], komponenty: [], kotvy: []
    };
  };

  P.vychoziInfo = function () {
    return {
      rodina: 'Moje písmo', styl: 'Regular', verzeFontu: '1.000',
      copyright: '', designer: '', licence: 'Tento font je licencován pod SIL Open Font License 1.1.',
      licenceUrl: 'https://openfontlicense.org', url: '', popis: '',
      upm: 1000, ascender: 800, descender: -200, lineGap: 200,
      xVyska: 500, vyskaVerzalek: 700, sklon: 0,
      podtrzeniPoz: -100, podtrzeniTl: 50, vaha: 400, sirkaTrida: 5
    };
  };

  /* Obdélník .notdef s otvorem – povinný glyf 0. */
  function notdef(info) {
    const g = P.novyGlyf('.notdef', null, Math.round(info.upm * 0.5));
    const w = g.sirka, h = info.vyskaVerzalek, o = Math.round(info.upm * 0.05), t = Math.round(info.upm * 0.05);
    g.obrysy.push(obdelnik(o, 0, w - o, h, true));
    g.obrysy.push(obdelnik(o + t, t, w - o - t, h - t, false));
    return g;
  }

  /* Obdélník jako obrys; vnejsi=true → po směru hodinových ručiček (y nahoru). */
  function obdelnik(x0, y0, x1, y1, vnejsi) {
    const b = [{ x: x0, y: y0 }, { x: x0, y: y1 }, { x: x1, y: y1 }, { x: x1, y: y0 }];
    if (!vnejsi) b.reverse();
    return { body: b.map(p => ({ x: p.x, y: p.y, t: 'l', s: false })) };
  }
  P.obdelnik = obdelnik;

  P.novyFont = function (volby) {
    const info = Object.assign(P.vychoziInfo(), volby || {});
    const f = {
      format: 'pismolijna', verze: 1, info: info,
      poradi: [], glyfy: {}, kerning: {}, skupiny: {}, ligatury: [], vodidla: []
    };
    P.pridejGlyf(f, notdef(info));
    P.pridejGlyf(f, P.novyGlyf('space', 0x20, Math.round(info.upm * 0.25)));
    return f;
  };

  P.pridejGlyf = function (font, g) {
    if (!font.glyfy[g.nazev]) font.poradi.push(g.nazev);
    font.glyfy[g.nazev] = g;
    return g;
  };

  /* Volný název: „a“, „a.1“, „a.2“… */
  P.volnyNazev = function (font, zaklad) {
    if (!font.glyfy[zaklad]) return zaklad;
    for (let i = 1; ; i++) if (!font.glyfy[zaklad + '.' + i]) return zaklad + '.' + i;
  };

  /* Glyf pro kódový bod; když chybí a vytvor=true, založí prázdný. */
  P.glyfProZnak = function (font, cp, vytvor) {
    const mapa = P.cmap(font);
    if (mapa.has(cp)) return font.glyfy[mapa.get(cp)];
    if (!vytvor) return null;
    const nazev = P.volnyNazev(font, P.nazevProUnicode(cp));
    const sirka = Math.round(font.info.upm * 0.6);
    return P.pridejGlyf(font, P.novyGlyf(nazev, cp, sirka));
  };

  P.prejmenujGlyf = function (font, stary, novy) {
    if (stary === novy || !font.glyfy[stary] || font.glyfy[novy]) return false;
    const g = font.glyfy[stary];
    delete font.glyfy[stary];
    g.nazev = novy; font.glyfy[novy] = g;
    font.poradi[font.poradi.indexOf(stary)] = novy;
    for (const n of font.poradi) for (const k of font.glyfy[n].komponenty || []) if (k.glyf === stary) k.glyf = novy;
    if (font.kerning[stary]) { font.kerning[novy] = font.kerning[stary]; delete font.kerning[stary]; }
    for (const l in font.kerning) if (stary in font.kerning[l]) { font.kerning[l][novy] = font.kerning[l][stary]; delete font.kerning[l][stary]; }
    for (const s in font.skupiny) font.skupiny[s] = font.skupiny[s].map(n => n === stary ? novy : n);
    for (const l of font.ligatury) { l.z = l.z.map(n => n === stary ? novy : n); if (l.na === stary) l.na = novy; }
    return true;
  };

  P.smazGlyf = function (font, nazev) {
    if (!font.glyfy[nazev] || nazev === '.notdef') return false;
    // komponenty, které na glyf odkazují, se rozloží na obrysy, aby nic nezmizelo
    for (const n of font.poradi) {
      const g = font.glyfy[n];
      if ((g.komponenty || []).some(k => k.glyf === nazev)) P.rozlozKomponenty(font, g, nazev);
    }
    delete font.glyfy[nazev];
    font.poradi.splice(font.poradi.indexOf(nazev), 1);
    delete font.kerning[nazev];
    for (const l in font.kerning) delete font.kerning[l][nazev];
    for (const s in font.skupiny) font.skupiny[s] = font.skupiny[s].filter(n => n !== nazev);
    font.ligatury = font.ligatury.filter(l => l.na !== nazev && l.z.indexOf(nazev) < 0);
    return true;
  };

  /* ---------- cmap ---------- */
  P.cmap = function (font) {
    const m = new Map();
    for (const n of font.poradi) for (const u of font.glyfy[n].uni || []) if (!m.has(u)) m.set(u, n);
    return m;
  };

  /* ---------- geometrie glyfu ---------- */
  function transformujBod(m, x, y) { return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }; }
  P.transformujBod = transformujBod;
  P.nasobMatice = function (a, b) {   // nejdřív b, pak a
    return [
      a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]
    ];
  };

  /* Živá symetrie glyfu: g.zrcadlo = {svisle, vodorovne, x?, y?}. svisle = zrcadlo podle
     svislé osy (levá ↔ pravá polovina, osa x, výchozí střed šířky), vodorovne = podle
     vodorovné osy (y, výchozí polovina výšky verzálek). Vrací matice kopií (bez identity). */
  P.maticeZrcadla = function (font, g) {
    const z = g.zrcadlo;
    if (!z || (!z.svisle && !z.vodorovne)) return [];
    const x = z.x != null ? z.x : g.sirka / 2, y = z.y != null ? z.y : font.info.vyskaVerzalek / 2;
    const out = [];
    if (z.svisle) out.push([-1, 0, 0, 1, 2 * x, 0]);
    if (z.vodorovne) out.push([1, 0, 0, -1, 0, 2 * y]);
    if (z.svisle && z.vodorovne) out.push([-1, 0, 0, -1, 2 * x, 2 * y]);
    return out;
  };

  /* Vlastní obrysy glyfu včetně zrcadlených kopií (bez komponent). */
  P.obrysySeZrcadlem = function (font, g) {
    const mat = P.maticeZrcadla(font, g);
    if (!mat.length) return g.obrysy;
    const out = g.obrysy.slice();
    for (const m of mat) for (const o of transformujObrysy(g.obrysy, m)) out.push(o);
    return out;
  };

  function transformujObrysy(obrysy, m) {
    const zrcadli = m[0] * m[3] - m[1] * m[2] < 0;
    return obrysy.map(o => {
      let body = o.body.map(b => Object.assign({}, b, transformujBod(m, b.x, b.y)));
      if (zrcadli) body = P.obratBody ? P.obratBody(body, o.otevreny) : body;
      const no = { body: body };
      if (o.otevreny) no.otevreny = true;
      return no;
    });
  }

  /* Zrcadlené kopie se stanou skutečnými obrysy a symetrie se vypne. */
  P.zapecZrcadlo = function (font, g) {
    g.obrysy = P.klonuj(P.obrysySeZrcadlem(font, g));
    delete g.zrcadlo;
  };

  /* Všechny obrysy glyfu včetně zrcadla a komponent (rekurzivně, s ochranou proti cyklu).
     Vrací nové objekty – originál se nemění. */
  P.plneObrysy = function (font, g, _m, _hloubka) {
    const m = _m || [1, 0, 0, 1, 0, 0], h = _hloubka || 0;
    const out = transformujObrysy(P.obrysySeZrcadlem(font, g), m);
    if (h < 8) for (const k of g.komponenty || []) {
      const z = font.glyfy[k.glyf];
      if (z) for (const o of P.plneObrysy(font, z, P.nasobMatice(m, k.m), h + 1)) out.push(o);
    }
    return out;
  };

  /* Nahradí komponenty glyfu (nebo jen ty s daným cílem) jejich obrysy. */
  P.rozlozKomponenty = function (font, g, jenCil) {
    const zustava = [];
    for (const k of g.komponenty || []) {
      if (jenCil && k.glyf !== jenCil) { zustava.push(k); continue; }
      const z = font.glyfy[k.glyf];
      if (z) for (const o of P.plneObrysy(font, z, k.m)) g.obrysy.push(o);
    }
    g.komponenty = zustava;
  };

  /* Obálka {x0,y0,x1,y1} nebo null pro prázdný glyf. Potřebuje krivky.js. */
  P.obalkaGlyfu = function (font, g) {
    return P.obalkaObrysu(P.plneObrysy(font, g));
  };

  P.lsb = function (font, g) { const o = P.obalkaGlyfu(font, g); return o ? o.x0 : 0; };
  P.rsb = function (font, g) { const o = P.obalkaGlyfu(font, g); return o ? g.sirka - o.x1 : g.sirka; };

  /* Posune obrysy i kotvy (komponenty také), aby LSB = hodnota; šířka se přičte. */
  P.nastavLsb = function (font, g, hodnota) {
    const o = P.obalkaGlyfu(font, g); if (!o) return;
    const d = Math.round(hodnota - o.x0);
    P.posunGlyf(g, d, 0);
    g.sirka = Math.max(0, g.sirka + d);
  };
  P.nastavRsb = function (font, g, hodnota) {
    const o = P.obalkaGlyfu(font, g); if (!o) { g.sirka = Math.max(0, Math.round(hodnota)); return; }
    g.sirka = Math.max(0, Math.round(o.x1 + hodnota));
  };

  P.posunGlyf = function (g, dx, dy) {
    for (const o of g.obrysy) for (const b of o.body) { b.x += dx; b.y += dy; }
    for (const k of g.komponenty || []) { k.m[4] += dx; k.m[5] += dy; }
    for (const a of g.kotvy || []) { a.x += dx; a.y += dy; }
  };

  /* ---------- kopie a serializace ---------- */
  P.klonuj = function (x) {
    return typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x));
  };

  /* Doplní chybějící pole a opraví zjevné nesrovnalosti (načtení starého/cizího projektu). */
  P.normalizuj = function (f) {
    if (!f || typeof f !== 'object' || !f.glyfy) throw new Error('Soubor není projekt Písmolijny.');
    f.format = 'pismolijna'; f.verze = f.verze || 1;
    f.info = Object.assign(P.vychoziInfo(), f.info || {});
    f.kerning = f.kerning || {}; f.skupiny = f.skupiny || {};
    f.ligatury = f.ligatury || []; f.vodidla = f.vodidla || [];
    const poradi = (f.poradi || Object.keys(f.glyfy)).filter((n, i, a) => f.glyfy[n] && a.indexOf(n) === i);
    for (const n in f.glyfy) if (poradi.indexOf(n) < 0) poradi.push(n);
    f.poradi = poradi;
    for (const n of poradi) {
      const g = f.glyfy[n];
      g.nazev = n; g.uni = g.uni || []; g.sirka = +g.sirka || 0;
      g.obrysy = (g.obrysy || []).filter(o => o.body && o.body.length);
      g.komponenty = (g.komponenty || []).filter(k => f.glyfy[k.glyf]);
      g.kotvy = g.kotvy || [];
    }
    if (!f.glyfy['.notdef']) {
      P.pridejGlyf(f, notdef(f.info));
      f.poradi.unshift(f.poradi.pop());
    } else if (f.poradi[0] !== '.notdef') {
      f.poradi.splice(f.poradi.indexOf('.notdef'), 1); f.poradi.unshift('.notdef');
    }
    return f;
  };

  P.glyfJePrazdny = function (g) {
    return !(g.obrysy && g.obrysy.length) && !(g.komponenty && g.komponenty.length);
  };

  /* Text → řada názvů glyfů (podle cmap), s ligaturami a zápisem /nazev
     jako ve FontForge („/A/V“ nebo „A/Aacute V“). */
  P.textNaGlyfy = function (font, text, sLigaturami) {
    const mapa = P.cmap(font), out = [];
    const znaky = Array.from(text);
    for (let i = 0; i < znaky.length; i++) {
      const z = znaky[i];
      if (z === '/' ) {
        let j = i + 1, n = '';
        while (j < znaky.length && /[A-Za-z0-9_.]/.test(znaky[j])) n += znaky[j++];
        if (n && font.glyfy[n]) { out.push(n); i = j - 1; if (znaky[j] === ' ') i = j; continue; }
      }
      const cp = z.codePointAt(0);
      out.push(mapa.has(cp) ? mapa.get(cp) : (cp === 10 ? '\n' : '.notdef'));
    }
    if (!sLigaturami || !font.ligatury.length) return out;
    // nejdelší ligatura vyhrává
    const lig = font.ligatury.filter(l => font.glyfy[l.na]).slice().sort((a, b) => b.z.length - a.z.length);
    const r = [];
    for (let i = 0; i < out.length;) {
      let hit = null;
      for (const l of lig) {
        if (l.z.every((n, k) => out[i + k] === n)) { hit = l; break; }
      }
      if (hit) { r.push(hit.na); i += hit.z.length; } else r.push(out[i++]);
    }
    return r;
  };

  /* Hodnota kerningu pro dvojici glyfů včetně skupin (pár glyf–glyf má přednost). */
  P.kernPar = function (font, l, r) {
    const K = font.kerning;
    if (K[l] && K[l][r] != null) return K[l][r];
    const sl = P.skupinyGlyfu(font, l), sr = P.skupinyGlyfu(font, r);
    for (const a of sl) if (K[a] && K[a][r] != null) return K[a][r];
    for (const b of sr) if (K[l] && K[l][b] != null) return K[l][b];
    for (const a of sl) for (const b of sr) if (K[a] && K[a][b] != null) return K[a][b];
    return 0;
  };
  P.skupinyGlyfu = function (font, n) {
    const r = [];
    for (const s in font.skupiny) if (font.skupiny[s].indexOf(n) >= 0) r.push(s);
    return r;
  };

  /* Rozbalí kerning se skupinami na seznam párů glyf–glyf [{l, r, v}] (pro export). */
  P.kernPary = function (font) {
    const K = font.kerning, map = new Map();
    const rozbal = n => n.charAt(0) === '@' ? (font.skupiny[n] || []) : [n];
    // pořadí priorit: skupina–skupina < skupina–glyf / glyf–skupina < glyf–glyf
    const vrstvy = [[], [], []];
    for (const l in K) for (const r in K[l]) {
      const u = (l.charAt(0) === '@') + (r.charAt(0) === '@');
      vrstvy[2 - u].push([l, r, K[l][r]]);
    }
    for (const v of vrstvy) {   // slabší priorita první, silnější přepíše
      for (const [l, r, h] of v) for (const a of rozbal(l)) for (const b of rozbal(r)) {
        if (font.glyfy[a] && font.glyfy[b]) map.set(a + '\u0000' + b, Math.round(h));
      }
    }
    const out = [];
    for (const [k, v] of map) if (v) { const [l, r] = k.split('\u0000'); out.push({ l, r, v }); }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
