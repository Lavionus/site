/**
 * world.js — herní svět: mapa z generátoru (mapGen) + navigační data.
 *
 * Z generátoru se sem bere logická mřížka a dual-grid render. Navíc se
 * dopočítává to, co potřebuje hra a mapGen neřeší:
 *   - úprava mapy pro plavbu (vodní okraj, jediná souvislá vodní plocha),
 *   - znaménkové vzdálenostní pole (SDF) pro kolize se břehem a vyhýbání AI,
 *   - výběr míst, kde smí lodě začínat.
 *
 * Celý terén se renderuje JEDNOU do offscreen canvasu. Za běhu se jen
 * blituje jedním drawImage - proto stojí pozadí prakticky nic.
 */

import { TERRAINS, TILE_SIZE, BASE_TERRAIN } from './terrain.js';
import { generateMap, removeSmallIslands, fillSmallLakes, smoothDiagonals } from './mapgen.js';
import { buildAtlases } from './tiles.js';
import { renderToOffscreen } from './render.js';
import { buildPropSprites, generateProps } from './props.js';

export { TILE_SIZE };

/** Jemnost vzdálenostního pole v px. Menší = přesnější břeh, více paměti. */
const SUB = 8;

/** Kolik volné vody musí být kolem středu buňky, aby se tudy dalo plout. */
const NAV_CLEARANCE = 30;

/** Kolik ostrovů: prahy terénů (písek, tráva) + cílový podíl pevniny. */
const ISLAND_PRESETS = [
  { name: 'Otevřené moře', sand: 1.10, grass: 1.20, target: 0, minIslands: 0 },
  { name: 'Málo ostrovů', sand: 0.64, grass: 0.72, target: 0.11, minIslands: 1 },
  { name: 'Středně', sand: 0.58, grass: 0.66, target: 0.19, minIslands: 2 },
  { name: 'Hodně ostrovů', sand: 0.52, grass: 0.60, target: 0.26, minIslands: 3 },
];

export const ISLAND_NAMES = ISLAND_PRESETS.map(p => p.name);

let atlases = null;
let propSprites = null;
let waterImage = null;

/** Vlastní textura moře z pics/. Když chybí, použije se dlaždice generátoru. */
function loadWaterTexture(src = 'pics/water.png') {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Jednorázová příprava dlaždic a spritů. Musí proběhnout před buildWorld. */
export async function initWorldAssets() {
  atlases = await buildAtlases(TERRAINS, { connectDiagonals: false });
  propSprites = buildPropSprites();
  waterImage = await loadWaterTexture();
}

const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Okraj mapy musí být voda - jinak by loď uvázla v rohu na souši. */
function forceWaterBorder(map, ring = 2) {
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      if (x < ring || y < ring || x >= map.w - ring || y >= map.h - ring) {
        map.cells[y * map.w + x] = BASE_TERRAIN;
      }
    }
  }
}

/**
 * Ponechá jedinou souvislou vodní plochu (tu největší), ostatní zatopené
 * kapsy zasype pevninou. Bez toho by loď mohla vzniknout v jezírku, ze
 * kterého se nedá vyplout, a bitva by nikdy neskončila.
 * Vrací pole indexů buněk splavné vody.
 */
function keepLargestWater(map) {
  const { w, h, cells } = map;
  const seen = new Uint8Array(w * h);
  let best = null;

  for (let i = 0; i < cells.length; i++) {
    if (seen[i] || cells[i] !== BASE_TERRAIN) continue;
    const group = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const idx = stack.pop();
      group.push(idx);
      const x = idx % w;
      const y = (idx - x) / w;
      for (const [dx, dy] of NB4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (seen[n] || cells[n] !== BASE_TERRAIN) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (!best || group.length > best.length) best = group;
  }

  if (!best) return [];
  const navigable = new Uint8Array(w * h);
  for (const idx of best) navigable[idx] = 1;
  // Odříznuté tůně zasypat - pevnina je vizuálně i herně jednoznačná.
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === BASE_TERRAIN && !navigable[i]) cells[i] = BASE_TERRAIN + 1;
  }
  return best;
}

/** Podíl pevniny v mřížce. */
function landFraction(map) {
  let land = 0;
  for (const c of map.cells) if (c > BASE_TERRAIN) land++;
  return land / map.cells.length;
}

