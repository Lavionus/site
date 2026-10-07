/* Tank 1990 – pravidla jednoho kola. Žádný DOM: běží i v node (_test/tank1990_test.js).
   Pole 208×208 px (13×13 dlaždic po 16 px), terén v mřížce 52×52 buněk po 4 px –
   po čtvrtinách cihly se rozstřeluje jako v originále. Jeden krok = jeden snímek (60 Hz).
   Směry: 0 nahoru, 1 vpravo, 2 dolů, 3 vlevo. */
var TANK = globalThis.TANK || (globalThis.TANK = {});
(function (T) {
'use strict';

const POLE = 208, N = 52;
const PRAZDNO = 0, CIHLA = 1, OCEL = 2, VODA = 3, LES = 4, LED = 5;
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const ZROD_NEP = [96, 192, 0];          // x; y = 0
const ZROD_HR = [64, 128];              // x; y = 192
const ORL = { x: 96, y: 192 };          // orel 16×16
const NOSITELE = [4, 11, 18];           // pořadí nepřátel nesoucích bonus

T.K = { POLE, N, PRAZDNO, CIHLA, OCEL, VODA, LES, LED, DX, DY, ORL };

// obyčejný, rychlý, palebný (rychlé střely), obrněný (4 zásahy)
T.NEPRATELE = [
  { rychl: 0.5,  strela: 3, hp: 1, body: 100, strelba: 1 / 48 },
  { rychl: 1.25, strela: 3, hp: 1, body: 200, strelba: 1 / 48 },
  { rychl: 0.75, strela: 5, hp: 1, body: 300, strelba: 1 / 28 },
  { rychl: 0.5,  strela: 3, hp: 4, body: 400, strelba: 1 / 36 },
];
T.BONUSY = ['helma', 'hodiny', 'lopata', 'hvezda', 'granat', 'tank', 'lod', 'pistole'];
const VAHY_B = [3, 3, 3, 3, 3, 2, 2, 1];
const RYCHL_HRACE = 0.75;

/* ---------- mapa ---------- */
const DLAZBA = {
  '.': [PRAZDNO, 'F'], '#': [CIHLA, 'F'], '>': [CIHLA, 'R'], '<': [CIHLA, 'L'], 'v': [CIHLA, 'D'], '^': [CIHLA, 'U'],
  '@': [OCEL, 'F'], ')': [OCEL, 'R'], '(': [OCEL, 'L'], '_': [OCEL, 'D'], '=': [OCEL, 'U'],
  '~': [VODA, 'F'], '%': [LES, 'F'], ':': [LED, 'F'],
};
function vCasti(c, x, y) {
  return c === 'F' || (c === 'R' && x >= 2) || (c === 'L' && x < 2) || (c === 'D' && y >= 2) || (c === 'U' && y < 2);
}
T.nactiMapu = function (radky) {
  const r = T.vycistiMapu(radky), m = new Uint8Array(N * N);
  for (let ty = 0; ty < 13; ty++) for (let tx = 0; tx < 13; tx++) {
    const d = DLAZBA[r[ty][tx]] || DLAZBA['.'];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++)
      if (vCasti(d[1], x, y)) m[(ty * 4 + y) * N + tx * 4 + x] = d[0];
  }
  return m;
};

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* Hradba orla: obrácené U, 8 px silné, kolem dlaždice orla. */
function zakladna(G, typ) {
  for (let cy = 46; cy < 52; cy++) for (let cx = 22; cx < 30; cx++) {
    if (cx >= 24 && cx < 28 && cy >= 48) continue;
    // buňku pod tankem nezazdíme (jinak by v ní uvízl)
    const px = cx * 4, py = cy * 4;
    if (G.tanky.some(t => t.ziv && px + 4 > t.x && px < t.x + 16 && py + 4 > t.y && py < t.y + 16)) continue;
    G.m[cy * N + cx] = typ;
  }
  G.verzeTerenu++;
}

function frontaNepratel(stage, rnd) {
  const s = T.SLOZENI[(stage - 1) % T.SLOZENI.length], f = [];
  s.forEach((n, typ) => { for (let i = 0; i < n; i++) f.push(typ); });
  // typy jdou zhruba po sobě, jen trochu promíchané (sousední prohození)
  for (let k = 0; k < 3; k++) for (let i = 0; i + 1 < f.length; i++)
    if (rnd() < 0.3) { const x = f[i]; f[i] = f[i + 1]; f[i + 1] = x; }
  return f;
}

/* ---------- nové kolo ----------
   sezeni = { hracu, hraci: [{ zivoty, skore, uroven, lod, stromy }, …] } – trvá přes kola. */
T.novyStage = function (o) {
  const S = o.sezeni, rnd = mulberry(o.seed || 1);
  const G = {
    stage: o.stage, S, rnd, m: T.nactiMapu(o.mapa), cas: 0,
    tanky: [], strely: [], vybuchy: [], zjeveni: [], popisky: [], zvuky: [], bonus: null,
    fronta: frontaNepratel(o.stage, rnd), spawnT: 0, spawnIdx: 0, poradi: 0,
    zmrazNep: 0, zmrazHr: 0, lopataT: 0, orelZnicen: false,
    konec: null, vyhraT: 0, gameOverT: -1, respawnT: [0, 0],
    zabito: [[0, 0, 0, 0], [0, 0, 0, 0]], verzeTerenu: 1,
    maxNep: S.hracu === 2 ? 6 : 4,
    interval: Math.max(40, 190 - o.stage * 4 - (S.hracu - 1) * 20),
  };
  zakladna(G, CIHLA);
  for (let i = 0; i < S.hracu; i++) if (S.hraci[i].zivoty > 0) G.tanky.push(novyHrac(G, i, false));
  return G;
};

function novyTank(o) {
  return Object.assign({ x: 0, y: 0, smer: 0, acc: 0, anim: 0, stit: 0, zmraz: 0, strely: [],
    ziv: true, kluz: 0, jede: false, prodleva: 0, aiT: 0, zasek: 0, lod: false, sila: 0, rychlaStrela: false }, o);
}
function novyHrac(G, i, sHvezdou) {
  return novyTank({ hrac: i, h: G.S.hraci[i], typ: -1, x: ZROD_HR[i], y: 192, smer: 0, stit: sHvezdou ? 180 : 180 });
}

/* ---------- pohyb ---------- */
function lodTanku(t) { return t.hrac >= 0 ? t.h.lod : t.lod; }

function terenBlokuje(G, x, y, lod) {
  if (x < 0 || y < 0 || x > POLE - 16 || y > POLE - 16) return true;
  const x0 = x >> 2, x1 = (x + 15) >> 2, y0 = y >> 2, y1 = (y + 15) >> 2;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const v = G.m[cy * N + cx];
    if (v === CIHLA || v === OCEL || (v === VODA && !lod)) return true;
  }
  return x < ORL.x + 16 && x + 16 > ORL.x && y + 16 > ORL.y;
}
T.terenBlokuje = terenBlokuje;

