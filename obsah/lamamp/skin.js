/* Lamamp – výchozí skin kreslený kódem (WA_SKIN).
   Archy mají rozměry a rozložení bitmap klasického skinu Winampu 2.x (main.bmp, cbuttons.bmp,
   titlebar.bmp…), aby je etapa I mohla nahradit obrázky z .wsz bez změny vykreslování.
   Grafika je vlastní, z originálu se přebírají jen rozměry a souřadnice (rozhraní skinu). */
(function () {
  'use strict';

  const NAZEV = 'LAMAMP';   // nápis v titulní liště

  // ---------- písmo 5×6 (znak nejvýš 5×5, většinou 4 px a mezera) ----------
  const PISMO = {
    A: ['.##.', '#..#', '####', '#..#', '#..#'], B: ['###.', '#..#', '###.', '#..#', '###.'],
    C: ['.###', '#...', '#...', '#...', '.###'], D: ['###.', '#..#', '#..#', '#..#', '###.'],
    E: ['####', '#...', '###.', '#...', '####'], F: ['####', '#...', '###.', '#...', '#...'],
    G: ['.###', '#...', '#.##', '#..#', '.###'], H: ['#..#', '#..#', '####', '#..#', '#..#'],
    I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..##', '...#', '...#', '#..#', '.##.'],
    K: ['#..#', '#.#.', '##..', '#.#.', '#..#'], L: ['#...', '#...', '#...', '#...', '####'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
    O: ['.##.', '#..#', '#..#', '#..#', '.##.'], P: ['###.', '#..#', '###.', '#...', '#...'],
    Q: ['.##.', '#..#', '#..#', '#.#.', '.#.#'], R: ['###.', '#..#', '###.', '#.#.', '#..#'],
    S: ['.###', '#...', '.##.', '...#', '###.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
    U: ['#..#', '#..#', '#..#', '#..#', '.##.'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
    W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#..#', '#..#', '.##.', '#..#', '#..#'],
    Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['####', '...#', '.##.', '#...', '####'],
    '"': ['#.#', '#.#'], '@': ['.##.', '#.##', '#.##', '#...', '.###'],
    0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
    2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '.##', '..#', '###'],
    4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
    6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '..#', '.#.', '.#.'],
    8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '###'],
    '…': ['', '', '', '', '#.#.#'], '.': ['', '', '', '', '#'], ':': ['', '#', '', '#', ''],
    '(': ['.#', '#.', '#.', '#.', '.#'], ')': ['#.', '.#', '.#', '.#', '#.'], '-': ['', '', '###', '', ''],
    "'": ['#', '#'], '!': ['#', '#', '#', '', '#'], '_': ['', '', '', '', '####'],
    '+': ['', '.#.', '###', '.#.', ''], '\\': ['#..', '#..', '.#.', '..#', '..#'], '/': ['..#', '..#', '.#.', '#..', '#..'],
    '[': ['##', '#.', '#.', '#.', '##'], ']': ['##', '.#', '.#', '.#', '##'], '^': ['.#.', '#.#'],
    '&': ['.#..', '#.#.', '.#..', '#.##', '.##.'], '%': ['#..#', '...#', '..#.', '.#..', '#..#'],
    ',': ['', '', '', '.#', '#.'], '=': ['', '###', '', '###', ''], '$': ['.###', '##..', '.##.', '..##', '###.'],
    '#': ['.#.#', '####', '.#.#', '####', '.#.#'],
    'Å': ['.##.', '.##.', '#..#', '####', '#..#'], 'Ö': ['#..#', '.##.', '#..#', '#..#', '.##.'],
    'Ä': ['#..#', '.##.', '#..#', '####', '#..#'], '?': ['###.', '...#', '.##.', '', '.#..'],
    '*': ['', '#.#', '.#.', '#.#', '']
  };
  // rozložení text.bmp (31 buněk 5×6 na řádek); mezera je na řádku 0, sloupci 30
  const RADKY_PISMA = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ"@', '0123456789….:()-\'!_+\\/[]^&%,=$#', 'ÅÖÄ?*'];
  const NAHRADY = { '<': '(', '>': ')', '{': '(', '}': ')', '`': "'", '´': "'", '~': '-', '|': '!', ';': ':', '–': '-', '—': '-', '„': '"', '“': '"', '”': '"', '’': "'" };

  function bunkaZnaku(z) {
    for (let r = 0; r < RADKY_PISMA.length; r++) {
      const i = RADKY_PISMA[r].indexOf(z);
      if (i >= 0) return [i, r];
    }
    return [30, 0];
  }
  // text pro písmo skinu: velká písmena, bez diakritiky (kromě Å Ö Ä, které písmo má)
  function pripravText(t) {
    return [...String(t).toUpperCase()].map(z => {
      if (z === 'Å' || z === 'Ö' || z === 'Ä') return z;
      z = NAHRADY[z] || z.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return z.length === 1 ? z : ' ';
    }).join('');
  }

  // ---------- kreslení po pixelech ----------
  // M = měřítko archů: 1 = klasické pixely; 2+ = HD (vše v plném rozlišení, souřadnice dál v pixelech skinu)
  let M = 1;
  function arch(w, h) {
    const c = document.createElement('canvas'); c.width = w * M; c.height = h * M; c.m = M;
    const g = c.getContext('2d'); g.scale(M, M);
    return { c, g };
  }
  // HD: písmo nápisů a displeje (skutečné písmo místo pixelového)
  const PISMO_NAPISU = '"Verdana","DejaVu Sans","Tahoma",sans-serif';
  const PISMO_DISPLEJE = '"DejaVu Sans Mono","Consolas","Menlo","Courier New",monospace';
  // Scale2x (EPX) nad bitmapou z řádků '#'/'.' – v HD zaoblí šikmé hrany ikon bez rozmazání
  function epx(radky) {
    const w = Math.max(0, ...radky.map(r => r.length)), h = radky.length;
    const p = (x, y) => (x >= 0 && y >= 0 && x < w && y < h && radky[y][x] === '#') ? 1 : 0;
    const out = Array.from({ length: h * 2 }, () => new Array(w * 2).fill('.'));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = p(x, y), A = p(x, y - 1), B = p(x + 1, y), C = p(x - 1, y), D = p(x, y + 1);
      let e0 = P, e1 = P, e2 = P, e3 = P;
      if (A !== D && C !== B) { if (C === A) e0 = A; if (A === B) e1 = B; if (C === D) e2 = C; if (D === B) e3 = D; }
      const z = v => v ? '#' : '.';
      out[y * 2][x * 2] = z(e0); out[y * 2][x * 2 + 1] = z(e1); out[y * 2 + 1][x * 2] = z(e2); out[y * 2 + 1][x * 2 + 1] = z(e3);
    }
    return out.map(r => r.join(''));
  }
  const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  function R(g, x, y, w, h, barva) { g.fillStyle = tema ? barvaTematu(barva) : barva; g.fillRect(x, y, w, h); }

  // ---------- barevné motivy vestavěných skinů ----------
  // Kresba je jedna; motiv přemapuje barvy podle role: neutrální (tělo, rámy, ikony), akcent (zlaté rýhy, nápisy, lama),
  // displej (zelené číslice, text, kontrolky). Černá displejů a červené/žluté signálky zůstávají.
  // telo: h odstín, s sytost (běžná sytost těla ~0,2), l = [k, q] → l' = q + k·l; svetle = tmavé ikony na světlém těle.
  const TEMATA = [
    { id: '', nazev: 'Lamamp' },
    { id: 'grafit', nazev: 'Grafit', telo: { s: 0, l: [1, 0.01] }, akcent: 28, displej: 33,
      pl: { normal: '#ffb030', aktualni: '#ffffff', pozadi: '#0b0b0b', vybrane: '#5a3200' } },
    { id: 'okna98', nazev: 'Okna 98', telo: { h: 0, s: 0, l: [0.55, 0.45] }, svetle: true, akcent: 228, displej: null,
      pl: { normal: '#00e000', aktualni: '#ffffff', pozadi: '#000000', vybrane: '#000080' } },
    { id: 'stribro', nazev: 'Stříbro', telo: { h: 215, s: 0.1, l: [0.6, 0.4] }, svetle: true, akcent: 212, displej: 198,
      pl: { normal: '#7fd8ff', aktualni: '#ffffff', pozadi: '#06121c', vybrane: '#1d4e7a' } },
    { id: 'terminal', nazev: 'Terminál', telo: { h: 130, s: 0.22, l: [0.6, 0] }, akcent: 125, displej: 125,
      pl: { normal: '#33ff66', aktualni: '#d8ffd8', pozadi: '#000000', vybrane: '#0b4a18' } },
    { id: 'jantar', nazev: 'Jantar', telo: { h: 28, s: 0.32, l: [1, 0] }, akcent: 40, displej: 36,
      pl: { normal: '#ffb000', aktualni: '#fff2c8', pozadi: '#0d0700', vybrane: '#5a3200' } },
    { id: 'neon', nazev: 'Neon', telo: { h: 272, s: 0.5, l: [0.9, 0] }, akcent: 318, displej: 186,
      pl: { normal: '#00e5ff', aktualni: '#ff7ae0', pozadi: '#0a0016', vybrane: '#4c0e63' } },
    { id: 'les', nazev: 'Les', telo: { h: 140, s: 0.28, l: [1, 0] }, akcent: 52, displej: 88,
      pl: { normal: '#a8f060', aktualni: '#ffffff', pozadi: '#050d06', vybrane: '#2a4a14' } },
    { id: 'rubin', nazev: 'Rubín', telo: { h: 350, s: 0.42, l: [0.95, 0] }, akcent: 40, displej: 6,
      pl: { normal: '#ff5a5a', aktualni: '#ffe0b0', pozadi: '#100204', vybrane: '#5c0d16' } },
    { id: 'ocean', nazev: 'Oceán', telo: { h: 205, s: 0.5, l: [1, 0] }, akcent: 188, displej: 176,
      pl: { normal: '#40f0e0', aktualni: '#ffffff', pozadi: '#020c14', vybrane: '#0d4660' } }
  ];
  let tema = null;
  const pamet = new Map();
  function rgbNaHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
  }
  const omez01 = v => Math.max(0, Math.min(1, v));
  function mapujRgb(r, g, b) {
    const [h, s, l] = rgbNaHsl(r, g, b);
    if (l < 0.03) return [r, g, b];                                   // černá displejů
    if (s < 0.35 || l > 0.93) {                                       // neutrální: tělo, rámy, ikony, popisky
      const t = tema.telo;
      if (!t) return [r, g, b];
      let l2 = t.l[1] + t.l[0] * l;
      if (tema.svetle && l > 0.74) l2 = 0.12 + (l - 0.74) * 0.6;       // světlé ikony a popisky → tmavé
      return hsl(t.h ?? h, omez01(t.s === 0 ? 0 : s * t.s / 0.2), omez01(l2));
    }
    if (h >= 20 && h < 90) return tema.akcent == null ? [r, g, b] : hsl(tema.akcent, s, tema.svetle ? Math.min(l, 0.5) : l);
    if (h >= 90 && h < 175) return tema.displej == null ? [r, g, b] : hsl(tema.displej, s, l);
    return [r, g, b];
  }
  function barvaTematu(c) {
    if (pamet.has(c)) return pamet.get(c);
    let rgbA = null;
    const m = /^#([0-9a-f]{6})$/i.exec(c), m3 = /^#([0-9a-f]{3})$/i.exec(c), mr = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(String(c).replace(/\s/g, ''));
    if (m) rgbA = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    else if (m3) rgbA = [...m3[1]].map(x => parseInt(x + x, 16));
    else if (mr) rgbA = [+mr[1], +mr[2], +mr[3]];
    const v = rgbA ? rgb(...mapujRgb(...rgbA)) : c;
    pamet.set(c, v);
    return v;
  }
  function bitmapa(g, radky, x, y, barva) {
    if (M > 1) {   // HD: bitmapu 1–2× EPX (podle měřítka), každý bod jako zlomek pixelu skinu
      let r2 = radky, n = 1;
      for (let i = 0; i < (M >= 4 ? 2 : 1); i++) { r2 = epx(r2); n *= 2; }
      r2.forEach((r, j) => {
        for (let i = 0; i < r.length; i++) if (r[i] === '#') R(g, x + i / n, y + j / n, 1 / n, 1 / n, typeof barva === 'function' ? barva(Math.floor(i / n), Math.floor(j / n)) : barva);
      });
      return;
    }
    radky.forEach((r, j) => {
      for (let i = 0; i < r.length; i++) if (r[i] === '#') R(g, x + i, y + j, 1, 1, typeof barva === 'function' ? barva(i, j) : barva);
    });
  }
  const sirkaZnaku = z => Math.max(...(PISMO[z] || ['....']).map(r => r.length));
  // nápis vlastním písmem s proměnnou šířkou znaků (stín volitelně o pixel vpravo dolů)
  function napis(g, text, x, y, barva, stin, mezera = 1) {
    if (M > 1) return napisHD(g, text, x, y, barva, stin, mezera);
    for (const z of pripravText(text)) {
      if (PISMO[z]) {
        if (stin) bitmapa(g, PISMO[z], x + 1, y + 1, stin);
        bitmapa(g, PISMO[z], x, y, barva);
      }
      x += (z === ' ' ? 3 : sirkaZnaku(z)) + mezera;
    }
    return x;
  }
  // HD nápis: každý znak skutečným písmem vycentrovaný do místa, kde by byl pixelový znak (rozvržení zůstává)
  function napisHD(g, text, x, y, barva, stin, mezera) {
    g.save();
    g.font = `bold 6.6px ${PISMO_NAPISU}`; g.textBaseline = 'alphabetic'; g.textAlign = 'center';
    for (const z of pripravText(text)) {
      const w = z === ' ' ? 3 : sirkaZnaku(z);
      if (z !== ' ') {
        const sir = g.measureText(z).width, sx = sir > w + 1.2 ? (w + 1.2) / sir : 1;   // široké znaky (M, W) lehce zúžit
        const kresli = (dx, dy, c) => { g.save(); g.translate(x + w / 2 + dx, y + 5 + dy); g.scale(sx, 1); g.fillStyle = tema ? barvaTematu(c) : c; g.fillText(z, 0, 0); g.restore(); };
        if (stin) kresli(0.5, 0.5, stin);
        kresli(0, 0, barva);
      }
      x += w + mezera;
    }
    g.restore();
    return x;
  }
  const sirkaNapisu = (text, mezera = 1) => [...pripravText(text)].reduce((s, z) => s + (z === ' ' ? 3 : sirkaZnaku(z)) + mezera, -mezera);

  function sum(x, y) {   // deterministický šum 0..1
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  // barva těla okna: tmavý ocelový přechod s jemným kartáčovaným vzorem (vodorovné pruhy)
  function telo(x, y) {
    const X = Math.floor(x * M), Y = Math.floor(y * M);   // šum po pixelech zařízení (v HD jemnější)
    const t = y / 115, n = (sum(0, Y) - 0.5) * 6 + (sum(X, Y) - 0.5) * 3;
    return [64 - 22 * t + n, 64 - 22 * t + n, 90 - 28 * t + n];
  }
  const pametRgb = new Map();
  function mapujRgbRychle(r, g, b) {   // motiv: mapování s pamětí (textura má jen stovky různých barev)
    r = Math.max(0, Math.min(255, r | 0)); g = Math.max(0, Math.min(255, g | 0)); b = Math.max(0, Math.min(255, b | 0));
    const kl = (r << 16) | (g << 8) | b;
    let v = pametRgb.get(kl);
    if (!v) { v = mapujRgb(r, g, b); pametRgb.set(kl, v); }
    return v;
  }
  // výplň po pixelech zařízení: fn dostává souřadnice v pixelech skinu (v HD i zlomky → jemná textura)
  function vypln(g, x0, y0, w, h, fn) {
    const W = Math.round(w * M), H = Math.round(h * M), d = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [r, gg, b] = tema ? mapujRgbRychle(...fn(x / M, y / M)) : fn(x / M, y / M), i = (y * W + x) * 4;
      d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; d.data[i + 3] = 255;
    }
    g.putImageData(d, Math.round(x0 * M), Math.round(y0 * M));
  }
  // podklad spritu, který leží na těle okna na souřadnicích (mx, my)
  const podTelem = (g, x, y, w, h, mx, my) => vypln(g, x, y, w, h, (i, j) => telo(mx + i, my + j));

  const SVETLA = '#8a8aae', TMAVA = '#101018';
  // zkosené tlačítko; stisknuté je tmavší, s obráceným zkosením
  function tlacitko(g, x, y, w, h, stisk, horni = [82, 82, 110], dolni = [50, 50, 72]) {
    for (let j = 0; j < h; j++) R(g, x, y + j, w, 1, rgb(...(stisk ? mix([40, 40, 56], [48, 48, 66], j / h) : mix(horni, dolni, j / (h - 1)))));
    R(g, x, y, w, 1, stisk ? TMAVA : SVETLA); R(g, x, y, 1, h, stisk ? TMAVA : SVETLA);
    R(g, x, y + h - 1, w, 1, stisk ? '#5e5e7c' : TMAVA); R(g, x + w - 1, y, 1, h, stisk ? '#5e5e7c' : TMAVA);
    if (!stisk) { R(g, x + 1, y + h - 2, w - 2, 1, '#2c2c40'); R(g, x + w - 2, y + 1, 1, h - 2, '#2c2c40'); }
  }
  // ikona doprostřed tlačítka (stisknutá o pixel posunutá)
  function ikona(g, radky, x, y, w, h, stisk, barva = '#dcdcec') {
    const iw = Math.max(...radky.map(r => r.length)), ih = radky.length;
    const ix = x + Math.floor((w - iw) / 2) + (stisk ? 1 : 0), iy = y + Math.floor((h - ih) / 2) + (stisk ? 1 : 0);
    if (!stisk) bitmapa(g, radky, ix + 1, iy + 1, '#1a1a28');
    bitmapa(g, radky, ix, iy, stisk ? '#b4b4cc' : barva);
  }
  // trojúhelník šipky: výška v, směr 'p' vpravo, 'l' vlevo
  function sipka(v, smer) {
    const s = (v + 1) / 2, out = [];
    for (let j = 0; j < v; j++) {
      const d = Math.min(j, v - 1 - j) + 1;
      out.push(smer === 'p' ? '#'.repeat(d) + '.'.repeat(s - d) : '.'.repeat(s - d) + '#'.repeat(d));
    }
    return out;
  }
  const vedle = (...casti) => casti[0].map((_, j) => casti.map(c => c[j]).join(''));
  const sloupec = (w, h, z = '#') => Array(h).fill(z.repeat(w));

  // titulní lišta okna: přechod, rám, zlaté rýhy po stranách nápisu (nebo v zadaných úsecích)
  function lista(g, x0, y, w, akt, nazev, useky) {
    for (let j = 0; j < 14; j++) R(g, x0, y + j, w, 1, rgb(...mix(akt ? [96, 96, 134] : [74, 74, 88], akt ? [42, 42, 64] : [40, 40, 50], j / 13)));
    R(g, x0, y, w, 1, '#06060a'); R(g, x0, y, 1, 14, '#06060a'); R(g, x0 + w - 1, y, 1, 14, '#06060a');
    R(g, x0 + 1, y + 1, w - 2, 1, akt ? '#a4a4cc' : '#80808e'); R(g, x0 + 1, y + 1, 1, 13, akt ? '#a4a4cc' : '#80808e');
    R(g, x0 + w - 2, y + 1, 1, 13, '#1c1c28');
    const sn = nazev ? sirkaNapisu(nazev, 2) : 0, tx = Math.round((w - sn) / 2);
    useky = useky || [[18, tx - 6], [tx + sn + 5, w - 35]];
    for (const [a, b] of useky) rydy(g, x0 + a, y, b - a, akt);
    if (nazev) napis(g, nazev, x0 + tx, y + 4, akt ? '#fde7a2' : '#a6a6b4', '#141420', 2);
  }
  function rydy(g, x, y, w, akt) {
    for (const r of [4, 6, 8]) {
      R(g, x, y + r, w, 1, akt ? 'rgb(226,190,98)' : 'rgb(116,116,132)');
      R(g, x, y + r + 1, w, 1, akt ? '#24243a' : '#2a2a34');
    }
  }

  // ---------- jednotlivé archy ----------
  function kresliMain() {
    const { c, g } = arch(275, 116);
    vypln(g, 0, 0, 275, 116, telo);
    // rám okna
    R(g, 0, 0, 275, 1, '#06060a'); R(g, 0, 0, 1, 116, '#06060a'); R(g, 0, 115, 275, 1, '#06060a'); R(g, 274, 0, 1, 116, '#06060a');
    R(g, 1, 1, 273, 1, '#7c7ca0'); R(g, 1, 1, 1, 114, '#7c7ca0'); R(g, 1, 114, 273, 1, '#1c1c28'); R(g, 273, 1, 1, 114, '#1c1c28');
    // zapuštěné displeje
    const panel = (x, y, w, h) => {
      R(g, x - 1, y - 1, w + 2, 1, '#14141e'); R(g, x - 1, y - 1, 1, h + 2, '#14141e');
      R(g, x - 1, y + h, w + 2, 1, '#74749a'); R(g, x + w, y - 1, 1, h + 2, '#74749a');
      R(g, x, y, w, h, '#000');
    };
    panel(10, 22, 95, 43);    // LCD: přepínače, čas, vizualizace
    panel(110, 24, 156, 12);  // titulek skladby
    panel(110, 41, 17, 10);   // kbps
    panel(155, 41, 12, 10);   // kHz
    // dvojtečka času (je součástí podkladu jako v originále)
    R(g, 72, 30, 2, 2, '#2ce02c'); R(g, 72, 34, 2, 2, '#1aa01a');
    // vyryté popisky
    napis(g, 'kbps', 129, 43, '#b4b4d0', '#1a1a26');
    napis(g, 'khz', 169, 43, '#b4b4d0', '#1a1a26');
    // lama místo loga
    const lama = ['...#..#......', '...#..#......', '...####......', '..######.....', '..##.####....', '..#########..',
      '..##########.', '...#######...', '...#####.....', '...#####.....', '...#####.....', '...######....',
      '..#######....', '..########...', '..#########..'];
    bitmapa(g, lama, 254, 92, '#121218');
    bitmapa(g, lama, 253, 91, (i, j) => rgb(...mix([250, 222, 140], [176, 128, 52], j / 14)));
    return c;
  }

  function kresliTitlebar() {
    const { c, g } = arch(344, 87);
    lista(g, 27, 0, 275, true, NAZEV); lista(g, 27, 15, 275, false, NAZEV);
    // zmenšené okno (windowshade): mřížka vlevo, okénko času, mini tlačítka 169–225, místo pro mini pozici 226–243
    for (const [y, akt] of [[29, true], [42, false]]) {
      lista(g, 27, y, 275, akt, '', [[18, 120]]);
      R(g, 27 + 125, y + 3, 28, 8, '#000'); R(g, 27 + 124, y + 2, 30, 1, '#14141e'); R(g, 27 + 124, y + 11, 30, 1, '#74749a');
      const bar = sloupec(1, 5), mez = sloupec(1, 5, '.');
      const mini = [[169, vedle(bar, sipka(5, 'l'))], [178, sipka(5, 'p').map(r => r + '.')], [188, vedle(bar, mez, bar)],
        [197, sloupec(4, 4)], [206, vedle(sipka(5, 'p'), bar)], [216, ['..#..', '.###.', '#####', '', '#####']]];
      for (const [x, ik] of mini) bitmapa(g, ik, 27 + x + 1, y + 4, akt ? '#e8e8f4' : '#a0a0b0');
    }
    // mini pozice ve zmenšeném okně: podklad 17×7 (0,36), jezdec 3×7 (20,36), u kraje (17,36)/(23,36)
    R(g, 0, 36, 17, 7, '#08080e'); R(g, 1, 38, 15, 3, '#2a2a3c');
    for (const x of [17, 20, 23]) { R(g, x, 36, 3, 7, '#c8c8dc'); R(g, x, 42, 3, 1, '#50506a'); }
    // tlačítka lišty 9×9
    const ik = {
      moznosti: ['###', '.#.'], minimalizovat: ['', '', '', '#####'], zavrit: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
      stin: ['#####', '#####', '', ''], stinZpet: ['', '', '#####', '#####']
    };
    const tl = (x, y, radky, stisk) => { tlacitko(g, x, y, 9, 9, stisk); ikona(g, radky, x, y, 9, 9, stisk); };
    tl(0, 0, ik.moznosti, false); tl(0, 9, ik.moznosti, true);
    tl(9, 0, ik.minimalizovat, false); tl(9, 9, ik.minimalizovat, true);
    tl(18, 0, ik.zavrit, false); tl(18, 9, ik.zavrit, true);
    tl(0, 18, ik.stin, false); tl(9, 18, ik.stin, true);
    tl(0, 27, ik.stinZpet, false); tl(9, 27, ik.stinZpet, true);
    // clutterbar O A I D V (x304), vypnutý (x312), stisknuté kousky na y 44+
    const PISMENA = [['O', 3, 8], ['A', 11, 7], ['I', 18, 7], ['D', 25, 8], ['V', 33, 7]];
    function clutter(x, stav) {
      R(g, x, 0, 8, 43, '#0c0c14');
      R(g, x + 7, 0, 1, 43, '#3a3a52');
      for (const [p, y0, h] of PISMENA) {
        R(g, x + 1, y0, 6, h - 1, stav === 'vyp' ? '#16161e' : '#20202e');
        napis(g, p, x + Math.floor((7 - sirkaZnaku(p)) / 2), y0 + Math.floor((h - 5) / 2), stav === 'vyp' ? '#3a3a48' : '#9a9ab8');
      }
    }
    clutter(304, 'zap'); clutter(312, 'vyp');
    PISMENA.forEach(([p, y0, h], i) => {
      const x = 304 + i * 8, y = 44 + y0;
      R(g, x, y, 8, h, '#0c0c14'); R(g, x + 1, y, 6, h - 1, '#1e3a1e');
      napis(g, p, x + Math.floor((7 - sirkaZnaku(p)) / 2), y + Math.floor((h - 5) / 2), '#5cff5c');
    });
    return c;
  }

  function kresliCbuttons() {
    const { c, g } = arch(136, 36);
    const play = sipka(9, 'p'), pauza = vedle(sloupec(3, 8), sloupec(2, 8, '.'), sloupec(3, 8));
    const stop = sloupec(8, 8), bar = sloupec(2, 7), mez = sloupec(1, 7, '.');
    const pred = vedle(bar, mez, sipka(7, 'l'), sipka(7, 'l')), dalsi = vedle(sipka(7, 'p'), sipka(7, 'p'), mez, bar);
    const vysun = [...sipka(9, 'p').slice(0, 5).map((_, j) => '.'.repeat(4 - j) + '#'.repeat(2 * j + 1) + '.'.repeat(4 - j)), '', '#########', '#########'];
    const TL = [[0, 23, pred], [23, 23, play], [46, 23, pauza], [69, 23, stop], [92, 22, dalsi]];
    for (const [x, w, ik] of TL) for (const stisk of [false, true]) {
      const y = stisk ? 18 : 0;
      tlacitko(g, x, y, w, 18, stisk); ikona(g, ik, x, y, w, 18, stisk);
    }
    for (const stisk of [false, true]) { const y = stisk ? 16 : 0; tlacitko(g, 114, y, 22, 16, stisk); ikona(g, vysun, 114, y, 22, 16, stisk); }
    return c;
  }

  function kresliNumbers() {
    const { c, g } = arch(99, 13);
    // sedmisegmentové číslice 9×13: a nahoře, b c vpravo, d dole, e f vlevo, g uprostřed (řádky 5–6 – z nich se bere i znaménko minus)
    const SEG = { a: [2, 0, 5, 2], b: [6, 1, 2, 5], c: [6, 6, 2, 5], d: [2, 10, 5, 2], e: [1, 6, 2, 5], f: [1, 1, 2, 5], g: [2, 5, 5, 2] };
    const CIF = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
    const barva = y => rgb(...mix([150, 255, 120], [14, 168, 14], y / 11));
    if (M > 1) {   // HD: segmenty jako šestiúhelníky se šikmými konci a svislým přechodem
      const gr = g.createLinearGradient(0, 0, 0, 12);
      for (let i = 0; i <= 4; i++) gr.addColorStop(i / 4, tema ? barvaTematu(barva(i * 11 / 4)) : barva(i * 11 / 4));
      const vod = (a, b, c) => [[a, c], [a + 1, c - 1], [b - 1, c - 1], [b, c], [b - 1, c + 1], [a + 1, c + 1]];
      const svi = (c, a, b) => [[c, a], [c + 1, a + 1], [c + 1, b - 1], [c, b], [c - 1, b - 1], [c - 1, a + 1]];
      const TVAR = { a: vod(2.25, 6.75, 1), g: vod(2.25, 6.75, 6), d: vod(2.25, 6.75, 11),
        f: svi(2, 1.25, 5.75), b: svi(7, 1.25, 5.75), e: svi(2, 6.25, 10.75), c: svi(7, 6.25, 10.75) };
      g.fillStyle = gr;
      CIF.forEach((segs, n) => {
        for (const sg of segs) {
          g.beginPath(); TVAR[sg].forEach(([x, y], i) => i ? g.lineTo(n * 9 + x, y) : g.moveTo(n * 9 + x, y)); g.closePath(); g.fill();
        }
      });
      return c;
    }
    CIF.forEach((segs, n) => {
      for (const s of segs) {
        const [x, y, w, h] = SEG[s];
        for (let j = 0; j < h; j++) R(g, n * 9 + x, y + j, w, 1, barva(y + j));
      }
    });
    return c;
  }

  function kresliText() {
    const { c, g } = arch(155, 18);
    R(g, 0, 0, 155, 18, '#000');
    RADKY_PISMA.forEach((radek, r) => [...radek].forEach((z, i) => bitmapa(g, PISMO[z] || [], i * 5, r * 6, '#16e616')));
    return c;
  }

  function kresliPlaypaus() {
    const { c, g } = arch(42, 9);
    bitmapa(g, sipka(9, 'p'), 2, 0, '#3cff3c');
    bitmapa(g, vedle(sloupec(2, 7), sloupec(1, 7, '.'), sloupec(2, 7)), 11, 1, '#f0d040');
    bitmapa(g, sloupec(6, 6), 19, 1, '#1aa01a');
    R(g, 37, 1, 1, 7, '#c02020'); R(g, 40, 1, 1, 7, '#3cff3c');
    return c;
  }

  function kresliMonoster() {
    const { c, g } = arch(56, 24);
    // podklad odpovídá tělu okna na místě nápisů (stereo 239,41 – mono 212,41)
    for (const y of [0, 12]) { podTelem(g, 0, y, 29, 12, 239, 41); podTelem(g, 29, y, 27, 12, 212, 41); }
    napis(g, 'STEREO', 0, 3, '#40ff40', '#0a3a0a'); napis(g, 'MONO', 29 + 4, 3, '#40ff40', '#0a3a0a');
    napis(g, 'STEREO', 0, 15, '#24243a', '#56567a'); napis(g, 'MONO', 29 + 4, 15, '#24243a', '#56567a');
    return c;
  }

  // jezdec (palec) posuvníku s vroubkováním
  function jezdec(g, x, y, w, h, svetly) {
    tlacitko(g, x, y, w, h, false, svetly ? [130, 130, 166] : [96, 96, 128], svetly ? [76, 76, 104] : [56, 56, 80]);
    const s = x + Math.floor(w / 2) - 2;
    for (const dx of [0, 2, 4]) { R(g, s + dx, y + 3, 1, h - 6, '#e0e0f0'); R(g, s + dx + 1, y + 3, 1, h - 6, '#26263a'); }
  }
  function zlab(g, x, y, w, h, barvaVnitrku) {
    R(g, x, y, w, 1, '#08080e'); R(g, x, y, 1, h, '#08080e');
    R(g, x, y + h - 1, w, 1, '#6c6c90'); R(g, x + w - 1, y, 1, h, '#6c6c90');
    for (let j = 1; j < h - 1; j++) R(g, x + 1, y + j, w - 2, 1, barvaVnitrku(j));
  }

  function kresliPosbar() {
    const { c, g } = arch(307, 10);
    podTelem(g, 0, 0, 248, 10, 16, 72);
    zlab(g, 0, 2, 248, 6, () => '#181824');
    jezdec(g, 248, 0, 29, 10, false); jezdec(g, 278, 0, 29, 10, true);
    return c;
  }

  // 28 stupňů pozadí po 15 px; barva zlabu od zelené (0) po červenou (27)
  function stupne(g, x, w, mx) {
    for (let i = 0; i < 28; i++) {
      const y = i * 15, f = i / 27;
      podTelem(g, x, y, w, 13, mx, 57);
      const [r, gg, b] = hsl(120 - 120 * f, 0.78, 0.36);
      zlab(g, x, y + 3, w, 7, j => rgb(...mix([r, gg, b], [r * 0.45, gg * 0.45, b * 0.45], (j - 1) / 4)));
    }
    jezdec(g, 15, 422, 14, 11, false); jezdec(g, 0, 422, 14, 11, true);
  }
  function hsl(h, s, l) {
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    return [0, 8, 4].map(n => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  }
  function kresliVolume() { const { c, g } = arch(68, 433); stupne(g, 0, 68, 107); return c; }
  function kresliBalance() { const { c, g } = arch(47, 433); stupne(g, 9, 38, 177); return c; }

  function kresliShufrep() {
    const { c, g } = arch(92, 85);
    // kontrolka 4×6 v zapuštěném rámečku; rozsvícená má světlý odlesk
    const led = (x, y, w, h, zap) => {
      R(g, x, y, w, h, '#06060a');
      R(g, x + 1, y + 1, w - 2, h - 2, zap ? '#2ee82e' : '#183018');
      if (zap) { R(g, x + 1, y + 1, w - 2, 1, '#c8ffc8'); R(g, x + 1, y + 2, 1, h - 3, '#8cff8c'); }
    };
    const smycka = ['......#....', '.#########.', '#.....#...#', '#.........#', '#.........#', '#.........#',
      '#...#.....#', '.#########.', '....#......'];
    // [x, y, vybraný, stisknutý] pro řádky 0/15/30/45
    for (const [y, vyb, st] of [[0, false, false], [15, false, true], [30, true, false], [45, true, true]]) {
      const d = st ? 1 : 0;
      tlacitko(g, 0, y, 28, 15, st); led(3 + d, y + 4 + d, 5, 7, vyb);
      bitmapa(g, smycka, 13 + d, y + 3 + d, st ? '#b4b4cc' : '#dcdcec');
      tlacitko(g, 28, y, 47, 15, st); led(28 + 3 + d, y + 4 + d, 5, 7, vyb);
      napis(g, 'SHUFFLE', 28 + 10 + d, y + 5 + d, st ? '#b4b4cc' : '#dcdcec', st ? null : '#1a1a28');
    }
    // EQ a PL: normální y61, vybrané y73; stisknuté o 46 px vpravo
    for (const [x0, txt] of [[0, 'EQ'], [23, 'PL']]) for (const [dx, st] of [[0, false], [46, true]]) for (const [y, vyb] of [[61, false], [73, true]]) {
      const x = x0 + dx, d = st ? 1 : 0;
      tlacitko(g, x, y, 23, 12, st); led(x + 3 + d, y + 3 + d, 5, 6, vyb);
      napis(g, txt, x + 10 + d, y + 4 + d, st ? '#b4b4cc' : '#dcdcec', st ? null : '#1a1a28');
    }
    return c;
  }


  // ---------- ekvalizér (eqmain.bmp 275×315, eq_ex.bmp 275×56) ----------
  const EQ_PASMA = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
  function kresliEqmain() {
    const { c, g } = arch(275, 315);
    vypln(g, 0, 0, 275, 116, telo);
    R(g, 0, 0, 275, 1, '#06060a'); R(g, 0, 0, 1, 116, '#06060a'); R(g, 0, 115, 275, 1, '#06060a'); R(g, 274, 0, 1, 116, '#06060a');
    R(g, 1, 1, 273, 1, '#7c7ca0'); R(g, 1, 1, 1, 114, '#7c7ca0'); R(g, 1, 114, 273, 1, '#1c1c28'); R(g, 273, 1, 1, 114, '#1c1c28');
    // rámeček grafu
    R(g, 85, 16, 115, 1, '#14141e'); R(g, 85, 16, 1, 21, '#14141e'); R(g, 85, 36, 115, 1, '#74749a'); R(g, 199, 16, 1, 21, '#74749a');
    // stupnice dB mezi preampem a pásmy, popisky pásem
    const sv = '#b4b4d0', st = '#1a1a26';
    napis(g, '+12DB', 74 - sirkaNapisu('+12DB'), 40, sv, st);
    napis(g, '+0DB', 74 - sirkaNapisu('+0DB'), 67, sv, st);
    napis(g, '-12DB', 74 - sirkaNapisu('-12DB'), 94, sv, st);
    napis(g, 'PREAMP', 28 - Math.floor(sirkaNapisu('PREAMP') / 2), 104, sv, st);
    EQ_PASMA.forEach((t, i) => napis(g, t, 78 + i * 18 + 7 - Math.floor(sirkaNapisu(t) / 2), 104, sv, st));
    // titulní lišta (aktivní y134, neaktivní y149) s tlačítky zmenšit (254) a zavřít (264)
    for (const [y, akt] of [[134, true], [149, false]]) {
      lista(g, 0, y, 275, akt, 'EQUALIZER');
      for (const [x, ik] of [[254, ['#####', '#####', '', '']], [264, ['#...#', '.#.#.', '..#..', '.#.#.', '#...#']]]) {
        tlacitko(g, x, y + 3, 9, 9, false); ikona(g, ik, x, y + 3, 9, 9, false);
      }
    }
    // zavřít: normální (0,116), stisknuté (0,125)
    const x5 = ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'];
    tlacitko(g, 0, 116, 9, 9, false); ikona(g, x5, 0, 116, 9, 9, false);
    tlacitko(g, 0, 125, 9, 9, true); ikona(g, x5, 0, 125, 9, 9, true);
    // ON 26×12 a AUTO 32×12: normální / vybrané / stisknuté / vybrané+stisknuté
    const led = (x, y, zap) => { R(g, x, y, 5, 6, '#06060a'); R(g, x + 1, y + 1, 3, 4, zap ? '#2ee82e' : '#183018'); if (zap) R(g, x + 1, y + 1, 3, 1, '#c8ffc8'); };
    for (const [x, w, t, sx] of [[10, 26, 'ON', [10, 69, 128, 187]], [36, 32, 'AUTO', [36, 95, 164, 223]]]) {
      sx.forEach((xx, i) => {
        const vyb = i === 1 || i === 3, stisk = i >= 2, d = stisk ? 1 : 0;
        tlacitko(g, xx, 119, w, 12, stisk); led(xx + 3 + d, 122 + d, vyb);
        napis(g, t, xx + 10 + d, 123 + d, stisk ? '#b4b4cc' : '#dcdcec', stisk ? null : '#1a1a28');
      });
    }
    // 28 podkladů jezdce 14×63: žlab, barva podle hodnoty (zelená dole → červená nahoře)
    for (let i = 0; i < 28; i++) {
      const x = 13 + (i % 14) * 15, y = 164 + Math.floor(i / 14) * 65;
      podTelem(g, x, y, 14, 63, 78, 38);
      const [r, gg, b] = hsl(120 - 120 * (i / 27), 0.78, 0.36);
      R(g, x + 5, y + 1, 4, 61, '#08080e'); R(g, x + 9, y + 1, 1, 61, '#6c6c90'); R(g, x + 5, y + 62, 5, 1, '#6c6c90');
      for (let j = 2; j < 61; j++) R(g, x + 6, y + j, 3, 1, rgb(...mix([r, gg, b], [r * 0.4, gg * 0.4, b * 0.4], (j - 2) / 58)));
      R(g, x + 1, y + 31, 3, 1, '#9a9ab8'); R(g, x + 10, y + 31, 3, 1, '#9a9ab8');   // ryska 0 dB
    }
    jezdec(g, 0, 164, 11, 11, false); jezdec(g, 0, 176, 11, 11, true);
    // PRESETS 44×12 (normální 224,164 / stisknuté 224,176)
    for (const [y, st] of [[164, false], [176, true]]) {
      tlacitko(g, 224, y, 44, 12, st);
      napis(g, 'PRESETS', 224 + Math.floor((44 - sirkaNapisu('PRESETS')) / 2) + (st ? 1 : 0), y + 4 + (st ? 1 : 0), st ? '#b4b4cc' : '#dcdcec', st ? null : '#1a1a28');
    }
    // graf: podklad 113×19 (0,294), barvy čáry po řádcích (115,294), čára preampu (0,314)
    R(g, 0, 294, 113, 19, '#000');
    for (let x = 0; x < 113; x += 2) R(g, x, 294 + 9, 1, 1, '#2a3a2a');
    for (let j = 0; j < 19; j++) {
      const [r, gg, b] = hsl(120 * (j / 18), 0.85, 0.5);   // nahoře červená, uprostřed žlutá, dole zelená
      R(g, 115, 294 + j, 1, 1, rgb(r, gg, b));
    }
    for (let x = 0; x < 113; x += 2) R(g, x, 314, 1, 1, '#c8c8dc');
    return c;
  }
  function kresliEqEx() {
    const { c, g } = arch(275, 56);
    for (const [y, akt] of [[0, true], [15, false]]) {
      lista(g, 0, y, 275, akt, 'EQUALIZER', [[18, 100], [176, 240]]);
      for (const [x, ik] of [[254, ['', '', '#####', '#####']], [264, ['#...#', '.#.#.', '..#..', '.#.#.', '#...#']]]) {
        tlacitko(g, x, y + 3, 9, 9, false); ikona(g, ik, x, y + 3, 9, 9, false);
      }
    }
    return c;
  }

  // ---------- playlist (pledit.bmp 280×186) ----------
  function kresliPledit() {
    const { c, g } = arch(280, 186);
    const telo2 = (x, y, w, h) => vypln(g, x, y, w, h, (i, j) => telo(i * 3 + x, 40 + j));
    // horní pás 20 px skládaný z dílů: boční rám jen na vnějších krajích, aby mezi dlaždicemi nebyly švy
    const pas = (x, y, w, akt) => {
      for (let j = 0; j < 14; j++) R(g, x, y + j, w, 1, rgb(...mix(akt ? [96, 96, 134] : [74, 74, 88], akt ? [42, 42, 64] : [40, 40, 50], j / 13)));
      R(g, x, y, w, 1, '#06060a'); R(g, x, y + 1, w, 1, akt ? '#a4a4cc' : '#80808e');
      telo2(x, y + 14, w, 6);
      R(g, x, y + 19, w, 1, '#14141e');
    };
    for (const [y, akt] of [[0, true], [21, false]]) {
      pas(0, y, 25, akt); pas(26, y, 100, akt); pas(127, y, 25, akt); pas(153, y, 25, akt);
      // levý a pravý vnější rám
      R(g, 0, y, 1, 20, '#06060a'); R(g, 1, y + 1, 1, 19, akt ? '#a4a4cc' : '#80808e'); R(g, 1, y + 14, 1, 5, '#7c7ca0');
      R(g, 177, y, 1, 20, '#06060a'); R(g, 176, y + 1, 1, 13, '#1c1c28');
      rydy(g, 4, y, 21, akt); rydy(g, 127, y, 25, akt); rydy(g, 153, y, 4, akt);
      const sn = sirkaNapisu('PLAYLIST', 2), tx = 26 + Math.round((100 - sn) / 2);
      rydy(g, 26, y, tx - 26 - 5, akt); rydy(g, tx + sn + 5, y, 126 - (tx + sn + 5), akt);
      napis(g, 'PLAYLIST', tx, y + 4, akt ? '#fde7a2' : '#a6a6b4', '#141420', 2);
      for (const [x, ik] of [[158, ['#####', '#####', '', '']], [167, ['#...#', '.#.#.', '..#..', '.#.#.', '#...#']]]) {
        tlacitko(g, x, y + 3, 9, 9, false); ikona(g, ik, x, y + 3, 9, 9, false);
      }
    }
    // boční dlaždice: levá 12×29 (0,42), pravá 20×29 se žlabem posuvníku (31,42)
    telo2(0, 42, 12, 29); R(g, 0, 42, 1, 29, '#06060a'); R(g, 1, 42, 1, 29, '#7c7ca0'); R(g, 11, 42, 1, 29, '#14141e');
    telo2(31, 42, 20, 29); R(g, 50, 42, 1, 29, '#06060a'); R(g, 31, 42, 1, 29, '#74749a');
    R(g, 36, 42, 8, 29, '#0c0c14'); R(g, 44, 42, 1, 29, '#54546e');
    // zavřít / zmenšit stisknuté (52,42) (62,42), rozbalit (150,42)
    tlacitko(g, 52, 42, 9, 9, true); ikona(g, ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], 52, 42, 9, 9, true);
    tlacitko(g, 62, 42, 9, 9, true); ikona(g, ['#####', '#####', '', ''], 62, 42, 9, 9, true);
    tlacitko(g, 150, 42, 9, 9, true); ikona(g, ['', '', '#####', '#####'], 150, 42, 9, 9, true);
    // jezdec posuvníku 8×18 (52,53) a stisknutý (61,53)
    jezdec(g, 52, 53, 8, 18, false); jezdec(g, 61, 53, 8, 18, true);
    // zmenšený playlist: levý kus (72,42), dlaždice (72,57), pravý kus 50 (99,57) / aktivní (99,42)
    for (const [y, akt] of [[42, true], [57, false]]) {
      lista(g, 72, y, 25, akt, '', [[4, 25]]);
      lista(g, 99, y, 50, akt, '', [[2, 26]]);
      for (const [x, ik] of [[99 + 32, ['', '', '#####', '#####']], [99 + 41, ['#...#', '.#.#.', '..#..', '.#.#.', '#...#']]]) {
        tlacitko(g, x, y + 3, 9, 9, false); ikona(g, ik, x, y + 3, 9, 9, false);
      }
    }
    for (let j = 0; j < 14; j++) R(g, 72, 57 + j, 25, 1, rgb(...mix([74, 74, 88], [40, 40, 50], j / 13)));
    R(g, 72, 57, 25, 1, '#06060a'); rydy(g, 72, 57, 25, false);
    // spodní dlaždice 25×38 (179,0)
    telo2(179, 0, 25, 38); R(g, 179, 0, 25, 1, '#74749a'); R(g, 179, 37, 25, 1, '#06060a'); R(g, 179, 36, 25, 1, '#1c1c28');
    // spodní levý roh 125×38 (0,72): tlačítka ADD REM SEL MISC na (14,8) (43,8) (72,8) (101,8)
    telo2(0, 72, 125, 38); R(g, 0, 72, 125, 1, '#74749a'); R(g, 0, 109, 125, 1, '#06060a'); R(g, 0, 72, 1, 38, '#06060a'); R(g, 1, 73, 1, 36, '#7c7ca0');
    R(g, 0, 108, 125, 1, '#1c1c28');
    const tlText = (x, y, t, st) => { tlacitko(g, x, y, 22, 18, st); napis(g, t, x + Math.floor((22 - sirkaNapisu(t)) / 2) + (st ? 1 : 0), y + 7 + (st ? 1 : 0), st ? '#b4b4cc' : '#dcdcec', st ? null : '#1a1a28'); };
    [['ADD', 14], ['REM', 43], ['SEL', 72], ['MISC', 101]].forEach(([t, x]) => tlText(x, 72 + 8, t, false));
    // spodní pravý roh 150×38 (126,72): okénko času, mini tlačítka, LIST, úchyt pro změnu velikosti
    const px = 126, py = 72;
    telo2(px, py, 150, 38); R(g, px, py, 150, 1, '#74749a'); R(g, px, py + 37, 150, 1, '#06060a'); R(g, px + 149, py, 1, 38, '#06060a');
    R(g, px + 148, py + 1, 1, 36, '#1c1c28'); R(g, px, py + 36, 149, 1, '#1c1c28');
    R(g, px + 6, py + 9, 92, 8, '#000'); R(g, px + 5, py + 8, 94, 1, '#14141e'); R(g, px + 5, py + 17, 94, 1, '#74749a');
    R(g, px + 64, py + 21, 28, 9, '#000'); R(g, px + 63, py + 20, 30, 1, '#14141e'); R(g, px + 63, py + 30, 30, 1, '#74749a');
    const bar = sloupec(1, 5), mez = sloupec(1, 5, '.');
    for (const [x, ik] of [[6, vedle(bar, sipka(5, 'l'))], [15, sipka(5, 'p')], [24, vedle(bar, mez, bar)], [33, sloupec(4, 4)], [42, vedle(sipka(5, 'p'), bar)], [51, ['..#..', '.###.', '#####', '', '#####']]]) {
      bitmapa(g, ik, px + x + 2, py + 23, '#141420'); bitmapa(g, ik, px + x + 1, py + 22, '#dcdcec');
    }
    tlText(px + 106, py + 8, 'LIST', false);
    for (let i = 0; i < 4; i++) for (let j = 0; j <= i; j++) { R(g, px + 144 - j * 3, py + 24 + i * 3, 2, 1, '#9a9ab8'); R(g, px + 144 - j * 3, py + 25 + i * 3, 2, 1, '#14141e'); }
    // vizualizační plocha 75×38 (205,0) – u širokého okna
    telo2(205, 0, 75, 38); R(g, 205, 0, 75, 1, '#74749a'); R(g, 205, 37, 75, 1, '#06060a');
    R(g, 205 + 6, 6, 63, 26, '#000'); R(g, 205 + 5, 5, 65, 1, '#14141e'); R(g, 205 + 5, 32, 65, 1, '#74749a');
    // nabídky tlačítek (22×18, vybrané o 23 px vpravo) a svislé lišty nabídek
    const NAB = [[0, ['URL', 'DIR', 'FILE'], 48], [54, ['ALL', 'CROP', 'SEL', 'MISC'], 100], [104, ['INV', 'NONE', 'ALL'], 150], [154, ['SORT', 'INFO', 'OPTS'], 200], [204, ['NEW', 'SAVE', 'LOAD'], 250]];
    for (const [x, polozky, lx] of NAB) {
      polozky.forEach((t, i) => { tlText(x, 111 + i * 19, t, false); tlText(x + 23, 111 + i * 19, t, true); });
      const h = polozky.length * 18;
      R(g, lx, 111, 3, h, '#c8b060'); R(g, lx + 1, 111, 1, h, '#fde7a2');
    }
    return c;
  }

  // výchozí barvy vizualizace (viscolor.txt: 0 pozadí, 1 tečky, 2–17 spektrum shora dolů, 18–22 osciloskop, 23 vrcholky)
  const VISCOLOR = [[0, 0, 0], [24, 33, 41], [239, 49, 16], [206, 41, 16], [214, 90, 0], [214, 102, 0], [214, 115, 0], [198, 123, 8],
    [222, 165, 24], [214, 181, 33], [189, 222, 41], [148, 222, 33], [41, 206, 16], [50, 190, 16], [57, 181, 16], [49, 156, 8],
    [41, 148, 0], [24, 132, 8], [255, 255, 255], [214, 214, 222], [181, 189, 189], [160, 170, 175], [148, 156, 165], [150, 150, 150]];
  const PLEDIT = { normal: '#00ff00', aktualni: '#ffffff', pozadi: '#000000', vybrane: '#0000c6', pismo: 'Arial' };

  // vestavěný skin v daném motivu; archy se kreslí jednou a pamatují (volající dostane vlastní kopii barev)
  // m = měřítko archů (1 = pixely, 2+ = HD v plném rozlišení obrazovky)
  const hotove = new Map();
  function vychozi(idTematu = '', m = 1) {
    const t = TEMATA.find(x => x.id === idTematu) || TEMATA[0];
    m = Math.max(1, Math.min(8, Math.round(m) || 1));
    const klic = t.id + '|' + m;
    if (!hotove.has(klic)) {
      tema = t.id ? t : null; pamet.clear(); pametRgb.clear(); M = m;
      try {
        hotove.set(klic, {
          main: kresliMain(), titlebar: kresliTitlebar(), cbuttons: kresliCbuttons(), numbers: kresliNumbers(),
          text: kresliText(), playpaus: kresliPlaypaus(), monoster: kresliMonoster(), posbar: kresliPosbar(),
          volume: kresliVolume(), balance: kresliBalance(), shufrep: kresliShufrep(),
          eqmain: kresliEqmain(), eq_ex: kresliEqEx(), pledit: kresliPledit()
        });
        // barvy pro HD vykreslování (text displeje, čára grafu EQ) v barvách motivu
        const h = hotove.get(klic);
        h.lcd = tema ? barvaTematu('#16e616') : '#16e616';
        h.eqCara = [0, 9, 18].map(j => { const c = rgb(...hsl(120 * (j / 18), 0.85, 0.5)); return tema ? barvaTematu(c) : c; });
      } finally { tema = null; pamet.clear(); pametRgb.clear(); M = 1; }
    }
    const h = hotove.get(klic);
    return Object.assign({}, h, {
      barvy: { vis: VISCOLOR.map(c => rgb(...c)), pl: Object.assign({}, PLEDIT, t.pl || {}), lcd: h.lcd, eqCara: h.eqCara },
      region: null, numsEx: false, nazev: t.id ? t.nazev : 'Výchozí (Lamamp)', tema: t.id,
      m, hd: m > 1 ? { pismoDispleje: PISMO_DISPLEJE, pismoNapisu: PISMO_NAPISU } : null
    });
  }


  // ---------- skiny .wsz (ZIP s bitmapami) ----------
  // rozbalení ZIPu: centrální adresář → {jméno malými písmeny bez složek: Uint8Array}
  async function rozbal(buf, chci = () => true) {
    const b = new Uint8Array(buf), dv = new DataView(buf instanceof ArrayBuffer ? buf : b.buffer, b.byteOffset, b.byteLength);
    let k = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { k = i; break; }
    if (k < 0) throw new Error('Soubor není ZIP (skin .wsz).');
    const pocet = dv.getUint16(k + 10, true);
    let i = dv.getUint32(k + 16, true);
    const vysl = {};
    for (let n = 0; n < pocet; n++) {
      if (dv.getUint32(i, true) !== 0x02014b50) break;
      const metoda = dv.getUint16(i + 10, true), zabaleno = dv.getUint32(i + 20, true);
      const dJm = dv.getUint16(i + 28, true), dEx = dv.getUint16(i + 30, true), dKom = dv.getUint16(i + 32, true);
      const lok = dv.getUint32(i + 42, true);
      const jmeno = new TextDecoder().decode(b.subarray(i + 46, i + 46 + dJm));
      i += 46 + dJm + dEx + dKom;
      const klic = jmeno.replace(/^.*[\\/]/, '').toLowerCase();
      if (jmeno.endsWith('/') || klic in vysl || !chci(klic)) continue;
      if (lok === 0xFFFFFFFF || zabaleno === 0xFFFFFFFF || lok + 30 > b.length) continue;   // zip64 / mimo soubor
      try {
        const data0 = lok + 30 + dv.getUint16(lok + 26, true) + dv.getUint16(lok + 28, true);
        const surova = b.subarray(data0, data0 + zabaleno);
        if (metoda === 0) vysl[klic] = surova.slice();
        else if (metoda === 8) vysl[klic] = new Uint8Array(await new Response(new Blob([surova]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      } catch (e) { /* poškozená položka – zbytek skinu platí */ }
    }
    return vysl;
  }

  // dekodér BMP (1/4/8/16/24/32 bitů, bez komprese nebo BITFIELDS) → {sirka, vyska, rgba}
  function dekodujBmp(b) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (b[0] !== 0x42 || b[1] !== 0x4D) throw new Error('není BMP');
    const data = dv.getUint32(10, true), hl = dv.getUint32(14, true);
    if (hl < 40) throw new Error('BMP ve formátu OS/2');   // jiné rozložení hlavičky – zvládne createImageBitmap
    const w = dv.getInt32(18, true), h0 = dv.getInt32(22, true), bpp = dv.getUint16(28, true);
    const komprese = hl >= 40 ? dv.getUint32(30, true) : 0;
    if (komprese !== 0 && komprese !== 3) throw new Error('komprimovaný BMP');
    const h = Math.abs(h0), shora = h0 < 0;
    // vadná hlavička (obří rozměr, nesmyslná hloubka, data mimo soubor) by zamrazila stránku – skiny mají jen stovky px
    if (![1, 4, 8, 16, 24, 32].includes(bpp) || !(w > 0 && h > 0 && w <= 4096 && h <= 4096)) throw new Error('vadná hlavička BMP');
    if (data + Math.floor((bpp * w + 31) / 32) * 4 * h > b.length) throw new Error('zkrácený BMP');
    const rgba = new Uint8ClampedArray(w * h * 4);
    // počet barev palety: biClrUsed nesmí přesáhnout 2^bpp ani konec souboru (vadný soubor by zamrzl)
    const nPal = bpp <= 8 ? Math.min((hl >= 40 && dv.getUint32(46, true)) || (1 << bpp), 1 << bpp) : 0;
    const pal = []; for (let i = 0; i < nPal && 14 + hl + i * 4 + 3 < b.length; i++) { const o = 14 + hl + i * 4; pal.push([b[o + 2], b[o + 1], b[o]]); }
    let masky = null;
    if (komprese === 3) masky = hl >= 52 ? [dv.getUint32(54, true), dv.getUint32(58, true), dv.getUint32(62, true)] : [dv.getUint32(14 + hl, true), dv.getUint32(18 + hl, true), dv.getUint32(22 + hl, true)];
    else if (bpp === 16) masky = [0x7C00, 0x03E0, 0x001F];
    const zMasky = (v, m) => { if (!m) return 0; let s = 0; while (!((m >> s) & 1)) s++; const max = m >>> s; return Math.round(((v & m) >>> s) * 255 / max); };
    const radek = Math.floor((bpp * w + 31) / 32) * 4;
    for (let y = 0; y < h; y++) {
      const r0 = data + (shora ? y : h - 1 - y) * radek;
      for (let x = 0; x < w; x++) {
        let c;
        if (bpp <= 8) { const bit = x * bpp, bajt = b[r0 + (bit >> 3)], idx = (bajt >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1); c = pal[idx] || [0, 0, 0]; }
        else if (bpp === 24) { const o = r0 + x * 3; c = [b[o + 2], b[o + 1], b[o]]; }
        else if (bpp === 16) { const v = dv.getUint16(r0 + x * 2, true); c = masky.map(m => zMasky(v, m)); }
        else { const o = r0 + x * 4; c = masky ? masky.map(m => zMasky(dv.getUint32(o, true), m)) : [b[o + 2], b[o + 1], b[o]]; }
        const i = (y * w + x) * 4; rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = 255;
      }
    }
    return { sirka: w, vyska: h, rgba };
  }
  async function bmpNaPlatno(data) {
    let obr;
    try {
      const d = dekodujBmp(data);
      const { c, g } = arch(d.sirka, d.vyska);
      g.putImageData(new ImageData(d.rgba, d.sirka, d.vyska), 0, 0);
      return c;
    } catch (e) {
      obr = await createImageBitmap(new Blob([data]));   // RLE a jiné zvláštnosti zvládne prohlížeč
    }
    const { c, g } = arch(obr.width, obr.height); g.drawImage(obr, 0, 0); return c;
  }

  const textSouboru = d => new TextDecoder('windows-1252').decode(d);
  function nactiViscolor(t) {
    const v = [];
    for (const r of t.split(/\r?\n/)) { const m = r.match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/); if (m) v.push(rgb(+m[1], +m[2], +m[3])); }
    return v.length >= 24 ? v.slice(0, 24) : null;
  }
  function nactiPledit(t) {
    const v = {}, KL = { normal: 'normal', current: 'aktualni', normalbg: 'pozadi', selectedbg: 'vybrane', font: 'pismo' };
    for (const r of t.split(/\r?\n/)) {
      const m = r.match(/^\s*(\w+)\s*=\s*(.+?)\s*$/); if (!m || !KL[m[1].toLowerCase()]) continue;
      let h = m[2]; if (KL[m[1].toLowerCase()] !== 'pismo') { h = h.replace(/^#?/, '#'); if (!/^#[0-9a-f]{6}$/i.test(h)) continue; }
      v[KL[m[1].toLowerCase()]] = h;
    }
    return v;
  }
  // region.txt: [Normal] / [Equalizer] → seznam mnohoúhelníků [[x,y],…]
  function nactiRegion(t) {
    const vysl = {}; let sekce = null, body = null, pocty = null;
    const uloz = () => {
      if (!sekce || !body || !pocty) return;
      const poly = []; let i = 0;
      for (const n of pocty) { const p = []; for (let k = 0; k < n && i + 1 < body.length; k++, i += 2) p.push([body[i], body[i + 1]]); if (p.length >= 3) poly.push(p); }
      if (poly.length) vysl[sekce] = poly;
    };
    for (const r of t.split(/\r?\n/)) {
      const s = r.match(/^\s*\[(.+)\]/);
      if (s) { uloz(); sekce = s[1].trim().toLowerCase(); body = pocty = null; continue; }
      const m = r.match(/^\s*(\w+)\s*=\s*(.*)$/); if (!m) continue;
      const cisla = (m[2].match(/-?\d+/g) || []).map(Number);
      if (m[1].toLowerCase() === 'numpoints') pocty = cisla; else if (m[1].toLowerCase() === 'pointlist') body = cisla;
    }
    uloz();
    return Object.keys(vysl).length ? vysl : null;
  }

  const ARCHY = ['main', 'titlebar', 'cbuttons', 'numbers', 'text', 'playpaus', 'monoster', 'posbar', 'volume', 'balance', 'shufrep', 'eqmain', 'eq_ex', 'pledit'];
  async function nactiWsz(buf, nazev = 'Skin') {
    const POTREBA = new Set([...ARCHY.map(a => a + '.bmp'), 'nums_ex.bmp', 'viscolor.txt', 'pledit.txt', 'region.txt']);
    const soubory = await rozbal(buf, k => POTREBA.has(k)), skin = vychozi();
    skin.nazev = nazev.replace(/\.(wsz|zip)$/i, '');
    delete skin.tema; skin.m = 1; skin.hd = null;   // bitmapový skin: ne vestavěný motiv, žádné HD (jinak by ho přepočet měřítka nahradil)
    let nalezeno = 0;
    for (const a of ARCHY) {
      if (soubory[a + '.bmp']) { try { skin[a] = await bmpNaPlatno(soubory[a + '.bmp']); nalezeno++; } catch (e) { /* zůstane výchozí */ } }
    }
    if (!nalezeno) throw new Error('V souboru nejsou bitmapy skinu.');
    if (soubory['nums_ex.bmp']) { try { skin.numbers = await bmpNaPlatno(soubory['nums_ex.bmp']); skin.numsEx = true; } catch (e) { /* bez nums_ex */ } }
    if (!soubory['balance.bmp'] && soubory['volume.bmp']) skin.balance = skin.volume;   // jako Winamp
    if (soubory['viscolor.txt']) skin.barvy.vis = nactiViscolor(textSouboru(soubory['viscolor.txt'])) || skin.barvy.vis;
    if (soubory['pledit.txt']) Object.assign(skin.barvy.pl, nactiPledit(textSouboru(soubory['pledit.txt'])));
    if (soubory['region.txt']) skin.region = nactiRegion(textSouboru(soubory['region.txt']));
    return skin;
  }

  window.WA_SKIN = { vychozi, TEMATA: TEMATA.map(t => ({ id: t.id, nazev: t.nazev })), nactiWsz, rozbal, dekodujBmp, nactiViscolor, nactiPledit, nactiRegion, bunkaZnaku, pripravText, NAZEV };
})();
