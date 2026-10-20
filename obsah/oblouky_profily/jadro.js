/* ============================================================
   Šablony oblouků a profilů – jádro (bez DOM, čisté funkce)
   Jednotky mm, úhly v radiánech (není-li řečeno jinak), y nahoru.
   Export: window.OBL i module.exports
   ============================================================ */
(function (koren) {
  'use strict';
  const PI = Math.PI;
  const r2 = (x) => Math.round(x * 100) / 100;
  const cislo = (v, vych) => { const x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : vych; };
  const deg = (u) => u * 180 / PI, rad = (u) => u * PI / 180;
  const vzd = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

  /* ---------------- kružnice a oblouky ---------------- */
  /** kružnice třemi body → {cx, cy, r} nebo null (body v přímce) */
  function kruzniceZTriBodu(A, B, C) {
    const ax = A[0], ay = A[1], bx = B[0], by = B[1], cx = C[0], cy = C[1];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const meritko = Math.max(vzd(A, B), vzd(B, C), vzd(A, C), 1e-9);
    if (Math.abs(d) < 1e-9 * meritko * meritko) return null;
    const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
    const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
    const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    return { cx: ux, cy: uy, r: Math.hypot(ax - ux, ay - uy) };
  }
  const norm2pi = (u) => { u %= 2 * PI; return u < 0 ? u + 2 * PI : u; };

  /** oblouk z bodu A přes B do C → {cx, cy, r, u0, sweep (± rad, kladně = proti směru hod.), delka, tetiva, vzepeti, uhel} */
  function obloukZTriBodu(A, B, C) {
    const k = kruzniceZTriBodu(A, B, C);
    if (!k) return null;
    const ua = Math.atan2(A[1] - k.cy, A[0] - k.cx), ub = Math.atan2(B[1] - k.cy, B[0] - k.cx), uc = Math.atan2(C[1] - k.cy, C[0] - k.cx);
    let sweep = norm2pi(uc - ua);
    const db = norm2pi(ub - ua);
    if (db > sweep) sweep -= 2 * PI;           // B neleží na kladném oblouku → jde se po směru hodin
    const um = ua + sweep / 2, M = [k.cx + k.r * Math.cos(um), k.cy + k.r * Math.sin(um)];
    const tet = vzd(A, C);
    // vzepětí = vzdálenost středu oblouku od tětivy
    const vz = tet > 1e-9 ? Math.abs((C[0] - A[0]) * (A[1] - M[1]) - (A[0] - M[0]) * (C[1] - A[1])) / tet : 0;
    return { cx: k.cx, cy: k.cy, r: k.r, u0: ua, sweep, uhel: Math.abs(sweep), delka: k.r * Math.abs(sweep), tetiva: tet, vzepeti: vz, stredOblouku: M };
  }

  /** tětiva c a vzepětí h → {r, uhel (středový), delka, stredY (y středu, tětiva na y=0, vrchol na y=h)} */
  function tetivaVzepeti(c, h) {
    c = Math.abs(c); h = Math.abs(h);
    if (!(c > 0) || !(h > 0)) return null;
    const r = (c * c / 4 + h * h) / (2 * h), uhel = 4 * Math.atan(2 * h / c);
    return { r, uhel, delka: r * uhel, stredY: h - r, polovicni: h > c / 2 };
  }
  /** poloměr a tětiva → vzepětí (velky = oblouk větší než půlkruh) */
  function vzepetiZPolomeru(c, r, velky) {
    if (!(r >= c / 2)) return null;
    const s = Math.sqrt(Math.max(0, r * r - c * c / 4));
    return velky ? r + s : r - s;
  }
  /** výška oblouku (tětiva na y=0, střed tětivy v x=0) ve vzdálenosti x od středu */
  function vyskaOblouku(c, h, x) {
    const o = tetivaVzepeti(c, h); if (!o || Math.abs(x) > o.r) return null;
    return o.stredY + Math.sqrt(o.r * o.r - x * x);
  }
  /** body oblouku se středem (cx, cy) od u0 o sweep; krok = max. délka úseku (mm) */
  function bodyOblouku(cx, cy, r, u0, sweep, krok) {
    const n = Math.max(4, Math.min(4000, Math.ceil(Math.abs(sweep) * r / (krok || 1.5))));
    const out = [];
    for (let i = 0; i <= n; i++) { const u = u0 + sweep * i / n; out.push([cx + r * Math.cos(u), cy + r * Math.sin(u)]); }
    return out;
  }

  /* ---------------- segmentový oblouk (prstenec / oblouk z dílů) ---------------- */
  /**
   * R = vnější poloměr hotového oblouku, w = šířka (radiálně), n = počet segmentů, uhel = celkový úhel (°), prorez = šířka řezu.
   * Segment je lichoběžník: vnější hrana tečná k vnější kružnici, vnitřní hrana tak, aby vnitřní kružnice ležela celá v materiálu.
   */
  function segmentovyOblouk(R, w, n, uhel, prorez) {
    n = Math.max(2, Math.round(n)); const Th = rad(Math.max(10, Math.min(360, uhel)));
    const r = Math.max(0, R - w), phi = Th / (2 * n);
    const vnejsi = 2 * R * Math.tan(phi), vnitrni = 2 * r * Math.sin(phi), sirkaPrkna = R - r * Math.cos(phi);
    const segmenty = [];
    for (let i = 0; i < n; i++) {
      const us = PI / 2 + Th / 2 - (i + 0.5) * 2 * phi;           // osa segmentu (oblouk symetrický kolem osy y)
      const a = us - phi, b = us + phi, Ro = R / Math.cos(phi), dIn = r * Math.cos(phi), Ri = dIn / Math.cos(phi);
      segmenty.push({ osa: us, body: [[Ri * Math.cos(a), Ri * Math.sin(a)], [Ro * Math.cos(a), Ro * Math.sin(a)], [Ro * Math.cos(b), Ro * Math.sin(b)], [Ri * Math.cos(b), Ri * Math.sin(b)]] });
    }
    const pr = Math.max(0, prorez || 0);
    // segmenty se řežou střídavě otočené z jednoho pásu: na kus připadá průměr hran + prořez
    const delkaPasu = n * ((vnejsi + vnitrni) / 2 + pr) + (vnejsi - vnitrni) / 2;
    return { R, r, w, n, phi, pokos: deg(phi), vnejsi, vnitrni, sirkaPrkna, segmenty, delkaPasu, uhel: deg(Th), mezera: R / Math.cos(phi) - R };
  }

  /* ---------------- elipsa ---------------- */
  function elipsa(a, b) {
    const A = Math.max(a, b), B = Math.min(a, b), c = Math.sqrt(Math.max(0, A * A - B * B)), h = Math.pow((A - B) / (A + B), 2);
    return {
      a: A, b: B, c, svisla: b > a, excentricita: c / A,
      provazekSmycka: 2 * A + 2 * c,            // uzavřená smyčka kolem obou hřebíků a tužky
      provazekOtevreny: 2 * A,                   // konce uvázané na hřebících
      obvod: PI * (A + B) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h))),   // Ramanujan II
      plocha: PI * A * B,
    };
  }
  /** parametrická elipsa (poloosa a v ose x, b v ose y) */
  function bodyElipsy(a, b, n, u0, u1) {
    u0 = u0 == null ? 0 : u0; u1 = u1 == null ? 2 * PI : u1; n = n || 360;
    const out = [];
    for (let i = 0; i <= n; i++) { const u = u0 + (u1 - u0) * i / n; out.push([a * Math.cos(u), b * Math.sin(u)]); }
    return out;
  }
  /**
   * Konstrukce provázkem (zahradnická metoda) – simulace: dva hřebíky v ohniscích, napnutý provázek délky 2a
   * (otevřený, konce na hřebících). Pro směr θ z ohniska F1 se hledá vzdálenost tužky ρ, kdy |PF1| + |PF2| = 2a (půlení intervalu).
   * Funguje i pro svislou hlavní osu (a < b).
   */
  function elipsaProvazkem(a, b, n) {
    const E = elipsa(a, b), svisla = b > a, L = 2 * E.a;
    const F1 = svisla ? [0, -E.c] : [-E.c, 0], F2 = svisla ? [0, E.c] : [E.c, 0];
    const out = [];
    n = n || 360;
    for (let i = 0; i < n; i++) {
      const th = 2 * PI * i / n, ux = Math.cos(th), uy = Math.sin(th);
      let lo = 0, hi = L;
      for (let k = 0; k < 80; k++) {
        const m = (lo + hi) / 2, P = [F1[0] + m * ux, F1[1] + m * uy];
        if (m + vzd(P, F2) < L) lo = m; else hi = m;
      }
      const m = (lo + hi) / 2;
      out.push([F1[0] + m * ux, F1[1] + m * uy]);
    }
    return { body: out, F1, F2, delka: L };
  }
  /** výška elipsy nad osou x ve vzdálenosti x od středu */
  const vyskaElipsy = (a, b, x) => (Math.abs(x) > a ? null : b * Math.sqrt(Math.max(0, 1 - (x * x) / (a * a))));

  /* ---------------- parabola ---------------- */
  /** parabola šířky w a výšky h: y = h·(1 − (2x/w)²), vrchol nahoře */
  function parabola(w, h) {
    const f = w * w / (16 * h), k = 8 * h / (w * w), x = w / 2;
    const delka = x * Math.sqrt(1 + k * k * x * x) + Math.asinh(k * x) / k;
    return { f, delka, rVrcholu: 2 * f, uhelPaty: deg(Math.atan(4 * h / w)), y: (q) => h * (1 - Math.pow(2 * q / w, 2)) };
  }

  /* ---------------- řetězovka ---------------- */
  /** parametr a řetězovky y = a·(cosh(x/a) − 1) pro rozpětí L a průvěs h (půlení v log a) */
  function retezovkaZPruvesu(L, h) {
    if (!(L > 0 && h > 0)) return null;
    const f = (a) => { const t = L / (2 * a); return t > 700 ? Infinity : a * (Math.cosh(t) - 1) - h; };
    let lo = Math.log(L / 1400), hi = Math.log(Math.max(L, h) * 1e6);
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(Math.exp(m)) > 0) lo = m; else hi = m; }
    return dopoctiRetezovku(L, Math.exp((lo + hi) / 2));
  }
  /** parametr a z rozpětí L a délky řetězu s (s > L) */
  function retezovkaZDelky(L, s) {
    if (!(L > 0 && s > L)) return null;
    const f = (a) => { const t = L / (2 * a); return t > 700 ? Infinity : 2 * a * Math.sinh(t) - s; };
    let lo = Math.log(L / 1400), hi = Math.log(L * 1e6);
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(Math.exp(m)) > 0) lo = m; else hi = m; }
    return dopoctiRetezovku(L, Math.exp((lo + hi) / 2));
  }
  function dopoctiRetezovku(L, a) {
    const t = L / (2 * a);
    return { a, L, h: a * (Math.cosh(t) - 1), delka: 2 * a * Math.sinh(t), uhelPaty: deg(Math.atan(Math.sinh(t))), rVrcholu: a, y: (x) => a * (Math.cosh(x / a) - 1) };
  }

  /* ---------------- kubický spline ---------------- */
  /** přirozený kubický spline y(t) přes uzly (t rostoucí); vrací koeficienty (druhé derivace M) */
  function spline(t, y) {
    const n = t.length;
    const M = new Array(n).fill(0);
    if (n > 2) {
      const a = [], b = [], c = [], d = [];
      for (let i = 1; i < n - 1; i++) {
        const h0 = t[i] - t[i - 1], h1 = t[i + 1] - t[i];
        a.push(h0 / 6); b.push((h0 + h1) / 3); c.push(h1 / 6);
        d.push((y[i + 1] - y[i]) / h1 - (y[i] - y[i - 1]) / h0);
      }
      // Thomasův algoritmus
      const m = d.length;
      for (let i = 1; i < m; i++) { const w = a[i] / b[i - 1]; b[i] -= w * c[i - 1]; d[i] -= w * d[i - 1]; }
      const x = new Array(m);
      x[m - 1] = d[m - 1] / b[m - 1];
      for (let i = m - 2; i >= 0; i--) x[i] = (d[i] - c[i] * x[i + 1]) / b[i];
      for (let i = 0; i < m; i++) M[i + 1] = x[i];
    }
    return { t: t.slice(), y: y.slice(), M };
  }
  /** hodnota, 1. a 2. derivace splinu v bodě tq */
  function splineHodnota(S, tq) {
    const t = S.t, n = t.length;
    let i = 0, j = n - 1;
    if (tq <= t[0]) i = 0; else if (tq >= t[n - 1]) i = n - 2;
    else { while (j - i > 1) { const k = (i + j) >> 1; if (t[k] > tq) j = k; else i = k; } }
    i = Math.max(0, Math.min(n - 2, i));
    const h = t[i + 1] - t[i], A = (t[i + 1] - tq) / h, B = (tq - t[i]) / h, M0 = S.M[i], M1 = S.M[i + 1];
    const v = A * S.y[i] + B * S.y[i + 1] + ((A * A * A - A) * M0 + (B * B * B - B) * M1) * h * h / 6;
    const d1 = (S.y[i + 1] - S.y[i]) / h - (3 * A * A - 1) / 6 * h * M0 + (3 * B * B - 1) / 6 * h * M1;
    const d2 = A * M0 + B * M1;
    return [v, d1, d2];
  }

  /**
   * Pružná lať přes body: metoda 'kubicky' = přirozený spline y(x) (přesné řešení ohybu nosníku pro malé průhyby:
   * mezi podpěrami EI·y'''' = 0, volné konce bez momentu → minimum ∫y''² dx); 'parametricky' = parametrický přirozený
   * spline x(s), y(s), kde parametr se opakovaně přepočítá na skutečnou délku oblouku (větší ohyby, blízko elastice).
   * Body s příznakem zlom rozdělí křivku na samostatné úseky (ostrý roh).
   * Vrací {body (vzorkovaná křivka), uzly, delka, kMax, rMin, energie, kde (bod s největší křivostí), hrebinek:[[P, normála·κ]], metoda, varovani}.
   */
  function lat(uzly, metoda, krok) {
    const varovani = [];
    const P = uzly.filter((q) => isFinite(q[0]) && isFinite(q[1]));
    if (P.length < 2) return { body: P.map((q) => [q[0], q[1]]), uzly: P, delka: 0, kMax: 0, rMin: Infinity, energie: 0, hrebinek: [], metoda, varovani: ['Zadejte aspoň dva body.'] };
    // dělení na úseky v bodech se zlomem
    const useky = [[P[0]]];
    for (let i = 1; i < P.length; i++) { useky[useky.length - 1].push(P[i]); if (P[i][2] && i < P.length - 1) useky.push([P[i]]); }
    let m = metoda === 'parametricky' ? 'parametricky' : 'kubicky';
    if (m === 'kubicky') {
      for (const u of useky) for (let i = 1; i < u.length; i++) if (!(u[i][0] > u[i - 1][0] + 1e-6)) { m = 'parametricky'; }
      if (m !== 'kubicky') varovani.push('Body nejdou zleva doprava (x neroste) – použit parametrický spline podle délky oblouku.');
    }
    const body = [], hreb = [];
    let delka = 0, kMax = 0, energie = 0, kde = null;
    const ds = krok || 1;
    for (const u of useky) {
      let fx, fy;                     // funkce parametru → [hodnota, d1, d2]
      let t0, t1;
      if (m === 'kubicky') {
        const S = spline(u.map((q) => q[0]), u.map((q) => q[1]));
        fx = (t) => [t, 1, 0]; fy = (t) => splineHodnota(S, t); t0 = u[0][0]; t1 = u[u.length - 1][0];
      } else {
        let t = [0];
        for (let i = 1; i < u.length; i++) t.push(t[i - 1] + Math.max(1e-6, vzd(u[i - 1], u[i])));
        let Sx, Sy;
        for (let it = 0; it < 8; it++) {
          Sx = spline(t, u.map((q) => q[0])); Sy = spline(t, u.map((q) => q[1]));
          // skutečná délka každého úseku (Gauss–Legendre 5 bodů)
          const G = [[-0.9061798459, 0.2369268851], [-0.5384693101, 0.4786286705], [0, 0.5688888889], [0.5384693101, 0.4786286705], [0.9061798459, 0.2369268851]];
          const nt = [0];
          for (let i = 1; i < t.length; i++) {
            const a = t[i - 1], b = t[i]; let s = 0;
            for (const [g, w] of G) { const q = (a + b) / 2 + (b - a) / 2 * g; s += w * Math.hypot(splineHodnota(Sx, q)[1], splineHodnota(Sy, q)[1]); }
            nt.push(nt[i - 1] + Math.max(1e-6, s * (b - a) / 2));
          }
          const zmena = Math.max(...nt.map((x, i) => Math.abs(x - t[i])));
          t = nt;
          if (zmena < 1e-4) break;
        }
        Sx = spline(t, u.map((q) => q[0])); Sy = spline(t, u.map((q) => q[1]));
        fx = (q) => splineHodnota(Sx, q); fy = (q) => splineHodnota(Sy, q); t0 = 0; t1 = t[t.length - 1];
      }
      // vzorkování: hustě, pak podle délky
      const hust = 2000, pom = [];
      let s = 0, prev = null;
      for (let i = 0; i <= hust; i++) {
        const tq = t0 + (t1 - t0) * i / hust, X = fx(tq), Y = fy(tq);
        const v = Math.hypot(X[1], Y[1]) || 1e-12, k = (X[1] * Y[2] - Y[1] * X[2]) / (v * v * v);
        const p = [X[0], Y[0]];
        if (prev) s += vzd(prev, p);
        pom.push({ p, k, s, n: [-Y[1] / v, X[1] / v] });
        prev = p;
      }
      for (let i = 1; i < pom.length; i++) { const dS = pom[i].s - pom[i - 1].s; energie += dS * (pom[i].k * pom[i].k + pom[i - 1].k * pom[i - 1].k) / 2; }
      for (const q of pom) if (Math.abs(q.k) > kMax) { kMax = Math.abs(q.k); kde = q.p; }
      const L = pom[pom.length - 1].s, nS = Math.max(2, Math.ceil(L / ds));
      let j = 0;
      for (let i = 0; i <= nS; i++) {
        const cil = L * i / nS;
        while (j < pom.length - 2 && pom[j + 1].s < cil) j++;
        const a = pom[j], b = pom[j + 1], f = b.s > a.s ? (cil - a.s) / (b.s - a.s) : 0;
        const p = [a.p[0] + (b.p[0] - a.p[0]) * f, a.p[1] + (b.p[1] - a.p[1]) * f];
        if (!(body.length && i === 0)) body.push(p);
      }
      const nH = Math.max(10, Math.min(160, Math.round(L / 6)));
      for (let i = 0; i <= nH; i++) { const q = pom[Math.round(i / nH * hust)]; hreb.push([q.p, q.n, q.k]); }
      delka += L;
    }
    return { body, uzly: P, delka, kMax, rMin: kMax > 0 ? 1 / kMax : Infinity, energie, kde, hrebinek: hreb, metoda: m, varovani };
  }
  /** pořadnice y lomené čáry ve svislici x (první průsečík, nebo null) */
  function yVx(body, x) {
    for (let i = 1; i < body.length; i++) {
      const a = body[i - 1], b = body[i];
      if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
      if (a[0] === x) return a[1];
    }
    return null;
  }

  /* ---------------- kabriolová noha ---------------- */
  /** křivka x(z) z uzlů [{z, x, zlom}] – přirozený spline po úsecích; vrací funkci a vzorky */
  function krivkaZ(uzly) {
    const P = uzly.filter((q) => isFinite(q.z) && isFinite(q.x)).slice().sort((a, b) => a.z - b.z);
    const useky = [[P[0]]];
    for (let i = 1; i < P.length; i++) { if (Math.abs(P[i].z - P[i - 1].z) < 1e-6) continue; useky[useky.length - 1].push(P[i]); if (P[i].zlom && i < P.length - 1) useky.push([P[i]]); }
    const S = useky.filter((u) => u.length >= 2).map((u) => ({ z0: u[0].z, z1: u[u.length - 1].z, s: spline(u.map((q) => q.z), u.map((q) => q.x)) }));
    const f = (z) => {
      if (!S.length) return P.length ? P[0].x : 0;
      let u = S.find((q) => z >= q.z0 - 1e-9 && z <= q.z1 + 1e-9);
      if (!u) u = z < S[0].z0 ? S[0] : S[S.length - 1];
      return splineHodnota(u.s, Math.max(u.z0, Math.min(u.z1, z)))[0];
    };
    return { f, z0: P.length ? P[0].z : 0, z1: P.length ? P[P.length - 1].z : 0, uzly: P };
  }
  /** profil kabriolové nohy: předni a zadni = uzly v mm (z od podlahy, x od vnitřní plochy) */
  function kabriol(predni, zadni, L, a, krok) {
    const Fp = krivkaZ(predni), Fz = krivkaZ(zadni), dz = krok || 2, varovani = [];
    const rezy = [];
    let min = { s: Infinity }, max = { s: 0 }, vne = false;
    const n = Math.max(20, Math.ceil(L / dz));
    for (let i = 0; i <= n; i++) {
      const z = L * i / n, x1 = Fp.f(z), x0 = Fz.f(z), s = x1 - x0;
      rezy.push({ z, x0, x1 });
      if (x0 < -0.3 || x1 > a + 0.3) vne = true;
      if (z > 0.02 * L && z < 0.75 * L && s < min.s) min = { s, z };
      if (s > max.s) max = { s, z };
    }
    if (vne) varovani.push(`Profil vybíhá mimo polotovar ${r2(a)} mm – zvětšete polotovar nebo upravte body.`);
    if (rezy.some((q) => q.x1 - q.x0 < 1)) varovani.push('Přední a zadní čára se kříží nebo dotýkají – noha by byla přerušená.');
    if (min.s < 0.3 * a) varovani.push(`Kotník ${r2(min.s)} mm je slabý (méně než 30 % polotovaru) – noha se může zlomit napříč vláken.`);
    return { rezy, kotnik: min, koleno: max, varovani, predni: Fp, zadni: Fz };
  }

  /* ---------------- kuželová noha (taper) ---------------- */
  /**
   * L délka, a průřez nahoře (čtverec), b rozměr u paty, s délka čtyřhranu nahoře (nezužuje se), strany '1' | '2s' (dvě sousední) | '2p' (dvě protilehlé) | '4'.
   * Vrací úbytek na stranu u, úhel α, nastavení přípravku pro 1. a 2. průchod a rozměry u paty.
   */
  function kuzelovaNoha(L, a, b, s, strany) {
    const lz = Math.max(1, L - s), dve = strany === '2p' || strany === '4';
    const u = dve ? (a - b) / 2 : (a - b);
    const al = Math.atan(u / lz);
    const patX = a - (strany === '1' ? u : strany === '2s' ? u : 2 * u);
    const patY = strany === '1' || strany === '2p' ? a : strany === '2s' ? a - u : a - 2 * u;
    const pruchody = strany === '1' ? [{ strana: 1, uhel: al, posun: u }]
      : strany === '2s' ? [{ strana: 1, uhel: al, posun: u }, { strana: 2, uhel: al, posun: u, pozn: 'sousední plocha – nastavení stejné' }]
      : strany === '2p' ? [{ strana: 1, uhel: al, posun: u }, { strana: 3, uhel: 2 * al, posun: 2 * u, pozn: 'protilehlá: zúžená plocha leží na pravítku → dvojnásobné nastavení (nebo podložka tl. u u paty)' }]
      : [{ strana: 1, uhel: al, posun: u }, { strana: 2, uhel: al, posun: u }, { strana: 3, uhel: 2 * al, posun: 2 * u, pozn: 'dvojnásobné nastavení' }, { strana: 4, uhel: 2 * al, posun: 2 * u, pozn: 'dvojnásobné nastavení' }];
    return { L, a, b, s, lz, u, uhel: al, uhelSt: deg(al), patX, patY, pruchody, strany, objemOdpadu: null };
  }
  /** šířka nohy v pohledu ve výšce z (0 = podlaha), pro pohled 'x' nebo 'y' → [x0, x1] (x0 = zadní plocha) */
  function prurezKuzelu(N, z, osa) {
    const t = z >= N.lz ? 0 : (N.lz - z) / N.lz;     // 1 u paty, 0 na začátku zúžení
    const S = N.strany, u = N.u;
    let lev = 0, prav = 0;
    if (osa === 'x') { if (S === '1' || S === '2s') prav = u * t; else { lev = u * t; prav = u * t; } }
    else { if (S === '2s') prav = u * t; else if (S === '4') { lev = u * t; prav = u * t; } }
    return [lev, N.a - prav];
  }

  /* ---------------- soustružený profil ---------------- */
  const TYPY_PRVKU = {
    valec: 'válec', kuzel: 'kužel', koralek: 'korálek (bead)', vyzlabek: 'výžlabek (cove)', ogee: 'ogee (S-křivka)', zaobleni: 'zaoblení (čtvrtelipsa)', ctyrhran: 'čtyřhran (neotáčí se)',
  };
  /** poloměr prvku v místní souřadnici u ∈ [0, l]; vrací funkci a seznam kótovaných bodů */
  function funkcePrvku(p) {
    const l = Math.max(0.1, cislo(p.l, 10)), r1 = Math.max(0, cislo(p.d1, 20) / 2);
    let r2_ = Math.max(0, cislo(p.d2, p.d1) / 2);
    const rx = Math.max(0, cislo(p.dx, p.d1) / 2), varovani = [];
    let f, extrem = null;
    switch (p.typ) {
      case 'valec': case 'ctyrhran': r2_ = r1; f = () => r1; break;
      case 'kuzel': f = (u) => r1 + (r2_ - r1) * u / l; break;
      case 'koralek': case 'vyzlabek': {
        r2_ = r1;
        const konv = p.typ === 'koralek';
        let v = konv ? rx - r1 : r1 - rx;
        if (v > l / 2) { varovani.push(`${TYPY_PRVKU[p.typ]}: vypouklost ${r2(v)} mm je větší než polovina délky – omezeno na půlkruh.`); v = l / 2; }
        if (v <= 1e-6) { f = () => r1; break; }
        const rho = ((l / 2) * (l / 2) + v * v) / (2 * v);
        if (konv) { const c = r1 + v - rho; f = (u) => c + Math.sqrt(Math.max(0, rho * rho - (u - l / 2) * (u - l / 2))); }
        else { const c = r1 - v + rho; f = (u) => c - Math.sqrt(Math.max(0, rho * rho - (u - l / 2) * (u - l / 2))); }
        extrem = { u: l / 2, r: konv ? r1 + v : r1 - v, rho };
        break;
      }
      case 'ogee': {
        // dva stejné kruhové oblouky s vodorovnou tečnou na koncích a společnou tečnou uprostřed
        const D = Math.abs(r2_ - r1), sg = Math.sign(r2_ - r1) || 1;
        if (D < 1e-6) { f = () => r1; break; }
        const R = (l * l + D * D) / (4 * D);
        f = (u) => (u <= l / 2 ? r1 + sg * (R - Math.sqrt(Math.max(0, R * R - u * u))) : r2_ - sg * (R - Math.sqrt(Math.max(0, R * R - (l - u) * (l - u)))));
        extrem = { u: l / 2, r: (r1 + r2_) / 2, rho: R, inflexe: true };
        break;
      }
      case 'zaobleni': {
        // čtvrtelipsa: oblé zakončení z většího průměru na menší
        if (r1 >= r2_) f = (u) => r2_ + (r1 - r2_) * Math.sqrt(Math.max(0, 1 - (u / l) * (u / l)));
        else f = (u) => r1 + (r2_ - r1) * Math.sqrt(Math.max(0, 1 - ((l - u) / l) * ((l - u) / l)));
        break;
      }
      default: f = () => r1;
    }
    return { f, l, r1, r2: r2_, extrem, varovani };
  }
  /**
   * Profil soustruženého dílu z prvků (zleva doprava). Vrací {body: [[z, r]] obrysu (včetně svislých osazení),
   * hranice: [{z, dL, dP}], koty: [{z, d, popis, i}], delka, dMax, dMin, objem, varovani, prvky: [{...,z0,z1,F}]}.
   */
  function profilSoustruhu(prvky, krok) {
    const ds = krok || 0.5, body = [], hranice = [], koty = [], varovani = [], P = [];
    let z = 0, objem = 0, dMax = 0, dMin = Infinity, rPrev = null;
    (prvky || []).forEach((p, i) => {
      const F = funkcePrvku(p), z0 = z, z1 = z + F.l;
      for (const v of F.varovani) varovani.push(`Prvek ${i + 1}: ${v}`);
      const n = Math.max(2, Math.ceil(F.l / ds));
      const rA = F.f(0);
      if (rPrev == null) { body.push([z0, 0]); body.push([z0, rA]); hranice.push({ z: z0, dL: 0, dP: 2 * rA }); }
      else { if (Math.abs(rPrev - rA) > 1e-6) body.push([z0, rA]); hranice.push({ z: z0, dL: 2 * rPrev, dP: 2 * rA }); }
      for (let k = 1; k <= n; k++) {
        const u = F.l * k / n, r = F.f(u);
        body.push([z0 + u, r]);
        const ua = F.l * (k - 1) / n, ra = F.f(ua), dz = u - ua;
        objem += p.typ === 'ctyrhran' ? dz * 4 * r * r : PI * dz * (ra * ra + ra * r + r * r) / 3;
      }
      const rB = F.f(F.l);
      for (const r of [rA, rB, F.extrem ? F.extrem.r : rA]) { dMax = Math.max(dMax, 2 * r); dMin = Math.min(dMin, 2 * r); }
      if (p.typ === 'ctyrhran') dMax = Math.max(dMax, 2 * Math.SQRT2 * rA);
      const nazev = TYPY_PRVKU[p.typ] || p.typ;
      koty.push({ z: z0, d: 2 * rA, popis: `${i + 1} ${nazev} – začátek`, i, typ: p.typ, kde: 'zacatek' });
      if (F.extrem) koty.push({ z: z0 + F.extrem.u, d: 2 * F.extrem.r, popis: `${i + 1} ${nazev} – ${F.extrem.inflexe ? 'inflexe' : p.typ === 'koralek' ? 'vrchol' : 'dno'}`, i, typ: p.typ, kde: 'extrem' });
      if (p.typ === 'kuzel' || p.typ === 'ogee' || p.typ === 'zaobleni' || Math.abs(rB - rA) > 1e-6) koty.push({ z: z1, d: 2 * rB, popis: `${i + 1} ${nazev} – konec`, i, typ: p.typ, kde: 'konec' });
      P.push(Object.assign({}, p, { z0, z1, F }));
      z = z1; rPrev = rB;
    });
    if (rPrev != null) { body.push([z, 0]); hranice.push({ z, dL: 2 * rPrev, dP: 0 }); }
    return { body, hranice, koty, delka: z, dMax, dMin: isFinite(dMin) ? dMin : 0, objem, varovani, prvky: P };
  }
  /** průměr profilu v poloze z (z prvku, který z obsahuje; na hranici platí prvek vpravo) */
  function prumerV(profil, z) {
    const P = profil.prvky;
    if (!P.length) return 0;
    let p = P.find((q) => z >= q.z0 - 1e-9 && z < q.z1 - 1e-9) || (z >= P[P.length - 1].z1 - 1e-9 ? P[P.length - 1] : P[0]);
    return 2 * p.F.f(Math.max(0, Math.min(p.F.l, z - p.z0)));
  }

  /* ---------------- profily lišt a hran ---------------- */
  const TYPY_LIST = { oblounek: 'oblounek (roundover)', vyzlabek: 'výžlabek (cove)', ogee: 'ogee – vypouklé nahoře (cyma reversa)', rimske: 'římské ogee – výžlabek nahoře (cyma recta)', fazeta: 'fazeta (chamfer)', polodrazka: 'polodrážka (rabbet)' };
  /**
   * Profil horní pravé hrany desky tloušťky T a šířky w (řez; materiál vlevo dole).
   * p: {typ, R, R2, f (osazení), a, b (fazeta/polodrážka), obe (i spodní hrana)}
   * Vrací {obrys: uzavřený polygon řezu, krivka: lomená čára profilu (od horní plochy k boční), vyska, sirka, koty, vlastnosti}
   */
  function profilListy(p) {
    const T = Math.max(4, cislo(p.T, 20)), w = Math.max(T, cislo(p.w, 60)), R = Math.max(0.5, cislo(p.R, 8)), R2 = Math.max(0.5, cislo(p.R2, 6));
    const f = Math.max(0, cislo(p.f, 0)), a = Math.max(0.5, cislo(p.a, 5)), b = Math.max(0.5, cislo(p.b, a));
    const arc = (cx, cy, r, u0, u1) => bodyOblouku(cx, cy, r, rad(u0), rad(u1 - u0), 0.4);
    let k = [], frez = '';
    switch (p.typ) {
      case 'vyzlabek':
        // výžlabek: čtvrtkruh se středem v rohu (nad osazením)
        k = [[w - R, T]].concat(f > 0 ? [[w - R, T - f]] : [], arc(w, T - f, R, 180, 270).slice(1), [[w, T - f - R]]);
        frez = `výžlabková fréza (cove) R ${r2(R)}`;
        break;
      case 'ogee':
        k = arc(w - R2 - R, T - R, R, 90, 0).concat(arc(w, T - R, R2, 180, 270).slice(1));
        frez = `ogee fréza R ${r2(R)} / R ${r2(R2)}, nebo dva průchody: oblounek R ${r2(R)} + výžlabek R ${r2(R2)}`;
        break;
      case 'rimske':
        k = arc(w - R, T, R2, 180, 270).concat(arc(w - R, T - R2 - R, R, 90, 0).slice(1));
        frez = `fréza římské ogee (roman ogee) R ${r2(R2)} / R ${r2(R)}`;
        break;
      case 'fazeta':
        k = [[w - a, T], [w, T - b]];
        frez = `fazetovací fréza 45° (chamfer)${Math.abs(a - b) > 0.01 ? ' – nesouměrná fazeta: fréza s jiným úhlem nebo hoblík' : ''}`;
        break;
      case 'polodrazka':
        k = [[w - a, T], [w - a, T - b], [w, T - b]];
        frez = `polodrážková fréza s ložiskem (rabbet) – šířka ${r2(a)}, hloubka ${r2(b)}`;
        break;
      default:
        // oblounek; s osazením f = fréza spuštěná níž → schůdek na horní ploše
        k = [[w - R, T]].concat(f > 0 ? [[w - R, T - f]] : [], arc(w - R, T - f - R, R, 90, 0).slice(1));
        frez = `zaoblovací fréza (roundover) R ${r2(R)}${f > 0 ? `, spuštěná o ${r2(f)} mm níž (osazení)` : ''}`;
    }
    const sirka = w - Math.min(...k.map((q) => q[0])), vyska = T - Math.min(...k.map((q) => q[1]));
    const obe = !!p.obe && 2 * vyska < T - 0.5;
    // obrys proti směru hodin: (0,0) → spodní hrana (případně zrcadlový profil) → bok → profil nahoru → horní plocha → (0,T)
    const pol = [[0, 0]];
    if (obe) { for (const q of k) pol.push([q[0], T - q[1]]); } else pol.push([w, 0]);
    for (const q of k.slice().reverse()) pol.push(q);
    pol.push([0, T]);
    const zbyvaBoku = T - vyska * (obe ? 2 : 1);
    return { obrys: odstranDuplicity(pol), krivka: k, vyska, sirka, T, w, frez, zbyvaBoku, obe, lozisko: zbyvaBoku >= 2 };
  }
  function odstranDuplicity(pol) {
    const out = [];
    for (const q of pol) if (!out.length || vzd(out[out.length - 1], q) > 1e-6) out.push(q);
    if (out.length > 2 && vzd(out[0], out[out.length - 1]) < 1e-6) out.pop();
    return out;
  }
  /** nejbližší typický poloměr ze seznamu (≤ a ≥) */
  function typickyPolomer(R, seznam) {
    const s = String(seznam || '').split(/[;\s]+/).map((x) => cislo(x, NaN)).filter((x) => x > 0).sort((a, b) => a - b);
    const presne = s.find((x) => Math.abs(x - R) < 0.05);
    return { presne: presne != null ? presne : null, mensi: s.filter((x) => x < R - 0.05).pop() || null, vetsi: s.find((x) => x > R + 0.05) || null };
  }

  /* ---------------- ohýbané lamely (opěradlo) ---------------- */
  /** odpružení lepené lamely: orientační pravidlo – podíl ztracené křivosti ≈ 1 / n² */
  function odpruzeni(n) { n = Math.max(1, Math.round(n)); return n <= 1 ? 0.5 : 1 / (n * n); }

  /* ---------------- geometrie polygonů ---------------- */
  function plocha(pol) { let s = 0; for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) s += pol[j][0] * pol[i][1] - pol[i][0] * pol[j][1]; return s / 2; }
  function vPolygonu(p, pol) {
    let in_ = false;
    for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
      const a = pol[i], b = pol[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) in_ = !in_;
    }
    return in_;
  }
  function meze(body) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of body) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    return { x0, y0, x1, y1 };
  }
  /** zjednodušení lomené čáry (Douglas–Peucker) s tolerancí tol mm */
  function zjednodus(body, tol) {
    if (body.length < 3) return body.slice();
    const keep = new Uint8Array(body.length); keep[0] = 1; keep[body.length - 1] = 1;
    const zas = [[0, body.length - 1]];
    while (zas.length) {
      const [a, b] = zas.pop(); let dm = 0, im = -1;
      const A = body[a], B = body[b], L = vzd(A, B) || 1e-12;
      for (let i = a + 1; i < b; i++) { const P = body[i], d = Math.abs((B[0] - A[0]) * (A[1] - P[1]) - (A[0] - P[0]) * (B[1] - A[1])) / L; if (d > dm) { dm = d; im = i; } }
      if (dm > tol && im > 0) { keep[im] = 1; zas.push([a, im], [im, b]); }
    }
    return body.filter((_, i) => keep[i]);
  }

  /* ---------------- tisk ---------------- */
  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };
  function rozmerPapiru(n) {
    if (n.papir === 'vlastni') return [Math.max(80, cislo(n.papirW, 210)), Math.max(80, cislo(n.papirH, 297))];
    return PAPIRY[n.papir] || PAPIRY.a4;
  }
  /** naměřené délky kontrolních úseček (nominál 100 mm) → korekce */
  function korekceMeritka(mx, my) {
    const k = (m) => { const x = cislo(m, 100); return x > 80 && x < 120 ? 100 / x : 1; };
    return { kx: k(mx), ky: k(my) };
  }
  const mmNaPt = (mm) => mm * 72 / 25.4;
  const PATA = 17, PRAVY_PAS = 13;
  /** rozvrh listů pro oblast (mm modelu) na papír pw × ph se zadaným přesahem; volí orientaci s menším počtem listů */
  function rozvrhListu(obl, pw, ph, nast) {
    const K = korekceMeritka(nast.kalibX, nast.kalibY), ok = cislo(nast.okraj, 8);
    const sw = obl.x1 - obl.x0, sh = obl.y1 - obl.y0;
    const varianta = (W, H) => {
      const uw = W - 2 * ok - PRAVY_PAS, uh = H - 2 * ok - PATA, uwM = uw / K.kx, uhM = uh / K.ky;
      if (sw <= uwM + 1e-6 && sh <= uhM + 1e-6) return { W, H, uw, uh, uwM, uhM, nx: 1, ny: 1, g: 0, jeden: true };
      const g = Math.min(Math.max(0, cislo(nast.prekryv, 15)), uwM * 0.45, uhM * 0.45);
      const nx = sw <= uwM + 1e-6 ? 1 : Math.ceil((sw - g) / (uwM - g) - 1e-9), ny = sh <= uhM + 1e-6 ? 1 : Math.ceil((sh - g) / (uhM - g) - 1e-9);
      return { W, H, uw, uh, uwM, uhM, nx, ny, g, jeden: false };
    };
    const a = varianta(pw, ph), b = varianta(ph, pw), v = b.nx * b.ny < a.nx * a.ny ? b : a;
    const cw = v.nx === 1 ? v.uwM : v.nx * (v.uwM - v.g) + v.g, chh = v.ny === 1 ? v.uhM : v.ny * (v.uhM - v.g) + v.g;
    const ox = obl.x0 - (cw - sw) / 2, top = obl.y1 + (chh - sh) / 2, listy = [];
    for (let r = 0; r < v.ny; r++) for (let c = 0; c < v.nx; c++) { const x0 = ox + c * (v.uwM - v.g), y1 = top - r * (v.uhM - v.g); listy.push({ x0, x1: x0 + v.uwM, y0: y1 - v.uhM, y1, r, c }); }
    return Object.assign(v, { listy, kx: K.kx, ky: K.ky, okraj: ok });
  }

  const API = {
    r2, cislo, deg, rad, vzd, kruzniceZTriBodu, obloukZTriBodu, tetivaVzepeti, vzepetiZPolomeru, vyskaOblouku, bodyOblouku,
    segmentovyOblouk, elipsa, bodyElipsy, elipsaProvazkem, vyskaElipsy, parabola, retezovkaZPruvesu, retezovkaZDelky,
    spline, splineHodnota, lat, yVx, krivkaZ, kabriol, kuzelovaNoha, prurezKuzelu,
    TYPY_PRVKU, funkcePrvku, profilSoustruhu, prumerV, TYPY_LIST, profilListy, typickyPolomer, odpruzeni,
    plocha, vPolygonu, meze, zjednodus, odstranDuplicity, PAPIRY, rozmerPapiru, korekceMeritka, mmNaPt, PATA, PRAVY_PAS, rozvrhListu,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.OBL = API;
})(typeof window !== 'undefined' ? window : globalThis);
