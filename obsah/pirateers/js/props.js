/**
 * props.js — náhodné objekty (dekorace) rozmístěné po mapě:
 * trsy trávy, květinové louky, stromy, jehličnany, keře, kameny, klády,
 * pařezy a rákosí.
 *
 * PRINCIP (stejný jako u dlaždic):
 *   1) Sprity se vykreslí procedurálně JEDNOU do offscreen canvasů
 *      (N variant na typ) — při skládání mapy už jen `drawImage`.
 *   2) Rozmístění je čistě datové: pole PROP_TYPES určuje, na jakém terénu
 *      objekt roste, jak hustě, jak se shlukuje a kolik místa potřebuje.
 *   3) Vše je deterministické podle seedu mapy — žádný Math.random.
 *      Každá buňka má vlastní PRNG odvozený hashem (seed, x, y, typ),
 *      takže změna hustoty jednoho typu nerozhází ostatní.
 *
 * SOUŘADNICE: logická buňka (x, y) zabírá pixely
 *   [x*64, x*64+64) × [y*64, y*64+64) — objekt se umisťuje kolem jejího středu.
 *   Kotva spritu je vždy DOLE UPROSTŘED (paty objektu), aby fungovalo
 *   řazení podle y (malířův algoritmus) a objekty se správně překrývaly.
 *
 * PŘIDÁNÍ OBJEKTU: jedna položka do PROP_TYPES + kreslicí funkce. UI
 * (posuvník hustoty) se vygeneruje samo.
 */

import { TILE_SIZE } from './terrain.js';
import { makePRNG, makeNoise2D } from './noise.js';

/* ------------------------------------------------------------------ */
/* Definice typů objektů                                               */
/* ------------------------------------------------------------------ */

/**
 * Položka:
 *   id, name      — identifikátor a popisek do UI
 *   terrains      — na kterých terénech (id z TERRAINS) objekt roste
 *   near          — nepovinné: aspoň jeden ze 4 sousedů musí být tento terén
 *   pure          — true => všech 8 sousedů musí být stejný terén
 *                   (objekt tak nikdy nepřečnívá přes pobřeží)
 *   density       — základní pravděpodobnost na pokus (0..1)
 *   attempts      — kolik pokusů na buňku
 *   clump         — shlukování: { scale, bias, power } nad vlastním noise polem
 *                   (bias = jak velká část mapy je „mimo shluk")
 *   radius        — osobní prostor v px (dva objekty se nesmí překrýt součtem)
 *   jitter        — rozptyl uvnitř buňky, 0..1 (1 = celá buňka)
 *   scaleRange    — [min, max] náhodné zvětšení spritu
 *   variants      — počet předgenerovaných variant
 *   sprite        — { w, h, ax, ay } rozměr plátna a kotva (paty objektu)
 *   draw          — kreslicí funkce (ctx s počátkem v kotvě, y nahoru = záporné)
 */
