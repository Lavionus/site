/* ============================================================
   Srdce hory – grafika.js: pixel art řezu horou.

   Všechno se kreslí v kódu, žádné obrázky:
   - horniny: dlaždice 16×16 z palety a šumu, 4 varianty, vlastní
     detail pro každou (vrstvení vápence, zrnitost žuly, sloupce čediče…),
   - zadní stěna volných polí = ztmavená hornina + stín u okrajů,
   - rudy jako průhledné překryvy, voda a magma ve 4 snímcích,
   - objekty (jedle, houby, krápníky, brána, výheň…) kreslené
     po pixelech s automatickým obrysem.
   Vše se jednou předkreslí do malých pláten a kreslí se celými
   násobky zvětšení bez vyhlazování.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const S = 16, SNIMKU = 4;
  const { M, R, O, W, H, UDOLI, SNIH, MATERIAL, RUDA, pevne } = T.hora;
  const { mulberry32, smichej, sum2D } = T.nahoda;

  // --- barvy a plátna --------------------------------------------------------------
  const rgbCache = {};
  function rgb(c) {
    if (rgbCache[c]) return rgbCache[c];
    let v;
    if (c[0] === '#') v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255];
    else { const m = c.match(/[\d.]+/g).map(Number); v = [m[0], m[1], m[2], Math.round((m[3] ?? 1) * 255)]; }
    return (rgbCache[c] = v);
  }
  const hex = v => '#' + v.slice(0, 3).map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
  function ztmav(c, k, sed) {                 // k < 1 ztmaví, sed = míra odbarvení 0..1
    const v = rgb(c), s = (v[0] + v[1] + v[2]) / 3;
    return hex(v.map(x => (x + (s - x) * (sed || 0)) * k));
  }
  function platno(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function pixely(w, h, fn) {
    const c = platno(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const b = fn(x, y);
      if (!b) continue;
      const v = rgb(b), o = (y * w + x) * 4;
      img.data[o] = v[0]; img.data[o + 1] = v[1]; img.data[o + 2] = v[2]; img.data[o + 3] = v[3];
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  // kreslení po pixelech do pole barev, pak do plátna (s volitelným obrysem)
  function kresba(w, h) {
    const p = new Array(w * h).fill(null);
    return {
      w, h, p,
      bod(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) p[y * w + x] = c; },
      obd(x, y, sw, sh, c) { for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) this.bod(x + i, y + j, c); },
      je(x, y) { return x >= 0 && y >= 0 && x < w && y < h && p[y * w + x] != null; },
      hotovo(obrys) {
        return pixely(w, h, (x, y) => {
          const c = p[y * w + x];
          if (c) return c;
          if (obrys && (this.je(x - 1, y) || this.je(x + 1, y) || this.je(x, y - 1) || this.je(x, y + 1))) return obrys;
          return null;
        });
      },
    };
  }
  const OBRYS = 'rgba(14,10,18,.62)';

  // --- palety hornin: [základ, tmavá, světlá, detail, lesk] ---------------------------
  const PAL = {
    [M.HLINA]:    ['#7a5634', '#6a4a2c', '#8a6440', '#4f3620', '#a88256'],
    [M.JIL]:      ['#a15c3e', '#8f5035', '#b36a48', '#7a4029', '#c98a66'],
    [M.VAPENEC]:  ['#b3a687', '#a39678', '#c3b799', '#857a60', '#dcd2b6'],
    [M.ZULA]:     ['#968281', '#877372', '#a69190', '#5e4f50', '#d9b3aa'],
    [M.CEDIC]:    ['#4f5560', '#454a54', '#5b616d', '#33373f', '#78808e'],
    [M.HLUBINNY]: ['#3a2f45', '#31273b', '#45384f', '#221a2a', '#7a60a0'],
    [M.PODLOZI]:  ['#18161c', '#121015', '#201d25', '#0a090c', '#2e2a34'],
    [M.CIHLA]:    ['#8d8070', '#7f7364', '#9c8f7e', '#5f564b', '#b5a893'],
    [M.RUNA]:     ['#3d5d6e', '#344f5e', '#476b7e', '#253c48', '#7fe3ff'],
    [M.ZED]:      ['#8f8a82', '#7e7972', '#a39e95', '#5a5650', '#c2bdb4'],
    [M.SUT]:      ['#7a746a', '#5e5850', '#948d82', '#3e3a34', '#b0a898'],
    [M.OBSIDIAN]: ['#1e1628', '#150f1c', '#2c2238', '#0a070e', '#8a6ad8'],
  };
  const PEVNE_M = Object.keys(PAL).map(Number);

  function texturaHorniny(m, v, zed) {
    const p = PAL[m];
    const r = mulberry32(smichej(m, v, 3));
    const n = sum2D(smichej(m, v, 4));
    const k = kresba(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const s = n(x / 3.4, y / 3.4) + (r() - 0.5) * 0.22;
      k.bod(x, y, s < 0.36 ? p[1] : s > 0.66 ? p[2] : p[0]);
    }
    const rr = () => Math.floor(r() * S);
    if (m === M.HLINA) {                         // oblázky a kořínky
      for (let i = 0; i < 4; i++) { const x = rr(), y = rr(); k.obd(x, y, 2, 1, p[4]); k.bod(x, y + 1, p[3]); k.bod(x + 1, y + 1, p[3]); }
      for (let i = 0; i < 6; i++) k.bod(rr(), rr(), p[3]);
    } else if (m === M.JIL) {                    // zvlněné pruhy
      for (const y0 of [3, 9, 14]) for (let x = 0; x < S; x++) k.bod(x, y0 + Math.round(Math.sin((x + v * 3) / 2.5)), p[x % 5 ? 3 : 1]);
      for (let i = 0; i < 3; i++) k.bod(rr(), rr(), p[4]);
    } else if (m === M.VAPENEC) {                // vrstvení (zkameněliny jsou vzácný překryv)
      for (const y0 of [4 + (v & 1), 11]) {
        let x = 0;
        while (x < S) {                           // čára po kouscích s mezerami
          const d = 2 + Math.floor(r() * 5);
          for (let i = 0; i < d && x < S; i++, x++) { k.bod(x, y0, p[1]); if (r() < 0.35) k.bod(x, y0 - 1, p[2]); }
          x += 1 + Math.floor(r() * 2);
        }
      }
      for (let i = 0; i < 3; i++) k.bod(rr(), rr(), p[3]);
    } else if (m === M.ZULA) {                   // zrnitost: růžová, černá, bílá zrna
      for (let i = 0; i < 16; i++) k.bod(rr(), rr(), '#c69791');
      for (let i = 0; i < 10; i++) k.bod(rr(), rr(), p[3]);
      for (let i = 0; i < 5; i++) k.bod(rr(), rr(), '#e8dcd8');
    } else if (m === M.CEDIC) {                  // sloupcová odlučnost: nepravidelné svislé spáry
      for (const x0 of [2 + (v & 1) * 2, 9 + (v >> 1)]) {
        let x = x0;
        for (let y = 0; y < S; y++) {
          if (r() < 0.15) x += r() < 0.5 ? 1 : -1;
          k.bod(x, y, p[1]); if (r() < 0.6) k.bod(x + 1, y, p[2]);
        }
        const yj = 3 + Math.floor(r() * 10);     // příčná puklina
        for (let i = 1; i < 5; i++) k.bod(x0 + i, yj, p[1]);
      }
      for (let i = 0; i < 4; i++) k.bod(rr(), rr(), p[3]);
      for (let i = 0; i < 2; i++) k.bod(rr(), rr(), p[4]);
    } else if (m === M.HLUBINNY) {               // tmavý kámen s fialovými záblesky
      for (let i = 0; i < 7; i++) k.bod(rr(), rr(), p[3]);
      for (let i = 0; i < 3; i++) { const x = rr(), y = rr(); k.bod(x, y, p[4]); if (r() < 0.4) k.bod(x + 1, y, '#a88ad0'); }
    } else if (m === M.PODLOZI) {                // ostré praskliny
      let x = rr(), y = 0;
      while (y < S) { k.bod(x, y, p[3]); k.bod(x + 1, y, p[4]); y++; x += r() < 0.5 ? 1 : -1; }
    } else if (m === M.CIHLA) {                  // kvádrové zdivo předků
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const rad = y >> 2, posun = (rad & 1) * 4;
        const spara = y % 4 === 3 || (x + posun) % 8 === 7;
        if (spara) k.bod(x, y, p[3]);
        else if (y % 4 === 0 || (x + posun) % 8 === 0) k.bod(x, y, p[2]);
      }
    } else if (m === M.ZED) {                    // kladené kvádry různé délky
      const spary = [[0, 6, 11], [3, 9], [1, 7, 12], [4, 10]];
      for (let rad = 0; rad < 4; rad++) {
        const y0 = rad * 4;
        for (let x = 0; x < S; x++) { k.bod(x, y0 + 3, p[3]); if (r() < 0.7) k.bod(x, y0, p[2]); }
        for (const sx of spary[(rad + v) % 4]) for (let y = y0; y < y0 + 3; y++) k.bod(sx, y, p[3]);
      }
    } else if (m === M.SUT) {                    // napadané kameny různých velikostí
      for (let i = 0; i < 7; i++) {
        const x = rr(), y = rr(), w = 2 + Math.floor(r() * 3), h = 2 + Math.floor(r() * 2);
        k.obd(x, y, w, h, [p[0], p[2], p[1]][i % 3]); k.obd(x, y + h - 1, w, 1, p[3]); k.bod(x, y, p[4]);
      }
    } else if (m === M.OBSIDIAN) {               // sklovitý lesk
      for (let i = 0; i < 3; i++) { const x = rr(), y = rr(); for (let d = 0; d < 4; d++) k.bod(x + d, y - d, d ? p[2] : p[4]); }
    } else if (m === M.RUNA) {                   // velké kvádry, na některých svítí runa
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (y % 8 === 7 || (x + (y >> 3) * 8) % 16 === 15) k.bod(x, y, p[3]);
        else if (y % 8 === 0) k.bod(x, y, p[2]);
      }
      if (v === 1 || v === 3) {
        const RUNY = [[[1, 0], [1, 1], [1, 2], [1, 3], [0, 1], [2, 2]], [[0, 0], [1, 1], [2, 0], [1, 2], [1, 3]], [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [2, 0], [2, 2]]];
        for (const [dx, dy] of RUNY[v >> 1]) k.bod(6 + dx, 2 + dy, p[4]);
      }
    }
    if (!zed) return k.hotovo();
    // zadní stěna: tmavší a méně sytá, s jemnými svislými šmouhami
    const src = k.p.slice();
    return pixely(S, S, (x, y) => ztmav(src[y * S + x], (x * 7 + y) % 5 ? 0.46 : 0.4, 0.3));
  }

  function zkamenelina(v) {
    const k = kresba(S, S), p = PAL[M.VAPENEC];
    const x = 5 + v * 2, y = 6;                  // spirála amonitu
    for (const [dx, dy] of [[1, 0], [2, 0], [3, 1], [3, 2], [2, 3], [1, 3], [0, 2], [0, 1], [1, 1], [2, 2]]) k.bod(x + dx, y + dy, p[3]);
    k.bod(x + 1, y + 2, p[4]);
    return k.hotovo();
  }

  // neprozkoumaná hora: téměř černá s jemnou zrnitostí
  function texturaNeznama(v) {
    const r = mulberry32(smichej(77, v, 1));
    return pixely(S, S, () => { const q = r(); return q < 0.08 ? '#1b1920' : q < 0.2 ? '#131117' : '#0e0d12'; });
  }

  // --- rudy -------------------------------------------------------------------------
  const PAL_RUDY = {
    [R.UHLI]:     ['#17171b', '#2c2c33', '#5a5a66'],
    [R.ZELEZO]:   ['#7e2f1c', '#b0482e', '#e88a62'],
    [R.MED]:      ['#8e4a1e', '#d0793b', '#6fd19f'],
    [R.STRIBRO]:  ['#7d8794', '#c8d0da', '#ffffff'],
    [R.ZLATO]:    ['#a7751a', '#e8b52e', '#fff3a8'],
    [R.DRAHOKAM]: ['#136d67', '#2fc4b8', '#c8fff8'],
    [R.HVEZDNA]:  ['#43339a', '#8a74ff', '#f2eeff'],
  };
  function texturaRudy(ru, v) {
    const p = PAL_RUDY[ru], r = mulberry32(smichej(ru, v, 9));
    const k = kresba(S, S);
    if (ru === R.DRAHOKAM || ru === R.HVEZDNA) {  // krystaly
      for (let i = 0; i < 2 + (v & 1); i++) {
        const x = 2 + Math.floor(r() * 10), y = 2 + Math.floor(r() * 10);
        const c = ru === R.DRAHOKAM && (v + i) % 3 === 2 ? ['#7a1830', '#d33a5a', '#ffc0cc'] : p;
        k.bod(x + 1, y, c[1]); k.obd(x, y + 1, 3, 2, c[1]); k.bod(x + 1, y + 3, c[0]); k.bod(x, y + 2, c[0]);
        k.bod(x + 1, y + 1, c[2]);
      }
      if (ru === R.HVEZDNA) { const x = 3 + Math.floor(r() * 10); k.bod(x, 1, p[2]); k.bod(x - 1, 2, p[1]); k.bod(x + 1, 2, p[1]); k.bod(x, 3, p[1]); }
      return k.hotovo('rgba(10,8,14,.55)');
    }
    const kusu = ru === R.UHLI || ru === R.ZELEZO ? 5 : 4;
    for (let i = 0; i < kusu; i++) {
      const x = Math.floor(r() * 13), y = Math.floor(r() * 13), w = 2 + Math.floor(r() * 2), h = 2;
      k.obd(x, y, w, h, p[1]); k.bod(x + w - 1, y + h - 1, p[0]); k.bod(x, y, p[2]);
    }
    return k.hotovo('rgba(10,8,14,.45)');
  }

  // --- kapaliny ---------------------------------------------------------------------
  function texturaKapaliny(m, snimek, hladina) {
    const voda = m === M.VODA, n = sum2D(smichej(m, 5, 5));
    return pixely(S, S, (x, y) => {
      if (hladina && y < 3) return null;
      const s = n((x + snimek * (voda ? 1 : 0.6) * 4) / 4, y / 3 + snimek * (voda ? 0 : 0.35));
      if (voda) {
        if (hladina && y === 3) return 'rgba(190,230,255,.85)';
        return s > 0.7 ? 'rgba(92,158,226,.86)' : s < 0.3 ? 'rgba(30,78,150,.88)' : 'rgba(47,111,184,.86)';
      }
      if (hladina && y === 3) return '#ffd25a';
      return s < 0.3 ? '#8a2410' : s < 0.48 ? '#c9401a' : s < 0.66 ? '#e8621d' : s < 0.82 ? '#f59a2a' : '#ffd25a';
    });
  }

  // --- okraje a stíny ---------------------------------------------------------------
  // pevné pole: světlá horní hrana (na něj padá světlo), tmavá spodní
  function hrany() {
    const nahore = pixely(S, 2, (x, y) => y === 0 ? 'rgba(255,245,220,.28)' : 'rgba(255,245,220,.1)');
    const dole = pixely(S, 2, (x, y) => y === 1 ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.2)');
    const bok = pixely(1, S, () => 'rgba(0,0,0,.22)');
    // stín na zadní stěně u pevného souseda: 0 nahoře, 1 vpravo, 2 dole, 3 vlevo
    const stin = [0, 1, 2, 3].map(s => pixely(S, S, (x, y) => {
      const d = [y, S - 1 - x, S - 1 - y, x][s];
      return d === 0 ? 'rgba(0,0,0,.5)' : d === 1 ? 'rgba(0,0,0,.34)' : d === 2 ? 'rgba(0,0,0,.2)' : d < 5 ? 'rgba(0,0,0,.09)' : null;
    }));
    return { nahore, dole, bok, stin };
  }
  // tráva a sníh na povrchu (přesahují 3 px nad pole)
  function cepice(snih, v) {
    const r = mulberry32(smichej(snih ? 2 : 1, v, 11));
    const k = kresba(S, S + 3);
    for (let x = 0; x < S; x++) {
      if (snih) {
        const h = 2 + (r() < 0.4 ? 1 : 0);
        for (let y = 0; y < h + 3; y++) k.bod(x, y + 2 - (y < 1 && r() < 0.3 ? 1 : 0), y === 0 ? '#ffffff' : y < h + 1 ? '#e6eef7' : '#b9c7d8');
      } else {
        const c = ['#4f8f3a', '#5fa044', '#447e33'][x % 3];
        k.bod(x, 3, c); k.bod(x, 4, c); k.bod(x, 5, '#3a6a2a');
        if (r() < 0.3) k.bod(x, 6, '#3a6a2a');
        if (r() < 0.55) k.bod(x, 2, c);
        if (r() < 0.25) { k.bod(x, 1, '#6cb04e'); k.bod(x, 0, '#7cc25a'); }
      }
    }
    return k.hotovo();
  }

  // --- objekty ----------------------------------------------------------------------
  function strom(v) {
    const r = mulberry32(smichej(31, v, 1));
    const k = kresba(S, 32);
    const vys = 26 + (v & 3), baze = 32;
    k.obd(7, baze - 5, 2, 5, '#5b3a22'); k.bod(7, baze - 5, '#6e4a2c');
    const zel = ['#2c6a3a', '#23552f', '#3b8048', '#4c9656'];
    for (let y = baze - vys; y < baze - 4; y++) {
      const t = (y - (baze - vys)) / (vys - 4);
      const patro = (t * 4) % 1;                  // pilovitý okraj – čtyři patra větví
      const sir = Math.max(1, Math.round((1.5 + t * 5.5) * (0.65 + patro * 0.35)));
      for (let x = 8 - sir; x < 8 + sir; x++) {
        const okraj = x === 8 - sir || x === 8 + sir - 1;
        k.bod(x, y, okraj ? zel[1] : x < 8 ? zel[2] : zel[0]);
        if (!okraj && r() < 0.07) k.bod(x, y, zel[3]);
      }
    }
    return k.hotovo(OBRYS);
  }
  function ker(v) {
    const r = mulberry32(smichej(32, v, 1)), k = kresba(S, 10);
    for (let y = 2; y < 10; y++) for (let x = 2; x < 14; x++) {
      const dx = (x - 7.5) / 6, dy = (y - 7) / 5;
      if (dx * dx + dy * dy < 1) k.bod(x, y, dy < -0.2 ? '#4e8e3e' : r() < 0.5 ? '#3c7532' : '#356a2c');
    }
    for (let i = 0; i < 3; i++) k.bod(4 + Math.floor(r() * 8), 4 + Math.floor(r() * 4), '#c23b4a');
    return k.hotovo(OBRYS);
  }
  function balvan(v) {
    const k = kresba(S, 10);
    for (let y = 1; y < 10; y++) for (let x = 1; x < 15; x++) {
      const dx = (x - 7.5) / (6.5 - (v & 1)), dy = (y - 9) / 8;
      if (dx * dx + dy * dy < 1) k.bod(x, y, dy < -0.7 ? '#b8b4ad' : dx < -0.2 ? '#9c978f' : '#7f7a73');
    }
    k.bod(5, 4, '#d6d2cb'); k.bod(6, 3, '#d6d2cb');
    return k.hotovo(OBRYS);
  }
  function trava(v) {
    const r = mulberry32(smichej(33, v, 1)), k = kresba(S, 11);
    for (let i = 0; i < 6; i++) {
      const x = 1 + Math.floor(r() * 14), h = 6 + Math.floor(r() * 5);
      for (let y = 11 - h; y < 11; y++) k.bod(x + (y < 11 - h + 2 && r() < 0.5 ? 1 : 0), y, '#8fa84a');
      k.bod(x, 11 - h, '#e0c872'); k.bod(x, 12 - h, '#d8b85a'); k.bod(x + 1, 12 - h, '#e0c872');
    }
    return k.hotovo();
  }
  function houba(v) {
    const k = kresba(S, 24);
    const cap = v & 1 ? ['#3aa8a0', '#2b827c', '#9ff0e6'] : ['#8e4fb0', '#6d3a8a', '#e6c8f6'];
    const vys = 16 + (v & 2 ? 4 : 0);
    k.obd(6, 24 - vys + 4, 4, vys - 4, '#d9cdb5'); k.obd(9, 24 - vys + 4, 1, vys - 4, '#b3a68b');
    const y0 = 24 - vys;
    for (let y = 0; y < 6; y++) {
      const sir = [4, 6, 7, 8, 8, 7][y];
      for (let x = 8 - sir; x < 8 + sir; x++) k.bod(x, y0 + y, y === 5 ? cap[1] : cap[0]);
    }
    for (const [x, y] of [[4, 2], [9, 1], [11, 3], [6, 4]]) k.bod(x, y0 + y, cap[2]);
    return k.hotovo(OBRYS);
  }
  function krapnik(v) {
    const k = kresba(S, 13);
    for (const [x0, del] of [[4 + (v & 1), 12 - (v & 2) * 2], [10, 6 + (v & 1) * 2]]) {
      for (let y = 0; y < del; y++) {
        const sir = Math.max(1, Math.round(3 * (1 - y / del)));
        for (let x = 0; x < sir; x++) k.bod(x0 + x - (sir >> 1), y, x === 0 ? '#e0d6bb' : '#b8ad8f');
      }
      k.bod(x0, del, 'rgba(160,210,255,.9)');   // kapka
    }
    return k.hotovo(OBRYS);
  }
  function deska() {
    const k = kresba(S, 16);
    k.obd(3, 1, 10, 15, '#6f6a70'); k.obd(3, 1, 10, 1, '#8b858c'); k.obd(12, 1, 1, 15, '#555057');
    k.obd(2, 14, 12, 2, '#5c575e');
    for (const [x, y] of [[5, 4], [5, 5], [5, 6], [6, 5], [9, 3], [9, 4], [10, 5], [9, 6], [5, 9], [6, 10], [7, 9], [9, 9], [9, 10], [9, 11], [10, 10]])
      k.bod(x, y, '#7fe3ff');
    return k.hotovo(OBRYS);
  }
  function kosti() {
    const k = kresba(S, 7);
    k.obd(2, 1, 4, 3, '#e8e2d0'); k.bod(3, 2, '#3a3530'); k.bod(5, 2, '#3a3530'); k.obd(3, 4, 2, 1, '#cfc8b4');
    for (let x = 7; x < 14; x++) k.bod(x, 5, '#ddd6c2');
    k.bod(7, 4, '#ddd6c2'); k.bod(13, 4, '#ddd6c2'); k.bod(7, 6, '#ddd6c2'); k.bod(13, 6, '#ddd6c2');
    return k.hotovo(OBRYS);
  }
  function krystal(v) {
    const k = kresba(S, 14);
    const c = v & 1 ? ['#8ff0ff', '#4fb0d0', '#2a6f8f'] : ['#d8a8ff', '#9a6ad8', '#5a3a8f'];
    for (const [x0, h] of [[4, 9], [7, 13], [10, 7]]) {
      for (let y = 14 - h; y < 14; y++) { k.bod(x0, y, c[1]); k.bod(x0 + 1, y, c[2]); if (y > 14 - h + 1) k.bod(x0 - 1, y, c[0]); }
      k.bod(x0, 14 - h - 1, c[0]);
    }
    return k.hotovo(OBRYS);
  }
  function sloup() {
    const k = kresba(S, 64);
    const p = PAL[M.CIHLA];
    k.obd(1, 0, 14, 4, p[0]); k.obd(1, 3, 14, 1, p[3]); k.obd(0, 0, 16, 1, p[2]);
    k.obd(4, 4, 8, 56, p[0]); k.obd(4, 4, 2, 56, p[2]); k.obd(11, 4, 1, 56, p[3]);
    for (let y = 10; y < 60; y += 12) k.obd(4, y, 8, 1, p[3]);
    k.obd(2, 60, 12, 4, p[0]); k.obd(2, 60, 12, 1, p[2]); k.obd(1, 63, 14, 1, p[3]);
    return k.hotovo(OBRYS);
  }
  function brana() {
    const k = kresba(32, 56), p = PAL[M.CIHLA];
    // dva sloupy a překlad s runami; otvor 16×48 uprostřed zůstane průhledný
    for (const x0 of [0, 24]) {
      k.obd(x0, 8, 8, 48, p[0]); k.obd(x0, 8, 2, 48, p[2]); k.obd(x0 + 7, 8, 1, 48, p[3]);
      for (let y = 16; y < 56; y += 8) k.obd(x0, y, 8, 1, p[3]);
    }
    k.obd(0, 0, 32, 8, p[0]); k.obd(0, 0, 32, 1, p[2]); k.obd(0, 7, 32, 1, p[3]);
    for (const [x, y] of [[10, 2], [10, 3], [10, 4], [11, 3], [15, 2], [16, 3], [15, 4], [16, 5], [20, 2], [21, 3], [20, 4], [21, 5], [22, 4]]) k.bod(x, y, '#e0b54a');
    // pootevřená vrata: úzké tmavé pásy dřeva u sloupů
    for (const x0 of [8, 22]) { k.obd(x0, 8, 2, 48, '#5b3a22'); for (let y = 14; y < 56; y += 10) k.obd(x0, y, 2, 1, '#8a8a8a'); }
    return k.hotovo(OBRYS);
  }
  function vyhen() {
    const k = kresba(48, 32), p = PAL[M.RUNA];
    k.obd(2, 18, 44, 14, p[0]); k.obd(2, 18, 44, 1, p[2]); k.obd(2, 31, 44, 1, p[3]);
    for (let x = 2; x < 46; x += 11) k.obd(x, 18, 1, 14, p[3]);
    k.obd(8, 6, 32, 12, '#4a4550'); k.obd(8, 6, 32, 1, '#6a6470'); k.obd(4, 4, 40, 3, '#5a5560');
    k.obd(16, 10, 16, 8, '#15121a');               // vyhaslé ohniště
    for (const [x, y] of [[18, 16], [21, 15], [25, 16], [29, 15]]) k.bod(x, y, '#5a2a18');
    k.obd(20, 0, 8, 4, '#4a4550'); k.obd(20, 0, 8, 1, '#6a6470');
    for (const [x, y] of [[7, 22], [7, 24], [8, 23], [40, 22], [40, 24], [39, 23], [23, 24], [24, 25], [25, 24]]) k.bod(x, y, p[4]);
    return k.hotovo(OBRYS);
  }

  // --- trpaslíci ------------------------------------------------------------------------
  // snímky: stoji, jde0, jde1, kope0 (rozmach), kope1 (úder), leze0, leze1, nese0, nese1, pada
  const KUZE = '#e8b894', KUZE_T = '#c98f6c', TUNIKA = '#6b4a2a', KALHOTY = '#4a3b2e', BOTY = '#2e231b';
  const NASADA = '#8a5a2e', ZELEZO = '#a9b0ba', ZELEZO_T = '#6c737c';
  function trpaslik(barva, vous, snimek, hornik, nastroj) {
    const k = kresba(S, S);
    const druh = nastroj ? nastroj.druh : 'krumpac';
    const ZEL = nastroj ? (nastroj.mat === 'med' ? '#d0793b' : '#a9b0ba') : '#8a847a', ZEL_T = nastroj ? (nastroj.mat === 'med' ? '#8e4a1e' : '#6c737c') : '#5f5a54';
    const tm = ztmav(barva, 0.72);
    // nohy
    const nohy = { jde0: [[4, 5], [10, 11]], jde1: [[6, 7], [8, 9]], nese0: [[4, 5], [10, 11]], nese1: [[6, 7], [8, 9]],
                   leze0: [[5, 6], [9, 10]], leze1: [[6, 7], [9, 10]], pada: [[3, 4], [11, 12]] }[snimek] || [[5, 6], [9, 10]];
    for (const [a, b] of nohy) { k.obd(a, 12, 2, 2, KALHOTY); k.obd(a, 14, 2, 2, BOTY); if (b !== a + 1) k.bod(b, 14, BOTY); }
    // tělo, opasek
    k.obd(5, 8, 6, 4, TUNIKA); k.obd(5, 11, 6, 1, '#3a2a1a'); k.bod(8, 11, '#d6b24a');
    // hlava: obličej, oko, nos
    k.obd(7, 5, 4, 3, KUZE); k.bod(9, 6, '#2a1a14'); k.bod(11, 7, KUZE_T); k.bod(11, 6, KUZE);
    if (nastroj && nastroj.zbroj) { k.obd(5, 8, 6, 3, nastroj.zbroj === 'med' ? '#c07040' : '#9aa0aa'); k.obd(5, 8, 6, 1, nastroj.zbroj === 'med' ? '#e0a070' : '#c8ccd2'); }
    // kapuce / přilba
    k.obd(7, 2, 3, 1, barva); k.obd(6, 3, 5, 1, barva); k.obd(5, 4, 7, 1, tm); k.obd(6, 5, 1, 2, barva);
    if (hornik) k.bod(11, 3, '#fff3a0');
    // vousy přes hrudník
    k.obd(7, 7, 5, 3, vous); k.obd(8, 10, 3, 1, vous); k.bod(9, 11, vous); k.bod(11, 7, KUZE_T);
    k.bod(10, 8, ztmav(vous, 0.8)); k.bod(8, 9, ztmav(vous, 0.8));
    // ruce a krumpáč
    // hlava nástroje: krumpáč = obě strany, sekera = jen čepel, kladivo = kvádr (barvy podle kovu)
    const krumpac = (hx, hy, dx, dy, delka, hlava) => {
      for (let i = 0; i < delka; i++) k.bod(hx + dx * i, hy + dy * i, NASADA);
      hlava.forEach(([x, y, c], n) => {
        if (druh === 'sekera' && n >= 3) return;
        if (druh === 'kladivo' && n >= 3) return;
        k.bod(x, y, c === ZELEZO ? ZEL : ZEL_T);
      });
      if (druh === 'kladivo') { const [x, y] = hlava[1]; k.bod(x + (dx ? 0 : 1), y + (dx ? 1 : 0), ZEL_T); }
      if (druh === 'sekera') { const [x, y] = hlava[0]; k.bod(x + (dx ? 0 : 1), y + (dx ? 1 : 0), ZEL); }
    };
    if (snimek === 'kope0') {
      k.bod(11, 8, KUZE);
      krumpac(11, 8, 1, -1, 5, [[13, 3, ZELEZO], [14, 3, ZELEZO], [15, 4, ZELEZO_T], [12, 2, ZELEZO], [11, 2, ZELEZO_T]]);
    } else if (snimek === 'kope1') {
      k.bod(11, 9, KUZE);
      krumpac(11, 9, 1, 0, 4, [[14, 7, ZELEZO], [14, 8, ZELEZO], [14, 10, ZELEZO], [14, 11, ZELEZO_T], [15, 12, ZELEZO_T]]);
    } else if (snimek.startsWith('leze') || snimek.startsWith('nese') || snimek === 'pada') {
      const l = snimek === 'leze1' ? 1 : 0;
      k.obd(4, 6 - l, 1, 3, KUZE); k.obd(11, 5 + l, 1, 3, KUZE);
      k.bod(4, 5 - l, KUZE); k.bod(11, 4 + l, KUZE);
    } else {
      k.obd(4, 8, 1, 3, TUNIKA); k.bod(4, 11, KUZE);
      krumpac(3, 12, 0, -1, 7, [[1, 5, ZELEZO_T], [2, 5, ZELEZO], [3, 5, ZELEZO], [4, 5, ZELEZO], [5, 6, ZELEZO_T]]);
    }
    return k.hotovo(OBRYS);
  }
  const SNIMKY_T = ['stoji', 'jde0', 'jde1', 'kope0', 'kope1', 'leze0', 'leze1', 'nese0', 'nese1', 'pada'];
  const cacheTrp = new Map();
  function spriteTrpaslika(barva, vous, snimek, hornik, zrcadlo, nastroj) {
    const klic = barva + vous + snimek + (hornik ? 'h' : '') + (zrcadlo ? 'z' : '') + (nastroj ? nastroj.druh + nastroj.mat + (nastroj.zbroj || '') : '');
    let c = cacheTrp.get(klic);
    if (c) return c;
    const zaklad = trpaslik(barva, vous, snimek, hornik, nastroj);
    if (!zrcadlo) c = zaklad;
    else { c = platno(S, S); const x = c.getContext('2d'); x.translate(S, 0); x.scale(-1, 1); x.drawImage(zaklad, 0, 0); }
    cacheTrp.set(klic, c);
    return c;
  }

  // --- věci na zemi --------------------------------------------------------------------
  function vec(druh, mat) {
    const k = kresba(12, 8);
    const hrouda = (p0, p1, p2) => {
      k.obd(2, 3, 8, 5, p0); k.obd(3, 2, 6, 1, p0); k.obd(4, 1, 3, 1, p2); k.obd(3, 2, 2, 1, p2);
      k.obd(7, 5, 3, 2, p1); k.obd(2, 7, 8, 1, p1);
    };
    const RUDY_Z = { zelezo: R.ZELEZO, med: R.MED, stribro: R.STRIBRO, zlato: R.ZLATO };
    if (druh === 'kamen') { const p = PAL[mat] || PAL[M.VAPENEC]; hrouda(p[0], p[1], p[2]); }
    else if (druh === 'jil') hrouda('#a15c3e', '#7a4029', '#c98a66');
    else if (druh === 'uhli') { hrouda('#222226', '#141417', '#4a4a55'); k.bod(6, 4, '#6a6a78'); }
    else if (RUDY_Z[druh]) {
      const r = PAL_RUDY[RUDY_Z[druh]];
      hrouda('#6d6a66', '#4e4b48', '#8f8b86');
      for (const [x, y] of [[4, 3], [7, 4], [5, 6], [8, 6]]) k.bod(x, y, r[1]);
      k.bod(4, 2, r[2]);
    } else if (druh === 'drahokam' || druh === 'hvezdna') {
      const r = PAL_RUDY[druh === 'drahokam' ? R.DRAHOKAM : R.HVEZDNA];
      k.obd(4, 2, 4, 1, r[2]); k.obd(3, 3, 6, 2, r[1]); k.obd(4, 5, 4, 1, r[1]); k.obd(5, 6, 2, 1, r[0]);
      k.bod(4, 3, r[2]);
    }
    return k.hotovo(OBRYS);
  }
  const cacheVeci = new Map();
  function spriteVeci(druh, mat) {
    const vyrobek = ['drevo', 'postel', 'stul', 'zidle', 'socha', 'jidlo', 'pivo', 'houby', 'jecmen', 'krumpac', 'sekera', 'kladivo',
                     'brus', 'sperk', 'pohar', 'valecna_sekera', 'zbroj', 'hedvabi', 'cepel', 'klic'].includes(druh) || druh.startsWith('prut_');
    const klic = druh + ':' + (druh === 'kamen' || vyrobek ? mat : '');
    if (!cacheVeci.has(klic)) cacheVeci.set(klic, vyrobek ? malyVyrobek(druh, mat) : vec(druh, mat));
    return cacheVeci.get(klic);
  }

  // vytesané schodiště: střídavé stupně
  function schodiste() {
    const k = kresba(S, S);
    for (const [y, x0] of [[3, 1], [7, 8], [11, 1], [15, 8]]) {
      k.obd(x0, y - 1, 7, 1, '#cfc4ad'); k.obd(x0, y, 7, 1, '#9c917c');
      k.obd(x0 + 1, y + 1 > 15 ? 15 : y + 1, 5, 1, 'rgba(0,0,0,.35)');
    }
    k.obd(7, 0, 2, 16, 'rgba(0,0,0,.22)');
    return k.hotovo();
  }
  function oznaceni(schody) {
    return pixely(S, S, (x, y) => {
      if (x === 0 || y === 0 || x === S - 1 || y === S - 1) return 'rgba(255,210,90,.85)';
      if ((x + y) % 5 === 0) return 'rgba(255,210,90,.6)';
      if (schody && (y === 5 && x >= 3 && x <= 7 || y === 10 && x >= 8 && x <= 12 || x === 7 && y >= 5 && y <= 10))
        return 'rgba(140,235,255,.95)';
      return 'rgba(255,210,90,.16)';
    });
  }
  function znackaPriority() {                      // ⭐ přednostní kopání – hvězdička v rohu
    const k = kresba(S, S), m = ['..#..', '.###.', '#####', '.###.', '#.#.#'];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (m[y][x] === '#') k.bod(S - 7 + x, 2 + y, '#fff27a');
    return k.hotovo('rgba(60,30,0,.8)');
  }
  function oznaceniKaceni() {                     // oranžový rám a sekerka
    const k = kresba(S, S);
    for (let i = 0; i < S; i++) for (const [x, y] of [[i, 0], [i, S - 1], [0, i], [S - 1, i]]) if ((i >> 1) % 2 === 0) k.bod(x, y, 'rgba(255,150,60,.95)');
    k.obd(10, 2, 1, 7, DREVO[2]); k.obd(8, 2, 2, 3, '#c8ccd2'); k.bod(7, 3, '#c8ccd2');
    return k.hotovo('rgba(20,10,0,.6)');
  }
  function praskliny(stupen) {
    const r = mulberry32(smichej(stupen, 5, 5));
    const k = kresba(S, S);
    const car = 2 + stupen * 2;
    for (let c = 0; c < car; c++) {
      let x = 8 + Math.floor((r() - 0.5) * 6), y = 8 + Math.floor((r() - 0.5) * 6);
      for (let i = 0; i < 3 + stupen * 2; i++) { k.bod(x, y, 'rgba(10,8,12,.8)'); x += Math.round((r() - 0.5) * 2.4); y += Math.round((r() - 0.5) * 2.4); }
    }
    return k.hotovo();
  }

  // --- stavby --------------------------------------------------------------------------
  const DREVO = ['#9a6a3a', '#7a4e28', '#b8844a', '#5b3a1e'];
  const KAMEN = ['#9a958d', '#77726b', '#b8b3ab', '#55514c'];
  const barvyMat = mat => mat === 'drevo' || mat === undefined ? DREVO : KAMEN;
  function zebrik() {
    const k = kresba(S, S);
    k.obd(3, 0, 2, 16, DREVO[1]); k.obd(11, 0, 2, 16, DREVO[1]); k.obd(3, 0, 1, 16, DREVO[2]); k.obd(11, 0, 1, 16, DREVO[2]);
    for (const y of [2, 6, 10, 14]) { k.obd(5, y, 6, 1, DREVO[2]); k.obd(5, y + 1, 6, 1, DREVO[3]); }
    return k.hotovo(OBRYS);
  }
  function podpera() {
    const k = kresba(S, S);
    k.obd(6, 2, 4, 14, DREVO[0]); k.obd(6, 2, 1, 14, DREVO[2]); k.obd(9, 2, 1, 14, DREVO[3]);
    k.obd(1, 0, 14, 2, DREVO[1]); k.obd(1, 0, 14, 1, DREVO[2]);
    k.bod(7, 5, DREVO[3]); k.bod(8, 11, DREVO[3]);
    return k.hotovo(OBRYS);
  }
  function dvere() {
    const k = kresba(S, S);
    k.obd(2, 0, 12, 16, DREVO[3]);
    for (let x = 3; x < 13; x++) for (let y = 1; y < 16; y++) k.bod(x, y, (x - 3) % 3 === 2 ? DREVO[1] : DREVO[0]);
    k.obd(3, 4, 10, 1, '#4a4a50'); k.obd(3, 11, 10, 1, '#4a4a50'); k.bod(11, 8, '#d6b24a');
    return k.hotovo(OBRYS);
  }
  function louc(snimek) {
    const k = kresba(S, S);
    k.obd(7, 11, 2, 3, '#3a3a40'); k.obd(6, 13, 4, 1, '#3a3a40');
    k.obd(7, 6, 2, 6, '#6b4423'); k.bod(7, 6, '#8a5a2e');
    const pl = [[[7, 1], [8, 2], [7, 3], [8, 3], [7, 4], [8, 4], [6, 4], [9, 4], [7, 5], [8, 5]],
                [[8, 1], [7, 2], [8, 2], [7, 3], [8, 3], [6, 3], [7, 4], [8, 4], [9, 4], [7, 5], [8, 5]],
                [[7, 0], [7, 1], [8, 2], [7, 2], [7, 3], [8, 3], [9, 3], [7, 4], [8, 4], [6, 4], [8, 5], [7, 5]]][snimek % 3];
    for (const [x, y] of pl) k.bod(x, y, y <= 1 ? '#fff3a0' : y <= 3 ? '#ffd25a' : '#ff8a2a');
    return k.hotovo();
  }
  function dilna(typ) {
    const k = kresba(32, 16);
    if (typ === 'tesarna') {
      k.obd(1, 7, 22, 2, DREVO[2]); k.obd(1, 9, 22, 1, DREVO[1]);
      k.obd(2, 10, 2, 6, DREVO[1]); k.obd(20, 10, 2, 6, DREVO[1]);
      for (let x = 6; x < 14; x++) k.bod(x, 6, x % 2 ? '#c8ccd2' : '#a9b0ba'); k.obd(14, 5, 3, 2, DREVO[3]);   // pila
      k.bod(4, 6, '#e8d2a0'); k.bod(18, 6, '#e8d2a0'); k.bod(10, 15, '#e8d2a0'); k.bod(15, 14, '#e8d2a0');   // hobliny
      for (const [x, y] of [[24, 12], [27, 12], [25, 9]]) { k.obd(x, y, 4, 3, DREVO[0]); k.bod(x, y + 1, DREVO[2]); k.bod(x + 3, y + 1, '#d9b98a'); }
    } else if (typ === 'kuchyne') {
      k.obd(1, 6, 16, 10, KAMEN[1]); k.obd(1, 6, 16, 1, KAMEN[2]); k.obd(4, 10, 10, 6, '#1a1210');   // ohniště
      for (const [x, y, c] of [[6, 13, '#ff8a2a'], [8, 12, '#ffd25a'], [10, 13, '#ff8a2a'], [9, 14, '#ffd25a'], [7, 14, '#c9401a']]) k.bod(x, y, c);
      k.obd(5, 2, 8, 4, '#3a3a40'); k.obd(5, 2, 8, 1, '#5a5a62'); k.obd(6, 1, 1, 1, '#e8e2d6'); k.obd(9, 0, 1, 1, '#e8e2d6');   // kotel a pára
      k.obd(19, 9, 11, 2, DREVO[2]); k.obd(20, 11, 1, 5, DREVO[1]); k.obd(28, 11, 1, 5, DREVO[1]);                              // stůl
      k.obd(21, 7, 3, 2, '#8e4fb0'); k.obd(25, 7, 3, 2, '#d8b85a'); k.bod(22, 6, '#e6c8f6');                                   // houby a klas
    } else if (typ === 'milir') {
      for (let y = 0; y < 10; y++) { const sir = Math.round(13 * Math.sqrt(1 - ((9 - y) / 10) ** 2)); k.obd(16 - sir, 6 + y, 2 * sir, 1, y < 2 ? '#6a5a44' : y % 3 ? '#5a4a36' : '#4a3c2a'); }
      k.obd(12, 12, 8, 4, '#1a1210'); for (const [x, y] of [[14, 14], [16, 13], [18, 14]]) k.bod(x, y, '#ff8a2a');
      for (const [x, y] of [[15, 3], [16, 1], [17, 4], [15, 0]]) k.bod(x, y, 'rgba(200,200,210,.7)');
    } else if (typ === 'tavirna') {
      k.obd(4, 2, 14, 14, KAMEN[1]); k.obd(4, 2, 14, 1, KAMEN[2]); k.obd(17, 2, 1, 14, KAMEN[3]);
      k.obd(7, 0, 8, 2, KAMEN[3]);                                                                             // komín
      k.obd(7, 9, 8, 6, '#2a1210'); k.obd(8, 10, 6, 4, '#c9401a'); k.obd(9, 11, 4, 2, '#ffd25a');                // výheň
      k.obd(20, 12, 10, 4, '#3a3a40'); k.obd(21, 13, 8, 2, '#e8621d'); k.bod(24, 13, '#ffd25a');                 // forma s kovem
    } else if (typ === 'kovarna') {
      k.obd(1, 6, 10, 10, KAMEN[1]); k.obd(1, 6, 10, 1, KAMEN[2]); k.obd(3, 9, 6, 5, '#2a1210'); k.obd(4, 11, 4, 2, '#e8621d'); k.bod(5, 11, '#ffd25a');
      k.obd(15, 9, 12, 3, '#4a4a52'); k.obd(15, 9, 12, 1, '#7a7a84'); k.obd(12, 9, 3, 2, '#4a4a52');           // kovadlina
      k.obd(18, 12, 6, 2, '#3a3a40'); k.obd(17, 14, 8, 2, DREVO[1]);
      k.obd(26, 3, 1, 6, DREVO[1]); k.obd(24, 2, 5, 2, '#6c737c');                                             // kladivo
    } else if (typ === 'brusirna') {
      k.obd(2, 10, 16, 2, DREVO[2]); k.obd(3, 12, 1, 4, DREVO[1]); k.obd(16, 12, 1, 4, DREVO[1]);
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const dx = x - 4, dy = y - 4; if (dx * dx + dy * dy <= 16) k.bod(6 + x, 1 + y, dx * dx + dy * dy <= 2 ? '#6c737c' : '#b8b3ab'); }
      k.obd(22, 11, 8, 5, KAMEN[1]); k.obd(22, 11, 8, 1, KAMEN[2]);
      k.obd(24, 8, 2, 3, '#2fc4b8'); k.bod(24, 8, '#c8fff8'); k.obd(27, 9, 2, 2, '#d33a5a');
    } else if (typ === 'pivovar') {
      for (const x0 of [1, 11]) {                                                                                                 // sudy
        k.obd(x0, 6, 9, 10, DREVO[0]); k.obd(x0, 6, 9, 1, DREVO[2]); k.obd(x0 + 8, 6, 1, 10, DREVO[3]);
        k.obd(x0, 8, 9, 1, '#4a4a50'); k.obd(x0, 13, 9, 1, '#4a4a50'); k.bod(x0 + 4, 11, '#2a1a10');
      }
      k.obd(21, 4, 10, 12, '#8a6a3a'); k.obd(21, 4, 10, 1, '#c9a574'); k.obd(22, 5, 8, 2, '#d9a53a'); k.bod(24, 5, '#fff3c0');   // káď s pěnou
      k.obd(21, 9, 10, 1, '#4a4a50');
    } else {
      k.obd(2, 8, 14, 8, KAMEN[1]); k.obd(2, 8, 14, 1, KAMEN[2]); k.obd(15, 8, 1, 8, KAMEN[3]);   // kamenný špalek
      k.obd(19, 10, 10, 6, KAMEN[0]); k.obd(19, 10, 10, 1, KAMEN[2]);                               // rozpracovaný kvádr
      for (const [x, y] of [[21, 12], [24, 13], [26, 11]]) k.bod(x, y, KAMEN[3]);
      k.obd(5, 6, 6, 2, '#6c737c'); k.obd(10, 3, 1, 5, DREVO[1]);                                    // palice
      k.obd(12, 5, 1, 3, '#a9b0ba');                                                                 // dláto
      k.bod(18, 15, KAMEN[2]); k.bod(30, 15, KAMEN[2]); k.bod(17, 14, KAMEN[0]);
    }
    return k.hotovo(OBRYS);
  }
  function postel(mat) {
    const c = barvyMat(mat), k = kresba(S, S);
    k.obd(1, 6, 2, 10, c[1]); k.obd(1, 6, 1, 10, c[2]);
    k.obd(3, 10, 12, 3, '#d8cdb5'); k.obd(3, 12, 12, 1, '#b8ab8f');
    k.obd(7, 9, 8, 3, '#a33a3a'); k.obd(7, 9, 8, 1, '#c24a4a');
    k.obd(3, 9, 3, 2, '#f2eee4');
    k.obd(3, 13, 12, 1, c[1]); k.obd(3, 14, 1, 2, c[3]); k.obd(14, 12, 1, 4, c[1]);
    return k.hotovo(OBRYS);
  }
  function stul(mat) {
    const c = barvyMat(mat), k = kresba(S, S);
    k.obd(1, 7, 14, 2, c[0]); k.obd(1, 7, 14, 1, c[2]); k.obd(1, 9, 14, 1, c[3]);
    k.obd(2, 10, 2, 6, c[1]); k.obd(12, 10, 2, 6, c[1]);
    if (mat !== 'drevo') k.obd(6, 10, 4, 6, c[1]);
    return k.hotovo(OBRYS);
  }
  function zidle(mat) {
    const c = barvyMat(mat), k = kresba(S, S);
    k.obd(4, 3, 2, 8, c[1]); k.obd(4, 3, 1, 8, c[2]);
    k.obd(4, 10, 8, 2, c[0]); k.obd(4, 10, 8, 1, c[2]);
    k.obd(4, 12, 2, 4, c[1]); k.obd(10, 12, 2, 4, c[1]);
    return k.hotovo(OBRYS);
  }
  function socha() {
    const k = kresba(S, 24), c = KAMEN;
    k.obd(2, 20, 12, 4, c[1]); k.obd(2, 20, 12, 1, c[2]);
    k.obd(5, 9, 6, 11, c[0]); k.obd(5, 9, 1, 11, c[2]);            // tělo
    k.obd(6, 4, 4, 4, c[0]); k.obd(5, 2, 6, 2, c[1]);               // hlava s přilbou
    k.obd(6, 7, 5, 6, c[2]); k.obd(7, 13, 3, 2, c[2]);              // vousy
    k.bod(9, 5, c[3]); k.obd(11, 8, 2, 8, c[1]); k.obd(11, 6, 3, 2, c[3]);   // kladivo
    return k.hotovo(OBRYS);
  }
  function parez() {
    const k = kresba(S, 7);
    k.obd(4, 2, 8, 5, DREVO[1]); k.obd(4, 2, 8, 1, '#d9b98a'); k.obd(5, 1, 6, 1, '#c9a574');
    k.bod(7, 1, DREVO[1]); k.bod(8, 2, DREVO[1]); k.obd(3, 6, 10, 1, DREVO[3]);
    return k.hotovo(OBRYS);
  }
  // úroda: [pole|houbarna][stupeň 0 zaseto, 1 roste, 2 zralé]
  function uroda() {
    const pole = [0, 1, 2].map(st => {
      const k = kresba(S, S);
      k.obd(0, 14, 16, 2, '#5a3a1e');
      for (let x = 1; x < 16; x += 3) {
        k.bod(x, 14, '#7a5230');
        if (st === 0) { k.bod(x, 13, '#6cb04e'); continue; }
        const vys = st === 1 ? 5 : 10;
        for (let y = 14 - vys; y < 14; y++) k.bod(x, y, st === 2 ? '#b8a04a' : '#5fa044');
        if (st === 2) { k.obd(x, 14 - vys - 2, 1, 3, '#e0c872'); k.bod(x + 1, 14 - vys, '#e0c872'); }
      }
      return k.hotovo();
    });
    const houby = [0, 1, 2].map(st => {
      const k = kresba(S, S);
      k.obd(0, 15, 16, 1, '#3a2a20');
      for (const [x, c] of [[2, '#8e4fb0'], [7, '#3aa8a0'], [12, '#8e4fb0']]) {
        if (st === 0) { k.bod(x, 14, '#d9cdb5'); continue; }
        const v = st === 1 ? 2 : 4, sir = st === 1 ? 1 : 2;
        k.obd(x, 15 - v, 1, v, '#d9cdb5');
        k.obd(x - sir, 15 - v - 2, 2 * sir + 1, 2, c); if (st === 2) k.bod(x, 15 - v - 2, '#f2e8ff');
      }
      return k.hotovo(OBRYS);
    });
    return { pole, houbarna: houby };
  }
  // tma podle světla (1 px = 1 pole, kreslí se vyhlazeně přes celý svět)
  let tmaPlatno = null, tmaKlic = '';
  function tma(hra, zn, vseZnamo) {
    const m = T.svetlo.mapy(hra), den = T.svetlo.denni(T.hra.hodina(hra));
    const klic = hra.svetloZmena + ':' + Math.round(den * 40) + ':' + (vseZnamo ? 1 : 0) + ':' + hra.vykopano;
    if (tmaPlatno && klic === tmaKlic) return tmaPlatno;
    if (!tmaPlatno) tmaPlatno = platno(W, H);
    const x = tmaPlatno.getContext('2d'), img = x.createImageData(W, H), d = img.data;
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      d[o] = 6; d[o + 1] = 8; d[o + 2] = 22;
      // neprozkoumané pole je samo tmavé; plná tma, aby se vyhlazením nerozsvítily sousední okraje
      if (!zn(i % W, i / W | 0)) { d[o + 3] = 205; continue; }
      const svetlo = Math.max(m.slunce[i] * den, m.louce[i]);
      const venku = hra.hora.pozadi[i] === M.VZDUCH;
      d[o + 3] = Math.round((1 - svetlo) * (venku ? 150 : 205));
    }
    x.putImageData(img, 0, 0);
    tmaKlic = klic;
    return tmaPlatno;
  }

  // malé ikony výrobků a polen, jak leží na zemi (12 × 8)
  function malyVyrobek(druh, mat) {
    const c = barvyMat(mat), k = kresba(12, 8);
    if (druh === 'drevo') {
      k.obd(1, 3, 10, 4, DREVO[0]); k.obd(1, 3, 10, 1, DREVO[2]); k.obd(1, 6, 10, 1, DREVO[1]);
      k.obd(9, 3, 2, 4, '#d9b98a'); k.bod(10, 4, DREVO[1]);
    } else if (druh === 'postel') {
      k.obd(1, 2, 1, 6, c[1]); k.obd(2, 4, 9, 2, '#d8cdb5'); k.obd(5, 4, 6, 1, '#a33a3a'); k.obd(2, 6, 9, 1, c[1]); k.bod(10, 7, c[1]);
    } else if (druh === 'stul') {
      k.obd(1, 3, 10, 1, c[2]); k.obd(1, 4, 10, 1, c[0]); k.obd(2, 5, 1, 3, c[1]); k.obd(9, 5, 1, 3, c[1]);
    } else if (druh === 'zidle') {
      k.obd(3, 1, 1, 5, c[1]); k.obd(3, 5, 5, 1, c[0]); k.obd(3, 6, 1, 2, c[1]); k.obd(7, 6, 1, 2, c[1]);
    } else if (druh === 'jidlo') {
      k.obd(2, 4, 8, 3, '#8a5a2e'); k.obd(3, 7, 6, 1, '#6b4423'); k.obd(3, 3, 6, 1, '#a0522d'); k.bod(4, 2, '#e8e2d6'); k.bod(7, 1, '#e8e2d6');
      k.bod(5, 3, '#d9a53a'); k.bod(7, 3, '#7a9a3a');
    } else if (druh === 'pivo') {
      k.obd(3, 2, 5, 6, '#9a6a3a'); k.obd(3, 2, 5, 1, '#fff3c0'); k.obd(3, 3, 5, 1, '#e0b43a'); k.obd(8, 3, 2, 3, '#7a4e28'); k.obd(3, 5, 5, 1, '#6b4423');
    } else if (druh === 'houby') {
      k.obd(1, 3, 4, 2, '#8e4fb0'); k.obd(2, 5, 2, 3, '#d9cdb5'); k.obd(6, 4, 4, 2, '#3aa8a0'); k.obd(7, 6, 2, 2, '#d9cdb5'); k.bod(2, 3, '#e6c8f6');
    } else if (druh === 'jecmen') {
      for (let x = 2; x < 10; x += 2) { k.obd(x, 3, 1, 5, '#b8a04a'); k.obd(x, 1, 1, 2, '#e0c872'); }
      k.obd(2, 5, 8, 1, '#8a6a2a');
    } else if (druh.startsWith('prut_')) {
      const c = { prut_zelezo: ['#6c737c', '#a9b0ba', '#d6dce4'], prut_med: ['#8e4a1e', '#d0793b', '#f2b07a'],
                  prut_stribro: ['#7d8794', '#c8d0da', '#ffffff'], prut_zlato: ['#a7751a', '#e8b52e', '#fff3a8'] }[druh];
      k.obd(1, 4, 10, 3, c[1]); k.obd(2, 3, 8, 1, c[2]); k.obd(1, 6, 10, 1, c[0]);
    } else if (druh === 'krumpac' || druh === 'sekera' || druh === 'kladivo') {
      const kov = mat === 'med' ? ['#8e4a1e', '#d0793b'] : ['#6c737c', '#a9b0ba'];
      k.obd(1, 5, 10, 1, DREVO[1]);
      if (druh === 'krumpac') { k.obd(8, 1, 1, 7, kov[1]); k.bod(7, 1, kov[0]); k.bod(7, 7, kov[0]); }
      else if (druh === 'sekera') { k.obd(8, 2, 3, 4, kov[1]); k.bod(10, 1, kov[0]); k.bod(10, 6, kov[0]); }
      else { k.obd(8, 3, 3, 5, kov[1]); k.obd(8, 3, 3, 1, kov[0]); }
    } else if (druh === 'brus') {
      k.obd(4, 2, 4, 1, '#c8fff8'); k.obd(3, 3, 6, 2, '#2fc4b8'); k.obd(4, 5, 4, 1, '#1a8a80'); k.obd(5, 6, 2, 1, '#136d67'); k.bod(4, 3, '#ffffff');
    } else if (druh === 'sperk') {
      for (const [x, y] of [[4, 3], [5, 2], [6, 2], [7, 3], [3, 4], [8, 4], [3, 5], [8, 5], [4, 6], [7, 6], [5, 7], [6, 7]]) k.bod(x, y, '#e8b52e');
      k.obd(5, 1, 2, 2, '#d33a5a');
    } else if (druh === 'pohar') {
      k.obd(3, 0, 6, 1, '#ffffff'); k.obd(3, 1, 6, 3, '#c8d0da'); k.obd(4, 4, 4, 1, '#9aa4b0'); k.obd(5, 5, 2, 2, '#9aa4b0'); k.obd(4, 7, 4, 1, '#c8d0da');
    } else if (druh === 'prut_hvezdny') {
      k.obd(1, 4, 10, 3, '#8a74ff'); k.obd(2, 3, 8, 1, '#e0d8ff'); k.obd(1, 6, 10, 1, '#43339a'); k.bod(4, 4, '#ffffff'); k.bod(8, 5, '#ffffff');
    } else if (druh === 'klic') {
      for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { const dx = x - 2, dy = y - 2; if (dx * dx + dy * dy <= 5 && dx * dx + dy * dy >= 2) k.bod(x, y + 1, '#e8b52e'); }
      k.obd(5, 3, 6, 1, '#e8b52e'); k.obd(8, 4, 1, 2, '#e8b52e'); k.obd(10, 4, 1, 3, '#e8b52e'); k.bod(2, 3, '#9f8cff');
    } else if (druh === 'valecna_sekera') {
      k.obd(1, 5, 10, 1, DREVO[1]); k.obd(7, 1, 4, 7, '#a9b0ba'); k.obd(10, 2, 1, 5, '#d6dce4'); k.bod(7, 1, '#6c737c'); k.bod(7, 7, '#6c737c');
    } else if (druh === 'zbroj') {
      const c = mat === 'med' ? ['#8e4a1e', '#d0793b'] : ['#6c737c', '#a9b0ba'];
      k.obd(2, 1, 8, 6, c[1]); k.obd(2, 1, 8, 1, c[0]); k.obd(1, 1, 1, 3, c[1]); k.obd(10, 1, 1, 3, c[1]); k.obd(3, 7, 6, 1, c[0]); k.bod(6, 4, '#d6b24a');
    } else if (druh === 'hedvabi') {
      for (let x = 1; x < 11; x++) k.bod(x, 4 + ((x & 1) ? 1 : 0), '#e8e6f2'); k.obd(3, 2, 6, 5, 'rgba(230,228,242,.6)'); k.bod(6, 4, '#ffffff');
    } else if (druh === 'cepel') {
      k.obd(1, 4, 8, 1, '#8a8f9a'); k.obd(1, 3, 7, 1, '#b8bcc4'); k.obd(9, 3, 2, 3, '#5a3a1e');
    } else if (druh === 'socha') {
      k.obd(3, 6, 6, 2, KAMEN[1]); k.obd(4, 2, 4, 4, KAMEN[0]); k.obd(5, 0, 2, 2, KAMEN[2]); k.obd(5, 3, 2, 2, KAMEN[2]);
    }
    return k.hotovo(OBRYS);
  }

  // sníh na horních hranách spritu (jedle, keře, balvany)
  function zasnez(zdroj) {
    const c = platno(zdroj.width, zdroj.height), x = c.getContext('2d');
    x.drawImage(zdroj, 0, 0);
    const img = x.getImageData(0, 0, c.width, c.height), d = img.data, w = c.width;
    const plny = (px, py) => py >= 0 && d[(py * w + px) * 4 + 3] > 200;
    for (let py = c.height - 1; py >= 0; py--) for (let px = 0; px < w; px++) {
      const o = (py * w + px) * 4;
      if (d[o + 3] < 200 || plny(px, py - 1)) continue;
      d[o] = 240; d[o + 1] = 246; d[o + 2] = 252;
      if (plny(px, py + 1) && (px + py) % 3) { const o2 = ((py + 1) * w + px) * 4; d[o2] = 214; d[o2 + 1] = 226; d[o2 + 2] = 238; }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  // podzim: zežloutnutí (louka)
  function prebarvi(zdroj, fn) {
    const c = platno(zdroj.width, zdroj.height), x = c.getContext('2d');
    x.drawImage(zdroj, 0, 0);
    const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let o = 0; o < d.length; o += 4) if (d[o + 3] > 200) { const [r, g, b] = fn(d[o], d[o + 1], d[o + 2]); d[o] = r; d[o + 1] = g; d[o + 2] = b; }
    x.putImageData(img, 0, 0);
    return c;
  }
  function led(v) {
    const r = mulberry32(smichej(88, v, 1));
    return pixely(S, S, (x, y) => {
      if (y === 0) return '#ffffff';
      const q = r();
      return q < 0.06 ? '#ffffff' : (x + y * 2 + v) % 9 === 0 ? '#e6f6ff' : y < 4 ? '#cfeaf6' : '#a9d4ea';
    });
  }
  function karavana() {
    const k = kresba(48, 26);
    // vůz s plachtou
    for (let x = 0; x < 26; x++) { const h = Math.round(9 * Math.sin(Math.PI * (x + 1) / 27)); k.obd(14 + x, 10 - h, 1, h + 2, x % 5 ? '#e8dcc0' : '#cbbd9c'); }
    k.obd(13, 12, 28, 6, DREVO[0]); k.obd(13, 12, 28, 1, DREVO[2]); k.obd(13, 17, 28, 1, DREVO[3]);
    for (const cx of [18, 35]) {
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) { const dx = x - 3, dy = y - 3; if (dx * dx + dy * dy <= 10 && dx * dx + dy * dy >= 4) k.bod(cx - 3 + x, 17 + y, '#3a2a1a'); }
      k.bod(cx, 20, '#6b4423');
    }
    k.obd(41, 14, 5, 1, DREVO[1]);                                                                             // oj
    // mula
    k.obd(2, 12, 9, 5, '#8a7a6a'); k.obd(0, 9, 3, 5, '#8a7a6a'); k.bod(0, 8, '#6a5a4a'); k.bod(2, 8, '#6a5a4a');
    k.obd(3, 17, 1, 5, '#5a4a3a'); k.obd(9, 17, 1, 5, '#5a4a3a'); k.bod(1, 11, '#1a1a1a'); k.obd(10, 12, 1, 3, '#5a4a3a');
    // kupec s kloboukem
    k.obd(29, 3, 5, 1, '#5a2a6a'); k.obd(30, 1, 3, 2, '#5a2a6a'); k.obd(30, 4, 3, 3, KUZE); k.bod(32, 5, '#2a1a14');
    return k.hotovo(OBRYS);
  }

  function pumpa() {
    const k = kresba(S, S);
    k.obd(3, 8, 10, 8, DREVO[0]); k.obd(3, 8, 10, 1, DREVO[2]); k.obd(3, 11, 10, 1, '#4a4a50');
    k.obd(7, 2, 2, 6, DREVO[1]); k.obd(4, 1, 9, 2, DREVO[1]); k.bod(12, 3, DREVO[3]);          // rameno
    k.obd(12, 9, 3, 2, '#6c737c'); k.bod(14, 11, 'rgba(120,190,255,.9)');                       // hubice s kapkou
    return k.hotovo(OBRYS);
  }
  // --- tvorové ---------------------------------------------------------------------------------
  function goblin(sn) {
    const k = kresba(S, S), kuze = '#6f9a3a', tm = '#4f7a2a';
    const nohy = sn ? [[5, 13], [9, 14]] : [[6, 14], [9, 13]];
    for (const [x, y] of nohy) { k.obd(x, y, 2, 16 - y, '#3a2a1a'); }
    k.obd(5, 8, 6, 5, '#6b4a2a'); k.obd(5, 12, 6, 1, '#3a2a1a');
    k.obd(5, 3, 6, 5, kuze); k.bod(4, 4, kuze); k.bod(3, 3, kuze); k.bod(11, 4, kuze); k.bod(12, 3, kuze);   // uši
    k.bod(9, 5, '#ffd25a'); k.bod(7, 5, '#ffd25a'); k.obd(7, 7, 3, 1, tm); k.bod(8, 7, '#e8e2d6');
    k.obd(11, 8, 1, 3, kuze);
    k.obd(12, sn ? 4 : 6, 1, 6, '#a9b0ba'); k.bod(12, sn ? 3 : 5, '#d6dce4'); k.obd(11, sn ? 9 : 11, 3, 1, '#5a3a1e');   // čepel
    return k.hotovo(OBRYS);
  }
  function pavouk(sn) {
    const k = kresba(S, S), c = '#2a2230', c2 = '#4a3a55';
    k.obd(5, 7, 7, 5, c); k.obd(6, 6, 5, 1, c2); k.obd(3, 8, 3, 3, c);           // tělo a hlava
    k.bod(3, 8, '#ff3a3a'); k.bod(4, 9, '#ff3a3a');
    for (let n = 0; n < 4; n++) {
      const x = 5 + n * 2, o = (n + sn) & 1;
      k.bod(x, 12, c2); k.bod(x - 1 + o, 13, c2); k.bod(x - 2 + o, 14 + (o ? 1 : 0), c2);
      k.bod(x, 6, c2); k.bod(x - 1 + o, 5, c2); k.bod(x - 2 + o, 4 - (o ? 1 : 0), c2);
    }
    k.bod(8, 9, '#8a6ad8');
    return k.hotovo(OBRYS);
  }
  function netopyr(sn) {
    const k = kresba(S, S), c = '#3a3040', c2 = '#5a4a62';
    k.obd(7, 7, 3, 3, c); k.bod(7, 6, c); k.bod(9, 6, c); k.bod(7, 8, '#ff5a5a'); k.bod(9, 8, '#ff5a5a');
    const kr = sn ? [[6, 7], [5, 6], [4, 5], [3, 6], [10, 7], [11, 6], [12, 5], [13, 6]] : [[6, 8], [5, 9], [4, 10], [3, 9], [10, 8], [11, 9], [12, 10], [13, 9]];
    for (const [x, y] of kr) { k.bod(x, y, c2); k.bod(x, y + 1, c); }
    return k.hotovo(OBRYS);
  }
  function spac(sn) {                             // velký tvor 24×20 z kamene a hvězdných krystalů
    const k = kresba(24, 20), c = '#241a30', c2 = '#3a2a4a', kr = '#9f8cff';
    for (let y = 0; y < 14; y++) for (let x = 0; x < 22; x++) { const dx = (x - 11) / 11, dy = (y - 8) / 7; if (dx * dx + dy * dy < 1) k.bod(x + 1, y + 2, dy < -0.3 ? c2 : c); }
    for (const [x, y] of [[6, 3], [10, 2], [14, 3], [18, 5]]) { k.bod(x, y, kr); k.bod(x, y - 1, '#e0d8ff'); k.bod(x + 1, y, '#6a5ad0'); }
    k.obd(19, 7, 3, 2, '#ff5a3a'); k.obd(15, 7, 2, 2, '#ff5a3a'); k.bod(20, 7, '#ffd25a');
    for (let n = 0; n < 4; n++) { const x = 4 + n * 5, o = (n + sn) & 1; k.obd(x, 15, 2, 3 + o, c); k.bod(x - 1 + o * 2, 18 + o, c2); }
    k.obd(19, 11, 4, 1, '#e8e2d6'); k.bod(20, 12, '#e8e2d6'); k.bod(22, 12, '#e8e2d6');
    return k.hotovo(OBRYS);
  }
  function past(spustena) {
    const k = kresba(S, S);
    k.obd(1, 13, 14, 3, KAMEN[1]); k.obd(1, 13, 14, 1, KAMEN[2]);
    if (spustena) { k.obd(3, 10, 10, 3, '#6c737c'); k.obd(3, 10, 10, 1, '#a9b0ba'); }
    else for (let x = 2; x < 14; x += 2) { k.bod(x, 12, '#a9b0ba'); k.bod(x, 11, '#d6dce4'); }
    return k.hotovo(OBRYS);
  }
  function mriz(zavrena) {
    const k = kresba(S, S);
    k.obd(0, 0, 16, 2, '#4a4a52'); k.obd(0, 0, 16, 1, '#7a7a84');
    const dno = zavrena ? 16 : 4;
    for (let x = 1; x < 16; x += 3) k.obd(x, 2, 1, dno - 2, '#6c737c');
    if (zavrena) for (const y of [6, 11]) k.obd(0, y, 16, 1, '#5a5a62');
    return k.hotovo(OBRYS);
  }
  function magmovyhen() {
    const k = kresba(32, 16), p = PAL[M.OBSIDIAN];
    k.obd(1, 5, 30, 11, p[0]); k.obd(1, 5, 30, 1, p[2]); for (const x of [8, 16, 24]) k.obd(x, 5, 1, 11, p[3]);
    k.obd(4, 9, 10, 5, '#c9401a'); k.obd(5, 10, 8, 3, '#f59a2a'); k.obd(7, 11, 4, 1, '#ffd25a');
    k.obd(19, 8, 10, 3, '#4a4a52'); k.obd(19, 8, 10, 1, '#7a7a84'); k.obd(22, 11, 4, 3, '#3a3a40');   // kovadlina
    k.obd(3, 2, 3, 3, p[3]); k.bod(4, 1, 'rgba(200,200,210,.6)');
    return k.hotovo(OBRYS);
  }

  // --- atlas --------------------------------------------------------------------------
  let atlas = null;
  function pripravAtlas() {
    if (atlas) return atlas;
    const a = { hornina: {}, zed: {}, ruda: {}, kap: {}, kapHl: {}, obj: {} };
    for (const m of PEVNE_M) {
      a.hornina[m] = [0, 1, 2, 3].map(v => texturaHorniny(m, v, false));
      a.zed[m] = [0, 1, 2, 3].map(v => texturaHorniny(m, v, true));
    }
    a.neznamo = [0, 1, 2, 3].map(texturaNeznama);
    a.zkamenelina = [0, 1, 2].map(zkamenelina);
    for (const r of Object.keys(PAL_RUDY).map(Number)) a.ruda[r] = [0, 1, 2, 3].map(v => texturaRudy(r, v));
    for (const m of [M.VODA, M.MAGMA]) {
      a.kap[m] = [0, 1, 2, 3].map(s => texturaKapaliny(m, s, false));
      a.kapHl[m] = [0, 1, 2, 3].map(s => texturaKapaliny(m, s, true));
    }
    a.hrany = hrany();
    a.trava = [0, 1, 2, 3].map(v => cepice(false, v));
    a.snih = [0, 1, 2, 3].map(v => cepice(true, v));
    const var4 = f => [0, 1, 2, 3].map(f);
    a.obj[O.STROM] = var4(strom); a.obj[O.KER] = var4(ker); a.obj[O.BALVAN] = var4(balvan);
    a.obj[O.TRAVA] = var4(trava); a.obj[O.HOUBA] = var4(houba); a.obj[O.KRAPNIK] = var4(krapnik);
    a.obj[O.KRYSTAL] = var4(krystal);
    const jedna = c => [c, c, c, c];
    a.obj[O.DESKA] = jedna(deska()); a.obj[O.KOSTI] = jedna(kosti()); a.obj[O.SLOUP] = jedna(sloup());
    a.obj[O.BRANA] = jedna(brana()); a.obj[O.VYHEN] = jedna(vyhen());
    a.hory = vzdaleneHory();
    a.schody = schodiste();
    a.ozn = [null, oznaceni(false), oznaceni(true)];
    a.prask = [0, 1, 2].map(praskliny);
    a.zebrik = zebrik(); a.podpera = podpera(); a.dvere = dvere(); a.louc = [0, 1, 2].map(louc);
    a.dilna = {};
    for (const typ of ['tesarna', 'kamenictvi', 'kuchyne', 'pivovar', 'milir', 'tavirna', 'kovarna', 'brusirna']) a.dilna[typ] = dilna(typ);
    a.dilna.magmovyhen = magmovyhen();
    a.dilna.zbrojnice = (() => {
      const k = kresba(32, 16);
      k.obd(2, 14, 28, 2, DREVO[1]); k.obd(3, 2, 1, 12, DREVO[1]); k.obd(28, 2, 1, 12, DREVO[1]); k.obd(3, 2, 26, 1, DREVO[2]);   // stojan
      k.obd(6, 4, 4, 7, '#8a8f9a'); k.obd(6, 4, 4, 1, '#c8ccd2'); k.bod(8, 7, '#d6b24a');                                           // zbroj
      k.obd(14, 3, 1, 10, DREVO[0]); k.obd(12, 3, 5, 3, '#a9b0ba');                                                                   // sekera
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const dx = x - 3.5, dy = y - 3.5; if (dx * dx + dy * dy < 14) k.bod(19 + x, 4 + y, dx * dx + dy * dy < 3 ? '#b23a2a' : dx * dx + dy * dy < 8 ? '#e8e2d6' : '#b23a2a'); }   // terč
      return k.hotovo(OBRYS);
    })();
    a.tvor = { goblin: [goblin(0), goblin(1)], pavouk: [pavouk(0), pavouk(1)], netopyr: [netopyr(0), netopyr(1)], spac: [spac(0), spac(1)] };
    a.dilna.runova_kovarna = (() => {
      const k = kresba(32, 16), p = PAL[M.RUNA];
      k.obd(1, 4, 30, 12, p[0]); k.obd(1, 4, 30, 1, p[2]); for (const x of [10, 21]) k.obd(x, 4, 1, 12, p[3]);
      for (const [x, y] of [[4, 7], [5, 8], [4, 9], [6, 9], [25, 7], [26, 8], [27, 7], [26, 10]]) k.bod(x, y, p[4]);
      k.obd(12, 8, 8, 6, '#1a1230'); k.obd(13, 10, 6, 3, '#6a5ad0'); k.obd(14, 11, 4, 1, '#e0d8ff');   // hvězdná výheň
      k.obd(13, 0, 6, 4, p[3]); k.bod(16, 1, '#9f8cff');
      return k.hotovo(OBRYS);
    })();
    a.vyhenHori = (() => {                       // plamen nad Výhní předků (48 × 32 jako výheň)
      const c = platno(48, 32), x = c.getContext('2d');
      x.drawImage(a.obj[O.VYHEN][0], 0, 0);
      x.fillStyle = '#c9401a'; x.fillRect(16, 10, 16, 8); x.fillStyle = '#f59a2a'; x.fillRect(18, 8, 12, 8);
      x.fillStyle = '#ffd25a'; x.fillRect(21, 6, 6, 8); x.fillStyle = '#fff3a0'; x.fillRect(23, 5, 2, 5);
      return c;
    })();
    a.past = [past(false), past(true)];
    a.mriz = [mriz(false), mriz(true)];
    a.pumpa = pumpa();
    a.uroda = uroda();
    a.nabytek = {};
    for (const mat of ['drevo', 'kamen']) a.nabytek[mat] = { postel: postel(mat), stul: stul(mat), zidle: zidle(mat), socha: socha() };
    a.obj[O.PAREZ] = [0, 1, 2, 3].map(() => parez());
    a.ozn[3] = oznaceniKaceni();
    a.prio = znackaPriority();
    a.zima = {};
    for (const o of [O.STROM, O.KER, O.BALVAN, O.PAREZ]) a.zima[o] = a.obj[o].map(zasnez);
    a.podzim = { [O.TRAVA]: a.obj[O.TRAVA].map(c => prebarvi(c, (r, g, b) => [Math.min(255, r + 40), g, Math.max(0, b - 20)])),
                 [O.KER]: a.obj[O.KER].map(c => prebarvi(c, (r, g, b) => g > r ? [Math.min(255, g + 30), Math.round(g * 0.7), b] : [r, g, b])) };
    a.led = [0, 1, 2, 3].map(led);
    a.karavana = karavana();
    return (atlas = a);
  }

  // vzdálené hory na obloze (dvě vrstvy siluet, jen tvar – barvu dodá kreslení)
  function vzdaleneHory() {
    const vrstvy = [];
    for (const [sd, amp, zakl] of [[1, 70, 150], [2, 46, 96]]) {
      const n = sum2D(smichej(sd, 7, 7)), vys = [];
      for (let x = 0; x < 1024; x++) vys.push(zakl + amp * (n(x / 90, 0) * 0.7 + n(x / 23, 3) * 0.3));
      vrstvy.push(vys);
    }
    return vrstvy;
  }

  // --- kreslení -----------------------------------------------------------------------
  /* stav = { hora, znamo, vseZnamo, vyber:{x,y}|null, najeti:{x,y}|null }
     kam  = { x, y, z } – levý horní roh v pixelech světa, z = px zařízení na pixel světa */
  const BARVY_NEBE = [['#5e9ad6', '#a9cfee', '#dcebf2'], ['#4f92d8', '#9fcaf0', '#e2f0f6'],
                      ['#6f8fb8', '#c2c4bc', '#e8dcc6'], ['#8ea6c0', '#c6d2de', '#eef2f6']];
  const nebe = (ctx, cw, ch, kam, sezona) => {
    const z = kam.z;
    // obloha: gradient podle světových souřadnic, pod údolím už není vidět
    const yh = (0 - kam.y) * z, yd = (UDOLI * S - kam.y) * z;
    const g = ctx.createLinearGradient(0, yh, 0, yd), b = BARVY_NEBE[sezona || 0];
    g.addColorStop(0, b[0]); g.addColorStop(0.7, b[1]); g.addColorStop(1, b[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, Math.min(ch, Math.max(0, yd + 4 * z)));
  };
  function kresliHory(ctx, a, cw, kam) {
    const z = kam.z;
    const barvy = ['#9db5d0', '#7f9bbb'], par = [0.25, 0.5];
    for (let v = 0; v < 2; v++) {
      const vys = a.hory[v];
      ctx.fillStyle = barvy[v];
      const dno = (UDOLI * S - kam.y) * z;
      const krok = Math.max(1, z);
      for (let sx = 0; sx < cw; sx += krok) {
        const wx = Math.floor((kam.x * par[v] + sx / z) / 2) & 1023;
        const vrch = dno - vys[wx] * z * (v ? 0.6 : 0.8);
        ctx.fillRect(sx, vrch, krok, dno - vrch);
      }
    }
  }
  function mraky(ctx, cw, kam, cas) {
    const z = kam.z;
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < 7; i++) {
      const r = mulberry32(smichej(i, 3, 3));
      const sirka = 30 + r() * 40, wy = 10 + r() * 150;
      const wx = ((r() * 2400 + cas * (4 + r() * 5)) % 2400) - 400 - kam.x * 0.35;
      const sx = Math.round(wx * z), sy = Math.round((wy - kam.y * 0.9) * z);
      if (sx > cw || sx + sirka * z < 0) continue;
      const k = Math.max(1, Math.round(z));
      for (let j = 0; j < 4; j++) {
        const w = sirka * (1 - Math.abs(j - 1.5) / 3), h = 3;
        ctx.fillRect(sx + (sirka - w) / 2 * z, sy + j * h * k, w * z, h * k);
      }
    }
  }

  function kresli(ctx, stav, kam, snimek, cas) {
    const a = pripravAtlas();
    const { hora, znamo } = stav;
    const { teren, pozadi, ruda, obj, varianta } = hora;
    const cw = ctx.canvas.width, ch = ctx.canvas.height, z = kam.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(0, 0, cw, ch);
    const sezona = stav.hra && T.obdobi ? T.obdobi.obdobi(stav.hra) : 0, zima = sezona === 3;
    nebe(ctx, cw, ch, kam, sezona);
    if (kam.y < UDOLI * S) { kresliHory(ctx, a, cw, kam); mraky(ctx, cw, kam, cas || 0); }

    const ox = Math.round(kam.x * z), oy = Math.round(kam.y * z);
    ctx.setTransform(z, 0, 0, z, -ox, -oy);
    const x0 = Math.max(0, Math.floor(kam.x / S) - 1), y0 = Math.max(0, Math.floor(kam.y / S) - 1);
    const x1 = Math.min(W - 1, Math.ceil((kam.x + cw / z) / S) + 1), y1 = Math.min(H - 1, Math.ceil((kam.y + ch / z) / S) + 4);
    const vse = stav.vseZnamo;
    const zn = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? false : vse || znamo[y * W + x];
    const pev = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? true : pevne(teren[y * W + x]);
    const s4 = snimek % SNIMKU;
    const hra = stav.hra, lez = hra && hra.lez;

    // 1) pole
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x, px = x * S, py = y * S, v = varianta[i];
      if (!zn(x, y)) { ctx.drawImage(a.neznamo[v], px, py); continue; }
      const t = teren[i];
      if (pevne(t)) {
        ctx.drawImage(a.hornina[t][v], px, py);
        if (ruda[i]) ctx.drawImage(a.ruda[ruda[i]][v], px, py);
        else if (t === M.VAPENEC && smichej(hora.seed, i, 7) % 29 === 0) ctx.drawImage(a.zkamenelina[i % 3], px, py);
        if (!pev(x, y - 1)) ctx.drawImage(a.hrany.nahore, px, py);
        if (!pev(x, y + 1)) ctx.drawImage(a.hrany.dole, px, py + S - 2);
        if (!pev(x - 1, y)) ctx.drawImage(a.hrany.bok, px, py);
        if (!pev(x + 1, y)) ctx.drawImage(a.hrany.bok, px + S - 1, py);
        continue;
      }
      const pz = pozadi[i];
      if (pz !== M.VZDUCH) {
        ctx.drawImage(a.zed[pz][v], px, py);
        if (pev(x, y - 1)) ctx.drawImage(a.hrany.stin[0], px, py);
        if (pev(x + 1, y)) ctx.drawImage(a.hrany.stin[1], px, py);
        if (pev(x, y + 1)) ctx.drawImage(a.hrany.stin[2], px, py);
        if (pev(x - 1, y)) ctx.drawImage(a.hrany.stin[3], px, py);
      }
      if (lez && lez[i]) ctx.drawImage(a.schody, px, py);
      if (zima && t === M.VODA && y > 0 && pozadi[i - W] === M.VZDUCH) { ctx.drawImage(a.led[v], px, py); continue; }
      if (t === M.VODA || t === M.MAGMA) {
        const hl = y > 0 && teren[i - W] === M.VZDUCH;
        ctx.drawImage((hl ? a.kapHl : a.kap)[t][(s4 + x) % SNIMKU], px, py);
      }
    }
    // 2) tráva a sníh na povrchu (jen venku – nad polem je obloha)
    for (let y = Math.max(1, y0); y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (!zn(x, y) || !pevne(teren[i]) || teren[i - W] !== M.VZDUCH || pozadi[i - W] !== M.VZDUCH) continue;
      if (teren[i] === M.CIHLA) continue;
      const cap = y < SNIH || zima ? a.snih : (teren[i] === M.HLINA || teren[i] === M.JIL) ? a.trava : y < SNIH + 3 ? a.snih : null;
      if (cap) ctx.drawImage(cap[varianta[i]], x * S, y * S - 3);
    }
    // 3) objekty (po řádcích shora, vysoké sprity přesahují nahoru)
    for (let y = y0; y <= Math.min(H - 1, y1 + 3); y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x, o = obj[i];
      if (!o || !zn(x, y)) continue;
      const venku = pozadi[i] === M.VZDUCH;
      if (zima && venku && o === O.TRAVA) continue;
      let img = (zima && venku && a.zima[o] ? a.zima[o] : sezona === 2 && venku && a.podzim[o] ? a.podzim[o] : a.obj[o])[varianta[i]];
      if (o === O.VYHEN && hra && hra.vyhenHori) img = a.vyhenHori;
      if (o === O.KRAPNIK) ctx.drawImage(img, x * S, y * S);
      else if (o === O.BRANA) ctx.drawImage(img, x * S - 8, (y + 1) * S - img.height);
      else ctx.drawImage(img, x * S + 8 - (img.width >> 1), (y + 1) * S - img.height);
    }
    if (hra && hra.karavana) {
      const b = hra.hora.brana, kx = (b.x - 6) * S - 16, ky = (b.y + 1) * S - a.karavana.height;
      ctx.drawImage(a.karavana, kx, ky);
    }
    if (hra) {
      kresliHru(ctx, a, stav, hra, x0, y0, x1, y1, zn, snimek);
      kresliTvory(ctx, a, stav, hra, i => { const x = i % W, y = i / W | 0; return x >= x0 && x <= x1 && y >= y0 - 1 && y <= y1; }, snimek);
      const dt = stav.dt || 0;
      if (dt) jiskryZeZdroju(hra, x0, y0, x1, y1);
      kresliCastice(ctx, false, dt);
      if (hra.svetloZmena !== undefined && !stav.bezTmy) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(tma(hra, zn, stav.vseZnamo), 0, 0, W, H, 0, 0, W * S, H * S);
        ctx.imageSmoothingEnabled = false;
        kresliCastice(ctx, true, stav.dt || 0);               // jiskry svítí i ve tmě
      }
    }
    // sněžení nad krajinou
    if (zima && kam.y < UDOLI * S) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      const t = cas || 0;
      for (let k = 0; k < 320; k++) {
        const r = mulberry32(smichej(k, 9, 9));
        const wx = (r() * W * S + Math.sin(t * 0.8 + k) * 6 + t * 3) % (W * S);
        const wy = (r() * (UDOLI * S) + t * (10 + r() * 14)) % (UDOLI * S);
        if (hra && pozadi[(wy / S | 0) * W + (wx / S | 0)] !== M.VZDUCH) continue;
        ctx.fillRect(Math.round(wx), Math.round(wy), 1, 1);
      }
    }
    // 4) výběr a najetí myší
    ctx.lineWidth = 1 / z;
    if (stav.najeti) {
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.strokeRect(stav.najeti.x * S + 0.5 / z, stav.najeti.y * S + 0.5 / z, S - 1 / z, S - 1 / z);
    }
    if (stav.vyber) {
      ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 2 / z;
      ctx.strokeRect(stav.vyber.x * S + 1 / z, stav.vyber.y * S + 1 / z, S - 2 / z, S - 2 / z);
    }
    // 5) hloubkové pravítko u levého okraje (v px zařízení)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = stav.dpr || 1;
    ctx.font = `${Math.round(11 * dpr)}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil((y0 - UDOLI) / 10) * 10 + UDOLI; y <= y1; y += 10) {
      if (y <= UDOLI) continue;
      const sy = Math.round((y * S - kam.y) * z);
      const txt = (y - UDOLI) + ' m';
      const w = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, sy - 8 * dpr, w + 16 * dpr, 16 * dpr);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillText(txt, 4 * dpr, sy);
      ctx.fillRect(w + 8 * dpr, sy, 8 * dpr, Math.max(1, dpr));   // značka vpravo od popisku, míří na řádek
    }
  }

  function kresliStavbu(ctx, a, hra, typ, i, mat, snimek) {
    const px = (i % W) * S, py = (i / W | 0) * S;
    const ST = T.stavby;
    if (typ === 'zebrik') ctx.drawImage(a.zebrik, px, py);
    else if (typ === 'podpera') ctx.drawImage(a.podpera, px, py);
    else if (typ === 'dvere') ctx.drawImage(a.dvere, px, py);
    else if (typ === 'louc') ctx.drawImage(a.louc[(snimek + i) % 3], px, py);
    else if (typ === 'pumpa') ctx.drawImage(a.pumpa, px, py);
    else if (typ === 'past') ctx.drawImage(a.past[hra.stavbaStav && hra.stavbaStav[i] ? 1 : 0], px, py);
    else if (typ === 'mriz') ctx.drawImage(a.mriz[hra.zavreno && hra.zavreno[i] ? 1 : 0], px, py);
    else if (typ === 'zed') ctx.drawImage(a.hornina[M.ZED][hra.hora.varianta[i]], px, py);
    else if (a.dilna[typ]) ctx.drawImage(a.dilna[typ], px, py);
    else if (ST.STAVBY[typ] && ST.STAVBY[typ].nabytek) {
      const img = a.nabytek[mat === 'drevo' ? 'drevo' : 'kamen'][typ];
      ctx.drawImage(img, px, py + S - img.height);
    }
  }
  function kresliHru(ctx, a, stav, hra, x0, y0, x1, y1, zn, snimek) {
    const vidi = i => { const x = i % W, y = i / W | 0; return x >= x0 && x <= x1 && y >= y0 - 1 && y <= y1; };
    const ST = T.stavby;
    // zóny: jemná barva a okraj
    if (hra.zona) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * W + x, id = hra.zona[i];
        if (!id) continue;
        const z = hra.zony.find(z => z.id === id);
        if (!z) continue;
        const b = ST.ZONY[z.typ].barva;
        ctx.fillStyle = b + '.13)'; ctx.fillRect(x * S, y * S, S, S);
        ctx.fillStyle = b + '.7)';
        if (hra.zona[i - W] !== id) ctx.fillRect(x * S, y * S, S, 1);
        if (hra.zona[i + W] !== id) ctx.fillRect(x * S, y * S + S - 1, S, 1);
        if (x === 0 || hra.zona[i - 1] !== id) ctx.fillRect(x * S, y * S, 1, S);
        if (x === W - 1 || hra.zona[i + 1] !== id) ctx.fillRect(x * S + S - 1, y * S, 1, S);
      }
    }
    // úroda na polích a v houbárnách
    if (hra.uroda) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x, u = hra.uroda[i];
      if (!u || !hra.zona[i]) continue;
      const z = hra.zony.find(z => z.id === hra.zona[i]);
      if (!z || !a.uroda[z.typ]) continue;
      ctx.drawImage(a.uroda[z.typ][u === 101 ? 2 : u > 40 ? 1 : 0], x * S, y * S);
    }
    // postavené stavby
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (hra.lez[i] === 2) ctx.drawImage(a.zebrik, x * S, y * S);
      const k = hra.stavba[i];
      if (!k) continue;
      if (k === ST.K.DILNA) { const d = ST.dilnaNa(hra, i); if (d && d.i === i) kresliStavbu(ctx, a, hra, d.typ, i, null, snimek); }
      else kresliStavbu(ctx, a, hra, ST.KOD_TYP[k], i, hra.materialNa.get(i), snimek);
    }
    // praskající strop: praskliny (bliká) a padající prach
    for (const p of hra.praskani || []) {
      if (p.y < y0 || p.y > y1 + 1) continue;
      const zbyva = p.tik - hra.tik, st = zbyva < 200 ? 2 : zbyva < 400 ? 1 : 0;
      for (let x = p.x0; x <= p.x1; x++) {
        if (x < x0 || x > x1) continue;
        if ((snimek + x) % (st === 2 ? 2 : 4)) ctx.drawImage(a.prask[st], x * S, (p.y - 1) * S);
        ctx.fillStyle = 'rgba(190,170,140,.8)';
        const r = mulberry32(smichej(x, snimek, 5));
        if (r() < 0.3 + st * 0.2) ctx.fillRect(x * S + Math.floor(r() * 14), p.y * S + ((snimek * 3 + x * 5) % 40), 1, 2);
      }
    }
    // záře loučí
    ctx.globalCompositeOperation = 'lighter';
    for (let y = y0 - 3; y <= y1 + 3; y++) for (let x = x0 - 3; x <= x1 + 3; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (hra.stavba[y * W + x] !== ST.K.LOUC) continue;
      const cx = x * S + 8, cy = y * S + 4, r = 44 + ((snimek + x) % 3) * 2;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      g.addColorStop(0, 'rgba(255,190,90,.35)'); g.addColorStop(1, 'rgba(255,150,50,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }
    ctx.globalCompositeOperation = 'source-over';
    // plány staveb: průsvitný obrys a kolik materiálu už je na místě
    for (const p of hra.plany) {
      if (!vidi(p.i)) continue;
      const d = ST.STAVBY[p.typ], sir = (d.sirka || 1) * S, px = (p.i % W) * S, py = (p.i / W | 0) * S;
      ctx.globalAlpha = 0.42;
      kresliStavbu(ctx, a, hra, p.typ, p.i, p.mat || (p.typ === 'socha' ? 'kamen' : 'drevo'), snimek);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(140,210,255,.9)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
      ctx.strokeRect(px + 0.5, py + 0.5, sir - 1, S - 1); ctx.setLineDash([]);
      const potreba = Object.values(d.mat).reduce((s, n) => s + n, 0), mame = Object.values(p.doneseno).reduce((s, n) => s + n, 0);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(px + 2, py + 1, sir - 4, 2);
      ctx.fillStyle = mame >= potreba ? '#8cebff' : '#ffd25a'; ctx.fillRect(px + 2, py + 1, Math.round((sir - 4) * mame / potreba), 2);
    }
    // označené práce (i na neprozkoumaných polích)
    const oz = hra.oznac;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const v = oz[y * W + x];
      if (v) { ctx.drawImage(a.ozn[v], x * S, y * S); if (hra.prio[y * W + x]) ctx.drawImage(a.prio, x * S, y * S); }
    }
    // náhled obdélníku, který hráč právě táhne
    const tah = stav.tah;
    if (tah) {
      const [xa, xb] = tah.x0 < tah.x1 ? [tah.x0, tah.x1] : [tah.x1, tah.x0];
      const [ya, yb] = tah.y0 < tah.y1 ? [tah.y0, tah.y1] : [tah.y1, tah.y0];
      ctx.fillStyle = tah.druh === 'zrusit' ? 'rgba(255,90,90,.22)' : tah.druh === 'schody' ? 'rgba(140,235,255,.22)' : 'rgba(255,210,90,.22)';
      ctx.fillRect(xa * S, ya * S, (xb - xa + 1) * S, (yb - ya + 1) * S);
      ctx.strokeStyle = tah.druh === 'zrusit' ? '#ff7070' : tah.druh === 'schody' ? '#8cebff' : '#ffd25a';
      ctx.lineWidth = 1;
      ctx.strokeRect(xa * S + 0.5, ya * S + 0.5, (xb - xa + 1) * S - 1, (yb - ya + 1) * S - 1);
    }
    // věci na zemi (hromádky až po čtyřech)
    const naPoli = new Map();
    for (const v of hra.veci) {
      if (v.nese || !vidi(v.i)) continue;
      const n = naPoli.get(v.i) || 0;
      naPoli.set(v.i, n + 1);
      if (n >= 4) continue;
      const img = spriteVeci(v.druh, v.mat);
      const ox = [2, 0, 4, 2][n] - 2, oy = [0, 0, 0, -4][n];
      ctx.drawImage(img, (v.i % W) * S + 2 + ox + (n === 1 ? -3 : n === 2 ? 3 : 0), (v.i / W | 0) * S + S - 8 + oy);
    }
    // trpaslíci
    const alfa = stav.alfa || 0;
    for (const t of hra.trpaslici) {
      if (!vidi(t.i) && !vidi(t.o)) continue;
      const f = t.dur ? Math.min(1, (t.t + alfa) / t.dur) : 1;
      const px = ((t.o % W) + ((t.i % W) - (t.o % W)) * f) * S, py = ((t.o / W | 0) + ((t.i / W | 0) - (t.o / W | 0)) * f) * S;
      let sn = 'stoji';
      const krokovy = ((snimek >> 1) + t.id) & 1;
      if (t.stav === 'spi') {
        const P_ = T.hra.PROFESE[t.prof], img = spriteTrpaslika(P_.barva, t.vous, 'stoji', t.prof === 'hornik', t.smer < 0);
        ctx.save(); ctx.translate(Math.round(px) + 8, Math.round(py) + 12); ctx.rotate(-Math.PI / 2); ctx.drawImage(img, -8, -8); ctx.restore();
        ctx.fillStyle = '#cfe6ff'; const zz = (snimek >> 2) % 3;
        for (let k = 0; k <= zz; k++) ctx.fillRect(Math.round(px) + 11 + k * 2, Math.round(py) + 2 - k * 3, 2, 1);
        continue;
      }
      if (t.stav === 'zuri') sn = krokovy ? 'kope0' : 'kope1';
      else if (t.stav === 'plave') sn = krokovy ? 'leze0' : 'leze1';
      else if (t.stav === 'ji') sn = 'nese0';
      else if (t.stav === 'pada') sn = 'pada';
      else if (t.stav === 'kope') sn = t.akce % 8 < 4 ? 'kope0' : 'kope1';
      else if (t.dur && t.o % W === t.i % W && t.o !== t.i) sn = krokovy ? 'leze0' : 'leze1';
      else if (t.nese) sn = t.dur ? (krokovy ? 'nese0' : 'nese1') : 'nese0';
      else if (t.dur) sn = krokovy ? 'jde0' : 'jde1';
      const P = T.hra.PROFESE[t.prof];
      const vybava = t.zbran && (t.stav === 'bojuje' || (t.prace && t.prace.typ === 'lov')) ? { druh: 'sekera', mat: 'zelezo' } : t.nastroj;
      const vyb = t.zbroj ? Object.assign({ druh: 'krumpac', mat: 'kamen' }, vybava || {}, { zbroj: t.zbroj.mat }) : vybava;
      ctx.drawImage(spriteTrpaslika(P.barva, t.vous, sn, t.prof === 'hornik', t.smer < 0, vyb), Math.round(px), Math.round(py));
      if (t.zdravi < 100) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(Math.round(px) + 2, Math.round(py) - 1, 12, 1); ctx.fillStyle = t.zdravi > 50 ? '#6fd06f' : '#ff5a4a'; ctx.fillRect(Math.round(px) + 2, Math.round(py) - 1, Math.max(1, Math.round(12 * t.zdravi / 100)), 1); }
      if (t.nese) {
        const v = hra.veci.find(v => v.id === t.nese);
        if (v) ctx.drawImage(spriteVeci(v.druh, v.mat), Math.round(px) + 2, Math.round(py) - 5);
      }
      if (t.stav === 'kope' && t.prace) {
        const c = t.prace.c, q = t.akce / Math.max(1, t.akceDoba);
        ctx.drawImage(a.prask[Math.min(2, Math.floor(q * 3))], (c % W) * S, (c / W | 0) * S);
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(Math.round(px) + 2, Math.round(py) - 3, 12, 2);
        ctx.fillStyle = '#ffd25a'; ctx.fillRect(Math.round(px) + 2, Math.round(py) - 3, Math.round(12 * q), 2);
      }
      if (t.stav === 'zuri') { ctx.fillStyle = '#ff4a3a'; ctx.fillRect(Math.round(px) + 7, Math.round(py) - 6, 2, 4); ctx.fillRect(Math.round(px) + 7, Math.round(py) - 1, 2, 1); }
      if (stav.vybrany === t.id) {
        ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 1;
        const x = Math.round(px), y = Math.round(py);
        for (const [ax, ay, bx, by] of [[0, 0, 4, 0], [0, 0, 0, 4], [16, 0, 12, 0], [16, 0, 16, 4], [0, 16, 4, 16], [0, 16, 0, 12], [16, 16, 12, 16], [16, 16, 16, 12]]) {
          ctx.beginPath(); ctx.moveTo(x + ax, y + ay); ctx.lineTo(x + bx, y + by); ctx.stroke();
        }
      }
    }
  }
  function kresliTvory(ctx, a, stav, hra, vidi, snimek) {
    const alfa = stav.alfa || 0;
    for (const u of hra.tvorove || []) {
      if (!vidi(u.i) && !vidi(u.o)) continue;
      if (!stav.vseZnamo && !hra.znamo[u.i]) continue;
      const f = u.dur ? Math.min(1, (u.t + alfa) / u.dur) : 1;
      const px = Math.round(((u.o % W) + ((u.i % W) - (u.o % W)) * f) * S), py = Math.round(((u.o / W | 0) + ((u.i / W | 0) - (u.o / W | 0)) * f) * S);
      const img = a.tvor[u.druh][((snimek >> (u.druh === 'netopyr' ? 0 : 1)) + u.id) & 1];
      const ox = px + 8 - (img.width >> 1), oy = py + S - img.height;
      if (u.smer < 0) { ctx.save(); ctx.translate(ox + img.width, oy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore(); }
      else ctx.drawImage(img, ox, oy);
      const max = T.hrozby.DRUHY[u.druh].zdravi;
      if (u.zdravi < max) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(px + 2, py - 2, 12, 2); ctx.fillStyle = '#ff5a4a'; ctx.fillRect(px + 2, py - 2, Math.max(1, Math.round(12 * u.zdravi / max)), 2); }
      if (u.nese) { const v = hra.veci.find(v => v.id === u.nese); if (v) ctx.drawImage(spriteVeci(v.druh, v.mat), px + 2, py - 6); }
    }
  }
  // --- částice ---------------------------------------------------------------------------------------
  const castice = [];
  const nahC = () => Math.random();
  function pridejCastici(x, y, vx, vy, zivot, barva, g, sviti, vel) {
    if (castice.length > 600) castice.shift();
    castice.push({ x, y, vx, vy, zivot, max: zivot, barva, g: g === undefined ? 60 : g, sviti: !!sviti, vel: vel || 1 });
  }
  function casticeZUdalosti(ev, hra) {
    if (ev.i < 0) return;
    const x = (ev.i % W) * S + 8, y = (ev.i / W | 0) * S + 8;
    const barvaMat = m => (MATERIAL[m] && MATERIAL[m].mini) || '#9a948a';
    switch (ev.typ) {
      case 'uder': for (let k = 0; k < 4; k++) pridejCastici(x + (nahC() - 0.5) * 10, y + (nahC() - 0.5) * 10, (nahC() - 0.5) * 40, -20 - nahC() * 30, 0.5, ev.x > 100 ? '#fff3a0' : barvaMat(ev.x), 80, ev.x > 100); break;
      case 'vykop': for (let k = 0; k < 12; k++) pridejCastici(x + (nahC() - 0.5) * 14, y + (nahC() - 0.5) * 14, (nahC() - 0.5) * 50, -10 - nahC() * 30, 0.9, barvaMat(ev.x), 70, false, 2); break;
      case 'kovadlina': for (let k = 0; k < 6; k++) pridejCastici(x + (nahC() - 0.5) * 8, y - 2, (nahC() - 0.5) * 80, -40 - nahC() * 60, 0.45, nahC() < 0.5 ? '#ffd25a' : '#ff8a2a', 160, true); break;
      case 'sekera': case 'kladivo': case 'dilna': for (let k = 0; k < 3; k++) pridejCastici(x, y, (nahC() - 0.5) * 40, -20 - nahC() * 20, 0.5, '#d9b98a', 90); break;
      case 'zaval': for (let k = 0; k < 20 + 6 * (ev.x || 4); k++) pridejCastici(x + (nahC() - 0.5) * 16 * (ev.x || 4), y + nahC() * 32, (nahC() - 0.5) * 30, -nahC() * 20, 1.6 + nahC(), nahC() < 0.5 ? '#8a8276' : '#b0a898', 15, false, 2); break;
      case 'voda': pridejCastici(x + (nahC() - 0.5) * 12, y - 8, 0, 20, 0.6, 'rgba(140,200,255,.9)', 200); break;
      case 'boj': case 'zasah': for (let k = 0; k < 4; k++) pridejCastici(x, y, (nahC() - 0.5) * 70, -30 - nahC() * 40, 0.3, ev.typ === 'boj' ? '#ffffff' : '#d23a3a', 120, ev.typ === 'boj'); break;
      case 'padl': for (let k = 0; k < 10; k++) pridejCastici(x, y, (nahC() - 0.5) * 50, -nahC() * 40, 0.8, '#3a3040', 40, false, 2); break;
      case 'rev': for (let k = 0; k < 16; k++) pridejCastici(x + (nahC() - 0.5) * 40, y, (nahC() - 0.5) * 60, -nahC() * 60, 1.2, '#9f8cff', 30, true); break;
    }
  }
  // jiskry z loučí a výhní ve výřezu
  function jiskryZeZdroju(hra, x0, y0, x1, y1) {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      const k = hra.stavba[y * W + x];
      if (k === T.stavby.K.LOUC && nahC() < 0.04) pridejCastici(x * S + 8 + (nahC() - 0.5) * 3, y * S + 2, (nahC() - 0.5) * 8, -12 - nahC() * 10, 0.9, '#ffb04a', -4, true);
      if (k === T.stavby.K.DILNA && nahC() < 0.03) {
        const d = T.stavby.dilnaNa(hra, y * W + x);
        if (d && d.i === y * W + x && T.stavby.OHNIVE_DILNY.includes(d.typ)) pridejCastici(x * S + 12, y * S + 6, (nahC() - 0.5) * 12, -18 - nahC() * 12, 1.1, '#ff8a2a', -6, true);
      }
    }
  }
  function kresliCastice(ctx, sviti, dt) {
    for (let k = castice.length - 1; k >= 0; k--) {
      const c = castice[k];
      if (c.sviti !== sviti) continue;
      if (dt) { c.zivot -= dt; c.vy += c.g * dt; c.x += c.vx * dt; c.y += c.vy * dt; if (c.zivot <= 0) { castice.splice(k, 1); continue; } }
      ctx.globalAlpha = Math.max(0, Math.min(1, c.zivot / c.max * 1.5));
      ctx.fillStyle = c.barva;
      ctx.fillRect(Math.round(c.x), Math.round(c.y), c.vel, c.vel);
    }
    ctx.globalAlpha = 1;
  }
  // poloha trpaslíka ve světových px (pro kameru, která ho sleduje)
  function polohaTrpaslika(t, alfa) {
    const f = t.dur ? Math.min(1, (t.t + (alfa || 0)) / t.dur) : 1;
    return { x: ((t.o % W) + ((t.i % W) - (t.o % W)) * f) * S + 8, y: ((t.o / W | 0) + ((t.i / W | 0) - (t.o / W | 0)) * f) * S + 8 };
  }

  // minimapa: 1 pixel = 1 pole
  let miniData = null;
  function kresliMinimapu(ctx, stav, kam, cw, ch) {
    const { hora, znamo } = stav, { teren, pozadi, ruda } = hora;
    if (!miniData || miniData.width !== W) miniData = ctx.createImageData(W, H);
    const d = miniData.data;
    for (let i = 0; i < W * H; i++) {
      let c;
      if (!stav.vseZnamo && !znamo[i]) c = '#0e0d12';
      else if (ruda[i]) c = RUDA[ruda[i]].mini;
      else if (pevne(teren[i]) || teren[i] === M.VODA || teren[i] === M.MAGMA) c = MATERIAL[teren[i]].mini;
      else c = pozadi[i] === M.VZDUCH ? ((i / W | 0) < UDOLI - 12 ? '#6fa6dc' : '#a9cfee') : ztmav(MATERIAL[pozadi[i]].mini, 0.45);
      const v = rgb(c), o = i * 4;
      d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; d[o + 3] = 255;
    }
    const hra = stav.hra;
    if (hra) {
      for (let i = 0; i < W * H; i++) if (hra.oznac[i]) { const o = i * 4; d[o] = 255; d[o + 1] = 210; d[o + 2] = 90; }
      for (const t of hra.trpaslici) { const o = t.i * 4; d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; }
      for (const u of hra.tvorove || []) if (stav.vseZnamo || hra.znamo[u.i]) { const o = u.i * 4; d[o] = 255; d[o + 1] = 40; d[o + 2] = 40; }
    }
    ctx.canvas.width = W; ctx.canvas.height = H;
    ctx.putImageData(miniData, 0, 0);
    ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(kam.x / S) + 0.5, Math.round(kam.y / S) + 0.5,
      Math.max(2, Math.round(cw / kam.z / S) - 1), Math.max(2, Math.round(ch / kam.z / S) - 1));
  }

  T.grafika = { S, SNIMKU, PAL, PAL_RUDY, SNIMKY_T, pripravAtlas, kresli, kresliMinimapu, spriteTrpaslika, spriteVeci, polohaTrpaslika,
                castice, casticeZUdalosti };
})(TRP);