/** Počet oddělených ostrovů - podle něj se pozná souostroví od kontinentu. */
function islandCount(map) {
  const { w, h, cells } = map;
  const seen = new Uint8Array(w * h);
  let count = 0;
  for (let i = 0; i < cells.length; i++) {
    if (seen[i] || cells[i] === BASE_TERRAIN) continue;
    count++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % w;
      const y = (idx - x) / w;
      for (const [dx, dy] of NB4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (seen[n] || cells[n] === BASE_TERRAIN) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return count;
}

/**
 * Znaménkové vzdálenostní pole v px na mřížce po SUB px:
 *   > 0 na vodě (vzdálenost k nejbližší pevnině), < 0 na souši.
 * Počítá se chamferem 3-4 ve dvou průchodech - pro naše rozlišení stačí.
 */
function buildSDF(map) {
  const gw = Math.ceil(map.w * TILE_SIZE / SUB);
  const gh = Math.ceil(map.h * TILE_SIZE / SUB);
  const land = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      // Pixel patří té logické buňce, jejímu STŘEDU je nejblíž - a přesně
      // tak vychází i dual-grid kresba, takže se tvar břehu shoduje.
      const cx = Math.floor((gx * SUB + SUB / 2) / TILE_SIZE);
      const cy = Math.floor((gy * SUB + SUB / 2) / TILE_SIZE);
      land[gy * gw + gx] = map.get(cx, cy) > BASE_TERRAIN ? 1 : 0;
    }
  }

  const dLand = chamfer(land, gw, gh, 1);   // vzdálenost k pevnině
  const dWater = chamfer(land, gw, gh, 0);  // vzdálenost k vodě

  const sdf = new Float32Array(gw * gh);
  for (let i = 0; i < sdf.length; i++) {
    sdf[i] = land[i] ? -dWater[i] * SUB : dLand[i] * SUB;
  }
  return { sdf, gw, gh, land };
}

/** Vzdálenost každé buňky k nejbližší buňce s hodnotou `to` (v krocích mřížky). */
function chamfer(src, gw, gh, to) {
  const INF = 1e9;
  const d = new Float32Array(gw * gh);
  for (let i = 0; i < d.length; i++) d[i] = src[i] === to ? 0 : INF;

  const D1 = 1;
  const D2 = Math.SQRT2;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + D1);
      if (y > 0) v = Math.min(v, d[i - gw] + D1);
      if (x > 0 && y > 0) v = Math.min(v, d[i - gw - 1] + D2);
      if (x < gw - 1 && y > 0) v = Math.min(v, d[i - gw + 1] + D2);
      d[i] = v;
    }
  }
  for (let y = gh - 1; y >= 0; y--) {
    for (let x = gw - 1; x >= 0; x--) {
      const i = y * gw + x;
      let v = d[i];
      if (x < gw - 1) v = Math.min(v, d[i + 1] + D1);
      if (y < gh - 1) v = Math.min(v, d[i + gw] + D1);
      if (x < gw - 1 && y < gh - 1) v = Math.min(v, d[i + gw + 1] + D2);
      if (x > 0 && y < gh - 1) v = Math.min(v, d[i + gw - 1] + D2);
      d[i] = v;
    }
  }
  return d;
}

export class World {
  constructor(map, offscreen, field, navigable) {
    this.map = map;
    this.offscreen = offscreen;
    this.width = map.w * TILE_SIZE;
    this.height = map.h * TILE_SIZE;
    this.sdf = field.sdf;
    this.gw = field.gw;
    this.gh = field.gh;
    this.navigable = navigable;
    this.buildNav();
  }