export const PROP_TYPES = [
  {
    id: 'TREE', name: 'Strom', terrains: ['GRASS'], pure: true,
    density: 0.55, attempts: 1, clump: { scale: 0.10, bias: 0.46, power: 1.6 },
    radius: 17, jitter: 0.55, scaleRange: [0.85, 1.15], variants: 6,
    sprite: { w: 80, h: 96, ax: 40, ay: 90 }, draw: drawTree,
  },
  {
    id: 'PINE', name: 'Jehličnan', terrains: ['GRASS'], pure: true,
    density: 0.5, attempts: 1, clump: { scale: 0.085, bias: 0.55, power: 1.8 },
    radius: 15, jitter: 0.55, scaleRange: [0.85, 1.2], variants: 5,
    sprite: { w: 72, h: 108, ax: 36, ay: 102 }, draw: drawPine,
  },
  {
    id: 'BUSH', name: 'Keř', terrains: ['GRASS'], pure: true,
    density: 0.28, attempts: 1, clump: { scale: 0.13, bias: 0.35, power: 1.3 },
    radius: 11, jitter: 0.7, scaleRange: [0.8, 1.2], variants: 5,
    sprite: { w: 56, h: 48, ax: 28, ay: 43 }, draw: drawBush,
  },
  {
    id: 'LOG', name: 'Kláda', terrains: ['GRASS'], pure: true,
    density: 0.06, attempts: 1, clump: { scale: 0.11, bias: 0.3, power: 1.2 },
    radius: 15, jitter: 0.5, scaleRange: [0.85, 1.15], variants: 4,
    sprite: { w: 72, h: 40, ax: 36, ay: 34 }, draw: drawLog,
  },
  {
    id: 'STUMP', name: 'Pařez', terrains: ['GRASS'], pure: true,
    density: 0.05, attempts: 1, clump: { scale: 0.11, bias: 0.35, power: 1.2 },
    radius: 10, jitter: 0.6, scaleRange: [0.85, 1.1], variants: 4,
    sprite: { w: 44, h: 40, ax: 22, ay: 35 }, draw: drawStump,
  },
  {
    id: 'ROCK', name: 'Kámen', terrains: ['GRASS', 'SAND'],
    density: 0.16, attempts: 1, clump: { scale: 0.15, bias: 0.4, power: 1.5 },
    radius: 10, jitter: 0.75, scaleRange: [0.6, 1.35], variants: 6,
    sprite: { w: 52, h: 44, ax: 26, ay: 39 }, draw: drawRock,
  },
  {
    id: 'TUFT', name: 'Trs trávy', terrains: ['GRASS'],
    density: 0.75, attempts: 3, clump: { scale: 0.2, bias: 0.08, power: 1 },
    radius: 5, jitter: 0.95, scaleRange: [0.7, 1.25], variants: 8,
    sprite: { w: 40, h: 32, ax: 20, ay: 28 }, draw: drawTuft,
  },
  {
    id: 'FLOWERS', name: 'Louka (květy)', terrains: ['GRASS'],
    density: 0.6, attempts: 3, clump: { scale: 0.16, bias: 0.6, power: 2.0 },
    radius: 6, jitter: 0.95, scaleRange: [0.75, 1.2], variants: 8,
    sprite: { w: 44, h: 36, ax: 22, ay: 31 }, draw: drawFlowers,
  },
  {
    id: 'REED', name: 'Rákosí', terrains: ['SAND'], near: 'WATER',
    density: 0.65, attempts: 2, clump: { scale: 0.18, bias: 0.2, power: 1.1 },
    radius: 6, jitter: 0.9, scaleRange: [0.8, 1.2], variants: 6,
    sprite: { w: 40, h: 56, ax: 20, ay: 50 }, draw: drawReed,
  },
];

/** Výchozí násobiče hustoty pro UI (1 = hustota podle definice výše). */
export const PROP_DEFAULTS = {
  propsEnabled: true,
  propDensity: 1,
  propDensities: PROP_TYPES.map(() => 1),
};

/* ------------------------------------------------------------------ */
/* Předgenerování spritů                                               */
/* ------------------------------------------------------------------ */

/**
 * Pro každý typ vyrobí pole `variants` hotových canvasů.
 * Volá se jednou při startu — kreslení mapy pak jen blituje.
 */
export function buildPropSprites(types = PROP_TYPES) {
  return types.map((type, ti) => {
    const out = [];
    for (let v = 0; v < type.variants; v++) {
      const c = document.createElement('canvas');
      c.width = type.sprite.w;
      c.height = type.sprite.h;
      const ctx = c.getContext('2d');
      ctx.translate(type.sprite.ax, type.sprite.ay);
      const rnd = makePRNG(0x5eed + ti * 7919 + v * 131);
      type.draw(ctx, rnd);
      out.push(c);
    }
    return out;
  });
}

/* ------------------------------------------------------------------ */
/* Rozmístění                                                          */
/* ------------------------------------------------------------------ */

