/**
 * render.js — dual grid vykreslení do offscreen canvasu + blit do viditelného.
 *
 * DUAL GRID:
 *   Renderovací mřížka je posunutá o půl dlaždice (-32 px v obou osách)
 *   proti logické a má rozměr (W+1) × (H+1).
 *   Render-dlaždice [rx, ry] leží na pixelu (rx*64 - 32, ry*64 - 32)
 *   a vzorkuje 4 logické buňky, které se stýkají v jejím STŘEDU:
 *     TL = (rx-1, ry-1)   TR = (rx, ry-1)
 *     BL = (rx-1, ry  )   BR = (rx, ry  )
 *   Vzorkování mimo mapu vrací nejnižší terén (voda).
 *   Seamlessnost je důsledkem této konstrukce, nikoli ručního kreslení.
 */

import { TILE_SIZE, TERRAINS } from './terrain.js';
import { drawProps } from './props.js';

/** Spočítá 4-bitovou masku pro vrstvu terénu T. TL=8, TR=4, BR=2, BL=1. */
export function cornerMask(map, rx, ry, T) {
  const tl = map.get(rx - 1, ry - 1);
  const tr = map.get(rx, ry - 1);
  const br = map.get(rx, ry);
  const bl = map.get(rx - 1, ry);
  return (tl >= T ? 8 : 0) | (tr >= T ? 4 : 0) | (br >= T ? 2 : 0) | (bl >= T ? 1 : 0);
}

/** Nejvyšší terén vyskytující se ve 4 rozích render-dlaždice. */
export function topTerrain(map, rx, ry) {
  return Math.max(
    map.get(rx - 1, ry - 1),
    map.get(rx, ry - 1),
    map.get(rx, ry),
    map.get(rx - 1, ry)
  );
}

/**
 * Vykreslí celou mapu do jednoho offscreen canvasu (W*64 × H*64).
 * Volá se pouze při změně mapy, tilesetu nebo objektů.
 *
 * @param {object|null} props { items, sprites } z props.js — dekorace se
 *        kreslí až nad hotovým terénem, seřazené podle y.
 */
export function renderToOffscreen(map, atlases, terrains = TERRAINS, props = null) {
  const S = TILE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = map.w * S;
  canvas.height = map.h * S;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const RW = map.w + 1;
  const RH = map.h + 1;

  // Vrstvení odspodu nahoru: každý terén má JEDINOU sadu dlaždic,
  // vyjadřující přechod vůči všemu pod sebou. Nejnižší terén vychází
  // vždy na masku 1111 => plná výplň pozadí.
  for (let T = 0; T < terrains.length; T++) {
    const atlas = atlases[T];
    if (!atlas) continue;
    for (let ry = 0; ry < RH; ry++) {
      for (let rx = 0; rx < RW; rx++) {
        const mask = cornerMask(map, rx, ry, T);
        const tile = atlas[mask];
        if (!tile) continue;
        ctx.drawImage(tile, rx * S - S / 2, ry * S - S / 2);
      }
    }
  }

  // Dekorace nad terénem (trsy trávy, stromy, kameny, klády…).
  if (props && props.items && props.sprites) {
    drawProps(ctx, props.items, props.sprites);
  }
  return canvas;
}

/** Vykreslí výřez offscreenu do viditelného canvasu podle view {x, y, zoom}. */
export function blit(ctx, offscreen, view) {
  const c = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#11161c';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(view.zoom, 0, 0, view.zoom, view.x, view.y);
  ctx.drawImage(offscreen, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * Debug overlay — kreslí se přes blit, ve stejné transformaci.
 * flags: { logical, renderGrid, masks }
 */
export function drawDebug(ctx, map, view, flags) {
  if (!flags.logical && !flags.renderGrid && !flags.masks) return;
  const S = TILE_SIZE;
  ctx.save();
  ctx.setTransform(view.zoom, 0, 0, view.zoom, view.x, view.y);

  if (flags.logical) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1 / view.zoom;
    ctx.beginPath();
    for (let x = 0; x <= map.w; x++) {
      ctx.moveTo(x * S, 0);
      ctx.lineTo(x * S, map.h * S);
    }
    for (let y = 0; y <= map.h; y++) {
      ctx.moveTo(0, y * S);
      ctx.lineTo(map.w * S, y * S);
    }
    ctx.stroke();
  }

  if (flags.renderGrid) {
    ctx.strokeStyle = 'rgba(255,90,90,0.6)';
    ctx.lineWidth = 1 / view.zoom;
    ctx.beginPath();
    for (let x = 0; x <= map.w + 1; x++) {
      ctx.moveTo(x * S - S / 2, -S / 2);
      ctx.lineTo(x * S - S / 2, (map.h + 1) * S - S / 2);
    }
    for (let y = 0; y <= map.h + 1; y++) {
      ctx.moveTo(-S / 2, y * S - S / 2);
      ctx.lineTo((map.w + 1) * S - S / 2, y * S - S / 2);
    }
    ctx.stroke();
  }

  if (flags.masks) {
    // Zobrazuje masku NEJVYŠŠÍHO terénu přítomného v rozích dané render-dlaždice.
    // Dlaždice, kde je jen nejnižší terén (voda), se vynechávají — jejich maska
    // je vždy 1111 a jen by zaplnily obrazovku.
    ctx.font = `${Math.round(S / 4)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let ry = 0; ry <= map.h; ry++) {
      for (let rx = 0; rx <= map.w; rx++) {
        const T = topTerrain(map, rx, ry);
        if (T === 0) continue;
        const mask = cornerMask(map, rx, ry, T);
        const cx = rx * S;
        const cy = ry * S;
        const label = mask.toString(2).padStart(4, '0');
        ctx.lineWidth = 3 / view.zoom;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(label, cx, cy);
        ctx.fillStyle = '#ffe9a8';
        ctx.fillText(label, cx, cy);
      }
    }
  }
  ctx.restore();
}
