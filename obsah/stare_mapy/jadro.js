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
  function vyrezWgs(lat, lon, z) {
    const b = vyrez3857(lat, lon, z), sz = zMercatoru(b[0], b[1]), sv = zMercatoru(b[2], b[3]);
    return [sz.lon, sz.lat, sv.lon, sv.lat];
  }
  const zaokr = b => b.map(v => Math.round(v)).join(',');
  const ODKAZY = [
    { id: 'archiv', nazev: 'Archiv ČÚZK – císařské otisky, SMO-5, topografické mapy S-1952, archivní ortofota po letech',
      url: (lat, lon, z) => `https://ags.cuzk.gov.cz/archiv/?extent=${zaokr(vyrezJtsk(lat, lon, z))}` },
    { id: 'mapire1', nazev: 'Arcanum Maps (Mapire) – I. vojenské mapování (1763–1787)',
      url: (lat, lon, z) => `https://maps.arcanum.com/cs/map/europe-18century-firstsurvey/?bbox=${zaokr(vyrez3857(lat, lon, z))}` },
    { id: 'mapire2', nazev: 'Arcanum Maps (Mapire) – II. vojenské mapování (1806–1869)',
      url: (lat, lon, z) => `https://maps.arcanum.com/cs/map/europe-19century-secondsurvey/?bbox=${zaokr(vyrez3857(lat, lon, z))}` },
    { id: 'oldmapsonline', nazev: 'Old Maps Online – vyhledávač starých map z knihoven světa (i sbírka Davida Rumseyho)',
      url: (lat, lon, z) => `https://www.oldmapsonline.org/?bbox=${vyrezWgs(lat, lon, z).map(v => v.toFixed(4)).join(',')}` },
    { id: 'rumsey', nazev: 'David Rumsey Map Collection – hledání podle názvu místa',
      url: (lat, lon, z, nazev) => nazev ? `https://www.davidrumsey.com/luna/servlet/view/search?q=${encodeURIComponent(nazev)}` : 'https://www.davidrumsey.com/' },
    { id: 'otisky_jc', nazev: 'Geoportál Jihočeského kraje – císařské otisky stabilního katastru (bezešvá mapa kraje)',
      url: () => 'https://geoportal.kraj-jihocesky.gov.cz/portal/mapy/ostatni/Cisarske-otisky-WMTS' },
    { id: 'oldmaps', nazev: 'Oldmaps – Laboratoř geoinformatiky UJEP (I.–III. vojenské mapování, mapové listy)',
      url: () => 'https://oldmaps.geolab.cz/' },
    { id: 'chartae', nazev: 'Chartae antiquae (VÚGTK) – původní prohlížeč Müllerových map a mapování',
      url: () => 'https://www.chartae-antiquae.cz/cs/mapsets/' },
    { id: 'osm', nazev: 'OpenStreetMap',
      url: (lat, lon, z) => `https://www.openstreetmap.org/#map=${Math.round(z)}/${lat.toFixed(5)}/${lon.toFixed(5)}` }
  ];

  /* ---------- Katalog ověřených vrstev (ověřeno 16.–17. 11. 2026: CORS, podmínky, funkční dlaždice) ---------- */
  /* Císařské otisky stabilního katastru (WMTS Jihočeského kraje, EPSG:5514, CORS *) tu záměrně NEJSOU:
     podmínky služby výslovně nepovolují vkládání do cizích webů (jen veřejné prohlížení, nekomerčně) – proto
     jen odkaz v ODKAZY ('otisky_jc'). Pokud by správce (geoportal-admins@kraj-jihocesky.cz) souhlasil, stačí
     přidat položku: { id: 'otisky_jc', typ: 'wmts', sada: 'default028mm', capabilities:
     'https://gis.kraj-jihocesky.cz/arcgis/rest/services/podkladove/cisarske_otisky/MapServer/WMTS/1.0.0/WMTSCapabilities.xml',
     sablona: '…/MapServer/WMTS/tile/1.0.0/podkladove_cisarske_otisky/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg',
     maxUroven: 16, bounds: [13.119, 48.405, 15.976, 49.762], … popisy a atribuce © ČÚZK (ÚAZK) }
     – úrovně mřížky si stránka načte z GetCapabilities sama (pripravDef).
     Archivní ortofoto ČÚZK (geoportal.cuzk.gov.cz/geoserver/wms_ortofoto_archiv) přesměrovává na Podminky.pdf
     (vyžaduje souhlas) – jen odkaz přes Archiv ČÚZK. */
  const CR_BOX = [12.09, 48.55, 18.86, 51.06];
  const CECHY = [12.0, 48.5, 16.7, 51.1], MORAVA = [15.4, 48.55, 18.9, 50.45];
  const PRAHA = [14.22, 49.94, 14.71, 50.18], VIDEN = [16.17, 48.10, 16.58, 48.33];
  const SR_BOX = [16.8, 47.7, 22.6, 49.65], AT_BOX = [9.5, 46.35, 17.2, 49.05];
  const STMK = [13.55, 46.6, 16.2, 47.85], SASKO = [11.85, 50.15, 15.05, 51.7];
  const CENIA_SADA = 'jtsk:epsg:5514';
  /* mřížka CENIA MapCache (GetCapabilities): 512 px, roh (−925 000; −920 000), úroveň 0 = 1:3 657 600 */
  const CENIA_UROVNE = Array.from({ length: 13 }, (_, i) => {
    const meritko = 3657600 / Math.pow(2, i);
    return { id: String(i), meritko, rozliseni: meritko * 0.00028, x0: -925000, y0: -920000, tw: 512, th: 512, mw: Math.pow(2, i), mh: Math.pow(2, i) };
  });
  const a = (url, text) => `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
  const CCBY = a('https://creativecommons.org/licenses/by/4.0/deed.cs', 'CC BY 4.0');

  /* Chartae antiquae: TMS v pořadí XYZ, CORS *, licence neuvedena (služby zveřejněné na stránkách map) */
  const CHARTAE = (id, kod, nazev, rok, razeni, meritko, maxZoom, bounds, popis) => ({
    id, nazev, rok, razeni, meritko, typ: 'xyz', oblast: 'cz', url: `https://www.chartae-antiquae.cz/TMS/${kod}/{z}/{x}/{y}`, maxZoom, bounds,
    zdroj: 'VÚGTK, v.v.i. a Historický ústav AV ČR (projekt Chartae antiquae, NAKI)', licence: 'licence neuvedena – veřejná služba zveřejněná projektem k připojení',
    atribuce: `${nazev} © ${a('https://www.chartae-antiquae.cz/', 'VÚGTK, v.v.i. & HÚ AV ČR, v.v.i.')}`, popis });
  /* IPR Praha: ArcGIS MapServer export do EPSG:3857, CORS, CC BY „datový podklad © IPR Praha" */
  const IPR_ORTO = 'https://gs-pub.praha.eu/arcgis/rest/services/ort/ortofotomapa_archiv/MapServer/export';
  const IPR_PLANY = 'https://gs-pub.praha.eu/arcgis/rest/services/arch/mapove_podklady_archiv/MapServer/export';
  const IPR = (id, url, vrstva, nazev, rok, razeni, meritko, popis) => ({
    id, nazev, rok, razeni, meritko, typ: 'arcgis', oblast: 'praha', url, parametry: `layers=show:${vrstva}&format=jpg`, maxZoom: 20, bounds: PRAHA,
    zdroj: 'Institut plánování a rozvoje hl. m. Prahy (Geoportál Praha)', licence: 'CC BY 4.0 (otevřená data IPR Praha)',
    atribuce: `${nazev}: datový podklad © ${a('https://geoportalpraha.cz', 'IPR Praha')}, ${CCBY}`, popis });
  /* Stadt Wien: Luftbildplan, WMTS google3857, CORS *, CC BY 4.0 */
  const VIDEN_LB = (rok) => ({
    id: 'wien' + rok, nazev: `Vídeň – letecký plán ${rok}`, rok: String(rok), razeni: rok, meritko: 'letecké snímky, černobílé', typ: 'xyz', oblast: 'at',
    url: `https://mapsneu.wien.gv.at/wmts/lb${rok}/grau/google3857/{z}/{y}/{x}.jpeg`, maxZoom: 19, bounds: VIDEN,
    zdroj: 'Stadt Wien, MA 41 – Stadtvermessung', licence: 'CC BY 4.0',
    atribuce: `Luftbildplan ${rok}: Datenquelle: Stadt Wien – ${a('https://data.wien.gv.at', 'data.wien.gv.at')}, ${CCBY}`,
    popis: `Ortofotomapa Vídně z leteckého snímkování ${rok}` + (rok === 1938 ? ' – město před válečným bombardováním (některé okrajové části chybí).' : rok === 1956 ? ' – rok po odchodu okupačních vojsk, stopy válečných škod.' : '.') });

  const VRSTVY = [
    /* ----- dnešní podklady ----- */
    { id: 'osm', nazev: 'OpenStreetMap', rok: 'dnes', razeni: 2026, meritko: 'měřítko proměnné', typ: 'xyz', oblast: 'dnes',
      url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png', maxZoom: 19, zaloha: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      zdroj: 'OpenStreetMap, dlaždice FOSSGIS (openstreetmap.de)', licence: 'ODbL (data), dlaždice openstreetmap.de',
      atribuce: '© ' + a('https://www.openstreetmap.org/copyright', 'přispěvatelé OpenStreetMap') + ', dlaždice openstreetmap.de',
      popis: 'Současná mapa tvořená dobrovolníky. Dobrá pro orientaci – ulice, budovy, názvy. Při výpadku serveru stránka přepne na dlaždice OSM France (HOT).' },
    { id: 'ortofoto', nazev: 'Ortofoto ČÚZK', rok: 'dnes', razeni: 2025, meritko: 'rozlišení 12,5–25 cm', typ: 'xyz', oblast: 'dnes',
      url: 'https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}', maxZoom: 20, bounds: CR_BOX,
      zdroj: 'Český úřad zeměměřický a katastrální', licence: 'otevřená data ČÚZK, uvést zdroj',
      atribuce: 'Ortofoto © ' + a('https://geoportal.cuzk.gov.cz', 'ČÚZK'),
      popis: 'Aktuální letecké snímky celé ČR, snímkování se obnovuje po částech každé dva roky.' },
    { id: 'ztm', nazev: 'Základní topografická mapa ČÚZK', rok: 'dnes', razeni: 2024, meritko: 'měřítko 1 : 5 000 – 1 : 500 000', typ: 'xyz', oblast: 'dnes',
      url: 'https://ags.cuzk.gov.cz/arcgis1/rest/services/ZTM_WM/MapServer/tile/{z}/{y}/{x}', maxZoom: 18, bounds: CR_BOX,
      zdroj: 'Český úřad zeměměřický a katastrální', licence: 'otevřená data ČÚZK, uvést zdroj',
      atribuce: 'ZTM © ' + a('https://geoportal.cuzk.gov.cz', 'ČÚZK'),
      popis: 'Státní topografická mapa – vrstevnice, lesy, vodní toky, pomístní názvy. Dobře se srovnává se starými vojenskými mapami.' },
    { id: 'katastr', nazev: 'Katastrální mapa ČÚZK (průhledná)', rok: 'dnes', razeni: 2026, meritko: 'od přiblížení 14', typ: 'wms', oblast: 'dnes', pruhledna: true,
      url: 'https://services.cuzk.gov.cz/wms/local-km-wms.asp', vrstvy: 'KN', minZoom: 14, maxZoom: 20, bounds: CR_BOX,
      zdroj: 'Český úřad zeměměřický a katastrální – WMS katastrální mapy', licence: 'otevřená data ČÚZK (CC BY 4.0), služba bez poplatků a omezení',
      atribuce: 'Katastrální mapa © ' + a('https://cuzk.gov.cz', 'ČÚZK'),
      popis: 'Dnešní hranice a čísla parcel, budovy. Průhledná – položte ji nahoru přes starou mapu a uvidíte, které meze a cesty přežily v katastru dodnes.' },
    { id: 'sk_orto', nazev: 'Ortofoto Slovensko (ZBGIS)', rok: 'dnes', razeni: 2023, meritko: 'rozlišení 20–25 cm', typ: 'xyz', oblast: 'sk',
      url: 'https://zbgis.skgeodesy.sk/zbgis/rest/services/Ortofoto/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, bounds: SR_BOX,
      zdroj: 'GKÚ Bratislava, Národné lesnícke centrum', licence: 'CC BY 4.0',
      atribuce: 'Ortofoto © ' + a('https://www.geoportal.sk', 'GKÚ Bratislava, NLC') + ', ' + CCBY,
      popis: 'Současná ortofotomozaika Slovenska.' },
    { id: 'at_orto', nazev: 'Ortofoto Rakousko (basemap.at)', rok: 'dnes', razeni: 2024, meritko: 'rozlišení 30 cm', typ: 'xyz', oblast: 'at',
      url: 'https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg', maxZoom: 19, bounds: AT_BOX,
      zdroj: 'basemap.at (rakouské spolkové země)', licence: 'CC BY 4.0',
      atribuce: 'Orthofoto: ' + a('https://basemap.at', 'basemap.at') + ', ' + CCBY,
      popis: 'Současné letecké snímky celého Rakouska.' },

    /* ----- Česko ----- */
    { id: 'orto50', nazev: 'Historická ortofotomapa', rok: '1952–1954', razeni: 1953, meritko: 'rozlišení 0,5 m', typ: 'wmts', oblast: 'cz',
      sablona: 'https://gis.cenia.cz/mapcache/ortofotomapa_historicka/wmts/1.0.0/orto/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpgpng',
      sada: CENIA_SADA, urovne: CENIA_UROVNE, maxUroven: 12, bounds: CR_BOX,
      zdroj: 'CENIA, GEODIS BRNO; letecké snímky VGHMÚř Dobruška', licence: 'CC BY 4.0',
      atribuce: 'Historická ortofotomapa © CENIA 2010 a © GEODIS BRNO, spol. s r.o. 2010, snímky © MO ČR 2009 (VGHMÚř Dobruška), ' + CCBY,
      popis: 'Letecké snímky převážně z let 1952–1954 (místy 1937–1970) – krajina před kolektivizací: úzká pole, meze, sady, původní vesnice.' },
    CHARTAE('vm3_25', 'Military3', 'III. vojenské mapování – topografické sekce', '1869–1885', 1877, 'měřítko 1 : 25 000', 17, CR_BOX,
      'Barevné topografické sekce, z nichž se kreslila Speciální mapa. Podrobnější než 1 : 75 000 – jednotlivé usedlosti, mlýny, kříže, polní cesty.'),
    { id: 'vm3', nazev: 'III. vojenské mapování – Speciální mapa', rok: '1876–1880', razeni: 1878, meritko: 'měřítko 1 : 75 000', typ: 'wmts', oblast: 'cz',
      sablona: 'https://gis.cenia.cz/mapcache/III_vojenske_mapovani/wmts/1.0.0/III_vojenske_mapovani/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpgpng',
      sada: CENIA_SADA, urovne: CENIA_UROVNE, maxUroven: 10, bounds: CR_BOX,
      zdroj: 'CENIA, Laboratoř geoinformatiky UJEP; originály Österreichisches Staatsarchiv', licence: 'veřejná prohlížecí služba CENIA – bez podmínek',
      atribuce: 'III. vojenské mapování © ' + a('https://www.cenia.cz', 'CENIA') + ', Laboratoř geoinformatiky UJEP',
      popis: 'Ortorektifikované Speciální mapy františko-josefského mapování (Čechy a Morava mapovány 1876–1880, listy později doplňovány). Železnice, silnice, sídla, výšky.' },
    CHARTAE('generalni', 'StredEvropa', 'Generální mapa střední Evropy', '1873–1876', 1875, 'měřítko 1 : 200 000', 14, [8, 44, 27, 52],
      'Přehledná mapa celého Rakouska-Uherska a okolí – dobrá pro dálkové silnice, železnice a hranice zemí.'),
    { id: 'vm2', nazev: 'II. vojenské mapování', rok: '1836–1852', razeni: 1844, meritko: 'měřítko 1 : 28 800', typ: 'wmts', oblast: 'cz',
      sablona: 'https://gis.cenia.cz/mapcache/II_vojenske_mapovani/wmts/1.0.0/II_vojenske_mapovani/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpgpng',
      sada: CENIA_SADA, urovne: CENIA_UROVNE, maxUroven: 11, bounds: CR_BOX,
      zdroj: 'CENIA a MŽP, Laboratoř geoinformatiky UJEP; originály Österreichisches Staatsarchiv', licence: 'veřejná prohlížecí služba CENIA – bez podmínek',
      atribuce: 'II. vojenské mapování © ' + a('https://www.cenia.cz', 'CENIA') + ', MŽP, Laboratoř geoinformatiky UJEP',
      popis: 'Františkovo mapování nad podkladem stabilního katastru – barevná mapa využití krajiny: louky, pastviny, rybníky, vinice, mlýny.' },
    CHARTAE('vm2_144', 'Military2_144', 'II. vojenské mapování – Speciální mapa', '1842–1852', 1847, 'měřítko 1 : 144 000', 15, CR_BOX,
      'Zmenšená generalizace II. mapování – přehled sítě silnic a sídel ve 40. letech 19. století.'),
    CHARTAE('pruska', 'Prusko', 'Pruská vojenská mapa Saska a Čech', '1778–1800', 1785, 'měřítko asi 1 : 35 000', 14, [12.0, 50.2, 16.5, 51.2],
      'Pruská špionážní mapa pohraničí z doby války o bavorské dědictví – jen severní Čechy, pokrytí je mezerovité.'),
    CHARTAE('vm1', 'Military1', 'I. vojenské (josefské) mapování', '1764–1768', 1766, 'měřítko 1 : 28 800', 17, CR_BOX,
      'Nejstarší podrobná mapa celých Čech (rektifikace 1780–1783). Nemá geodetický základ, proto sedí jen přibližně – odchylky stovek metrů jsou běžné.'),
    CHARTAE('mw', 'MWmapa', 'Müllerova-Wielandova mapa Čech', '1726', 1726, 'měřítko 1 : 231 000', 14, CECHY,
      'Zmenšené vydání Müllerovy mapy na 4/7 původní velikosti – stejný obsah, přehlednější.'),
    CHARTAE('muller_c', 'MullerC', 'Müllerova mapa Čech', '1720', 1720, 'měřítko 1 : 132 000', 14, CECHY,
      'Největší stará mapa Čech (25 listů) z prvního soustavného mapování 1712–1718: přes 12 000 sídel, kostely, mlýny, sklárny, doly. Poloha sídel orientační.'),
    CHARTAE('muller_m', 'MullerM', 'Müllerova mapa Moravy', '1716', 1716, 'měřítko 1 : 180 000', 14, MORAVA,
      'Müllerova mapa Moravy (vydána 1716) – sídla, hrady, kláštery, vinice, poštovní cesty.'),

    /* ----- Praha (IPR) ----- */
    IPR('praha_o1938', IPR_ORTO, 0, 'Praha – ortofoto 1938', '1938', 1938, 'letecké snímky', 'Nejstarší souvislý letecký snímek Prahy – před válkou a před sídlišti.'),
    IPR('praha_o1945', IPR_ORTO, 4, 'Praha – ortofoto 1945', '1945', 1945, 'letecké snímky', 'Praha na konci války – stopy náletů (Vinohrady, Nusle, Vršovice).'),
    IPR('praha_o1953', IPR_ORTO, 8, 'Praha – ortofoto 1953', '1953', 1953, 'letecké snímky', 'Praha a okolní obce na počátku 50. let.'),
    IPR('praha_o1966', IPR_ORTO, 150, 'Praha – ortofoto 1966', '1966', 1966, 'letecké snímky', 'Začátky velkých sídlišť.'),
    IPR('praha_o1975', IPR_ORTO, 12, 'Praha – ortofoto 1975', '1975', 1975, 'letecké snímky', 'Stavba metra, magistrály a Jižního Města.'),
    IPR('praha_o1989', IPR_ORTO, 16, 'Praha – ortofoto 1988–1989', '1988–1989', 1989, 'letecké snímky', 'Praha na konci socialismu.'),
    IPR('praha_o1996', IPR_ORTO, 20, 'Praha – ortofoto 1996', '1996', 1996, 'letecké snímky', 'První polistopadová dekáda.'),
    IPR('praha_o2002', IPR_ORTO, 36, 'Praha – zaplavená území 2002', '2002', 2002, 'letecké snímky', 'Snímky z povodně v srpnu 2002.'),
    IPR('praha_o2010', IPR_ORTO, 68, 'Praha – ortofoto 2010', '2010', 2010, 'rozlišení 10 cm', 'Barevná ortofotomapa celé Prahy.'),
    IPR('praha_1791', IPR_PLANY, 10, 'Hergetův plán Prahy', '1791', 1791, 'plán města', 'Plán Prahy inženýra Františka Antonína Hergeta – město ještě v hradbách.'),
    IPR('praha_1816', IPR_PLANY, 1, 'Jüttnerův plán Prahy', '1816', 1816, 'měřítko asi 1 : 4 000', 'Nejpřesnější plán Prahy první poloviny 19. století, s jednotlivými domy a zahradami.'),
    IPR('praha_1869', IPR_PLANY, 2, 'Polohopisný plán Prahy se Smíchovem a Karlínem', '1869', 1869, 'plán města', 'Polohopisný plán s čísly popisnými – Praha před zbouráním hradeb.'),
    IPR('praha_1884', IPR_PLANY, 3, 'Polohopisný plán královského hlavního města Prahy', '1884', 1884, 'plán města', 'Praha před asanací Josefova.'),
    IPR('praha_1889', IPR_PLANY, 4, 'Plán polohy a výšek Prahy', '1889', 1889, 'plán města', 'Plán s výškopisem.'),
    IPR('praha_1891', IPR_PLANY, 9, 'Polohopisný plán Prahy 1891', '1891', 1891, 'plán města', 'Praha v roce Jubilejní výstavy.'),
    IPR('praha_1910', IPR_PLANY, 5, 'Orientační plán Prahy a obcí sousedních', '1909–1914', 1912, 'plán města', 'Praha a předměstí před první světovou válkou.'),
    IPR('praha_1922', IPR_PLANY, 6, 'Výškopisný plán Prahy s okolím', '1920–1924', 1922, 'plán města', 'Velká Praha po roce 1920.'),
    IPR('praha_1938p', IPR_PLANY, 7, 'Orientační plán Prahy s okolím 1938', '1938', 1938, 'plán města', 'Plán z konce první republiky – porovnejte s leteckým snímkem téhož roku.'),
    IPR('praha_1944', IPR_PLANY, 8, 'Plán Prahy 1944', '1944', 1944, 'plán města', 'Plán z doby protektorátu (dvojjazyčné názvy).'),

    /* ----- Slovensko (GKÚ Bratislava, ZBGIS) ----- */
    { id: 'sk_vm3', nazev: 'Slovensko – III. vojenské mapování (reambulované)', rok: '1920–1934', razeni: 1927, meritko: 'měřítko 1 : 25 000', typ: 'xyz', oblast: 'sk',
      url: 'https://zbgis.skgeodesy.sk/zbgis/rest/services/HM_III_VM/MapServer/tile/{z}/{y}/{x}', maxZoom: 16, bounds: SR_BOX,
      zdroj: 'MO SR – Topografický ústav Banská Bystrica, SAŽP, Stavebná fakulta STU, GKÚ Bratislava', licence: 'CC BY 4.0',
      atribuce: 'Historická mapa III. VM © ' + a('https://www.geoportal.sk', 'GKÚ Bratislava') + ', TOPÚ Banská Bystrica, ' + CCBY,
      popis: 'Reambulované listy III. vojenského mapování z let 1920–1934 (236 listů) – Slovensko za první republiky.' },
    { id: 'sk_smo5', nazev: 'Slovensko – ŠMO 1 : 5 000, 1. vydání', rok: '50.–60. léta', razeni: 1958, meritko: 'měřítko 1 : 5 000', typ: 'xyz', oblast: 'sk',
      url: 'https://zbgis.skgeodesy.sk/zbgis/rest/services/SMO5_1vydanie/MapServer/tile/{z}/{y}/{x}', maxZoom: 17, bounds: SR_BOX,
      zdroj: 'GKÚ Bratislava (archiv ZBGIS)', licence: 'otevřená data ÚGKK SR – CC BY 4.0 (u této vrstvy výslovně neuvedeno)',
      atribuce: 'ŠMO5 © ' + a('https://www.geoportal.sk', 'GKÚ Bratislava'),
      popis: 'První vydání Státní mapy odvozené – černobílý polohopis s parcelami z doby před i po kolektivizaci, rok vydání se liší podle listu.' },
    { id: 'sk_smo5f', nazev: 'Slovensko – ŠMO 1 : 5 000, další vydání', rok: '70.–90. léta', razeni: 1985, meritko: 'měřítko 1 : 5 000', typ: 'xyz', oblast: 'sk',
      url: 'https://zbgis.skgeodesy.sk/zbgis/rest/services/SMO5_dalsie_vydanie_far/MapServer/tile/{z}/{y}/{x}', maxZoom: 17, bounds: SR_BOX,
      zdroj: 'GKÚ Bratislava (archiv ZBGIS)', licence: 'otevřená data ÚGKK SR – CC BY 4.0 (u této vrstvy výslovně neuvedeno)',
      atribuce: 'ŠMO5 © ' + a('https://www.geoportal.sk', 'GKÚ Bratislava'),
      popis: 'Pozdější barevná vydání ŠMO 5 s výškopisem – stav krajiny po kolektivizaci a výstavbě sídlišť.' },

    /* ----- Rakousko ----- */
    { id: 'stmk_kat', nazev: 'Štýrsko – Františkův stabilní katastr', rok: '1820–1841', razeni: 1830, meritko: 'měřítko 1 : 2 880', typ: 'arcgis', oblast: 'at',
      url: 'https://gis.stmk.gv.at/image/rest/services/OGD_RDATA/FranziszeischerKataster/ImageServer/exportImage', parametry: 'format=jpg', maxZoom: 20, bounds: STMK,
      zdroj: 'Land Steiermark – GIS-Steiermark, Steiermärkisches Landesarchiv', licence: 'CC BY 4.0',
      atribuce: 'Franziszeischer Kataster – Datenquelle: CC-BY-4.0: Land Steiermark – ' + a('https://data.steiermark.gv.at', 'data.steiermark.gv.at'),
      popis: 'Barevné mapy stabilního katastru Štýrska (stejné dílo jako české císařské otisky) – každá parcela, budovy zděné červeně, dřevěné žlutě. Digitalizace průběžně doplňována.' },
    VIDEN_LB(1938), VIDEN_LB(1956), VIDEN_LB(1961), VIDEN_LB(1971), VIDEN_LB(1976), VIDEN_LB(1981), VIDEN_LB(1986), VIDEN_LB(1992),

    /* ----- Sasko (GeoSN) ----- */
    { id: 'sn_mtb', nazev: 'Sasko – Messtischblatt (před 1945)', rok: 'před 1945', razeni: 1925, meritko: 'měřítko 1 : 25 000', typ: 'wms', oblast: 'sn',
      url: 'https://geodienste.sachsen.de/wms_geosn_hist/guest', vrstvy: 'messtischblatt_vor_1945', maxZoom: 18, bounds: SASKO,
      zdroj: 'Landesamt für Geobasisinformation Sachsen (GeoSN)', licence: 'dl-de/by-2-0',
      atribuce: 'Quelle: ' + a('https://www.geodaten.sachsen.de', 'GeoSN') + ', ' + a('https://www.govdata.de/dl-de/by-2-0', 'dl-de/by-2-0'),
      popis: 'Německé topografické listy 1 : 25 000 – saské příhraničí s Krušnými horami a Lužicí.' },
    { id: 'sn_ddr', nazev: 'Sasko – TK25 vydání NDR', rok: '70.–80. léta', razeni: 1980, meritko: 'měřítko 1 : 25 000', typ: 'wms', oblast: 'sn',
      url: 'https://geodienste.sachsen.de/wms_geosn_hist/guest', vrstvy: 'tk25_ddr_ausgabe_staat', maxZoom: 18, bounds: SASKO,
      zdroj: 'Landesamt für Geobasisinformation Sachsen (GeoSN)', licence: 'dl-de/by-2-0',
      atribuce: 'Quelle: ' + a('https://www.geodaten.sachsen.de', 'GeoSN') + ', ' + a('https://www.govdata.de/dl-de/by-2-0', 'dl-de/by-2-0'),
      popis: 'Topografická mapa NDR (vydání pro státní hospodářství) – Sasko před rokem 1990.' }
  ];
  const OBLASTI = { dnes: 'Dnešní mapy', cz: 'Česko', praha: 'Praha', sk: 'Slovensko', at: 'Rakousko', sn: 'Sasko', vlastni: 'Vlastní skeny' };
  const vrstva = id => VRSTVY.find(v => v.id === id) || null;

  /* vrstvy, které pokrývají daný bod (bez rozsahu = všude) */
  function vrstvyVBode(seznam, lat, lon) {
    return seznam.filter(v => !v.bounds || (lon >= v.bounds[0] && lon <= v.bounds[2] && lat >= v.bounds[1] && lat <= v.bounds[3]));
  }
  /* soused na časové ose (smer ±1) podle roku řazení, přeskočí aktuální */
  function sousedNaOse(seznam, id, smer) {
    const s = [...seznam].sort((x, y) => x.razeni - y.razeni || (x.id < y.id ? -1 : 1));
    const i = s.findIndex(v => v.id === id);
    if (i < 0) return s.length ? s[smer > 0 ? 0 : s.length - 1].id : null;
    const j = i + smer;
    return j >= 0 && j < s.length ? s[j].id : null;
  }

  /* ArcGIS export (MapServer/export i ImageServer/exportImage) pro dlaždici v EPSG:3857 */
  function urlArcgis(def, bbox, velikost) {
    return `${def.url}?bbox=${bbox.map(v => v.toFixed(2)).join(',')}&bboxSR=3857&imageSR=3857&size=${velikost},${velikost}&dpi=96&f=image` + (def.parametry ? '&' + def.parametry : '');
  }
  /* rozsah dlaždice z/x/y v metrech EPSG:3857 [xmin, ymin, xmax, ymax] */
  function bboxDlazdice(z, x, y) {
    const C = Math.PI * R_MERC, s = 2 * C / Math.pow(2, z);
    return [-C + x * s, C - (y + 1) * s, -C + (x + 1) * s, C - y * s];
  }

  /* ---------- Geodézie: délky a plochy na elipsoidu WGS84 ---------- */
  /* Vincentyho inverzní úloha – délka geodetiky v metrech (přesnost < 1 mm) */
  function vzdalenost(p1, p2) {
    const af = WGS84.a, f = WGS84.f, b = af * (1 - f);
    const L = (p2.lon - p1.lon) * RAD;
    const U1 = Math.atan((1 - f) * Math.tan(p1.lat * RAD)), U2 = Math.atan((1 - f) * Math.tan(p2.lat * RAD));
    const sU1 = Math.sin(U1), cU1 = Math.cos(U1), sU2 = Math.sin(U2), cU2 = Math.cos(U2);
    let l = L, lp, sS, cS, sig, c2a, c2sm;
    for (let i = 0; i < 200; i++) {
      const sl = Math.sin(l), cl = Math.cos(l);
      sS = Math.sqrt((cU2 * sl) ** 2 + (cU1 * sU2 - sU1 * cU2 * cl) ** 2);
      if (sS === 0) return 0;
      cS = sU1 * sU2 + cU1 * cU2 * cl;
      sig = Math.atan2(sS, cS);
      const sa = cU1 * cU2 * sl / sS;
      c2a = 1 - sa * sa;
      c2sm = c2a ? cS - 2 * sU1 * sU2 / c2a : 0;
      const C = f / 16 * c2a * (4 + f * (4 - 3 * c2a));
      lp = l;
      l = L + (1 - C) * f * sa * (sig + C * sS * (c2sm + C * cS * (-1 + 2 * c2sm * c2sm)));
      if (Math.abs(l - lp) < 1e-12) break;
    }
    const u2 = c2a * (af * af - b * b) / (b * b);
    const A = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
    const B = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
    const ds = B * sS * (c2sm + B / 4 * (cS * (-1 + 2 * c2sm * c2sm) - B / 6 * c2sm * (-3 + 4 * sS * sS) * (-3 + 4 * c2sm * c2sm)));
    return b * A * (sig - ds);
  }
  function delkaLinie(body) {
    let s = 0;
    for (let i = 1; i < body.length; i++) s += vzdalenost(body[i - 1], body[i]);
    return s;
  }
  /* plocha mnohoúhelníku v m²: ekvivalentní (stejnoploché) válcové zobrazení elipsoidu + Gaussův vzorec */
  function plocha(body) {
    if (body.length < 3) return 0;
    const e2 = WGS84.f * (2 - WGS84.f), e = Math.sqrt(e2), A = WGS84.a;
    const q = lat => { const s = Math.sin(lat * RAD); return (1 - e2) * (s / (1 - e2 * s * s) - 1 / (2 * e) * Math.log((1 - e * s) / (1 + e * s))); };
    const lon0 = body[0].lon;
    const p = body.map(b => [A * (b.lon - lon0) * RAD, A * q(b.lat) / 2]);
    let s = 0;
    for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1; }
    return Math.abs(s) / 2;
  }
  function formatDelka(m) {
    if (m < 1000) return (m < 10 ? m.toFixed(2) : m.toFixed(1)).replace('.', ',') + ' m';
    return (m / 1000).toFixed(m < 10000 ? 3 : 2).replace('.', ',') + ' km';
  }
  function formatPlocha(m2) {
    if (m2 < 10000) return Math.round(m2).toLocaleString('cs-CZ') + ' m²';
    if (m2 < 1e6) return (m2 / 10000).toFixed(2).replace('.', ',') + ' ha';
    return (m2 / 1e6).toFixed(3).replace('.', ',') + ' km²';
  }

  /* ---------- Georeference vlastního skenu ---------- */
  /* body: [{ px, py, lat, lon }] (px, py = pixely obrázku, y dolů). Výsledek: koeficienty
     X = A·px + B·py + C, Y = D·px + E·py + F v metrech EPSG:3857, odchylky bodů v metrech v terénu a RMS. */
  function resLin(M, v) {                       // Gaussova eliminace s částečnou pivotací
    const n = v.length, m = M.map((r, i) => [...r, v[i]]);
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(m[i][k]) > Math.abs(m[p][k])) p = i;
      if (Math.abs(m[p][k]) < 1e-12) return null;
      [m[k], m[p]] = [m[p], m[k]];
      for (let i = k + 1; i < n; i++) { const c = m[i][k] / m[k][k]; for (let j = k; j <= n; j++) m[i][j] -= c * m[k][j]; }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = m[i][n]; for (let j = i + 1; j < n; j++) s -= m[i][j] * x[j]; x[i] = s / m[i][i]; }
    return x;
  }
  function mnc(radky, prave) {                  // nejmenší čtverce: (AᵀA) x = Aᵀb
    const k = radky[0].length, N = Array.from({ length: k }, () => new Array(k).fill(0)), w = new Array(k).fill(0);
    radky.forEach((r, i) => { for (let a = 0; a < k; a++) { w[a] += r[a] * prave[i]; for (let b = 0; b < k; b++) N[a][b] += r[a] * r[b]; } });
    return resLin(N, w);
  }
  const MIN_BODU = { helmert: 2, afinni: 3 };
  function georeference(body, metoda) {
    metoda = metoda === 'afinni' ? 'afinni' : 'helmert';
    if (!body || body.length < MIN_BODU[metoda]) return null;
    // těžiště kvůli numerické stabilitě
    const m = body.map(b => naMercator(b.lat, b.lon));
    const n = body.length;
    const sx = body.reduce((s, b) => s + b.px, 0) / n, sy = body.reduce((s, b) => s + b.py, 0) / n;
    const sX = m.reduce((s, p) => s + p.x, 0) / n, sY = m.reduce((s, p) => s + p.y, 0) / n;
    let A, B, C, D, E, F;
    if (metoda === 'helmert') {
      // X = a·u + b·v, Y = b·u − a·v (v = py dolů, tedy osa převrácená)
      const radky = [], prave = [];
      body.forEach((b, i) => {
        const u = b.px - sx, v = b.py - sy;
        radky.push([u, v]); prave.push(m[i].x - sX);
        radky.push([-v, u]); prave.push(m[i].y - sY);
      });
      const x = mnc(radky, prave);
      if (!x) return null;
      A = x[0]; B = x[1]; D = x[1]; E = -x[0];
    } else {
      const radky = body.map(b => [b.px - sx, b.py - sy, 1]);
      const px = mnc(radky, m.map(p => p.x - sX)), py = mnc(radky, m.map(p => p.y - sY));
      if (!px || !py) return null;
      A = px[0]; B = px[1]; D = py[0]; E = py[1];
      C = px[2]; F = py[2];
    }
    C = sX - A * sx - B * sy + (C || 0);
    F = sY - D * sx - E * sy + (F || 0);
    const par = { A, B, C, D, E, F };
    if (Math.abs(A * E - B * D) < 1e-18) return null;
    const odchylky = body.map((b, i) => {
      const X = A * b.px + B * b.py + C, Y = D * b.px + E * b.py + F;
      const k = Math.cos(b.lat * RAD);           // metry Mercatoru → metry v terénu
      return { dx: (X - m[i].x) * k, dy: (Y - m[i].y) * k, d: Math.hypot(X - m[i].x, Y - m[i].y) * k };
    });
    const rms = Math.sqrt(odchylky.reduce((s, o) => s + o.d * o.d, 0) / n);
    const k0 = Math.cos(body[0].lat * RAD);
    const meritkoPx = Math.sqrt(Math.abs(A * E - B * D)) * k0;           // metrů v terénu na pixel
    const natoceni = Math.atan2(D, A) / RAD;
    return { metoda, par, odchylky, rms, meritkoPx, natoceni, nadbytek: n * 2 - (metoda === 'helmert' ? 4 : 6) };
  }
  function pixelNaWgsSken(par, px, py) {
    return zMercatoru(par.A * px + par.B * py + par.C, par.D * px + par.E * py + par.F);
  }
  /* inverze: zeměpisné souřadnice → pixel skenu */
  function wgsNaPixelSken(par, lat, lon) {
    const m = naMercator(lat, lon), det = par.A * par.E - par.B * par.D;
    const X = m.x - par.C, Y = m.y - par.F;
    return { px: (par.E * X - par.B * Y) / det, py: (-par.D * X + par.A * Y) / det };
  }
  /* transformace pro canvas setTransform(a,b,c,d,e,f): pixel skenu → pixel dlaždice z/x/y (256 px) */
  function transformDlazdice(par, z, tx, ty) {
    const C = Math.PI * R_MERC, k = 256 * Math.pow(2, z) / (2 * C);
    return [k * par.A, -k * par.D, k * par.B, -k * par.E, k * (par.C + C) - 256 * tx, k * (C - par.F) - 256 * ty];
  }
  /* rozsah skenu v zeměpisných souřadnicích [w, s, e, n] */
  function rozsahSkenu(par, sirka, vyska) {
    const r = [[0, 0], [sirka, 0], [0, vyska], [sirka, vyska]].map(([x, y]) => pixelNaWgsSken(par, x, y));
    return [Math.min(...r.map(p => p.lon)), Math.min(...r.map(p => p.lat)), Math.max(...r.map(p => p.lon)), Math.max(...r.map(p => p.lat))];
  }
  /* world file (.pgw/.jgw) v EPSG:3857 – střed levého horního pixelu */
  function worldFile(par) {
    const r = [par.A, par.D, par.B, par.E, par.C + par.A / 2 + par.B / 2, par.F + par.D / 2 + par.E / 2];
    return r.map(v => v.toFixed(10)).join('\n') + '\n';
  }

  /* ---------- Kresba (poznámky a měření) ↔ GeoJSON ---------- */
  /* kresba = { poznamky: [{ id, lat, lon, nazev, text }], mereni: [{ id, typ: 'linie'|'plocha', body: [{lat, lon}], nazev }] } */
  const zaokr6 = v => Math.round(v * 1e7) / 1e7;
  function kresbaNaGeoJSON(k) {
    const f = [];
    for (const p of k.poznamky || []) f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [zaokr6(p.lon), zaokr6(p.lat)] },
      properties: { druh: 'poznamka', nazev: p.nazev || '', text: p.text || '' } });
    for (const m of k.mereni || []) {
      const c = m.body.map(b => [zaokr6(b.lon), zaokr6(b.lat)]);
      if (m.typ === 'plocha') f.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...c, c[0]]] },
        properties: { druh: 'mereni', nazev: m.nazev || '', plocha_m2: Math.round(plocha(m.body) * 100) / 100, obvod_m: Math.round(delkaLinie([...m.body, m.body[0]]) * 100) / 100 } });
      else f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: c },
        properties: { druh: 'mereni', nazev: m.nazev || '', delka_m: Math.round(delkaLinie(m.body) * 100) / 100 } });
    }
    return { type: 'FeatureCollection', features: f };
  }
  let citacId = 0;
  const noveId = () => Date.now().toString(36) + (citacId++).toString(36);
  function geoJsonNaKresbu(gj) {
    const k = { poznamky: [], mereni: [] };
    const bod = c => Array.isArray(c) && isFinite(c[0]) && isFinite(c[1]) && Math.abs(c[1]) <= 90 && Math.abs(c[0]) <= 180 ? { lat: +c[1], lon: +c[0] } : null;
    const pole = cc => (cc || []).map(bod).filter(Boolean);
    const vlastnosti = f => f.properties || {};
    const textN = v => String(v == null ? '' : v).slice(0, 2000);
    const pridej = (g, pr) => {
      if (!g) return;
      const nazev = textN(pr.nazev || pr.name || pr.title || '').slice(0, 120);
      if (g.type === 'Point') { const b = bod(g.coordinates); if (b) k.poznamky.push({ id: noveId(), ...b, nazev, text: textN(pr.text || pr.description || '') }); }
      else if (g.type === 'LineString') { const b = pole(g.coordinates); if (b.length >= 2) k.mereni.push({ id: noveId(), typ: 'linie', body: b, nazev }); }
      else if (g.type === 'Polygon') {
        const b = pole((g.coordinates || [])[0]);
        if (b.length > 1 && b[0].lat === b[b.length - 1].lat && b[0].lon === b[b.length - 1].lon) b.pop();
        if (b.length >= 3) k.mereni.push({ id: noveId(), typ: 'plocha', body: b, nazev });
      } else if (/^Multi/.test(g.type)) (g.coordinates || []).forEach(c => pridej({ type: g.type.slice(5), coordinates: c }, pr));
      else if (g.type === 'GeometryCollection') (g.geometries || []).forEach(x => pridej(x, pr));
    };
    if (!gj || typeof gj !== 'object') throw new Error('Soubor není GeoJSON.');
    const prvky = gj.type === 'FeatureCollection' ? gj.features : gj.type === 'Feature' ? [gj] : gj.type ? [{ type: 'Feature', geometry: gj, properties: {} }] : null;
    if (!Array.isArray(prvky)) throw new Error('Soubor není GeoJSON.');
    prvky.forEach(f => f && pridej(f.geometry, vlastnosti(f)));
    return k;
  }

  /* ---------- Zpět / Znovu (snímky stavu jako JSON) ---------- */
  function Historie(limit) {
    const zpet = [], znovu = [];
    return {
      uloz(stav) { zpet.push(JSON.stringify(stav)); if (zpet.length > (limit || 100)) zpet.shift(); znovu.length = 0; },
      zpet(aktualni) { if (!zpet.length) return null; znovu.push(JSON.stringify(aktualni)); return JSON.parse(zpet.pop()); },
      znovu(aktualni) { if (!znovu.length) return null; zpet.push(JSON.stringify(aktualni)); return JSON.parse(znovu.pop()); },
      lzeZpet: () => zpet.length > 0, lzeZnovu: () => znovu.length > 0
    };
  }

  /* ---------- Souřadnice: rozpoznání vstupu ---------- */
  /* „50.087, 14.42“ (WGS84) nebo „-742856 -1043059“ / „742856, 1043059“ (S-JTSK, Y X kladně i záporně) */
  function parsujSouradnice(text) {
    const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*$/.exec(String(text || ''));
    if (!m) return null;
    const a1 = parseFloat(m[1].replace(',', '.')), a2 = parseFloat(m[2].replace(',', '.'));
    if (Math.abs(a1) <= 90 && Math.abs(a2) <= 180) return { lat: a1, lon: a2, system: 'wgs' };
    const y = -Math.abs(a1), x = -Math.abs(a2);                   // S-JTSK: Y ≈ 430–910 km, X ≈ 930–1 230 km
    if (Math.abs(y) > 300000 && Math.abs(y) < 950000 && Math.abs(x) > 900000 && Math.abs(x) < 1400000) {
      const g = jtskNaWgs(y, x);
      return { lat: g.lat, lon: g.lon, system: 'jtsk' };
    }
    return null;
  }
  function formatSouradnice(lat, lon) {
    const j = wgsNaJtsk(lat, lon);
    return { wgs: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, jtsk: `Y ${Math.round(-j.x).toLocaleString('cs-CZ')}  X ${Math.round(-j.y).toLocaleString('cs-CZ')}` };
  }
  /* přibližné měřítko obrazovky 1 : N (96 dpi) */
  function meritkoObrazovky(z, lat) {
    return 2 * Math.PI * R_MERC / 256 / Math.pow(2, z) * Math.cos(lat * RAD) / 0.0254 * 96;
  }
  /* text atribuce bez HTML (pro export obrázku) */
  const bezHtml = s => String(s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

  const api = {
    naMercator, zMercatoru, pixelNaWgs, wgsNaJtsk, jtskNaWgs, besselNaKrovak, krovakNaBessel,
    parsujWmts, urlDlazdice, vyberUroven, dlazdiceObdelniku, mrizkaDlazdice,
    REZIMY, stavDoHashe, hashNaStav, vyrez3857, vyrezJtsk, vyrezWgs, ODKAZY, VRSTVY, OBLASTI, CENIA_UROVNE, vrstva,
    vrstvyVBode, sousedNaOse, urlArcgis, bboxDlazdice,
    vzdalenost, delkaLinie, plocha, formatDelka, formatPlocha,
    georeference, MIN_BODU, pixelNaWgsSken, wgsNaPixelSken, transformDlazdice, rozsahSkenu, worldFile,
    kresbaNaGeoJSON, geoJsonNaKresbu, noveId, Historie, parsujSouradnice, formatSouradnice, meritkoObrazovky, bezHtml
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.STMAPY = api;
})();
