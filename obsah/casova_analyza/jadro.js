/* Časová analýza záznamů GPS a telefonu – jádro bez DOM (test: _test/casova_analyza_test.js).
   Import (GPX, KML, GeoJSON, Google Takeout Records.json / Semantic Location History / Timeline
   semanticSegments, CSV výpisů hovorů a SMS, EXIF fotek), sjednocení časových pásem a posunů hodin,
   detekce pobytů a přesunů, nemožné rychlosti, mezery, souběh dvou osob, ověření alibi, exporty. */
(function () {
  'use strict';

  const VERZE = 1;
  const TZ_VYCHOZI = 'Europe/Prague';
  const TYPY = {
    poloha: { nazev: 'poloha', ikona: '📍' },
    navsteva: { nazev: 'návštěva místa', ikona: '🏠' },
    presun: { nazev: 'přesun (Takeout)', ikona: '🚶' },
    hovor: { nazev: 'hovor', ikona: '📞' },
    sms: { nazev: 'SMS', ikona: '✉️' },
    data: { nazev: 'data', ikona: '🌐' },
    foto: { nazev: 'fotografie', ikona: '📷' },
    udalost: { nazev: 'událost', ikona: '📌' }
  };
  const BARVY = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324', '#808000', '#000075'];

  let citac = 0;
  const novyId = p => (p || 'z') + Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6);
  const dvoj = n => String(n).padStart(2, '0');
  const cislo = v => { if (v == null || v === '') return NaN; return typeof v === 'number' ? v : parseFloat(String(v).trim().replace(/\s/g, '').replace(',', '.')); };

  /* ---------- časová pásma ---------- */
  const fmtCache = {}, offCache = {};
  // posun pásma (min) v daném okamžiku UTC; tz = IANA, 'UTC' nebo pevný '+02:00'
  function posunPasma(tz, utcMs) {
    if (!tz || tz === 'UTC' || tz === 'Z') return 0;
    const m = /^([+-])(\d{1,2}):?(\d{2})?$/.exec(tz);
    if (m) return (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0));
    const klic = tz + '|' + Math.floor(utcMs / 900000);
    if (klic in offCache) return offCache[klic];
    let f = fmtCache[tz];
    if (!f) f = fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const c = {};
    for (const p of f.formatToParts(new Date(utcMs))) c[p.type] = p.value;
    const wall = Date.UTC(+c.year, +c.month - 1, +c.day, +c.hour % 24, +c.minute, +c.second);
    const r = Math.round((wall - Math.floor(utcMs / 1000) * 1000) / 60000);
    return (offCache[klic] = r);
  }
  function platnePasmo(tz) {
    if (!tz || typeof tz !== 'string') return false;
    if (/^(UTC|Z|[+-]\d{1,2}(:?\d{2})?)$/.test(tz || '')) return true;
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
  }
  // místní „nástěnný“ čas (ms jako by byl UTC) v pásmu tz → skutečný UTC
  function naUtc(wallMs, tz) {
    let t = wallMs - posunPasma(tz, wallMs) * 60000;
    t = wallMs - posunPasma(tz, t) * 60000;
    return t;
  }
  // nejednoznačný / neexistující místní čas při změně letního času
  function prechodCasu(wallMs, tz) {
    const t = naUtc(wallMs, tz);
    const zpet = t + posunPasma(tz, t) * 60000;
    if (zpet !== wallMs) return 'neexistuje';
    const k = [wall => wall - posunPasma(tz, t - 7200000) * 60000, wall => wall - posunPasma(tz, t + 7200000) * 60000].map(f => f(wallMs));
    if (k[0] !== k[1] && k.every(x => x + posunPasma(tz, x) * 60000 === wallMs)) return 'dvojznačný';
    return '';
  }
  function rozlozCas(t, tz) {
    const d = new Date(t + posunPasma(tz, t) * 60000);
    return { r: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
  }
  function formatCas(t, tz, co) {
    if (t == null || !isFinite(t)) return '–';
    const c = rozlozCas(t, tz || TZ_VYCHOZI);
    const cas = dvoj(c.h) + ':' + dvoj(c.mi) + ':' + dvoj(c.s);
    if (co === 'cas') return cas;
    const dat = c.d + '. ' + c.m + '. ' + c.r;
    if (co === 'datum') return dat;
    return dat + ' ' + cas;
  }
  function isoCas(t, tz) {
    const o = posunPasma(tz || 'UTC', t), c = rozlozCas(t, tz || 'UTC');
    const zn = o === 0 ? 'Z' : (o < 0 ? '-' : '+') + dvoj(Math.floor(Math.abs(o) / 60)) + ':' + dvoj(Math.abs(o) % 60);
    return c.r + '-' + dvoj(c.m) + '-' + dvoj(c.d) + 'T' + dvoj(c.h) + ':' + dvoj(c.mi) + ':' + dvoj(c.s) + zn;
  }
  function formatTrvani(s) {
    s = Math.round(Math.abs(s));
    if (s < 60) return s + ' s';
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
    if (h >= 48) return Math.floor(h / 24) + ' d ' + (h % 24) + ' h';
    return h ? h + ' h ' + dvoj(m) + ' min' : m + ' min ' + dvoj(s % 60) + ' s';
  }

  /* Čas z textu → { t0, naiv }. naiv = bez údaje o pásmu (t0 = nástěnný čas jako by byl UTC). */
  function parsujCas(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' || /^\d{9,14}(\.\d+)?$/.test(String(v).trim())) {
      const n = +v; if (!isFinite(n)) return null;
      return { t0: Math.round(n > 1e11 ? n : n * 1000), naiv: false };
    }
    const s = String(v).trim().replace(/\u00a0/g, ' ');
    let m, r, mo, d, h = 0, mi = 0, se = 0, ms = 0, zona = null;
    if ((m = /^(\d{4})[-/:](\d{1,2})[-/:](\d{1,2})(?:[T ]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?\s*(Z|UTC|GMT|[+-]\d{2}:?\d{2})?$/i.exec(s))) {
      [r, mo, d, h, mi, se] = [m[1], m[2], m[3], m[4] || 0, m[5] || 0, m[6] || 0].map(Number);
      ms = m[7] ? Math.round(+('0.' + m[7]) * 1000) : 0; zona = m[8] || null;
    } else if ((m = /^(\d{1,2})[./](\d{1,2})[./]\s*(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(Z|UTC|[+-]\d{2}:?\d{2})?$/i.exec(s.replace(/\.\s+/g, '.')))) {
      [d, mo, r, h, mi, se] = [m[1], m[2], m[3], m[4] || 0, m[5] || 0, m[6] || 0].map(Number); zona = m[7] || null;
    } else return null;
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 24 || mi > 59 || se > 60) return null;
    const wall = Date.UTC(r, mo - 1, d, h, mi, se, ms);
    if (new Date(wall - ms).getUTCDate() !== d && h < 24) return null;
    if (!zona) return { t0: wall, naiv: true };
    return { t0: wall - posunPasma(/^(UTC|GMT|Z)$/i.test(zona) ? 'UTC' : zona, wall) * 60000, naiv: false };
  }
  // trvání: „125“, „2:05“, „1:02:05“, „2 min 5 s“
  function parsujTrvani(v) {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    if (/^\d+([.,]\d+)?$/.test(s)) return cislo(s);
    const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(s);
    if (m) return (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3];
    let sum = 0, nasel = false;
    s.replace(/(\d+)\s*(h|hod|min|m|s|sek)/gi, (_, n, j) => { nasel = true; j = j.toLowerCase(); sum += +n * (j[0] === 'h' ? 3600 : j === 's' || j === 'sek' ? 1 : 60); });
    return nasel ? sum : null;
  }
  // „50.0870°, 14.4207°“, „geo:50.087,14.42“, „50.087 14.42“
  function parsujLatLng(s) {
    if (!s) return null;
    if (typeof s === 'object') {
      const la = cislo(s.latitude != null ? s.latitude : s.lat), lo = cislo(s.longitude != null ? s.longitude : (s.lng != null ? s.lng : s.lon));
      if (isFinite(la) && isFinite(lo)) return { lat: la, lon: lo };
      if (s.latitudeE7 != null) return { lat: s.latitudeE7 / 1e7, lon: s.longitudeE7 / 1e7 };
      if (s.latE7 != null) return { lat: s.latE7 / 1e7, lon: s.lngE7 / 1e7 };
      return null;
    }
    const m = /(-?\d+(?:\.\d+)?)\s*°?\s*[,; ]\s*(-?\d+(?:\.\d+)?)/.exec(String(s).replace(/^geo:/, ''));
    if (!m) return null;
    const lat = +m[1], lon = +m[2];
    return platnaPoloha(lat, lon) ? { lat, lon } : null;
  }
  const platnaPoloha = (lat, lon) => isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);

  /* ---------- geometrie ---------- */
  function vzdalenost(a, b) {
    const R = 6371008.8, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  const formatVzd = m => m == null || !isFinite(m) ? '–' : m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 2 : 1).replace('.', ',') + ' km';

  /* ---------- záznamy ---------- */
  // surový záznam z parseru → normalizovaný
  function zaznam(o) {
    const z = {
      id: o.id || novyId('r'), zdroj: o.zdroj || '', typ: TYPY[o.typ] ? o.typ : 'udalost',
      t0: o.t0, naiv: !!o.naiv, k0: o.k0 == null ? null : o.k0,
      lat: null, lon: null, acc: null,
      smer: o.smer === 'in' || o.smer === 'out' ? o.smer : '', protistrana: String(o.protistrana || '').slice(0, 80),
      trvani: isFinite(+o.trvani) && o.trvani !== null && o.trvani !== '' ? +o.trvani : null,
      popis: String(o.popis || '').slice(0, 300), azimut: null, svazek: null, dulezite: !!o.dulezite
    };
    if (platnaPoloha(+o.lat, +o.lon)) { z.lat = +o.lat; z.lon = +o.lon; }
    if (o.azimut != null && o.azimut !== '' && isFinite(+o.azimut)) z.azimut = ((+o.azimut % 360) + 360) % 360;
    if (o.svazek != null && o.svazek !== '' && isFinite(+o.svazek) && +o.svazek > 0 && +o.svazek <= 360) z.svazek = +o.svazek;
    if (isFinite(+o.acc) && o.acc !== null && o.acc !== '' && +o.acc >= 0) z.acc = +o.acc;
    if (z.k0 == null && z.trvani != null && (z.typ === 'hovor' || z.typ === 'data')) z.k0 = z.t0 + z.trvani * 1000;
    return z;
  }
  // z časového údaje parseru (objekt z parsujCas) + zbytek
  function zZaznamu(cas, zbytek, konec) {
    if (!cas) return null;
    const o = Object.assign({}, zbytek, { t0: cas.t0, naiv: cas.naiv });
    if (konec) o.k0 = konec.naiv === cas.naiv ? konec.t0 : null;
    return o;
  }

  /* ---------- parsery ---------- */
  const xmlText = s => s == null ? '' : s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
  const tag = (blok, jmeno) => { const m = new RegExp('<(?:\\w+:)?' + jmeno + '\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?' + jmeno + '>', 'i').exec(blok); return m ? xmlText(m[1]) : null; };
  const atr = (hlava, jmeno) => { const m = new RegExp('\\b' + jmeno + '\\s*=\\s*["\']([^"\']*)["\']', 'i').exec(hlava); return m ? m[1] : null; };

  function parsujGpx(text) {
    const zaz = [], varovani = [];
    let bezCasu = 0;
    const re = /<(trkpt|wpt|rtept)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/gi;
    let m;
    while ((m = re.exec(text))) {
      const telo = m[4] || '';
      const cas = parsujCas(tag(telo, 'time'));
      if (!cas) { bezCasu++; continue; }
      const hdop = cislo(tag(telo, 'hdop'));
      const jm = tag(telo, 'name'), ds = tag(telo, 'desc') || tag(telo, 'cmt');
      zaz.push(zZaznamu(cas, { typ: m[1] === 'wpt' && (jm || ds) ? 'udalost' : 'poloha', lat: cislo(atr(m[2], 'lat')), lon: cislo(atr(m[2], 'lon')),
        acc: isFinite(hdop) ? Math.round(hdop * 5) : null, popis: [jm, ds].filter(Boolean).join(' – ') }));
    }
    if (bezCasu) varovani.push(bezCasu + ' bodů bez času vynecháno');
    return { zaznamy: zaz, varovani };
  }

  function parsujKml(text) {
    const zaz = [], varovani = [];
    // gx:Track – seznam <when> a <gx:coord>
    const reTrack = /<gx:Track\b[^>]*>([\s\S]*?)<\/gx:Track>/gi;
    let m;
    while ((m = reTrack.exec(text))) {
      const kdy = [...m[1].matchAll(/<when>([^<]*)<\/when>/gi)].map(x => x[1]);
      const kde = [...m[1].matchAll(/<gx:coord>([^<]*)<\/gx:coord>/gi)].map(x => x[1].trim().split(/\s+/).map(Number));
      if (kdy.length !== kde.length) varovani.push('gx:Track: počet časů a souřadnic nesouhlasí');
      for (let i = 0; i < Math.min(kdy.length, kde.length); i++) {
        const cas = parsujCas(kdy[i]);
        if (cas) zaz.push(zZaznamu(cas, { typ: 'poloha', lat: kde[i][1], lon: kde[i][0] }));
      }
    }
    // Placemark s TimeStamp / TimeSpan a Point
    const rePm = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi;
    let bezCasu = 0;
    while ((m = rePm.exec(text))) {
      const b = m[1];
      if (/<gx:Track/i.test(b)) continue;
      const bod = /<Point\b[^>]*>[\s\S]*?<coordinates>([^<]*)<\/coordinates>/i.exec(b);
      const ts = tag(b, 'TimeStamp'), span = tag(b, 'TimeSpan');
      const cas = parsujCas(ts ? tag(ts, 'when') : span ? tag(span, 'begin') : null);
      if (!cas) { bezCasu++; continue; }
      const konec = span ? parsujCas(tag(span, 'end')) : null;
      const c = bod ? bod[1].trim().split(',').map(Number) : [NaN, NaN];
      const popis = [tag(b, 'name'), tag(b, 'description')].filter(Boolean).join(' – ').replace(/<[^>]+>/g, ' ').slice(0, 300);
      zaz.push(zZaznamu(cas, { typ: konec ? 'navsteva' : bod ? 'poloha' : 'udalost', lat: c[1], lon: c[0], popis }, konec));
    }
    if (bezCasu) varovani.push(bezCasu + ' značek bez času vynecháno');
    return { zaznamy: zaz, varovani };
  }

  function parsujGeoJson(j) {
    const zaz = [], varovani = [];
    const prvky = j.type === 'FeatureCollection' ? j.features || [] : j.type === 'Feature' ? [j] : [];
    let bezCasu = 0;
    const casZ = p => p && (p.time || p.timestamp || p.datetime || p.date || p.cas || p.when || p.t);
    for (const f of prvky) {
      const g = f.geometry || {}, p = f.properties || {};
      const popis = String(p.name || p.popis || p.description || '').slice(0, 300);
      if (g.type === 'Point') {
        const cas = parsujCas(casZ(p));
        if (!cas) { bezCasu++; continue; }
        const konec = parsujCas(p.end || p.konec || p.endTime);
        zaz.push(zZaznamu(cas, { typ: TYPY[p.typ] ? p.typ : konec ? 'navsteva' : 'poloha', lat: g.coordinates[1], lon: g.coordinates[0], acc: p.accuracy || p.acc, popis,
          smer: p.smer, protistrana: p.protistrana, trvani: p.trvani }, konec));
      } else if (g.type === 'LineString' || g.type === 'MultiLineString') {
        const cary = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
        let casy = p.coordTimes || p.times || (p.coordinateProperties && p.coordinateProperties.times);
        if (casy && g.type === 'LineString' && Array.isArray(casy[0])) casy = casy[0];
        cary.forEach((cara, ci) => {
          const ct = casy ? (g.type === 'MultiLineString' && Array.isArray(casy[ci]) ? casy[ci] : casy) : null;
          cara.forEach((c, i) => {
            const cas = parsujCas(ct ? ct[i] : c[3]);
            if (cas) zaz.push(zZaznamu(cas, { typ: 'poloha', lat: c[1], lon: c[0] })); else bezCasu++;
          });
        });
      }
    }
    if (bezCasu) varovani.push(bezCasu + ' bodů bez času vynecháno');
    return { zaznamy: zaz, varovani };
  }

  // Google Takeout: Records.json (locations), Semantic Location History (timelineObjects),
  // nový export Časové osy z telefonu (semanticSegments / rawSignals) i iOS pole segmentů
  function parsujTakeout(j) {
    const zaz = [], varovani = [];
    const ll = x => parsujLatLng(x) || {};
    if (Array.isArray(j.locations)) {
      for (const l of j.locations) {
        const cas = parsujCas(l.timestamp || l.timestampMs);
        if (!cas || l.latitudeE7 == null) continue;
        zaz.push(zZaznamu(cas, { typ: 'poloha', lat: l.latitudeE7 / 1e7, lon: l.longitudeE7 / 1e7, acc: l.accuracy, popis: l.source ? 'zdroj: ' + l.source : '' }));
      }
    }
    if (Array.isArray(j.timelineObjects)) {
      for (const o of j.timelineObjects) {
        if (o.placeVisit) {
          const v = o.placeVisit, d = v.duration || {}, l = v.location || {};
          const cas = parsujCas(d.startTimestamp || d.startTimestampMs), kon = parsujCas(d.endTimestamp || d.endTimestampMs);
          const p = ll(l);
          zaz.push(zZaznamu(cas, { typ: 'navsteva', lat: p.lat, lon: p.lon, acc: l.accuracyMetres, popis: [l.name, l.address].filter(Boolean).join(', ') }, kon));
        } else if (o.activitySegment) {
          const a = o.activitySegment, d = a.duration || {};
          const cas = parsujCas(d.startTimestamp || d.startTimestampMs), kon = parsujCas(d.endTimestamp || d.endTimestampMs);
          const s = ll(a.startLocation), e = ll(a.endLocation);
          const druh = String(a.activityType || '').toLowerCase().replace(/_/g, ' ');
          zaz.push(zZaznamu(cas, { typ: 'presun', lat: s.lat, lon: s.lon, popis: 'přesun' + (druh ? ' (' + druh + ')' : '') + (a.distance ? ', ' + formatVzd(a.distance) : '') }, kon));
          if (kon && e.lat != null) zaz.push(zZaznamu(kon, { typ: 'poloha', lat: e.lat, lon: e.lon, popis: 'konec přesunu' }));
          const body = (a.simplifiedRawPath && a.simplifiedRawPath.points) || (a.waypointPath && []) || [];
          for (const b of body) { const c = parsujCas(b.timestamp || b.timestampMs); const q = ll(b); if (c && q.lat != null) zaz.push(zZaznamu(c, { typ: 'poloha', lat: q.lat, lon: q.lon, acc: b.accuracyMeters })); }
        }
      }
    }
    const segmenty = Array.isArray(j.semanticSegments) ? j.semanticSegments : Array.isArray(j) && j.length && (j[0].startTime || j[0].visit || j[0].activity) ? j : null;
    if (segmenty) {
      for (const s of segmenty) {
        const cas = parsujCas(s.startTime), kon = parsujCas(s.endTime);
        if (s.visit) {
          const tc = s.visit.topCandidate || {};
          const p = ll(tc.placeLocation && (tc.placeLocation.latLng || tc.placeLocation));
          zaz.push(zZaznamu(cas, { typ: 'navsteva', lat: p.lat, lon: p.lon, popis: [tc.semanticType, tc.placeID || tc.placeId].filter(x => x && x !== 'UNKNOWN').join(' · ').toLowerCase() }, kon));
        }
        if (s.activity) {
          const a = s.activity, tc = a.topCandidate || {};
          const st = ll(a.start && (a.start.latLng || a.start)), en = ll(a.end && (a.end.latLng || a.end));
          const druh = String(tc.type || '').toLowerCase().replace(/_/g, ' ');
          const vzd = cislo(a.distanceMeters);
          zaz.push(zZaznamu(cas, { typ: 'presun', lat: st.lat, lon: st.lon, popis: 'přesun' + (druh && druh !== 'unknown' ? ' (' + druh + ')' : '') + (isFinite(vzd) ? ', ' + formatVzd(vzd) : '') }, kon));
          if (kon && en.lat != null) zaz.push(zZaznamu(kon, { typ: 'poloha', lat: en.lat, lon: en.lon, popis: 'konec přesunu' }));
        }
        if (Array.isArray(s.timelinePath)) {
          for (const b of s.timelinePath) {
            let c = parsujCas(b.time);
            if (!c && cas && b.durationMinutesOffsetFromStartTime != null) c = { t0: cas.t0 + +b.durationMinutesOffsetFromStartTime * 60000, naiv: cas.naiv };
            const q = ll(b.point);
            if (c && q.lat != null) zaz.push(zZaznamu(c, { typ: 'poloha', lat: q.lat, lon: q.lon }));
          }
        }
      }
    }
    if (Array.isArray(j.rawSignals)) {
      for (const r of j.rawSignals) {
        const p = r.position; if (!p) continue;
        const c = parsujCas(p.timestamp), q = ll(p.LatLng || p.latLng);
        if (c && q.lat != null) zaz.push(zZaznamu(c, { typ: 'poloha', lat: q.lat, lon: q.lon, acc: p.accuracyMeters, popis: p.source ? 'zdroj: ' + String(p.source).toLowerCase() : '' }));
      }
    }
    const ok = zaz.filter(Boolean);
    if (ok.length < zaz.length) varovani.push((zaz.length - ok.length) + ' položek bez platného času vynecháno');
    return { zaznamy: ok, varovani };
  }

  /* ---------- CSV ---------- */
  function parsujCsvText(text) {
    text = String(text || '').replace(/^\ufeff/, '');
    const prvni = text.split(/\r?\n/, 1)[0];
    const odd = [';', '\t', ',', '|'].map(o => [o, prvni.split(o).length]).sort((a, b) => b[1] - a[1])[0][0];
    const radky = [];
    let radek = [], pole = '', uvoz = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (uvoz) {
        if (c === '"') { if (text[i + 1] === '"') { pole += '"'; i++; } else uvoz = false; }
        else pole += c;
      } else if (c === '"' && pole === '') uvoz = true;
      else if (c === odd) { radek.push(pole); pole = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        radek.push(pole); pole = '';
        if (radek.some(x => x.trim() !== '')) radky.push(radek);
        radek = [];
      } else pole += c;
    }
    radek.push(pole);
    if (radek.some(x => x.trim() !== '')) radky.push(radek);
    const hlavicka = (radky.shift() || []).map(s => s.trim());
    return { oddelovac: odd, hlavicka, radky };
  }
  const bezDia = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const POLE_CSV = {
    cas: ['datum a cas', 'datum cas', 'datetime', 'date time', 'timestamp', 'zahajeni', 'zacatek', 'start', 'cas zahajeni', 'time stamp'],
    datum: ['datum', 'date', 'den'],
    hodina: ['cas', 'time', 'hodina'],
    typ: ['typ', 'type', 'druh', 'sluzba', 'service', 'event'],
    smer: ['smer', 'direction', 'in/out', 'prichozi/odchozi'],
    protistrana: ['protistrana', 'cislo', 'number', 'volane', 'volajici', 'b cislo', 'msisdn', 'kontakt', 'contact', 'to', 'from', 'telefon'],
    trvani: ['trvani', 'duration', 'delka', 'sekundy', 'seconds'],
    lat: ['lat', 'latitude', 'sirka', 'zem. sirka'],
    lon: ['lon', 'lng', 'long', 'longitude', 'delka geo', 'zem. delka'],
    acc: ['presnost', 'accuracy', 'polomer', 'radius'],
    azimut: ['azimut', 'azimuth', 'bearing', 'smer anteny', 'sektor azimut'],
    svazek: ['svazek', 'sirka svazku', 'beamwidth', 'beam', 'uhel svazku'],
    popis: ['popis', 'poznamka', 'bts', 'adresa', 'bunka', 'cell', 'note', 'description', 'misto', 'location']
  };
  function odhadniMapovani(hlavicka) {
    const h = hlavicka.map(bezDia), map = {}, pouzite = new Set();
    for (const [pole, vzory] of Object.entries(POLE_CSV)) {
      let nej = -1, skore = 0;
      h.forEach((x, i) => {
        if (pouzite.has(i)) return;
        for (const v of vzory) {
          const s = x === v ? 3 : x.startsWith(v) ? 2 : x.includes(v) && v.length > 2 ? 1 : 0;
          if (s > skore) { skore = s; nej = i; }
        }
      });
      if (nej >= 0) { map[pole] = nej; pouzite.add(nej); }
    }
    // jediný sloupec „datum“ s časem uvnitř → je to cas
    if (map.datum != null && map.cas == null && map.hodina == null) { map.cas = map.datum; delete map.datum; }
    return map;
  }
  function typZTextu(s, vychozi) {
    const t = bezDia(s);
    if (!t) return vychozi;
    if (/sms|mms|zprav|text/.test(t)) return 'sms';
    if (/data|gprs|internet|lte|umts|paket/.test(t)) return 'data';
    if (/hov|call|voice|volan|tel/.test(t)) return 'hovor';
    if (/foto|photo/.test(t)) return 'foto';
    if (/polo|gps|loc/.test(t)) return 'poloha';
    return vychozi;
  }
  function smerZTextu(s) {
    const t = bezDia(s);
    if (/^(in|mt|p|prich|incoming|prijat|prijem)/.test(t) || /prichozi|incoming|received|prijata/.test(t)) return 'in';
    if (/^(out|mo|o|odch|outgoing|odesl)/.test(t) || /odchozi|outgoing|sent|odeslan/.test(t)) return 'out';
    return '';
  }
  function zCsv(csv, map, vychoziTyp) {
    const zaz = [], varovani = [];
    let chyb = 0;
    const val = (r, k) => map[k] != null && map[k] !== '' && map[k] >= 0 ? (r[map[k]] || '').trim() : '';
    for (const r of csv.radky) {
      let casText = val(r, 'cas');
      if (!casText && val(r, 'datum')) casText = val(r, 'datum') + ' ' + val(r, 'hodina');
      else if (casText && val(r, 'hodina') && !/\d:\d/.test(casText)) casText += ' ' + val(r, 'hodina');
      const cas = parsujCas(casText);
      if (!cas) { chyb++; continue; }
      const typText = val(r, 'typ');
      zaz.push(zZaznamu(cas, {
        typ: typZTextu(typText, vychoziTyp || 'hovor'), smer: smerZTextu(val(r, 'smer') || typText),
        protistrana: val(r, 'protistrana'), trvani: parsujTrvani(val(r, 'trvani')),
        lat: cislo(val(r, 'lat')), lon: cislo(val(r, 'lon')), acc: cislo(val(r, 'acc')),
        azimut: cislo(val(r, 'azimut')), svazek: cislo(val(r, 'svazek')),
        popis: [typText && !TYPY[typText] ? typText : '', val(r, 'popis')].filter(Boolean).join(' · ')
      }));
    }
    if (chyb) varovani.push(chyb + ' řádků bez rozpoznatelného času vynecháno');
    return { zaznamy: zaz, varovani };
  }

  /* ---------- EXIF (JPEG) ---------- */
  function ctiExif(buf) {
    const v = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
    let p = 2;
    while (p + 4 < v.byteLength) {
      if (v.getUint8(p) !== 0xFF) return null;
      const znak = v.getUint8(p + 1), del = v.getUint16(p + 2);
      if (znak === 0xE1 && v.getUint32(p + 4) === 0x45786966) return ctiTiff(v, p + 10);
      if (znak === 0xDA) return null;
      p += 2 + del;
    }
    return null;
  }
  function ctiTiff(v, z) {
    const le = v.getUint16(z) === 0x4949;
    const u16 = o => v.getUint16(z + o, le), u32 = o => v.getUint32(z + o, le);
    const ascii = (o, n) => { let s = ''; for (let i = 0; i < n; i++) { const c = v.getUint8(z + o + i); if (!c) break; s += String.fromCharCode(c); } return s; };
    const ifd = o => {
      const r = {}, n = u16(o);
      for (let i = 0; i < n; i++) {
        const e = o + 2 + i * 12, t = u16(e), typ = u16(e + 2), poc = u32(e + 4);
        const vel = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 })[typ] || 1;
        const d = vel * poc <= 4 ? e + 8 : u32(e + 8);
        if (typ === 2) r[t] = ascii(d, poc);
        else if (typ === 3) r[t] = u16(d);
        else if (typ === 4) r[t] = u32(d);
        else if (typ === 5 || typ === 10) { const a = []; for (let k = 0; k < poc; k++) a.push(u32(d + k * 8) / (u32(d + k * 8 + 4) || 1)); r[t] = a; }
        else if (typ === 1 || typ === 7) { const a = []; for (let k = 0; k < Math.min(poc, 8); k++) a.push(v.getUint8(z + d + k)); r[t] = a; }
      }
      return r;
    };
    try {
      const i0 = ifd(u32(4));
      const ex = i0[0x8769] ? ifd(i0[0x8769]) : {};
      const gps = i0[0x8825] ? ifd(i0[0x8825]) : {};
      const r = { datum: ex[0x9003] || ex[0x9004] || i0[0x0132] || null, offset: ex[0x9011] || ex[0x9010] || null, model: [i0[0x010F], i0[0x0110]].filter(Boolean).join(' ').trim(), lat: null, lon: null, gpsUtc: null };
      const dms = a => Array.isArray(a) ? a[0] + (a[1] || 0) / 60 + (a[2] || 0) / 3600 : NaN;
      if (gps[2] && gps[4]) {
        const lat = dms(gps[2]) * (gps[1] === 'S' ? -1 : 1), lon = dms(gps[4]) * (gps[3] === 'W' ? -1 : 1);
        if (platnaPoloha(lat, lon)) { r.lat = lat; r.lon = lon; }
      }
      if (gps[29] && gps[7]) {
        const c = parsujCas(gps[29] + ' ' + gps[7].map(x => dvoj(Math.floor(x))).join(':'));
        if (c) r.gpsUtc = c.t0;
      }
      return r;
    } catch (e) { return null; }
  }
  // EXIF → záznam; gpsUtc (satelitní čas) slouží i k odhadu posunu hodin fotoaparátu
  function zExif(ex, nazev) {
    if (!ex) return { zaznamy: [], varovani: ['soubor nemá EXIF'] };
    let cas = ex.datum ? parsujCas(ex.datum + (ex.offset ? ex.offset : '')) : null;
    const varovani = [];
    if (!cas && ex.gpsUtc) { cas = { t0: ex.gpsUtc, naiv: false }; varovani.push('čas jen z GPS'); }
    if (!cas) return { zaznamy: [], varovani: ['fotografie bez času pořízení'] };
    if (ex.lat == null) varovani.push('fotografie bez GPS');
    return { zaznamy: [zZaznamu(cas, { typ: 'foto', lat: ex.lat, lon: ex.lon, popis: [nazev, ex.model].filter(Boolean).join(' · ') })], varovani, gpsUtc: ex.gpsUtc, naivniCas: cas.naiv ? cas.t0 : null };
  }
  // posun hodin (s) = GPS UTC − čas fotoaparátu převedený z pásma tz
  function posunZGps(naivniT0, gpsUtc, tz) {
    if (naivniT0 == null || gpsUtc == null) return null;
    return Math.round((gpsUtc - naUtc(naivniT0, tz)) / 1000);
  }

  function detekuj(nazev, text) {
    const n = String(nazev || '').toLowerCase(), s = String(text || '').slice(0, 4000).trimStart();
    if (/\.gpx$/.test(n) || /<gpx\b/i.test(s)) return 'gpx';
    if (/\.kml$/.test(n) || /<kml\b/i.test(s)) return 'kml';
    if (/^[[{]/.test(s)) {
      if (/"type"\s*:\s*"(FeatureCollection|Feature)"/.test(s)) return 'geojson';
      if (/"(locations|timelineObjects|semanticSegments|rawSignals|startTime)"/.test(s)) return 'takeout';
      return 'json';
    }
    return 'csv';
  }
  // text souboru → { typ, zaznamy, varovani } (CSV vrací csv k namapování)
  function nactiText(nazev, text) {
    const typ = detekuj(nazev, text);
    if (typ === 'gpx') return Object.assign({ typ }, parsujGpx(text));
    if (typ === 'kml') return Object.assign({ typ }, parsujKml(text));
    if (typ === 'csv') { const csv = parsujCsvText(text); return { typ, csv, mapovani: odhadniMapovani(csv.hlavicka), zaznamy: [], varovani: [] }; }
    let j;
    try { j = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON.'); }
    if (typ === 'geojson') return Object.assign({ typ }, parsujGeoJson(j));
    const r = parsujTakeout(j);
    if (!r.zaznamy.length && typ === 'json') throw new Error('Neznámý formát JSON (čekám GeoJSON nebo Google Takeout).');
    return Object.assign({ typ: 'takeout' }, r);
  }

  /* ---------- případ ---------- */
  function prazdny(nazev) {
    return { verze: VERZE, id: novyId('p'), nazev: nazev || 'Nový případ', vytvoreno: Date.now(), zdroje: [], zaznamy: [], poznamky: [], mista: [], spis: '', zpracovatel: '', ukazkaInfo: null, autoAnalyzy: null };
  }
  function normZdroj(z, i) {
    return {
      id: z.id || novyId('s'), nazev: String(z.nazev || 'zdroj').slice(0, 120), osoba: String(z.osoba || 'Osoba').slice(0, 60),
      zarizeni: String(z.zarizeni || '').slice(0, 60), format: z.format || '', tz: platnePasmo(z.tz) ? z.tz : TZ_VYCHOZI,
      posun: isFinite(+z.posun) ? Math.round(+z.posun) : 0, barva: /^#[0-9a-f]{6}$/i.test(z.barva) ? z.barva : BARVY[(i || 0) % BARVY.length],
      hash: z.hash || '', velikost: z.velikost || 0, importovano: z.importovano || Date.now(), varovani: Array.isArray(z.varovani) ? z.varovani.slice(0, 20) : [], skryty: !!z.skryty
    };
  }
  function migruj(d) {
    if (!d || typeof d !== 'object') return prazdny();
    const p = Object.assign(prazdny(), d);
    p.zdroje = (Array.isArray(d.zdroje) ? d.zdroje : []).map(normZdroj);
    const ids = new Set(p.zdroje.map(z => z.id));
    p.zaznamy = (Array.isArray(d.zaznamy) ? d.zaznamy : []).filter(z => z && ids.has(z.zdroj) && isFinite(z.t0)).map(zaznam);
    p.poznamky = (Array.isArray(d.poznamky) ? d.poznamky : []).filter(n => n && isFinite(n.t)).map(n => ({ id: n.id || novyId('n'), t: +n.t, text: String(n.text || '').slice(0, 2000), osoba: n.osoba || '' }));
    p.mista = (Array.isArray(d.mista) ? d.mista : []).filter(m => m && platnaPoloha(+m.lat, +m.lon)).map(normMisto);
    p.spis = String(p.spis || '').slice(0, 80); p.zpracovatel = String(p.zpracovatel || '').slice(0, 120);
    prepocitej(p);
    return p;
  }
  function normMisto(m) {
    return { id: m.id || novyId('m'), nazev: String(m.nazev || 'Místo').slice(0, 80), lat: +m.lat, lon: +m.lon, R: Math.max(5, Math.min(50000, +m.R || 100)), popis: String(m.popis || '').slice(0, 300) };
  }
  function pridejZdroj(p, zdroj, zaznamy) {
    const z = normZdroj(zdroj, p.zdroje.length);
    p.zdroje.push(z);
    for (const r of zaznamy) if (r && isFinite(r.t0)) p.zaznamy.push(zaznam(Object.assign({}, r, { zdroj: z.id })));
    prepocitej(p);
    return z;
  }
  function smazZdroj(p, id) {
    p.zdroje = p.zdroje.filter(z => z.id !== id);
    p.zaznamy = p.zaznamy.filter(r => r.zdroj !== id);
  }
  // skutečný UTC čas (t, k) podle pásma a posunu hodin zdroje
  function prepocitej(p) {
    const zm = Object.fromEntries(p.zdroje.map(z => [z.id, z]));
    for (const r of p.zaznamy) {
      const z = zm[r.zdroj] || { tz: TZ_VYCHOZI, posun: 0 };
      const f = x => x == null ? null : (r.naiv ? naUtc(x, z.tz) : x) + z.posun * 1000;
      r.t = f(r.t0); r.k = f(r.k0);
    }
    p.zaznamy.sort((a, b) => a.t - b.t);
    return p;
  }
  const osoby = p => [...new Set(p.zdroje.map(z => z.osoba))];
  function rozsah(zaz) {
    let od = Infinity, dO = -Infinity;
    for (const r of zaz) { if (r.t < od) od = r.t; const k = r.k != null ? r.k : r.t; if (k > dO) dO = k; }
    return isFinite(od) ? { od, do: dO } : null;
  }
  // polohové body osoby (přes všechna její zařízení), seřazené
  // polohy z výpisu (hovor, SMS, data) jsou polohy antény BTS, ne zařízení – bez sBts se vynechají
  const KOMUNIKACE = { hovor: 1, sms: 1, data: 1 };
  function bodyOsoby(p, osoba, jenViditelne, sBts) {
    const ids = new Set(p.zdroje.filter(z => z.osoba === osoba && !(jenViditelne && z.skryty)).map(z => z.id));
    const b = [];
    for (const r of p.zaznamy) {
      if (!ids.has(r.zdroj) || r.lat == null || (!sBts && KOMUNIKACE[r.typ])) continue;
      b.push({ t: r.t, lat: r.lat, lon: r.lon, acc: r.acc || 0, id: r.id, zdroj: r.zdroj, typ: r.typ });
      if (r.k != null && r.typ === 'navsteva') b.push({ t: r.k, lat: r.lat, lon: r.lon, acc: r.acc || 0, id: r.id, zdroj: r.zdroj, typ: r.typ });
    }
    return b.sort((a, c) => a.t - c.t);
  }

  /* ---------- analýzy ---------- */
  // pobyty (stay points, Li et al. 2008): body v okruhu `vzd` m po dobu ≥ `min` minut
  function pobyty(body, o) {
    o = Object.assign({ vzd: 150, min: 10, mezera: 60 }, o);
    const T = o.min * 60000, out = [];
    let i = 0;
    const n = body.length;
    while (i < n) {
      let j = i + 1;
      while (j < n && vzdalenost(body[i], body[j]) <= o.vzd) j++;
      if (body[j - 1].t - body[i].t >= T) {
        let la = 0, lo = 0, maxMez = 0;
        for (let k = i; k < j; k++) { la += body[k].lat; lo += body[k].lon; if (k > i) maxMez = Math.max(maxMez, body[k].t - body[k - 1].t); }
        out.push({ lat: la / (j - i), lon: lo / (j - i), od: body[i].t, do: body[j - 1].t, n: j - i, mezera: maxMez > o.mezera * 60000 ? maxMez : 0 });
        i = j;
      } else i++;
    }
    return out;
  }
  // přesuny mezi pobyty: délka trasy, doba, průměrná rychlost
  function presuny(body, poby) {
    const out = [];
    for (let k = 1; k < poby.length; k++) {
      const a = poby[k - 1], b = poby[k];
      let delka = 0, prev = a;
      for (const x of body) { if (x.t <= a.do || x.t >= b.od) continue; delka += vzdalenost(prev, x); prev = x; }
      delka += vzdalenost(prev, b);
      const dt = (b.od - a.do) / 1000;
      out.push({ od: a.do, do: b.od, z: a, kam: b, delka, primo: vzdalenost(a, b), rychlost: dt > 0 ? delka / dt * 3.6 : null });
    }
    return out;
  }
  // nemožné rychlosti mezi sousedními body (po odečtení přesnosti obou bodů)
  function nemozneRychlosti(body, limitKmh) {
    const lim = (limitKmh || 250) / 3.6, out = [];
    for (let i = 1; i < body.length; i++) {
      const a = body[i - 1], b = body[i];
      if (a.id === b.id) continue;
      const d = vzdalenost(a, b), dEff = Math.max(0, d - (a.acc || 0) - (b.acc || 0) - 20);
      const dt = (b.t - a.t) / 1000;
      if (dEff <= 0) continue;
      const v = dEff / Math.max(dt, 1); // časy mají přesnost na sekundy
      if (v > lim) out.push({ a, b, vzd: d, dt, kmh: d / Math.max(dt, 1) * 3.6 });
    }
    return out;
  }
  // odlehlé body: osamělý skok, kam i odkud by osoba musela jet rychleji než limit
  function bezSkoku(body, limitKmh) {
    const vad = new Set();
    for (const x of nemozneRychlosti(body, limitKmh)) {
      const i = body.indexOf(x.b);
      if (i > 0 && i < body.length - 1 && nemozneRychlosti([x.b, body[i + 1]], limitKmh).length) vad.add(x.b);
    }
    return { body: body.filter(b => !vad.has(b)), vyrazeno: vad.size };
  }
  // mezery v datech zdroje delší než prah (min)
  function mezery(zaz, prahMin) {
    const p = (prahMin || 60) * 60000, out = [];
    let posl = null;
    for (const r of zaz) {
      if (posl != null && r.t - posl > p) out.push({ od: posl, do: r.t, trvani: (r.t - posl) / 1000 });
      const k = r.k != null ? r.k : r.t;
      posl = posl == null ? k : Math.max(posl, k);
    }
    return out;
  }
  // souběh: body A a B s rozdílem času ≤ dt min a vzdáleností ≤ R m → sloučené intervaly
  function soubeh(bodyA, bodyB, o) {
    o = Object.assign({ R: 200, dt: 5, slouc: 15 }, o);
    const DT = o.dt * 60000, shody = [];
    let j0 = 0;
    for (const a of bodyA) {
      while (j0 < bodyB.length && bodyB[j0].t < a.t - DT) j0++;
      for (let j = j0; j < bodyB.length && bodyB[j].t <= a.t + DT; j++) {
        const b = bodyB[j], d = vzdalenost(a, b);
        if (d <= o.R) shody.push({ t: Math.min(a.t, b.t), k: Math.max(a.t, b.t), d, jiste: d + (a.acc || 0) + (b.acc || 0) <= o.R, lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 });
      }
    }
    shody.sort((x, y) => x.t - y.t);
    const out = [];
    for (const s of shody) {
      const pos = out[out.length - 1];
      if (pos && s.t - pos.do <= o.slouc * 60000) {
        pos.do = Math.max(pos.do, s.k); pos.n++;
        if (s.d < pos.minVzd) { pos.minVzd = s.d; pos.lat = s.lat; pos.lon = s.lon; }
        pos.jiste = pos.jiste || s.jiste;
      } else out.push({ od: s.t, do: s.k, n: 1, minVzd: s.d, lat: s.lat, lon: s.lon, jiste: s.jiste });
    }
    return out;
  }
  // poloha v čase t lineární interpolací (null, když nejbližší body jsou dál než maxMin)
  function polohaVCase(body, t, maxMin) {
    if (!body.length) return null;
    let lo = 0, hi = body.length - 1;
    if (t < body[0].t || t > body[hi].t) {
      const b = t < body[0].t ? body[0] : body[hi];
      return Math.abs(b.t - t) <= (maxMin || 30) * 60000 ? { lat: b.lat, lon: b.lon, acc: b.acc, odhad: true } : null;
    }
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (body[m].t <= t) lo = m; else hi = m; }
    const a = body[lo], b = body[hi];
    const M = (maxMin || 30) * 60000;
    if (t - a.t > M && b.t - t > M) return null;
    if (b.t === a.t) return { lat: a.lat, lon: a.lon, acc: a.acc, odhad: false };
    const f = (t - a.t) / (b.t - a.t);
    return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f, acc: Math.max(a.acc, b.acc), odhad: t !== a.t && t !== b.t, mezera: (b.t - a.t) / 1000 };
  }
  // ověření alibi: byla osoba v čase t (± okno min) v okruhu R m od místa?
  function alibi(body, o) {
    o = Object.assign({ R: 300, okno: 15 }, o);
    const W = o.okno * 60000, misto = { lat: o.lat, lon: o.lon };
    const kand = body.filter(b => Math.abs(b.t - o.t) <= W).map(b => {
      const d = vzdalenost(b, misto);
      return { bod: b, vzd: d, min: Math.max(0, d - (b.acc || 0)), max: d + (b.acc || 0), dt: (b.t - o.t) / 1000 };
    });
    const interp = polohaVCase(body, o.t, o.okno);
    const r = { kandidati: kand, interpolace: interp, vzdInterp: interp ? vzdalenost(interp, misto) : null, verdikt: 'nelze', text: '' };
    if (!kand.length) { r.text = 'V okně ±' + o.okno + ' min nejsou žádné polohové záznamy – z dat nelze rozhodnout.'; return r; }
    if (kand.every(k => k.max <= o.R)) { r.verdikt = 'uvnitr'; r.text = 'Všechny záznamy v okně (' + kand.length + ') leží i s přesností uvnitř okruhu ' + formatVzd(o.R) + '.'; }
    else if (kand.every(k => k.min > o.R)) { r.verdikt = 'mimo'; r.text = 'Všechny záznamy v okně (' + kand.length + ') leží i s přesností mimo okruh ' + formatVzd(o.R) + ' (nejblíže ' + formatVzd(Math.min(...kand.map(k => k.min))) + ').'; }
    else { r.verdikt = 'nejiste'; r.text = 'Záznamy v okně jsou částečně uvnitř a částečně vně okruhu nebo přesnost nestačí k rozhodnutí.'; }
    return r;
  }
  const VERDIKTY = { uvnitr: '✅ v okruhu', mimo: '⛔ mimo okruh', nejiste: '⚠️ nejednoznačné', nelze: '❔ nelze rozhodnout' };

  /* ---------- exporty ---------- */
  const csvPole = v => { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function exportCsv(p, tz, filtr) {
    const zm = Object.fromEntries(p.zdroje.map(z => [z.id, z]));
    const hl = ['cas_utc', 'cas_mistni', 'konec_utc', 'osoba', 'zarizeni', 'zdroj', 'typ', 'smer', 'protistrana', 'trvani_s', 'lat', 'lon', 'presnost_m', 'popis', 'puvodni_cas_bez_pasma'];
    const radky = [hl.join(';')];
    for (const r of p.zaznamy) {
      if (filtr && !filtr(r)) continue;
      const z = zm[r.zdroj] || {};
      radky.push([new Date(r.t).toISOString(), isoCas(r.t, tz), r.k != null ? new Date(r.k).toISOString() : '', z.osoba, z.zarizeni, z.nazev, r.typ, r.smer, r.protistrana, r.trvani,
        r.lat != null ? r.lat.toFixed(6) : '', r.lon != null ? r.lon.toFixed(6) : '', r.acc, r.popis, r.naiv ? 'ano' : ''].map(csvPole).join(';'));
    }
    return '\ufeff' + radky.join('\r\n') + '\r\n';
  }
  function exportGeoJson(p, tz, pridavne) {
    const zm = Object.fromEntries(p.zdroje.map(z => [z.id, z]));
    const f = [];
    for (const z of p.zdroje) {
      const pts = p.zaznamy.filter(r => r.zdroj === z.id && r.lat != null && r.typ === 'poloha');
      if (pts.length > 1) f.push({ type: 'Feature', properties: { druh: 'trasa', osoba: z.osoba, zarizeni: z.zarizeni, zdroj: z.nazev, stroke: z.barva, coordTimes: pts.map(r => new Date(r.t).toISOString()) }, geometry: { type: 'LineString', coordinates: pts.map(r => [+r.lon.toFixed(6), +r.lat.toFixed(6)]) } });
    }
    for (const r of p.zaznamy) {
      if (r.lat == null || r.typ === 'poloha') continue;
      const z = zm[r.zdroj] || {};
      f.push({ type: 'Feature', properties: { druh: r.typ, time: new Date(r.t).toISOString(), end: r.k != null ? new Date(r.k).toISOString() : undefined, mistni: isoCas(r.t, tz), osoba: z.osoba, protistrana: r.protistrana || undefined, popis: r.popis || undefined, accuracy: r.acc }, geometry: { type: 'Point', coordinates: [+r.lon.toFixed(6), +r.lat.toFixed(6)] } });
    }
    for (const x of pridavne || []) f.push(x);
    return JSON.stringify({ type: 'FeatureCollection', features: f }, null, 1);
  }
  // protokol jako prostý text (tisk / soubor)
  function protokol(p, tz, vysledky) {
    const r = [];
    const posunText = s => s ? (s > 0 ? '+' : '−') + formatTrvani(Math.abs(s)) : 'žádný';
    const zm = Object.fromEntries(p.zdroje.map(z => [z.id, z]));
    r.push('PROTOKOL O ČASOVÉ ANALÝZE ZÁZNAMŮ', '='.repeat(34), '');
    r.push('Případ: ' + p.nazev + (p.spis ? '   Č. j./spis: ' + p.spis : ''));
    if (p.zpracovatel) r.push('Zpracovatel: ' + p.zpracovatel);
    r.push('Vyhotoveno: ' + formatCas(Date.now(), tz) + ' (časy v protokolu v pásmu ' + tz + ', UTC v exportech)');
    const rz = rozsah(p.zaznamy);
    r.push('Období dat: ' + (rz ? formatCas(rz.od, tz) + ' – ' + formatCas(rz.do, tz) : 'bez záznamů'));
    r.push('Rozsah: ' + p.zdroje.length + ' zdrojů, ' + p.zaznamy.length + ' záznamů, osoby: ' + (osoby(p).join(', ') || '–'));
    if (p.ukazkaInfo) r.push('UPOZORNĚNÍ: případ obsahuje jen syntetická ukázková data (' + p.ukazkaInfo.nazev + ').');
    r.push('');
    let c = 1;
    r.push(c++ + '. ZDROJE DAT A ŘETĚZEC DŮKAZŮ', '-'.repeat(32));
    p.zdroje.forEach((z, i) => {
      const n = p.zaznamy.filter(x => x.zdroj === z.id);
      const rr = rozsah(n);
      r.push((i + 1) + ') ' + z.nazev + ' [' + z.format + ']', '   osoba: ' + z.osoba + (z.zarizeni ? ', zařízení: ' + z.zarizeni : ''),
        '   záznamů: ' + n.length + (rr ? ', ' + formatCas(rr.od, tz) + ' – ' + formatCas(rr.do, tz) : ''),
        '   pásmo pro časy bez údaje o pásmu: ' + z.tz + ' (takových záznamů: ' + n.filter(x => x.naiv).length + '), posun hodin zařízení: ' + posunText(z.posun));
      r.push('   SHA-256 souboru: ' + (z.hash ? z.hash + (z.velikost ? ' (' + z.velikost + ' B)' : '') : 'není (ruční zápis, syntetická data nebo více souborů)'));
      if (z.importovano) r.push('   importováno: ' + formatCas(z.importovano, tz));
      if (z.skryty) r.push('   zdroj byl při analýze skrytý (nezapočten)');
      if (z.varovani.length) r.push('   upozornění při importu: ' + z.varovani.join('; '));
    });
    r.push('');
    if (p.mista && p.mista.length) {
      r.push(c++ + '. ZÁJMOVÁ MÍSTA', '-'.repeat(17));
      for (const m of p.mista) r.push(' • ' + m.nazev + ': ' + m.lat.toFixed(5) + ', ' + m.lon.toFixed(5) + ', okruh ' + formatVzd(m.R) + (m.popis ? ' – ' + m.popis : ''));
      r.push('');
    }
    // chronologie: označené záznamy a poznámky
    const chron = p.zaznamy.filter(x => x.dulezite).map(x => {
      const z = zm[x.zdroj] || {};
      return { t: x.t, text: formatCas(x.t, tz) + (x.k != null && x.k > x.t ? ' – ' + formatCas(x.k, tz, 'cas') : '') + ' | ' + z.osoba + ' | ' + TYPY[x.typ].nazev +
        (x.smer ? (x.smer === 'in' ? ' příchozí' : ' odchozí') : '') + (x.protistrana ? ' ' + x.protistrana : '') + (x.popis ? ' | ' + x.popis : '') +
        (x.lat != null ? ' | ' + x.lat.toFixed(5) + ', ' + x.lon.toFixed(5) + (x.acc ? ' ±' + Math.round(x.acc) + ' m' : '') : '') + ' | zdroj: ' + z.nazev };
    }).concat(p.poznamky.map(n => ({ t: n.t, text: formatCas(n.t, tz) + ' | poznámka' + (n.osoba ? ' [' + n.osoba + ']' : '') + ': ' + n.text })));
    if (chron.length) {
      r.push(c++ + '. CHRONOLOGIE (označené záznamy a poznámky)', '-'.repeat(44));
      for (const x of chron.sort((a, b) => a.t - b.t)) r.push(' • ' + x.text);
      r.push('');
    }
    for (const v of vysledky || []) {
      r.push(c + '. ' + v.nadpis.toUpperCase(), '-'.repeat(v.nadpis.length + 3));
      if (v.parametry) r.push('Parametry: ' + v.parametry);
      if (!v.radky.length) r.push('(žádné nálezy)');
      for (const x of v.radky) r.push(' • ' + x);
      r.push(''); c++;
    }
    r.push('METODIKA', '-'.repeat(8),
      '• Časy bez údaje o pásmu (EXIF, CSV operátora…) byly převedeny podle pásma uvedeného u zdroje včetně letního času; posun hodin zařízení byl přičten.',
      '• Vzdálenosti jsou ortodromické (WGS-84, koule R = 6 371 km). Přesnost bodů je převzata ze zdroje; kde chybí, počítá se 0 m.',
      '• Pobyty: body, které zůstaly v okruhu R po dobu aspoň T (stay points); opakovaná místa = shluky pobytů, domov = nejvíc času v noci (22–6 h), práce = nejvíc času v pracovní dny 8–18 h.',
      '• Nemožné rychlosti: rychlost mezi sousedními body po odečtení přesnosti obou bodů a 20 m. Souběh: body dvou osob s rozdílem času ≤ Δt a vzdáleností ≤ R.',
      '• Konzistence zdrojů: poloha z výpisu (BTS), fotografie nebo ruční záznam se porovná s polohou GPS téže osoby dopočtenou na stejný okamžik; u buněk se sektorem se ověřuje, zda poloha leží ve výseči antény.',
      '• Odhad posunu hodin: hledá se časový posun zdroje, při kterém jeho polohy nejlépe sedí na trasu z ostatních zdrojů (medián vzdáleností).',
      '', 'OMEZENÍ', '-'.repeat(7),
      '• Poloha zařízení nemusí odpovídat poloze osoby (zařízení mohlo být zapůjčeno nebo odloženo). Polohy z buněk BTS mají přesnost stovky metrů až kilometry.',
      '• Odvozené údaje (návštěvy Google, pobyty, opakovaná místa) jsou interpretace, ne přímá měření. Chybějící data neznamenají nepřítomnost.',
      '• Výsledky jsou podkladem pro další prověřování, ne důkazem samy o sobě.',
      '• Analýza byla provedena lokálně v prohlížeči, data nebyla odeslána mimo počítač.');
    return r.join('\n');
  }

  /* ---------- geometrie sektorů BTS ---------- */
  const RAD = Math.PI / 180;
  // cílový bod z výchozího bodu, azimutu (°) a vzdálenosti (m)
  function cil(lat, lon, az, d) {
    const R = 6371008.8, dr = d / R, f1 = lat * RAD, l1 = lon * RAD, th = az * RAD;
    const f2 = Math.asin(Math.sin(f1) * Math.cos(dr) + Math.cos(f1) * Math.sin(dr) * Math.cos(th));
    const l2 = l1 + Math.atan2(Math.sin(th) * Math.sin(dr) * Math.cos(f1), Math.cos(dr) - Math.sin(f1) * Math.sin(f2));
    return [f2 / RAD, ((l2 / RAD + 540) % 360) - 180];
  }
  function azimutMezi(a, b) {
    const f1 = a.lat * RAD, f2 = b.lat * RAD, dl = (b.lon - a.lon) * RAD;
    const y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return (Math.atan2(y, x) / RAD + 360) % 360;
  }
  const rozdilUhlu = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
  // výseč antény jako polygon [[lat, lon]…]
  function vysec(lat, lon, az, svazek, R, n) {
    n = n || 18; svazek = svazek || 120;
    const out = [[lat, lon]];
    for (let i = 0; i <= n; i++) out.push(cil(lat, lon, az - svazek / 2 + svazek * i / n, R));
    out.push([lat, lon]);
    return out;
  }
  const VYCHOZI_POLOMER_BTS = 2000;
  // leží bod v oblasti buňky (kruh, nebo výseč se sektorem)? tol = tolerance v metrech
  function vOblasti(r, bod, tol) {
    tol = tol || 0;
    const R = r.acc || VYCHOZI_POLOMER_BTS, d = vzdalenost(r, bod);
    if (d > R + tol) return false;
    if (r.azimut == null || d <= tol + 50) return true;
    const navic = Math.asin(Math.min(1, tol / d)) / RAD;
    return rozdilUhlu(azimutMezi(r, bod), r.azimut) <= (r.svazek || 120) / 2 + navic;
  }

  /* ---------- konzistence zdrojů a posun hodin ---------- */
  const TESTOVANE = { hovor: 1, sms: 1, data: 1, foto: 1, udalost: 1 };
  // poloha z výpisu / fotky / ručního zápisu proti GPS téže osoby (z ostatních zdrojů) ve stejný okamžik
  function konzistence(p, osoba, o) {
    o = Object.assign({ tol: 100, maxMin: 10 }, o);
    const ids = new Set(p.zdroje.filter(z => z.osoba === osoba && !z.skryty).map(z => z.id));
    const ref = p.zaznamy.filter(r => ids.has(r.zdroj) && r.typ === 'poloha' && r.lat != null).map(r => ({ t: r.t, lat: r.lat, lon: r.lon, acc: r.acc || 0, zdroj: r.zdroj }));
    const refBez = {};
    const out = [];
    for (const r of p.zaznamy) {
      if (!ids.has(r.zdroj) || r.lat == null || !TESTOVANE[r.typ]) continue;
      const rf = refBez[r.zdroj] || (refBez[r.zdroj] = ref.filter(x => x.zdroj !== r.zdroj));
      const g = polohaVCase(rf, r.t, o.maxMin);
      if (!g) { out.push({ r, stav: 'bez' }); continue; }
      const d = vzdalenost(r, g);
      let ok, limit;
      if (r.azimut != null || ((r.typ === 'hovor' || r.typ === 'sms' || r.typ === 'data') && r.acc)) {
        limit = r.acc || VYCHOZI_POLOMER_BTS; ok = vOblasti(r, g, o.tol + (g.acc || 0));
      } else { limit = (r.acc || 0) + (g.acc || 0) + o.tol; ok = d <= limit; }
      out.push({ r, gps: g, vzd: d, limit, stav: ok ? 'ok' : 'rozpor' });
    }
    return out;
  }
  // posun hodin zdroje (s), při kterém jeho polohy nejlépe sedí na referenční trasu
  function odhadniPosun(ref, body, o) {
    o = Object.assign({ max: 3 * 3600, krok: 60, maxMin: 5 }, o);
    if (!ref.length || !body.length) return null;
    const krok = Math.max(1, Math.ceil(body.length / 80));
    const vz = body.filter((_, i) => i % krok === 0);
    const pot = Math.max(2, Math.ceil(vz.length * 0.5));
    const skore = s => {
      const d = [];
      for (const b of vz) { const g = polohaVCase(ref, b.t + s * 1000, o.maxMin); if (g) d.push(vzdalenost(b, g)); }
      if (d.length < Math.min(pot, vz.length)) return null;
      d.sort((a, c) => a - c);
      return { med: d[d.length >> 1], n: d.length };
    };
    let nej = null;
    const zkus = s => { const k = skore(s); if (k && (!nej || k.med < nej.median - 0.01 || (Math.abs(k.med - nej.median) <= 0.01 && Math.abs(s) < Math.abs(nej.posun)))) nej = { posun: s, median: k.med, n: k.n }; };
    for (let s = -o.max; s <= o.max; s += o.krok) zkus(s);
    if (!nej) return null;
    const s0 = nej.posun, jemny = Math.max(1, Math.round(o.krok / 12));
    for (let s = s0 - o.krok; s <= s0 + o.krok; s += jemny) zkus(s);
    const nula = skore(0);
    let hod = Math.round(nej.posun / 3600);
    if (hod && Math.abs(nej.posun - hod * 3600) <= 60) { // celé hodiny = jiné pásmo – zaokrouhlit, pokud shoda nezhorší
      const k = skore(hod * 3600);
      if (k && k.med <= nej.median * 1.5 + 5) Object.assign(nej, { posun: hod * 3600, median: k.med, n: k.n });
    }
    hod = Math.round(nej.posun / 3600);
    return Object.assign(nej, { median0: nula ? nula.med : null, celkem: body.length, pasmo: hod !== 0 && Math.abs(nej.posun - hod * 3600) <= 120 ? hod : 0 });
  }

  /* ---------- místa, vzorce, zájmová místa ---------- */
  function denVTydnu(c) { return (new Date(Date.UTC(c.r, c.m - 1, c.d)).getUTCDay() + 6) % 7; } // 0 = pondělí
  const DNY = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];
  // opakovaná místa ze shluků pobytů, odhad domova a práce
  function castaMista(body, tz, o) {
    o = Object.assign({ vzd: 150, min: 15, slouc: 250 }, o);
    const shl = [];
    for (const s of pobyty(body, { vzd: o.vzd, min: o.min })) {
      let c = shl.find(x => vzdalenost(x, s) <= o.slouc);
      if (!c) { c = { lat: s.lat, lon: s.lon, pobyty: [], celkem: 0, noc: 0, prace: 0, hodiny: new Array(24).fill(0), dny: new Set() }; shl.push(c); }
      c.pobyty.push(s);
      c.lat += (s.lat - c.lat) / c.pobyty.length; c.lon += (s.lon - c.lon) / c.pobyty.length;
      c.celkem += s.do - s.od;
      for (let t = s.od; t < s.do; t += 300000) {
        const k = rozlozCas(t, tz), w = denVTydnu(k), dt = Math.min(300000, s.do - t) / 60000;
        c.hodiny[k.h] += dt;
        if (k.h >= 22 || k.h < 6) c.noc += dt;
        if (w < 5 && k.h >= 8 && k.h < 18) c.prace += dt;
        c.dny.add(k.r * 10000 + k.m * 100 + k.d);
      }
    }
    const out = shl.map(c => Object.assign(c, { navstev: c.pobyty.length, dny: c.dny.size, stitek: '' })).sort((a, b) => b.celkem - a.celkem);
    const domov = out.slice().sort((a, b) => b.noc - a.noc)[0];
    if (domov && domov.noc >= 180) domov.stitek = 'domov';
    const prace = out.filter(c => !c.stitek).sort((a, b) => b.prace - a.prace)[0];
    if (prace && prace.prace >= 240 && prace.dny >= 2) prace.stitek = 'práce';
    for (const c of out) if (!c.stitek) c.stitek = c.navstev >= 2 ? 'opakované' : 'jednorázové';
    return out;
  }
  // kde a kdy: minuty v hodině × dni týdne a mřížka mapy
  function vzorce(body, tz, o) {
    o = Object.assign({ bunka: 250, maxDt: 30 }, o);
    const matice = DNY.map(() => new Array(24).fill(0)), dny = new Set(), bunky = {};
    const mista = (o.mista || []).slice(0, 9), poMistech = DNY.map(() => [...Array(24)].map(() => new Array(mista.length + 1).fill(0)));
    const lat0 = body.length ? body[0].lat : 50, dlat = o.bunka / 111320, dlon = dlat / Math.cos(lat0 * RAD);
    for (let i = 0; i < body.length; i++) {
      const b = body[i], n = body[i + 1];
      const dt = (n ? Math.min(n.t - b.t, o.maxDt * 60000) : 60000) / 60000;
      const k = rozlozCas(b.t, tz);
      matice[denVTydnu(k)][k.h] += dt;
      if (mista.length) {
        let nej = -1, nd = o.slouc || 250;
        mista.forEach((m, i) => { const d = vzdalenost(b, m); if (d <= nd) { nd = d; nej = i; } });
        poMistech[denVTydnu(k)][k.h][nej + 1] += dt;
      }
      dny.add(k.r * 10000 + k.m * 100 + k.d);
      const iy = Math.floor(b.lat / dlat), ix = Math.floor(b.lon / dlon), kl = iy + ':' + ix;
      (bunky[kl] || (bunky[kl] = { lat: iy * dlat, lon: ix * dlon, dlat, dlon, w: 0 })).w += dt;
    }
    let max = 0; for (const r of matice) for (const v of r) max = Math.max(max, v);
    const b = Object.values(bunky).sort((x, y) => y.w - x.w);
    // převládající místo v každé hodině (i = index místa, −1 = jinde / v pohybu)
    const dominanta = poMistech.map(r => r.map(c => { let i = 0; c.forEach((v, k) => { if (v > c[i]) i = k; }); return c[i] > 0 ? { i: i - 1, min: c[i] } : null; }));
    return { matice, max, dny: dny.size, bunky: b, maxBunka: b.length ? b[0].w : 0, dominanta };
  }
  // návštěvy zájmových míst: souvislé úseky bodů v okruhu místa
  function navstevyMist(body, mista, o) {
    o = Object.assign({ mezera: 20, min: 0 }, o);
    const out = [];
    for (const m of mista) {
      let cur = null;
      const uzavri = () => { if (cur && cur.do - cur.od >= o.min * 60000) out.push(cur); cur = null; };
      for (const b of body) {
        const d = vzdalenost(b, m);
        if (d > m.R) { if (d - (b.acc || 0) > m.R) uzavri(); continue; } // jistě venku → návštěva končí
        if (cur && b.t - cur.do <= o.mezera * 60000) { cur.do = b.t; cur.n++; cur.minVzd = Math.min(cur.minVzd, d); }
        else { uzavri(); cur = { misto: m, od: b.t, do: b.t, n: 1, minVzd: d }; }
      }
      uzavri();
    }
    return out.sort((a, b) => a.od - b.od);
  }

  /* ---------- hledání ---------- */
  // dotaz: slova (vše musí sedět), typ:hovor, ⭐ nebo * = jen označené; čísla bez mezer
  function shoda(r, z, dotaz) {
    const tok = bezDia(dotaz).split(/\s+/).filter(Boolean);
    if (!tok.length) return true;
    const text = bezDia([r.popis, r.protistrana, z && z.osoba, z && z.zarizeni, z && z.nazev, TYPY[r.typ].nazev].join(' '));
    const bezMezer = text.replace(/\s+/g, '');
    return tok.every(t => {
      if (t === '⭐' || t === '*') return r.dulezite;
      if (t.startsWith('typ:')) { const x = t.slice(4); return r.typ === x || bezDia(TYPY[r.typ].nazev).startsWith(x); }
      return text.includes(t) || bezMezer.includes(t.replace(/\s+/g, ''));
    });
  }

  /* ---------- KML ---------- */
  const xmlEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function exportKml(p, tz) {
    const zm = Object.fromEntries(p.zdroje.map(z => [z.id, z]));
    const barva = h => 'ff' + h.slice(5, 7) + h.slice(3, 5) + h.slice(1, 3); // KML = aabbggrr
    const o = ['<?xml version="1.0" encoding="UTF-8"?>', '<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">', '<Document>', '<name>' + xmlEsc(p.nazev) + '</name>'];
    for (const z of p.zdroje) o.push(`<Style id="s${xmlEsc(z.id)}"><LineStyle><color>${barva(z.barva)}</color><width>3</width></LineStyle><IconStyle><color>${barva(z.barva)}</color></IconStyle></Style>`);
    for (const z of p.zdroje) {
      const pts = p.zaznamy.filter(r => r.zdroj === z.id && r.lat != null && r.typ === 'poloha');
      if (pts.length < 2) continue;
      o.push(`<Placemark><name>${xmlEsc(z.osoba + ' – ' + (z.zarizeni || z.nazev))}</name><styleUrl>#s${xmlEsc(z.id)}</styleUrl><gx:Track>`);
      for (const r of pts) o.push('<when>' + new Date(r.t).toISOString() + '</when>');
      for (const r of pts) o.push('<gx:coord>' + r.lon.toFixed(6) + ' ' + r.lat.toFixed(6) + ' 0</gx:coord>');
      o.push('</gx:Track></Placemark>');
    }
    for (const r of p.zaznamy) {
      if (r.lat == null || r.typ === 'poloha') continue;
      const z = zm[r.zdroj] || {};
      const cas = r.k != null && r.k > r.t ? `<TimeSpan><begin>${new Date(r.t).toISOString()}</begin><end>${new Date(r.k).toISOString()}</end></TimeSpan>` : `<TimeStamp><when>${new Date(r.t).toISOString()}</when></TimeStamp>`;
      o.push(`<Placemark><name>${xmlEsc((r.dulezite ? '⭐ ' : '') + TYPY[r.typ].nazev + ' ' + formatCas(r.t, tz, 'cas'))}</name><description>${xmlEsc([z.osoba, formatCas(r.t, tz), r.protistrana, r.popis, r.acc ? '±' + Math.round(r.acc) + ' m' : ''].filter(Boolean).join(' | '))}</description>${cas}<styleUrl>#s${xmlEsc(z.id)}</styleUrl><Point><coordinates>${r.lon.toFixed(6)},${r.lat.toFixed(6)},0</coordinates></Point></Placemark>`);
    }
    for (const m of p.mista || []) o.push(`<Placemark><name>${xmlEsc('📍 ' + m.nazev)}</name><description>${xmlEsc('zájmové místo, okruh ' + formatVzd(m.R) + (m.popis ? ' – ' + m.popis : ''))}</description><Point><coordinates>${m.lon.toFixed(6)},${m.lat.toFixed(6)},0</coordinates></Point></Placemark>`);
    o.push('</Document>', '</kml>');
    return o.join('\n');
  }

  /* ---------- ukázková data (syntetická) ---------- */
  function ukazka() {
    const p = prazdny('Ukázka – syntetická data');
    p.spis = 'UKÁZKA 1/2026';
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const den = Date.UTC(2026, 9, 14) - 2 * 3600000; // 14. 10. 2026 00:00 SELČ
    const H = h => den + h * 3600000;
    const trasa = (body) => { // [[hodina, lat, lon]] → body po 1 min s interpolací
      const out = [];
      for (let i = 1; i < body.length; i++) {
        const [h0, a0, o0] = body[i - 1], [h1, a1, o1] = body[i];
        for (let t = H(h0); t < H(h1); t += 60000) {
          const f = (t - H(h0)) / (H(h1) - H(h0));
          out.push({ t0: t, naiv: false, typ: 'poloha', lat: a0 + (a1 - a0) * f + (rnd() - 0.5) * 0.0004, lon: o0 + (o1 - o0) * f + (rnd() - 0.5) * 0.0006, acc: 8 + Math.round(rnd() * 20) });
        }
      }
      return out;
    };
    // Jan Novák: doma (Vinohrady) → práce (Karlín) → Smíchov (večer) → domů, výpadek 13–14 h, jeden skok
    const doma = [50.0755, 14.4378], prace = [50.0925, 14.4510], smichov = [50.0705, 14.4040];
    const a = trasa([[7, ...doma], [8, ...doma], [8.4, ...prace], [12.9, ...prace]]).concat(trasa([[14.1, ...prace], [17, ...prace], [17.5, ...smichov], [19.5, ...smichov], [20, ...doma], [22, ...doma]]));
    a.push({ t0: H(10.5) + 20000, naiv: false, typ: 'poloha', lat: 49.1951, lon: 16.6068, acc: 30, popis: 'chybný fix' });
    pridejZdroj(p, { nazev: 'novak_telefon.gpx', osoba: 'Jan Novák', zarizeni: 'telefon A', format: 'GPX' }, a);
    // Petra Malá: Takeout, setkání na Smíchově 18:00–19:00
    const b = trasa([[9, 50.1030, 14.3900], [17.3, 50.1030, 14.3900], [17.9, ...smichov], [19, smichov[0] + 0.0005, smichov[1] + 0.0004], [19.6, 50.0600, 14.4200], [21, 50.0600, 14.4200]])
      .filter((_, i) => i % 3 === 0).map(x => Object.assign(x, { acc: 25 + Math.round(rnd() * 40) }));
    pridejZdroj(p, { nazev: 'Records.json', osoba: 'Petra Malá', zarizeni: 'telefon B', format: 'Takeout' }, b);
    // výpis hovorů – hodiny operátora v místním čase bez pásma
    const hov = [[8.55, 'out', '+420 601 111 222', 95], [12.2, 'in', '+420 777 333 444', 340], [16.75, 'out', '+420 602 555 666', 42], [18.4, 'in', '+420 602 555 666', 0], [21.1, 'out', '+420 601 111 222', 610]];
    pridejZdroj(p, { nazev: 'vypis_hovoru.csv', osoba: 'Jan Novák', zarizeni: 'SIM 601…', format: 'CSV', tz: 'Europe/Prague' },
      hov.map(([h, sm, c, tr], i) => ({ t0: H(h) + 2 * 3600000, naiv: true, typ: i === 3 ? 'sms' : 'hovor', smer: sm, protistrana: c, trvani: i === 3 ? null : tr, popis: 'BTS Praha ' + (h < 12 ? 'Karlín' : h < 17 ? 'Karlín' : 'Smíchov') })));
    // fotoaparát s hodinami napřed o 7 min
    pridejZdroj(p, { nazev: 'IMG_2041.jpg', osoba: 'Jan Novák', zarizeni: 'fotoaparát', format: 'EXIF', tz: 'Europe/Prague', posun: -420 },
      [{ t0: H(18.25) + 2 * 3600000 + 420000, naiv: true, typ: 'foto', lat: smichov[0] + 0.0003, lon: smichov[1] - 0.0002, popis: 'IMG_2041.jpg' }]);
    p.poznamky.push({ id: novyId('n'), t: H(18.5), text: 'Podle svědka se oba setkali v kavárně na Smíchově.', osoba: '' });
    prepocitej(p);
    return p;
  }

  /* ---------- galerie ukázek (syntetická data, smyšlené osoby) ---------- */
  function generator(seed) {
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    // body [[hodina, lat, lon]…] dne `den` (UTC místní půlnoci) → polohy po o.krok s
    const trasa = (den, body, o) => {
      o = Object.assign({ krok: 60, sum: 0.0003, acc: [8, 20] }, o);
      const H = h => den + h * 3600000, out = [];
      for (let i = 1; i < body.length; i++) {
        const [h0, a0, o0] = body[i - 1], [h1, a1, o1] = body[i];
        for (let t = H(h0); t < H(h1); t += o.krok * 1000) {
          const f = (t - H(h0)) / (H(h1) - H(h0));
          out.push({ t0: t, naiv: false, typ: 'poloha', lat: a0 + (a1 - a0) * f + (rnd() - 0.5) * o.sum, lon: o0 + (o1 - o0) * f + (rnd() - 0.5) * o.sum * 1.5, acc: o.acc[0] + Math.round(rnd() * (o.acc[1] - o.acc[0])) });
        }
      }
      return out;
    };
    // poloha na trase (bez šumu) v hodině h
    const naTrase = (body, h) => {
      for (let i = 1; i < body.length; i++) {
        const [h0, a0, o0] = body[i - 1], [h1, a1, o1] = body[i];
        if (h >= h0 && h <= h1) { const f = (h - h0) / (h1 - h0 || 1); return [a0 + (a1 - a0) * f, o0 + (o1 - o0) * f]; }
      }
      const b = body[h < body[0][0] ? 0 : body.length - 1];
      return [b[1], b[2]];
    };
    return { rnd, trasa, naTrase };
  }
  const pulnoc = (r, m, d) => naUtc(Date.UTC(r, m - 1, d), TZ_VYCHOZI);
  const mistni = t => t + posunPasma(TZ_VYCHOZI, t) * 60000; // UTC → nástěnný čas Prahy
  const bts = (stanice, bod, o) => { const az = azimutMezi({ lat: stanice[0], lon: stanice[1] }, { lat: bod[0], lon: bod[1] }); return Object.assign({ lat: stanice[0], lon: stanice[1], azimut: (30 + Math.round(((az - 30 + 360) % 360) / 120) * 120) % 360, svazek: 120, acc: 2000 }, o); };

  function ukazkaAlibi() {
    const p = prazdny('Ukázka: vyvrácené alibi'); p.spis = 'UKÁZKA 2/2026';
    const g = generator(11), den = pulnoc(2026, 11, 6), H = h => den + h * 3600000;
    const doma = [50.0312, 14.5263], sklad = [50.0478, 14.5431], vecerka = [50.0330, 14.5240];
    const cesta = [[17, ...doma], [20.1, ...doma], [20.15, ...vecerka], [20.4, ...vecerka], [20.45, ...doma], [20.65, ...doma], [21.05, ...sklad], [21.75, ...sklad], [22.15, ...doma], [23.6, ...doma]];
    pridejZdroj(p, { nazev: 'Records.json', osoba: 'Karel Dvořák', zarizeni: 'telefon', format: 'Takeout' }, g.trasa(den, cesta, { krok: 120, acc: [10, 35] }));
    const stDoma = [50.0290, 14.5200], stSklad = [50.0510, 14.5470];
    const hov = [[19.4, 'hovor', 'in', '+420 600 000 211', 120, stDoma], [21.37, 'hovor', 'out', '+420 600 000 212', 45, stSklad], [22.6, 'sms', 'out', '+420 600 000 211', null, stDoma]];
    pridejZdroj(p, { nazev: 'vypis_operatora.csv', osoba: 'Karel Dvořák', zarizeni: 'SIM 600…', format: 'CSV', tz: TZ_VYCHOZI },
      hov.map(([h, typ, smer, c, tr, st]) => Object.assign(bts(st, g.naTrase(cesta, h), { acc: 1200 }), { t0: mistni(H(h)), naiv: true, typ, smer, protistrana: c, trvani: tr, popis: 'BTS ' + (st === stSklad ? 'Hostivař-sever' : 'Záběhlice') })));
    pridejZdroj(p, { nazev: 'Ruční záznamy – Karel Dvořák', osoba: 'Karel Dvořák', zarizeni: 'ruční zápis', format: 'ruční', tz: 'UTC' }, [
      { t0: H(19), k0: H(23), naiv: false, typ: 'udalost', dulezite: true, popis: 'Výpověď: „Celý večer od 19 do 23 h jsem byl doma, nikam jsem nešel.“' },
      { t0: H(20.25), naiv: false, typ: 'udalost', lat: vecerka[0], lon: vecerka[1], acc: 30, popis: 'Platba kartou 186 Kč – večerka (výpis z banky)' }]);
    p.poznamky.push({ id: novyId('n'), t: H(21 + 1 / 3), text: 'Kamerový záznam skladu: vloupání ve 21:20, pachatel v kapuci, obličej nerozeznatelný.', osoba: '' });
    p.mista = [normMisto({ nazev: 'Sklad – místo činu', lat: sklad[0], lon: sklad[1], R: 120 }), normMisto({ nazev: 'Bydliště podle výpovědi', lat: doma[0], lon: doma[1], R: 120 })];
    p.autoAnalyzy = [['alibi', { osoba: 'Karel Dvořák', tUtc: H(21 + 1 / 3), misto: sklad.join(', '), R: 150, okno: 10 }], ['alibi', { osoba: 'Karel Dvořák', tUtc: H(21 + 1 / 3), misto: doma.join(', '), R: 150, okno: 10 }], ['mista', { min: 0 }]];
    return prepocitej(p);
  }

  function ukazkaHodiny() {
    const p = prazdny('Ukázka: posunuté hodiny a jiné pásmo'); p.spis = 'UKÁZKA 3/2026';
    const g = generator(23), den = pulnoc(2026, 7, 18), H = h => den + h * 3600000;
    const P0 = [50.0350, 14.4600], P1 = [49.8200, 14.7000], A = [49.8000, 14.7600], B = [49.7600, 14.7400], C = [49.7500, 14.6800], D = [49.7900, 14.6600];
    const cesta = [[8.75, ...P0], [9.0, ...P0], [9.8, ...P1], [10.3, ...P1], [11.2, ...A], [12.3, ...B], [13.6, ...C], [14.7, ...D], [15.5, ...P1], [16.0, ...P1], [16.8, ...P0], [17.5, ...P0]];
    pridejZdroj(p, { nazev: 'hodinky_vylet.gpx', osoba: 'Eva Králová', zarizeni: 'sportovní hodinky', format: 'GPX' }, g.trasa(den, cesta, { krok: 30, sum: 0.0002, acc: [4, 10] }));
    // telefon ponechaný v pásmu Londýna: EXIF bez pásma ukazuje o hodinu méně
    const fotky = [10.6, 11.0, 11.6, 12.0, 12.9, 13.3, 14.1, 14.5, 15.2].map((h, i) => {
      const [la, lo] = g.naTrase(cesta, h);
      return { t0: H(h) + posunPasma('Europe/London', H(h)) * 60000, naiv: true, typ: 'foto', lat: la + (g.rnd() - 0.5) * 0.0001, lon: lo + (g.rnd() - 0.5) * 0.00015, acc: 8, popis: 'IMG_' + (4210 + i) + '.jpg · telefon' };
    });
    const zf = pridejZdroj(p, { nazev: 'Fotografie (9)', osoba: 'Eva Králová', zarizeni: 'telefon – fotky', format: 'EXIF', tz: TZ_VYCHOZI }, fotky);
    // kamera do auta: místní čas bez pásma, hodiny napřed o 4,5 min
    const jizdy = [[[9.0, ...P0], [9.8, ...P1]], [[16.0, ...P1], [16.8, ...P0]]];
    const kam = [].concat(...jizdy.map(j => g.trasa(den, j, { krok: 30, sum: 0.0001, acc: [5, 10] }))).map(x => Object.assign(x, { t0: mistni(x.t0) + 270000, naiv: true }));
    const zk = pridejZdroj(p, { nazev: 'kamera_do_auta.csv', osoba: 'Eva Králová', zarizeni: 'kamera do auta', format: 'CSV', tz: TZ_VYCHOZI }, kam);
    p.autoAnalyzy = [['posun', { zdroj: zf.id, max: 3 }], ['posun', { zdroj: zk.id, max: 3 }], ['konzistence', { osoba: 'Eva Králová', tol: 100 }]];
    return prepocitej(p);
  }

  function ukazkaSpoofing() {
    const p = prazdny('Ukázka: díra v datech a nemožný skok'); p.spis = 'UKÁZKA 4/2026';
    const g = generator(37), den = pulnoc(2026, 9, 23), H = h => den + h * 3600000;
    const doma = [49.2105, 16.5930], kancl = [49.1951, 16.6080], ba = [48.1440, 17.1130];
    const a = g.trasa(den, [[7.5, ...doma], [8.6, ...doma], [9.0, ...kancl], [13.17, ...kancl]], { krok: 120, acc: [10, 30] })
      .concat(g.trasa(den, [[14.033, ...ba], [14.97, ba[0] + 0.004, ba[1] + 0.006]], { krok: 120, sum: 0.00002, acc: [3, 5] }))
      .concat(g.trasa(den, [[14.983, ...kancl], [17.0, ...kancl], [17.4, ...doma], [20, ...doma]], { krok: 120, acc: [10, 30] }));
    pridejZdroj(p, { nazev: 'Records.json', osoba: 'Tomáš Beneš', zarizeni: 'telefon', format: 'Takeout' }, a);
    const stA = [49.1985, 16.6040], stB = [49.2130, 16.5880];
    const ev = [[8.2, 'hovor', 'out', 95, stB, doma], [13.42, 'hovor', 'in', 240, stA, kancl], [13.83, 'data', '', 600, stA, kancl], [14.33, 'hovor', 'out', 180, stA, kancl],
      [14.58, 'sms', 'in', null, stA, kancl], [14.83, 'data', '', 300, stA, kancl], [15.5, 'hovor', 'in', 60, stA, kancl], [18.2, 'sms', 'out', null, stB, doma]];
    pridejZdroj(p, { nazev: 'vypis_operatora.csv', osoba: 'Tomáš Beneš', zarizeni: 'SIM 600…', format: 'CSV', tz: TZ_VYCHOZI },
      ev.map(([h, typ, smer, tr, st, kde], i) => Object.assign(bts(st, kde, { acc: 1500 }), { t0: mistni(H(h)), naiv: true, typ, smer, protistrana: typ === 'data' ? '' : '+420 600 000 3' + (10 + i), trvani: tr, popis: 'BTS Brno ' + (st === stA ? 'střed' : 'Žabovřesky') })));
    p.autoAnalyzy = [['mezery', { prah: 30 }], ['rychlosti', { limit: 250 }], ['konzistence', { osoba: 'Tomáš Beneš', tol: 100 }]];
    return prepocitej(p);
  }

  function ukazkaBts() {
    const p = prazdny('Ukázka: výpis hovorů a BTS vs. GPS'); p.spis = 'UKÁZKA 5/2026';
    const g = generator(53), den = pulnoc(2026, 10, 2), H = h => den + h * 3600000;
    const doma = [49.8350, 18.2900], prace = [49.8200, 18.2600], obchod = [49.8420, 18.2750];
    const cesta = [[6.5, ...doma], [7.3, ...doma], [7.6, ...prace], [15.5, ...prace], [15.8, ...obchod], [16.4, ...obchod], [16.6, ...doma], [22.5, ...doma]];
    pridejZdroj(p, { nazev: 'zaznam_trasy.gpx', osoba: 'Lucie Horáková', zarizeni: 'telefon – aplikace GPS', format: 'GPX' }, g.trasa(den, cesta, { krok: 60, acc: [5, 15] }));
    const stanice = [[49.8380, 18.2950], [49.8180, 18.2650], [49.8450, 18.2700], [49.8300, 18.2400]], daleka = [49.8000, 18.2300];
    const nazvy = ['Poruba-východ', 'Zábřeh', 'Poruba-sever', 'Mariánské Hory'];
    const ev = [[7.05, 'sms', 'in', 101], [7.45, 'hovor', 'out', 102, 180], [9.2, 'data', '', 0, 900], [10.5, 'hovor', 'in', 103, 420], [12.1, 'sms', 'out', 101], [13.4, 'hovor', 'out', 104, 65],
      [15.65, 'hovor', 'in', 101, 140], [16.1, 'data', '', 0, 600], [17.5, 'hovor', 'out', 105, 260], [18.8, 'sms', 'in', 105], [19.67, 'hovor', 'in', 199, 300, true], [19.92, 'hovor', 'out', 199, 125, true], [21.0, 'data', '', 0, 1200]];
    pridejZdroj(p, { nazev: 'vypis_operatora.csv', osoba: 'Lucie Horáková', zarizeni: 'SIM 600…', format: 'CSV', tz: TZ_VYCHOZI }, ev.map(([h, typ, smer, c, tr, divne]) => {
      const kde = g.naTrase(cesta, h);
      let i = 0; stanice.forEach((s, k) => { if (vzdalenost({ lat: s[0], lon: s[1] }, { lat: kde[0], lon: kde[1] }) < vzdalenost({ lat: stanice[i][0], lon: stanice[i][1] }, { lat: kde[0], lon: kde[1] })) i = k; });
      const b = divne ? { lat: daleka[0], lon: daleka[1], azimut: 210, svazek: 120, acc: 2000 } : bts(stanice[i], kde, { acc: 2500 });
      return Object.assign(b, { t0: mistni(H(h)), naiv: true, typ, smer, protistrana: typ === 'data' ? '' : '+420 600 000 ' + c, trvani: tr == null ? null : tr, popis: 'BTS ' + (divne ? 'Hrabůvka-jih' : nazvy[i]) });
    }));
    p.autoAnalyzy = [['konzistence', { osoba: 'Lucie Horáková', tol: 100 }], ['pobyty', { vzd: 150, min: 10 }]];
    return prepocitej(p);
  }

  function ukazkaVzorce() {
    const p = prazdny('Ukázka: vzorce pohybu – domov a práce'); p.spis = 'UKÁZKA 6/2026';
    const g = generator(71);
    const doma = [49.7380, 13.3600], prace = [49.7560, 13.3900], gym = [49.7470, 13.3700], obchod = [49.7420, 13.3500], trh = [49.7520, 13.3550], rodice = [49.7100, 13.4200];
    const bankomat = [(doma[0] + prace[0]) / 2, (doma[1] + prace[1]) / 2];
    const body = [];
    for (let d = 0; d < 14; d++) {
      const den = pulnoc(2026, 10, 5 + d), w = d % 7;
      let plan;
      if (w < 5) {
        plan = [[0, ...doma], [7.4, ...doma], [7.9, ...prace], [16.5, ...prace]];
        if (w === 1 || w === 3) plan.push([16.8, ...gym], [18.3, ...gym], [18.6, ...doma], [24, ...doma]);
        else if (w === 2) plan.push([16.8, ...obchod], [17.4, ...obchod], [17.7, ...doma], [24, ...doma]);
        else plan.push([17.0, ...doma], [24, ...doma]);
      } else if (w === 5) plan = [[0, ...doma], [9.6, ...doma], [9.9, ...trh], [11.5, ...trh], [11.8, ...doma], [24, ...doma]];
      else plan = [[0, ...doma], [12.6, ...doma], [13.0, ...rodice], [17.0, ...rodice], [17.4, ...doma], [24, ...doma]];
      body.push(...g.trasa(den, plan, { krok: 300, acc: [15, 40] }));
    }
    pridejZdroj(p, { nazev: 'Records.json', osoba: 'Martin Svoboda', zarizeni: 'telefon', format: 'Takeout' }, body);
    p.mista = [normMisto({ nazev: 'Posilovna (ověřit permanentku)', lat: gym[0], lon: gym[1], R: 80 }), normMisto({ nazev: 'Bankomat na trase', lat: bankomat[0], lon: bankomat[1], R: 60 }),
      normMisto({ nazev: 'Byt svědka J.', lat: 49.7700, lon: 13.4000, R: 100, popis: 'tvrdí, že ho Svoboda navštěvoval' })];
    p.autoAnalyzy = [['opakovana', { osoba: 'Martin Svoboda', vzd: 150, min: 15 }], ['vzorce', { osoba: 'Martin Svoboda' }], ['mista', { min: 0 }]];
    return prepocitej(p);
  }

  /* Modelový případ 17/2026 (sekce Vyšetřování) – data z obsah/vysetrovani/pripad.js
     (window.MODELOVY_PRIPAD); souřadnice, osoby, hovory i časy jsou odtud, trasa telefonu je syntetická. */
  function ukazkaPripad17(P) {
    P = P || (typeof globalThis !== 'undefined' && globalThis.MODELOVY_PRIPAD);
    if (!P || !P.mista || !P.mista.prodejna) throw new Error('Chybí data modelového případu 17/2026 (vysetrovani/pripad.js).');
    const M = P.mista, ll = k => [M[k].lat, M[k].lon];
    const osoba = id => P.osoby.find(o => o.id === id) || { jmeno: id, telefon: '' };
    const fiala = osoba('fiala'), brabec = osoba('brabec');
    const p = prazdny('Modelový případ 17/2026 – alibi L. Fialy'); p.spis = P.cislo; p.zpracovatel = P.zpracovatel;
    const g = generator(17), den = pulnoc(2026, 11, 14), H = h => den + h * 3600000;
    const T = s => naUtc(Date.parse(s + 'Z'), TZ_VYCHOZI);   // místní čas ze spisu → UTC
    const hm = (h, m) => 24 + h + m / 60;                      // čas v noci na 15. 11. → hodina od půlnoci 14. 11.
    const [dF, cs, pr, dB] = ['domFiala', 'cerpaci', 'prodejna', 'domBrabec'].map(ll);
    // místo srazu: asi 1 km od domu Fialy směrem k čerpací stanici (pěšky ~13 min)
    const sraz = [dF[0] + (cs[0] - dF[0]) * 0.33, dF[1] + (cs[1] - dF[1]) * 0.33];
    // L. Fiala: 01:25 odchází pěšky na místo srazu → 01:31 volá Brabcovi (domluva) → 01:38 vyzvednut → 01:52 čerpací stanice →
    // u prodejny 01:58–02:14 (02:14 únik, brzdná stopa) → tankování 02:21–02:27 → 02:33 vysazen na místě srazu → pěšky doma 02:45
    // (rychlosti po přímce: chůze ~5 km/h, auto 20–40 km/h; skutečná cesta po silnici je delší)
    const cestaF = [[20, ...dF], [hm(1, 25), ...dF], [hm(1, 38), ...sraz], [hm(1, 47), ...sraz], [hm(1, 52), ...cs], [hm(1, 58), ...pr], [hm(2, 14), ...pr],
      [hm(2, 21), ...cs], [hm(2, 27), ...cs], [hm(2, 33), ...sraz], [hm(2, 45), ...dF], [hm(8, 0), ...dF]];
    // T. Brabec (vozidlo 1HL 0017): doma do hovoru 01:31, 01:38 vyzvedne Fialu, spolu k prodejně a na čerpací stanici, 02:33 ho vysadí, 02:41 doma
    const cestaB = [[20, ...dB], [hm(1, 31), ...dB]].concat(cestaF.slice(2, 10), [[hm(2, 41), ...dB], [hm(8, 0), ...dB]]);
    pridejZdroj(p, { nazev: 'Takeout_Fiala_Records.json', osoba: fiala.jmeno, zarizeni: 'telefon ' + fiala.telefon, format: 'Takeout' }, g.trasa(den, cestaF, { krok: 120, acc: [10, 35] }));
    pridejZdroj(p, { nazev: 'Takeout_Brabec_Records.json', osoba: brabec.jmeno, zarizeni: 'telefon ' + brabec.telefon, format: 'Takeout' }, g.trasa(den, cestaB, { krok: 180, acc: [10, 40] }));
    // výpis hovorů L. Fialy (bez lokalizace) – místní čas bez pásma
    const hov = (P.hovory || []).filter(h => h.od === 'fiala' || h.komu === 'fiala');
    pridejZdroj(p, { nazev: 'vypis_hovoru_Fiala.csv', osoba: fiala.jmeno, zarizeni: 'SIM ' + fiala.telefon, format: 'CSV', tz: TZ_VYCHOZI },
      hov.map(h => { const ven = h.od === 'fiala', jiny = osoba(ven ? h.komu : h.od); return { t0: Date.parse(h.kdy + 'Z'), naiv: true, typ: 'hovor', smer: ven ? 'out' : 'in', protistrana: jiny.telefon, trvani: h.s, popis: jiny.jmeno }; }));
    pridejZdroj(p, { nazev: 'Ruční záznamy – ' + fiala.jmeno, osoba: fiala.jmeno, zarizeni: 'ruční zápis', format: 'ruční', tz: 'UTC' }, [
      { t0: H(22), k0: H(hm(7, 0)), naiv: false, typ: 'udalost', dulezite: true, popis: 'Výpověď L. Fialy: „Celou noc jsem spal doma v Dolní Lhotě, nikam jsem nejel.“' }]);
    for (const u of P.udalosti || []) if (u.kdy >= '2026-11-15T01:45' && u.kdy <= '2026-11-15T02:30') p.poznamky.push({ id: novyId('n'), t: T(u.kdy), text: u.text, osoba: '' });
    p.mista = [normMisto({ nazev: 'Místo činu – ' + M.prodejna.nazev, lat: pr[0], lon: pr[1], R: 150 }), normMisto({ nazev: M.domFiala.nazev + ' (podle výpovědi)', lat: dF[0], lon: dF[1], R: 150 }),
      normMisto({ nazev: M.cerpaci.nazev, lat: cs[0], lon: cs[1], R: 120 }), normMisto({ nazev: M.domBrabec.nazev, lat: dB[0], lon: dB[1], R: 120 })];
    const tCin = T('2026-11-15T02:08:40');   // poplach čidla zabezpečení
    p.autoAnalyzy = [['alibi', { osoba: fiala.jmeno, tUtc: tCin, misto: pr.join(', '), R: 150, okno: 5 }], ['alibi', { osoba: fiala.jmeno, tUtc: tCin, misto: dF.join(', '), R: 150, okno: 5 }],
      ['soubeh', { a: fiala.jmeno, b: brabec.jmeno, R: 200, dt: 5 }], ['mista', { min: 0 }]];
    return prepocitej(p);
  }

  const UKAZKY = [
    { klic: 'setkani', ikona: '👥', nazev: 'Setkání dvou osob', vytvor: () => Object.assign(ukazka(), { nazev: 'Ukázka: setkání dvou osob', autoAnalyzy: [['pobyty', { vzd: 150, min: 10 }], ['soubeh', { a: 'Jan Novák', b: 'Petra Malá', R: 200, dt: 5 }]] }),
      popis: 'Dvě osoby, GPX a Google Takeout, výpis hovorů a fotka s hodinami napřed o 7 minut.',
      vyzkousej: ['Přehrajte večer ▶ a sledujte, jak se značky obou osob potkají na Smíchově.', 'Otevřete 🧩 Konzistenci zdrojů – fotka po opravě posunu hodin sedí na trasu.', 'Klikněte na souběh ve Výsledcích – osa i mapa se na něj zaměří.'],
      najde: 'Souběh 17:55–19:00 na Smíchově, pobyty doma/v práci/na Smíchově, výpadek GPS 13–14 h a jeden chybný skok do Brna.' },
    { klic: 'alibi', ikona: '🎯', nazev: 'Vyvrácené alibi', vytvor: ukazkaAlibi,
      popis: 'Podezřelý vypověděl, že byl celý večer doma. Telefon (Takeout) a výpis operátora říkají něco jiného.',
      vyzkousej: ['Ve Výsledcích porovnejte dvě ověření alibi pro 21:20 – u skladu a doma.', 'Na mapě se podívejte na výseč antény BTS u hovoru ve 21:22.', 'Otevřete 📄 Protokol – výpověď je označená ⭐ a je v chronologii.'],
      najde: 'Ve 21:20 je telefon v okruhu skladu (✅ v okruhu), doma ne (⛔ mimo okruh); hovor ve 21:22 jde přes anténu mířící ke skladu; návštěva místa činu 21:03–21:45.' },
    { klic: 'hodiny', ikona: '⏱️', nazev: 'Posunuté hodiny a jiné pásmo', vytvor: ukazkaHodiny,
      popis: 'Výlet: hodinky s GPS (UTC), fotky z telefonu ponechaného v pásmu Londýna a kamera do auta s hodinami napřed.',
      vyzkousej: ['Ve Výsledcích u odhadu posunu klikněte „Použít posun“ – analýzy se přepočítají a rozpory fotek zmizí.', 'Porovnejte na mapě polohu fotek s trasou v čase kurzoru před opravou a po ní.', 'Zkuste u zdroje fotek místo posunu nastavit pásmo Europe/London.'],
      najde: 'Fotky mají posun +1 h (rozdíl pásem), kamera −4 min 30 s; před opravou jsou fotky v rozporu s trasou hodinek.' },
    { klic: 'spoofing', ikona: '🛰️', nazev: 'Díra v datech a nemožný skok', vytvor: ukazkaSpoofing,
      popis: 'Poloha telefonu po 50minutové díře „skočí“ do Bratislavy a po hodině okamžitě zpět. Výpis operátora ukazuje Brno.',
      vyzkousej: ['Na ose si všimněte červeně šrafované mezery a podezřele přesných bodů (±3–5 m).', 'Ve Výsledcích klikněte na nemožnou rychlost – návrat 122 km za necelou minutu.', 'Konzistence ukáže hovory přes brněnskou BTS ve chvíli, kdy GPS hlásí Bratislavu.'],
      najde: 'Mezera 13:10–14:02, nemožný skok zpět do Brna a tři rozpory GPS × BTS – typický obraz podvržené polohy (spoofing) nebo cizího zařízení.' },
    { klic: 'bts', ikona: '📡', nazev: 'Výpis hovorů a BTS vs. GPS', vytvor: ukazkaBts,
      popis: 'Den z výpisu operátora: hovory, SMS a data s polohou a azimutem antén proti trase z aplikace GPS.',
      vyzkousej: ['Na mapě zobrazte výseče antén – každý hovor má svou oblast nejistoty.', 'Do hledání na ose napište „199“ nebo „typ:hovor“ a skákejte Enterem.', 'Označte podezřelé hovory ⭐ a podívejte se na chronologii v protokolu.'],
      najde: 'Většina událostí leží ve výseči antény, dva večerní hovory s číslem …199 ale jdou přes vzdálenou BTS, zatímco GPS je doma – SIM možná v jiném telefonu.' },
    { klic: 'vzorce', ikona: '🗓️', nazev: 'Vzorce pohybu: domov a práce', vytvor: ukazkaVzorce,
      popis: 'Dva týdny historie polohy: kde osoba bývá v kterou hodinu, opakovaná místa a návštěvy zájmových míst.',
      vyzkousej: ['Prohlédněte tepelnou mapu dnů × hodin ve Výsledcích a mřížku na mapě.', 'V záložce 📍 Místa přidejte vlastní místo kliknutím do mapy a vyhodnoťte návštěvy.', 'Zjistěte, zda osoba někdy byla u svědka J.'],
      najde: 'Domov, práce (po–pá 8–16:30), posilovna út a čt, nákupy, trh v sobotu, neděle u rodičů; bankomat jen průjezdy; byt svědka nenavštíven.' },
    { klic: 'pripad17', ikona: '🕵️', nazev: 'Modelový případ 17/2026 – alibi L. Fialy', vytvor: () => ukazkaPripad17(),
      popis: 'Vloupání do prodejny v Horní Lhotě (noc 14./15. 11. 2026). L. Fiala tvrdí, že celou noc spal doma; vydal polohovou historii telefonu.',
      vyzkousej: ['Ve Výsledcích porovnejte obě ověření alibi pro 02:08:40 (poplach) – u prodejny a doma.', 'Přehrajte noc ▶ – telefony Fialy a Brabce jedou spolu přes čerpací stanici.', 'Ve výpisu hovorů najděte hovor Brabci v 01:31 a Křížovi v 03:05.'],
      najde: 'V 02:08 je Fialův telefon v okruhu prodejny (✅), doma ne (⛔); souběh s telefonem T. Brabce zhruba 01:37–02:35 (od vyzvednutí Fialy na místě srazu po jeho vysazení); návštěvy čerpací stanice v 01:52 a 02:21–02:27 – alibi vyvráceno.' }
  ];
  function ukazkaPodle(klic) {
    const u = UKAZKY.find(x => x.klic === klic);
    if (!u) return null;
    const p = u.vytvor();
    p.ukazkaInfo = { klic: u.klic, nazev: u.nazev, ikona: u.ikona, vyzkousej: u.vyzkousej, najde: u.najde };
    return p;
  }

  const api = {
    VERZE, TZ_VYCHOZI, TYPY, BARVY, VERDIKTY,
    posunPasma, naUtc, platnePasmo, prechodCasu, formatCas, isoCas, formatTrvani, formatVzd, parsujCas, parsujTrvani, parsujLatLng,
    vzdalenost, zaznam, novyId, KOMUNIKACE,
    parsujGpx, parsujKml, parsujGeoJson, parsujTakeout, parsujCsvText, odhadniMapovani, zCsv, typZTextu, smerZTextu,
    ctiExif, zExif, posunZGps, detekuj, nactiText,
    prazdny, migruj, pridejZdroj, smazZdroj, prepocitej, osoby, rozsah, bodyOsoby,
    pobyty, presuny, nemozneRychlosti, bezSkoku, mezery, soubeh, polohaVCase, alibi,
    exportCsv, exportGeoJson, exportKml, protokol, ukazka,
    cil, azimutMezi, vysec, vOblasti, VYCHOZI_POLOMER_BTS, konzistence, odhadniPosun, castaMista, vzorce, navstevyMist, shoda, DNY, rozlozCas,
    normMisto, UKAZKY, ukazkaPodle, ukazkaPripad17
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.CasovaAnalyzaJadro = api;
})();