  /**
   * Vzdálenost bodu od břehu v px (záporná na souši), bilineárně.
   * Mimo mapu vrací zápornou hodnotu - okolí mapy se chová jako mělčina.
   */
  depth(x, y) {
    const fx = x / SUB - 0.5;
    const fy = y / SUB - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    if (x0 < 0 || y0 < 0 || x0 >= this.gw - 1 || y0 >= this.gh - 1) {
      const cx = Math.min(this.gw - 1, Math.max(0, x0));
      const cy = Math.min(this.gh - 1, Math.max(0, y0));
      const edge = this.sdf[cy * this.gw + cx];
      // Za hranou pole klesá „hloubka" lineárně, takže gradient dál funguje.
      const out = Math.max(-x, -y, x - this.width, y - this.height, 0);
      return Math.min(edge, 0) - out;
    }
    const tx = fx - x0;
    const ty = fy - y0;
    const i = y0 * this.gw + x0;
    const a = this.sdf[i];
    const b = this.sdf[i + 1];
    const c = this.sdf[i + this.gw];
    const d = this.sdf[i + this.gw + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  /** Normála směřující od břehu do vody (jednotková). */
  normal(x, y) {
    const e = SUB;
    const gx = this.depth(x + e, y) - this.depth(x - e, y);
    const gy = this.depth(x, y + e) - this.depth(x, y - e);
    const len = Math.hypot(gx, gy);
    if (len < 1e-6) return { x: 0, y: 0 };
    return { x: gx / len, y: gy / len };
  }

  isWater(x, y) {
    return this.depth(x, y) > 0;
  }

  /* ---------------- navigace ---------------- */

  /**
   * Splavná mřížka v rozlišení logických buněk: buňka je průjezdná, když
   * je její střed dost daleko od břehu na to, aby se tam loď vešla.
   * Slouží jen k hledání cesty - přesnou kolizi pořád řeší SDF.
   */
  buildNav() {
    const { w, h } = this.map;
    this.nav = new Uint8Array(w * h);
    this.navCost = new Float32Array(w * h);
    for (let cy = 0; cy < h; cy++) {
      for (let cx = 0; cx < w; cx++) {
        const d = this.depth(cx * TILE_SIZE + TILE_SIZE / 2, cy * TILE_SIZE + TILE_SIZE / 2);
        this.nav[cy * w + cx] = d >= NAV_CLEARANCE ? 1 : 0;
        // Těsně u břehu se pluje nerado - cesta se raději drží volné vody.
        this.navCost[cy * w + cx] = d < NAV_CLEARANCE * 2 ? 0.9 : 0;
      }
    }
  }

  /** Je mezi body čistá voda? Vzorkuje se po půl dlaždici. */
  lineOfSight(ax, ay, bx, by, clearance = NAV_CLEARANCE) {
    const dist = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(dist / (TILE_SIZE / 2)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (this.depth(ax + (bx - ax) * t, ay + (by - ay) * t) < clearance) return false;
    }
    return true;
  }

  cellOf(x, y) {
    return {
      cx: Math.max(0, Math.min(this.map.w - 1, Math.floor(x / TILE_SIZE))),
      cy: Math.max(0, Math.min(this.map.h - 1, Math.floor(y / TILE_SIZE)))
    };
  }

  /** Nejbližší průjezdná buňka - loď i cíl můžou stát těsně u břehu. */
  nearestNavCell(cx, cy, maxRing = 6) {
    const { w, h } = this.map;
    if (this.nav[cy * w + cx]) return cy * w + cx;
    for (let r = 1; r <= maxRing; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (this.nav[ny * w + nx]) return ny * w + nx;
        }
      }
    }
    return -1;
  }

  /**
   * A* přes splavné buňky. Vrací pole bodů v pixelech (bez výchozího),
   * nebo null, když cesta neexistuje. Mřížka má jen pár set buněk, takže
   * je i lineární výběr z otevřeného seznamu levnější než složitější haldy.
   */
  findPath(fromX, fromY, toX, toY) {
    const { w, h } = this.map;
    const a = this.cellOf(fromX, fromY);
    const b = this.cellOf(toX, toY);
    const start = this.nearestNavCell(a.cx, a.cy);
    const goal = this.nearestNavCell(b.cx, b.cy);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [{ x: toX, y: toY }];

    const n = w * h;
    const g = new Float32Array(n).fill(Infinity);
    const fscore = new Float32Array(n).fill(Infinity);
    const from = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const open = [start];
    const gx = goal % w;
    const gy = (goal - gx) / w;
    const heur = (i) => {
      const x = i % w;
      const y = (i - x) / w;
      const dx = Math.abs(x - gx);
      const dy = Math.abs(y - gy);
      // osmisměrná vzdálenost
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    g[start] = 0;
    fscore[start] = heur(start);

    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) {
        if (fscore[open[i]] < fscore[open[bi]]) bi = i;
      }
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === goal) return this.buildPath(from, cur, toX, toY);
      closed[cur] = 1;

      const cx = cur % w;
      const cy = (cur - cx) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (!this.nav[ni] || closed[ni]) continue;
          // Diagonálou se neprosmýkne mezi dvěma cípy pevniny.
          if (dx && dy && (!this.nav[cy * w + nx] || !this.nav[ny * w + cx])) continue;

