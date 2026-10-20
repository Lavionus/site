/* ============================================================
   Sluneční hodiny – styly ciferníku (bez DOM)
   Styl = sada parametrů: písmo (OFL z obsah/fonty), tloušťky a konce čar, barvy vrstev,
   rámeček, ornament, číslice a doplňky. Ornamenty se kreslí vektorově (prvky scény, osa y nahoru).
   Barvy platí pro samotný ciferník (předmět), nezávisle na tématu stránky.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;

  // písma: soubor v obsah/fonty (+ fonty/js/<soubor>.js pro vložení do PDF/SVG), kSirka = šířka proti Liberation Sans
  const PISMA = {
    cinzel: { soubor: 'CinzelDecorative-Bold.ttf', rodina: 'SH Cinzel Decorative', kSirka: 1.16, chybi: '' },
    marcellus: { soubor: 'Marcellus-Regular.ttf', rodina: 'SH Marcellus', kSirka: 0.95, chybi: '' },
    fondamento: { soubor: 'Fondamento-Regular.ttf', rodina: 'SH Fondamento', kSirka: 0.96, chybi: '' },
    righteous: { soubor: 'Righteous-Regular.ttf', rodina: 'SH Righteous', kSirka: 0.96, chybi: '' },
    spacemono: { soubor: 'SpaceMono-Bold.ttf', rodina: 'SH Space Mono', kSirka: 1.34, chybi: '' },
    titan: { soubor: 'TitanOne-Regular.ttf', rodina: 'SH Titan One', kSirka: 1.09, chybi: '' },
    fjalla: { soubor: 'FjallaOne-Regular.ttf', rodina: 'SH Fjalla One', kSirka: 0.81, chybi: '' },
  };

  const CERNA = { obrys: '#000000', ram: '#000000', hodiny: '#000000', pul: '#222222', ctvrt: '#222222', datum: '#1f5fa8', cisla: '#000000', dst: '#b3261e', text: '#000000', ornament: '#000000', deska: null };
  const S = (o) => Object.assign({ kCara: 1, ram: 'zadny', okrajK: 1, otacet: false, puldot: false, konce: 'round', barvy: {} }, o, { barvy: Object.assign({}, CERNA, o.barvy || {}) });

  const STYLY = {
    klasicky: S({ nazev: 'Klasický', popis: 'dvojitý rám, otočená čísla', kCara: 1.5, ram: 'dvojity', otacet: true, puldot: true }),
    minimalni: S({ nazev: 'Minimální', popis: 'tenké čáry, bez rámu' }),
    barokni: S({
      nazev: 'Barokní', popis: 'perlový rám, slunce s tváří, římské číslice', pismo: 'cinzel', kCara: 1.6, ram: 'barok', okrajK: 2.4, otacet: true, puldot: true,
      ornament: 'slunce', cislice: 'rimske', mottoPas: true,
      barvy: { deska: '#f3e7c6', obrys: '#3b2412', ram: '#3b2412', hodiny: '#3b2412', pul: '#5a3a1e', ctvrt: '#5a3a1e', cisla: '#3b2412', dst: '#9b2a1a', datum: '#7a4a12', text: '#3b2412', ornament: '#b8862b' },
    }),
    renesancni: S({
      nazev: 'Renesanční kámen', popis: 'tesaný vzhled, latinské znaky zvěrokruhu', pismo: 'marcellus', kCara: 1.7, ram: 'kamen', okrajK: 1.8, otacet: true, konce: 'butt',
      cislice: 'rimske', latina: true, datum: 'znameni', ornament: 'ruzice',
      barvy: { deska: '#d8d2c4', obrys: '#2f2b26', ram: '#4a453d', hodiny: '#2f2b26', pul: '#4a453d', ctvrt: '#4a453d', cisla: '#2f2b26', dst: '#7a2e22', datum: '#3d4f5c', text: '#2f2b26', ornament: '#6d655a' },
    }),
    namorni: S({
      nazev: 'Námořní', popis: 'růžice větrů, stupnice azimutu, mosaz', pismo: 'fondamento', kCara: 1.3, ram: 'stupnice', okrajK: 2.6, otacet: true,
      ornament: 'vetrna',
      barvy: { deska: '#e3c37a', obrys: '#2b2110', ram: '#2b2110', hodiny: '#2b2110', pul: '#4a3a1a', ctvrt: '#4a3a1a', cisla: '#2b2110', dst: '#7a1f1f', datum: '#1f3f6a', text: '#2b2110', ornament: '#7a1f1f' },
    }),
    artdeco: S({
      nazev: 'Art deco', popis: 'geometrické paprsky, zlato na tmavé', pismo: 'righteous', kCara: 0.8, ram: 'deco', okrajK: 1.8, konce: 'butt',
      ornament: 'paprsky', cislice: 'arabske',
      barvy: { deska: '#14213d', obrys: '#e5c158', ram: '#e5c158', hodiny: '#e5c158', pul: '#c9a94a', ctvrt: '#c9a94a', cisla: '#f4e3a6', dst: '#f28f6b', datum: '#9ec9e2', text: '#f4e3a6', ornament: '#e5c158' },
    }),
    technicky: S({
      nazev: 'Technický', popis: 'milimetrové měřítko, čáry po 5 min, údaje o poloze', pismo: 'spacemono', kCara: 0.7, ram: 'mm', okrajK: 1.6, konce: 'butt',
      minuty: true, udaje: true, tabulka: true, cislice: 'arabske',
      barvy: { deska: '#ffffff', obrys: '#111111', ram: '#111111', hodiny: '#111111', pul: '#333333', ctvrt: '#555555', cisla: '#111111', dst: '#c0392b', datum: '#0a5fb4', text: '#111111' },
    }),
    detsky: S({
      nazev: 'Dětský', popis: 'barevné výseče, „poledne“, sluníčko', pismo: 'titan', kCara: 2, ram: 'jednoduchy', okrajK: 1.3,
      vysece: true, popisPoledne: true, ikony: true, cislice: 'arabske', velkaCisla: 1.15,
      barvy: { deska: '#fffdf2', obrys: '#2b3a55', ram: '#2b3a55', hodiny: '#2b3a55', pul: '#5c6b85', ctvrt: '#5c6b85', cisla: '#e4572e', dst: '#2e86de', datum: '#27ae60', text: '#2b3a55', ornament: '#f5a623', vysecDop: '#ffe7a3', vysecOdp: '#cfe6ff' },
    }),
    laser: S({
      nazev: 'Laser / gravír', popis: 'jen čáry, bez výplní, černě', kCara: 1, ram: 'jednoduchy', otacet: true, laser: true,
      barvy: { datum: '#000000', dst: '#000000', pul: '#000000', ctvrt: '#000000' },
    }),
    dlazdice: S({
      nazev: 'Keramická dlaždice', popis: 'čtverec, kobaltová modř, silné linky', pismo: 'fjalla', kCara: 2.2, ram: 'dlazdice', okrajK: 2.2, ctverec: true, konce: 'square',
      barvy: { deska: '#ffffff', obrys: '#0b2a4a', ram: '#0b2a4a', hodiny: '#0b2a4a', pul: '#0b2a4a', ctvrt: '#0b2a4a', cisla: '#0b2a4a', dst: '#0b2a4a', datum: '#2f6ea8', text: '#0b2a4a', ornament: '#2f6ea8' },
    }),
  };
  const ZNAMENI_LAT = ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORNUS', 'AQUARIUS', 'PISCES'];

  /** styl podle id (s uživatelskými barvami z p) */
  function styl(p) {
    const s = STYLY[p && p.styl] || STYLY.klasicky, b = Object.assign({}, s.barvy);
    if (p && p.barvaDeska) b.deska = p.barvaDeska;
    if (p && p.barvaCary) for (const k of ['obrys', 'ram', 'hodiny', 'pul', 'ctvrt', 'cisla', 'text']) b[k] = p.barvaCary;
    if (p && p.barvaAkcent) for (const k of ['datum', 'dst', 'ornament']) b[k] = p.barvaAkcent;
    if (s.laser) for (const k of Object.keys(b)) b[k] = k === 'deska' ? null : '#000000';
    return Object.assign({}, s, { id: STYLY[p && p.styl] ? p.styl : 'klasicky', barvy: b, pismoInfo: s.pismo ? PISMA[s.pismo] : null });
  }

  /* ---------------- ornamenty (prvky v rovině, y nahoru) ---------------- */
  const pol = (cx, cy, r, a) => [cx + r * Math.cos(a * RAD), cy + r * Math.sin(a * RAD)];
  function ornament(druh, cx, cy, r, st, s, sever) {
    const b = st.barvy, o = [], cOrn = b.ornament || '#000', cD = b.deska || '#ffffff';
    const P = (body, c) => o.push({ t: 'p', b: body, v: 'ornament', f: true, c });
    const L = (body, w, c, z) => o.push({ t: 'l', b: body, s: w || s, v: 'ornament', c, z });
    const K = (x, y, rr, f, c, w) => o.push({ t: 'k', x, y, r: rr, s: w || s, v: 'ornament', f, c });
    if (druh === 'slunce') {
      for (let i = 0; i < 16; i++) {
        const a = i * 22.5, dl = i % 2 ? r * 0.78 : r, sir = i % 2 ? 7 : 9;
        P([pol(cx, cy, r * 0.5, a - sir), pol(cx, cy, dl, a), pol(cx, cy, r * 0.5, a + sir)], cOrn);
      }
      K(cx, cy, r * 0.5, true, cOrn); K(cx, cy, r * 0.5, false, b.ram, s * 0.8);
      // tvář: oči, nos, úsměv
      K(cx - r * 0.17, cy + r * 0.12, r * 0.06, true, b.ram); K(cx + r * 0.17, cy + r * 0.12, r * 0.06, true, b.ram);
      L([[cx, cy + r * 0.08], [cx - r * 0.04, cy - r * 0.08], [cx + r * 0.03, cy - r * 0.09]], s * 0.7, b.ram);
      const us = []; for (let a = 200; a <= 340; a += 10) us.push(pol(cx, cy, r * 0.28, a));
      L(us, s * 0.8, b.ram);
    } else if (druh === 'ruzice') {
      for (let i = 0; i < 8; i++) {
        // okvětní lístek: čočka podél paprsku, polovina šířky = 0,22 r · sin(π x / r)
        const a = i * 45, ca = Math.cos(a * RAD), sa = Math.sin(a * RAD), hore = [], dole = [];
        for (let k = 0; k <= 16; k++) { const x = r * 0.95 * k / 16, w = r * 0.22 * Math.sin(Math.PI * k / 16); hore.push([cx + x * ca - w * sa, cy + x * sa + w * ca]); dole.push([cx + x * ca + w * sa, cy + x * sa - w * ca]); }
        P(hore.concat(dole.reverse()), i % 2 ? b.ornament : b.ram);
      }
      K(cx, cy, r * 0.18, true, cD); K(cx, cy, r * 0.18, false, b.ram, s * 0.8);
      K(cx, cy, r * 1.05, false, b.ram, s * 0.6);
    } else if (druh === 'vetrna') {
      K(cx, cy, r * 1.04, false, b.ram, s * 0.6); K(cx, cy, r * 0.62, false, b.ram, s * 0.4);
      for (let i = 0; i < 8; i++) {
        const a = 90 - i * 45, dl = i % 2 ? r * 0.62 : r, sir = i % 2 ? r * 0.1 : r * 0.16;
        const tip = pol(cx, cy, dl, a), l = pol(cx, cy, sir, a + 45), p2 = pol(cx, cy, sir, a - 45);
        P([[cx, cy], tip, l], i % 2 ? b.ram : cOrn); P([[cx, cy], tip, p2], cD);
        L([[cx, cy], tip, p2, [cx, cy], l, tip], s * 0.5, b.ram);
      }
      if (sever) o.push({ t: 'txt', x: cx, y: cy + r * 1.22, txt: 'S', h: r * 0.32, a: 'c', u: 0, v: 'ornament', c: cOrn });
    } else if (druh === 'paprsky') {
      for (let i = 0; i < 36; i++) { const a = i * 10, d0 = r * 0.3, d1 = i % 3 === 0 ? r : i % 3 === 1 ? r * 0.72 : r * 0.55; L([pol(cx, cy, d0, a), pol(cx, cy, d1, a)], s * (i % 3 === 0 ? 0.9 : 0.5), cOrn); }
      for (const k of [0.2, 0.26]) K(cx, cy, r * k, false, cOrn, s * 0.6);
    } else if (druh === 'slunicko') {
      K(cx, cy, r * 0.45, true, cOrn);
      for (let i = 0; i < 10; i++) { const a = i * 36; L([pol(cx, cy, r * 0.6, a), pol(cx, cy, r, a)], s * 1.4, cOrn); }
      K(cx - r * 0.15, cy + r * 0.1, r * 0.06, true, '#2b3a55'); K(cx + r * 0.15, cy + r * 0.1, r * 0.06, true, '#2b3a55');
      const us = []; for (let a = 205; a <= 335; a += 10) us.push(pol(cx, cy, r * 0.25, a)); L(us, s * 0.9, '#2b3a55');
    }
    return o;
  }

  /** prvky rámečku podle stylu; obr = obrys desky {tvar:'kruh', r} | {tvar:'obd', a, b} (střed 0,0) */
  function ram(druh, obr, okraj, st, s) {
    const o = [], b = st.barvy;
    const L = (body, w, v, z, c) => o.push({ t: 'l', b: body, s: w, v: v || 'ram', z, c });
    const K = (rr, w, f, c, x, y) => o.push({ t: 'k', x: x || 0, y: y || 0, r: rr, s: w, v: 'ram', f, c });
    const kruh = obr.tvar === 'kruh';
    const obd = (k) => [[-obr.a + k, -obr.b + k], [obr.a - k, -obr.b + k], [obr.a - k, obr.b - k], [-obr.a + k, obr.b - k]];
    const linka = (k, w) => (kruh ? K(obr.r - k, w) : L(obd(k), w, 'ram', true));
    // bod na obvodu ve vzdálenosti k od okraje ve směru úhlu a (od středu)
    const naOkraji = (a, k) => {
      const dx = Math.sin(a * RAD), dy = Math.cos(a * RAD);
      if (kruh) return [dx * (obr.r - k), dy * (obr.r - k)];
      const t = Math.min(Math.abs(dx) > 1e-9 ? (obr.a - k) / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? (obr.b - k) / Math.abs(dy) : Infinity);
      return [dx * t, dy * t];
    };
    if (druh === 'dvojity') { linka(okraj * 0.6, s * 0.7); }
    else if (druh === 'jednoduchy') linka(okraj * 0.55, s * 0.8);
    else if (druh === 'barok') {
      linka(okraj * 0.18, s * 1.2); linka(okraj * 0.82, s * 0.7);
      const kr = okraj * 0.12;
      if (kruh) { const n = Math.max(24, Math.round(2 * Math.PI * (obr.r - okraj * 0.5) / (okraj * 0.45))); for (let i = 0; i < n; i++) { const q = naOkraji(i * 360 / n, okraj * 0.5); K(kr, 0, true, b.ornament, q[0], q[1]); } }
      else for (const [x0, y0, x1, y1] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
        const A = [x0 * (obr.a - okraj * 0.5), y0 * (obr.b - okraj * 0.5)], B = [x1 * (obr.a - okraj * 0.5), y1 * (obr.b - okraj * 0.5)];
        const n = Math.max(4, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / (okraj * 0.45)));
        for (let i = 0; i < n; i++) K(kr, 0, true, b.ornament, A[0] + (B[0] - A[0]) * i / n, A[1] + (B[1] - A[1]) * i / n);
      }
    } else if (druh === 'kamen') {
      linka(okraj * 0.25, s * 1.6); linka(okraj * 0.45, s * 0.5); linka(okraj * 0.9, s * 0.9);
    } else if (druh === 'stupnice') {
      linka(okraj * 0.12, s * 0.9); linka(okraj * 0.62, s * 0.6);
      for (let a = 0; a < 360; a += 5) {
        const dl = a % 30 === 0 ? 0.5 : a % 10 === 0 ? 0.32 : 0.2;
        L([naOkraji(a, okraj * 0.62), naOkraji(a, okraj * (0.62 - dl * 0.9))], s * (a % 10 ? 0.4 : 0.6));
        if (a % 30 === 0) { const q = naOkraji(a, okraj * 0.34); o.push({ t: 'txt', x: q[0], y: q[1], txt: String(a), h: okraj * 0.26, a: 'c', u: -a, v: 'ram' }); }
      }
    } else if (druh === 'deco') {
      linka(okraj * 0.15, s * 1.6); linka(okraj * 0.4, s * 0.5); linka(okraj * 0.55, s * 0.5);
      for (let a = 0; a < 360; a += 30) L([naOkraji(a, okraj * 0.6), naOkraji(a, okraj * 0.95)], s * 1.2);
      if (!kruh) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const k = okraj * 0.9, x = sx * (obr.a - k), y = sy * (obr.b - k);
        L([[x, y], [x + sx * k * 0.5, y], [x + sx * k * 0.5, y + sy * k * 0.5], [x, y + sy * k * 0.5]], s * 0.6, 'ram', true);
      }
    } else if (druh === 'mm') {
      linka(okraj * 0.08, s * 0.6);
      // milimetrové měřítko podél obvodu
      if (kruh) {
        const rr = obr.r - okraj * 0.08, n = Math.floor(2 * Math.PI * rr);
        for (let i = 0; i < n; i++) { const a = i / rr / RAD, dl = i % 10 === 0 ? 0.55 : i % 5 === 0 ? 0.38 : 0.22; L([naOkraji(a, okraj * 0.08), naOkraji(a, okraj * (0.08 + dl))], s * (i % 10 ? 0.3 : 0.5)); }
      } else for (const strana of [0, 1, 2, 3]) {
        const vod = strana % 2 === 0, del = vod ? 2 * obr.a : 2 * obr.b, z = strana < 2 ? 1 : -1;
        for (let i = 0; i <= Math.floor(del); i++) {
          const dl = (i % 10 === 0 ? 0.55 : i % 5 === 0 ? 0.38 : 0.22) * okraj, k0 = okraj * 0.08;
          if (vod) { const x = -obr.a + i, y = z * (obr.b - k0); L([[x, y], [x, y - z * dl]], s * (i % 10 ? 0.3 : 0.5)); }
          else { const y = -obr.b + i, x = z * (obr.a - k0); L([[x, y], [x - z * dl, y]], s * (i % 10 ? 0.3 : 0.5)); }
        }
      }
      linka(okraj * 0.72, s * 0.5);
    } else if (druh === 'dlazdice') {
      linka(okraj * 0.12, s * 2.2); linka(okraj * 0.75, s * 0.7);
      if (!kruh) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const cx = sx * (obr.a - okraj * 0.12), cy = sy * (obr.b - okraj * 0.12), b0 = Math.atan2(-sy, -sx) / RAD;
        for (const k of [0.45, 0.62]) { const ob = []; for (let a = -45; a <= 45; a += 5) ob.push(pol(cx, cy, okraj * k, b0 + a)); L(ob, s * 0.9, 'ornament', false, b.ornament); }
        o.push({ t: 'k', x: cx + Math.cos(b0 * RAD) * okraj * 0.25, y: cy + Math.sin(b0 * RAD) * okraj * 0.25, r: okraj * 0.08, s: 0, v: 'ornament', f: true, c: b.ornament });
      }
    }
    return o;
  }

  /** pro laser: výplně → obrysy, všechno černě */
  function naLaser(prvky) {
    return prvky.map((e) => {
      const f = Object.assign({}, e); delete f.c;
      if (e.t === 'p') { f.t = 'l'; f.z = true; f.s = 0.2; delete f.f; }
      if (e.t === 'k' && e.f) { f.f = false; f.s = Math.max(0.15, Math.min(0.25, e.r * 0.5)); }
      if (e.t === 'l' && e.f) { delete f.f; f.s = 0.2; }
      if (e.t === 'l') f.s = Math.max(e.v === 'obrys' ? 0.1 : 0.2, Math.min(0.6, f.s || 0.2));
      return f;
    }).filter((e) => e.v !== 'vypln' && e.v !== 'vysec');
  }

  const API = { STYLY, PISMA, styl, ornament, ram, naLaser, ZNAMENI_LAT };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SHStyly = API;
})(typeof window !== 'undefined' ? window : globalThis);
