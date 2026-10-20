/* ============================================================
   Planetárium – trojúhelníkové sítě pro STL (bez DOM)
   Formát sítě jako v obsah/evolventni_kola/jadro.js: {pozice: Float64Array (x,y,z…), trojuhelniky: Uint32Array}
   - kola: EvolKola.kolo + EvolKola.sitKola (evolventní profil, otvor, vůle)
   - deska ramene: konvexní obrys s kruhovými otvory → Voroného buňky kolem otvorů,
     každá buňka se triangulací „paprsků“ spojí s kružnicí otvoru (bez T-spojů, uzavřené)
   - řemenice (rotační těleso), šikmý kroužek uzlů
   ============================================================ */
(function (koren) {
  'use strict';
  const TAU = 2 * Math.PI, RAD = Math.PI / 180;
  const EK = koren.EvolKola || (typeof require !== 'undefined' ? require('../evolventni_kola/jadro.js') : null);

  /** Parametry kola pro EvolKola z položky mechanismu. */
  function parametryKola(mech, g, nahled) {
    const p = mech.p;
    return { m: g.m || p.m, z: g.z, alfa: p.alfa || 20, b: p.b, dOtvor: g.otvor || 0, ds: p.vuleZub || 0, cTisk: p.cTisk || 0, tol: nahled ? 0.05 : 0.01 };
  }
  function geometrieKola(mech, g, nahled) {
    const k = EK.kolo(parametryKola(mech, g, nahled));
    if (!k.ok && !k.obrys) throw new Error('Kolo z' + g.z + ': ' + k.chyby.join(' '));
    return k;
  }
  function sitKola(mech, g, poloha) {
    const k = geometrieKola(mech, g, false);
    return EK.sitKola(k, 0.02, poloha);
  }

  /** Rotační těleso: profil [[r, z], …] uzavřený (r > 0), vrcholy proti směru hodin v rovině (r, z). */
  function rotacni(profil, n, poloha) {
    const P = profil.length, N = n || 96, pos = new Float64Array(P * N * 3), T = [];
    const tx = poloha ? poloha.x || 0 : 0, ty = poloha ? poloha.y || 0 : 0, tz = poloha ? poloha.z || 0 : 0;
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU, c = Math.cos(a), s = Math.sin(a);
      for (let j = 0; j < P; j++) { const o = (i * P + j) * 3; pos[o] = tx + profil[j][0] * c; pos[o + 1] = ty + profil[j][0] * s; pos[o + 2] = tz + profil[j][1]; }
    }
    for (let i = 0; i < N; i++) {
      const i2 = (i + 1) % N;
      for (let j = 0; j < P; j++) {
        const j2 = (j + 1) % P, a = i * P + j, b = i * P + j2, c = i2 * P + j2, d = i2 * P + j;
        T.push(a, d, c, a, c, b);
      }
    }
    return { pozice: pos, trojuhelniky: new Uint32Array(T) };
  }
  /** Řemenice pro řemínek kruhového průřezu (O-kroužek), střed drážky na Ø d. */
  function sitRemenice(d, b, otvor, poloha) {
    const R = d / 2, ri = otvor / 2, h = Math.max(b, 5), dr = Math.min(1.6, h * 0.25), Rv = R + 1.5;
    const profil = [[ri, 0], [Rv, 0], [Rv, h * 0.2], [R, h * 0.5 - dr * 0.2], [R - dr * 0.4, h * 0.5], [R, h * 0.5 + dr * 0.2], [Rv, h * 0.8], [Rv, h], [ri, h]];
    return rotacni(profil, 96, poloha);
  }

  /** Šikmý kroužek: mezikruží r1–r2, spodek z = 0, vršek z = h + r·tg(i)·sin φ. */
  function sitKrouzku(r1, r2, h, sklonDeg, poloha) {
    const N = 120, pos = new Float64Array(N * 4 * 3), T = [], t = Math.tan(sklonDeg * RAD);
    const tx = poloha ? poloha.x || 0 : 0, ty = poloha ? poloha.y || 0 : 0;
    const A = r2 * t; // nejvyšší bod nad h
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU, c = Math.cos(a), s = Math.sin(a);
      const zt = (r) => h + A + r * t * s;
      const v = [[r1 * c, r1 * s, 0], [r2 * c, r2 * s, 0], [r2 * c, r2 * s, zt(r2)], [r1 * c, r1 * s, zt(r1)]];
      for (let j = 0; j < 4; j++) { const o = (i * 4 + j) * 3; pos[o] = v[j][0] + tx; pos[o + 1] = v[j][1] + ty; pos[o + 2] = v[j][2]; }
    }
    for (let i = 0; i < N; i++) {
      const i2 = (i + 1) % N;
      // profil (vnitřní spodní, vnější spodní, vnější horní, vnitřní horní) je v rovině (r, z) proti směru hodin
      for (let j = 0; j < 4; j++) {
        const j2 = (j + 1) % 4, a = i * 4 + j, b = i * 4 + j2, c = i2 * 4 + j2, d = i2 * 4 + j;
        T.push(a, d, c, a, c, b);
      }
    }
    return { pozice: pos, trojuhelniky: new Uint32Array(T) };
  }

  /* ---------- deska s otvory ---------- */
  /** Ořez konvexního mnohoúhelníku polorovinou n·x ≤ c; hrany nesou štítek (−1 obrys, j = osa s otvorem j). */
  function orez(poly, n, c, stitek) {
    const out = [], L = poly.length, dentro = (q) => n[0] * q.x + n[1] * q.y <= c + 1e-12;
    for (let i = 0; i < L; i++) {
      const P = poly[i], Q = poly[(i + 1) % L], pIn = dentro(P), qIn = dentro(Q);
      const prus = () => { const dp = n[0] * P.x + n[1] * P.y - c, dq = n[0] * Q.x + n[1] * Q.y - c, t = dp / (dp - dq); return { x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t }; };
      if (pIn && qIn) out.push({ x: P.x, y: P.y, t: P.t });
      else if (pIn && !qIn) { out.push({ x: P.x, y: P.y, t: P.t }); const I = prus(); out.push({ x: I.x, y: I.y, t: stitek }); }
      else if (!pIn && qIn) { const I = prus(); out.push({ x: I.x, y: I.y, t: P.t }); }
    }
    return out;
  }
  /** Průsečík paprsku z c ve směru a s hranicí konvexní buňky; vrací {q (index hrany), s (parametr na hraně), x, y}. */
  function paprsek(cell, cx, cy, a) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let best = null;
    for (let q = 0; q < cell.length; q++) {
      const P = cell[q], Q = cell[(q + 1) % cell.length];
      const ex = Q.x - P.x, ey = Q.y - P.y, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-14) continue;
      const wx = P.x - cx, wy = P.y - cy;
      const t = (wx * ey - wy * ex) / den, s = (wx * dy - wy * dx) / den;
      if (t > 1e-9 && s >= -1e-9 && s <= 1 + 1e-9 && (!best || t < best.t)) best = { q, s: Math.max(0, Math.min(1, s)), t, x: cx + dx * t, y: cy + dy * t };
    }
    return best;
  }
  /**
   * Deska tloušťky tl: obrys (konvexní, [[x,y]] proti směru hodin) a kruhové otvory [{x, y, r}].
   * Každý otvor musí ležet uvnitř své Voroného buňky (otvory od sebe dál než součet poloměrů).
   */
  function sitDesky(obrys, otvory, tl, poloha, nSeg) {
    const N = nSeg || 64;
    const tx = poloha ? poloha.x || 0 : 0, ty = poloha ? poloha.y || 0 : 0, tz = poloha ? poloha.z || 0 : 0;
    const bunky = otvory.map((h, i) => {
      let cell = obrys.map((q) => ({ x: q[0], y: q[1], t: -1 }));
      otvory.forEach((g, j) => {
        if (j === i) return;
        const n = [g.x - h.x, g.y - h.y], c = (g.x * g.x + g.y * g.y - h.x * h.x - h.y * h.y) / 2;
        cell = orez(cell, n, c, j);
      });
      const hity = [];
      for (let k = 0; k < N; k++) { const a = k / N * TAU, z = paprsek(cell, h.x, h.y, a); if (!z) throw new Error('otvor mimo desku'); z.k = k; hity.push(z); }
      return { cell, hity, h };
    });
    // hranice každé buňky: vrcholy + vlastní zásahy paprsků + cizí zásahy na společných hranách
    const body = [], mapa = new Map(), idx2 = (x, y) => {
      const k = Math.round(x * 1e5) + ',' + Math.round(y * 1e5);
      let i = mapa.get(k); if (i == null) { i = body.length; body.push([x, y]); mapa.set(k, i); } return i;
    };
    const tri = [];
    bunky.forEach((B, i) => {
      const { cell, hity, h } = B, hrana = cell.map(() => []);
      for (const z of hity) hrana[z.q].push({ s: z.s, x: z.x, y: z.y, k: z.k });
      cell.forEach((P, q) => {
        if (P.t < 0) return;
        const Q = cell[(q + 1) % cell.length], ex = Q.x - P.x, ey = Q.y - P.y, L2 = ex * ex + ey * ey;
        const jine = bunky[P.t];
        for (const z of jine.hity) {
          if (jine.cell[z.q].t !== i) continue;
          const s = ((z.x - P.x) * ex + (z.y - P.y) * ey) / L2;
          if (s > 1e-9 && s < 1 - 1e-9) hrana[q].push({ s, x: z.x, y: z.y, k: -1 });
        }
      });
      const hranice = [];
      cell.forEach((P, q) => {
        hranice.push({ i: idx2(P.x, P.y), k: -1 });
        hrana[q].sort((a, b) => a.s - b.s);
        for (const z of hrana[q]) hranice.push({ i: idx2(z.x, z.y), k: z.k });
      });
      const poz = new Array(N);
      hranice.forEach((v, j) => { if (v.k >= 0 && poz[v.k] == null) poz[v.k] = j; });
      const kruh = []; for (let k = 0; k < N; k++) { const a = k / N * TAU; kruh.push(idx2(h.x + h.r * Math.cos(a), h.y + h.r * Math.sin(a))); }
      const L = hranice.length;
      for (let k = 0; k < N; k++) {
        const k2 = (k + 1) % N, c = kruh[k];
        let j = poz[k];
        const konec = poz[k2];
        let krok = 0;
        while (j !== konec && krok++ < L + 2) {
          const j2 = (j + 1) % L, a = hranice[j].i, b = hranice[j2].i;
          if (a !== b && a !== c && b !== c) tri.push([c, a, b]);
          j = j2;
        }
        const e = hranice[konec].i;
        if (e !== c && e !== kruh[k2] && c !== kruh[k2]) tri.push([c, e, kruh[k2]]);
      }
    });
    // vytažení: horní a dolní podstava, stěny na hraničních hranách
    const n2 = body.length, pos = new Float64Array(n2 * 2 * 3);
    body.forEach(([x, y], i) => {
      pos[i * 3] = x + tx; pos[i * 3 + 1] = y + ty; pos[i * 3 + 2] = tz;
      pos[(i + n2) * 3] = x + tx; pos[(i + n2) * 3 + 1] = y + ty; pos[(i + n2) * 3 + 2] = tz + tl;
    });
    const T = [], hrany = new Map();
    for (const [a, b, c] of tri) {
      T.push(a + n2, b + n2, c + n2, a, c, b);
      for (const [u, v] of [[a, b], [b, c], [c, a]]) hrany.set(u + ',' + v, [u, v]);
    }
    for (const [k, [u, v]] of hrany) if (!hrany.has(v + ',' + u)) T.push(u, v, v + n2, u, v + n2, u + n2);
    const plocha2D = tri.reduce((s, [a, b, c]) => s + ((body[b][0] - body[a][0]) * (body[c][1] - body[a][1]) - (body[b][1] - body[a][1]) * (body[c][0] - body[a][0])) / 2, 0);
    return { pozice: pos, trojuhelniky: new Uint32Array(T), plocha2D };
  }

  /** Šikmý kotouč uzlů: nasazený na trubce uzlů, tyčka Měsíce na něm jezdí v poloměru dráhy Měsíce. */
  function kotoucUzlu(mech) {
    const p = mech.p, t = mech.trubky.find((x) => x.vlak === 'uzly') || mech.trubky[mech.trubky.length - 1];
    const r1 = (t ? t.dVnejsi : p.dHridel) / 2 + p.vuleOtvor / 2;
    return { r1, r2: p.mesicR + 4, h: 2.5 };
  }

  /** Deska ramene z mechanismu. */
  function sitRamene(mech, poloha) {
    const R = mech.rameno;
    return sitDesky(R.obrys, R.otvory.map((o) => ({ x: o.x, y: o.y, r: o.otvor })), R.tl, poloha);
  }

  /** Seznam dílů pro STL: [{id, nazev, sit()}]. */
  function dilyStl(mech) {
    const p = mech.p, out = [];
    for (const g of mech.kola) {
      const nazev = g.poz + (g.remenice ? '_remenice_d' + Math.round(g.d) : '_z' + g.z) + '_' + g.vlak;
      out.push({ id: g.poz, nazev, r: g.ra, sit: (pol) => g.remenice ? sitRemenice(g.d, p.b, g.otvor, pol) : sitKola(mech, g, pol) });
    }
    for (const k of mech.kusovnik.filter((x) => x.pohon && x.z)) {
      const g = { z: k.z, otvor: k.otvor, m: k.m };
      out.push({ id: k.poz, nazev: k.poz + '_z' + k.z + '_pohon', r: (k.m || p.m) * (k.z + 2) / 2, sit: (pol) => sitKola(mech, g, pol) });
    }
    if (p.mesic && p.naklon) {
      const k = kotoucUzlu(mech);
      out.push({ id: 'U', nazev: 'kotouc_uzlu', r: k.r2, sit: (pol) => sitKrouzku(k.r1, k.r2, k.h, p.sklonMesice, pol) });
    }
    if (mech.mustek) out.push({ id: 'M', nazev: 'mustek', r: Math.hypot(mech.rameno.delka, mech.rameno.sirka) / 2, rameno: true, sit: (pol) => {
      const R = mech.rameno, cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2;
      return sitRamene(mech, { x: (pol ? pol.x || 0 : 0) - cx, y: (pol ? pol.y || 0 : 0) - cy, z: 0 });
    } });
    out.push({ id: 'R', nazev: 'rameno', r: Math.hypot(mech.rameno.delka, mech.rameno.sirka) / 2, rameno: true, sit: (pol) => {
      const R = mech.rameno, cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2;
      return sitRamene(mech, { x: (pol ? pol.x || 0 : 0) - cx, y: (pol ? pol.y || 0 : 0) - cy, z: 0 });
    } });
    return out;
  }
  /** Rozložení dílů vedle sebe (řádky) – vrátí sítě posunuté v rovině. */
  function rozlozeni(dily, sirkaStolu, mezera) {
    const W = sirkaStolu || 220, g = mezera || 4, out = [];
    let x = 0, y = 0, radek = 0;
    const serazene = dily.slice().sort((a, b) => b.r - a.r);
    for (const d of serazene) {
      const w = 2 * d.r;
      if (x > 0 && x + w > W) { x = 0; y += radek + g; radek = 0; }
      out.push(d.sit({ x: x + d.r, y: y + d.r, z: 0 }));
      x += w + g; radek = Math.max(radek, w);
    }
    return out;
  }

  const API = { kotoucUzlu, parametryKola, geometrieKola, sitKola, rotacni, sitRemenice, sitKrouzku, sitDesky, sitRamene, dilyStl, rozlozeni };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PLANSit = API;
})(typeof window !== 'undefined' ? window : globalThis);
