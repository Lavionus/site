/* ============================================================
   astro.js – výpočty pro „Astronomický kalendář úkazů“
   (obsah/sky_events.html). Bez závislostí, běží v prohlížeči
   i v node (testy _test/sky_events_test.js).

   Zdroje algoritmů:
   - J. Meeus: Astronomical Algorithms, 2. vyd. (1998)
       kap. 12 hvězdný čas, 22 nutace (zkrácená), 25 Slunce,
       27 rovnodennosti a slunovraty, 40 paralaxa, 47 poloha Měsíce,
       49 fáze Měsíce, 54 zatmění
   - E. M. Standish (JPL): Keplerian Elements for Approximate
       Positions of the Major Planets, tabulka 1 (platí 1800–2050)
   - IMO Working List of Visual Meteor Showers (λ☉ maxim, ZHR)

   Časy: výpočty běží v dynamickém čase (JDE, TT), výstupy jsou
   převedeny na UT pomocí přibližného ΔT.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const sin = x => Math.sin(x * RAD), cos = x => Math.cos(x * RAD);
  const norm = x => ((x % 360) + 360) % 360;
  const norm180 = x => { const n = norm(x); return n > 180 ? n - 360 : n; };

  /* ---------------- čas ---------------- */
  const jdZData = d => d.getTime() / 86400000 + 2440587.5;
  const dataZJd = jd => new Date(Math.round((jd - 2440587.5) * 86400000));
  // ΔT = TT − UT v sekundách (Espenak & Meeus; pro 2015–2035 skutečné hodnoty ~68–70 s)
  function deltaT(rok) {
    if (rok >= 2015 && rok <= 2035) return 69.2 + (rok - 2026) * 0.05;
    if (rok >= 2005 && rok < 2050) { const t = rok - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    if (rok >= 1986 && rok < 2005) { const t = rok - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
    const u = (rok - 1820) / 100; return -20 + 32 * u * u;
  }
  const rokZJd = jd => 2000 + (jd - 2451545) / 365.25;
  const jdeNaUt = jde => jde - deltaT(rokZJd(jde)) / 86400;
  const utNaJde = jd => jd + deltaT(rokZJd(jd)) / 86400;
  const jdeNaDatum = jde => dataZJd(jdeNaUt(jde));

  /* ---------------- nutace a sklon ekliptiky (zkráceně, ±0,5") ---------------- */
  function nutace(jde) {
    const T = (jde - 2451545) / 36525;
    const om = 125.04452 - 1934.136261 * T, L = 280.4665 + 36000.7698 * T, Lm = 218.3165 + 481267.8813 * T;
    const dpsi = (-17.2 * sin(om) - 1.32 * sin(2 * L) - 0.23 * sin(2 * Lm) + 0.21 * sin(2 * om)) / 3600;
    const deps = (9.2 * cos(om) + 0.57 * cos(2 * L) + 0.1 * cos(2 * Lm) - 0.09 * cos(2 * om)) / 3600;
    const eps0 = 23.43929111 - (46.815 * T + 0.00059 * T * T - 0.001813 * T ** 3) / 3600;
    return { dpsi, deps, eps: eps0 + deps };
  }
  function eklNaRovnik(lon, lat, eps) {
    const ra = Math.atan2(sin(lon) * cos(eps) - Math.tan(lat * RAD) * sin(eps), cos(lon)) * DEG;
    const dec = Math.asin(sin(lat) * cos(eps) + cos(lat) * sin(eps) * sin(lon)) * DEG;
    return { ra: norm(ra), dec };
  }
  // zdánlivý hvězdný čas v Greenwichi (stupně), jd v UT
  function gast(jd) {
    const T = (jd - 2451545) / 36525;
    const g = 280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - T ** 3 / 38710000;
    const n = nutace(utNaJde(jd));
    return norm(g + n.dpsi * cos(n.eps));
  }

  /* ---------------- Slunce (Meeus 25, přesnost ~0,01°) ---------------- */
  function slunce(jde) {
    const T = (jde - 2451545) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
    const prava = L0 + C, v = M + C;
    const R = 1.000001018 * (1 - e * e) / (1 + e * cos(v));
    const om = 125.04 - 1934.136 * T;
    const n = nutace(jde);
    const lon = norm(prava - 0.00569 - 0.00478 * sin(om));       // zdánlivá délka, rovnodennost data
    const rv = eklNaRovnik(lon, 0, n.eps + 0.00256 * cos(om));
    // délka vztažená k J2000 (pro meteorické roje a planety): odečíst precesi
    const lonJ2000 = norm(prava - 1.397 * T - 0.00569);
    return { lon, lonJ2000, R, ra: rv.ra, dec: rv.dec };
  }

  /* ---------------- Měsíc (Meeus 47, plné tabulky) ---------------- */
  // D, M, M', F, Σl [1e-6°], Σr [1e-3 km]
  const MES_LR = [
    [0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],[0,0,2,0,213618,-569925],
    [0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],[2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],
    [2,0,1,0,53322,-170733],[2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],
    [0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],[0,0,1,-2,10980,79661],
    [4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],[4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],
    [2,1,0,0,-6766,30824],[1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],
    [2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],[0,1,-2,0,-2689,-7003],
    [2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],[1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],
    [0,1,2,0,-2120,5751],[0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],
    [2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],[3,0,-1,0,-892,3258],
    [2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],[0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354],
    [2,1,-2,0,691,0],[2,-1,0,-2,596,0],[4,0,1,0,549,-1423],[0,0,4,0,537,-1117],
    [4,-1,0,0,520,-1571],[1,0,-2,0,-487,-1739],[2,1,0,-2,-399,0],[0,0,2,-2,-381,-4421],
    [1,1,1,0,351,0],[3,0,-2,0,-340,0],[4,0,-3,0,330,0],[2,-1,2,0,327,0],
    [0,2,1,0,-323,1165],[1,1,-1,0,299,0],[2,0,3,0,294,0],[2,0,-1,-2,0,8752],
  ];
  // D, M, M', F, Σb [1e-6°]
  const MES_B = [
    [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],
    [2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],
    [2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],
    [4,0,-1,-1,1828],[0,1,0,1,-1794],[0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],
    [0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],[4,0,0,-1,1021],[4,0,-1,1,833],
    [0,0,1,-3,777],[4,0,-2,1,671],[2,0,0,-3,607],[2,0,2,-1,596],[2,-1,1,-1,491],[2,0,-2,1,-451],
    [0,0,3,-1,439],[2,0,2,1,422],[2,0,-3,-1,421],[2,1,-1,1,-366],[2,1,0,1,-351],[4,0,0,1,331],
    [2,-1,1,1,315],[2,-2,0,-1,302],[0,0,1,3,-283],[2,1,1,-1,-229],[1,1,0,-1,223],[1,1,0,1,223],
    [0,1,-2,-1,-220],[2,1,-1,-1,-220],[1,0,1,1,-185],[2,-1,-2,-1,181],[0,1,2,1,-177],[4,0,-2,-1,176],
    [4,-1,-1,-1,166],[1,0,1,-1,-164],[4,0,1,-1,132],[1,0,-1,-1,-119],[4,-1,0,-1,115],[2,-2,0,1,107],
  ];
  function mesic(jde) {
    const T = (jde - 2451545) / 36525;
    const Lp = norm(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T ** 3 / 538841 - T ** 4 / 65194000);
    const D = norm(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T ** 3 / 545868 - T ** 4 / 113065000);
    const M = norm(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T ** 3 / 24490000);
    const Mp = norm(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T ** 3 / 69699 - T ** 4 / 14712000);
    const F = norm(93.272095 + 483202.0175233 * T - 0.0036539 * T * T - T ** 3 / 3526000 + T ** 4 / 863310000);
    const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.29 * T, A3 = 313.45 + 481266.484 * T;
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    let sl = 0, sr = 0, sb = 0;
    for (const [d, m, mp, f, l, r] of MES_LR) {
      const arg = d * D + m * M + mp * Mp + f * F, k = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
      sl += l * k * sin(arg); sr += r * k * cos(arg);
    }
    for (const [d, m, mp, f, b] of MES_B) {
      const k = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
      sb += b * k * sin(d * D + m * M + mp * Mp + f * F);
    }
    sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
    sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);
    const lonGeom = norm(Lp + sl / 1e6), lat = sb / 1e6, dist = 385000.56 + sr / 1000;
    const n = nutace(jde);
    const lon = norm(lonGeom + n.dpsi);
    const rv = eklNaRovnik(lon, lat, n.eps);
    return { lon, lat, dist, ra: rv.ra, dec: rv.dec, lonJ2000: norm(lonGeom - 1.397 * T) };
  }

  /* ---------------- topocentrické souřadnice a výška nad obzorem ---------------- */
  const R_ZEME = 6378.14;
  // ra, dec [°], vzdálenost [km], jd v UT, místo {lat, lon (východ +), vyska [m]}
  function topo(ra, dec, distKm, jd, misto) {
    const fi = misto.lat, h = (misto.vyska || 0) / 1000;
    const u = Math.atan(0.99664719 * Math.tan(fi * RAD));
    const rs = 0.99664719 * Math.sin(u) + h / R_ZEME * sin(fi);
    const rc = Math.cos(u) + h / R_ZEME * cos(fi);
    const lst = gast(jd) + misto.lon;
    // geocentrický vektor tělesa a pozorovatele (km, rovníkové souřadnice)
    const x = distKm * cos(dec) * cos(ra), y = distKm * cos(dec) * sin(ra), z = distKm * sin(dec);
    const ox = R_ZEME * rc * cos(lst), oy = R_ZEME * rc * sin(lst), oz = R_ZEME * rs;
    const tx = x - ox, ty = y - oy, tz = z - oz;
    const d = Math.hypot(tx, ty, tz);
    const tra = norm(Math.atan2(ty, tx) * DEG), tdec = Math.asin(tz / d) * DEG;
    const H = lst - tra;
    const alt = Math.asin(sin(fi) * sin(tdec) + cos(fi) * cos(tdec) * cos(H)) * DEG;
    const az = norm(Math.atan2(sin(H), cos(H) * sin(fi) - Math.tan(tdec * RAD) * cos(fi)) * DEG + 180);
    return { ra: tra, dec: tdec, dist: d, alt, az };
  }
  const AU = 149597870.7;
  function sluncePoloha(jd, misto) { const s = slunce(utNaJde(jd)); return topo(s.ra, s.dec, s.R * AU, jd, misto); }
  function mesicPoloha(jd, misto) { const m = mesic(utNaJde(jd)); return topo(m.ra, m.dec, m.dist, jd, misto); }
  function uhel(ra1, dec1, ra2, dec2) {
    const c = sin(dec1) * sin(dec2) + cos(dec1) * cos(dec2) * cos(ra1 - ra2);
    // pro malé úhly přesněji přes haversin
    const h = Math.sin((dec2 - dec1) * RAD / 2) ** 2 + cos(dec1) * cos(dec2) * Math.sin((ra2 - ra1) * RAD / 2) ** 2;
    return c > 0.9999 ? 2 * Math.asin(Math.sqrt(h)) * DEG : Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
  }
  // osvětlená část Měsíce (0–1) z geocentrické elongace
  function osvetleniMesice(jde) {
    const s = slunce(jde), m = mesic(jde);
    const psi = Math.acos(cos(m.lat) * cos(m.lon - s.lon)) * DEG;
    const i = Math.atan2(s.R * AU * sin(psi), m.dist - s.R * AU * cos(psi)) * DEG;
    return { k: (1 + cos(i)) / 2, roste: norm(m.lon - s.lon) < 180 };
  }

  /* ---------------- fáze Měsíce (Meeus 49) ---------------- */
  function fazeMesice(k) {               // k celé = nov, +0,25 první čtvrť, +0,5 úplněk, +0,75 poslední čtvrť
    const T = k / 1236.85, E = 1 - 0.002516 * T - 0.0000074 * T * T;
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
    const M = 2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3;
    const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
    const F = 160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4;
    const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3;
    const faze = Math.round((k - Math.floor(k)) * 4) % 4;
    let c;
    if (faze === 0 || faze === 2) {
      const n = faze === 0;
      c = (n ? -0.4072 : -0.40614) * sin(Mp) + (n ? 0.17241 : 0.17302) * E * sin(M) + (n ? 0.01608 : 0.01614) * sin(2 * Mp)
        + (n ? 0.01039 : 0.01043) * sin(2 * F) + (n ? 0.00739 : 0.00734) * E * sin(Mp - M) - (n ? 0.00514 : 0.00515) * E * sin(Mp + M)
        + (n ? 0.00208 : 0.00209) * E * E * sin(2 * M) - 0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F)
        + 0.00056 * E * sin(2 * Mp + M) - 0.00042 * sin(3 * Mp) + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F)
        - 0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(Om) - 0.00007 * sin(Mp + 2 * M) + 0.00004 * sin(2 * Mp - 2 * F)
        + 0.00004 * sin(3 * M) + 0.00003 * sin(Mp + M - 2 * F) + 0.00003 * sin(2 * Mp + 2 * F) - 0.00003 * sin(Mp + M + 2 * F)
        + 0.00003 * sin(Mp - M + 2 * F) - 0.00002 * sin(Mp - M - 2 * F) - 0.00002 * sin(3 * Mp + M) + 0.00002 * sin(4 * Mp);
    } else {
      c = -0.62801 * sin(Mp) + 0.17172 * E * sin(M) - 0.01183 * E * sin(Mp + M) + 0.00862 * sin(2 * Mp) + 0.00804 * sin(2 * F)
        + 0.00454 * E * sin(Mp - M) + 0.00204 * E * E * sin(2 * M) - 0.0018 * sin(Mp - 2 * F) - 0.0007 * sin(Mp + 2 * F)
        - 0.0004 * sin(3 * Mp) - 0.00034 * E * sin(2 * Mp - M) + 0.00032 * E * sin(M + 2 * F) + 0.00032 * E * sin(M - 2 * F)
        - 0.00028 * E * E * sin(Mp + 2 * M) + 0.00027 * E * sin(2 * Mp + M) - 0.00017 * sin(Om) - 0.00005 * sin(Mp - M - 2 * F)
        + 0.00004 * sin(2 * Mp + 2 * F) - 0.00004 * sin(Mp + M + 2 * F) + 0.00004 * sin(Mp - 2 * M) + 0.00003 * sin(Mp + M - 2 * F)
        + 0.00003 * sin(3 * M) + 0.00002 * sin(2 * Mp - 2 * F) + 0.00002 * sin(Mp - M + 2 * F) - 0.00002 * sin(3 * Mp + M);
      const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
      c += faze === 1 ? W : -W;
    }
    const A = [
      [299.77 + 0.107408 * k - 0.009173 * T * T, 325], [251.88 + 0.016321 * k, 165], [251.83 + 26.651886 * k, 164],
      [349.42 + 36.412478 * k, 126], [84.66 + 18.206239 * k, 110], [141.74 + 53.303771 * k, 62], [207.14 + 2.453732 * k, 60],
      [154.84 + 7.30686 * k, 56], [34.52 + 27.261239 * k, 47], [207.19 + 0.121824 * k, 42], [291.34 + 1.844379 * k, 40],
      [161.72 + 24.198154 * k, 37], [239.56 + 25.513099 * k, 35], [331.55 + 3.592518 * k, 23],
    ];
    for (const [a, koef] of A) c += koef * 1e-6 * sin(a);
    return jde + c;
  }
  // všechny fáze, jejichž okamžik (UT) padne do roku
  function fazeVRoce(rok) {
    const zac = jdZData(new Date(Date.UTC(rok, 0, 1))), kon = jdZData(new Date(Date.UTC(rok + 1, 0, 1)));
    const k0 = Math.floor((rok - 2000) * 12.3685) - 2;
    const r = [];
    for (let k = k0; k < k0 + 16; k++) {
      for (let f = 0; f < 4; f++) {
        const jde = fazeMesice(k + f / 4), jd = jdeNaUt(jde);
        if (jd >= zac && jd < kon) r.push({ faze: f, k: k + f / 4, jde, datum: dataZJd(jd) });
      }
    }
    return r.sort((a, b) => a.jde - b.jde);
  }

  /* ---------------- rovnodennosti a slunovraty (Meeus 27) ---------------- */
  const ROVN_A = [485,203,199,182,156,136,77,74,70,58,52,50,45,44,29,18,17,16,14,12,12,12,9,8];
  const ROVN_B = [324.96,337.23,342.08,27.85,73.14,171.52,222.54,296.72,243.58,119.81,297.17,21.02,247.54,325.15,60.93,155.12,288.79,198.04,199.76,95.39,287.11,320.81,227.73,15.45];
  const ROVN_C = [1934.136,32964.467,20.186,445267.112,45036.886,22518.443,65928.934,3034.906,9037.513,33718.147,150.678,2281.226,29929.562,31555.956,4443.417,67555.328,4562.452,62894.029,31436.921,14577.848,31931.756,34777.259,1222.114,16859.074];
  function rovnodennost(rok, i) {       // i: 0 březen, 1 červen, 2 září, 3 prosinec
    const Y = (rok - 2000) / 1000;
    const P = [
      [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
      [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.0003],
      [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
      [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
    ][i];
    const jde0 = P[0] + P[1] * Y + P[2] * Y * Y + P[3] * Y ** 3 + P[4] * Y ** 4;
    const T = (jde0 - 2451545) / 36525;
    const W = 35999.373 * T - 2.47;
    const dl = 1 + 0.0334 * cos(W) + 0.0007 * cos(2 * W);
    let S = 0;
    for (let j = 0; j < 24; j++) S += ROVN_A[j] * cos(ROVN_B[j] + ROVN_C[j] * T);
    return jde0 + 0.00001 * S / dl;
  }

  /* ---------------- zatmění (Meeus 54) ---------------- */
  function zatmeni(k, mesicni) {
    const T = k / 1236.85, E = 1 - 0.002516 * T - 0.0000074 * T * T;
    const F = norm(160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4);
    // rychlé vyřazení (Meeus: |sin F| > 0,36); u Měsíce s rezervou kvůli okrajovým polostínovým zatměním
    if (Math.abs(sin(F)) > (mesicni ? 0.4 : 0.36)) return null;
    const M = 2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3;
    const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
    const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3;
    const F1 = F - 0.02665 * sin(Om), A1 = 299.77 + 0.107408 * k - 0.009173 * T * T;
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
    jde += (mesicni ? -0.4065 : -0.4075) * sin(Mp) + (mesicni ? 0.1727 : 0.1721) * E * sin(M) + 0.0161 * sin(2 * Mp)
      - 0.0097 * sin(2 * F1) + 0.0073 * E * sin(Mp - M) - 0.005 * E * sin(Mp + M) - 0.0023 * sin(Mp - 2 * F1)
      + 0.0021 * E * sin(2 * M) + 0.0012 * sin(Mp + 2 * F1) + 0.0006 * E * sin(2 * Mp + M) - 0.0004 * sin(3 * Mp)
      - 0.0003 * E * sin(M + 2 * F1) + 0.0003 * sin(A1) - 0.0002 * E * sin(M - 2 * F1) - 0.0002 * E * sin(2 * Mp - M) - 0.0002 * sin(Om);
    const P = 0.207 * E * sin(M) + 0.0024 * E * sin(2 * M) - 0.0392 * sin(Mp) + 0.0116 * sin(2 * Mp) - 0.0073 * E * sin(Mp + M)
      + 0.0067 * E * sin(Mp - M) + 0.0118 * sin(2 * F1);
    const Q = 5.2207 - 0.0048 * E * cos(M) + 0.002 * E * cos(2 * M) - 0.3299 * cos(Mp) - 0.006 * E * cos(Mp + M) + 0.0041 * E * cos(Mp - M);
    const W = Math.abs(cos(F1));
    const gama = (P * cos(F1) + Q * sin(F1)) * (1 - 0.0048 * W);
    const u = 0.0059 + 0.0046 * E * cos(M) - 0.0182 * cos(Mp) + 0.0004 * cos(2 * Mp) - 0.0005 * cos(M + Mp);
    const ag = Math.abs(gama);
    if (!mesicni) {
      if (ag > 1.5433 + u) return null;
      let typ, mag = null;
      if (ag < 0.9972) typ = u < 0 ? 'úplné' : u > 0.0047 ? 'prstencové' : (u < 0.00464 * Math.sqrt(1 - gama * gama) ? 'hybridní' : 'prstencové');
      else if (ag < 0.9972 + Math.abs(u)) typ = u < 0 ? 'úplné' : 'prstencové';   // necentrální
      else { typ = 'částečné'; mag = (1.5433 + u - ag) / (0.5461 + 2 * u); }
      return { jde, slunecni: true, typ, gama, u, mag };
    }
    // Meeus dává γ s přesností ~0,005 → kandidáty s rezervou ověří přesný výpočet stínu
    const pen = (1.5573 + u - ag) / 0.545;
    if (pen <= -0.05) return null;
    return zatmeniMesicePresne(jde);
  }
  /* Zatmění Měsíce přesněji: vzdálenost středu Měsíce od osy zemského stínu
     z plných řad pro Měsíc a Slunce; poloměry stínu podle Chauveneta
     (zvětšení o 2 % za atmosféru, stejně jako katalog NASA/Espenak). */
  function stin(jde) {
    const s = slunce(jde), m = mesic(jde);
    const pm = Math.asin(R_ZEME / m.dist) * DEG, ps = 8.794 / 3600 / s.R, ss = 959.63 / 3600 / s.R;
    const sm = Math.asin(1737.4 / m.dist) * DEG;
    const d = uhel(m.ra, m.dec, norm(s.ra + 180), -s.dec);
    return { d, sm, Ru: 1.02 * (0.99834 * pm - ss + ps), Rp: 1.02 * (0.99834 * pm + ss + ps) };
  }
  function zatmeniMesicePresne(jdeOdhad) {
    let lo = jdeOdhad - 0.25, hi = jdeOdhad + 0.25;
    for (let i = 0; i < 60; i++) { const a = lo + (hi - lo) * 0.382, b = lo + (hi - lo) * 0.618; if (stin(a).d < stin(b).d) hi = b; else lo = a; }
    const jde = (lo + hi) / 2, x = stin(jde);
    const magPen = (x.Rp + x.sm - x.d) / (2 * x.sm), mag = (x.Ru + x.sm - x.d) / (2 * x.sm);
    if (magPen <= 0) return null;
    // kontakty: d(t) = mez, hledáme na obě strany od maxima
    const kontakt = (mez, smer) => {
      if (x.d >= mez) return null;
      let a = jde, b = jde + smer * 0.25;
      for (let i = 0; i < 50; i++) { const c = (a + b) / 2; if (stin(c).d < mez) a = c; else b = c; }
      return Math.abs((a + b) / 2 - jde) * 1440;
    };
    const pul = mez => kontakt(mez, 1) ?? 0;
    return {
      jde, slunecni: false, magPen, mag,
      typ: mag >= 1 ? 'úplné' : mag > 0 ? 'částečné' : 'polostínové',
      pulTrvani: { pen: pul(x.Rp + x.sm), cast: pul(x.Ru + x.sm), upl: pul(x.Ru - x.sm) },   // minuty
    };
  }
  function zatmeniVRoce(rok) {
    const zac = jdZData(new Date(Date.UTC(rok, 0, 1))), kon = jdZData(new Date(Date.UTC(rok + 1, 0, 1)));
    const k0 = Math.floor((rok - 2000) * 12.3685) - 2, r = [];
    for (let k = k0; k < k0 + 16; k++) {
      for (const mes of [false, true]) {
        const z = zatmeni(k + (mes ? 0.5 : 0), mes);
        if (!z) continue;
        const jd = jdeNaUt(z.jde);
        if (jd >= zac && jd < kon) { z.datum = dataZJd(jd); r.push(z); }
      }
    }
    return r.sort((a, b) => a.jde - b.jde);
  }

  // plocha překryvu dvou kruhů / plocha Slunce
  function zakryti(rs, rm, d) {
    if (d >= rs + rm) return 0;
    if (d <= Math.abs(rm - rs)) return rm >= rs ? 1 : (rm * rm) / (rs * rs);
    const a1 = Math.acos((d * d + rs * rs - rm * rm) / (2 * d * rs)), a2 = Math.acos((d * d + rm * rm - rs * rs) / (2 * d * rm));
    const pl = rs * rs * (a1 - Math.sin(2 * a1) / 2) + rm * rm * (a2 - Math.sin(2 * a2) / 2);
    return pl / (Math.PI * rs * rs);
  }
  // průběh zatmění Slunce na místě: skenování po minutách kolem okamžiku největší fáze
  function mistniZatmeniSlunce(z, misto) {
    const jd0 = jdeNaUt(z.jde);
    const krok = 1 / 1440;
    let zac = null, kon = null, max = null, zacViditelne = null, konViditelne = null;
    for (let i = -300; i <= 300; i++) {
      const jd = jd0 + i * krok;
      const s = sluncePoloha(jd, misto), m = mesicPoloha(jd, misto);
      const rs = 959.63 / (s.dist / AU) / 3600, rm = Math.asin(1737.4 / m.dist) * DEG;
      const d = uhel(s.ra, s.dec, m.ra, m.dec);
      const mag = (rs + rm - d) / (2 * rs);
      if (mag <= 0) continue;
      if (zac === null) zac = jd;
      kon = jd;
      const nadObzorem = s.alt > -0.83;                // horní okraj Slunce nad obzorem (s refrakcí)
      if (nadObzorem) {
        if (zacViditelne === null) zacViditelne = jd;
        konViditelne = jd;
        if (!max || mag > max.mag) max = { jd, mag, zakryti: zakryti(rs, rm, d), vyska: s.alt, azimut: s.az };
      }
    }
    if (!max) return { viditelne: false, castecne: zac !== null };
    return {
      viditelne: true, mag: max.mag, zakryti: max.zakryti, vyskaSlunce: max.vyska, azimut: max.azimut,
      max: dataZJd(max.jd), zacatek: dataZJd(zac), konec: dataZJd(kon),
      zacatekViditelny: dataZJd(zacViditelne), konecViditelny: dataZJd(konViditelne),
      zapadBehem: konViditelne < kon - krok / 2, vychodBehem: zacViditelne > zac + krok / 2,
    };
  }
  // viditelnost zatmění Měsíce: Měsíc nad obzorem během jednotlivých fází
  function mistniZatmeniMesice(z, misto) {
    const jd0 = jdeNaUt(z.jde), p = z.pulTrvani;
    const kontakty = {
      P1: jd0 - p.pen / 1440, U1: p.cast ? jd0 - p.cast / 1440 : null, U2: p.upl ? jd0 - p.upl / 1440 : null,
      max: jd0, U3: p.upl ? jd0 + p.upl / 1440 : null, U4: p.cast ? jd0 + p.cast / 1440 : null, P4: jd0 + p.pen / 1440,
    };
    const vyska = jd => mesicPoloha(jd, misto).alt;
    const nad = jd => vyska(jd) > -0.3;
    // hlavní fáze = úplná, jinak částečná, jinak polostínová
    const [od, doo] = p.upl ? [kontakty.U2, kontakty.U3] : p.cast ? [kontakty.U1, kontakty.U4] : [kontakty.P1, kontakty.P4];
    let nadHlavni = 0, nadCelkem = 0, vzorku = 0, prvni = null, posledni = null, tma = 0;
    for (let jd = kontakty.P1; jd <= kontakty.P4 + 1e-9; jd += 2 / 1440) {
      vzorku++;
      if (nad(jd)) {
        nadCelkem++;
        if (prvni === null) prvni = jd;
        posledni = jd;
        if (jd >= od && jd <= doo) nadHlavni++;
        if (sluncePoloha(jd, misto).alt < -6) tma++;
      }
    }
    const hlavniVzorku = Math.max(1, Math.round((doo - od) * 720));
    let viditelnost;
    if (!nadCelkem) viditelnost = 'ne';
    else if (nadCelkem >= vzorku - 1) viditelnost = 'celé';
    else viditelnost = nadHlavni > 0 ? 'částečně' : 'jen polostín';
    const k = {}; for (const [n, v] of Object.entries(kontakty)) k[n] = v === null ? null : dataZJd(v);
    return {
      viditelnost, kontakty: k, vyskaVMaximu: vyska(jd0), hlavniVidetZ: nadHlavni / hlavniVzorku,
      mesicVychazi: prvni !== null && prvni > kontakty.P1 + 1e-6 ? dataZJd(prvni) : null,
      mesicZapada: posledni !== null && posledni < kontakty.P4 - 2 / 1440 ? dataZJd(posledni) : null,
      zaSoumraku: nadCelkem > 0 && tma < nadCelkem * 0.5,
    };
  }

  /* ---------------- planety (JPL, Keplerovy elementy, J2000 ekliptika) ---------------- */
  // a [au], e, I, L, ϖ (délka perihelu), Ω  + změny za století
  const PLANETY = {
    merkur: { jmeno: 'Merkur', el: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], d: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
    venuse: { jmeno: 'Venuše', el: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], d: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418] },
    zeme: { jmeno: 'Země', el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], d: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0] },
    mars: { jmeno: 'Mars', el: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], d: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
    jupiter: { jmeno: 'Jupiter', el: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], d: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
    saturn: { jmeno: 'Saturn', el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], d: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
    uran: { jmeno: 'Uran', el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503], d: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
    neptun: { jmeno: 'Neptun', el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], d: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] },
  };
  function helio(klic, jde) {
    const p = PLANETY[klic], T = (jde - 2451545) / 36525;
    const [a, e, I, L, w, O] = p.el.map((x, i) => x + p.d[i] * T);
    const om = w - O, M = norm180(L - w);
    let Ea = M + e * DEG * sin(M);                     // Keplerova rovnice (stupně)
    for (let i = 0; i < 8; i++) { const dM = M - (Ea - e * DEG * sin(Ea)); Ea += dM / (1 - e * cos(Ea)); }
    const xp = a * (cos(Ea) - e), yp = a * Math.sqrt(1 - e * e) * sin(Ea);
    const x = (cos(om) * cos(O) - sin(om) * sin(O) * cos(I)) * xp + (-sin(om) * cos(O) - cos(om) * sin(O) * cos(I)) * yp;
    const y = (cos(om) * sin(O) + sin(om) * cos(O) * cos(I)) * xp + (-sin(om) * sin(O) + cos(om) * cos(O) * cos(I)) * yp;
    const z = sin(om) * sin(I) * xp + cos(om) * sin(I) * yp;
    return { x, y, z };
  }
  // geocentrická poloha planety (J2000), s opravou o dobu letu světla
  function geoPlaneta(klic, jde) {
    const zem = helio('zeme', jde);
    let p = helio(klic, jde), d = 0;
    for (let i = 0; i < 2; i++) {
      d = Math.hypot(p.x - zem.x, p.y - zem.y, p.z - zem.z);
      p = helio(klic, jde - d * 0.0057755183);
    }
    const x = p.x - zem.x, y = p.y - zem.y, z = p.z - zem.z;
    d = Math.hypot(x, y, z);
    const lon = norm(Math.atan2(y, x) * DEG), lat = Math.asin(z / d) * DEG;
    const lonSl = norm(Math.atan2(-zem.y, -zem.x) * DEG);
    const elong = Math.acos(cos(lat) * cos(lon - lonSl)) * DEG;
    return { lon, lat, dist: d, lonSlunce: lonSl, elong, vychodne: norm(lon - lonSl) < 180, rSlunce: Math.hypot(p.x, p.y, p.z) };
  }

  // hledání kořene / extrému po dnech s upřesněním bisekcí
  function koreny(f, jde0, jde1, krok = 1) {
    const r = []; let a = jde0, fa = f(a);
    for (let b = jde0 + krok; b <= jde1 + krok; b += krok) {
      const fb = f(b);
      if (fa !== null && fb !== null && Math.sign(fa) !== Math.sign(fb) && Math.abs(fa - fb) < 180) {
        let lo = a, hi = b, flo = fa;
        for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, fm = f(m); if (Math.sign(fm) === Math.sign(flo)) { lo = m; flo = fm; } else hi = m; }
        r.push((lo + hi) / 2);
      }
      a = b; fa = fb;
    }
    return r;
  }
  function maxima(f, jde0, jde1, krok = 1) {
    const r = [];
    let a = f(jde0 - krok), b = f(jde0);
    for (let t = jde0; t <= jde1; t += krok) {
      const c = f(t + krok);
      if (b > a && b >= c) {
        let lo = t - krok, hi = t + krok;            // zlatý řez
        for (let i = 0; i < 50; i++) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (f(m1) < f(m2)) lo = m1; else hi = m2; }
        r.push((lo + hi) / 2);
      }
      a = b; b = c;
    }
    return r;
  }
  function rozsahRoku(rok) {
    return [utNaJde(jdZData(new Date(Date.UTC(rok, 0, 1)))), utNaJde(jdZData(new Date(Date.UTC(rok + 1, 0, 1))))];
  }

  const JASNE = ['merkur', 'venuse', 'mars', 'jupiter', 'saturn'];
  function planetyVRoce(rok) {
    const [z, k] = rozsahRoku(rok);
    const u = [];
    // opozice a konjunkce vnějších planet se Sluncem
    for (const p of ['mars', 'jupiter', 'saturn', 'uran', 'neptun']) {
      for (const jde of koreny(t => norm180(geoPlaneta(p, t).lon - geoPlaneta(p, t).lonSlunce - 180), z, k))
        u.push({ druh: 'opozice', planeta: p, jde, ...geoPlaneta(p, jde) });
      for (const jde of koreny(t => norm180(geoPlaneta(p, t).lon - geoPlaneta(p, t).lonSlunce), z, k))
        u.push({ druh: 'konjunkce-slunce', planeta: p, jde, ...geoPlaneta(p, jde) });
    }
    // Merkur a Venuše: dolní/horní konjunkce, největší elongace
    for (const p of ['merkur', 'venuse']) {
      for (const jde of koreny(t => norm180(geoPlaneta(p, t).lon - geoPlaneta(p, t).lonSlunce), z, k, 0.5)) {
        const g = geoPlaneta(p, jde);
        u.push({ druh: g.dist < 1 ? 'dolni-konjunkce' : 'horni-konjunkce', planeta: p, jde, ...g });
      }
      for (const jde of maxima(t => geoPlaneta(p, t).elong, z, k, 0.5))
        u.push({ druh: 'elongace', planeta: p, jde, ...geoPlaneta(p, jde) });
    }
    // vzájemné konjunkce jasných planet (v délce), jen užší než 6° a ne u Slunce
    for (let i = 0; i < JASNE.length; i++) for (let j = i + 1; j < JASNE.length; j++) {
      const a = JASNE[i], b = JASNE[j];
      for (const jde of koreny(t => norm180(geoPlaneta(a, t).lon - geoPlaneta(b, t).lon), z, k, 0.5)) {
        const ga = geoPlaneta(a, jde), gb = geoPlaneta(b, jde);
        const sep = uhel(ga.lon, ga.lat, gb.lon, gb.lat);
        if (sep < 6 && Math.min(ga.elong, gb.elong) > 12) u.push({ druh: 'konjunkce', planeta: a, planeta2: b, jde, sep, elong: ga.elong, vychodne: ga.vychodne });
      }
    }
    return u.filter(x => x.jde >= z && x.jde < k).map(x => ({ ...x, datum: jdeNaDatum(x.jde) })).sort((a, b) => a.jde - b.jde);
  }
  // Měsíc u jasných planet (konjunkce v délce J2000), jen těsnější než max°
  function mesicPlanetyVRoce(rok, max = 4) {
    const [z, k] = rozsahRoku(rok);
    const u = [];
    for (const p of JASNE) {
      const f = t => norm180(mesic(t).lonJ2000 - geoPlaneta(p, t).lon);
      for (const jde of koreny(f, z, k, 0.25)) {
        const m = mesic(jde), g = geoPlaneta(p, jde);
        const sep = Math.abs(m.lat - g.lat);
        if (sep <= max && g.elong > 15) u.push({ druh: 'mesic-planeta', planeta: p, jde, sep, sever: g.lat > m.lat, elong: g.elong, vychodne: g.vychodne, datum: jdeNaDatum(jde), k: osvetleniMesice(jde).k });
      }
    }
    return u.sort((a, b) => a.jde - b.jde);
  }

  /* ---------------- meteorické roje ---------------- */
  // IMO Working List (via Wikipedia „List of meteor showers“): λ☉ maxima (J2000), ZHR, rychlost [km/s]
  const ROJE = [
    { kod: 'QUA', nazev: 'Kvadrantidy', lambda: 283.15, zhr: 80, v: 41, aktivita: '28. 12. – 12. 1.', radiant: 'Pastýř (u Draka)', pozn: 'krátké a ostré maximum (jen pár hodin)' },
    { kod: 'LYR', nazev: 'Lyridy', lambda: 32.32, zhr: 18, v: 49, aktivita: '14. 4. – 30. 4.', radiant: 'Lyra' },
    { kod: 'ETA', nazev: 'Éta Akvaridy', lambda: 45.5, zhr: 50, v: 66, aktivita: '19. 4. – 28. 5.', radiant: 'Vodnář', pozn: 'z ČR nízko nad obzorem, jen ráno; skutečně viditelných je málo' },
    { kod: 'SDA', nazev: 'Jižní delta Akvaridy', lambda: 128, zhr: 25, v: 41, aktivita: '12. 7. – 23. 8.', radiant: 'Vodnář', pozn: 'z ČR nízký radiant' },
    { kod: 'CAP', nazev: 'Alfa Kaprikornidy', lambda: 128, zhr: 5, v: 23, aktivita: '3. 7. – 15. 8.', radiant: 'Kozoroh', pozn: 'pomalé jasné meteory, bolidy' },
    { kod: 'PER', nazev: 'Perseidy', lambda: 140.0, zhr: 100, v: 59, aktivita: '17. 7. – 24. 8.', radiant: 'Perseus', pozn: 'nejznámější letní roj' },
    { kod: 'AUR', nazev: 'Aurigidy', lambda: 158.6, zhr: 6, v: 66, aktivita: '28. 8. – 5. 9.', radiant: 'Vozka' },
    { kod: 'DRA', nazev: 'Říjnové Drakonidy', lambda: 195.4, zhr: 5, v: 20, aktivita: '6. 10. – 10. 10.', radiant: 'Drak', pozn: 'proměnlivý roj, výjimečně spršky' },
    { kod: 'ORI', nazev: 'Orionidy', lambda: 208, zhr: 20, v: 66, aktivita: '2. 10. – 7. 11.', radiant: 'Orion' },
    { kod: 'STA', nazev: 'Jižní Tauridy', lambda: 223, zhr: 7, v: 27, aktivita: '20. 9. – 20. 11.', radiant: 'Býk', pozn: 'ploché maximum, jasné bolidy' },
    { kod: 'NTA', nazev: 'Severní Tauridy', lambda: 230, zhr: 5, v: 29, aktivita: '20. 10. – 10. 12.', radiant: 'Býk', pozn: 'ploché maximum, jasné bolidy' },
    { kod: 'LEO', nazev: 'Leonidy', lambda: 235.27, zhr: 15, v: 71, aktivita: '6. 11. – 30. 11.', radiant: 'Lev' },
    { kod: 'GEM', nazev: 'Geminidy', lambda: 262.2, zhr: 150, v: 35, aktivita: '4. 12. – 20. 12.', radiant: 'Blíženci', pozn: 'nejbohatší roj roku, radiant vysoko celou noc' },
    { kod: 'URS', nazev: 'Ursidy', lambda: 270.7, zhr: 10, v: 33, aktivita: '17. 12. – 26. 12.', radiant: 'Malý vůz' },
  ];
  // okamžik, kdy délka Slunce (J2000) dosáhne λ v daném roce
  function slunecniDelka(rok, lambda) {
    const [z, k] = rozsahRoku(rok);
    const r = koreny(t => norm180(slunce(t).lonJ2000 - lambda), z - 1, k, 2);
    return r.find(t => t >= z && t < k) ?? null;
  }
  function rojeVRoce(rok) {
    return ROJE.map(r => {
      const jde = slunecniDelka(rok, r.lambda);
      if (jde === null) return null;
      const o = osvetleniMesice(jde);
      return { ...r, jde, datum: jdeNaDatum(jde), mesicK: o.k, mesicRoste: o.roste };
    }).filter(Boolean).sort((a, b) => a.jde - b.jde);
  }

  /* ---------------- souhrn: Měsíc ---------------- */
  // superúplněk: úplněk blíž než 362 600 km (≈ 90 % cesty od střední vzdálenosti apogea k perigeu – definice R. Nolla)
  const SUPER_KM = 362600, MIKRO_KM = 405000;
  function mesicVRoce(rok) {
    const f = fazeVRoce(rok);
    return f.map(x => {
      const m = mesic(x.jde);
      return { ...x, dist: m.dist, super: x.faze === 2 && m.dist < SUPER_KM, mikro: x.faze === 2 && m.dist > MIKRO_KM };
    });
  }

  /* ---------------- iCalendar ---------------- */
  function icsText(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  // zalomení řádků po 75 bajtech (RFC 5545), nerozdělovat znaky UTF-8
  function icsZalom(radek) {
    const out = []; let akt = '', bajty = 0, limit = 75;
    for (const ch of radek) {
      const c = ch.codePointAt(0), b = c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;   // bajty v UTF-8
      if (bajty + b > limit) { out.push(akt); akt = ' '; bajty = 1; limit = 75; }
      akt += ch; bajty += b;
    }
    out.push(akt);
    return out.join('\r\n');
  }
  const icsCas = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const icsDen = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  function ics(udalosti, nazevKalendare = 'Astronomické úkazy') {
    const ted = icsCas(new Date());
    const r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lavionus//Astronomicky kalendar//CS', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsText(nazevKalendare)];
    for (const u of udalosti) {
      r.push('BEGIN:VEVENT', `UID:${u.id}@lavionus-astro`, `DTSTAMP:${ted}`);
      if (u.celodenni) {
        const d = u.denMistni || u.datum;   // celodenní událost v místním datu
        const dalsi = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
        r.push(`DTSTART;VALUE=DATE:${icsDen(d)}`, `DTEND;VALUE=DATE:${icsDen(dalsi)}`);
      } else {
        r.push(`DTSTART:${icsCas(u.datum)}`, `DTEND:${icsCas(u.konec || new Date(u.datum.getTime() + (u.trvaniMin || 30) * 60000))}`);
      }
      r.push('SUMMARY:' + icsText(u.nazev));
      if (u.popis) r.push('DESCRIPTION:' + icsText(u.popis));
      r.push('TRANSP:TRANSPARENT', 'END:VEVENT');
    }
    r.push('END:VCALENDAR');
    return r.map(icsZalom).join('\r\n') + '\r\n';
  }

  const ASTRO = {
    jdZData, dataZJd, deltaT, jdeNaUt, utNaJde, jdeNaDatum, nutace, gast,
    slunce, mesic, topo, sluncePoloha, mesicPoloha, uhel, osvetleniMesice,
    fazeMesice, fazeVRoce, mesicVRoce, SUPER_KM, rovnodennost,
    zatmeni, zatmeniVRoce, zakryti, mistniZatmeniSlunce, mistniZatmeniMesice,
    PLANETY, helio, geoPlaneta, planetyVRoce, mesicPlanetyVRoce, koreny, maxima,
    ROJE, slunecniDelka, rojeVRoce, ics, icsZalom,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ASTRO;
  else koren.ASTRO = ASTRO;
})(typeof window !== 'undefined' ? window : globalThis);
