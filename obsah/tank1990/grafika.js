/* Tank 1990 – grafika. Kreslí do bufferu 256×224 (rozlišení NES), zvětšení řeší ui.js.
   Všechny sprity vznikají kódem: textury 8×8 z řetězců, tanky z obdélníků, výbuchy ze šumu. */
var TANK = globalThis.TANK || (globalThis.TANK = {});
(function (T) {
'use strict';

const W = 256, H = 224, OX = 16, OY = 8;
const SEDA = '#636363', BILA = '#fcfcfc', CERVENA = '#d82800', ORANZ = '#fc9838';
const K = T.K;

function platno(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function zeRetezcu(radky, pal, w, h) {
  w = w || Math.max(...radky.map(r => r.length)); h = h || radky.length;
  const c = platno(w, h), x = c.getContext('2d');
  radky.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const b = pal[r[i]]; if (b) { x.fillStyle = b; x.fillRect(i, j, 1, 1); } } });
  return c;
}
function otoc(src, smer) {
  if (!smer) return src;
  const c = platno(src.width, src.height), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.translate(src.width / 2, src.height / 2); x.rotate(smer * Math.PI / 2);
  x.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}
function zrcadli(polovina) {            // 8 znaků vlevo → 16 souměrně
  return polovina.map(r => r + r.split('').reverse().join(''));
}

/* ---------- písmo 5×7, tučné (každý bod 2 px na šířku) v buňce 8×8 ---------- */
const PISMO = {
  A: '.###. #...# #...# ##### #...# #...# #...#', B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.', D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####', F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####', H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.', J: '..### ...#. ...#. ...#. #..#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#', L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#', N: '#...# ##..# #.#.# #..## #...# #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.', P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#', R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.###. #...# #.... .###. ....# #...# .###.', T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.', V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# ##.## #...#', X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', Z: '##### ....# ...#. ..#.. .#... #.... #####',
  0: '.###. #...# #..## #.#.# ##..# #...# .###.', 1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  2: '.###. #...# ....# ..##. .#... #.... #####', 3: '##### ...#. ..#.. ...#. ....# #...# .###.',
  4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.', 5: '##### #.... ####. ....# ....# #...# .###.',
  6: '..##. .#... #.... ####. #...# #...# .###.', 7: '##### ....# ...#. ..#.. .#... .#... .#...',
  8: '.###. #...# #...# .###. #...# #...# .###.', 9: '.###. #...# #...# .#### ....# ...#. .##..',
  '-': '..... ..... ..... ##### ..... ..... .....', '.': '..... ..... ..... ..... ..... .##.. .##..',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..', '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
  ':': '..... .##.. .##.. ..... .##.. .##.. .....', '/': '....# ...#. ...#. ..#.. .#... .#... #....',
  '<': '...#. ..#.. .#... #.... .#... ..#.. ...#.', '>': '.#... ..#.. ...#. ....# ...#. ..#.. .#...',
  "'": '..#.. ..#.. ..... ..... ..... ..... .....',
};
const glyfy = new Map();
function glyf(ch, barva) {
  const k = barva + ch;
  let c = glyfy.get(k);
  if (c) return c;
  c = platno(8, 8);
  const def = PISMO[ch];
  if (def) {
    const x = c.getContext('2d'); x.fillStyle = barva;
    def.split(' ').forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') x.fillRect(i + 1, j, 2, 1); });
  }
  glyfy.set(k, c);
  return c;
}
function text(ctx, s, x, y, barva) {
  s = String(s).toUpperCase();
  for (let i = 0; i < s.length; i++) if (s[i] !== ' ') ctx.drawImage(glyf(s[i], barva || BILA), x + i * 8, y);
}
function textStred(ctx, s, y, barva) { text(ctx, s, Math.round((W - String(s).length * 8) / 2), y, barva); }
function textVpravo(ctx, s, xKonec, y, barva) { s = String(s); text(ctx, s, xKonec - s.length * 8, y, barva); }

