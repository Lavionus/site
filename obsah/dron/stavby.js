// Nad krajinou — stavby: vesnice (domy, stodoly, kostel s věží, kaple), rozhledna, posed, balíky sena,
// mosty, ploty a ohrady, elektrické vedení s dráty, závodní branky, startovní plocha s pilotem.
// Vše se slučuje podle materiálu do několika málo meshů (vlastní slučování geometrie, „Stavitel“),
// textury se kreslí procedurálně do canvasu. Smlouva dat je v Dron_PLAN.md › Terén.
(function (D) {
  'use strict';

  // ======================================================================================
  //  Část bez grafiky (běží i v node) — rozměry, které musí sedět s kolizemi (kolize.js)
  // ======================================================================================
  const G = D.STAVBY_GEOM = {};
  G.TL_BRANKY = (D.BRANKA && D.BRANKA.ram) || 0.3;          // tloušťka rámu branky (čtvercový průřez 0.3 × 0.3 m, rám leží VNĚ otvoru)
  G.ZDVIH_BRANKY = (D.BRANKA && D.BRANKA.dole) || 0.3;       // spodní hrana otvoru je b.y + 0.3 (spodní lať leží na zemi) — = BRANKA.dole v kolize.js
  G.PRUMER_DRATU = 0.02;      // průměr vodiče (m) — vykresluje se nejméně 1.3 px široký

  // Kde visí vodiče: [[příčný posun (m, podél lokální x stožáru), výška nad patou], …]. Bere ved.draty
  // ([[dx, dy]] od vrcholu, jako generátor a kolize), jinak výchozí podle výšky sloupu.
  G.uchyceni = function (H, draty) {
    if (!(draty && draty.length) && D.VEDENI) draty = D.VEDENI.draty;          // výchozí z kolize.js
    if (draty && draty.length) return draty.map(d => [d[0], H + d[1]]);
    if (H < 16) return [[-1.5, H - 0.45], [0, H + 0.35], [1.5, H - 0.45]];
    return [[0, H], [-2.6, H - 2.2], [2.6, H - 2.2]];
  };
  // lokální x stožáru j = (tz, −tx) pro jednotkovou tečnu vedení (střední diference sousedů) — shodně s kolize.js
  G.kolmice = function (B, j) {
    const a = B[Math.max(0, j - 1)], b = B[Math.min(B.length - 1, j + 1)];
    const tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz) || 1;
    return [tz / l, -tx / l];
  };

  // Vodiče jednoho vedení jako lomené čáry, body po ~8 m: y(u) = lerp(yA, yB, u) − 4·pruves·u·(1−u),
  // pruves = ved.pruves[i], jinak 0.011 × rozpětí. → [{ body: [[x, y, z], …], r }]
  G.draty = function (ved) {
    const B = ved.body, H = ved.vyskaSloupu || 12, vys = [];
    if (!B || B.length < 2) return vys;
    if (D.bodVodice) {                         // přesně podle kolizí (kolize.js)
      const DR = ved.draty || (D.VEDENI && D.VEDENI.draty) || [[0, 0]];
      for (let k = 0; k < DR.length; k++) {
        const body = [];
        for (let i = 0; i + 1 < B.length; i++) {
          const n = Math.max(2, Math.ceil(Math.hypot(B[i + 1][0] - B[i][0], B[i + 1][2] - B[i][2]) / 8));
          for (let m = (i === 0 ? 0 : 1); m <= n; m++) body.push(D.bodVodice(ved, i, k, m / n, [0, 0, 0]));
        }
        vys.push({ body, r: G.PRUMER_DRATU / 2 });
      }
      return vys;
    }
    const kolm = B.map((p, j) => G.kolmice(B, j));
    for (const [o, h] of G.uchyceni(H, ved.draty)) {
      const body = [];
      for (let i = 0; i + 1 < B.length; i++) {
        const a = B[i], b = B[i + 1], ka = kolm[i], kb = kolm[i + 1];
        const ax = a[0] + ka[0] * o, ay = a[1] + h, az = a[2] + ka[1] * o;
        const bx = b[0] + kb[0] * o, by = b[1] + h, bz = b[2] + kb[1] * o;
        const roz = Math.hypot(bx - ax, bz - az);
        const prov = ved.pruves && ved.pruves[i] != null ? ved.pruves[i] : 0.011 * Math.hypot(b[0] - a[0], b[2] - a[2]);
        const n = Math.max(2, Math.ceil(roz / 8));
        for (let k = (i === 0 ? 0 : 1); k <= n; k++) {
          const t = k / n;
          body.push([ax + (bx - ax) * t, ay + (by - ay) * t - 4 * prov * t * (1 - t), az + (bz - az) * t]);
        }
      }
      vys.push({ body, r: G.PRUMER_DRATU / 2 });
    }
    return vys;
  };

  if (typeof THREE === 'undefined') return;   // node / Worker: dál už jen grafika

  // ======================================================================================
  //  Stavitel — sbírá trojúhelníky jednoho materiálu, na konci z nich udělá BufferGeometry
  // ======================================================================================
  // Atributy: position, normal, uv (metry, textura má repeat), color (lineární odstín),
  // aH = vec2(výška nad terénem v metrech, volná hodnota „x“ — svícení okna / id branky / odbarvení).
  const _v = new THREE.Vector3(), _n = new THREE.Vector3();
  class Stavitel {
    constructor(teren) {
      this.teren = teren;
      this.p = []; this.n = []; this.uv = []; this.c = []; this.a = []; this.i = [];
      this.M = new THREE.Matrix4(); this.N = new THREE.Matrix3();
      this.barva = [1, 1, 1]; this.x = 0; this.uo = 0; this.vo = 0;
    }
    get pocet() { return this.p.length / 3; }
    nastav(M) { this.M.copy(M); this.N.getNormalMatrix(M); return this; }
    sMatici(M, f) {        // dočasně přinásob matici (lokální podsoustava)
      const puv = this.M.clone();
      this.nastav(puv.clone().multiply(M)); f(); this.nastav(puv);
    }
    odstin(c) { if (c.isColor) this.barva = [c.r, c.g, c.b]; else this.barva = c; return this; }
    vrchol(x, y, z, nx, ny, nz, u, v) {
      const w = _v.set(x, y, z).applyMatrix4(this.M);
      this.p.push(w.x, w.y, w.z);
      const nn = _n.set(nx, ny, nz).applyMatrix3(this.N).normalize();
      this.n.push(nn.x, nn.y, nn.z);
      this.uv.push(u + this.uo, v + this.vo);
      this.c.push(this.barva[0], this.barva[1], this.barva[2]);
      const zem = this.teren ? this.teren.vyska(w.x, w.z) : 0;
      this.a.push(w.y - zem, this.x);
      return this.p.length / 3 - 1;
    }
    // čtyřúhelník p0..p3 (dokola), uv = [[u,v]×4]; ven = kam má mířit líc (jinak podle pořadí)
    ctyr(p0, p1, p2, p3, uv, ven) {
      const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
      const bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      let P = [p0, p1, p2, p3], T = uv;
      if (ven && nx * ven[0] + ny * ven[1] + nz * ven[2] < 0) { P = [p1, p0, p3, p2]; T = [uv[1], uv[0], uv[3], uv[2]]; nx = -nx; ny = -ny; nz = -nz; }
      const z = this.pocet;
      for (let k = 0; k < 4; k++) this.vrchol(P[k][0], P[k][1], P[k][2], nx, ny, nz, T[k][0], T[k][1]);
      this.i.push(z, z + 1, z + 2, z, z + 2, z + 3);
    }
    // obdélníková plocha s uv u0..u1 × v0..v1
    plocha(p0, p1, p2, p3, u0, v0, u1, v1, ven) { this.ctyr(p0, p1, p2, p3, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], ven); }
    troj(p0, p1, p2, uv, ven) {
      const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
      const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      let P = [p0, p1, p2], T = uv;
      if (ven && nx * ven[0] + ny * ven[1] + nz * ven[2] < 0) { P = [p0, p2, p1]; T = [uv[0], uv[2], uv[1]]; nx = -nx; ny = -ny; nz = -nz; }
      const z = this.pocet;
      for (let k = 0; k < 3; k++) this.vrchol(P[k][0], P[k][1], P[k][2], nx, ny, nz, T[k][0], T[k][1]);
      this.i.push(z, z + 1, z + 2);
    }
    // osově zarovnaný kvádr v lokálních souřadnicích; bez = řetězec stěn, které vynechat (x X y Y z Z: −/+)
    kvadr(x0, y0, z0, x1, y1, z1, bez) {
      bez = bez || '';
      if (!bez.includes('X')) this.plocha([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], -z1, y0, -z0, y1, [1, 0, 0]);
      if (!bez.includes('x')) this.plocha([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], z0, y0, z1, y1, [-1, 0, 0]);
      if (!bez.includes('Z')) this.plocha([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], x0, y0, x1, y1, [0, 0, 1]);
      if (!bez.includes('z')) this.plocha([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], -x1, y0, -x0, y1, [0, 0, -1]);
      if (!bez.includes('Y')) this.plocha([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], x0, -z1, x1, -z0, [0, 1, 0]);
      if (!bez.includes('y')) this.plocha([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], x0, z0, x1, z1, [0, -1, 0]);
    }
    // trám (hranol) z bodu a do b, průřez s1 × s2; konce volitelně
    tram(a, b, s1, s2, sKonci) {
      s2 = s2 || s1;
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]);
      if (L < 1e-4) return;
      d[0] /= L; d[1] /= L; d[2] /= L;
      const up = Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
      let e1 = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]];
      const l1 = Math.hypot(e1[0], e1[1], e1[2]); e1 = e1.map(q => q / l1);
      const e2 = [e1[1] * d[2] - e1[2] * d[1], e1[2] * d[0] - e1[0] * d[2], e1[0] * d[1] - e1[1] * d[0]];
      const h1 = s1 / 2, h2 = s2 / 2;
      const roh = (p, i, j) => [p[0] + e1[0] * i * h1 + e2[0] * j * h2, p[1] + e1[1] * i * h1 + e2[1] * j * h2, p[2] + e1[2] * i * h1 + e2[2] * j * h2];
      const S = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
      for (let k = 0; k < 4; k++) {
        const [i0, j0] = S[k], [i1, j1] = S[(k + 1) % 4];
        const ven = [e1[0] * (i0 + i1) + e2[0] * (j0 + j1), e1[1] * (i0 + i1) + e2[1] * (j0 + j1), e1[2] * (i0 + i1) + e2[2] * (j0 + j1)];
        const sir = (k % 2 ? s1 : s2);
        this.plocha(roh(a, i0, j0), roh(a, i1, j1), roh(b, i1, j1), roh(b, i0, j0), 0, 0, sir, L, ven);
      }
      if (sKonci) {
        this.ctyr(roh(a, 1, 1), roh(a, -1, 1), roh(a, -1, -1), roh(a, 1, -1), [[0, 0], [s1, 0], [s1, s2], [0, s2]], [-d[0], -d[1], -d[2]]);
        this.ctyr(roh(b, 1, 1), roh(b, -1, 1), roh(b, -1, -1), roh(b, 1, -1), [[0, 0], [s1, 0], [s1, s2], [0, s2]], d);
      }
    }
    // síť (nu+1)×(nv+1) vrcholů z f(i, j, o) — o.p, o.n, o.u, o.v; orientace trojúhelníků se zvolí podle normál
    sit(nu, nv, f) {
      const o = { p: [0, 0, 0], n: [0, 1, 0], u: 0, v: 0 }, zac = this.pocet;
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { f(i, j, o); this.vrchol(o.p[0], o.p[1], o.p[2], o.n[0], o.n[1], o.n[2], o.u, o.v); }
      const P = this.p, N = this.n, id = (i, j) => zac + i * (nv + 1) + j;
      let nej = 0, otoc = false;
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const a = id(i, j) * 3, b = id(i + 1, j) * 3, c = id(i + 1, j + 1) * 3;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
        const wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
        const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx, pl = Math.hypot(cx, cy, cz);
        if (pl > nej) { nej = pl; otoc = cx * (N[a] + N[b] + N[c]) + cy * (N[a + 1] + N[b + 1] + N[c + 1]) + cz * (N[a + 2] + N[b + 2] + N[c + 2]) < 0; }
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
        if (otoc) this.i.push(a, c, b, a, d, c); else this.i.push(a, b, c, a, c, d);
      }
    }
    // rotační těleso kolem lokální osy Y; profil [[r, y], …] zdola nahoru; seg dílků mezi fi0..fi1
    rotacni(profil, seg, opt) {
      opt = opt || {};
      const fi0 = opt.fi0 || 0, fi1 = opt.fi1 != null ? opt.fi1 : Math.PI * 2, np = profil.length;
      const delka = [0]; for (let j = 1; j < np; j++) delka.push(delka[j - 1] + Math.hypot(profil[j][0] - profil[j - 1][0], profil[j][1] - profil[j - 1][1]));
      const nrm = profil.map((p, j) => {
        const a = profil[Math.max(0, j - 1)], b = profil[Math.min(np - 1, j + 1)];
        let nr = b[1] - a[1], ny = -(b[0] - a[0]); const l = Math.hypot(nr, ny) || 1; return [nr / l, ny / l];
      });
      const rMax = Math.max(...profil.map(p => p[0]));
      const vR = opt.vRozsah;
      this.sit(seg, np - 1, (i, j, o) => {
        const fi = fi0 + (fi1 - fi0) * i / seg, c = Math.cos(fi), s = -Math.sin(fi), [r, y] = profil[j];
        o.p[0] = r * c; o.p[1] = y; o.p[2] = r * s;
        o.n[0] = nrm[j][0] * c; o.n[1] = nrm[j][1]; o.n[2] = nrm[j][0] * s;
        o.u = (fi - fi0) * (opt.uR || rMax);
        o.v = vR ? vR[0] + (vR[1] - vR[0]) * delka[j] / delka[np - 1] : delka[j];
      });
    }
    // uzavřená trubka po rovinné cestě v rovině XY (body [[x,y]…], uzavřená), průřez [[a, b]…] (a = ven v rovině, b = osa Z)
    trubka(cesta, prurez, barvaF) {
      const nc = cesta.length, ns = prurez.length;
      const T = cesta.map((p, i) => { const a = cesta[(i - 1 + nc) % nc], b = cesta[(i + 1) % nc]; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; });
      const puvB = this.barva;
      const sn = prurez.map((q, j) => { const a = prurez[(j - 1 + ns) % ns], b = prurez[(j + 1) % ns]; let na = b[1] - a[1], nb = -(b[0] - a[0]); const l = Math.hypot(na, nb) || 1; return [na / l, nb / l]; });
      // výpočet orientace průřezu: normála kladná ven
      this.sit(nc, ns, (i, j, o) => {
        const ii = i % nc, jj = j % ns, p = cesta[ii], t = T[ii], nv = [t[1], -t[0]];   // normála v rovině (vpravo od směru)
        const [a, b] = prurez[jj], [na, nb] = sn[jj];
        o.p[0] = p[0] + nv[0] * a; o.p[1] = p[1] + nv[1] * a; o.p[2] = b;
        o.n[0] = nv[0] * na; o.n[1] = nv[1] * na; o.n[2] = nb;
        o.u = i * 0.3; o.v = j / ns;
        if (barvaF) this.barva = barvaF(ii);
      });
      this.barva = puvB;
    }
    geometrie() {
      if (!this.i.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setAttribute('aH', new THREE.Float32BufferAttribute(this.a, 2));
      g.setIndex(this.pocet > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      return g;
    }
  }
  D.Stavitel = Stavitel;

  // ======================================================================================
  //  Procedurální textury (canvas)
  // ======================================================================================
  function platno(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
  // periodický hodnotový šum 0..1 (bezešvé dlaždice), px × py buněk přes celý obrázek
  function sumP(w, h, px, py, seed) {
    const r = D.Nahoda(seed), g = new Float32Array(px * py), out = new Float32Array(w * h);
    for (let i = 0; i < g.length; i++) g[i] = r();
    for (let y = 0; y < h; y++) {
      const fy = y / h * py, iy = Math.floor(fy), ty0 = fy - iy, ty = ty0 * ty0 * (3 - 2 * ty0), y0 = (iy % py) * px, y1 = ((iy + 1) % py) * px;
      for (let x = 0; x < w; x++) {
        const fx = x / w * px, ix = Math.floor(fx), tx0 = fx - ix, tx = tx0 * tx0 * (3 - 2 * tx0), x0 = ix % px, x1 = (ix + 1) % px;
        const a = g[y0 + x0], b = g[y0 + x1], c = g[y1 + x0], d = g[y1 + x1];
        out[y * w + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      }
    }
    return out;
  }
  function fbmP(w, h, px, py, okt, seed) {
    const out = new Float32Array(w * h); let a = 1, n = 0;
    for (let o = 0; o < okt; o++) {
      const s = sumP(w, h, px << o, py << o, seed + ':' + o);
      for (let i = 0; i < out.length; i++) out[i] += s[i] * a;
      n += a; a *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= n;
    return out;
  }
  function doPlatna(c, f) {   // f(x, y, i) → [r, g, b] (0..255)
    const g = c.getContext('2d'), im = g.createImageData(c.width, c.height), d = im.data;
    for (let y = 0, i = 0; y < c.height; y++) for (let x = 0; x < c.width; x++, i++) {
      const v = f(x, y, i); d[i * 4] = v[0]; d[i * 4 + 1] = v[1]; d[i * 4 + 2] = v[2]; d[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }
  function prekryjSumem(c, sila, seed, per) {   // přidá jemný šum do existující kresby
    const g = c.getContext('2d'), im = g.getImageData(0, 0, c.width, c.height), d = im.data;
    const n = fbmP(c.width, c.height, per || 8, per || 8, 5, seed);
    for (let i = 0; i < n.length; i++) { const k = 1 + (n[i] - 0.5) * sila; d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k; }
    g.putImageData(im, 0, 0);
  }
  let ANISO = 4;
  function textura(c, opak, srgb) {
    const t = new THREE.CanvasTexture(c);
    if (opak) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / opak, 1 / opak); }
    if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = ANISO;
    return t;
  }

  // omítka (pokrývá 4 × 4 m): jemné zrno, skvrny, svislé stékance, místy opadaná omítka s cihlami
  function texOmitka() {
    const W = 512, c = platno(W), b = platno(W);
    const n1 = fbmP(W, W, 4, 4, 5, 'om1'), n2 = sumP(W, W, 256, 256, 'om2'), pr = fbmP(W, W, 48, 3, 3, 'om3'), sk = fbmP(W, W, 6, 6, 4, 'om4');
    doPlatna(c, (x, y, i) => {
      let v = 0.9 + (n1[i] - 0.5) * 0.16 + (n2[i] - 0.5) * 0.06 - Math.max(0, pr[i] - 0.55) * 0.4;
      if (sk[i] > 0.8) {   // opadaná omítka → cihly
        const ry = Math.floor(y / 9), bx = (x + (ry % 2) * 9) % 18;
        const malta = (y % 9) < 2 || bx < 2;
        const t = malta ? [0.62, 0.6, 0.55] : [0.62 + n2[i] * 0.1, 0.36, 0.27];
        const okraj = D.smooth(0.8, 0.83, sk[i]) * 0.85;
        return [255 * D.lerp(v, t[0], okraj), 255 * D.lerp(v * 0.98, t[1], okraj), 255 * D.lerp(v * 0.94, t[2], okraj)];
      }
      return [255 * v, 255 * v * 0.985, 255 * v * 0.95];
    });
    doPlatna(b, (x, y, i) => { const v = 128 + (n2[i] - 0.5) * 120 + (n1[i] - 0.5) * 60 - (sk[i] > 0.8 ? 40 : 0); return [v, v, v]; });
    return [c, b];
  }

  // pálené tašky bobrovky (pokrývá 1.2 × 1.2 m): 6 tašek na šířku, 8 řad, řady přesazené
  function texStrecha() {
    const W = 512, c = platno(W), b = platno(W), g = c.getContext('2d'), gb = b.getContext('2d');
    const r = D.Nahoda('tasky'), sl = 6, ra = 8, tw = W / sl, th = W / ra;
    g.fillStyle = '#4a2116'; g.fillRect(0, 0, W, W); gb.fillStyle = '#000'; gb.fillRect(0, 0, W, W);
    for (let rr = ra; rr >= -1; rr--) {             // spodní řady dřív — vyšší řady je překryjí
      const y0 = rr * th - th * 0.25;
      for (let s = -1; s <= sl; s++) {
        const x0 = s * tw + (rr % 2 ? tw / 2 : 0);
        const tm = 0.75 + r() * 0.35, mech = r() < 0.12;
        const col = [168 * tm, 74 * tm * (0.9 + r() * 0.2), 50 * tm];
        for (const dy of [0, W, -W]) for (const dx of [0, W, -W]) {
          const X = x0 + dx + 1.5, Y = y0 + dy, w = tw - 3, h = th * 1.25, rad = w * 0.5;
          // stín pod taškou na tu spodní
          g.fillStyle = 'rgba(20,6,3,0.55)';
          g.beginPath(); g.moveTo(X, Y + 3); g.lineTo(X + w, Y + 3); g.lineTo(X + w, Y + h - rad + 5); g.arc(X + w / 2, Y + h - rad + 5, rad, 0, Math.PI); g.closePath(); g.fill();
          const gr = g.createLinearGradient(0, Y, 0, Y + h);
          gr.addColorStop(0, `rgb(${col[0] * 0.75 | 0},${col[1] * 0.75 | 0},${col[2] * 0.75 | 0})`);
          gr.addColorStop(0.55, `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`);
          gr.addColorStop(1, `rgb(${col[0] * 1.08 | 0},${col[1] * 1.05 | 0},${col[2] | 0})`);
          g.fillStyle = gr;
          g.beginPath(); g.moveTo(X, Y); g.lineTo(X + w, Y); g.lineTo(X + w, Y + h - rad); g.arc(X + w / 2, Y + h - rad, rad, 0, Math.PI); g.closePath(); g.fill();
          if (mech) { g.fillStyle = 'rgba(95,100,55,0.45)'; g.beginPath(); g.arc(X + w * (0.3 + r() * 0.4), Y + h * 0.7, w * 0.25, 0, 7); g.fill(); }
          const hb = gb.createLinearGradient(0, Y, 0, Y + h);
          hb.addColorStop(0, '#202020'); hb.addColorStop(1, '#e0e0e0');
          gb.fillStyle = hb;
          gb.beginPath(); gb.moveTo(X, Y); gb.lineTo(X + w, Y); gb.lineTo(X + w, Y + h - rad); gb.arc(X + w / 2, Y + h - rad, rad, 0, Math.PI); gb.closePath(); gb.fill();
        }
      }
    }
    prekryjSumem(c, 0.35, 'tasky-s', 4);
    return [c, b];
  }

  // svislá prkna (pokrývá 2 × 2 m): 9 prken, letokruhy, suky, tmavé spáry; zvětralé šedohnědé
  function texDrevo() {
    const W = 512, c = platno(W), b = platno(W);
    const r = D.Nahoda('prkna'), np = 9, pw = W / np, tony = [], ofs = [];
    for (let k = 0; k < np; k++) { tony.push(0.75 + r() * 0.35); ofs.push(r() * 100); }
    const zrno = fbmP(W, W, 64, 2, 4, 'drevo-z'), sk = fbmP(W, W, 8, 8, 3, 'drevo-s'), jem = sumP(W, W, 256, 32, 'drevo-j');
    doPlatna(c, (x, y, i) => {
      const k = Math.floor(x / pw), fx = (x % pw) / pw;
      const spara = fx < 0.04 || fx > 0.97;
      const t = tony[k];
      const zz = zrno[(y * W + ((x + ofs[k] * 3) % W | 0))];
      let v = t * (0.82 + (zz - 0.5) * 0.45 + (jem[i] - 0.5) * 0.12) * (0.85 + sk[i] * 0.3);
      if (spara) v *= 0.3;
      const zv = D.clamp(sk[i] * 1.4 - 0.3, 0, 1);   // zvětrání → šeď
      return [255 * v * D.lerp(0.62, 0.55, zv), 255 * v * D.lerp(0.47, 0.53, zv), 255 * v * D.lerp(0.34, 0.5, zv)];
    });
    doPlatna(b, (x, y, i) => { const fx = (x % pw) / pw; const v = (fx < 0.04 || fx > 0.97) ? 20 : 150 + (zrno[i] - 0.5) * 120; return [v, v, v]; });
    return [c, b];
  }

  // lomový kámen / kvádry (pokrývá 3 × 3 m)
  function texKamen() {
    const W = 512, c = platno(W), b = platno(W), g = c.getContext('2d'), gb = b.getContext('2d');
    const r = D.Nahoda('kameny');
    g.fillStyle = '#6b665c'; g.fillRect(0, 0, W, W); gb.fillStyle = '#202020'; gb.fillRect(0, 0, W, W);
    let y = 0;
    while (y < W) {
      const h = Math.min(W - y, 26 + r() * 30 | 0); let x = -r() * 60;
      while (x < W) {
        const w = 40 + r() * 70, t = 0.75 + r() * 0.35, hue = r() * 14 - 7;
        for (const dx of [0, W]) {
          g.fillStyle = `rgb(${(148 + hue) * t | 0},${142 * t | 0},${(128 - hue) * t | 0})`;
          g.fillRect(x + dx + 2, y + 2, w - 4, h - 4);
          gb.fillStyle = `rgb(${170 + r() * 60 | 0},0,0)`; gb.fillRect(x + dx + 3, y + 3, w - 6, h - 6);
        }
        x += w;
      }
      y += h;
    }
    prekryjSumem(c, 0.5, 'kamen-s', 8);
    return [c, b];
  }

  // sláma (1 × 1 m); horní pruh (v 0.86–1) je hladká fólie pro balené balíky
  function texSeno() {
    const W = 256, c = platno(W), g = c.getContext('2d'), r = D.Nahoda('seno');
    g.fillStyle = '#9b8448'; g.fillRect(0, 0, W, W);
    for (let k = 0; k < 2600; k++) {
      const x = r() * W, y = r() * W, a = (r() - 0.5) * 0.9, l = 6 + r() * 22, t = 0.7 + r() * 0.5;
      g.strokeStyle = `rgba(${200 * t | 0},${172 * t | 0},${100 * t | 0},0.8)`; g.lineWidth = 0.6 + r();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    const n = fbmP(W, 40, 4, 2, 3, 'folie');
    const im = g.getImageData(0, 0, W, 40);
    for (let i = 0; i < W * 40; i++) { const v = 215 + (n[i] - 0.5) * 50; im.data[i * 4] = v; im.data[i * 4 + 1] = v; im.data[i * 4 + 2] = v * 0.98; }
    g.putImageData(im, 0, 0);
    return c;
  }

  // atlas oken a dveří 4 × 4 buňky po 256 px + mapa svícení (sklo) ve stejném rozložení
  const OKNO = { klasicke: 0, plastove: 1, dvere: 2, vrata: 3, kostelni: 4, hodiny: 5, zaluzie: 6, garaz: 7, pudni: 8, dvirka: 9, otvor: 10, panel: 11, lampa: 12 };
  function texOkna() {
    const S = 256, c = platno(S * 4), e = platno(S * 4), g = c.getContext('2d'), ge = e.getContext('2d'), r = D.Nahoda('okna');
    g.clearRect(0, 0, S * 4, S * 4); ge.fillStyle = '#000'; ge.fillRect(0, 0, S * 4, S * 4);
    const bunka = i => [(i % 4) * S, Math.floor(i / 4) * S];
    function sklo(x, y, w, h, svit) {
      const gr = g.createLinearGradient(x, y, x + w * 0.3, y + h);
      gr.addColorStop(0, '#9aa8b4'); gr.addColorStop(0.35, '#55606a'); gr.addColorStop(1, '#22282e');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(225,220,205,0.22)';                    // záclona
      for (let k = 0; k < w; k += 5) g.fillRect(x + k, y + h * 0.25, 2, h * 0.75);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(x + w * 0.2, y); g.lineTo(x + w * 0.45, y); g.lineTo(x + w * 0.1, y + h); g.lineTo(x - w * 0.15, y + h); g.closePath(); g.fill();
      if (svit !== false) { const t = 0.75 + r() * 0.3; ge.fillStyle = `rgb(${255 * t | 0},${200 * t | 0},${130 * t | 0})`; ge.fillRect(x, y, w, h); }
    }
    function osteni(x, y, w, h, k) {        // stínované ostění (hloubka zdi) kolem otvoru
      g.fillStyle = '#8a857b'; g.fillRect(x, y, w, h);
      const gr = g.createLinearGradient(x, y, x, y + k * 2); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x, y, w, k * 2);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y, k, h);
    }
    // 0 klasické špaletové okno: bílý rám, kříž s nadsvětlíkem
    let [x, y] = bunka(0); osteni(x, y, S, S, 18);
    g.fillStyle = '#e9e7df'; g.fillRect(x + 18, y + 18, S - 36, S - 30);
    for (const [px, py, pw, ph] of [[30, 30, 92, 62], [134, 30, 92, 62], [30, 104, 92, 112], [134, 104, 92, 112]]) sklo(x + px, y + py, pw, ph);
    g.fillStyle = '#d9d5ca'; g.fillRect(x + 18, y + S - 16, S - 36, 10);
    // 1 plastové okno: dvě křídla
    [x, y] = bunka(1); osteni(x, y, S, S, 16);
    g.fillStyle = '#f2f2f0'; g.fillRect(x + 16, y + 16, S - 32, S - 26);
    sklo(x + 32, y + 32, 86, S - 70); sklo(x + 138, y + 32, 86, S - 70);
    g.fillStyle = '#bcbcb8'; g.fillRect(x + 108, y + 140, 5, 22);
    // 2 dveře: dřevěné s kazetami a prosklením
    [x, y] = bunka(2); osteni(x, y, S, S, 14);
    g.fillStyle = '#6b4329'; g.fillRect(x + 14, y + 14, S - 28, S - 14);
    sklo(x + 70, y + 30, 116, 60);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 4;
    g.strokeRect(x + 40, y + 110, 76, 120); g.strokeRect(x + 140, y + 110, 76, 120); g.strokeRect(x + 66, y + 26, 124, 68);
    g.fillStyle = '#c9a24a'; g.fillRect(x + 196, y + 150, 16, 6);
    // 3 vrata stodoly
    [x, y] = bunka(3); g.fillStyle = '#5c4632'; g.fillRect(x, y, S, S);
    for (let k = 0; k < 16; k++) { const t = 0.8 + r() * 0.35; g.fillStyle = `rgb(${120 * t | 0},${96 * t | 0},${70 * t | 0})`; g.fillRect(x + k * 16 + 1, y, 14, S); }
    g.fillStyle = '#2a1f16'; g.fillRect(x + 126, y, 4, S);
    g.strokeStyle = 'rgba(70,52,36,0.95)'; g.lineWidth = 14;
    for (const ox of [0, 128]) { g.beginPath(); g.moveTo(x + ox + 8, y + S - 20); g.lineTo(x + ox + 120, y + 30); g.stroke(); g.fillStyle = 'rgba(70,52,36,0.95)'; g.fillRect(x + ox + 4, y + 22, 120, 14); g.fillRect(x + ox + 4, y + S - 34, 120, 14); }
    g.fillStyle = '#222'; for (const yy of [30, S - 30]) { g.fillRect(x + 4, y + yy - 3, 40, 6); g.fillRect(x + S - 44, y + yy - 3, 40, 6); }
    // 4 kostelní okno s obloukem, olověné tabulky (mimo oblouk průhledné)
    [x, y] = bunka(4);
    g.save(); g.beginPath(); g.moveTo(x + 40, y + S); g.lineTo(x + 40, y + 88); g.arc(x + 128, y + 88, 88, Math.PI, 0); g.lineTo(x + 216, y + S); g.closePath(); g.clip();
    g.fillStyle = '#d8d2c2'; g.fillRect(x, y, S, S);
    g.fillStyle = '#7a756b'; g.fillRect(x + 52, y, 152, S);
    for (let yy = 0; yy < S; yy += 18) for (let xx = 0; xx < 140; xx += 18) {
      const t = 0.7 + r() * 0.5; g.fillStyle = `rgb(${70 * t | 0},${86 * t | 0},${88 * t | 0})`; g.fillRect(x + 62 + xx, y + yy + 2, 16, 16);
    }
    g.restore();
    ge.save(); ge.beginPath(); ge.moveTo(x + 56, y + S - 10); ge.lineTo(x + 56, y + 96); ge.arc(x + 128, y + 96, 72, Math.PI, 0); ge.lineTo(x + 200, y + S - 10); ge.closePath(); ge.clip();
    ge.fillStyle = '#b8823c'; ge.fillRect(x, y, S, S); ge.restore();
    // 5 hodiny: černý ciferník se zlatými značkami
    [x, y] = bunka(5);
    g.fillStyle = '#d9c9a0'; g.beginPath(); g.arc(x + 128, y + 128, 126, 0, 7); g.fill();
    g.fillStyle = '#16181a'; g.beginPath(); g.arc(x + 128, y + 128, 112, 0, 7); g.fill();
    g.strokeStyle = '#d4af37'; g.lineWidth = 7;
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.beginPath(); g.moveTo(x + 128 + Math.sin(a) * 82, y + 128 - Math.cos(a) * 82); g.lineTo(x + 128 + Math.sin(a) * 104, y + 128 - Math.cos(a) * 104); g.stroke(); }
    g.lineWidth = 10; g.beginPath(); g.moveTo(x + 128, y + 128); g.lineTo(x + 128 + 50, y + 128 - 30); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(x + 128, y + 128); g.lineTo(x + 128 - 10, y + 128 - 90); g.stroke();
    ge.fillStyle = '#3a3020'; ge.beginPath(); ge.arc(x + 128, y + 128, 110, 0, 7); ge.fill();
    // 6 žaluzie zvonice (oblouk nahoře)
    [x, y] = bunka(6);
    g.save(); g.beginPath(); g.moveTo(x + 20, y + S); g.lineTo(x + 20, y + 108); g.arc(x + 128, y + 108, 108, Math.PI, 0); g.lineTo(x + 236, y + S); g.closePath(); g.clip();
    g.fillStyle = '#9a9488'; g.fillRect(x, y, S, S);
    g.fillStyle = '#141210'; g.fillRect(x + 34, y + 14, S - 68, S - 14);
    for (let yy = 40; yy < S; yy += 22) { g.fillStyle = '#5a4a3a'; g.fillRect(x + 34, y + yy, S - 68, 12); g.fillStyle = '#3a2e24'; g.fillRect(x + 34, y + yy + 12, S - 68, 3); }
    g.restore();
    // 7 garážová vrata
    [x, y] = bunka(7); osteni(x, y, S, S, 12);
    for (let k = 0; k < 5; k++) { g.fillStyle = '#dcdcd6'; g.fillRect(x + 12, y + 12 + k * 49, S - 24, 46); g.fillStyle = '#b4b4ae'; g.fillRect(x + 12, y + 56 + k * 49, S - 24, 3); }
    // 8 půdní okénko
    [x, y] = bunka(8); osteni(x, y, S, S, 20);
    g.fillStyle = '#5b3d27'; g.fillRect(x + 20, y + 20, S - 40, S - 34);
    for (const [px, py] of [[34, 34], [134, 34], [34, 134], [134, 134]]) sklo(x + px, y + py, 88, 86, false);
    // 9 dvířka (prkenná)
    [x, y] = bunka(9); osteni(x, y, S, S, 10);
    for (let k = 0; k < 6; k++) { const t = 0.8 + r() * 0.3; g.fillStyle = `rgb(${105 * t | 0},${80 * t | 0},${58 * t | 0})`; g.fillRect(x + 12 + k * 39, y + 10, 36, S - 10); }
    g.fillStyle = '#222'; g.fillRect(x + 190, y + 130, 22, 8);
    // 10 tmavý otvor (posed, půda)
    [x, y] = bunka(10); g.fillStyle = '#6a5440'; g.fillRect(x, y, S, S); g.fillStyle = '#0c0b0a'; g.fillRect(x + 16, y + 16, S - 32, S - 32);
    // 11 fotovoltaický panel: tmavě modré články, stříbrný rám
    [x, y] = bunka(11); g.fillStyle = '#b8bcc0'; g.fillRect(x, y, S, S);
    for (let j = 0; j < 10; j++) for (let i = 0; i < 6; i++) {
      const gr = g.createLinearGradient(x + 8 + i * 40, y + 6 + j * 24.4, x + 8 + i * 40 + 30, y + 6 + j * 24.4 + 24);
      gr.addColorStop(0, '#2a3a5c'); gr.addColorStop(1, '#16203a');
      g.fillStyle = gr; g.fillRect(x + 8 + i * 40, y + 6 + j * 24.4, 39, 23.4);
    }
    // 12 sklo lampy (svítí celé)
    [x, y] = bunka(12); g.fillStyle = '#d8d6cc'; g.fillRect(x, y, S, S); g.fillStyle = '#f4f0e0'; g.fillRect(x + 20, y + 20, S - 40, S - 40);
    ge.fillStyle = '#fff2d0'; ge.fillRect(x + 10, y + 10, S - 20, S - 20);
    return [c, e];
  }
  function uvBunky(i, n) {
    n = n || 4; const e = 0.5 / 1024, col = i % n, row = Math.floor(i / n);
    return [col / n + e, 1 - (row + 1) / n + e, (col + 1) / n - e, 1 - row / n - e];
  }

  // tabule: čísla branek 1–24 a startovní plocha s H (5 × 5 buněk)
  function texTabule() {
    const W = 1020, S = W / 5, c = platno(W), g = c.getContext('2d');
    for (let i = 0; i < 24; i++) {
      const x = (i % 5) * S, y = Math.floor(i / 5) * S;
      g.fillStyle = '#f4f4f0'; g.fillRect(x, y, S, S);
      g.fillStyle = '#111'; g.font = `bold ${S * 0.62 | 0}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(i + 1), x + S / 2, y + S * 0.54);
    }
    const x = 4 * S, y = 4 * S;
    g.fillStyle = '#3c3d3f'; g.fillRect(x, y, S, S);
    g.strokeStyle = '#e8b923'; g.lineWidth = S * 0.05; g.beginPath(); g.arc(x + S / 2, y + S / 2, S * 0.4, 0, 7); g.stroke();
    g.fillStyle = '#f2f2f2'; g.font = `bold ${S * 0.5 | 0}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', x + S / 2, y + S * 0.53);
    prekryjSumem(c, 0.25, 'tabule', 16);
    return c;
  }

  // ======================================================================================
  //  Materiály
  // ======================================================================================
  const U_NOC = { value: 0 }, U_DALSI = { value: -1 };
  // úprava shaderu: atribut aH, špína u země, odbarvení střech, svícení oken, zvýraznění branky
  function hak(o) {
    return function (sh) {
      sh.uniforms.uNoc = U_NOC; sh.uniforms.uDalsi = U_DALSI;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aH;\nvarying vec2 vH;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = aH;');
      let f = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vH;\nuniform float uNoc;\nuniform float uDalsi;');
      let po = '';
      if (o.spina) po += `\n  diffuseColor.rgb *= mix(vec3(${o.spina[0]}, ${o.spina[0] * 0.97}, ${o.spina[0] * 0.9}), vec3(1.0), smoothstep(0.0, ${o.spina[1].toFixed(2)}, vH.x));`;
      if (o.odbarvi) po += `\n  { float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l) * vec3(0.92, 0.97, 1.04), vH.y); }`;
      if (po) f = f.replace('#include <map_fragment>', '#include <map_fragment>' + po);
      if (o.sviti) f = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vH.y * uNoc;');
      if (o.branka) f = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * step(abs(vH.y - uDalsi), 0.5) * (0.55 + 0.4 * sin(uTime * 6.0));');
      sh.fragmentShader = f;
    };
  }
  function vytvorMaterialy(ctx) {
    ANISO = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy());
    const std = (par, o) => D.upravMaterial(new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, par)), hak(o || {}));
    const [om, omB] = texOmitka(), [st, stB] = texStrecha(), [dr, drB] = texDrevo(), [ka, kaB] = texKamen(), [ok, okE] = texOkna();
    const M = {
      omitka: std({ map: textura(om, 4), bumpMap: textura(omB, 4, false), bumpScale: 0.6, roughness: 0.93 }, { spina: [0.55, 1.1] }),
      strecha: std({ map: textura(st, 1.2), bumpMap: textura(stB, 1.2, false), bumpScale: 1.5, roughness: 0.82 }, { odbarvi: true }),
      drevo: std({ map: textura(dr, 2), bumpMap: textura(drB, 2, false), bumpScale: 1.2, roughness: 0.9 }, { spina: [0.6, 0.7] }),
      kamen: std({ map: textura(ka, 3), bumpMap: textura(kaB, 3, false), bumpScale: 2.0, roughness: 0.92 }, { spina: [0.7, 0.8] }),
      okna: std({ map: textura(ok), emissiveMap: textura(okE), emissive: new THREE.Color(1, 0.78, 0.5), emissiveIntensity: 3.5, roughness: 0.35, metalness: 0.0, alphaTest: 0.5 }, { sviti: true }),
      kov: std({ roughness: 0.55, metalness: 0.45 }),
      seno: std({ map: textura(texSeno(), 1), roughness: 0.95 }, { spina: [0.75, 0.4] }),
      branky: std({ roughness: 0.55, metalness: 0.0, emissive: 0x000000 }, { branka: true }),
      tabule: std({ map: textura(texTabule()), roughness: 0.7 }),
    };
    return M;
  }

  // ======================================================================================
  //  Pomůcky pro stavby
  // ======================================================================================
  const barva = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  const smichej = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const nasob = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const OMITKY = ['#ece8dc', '#f1ead2', '#e9dcb4', '#e3c98f', '#d9b37a', '#e8d6c8', '#d8dccb', '#cfd5d6', '#efe2c9', '#e4d4a8', '#f3efe6'].map(barva);
  const STRECHY = ['#b8644a', '#a85a42', '#9c5240', '#8f4c3a', '#86584a', '#a8684f', '#74463a', '#5a4a46'].map(barva);
  const BILA = barva('#f4f1e8'), SOKL = barva('#8f8a80');
  function hashPoz(b, sul) { return D.hash2(Math.round(b.x * 10), Math.round(b.z * 10), D.seedZ(sul || 'stavba')); }
  function nahodaStavby(b) { return D.Nahoda('st:' + Math.round(b.x * 10) + ':' + Math.round(b.z * 10) + ':' + b.typ); }

  const ROT90 = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  function ramec(b) {
    return new THREE.Matrix4().makeRotationY(b.uhel || 0).setPosition(b.x, b.y, b.z);
  }
  // jak hluboko pod b.y leží nejnižší roh půdorysu (≤ −0.3)
  function hloubkaZakladu(t, b, sx, sz) {
    const c = Math.cos(b.uhel || 0), s = Math.sin(b.uhel || 0); let m = b.y;
    for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
      const x = lx * sx / 2, z = lz * sz / 2;
      m = Math.min(m, t.vyska(b.x + x * c + z * s, b.z - x * s + z * c));
    }
    return Math.min(-0.3, m - b.y - 0.3);
  }
  // stěny obdélníku v lokálních souřadnicích: střed, normála ven, směr „doprava“ při pohledu zvenku, délka
  function steny(sx, sz) {
    return [
      { c: [sx / 2, 0, 0], n: [1, 0, 0], u: [0, 0, -1], L: sz, dlouha: true },
      { c: [-sx / 2, 0, 0], n: [-1, 0, 0], u: [0, 0, 1], L: sz, dlouha: true },
      { c: [0, 0, sz / 2], n: [0, 0, 1], u: [1, 0, 0], L: sx, dlouha: false },
      { c: [0, 0, -sz / 2], n: [0, 0, -1], u: [-1, 0, 0], L: sx, dlouha: false },
    ];
  }
  const naStene = (st, s, y, off) => [st.c[0] + st.u[0] * s + st.n[0] * off, y, st.c[2] + st.u[2] * s + st.n[2] * off];
  // obdélník na stěně (okno, dveře): s = střed podél stěny, y = spodní hrana
  function prvek(S, st, s, y, w, h, off, uv) {
    S.plocha(naStene(st, s - w / 2, y, off), naStene(st, s + w / 2, y, off), naStene(st, s + w / 2, y + h, off), naStene(st, s - w / 2, y + h, off), uv[0], uv[1], uv[2], uv[3], st.n);
  }
  // kvádr vystupující ze stěny (šambrána, parapet, lizéna) od off0 do off1
  function kvadrNaStene(S, st, s0, s1, y0, y1, off0, off1, bez) {
    const a = naStene(st, s0, y0, off0), b = naStene(st, s1, y1, off1);
    S.kvadr(Math.min(a[0], b[0]), y0, Math.min(a[2], b[2]), Math.max(a[0], b[0]), y1, Math.max(a[2], b[2]), bez);
  }
  // lokální směr (v soustavě matice M) k nejbližší cestě; null, když cesty nejsou
  function smerKCeste(cesty, x, z) {
    let nej = 1e9, sx = 0, sz = 0;
    for (const c of cesty || []) {
      const B = c.body; if (!B) continue;
      for (let i = 0; i + 1 < B.length; i++) {
        const ax = B[i][0], az = B[i][1], bx = B[i + 1][0], bz = B[i + 1][1];
        if (Math.abs(ax - x) > 300 && Math.abs(bx - x) > 300) continue;
        const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
        const t = D.clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), px = ax + dx * t, pz = az + dz * t;
        const d = Math.hypot(px - x, pz - z);
        if (d < nej) { nej = d; sx = px - x; sz = pz - z; }
      }
    }
    if (nej > 150 || nej < 1e-3) return null;
    return [sx / nej, sz / nej];
  }
  function lokalniSmer(M, smer) {
    if (!smer) return null;
    const inv = new THREE.Matrix4().extractRotation(M).invert();
    const v = new THREE.Vector3(smer[0], 0, smer[1]).applyMatrix4(inv);
    return [v.x, v.z];
  }

  // ---------- střechy (lokálně: hřeben podél z, rozpětí sx, délka sz, okap ve výšce y0) ----------
  function strecha(K, sx, sz, y0, R, o) {
    const p = o.previs != null ? o.previs : 0.5, ps = o.stitPrevis != null ? o.stitPrevis : 0.35, t = 0.22;
    const hx = sx / 2, k = R / hx, a = hx + p, ye = y0 - p * k, yr = y0 + R, sl = Math.hypot(a, R + p * k);
    const St = K.strecha, Dr = K.drevo, Om = o.stit || K.omitka;
    St.odstin(o.barva); St.x = o.odbarveni || 0; Dr.odstin(o.barvaPodbiti || [0.55, 0.47, 0.38]);
    if (o.typ === 'valbova') {
      const zE = sz / 2 + p, zr = Math.max(0, sz / 2 - hx);
      for (const s of [-1, 1]) {
        St.ctyr([s * a, ye, -zE], [s * a, ye, zE], [0, yr, zr], [0, yr, -zr], [[-zE, 0], [zE, 0], [zr, sl], [-zr, sl]], [s * R, hx, 0]);
        Dr.plocha([s * a, ye - t, -zE], [s * a, ye - t, zE], [s * a, ye, zE], [s * a, ye, -zE], -zE, 0, zE, t, [s, 0, 0]);
      }
      for (const e of [-1, 1]) {
        St.troj([-a, ye, e * zE], [a, ye, e * zE], [0, yr, e * zr], [[-a, 0], [a, 0], [0, sl]], [0, hx, e * R]);
        Dr.plocha([-a, ye - t, e * zE], [a, ye - t, e * zE], [a, ye, e * zE], [-a, ye, e * zE], -a, 0, a, t, [0, 0, e]);
      }
      Dr.odstin(nasob(o.barvaPodbiti || [0.5, 0.42, 0.34], 1)).plocha([-a, ye - t, -zE], [a, ye - t, -zE], [a, ye - t, zE], [-a, ye - t, zE], -a, -zE, a, zE, [0, -1, 0]);
      St.odstin(nasob(o.barva, 0.8));
      if (zr > 0) hrebenac(St, -zr, zr, yr, k);
      for (const s of [-1, 1]) for (const e of [-1, 1]) St.tram([s * a, ye + 0.05, e * zE], [0, yr + 0.06, e * zr], 0.16, 0.1);
    } else {
      const zE = sz / 2 + ps;
      for (const s of [-1, 1]) {
        St.plocha([s * a, ye, -zE], [s * a, ye, zE], [0, yr, zE], [0, yr, -zE], -zE, 0, zE, sl, [s * R, hx, 0]);
        Dr.plocha([s * a, ye - t, -zE], [s * a, ye - t, zE], [0, yr - t, zE], [0, yr - t, -zE], -zE, 0, zE, sl, [-s * R, -hx, 0]);
        Dr.plocha([s * a, ye - t, -zE], [s * a, ye - t, zE], [s * a, ye, zE], [s * a, ye, -zE], -zE, 0, zE, t, [s, 0, 0]);
        for (const e of [-1, 1]) Dr.ctyr([s * a, ye, e * zE], [0, yr, e * zE], [0, yr - t, e * zE], [s * a, ye - t, e * zE], [[0, 0], [sl, 0], [sl, t], [0, t]], [0, 0, e]);
      }
      Om.odstin(o.barvaStitu || Om.barva);
      for (const e of [-1, 1]) Om.troj([-hx, y0 - 0.01, e * sz / 2], [hx, y0 - 0.01, e * sz / 2], [0, yr - 0.05, e * sz / 2], [[-hx, y0], [hx, y0], [0, yr]], [0, 0, e]);
      St.odstin(nasob(o.barva, 0.8));
      hrebenac(St, -zE, zE, yr, k);
    }
    St.x = 0;
    return { ye, yr, k, a, sl, hx, R, zE: o.typ === 'valbova' ? sz / 2 + p : sz / 2 + ps };
  }
  // fotovoltaické panely na jedné straně sedlové střechy (s = ±1), pole sloupců × řad
  function panely(K, info, s, sz, r) {
    const { ye, yr, a, sl, hx, R } = info, dl = 1.05, dv = 1.72;
    const dir = [-s * a / sl, (yr - ye) / sl, 0], nl = Math.hypot(R, hx), n = [s * R / nl, hx / nl, 0];
    const rad = Math.max(1, Math.min(3, Math.floor((sl - 1.2) / dv))), sl0 = Math.min(sz - 2, r.cele(3, 9) * dl);
    const sloupcu = Math.max(2, Math.floor(sl0 / dl)), z0 = -sloupcu * dl / 2 + (r() - 0.5) * Math.max(0, sz - 2 - sloupcu * dl);
    const uv = uvBunky(OKNO.panel);
    K.okna.odstin([1, 1, 1]); K.okna.x = 0;
    const P = (t, z, h) => [s * a + dir[0] * t + n[0] * h, ye + dir[1] * t + n[1] * h, z];
    for (let i = 0; i < rad; i++) for (let j = 0; j < sloupcu; j++) {
      const t0 = 0.7 + i * dv, za = z0 + j * dl;
      K.okna.plocha(P(t0, za, 0.14), P(t0, za + dl - 0.03, 0.14), P(t0 + dv - 0.03, za + dl - 0.03, 0.14), P(t0 + dv - 0.03, za, 0.14), uv[0], uv[1], uv[2], uv[3], n);
    }
  }
  function hrebenac(St, z0, z1, yr, k) {          // hřebenáče
    const w = 0.16, h = 0.08;
    St.plocha([w, yr - w * k + 0.02, z0], [w, yr - w * k + 0.02, z1], [0, yr + h, z1], [0, yr + h, z0], z0, 0, z1, 0.25, [1, 1, 0]);
    St.plocha([-w, yr - w * k + 0.02, z0], [-w, yr - w * k + 0.02, z1], [0, yr + h, z1], [0, yr + h, z0], z0, 0, z1, 0.25, [-1, 1, 0]);
  }
  function komin(K, x, z, yOd, yDo, r) {
    const w = 0.45 + r() * 0.15;
    K.omitka.odstin(r() < 0.5 ? barva('#b9b2a6') : barva('#9a5a44'));
    K.omitka.kvadr(x - w / 2, yOd, z - w / 2, x + w / 2, yDo, z + w / 2, 'y');
    K.kov.odstin(barva('#3a3836'));
    K.kov.kvadr(x - w / 2 - 0.06, yDo, z - w / 2 - 0.06, x + w / 2 + 0.06, yDo + 0.06, z + w / 2 + 0.06, 'y');
  }

  // ---------- okna, dveře a jejich ozdoby na jedné stěně ----------
  function okno(K, Kd, st, s, y, w, h, typ, r, o) {
    o = o || {};
    K.okna.x = o.sviti != null ? o.sviti : (r() < 0.35 ? 0.6 + r() * 0.6 : 0);
    K.okna.odstin([1, 1, 1]);
    prvek(K.okna, st, s, y, w, h, 0.02, uvBunky(typ));
    K.okna.x = 0;
    if (!Kd) return;
    if (o.samb !== false) {                        // šambrána (bílé orámování) a parapet
      const Om = Kd.omitka, b = o.barvaSamb || BILA, sw = 0.12;
      Om.odstin(b);
      kvadrNaStene(Om, st, s - w / 2 - sw, s - w / 2, y - 0.02, y + h + sw, 0, 0.045, 'y');
      kvadrNaStene(Om, st, s + w / 2, s + w / 2 + sw, y - 0.02, y + h + sw, 0, 0.045, 'y');
      kvadrNaStene(Om, st, s - w / 2, s + w / 2, y + h, y + h + sw, 0, 0.045, '');
    }
    if (o.parapet !== false) {
      Kd.kov.odstin(barva('#6d6a64'));
      kvadrNaStene(Kd.kov, st, s - w / 2 - 0.1, s + w / 2 + 0.1, y - 0.06, y, 0, 0.14, '');
    }
  }

  // ======================================================================================
  //  Jednotlivé typy staveb — každá funkce staví v lokální soustavě (b.y = 0, osy podle uhel)
  // ======================================================================================
  function stavDum(K, Kd, b, kon) {
    const r = nahodaStavby(b), M = ramec(b);
    let sx = b.sirka, sz = b.delka;
    const H = b.vyska, R = b.strecha || 0, hl = hloubkaZakladu(kon.teren, b, b.sirka, b.delka);
    for (const S of Object.values(K).concat(Object.values(Kd))) S.nastav(M);
    const stena = smichej(r.vyber(OMITKY), [1, 1, 1], r() * 0.2), str = smichej(r.vyber(STRECHY), [0.42, 0.4, 0.39], 0.1 + r() * 0.35);
    const sedaStrecha = r() < 0.18;
    K.omitka.uo = r() * 4; K.omitka.vo = r() * 4;
    // sokl a stěny
    K.omitka.odstin(smichej(SOKL, stena, 0.3)).kvadr(-sx / 2 - 0.04, hl, -sz / 2 - 0.04, sx / 2 + 0.04, 0.55, sz / 2 + 0.04, 'y');
    K.omitka.odstin(stena).kvadr(-sx / 2, 0.55, -sz / 2, sx / 2, H, sz / 2, 'yY');
    // střecha
    const typ = (R > 0 && sx > 4 && r() < 0.3) ? 'valbova' : 'sedlova';
    const info = R > 0.2 ? strecha(K, sx, sz, H, R, { typ, barva: str, odbarveni: sedaStrecha ? 0.85 : r() * 0.15, barvaStitu: stena }) : null;
    if (info && typ === 'sedlova' && sz > 7 && r() < 0.35) panely(K, info, r() < 0.5 ? 1 : -1, sz, r);
    else { K.kov.odstin(barva('#5a5752')).kvadr(-sx / 2 - 0.2, H, -sz / 2 - 0.2, sx / 2 + 0.2, H + 0.25, sz / 2 + 0.2, 'y'); }
    if (R > 0.2) komin(K, (r() - 0.5) * 0.6, (r() - 0.5) * sz * 0.6, H, H + R + 0.9, r);
    // okna a dveře
    const typOkna = r() < 0.55 ? OKNO.klasicke : OKNO.plastove, patra = H > 5.3 ? 2 : 1;
    const ke = lokalniSmer(M, smerKCeste(kon.cesty, b.x, b.z)) || [0, 1];
    const S4 = steny(sx, sz);
    let dvereSt = 0, nej = -9;
    S4.forEach((st, i) => { const d = st.n[0] * ke[0] + st.n[2] * ke[1] + (st.dlouha ? 0.25 : 0); if (d > nej) { nej = d; dvereSt = i; } });
    S4.forEach((st, i) => {
      const n = Math.max(1, Math.floor((st.L - 0.8) / 2.5)), roz = st.L / n;
      const dvereI = i === dvereSt ? (n > 2 ? 1 : 0) : -1;
      for (let k = 0; k < n; k++) {
        const s = -st.L / 2 + roz * (k + 0.5);
        for (let pa = 0; pa < patra; pa++) {
          if (k === dvereI && pa === 0) {
            K.okna.odstin([1, 1, 1]); K.okna.x = r() < 0.3 ? 0.5 : 0;
            prvek(K.okna, st, s, 0.45, 1.05, 2.15, 0.02, uvBunky(OKNO.dvere)); K.okna.x = 0;
            K.kamen.odstin(barva('#9a958c')); kvadrNaStene(K.kamen, st, s - 0.75, s + 0.75, hl, 0.45, 0, 0.6, '');
            continue;
          }
          if (!st.dlouha && pa === 0 && k === 0 && n > 1 && r() < 0.15) { prvek(K.okna, st, s, 0.45, Math.min(2.6, roz - 0.3), 2.2, 0.02, uvBunky(OKNO.garaz)); continue; }
          okno(K, Kd, st, s, 1.35 + pa * 2.8, typOkna === OKNO.klasicke ? 1.0 : 1.15, 1.3, typOkna, r);
        }
      }
      if (!st.dlouha && R > 2.8) okno(K, Kd, st, 0, H + R * 0.32, 0.65, 0.7, OKNO.pudni, r, { sviti: 0, samb: false, parapet: false });
    });
    // okapy a svod (detail)
    if (R > 0.2 && typ === 'sedlova') {
      const k = R / (sx / 2), ye = H - 0.5 * k;
      Kd.kov.odstin(barva('#7a7670'));
      for (const s of [-1, 1]) {
        Kd.kov.kvadr(s * (sx / 2 + 0.5) - 0.07, ye - 0.3, -sz / 2 - 0.35, s * (sx / 2 + 0.5) + 0.07, ye - 0.16, sz / 2 + 0.35, '');
        Kd.kov.kvadr(s * (sx / 2 + 0.06) - 0.04, 0.2, sz / 2 - 0.3, s * (sx / 2 + 0.06) + 0.04, ye - 0.2, sz / 2 - 0.22, 'y');
      }
    }
    K.omitka.uo = K.omitka.vo = 0;
  }

  function stavStodola(K, Kd, b, kon) {
    const r = nahodaStavby(b), M = ramec(b);
    let sx = b.sirka, sz = b.delka;
    const H = b.vyska, R = b.strecha || 0, hl = hloubkaZakladu(kon.teren, b, b.sirka, b.delka);
    for (const S of Object.values(K).concat(Object.values(Kd))) S.nastav(M);
    const drevena = r() < 0.6, ton = 0.75 + r() * 0.4;
    K.kamen.odstin(barva('#a39e94')).kvadr(-sx / 2 - 0.05, hl, -sz / 2 - 0.05, sx / 2 + 0.05, 0.6, sz / 2 + 0.05, 'y');
    const drB = [ton, ton * (0.95 + r() * 0.08), ton * (0.9 + r() * 0.1)];
    K.drevo.uo = r() * 2;
    let stit = K.drevo;
    if (drevena) K.drevo.odstin(drB).kvadr(-sx / 2, 0.6, -sz / 2, sx / 2, H, sz / 2, 'yY');
    else { K.omitka.odstin(smichej(r.vyber(OMITKY), [0.6, 0.58, 0.55], 0.35)).kvadr(-sx / 2, 0.6, -sz / 2, sx / 2, H, sz / 2, 'yY'); stit = r() < 0.6 ? K.drevo : K.omitka; }
    K.drevo.odstin(drB);
    const str = smichej(r.vyber(STRECHY), [0.45, 0.42, 0.4], 0.2 + r() * 0.4);
    if (R > 0.2) strecha(K, sx, sz, H, R, { barva: str, odbarveni: r() < 0.35 ? 0.8 : r() * 0.3, previs: 0.6, stitPrevis: 0.4, stit, barvaStitu: stit === K.drevo ? drB : undefined });
    const S4 = steny(sx, sz), hlavni = r() < 0.5 ? 0 : 1;
    const gw = Math.min(4.2, sz * 0.4), gh = Math.min(3.8, H - 0.4);
    K.okna.odstin([1, 1, 1]);
    prvek(K.okna, S4[hlavni], (r() - 0.5) * (sz - gw - 2), 0.05, gw, gh, 0.03, uvBunky(OKNO.vrata));
    prvek(K.okna, S4[2], (r() - 0.5) * (sx - 2), 0.6, 1.0, 2.0, 0.03, uvBunky(OKNO.dvirka));
    if (R > 2.5) prvek(K.okna, S4[3], 0, H + R * 0.35, 0.9, 0.9, 0.03, uvBunky(OKNO.otvor));
    if (drevena) {    // svislé latě přes spáry a vodorovné vaznice (detail)
      Kd.drevo.odstin(nasob(drB, 0.75));
      for (const st of S4) for (const yy of [1.4, H - 0.4]) kvadrNaStene(Kd.drevo, st, -st.L / 2, st.L / 2, yy, yy + 0.16, 0, 0.06, '');
    }
    K.drevo.uo = 0;
  }

  // kostel: loď s presbytářem (apsidou) na straně odvrácené od věže
  function stavKostel(K, Kd, b, kon) {
    const r = nahodaStavby(b), M = ramec(b);
    let sx = b.sirka, sz = b.delka;
    const H = b.vyska, R = b.strecha || sx * 0.45, hl = hloubkaZakladu(kon.teren, b, b.sirka, b.delka);
    for (const S of Object.values(K).concat(Object.values(Kd))) S.nastav(M);
    // kde je věž? (oltář/apsida je na +z, věž na −z; apsida leží uvnitř půdorysu kvůli kolizím)
    let e = 1;
    const vez = kon.stavby.find(v => v.typ === 'vez' && Math.hypot(v.x - b.x, v.z - b.z) < Math.max(sx, sz) + 15);
    if (vez) { const l = lokalniSmer(M, [vez.x - b.x, vez.z - b.z]); if (l && l[1] > 0) e = -1; }
    const stena = r() < 0.5 ? barva('#f1ece0') : barva('#ecd9a6'), akcent = stena[2] > 0.6 ? barva('#e3c98a') : barva('#f6f3ea');
    const str = r() < 0.6 ? barva('#a85a40') : barva('#5c5650');
    const ra0 = sx / 2 - 0.5, Ml = M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -e * ra0 / 2));
    sz = sz - ra0;
    for (const S of Object.values(K).concat(Object.values(Kd))) S.nastav(Ml);
    K.kamen.odstin(barva('#b4ada0')).kvadr(-sx / 2 - 0.12, hl, -sz / 2 - 0.12, sx / 2 + 0.12, 0.8, sz / 2 + 0.12, 'y');
    K.omitka.odstin(stena).kvadr(-sx / 2, 0.8, -sz / 2, sx / 2, H, sz / 2, 'yY');
    K.omitka.odstin(akcent).kvadr(-sx / 2 - 0.18, H - 0.45, -sz / 2 - 0.18, sx / 2 + 0.18, H, sz / 2 + 0.18, 'y');    // římsa
    strecha(K, sx, sz, H, R, { barva: str, odbarveni: str[0] < 0.2 ? 0.7 : 0.1, previs: 0.45, stitPrevis: 0.3, barvaStitu: stena });
    const S4 = steny(sx, sz);
    for (const st of S4.slice(0, 2)) {                               // dlouhé stěny: lizény a vysoká okna
      const n = Math.max(2, Math.round(sz / 4.6)), roz = sz / n;
      Kd.omitka.odstin(akcent);
      for (let k = 0; k <= n; k++) kvadrNaStene(K.omitka.odstin(akcent), st, -sz / 2 + roz * k - 0.35, -sz / 2 + roz * k + 0.35, 0.8, H - 0.45, 0, 0.1, 'y');
      for (let k = 0; k < n; k++) okno(K, null, st, -sz / 2 + roz * (k + 0.5), 2.4, 1.45, Math.min(3.4, H - 3.2), OKNO.kostelni, r, { sviti: r() < 0.5 ? 0.5 : 0 });
    }
    const celo = e > 0 ? S4[3] : S4[2];                               // průčelí (bez apsidy): portál, okno nad ním
    K.kamen.odstin(barva('#c9c2b2')); kvadrNaStene(K.kamen, celo, -1.15, 1.15, 0.0, 3.4, 0, 0.18, 'y');
    K.okna.odstin([1, 1, 1]); prvek(K.okna, celo, 0, 0.0, 1.7, 3.1, 0.2, uvBunky(OKNO.dvere));
    okno(K, null, celo, 0, H - 0.4, 1.2, 2.2, OKNO.kostelni, r, { sviti: 0 });
    // apsida (půlválec se střechou jako půlkužel) na konci zkrácené lodi
    const ra = ra0, ha = H * 0.92, zA = e * sz / 2;
    K.omitka.odstin(stena);
    K.omitka.sMatici(new THREE.Matrix4().makeTranslation(0, 0, zA), () => {
      K.omitka.rotacni([[ra, 0.8], [ra, ha]], 12, { fi0: e > 0 ? -Math.PI : 0, fi1: e > 0 ? 0 : Math.PI });
    });
    K.kamen.sMatici(new THREE.Matrix4().makeTranslation(0, 0, zA), () => {
      K.kamen.odstin(barva('#b4ada0')).rotacni([[ra + 0.12, hl], [ra + 0.12, 0.8], [ra, 0.8]], 12, { fi0: e > 0 ? -Math.PI : 0, fi1: e > 0 ? 0 : Math.PI });
    });
    K.strecha.sMatici(new THREE.Matrix4().makeTranslation(0, 0, zA), () => {
      K.strecha.odstin(str).rotacni([[ra + 0.45, ha - 0.25], [0.05, ha + R * 0.75]], 12, { fi0: e > 0 ? -Math.PI : 0, fi1: e > 0 ? 0 : Math.PI });
    });
    for (const f of [-0.7, 0, 0.7]) {                                  // okna apsidy
      const fi = f, px = Math.sin(fi) * (ra + 0.03), pz = zA + e * Math.cos(fi) * (ra + 0.03), n = [Math.sin(fi), 0, e * Math.cos(fi)];
      const st = { c: [px, 0, pz], n, u: [n[2], 0, -n[0]], L: 1 };
      okno(K, null, st, 0, 2.6, 1.1, Math.min(3, ha - 3.4), OKNO.kostelni, r, { sviti: 0 });
    }
  }

  // kostelní věž: hranol s římsami, hodiny, zvonice, cibulová báň nebo jehlan, kříž
  function stavVez(K, Kd, b, kon) {
    const r = nahodaStavby(b), M = ramec(b), sx = b.sirka, sz = b.delka, H = b.vyska, R = b.strecha || sx * 1.6;
    const hl = hloubkaZakladu(kon.teren, b, sx, sz);
    for (const S of Object.values(K).concat(Object.values(Kd))) S.nastav(M);
    const kostel = kon.stavby.find(v => v.typ === 'kostel' && Math.hypot(v.x - b.x, v.z - b.z) < 40);
    const stena = kostel ? (nahodaStavby(kostel)() < 0.5 ? barva('#f1ece0') : barva('#ecd9a6')) : barva('#efe7d4');
    const akcent = stena[2] > 0.6 ? barva('#e3c98a') : barva('#f6f3ea');
    K.kamen.odstin(barva('#b4ada0')).kvadr(-sx / 2 - 0.15, hl, -sz / 2 - 0.15, sx / 2 + 0.15, 1.0, sz / 2 + 0.15, 'y');
    K.omitka.odstin(stena).kvadr(-sx / 2, 1.0, -sz / 2, sx / 2, H, sz / 2, 'y');
    for (const yy of [H * 0.42, H * 0.7, H - 0.5]) K.omitka.odstin(akcent).kvadr(-sx / 2 - 0.15, yy, -sz / 2 - 0.15, sx / 2 + 0.15, yy + 0.4, sz / 2 + 0.15, '');
    for (const [qx, qz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])    // nárožní lizény
      K.omitka.odstin(akcent).kvadr(qx > 0 ? sx / 2 - 0.6 : -sx / 2 - 0.08, 1.0, qz > 0 ? sz / 2 - 0.6 : -sz / 2 - 0.08, qx > 0 ? sx / 2 + 0.08 : -sx / 2 + 0.6, H - 0.5, qz > 0 ? sz / 2 + 0.08 : -sz / 2 + 0.6, 'yY');
    const S4 = steny(sx, sz);
    let dvereSt = 2;
    if (kostel) { const l = lokalniSmer(M, [b.x - kostel.x, b.z - kostel.z]); if (l) { let nej = -9; S4.forEach((st, i) => { const d = st.n[0] * l[0] + st.n[2] * l[1]; if (d > nej) { nej = d; dvereSt = i; } }); } }
    S4.forEach((st, i) => {
      if (i === dvereSt) { K.okna.odstin([1, 1, 1]); prvek(K.okna, st, 0, 0.0, 1.5, 2.8, 0.03, uvBunky(OKNO.dvere)); }
      okno(K, null, st, 0, H * 0.5, 0.7, 1.1, OKNO.kostelni, r, { sviti: 0 });
      prvek(K.okna, st, 0, H * 0.7 + 0.6, Math.min(1.3, st.L * 0.3), Math.min(2.4, H * 0.3 - 3.2), 0.03, uvBunky(OKNO.zaluzie));
      const hd = Math.min(1.8, st.L * 0.38);
      prvek(K.okna, st, 0, H - 0.5 - hd - 0.35, hd, hd, 0.05, uvBunky(OKNO.hodiny));
    });
    // báň / jehlan
    const rc = Math.hypot(sx, sz) / 2, rr = Math.min(sx, sz) / 2, Kv = K.kov;
    const med = r() < 0.5, bar = med ? barva('#4f8a74') : barva('#3b3a3c');
    Kv.odstin(bar);
    Kv.sMatici(new THREE.Matrix4().makeTranslation(0, H, 0), () => {
      if (r() < 0.6) {          // cibule
        Kv.sMatici(new THREE.Matrix4().makeRotationY(Math.PI / 4), () => Kv.rotacni([[rc + 0.25, -0.05], [rr * 0.85, R * 0.12]], 4));
        Kv.rotacni([[rr * 0.86, R * 0.1], [rr * 0.95, R * 0.2], [rr * 0.62, R * 0.32], [rr * 0.42, R * 0.4], [rr * 0.6, R * 0.47], [rr * 0.55, R * 0.55], [rr * 0.2, R * 0.66],
          [rr * 0.17, R * 0.7], [rr * 0.24, R * 0.72], [rr * 0.24, R * 0.8], [rr * 0.32, R * 0.82], [rr * 0.08, R * 0.9], [0.06, R * 0.93]], 12);
      } else {                  // jehlan
        Kv.sMatici(new THREE.Matrix4().makeRotationY(Math.PI / 4), () => Kv.rotacni([[rc + 0.35, -0.1], [rc * 0.82, R * 0.12], [0.05, R * 0.93]], 4));
      }
      Kv.odstin(barva('#c9a648'));                 // zlatá koule a kříž
      Kv.rotacni([[0.0, R * 0.92], [0.18, R * 0.94], [0.18, R * 0.97], [0, R * 0.99]], 8);
      Kv.kvadr(-0.05, R * 0.98, -0.05, 0.05, R * 0.98 + 1.6, 0.05, '');
      Kv.kvadr(-0.45, R * 0.98 + 0.95, -0.05, 0.45, R * 0.98 + 1.05, 0.05, '');
    });
  }

  function stavKaple(K, Kd, b, kon) {
    const r = nahodaStavby(b), M = ramec(b);
    let sx = b.sirka, sz = b.delka;
    const H = b.vyska, R = b.strecha || sx * 0.6, hl = hloubkaZakladu(kon.teren, b, b.sirka, b.delka);
    for (const S of Object.values(K).concat(Object.values(Kd))) S.nastav(M);
    const stena = r() < 0.5 ? barva('#f3efe4') : barva('#ecd7a0');
    K.kamen.odstin(barva('#a8a296')).kvadr(-sx / 2 - 0.06, hl, -sz / 2 - 0.06, sx / 2 + 0.06, 0.4, sz / 2 + 0.06, 'y');
    K.omitka.odstin(stena).kvadr(-sx / 2, 0.4, -sz / 2, sx / 2, H, sz / 2, 'yY');
    strecha(K, sx, sz, H, R, { barva: r() < 0.7 ? barva('#a85a40') : barva('#5c5650'), previs: 0.3, stitPrevis: 0.25, barvaStitu: stena });
    const ke = lokalniSmer(M, smerKCeste(kon.cesty, b.x, b.z)) || [0, 1], e = ke[1] >= 0 ? 1 : -1;
    const S4 = steny(sx, sz), celo = e > 0 ? S4[2] : S4[3];
    K.okna.odstin([1, 1, 1]); prvek(K.okna, celo, 0, 0.4, Math.min(1.2, sx * 0.4), Math.min(2.3, H - 0.6), 0.03, uvBunky(OKNO.dvere));
    for (const st of S4.slice(0, 2)) okno(K, null, st, 0, 1.4, 0.6, Math.min(1.4, H - 1.8), OKNO.kostelni, r, { sviti: 0 });
    // zvonička na hřebeni nad průčelím
    const zz = e * (sz / 2 - 0.5), yb = H + R - 0.4;
    K.omitka.odstin(stena).kvadr(-0.35, yb - 0.6, zz - 0.35, 0.35, yb + 0.9, zz + 0.35, 'y');
    K.okna.odstin([1, 1, 1]);
    for (const st of steny(0.7, 0.7)) prvek(K.okna, { c: [st.c[0], 0, st.c[2] + zz], n: st.n, u: st.u }, 0, yb + 0.1, 0.4, 0.65, 0.01, uvBunky(OKNO.zaluzie));
    K.kov.odstin(barva('#4f8a74'));
    K.kov.sMatici(new THREE.Matrix4().makeTranslation(0, yb + 0.9, zz).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 4)), () => K.kov.rotacni([[0.62, 0], [0.05, 1.0]], 4));
    K.kov.odstin(barva('#c9a648')).kvadr(-0.03, yb + 1.85, zz - 0.03, 0.03, yb + 2.6, zz + 0.03, '');
    K.kov.kvadr(-0.22, yb + 2.3, zz - 0.03, 0.22, yb + 2.36, zz + 0.03, '');
  }

  // rozhledna: dřevěná (trámová) nebo ocelová příhradová věž s vyhlídkovou plošinou a stříškou
  function stavRozhledna(K, Kd, b, kon) {
    const r = nahodaStavby(b), M = ramec(b), H = b.vyska, R = b.strecha || 2.5;
    for (const S of Object.values(K).concat(Object.values(Kd))) S.nastav(M);
    const ocel = (b.material || '') === 'ocel' || (b.material == null && r() < 0.4);
    const S = ocel ? K.kov : K.drevo, Sd = ocel ? Kd.kov : Kd.drevo;
    const a0 = Math.max(2.2, Math.min(b.sirka, b.delka) / 2), a1 = Math.max(1.4, a0 * 0.45), t = ocel ? 0.16 : 0.26;
    S.odstin(ocel ? barva('#8a8f92') : barva('#d8c8b0'));
    const roh = (qx, qz, y) => { const f = y / H, a = a0 + (a1 - a0) * f; return [qx * a, y, qz * a]; };
    const R4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const hl = hloubkaZakladu(kon.teren, b, a0 * 2, a0 * 2);
    K.kamen.odstin(barva('#a09a8f'));
    for (const [qx, qz] of R4) { S.tram(roh(qx, qz, hl), roh(qx, qz, H + 1.1), t, t); const p = roh(qx, qz, 0); K.kamen.kvadr(p[0] - 0.4, hl, p[2] - 0.4, p[0] + 0.4, 0.3, p[2] + 0.4, 'y'); }
    const patra = Math.max(3, Math.round(H / 3.2));
    for (let k = 0; k <= patra; k++) {
      const y0 = H * k / patra;
      for (let q = 0; q < 4; q++) {
        const [ax, az] = R4[q], [bx, bz] = R4[(q + 1) % 4];
        S.tram(roh(ax, az, y0), roh(bx, bz, y0), t * 0.7, t * 0.7);
        if (k < patra) {
          const y1 = H * (k + 1) / patra;
          S.tram(roh(ax, az, y0), roh(bx, bz, y1), t * 0.55, t * 0.55);
          S.tram(roh(bx, bz, y0), roh(ax, az, y1), t * 0.55, t * 0.55);
        }
      }
      if (k < patra) {        // schodišťové rameno uvnitř
        const y1 = H * (k + 1) / patra, s = k % 2 ? 1 : -1, w = Math.min(0.9, a1 * 0.6);
        Sd.odstin(ocel ? barva('#6d7174') : barva('#b8a68a'));
        Sd.tram([s * 0.45, y0 + 0.05, -a1 * 0.8 * s], [s * 0.45, y1 + 0.05, a1 * 0.8 * s], w, 0.08);
      }
    }
    // plošina, zábradlí, stříška na sloupcích
    const ap = a1 + 0.5;
    K.drevo.odstin(barva('#b59f80')).kvadr(-ap, H, -ap, ap, H + 0.18, ap, '');
    S.odstin(ocel ? barva('#8a8f92') : barva('#cbb99e'));
    for (const [qx, qz] of R4) S.tram([qx * ap * 0.95, H + 0.18, qz * ap * 0.95], [qx * ap * 0.95, H + 2.5, qz * ap * 0.95], 0.14, 0.14);
    for (let q = 0; q < 4; q++) {
      const [ax, az] = R4[q], [bx, bz] = R4[(q + 1) % 4];
      for (const yy of [0.55, 1.1]) S.tram([ax * ap * 0.95, H + 0.18 + yy, az * ap * 0.95], [bx * ap * 0.95, H + 0.18 + yy, bz * ap * 0.95], 0.09, 0.09);
      for (let k = 1; k < 8; k++) { const f = k / 8; Sd.tram([(ax + (bx - ax) * f) * ap * 0.95, H + 0.18, (az + (bz - az) * f) * ap * 0.95], [(ax + (bx - ax) * f) * ap * 0.95, H + 1.29, (az + (bz - az) * f) * ap * 0.95], 0.04, 0.04); }
    }
    K.strecha.odstin(ocel ? barva('#6a4a3c') : barva('#8a6a58')); K.strecha.x = ocel ? 0.2 : 0.6;
    K.strecha.sMatici(new THREE.Matrix4().makeTranslation(0, H + 2.5, 0).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 4)), () => K.strecha.rotacni([[ap * 1.414 + 0.5, -0.05], [0.05, R]], 4));
    K.strecha.x = 0;
    K.drevo.odstin(barva('#6a5a48')).kvadr(-ap - 0.35, H + 2.35, -ap - 0.35, ap + 0.35, H + 2.47, ap + 0.35, 'Y');
  }

  // posed: čtyři nohy z kulatiny, budka s otvorem, pultová stříška, žebřík
  function stavPosed(K, Kd, b, kon) {
    const r = nahodaStavby(b), M = ramec(b), H = b.vyska || 4, w = Math.max(1.2, Math.min(1.8, b.sirka || 1.5));
    for (const S of Object.values(K).concat(Object.values(Kd))) S.nastav(M);
    const S = K.drevo, hb = 1.6, ton = 0.7 + r() * 0.2;
    S.odstin([ton, ton * 0.95, ton * 0.88]);
    for (const [qx, qz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) S.tram([qx * (w / 2 + 0.35), -0.4, qz * (w / 2 + 0.35)], [qx * w * 0.42, H + hb * 0.4, qz * w * 0.42], 0.14, 0.14);
    for (const [qa, qb] of [[[-1, -1], [1, -1]], [[1, 1], [-1, 1]]]) { S.tram([qa[0] * (w / 2 + 0.2), 0.8, qa[1] * (w / 2 + 0.2)], [qb[0] * w * 0.45, H - 0.3, qb[1] * w * 0.45], 0.08, 0.08); }
    S.kvadr(-w / 2, H, -w / 2, w / 2, H + hb, w / 2, '');
    K.okna.odstin([1, 1, 1]); prvek(K.okna, steny(w, w)[3], 0, H + 0.85, w * 0.75, 0.45, 0.02, uvBunky(OKNO.otvor));
    K.strecha.odstin(barva('#3a3a3c')); K.strecha.x = 1;
    K.strecha.plocha([-w / 2 - 0.25, H + hb + 0.1, w / 2 + 0.3], [w / 2 + 0.25, H + hb + 0.1, w / 2 + 0.3], [w / 2 + 0.25, H + hb + 0.45, -w / 2 - 0.3], [-w / 2 - 0.25, H + hb + 0.45, -w / 2 - 0.3], 0, 0, w, w, [0, 1, 0.2]);
    K.strecha.x = 0;
    S.kvadr(-w / 2 - 0.25, H + hb + 0.05, -w / 2 - 0.3, w / 2 + 0.25, H + hb + 0.1, w / 2 + 0.3, 'Y');
    // žebřík na zadní straně
    const zz = w / 2 + 0.05, zb = zz + H * 0.35;
    for (const sx of [-0.25, 0.25]) Kd.drevo.tram([sx, -0.2, zb], [sx, H + 0.1, zz], 0.07, 0.07);
    for (let k = 1; k < H / 0.35; k++) { const f = k * 0.35 / H; Kd.drevo.tram([-0.25, -0.2 + (H + 0.3) * f, zb + (zz - zb) * f], [0.25, -0.2 + (H + 0.3) * f, zb + (zz - zb) * f], 0.05, 0.05); }
  }

  // kulatý balík sena: osa válce podél lokální z (delka), průměr sirka (= vyska); některé zabalené ve fólii
  function stavSeno(K, Kd, b) {
    const r = nahodaStavby(b), M = ramec(b), rr = Math.max(0.4, (b.sirka || b.vyska || 1.4) / 2), L = b.delka || 1.2;
    const S = K.seno; S.nastav(M);
    const fol = r() < 0.4, ton = 0.85 + r() * 0.25;
    const prof = [[0, -L / 2], [rr * 0.88, -L / 2], [rr * 0.98, -L / 2 + 0.06], [rr, -L / 2 + 0.15], [rr, L / 2 - 0.15], [rr * 0.98, L / 2 - 0.06], [rr * 0.88, L / 2], [0, L / 2]];
    S.odstin(fol ? (r() < 0.8 ? [0.95, 0.95, 0.93] : [0.12, 0.12, 0.12]) : [ton, ton * 0.97, ton * 0.9]);
    S.sMatici(new THREE.Matrix4().makeTranslation(0, rr - 0.05, 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), () => S.rotacni(prof, 14, fol ? { vRozsah: [0.88, 0.98] } : {}));
  }

  // most: horní plocha mostovky v b.y, konstrukce 0.9 m pod ní (jako kolize.js), zábradlí 1.1 m po
  // podélných okrajích; pod mostovkou volno (žádné pilíře v rozpětí), opěry za konci na březích.
  function stavMost(K, Kd, b, kon) {
    const r = nahodaStavby(b), M = ramec(b), w = b.sirka || 5, L = b.delka || 20, t = kon.teren;
    for (const S of Object.values(K).concat(Object.values(Kd))) S.nastav(M);
    const kamenny = (b.material || '') === 'kamen' || (b.material == null && r() < 0.5);
    const c = Math.cos(b.uhel || 0), s = Math.sin(b.uhel || 0);
    const zemL = z => t.vyska(b.x + z * s, b.z + z * c) - b.y;      // terén pod osou mostu (lokální z)
    const Ka = K.kamen, tl = 0.9;
    // nosná deska (lehce klenutý podhled u kamenného)
    Ka.odstin(kamenny ? barva('#b3a890') : barva('#bdbcb6'));
    Ka.kvadr(-w / 2, -tl, -L / 2, w / 2, 0, L / 2, 'Y');
    Ka.odstin(kamenny ? barva('#a39a84') : barva('#a9a8a2'));
    Ka.kvadr(-w / 2 - 0.12, -0.35, -L / 2, w / 2 + 0.12, 0.0, L / 2, 'y');         // římsa
    // opěry: od konců mostu dál do svahu a dolů do terénu
    for (const e of [-1, 1]) {
      const z0 = e > 0 ? L / 2 : -L / 2 - 3, z1 = e > 0 ? L / 2 + 3 : -L / 2;
      const dno = Math.min(zemL(e * L / 2), zemL(e * (L / 2 + 3)), -tl) - 1.5;
      Ka.odstin(kamenny ? barva('#a9a08a') : barva('#b5b4ae')).kvadr(-w / 2 - 0.4, dno, z0, w / 2 + 0.4, 0, z1, 'y');
      for (const sx of [-1, 1]) Ka.kvadr(sx > 0 ? w / 2 : -w / 2 - 0.4, 0, z0, sx > 0 ? w / 2 + 0.4 : -w / 2, 0.9, z1, 'y');   // křídla
    }
    if (kamenny) {                                 // kamenná zídka místo zábradlí
      Ka.odstin(barva('#a89e88'));
      for (const sx of [-1, 1]) Ka.kvadr(sx > 0 ? w / 2 - 0.3 : -w / 2, 0, -L / 2, sx > 0 ? w / 2 : -w / 2 + 0.3, 1.0, L / 2, 'y');
      Ka.odstin(barva('#c2b9a3'));
      for (const sx of [-1, 1]) Ka.kvadr(sx > 0 ? w / 2 - 0.34 : -w / 2 - 0.04, 1.0, -L / 2, sx > 0 ? w / 2 + 0.04 : -w / 2 + 0.34, 1.1, L / 2, 'y');
    } else {                                       // ocelové zábradlí: madlo, prostřední tyč, sloupky
      K.kov.odstin(barva('#6f7d7a'));
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - 0.075);
        K.kov.kvadr(x - 0.06, 1.02, -L / 2, x + 0.06, 1.1, L / 2, '');
        K.kov.kvadr(x - 0.025, 0.5, -L / 2, x + 0.025, 0.55, L / 2, '');
        for (let z = -L / 2; z <= L / 2 + 0.01; z += 1.9) K.kov.kvadr(x - 0.04, 0, z - 0.04, x + 0.04, 1.02, z + 0.04, 'y');
        Ka.odstin(barva('#a9a8a2')).kvadr(sx > 0 ? w / 2 - 0.35 : -w / 2, 0, -L / 2, sx > 0 ? w / 2 : -w / 2 + 0.35, 0.18, L / 2, 'y');   // obrubník
      }
    }
    K.kamen.odstin(barva('#4a4845'));                                  // asfalt mostovky
    K.kamen.kvadr(-w / 2 + 0.35, 0, -L / 2 - 3, w / 2 - 0.35, 0.03, L / 2 + 3, 'y');
  }

  // plot / ohrada: rovný úsek podél lokální z (delka), tloušťka sirka, výška vyska; sloupky sledují terén.
  // plot = laťkový plot (zahrady), zed: true = omítnutá zídka se stříškou (hřbitov), ohrada = ohrada z tyčí.
  // (Starší podoba ohrady jako obdélníku: sirka > 3 → obvod sirka × delka.)
  function stavPlot(K, Kd, b, kon) {
    const r = nahodaStavby(b), t = kon.teren, H = b.vyska || 1.2;
    const c = Math.cos(b.uhel || 0), s = Math.sin(b.uhel || 0);
    const sv = (lx, lz) => [b.x + lx * c + lz * s, b.z - lx * s + lz * c];
    let cary;
    if (b.typ === 'ohrada' && b.sirka > 3) { const a = b.sirka / 2, d = b.delka / 2; cary = [[[-a, -d], [a, -d]], [[a, -d], [a, d]], [[a, d], [-a, d]], [[-a, d], [-a, -d]]]; }
    else cary = b.sirka > b.delka ? [[[-b.sirka / 2, 0], [b.sirka / 2, 0]]] : [[[0, -b.delka / 2], [0, b.delka / 2]]];
    const I = new THREE.Matrix4();
    for (const S of [K.drevo, Kd.drevo, K.omitka, K.strecha, K.kamen]) S.nastav(I);
    if (b.zed) {                                    // zídka: kusy po ~3 m, každý od nejnižšího terénu
      const tl = Math.max(0.3, Math.min(0.7, b.sirka || 0.5)), barvaZ = smichej(barva('#e6dfcf'), [0.75, 0.73, 0.7], r() * 0.4);
      for (const [A, B] of cary) {
        const L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.max(1, Math.ceil(L / 3)), u = (b.uhel || 0) + Math.atan2(B[0] - A[0], B[1] - A[1]);
        for (let k = 0; k < n; k++) {
          const f0 = k / n, f1 = (k + 1) / n, p0 = sv(A[0] + (B[0] - A[0]) * f0, A[1] + (B[1] - A[1]) * f0), p1 = sv(A[0] + (B[0] - A[0]) * f1, A[1] + (B[1] - A[1]) * f1);
          const y0 = Math.min(t.vyska(p0[0], p0[1]), t.vyska(p1[0], p1[1])), y1 = Math.max(t.vyska(p0[0], p0[1]), t.vyska(p1[0], p1[1]));
          const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2, l = L / n + 0.02;
          const Mk = new THREE.Matrix4().makeRotationY(u).setPosition(mx, y0, mz);
          K.omitka.nastav(Mk); K.strecha.nastav(Mk); K.kamen.nastav(Mk);
          const h = H + (y1 - y0) * 0.5;
          K.kamen.odstin(barva('#9b968b')).kvadr(-tl / 2 - 0.03, -0.4, -l / 2, tl / 2 + 0.03, 0.35, l / 2, 'y');
          K.omitka.odstin(barvaZ).kvadr(-tl / 2, 0.35, -l / 2, tl / 2, h, l / 2, 'y');
          K.strecha.odstin(barva('#a5583e')); K.strecha.x = 0.1;
          K.strecha.plocha([tl / 2 + 0.08, h - 0.04, -l / 2], [tl / 2 + 0.08, h - 0.04, l / 2], [0, h + 0.18, l / 2], [0, h + 0.18, -l / 2], -l / 2, 0, l / 2, 0.4, [1, 1, 0]);
          K.strecha.plocha([-tl / 2 - 0.08, h - 0.04, -l / 2], [-tl / 2 - 0.08, h - 0.04, l / 2], [0, h + 0.18, l / 2], [0, h + 0.18, -l / 2], -l / 2, 0, l / 2, 0.4, [-1, 1, 0]);
          K.strecha.x = 0;
        }
      }
      return;
    }
    const ton = 0.65 + r() * 0.3, latkovy = b.typ === 'plot';
    K.drevo.odstin([ton, ton * 0.93, ton * 0.85]); Kd.drevo.odstin([ton * 1.05, ton, ton * 0.92]);
    for (const [A, B] of cary) {
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.max(1, Math.ceil(L / (latkovy ? 2.4 : 3.2)));
      const body = [];
      for (let k = 0; k <= n; k++) { const f = k / n, p = sv(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f); body.push([p[0], t.vyska(p[0], p[1]), p[1]]); }
      for (const p of body) K.drevo.tram([p[0], p[1] - 0.3, p[2]], [p[0], p[1] + H + 0.05, p[2]], 0.12, 0.12, true);
      const tyce = latkovy ? [0.3, H - 0.25] : [0.45, 0.8, H - 0.1];
      for (let k = 0; k < n; k++) {
        const a = body[k], q = body[k + 1];
        for (const yy of tyce) K.drevo.tram([a[0], a[1] + yy, a[2]], [q[0], q[1] + yy, q[2]], latkovy ? 0.04 : 0.09, latkovy ? 0.09 : 0.09);
        if (latkovy) {
          const m = Math.floor(Math.hypot(q[0] - a[0], q[2] - a[2]) / 0.13);
          for (let j = 1; j < m; j++) {
            const f = j / m, x = a[0] + (q[0] - a[0]) * f, z = a[2] + (q[2] - a[2]) * f, y = a[1] + (q[1] - a[1]) * f;
            Kd.drevo.tram([x, y + 0.05, z], [x, y + H, z], 0.07, 0.02, true);
          }
        }
      }
    }
  }

  // stožár vedení: betonový sloup (H < 16) nebo příhradový stožár „soudek“; kolm = [kx, kz] = lokální x
  // (směr konzol), uch = [[dx, výška]…] úchyty vodičů, pul = půlšířka paty (stavba stozar: sirka / 2)
  function stavStozar(K, Kd, x, y, z, H, kolm, uch, pul) {
    const uhel = Math.atan2(-kolm[1], kolm[0]);                        // makeRotationY: lokální x → (cos, −sin)
    const M = new THREE.Matrix4().makeRotationY(uhel).setPosition(x, y, z);
    K.kov.nastav(M); K.kamen.nastav(M); Kd.kov.nastav(M);
    uch = uch || G.uchyceni(H);
    if (H < 16) {
      K.kamen.odstin(barva('#c2c0b8'));
      K.kamen.tram([0, -1, 0], [0, H + 0.4, 0], 0.32, 0.22, true);
      K.kov.odstin(barva('#767b7e')).kvadr(-1.7, H - 0.62, -0.06, 1.7, H - 0.5, 0.06, '');
      K.kov.odstin(barva('#d8d4c8'));
      for (const [o, h] of uch) K.kov.sMatici(new THREE.Matrix4().makeTranslation(o, h - 0.36, 0), () => K.kov.rotacni([[0.07, 0.0], [0.09, 0.1], [0.06, 0.18], [0.09, 0.26], [0.05, 0.36]], 6));
      return;
    }
    const Kv = K.kov, b0 = Math.max(1.6, pul || 2.4), b1 = 0.55, hp = H * 0.62, IZ = 0.75;
    Kv.odstin(barva('#9aa0a2'));
    const roh = (qx, qz, yy) => { const f = D.clamp(yy / hp, 0, 1), a = b0 + (b1 - b0) * Math.pow(f, 0.7); return [qx * a, yy, qz * a]; };
    const R4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    K.kamen.odstin(barva('#a5a39c'));
    for (const [qx, qz] of R4) {
      Kv.tram(roh(qx, qz, -0.3), roh(qx, qz, hp), 0.16, 0.16); Kv.tram(roh(qx, qz, hp), [qx * b1, H, qz * b1], 0.12, 0.12);
      const p = roh(qx, qz, 0); K.kamen.kvadr(p[0] - 0.45, -0.6, p[2] - 0.45, p[0] + 0.45, 0.25, p[2] + 0.45, 'y');   // patky
    }
    const n = 6;
    for (let k = 0; k < n; k++) {
      const y0 = hp * k / n, y1 = hp * (k + 1) / n;
      for (let q = 0; q < 4; q++) {
        const [ax, az] = R4[q], [bx, bz] = R4[(q + 1) % 4];
        Kv.tram(roh(ax, az, y0), roh(bx, bz, y1), 0.07, 0.07);
        Kv.tram(roh(bx, bz, y0), roh(ax, az, y1), 0.07, 0.07);
        Kv.tram(roh(ax, az, y1), roh(bx, bz, y1), 0.07, 0.07);
      }
    }
    for (let q = 0; q < 4; q++) { const [ax, az] = R4[q], [bx, bz] = R4[(q + 1) % 4]; Kv.tram([ax * b1, hp, az * b1], [bx * b1, H, bz * b1], 0.06, 0.06); }
    // konzoly: nad každou úrovní bočních vodičů (izolátory visí IZ m), vodič na vrcholu = zemnicí lano na špičce
    const urovne = [...new Set(uch.filter(u => u[0] !== 0).map(u => u[1]))];
    for (const h of urovne) {
      const sir = Math.max(...uch.filter(u => u[1] === h).map(u => Math.abs(u[0]))) + 0.25, ha = h + IZ;
      for (const sx of [-1, 1]) {
        Kv.odstin(barva('#9aa0a2'));
        Kv.tram([sx * b1, ha, -b1], [sx * sir, ha, 0], 0.08, 0.08); Kv.tram([sx * b1, ha, b1], [sx * sir, ha, 0], 0.08, 0.08);
        Kv.tram([sx * b1, Math.min(H, ha + 1.2), 0], [sx * sir, ha, 0], 0.07, 0.07);
      }
      Kv.odstin(barva('#b9c4c0'));                                       // izolátorové řetězce
      for (const [o, hh] of uch) if (hh === h) Kv.sMatici(new THREE.Matrix4().makeTranslation(o, h, 0), () => {
        const prof = [[0.02, 0]]; for (let k = 0; k < 6; k++) { const y0 = 0.08 + k * (IZ - 0.12) / 6; prof.push([0.02, y0], [0.11, y0 + 0.03], [0.02, y0 + 0.07]); }
        prof.push([0.02, IZ]); Kv.rotacni(prof, 6);
      });
    }
    Kv.odstin(barva('#9aa0a2'));
    Kv.tram([-0.5, H, 0], [0.5, H, 0], 0.08, 0.08);
  }

  // závodní branka: polstrovaný rám (zaoblený obdélník) dvoubarevný, číslo nahoře, nožky k zemi
  const BARVY_TRATI = [['#ff6a10', '#f4f4f4'], ['#14b8ff', '#f4f4f4'], ['#9cf00a', '#1a1a1a'], ['#ff2a9a', '#f4f4f4'], ['#ffd400', '#1a1a1a']].map(p => p.map(barva));
  function stavBranku(K, br, id, cislo, barvy, t) {
    const M = ramec(br), S = K.branky; S.nastav(M); S.x = id;
    const w = br.sirka || 2, h = br.vyska || 2, tl = G.TL_BRANKY, zd = G.ZDVIH_BRANKY;
    const hw = w / 2 + tl / 2, y0 = zd - tl / 2, y1 = zd + h + tl / 2, rc = 0.3;
    // obvod zaobleného obdélníku po krocích; na hranicích barevných pruhů zdvojený bod (ostrý přechod)
    const prim = [], P2 = Math.PI / 2;
    const U = (ax, ay, bx, by) => prim.push({ l: Math.hypot(bx - ax, by - ay), f: q => [ax + (bx - ax) * q, ay + (by - ay) * q] });
    const O = (cx, cy, a0) => prim.push({ l: rc * P2, f: q => [cx + Math.cos(a0 + q * P2) * rc, cy + Math.sin(a0 + q * P2) * rc] });
    U(0, y0, hw - rc, y0); O(hw - rc, y0 + rc, -P2); U(hw, y0 + rc, hw, y1 - rc); O(hw - rc, y1 - rc, 0);
    U(hw - rc, y1, -hw + rc, y1); O(-hw + rc, y1 - rc, P2); U(-hw, y1 - rc, -hw, y0 + rc); O(-hw + rc, y0 + rc, Math.PI); U(-hw + rc, y0, 0, y0);
    const celk = prim.reduce((a, q) => a + q.l, 0), pruh = 1.0, npr = Math.ceil(celk / pruh - 0.05);
    const zlom = [];                                  // [s, hranice pruhu?]
    let s0 = 0;
    for (const q of prim) { const n = q.l < 1 ? 4 : 1; for (let k = 0; k < n; k++) zlom.push([s0 + q.l * k / n, false]); s0 += q.l; }
    for (let k = 1; k < npr; k++) zlom.push([k * pruh, true]);
    zlom.sort((a, b) => a[0] - b[0]);
    const bod = sx => { let s1 = sx; for (const q of prim) { if (s1 <= q.l + 1e-6) return q.f(Math.min(1, s1 / (q.l || 1))); s1 -= q.l; } return prim[prim.length - 1].f(1); };
    const cesta = [], bar = [], pruhC = sx => Math.min(npr - 1, Math.floor(sx / pruh + 1e-6));
    cesta.push(bod(0)); bar.push(barvy[(npr - 1) % 2]);
    for (const [sx, hr] of zlom) {
      if (hr) { cesta.push(bod(sx)); bar.push(barvy[(pruhC(sx) - 1) % 2]); }
      cesta.push(bod(sx)); bar.push(barvy[pruhC(sx) % 2]);
    }
    const prurez = []; const hh = tl / 2;
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); prurez.push([hh * Math.sign(c) * Math.pow(Math.abs(c), 0.5), hh * Math.sign(s) * Math.pow(Math.abs(s), 0.5)]); }
    S.trubka(cesta, prurez, i => bar[i]);
    // číselné tabule nahoře (obě strany) a nožky
    const Tb = K.tabule; Tb.nastav(M); Tb.odstin([1, 1, 1]);
    const uv = uvBunky((cislo - 1) % 24, 5), pw = 0.7, ph = 0.6, py = y1 + tl / 2 - 0.02;
    for (const e of [-1, 1]) Tb.plocha([-pw / 2 * e, py, e * 0.07], [pw / 2 * e, py, e * 0.07], [pw / 2 * e, py + ph, e * 0.07], [-pw / 2 * e, py + ph, e * 0.07], uv[0], uv[1], uv[2], uv[3], [0, 0, e]);
    S.odstin(barvy[0]); S.kvadr(-pw / 2 - 0.04, py - 0.02, -0.06, pw / 2 + 0.04, py + ph + 0.04, 0.06, 'zZ');
    S.odstin([0.08, 0.08, 0.09]);
    const c = Math.cos(br.uhel || 0), s = Math.sin(br.uhel || 0);
    for (const sx of [-1, 1]) {
      const lx = sx * (hw - 0.15), zem = t.vyska(br.x + lx * c, br.z - lx * s) - br.y;
      if (br.naVode) { S.odstin(barvy[0]); S.kvadr(lx - 0.3, -0.15, -0.6, lx + 0.3, 0.1, 0.6, ''); S.odstin([0.08, 0.08, 0.09]); continue; }   // plovák
      if (y0 - tl / 2 - zem > 0.05) S.kvadr(lx - 0.05, zem, -0.05, lx + 0.05, y0, 0.05, '');
      S.kvadr(lx - 0.25, zem - 0.05, -0.45, lx + 0.25, zem + 0.12, 0.45, 'y');     // zátěž (pytle s pískem)
    }
    S.x = 0;
  }

  // startovní plocha s H a postava pilota s vysílačkou
  function stavPristavani(K, b) {
    const M = ramec(b), Tb = K.tabule; Tb.nastav(M); Tb.odstin([1, 1, 1]);
    const w = b.sirka || 2.4, d = b.delka || w, uv = uvBunky(24, 5), h = Math.max(0.03, b.vyska || 0.05);
    Tb.plocha([-w / 2, h, d / 2], [w / 2, h, d / 2], [w / 2, h, -d / 2], [-w / 2, h, -d / 2], uv[0], uv[1], uv[2], uv[3], [0, 1, 0]);
    const ok = [uv[0] + 0.004, uv[1] + 0.004, uv[0] + 0.01, uv[1] + 0.01];
    Tb.odstin([0.7, 0.7, 0.7]);
    for (const st of steny(w, d)) prvek(Tb, st, 0, -0.1, st.L, h + 0.1, 0, ok);
  }
  function stavPilota(S, x, y, z, smer) {
    const M = new THREE.Matrix4().makeRotationY(smer).setPosition(x, y, z); S.nastav(M); S.x = -9;
    const kuze = barva('#c99a7c'), dziny = barva('#34425a'), bunda = barva('#3f5a3a'), vesta = barva('#ff7a1a'), boty = barva('#2a2622'), cep = barva('#203040');
    S.odstin(boty); S.kvadr(-0.2, 0, -0.16, -0.04, 0.09, 0.12, 'y'); S.kvadr(0.04, 0, -0.16, 0.2, 0.09, 0.12, 'y');
    S.odstin(dziny); S.tram([-0.11, 0.08, 0], [-0.12, 0.92, 0.0], 0.15, 0.17); S.tram([0.11, 0.08, 0], [0.12, 0.92, 0.0], 0.15, 0.17);
    S.odstin(bunda); S.kvadr(-0.21, 0.88, -0.13, 0.21, 1.42, 0.13, '');
    S.odstin(vesta); S.kvadr(-0.215, 0.98, -0.135, 0.215, 1.38, 0.135, 'yY');
    S.odstin(bunda);
    for (const sx of [-1, 1]) { S.tram([sx * 0.24, 1.38, 0], [sx * 0.27, 1.12, -0.06], 0.1, 0.1); S.tram([sx * 0.27, 1.12, -0.06], [sx * 0.13, 1.08, -0.3], 0.09, 0.09); }
    S.odstin(kuze);
    S.sMatici(new THREE.Matrix4().makeTranslation(0, 1.42, 0), () => S.rotacni([[0.05, 0], [0.06, 0.06], [0.1, 0.1], [0.11, 0.18], [0.09, 0.27], [0.0, 0.3]], 8));
    for (const sx of [-1, 1]) S.kvadr(sx * 0.12 - 0.04, 1.05, -0.34, sx * 0.12 + 0.04, 1.11, -0.26, '');
    S.odstin(cep); S.kvadr(-0.11, 1.62, -0.11, 0.11, 1.7, 0.11, ''); S.kvadr(-0.1, 1.62, -0.22, 0.1, 1.64, -0.1, '');
    S.odstin(barva('#1a1b1d')); S.kvadr(-0.15, 1.04, -0.38, 0.15, 1.16, -0.26, '');            // vysílačka
    S.tram([0.1, 1.16, -0.32], [0.14, 1.3, -0.28], 0.015, 0.015);
    S.odstin(barva('#707070')); S.tram([-0.07, 1.16, -0.33], [-0.07, 1.2, -0.33], 0.02, 0.02); S.tram([0.07, 1.16, -0.33], [0.07, 1.2, -0.33], 0.02, 0.02);
    S.odstin(barva('#c03020')); S.kvadr(0.4, 0, 0.05, 0.85, 0.28, 0.4, 'y');                   // kufr s výbavou
    S.odstin(barva('#1a1a1a')); S.kvadr(0.4, 0.28, 0.12, 0.85, 0.3, 0.33, 'y');
    S.x = 0;
  }

  // ======================================================================================
  //  Dráty vedení: obrazovkově široké pásky (aspoň 1.3 px), průhlednost podle skutečné tloušťky
  // ======================================================================================
  function vytvorDraty(seznam) {
    const pos = [], jiny = [], strana = [], idx = [];
    for (const d of seznam) {
      const B = d.body;
      for (let i = 0; i + 1 < B.length; i++) {
        const a = B[i], b = B[i + 1], z = pos.length / 3;
        pos.push(...a, ...a, ...b, ...b); jiny.push(...b, ...b, ...a, ...a); strana.push(-1, 1, 1, -1);
        idx.push(z, z + 1, z + 2, z, z + 2, z + 3);
      }
    }
    if (!idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aJiny', new THREE.Float32BufferAttribute(jiny, 3));
    g.setAttribute('aStrana', new THREE.Float32BufferAttribute(strana, 1));
    g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uRozl: { value: new THREE.Vector2(1280, 720) }, uPolomer: { value: G.PRUMER_DRATU / 2 } }, D.U),
      vertexShader: /* glsl */`
        attribute vec3 aJiny; attribute float aStrana;
        uniform vec2 uRozl; uniform float uPolomer;
        varying vec3 vWp; varying float vAlfa;
        void main() {
          vec4 va = viewMatrix * vec4(position, 1.0), vb = viewMatrix * vec4(aJiny, 1.0);
          if (vb.z > -0.1) vb = va + (vb - va) * ((-0.1 - va.z) / min(vb.z - va.z, -1e-4));
          vec4 a = projectionMatrix * va, b = projectionMatrix * vb;
          vec2 sa = a.xy / a.w * uRozl * 0.5, sb = b.xy / b.w * uRozl * 0.5;
          vec2 d = sb - sa; d = length(d) > 1e-4 ? normalize(d) : vec2(1.0, 0.0);
          vec2 n = vec2(-d.y, d.x);
          float px = uPolomer * 2.0 * projectionMatrix[1][1] * uRozl.y * 0.5 / max(a.w, 1e-3);
          float w = max(px, 1.3);
          vAlfa = clamp(pow(px / 1.3, 0.45), 0.12, 1.0);
          a.xy += n * aStrana * w / uRozl * a.w;
          gl_Position = a; vWp = position;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vWp; varying float vAlfa;
        ${D.GLSL.atmo}
        void main() {
          vec3 c = vec3(0.32, 0.33, 0.34) * (uSkyColor * 0.8 + uSunColor * 0.32 * dronMraky(vWp));
          c = dronAtmo(c, vWp, cameraPosition);
          gl_FragColor = vec4(c, vAlfa);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 5;
    return mesh;
  }

  // ======================================================================================
  //  Ukázková sada staveb kolem startu (jen s ?ukazka=stavby — pro vývoj, než je hotový generátor)
  // ======================================================================================
  function ukazka(t) {
    const s = t.start, st = [], y = (x, z) => t.vyska(x, z), r = D.Nahoda('ukazka');
    const add = (typ, x, z, uhel, sirka, delka, vyska, strecha, navic) => st.push(Object.assign({ typ, x, y: y(x, z), z, uhel, sirka, delka, vyska, strecha }, navic || {}));
    add('pristavani', s.x, s.z, s.smer, 2.4, 2.4, 0.04, 0);
    // ulice podél z = −110 (silnice), domy z obou stran
    const cesty = [{ typ: 'silnice', sirka: 6, body: [[-260, -110], [-120, -112], [0, -108], [140, -112], [280, -110]] }];
    for (let k = -4; k <= 4; k++) {
      for (const e of [-1, 1]) {
        if (k === 0 && e < 0) continue;
        const x = k * 19 + r.mezi(-2, 2), z = -110 + e * r.mezi(13, 17), sir = r.mezi(7, 9), del = r.mezi(10, 15);
        const dvou = r() < 0.2;
        add('dum', x, z, r.mezi(-0.06, 0.06) + (r() < 0.5 ? Math.PI / 2 : 0), sir, del, dvou ? 6 : r.mezi(3.1, 3.6), r.mezi(3.6, 5));
        if (r() < 0.6) add('stodola', x + r.mezi(-3, 3), z + e * r.mezi(16, 20), Math.PI / 2 + r.mezi(-0.05, 0.05), r.mezi(8, 10), r.mezi(14, 20), r.mezi(4.2, 5.5), r.mezi(4, 6));
        add('plot', x, -110 + e * 6.5, 0, 16, 0.1, 1.1, 0);
      }
    }
    add('kostel', 0, -150, 0, 11, 24, 9, 6.5);
    add('vez', 0, -150 + 15.5, 0, 6.5, 6.5, 24, 13);
    add('kaple', 60, -55, 0.4, 4, 5.5, 3.6, 3);
    add('rozhledna', -110, 40, 0.2, 6, 6, 20, 2.6);
    add('rozhledna', -160, 90, 0.5, 5, 5, 16, 2.4, { material: 'ocel' });
    add('posed', 90, 60, 0.7, 1.5, 1.5, 4, 1.2);
    for (let k = 0; k < 10; k++) add('seno', 40 + r.mezi(0, 40), 25 + r.mezi(0, 25), r() * 6.28, 1.5, 1.2, 1.5, 0);
    add('most', -60, -40, 0.3, 5, 24, 6, 0, { material: 'kamen' });
    add('most', -60, 60, 1.2, 7, 30, 7, 0, { material: 'beton' });
    for (const [x, z, u, l] of [[120, -45, 0.1, 40], [139.4, -28, 1.67, 30], [120, -15, 0.1, 40], [100.6, -32, 1.67, 30]]) add('ohrada', x, z, u + Math.PI / 2, 0.15, l, 1.3, 0);
    const vedeni = [
      { vyskaSloupu: 26, body: [-420, -270, -120, 30, 180, 330].map((x, i) => [x, y(x, 110 + i * 6), 110 + i * 6]) },
      { vyskaSloupu: 10, body: [-200, -150, -100, -50, 0, 50].map(x => [x, y(x, -85), -85]) },
    ];
    const trate = [{ jmeno: 'Ukázka', branky: [[0, -22, 0], [14, -46, -0.5], [2, -72, 0.2], [-16, -52, 1.6]].map(([x, z, u]) => ({ x, y: y(x, z), z, uhel: u, sirka: 3, vyska: 2 })) }];
    // posun celé ukázky ke startu (souřadnice výše jsou relativní k počátku)
    const ox = s.x, oz = s.z, pos = o => { o.x += ox; o.z += oz; o.y = y(o.x, o.z) + (o.typ === 'most' ? o.vyska : 0); };
    st.forEach((o, i) => { if (i > 0) pos(o); });
    if ((t.stavby || []).some(b => b.typ === 'pristavani')) st.shift();
    for (const v of vedeni) for (const p of v.body) { p[0] += ox; p[2] += oz; p[1] = y(p[0], p[2]); }
    for (const tr of trate) for (const b of tr.branky) pos(b);
    for (const c of cesty) for (const p of c.body) { p[0] += ox; p[1] += oz; }
    return { stavby: st, vedeni, trate, cesty };
  }

  // pouliční lampy podél silnic ve vesnici (stožár, výložník, svítidlo); vrací body světel pro noční kruhy
  function lampy(K, t, stavby) {
    const ves = t.vesnice, domy = stavby.filter(b => b.typ === 'dum' || b.typ === 'kostel');
    if (!domy.length) return [];
    const svetla = [], uv = uvBunky(OKNO.lampa);
    const blizkoDomu = (x, z) => domy.some(b => Math.hypot(b.x - x, b.z - z) < 45);
    const vStavbe = (x, z) => stavby.some(b => b.typ !== 'plot' && b.typ !== 'ohrada' && Math.hypot(b.x - x, b.z - z) < Math.max(b.sirka || 1, b.delka || 1) / 2 + 1.5);
    for (const c of t.cesty || []) {
      if (c.typ !== 'silnice' || !c.body || c.body.length < 2) continue;
      let zbyva = 12, strana = 1;
      for (let i = 0; i + 1 < c.body.length; i++) {
        const [ax, az] = c.body[i], [bx, bz] = c.body[i + 1], L = Math.hypot(bx - ax, bz - az);
        if (L < 1e-3) continue;
        const dx = (bx - ax) / L, dz = (bz - az) / L;
        let s0 = zbyva;
        while (s0 < L) {
          const px = ax + dx * s0, pz = az + dz * s0, off = (c.sirka || 5) / 2 + 1.1;
          const x = px - dz * off * strana, z = pz + dx * off * strana;
          if ((!ves || Math.hypot(x - ves.x, z - ves.z) < ves.r) && blizkoDomu(x, z) && !vStavbe(x, z) && t.hladina(x, z) === -Infinity) {
            const y = t.vyska(x, z), u = Math.atan2(dz * strana, -dx * strana);      // výložník míří k silnici
            const M = new THREE.Matrix4().makeRotationY(u - Math.PI / 2).setPosition(x, y, z);
            K.kov.nastav(M); K.okna.nastav(M);
            K.kov.odstin(barva('#55595c'));
            K.kov.tram([0, -0.5, 0], [0, 6.4, 0], 0.13, 0.13);
            K.kov.tram([0, 6.2, 0], [0, 6.55, -1.1], 0.06, 0.06);
            K.kov.kvadr(-0.14, 6.45, -1.45, 0.14, 6.6, -0.9);
            K.okna.odstin([1, 1, 1]); K.okna.x = 1;
            K.okna.plocha([-0.12, 6.44, -0.92], [0.12, 6.44, -0.92], [0.12, 6.44, -1.43], [-0.12, 6.44, -1.43], uv[0], uv[1], uv[2], uv[3], [0, -1, 0]);
            K.okna.x = 0;
            const sv = new THREE.Vector3(0, 0, -1.2).applyMatrix4(M); svetla.push([sv.x, sv.z]);
          }
          s0 += 38; strana = -strana;
        }
        zbyva = s0 - L;
      }
    }
    return svetla;
  }
  // noční světelné kruhy pod lampami (aditivní disky po terénu)
  function vytvorKruhy(t, svetla) {
    if (!svetla.length) return null;
    const pos = [], uvs = [], idx = [], N = 16, R = 9;
    for (const [x, z] of svetla) {
      const z0 = pos.length / 3;
      pos.push(x, t.vyska(x, z) + 0.15, z); uvs.push(0, 0);
      for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R; pos.push(px, t.vyska(px, pz) + 0.15, pz); uvs.push(1, 0); }
      for (let k = 0; k < N; k++) idx.push(z0, z0 + 1 + (k + 1) % N, z0 + 1 + k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      uniforms: { uNoc: U_NOC },
      vertexShader: 'varying float vR; void main() { vR = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uNoc; varying float vR; void main() { float k = (1.0 - vR); gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * 0.55 * k * k * uNoc, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4,
    });
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 3; mesh.name = 'stavby-kruhy';
    return mesh;
  }

  // postaví geometrii všech staveb (bez materiálů — dá se volat i v node s THREE)
  function postav(t) {
    const stavby = t.stavby || [];
    const kon = { teren: t, cesty: t.cesty || [], stavby };
    const novy = () => ({ omitka: new Stavitel(t), strecha: new Stavitel(t), drevo: new Stavitel(t), kamen: new Stavitel(t), okna: new Stavitel(t), kov: new Stavitel(t), seno: new Stavitel(t), branky: new Stavitel(t), tabule: new Stavitel(t) });
    const K = novy();
    const detaily = new Map();                 // buňka 256 m → stavitelé detailů
    const KD = (x, z) => {
      const kl = Math.floor(x / 256) + ',' + Math.floor(z / 256);
      if (!detaily.has(kl)) detaily.set(kl, { omitka: new Stavitel(t), drevo: new Stavitel(t), kov: new Stavitel(t), kamen: new Stavitel(t), strecha: new Stavitel(t), x: (Math.floor(x / 256) + 0.5) * 256, z: (Math.floor(z / 256) + 0.5) * 256 });
      return detaily.get(kl);
    };
    const FN = { dum: stavDum, stodola: stavStodola, kostel: stavKostel, vez: stavVez, kaple: stavKaple, rozhledna: stavRozhledna, posed: stavPosed, seno: stavSeno, most: stavMost, plot: stavPlot, ohrada: stavPlot };
    let maPristavani = false;
    for (const b of stavby) {
      try {
        const kd = KD(b.x, b.z), Kd = { omitka: kd.omitka, drevo: kd.drevo, kov: kd.kov, kamen: kd.kamen, strecha: kd.strecha };
        if (b.typ === 'pristavani') { stavPristavani(K, b); maPristavani = true; }
        else if (b.typ === 'stozar') {
          const blizko = (t.vedeni || []).some(v => (v.body || []).some(p => Math.hypot(p[0] - b.x, p[2] - b.z) < 3));
          if (!blizko) stavStozar(K, Kd, b.x, b.y, b.z, b.vyska || 12, [Math.cos(b.uhel || 0), -Math.sin(b.uhel || 0)]);
        } else if (FN[b.typ]) FN[b.typ](K, Kd, b, kon);
      } catch (e) { console.error('stavba', b.typ, e); }
    }
    if (!maPristavani && t.start) stavPristavani(K, { x: t.start.x, y: t.start.y, z: t.start.z, uhel: t.start.smer || 0, sirka: 2.4, delka: 2.4 });
    // vedení: stožáry + dráty
    const draty = [];
    for (const v of t.vedeni || []) {
      const B = v.body || [], H = v.vyskaSloupu || 12, uch = G.uchyceni(H, v.draty);
      B.forEach((p, i) => {
        const kd = KD(p[0], p[2]), st = stavby.find(q => q.typ === 'stozar' && Math.hypot(q.x - p[0], q.z - p[2]) < 3);
        stavStozar(K, { kov: kd.kov, kamen: kd.kamen }, p[0], p[1], p[2], H, G.kolmice(B, i), uch, st ? Math.min(st.sirka, st.delka) / 2 : 0);
      });
      draty.push(...G.draty(v));
    }
    // závodní tratě
    const ids = []; let id = 0;
    (t.trate || []).forEach((tr, ti) => {
      const bar = BARVY_TRATI[ti % BARVY_TRATI.length], pole = [];
      (tr.branky || []).forEach((br, i) => { pole.push(id); stavBranku(K, br, id, i + 1, bar, t); id++; });
      ids.push(pole);
    });
    const svetla = lampy(K, t, stavby);
    return { K, detaily, draty, ids, stavby, svetla };
  }
  D.stavby_postav = postav; D.stavby_ukazka = ukazka;

  // ======================================================================================
  //  Modul
  // ======================================================================================
  D.stavby = {
    zvyrazniBranku(trat, index) {          // zvýrazní (pulzuje) branku; null → nic
      const m = D.stavby._branky;
      if (trat == null || !m || !m[trat] || index == null || index < 0 || index >= m[trat].length) { U_DALSI.value = -1; return; }
      U_DALSI.value = m[trat][index];
    },
    seznam: () => D.stavby._seznam || [],     // všechny vykreslené stavby (včetně ukázkových)
    draty: () => D.stavby._draty || [],       // vodiče [{ body, r }] (stejné jako D.STAVBY_GEOM.draty)
    _branky: null, _seznam: null, _draty: null,
  };

  D.modul('stavby', {
    poradi: 45,
    popis: 'vesnice a stavby',
    init(ctx) {
      const t = ctx.teren;
      if (D.param.ukazka === 'stavby') {    // ukázková sada (doplní data, aby je viděly i kolize)
        const u = ukazka(t);
        t.stavby = (t.stavby || []).concat(u.stavby); t.vedeni = (t.vedeni || []).concat(u.vedeni);
        t.trate = (t.trate || []).concat(u.trate); t.cesty = (t.cesty || []).concat(u.cesty);
      }
      const { K, detaily, draty, ids, stavby, svetla } = postav(t);
      const M = this.mat = vytvorMaterialy(ctx);
      D.stavby._branky = ids; D.stavby._seznam = stavby; D.stavby._draty = draty;

      // meshe
      const skupina = this.skupina = new THREE.Group(); skupina.name = 'stavby';
      const stin = { omitka: 1, strecha: 1, drevo: 1, kamen: 1, kov: 1, seno: 1, branky: 1, tabule: 0, okna: 0 };
      for (const [k, S] of Object.entries(K)) {
        const g = S.geometrie(); if (!g) continue;
        const m = new THREE.Mesh(g, M[k]); m.name = 'stavby-' + k; m.castShadow = !!stin[k]; m.receiveShadow = true; m.matrixAutoUpdate = false;
        skupina.add(m);
      }
      this.detaily = [];
      for (const kd of detaily.values()) {
        const sk = new THREE.Group(); sk.userData.x = kd.x; sk.userData.z = kd.z;
        for (const k of ['omitka', 'drevo', 'kov', 'kamen', 'strecha']) {
          const g = kd[k].geometrie(); if (!g) continue;
          const m = new THREE.Mesh(g, M[k]); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; sk.add(m);
        }
        if (sk.children.length) { skupina.add(sk); this.detaily.push(sk); }
      }
      this.kruhy = vytvorKruhy(t, svetla);
      if (this.kruhy) skupina.add(this.kruhy);
      this.draty = vytvorDraty(draty);
      if (this.draty) skupina.add(this.draty);
      // pilot (samostatně — v pohledu LOS se schová, kamera je v jeho hlavě)
      if (t.start) {
        const s = t.start, px = s.x + Math.sin(s.smer || 0) * 6, pz = s.z + Math.cos(s.smer || 0) * 6;
        const P = new Stavitel(t); stavPilota(P, px + 0.0, t.vyska(px, pz), pz, s.smer || 0);
        this.pilot = new THREE.Mesh(P.geometrie(), M.branky); this.pilot.castShadow = true; this.pilot.receiveShadow = true; this.pilot.name = 'pilot';
        skupina.add(this.pilot);
      }
      ctx.scene.add(skupina);
      this.dosah = 400;
    },
    kvalita(ctx, q) { this.dosah = [220, 380, 520, 750][q] || 400; },
    update(ctx) {
      const k = ctx.kamera.position;
      for (const sk of this.detaily || []) sk.visible = Math.hypot(sk.userData.x - k.x, sk.userData.z - k.z) < this.dosah + 181;
      if (this.pilot) this.pilot.visible = !(ctx.kam && ctx.kam.rezim === 'los');
      const h = ctx.hodina;
      U_NOC.value = h >= 12 ? D.smooth(19.3, 20.8, h) : 1 - D.smooth(4.8, 6.3, h);
      if (this.kruhy) this.kruhy.visible = U_NOC.value > 0.01;
      if (this.draty) ctx.renderer.getDrawingBufferSize(this.draty.material.uniforms.uRozl.value);
    },
  });
})(globalThis.DRON = globalThis.DRON || {});
