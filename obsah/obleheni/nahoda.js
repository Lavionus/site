/* Ostrov v obležení – seedovaná náhoda a šum.
   mulberry32 jako v Tower Defense a Trosečnících. Logika hry smí brát náhodu jen odsud,
   nikdy z Math.random – jinak by stejný seed nedal stejnou hru. */
(function (OBL) {
  'use strict';

  function mulberry32(seed) {
    let s = seed >>> 0;
    const f = () => {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    f.stav = () => s;
    f.nastav = v => { s = v | 0; };
    return f;
  }

  // odvozený seed: z hlavního seedu a značky (řetězec nebo číslo) – nezávislé proudy náhody
  function hash(...casti) {
    let h = 2166136261 >>> 0;
    for (const c of casti) {
      const s = String(c);
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      h ^= 0x9e37; h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function Nahoda(seed) {
    const r = mulberry32(seed);
    return {
      f: r,
      cele: (a, b) => a + Math.floor(r() * (b - a + 1)),      // celé číslo a..b včetně
      vyber: arr => arr[Math.floor(r() * arr.length)],
      sance: p => r() < p,
      rozsah: (a, b) => a + r() * (b - a),
      zamichej(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
      vazene(par) { // [[hodnota, váha], …]
        let t = 0; for (const p of par) t += p[1];
        let x = r() * t;
        for (const p of par) { x -= p[1]; if (x < 0) return p[0]; }
        return par[par.length - 1][0];
      },
      stav: () => r.stav(),
      nastav: v => r.nastav(v),
    };
  }

  // hodnotový šum na mřížce s hladkou interpolací; perioda není potřeba (mapa je malá)
  function sum2D(seed) {
    const cache = new Map();
    const hodnota = (x, y) => {
      const k = x * 73856093 ^ y * 19349663;
      let v = cache.get(k);
      if (v === undefined) { v = (hash(seed, x, y) % 100000) / 100000; cache.set(k, v); }
      return v;
    };
    const hladka = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = hladka(x - x0), fy = hladka(y - y0);
      const a = hodnota(x0, y0), b = hodnota(x0 + 1, y0), c = hodnota(x0, y0 + 1), d = hodnota(x0 + 1, y0 + 1);
      return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
    };
  }

  function fbm(seed, oktav) {
    const vrstvy = [];
    for (let i = 0; i < oktav; i++) vrstvy.push(sum2D(hash(seed, 'okt', i)));
    return (x, y) => {
      let s = 0, a = 1, f = 1, n = 0;
      for (let i = 0; i < oktav; i++) { s += vrstvy[i](x * f, y * f) * a; n += a; a *= 0.5; f *= 2; }
      return s / n;
    };
  }

  // šestimístný kód seedu pro hráče (bez zaměnitelných znaků)
  const ABECEDA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function kodSeedu(seed) {
    let s = seed >>> 0, k = '';
    for (let i = 0; i < 6; i++) { k += ABECEDA[s % 32]; s = Math.floor(s / 32); }
    return k;
  }
  function seedZKodu(kod) {
    kod = String(kod || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!kod) return null;
    let s = 0, platny = kod.length === 6;
    for (let i = 5; i >= 0 && platny; i--) {
      const j = ABECEDA.indexOf(kod[i]);
      if (j < 0) platny = false; else s = s * 32 + j;
    }
    return platny ? s >>> 0 : hash('kod', kod) % 1073741824; // libovolný text = jiný ostrov
  }
  const seedDne = d => hash('ostrov-dne', d.getFullYear(), d.getMonth() + 1, d.getDate()) % 1073741824;

  OBL.mulberry32 = mulberry32;
  OBL.hash = hash;
  OBL.Nahoda = Nahoda;
  OBL.fbm = fbm;
  OBL.kodSeedu = kodSeedu;
  OBL.seedZKodu = seedZKodu;
  OBL.seedDne = seedDne;
})(globalThis.OBL = globalThis.OBL || {});
