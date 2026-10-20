/* ============================================================
   dalekohled/jadro.js – výpočty pro „Hvězdářský dalekohled“
   (obsah/dalekohled.html). Bez DOM, běží v prohlížeči i v node
   (test _test/dalekohled_test.js). Polohy planet, Slunce a Měsíce
   bere z ../sky_events/astro.js (Meeus, JPL Keplerovy elementy).

   Zdroje:
   - J. Meeus: Astronomical Algorithms, 2. vyd. (1998) – kap. 21
     precese, 41 jasnosti planet, 44 Galileovy měsíce (nízká přesnost),
     48 osvětlení
   - Archinal a kol.: Report of the IAU WG on Cartographic Coordinates
     and Rotational Elements 2015 – póly a rotace těles
   - A. Mallama, J. Hilton (2018): Computing apparent planetary magnitudes
   - B. Schaefer (1990): Telescopic limiting magnitudes; vztah jasu
     oblohy a mezní hvězdné velikosti (aproximace používaná v SQM)
   - Allen's Astrophysical Quantities – počty hvězd do dané velikosti

   Souřadnice: vše se počítá v rovníkové soustavě J2000 (vektory),
   pro výšku nad obzorem se převádí precesí na rovnodennost data.
   ============================================================ */
(function (koren) {
  'use strict';
  const ASTRO = koren.ASTRO || (typeof require !== 'undefined' ? require('../sky_events/astro.js') : null);
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const sin = x => Math.sin(x * RAD), cos = x => Math.cos(x * RAD);
  const norm = x => ((x % 360) + 360) % 360;
  const AU = 149597870.7, R_ZEME = 6378.14;
  const EPS0 = 23.4392911;               // sklon ekliptiky J2000

  /* ---------------- vektory ---------------- */
  const v3 = (ra, dec) => [cos(dec) * cos(ra), cos(dec) * sin(ra), sin(dec)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const unit = a => mul(a, 1 / len(a));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const mxv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const mtxv = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
  const mxm = (a, b) => { const r = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]); return r; };
  function raDec(v) {
    const l = len(v);
    return { ra: norm(Math.atan2(v[1], v[0]) * DEG), dec: Math.asin(Math.max(-1, Math.min(1, v[2] / l))) * DEG };
  }
  // pasivní rotace soustavy kolem osy x (R1) a z (R3)
  const R1 = t => [1, 0, 0, 0, cos(t), sin(t), 0, -sin(t), cos(t)];
  const R3 = t => [cos(t), sin(t), 0, -sin(t), cos(t), 0, 0, 0, 1];
  function eklNaRov(v) {             // ekliptika J2000 → rovník J2000
    const c = cos(EPS0), s = sin(EPS0);
    return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
  }
  // úhlová vzdálenost dvou směrů (°)
  const uhel = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * DEG;

  /* ---------------- precese J2000 → rovnodennost data (Meeus 21.2) ---------------- */
  function precese(jde) {
    const T = (jde - 2451545) / 36525;
    const z1 = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) / 3600;
    const z2 = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) / 3600;
    const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) / 3600;
    // P = R3(−z) R2(θ) R3(−ζ)
    const R2 = t => [cos(t), 0, -sin(t), 0, 1, 0, sin(t), 0, cos(t)];
    return mxm(R3(-z2), mxm(R2(th), R3(-z1)));
  }

  /* ---------------- místní souřadnice ---------------- */
  // v (J2000, jednotkový) → {alt, az} pro místo {lat, lon}; jd v UT. Refrakce volitelně (Bennett).
  function naObzor(v, jd, misto, prec, refrakce = true) {
    const P = prec || precese(ASTRO.utNaJde(jd));
    const rd = raDec(mxv(P, v));
    const lst = ASTRO.gast(jd) + misto.lon, H = lst - rd.ra, fi = misto.lat;
    let alt = Math.asin(sin(fi) * sin(rd.dec) + cos(fi) * cos(rd.dec) * cos(H)) * DEG;
    const az = norm(Math.atan2(sin(H), cos(H) * sin(fi) - Math.tan(rd.dec * RAD) * cos(fi)) * DEG + 180);
    if (refrakce && alt > -2) alt += refrakceStupne(alt);
    return { alt, az };
  }
  function refrakceStupne(h) {      // zdánlivé zvednutí (°) pro skutečnou výšku h (Sæmundsson)
    if (h > 89.5) return 0;
    return Math.max(0, 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * RAD) / 60);
  }
  // obrácená úloha: {alt (zdánlivá), az} → J2000 vektor
  function zObzoru(alt, az, jd, misto, prec) {
    const P = prec || precese(ASTRO.utNaJde(jd));
    let h = alt;
    if (h > -2) for (let i = 0; i < 3; i++) h = alt - refrakceStupne(h);
    h = Math.min(89.99999, h);
    const fi = misto.lat, A = az - 180;
    const dec = Math.asin(sin(fi) * sin(h) - cos(fi) * cos(h) * cos(A)) * DEG;
    const H = Math.atan2(sin(A), cos(A) * sin(fi) + Math.tan(h * RAD) * cos(fi)) * DEG;
    const ra = ASTRO.gast(jd) + misto.lon - H;
    return mtxv(P, v3(ra, dec));
  }
  // geocentrický vektor pozorovatele v km (J2000)
  function pozorovatel(jd, misto, prec) {
    const P = prec || precese(ASTRO.utNaJde(jd));
    const fi = misto.lat, h = (misto.vyska || 0) / 1000;
    const u = Math.atan(0.99664719 * Math.tan(fi * RAD));
    const rs = 0.99664719 * Math.sin(u) + h / R_ZEME * sin(fi);
    const rc = Math.cos(u) + h / R_ZEME * cos(fi);
    const lst = ASTRO.gast(jd) + misto.lon;
    return mtxv(P, [R_ZEME * rc * cos(lst), R_ZEME * rc * sin(lst), R_ZEME * rs]);
  }

  /* ---------------- tělesa sluneční soustavy ---------------- */
  // poloměry [rovníkový, polární] km, IAU rotace: α0, δ0 (+ změna/století), W0, W' (°/den)
  const TELESA = {
    slunce: { jmeno: 'Slunce', r: [696000, 696000] },
    mesic: { jmeno: 'Měsíc', r: [1737.4, 1737.4], tex: 'mesic' },
    merkur: { jmeno: 'Merkur', r: [2440.5, 2438.3], pol: [281.0103, -0.0328, 61.4155, -0.0049], W: [329.5988, 6.1385108], tex: 'merkur' },
    venuse: { jmeno: 'Venuše', r: [6121.8, 6121.8], pol: [272.76, 0, 67.16, 0], W: [160.20, -1.4813688], tex: 'venuse' },
    mars: { jmeno: 'Mars', r: [3396.19, 3376.2], pol: [317.269202, -0.10927547, 54.432516, -0.05827105], W: [176.049863, 350.891982443297], tex: 'mars' },
    jupiter: { jmeno: 'Jupiter', r: [71492, 66854], pol: [268.056595, -0.006499, 64.495303, 0.002413], W: [43.3, 870.27], tex: 'jupiter', texPosun: -153.6 },
    saturn: { jmeno: 'Saturn', r: [60268, 54364], pol: [40.589, -0.036, 83.537, -0.004], W: [38.90, 810.7939024], tex: 'saturn', prstence: true },
    uran: { jmeno: 'Uran', r: [25559, 24973], pol: [257.311, 0, -15.175, 0], W: [203.81, -501.1600928], barva: [175, 222, 228] },
    neptun: { jmeno: 'Neptun', r: [24764, 24341], pol: [299.36, 0, 43.46, 0], W: [249.978, 541.1397757], barva: [92, 128, 222] },
  };
  // texPosun: textura má délku λ (východní) na u = (λ + texPosun)/360; výchozí 180 (nultý poledník uprostřed).
  // Pozn.: W Jupiteru je zvolené tak, aby Velká rudá skvrna textury ležela zhruba na své délce
  // v Systému II (driftuje, skutečnou polohu je nutné ověřit v aktuálních pozorováních).

  // vektor ekliptiky z heliocentrických {x,y,z}
  const hv = o => [o.x, o.y, o.z];
  function polohaPlanety(klic, jde) {   // geocentrický vektor tělesa a vektor tělesa→Slunce, AU, J2000 rovník
    const zem = hv(ASTRO.helio('zeme', jde));
    let p = hv(ASTRO.helio(klic, jde)), d = 0;
    for (let i = 0; i < 3; i++) {
      d = len(sub(p, zem));
      p = hv(ASTRO.helio(klic, jde - d * 0.0057755183));
    }
    return { geo: eklNaRov(sub(p, zem)), kSlunci: eklNaRov(mul(p, -1)) };
  }
  function polohaMesice(jde) {
    const m = ASTRO.mesic(jde);
    const T = (jde - 2451545) / 36525;
    // ekliptikální šířka se při převodu na J2000 mění jen o zlomky ″ – zanedbáno
    const lon = m.lonJ2000, lat = m.lat - 0.0 * T;
    const ekl = [cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat)];
    const geo = mul(eklNaRov(ekl), m.dist / AU);
    const sl = ASTRO.slunce(jde);
    const slv = mul(eklNaRov([cos(sl.lonJ2000), sin(sl.lonJ2000), 0]), sl.R);
    return { geo, kSlunci: sub(slv, geo) };
  }
  function polohaSlunce(jde) {
    const zem = hv(ASTRO.helio('zeme', jde));
    const g = eklNaRov(mul(zem, -1));
    return { geo: g, kSlunci: [0, 0, 0] };
  }

  // rotační matice ICRF → soustava spojená s tělesem
  function rotaceTelesa(klic, jde, dUprava) {
    const t = TELESA[klic], d = jde - 2451545, T = d / 36525;
    let a0, d0, W;
    if (klic === 'mesic') {
      const E1 = 125.045 - 0.0529921 * d, E2 = 250.089 - 0.1059842 * d, E3 = 260.008 + 13.0120009 * d;
      const E4 = 176.625 + 13.3407154 * d, E5 = 357.529 + 0.9856003 * d, E6 = 311.589 + 26.4057084 * d;
      const E7 = 134.963 + 13.064993 * d, E10 = 15.134 - 0.1589763 * d, E13 = 25.053 + 12.9590088 * d;
      a0 = 269.9949 + 0.0031 * T - 3.8787 * sin(E1) - 0.1204 * sin(E2) + 0.07 * sin(E3) - 0.0172 * sin(E4) + 0.0072 * sin(E6) - 0.0052 * sin(E10) + 0.0043 * sin(E13);
      d0 = 66.5392 + 0.013 * T + 1.5419 * cos(E1) + 0.0239 * cos(E2) - 0.0278 * cos(E3) + 0.0068 * cos(E4) - 0.0029 * cos(E6) + 0.0009 * cos(E7) + 0.0008 * cos(E10) - 0.0009 * cos(E13);
      W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.561 * sin(E1) + 0.1208 * sin(E2) - 0.0642 * sin(E3) + 0.0158 * sin(E4) + 0.0252 * sin(E5) - 0.0066 * sin(E6) - 0.0047 * sin(E7) + 0.0052 * sin(E10) - 0.0044 * sin(E13);
    } else if (t.pol) {
      a0 = t.pol[0] + t.pol[1] * T; d0 = t.pol[2] + t.pol[3] * T;
      W = t.W[0] + t.W[1] * (d - (dUprava || 0));
    } else return null;
    return { M: mxm(R3(W), mxm(R1(90 - d0), R3(90 + a0))), pol: v3(a0, d0), W: norm(W) };
  }

  // jasnost (Mallama & Hilton 2018, zjednodušeně; Měsíc Allen)
  function jasnost(klic, r, D, i, B) {
    const l = 5 * Math.log10(r * D);
    switch (klic) {
      case 'merkur': return -0.613 + l + 0.06328 * i - 0.0016336 * i * i + 3.3644e-5 * i ** 3 - 3.4265e-7 * i ** 4 + 1.6893e-9 * i ** 5 - 3.0334e-12 * i ** 6;
      case 'venuse': return i < 163.7 ? -4.384 + l - 0.001044 * i + 3.687e-4 * i * i - 2.814e-6 * i ** 3 + 8.938e-9 * i ** 4 : 236.05828 + l - 2.81914 * i + 8.39034e-3 * i * i;
      case 'mars': return -1.601 + l + 0.02267 * i - 1.302e-4 * i * i;
      case 'jupiter': return -9.395 + l + 3.7e-4 * i + 6.16e-4 * i * i;
      case 'saturn': { const sb = Math.abs(Math.sin(B * RAD)); return -8.914 + l - 1.825 * sb + 0.026 * i - 0.378 * sb * Math.exp(-2.25 * i); }
      case 'uran': return -7.11 + l + 0.0011 * i * i;
      case 'neptun': return -7.0 + l;
      case 'mesic': return -12.73 + 0.026 * i + 4e-9 * i ** 4 + 5 * Math.log10(D * AU / 384400);
      case 'slunce': return -26.74 + 5 * Math.log10(D);
    }
    return 99;
  }

  /* ---------------- Galileovy měsíce (Meeus kap. 44, nízká přesnost) ---------------- */
  // X kladné na západ, Y na sever, v poloměrech Jupiteru, v soustavě rovníku Jupiteru; Z > 0 = blíž k Zemi
  function galileovyMesice(jde, DeZeme) {
    const d = jde - 2451545;
    const V = 172.74 + 0.00111588 * d, M = 357.529 + 0.9856003 * d;
    const N = 20.02 + 0.0830853 * d + 0.329 * sin(V), J = 66.115 + 0.9025179 * d - 0.329 * sin(V);
    const A = 1.915 * sin(M) + 0.02 * sin(2 * M), B = 5.555 * sin(N) + 0.168 * sin(2 * N);
    const K = J + A - B;
    const R = 1.00014 - 0.01671 * cos(M) - 0.00014 * cos(2 * M);
    const r = 5.20872 - 0.25208 * cos(N) - 0.00611 * cos(2 * N);
    const D = Math.sqrt(r * r + R * R - 2 * r * R * cos(K));
    const psi = Math.asin(R / D * sin(K)) * DEG;
    const lam = 34.35 + 0.083091 * d + 0.329 * sin(V) + B;
    const De = 3.12 * sin(lam + 42.8);
    const t = d - D / 173;
    let u1 = 163.8069 + 203.4058646 * t + psi - B, u2 = 358.414 + 101.2916335 * t + psi - B;
    let u3 = 5.7176 + 50.234518 * t + psi - B, u4 = 224.8092 + 21.48798 * t + psi - B;
    const G = 331.18 + 50.310482 * t, Hh = 87.45 + 21.569231 * t;
    const k1 = 0.473 * sin(2 * (u1 - u2)), k2 = 1.065 * sin(2 * (u2 - u3)), k3 = 0.165 * sin(G), k4 = 0.843 * sin(Hh);
    const r1 = 5.9057 - 0.0244 * cos(2 * (u1 - u2)), r2 = 9.3966 - 0.0882 * cos(2 * (u2 - u3));
    const r3 = 14.9883 - 0.0216 * cos(G), r4 = 26.3627 - 0.1939 * cos(Hh);
    u1 += k1; u2 += k2; u3 += k3; u4 += k4;
    const DE = DeZeme === undefined ? De : DeZeme;
    const m = (jmeno, rr, u, mag0, km) => ({ jmeno, X: rr * sin(u), Y: -rr * cos(u) * sin(DE), Z: rr * cos(u), mag0, km });
    return [m('Io', r1, u1, -1.68, 1821.6), m('Europa', r2, u2, -1.41, 1560.8), m('Ganymedes', r3, u3, -2.09, 2634.1), m('Callisto', r4, u4, -1.05, 2410.3)];
  }

  // poziční úhel směru v (od severu přes východ, °) viděný z místa ve směru d
  function pozicniUhel(d, v) {
    const n = unit(sub([0, 0, 1], mul(d, d[2])));
    const e = unit(cross([0, 0, 1], d));
    return norm(Math.atan2(dot(v, e), dot(v, n)) * DEG);
  }
  // báze nebeské tečné roviny ve směru d: z (k pozorovateli), y (sever), x (západ)
  function baze(d) {
    const zt = mul(unit(d), -1);
    let n = sub([0, 0, 1], mul(unit(d), unit(d)[2]));
    if (len(n) < 1e-9) n = [1, 0, 0];
    n = unit(n);
    const x = cross(n, zt);          // západ
    return { x, y: n, z: zt };
  }

  /* Úplný stav tělesa v čase jd (UT) z místa: poloha, vzdálenost, úhlový průměr, fáze, jasnost,
     orientace (matice do soustavy tělesa) a směr ke Slunci. */
  function teleso(klic, jd, misto, prec) {
    const jde = ASTRO.utNaJde(jd);
    const P = prec || precese(jde);
    let p;
    if (klic === 'mesic') p = polohaMesice(jde);
    else if (klic === 'slunce') p = polohaSlunce(jde);
    else p = polohaPlanety(klic, jde);
    // topocentrická oprava (paralaxa)
    const obs = mul(pozorovatel(jd, misto, P), 1 / AU);
    const geo = sub(p.geo, obs);
    const D = len(geo), d = unit(geo);
    const t = TELESA[klic];
    const rUhel = Math.asin(Math.min(1, t.r[0] / (D * AU))) * DEG * 3600;    // ″, rovníkový poloměr
    const out = { klic, jmeno: t.jmeno, v: d, D, rUhel, zplosteni: t.r[1] / t.r[0], ...raDec(d) };
    out.obzor = naObzor(d, jd, misto, P);
    if (klic === 'slunce') { out.mag = jasnost('slunce', 1, D); out.k = 1; return out; }
    const s = p.kSlunci, r = len(s);
    const i = uhel(s, mul(geo, -1));          // fázový úhel
    out.r = r; out.fazovyUhel = i; out.k = (1 + cos(i)) / 2;
    out.kSlunci = unit(s);
    out.limbUhel = pozicniUhel(d, out.kSlunci);   // poziční úhel osvětleného okraje
    const rot = rotaceTelesa(klic, jde, klic === 'mesic' ? 0 : D * 0.0057755183);
    let B = 0;
    if (rot) {
      out.rot = rot;
      // sub-pozemský bod: šířka De a délka
      const ob = mxv(rot.M, mul(d, -1));
      out.De = Math.asin(ob[2]) * DEG;
      out.cm = norm(Math.atan2(ob[1], ob[0]) * DEG);   // planetocentrická (východní) délka středu disku
      out.P = pozicniUhel(d, rot.pol);                     // poziční úhel osy
      const sb = mxv(rot.M, out.kSlunci);
      out.Ds = Math.asin(sb[2]) * DEG;
      B = out.De;
    }
    out.mag = jasnost(klic, r, D, i, B);
    if (klic === 'jupiter') out.mesice = galileovyMesice(jde, out.De).map(m => ({ ...m, mag: m.mag0 + 5 * Math.log10(r * D) }));
    if (klic === 'saturn') out.B = B;
    return out;
  }
  const KLICE_TELES = ['mesic', 'merkur', 'venuse', 'mars', 'jupiter', 'saturn', 'uran', 'neptun'];

  /* ---------------- optika ---------------- */
  // dalekohled {D mm, F mm, typ, obstrukce (0–1)}, okulár {f mm, afov °}, barlow
  function optika(dal, ok, barlow = 1) {
    const Fe = dal.F * barlow;
    const M = dal.pevneZvetseni || Fe / ok.f;
    const pupila = dal.D / M;
    // skutečné zorné pole (°): z clony okuláru, je-li známa, jinak ze zdánlivého pole
    const pole = dal.pevnePole || (ok.clona ? ok.clona / Fe * DEG : ok.afov / M);
    return {
      M, pupila, pole, afov: dal.pevnePole ? dal.pevnePole * M : ok.afov,
      svetelnost: dal.F / dal.D,
      dawes: 116 / dal.D,                          // ″
      rayleigh: 138 / dal.D,                       // ″, poloměr 1. tmavého kroužku Airyho disku (550 nm)
      maxZvetseni: 2 * dal.D,
      minZvetseni: dal.D / 7,
      sbirani: (dal.D / 7) ** 2 * (1 - (dal.obstrukce || 0) ** 2),
    };
  }

  /* ---------------- obloha: jas a mezní hvězdná velikost ---------------- */
  const BORTLE = [null, 22.0, 21.9, 21.7, 21.3, 20.6, 19.5, 18.9, 18.4, 17.8];   // mag/″² v zenitu
  // jas oblohy (mag/″²) od Slunce pod obzorem: soumrak → den
  function jasSoumraku(hSlunce) {
    const T = [[-18, 23.5], [-15, 21.5], [-12, 19.2], [-9, 16.2], [-6, 12.6], [-3, 9.8], [0, 7.4], [5, 5.6], [15, 4.6], [40, 4.0], [90, 3.8]];
    if (hSlunce <= T[0][0]) return 30;
    for (let i = 1; i < T.length; i++) if (hSlunce <= T[i][0]) {
      const [a, ma] = T[i - 1], [b, mb] = T[i];
      return ma + (mb - ma) * (hSlunce - a) / (b - a);
    }
    return 3.8;
  }
  const slozMag = (...m) => -2.5 * Math.log10(m.reduce((s, x) => s + 10 ** (-0.4 * x), 0));
  // jas oblohy v daném směru; podm {bortle, hSlunce, mesic: {alt, k, uhel} }
  function jasOblohy(podm, altCil) {
    const vzd = 1 / Math.max(0.08, Math.sin(Math.max(1, altCil) * RAD));
    let sb = BORTLE[podm.bortle] - 0.35 * Math.min(4, vzd - 1);      // u obzoru světlejší (vzdušná hmota, světelné kopule)
    const slozky = [sb, jasSoumraku(podm.hSlunce)];
    if (podm.mesic && podm.mesic.alt > -1) {
      const m = podm.mesic;
      // rozptyl měsíčního světla (hrubě dle Krisciunas & Schaefer 1991): úplněk ≈ 18,5–19 mag/″²
      const faze = Math.max(1e-3, m.k) ** 1.6;
      const blizko = 1 + 6 * Math.exp(-m.uhel / 12);
      const vys = Math.min(1, Math.sin(Math.max(2, m.alt) * RAD) * 1.5);
      slozky.push(19.2 - 2.5 * Math.log10(faze * blizko * vys));
    }
    return slozMag(...slozky);
  }
  // mezní velikost okem (bez dalekohledu) z jasu oblohy (aproximace podle Schaefera, platí pro noční vidění;
  // pro denní oblohu je jas omezený, aby výsledek odpovídal zkušenosti – Venuše je vidět i ve dne)
  function nelm(sb) {
    const s = Math.max(sb, 10.6);
    return 7.93 - 5 * Math.log10(10 ** (4.316 - s / 5) + 1);
  }
  // mezní hvězdná velikost v dalekohledu
  function mezniVelikost(o, dal, sb, alt, zornice = 7) {
    const prostupnost = dal.typ === 'refraktor' || dal.typ === 'triedr' || dal.typ === 'galileo' ? 0.9 : 0.8;
    let lm = nelm(sb) + 2.5 * Math.log10((dal.D / zornice) ** 2 * (1 - (dal.obstrukce || 0) ** 2) * prostupnost);
    // vyšší zvětšení ztmaví pozadí a slabé body vyniknou (do výstupní pupily ~0,5 mm)
    const zisk = Math.log10(Math.max(1, Math.min(14, zornice / Math.max(0.5, o.pupila))));
    lm += 1.6 * zisk;
    // extinkce: 0,25 mag na vzdušnou hmotu nad 1
    const X = 1 / Math.max(0.05, Math.sin(Math.max(0.5, alt) * RAD) + 0.025 * Math.exp(-11 * Math.sin(Math.max(0.5, alt) * RAD)));
    lm -= 0.25 * (X - 1);
    return Math.min(lm, 17.5);
  }
  // jas pozadí v okuláru (mag/″² zdánlivě): menší výstupní pupila než zornice pozadí ztmaví
  function jasPozadi(sb, o, zornice = 7) {
    return sb + 5 * Math.log10(Math.max(1, zornice / o.pupila));
  }
  function vzdusnaHmota(alt) {
    const h = Math.max(0.5, alt);
    return 1 / (Math.sin(h * RAD) + 0.025 * Math.exp(-11 * Math.sin(h * RAD)));
  }

  /* ---------------- generované slabé hvězdy (doplněk katalogu) ---------------- */
  // počet hvězd jasnějších než m na čtvereční stupeň (průměr oblohy, Allen)
  const NHV = [[6, -0.92], [7, -0.44], [8, 0.0], [9, 0.44], [10, 0.87], [11, 1.28], [12, 1.67], [13, 2.05], [14, 2.42], [15, 2.77], [16, 3.1], [17, 3.4], [18, 3.68]];
  function pocetDo(m) {
    if (m <= NHV[0][0]) return 10 ** NHV[0][1];
    for (let i = 1; i < NHV.length; i++) if (m <= NHV[i][0]) {
      const [a, la] = NHV[i - 1], [b, lb] = NHV[i];
      return 10 ** (la + (lb - la) * (m - a) / (b - a));
    }
    return 10 ** NHV[NHV.length - 1][1];
  }
  // galaktická šířka/délka z J2000 vektoru
  const GAL = (() => {
    // matice ICRS → galaktické (Hipparcos)
    return [-0.0548755604, -0.8734370902, -0.4838350155, 0.4941094279, -0.4448296300, 0.7469822445, -0.8676661490, -0.1980763734, 0.4559837762];
  })();
  function galakticke(v) {
    const g = mxv(GAL, v);
    return { l: norm(Math.atan2(g[1], g[0]) * DEG), b: Math.asin(Math.max(-1, Math.min(1, g[2]))) * DEG };
  }
  function hustotaFaktor(b, l, m) {
    const A = 0.6 + 0.55 * Math.max(0, m - 6);           // u slabších hvězd silnější soustředění k Mléčné dráze
    const sigma = 14;
    const stred = 1 + 0.8 * Math.exp(-((((l + 180) % 360 - 180) / 50) ** 2));
    return (1 + A * Math.exp(-Math.abs(b) / sigma) * stred) / (1 + A * 0.25 * 1.15);
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashCislo(...c) {
    let h = 2166136261;
    for (const x of c) { h ^= x & 0xffffffff; h = Math.imul(h, 16777619); h ^= h >>> 13; }
    return h >>> 0;
  }
  function poisson(lam, rnd) {
    if (lam > 40) return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss(rnd)));
    const L = Math.exp(-lam); let k = 0, p = 1;
    do { k++; p *= rnd(); } while (p > L);
    return k - 1;
  }
  function gauss(rnd) { return Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd()); }
  const BUNKA = 0.5;     // stupně
  const cacheBunek = new Map();
  // hvězdy v buňce (iRa, iDec) a magnitudovém pásu [m, m+1)
  function hvezdyBunky(iDec, iRa, pas) {
    const klic = iDec + ':' + iRa + ':' + pas;
    let r = cacheBunek.get(klic);
    if (r) return r;
    const dec0 = -90 + iDec * BUNKA, dec1 = dec0 + BUNKA;
    const nRa = Math.max(1, Math.round(360 * Math.cos((dec0 + BUNKA / 2) * RAD) / BUNKA));
    const ra0 = iRa * 360 / nRa, ra1 = ra0 + 360 / nRa;
    const plocha = (360 / nRa) * DEG * (Math.sin(dec1 * RAD) - Math.sin(dec0 * RAD));
    const vc = v3((ra0 + ra1) / 2, (dec0 + dec1) / 2);
    const g = galakticke(vc);
    const m0 = 6.6 + pas, m1 = m0 + 1;
    const lam = (pocetDo(m1) - pocetDo(m0)) * plocha * hustotaFaktor(g.b, g.l, m0 + 0.5);
    const rnd = mulberry(hashCislo(iDec, iRa, pas, 77));
    const n = poisson(lam, rnd);
    r = [];
    const s0 = Math.sin(dec0 * RAD), s1 = Math.sin(dec1 * RAD);
    for (let i = 0; i < n; i++) {
      const ra = ra0 + rnd() * (ra1 - ra0);
      const dec = Math.asin(s0 + rnd() * (s1 - s0)) * DEG;
      // rozdělení uvnitř pásu podle sklonu počtů (víc slabších)
      const u = rnd();
      const m = m0 + Math.log10(1 + u * (10 ** 0.4 - 1)) / 0.4;
      const bv = Math.max(-0.2, Math.min(1.9, 0.75 + 0.45 * gauss(rnd)));
      r.push(v3(ra, dec).concat([m, bv]));
    }
    if (cacheBunek.size > 60000) cacheBunek.clear();
    cacheBunek.set(klic, r);
    return r;
  }
  // všechny generované hvězdy do mezní velikosti lm v kruhu o poloměru polomer (°) kolem směru c
  function slabeHvezdy(c, polomer, lm) {
    const rd = raDec(c);
    const out = [];
    const pasu = Math.min(11, Math.ceil(lm + 0.5 - 6.6));
    if (pasu <= 0) return out;
    const r = polomer + 0.2;
    const iDec0 = Math.max(0, Math.floor((rd.dec - r + 90) / BUNKA)), iDec1 = Math.min(Math.round(180 / BUNKA) - 1, Math.floor((rd.dec + r + 90) / BUNKA));
    const cosR = Math.cos(r * RAD);
    for (let iDec = iDec0; iDec <= iDec1; iDec++) {
      const dec0 = -90 + iDec * BUNKA;
      const nRa = Math.max(1, Math.round(360 * Math.cos((dec0 + BUNKA / 2) * RAD) / BUNKA));
      const sirka = 360 / nRa;
      const cd = Math.max(0.02, Math.min(Math.cos(dec0 * RAD), Math.cos((dec0 + BUNKA) * RAD)));
      const dra = Math.abs(rd.dec) + r > 89 ? 180 : Math.min(180, r / cd + sirka);
      const i0 = Math.floor((rd.ra - dra) / sirka), i1 = Math.floor((rd.ra + dra) / sirka);
      const videno = new Set();
      for (let ii = i0; ii <= i1; ii++) {
        const iRa = ((ii % nRa) + nRa) % nRa;
        if (videno.has(iRa)) continue; videno.add(iRa);
        for (let p = 0; p < pasu; p++) for (const h of hvezdyBunky(iDec, iRa, p)) {
          if (h[3] > lm + 0.5) continue;
          if (h[0] * c[0] + h[1] * c[1] + h[2] * c[2] < cosR) continue;
          out.push(h);
        }
      }
    }
    return out;
  }

  /* ---------------- barva hvězdy z B−V ---------------- */
  function barvaBV(bv) {
    // teplota (Ballesteros 2012) → přibližné sRGB černého tělesa
    const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
    const t = T / 100;
    let r, g, b;
    if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
    else { r = 329.7 * (t - 60) ** -0.1332; g = 288.12 * (t - 60) ** -0.0755; b = 255; }
    const c = x => Math.max(0, Math.min(255, Math.round(x)));
    return [c(r), c(g), c(b)];
  }

  /* ---------------- rozmazání obrazu ---------------- */
  // FWHM v ″: seeing + difrakce (Airy ~1,03 λ/D) + rozostření
  function rozmazani(dal, seeing, rozostreni = 0) {
    const dif = 1.03 * 0.55e-3 / dal.D * 206265;
    return Math.sqrt(seeing * seeing + dif * dif + rozostreni * rozostreni);
  }
  // atmosférická disperze mezi 450 a 650 nm (″) – přibližně 1,1″·tan z
  function disperze(alt) { return 1.1 * Math.tan((90 - Math.max(3, alt)) * RAD); }

  /* ---------------- východ a západ ---------------- */
  // najde nejbližší časy přechodu výšky h0 (°) v intervalu ±12 h; fce(jd) vrací výšku
  function prechody(fce, jd0, h0 = 0) {
    const kroky = 96, dt = 1 / kroky;
    let pred = fce(jd0 - 0.5) - h0, vych = null, zap = null, maxH = -99, maxT = null;
    for (let i = 1; i <= kroky; i++) {
      const t = jd0 - 0.5 + i * dt, h = fce(t) - h0;
      if (h + h0 > maxH) { maxH = h + h0; maxT = t; }
      if ((pred < 0) !== (h < 0)) {
        let a = t - dt, b = t, fa = pred;
        for (let k = 0; k < 20; k++) { const m = (a + b) / 2, fm = fce(m) - h0; if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m; }
        const tt = (a + b) / 2;
        if (pred < 0) { if (vych === null || Math.abs(tt - jd0) < Math.abs(vych - jd0)) vych = tt; }
        else if (zap === null || Math.abs(tt - jd0) < Math.abs(zap - jd0)) zap = tt;
      }
      pred = h;
    }
    return { vychod: vych, zapad: zap, kulminace: maxT, maxVyska: maxH };
  }


  /* ---------------- souhvězdí (hranice d3-celestial, paprsek po poledníku k severu) ---------------- */
  let HRANICE = null;
  function souhvezdi(v) {
    if (!HRANICE) {
      const data = koren.DALEK_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
      HRANICE = data ? data.HRANICE : {};
    }
    const { ra, dec } = raDec(v);
    const wrap = x => { let d = ((x - ra) % 360 + 540) % 360 - 180; return d; };
    for (const [id, polys] of Object.entries(HRANICE)) {
      let n = 0;
      for (const ring of polys) {
        // prstenec kolem severního pólu: paprsek k severu pól „opustí“ ⇒ obrácená parita
        let vinuti = 0;
        for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; vinuti += ((b[0] - a[0]) % 360 + 540) % 360 - 180; }
        if (Math.abs(vinuti) > 180 && ring.reduce((x, p) => x + p[1], 0) > 0) n++;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          const la = wrap(a[0]), lb = wrap(b[0]);
          if (Math.abs(la - lb) > 180) continue;            // hrana přes protilehlý poledník
          if ((la > 0) === (lb > 0)) continue;
          const t = la / (la - lb), d = a[1] + t * (b[1] - a[1]);
          if (d > dec) n++;
        }
      }
      if (n % 2) return id.replace(/\d$/, '');
    }
    return '';
  }

  /* ---------------- viditelnost plošného objektu ---------------- */
  // o = [id, α, δ, typ, mag, a′, b′, …]; sbOkPozadi = jas pozadí v okuláru (mag/″²), posun(sb) = ztmavení okulárem
  // vrací {vis 0–1, C kontrast, sb povrchový jas}
  function viditelnostDSO(o, M, sbOkPozadi, posun, extinkce = 0, filtr = null) {
    const plocha = Math.PI / 4 * o[5] * o[6] * 3600;
    const typ = o[3];
    let sbObj = o[4] + 2.5 * Math.log10(Math.max(1, plocha)) - (typ === 'gc' ? 1.2 : typ === 'pn' ? 0.3 : 1.0);
    if (filtr) sbObj += (typ === 'pn' || typ === 'sfr' || typ === 'snr') ? filtr.emisni : filtr.hvezdy;
    const sbOk = posun(sbObj) + 0.25 * extinkce;
    const C = 10 ** (-0.4 * (sbOk - sbOkPozadi));
    const velikost = o[5] * M;
    const Cth = 0.025 * (1 + 25 / Math.max(1, velikost)) * 10 ** (0.12 * Math.max(0, sbOkPozadi - 21));
    const vis = Math.max(0, Math.min(1, Math.log10(C / Cth) / 1.3));
    return { vis, C, sb: sbObj };
  }

  /* ---------------- Galileovy měsíce: geometrie vůči disku ---------------- */
  // vrací polohy v soustavě oblohy (x západ, y sever, z k Zemi) v poloměrech Jupiteru + stavy
  function kouleProsek(p, d, viditelny) {
    const b = 2 * (p[0] * d[0] + p[1] * d[1] + p[2] * d[2]);
    const c = p[0] * p[0] + p[1] * p[1] + p[2] * p[2] - 1;
    const disc = b * b - 4 * c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / 2;
    if (t <= 0) return null;
    const q = [p[0] + t * d[0], p[1] + t * d[1], p[2] + t * d[2]];
    if (viditelny && q[2] < 0) return null;
    return q;
  }
  function mesiceJupiteru(t) {
    const P = t.P * RAD;
    const uW = [Math.cos(P), Math.sin(P)], uN = [-Math.sin(P), Math.cos(P)];
    const b = baze(t.v);
    const s = [dot(t.kSlunci, b.x), dot(t.kSlunci, b.y), dot(t.kSlunci, b.z)];
    return t.mesice.map(m => {
      const x = m.X * uW[0] + m.Y * uN[0], y = m.X * uW[1] + m.Y * uN[1], z = m.Z;
      const naDisku = x * x + (y / 0.935) ** 2 < 1;
      // stín se počítá na kouli zploštělou převodem y → y/0.935
      const p = [x, y / 0.935, z];
      const zat = kouleProsek(p, s);
      const st = kouleProsek(p, [-s[0], -s[1], -s[2]], true);
      return { ...m, x, y, z, prechod: z > 0 && naDisku, zakryt: z < 0 && naDisku, zatmeni: !!zat, stin: st ? [st[0], st[1] * 0.935, st[2]] : null };
    });
  }
  const STAVY_MESICU = [
    ['prechod', 'přechod přes disk'], ['stin', 'stín na disku'], ['zakryt', 'zákryt planetou'], ['zatmeni', 'zatmění ve stínu planety'],
  ];
  // úkazy Galileových měsíců v intervalu [jd0, jd1] (UT); přesnost Meeusovy metody ~ minuty
  function ukazyJupiteru(jd0, jd1, misto, krok = 2 / 1440) {
    const stav = jd => {
      const t = teleso('jupiter', jd, misto);
      return mesiceJupiteru(t).map(m => ({ jmeno: m.jmeno, prechod: m.prechod, stin: !!m.stin, zakryt: m.zakryt, zatmeni: m.zatmeni }));
    };
    const out = [];
    let pred = stav(jd0);
    for (let jd = jd0 + krok; jd <= jd1 + 1e-9; jd += krok) {
      const ted = stav(jd);
      for (let i = 0; i < 4; i++) for (const [k, popis] of STAVY_MESICU) {
        if (pred[i][k] === ted[i][k]) continue;
        // zpřesnění bisekcí
        let a = jd - krok, b = jd;
        const va = pred[i][k];
        for (let n = 0; n < 9; n++) { const m = (a + b) / 2; if (stav(m)[i][k] === va) a = m; else b = m; }
        out.push({ jd: (a + b) / 2, mesic: ted[i].jmeno, druh: k, zacatek: !va, popis: (va ? 'konec: ' : 'začátek: ') + popis });
      }
      pred = ted;
    }
    return out;
  }
  // průchody bodu o délce L (Systém II, západní) centrálním poledníkem Jupiteru
  function cmII(jd, misto) { const t = teleso('jupiter', jd, misto); return norm(360 - t.cm); }
  function pruchodyGRS(jd0, jd1, L, misto) {
    const out = [];
    const f = jd => { let d = cmII(jd, misto) - L; d = ((d + 540) % 360) - 180; return d; };
    let a = jd0, fa = f(a);
    const krok = 0.02;
    for (let b = jd0 + krok; b <= jd1 + krok; b += krok) {
      const fb = f(b);
      if (fa < 0 && fb >= 0 && fb - fa < 90) {
        let x0 = a, x1 = b;
        for (let n = 0; n < 25; n++) { const m = (x0 + x1) / 2; if (f(m) < 0) x0 = m; else x1 = m; }
        if ((x0 + x1) / 2 <= jd1) out.push((x0 + x1) / 2);
      }
      a = b; fa = fb;
    }
    return out;
  }

  /* ---------------- Měsíc: stáří, kolongituda ---------------- */
  function infoMesice(jd, misto) {
    const t = teleso('mesic', jd, misto);
    const sb = mxv(t.rot.M, t.kSlunci);
    const l0 = Math.atan2(sb[1], sb[0]) * DEG;
    const kolong = norm(90 - l0);
    // stáří: čas od posledního novu (fáze z elongace)
    const s = teleso('slunce', jd, misto);
    const elong = uhel(t.v, s.v);
    const roste = (() => { const t2 = teleso('mesic', jd + 0.05, misto); return uhel(t2.v, teleso('slunce', jd + 0.05, misto).v) > elong; })();
    const stari = (roste ? elong : 360 - elong) / 360 * 29.530589;
    return { kolongituda: kolong, stari, roste, k: t.k, librL: ((t.cm + 180) % 360) - 180, librB: t.De };
  }

  /* ---------------- soumraky a noc ---------------- */
  // vrátí časy (UT jd) západu/východu Slunce a konců soumraků pro noc začínající v den jd (místní poledne → poledne)
  function noc(jdPoledne, misto) {
    const h = jd => teleso('slunce', jd, misto).obzor.alt;
    const najdi = (h0, klesa) => {
      let a = jdPoledne, fa = h(a) - h0;
      for (let b = jdPoledne + 1 / 48; b <= jdPoledne + 1.0001; b += 1 / 48) {
        const fb = h(b) - h0;
        if (klesa ? (fa > 0 && fb <= 0) : (fa < 0 && fb >= 0)) {
          let x0 = a, x1 = b;
          for (let n = 0; n < 20; n++) { const m = (x0 + x1) / 2; if ((h(m) - h0 > 0) === klesa) x0 = m; else x1 = m; }
          return (x0 + x1) / 2;
        }
        a = b; fa = fb;
      }
      return null;
    };
    return {
      zapad: najdi(-0.833, true), obcanskyKonec: najdi(-6, true), nautickyKonec: najdi(-12, true), astroKonec: najdi(-18, true),
      astroZacatek: najdi(-18, false), nautickyZacatek: najdi(-12, false), obcanskyZacatek: najdi(-6, false), vychod: najdi(-0.833, false),
    };
  }
  // místní poledne (UT jd) přibližně pro den obsahující jd
  function poledne(jd, misto) { return Math.floor(jd - 0.5 + misto.lon / 360) + 0.5 - misto.lon / 360 + 0.5; }

  /* ---------------- astrofotografie ---------------- */
  function astrofoto(kam, F, D, seeing, dec, sledovani) {
    const meritko = 206.265 * kam.pixel / F;                 // ″/px
    const poleW = 2 * Math.atan(kam.sirka / 2 / F) * DEG, poleH = 2 * Math.atan(kam.vyska / 2 / F) * DEG;
    const vzorkovani = seeing / meritko;                      // px na FWHM
    // bez sledování: posun o 1 px
    const tMax = meritko / (15.041 * Math.max(0.02, Math.cos(dec * RAD)));
    const tNpf = (35 * (F / D) + 30 * kam.pixel) / (F) * 1;     // NPF (Starry Landscape Stacker) – sekundy
    return { meritko, poleW, poleH, vzorkovani, tMax, tNpf, svetelnost: F / D,
      doporuceni: vzorkovani < 1.5 ? 'podvzorkováno (hvězdy hranaté) – delší ohnisko nebo menší pixely' : vzorkovani > 4 ? 'převzorkováno – pomůže binning ' + Math.min(4, Math.floor(vzorkovani / 2)) + '×' + Math.min(4, Math.floor(vzorkovani / 2)) + ' nebo reduktor' : 'vzorkování odpovídá seeingu',
      sledovani };
  }

  const API = {
    RAD, DEG, AU, v3, dot, sub, add, mul, len, unit, cross, raDec, uhel, mxv, mtxv, precese, eklNaRov,
    naObzor, zObzoru, refrakceStupne, pozorovatel, TELESA, KLICE_TELES, teleso, rotaceTelesa, polohaPlanety,
    galileovyMesice, pozicniUhel, baze, jasnost, optika, BORTLE, jasSoumraku, jasOblohy, nelm, mezniVelikost,
    jasPozadi, vzdusnaHmota, pocetDo, galakticke, slabeHvezdy, hvezdyBunky, mulberry, hashCislo, gauss,
    barvaBV, rozmazani, disperze, prechody, slozMag, souhvezdi, viditelnostDSO, mesiceJupiteru, ukazyJupiteru,
    cmII, pruchodyGRS, infoMesice, noc, poledne, astrofoto, kouleProsek,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.DALEK = API;
})(typeof window !== 'undefined' ? window : globalThis);
