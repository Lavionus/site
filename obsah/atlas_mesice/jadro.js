/* ============================================================
   atlas_mesice/jadro.js – výpočty pro „Atlas Měsíce“ (bez DOM).
   Polohy Slunce a Měsíce bere z obsah/sky_events/astro.js (Meeus 25, 47).

   Fyzikální efemerida Měsíce podle J. Meeus: Astronomical Algorithms,
   2. vyd., kap. 53 – optická i fyzická librace, poziční úhel osy P,
   selenografická poloha Slunce (l0, b0) a colongitude c0 = 90° − l0.
   Konvence: selenografická délka kladná na východ (IAU, k Mare Crisium),
   na disku x doprava = východ Měsíce, y nahoru = sever Měsíce.
   ============================================================ */
(function (koren) {
  'use strict';
  const A = typeof module !== 'undefined' && module.exports ? require('../sky_events/astro.js') : koren.ASTRO;
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const sin = x => Math.sin(x * RAD), cos = x => Math.cos(x * RAD);
  const norm = x => ((x % 360) + 360) % 360;
  const norm180 = x => { const n = norm(x); return n > 180 ? n - 360 : n; };
  const I = 1.54242;              // sklon měsíčního rovníku k ekliptice
  const AU = 149597870.7;
  const SYNODICKY = 29.530588861;

  // selenografická poloha bodu, nad nímž stojí těleso o ekliptikálních souřadnicích (lambda, beta) – Meeus 53.1
  function seleno(lambda, beta, Om, dpsi, F) {
    const W = lambda - dpsi - Om;
    const Ad = Math.atan2(sin(W) * cos(beta) * cos(I) - sin(beta) * sin(I), cos(W) * cos(beta)) * DEG;
    const l = norm180(Ad - F);
    const b = Math.asin(-sin(W) * cos(beta) * sin(I) - sin(beta) * cos(I)) * DEG;
    return { l, b, A: Ad };
  }

  // jde = juliánské datum v dynamickém čase (TT)
  function efemeridaJde(jde) {
    const T = (jde - 2451545) / 36525;
    const D = norm(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T ** 3 / 545868 - T ** 4 / 113065000);
    const M = norm(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T ** 3 / 24490000);
    const Mp = norm(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T ** 3 / 69699 - T ** 4 / 14712000);
    const F = norm(93.272095 + 483202.0175233 * T - 0.0036539 * T * T - T ** 3 / 3526000 + T ** 4 / 863310000);
    const Om = norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T ** 3 / 467441 - T ** 4 / 60616000);
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    const K1 = 119.75 + 131.849 * T, K2 = 72.56 + 20.186 * T;
    const m = A.mesic(jde), s = A.slunce(jde), n = A.nutace(jde);

    // optická librace
    const o = seleno(m.lon, m.lat, Om, n.dpsi, F);
    // fyzická librace (Meeus 53, ρ σ τ)
    const rho = -0.02752 * cos(Mp) - 0.02245 * sin(F) + 0.00684 * cos(Mp - 2 * F) - 0.00293 * cos(2 * F) - 0.00085 * cos(2 * F - 2 * D)
      - 0.00054 * cos(Mp - 2 * D) - 0.0002 * sin(Mp + F) - 0.0002 * cos(Mp + 2 * F) - 0.0002 * cos(Mp - F) + 0.00014 * cos(Mp + 2 * F - 2 * D);
    const sigma = -0.02816 * sin(Mp) + 0.02244 * cos(F) - 0.00682 * sin(Mp - 2 * F) - 0.00279 * sin(2 * F) - 0.00083 * sin(2 * F - 2 * D)
      + 0.00069 * sin(Mp - 2 * D) + 0.0004 * cos(Mp + F) - 0.00025 * sin(2 * Mp) - 0.00023 * sin(Mp + 2 * F) + 0.0002 * cos(Mp - F)
      + 0.00019 * sin(Mp - F) + 0.00013 * sin(Mp + 2 * F - 2 * D) - 0.0001 * cos(Mp - 3 * F);
    const tau = 0.0252 * E * sin(M) + 0.00473 * sin(2 * Mp - 2 * F) - 0.00467 * sin(Mp) + 0.00396 * sin(K1) + 0.00276 * sin(2 * Mp - 2 * D)
      + 0.00196 * sin(Om) - 0.00183 * cos(Mp - F) + 0.00115 * sin(Mp - 2 * D) - 0.00096 * sin(Mp - D) + 0.00046 * sin(2 * F - 2 * D)
      - 0.00039 * sin(Mp - F) - 0.00032 * sin(Mp - M - D) + 0.00027 * sin(2 * Mp - M - 2 * D) + 0.00023 * sin(K2) - 0.00014 * sin(2 * D)
      + 0.00014 * cos(2 * Mp - 2 * F) - 0.00012 * sin(Mp - 2 * F) - 0.00012 * sin(2 * Mp) + 0.00011 * sin(2 * Mp - 2 * M - 2 * D);
    const l2 = -tau + (rho * cos(o.A) + sigma * sin(o.A)) * Math.tan(o.b * RAD);
    const b2 = sigma * cos(o.A) - rho * sin(o.A);
    const l = o.l + l2, b = o.b + b2;

    // poziční úhel osy
    const V = Om + n.dpsi + sigma / sin(I);
    const X = sin(I + rho) * sin(V);
    const Y = sin(I + rho) * cos(V) * cos(n.eps) - cos(I + rho) * sin(n.eps);
    const w = Math.atan2(X, Y) * DEG;
    const P = Math.asin(Math.hypot(X, Y) * cos(m.ra - w) / cos(b)) * DEG;

    // selenografická poloha Slunce (heliocentrická poloha Měsíce)
    const R = s.R * AU;
    const lamH = s.lon + 180 + (m.dist / R) * DEG * cos(m.lat) * sin(s.lon - m.lon);
    const betH = (m.dist / R) * m.lat;
    const sl = seleno(lamH, betH, Om, n.dpsi, F);
    const l0 = norm180(sl.l + l2), b0 = sl.b + b2;
    const c0 = norm(90 - l0);

    // osvětlení a fáze
    const psi = Math.acos(cos(m.lat) * cos(m.lon - s.lon)) * DEG;
    const fazovy = Math.atan2(R * sin(psi), m.dist - R * cos(psi)) * DEG;
    const k = (1 + cos(fazovy)) / 2;
    const elongace = norm(m.lon - s.lon);           // 0 nov, 90 první čtvrť, 180 úplněk, 270 poslední čtvrť
    const prumer = 2 * Math.atan(1737.4 / m.dist) * DEG * 60;   // úhlový průměr v obloukových minutách (geocentricky)
    return { jde, l, b, lOpt: o.l, bOpt: o.b, P, l0, b0, c0, k, elongace, roste: elongace < 180, vzdalenost: m.dist, prumer, ra: m.ra, dec: m.dec };
  }

  function efemerida(datum) {
    const jd = A.jdZData(datum), jde = A.utNaJde(jd);
    const e = efemeridaJde(jde);
    e.datum = datum;
    e.stari = stari(jde);
    e.faze = nazevFaze(e.elongace);
    return e;
  }

  // stáří Měsíce ve dnech od posledního novu
  function stari(jde) {
    let k = Math.floor((jde - 2451550.09766) / SYNODICKY);
    while (A.fazeMesice(k) > jde) k--;
    while (A.fazeMesice(k + 1) <= jde) k++;
    return jde - A.fazeMesice(k);
  }
  // nejbližší hlavní fáze po okamžiku (jde): [{druh 0–3, jde}]
  function dalsiFaze(jde, pocet = 4) {
    const out = [];
    let k = Math.floor((jde - 2451550.09766) / SYNODICKY * 4) / 4 - 0.25;
    while (out.length < pocet) {
      const t = A.fazeMesice(k);
      if (t > jde) out.push({ druh: Math.round((k - Math.floor(k)) * 4) % 4, jde: t, datum: A.jdeNaDatum(t) });
      k += 0.25;
    }
    return out;
  }
  const FAZE = ['nov', 'první čtvrť', 'úplněk', 'poslední čtvrť'];
  function nazevFaze(el) {
    if (el < 6 || el > 354) return 'nov';
    if (el < 84) return 'dorůstající srpek';
    if (el <= 96) return 'první čtvrť';
    if (el < 174) return 'dorůstající Měsíc';
    if (el <= 186) return 'úplněk';
    if (el < 264) return 'couvající Měsíc';
    if (el <= 276) return 'poslední čtvrť';
    return 'couvající srpek';
  }

  /* ---------- osvětlení útvaru ---------- */
  // výška Slunce nad obzorem v místě (lat, lon) na Měsíci [°]
  function vyskaSlunce(lat, lon, e) {
    return Math.asin(Math.max(-1, Math.min(1, sin(e.b0) * sin(lat) + cos(e.b0) * cos(lat) * sin(e.c0 + lon)))) * DEG;
  }
  // true = Slunce v místě vychází (ranní terminátor), false = zapadá
  const rano = (lat, lon, e) => cos(e.c0 + lon) > 0;
  // colongitude, kdy v místě vychází Slunce (pro rovník přesně, jinde přibližně)
  const colongVychodu = lon => norm(360 - lon);

  /* ---------- projekce na disk (pravoúhlá, s librací) ---------- */
  function naDisku(lat, lon, e) {
    const dl = lon - e.l;
    return {
      x: cos(lat) * sin(dl),
      y: cos(e.b) * sin(lat) - sin(e.b) * cos(lat) * cos(dl),
      z: sin(e.b) * sin(lat) + cos(e.b) * cos(lat) * cos(dl),
    };
  }
  function zDisku(x, y, e) {
    const r2 = x * x + y * y;
    if (r2 > 1) return null;
    const z = Math.sqrt(1 - r2), sb = sin(e.b), cb = cos(e.b);
    const lat = Math.asin(y * cb + z * sb) * DEG;
    const lon = norm180(e.l + Math.atan2(x, z * cb - y * sb) * DEG);
    return { lat, lon };
  }

  /* ---------- orientace obrazu ----------
     natoceni: 'atlas' (sever Měsíce nahoru), 'sever' (nebeský sever nahoru), 'zenit' (zenit nahoru, azimutální montáž)
     optika:   'primo' (oko, triedr), 'prevraceny' (Newton, Kepler – 180°), 'zrcadleny' (diagonála – stranově převrácený) */
  function uhelNatoceni(natoceni, e, q) {
    if (natoceni === 'sever') return e.P;
    if (natoceni === 'zenit') return e.P - (q || 0);
    return 0;
  }
  // disk → obrazovka (y nahoru); uhel proti směru hodinových ručiček ve stupních
  function transformace(uhel, optika) {
    const c = cos(uhel + (optika === 'prevraceny' ? 180 : 0)), s = sin(uhel + (optika === 'prevraceny' ? 180 : 0));
    const zr = optika === 'zrcadleny' ? -1 : 1;
    return {
      tam: (x, y) => ({ x: zr * (c * x - s * y), y: s * x + c * y }),
      zpet: (X, Y) => { const x = zr * X; return { x: c * x + s * Y, y: -s * x + c * Y }; },
    };
  }

  // paralaktický úhel Měsíce pro místo {lat, lon} – úhel mezi nebeským severem a zenitem [°]
  function paralakticky(datum, misto) {
    const jd = A.jdZData(datum);
    const p = A.mesicPoloha(jd, misto);
    const H = A.gast(jd) + misto.lon - p.ra;
    const q = Math.atan2(sin(H), Math.tan(misto.lat * RAD) * cos(p.dec) - sin(p.dec) * cos(H)) * DEG;
    return { q, alt: p.alt, az: p.az };
  }

  // průběh noci: kdy je Měsíc nad obzorem za tmy (Slunce pod −6°); krok 10 min od poledne do poledne
  function noc(datum, misto) {
    const d0 = new Date(datum); d0.setHours(12, 0, 0, 0);
    if (datum - d0 < 0) d0.setDate(d0.getDate() - 1);
    const vzorky = [];
    let nejlepsi = null;
    for (let i = 0; i <= 144; i++) {
      const t = new Date(d0.getTime() + i * 600000), jd = A.jdZData(t);
      const s = A.sluncePoloha(jd, misto), m = A.mesicPoloha(jd, misto);
      const v = { datum: t, slunce: s.alt, mesic: m.alt };
      vzorky.push(v);
      if (s.alt < -6 && m.alt > 0 && (!nejlepsi || m.alt > nejlepsi.mesic)) nejlepsi = v;
    }
    const tma = vzorky.filter(v => v.slunce < -6 && v.mesic > 10);
    return { vzorky, nejlepsi, od: tma.length ? tma[0].datum : null, do: tma.length ? tma[tma.length - 1].datum : null };
  }

  /* ---------- útvary ---------- */
  const TYPY = {
    krater: 'kráter', more: 'moře', hory: 'hory', udoli: 'údolí', brazda: 'brázda', sraz: 'zlom', hrbet: 'hřbet',
    mys: 'mys', svetly: 'světlý útvar', pristani: 'přistání',
  };
  // útvary, které vyniknou při vysokém Slunci (paprsky, albedo)
  const ALBEDO = new Set(['Tycho', 'Copernicus', 'Kepler', 'Aristarchus', 'Proclus', 'Reiner Gamma', 'Stevinus', 'Messier', 'Menelaus',
    'Censorinus', 'Grimaldi', 'Plato', 'Byrgius', 'Lalande', 'Godin', 'Euler', 'Bessel', 'Manilius', 'Mare Crisium', 'Sinus Aestuum']);

  const prevod = r => ({ jmeno: r[0], cesky: r[1], typ: r[2], lat: r[3], lon: r[4], prumer: r[5], cil: !!r[6], obt: r[7], popis: r[8] });
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // stav útvaru v daném okamžiku
  function stavUtvaru(u, e) {
    const d = naDisku(u.lat, u.lon, e);
    const h = vyskaSlunce(u.lat, u.lon, e);
    const r = rano(u.lat, u.lon, e);
    let stav;
    if (d.z < 0.05) stav = 'neviditelny';
    else if (h < -0.3) stav = 'noc';
    else if (h < 12) stav = 'terminator';
    else stav = 'den';
    return { ...d, h, rano: r, stav };
  }

  // „co pozorovat dnes“ – útvary s nízkým Sluncem (reliéf) a při vysokém Slunci útvary s paprsky
  function coPozorovat(utvary, e, max = 30) {
    const relief = [], albedo = [];
    for (const u of utvary) {
      if (u.typ === 'pristani') continue;
      const s = stavUtvaru(u, e);
      if (s.z < 0.1) continue;
      if (u.typ !== 'more' && u.typ !== 'svetly' && s.h > -0.3 && s.h < 12) {
        // čím níž Slunce a větší/význačnější útvar, tím lépe; mírná penalizace blízko okraje
        const skore = (12 - Math.max(0, s.h)) * (u.cil ? 1.6 : 1) * (1 + Math.min(u.prumer, 300) / 150) * (0.4 + 0.6 * s.z) / u.obt;
        relief.push({ u, s, skore });
      } else if (ALBEDO.has(u.jmeno) && s.h > 25) albedo.push({ u, s, skore: s.h });
    }
    relief.sort((a, b) => b.skore - a.skore);
    albedo.sort((a, b) => b.skore - a.skore);
    return { relief: relief.slice(0, max), albedo: e.k > 0.75 ? albedo.slice(0, 12) : [] };
  }

  // nejbližší východ a západ Slunce nad útvarem po okamžiku datum (krok 1 h, do 31 dní)
  function vychodZapad(u, datum) {
    const jde0 = A.utNaJde(A.jdZData(datum));
    let vychod = null, zapad = null, h0 = vyskaSlunce(u.lat, u.lon, efemeridaJde(jde0));
    for (let i = 1; i <= 31 * 24 && !(vychod && zapad); i++) {
      const h = vyskaSlunce(u.lat, u.lon, efemeridaJde(jde0 + i / 24));
      const t = A.jdeNaDatum(jde0 + (i - h / (h - h0)) / 24);    // lineární interpolace průchodu nulou
      if (h0 < 0 && h >= 0 && !vychod) vychod = t;
      if (h0 >= 0 && h < 0 && !zapad) zapad = t;
      h0 = h;
    }
    return { vychod, zapad };
  }

  function filtruj(utvary, { hledat = '', typ = '', jenCile = false, obt = 0 } = {}) {
    const q = bezDiakritiky(hledat.trim());
    return utvary.filter(u => (!typ || u.typ === typ) && (!jenCile || u.cil) && (!obt || u.obt <= obt)
      && (!q || bezDiakritiky(u.jmeno + ' ' + u.cesky + ' ' + u.popis).includes(q)));
  }

  // body terminátoru (h = 0) a okraje osvětlené části jako lomené čáry na disku; rozdělené tam, kde jdou za okraj
  function terminator(e, kroky = 180) {
    const lat0 = e.b0, lon0 = e.l0;
    // ortonormální báze kolmá na směr ke Slunci
    const sx = cos(lat0) * cos(lon0), sy = cos(lat0) * sin(lon0), sz = sin(lat0);
    let u = [-Math.sin(lon0 * RAD), Math.cos(lon0 * RAD), 0];
    const v = [sy * u[2] - sz * u[1], sz * u[0] - sx * u[2], sx * u[1] - sy * u[0]];
    const useky = [];
    let akt = [];
    for (let i = 0; i <= kroky; i++) {
      const t = i / kroky * 2 * Math.PI;
      const px = Math.cos(t) * u[0] + Math.sin(t) * v[0], py = Math.cos(t) * u[1] + Math.sin(t) * v[1], pz = Math.cos(t) * u[2] + Math.sin(t) * v[2];
      const lat = Math.asin(Math.max(-1, Math.min(1, pz))) * DEG, lon = Math.atan2(py, px) * DEG;
      const d = naDisku(lat, lon, e);
      if (d.z >= 0) akt.push(d);
      else if (akt.length) { useky.push(akt); akt = []; }
    }
    if (akt.length) useky.push(akt);
    // spojit první a poslední úsek, pokud na sebe navazují přes t = 0
    if (useky.length > 1) {
      const a = useky[0], z = useky[useky.length - 1];
      if (Math.hypot(a[0].x - z[z.length - 1].x, a[0].y - z[z.length - 1].y) < 0.05) { useky[0] = z.concat(a); useky.pop(); }
    }
    return useky;
  }

  // seznam pozorování: {jmeno: {datum: 'YYYY-MM-DD', pozn: ''}}
  function normPozorovani(d) {
    const out = {};
    if (!d || typeof d !== 'object') return out;
    for (const [k, v] of Object.entries(d)) {
      if (!v || typeof v !== 'object') continue;
      out[String(k).slice(0, 80)] = { datum: /^\d{4}-\d{2}-\d{2}$/.test(v.datum) ? v.datum : '', pozn: String(v.pozn || '').slice(0, 300) };
    }
    return out;
  }

  const ATLASM = {
    efemerida, efemeridaJde, stari, dalsiFaze, FAZE, nazevFaze, vyskaSlunce, rano, colongVychodu,
    naDisku, zDisku, uhelNatoceni, transformace, paralakticky, noc,
    TYPY, ALBEDO, prevod, bezDiakritiky, stavUtvaru, coPozorovat, vychodZapad, filtruj, terminator, normPozorovani,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ATLASM;
  else koren.ATLASM = ATLASM;
})(typeof window !== 'undefined' ? window : globalThis);
