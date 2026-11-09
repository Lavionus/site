/* Záložky do knih a ex libris – jádro bez DOM (jde v node i v prohlížeči).
   Jednotky: milimetry, osa y dolů (jako v SVG).
   Obsah:
     typografie, zalom, autoVelikost  – česká drobná typografie, vyvážené zalamování, velikost textu do plochy
     sazec(fonty)                     – měření a obrysy písma přes opentype.js (text se vždy kreslí jako křivky)
     rozmerZalozky/rozmerExlibris     – rozměry a meze
     rozvrh, rubPozice, naStranku     – rozvržení kusů na arch, ořezové značky, poloha rubu při oboustranném tisku
     genitiv                          – návrh 2. pádu jména pro „Z knih …“
     vzor, ramecek, ozdoba            – generativní vzory a rámečky jako SVG
     monogram, symbol                 – monogramy z iniciál a kreslené symboly
     kresliZalozku, kresliExlibris    – celý kus = seznam prvků {s: SVG, b: 0 papír | 1 inkoust | 2 akcent | 'obr'}
     svg(kus, volby)                  – složení SVG dokumentu
   Prvek se strukturou {s, b} se kreslí v pořadí – převod na 3D razítko (razitko3d.js) jde po prvcích:
   inkoust přidává, papír ubírá. */