/* ---------- textury 8×8 ---------- */
function tex(radky, pal) {
  const a = new Uint8ClampedArray(256);
  radky.forEach((r, j) => { for (let i = 0; i < 8; i++) { const b = pal[r[i]]; if (b) { a.set(hex(b), (j * 8 + i) * 4); a[(j * 8 + i) * 4 + 3] = 255; } } });
  return a;
}
const TEX = {
  cihla: tex(['bbbmbbbb', 'aaamaaaa', 'aaamaaaa', 'mmmmmmmm', 'bbbbbbbm', 'aaaaaaam', 'aaaaaaam', 'mmmmmmmm'],
    { b: '#e0783c', a: '#a8481c', m: '#6b6b6b' }),
  ocel: tex(['wwwwwwwd', 'wggggggd', 'wggwwggd', 'wgwwwwgd', 'wgwwwwgd', 'wggwwggd', 'wggggggd', 'dddddddd'],
    { w: '#fcfcfc', g: '#bcbcbc', d: '#7c7c7c' }),
  voda1: tex(['bbbbbbbb', 'bllbbbbb', 'lbblbbbb', 'bbbbbbbb', 'bbbbbllb', 'bbbblbbl', 'bbbbbbbb', 'bbbbbbbb'],
    { b: '#2038ec', l: '#3cbcfc' }),
  voda2: tex(['bbbbbbbb', 'bbbllbbb', 'bblbblbb', 'bbbbbbbb', 'lbbbbbbl', 'blbbbbbb', 'bbbbbbbb', 'bbbbbbbb'],
    { b: '#2038ec', l: '#3cbcfc' }),
  les: tex(['.lgg.lg.', 'lgggglgg', 'gggdggdg', '.gdd.gd.', '.lgg.lgg', 'lggglggg', 'ggdgggdg', '.dd..dd.'],
    { l: '#80d010', g: '#38a800', d: '#005800' }),
  led: tex(['wwwwwwwg', 'wwwwwwgw', 'wwwwwgww', 'wwwwgwww', 'wwwgwwww', 'wwgwwwww', 'wgwwwwww', 'gwwwwwww'],
    { w: '#d8d8d8', g: '#9c9c9c' }),
};

/* Cihlová textura přes celou obrazovku – pro velká písmena titulku. */
let cihlyObr = null;
function cihly() {
  if (cihlyObr) return cihlyObr;
  cihlyObr = platno(W, H);
  const x = cihlyObr.getContext('2d'), img = x.createImageData(W, H);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const ti = ((py & 7) * 8 + (px & 7)) * 4, o = (py * W + px) * 4;
    for (let k = 0; k < 4; k++) img.data[o + k] = TEX.cihla[ti + k];
  }
  x.putImageData(img, 0, 0);
  return cihlyObr;
}
/* Velký text z cihel: každý bod písma = blok 4×4 (měřítko m). */
function velkyText(ctx, s, x, y, m) {
  m = m || 4;
  const c = cihly();
  for (let n = 0; n < s.length; n++) {
    const def = PISMO[s[n]];
    if (!def) continue;
    def.split(' ').forEach((r, j) => {
      for (let i = 0; i < 5; i++) if (r[i] === '#') {
        const px = x + n * 6 * m + i * m, py = y + j * m;
        ctx.drawImage(c, px, py, m, m, px, py, m, m);
      }
    });
  }
}
function velkyTextSirka(s, m) { return s.length * 6 * (m || 4) - (m || 4); }

