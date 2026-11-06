/* Dílna hlasů – umělý hlas: formantová syntéza češtiny bez neuronových modelů (bez DOM).
   1) text → hlásky (česká pravidla: ch, dž, ď/ť/ň před i/ě, bě/pě/vě/mě, spodoba znělosti, ř),
   2) prozódie (přízvuk na první slabice, deklinace, konec oznamovací/tázací věty),
   3) syntéza: zdroj (hlasivkový puls / pila / obdélník / šum) → kaskáda rezonátorů F1–F5,
      šumová větev pro sykavky a výbuchy (ve stylu Klattova syntetizátoru).
   window.HLASY_FORMANT v prohlížeči, module.exports v node (_test/hlasy_formant_test.js). */
(function (koren) {
  'use strict';

  /* ---------- hlásky ---------- */
  // t: v samohláska, p ražená, a polosykavá, f třená, n nosová, l plynná/polosamohláska, r kmitavá
  // F = formanty (u souhlásek „lokus“, ke kterému směřují přechody), d = délka v ms
  // zn = znělá, sum = šumová složka [střed Hz, šířka Hz, síla], vyb = výbuch [střed, šířka, síla]
  const H = {
    a: { t: 'v', F: [720, 1250, 2550], d: 80 }, 'a:': { t: 'v', F: [740, 1250, 2550], d: 155 },
    e: { t: 'v', F: [520, 1750, 2500], d: 75 }, 'e:': { t: 'v', F: [540, 1800, 2550], d: 150 },
    i: { t: 'v', F: [380, 1950, 2650], d: 70 }, 'i:': { t: 'v', F: [290, 2250, 2950], d: 145 },
    o: { t: 'v', F: [500, 900, 2450], d: 80 }, 'o:': { t: 'v', F: [490, 860, 2450], d: 150 },
    u: { t: 'v', F: [340, 760, 2350], d: 75 }, 'u:': { t: 'v', F: [310, 700, 2300], d: 145 },
    p: { t: 'p', F: [250, 900, 2300], d: 65, vyb: [1100, 2000, 0.25] }, b: { t: 'p', F: [250, 900, 2300], d: 55, zn: 1, vyb: [1100, 2000, 0.18] },
    t: { t: 'p', F: [250, 1700, 2700], d: 65, vyb: [4300, 1600, 0.4] }, d: { t: 'p', F: [250, 1700, 2700], d: 55, zn: 1, vyb: [4000, 1600, 0.3] },
    c: { t: 'p', F: [250, 2200, 3000], d: 70, vyb: [3300, 1000, 0.45] }, J: { t: 'p', F: [250, 2200, 3000], d: 60, zn: 1, vyb: [3100, 1000, 0.35] },
    k: { t: 'p', F: [250, 1650, 2100], d: 70, vyb: [1900, 600, 0.45] }, g: { t: 'p', F: [250, 1650, 2100], d: 60, zn: 1, vyb: [1800, 600, 0.35] },
    ts: { t: 'a', F: [250, 1700, 2700], d: 105, sum: [5600, 1800, 0.5] }, dz: { t: 'a', F: [250, 1700, 2700], d: 95, zn: 1, sum: [5600, 1800, 0.35] },
    tS: { t: 'a', F: [250, 1900, 2500], d: 110, sum: [2800, 1100, 0.6] }, dZ: { t: 'a', F: [250, 1900, 2500], d: 100, zn: 1, sum: [2800, 1100, 0.4] },
    f: { t: 'f', F: [250, 900, 2300], d: 90, sum: [5000, 5000, 0.18] }, v: { t: 'f', F: [250, 900, 2300], d: 60, zn: 1, sum: [5000, 5000, 0.06] },
    s: { t: 'f', F: [250, 1700, 2700], d: 100, sum: [5800, 1800, 0.55] }, z: { t: 'f', F: [250, 1700, 2700], d: 90, zn: 1, sum: [5800, 1800, 0.45] },
    S: { t: 'f', F: [250, 1900, 2500], d: 100, sum: [2800, 1100, 0.6] }, Z: { t: 'f', F: [250, 1900, 2500], d: 90, zn: 1, sum: [2800, 1100, 0.5] },
    x: { t: 'f', F: [300, 1500, 2200], d: 90, sum: [1500, 900, 0.35] }, h: { t: 'f', F: [500, 1400, 2500], d: 80, zn: 1, sum: [1300, 1600, 0.12], dech: 2.2 },
    // nul = nosová antirezonance (zářez ve spektru, podle místa závěru)
    m: { t: 'n', F: [270, 1000, 2200], d: 65, zn: 1, nul: 1000 }, n: { t: 'n', F: [270, 1600, 2600], d: 60, zn: 1, nul: 1700 }, N: { t: 'n', F: [270, 2100, 2900], d: 70, zn: 1, nul: 2200 },
    l: { t: 'l', F: [360, 1150, 2700], d: 55, zn: 1 }, j: { t: 'l', F: [290, 2200, 3000], d: 50, zn: 1 },
    r: { t: 'r', F: [450, 1350, 2100], d: 45, zn: 1 }, R: { t: 'r', F: [350, 1800, 2400], d: 75, zn: 1, sum: [3200, 1400, 0.25] },
    Rn: { t: 'r', F: [350, 1800, 2400], d: 75, sum: [3200, 1400, 0.4] },
  };
  const PAR = { p: 'b', t: 'd', c: 'J', k: 'g', f: 'v', s: 'z', S: 'Z', x: 'h', ts: 'dz', tS: 'dZ', Rn: 'R' };
  const ZNELA = {}, NEZNELA = {};
  for (const [a, b] of Object.entries(PAR)) { ZNELA[a] = b; NEZNELA[b] = a; }
  const parova = h => h in PAR || h in NEZNELA;
  const znela = h => !!(H[h] && H[h].zn);
  const samohl = h => H[h] && H[h].t === 'v';

  const ZOBRAZ = { 'a:': 'á', 'e:': 'é', 'i:': 'í', 'o:': 'ó', 'u:': 'ú', c: 'ť', J: 'ď', N: 'ň', S: 'š', Z: 'ž', x: 'ch', h: 'h', R: 'ř', Rn: 'ř̊', ts: 'c', dz: 'ʒ', tS: 'č', dZ: 'ǯ' };

  /* ---------- čísla slovy (0–999 999), delší po číslicích ---------- */
  const JED = ['nula', 'jedna', 'dva', 'tři', 'čtyři', 'pět', 'šest', 'sedm', 'osm', 'devět', 'deset', 'jedenáct', 'dvanáct', 'třináct', 'čtrnáct', 'patnáct', 'šestnáct', 'sedmnáct', 'osmnáct', 'devatenáct'];
  const DES = ['', '', 'dvacet', 'třicet', 'čtyřicet', 'padesát', 'šedesát', 'sedmdesát', 'osmdesát', 'devadesát'];
  const STA = ['', 'sto', 'dvě stě', 'tři sta', 'čtyři sta', 'pět set', 'šest set', 'sedm set', 'osm set', 'devět set'];
  function do999(n) {
    const s = Math.floor(n / 100), z = n % 100, out = [];
    if (s) out.push(STA[s]);
    if (z >= 20) { out.push(DES[Math.floor(z / 10)]); if (z % 10) out.push(JED[z % 10]); }
    else if (z || !s) out.push(JED[z]);
    return out.join(' ');
  }
  function cisloSlovy(t) {
    if (t.length > 6) return t.split('').map(c => JED[+c]).join(' ');
    const n = +t;
    if (n < 1000) return do999(n);
    const tis = Math.floor(n / 1000), zb = n % 1000;
    const tisSlovo = tis === 1 ? 'tisíc' : tis < 5 ? (tis === 2 ? 'dva' : do999(tis)) + ' tisíce' : do999(tis) + ' tisíc';
    return tisSlovo + (zb ? ' ' + do999(zb) : '');
  }

  /* ---------- text → hlásky ---------- */
  const DLOUHE = { 'á': 'a:', 'é': 'e:', 'í': 'i:', 'ý': 'i:', 'ó': 'o:', 'ú': 'u:', 'ů': 'u:' };
  const PROSTE = { a: 'a', e: 'e', i: 'i', y: 'i', o: 'o', u: 'u', b: 'b', d: 'd', f: 'f', g: 'g', h: 'h', j: 'j', k: 'k', l: 'l', m: 'm', n: 'n', p: 'p', r: 'r', s: 's', t: 't', v: 'v', w: 'v', z: 'z', c: 'ts', 'č': 'tS', 'š': 'S', 'ž': 'Z', 'ř': 'R', 'ň': 'N', 'ť': 'c', 'ď': 'J', 'ä': 'e', 'ö': 'e', 'ü': 'i', 'ë': 'e', 'ě': 'e' };
  const MEKCI = { d: 'J', t: 'c', n: 'N' };

  function slovoNaHlasky(w) {
    const out = [];
    for (let i = 0; i < w.length; i++) {
      const z = w[i], dal = w[i + 1];
      if (z === 'c' && dal === 'h') { out.push('x'); i++; continue; }
      if (z === 'd' && dal === 'ž') { out.push('dZ'); i++; continue; }
      if (MEKCI[z] && (dal === 'i' || dal === 'í' || dal === 'ě')) { out.push(MEKCI[z]); if (dal === 'ě') { out.push('e'); i++; } continue; }
      if ('bpvf'.includes(z) && dal === 'ě') { out.push(z, 'j', 'e'); i++; continue; }
      if (z === 'm' && dal === 'ě') { out.push('m', 'N', 'e'); i++; continue; }
      if (z === 'x') { out.push('k', 's'); continue; }
      if (z === 'q') { out.push('k'); if (dal === 'u') { out.push('v'); i++; } continue; }
      if (DLOUHE[z]) { out.push(DLOUHE[z]); continue; }
      if (PROSTE[z]) out.push(PROSTE[z]);
    }
    return out;
  }

  // text → fráze (mezi interpunkcí) → [{h, slovo, priz}] ; konec fráze: '.', '?', '!', ','
  function naFraze(text) {
    const t = String(text || '').toLowerCase().replace(/\d+/g, c => ' ' + cisloSlovy(c) + ' ').replace(/[%]/g, ' procent ').replace(/&/g, ' a ');
    const fraze = [];
    let akt = [], slovo = 0;
    const uzavri = konec => { if (akt.length) fraze.push({ hlasky: akt, konec }); akt = []; };
    for (const m of t.matchAll(/([\p{L}]+)|([.!?…;:,—–()"„“]+)/gu)) {
      if (m[1]) {
        const hl = slovoNaHlasky(m[1]);
        if (!hl.length) continue;
        // jednohláskové předložky (v, z, k, s) se vážou na další slovo – přízvuk nesou až s ním
        const predlozka = hl.length === 1 && !samohl(hl[0]);
        hl.forEach(h => akt.push({ h, slovo }));
        if (!predlozka) slovo++;
      } else {
        const p = m[2];
        uzavri(/\?/.test(p) ? '?' : /!/.test(p) ? '!' : /[.…;:]/.test(p) ? '.' : ',');
      }
    }
    uzavri('.');
    for (const f of fraze) { spodoba(f.hlasky); prizvuk(f.hlasky); }
    return fraze;
  }

  // spodoba znělosti zprava doleva; ř po neznělé souhlásce a na konci neznělé
  function spodoba(seq) {
    for (let i = seq.length - 1; i >= 0; i--) {
      const h = seq[i].h, dal = seq[i + 1];
      if (!parova(h)) continue;
      let cilZnela;
      if (dal && parova(dal.h) && dal.h !== 'v' && dal.h !== 'R' && dal.h !== 'Rn') cilZnela = znela(dal.h);
      else if (!dal) cilZnela = false;                               // konec fráze
      else if (dal.slovo !== seq[i].slovo && h !== 'R') cilZnela = false;   // konec slova před samohláskou/sonorou
      else continue;
      if (h === 'R' || h === 'Rn') continue;
      seq[i].h = cilZnela ? (ZNELA[h] || h) : (NEZNELA[h] || h);
    }
    for (let i = 0; i < seq.length; i++) {
      if (seq[i].h !== 'R') continue;
      const pred = seq[i - 1];
      if (!seq[i + 1] || (pred && pred.slovo === seq[i].slovo && parova(pred.h) && !znela(pred.h))) seq[i].h = 'Rn';
    }
  }

  function prizvuk(seq) {
    let posl = -1;
    for (const x of seq) if (x.slovo !== posl && samohl(x.h)) { x.priz = true; posl = x.slovo; }
  }

  const prepis = text => naFraze(text).map(f => f.hlasky.map((x, i) => (i && x.slovo !== f.hlasky[i - 1].slovo ? ' ' : '') + (ZOBRAZ[x.h] || x.h)).join('') + f.konec).join(' ');

  /* ---------- hlasy ---------- */
  const ZAKLAD = { f0: 110, formant: 1, rychlost: 1, intonace: 1, dech: 0.05, vibrato: 0, chveni: 0.15, zdroj: 'hlasivky', otevreni: 0.55 };
  const PRESETY = [
    { id: 'muz', nazev: '👨 Muž', param: {} },
    { id: 'zena', nazev: '👩 Žena', param: { f0: 205, formant: 1.17, dech: 0.12, otevreni: 0.65 } },
    { id: 'dite', nazev: '🧒 Dítě', param: { f0: 290, formant: 1.3, rychlost: 1.05, intonace: 1.3, otevreni: 0.65 } },
    { id: 'starec', nazev: '👴 Stařec', param: { f0: 100, formant: 0.95, rychlost: 0.85, vibrato: 0.5, chveni: 0.6, dech: 0.2 } },
    { id: 'robot', nazev: '🤖 Robot 80. let', param: { f0: 95, intonace: 0, chveni: 0, zdroj: 'pila', dech: 0 } },
    { id: 'pocitac', nazev: '🕹️ 8bitový počítač', param: { f0: 130, intonace: 0.4, chveni: 0, zdroj: 'obdelnik', dech: 0, rychlost: 1.1 } },
    { id: 'sepot', nazev: '🤫 Šepot', param: { zdroj: 'sum', f0: 120 } },
    { id: 'obr', nazev: '🗿 Obr', param: { f0: 65, formant: 0.8, rychlost: 0.8, chveni: 0.3 } },
    { id: 'skritek', nazev: '🧝 Skřítek', param: { f0: 360, formant: 1.4, rychlost: 1.2, intonace: 1.6 } },
  ];

  /* ---------- prozódie: hlásky → segmenty s délkou a cíli ---------- */
  function segmenty(fraze, p) {
    const out = [];
    const rychl = Math.max(0.4, p.rychlost);
    fraze.forEach((f, fi) => {
      const seq = f.hlasky, n = seq.length;
      // poslední slabika fráze: od poslední samohlásky
      let posledniSamo = -1;
      for (let i = n - 1; i >= 0; i--) if (samohl(seq[i].h)) { posledniSamo = i; break; }
      seq.forEach((x, i) => {
        const h = H[x.h];
        let d = h.d;
        if (x.priz) d *= 1.12;
        if (i >= posledniSamo && posledniSamo >= 0) d *= 1.35;   // protažení na konci fráze
        if (samohl(x.h) && seq[i + 1] && samohl(seq[i + 1].h)) d *= 0.8;   // dvojhlásky
        const poloha = n > 1 ? i / (n - 1) : 0;
        // melodie: deklinace + přízvuk + konec věty
        let ton = 1.06 - 0.14 * poloha;
        if (x.priz) ton *= 1.07;
        if (i >= posledniSamo && posledniSamo >= 0) {
          ton *= f.konec === '?' ? 1.35 : f.konec === ',' ? 1.06 : f.konec === '!' ? 0.9 : 0.86;
        }
        if (f.konec === '!' && poloha < 0.3) ton *= 1.12;
        out.push({ h: x.h, d: d / rychl, ton });
      });
      out.push({ h: '_', d: (f.konec === ',' ? 170 : 380) / rychl, ton: 0.85 });
    });
    return out;
  }

  /* ---------- klíčové body parametrů v čase (ms) ---------- */
  // parametry: F1 F2 F3, AV (znělost), AH (přídech), AF (šum), FF/BF (střed a šířka šumu)
  function stopa(segs, p) {
    const k = [];   // {t, F1, F2, F3, AV, AH, AF, FF, BF, ton}
    let t = 0;
    const bod = (tt, o) => k.push(Object.assign({ t: tt }, o));
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i], d = s.d, h = H[s.h];
      if (s.h === '_') {
        const pred = k[k.length - 1] || { F1: 500, F2: 1500, F3: 2500, FF: 3000, BF: 1000 };
        bod(t + 15, { F1: pred.F1, F2: pred.F2, F3: pred.F3, AV: 0, AH: 0, AF: 0, FF: pred.FF, BF: pred.BF, ton: s.ton });
        bod(t + d - 5, { F1: pred.F1, F2: pred.F2, F3: pred.F3, AV: 0, AH: 0, AF: 0, FF: pred.FF, BF: pred.BF, ton: s.ton });
        t += d; continue;
      }
      const [F1, F2, F3] = h.F, prech = Math.min(28, d * 0.3);
      const zaklad = { F1, F2, F3, FF: h.sum ? h.sum[0] : 3000, BF: h.sum ? h.sum[1] : 1000, ton: s.ton };
      if (h.t === 'v') {
        bod(t + prech, Object.assign({}, zaklad, { AV: 1, AH: 0, AF: 0 }));
        bod(t + d - prech, Object.assign({}, zaklad, { AV: 1, AH: 0, AF: 0 }));
      } else if (h.t === 'p' || h.t === 'a') {
        // závěr (u znělých tichý hlasový pruh), pak výbuch / šum polosykavky
        const zaver = h.t === 'p' ? d * 0.7 : d * 0.4;
        const zav = Object.assign({}, zaklad, { F1: 200, AV: h.zn ? 0.12 : 0, AH: 0, AF: 0 });
        bod(t + 3, zav); bod(t + zaver, zav);
        if (h.t === 'p') {
          let [fv, bv, av] = h.vyb;
          if (s.h === 'k' || s.h === 'g') {   // velární výbuch leží těsně nad F2 následující samohlásky
            const dal = segs.slice(i + 1, i + 3).find(x => H[x.h] && H[x.h].t === 'v');
            if (dal) { fv = H[dal.h].F[1] * 1.08; av *= 1.4; }
          }
          bod(t + zaver + 1, Object.assign({}, zaklad, { AV: 0, AH: 0, AF: av * 2.2, FF: fv, BF: bv }));
          bod(t + zaver + 9, Object.assign({}, zaklad, { AV: 0, AH: h.zn ? 0 : 0.25, AF: av * 0.5, FF: fv, BF: bv }));
          bod(t + d, Object.assign({}, zaklad, { AV: h.zn ? 0.6 : 0, AH: h.zn ? 0 : 0.15, AF: 0, FF: fv, BF: bv }));
        } else {
          const sila = h.sum[2] * 2;
          bod(t + zaver + 2, Object.assign({}, zaklad, { AV: h.zn ? 0.35 : 0, AH: 0, AF: sila }));
          bod(t + d - 8, Object.assign({}, zaklad, { AV: h.zn ? 0.35 : 0, AH: 0, AF: sila * 0.8 }));
        }
      } else if (h.t === 'f') {
        const sila = h.sum[2] * 2, av = h.zn ? (s.h === 'h' ? 0.3 : 0.4) : 0, ah = h.dech || 0;
        bod(t + Math.min(15, d * 0.2), Object.assign({}, zaklad, { AV: av, AH: ah, AF: sila }));
        bod(t + d - Math.min(15, d * 0.2), Object.assign({}, zaklad, { AV: av, AH: ah, AF: sila }));
      } else if (h.t === 'n' || h.t === 'l') {
        const av = h.t === 'n' ? 0.5 : 0.75;
        const nos = h.nul ? { NZ: 1, FNZ: h.nul } : {};
        bod(t + prech * 0.6, Object.assign({}, zaklad, { AV: av, AH: 0, AF: 0 }, nos));
        bod(t + d - prech * 0.6, Object.assign({}, zaklad, { AV: av, AH: 0, AF: 0 }, nos));
      } else if (h.t === 'r') {
        // kmit: krátké přerušení uprostřed (r), u ř navíc šum
        const av = s.h === 'Rn' ? 0 : 0.75, af = h.sum ? h.sum[2] * 2 : 0;
        const kmitu = s.h === 'r' ? 1 : 2;
        bod(t + 4, Object.assign({}, zaklad, { AV: av, AH: 0, AF: af }));
        for (let q = 0; q < kmitu; q++) {
          const st = t + d * (0.25 + q * 0.4 / kmitu);
          bod(st, Object.assign({}, zaklad, { AV: av, AH: 0, AF: af }));
          bod(st + 10, Object.assign({}, zaklad, { AV: av * 0.15, AH: 0, AF: af * 0.5 }));
          bod(st + 20, Object.assign({}, zaklad, { AV: av, AH: 0, AF: af }));
        }
        bod(t + d - 4, Object.assign({}, zaklad, { AV: av, AH: 0, AF: af }));
      }
      t += d;
    }
    return { body: k, delka: t };
  }

  /* ---------- syntéza ---------- */
  function rezonator() { return { y1: 0, y2: 0, A: 0, B: 0, C: 0 }; }
  function nastavRez(r, f, bw, sr) {
    const T = 1 / sr, C = -Math.exp(-2 * Math.PI * bw * T), B = 2 * Math.exp(-Math.PI * bw * T) * Math.cos(2 * Math.PI * f * T);
    r.A = 1 - B - C; r.B = B; r.C = C;
  }
  const krok = (r, x) => { const y = r.A * x + r.B * r.y1 + r.C * r.y2; r.y2 = r.y1; r.y1 = y; return y; };

  function nahoda(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function syntetizuj(text, param, sr = 22050, seed = 1) {
    const p = Object.assign({}, ZAKLAD, param || {});
    const fraze = naFraze(text);
    const segs = segmenty(fraze, p);
    const { body, delka } = stopa(segs, p);
    const n = Math.round((delka + 60) / 1000 * sr);
    const y = new Float32Array(n);
    if (body.length < 2) return y;
    const rnd = nahoda(seed), fs = p.formant;
    const kas = [rezonator(), rezonator(), rezonator(), rezonator(), rezonator()];
    const nul = { A: 1, B: 0, C: 0, x1: 0, x2: 0 };   // antirezonátor nosovek
    const rezSum = rezonator(), rezSum2 = rezonator(), dolni = { v: 0 };
    let bi = 0, faze = 1, perioda = sr / p.f0, predZdroj = 0, predSum = 0, ziskPulzu = 1;
    const BLOK = 32;
    let cur = null;
    for (let i = 0; i < n; i++) {
      const tms = i / sr * 1000;
      if (i % BLOK === 0) {
        while (bi + 1 < body.length - 1 && body[bi + 1].t <= tms) bi++;
        const a = body[bi], b = body[Math.min(bi + 1, body.length - 1)];
        const u = b.t > a.t ? Math.max(0, Math.min(1, (tms - a.t) / (b.t - a.t))) : 0;
        const L = (x, y2) => x + (y2 - x) * u;
        cur = { F1: L(a.F1, b.F1) * fs, F2: L(a.F2, b.F2) * fs, F3: L(a.F3, b.F3) * fs, AV: L(a.AV, b.AV), AH: L(a.AH, b.AH), AF: L(a.AF, b.AF), FF: L(a.FF, b.FF) * Math.sqrt(fs), BF: L(a.BF, b.BF), ton: L(a.ton, b.ton) };
        if (tms > body[body.length - 1].t) cur.AV = cur.AH = cur.AF = 0;
        cur.NZ = L(a.NZ || 0, b.NZ || 0);
        const fnz = (a.NZ ? a.FNZ : b.NZ ? b.FNZ : 1500) * fs;
        nastavRez(kas[0], cur.F1, 90 + 60 * cur.NZ, sr); nastavRez(kas[1], cur.F2, 110 + 250 * cur.NZ, sr); nastavRez(kas[2], cur.F3, 170 + 300 * cur.NZ, sr);
        nastavRez(nul, fnz, 150, sr);
        nastavRez(kas[3], 3500 * fs, 250, sr); nastavRez(kas[4], Math.min(4500 * fs, sr * 0.45), 300, sr);
        nastavRez(rezSum, Math.min(cur.FF, sr * 0.45), Math.max(200, cur.BF), sr);
        nastavRez(rezSum2, Math.min(cur.FF * 1.6, sr * 0.45), Math.max(300, cur.BF * 1.3), sr);
      }
      // hlasivkový zdroj
      faze += 1 / perioda;
      if (faze >= 1) {
        faze -= 1;
        let f0 = p.f0 * Math.pow(cur.ton, p.intonace);
        if (p.vibrato) f0 *= Math.pow(2, p.vibrato * Math.sin(2 * Math.PI * 5.5 * i / sr) / 12);
        if (p.chveni) f0 *= 1 + p.chveni * 0.03 * (rnd() * 2 - 1);
        perioda = sr / Math.max(40, f0);
        ziskPulzu = 1 + p.chveni * 0.15 * (rnd() * 2 - 1);
      }
      let zdroj;
      const op = p.otevreni;
      if (p.zdroj === 'pila') zdroj = (faze - 0.5) * 0.9;
      else if (p.zdroj === 'obdelnik') zdroj = faze < 0.5 ? 0.35 : -0.35;
      else if (p.zdroj === 'sum') zdroj = 0;
      else {
        // Rosenbergův puls (průtok), derivace = vyzařování ze rtů
        const tp = op * 0.72, tn = op * 0.28;
        const tok = faze < tp ? 0.5 * (1 - Math.cos(Math.PI * faze / tp)) : faze < op ? Math.cos(Math.PI * (faze - tp) / (2 * tn)) : 0;
        zdroj = (tok - predZdroj) * perioda * 0.08;
        predZdroj = tok;
      }
      if (p.zdroj === 'obdelnik' || p.zdroj === 'pila') { dolni.v += (zdroj - dolni.v) * 0.35; zdroj = dolni.v; }
      const sum = rnd() * 2 - 1;
      const sumBily = sum - predSum * 0.5; predSum = sum;
      const otevreno = faze < op ? 1 : 0.4;
      const av = p.zdroj === 'sum' ? 0 : cur.AV;
      const ah = cur.AH + (p.zdroj === 'sum' ? cur.AV * 0.9 : p.dech * cur.AV) ;
      let v = zdroj * av * ziskPulzu + sumBily * ah * 0.35 * (p.zdroj === 'sum' ? 1 : otevreno);
      if (cur.NZ > 0) {   // antirezonátor = převrácený rezonátor (Klatt)
        const z = (v - nul.B * nul.x1 - nul.C * nul.x2) / nul.A;
        nul.x2 = nul.x1; nul.x1 = v;
        v = v * (1 - cur.NZ) + z * cur.NZ;
      } else { nul.x2 = nul.x1; nul.x1 = v; }
      for (const r of kas) v = krok(r, v);
      const fr = cur.AF > 0 ? (krok(rezSum, sumBily) + 0.4 * krok(rezSum2, sumBily)) * cur.AF * 0.08 : (krok(rezSum, 0), krok(rezSum2, 0), 0);
      y[i] = v * 0.5 + fr;
    }
    // odstranit stejnosměrnou složku, normalizovat
    let s = 0, m = 0, pr = 0, py = 0;
    for (let i = 0; i < n; i++) { const v = y[i] - pr + 0.995 * py; pr = y[i]; py = v; y[i] = v; }
    for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(y[i]));
    if (m > 0) for (let i = 0; i < n; i++) y[i] = y[i] / m * 0.9;
    return y;
  }

  const API = { H, PRESETY, ZAKLAD, naFraze, slovoNaHlasky, spodoba, prepis, cisloSlovy, segmenty, stopa, syntetizuj };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else koren.HLASY_FORMANT = API;
})(typeof window !== 'undefined' ? window : globalThis);
