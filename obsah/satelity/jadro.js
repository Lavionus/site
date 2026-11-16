/* ============================================================
   satelity/jadro.js – jádro stránky „Přelety ISS a satelitů“
   (obsah/satelity.html). Bez DOM, běží v prohlížeči i v node
   (test _test/satelity_test.js).

   - SGP4 pro blízké dráhy (oběžná doba < 225 min) podle
     Vallado, Crawford, Hujsak, Kelso: Revisiting Spacetrack
     Report #3 (AIAA 2006-6753), konstanty WGS-72, režim „improved“.
     Hluboký vesmír (SDP4) není potřeba – takové družice nejsou
     pouhým okem vidět – a prvky se odmítnou.
   - Souřadnice TEME → ECEF přes střední hvězdný čas (IAU-82),
     pozorovatel na elipsoidu WGS-84, bez polárního pohybu.
   - Slunce z obsah/sky_events/astro.js (Meeus kap. 25).
   - Stín Země válcový, jasnost z „standardní magnitudy“
     (1000 km, fázový úhel 90°) a difúzní koule.
   ============================================================ */
(function (koren) {
  'use strict';
  const ASTRO = typeof module !== 'undefined' && module.exports ? require('../sky_events/astro.js') : koren.ASTRO;
  const PI = Math.PI, DVA_PI = 2 * PI, RAD = PI / 180, DEG = 180 / PI, X2O3 = 2 / 3;

  /* ---------------- konstanty WGS-72 (SGP4) ---------------- */
  const MU = 398600.8, RE = 6378.135;
  const XKE = 60 / Math.sqrt(RE * RE * RE / MU);
  const J2 = 0.001082616, J3 = -0.00000253881, J4 = -0.00000165597, J3OJ2 = J3 / J2;
  const VKMS = RE * XKE / 60;
  /* elipsoid WGS-84 pro pozorovatele */
  const A84 = 6378.137, F84 = 1 / 298.257223563, E2 = F84 * (2 - F84);

  /* ---------------- čas ---------------- */
  const jdZData = d => d.getTime() / 86400000 + 2440587.5;
  const dataZJd = jd => new Date(Math.round((jd - 2440587.5) * 86400000));
  // střední hvězdný čas v Greenwichi [rad] (Vallado 2004, rov. 3-45)
  function gstime(jd) {
    const t = (jd - 2451545) / 36525;
    let g = -6.2e-6 * t * t * t + 0.093104 * t * t + (876600 * 3600 + 8640184.812866) * t + 67310.54841;
    g = (g * RAD / 240) % DVA_PI;
    return g < 0 ? g + DVA_PI : g;
  }

  /* ---------------- načtení prvků ---------------- */
  // pole „ 28098-4“ → 0.28098e-4
  function cisloSExp(s) {
    s = s.replace(/\s/g, '');
    const m = /^([+-]?)(\d*)([+-]\d)$/.exec(s);
    if (!m) return Number(s) || 0;
    return Number(m[1] + '0.' + (m[2] || '0')) * Math.pow(10, Number(m[3]));
  }
  function kontrolniSoucet(r) {
    let s = 0;
    for (const ch of r.slice(0, 68)) { if (ch >= '0' && ch <= '9') s += +ch; else if (ch === '-') s += 1; }
    return s % 10;
  }
  // dvouřádkové prvky; vrací {prvky, chyba}
  function zTle(r1, r2, nazev) {
    r1 = (r1 || '').trimEnd(); r2 = (r2 || '').trimEnd();
    if (r1[0] !== '1' || r2[0] !== '2' || r1.length < 64 || r2.length < 63) return { chyba: 'Řádky nejsou ve formátu TLE (1 … / 2 …).' };
    if (r1.length >= 69 && +r1[68] !== kontrolniSoucet(r1)) return { chyba: 'Nesedí kontrolní součet 1. řádku.' };
    if (r2.length >= 69 && +r2[68] !== kontrolniSoucet(r2)) return { chyba: 'Nesedí kontrolní součet 2. řádku.' };
    const rok2 = +r1.slice(18, 20), den = +r1.slice(20, 32);
    const rok = rok2 < 57 ? 2000 + rok2 : 1900 + rok2;
    const prvky = {
      nazev: (nazev || '').trim() || 'NORAD ' + r1.slice(2, 7).trim(),
      norad: r1.slice(2, 7).trim(),
      cospar: r1.slice(9, 17).trim(),
      jdEpocha: Date.UTC(rok, 0, 1) / 86400000 + 2440587.5 + den - 1,
      bstar: cisloSExp(r1.slice(53, 61)),
      sklon: +r2.slice(8, 16), uzel: +r2.slice(17, 25), exc: Number('0.' + r2.slice(26, 33).trim()),
      perigeum: +r2.slice(34, 42), anomalie: +r2.slice(43, 51), pohyb: +r2.slice(52, 63),
    };
    if (![prvky.jdEpocha, prvky.sklon, prvky.uzel, prvky.exc, prvky.perigeum, prvky.anomalie, prvky.pohyb].every(Number.isFinite)) return { chyba: 'Neplatná čísla v TLE.' };
    return { prvky };
  }
  // text se sadou TLE (2 nebo 3 řádky na družici)
  function nactiTleText(text) {
    const r = String(text).split(/\r?\n/).map(s => s.trimEnd()).filter(s => s.trim());
    const vysl = [], chyby = [];
    for (let i = 0; i < r.length; i++) {
      if (r[i][0] === '1' && r[i + 1] && r[i + 1][0] === '2' && r[i].length >= 64) {
        const nazev = i > 0 && r[i - 1][0] !== '1' && r[i - 1][0] !== '2' ? r[i - 1].replace(/^0 /, '') : '';
        const z = zTle(r[i], r[i + 1], nazev);
        if (z.prvky) vysl.push(z.prvky); else chyby.push(`${nazev || 'řádek ' + (i + 1)}: ${z.chyba}`);
        i++;
      }
    }
    return { prvky: vysl, chyby };
  }
  // CelesTrak GP data (OMM v JSON)
  function zOmm(o) {
    const t = Date.parse(o.EPOCH + (/[zZ]|[+-]\d\d:?\d\d$/.test(o.EPOCH) ? '' : 'Z'));
    return {
      nazev: o.OBJECT_NAME, norad: String(o.NORAD_CAT_ID), cospar: o.OBJECT_ID || '',
      jdEpocha: t / 86400000 + 2440587.5, bstar: +o.BSTAR || 0,
      sklon: +o.INCLINATION, uzel: +o.RA_OF_ASC_NODE, exc: +o.ECCENTRICITY,
      perigeum: +o.ARG_OF_PERICENTER, anomalie: +o.MEAN_ANOMALY, pohyb: +o.MEAN_MOTION,
    };
  }
  // jen pole, která potřebujeme (úspora místa v localStorage)
  const OMM_POLE = ['OBJECT_NAME', 'OBJECT_ID', 'NORAD_CAT_ID', 'EPOCH', 'MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE', 'ARG_OF_PERICENTER', 'MEAN_ANOMALY', 'BSTAR'];
  const zkratOmm = o => Object.fromEntries(OMM_POLE.map(k => [k, o[k]]));

  /* ---------------- SGP4 – inicializace ---------------- */
  function sgp4init(p) {
    const ecco = p.exc, inclo = p.sklon * RAD, nodeo = p.uzel * RAD, argpo = p.perigeum * RAD, mo = p.anomalie * RAD;
    const noKozai = p.pohyb / (1440 / DVA_PI), bstar = p.bstar;
    if (!(noKozai > 0) || !(ecco >= 0 && ecco < 1)) return { chyba: 'Neplatné prvky dráhy.' };
    // initl
    const eccsq = ecco * ecco, omeosq = 1 - eccsq, rteosq = Math.sqrt(omeosq);
    const cosio = Math.cos(inclo), cosio2 = cosio * cosio;
    const ak = Math.pow(XKE / noKozai, X2O3);
    const d1 = 0.75 * J2 * (3 * cosio2 - 1) / (rteosq * omeosq);
    let del = d1 / (ak * ak);
    const adel = ak * (1 - del * del - del * (1 / 3 + 134 * del * del / 81));
    del = d1 / (adel * adel);
    const no = noKozai / (1 + del);
    if (DVA_PI / no >= 225) return { chyba: 'Družice na vysoké dráze (doba oběhu ≥ 225 min) – SDP4 není podporován.' };
    const ao = Math.pow(XKE / no, X2O3);
    const sinio = Math.sin(inclo), po = ao * omeosq, con42 = 1 - 5 * cosio2, con41 = -con42 - cosio2 - cosio2;
    const posq = po * po, rp = ao * (1 - ecco);
    const s = { p, no, ecco, inclo, nodeo, argpo, mo, bstar, con41, isimp: rp < 220 / RE + 1 ? 1 : 0 };
    // sgp4init
    let sfour = 78 / RE + 1, qzms24 = Math.pow((120 - 78) / RE, 4);
    const perige = (rp - 1) * RE;
    if (perige < 156) {
      sfour = perige < 98 ? 20 : perige - 78;
      qzms24 = Math.pow((120 - sfour) / RE, 4);
      sfour = sfour / RE + 1;
    }
    const pinvsq = 1 / posq, tsi = 1 / (ao - sfour);
    s.eta = ao * ecco * tsi;
    const etasq = s.eta * s.eta, eeta = ecco * s.eta, psisq = Math.abs(1 - etasq);
    const coef = qzms24 * Math.pow(tsi, 4), coef1 = coef / Math.pow(psisq, 3.5);
    const cc2 = coef1 * no * (ao * (1 + 1.5 * etasq + eeta * (4 + etasq)) + 0.375 * J2 * tsi / psisq * con41 * (8 + 3 * etasq * (8 + etasq)));
    s.cc1 = bstar * cc2;
    const cc3 = ecco > 1e-4 ? -2 * coef * tsi * J3OJ2 * no * sinio / ecco : 0;
    s.x1mth2 = 1 - cosio2;
    s.cc4 = 2 * no * coef1 * ao * omeosq * (s.eta * (2 + 0.5 * etasq) + ecco * (0.5 + 2 * etasq) - J2 * tsi / (ao * psisq) *
      (-3 * con41 * (1 - 2 * eeta + etasq * (1.5 - 0.5 * eeta)) + 0.75 * s.x1mth2 * (2 * etasq - eeta * (1 + etasq)) * Math.cos(2 * argpo)));
    s.cc5 = 2 * coef1 * ao * omeosq * (1 + 2.75 * (etasq + eeta) + eeta * etasq);
    const cosio4 = cosio2 * cosio2;
    const temp1 = 1.5 * J2 * pinvsq * no, temp2 = 0.5 * temp1 * J2 * pinvsq, temp3 = -0.46875 * J4 * pinvsq * pinvsq * no;
    s.mdot = no + 0.5 * temp1 * rteosq * con41 + 0.0625 * temp2 * rteosq * (13 - 78 * cosio2 + 137 * cosio4);
    s.argpdot = -0.5 * temp1 * con42 + 0.0625 * temp2 * (7 - 114 * cosio2 + 395 * cosio4) + temp3 * (3 - 36 * cosio2 + 49 * cosio4);
    const xhdot1 = -temp1 * cosio;
    s.nodedot = xhdot1 + (0.5 * temp2 * (4 - 19 * cosio2) + 2 * temp3 * (3 - 7 * cosio2)) * cosio;
    s.omgcof = bstar * cc3 * Math.cos(argpo);
    s.xmcof = ecco > 1e-4 ? -X2O3 * coef * bstar / eeta : 0;
    s.nodecf = 3.5 * omeosq * xhdot1 * s.cc1;
    s.t2cof = 1.5 * s.cc1;
    s.xlcof = -0.25 * J3OJ2 * sinio * (3 + 5 * cosio) / (Math.abs(cosio + 1) > 1.5e-12 ? 1 + cosio : 1.5e-12);
    s.aycof = -0.5 * J3OJ2 * sinio;
    s.delmo = Math.pow(1 + s.eta * Math.cos(mo), 3);
    s.sinmao = Math.sin(mo);
    s.x7thm1 = 7 * cosio2 - 1;
    s.sinio = sinio; s.cosio = cosio;
    if (s.isimp !== 1) {
      const cc1sq = s.cc1 * s.cc1;
      s.d2 = 4 * ao * tsi * cc1sq;
      const temp = s.d2 * tsi * s.cc1 / 3;
      s.d3 = (17 * ao + sfour) * temp;
      s.d4 = 0.5 * temp * ao * tsi * (221 * ao + 31 * sfour) * s.cc1;
      s.t3cof = s.d2 + 2 * cc1sq;
      s.t4cof = 0.25 * (3 * s.d3 + s.cc1 * (12 * s.d2 + 10 * cc1sq));
      s.t5cof = 0.2 * (3 * s.d4 + 12 * s.cc1 * s.d3 + 6 * s.d2 * s.d2 + 15 * cc1sq * (2 * s.d2 + cc1sq));
    }
    return { sat: s };
  }

  /* ---------------- SGP4 – propagace ---------------- */
  // t = minuty od epochy; vrací {r:[km], v:[km/s]} v TEME, nebo {chyba}
  function sgp4(s, t) {
    const xmdf = s.mo + s.mdot * t, argpdf = s.argpo + s.argpdot * t, nodedf = s.nodeo + s.nodedot * t;
    let argpm = argpdf, mm = xmdf;
    const t2 = t * t;
    let nodem = nodedf + s.nodecf * t2, tempa = 1 - s.cc1 * t, tempe = s.bstar * s.cc4 * t, templ = s.t2cof * t2;
    if (s.isimp !== 1) {
      const delomg = s.omgcof * t;
      const delm = s.xmcof * (Math.pow(1 + s.eta * Math.cos(xmdf), 3) - s.delmo);
      const temp = delomg + delm;
      mm = xmdf + temp; argpm = argpdf - temp;
      const t3 = t2 * t, t4 = t3 * t;
      tempa = tempa - s.d2 * t2 - s.d3 * t3 - s.d4 * t4;
      tempe = tempe + s.bstar * s.cc5 * (Math.sin(mm) - s.sinmao);
      templ = templ + s.t3cof * t3 + t4 * (s.t4cof + t * s.t5cof);
    }
    let nm = s.no, em = s.ecco;
    const am = Math.pow(XKE / nm, X2O3) * tempa * tempa;
    nm = XKE / Math.pow(am, 1.5);
    em -= tempe;
    if (em >= 1 || em < -0.001 || !(am > 0)) return { chyba: 1 };
    if (em < 1e-6) em = 1e-6;
    mm += s.no * templ;
    let xlm = mm + argpm + nodem;
    nodem %= DVA_PI; argpm %= DVA_PI; xlm %= DVA_PI;
    mm = (xlm - argpm - nodem) % DVA_PI;
    const ep = em, argpp = argpm, nodep = nodem, mp = mm, sinip = s.sinio, cosip = s.cosio;
    // Keplerova rovnice s dlouhoperiodickými členy
    const axnl = ep * Math.cos(argpp);
    let temp = 1 / (am * (1 - ep * ep));
    const aynl = ep * Math.sin(argpp) + temp * s.aycof;
    const xl = mp + argpp + nodep + temp * s.xlcof * axnl;
    const u = (xl - nodep) % DVA_PI;
    let eo1 = u, tem5 = 9999.9, ktr = 1, sineo1 = 0, coseo1 = 0;
    while (Math.abs(tem5) >= 1e-12 && ktr <= 10) {
      sineo1 = Math.sin(eo1); coseo1 = Math.cos(eo1);
      tem5 = 1 - coseo1 * axnl - sineo1 * aynl;
      tem5 = (u - aynl * coseo1 + axnl * sineo1 - eo1) / tem5;
      if (Math.abs(tem5) >= 0.95) tem5 = tem5 > 0 ? 0.95 : -0.95;
      eo1 += tem5; ktr++;
    }
    // krátkoperiodické členy
    const ecose = axnl * coseo1 + aynl * sineo1, esine = axnl * sineo1 - aynl * coseo1;
    const el2 = axnl * axnl + aynl * aynl, pl = am * (1 - el2);
    if (pl < 0) return { chyba: 4 };
    const rl = am * (1 - ecose), rdotl = Math.sqrt(am) * esine / rl, rvdotl = Math.sqrt(pl) / rl;
    const betal = Math.sqrt(1 - el2);
    temp = esine / (1 + betal);
    const sinu = am / rl * (sineo1 - aynl - axnl * temp), cosu = am / rl * (coseo1 - axnl + aynl * temp);
    let su = Math.atan2(sinu, cosu);
    const sin2u = (cosu + cosu) * sinu, cos2u = 1 - 2 * sinu * sinu;
    temp = 1 / pl;
    const temp1 = 0.5 * J2 * temp, temp2 = temp1 * temp;
    const mrt = rl * (1 - 1.5 * temp2 * betal * s.con41) + 0.5 * temp1 * s.x1mth2 * cos2u;
    su -= 0.25 * temp2 * s.x7thm1 * sin2u;
    const xnode = nodep + 1.5 * temp2 * cosip * sin2u;
    const xinc = s.inclo + 1.5 * temp2 * cosip * sinip * cos2u;
    const mvt = rdotl - nm * temp1 * s.x1mth2 * sin2u / XKE;
    const rvdot = rvdotl + nm * temp1 * (s.x1mth2 * cos2u + 1.5 * s.con41) / XKE;
    const sinsu = Math.sin(su), cossu = Math.cos(su), snod = Math.sin(xnode), cnod = Math.cos(xnode);
    const sini = Math.sin(xinc), cosi = Math.cos(xinc);
    const xmx = -snod * cosi, xmy = cnod * cosi;
    const ux = xmx * sinsu + cnod * cossu, uy = xmy * sinsu + snod * cossu, uz = sini * sinsu;
    const vx = xmx * cossu - cnod * sinsu, vy = xmy * cossu - snod * sinsu, vz = sini * cossu;
    if (mrt < 1) return { chyba: 6 };   // družice zanikla (pod povrchem)
    const mr = mrt * RE;
    return {
      r: [mr * ux, mr * uy, mr * uz],
      v: [(mvt * ux + rvdot * vx) * VKMS, (mvt * uy + rvdot * vy) * VKMS, (mvt * uz + rvdot * vz) * VKMS],
    };
  }

  /* ---------------- družice: prvky + inicializovaný model ---------------- */
  // standardní magnituda (1000 km, fáze 90°) – přibližné hodnoty (Heavens-Above, McCants); ostatní 4,0
  const STD_MAG = { 25544: -1.8, 48274: -0.8, 20580: 2.2 };
  const STD_MAG_NAZEV = [[/^STARLINK/, 4.5], [/^SL-16 R\/B/, 2.0], [/^SPACEMOBILE|^BLUEBIRD/, 3.0], [/^SL-8 R\/B/, 4.2], [/ R\/B/, 3.5]];
  function stdMag(p) {
    if (STD_MAG[p.norad] != null) return STD_MAG[p.norad];
    for (const [re, m] of STD_MAG_NAZEV) if (re.test(p.nazev)) return m;
    return 4.0;
  }
  // skupina pro „vlak“: Starlinky z jednoho startu (COSPAR rok-číslo)
  const skupinaVlaku = p => /^STARLINK/.test(p.nazev) && p.cospar ? p.cospar.slice(0, 8) : '';
  function druzice(p) {
    const i = sgp4init(p);
    if (i.chyba) return { chyba: i.chyba, prvky: p };
    return { ...p, model: i.sat, mag0: p.mag0 != null ? p.mag0 : stdMag(p), vlak: skupinaVlaku(p), doba: 1440 / p.pohyb };
  }
  // poloha v TEME pro juliánské datum
  const polohaTeme = (d, jd) => sgp4(d.model, (jd - d.jdEpocha) * 1440);

  /* ---------------- souřadnice ---------------- */
  // pozorovatel {lat, lon, vyska [m]} → ECEF [km] + jednotkový vektor nahoru
  function pozorovatel(m) {
    const fi = m.lat * RAD, la = m.lon * RAD, h = (m.vyska || 0) / 1000;
    const N = A84 / Math.sqrt(1 - E2 * Math.sin(fi) ** 2);
    return {
      ...m, fi, la,
      x: (N + h) * Math.cos(fi) * Math.cos(la), y: (N + h) * Math.cos(fi) * Math.sin(la), z: (N * (1 - E2) + h) * Math.sin(fi),
      up: [Math.cos(fi) * Math.cos(la), Math.cos(fi) * Math.sin(la), Math.sin(fi)],
    };
  }
  const tecnaNaEcef = (r, g) => [Math.cos(g) * r[0] + Math.sin(g) * r[1], -Math.sin(g) * r[0] + Math.cos(g) * r[1], r[2]];
  const ecefNaTeme = (r, g) => [Math.cos(g) * r[0] - Math.sin(g) * r[1], Math.sin(g) * r[0] + Math.cos(g) * r[1], r[2]];
  const skal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // ECEF → zeměpisné souřadnice (WGS-84, iterace)
  function geodeticke(r) {
    const p = Math.hypot(r[0], r[1]);
    let lat = Math.atan2(r[2], p * (1 - E2)), N = A84;
    for (let i = 0; i < 5; i++) {
      N = A84 / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
      lat = Math.atan2(r[2] + E2 * N * Math.sin(lat), p);
    }
    return { lat: lat * DEG, lon: Math.atan2(r[1], r[0]) * DEG, vyska: p / Math.cos(lat) - N };
  }
  // jednotkový směr ke Slunci v rovníkových souřadnicích data (≈ TEME)
  function slunceSmer(jd) {
    const s = ASTRO.slunce(ASTRO.utNaJde(jd));
    const ra = s.ra * RAD, de = s.dec * RAD;
    return [Math.cos(de) * Math.cos(ra), Math.cos(de) * Math.sin(ra), Math.sin(de)];
  }
  // výška Slunce nad obzorem pozorovatele [°] (geocentrický směr, paralaxa 9″ zanedbána)
  const vyskaSlunce = (P, slunce, g) => Math.asin(skal(ecefNaTeme(P.up, g), slunce)) * DEG;
  // osvětlení Sluncem: válcový stín Země
  function osvetlena(r, slunce) {
    const p = skal(r, slunce);
    if (p > 0) return true;
    return Math.hypot(r[0] - p * slunce[0], r[1] - p * slunce[1], r[2] - p * slunce[2]) > A84;
  }
  // magnituda: m = std + 5·log(d/1000) − 2,5·log(sin φ + (π − φ)·cos φ)
  function magnituda(mag0, vzdalenost, fazovyUhel) {
    const f = Math.sin(fazovyUhel) + (PI - fazovyUhel) * Math.cos(fazovyUhel);
    if (f <= 1e-6) return 99;
    return mag0 + 5 * Math.log10(vzdalenost / 1000) - 2.5 * Math.log10(f);
  }

  // kompletní stav družice pro pozorovatele v čase jd; slunce/g lze předat z mřížky
  function stav(d, P, jd, slunce, g) {
    const pv = polohaTeme(d, jd);
    if (pv.chyba) return null;
    if (g == null) g = gstime(jd);
    if (!slunce) slunce = slunceSmer(jd);
    const r = pv.r, e = tecnaNaEcef(r, g);
    const dx = e[0] - P.x, dy = e[1] - P.y, dz = e[2] - P.z;
    const sf = Math.sin(P.fi), cf = Math.cos(P.fi), sl = Math.sin(P.la), cl = Math.cos(P.la);
    const jih = sf * cl * dx + sf * sl * dy - cf * dz;
    const vychod = -sl * dx + cl * dy;
    const zenit = cf * cl * dx + cf * sl * dy + sf * dz;
    const vzd = Math.hypot(dx, dy, dz);
    let az = Math.atan2(vychod, -jih) * DEG; if (az < 0) az += 360;
    const lit = osvetlena(r, slunce);
    const o = ecefNaTeme([P.x, P.y, P.z], g);
    const k = [o[0] - r[0], o[1] - r[1], o[2] - r[2]];
    const faze = Math.acos(Math.max(-1, Math.min(1, skal(k, slunce) / vzd)));
    return {
      el: Math.asin(zenit / vzd) * DEG, az, vzd, lit, faze: faze * DEG,
      mag: lit ? magnituda(d.mag0, vzd, faze) : null,
      slunceVys: vyskaSlunce(P, slunce, g), r, ecef: e,
    };
  }
  // poloha nad Zemí (pro mapu)
  function podbod(d, jd) {
    const pv = polohaTeme(d, jd);
    if (pv.chyba) return null;
    const g = gstime(jd), e = tecnaNaEcef(pv.r, g);
    return { ...geodeticke(e), lit: osvetlena(pv.r, slunceSmer(jd)), rychlost: Math.hypot(...pv.v) };
  }
  // stopa na zemi: pole bodů {lat, lon, jd}
  function stopa(d, jd0, jd1, krokMin = 1) {
    const out = [];
    for (let jd = jd0; jd <= jd1 + 1e-9; jd += krokMin / 1440) { const b = podbod(d, jd); if (b) out.push({ lat: b.lat, lon: b.lon, jd }); }
    return out;
  }
  // stopu rozdělit na úseky, aby čára nepřeskakovala přes celou mapu u ±180°
  function rozdelStopu(body) {
    const useky = []; let u = [];
    for (let i = 0; i < body.length; i++) {
      if (i && Math.abs(body[i].lon - body[i - 1].lon) > 180) { useky.push(u); u = []; }
      u.push([body[i].lat, body[i].lon]);
    }
    if (u.length) useky.push(u);
    return useky;
  }
  // úhlový poloměr oblasti, odkud je družice nad obzorem (pro kružnici na mapě), km na povrchu
  const dosahKm = (vyskaKm, minEl = 0) => {
    const e = minEl * RAD, Rz = A84;
    const lam = Math.acos(Rz / (Rz + vyskaKm) * Math.cos(e)) - e;
    return lam * Rz;
  };

  /* ---------------- hledání přeletů ---------------- */
  const NASTAVENI = { minVyska: 10, slunceMax: -6, krokS: 30 };
  // společná časová mřížka pro všechny družice (směr Slunce, hvězdný čas, tma)
  function mrizka(misto, jd0, jd1, nast = {}) {
    const n = { ...NASTAVENI, ...nast }, P = pozorovatel(misto);
    const krok = n.krokS / 86400, pocet = Math.ceil((jd1 - jd0) / krok) + 1;
    const jd = new Float64Array(pocet), g = new Float64Array(pocet), tma = new Uint8Array(pocet), slunce = new Array(pocet);
    for (let i = 0; i < pocet; i++) {
      jd[i] = jd0 + i * krok; g[i] = gstime(jd[i]); slunce[i] = slunceSmer(jd[i]);
      tma[i] = vyskaSlunce(P, slunce[i], g[i]) < n.slunceMax ? 1 : 0;
    }
    return { n, P, jd, g, tma, slunce, pocet, jd0, jd1 };
  }
  const viditelna = (s, n) => s && s.el >= n.minVyska && s.lit && s.slunceVys < n.slunceMax;
  // důvod začátku/konce viditelnosti
  function pricina(s, n) {
    if (!s || s.el < n.minVyska) return 'obzor';
    if (!s.lit) return 'stin';
    return 'soumrak';
  }
  // hranice mezi neviditelným (a) a viditelným (b) okamžikem půlením na ~1 s
  function hrana(d, M, a, b) {
    for (let i = 0; i < 6; i++) {
      const c = (a + b) / 2;
      if (viditelna(stav(d, M.P, c), M.n)) b = c; else a = c;
    }
    return b;
  }
  const bod = (s, jd) => ({ jd, az: s.az, el: s.el, mag: s.mag, vzd: s.vzd });
  function preletyDruzice(d, M) {
    const out = [], n = M.n;
    let zac = -1;
    const uzavri = (i0, i1) => {
      const t0 = i0 > 0 ? hrana(d, M, M.jd[i0 - 1], M.jd[i0]) : M.jd[i0];
      const t1 = i1 < M.pocet - 1 ? hrana(d, M, M.jd[i1 + 1], M.jd[i1]) : M.jd[i1];
      // vrchol a nejvyšší jasnost po 5 s
      let vrch = null, nejMag = 99, kroky = Math.max(2, Math.ceil((t1 - t0) * 86400 / 5));
      for (let k = 0; k <= kroky; k++) {
        const t = t0 + (t1 - t0) * k / kroky, s = stav(d, M.P, t);
        if (!s) continue;
        if (!vrch || s.el > vrch.el) vrch = bod(s, t);
        if (s.mag != null && s.mag < nejMag) nejMag = s.mag;
      }
      const s0 = stav(d, M.P, t0), s1 = stav(d, M.P, t1);
      if (!s0 || !s1 || !vrch) return;
      const p0 = stav(d, M.P, t0 - 2 / 86400), p1 = stav(d, M.P, t1 + 2 / 86400);
      out.push({
        norad: d.norad, nazev: d.nazev, vlak: d.vlak,
        zacatek: bod(s0, t0), vrchol: vrch, konec: bod(s1, t1), mag: nejMag,
        trvani: (t1 - t0) * 86400,
        zacPricina: i0 > 0 ? pricina(p0, n) : 'okno', konPricina: i1 < M.pocet - 1 ? pricina(p1, n) : 'okno',
      });
    };
    for (let i = 0; i < M.pocet; i++) {
      let vid = false;
      if (M.tma[i]) {
        const s = stav(d, M.P, M.jd[i], M.slunce[i], M.g[i]);
        vid = viditelna(s, n);
      }
      if (vid && zac < 0) zac = i;
      if (!vid && zac >= 0) { uzavri(zac, i - 1); zac = -1; }
    }
    if (zac >= 0) uzavri(zac, M.pocet - 1);
    return out;
  }
  // všechny přelety; maxMag = filtr jasnosti (null = bez filtru)
  function prelety(druziceSeznam, misto, jd0, jd1, nast = {}) {
    const M = mrizka(misto, jd0, jd1, nast);
    let vse = [];
    for (const d of druziceSeznam) if (d.model) vse = vse.concat(preletyDruzice(d, M));
    return filtruj(seskupVlaky(vse), nast.maxMag);
  }
  const filtruj = (p, maxMag) => (maxMag == null ? p : p.filter(x => x.mag <= maxMag)).sort((a, b) => a.zacatek.jd - b.zacatek.jd);
  // Starlinky z jednoho startu, které začnou přelet do 15 min po prvním → jeden „vlak“
  function seskupVlaky(seznam) {
    const out = [], vlaky = new Map();
    for (const p of seznam.slice().sort((a, b) => a.zacatek.jd - b.zacatek.jd)) {
      if (!p.vlak) { out.push(p); continue; }
      const v = vlaky.get(p.vlak);
      if (v && p.zacatek.jd - v.zacatek.jd < 15 / 1440 && !v.clenove.some(c => c.norad === p.norad)) {
        v.clenove.push(p);
        if (p.konec.jd > v.konec.jd) v.konec = p.konec;
        if (p.vrchol.el > v.vrchol.el) v.vrchol = p.vrchol;
        v.mag = Math.min(v.mag, p.mag);
        v.trvani = (v.konec.jd - v.zacatek.jd) * 86400;
        v.nazev = `Starlink vlak ${p.vlak} (${v.clenove.length} ${v.clenove.length < 5 ? 'družice' : 'družic'})`;
        continue;
      }
      const novy = { ...p, clenove: [p] };
      vlaky.set(p.vlak, novy); out.push(novy);
    }
    for (const p of out) if (p.clenove && p.clenove.length === 1) { delete p.clenove; }
    return out;
  }
  // body dráhy přeletu pro mapu oblohy
  function drahaPreletu(d, misto, jd0, jd1, krokS = 10) {
    const P = pozorovatel(misto), out = [];
    for (let t = jd0; t <= jd1 + 1e-9; t += krokS / 86400) {
      const s = stav(d, P, t);
      if (s) out.push({ jd: t, az: s.az, el: s.el, lit: s.lit, mag: s.mag });
    }
    return out;
  }
  // družice nad obzorem právě teď
  function nadObzorem(druziceSeznam, misto, jd, minEl = 0) {
    const P = pozorovatel(misto), g = gstime(jd), sl = slunceSmer(jd), out = [];
    for (const d of druziceSeznam) {
      if (!d.model) continue;
      const s = stav(d, P, jd, sl, g);
      if (s && s.el >= minEl) out.push({ d, s });
    }
    return out;
  }

  /* ---------------- výstupy ---------------- */
  const SVETOVE_STRANY = ['S', 'SSV', 'SV', 'VSV', 'V', 'VJV', 'JV', 'JJV', 'J', 'JJZ', 'JZ', 'ZJZ', 'Z', 'ZSZ', 'SZ', 'SSZ'];
  const strana = az => SVETOVE_STRANY[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];
  const PRICINY = { obzor: 'nad obzorem', stin: 'stín Země', soumrak: 'soumrak', okno: 'mimo okno výpočtu' };
  // stáří prvků ve dnech
  const stariPrvku = (d, jd) => jd - d.jdEpocha;
  function popisPreletu(p, cas) {
    const f = b => `${cas(b.jd)} ${strana(b.az)} (${Math.round(b.az)}°) ${Math.round(b.el)}°`;
    return [`Jasnost až ${p.mag.toFixed(1)} mag`, 'Začátek: ' + f(p.zacatek) + (p.zacPricina === 'stin' ? ', vyjde ze stínu' : ''),
      'Vrchol: ' + f(p.vrchol), 'Konec: ' + f(p.konec) + (p.konPricina === 'stin' ? ', zmizí ve stínu Země' : '')].join('\n');
  }
  function ics(seznam, cas, nazevMista) {
    return ASTRO.ics(seznam.map(p => ({
      id: `${p.norad}-${Math.round(p.zacatek.jd * 86400)}`,
      datum: dataZJd(p.zacatek.jd), konec: dataZJd(p.konec.jd),
      nazev: `🛰️ ${p.nazev} (${p.mag.toFixed(1)} mag, ${Math.round(p.vrchol.el)}°)`,
      popis: popisPreletu(p, cas) + (nazevMista ? '\nMísto: ' + nazevMista : ''),
    })), 'Přelety družic');
  }

  const SAT = {
    jdZData, dataZJd, gstime, cisloSExp, kontrolniSoucet, zTle, nactiTleText, zOmm, zkratOmm, OMM_POLE,
    sgp4init, sgp4, druzice, polohaTeme, stdMag, STD_MAG, skupinaVlaku,
    pozorovatel, geodeticke, slunceSmer, osvetlena, magnituda, stav, podbod, stopa, rozdelStopu, dosahKm,
    NASTAVENI, mrizka, preletyDruzice, prelety, seskupVlaky, filtruj, drahaPreletu, nadObzorem,
    strana, PRICINY, stariPrvku, popisPreletu, ics,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SAT;
  else koren.SAT = SAT;
})(typeof window !== 'undefined' ? window : globalThis);
