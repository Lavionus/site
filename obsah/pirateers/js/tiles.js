/**
 * tiles.js — lookup tabulka marching squares, načtení/generování tilesetu
 * a předgenerování rotací do offscreen atlasu.
 */

import { TILE_SIZE, SHAPE_COUNT } from './terrain.js';
import { makePRNG } from './noise.js';

/* ------------------------------------------------------------------ */
/* Autorské tvary — pořadí v PNG (384 × 64, 6 dlaždic vedle sebe)      */
/* ------------------------------------------------------------------ */

export const SHAPE = {
  FULL: 0,   // plná výplň
  EDGE: 1,   // rovná hrana
  OUTER: 2,  // vnější roh
  INNER: 3,  // vnitřní roh
  DIAG: 4,   // diagonála
  EMPTY: 5,  // prázdná
};

/**
 * ===================================================================
 *  LOOKUP TABULKA — corner-based / marching squares
 * ===================================================================
 *
 * Pro každou render-dlaždici a každou vrstvu terénu T se spočítá 4-bitová
 * maska ze 4 logických buněk, které se stýkají ve STŘEDU render-dlaždice.
 * Bit = 1, pokud priorita (index terénu) daného rohu >= T.
 *
 * BITOVÉ POŘADÍ:
 *      TL = 8 (0b1000)      TR = 4 (0b0100)
 *      BL = 1 (0b0001)      BR = 2 (0b0010)
 *
 *   maska = TL*8 | TR*4 | BR*2 | BL*1        (rozsah 0..15)
 *
 * REFERENČNÍ ORIENTACE AUTORSKÝCH DLAŽDIC (rotace 0°) — jednoznačně:
 *   FULL   (mask 1111) — celá dlaždice je "země".
 *   EDGE   (mask 0011) — země je DOLNÍ polovina dlaždice,
 *                        vodorovná hrana uprostřed; nahoře je "nic".
 *   OUTER  (mask 0001) — země je pouze roh VLEVO DOLE (konvexní roh).
 *   INNER  (mask 0111) — země je všude KROMĚ rohu VLEVO NAHOŘE (konkávní roh).
 *   DIAG   (mask 0101) — země je vpravo nahoře a vlevo dole.
 *   EMPTY  (mask 0000) — nekreslí se vůbec.
 *
 * ROTACE je vždy PO SMĚRU hodinových ručiček, ve stupních (0/90/180/270).
 * Rotace o 90° CW posouvá rohy: TL→TR→BR→BL→TL.
 * Odtud plyne celá tabulka níže (16 položek, žádné podmínky v kódu).
 *
 * Maska 0101 / 1010 (protilehlé rohy) je nejednoznačná — řeší se
 * deterministicky parametrem `connectDiagonals` pro celou mapu:
 *   false → nakreslí se tvar DIAG (rohy zůstanou oddělené)
 *   true  → nakreslí se FULL (rohy se propojí)
 * Nikdy náhodně. Položky s příznakem `ambiguous` jsou právě tyto dvě.
 */
export const MASK_LOOKUP = [
  /* 0  0000 */ { shape: SHAPE.EMPTY, rot: 0 },
  /* 1  0001 */ { shape: SHAPE.OUTER, rot: 0 },
  /* 2  0010 */ { shape: SHAPE.OUTER, rot: 270 },
  /* 3  0011 */ { shape: SHAPE.EDGE, rot: 0 },
  /* 4  0100 */ { shape: SHAPE.OUTER, rot: 180 },
  /* 5  0101 */ { shape: SHAPE.DIAG, rot: 0, ambiguous: true },
  /* 6  0110 */ { shape: SHAPE.EDGE, rot: 270 },
  /* 7  0111 */ { shape: SHAPE.INNER, rot: 0 },
  /* 8  1000 */ { shape: SHAPE.OUTER, rot: 90 },
  /* 9  1001 */ { shape: SHAPE.EDGE, rot: 90 },
  /* 10 1010 */ { shape: SHAPE.DIAG, rot: 90, ambiguous: true },
  /* 11 1011 */ { shape: SHAPE.INNER, rot: 90 },
  /* 12 1100 */ { shape: SHAPE.EDGE, rot: 180 },
  /* 13 1101 */ { shape: SHAPE.INNER, rot: 180 },
  /* 14 1110 */ { shape: SHAPE.INNER, rot: 270 },
  /* 15 1111 */ { shape: SHAPE.FULL, rot: 0 },
];

/* ------------------------------------------------------------------ */
/* Procedurální placeholder sada                                       */
/* ------------------------------------------------------------------ */

/** Cesta tvaru v referenční orientaci (0°) do ctx, dlaždice S×S. */
function shapePath(ctx, shape, S) {
  const H = S / 2;
  ctx.beginPath();
  switch (shape) {
    case SHAPE.FULL:
      ctx.rect(0, 0, S, S);
      break;
    case SHAPE.EDGE:
      ctx.rect(0, H, S, H);
      break;
    case SHAPE.OUTER:
      // konvexní čtvrtkruh v rohu vlevo dole
      ctx.moveTo(0, H);
      ctx.arc(0, S, H, -Math.PI / 2, 0, false);
      ctx.lineTo(0, S);
      ctx.closePath();
      break;
    case SHAPE.INNER:
      // celá dlaždice bez konkávního čtvrtkruhu vlevo nahoře
      ctx.moveTo(0, H);
      ctx.arc(0, 0, H, Math.PI / 2, 0, true);
      ctx.lineTo(S, 0);
      ctx.lineTo(S, S);
      ctx.lineTo(0, S);
      ctx.closePath();
      break;
    case SHAPE.DIAG:
      ctx.rect(H, 0, H, H);
      ctx.rect(0, H, H, H);
      break;
    case SHAPE.EMPTY:
    default:
      break;
  }
}

