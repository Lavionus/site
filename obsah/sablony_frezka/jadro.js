/* ============================================================
   Šablony pro horní frézku – jádro (bez DOM)
   Model: x, y v mm, y nahoru; tvar je zadaný výsledný řez (kapsa / otvor / obrys dílu).
   Kopírovací kroužek Ø Dk (nebo ložisko Ø Dl) a fréza Ø Df: o = (Dk − Df) / 2.
   - vnitřní kopírování (kroužek jede uvnitř otvoru šablony): otvor šablony = tvar ⊕ o,
     dráha středu kroužku = hranice (otvor ⊖ Rk), řez = (otvor ⊖ Rk) ⊕ Rf.
   - vnější kopírování (kroužek obíhá šablonu – ostrůvek): šablona = tvar ⊖ o,
     dráha středu = hranice (šablona ⊕ Rk), zůstane díl = (šablona ⊕ Rk) ⊖ Rf.
   Export: window.SF i module.exports.
   ============================================================ */
(function (koren) {
  'use strict';
  const G = koren.SFG || (typeof require !== 'undefined' ? require('./geom.js') : null);
  const r2 = (x) => Math.round(x * 100) / 100;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const cislo = (v, d) => { const x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : d; };
  const omez = (x, a, b) => Math.max(a, Math.min(b, x));
  const cz = (x, d) => { const k = Math.pow(10, d == null ? 2 : d); return String(Math.round(x * k) / k).replace('.', ',').replace('-', '−'); };
  const RAD = Math.PI / 180;

  /* ---------------- nastavení frézky, šablony a tisku ---------------- */
  const NASTAVENI = {
    vedeni: 'krouzek', Dk: 17, Dl: 12.7, Df: 8, vyskaKrouzku: 5, Dz: 150,
    hloubka: 6, tris: 3, tlObrobku: 18,
    tlSablony: 8, okrajDesky: 70, rDesky: 8,
    papir: 'a4', okrajTisku: 8, prekryv: 15, papirW: 210, papirH: 297, kalibX: 100, kalibY: 100, drahy: true,
    stul: 220, vulePuzzle: 0.15, oznaceni: true,
  };
  /** vodicí prvek → {Rv, Rf, o, nazev} */
  function vedeni(N) {
    const Df = Math.max(0.5, cislo(N.Df, 8)), loz = N.vedeni === 'lozisko';
    const Dv = Math.max(1, loz ? cislo(N.Dl, Df) : cislo(N.Dk, 17));
    return { Dv, Df, Rv: Dv / 2, Rf: Df / 2, o: (Dv - Df) / 2, lozisko: loz, nazev: loz ? 'ložisko' : 'kroužek' };
  }

  /* ---------------- režimy ---------------- */
  const KOP = { k: 'kopirovani', n: 'Kopírování', t: 'v', m: [['vnitrni', 'vnitřní – otvor / kapsa (kroužek uvnitř šablony)'], ['vnejsi', 'vnější – obrys dílu (kroužek obíhá šablonu)']] };
  const PISMA = [
    ['SairaStencilOne-Regular.ttf', 'Saira Stencil One (šablonové písmo s můstky)'], ['Anton-Regular.ttf', 'Anton'], ['ArchivoBlack-Regular.ttf', 'Archivo Black'],
    ['BebasNeue-Regular.ttf', 'Bebas Neue'], ['RussoOne-Regular.ttf', 'Russo One'], ['AlfaSlabOne-Regular.ttf', 'Alfa Slab One'], ['TitanOne-Regular.ttf', 'Titan One'],
    ['Staatliches-Regular.ttf', 'Staatliches'], ['FjallaOne-Regular.ttf', 'Fjalla One'], ['LiberationSans-Bold.ttf', 'Liberation Sans Bold'], ['LiberationSerif-Bold.ttf', 'Liberation Serif Bold'],
    ['BlackOpsOne-Regular.ttf', 'Black Ops One'], ['Righteous-Regular.ttf', 'Righteous'], ['Bungee-Regular.ttf', 'Bungee'],
  ];
  const REZIMY = {
    obdelnik: { nazev: 'Obdélník', ikona: '▭', skupina: 'tvar', popis: 'Obdélník se zaoblenými rohy – kapsa, výřez nebo obrys dílu (podložky, dvířka, krabičky).',
      vychozi: { sirka: 200, vyska: 120, r: 10, kopirovani: 'vnitrni' },
      pole: [{ k: 'sirka', n: 'Šířka (mm)', min: 2, max: 3000 }, { k: 'vyska', n: 'Výška (mm)', min: 2, max: 3000 }, { k: 'r', n: 'Poloměr rohů (mm)', min: 0, max: 1500, krok: 0.5 }, KOP] },
    kruh: { nazev: 'Kruh', ikona: '◯', skupina: 'tvar', popis: 'Kruhový otvor, kapsa pro hodinový strojek, reproduktor, vývodku – nebo kruhový díl.',
      vychozi: { D: 80, kopirovani: 'vnitrni' }, pole: [{ k: 'D', n: 'Průměr (mm)', min: 2, max: 3000, krok: 0.5 }, KOP] },
    oval: { nazev: 'Ovál / elipsa', ikona: '⬭', skupina: 'tvar', popis: 'Ovál (stadion – dva půlkruhy a rovné strany) nebo přesná elipsa; ofset elipsy je rovnoběžná křivka, ne elipsa.',
      vychozi: { typ: 'stadion', sirka: 160, vyska: 80, kopirovani: 'vnitrni' },
      pole: [{ k: 'typ', n: 'Tvar', t: 'v', m: [['stadion', 'ovál – stadion'], ['elipsa', 'elipsa']] }, { k: 'sirka', n: 'Šířka (mm)', min: 2, max: 3000 }, { k: 'vyska', n: 'Výška (mm)', min: 2, max: 3000 }, KOP] },
    oblouk: { nazev: 'Oblouková drážka', ikona: '◠', skupina: 'tvar', popis: 'Drážka po oblouku s kulatými konci (vedení výklopného dílu, otočného stolku, dekor). Ofsety oblouků jsou soustředné.',
      vychozi: { R: 120, sirka: 16, uhel: 90, natoceni: 90, kopirovani: 'vnitrni' },
      pole: [{ k: 'R', n: 'Poloměr osy drážky (mm)', min: 5, max: 3000 }, { k: 'sirka', n: 'Šířka drážky (mm)', min: 1, max: 500, krok: 0.5 }, { k: 'uhel', n: 'Úhel oblouku (°)', min: 1, max: 340 }, { k: 'natoceni', n: 'Natočení osy (°)', min: -360, max: 360 }, KOP] },
    text: { nazev: 'Písmena / text', ikona: '🔤', skupina: 'tvar', popis: 'Nápis z písma OFL (obsah/fonty) – vybrání písmen do cedule (vnitřní) nebo vystouplá písmena (vnější). Šablonové písmo má místo ostrůvků můstky (při malé výšce je ofset zalije – sledujte varování).',
      vychozi: { text: 'DUB', pismo: 'SairaStencilOne-Regular.ttf', vyska: 150, mezera: 4, radkovani: 1.3, kopirovani: 'vnitrni' },
      pole: [{ k: 'text', n: 'Text (nový řádek = další řádek)', t: 'ta' }, { k: 'pismo', n: 'Písmo', t: 'v', m: PISMA }, { k: 'vyska', n: 'Výška verzálek (mm)', min: 5, max: 1000 }, { k: 'mezera', n: 'Mezera mezi písmeny (mm)', min: -20, max: 200, krok: 0.5 }, { k: 'radkovani', n: 'Řádkování (× výška)', min: 1, max: 4, krok: 0.05 }, KOP] },
    svg: { nazev: 'Vlastní SVG', ikona: '🖼️', skupina: 'tvar', popis: 'Import obrysu ze SVG (path, rect, circle, ellipse, polygon, skupiny s transformací). Uzavřené cesty = plochy; bez výplně se bere sudá–lichá.',
      vychozi: { svg: '', sirka: 150, meritko: 'sirka', kopirovani: 'vnitrni' },
      pole: [{ k: 'meritko', n: 'Rozměr', t: 'v', m: [['sirka', 'zadat šířku'], ['puvodni', 'podle jednotek SVG (mm / px 96 dpi)']] }, { k: 'sirka', n: 'Šířka výsledku (mm)', min: 2, max: 3000, ukaz: (p) => p.meritko === 'sirka' }, KOP, { k: 'svg', t: 'svg' }] },
    uchyt: { nazev: 'Úchytový výřez', ikona: '✋', skupina: 'kovani', popis: 'Úchyt do dvířek/zásuvky: průchozí ovál, výřez do hrany (otevřený) nebo zapuštěná mušle.',
      vychozi: { typ: 'hrana', sirka: 120, hloubka: 30, r: 25, odHrany: 40 },
      pole: [{ k: 'typ', n: 'Druh', t: 'v', m: [['hrana', 'výřez v hraně (otevřený)'], ['ovalny', 'průchozí ovál'], ['musle', 'zapuštěná mušle (kapsa)']] },
        { k: 'sirka', n: 'Šířka úchytu (mm)', min: 10, max: 1000 }, { k: 'hloubka', n: 'Výška / zápich do desky (mm)', min: 5, max: 500 },
        { k: 'r', n: 'Poloměr rohů (mm)', min: 0, max: 500, krok: 0.5, ukaz: (p) => p.typ === 'hrana' },
        { k: 'odHrany', n: 'Osa úchytu od hrany (mm)', min: 0, max: 1000, ukaz: (p) => p.typ !== 'hrana' }] },
    drez: { nazev: 'Dřez / varná deska', ikona: '🍳', skupina: 'kovani', popis: 'Výřez v pracovní desce pro vestavný dřez nebo varnou desku. Rozměr a poloměr rohů vždy podle montážního návodu spotřebiče.',
      vychozi: { predvolba: 'drez', sirka: 560, vyska: 490, r: 10 },
      pole: [{ k: 'predvolba', n: 'Předvolba (příklad – ověřte v návodu)', t: 'v', m: [['drez', 'vestavný dřez – příklad 560 × 490 R10'], ['varna', 'varná deska – příklad 560 × 490 R5'], ['vlastni', 'vlastní rozměr']] },
        { k: 'sirka', n: 'Šířka výřezu (mm)', min: 50, max: 2000 }, { k: 'vyska', n: 'Hloubka výřezu (mm)', min: 50, max: 1500 }, { k: 'r', n: 'Poloměr rohů (mm)', min: 0, max: 300, krok: 0.5 }] },
    pant: { nazev: 'Pant / zámek', ikona: '🚪', skupina: 'kovani', popis: 'Šablona s dorazy pro zapuštění křídla pantu (otevřené k líci) nebo čelní desky zámku (uprostřed hrany).',
      vychozi: { druh: 'pant', delka: 76, sirka: 28, r: 5, hloubkaKapsy: 2.5, tlHrany: 40, dorazy: 'oba', vyskaDorazu: 15 },
      pole: [{ k: 'druh', n: 'Kapsa pro', t: 'v', m: [['pant', 'křídlo pantu (otevřené k líci)'], ['zamek', 'čelní desku zámku (uprostřed)']] },
        { k: 'delka', n: 'Délka kapsy (mm)', min: 10, max: 500 }, { k: 'sirka', n: 'Šířka kapsy (mm)', min: 5, max: 200 }, { k: 'r', n: 'Poloměr rohů (mm)', min: 0, max: 100, krok: 0.5 },
        { k: 'hloubkaKapsy', n: 'Hloubka kapsy = tl. křídla (mm)', min: 0.5, max: 30, krok: 0.1 }, { k: 'tlHrany', n: 'Tloušťka dveří / hrany (mm)', min: 10, max: 200 },
        { k: 'dorazy', n: 'Dorazy', t: 'v', m: [['oba', 'z obou stran (na tloušťku hrany)'], ['jeden', 'jen z líce']] }, { k: 'vyskaDorazu', n: 'Doraz pod šablonou (mm)', min: 3, max: 60 }] },
    magnety: { nazev: 'Kapsy pro magnety', ikona: '🧲', skupina: 'kovani', popis: 'Řada kapes pro kruhové magnety (zavírání dvířek, krabičky, vyjímatelné dno) s dorazem od hrany.',
      vychozi: { D: 10, vule: 0.2, hloubkaKapsy: 3.3, pocet: 2, roztec: 40, odHrany: 15 },
      pole: [{ k: 'D', n: 'Průměr magnetu (mm)', min: 2, max: 100, krok: 0.5 }, { k: 'vule', n: 'Vůle na průměru (mm)', min: -0.5, max: 2, krok: 0.05 },
        { k: 'hloubkaKapsy', n: 'Hloubka kapsy (mm)', min: 0.5, max: 50, krok: 0.1 }, { k: 'pocet', n: 'Počet kapes', min: 1, max: 30 }, { k: 'roztec', n: 'Rozteč (mm)', min: 1, max: 1000 },
        { k: 'odHrany', n: 'Střed od hrany (0 = bez dorazu)', min: 0, max: 500 }] },
    motylek: { nazev: 'Motýlek (vložka)', ikona: '🦋', skupina: 'kovani', popis: 'Rybinový klín / motýlek (butterfly, bow-tie inlay): pár šablon – otvor pro kapsu a ostrůvek pro vložku – s kompenzací poloměrů, aby vložka přesně seděla.',
      vychozi: { delka: 100, sirkaKonce: 50, sirkaPas: 18, hloubkaKapsy: 8, mezera: 0.05, DkKapsa: 0, DkVlozka: 0, rKonce: 0, rPas: 0 },
      pole: [{ k: 'delka', n: 'Délka (mm)', min: 20, max: 1000 }, { k: 'sirkaKonce', n: 'Šířka konců (mm)', min: 5, max: 500 }, { k: 'sirkaPas', n: 'Šířka v pase (mm)', min: 2, max: 500 },
        { k: 'hloubkaKapsy', n: 'Hloubka kapsy (mm)', min: 1, max: 60, krok: 0.5 }, { k: 'mezera', n: 'Spára na lepidlo na stranu (mm)', min: 0, max: 1, krok: 0.01 },
        { k: 'DkKapsa', n: 'Kroužek pro kapsu Ø (0 = hlavní)', min: 0, max: 60, krok: 0.1 }, { k: 'DkVlozka', n: 'Kroužek pro vložku Ø (0 = hlavní)', min: 0, max: 60, krok: 0.1 },
        { k: 'rKonce', n: 'Min. poloměr rohů konců (0 = auto)', min: 0, max: 100, krok: 0.5 }, { k: 'rPas', n: 'Min. poloměr v pase (0 = auto)', min: 0, max: 100, krok: 0.5 }] },
    rameno: { nazev: 'Kruhové rameno', ikona: '🧭', skupina: 'pripravky', popis: 'Kruhové rameno (circle jig) místo základové desky frézky: rozteč šroubů podle vaší frézky, řada otvorů pro čep se stupnicí poloměrů.',
      vychozi: { roztec: 120, pocetSroubu: 3, uhelSroubu: 90, sroubD: 4.5, zahlD: 9, otvorD: 40, sirkaRamene: 56, Rmin: 60, Rmax: 300, krok: 10, cep: 6.2, stupnice: 'kotouc' },
      pole: [{ k: 'roztec', n: 'Roztečná kružnice šroubů Ø (mm)', min: 20, max: 400, krok: 0.1 }, { k: 'pocetSroubu', n: 'Počet šroubů', min: 1, max: 8 }, { k: 'uhelSroubu', n: 'Úhel 1. šroubu (°)', min: -360, max: 360 },
        { k: 'sroubD', n: 'Otvor šroubu Ø (M4 → 4,5)', min: 2, max: 10, krok: 0.1 }, { k: 'zahlD', n: 'Zahloubení Ø (0 = bez)', min: 0, max: 20, krok: 0.1 }, { k: 'otvorD', n: 'Středový otvor Ø (mm)', min: 5, max: 120 },
        { k: 'sirkaRamene', n: 'Šířka ramene (mm)', min: 20, max: 200 }, { k: 'Rmin', n: 'Nejmenší poloměr (mm)', min: 5, max: 3000 }, { k: 'Rmax', n: 'Největší poloměr (mm)', min: 10, max: 3000 },
        { k: 'krok', n: 'Krok stupnice (mm)', min: 1, max: 200, krok: 0.5 }, { k: 'cep', n: 'Otvor pro čep Ø (mm)', min: 1, max: 20, krok: 0.1 },
        { k: 'stupnice', n: 'Celá čísla stupnice pro', t: 'v', m: [['kotouc', 'kotouč (díl uvnitř kruhu)'], ['otvor', 'kruhový otvor (díl vně)']] }] },
    tvoditko: { nazev: 'Vodítko na drážky', ikona: '📏', skupina: 'pripravky', popis: 'T-vodítko (T-square jig) pro drážky a polodrážky napříč deskou: buď základna frézky jede po vodítku, nebo štěrbinová šablona pro kroužek.',
      vychozi: { typ: 'zakladna', druh: 'drazka', W: 15, sirkaDesky: 400, odstup: 75, sirkaVoditka: 60, sirkaHlavy: 50, vyskaHlavy: 15 },
      pole: [{ k: 'typ', n: 'Provedení', t: 'v', m: [['zakladna', 'základna frézky jede po vodítku'], ['krouzek', 'štěrbinová šablona pro kroužek']] },
        { k: 'druh', n: 'Řez', t: 'v', m: [['drazka', 'drážka (dado)'], ['polodrazka', 'polodrážka na hraně (rabbet)']], ukaz: (p) => p.typ === 'zakladna' },
        { k: 'W', n: 'Šířka drážky (mm)', min: 1, max: 200, krok: 0.1 }, { k: 'sirkaDesky', n: 'Šířka desky, přes kterou drážka vede (mm)', min: 50, max: 3000 },
        { k: 'odstup', n: 'Osa frézy → hrana základny (mm)', min: 10, max: 300, krok: 0.1, ukaz: (p) => p.typ === 'zakladna' },
        { k: 'sirkaVoditka', n: 'Šířka lišty vodítka (mm)', min: 20, max: 300 }, { k: 'sirkaHlavy', n: 'Šířka příložníku (mm)', min: 20, max: 300 }, { k: 'vyskaHlavy', n: 'Příložník pod deskou (mm)', min: 3, max: 60 }] },
  };
  const SKUPINY = [['tvar', 'Kopírovací šablony – tvar'], ['kovani', 'Kování a výřezy'], ['pripravky', 'Přípravky']];

  /* ---------------- tvary ---------------- */
  const obdelnikPrim = (x0, y0, x1, y1, r) => ({ typ: 'zm', body: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], r: Array.isArray(r) ? r : [r, r, r, r] });
  const rOmez = (r, w, h) => Math.max(0, Math.min(r, w / 2, h / 2));
  /** obdélník (střed v počátku) */
  function tvarObdelnik(w, h, r) { const rr = rOmez(r, w, h); return G.tvarZPrimitiv([obdelnikPrim(-w / 2, -h / 2, w / 2, h / 2, rr)]); }
  /** motýlek: body proti směru hodin, poloměry konce / pas */
  function motylekPrim(L, E, P, rv, rr) {
    return { typ: 'zm', body: [[-L / 2, -E / 2], [0, -P / 2], [L / 2, -E / 2], [L / 2, E / 2], [0, P / 2], [-L / 2, E / 2]], r: [rv, rr, rv, rv, rr, rv] };
  }

  /** text z písma opentype.js (font objekt) → oblast; řádky na střed, střed bloku v počátku */
  function tvarText(font, text, vyska, mezera, radkovani) {
    const upm = font.unitsPerEm || 1000;
    let cap = font.tables && font.tables.os2 && font.tables.os2.sCapHeight;
    if (!cap) { const g = font.charToGlyph('H'), b = g && g.getBoundingBox ? g.getBoundingBox() : null; cap = b ? b.y2 - b.y1 : upm * 0.7; }
    const vel = vyska * upm / cap, k = vel / upm, radky = String(text || '').split(/\r?\n/).filter((s, i, a) => s.length || i < a.length - 1);
    const vse = [], sirky = [];
    radky.forEach((radek, ri) => {
      const glyfy = font.stringToGlyphs(radek), polys = [];
      let x = 0, posl = null;
      for (const g of glyfy) {
        if (posl) x += (font.getKerningValue ? font.getKerningValue(posl, g) : 0) * k;
        const cmds = g.getPath(x, 0, vel).commands;
        const pc = G.prikazyNaPodcesty(cmds), zpl = G.zplostiCesty(pc, [1, 0, 0, -1, 0, -ri * vyska * radkovani], 0.01);
        const sj = G.sjednot(zpl.map((q) => q.body));
        for (const p of sj) polys.push(p);
        x += (g.advanceWidth || 0) * k + mezera;
        posl = g;
      }
      sirky.push(x - mezera);
      vse.push(polys);
    });
    const out = [];
    vse.forEach((polys, i) => { for (const p of G.posun(polys, -sirky[i] / 2, 0)) out.push(p); });
    if (!out.length) return { polys: [], kontury: null, prim: null };
    const o = G.obal(out), sj = G.sjednot(G.posun(out, -(o.x0 + o.x1) / 2, -(o.y0 + o.y1) / 2));
    return G.tvarZOblasti(sj);
  }

  /** SVG text → oblast (bez DOM: jednoduchý rozbor značek, skupiny s transform, defs se přeskočí) */
  function tvarSvg(svgText, meritko, sirka) {
    const txt = String(svgText || '');
    const re = /<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
    const atr = (s) => { const o = {}; const r = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g; let m; while ((m = r.exec(s))) o[m[1]] = m[2] != null ? m[2] : m[3]; return o; };
    const zasob = [{ m: G.MAT_I, fill: null, skryt: false }], polys = [];
    let jednotka = 1, m;
    const PRESKOC = new Set(['defs', 'clipPath', 'mask', 'symbol', 'marker', 'pattern', 'title', 'desc', 'metadata', 'style', 'linearGradient', 'radialGradient', 'text']);
    while ((m = re.exec(txt))) {
      const [, zav, tagP, atrS, sam] = m, tag = tagP.replace(/^.*:/, ''), a = atr(atrS), top = zasob[zasob.length - 1];
      if (zav) { if (zasob.length > 1) zasob.pop(); continue; }
      const styl = String(a.style || ''), fillS = (/fill\s*:\s*([^;]+)/.exec(styl) || [])[1] || a.fill;
      const ctx = { m: G.matNasob(top.m, G.rozeberTransform(a.transform)), fill: fillS != null ? String(fillS).trim() : top.fill, skryt: top.skryt || PRESKOC.has(tag) || a.display === 'none' || /display\s*:\s*none/.test(styl) };
      if (tag === 'svg' && zasob.length === 1) {
        const vb = String(a.viewBox || '').trim().split(/[\s,]+/).map(Number), w = String(a.width || '');
        const mm = /mm\s*$/.test(w) ? parseFloat(w) : /cm\s*$/.test(w) ? parseFloat(w) * 10 : /in\s*$/.test(w) ? parseFloat(w) * 25.4 : /pt\s*$/.test(w) ? parseFloat(w) * 25.4 / 72 : parseFloat(w) ? parseFloat(w) * 25.4 / 96 : 0;
        jednotka = vb.length === 4 && vb[2] > 0 && mm ? mm / vb[2] : mm ? 25.4 / 96 : 25.4 / 96;
      }
      if (!ctx.skryt) {
        const d = G.prvekNaCestu(tag, a);
        if (d) {
          const pc = G.rozeberCestu(d), z = G.zplostiCesty(pc, ctx.m, 0.005), bezVyplne = ctx.fill === 'none';
          const fr = String(a['fill-rule'] || (/fill-rule\s*:\s*(\w+)/.exec(styl) || [])[1] || '');
          const sj = G.sjednot(z.map((q) => q.body), bezVyplne || fr === 'evenodd');
          for (const p of sj) polys.push(p);
        }
      }
      if (!sam && !['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'use', 'image'].includes(tag)) zasob.push(ctx);
    }
    if (!polys.length) return { polys: [], kontury: null, prim: null };
    // y dolů → y nahoru, měřítko, střed do počátku
    const sj = G.sjednot(polys.map((p) => p.map((q) => [q[0], -q[1]])));
    const o = G.obal(sj), k = meritko === 'puvodni' ? jednotka : (sirka > 0 && o.w > 0 ? sirka / o.w : 1);
    return G.tvarZOblasti(G.sjednot(sj.map((p) => p.map((q) => [(q[0] - (o.x0 + o.x1) / 2) * k, (q[1] - (o.y0 + o.y1) / 2) * k]))));
  }

  /* ---------------- šablona pro tvar (výpočet kopírování) ---------------- */
  const stredOblasti = (polys) => { const o = G.obal(polys); return [r2((o.x0 + o.x1) / 2), r2((o.y0 + o.y1) / 2)]; };
  /**
   * tvar, kop ('vnitrni'|'vnejsi'), N, V (vedení) → výsledek kopírování
   * {sab: tvar šablony, stred (oblast středu kroužku), rez (výsledek), nedos (rohy, kam kroužek nedosáhne), odchylka, hd, ostrovky}
   */
  function kopirovani(tvar, kop, V) {
    const { Rv, Rf, o } = V;
    let sab, stred, rez, nedos;
    if (kop === 'vnejsi') {
      sab = G.ofsetTvaru(tvar, -o);
      stred = sab.polys.length ? G.ofset(sab.polys, Rv) : [];
      rez = stred.length ? G.ofset(stred, -Rf) : [];
      nedos = stred.length ? G.podstatne(G.rozdil(G.ofset(stred, -Rv), sab.polys), 0.02) : [];
    } else {
      sab = G.ofsetTvaru(tvar, o);
      stred = G.ofset(sab.polys, -Rv);
      rez = stred.length ? G.ofset(stred, Rf) : [];
      nedos = G.podstatne(G.rozdil(sab.polys, stred.length ? G.ofset(stred, Rv) : []), 0.02);
    }
    const odchylka = rez.length ? G.podstatne(G.operace(rez, tvar.polys, 'xor'), 0.02) : tvar.polys;
    const hd = rez.length && tvar.polys.length ? G.hausdorff(rez, tvar.polys) : { max: Infinity };
    // volné ostrůvky: díry v otvoru šablony (vnitřní) – kusy šablony, které nic nedrží
    const ostrovky = kop === 'vnejsi' ? 0 : sab.polys.filter((p) => G.plocha(p) < 0).length;
    return { sab, stred, rez, nedos, odchylka, hd, ostrovky };
  }

  /** text varování o rozích */
  function varovaniRohu(K, kop, V, prefix) {
    const out = [], P = prefix ? prefix + ': ' : '';
    const nd = G.komponenty(K.nedos);
    if (nd.length) {
      const mista = nd.slice(0, 6).map((c) => { const s = stredOblasti(c); return `[${cz(s[0], 1)}; ${cz(s[1], 1)}]`; }).join(', ');
      out.push(kop === 'vnejsi'
        ? `${P}${nd.length}× ostrý vnitřní kout obrysu šablony (poloměr < ${cz(V.Rv, 2)} mm = poloměr ${V.nazev === 'ložisko' ? 'ložiska' : 'kroužku'}): ${V.nazev} do koutu nedosáhne a řez tam zůstane zaoblený (${mista}${nd.length > 6 ? ', …' : ''}). Kouty tvaru zaoblete na ≥ ${cz(V.Rf, 2)} mm.`
        : `${P}${nd.length}× ostrý vnitřní roh otvoru šablony (poloměr < ${cz(V.Rv, 2)} mm = poloměr ${V.nazev === 'ložisko' ? 'ložiska' : 'kroužku'}): ${V.nazev} do rohu nedosáhne a kapsa tam bude zaoblená (${mista}${nd.length > 6 ? ', …' : ''}). Rohy tvaru zaoblete na ≥ ${cz(V.Rf, 2)} mm, nebo je dočistěte dlátem.`);
    }
    if (isFinite(K.hd.max) && K.hd.max > 0.05) {
      out.push(`${P}výsledný řez se od zadaného tvaru liší až o ${cz(K.hd.max, 2)} mm. ` + (kop === 'vnejsi'
        ? `Vnější rohy dílu vyjdou nejméně s R ${cz(Math.max(0, V.o), 2)} mm (kroužek je obíhá), kouty nejméně s R ${cz(V.Rf, 2)} mm (poloměr frézy).`
        : `Rohy kapsy vyjdou nejméně s R ${cz(V.Rf, 2)} mm (poloměr frézy), výstupky do kapsy nejméně s R ${cz(Math.max(0, V.o), 2)} mm.`));
    }
    if (!K.rez.length) out.push(`${P}${kop === 'vnejsi' ? 'šablona po odečtení ofsetu zanikla – tvar je užší než 2 × ofset' : `${V.nazev} se do otvoru šablony nevejde – tvar je užší než průměr frézy`}.`);
    if (K.ostrovky) out.push(`${P}otvor šablony obsahuje ${K.ostrovky} volný ostrůvek (např. vnitřek písmen O, A, B) – nic ho nedrží. Použijte šablonové písmo, přidejte můstky, nebo ostrůvky přilepte na oboustrannou pásku přesně na místo.`);
    return out;
  }

  /** deska šablony kolem otvoru: zaoblený obdélník s okrajem, nebo zadaný obrys */
  function deskaKolem(sab, N, venku) {
    const o = G.obal(sab.polys), m = Math.max(5, cislo(N.okrajDesky, 70)), rd = Math.max(0, cislo(N.rDesky, 8));
    const b = venku || { x0: o.x0 - m, y0: o.y0 - m, x1: o.x1 + m, y1: o.y1 + m };
    const prim = obdelnikPrim(b.x0, b.y0, b.x1, b.y1, rOmez(rd, b.x1 - b.x0, b.y1 - b.y0));
    const vnejsi = G.tvarZPrimitiv([prim]);
    const polys = G.rozdil(vnejsi.polys, sab.polys);
    let kontury = null;
    if (sab.kontury && vnejsi.kontury) {
      const ocek = G.plochaOblasti(vnejsi.polys) - G.plochaOblasti(sab.polys);
      if (Math.abs(G.plochaOblasti(polys) - ocek) < 0.05 + 1e-5 * Math.abs(ocek)) kontury = vnejsi.kontury.concat(sab.kontury.map(G.obratKonturu));
    }
    return { polys, kontury, obal: b };
  }

  /**
   * dil šablony: {id, nazev, druh, kop, tvar, sab, deska, stred, rez, nedos, odchylka, hd, dorazy:[{polys, v}], znacky, texty, hloubka, V}
   * o: {venku (obal desky), dorazy: [obdélníky {x0,y0,x1,y1}], znacky, texty, hloubka, popis}
   */
  function dilSablony(id, nazev, tvar, kop, N, V, o) {
    o = o || {};
    const K = kopirovani(tvar, kop, V);
    let deska;
    if (kop === 'vnejsi') deska = { polys: K.sab.polys, kontury: K.sab.kontury, obal: G.obal(K.sab.polys.length ? K.sab.polys : [[[0, 0], [1, 0], [1, 1]]]) };
    else deska = deskaKolem(K.sab, N, o.venku);
    // dorazy pod deskou: bez místa, kudy jde fréza
    const volno = K.rez.length ? G.ofset(G.sjednoceni(K.sab.polys, K.rez), 1.5) : [];
    const dorazy = (o.dorazy || []).map((b) => ({ polys: G.rozdil([[[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]], volno), v: b.v, popis: b.popis })).filter((d) => d.polys.length);
    const znacky = (o.znacky || []).slice(), texty = (o.texty || []).slice();
    const ob = deska.obal;
    if (o.osy !== false && kop !== 'vnejsi') {
      // ryska os na okrajích desky (pro přiložení k tužkovým čarám)
      const c = o.stredZnacek || [0, 0], L = Math.min(12, (ob.x1 - ob.x0) * 0.08);
      znacky.push({ b: [[c[0], ob.y0], [c[0], ob.y0 + L]], v: 'gravura' }, { b: [[c[0], ob.y1], [c[0], ob.y1 - L]], v: 'gravura' });
      znacky.push({ b: [[ob.x0, c[1]], [ob.x0 + L, c[1]]], v: 'gravura' }, { b: [[ob.x1, c[1]], [ob.x1 - L, c[1]]], v: 'gravura' });
    }
    const dil = Object.assign({ id, nazev, druh: 'sablona', kop, tvar, deska, dorazy, znacky, texty, hloubka: o.hloubka != null ? o.hloubka : cislo(N.hloubka, 6), V, popis: o.popis || '' }, K);
    dil.varovani = varovaniRohu(K, kop, V, o.prefix);
    dil.draha = drahaZOblasti(K.stred);
    dil.stitek = `${id} ${V.lozisko ? 'L' : ''}${r2(V.Dv)}-${r2(V.Df)}`;
    return dil;
  }
  /** dráha středu vodicího prvku: smyčky hranice oblasti (nejdelší první) */
  function drahaZOblasti(polys) {
    return polys.map((p) => p.slice()).sort((a, b) => Math.abs(G.plocha(b)) - Math.abs(G.plocha(a)));
  }

  /* ---------------- návrh podle režimu ---------------- */
  function navrhTvar(rez, p, N, V, zdroje) {
    const kop = p.kopirovani === 'vnejsi' ? 'vnejsi' : 'vnitrni', var0 = [];
    let tvar, nazev, popis = '';
    if (rez === 'obdelnik') { tvar = tvarObdelnik(p.sirka, p.vyska, p.r); nazev = `${cz(p.sirka, 1)} × ${cz(p.vyska, 1)} R${cz(rOmez(p.r, p.sirka, p.vyska), 1)}`; if (p.r > Math.min(p.sirka, p.vyska) / 2) var0.push('Poloměr rohů je větší než polovina kratší strany – omezen.'); }
    else if (rez === 'kruh') { tvar = G.tvarZPrimitiv([{ typ: 'kruh', c: [0, 0], r: p.D / 2 }]); nazev = `kruh Ø${cz(p.D, 1)}`; }
    else if (rez === 'oval') {
      if (p.typ === 'elipsa') { tvar = G.tvarZPrimitiv([{ typ: 'elipsa', c: [0, 0], a: p.sirka / 2, b: p.vyska / 2 }]); nazev = `elipsa ${cz(p.sirka, 1)} × ${cz(p.vyska, 1)}`; }
      else { tvar = tvarObdelnik(p.sirka, p.vyska, Math.min(p.sirka, p.vyska) / 2); nazev = `ovál ${cz(p.sirka, 1)} × ${cz(p.vyska, 1)}`; }
    } else if (rez === 'oblouk') {
      const u = omez(p.uhel, 1, 340) * RAD, n = p.natoceni * RAD;
      tvar = G.tvarZPrimitiv([{ typ: 'drazka', c: [0, 0], R: p.R, w: Math.min(p.sirka, p.R * 1.9), u0: n - u / 2, u1: n + u / 2 }]);
      nazev = `drážka R${cz(p.R, 1)} × ${cz(p.sirka, 1)}, ${cz(p.uhel, 0)}°`;
      if (p.sirka >= p.R * 1.9) var0.push('Drážka je širší než poloměr osy – omezena.');
    } else if (rez === 'text') {
      if (!zdroje.pismo) return { dily: [], varovani: ['Písmo se načítá…'], info: '', ceka: 'pismo' };
      tvar = tvarText(zdroje.pismo, p.text, p.vyska, p.mezera, p.radkovani);
      nazev = `text „${String(p.text).replace(/\s+/g, ' ').slice(0, 24)}“`;
      if (!tvar.polys.length) return { dily: [], varovani: ['Text je prázdný nebo písmo nemá tyto znaky.'], info: '' };
    } else if (rez === 'svg') {
      if (!p.svg) return { dily: [], varovani: ['Načtěte soubor SVG s uzavřenými obrysy.'], info: '' };
      tvar = tvarSvg(p.svg, p.meritko, p.sirka);
      nazev = 'vlastní SVG';
      if (!tvar.polys.length) return { dily: [], varovani: ['V SVG nejsou žádné uzavřené plochy (path, rect, circle, ellipse, polygon).'], info: '' };
    }
    popis = kop === 'vnejsi' ? 'vnější kopírování – kroužek obíhá šablonu, zůstane díl' : 'vnitřní kopírování – kroužek jede uvnitř otvoru';
    const d = dilSablony('A', nazev, tvar, kop, N, V, { popis });
    return { dily: [d], varovani: var0 };
  }

  function navrhUchyt(p, N, V) {
    const w = p.sirka, h = p.hloubka, e = V.Rv + 6, var0 = [];
    let tvar, o = {}, nazev;
    if (p.typ === 'hrana') {
      // deska (dvířka) nad osou x, hrana y = 0; výřez otevřený dolů přes hranu
      const r = Math.max(0, Math.min(p.r, w / 2, h + e));
      tvar = G.tvarZPrimitiv([obdelnikPrim(-w / 2, -e, w / 2, h, [V.Rf, V.Rf, r, r])]);
      const sab = G.ofsetTvaru(tvar, V.o), ob = G.obal(sab.polys), m = Math.max(5, N.okrajDesky);
      o.venku = { x0: ob.x0 - m, x1: ob.x1 + m, y0: -e - V.o - 20, y1: ob.y1 + m };
      o.dorazy = [{ x0: o.venku.x0, x1: o.venku.x1, y0: -16, y1: 0, v: 'hrana' }];
      o.stredZnacek = [0, 0];
      nazev = `výřez v hraně ${cz(w, 0)} × ${cz(h, 0)}`;
      if (r < V.Rf) var0.push(`Poloměr rohů ${cz(r, 1)} mm je menší než poloměr frézy ${cz(V.Rf, 1)} mm.`);
    } else {
      const hh = Math.min(h, w), y = p.odHrany || 0;
      tvar = G.tvarZPrimitiv([obdelnikPrim(-w / 2, y - hh / 2, w / 2, y + hh / 2, hh / 2)]);
      o.stredZnacek = [0, y];
      if (y > 0) {
        const sab = G.ofsetTvaru(tvar, V.o), ob = G.obal(sab.polys), m = Math.max(5, N.okrajDesky);
        o.venku = { x0: ob.x0 - m, x1: ob.x1 + m, y0: -16, y1: ob.y1 + m };
        if (ob.y0 < 3) var0.push('Úchyt zasahuje k hraně – zvětšete vzdálenost od hrany.');
        o.dorazy = [{ x0: o.venku.x0, x1: o.venku.x1, y0: -16, y1: 0, v: 'hrana' }];
      }
      nazev = p.typ === 'musle' ? `mušle ${cz(w, 0)} × ${cz(hh, 0)}` : `ovál ${cz(w, 0)} × ${cz(hh, 0)}`;
      if (h > w) var0.push('Výška úchytu je větší než šířka – použita šířka (ovál).');
    }
    o.hloubka = p.typ === 'musle' ? Math.min(N.hloubka, N.tlObrobku - 3) : N.tlObrobku + 1;
    o.popis = p.typ === 'musle' ? 'kapsa – hloubka podle nastavení' : 'průchozí výřez – frézujte po vrstvách s podložkou pod obrobkem';
    const d = dilSablony('A', nazev, tvar, 'vnitrni', N, V, o);
    return { dily: [d], varovani: var0 };
  }

  function navrhDrez(p, N, V) {
    const tvar = tvarObdelnik(p.sirka, p.vyska, p.r);
    const d = dilSablony('A', `výřez ${cz(p.sirka, 0)} × ${cz(p.vyska, 0)} R${cz(p.r, 1)}`, tvar, 'vnitrni', N, V, { hloubka: N.tlObrobku + 1, popis: 'průchozí výřez v pracovní desce' });
    const var0 = ['Rozměr výřezu berte z montážního návodu spotřebiče (předvolby jsou jen příklad). Hrubě vyřízněte přímočarou pilou 3–5 mm od čáry, dočistěte frézou s ložiskem nebo kroužkem po šabloně.'];
    if (p.r < V.Rf) var0.push(`Poloměr rohů ${cz(p.r, 1)} mm je menší než poloměr frézy – rohy výřezu vyjdou s R ${cz(V.Rf, 1)} mm (u dřezu obvykle nevadí, zakryje je lem).`);
    return { dily: [d], varovani: var0 };
  }

  function navrhPant(p, N, V) {
    const L = p.delka, w = p.sirka, tl = p.tlHrany, e = V.Rv + 6, var0 = [];
    let tvar;
    if (p.druh === 'zamek') {
      if (w > tl - 4) var0.push('Kapsa zámku je skoro stejně široká jako hrana – ověřte rozměry.');
      tvar = tvarObdelnik(L, Math.min(w, tl - 1), p.r);
      tvar = G.tvarZPrimitiv([obdelnikPrim(-L / 2, tl / 2 - Math.min(w, tl - 1) / 2, L / 2, tl / 2 + Math.min(w, tl - 1) / 2, rOmez(p.r, L, Math.min(w, tl - 1)))]);
    } else {
      if (w >= tl) var0.push('Šířka kapsy pantu je větší než tloušťka dveří.');
      const r = Math.max(0, Math.min(p.r, L / 2, w + e));
      tvar = G.tvarZPrimitiv([obdelnikPrim(-L / 2, -e, L / 2, Math.min(w, tl), [V.Rf, V.Rf, r, r])]);
    }
    const sab = G.ofsetTvaru(tvar, V.o), ob = G.obal(sab.polys), m = Math.max(5, N.okrajDesky), S = 16;
    const venku = { x0: ob.x0 - m, x1: ob.x1 + m, y0: Math.min(ob.y0, 0) - Math.max(m * 0.6, S + 10), y1: Math.max(ob.y1, tl) + Math.max(m * 0.6, S + 10) };
    const dorazy = [{ x0: venku.x0, x1: venku.x1, y0: -S, y1: 0, v: p.vyskaDorazu, popis: 'líc' }];
    if (p.dorazy === 'oba') dorazy.push({ x0: venku.x0, x1: venku.x1, y0: tl, y1: tl + S, v: p.vyskaDorazu, popis: 'rub' });
    const znacky = [{ b: [[venku.x0, 0], [venku.x1, 0]], v: 'hrana', c: true }, { b: [[venku.x0, tl], [venku.x1, tl]], v: 'hrana', c: true }];
    const d = dilSablony('A', p.druh === 'zamek' ? `zámek ${cz(L, 0)} × ${cz(w, 0)}` : `pant ${cz(L, 0)} × ${cz(w, 0)}`, tvar, 'vnitrni', N, V,
      { venku, dorazy, znacky, hloubka: p.hloubkaKapsy, stredZnacek: [0, tl / 2], popis: `kapsa hl. ${cz(p.hloubkaKapsy, 1)} mm; čárkovaně líc a rub hrany tl. ${cz(tl, 0)} mm` });
    d.hrana = { tl };
    if (p.r < V.Rf) var0.push(`Rohy kapsy vyjdou s R ${cz(V.Rf, 1)} mm (poloměr frézy). Pant s ostrými rohy: rohy dočistěte dlátem, nebo použijte pant se zaoblenými rohy.`);
    return { dily: [d], varovani: var0 };
  }

  function navrhMagnety(p, N, V) {
    const n = Math.max(1, Math.round(p.pocet)), Dm = p.D + p.vule, var0 = [], prim = [];
    const y = p.odHrany > 0 ? p.odHrany : 0;
    for (let i = 0; i < n; i++) prim.push({ typ: 'kruh', c: [(i - (n - 1) / 2) * p.roztec, y], r: Dm / 2 });
    let tvar = G.tvarZPrimitiv(prim);
    if (!tvar) tvar = G.tvarZOblasti(prim.map((q) => G.konturaNaBody(G.kruhKontura(q.c, q.r))));
    if (p.roztec < Dm + 2 && n > 1) var0.push('Kapsy se překrývají nebo mezi nimi zbývá méně než 2 mm.');
    if (Dm / 2 < V.Rf) var0.push(`Fréza Ø${cz(V.Df, 1)} je větší než kapsa Ø${cz(Dm, 2)} – zvolte menší frézu (nebo vrtejte Forstnerovým vrtákem).`);
    const o = { hloubka: p.hloubkaKapsy, stredZnacek: [0, y], popis: `kapsy Ø${cz(Dm, 2)} hl. ${cz(p.hloubkaKapsy, 1)} mm` };
    if (y > 0) {
      const sab = G.ofsetTvaru(tvar, V.o), ob = G.obal(sab.polys), m = Math.max(5, N.okrajDesky);
      o.venku = { x0: ob.x0 - m, x1: ob.x1 + m, y0: -16, y1: ob.y1 + m };
      o.dorazy = [{ x0: o.venku.x0, x1: o.venku.x1, y0: -16, y1: 0, v: 15, popis: 'hrana' }];
      if (y - Dm / 2 < 2) var0.push('Kapsa zasahuje skoro k hraně desky.');
    }
    const d = dilSablony('A', `${n}× magnet Ø${cz(p.D, 1)}`, tvar, 'vnitrni', N, V, o);
    return { dily: [d], varovani: var0 };
  }

  /** motýlek: pár šablon s kompenzací poloměrů */
  function navrhMotylek(p, N, V) {
    const var0 = [], g = Math.max(0, p.mezera || 0);
    const V1 = p.DkKapsa > 0 && N.vedeni !== 'lozisko' ? vedeni(Object.assign({}, N, { Dk: p.DkKapsa })) : V;
    const V2 = p.DkVlozka > 0 && N.vedeni !== 'lozisko' ? vedeni(Object.assign({}, N, { Dk: p.DkVlozka })) : V;
    const Rf = V.Rf, o1 = V1.o, o2 = V2.o;
    // kapsa (vnitřní): rohy ≥ Rf, pas (výstupky) ≥ o1; vložka (vnější, tvar ⊖ g): rohy ≥ o2 + g, pas ≥ Rf − g
    const rv = Math.max(Rf, o2 + g, p.rKonce || 0), rr = Math.max(o1, Rf - g, 0, p.rPas || 0);
    const L = p.delka, E = p.sirkaKonce, P = Math.min(p.sirkaPas, E - 1);
    const prim = motylekPrim(L, E, P, rv, rr);
    const tvar = G.tvarZPrimitiv([prim]);
    if (!tvar || !tvar.kontury) return { dily: [], varovani: ['Zaoblení se na motýlek nevejdou – zvětšete rozměry nebo použijte menší kroužek / frézu.'] };
    if (P <= 2 * (o2 + g) + 1) var0.push(`Pas ${cz(P, 1)} mm je pro vnější kopírování vložky s ${V2.lozisko ? 'ložiskem' : 'kroužkem'} Ø${cz(V2.Dv, 1)} příliš úzký – šablona vložky by se v pase rozpadla (potřeba > ${cz(2 * (o2 + g) + 1, 1)} mm). Rozšiřte pas nebo použijte pro vložku menší kroužek.`);
    const vlozka = G.ofsetTvaru(tvar, -g);
    const A = dilSablony('A', 'motýlek – šablona kapsy', tvar, 'vnitrni', N, V1, { hloubka: p.hloubkaKapsy, prefix: 'Kapsa', popis: `kapsa: vnitřní kopírování, ${V1.nazev} Ø${cz(V1.Dv, 2)}` });
    const B = dilSablony('B', 'motýlek – šablona vložky', vlozka, 'vnejsi', N, V2, { hloubka: p.hloubkaKapsy + 1, prefix: 'Vložka', popis: `vložka: vnější kopírování, ${V2.nazev} Ø${cz(V2.Dv, 2)}; vložku frézujte o 1 mm vyšší, po zalepení zarovnejte` });
    // kontrola páru: vložka uvnitř kapsy, spára = g
    const presah = A.rez.length && B.rez.length ? G.plochaOblasti(G.podstatne(G.rozdil(B.rez, A.rez), 0.01)) : Infinity;
    const spara = A.rez.length && B.rez.length ? G.hausdorff(A.rez, B.rez) : { max: Infinity };
    const par = { rv: r2(rv), rr: r2(rr), presah, spara: spara.max, mezera: g, sedi: presah < 0.01 && Math.abs(spara.max - g) < 0.05 };
    A.par = par; B.par = par;
    var0.push(`Kompenzace: rohy konců R ${cz(rv, 2)} mm, pas R ${cz(rr, 2)} mm – s nimi vyjde kapsa i vložka přesně podle tvaru a vložka sedí se spárou ${cz(g, 2)} mm na stranu.`);
    if (!par.sedi) var0.push(`Pár nesedí přesně: vložka přesahuje kapsu o ${cz(presah, 2)} mm², největší spára ${cz(spara.max, 2)} mm.`);
    return { dily: [A, B], varovani: var0, par };
  }

  /* ---------------- přípravky ---------------- */
  /** kruhové rameno: střed frézy v počátku, rameno po +x */
  function navrhRameno(p, N, V) {
    const var0 = [], Dz = Math.max(40, N.Dz), B = p.sirkaRamene, Rf = V.Rf, cep = p.cep;
    const rd = Dz / 2 + 5;
    const radky = [];       // otvory pro čep
    const zaklad = p.stupnice === 'otvor' ? -Rf : Rf;           // vzdálenost čep–osa frézy = R ± Rf
    const Rmin = Math.max(1, Math.min(p.Rmin, p.Rmax)), Rmax = Math.max(p.Rmin, p.Rmax), krok = Math.max(0.5, p.krok);
    const pocetRad = Math.max(1, Math.ceil((cep + 4) / krok - 1e-9));
    const emax = Math.max(0, B / 2 - cep / 2 - 3), rozteRad = pocetRad > 1 ? Math.min(cep + 3, 2 * emax / (pocetRad - 1)) : 0;
    if (pocetRad > 1 && rozteRad < cep + 2) var0.push(`Krok ${cz(krok, 1)} mm je na čep Ø${cz(cep, 1)} příliš jemný i pro rozložení do ${pocetRad} řad na šířce ramene – rozšiřte rameno nebo zvětšete krok.`);
    let i = 0;
    for (let R = Rmin; R <= Rmax + 1e-9; R = r3(Rmin + (++i) * krok)) {
      const d = R + zaklad, rada = (i % pocetRad), e = pocetRad > 1 ? (rada - (pocetRad - 1) / 2) * rozteRad : 0;
      if (d <= Math.abs(e)) continue;
      const x = Math.sqrt(d * d - e * e);
      if (x - cep / 2 < p.otvorD / 2 + 2) { if (!radky.zakryto) { var0.push(`Poloměry pod ${cz(R, 0)} mm by zasahovaly do středového otvoru – vynechány.`); radky.zakryto = 1; } continue; }
      radky.push({ R: r3(R), d, x, y: e, kotouc: r3(d - Rf), otvor: r3(d + Rf) });
      if (i > 2000) break;
    }
    if (!radky.length) return { dily: [], varovani: ['Žádný otvor pro čep se nevešel – upravte rozsah poloměrů.'] };
    const xmax = Math.max(...radky.map((q) => q.x)) + cep / 2 + 12;
    const kruh = G.konturaNaBody(G.kruhKontura([0, 0], rd));
    const ramenoP = G.konturaNaBody(G.zmKontura([[0, -B / 2], [xmax, -B / 2], [xmax, B / 2], [0, B / 2]], [0, Math.min(10, B / 2), Math.min(10, B / 2), 0]));
    let vnejsi = G.sjednot([kruh, ramenoP]);
    const otvory = [G.konturaNaBody(G.kruhKontura([0, 0], p.otvorD / 2))];
    const srouby = [];
    for (let k = 0; k < Math.max(1, Math.round(p.pocetSroubu)); k++) {
      const u = (p.uhelSroubu + k * 360 / Math.max(1, Math.round(p.pocetSroubu))) * RAD, c = [p.roztec / 2 * Math.cos(u), p.roztec / 2 * Math.sin(u)];
      srouby.push({ c, d: p.sroubD, zahl: p.zahlD });
      otvory.push(G.konturaNaBody(G.kruhKontura(c, p.sroubD / 2)));
    }
    for (const q of radky) otvory.push(G.konturaNaBody(G.kruhKontura([q.x, q.y], cep / 2)));
    const polys = G.rozdil(vnejsi, otvory);
    if (p.roztec / 2 + p.sroubD / 2 > rd - 3) var0.push('Šrouby jsou příliš blízko okraje kruhové části – zvětšete průměr základny nebo zmenšete rozteč.');
    if (p.roztec / 2 - p.sroubD / 2 < p.otvorD / 2 + 2) var0.push('Šrouby zasahují do středového otvoru.');
    if (p.otvorD < V.Df + 2) var0.push(`Středový otvor Ø${cz(p.otvorD, 1)} je skoro stejný jako fréza Ø${cz(V.Df, 1)}.`);
    const podZakladnou = radky.filter((q) => q.d < Dz / 2 + cep);
    if (podZakladnou.length) var0.push(`${podZakladnou.length} otvorů pro čep leží pod základnou frézky (poloměry do ${cz(podZakladnou[podZakladnou.length - 1].R, 0)} mm): čep nesmí přečnívat nad rameno – použijte kolík zarovnaný s horní plochou.`);
    // stupnice: rysky a čísla (gravírování)
    const znacky = [], texty = [];
    const kazdy = Math.max(1, Math.round(Math.max(krok, 50 / Math.ceil(50 / Math.max(krok, 1))) / krok));
    radky.forEach((q, j) => {
      const hlavni = Math.abs(q.R / 50 - Math.round(q.R / 50)) < 1e-6 || j === 0 || j === radky.length - 1;
      znacky.push({ b: [[q.x, B / 2], [q.x, B / 2 - (hlavni ? 5 : 2.5)]], v: 'gravura' });
      if (hlavni || (krok >= 10 && j % kazdy === 0 && krok >= 25)) texty.push({ x: q.x, y: B / 2 - 9.5, txt: cz(p.stupnice === 'otvor' ? q.otvor : q.kotouc, 1), h: 4, a: 'c', v: 'gravura' });
    });
    texty.push({ x: rd * 0.05, y: -rd * 0.62, txt: p.stupnice === 'otvor' ? 'R OTVORU' : 'R KOTOUČE', h: 4, a: 'c', v: 'gravura' });
    // přesné kontury: vnější obrys jako lomená čára, otvory jako kružnice
    const kruhy = [[0, 0, p.otvorD / 2]].concat(srouby.map((s) => [s.c[0], s.c[1], s.d / 2]), radky.map((q) => [q.x, q.y, cep / 2]));
    const vnejsiP = vnejsi.filter((q) => G.plocha(q) > 0);
    const kontury = vnejsiP.length === 1 && G.plochaOblasti(polys) > 0 ? [vnejsiP[0].map((q, j, a) => ({ t: 'u', a: q, b: a[(j + 1) % a.length] }))].concat(kruhy.map((c) => G.obratKonturu(G.kruhKontura([c[0], c[1]], c[2])))) : null;
    const deska = { polys, kontury, obal: G.obal(polys) };
    const pivot = radky[Math.min(radky.length - 1, Math.floor(radky.length / 2))];
    const d = {
      id: 'A', nazev: 'kruhové rameno', druh: 'pripravek', typ: 'rameno', deska, dorazy: [], znacky, texty, srouby, cepy: radky, V,
      tvar: null, sab: null, rez: G.rozdil([G.konturaNaBody(G.kruhKontura([pivot.x, pivot.y], pivot.d + Rf))], [G.konturaNaBody(G.kruhKontura([pivot.x, pivot.y], pivot.d - Rf))]),
      stred: [], nedos: [], odchylka: [], hd: { max: 0 }, hloubka: N.hloubka, varovani: [],
      draha: [G.konturaNaBody(G.kruhKontura([pivot.x, pivot.y], pivot.d), 0.05)], pivot, pohyb: 'otoc',
      popis: `čep Ø${cz(cep, 1)}; vzdálenost čep–osa frézy = R ${p.stupnice === 'otvor' ? '−' : '+'} Rf (${cz(Rf, 2)} mm)`, stitek: 'A',
    };
    return { dily: [d], varovani: var0 };
  }

  /** T-vodítko: drážka po ose y, levá hrana drážky x = 0, hrana desky y = 0 (příložník vně, y < 0) */
  function navrhVoditko(p, N, V) {
    const var0 = [], W = p.W, Lb = p.sirkaDesky, Bv = p.sirkaVoditka, Hw = p.sirkaHlavy, Vh = p.vyskaHlavy, Rf = V.Rf, Df = V.Df;
    const dily = [];
    const obd = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    if (p.typ === 'krouzek') {
      if (W < Df) var0.push(`Drážka ${cz(W, 1)} mm je užší než fréza Ø${cz(Df, 1)} – zvolte užší frézu.`);
      const e = V.Rv + 8;
      const tvar = G.tvarZPrimitiv([obdelnikPrim(0, -Hw - e, Math.max(W, Df), Lb + e, Math.min(Rf, Math.max(W, Df) / 2))]);
      const S = W + 2 * V.o;
      const venku = { x0: -Bv - V.o, x1: Math.max(W, Df) + V.o + Bv, y0: -Hw - e - V.o - 15, y1: Lb + e + V.o + 15 };
      const dorazy = [{ x0: venku.x0, x1: venku.x1, y0: -Hw, y1: 0, v: Vh, popis: 'příložník' }];
      const d = dilSablony('A', `štěrbinová šablona – drážka ${cz(W, 1)}`, tvar, 'vnitrni', N, V, { venku, dorazy, osy: false, popis: `štěrbina ${cz(S, 2)} mm = drážka ${cz(W, 1)} + 2 × ${cz(V.o, 2)}; příložník k hraně desky` });
      d.typ = 'voditko'; d.vypocet = { S: r3(S), o: r3(V.o) };
      d.znacky.push({ b: [[venku.x0, 0], [venku.x1, 0]], v: 'hrana', c: true });
      if (W > 2 * Df) var0.push('Drážka je širší než 2 × fréza: po objetí obou hran štěrbiny vyberte i střed.');
      dily.push(d);
      return { dily, varovani: var0, vypocet: d.vypocet };
    }
    // vodítko pro základnu frézky
    const R0 = p.odstup, polo = p.druh === 'polodrazka';
    const xf = W + R0 - Rf;                       // líc vodítka (druhý průchod s distanční lištou W − Df)
    const pruchody = W > Df + 1e-9 ? 2 : 1, dist = Math.max(0, W - Df);
    if (W < Df - 1e-9) var0.push(`${polo ? 'Polodrážka' : 'Drážka'} ${cz(W, 1)} mm je užší než fréza Ø${cz(Df, 1)} – vyjde široká ${cz(Df, 1)} mm.`);
    if (W > 2 * Df) var0.push(`Šířka ${cz(W, 1)} mm je víc než 2 × fréza: mezi 1. a 2. průchodem zůstane pruh – udělejte mezilehlé průchody s užší distanční lištou nebo použijte širší frézu.`);
    const xh0 = -Math.max(Df, W) - 25;           // příložník přesahuje na stranu frézky – první průchod do něj prořízne značku
    const vod = obd(xf, -Hw, xf + Bv, Lb + 20), hlava = obd(xh0, -Hw, xf + Bv, 0);
    const polys = G.sjednot([vod, hlava]);
    const deska = { polys, kontury: null, obal: G.obal(polys) };
    const rez1 = obd(Math.max(0, W - Df), polo ? -Hw - 5 : -Hw - 5, W, Lb + 5), rez2 = obd(0, -Hw - 5, Math.min(W, Df), Lb + 5);
    const rez = G.sjednot(pruchody > 1 ? [rez1, rez2] : [rez1]);
    const draha = [[[W - Rf, -Hw - 30], [W - Rf, Lb + 30]]];
    const znacky = [{ b: [[xh0, 0], [xf + Bv, 0]], v: 'hrana', c: true }, { b: [[0, -Hw], [0, -Hw + 8]], v: 'gravura' }, { b: [[W, -Hw], [W, -Hw + 8]], v: 'gravura' }];
    const texty = [{ x: xf + Bv / 2, y: Lb * 0.5, txt: `${polo ? 'POLODRÁŽKA' : 'DRÁŽKA'} ${cz(W, 1)} · F${cz(Df, 1)} · ${cz(R0 - Rf, 2)}`, h: 4, a: 'c', u: 90, v: 'gravura' }];
    const d = {
      id: 'A', nazev: 'T-vodítko', druh: 'pripravek', typ: 'voditko', deska, dorazy: [{ polys: [hlava], v: Vh, popis: 'příložník' }], znacky, texty, V,
      tvar: { polys: G.sjednot([obd(0, -Hw - 5, W, Lb + 5)]) }, sab: null, rez, stred: [], nedos: [], odchylka: [], hd: { max: 0 }, hloubka: N.hloubka, varovani: [],
      draha, pohyb: 'draha', popis: `líc vodítka ${cz(R0 - Rf, 2)} mm od bližší hrany drážky (${cz(xf, 2)} mm od vzdálenější)`, stitek: 'A',
      vypocet: { odstupLice: r3(R0 - Rf), xf: r3(xf), pruchody, distancni: r3(dist) },
    };
    dily.push(d);
    if (pruchody > 1) {
      const sp = G.sjednot([obd(xf - dist, 0, xf, Lb)]);
      dily.push({
        id: 'B', nazev: `distanční lišta ${cz(dist, 2)} mm`, druh: 'pripravek', typ: 'lista', deska: { polys: G.sjednot([obd(0, 0, dist, Math.min(Lb, 200))]), kontury: null, obal: G.obal([obd(0, 0, dist, Math.min(Lb, 200))]) },
        dorazy: [], znacky: [], texty: [], V, tvar: null, sab: null, rez: [], stred: [], nedos: [], odchylka: [], hd: { max: 0 }, varovani: [], draha: [], stitek: 'B',
        popis: 'vloží se mezi vodítko a základnu pro 2. průchod', ukazka: sp,
      });
      if (dist < 2) var0.push(`Distanční lišta by měla jen ${cz(dist, 2)} mm – místo ní použijte přesnou podložku (spároměr, dýhu) nebo frézu blíž šířce drážky.`);
    }
    if (polo) {
      const preh = R0 - (W - Rf);
      if (preh > R0 * 0.5) var0.push(`Při polodrážce přečnívá základna přes hranu desky o ${cz(preh, 0)} mm (víc než polovina) – přiložte k hraně podpůrný hranol stejné tloušťky, nebo použijte polodrážkovou frézu s ložiskem.`);
    }
    return { dily, varovani: var0, vypocet: d.vypocet };
  }

  /* ---------------- projekt ---------------- */
  function vychoziProjekt(rezim) {
    const p = {};
    for (const k of Object.keys(REZIMY)) p[k] = Object.assign({}, REZIMY[k].vychozi);
    return { rezim: rezim && REZIMY[rezim] ? rezim : 'obdelnik', p, nast: Object.assign({}, NASTAVENI), nazev: '', vybranyDil: 0 };
  }
  function normalizuj(rezim, p) {
    const R = REZIMY[rezim], o = Object.assign({}, R.vychozi, p || {});
    for (const f of R.pole) {
      if (!f.k || f.t === 'v' || f.t === 'b' || f.t === 's' || f.t === 'ta' || f.t === 'svg') { if (f.t === 'v' && !f.m.some((m) => m[0] === o[f.k])) o[f.k] = R.vychozi[f.k]; continue; }
      let x = cislo(o[f.k], R.vychozi[f.k]);
      if (f.min != null) x = Math.max(f.min, x); if (f.max != null) x = Math.min(f.max, x);
      o[f.k] = x;
    }
    return o;
  }
  function normNast(n) {
    const o = Object.assign({}, NASTAVENI, n || {});
    for (const k of Object.keys(NASTAVENI)) if (typeof NASTAVENI[k] === 'number') o[k] = cislo(o[k], NASTAVENI[k]);
    o.Df = omez(o.Df, 0.5, 60); o.Dk = omez(o.Dk, 1, 80); o.Dl = omez(o.Dl, 1, 80); o.tlSablony = omez(o.tlSablony, 2, 40); o.okrajDesky = omez(o.okrajDesky, 5, 400);
    o.hloubka = omez(o.hloubka, 0.1, 100); o.tris = omez(o.tris, 0.1, 50); o.stul = omez(o.stul, 60, 1000);
    return o;
  }
  /** hlavní výpočet: projekt S, zdroje {pismo (opentype Font)} → {dily, varovani, info, V} */
  function navrh(S, zdroje) {
    const N = normNast(S.nast), V = vedeni(N), rez = REZIMY[S.rezim] ? S.rezim : 'obdelnik', p = normalizuj(rez, S.p && S.p[rez]);
    let v;
    if (['obdelnik', 'kruh', 'oval', 'oblouk', 'text', 'svg'].includes(rez)) v = navrhTvar(rez, p, N, V, zdroje || {});
    else if (rez === 'uchyt') v = navrhUchyt(p, N, V);
    else if (rez === 'drez') v = navrhDrez(p, N, V);
    else if (rez === 'pant') v = navrhPant(p, N, V);
    else if (rez === 'magnety') v = navrhMagnety(p, N, V);
    else if (rez === 'motylek') v = navrhMotylek(p, N, V);
    else if (rez === 'rameno') v = navrhRameno(p, N, V);
    else v = navrhVoditko(p, N, V);
    const varovani = (v.varovani || []).slice();
    for (const d of v.dily) for (const x of d.varovani || []) varovani.push(x);
    // obecné kontroly vedení a hloubky
    if (!V.lozisko && V.Df > V.Dv - 2) varovani.unshift(`Fréza Ø${cz(V.Df, 1)} je skoro stejně velká jako kroužek Ø${cz(V.Dv, 1)} – ověřte, že projde otvorem kroužku (vnitřní Ø kroužku je menší než vnější).`);
    if (!V.lozisko && N.tlSablony < N.vyskaKrouzku + 0.5 && v.dily.some((d) => d.druh === 'sablona')) varovani.unshift(`Šablona ${cz(N.tlSablony, 1)} mm je tenčí než nákrček kroužku ${cz(N.vyskaKrouzku, 1)} mm – kroužek by drhl o obrobek. Použijte silnější desku nebo zkraťte nákrček.`);
    if (V.lozisko && v.dily.some((d) => d.druh === 'sablona')) varovani.push('Fréza s ložiskem: ložisko musí jet po hraně šablony – nastavte vyložení tak, aby ložisko leželo celou šířkou na šabloně (šablona ≥ 12 mm).');
    const hl = Math.max(0, ...v.dily.filter((d) => d.druh === 'sablona').map((d) => d.hloubka || 0), rez === 'rameno' || rez === 'tvoditko' ? N.hloubka : 0);
    const pruchodu = Math.max(1, Math.ceil(hl / N.tris - 1e-9));
    if (N.tris > V.Df) varovani.push(`Hloubka třísky ${cz(N.tris, 1)} mm na průchod je větší než průměr frézy – doporučeno nejvýš ½–1 × Ø frézy podle materiálu.`);
    const vedP = V.lozisko ? `ložisko Ø${cz(V.Dv, 2)}` : `kroužek Ø${cz(V.Dv, 2)}`;
    const info = `${vedP}, fréza Ø${cz(V.Df, 2)}: ofset o = (${cz(V.Dv, 2)} − ${cz(V.Df, 2)}) / 2 = ${cz(V.o, 3)} mm. ` +
      (hl ? `Hloubka ${cz(hl, 1)} mm na ${pruchodu} ${pruchodu === 1 ? 'průchod' : pruchodu < 5 ? 'průchody' : 'průchodů'} po ≤ ${cz(N.tris, 1)} mm.` : '');
    return { dily: v.dily, varovani, info, V, N, p, rezim: rez, par: v.par, vypocet: v.vypocet, pruchodu, ceka: v.ceka };
  }

  /* ---------------- kusovník ---------------- */
  function kusovnik(nv) {
    const N = nv.N, V = nv.V, out = [];
    const r = (polozka, ks, rozmer, pozn) => out.push({ polozka, ks, rozmer, pozn: pozn || '' });
    for (const d of nv.dily) {
      const o = d.deska.obal;
      const mat = d.druh === 'sablona' ? (d.kop === 'vnejsi' ? 'MDF / překližka (ostrůvek)' : 'MDF / překližka / plexi') : d.typ === 'rameno' ? 'překližka / plexi / PETG' : 'překližka / MDF';
      r(`${d.id} – ${d.nazev}`, 1, `${cz(o.x1 - o.x0, 0)} × ${cz(o.y1 - o.y0, 0)} × ${cz(N.tlSablony, 0)} mm`, mat);
      for (const q of d.dorazy || []) { const b = G.obal(q.polys); r(`  doraz ${q.popis || ''}`.trimEnd(), 1, `${cz(b.x1 - b.x0, 0)} × ${cz(b.y1 - b.y0, 0)} × ${cz(q.v || 15, 0)} mm`, 'přilepit a přišroubovat zespodu (zapuštěné vruty)'); }
      if (d.typ === 'rameno') {
        r('zápustné šrouby do základny frézky', d.srouby.length, `Ø${cz(d.srouby[0].d - 0.5, 1)} (typicky M4/M5 – podle frézky)`, 'délka = tl. ramene + závit v základně');
        r('ocelový kolík / čep', 1, `Ø${cz(d.cepy[0] ? 6 : 6, 0)} mm (otvor ${cz(nv.p.cep, 1)})`, 'kovový čep, ne plastový; hřebík bez hlavy jen pro jednorázové řezy');
      }
    }
    r(V.lozisko ? 'kopírovací fréza s ložiskem' : 'kopírovací kroužek', 1, V.lozisko ? `ložisko Ø${cz(V.Dv, 2)}, fréza Ø${cz(V.Df, 2)}` : `vnější Ø${cz(V.Dv, 2)}, nákrček ${cz(N.vyskaKrouzku, 1)} mm (typické – změřte svůj)`, V.lozisko ? '' : 'kroužek vystřeďte středicím trnem');
    if (!V.lozisko) r('drážkovací / spirálová fréza', 1, `Ø${cz(V.Df, 2)} mm`, 'spirálová s pozitivním sklonem lépe odvádí třísky z kapsy');
    r('upnutí', '2+', 'svěrky / oboustranná páska / vruty do odpadu', 'šablona i obrobek musí být pevně upnuté');
    return out;
  }

  /* ---------------- rozdělení dílů pro 3D tisk (puzzle spoj) ---------------- */
  /**
   * vrstvy [{polys, z0, z1, hlavni}] → kusy [{vrstvy, obal}] do tiskové plochy stul.
   * Dělí podél delší osy rybinovým (puzzle) spojem; vůle v spoji = vule (na stranu).
   */
  function rozdelProTisk(vrstvy, stul, vule) {
    const vse = vrstvy.flatMap((l) => l.polys), o = G.obal(vse), S = Math.max(60, stul || 220), v = Math.max(0, vule || 0);
    if (o.w <= S - 2 && o.h <= S - 2) return { kusy: [{ vrstvy, obal: o }], otoceno: false, spoju: 0, pres: [] };
    let L = vrstvy, otoc = false;
    if (o.h > o.w) { otoc = true; L = vrstvy.map((l) => Object.assign({}, l, { polys: l.polys.map((p) => p.map((q) => [q[1], -q[0]])) })); }
    const ob = G.obal(L.flatMap((l) => l.polys)), pres = [];
    if (ob.h > S - 2) pres.push(`Díl je i v kratším směru (${cz(ob.h, 0)} mm) větší než tisková plocha – tiskněte na větší tiskárně nebo frézujte z desky.`);
    const n = Math.max(2, Math.ceil((ob.w + 4) / (S - 16))), hlavni = L.find((l) => l.hlavni) || L[0];
    const outer = G.sjednot(hlavni.polys.filter((p) => G.plocha(p) > 0));
    const masky = [];
    for (let i = 1; i < n; i++) {
      const x0 = ob.x0 + ob.w * i / n;
      let best = null;
      for (let dx = -20; dx <= 20; dx += 4) {
        const xc = x0 + dx, a = 8, b = 13, h = 9;
        // průřez desky v místě řezu → kandidáti polohy čepu
        const pas = G.prunik(hlavni.polys, [[[xc - 2, ob.y0 - 1], [xc + h + 2, ob.y0 - 1], [xc + h + 2, ob.y1 + 1], [xc - 2, ob.y1 + 1]]]);
        if (!pas.length) continue;
        const pb = G.obal(pas), cand = [];
        for (let y = pb.y0 + b / 2 + 3; y <= pb.y1 - b / 2 - 3; y += 1.5) cand.push(y);
        const cep = (y) => [[xc, y - a / 2], [xc + h, y - b / 2], [xc + h, y + b / 2], [xc, y + a / 2]];
        const spatne = (y) => G.plochaOblasti(G.rozdil(G.ofset([cep(y)], 2.4), hlavni.polys)) + 0.001 * Math.abs(y - (pb.y0 + pb.y1) / 2);
        let vyb = [];
        const sk = cand.map((y) => ({ y, s: spatne(y) })).sort((p, q) => p.s - q.s);
        for (const c of sk) { if (vyb.length >= (pb.h > 90 ? 2 : 1)) break; if (vyb.every((q) => Math.abs(q.y - c.y) > b + 12)) vyb.push(c); }
        const skore = vyb.reduce((s, c) => s + c.s, 0) + (vyb.length ? 0 : 1e6) + Math.abs(dx) * 0.01;
        if (!best || skore < best.skore) best = { skore, xc, cepy: vyb.map((c) => cep(c.y)), cista: vyb.every((c) => c.s < 0.05) };
      }
      if (!best) best = { xc: x0, cepy: [], cista: false };
      const obd = [[ob.x0 - 50, ob.y0 - 50], [best.xc, ob.y0 - 50], [best.xc, ob.y1 + 50], [ob.x0 - 50, ob.y1 + 50]];
      masky.push({ m: G.sjednot([obd, ...best.cepy]), xc: best.xc, cista: best.cista && best.cepy.length > 0 });
    }
    const kusy = [];
    let zbytek = L.map((l) => l.polys);
    for (const mk of masky) {
      const mv = v > 0 ? G.ofset(mk.m, v) : mk.m;
      kusy.push(zbytek.map((p) => G.prunik(p, mk.m)));
      zbytek = zbytek.map((p) => G.rozdil(p, mv));
    }
    kusy.push(zbytek);
    if (masky.some((m) => !m.cista)) pres.push('Některý spoj prochází otvorem nebo úzkým místem – po slepení otvor převrtejte / zkontrolujte.');
    const out = kusy.map((ks) => {
      const vr = L.map((l, i) => Object.assign({}, l, { polys: ks[i] })).filter((l) => l.polys.length);
      return { vrstvy: vr, obal: G.obal(vr.flatMap((l) => l.polys)) };
    }).filter((k) => k.vrstvy.length);
    for (const k of out) if (k.obal.w > S + 0.5 || k.obal.h > S + 0.5) { pres.push('Některý kus je i po rozdělení větší než tisková plocha.'); break; }
    return { kusy: out, otoceno: otoc, spoju: masky.length, pres };
  }

  /* ---------------- tisk: kalibrace, papír, listy ---------------- */
  function korekceMeritka(namerenoX, namerenoY, nominal) {
    const Nn = nominal || 100, mx = cislo(namerenoX, Nn), my = cislo(namerenoY, Nn);
    const k = (m) => (m > Nn * 0.8 && m < Nn * 1.2 ? Nn / m : 1);
    return { kx: k(mx), ky: k(my), platne: mx > Nn * 0.8 && mx < Nn * 1.2 && my > Nn * 0.8 && my < Nn * 1.2 };
  }
  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };
  function rozmerPapiru(n) {
    if (n.papir === 'vlastni') return [Math.max(80, cislo(n.papirW, 210)), Math.max(80, cislo(n.papirH, 297))];
    return PAPIRY[n.papir] || PAPIRY.a4;
  }
  const PATA = 17, PRAVY_PAS = 13;
  /** rozvrh listů pro oblast (mm modelu) na papír pw × ph → {W, H, uw, uh, uwM, uhM, nx, ny, g, listy, kx, ky} */
  function rozvrhListu(obl, pw, ph, nast) {
    const n = Object.assign({}, NASTAVENI, nast || {}), K = korekceMeritka(n.kalibX, n.kalibY), ok = cislo(n.okrajTisku, 8);
    const sw = obl.x1 - obl.x0, sh = obl.y1 - obl.y0;
    const varianta = (W, H) => {
      const uw = W - 2 * ok - PRAVY_PAS, uh = H - 2 * ok - PATA, uwM = uw / K.kx, uhM = uh / K.ky;
      if (sw <= uwM + 1e-6 && sh <= uhM + 1e-6) return { W, H, uw, uh, uwM, uhM, nx: 1, ny: 1, g: 0, jeden: true };
      const g = Math.min(Math.max(cislo(n.prekryv, 15), 5), uwM * 0.45, uhM * 0.45);
      const nx = sw <= uwM + 1e-6 ? 1 : Math.ceil((sw - g) / (uwM - g) - 1e-9), ny = sh <= uhM + 1e-6 ? 1 : Math.ceil((sh - g) / (uhM - g) - 1e-9);
      return { W, H, uw, uh, uwM, uhM, nx, ny, g, jeden: false };
    };
    const a = varianta(pw, ph), b = varianta(ph, pw);
    const v = b.nx * b.ny < a.nx * a.ny ? b : a, listy = [];
    const cw = v.nx === 1 ? v.uwM : v.nx * (v.uwM - v.g) + v.g, chh = v.ny === 1 ? v.uhM : v.ny * (v.uhM - v.g) + v.g;
    const ox = obl.x0 - (cw - sw) / 2, top = obl.y1 + (chh - sh) / 2;
    for (let r = 0; r < v.ny; r++) for (let c = 0; c < v.nx; c++) {
      const x0 = ox + c * (v.uwM - v.g), y1 = top - r * (v.uhM - v.g);
      listy.push({ x0, x1: x0 + v.uwM, y0: y1 - v.uhM, y1, r, c });
    }
    return Object.assign(v, { listy, kx: K.kx, ky: K.ky, ok });
  }

  const API = {
    REZIMY, SKUPINY, NASTAVENI, PISMA, PAPIRY, PATA, PRAVY_PAS,
    vedeni, tvarObdelnik, motylekPrim, obdelnikPrim, tvarText, tvarSvg, kopirovani, varovaniRohu, dilSablony,
    navrh, vychoziProjekt, normalizuj, normNast, kusovnik, rozdelProTisk, korekceMeritka, rozmerPapiru, rozvrhListu, r2, r3, cz, cislo,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SF = API;
})(typeof window !== 'undefined' ? window : globalThis);
