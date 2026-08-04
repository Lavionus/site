/**
 * terrain.js — definice terénů a jejich priorit.
 *
 * Pole TERRAINS je seřazené podle priority ZEZDOLA NAHORU:
 * index 0 = nejnižší priorita (kreslí se jako plné pozadí),
 * index n = nejvyšší priorita (kreslí se naposledy, přes všechno ostatní).
 *
 * PŘIDÁNÍ NOVÉHO TERÉNU:
 *   Stačí vložit jednu položku do tohoto pole (na správné místo podle priority)
 *   a případně doplnit cestu k PNG dlaždicím (`tileset`). Nic jiného se nemění —
 *   generátor mapy, výběr dlaždic i renderer jsou plně datově řízené.
 *
 * Položka:
 *   id         — interní identifikátor
 *   name       — popisek do UI
 *   threshold  — minimální výška (0..1) z noise, od které tento terén platí.
 *                Terén buňky = poslední terén v poli, jehož threshold <= výška.
 *                Terén 0 musí mít threshold 0 (fallback).
 *   color      — základní barva pro procedurální placeholder dlaždice
 *   accent     — barva jemné statické textury placeholderu
 *   tileset    — cesta k PNG 384×64 (6 dlaždic vedle sebe) nebo null
 *                => null znamená "vygeneruj placeholder procedurálně".
 */

export const TERRAINS = [
  {
    id: 'WATER',
    name: 'Voda',
    threshold: 0.00,
    color: '#2b6ca3',
    accent: '#3d86c2',
    tileset: null,
  },
  {
    id: 'SAND',
    name: 'Písek',
    threshold: 0.40,
    color: '#d9c48a',
    accent: '#c7ae70',
    tileset: null,
  },
  {
    id: 'GRASS',
    name: 'Tráva',
    threshold: 0.50,
    color: '#5d9a4a',
    accent: '#4d8340',
    tileset: null,
  },
  // Příklad rozšíření — stačí odkomentovat:
  // { id: 'ROCK', name: 'Skála', threshold: 0.72, color: '#8a8a8f', accent: '#74747a', tileset: null },
  // { id: 'SNOW', name: 'Sníh',  threshold: 0.86, color: '#e8eef2', accent: '#d2dde4', tileset: null },
];

/** Index nejnižšího terénu — používá se jako clamp mimo mapu i jako pozadí. */
export const BASE_TERRAIN = 0;

export const TILE_SIZE = 64;

/** Počet autorských tvarů v jedné sadě (šířka PNG = SHAPE_COUNT * TILE_SIZE). */
export const SHAPE_COUNT = 6;

/** Převod výšky (0..1) na index terénu podle thresholdů. */
export function heightToTerrain(h, terrains = TERRAINS) {
  let t = 0;
  for (let i = 1; i < terrains.length; i++) {
    if (h >= terrains[i].threshold) t = i;
    else break;
  }
  return t;
}
