/* Bomberman – herní logika bez DOM (jmenný prostor BOMB).
   Souřadnice postav jsou v políčkách, střed políčka = celé číslo.
   Simulace běží s pevným krokem DT, ať je deterministická (testy, boti). */
var BOMB = globalThis.BOMB || (globalThis.BOMB = {});
(function (B) {
'use strict';

const DT = 1 / 60;
const W = 15, H = 13;
const ZAPALNIK = 2.5;          // s do výbuchu
const PLAMEN_CAS = 0.55;       // jak dlouho plamen hoří (a zabíjí)
const RYCHLOST = 3.2, RYCHLOST_KROK = 0.5, RYCHLOST_MAX = 4;   // políček/s, max. počet bruslí
const KOP_RYCHLOST = 8;
const MAX_BOMB = 8, MAX_PLAMEN = 8;
const VOLNO = 0, ZED = 1, BEDNA = 2, HORI = 3;
const SMERY = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // 0 nahoru, 1 vpravo, 2 dolů, 3 vlevo

/* ---------- náhoda se semínkem (mulberry32) ---------- */
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function zamichej(pole, r) {
  for (let i = pole.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pole[i], pole[j]] = [pole[j], pole[i]]; }
  return pole;
}

/* ---------- typy nepřátel (kampaň) ----------
   otoceni = pravděpodobnost, že na křižovatce zahne; zpet = smí se otočit o 180°;
   pruchozi = prochází bednami; honi = dosah, na který jde po hráči (BFS). */
const NEPRATELE = {
  balon:  { nazev: 'Balónek', rychlost: 1.5, otoceni: 0.15, zpet: false, pruchozi: false, honi: 0, body: 100 },
  cibule: { nazev: 'Cibulka', rychlost: 2.3, otoceni: 0.45, zpet: false, pruchozi: false, honi: 0, body: 200 },
  kapka:  { nazev: 'Kapka',   rychlost: 2.9, otoceni: 0.6,  zpet: true,  pruchozi: false, honi: 0, body: 400 },
  duch:   { nazev: 'Duch',    rychlost: 1.3, otoceni: 0.35, zpet: true,  pruchozi: true,  honi: 0, body: 800 },
  mince:  { nazev: 'Mince',   rychlost: 2.5, otoceni: 0.3,  zpet: false, pruchozi: false, honi: 6, body: 1000 },
};

/* Kampaň: 8 úrovní. Pod jednou bednou jsou dveře, pod jinou jeden předmět
   (jako v originále). Předměty si hráč nese dál. */
const UROVNE = [
  { nepratele: { balon: 3 }, bedny: 0.30, predmet: 'plamen', limit: 200 },
  { nepratele: { balon: 3, cibule: 1 }, bedny: 0.36, predmet: 'bomba', limit: 200 },
  { nepratele: { balon: 2, cibule: 3 }, bedny: 0.40, predmet: 'plamen', limit: 200 },
  { nepratele: { cibule: 2, kapka: 2 }, bedny: 0.42, predmet: 'rychlost', limit: 200 },
  { nepratele: { balon: 2, kapka: 2, duch: 1 }, bedny: 0.44, predmet: 'bomba', limit: 220 },
  { nepratele: { cibule: 2, duch: 2, mince: 1 }, bedny: 0.44, predmet: 'kopani', limit: 220 },
  { nepratele: { kapka: 3, duch: 2, mince: 1 }, bedny: 0.46, predmet: 'dalkova', limit: 240 },
  { nepratele: { kapka: 1, duch: 3, mince: 3 }, bedny: 0.46, predmet: 'plamen', limit: 240 },
];
const MAX_NEPRATEL = 12;

const BARVY = ['bila', 'cerna', 'cervena', 'modra'];
const ROHY = [[1, 1], [W - 2, H - 2], [W - 2, 1], [1, H - 2]];

/* ---------- mapa ---------- */
function arena(r, hustota, starty) {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0)) m[y * W + x] = ZED;
  const chranene = new Set();
  for (const [sx, sy] of starty) {
    chranene.add(sy * W + sx);
    for (const [dx, dy] of SMERY) {
      const x = sx + dx, y = sy + dy;
      if (m[y * W + x] === VOLNO) chranene.add(y * W + x);
    }
  }
  for (let i = 0; i < W * H; i++) if (m[i] === VOLNO && !chranene.has(i) && r() < hustota) m[i] = BEDNA;
  return m;
}

