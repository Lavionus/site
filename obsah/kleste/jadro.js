/* ============================================================
   Kleště, pinzety a svorky — výpočetní jádro (bez DOM a bez three.js).

   Každý nástroj se skládá z dílů (díl = to, co se hýbe jako celek nebo
   se tiskne jiným materiálem) a díl z uzavřených těles. Tělesa jednoho
   dílu se mohou překrývat (rameno zasahuje do čelisti) — slicer je při
   tisku sloučí. Různé díly se nikdy neprotínají.

   Tři stavební primitiva, každé dává uzavřenou, ven orientovanou síť:
     deska(obrys, diry)        – rovinný obrys vytažený v ose z, výška
                                 se může měnit vrchol od vrcholu,
     tazeni(stanice, uzavrene) – průřez tažený po křivce (ramena, čelisti,
                                 kroužky), průřez se smí po délce měnit,
     rotace(profil, n)         – rotační těleso (čep kloubu).

   Souřadnice v mm. Nástroj leží v rovině xy (tak se i tiskne), z je
   šířka nástroje a jde od podložky z = 0 nahoru.

   V prohlížeči vznikne globální KJ, v node module.exports.
   ============================================================ */
(function (koren) {
  'use strict';

  /* ---------------- pomocné funkce ---------------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const omez = (x, a, b) => x < a ? a : x > b ? b : x;
  const hladce = t => { t = omez(t, 0, 1); return t * t * (3 - 2 * t); };
  // trojúhelníková vlna 0..1..0 s periodou 1 (vrchol v 0,5)
  const troj = x => { const f = x - Math.floor(x); return f < 0.5 ? 2 * f : 2 - 2 * f; };
  const zlomek = x => x - Math.floor(x);
  const rad = s => s * Math.PI / 180;

  function otoc2(p, s, uhel) {        // bod p kolem středu s
    const c = Math.cos(uhel), si = Math.sin(uhel), dx = p[0] - s[0], dy = p[1] - s[1];
    return [s[0] + c * dx - si * dy, s[1] + si * dx + c * dy];
  }
  function otocV2(v, uhel) {
    const c = Math.cos(uhel), si = Math.sin(uhel);
    return [c * v[0] - si * v[1], si * v[0] + c * v[1]];
  }

  /* ---------------- těleso ---------------- */
  function objem(t) {
    const V = t.V, I = t.I;
    let o = 0;
    for (let f = 0; f < I.length; f += 3) {
      const a = I[f] * 3, b = I[f + 1] * 3, c = I[f + 2] * 3;
      o += (V[a] * (V[b + 1] * V[c + 2] - V[b + 2] * V[c + 1])
          - V[a + 1] * (V[b] * V[c + 2] - V[b + 2] * V[c])
          + V[a + 2] * (V[b] * V[c + 1] - V[b + 1] * V[c])) / 6;
    }
    return o;
  }

  // normály ven: když vyjde záporný objem, obrátí se všechny trojúhelníky
  function orientuj(t) {
    if (objem(t) < 0) {
      const I = t.I;
      for (let f = 0; f < I.length; f += 3) { const x = I[f + 1]; I[f + 1] = I[f + 2]; I[f + 2] = x; }
    }
    return t;
  }

  /* Kontrola uzavřenosti: každá hrana právě ve dvou trojúhelnících, jednou
     tam a jednou zpět. Navíc objem a počet (téměř) nulových trojúhelníků. */
  function kontrola(t) {
    const V = t.V, I = t.I, hrany = new Map();
    for (let f = 0; f < I.length; f += 3) {
      for (let k = 0; k < 3; k++) {
        const a = I[f + k], b = I[f + (k + 1) % 3];
        const klic = a < b ? a * 4294967296 + b : b * 4294967296 + a;
        const h = hrany.get(klic);
        if (h) { h[0]++; h[1] += a < b ? 1 : -1; } else hrany.set(klic, [1, a < b ? 1 : -1]);
      }
    }
    let spatne = 0;
    for (const [n, s] of hrany.values()) if (n !== 2 || s !== 0) spatne++;
    let nulove = 0;
    for (let f = 0; f < I.length; f += 3) {
      const a = I[f] * 3, b = I[f + 1] * 3, c = I[f + 2] * 3;
      const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
      const vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
      const n = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      if (n < 1e-9) nulove++;
    }
    let nekonecne = 0;
    for (let i = 0; i < V.length; i++) if (!Number.isFinite(V[i])) nekonecne++;
    return { spatneHrany: spatne, objem: objem(t), nulove, nekonecne, trojuhelniku: I.length / 3 };
  }

  // kopie tělesa s přepočtenými vrcholy: fn([x,y,z]) → [x,y,z]
  function transformuj(t, fn) {
    const V = new Array(t.V.length);
    for (let i = 0; i < t.V.length; i += 3) {
      const p = fn([t.V[i], t.V[i + 1], t.V[i + 2]]);
      V[i] = p[0]; V[i + 1] = p[1]; V[i + 2] = p[2];
    }
    const out = orientuj({ V, I: t.I.slice() });
    if (t.celist) out.celist = t.celist;            // značka tělesa čelisti (kontroly dosednutí)
    return out;
  }
  const otocTeleso = (t, s, uhel) => uhel ? transformuj(t, p => { const q = otoc2(p, s, uhel); return [q[0], q[1], p[2]]; }) : t;
  const zrcadliY = t => transformuj(t, p => [p[0], -p[1], p[2]]);
  const posun = (t, dx, dy, dz) => transformuj(t, p => [p[0] + dx, p[1] + dy, p[2] + (dz || 0)]);

  function obal(telesa) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const t of telesa) for (let i = 0; i < t.V.length; i += 3) for (let k = 0; k < 3; k++) {
      const x = t.V[i + k]; if (x < lo[k]) lo[k] = x; if (x > hi[k]) hi[k] = x;
    }
    return { lo, hi };
  }

  function sluc(telesa) {
    let n = 0;
    for (const t of telesa) n += t.V.length;
    const V = new Float64Array(n), I = [];
    let o = 0;
    for (const t of telesa) {
      V.set(t.V, o);
      const b = o / 3;
      for (let i = 0; i < t.I.length; i++) I.push(t.I[i] + b);
      o += t.V.length;
    }
    return { V, I };
  }

  /* ---------------- rovinné obrysy ---------------- */
  function plocha2(P) {
    let s = 0;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += (P[j][0] - P[i][0]) * (P[j][1] + P[i][1]);
    return s / 2;   // kladná = proti směru hodin
  }

  function bezDuplicit(P, tol) {
    const out = [];
    for (const p of P) {
      const q = out[out.length - 1];
      if (q && Math.abs(q[0] - p[0]) < tol && Math.abs(q[1] - p[1]) < tol) continue;
      out.push(p);
    }
    while (out.length > 2 && Math.abs(out[0][0] - out[out.length - 1][0]) < tol && Math.abs(out[0][1] - out[out.length - 1][1]) < tol) out.pop();
    return out;
  }

  /* Triangulace mnohoúhelníku s dírami ořezáváním uší (převzato z redukce
     se zploštěním, tam ověřené na stovkách sítí). vnejsi a díry: {P: [[x,y]],
     I: [id]} proti směru hodin; vrací trojice id. */
  function triangulujSDirami(vnejsi, diry) {
    const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    let x0 = Infinity, x1 = -Infinity;
    for (const p of vnejsi.P) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
    const eps = 1e-12 * (x1 - x0) * (x1 - x0);
    const stejne = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
    let poly = vnejsi.P.map((p, k) => ({ p, i: vnejsi.I[k] }));
    const hl = diry.map(d => {
      const v = d.P.map((p, k) => ({ p, i: d.I[k] })).reverse();   // díry po směru hodin
      let m = 0;
      v.forEach((q, k) => { if (q.p[0] > v[m].p[0]) m = k; });
      return { v, m };
    });
    hl.sort((a, b) => b.v[b.m].p[0] - a.v[a.m].p[0]);

    const vKlinu = (k, M) => {
      const n = poly.length, u = poly[(k - 1 + n) % n].p, v = poly[k].p, w = poly[(k + 1) % n].p;
      const l1 = orient(u, v, M) >= -eps, l2 = orient(v, w, M) >= -eps;
      return orient(u, v, w) > eps ? (l1 && l2) : (l1 || l2);
    };
    for (const { v: dira, m } of hl) {
      const M = dira[m].p, n = poly.length;
      let nejX = Infinity, hrana = -1;
      for (let k = 0; k < n; k++) {
        const a = poly[k].p, b = poly[(k + 1) % n].p;
        if (a[1] === b[1]) continue;
        if ((a[1] - M[1]) * (b[1] - M[1]) > 0) continue;
        const x = a[0] + (M[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1]);
        if (x >= M[0] - 1e-12 && x < nejX) { nejX = x; hrana = k; }
      }
      if (hrana < 0) throw new Error('Otvor leží mimo obrys desky.');
      const a = poly[hrana].p, b = poly[(hrana + 1) % n].p;
      const Pp = a[0] > b[0] ? a : b;
      const Ib = [nejX, M[1]];
      const zasah = [a, b].find(q => Math.abs(q[0] - Ib[0]) < 1e-9 && Math.abs(q[1] - Ib[1]) < 1e-9);
      let cil = zasah || Pp, nejU = Infinity, nejD = Infinity;
      const tri = orient(M, Ib, Pp) >= 0 ? [M, Ib, Pp] : [M, Pp, Ib];
      for (const q of zasah ? [] : poly) {
        if (stejne(q.p, Pp)) continue;
        if (orient(tri[0], tri[1], q.p) >= -eps && orient(tri[1], tri[2], q.p) >= -eps && orient(tri[2], tri[0], q.p) >= -eps) {
          const dx = q.p[0] - M[0], dy = q.p[1] - M[1];
          if (dx <= 0) continue;
          const u = Math.abs(Math.atan2(dy, dx)), d = dx * dx + dy * dy;
          if (u < nejU - 1e-12 || (Math.abs(u - nejU) <= 1e-12 && d < nejD)) { nejU = u; nejD = d; cil = q.p; }
        }
      }
      let k = -1;
      for (let j = 0; j < n; j++) if (stejne(poly[j].p, cil) && vKlinu(j, M)) { k = j; break; }
      if (k < 0) k = poly.findIndex(q => stejne(q.p, cil));
      const vlozit = [];
      for (let j = 0; j <= dira.length; j++) vlozit.push(dira[(m + j) % dira.length]);
      vlozit.push(poly[k]);
      poly = poly.slice(0, k + 1).concat(vlozit, poly.slice(k + 1));
    }

    const out = [];
    let L = poly, k = 0, nouze = 0;
    const vTroj = (q, a, b, c) => orient(a, b, q) >= -eps && orient(b, c, q) >= -eps && orient(c, a, q) >= -eps;
    while (L.length > 3) {
      const n = L.length;
      let nasel = false;
      for (let s = 0; s < n; s++) {
        const j = (k + s) % n;
        const a = L[(j - 1 + n) % n], b = L[j], c = L[(j + 1) % n];
        if (orient(a.p, b.p, c.p) <= eps) continue;
        let ok = true;
        for (const q of L) {
          if (q === a || q === b || q === c) continue;
          if (stejne(q.p, a.p) || stejne(q.p, b.p) || stejne(q.p, c.p)) continue;
          if (vTroj(q.p, a.p, b.p, c.p)) { ok = false; break; }
        }
        if (!ok) continue;
        out.push([a.i, b.i, c.i]);
        L = L.slice(0, j).concat(L.slice(j + 1));
        k = j % L.length;
        nasel = true;
        break;
      }
      if (!nasel) {
        nouze++;
        let nej = 0, nejO = -Infinity;
        for (let j = 0; j < n; j++) {
          const o = orient(L[(j - 1 + n) % n].p, L[j].p, L[(j + 1) % n].p);
          if (o > nejO) { nejO = o; nej = j; }
        }
        out.push([L[(nej - 1 + n) % n].i, L[nej].i, L[(nej + 1) % n].i]);
        L = L.slice(0, nej).concat(L.slice(nej + 1));
      }
    }
    if (L.length === 3) out.push([L[0].i, L[1].i, L[2].i]);
    out.nouze = nouze;
    return out;
  }

  /* ---------------- primitivum 1: deska ----------------
     obrys: [[x, y, zDole, zNahore], ...] (směr libovolný), diry: totéž.
     Boční stěny jsou svislé, horní a dolní plocha triangulované; výška se
     mezi vrcholy mění lineárně. */
  function deska(obrys, diry) {
    diry = diry || [];
    let O = bezDuplicit(obrys, 1e-7);
    if (plocha2(O) < 0) O = O.slice().reverse();
    const D = diry.map(d => { let q = bezDuplicit(d, 1e-7); if (plocha2(q) < 0) q = q.slice().reverse(); return q; });
    const V = [], I = [];
    const smycky = [O, ...D];
    const dole = [], nahore = [];
    let id = 0;
    const id2 = [];
    for (const S of smycky) {
      const ids = [];
      for (const p of S) {
        dole.push(V.length / 3); V.push(p[0], p[1], p[2]);
        nahore.push(V.length / 3); V.push(p[0], p[1], p[3]);
        ids.push(id++);
      }
      id2.push(ids);
    }
    // stěny: vnější obrys proti směru hodin, díry po směru
    smycky.forEach((S, si) => {
      const ids = id2[si], n = S.length, obrat = si > 0;
      for (let i = 0; i < n; i++) {
        let a = ids[i], b = ids[(i + 1) % n];
        if (obrat) { const x = a; a = b; b = x; }
        I.push(dole[a], dole[b], nahore[b], dole[a], nahore[b], nahore[a]);
      }
    });
    const tr = triangulujSDirami({ P: O.map(p => [p[0], p[1]]), I: id2[0] },
      D.map((d, k) => ({ P: d.map(p => [p[0], p[1]]), I: id2[k + 1] })));
    for (const [a, b, c] of tr) {
      I.push(nahore[a], nahore[b], nahore[c]);
      I.push(dole[a], dole[c], dole[b]);
    }
    const t = orientuj({ V, I });
    t.nouze = tr.nouze;
    return t;
  }

  /* ---------------- primitivum 2: tažení ----------------
     stanice: [{P:[x,y,z], U:[3], W:[3], rez:[[u,v], ...]}], všechny průřezy
     mají stejný počet bodů a jdou ve stejném smyslu. Bod průřezu leží
     v P + u·U + v·W. U otevřeného tažení se konce zavřou víčky. */
  function tazeni(stanice, uzavrene) {
    const M = stanice[0].rez.length, N = stanice.length;
    let obrat = plocha2(stanice[0].rez) < 0;
    const V = [], I = [];
    for (const s of stanice) {
      const R = obrat ? s.rez.slice().reverse() : s.rez;
      for (const [u, v] of R) V.push(s.P[0] + u * s.U[0] + v * s.W[0], s.P[1] + u * s.U[1] + v * s.W[1], s.P[2] + u * s.U[2] + v * s.W[2]);
    }
    const kroku = uzavrene ? N : N - 1;
    for (let k = 0; k < kroku; k++) {
      const a0 = k * M, b0 = ((k + 1) % N) * M;
      for (let i = 0; i < M; i++) {
        const j = (i + 1) % M;
        I.push(a0 + i, a0 + j, b0 + j, a0 + i, b0 + j, b0 + i);
      }
    }
    let nouze = 0;
    if (!uzavrene) {
      const vicko = (k, obratit) => {
        const R = obrat ? stanice[k].rez.slice().reverse() : stanice[k].rez;
        const ids = R.map((_, i) => i);
        const tr = triangulujSDirami({ P: R.map(p => [p[0], p[1]]), I: ids }, []);
        nouze += tr.nouze;
        for (const [a, b, c] of tr) {
          if (obratit) I.push(k * M + a, k * M + c, k * M + b);
          else I.push(k * M + a, k * M + b, k * M + c);
        }
      };
      vicko(0, true);
      vicko(N - 1, false);
    }
    const t = orientuj({ V, I });
    t.nouze = nouze;
    return t;
  }

  /* ---------------- primitivum 3: rotační těleso ----------------
     profil: [[r, z], ...] od osy dole k ose nahoře (první a poslední bod
     mají r = 0). Osa jde bodem (cx, cy) rovnoběžně se z. */
  function rotace(profil, n, cx, cy) {
    const V = [], I = [];
    const vnitrni = profil.slice(1, -1);
    const dno = 0;
    V.push(cx, cy, profil[0][1]);
    for (const [r, z] of vnitrni) {
      for (let k = 0; k < n; k++) {
        const a = 2 * Math.PI * k / n;
        V.push(cx + r * Math.cos(a), cy + r * Math.sin(a), z);
      }
    }
    const vrch = V.length / 3;
    V.push(cx, cy, profil[profil.length - 1][1]);
    const kruh = (j, k) => 1 + j * n + (k % n);
    for (let k = 0; k < n; k++) I.push(dno, kruh(0, k + 1), kruh(0, k));
    for (let j = 0; j + 1 < vnitrni.length; j++)
      for (let k = 0; k < n; k++) I.push(kruh(j, k), kruh(j, k + 1), kruh(j + 1, k + 1), kruh(j, k), kruh(j + 1, k + 1), kruh(j + 1, k));
    const j = vnitrni.length - 1;
    for (let k = 0; k < n; k++) I.push(vrch, kruh(j, k), kruh(j, k + 1));
    return orientuj({ V, I });
  }

  /* ---------------- průřezy ----------------
     Obdélník u0..u1 × v0..v1 proti směru hodin, se zaoblenými rohy r
     (k bodů na roh; r = 0 → ostré rohy, jeden bod na roh). */
  function obdelnik(u0, u1, v0, v1, r, k) {
    if (!(r > 0) || k < 2 || !(u1 > u0) || !(v1 > v0)) return [[u1, v0], [u1, v1], [u0, v1], [u0, v0]];
    r = Math.min(r, (u1 - u0) * 0.45, (v1 - v0) * 0.45);
    const out = [];
    const roh = (cu, cv, a0) => {
      for (let i = 0; i < k; i++) {
        const a = a0 + (Math.PI / 2) * i / (k - 1);
        out.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]);
      }
    };
    roh(u1 - r, v0 + r, -Math.PI / 2);
    roh(u1 - r, v1 - r, 0);
    roh(u0 + r, v1 - r, Math.PI / 2);
    roh(u0 + r, v0 + r, Math.PI);
    return out;
  }

  function elipsa(cu, cv, ru, rv, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + 2 * Math.PI * i / n;
      out.push([cu + ru * Math.cos(a), cv + rv * Math.sin(a)]);
    }
    return out;
  }

  /* ---------------- křivky v rovině ----------------
     Hermitův spline přes body (Catmull–Rom uvnitř, na koncích zadané
     směry). Vrací hustou lomenou čáru s délkou oblouku. */
  function krivka(body, smerZac, smerKon, krok) {
    krok = Math.max(krok || 0.5, 1e-3);
    const n = body.length, tec = [];
    const del = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let i = 0; i < n; i++) {
      let t;
      if (i === 0 && smerZac) t = smerZac;
      else if (i === n - 1 && smerKon) t = smerKon;
      else {
        const a = body[Math.max(0, i - 1)], b = body[Math.min(n - 1, i + 1)];
        t = [b[0] - a[0], b[1] - a[1]];
      }
      const l = Math.hypot(t[0], t[1]) || 1;
      tec.push([t[0] / l, t[1] / l]);
    }
    const out = [body[0].slice()];
    for (let i = 0; i + 1 < n; i++) {
      const a = body[i], b = body[i + 1], L = del(a, b);
      const m0 = [tec[i][0] * L, tec[i][1] * L], m1 = [tec[i + 1][0] * L, tec[i + 1][1] * L];
      const k = Math.max(2, Math.ceil(L / krok));
      for (let j = 1; j <= k; j++) {
        const t = j / k, t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        out.push([h00 * a[0] + h10 * m0[0] + h01 * b[0] + h11 * m1[0], h00 * a[1] + h10 * m0[1] + h01 * b[1] + h11 * m1[1]]);
      }
    }
    return prevzorkuj(out, krok);
  }

  // rovnoměrné převzorkování lomené čáry (zachová koncové body)
  function prevzorkuj(P, krok) {
    krok = Math.max(krok, 1e-3);
    const s = [0];
    for (let i = 1; i < P.length; i++) s.push(s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = s[s.length - 1], n = Math.max(2, Math.ceil(L / krok));
    const out = [];
    let j = 0;
    for (let k = 0; k <= n; k++) {
      const c = L * k / n;
      while (j < P.length - 2 && s[j + 1] < c) j++;
      const t = s[j + 1] > s[j] ? (c - s[j]) / (s[j + 1] - s[j]) : 0;
      out.push([lerp(P[j][0], P[j + 1][0], t), lerp(P[j][1], P[j + 1][1], t)]);
    }
    return out;
  }

  // tečny, levé normály a délka oblouku lomené čáry
  function ramce(P) {
    const n = P.length, T = [], N = [], S = [0];
    for (let i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      T.push([dx / l, dy / l]); N.push([-dy / l, dx / l]);
    }
    return { T, N, S, L: S[n - 1] };
  }

  /* Stanice tažení po rovinné lomené čáře s obdélníkovým průřezem.
     fn(i, s) → {u0, u1, v0, v1} (u kolmo ke křivce v rovině xy, v = z). */
  function pasPoKrivce(P, fn, r, k) {
    const R = ramce(P), out = [];
    for (let i = 0; i < P.length; i++) {
      const q = fn(i, R.S[i], R);
      out.push({ P: [P[i][0], P[i][1], 0], U: [R.N[i][0], R.N[i][1], 0], W: [0, 0, 1], rez: q.rez || obdelnik(q.u0, q.u1, q.v0, q.v1, r, k) });
    }
    return out;
  }

  /* Přeloží se tažení? Krajní body průřezu musí mezi sousedními stanicemi
     postupovat po směru tečny (jinak je ohyb ostřejší než tloušťka). */
  function prelozene(st) {
    for (let i = 0; i + 1 < st.length; i++) {
      const a = st[i], b = st[i + 1];
      const T = [b.P[0] - a.P[0], b.P[1] - a.P[1], b.P[2] - a.P[2]];
      for (let k = 0; k < a.rez.length; k++) {
        const ua = a.rez[k], ub = b.rez[k];
        const pa = [a.P[0] + ua[0] * a.U[0], a.P[1] + ua[0] * a.U[1]], pb = [b.P[0] + ub[0] * b.U[0], b.P[1] + ub[0] * b.U[1]];
        if ((pb[0] - pa[0]) * T[0] + (pb[1] - pa[1]) * T[1] < 0) return true;
      }
    }
    return false;
  }

  /* Nejmenší poloměr křivosti lomené čáry (z trojic bodů). */
  function minPolomer(P, od, do_) {
    let m = Infinity;
    for (let i = Math.max(1, od || 1); i + 1 < Math.min(P.length, do_ || P.length); i++) {
      const a = P[i - 1], b = P[i], c = P[i + 1];
      const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ac = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const cr = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
      if (cr > 1e-12 && ab > 1e-6 && bc > 1e-6) m = Math.min(m, ab * bc * ac / (2 * cr));
    }
    return m;
  }

  /* ---------------- vzdálenosti v rovině (vůle mezi díly) ---------------- */
  function vzdUsecek(a, b, c, d) {
    // nejmenší vzdálenost úseček ab a cd (při protnutí 0)
    const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
    const bodUs = (p, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
      const t = l ? omez(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l, 0, 1) : 0;
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    };
    return Math.min(bodUs(a, c, d), bodUs(b, c, d), bodUs(c, a, b), bodUs(d, a, b));
  }
  function uvnitr2(p, P) {
    let v = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < (P[j][0] - P[i][0]) * (p[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) v = !v;
    }
    return v;
  }
  function obal2(P) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const p of P) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; }
    return [a, b, c, d];
  }
  function vzdPolygonu(A, B, bA, bB, limit) {
    bA = bA || obal2(A); bB = bB || obal2(B);
    if (bA[0] - limit > bB[2] || bB[0] - limit > bA[2] || bA[1] - limit > bB[3] || bB[1] - limit > bA[3]) return Infinity;
    if (uvnitr2(A[0], B) || uvnitr2(B[0], A)) return 0;
    let m = Infinity;
    for (let i = 0; i < A.length; i++) {
      const a = A[i], b = A[(i + 1) % A.length];
      for (let j = 0; j < B.length; j++) {
        const d = vzdUsecek(a, b, B[j], B[(j + 1) % B.length]);
        if (d < m) { m = d; if (m === 0) return 0; }
      }
    }
    return m;
  }

  /* Je uzavřený obrys jednoduchý (žádné dvě nesousední hrany se nedotknou)? */
  function jednoduchy(P, tol) {
    tol = tol || 1e-7;
    const n = P.length, b = [];
    for (let i = 0; i < n; i++) {
      const a = P[i], c = P[(i + 1) % n];
      b.push([Math.min(a[0], c[0]) - tol, Math.min(a[1], c[1]) - tol, Math.max(a[0], c[0]) + tol, Math.max(a[1], c[1]) + tol]);
    }
    const poradi = b.map((q, i) => i).sort((x, y) => b[x][0] - b[y][0]);
    for (let k = 0; k < n; k++) {
      const i = poradi[k];
      for (let m = k + 1; m < n; m++) {
        const j = poradi[m];
        if (b[j][0] > b[i][2]) break;
        if (b[j][1] > b[i][3] || b[i][1] > b[j][3]) continue;
        if (Math.abs(i - j) <= 1 || Math.abs(i - j) === n - 1) continue;
        if (vzdUsecek(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n]) <= tol) return false;
      }
    }
    return true;
  }

  /* Půdorysy úseků tažení (čtyřúhelník mezi stanicemi i a i+1). */
  function stopyPasu(st) {
    const out = [];
    for (let i = 0; i + 1 < st.length; i++) {
      const a = st[i], b = st[i + 1];
      const ua = a.rez.map(q => q[0]), ub = b.rez.map(q => q[0]);
      const a0 = Math.min(...ua), a1 = Math.max(...ua), b0 = Math.min(...ub), b1 = Math.max(...ub);
      const P = [
        [a.P[0] + a0 * a.U[0], a.P[1] + a0 * a.U[1]], [b.P[0] + b0 * b.U[0], b.P[1] + b0 * b.U[1]],
        [b.P[0] + b1 * b.U[0], b.P[1] + b1 * b.U[1]], [a.P[0] + a1 * a.U[0], a.P[1] + a1 * a.U[1]]];
      out.push({ P, b: obal2(P) });
    }
    return out;
  }
  // kruh jako mnohoúhelník (o něco větší, aby tětivy neubraly vůli)
  function stopaKruhu(c, r, n) {
    n = n || 32;
    const k = r / Math.cos(Math.PI / n), P = [];
    for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; P.push([c[0] + k * Math.cos(a), c[1] + k * Math.sin(a)]); }
    return { P, b: obal2(P) };
  }

  /* Které úseky pásu se v půdorysu přiblíží k cizím stopám na méně než
     vule. stopyPro(k) → [stopy pásu, cizí stopy] pro k-tý vzorek pohybu. */
  function prekryvPasu(pocetUseku, vzorku, stopyPro, vule) {
    const out = new Uint8Array(pocetUseku);
    for (let k = 0; k < vzorku; k++) {
      const [moje, cizi] = stopyPro(k);
      for (let i = 0; i < moje.length; i++) {
        if (out[i]) continue;
        for (const c of cizi) {
          if (vzdPolygonu(moje[i].P, c.P, moje[i].b, c.b, vule) < vule) { out[i] = 1; break; }
        }
      }
    }
    return out;
  }

  /* Z příznaků překryvu úseků (pocet = stanic − 1) podíl „půlení“ výšky
     v každé stanici: 1 v překryvu, lineární náběh na délce nabeh. */
  function podilPulky(S, priznaky, nabeh) {
    const n = S.length, lam = new Float64Array(n);
    const oznac = [];
    for (let i = 0; i < priznaky.length; i++) if (priznaky[i]) oznac.push(i);
    if (!oznac.length) return lam;
    for (let j = 0; j < n; j++) {
      let d = Infinity;
      for (const i of oznac) {
        const s0 = S[i], s1 = S[i + 1], s = S[j];
        const dd = s < s0 ? s0 - s : s > s1 ? s - s1 : 0;
        if (dd < d) d = dd;
      }
      lam[j] = d <= 0 ? 1 : nabeh > 0 ? omez(1 - d / nabeh, 0, 1) : 0;
    }
    return lam;
  }

  /* ---------------- export ---------------- */
  function stlBinarni(telesa) {
    let n = 0;
    for (const t of telesa) n += t.I.length / 3;
    const buf = new ArrayBuffer(84 + 50 * n), dv = new DataView(buf);
    const hlav = 'Klieste/pinzety - webapp';
    for (let i = 0; i < hlav.length; i++) dv.setUint8(i, hlav.charCodeAt(i));
    dv.setUint32(80, n, true);
    let o = 84;
    for (const t of telesa) {
      const V = t.V, I = t.I;
      for (let f = 0; f < I.length; f += 3) {
        const a = I[f] * 3, b = I[f + 1] * 3, c = I[f + 2] * 3;
        const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
        const vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1;
        dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
        o += 12;
        for (const q of [a, b, c]) {
          dv.setFloat32(o, V[q], true); dv.setFloat32(o + 4, V[q + 1], true); dv.setFloat32(o + 8, V[q + 2], true);
          o += 12;
        }
        o += 2;
      }
    }
    return new Uint8Array(buf);
  }

  /* Minimální ZIP (metoda „uloženo“, volitelně předem zabalený deflate). */
  function zip(soubory) {
    const crcTab = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTab[n] = c >>> 0; }
    const crc = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = crcTab[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const enc = new TextEncoder(), casti = [], centr = [];
    let ofs = 0;
    for (const s of soubory) {
      const jm = enc.encode(s.jmeno), c = crc(s.data), n = s.data.length;
      const telo = s.deflate || s.data, metoda = s.deflate ? 8 : 0;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, metoda, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
      h.setUint32(14, c, true); h.setUint32(18, telo.length, true); h.setUint32(22, n, true); h.setUint16(26, jm.length, true);
      casti.push(new Uint8Array(h.buffer), jm, telo);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, metoda, true);
      cd.setUint16(14, 0x21, true); cd.setUint32(16, c, true); cd.setUint32(20, telo.length, true); cd.setUint32(24, n, true);
      cd.setUint16(28, jm.length, true); cd.setUint32(42, ofs, true);
      centr.push(new Uint8Array(cd.buffer), jm);
      ofs += 30 + jm.length + telo.length;
    }
    const velCentr = centr.reduce((a, b) => a + b.length, 0);
    const k = new DataView(new ArrayBuffer(22));
    k.setUint32(0, 0x06054b50, true); k.setUint16(8, soubory.length, true); k.setUint16(10, soubory.length, true);
    k.setUint32(12, velCentr, true); k.setUint32(16, ofs, true);
    const vse = [...casti, ...centr, new Uint8Array(k.buffer)];
    const out = new Uint8Array(vse.reduce((a, b) => a + b.length, 0));
    let o = 0;
    for (const b of vse) { out.set(b, o); o += b.length; }
    return out;
  }

  /* 3MF: každý díl je samostatná část (component) jednoho objektu — díly
     tak zůstanou v sestavě na svých místech (tisk najednou) a v PrusaSliceru
     jde dílu z TPU přiřadit jiný filament. casti: [{nazev, telesa}] */
  function soubory3MF(casti, nazev) {
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const objekty = [];
    let id = 1;
    for (const c of casti) {
      const s = sluc(c.telesa);
      if (!s.I.length) continue;
      if (!s.V.every(Number.isFinite)) throw new Error('Model obsahuje neplatné souřadnice (' + c.nazev + ').');
      const vv = [], tt = [];
      for (let i = 0; i < s.V.length; i += 3) vv.push(`<vertex x="${+s.V[i].toFixed(4)}" y="${+s.V[i + 1].toFixed(4)}" z="${+s.V[i + 2].toFixed(4)}"/>`);
      for (let f = 0; f < s.I.length; f += 3) tt.push(`<triangle v1="${s.I[f]}" v2="${s.I[f + 1]}" v3="${s.I[f + 2]}"/>`);
      objekty.push({ id, xml: `<object id="${id}" type="model" name="${esc(c.nazev)}"><mesh><vertices>${vv.join('')}</vertices><triangles>${tt.join('')}</triangles></mesh></object>` });
      id++;
    }
    if (!objekty.length) throw new Error('Model je prázdný.');
    const slozeny = id;
    const model = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<model unit="millimeter" xml:lang="cs-CZ" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
      + `<metadata name="Title">${esc(nazev)}</metadata><metadata name="Application">Kleště, pinzety a svorky</metadata><resources>`
      + objekty.map(o => o.xml).join('')
      + `<object id="${slozeny}" type="model" name="${esc(nazev)}"><components>`
      + objekty.map(o => `<component objectid="${o.id}"/>`).join('')
      + `</components></object></resources><build><item objectid="${slozeny}"/></build></model>`;
    const enc = new TextEncoder();
    return [
      { jmeno: '[Content_Types].xml', data: enc.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>') },
      { jmeno: '_rels/.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>') },
      { jmeno: '3D/3dmodel.model', data: enc.encode(model) }
    ];
  }

  /* Normály pro zobrazení: ostrá hrana nad `uhel` stupňů, jinak průměr. */
  function zalomeneNormaly(V, I, uhel) {
    const F = I.length / 3, prah = Math.cos((uhel || 35) * Math.PI / 180);
    const fn = new Float64Array(F * 3), fu = new Float64Array(F * 3);
    for (let f = 0; f < F; f++) {
      const a = I[3 * f] * 3, b = I[3 * f + 1] * 3, c = I[3 * f + 2] * 3;
      const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
      const vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      fn[3 * f] = nx; fn[3 * f + 1] = ny; fn[3 * f + 2] = nz;
      if (l > 1e-12) { fu[3 * f] = nx / l; fu[3 * f + 1] = ny / l; fu[3 * f + 2] = nz / l; }
    }
    const nV = V.length / 3, pocet = new Int32Array(nV + 1);
    for (let i = 0; i < I.length; i++) pocet[I[i] + 1]++;
    for (let i = 0; i < nV; i++) pocet[i + 1] += pocet[i];
    const plneni = pocet.slice(), sousede = new Int32Array(I.length);
    for (let i = 0; i < I.length; i++) sousede[plneni[I[i]]++] = (i / 3) | 0;
    const pos = new Float32Array(F * 9), nor = new Float32Array(F * 9);
    for (let f = 0; f < F; f++) {
      for (let k = 0; k < 3; k++) {
        const v = I[3 * f + k], o = 9 * f + 3 * k;
        pos[o] = V[3 * v]; pos[o + 1] = V[3 * v + 1]; pos[o + 2] = V[3 * v + 2];
        let sx = 0, sy = 0, sz = 0;
        for (let j = pocet[v]; j < pocet[v + 1]; j++) {
          const g = sousede[j];
          if (fu[3 * f] * fu[3 * g] + fu[3 * f + 1] * fu[3 * g + 1] + fu[3 * f + 2] * fu[3 * g + 2] >= prah) {
            sx += fn[3 * g]; sy += fn[3 * g + 1]; sz += fn[3 * g + 2];
          }
        }
        const l = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
        nor[o] = sx / l; nor[o + 1] = sy / l; nor[o + 2] = sz / l;
      }
    }
    return { pos, nor };
  }

  /* ---------------- průřez ramen (Bézierovy křivky) ----------------
     Průřez je uzavřená křivka v normované ploše x ∈ ⟨−0,5; 0,5⟩ (tloušťka
     ramene v rovině nástroje, +x = vnější strana), y ∈ ⟨0; 1⟩ (šířka = výška
     při tisku, 0 = podložka). Kotva: {p:[x,y], a:[dx,dy] úchyt dovnitř,
     b:[dx,dy] úchyt ven, hladky}. Souměrný průřez (sym) ukládá jen pravou
     polovinu od spodní kotvy na ose po horní kotvu na ose. */
  const K = 0.5523;
  const kotva = (x, y, ax, ay, bx, by, hladky) => ({ p: [x, y], a: [ax || 0, ay || 0], b: [bx || 0, by || 0], hladky: !!hladky });
  const PRUREZY = {
    obdelnik: { nazev: 'Obdélník', sym: true, kotvy: [kotva(0, 0), kotva(0.5, 0), kotva(0.5, 1), kotva(0, 1)] },
    zaobleny: { nazev: 'Zaoblený obdélník', sym: true, kotvy: [kotva(0, 0), kotva(0.28, 0, 0, 0, 0.22 * K, 0), kotva(0.5, 0.14, 0, -0.14 * K), kotva(0.5, 0.86, 0, 0, 0, 0.14 * K), kotva(0.28, 1, 0.22 * K, 0), kotva(0, 1)] },
    oval: { nazev: 'Ovál', sym: true, kotvy: [kotva(0, 0, 0, 0, 0.5 * K, 0, true), kotva(0.5, 0.5, 0, -0.5 * K, 0, 0.5 * K, true), kotva(0, 1, 0.5 * K, 0, 0, 0, true)] },
    d: { nazev: 'D – rovné dno, oblý hřbet', sym: true, kotvy: [kotva(0, 0), kotva(0.5, 0), kotva(0.5, 0.45, 0, 0, 0, 0.55 * K, false), kotva(0, 1, 0.5 * K, 0, 0, 0, true)] },
    kapka: { nazev: 'Kapka (tisk bez podpěr)', sym: true, kotvy: [kotva(0, 0), kotva(0.42, 0, 0, 0, 0.06, 0), kotva(0.5, 0.3, 0, -0.14, 0, 0.16, true), kotva(0, 1, 0.22, -0.32, 0, 0)] },
    sestiuhelnik: { nazev: 'Šestiúhelník', sym: true, kotvy: [kotva(0, 0), kotva(0.25, 0), kotva(0.5, 0.5), kotva(0.25, 1), kotva(0, 1)] },
    i: { nazev: 'I-profil (lehký a tuhý)', sym: true, kotvy: [kotva(0, 0), kotva(0.5, 0), kotva(0.5, 0.18), kotva(0.16, 0.24, 0.12, -0.04, 0, 0), kotva(0.16, 0.76, 0, 0, 0.12, 0.04), kotva(0.5, 0.82), kotva(0.5, 1), kotva(0, 1)] },
    klin: { nazev: 'Klín', sym: true, kotvy: [kotva(0, 0), kotva(0.5, 0), kotva(0.12, 1), kotva(0, 1)] },
    zlab: { nazev: 'Žlábek z vnější strany', sym: false, kotvy: [kotva(-0.5, 0), kotva(0.5, 0), kotva(0.5, 0.3), kotva(0.12, 0.42, 0, -0.08, 0, 0.1, true), kotva(0.12, 0.58, 0, -0.1, 0, 0.08, true), kotva(0.5, 0.7), kotva(0.5, 1), kotva(-0.5, 1)] }
  };

  const zrc = v => [-v[0], v[1]];
  /* Celá smyčka kotev proti směru hodin (souměrný → doplní levou polovinu). */
  function rozvinPrurez(pr) {
    const k = pr.kotvy.map(q => ({ p: q.p.slice(), a: q.a.slice(), b: q.b.slice(), hladky: q.hladky }));
    if (!pr.sym) return k;
    const n = k.length, out = [];
    // spodní kotva na ose: úchyt dovnitř = zrcadlo úchytu ven; horní obráceně
    out.push({ p: [0, k[0].p[1]], a: zrc(k[0].b), b: k[0].b, hladky: k[0].hladky });
    for (let i = 1; i < n - 1; i++) out.push(k[i]);
    out.push({ p: [0, k[n - 1].p[1]], a: k[n - 1].a, b: zrc(k[n - 1].a), hladky: k[n - 1].hladky });
    for (let i = n - 2; i >= 1; i--) out.push({ p: zrc(k[i].p), a: zrc(k[i].b), b: zrc(k[i].a), hladky: k[i].hladky });
    return out;
  }

  const bez = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
  };
  function useky(kotvy) {
    const n = kotvy.length, out = [];
    for (let i = 0; i < n; i++) {
      const A = kotvy[i], B = kotvy[(i + 1) % n];
      out.push([A.p, [A.p[0] + A.b[0], A.p[1] + A.b[1]], [B.p[0] + B.a[0], B.p[1] + B.a[1]], B.p]);
    }
    return out;
  }

  /* Navzorkuje průřez do N bodů (kotvy jsou vždy body – ostré rohy zůstanou),
     roztáhne ho na celou normovanou plochu. Vrací {body, rovneDno} nebo null,
     když se obrys kříží. */
  const pametPrurezu = new Map();
  function vzorkujPrurez(pr, N) {
    N = N || 56;
    const klic = JSON.stringify([pr, N]);
    if (pametPrurezu.has(klic)) return pametPrurezu.get(klic);
    const U = useky(rozvinPrurez(pr));
    const delky = U.map(u => { let L = 0, q = u[0]; for (let k = 1; k <= 24; k++) { const r = bez(u[0], u[1], u[2], u[3], k / 24); L += Math.hypot(r[0] - q[0], r[1] - q[1]); q = r; } return L; });
    const celk = delky.reduce((a, b) => a + b, 0) || 1;
    // přímé úseky (bez úchytů) stačí koncovými body
    const prime = U.map(u => Math.hypot(u[1][0] - u[0][0], u[1][1] - u[0][1]) < 1e-9 && Math.hypot(u[2][0] - u[3][0], u[2][1] - u[3][1]) < 1e-9);
    const krivych = U.filter((u, i) => !prime[i]);
    let zbyva = N - U.length;
    const pocty = U.map((u, i) => prime[i] ? 1 : 0);
    const delKr = U.reduce((a, u, i) => a + (prime[i] ? 0 : delky[i]), 0);
    if (krivych.length) {
      U.forEach((u, i) => { if (!prime[i]) { const k = Math.max(1, Math.round(zbyva * delky[i] / delKr)); pocty[i] = 1 + k; } });
    }
    let P = [];
    U.forEach((u, i) => { for (let k = 0; k < pocty[i]; k++) P.push(bez(u[0], u[1], u[2], u[3], k / pocty[i])); });
    P = bezDuplicit(P, 1e-6);
    if (P.length < 3 || !jednoduchy(P, 1e-7)) { pametPrurezu.set(klic, null); return null; }
    if (plocha2(P) < 0) P.reverse();
    const b = obal2(P), sx = b[2] - b[0], sy = b[3] - b[1];
    if (sx < 1e-6 || sy < 1e-6) { pametPrurezu.set(klic, null); return null; }
    P = P.map(q => [(q[0] - b[0]) / sx - 0.5, (q[1] - b[1]) / sy]);
    // šířka rovného dna (tisk bez podpěr)
    let d0 = Infinity, d1 = -Infinity;
    for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; if (a[1] < 0.004 && c[1] < 0.004) { d0 = Math.min(d0, a[0], c[0]); d1 = Math.max(d1, a[0], c[0]); } }
    // protějšky na obdélníku pro plynulé prolnutí do čelisti: stejný poměr
    // délky obvodu od bodu nejblíž středu dna (pořadí bodů se tím zachová)
    let i0 = 0;
    P.forEach((q, i) => { if (q[1] + Math.abs(q[0]) < P[i0][1] + Math.abs(P[i0][0])) i0 = i; });
    P = P.slice(i0).concat(P.slice(0, i0));
    const L = [0];
    for (let i = 1; i <= P.length; i++) { const a = P[i - 1], c = P[i % P.length]; L.push(L[i - 1] + Math.hypot(c[0] - a[0], c[1] - a[1])); }
    const obd = P.map((q, i) => {
      let t = 4 * L[i] / L[P.length] + Math.abs(P[0][0]) * Math.sign(P[0][0]);   // obvod obdélníku = 4
      t = ((t % 4) + 4) % 4;
      if (t < 0.5) return [t, 0];
      if (t < 1.5) return [0.5, t - 0.5];
      if (t < 2.5) return [0.5 - (t - 1.5), 1];
      if (t < 3.5) return [-0.5, 1 - (t - 2.5)];
      return [-0.5 + (t - 3.5), 0];
    });
    const r = { body: P, obd, rovneDno: d1 > d0 ? d1 - d0 : 0 };
    pametPrurezu.set(klic, r);
    if (pametPrurezu.size > 30) pametPrurezu.delete(pametPrurezu.keys().next().value);
    return r;
  }

  /* Body průřezu ramene: normovaný tvar do u0..u1 × v0..v1; ven = ±1 je
     směr vnější strany (+x tvaru), vroubek = o kolik se vnější strana vyboulí. */
  function rezRamene(tvar, u0, u1, v0, v1, ven, vroubek, k) {
    const uc = (u0 + u1) / 2, t = u1 - u0, h = v1 - v0;
    // k ∈ ⟨0; 1⟩: plynulé prolnutí do obdélníku (napojení na čelist) –
    // každý bod se posune po paprsku ze středu na obvod obdélníku
    const body = !(k > 0) ? tvar.body : tvar.body.map(([x, y], i) => [x + (tvar.obd[i][0] - x) * k, y + (tvar.obd[i][1] - y) * k]);
    return body.map(([x, y]) => {
      const xx = ven * x;
      return [uc + xx * t + (vroubek && x > 0 ? ven * vroubek * 2 * x : 0), v0 + y * h];
    });
  }

  const KJ = {
    lerp, omez, hladce, troj, zlomek, rad, otoc2, otocV2,
    objem, orientuj, kontrola, transformuj, otocTeleso, zrcadliY, posun, obal, sluc,
    plocha2, bezDuplicit, triangulujSDirami,
    deska, tazeni, rotace, obdelnik, elipsa,
    krivka, prevzorkuj, ramce, pasPoKrivce,
    vzdUsecek, uvnitr2, vzdPolygonu, jednoduchy, prelozene, minPolomer, stopyPasu, stopaKruhu, prekryvPasu, podilPulky,
    stlBinarni, zip, soubory3MF, zalomeneNormaly,
    PRUREZY, kotva, rozvinPrurez, vzorkujPrurez, rezRamene, useky, bez
  };
  koren.KJ = KJ;
  if (typeof module !== 'undefined' && module.exports) module.exports = KJ;
})(typeof window !== 'undefined' ? window : globalThis);