/* ---------- vrstvy terénu ---------- */
const vrstvy = { teren: platno(208, 208), les: platno(208, 208), m: null, verze: -1, voda: -1 };
const tCtx = vrstvy.teren.getContext('2d'), lCtx = vrstvy.les.getContext('2d');
const tImg = tCtx.createImageData(208, 208), lImg = lCtx.createImageData(208, 208);
function obnovTeren(m, verze, vodaF) {
  if (vrstvy.m === m && vrstvy.verze === verze && vrstvy.voda === vodaF) return;
  vrstvy.m = m; vrstvy.verze = verze; vrstvy.voda = vodaF;
  const td = tImg.data, ld = lImg.data, voda = vodaF ? TEX.voda2 : TEX.voda1;
  td.fill(0); ld.fill(0);
  for (let py = 0; py < 208; py++) {
    const radek = (py >> 2) * K.N;
    for (let px = 0; px < 208; px++) {
      const v = m[radek + (px >> 2)];
      if (!v) continue;
      const ti = ((py & 7) * 8 + (px & 7)) * 4, o = (py * 208 + px) * 4;
      const t = v === K.CIHLA ? TEX.cihla : v === K.OCEL ? TEX.ocel : v === K.VODA ? voda : v === K.LED ? TEX.led : null;
      if (t) { td[o] = t[ti]; td[o + 1] = t[ti + 1]; td[o + 2] = t[ti + 2]; td[o + 3] = t[ti + 3]; }
      else if (v === K.LES) { const l = TEX.les; ld[o] = l[ti]; ld[o + 1] = l[ti + 1]; ld[o + 2] = l[ti + 2]; ld[o + 3] = l[ti + 3]; }
    }
  }
  tCtx.putImageData(tImg, 0, 0); lCtx.putImageData(lImg, 0, 0);
}

/* ---------- tanky ---------- */
const PALETY = {
  zluta:    { l: '#fce0a8', m: '#e4a010', d: '#8c5800' },
  zelena:   { l: '#b8f8a0', m: '#30a020', d: '#005800' },
  stribrna: { l: '#fcfcfc', m: '#a8a8a8', d: '#505050' },
  cervena:  { l: '#fcb8a0', m: '#d82800', d: '#801000' },
  pancir4:  { l: '#b0f0c8', m: '#20a868', d: '#085030' },
  pancir3:  { l: '#fcf0b0', m: '#c8b020', d: '#706000' },
  pancir2:  { l: '#e0f0fc', m: '#7898c8', d: '#304868' },
};
const MODELY = {
  P0: { pas: 3, okraj: 1, trup: [4, 4, 8, 10], vez: [5, 6, 6, 6], hlaven: [7, 1, 2, 6] },
  P1: { pas: 3, okraj: 1, trup: [4, 3, 8, 11], vez: [5, 5, 6, 7], hlaven: [7, 0, 2, 6] },
  P2: { pas: 4, okraj: 0, trup: [4, 3, 8, 12], vez: [4, 5, 8, 7], hlaven: [7, 0, 2, 6] },
  P3: { pas: 4, okraj: 0, trup: [4, 2, 8, 13], vez: [4, 4, 8, 8], hlaven: [6, 0, 4, 5], dvoj: true },
  E0: { pas: 3, okraj: 1, trup: [4, 5, 8, 9], vez: [5, 7, 6, 5], hlaven: [7, 1, 2, 7] },
  E1: { pas: 2, okraj: 2, trup: [4, 3, 8, 12], vez: [6, 7, 4, 5], hlaven: [7, 0, 2, 8] },
  E2: { pas: 4, okraj: 0, trup: [4, 4, 8, 10], vez: [4, 5, 8, 8], hlaven: [7, 0, 2, 6] },
  E3: { pas: 4, okraj: 0, trup: [3, 3, 10, 12], vez: [4, 4, 8, 9], hlaven: [6, 0, 4, 5], panc: true },
};
function tankNahoru(model, p, f) {
  const c = platno(16, 16), x = c.getContext('2d'), M = MODELY[model];
  const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  for (const sx of [M.okraj, 16 - M.okraj - M.pas]) {           // pásy s posouvajícími se články
    r(sx, 1, M.pas, 15, p.d);
    for (let yy = 1 + (f & 1); yy < 16; yy += 2) r(sx, yy, M.pas, 1, p.m);
    r(sx, 1, 1, 15, p.d);
  }
  const [hx, hy, hw, hh] = M.trup;                               // trup
  r(hx, hy, hw, hh, p.m); r(hx, hy, hw, 1, p.l); r(hx, hy, 1, hh, p.l);
  r(hx, hy + hh - 1, hw, 1, p.d); r(hx + hw - 1, hy, 1, hh, p.d);
  if (M.panc) { r(hx + 1, hy + 3, hw - 2, 1, p.d); r(hx + 1, hy + hh - 4, hw - 2, 1, p.d); }
  const [vx, vy, vw, vh] = M.vez;                                // věž se seříznutými rohy
  r(vx + 1, vy, vw - 2, vh, p.l); r(vx, vy + 1, vw, vh - 2, p.l);
  r(vx + 1, vy + 1, vw - 2, vh - 2, p.m); r(vx + 2, vy + vh - 2, vw - 3, 1, p.d);
  const [bx, by, bw, bh] = M.hlaven;                             // hlaveň
  if (M.dvoj) { r(bx, by, 1, bh + 1, p.l); r(bx + bw - 1, by, 1, bh + 1, p.l); r(bx + 1, by + 1, bw - 2, bh, p.d); }
  else { r(bx, by, bw, bh + 1, p.l); r(bx + bw - 1, by + 1, 1, bh, p.d); }
  return c;
}
const spr = new Map();
function sprTanku(model, pal, smer, f) {
  const k = model + pal + smer + f;
  let s = spr.get(k);
  if (!s) { s = otoc(tankNahoru(model, PALETY[pal], f), smer); spr.set(k, s); }
  return s;
}

