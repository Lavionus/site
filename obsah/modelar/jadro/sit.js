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

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
