/* plakat_mapy/jadro.js – logika „Plakátu mapy“ bez DOM.
   Formáty a pixely podle DPI, formát souřadnic, palety a generování stylu MapLibre
   (vektorové dlaždice OpenFreeMap, schéma OpenMapTiles), rozvržení plakátu,
   tvary masky jako SVG cesta (Path2D i CSS clip-path) a výpočet hvězdné oblohy.
   V prohlížeči window.PLAKAT, v node module.exports. */
(function (koren) {
  'use strict';

  const ATRIBUCE = '© OpenStreetMap přispěvatelé · © OpenFreeMap · OpenMapTiles';
  const ATRIBUCE_OBLOHA = 'Hvězdy: Yale Bright Star Catalogue · souhvězdí: d3-celestial (BSD)';
  const ZDROJ_DLAZDIC = 'https://tiles.openfreemap.org/planet';
  const GLYFY = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

  /* ---------- formáty a pixely ---------- */
  const FORMATY = {
    a4: { nazev: 'A4 (210 × 297 mm)', s: 210, v: 297 },
    a3: { nazev: 'A3 (297 × 420 mm)', s: 297, v: 420 },
    a2: { nazev: 'A2 (420 × 594 mm)', s: 420, v: 594 },
    '50x70': { nazev: '50 × 70 cm', s: 500, v: 700 },
    '30x40': { nazev: '30 × 40 cm', s: 300, v: 400 },
    vlastni: { nazev: 'Vlastní rozměr', s: 0, v: 0 },
  };

  /** Rozměr plakátu v mm podle formátu a orientace; vlastní = {s, v} v mm. */
  function rozmeryMm(format, orientace, vlastni) {
    let s, v;
    if (format === 'vlastni') {
      s = Math.max(50, Math.min(2000, +(vlastni && vlastni.s) || 300));
      v = Math.max(50, Math.min(2000, +(vlastni && vlastni.v) || 400));
    } else {
      const f = FORMATY[format] || FORMATY.a4; s = f.s; v = f.v;
    }
    const kratsi = Math.min(s, v), delsi = Math.max(s, v);
    if (format === 'vlastni') return { s, v };   // vlastní rozměr bere zadání doslova
    return orientace === 'sirka' ? { s: delsi, v: kratsi } : { s: kratsi, v: delsi };
  }

  const pixely = (mm, dpi) => Math.round(mm / 25.4 * dpi);
  function rozmeryPx(mm, dpi) { return { w: pixely(mm.s, dpi), h: pixely(mm.v, dpi) }; }

  /** Nejvyšší celé DPI, při kterém se strany vejdou do limitu (px) a plocha do limitu plochy. */
  function maxDpi(mm, limitStrany, limitPlochy) {
    let d = Math.floor(limitStrany * 25.4 / Math.max(mm.s, mm.v));
    if (limitPlochy) d = Math.min(d, Math.floor(Math.sqrt(limitPlochy / (mm.s * mm.v)) * 25.4));
    while (d > 1) {
      const p = rozmeryPx(mm, d);
      if (Math.max(p.w, p.h) <= limitStrany && (!limitPlochy || p.w * p.h <= limitPlochy)) break;
      d--;
    }
    return Math.max(1, d);
  }

  /* ---------- souřadnice ---------- */
  function formatSouradnic(lat, lon, des = 4) {
    const f = (x, k, z) => Math.abs(x).toFixed(des) + '° ' + (x < 0 ? z : k);
    return f(lat, 'N', 'S') + ', ' + f(lon, 'E', 'W');
  }

  /** Přečte souřadnice: „50.0755, 14.4378“, „50.0755° N, 14.4378° E“, „50°4'31.8"N 14°26'16"E“, „S 33.9 W 18.4“. */
  function ctiSouradnice(text) {
    let t = String(text || '').trim().toUpperCase();
    if (!t.includes('.')) t = t.replace(/(\d),(\d)/g, '$1.$2');   // desetinná čárka jen bez teček
    // písmeno polokoule buď před číslem („N 50 E 14“), nebo za ním („50° N, 14° E“)
    const predem = /^[NSEWJVZ]/.test(t);
    const cislo = '(-?\\d+(?:\\.\\d+)?)\\s*°?\\s*(?:(\\d+(?:\\.\\d+)?)\\s*[\'′]\\s*)?(?:(\\d+(?:\\.\\d+)?)\\s*(?:["″]|\'\')\\s*)?';
    const re = new RegExp(predem ? '([NSEWJVZ])\\s*' + cislo : cislo + '([NSEWJVZ])?', 'g');
    const casti = [];
    let m;
    while ((m = re.exec(t)) && casti.length < 3) {
      const [c, mi, se, p] = predem ? [m[2], m[3], m[4], m[1]] : [m[1], m[2], m[3], m[4]];
      let h = Math.abs(+c) + (+mi || 0) / 60 + (+se || 0) / 3600;
      if (c.startsWith('-')) h = -h;
      casti.push({ h, p: p || '' });
    }
    if (casti.length !== 2) return null;
    let lat, lon;
    const jeLon = p => 'EWVZ'.includes(p) && p !== '';
    const jih = p => p === 'S' || p === 'J';
    const zapad = p => p === 'W' || p === 'Z';
    // S = jih (anglicky), u češtiny „S“ = sever – český zápis S/J/V/Z poznáme podle J/V/Z u druhé složky
    const cesky = casti.some(c => 'JVZ'.includes(c.p) && c.p);
    const znamenko = c => {
      if (!c.p) return c.h;
      if (cesky) return (c.p === 'J' || c.p === 'Z') ? -Math.abs(c.h) : Math.abs(c.h);
      return (jih(c.p) || zapad(c.p)) ? -Math.abs(c.h) : Math.abs(c.h);
    };
    if (jeLon(casti[0].p) && !jeLon(casti[1].p)) { lon = znamenko(casti[0]); lat = znamenko(casti[1]); }
    else { lat = znamenko(casti[0]); lon = znamenko(casti[1]); }
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
    return { lat, lon };
  }

  /* ---------- palety ---------- */
  const TRIDY = ['dalnice', 'hlavni', 'vedlejsi', 'mistni', 'stezky'];
  const NAZVY_TRID = { dalnice: 'Dálnice', hlavni: 'Hlavní silnice', vedlejsi: 'Vedlejší silnice', mistni: 'Místní ulice', stezky: 'Cesty a stezky' };
  // třídy OpenMapTiles (vrstva transportation, atribut class)
  const OMT_TRIDY = {
    dalnice: ['motorway', 'trunk'],
    hlavni: ['primary'],
    vedlejsi: ['secondary', 'tertiary'],
    mistni: ['minor', 'service', 'raceway', 'busway'],
    stezky: ['path', 'track', 'pedestrian'],
  };
  // šířka čáry v px při zoomu 12 a 18 (mezi nimi exponenciálně)
  const SIRKY = { dalnice: [1.6, 22], hlavni: [1.2, 16], vedlejsi: [0.9, 12], mistni: [0.45, 7], stezky: [0.3, 2.5] };

  const sil = (d, h, v, m, s) => ({ dalnice: d, hlavni: h, vedlejsi: v, mistni: m, stezky: s });
  const PALETY = [
    { id: 'cernobily', nazev: 'Černobílý', plakat: '#ffffff', text: '#111111', pozadi: '#ffffff', voda: '#d4d4d4', zelen: '#eeeeee', budovy: '#e4e4e4', zeleznice: '#9a9a9a',
      silnice: sil('#000000', '#111111', '#222222', '#333333', '#8a8a8a'), obloha: '#111111', hvezdy: '#ffffff', pin: '#111111' },
    { id: 'inkoust', nazev: 'Inkoust', plakat: '#f4f0e6', text: '#1c2033', pozadi: '#f4f0e6', voda: '#cfd5e0', zelen: null, budovy: null, zeleznice: '#1c2033',
      silnice: sil('#1c2033', '#1c2033', '#1c2033', '#1c2033', '#5a5f72'), obloha: '#1c2033', hvezdy: '#f4f0e6', pin: '#b3261e' },
    { id: 'modrotisk', nazev: 'Modrotisk', plakat: '#1d3a6e', text: '#eef2f9', pozadi: '#1d3a6e', voda: '#13294f', zelen: '#21437a', budovy: '#24467d', zeleznice: '#9fb3d6',
      silnice: sil('#ffffff', '#eef2f9', '#dfe6f3', '#c6d2e8', '#8ea4cb'), obloha: '#13294f', hvezdy: '#eef2f9', pin: '#ffffff' },
    { id: 'sepie', nazev: 'Sépie', plakat: '#efe2c8', text: '#4a2f17', pozadi: '#efe2c8', voda: '#c9b48d', zelen: '#e3d3b1', budovy: '#e6d5b5', zeleznice: '#8a6a48',
      silnice: sil('#4a2f17', '#5b3a1e', '#6b4a2c', '#7d5c3c', '#a48662'), obloha: '#3b2412', hvezdy: '#f4e6c8', pin: '#8b1e1e' },
    { id: 'nocni', nazev: 'Noční', plakat: '#0d1117', text: '#f2c14e', pozadi: '#0d1117', voda: '#1a2a40', zelen: '#121d18', budovy: '#171c24', zeleznice: '#5a6170',
      silnice: sil('#ffd36b', '#f2c14e', '#d9a93f', '#b08a3a', '#5e4f2e'), obloha: '#05080f', hvezdy: '#fff4d6', pin: '#ff6b5b' },
    { id: 'pastel', nazev: 'Pastel', plakat: '#fbf3ec', text: '#5b4a52', pozadi: '#fbf3ec', voda: '#a8d5e2', zelen: '#cfe8c4', budovy: '#f2dccf', zeleznice: '#c9b6bd',
      silnice: sil('#e58f84', '#e9a39a', '#d9b0b0', '#c9bcc0', '#ddd0d3'), obloha: '#4b5d7a', hvezdy: '#fff7ef', pin: '#e05a6d' },
    { id: 'minimal', nazev: 'Minimal (jen silnice)', plakat: '#ffffff', text: '#222222', pozadi: '#ffffff', voda: null, zelen: null, budovy: null, zeleznice: null,
      silnice: sil('#222222', '#222222', '#222222', '#222222', '#222222'), obloha: '#222222', hvezdy: '#ffffff', pin: '#d33c2e' },
    { id: 'vodazelen', nazev: 'Voda a zeleň', plakat: '#f7f7f2', text: '#2d4a3a', pozadi: '#f7f7f2', voda: '#3d7ea6', zelen: '#6aa865', budovy: null, zeleznice: null,
      silnice: sil('#c2c2b8', '#cacac0', '#d2d2c8', '#dadad2', '#e2e2da'), obloha: '#1f3b4d', hvezdy: '#f7f7f2', pin: '#2d4a3a' },
    { id: 'terakota', nazev: 'Terakota', plakat: '#f3e9dc', text: '#7a2e1d', pozadi: '#f3e9dc', voda: '#b9cfd1', zelen: '#dfe0c6', budovy: '#ead8c4', zeleznice: '#a07a68',
      silnice: sil('#c0492b', '#c75a3d', '#cf7258', '#b98c79', '#cdb3a5'), obloha: '#3d1f17', hvezdy: '#f3e9dc', pin: '#7a2e1d' },
    { id: 'cerna', nazev: 'Černý kontrast', plakat: '#000000', text: '#ffffff', pozadi: '#000000', voda: '#1e1e1e', zelen: null, budovy: '#141414', zeleznice: '#555555',
      silnice: sil('#ffffff', '#ffffff', '#f0f0f0', '#d8d8d8', '#777777'), obloha: '#000000', hvezdy: '#ffffff', pin: '#ff3b30' },
  ];

  function kopiePalety(id) {
    const p = PALETY.find(x => x.id === id) || PALETY[0];
    return JSON.parse(JSON.stringify(Object.assign({ sirky: sil(1, 1, 1, 1, 1), tloustka: 1 }, p)));
  }

  /* ---------- styl MapLibre ---------- */
  const jePlocha = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false];
  const jeCara = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false];

  function sirkaVyraz(trida, nasobek) {
    const [a, b] = SIRKY[trida];
    return ['interpolate', ['exponential', 1.5], ['zoom'], 5, +(a * 0.15 * nasobek).toFixed(3), 12, +(a * nasobek).toFixed(3), 18, +(b * nasobek).toFixed(3)];
  }

  /** Vygeneruje styl MapLibre z palety. volby: {popisky: bool, pismoPopisku: 'Noto Sans Regular'} */
  function generujStyl(pal, volby = {}) {
    const v = [];
    v.push({ id: 'pozadi', type: 'background', paint: { 'background-color': pal.pozadi } });
    if (pal.zelen) {
      v.push({ id: 'zelen-pokryv', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['all', jePlocha, ['match', ['get', 'class'], ['wood', 'grass', 'farmland', 'wetland'], true, false]],
        paint: { 'fill-color': pal.zelen, 'fill-antialias': false } });
      v.push({ id: 'zelen-park', type: 'fill', source: 'omt', 'source-layer': 'park', filter: jePlocha,
        paint: { 'fill-color': pal.zelen, 'fill-antialias': false } });
      v.push({ id: 'zelen-vyuziti', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['all', jePlocha, ['match', ['get', 'class'], ['cemetery', 'grass', 'pitch', 'playground', 'garden'], true, false]],
        paint: { 'fill-color': pal.zelen, 'fill-antialias': false } });
    }
    if (pal.voda) {
      v.push({ id: 'voda', type: 'fill', source: 'omt', 'source-layer': 'water',
        filter: ['all', jePlocha, ['!=', ['get', 'brunnel'], 'tunnel']], paint: { 'fill-color': pal.voda } });
      v.push({ id: 'vodni-toky', type: 'line', source: 'omt', 'source-layer': 'waterway',
        filter: ['all', jeCara, ['!=', ['get', 'brunnel'], 'tunnel']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': pal.voda, 'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 8, 0.5, 13, ['match', ['get', 'class'], 'river', 2.5, 0.8], 18, ['match', ['get', 'class'], 'river', 14, 4]] } });
    }
    if (pal.budovy) {
      v.push({ id: 'budovy', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': pal.budovy } });
    }
    // silnice od nejméně důležitých, ať hlavní leží navrchu
    const tl = +pal.tloustka || 1;
    for (const t of TRIDY.slice().reverse()) {
      const barva = pal.silnice[t];
      if (!barva) continue;
      v.push({ id: 'silnice-' + t, type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['all', jeCara, ['match', ['get', 'class'], OMT_TRIDY[t], true, false], ['!=', ['get', 'brunnel'], 'tunnel']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': barva, 'line-width': sirkaVyraz(t, tl * ((pal.sirky && +pal.sirky[t]) || 1)) } });
    }
    if (pal.zeleznice) {
      v.push({ id: 'zeleznice', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['all', jeCara, ['match', ['get', 'class'], ['rail', 'transit'], true, false], ['!=', ['get', 'brunnel'], 'tunnel']],
        paint: { 'line-color': pal.zeleznice, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4 * tl, 18, 2.5 * tl], 'line-dasharray': [3, 2] } });
    }
    if (volby.popisky) {
      const pismo = [volby.pismoPopisku || 'Noto Sans Regular'];
      const halo = pal.pozadi;
      v.push({ id: 'popisky-ulic', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 14,
        layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:cs'], ['get', 'name']], 'text-font': pismo, 'text-size': 10 },
        paint: { 'text-color': pal.text, 'text-halo-color': halo, 'text-halo-width': 1.5 } });
      v.push({ id: 'popisky-mist', type: 'symbol', source: 'omt', 'source-layer': 'place',
        filter: ['match', ['get', 'class'], ['city', 'town', 'village', 'suburb', 'quarter', 'neighbourhood'], true, false],
        layout: { 'text-field': ['coalesce', ['get', 'name:cs'], ['get', 'name']], 'text-font': pismo,
          'text-size': ['match', ['get', 'class'], 'city', 16, 'town', 13, 11], 'text-transform': 'uppercase', 'text-letter-spacing': 0.1 },
        paint: { 'text-color': pal.text, 'text-halo-color': halo, 'text-halo-width': 1.5 } });
    }
    return {
      version: 8, name: 'Plakát – ' + (pal.nazev || pal.id),
      glyphs: GLYFY,
      sources: { omt: { type: 'vector', url: ZDROJ_DLAZDIC, attribution: ATRIBUCE } },
      layers: v,
    };
  }

  /* ---------- rozvržení plakátu ---------- */
  const VYCHOZI = {
    format: 'a3', orientace: 'vyska', vlastni: { s: 300, v: 400 },
    okraj: 6, ramecek: 'tenky', tvar: 'obdelnik', rozlozeni: 'dole',
    titulek: 'PRAHA', podtitulek: 'Česká republika', souradnice: true, velkaPismena: true,
    pismo: 'libsans', pismoPodtitulku: 'libserif', velikostTextu: 1, prolozeni: 0.3,
    znacka: 'pin', mesto: { lat: 50.0755, lon: 14.4378 }, znackaPoloha: null,
    zoom: 12, natoceni: 0, paleta: 'cernobily', popisky: false, rezim: 'mapa',
    datum: null, cara: true, souhvezdi: true, mrizka: false,
  };

  /**
   * Rozvržení plakátu v px pro plátno W × H (náhled i export používají totéž, takže vypadají stejně).
   * Vrací {mapa, tvar: rect masky, pruh, prechod, texty[], atribuce, ramecek}.
   */
  function rozvrzeni(n, W, H) {
    const k = Math.min(W, H);                     // měřítko textu podle kratší strany
    const okraj = Math.max(0, +n.okraj || 0) / 100 * k;
    const r = { W, H, k, texty: [], pruh: null, prechod: null };
    const vel = (+n.velikostTextu || 1);
    const vT = 0.085 * k * vel, vP = 0.032 * k * vel, vS = 0.022 * k * vel;
    // výška textového bloku: titulek + mezera + podtitulek + souřadnice
    const radky = [];
    if (n.titulek) radky.push({ druh: 'titulek', text: n.velkaPismena ? String(n.titulek).toUpperCase() : n.titulek, velikost: vT, prolozeni: (+n.prolozeni || 0) * vT });
    if (n.titulek && (n.podtitulek || n.souradnice)) radky.push({ druh: 'cara', velikost: vS * 1.6 });
    if (n.podtitulek) radky.push({ druh: 'podtitulek', text: n.podtitulek, velikost: vP, prolozeni: 0.08 * vP });
    if (n.souradnice && n.textSouradnic) radky.push({ druh: 'souradnice', text: n.textSouradnic, velikost: vS, prolozeni: 0.12 * vS });
    const vyskaBloku = radky.reduce((s, x) => s + x.velikost * (x.druh === 'cara' ? 1 : 1.35), 0);
    const vnitrni = { x: okraj, y: okraj, w: W - 2 * okraj, h: H - 2 * okraj };
    let blokY;                                    // horní hrana textového bloku
    if (n.rozlozeni === 'pres' || n.rozlozeni === 'pruh') {
      r.mapa = vnitrni;
      blokY = H - okraj - vyskaBloku - 0.07 * k;
      if (n.rozlozeni === 'pruh') {
        const p = 0.035 * k;
        r.pruh = { x: vnitrni.x, y: blokY - p, w: vnitrni.w, h: vyskaBloku + 2 * p };
      } else {
        r.prechod = { x: vnitrni.x, y: blokY - 0.12 * k, w: vnitrni.w, h: H - okraj - (blokY - 0.12 * k) };
      }
    } else {
      const dole = radky.length ? vyskaBloku + 0.11 * k : 0;
      r.mapa = { x: okraj, y: okraj, w: vnitrni.w, h: Math.max(10, vnitrni.h - dole) };
      blokY = r.mapa.y + r.mapa.h + 0.055 * k;
    }
    // maska: obdélník = celé pole mapy, kruh/srdce = čtverec uprostřed
    if (n.tvar === 'kruh' || n.tvar === 'srdce') {
      const pole = r.mapa, s = Math.min(pole.w, pole.h) * (n.rozlozeni === 'dole' ? 0.94 : 0.86);
      const yStred = n.rozlozeni === 'dole' ? pole.y + pole.h / 2 : pole.y + (blokY - 0.04 * k - pole.y) / 2;
      const s2 = Math.min(s, n.rozlozeni === 'dole' ? s : (blokY - 0.04 * k - pole.y) * 0.96);
      r.tvar = { x: pole.x + (pole.w - s2) / 2, y: yStred - s2 / 2, w: s2, h: s2 };
    } else {
      r.tvar = Object.assign({}, r.mapa);
    }
    let y = blokY;
    for (const ra of radky) {
      if (ra.druh === 'cara') { r.texty.push({ druh: 'cara', x: W / 2, y: y + ra.velikost / 2, delka: 0.12 * k, tloustka: Math.max(1, 0.0016 * k) }); y += ra.velikost; continue; }
      r.texty.push({ druh: ra.druh, text: ra.text, x: W / 2, y: y + ra.velikost, velikost: ra.velikost, prolozeni: ra.prolozeni });
      y += ra.velikost * 1.35;
    }
    const vA = Math.max(0.0085 * k, 5);
    r.atribuce = { x: W - Math.max(okraj, vA * 0.8) - (okraj ? 0 : vA * 0.4), y: H - Math.max(okraj * 0.35, vA * 0.6), velikost: vA };
    if (okraj > vA * 1.6) r.atribuce.y = H - (okraj - vA) / 2;   // atribuce do okraje pod mapu
    const tl = { zadny: 0, tenky: 0.0018, silny: 0.005, dvojity: 0.0016 }[n.ramecek] || 0;
    r.ramecek = tl ? { druh: n.ramecek, tloustka: Math.max(1, tl * k), mezera: 0.008 * k } : null;
    return r;
  }

  /** SVG cesta tvaru masky v obdélníku (pro Path2D i CSS clip-path: path()). */
  function cestaTvaru(tvar, o) {
    const f = x => +x.toFixed(2);
    const { x, y, w, h } = o;
    if (tvar === 'kruh') {
      const rr = Math.min(w, h) / 2, cx = x + w / 2, cy = y + h / 2;
      return `M${f(cx - rr)} ${f(cy)}A${f(rr)} ${f(rr)} 0 1 0 ${f(cx + rr)} ${f(cy)}A${f(rr)} ${f(rr)} 0 1 0 ${f(cx - rr)} ${f(cy)}Z`;
    }
    if (tvar === 'srdce') {
      // srdce v jednotkovém čtverci (0..1), špička dole
      const P = (u, v) => f(x + u * w) + ' ' + f(y + v * h);
      return `M${P(0.5, 0.97)}C${P(0.38, 0.86)} ${P(0.02, 0.62)} ${P(0.02, 0.33)}` +
        `C${P(0.02, 0.12)} ${P(0.2, 0.03)} ${P(0.29, 0.03)}C${P(0.4, 0.03)} ${P(0.47, 0.1)} ${P(0.5, 0.18)}` +
        `C${P(0.53, 0.1)} ${P(0.6, 0.03)} ${P(0.71, 0.03)}C${P(0.8, 0.03)} ${P(0.98, 0.12)} ${P(0.98, 0.33)}` +
        `C${P(0.98, 0.62)} ${P(0.62, 0.86)} ${P(0.5, 0.97)}Z`;
    }
    return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;
  }

  /* ---------- hvězdná obloha ---------- */
  const RAD = Math.PI / 180;
  const juliansky = ms => ms / 86400000 + 2440587.5;
  /** Místní hvězdný čas ve stupních (GMST podle IAU 1982 + zeměpisná délka). */
  function hvezdnyCas(jd, lon) {
    const T = (jd - 2451545) / 36525;
    const g = 280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - T * T * T / 38710000;
    return ((g + lon) % 360 + 360) % 360;
  }
  /** Rovníkové souřadnice (°) → výška a azimut (° od severu přes východ). */
  function naObzor(ra, dec, lat, lst) {
    const H = (lst - ra) * RAD, d = dec * RAD, f = lat * RAD;
    const sinh = Math.sin(d) * Math.sin(f) + Math.cos(d) * Math.cos(f) * Math.cos(H);
    const h = Math.asin(Math.max(-1, Math.min(1, sinh)));
    const az = Math.atan2(-Math.sin(H) * Math.cos(d), Math.sin(d) * Math.cos(f) - Math.cos(d) * Math.sin(f) * Math.cos(H));
    return { vyska: h / RAD, azimut: ((az / RAD) % 360 + 360) % 360 };
  }
  /** Stereografická projekce od zenitu: obzor = jednotková kružnice, sever nahoře, východ vlevo (pohled vzhůru). */
  function projekce(vyska, azimut) {
    const r = Math.tan((90 - vyska) * RAD / 2);    // obzor: tan 45° = 1
    return { x: -r * Math.sin(azimut * RAD), y: -r * Math.cos(azimut * RAD) };
  }
  /** Hvězdy nad obzorem: H = plochá pole [α, δ, V, B−V, …] (katalog z dalekohled/data.js). */
  function hvezdyNaObloze(H, ms, lat, lon, mezMag = 6) {
    const lst = hvezdnyCas(juliansky(ms), lon), out = [];
    for (let i = 0; i < H.length; i += 4) {
      if (H[i + 2] > mezMag) continue;
      const o = naObzor(H[i], H[i + 1], lat, lst);
      if (o.vyska < 0) continue;
      const p = projekce(o.vyska, o.azimut);
      out.push({ x: p.x, y: p.y, mag: H[i + 2], bv: H[i + 3] });
    }
    return out;
  }
  /** Čáry souhvězdí nad obzorem jako úsečky [x1, y1, x2, y2] (úsečka s koncem pod obzorem se vynechá). */
  function caryNaObloze(souhvezdi, ms, lat, lon) {
    const lst = hvezdnyCas(juliansky(ms), lon), out = [];
    for (const s of souhvezdi) for (const cara of s.c || []) {
      let pred = null;
      for (const [ra, dec] of cara) {
        const o = naObzor(ra < 0 ? ra + 360 : ra, dec, lat, lst);
        const p = o.vyska >= 0 ? projekce(o.vyska, o.azimut) : null;
        if (p && pred) out.push([pred.x, pred.y, p.x, p.y]);
        pred = p;
      }
    }
    return out;
  }
  /** Poloměr hvězdy (relativně k poloměru obzoru) podle hvězdné velikosti. */
  const polomerHvezdy = (mag, R) => R * 0.0042 * Math.pow(1.38, Math.max(-1.5, 5.6 - mag)) / 3.2;

  const API = {
    ATRIBUCE, ATRIBUCE_OBLOHA, FORMATY, TRIDY, NAZVY_TRID, OMT_TRIDY, SIRKY, PALETY, VYCHOZI,
    rozmeryMm, pixely, rozmeryPx, maxDpi, formatSouradnic, ctiSouradnice,
    kopiePalety, generujStyl, rozvrzeni, cestaTvaru,
    juliansky, hvezdnyCas, naObzor, projekce, hvezdyNaObloze, caryNaObloze, polomerHvezdy,
  };
  koren.PLAKAT = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