function novyStav(m, r, rezim) {
  return {
    rezim, w: W, h: H, m, rng: r,
    skryte: Object.create(null),     // index → předmět pod bednou
    predmety: Object.create(null),   // index → odkrytý předmět ('dvere' = východ)
    plamenCas: new Float32Array(W * H), plamenTvar: new Uint8Array(W * H), plamenVlastnik: new Int8Array(W * H).fill(-1), plamenPuvodce: new Int8Array(W * H).fill(-1),
    bomby: [], hraci: [], nepratele: [], udalosti: [],
    cas: 0, tik: 0, dalsiId: 1, vysledek: null, konecOdpocet: -1,
    nahla: null, skore: 0, dvere: -1, casLimit: 0, casVyprsel: false,
  };
}

function novyHrac(id, x, y, volby) {
  return Object.assign({
    id, x, y, smer: 2, ziv: true, smrtCas: 0, pricina: null,
    maxBomb: 1, plamen: 2, rychlostLvl: 0, kopani: false, dalkova: false,
    bot: false, obtiznost: 'stredni', barva: BARVY[id % 4],
    vstup: { smer: -1, bomba: false, rozbuska: false, krokMax: Infinity },
    predBomba: false, predRozbuska: false, krokAnim: 0, pohyb: false, ai: null,
  }, volby || {});
}

/* Souboj: volby.hraci = [{bot, obtiznost}], volby.seed, volby.limit (s do náhlé smrti), volby.dalkova */
function novySouboj(volby) {
  const r = rng(volby.seed || 1);
  const pocet = volby.hraci.length;
  const starty = ROHY.slice(0, pocet);
  const m = arena(r, volby.hustota == null ? 0.72 : volby.hustota, starty);
  const S = novyStav(m, r, 'souboj');
  volby.hraci.forEach((hv, i) => {
    S.hraci.push(novyHrac(i, starty[i][0], starty[i][1], { bot: !!hv.bot, obtiznost: hv.obtiznost || 'stredni', barva: hv.barva || BARVY[i] }));
  });
  // předměty pod bednami
  const bedny = [];
  for (let i = 0; i < W * H; i++) if (m[i] === BEDNA) bedny.push(i);
  zamichej(bedny, r);
  const sada = [];
  const pridej = (typ, n) => { for (let k = 0; k < n; k++) sada.push(typ); };
  pridej('bomba', 7); pridej('plamen', 7); pridej('rychlost', 4); pridej('kopani', 3);
  if (volby.dalkova !== false) pridej('dalkova', 2);
  sada.forEach((typ, k) => { if (k < bedny.length) S.skryte[bedny[k]] = typ; });
  // náhlá smrt: po limitu se aréna spirálovitě zaplňuje zdmi
  S.nahla = { start: volby.limit || 120, interval: 0.14, poradi: spirala(m), k: 0, dalsi: 0 };
  S.casLimit = S.nahla.start;
  return S;
}

function spirala(m) {
  const out = [];
  let x0 = 1, y0 = 1, x1 = W - 2, y1 = H - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push(y0 * W + x);
    for (let y = y0 + 1; y <= y1; y++) out.push(y * W + x1);
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push(y1 * W + x);
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push(y * W + x0);
    x0++; y0++; x1--; y1--;
  }
  return out.filter(i => m[i] !== ZED);
}

