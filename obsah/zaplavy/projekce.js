/* ============================================================
   zaplavy/projekce.js – souřadnicové systémy pro import rastrů.
   Čistý modul bez DOM (testuje se v node).

   Podporované systémy (kód EPSG):
     4326, 4258        zeměpisné souřadnice WGS 84 / ETRS89 (rozdíl < 1 m zanedbán)
     3857 (102100, 900913)  Web Mercator (koule R = 6 378 137 m)
     5514 (102067)     S-JTSK / Křovák East-North (záporné souřadnice, jak je dává ČÚZK)
     2065              S-JTSK / Křovák (kladné X jižně, Y západně)
     326zz, 327zz      WGS 84 / UTM sever, jih
     258zz             ETRS89 / UTM sever (zóny 28–38)

   Křovák podle EPSG Guidance Note 7-2 (metoda 9819), přechod S-JTSK ↔ WGS 84
   7prvkovou Helmertovou transformací (konvence „position vector“, jak ji používá
   PROJ v +towgs84=570.8,85.7,462.8,4.998,1.587,5.261,3.56; přesnost řádově 1 m).
   UTM Krügerovou řadou 3. řádu v n (chyba pod 1 mm uvnitř zóny).
   ============================================================ */
(function () {
  'use strict';
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const WGS84 = { a: 6378137, f: 1 / 298.257223563 };
  const BESSEL = { a: 6377397.155, f: 1 / 299.1528128 };
  const R_MERC = 6378137;

  // ---------- Web Mercator ----------
  function lonLatNaMerc(lon, lat) {
    const la = Math.max(-85.0511287798, Math.min(85.0511287798, lat));
    return [R_MERC * lon * D2R, R_MERC * Math.log(Math.tan(Math.PI / 4 + la * D2R / 2))];
  }
  function mercNaLonLat(x, y) {
    return [x / R_MERC * R2D, (2 * Math.atan(Math.exp(y / R_MERC)) - Math.PI / 2) * R2D];
  }

  // ---------- elipsoid ↔ pravoúhlé geocentrické ----------
  function geoNaEcef(el, lon, lat, h) {
    const e2 = el.f * (2 - el.f), sf = Math.sin(lat * D2R), cf = Math.cos(lat * D2R);
    const N = el.a / Math.sqrt(1 - e2 * sf * sf);
    return [(N + h) * cf * Math.cos(lon * D2R), (N + h) * cf * Math.sin(lon * D2R), (N * (1 - e2) + h) * sf];
  }
  function ecefNaGeo(el, X, Y, Z) {
    const e2 = el.f * (2 - el.f), p = Math.hypot(X, Y);
    let lat = Math.atan2(Z, p * (1 - e2)), h = 0;
    for (let i = 0; i < 8; i++) {
      const sf = Math.sin(lat), N = el.a / Math.sqrt(1 - e2 * sf * sf);
      h = p / Math.cos(lat) - N;
      lat = Math.atan2(Z, p * (1 - e2 * N / (N + h)));
    }
    return [Math.atan2(Y, X) * R2D, lat * R2D, h];
  }
  // Helmert, position vector: X' = T + (1 + s) · R · X
  const SJTSK_WGS = { tx: 570.8, ty: 85.7, tz: 462.8, rx: 4.998, ry: 1.587, rz: 5.261, s: 3.56 };
  function helmert(p, P, smer) {
    const k = smer, AS = D2R / 3600;
    const rx = k * P.rx * AS, ry = k * P.ry * AS, rz = k * P.rz * AS, s = 1 + k * P.s * 1e-6;
    const [x, y, z] = smer > 0 ? p : [p[0] - P.tx, p[1] - P.ty, p[2] - P.tz];
    const X = s * (x - rz * y + ry * z), Y = s * (rz * x + y - rx * z), Z = s * (-ry * x + rx * y + z);
    return smer > 0 ? [X + P.tx, Y + P.ty, Z + P.tz] : [X, Y, Z];
  }
  function wgsNaBessel(lon, lat) {
    const p = helmert(geoNaEcef(WGS84, lon, lat, 0), SJTSK_WGS, -1);
    const g = ecefNaGeo(BESSEL, p[0], p[1], p[2]); return [g[0], g[1]];
  }
  function besselNaWgs(lon, lat) {
    const p = helmert(geoNaEcef(BESSEL, lon, lat, 0), SJTSK_WGS, 1);
    const g = ecefNaGeo(WGS84, p[0], p[1], p[2]); return [g[0], g[1]];
  }

  // ---------- Křovák (EPSG 9819) na Besselově elipsoidu ----------
  const KR = (function () {
    const a = BESSEL.a, e2 = BESSEL.f * (2 - BESSEL.f), e = Math.sqrt(e2);
    const fc = 49.5 * D2R, l0 = (24 + 50 / 60) * D2R;
    const ac = (30 + 17 / 60 + 17.30311 / 3600) * D2R, fp = 78.5 * D2R, k0 = 0.9999;
    const A = a * Math.sqrt(1 - e2) / (1 - e2 * Math.sin(fc) ** 2);
    const B = Math.sqrt(1 + e2 * Math.cos(fc) ** 4 / (1 - e2));
    const g0 = Math.asin(Math.sin(fc) / B);
    const t0 = Math.tan(Math.PI / 4 + g0 / 2) * Math.pow((1 + e * Math.sin(fc)) / (1 - e * Math.sin(fc)), e * B / 2) / Math.pow(Math.tan(Math.PI / 4 + fc / 2), B);
    const n = Math.sin(fp), r0 = k0 * A / Math.tan(fp);
    return { e, l0, ac, fp, B, t0, n, r0 };
  })();
  /** Besselovy zem. souřadnice (°) → [Southing X, Westing Y] (kladné, EPSG:2065) */
  function krovakVpred(lon, lat) {
    const { e, l0, ac, fp, B, t0, n, r0 } = KR, f = lat * D2R, l = lon * D2R;
    const U = 2 * (Math.atan(t0 * Math.pow(Math.tan(f / 2 + Math.PI / 4), B) / Math.pow((1 + e * Math.sin(f)) / (1 - e * Math.sin(f)), e * B / 2)) - Math.PI / 4);
    const V = B * (l0 - l);
    const T = Math.asin(Math.cos(ac) * Math.sin(U) + Math.sin(ac) * Math.cos(U) * Math.cos(V));
    const D = Math.asin(Math.cos(U) * Math.sin(V) / Math.cos(T));
    const th = n * D;
    const r = r0 * Math.pow(Math.tan(Math.PI / 4 + fp / 2), n) / Math.pow(Math.tan(T / 2 + Math.PI / 4), n);
    return [r * Math.cos(th), r * Math.sin(th)];
  }
  function krovakZpet(X, Y) {
    const { e, l0, ac, fp, B, t0, n, r0 } = KR;
    const r = Math.hypot(X, Y), th = Math.atan2(Y, X), D = th / Math.sin(fp);
    const T = 2 * (Math.atan(Math.pow(r0 / r, 1 / n) * Math.tan(Math.PI / 4 + fp / 2)) - Math.PI / 4);
    const U = Math.asin(Math.cos(ac) * Math.sin(T) - Math.sin(ac) * Math.cos(T) * Math.cos(D));
    const V = Math.asin(Math.cos(T) * Math.sin(D) / Math.cos(U));
    const l = l0 - V / B;
    let f = U;
    for (let i = 0; i < 12; i++) {
      f = 2 * (Math.atan(Math.pow(t0, -1 / B) * Math.pow(Math.tan(U / 2 + Math.PI / 4), 1 / B) * Math.pow((1 + e * Math.sin(f)) / (1 - e * Math.sin(f)), e / 2)) - Math.PI / 4);
    }
    return [l * R2D, f * R2D];
  }

  // ---------- UTM (Krüger, n-řada) ----------
  const UT = (function () {
    const f = WGS84.f, n = f / (2 - f), n2 = n * n, n3 = n2 * n;
    return {
      A: WGS84.a / (1 + n) * (1 + n2 / 4 + n2 * n2 / 64), e: Math.sqrt(f * (2 - f)),
      al: [n / 2 - 2 * n2 / 3 + 5 * n3 / 16, 13 * n2 / 48 - 3 * n3 / 5, 61 * n3 / 240],
      be: [n / 2 - 2 * n2 / 3 + 37 * n3 / 96, n2 / 48 + n3 / 15, 17 * n3 / 480],
      de: [2 * n - 2 * n2 / 3 - 2 * n3, 7 * n2 / 3 - 8 * n3 / 5, 56 * n3 / 15]
    };
  })();
  function utmVpred(lon, lat, zona, jih) {
    const l0 = (zona * 6 - 183) * D2R, f = lat * D2R, dl = lon * D2R - l0, k0 = 0.9996;
    const sf = Math.sin(f);
    const t = Math.sinh(Math.atanh(sf) - UT.e * Math.atanh(UT.e * sf));
    const xi = Math.atan2(t, Math.cos(dl)), eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
    let E = eta, N = xi;
    for (let j = 1; j <= 3; j++) {
      E += UT.al[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
      N += UT.al[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    }
    return [500000 + k0 * UT.A * E, (jih ? 10000000 : 0) + k0 * UT.A * N];
  }
  function utmZpet(E, N, zona, jih) {
    const k0 = 0.9996, l0 = (zona * 6 - 183) * D2R;
    const xi = (N - (jih ? 10000000 : 0)) / (k0 * UT.A), eta = (E - 500000) / (k0 * UT.A);
    let xs = xi, es = eta;
    for (let j = 1; j <= 3; j++) {
      xs -= UT.be[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
      es -= UT.be[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    }
    const chi = Math.asin(Math.sin(xs) / Math.cosh(es));
    let f = chi;
    for (let j = 1; j <= 3; j++) f += UT.de[j - 1] * Math.sin(2 * j * chi);
    return [(l0 + Math.atan2(Math.sinh(es), Math.cos(xs))) * R2D, f * R2D];
  }

  // ---------- registr systémů ----------
  /** Vrátí {kod, nazev, geograficky, vpred(lon,lat)→[x,y], zpet(x,y)→[lon,lat]} nebo null. */
  function system(kod) {
    kod = Number(kod);
    if (kod === 4326 || kod === 4258 || kod === 4979 || kod === 4937) return {
      kod, nazev: kod === 4258 ? 'ETRS89 – zeměpisné souřadnice' : 'WGS 84 – zeměpisné souřadnice', geograficky: true,
      vpred: (lon, lat) => [lon, lat], zpet: (x, y) => [x, y] };
    if (kod === 3857 || kod === 102100 || kod === 900913 || kod === 3785) return {
      kod: 3857, nazev: 'WGS 84 / Pseudo-Mercator (Web Mercator)', geograficky: false, vpred: lonLatNaMerc, zpet: mercNaLonLat };
    if (kod === 5514 || kod === 102067) return {
      kod: 5514, nazev: 'S-JTSK / Křovák East North', geograficky: false,
      vpred: (lon, lat) => { const b = wgsNaBessel(lon, lat), k = krovakVpred(b[0], b[1]); return [-k[1], -k[0]]; },
      zpet: (x, y) => { const b = krovakZpet(-y, -x); return besselNaWgs(b[0], b[1]); } };
    if (kod === 2065 || kod === 5513) return {
      kod, nazev: 'S-JTSK / Křovák (X jih, Y západ)', geograficky: false,
      vpred: (lon, lat) => { const b = wgsNaBessel(lon, lat), k = krovakVpred(b[0], b[1]); return [k[1], k[0]]; },
      zpet: (x, y) => { const b = krovakZpet(y, x); return besselNaWgs(b[0], b[1]); } };
    let zona = 0, jih = false, nazev = '';
    if (kod >= 32601 && kod <= 32660) { zona = kod - 32600; nazev = 'WGS 84 / UTM ' + zona + 'N'; }
    else if (kod >= 32701 && kod <= 32760) { zona = kod - 32700; jih = true; nazev = 'WGS 84 / UTM ' + zona + 'S'; }
    else if (kod >= 25828 && kod <= 25838) { zona = kod - 25800; nazev = 'ETRS89 / UTM ' + zona + 'N'; }
    if (zona) return { kod, nazev, geograficky: false,
      vpred: (lon, lat) => utmVpred(lon, lat, zona, jih), zpet: (x, y) => utmZpet(x, y, zona, jih) };
    return null;
  }
  const NABIDKA = [
    [5514, 'S-JTSK / Křovák East North (ČÚZK, záporné souř.)'], [2065, 'S-JTSK / Křovák (kladné X, Y)'],
    [4326, 'WGS 84 – zeměpisné (°)'], [4258, 'ETRS89 – zeměpisné (°)'], [3857, 'Web Mercator'],
    [32633, 'WGS 84 / UTM 33N'], [32634, 'WGS 84 / UTM 34N'], [32632, 'WGS 84 / UTM 32N'],
    [25833, 'ETRS89 / UTM 33N'], [25834, 'ETRS89 / UTM 34N'], [25832, 'ETRS89 / UTM 32N']
  ];

  /** Odhad systému z WKT (.prj) – vrací kód EPSG nebo 0. */
  function kodZWkt(wkt) {
    if (!wkt) return 0;
    const t = String(wkt);
    const auth = [...t.matchAll(/(?:AUTHORITY|ID)\s*\[\s*"EPSG"\s*,\s*"?(\d+)"?\s*\]/gi)].map(m => +m[1]);
    // u PROJCS je poslední AUTHORITY ta celého systému
    const prvni = t.trim().toUpperCase();
    if (auth.length && /^(PROJCS|PROJCRS|GEOGCS|GEOGCRS|GEODCRS)/.test(prvni)) {
      const k = auth[auth.length - 1]; if (system(k)) return k;
    }
    return kodZNazvu(t);
  }
  /** Odhad z textového popisu (citace GeoTIFF, název v WKT). */
  function kodZNazvu(t) {
    const s = String(t || '').toLowerCase();
    if (/krovak|křovák|s-jtsk|s_jtsk|jtsk/.test(s)) return /east.?north|5514|102067/.test(s) || !/2065/.test(s) ? 5514 : 2065;
    if (/pseudo.?mercator|web.?mercator|auxiliary.?sphere|popular.?visualisation/.test(s)) return 3857;
    const u = s.match(/utm[_ ]?zone[_ ]?(\d{1,2})\s*([ns])?/);
    if (u) {
      const z = +u[1], jih = u[2] === 's';
      if (/etrs/.test(s) && !jih && z >= 28 && z <= 38) return 25800 + z;
      return (jih ? 32700 : 32600) + z;
    }
    if (/^\s*geogcs|^\s*geogcrs|^\s*geodcrs/.test(s) || /wgs[ _]?84|wgs_1984/.test(s) && !/projcs|projcrs/.test(s)) return /etrs/.test(s) ? 4258 : 4326;
    return 0;
  }
  /** Hádání systému podle rozsahu souřadnic (ASCII grid bez .prj). */
  function hadejZRozsahu(xmin, ymin, xmax, ymax) {
    if (xmin >= -180 && xmax <= 180 && ymin >= -90 && ymax <= 90) return 4326;
    if (xmax < -400000 && xmin > -950000 && ymax < -900000 && ymin > -1300000) return 5514;
    if (xmin > 400000 && xmax < 950000 && ymin > 900000 && ymax < 1300000) return 2065;
    return 0;
  }

  const API = { lonLatNaMerc, mercNaLonLat, krovakVpred, krovakZpet, wgsNaBessel, besselNaWgs,
    utmVpred, utmZpet, system, NABIDKA, kodZWkt, kodZNazvu, hadejZRozsahu, R_MERC };
  if (typeof module !== 'undefined') module.exports = API; else window.ZaplavyProjekce = API;
})();
