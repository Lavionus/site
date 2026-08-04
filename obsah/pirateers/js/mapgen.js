/**
 * mapgen.js — generování logické mřížky (2D pole W×H indexů terénu)
 * a povinný post-processing. Vše deterministické podle číselného seedu.
 */

import { TERRAINS, BASE_TERRAIN, heightToTerrain } from './terrain.js';
import { makeFBM } from './noise.js';

export const DEFAULTS = {
  seed: 12345,
  width: 48,
  height: 32,
  octaves: 5,
  persistence: 0.5,
  lacunarity: 2.0,
  scale: 0.06,
  falloff: 0.85,
  minIslandSize: 12,
  minLakeSize: 8,
};

/**
 * Vygeneruje logickou mřížku.
 * @returns {{ w:number, h:number, cells:Int16Array, get:(x,y)=>number }}
 */
export function generateMap(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const terrains = opts.terrains || TERRAINS;
  const W = Math.max(1, o.width | 0);
  const H = Math.max(1, o.height | 0);
  const fbm = makeFBM(o.seed, {
    octaves: o.octaves,
    persistence: o.persistence,
    lacunarity: o.lacunarity,
    scale: o.scale,
  });

  // 1. průchod — surové výšky + rozsah (kvůli normalizaci na plné 0..1,
  //    aby prahy terénů znamenaly totéž nezávisle na parametrech noise)
  const heights = new Float32Array(W * H);
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h = fbm(x, y);
      heights[y * W + x] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  const span = max - min || 1;

  // 2. průchod — normalizace, radiální falloff, klasifikace
  const cells = new Int16Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let h = (heights[y * W + x] - min) / span;
      h -= o.falloff * radialFalloff(x, y, W, H);
      if (h < 0) h = 0;
      else if (h > 1) h = 1;
      cells[y * W + x] = heightToTerrain(h, terrains);
    }
  }

  const map = wrap(W, H, cells);
  removeSmallIslands(map, o.minIslandSize);
  fillSmallLakes(map, o.minLakeSize, terrains);
  smoothDiagonals(map);
  return map;
}

/** Radiální falloff: 0 uprostřed, ~1 u okrajů. */
function radialFalloff(x, y, W, H) {
  const nx = W > 1 ? (x / (W - 1)) * 2 - 1 : 0;
  const ny = H > 1 ? (y / (H - 1)) * 2 - 1 : 0;
  const d = Math.min(1, Math.sqrt(nx * nx + ny * ny) / Math.SQRT2 * 1.15);
  return Math.pow(d, 2.4);
}

export function wrap(w, h, cells) {
  return {
    w,
    h,
    cells,
    /** Vzorkování s clampem mimo mapu na nejnižší terén (voda). */
    get(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return BASE_TERRAIN;
      return cells[y * w + x];
    },
    set(x, y, v) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      cells[y * w + x] = v;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Post-processing                                                     */
/* ------------------------------------------------------------------ */

const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Najde 4-souvislé komponenty buněk, pro které platí predikát.
 * Vrací pole { cells: number[] (indexy), touchesBorder: boolean }.
 */
function components(map, predicate) {
  const { w, h, cells } = map;
  const seen = new Uint8Array(w * h);
  const out = [];
  const stack = [];
  for (let i = 0; i < cells.length; i++) {
    if (seen[i] || !predicate(cells[i])) continue;
    const group = [];
    let touchesBorder = false;
    stack.length = 0;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const idx = stack.pop();
      group.push(idx);
      const x = idx % w;
      const y = (idx - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
      for (const [dx, dy] of NB4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nIdx = ny * w + nx;
        if (seen[nIdx] || !predicate(cells[nIdx])) continue;
        seen[nIdx] = 1;
        stack.push(nIdx);
      }
    }
    out.push({ cells: group, touchesBorder });
  }
  return out;
}

/** Odstraní shluky pevniny menší než minIslandSize buněk (změní je na vodu). */
export function removeSmallIslands(map, minIslandSize) {
  if (minIslandSize <= 1) return;
  const groups = components(map, (t) => t > BASE_TERRAIN);
  for (const g of groups) {
    if (g.cells.length < minIslandSize) {
      for (const idx of g.cells) map.cells[idx] = BASE_TERRAIN;
    }
  }
}

/**
 * Zaplní jezera (vnitřní vodní plochy nedotýkající se okraje) menší než
 * minLakeSize. Vyplní se nejčastějším sousedním terénem — deterministicky,
 * při shodě vyhrává nižší index.
 */
export function fillSmallLakes(map, minLakeSize, terrains = TERRAINS) {
  if (minLakeSize <= 0) return;
  const { w, h } = map;
  const groups = components(map, (t) => t === BASE_TERRAIN);
  for (const g of groups) {
    if (g.touchesBorder || g.cells.length >= minLakeSize) continue;
    const counts = new Array(terrains.length).fill(0);
    for (const idx of g.cells) {
      const x = idx % w;
      const y = (idx - x) / w;
      for (const [dx, dy] of NB4) {
        const t = map.get(x + dx, y + dy);
        if (t > BASE_TERRAIN) counts[t]++;
      }
    }
    let best = BASE_TERRAIN + 1;
    let bestCount = -1;
    for (let t = BASE_TERRAIN + 1; t < counts.length; t++) {
      if (counts[t] > bestCount) {
        bestCount = counts[t];
        best = t;
      }
    }
    for (const idx of g.cells) map.cells[idx] = best;
  }
}

/**
 * Vyhladí izolované diagonální spoje pevniny: ve 2×2 bloku, kde je pevnina
 * jen na jedné diagonále, doplní jednu z vodních buněk na pevninu.
 * Deterministické — vždy se doplňuje buňka vpravo nahoře / vlevo nahoře.
 */
export function smoothDiagonals(map, passes = 2) {
  const { w, h } = map;
  const land = (t) => t > BASE_TERRAIN;
  for (let pass = 0; pass < passes; pass++) {
    let changed = false;
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const tl = map.get(x, y);
        const tr = map.get(x + 1, y);
        const bl = map.get(x, y + 1);
        const br = map.get(x + 1, y + 1);
        if (land(tl) && land(br) && !land(tr) && !land(bl)) {
          map.set(x + 1, y, Math.min(tl, br));
          changed = true;
        } else if (land(tr) && land(bl) && !land(tl) && !land(br)) {
          map.set(x, y, Math.min(tr, bl));
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
}