const lode = (function () {
  const c = platno(20, 20), x = c.getContext('2d');
  x.fillStyle = '#ac7c00';
  for (let i = 0; i < 4; i++) x.fillRect(8 - i * 2, i, 4 + i * 4, 1);   // příď
  x.fillRect(1, 4, 18, 16);
  x.fillStyle = '#fcbc3c'; x.fillRect(1, 4, 1, 16); x.fillRect(9, 0, 2, 1);
  x.clearRect(3, 6, 14, 12);
  return [0, 1, 2, 3].map(s => otoc(c, s));
})();

const stity = [0, 1].map(f => {
  const c = platno(16, 16), x = c.getContext('2d');
  x.fillStyle = BILA;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const okraj = i === 0 || j === 0 || i === 15 || j === 15;
    const roh = (i < 2 || i > 13) && (j < 2 || j > 13);
    if (okraj && !roh && ((i + j + f * 2) & 3) < 2) x.fillRect(i, j, 1, 1);
  }
  x.fillRect(1, 1, 1, 1); x.fillRect(14, 1, 1, 1); x.fillRect(1, 14, 1, 1); x.fillRect(14, 14, 1, 1);
  return c;
});

/* Hvězdička zrodu (4 velikosti tam a zpět). */
const hvezdy = [2, 4, 6, 7].map(s => {
  const c = platno(16, 16), x = c.getContext('2d');
  for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) {
    const a = Math.abs(i), b = Math.abs(j);
    const paprsek = (a === 0 && b <= s) || (b === 0 && a <= s) || (a === b && a <= s / 2);
    if (!paprsek) continue;
    x.fillStyle = Math.max(a, b) <= s / 3 ? BILA : '#3cbcfc';
    x.fillRect(8 + i, 8 + j, 1, 1);
  }
  return c;
});

/* Výbuchy: malé 16×16 (3 fáze), velké 32×32 (2 fáze). */
function vybuchObr(vel, r, seed) {
  const c = platno(vel, vel), x = c.getContext('2d'), st = vel / 2;
  let a = seed;
  const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  for (let j = 0; j < vel; j++) for (let i = 0; i < vel; i++) {
    const dx = i + 0.5 - st, dy = j + 0.5 - st, d = Math.hypot(dx, dy);
    const uhel = Math.atan2(dy, dx), mez = r * (0.7 + 0.3 * Math.abs(Math.sin(uhel * 3.5 + seed)));
    const n = rnd();
    if (d > mez || (d > mez * 0.6 && n < 0.35)) continue;
    x.fillStyle = d < mez * 0.35 ? BILA : d < mez * 0.65 ? CERVENA : '#6844fc';
    x.fillRect(i, j, 1, 1);
  }
  return c;
}
const VYB_MALY = [vybuchObr(16, 4, 1), vybuchObr(16, 6, 2), vybuchObr(16, 8, 3)];
const VYB_VELKY = [vybuchObr(32, 11, 4), vybuchObr(32, 15, 5)];

