/* Staré mapy – jádro bez DOM (test: node _test/stare_mapy_test.js).
   Převody souřadnic WGS84 ↔ S-JTSK (Křovák, EPSG:5514) a Web Mercator (EPSG:3857),
   čtení WMTS GetCapabilities, výběr úrovně a dlaždic, URL dlaždic, stav v adrese,
   odkazy do původních prohlížečů a katalog ověřených vrstev. */
(function () {
  'use strict';

  const RAD = Math.PI / 180;
  const R_MERC = 6378137;

  /* ---------- Web Mercator ---------- */
  function naMercator(lat, lon) {
    const s = Math.max(-0.9999999, Math.min(0.9999999, Math.sin(lat * RAD)));
    return { x: R_MERC * lon * RAD, y: R_MERC / 2 * Math.log((1 + s) / (1 - s)) };
  }
  function zMercatoru(x, y) {
    return { lat: (2 * Math.atan(Math.exp(y / R_MERC)) - Math.PI / 2) / RAD, lon: x / R_MERC / RAD };
  }
  /* pixel v celosvětové mřížce dlaždic 256 px na úrovni z → zeměpisné souřadnice */
  function pixelNaWgs(px, py, z) {
    const n = 256 * Math.pow(2, z);
    const lon = px / n * 360 - 180;
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * py / n))) / RAD;
    return { lat, lon };
  }

  /* ---------- Elipsoidy a Helmertova transformace ---------- */
  const WGS84 = { a: 6378137, f: 1 / 298.257223563 };
  const BESSEL = { a: 6377397.155, f: 1 / 299.1528128 };
  /* EPSG:1623 S-JTSK → WGS 84 (Coordinate Frame), přesnost ~1 m */
  const HELMERT = { tx: 570.8, ty: 85.7, tz: 462.8, rx: 4.998, ry: 1.587, rz: 5.261, ds: 3.56 };

  function geoNaXyz(lat, lon, el) {
    const e2 = el.f * (2 - el.f), sf = Math.sin(lat * RAD), cf = Math.cos(lat * RAD);
    const N = el.a / Math.sqrt(1 - e2 * sf * sf);
    return [N * cf * Math.cos(lon * RAD), N * cf * Math.sin(lon * RAD), N * (1 - e2) * sf];
  }
  function xyzNaGeo(p, el) {
    const e2 = el.f * (2 - el.f), [X, Y, Z] = p;
    const r = Math.hypot(X, Y);
    let lat = Math.atan2(Z, r * (1 - e2));
    for (let i = 0; i < 6; i++) {
      const N = el.a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
      lat = Math.atan2(Z + e2 * N * Math.sin(lat), r);
    }
    return { lat: lat / RAD, lon: Math.atan2(Y, X) / RAD };
  }
  /* smer = +1: S-JTSK → WGS84, -1: opačně (malé úhly, inverze záporem parametrů) */
  function helmert(p, smer) {
    const as = Math.PI / 180 / 3600, k = smer;
    const tx = k * HELMERT.tx, ty = k * HELMERT.ty, tz = k * HELMERT.tz;
    // rotace ve vzorci níže mají opačné znaménko než Coordinate Frame (ověřeno proti GeometryServeru ČÚZK)
    const rx = -k * HELMERT.rx * as, ry = -k * HELMERT.ry * as, rz = -k * HELMERT.rz * as;
    const m = 1 + k * HELMERT.ds * 1e-6, [X, Y, Z] = p;
    return [tx + m * (X + rz * Y - ry * Z), ty + m * (-rz * X + Y + rx * Z), tz + m * (ry * X - rx * Y + Z)];
  }

  /* ---------- Křovákovo zobrazení (EPSG:9819), parametry S-JTSK ---------- */
  const KR = (function () {
    const a = BESSEL.a, e2 = BESSEL.f * (2 - BESSEL.f), e = Math.sqrt(e2);
    const fC = 49.5 * RAD, aC = 30.28813975277778 * RAD, fP = 78.5 * RAD, kP = 0.9999;
    const l0 = 24.833333333333333 * RAD;          // 24°50' v. d. od Greenwiche = 42°30' od Ferra
    const B = Math.sqrt(1 + e2 * Math.cos(fC) ** 4 / (1 - e2));
    const A = a * Math.sqrt(1 - e2) / (1 - e2 * Math.sin(fC) ** 2);
    const g0 = Math.asin(Math.sin(fC) / B);
    const t0 = Math.tan(Math.PI / 4 + g0 / 2) * Math.pow((1 + e * Math.sin(fC)) / (1 - e * Math.sin(fC)), e * B / 2) / Math.pow(Math.tan(Math.PI / 4 + fC / 2), B);
    const n = Math.sin(fP), r0 = kP * A / Math.tan(fP);
    return { e, aC, fP, l0, B, t0, n, r0 };
  })();

  /* zeměpisné souřadnice na Besselu → EPSG:5514 { x: −Y, y: −X } (metry, záporné) */
  function besselNaKrovak(lat, lon) {
    const { e, aC, fP, l0, B, t0, n, r0 } = KR;
    const f = lat * RAD, l = lon * RAD;
    const es = e * Math.sin(f);
    const U = 2 * (Math.atan(t0 * Math.pow(Math.tan(f / 2 + Math.PI / 4), B) / Math.pow((1 + es) / (1 - es), e * B / 2)) - Math.PI / 4);
    const V = B * (l0 - l);
    const T = Math.asin(Math.cos(aC) * Math.sin(U) + Math.sin(aC) * Math.cos(U) * Math.cos(V));
    const D = Math.asin(Math.cos(U) * Math.sin(V) / Math.cos(T));
    const th = n * D;
    const r = r0 * Math.pow(Math.tan(Math.PI / 4 + fP / 2), n) / Math.pow(Math.tan(T / 2 + Math.PI / 4), n);
    return { x: -r * Math.sin(th), y: -r * Math.cos(th) };
  }
  function krovakNaBessel(x, y) {
    const { e, aC, fP, l0, B, t0, n, r0 } = KR;
    const Xp = -y, Yp = -x;
    const r = Math.hypot(Xp, Yp), th = Math.atan2(Yp, Xp);
    const D = th / Math.sin(fP);
    const T = 2 * (Math.atan(Math.pow(r0 / r, 1 / n) * Math.tan(Math.PI / 4 + fP / 2)) - Math.PI / 4);
    const U = Math.asin(Math.cos(aC) * Math.sin(T) - Math.sin(aC) * Math.cos(T) * Math.cos(D));
    const V = Math.asin(Math.cos(T) * Math.sin(D) / Math.cos(U));
    const l = l0 - V / B;
    let f = U;
    for (let i = 0; i < 8; i++) {
      const es = e * Math.sin(f);
      f = 2 * (Math.atan(Math.pow(t0, -1 / B) * Math.pow(Math.tan(U / 2 + Math.PI / 4), 1 / B) * Math.pow((1 + es) / (1 - es), e / 2)) - Math.PI / 4);
    }
    return { lat: f / RAD, lon: l / RAD };
  }
  function wgsNaJtsk(lat, lon) {
    const b = xyzNaGeo(helmert(geoNaXyz(lat, lon, WGS84), -1), BESSEL);
    return besselNaKrovak(b.lat, b.lon);
  }
  function jtskNaWgs(x, y) {
    const b = krovakNaBessel(x, y);
    return xyzNaGeo(helmert(geoNaXyz(b.lat, b.lon, BESSEL), 1), WGS84);
  }

  /* ---------- WMTS GetCapabilities (bez DOMParseru, aby šlo v node) ---------- */
  const tagy = (xml, jm) => {
    const re = new RegExp('<(?:\\w+:)?' + jm + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + jm + '>', 'g');
    const r = []; let m;
    while ((m = re.exec(xml))) r.push(m[1]);
    return r;
  };
  const tag = (xml, jm) => { const t = tagy(xml, jm); return t.length ? t[0].trim() : ''; };
  const atribut = (s, jm) => { const m = new RegExp('\\s' + jm + '="([^"]*)"').exec(s); return m ? m[1] : ''; };
  const dekoduj = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const cisla = s => s.trim().split(/\s+/).map(Number);

  /* Vrátí { titulek, vrstvy: [{ id, titulek, formaty, styl, sady, sablona, wgs }], sady: { id: { crs, urovne } } }.
     Úroveň: { id, meritko, rozliseni (m/px při 0,28 mm), x0, y0, tw, th, mw, mh }.
     Osy: TopLeftCorner beru jako (východ, sever) – platí pro EPSG:5514 i 3857 v obvyklých službách. */
  function parsujWmts(xml) {
    xml = String(xml || '');
    if (!/<(\w+:)?Capabilities[\s>]/.test(xml)) throw new Error('Odpověď není WMTS GetCapabilities.');
    const obsah = tag(xml, 'Contents');
    const sady = {};
    for (const s of tagy(obsah, 'TileMatrixSet')) {
      if (!/<(\w+:)?TileMatrix[\s>]/.test(s)) continue;              // odkaz TileMatrixSetLink, ne definice
      const id = tag(s.replace(/<(\w+:)?TileMatrix[\s>][\s\S]*$/, ''), 'Identifier');
      const crs = tag(s, 'SupportedCRS');
      const urovne = tagy(s, 'TileMatrix').map(t => {
        const roh = cisla(tag(t, 'TopLeftCorner'));
        const meritko = Number(tag(t, 'ScaleDenominator'));
        return { id: tag(t, 'Identifier'), meritko, rozliseni: meritko * 0.00028, x0: roh[0], y0: roh[1],
          tw: Number(tag(t, 'TileWidth')), th: Number(tag(t, 'TileHeight')), mw: Number(tag(t, 'MatrixWidth')), mh: Number(tag(t, 'MatrixHeight')) };
      }).sort((a, b) => b.rozliseni - a.rozliseni);
      sady[id] = { crs, epsg: (/EPSG:[^:]*:{1,2}(\d+)$/.exec(crs) || /(\d{4,6})$/.exec(crs) || [])[1] || '', urovne };
    }
    const vrstvy = tagy(obsah, 'Layer').map(l => {
      const zdroj = /<(?:\w+:)?ResourceURL[^>]*resourceType="tile"[^>]*>/.exec(l);
      const wgs = tag(l, 'WGS84BoundingBox');
      const styly = tagy(l, 'Style');
      const vychozi = /<(?:\w+:)?Style[^>]*isDefault="true"/.exec(l) ? tag(l.slice(/<(?:\w+:)?Style[^>]*isDefault="true"/.exec(l).index), 'Identifier') : (styly[0] ? tag(styly[0], 'Identifier') : 'default');
      return {
        id: tag(l.replace(/<(\w+:)?Style[\s>][\s\S]*?<\/(\w+:)?Style>/g, ''), 'Identifier'),
        titulek: dekoduj(tag(l, 'Title')),
        formaty: tagy(l, 'Format').map(s => s.trim()),
        styl: vychozi,
        sady: tagy(l, 'TileMatrixSetLink').map(s => tag(s, 'TileMatrixSet')),
        sablona: zdroj ? dekoduj(atribut(zdroj[0], 'template')) : '',
        wgs: wgs ? [...cisla(tag(wgs, 'LowerCorner')), ...cisla(tag(wgs, 'UpperCorner'))] : null
      };
    });
    return { titulek: dekoduj(tag(tag(xml, 'ServiceIdentification'), 'Title')), vrstvy, sady };
  }

  function urlDlazdice(sablona, h) {
    return sablona.replace(/\{(\w+)\}/g, (m, k) => {
      const v = { TileMatrixSet: h.sada, TileMatrix: h.uroven, TileRow: h.radek, TileCol: h.sloupec, Style: h.styl || 'default', z: h.uroven, x: h.sloupec, y: h.radek }[k];
      return v === undefined ? m : encodeURIComponent(v).replace(/%3A/g, ':');
    }).replace(/^http:\/\//, 'https://');
  }

  /* Nejhrubší úroveň, která je ještě aspoň tak jemná jako cíl (s tolerancí), jinak nejjemnější. */
  function vyberUroven(urovne, cil, maxIndex) {
    const posl = Math.min(urovne.length - 1, maxIndex == null ? 1e9 : maxIndex);
    for (let i = 0; i <= posl; i++) if (urovne[i].rozliseni <= cil * 1.3) return i;
    return posl;
  }
  /* Dlaždice úrovně pokrývající obdélník [xmin, ymin, xmax, ymax] v souřadnicích sady. */
  function dlazdiceObdelniku(u, bb) {
    const sx = u.rozliseni * u.tw, sy = u.rozliseni * u.th;
    const c0 = Math.max(0, Math.floor((bb[0] - u.x0) / sx)), c1 = Math.min(u.mw - 1, Math.floor((bb[2] - u.x0) / sx));
    const r0 = Math.max(0, Math.floor((u.y0 - bb[3]) / sy)), r1 = Math.min(u.mh - 1, Math.floor((u.y0 - bb[1]) / sy));
    return { c0, c1, r0, r1, pocet: c1 < c0 || r1 < r0 ? 0 : (c1 - c0 + 1) * (r1 - r0 + 1) };
  }
  /* Souřadnice S-JTSK v mřížce (krok+1)² bodů nad dlaždicí Leafletu z/x/y. */
  function mrizkaDlazdice(z, tx, ty, krok, prevod) {
    const body = [];
    for (let j = 0; j <= krok; j++) for (let i = 0; i <= krok; i++) {
      const g = pixelNaWgs((tx + i / krok) * 256, (ty + j / krok) * 256, z);
      const p = (prevod || wgsNaJtsk)(g.lat, g.lon);
      body.push(p.x, p.y);
    }
    return body;
  }

  /* ---------- Stav v adrese (#m=z/lat/lon&a=…&b=…&r=…&o=…&s=…) ---------- */
  const REZIMY = ['prekryv', 'opona', 'lupa', 'vedle'];
  function stavDoHashe(s) {
    const p = [`m=${Math.round(s.z * 100) / 100}/${s.lat.toFixed(5)}/${s.lon.toFixed(5)}`, `a=${s.a}`, `b=${s.b}`, `r=${s.rezim}`];
    if (s.rezim === 'prekryv') p.push(`o=${Math.round(s.pruhlednost)}`);
    if (s.rezim === 'opona') p.push(`s=${Math.round(s.opona)}`);
    return '#' + p.join('&');
  }
  function hashNaStav(h, znameVrstvy) {
    const q = {};
    String(h || '').replace(/^#/, '').split('&').forEach(c => { const i = c.indexOf('='); if (i > 0) q[c.slice(0, i)] = decodeURIComponent(c.slice(i + 1)); });
    const s = {};
    const m = /^(\d{1,2}(?:\.\d+)?)\/(-?\d{1,2}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)$/.exec(q.m || '');
    if (m) {
      const z = +m[1], lat = +m[2], lon = +m[3];
      if (z >= 0 && z <= 20 && Math.abs(lat) <= 85 && Math.abs(lon) <= 180) Object.assign(s, { z, lat, lon });
    }
    const zn = id => !znameVrstvy || znameVrstvy.includes(id);
    if (q.a && zn(q.a)) s.a = q.a;
    if (q.b && zn(q.b)) s.b = q.b;
    if (REZIMY.includes(q.r)) s.rezim = q.r;
    const proc = v => { const n = Number(v); return v !== undefined && v !== '' && isFinite(n) ? Math.max(0, Math.min(100, n)) : undefined; };
    if (proc(q.o) !== undefined) s.pruhlednost = proc(q.o);
    if (proc(q.s) !== undefined) s.opona = proc(q.s);
    return s;
  }

  /* ---------- Odkazy do původních prohlížečů ---------- */
  /* rozsah výřezu kolem středu: šířka/výška v pixelech při Web Mercator úrovni z */
  function vyrez3857(lat, lon, z, sirka, vyska) {
    const c = naMercator(lat, lon), res = 2 * Math.PI * R_MERC / 256 / Math.pow(2, z);
    const w = (sirka || 1000) * res / 2, h = (vyska || 700) * res / 2;
    return [c.x - w, c.y - h, c.x + w, c.y + h];
  }
  function vyrezJtsk(lat, lon, z, sirka, vyska) {
    const b = vyrez3857(lat, lon, z, sirka, vyska);
    const r = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => { const g = zMercatoru(x, y); return wgsNaJtsk(g.lat, g.lon); });
    return [Math.min(...r.map(p => p.x)), Math.min(...r.map(p => p.y)), Math.max(...r.map(p => p.x)), Math.max(...r.map(p => p.y))];
  }
  const zaokr = b => b.map(v => Math.round(v)).join(',');
  const ODKAZY = [
    { id: 'archiv', nazev: 'Archiv ČÚZK – císařské otisky, originální mapy stabilního katastru, historická ortofota',
      url: (lat, lon, z) => `https://ags.cuzk.gov.cz/archiv/?extent=${zaokr(vyrezJtsk(lat, lon, z))}` },
    { id: 'mapire1', nazev: 'Arcanum Maps (Mapire) – I. vojenské mapování (1763–1787)',
      url: (lat, lon, z) => `https://maps.arcanum.com/cs/map/europe-18century-firstsurvey/?bbox=${zaokr(vyrez3857(lat, lon, z))}` },
    { id: 'mapire2', nazev: 'Arcanum Maps (Mapire) – II. vojenské mapování (1806–1869)',
      url: (lat, lon, z) => `https://maps.arcanum.com/cs/map/europe-19century-secondsurvey/?bbox=${zaokr(vyrez3857(lat, lon, z))}` },
    { id: 'otisky_jc', nazev: 'Geoportál Jihočeského kraje – císařské otisky stabilního katastru (bezešvá mapa kraje)',
      url: () => 'https://geoportal.kraj-jihocesky.gov.cz/portal/mapy/ostatni/Cisarske-otisky-WMTS' },
    { id: 'oldmaps', nazev: 'Oldmaps – Laboratoř geoinformatiky UJEP (I.–III. vojenské mapování, mapové listy)',
      url: () => 'https://oldmaps.geolab.cz/' },
    { id: 'osm', nazev: 'OpenStreetMap',
      url: (lat, lon, z) => `https://www.openstreetmap.org/#map=${Math.round(z)}/${lat.toFixed(5)}/${lon.toFixed(5)}` }
  ];

  /* ---------- Katalog ověřených vrstev (ověřeno 16. 11. 2026: CORS, podmínky, funkční dlaždice) ---------- */
  /* Císařské otisky stabilního katastru (WMTS Jihočeského kraje, EPSG:5514, CORS *) tu záměrně NEJSOU:
     podmínky služby výslovně nepovolují vkládání do cizích webů (jen veřejné prohlížení, nekomerčně) – proto
     jen odkaz v ODKAZY ('otisky_jc'). Pokud by správce (geoportal-admins@kraj-jihocesky.cz) souhlasil, stačí
     přidat položku: { id: 'otisky_jc', typ: 'wmts', sada: 'default028mm', capabilities:
     'https://gis.kraj-jihocesky.cz/arcgis/rest/services/podkladove/cisarske_otisky/MapServer/WMTS/1.0.0/WMTSCapabilities.xml',
     sablona: '…/MapServer/WMTS/tile/1.0.0/podkladove_cisarske_otisky/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg',
     maxUroven: 16, bounds: [13.119, 48.405, 15.976, 49.762], … popisy a atribuce © ČÚZK (ÚAZK) }
     – úrovně mřížky si stránka načte z GetCapabilities sama (pripravDef). */
  const CR_BOX = [12.09, 48.55, 18.86, 51.06];
  const CENIA_SADA = 'jtsk:epsg:5514';
  /* mřížka CENIA MapCache (GetCapabilities): 512 px, roh (−925 000; −920 000), úroveň 0 = 1:3 657 600 */
  const CENIA_UROVNE = Array.from({ length: 13 }, (_, i) => {
    const meritko = 3657600 / Math.pow(2, i);
    return { id: String(i), meritko, rozliseni: meritko * 0.00028, x0: -925000, y0: -920000, tw: 512, th: 512, mw: Math.pow(2, i), mh: Math.pow(2, i) };
  });
  const VRSTVY = [
    { id: 'osm', nazev: 'OpenStreetMap', rok: 'dnes', razeni: 2026, meritko: 'měřítko proměnné', typ: 'xyz',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19,
      zdroj: 'OpenStreetMap Foundation', licence: 'ODbL (data), dlaždice podle Tile Usage Policy',
      atribuce: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">přispěvatelé OpenStreetMap</a>',
      popis: 'Současná mapa tvořená dobrovolníky. Dobrá pro orientaci – ulice, budovy, názvy.' },
    { id: 'ortofoto', nazev: 'Ortofoto ČÚZK', rok: 'dnes', razeni: 2025, meritko: 'rozlišení 12,5–25 cm', typ: 'xyz',
      url: 'https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}', maxZoom: 20, bounds: CR_BOX,
      zdroj: 'Český úřad zeměměřický a katastrální', licence: 'otevřená data ČÚZK, uvést zdroj',
      atribuce: 'Ortofoto © <a href="https://geoportal.cuzk.gov.cz" target="_blank" rel="noopener">ČÚZK</a>',
      popis: 'Aktuální letecké snímky celé ČR, snímkování se obnovuje po částech každé dva roky.' },
    { id: 'ztm', nazev: 'Základní topografická mapa ČÚZK', rok: 'dnes', razeni: 2024, meritko: 'měřítko 1 : 5 000 – 1 : 500 000', typ: 'xyz',
      url: 'https://ags.cuzk.gov.cz/arcgis1/rest/services/ZTM_WM/MapServer/tile/{z}/{y}/{x}', maxZoom: 18, bounds: CR_BOX,
      zdroj: 'Český úřad zeměměřický a katastrální', licence: 'otevřená data ČÚZK, uvést zdroj',
      atribuce: 'ZTM © <a href="https://geoportal.cuzk.gov.cz" target="_blank" rel="noopener">ČÚZK</a>',
      popis: 'Státní topografická mapa – vrstevnice, lesy, vodní toky, pomístní názvy. Dobře se srovnává se starými vojenskými mapami.' },
    { id: 'orto50', nazev: 'Historická ortofotomapa', rok: '1952–1954', razeni: 1953, meritko: 'rozlišení 0,5 m', typ: 'wmts',
      sablona: 'https://gis.cenia.cz/mapcache/ortofotomapa_historicka/wmts/1.0.0/orto/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpgpng',
      sada: CENIA_SADA, urovne: CENIA_UROVNE, maxUroven: 12, bounds: CR_BOX,
      zdroj: 'CENIA, GEODIS BRNO; letecké snímky VGHMÚř Dobruška', licence: 'CC BY 4.0',
      atribuce: 'Historická ortofotomapa © CENIA 2010 a © GEODIS BRNO, spol. s r.o. 2010, snímky © MO ČR 2009 (VGHMÚř Dobruška), <a href="https://creativecommons.org/licenses/by/4.0/deed.cs" target="_blank" rel="noopener">CC BY 4.0</a>',
      popis: 'Letecké snímky převážně z let 1952–1954 (místy 1937–1970) – krajina před kolektivizací: úzká pole, meze, sady, původní vesnice.' },
    { id: 'vm3', nazev: 'III. vojenské mapování – Speciální mapa', rok: '1876–1880', razeni: 1878, meritko: 'měřítko 1 : 75 000', typ: 'wmts',
      sablona: 'https://gis.cenia.cz/mapcache/III_vojenske_mapovani/wmts/1.0.0/III_vojenske_mapovani/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpgpng',
      sada: CENIA_SADA, urovne: CENIA_UROVNE, maxUroven: 10, bounds: CR_BOX,
      zdroj: 'CENIA, Laboratoř geoinformatiky UJEP; originály Österreichisches Staatsarchiv', licence: 'veřejná prohlížecí služba CENIA – bez podmínek',
      atribuce: 'III. vojenské mapování © <a href="https://www.cenia.cz" target="_blank" rel="noopener">CENIA</a>, Laboratoř geoinformatiky UJEP',
      popis: 'Ortorektifikované Speciální mapy františko-josefského mapování (Čechy a Morava mapovány 1876–1880, listy později doplňovány). Železnice, silnice, sídla, výšky.' },
    { id: 'vm2', nazev: 'II. vojenské mapování', rok: '1836–1852', razeni: 1844, meritko: 'měřítko 1 : 28 800', typ: 'wmts',
      sablona: 'https://gis.cenia.cz/mapcache/II_vojenske_mapovani/wmts/1.0.0/II_vojenske_mapovani/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpgpng',
      sada: CENIA_SADA, urovne: CENIA_UROVNE, maxUroven: 11, bounds: CR_BOX,
      zdroj: 'CENIA a MŽP, Laboratoř geoinformatiky UJEP; originály Österreichisches Staatsarchiv', licence: 'veřejná prohlížecí služba CENIA – bez podmínek',
      atribuce: 'II. vojenské mapování © <a href="https://www.cenia.cz" target="_blank" rel="noopener">CENIA</a>, MŽP, Laboratoř geoinformatiky UJEP',
      popis: 'Františkovo mapování nad podkladem stabilního katastru – barevná mapa využití krajiny: louky, pastviny, rybníky, vinice, mlýny.' }
  ];
  const vrstva = id => VRSTVY.find(v => v.id === id) || null;

  const api = {
    naMercator, zMercatoru, pixelNaWgs, wgsNaJtsk, jtskNaWgs, besselNaKrovak, krovakNaBessel,
    parsujWmts, urlDlazdice, vyberUroven, dlazdiceObdelniku, mrizkaDlazdice,
    REZIMY, stavDoHashe, hashNaStav, vyrez3857, vyrezJtsk, ODKAZY, VRSTVY, CENIA_UROVNE, vrstva
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.STMAPY = api;
})();