/** Hash (seed, x, y, typ) → seed pro PRNG jedné buňky. */
function cellSeed(seed, x, y, t) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (x + 0x1234), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (y + 0x765f), 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (t * 0x27d4eb2f), 0x165667b1) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/** Prostorová mřížka pro test odstupů — O(1) dotaz místo procházení všeho. */
function makeSpatialGrid(cell) {
  const buckets = new Map();
  const key = (gx, gy) => gx * 73856093 ^ gy * 19349663;
  return {
    fits(px, py, r) {
      const gx = Math.floor(px / cell);
      const gy = Math.floor(py / cell);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const b = buckets.get(key(gx + dx, gy + dy));
          if (!b) continue;
          for (const p of b) {
            const dxp = p.x - px;
            const dyp = p.y - py;
            const rr = p.r + r;
            if (dxp * dxp + dyp * dyp < rr * rr) return false;
          }
        }
      }
      return true;
    },
    add(px, py, r) {
      const k = key(Math.floor(px / cell), Math.floor(py / cell));
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = []));
      b.push({ x: px, y: py, r });
    },
  };
}

/**
 * Vygeneruje seznam objektů pro mapu.
 *
 * @param {object} map      logická mřížka z mapgen.js
 * @param {Array}  terrains pole terénů (kvůli převodu id → index)
 * @param {object} opts     { seed, propsEnabled, propDensity, propDensities }
 * @returns {Array<{ti:number, v:number, x:number, y:number, s:number, flip:boolean}>}
 *          seřazeno podle y (malířův algoritmus)
 */
export function generateProps(map, terrains, opts = {}) {
  const {
    seed = 0,
    propsEnabled = true,
    propDensity = 1,
    propDensities = PROP_TYPES.map(() => 1),
    types = PROP_TYPES,
  } = opts;
  if (!propsEnabled || propDensity <= 0) return [];

  const S = TILE_SIZE;
  const idx = new Map(terrains.map((t, i) => [t.id, i]));
  const items = [];
  const grid = makeSpatialGrid(S);

  for (let ti = 0; ti < types.length; ti++) {
    const type = types[ti];
    const dens = type.density * propDensity * (propDensities[ti] ?? 1);
    if (dens <= 0) continue;

    // Povolené terény jako množina indexů; typ odkazující na neexistující
    // terén se prostě přeskočí (mapa nemusí mít všechny terény).
    const allowed = new Set(type.terrains.map((id) => idx.get(id)).filter((v) => v !== undefined));
    if (!allowed.size) continue;
    const nearT = type.near !== undefined ? idx.get(type.near) : undefined;
    if (type.near !== undefined && nearT === undefined) continue;

    const clumpNoise = makeNoise2D(seed + 1013 * (ti + 1));
    const { scale, bias, power } = type.clump;

    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const here = map.get(x, y);
        if (!allowed.has(here)) continue;
        if (type.pure && !isPure(map, x, y, here)) continue;
        if (nearT !== undefined && !hasNeighbor(map, x, y, nearT)) continue;

        // Shlukování — nad vlastním noise polem typu, takže lesy, louky
        // a kamenná pole leží každé jinde.
        const c = clumpNoise(x * scale, y * scale) * 0.5 + 0.5;
        const t = Math.max(0, (c - bias) / (1 - bias || 1));
        const p = Math.min(1, dens * Math.pow(t, power));
        if (p <= 0) continue;

        const rnd = makePRNG(cellSeed(seed, x, y, ti + 1));
        const attempts = type.attempts || 1;
        for (let a = 0; a < attempts; a++) {
          const roll = rnd();
          const jx = (rnd() - 0.5) * S * type.jitter;
          const jy = (rnd() - 0.5) * S * type.jitter;
          const s = type.scaleRange[0] + rnd() * (type.scaleRange[1] - type.scaleRange[0]);
          const flip = rnd() < 0.5;
          const v = Math.floor(rnd() * type.variants) % type.variants;
          if (roll >= p) continue;

          const px = x * S + S / 2 + jx;
          const py = y * S + S / 2 + jy;
          const r = type.radius * s;
          if (!grid.fits(px, py, r)) continue;
          grid.add(px, py, r);
          items.push({ ti, v, x: px, y: py, s, flip });
        }
      }
    }
  }

  // Malířův algoritmus: co je níž, kreslí se později (překrývá).
  items.sort((a, b) => a.y - b.y || a.x - b.x);
  return items;
}

