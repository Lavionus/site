/* Fotodokumentace – jádro bez DOM (window.FOTODOK v prohlížeči, module.exports v node).
   Test: node _test/fotodokumentace_test.js
   - anotace: vektorové objekty nad fotkou v pixelech obrázku (po EXIF orientaci, jak ho kreslí prohlížeč);
     každá má body b[[x,y]…] – posun, úchopy i zásah se tak řeší jednotně pro všechny druhy,
   - měřítko: kalibrace délkou (2 body + délka v mm) nebo obdélníkem známých rozměrů (4 body → homografie),
     měření délky, úhlu a plochy s orientační nejistotou z přesnosti kliknutí (Monte Carlo, pevný seed),
   - historie Zpět/Znovu, data fototabulky, EXIF (čtení převzaté z foto_meritka/jadro.js – FOTOMER.ctiExif).
   Homografie je přenesená z krevni_stopy/jadro.js (test ji s ní porovnává). */
(function (koren) {
  'use strict';

  const KLIC_AUTOR = 'webapp_fotodokumentace_autor';
  const NASTROJ = 'fotodokumentace';

  // druh snímku – postup dokumentace: přehledový → orientační → detailní
  const TYPY_SNIMKU = { prehled: 'přehledový', orientacni: 'orientační', detail: 'detailní', ident: 'identifikační' };

  /* druhy anotací: n = název, b = počet bodů (0 = libovolně, aspoň min) */
  const DRUHY = {
    znacka: { n: 'Značka stopy', b: 1 },
    sipka: { n: 'Šipka', b: 2 },
    kruh: { n: 'Kroužek', b: 2 },
    obdelnik: { n: 'Obdélník', b: 2 },
    text: { n: 'Text', b: 1 },
    vyrez: { n: 'Výřez s lupou', b: 3 },     // b[0], b[1] = rohy výřezu, b[2] = střed lupy
    zakryt: { n: 'Zakrytí', b: 2 },
    delka: { n: 'Délka', b: 2 },
    uhel: { n: 'Úhel', b: 3 },              // vrchol = b[1]
    plocha: { n: 'Plocha', b: 0, min: 3 }
  };
  const EFEKTY = { rozmazat: 'rozmazání', pixely: 'pixelizace', cerna: 'plná barva' };
  const MERENI = ['delka', 'uhel', 'plocha'];

  /* ---------- pomůcky ---------- */
  const kopie = o => JSON.parse(JSON.stringify(o));
  const vzd = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const cislo = v => typeof v === 'number' && Number.isFinite(v);
  const fmt = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ',');
  let citac = 0;
  const noveId = () => 'a' + Date.now().toString(36) + (citac++).toString(36);

  /* ---------- homografie (přeneseno z krevni_stopy/jadro.js) ---------- */
  function resLin(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  const mul3 = (a, b) => a.map(r => [0, 1, 2].map(j => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
  /* H (9 čísel, h9 = 1): 4 body obrázku z → 4 body roviny c; body z se kvůli stabilitě normalizují */
  function homografie(z, c) {
    if (!Array.isArray(z) || !Array.isArray(c) || z.length !== 4 || c.length !== 4) return null;
    const mx = z.reduce((a, p) => a + p[0], 0) / 4, my = z.reduce((a, p) => a + p[1], 0) / 4;
    const k = Math.sqrt(2) / (z.reduce((a, p) => a + Math.hypot(p[0] - mx, p[1] - my), 0) / 4 || 1);
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const x = (z[i][0] - mx) * k, y = (z[i][1] - my) * k, [u, v] = c[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = resLin(A, b);
    if (!h || !h.every(Number.isFinite)) return null;
    const Hn = [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]], T = [[k, 0, -k * mx], [0, k, -k * my], [0, 0, 1]];
    const H = mul3(Hn, T), d = H[2][2];
    if (Math.abs(d) < 1e-15) return null;
    return [].concat(...H).map(v => v / d);
  }
  function aplikujH(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  }

  /* ---------- měřítko ----------
     { druh: 'delka', b: [p1, p2], mm }            – známá délka v rovině stopy (pravítko, dlaždice)
     { druh: 'obdelnik', b: [4 body po obvodu], w, h } – obdélník známých rozměrů (srovnání perspektivy)
     presnost = směrodatná odchylka kliknutí v px (stejná pro kalibraci i měření) */
  function meritkoPlatne(m) {
    if (!m || typeof m !== 'object' || !Array.isArray(m.b)) return false;
    if (m.druh === 'delka') return m.b.length === 2 && cislo(m.mm) && m.mm > 0 && vzd(m.b[0], m.b[1]) > 1;
    if (m.druh === 'obdelnik') return m.b.length === 4 && cislo(m.w) && cislo(m.h) && m.w > 0 && m.h > 0 && !!homografie(m.b, rohyObdelniku(m));
    return false;
  }
  const rohyObdelniku = m => [[0, 0], [m.w, 0], [m.w, m.h], [0, m.h]];
  // převod px obrázku → mm v rovině měřítka (y dolů jako v obrázku – na délky, úhly a plochy nemá vliv)
  function prevodnik(m, body) {
    const b = body || m.b;
    if (m.druh === 'delka') { const k = m.mm / vzd(b[0], b[1]); return (x, y) => [x * k, y * k]; }
    const H = homografie(b, rohyObdelniku(m));
    return H ? (x, y) => aplikujH(H, x, y) : null;
  }
  // mm na px v místě bodu (pro text „1 px ≈ … mm“)
  function mmNaPx(m, x, y) {
    if (!meritkoPlatne(m)) return null;
    const f = prevodnik(m), a = f(x, y), b = f(x + 1, y), c = f(x, y + 1);
    return Math.sqrt(Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])));
  }

  /* ---------- měření ---------- */
  function velicina(druh, p) {
    if (druh === 'delka') return vzd(p[0], p[1]);
    if (druh === 'uhel') {
      const u = Math.atan2(p[0][1] - p[1][1], p[0][0] - p[1][0]), v = Math.atan2(p[2][1] - p[1][1], p[2][0] - p[1][0]);
      let d = Math.abs(u - v) * 180 / Math.PI;
      return d > 180 ? 360 - d : d;
    }
    if (druh === 'plocha') {
      let s = 0;
      for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
      return Math.abs(s) / 2;
    }
    return NaN;
  }
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

  /* změří anotaci druhu delka|uhel|plocha. Vrací { druh, hodnota, nejistota (2σ), jednotka: 'mm'|'mm2'|'px'|'px2'|'°' }.
     Nejistota = rozptyl výsledku při náhodném posunu všech klikaných bodů (měření i kalibrace) o σ = presnost px. */
  function zmer(a, m, o = {}) {
    if (!a || !MERENI.includes(a.druh) || !Array.isArray(a.b) || a.b.length < (a.druh === 'plocha' ? 3 : DRUHY[a.druh].b)) return null;
    const kal = meritkoPlatne(m) ? m : null;
    const sigma = cislo(o.presnost) ? o.presnost : kal && cislo(kal.presnost) ? kal.presnost : 1.5;
    const spocti = (body, kb) => {
      if (!kal || a.druh === 'uhel' && kal.druh === 'delka') return velicina(a.druh, body);
      const f = prevodnik(kal, kb);
      return f ? velicina(a.druh, body.map(p => f(p[0], p[1]))) : NaN;
    };
    const hodnota = spocti(a.b, kal && kal.b);
    const n = o.vzorku || 400, r = rng(o.seed || 17), h = [];
    for (let i = 0; i < n; i++) {
      const sum = p => [p[0] + gauss(r) * sigma, p[1] + gauss(r) * sigma];
      const v = spocti(a.b.map(sum), kal && kal.b.map(sum));
      if (Number.isFinite(v)) h.push(v);
    }
    const pr = h.reduce((s, v) => s + v, 0) / (h.length || 1);
    const sd = Math.sqrt(h.reduce((s, v) => s + (v - pr) * (v - pr), 0) / Math.max(1, h.length - 1));
    const jednotka = a.druh === 'uhel' ? '°' : kal ? (a.druh === 'plocha' ? 'mm2' : 'mm') : (a.druh === 'plocha' ? 'px2' : 'px');
    return { druh: a.druh, hodnota, nejistota: 2 * sd, jednotka, sigma };
  }
  // „123,4 ± 1,2 mm“ – délky nad 1 m v metrech, plochy v cm² / m²
  function textMereni(z) {
    if (!z || !Number.isFinite(z.hodnota)) return '–';
    const s = (v, k, d, j) => fmt(v / k, d) + ' ± ' + fmt(z.nejistota / k, d) + ' ' + j;
    if (z.jednotka === '°') return s(z.hodnota, 1, 1, '°');
    if (z.jednotka === 'px') return s(z.hodnota, 1, 0, 'px');
    if (z.jednotka === 'px2') return s(z.hodnota, 1, 0, 'px²');
    if (z.jednotka === 'mm') return z.hodnota >= 1000 ? s(z.hodnota, 1000, 3, 'm') : s(z.hodnota, 1, 1, 'mm');
    return z.hodnota >= 1e6 ? s(z.hodnota, 1e6, 3, 'm²') : s(z.hodnota, 100, 1, 'cm²');
  }

  /* ---------- anotace ---------- */
  function nova(druh, body, vlastnosti) {
    const a = Object.assign({ id: noveId(), druh, b: body.map(p => [p[0], p[1]]) }, vlastnosti || {});
    if (druh === 'vyrez' && a.b.length === 2) {
      const [p, q] = a.b;
      a.b.push([Math.max(p[0], q[0]) + Math.abs(q[0] - p[0]) * 1.6, Math.min(p[1], q[1]) + Math.abs(q[1] - p[1]) * 0.5]);
      if (!cislo(a.k)) a.k = 2.5;
    }
    if (druh === 'zakryt' && !EFEKTY[a.efekt]) a.efekt = 'rozmazat';
    return a;
  }
  // kontrola a vyčištění anotací z úložiště nebo importu – neznámé a poškozené se vynechají
  function cisti(seznam) {
    if (!Array.isArray(seznam)) return [];
    const out = [];
    for (const a of seznam) {
      if (!a || typeof a !== 'object' || !DRUHY[a.druh] || !Array.isArray(a.b)) continue;
      const b = a.b.filter(p => Array.isArray(p) && cislo(p[0]) && cislo(p[1])).map(p => [p[0], p[1]]);
      const D = DRUHY[a.druh];
      if (D.b ? b.length !== D.b && !(a.druh === 'vyrez' && b.length === 2) : b.length < D.min) continue;
      const c = { id: typeof a.id === 'string' && /^[\w.:-]{1,60}$/.test(a.id) ? a.id : noveId(), druh: a.druh, b };
      if (a.druh === 'znacka') { if (typeof a.stopa === 'string') c.stopa = a.stopa.slice(0, 160); if (typeof a.cislo === 'string') c.cislo = a.cislo.slice(0, 20); }
      if (a.druh === 'text' || a.druh === 'sipka') { if (typeof a.text === 'string') c.text = a.text.slice(0, 500); }
      if (a.druh === 'text' && !c.text) continue;
      if (a.druh === 'vyrez') { c.k = cislo(a.k) ? Math.min(8, Math.max(1.2, a.k)) : 2.5; if (b.length === 2) { const n = nova('vyrez', b); c.b = n.b; } }
      if (a.druh === 'zakryt') c.efekt = EFEKTY[a.efekt] ? a.efekt : 'rozmazat';
      out.push(c);
    }
    return out;
  }
  function cistiMeritko(m) {
    if (!meritkoPlatne(m)) return null;
    const c = { druh: m.druh, b: m.b.map(p => [p[0], p[1]]) };
    if (m.druh === 'delka') c.mm = m.mm; else { c.w = m.w; c.h = m.h; }
    if (cislo(m.presnost) && m.presnost > 0 && m.presnost <= 50) c.presnost = m.presnost;
    return c;
  }
  function posun(a, dx, dy) { a.b = a.b.map(p => [p[0] + dx, p[1] + dy]); return a; }
  function obal(a) {
    const xs = a.b.map(p => p[0]), ys = a.b.map(p => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  function vzdOdUsecky(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function uvnitr(p, poly) {
    let in_ = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) in_ = !in_;
    }
    return in_;
  }
  /* zásah myší: { bod: i } (úchop), { telo: true } nebo null; tol v px obrázku; s = velikost písma/značky v px */
  function zasah(a, x, y, tol, s) {
    const p = [x, y];
    for (let i = 0; i < a.b.length; i++) if (vzd(p, a.b[i]) <= tol) return { bod: i };
    const r = s || 20;
    switch (a.druh) {
      case 'znacka': return vzd(p, a.b[0]) <= r ? { telo: true } : null;
      case 'text': { const [x0, y0] = a.b[0], w = (a.text || '').length * r * 0.6; return x >= x0 - tol && x <= x0 + w + tol && y >= y0 - r - tol && y <= y0 + tol ? { telo: true } : null; }
      case 'sipka': case 'delka': return vzdOdUsecky(p, a.b[0], a.b[1]) <= tol ? { telo: true } : null;
      case 'uhel': return vzdOdUsecky(p, a.b[0], a.b[1]) <= tol || vzdOdUsecky(p, a.b[1], a.b[2]) <= tol ? { telo: true } : null;
      case 'plocha': return uvnitr(p, a.b) || a.b.some((q, i) => vzdOdUsecky(p, q, a.b[(i + 1) % a.b.length]) <= tol) ? { telo: true } : null;
      case 'kruh': {
        const [x0, y0, x1, y1] = obal({ b: a.b.slice(0, 2) }), rx = (x1 - x0) / 2 || 1, ry = (y1 - y0) / 2 || 1;
        const d = Math.hypot((x - x0 - rx) / rx, (y - y0 - ry) / ry);
        return Math.abs(d - 1) * Math.min(rx, ry) <= tol ? { telo: true } : null;
      }
      case 'vyrez': {
        const l = lupa(a);
        if (x >= l[0] && x <= l[2] && y >= l[1] && y <= l[3]) return { telo: true, lupa: true };
      }
      // fall through – výřez i ostatní obdélníky: zásah uvnitř
      default: {
        const [x0, y0, x1, y1] = obal({ b: a.b.slice(0, 2) });
        return x >= x0 - tol && x <= x1 + tol && y >= y0 - tol && y <= y1 + tol ? { telo: true } : null;
      }
    }
  }
  // obdélník lupy výřezu (zvětšený výřez se středem v b[2])
  function lupa(a) {
    const [x0, y0, x1, y1] = obal({ b: a.b.slice(0, 2) }), w = (x1 - x0) * a.k, h = (y1 - y0) * a.k, [cx, cy] = a.b[2];
    return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
  }

  /* ---------- Zpět / Znovu (snímky stavu jako JSON) ---------- */
  function historie(max = 100) {
    const zpet = [], znovu = [];
    return {
      zapis(stav) { const s = JSON.stringify(stav); if (zpet[zpet.length - 1] === s) return; zpet.push(s); if (zpet.length > max) zpet.shift(); znovu.length = 0; },
      zpet(aktualni) { if (!zpet.length) return null; znovu.push(JSON.stringify(aktualni)); return JSON.parse(zpet.pop()); },
      znovu(aktualni) { if (!znovu.length) return null; zpet.push(JSON.stringify(aktualni)); return JSON.parse(znovu.pop()); },
      get lzeZpet() { return zpet.length > 0; }, get lzeZnovu() { return znovu.length > 0; },
      vymaz() { zpet.length = 0; znovu.length = 0; }
    };
  }

  /* ---------- EXIF ----------
     čtení převzaté z foto_meritka/jadro.js (FOTOMER.ctiExif, exifCas) → údaje, které se ukládají do entity foto */
  function fotomer() { return koren.FOTOMER || (typeof require === 'function' ? require('../foto_meritka/jadro.js') : null); }
  function exifZBajtu(buf) {
    const F = fotomer(), e = F && F.ctiExif(buf);
    if (!e) return null;
    const o = { kdy: F.exifCas(e.datum), pristroj: e.model || undefined, orientace: e.orientace || undefined,
      ohnisko: e.ohnisko || undefined, ohnisko35: e.ohnisko35 || undefined, lat: e.lat == null ? undefined : +e.lat.toFixed(6), lon: e.lon == null ? undefined : +e.lon.toFixed(6),
      sirka: e.sirka || undefined, vyska: e.vyska || undefined, objektiv: F.popisObjektivu(e) || undefined };
    for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === null) delete o[k];
    return Object.keys(o).length ? o : null;
  }
  const ORIENTACE = { 1: 'normální', 2: 'zrcadlení vodorovně', 3: 'otočeno o 180°', 4: 'zrcadlení svisle', 5: 'zrcadlení + 90°', 6: 'otočeno o 90° vpravo', 7: 'zrcadlení + 270°', 8: 'otočeno o 90° vlevo' };

  /* ---------- pořadí snímků a fototabulka ---------- */
  const seradit = fotky => fotky.slice().sort((a, b) => (cislo(a.data.poradi) ? a.data.poradi : 1e9) - (cislo(b.data.poradi) ? b.data.poradi : 1e9)
    || String(a.data.kdy || '').localeCompare(String(b.data.kdy || '')) || String(a.vytvoreno || '').localeCompare(String(b.vytvoreno || '')));
  const dalsiPoradi = fotky => fotky.reduce((m, f) => Math.max(m, cislo(f.data.poradi) ? f.data.poradi : 0), 0) + 1;
  const cisloStopy = (z, stopy) => { const s = stopy[z.stopa]; return s ? String(s.data.cislo || '?') : (z.cislo || '?'); };

  /* data fototabulky: pripad, fotky (entity foto), stopy (entity stopa) → titul + očíslované snímky
     s odkazy na stopy, výsledky měření a odkazy přehled → detail (snímky stejné stopy) */
  function fototabulka(pripad, fotky, stopy, o = {}) {
    const mapaStop = Object.fromEntries((stopy || []).map(s => [s.id, s]));
    const serazene = seradit(fotky || []);
    const snimky = serazene.map((f, i) => {
      const an = cisti(f.data.anotace), m = cistiMeritko(f.data.meritko);
      const znacky = an.filter(a => a.druh === 'znacka');
      const cisla = [...new Set(znacky.map(z => cisloStopy(z, mapaStop)))].sort((a, b) => a.localeCompare(b, 'cs', { numeric: true }));
      return {
        cislo: i + 1, id: f.id, nazev: f.nazev, typ: f.data.typ || '', typNazev: TYPY_SNIMKU[f.data.typ] || '', popis: f.data.popis || '',
        kdy: f.data.kdy || (f.data.exif && f.data.exif.kdy) || '', autor: f.data.autor || '', sha256: f.data.sha256 || '',
        stopy: cisla, stopyId: [...new Set(znacky.map(z => z.stopa).filter(Boolean))],
        meritko: m ? (m.druh === 'delka' ? 'kalibrace délkou ' + fmt(m.mm, 0) + ' mm' : 'srovnání perspektivy obdélníkem ' + fmt(m.w, 0) + ' × ' + fmt(m.h, 0) + ' mm') : '',
        mereni: an.filter(a => MERENI.includes(a.druh)).map(a => ({ nazev: DRUHY[a.druh].n, text: textMereni(zmer(a, m, { vzorku: o.vzorku })) })),
        detaily: []
      };
    });
    // přehledový / orientační snímek → detailní snímky týchž stop
    for (const s of snimky) {
      if (s.typ === 'detail') continue;
      for (const c of s.stopy) {
        const det = snimky.filter(d => d !== s && d.typ === 'detail' && d.stopy.includes(c)).map(d => d.cislo);
        if (det.length) s.detaily.push({ stopa: c, snimky: det });
      }
    }
    const casy = snimky.map(s => s.kdy).filter(Boolean).sort();
    return {
      titul: { cislo: (pripad && pripad.cislo) || '', nazev: (pripad && pripad.nazev) || '', popis: (pripad && pripad.popis) || '',
        autor: o.autor || [...new Set(snimky.map(s => s.autor).filter(Boolean))].join(', '), pocet: snimky.length,
        od: casy[0] || '', do: casy[casy.length - 1] || '', vyhotoveno: o.vyhotoveno || '' },
      snimky
    };
  }

  /* vazby foto → stopa (tyka_se, popis POPIS_VAZBY) podle značek ve fotce; S = SPIS (async API) */
  const POPIS_VAZBY = 'značka ve fotce';
  async function synchronizujVazby(S, f, anot, nastroj) {
    const chci = new Set((anot || []).filter(z => z.druh === 'znacka' && z.stopa).map(z => z.stopa));
    const vz = (await S.vazby(f.id)).filter(v => v.od === f.id && v.typ === 'tyka_se' && v.popis === POPIS_VAZBY);
    for (const v of vz) if (!chci.has(v.do)) await S.smaz(v.id, { nastroj: nastroj || NASTROJ });
    const mam = new Set(vz.map(v => v.do));
    for (const id of chci) {
      if (mam.has(id)) continue;
      const st = await S.entita(id);
      if (st && !st.smazano && st.pripad === f.pripad) await S.vazba(f.id, id, 'tyka_se', { popis: POPIS_VAZBY, nastroj: nastroj || NASTROJ });
    }
  }

  const API = {
    KLIC_AUTOR, NASTROJ, POPIS_VAZBY, synchronizujVazby, TYPY_SNIMKU, DRUHY, EFEKTY, MERENI, ORIENTACE,
    homografie, aplikujH, meritkoPlatne, prevodnik, mmNaPx, velicina, zmer, textMereni, rng, gauss,
    nova, cisti, cistiMeritko, posun, obal, zasah, lupa, vzdOdUsecky, historie, kopie, fmt,
    exifZBajtu, seradit, dalsiPoradi, fototabulka
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.FOTODOK = API;
})(typeof window !== 'undefined' ? window : globalThis);