/* Kampaň: úroveň n (0..), hrac = předchozí stav hráče (nese předměty), volby.bot pro testy */
function novaUroven(n, hrac, volby) {
  volby = volby || {};
  const U = UROVNE[n];
  const r = rng(volby.seed || (1000 + n * 7919));
  const m = arena(r, U.bedny, [[1, 1], [1, 2], [2, 1]]);
  const S = novyStav(m, r, 'kampan');
  S.uroven = n;
  S.casLimit = U.limit;
  const h = novyHrac(0, 1, 1, { plamen: 1, bot: !!volby.bot, obtiznost: volby.obtiznost || 'tezka' });
  if (hrac) for (const k of ['maxBomb', 'plamen', 'rychlostLvl', 'kopani', 'dalkova']) h[k] = hrac[k];
  S.hraci.push(h);
  // bedny daleko od startu → dveře; jinde předmět
  let bedny = [];
  for (let i = 0; i < W * H; i++) if (m[i] === BEDNA) bedny.push(i);
  if (bedny.length < 4) {   // pojistka, při rozumné hustotě nenastane
    for (let i = 0; i < W * H && bedny.length < 4; i++) if (m[i] === VOLNO && (i % W) + Math.floor(i / W) > 6) { m[i] = BEDNA; bedny.push(i); }
  }
  zamichej(bedny, r);
  const daleko = bedny.filter(i => (i % W) + Math.floor(i / W) >= 8);
  S.dvere = (daleko.length ? daleko : bedny)[0];
  S.skryte[S.dvere] = 'dvere';
  const pro = bedny.find(i => i !== S.dvere);
  S.skryte[pro] = U.predmet;
  // nepřátelé na volných polích daleko od startu
  const volna = [];
  for (let i = 0; i < W * H; i++) if (m[i] === VOLNO && (i % W) + Math.floor(i / W) >= 8) volna.push(i);
  zamichej(volna, r);
  let k = 0;
  for (const typ in U.nepratele) for (let j = 0; j < U.nepratele[typ]; j++) {
    const i = volna[k++ % volna.length];
    S.nepratele.push(novyNepritel(S, typ, i % W, Math.floor(i / W)));
  }
  // rozložení úrovně je pevné, chování nepřátel se při každém hraní liší
  if (volby.nahoda) S.rng = rng(volby.nahoda);
  return S;
}

function novyNepritel(S, typ, x, y) {
  const n = { id: S.dalsiId++, typ, x, y, tx: x, ty: y, smer: Math.floor(S.rng() * 4), ziv: true, smrtCas: 0, anim: S.rng() * 10 };
  return n;
}

