/* Modelář 3D – STL (bez DOM, jde v node).
   Zápis: binární STL (normály z vrcholů, jednotky mm). Čtení: binární
   i textové STL; vrcholy se svaří, aby šla síť použít v booleanech. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  M.stl = {
    /** site: [{poz, idx}] (světové souřadnice) → Uint8Array binárního STL. */
    zapis(site, nazev = 'Modelar 3D') {
      const nt = site.reduce((s, x) => s + x.idx.length / 3, 0);
      const buf = new ArrayBuffer(84 + nt * 50), d = new DataView(buf);
      const hl = new TextEncoder().encode(('Modelar 3D: ' + nazev).normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 79));
      new Uint8Array(buf, 0, 80).set(hl.subarray(0, 80));
      d.setUint32(80, nt, true);
      let o = 84;
      for (const s of site) {
        const p = s.poz, t = s.idx;
        for (let i = 0; i < t.length; i += 3) {
          const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
          const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
          const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
          let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const l = Math.hypot(nx, ny, nz) || 1;
          d.setFloat32(o, nx / l, true); d.setFloat32(o + 4, ny / l, true); d.setFloat32(o + 8, nz / l, true);
          for (const [k, j] of [[0, a], [1, b], [2, c]]) {
            d.setFloat32(o + 12 + k * 12, p[j], true); d.setFloat32(o + 16 + k * 12, p[j + 1], true); d.setFloat32(o + 20 + k * 12, p[j + 2], true);
          }
          d.setUint16(o + 48, 0, true);
          o += 50;
        }
      }
      return new Uint8Array(buf);
    },

    /** Uint8Array (binární nebo textové STL) → svařená síť {poz, idx}. */
    cti(buf) {
      const d = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      // binární: velikost přesně sedí s počtem; jinak rozhodne obsah (textové STL má „facet“ a „vertex“).
      // Binární soubory s výplní na konci nebo špatným počtem (některé exportéry) se čtou podle délky.
      const presne = buf.length >= 84 && 84 + d.getUint32(80, true) * 50 === buf.length;
      const zacatek = new TextDecoder('latin1').decode(buf.subarray(0, Math.min(buf.length, 4096)));
      // textové: začíná „solid“ a v prvních 4 kB není nulový bajt (binární čísla ho skoro vždy mají) – i s dlouhou hlavičkou
      const textove = !presne && /^\s*solid/i.test(zacatek) && !zacatek.includes('\0');
      const binarni = buf.length >= 84 + 50 && (presne || !textove);
      let poz;
      if (binarni) {
        const vejde = Math.floor((buf.length - 84) / 50), udany = d.getUint32(80, true);
        const n = udany > 0 && udany <= vejde ? udany : vejde;
        poz = new Float32Array(n * 9);
        for (let t = 0, o = 84; t < n; t++, o += 50)
          for (let k = 0; k < 9; k++) poz[t * 9 + k] = d.getFloat32(o + 12 + k * 4, true);
      } else {
        const text = new TextDecoder().decode(buf);
        if (!/^\s*solid/i.test(text) && !/vertex/i.test(text)) throw new Error('soubor není STL');
        const cisla = [];
        const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi;     // i „nan“/„inf“ – odmítnou se níž, ne tiše vynechají
        let m;
        while ((m = re.exec(text))) cisla.push(+m[1], +m[2], +m[3]);
        if (cisla.length % 9) throw new Error('poškozené textové STL');
        poz = new Float32Array(cisla);
      }
      if (!poz.length) throw new Error('STL neobsahuje žádné trojúhelníky');
      for (let i = 0; i < poz.length; i++) if (!isFinite(poz[i])) throw new Error('STL obsahuje neplatná čísla');
      return M.svarSit(poz);
    },
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
