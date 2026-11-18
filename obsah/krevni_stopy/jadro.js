/* Úhel dopadu krevních stop (BPA) – jádro bez DOM (test: _test/krevni_stopy_test.js).
   Proložení elipsy (body i momenty z prahování), úhel dopadu α = arcsin(š/d), směr γ,
   oblast konvergence 2D a oblast původu 3D (tangentová metoda / přímky 3D) s nejistotou (Monte Carlo).

   Souřadnice:
   - obrázek: px, x doprava, y dolů; orientace hlavní osy θ v radiánech (atan2 v souřadnicích obrázku)
   - plocha: mm, x doprava, y nahoru, počátek = referenční bod; z = vzdálenost od plochy (kolmo ven)
   - γ = směr pohybu kapky v rovině plochy, 0° = nahoru, 90° = doprava (po směru hodinových ručiček) */
(function () {
  'use strict';

  const VERZE = 2;
  const RAD = Math.PI / 180;

  /* ---------- malá lineární algebra ---------- */
  function det3(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }
  function inv3(m) {
    const d = det3(m);
    if (!Number.isFinite(d) || Math.abs(d) < 1e-14) return null;
    const c = (r1, c1, r2, c2) => m[r1][c1] * m[r2][c2] - m[r1][c2] * m[r2][c1];
    return [
      [c(1, 1, 2, 2) / d, -c(0, 1, 2, 2) / d, c(0, 1, 1, 2) / d],
      [-c(1, 0, 2, 2) / d, c(0, 0, 2, 2) / d, -c(0, 0, 1, 2) / d],
      [c(1, 0, 2, 1) / d, -c(0, 0, 2, 1) / d, c(0, 0, 1, 1) / d]
    ];
  }
  const mul3 = (a, b) => a.map(r => [0, 1, 2].map(j => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
  const mulv3 = (a, v) => a.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const tr3 = a => [0, 1, 2].map(i => [a[0][i], a[1][i], a[2][i]]);
  const kriz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norma = v => Math.hypot(v[0], v[1], v[2]);

  /* reálné kořeny x³ + a x² + b x + c = 0 */
  function korenyKubiky(a, b, c) {
    const p = b - a * a / 3, q = 2 * a * a * a / 27 - a * b / 3 + c, posun = -a / 3;
    const D = q * q / 4 + p * p * p / 27;
    if (Math.abs(p) < 1e-300 && Math.abs(q) < 1e-300) return [posun];
    if (D > 0) {
      const s = Math.sqrt(D);
      return [Math.cbrt(-q / 2 + s) + Math.cbrt(-q / 2 - s) + posun];
    }
    const r = Math.sqrt(-p / 3), phi = Math.acos(Math.max(-1, Math.min(1, -q / 2 / (r * r * r))));
    return [0, 1, 2].map(k => 2 * r * Math.cos((phi - 2 * Math.PI * k) / 3) + posun);
  }

  /* vlastní vektor 3×3 matice pro vlastní číslo l (křížový součin dvou řádků M − lI) */
  function vlastniVektor(m, l) {
    const r = m.map((row, i) => row.map((v, j) => v - (i === j ? l : 0)));
    let nej = null, nejN = 0;
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      const v = kriz(r[i], r[j]), n = norma(v);
      if (n > nejN) { nej = v; nejN = n; }
    }
    return nej && nejN > 0 ? nej.map(x => x / nejN) : null;
  }

  /* ---------- elipsa z kuželosečky ---------- */
  function elipsaZKuzelosecky(A, B, C, D, E, F) {
    const det = 4 * A * C - B * B;
    if (!(det > 0)) return null;
    const x0 = (B * E - 2 * C * D) / det, y0 = (B * D - 2 * A * E) / det;
    const F0 = A * x0 * x0 + B * x0 * y0 + C * y0 * y0 + D * x0 + E * y0 + F;
    // vlastní čísla matice [[A, B/2], [B/2, C]]
    const s = (A + C) / 2, d = Math.hypot((A - C) / 2, B / 2);
    const l1 = s - d, l2 = s + d; // l1 menší (hlavní osa), l2 větší
    if (!(-F0 / l1 > 0 && -F0 / l2 > 0)) return null;
    const a = Math.sqrt(-F0 / l1), b = Math.sqrt(-F0 / l2);
    // směr vlastního vektoru pro l1
    let theta;
    if (Math.abs(B) < 1e-15) theta = A <= C ? 0 : Math.PI / 2;
    else theta = Math.atan2(l1 - A, B / 2);
    return { cx: x0, cy: y0, a, b, theta: normOsa(theta) };
  }
  /* osa (bez orientace) do intervalu (−π/2, π/2] */
  function normOsa(t) {
    while (t > Math.PI / 2) t -= Math.PI;
    while (t <= -Math.PI / 2) t += Math.PI;
    return t;
  }

  /* Proložení elipsy body okraje – přímá metoda nejmenších čtverců (Fitzgibbon 1999,
     numericky stabilní varianta Halíř & Flusser 1998). Potřebuje aspoň 5 bodů. */
  function elipsaZBodu(body) {
    if (!Array.isArray(body) || body.length < 5) return null;
    const n = body.length;
    let mx = 0, my = 0;
    for (const [x, y] of body) { mx += x; my += y; }
    mx /= n; my /= n;
    let k = 0;
    for (const [x, y] of body) k += Math.hypot(x - mx, y - my);
    k = k / n || 1;
    const S1 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], S2 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], S3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const [px, py] of body) {
      const x = (px - mx) / k, y = (py - my) / k;
      const d1 = [x * x, x * y, y * y], d2 = [x, y, 1];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        S1[i][j] += d1[i] * d1[j]; S2[i][j] += d1[i] * d2[j]; S3[i][j] += d2[i] * d2[j];
      }
    }
    const S3i = inv3(S3);
    if (!S3i) return null;
    const T = mul3(S3i, tr3(S2)).map(r => r.map(v => -v));
    const M = S1.map((r, i) => r.map((v, j) => v + mul3(S2, T)[i][j]));
    const Mc = [M[2].map(v => v / 2), M[1].map(v => -v), M[0].map(v => v / 2)];
    // charakteristický polynom λ³ − tr λ² + c2 λ − det
    const tr = Mc[0][0] + Mc[1][1] + Mc[2][2];
    const c2 = Mc[0][0] * Mc[1][1] - Mc[0][1] * Mc[1][0] + Mc[0][0] * Mc[2][2] - Mc[0][2] * Mc[2][0] + Mc[1][1] * Mc[2][2] - Mc[1][2] * Mc[2][1];
    let nej = null;
    for (const l of korenyKubiky(-tr, c2, -det3(Mc))) {
      const v = vlastniVektor(Mc, l);
      if (!v) continue;
      const pod = 4 * v[0] * v[2] - v[1] * v[1];
      if (pod > 0 && (!nej || pod > nej.pod)) nej = { v, pod };
    }
    if (!nej) return null;
    const a1 = nej.v, a2 = mulv3(T, a1);
    const e = elipsaZKuzelosecky(a1[0], a1[1], a1[2], a2[0], a2[1], a2[2]);
    if (!e) return null;
    return { cx: mx + e.cx * k, cy: my + e.cy * k, a: e.a * k, b: e.b * k, theta: e.theta };
  }

  /* Elipsa ze souboru pixelů (momenty 2. řádu) – plná elipsa má poloosy 2·√λ. */
  function elipsaZMomentu(body) {
    const n = body.length;
    if (n < 5) return null;
    let mx = 0, my = 0;
    for (const [x, y] of body) { mx += x; my += y; }
    mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of body) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
    sxx = sxx / n + 1 / 12; syy = syy / n + 1 / 12; sxy /= n; // 1/12 = rozptyl uvnitř pixelu
    const s = (sxx + syy) / 2, d = Math.hypot((sxx - syy) / 2, sxy);
    return { cx: mx + 0.5, cy: my + 0.5, a: 2 * Math.sqrt(s + d), b: 2 * Math.sqrt(Math.max(0, s - d)), theta: normOsa(0.5 * Math.atan2(2 * sxy, sxx - syy)) };
  }

  /* ---------- prahování ---------- */
  /* jas 0–255 z RGBA */
  function jas(rgba) {
    const n = rgba.length / 4, l = new Uint8Array(n);
    for (let i = 0; i < n; i++) l[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
    return l;
  }
  /* Otsuův práh */
  function otsu(l) {
    const h = new Float64Array(256);
    for (let i = 0; i < l.length; i++) h[l[i]]++;
    const n = l.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * h[i];
    let sB = 0, wB = 0, nej = 0, prah = 128;
    for (let t = 0; t < 256; t++) {
      wB += h[t]; if (!wB) continue;
      const wF = n - wB; if (!wF) break;
      sB += t * h[t];
      const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2;
      if (v > nej) { nej = v; prah = t; }
    }
    return prah;
  }
  /* Souvislá oblast tmavší než práh (4-sousedství) od bodu (x0, y0).
     Vrací { body: [[x,y]…], okraj: bool (sahá na okraj obrázku), preteklo: bool } nebo null. */
  function zaplav(l, w, h, x0, y0, prah, max) {
    max = max || 250000;
    x0 = Math.floor(x0); y0 = Math.floor(y0);
    if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h || l[y0 * w + x0] > prah) return null;
    const vid = new Uint8Array(w * h), zas = [y0 * w + x0], body = [];
    vid[zas[0]] = 1;
    let okraj = false;
    while (zas.length) {
      const i = zas.pop(), x = i % w, y = (i - x) / w;
      body.push([x, y]);
      if (body.length > max) return { body, okraj, preteklo: true };
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) okraj = true;
      const sous = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of sous) if (j >= 0 && !vid[j] && l[j] <= prah) { vid[j] = 1; zas.push(j); }
    }
    return { body, okraj, preteklo: false };
  }

  /* ---------- úhly ---------- */
  /* α ve stupních; š > d (měřicí chyba u kulatých stop) → 90° */
  function uhelDopadu(sirka, delka) {
    if (!(sirka > 0 && delka > 0)) return NaN;
    return Math.asin(Math.min(1, sirka / delka)) / RAD;
  }
  /* γ z jednotkového vektoru v rovině (x doprava, y nahoru) */
  function gammaZVektoru(tx, ty) {
    const g = Math.atan2(tx, ty) / RAD;
    return (g + 360) % 360;
  }
  const vektorZGamma = g => [Math.sin(g * RAD), Math.cos(g * RAD)];

  /* ---------- stopa v rovině plochy ---------- */
  /* kal = { mmNaPx, ox, oy, H? } (počátek v px obrázku; H = homografie obrázek → rovina v mm);
     stopa = { cx, cy, a, b, theta, smer (+1/−1/0), sirkaMm?, delkaMm?, gammaRucne? } – ruční hodnoty mají přednost */
  function stopaVRovine(s, kal) {
    let x, y, sirka, delka, gamma = null;
    if (kal.H) {
      // elipsa v rovině = proložení obrazu bodů okraje (perspektiva elipsu zkreslí, ale zůstane kuželosečkou)
      const e = elipsaZBodu(bodyElipsy(s, 24).map(([px, py]) => zObrazu(kal, px, py)));
      const st = e || (() => { const [a, b] = zObrazu(kal, s.cx, s.cy); return { cx: a, cy: b, a: s.a * meritkoH(kal, s.cx, s.cy), b: s.b * meritkoH(kal, s.cx, s.cy), theta: 0 }; })();
      x = st.cx; y = st.cy; sirka = 2 * st.b; delka = 2 * st.a;
      if (s.smer) {
        const [hx, hy] = zObrazu(kal, s.cx + s.smer * Math.cos(s.theta) * s.a, s.cy + s.smer * Math.sin(s.theta) * s.a);
        const zn = (hx - x) * Math.cos(st.theta) + (hy - y) * Math.sin(st.theta) >= 0 ? 1 : -1;
        gamma = gammaZVektoru(zn * Math.cos(st.theta), zn * Math.sin(st.theta));
      }
    } else {
      const k = kal.mmNaPx > 0 ? kal.mmNaPx : 1;
      x = (s.cx - kal.ox) * k; y = (kal.oy - s.cy) * k;
      sirka = 2 * s.b * k; delka = 2 * s.a * k;
      if (s.smer) gamma = gammaZVektoru(s.smer * Math.cos(s.theta), -s.smer * Math.sin(s.theta));
    }
    if (s.sirkaMm > 0) sirka = s.sirkaMm;
    if (s.delkaMm > 0) delka = s.delkaMm;
    if (Number.isFinite(s.gammaRucne)) gamma = ((s.gammaRucne % 360) + 360) % 360;
    return { id: s.id, nazev: s.nazev, x, y, sirka, delka, pomer: sirka / delka, alfa: uhelDopadu(sirka, delka), gamma, pouzit: s.pouzit !== false };
  }
  /* orientace podle ocásku: ocásek ukazuje ve směru letu */
  function smerZOcasku(s, tx, ty) {
    const d = (tx - s.cx) * Math.cos(s.theta) + (ty - s.cy) * Math.sin(s.theta);
    return d >= 0 ? 1 : -1;
  }

  /* ---------- konvergence 2D ---------- */
  /* r = výsledky stopaVRovine; zpětné přímky (proti směru letu) */
  function konvergence(r) {
    const st = r.filter(s => s.pouzit && s.gamma != null && Number.isFinite(s.alfa));
    if (st.length < 2) return null;
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
    for (const s of st) {
      const [tx, ty] = vektorZGamma(s.gamma);
      const m11 = 1 - tx * tx, m12 = -tx * ty, m22 = 1 - ty * ty;
      a11 += m11; a12 += m12; a22 += m22;
      b1 += m11 * s.x + m12 * s.y; b2 += m12 * s.x + m22 * s.y;
    }
    const det = a11 * a22 - a12 * a12;
    if (Math.abs(det) < 1e-9 * st.length * st.length) return null; // rovnoběžné
    const bx = (a22 * b1 - a12 * b2) / det, by = (a11 * b2 - a12 * b1) / det;
    let sum = 0;
    const vzd = st.map(s => {
      const [tx, ty] = vektorZGamma(s.gamma);
      const kolmo = (bx - s.x) * ty - (by - s.y) * tx;
      sum += kolmo * kolmo;
      return { id: s.id, kolmo, D: Math.hypot(bx - s.x, by - s.y), zpet: -((bx - s.x) * tx + (by - s.y) * ty) };
    });
    // průsečíky dvojic zpětných přímek (jen ty, které leží za oběma stopami)
    const pruseciky = [];
    for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
      const p = prusecik(st[i], st[j]);
      if (p) pruseciky.push(p);
    }
    return { x: bx, y: by, rms: Math.sqrt(sum / st.length), n: st.length, vzd, pruseciky, obal: konvexniObal(pruseciky) };
  }
  function prusecik(s1, s2) {
    const [ax, ay] = vektorZGamma(s1.gamma), [bx, by] = vektorZGamma(s2.gamma);
    // s1 − u·a = s2 − v·b (u, v ≥ 0 = za stopou)
    const det = -ax * by + ay * bx;
    if (Math.abs(det) < 1e-6) return null;
    const dx = s2.x - s1.x, dy = s2.y - s1.y;
    const u = (dx * by - bx * dy) / det, v = (ay * dx - ax * dy) / det;
    if (u < 0 || v < 0) return null;
    return { x: s1.x - u * ax, y: s1.y - u * ay };
  }
  function konvexniObal(p) {
    const b = p.slice().sort((a, c) => a.x - c.x || a.y - c.y);
    if (b.length < 3) return b;
    const kr = (o, a, c) => (a.x - o.x) * (c.y - o.y) - (a.y - o.y) * (c.x - o.x);
    const dol = [], hor = [];
    for (const q of b) { while (dol.length >= 2 && kr(dol[dol.length - 2], dol[dol.length - 1], q) <= 0) dol.pop(); dol.push(q); }
    for (const q of b.slice().reverse()) { while (hor.length >= 2 && kr(hor[hor.length - 2], hor[hor.length - 1], q) <= 0) hor.pop(); hor.push(q); }
    return dol.slice(0, -1).concat(hor.slice(0, -1));
  }

  /* ---------- původ 3D ---------- */
  /* zpětný směr letu (z plochy ven): (−t·cos α, sin α) */
  function zpetnySmer(s) {
    const [tx, ty] = vektorZGamma(s.gamma), ca = Math.cos(s.alfa * RAD), sa = Math.sin(s.alfa * RAD);
    return [-tx * ca, -ty * ca, sa];
  }
  /* Tangentová metoda: z_i = D_i · tan α_i, D_i = vzdálenost stopy od bodu konvergence.
     Přímky 3D: bod nejblíže všem zpětným přímkám (nejmenší čtverce). */
  function puvod(r) {
    const k = konvergence(r);
    if (!k) return null;
    const st = r.filter(s => s.pouzit && s.gamma != null && Number.isFinite(s.alfa));
    const vysky = st.map(s => {
      const D = Math.hypot(k.x - s.x, k.y - s.y);
      return { id: s.id, D, z: s.alfa >= 89.999 ? Infinity : D * Math.tan(s.alfa * RAD) };
    });
    const kon = vysky.map(v => v.z).filter(Number.isFinite);
    const prumer = kon.length ? kon.reduce((a, b) => a + b, 0) / kon.length : NaN;
    const sd = kon.length > 1 ? Math.sqrt(kon.reduce((a, b) => a + (b - prumer) ** 2, 0) / (kon.length - 1)) : 0;
    // 3D nejmenší čtverce
    const primky = nejblizsiBod(st.map(s => ({ id: s.id, P: [s.x, s.y, 0], d: zpetnySmer(s) })));
    return { konvergence: k, tangenta: { x: k.x, y: k.y, z: prumer, sd, vysky }, primky };
  }

  /* ---------- nejistota (Monte Carlo) ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    let u = 0; while (u === 0) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  }
  function kvantil(serazene, p) {
    if (!serazene.length) return NaN;
    const i = (serazene.length - 1) * p, d = Math.floor(i), h = Math.ceil(i);
    return serazene[d] + (serazene[h] - serazene[d]) * (i - d);
  }
  function statistika(h) {
    const s = h.filter(Number.isFinite).sort((a, b) => a - b);
    const n = s.length, m = n ? s.reduce((a, b) => a + b, 0) / n : NaN;
    return { prumer: m, sd: n > 1 ? Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0, p5: kvantil(s, 0.05), p95: kvantil(s, 0.95), n };
  }
  /* opt = { sRozmer (mm), sGamma (°), n, seed } – náhodně rozhodí šířku, délku a γ každé stopy */
  function nejistota(r, opt) {
    opt = Object.assign({ sRozmer: 0.1, sGamma: 3, n: 400, seed: 1 }, opt || {});
    const nah = rng(opt.seed), body = [], tg = { x: [], y: [], z: [] }, pr = { x: [], y: [], z: [] };
    for (let i = 0; i < opt.n; i++) {
      const rr = r.map(s => {
        if (!s.pouzit || s.gamma == null) return s;
        const sirka = Math.max(1e-3, s.sirka + gauss(nah) * opt.sRozmer), delka = Math.max(1e-3, s.delka + gauss(nah) * opt.sRozmer);
        return Object.assign({}, s, { sirka, delka, alfa: uhelDopadu(sirka, delka), gamma: (s.gamma + gauss(nah) * opt.sGamma + 360) % 360 });
      });
      const p = puvod(rr);
      if (!p) continue;
      tg.x.push(p.tangenta.x); tg.y.push(p.tangenta.y); tg.z.push(p.tangenta.z);
      if (p.primky) { pr.x.push(p.primky.x); pr.y.push(p.primky.y); pr.z.push(p.primky.z); if (body.length < 300) body.push([p.primky.x, p.primky.y, p.primky.z]); }
    }
    const st = o => ({ x: statistika(o.x), y: statistika(o.y), z: statistika(o.z) });
    return { tangenta: st(tg), primky: st(pr), body, n: opt.n };
  }
  /* rozsah α při chybě měření ±s (mm) */
  function rozsahAlfa(sirka, delka, s) {
    return [uhelDopadu(Math.max(1e-3, sirka - s), delka + s), uhelDopadu(sirka + s, Math.max(1e-3, delka - s))];
  }

  /* ---------- homografie (korekce perspektivy ze 4 bodů) ---------- */
  /* řešení Ax = b Gaussovou eliminací s částečnou pivotací */
  function resLin(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  /* H (9 čísel, h9 = 1): 4 body obrázku z → 4 body roviny c; body z se kvůli stabilitě normalizují */
  function homografie(z, c) {
    if (!Array.isArray(z) || !Array.isArray(c) || z.length !== 4 || c.length !== 4) return null;
    const mx = z.reduce((a, p) => a + p[0], 0) / 4, my = z.reduce((a, p) => a + p[1], 0) / 4;
    const k = Math.sqrt(2) / (z.reduce((a, p) => a + Math.hypot(p[0] - mx, p[1] - my), 0) / 4 || 1);
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const x = (z[i][0] - mx) * k, y = (z[i][1] - my) * k, [u, v] = c[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = resLin(A, b);
    if (!h || !h.every(Number.isFinite)) return null;
    // H = Hn · T, T = [[k,0,−k·mx],[0,k,−k·my],[0,0,1]]
    const Hn = [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]], T = [[k, 0, -k * mx], [0, k, -k * my], [0, 0, 1]];
    const H = mul3(Hn, T), d = H[2][2];
    if (Math.abs(d) < 1e-15) return null;
    return [].concat(...H).map(v => v / d);
  }
  function aplikujH(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  }
  const cacheInv = new WeakMap();
  function inverzeH(H) {
    if (cacheInv.has(H)) return cacheInv.get(H);
    const m = inv3([[H[0], H[1], H[2]], [H[3], H[4], H[5]], [H[6], H[7], H[8]]]);
    const r = m ? [].concat(...m).map(v => v / m[2][2]) : null;
    cacheInv.set(H, r);
    return r;
  }
  /* obrázek (px) → rovina (mm, y nahoru, vůči počátku) a zpět */
  function zObrazu(kal, px, py) {
    if (kal.H) {
      const [a, b] = aplikujH(kal.H, px, py), [c, d] = aplikujH(kal.H, kal.ox, kal.oy);
      return [a - c, b - d];
    }
    const k = kal.mmNaPx > 0 ? kal.mmNaPx : 1;
    return [(px - kal.ox) * k, (kal.oy - py) * k];
  }
  function doObrazu(kal, x, y) {
    if (kal.H) {
      const Hi = inverzeH(kal.H), [c, d] = aplikujH(kal.H, kal.ox, kal.oy);
      return Hi ? aplikujH(Hi, x + c, y + d) : [NaN, NaN];
    }
    const k = kal.mmNaPx > 0 ? kal.mmNaPx : 1;
    return [kal.ox + x / k, kal.oy - y / k];
  }
  /* místní měřítko homografie (mm na px) = odmocnina z determinantu Jacobiho matice */
  function meritkoH(kal, px, py) {
    const [a, b] = aplikujH(kal.H, px, py), [c, d] = aplikujH(kal.H, px + 1, py), [e, f] = aplikujH(kal.H, px, py + 1);
    return Math.sqrt(Math.abs((c - a) * (f - b) - (d - b) * (e - a)));
  }

  /* ---------- plochy ve společném souřadném systému místnosti ---------- */
  /* Místnost: X, Y vodorovně, Z nahoru (mm). Plocha má počátek O (poloha jejího referenčního bodu v místnosti)
     a bázi eu (x na fotce), ev (y na fotce), n (kolmo z plochy do prostoru). natoceni = azimut pohledu fotografa. */
  const TYPY_PLOCH = { podlaha: 'Podlaha', stena: 'Stěna', strop: 'Strop' };
  function bazePlochy(pl) {
    const f = (Number(pl && pl.natoceni) || 0) * RAD, c = Math.cos(f), s = Math.sin(f), O = (pl && pl.O) || [0, 0, 0];
    if (pl && pl.typ === 'stena') return { O, eu: [c, -s, 0], ev: [0, 0, 1], n: [-s, -c, 0] };
    if (pl && pl.typ === 'strop') return { O, eu: [c, -s, 0], ev: [-s, -c, 0], n: [0, 0, -1] };
    return { O, eu: [c, -s, 0], ev: [s, c, 0], n: [0, 0, 1] };
  }
  const doMistnosti = (B, x, y, z) => [0, 1, 2].map(i => B.O[i] + x * B.eu[i] + y * B.ev[i] + z * B.n[i]);
  function zMistnosti(B, P) {
    const d = [P[0] - B.O[0], P[1] - B.O[1], P[2] - B.O[2]], sk = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return [sk(d, B.eu), sk(d, B.ev), sk(d, B.n)];
  }
  /* zpětná přímka stopy v místnosti: P = poloha stopy, d = jednotkový směr proti letu (z plochy ven) */
  function paprsek(r, B) {
    const u = zpetnySmer(r);
    return { id: r.id, plocha: r.plocha, P: doMistnosti(B, r.x, r.y, 0), d: [0, 1, 2].map(i => u[0] * B.eu[i] + u[1] * B.ev[i] + u[2] * B.n[i]) };
  }
  /* bod nejblíže všem přímkám (nejmenší čtverce) – obdoba metody provázků */
  function nejblizsiBod(pp) {
    if (!pp || pp.length < 2) return null;
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
    for (const p of pp) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const m = (i === j ? 1 : 0) - p.d[i] * p.d[j];
      A[i][j] += m; B[i] += m * p.P[j];
    }
    const Ai = inv3(A);
    if (!Ai) return null;
    const x = mulv3(Ai, B);
    if (!x.every(Number.isFinite)) return null;
    let sum = 0;
    for (const p of pp) sum += vzdOdPrimky(p, x) ** 2;
    return { x: x[0], y: x[1], z: x[2], rms: Math.sqrt(sum / pp.length) };
  }
  function vzdOdPrimky(p, c) {
    const v = [c[0] - p.P[0], c[1] - p.P[1], c[2] - p.P[2]], t = v[0] * p.d[0] + v[1] * p.d[1] + v[2] * p.d[2];
    return Math.hypot(v[0] - t * p.d[0], v[1] - t * p.d[1], v[2] - t * p.d[2]);
  }
  /* vzdálenost bodu od polopřímky (za plochou = vzdálenost od stopy) */
  function vzdOdPaprsku(p, c) {
    const v = [c[0] - p.P[0], c[1] - p.P[1], c[2] - p.P[2]], t = Math.max(0, v[0] * p.d[0] + v[1] * p.d[1] + v[2] * p.d[2]);
    return Math.hypot(v[0] - t * p.d[0], v[1] - t * p.d[1], v[2] - t * p.d[2]);
  }
  /* střed nejkratší spojnice dvou polopřímek (obě před plochou) */
  function stredPriblizeni(a, b) {
    const w = [a.P[0] - b.P[0], a.P[1] - b.P[1], a.P[2] - b.P[2]], sk = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const k = sk(a.d, b.d), d = sk(a.d, w), e = sk(b.d, w), den = 1 - k * k;
    if (den < 1e-6) return null;
    const s = (k * e - d) / den, t = (e - k * d) / den;
    if (!(s > 0 && t > 0)) return null;
    return [0, 1, 2].map(i => (a.P[i] + s * a.d[i] + b.P[i] + t * b.d[i]) / 2);
  }
  /* Robustní hledání zdrojů (postupný RANSAC): kandidát = střed přiblížení dvojice přímek, podpora = přímky blíž
     než prah; nejlepší kandidát se zpřesní nejmenšími čtverci, jeho přímky se odeberou a hledá se další zdroj.
     Co nezbude v žádném zdroji s aspoň minPocet stopami, je odlehlé. */
  function shluky(pp, opt) {
    const prah = (opt && opt.prah) || 60, minP = Math.max(2, (opt && opt.minPocet) || 3), maxZ = (opt && opt.maxZdroju) || 6;
    let zb = pp.slice();
    const zdroje = [];
    while (zb.length >= minP && zdroje.length < maxZ) {
      let nej = null;
      for (let i = 0; i < zb.length; i++) for (let j = i + 1; j < zb.length; j++) {
        const c = stredPriblizeni(zb[i], zb[j]);
        if (!c) continue;
        let n = 0, sum = 0;
        for (const p of zb) { const v = vzdOdPaprsku(p, c); if (v < prah) { n++; sum += v; } }
        if (!nej || n > nej.n || (n === nej.n && sum < nej.sum)) nej = { c, n, sum };
      }
      if (!nej || nej.n < minP) break;
      let cl = zb.filter(p => vzdOdPaprsku(p, nej.c) < prah), bod = null;
      for (let k = 0; k < 8; k++) {
        bod = nejblizsiBod(cl);
        if (!bod) break;
        const nove = zb.filter(p => vzdOdPaprsku(p, [bod.x, bod.y, bod.z]) < prah);
        const stejne = nove.length === cl.length && nove.every(p => cl.includes(p));
        if (nove.length < minP) break;
        cl = nove;
        if (stejne) break;
      }
      if (!bod || cl.length < minP) break;
      zdroje.push({ ids: cl.map(p => p.id), bod: nejblizsiBod(cl) });
      zb = zb.filter(p => !cl.includes(p));
    }
    return { zdroje, odlehle: zb.map(p => p.id) };
  }

  /* ---------- gravitace (balistika bez odporu vzduchu) ---------- */
  const G = 9810; // mm/s²
  /* vodorovné průměty zpětných přímek se protínají nad zdrojem i při zakřivené dráze (gravitace mění jen svislou složku) */
  function vodorovnaKonvergence(pp) {
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0, n = 0;
    for (const p of pp) {
      const h = Math.hypot(p.d[0], p.d[1]);
      if (h < 0.15) continue;
      const tx = p.d[0] / h, ty = p.d[1] / h, m11 = 1 - tx * tx, m12 = -tx * ty, m22 = 1 - ty * ty;
      a11 += m11; a12 += m12; a22 += m22; b1 += m11 * p.P[0] + m12 * p.P[1]; b2 += m12 * p.P[0] + m22 * p.P[1]; n++;
    }
    const det = a11 * a22 - a12 * a12;
    if (n < 2 || Math.abs(det) < 1e-9 * n * n) return null;
    return [(a22 * b1 - a12 * b2) / det, (a11 * b2 - a12 * b1) / det];
  }
  /* Výška zdroje při rychlosti dopadu v (mm/s): každá stopa se vede zpět po parabole až nad vodorovný průsečík. */
  function korekceGravitace(pp, v) {
    const k = vodorovnaKonvergence(pp);
    if (!k || !(v > 0)) return null;
    const body = [];
    for (const p of pp) {
      const h2 = p.d[0] * p.d[0] + p.d[1] * p.d[1];
      if (h2 < 0.0225) continue;
      const tau = ((k[0] - p.P[0]) * p.d[0] + (k[1] - p.P[1]) * p.d[1]) / (v * h2);
      if (!(tau > 0)) continue;
      body.push({ id: p.id, z: p.P[2] + v * p.d[2] * tau - 0.5 * G * tau * tau, t: tau });
    }
    if (!body.length) return null;
    const z = body.reduce((a, b) => a + b.z, 0) / body.length;
    const sd = body.length > 1 ? Math.sqrt(body.reduce((a, b) => a + (b.z - z) ** 2, 0) / (body.length - 1)) : 0;
    return { x: k[0], y: k[1], z, sd, n: body.length, v, body };
  }
  /* body dráhy zpět od stopy (pro kreslení), τ = 0 … tMax */
  function drahaZpet(p, v, tMax, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = tMax * i / n;
      out.push([p.P[0] + v * p.d[0] * t, p.P[1] + v * p.d[1] * t, p.P[2] + v * p.d[2] * t - 0.5 * G * t * t]);
    }
    return out;
  }
  /* vržená kapka: zdroj S (místnost, mm), počáteční rychlost w (mm/s) → stopa na ploše B, nebo null */
  function balistickaStopa(S, w, B) {
    const sk = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], g = [0, 0, -G];
    const a = 0.5 * sk(B.n, g), b = sk(B.n, w), c = sk(B.n, [S[0] - B.O[0], S[1] - B.O[1], S[2] - B.O[2]]);
    let t;
    if (Math.abs(a) < 1e-9) t = Math.abs(b) < 1e-12 ? NaN : -c / b;
    else {
      const D = b * b - 4 * a * c;
      if (D < 0) return null;
      t = [(-b - Math.sqrt(D)) / (2 * a), (-b + Math.sqrt(D)) / (2 * a)].filter(x => x > 1e-9).sort((p, q) => p - q)[0];
    }
    if (!(t > 0)) return null;
    const P = [0, 1, 2].map(i => S[i] + w[i] * t + 0.5 * g[i] * t * t), vin = [0, 1, 2].map(i => w[i] + g[i] * t);
    const [x, y] = zMistnosti(B, P), vu = sk(vin, B.eu), vv = sk(vin, B.ev), vn = sk(vin, B.n), h = Math.hypot(vu, vv);
    if (!(vn < 0) || h < 1e-9) return null;
    return { x, y, alfa: Math.atan2(-vn, h) / RAD, tx: vu / h, ty: vv / h, rychlost: Math.hypot(vin[0], vin[1], vin[2]), t };
  }

  /* ---------- nejistota zdrojů (Monte Carlo) ---------- */
  /* vlastní čísla a vektory symetrické 3×3 (Jacobi) */
  function vlastniSym3(m) {
    const a = m.map(r => r.slice()), v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let it = 0; it < 60; it++) {
      let p = 0, q = 1;
      if (Math.abs(a[0][2]) > Math.abs(a[p][q])) { p = 0; q = 2; }
      if (Math.abs(a[1][2]) > Math.abs(a[p][q])) { p = 1; q = 2; }
      if (Math.abs(a[p][q]) <= 1e-13 * (Math.abs(a[0][0]) + Math.abs(a[1][1]) + Math.abs(a[2][2])) + 1e-300) break;
      const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = c * x - s * y; v[k][q] = s * x + c * y; }
    }
    return { hodnoty: [a[0][0], a[1][1], a[2][2]], vektory: [0, 1, 2].map(j => [v[0][j], v[1][j], v[2][j]]) };
  }
  const CHI2_90 = { 2: 4.605, 3: 6.251 };
  /* 90% elipsoid z mračna bodů [[x,y,z]…] */
  function oblast3D(body) {
    const n = body.length;
    if (n < 4) return null;
    const m = [0, 1, 2].map(i => body.reduce((a, b) => a + b[i], 0) / n);
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const b of body) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += (b[i] - m[i]) * (b[j] - m[j]) / (n - 1);
    const e = vlastniSym3(C);
    return { stred: m, kov: C, osy: e.hodnoty.map(l => Math.sqrt(CHI2_90[3] * Math.max(0, l))), smery: e.vektory, statistika: [0, 1, 2].map(i => statistika(body.map(b => b[i]))) };
  }
  /* 90% elipsa z bodů [[x,y]…] (pro průmět na plochu) */
  function elipsa2D(body) {
    const n = body.length;
    if (n < 3) return null;
    const mx = body.reduce((a, b) => a + b[0], 0) / n, my = body.reduce((a, b) => a + b[1], 0) / n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of body) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
    sxx /= n - 1; syy /= n - 1; sxy /= n - 1;
    const s = (sxx + syy) / 2, d = Math.hypot((sxx - syy) / 2, sxy), k = CHI2_90[2];
    return { cx: mx, cy: my, a: Math.sqrt(k * (s + d)), b: Math.sqrt(k * Math.max(0, s - d)), theta: 0.5 * Math.atan2(2 * sxy, sxx - syy) };
  }
  /* rovina = stopy v rovinách (s .plocha), baze = { idPlochy: B }, zdroje = [{ ids }]; opt = { sRozmer, sGamma, n, seed } */
  function nejistotaZdroju(rovina, baze, zdroje, opt) {
    opt = Object.assign({ sRozmer: 0.1, sGamma: 3, n: 300, seed: 1 }, opt || {});
    const nah = rng(opt.seed), vys = zdroje.map(() => []);
    const zaklad = rovina.filter(r => r.pouzit && r.gamma != null && Number.isFinite(r.alfa) && baze[r.plocha]);
    for (let i = 0; i < opt.n; i++) {
      const pp = new Map();
      for (const r of zaklad) {
        const sirka = Math.max(1e-3, r.sirka + gauss(nah) * opt.sRozmer), delka = Math.max(1e-3, r.delka + gauss(nah) * opt.sRozmer);
        pp.set(r.id, paprsek(Object.assign({}, r, { alfa: uhelDopadu(sirka, delka), gamma: (r.gamma + gauss(nah) * opt.sGamma + 360) % 360 }), baze[r.plocha]));
      }
      zdroje.forEach((z, k) => {
        const b = nejblizsiBod(z.ids.map(id => pp.get(id)).filter(Boolean));
        if (b) vys[k].push([b.x, b.y, b.z]);
      });
    }
    return vys.map(body => { const o = oblast3D(body); if (o) o.body = body.slice(0, 300); return o; });
  }

  /* ---------- celková analýza projektu ---------- */
  function vsechnyMm(d) { return d.plochy.every(pl => pl.kal.H || pl.kal.mmNaPx > 0); }
  function analyza(d) {
    const baze = {}, rovina = [], n = d.nastaveni;
    for (const pl of d.plochy) baze[pl.id] = bazePlochy(pl);
    for (const s of d.stopy) {
      const pl = d.plochy.find(p => p.id === s.plocha);
      if (!pl) continue;
      const r = stopaVRovine(s, pl.kal);
      r.plocha = pl.id;
      rovina.push(r);
    }
    const pp = rovina.filter(r => r.pouzit && r.gamma != null && Number.isFinite(r.alfa)).map(r => paprsek(r, baze[r.plocha]));
    const sk = n.shluky && pp.length >= n.minShluk ? shluky(pp, { prah: n.prahShluku, minPocet: n.minShluk })
      : { zdroje: pp.length >= 2 ? [{ ids: pp.map(p => p.id) }] : [], odlehle: [] };
    const mm = vsechnyMm(d), zdroje = [];
    for (const z of sk.zdroje) {
      const cl = pp.filter(p => z.ids.includes(p.id)), bod = nejblizsiBod(cl);
      if (!bod) continue;
      const roviny = [];
      for (const pl of d.plochy) {
        const rr = rovina.filter(r => r.plocha === pl.id && z.ids.includes(r.id));
        const pu = rr.length >= 2 ? puvod(rr) : null;
        if (!pu) continue;
        const t = pu.tangenta;
        roviny.push({ plocha: pl.id, n: rr.length, konvergence: pu.konvergence, tangenta: t, tangentaMistnost: Number.isFinite(t.z) ? doMistnosti(baze[pl.id], t.x, t.y, t.z) : null });
      }
      const gravitace = mm && n.vMax > 0 ? [n.vMin, n.vMax].map(v => korekceGravitace(cl, v * 1000)) : null;
      zdroje.push({ id: 'Z' + (zdroje.length + 1), ids: z.ids, bod, roviny, gravitace });
    }
    const vZdroji = {};
    zdroje.forEach((z, i) => z.ids.forEach(id => { vZdroji[id] = i; }));
    return { rovina, paprsky: pp, zdroje, odlehle: sk.odlehle, vZdroji, baze, mm };
  }

  /* ---------- export ---------- */
  const cis = (v, d) => Number.isFinite(v) ? v.toFixed(d) : '';
  function csvBunka(v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  /* A = analyza(d) */
  function csv(A, d) {
    const nazvy = {};
    for (const pl of d.plochy) nazvy[pl.id] = pl.nazev;
    const rad = [['stopa', 'plocha', 'pouzita', 'zdroj', 'x_mm', 'y_mm', 'X_mm', 'Y_mm', 'Z_mm', 'sirka_mm', 'delka_mm', 'pomer_s_d', 'alfa_st', 'gamma_st', 'vzdalenost_primky_od_zdroje_mm', 'D_konvergence_mm', 'vyska_tg_mm']];
    for (const r of A.rovina) {
      const zi = A.vZdroji[r.id], z = zi == null ? null : A.zdroje[zi], pp = A.paprsky.find(p => p.id === r.id);
      const P = A.baze[r.plocha] ? doMistnosti(A.baze[r.plocha], r.x, r.y, 0) : [NaN, NaN, NaN];
      const rv = z && z.roviny.find(q => q.plocha === r.plocha), vy = rv && rv.tangenta.vysky.find(v => v.id === r.id);
      rad.push([r.nazev, nazvy[r.plocha] || '', r.pouzit ? 'ano' : 'ne', z ? z.id : A.odlehle.includes(r.id) ? 'odlehla' : '',
        cis(r.x, 1), cis(r.y, 1), cis(P[0], 1), cis(P[1], 1), cis(P[2], 1), cis(r.sirka, 2), cis(r.delka, 2), cis(r.pomer, 3), cis(r.alfa, 1),
        r.gamma == null ? '' : cis(r.gamma, 1), z && pp ? cis(vzdOdPrimky(pp, [z.bod.x, z.bod.y, z.bod.z]), 1) : '', vy ? cis(vy.D, 1) : '', vy ? cis(vy.z, 1) : '']);
    }
    return '﻿' + rad.map(r => r.map(csvBunka).join(';')).join('\r\n') + '\r\n';
  }

  /* ---------- uložená data ---------- */
  const prazdnyKal = () => ({ mmNaPx: 0, ox: 0, oy: 0, body: null, mm: 0, H: null, rohy: null, rozmer: null });
  function novaPlocha(typ, id) {
    typ = TYPY_PLOCH[typ] ? typ : 'podlaha';
    return { id: id || 'P1', nazev: TYPY_PLOCH[typ], typ, natoceni: 0, O: [0, 0, 0], kal: prazdnyKal() };
  }
  function prazdna() {
    return {
      verze: VERZE, plochy: [novaPlocha('podlaha', 'P1')], aktivni: 'P1', stopy: [],
      pripad: { cislo: '', misto: '', plocha: '', zpracoval: '', pozn: '' },
      nastaveni: { sRozmer: 0.1, sGamma: 3, shluky: true, prahShluku: 60, minShluk: 3, vMin: 1.5, vMax: 7.5 }
    };
  }
  const cislo = (v, d) => Number.isFinite(+v) && v !== null && v !== '' ? +v : d;
  function migrujKal(k) {
    k = k || {};
    const H = Array.isArray(k.H) && k.H.length === 9 && k.H.every(Number.isFinite) ? k.H.slice() : null;
    const body = v => Array.isArray(v) && v.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) ? v.map(p => p.slice()) : null;
    return { mmNaPx: Math.max(0, cislo(k.mmNaPx, 0)), ox: cislo(k.ox, 0), oy: cislo(k.oy, 0), body: body(k.body), mm: cislo(k.mm, 0), H,
      rohy: H ? body(k.rohy) : null, rozmer: H && Array.isArray(k.rozmer) ? k.rozmer.map(v => cislo(v, 0)) : null };
  }
  function dalsiIdPlochy(plochy) {
    let n = 1;
    const ids = new Set(plochy.map(p => p.id));
    while (ids.has('P' + n)) n++;
    return 'P' + n;
  }
  function migruj(d) {
    const p = prazdna();
    if (!d || typeof d !== 'object') return p;
    if (Array.isArray(d.plochy) && d.plochy.length) {
      p.plochy = [];
      for (const q of d.plochy) {
        if (!q || typeof q !== 'object') continue;
        const pl = novaPlocha(q.typ, typeof q.id === 'string' && q.id && !p.plochy.some(x => x.id === q.id) ? q.id.slice(0, 20) : dalsiIdPlochy(p.plochy));
        pl.nazev = String(q.nazev || pl.nazev).slice(0, 40);
        pl.natoceni = cislo(q.natoceni, 0);
        pl.O = Array.isArray(q.O) ? [0, 1, 2].map(i => cislo(q.O[i], 0)) : [0, 0, 0];
        pl.kal = migrujKal(q.kal);
        p.plochy.push(pl);
      }
      if (!p.plochy.length) p.plochy = [novaPlocha('podlaha', 'P1')];
    } else if (d.kal) p.plochy[0].kal = migrujKal(d.kal); // verze 1: jedna plocha
    p.aktivni = p.plochy.some(x => x.id === d.aktivni) ? d.aktivni : p.plochy[0].id;
    if (d.pripad) for (const kl of Object.keys(p.pripad)) p.pripad[kl] = String(d.pripad[kl] || '').slice(0, 500);
    const n = d.nastaveni;
    if (n) {
      const N = p.nastaveni;
      N.sRozmer = Math.max(0, cislo(n.sRozmer, N.sRozmer)); N.sGamma = Math.max(0, cislo(n.sGamma, N.sGamma));
      if (typeof n.shluky === 'boolean') N.shluky = n.shluky;
      N.prahShluku = Math.max(1, cislo(n.prahShluku, N.prahShluku)); N.minShluk = Math.max(2, Math.round(cislo(n.minShluk, N.minShluk)));
      N.vMin = Math.max(0.1, cislo(n.vMin, N.vMin)); N.vMax = Math.max(N.vMin, cislo(n.vMax, N.vMax));
    }
    if (Array.isArray(d.stopy)) p.stopy = d.stopy.filter(s => s && [s.cx, s.cy, s.a, s.b, s.theta].every(Number.isFinite)).map((s, i) => ({
      id: String(s.id || 'S' + (i + 1)), nazev: String(s.nazev || 'S' + (i + 1)).slice(0, 40),
      plocha: p.plochy.some(x => x.id === s.plocha) ? s.plocha : p.plochy[0].id,
      cx: s.cx, cy: s.cy, a: s.a, b: s.b, theta: s.theta, smer: s.smer === 1 || s.smer === -1 ? s.smer : 0,
      metoda: ['body', 'prah'].includes(s.metoda) ? s.metoda : 'body', body: Array.isArray(s.body) ? s.body.slice(0, 200) : [],
      upraveno: !!s.upraveno,
      sirkaMm: cislo(s.sirkaMm, 0), delkaMm: cislo(s.delkaMm, 0), gammaRucne: Number.isFinite(s.gammaRucne) ? s.gammaRucne : null,
      pouzit: s.pouzit !== false, pozn: String(s.pozn || '').slice(0, 300)
    }));
    return p;
  }
  function dalsiNazev(stopy) {
    let n = 1;
    const jm = new Set(stopy.map(s => s.nazev));
    while (jm.has('S' + n)) n++;
    return 'S' + n;
  }

  /* ---------- syntetické stopy ---------- */
  /* m = { x, y (mm v rovině), sirka (mm), alfa (°), tx, ty (směr letu v rovině) } → elipsa v px pro lineární kal */
  function stopaPx(m, kal) {
    const delka = m.sirka / Math.sin(m.alfa * RAD);
    return {
      cx: kal.ox + m.x / kal.mmNaPx, cy: kal.oy - m.y / kal.mmNaPx, a: delka / 2 / kal.mmNaPx, b: m.sirka / 2 / kal.mmNaPx,
      theta: normOsa(Math.atan2(-m.ty, m.tx)), smer: 0, tx: m.tx, ty: m.ty, alfa: m.alfa
    };
  }
  /* zdroj {x,y,z} mm nad plochou; mista = [{x,y,sirka}] → stopy v px pro kal (přímé dráhy) */
  function syntetickeStopy(zdroj, mista, kal) {
    return mista.map((m, i) => {
      const dx = m.x - zdroj.x, dy = m.y - zdroj.y, D = Math.hypot(dx, dy);
      return Object.assign({ id: 'S' + (i + 1), nazev: 'S' + (i + 1) }, stopaPx({ x: m.x, y: m.y, sirka: m.sirka, alfa: Math.atan2(zdroj.z, D) / RAD, tx: dx / D, ty: dy / D }, kal));
    });
  }
  /* body okraje elipsy (pro test a ukázku) */
  function bodyElipsy(e, n, posun) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = (i + (posun || 0)) / n * 2 * Math.PI, c = Math.cos(e.theta), s = Math.sin(e.theta);
      const x = e.a * Math.cos(t), y = e.b * Math.sin(t);
      out.push([e.cx + x * c - y * s, e.cy + x * s + y * c]);
    }
    return out;
  }

  /* ---------- galerie ukázek se známým zdrojem ---------- */
  /* Každá ukázka: popis, nastavení projektu (plochy), skutečné zdroje v místnosti a podklady pro vykreslení fotek:
     obrazy[idPlochy] = { W, H, mmNaPx, ox, oy (vykreslení), pravitko, a4, perspektiva (4 rohy fotky), stopy: [elipsy v px + směr], detekce } */
  const UKAZKY = [
    { id: 'zaklad', ikona: '🎯', nazev: 'Jeden zdroj na podlaze', popis: 'Základní případ: 11 stop z jednoho místa nad podlahou, měřítko a stopy jsou už zakreslené (prahováním).',
      zkuste: ['Otevřete 📋 Tabulku a seřaďte stopy podle α.', 'V 🧊 3D se podívejte z boku na zpětné přímky a mrak Monte Carlo.', 'Vyberte stopu a dolaďte elipsu šipkami – sledujte, jak se změní výška.'] },
    { id: 'dve', ikona: '👥', nazev: 'Dvě události na stěně', popis: 'Na stěně jsou stopy ze dvou různých zdrojů, které se prolínají. Automatické shlukování je rozdělí.',
      zkuste: ['Stopy jsou obarvené podle nalezeného zdroje (Z1, Z2).', 'V ⚙️ Nastavení vypněte hledání více zdrojů – výsledek se slije do jednoho nesmyslného bodu.', 'Zmenšete práh shluku a sledujte, kdy se stopy začnou ztrácet mezi odlehlými.'] },
    { id: 'dve_plochy', ikona: '📐', nazev: 'Stěna a podlaha', popis: 'Dvě fotky – podlaha a stěna v rohu místnosti – ve společném souřadném systému. Zdroj se najde ze stop na obou plochách.',
      zkuste: ['Přepínejte plochy v liště (Plocha ▾).', 'V ⚙️ Umístění plochy zkontrolujte, kde stěna stojí (Y = 600 mm).', 'V 🧊 3D uvidíte obě plochy a průsečík přímek z obou.'] },
    { id: 'sum', ikona: '🌫️', nazev: 'Zašuměné stopy a odlehlé', popis: 'Nepravidelné okraje, satelity, chyby měření a čtyři stopy z jiného děje. Robustní hledání zdroje je vyřadí jako odlehlé.',
      zkuste: ['Odlehlé stopy jsou šedé s křížkem a v tabulce mají zdroj „odlehlá“.', 'Vyřazení si porovnejte: v ⚙️ vypněte hledání více zdrojů.', 'Zvyšte nejistotu měření a sledujte, jak naroste elipsoid původu.'] },
    { id: 'perspektiva', ikona: '⧉', nazev: 'Fotka šikmo – korekce perspektivy', popis: 'Podlaha vyfocená šikmo. Měřítko je list A4 – jeho 4 rohy dávají homografii, která fotku „narovná“.',
      zkuste: ['Zapněte nástroj ⧉ Perspektiva – rohy A4 jsou zakreslené.', 'Tlačítkem Zrušit perspektivu se vrátí jen prosté měřítko: úhly i výška se pokazí.', 'Zkuste rohy zakreslit znovu sami (levý dolní, pravý dolní, pravý horní, levý horní).'] },
    { id: 'gravitace', ikona: '🪂', nazev: 'Gravitace a zakřivené dráhy', popis: 'Kapky letěly obloukem (skutečná balistika). Tangentová metoda výšku výrazně nadhodnotí; korekce gravitace s rozsahem rychlostí ji vrátí blíž ke skutečnosti.',
      zkuste: ['Porovnejte výšku tangentovou metodou se skutečnou (v rámečku ukázky).', 'V ⚙️ měňte rozsah rychlostí dopadu a sledujte pás výšek.', 'V 🧊 3D jsou čárkovaně dráhy po parabolách.'] },
    { id: 'trenink', ikona: '✏️', nazev: 'Zakreslete sami', popis: 'Čistá fotka stěny s pravítkem a šesti stopami. Nic není zakreslené – projděte celý postup a výsledek porovnejte se skutečností.',
      zkuste: ['📏 Měřítko: klikněte na 0 a 20 cm na pravítku a zadejte 200 mm.', '✏️ Body: 6–10 bodů po okraji každé stopy (bez ocásku), Enter.', '➜ Ocásek: klik na stranu výběžku. 🔍 Lupa pomůže s přesností.'] }
  ];
  function ukazka(id) {
    const def = UKAZKY.find(u => u.id === id);
    if (!def) return null;
    const nah = rng({ zaklad: 42, dve: 7, dve_plochy: 11, sum: 5, perspektiva: 3, gravitace: 9, trenink: 21 }[id]);
    const d = prazdna(), obrazy = {}, zdroje = [];
    const plocha = (typ, idp, W, H, mmNaPx, okraj, extra) => {
      const pl = Object.assign(novaPlocha(typ, idp), extra || {});
      const kal = { mmNaPx, ox: okraj, oy: H - okraj };
      obrazy[idp] = { W, H, mmNaPx, ox: kal.ox, oy: kal.oy, stopy: [], detekce: true, pravitko: { x: okraj + 50, y: H - 40, mm: 300 } };
      return { pl, kal, B: bazePlochy(pl) };
    };
    // stopa ze zdroje S (místnost) přímou dráhou; misto = [x, y] v rovině
    const primo = (P, S, x, y, sirka) => {
      const [sx, sy, sz] = zMistnosti(P.B, S), dx = x - sx, dy = y - sy, D = Math.hypot(dx, dy);
      if (!(sz > 0) || D < 1) return null;
      return Object.assign(stopaPx({ x, y, sirka, alfa: Math.atan2(sz, D) / RAD, tx: dx / D, ty: dy / D }, P.kal), { zdroj: zdroje.length - 1 });
    };
    const kolem = (P, S, n, rMin, rMax, sMin, sMax, fMin, fMax, sx) => {
      const [cx, cy] = zMistnosti(P.B, S), o = obrazy[P.pl.id];
      for (let i = 0; i < n; i++) {
        const f = fMin + (i + nah() * 0.6) / n * (fMax - fMin), r = rMin + nah() * (rMax - rMin);
        const x = cx + Math.cos(f) * r * (sx || 1), y = cy + Math.sin(f) * r;
        const xp = P.kal.ox + x / P.kal.mmNaPx, yp = P.kal.oy - y / P.kal.mmNaPx;
        if (xp < 60 || yp < 60 || xp > o.W - 60 || yp > o.H - 110) continue;
        const s = primo(P, S, x, y, sMin + nah() * (sMax - sMin));
        if (s) o.stopy.push(s);
      }
    };
    if (id === 'zaklad') {
      const P = plocha('podlaha', 'P1', 2000, 1375, 0.4, 75);
      zdroje.push([380, 230, 260]);
      kolem(P, zdroje[0], 11, 120, 350, 6, 12, -0.15, Math.PI + 0.15, 1);
      d.plochy = [P.pl];
    } else if (id === 'dve') {
      const P = plocha('stena', 'P1', 2000, 1333, 0.45, 70);
      zdroje.push([250, -300, 380]); kolem(P, zdroje[0], 9, 110, 300, 5, 10, 0, 2 * Math.PI, 1);
      zdroje.push([640, -200, 230]); kolem(P, zdroje[1], 9, 110, 280, 5, 10, 0, 2 * Math.PI, 1);
      d.plochy = [P.pl];
    } else if (id === 'dve_plochy') {
      const F = plocha('podlaha', 'P1', 2000, 1500, 0.4, 0), Wl = plocha('stena', 'P2', 2000, 1375, 0.4, 0, { O: [0, 600, 0] });
      F.pl.nazev = 'Podlaha'; Wl.pl.nazev = 'Stěna (Y = 600)';
      obrazy.P1.pravitko = { x: 120, y: 1500 - 40, mm: 300 }; obrazy.P2.pravitko = { x: 120, y: 1375 - 40, mm: 300 };
      zdroje.push([400, 380, 220]);
      kolem(F, zdroje[0], 8, 140, 330, 6, 11, 0, 2 * Math.PI, 1.1);
      kolem(Wl, zdroje[0], 7, 100, 260, 6, 11, 0, 2 * Math.PI, 1.2);
      d.plochy = [F.pl, Wl.pl];
    } else if (id === 'sum') {
      const P = plocha('podlaha', 'P1', 2000, 1375, 0.4, 75);
      zdroje.push([420, 260, 300]);
      kolem(P, zdroje[0], 15, 130, 330, 6, 11, 0, 2 * Math.PI, 1.15);
      const o = obrazy.P1;
      for (const s of o.stopy) { // chyba tvaru a směru
        const dg = gauss(nah) * 2 * RAD, c = Math.cos(dg), sn = Math.sin(dg);
        [s.tx, s.ty] = [s.tx * c - s.ty * sn, s.tx * sn + s.ty * c];
        s.theta = normOsa(Math.atan2(-s.ty, s.tx)); s.a *= 1 + gauss(nah) * 0.02; s.sum = 0.08;
      }
      for (let i = 0; i < 4; i++) { // stopy z jiného děje: náhodný směr i úhel
        const x = 60 + nah() * 680, y = 60 + nah() * 400, f = nah() * 2 * Math.PI;
        o.stopy.push(Object.assign(stopaPx({ x, y, sirka: 5 + nah() * 5, alfa: 20 + nah() * 45, tx: Math.cos(f), ty: Math.sin(f) }, { mmNaPx: 0.4, ox: 75, oy: 1300 }), { zdroj: -1, sum: 0.08 }));
      }
      o.satelity = true;
      d.plochy = [P.pl];
    } else if (id === 'perspektiva') {
      const P = plocha('podlaha', 'P1', 1750, 1250, 0.4, 75), o = obrazy.P1;
      zdroje.push([330, 260, 240]);
      kolem(P, zdroje[0], 10, 110, 270, 7, 12, 0, 2 * Math.PI, 1.2);
      o.pravitko = null;
      o.a4 = { x: 1750 - 75 - 297 / 0.4, y: 1250 - 75 - 210 / 0.4, w: 297 / 0.4, h: 210 / 0.4 }; // A4 na šířku v px narovnané fotky
      o.perspektiva = [[1750 * 0.2, 1250 * 0.1], [1750 * 0.8, 1250 * 0.1], [1750 * 1.02, 1250 * 0.98], [1750 * -0.02, 1250 * 0.98]];
      d.plochy = [P.pl];
    } else if (id === 'gravitace') {
      const P = plocha('podlaha', 'P1', 2333, 2000, 0.6, 0), o = obrazy.P1;
      o.pravitko = { x: 150, y: 2000 - 40, mm: 300 };
      const S = [700, 600, 300];
      zdroje.push(S);
      for (let i = 0; i < 16; i++) {
        const az = (i + nah() * 0.5) / 16 * 2 * Math.PI, el = (2 + nah() * 28) * RAD, v = 1800;
        const st = balistickaStopa(S, [v * Math.cos(el) * Math.cos(az), v * Math.cos(el) * Math.sin(az), v * Math.sin(el)], P.B);
        if (!st || st.x < 40 || st.y < 80 || st.x > 1360 || st.y > 1160) continue;
        o.stopy.push(Object.assign(stopaPx({ x: st.x, y: st.y, sirka: 7 + nah() * 4, alfa: st.alfa, tx: st.tx, ty: st.ty }, P.kal), { zdroj: 0, rychlost: st.rychlost }));
      }
      d.nastaveni.vMin = 2.5; d.nastaveni.vMax = 4; d.nastaveni.shluky = false; // zakřivené dráhy se v jednom bodě nepotkají
      d.plochy = [P.pl];
    } else if (id === 'trenink') {
      const P = plocha('stena', 'P1', 2000, 1400, 0.3, 60), o = obrazy.P1;
      zdroje.push([300, -200, 210]);
      kolem(P, zdroje[0], 6, 110, 200, 10, 15, 0, 2 * Math.PI, 1.3);
      o.pravitko = { x: 110, y: 1400 - 40, mm: 200 };
      o.detekce = false;
      d.plochy = [P.pl];
    }
    // kalibrace projektu = skutečnost (u tréninku nic)
    for (const pl of d.plochy) {
      const o = obrazy[pl.id];
      if (id === 'trenink') { pl.kal.ox = o.ox; pl.kal.oy = o.oy; continue; }
      if (o.perspektiva) {
        const Hf = homografie([[0, 0], [o.W, 0], [o.W, o.H], [0, o.H]], o.perspektiva), a = o.a4;
        const rohy = [[a.x, a.y + a.h], [a.x + a.w, a.y + a.h], [a.x + a.w, a.y], [a.x, a.y]].map(p => aplikujH(Hf, p[0], p[1]));
        const H = homografie(rohy, [[0, 0], [297, 0], [297, 210], [0, 210]]);
        const [ox, oy] = aplikujH(Hf, o.ox, o.oy);
        pl.kal = Object.assign(prazdnyKal(), { H, rohy, rozmer: [297, 210], ox, oy });
        pl.kal.mmNaPx = meritkoH(pl.kal, o.W / 2, o.H / 2);
        o.Hfoto = Hf;
      } else {
        const p = o.pravitko;
        pl.kal = Object.assign(prazdnyKal(), { mmNaPx: o.mmNaPx, ox: o.ox, oy: o.oy, body: [[p.x, p.y - 34], [p.x + p.mm / o.mmNaPx, p.y - 34]], mm: p.mm });
      }
    }
    d.aktivni = d.plochy[0].id;
    let n = 0;
    for (const pl of d.plochy) for (const s of obrazy[pl.id].stopy) { n++; s.id = 'S' + n; s.nazev = 'S' + n; s.plocha = pl.id; }
    return Object.assign({}, def, { data: d, obrazy, zdroje });
  }
  /* stopa ukázky jako stopa projektu (bez prahování, přesná elipsa; u perspektivy přes obraz okraje) */
  function stopaZUkazky(s, o) {
    let e = { cx: s.cx, cy: s.cy, a: s.a, b: s.b, theta: s.theta }, tip = [s.cx + s.tx * s.a * 2, s.cy - s.ty * s.a * 2];
    if (o.Hfoto) {
      e = elipsaZBodu(bodyElipsy(e, 24).map(p => aplikujH(o.Hfoto, p[0], p[1])));
      tip = aplikujH(o.Hfoto, tip[0], tip[1]);
    }
    const st = { id: s.id, nazev: s.nazev, plocha: s.plocha, cx: e.cx, cy: e.cy, a: e.a, b: e.b, theta: e.theta, smer: 0, metoda: 'prah', body: [], sirkaMm: 0, delkaMm: 0, gammaRucne: null, pouzit: true, pozn: '' };
    st.smer = smerZOcasku(st, tip[0], tip[1]);
    return st;
  }

  const API = {
    VERZE, KLIC: 'webapp_krevni_stopy', G, TYPY_PLOCH, elipsaZBodu, elipsaZMomentu, elipsaZKuzelosecky, korenyKubiky, normOsa,
    jas, otsu, zaplav, uhelDopadu, gammaZVektoru, vektorZGamma, stopaVRovine, smerZOcasku,
    konvergence, prusecik, konvexniObal, puvod, zpetnySmer, nejistota, rozsahAlfa, statistika, rng, gauss, csv,
    homografie, aplikujH, inverzeH, zObrazu, doObrazu, meritkoH,
    bazePlochy, doMistnosti, zMistnosti, paprsek, nejblizsiBod, vzdOdPrimky, vzdOdPaprsku, stredPriblizeni, shluky,
    vodorovnaKonvergence, korekceGravitace, drahaZpet, balistickaStopa,
    vlastniSym3, oblast3D, elipsa2D, nejistotaZdroju, analyza, vsechnyMm,
    prazdna, novaPlocha, dalsiIdPlochy, migruj, dalsiNazev, stopaPx, syntetickeStopy, bodyElipsy, UKAZKY, ukazka, stopaZUkazky
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.KrevniStopyJadro = API;
})();