/* ---------- pomocné ---------- */
const idx = (x, y) => y * W + x;
function bombaNa(S, x, y) {
  for (const b of S.bomby) if (Math.round(b.x) === x && Math.round(b.y) === y) return b;
  return null;
}
function vMape(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
function rychlost(h) { return RYCHLOST + RYCHLOST_KROK * h.rychlostLvl; }
function aktivniBomby(S, h) { let n = 0; for (const b of S.bomby) if (b.majitel === h.id) n++; return n; }

/* Může hráč vstoupit do políčka? Z bomby, na které stojí, smí odejít. */
function pruchoziHrac(S, x, y, h) {
  if (!vMape(x, y) || S.m[idx(x, y)] !== VOLNO) return false;
  const b = bombaNa(S, x, y);
  return !b || (Math.round(h.x) === x && Math.round(h.y) === y);
}
function volnoProBombu(S, x, y) {
  if (!vMape(x, y) || S.m[idx(x, y)] !== VOLNO || bombaNa(S, x, y)) return false;
  for (const h of S.hraci) if (h.ziv && Math.round(h.x) === x && Math.round(h.y) === y) return false;
  for (const n of S.nepratele) if (n.ziv && Math.round(n.x) === x && Math.round(n.y) === y) return false;
  return true;
}
function pruchoziNepritel(S, x, y, typ) {
  if (!vMape(x, y)) return false;
  const c = S.m[idx(x, y)];
  if (c === ZED || c === HORI) return false;
  if (c === BEDNA && !NEPRATELE[typ].pruchozi) return false;
  return !bombaNa(S, x, y);
}

/* ---------- pohyb hráče s „přichytáváním" do koridorů ----------
   Kdo jde vodorovně, musí být srovnaný na řádek. Když je kousek vedle,
   hra ho dorovná; když je rovně zeď, ale šikmo průchod, sklouzne do něj. */
function pohniHrace(S, h, smer, d) {
  const dx = SMERY[smer][0], dy = SMERY[smer][1];
  const cx = Math.round(h.x), cy = Math.round(h.y);
  const svisle = dx === 0;
  const off = svisle ? h.x - cx : h.y - cy;          // odchylka kolmo na směr
  const pruch = (ax, ay) => pruchoziHrac(S, ax, ay, h);
  if (Math.abs(off) > 1e-6) {
    if (pruch(cx + dx, cy + dy)) {
      const s = Math.min(d, Math.abs(off));
      if (svisle) h.x -= Math.sign(off) * s; else h.y -= Math.sign(off) * s;
      d -= s;
      if (d <= 1e-9) return;
    } else {
      const sg = Math.sign(off);
      const bx = svisle ? cx + sg : cx, by = svisle ? cy : cy + sg;
      if (pruch(bx + dx, by + dy) && pruch(bx, by)) {
        const s = Math.min(d, 1 - Math.abs(off));
        if (svisle) h.x += sg * s; else h.y += sg * s;
      }
      return;
    }
  }
  const tx = cx + dx, ty = cy + dy;
  let nx = h.x + dx * d, ny = h.y + dy * d;
  if (!pruch(tx, ty)) {
    const za = dx * (nx - cx) + dy * (ny - cy);
    if (za > 0) {
      const ted = dx * (h.x - cx) + dy * (h.y - cy);
      if (ted > 0) { nx = h.x; ny = h.y; } else { nx = cx; ny = cy; }
      // kopnutí bomby
      if (h.kopani && ted >= -0.05) {
        const b = bombaNa(S, tx, ty);
        if (b && b.pohyb < 0 && volnoProBombu(S, tx + dx, ty + dy)) {
          b.pohyb = smer; b.x = tx; b.y = ty;
          S.udalosti.push({ typ: 'kop', x: tx, y: ty, hrac: h.id });
        }
      }
    }
  }
  h.x = nx; h.y = ny;
}

function polozBombu(S, h) {
  const cx = Math.round(h.x), cy = Math.round(h.y), i = idx(cx, cy);
  if (!h.ziv || aktivniBomby(S, h) >= h.maxBomb) return false;
  if (S.m[i] !== VOLNO || bombaNa(S, cx, cy) || S.plamenCas[i] > 0) return false;
  if (S.predmety[i] === 'dvere') return false;
  S.bomby.push({ id: S.dalsiId++, x: cx, y: cy, cas: ZAPALNIK, plamen: h.plamen, majitel: h.id, dalkova: h.dalkova, pohyb: -1, vybuchla: false, vek: 0 });
  S.udalosti.push({ typ: 'poloz', x: cx, y: cy });
  return true;
}

function odpalDalkove(S, h) {
  const moje = S.bomby.filter(b => b.majitel === h.id && b.dalkova && !b.vybuchla);
  for (const b of moje) if (!b.vybuchla) odpal(S, b);
  return moje.length > 0;
}

/* ---------- výbuchy ---------- */
function zapal(S, i, tvar, vlastnik, puvodce) {
  S.plamenCas[i] = PLAMEN_CAS;
  S.plamenTvar[i] |= tvar;
  S.plamenVlastnik[i] = vlastnik;
  S.plamenPuvodce[i] = puvodce;
}
const ZPET = [4, 8, 1, 2];     // bit směru zpět: nahoru(1) vpravo(2) dolů(4) vlevo(8)
const VPRED = [1, 2, 4, 8];

/* puvodce = kdo celý řetěz spustil (pro statistiku sebevražd botů) */
function odpal(S, prvni, puvodce) {
  if (puvodce === undefined) puvodce = prvni.majitel;
  const fronta = [prvni];
  prvni.vybuchla = true;
  while (fronta.length) {
    const b = fronta.shift();
    const cx = Math.round(b.x), cy = Math.round(b.y);
    S.udalosti.push({ typ: 'vybuch', x: cx, y: cy, majitel: b.majitel });
    zapal(S, idx(cx, cy), 16, b.majitel, puvodce);
    for (let s = 0; s < 4; s++) {
      const [dx, dy] = SMERY[s];
      let pred = idx(cx, cy);
      for (let k = 1; k <= b.plamen; k++) {
        const x = cx + dx * k, y = cy + dy * k;
        if (!vMape(x, y)) break;
        const i = idx(x, y), c = S.m[i];
        if (c === ZED || c === HORI) break;
        if (c === BEDNA) {
          S.m[i] = HORI; S.plamenCas[i] = PLAMEN_CAS; S.plamenVlastnik[i] = b.majitel; S.plamenPuvodce[i] = puvodce;
          S.udalosti.push({ typ: 'bedna', x, y });
          break;
        }
        S.plamenTvar[pred] |= VPRED[s];
        zapal(S, i, ZPET[s], b.majitel, puvodce);
        pred = i;
        const jina = bombaNa(S, x, y);
        if (jina && !jina.vybuchla) { jina.vybuchla = true; fronta.push(jina); break; }
        const p = S.predmety[i];
        if (p) {
          if (p === 'dvere') {
            // zásah dveří vypustí posily (jako v originále)
            if (S.rezim === 'kampan' && !S.vysledek) posily(S, x, y);
          } else { delete S.predmety[i]; S.udalosti.push({ typ: 'shorel', x, y }); }
          break;
        }
      }
    }
  }
  S.bomby = S.bomby.filter(b => !b.vybuchla);
}

function posily(S, x, y) {
  const U = UROVNE[S.uroven];
  const typy = Object.keys(U.nepratele);
  const typ = typy[typy.length - 1];
  for (let k = 0; k < 3 && S.nepratele.filter(n => n.ziv).length < MAX_NEPRATEL; k++) {
    const n = novyNepritel(S, typ, x, y);
    n.nesmrtelny = 1.0;
    S.nepratele.push(n);
  }
  S.udalosti.push({ typ: 'posily', x, y });
}

/* ---------- nepřátelé ---------- */
function prvniKrokK(S, sx, sy, cile, dosah, typ) {
  // BFS z nepřítele k nejbližšímu cíli, vrací směr prvního kroku
  const N = W * H, prev = new Int16Array(N).fill(-1), dist = new Int16Array(N).fill(-1);
  const start = idx(sx, sy); dist[start] = 0;
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    if (cile.has(c) && c !== start) {
      let k = c; while (prev[k] !== start) k = prev[k];
      const kx = k % W, ky = (k - kx) / W;
      return SMERY.findIndex(([dx, dy]) => sx + dx === kx && sy + dy === ky);
    }
    if (dist[c] >= dosah) continue;
    const x = c % W, y = (c - x) / W;
    for (const [dx, dy] of SMERY) {
      const nx = x + dx, ny = y + dy, n = idx(nx, ny);
      if (dist[n] >= 0 || !pruchoziNepritel(S, nx, ny, typ)) continue;
      dist[n] = dist[c] + 1; prev[n] = c; q.push(n);
    }
  }
  return -1;
}

