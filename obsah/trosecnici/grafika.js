/* ============================================================
   Trosečníci – grafika.js: pixel art a vykreslení mapy.

   Všechno se kreslí v kódu, žádné obrázky:
   - terén: dlaždice 16×16 z palety a šumu (4 varianty, voda a láva
     ve 4 snímcích animace),
   - přechody: vyšší biom „přeroste" okraj nižšího (třepení u souše,
     rastr u vody), pobřeží má pěnu, mlha má rozrastrovaný okraj,
   - objekty: ručně nakreslené řetězcové mapy s paletou, obrys se
     dopočítá automaticky.
   Vše se jednou předkreslí do malých pláten a kreslí se celými
   násobky zvětšení bez vyhlazování.
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';
  const S = 16;
  const { TEREN, OBJ, W, H } = T.svet;
  const { mulberry32, smichej, sum2D } = T.nahoda;
  const SNIMKU = 4;

  // --- barvy ----------------------------------------------------------------
  const rgbCache = {};
  function rgb(c) {
    if (rgbCache[c]) return rgbCache[c];
    let v;
    if (c[0] === '#') v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255];
    else { const m = c.match(/[\d.]+/g).map(Number); v = [m[0], m[1], m[2], Math.round((m[3] ?? 1) * 255)]; }
    return (rgbCache[c] = v);
  }
  function platno(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // nakreslí plátno w×h, fn(x, y) vrací barvu nebo null
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

  // --- palety terénu ----------------------------------------------------------
  const PAL = {
    [TEREN.HLUBINA]: ['#1c4c86', '#1a457d', '#205592', '#2d69a8', '#3f7fbd'],
    [TEREN.MORE]:    ['#2a8dc0', '#2780b4', '#349ccb', '#56b9dc', '#a6e4f2'],
    [TEREN.LAGUNA]:  ['#2fb0ad', '#2aa19f', '#3ec0bb', '#66d4c9', '#b4f0e4'],
    [TEREN.REKA]:    ['#3b93d2', '#3485c4', '#48a4de', '#74c2ec', '#c8ecfa'],
    [TEREN.PLAZ]:    ['#ebd59d', '#e3ca8a', '#f2e1b0', '#cdb173', '#ffffff'],
    [TEREN.SAVANA]:  ['#9ebd50', '#8fb046', '#adca5e', '#76942f', '#d3c46c'],
    [TEREN.DZUNGLE]: ['#2f7c34', '#286e2e', '#378a3b', '#4aa448', '#1d5423'],
    [TEREN.SKALY]:   ['#8f8a83', '#807b74', '#9c978f', '#5e5953', '#b8b3ab'],
    [TEREN.SOPKA]:   ['#4c4343', '#403838', '#574c4a', '#6d625d', '#c0582a'],
    [TEREN.LAVA]:    ['#c9401a', '#e0621d', '#f28f23', '#ffc444', '#7a2a12'],
  };
  const ANIMOVANE = t => t <= TEREN.REKA || t === TEREN.LAVA;

  function texturaTerenu(typ, v, snimek) {
    const p = PAL[typ];
    const r = mulberry32(smichej(typ, v, 3));
    const n = sum2D(smichej(typ, v, 4));
    const pole = [];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const s = n(x / 3.2, y / 3.2) + (r() - 0.5) * 0.25;
      pole.push(s < 0.38 ? 1 : s > 0.64 ? 2 : 0);
    }
    const bar = (x, y) => p[pole[((y + S) % S) * S + ((x + S) % S)]];
    const nad = {};                                     // dokreslené detaily
    const dej = (x, y, c) => { if (x >= 0 && y >= 0 && x < S && y < S) nad[y * S + x] = c; };
    const vlna = (typ <= TEREN.REKA);
    if (vlna) {
      // vlnky: krátké světlé čárky, posouvají se se snímkem
      const posun = typ === TEREN.REKA ? snimek * 2 : snimek;
      for (let k = 0; k < (typ === TEREN.HLUBINA ? 3 : 4); k++) {
        const y = Math.floor(r() * S), x0 = Math.floor(r() * S), d = 2 + Math.floor(r() * 3);
        for (let i = 0; i < d; i++) dej((x0 + i + posun) % S, y, p[3]);
        if (typ !== TEREN.HLUBINA && r() < 0.5) dej((x0 + 1 + posun) % S, (y + S - 1) % S, p[3]);
      }
      if (typ !== TEREN.HLUBINA) {                       // třpytky, v každém snímku jinde
        const rs = mulberry32(smichej(typ, v * 17 + snimek, 5));
        for (let k = 0; k < 2; k++) if (rs() < 0.6) dej(Math.floor(rs() * S), Math.floor(rs() * S), p[4]);
      }
    } else if (typ === TEREN.PLAZ) {
      for (let k = 0; k < 9; k++) dej(Math.floor(r() * S), Math.floor(r() * S), p[3]);
      if (r() < 0.35) dej(Math.floor(r() * S), Math.floor(r() * S), p[4]);
    } else if (typ === TEREN.SAVANA) {
      for (let k = 0; k < 11; k++) { const x = Math.floor(r() * S), y = 1 + Math.floor(r() * (S - 1)); dej(x, y, p[3]); dej(x + (r() < 0.5 ? -1 : 1), y - 1, p[3]); }
      for (let k = 0; k < 3; k++) dej(Math.floor(r() * S), Math.floor(r() * S), p[4]);
    } else if (typ === TEREN.DZUNGLE) {
      for (let k = 0; k < 6; k++) {
        const x = Math.floor(r() * S), y = Math.floor(r() * S);
        dej(x, y, p[3]); dej(x + 1, y, p[3]); dej(x - 1, y + 1, p[3]); dej(x, y + 1, p[2]); dej(x + 1, y + 1, p[4]); dej(x, y + 2, p[4]);
      }
    } else if (typ === TEREN.SKALY) {
      for (let k = 0; k < 2; k++) {                    // praskliny se světlou hranou
        let x = Math.floor(r() * S), y = Math.floor(r() * S);
        for (let i = 0; i < 5; i++) { dej(x, y, p[3]); dej(x, y - 1, p[4]); x += r() < 0.6 ? 1 : 0; y += r() < 0.5 ? 1 : -1; }
      }
    } else if (typ === TEREN.SOPKA) {
      for (let k = 0; k < 7; k++) dej(Math.floor(r() * S), Math.floor(r() * S), p[3]);
      if (r() < 0.3) dej(Math.floor(r() * S), Math.floor(r() * S), p[4]);
    } else if (typ === TEREN.LAVA) {
      const nl = sum2D(smichej(typ, v, 9));
      return pixely(S, S, (x, y) => {
        const s = nl(x / 3 + snimek * 0.35, y / 3 - snimek * 0.2) + (r() - 0.5) * 0.12;
        return s < 0.3 ? p[4] : s < 0.45 ? p[0] : s < 0.6 ? p[1] : s < 0.74 ? p[2] : p[3];
      });
    }
    return pixely(S, S, (x, y) => nad[y * S + x] || bar(x, y));
  }

  // --- masky přechodů ---------------------------------------------------------
  // směry: 0 S(ever) 1 V 2 J 3 Z ; rohy: 4 SV 5 JV 6 JZ 7 SZ
  function maska(smer, v, druh) {
    // druh: 'souš' (třepení), 'voda' (rastr), 'mlha' (rastr hlubší)
    const r = mulberry32(smichej(smer, v, druh.length * 31));
    const hloubky = [];
    let d = 1 + Math.floor(r() * 2);
    for (let i = 0; i < S; i++) { hloubky.push(d); d = Math.max(1, Math.min(3, d + (r() < 0.33 ? -1 : r() < 0.5 ? 1 : 0))); }
    return (x, y) => {
      let vz, poz;                                     // vzdálenost od hrany, pozice podél hrany
      if (smer < 4) {
        vz = [y, S - 1 - x, S - 1 - y, x][smer];
        poz = [x, y, x, y][smer];
      } else {
        const rx = smer === 4 || smer === 5 ? S - 1 - x : x;
        const ry = smer === 5 || smer === 6 ? S - 1 - y : y;
        vz = Math.max(rx, ry); poz = 0;
        if (druh === 'souš') return rx + ry < 3;
        if (druh === 'voda') return rx + ry < 2 || (rx + ry < 4 && (x + y) % 2 === 0);
        return rx + ry < 3 || (rx + ry < 5 && (x + y) % 2 === 0);
      }
      if (druh === 'souš') return vz < hloubky[poz];
      if (druh === 'voda') return vz === 0 || (vz === 1 && (x + y) % 2 === 0) || (vz === 2 && x % 2 === 0 && y % 2 === 0);
      return vz < 2 || (vz === 2 && (x + y) % 2 === 0) || (vz === 3 && x % 2 === 0 && y % 2 === 0) || (vz === 4 && (x * 3 + y) % 5 === 0);
    };
  }

  // priorita přechodů: vyšší přeroste nižšího sousedního ze stejné třídy
  const PRIORITA = { [TEREN.LAGUNA]: 0, [TEREN.MORE]: 1, [TEREN.HLUBINA]: 2,
    [TEREN.LAVA]: 0, [TEREN.REKA]: 1, [TEREN.PLAZ]: 2, [TEREN.SAVANA]: 3, [TEREN.DZUNGLE]: 4, [TEREN.SKALY]: 5, [TEREN.SOPKA]: 6 };
  const JE_MORE = t => t <= TEREN.LAGUNA;
  const TRIDA = t => JE_MORE(t) ? 0 : 1;

  // --- sprity objektů -------------------------------------------------------
  const SPRITY = {
    palma: { pal: { L: '#86d652', g: '#3fa03a', d: '#26702a', t: '#a8753c', T: '#6e4a22', c: '#5b3a1c', o: 'rgba(0,0,0,.25)' }, mapa: [
      '......gLLg......',
      '..ggLLgLLgLLgg..',
      '.gLLggdggdggLLg.',
      'gLgdd.ccTc.ddgLg',
      'gd...dcTTcd...dg',
      'd......tT......d',
      '.......tT.......',
      '........tT......',
      '........tT......',
      '........Tt......',
      '........tT......',
      '.......tT.......',
      '.......tT.......',
      '.......Tt.......',
      '.......tT.......',
      '......ttTT......',
      '.....oooooo.....'] },
    strom: { pal: { L: '#58b74f', g: '#2f8a35', d: '#1e6326', t: '#7a5128', T: '#553619', o: 'rgba(0,0,0,.28)' }, mapa: [
      '.....dggd.......',
      '...dgLLggdgd....',
      '..dgLLLggggLgd..',
      '.dgLLggggdgLLgd.',
      '.dggggdggggggLgd',
      'dgLgggggdgggggd.',
      'dggggLLggggdggd.',
      '.dgggLgggggggdd.',
      '.ddggggggdgggd..',
      '..dddgggggddd...',
      '....ddtTddd.....',
      '.......tT.......',
      '.......tT.......',
      '......ttTT......',
      '.....ooooooo....'] },
    ker: { pal: { L: '#6cc24a', g: '#3f9a3a', d: '#2a6e2a', r: '#d8323a', o: 'rgba(0,0,0,.25)' }, mapa: [
      '................',
      '......dggd.gd...',
      '....dgLLgggLgd..',
      '...dgLgrggggrgd.',
      '...dggggLgrgggd.',
      '....dgrgggggdd..',
      '.....ddddddd....',
      '.....ooooooo....'] },
    balvan: { pal: { K: '#b8b2a8', k: '#908a81', j: '#66605a', o: 'rgba(0,0,0,.28)' }, mapa: [
      '................',
      '......kkkk......',
      '....kKKKkkkk....',
      '...kKKkkkkkjk...',
      '..kKkkkkkkkjjk..',
      '..kkkkkkkjjjjk..',
      '...kkjjjjjjjk...',
      '....ooooooooo...'] },
    vrak: { pal: { b: '#8a5a2e', B: '#583418', T: '#4a3018', w: '#ece4cc', v: '#c9bfa2', f: '#e6f8ff' }, bezObrysu: 'f', mapa: [
      '..........T.....',
      '..........T.....',
      '.........T.ww...',
      '.........Tvwww..',
      '........T..www..',
      '...b....T..wv...',
      '..bB...T........',
      '..bBB..T........',
      '.bBBBbbbbbbb....',
      '.bBBbbbbbbbbbb..',
      '.bBbbbBbbbbbbbb.',
      '..bbbb.bbBbbbb..',
      'f.bbbbf.bbbbb.f.',
      '.f.ff.f.f.ff.f.f'] },
    jeskyne: { pal: { K: '#aaa49b', k: '#858078', j: '#5e5953', x: '#141117', X: '#2b2530' }, mapa: [
      '................',
      '....kkkkkkk.....',
      '..kKKkkkkkkjk...',
      '.kKkkkkkkkkkjk..',
      '.kkkkxxxxxkkjk..',
      'kKkkxxxxxxxkkjk.',
      'kkkxxxxXxxxxkjk.',
      'kkkxxxxxxxxxkjj.',
      'kkxxxxxXxxxxxkj.',
      'kkxxxxxxxxxxxkj.',
      '.kxxxxxxxxxxxj..'] },
    vodopad: { pal: { K: '#a9a39a', k: '#858078', j: '#5e5953', w: '#e2f5ff', W: '#a6daf4', b: '#62b2e6', f: '#ffffff' }, bezObrysu: 'wWbf', mapa: [
      'KkkkKkkjkkKkkkjk',
      'kjkjjkkjjkjkkjjj',
      'j.wWwbWwwbWwWw.j',
      '..wWbwWwbwWwbw..',
      '..wbWwwbWwwWbw..',
      '..WwwbWwbWwwWw..',
      '..wWwWbwwWbwWw..',
      '.fwfwWfwWfwfWwf.',
      'f.ff.f.ff.f.ff.f'] },
    hlava: { pal: { K: '#a89a88', k: '#817465', j: '#5c5146', x: '#2d2620', o: 'rgba(0,0,0,.3)' }, mapa: [
      '.....kkkkkk.....',
      '....kKKKKKkj....',
      '...kKkkkkkkkj...',
      '...kKjjjkjjjj...',
      '...kKxxkkxxkj...',
      '...kKkkkkkkkj...',
      '...kKkkKkkkkj...',
      '...kKkKKkkkkj...',
      '....kkKKkkkj....',
      '....kkkkkkkj....',
      '....kjjjjjjj....',
      '....kkkkkkkj....',
      '...kKkkkkkkkj...',
      '..kKkkkkkkkkkj..',
      '..kKkkkkkkkkkj..',
      '.ooooooooooooooo'] },
    ruiny: { pal: { K: '#bcb19a', k: '#958970', j: '#6a5f4d', v: '#3fa03a', o: 'rgba(0,0,0,.25)' }, mapa: [
      '..KK.......KK...',
      '..Kk......KKk...',
      '..Kkv.....Kkk...',
      '.KKkkK...KKkkv..',
      '.KkvkkKKKkkkkk..',
      '.Kkkkvkkkkvkkk..',
      '.KkkkkkkkkkkkkK.',
      '.vkkjkkjkkkjkkk.',
      '..ooooooooooooo.'] },
    tabor: { pal: { T: '#6e4a22', f: '#b7a257', F: '#8f7d3c', k: '#7f7a70', a: '#3a3434', o: 'rgba(0,0,0,.22)' }, mapa: [
      '...........T....',
      '..........Tf....',
      '.........TfFf...',
      '........TfffFf..',
      '.......TfFfffff.',
      '......T.ffFfff..',
      '.....T....ffff..',
      '...kk.kk........',
      '..k.aaa.k.......',
      '...kk.kk........',
      '....oooo........'] },
    hrac: { pal: { h: '#5a3a1c', s: '#e2b48a', x: '#222222', w: '#f0ece0', W: '#c9c3b2', b: '#3b5b9a', o: 'rgba(0,0,0,.3)' }, mapa: [
      '......hhhh......',
      '.....hhhhhh.....',
      '.....hsssshh....',
      '.....sxssxs.....',
      '.....ssssss.....',
      '......ssss......',
      '....wwwwwwww....',
      '...swwwWwwwws...',
      '...swwwWwwwws...',
      '...s.wwwwww.s...',
      '.....bbbbbb.....',
      '.....bbb.bbb....',
      '.....bb...bb....',
      '.....ss...ss....',
      '....ooooooooo...'] },
    bedna: { pal: { c: '#b98a4a', C: '#8a6232', k: '#5a5a5a', o: 'rgba(0,0,0,.28)', f: '#e6f8ff' }, bezObrysu: 'f', mapa: [
      '................',
      '................',
      '....cCcCcCcC....',
      '...cCkCcCkCcC...',
      '...cCcCcCcCcC...',
      '...CCCCCCCCCC...',
      '...cCkCcCkCcC...',
      '...cCcCcCcCcC...',
      '..f.oooooooo.f..'] },
    // --- stavby z objevů ---
    pec: { pal: { h: '#b5653a', H: '#d0804f', x: '#3a2418', f: '#ff7a1a', F: '#ffb627', y: '#ffe066', k: '#8a857c', o: 'rgba(0,0,0,.28)' }, bezObrysu: 'fFy', mapa: [
      '................',
      '.....hHHHh......',
      '....hHhhhHh.....',
      '...hHhhhhhhh....',
      '...hhhxxxhhh....',
      '..hhhxfFfxhhh...',
      '..hhhxFyFxhhh...',
      '..kkkkkkkkkkk...',
      '..ooooooooooo...'] },
    nadrz: { pal: { r: '#a8563a', R: '#8a4530', w: '#5fb4ec', W: '#a6daf4', o: 'rgba(0,0,0,.28)' }, mapa: [
      '................',
      '..rRrRrRrRrRr...',
      '..RwwWwwwWwwR...',
      '..rWwwwWwwwWr...',
      '..RrRrRrRrRrR...',
      '..rRrRrRrRrRr...',
      '..RrRrRrRrRrR...',
      '..ooooooooooo...'] },
    kovarna: { pal: { s: '#cfcfcf', k: '#8a857c', R: '#5a3a2a', r: '#7a4b36', w: '#5a3a1c', h: '#b5653a', f: '#ff7a1a', F: '#ffb627', a: '#3a3d42', A: '#6b7079', o: 'rgba(0,0,0,.28)' }, bezObrysu: 'sfF', mapa: [
      '..........ss....',
      '.........s......',
      '..........kk....',
      '..RRRRRRRRkkRR..',
      '.RrrrrrrrrrrrrR.',
      '.RRRRRRRRRRRRRR.',
      '..w..........w..',
      '..w.hhh......w..',
      '..w.hfh..aAa.w..',
      '..w.hFh...a..w..',
      '..wkkkk..aaa.w..',
      '.oooooooooooooo.'] },
    osetrovna: { pal: { x: '#f4f4f4', X: '#d8323a', T: '#6e4a22', y: '#c9a24a', Y: '#e6c46a', w: '#d9c7a0', W: '#bfae88', d: '#3b2412', o: 'rgba(0,0,0,.28)' }, mapa: [
      '.......Txxx.....',
      '.......TxXx.....',
      '.......Txxx.....',
      '.......yy.......',
      '......yYYy......',
      '.....yYyyYy.....',
      '....yYyyyyYy....',
      '...yyyyyyyyyy...',
      '...wWWWWWWWWw...',
      '...wWxXxWdWWw...',
      '...wWWxWWdWWw...',
      '...wWWWWWdWWw...',
      '..oooooooooooo..'] },
    dilna: { pal: { R: '#6e4424', r: '#8a5a2e', w: '#5a3a1c', s: '#c9ccd1', t: '#6e4a22', g: '#8a8f96', b: '#b07a44', B: '#6e4a22', x: '#5a3a1c', o: 'rgba(0,0,0,.28)' }, mapa: [
      '..RRRRRRRRRRRR..',
      '.RrrrrrrrrrrrrR.',
      '.RRRRRRRRRRRRRR.',
      '..w..s.t.....w..',
      '..w..s.t..g..w..',
      '..w.........gw..',
      '..wbbbbbbbbb.w..',
      '..wBx.....xB.w..',
      '..w.x.....x..w..',
      '.oooooooooooooo.'] },
    rozhledna: { pal: { r: '#9c3a2a', R: '#c24e36', p: '#6e4a22', P: '#8a5a2e', t: '#6e4a22', x: '#9a6634', o: 'rgba(0,0,0,.3)' }, mapa: [
      '.......rr.......',
      '......rRRr......',
      '.....rRrrRr.....',
      '....rrrrrrrr....',
      '....p.p..p.p....',
      '...PPPPPPPPPP...',
      '....t......t....',
      '....tx....xt....',
      '.....t.xx.t.....',
      '.....tx..xt.....',
      '.....t.xx.t.....',
      '....tx....xt....',
      '....t.x..x.t....',
      '....t..xx..t....',
      '...tx.x..x.xt...',
      '...t.x....x.t...',
      '...tx......xt...',
      '..tt........tt..',
      '.oooooooooooooo.'] },
    lodenice: { pal: { k: '#6e4a22', K: '#8a5a2e', t: '#4a2f18', o: 'rgba(0,0,0,.25)' }, mapa: [
      '................',
      '..t..........t..',
      '..tkkkkkkkkkkt..',
      '..t.K......K.t..',
      '..tkkkkkkkkkkt..',
      '..t.K......K.t..',
      '..tkkkkkkkkkkt..',
      '.oooooooooooooo.'] },
    lod0: { pal: { k: '#6e4a22', K: '#8a5a2e', T: '#4a2f18' }, mapa: [
      '..T..........T..',
      '.TkkkkkkkkkkkkT.',
      '..kKKKKKKKKKKk..',
      '...kkkkkkkkkk...'] },
    lod1: { pal: { b: '#8a5a2e', B: '#b07a44', d: '#5a3a1c' }, mapa: [
      '.bBBBBBBBBBBBBb.',
      '.bbbbbbbbbbbbbb.',
      '..bBbbbdbbbbBb..',
      '...bbbbbbbbbb...',
      '....dddddddd....'] },
    lod2: { pal: { b: '#8a5a2e', B: '#b07a44', d: '#5a3a1c', m: '#6e4a22', M: '#8a5a2e' }, mapa: [
      '.......mM.......',
      '.......mM.......',
      '....MMMmMMMM....',
      '.......mM.......',
      '.......mM.......',
      '.......mM.......',
      '.......mM.......',
      '.......mM.......',
      '.......mM.......',
      '.bBBBBBmMBBBBBb.',
      '.bbbbbbbbbbbbbb.',
      '..bBbbbdbbbbBb..',
      '...bbbbbbbbbb...',
      '....dddddddd....'] },
    lod3: { pal: { b: '#8a5a2e', B: '#b07a44', d: '#5a3a1c', m: '#6e4a22', M: '#8a5a2e', w: '#f2ecd8', W: '#d6ceb4', r: '#c24e36' }, mapa: [
      '.......mMr......',
      '.......mMrr.....',
      '...MMMMmMMMMM...',
      '...wwwwmwwwww...',
      '...wWwwmwwWww...',
      '...wwwwmwwwww...',
      '...wwWwmwwwWw...',
      '...wwwwmwwwww...',
      '...MMMMmMMMMM...',
      '.......mM.......',
      '.bBBBBBmMBBBBBb.',
      '.bbbbbbbbbbbbbb.',
      '..bBbbbdbbbbBb..',
      '...bbbbbbbbbb...',
      '....dddddddd....'] },
    signal: { pal: { t: '#6e4a22', T: '#8a5a2e', l: '#8f7d3c', o: 'rgba(0,0,0,.28)' }, mapa: [
      '................',
      '.......t........',
      '......tTt.......',
      '.....tlTlt......',
      '....tTlTlTt.....',
      '...tlTtTtTlt....',
      '..tTlTlTlTlTt...',
      '..ttTtTtTtTtt...',
      '..ooooooooooo...'] },
    // --- stavby ---
    ohniste: { pal: { f: '#ff7a1a', F: '#ffb627', y: '#ffe066', b: '#6e4a22', T: '#9a6634', k: '#8a857c', K: '#aaa59b', o: 'rgba(0,0,0,.25)' }, bezObrysu: 'fFy', mapa: [
      '................',
      '.......f........',
      '......fF..f.....',
      '.....fFyf.F.....',
      '.....FyyFfF.....',
      '....fFyyyFf.....',
      '...kKbFyFbTk....',
      '..kK.TbTbT.Kk...',
      '...kk.kKk.kk....',
      '....oooooooo....'] },
    pristresek: { pal: { L: '#a9c955', l: '#7aa23a', d: '#587a2a', T: '#6e4a22', o: 'rgba(0,0,0,.28)' }, mapa: [
      '..T.............',
      '..TLl...........',
      '..TLLLl.........',
      '..TLlLLLl.......',
      '..TLLLdLLLl.....',
      '..TlLLLLlLLLl...',
      '..T.dLLLLLdLLl..',
      '..T...lLLLLLLLl.',
      '..T.......dlLLd.',
      '..T..........T..',
      '..T..........T..',
      '.oTooooooooooTo.'] },
    chatrc: { pal: { y: '#c9a24a', Y: '#e6c46a', r: '#9c7a30', w: '#8a5a2e', W: '#6e4424', d: '#3b2412', o: 'rgba(0,0,0,.3)' }, mapa: [
      '.......yy.......',
      '......yYYy......',
      '.....yYyyYy.....',
      '....yYyryyYy....',
      '...yYyyYyyryy...',
      '..yYyryyyYyyYy..',
      '.yyyyyyyyyyyyyy.',
      '.rrrrrrrrrrrrrr.',
      '..wWwwWwwwWwwW..',
      '..wWwwWddWwwwW..',
      '..wWwwWddWwwwW..',
      '..wWwwWddWwwwW..',
      '..wWwwWddWwwwW..',
      '.oooooooooooooo.'] },
    sberac: { pal: { L: '#86c24a', l: '#5c8f30', b: '#8a5a2e', B: '#5f3b1b', w: '#5fb4ec', W: '#a6daf4', o: 'rgba(0,0,0,.28)' }, mapa: [
      '................',
      '..LLl......lLL..',
      '...LLLl..lLLL...',
      '.....LLllLL.....',
      '.......ll.......',
      '.....bBBBBb.....',
      '....bWwwwwWb....',
      '....bBbbbbBb....',
      '....bbBbbBbb....',
      '....bBbbbbBb....',
      '....bbBBBBbb....',
      '....oooooooo....'] },
    sklad: { pal: { R: '#7a4b26', r: '#a06838', w: '#5a3a1c', c: '#c1935a', C: '#8a6232', o: 'rgba(0,0,0,.28)' }, mapa: [
      '..RRRRRRRRRRRR..',
      '.RrrrrrrrrrrrrR.',
      '.RRRRRRRRRRRRRR.',
      '..w..........w..',
      '..w.cCc......w..',
      '..w.cCc.cCc..w..',
      '..w.cCccCcCc.w..',
      '..wcCccCcCcCcw..',
      '..wcCcCcCccCcw..',
      '.oooooooooooooo.'] },
    pila: { pal: { b: '#8a5a2e', T: '#b07a44', x: '#5a3a1c', s: '#d4d8de', S: '#8a8f96', o: 'rgba(0,0,0,.25)' }, mapa: [
      '..........s.....',
      '.........sS.....',
      '........sS......',
      '..bbbbbbsbbbb...',
      '.bTTTTTsTTTTTb..',
      '..bbbbbbbbbbb...',
      '...x.x....x.x...',
      '....x......x....',
      '...x.x....x.x...',
      '..ooooooooooo...'] },
  };
  const OBRYS = 'rgba(22,18,28,.6)';

  function sprite(def, zrcadlo) {
    const h = def.mapa.length;
    const radky = def.mapa.map(r => r.padEnd(S, '.').slice(0, S));
    const zn = (x, y) => (x < 0 || y < 0 || x >= S || y >= h) ? '.' : radky[y][zrcadlo ? S - 1 - x : x];
    const bez = def.bezObrysu || '';          // pěna a voda obrys nemají ani nedělají
    const plne = (x, y) => { const c = zn(x, y); return c !== '.' && c !== 'o' && !bez.includes(c); };
    return pixely(S, h, (x, y) => {
      const c = zn(x, y);
      if (plne(x, y) || bez.includes(c) && c !== '.') return def.pal[c];
      if (plne(x - 1, y) || plne(x + 1, y) || plne(x, y - 1) || plne(x, y + 1)) return OBRYS;
      return c === 'o' ? def.pal.o : null;
    });
  }

  // --- postavy: sprite podle vzhledu, portrét ---------------------------------------
  function ztmav(hex, k) {
    const v = rgb(hex);
    return '#' + v.slice(0, 3).map(c => Math.round(c * k).toString(16).padStart(2, '0')).join('');
  }
  const MAVA = [                              // trosečník s rukama nad hlavou
    '...s..hhhh..s...',
    '...s.hhhhhh.s...',
    '...ws.hsssshws..',
    '....wsxssxsw....',
    '....wssssssw....',
    '.....wssssw.....',
    '.....wwwwww.....',
    '....wwwWwwww....',
    '....wwwWwwww....',
    '.....wwwwww.....',
    '.....bbbbbb.....',
    '.....bbb.bbb....',
    '.....bb...bb....',
    '.....ss...ss....',
    '....ooooooooo...'];
  function upravMapu(mapa, uces) {
    const m = mapa.map(r => r.split(''));
    const nastav = (x, y, c) => { if (m[y] && m[y][x] !== undefined) m[y][x] = c; };
    if (uces === 'dlouhe' || uces === 'culik') for (let y = 2; y <= (uces === 'dlouhe' ? 7 : 3); y++) { nastav(4, y, 'h'); nastav(11, y, 'h'); }
    if (uces === 'culik') { nastav(7, 0, 'h'); nastav(8, 0, 'h'); }
    if (uces === 'plesaty') for (let x = 0; x < 16; x++) { if (m[0][x] === 'h') m[0][x] = '.'; if (m[1][x] === 'h') m[1][x] = 's'; }
    if (uces === 'vousy') { nastav(5, 4, 'h'); nastav(10, 4, 'h'); for (let x = 6; x <= 9; x++) nastav(x, 5, 'h'); }
    if (uces === 'kudrny') for (let x = 4; x <= 11; x += 2) nastav(x, 0, 'h');
    return m.map(r => r.join(''));
  }
  const cachePostav = {};
  function spritePostavy(vz, mava, zrcadlo) {
    const klic = [vz.kuze, vz.vlasy, vz.uces, vz.kosile, mava ? 1 : 0, zrcadlo ? 1 : 0].join('|');
    if (cachePostav[klic]) return cachePostav[klic];
    const pal = Object.assign({}, SPRITY.hrac.pal, { s: vz.kuze, h: vz.vlasy, w: vz.kosile, W: ztmav(vz.kosile, 0.8) });
    return (cachePostav[klic] = sprite({ pal, mapa: upravMapu(mava ? MAVA : SPRITY.hrac.mapa, vz.uces) }, zrcadlo));
  }
  // portrét 16×16 (hlava a ramena), kreslí se zvětšený v panelu
  const cachePortretu = {};
  function portret(vz) {
    const klic = [vz.kuze, vz.vlasy, vz.uces, vz.kosile].join('|');
    if (cachePortretu[klic]) return cachePortretu[klic];
    const barva = new Array(256).fill(null);
    const dej = (x, y, c) => { if (x >= 0 && y >= 0 && x < 16 && y < 16) barva[y * 16 + x] = c; };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const fx = x - 7.5;
      const tvar = fx * fx / (4.3 * 4.3) + (y - 7.8) ** 2 / (4.9 * 4.9) <= 1;
      const hlava = fx * fx / (5.1 * 5.1) + (y - 6.4) ** 2 / (5.6 * 5.6) <= 1;
      if (y >= 13 && Math.abs(fx) <= 6.6) dej(x, y, y === 13 && Math.abs(fx) < 1.5 ? vz.kuze : (Math.abs(fx) > 5 ? ztmav(vz.kosile, 0.8) : vz.kosile));
      else if (y === 12 && Math.abs(fx) <= 1.6) dej(x, y, ztmav(vz.kuze, 0.85));
      else if (tvar) dej(x, y, fx > 2.5 ? ztmav(vz.kuze, 0.9) : vz.kuze);
      let vlas = false;
      switch (vz.uces) {
        case 'kratke': vlas = hlava && y <= 4; break;
        case 'vousy': vlas = (hlava && y <= 4) || (tvar && y >= 10 && !(y === 10 && Math.abs(fx) < 1.2)); break;
        case 'kudrny': vlas = (hlava && (y <= 4 || (Math.abs(fx) >= 3.8 && y <= 7))) || (y === 0 && x % 2 === 0 && Math.abs(fx) < 4); break;
        case 'dlouhe': vlas = (hlava && y <= 4) || (Math.abs(fx) >= 3.8 && Math.abs(fx) <= 5.6 && y >= 3 && y <= 13); break;
        case 'culik': vlas = (hlava && y <= 4) || (y <= 1 && Math.abs(fx) <= 1.6); break;
        case 'plesaty': vlas = hlava && Math.abs(fx) >= 3.8 && y >= 4 && y <= 8; break;
      }
      if (vlas) dej(x, y, (x + y) % 3 === 0 ? ztmav(vz.vlasy, 0.8) : vz.vlasy);
    }
    dej(6, 8, '#1a1a1a'); dej(9, 8, '#1a1a1a');                       // oči
    dej(6, 7, ztmav(vz.vlasy, 0.9)); dej(9, 7, ztmav(vz.vlasy, 0.9));  // obočí
    if (vz.uces !== 'vousy') { dej(7, 10, '#8a4a3a'); dej(8, 10, '#8a4a3a'); }
    const plne = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && barva[y * 16 + x];
    const c = pixely(16, 16, (x, y) => {
      if (plne(x, y)) return barva[y * 16 + x];
      if (plne(x - 1, y) || plne(x + 1, y) || plne(x, y - 1) || plne(x, y + 1)) return OBRYS;
      return null;
    });
    return (cachePortretu[klic] = c);
  }
  function portretURL(vz) { return portret(vz).toDataURL(); }

  // --- sestavení atlasu -----------------------------------------------------
  let A = null;
  function pripravAtlas() {
    if (A) return A;
    A = { teren: {}, pres: {}, pena: {}, breh: {}, mlha: {}, obj: {} };
    for (const t of Object.values(TEREN)) {
      A.teren[t] = [];
      for (let v = 0; v < 4; v++) {
        A.teren[t][v] = [];
        for (let f = 0; f < SNIMKU; f++) A.teren[t][v][f] = (f === 0 || ANIMOVANE(t)) ? texturaTerenu(t, v, f) : A.teren[t][v][0];
      }
      // přechody: jen typy, které mohou někoho přerůst
      const prerusta = t === TEREN.HLUBINA || t === TEREN.MORE || t >= TEREN.PLAZ && t !== TEREN.LAVA;
      if (!prerusta) continue;
      A.pres[t] = [];
      const druh = JE_MORE(t) ? 'voda' : 'souš';
      for (let smer = 0; smer < 8; smer++) {
        A.pres[t][smer] = [];
        for (let v = 0; v < 2; v++) {
          const m = maska(smer, v, druh);
          A.pres[t][smer][v] = [];
          for (let f = 0; f < SNIMKU; f++) {
            if (f > 0 && !ANIMOVANE(t)) { A.pres[t][smer][v][f] = A.pres[t][smer][v][0]; continue; }
            const zdroj = A.teren[t][v][f].getContext('2d').getImageData(0, 0, S, S).data;
            A.pres[t][smer][v][f] = pixely(S, S, (x, y) => {
              if (!m(x, y)) return null;
              const o = (y * S + x) * 4;
              return '#' + [zdroj[o], zdroj[o + 1], zdroj[o + 2]].map(c => c.toString(16).padStart(2, '0')).join('');
            });
          }
        }
      }
    }
    // pěna na vodě u břehu (animovaná) a vlhký okraj souše
    for (let smer = 0; smer < 8; smer++) {
      A.pena[smer] = [];
      for (let f = 0; f < SNIMKU; f++) {
        A.pena[smer][f] = pixely(S, S, (x, y) => {
          let vz, poz;
          if (smer < 4) { vz = [y, S - 1 - x, S - 1 - y, x][smer]; poz = [x, y, x, y][smer]; }
          else {
            const rx = smer === 4 || smer === 5 ? S - 1 - x : x, ry = smer === 5 || smer === 6 ? S - 1 - y : y;
            if (rx + ry === 0) return '#d9f4fa';
            if (rx + ry === 1 || rx + ry === 2 && (x + y + f) % 2 === 0) return 'rgba(255,255,255,.75)';
            return null;
          }
          if (vz === 0) return '#d9f4fa';
          const vl = (poz + f * 2) % 8;
          if (vz === 1 && vl < 5) return 'rgba(255,255,255,.85)';
          if (vz === 2 && (vl === 1 || vl === 2)) return 'rgba(255,255,255,.55)';
          if (vz === 3 && vl === 6) return 'rgba(255,255,255,.35)';
          return null;
        });
      }
      A.breh[smer] = pixely(S, S, (x, y) => {
        if (smer >= 4) return null;
        const vz = [y, S - 1 - x, S - 1 - y, x][smer];
        return vz === 0 ? 'rgba(60,40,10,.2)' : null;
      });
      A.mlha[smer] = [0, 1].map(v => { const m = maska(smer, v, 'mlha'); return pixely(S, S, (x, y) => m(x, y) ? BARVA_MLHY : null); });
    }
    for (const k in SPRITY) A.obj[k] = [sprite(SPRITY[k], false), sprite(SPRITY[k], true)];
    // políčko: záhony ve 3 fázích (0 čerstvě zasazené, 1 roste, 2 zralé)
    A.policko = [0, 1, 2].map(faze => pixely(S, S, (x, y) => {
      if (x === 0 || x === S - 1 || y === 0 || y === S - 1) return null;
      const zahon = y % 3 !== 0;
      if (!zahon) return '#5a3d22';
      const rostlina = x % 3 === 1 && (y % 3 === 1);
      if (rostlina && faze === 0) return '#7fbf3f';
      if (faze >= 1 && (x % 3 === 1 || (y % 3 === 1 && x % 3 === 2))) {
        if (faze === 2) return (x + y) % 2 ? '#e8c440' : '#c9a02c';   // zralé klasy
        return y % 3 === 1 ? '#5fa83a' : '#3f8a2e';
      }
      return (x + y) % 5 === 0 ? '#7a5634' : '#6b4a2b';
    }));
    // molo: lávka z prken ve směru k vodě (0 S, 1 V, 2 J, 3 Z), kreslí se na sousední vodní pole
    A.molo = [0, 1, 2, 3].map(smer => pixely(S, S, (x, y) => {
      const podel = smer % 2 === 0 ? y : x, napric = smer % 2 === 0 ? x : y;
      if (napric < 4 || napric > 11) return null;
      const kul = (napric === 4 || napric === 11) && (podel === 3 || podel === 12);
      if (kul) return '#4a2f18';
      if (napric === 4 || napric === 11) return '#6e4a22';
      return podel % 3 === 0 ? '#7a5128' : (podel + napric) % 7 === 0 ? '#b07a44' : '#9a6634';
    }));
    return A;
  }
  const BARVA_MLHY = '#0d1a2b';

  // --- vykreslení mapy ----------------------------------------------------------
  const DX8 = [0, 1, 0, -1, 1, 1, -1, -1], DY8 = [-1, 0, 1, 0, -1, 1, 1, -1];
  const OBJ_SPRITE = { [OBJ.PALMA]: 'palma', [OBJ.STROM]: 'strom', [OBJ.KER]: 'ker', [OBJ.BALVAN]: 'balvan' };

  /* stav = { svet, mlha, vseOdkryte, hrac:{x,y}, vyber:{x,y}|null, cesta:[{x,y}] }
     kam  = { x, y, z }  – levý horní roh v pixelech světa, z = zařízení px na pixel světa */
  function kresli(ctx, stav, kam, snimek) {
    const a = pripravAtlas();
    const { svet, mlha } = stav;
    const cw = ctx.canvas.width, ch = ctx.canvas.height, z = kam.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BARVA_MLHY; ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = false;
    const ox = Math.round(kam.x * z), oy = Math.round(kam.y * z);
    ctx.setTransform(z, 0, 0, z, -ox, -oy);

    const x0 = Math.floor(kam.x / S) - 1, y0 = Math.floor(kam.y / S) - 1;
    const x1 = Math.ceil((kam.x + cw / z) / S) + 1, y1 = Math.ceil((kam.y + ch / z) / S) + 2;
    const cl = (v, m) => v < 0 ? 0 : v >= m ? m - 1 : v;
    const znamo = (x, y) => stav.vseOdkryte || mlha[cl(y, H) * W + cl(x, W)];
    const terenNa = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? TEREN.HLUBINA : svet.teren[y * W + x];
    const var_ = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? (smichej(x, y, 1) & 3) : svet.varianta[y * W + x];

    // 1) terén + přechody + pobřeží
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!znamo(x, y)) continue;
      const t = terenNa(x, y), v = var_(x, y), px = x * S, py = y * S;
      ctx.drawImage(a.teren[t][v][snimek % SNIMKU], px, py);
      const pr = PRIORITA[t], tr = TRIDA(t);
      const sous = [];
      for (let s = 0; s < 8; s++) sous.push(terenNa(x + DX8[s], y + DY8[s]));
      for (let s = 0; s < 8; s++) {
        const n = sous[s];
        if (n === t) continue;
        if (TRIDA(n) === tr) {
          if (PRIORITA[n] <= pr || !a.pres[n]) continue;
          // roh jen tam, kde ho nepokryjí hrany
          if (s >= 4) { const e1 = sous[[0, 2, 2, 0][s - 4]], e2 = sous[[1, 1, 3, 3][s - 4]]; if (e1 === n || e2 === n) continue; }
          ctx.drawImage(a.pres[n][s][(x * 7 + y * 13 + s) & 1][snimek % SNIMKU], px, py);
        } else if (tr === 0) {
          if (s >= 4) { const e1 = sous[[0, 2, 2, 0][s - 4]], e2 = sous[[1, 1, 3, 3][s - 4]]; if (TRIDA(e1) === 1 || TRIDA(e2) === 1) continue; }
          ctx.drawImage(a.pena[s][snimek % SNIMKU], px, py);
        } else if (s < 4) ctx.drawImage(a.breh[s], px, py);
      }
    }
    // 1b) prošlapané cesty: pěšina (řídce vyšlapaná hlína), stezka (souvislá cesta) – propojené se sousedy
    const sl = stav.slapano, P_ = T.hra ? T.hra.PESINA : 4, ST = T.hra ? T.hra.STEZKA : 12;
    if (sl) for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      const i = y * W + x, n = sl[i] || 0;
      if (n < P_ || !znamo(x, y)) continue;
      const stezka = n >= ST, px = x * S, py = y * S;
      const ramena = [[6, 5, 4, 7, 0, -1], [9, 6, 7, 4, 1, 0], [6, 9, 4, 7, 0, 1], [0, 6, 7, 4, -1, 0]];   // S, V, J, Z
      const obdelniky = [[5, 5, 6, 6]];
      for (const [rx, ry, rw, rh, dx, dy] of ramena) {
        const j = (y + dy) * W + (x + dx);
        if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H && (sl[j] || 0) >= P_) obdelniky.push([rx, dy < 0 ? 0 : ry, rw, rh]);
      }
      ctx.fillStyle = stezka ? '#c9ad74' : '#a8895a';
      for (const [rx, ry, rw, rh] of obdelniky) {
        if (stezka) ctx.fillRect(px + rx, py + ry, rw, rh);
        else for (let a = 0; a < rw; a++) for (let b = 0; b < rh; b++) if ((rx + a + ry + b) % 2 === 0) ctx.fillRect(px + rx + a, py + ry + b, 1, 1);
      }
      if (stezka) {                                        // kamínky a stopy na stezce
        ctx.fillStyle = '#9a7c4c';
        ctx.fillRect(px + 7, py + 7, 1, 1); ctx.fillRect(px + 9, py + 8, 1, 1);
      }
    }
    // 2) mlha: okraj neznáma zasahuje rastrem do známých polí
    if (!stav.vseOdkryte) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!znamo(x, y)) continue;
      for (let s = 0; s < 8; s++) {
        if (znamo(x + DX8[s], y + DY8[s])) continue;
        if (s >= 4 && (!znamo(x + DX8[[0, 2, 2, 0][s - 4]], y + DY8[[0, 2, 2, 0][s - 4]]) ||
                       !znamo(x + DX8[[1, 1, 3, 3][s - 4]], y + DY8[[1, 1, 3, 3][s - 4]]))) continue;
        ctx.drawImage(a.mlha[s][(x + y) & 1], x * S, y * S);
      }
    }
    // 2b) lávky mol a políčka (ploché, pod objekty)
    const stavbyNa = {};
    for (const b of (stav.stavby || [])) stavbyNa[b.i] = b;
    for (const b of (stav.stavby || [])) {
      const bx = b.i % W, by = (b.i / W) | 0;
      if (!znamo(bx, by)) continue;
      if (b.typ === 'molo') {
        const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][b.smer];
        ctx.drawImage(a.molo[b.smer], (bx + dx) * S, (by + dy) * S);
        ctx.drawImage(a.molo[b.smer], bx * S + dx * 8, by * S + dy * 8);
      } else if (b.typ === 'lodenice' && stav.lod) {
        // rozestavěná loď na vodě vedle loděnice: kýl → trup → stěžeň → plachta
        const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][b.smer];
        const d = stav.lod.dil, faze = d >= 5 ? 3 : d >= 3 ? 2 : d >= 1 ? 1 : (stav.lod.zaplaceno || stav.lod.prace ? 0 : -1);
        if (faze >= 0) {
          const spr = a.obj['lod' + faze][0], vx = (bx + dx) * S, vy = (by + dy) * S;
          ctx.drawImage(spr, vx, vy + S - spr.height - (snimek & 2 ? 1 : 0));
        }
      } else if (b.typ === 'policko') {
        const zbyva = b.zraje - (stav.den || 0);
        ctx.drawImage(a.policko[zbyva <= 0 ? 2 : zbyva <= 3 ? 1 : 0], bx * S, by * S);
      }
    }
    // 3) výběr a plánovaná cesta (pod objekty)
    if (stav.cesta) {
      for (const k of stav.cesta) {             // kam dnes síly nestačí, tečky zčervenají
        ctx.fillStyle = k.dosah === false ? 'rgba(255,90,70,.95)' : 'rgba(255,240,160,.95)';
        ctx.fillRect(k.x * S + 6, k.y * S + 6, 4, 4);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(k.x * S + 6, k.y * S + 10, 4, 1);
      }
    }
    // nálezy (čekající trosečníci) a lidé pracující v táboře
    const bednyNa = {};
    for (const bd of (stav.bedny || [])) bednyNa[bd.i] = bd;
    const nalezyNa = {};
    for (const n of (stav.nalezy || [])) if (n.stav === 'skryto' || n.stav === 'odmitnuto') nalezyNa[n.y * W + n.x] = n;
    const tabor = {};
    if (stav.tabor && stav.tabor.length && stav.domov) {
      const MISTA = [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 1], [-2, 1], [2, -1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2]];
      let k = 0;
      for (const [dx, dy] of MISTA) {
        if (k >= stav.tabor.length) break;
        const tx = stav.domov.x + dx, ty = stav.domov.y + dy;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        const i = ty * W + tx, t = svet.teren[i];
        if (!T.svet.CHODIT[t] || t === TEREN.REKA || svet.obj[i] || svet.lokNa[i] >= 0 || stavbyNa[i]) continue;
        (tabor[i] = tabor[i] || []).push([stav.tabor[k++], 0]);
      }
      // kdo se nevešel, stojí u ohně
      const oi = stav.domov.y * W + stav.domov.x;
      for (let dx = -4; k < stav.tabor.length && dx <= 4; dx += 8) (tabor[oi] = tabor[oi] || []).push([stav.tabor[k++], dx]);
    }
    // 4) objekty, lokace, hráč – po řádcích, aby vyšší sprity správně překrývaly
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      if (!znamo(x, y)) continue;
      const i = y * W + x, px = x * S, py = y * S;
      const li = svet.lokNa[i];
      let spr = null;
      const b = stavbyNa[i];
      if (li >= 0) spr = a.obj[svet.lokace[li].typ][0];
      else if (b && a.obj[b.typ]) spr = a.obj[b.typ][b.typ === 'ohniste' ? (snimek & 1) : 0];
      else if (svet.obj[i]) spr = a.obj[OBJ_SPRITE[svet.obj[i]]][svet.varianta[i] & 1];
      if (!spr && bednyNa[i]) spr = a.obj.bedna[0];
      if (spr) ctx.drawImage(spr, px, py + S - spr.height);
      if (b && b.poskozeno) {                               // výstražný trojúhelník nad poškozenou stavbou
        const vx = px + 11, vy = py + S - (spr ? spr.height : S) - 2;      // molo nemá sprite, jen lávku
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(vx - 1, vy - 1, 7, 8);
        ctx.fillStyle = snimek & 2 ? '#ff4a3a' : '#ffcc33'; ctx.fillRect(vx, vy, 5, 6);
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(vx + 2, vy + 1, 1, 3); ctx.fillRect(vx + 2, vy + 5, 1, 1);
      }
      if (b && b.typ === 'signal' && (b.hori || 0) >= (stav.den || 0)) {    // plameny a kouř nad hořící hranicí
        const fx = px + 8, fy = py + S - spr.height;
        const pl = ['#ff7a1a', '#ffb627', '#ffe066'];
        for (let k = 0; k < 9; k++) { const dx = ((k * 5 + snimek * 3) % 7) - 3, dy = -((k * 3 + snimek) % 6); ctx.fillStyle = pl[k % 3]; ctx.fillRect(fx + dx, fy + 3 + dy, 1 + (k % 2), 2); }
        ctx.fillStyle = 'rgba(210,210,210,.55)';
        for (let k = 0; k < 5; k++) { const vy = fy - 4 - ((k * 4 + snimek * 2) % 18); ctx.fillRect(fx - 2 + ((k + snimek) % 3), vy, 3, 2); }
      }
      const pracujici = tabor[i];
      if (pracujici) for (const [o, dx] of pracujici) { const ps = spritePostavy(o.vzhled, false, (x + dx) & 1); ctx.drawImage(ps, px + dx, py + S - ps.height); }
      const nalez = nalezyNa[i];
      if (nalez) nalez.lide.slice(0, 3).forEach((o, k) => {
        const ps = spritePostavy(o.vzhled, (snimek + k) % 4 < 2, k === 1);
        ctx.drawImage(ps, px + [0, -5, 5][k], py + S - ps.height - (k ? 1 : 0));
      });
      if (stav.hrac && stav.hrac.x === x && stav.hrac.y === y) {
        const vyp = stav.vyprava && stav.vyprava.length ? stav.vyprava : null;
        if (vyp) {
          for (let k = vyp.length - 1; k >= 1; k--) {        // členové výpravy jdou za vedoucím
            const ps = spritePostavy(vyp[k].vzhled, false, stav.hracZrcadlo);
            ctx.drawImage(ps, px + (stav.hracZrcadlo ? 5 : -5) * k, py + S - ps.height - 2);
          }
          const hs = spritePostavy(vyp[0].vzhled, false, stav.hracZrcadlo);
          ctx.drawImage(hs, px, py + S - hs.height);
        } else {
          const hs = a.obj.hrac[stav.hracZrcadlo ? 1 : 0];
          ctx.drawImage(hs, px, py + S - hs.height);
        }
      }
    }
    // třpytivé značky nápovědy (např. kráter se symbolem ohně)
    for (const i of stav.znacky || []) {
      const zx = (i % W) * S, zy = ((i / W) | 0) * S;
      if (!znamo(i % W, (i / W) | 0)) continue;
      const f = snimek % 4;
      ctx.fillStyle = f & 1 ? '#fff6a8' : '#ffd23f';
      for (const [dx, dy] of [[7, 1 + f], [8, 1 + f], [7, 2 + f], [8, 2 + f], [3, 7], [12, 7], [7, 12 - f], [8, 12 - f]]) ctx.fillRect(zx + dx, zy + dy, 1, 1);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(zx + 5, zy - 7, 7, 8);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(zx + 6, zy - 6, 5, 6);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(zx + 8, zy - 5, 1, 3); ctx.fillRect(zx + 8, zy - 1, 1, 1);
    }
    if (stav.vyber) {
      const px = stav.vyber.x * S, py = stav.vyber.y * S;
      ctx.fillStyle = snimek & 2 ? '#ffe680' : '#ffffff';
      for (const [dx, dy, w, h] of [[0, 0, 4, 1], [0, 0, 1, 4], [12, 0, 4, 1], [15, 0, 1, 4], [0, 15, 4, 1], [0, 12, 1, 4], [12, 15, 4, 1], [15, 12, 1, 4]])
        ctx.fillRect(px + dx, py + dy, w, h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    kresliPocasi(ctx, stav.pocasi, z, snimek);
  }

  // --- počasí přes mapu (v pixelech zařízení) ----------------------------------------
  function kresliPocasi(ctx, typ, z, snimek) {
    if (!typ) return;
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    if (typ === 'vedro') { ctx.fillStyle = 'rgba(255,140,40,.10)'; ctx.fillRect(0, 0, cw, ch); return; }
    if (typ === 'vitr' || typ === 'polojasno') {
      if (typ === 'vitr') { ctx.fillStyle = 'rgba(40,50,70,.12)'; ctx.fillRect(0, 0, cw, ch); }
      return;
    }
    if (typ !== 'dest' && typ !== 'boure') return;
    const boure = typ === 'boure';
    ctx.fillStyle = boure ? 'rgba(15,20,40,.35)' : 'rgba(30,40,60,.18)';
    ctx.fillRect(0, 0, cw, ch);
    if (boure && snimek % 17 === 0) { ctx.fillStyle = 'rgba(230,240,255,.45)'; ctx.fillRect(0, 0, cw, ch); }
    const pocet = Math.round(cw * ch / (boure ? 2500 : 5000) / Math.max(1, z / 2));
    const dx = boure ? z * 2 : 0;
    ctx.fillStyle = boure ? 'rgba(190,210,255,.55)' : 'rgba(170,200,255,.45)';
    for (let k = 0; k < pocet; k++) {
      const h1 = smichej(k, 1, 77) / 4294967296, h2 = smichej(k, 2, 77) / 4294967296;
      const y = (h2 * ch + snimek * z * 9) % ch, x = (h1 * cw + (boure ? snimek * z * 4 : 0)) % cw;
      ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, z / 2 | 0), z * 3);
      if (dx) ctx.fillRect(Math.round(x - dx), Math.round(y + z * 3), Math.max(1, z / 2 | 0), z);
    }
  }

  // --- minimapa: 1 pole = n px ---------------------------------------------------
  const BARVY_MINI = Object.fromEntries(Object.entries(PAL).map(([t, p]) => [t, p[0]]));
  BARVY_MINI[TEREN.LAVA] = '#ff7a2a';
  BARVY_MINI[TEREN.REKA] = '#5fb4ec';
  function kresliMinimapu(ctx, stav, kam, cw, ch) {
    const c = ctx.canvas, n = c.width / W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BARVA_MLHY; ctx.fillRect(0, 0, c.width, c.height);
    const { svet, mlha } = stav;
    for (let i = 0; i < W * H; i++) {
      if (!stav.vseOdkryte && !mlha[i]) continue;
      ctx.fillStyle = BARVY_MINI[svet.teren[i]];
      ctx.fillRect((i % W) * n, ((i / W) | 0) * n, n, n);
    }
    for (const l of svet.lokace) {
      if (!stav.vseOdkryte && !mlha[l.y * W + l.x]) continue;
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(l.x * n - n / 2, l.y * n - n / 2, n * 2, n * 2);
    }
    ctx.fillStyle = '#c47a2c';
    for (const b of (stav.stavby || [])) ctx.fillRect((b.i % W) * n, ((b.i / W) | 0) * n, n, n);
    ctx.fillStyle = '#e8b04a';
    for (const bd of (stav.bedny || [])) if (stav.vseOdkryte || mlha[bd.i]) ctx.fillRect((bd.i % W) * n, ((bd.i / W) | 0) * n, n, n);
    ctx.fillStyle = '#ff9ad5';
    for (const nl of (stav.nalezy || [])) if ((nl.stav === 'skryto' || nl.stav === 'odmitnuto') && (stav.vseOdkryte || mlha[nl.y * W + nl.x])) ctx.fillRect(nl.x * n - n / 2, nl.y * n - n / 2, n * 2, n * 2);
    if (stav.hrac) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(stav.hrac.x * n - n / 2, stav.hrac.y * n - n / 2, n * 2, n * 2); }
    // výřez kamery
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.max(1, n / 2);
    ctx.strokeRect(kam.x / S * n, kam.y / S * n, cw / kam.z / S * n, ch / kam.z / S * n);
  }

  T.grafika = { S, SNIMKU, pripravAtlas, kresli, kresliMinimapu, SPRITY, PAL, portret, portretURL, spritePostavy };
})(TROS);