          const step = (dx && dy ? Math.SQRT2 : 1) + this.navCost[ni];
          const tentative = g[cur] + step;
          if (tentative >= g[ni]) continue;
          g[ni] = tentative;
          from[ni] = cur;
          fscore[ni] = tentative + heur(ni);
          if (!open.includes(ni)) open.push(ni);
        }
      }
    }
    return null;
  }

  /** Z rodičovských odkazů složí cestu a rovnou ji vyhladí. */
  buildPath(from, goal, toX, toY) {
    const { w } = this.map;
    const cells = [];
    for (let i = goal; i >= 0; i = from[i]) cells.push(i);
    cells.reverse();

    const pts = cells.map(i => {
      const x = i % w;
      return { x: x * TILE_SIZE + TILE_SIZE / 2, y: ((i - x) / w) * TILE_SIZE + TILE_SIZE / 2 };
    });
    pts.push({ x: toX, y: toY });

    // Provázkové vyhlazení: z každého bodu se skočí co nejdál dopředu, kam
    // je vidět. Bez toho by loď kopírovala schodovitou mřížku.
    const out = [];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.lineOfSight(pts[i].x, pts[i].y, pts[j].x, pts[j].y)) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  /**
   * Náhodná splavná místa s dostatečným odstupem od břehu, seřazená podle
   * vlastní preference (např. levá polovina mapy pro modrý tým).
   */
  spawnPoints(count, clearance, rnd, prefer = null) {
    const pts = [];
    for (const idx of this.navigable) {
      const cx = idx % this.map.w;
      const cy = (idx - cx) / this.map.w;
      const x = cx * TILE_SIZE + TILE_SIZE / 2;
      const y = cy * TILE_SIZE + TILE_SIZE / 2;
      if (this.depth(x, y) < clearance) continue;
      pts.push({ x, y });
    }
    if (!pts.length) return [];

    // Deterministické zamíchání, ať se lodě nesypou po řadách.
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    if (prefer) pts.sort((a, b) => prefer(a) - prefer(b));

    // Odstup mezi vybranými místy, jinak by lodě startovaly na sobě.
    const chosen = [];
    const minGap = 90;
    for (const p of pts) {
      if (chosen.every(c => Math.hypot(c.x - p.x, c.y - p.y) > minGap)) chosen.push(p);
      if (chosen.length >= count) break;
    }
    while (chosen.length < count && pts.length) chosen.push(pts[chosen.length % pts.length]);
    return chosen;
  }
}

/**
 * Vygeneruje svět o daném počtu buněk.
 *
 * Seed se posouvá, dokud mapa nevyjde v rozumném pásmu pevniny - samotný
 * noise dává jednou skoro prázdný oceán a podruhé souvislý kontinent.
 */
export function buildWorld({ seed = 1, cols, rows, islands = 2, props = true }) {
  const preset = ISLAND_PRESETS[Math.max(0, Math.min(ISLAND_PRESETS.length - 1, islands))];
  const terrains = TERRAINS.map((t, i) => ({
    ...t,
    threshold: [0, preset.sand, preset.grass][i],
  }));

  // Vysoká frekvence noise a jen mírný falloff dávají souostroví; jeden
  // velký kontinent uprostřed by z bitvy udělal objíždění překážky.
  let map = null;
  let navigable = [];
  let best = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    const s = (seed + attempt * 7919) >>> 0;
    map = generateMap({
      seed: s, width: cols, height: rows, terrains,
      falloff: 0.10, scale: 0.30, minIslandSize: 3, minLakeSize: 40,
    });
    forceWaterBorder(map, 2);
    removeSmallIslands(map, 3);
    fillSmallLakes(map, 40, terrains);
    smoothDiagonals(map);
    navigable = keepLargestWater(map);

    const frac = landFraction(map);
    if (preset.target === 0) break;

    // Splavná plocha musí zůstat velká, jinak se lodě nemají kde potkat.
    const sailable = navigable.length > map.cells.length * 0.45;
    const scoreOff = Math.abs(frac - preset.target);
    if (sailable && (!best || scoreOff < best.off)) {
      best = { cells: map.cells.slice(), navigable, off: scoreOff };
    }
    if (sailable && scoreOff <= 0.06 && islandCount(map) >= preset.minIslands) break;
  }
  // Když se do limitu pokusů nic ideálního netrefilo, použije se nejbližší.
  if (best && Math.abs(landFraction(map) - preset.target) > best.off) {
    map.cells.set(best.cells);
    navigable = best.navigable;
  }

  const propItems = props
    ? generateProps(map, terrains, { seed, propsEnabled: true, propDensity: 0.9 })
    : [];

  let offscreen;
  if (waterImage) {
    // Vlastní textura moře: vodní vrstva generátoru se vynechá (atlas null)
    // a terén se složí nad dlážděným pozadím z pics/water.png.
    const sea = document.createElement('canvas');
    sea.width = map.w * TILE_SIZE;
    sea.height = map.h * TILE_SIZE;
    const sctx = sea.getContext('2d');
    sctx.fillStyle = sctx.createPattern(waterImage, 'repeat');
    sctx.fillRect(0, 0, sea.width, sea.height);
    const land = renderToOffscreen(map, [null, ...atlases.slice(1)], terrains,
      { items: propItems, sprites: propSprites });
    sctx.drawImage(land, 0, 0);
    offscreen = sea;
  } else {
    offscreen = renderToOffscreen(map, atlases, terrains,
      { items: propItems, sprites: propSprites });
  }

  return new World(map, offscreen, buildSDF(map), navigable);
}