function zvolSmer(S, n) {
  const T = NEPRATELE[n.typ];
  const x = n.tx, y = n.ty;
  const moznosti = [];
  for (let s = 0; s < 4; s++) if (pruchoziNepritel(S, x + SMERY[s][0], y + SMERY[s][1], n.typ)) moznosti.push(s);
  if (!moznosti.length) return -1;
  if (T.honi) {
    const cile = new Set();
    for (const h of S.hraci) if (h.ziv) cile.add(idx(Math.round(h.x), Math.round(h.y)));
    const s = prvniKrokK(S, x, y, cile, T.honi, n.typ);
    if (s >= 0 && S.rng() < 0.85) return s;
  }
  const zpet = (n.smer + 2) % 4;
  const rovne = moznosti.includes(n.smer);
  if (rovne && S.rng() >= T.otoceni) return n.smer;
  let vyber = moznosti.filter(s => s !== n.smer && (T.zpet || s !== zpet));
  if (!vyber.length) vyber = rovne ? [n.smer] : moznosti;
  return vyber[Math.floor(S.rng() * vyber.length)];
}

function krokNepritele(S, n) {
  const T = NEPRATELE[n.typ];
  let d = T.rychlost * DT;
  n.anim += DT;
  if (n.nesmrtelny > 0) n.nesmrtelny -= DT;
  // cíl se mezitím zablokoval (bomba) → otočit zpět
  const rx = Math.round(n.x), ry = Math.round(n.y);
  if ((n.x !== n.tx || n.y !== n.ty) && !(rx === n.tx && ry === n.ty) && !pruchoziNepritel(S, n.tx, n.ty, n.typ)) {
    n.tx -= SMERY[n.smer][0]; n.ty -= SMERY[n.smer][1]; n.smer = (n.smer + 2) % 4;
  }
  for (let pokus = 0; pokus < 2 && d > 1e-9; pokus++) {
    const vx = n.tx - n.x, vy = n.ty - n.y, vzd = Math.abs(vx) + Math.abs(vy);
    if (vzd > d) { n.x += Math.sign(vx) * d; n.y += Math.sign(vy) * d; return; }
    n.x = n.tx; n.y = n.ty; d -= vzd;
    const s = zvolSmer(S, n);
    if (s < 0) return;
    n.smer = s; n.tx = n.x + SMERY[s][0]; n.ty = n.y + SMERY[s][1];
  }
}

