// Nad krajinou — seedovaná náhoda. Běží v prohlížeči, ve Workeru i v node.
(function (D) {
  'use strict';

  // řetězec nebo číslo → 32bit seed
  function seedZ(s) {
    if (typeof s === 'number') return s >>> 0;
    let h = 2166136261 >>> 0;
    for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }

  // mulberry32: rychlý, dost dobrý pro generování krajiny
  function Nahoda(seed) {
    let a = seedZ(seed) || 1;
    const r = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.mezi = (a0, b0) => a0 + (b0 - a0) * r();
    r.cele = (a0, b0) => Math.floor(a0 + (b0 - a0 + 1) * r());       // včetně b0
    r.vyber = pole => pole[Math.floor(r() * pole.length)];
    r.gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v); };
    r.stav = () => a;
    return r;
  }

  // bezstavový hash dvou celých čísel → 0..1 (pro rozmisťování podle buněk mřížky)
  function hash2(x, y, seed) {
    let h = (seed | 0) ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  D.Nahoda = Nahoda;
  D.seedZ = seedZ;
  D.hash2 = hash2;
})(globalThis.DRON = globalThis.DRON || {});
