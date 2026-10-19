/* ============================================================
   Výletní deník – výpočetní jádro (bez DOM, testovatelné v node)

   Obsah:
     XML       – malý parser XML (GPX, KML) bez DOMParseru
     TRASY     – import GPX / KML (trk, rte, wpt, LineString, gx:Track, Point)
     GEO       – vzdálenost (haversine), délka, převýšení syrové i vyhlazené,
                 čas v pohybu, výškový profil, zjednodušení (Douglas–Peucker)
     EXIF      – minimální čtečka EXIF (JPEG APP1, WebP, PNG eXIf):
                 datum pořízení, časový posun, GPS, orientace, přístroj
     ZIP       – zapisovač „uloženo“ (bez komprese) a čtečka centrálního adresáře
     DENÍK     – kalendář, filtry, statistiky podle let, náklady, formátování
   ============================================================ */
(function () {
  'use strict';

  /* ======================= XML ======================= */
  const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  function dekodujEntity(s) {
    if (s.indexOf('&') < 0) return s;
    return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e) => {
      if (e[0] === '#') {
        const k = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(k) && k >= 0 && k <= 0x10FFFF ? String.fromCodePoint(k) : m;
      }
      return Object.prototype.hasOwnProperty.call(ENTITY, e) ? ENTITY[e] : m;
    });
  }
  const lokalni = n => { const i = n.indexOf(':'); return (i >= 0 ? n.slice(i + 1) : n).toLowerCase(); };

  /** Vrátí kořenový uzel {jmeno, lok, atr, deti, text}. Vyhodí Error při zjevně neplatném XML. */
  function parsujXML(xml) {
    if (typeof xml !== 'string') throw new Error('XML musí být text');
    if (xml.charCodeAt(0) === 0xFEFF) xml = xml.slice(1);
    const koren = { jmeno: '#dokument', lok: '#dokument', atr: {}, deti: [], text: '' };
    const zasobnik = [koren];
    let i = 0;
    const n = xml.length;
    const reAtr = /([^\s=\/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    while (i < n) {
      const lt = xml.indexOf('<', i);
      const vrch = zasobnik[zasobnik.length - 1];
      if (lt < 0) { vrch.text += dekodujEntity(xml.slice(i)); break; }
      if (lt > i) vrch.text += dekodujEntity(xml.slice(i, lt));
      if (xml.startsWith('<!--', lt)) {
        const k = xml.indexOf('-->', lt + 4); if (k < 0) throw new Error('Neukončený komentář v XML');
        i = k + 3; continue;
      }
      if (xml.startsWith('<![CDATA[', lt)) {
        const k = xml.indexOf(']]>', lt + 9); if (k < 0) throw new Error('Neukončená sekce CDATA v XML');
        vrch.text += xml.slice(lt + 9, k); i = k + 3; continue;
      }
      if (xml.startsWith('<?', lt)) {
        const k = xml.indexOf('?>', lt + 2); if (k < 0) throw new Error('Neukončená instrukce v XML');
        i = k + 2; continue;
      }
      if (xml.startsWith('<!', lt)) {          // DOCTYPE (případně s vnitřní podmnožinou)
        let hl = 0, k = lt + 2;
        for (; k < n; k++) { const c = xml[k]; if (c === '[') hl++; else if (c === ']') hl--; else if (c === '>' && hl <= 0) break; }
        i = k + 1; continue;
      }
      // značka – najít konec mimo uvozovky
      let k = lt + 1, uv = null;
      for (; k < n; k++) {
        const c = xml[k];
        if (uv) { if (c === uv) uv = null; }
        else if (c === '"' || c === "'") uv = c;
        else if (c === '>') break;
      }
      if (k >= n) throw new Error('Neukončená značka v XML');
      let obsah = xml.slice(lt + 1, k);
      i = k + 1;
      if (obsah[0] === '/') {
        const jm = obsah.slice(1).trim();
        // tolerance: zavřít až po odpovídající otevřenou značku
        let j = zasobnik.length - 1;
        while (j > 0 && zasobnik[j].jmeno !== jm) j--;
        if (j === 0) throw new Error('Nečekaná koncová značka </' + jm + '>');
        zasobnik.length = j;
        continue;
      }
      const samo = obsah.endsWith('/');
      if (samo) obsah = obsah.slice(0, -1);
      const m = /^([^\s\/>]+)/.exec(obsah);
      if (!m) throw new Error('Neplatná značka v XML');
      const uzel = { jmeno: m[1], lok: lokalni(m[1]), atr: {}, deti: [], text: '' };
      reAtr.lastIndex = m[1].length;
      let a;
      while ((a = reAtr.exec(obsah))) uzel.atr[a[1]] = dekodujEntity(a[3] !== undefined ? a[3] : a[4]);
      vrch.deti.push(uzel);
      if (!samo) zasobnik.push(uzel);
    }
    if (!koren.deti.length) throw new Error('Soubor neobsahuje žádný XML prvek');
    return koren;
  }
  function potomci(uzel, lok, vysledek) {     // všichni potomci daného lokálního jména (do hloubky)
    vysledek = vysledek || [];
    for (const d of uzel.deti) { if (d.lok === lok) vysledek.push(d); potomci(d, lok, vysledek); }
    return vysledek;
  }
  const dite = (uzel, lok) => uzel.deti.find(d => d.lok === lok) || null;
  const textDite = (uzel, lok) => { const d = dite(uzel, lok); return d ? textCely(d).trim() : ''; };
  function textCely(u) { let s = u.text; for (const d of u.deti) s += textCely(d); return s; }

  /* ======================= TRASY ======================= */
  function cisloNeboNull(s) {
    if (s === undefined || s === null) return null;
    const t = String(s).trim();
    if (t === '') return null;
    const x = Number(t);
    return Number.isFinite(x) ? x : null;
  }
  function casNeboNull(s) {
    if (!s) return null;
    const t = Date.parse(String(s).trim());
    return Number.isFinite(t) ? t : null;
  }
  const platnaPoloha = (lat, lon) => lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

  /** Výšky rovné nule ve všech bodech segmentu = neznámá výška (KML „,0“, plánovač). */
  function vycistiVysky(seg) {
    if (seg.length && seg.every(b => b.ele === null || b.ele === 0)) seg.forEach(b => { b.ele = null; });
    return seg;
  }

  function parsujGPX(xml) {
    const koren = parsujXML(xml);
    const gpx = potomci(koren, 'gpx')[0];
    if (!gpx) throw new Error('Nejde o GPX (chybí prvek <gpx>)');
    const trasy = [], body = [];
    const bod = u => {
      const lat = cisloNeboNull(u.atr.lat), lon = cisloNeboNull(u.atr.lon);
      if (!platnaPoloha(lat, lon)) return null;
      return { lat, lon, ele: cisloNeboNull(textDite(u, 'ele')), t: casNeboNull(textDite(u, 'time')) };
    };
    for (const trk of potomci(gpx, 'trk')) {
      const segmenty = [];
      for (const seg of trk.deti.filter(d => d.lok === 'trkseg')) {
        const s = seg.deti.filter(d => d.lok === 'trkpt').map(bod).filter(Boolean);
        if (s.length) segmenty.push(vycistiVysky(s));
      }
      if (segmenty.length) trasy.push({ nazev: textDite(trk, 'name'), typ: 'trk', segmenty });
    }
    for (const rte of potomci(gpx, 'rte')) {
      const s = rte.deti.filter(d => d.lok === 'rtept').map(bod).filter(Boolean);
      if (s.length) trasy.push({ nazev: textDite(rte, 'name'), typ: 'rte', segmenty: [vycistiVysky(s)] });
    }
    for (const w of gpx.deti.filter(d => d.lok === 'wpt')) {
      const b = bod(w);
      if (!b) continue;
      body.push({ nazev: textDite(w, 'name') || 'Bod', popis: textDite(w, 'desc') || textDite(w, 'cmt'),
        lat: b.lat, lon: b.lon, ele: b.ele, t: b.t });
    }
    return { nazev: textDite(dite(gpx, 'metadata') || gpx, 'name'), trasy, body };
  }

  function parsujKoordinatyKML(text) {
    const vys = [];
    for (const kus of String(text).trim().split(/\s+/)) {
      if (!kus) continue;
      const c = kus.split(',');
      const lon = cisloNeboNull(c[0]), lat = cisloNeboNull(c[1]);
      if (!platnaPoloha(lat, lon)) continue;
      vys.push({ lat, lon, ele: c.length > 2 ? cisloNeboNull(c[2]) : null, t: null });
    }
    return vys;
  }
  function parsujKML(xml) {
    const koren = parsujXML(xml);
    const kml = potomci(koren, 'kml')[0] || potomci(koren, 'document')[0];
    if (!kml) throw new Error('Nejde o KML (chybí prvek <kml>)');
    const trasy = [], body = [];
    for (const pm of potomci(kml, 'placemark')) {
      const nazev = textDite(pm, 'name'), popis = textDite(pm, 'description');
      const segmenty = [];
      for (const ls of potomci(pm, 'linestring').concat(potomci(pm, 'linearring'))) {
        const s = parsujKoordinatyKML(textDite(ls, 'coordinates'));
        if (s.length) segmenty.push(vycistiVysky(s));
      }
      for (const tr of potomci(pm, 'track')) {           // gx:Track
        const kdy = tr.deti.filter(d => d.lok === 'when').map(d => casNeboNull(textCely(d)));
        const sour = tr.deti.filter(d => d.lok === 'coord');
        const s = [];
        sour.forEach((d, j) => {
          const c = textCely(d).trim().split(/\s+/);
          const lon = cisloNeboNull(c[0]), lat = cisloNeboNull(c[1]);
          if (platnaPoloha(lat, lon)) s.push({ lat, lon, ele: cisloNeboNull(c[2]), t: kdy[j] !== undefined ? kdy[j] : null });
        });
        if (s.length) segmenty.push(vycistiVysky(s));
      }
      if (segmenty.length) trasy.push({ nazev, typ: 'kml', segmenty });
      for (const pt of potomci(pm, 'point')) {
        const s = parsujKoordinatyKML(textDite(pt, 'coordinates'));
        if (s.length) body.push({ nazev: nazev || 'Bod', popis, lat: s[0].lat, lon: s[0].lon, ele: s[0].ele || null, t: null });
      }
    }
    const doc = potomci(kml, 'document')[0];
    return { nazev: doc ? textDite(doc, 'name') : '', trasy, body };
  }

  /** Rozpozná formát podle obsahu (a přípony) a vrátí {nazev, trasy, body}. */
  function nactiTrasu(text, nazevSouboru) {
    const zac = String(text).slice(0, 4000).toLowerCase();
    const pr = String(nazevSouboru || '').toLowerCase();
    let v;
    if (/<gpx[\s>]/.test(zac) || (pr.endsWith('.gpx') && !/<kml[\s>]/.test(zac))) v = parsujGPX(text);
    else if (/<kml[\s>]/.test(zac) || pr.endsWith('.kml')) v = parsujKML(text);
    else throw new Error('Neznámý formát – podporováno GPX a KML/KMZ');
    if (!v.trasy.length && !v.body.length) throw new Error('Soubor neobsahuje trasu ani body');
    return v;
  }

  /** Export výletu do GPX 1.1 (trasy jako trk, body zájmu jako wpt). */
  function exportGPX(vylet, trasy, body) {
    const x = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const bodXml = (b, el) => `<${el} lat="${+b.lat.toFixed(7)}" lon="${+b.lon.toFixed(7)}">` +
      (b.ele !== null && b.ele !== undefined ? `<ele>${+(+b.ele).toFixed(1)}</ele>` : '') +
      (b.t ? `<time>${new Date(b.t).toISOString()}</time>` : '');
    let s = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Výletní deník" xmlns="http://www.topografix.com/GPX/1/1">\n';
    s += `<metadata><name>${x(vylet && vylet.nazev)}</name>${vylet && vylet.popis ? `<desc>${x(vylet.popis)}</desc>` : ''}</metadata>\n`;
    for (const b of body || []) s += bodXml(b, 'wpt') + `<name>${x(b.nazev)}</name>${b.popis ? `<desc>${x(b.popis)}</desc>` : ''}</wpt>\n`;
    for (const t of trasy || []) {
      s += `<trk><name>${x(t.nazev)}</name>\n`;
      for (const seg of t.segmenty) {
        s += '<trkseg>\n';
        for (const b of seg) s += bodXml(b, 'trkpt') + '</trkpt>\n';
        s += '</trkseg>\n';
      }
      s += '</trk>\n';
    }
    return s + '</gpx>\n';
  }

  /* ======================= GEO ======================= */
  const R_ZEME = 6371008.8;            // střední poloměr Země (IUGG), m
  const rad = d => d * Math.PI / 180;
  /** Vzdálenost po kouli (haversine), metry. */
  function vzdalenost(lat1, lon1, lat2, lon2) {
    const dl = rad(lat2 - lat1), dn = rad(lon2 - lon1);
    const a = Math.sin(dl / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dn / 2) ** 2;
    return 2 * R_ZEME * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /** Klouzavý průměr výšek v okně ±okno/2 metrů po délce trasy (dva ukazatele, O(n)). */
  function vyhladVysky(d, e, okno) {
    const n = d.length, v = new Array(n);
    if (!(okno > 0)) { for (let i = 0; i < n; i++) v[i] = e[i]; return v; }
    const pul = okno / 2;
    let a = 0, b = 0, suma = 0;
    for (let i = 0; i < n; i++) {
      while (b < n && d[b] <= d[i] + pul) { suma += e[b]; b++; }
      while (d[a] < d[i] - pul) { suma -= e[a]; a++; }
      v[i] = suma / (b - a);
    }
    return v;
  }
  /** Součet stoupání a klesání s hysterezí: změna se započte až po překročení prahu od posledního referenčního bodu. */
  function stoupaniSPrahem(e, prah) {
    let nahoru = 0, dolu = 0;
    if (!e.length) return { nahoru, dolu };
    if (!(prah > 0)) {
      for (let i = 1; i < e.length; i++) { const r = e[i] - e[i - 1]; if (r > 0) nahoru += r; else dolu -= r; }
      return { nahoru, dolu };
    }
    let ref = e[0];
    for (let i = 1; i < e.length; i++) {
      const r = e[i] - ref;
      if (r >= prah) { nahoru += r; ref = e[i]; }
      else if (-r >= prah) { dolu -= r; ref = e[i]; }
    }
    return { nahoru, dolu };
  }

  const VYCHOZI_VYSKY = { okno: 50, prah: 3 };
  const RYCHLOST_POHYBU = 0.5;        // m/s – pod tím se úsek počítá jako zastávka
  const MAX_MEZERA = 5 * 60 * 1000;   // delší mezera mezi body = přestávka / vypnutý přístroj

  /**
   * Statistika trasy z pole segmentů [[{lat,lon,ele,t}]].
   * Mezi segmenty se vzdálenost nepočítá (přerušený záznam).
   */
  function statistikaTrasy(segmenty, volby) {
    const o = Object.assign({}, VYCHOZI_VYSKY, volby || {});
    const st = { delka: 0, stoupani: 0, klesani: 0, stoupaniSyrove: 0, klesaniSyrove: 0,
      minEle: null, maxEle: null, casZacatek: null, casKonec: null, casCelkem: 0, casPohyb: 0,
      pocetBodu: 0, maVysky: false, maCasy: false, bbox: null, metoda: { okno: o.okno, prah: o.prah } };
    let s = 90, w = 180, nn = -90, ee = -180;
    for (const seg of segmenty || []) {
      if (!seg || !seg.length) continue;
      const d = [], e = [];
      let dl = 0;
      for (let i = 0; i < seg.length; i++) {
        const b = seg[i];
        st.pocetBodu++;
        if (b.lat < s) s = b.lat; if (b.lat > nn) nn = b.lat;
        if (b.lon < w) w = b.lon; if (b.lon > ee) ee = b.lon;
        if (i > 0) {
          const p = seg[i - 1];
          const dd = vzdalenost(p.lat, p.lon, b.lat, b.lon);
          dl += dd;
          if (p.t !== null && b.t !== null && p.t !== undefined && b.t !== undefined) {
            const dt = b.t - p.t;
            if (dt > 0 && dt <= MAX_MEZERA && dd / (dt / 1000) >= RYCHLOST_POHYBU) st.casPohyb += dt;
          }
        }
        if (b.ele !== null && b.ele !== undefined && Number.isFinite(b.ele)) {
          d.push(dl); e.push(b.ele);
          if (st.minEle === null || b.ele < st.minEle) st.minEle = b.ele;
          if (st.maxEle === null || b.ele > st.maxEle) st.maxEle = b.ele;
        }
        if (b.t !== null && b.t !== undefined && Number.isFinite(b.t)) {
          if (st.casZacatek === null || b.t < st.casZacatek) st.casZacatek = b.t;
          if (st.casKonec === null || b.t > st.casKonec) st.casKonec = b.t;
        }
      }
      st.delka += dl;
      if (e.length > 1) {
        st.maVysky = true;
        const syr = stoupaniSPrahem(e, 0);
        st.stoupaniSyrove += syr.nahoru; st.klesaniSyrove += syr.dolu;
        const hl = stoupaniSPrahem(vyhladVysky(d, e, o.okno), o.prah);
        st.stoupani += hl.nahoru; st.klesani += hl.dolu;
      }
    }
    if (st.casZacatek !== null && st.casKonec > st.casZacatek) { st.maCasy = true; st.casCelkem = st.casKonec - st.casZacatek; }
    if (st.pocetBodu) st.bbox = [s, w, nn, ee];
    return st;
  }

  /** Body výškového profilu: [{d, ele, eleHladka, lat, lon, t}] – vzdálenost průběžná přes segmenty. */
  function vyskovyProfil(segmenty, volby) {
    const o = Object.assign({}, VYCHOZI_VYSKY, volby || {});
    const vys = [];
    let zaklad = 0;
    for (const seg of segmenty || []) {
      let dl = 0;
      const casti = [];
      for (let i = 0; i < seg.length; i++) {
        if (i > 0) dl += vzdalenost(seg[i - 1].lat, seg[i - 1].lon, seg[i].lat, seg[i].lon);
        const b = seg[i];
        if (b.ele !== null && b.ele !== undefined && Number.isFinite(b.ele))
          casti.push({ d: zaklad + dl, ele: b.ele, lat: b.lat, lon: b.lon, t: b.t == null ? null : b.t });
      }
      const hl = vyhladVysky(casti.map(c => c.d), casti.map(c => c.ele), o.okno);
      const rv = casti.length > 1 && casti.every(c => c.t !== null) ? rychlostiVOkne(casti.map(c => c.d), casti.map(c => c.t), 100) : null;
      casti.forEach((c, i) => { c.eleHladka = hl[i]; c.v = rv ? rv[i] : null; vys.push(c); });
      zaklad += dl;
    }
    return vys;
  }

  /** Douglas–Peucker v metrech (lokální rovinná projekce). Vrací pole [lat, lon]. */
  function zjednodus(body, tolerance) {
    const n = body.length;
    if (n <= 2) return body.map(b => [b.lat, b.lon]);
    const lat0 = rad(body[0].lat), kx = Math.cos(lat0) * R_ZEME * Math.PI / 180, ky = R_ZEME * Math.PI / 180;
    const x = body.map(b => b.lon * kx), y = body.map(b => b.lat * ky);
    const drz = new Uint8Array(n); drz[0] = drz[n - 1] = 1;
    const zas = [[0, n - 1]];
    const t2 = tolerance * tolerance;
    while (zas.length) {
      const [a, b] = zas.pop();
      const dx = x[b] - x[a], dy = y[b] - y[a], l2 = dx * dx + dy * dy;
      let maxD = -1, idx = -1;
      for (let i = a + 1; i < b; i++) {
        let px, py;
        if (l2 === 0) { px = x[i] - x[a]; py = y[i] - y[a]; }
        else {
          let u = ((x[i] - x[a]) * dx + (y[i] - y[a]) * dy) / l2;
          u = Math.max(0, Math.min(1, u));
          px = x[i] - (x[a] + u * dx); py = y[i] - (y[a] + u * dy);
        }
        const d2 = px * px + py * py;
        if (d2 > maxD) { maxD = d2; idx = i; }
      }
      if (maxD > t2) { drz[idx] = 1; zas.push([a, idx], [idx, b]); }
    }
    const v = [];
    for (let i = 0; i < n; i++) if (drz[i]) v.push([body[i].lat, body[i].lon]);
    return v;
  }
  /** Zjednodušený náhled všech segmentů, s tolerancí zvyšovanou tak, aby bodů bylo nejvýš maxBodu. */
  function nahledTrasy(segmenty, maxBodu) {
    maxBodu = maxBodu || 400;
    let tol = 5, vys;
    for (let k = 0; k < 12; k++) {
      vys = (segmenty || []).filter(s => s.length).map(s => zjednodus(s, tol));
      const pocet = vys.reduce((a, s) => a + s.length, 0);
      if (pocet <= maxBodu) break;
      tol *= 2;
    }
    return (vys || []).map(s => s.map(([a, b]) => [Math.round(a * 1e5) / 1e5, Math.round(b * 1e5) / 1e5]));
  }

  /** Poloha na trase v čase tMs (lineární interpolace). null, pokud čas leží mimo záznam o víc než tolerance. */
  function polohaPodleCasu(segmenty, tMs, toleranceMs) {
    const tol = toleranceMs === undefined ? 10 * 60 * 1000 : toleranceMs;
    let nejlepsi = null;
    for (const seg of segmenty || []) {
      const s = seg.filter(b => b.t !== null && b.t !== undefined);
      if (!s.length) continue;
      if (tMs < s[0].t - tol || tMs > s[s.length - 1].t + tol) continue;
      if (tMs <= s[0].t) { const r = s[0].t - tMs; if (!nejlepsi || r < nejlepsi.r) nejlepsi = { r, lat: s[0].lat, lon: s[0].lon, ele: s[0].ele }; continue; }
      if (tMs >= s[s.length - 1].t) { const b = s[s.length - 1], r = tMs - b.t; if (!nejlepsi || r < nejlepsi.r) nejlepsi = { r, lat: b.lat, lon: b.lon, ele: b.ele }; continue; }
      let lo = 0, hi = s.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m].t <= tMs) lo = m; else hi = m; }
      const a = s[lo], b = s[hi], u = b.t === a.t ? 0 : (tMs - a.t) / (b.t - a.t);
      const ele = a.ele != null && b.ele != null ? a.ele + u * (b.ele - a.ele) : (a.ele != null ? a.ele : b.ele);
      return { lat: a.lat + u * (b.lat - a.lat), lon: a.lon + u * (b.lon - a.lon), ele: ele == null ? null : ele };
    }
    return nejlepsi ? { lat: nejlepsi.lat, lon: nejlepsi.lon, ele: nejlepsi.ele == null ? null : nejlepsi.ele } : null;
  }

  /** Nejbližší bod (z pole {id, lat, lon}) do vzdálenosti maxM; vrací {bod, vzdalenost} nebo null. */
  function nejblizsiBod(body, lat, lon, maxM) {
    let nej = null;
    for (const b of body || []) {
      if (b.lat == null || b.lon == null) continue;
      const d = vzdalenost(lat, lon, b.lat, b.lon);
      if (d <= maxM && (!nej || d < nej.vzdalenost)) nej = { bod: b, vzdalenost: d };
    }
    return nej;
  }
  function bboxSjednot(a, b) {
    if (!a) return b ? b.slice() : null;
    if (!b) return a.slice();
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
  }
  const bboxPrekryv = (a, b) => !!(a && b && a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]);

  /* ======================= EXIF ======================= */
  const VEL_TYPU = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

  /** Najde TIFF blok EXIFu v JPEG / WebP / PNG. Vrací offset začátku TIFF hlavičky a délku, nebo null. */
  function najdiTiff(u8) {
    const n = u8.length;
    const ascii = (o, s) => { for (let i = 0; i < s.length; i++) if (u8[o + i] !== s.charCodeAt(i)) return false; return true; };
    if (n >= 4 && u8[0] === 0xFF && u8[1] === 0xD8) {          // JPEG
      let o = 2;
      while (o + 4 <= n) {
        if (u8[o] !== 0xFF) return null;
        const m = u8[o + 1];
        if (m === 0xFF) { o++; continue; }                     // výplň
        if (m === 0xD9 || m === 0xDA) return null;             // konec / začátek dat – EXIF už nebude
        if (m >= 0xD0 && m <= 0xD7 || m === 0x01) { o += 2; continue; }
        const len = (u8[o + 2] << 8) | u8[o + 3];
        if (len < 2) return null;
        if (m === 0xE1 && o + 10 <= n && ascii(o + 4, 'Exif') && u8[o + 8] === 0 && u8[o + 9] === 0)
          return { start: o + 10, delka: Math.min(len - 8, n - o - 10) };
        o += 2 + len;
      }
      return null;
    }
    if (n >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) {     // WebP
      let o = 12;
      while (o + 8 <= n) {
        const len = (u8[o + 4] | (u8[o + 5] << 8) | (u8[o + 6] << 16) | (u8[o + 7] << 24)) >>> 0;
        if (ascii(o, 'EXIF')) {
          let s = o + 8;
          if (ascii(s, 'Exif') && u8[s + 4] === 0) s += 6;
          return { start: s, delka: Math.min(len - (s - o - 8), n - s) };
        }
        o += 8 + len + (len & 1);
      }
      return null;
    }
    if (n >= 8 && u8[0] === 0x89 && ascii(1, 'PNG')) {        // PNG
      let o = 8;
      while (o + 12 <= n) {
        const len = ((u8[o] << 24) | (u8[o + 1] << 16) | (u8[o + 2] << 8) | u8[o + 3]) >>> 0;
        if (ascii(o + 4, 'eXIf')) return { start: o + 8, delka: Math.min(len, n - o - 8) };
        if (ascii(o + 4, 'IEND')) return null;
        o += 12 + len;
      }
    }
    return null;
  }

  /** EXIF datum „YYYY:MM:DD HH:MM:SS“ → „YYYY-MM-DDTHH:MM:SS“ (místní čas přístroje) nebo null. */
  function exifDatum(s) {
    const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(s || '').trim());
    if (!m || m[1] === '0000') return null;
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  }

  /**
   * Přečte EXIF z ArrayBuffer/Uint8Array obrázku.
   * Vrací {datum, posun, datumUTC, gps:{lat,lon,alt}|null, gpsCasUTC, orientace, vyrobce, model} nebo null (bez EXIFu).
   */
  function ctiExif(vstup) {
    const u8 = vstup instanceof Uint8Array ? vstup : new Uint8Array(vstup);
    const t = najdiTiff(u8);
    if (!t || t.delka < 8) return null;
    const dv = new DataView(u8.buffer, u8.byteOffset + t.start, t.delka);
    const L = dv.getUint16(0) === 0x4949 ? true : dv.getUint16(0) === 0x4D4D ? false : null;
    if (L === null || dv.getUint16(2, L) !== 42) return null;
    const max = t.delka;
    const u16 = o => dv.getUint16(o, L), u32 = o => dv.getUint32(o, L), i32 = o => dv.getInt32(o, L);
    function ctiIFD(off) {
      const tagy = {};
      if (off < 8 || off + 2 > max) return tagy;
      const pocet = u16(off);
      if (pocet > 1000) return tagy;
      for (let k = 0; k < pocet; k++) {
        const e = off + 2 + k * 12;
        if (e + 12 > max) break;
        const tag = u16(e), typ = u16(e + 2), cnt = u32(e + 4);
        const vel = VEL_TYPU[typ];
        if (!vel || cnt > 100000) continue;
        const celk = vel * cnt;
        const pos = celk <= 4 ? e + 8 : u32(e + 8);
        if (pos + celk > max) continue;
        let hod;
        if (typ === 2) {
          let s = '';
          for (let j = 0; j < cnt; j++) { const c = dv.getUint8(pos + j); if (!c) break; s += String.fromCharCode(c); }
          hod = s.trim();
        } else {
          hod = [];
          for (let j = 0; j < cnt; j++) {
            const p = pos + j * vel;
            if (typ === 1 || typ === 7) hod.push(dv.getUint8(p));
            else if (typ === 6) hod.push(dv.getInt8(p));
            else if (typ === 3) hod.push(u16(p));
            else if (typ === 8) hod.push(dv.getInt16(p, L));
            else if (typ === 4) hod.push(u32(p));
            else if (typ === 9) hod.push(i32(p));
            else if (typ === 5) { const d = u32(p + 4); hod.push(d ? u32(p) / d : NaN); }
            else if (typ === 10) { const d = i32(p + 4); hod.push(d ? i32(p) / d : NaN); }
            else if (typ === 11) hod.push(dv.getFloat32(p, L));
            else if (typ === 12) hod.push(dv.getFloat64(p, L));
          }
        }
        tagy[tag] = hod;
      }
      return tagy;
    }
    const ifd0 = ctiIFD(u32(4));
    const exif = ifd0[0x8769] ? ctiIFD(ifd0[0x8769][0]) : {};
    const gpsT = ifd0[0x8825] ? ctiIFD(ifd0[0x8825][0]) : {};
    const v = { datum: null, posun: null, datumUTC: null, gps: null, gpsCasUTC: null, orientace: 1, vyrobce: '', model: '' };
    v.datum = exifDatum(exif[0x9003] || exif[0x9004] || ifd0[0x0132]);
    const pos = exif[0x9011] || exif[0x9010];
    if (typeof pos === 'string' && /^[+-]\d{2}:\d{2}$/.test(pos)) v.posun = pos;
    if (v.datum && v.posun) {
      const t2 = Date.parse(v.datum + v.posun);
      if (Number.isFinite(t2)) v.datumUTC = t2;
    }
    if (ifd0[0x0112] && ifd0[0x0112][0] >= 1 && ifd0[0x0112][0] <= 8) v.orientace = ifd0[0x0112][0];
    if (typeof ifd0[0x010F] === 'string') v.vyrobce = ifd0[0x010F];
    if (typeof ifd0[0x0110] === 'string') v.model = ifd0[0x0110];
    const dms = a => Array.isArray(a) && a.length >= 1 && a.every(Number.isFinite) ? (a[0] || 0) + (a[1] || 0) / 60 + (a[2] || 0) / 3600 : null;
    let lat = dms(gpsT[2]), lon = dms(gpsT[4]);
    if (lat !== null && lon !== null) {
      if (String(gpsT[1] || 'N').toUpperCase().startsWith('S')) lat = -lat;
      if (String(gpsT[3] || 'E').toUpperCase().startsWith('W')) lon = -lon;
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)) {
        let alt = Array.isArray(gpsT[6]) && Number.isFinite(gpsT[6][0]) ? gpsT[6][0] : null;
        if (alt !== null && Array.isArray(gpsT[5]) && gpsT[5][0] === 1) alt = -alt;
        v.gps = { lat, lon, alt };
      }
    }
    if (typeof gpsT[0x1D] === 'string' && Array.isArray(gpsT[7]) && gpsT[7].length === 3) {
      const m = /^(\d{4}):(\d{2}):(\d{2})$/.exec(gpsT[0x1D]);
      if (m) {
        const [h, mi, s] = gpsT[7];
        const t3 = Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0, 0) + Math.round((h * 3600 + mi * 60 + s) * 1000);
        if (Number.isFinite(t3)) v.gpsCasUTC = t3;
      }
    }
    return v;
  }

  /* ======================= ZIP ======================= */
  const CRC_TAB = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();
  /** CRC-32 (IEEE); lze volat postupně: crc32(b, crc32(a)). */
  function crc32(u8, predchozi) {
    let c = predchozi === undefined ? 0xFFFFFFFF : (predchozi ^ 0xFFFFFFFF) >>> 0;
    for (let i = 0; i < u8.length; i++) c = CRC_TAB[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const utf8 = s => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8')));
  function dosDatum(d) {
    d = d || new Date();
    const r = Math.max(1980, d.getFullYear());
    return { cas: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      datum: ((r - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
  }
  const MAX_ZIP = 0xFFFFFFFF;

  /**
   * Zapisovač ZIP „uloženo“ (metoda 0). Data se do něj nepředávají – jen velikost a CRC,
   * takže v prohlížeči lze skládat Blob z hlaviček a původních Blobů bez kopírování do paměti.
   *   const z = new ZipZapisovac(); casti.push(z.pridej('a.txt', delka, crc), data); casti.push(z.konec());
   */
  function ZipZapisovac(datum) {
    this.offset = 0; this.centralni = []; this.pocet = 0; this.dos = dosDatum(datum);
  }
  ZipZapisovac.prototype.pridej = function (jmeno, velikost, crc) {
    const jm = utf8(jmeno);
    if (velikost > MAX_ZIP || this.offset + 30 + jm.length + velikost > MAX_ZIP) throw new Error('Záloha přesahuje 4 GB (ZIP bez rozšíření ZIP64)');
    const lok = new Uint8Array(30 + jm.length), dv = new DataView(lok.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true);
    dv.setUint16(8, 0, true); dv.setUint16(10, this.dos.cas, true); dv.setUint16(12, this.dos.datum, true);
    dv.setUint32(14, crc >>> 0, true); dv.setUint32(18, velikost, true); dv.setUint32(22, velikost, true);
    dv.setUint16(26, jm.length, true); lok.set(jm, 30);
    const cen = new Uint8Array(46 + jm.length), cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true); cv.setUint16(12, this.dos.cas, true); cv.setUint16(14, this.dos.datum, true);
    cv.setUint32(16, crc >>> 0, true); cv.setUint32(20, velikost, true); cv.setUint32(24, velikost, true);
    cv.setUint16(28, jm.length, true); cv.setUint32(42, this.offset, true); cen.set(jm, 46);
    this.centralni.push(cen);
    this.offset += lok.length + velikost;
    this.pocet++;
    if (this.pocet > 0xFFFF) throw new Error('Příliš mnoho souborů v záloze (max. 65 535)');
    return lok;
  };
  ZipZapisovac.prototype.konec = function () {
    const vel = this.centralni.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(vel + 22);
    let o = 0;
    for (const c of this.centralni) { out.set(c, o); o += c.length; }
    const kv = new DataView(out.buffer, vel);
    kv.setUint32(0, 0x06054b50, true); kv.setUint16(8, this.pocet, true); kv.setUint16(10, this.pocet, true);
    kv.setUint32(12, vel, true); kv.setUint32(16, this.offset, true);
    return out;
  };
  /** Celý ZIP v paměti (pro node a malé archivy): polozky [{jmeno, data: Uint8Array|string}]. */
  function zipVPameti(polozky, datum) {
    const z = new ZipZapisovac(datum), casti = [];
    for (const p of polozky) {
      const d = typeof p.data === 'string' ? utf8(p.data) : p.data;
      casti.push(z.pridej(p.jmeno, d.length, crc32(d)), d);
    }
    casti.push(z.konec());
    const cel = casti.reduce((s, c) => s + c.length, 0), out = new Uint8Array(cel);
    let o = 0; for (const c of casti) { out.set(c, o); o += c.length; }
    return out;
  }
  /** Najde záznam konce centrálního adresáře v posledních bajtech souboru. posunKonce = offset `konec` v souboru. */
  function zipKonec(konec, posunKonce) {
    for (let i = konec.length - 22; i >= 0; i--) {
      if (konec[i] === 0x50 && konec[i + 1] === 0x4b && konec[i + 2] === 0x05 && konec[i + 3] === 0x06) {
        const dv = new DataView(konec.buffer, konec.byteOffset + i, 22);
        return { pocet: dv.getUint16(10, true), velikost: dv.getUint32(12, true), offset: dv.getUint32(16, true), poziceEOCD: posunKonce + i };
      }
    }
    throw new Error('Soubor není ZIP (chybí konec centrálního adresáře)');
  }
  /** Přečte položky centrálního adresáře: [{jmeno, metoda, crc, komprimovano, velikost, offsetHlavicky}]. */
  function zipAdresar(cd, pocet) {
    const dv = new DataView(cd.buffer, cd.byteOffset, cd.length);
    const dec = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
    const vys = [];
    let o = 0;
    for (let k = 0; k < pocet; k++) {
      if (o + 46 > cd.length || dv.getUint32(o, true) !== 0x02014b50) throw new Error('Poškozený centrální adresář ZIP');
      const nl = dv.getUint16(o + 28, true), xl = dv.getUint16(o + 30, true), kl = dv.getUint16(o + 32, true);
      const b = cd.subarray(o + 46, o + 46 + nl);
      vys.push({ jmeno: dec ? dec.decode(b) : Buffer.from(b).toString('utf8'), priznaky: dv.getUint16(o + 8, true),
        metoda: dv.getUint16(o + 10, true), crc: dv.getUint32(o + 16, true),
        komprimovano: dv.getUint32(o + 20, true), velikost: dv.getUint32(o + 24, true), offsetHlavicky: dv.getUint32(o + 42, true) });
      o += 46 + nl + xl + kl;
    }
    return vys;
  }
  /** Z prvních 30 bajtů lokální hlavičky spočte začátek dat. */
  function zipZacatekDat(hlav30, polozka) {
    const dv = new DataView(hlav30.buffer, hlav30.byteOffset, 30);
    if (dv.getUint32(0, true) !== 0x04034b50) throw new Error('Poškozená lokální hlavička ZIP: ' + polozka.jmeno);
    return polozka.offsetHlavicky + 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
  }
  /** Synchronní čtení celého ZIPu v paměti (jen metoda 0) – pro node a testy. */
  function zipCtiVPameti(u8) {
    const k = zipKonec(u8.subarray(Math.max(0, u8.length - 65557)), Math.max(0, u8.length - 65557));
    const pol = zipAdresar(u8.subarray(k.offset, k.offset + k.velikost), k.pocet);
    const vys = {};
    for (const p of pol) {
      const z = zipZacatekDat(u8.subarray(p.offsetHlavicky, p.offsetHlavicky + 30), p);
      if (p.metoda !== 0) throw new Error('Nepodporovaná komprese v ZIP: ' + p.jmeno);
      const d = u8.subarray(z, z + p.komprimovano);
      if (crc32(d) !== p.crc) throw new Error('Nesouhlasí CRC: ' + p.jmeno);
      vys[p.jmeno] = d;
    }
    return vys;
  }

  /* ======================= DENÍK ======================= */
  const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  const MESICE_2P = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  const MESICE_ZKR = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
  const DNY = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];
  const DOPRAVA = ['pěšky', 'kolo', 'auto', 'vlak', 'autobus', 'MHD', 'motorka', 'loď', 'letadlo', 'lyže', 'jiné'];

  const pad = x => String(x).padStart(2, '0');
  /** 'YYYY-MM-DD' → počet dní od epochy (UTC) – bez vlivu časových pásem. */
  function denCislo(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(t);
    if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return Math.round(t / 86400000);
  }
  function denText(c) { const d = new Date(c * 86400000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
  function rozsahDni(v) {
    const a = denCislo(v.datumOd);
    if (a === null) return null;
    let b = denCislo(v.datumDo);
    if (b === null || b < a) b = a;
    return [a, b];
  }
  const pocetDni = v => { const r = rozsahDni(v); return r ? r[1] - r[0] + 1 : 0; };

  /** Mřížka měsíce od pondělí: 6 týdnů × 7 dní [{den:'YYYY-MM-DD', cislo, vMesici}]. mesic 0–11. */
  function mesicMrizka(rok, mesic) {
    const prvni = Date.UTC(rok, mesic, 1) / 86400000;
    const dvt = (new Date(prvni * 86400000).getUTCDay() + 6) % 7;   // po = 0
    const start = prvni - dvt;
    const v = [];
    for (let i = 0; i < 42; i++) {
      const c = start + i, d = new Date(c * 86400000);
      v.push({ den: denText(c), cislo: d.getUTCDate(), vMesici: d.getUTCMonth() === mesic, denCislo: c });
    }
    return v;
  }
  /** Výlety zasahující do dne (multi-denní výlet je ve všech svých dnech). */
  function vyletyVeDni(vylety, den) {
    const c = typeof den === 'number' ? den : denCislo(den);
    return vylety.filter(v => { const r = rozsahDni(v); return r && c >= r[0] && c <= r[1]; });
  }

  const normal = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  /** Filtr: {text, rok, oblast, doprava, bbox} – prázdné hodnoty se ignorují. */
  function filtrujVylety(vylety, f) {
    f = f || {};
    const txt = normal(f.text).trim();
    return vylety.filter(v => {
      if (f.rok && String(v.datumOd || '').slice(0, 4) !== String(f.rok)) return false;
      if (f.oblast && (v.oblast || '').trim() !== f.oblast) return false;
      if (f.doprava && !(v.doprava || []).includes(f.doprava)) return false;
      if (f.ucastnik && !(v.ucastnici || []).includes(f.ucastnik)) return false;
      if (f.stitek && !(v.stitky || []).includes(f.stitek)) return false;
      if (f.bbox) {
        const vb = v.bbox || (v.statistika && v.statistika.bbox) || bodyBbox(v.body);
        if (!bboxPrekryv(vb, f.bbox)) return false;
      }
      if (txt) {
        const kde = normal([v.nazev, v.popis, v.poznamky, v.oblast, (v.ucastnici || []).join(' '), (v.stitky || []).join(' '),
          (v.body || []).map(b => b.nazev + ' ' + (b.popis || '')).join(' ')].join(' '));
        if (!txt.split(/\s+/).every(slovo => kde.includes(slovo))) return false;
      }
      return true;
    });
  }
  function bodyBbox(body) {
    let bb = null;
    for (const b of body || []) if (b.lat != null && b.lon != null) bb = bboxSjednot(bb, [b.lat, b.lon, b.lat, b.lon]);
    return bb;
  }
  /** Seřadí výlety od nejnovějšího (datum od, pak název). */
  function seradVylety(vylety, smer) {
    const k = smer === 'vzestupne' ? 1 : -1;
    return vylety.slice().sort((a, b) => (String(a.datumOd || '').localeCompare(String(b.datumOd || '')) || String(a.nazev || '').localeCompare(String(b.nazev || ''), 'cs')) * k);
  }

  /** Součet nákladů po měnách: {CZK: 1200, EUR: 35}. Neplatné částky přeskočí. */
  function soucetNakladu(naklady) {
    const v = {};
    for (const n of naklady || []) {
      const c = typeof n.castka === 'number' ? n.castka : parseCislo(n.castka);
      if (c === null) continue;
      const m = (n.mena || 'CZK').toUpperCase();
      v[m] = Math.round(((v[m] || 0) + c) * 100) / 100;
    }
    return v;
  }
  /** České číslo „1 234,5“ / „1234.5“ → 1234.5; null pro nesmysl. */
  function parseCislo(s) {
    if (typeof s === 'number') return Number.isFinite(s) ? s : null;
    const t = String(s || '').replace(/[\s  ]/g, '').replace(',', '.');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
    return Number(t);
  }

  /** Statistiky po letech: [{rok, vyletu, dni, delka, stoupani, naklady:{}, fotek, oblasti:{}, doprava:{}}] sestupně. */
  function statistikyPodleLet(vylety, pocetFotek) {
    const roky = {};
    for (const v of vylety) {
      const rok = String(v.datumOd || '').slice(0, 4);
      if (!/^\d{4}$/.test(rok)) continue;
      const r = roky[rok] || (roky[rok] = { rok: +rok, vyletu: 0, dni: 0, delka: 0, stoupani: 0, naklady: {}, fotek: 0, oblasti: {}, doprava: {}, nejdelsi: null });
      r.vyletu++;
      r.dni += pocetDni(v);
      const st = v.statistika || {};
      r.delka += st.delka || 0;
      r.stoupani += st.stoupani || 0;
      if (st.delka && (!r.nejdelsi || st.delka > r.nejdelsi.delka)) r.nejdelsi = { id: v.id, nazev: v.nazev, delka: st.delka };
      const n = soucetNakladu(v.naklady);
      for (const m in n) r.naklady[m] = Math.round(((r.naklady[m] || 0) + n[m]) * 100) / 100;
      r.fotek += pocetFotek ? (pocetFotek[v.id] || 0) : 0;
      const ob = (v.oblast || '').trim() || '(bez oblasti)';
      r.oblasti[ob] = (r.oblasti[ob] || 0) + 1;
      for (const d of v.doprava || []) r.doprava[d] = (r.doprava[d] || 0) + 1;
    }
    return Object.values(roky).sort((a, b) => b.rok - a.rok);
  }
  function souhrn(radky) {
    const s = { vyletu: 0, dni: 0, delka: 0, stoupani: 0, naklady: {}, fotek: 0 };
    for (const r of radky) {
      s.vyletu += r.vyletu; s.dni += r.dni; s.delka += r.delka; s.stoupani += r.stoupani; s.fotek += r.fotek;
      for (const m in r.naklady) s.naklady[m] = Math.round(((s.naklady[m] || 0) + r.naklady[m]) * 100) / 100;
    }
    return s;
  }

  /* ---------- formátování (česky, desetinná čárka, nezlomitelná mezera v tisících) ---------- */
  function cislo(x, des) {
    if (x === null || x === undefined || !Number.isFinite(+x)) return '–';
    des = des || 0;
    const s = Math.abs(+x).toFixed(des);
    const [cela, dese] = s.split('.');
    const sk = cela.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const zn = +x < 0 && +s !== 0 ? '−' : '';
    return zn + sk + (dese ? ',' + dese : '');
  }
  const km = m => (m >= 100000 ? cislo(m / 1000, 0) : cislo(m / 1000, 1)) + ' km';
  const metry = m => cislo(m, 0) + ' m';
  function doba(ms) {
    if (!(ms > 0)) return '–';
    const min = Math.round(ms / 60000), h = Math.floor(min / 60), mm = min % 60;
    return h ? `${h} h ${pad(mm)} min` : `${mm} min`;
  }
  function datumCesky(s, sRokem) {
    const c = denCislo(s);
    if (c === null) return '';
    const d = new Date(c * 86400000);
    return `${d.getUTCDate()}. ${MESICE_2P[d.getUTCMonth()]}` + (sRokem === false ? '' : ` ${d.getUTCFullYear()}`);
  }
  function rozsahCesky(v) {
    const r = rozsahDni(v);
    if (!r) return 'bez data';
    if (r[0] === r[1]) return datumCesky(v.datumOd);
    const a = new Date(r[0] * 86400000), b = new Date(r[1] * 86400000);
    if (a.getUTCFullYear() === b.getUTCFullYear()) {
      if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}.–${datumCesky(denText(r[1]))}`;
      return `${datumCesky(denText(r[0]), false)} – ${datumCesky(denText(r[1]))}`;
    }
    return `${datumCesky(denText(r[0]))} – ${datumCesky(denText(r[1]))}`;
  }
  function naklText(obj) {
    const k = Object.keys(obj || {});
    if (!k.length) return '–';
    return k.sort((a, b) => (a === 'CZK' ? -1 : b === 'CZK' ? 1 : a.localeCompare(b)))
      .map(m => cislo(obj[m], Number.isInteger(obj[m]) ? 0 : 2) + ' ' + (m === 'CZK' ? 'Kč' : m)).join(', ');
  }
  function velikostText(b) {
    if (!(b >= 0)) return '–';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return cislo(b / 1024, 0) + ' kB';
    if (b < 1073741824) return cislo(b / 1048576, 1) + ' MB';
    return cislo(b / 1073741824, 2) + ' GB';
  }
  /** Rozměry zmenšeného obrázku (zachová poměr, nikdy nezvětšuje). */
  function zmensiRozmer(w, h, max) {
    if (!(w > 0 && h > 0)) return { w: 0, h: 0 };
    const k = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }

  /* ---------- záloha ---------- */
  const VERZE_ZALOHY = 1;
  /** Ověří a znormalizuje JSON zálohy. Vyhodí Error se srozumitelnou hláškou. */
  function overZalohu(j) {
    if (!j || typeof j !== 'object') throw new Error('Záloha není platný JSON objekt');
    if (j.aplikace !== 'vyletni_denik') throw new Error('Soubor není záloha Výletního deníku');
    if (!(j.verze >= 1)) throw new Error('Neznámá verze zálohy');
    if (j.verze > VERZE_ZALOHY) throw new Error('Záloha pochází z novější verze deníku (' + j.verze + ')');
    const pole = x => (Array.isArray(x) ? x : []);
    const vylety = pole(j.vylety).filter(v => v && typeof v.id === 'string');
    const ids = new Set(vylety.map(v => v.id));
    const trasy = pole(j.trasy).filter(t => t && ids.has(t.vyletId) && Array.isArray(t.trasy));
    const fotky = pole(j.fotky).filter(f => f && typeof f.id === 'string' && ids.has(f.vyletId));
    return { vylety, trasy, fotky, nastaveni: j.nastaveni && typeof j.nastaveni === 'object' ? j.nastaveni : {} };
  }

  function novyId(pref) {
    const r = typeof crypto !== 'undefined' && crypto.getRandomValues ? Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('') : Math.random().toString(16).slice(2, 14);
    return (pref || 'x') + Date.now().toString(36) + r;
  }
  function novyVylet(datum) {
    return { id: novyId('v'), nazev: 'Nový výlet', datumOd: datum || '', datumDo: '', oblast: '', popis: '',
      ucastnici: [], stitky: [], doprava: [], naklady: [], poznamky: '', hodnoceni: 0, body: [], statistika: null, nahled: [],
      vytvoreno: Date.now(), upraveno: Date.now() };
  }


  /* ======================= ROZŠÍŘENÍ: rychlost, mezičasy, počasí, oblast, rekordy ======================= */
  /** Rychlost (m/s) v každém bodě z okna ±okno/2 po délce trasy (aspoň sousední body). */
  function rychlostiVOkne(d, t, okno) {
    const n = d.length, v = new Array(n).fill(null), pul = okno / 2;
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      if (b < i) b = i;
      while (b < n - 1 && d[b + 1] <= d[i] + pul) b++;
      while (a < i && d[a] < d[i] - pul) a++;
      const lo = Math.min(a, Math.max(0, i - 1)), hi = Math.max(b, Math.min(n - 1, i + 1));
      if (t[lo] != null && t[hi] != null && t[hi] > t[lo]) v[i] = (d[hi] - d[lo]) / ((t[hi] - t[lo]) / 1000);
    }
    return v;
  }
  /** Tempo „m:ss /km“ z rychlosti v m/s. */
  function tempo(ms) {
    if (!(ms > 0.05)) return '–';
    const s = Math.round(1000 / ms), m = Math.floor(s / 60);
    return m > 99 ? '–' : `${m}:${pad(s % 60)} /km`;
  }
  /**
   * Mezičasy po krocích (výchozí 1 km). Vyžaduje časy ve všech bodech, jinak [].
   * Řádek: {od, do, delka, cas (ms), rychlost (m/s), stoupani, klesani} – výšky z vyhlazeného profilu.
   */
  function mezicasy(segmenty, krok, volby) {
    krok = krok || 1000;
    const o = Object.assign({}, VYCHOZI_VYSKY, volby || {});
    const body = [];
    let zaklad = 0;
    for (const seg of segmenty || []) {
      let dl = 0;
      for (let i = 0; i < seg.length; i++) {
        if (i > 0) dl += vzdalenost(seg[i - 1].lat, seg[i - 1].lon, seg[i].lat, seg[i].lon);
        body.push({ d: zaklad + dl, t: seg[i].t, e: seg[i].ele, eh: null });
      }
      zaklad += dl;
    }
    if (body.length < 2 || body.some(b => b.t == null || !Number.isFinite(b.t))) return [];
    const sV = body.filter(b => b.e != null && Number.isFinite(b.e));
    const hl = vyhladVysky(sV.map(b => b.d), sV.map(b => b.e), o.okno);
    sV.forEach((b, i) => { b.eh = hl[i]; });
    const radky = [];
    let hranice = krok, zacT = body[0].t, zacD = 0, nah = 0, dol = 0;
    const pridej = (doD, doT) => {
      const delka = doD - zacD, cas = doT - zacT;
      radky.push({ od: zacD, do: doD, delka, cas, rychlost: cas > 0 ? delka / (cas / 1000) : null, stoupani: nah, klesani: dol });
      zacD = doD; zacT = doT; nah = 0; dol = 0;
    };
    // změna výšky úseku a→b se rozdělí poměrem délky mezi kilometry, přes které úsek vede
    let posl = body[0].eh;
    const pricti = r => { if (r > 0) nah += r; else dol -= r; };
    for (let i = 1; i < body.length; i++) {
      const a = body[i - 1], b = body[i];
      const delta = b.eh != null && posl != null ? b.eh - posl : 0;
      let uPred = 0;
      while (b.d >= hranice && b.d > a.d) {
        const u = (hranice - a.d) / (b.d - a.d);
        pricti(delta * (u - uPred)); uPred = u;
        pridej(hranice, a.t + u * (b.t - a.t));
        hranice += krok;
      }
      pricti(delta * (1 - uPred));
      if (b.eh != null) posl = b.eh;
    }
    const z = body[body.length - 1];
    if (z.d - zacD > 1) pridej(z.d, z.t);
    else if (radky.length) { radky[radky.length - 1].stoupani += nah; radky[radky.length - 1].klesani += dol; }
    return radky;
  }

  /* ---------- počasí (Open-Meteo, kódy WMO 4677) ---------- */
  const WMO = { 0: ['jasno', '☀️'], 1: ['skoro jasno', '🌤️'], 2: ['polojasno', '⛅'], 3: ['zataženo', '☁️'], 45: ['mlha', '🌫️'], 48: ['mlha s námrazou', '🌫️'],
    51: ['slabé mrholení', '🌦️'], 53: ['mrholení', '🌦️'], 55: ['silné mrholení', '🌧️'], 56: ['mrznoucí mrholení', '🌧️'], 57: ['silné mrznoucí mrholení', '🌧️'],
    61: ['slabý déšť', '🌦️'], 63: ['déšť', '🌧️'], 65: ['silný déšť', '🌧️'], 66: ['mrznoucí déšť', '🌧️'], 67: ['silný mrznoucí déšť', '🌧️'],
    71: ['slabé sněžení', '🌨️'], 73: ['sněžení', '🌨️'], 75: ['silné sněžení', '❄️'], 77: ['sněhová zrna', '🌨️'],
    80: ['slabé přeháňky', '🌦️'], 81: ['přeháňky', '🌧️'], 82: ['silné přeháňky', '⛈️'], 85: ['sněhové přeháňky', '🌨️'], 86: ['silné sněhové přeháňky', '❄️'],
    95: ['bouřka', '⛈️'], 96: ['bouřka s krupobitím', '⛈️'], 99: ['silná bouřka s krupobitím', '⛈️'] };
  function pocasiKod(k) { const w = WMO[k]; return w ? { text: w[0], ikona: w[1] } : { text: 'neznámé', ikona: '❔' }; }
  const DENNI_POCASI = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max';
  /**
   * URL dotazu na počasí. Archiv (ERA5) má zpoždění ~5 dní, proto se pro posledních 7 dní
   * použije předpovědní API (umí start_date až 92 dní zpět). Budoucí výlet → null.
   */
  function urlPocasi(lat, lon, od, doDen, dnesTxt) {
    const a = denCislo(od), b = denCislo(doDen || od), d = denCislo(dnesTxt);
    if (a === null || b === null || d === null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (b < a || a > d) return null;
    const konec = denText(Math.min(b, d));
    const q = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start_date=${od}&end_date=${konec}&daily=${DENNI_POCASI}&timezone=auto&wind_speed_unit=kmh`;
    if (d - Math.min(b, d) >= 7) return { url: 'https://archive-api.open-meteo.com/v1/archive?' + q, zdroj: 'archiv' };
    if (d - a > 90) return null;
    return { url: 'https://api.open-meteo.com/v1/forecast?' + q, zdroj: 'předpověď' };
  }
  /** Zpracuje odpověď Open-Meteo na [{den, tmax, tmin, srazky, vitr, kod, text, ikona}] (dny bez dat vynechá). */
  function zpracujPocasi(j) {
    const dd = j && j.daily;
    if (!dd || !Array.isArray(dd.time)) return [];
    const kody = dd.weather_code || dd.weathercode || [];
    const v = [];
    dd.time.forEach((den, i) => {
      const r = { den, tmax: num(dd.temperature_2m_max, i), tmin: num(dd.temperature_2m_min, i), srazky: num(dd.precipitation_sum, i),
        vitr: num(dd.wind_speed_10m_max, i), kod: num(kody, i) };
      if (r.tmax === null && r.tmin === null && r.kod === null) return;
      Object.assign(r, pocasiKod(r.kod));
      v.push(r);
    });
    return v;
  }
  function num(pole, i) { const x = pole ? pole[i] : null; return typeof x === 'number' && Number.isFinite(x) ? x : null; }
  function pocasiText(dny) {
    if (!dny || !dny.length) return '';
    return dny.map(p => `${dny.length > 1 ? datumCesky(p.den, false) + ': ' : ''}${p.ikona} ${p.text}, ${cislo(p.tmin, 0)} až ${cislo(p.tmax, 0)} °C` +
      `${p.srazky !== null ? ', srážky ' + cislo(p.srazky, 1) + ' mm' : ''}${p.vitr !== null ? ', vítr až ' + cislo(p.vitr, 0) + ' km/h' : ''}`).join('; ');
  }

  /* ---------- zpětné geokódování (Nominatim) ---------- */
  function urlNominatim(lat, lon) {
    return `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&zoom=10&accept-language=cs`;
  }
  /** Z odpovědi Nominatim sestaví název oblasti: okres / město, u zahraničí i stát. */
  function oblastZNominatim(j) {
    const a = j && j.address;
    if (!a) return '';
    let o = a.county || a.state_district || a.city || a.town || a.municipality || a.village || a.state || '';
    o = String(o).replace(/^okres\s+/i, 'okr. ');
    if (a.country_code && a.country_code !== 'cz' && a.country) o = o ? `${o}, ${a.country}` : a.country;
    return o.trim();
  }

  /* ---------- rekordy, měsíce, časová osa ---------- */
  function rekordy(vylety) {
    const def = [
      ['delka', 'Nejdelší trasa', v => v.statistika && v.statistika.delka, km],
      ['stoupani', 'Největší stoupání', v => v.statistika && v.statistika.maVysky && v.statistika.stoupani, metry],
      ['maxEle', 'Nejvýše položený bod', v => v.statistika && v.statistika.maVysky && v.statistika.maxEle, x => metry(x) + ' n. m.'],
      ['cas', 'Nejdelší čas na trase', v => v.statistika && v.statistika.maCasy && v.statistika.casCelkem, doba],
      ['dni', 'Nejvíc dní', v => pocetDni(v) > 1 && pocetDni(v), x => x + (x < 5 ? ' dny' : ' dní')],
      ['rychlost', 'Nejrychlejší průměr v pohybu', v => { const s = v.statistika; return s && s.casPohyb > 1800000 && s.delka > 3000 && s.delka / (s.casPohyb / 1000); }, x => cislo(x * 3.6, 1) + ' km/h'],
    ];
    const vys = [];
    for (const [klic, nazev, f, fmt] of def) {
      let nej = null, hod = -Infinity;
      for (const v of vylety) { const x = f(v); if (typeof x === 'number' && x > hod) { hod = x; nej = v; } }
      if (nej) vys.push({ klic, nazev, hodnota: hod, text: fmt(hod), vylet: nej });
    }
    return vys;
  }
  /** 12 měsíců {mesic, vyletu, delka, stoupani}; rok = null sčítá všechny roky. */
  function statistikyPoMesicich(vylety, rok) {
    const m = Array.from({ length: 12 }, (_, i) => ({ mesic: i, vyletu: 0, delka: 0, stoupani: 0 }));
    for (const v of vylety) {
      const r = /^(\d{4})-(\d{2})/.exec(v.datumOd || '');
      if (!r || (rok && +r[1] !== +rok)) continue;
      const x = m[+r[2] - 1];
      x.vyletu++; x.delka += (v.statistika && v.statistika.delka) || 0; x.stoupani += (v.statistika && v.statistika.stoupani) || 0;
    }
    return m;
  }
  /** Časová osa: [{rok, mesice: [{mesic, vylety}]}] od nejnovějšího; výlety bez data na konci (rok null). */
  function casovaOsa(vylety) {
    const roky = new Map(), bez = [];
    for (const v of seradVylety(vylety)) {
      const r = /^(\d{4})-(\d{2})/.exec(v.datumOd || '');
      if (!r) { bez.push(v); continue; }
      if (!roky.has(+r[1])) roky.set(+r[1], new Map());
      const mm = roky.get(+r[1]);
      if (!mm.has(+r[2] - 1)) mm.set(+r[2] - 1, []);
      mm.get(+r[2] - 1).push(v);
    }
    const vys = [...roky].map(([rok, mm]) => ({ rok, mesice: [...mm].map(([mesic, vy]) => ({ mesic, vylety: vy })) }));
    if (bez.length) vys.push({ rok: null, mesice: [{ mesic: null, vylety: bez }] });
    return vys;
  }

  /* ---------- automatické založení výletu ---------- */
  const denZCasu = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  /**
   * Návrh údajů nového výletu z importovaných tras ({nazev, trasy, body}) a fotek ({datum, lat, lon}).
   * Vrací {nazev, datumOd, datumDo, stred:[lat,lon]|null}.
   */
  function navrhVyletu(importy, fotky) {
    const dny = [];
    let bb = null, nazev = '';
    for (const r of importy || []) {
      if (!nazev) nazev = r.nazev || (r.trasy[0] && r.trasy[0].nazev) || '';
      for (const t of r.trasy) for (const s of t.segmenty) for (const b of s) {
        if (b.t != null) dny.push(denZCasu(b.t));
        bb = bboxSjednot(bb, [b.lat, b.lon, b.lat, b.lon]);
      }
      for (const b of r.body || []) bb = bboxSjednot(bb, [b.lat, b.lon, b.lat, b.lon]);
    }
    for (const f of fotky || []) {
      if (f.datum && /^\d{4}-\d{2}-\d{2}/.test(f.datum)) dny.push(f.datum.slice(0, 10));
      if (f.lat != null && f.lon != null) bb = bboxSjednot(bb, [f.lat, f.lon, f.lat, f.lon]);
    }
    dny.sort();
    const datumOd = dny[0] || '', posl = dny[dny.length - 1] || '';
    return { nazev: nazev || (datumOd ? 'Výlet ' + datumCesky(datumOd) : 'Nový výlet'), datumOd, datumDo: posl && posl !== datumOd ? posl : '',
      stred: bb ? [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2] : null };
  }

  const API = {
    parsujXML, parsujGPX, parsujKML, nactiTrasu, exportGPX,
    vzdalenost, vyhladVysky, stoupaniSPrahem, statistikaTrasy, vyskovyProfil, zjednodus, nahledTrasy,
    polohaPodleCasu, nejblizsiBod, bboxSjednot, bboxPrekryv, bodyBbox, VYCHOZI_VYSKY, R_ZEME,
    najdiTiff, ctiExif, exifDatum,
    crc32, ZipZapisovac, zipVPameti, zipKonec, zipAdresar, zipZacatekDat, zipCtiVPameti,
    MESICE, MESICE_2P, MESICE_ZKR, DNY, DOPRAVA, denCislo, denText, rozsahDni, pocetDni, mesicMrizka, vyletyVeDni,
    filtrujVylety, seradVylety, soucetNakladu, parseCislo, statistikyPodleLet, souhrn,
    cislo, km, metry, doba, datumCesky, rozsahCesky, naklText, velikostText, zmensiRozmer,
    VERZE_ZALOHY, overZalohu, novyId, novyVylet, normal,
    rychlostiVOkne, tempo, mezicasy, pocasiKod, urlPocasi, zpracujPocasi, pocasiText, urlNominatim, oblastZNominatim,
    rekordy, statistikyPoMesicich, casovaOsa, navrhVyletu, denZCasu,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.DENIK = API;
})();