/* ---------- smrt ---------- */
function zabij(S, h, pricina) {
  if (!h.ziv) return;
  h.ziv = false; h.smrtCas = 0; h.pricina = pricina;
  S.udalosti.push({ typ: 'smrt', x: h.x, y: h.y, hrac: h.id });
  // dálkové bomby mrtvého začnou normálně odpočítávat
  for (const b of S.bomby) if (b.majitel === h.id && b.dalkova) { b.dalkova = false; b.cas = Math.min(b.cas, ZAPALNIK); }
}

/* ---------- jeden krok simulace ---------- */
function krok(S) {
  S.cas += DT; S.tik++;
  const hraci = S.hraci;

  for (const h of hraci) {
    if (!h.ziv) { h.smrtCas += DT; continue; }
    const v = h.vstup;
    h.pohyb = false;
    if (v.bomba && !h.predBomba) polozBombu(S, h);
    h.predBomba = v.bomba;
    if (v.smer >= 0) {
      const d = Math.min(rychlost(h) * DT, v.krokMax);
      const px = h.x, py = h.y;
      pohniHrace(S, h, v.smer, d);
      h.smer = v.smer;
      const ujel = Math.abs(h.x - px) + Math.abs(h.y - py);
      if (ujel > 1e-6) { h.pohyb = true; h.krokAnim += ujel; }
    }
    if (v.rozbuska && !h.predRozbuska && h.dalkova) odpalDalkove(S, h);
    h.predRozbuska = v.rozbuska;
    // sebrání předmětu
    const i = idx(Math.round(h.x), Math.round(h.y)), p = S.predmety[i];
    if (p && p !== 'dvere') {
      delete S.predmety[i];
      seber(h, p);
      S.udalosti.push({ typ: 'predmet', x: i % W, y: (i - i % W) / W, predmet: p, hrac: h.id });
      if (S.rezim === 'kampan') S.skore += 50;
    }
  }

  // bomby: klouzání, odpočet
  for (const b of S.bomby) {
    b.vek += DT;
    if (b.pohyb >= 0) {
      const [dx, dy] = SMERY[b.pohyb];
      const cx = Math.round(b.x), cy = Math.round(b.y);
      let nx = b.x + dx * KOP_RYCHLOST * DT, ny = b.y + dy * KOP_RYCHLOST * DT;
      const tx = cx + dx, ty = cy + dy;
      if (dx * (nx - cx) + dy * (ny - cy) >= 0 && !volnoProBombu(S, tx, ty)) { nx = cx; ny = cy; b.pohyb = -1; }
      b.x = nx; b.y = ny;
    }
    const majitel = hraci[b.majitel];
    const drzi = b.dalkova && majitel && majitel.ziv;
    if (!drzi) b.cas -= DT;
  }
  const odpalit = S.bomby.filter(b => b.cas <= 0 || S.plamenCas[idx(Math.round(b.x), Math.round(b.y))] > 0);
  for (const b of odpalit) {
    if (b.vybuchla) continue;
    const i = idx(Math.round(b.x), Math.round(b.y));
    odpal(S, b, b.cas > 0 && S.plamenCas[i] > 0 ? S.plamenPuvodce[i] : b.majitel);
  }

  // plameny dohořívají, bedny mizí a odkrývají předměty
  for (let i = 0; i < W * H; i++) {
    if (S.plamenCas[i] <= 0) continue;
    S.plamenCas[i] -= DT;
    if (S.plamenCas[i] <= 0) {
      S.plamenCas[i] = 0; S.plamenTvar[i] = 0; S.plamenVlastnik[i] = -1; S.plamenPuvodce[i] = -1;
      if (S.m[i] === HORI) {
        S.m[i] = VOLNO;
        if (S.skryte[i]) { S.predmety[i] = S.skryte[i]; delete S.skryte[i]; }
      }
    }
  }

  // nepřátelé
  for (const n of S.nepratele) {
    if (!n.ziv) { n.smrtCas += DT; continue; }
    krokNepritele(S, n);
  }
  S.nepratele = S.nepratele.filter(n => n.ziv || n.smrtCas < 1.2);

  // zásahy plamenem a dotyky
  for (const h of hraci) {
    if (!h.ziv) continue;
    const i = idx(Math.round(h.x), Math.round(h.y));
    if (S.plamenCas[i] > 0) zabij(S, h, { typ: 'plamen', vlastnik: S.plamenVlastnik[i], puvodce: S.plamenPuvodce[i] });
  }
  for (const n of S.nepratele) {
    if (!n.ziv) continue;
    const i = idx(Math.round(n.x), Math.round(n.y));
    if (S.plamenCas[i] > 0 && !(n.nesmrtelny > 0)) {
      n.ziv = false; n.smrtCas = 0;
      const body = NEPRATELE[n.typ].body;
      S.skore += body;
      S.udalosti.push({ typ: 'nepritel', x: n.x, y: n.y, body });
      continue;
    }
    for (const h of hraci) if (h.ziv && Math.abs(h.x - n.x) < 0.62 && Math.abs(h.y - n.y) < 0.62) zabij(S, h, { typ: 'nepritel', vlastnik: -1 });
  }

  // náhlá smrt (souboj)
  if (S.nahla && S.cas >= S.nahla.start) {
    const N = S.nahla;
    N.dalsi -= DT;
    while (N.dalsi <= 0 && N.k < N.poradi.length) {
      N.dalsi += N.interval;
      const i = N.poradi[N.k++], x = i % W, y = (i - x) / W;
      S.m[i] = ZED; S.plamenCas[i] = 0; S.plamenTvar[i] = 0;
      delete S.predmety[i]; delete S.skryte[i];
      S.bomby = S.bomby.filter(b => !(Math.round(b.x) === x && Math.round(b.y) === y));
      for (const h of hraci) if (h.ziv && Math.round(h.x) === x && Math.round(h.y) === y) zabij(S, h, { typ: 'nahla', vlastnik: -1 });
      S.udalosti.push({ typ: 'zed', x, y });
    }
  }
  // kampaň: vypršel čas → přijdou mince
  if (S.rezim === 'kampan' && !S.casVyprsel && S.cas >= S.casLimit) {
    S.casVyprsel = true;
    const volna = [];
    for (let i = 0; i < W * H; i++) {
      if (S.m[i] !== VOLNO) continue;
      const x = i % W, y = (i - x) / W;
      if (hraci.every(h => Math.abs(h.x - x) + Math.abs(h.y - y) >= 6)) volna.push(i);
    }
    zamichej(volna, S.rng);
    for (let k = 0; k < 4 && k < volna.length; k++) S.nepratele.push(novyNepritel(S, 'mince', volna[k] % W, Math.floor(volna[k] / W)));
    S.udalosti.push({ typ: 'cas' });
  }

  vyhodnot(S);
}