function prekryv(ax, ay, bx, by) { return ax < bx + 16 && ax + 16 > bx && ay < by + 16 && ay + 16 > by; }

function krokTanku(G, t, smer) {
  const nx = t.x + DX[smer], ny = t.y + DY[smer];
  if (terenBlokuje(G, nx, ny, lodTanku(t))) return false;
  // do jiného tanku nevjede; kdo se už překrývá (třeba po zrodu), smí se rozjet
  for (const o of G.tanky)
    if (o !== t && o.ziv && prekryv(nx, ny, o.x, o.y) && !prekryv(t.x, t.y, o.x, o.y)) return false;
  for (const z of G.zjeveni)
    if (prekryv(nx, ny, z.x, z.y) && !prekryv(t.x, t.y, z.x, z.y)) return false;
  t.x = nx; t.y = ny;
  return true;
}

/* Otočení kolmo zarovná tank na mřížku 8 px – jinak by se do uliček netrefil. */
function otoc(G, t, smer) {
  if (smer === t.smer) return;
  if ((smer & 1) !== (t.smer & 1)) {
    if (smer & 1) { const sy = Math.round(t.y / 8) * 8; if (!terenBlokuje(G, t.x, sy, lodTanku(t))) t.y = sy; }
    else { const sx = Math.round(t.x / 8) * 8; if (!terenBlokuje(G, sx, t.y, lodTanku(t))) t.x = sx; }
    t.acc = 0;
  }
  t.smer = smer;
}