(function (koren) {
  'use strict';
  const ZE = {};
  const D = typeof module !== 'undefined' && module.exports ? require('./vzory_data.js') : koren.ZE_DATA;
  ZE.DATA = D;
  const PI = Math.PI;
  const n = x => { const r = Math.round(x * 100) / 100; return (Object.is(r, -0) ? 0 : r).toString(); };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const omez = (x, a, b) => Math.min(b, Math.max(a, x));
  const cislo = (x, def) => { const v = typeof x === 'number' ? x : parseFloat(String(x == null ? '' : x).replace(',', '.')); return Number.isFinite(v) ? v : def; };
  ZE.n = n; ZE.esc = esc;

  /* seedovaný generátor (mulberry32) – stejný seed = stejný vzor */
  ZE.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ================================================================ písma */
  /* Jen písma s úplnou češtinou (ověřeno v testu). role: text | titul | psaci | kapitalky */
  ZE.PISMA = {
    fell:       { soubor: 'IMFellEnglish-Regular.ttf',   nazev: 'IM Fell English (starý tisk)' },
    libserif:   { soubor: 'LiberationSerif-Regular.ttf', nazev: 'Liberation Serif' },
    libserifi:  { soubor: 'LiberationSerif-Italic.ttf',  nazev: 'Liberation Serif kurzíva' },
    libserifb:  { soubor: 'LiberationSerif-Bold.ttf',    nazev: 'Liberation Serif tučná' },
    marcellus:  { soubor: 'Marcellus-Regular.ttf',       nazev: 'Marcellus (antikva)' },
    cinzel:     { soubor: 'CinzelDecorative-Bold.ttf',   nazev: 'Cinzel Decorative' },
    playfair:   { soubor: 'PlayfairDisplaySC-Black.ttf', nazev: 'Playfair Display SC' },
    abril:      { soubor: 'AbrilFatface-Regular.ttf',    nazev: 'Abril Fatface' },
    fondamento: { soubor: 'Fondamento-Regular.ttf',      nazev: 'Fondamento (kaligrafie)' },
    uncial:     { soubor: 'UncialAntiqua-Regular.ttf',   nazev: 'Uncial Antiqua' },
    grenze:     { soubor: 'GrenzeGotisch-Variable.ttf',  nazev: 'Grenze Gotisch (fraktura)' },
    eaglelake:  { soubor: 'EagleLake-Regular.ttf',       nazev: 'Eagle Lake' },
    pinyon:     { soubor: 'PinyonScript-Regular.ttf',    nazev: 'Pinyon Script (psací)' },
    greatvibes: { soubor: 'GreatVibes-Regular.ttf',      nazev: 'Great Vibes (psací)' },
    italianno:  { soubor: 'Italianno-Regular.ttf',       nazev: 'Italianno (psací)' },
    parisienne: { soubor: 'Parisienne-Regular.ttf',      nazev: 'Parisienne (psací)' },
    bebas:      { soubor: 'BebasNeue-Regular.ttf',       nazev: 'Bebas Neue (moderní)' },
    libsans:    { soubor: 'LiberationSans-Bold.ttf',     nazev: 'Liberation Sans tučná' },
    elite:      { soubor: 'SpecialElite-Regular.ttf',    nazev: 'Special Elite (psací stroj)' },
  };
  ZE.PSACI = new Set(['pinyon', 'greatvibes', 'italianno', 'parisienne']);

  /* Sazeč nad opentype.js: fonty = {id: opentype.Font}. Velikosti v mm (em). */
  ZE.sazec = function (fonty) {
    const font = id => fonty[id] || fonty.libserif || fonty[Object.keys(fonty)[0]];
    const jenMezery = s => String(s).replace(/ /g, ' ');
    function glyfy(text, id, vel, pr) {
      const f = font(id), k = vel / f.unitsPerEm, gl = f.stringToGlyphs(jenMezery(text));
      const out = []; let x = 0;
      for (let i = 0; i < gl.length; i++) {
        out.push({ g: gl[i], x });
        x += (gl[i].advanceWidth || 0) * k;
        if (i < gl.length - 1) x += f.getKerningValue(gl[i], gl[i + 1]) * k + (pr || 0);
      }
      return { f, out, sirka: x };
    }
    const metriky = {};
    function met(id) {
      if (metriky[id]) return metriky[id];
      const f = font(id), u = f.unitsPerEm, os2 = f.tables.os2 || {};
      let cap = os2.sCapHeight > 0 ? os2.sCapHeight / u : 0;
      if (!cap) { const b = f.charToGlyph('H').getBoundingBox(); cap = (b.y2 || f.ascender * 0.7) / u; }
      let xv = os2.sxHeight > 0 ? os2.sxHeight / u : 0;
      if (!xv) { const b = f.charToGlyph('x').getBoundingBox(); xv = (b.y2 || cap * 650) / u; }
      return (metriky[id] = { asc: f.ascender / u, desc: -f.descender / u, cap, x: xv });
    }
    /* příkazy cesty → d s volitelnou transformací bodu */
    function cmdD(cmds, tf) {
      let d = '';
      const p = (x, y) => { const q = tf ? tf(x, y) : [x, y]; return n(q[0]) + ' ' + n(q[1]); };
      for (const c of cmds) {
        if (c.type === 'M') d += 'M' + p(c.x, c.y);
        else if (c.type === 'L') d += 'L' + p(c.x, c.y);
        else if (c.type === 'Q') d += 'Q' + p(c.x1, c.y1) + ' ' + p(c.x, c.y);
        else if (c.type === 'C') d += 'C' + p(c.x1, c.y1) + ' ' + p(c.x2, c.y2) + ' ' + p(c.x, c.y);
        else if (c.type === 'Z') d += 'Z';
      }
      return d;
    }
    const S = {
      metriky: met,
      sirka: (text, id, vel, pr) => glyfy(text, id, vel, pr).sirka,
      /* obrys textu; y = účaří; zarovnani 'vlevo' | 'stred' | 'vpravo' */
      cesta(text, id, vel, x, y, o) {
        o = o || {};
        const g = glyfy(text, id, vel, o.prostrkani);
        const x0 = x - (o.zarovnani === 'stred' ? g.sirka / 2 : o.zarovnani === 'vpravo' ? g.sirka : 0);
        let d = '';
        for (const q of g.out) d += cmdD(q.g.getPath(x0 + q.x, y, vel).commands);
        return d;
      },
      /* text po kružnici: stred = úhel středu textu ve stupních (0 = nahoře, po směru hodin);
         dole: true = text čtený zleva doprava ve spodní části (písmena hlavou ke středu) */
      cestaPoKruhu(text, id, vel, cx, cy, r, o) {
        o = o || {};
        const g = glyfy(text, id, vel, o.prostrkani), m = met(id);
        const dole = !!o.dole;
        const rEf = dole ? r - m.cap * vel * 0.4 : r + m.cap * vel * 0.4;   // poloměr pro rozteč (střed výšky písmen)
        const uhel = g.sirka / rEf;                                       // radiány celého textu
        const st = (o.stred == null ? (dole ? 180 : 0) : o.stred) * PI / 180;
        let d = '';
        for (const q of g.out) {
          const adv = (q.g.advanceWidth || 0) * vel / g.f.unitsPerEm;
          const s = q.x + adv / 2;                                        // střed znaku podél textu
          const th = dole ? st + uhel / 2 - s / rEf : st - uhel / 2 + s / rEf;
          const rot = dole ? th - PI : th;
          const px = cx + r * Math.sin(th), py = cy - r * Math.cos(th);
          const c = Math.cos(rot), si = Math.sin(rot);
          const cmds = q.g.getPath(-adv / 2, 0, vel).commands;
          d += cmdD(cmds, (x, y) => [px + x * c - y * si, py + x * si + y * c]);
        }
        return { d, uhel: uhel * 180 / PI };
      },
    };
    return S;
  };

  /* ================================================================ typografie a zalamování */
  /* Česká drobná typografie: „uvozovky“, výpustka, pomlčka, nezlomitelná mezera za jednopísmennými předložkami a spojkami. */
  ZE.typografie = function (s) {
    s = String(s == null ? '' : s).replace(/\r/g, '').replace(/[ \t]+/g, ' ');
    s = s.replace(/\.\.\./g, '…');
    s = s.replace(/(^|[\s(\[ ])"/gm, '$1„').replace(/"/g, '“');
    s = s.replace(/(^|[\s(\[ ])'/gm, '$1‚').replace(/'/g, '‘');
    s = s.replace(/ - /g, ' – ').replace(/^- /gm, '– ').replace(/ -$/gm, ' –');
    const vazba = /(^|[\s „‚(])([aikosuvzAIKOSUVZ]) /gm;
    s = s.replace(vazba, '$1$2 ').replace(vazba, '$1$2 ');
    return s.split('\n').map(r => r.trim()).join('\n').trim();
  };

  /* Vyvážené zalomení odstavců (dynamické programování, cena = součet čtverců volného místa).
     mer(slovo) → šířka; mezera = šířka mezery. Vrací [{text, sirka}] a příznak přetečení. */
  ZE.zalom = function (text, maxW, mer, mezera, o) {
    o = o || {};
    const radky = []; let preteka = false;
    for (const odst of String(text).split('\n')) {
      const slova = odst.split(' ').filter(Boolean);
      if (!slova.length) { radky.push({ text: '', sirka: 0 }); continue; }
      const sir = slova.map(mer), N = slova.length;
      const best = new Array(N + 1).fill(Infinity), dalsi = new Array(N).fill(N);
      best[N] = 0;
      for (let i = N - 1; i >= 0; i--) {
        let w = 0;
        for (let j = i; j < N; j++) {
          w += sir[j] + (j > i ? mezera : 0);
          if (w > maxW && j > i) break;
          const posl = j === N - 1;
          let cena = w > maxW ? 1e9 : (posl && o.vyvazit === false ? 0 : (maxW - w) * (maxW - w));
          if (posl && j === i && N > 1) cena += maxW * maxW * 0.3;        // osamělé slovo na konci
          const c = cena + best[j + 1];
          if (c < best[i]) { best[i] = c; dalsi[i] = j + 1; }
        }
      }
      for (let i = 0; i < N; i = dalsi[i]) {
        const t = slova.slice(i, dalsi[i]);
        const w = t.reduce((a, s, k) => a + mer(s) + (k ? mezera : 0), 0);
        if (w > maxW + 1e-6) preteka = true;
        radky.push({ text: t.join(' '), sirka: w });
      }
    }
    return { radky, preteka };
  };

  /* Největší velikost písma (mm), při které se text vejde do plochy sirka × vyska.
     S = sazeč, id = písmo. Výška bloku = (řádků − 1)·rádkování + výška verzálky + část dotahu. */
  ZE.autoVelikost = function (text, S, id, o) {
    const min = o.min || 2, max = Math.max(o.max || 20, min), rad = o.radkovani || 1.3, pr = o.prostrkani || 0;
    const m = S.metriky(id);
    const cache = new Map();
    const mer1 = s => { if (!cache.has(s)) cache.set(s, S.sirka(s, id, 1, pr)); return cache.get(s); };
    const mez1 = S.sirka(' ', id, 1) + pr;
    const vyskaBloku = (pocet, v) => (pocet - 1) * v * rad + v * (m.cap + m.desc * 0.5);
    const zkus = v => {
      const z = ZE.zalom(text, o.sirka / v, mer1, mez1, { vyvazit: o.vyvazit });
      return { z, ok: !z.preteka && vyskaBloku(z.radky.length, v) <= o.vyska + 1e-9 && (!o.maxRadku || z.radky.length <= o.maxRadku) };
    };
    let lo = min, hi = max, nej = null;
    if (zkus(max).ok) lo = max;
    else {
      for (let k = 0; k < 24 && hi - lo > 0.02; k++) {
        const v = (lo + hi) / 2;
        if (zkus(v).ok) lo = v; else hi = v;
      }
    }
    nej = zkus(lo);
    const vel = Math.floor(lo * 100) / 100;
    const radky = nej.z.radky.map(r => ({ text: r.text, sirka: r.sirka * vel }));
    return { vel, radky, vyska: vyskaBloku(radky.length, vel), preteka: !nej.ok, radkovani: rad };
  };

  /* ================================================================ rozměry */
  ZE.ROZMERY_ZALOZKY = [
    { id: '50x150', w: 50, h: 150, nazev: '5 × 15 cm' },
    { id: '50x200', w: 50, h: 200, nazev: '5 × 20 cm' },
    { id: '40x180', w: 40, h: 180, nazev: '4 × 18 cm' },
    { id: '60x180', w: 60, h: 180, nazev: '6 × 18 cm' },
    { id: 'vlastni', nazev: 'vlastní' },
  ];
  ZE.ROZMERY_EXLIBRIS = [
    { id: '60x80', w: 60, h: 80, nazev: '6 × 8 cm' },
    { id: '50x70', w: 50, h: 70, nazev: '5 × 7 cm' },
    { id: '70x90', w: 70, h: 90, nazev: '7 × 9 cm' },
    { id: '80x110', w: 80, h: 110, nazev: '8 × 11 cm' },
    { id: '60x60', w: 60, h: 60, nazev: '6 × 6 cm (čtverec)' },
    { id: 'vlastni', nazev: 'vlastní' },
  ];
  function rozmer(seznam, id, w, h, meze) {
    const r = seznam.find(x => x.id === id && x.w);
    if (r) return { w: r.w, h: r.h };
    return { w: omez(cislo(w, meze[0]), meze[0], meze[1]), h: omez(cislo(h, meze[2]), meze[2], meze[3]) };
  }
  ZE.rozmerZalozky = z => rozmer(ZE.ROZMERY_ZALOZKY, z.rozmer, z.sirka, z.vyska, [25, 120, 60, 290]);
  ZE.rozmerExlibris = e => rozmer(ZE.ROZMERY_EXLIBRIS, e.rozmer, e.sirka, e.vyska, [30, 190, 30, 270]);

  /* ================================================================ rozvržení na arch */
  /* o: papir {w,h}, kus {w,h}, spadavka, mezera, okraj (nepotisknutelný okraj tiskárny), znacky (bool),
        odstup (mezera značky od spadávky), delka (max. délka značky), otaceni 'auto' | 'ne' | 'ano'.
     Vrací kusy v pořadí po řádcích {x, y, w, h, otoceni (0 | 90)} – x, y, w, h je ořezový rámeček na archu,
     řezy (x, y polohy) a značky [[x1, y1, x2, y2]]. Značky leží jen v okrajích, mimo kusy i spadávku. */
  ZE.rozvrh = function (o) {
    const P = o.papir || { w: 210, h: 297 }, K = o.kus;
    const b = omez(cislo(o.spadavka, 0), 0, 3);   // víc spadávky SVG kusu nemá (PRESAH)
    const mezera = Math.max(cislo(o.mezera, 0), 2 * b);
    const okraj = Math.max(0, cislo(o.okraj, 5));
    const zn = o.znacky !== false, odstup = cislo(o.odstup, 1.5), dMax = cislo(o.delka, 5), dMin = 2.5;
    const potreba = okraj + b + (zn ? odstup + dMin : 0);
    const zkus = (kw, kh, otoc) => {
      const sl = Math.floor((P.w - 2 * potreba + mezera) / (kw + mezera) + 1e-9);
      const ra = Math.floor((P.h - 2 * potreba + mezera) / (kh + mezera) + 1e-9);
      if (sl < 1 || ra < 1) return { pocet: 0 };
      const gw = sl * kw + (sl - 1) * mezera, gh = ra * kh + (ra - 1) * mezera;
      const x0 = (P.w - gw) / 2, y0 = (P.h - gh) / 2;
      const kusy = [];
      for (let r = 0; r < ra; r++) for (let s = 0; s < sl; s++)
        kusy.push({ x: x0 + s * (kw + mezera), y: y0 + r * (kh + mezera), w: kw, h: kh, otoceni: otoc ? 90 : 0, sloupec: s, radek: r });
      const uniq = a => [...new Set(a.map(v => Math.round(v * 1000) / 1000))].sort((p, q) => p - q);
      const rezyX = uniq(kusy.flatMap(k => [k.x, k.x + k.w])), rezyY = uniq(kusy.flatMap(k => [k.y, k.y + k.h]));
      const znacky = [];
      if (zn) {
        const zacX = b + odstup, zacY = b + odstup;
        const dx = Math.min(dMax, x0 - zacX - okraj), dy = Math.min(dMax, y0 - zacY - okraj);
        for (const x of rezyX) {
          znacky.push([x, y0 - zacY, x, y0 - zacY - dy]);
          znacky.push([x, y0 + gh + zacY, x, y0 + gh + zacY + dy]);
        }
        for (const y of rezyY) {
          znacky.push([x0 - zacX, y, x0 - zacX - dx, y]);
          znacky.push([x0 + gw + zacX, y, x0 + gw + zacX + dx, y]);
        }
      }
      return { pocet: kusy.length, sloupcu: sl, radku: ra, kusy, rezyX, rezyY, znacky, otoceny: otoc, mezera, spadavka: b, okraj, papir: P, kus: K };
    };
    const rovne = zkus(K.w, K.h, false);
    if (o.otaceni === 'ne' || K.w === K.h) return rovne;
    const otocene = zkus(K.h, K.w, true);
    if (o.otaceni === 'ano') return otocene;
    return otocene.pocet > rovne.pocet ? otocene : rovne;
  };

  /* Poloha bodu návrhu (u, v) kusu na archu. Otočení 90 = po směru hodin (horní hrana kusu vpravo). */
  /* DPI rastru omezené tak, aby plátno nepřekročilo limit Safari/iPadu (16,7 Mpx, strana 16 384 px).
     Při překročení vykreslí iPad prázdné plátno bez chyby. */
  ZE.dpiProPlatno = function (wmm, hmm, dpi, maxPx, maxStrana) {
    maxPx = maxPx || 16e6; maxStrana = maxStrana || 16000;
    const px = d => [wmm / 25.4 * d, hmm / 25.4 * d];
    let d = dpi;
    const [a, b] = px(d);
    if (a * b > maxPx) d *= Math.sqrt(maxPx / (a * b));
    const [c, e] = px(d);
    if (Math.max(c, e) > maxStrana) d *= maxStrana / Math.max(c, e);
    return Math.floor(d);
  };

  ZE.naStranku = function (k, kus, u, v) {
    if (k.otoceni === 90) return [k.x + (kus.h - v), k.y + u];
    if (k.otoceni === -90) return [k.x + v, k.y + (kus.w - u)];
    return [k.x + u, k.y + v];
  };
  /* Rub při oboustranném tisku s otáčením přes dlouhou hranu (svislou u archu na výšku):
     kus se zrcadlí podle svislé osy archu a otočený kus se otáčí opačně, aby se záložka
     po převrácení kolem své podélné osy četla rovně. posun = korekce tiskárny (mm). */
  ZE.rubPozice = function (k, papir, posun) {
    const p = posun || {};
    return { x: papir.w - k.x - k.w + cislo(p.x, 0), y: k.y + cislo(p.y, 0), w: k.w, h: k.h, otoceni: k.otoceni ? -k.otoceni : 0 };
  };

  /* ================================================================ 2. pád jména */
  /* Koncovky jsou v vzory_data.js (data, ne texty rozhraní). */
  function genSlovo(s, zena) {
    const l = s.toLowerCase(), vel = s.length > 1 && s === s.toUpperCase() ? 2 : (s[0] === s[0].toUpperCase() ? 1 : 0);
    let r = null;
    const zkus = tab => { for (const [k, z] of tab) if (l.endsWith(k) && l.length >= k.length) { r = l.slice(0, l.length - k.length) + z; return true; } return false; };
    const naA = () => l.endsWith('a') && (r = l.slice(0, -1) + (D.MEKKE.includes(l[l.length - 2]) ? 'i' : 'y'));
    if (zena) zkus(D.ZENA) || naA() || (r = l);
    else {
      zkus(D.MUZ) ||
        (/[^aeiouyáéíóúůýě]el$/.test(l) && !D.VYJIMKY_EL.includes(l) && (r = l.slice(0, -2) + 'la')) ||
        naA() ||
        (D.MEKKE.includes(l[l.length - 1]) ? (r = l + 'e') : /[aáeéěiíoóuúůyý]$/.test(l) ? (r = l) : (r = l + 'a'));
    }
    if (vel === 2) return r.toUpperCase();
    if (vel === 1) return r[0].toUpperCase() + r.slice(1);
    return r;
  }
  /* „Jan Novák“ → „Jana Nováka“, „Marie Nováková“ → „Marie Novákové“, „Jan a Marie Novákovi“ → „Jana a Marie Novákových“.
     Jen návrh – uživatel ho může přepsat. */
  ZE.genitiv = function (jmeno) {
    const slova = String(jmeno || '').trim().split(/\s+/).filter(Boolean);
    if (!slova.length) return '';
    const posl = slova[slova.length - 1].toLowerCase();
    const mnozne = /ovi$|ových$/.test(posl) && slova.length > 1;
    const zenaPrijmeni = D.ZENSKE_PRIJMENI.some(k => posl.endsWith(k));
    const zenaJmeno = slova.length === 1 && /(a|ie|e)$/.test(posl);
    return slova.map((s, i) => {
      const l = s.toLowerCase();
      if (s.endsWith('.') || D.NESKLONNE.includes(l) || !/\p{L}/u.test(s)) return s;
      const zena = mnozne && i < slova.length - 1 ? /(a|ie|e)$/.test(l) : (zenaPrijmeni || zenaJmeno);
      return genSlovo(s, zena);
    }).join(' ');
  };
  ZE.inicialy = jmeno => String(jmeno || '').trim().split(/[\s-]+/).filter(Boolean).map(s => s[0].toUpperCase()).slice(0, 3).join('');

  /* ================================================================ kreslicí pomůcky */
  const tah = (c, w, extra) => `fill="none" stroke="${c}" stroke-width="${n(w)}"${extra ? ' ' + extra : ''}`;
  const kruh = (cx, cy, r, attr) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${attr}/>`;
  const obdelnik = (x, y, w, h, attr) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${attr}/>`;
  const cesta = (d, attr) => `<path d="${d}" ${attr}/>`;
  /* hladká cesta přes body (Catmull-Rom → Bézier) */
  function hladka(b) {
    if (b.length < 2) return '';
    let d = `M${n(b[0][0])} ${n(b[0][1])}`;
    for (let i = 0; i < b.length - 1; i++) {
      const p0 = b[i - 1] || b[i], p1 = b[i], p2 = b[i + 1], p3 = b[i + 2] || p2;
      d += `C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)} ${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)} ${n(p2[0])} ${n(p2[1])}`;
    }
    return d;
  }
  const lomena = b => b.map((p, i) => (i ? 'L' : 'M') + n(p[0]) + ' ' + n(p[1])).join('');
  ZE.hladka = hladka;

  /* ================================================================ vzory */
  ZE.VZORY = {
    artdeco: 'Art deco – vějíře', kelt: 'Keltský pletenec', tecky: 'Tečkový rastr', botanika: 'Botanika z čar',
    vlny: 'Vlny seigaiha', paprsky: 'Art deco – paprsky',
  };
  /* Vzor do obdélníku (x, y, w, h). pal = {papir, inkoust, akcent}. hustota 1–5. Vrací pole prvků {s, b}. */
  ZE.vzor = function (druh, x, y, w, h, pal, o) {
    o = o || {};
    const hust = omez(Math.round(cislo(o.hustota, 3)), 1, 5), R = ZE.rng(cislo(o.seed, 1) * 7919 + 13);
    const c1 = pal.inkoust, c2 = pal.akcent, p = pal.papir;
    const out = [];
    const push = (s, b) => out.push({ s, b });
    if (druh === 'artdeco') {
      const k = [2, 2.5, 3, 4, 5][hust - 1], D = w / k, r = D / 2, dy = r * 0.62;
      const rad = Math.ceil((h + 2 * r) / dy) + 2;
      for (let j = 0; j < rad; j++) {
        const cy = y - r + j * dy, pos = (j % 2) * r;
        for (let cx = x - D + pos; cx < x + w + D; cx += D) {
          const pul = rr => `M${n(cx - rr)} ${n(cy)}A${n(rr)} ${n(rr)} 0 0 1 ${n(cx + rr)} ${n(cy)}`;
          push(cesta(pul(r) + 'Z', `fill="${p}" stroke="${c1}" stroke-width="${n(r * 0.05)}"`), 1);
          push(cesta(pul(r * 0.76) + pul(r * 0.55), tah(c2, r * 0.04)), 2);
          let par = '';
          for (let a = 1; a < 8; a++) {
            const t = PI - a * PI / 8;
            par += `M${n(cx + Math.cos(t) * r * 0.32)} ${n(cy - Math.sin(t) * r * 0.32)}L${n(cx + Math.cos(t) * r * 0.55)} ${n(cy - Math.sin(t) * r * 0.55)}`;
          }
          push(cesta(par, tah(c1, r * 0.03)), 1);
          push(cesta(pul(r * 0.3) + 'Z', `fill="${c2}"`), 2);
        }
      }
    } else if (druh === 'paprsky') {
      // sluneční paprsky ze středu dole + stupňovité oblouky
      const cx = x + w / 2, cy = y + h + w * 0.1, pocet = [18, 24, 32, 40, 48][hust - 1], Rm = Math.hypot(w, h) * 1.1;
      for (let i = 0; i < pocet; i++) {
        if (i % 2) continue;
        const a0 = PI + i * PI / pocet, a1 = PI + (i + 1) * PI / pocet;
        push(cesta(`M${n(cx)} ${n(cy)}L${n(cx + Math.cos(a0) * Rm)} ${n(cy + Math.sin(a0) * Rm)}L${n(cx + Math.cos(a1) * Rm)} ${n(cy + Math.sin(a1) * Rm)}Z`, `fill="${c1}" fill-opacity="0.13"`), 1);
      }
      const krok = w * [0.34, 0.28, 0.22, 0.17, 0.13][hust - 1];
      for (let rr = krok, i = 0; rr < Rm; rr += krok, i++) {
        push(cesta(`M${n(cx - rr)} ${n(cy)}A${n(rr)} ${n(rr)} 0 0 1 ${n(cx + rr)} ${n(cy)}`, tah(i % 3 === 2 ? c2 : c1, i % 3 === 2 ? 0.55 : 0.22)), i % 3 === 2 ? 2 : 1);
      }
      for (let i = 0; i <= pocet; i += 2) {
        const a = PI + i * PI / pocet;
        push(cesta(`M${n(cx + Math.cos(a) * krok)} ${n(cy + Math.sin(a) * krok)}L${n(cx + Math.cos(a) * Rm)} ${n(cy + Math.sin(a) * Rm)}`, tah(c1, 0.18)), 1);
      }
    } else if (druh === 'kelt') {
      const sirPasu = w * [0.5, 0.6, 0.68, 0.76, 0.84][hust - 1], cx = x + w / 2;
      const rw = sirPasu * 0.2, A = (sirPasu - rw) / 2, P = sirPasu * 1.5, okr = Math.max(0.25, rw * 0.11);
      const fi = [0, 2 * PI / 3, 4 * PI / 3];
      const X = (i, yy) => cx + A * Math.sin(2 * PI * (yy - y) / P + fi[i]);
      const y0 = y - P, y1 = y + h + P, krok = 0.5;
      const usek = (i, a, b2) => { const b = []; for (let yy = a; yy <= b2 + 1e-9; yy += krok) b.push([X(i, yy), yy]); return lomena(b); };
      const stuha = (d) => {
        push(cesta(d, tah(c1, rw, 'stroke-linecap="butt"')), 1);
        push(cesta(d, tah(p, rw - 2 * okr, 'stroke-linecap="butt"')), 0);
        push(cesta(d, tah(c2, okr * 0.8, 'stroke-linecap="butt"')), 2);
      };
      // okraje pásu
      for (const sx of [-1, 1]) {
        const xx = cx + sx * (sirPasu / 2 + rw * 0.45);
        push(cesta(`M${n(xx)} ${n(y - 5)}V${n(y + h + 5)}`, tah(c1, okr * 1.4)), 1);
        push(cesta(`M${n(xx + sx * okr * 3)} ${n(y - 5)}V${n(y + h + 5)}`, tah(c1, okr * 0.6)), 1);
      }
      for (let i = 0; i < 3; i++) stuha(usek(i, y0, y1));
      // křížení a střídání přes/pod
      const kr = [];
      for (let yy = y0; yy < y1; yy += 0.05) {
        for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
          const a = X(i, yy) - X(j, yy), b2 = X(i, yy + 0.05) - X(j, yy + 0.05);
          if (a * b2 < 0) kr.push({ y: yy, i, j });
        }
      }
      const pristi = [null, null, null];
      for (const c of kr) {
        let nahore;
        if (pristi[c.i] != null) nahore = pristi[c.i] ? c.i : c.j;
        else if (pristi[c.j] != null) nahore = pristi[c.j] ? c.j : c.i;
        else nahore = c.i;
        const dole = nahore === c.i ? c.j : c.i;
        pristi[nahore] = false; pristi[dole] = true;
        let d = 0;
        while (d < P && Math.abs(X(c.i, c.y + d) - X(c.j, c.y + d)) < rw * 1.25 || Math.abs(X(c.i, c.y - d) - X(c.j, c.y - d)) < rw * 1.25) d += krok;
        stuha(usek(nahore, c.y - d, c.y + d));
      }
    } else if (druh === 'tecky') {
      const s = w / [6, 8, 10, 13, 16][hust - 1], f = R() * 2 * PI, cyk = 1 + R() * 1.5;
      for (let j = 0, yy = y - s; yy < y + h + s; j++, yy += s * 0.866) {
        for (let xx = x - s + (j % 2) * s / 2; xx < x + w + s; xx += s) {
          const t = (yy - y) / h;
          const v = 0.5 + 0.5 * Math.sin(2 * PI * (t * cyk + 0.18 * Math.sin(2 * PI * (xx - x) / w + f)) + f);
          const r = s * 0.5 * (0.12 + 0.88 * v);
          if (r < 0.15) continue;
          const druhy = v > 0.82 && ((j + Math.round(xx / s)) % 3 === 0);
          push(kruh(xx, yy, r * (druhy ? 0.8 : 1), `fill="${druhy ? c2 : c1}"`), druhy ? 2 : 1);
        }
      }
    } else if (druh === 'vlny') {
      const k = [2, 3, 4, 5, 6][hust - 1], Rr = w / k / 1.0, dy = Rr / 2;
      for (let j = 0, cy = y - Rr; cy < y + h + Rr * 1.2; j++, cy += dy) {
        for (let cx = x - Rr + (j % 2) * Rr; cx < x + w + Rr * 2; cx += 2 * Rr) {
          push(kruh(cx, cy, Rr, `fill="${p}" stroke="${c1}" stroke-width="${n(Rr * 0.05)}"`), 1);
          [0.78, 0.58, 0.38].forEach((q, i) => push(kruh(cx, cy, Rr * q, tah(i === 1 ? c2 : c1, Rr * 0.045)), i === 1 ? 2 : 1));
          push(kruh(cx, cy, Rr * 0.17, `fill="${c2}"`), 2);
        }
      }
    } else if (druh === 'botanika') {
      const stonku = w > 62 ? 2 : 1, sirS = 0.32;
      for (let st = 0; st < stonku; st++) {
        const cx = x + w * (stonku === 1 ? 0.5 : (st ? 0.7 : 0.3)), amp = w * (0.08 + R() * 0.06) / stonku;
        const fz = R() * 6, per = 14 + 6 * R(), stonek = yy => cx + amp * Math.sin(yy / per + fz);
        const body = [];
        for (let yy = y + h + 6; yy > y - 8; yy -= 3) body.push([stonek(yy), yy]);
        push(cesta(hladka(body), tah(c1, sirS, 'stroke-linecap="round"')), 1);
        const L = w * [0.22, 0.25, 0.28, 0.3, 0.32][hust - 1] / stonku * (stonku === 1 ? 1 : 1.4);
        const roztec = [12, 10, 8, 7, 6][hust - 1];
        let strana = R() < 0.5 ? -1 : 1, k = 0;
        for (let yy = y + h + 2; yy > y - 4; yy -= roztec * (0.85 + R() * 0.3), strana = -strana, k++) {
          const sx = stonek(yy);
          if (k % 5 === 3) {   // úponek se spirálou
            // úponek: oblouk ze stonku zakončený spirálou (body jdou od stonku ke středu spirály)
            const ox = sx + strana * L * 0.55, oy = yy - L * 0.45, r0 = L * 0.2;
            const sp = [[sx, yy], [sx + strana * L * 0.2, yy - L * 0.12], [sx + strana * L * 0.42, yy - L * 0.2]];
            let a = PI / 2, rr = r0;
            for (let q = 0; q < 22; q++, a -= strana * 0.42, rr *= 0.9) sp.push([ox + Math.cos(a) * rr, oy + Math.sin(a) * rr]);
            push(cesta(hladka(sp), tah(c1, 0.22, 'stroke-linecap="round"')), 1);
            continue;
          }
          const uhel = (-90 + strana * (38 + R() * 22)) * PI / 180, Ll = L * (0.8 + R() * 0.35);
          const tf = `translate(${n(sx)} ${n(yy)}) rotate(${n(uhel * 180 / PI)})`;
          const ztl = 0.3;
          const list = `M0 0C${n(Ll * 0.3)} ${n(-Ll * ztl)} ${n(Ll * 0.72)} ${n(-Ll * ztl * 0.8)} ${n(Ll)} 0C${n(Ll * 0.72)} ${n(Ll * ztl * 0.8)} ${n(Ll * 0.3)} ${n(Ll * ztl)} 0 0Z`;
          let zilky = `M0 0L${n(Ll * 0.88)} 0`;
          for (let z = 1; z <= 3; z++) { const zx = Ll * z * 0.2; zilky += `M${n(zx)} 0L${n(zx + Ll * 0.13)} ${n(-Ll * ztl * 0.5)}M${n(zx)} 0L${n(zx + Ll * 0.13)} ${n(Ll * ztl * 0.5)}`; }
          push(`<g transform="${tf}">${cesta(list, `fill="${p}" stroke="${c1}" stroke-width="0.28"`)}${cesta(zilky, tah(c1, 0.16, 'stroke-linecap="round"'))}</g>`, 1);
          if (R() < 0.35) {   // bobule
            const bx = sx - strana * L * 0.18, by = yy - L * 0.25;
            push(cesta(`M${n(sx)} ${n(yy)}Q${n(sx - strana * L * 0.05)} ${n(by + 1)} ${n(bx)} ${n(by)}`, tah(c1, 0.18)), 1);
            for (let q = 0; q < 3; q++) push(kruh(bx + (q - 1) * 1.1, by - (q === 1 ? 1.1 : 0), 0.75, `fill="${c2}"`), 2);
          }
        }
      }
    }
    return out;
  };

  /* ================================================================ rámečky */
  ZE.RAMECKY = { zadny: 'bez rámečku', linka: 'linka', dvojita: 'dvojitá linka', rohy: 'vykrojené rohy', perlicky: 'perličky', secese: 'secese', artdeco: 'art deco', kartus: 'kartuš (štítek)' };
  ZE.ramecek = function (styl, x, y, w, h, pal, o) {
    o = o || {};
    const c1 = pal.inkoust, c2 = pal.akcent, t = cislo(o.sila, 0.35), out = [];
    const push = (s, b) => out.push({ s, b: b || 1 });
    if (!styl || styl === 'zadny') return out;
    if (styl === 'linka') push(obdelnik(x, y, w, h, tah(c1, t)));
    else if (styl === 'dvojita') {
      push(obdelnik(x, y, w, h, tah(c1, t * 2.2)));
      push(obdelnik(x + t * 4, y + t * 4, w - t * 8, h - t * 8, tah(c1, t * 0.6)));
    } else if (styl === 'rohy') {
      push(obdelnik(x, y, w, h, tah(c1, t * 0.6)));
      const d = t * 4.5, ix = x + d, iy = y + d, iw = w - 2 * d, ih = h - 2 * d, r = Math.min(iw, ih) * 0.09;
      push(cesta(`M${n(ix + r)} ${n(iy)}H${n(ix + iw - r)}A${n(r)} ${n(r)} 0 0 0 ${n(ix + iw)} ${n(iy + r)}V${n(iy + ih - r)}A${n(r)} ${n(r)} 0 0 0 ${n(ix + iw - r)} ${n(iy + ih)}H${n(ix + r)}A${n(r)} ${n(r)} 0 0 0 ${n(ix)} ${n(iy + ih - r)}V${n(iy + r)}A${n(r)} ${n(r)} 0 0 0 ${n(ix + r)} ${n(iy)}Z`, tah(c1, t * 1.6)));
      const s = r * 0.45;
      for (const [cx, cy] of [[ix, iy], [ix + iw, iy], [ix + iw, iy + ih], [ix, iy + ih]])
        push(cesta(`M${n(cx)} ${n(cy - s)}L${n(cx + s)} ${n(cy)}L${n(cx)} ${n(cy + s)}L${n(cx - s)} ${n(cy)}Z`, `fill="${c2}"`), 2);
    } else if (styl === 'perlicky') {
      const r = Math.max(0.35, t * 1.2), krok = r * 3.4;
      const nx = Math.max(2, Math.round(w / krok)), ny = Math.max(2, Math.round(h / krok));
      let d = '';
      const tecka = (cx, cy) => { d += `M${n(cx + r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx - r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx + r)} ${n(cy)}Z`; };
      for (let i = 0; i <= nx; i++) { tecka(x + w * i / nx, y); tecka(x + w * i / nx, y + h); }
      for (let i = 1; i < ny; i++) { tecka(x, y + h * i / ny); tecka(x + w, y + h * i / ny); }
      push(cesta(d, `fill="${c1}"`));
      push(obdelnik(x + r * 3, y + r * 3, w - r * 6, h - r * 6, tah(c2, t * 0.6)), 2);
    } else if (styl === 'secese') {
      const r = Math.min(w, h) * 0.12;
      push(obdelnik(x, y, w, h, tah(c1, t * 1.4) + ` rx="${n(r)}"`));
      push(obdelnik(x + t * 4, y + t * 4, w - t * 8, h - t * 8, tah(c1, t * 0.5) + ` rx="${n(r * 0.8)}"`));
      // spirálky v rozích
      const sp = (cx, cy, sx, sy) => {
        const b = []; let a = 0, rr = r * 0.62;
        for (let q = 0; q < 30; q++, a += 0.36, rr *= 0.93) b.push([cx + sx * Math.cos(a) * rr, cy + sy * Math.sin(a) * rr]);
        return hladka(b);
      };
      const k = r * 0.95;
      push(cesta(sp(x + k, y + k, -1, -1) + sp(x + w - k, y + k, 1, -1) + sp(x + w - k, y + h - k, 1, 1) + sp(x + k, y + h - k, -1, 1), tah(c2, t * 0.9, 'stroke-linecap="round"')), 2);
    } else if (styl === 'artdeco') {
      const s = Math.min(w, h) * 0.05;
      const stup = (dx) => {
        const X0 = x + dx, Y0 = y + dx, X1 = x + w - dx, Y1 = y + h - dx;
        return `M${n(X0 + 2 * s)} ${n(Y0)}H${n(X1 - 2 * s)}V${n(Y0 + s)}H${n(X1 - s)}V${n(Y0 + 2 * s)}H${n(X1)}V${n(Y1 - 2 * s)}H${n(X1 - s)}V${n(Y1 - s)}H${n(X1 - 2 * s)}V${n(Y1)}H${n(X0 + 2 * s)}V${n(Y1 - s)}H${n(X0 + s)}V${n(Y1 - 2 * s)}H${n(X0)}V${n(Y0 + 2 * s)}H${n(X0 + s)}V${n(Y0 + s)}H${n(X0 + 2 * s)}Z`;
      };
      push(cesta(stup(0), tah(c1, t * 1.6)));
      push(cesta(stup(t * 4), tah(c2, t * 0.6)), 2);
      push(obdelnik(x + t * 4 + s * 2.4, y + t * 4 + s * 2.4, w - 2 * (t * 4 + s * 2.4), h - 2 * (t * 4 + s * 2.4), tah(c1, t * 0.4)));
    } else if (styl === 'kartus') {
      const r = Math.min(w, h) * 0.11;
      const vykroj = (X, Y, W, H, rr) => `M${n(X + rr)} ${n(Y)}H${n(X + W - rr)}A${n(rr)} ${n(rr)} 0 0 0 ${n(X + W)} ${n(Y + rr)}V${n(Y + H - rr)}A${n(rr)} ${n(rr)} 0 0 0 ${n(X + W - rr)} ${n(Y + H)}H${n(X + rr)}A${n(rr)} ${n(rr)} 0 0 0 ${n(X)} ${n(Y + H - rr)}V${n(Y + rr)}A${n(rr)} ${n(rr)} 0 0 0 ${n(X + rr)} ${n(Y)}Z`;
      push(cesta(vykroj(x, y, w, h, r), tah(c1, t * 2.2)));
      const d = t * 3.6;
      push(cesta(vykroj(x + d, y + d, w - 2 * d, h - 2 * d, r - d * 0.4), tah(c1, t * 0.6)));
      for (const [cx, cy] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]) push(kruh(cx, cy, r * 0.2, `fill="${c2}"`), 2);
    }
    return out;
  };

  /* ================================================================ ozdoby (fleurony) */
  ZE.OZDOBY = { zadna: 'žádná', linka: 'linka s kosočtvercem', listky: 'lístky', tecky: 'tři tečky', vlnka: 'vlnka', hvezda: 'hvězdička' };
  ZE.ozdoba = function (druh, cx, cy, sirka, pal) {
    const c1 = pal.inkoust, c2 = pal.akcent, s = sirka, out = [];
    const push = (x, b) => out.push({ s: x, b: b || 1 });
    if (!druh || druh === 'zadna') return out;
    if (druh === 'linka') {
      const k = s * 0.07;
      push(cesta(`M${n(cx - s / 2)} ${n(cy)}H${n(cx - k * 1.8)}M${n(cx + k * 1.8)} ${n(cy)}H${n(cx + s / 2)}`, tah(c1, Math.max(0.18, s * 0.012))));
      push(cesta(`M${n(cx)} ${n(cy - k)}L${n(cx + k)} ${n(cy)}L${n(cx)} ${n(cy + k)}L${n(cx - k)} ${n(cy)}Z`, `fill="${c2}"`), 2);
    } else if (druh === 'listky') {
      const L = s * 0.36, z = L * 0.32;
      const list = sx => `M${n(cx + sx * L * 0.12)} ${n(cy)}C${n(cx + sx * L * 0.4)} ${n(cy - z)} ${n(cx + sx * L * 0.8)} ${n(cy - z * 0.9)} ${n(cx + sx * L)} ${n(cy)}C${n(cx + sx * L * 0.8)} ${n(cy + z * 0.9)} ${n(cx + sx * L * 0.4)} ${n(cy + z)} ${n(cx + sx * L * 0.12)} ${n(cy)}Z`;
      push(cesta(list(-1) + list(1), `fill="${c1}"`));
      push(cesta(`M${n(cx - L * 1.3)} ${n(cy)}H${n(cx - L * 1.05)}M${n(cx + L * 1.05)} ${n(cy)}H${n(cx + L * 1.3)}`, tah(c1, s * 0.012, 'stroke-linecap="round"')));
      push(kruh(cx, cy, L * 0.1, `fill="${c2}"`), 2);
    } else if (druh === 'tecky') {
      const r = s * 0.035;
      push(kruh(cx - s * 0.13, cy, r, `fill="${c1}"`) + kruh(cx + s * 0.13, cy, r, `fill="${c1}"`));
      push(kruh(cx, cy, r * 1.25, `fill="${c2}"`), 2);
    } else if (druh === 'vlnka') {
      const b = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40; b.push([cx - s / 2 + s * t, cy + Math.sin(t * 4 * PI) * s * 0.045 * Math.sin(t * PI)]); }
      push(cesta(hladka(b), tah(c1, Math.max(0.2, s * 0.014), 'stroke-linecap="round"')));
    } else if (druh === 'hvezda') {
      const r1 = s * 0.08, r2 = r1 * 0.38; let d = '';
      for (let i = 0; i < 16; i++) { const a = i * PI / 8 - PI / 2, r = i % 2 ? r2 : (i % 4 ? r1 * 0.7 : r1); d += (i ? 'L' : 'M') + n(cx + Math.cos(a) * r) + ' ' + n(cy + Math.sin(a) * r); }
      push(cesta(d + 'Z', `fill="${c2}"`), 2);
      push(cesta(`M${n(cx - s / 2)} ${n(cy)}H${n(cx - r1 * 1.6)}M${n(cx + r1 * 1.6)} ${n(cy)}H${n(cx + s / 2)}`, tah(c1, Math.max(0.16, s * 0.01))));
    }
    return out;
  };

  /* ================================================================ symboly (kresba v poli 100 × 100) */
  ZE.SYMBOLY = { kniha: 'otevřená kniha', sova: 'sova', strom: 'strom', klic: 'klíč', pero: 'brk', svice: 'svíce', kotva: 'kotva' };
  ZE.symbol = function (druh, cx, cy, vel, pal) {
    const c1 = pal.inkoust, c2 = pal.akcent, p = pal.papir, k = vel / 100;
    const out = [];
    const g = (s, b) => out.push({ s: `<g transform="translate(${n(cx - vel / 2)} ${n(cy - vel / 2)}) scale(${n4(k)})">${s}</g>`, b });
    if (druh === 'kniha') {
      g(cesta('M50 34C40 27 22 26 9 30V77C22 73 40 74 50 80C60 74 78 73 91 77V30C78 26 60 27 50 34Z', `fill="${p}" stroke="${c1}" stroke-width="2.4" stroke-linejoin="round"`), 1);
      let r = '';
      for (let i = 0; i < 6; i++) { const y = 40 + i * 6.2; r += `M15 ${n(y - 1.5)}C25 ${n(y - 3.5)} 37 ${n(y - 3)} 45 ${n(y + 1)}M55 ${n(y + 1)}C63 ${n(y - 3)} 75 ${n(y - 3.5)} 85 ${n(y - 1.5)}`; }
      g(cesta(r, tah(c1, 1.1, 'stroke-linecap="round"')), 1);
      g(cesta('M50 34V80M6 82C21 77 40 78 50 85C60 78 79 77 94 82', tah(c1, 2.4, 'stroke-linecap="round" stroke-linejoin="round"')), 1);
      g(cesta('M57 80V95L61 91L65 95V79Z', `fill="${c2}"`), 2);
    } else if (druh === 'sova') {
      g(cesta('M14 92C35 87 65 89 88 84', tah(c1, 3.2, 'stroke-linecap="round"')), 1);
      g(cesta('M50 20C42 20 33 17 25 8C27 20 23 28 23 45C23 70 35 86 50 88C65 86 77 70 77 45C77 28 73 20 75 8C67 17 58 20 50 20Z', `fill="${c1}"`), 1);
      g(kruh(38, 41, 12.5, `fill="${p}"`) + kruh(62, 41, 12.5, `fill="${p}"`), 0);
      g(kruh(38, 41, 7, `fill="${c1}"`) + kruh(62, 41, 7, `fill="${c1}"`), 1);
      g(kruh(40.2, 38.8, 2.1, `fill="${p}"`) + kruh(64.2, 38.8, 2.1, `fill="${p}"`), 0);
      g(cesta('M50 46L45.5 53L50 61L54.5 53Z', `fill="${c2}"`), 2);
      let v = '';
      for (let r = 0; r < 3; r++) for (let i = -1; i <= 1; i++) { const x = 50 + i * 8 + (r % 2) * 4 - 2, y = 66 + r * 6.5; if (Math.abs(x - 50) < 13) v += `M${n(x - 3)} ${n(y)}Q${n(x)} ${n(y + 3.5)} ${n(x + 3)} ${n(y)}`; }
      g(cesta(v + 'M29 55C30 68 36 78 43 84M71 55C70 68 64 78 57 84', tah(p, 1.6, 'stroke-linecap="round"')), 0);
      g(cesta('M40 87L38 93M45 88L44 94M55 88L56 94M60 87L62 93', tah(c1, 2.2, 'stroke-linecap="round"')), 1);
    } else if (druh === 'strom') {
      const R = ZE.rng(77);
      g(cesta('M45.5 92C47 80 47.5 68 48 55L52 55C52.5 68 53 80 54.5 92Z', `fill="${c1}"`), 1);
      g(cesta('M47 88C40 90 34 90 28 93M53 88C60 90 66 90 72 93M48 90C46 93 42 95 38 96M52 90C54 93 58 95 62 96' +
        'M49 62C42 54 33 50 24 45M51 60C58 52 67 48 76 43M49 57C46 45 40 36 32 28M51 56C54 44 60 35 68 27M50 56V18', tah(c1, 2, 'stroke-linecap="round"')), 1);
      let l1 = '', l2 = '';
      for (let i = 0; i < 70; i++) {
        const a = R() * 2 * PI, rr = Math.sqrt(R()) * 31, x = 50 + Math.cos(a) * rr * 1.15, y = 36 + Math.sin(a) * rr * 0.92;
        const u = R() * 180, L = 5 + R() * 2.5;
        const d = `M${n(x)} ${n(y)}` + listD(x, y, u, L);
        if (i % 4 === 3) l2 += d; else l1 += d;
      }
      g(cesta(l1, `fill="${c1}"`), 1);
      g(cesta(l2, `fill="${c2}"`), 2);
      g(cesta('M14 95H86', tah(c1, 1.6, 'stroke-linecap="round"')), 1);
    } else if (druh === 'klic') {
      const tf = 'rotate(-38 50 50)';
      g(`<g transform="${tf}">` + cesta('M8 50A15 15 0 1 1 38 50A15 15 0 1 1 8 50ZM36 46H88V54H36Z', `fill="${c1}"`) + '</g>', 1);
      g(`<g transform="${tf}">` + kruh(23, 50, 9.5, `fill="${p}"`) + '</g>', 0);
      g(`<g transform="${tf}">` + kruh(23, 41.5, 3.6, `fill="${c2}"`) + kruh(23, 58.5, 3.6, `fill="${c2}"`) + kruh(14.5, 50, 3.6, `fill="${c2}"`) + kruh(31.5, 50, 3.6, `fill="${c2}"`) + kruh(23, 50, 2.6, `fill="${c2}"`) + '</g>', 2);
      g(`<g transform="${tf}">` + obdelnik(41, 43, 3, 14, `fill="${c1}"`) + obdelnik(46, 44, 2, 12, `fill="${c1}"`) + cesta('M70 54H88V70H84V63H80V70H76V61H70Z', `fill="${c1}"`) + '</g>', 1);
    } else if (druh === 'pero') {
      g(cesta('M88 6C70 9 52 22 41 42C35 54 31 64 29 74C35 67 42 63 50 59C58 55 64 49 70 41C64 43 59 43 55 44C63 38 70 32 75 24C70 25 66 25 62 25C72 20 81 13 88 6Z', `fill="${c1}"`), 1);
      let b = '';
      for (let i = 0; i < 9; i++) { const t = 0.15 + i * 0.085, x = 88 - t * 56, y = 6 + t * 66; b += `M${n(x)} ${n(y)}L${n(x + 4 + i * 0.3)} ${n(y + 4.5)}`; }
      g(cesta(b + 'M88 6C70 20 52 40 29 74', tah(p, 1.1, 'stroke-linecap="round"')), 0);
      g(cesta('M31 71C27 77 25 82 22 88', tah(c1, 2.2, 'stroke-linecap="round"')), 1);
      g(cesta('M22 88L19.5 95L24.5 90Z', `fill="${c1}"`), 1);
      g(cesta('M8 96C20 92 30 97 44 93', tah(c2, 1.6, 'stroke-linecap="round"')), 2);
    } else if (druh === 'svice') {
      g(cesta('M50 8C44 18 42 24 45 29C47 32 53 32 55 29C58 24 56 18 50 8Z', `fill="${c2}"`), 2);
      g(cesta('M50 18C48 23 48 26 50 28C52 26 52 23 50 18Z', `fill="${p}"`), 0);
      g(cesta('M50 30V36', tah(c1, 1.4)), 1);
      g(cesta('M41 36H59V82H41Z', `fill="${c1}"`), 1);
      g(cesta('M45 40V76', tah(p, 1.6, 'stroke-linecap="round"')), 0);
      g(cesta('M24 84H76C76 90 68 93 50 93C32 93 24 90 24 84ZM76 87C84 87 86 79 80 77', `fill="${c1}" stroke="${c1}" stroke-width="1.5"`), 1);
    } else if (druh === 'kotva') {
      g(kruh(50, 15, 7, tah(c1, 3.2)), 1);
      g(cesta('M50 22V88M34 32H66M16 62C18 78 32 88 50 88C68 88 82 78 84 62', tah(c1, 4, 'stroke-linecap="round"')), 1);
      g(cesta('M10 66L16 56L22 66ZM78 66L84 56L90 66Z', `fill="${c1}"`), 1);
      g(kruh(50, 15, 3, `fill="${c2}"`) + cesta('M44 28H56', tah(c2, 2.4, 'stroke-linecap="round"')), 2);
    }
    return out;
  };
  const n4 = x => (Math.round(x * 10000) / 10000).toString();
  function listD(x, y, uhel, L) {
    const a = uhel * PI / 180, c = Math.cos(a), s = Math.sin(a), z = L * 0.3;
    const pt = (u, v) => n(x + u * c - v * s) + ' ' + n(y + u * s + v * c);
    return `C${pt(L * 0.3, -z)} ${pt(L * 0.75, -z * 0.8)} ${pt(L, 0)}C${pt(L * 0.75, z * 0.8)} ${pt(L * 0.3, z)} ${pt(0, 0)}Z`;
  }

  /* obálka čísel v d (jen absolutní příkazy M L Q C Z – takové vyrábí sazeč); řídicí body ji jen zvětší */
  ZE.mezeD = function (d) {
    const c = String(d).match(/-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < c.length; i += 2) { const x = +c[i], y = +c[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  };
  /* skutečnou obálku cest vtěsná do čtverce vel × vel (psací písmena mají tahy daleko za šířkou znaku) */
  function vtesnej(prvky, cx, cy, sir, vys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of prvky) for (const m of p.s.matchAll(/ d="([^"]+)"/g)) {
      const b = ZE.mezeD(m[1]);
      x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
    }
    if (!(x1 > x0)) return prvky;
    const k = Math.min(1, sir / (x1 - x0), vys / (y1 - y0));
    const tf = `translate(${n4(cx - k * (x0 + x1) / 2)} ${n4(cy - k * (y0 + y1) / 2)}) scale(${n4(k)})`;
    return prvky.map(p => ({ s: `<g transform="${tf}">${p.s}</g>`, b: p.b }));
  }

  /* ================================================================ monogramy */
  ZE.MONOGRAMY = { klasicky: 'klasický s tečkami', propletene: 'propletená písmena', kruh: 've dvojitém kruhu', kosoctverec: 'v kosočtverci', skript: 'psací s ozdobným tahem' };
  /* Monogram do čtverce o straně vel se středem cx, cy. Vrací {prvky}. */
  ZE.monogram = function (pismena, styl, cx, cy, vel, pal, S, o) {
    o = o || {};
    const t = String(pismena || '').replace(/\s+/g, '').slice(0, 3) || '?';
    const id = o.pismo || 'marcellus', idS = o.pismoSkript || 'pinyon';
    const c1 = pal.inkoust, c2 = pal.akcent, p = pal.papir, out = [];
    const push = (s, b) => out.push({ s, b: b || 1 });
    const radaPismen = (sirka, vyska, font, oddel, pr) => {
      // písmena vedle sebe (s tečkami mezi nimi) vycentrovaná, nejvýš vyska verzálky
      const m = S.metriky(font);
      const txt = oddel ? t.split('').join(oddel) : t;
      let v = vyska / m.cap;
      const w1 = S.sirka(txt, font, 1, pr ? pr : 0);
      v = Math.min(v, sirka / w1);
      return { d: S.cesta(txt, font, v, cx, cy + m.cap * v / 2, { zarovnani: 'stred', prostrkani: pr ? pr * v : 0 }), v, cap: m.cap * v };
    };
    if (styl === 'klasicky') {
      const r = radaPismen(vel * 0.92, vel * 0.42, id, '·');
      push(cesta(r.d, `fill="${c1}"`));
      const l = vel * 0.38, y1 = cy - r.cap / 2 - vel * 0.1, y2 = cy + r.cap / 2 + vel * 0.1;
      ZE.ozdoba('linka', cx, y1, l, pal).concat(ZE.ozdoba('linka', cx, y2, l, pal)).forEach(x => out.push(x));
    } else if (styl === 'propletene') {
      const m = S.metriky(id), v = vel * 0.62 / m.cap;
      const sir = t.split('').map(ch => S.sirka(ch, id, v));
      const prekryv = 0.38;
      const celk = sir.reduce((a, w, i) => a + (i ? w * (1 - prekryv) : w), 0);
      const kmen = Math.min(1, vel * 0.98 / celk), vv = v * kmen;
      let x = cx - celk * kmen / 2;
      t.split('').forEach((ch, i) => {
        const w = sir[i] * kmen, dy = (i % 2 ? 1 : -1) * vel * 0.06 * (t.length > 1 ? 1 : 0);
        const d = S.cesta(ch, id, vv, x, cy + m.cap * vv / 2 + dy);
        push(cesta(d, `fill="${p}" stroke="${p}" stroke-width="${n(vel * 0.045)}" stroke-linejoin="round"`), 0);
        push(cesta(d, `fill="${i % 2 ? c2 : c1}"`), i % 2 ? 2 : 1);
        x += w * (1 - prekryv);
      });
      return vtesnej(out, cx, cy, vel * 0.96, vel * 0.9);
    } else if (styl === 'kruh') {
      push(kruh(cx, cy, vel * 0.48, tah(c1, vel * 0.022)));
      push(kruh(cx, cy, vel * 0.44, tah(c1, vel * 0.008)));
      const r = radaPismen(vel * 0.66, vel * 0.34, id, t.length > 2 ? '' : '', vel * 0.0);
      push(cesta(r.d, `fill="${c1}"`));
      for (const a of [0, 90, 180, 270]) {
        const rr = vel * 0.46, x = cx + Math.sin(a * PI / 180) * rr, y = cy - Math.cos(a * PI / 180) * rr;
        push(kruh(x, y, vel * 0.025, `fill="${c2}"`), 2);
      }
    } else if (styl === 'kosoctverec') {
      const s = vel * 0.5;
      const kos = q => `M${n(cx)} ${n(cy - q)}L${n(cx + q)} ${n(cy)}L${n(cx)} ${n(cy + q)}L${n(cx - q)} ${n(cy)}Z`;
      push(cesta(kos(s), tah(c1, vel * 0.02, 'stroke-linejoin="miter"')));
      push(cesta(kos(s * 0.9), tah(c2, vel * 0.008)), 2);
      const r = radaPismen(s * 0.95, s * 0.42, id, '');
      push(cesta(r.d, `fill="${c1}"`));
      for (const [x, y] of [[cx, cy - s], [cx + s, cy], [cx, cy + s], [cx - s, cy]]) push(kruh(x, y, vel * 0.03, `fill="${c2}"`), 2);
    } else {   // skript
      const m = S.metriky(idS), v = vel * 0.6 / m.cap;
      const sir = t.split('').map(ch => S.sirka(ch, idS, v));
      const prekryv = 0.3, celk = sir.reduce((a, w, i) => a + (i ? w * (1 - prekryv) : w), 0);
      const kmen = Math.min(1, vel * 0.95 / celk), vv = v * kmen;
      let x = cx - celk * kmen / 2;
      let d = '';
      t.split('').forEach((ch, i) => { d += S.cesta(ch, idS, vv, x, cy + m.cap * vv * 0.38); x += sir[i] * kmen * (1 - prekryv); });
      push(cesta(d, `fill="${c1}"`));
      const y = cy + vel * 0.34, l = vel * 0.45;
      out.splice(0, out.length, ...vtesnej(out, cx, cy - vel * 0.06, vel * 0.96, vel * 0.72));
      push(cesta(`M${n(cx - l)} ${n(y)}C${n(cx - l * 0.4)} ${n(y + vel * 0.08)} ${n(cx + l * 0.2)} ${n(y - vel * 0.07)} ${n(cx + l)} ${n(y - vel * 0.01)}C${n(cx + l * 0.7)} ${n(y + vel * 0.04)} ${n(cx + l * 0.5)} ${n(y + vel * 0.06)} ${n(cx + l * 0.35)} ${n(y + vel * 0.02)}`, tah(c2, vel * 0.012, 'stroke-linecap="round"')), 2);
    }
    return out;
  };

  /* ================================================================ texty v ploše */
  /* Blok textu se středovým / levým zarovnáním; vrací {prvky, vyska}. y = horní hrana bloku (verzálky). */
  function blok(S, a, x, y, sirka, id, pal, barva, o) {
    o = o || {};
    const m = S.metriky(id), v = a.vel, out = [];
    let d = '';
    a.radky.forEach((r, i) => {
      const yb = y + m.cap * v + i * v * a.radkovani;
      const xx = o.zarovnani === 'vlevo' ? x : o.zarovnani === 'vpravo' ? x + sirka : x + sirka / 2;
      d += S.cesta(r.text, id, v, xx, yb, { zarovnani: o.zarovnani || 'stred', prostrkani: o.prostrkani ? o.prostrkani * v : 0 });
    });
    if (d) out.push({ s: cesta(d, `fill="${pal[barva] || barva}"`), b: barva === 'akcent' ? 2 : 1 });
    return out;
  }
  /* jeden řádek kapitálkami s prostrkáním, zmenšený do šířky */
  function radek(S, text, cx, yb, vel, maxW, id, barva, b, o) {
    o = o || {};
    const pr = o.prostrkani == null ? 0.16 : o.prostrkani;
    let v = vel;
    const w = S.sirka(text, id, v, pr * v);
    if (w > maxW) v = v * maxW / w;
    return { s: cesta(S.cesta(text, id, v, cx, yb, { zarovnani: o.zarovnani || 'stred', prostrkani: pr * v }), `fill="${barva}"`), b, vel: v };
  }
  ZE.radek = radek;

  /* ================================================================ paleta */
  ZE.PALETY = {
    inkoust: { nazev: 'Inkoust a slonovina', papir: '#fbf7ee', inkoust: '#1f2a36', akcent: '#a8823c' },
    bordo:   { nazev: 'Bordó a zlato',       papir: '#f7efe4', inkoust: '#5b1a24', akcent: '#b48a4a' },
    les:     { nazev: 'Lesní zeleň',          papir: '#f2f0e4', inkoust: '#22412f', akcent: '#8b9a52' },
    noc:     { nazev: 'Noční modř',           papir: '#18243a', inkoust: '#efe4c8', akcent: '#d0a85c' },
    deco:    { nazev: 'Art deco černá',       papir: '#121212', inkoust: '#e2c46e', akcent: '#f3ead2' },
    modrotisk: { nazev: 'Modrotisk',          papir: '#1d3557', inkoust: '#f1f4ef', akcent: '#9fc2dd' },
    sepie:   { nazev: 'Sépie',                papir: '#f6efe2', inkoust: '#4a3426', akcent: '#9a6b47' },
    ruze:    { nazev: 'Pudrová růže',         papir: '#f8ece8', inkoust: '#4b2d38', akcent: '#c27b84' },
  };
  ZE.TISKOVE_BARVY = {
    '#1a1a1a': 'černá', '#4a3426': 'sépie', '#5b1a24': 'bordó', '#1f3354': 'tmavě modrá', '#22412f': 'lahvová zeleň',
    '#8a6a2f': 'okrová zlatá', '#9b2c2c': 'cihlová červená', '#3b3b6d': 'indigo',
  };

  /* ================================================================ záložka */
  ZE.ZALOZKA_SABLONY = { citat: 'Citát', kniha: 'Název knihy a autor', minimal: 'Minimalistická', ramecek: 'Ornamentální rámeček', vzor: 'Vzor' };
  ZE.novaStrana = function (sablona) {
    return {
      sablona: sablona || 'citat', text: '', autor: '', zdroj: '', pismo: 'fell', pismo2: 'marcellus',
      ramecek: 'zadny', ozdoba: 'linka', vzor: 'artdeco', hustota: 3, seed: 1, stitek: true, uvozovky: true,
      svisle: false, zarovnani: 'stred', invert: false, poleStrana: false,
      obrazek: { id: '', umisteni: 'zadne', kryti: 0.35 },
      qr: { text: '' },
    };
  };
  ZE.novaZalozka = function () {
    const lic = Object.assign(ZE.novaStrana('citat'), {
      text: D.VYCHOZI.citat, autor: D.VYCHOZI.autor, zdroj: '', ramecek: 'rohy',
    });
    const rub = Object.assign(ZE.novaStrana('vzor'), { vzor: 'artdeco', text: D.VYCHOZI.rub, stitek: false, seed: 3 });
    return { rozmer: '50x150', sirka: 50, vyska: 150, zaobleni: 3, paleta: 'inkoust', barvy: Object.assign({}, ZE.PALETY.inkoust),
      otvor: { pouzit: true, prumer: 5, odsazeni: 9 }, lic, rub, serie: false, serieText: '' };
  };
  /* Paleta strany (invert prohodí papír a inkoust). */
  ZE.paletaStrany = (z, st) => {
    const b = z.barvy || ZE.PALETY.inkoust;
    return st && st.invert ? { papir: b.inkoust, inkoust: b.papir, akcent: b.akcent } : { papir: b.papir, inkoust: b.inkoust, akcent: b.akcent };
  };
  const PRESAH = 3;   // vzory a pozadí sahají za ořez (spadávka až 3 mm)

  function obrazekPrvek(obr, x, y, w, h, o) {
    o = o || {};
    if (!obr || !obr.url) return null;
    const attr = `preserveAspectRatio="xMidYMid ${o.meet ? 'meet' : 'slice'}"${o.kryti != null && o.kryti < 1 ? ` opacity="${n(o.kryti)}"` : ''}`;
    const s = `<svg x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" viewBox="0 0 ${obr.w || 100} ${obr.h || 100}" ${attr}><image href="${obr.url}" width="${obr.w || 100}" height="${obr.h || 100}"/></svg>`;
    return { s, b: 'obr' };
  }

  /* Kus záložky: {w, h, prvky, otvor, zaobleni, varovani}. S = sazeč, obrazky = {id: {url, w, h}}. */
  ZE.kresliZalozku = function (z, strana, S, obrazky) {
    const { w, h } = ZE.rozmerZalozky(z), st = z[strana] || ZE.novaStrana(), pal = ZE.paletaStrany(z, st);
    const prvky = [], varovani = [];
    const pridej = a => { for (const x of a) if (x) prvky.push(x); };
    const ot = z.otvor || {};
    const otvor = ot.pouzit ? { cx: w / 2, cy: omez(cislo(ot.odsazeni, 9), 3, h / 3), r: omez(cislo(ot.prumer, 5), 2, 15) / 2 } : null;
    const m = Math.max(4, w * 0.11);
    prvky.push({ s: obdelnik(-PRESAH, -PRESAH, w + 2 * PRESAH, h + 2 * PRESAH, `fill="${pal.papir}"`), b: 0, pozadi: true });
    let top = otvor ? otvor.cy + otvor.r + Math.max(3.5, m * 0.6) : m, bottom = h - m;
    const obr = st.obrazek && st.obrazek.umisteni !== 'zadne' && obrazky ? obrazky[st.obrazek.id] : null;
    const um = obr ? st.obrazek.umisteni : 'zadne';
    if (um === 'pozadi') pridej([obrazekPrvek(obr, -PRESAH, -PRESAH, w + 2 * PRESAH, h + 2 * PRESAH, { kryti: omez(cislo(st.obrazek.kryti, 0.35), 0.05, 1) })]);
    else if (um === 'nahore') { const hh = h * 0.42; pridej([obrazekPrvek(obr, -PRESAH, -PRESAH, w + 2 * PRESAH, hh + PRESAH)]); top = hh + m * 0.7; }
    else if (um === 'dole') { const hh = h * 0.42; pridej([obrazekPrvek(obr, -PRESAH, h - hh, w + 2 * PRESAH, hh + PRESAH)]); bottom = h - hh - m * 0.7; }
    else if (um === 'okno') {
      const ow = w - 2 * m, oh = Math.min(ow * 1.25, (bottom - top) * 0.45);
      pridej([obrazekPrvek(obr, m, top, ow, oh)]);
      prvky.push({ s: obdelnik(m, top, ow, oh, tah(pal.inkoust, 0.3)), b: 1 });
      top += oh + m * 0.6;
    }

    const sab = st.sablona;
    const ix = m, iw = w - 2 * m;
    let qrPrvky = [];
    if (st.qr && String(st.qr.text || '').trim()) {
      const mat = ZE.qrMatice(st.qr.text);
      if (mat) {
        const vel = Math.min(iw * 0.78, 24), k = vel / (mat.length + 4);
        if (k < 0.3) varovani.push('QR kód je pro tuto šířku příliš hustý – zkraťte odkaz.');
        const svetla = ZE.jas(pal.papir) >= ZE.jas(pal.inkoust) ? pal.papir : pal.inkoust, tmava = svetla === pal.papir ? pal.inkoust : pal.papir;
        const qy = bottom - vel;
        qrPrvky = ZE.qrPrvky(mat, (w - vel) / 2, qy, vel, svetla, tmava);
        bottom = qy - Math.max(3, m * 0.5);
      }
    }
    if (st.ramecek && st.ramecek !== 'zadny' && sab !== 'vzor' && um !== 'dole') bottom = h - m * 1.5;
    if (sab === 'vzor' && um !== 'pozadi') pridej(ZE.vzor(st.vzor, -PRESAH, um === 'nahore' ? top - m * 0.7 : -PRESAH, w + 2 * PRESAH,
      (um === 'dole' ? bottom + m * 0.7 : h + PRESAH) - (um === 'nahore' ? top - m * 0.7 : -PRESAH), pal, { hustota: st.hustota, seed: st.seed }));
    // rámeček (u vzoru jen kolem štítku)
    if (st.ramecek && st.ramecek !== 'zadny' && sab !== 'vzor') {
      const fx = m * 0.45, fy = (otvor && um !== 'nahore' ? otvor.cy + otvor.r + 2.2 : m * 0.45);
      pridej(ZE.ramecek(st.ramecek, fx, Math.max(fy, um === 'nahore' ? top - m * 0.35 : fy), w - 2 * fx, (um === 'dole' ? bottom + m * 0.35 : h - m * 0.45) - Math.max(fy, um === 'nahore' ? top - m * 0.35 : fy), pal, { sila: Math.max(0.25, w * 0.007) }));
      top = Math.max(top, fy + m * 0.9);
    }
    const text = ZE.typografie(st.text), autor = ZE.typografie(st.autor), zdroj = ZE.typografie(st.zdroj);
    const vMin = 2.2;
    if (sab === 'citat' || sab === 'ramecek') {
      const id = st.pismo, id2 = st.pismo2 || 'marcellus';
      const v2 = omez(w * 0.062, 2.2, 3.8);
      const m2 = S.metriky(id2);
      let autVys = 0;
      if (autor) autVys += v2 * m2.cap + v2 * 0.9;
      if (zdroj) autVys += v2 * 1.25;
      const ozd = st.ozdoba && st.ozdoba !== 'zadna';
      const ozVys = ozd ? Math.max(4, w * 0.12) : (autVys ? v2 * 1.2 : 0);
      const uv = sab === 'citat' && st.uvozovky;
      const uvVel = iw * 0.42, mU = S.metriky(id);
      const uvVys = uv ? uvVel * mU.cap * 0.75 : 0;
      const dost = bottom - top - autVys - ozVys - uvVys - (sab === 'ramecek' && ozd ? ozVys : 0);
      const a = ZE.autoVelikost(text || ' ', S, id, { sirka: iw, vyska: Math.max(5, dost), min: vMin, max: Math.min(w * 0.115, 7), radkovani: 1.32, vyvazit: st.zarovnani !== 'vlevo' });
      if (a.preteka) varovani.push('Text se nevejde ani při nejmenší velikosti písma – zkraťte ho nebo zvolte delší záložku.');
      const celkem = uvVys + a.vyska + ozVys + autVys + (sab === 'ramecek' && ozd ? ozVys : 0);
      let y = top + Math.max(0, (bottom - top - celkem) * 0.44);
      if (sab === 'ramecek' && ozd) { pridej(ZE.ozdoba(st.ozdoba, w / 2, y + ozVys / 2, Math.min(iw * 0.8, 26), pal)); y += ozVys; }
      if (uv) {
        const d = S.cesta('„', id, uvVel, st.zarovnani === 'vlevo' ? ix : w / 2, y + uvVel * mU.cap * 0.25, { zarovnani: st.zarovnani === 'vlevo' ? 'vlevo' : 'stred' });
        prvky.push({ s: cesta(d, `fill="${pal.akcent}"`), b: 2 });
        y += uvVys;
      }
      pridej(blok(S, a, ix, y, iw, id, pal, 'inkoust', { zarovnani: st.zarovnani === 'vlevo' ? 'vlevo' : 'stred' }));
      y += a.vyska;
      if (ozd) { pridej(ZE.ozdoba(st.ozdoba, st.zarovnani === 'vlevo' ? ix + Math.min(iw * 0.5, 16) / 2 : w / 2, y + ozVys / 2, Math.min(iw * (st.zarovnani === 'vlevo' ? 0.5 : 0.7), 22), pal)); }
      y += ozVys;
      const zar = st.zarovnani === 'vlevo' ? 'vlevo' : 'stred', ax = zar === 'vlevo' ? ix : w / 2;
      if (autor) { const r = radek(S, autor.toUpperCase(), ax, y + v2 * m2.cap, v2, iw, id2, pal.inkoust, 1, { zarovnani: zar }); prvky.push(r); y += v2 * m2.cap + v2 * 0.9; }
      if (zdroj) prvky.push(radek(S, zdroj, ax, y + v2 * 0.9, v2 * 1.05, iw, st.pismo === 'fell' ? 'fell' : 'libserifi', pal.akcent, 2, { prostrkani: 0, zarovnani: zar }));
    } else if (sab === 'kniha') {
      const id = st.pismo, id2 = st.pismo2 || 'marcellus';
      if (st.svisle) {
        const L = bottom - top, H = iw;
        const a = ZE.autoVelikost(text || ' ', S, id, { sirka: L * 0.92, vyska: H * (autor ? 0.62 : 0.85), min: vMin, max: H * 0.75, radkovani: 1.1, maxRadku: 2 });
        const v2 = omez(a.vel * 0.32, 2, 4.2);
        const m2 = S.metriky(id2);
        const celk = a.vyska + (autor ? v2 * 1.1 + v2 * m2.cap : 0);
        const cx = w / 2, cy = (top + bottom) / 2;
        const g = [];
        pridej(blok(S, a, -L * 0.46, -celk / 2, L * 0.92, id, pal, 'inkoust').map(p => ({ s: `<g transform="translate(${n(cx)} ${n(cy)}) rotate(-90)">${p.s}</g>`, b: p.b })));
        if (autor) {
          const r = radek(S, autor.toUpperCase(), 0, -celk / 2 + a.vyska + v2 * 1.1 + v2 * m2.cap, v2, L * 0.8, id2, pal.akcent, 2, { prostrkani: 0.22 });
          g.push({ s: `<g transform="translate(${n(cx)} ${n(cy)}) rotate(-90)">${r.s}</g>`, b: 2 });
        }
        pridej(g);
        if (a.preteka) varovani.push('Název je na svislou záložku příliš dlouhý.');
      } else {
        const a = ZE.autoVelikost(text || ' ', S, id, { sirka: iw, vyska: (bottom - top) * 0.45, min: vMin, max: Math.min(w * 0.2, 12), radkovani: 1.15 });
        const v2 = omez(a.vel * 0.45, 2.2, 3.8), m2 = S.metriky(id2);
        const ozVys = Math.max(5, w * 0.14);
        const celk = a.vyska + ozVys + (autor ? v2 * m2.cap : 0) + (zdroj ? v2 * 1.6 : 0);
        let y = top + Math.max(0, (bottom - top - celk) * 0.42);
        pridej(blok(S, a, ix, y, iw, id, pal, 'inkoust'));
        y += a.vyska;
        pridej(ZE.ozdoba(st.ozdoba && st.ozdoba !== 'zadna' ? st.ozdoba : 'linka', w / 2, y + ozVys / 2, Math.min(iw * 0.75, 24), pal));
        y += ozVys;
        if (autor) { prvky.push(radek(S, autor.toUpperCase(), w / 2, y + v2 * m2.cap, v2, iw, id2, pal.inkoust, 1, { prostrkani: 0.2 })); y += v2 * m2.cap; }
        if (zdroj) prvky.push(radek(S, zdroj, w / 2, y + v2 * 1.6, v2 * 0.95, iw, 'libserifi', pal.akcent, 2, { prostrkani: 0 }));
        if (a.preteka) varovani.push('Název se nevejde – zkraťte ho.');
      }
    } else if (sab === 'minimal') {
      const id = st.pismo, id2 = st.pismo2 || 'marcellus', m2 = S.metriky(id2);
      const v2 = omez(w * 0.05, 1.8, 3);
      if (autor) prvky.push(radek(S, autor.toUpperCase(), w / 2, top + v2 * m2.cap + 1, v2, iw, id2, pal.akcent, 2, { prostrkani: 0.3 }));
      let yb = bottom;
      if (st.poleStrana) {
        const vs = omez(w * 0.06, 2.2, 3.4), ms = S.metriky(id);
        prvky.push({ s: cesta(S.cesta('str.', id, vs, ix, yb), `fill="${pal.inkoust}"`), b: 1 });
        const sw = S.sirka('str.', id, vs);
        prvky.push({ s: cesta(`M${n(ix + sw + 1.2)} ${n(yb + 0.4)}H${n(ix + iw)}`, tah(pal.inkoust, 0.2)), b: 1 });
        yb -= vs * ms.cap + vs * 2.2;
      }
      if (text) {
        const a = ZE.autoVelikost(text, S, id, { sirka: iw, vyska: (bottom - top) * 0.35, min: vMin, max: Math.min(w * 0.085, 5), radkovani: 1.3, vyvazit: false });
        pridej(blok(S, a, ix, yb - a.vyska, iw, id, pal, 'inkoust', { zarovnani: 'vlevo' }));
        yb -= a.vyska + a.vel * 1.4;
        if (a.preteka) varovani.push('Text je pro minimalistickou záložku příliš dlouhý.');
      }
      prvky.push({ s: cesta(`M${n(ix)} ${n(yb)}H${n(ix + Math.min(iw * 0.3, 12))}`, tah(pal.akcent, 0.7, 'stroke-linecap="butt"')), b: 2 });
    } else if (sab === 'vzor') {
      if (st.stitek && (text || autor)) {
        const id = st.pismo, id2 = st.pismo2 || 'marcellus', m2 = S.metriky(id2);
        const sw = w - 2 * m * 0.8, pad = Math.max(2.5, sw * 0.09);
        const a = ZE.autoVelikost(text || ' ', S, id, { sirka: sw - 2 * pad, vyska: h * 0.22, min: vMin, max: Math.min(w * 0.13, 8), radkovani: 1.2 });
        const v2 = omez(a.vel * 0.55, 1.9, 3.2);
        const sh = a.vyska + 2 * pad + (autor ? v2 * m2.cap + v2 * 1.3 : 0);
        const sx = (w - sw) / 2, sy = Math.min(bottom - sh, Math.max(top, (top + bottom) / 2 + (bottom - top) * 0.12 - sh / 2));
        prvky.push({ s: obdelnik(sx, sy, sw, sh, `fill="${pal.papir}" stroke="${pal.inkoust}" stroke-width="0.6"`), b: 1 });
        prvky.push({ s: obdelnik(sx + 1, sy + 1, sw - 2, sh - 2, tah(pal.akcent, 0.25)), b: 2 });
        pridej(blok(S, a, sx + pad, sy + pad, sw - 2 * pad, id, pal, 'inkoust'));
        if (autor) prvky.push(radek(S, autor.toUpperCase(), w / 2, sy + pad + a.vyska + v2 * 1.3 + v2 * m2.cap * 0.3, v2, sw - 2 * pad, id2, pal.akcent, 2, { prostrkani: 0.2 }));
      }
    }
    for (const p of qrPrvky) prvky.push(p);
    return { w, h, prvky, otvor, zaobleni: omez(cislo(z.zaobleni, 0), 0, Math.min(w, h) / 4), varovani, papir: pal.papir };
  };

  /* ================================================================ ex libris */
  ZE.KOMPOZICE = { ramecek: 'Rámeček', stitek: 'Štítek (kartuš)', erb: 'Erb se stuhou', pecet: 'Kulatá pečeť', volna: 'Volná (bez rámu)' };
  ZE.NAPISY = { exlibris: 'EX LIBRIS (verzálky)', skript: 'Ex libris (psacím)', zknih: 'Z knih …', zknihovny: 'Z knihovny …', vlastni: 'vlastní nápis' };
  ZE.noveExlibris = function () {
    return {
      rozmer: '60x80', sirka: 60, vyska: 80, kompozice: 'ramecek', napis: 'exlibris', napisVlastni: '',
      jmeno: D.VYCHOZI.jmeno, jmeno2: '', motto: '', stred: 'symbol', inicialy: '', monogram: 'propletene', symbol: 'sova',
      ramecek: 'dvojita', pismoNapis: 'marcellus', pismoJmeno: 'fell', pismoMonogram: 'marcellus',
      dvoubarevne: true, barvy: { inkoust: '#1f2a36', akcent: '#8a6a2f', papir: '#fbf7ee' }, tiskPozadi: false,
      obrazek: { id: '' },
    };
  };
  ZE.paletaExlibris = e => {
    const b = e.barvy || {};
    return { papir: b.papir || '#ffffff', inkoust: b.inkoust || '#1a1a1a', akcent: e.dvoubarevne ? (b.akcent || b.inkoust) : (b.inkoust || '#1a1a1a') };
  };
  /* Texty ex libris: horní nápis a jméno (u „Z knih“ ve 2. pádě). */
  ZE.textyExlibris = function (e) {
    const jm = String(e.jmeno || '').trim();
    const gen = String(e.jmeno2 || '').trim() || ZE.genitiv(jm);
    switch (e.napis) {
      case 'skript': return { nahore: 'Ex libris', jmeno: jm, skript: true };
      case 'zknih': return { nahore: 'Z KNIH', jmeno: gen };
      case 'zknihovny': return { nahore: 'Z KNIHOVNY', jmeno: gen };
      case 'vlastni': return { nahore: String(e.napisVlastni || '').trim(), jmeno: jm };
      default: return { nahore: 'EX LIBRIS', jmeno: jm };
    }
  };

  function stredovyMotiv(e, cx, cy, vel, pal, S, obrazky) {
    if (vel < 4) return [];
    if (e.stred === 'monogram') return ZE.monogram(e.inicialy || ZE.inicialy(e.jmeno), e.monogram, cx, cy, vel, pal, S, { pismo: e.pismoMonogram });
    if (e.stred === 'symbol') return ZE.symbol(e.symbol, cx, cy, vel, pal);
    if (e.stred === 'obrazek') { const o = obrazky && obrazky[e.obrazek && e.obrazek.id]; const p = obrazekPrvek(o, cx - vel / 2, cy - vel / 2, vel, vel, { meet: true }); return p ? [p] : []; }
    return [];
  }

  ZE.kresliExlibris = function (e, S, obrazky) {
    const { w, h } = ZE.rozmerExlibris(e), pal = ZE.paletaExlibris(e), T = ZE.textyExlibris(e);
    const prvky = [], varovani = [];
    if (!e.tiskPozadi && ZE.jas(pal.inkoust) > 0.45) varovani.push('Světlý inkoust se tiskne na bílý papír bez pozadí – bude špatně čitelný. Zvolte tmavší inkoust nebo zapněte tisk barvy papíru.');
    const pridej = a => { for (const x of a) if (x) prvky.push(x); };
    prvky.push({ s: obdelnik(-PRESAH, -PRESAH, w + 2 * PRESAH, h + 2 * PRESAH, `fill="${pal.papir}"`), b: 0, pozadi: true });
    const m = Math.min(w, h) * 0.07, idN = e.pismoNapis || 'marcellus', idJ = e.pismoJmeno || 'fell';
    const skript = T.skript || ZE.PSACI.has(idN);
    const idHorni = T.skript ? 'pinyon' : idN;
    const mH = S.metriky(idHorni), mJ = S.metriky(idJ);
    const komp = e.kompozice;
    const motto = ZE.typografie(e.motto);
    const jmenoRadky = (maxW, maxV) => {
      // jedno-, případně dvouřádkové jméno do šířky
      const a = ZE.autoVelikost(T.jmeno || ' ', S, idJ, { sirka: maxW, vyska: maxV * 1.05 * (mJ.cap + mJ.desc * 0.5), min: 1.8, max: maxV, radkovani: 1.15, maxRadku: 1 });
      if (a.vel >= maxV * 0.55 || !/\s/.test(T.jmeno)) return a;
      return ZE.autoVelikost(T.jmeno, S, idJ, { sirka: maxW, vyska: maxV * 1.7, min: 1.8, max: maxV * 0.85, radkovani: 1.12, maxRadku: 2 });
    };

    if (komp === 'pecet') {
      const R = Math.min(w, h) / 2 - m * 0.6, cx = w / 2, cy = h / 2 - (h > w * 1.15 && motto ? h * 0.06 : 0);
      const t = Math.max(0.3, R * 0.022);
      prvky.push({ s: kruh(cx, cy, R, tah(pal.inkoust, t * 2.4)), b: 1 });
      prvky.push({ s: kruh(cx, cy, R - t * 4, tah(pal.inkoust, t * 0.7)), b: 1 });
      const pas = R * 0.17, rIn = R - t * 4 - pas - R * 0.05;
      const vT = pas * 0.78 / mH.cap * (skript ? 1.25 : 1);
      const rTop = R - t * 4 - pas * 0.88;
      const horni = T.nahore;
      if (horni) {
        const r = S.cestaPoKruhu(horni, idHorni, vT, cx, cy, rTop, { prostrkani: skript ? 0 : vT * 0.2 });
        prvky.push({ s: cesta(r.d, `fill="${pal.inkoust}"`), b: 1 });
      }
      let vJ = pas * 0.78 / mJ.cap;
      const maxUhel = 150 * PI / 180;
      const sirJ = S.sirka(T.jmeno, idJ, vJ, vJ * 0.12);
      const rBot = rTop + pas * 0.15 + mJ.cap * vJ;
      if (sirJ > maxUhel * (rBot - mJ.cap * vJ * 0.4)) vJ *= maxUhel * (rBot - mJ.cap * vJ * 0.4) / sirJ;
      const rB = rIn + R * 0.05 + (pas + mJ.cap * vJ) / 2 + pas * 0.05;
      if (T.jmeno) {
        const r = S.cestaPoKruhu(T.jmeno, idJ, vJ, cx, cy, rB, { dole: true, prostrkani: vJ * 0.12 });
        prvky.push({ s: cesta(r.d, `fill="${pal.inkoust}"`), b: 1 });
      }
      for (const a of [90, 270]) {
        const rr = rIn + R * 0.05 + pas / 2;
        const x = cx + Math.sin(a * PI / 180) * rr, y = cy - Math.cos(a * PI / 180) * rr;
        pridej(ZE.ozdoba('hvezda', x, y, pas * 3, { inkoust: pal.papir, akcent: pal.akcent }).slice(0, 1));
      }
      prvky.push({ s: kruh(cx, cy, rIn, tah(pal.inkoust, t * 0.7)), b: 1 });
      pridej(stredovyMotiv(e, cx, cy, rIn * 1.36, pal, S, obrazky));
      if (motto && h > w * 1.1) prvky.push(radek(S, motto, cx, cy + R + (h - (cy + R)) * 0.55, Math.min(m * 0.9, 3.4), w - 2 * m, 'libserifi', pal.akcent, 2, { prostrkani: 0 }));
      return { w, h, prvky, varovani, papir: pal.papir };
    }

    // obdélníkové kompozice
    let rx = m, ry = m, rw = w - 2 * m, rh = h - 2 * m;
    const styl = komp === 'stitek' ? 'kartus' : komp === 'volna' ? 'zadny' : e.ramecek;
    if (styl !== 'zadny') pridej(ZE.ramecek(styl, rx, ry, rw, rh, pal, { sila: Math.max(0.3, Math.min(w, h) * 0.0065) }));
    const pad = Math.min(w, h) * ({ zadny: 0.03, kartus: 0.09, artdeco: 0.15, secese: 0.13, rohy: 0.09 }[styl] || 0.075);
    const ix = rx + pad, iy = ry + pad, iw = rw - 2 * pad, ih = rh - 2 * pad;
    let y = iy;
    // horní nápis
    if (T.nahore) {
      const v = skript ? Math.min(iw * 0.2, ih * 0.16) / (mH.cap * 1.25) : Math.min(iw * 0.085, ih * 0.07) / mH.cap;
      const r = radek(S, T.nahore, w / 2, y + mH.cap * v * (skript ? 1.15 : 1), v, iw * (skript ? 0.95 : 0.9), idHorni, pal.inkoust, 1, { prostrkani: skript ? 0 : 0.28 });
      prvky.push(r);
      y += mH.cap * r.vel * (skript ? 1.15 + mH.desc * 0.6 : 1) + ih * 0.04;
      if (!skript || komp === 'stitek') { pridej(ZE.ozdoba(komp === 'volna' ? 'tecky' : 'linka', w / 2, y + ih * 0.025, Math.min(iw * 0.5, 22), pal)); y += ih * 0.05; }
    }
    // dolní část: jméno + motto
    const vMotto = motto ? Math.min(iw * 0.06, 3) : 0;
    const maxJ = Math.min(iw * (komp === 'volna' ? 0.13 : 0.12), ih * 0.1) / mJ.cap;
    if (komp === 'erb') {
      const vJ = jmenoRadky(iw * 0.66, maxJ * 0.85);
      const mottoVys = motto ? vMotto * 1.9 : 0;
      const pasH = Math.max(vJ.vyska + vJ.vel * 0.9, maxJ * mJ.cap * 1.25);
      const dostupne = iy + ih - mottoVys - y;
      const sw = Math.min(iw * 0.72, (dostupne - pasH * 0.6) / 1.2), sh = sw * 1.2;
      const sx = w / 2 - sw / 2, sy = y + Math.max(0, (dostupne - pasH * 0.6 - sh) * 0.4);
      const stit = (k) => {
        const X0 = w / 2 - sw * k / 2, X1 = w / 2 + sw * k / 2, Y0 = sy + sh * (1 - k) * 0.3, H = sh * k;
        return `M${n(X0)} ${n(Y0)}H${n(X1)}V${n(Y0 + H * 0.46)}C${n(X1)} ${n(Y0 + H * 0.8)} ${n(w / 2 + sw * k * 0.22)} ${n(Y0 + H * 0.92)} ${n(w / 2)} ${n(Y0 + H)}C${n(w / 2 - sw * k * 0.22)} ${n(Y0 + H * 0.92)} ${n(X0)} ${n(Y0 + H * 0.8)} ${n(X0)} ${n(Y0 + H * 0.46)}Z`;
      };
      const t = Math.max(0.35, sw * 0.018);
      prvky.push({ s: cesta(stit(1), `fill="${pal.papir}" stroke="${pal.inkoust}" stroke-width="${n(t * 1.8)}" stroke-linejoin="round"`), b: 1 });
      prvky.push({ s: cesta(stit(0.88), tah(pal.akcent, t * 0.6)), b: 2 });
      pridej(stredovyMotiv(e, w / 2, sy + sh * 0.43, sw * 0.6, pal, S, obrazky));
      // stuha
      const by = sy + sh * 0.84 - pasH / 2, bw = Math.min(iw * 0.8, sw * 1.25), bx0 = w / 2 - bw / 2, bx1 = w / 2 + bw / 2, tw = Math.min(m * 1.6, (w - bw) / 2 - 1);
      const ocas = (x, sx2) => `M${n(x - sx2 * tw * 0.4)} ${n(by + pasH * 0.32)}L${n(x + sx2 * tw)} ${n(by + pasH * 0.32)}L${n(x + sx2 * tw * 0.6)} ${n(by + pasH * 0.82)}L${n(x + sx2 * tw)} ${n(by + pasH * 1.32)}L${n(x - sx2 * tw * 0.4)} ${n(by + pasH * 1.32)}Z`;
      const ss = `fill="${pal.papir}" stroke="${pal.inkoust}" stroke-width="${n(t)}" stroke-linejoin="round"`;
      prvky.push({ s: cesta(ocas(bx0, -1) + ocas(bx1, 1), ss), b: 1 });
      prvky.push({ s: cesta(`M${n(bx0)} ${n(by + pasH)}L${n(bx0 + tw * 0.4)} ${n(by + pasH * 1.32)}L${n(bx0)} ${n(by + pasH * 1.32)}ZM${n(bx1)} ${n(by + pasH)}L${n(bx1 - tw * 0.4)} ${n(by + pasH * 1.32)}L${n(bx1)} ${n(by + pasH * 1.32)}Z`, `fill="${pal.inkoust}"`), b: 1 });
      prvky.push({ s: cesta(`M${n(bx0)} ${n(by)}Q${n(w / 2)} ${n(by - pasH * 0.12)} ${n(bx1)} ${n(by)}V${n(by + pasH)}Q${n(w / 2)} ${n(by + pasH * 0.88)} ${n(bx0)} ${n(by + pasH)}Z`, ss), b: 1 });
      const vj = ZE.autoVelikost(T.jmeno || ' ', S, idJ, { sirka: bw * 0.84, vyska: pasH * 0.62, min: 1.6, max: maxJ, radkovani: 1.1, maxRadku: 2 });
      pridej(blok(S, vj, bx0 + bw * 0.08, by + (pasH - vj.vyska) / 2, bw * 0.84, idJ, pal, 'inkoust'));
      if (motto) prvky.push(radek(S, motto, w / 2, iy + ih - vMotto * 0.3, vMotto, iw, 'libserifi', pal.akcent, 2, { prostrkani: 0 }));
      return { w, h, prvky, varovani, papir: pal.papir };
    }
    const vj = jmenoRadky(iw * 0.94, maxJ);
    if (vj.preteka) varovani.push('Jméno je příliš dlouhé, zkraťte ho.');
    const blokJ = vj.vyska + (motto ? vMotto * 2 : 0);
    const yJ = iy + ih - blokJ;
    // středový motiv mezi nápisem a jménem
    const prost = yJ - y - ih * 0.05;
    const vel = Math.min(prost, iw * (komp === 'volna' ? 0.95 : 0.8));
    if (e.stred !== 'nic') pridej(stredovyMotiv(e, w / 2, y + prost / 2, vel, pal, S, obrazky));
    if (komp === 'volna') prvky.push({ s: cesta(`M${n(w / 2 - iw * 0.18)} ${n(yJ - ih * 0.035)}H${n(w / 2 + iw * 0.18)}`, tah(pal.akcent, 0.35)), b: 2 });
    pridej(blok(S, vj, ix, yJ, iw, idJ, pal, 'inkoust', komp === 'volna' ? { prostrkani: 0.06 } : {}));
    if (motto) prvky.push(radek(S, motto, w / 2, yJ + vj.vyska + vMotto * 1.6, vMotto, iw, 'libserifi', pal.akcent, 2, { prostrkani: 0 }));
    return { w, h, prvky, varovani, papir: pal.papir };
  };

  /* Série citátů: řádek = citát, autor za poslední pomlčkou obklopenou mezerami („ – “, „ — “) nebo za „ | “.
     Prázdné řádky se vynechají. Vrací [{text, autor}]. */
  ZE.parsujSerii = function (text) {
    const out = [];
    for (let r of String(text || '').replace(/\r/g, '').split('\n')) {
      r = r.trim();
      if (!r) continue;
      const m = r.match(/^(.*\S)\s+(?:[–—|]|--)\s+([^–—|]+)$/);
      out.push(m ? { text: m[1].trim(), autor: m[2].trim() } : { text: r, autor: '' });
    }
    return out;
  };
  /* Varianty záložky pro sérii: líc s textem a autorem z řádku, ostatní nastavení stejné. */
  ZE.variantySerie = function (z) {
    if (!z.serie) return [];
    return ZE.parsujSerii(z.serieText).map(c => Object.assign({}, z, { lic: Object.assign({}, z.lic, { text: c.text, autor: c.autor || (c.text ? '' : z.lic.autor) }) }));
  };

  /* ================================================================ QR kód */
  /* Matice QR (true = tmavý modul) přes qrcode-generator (lib/qrcode/qrcode.js), UTF-8, oprava M. */
  ZE.qrMatice = function (text) {
    const lib = typeof module !== 'undefined' && module.exports ? require('../lib/qrcode/qrcode.js') : koren.qrcode;
    if (!lib || !String(text || '').trim()) return null;
    lib.stringToBytes = lib.stringToBytesFuncs && lib.stringToBytesFuncs['UTF-8'] || lib.stringToBytes;
    const q = lib(0, 'M');
    q.addData(String(text).trim());
    q.make();
    const N = q.getModuleCount(), m = [];
    for (let r = 0; r < N; r++) { const radek = []; for (let c = 0; c < N; c++) radek.push(q.isDark(r, c)); m.push(radek); }
    return m;
  };
  /* Matice → prvky: světlý čtverec s klidovou zónou 2 moduly a tmavé moduly jako jedna cesta (běhy po řádcích). */
  ZE.qrPrvky = function (mat, x, y, vel, svetla, tmava) {
    const N = mat.length, zona = 2, k = vel / (N + 2 * zona);
    let d = '';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!mat[r][c]) continue;
        let e = c; while (e + 1 < N && mat[r][e + 1]) e++;
        d += `M${n4(x + (zona + c) * k)} ${n4(y + (zona + r) * k)}h${n4((e - c + 1) * k)}v${n4(k)}h${n4(-(e - c + 1) * k)}z`;
        c = e;
      }
    }
    return [{ s: obdelnik(x, y, vel, vel, `fill="${svetla}"`), b: 0 }, { s: `<path d="${d}" fill="${tmava}"/>`, b: 1, qr: true }];
  };
  ZE.jas = function (hex) {
    const m = String(hex || '').match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return 0;
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(parseInt(m[1], 16)) + 0.7152 * lin(parseInt(m[2], 16)) + 0.0722 * lin(parseInt(m[3], 16));
  };

  /* ================================================================ citáty z rukopisu */
  /* Markdown kapitoly → věty vhodné na záložku (bez značek, 25–260 znaků, celé věty). */
  ZE.vetyZTextu = function (md, o) {
    o = o || {};
    const min = o.min || 25, max = o.max || 260;
    const odst = String(md || '').replace(/\r/g, '').split(/\n\s*\n/)
      .map(t => t.replace(/^#+\s.*$/gm, '').replace(/^\s*[>*-]\s+/gm, '').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/[_`]/g, '').replace(/\s+/g, ' ').trim())
      .filter(t => t && t !== '*' && !/^\*+$/.test(t));
    const out = [];
    for (const t of odst) {
      const vety = t.match(/[^.!?…]+(?:[.!?…]+[“”"]?|$)/g) || [];
      for (let v of vety) {
        v = v.trim();
        if (/^[“”"]/.test(v)) v = v.replace(/^[“”"]\s*/, '');
        if (v.length >= min && v.length <= max && /^[„"(A-ZÁ-Ž0-9]/.test(v)) {
          const otevr = (v.match(/„/g) || []).length, zavr = (v.match(/“/g) || []).length;
          if (otevr > zavr) v += '“'; else if (zavr > otevr) v = '„' + v;
          out.push(v);
        }
      }
    }
    return out;
  };

  /* ================================================================ SVG dokument */
  /* volby: spadavka (mm, 0–3), zrcadlit, bezPozadi, orez (ořízne do tvaru kusu se zaoblením – náhled),
     otvor ('znacka' = tenký kroužek k proražení, 'kota' = i popis průměru), obrys (tenká čára řezu), id (předpona id) */
  ZE.svg = function (kus, o) {
    o = o || {};
    const b = omez(cislo(o.spadavka, 0), 0, PRESAH), w = kus.w, h = kus.h, id = o.id || 'ze';
    const vb = [-b, -b, w + 2 * b, h + 2 * b];
    let telo = kus.prvky.filter(p => !(o.bezPozadi && p.pozadi)).map(p => p.s).join('');
    let defs = '';
    if (o.orez) {
      const r = kus.zaobleni || 0;
      defs += `<clipPath id="${id}_o"><rect x="0" y="0" width="${n(w)}" height="${n(h)}" rx="${n(r)}"/></clipPath>`;
      telo = `<g clip-path="url(#${id}_o)">${telo}</g>`;
    }
    if (o.zrcadlit) telo = `<g transform="translate(${n(w)} 0) scale(-1 1)">${telo}</g>`;
    let navic = '';
    if (kus.otvor && o.otvor) {
      const { cx, cy, r } = kus.otvor, c = o.barvaZnacky || '#808080';
      navic += kruh(cx, cy, r, tah(c, 0.12)) + cesta(`M${n(cx - r * 0.5)} ${n(cy)}H${n(cx + r * 0.5)}M${n(cx)} ${n(cy - r * 0.5)}V${n(cy + r * 0.5)}`, tah(c, 0.1));
      if (o.otvor === 'kota') {
        navic += kruh(cx, cy, r, `fill="#ffffff" fill-opacity="0.55" stroke="#d0342c" stroke-width="0.25" stroke-dasharray="0.8 0.5"`);
        navic += cesta(`M${n(cx - r)} ${n(cy)}H${n(cx + r)}`, tah('#d0342c', 0.18));
      }
    }
    if (o.obrys) navic += obdelnik(0, 0, w, h, tah(o.barvaZnacky || '#9a9a9a', 0.1) + (kus.zaobleni ? ` rx="${n(kus.zaobleni)}"` : ''));
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(vb[2])}mm" height="${n(vb[3])}mm" viewBox="${vb.map(n).join(' ')}">`
      + (defs ? `<defs>${defs}</defs>` : '') + telo + navic + '</svg>';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ZE;
  else koren.ZE = ZE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