/* ---------- orel, ikony, vlajka ---------- */
const OREL = zeRetezcu(zrcadli([
  '1.......', '11.....1', '121...12', '1221..12', '12221.11', '.1222112', '..122222', '...12222',
  '....1222', '...12122', '..121.12', '..1...12', '.....122', '....1222', '...12222', '..111111',
]), { 1: '#a8a8a8', 2: BILA });
const OREL_ZNICENY = zeRetezcu([
  '................', '................', '................', '................', '.......2........',
  '.......22.......', '.......222......', '.......2........', '.......2........', '...1...2..1.....',
  '..121..2.121....', '.12221.21222.1..', '1222221222221211', '1121212112121121', '1211121212112121', '1111111111111111',
], { 1: '#545454', 2: '#a8a8a8' });

const IKONA_NEP = zeRetezcu(['...#....', '#..#..#.', '#######.', '##...##.', '##...##.', '#######.', '#.....#.', '........'], { '#': '#000' });
const IKONA_HR = zeRetezcu(['...#....', '#..#..#.', '#######.', '##...##.', '##...##.', '#######.', '#.....#.', '........'], { '#': '#c84c0c' });
const VLAJKA = zeRetezcu([
  '................', '.#..............', '.#oooooo........', '.#ooooooooo.....', '.#oooooooooooo..',
  '.#ooooooooo.....', '.#oooooo........', '.#..............', '.#..............', '.#..............',
  '.#..............', '.#..............', '.#..............', '.#..............', '####............', '................',
], { '#': '#000', o: '#e45c10' });

const PAL_B = { w: BILA, g: '#bcbcbc', d: '#545454', r: CERVENA, y: '#fcbc3c', b: '#ac7c00', c: '#3cbcfc', k: '#000' };
const IKONY_B = {
  helma: ['............', '....wwww....', '..wwggggww..', '.wggwwggggw.', '.wgwgggggggw', 'wggggggggggw',
    'wggggggggggw', 'wwwwwwwwwwww', 'dwwwwwwwwwwd', '............'],
  hodiny: ['....wwww....', '..wwggggww..', '.wgggrggggw.', '.wgggrggggw.', 'wggggrgggggw', 'wggggrrrrggw',
    'wggggggggggw', 'wggggggggggw', '.wggggggggw.', '.wggggggggw.', '..wwggggww..', '....wwww....'],
  lopata: ['..........ww', '.........wbw', '........wbw.', '.......wbw..', '......wbw...', '..ggwwbw....',
    '.ggggww.....', 'gggggg......', 'gggggg......', 'ggggg.......', '.ggg........'],
  hvezda: ['.....yy.....', '.....yy.....', '....yyyy....', 'yyyyyyyyyyyy', '.yyyyyyyyyy.', '..yyyyyyyy..',
    '...yyyyyy...', '...yyyyyy...', '..yyy..yyy..', '..yy....yy..', '.yy......yy.'],
  granat: ['.....ddd....', '....d..d....', '....wwww....', '...gggggg...', '..gdgdgdgg..', '.gggggggggg.',
    '.gdgdgdgdgg.', '.gggggggggg.', '.gdgdgdgdgg.', '..gggggggg..', '...gggggg...'],
  tank: ['.....ww.....', '.....ww.....', 'dd...ww...dd', 'dyyyyyyyyyyd', 'dyywwwwwwyyd', 'dyywyyyyyyyd',
    'dyywyyyyyyyd', 'dyyyyyyyyyyd', 'dyyyyyyyyyyd', 'dd........dd'],
  lod: ['......w.....', '......ww....', '......www...', '......wwww..', '......w.....', '......w.....',
    'bbbbbbbbbbbb', '.bbbbbbbbbb.', '..bbbbbbbb..', 'cccccccccccc', '.c..c..c..c.'],
  pistole: ['............', '.wwwwwwwwww.', '.wggggggggww', '.wwwwwwwwww.', '.wbbw.......', '.wbbbw......',
    '..wbbw......', '..wbbbw.....', '...wbbw.....', '...wwww.....'],
};
const IKONY = {};
for (const [k, r] of Object.entries(IKONY_B)) {
  const c = platno(16, 16), x = c.getContext('2d');
  const obr = zeRetezcu(r, PAL_B, 12, 12), stin = zeRetezcu(r.map(s => s.replace(/[^.]/g, 'k')), PAL_B, 12, 12);
  const oy = 2 + Math.floor((12 - r.length) / 2);
  x.drawImage(stin, 3, oy + 1); x.drawImage(stin, 1, oy - 1); x.drawImage(stin, 3, oy - 1); x.drawImage(stin, 1, oy + 1);
  x.drawImage(obr, 2, oy);
  IKONY[k] = c;
}