/** Všech 8 sousedů má stejný terén jako buňka. */
function isPure(map, x, y, t) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (map.get(x + dx, y + dy) !== t) return false;
    }
  }
  return true;
}

/** Aspoň jeden ze 4 sousedů je terén T. */
function hasNeighbor(map, x, y, T) {
  return map.get(x + 1, y) === T || map.get(x - 1, y) === T
    || map.get(x, y + 1) === T || map.get(x, y - 1) === T;
}

/* ------------------------------------------------------------------ */
/* Vykreslení                                                          */
/* ------------------------------------------------------------------ */

/** Vykreslí seřazený seznam objektů do kontextu (v pixelech mapy). */
export function drawProps(ctx, items, sprites, types = PROP_TYPES) {
  if (!items || !items.length) return;
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true; // sprity jsou vektorové, ne pixel art
  for (const it of items) {
    const type = types[it.ti];
    const img = sprites[it.ti][it.v];
    const w = type.sprite.w * it.s;
    const h = type.sprite.h * it.s;
    const ax = type.sprite.ax * it.s;
    const ay = type.sprite.ay * it.s;
    if (it.flip) {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -ax, -ay, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, it.x - ax, it.y - ay, w, h);
    }
  }
  ctx.imageSmoothingEnabled = smooth;
}

/* ------------------------------------------------------------------ */
/* Kreslicí funkce — počátek v patě objektu, y nahoru je záporné        */
/* ------------------------------------------------------------------ */

function shadow(ctx, rx, ry, alpha = 0.22) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(0, -ry * 0.35, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Deterministická variace odstínu — vrací hsl string. */
function tint(rnd, h, s, l, spread = 6) {
  return `hsl(${h + (rnd() - 0.5) * spread}, ${s}%, ${l + (rnd() - 0.5) * spread}%)`;
}

function drawTrunk(ctx, w, h, color, dark) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.lineTo(-w * 0.55, -h);
  ctx.lineTo(w * 0.55, -h);
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(w * 0.15, -h, w * 0.6, h);
}