/* 1 = popojel, 0 = v tomto snímku na krok nedošlo, -1 = narazil */
function jed(G, t, smer, rychl) {
  otoc(G, t, smer);
  t.acc += rychl;
  let pohyb = 0;
  while (t.acc >= 1) {
    t.acc -= 1;
    if (krokTanku(G, t, smer)) { pohyb = 1; t.anim++; }
    else { t.acc = 0; return -1; }
  }
  return pohyb;
}

function naLedu(G, t) { return G.m[((t.y + 8) >> 2) * N + ((t.x + 8) >> 2)] === LED; }

/* ---------- střelba ---------- */
function vystrel(G, t) {
  let max = 1, rychl, sila, stromy = false;
  if (t.hrac >= 0) {
    const h = t.h;
    max = h.uroven >= 2 ? 2 : 1;
    rychl = h.uroven >= 1 ? 5 : 3; sila = h.uroven >= 3 ? 1 : 0; stromy = h.stromy;
  } else {
    rychl = (T.NEPRATELE[t.typ].strela === 5 || t.rychlaStrela) ? 5 : 3; sila = t.sila;
  }
  if (t.strely.length >= max) return false;
  const s = { x: t.x + 8 + DX[t.smer] * 6, y: t.y + 8 + DY[t.smer] * 6, smer: t.smer, rychl, sila, stromy,
    hrac: t.hrac, vlastnik: t, ziv: true };
  t.strely.push(s); G.strely.push(s);
  if (t.hrac >= 0) G.zvuky.push('strela');
  return true;
}

function vybuch(G, x, y, velky) { G.vybuchy.push({ x, y, velky, t: 0 }); }

function konecStrely(G, s) { s.ziv = false; vybuch(G, s.x, s.y, false); }

/* Zásah terénu: pás 16 px napříč letu, hloubka 4 px (silná střela 8 px). */
function nicTeren(G, s) {
  const vert = (s.smer & 1) === 0;
  let a0, a1, f;
  if (vert) { a0 = (s.x - 8) >> 2; a1 = (s.x + 7) >> 2; f = s.smer === 0 ? (s.y - 2) >> 2 : (s.y + 1) >> 2; }
  else { a0 = (s.y - 8) >> 2; a1 = (s.y + 7) >> 2; f = s.smer === 3 ? (s.x - 2) >> 2 : (s.x + 1) >> 2; }
  const krok = (s.smer === 0 || s.smer === 3) ? -1 : 1;
  let cihla = false, ocel = false;
  for (let k = 0; k < (s.sila ? 2 : 1); k++) {
    const r = f + k * krok;
    if (r < 0 || r >= N) continue;
    for (let a = Math.max(0, a0); a <= Math.min(N - 1, a1); a++) {
      const i = vert ? r * N + a : a * N + r, v = G.m[i];
      if (v === CIHLA || (v === LES && s.stromy)) { G.m[i] = PRAZDNO; cihla = true; }
      else if (v === OCEL) { if (s.sila) { G.m[i] = PRAZDNO; cihla = true; } else ocel = true; }
    }
  }
  G.verzeTerenu++;
  if (s.hrac >= 0) G.zvuky.push(cihla ? 'cihla' : ocel ? 'ocel' : 'stena');
}

function strelaKrok(G, s) {
  s.x += DX[s.smer]; s.y += DY[s.smer];
  const x0 = s.x - 2, y0 = s.y - 2, x1 = s.x + 1, y1 = s.y + 1;
  if (x0 < 0 || y0 < 0 || x1 >= POLE || y1 >= POLE) {
    konecStrely(G, s); if (s.hrac >= 0) G.zvuky.push('stena'); return;
  }
  for (let cy = y0 >> 2; cy <= y1 >> 2; cy++) for (let cx = x0 >> 2; cx <= x1 >> 2; cx++) {
    const v = G.m[cy * N + cx];
    if (v === CIHLA || v === OCEL || (v === LES && s.stromy)) { nicTeren(G, s); konecStrely(G, s); return; }
  }
  if (!G.orelZnicen && x1 >= ORL.x && x0 < ORL.x + 16 && y1 >= ORL.y) {
    konecStrely(G, s); G.orelZnicil = s.hrac; znicOrla(G); return;
  }
  for (const t of G.tanky) {
    if (!t.ziv || t === s.vlastnik) continue;
    if (x1 < t.x || x0 > t.x + 15 || y1 < t.y || y0 > t.y + 15) continue;
    const odHrace = s.hrac >= 0, doHrace = t.hrac >= 0;
    if (!odHrace && !doHrace) continue;              // nepřátelé se navzájem nestřílejí
    s.ziv = false;
    if (odHrace && !doHrace) zasahNepritele(G, t, s.hrac);
    else if (!odHrace) zasahHrace(G, t);
    else if (t.stit <= 0) { t.zmraz = 180; G.zvuky.push('pancir'); }   // spoluhráč: jen ho omráčí
    return;
  }
  for (const o of G.strely) {
    if (o === s || !o.ziv || o.hrac === s.hrac || (o.hrac < 0 && s.hrac < 0)) continue;
    if (Math.abs(o.x - s.x) < 4 && Math.abs(o.y - s.y) < 4) { o.ziv = false; s.ziv = false; return; }
  }
}

