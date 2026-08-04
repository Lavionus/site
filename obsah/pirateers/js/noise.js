/**
 * noise.js — seedovaný PRNG + gradientní (Perlin) noise + fBm.
 * Vše je deterministické podle číselného seedu. Math.random se nikde nepoužívá
 * (kromě UI tlačítka "náhodný seed", které jen vyrobí nové číslo).
 */

/** Mulberry32 — rychlý deterministický PRNG. Vrací funkci () => [0,1). */
export function makePRNG(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRAD = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Gradientní noise se seedovanou permutační tabulkou.
 * noise2D(x, y) vrací hodnotu zhruba v rozsahu [-1, 1].
 */
export function makeNoise2D(seed) {
  const rnd = makePRNG(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher–Yates se seedovaným PRNG
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function gradDot(hash, x, y) {
    const g = GRAD[hash & 7];
    return g[0] * x + g[1] * y;
  }

  return function noise2D(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];

    const x1 = lerp(gradDot(aa, xf, yf), gradDot(ba, xf - 1, yf), u);
    const x2 = lerp(gradDot(ab, xf, yf - 1), gradDot(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * fBm — součet oktáv noise.
 * Vrací hodnotu normalizovanou do [0, 1].
 */
export function makeFBM(seed, { octaves = 5, persistence = 0.5, lacunarity = 2.0, scale = 0.06 } = {}) {
  const noise2D = makeNoise2D(seed);
  return function fbm(x, y) {
    let amp = 1;
    let freq = scale;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise2D(x * freq, y * freq) * amp;
      norm += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    const v = norm > 0 ? sum / norm : 0;
    return v * 0.5 + 0.5;
  };
}