/* ---------- tank na scéně ---------- */
function paletaTanku(t, cas) {
  if (t.hrac >= 0) return t.hrac === 0 ? 'zluta' : 'zelena';
  if (t.nositel && (cas >> 3) & 1) return 'cervena';
  if (t.typ === 3 && t.hp > 1) return ((cas >> 2) & 1) ? 'stribrna' : 'pancir' + t.hp;
  return 'stribrna';
}
function kresliTank(ctx, t, cas) {
  if (t.zmraz > 0 && (cas >> 3) & 1) return;            // omráčený spoluhráč bliká
  const x = OX + t.x, y = OY + t.y;
  const lod = t.hrac >= 0 ? t.h.lod : t.lod;
  if (lod) ctx.drawImage(lode[t.smer], x - 2, y - 2);
  const model = t.hrac >= 0 ? 'P' + t.h.uroven : 'E' + t.typ;
  ctx.drawImage(sprTanku(model, paletaTanku(t, cas), t.smer, (t.anim >> 1) & 1), x, y);
  if (t.stit > 0) ctx.drawImage(stity[(cas >> 1) & 1], x, y);
}

/* ---------- herní obrazovka ---------- */
function hra(ctx, G, o) {
  const cas = G.cas;
  ctx.fillStyle = SEDA; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(OX, OY, 208, 208);
  obnovTeren(G.m, G.verzeTerenu, (cas >> 5) & 1);
  ctx.drawImage(vrstvy.teren, OX, OY);
  ctx.drawImage(G.orelZnicen ? OREL_ZNICENY : OREL, OX + K.ORL.x, OY + K.ORL.y);

  for (const z of G.zjeveni) {
    const f = (z.t >> 2) % 6, i = f < 4 ? f : 6 - f;
    ctx.drawImage(hvezdy[i], OX + z.x, OY + z.y);
  }
  for (const t of G.tanky) kresliTank(ctx, t, cas);
  ctx.fillStyle = '#bcbcbc';
  for (const s of G.strely) {
    if ((s.smer & 1) === 0) ctx.fillRect(OX + s.x - 1, OY + s.y - 2, 3, 4);
    else ctx.fillRect(OX + s.x - 2, OY + s.y - 1, 4, 3);
  }
  ctx.drawImage(vrstvy.les, OX, OY);

  for (const v of G.vybuchy) {
    let obr;
    if (!v.velky) obr = VYB_MALY[Math.min(2, v.t >> 2)];
    else { const f = Math.floor(v.t / 5); obr = f < 3 ? VYB_MALY[f] : VYB_VELKY[f === 4 ? 1 : 0]; }
    ctx.drawImage(obr, OX + v.x - obr.width / 2, OY + v.y - obr.height / 2);
  }
  if (G.bonus && ((cas >> 3) % 3) !== 2) ctx.drawImage(IKONY[G.bonus.typ], OX + G.bonus.x, OY + G.bonus.y);
  for (const p of G.popisky) if (p.t >= 0) text(ctx, p.text, OX + p.x - p.text.length * 4, OY + p.y - 4, BILA);

  // pravý panel
  const zb = Math.min(20, G.fronta.length);
  for (let i = 0; i < zb; i++) ctx.drawImage(IKONA_NEP, 232 + (i & 1) * 8, 24 + (i >> 1) * 8);
  const S = G.S;
  text(ctx, 'IP', 232, 128, '#000');
  ctx.drawImage(IKONA_HR, 232, 136); text(ctx, Math.max(0, S.hraci[0].zivoty - 1), 240, 136, '#000');
  if (S.hracu === 2) {
    text(ctx, 'IIP', 228, 152, '#000');
    ctx.drawImage(IKONA_HR, 232, 160); text(ctx, Math.max(0, S.hraci[1].zivoty - 1), 240, 160, '#000');
  }
  ctx.drawImage(VLAJKA, 232, 176);
  textVpravo(ctx, G.stage, 248, 192, '#000');

  if (G.gameOverT >= 0) {
    const y = Math.max(96, 216 - G.gameOverT * 1.2) | 0;
    text(ctx, 'GAME', OX + 88, y, CERVENA); text(ctx, 'OVER', OX + 88, y + 8, CERVENA);
  }
  if (o && o.pauza && ((o.t >> 4) & 1)) text(ctx, 'PAUSE', OX + 84, OY + 100, CERVENA);
}