function znicOrla(G) {
  G.orelZnicen = true;
  vybuch(G, ORL.x + 8, ORL.y + 8, true);
  G.zvuky.push('orel');
}

function pridejBody(G, i, n) {
  const h = G.S.hraci[i], pred = Math.floor(h.skore / 20000);
  h.skore += n;
  if (Math.floor(h.skore / 20000) > pred) { h.zivoty++; G.zvuky.push('zivot'); }
}

function zasahNepritele(G, e, hr) {
  if (e.stit > 0) { G.zvuky.push('ocel'); return; }
  if (e.nositel) { e.nositel = false; novyBonus(G); }
  e.hp--;
  if (e.hp > 0) { G.zvuky.push('pancir'); return; }
  e.ziv = false;
  vybuch(G, e.x + 8, e.y + 8, true);
  G.zvuky.push('vybuch');
  const b = T.NEPRATELE[e.typ].body;
  pridejBody(G, hr, b);
  G.zabito[hr][e.typ]++;
  G.popisky.push({ x: e.x + 8, y: e.y + 8, text: String(b), t: -24 });
}

function zasahHrace(G, p) {
  if (!p.ziv || p.stit > 0) return;
  const h = p.h;
  if (h.lod) { h.lod = false; p.stit = 60; G.zvuky.push('lodZtracena'); return; }   // loď vydrží jeden zásah
  p.ziv = false;
  vybuch(G, p.x + 8, p.y + 8, true);
  G.zvuky.push('vybuchHrac');
  h.zivoty--; h.uroven = 0; h.stromy = false;
  if (h.zivoty > 0) G.respawnT[p.hrac] = 70;
}

/* ---------- bonusy ---------- */
function novyBonus(G) {
  let typ = 0, r = G.rnd() * VAHY_B.reduce((a, b) => a + b, 0);
  while (r >= VAHY_B[typ]) { r -= VAHY_B[typ]; typ++; }
  let x = 0, y = 0;
  for (let k = 0; k < 40; k++) {
    x = Math.floor(G.rnd() * 25) * 8; y = Math.floor(G.rnd() * 24) * 8;
    if (!prekryv(x, y, ORL.x - 8, ORL.y - 8)) break;
  }
  G.bonus = { x, y, typ: T.BONUSY[typ], t: 0 };
  G.zvuky.push('bonusObjeven');
}
T.novyBonus = novyBonus;

