/* Modelář 3D – trojúhelníkové sítě (bez DOM, jde v node).
   Síť = { poz: Float32Array [x,y,z,…], idx: Uint32Array [a,b,c,…] },
   trojúhelníky proti směru hodinových ručiček při pohledu zvenku.
   Tady jsou: svaření vrcholů, kontrola vodotěsnosti, objem, obálka,
   otočení orientace a příprava geometrie pro zobrazení (normály se zlomem). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  /** Sestaví síť ze seznamu bodů [[x,y,z],…] a trojúhelníků [[a,b,c],…];
      shodné body (na 1e-9 mm) svaří a vyhodí zdegenerované trojúhelníky. */
  M.sestavSit = function (body, troj) {
    const mapa = new Map(), poz = [], preklad = new Int32Array(body.length);
    const q = v => Math.round(v * 1e9) / 1e9;
    for (let i = 0; i < body.length; i++) {
      const [x, y, z] = body[i];
      const k = q(x) + ',' + q(y) + ',' + q(z);
      let j = mapa.get(k);
      if (j === undefined) { j = poz.length / 3; mapa.set(k, j); poz.push(x, y, z); }
      preklad[i] = j;
    }
    const idx = [];
    for (const [a, b, c] of troj) {
      const A = preklad[a], B = preklad[b], C = preklad[c];
      if (A !== B && B !== C && A !== C) idx.push(A, B, C);
    }
    return { poz: new Float32Array(poz), idx: new Uint32Array(idx) };
  };

  /** Svaří vrcholy ploché sítě (poz po trojicích, idx volitelné) s tolerancí tol
      a vyhodí zdegenerované trojúhelníky. Rychlejší než sestavSit pro velké importy.
      zachovane (pole) dostane původní indexy ponechaných trojúhelníků (kvůli barvám). */
  M.svarSit = function (poz, idx = null, tol = 1e-5, zachovane = null) {
    const n = idx ? idx.length : poz.length / 3;
    const mapa = new Map(), nove = [], preklad = new Int32Array(poz.length / 3).fill(-1);
    const q = v => Math.round(v / tol);
    for (let i = 0; i < poz.length / 3; i++) {
      const k = q(poz[i * 3]) + ',' + q(poz[i * 3 + 1]) + ',' + q(poz[i * 3 + 2]);
      let j = mapa.get(k);
      if (j === undefined) { j = nove.length / 3; mapa.set(k, j); nove.push(poz[i * 3], poz[i * 3 + 1], poz[i * 3 + 2]); }
      preklad[i] = j;
    }
    const out = [];
    for (let t = 0; t < n; t += 3) {
      const a = preklad[idx ? idx[t] : t], b = preklad[idx ? idx[t + 1] : t + 1], c = preklad[idx ? idx[t + 2] : t + 2];
      if (a !== b && b !== c && a !== c) { out.push(a, b, c); if (zachovane) zachovane.push(t / 3); }
    }
    return { poz: new Float32Array(nove), idx: new Uint32Array(out) };
  };

  /** Síť převedená maticí (THREE.Matrix4); při záporném determinantu otočí stěny. */
  M.prevedSit = function (s, matice) {
    const e = matice.elements, p = s.poz, o = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 3)
      for (let k = 0; k < 3; k++) o[i + k] = e[k] * p[i] + e[4 + k] * p[i + 1] + e[8 + k] * p[i + 2] + e[12 + k];
    const idx = new Uint32Array(s.idx);
    if (matice.determinant() < 0) for (let i = 0; i < idx.length; i += 3) { const x = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = x; }
    return { poz: o, idx };
  };

  /** Spojí více sítí do jedné (bez svařování). */
  M.spojSite = function (site) {
    const nv = site.reduce((s, x) => s + x.poz.length, 0), nt = site.reduce((s, x) => s + x.idx.length, 0);
    const poz = new Float32Array(nv), idx = new Uint32Array(nt);
    let ov = 0, ot = 0;
    for (const x of site) {
      poz.set(x.poz, ov);
      for (let i = 0; i < x.idx.length; i++) idx[ot + i] = x.idx[i] + ov / 3;
      ov += x.poz.length; ot += x.idx.length;
    }
    return { poz, idx };
  };

  /** Objem uzavřené sítě (kladný, je-li orientovaná ven). */
  M.objemSite = function (s) {
    const p = s.poz, t = s.idx;
    let v = 0;
    for (let i = 0; i < t.length; i += 3) {
      const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
      v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
         - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
         + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    }
    return v / 6;
  };

  /** Otočí orientaci všech trojúhelníků (na místě). */
  M.otocOrientaci = function (s) {
    const t = s.idx;
    for (let i = 0; i < t.length; i += 3) { const x = t[i + 1]; t[i + 1] = t[i + 2]; t[i + 2] = x; }
    return s;
  };

  /** Zajistí orientaci ven (kladný objem). */
  M.orientujVen = function (s) {
    if (M.objemSite(s) < 0) M.otocOrientaci(s);
    return s;
  };

  /** Obálka sítě {min:[x,y,z], max:[x,y,z]}. */
  M.obalkaSite = function (s) {
    const p = s.poz, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3)
      for (let k = 0; k < 3; k++) { if (p[i + k] < min[k]) min[k] = p[i + k]; if (p[i + k] > max[k]) max[k] = p[i + k]; }
    return { min, max };
  };

  /** Kontrola: vodotěsnost (každá orientovaná hrana právě jednou a její
      protějšek právě jednou), zdegenerované trojúhelníky, objem. */
  M.zkontrolujSit = function (s) {
    const hrany = new Map(), n = s.poz.length / 3;
    let spatnych = 0, degen = 0;
    const p = s.poz, t = s.idx;
    for (let i = 0; i < t.length; i += 3) {
      const tr = [t[i], t[i + 1], t[i + 2]];
      if (tr[0] === tr[1] || tr[1] === tr[2] || tr[0] === tr[2]) degen++;
      // plocha
      const [a, b, c] = tr.map(j => j * 3);
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const pl = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      if (pl < 1e-12) degen++;
      for (let k = 0; k < 3; k++) {
        const key = tr[k] * n + tr[(k + 1) % 3];
        hrany.set(key, (hrany.get(key) || 0) + 1);
      }
    }
    for (const [key, pocet] of hrany) {
      const a = Math.floor(key / n), b = key % n;
      if (pocet !== 1 || hrany.get(b * n + a) !== 1) spatnych++;
    }
    return { vodotesna: spatnych === 0, spatnychHran: spatnych, degenerovanych: degen,
             objem: M.objemSite(s), trojuhelniku: t.length / 3, vrcholu: n };
  };

  /** Geometrie pro three.js: neindexovaná, normály průměrované jen přes
      sousední stěny svírající méně než `uhel` stupňů (ostré hrany zůstanou ostré). */
  M.geometrieProZobrazeni = function (s, uhel = 30) {
    const p = s.poz, t = s.idx, nt = t.length / 3;
    const fn = new Float32Array(t.length);         // normála stěny (nenormovaná = vážená plochou)
    // vrchol → trojúhelníky kolem něj jako plochá pole (CSR): začátek[v] … začátek[v+1] v seznamu
    const nv = p.length / 3, zacatek = new Uint32Array(nv + 1);
    for (let i = 0; i < t.length; i++) zacatek[t[i] + 1]++;
    for (let v = 0; v < nv; v++) zacatek[v + 1] += zacatek[v];
    const seznam = new Uint32Array(t.length), plneni = zacatek.slice(0, nv);
    for (let f = 0; f < nt; f++) {
      const a = t[f * 3] * 3, b = t[f * 3 + 1] * 3, c = t[f * 3 + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      fn[f * 3] = uy * vz - uz * vy; fn[f * 3 + 1] = uz * vx - ux * vz; fn[f * 3 + 2] = ux * vy - uy * vx;
      for (let k = 0; k < 3; k++) seznam[plneni[t[f * 3 + k]]++] = f;
    }
    const jedn = new Float32Array(t.length);
    for (let f = 0; f < nt; f++) {
      const x = fn[f * 3], y = fn[f * 3 + 1], z = fn[f * 3 + 2], d = Math.hypot(x, y, z) || 1;
      jedn[f * 3] = x / d; jedn[f * 3 + 1] = y / d; jedn[f * 3 + 2] = z / d;
    }
    const prah = Math.cos(uhel * Math.PI / 180);
    const pozice = new Float32Array(t.length * 3), normaly = new Float32Array(t.length * 3);
    for (let f = 0; f < nt; f++) {
      for (let k = 0; k < 3; k++) {
        const v = t[f * 3 + k], o = (f * 3 + k) * 3;
        pozice[o] = p[v * 3]; pozice[o + 1] = p[v * 3 + 1]; pozice[o + 2] = p[v * 3 + 2];
        let nx = 0, ny = 0, nz = 0;
        for (let q = zacatek[v], konec = zacatek[v + 1]; q < konec; q++) {
          const g = seznam[q];
          if (jedn[f * 3] * jedn[g * 3] + jedn[f * 3 + 1] * jedn[g * 3 + 1] + jedn[f * 3 + 2] * jedn[g * 3 + 2] >= prah) {
            nx += fn[g * 3]; ny += fn[g * 3 + 1]; nz += fn[g * 3 + 2];
          }
        }
        const d = Math.hypot(nx, ny, nz) || 1;
        normaly[o] = nx / d; normaly[o + 1] = ny / d; normaly[o + 2] = nz / d;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pozice, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(normaly, 3));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  };

  const SMER_PAPRSKU = [1, 0.000123, 0.000071];
  /** Protne paprsek z q ve směru SMER_PAPRSKU trojúhelník (indexy od i v idx) před sebou? */
  function protinaPaprsek(p, t, i, q) {
    const d = SMER_PAPRSKU, a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
    const e10 = p[b] - p[a], e11 = p[b + 1] - p[a + 1], e12 = p[b + 2] - p[a + 2], e20 = p[c] - p[a], e21 = p[c + 1] - p[a + 1], e22 = p[c + 2] - p[a + 2];
    const h0 = d[1] * e22 - d[2] * e21, h1 = d[2] * e20 - d[0] * e22, h2 = d[0] * e21 - d[1] * e20;
    const det = e10 * h0 + e11 * h1 + e12 * h2;
    if (Math.abs(det) < 1e-14) return false;
    const f = 1 / det, s0 = q[0] - p[a], s1 = q[1] - p[a + 1], s2 = q[2] - p[a + 2];
    const u = f * (s0 * h0 + s1 * h1 + s2 * h2);
    if (u < 0 || u > 1) return false;
    const q0 = s1 * e12 - s2 * e11, q1 = s2 * e10 - s0 * e12, q2 = s0 * e11 - s1 * e10;
    const v = f * (d[0] * q0 + d[1] * q1 + d[2] * q2);
    if (v < 0 || u + v > 1) return false;
    return f * (e20 * q0 + e21 * q1 + e22 * q2) > 0;
  }

  /** Leží bod uvnitř uzavřené sítě? Paprsek ve směru +X (mírně šikmo, ať netrefí hranu) a sudost průsečíků. */
  M.bodVSiti = function (sit, q) {
    const p = sit.poz, t = sit.idx;
    let n = 0;
    for (let i = 0; i < t.length; i += 3) if (protinaPaprsek(p, t, i, q)) n++;
    return n % 2 === 1;
  };

  /** Rychlý test „bod uvnitř“ pro mnoho dotazů nad jednou sítí: mřížka trojúhelníků v rovině Y–Z (paprsek
      jde skoro podél X, takže stačí trojúhelníky z buňky dotazu; obálky rozšířené o odklon paprsku).
      Vrací funkci q → boolean, se stejným výsledkem jako M.bodVSiti. */
  M.indexBodVSiti = function (sit) {
    const p = sit.poz, t = sit.idx, nt = t.length / 3;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]);
    }
    if (!(nt > 0) || !isFinite(x0)) return () => false;
    // paprsek z bodu uvnitř obálky se po délce X odkloní o nejvýš (x1 − x0) · 0,000123
    const okraj = (x1 - x0 + (y1 - y0) + (z1 - z0)) * 2.5e-4 + 1e-6;
    y0 -= okraj; y1 += okraj; z0 -= okraj; z1 += okraj;
    const G = Math.max(4, Math.min(256, Math.round(Math.sqrt(nt / 3)))), sy = (y1 - y0) / G || 1, sz = (z1 - z0) / G || 1;
    const bunky = Array.from({ length: G * G }, () => []);
    const bunka = (v, v0, s) => Math.max(0, Math.min(G - 1, Math.floor((v - v0) / s)));
    for (let i = 0; i < t.length; i += 3) {
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (let k = 0; k < 3; k++) { const y = p[t[i + k] * 3 + 1], z = p[t[i + k] * 3 + 2]; a0 = Math.min(a0, y); a1 = Math.max(a1, y); b0 = Math.min(b0, z); b1 = Math.max(b1, z); }
      const i0 = bunka(a0 - okraj, y0, sy), i1 = bunka(a1 + okraj, y0, sy), j0 = bunka(b0 - okraj, z0, sz), j1 = bunka(b1 + okraj, z0, sz);
      for (let a = i0; a <= i1; a++) for (let b = j0; b <= j1; b++) bunky[a * G + b].push(i);
    }
    return q => {
      // bod daleko vlevo od sítě: posunout po paprsku k obálce (před ní žádný trojúhelník není, odklon by jinak
      // vyjel z buňky)
      if (q[0] < x0 - okraj) { const t = x0 - okraj - q[0]; q = [x0 - okraj, q[1] + SMER_PAPRSKU[1] * t, q[2] + SMER_PAPRSKU[2] * t]; }
      if (q[1] < y0 || q[1] > y1 || q[2] < z0 || q[2] > z1 || q[0] > x1 + okraj) return false;
      const sez = bunky[bunka(q[1], y0, sy) * G + bunka(q[2], z0, sz)];
      let n = 0;
      for (const i of sez) if (protinaPaprsek(p, t, i, q)) n++;
      return n % 2 === 1;
    };
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