/* ---------- titulní obrazovka ---------- */
const MENU = ['1 PLAYER', '2 PLAYERS', 'CONSTRUCTION'];
function titul(ctx, st) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const dy = Math.round(st.titY);
  text(ctx, 'I-', 24, 12 + dy); textVpravo(ctx, st.posledni, 96, 12 + dy);
  text(ctx, 'HI-', 112, 12 + dy); textVpravo(ctx, st.hi, 184, 12 + dy);
  velkyText(ctx, 'TANK', (W - velkyTextSirka('TANK')) >> 1, 32 + dy);
  velkyText(ctx, '1990', (W - velkyTextSirka('1990')) >> 1, 68 + dy);
  MENU.forEach((m, i) => text(ctx, m, 88, 116 + i * 16 + dy));
  if (!dy) ctx.drawImage(sprTanku('P0', 'zluta', 1, (st.t >> 2) & 1), 64, 112 + st.volba * 16);
  textStred(ctx, 'TANK A 1990 - FAN REMAKE', 188 + dy, '#a8a8a8');
}

function opona(ctx, st) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const p = Math.min(1, st.t / 24), v = Math.round(H / 2 * p);
  ctx.fillStyle = SEDA; ctx.fillRect(0, 0, W, v); ctx.fillRect(0, H - v, W, v);
  if (p < 1) return;
  const s = 'STAGE' + String(st.stage).padStart(3, ' ');
  textStred(ctx, s, 104, '#000');
  if (st.vyber) {
    textStred(ctx, st.vlastni && st.stage === 1 ? 'CONSTRUCTION' : '', 120, '#3c3c3c');
    textStred(ctx, 'UP/DOWN: STAGE', 176, '#3c3c3c');
    textStred(ctx, 'FIRE: START', 192, '#3c3c3c');
  }
}