function seberBonus(G, t) {
  const b = G.bonus.typ;
  G.bonus = null;
  if (t.hrac >= 0) {
    const h = t.h;
    pridejBody(G, t.hrac, 500);
    G.popisky.push({ x: t.x + 8, y: t.y + 8, text: '500', t: 0 });
    G.zvuky.push('bonus');
    if (b === 'helma') t.stit = 600;
    else if (b === 'hodiny') G.zmrazNep = 600;
    else if (b === 'lopata') { G.lopataT = 1200; zakladna(G, OCEL); }
    else if (b === 'hvezda') h.uroven = Math.min(3, h.uroven + 1);
    else if (b === 'granat') {
      for (const e of G.tanky) if (e.ziv && e.hrac < 0) { e.ziv = false; vybuch(G, e.x + 8, e.y + 8, true); }
      G.zvuky.push('vybuch');
    }
    else if (b === 'tank') { h.zivoty++; G.zvuky.push('zivot'); }
    else if (b === 'lod') h.lod = true;
    else if (b === 'pistole') { h.uroven = 3; h.stromy = true; }
    return;
  }
  // Tank 1990: bonus umí sebrat i nepřítel – a pak působí proti hráčům
  G.zvuky.push('bonusNepritel');
  const nep = G.tanky.filter(e => e.ziv && e.hrac < 0);
  if (b === 'helma') nep.forEach(e => { e.stit = 600; });
  else if (b === 'hodiny') G.zmrazHr = 300;
  else if (b === 'lopata') { G.lopataT = 0; zakladna(G, PRAZDNO); }
  else if (b === 'hvezda') nep.forEach(e => { e.hp = Math.min(4, e.hp + 1); e.rychlaStrela = true; });
  else if (b === 'granat') G.tanky.filter(p => p.ziv && p.hrac >= 0).forEach(p => zasahHrace(G, p));
  else if (b === 'tank') G.fronta.push(3);
  else if (b === 'lod') nep.forEach(e => { e.lod = true; });
  else if (b === 'pistole') nep.forEach(e => { e.sila = 1; e.rychlaStrela = true; });
}

/* ---------- nepřátelé ---------- */
function volno(G, x, y) {
  return !G.tanky.some(t => t.ziv && prekryv(x, y, t.x, t.y)) && !G.zjeveni.some(z => prekryv(x, y, z.x, z.y));
}

function spawnNepratel(G) {
  if (!G.fronta.length) return;
  const akt = G.tanky.filter(t => t.ziv && t.hrac < 0).length + G.zjeveni.filter(z => z.hrac < 0).length;
  if (akt >= G.maxNep) return;
  if (G.spawnT > 0) { G.spawnT--; return; }
  for (let k = 0; k < 3; k++) {
    const x = ZROD_NEP[(G.spawnIdx + k) % 3];
    if (!volno(G, x, 0)) continue;
    G.poradi++;
    G.zjeveni.push({ x, y: 0, t: 0, hrac: -1, typ: G.fronta.shift(), nositel: NOSITELE.includes(G.poradi) });
    G.spawnIdx = (G.spawnIdx + k + 1) % 3;
    G.spawnT = G.interval;
    return;
  }
}

