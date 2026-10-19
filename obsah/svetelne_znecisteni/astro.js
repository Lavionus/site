/* ============================================================
   astro.js – astronomické výpočty pro stránku „Světelné znečištění
   a tmavá obloha“ (obsah/svetelne_znecisteni.html). Bez DOM, běží
   v prohlížeči i v node (test _test/svetelne_znecisteni_test.js).

   Algoritmy: J. Meeus, Astronomical Algorithms, 2. vyd. (1998)
   - kap. 12 hvězdný čas, 13 převod souřadnic
   - kap. 25 Slunce (nízká přesnost, ±0,01°)
   - kap. 47 Měsíc – zkrácené tabulky 47.A/47.B (největší členy,
     chyba délky do ~0,01°), kap. 48 osvětlená část
   - fáze Měsíce hledá numericky jako okamžik, kdy rozdíl
     ekliptikálních délek Měsíce a Slunce = 0°, 90°, 180°, 270°
     (přesnost ~2 min)
   Výška Slunce je geometrická (bez refrakce) – soumraky se
   definují geometricky: občanský −6°, nautický −12°,
   astronomický −18°. Východ/západ Slunce: −0,833° (refrakce
   + poloměr disku). Měsíc: h0 = 0,7275·π − 0,5667° (Meeus kap. 15).
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const sin = x => Math.sin(x * RAD), cos = x => Math.cos(x * RAD);
  const norm = x => ((x % 360) + 360) % 360;
  const norm180 = x => { const n = norm(x); return n >= 180 ? n - 360 : n; };
  const MIN = 60000, HOD = 3600000, DEN = 86400000;

  const jd = t => (t instanceof Date ? t.getTime() : t) / DEN + 2440587.5;
  const zJd = j => new Date(Math.round((j - 2440587.5) * DEN));
  // ΔT = TT − UT (s); pro 2015–2035 ~69 s, mimo použijeme polynom Espenak–Meeus
  function deltaT(rok) {
    if (rok >= 2005 && rok < 2050) { const t = rok - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    const u = (rok - 1820) / 100; return -20 + 32 * u * u;
  }
  const jde = t => { const j = jd(t); return j + deltaT(2000 + (j - 2451545) / 365.25) / 86400; };
  const stoleti = j => (j - 2451545) / 36525;

  /* ---------- nutace (hlavní členy) a sklon ekliptiky ---------- */
  function nutace(T) {
    const om = 125.04452 - 1934.136261 * T, L = 280.4665 + 36000.7698 * T, Lm = 218.3165 + 481267.8813 * T;
    const dpsi = (-17.2 * sin(om) - 1.32 * sin(2 * L) - 0.23 * sin(2 * Lm) + 0.21 * sin(2 * om)) / 3600;
    const deps = (9.2 * cos(om) + 0.57 * cos(2 * L) + 0.1 * cos(2 * Lm) - 0.09 * cos(2 * om)) / 3600;
    const eps0 = 23.43929111 - (46.815 * T + 0.00059 * T * T - 0.001813 * T ** 3) / 3600;
    return { dpsi, eps: eps0 + deps };
  }
  function naRovnik(lon, lat, eps) {
    const ra = Math.atan2(sin(lon) * cos(eps) - Math.tan(lat * RAD) * sin(eps), cos(lon)) * DEG;
    const dec = Math.asin(sin(lat) * cos(eps) + cos(lat) * sin(eps) * sin(lon)) * DEG;
    return { ra: norm(ra), dec };
  }

  /* ---------- Slunce (Meeus kap. 25, nízká přesnost) ---------- */
  function slunce(t) {
    const T = stoleti(jde(t));
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const e = 0.016708634 - 0.000042037 * T;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
    const v = M + C;
    const R = 1.000001018 * (1 - e * e) / (1 + e * cos(v));
    const n = nutace(T);
    const lon = norm(L0 + C - 0.00569 + n.dpsi);     // zdánlivá délka (aberace + nutace)
    return { lon, lat: 0, R, ...naRovnik(lon, 0, n.eps) };
  }

  /* ---------- Měsíc (Meeus kap. 47, zkráceně) ---------- */
  // [D, M, M', F, Σl (1e-6 °), Σr (1e-3 km)]
  const LR = [
    [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
    [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
    [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
    [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
    [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
    [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
    [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
    [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
    [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
    [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
    [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
  ];
  // [D, M, M', F, Σb (1e-6 °)]
  const B = [
    [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
    [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
    [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
    [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
    [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  ];
  function mesicZJde(J) {
    const T = stoleti(J);
    const Lp = norm(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T);
    const D = norm(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T);
    const M = norm(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T);
    const Mp = norm(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T);
    const F = norm(93.2720950 + 483202.0175233 * T - 0.0036539 * T * T);
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.29 * T, A3 = 313.45 + 481266.484 * T;
    let sl = 0, sr = 0, sb = 0;
    for (const [d, m, mp, f, l, r] of LR) {
      const a = d * D + m * M + mp * Mp + f * F, k = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
      sl += l * k * sin(a); sr += r * k * cos(a);
    }
    for (const [d, m, mp, f, b] of B) {
      const k = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
      sb += b * k * sin(d * D + m * M + mp * Mp + f * F);
    }
    sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
    sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);
    const n = nutace(T);
    const lon = norm(Lp + sl / 1e6 + n.dpsi), lat = sb / 1e6, dist = 385000.56 + sr / 1000;
    return { lon, lonGeom: norm(Lp + sl / 1e6), lat, dist, ...naRovnik(lon, lat, n.eps) };
  }
  const mesic = t => mesicZJde(jde(t));

  /* ---------- obzorníkové souřadnice ---------- */
  function hvezdnyCas(t) {           // GMST ve stupních (Meeus 12.4), t v UT
    const j = jd(t), T = stoleti(j);
    return norm(280.46061837 + 360.98564736629 * (j - 2451545) + 0.000387933 * T * T - T ** 3 / 38710000);
  }
  function naObzor(ra, dec, t, lat, lon) {
    const H = hvezdnyCas(t) + lon - ra;
    const alt = Math.asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H)) * DEG;
    const az = norm(Math.atan2(sin(H), cos(H) * sin(lat) - Math.tan(dec * RAD) * cos(lat)) * DEG + 180);
    return { alt, az };
  }
  function polohaSlunce(t, lat, lon) { const s = slunce(t); return naObzor(s.ra, s.dec, t, lat, lon); }
  // Měsíc: geocentrická výška + topocentrická (paralaxa) a zdánlivá (refrakce, Sæmundsson)
  function polohaMesice(t, lat, lon) {
    const m = mesic(t), h = naObzor(m.ra, m.dec, t, lat, lon);
    const par = Math.asin(6378.14 / m.dist) * DEG;
    const topo = h.alt - par * cos(h.alt);
    const refr = topo > -1 ? 1.02 / Math.tan((topo + 10.3 / (topo + 5.11)) * RAD) / 60 : 0;
    return { alt: h.alt, altTopo: topo, altZdanliva: topo + refr, az: h.az, dist: m.dist, paralaxa: par };
  }

  /* ---------- osvětlení a fáze ---------- */
  function osvetleni(t) {
    const s = slunce(t), m = mesic(t);
    const psi = Math.acos(cos(m.lat) * cos(m.lon - s.lon)) * DEG;       // elongace
    const Rkm = s.R * 149597870.7;
    const i = Math.atan2(Rkm * sin(psi), m.dist - Rkm * cos(psi)) * DEG;  // fázový úhel
    const k = (1 + cos(i)) / 2;
    const vek = norm(m.lon - s.lon);                                     // 0 nov, 180 úplněk
    return { k, fazovyUhel: i, elongace: psi, uhelFaze: vek, roste: vek < 180 };
  }
  const NAZVY_FAZE = ['nov', 'dorůstající srpek', 'první čtvrť', 'dorůstající Měsíc', 'úplněk', 'couvající Měsíc', 'poslední čtvrť', 'ubývající srpek'];
  function nazevFaze(uhel) {
    // přesné fáze jen v pásmu ±6° (cca ±12 h), jinak období mezi nimi
    const u = norm(uhel);
    if (u < 6 || u > 354) return NAZVY_FAZE[0];
    if (Math.abs(u - 90) < 6) return NAZVY_FAZE[2];
    if (Math.abs(u - 180) < 6) return NAZVY_FAZE[4];
    if (Math.abs(u - 270) < 6) return NAZVY_FAZE[6];
    return u < 90 ? NAZVY_FAZE[1] : u < 180 ? NAZVY_FAZE[3] : u < 270 ? NAZVY_FAZE[5] : NAZVY_FAZE[7];
  }
  // okamžik, kdy elongace v délce = cil (0, 90, 180, 270) nejblíže po čase od
  function dalsiFaze(od, cil) {
    const f = ms => norm180(mesic(ms).lon - slunce(ms).lon - cil);
    let t = (od instanceof Date ? od.getTime() : od);
    // Měsíc se vůči Slunci posouvá ~12,19 °/den – první odhad
    const ted = norm(mesic(t).lon - slunce(t).lon - cil);
    t += ((360 - ted) % 360) / 12.19 * DEN;
    if (t < (od instanceof Date ? od.getTime() : od)) t += 29.53 * DEN;
    for (let i = 0; i < 8; i++) {           // Newton s numerickou derivací
      const h = 600000, d = (f(t + h) - f(t - h)) / (2 * h);
      const krok = f(t) / d; t -= krok;
      if (Math.abs(krok) < 1000) break;
    }
    if (t < (od instanceof Date ? od.getTime() : od) - MIN) return dalsiFaze(new Date((od instanceof Date ? od.getTime() : od) + 25 * DEN), cil);
    return new Date(Math.round(t));
  }
  function fazeVObdobi(od, dni) {
    const vys = [], konec = od.getTime() + dni * DEN;
    for (const [cil, nazev] of [[0, 'nov'], [90, 'první čtvrť'], [180, 'úplněk'], [270, 'poslední čtvrť']]) {
      let t = new Date(od.getTime() - MIN);
      for (;;) {
        const d = dalsiFaze(t, cil);
        if (d.getTime() > konec) break;
        vys.push({ cas: d, faze: cil, nazev });
        t = new Date(d.getTime() + 20 * DEN);
      }
    }
    return vys.sort((a, b) => a.cas - b.cas);
  }

  /* ---------- hledání přechodů výškou ---------- */
  // vrátí seznam {cas, stoupa} v intervalu [a, b] (ms), kde f(t) mění znaménko
  function prechody(f, a, b, krok) {
    const vys = [];
    let t0 = a, f0 = f(t0);
    for (let t1 = a + krok; t0 < b; t1 = Math.min(t1 + krok, b)) {
      const f1 = f(t1);
      if (f0 === 0) vys.push({ cas: t0, stoupa: f1 > 0 });
      else if (f0 * f1 < 0) {
        let lo = t0, hi = t1, flo = f0;
        for (let i = 0; i < 40 && hi - lo > 500; i++) {
          const m = (lo + hi) / 2, fm = f(m);
          if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; }
        }
        vys.push({ cas: (lo + hi) / 2, stoupa: f1 > f0 });
      }
      t0 = t1; f0 = f1;
      if (t1 >= b) break;
    }
    return vys;
  }
  const H0 = { zapad: -0.8333, obcansky: -6, nauticky: -12, astronomicky: -18 };

  // poledne místního středního času pro kalendářní den data (UTC rok/měsíc/den)
  function mistniPoledne(rok, mesic0, den, lon) {
    return Date.UTC(rok, mesic0, den, 12) - lon / 15 * HOD;
  }

  /* noc začínající večer dne (rok, měsíc 0–11, den) v místě lat/lon.
     Interval = místní poledne → další místní poledne. */
  function noc(rok, mesic0, den, lat, lon) {
    const a = mistniPoledne(rok, mesic0, den, lon), b = a + DEN;
    const vys = { od: new Date(a), do: new Date(b) };
    const vyskaSl = t => polohaSlunce(t, lat, lon).alt;
    // jednou spočítat výšky po 5 min a pak hledat všechny prahy
    const KROK = 5 * MIN, n = Math.round(DEN / KROK), vys5 = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) vys5[i] = vyskaSl(a + i * KROK);
    vys.minVyskaSlunce = Math.min(...vys5);
    vys.maxVyskaSlunce = Math.max(...vys5);
    for (const [klic, h0] of Object.entries(H0)) {
      const f = t => vyskaSl(t) - h0;
      let vecer = null, rano = null;
      for (let i = 0; i < n; i++) {
        const f0 = vys5[i] - h0, f1 = vys5[i + 1] - h0;
        if (f0 > 0 && f1 <= 0 && !vecer) vecer = prechody(f, a + i * KROK, a + (i + 1) * KROK, KROK)[0];
        if (f0 <= 0 && f1 > 0 && vecer && !rano) rano = prechody(f, a + i * KROK, a + (i + 1) * KROK, KROK)[0];
      }
      // stav bez přechodu: Slunce celou dobu pod/nad prahem
      vys[klic] = {
        vecer: vecer ? new Date(vecer.cas) : null,
        rano: rano ? new Date(rano.cas) : null,
        stav: vecer && rano ? 'normal' : (vys.minVyskaSlunce > h0 ? 'nenastane' : vys.maxVyskaSlunce < h0 ? 'cela' : 'castecne'),
      };
    }
    return vys;
  }

  // výška Měsíce vůči obzoru pro východ/západ (h0 = 0,7275 π − 0,5667°)
  function mesicNadObzorem(t, lat, lon) {
    const p = polohaMesice(t, lat, lon);
    return p.alt - (0.7275 * p.paralaxa - 0.5667);
  }
  function vychodyMesice(a, b, lat, lon) {
    return prechody(t => mesicNadObzorem(t, lat, lon), a, b, 10 * MIN)
      .map(p => ({ cas: new Date(p.cas), druh: p.stoupa ? 'východ' : 'západ' }));
  }

  /* Tmavé okno: astronomická noc (Slunce < −18°) a zároveň Měsíc pod obzorem.
     Vrací intervaly [od, do] a celkové minuty; navíc minuty astronomické noci
     s Měsícem nad obzorem (a jeho osvětlení). */
  function tmaveOkno(rok, mesic0, den, lat, lon) {
    const n = noc(rok, mesic0, den, lat, lon);
    const vys = { noc: n, intervaly: [], minut: 0, minutNoci: 0, minutSMesicem: 0 };
    let a, b;
    if (n.astronomicky.stav === 'normal') { a = n.astronomicky.vecer.getTime(); b = n.astronomicky.rano.getTime(); }
    else if (n.astronomicky.stav === 'cela') { a = n.od.getTime(); b = n.do.getTime(); }
    else if (n.astronomicky.stav === 'castecne') {
      // jen jeden přechod v intervalu (vzácné, polární oblasti) – ber dobu, kdy je Slunce pod −18°
      a = n.astronomicky.vecer ? n.astronomicky.vecer.getTime() : n.od.getTime();
      b = n.astronomicky.rano ? n.astronomicky.rano.getTime() : n.do.getTime();
    } else return vys;
    vys.minutNoci = (b - a) / MIN;
    const f = t => -mesicNadObzorem(t, lat, lon);          // > 0 = Měsíc pod obzorem
    const zlomy = prechody(f, a, b, 10 * MIN).map(p => p.cas);
    const body = [a, ...zlomy, b];
    for (let i = 0; i < body.length - 1; i++) {
      const s = (body[i] + body[i + 1]) / 2;
      if (body[i + 1] - body[i] < 1000) continue;
      if (f(s) > 0) vys.intervaly.push({ od: new Date(body[i]), do: new Date(body[i + 1]) });
    }
    vys.minut = vys.intervaly.reduce((s, x) => s + (x.do - x.od) / MIN, 0);
    vys.minutSMesicem = vys.minutNoci - vys.minut;
    const stred = (a + b) / 2;
    vys.osvetleni = osvetleni(new Date(stred));
    return vys;
  }

  const ASTRO = {
    jd, zJd, deltaT, slunce, mesic, mesicZJde, hvezdnyCas, naObzor, polohaSlunce, polohaMesice,
    osvetleni, nazevFaze, dalsiFaze, fazeVObdobi, prechody, noc, tmaveOkno, vychodyMesice,
    mesicNadObzorem, mistniPoledne, H0, norm, norm180,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ASTRO;
  else koren.SZ_ASTRO = ASTRO;
})(typeof self !== 'undefined' ? self : this);