function drawTree(ctx, rnd) {
  const trunkH = 16 + rnd() * 8;
  const r = 15 + rnd() * 5;
  const cy = -trunkH - r * 0.75;

  shadow(ctx, r * 0.85, r * 0.32);
  drawTrunk(ctx, 3.2 + rnd(), trunkH + 4, '#7a5432', '#5f3f24');

  const base = tint(rnd, 104, 38, 30);
  const mid = tint(rnd, 102, 40, 40);
  const light = tint(rnd, 96, 44, 50);
  const blobs = 4 + Math.floor(rnd() * 3);
  const pts = [];
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + rnd() * 0.6;
    const d = r * (0.35 + rnd() * 0.35);
    pts.push([Math.cos(a) * d, cy + Math.sin(a) * d * 0.65, r * (0.55 + rnd() * 0.3)]);
  }
  pts.push([0, cy, r * 0.85]);

  for (const shade of [base, mid]) {
    ctx.fillStyle = shade;
    const off = shade === base ? 3 : 0;
    for (const [px, py, pr] of pts) {
      ctx.beginPath();
      ctx.arc(px, py + off, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Světlo shora zleva: jeden velký kruh oříznutý siluetou koruny.
  // (Světlé kruhy na jednotlivých blobech by vypadaly jako skvrny.)
  const canopy = new Path2D();
  for (const [px, py, pr] of pts) {
    canopy.moveTo(px + pr, py);
    canopy.arc(px, py, pr, 0, Math.PI * 2);
  }
  ctx.save();
  ctx.clip(canopy);
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(-r * 0.38, cy - r * 0.5, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPine(ctx, rnd) {
  const trunkH = 10 + rnd() * 5;
  const h = 48 + rnd() * 22;
  const w = 13 + rnd() * 5;
  const tiers = 3 + Math.floor(rnd() * 2);

  shadow(ctx, w * 0.75, w * 0.3);
  drawTrunk(ctx, 2.6, trunkH + 3, '#6b4a2c', '#54391f');

  const dark = tint(rnd, 138, 34, 24);
  const mid = tint(rnd, 134, 36, 32);
  const light = tint(rnd, 128, 38, 41);
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const top = -trunkH - h * (0.35 + t * 0.62);
    const bottom = top + h * 0.42;
    const half = w * (1 - t * 0.55);
    ctx.fillStyle = i === tiers - 1 ? light : (i === 0 ? dark : mid);
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(half, bottom);
    ctx.lineTo(half * 0.35, bottom - 2);
    ctx.lineTo(-half * 0.35, bottom - 2);
    ctx.lineTo(-half, bottom);
    ctx.closePath();
    ctx.fill();
    // stinná pravá strana
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(half, bottom);
    ctx.lineTo(0, bottom - 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBush(ctx, rnd) {
  const r = 9 + rnd() * 4;
  shadow(ctx, r * 1.1, r * 0.38);
  const base = tint(rnd, 110, 36, 28);
  const light = tint(rnd, 104, 42, 42);
  const blobs = 3 + Math.floor(rnd() * 3);
  const pts = [];
  for (let i = 0; i < blobs; i++) {
    pts.push([(rnd() - 0.5) * r * 1.8, -r * (0.6 + rnd() * 0.7), r * (0.5 + rnd() * 0.4)]);
  }
  ctx.fillStyle = base;
  for (const [px, py, pr] of pts) {
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = light;
  for (const [px, py, pr] of pts) {
    ctx.beginPath();
    ctx.arc(px - pr * 0.2, py - pr * 0.25, pr * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // pár bobulí
  if (rnd() < 0.5) {
    ctx.fillStyle = '#c1443c';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc((rnd() - 0.5) * r * 1.6, -r * (0.5 + rnd()), 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLog(ctx, rnd) {
  const len = 26 + rnd() * 12;
  const rad = 5 + rnd() * 2;
  const tilt = (rnd() - 0.5) * 0.5;

  shadow(ctx, len * 0.62, rad * 0.9);
  ctx.save();
  ctx.rotate(tilt);
  const body = tint(rnd, 28, 30, 36);
  const top = tint(rnd, 30, 32, 46);

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.rect(-len / 2, -rad * 2, len, rad * 2);
  ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.rect(-len / 2, -rad * 2, len, rad * 0.9);
  ctx.fill();

  // letokruhy na čele
  ctx.fillStyle = '#a3855c';
  ctx.beginPath();
  ctx.ellipse(-len / 2, -rad, rad * 0.5, rad, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,64,38,0.8)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(-len / 2, -rad, rad * 0.5 * (i / 3), rad * (i / 3), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // suky / pahýly větví
  ctx.strokeStyle = body;
  ctx.lineWidth = 2;
  const knots = Math.floor(rnd() * 3);
  for (let i = 0; i < knots; i++) {
    const kx = (rnd() - 0.5) * len * 0.7;
    ctx.beginPath();
    ctx.moveTo(kx, -rad * 1.6);
    ctx.lineTo(kx + (rnd() - 0.5) * 8, -rad * 2 - 4 - rnd() * 4);
    ctx.stroke();
  }
  // mech
  ctx.fillStyle = 'rgba(90,140,70,0.55)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse((rnd() - 0.5) * len * 0.8, -rad * 2 + rnd() * 2, 2 + rnd() * 3, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStump(ctx, rnd) {
  const r = 7 + rnd() * 3;
  const h = 7 + rnd() * 5;
  shadow(ctx, r * 1.15, r * 0.4);
  ctx.fillStyle = tint(rnd, 26, 28, 32);
  ctx.beginPath();
  ctx.rect(-r, -h, r * 2, h);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(r * 0.2, -h, r * 0.8, h);
  // řezná plocha
  ctx.fillStyle = tint(rnd, 34, 38, 60);
  ctx.beginPath();
  ctx.ellipse(0, -h, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,88,54,0.6)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(0, -h, r * (i / 3), r * 0.45 * (i / 3), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // kořeny
  ctx.strokeStyle = tint(rnd, 26, 28, 28);
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const a = -0.4 + i * 0.5 + rnd() * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(Math.cos(a + Math.PI) * r * 1.6, -1 + Math.sin(a) * 2);
    ctx.stroke();
  }
}

function drawRock(ctx, rnd) {
  const r = 7 + rnd() * 6;
  shadow(ctx, r * 1.15, r * 0.4);

  const n = 6 + Math.floor(rnd() * 3);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = r * (0.75 + rnd() * 0.45);
    pts.push([Math.cos(a) * d, -r * 0.6 + Math.sin(a) * d * 0.72]);
  }
  const hue = 200 + (rnd() - 0.5) * 40;
  ctx.fillStyle = `hsl(${hue}, 7%, ${44 + rnd() * 8}%)`;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [px, py] of pts.slice(1)) ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fill();

  // horní faseta
  ctx.fillStyle = `hsl(${hue}, 8%, ${62 + rnd() * 8}%)`;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * 0.5, pts[0][1] * 0.95);
  for (const [px, py] of pts) {
    if (py <= -r * 0.6) ctx.lineTo(px * 0.75, py * 0.92);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(30,34,38,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [px, py] of pts.slice(1)) ctx.lineTo(px, py);
  ctx.closePath();
  ctx.stroke();
}

/** Sada zahnutých stébel — základ pro trs trávy i louku. */
function blades(ctx, rnd, count, height, color, width = 1.6) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x0 = (rnd() - 0.5) * 14;
    const hgt = height * (0.6 + rnd() * 0.7);
    const bend = (rnd() - 0.5) * hgt * 0.8;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.quadraticCurveTo(x0 + bend * 0.4, -hgt * 0.6, x0 + bend, -hgt);
    ctx.stroke();
  }
}

function drawTuft(ctx, rnd) {
  shadow(ctx, 7, 2.4, 0.14);
  blades(ctx, rnd, 4 + Math.floor(rnd() * 4), 11 + rnd() * 6, tint(rnd, 100, 40, 26), 2);
  blades(ctx, rnd, 3 + Math.floor(rnd() * 3), 10 + rnd() * 7, tint(rnd, 96, 48, 44), 1.5);
}

const FLOWER_COLORS = ['#f2f0e6', '#f0d24e', '#e07a9c', '#9d7ce0', '#e8663c'];

function drawFlowers(ctx, rnd) {
  shadow(ctx, 8, 2.6, 0.12);
  blades(ctx, rnd, 5 + Math.floor(rnd() * 4), 10 + rnd() * 5, tint(rnd, 98, 42, 34), 1.6);
  const color = FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)];
  const n = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * 16;
    const y = -6 - rnd() * 12;
    ctx.strokeStyle = 'rgba(78,120,60,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x, y * 0.5, x, y);
    ctx.stroke();
    ctx.fillStyle = color;
    const pr = 1.6 + rnd() * 1.2;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * pr, y + Math.sin(a) * pr, pr * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e8b23c';
    ctx.beginPath();
    ctx.arc(x, y, pr * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawReed(ctx, rnd) {
  shadow(ctx, 7, 2.4, 0.16);
  const stalks = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < stalks; i++) {
    const x0 = (rnd() - 0.5) * 12;
    const h = 22 + rnd() * 18;
    const bend = (rnd() - 0.5) * 8;
    ctx.strokeStyle = tint(rnd, 78, 32, 40);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.quadraticCurveTo(x0 + bend * 0.4, -h * 0.6, x0 + bend, -h);
    ctx.stroke();
    // palice orobince
    if (rnd() < 0.6) {
      ctx.fillStyle = tint(rnd, 26, 34, 30);
      ctx.beginPath();
      ctx.ellipse(x0 + bend, -h - 3, 1.8, 4.2, bend * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