function blizkyHrac(G, e) {
  let best = null, bd = 1e9;
  for (const t of G.tanky) if (t.ziv && t.hrac >= 0) {
    const d = Math.abs(t.x - e.x) + Math.abs(t.y - e.y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

function novySmer(G, e) {
  const r = G.rnd();
  let smer;
  if (r < 0.6) {                                    // náhodně, s mírným tahem dolů
    const v = G.rnd() * 9;
    smer = v < 2 ? 0 : v < 4.5 ? 1 : v < 6.5 ? 2 : 3;
  } else {
    // čím déle kolo trvá, tím víc míří na orla (zpočátku spíš na hráče)
    const pOrel = Math.min(0.6, 0.1 + G.cas / (60 * 240));
    const hr = blizkyHrac(G, e);
    const cil = (G.rnd() < pOrel || !hr) ? ORL : hr;
    const dx = cil.x - e.x, dy = cil.y - e.y;
    let vodorovne = Math.abs(dx) > Math.abs(dy);
    if (G.rnd() < 0.3) vodorovne = !vodorovne;
    if (vodorovne && dx !== 0) smer = dx > 0 ? 1 : 3;
    else if (dy !== 0) smer = dy > 0 ? 2 : 0;
    else smer = dx > 0 ? 1 : 3;
  }
  otoc(G, e, smer);
}

function nepritel(G, e) {
  if (G.zmrazNep > 0) return;
  const typ = T.NEPRATELE[e.typ];
  if (--e.aiT <= 0) { e.aiT = 32 + Math.floor(G.rnd() * 96); novySmer(G, e); }
  const r = jed(G, e, e.smer, typ.rychl);
  if (r === -1) {
    // narazil: buď si cestu prostřílí, nebo to zkusí jinudy
    if (e.zasek === 0) { if (G.rnd() < 0.5) novySmer(G, e); else vystrel(G, e); }
    if (++e.zasek > 24) { novySmer(G, e); e.zasek = 1; }
  } else if (r === 1) e.zasek = 0;
  if (G.rnd() < typ.strelba) vystrel(G, e);
}

/* ---------- hráč ---------- */
const NIC = { smer: -1, strel: false, stisk: false };
function hrac(G, p, v) {
  if (G.gameOverT >= 0) { p.jede = false; return; }
  if (p.prodleva > 0) p.prodleva--;
  if (p.zmraz > 0) { p.zmraz--; p.jede = false; return; }
  if (G.zmrazHr > 0) { p.jede = false; return; }
  if (v.smer >= 0) {
    jed(G, p, v.smer, RYCHL_HRACE);
    p.jede = true;
    p.kluz = naLedu(G, p) ? 32 : 0;
  } else if (p.kluz > 0) {                        // na ledu ještě dojede
    p.kluz--;
    if (jed(G, p, p.smer, RYCHL_HRACE) === -1 || !naLedu(G, p)) p.kluz = 0;
    p.jede = true;
  } else p.jede = false;
  if (v.stisk || (v.strel && p.strely.length === 0 && p.prodleva <= 0)) {
    if (vystrel(G, p)) p.prodleva = 10;
  }
}

/* ---------- krok ---------- */
T.krok = function (G, vstupy) {
  G.cas++;
  if (G.zmrazNep > 0) G.zmrazNep--;
  if (G.zmrazHr > 0) G.zmrazHr--;
  if (G.lopataT > 0) {
    G.lopataT--;
    if (G.lopataT === 0) zakladna(G, CIHLA);
    else if (G.lopataT < 180 && G.lopataT % 15 === 0) zakladna(G, (G.lopataT / 15) & 1 ? CIHLA : OCEL);
  }

  spawnNepratel(G);
  for (const z of G.zjeveni) {
    if (++z.t < 60) continue;
    z.hotovo = true;
    if (z.hrac >= 0) { G.tanky.push(novyHrac(G, z.hrac, true)); continue; }
    const typ = T.NEPRATELE[z.typ];
    G.tanky.push(novyTank({ hrac: -1, typ: z.typ, x: z.x, y: z.y, smer: 2, hp: typ.hp, nositel: z.nositel,
      aiT: 16 + Math.floor(G.rnd() * 48) }));
  }
  G.zjeveni = G.zjeveni.filter(z => !z.hotovo);

  for (const t of G.tanky) {
    if (!t.ziv) continue;
    if (t.stit > 0) t.stit--;
    if (t.hrac >= 0) hrac(G, t, (vstupy && vstupy[t.hrac]) || NIC);
    else nepritel(G, t);
  }

  for (const s of G.strely) for (let i = 0; i < s.rychl && s.ziv; i++) strelaKrok(G, s);

  if (G.bonus) {
    if (++G.bonus.t > 60 * 30) G.bonus = null;
    else for (const t of G.tanky)
      if (t.ziv && prekryv(t.x, t.y, G.bonus.x, G.bonus.y)) { seberBonus(G, t); break; }
  }

  for (let i = 0; i < 2; i++) if (G.respawnT[i] > 0 && --G.respawnT[i] === 0)
    G.zjeveni.push({ x: ZROD_HR[i], y: 192, t: 0, hrac: i });

  for (const v of G.vybuchy) v.t++;
  G.vybuchy = G.vybuchy.filter(v => v.t < (v.velky ? 30 : 12));
  for (const p of G.popisky) p.t++;
  G.popisky = G.popisky.filter(p => p.t < 50);
  G.tanky = G.tanky.filter(t => t.ziv);
  G.strely = G.strely.filter(s => s.ziv);
  for (const t of G.tanky) if (t.strely.length) t.strely = t.strely.filter(s => s.ziv);

  // konec kola
  const hraciVen = G.S.hraci.slice(0, G.S.hracu).every(h => h.zivoty <= 0);
  if (G.gameOverT < 0 && (G.orelZnicen || hraciVen)) { G.gameOverT = 0; G.zvuky.push('gameOver'); }
  if (G.gameOverT >= 0) { if (++G.gameOverT >= 300) G.konec = 'prohra'; return; }
  if (!G.fronta.length && !G.zjeveni.some(z => z.hrac < 0) && !G.tanky.some(t => t.hrac < 0)) {
    if (++G.vyhraT >= 180) G.konec = 'vyhra';
  }
};

})(TANK);