function seber(h, p) {
  if (p === 'bomba') h.maxBomb = Math.min(MAX_BOMB, h.maxBomb + 1);
  else if (p === 'plamen') h.plamen = Math.min(MAX_PLAMEN, h.plamen + 1);
  else if (p === 'rychlost') h.rychlostLvl = Math.min(RYCHLOST_MAX, h.rychlostLvl + 1);
  else if (p === 'kopani') h.kopani = true;
  else if (p === 'dalkova') h.dalkova = true;
}

function vyhodnot(S) {
  if (S.vysledek) return;
  const zivi = S.hraci.filter(h => h.ziv);
  if (S.rezim === 'souboj') {
    if (zivi.length <= 1) {
      if (S.konecOdpocet < 0) S.konecOdpocet = 1.2;      // počkat, jestli nepadne i poslední
      S.konecOdpocet -= DT;
      // nic už nehoří ani netiká → není na co čekat
      if (!S.bomby.length && !S.plamenCas.some((c, i) => c > 0 && S.m[i] !== HORI)) S.konecOdpocet = 0;
      if (S.konecOdpocet <= 0) S.vysledek = zivi.length === 1 ? { typ: 'vyhra', hrac: zivi[0].id } : { typ: 'remiza' };
    }
  } else {
    if (!zivi.length) {
      if (S.konecOdpocet < 0) S.konecOdpocet = 2;
      S.konecOdpocet -= DT;
      if (S.konecOdpocet <= 0) S.vysledek = { typ: 'smrt' };
      return;
    }
    const zbyva = S.nepratele.some(n => n.ziv);
    if (!zbyva && S.predmety[S.dvere] === 'dvere') {
      for (const h of zivi) if (idx(Math.round(h.x), Math.round(h.y)) === S.dvere && Math.abs(h.x - Math.round(h.x)) < 0.3 && Math.abs(h.y - Math.round(h.y)) < 0.3) {
        S.vysledek = { typ: 'uroven', bonus: Math.max(0, Math.round(S.casLimit - S.cas)) * 10 };
        S.skore += S.vysledek.bonus;
        S.udalosti.push({ typ: 'uroven' });
        break;
      }
    }
  }
}

Object.assign(B, {
  DT, W, H, ZAPALNIK, PLAMEN_CAS, KOP_RYCHLOST, VOLNO, ZED, BEDNA, HORI, SMERY, NEPRATELE, UROVNE, BARVY,
  rng, novySouboj, novaUroven, krok, polozBombu, odpal, odpalDalkove, bombaNa, pruchoziHrac, pruchoziNepritel,
  rychlost, aktivniBomby, seber, idx, pohniHrace,
});

})(BOMB);