/* Sčítání bodů po kole – st.radek/st.pocet řídí, kolik je odhaleno. */
function skore(ctx, st) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  text(ctx, 'HI-SCORE', 64, 12, CERVENA); textVpravo(ctx, st.hi, 208, 12, ORANZ);
  textStred(ctx, 'STAGE' + String(st.stage).padStart(3, ' '), 32);
  const dva = st.hracu === 2;
  text(ctx, 'I-PLAYER', 24, 52, CERVENA); textVpravo(ctx, st.skore[0], 88, 64, ORANZ);
  if (dva) { text(ctx, 'II-PLAYER', 160, 52, CERVENA); textVpravo(ctx, st.skore[1], 232, 64, ORANZ); }
  const body = [100, 200, 300, 400];
  for (let r = 0; r < 4; r++) {
    if (r > st.radek) break;
    const y = 84 + r * 22;
    ctx.drawImage(sprTanku('E' + r, 'stribrna', 0, 0), 120, y - 4);
    const n = i => r < st.radek ? st.zabito[i][r] : Math.min(st.pocet, st.zabito[i][r]);
    textVpravo(ctx, n(0) * body[r], 56, y); text(ctx, 'PTS', 64, y);
    textVpravo(ctx, n(0), 104, y); text(ctx, '<', 108, y);
    if (dva) {
      text(ctx, '>', 140, y); textVpravo(ctx, n(1), 168, y);
      textVpravo(ctx, n(1) * body[r], 208, y); text(ctx, 'PTS', 212, y);
    }
  }
  if (st.radek >= 4) {
    ctx.fillStyle = BILA; ctx.fillRect(96, 172, 64, 2);
    text(ctx, 'TOTAL', 24, 180);
    textVpravo(ctx, st.zabito[0].reduce((a, b) => a + b), 104, 180);
    if (dva) textVpravo(ctx, st.zabito[1].reduce((a, b) => a + b), 168, 180);
    if (st.bonus >= 0) {
      text(ctx, 'BONUS', st.bonus === 0 ? 24 : 160, 200, CERVENA);
      text(ctx, '1000 PTS', st.bonus === 0 ? 24 : 160, 210, BILA);
    }
  }
}

function konec(ctx, st) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const y = Math.max(56, 224 - st.t * 3);
  velkyText(ctx, 'GAME', (W - velkyTextSirka('GAME')) >> 1, y);
  velkyText(ctx, 'OVER', (W - velkyTextSirka('OVER')) >> 1, y + 36);
  if (st.novyRekord && (st.t >> 4) & 1) textStred(ctx, 'NEW HI-SCORE ' + st.hi, 152, ORANZ);
}

/* Editor (Construction): mapa z řetězců, kurzor = blikající tank. */
function editor(ctx, st) {
  ctx.fillStyle = SEDA; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(OX, OY, 208, 208);
  obnovTeren(st.m, st.verze, (st.t >> 5) & 1);
  ctx.drawImage(vrstvy.teren, OX, OY);
  ctx.drawImage(OREL, OX + K.ORL.x, OY + K.ORL.y);
  ctx.drawImage(vrstvy.les, OX, OY);
  if ((st.t >> 3) & 1) ctx.drawImage(sprTanku('P0', 'zluta', 0, 0), OX + st.x * 16, OY + st.y * 16);
  // vybraná dlaždice v panelu
  text(ctx, 'TILE', 224, 24, '#000');
  ctx.fillStyle = '#000'; ctx.fillRect(230, 36, 20, 20);
  if (st.nahled) ctx.drawImage(st.nahled, 232, 38);
}
/* Náhled dlaždice 16×16 pro editor (znak mapy → obrázek). */
const nahledy = new Map();
function nahledDlazdice(ch) {
  if (nahledy.has(ch)) return nahledy.get(ch);
  const rows = Array(13).fill('.............');
  rows[2] = '..' + ch + '..........';
  const m = T.nactiMapu(rows), c = platno(16, 16), x = c.getContext('2d'), img = x.createImageData(16, 16);
  for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
    const v = m[((32 + py) >> 2) * K.N + ((32 + px) >> 2)];
    const t = v === K.CIHLA ? TEX.cihla : v === K.OCEL ? TEX.ocel : v === K.VODA ? TEX.voda1 : v === K.LED ? TEX.led : v === K.LES ? TEX.les : null;
    if (!t) continue;
    const ti = ((py & 7) * 8 + (px & 7)) * 4, o = (py * 16 + px) * 4;
    for (let k = 0; k < 4; k++) img.data[o + k] = t[ti + k];
  }
  x.putImageData(img, 0, 0);
  nahledy.set(ch, c);
  return c;
}

function nastavHladkost(ctx) { ctx.imageSmoothingEnabled = false; }

T.Gr = { W, H, OX, OY, text, textStred, hra, titul, opona, skore, konec, editor, platno, obnovTeren, vrstvy,
  sprTanku, IKONY, nastavHladkost, nahledDlazdice, TEX };

})(TANK);