/**
 * Pouze hranice terénu uvnitř dlaždice (bez okrajů dlaždice).
 * Používá se pro zvýraznění pobřeží v placeholder sadě.
 */
function boundaryPath(ctx, shape, S) {
  const H = S / 2;
  ctx.beginPath();
  switch (shape) {
    case SHAPE.EDGE:
      ctx.moveTo(0, H);
      ctx.lineTo(S, H);
      break;
    case SHAPE.OUTER:
      ctx.arc(0, S, H, -Math.PI / 2, 0, false);
      break;
    case SHAPE.INNER:
      ctx.arc(0, 0, H, Math.PI / 2, 0, true);
      break;
    case SHAPE.DIAG:
      ctx.moveTo(H, 0);
      ctx.lineTo(H, H);
      ctx.lineTo(S, H);
      ctx.moveTo(0, H);
      ctx.lineTo(H, H);
      ctx.lineTo(H, S);
      break;
    default:
      break;
  }
}

/**
 * Vygeneruje placeholder tileset (canvas 384×64) pro jeden terén:
 * plné barvy + korektní tvary masek + statická deterministická textura.
 */
export function makePlaceholderTileset(terrain, terrainIndex) {
  const S = TILE_SIZE;
  const sheet = document.createElement('canvas');
  sheet.width = S * SHAPE_COUNT;
  sheet.height = S;
  const sctx = sheet.getContext('2d');

  const tmp = document.createElement('canvas');
  tmp.width = S;
  tmp.height = S;
  const tctx = tmp.getContext('2d');

  for (let shape = 0; shape < SHAPE_COUNT; shape++) {
    tctx.clearRect(0, 0, S, S);
    if (shape === SHAPE.EMPTY) continue;

    // 1) maska tvaru
    tctx.globalCompositeOperation = 'source-over';
    tctx.fillStyle = '#fff';
    shapePath(tctx, shape, S);
    tctx.fill();

    // 2) základní barva pouze uvnitř masky
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = terrain.color;
    tctx.fillRect(0, 0, S, S);

    // 3) statická textura, ořezaná maskou
    tctx.globalCompositeOperation = 'source-atop';
    const rnd = makePRNG(1000 + terrainIndex * 97 + shape * 13);
    tctx.fillStyle = terrain.accent;
    for (let i = 0; i < 90; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 1 + rnd() * 2.2;
      tctx.globalAlpha = 0.25 + rnd() * 0.35;
      tctx.beginPath();
      tctx.arc(x, y, r, 0, Math.PI * 2);
      tctx.fill();
    }
    tctx.globalAlpha = 1;

    // 4) jemné zvýraznění POUZE skutečné hranice terénu
    //    (ne okrajů dlaždice — jinak by v souvislé ploše vznikla mřížka)
    tctx.globalCompositeOperation = 'source-atop';
    tctx.strokeStyle = 'rgba(255,255,255,0.28)';
    tctx.lineWidth = 3;
    boundaryPath(tctx, shape, S);
    tctx.stroke();

    tctx.globalCompositeOperation = 'source-over';
    sctx.drawImage(tmp, shape * S, 0);
  }
  return sheet;
}

/** Načte PNG tileset (384×64). Vrací Promise<HTMLImageElement>. */
export function loadTilesetImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Nelze načíst tileset: ' + path));
    img.src = path;
  });
}

/* ------------------------------------------------------------------ */
/* Předgenerování 16 variant (rotace) do offscreen atlasu              */
/* ------------------------------------------------------------------ */

/**
 * Z jedné autorské sady (6 dlaždic) vyrobí pole 16 hotových canvasů
 * indexovaných maskou. Index 0 (prázdno) je null — nekreslí se.
 * Rotace se provádí JEDNOU zde; při vykreslování mapy už jen drawImage.
 */
export function buildAtlas(source, { connectDiagonals = false } = {}) {
  const S = TILE_SIZE;
  const atlas = new Array(16).fill(null);

  for (let mask = 0; mask < 16; mask++) {
    const entry = MASK_LOOKUP[mask];
    let shape = entry.shape;
    let rot = entry.rot;
    if (entry.ambiguous && connectDiagonals) {
      shape = SHAPE.FULL;
      rot = 0;
    }
    if (shape === SHAPE.EMPTY) continue;

    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.translate(S / 2, S / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(source, shape * S, 0, S, S, -S / 2, -S / 2, S, S);
    atlas[mask] = c;
  }
  return atlas;
}

/**
 * Pro každý terén připraví atlas 16 variant.
 * Terén s `tileset: null` dostane procedurální placeholder.
 */
export async function buildAtlases(terrains, options = {}) {
  const out = [];
  for (let i = 0; i < terrains.length; i++) {
    const t = terrains[i];
    let source;
    if (t.tileset) {
      try {
        source = await loadTilesetImage(t.tileset);
      } catch (e) {
        console.warn(e.message + ' — použit placeholder.');
        source = makePlaceholderTileset(t, i);
      }
    } else {
      source = makePlaceholderTileset(t, i);
    }
    out.push(buildAtlas(source, options));
  }
  return out;
}
