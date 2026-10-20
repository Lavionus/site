/* ============================================================
   Ostření dlát a hoblíků – výpočetní jádro (bez DOM)
   Jednotky mm a stupně. Export: window.OSTR i module.exports.

   Geometrie honovacího vozíku (bok, rovina kolmá na osu válečku):
     svět: plocha, po které jede váleček, je y = 0, broušená plocha kamene y = s,
           střed válečku C = (0, r), nůž míří k +x.
     rám vozíku: počátek v ose válečku, x podél lože k čelu, z kolmo k loži (lože z = H).
     Nůž leží spodní plochou na loži (fazeta dolů), hřbet je v z = H + t, ostří E = (D, H + t),
     D = L + a (L = vyložení od čela vozíku, a = čelo vozíku od paty kolmice z osy).
     Natočení o úhel θ: u = (cos θ, −sin θ), n = (sin θ, cos θ), bod (x, z) → C + x·u + z·n.
     Podmínka E_y = s:   D·sin θ − (H + t)·cos θ = r − s
       → θ = atan2(H + t, D) + asin((r − s) / √(D² + (H + t)²))
       → D = (r − s + (H + t)·cos θ) / sin θ
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const r2 = (x) => Math.round(x * 100) / 100;
  const omez = (x, a, b) => Math.min(b, Math.max(a, x));
  const cislo = (x, v) => { const n = typeof x === 'string' ? parseFloat(x.replace(',', '.')) : +x; return isFinite(n) ? n : v; };

  /* ---------------- spojovací materiál (typické rozměry dle DIN/ISO) ---------------- */
  const SROUBY = {
    M4: { d: 4, otvor: 4.5, af: 7, hlava: 2.8, matice: 3.2, podlozka: 9 },
    M5: { d: 5, otvor: 5.5, af: 8, hlava: 3.5, matice: 4, podlozka: 10 },
    M6: { d: 6, otvor: 6.5, af: 10, hlava: 4, matice: 5, podlozka: 12 },
    M8: { d: 8, otvor: 8.5, af: 13, hlava: 5.3, matice: 6.5, podlozka: 16 },
  };
  const DELKY_SROUBU = [10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200];
  const delkaSroubu = (min) => DELKY_SROUBU.find((d) => d >= min - 1e-9) || Math.ceil(min / 10) * 10;
  const LOZISKO_608 = { D: 22, d: 8, B: 7 };
  const PODLOZKA_M8 = 1.6;

  /* ---------------- typické úhly (orientační, editovatelné) ---------------- */
  const POUZITI = {
    zelizko: { nazev: 'Želízko hoblíku – fazetou dolů (bevel-down)', primarni: 25, mikro: 30, sirka: 50, tloustka: 2.5, loze: 45, orientace: 'dolu', pozn: 'Běžné hoblíky typu Stanley/Bailey: lože 45°, fazeta 25° + mikrofazeta 30°. Vůle (lože − fazeta) má zůstat aspoň 10°.' },
    zelizkoBU: { nazev: 'Želízko – fazetou nahoru (low-angle, bevel-up)', primarni: 25, mikro: 30, sirka: 50, tloustka: 3.2, loze: 12, orientace: 'nahoru', pozn: 'Úhel řezu = lože + fazeta. Měkké dřevo a čela: 25–30°, tvrdé a vláknité dřevo 35–38° (řez 47–50°).' },
    dlato: { nazev: 'Dláto stolařské (ploché, se zkosenými hranami)', primarni: 25, mikro: 30, sirka: 20, tloustka: 4.5, pozn: 'Univerzální kompromis mezi ostrostí a odolností ostří při práci paličkou.' },
    odrezavaci: { nazev: 'Dláto odřezávací (paring)', primarni: 20, mikro: 25, sirka: 25, tloustka: 3.5, pozn: 'Jen tlak rukou, bez paličky – nižší úhel, čistý řez na čele.' },
    dlabaci: { nazev: 'Dláto dlabací (mortise)', primarni: 30, mikro: 35, sirka: 10, tloustka: 9, pozn: 'Údery paličkou a páčení – vyšší úhel, aby se ostří nevylamovalo.' },
    rezbarske: { nazev: 'Řezbářské dláto rovné / šikmé', primarni: 20, mikro: 25, sirka: 12, tloustka: 3, pozn: 'Do lípy a měkkého dřeva i 15–18°, do tvrdého 22–25°. Zaoblená (kanálková) dláta se brousí z ruky.' },
    nuz: { nazev: 'Nůž s rovným ostřím (řezbářský, na dýhy)', primarni: 15, mikro: 18, sirka: 20, tloustka: 2.5, oboustranne: true, pozn: 'Úhel na jednu stranu; oboustranné ostří má vrcholový úhel dvojnásobný. Ve vozíku jen nože s rovným hřbetem.' },
  };
  const DREVO = {
    mekke: { nazev: 'měkké (smrk, borovice, lípa, topol)', dUhel: -2 },
    stredni: { nazev: 'střední (olše, třešeň, ořech, modřín)', dUhel: 0 },
    tvrde: { nazev: 'tvrdé (dub, buk, jasan, javor)', dUhel: 3 },
    exoticke: { nazev: 'velmi tvrdé, exotické, suky, abrazivní', dUhel: 5 },
  };
  const OCEL = {
    uhlikova: { nazev: 'uhlíková nástrojová / O1', dUhel: 0 },
    A2: { nazev: 'A2 (při nízkém úhlu se vylamuje)', dUhel: 2 },
    pm: { nazev: 'PM-V11 a práškové oceli', dUhel: 0 },
    hss: { nazev: 'rychlořezná (HSS)', dUhel: 0 },
  };
  /** doporučené úhly: typická hodnota použití + korekce na dřevo a ocel (zaokrouhleno na 0,5°) */
  function doporuceneUhly(pouziti, drevo, ocel) {
    const P = POUZITI[pouziti] || POUZITI.zelizko, d = (DREVO[drevo] || DREVO.stredni).dUhel + (OCEL[ocel] || OCEL.uhlikova).dUhel;
    const z = (x) => Math.round(x * 2) / 2;
    const primarni = z(omez(P.primarni + d, 10, 45)), mikro = z(omez(P.mikro + d, primarni + 1, 50));
    return { primarni, mikro, pozn: P.pozn };
  }

  /* zrnitosti – orientační střední velikost zrna (FEPA P pro papíry, JIS pro japonské kameny) */
  const ZRNITOSTI = [
    { ozn: 'P120 / #120', um: 125, uziti: 'rovnání zadní strany silně poškozeného želízka, oprava vylomeného ostří' },
    { ozn: 'P220 / #220', um: 68, uziti: 'hrubé tvarování fazety, změna úhlu' },
    { ozn: 'P400 / #400', um: 35, uziti: 'dokončení tvaru fazety, odstranění rýh po brusce' },
    { ozn: 'P600 / #600–800', um: 25.8, uziti: 'přechod k jemnému broušení' },
    { ozn: 'P1000 / #1000', um: 18.3, uziti: 'hlavní „ostřicí“ zrnitost – vytvoří otřep po celé šířce' },
    { ozn: 'P2000 / #3000', um: 10.3, uziti: 'mikrofazeta, jemná pracovní ostrost' },
    { ozn: 'P2500+ / #4000–6000', um: 8.4, uziti: 'leštění mikrofazety a zadní strany' },
    { ozn: '#8000+ / pasta 0,5–1 µm', um: 1, uziti: 'zrcadlový lesk, obtahování na koženém řemeni s pastou' },
  ];
  /* barvy popouštění uhlíkové oceli (orientační) */
  const POPOUSTENI = [
    { barva: 'světle slámová', t: 220, hex: '#e9d9a0' },
    { barva: 'tmavě slámová', t: 240, hex: '#d2b05c' },
    { barva: 'hnědá', t: 255, hex: '#a9783b' },
    { barva: 'purpurová', t: 270, hex: '#8a4a7a' },
    { barva: 'modrá', t: 300, hex: '#3d5ea8' },
  ];

  /* ---------------- výchozí projekt ---------------- */
  function vychoziProjekt() {
    return {
      nazev: '',
      pouziti: 'zelizko', drevo: 'stredni', ocel: 'uhlikova',
      nuz: { sirka: 50, tloustka: 2.5 },
      uhly: { primarni: 25, mikro: 30, zadni: 0, seznam: '20, 25, 30, 35' },
      vylozeni: null,
      vozik: { valec: '608', pocetLozisek: 1, prumerKola: 30, prumerVlastni: 22, sirkaVlastni: 10, maxSirka: 64, maxTl: 10, vule: 0.5, uhelMax: 40, delkaLoze: 14, stenaLoze: 4, kalibrace: false, kalL: 40, kalUhel: 30 },
      kamen: { rezim: 'kamen', valecek: 'kamen', delka: 200, sirka: 65, vyska: 25 },
      bruska: { D: 150, Dmin: 120, mezera: 2, vyskaCepu: 20, sirkaOpery: 60, uhel: 25 },
      hoblik: { loze: 45, orientace: 'dolu', zadni: 0, pravitko: 0.5, pravitkoVzd: 50 },
      camber: { typ: 'hrubovaci', sirka: 50, prohnuti: 0.4 },
      uhlomer: { jednostranne: '15, 20, 25, 30, 35, 40, 45', oboustranne: '15, 20, 25', hloubka: 10 },
      tisk: { vt: 0.25, stul: 220, oznaceni: true, papir: 'a4', papirW: 210, papirH: 297, okraj: 8, kalibX: 100, kalibY: 100 },
    };
  }
  function slouc(P, u) {
    if (!u || typeof u !== 'object') return P;
    for (const k of Object.keys(P)) {
      if (u[k] == null) continue;
      if (P[k] && typeof P[k] === 'object' && !Array.isArray(P[k])) Object.assign(P[k], u[k]);
      else P[k] = u[k];
    }
    return P;
  }
  const seznamUhlu = (s) => [...new Set(String(s || '').split(/[;,\s]+/).map((x) => cislo(x, NaN)).filter((x) => isFinite(x) && x >= 5 && x <= 60).map((x) => Math.round(x * 10) / 10))];

  /* ---------------- geometrie vozíku: úhel ↔ vyložení ---------------- */
  /** g: {r, H, a, t, s} → úhel ostří (°) pro vyložení L (mm od čela vozíku); NaN mimo rozsah */
  function uhelZVylozeni(L, g) {
    const D = L + g.a, K = g.H + g.t, R = Math.hypot(D, K), q = (g.r - (g.s || 0)) / R;
    if (!(D > 0) || Math.abs(q) > 1) return NaN;
    return (Math.atan2(K, D) + Math.asin(q)) * DEG;
  }
  /** inverze: vyložení L pro úhel θ (°) */
  function vylozeniZUhlu(theta, g) {
    const u = theta * RAD, K = g.H + g.t;
    if (!(u > 0 && u < Math.PI / 2)) return NaN;
    return (g.r - (g.s || 0) + K * Math.cos(u)) / Math.sin(u) - g.a;
  }
  /** citlivost: změna úhlu na +1 mm vyložení, +1 mm tloušťky nože, +0,1 mm průměru válečku */
  function citlivost(L, g) {
    const t0 = uhelZVylozeni(L, g);
    return {
      naMmVylozeni: uhelZVylozeni(L + 1, g) - t0,
      naMmTloustky: uhelZVylozeni(L, Object.assign({}, g, { t: g.t + 1 })) - t0,
      naDesetinuPrumeru: uhelZVylozeni(L, Object.assign({}, g, { r: g.r + 0.05 })) - t0,
    };
  }
  /** kalibrace: z naměřeného úhlu při známém vyložení dopočítá skutečnou výšku lože H */
  function kalibrujH(L, theta, g) {
    const u = theta * RAD, D = L + g.a;
    return (D * Math.sin(u) - (g.r - (g.s || 0))) / Math.cos(u) - g.t;
  }
  /** rozměr fazety: délka fazety po šířce ostří (b = t / sin θ) */
  const delkaFazety = (t, theta) => t / Math.sin(theta * RAD);

  /** poloha vozíku ve světě pro úhel θ: transformace, ostří, kontakt válečku */
  function transformace(r, theta) {
    const u = theta * RAD, cu = Math.cos(u), su = Math.sin(u);
    return (x, z) => [x * cu + z * su, r - x * su + z * cu];
  }

  /* ---------------- segmentové písmo pro vyrytí (obdélníky) ---------------- */
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
    A: 'abcefg', B: 'cdefg', C: 'adef', D: 'bcdeg', E: 'adefg', F: 'aefg', H: 'bcefg', L: 'def', P: 'abefg', R: 'eg', T: 'defg', U: 'bcdef', V: 'cde', '-': 'g' };
  /** obdélníky [x0, y0, x1, y1] textu výšky h od (0, 0) vlevo dole; '.' = desetinná tečka */
  function segmentyTextu(text, h) {
    const wc = 0.58 * h, s = Math.max(0.8, 0.15 * h), mez = 0.36 * h, out = [];
    let x = 0;
    for (const ch of String(text).toUpperCase()) {
      if (ch === '.' || ch === ',') { out.push([x - mez * 0.3, 0, x - mez * 0.3 + s, s]); x += s + mez * 0.4; continue; }
      const sg = SEG[ch];
      if (sg) for (const q of sg) {
        const R = { a: [0, h - s, wc, h], d: [0, 0, wc, s], g: [0, h / 2 - s / 2, wc, h / 2 + s / 2], f: [0, h / 2 - s / 2, s, h], b: [wc - s, h / 2 - s / 2, wc, h], e: [0, 0, s, h / 2 + s / 2], c: [wc - s, 0, wc, h / 2 + s / 2] }[q];
        out.push([x + R[0], R[1], x + R[2], R[3]]);
      }
      x += (sg || ch === ' ' ? wc : 0) + mez;
    }
    return { obd: out, sirka: Math.max(0, x - mez), vyska: h };
  }
  const fmtCislo = (x) => String(Math.round(x * 10) / 10).replace(/\.0$/, '');
  /**
   * vyrytý text jako záporné hranoly: rovina 'xy' (horní plocha z = z0 dolů o hl),
   * 'xz' (boční plocha y = y0, do +y nebo −y podle smer), umístění vlevo dole (u0, v0), otočení (°)
   */
  function textPrim(txt, h, rovina, u0, v0, plocha, hl, smer, uhel) {
    const g = segmentyTextu(txt, h), c = Math.cos((uhel || 0) * RAD), s = Math.sin((uhel || 0) * RAD), out = [];
    const T = (u, v) => [u0 + u * c - v * s, v0 + u * s + v * c];
    for (const [a, b, cc, d] of g.obd) {
      const pts = [T(a, b), T(cc, b), T(cc, d), T(a, d)];
      if (rovina === 'xy') out.push({ t: 'deska', pts, od: plocha - hl, do: plocha + 1, text: true });
      else out.push({ t: 'prof', pts, od: smer > 0 ? plocha - 1 : plocha - hl, do: smer > 0 ? plocha + hl : plocha + 1, text: true });
    }
    return { prim: out, sirka: g.sirka };
  }

  const kruhBody = (cx, cy, r, a0, a1, n) => { const out = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * RAD; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return out; };
  const plochaPolygonu = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  const ccw = (p) => (plochaPolygonu(p) < 0 ? p.slice().reverse() : p);
  function konvexniObal(body) {
    const p = body.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), x = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const d = [], h = [];
    for (const q of p) { while (d.length >= 2 && x(d[d.length - 2], d[d.length - 1], q) <= 0) d.pop(); d.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (h.length >= 2 && x(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); }
    return d.slice(0, -1).concat(h.slice(0, -1));
  }
  const kontrola = (nazev, ok, hodnota, mez) => ({ nazev, ok: !!ok, hodnota: r2(hodnota), mez });

  /* ================================================================
     1) HONOVACÍ VOZÍK
     Funkční souřadnice dílu = rám vozíku (x k čelu, y napříč, z kolmo k loži, osa válečku v počátku).
     Tisk: tělo ložem dolů (otočení 180° kolem x) – lože je na tiskové podložce dokonale rovné,
     kapsy pro hlavy šroubů a drážka válečku jsou otevřené nahoru, jediný převis je osa → kapka.
     ================================================================ */
  function vozik(P) {
    const V = P.vozik, T = P.tisk, vt = omez(cislo(T.vt, 0.25), 0, 1), M6 = SROUBY.M6, M8 = SROUBY.M8;
    const pocet = omez(Math.round(cislo(V.pocetLozisek, 1)), 1, 2);
    let D, wr, kolo = null;
    if (V.valec === 'kolo') { D = omez(cislo(V.prumerKola, 30), 24, 60); wr = 7 * pocet; kolo = { D, sirka: wr, otvor: r2(LOZISKO_608.D + vt - 0.2) }; }
    else if (V.valec === 'vlastni') { D = omez(cislo(V.prumerVlastni, 22), 12, 60); wr = omez(cislo(V.sirkaVlastni, 10), 4, 40); }
    else { D = LOZISKO_608.D; wr = LOZISKO_608.B * pocet; }
    const r = D / 2, varovani = [], kontroly = [];
    const Wm = omez(cislo(V.maxSirka, 64), 6, 120), maxTl = omez(cislo(V.maxTl, 10), 1, 20), vule = omez(cislo(V.vule, 0.5), 0, 3);
    const osaOtvor = M8.otvor;
    let rh = osaOtvor / 2 + 3;
    if (rh > r - 1.5) { rh = r - 1.5; varovani.push('Malý průměr válečku – stěna kolem osy je tenká.'); }
    const mezeraValce = PODLOZKA_M8 + 0.4, ws = wr + 2 * mezeraValce;
    const zs = r + 1.5, tb = omez(cislo(V.stenaLoze, 4), 2, 10), H = zs + tb;
    const afp = M6.af + 2 * vt, cr = afp / Math.sqrt(3);
    const xs = osaOtvor / 2 + 2.5 + afp / 2;
    const lc = Math.max(14, M6.otvor + 7), tc = 8;
    const a = xs + lc / 2 + 2;
    const uMax = omez(cislo(V.uhelMax, 40), 20, 50) * RAD;
    const s = sKamene(P);
    let zf = (a * Math.sin(uMax) - r + Math.max(0, s) + 1.5) / Math.cos(uMax);
    zf = Math.max(zf, -rh + 1);
    if (H - zf < 4) { zf = H - 4; varovani.push(`Při úhlu ${r2(uMax * DEG)}° a výšce kamene ${r2(s)} mm nad dráhou válečku by čelo vozíku drhlo – čelo je zúžené na minimum; použijte nižší úhel nebo podložte dráhu válečku.`); }
    const xr = -(rh + omez(cislo(V.delkaLoze, 14), 0, 60));
    const oblouk = kruhBody(0, 0, rh, 180, 300, 16);
    const profil = ccw([[xr, H], [xr, 0]].concat(oblouk, [[a, zf], [a, H]]));
    const konec = oblouk[oblouk.length - 1];
    const zDna = (x) => {
      if (x <= -rh) return 0;
      if (x <= konec[0]) return -Math.sqrt(Math.max(0, rh * rh - x * x));
      return konec[1] + (zf - konec[1]) * (x - konec[0]) / (a - konec[0]);
    };
    const x0p = xs - afp / 2, x1p = xs + afp / 2;
    const zTop = Math.max(zDna(x0p), zDna(x1p)) + M6.hlava + 0.6;
    let ys = Wm / 2 + vule + M6.otvor / 2 + 1;
    const ysMin = ws / 2 + 2 + cr;
    if (ys < ysMin) ys = ysMin;
    const B = 2 * (ys + cr + 3);
    const sevreni = 2 * (ys - M6.otvor / 2);           // světlost mezi dříky šroubů
    const zuziti = { sirka: Math.min(18, 2 * (12 - 3)), hloubka: 0 };
    zuziti.hloubka = zuziti.sirka / 2;
    const tcV = 12;
    // délky šroubů
    const telaPodLozem = H - zTop;
    const delkaUpinaci = delkaSroubu(telaPodLozem + maxTl + tc + M6.matice + 3);
    const delkaUpinaciV = delkaSroubu(telaPodLozem + 2 + tcV + M6.matice + 3);
    const delkaOsy = delkaSroubu(B + PODLOZKA_M8 + M8.matice + 2);

    // kontroly konstrukce (testované)
    kontroly.push(kontrola('světlost čelistí ≥ max. šířka nože + 2 × vůle', sevreni >= Wm + 2 * vule - 1e-9, sevreni, Wm + 2 * vule));
    kontroly.push(kontrola('stěna mezi otvorem osy a kapsou hlavy ≥ 2 mm', x0p - osaOtvor / 2 >= 2 - 1e-9, x0p - osaOtvor / 2, 2));
    kontroly.push(kontrola('stěna nad kapsou šroubu (pod ložem) ≥ 3 mm', telaPodLozem >= 3, telaPodLozem, 3));
    kontroly.push(kontrola('stěna mezi kapsou a drážkou válečku ≥ 2 mm', ys - cr - ws / 2 >= 2 - 1e-9, ys - cr - ws / 2, 2));
    kontroly.push(kontrola('stěna lože nad válečkem ≥ 2 mm', tb >= 2, tb, 2));
    kontroly.push(kontrola('stěna kolem osy ≥ 2 mm', rh - osaOtvor / 2 >= 2 - 1e-9, rh - osaOtvor / 2, 2));
    kontroly.push(kontrola('váleček přečnívá pod tělo ≥ 1,5 mm', r - rh >= 1.5 - 1e-9, r - rh, 1.5));
    const g = { r, H, a, t: cislo(P.nuz.tloustka, 2.5), s };
    const vuleCela = vuleTela(profil, r, uMax * DEG, s);
    kontroly.push(kontrola(`tělo nedrhne o kámen do ${r2(uMax * DEG)}° (vůle ≥ 0,5 mm)`, vuleCela >= 0.5, vuleCela, 0.5));
    const stul = cislo(T.stul, 220);
    kontroly.push(kontrola('tělo se vejde na tiskovou plochu', Math.max(B, a - xr) <= stul, Math.max(B, a - xr), stul));

    // díly (funkční souřadnice)
    const dily = [];
    const mT = [];
    mT.push({ t: 'box', a: [-(r + 1.5), -ws / 2, -(r + 6)], b: [r + 1.5, ws / 2, zs] });          // drážka válečku
    mT.push({ t: 'val', osa: 'y', c: [0, -B / 2 - 1, 0], r: osaOtvor / 2, h: B + 2, slza: [0, 0, -1] }); // osa (kapka: tiskem dolů = −z)
    for (const y of [-ys, ys]) {
      mT.push({ t: 'val', osa: 'z', c: [xs, y, zTop - 1], r: M6.otvor / 2, h: H - zTop + 2 });
      mT.push({ t: 'hex', osa: 'z', c: [xs, y, Math.min(zDna(x0p), zf) - 10], af: afp, h: zTop - Math.min(zDna(x0p), zf) + 10, vrcholy: 'y' });
    }
    // středová ryska na loži a na čele (zarovnání úzkých dlát)
    mT.push({ t: 'box', a: [xr - 1, -0.35, H - 0.5], b: [a + 1, 0.35, H + 1], ryska: true });
    if (T.oznaceni !== false) {
      const txt = 'H' + fmtCislo(H) + ' A' + fmtCislo(a), hT = 5;
      const tp = textPrim(txt, hT, 'xz', 0, 0, 0, 0, 1);
      const sir = tp.sirka, u0 = (xr + a) / 2 - sir / 2, v0 = H - 2 - hT;
      if (sir < a - xr - 4 && v0 > zDna(u0 + sir) + 1.5 && v0 > 1) mT.push(...textPrim(txt, hT, 'xz', u0, v0, -B / 2, 0.6, 1).prim);
    }
    dily.push({ id: 'telo', nazev: 'Tělo vozíku', kusu: 1, material: 'PETG (nebo PLA+), 4 perimetry, výplň 40 %',
      tisk: 'ložem dolů (lože na podložce = rovná referenční plocha), bez podpěr; otvor osy má tvar kapky',
      rotTisk: [180, 0, 0],
      plus: [{ t: 'prof', osa: 'y', pts: profil, od: -B / 2, do: B / 2 }], minus: mT,
      koty: [
        { p: 'bok', a: [0, 0], b: [0, H], txt: 'H = ' + fmtCislo(H), str: 'l', o: xr - 6 },
        { p: 'bok', a: [0, H], b: [a, H], txt: 'a = ' + fmtCislo(a), str: 'h', o: H + 6 },
        { p: 'bok', a: [xr, H], b: [a, H], txt: fmtCislo(a - xr), str: 'h', o: H + 13 },
        { p: 'bok', a: [0, -r], b: [0, r], txt: 'Ø' + fmtCislo(D), str: 'p', o: a + 9, kruh: [0, 0, r] },
        { p: 'shora', a: [xs, -ys], b: [xs, ys], txt: fmtCislo(2 * ys), str: 'l', o: xr - 6 },
        { p: 'shora', a: [a, -B / 2], b: [a, B / 2], txt: fmtCislo(B), str: 'p', o: a + 8 },
        { p: 'shora', a: [a, -sevreni / 2], b: [a, sevreni / 2], txt: 'světlost ' + fmtCislo(sevreni), str: 'p', o: a + 18 },
      ] });
    const mS = [];
    for (const y of [-ys, ys]) mS.push({ t: 'val', osa: 'z', c: [xs, y, -1], r: M6.otvor / 2, h: tc + 2 });
    dily.push({ id: 'sverka', nazev: 'Svěrka (horní čelist)', kusu: 1, material: 'PETG / PLA, 100 % výplň nebo 6 perimetrů',
      tisk: 'naplocho, upínací plocha dolů', rotTisk: [0, 0, 0],
      plus: [{ t: 'box', a: [xs - lc / 2, -B / 2, 0], b: [xs + lc / 2, B / 2, tc] }], minus: mS,
      koty: [{ p: 'shora', a: [xs - lc / 2, -B / 2], b: [xs + lc / 2, -B / 2], txt: fmtCislo(lc), str: 'd', o: -B / 2 - 7 },
        { p: 'shora', a: [xs + lc / 2, -B / 2], b: [xs + lc / 2, B / 2], txt: fmtCislo(B), str: 'p', o: xs + lc / 2 + 8 },
        { p: 'shora', a: [xs, -ys], b: [xs, ys], txt: fmtCislo(2 * ys), str: 'l', o: xs - lc / 2 - 7 }] });
    const mV = mS.map((q) => Object.assign({}, q, { h: tcV + 2 }));
    const vv = zuziti.sirka / 2;
    mV.push({ t: 'prof', osa: 'x', pts: ccw([[-vv, -1], [vv, -1], [vv, 0], [0, vv], [-vv, 0]]), od: xs - lc / 2 - 1, do: xs + lc / 2 + 1 });
    dily.push({ id: 'sverkaV', nazev: `Svěrka s V-drážkou (úzká dláta ${4}–${fmtCislo(zuziti.sirka - 1)} mm)`, kusu: 1, material: 'PETG / PLA',
      tisk: 'V-drážkou nahoru (bez převisu)', rotTisk: [180, 0, 0],
      plus: [{ t: 'box', a: [xs - lc / 2, -B / 2, 0], b: [xs + lc / 2, B / 2, tcV] }], minus: mV,
      koty: [{ p: 'zepredu', a: [-vv, 0], b: [vv, 0], txt: 'V 90° ' + fmtCislo(zuziti.sirka), str: 'd', o: -7 }] });
    if (kolo) {
      const mK = [{ t: 'val', osa: 'z', c: [0, 0, -1], r: kolo.otvor / 2, h: wr + 2 }];
      dily.push({ id: 'kolo', nazev: `Kolečko Ø${fmtCislo(D)} na ložisko 608`, kusu: 1, material: 'PETG, 100 % výplň (průměr ovlivňuje úhel!)',
        tisk: 'naplocho; po tisku změřte průměr posuvkou a zadejte ho', rotTisk: [0, 0, 0],
        plus: [{ t: 'val', osa: 'z', c: [0, 0, 0], r: D / 2, h: wr }], minus: mK,
        koty: [{ p: 'shora', a: [-D / 2, 0], b: [D / 2, 0], txt: 'Ø' + fmtCislo(D), str: 'd', o: -D / 2 - 6 }] });
      kontroly.push(kontrola('věnec kolečka kolem ložiska ≥ 2 mm', (D - kolo.otvor) / 2 >= 2, (D - kolo.otvor) / 2, 2));
    }
    const kusovnik = [
      { pol: 'Kuličkové ložisko 608 (22 × 8 × 7)', ks: V.valec === 'vlastni' ? 0 : pocet, pozn: V.valec === 'kolo' ? 'nalisovat do kolečka' : 'samo tvoří váleček Ø22' },
      { pol: `Šroub M8 × ${delkaOsy} (osa, ideálně s hladkou částí dříku)`, ks: 1, pozn: 'nebo závitová tyč M8 + 2 matice' },
      { pol: 'Matice M8 samojistná (DIN 985)', ks: 1, pozn: 'utáhnout jen tak, aby se váleček volně točil' },
      { pol: 'Podložka M8 (DIN 125, tl. 1,6)', ks: 2 + 2, pozn: '2 vedle válečku (vymezení), 2 pod hlavu a matici' },
      { pol: `Šroub M6 × ${delkaUpinaci} se šestihrannou hlavou (DIN 933)`, ks: 2, pozn: 'hlava v kapse pod tělem, nepootočí se' },
      { pol: 'Matice M6 křídlová (DIN 315) nebo rýhovaná', ks: 2, pozn: 'utahovat rukou, rovnoměrně' },
      { pol: 'Podložka M6 (DIN 125)', ks: 2, pozn: 'pod křídlovou matici' },
      { pol: 'Tlačná pružina Ø7–8 × 15 mm', ks: 2, pozn: 'volitelně pod svěrku – zvedá ji při výměně nože' },
    ].filter((q) => q.ks > 0);
    if (delkaUpinaciV > delkaUpinaci) kusovnik.push({ pol: `Šroub M6 × ${delkaUpinaciV} (pro svěrku s V-drážkou)`, ks: 2, pozn: 'vyšší svěrka potřebuje delší šrouby' });
    return { r, D, wr, pocet, H, a, xs, ys, lc, tc, tcV, B, xr, zf, zTop, rh, ws, zs, tb, afp, osaOtvor, sevreni, zuziti, profil, zDna, kolo,
      g, s, dily, kusovnik, kontroly, varovani, uhelMax: uMax * DEG };
  }
  /** výška broušené plochy nad plochou, po které jede váleček */
  function sKamene(P) {
    const K = P.kamen;
    if (K.valecek === 'deska') return cislo(K.vyska, 25) + (K.rezim === 'sklo' ? 0 : 0) + 4;   // + podstava držáku 4 mm
    return 0;
  }
  /** nejmenší vůle obrysu těla nad plochou při úhlu θ (body před dotykem válečku se porovnávají s kamenem) */
  function vuleTela(profil, r, theta, s) {
    const T = transformace(r, theta);
    let m = Infinity;
    for (const [x, z] of profil) {
      const [X, Y] = T(x, z), podklad = X > r * 0.5 ? Math.max(0, s) : 0;
      m = Math.min(m, Y - podklad);
    }
    return m;
  }
  /** geometrický model vozíku pro výpočty (bez kalibrace / s kalibrací) */
  function modelVoziku(P, v) {
    v = v || vozik(P);
    const g = { r: v.r, H: v.H, a: v.a, t: cislo(P.nuz.tloustka, 2.5), s: v.s };
    if (P.vozik.kalibrace) {
      const Hk = kalibrujH(cislo(P.vozik.kalL, 40), cislo(P.vozik.kalUhel, 30), g);
      if (isFinite(Hk) && Hk > 0) g.H = Hk;
    }
    return g;
  }
  /** tabulka vyložení pro úhly; Δ = o kolik zkrátit vyložení oproti primární fazetě */
  function tabulkaVylozeni(g, uhly, primarni) {
    const L0 = vylozeniZUhlu(primarni, g);
    return uhly.map((u) => {
      const L = vylozeniZUhlu(u, g), T = transformace(g.r, u), E = T(L + g.a, g.H + g.t);
      return { uhel: u, L, delta: L - L0, Ex: E[0], fazeta: delkaFazety(g.t, u), citl: citlivost(L, g).naMmVylozeni };
    });
  }
  /** pohled na vozík v poloze pro vyložení L – body ve světě (pro 2D/3D) */
  function poloha(P, v, L) {
    const g = modelVoziku(P, v), theta = uhelZVylozeni(L, g), T = transformace(v.r, theta), t = g.t, D = L + v.a;
    const xb = Math.max(v.xr - 60, D - 180);
    const nuz = [[xb, v.H], [D - t / Math.tan(theta * RAD), v.H], [D, v.H + t], [xb, v.H + t]];
    return { theta, g, T, E: T(D, v.H + t), telo: v.profil.map(([x, z]) => T(x, z)), nuz: nuz.map(([x, z]) => T(x, z)),
      sverka: [[v.xs - v.lc / 2, v.H + t], [v.xs + v.lc / 2, v.H + t], [v.xs + v.lc / 2, v.H + t + v.tc], [v.xs - v.lc / 2, v.H + t + v.tc]].map(([x, z]) => T(x, z)),
      stred: [0, v.r] };
  }

  /* ================================================================
     2) NASTAVOVACÍ MĚRKA VYLOŽENÍ – deska s V-kolébkou pro váleček a stupni
     Váleček leží v 90° V-drážce (střed je dán bez ohledu na vůli), ostří se opře o stupeň.
     Stupeň i: nášlap ve výšce z_i, čelo v X_i od osy válečku. Na desce se vozík nakloní na θj,
     vyložení D je ale stejné jako na kameni → na kameni vyjde požadovaný úhel θ.
     ================================================================ */
  function merka(P, v) {
    v = v || vozik(P);
    const g = modelVoziku(P, v), K = g.H + g.t, varovani = [], kontroly = [];
    const uhly = seznamUhlu(P.uhly.seznam).sort((a, b) => b - a);
    if (!uhly.length) uhly.push(cislo(P.uhly.primarni, 25));
    const dv = v.r / Math.SQRT2 + 1.5, rc = v.r * Math.SQRT2 - dv, hs = 1.5, Tpod = 2.5, zb = -(dv + Tpod);
    const stupne = [];
    let predX = dv;
    uhly.forEach((u, i) => {
      const D = vylozeniZUhlu(u, g) + g.a, z = i * hs, R = Math.hypot(D, K), q = (rc - z) / R;
      const tj = (Math.atan2(K, D) + Math.asin(q)) * DEG, X = K * Math.sin(tj * RAD) + D * Math.cos(tj * RAD);
      stupne.push({ uhel: u, D, L: D - g.a, z, X, nakloneni: tj, nasl: X - predX });
      predX = X;
    });
    const monot = stupne.every((q) => q.nasl >= 3);
    kontroly.push(kontrola('stupně za sebou s nášlapem ≥ 3 mm', monot, Math.min(...stupne.map((q) => q.nasl)), 3));
    if (!monot) varovani.push('Některé úhly jsou příliš blízko sebe (nášlap < 3 mm) – vynechte mezihodnoty, nebo pro mikrofazetu použijte zkrácení vyložení z tabulky.');
    const xKonec = predX + 16, zKonec = uhly.length * hs, x0 = -dv - 8;
    const sirka = Math.max(40, Math.min(cislo(P.vozik.maxSirka, 64), 140)) + 24;
    // profil (x, z) CCW
    const pts = [[x0, zb], [xKonec, zb], [xKonec, zKonec]];
    for (let i = stupne.length - 1; i >= 0; i--) { pts.push([stupne[i].X, stupne[i].z + hs]); pts.push([stupne[i].X, stupne[i].z]); }
    pts.push([dv, 0], [0, -dv], [-dv, 0], [x0, 0]);
    const profil = ccw(pts);
    // vůle těla vozíku nad deskou v poloze každého stupně
    const vrch = (X) => { if (Math.abs(X) < dv) return Math.abs(X) - dv; if (X < 0) return 0; for (const q of stupne) if (X < q.X) return q.z; return zKonec; };
    let minVule = Infinity;
    for (const q of stupne) {
      const u = q.nakloneni * RAD, cu = Math.cos(u), su = Math.sin(u);
      for (const [x, z] of v.profil) { const X = x * cu + z * su, Y = rc - x * su + z * cu; if (Math.hypot(x, z) > v.rh + 0.5 || X > dv) minVule = Math.min(minVule, Y - vrch(X)); }
    }
    kontroly.push(kontrola('tělo vozíku na měrce nedrhne (vůle ≥ 0,3 mm)', minVule >= 0.3, minVule, 0.3));
    if (minVule < 0.3) varovani.push('Tělo vozíku se na měrce opírá o desku – stupně jsou příliš vysoko nebo úhly příliš velké.');
    const minus = [];
    if (P.tisk.oznaceni !== false) {
      stupne.forEach((q, i) => {
        const delka = q.nasl - 1.5, txt = fmtCislo(q.uhel), h = Math.min(6, delka / (0.94 * txt.replace('.', '').length + 0.2));
        q.popisH = h >= 2.5 ? r2(h) : 0;
        if (h >= 2.5) minus.push(...textPrim(txt, h, 'xy', q.X - delka - 0.75 + 0.75, -sirka / 2 + 2, q.z, 0.6).prim);
      });
      const tt = fmtCislo(g.t), ht = 4;
      minus.push(...textPrim('T' + tt, ht, 'xy', predX + 2, -sirka / 2 + 2, zKonec, 0.6).prim);
    }
    const dil = { id: 'merka', nazev: 'Měrka vyložení (kolébka + stupně)', kusu: 1, material: 'PLA / PETG, výplň 30 %',
      tisk: 'naplocho, stupni nahoru, bez podpěr', rotTisk: [0, 0, 0],
      plus: [{ t: 'prof', osa: 'y', pts: profil, od: -sirka / 2, do: sirka / 2 }], minus,
      koty: [{ p: 'bok', a: [0, zb], b: [stupne[0].X, zb], txt: fmtCislo(stupne[0].X), str: 'd', o: zb - 6 }].concat(
        stupne.slice(1).map((q, i) => ({ p: 'bok', a: [0, zb], b: [q.X, zb], txt: fmtCislo(q.X), str: 'd', o: zb - 6 - 6 * (i + 1) }))) };
    const stul = cislo(P.tisk.stul, 220);
    kontroly.push(kontrola('měrka se vejde na tiskovou plochu', Math.max(xKonec - x0, sirka) <= stul, Math.max(xKonec - x0, sirka), stul));
    return { stupne, dv, rc, hs, zb, x0, xKonec, sirka, profil, dily: [dil], kontroly, varovani, g,
      kusovnik: [{ pol: 'žádný kovový díl', ks: 0, pozn: 'měrka platí pro tento vozík a tloušťku nože ' + fmtCislo(g.t) + ' mm' }] };
  }

  /* ================================================================
     3) ÚHLOVÁ MĚRKA FAZET – destička s klínovými zářezy
     horní hrana: jednostranné fazety (stěna kolmo + stěna pod úhlem θ), dolní: oboustranné (2θ)
     ================================================================ */
  function uhlomer(P) {
    const U = P.uhlomer, jed = seznamUhlu(U.jednostranne).sort((a, b) => a - b), obo = seznamUhlu(U.oboustranne).sort((a, b) => a - b).filter((u) => u <= 40);
    const dn = omez(cislo(U.hloubka, 10), 6, 20), tl = 3, hT = 4, mez = 5, varovani = [], kontroly = [];
    const Hp = 2 * dn + 2 * hT + 8;
    const sirkaJ = (u) => dn * Math.tan(u * RAD), sirkaO = (u) => 2 * dn * Math.tan(u * RAD);
    const sirkaTxt = (u) => segmentyTextu(fmtCislo(u), hT).sirka;
    let x = 6; const horni = [];
    for (const u of jed) { const w = Math.max(sirkaJ(u), sirkaTxt(u)); horni.push({ uhel: u, x, w: sirkaJ(u) }); x += w + mez; }
    let x2 = 6; const dolni = [];
    for (const u of obo) { const w = Math.max(sirkaO(u), sirkaTxt(2 * u) + 2); dolni.push({ uhel: u, x: x2 + w / 2, w: sirkaO(u) }); x2 += w + mez; }
    const Lp = Math.max(x, x2, 40) + 2;
    const pts = [[0, 0]];
    for (const q of dolni) pts.push([q.x - q.w / 2, 0], [q.x, dn], [q.x + q.w / 2, 0]);
    pts.push([Lp, 0], [Lp, Hp]);
    for (let i = horni.length - 1; i >= 0; i--) { const q = horni[i]; pts.push([q.x + q.w, Hp], [q.x, Hp - dn], [q.x, Hp]); }
    pts.push([0, Hp]);
    const minus = [];
    for (const q of horni) minus.push({ t: 'val', osa: 'z', c: [q.x + 0.25, Hp - dn - 0.25, -1], r: 0.75, h: tl + 2 });
    for (const q of dolni) minus.push({ t: 'val', osa: 'z', c: [q.x, dn + 0.4, -1], r: 0.75, h: tl + 2 });
    if (P.tisk.oznaceni !== false) {
      for (const q of horni) minus.push(...textPrim(fmtCislo(q.uhel), hT, 'xy', q.x + 0.5, Hp - dn - hT - 2.5, tl, 0.6).prim);
      for (const q of dolni) { const t = fmtCislo(2 * q.uhel); minus.push(...textPrim(t, hT, 'xy', q.x - segmentyTextu(t, hT).sirka / 2, dn + 2.5, tl, 0.6).prim); }
    }
    kontroly.push(kontrola('tloušťka destičky ≥ 2 mm', tl >= 2, tl, 2));
    kontroly.push(kontrola('destička se vejde na tiskovou plochu', Lp <= cislo(P.tisk.stul, 220), Lp, cislo(P.tisk.stul, 220)));
    if (Lp > cislo(P.tisk.stul, 220)) varovani.push('Příliš mnoho úhlů – destička je delší než tisková plocha, rozdělte seznam.');
    const dil = { id: 'uhlomer', nazev: 'Úhlová měrka fazet', kusu: 1, material: 'PLA (tuhé, přesné hrany), 100 % výplň',
      tisk: 'naplocho; první vrstvu nepřetlačit (sloní noha zkreslí špičku zářezu)', rotTisk: [0, 0, 0],
      plus: [{ t: 'deska', pts: ccw(pts), od: 0, do: tl }], minus,
      koty: [{ p: 'shora', a: [0, 0], b: [Lp, 0], txt: fmtCislo(Lp), str: 'd', o: -7 }, { p: 'shora', a: [Lp, 0], b: [Lp, Hp], txt: fmtCislo(Hp), str: 'p', o: Lp + 7 }] };
    return { horni, dolni, dn, Lp, Hp, tl, polygon: ccw(pts), dily: [dil], kontroly, varovani, kusovnik: [] };
  }

  /* ================================================================
     4) DRŽÁK KAMENE / SKLA (scary sharp)
     Pevná čelist A + čelist B se šroubem M6 a přítlačnou destičkou. Papír na skle se
     přeloží přes čela skla a sevře mezi čelem skla a čelistmi.
     ================================================================ */
  function drzak(P) {
    const K = P.kamen, vt = cislo(P.tisk.vt, 0.25), M6 = SROUBY.M6, stul = cislo(P.tisk.stul, 220);
    const sklo = K.rezim === 'sklo';
    const Lk = omez(cislo(K.delka, 200), 50, 600), Wk = omez(cislo(K.sirka, 65), 20, 200), Tk = omez(cislo(K.vyska, 25), 3, 60);
    const vule = 0.4, tb = 4, ws = 4, weA = 6, weB = 16, lg = 30, tp = 4, chod = 6;
    const Wi = Wk + 2 * vule, Bw = Wi + 2 * ws;
    const hw = omez(Tk - (sklo ? 1 : 3), 3, 14), hs = omez(Tk - 3, 3, 8);
    const za = Math.max(Tk / 2, M6.af / 2 + 0.6), hwB = Math.max(hw, za + M6.af / 2 + 2.5);
    const xB0 = Lk + vule + tp + chod;               // vnitřní líc čelisti B
    const celkem = weA + xB0 + weB;
    const jeden = celkem <= stul && Bw <= stul;
    const varovani = [], kontroly = [], dily = [];
    if (hwB > Tk) varovani.push(`Čelist se šroubem je ${r2(hwB - Tk)} mm nad broušenou plochou – tah veďte jen k ní (ostří nesmí narazit).`);
    const zakladA = (x0, x1) => ({ t: 'box', a: [x0, -Bw / 2, 0], b: [x1, Bw / 2, tb] });
    const bocnice = (x0, x1) => [{ t: 'box', a: [x0, -Bw / 2, 0], b: [x1, -Wi / 2, tb + hs] }, { t: 'box', a: [x0, Wi / 2, 0], b: [x1, Bw / 2, tb + hs] }];
    const celoA = { t: 'box', a: [-weA, -Bw / 2, 0], b: [0, Bw / 2, tb + hw] };
    const celoB = { t: 'box', a: [xB0, -Bw / 2, 0], b: [xB0 + weB, Bw / 2, tb + hwB] };
    const zAx = tb + za;
    const otvorB = { t: 'val', osa: 'x', c: [xB0 - 1, 0, zAx], r: M6.otvor / 2, h: weB + 2, slza: [0, 0, 1] };
    const kapsa = { t: 'box', a: [xB0 + weB / 2 - (M6.matice + 2 * vt) / 2, -(M6.af / Math.cos(30 * RAD) + 2 * vt) / 2, zAx - M6.af / 2 - vt], b: [xB0 + weB / 2 + (M6.matice + 2 * vt) / 2, (M6.af / Math.cos(30 * RAD) + 2 * vt) / 2, tb + hwB + 1] };
    const diry = (x) => [-1, 1].map((sy) => [{ t: 'val', osa: 'z', c: [x, sy * Wi / 4, -1], r: 2.25, h: tb + 2 }, { t: 'kuzel', c: [x, sy * Wi / 4, tb - 2.2], r0: 2.25, r1: 4.5, h: 2.25 }]).flat();
    const vyrez = Math.min(Wi * 0.5, 24);
    if (jeden) {
      const minus = [otvorB, kapsa, ...diry(Lk * 0.25), ...diry(Lk * 0.75)];
      // odlehčení pod středem kamene (nesmí oslabit čelisti) – průchozí okno
      if (Lk > 2 * lg + 20) minus.push({ t: 'box', a: [lg, -vyrez / 2, -1], b: [Lk - lg, vyrez / 2, tb + 1] });
      dily.push({ id: 'drzak', nazev: sklo ? 'Držák skla (scary sharp) – jeden kus' : 'Držák kamene – jeden kus', kusu: 1, material: 'PETG (voda, olej), výplň 30 %',
        tisk: 'naplocho, bez podpěr; kapsa matice je otevřená shora', rotTisk: [0, 0, 0],
        plus: [zakladA(-weA, xB0 + weB), celoA, celoB, ...bocnice(0, lg), ...bocnice(xB0 - lg, xB0)], minus,
        koty: [{ p: 'shora', a: [0, -Bw / 2], b: [Lk, -Bw / 2], txt: (sklo ? 'sklo ' : 'kámen ') + fmtCislo(Lk), str: 'd', o: -Bw / 2 - 8 },
          { p: 'shora', a: [-weA, -Bw / 2], b: [xB0 + weB, -Bw / 2], txt: fmtCislo(celkem), str: 'd', o: -Bw / 2 - 16 },
          { p: 'shora', a: [-weA, -Wi / 2], b: [-weA, Wi / 2], txt: 'světlost ' + fmtCislo(Wi), str: 'l', o: -weA - 8 }] });
    } else {
      dily.push({ id: 'drzakA', nazev: 'Čelist A (pevná)', kusu: 1, material: 'PETG, výplň 30 %', tisk: 'naplocho, bez podpěr', rotTisk: [0, 0, 0],
        plus: [zakladA(-weA, lg), celoA, ...bocnice(0, lg)], minus: diry(lg / 2),
        koty: [{ p: 'shora', a: [-weA, -Wi / 2], b: [-weA, Wi / 2], txt: 'světlost ' + fmtCislo(Wi), str: 'l', o: -weA - 8 }, { p: 'shora', a: [-weA, -Bw / 2], b: [lg, -Bw / 2], txt: fmtCislo(lg + weA), str: 'd', o: -Bw / 2 - 8 }] });
      dily.push({ id: 'drzakB', nazev: 'Čelist B (se šroubem)', kusu: 1, material: 'PETG, výplň 40 %', tisk: 'naplocho, kapsa matice otevřená shora', rotTisk: [0, 0, 0],
        plus: [zakladA(xB0 - lg, xB0 + weB), celoB, ...bocnice(xB0 - lg, xB0)], minus: [otvorB, kapsa, ...diry(xB0 - lg / 2)],
        koty: [{ p: 'shora', a: [xB0 - lg, -Bw / 2], b: [xB0 + weB, -Bw / 2], txt: fmtCislo(lg + weB), str: 'd', o: -Bw / 2 - 8 }] });
      varovani.push(`Držák (${r2(celkem)} mm) je delší než tisková plocha – čelisti A a B se přišroubují na podkladovou desku; vzdálenost vnitřních líců ${r2(xB0)} mm.`);
    }
    const vyskaPodl = Math.max(8, Math.min(Tk - 1, 2 * za));
    dily.push({ id: 'podlozka', nazev: 'Přítlačná destička', kusu: 1, material: 'PETG', tisk: 'naplocho', rotTisk: [0, 0, 0],
      plus: [{ t: 'box', a: [0, -(Wk - 6) / 2, 0], b: [vyskaPodl, (Wk - 6) / 2, tp] }], minus: [{ t: 'val', osa: 'z', c: [vyskaPodl / 2, 0, tp - 1.2], r: 3.4, h: 2 }],
      koty: [{ p: 'shora', a: [0, -(Wk - 6) / 2], b: [vyskaPodl, -(Wk - 6) / 2], txt: fmtCislo(vyskaPodl), str: 'd', o: -(Wk - 6) / 2 - 6 }] });
    kontroly.push(kontrola('světlost držáku = šířka + 2 × vůle', Math.abs(Wi - (Wk + 2 * vule)) < 1e-9, Wi, Wk + 2 * vule));
    kontroly.push(kontrola('kapsa matice nad podstavou', zAx - M6.af / 2 - vt >= tb - 1e-9, zAx - M6.af / 2 - vt, tb));
    kontroly.push(kontrola('stěny ≥ 2 mm', Math.min(ws, tb, weA) >= 2, Math.min(ws, tb, weA), 2));
    const kusovnik = [
      { pol: `Šroub M6 × ${delkaSroubu(weB + chod + 4)} s křídlovou / rýhovanou hlavou`, ks: 1, pozn: 'tlačí destičku na čelo kamene' },
      { pol: 'Matice M6 (DIN 934)', ks: 1, pozn: 'vložit do kapsy čelisti B' },
      { pol: 'Protiskluzová podložka (gumová síťka)', ks: 1, pozn: 'pod držák' },
    ];
    if (!jeden) kusovnik.push({ pol: `Podkladová deska (překližka 12–18 mm) ${Math.ceil(celkem + 20)} × ${Math.ceil(Bw + 20)}`, ks: 1, pozn: 'čelisti přišroubovat' }, { pol: 'Vrut se zápustnou hlavou 4 × 20', ks: 4, pozn: '' });
    else kusovnik.push({ pol: 'Vrut se zápustnou hlavou 4 × 20', ks: 4, pozn: 'volitelně – přišroubování na desku' });
    if (sklo) kusovnik.push({ pol: `Plavené sklo ${fmtCislo(Lk)} × ${fmtCislo(Wk)} × ${fmtCislo(Tk)} mm, zabroušené hrany`, ks: 1, pozn: 'sklenářství; rovinnost plaveného skla stačí' }, { pol: 'Brusný papír za mokra (P400 – P2500), pruhy', ks: 1, pozn: `šířka ${fmtCislo(Wk)} mm, délka ${Math.ceil(Lk + 2 * Tk + 10)} mm (přes čela)` });
    return { jeden, Lk, Wk, Tk, Wi, Bw, celkem, xB0, hw, hwB, za, dily, kontroly, varovani, kusovnik, sklo };
  }

  /* ================================================================
     5) OPĚRKA STOLNÍ BRUSKY – dutý výbrus
     Kotouč: střed O = (0, 0), poloměr R, obsluha ve směru +x. Opěrka se sklápí kolem čepu
     (výška čepu hz nad osou kotouče); po nastavení úhlu se celá opěrka přisune na mezeru g.
     Úhel ostří: θ = acos(d / R), d = vzdálenost středu kotouče od přímky hřbetu nože
     (hřbet = horní plocha nože na opěrce, d = vzdálenost od roviny opěrky + t).
     ================================================================ */
  const OPERA = { e: 15, fe: 9, tp: 6, Ra: 40, Lp: 62 };
  function bruskaPoloha(R, hz, beta, t, g) {
    const { e, fe, tp } = OPERA, b = -beta * RAD,   // β > 0 = čelo opěrky zvednuté (deska stoupá ke kotouči)
    cb = Math.cos(b), sb = Math.sin(b);
    const rot = (x, z) => [x * cb - z * sb, x * sb + z * cb];
    // opěrka se přisune, až nejbližší roh čela (horní nebo dolní) má od kotouče mezeru g
    const f = rot(-fe, e), fl = rot(-fe, e - tp);
    let hx = -Infinity;
    for (const q of [f, fl]) { const z = hz + q[1]; if (Math.abs(z) >= R + g) continue; hx = Math.max(hx, Math.sqrt((R + g) * (R + g) - z * z) - q[0]); }
    if (!isFinite(hx)) return null;
    const F = [hx + f[0], hz + f[1]], v = [cb, sb], nU = [-sb, cb];
    const dp = F[0] * nU[0] + F[1] * nU[1];             // vzdálenost O od roviny opěrky (kladná = O pod opěrkou)
    const d = dp + t;
    // spodní přední hrana desky opěrky nesmí do kotouče
    const dolni = Math.min(Math.hypot(hz + fl[1], hx + fl[0]), Math.hypot(F[0], F[1])) - R;
    if (!(dp > 0) || d >= R) return { beta, hx, F, dp, d, platne: false, dolni };
    const theta = Math.acos(d / R) * DEG;
    // dotyk ostří: větší kořen přímky hřbetu s kružnicí
    const P0 = [F[0] + t * nU[0], F[1] + t * nU[1]], bb = P0[0] * v[0] + P0[1] * v[1], cc = P0[0] * P0[0] + P0[1] * P0[1] - R * R, disk = bb * bb - cc;
    const lam = -bb + Math.sqrt(Math.max(0, disk)), lam1 = -bb - Math.sqrt(Math.max(0, disk));
    const E = [P0[0] + lam * v[0], P0[1] + lam * v[1]];
    return { beta, hx, F, dp, d, theta, E, lam, lam1, P0, v, nU, platne: lam <= 1e-9 && dolni > 0, dolni };
  }
  /** úhel opěrky β pro požadovaný úhel θ – z řešení v rozsahu sklopení vybere to nejblíž vodorovné */
  function bruskaNastaveni(R, hz, theta, t, g, rozsah) {
    const [b0, b1] = rozsah || [-5, 50], f = (b) => { const q = bruskaPoloha(R, hz, b, t, g); return q && q.platne ? q.theta - theta : NaN; };
    const res = [];
    let pb = b0, pf = f(b0);
    for (let b = b0 + 0.25; b <= b1 + 1e-9; b += 0.25) {
      const fb = f(b);
      if (isFinite(pf) && isFinite(fb) && pf * fb <= 0) {
        let lo = pb, hi = b, flo = pf;
        for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2, fm = f(m); if (!isFinite(fm)) break; if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; } }
        res.push((lo + hi) / 2);
      }
      pb = b; pf = fb;
    }
    if (!res.length) return null;
    res.sort((a, b) => Math.abs(a) - Math.abs(b));
    return bruskaPoloha(R, hz, res[0], t, g);
  }
  /** hloubka dutého výbrusu (vzepětí oblouku) na délce fazety */
  const hloubkaVybrusu = (R, t, theta) => { const b = delkaFazety(t, theta); return R - Math.sqrt(Math.max(0, R * R - b * b / 4)); };

  function opera(P) {
    const Bz = P.bruska, vt = cislo(P.tisk.vt, 0.25), M6 = SROUBY.M6, { e, fe, tp, Ra, Lp } = OPERA;
    const Wp = omez(cislo(Bz.sirkaOpery, 60), 30, 120), tfl = 8, gap = 0.5, tch = 6, tf = 6;
    const bMin = -5, bMax = 50, kontroly = [], varovani = [], dily = [];
    const hf = e - tp + 8;                               // spodní hrana boků desky 8 mm pod čepem
    const otv = M6.otvor / 2, afp = M6.af + 2 * vt;
    // výška čepu nad patkou: nejnižší bod desky v celém rozsahu + spodní konec drážky + 3 mm
    const bokDesky = [[-fe, e], [Lp - fe, e], [Lp - fe, e - tp - hf], [-fe, e - tp - hf]];
    let zMin = 0;
    for (let b = bMin; b <= bMax; b += 1) { const c = Math.cos(-b * RAD), s = Math.sin(-b * RAD); for (const [x, z] of bokDesky) if (x * c - z * s > 0) zMin = Math.min(zMin, x * s + z * c); zMin = Math.min(zMin, Ra * Math.sin(-b * RAD) - otv - 3); }
    const zh = -zMin + tf + 2;                         // patka z = −zh … −zh + tf
    // boční deska (líc): obal čepu, drážky se stupnicí a patky
    const body = kruhBody(0, 0, 11, 0, 360, 24);
    for (let b = -bMax - 6; b <= -bMin + 6; b += 3) body.push([(Ra + 17) * Math.cos(b * RAD), (Ra + 17) * Math.sin(b * RAD)]);
    body.push([-10, -zh], [Ra + 17, -zh]);
    const lic = ccw(konvexniObal(body));
    const A0 = -bMax, A1 = -bMin;
    const drazka = ccw(kruhBody(0, 0, Ra + otv + 0.2, A0, A1, 30).concat(kruhBody(Ra * Math.cos(A1 * RAD), Ra * Math.sin(A1 * RAD), otv + 0.2, A1, A1 + 180, 8).slice(1, -1),
      kruhBody(0, 0, Ra - otv - 0.2, A1, A0, 30), kruhBody(Ra * Math.cos(A0 * RAD), Ra * Math.sin(A0 * RAD), otv + 0.2, A0 + 180, A0 + 360, 8).slice(1, -1)));
    const yIn = Wp / 2 + gap, yOut = yIn + tch;
    const plusZ = [{ t: 'box', a: [-10, -yOut, -zh], b: [Ra + 17, yOut, -zh + tf] }];
    const minusZ = [];
    for (const sy of [-1, 1]) {
      const y0 = sy > 0 ? yIn : -yOut, y1 = sy > 0 ? yOut : -yIn;
      plusZ.push({ t: 'prof', osa: 'y', pts: lic, od: y0, do: y1 });
      minusZ.push({ t: 'prof', osa: 'y', pts: drazka, od: y0 - 1, do: y1 + 1 });
      minusZ.push({ t: 'val', osa: 'y', c: [0, y0 - 1, 0], r: otv, h: tch + 2, slza: [0, 0, 1] });
      // stupnice na vnějším líci: rysky po 5°, delší po 10°
      const plocha = sy > 0 ? yOut : -yOut, sm = sy > 0 ? -1 : 1;
      for (let b = 0; b <= bMax; b += 5) {
        const r0 = Ra + otv + 1.2, r1 = r0 + (b % 10 ? 2.5 : 4.5), c = Math.cos(-b * RAD), s = Math.sin(-b * RAD), w = 0.35;
        const pts = ccw([[r0 * c + w * s, r0 * s - w * c], [r1 * c + w * s, r1 * s - w * c], [r1 * c - w * s, r1 * s + w * c], [r0 * c - w * s, r0 * s + w * c]]);
        minusZ.push({ t: 'prof', osa: 'y', pts, od: sm < 0 ? plocha - 0.6 : plocha - 1, do: sm < 0 ? plocha + 1 : plocha + 0.6, text: true });
      }
      if (P.tisk.oznaceni !== false) for (let b = 0; b <= bMax; b += 20) {
        const rr = Ra + otv + 7.5, c = Math.cos(-b * RAD), s = Math.sin(-b * RAD), txt = String(b), w = segmentyTextu(txt, 3.2).sirka;
        minusZ.push(...textPrim(txt, 3.2, 'xz', rr * c - w / 2 * (sy > 0 ? 1 : 1), rr * s - 1.6, plocha, 0.6, sm < 0 ? -1 : 1).prim);
      }
    }
    // podélné drážky v patce pro přisunutí (M6)
    for (const sy of [-1, 1]) minusZ.push({ t: 'deska', pts: ccw(kruhBody(Ra * 0.35, sy * (yIn - 9), otv, 90, 270, 8).concat(kruhBody(Ra + 6, sy * (yIn - 9), otv, -90, 90, 8))), od: -zh - 1, do: -zh + tf + 1 });
    dily.push({ id: 'operaZaklad', nazev: 'Opěrka – základ s bočnicemi a stupnicí', kusu: 1, material: 'PETG / ASA (jiskry!), výplň 40 %, 4 perimetry',
      tisk: 'patkou dolů; otvory čepu jsou kapky, oblouková drážka tvoří krátký most', rotTisk: [0, 0, 0],
      plus: plusZ, minus: minusZ,
      koty: [{ p: 'bok', a: [0, -zh], b: [0, 0], txt: 'čep ' + fmtCislo(zh), str: 'l', o: -18 }, { p: 'bok', a: [0, 0], b: [Ra, 0], txt: 'R ' + fmtCislo(Ra), str: 'h', o: 8 },
        { p: 'shora', a: [Ra + 17, -yOut], b: [Ra + 17, yOut], txt: fmtCislo(2 * yOut), str: 'p', o: Ra + 25 }] });
    // deska opěrky (funkční poloha β = 0), tisk horní plochou dolů
    const plusD = [{ t: 'box', a: [-fe, -Wp / 2, e - tp], b: [Lp - fe, Wp / 2, e] }];
    const minusD = [];
    const bok = ccw([[-fe, e - tp + 0.01], [-fe, -8 + 3], [-fe + 3, -8], [Ra + 9, -8], [Lp - fe, -8 + 3], [Lp - fe, e - tp + 0.01]]);
    for (const sy of [-1, 1]) {
      const y0 = sy > 0 ? Wp / 2 - tfl : -Wp / 2, y1 = sy > 0 ? Wp / 2 : -Wp / 2 + tfl;
      plusD.push({ t: 'prof', osa: 'y', pts: bok, od: y0, do: y1 });
      for (const x of [0, Ra]) {
        minusD.push({ t: 'val', osa: 'y', c: [x, y0 - 1, 0], r: otv, h: tfl + 2, slza: [0, 0, -1] });
        const yk = sy > 0 ? Wp / 2 - tfl - 1 : -Wp / 2 + tfl - M6.matice - 0.6;
        minusD.push({ t: 'hex', osa: 'y', c: [x, yk, 0], af: afp, h: M6.matice + 1.6, vrcholy: 'z' });
      }
    }
    dily.push({ id: 'operaDeska', nazev: 'Opěrka – sklopná deska', kusu: 1, material: 'PETG / ASA, výplň 50 %; čelo doporučeno oplechovat',
      tisk: 'horní (opěrnou) plochou dolů – je rovná; boky nahoru, otvory kapky', rotTisk: [180, 0, 0],
      plus: plusD, minus: minusD,
      koty: [{ p: 'bok', a: [-fe, e], b: [Lp - fe, e], txt: fmtCislo(Lp), str: 'h', o: e + 7 }, { p: 'bok', a: [-fe, e], b: [0, e], txt: fmtCislo(fe), str: 'h', o: e + 14 },
        { p: 'bok', a: [0, 0], b: [0, e], txt: 'e ' + fmtCislo(e), str: 'l', o: -fe - 7 }, { p: 'shora', a: [Lp - fe, -Wp / 2], b: [Lp - fe, Wp / 2], txt: fmtCislo(Wp), str: 'p', o: Lp - fe + 8 }] });
    kontroly.push(kontrola('stěna boku desky kolem čepu ≥ 2 mm', 8 - otv >= 2, 8 - otv, 2));
    kontroly.push(kontrola('kapsa matice v boku desky nechá stěnu ≥ 2 mm', tfl - M6.matice - 1.6 + 1 >= 2, tfl - M6.matice - 0.6, 2));
    kontroly.push(kontrola('deska se nedotkne patky v celém rozsahu sklopení', zh - tf >= -zMin + 2 - 1e-9, zh - tf, -zMin + 2));
    // výpočet nastavení pro požadovaný úhel a opotřebení kotouče
    const D = omez(cislo(Bz.D, 150), 50, 400), Dmin = omez(cislo(Bz.Dmin, 120), 40, D), g = omez(cislo(Bz.mezera, 2), 0.5, 6);
    const hz = cislo(Bz.vyskaCepu, 10), t = cislo(P.nuz.tloustka, 2.5), th = omez(cislo(Bz.uhel, 25), 10, 60);
    const nast = bruskaNastaveni(D / 2, hz, th, t, g, [bMin, bMax]);
    if (!nast) varovani.push(`Úhel ${th}° nejde s čepem ve výšce ${hz} mm nad osou kotouče Ø${D} nastavit v rozsahu sklopení ${bMin}…${bMax}° – změňte výšku čepu.`);
    const tabulka = [];
    for (let d = D; d >= Dmin - 1e-9; d -= Math.max(5, (D - Dmin) / 6)) {
      const q = bruskaNastaveni(d / 2, hz, th, t, g, [bMin, bMax]);
      const pevne = nast ? bruskaPoloha(d / 2, hz, nast.beta, t, g) : null;
      tabulka.push({ D: d, beta: q ? q.beta : NaN, hx: q ? q.hx : NaN, pevneTheta: pevne && pevne.platne ? pevne.theta : NaN, hloubka: hloubkaVybrusu(d / 2, t, th) });
    }
    const uhlyTab = [20, 25, 30, 35].map((u) => { const q = bruskaNastaveni(D / 2, hz, u, t, g, [bMin, bMax]); return { uhel: u, beta: q ? q.beta : NaN, hx: q ? q.hx : NaN }; });
    const kusovnik = [
      { pol: 'Šroub M6 × 16 (DIN 912) + podložka', ks: 2, pozn: 'čep – do matic v bocích desky' },
      { pol: 'Šroub M6 × 20 s křídlovou / rýhovanou hlavou + podložka Ø12', ks: 2, pozn: 'aretace úhlu v obloukové drážce' },
      { pol: 'Matice M6 (DIN 934)', ks: 4, pozn: 'zalisovat do kapes v bocích desky' },
      { pol: 'Šroub M6 + matice / vrut do podkladu', ks: 2, pozn: 'drážky v patce – přisunutí ke kotouči' },
      { pol: `Plech ocel/hliník 1,5–2 mm, ${Wp} × ${Lp} mm`, ks: 1, pozn: 'doporučeno nalepit na opěrnou plochu (jiskry, opotřebení)' },
    ];
    return { Wp, zh, Ra, Lp, e, fe, tp, bMin, bMax, yIn, yOut, lic, drazka, dily, kontroly, varovani, kusovnik, nast, tabulka, uhlyTab, D, Dmin, g, hz, t, theta: th };
  }

  /* ================================================================
     6) MĚRKA ZAKULACENÍ OSTŘÍ (camber) – destička s vydutým obloukem
     ================================================================ */
  const CAMBER = {
    uhlazovak: { nazev: 'uhlazovák (smoothing) – jemné zakulacení', c: 0.08 },
    hrubovaci: { nazev: 'hrubovací / hoblík (jack, fore)', c: 0.4 },
    macek: { nazev: 'macek (scrub) – výrazný oblouk', c: 2.5 },
    vlastni: { nazev: 'vlastní hodnota', c: null },
  };
  const polomerCamberu = (W, c) => (W * W / 4 + c * c) / (2 * c);
  function camber(P) {
    const C = P.camber, W = omez(cislo(C.sirka, 50), 10, 120), c = omez(cislo(C.prohnuti, 0.4), 0.02, 20);
    const Rc = polomerCamberu(W, c), Hc = 22, Wc = W + 16, tl = 3, kontroly = [], varovani = [];
    if (c < 0.3) varovani.push('Prohnutí pod 0,3 mm je pod přesností FDM tisku – měrka je jen orientační; jemné zakulacení dělejte počtem tahů s tlakem na rozích a kontrolujte proti světlu pravítkem.');
    const pts = [[-Wc / 2, 0], [Wc / 2, 0], [Wc / 2, Hc], [W / 2, Hc]];
    for (let i = 1; i < 40; i++) { const x = W / 2 - W * i / 40; pts.push([x, Hc - c + (Rc - Math.sqrt(Rc * Rc - x * x))]); }
    pts.push([-W / 2, Hc], [-Wc / 2, Hc]);
    const minus = [];
    if (P.tisk.oznaceni !== false) {
      const txt = 'C' + fmtCislo(c), w = segmentyTextu(txt, 5).sirka;
      minus.push(...textPrim(txt, 5, 'xy', -w / 2, 5, tl, 0.6).prim);
    }
    kontroly.push(kontrola('destička se vejde na tiskovou plochu', Wc <= cislo(P.tisk.stul, 220), Wc, cislo(P.tisk.stul, 220)));
    const dil = { id: 'camber', nazev: 'Měrka zakulacení ostří', kusu: 1, material: 'PLA, 100 % výplň', tisk: 'naplocho; měřicí hranu po tisku přetáhněte jemným papírem', rotTisk: [0, 0, 0],
      plus: [{ t: 'deska', pts: ccw(pts), od: 0, do: tl }], minus,
      koty: [{ p: 'shora', a: [-W / 2, Hc], b: [W / 2, Hc], txt: fmtCislo(W), str: 'h', o: Hc + 7 }, { p: 'shora', a: [-Wc / 2, 0], b: [Wc / 2, 0], txt: fmtCislo(Wc), str: 'd', o: -7 }] };
    // rozpis tahů: kolik ubrat v pásech napříč ostřím (hloubka oblouku v místě x)
    const pasy = [];
    for (let i = 0; i <= 4; i++) { const x = W / 2 * i / 4; pasy.push({ x, ubrat: c - (Rc - Math.sqrt(Rc * Rc - x * x)) }); }
    return { W, c, Rc, Hc, Wc, tl, polygon: ccw(pts), pasy, dily: [dil], kontroly, varovani, kusovnik: [] };
  }

  /* ---------------- hoblík: úhel řezu, vůle, zadní fazeta ---------------- */
  function hoblik(loze, fazeta, orientace, zadni) {
    loze = +loze; fazeta = +fazeta; zadni = +zadni || 0;
    const varovani = [];
    let rez, vule;
    if (orientace === 'nahoru') {
      rez = loze + fazeta; vule = loze;
      if (zadni) varovani.push('U želízka fazetou nahoru se zadní fazeta nepoužívá – úhel řezu se mění úhlem fazety.');
    } else {
      rez = loze + zadni; vule = loze - fazeta;
      if (zadni > 20) varovani.push('Zadní fazeta nad 20° je neobvyklá (škrabka) – zvyšuje řezný odpor.');
    }
    if (vule < 10) varovani.push(`Vůle ${r2(vule)}° je malá – pod 10° hřbet fazety tře o dřevo, hoblík „nebere“. Snižte úhel fazety (mikrofazety).`);
    if (rez > 62) varovani.push('Úhel řezu nad 62° už spíš škrabe než hobluje.');
    return { rez, vule, varovani };
  }
  /** „trik s pravítkem“: zadní fazeta z tloušťky pravítka a vzdálenosti jeho dotyku od ostří */
  const pravitkovyTrik = (tl, vzd) => Math.asin(Math.min(1, tl / vzd)) * DEG;

  /* ---------------- všechny přípravky ---------------- */
  const PRIPRAVKY = [
    { id: 'vozik', nazev: 'Honovací vozík', ikona: '🛞' },
    { id: 'merka', nazev: 'Měrka vyložení', ikona: '📏' },
    { id: 'uhlomer', nazev: 'Úhlová měrka', ikona: '📐' },
    { id: 'drzak', nazev: 'Držák kamene / skla', ikona: '🪨' },
    { id: 'opera', nazev: 'Opěrka brusky', ikona: '⚙️' },
    { id: 'camber', nazev: 'Měrka zakulacení', ikona: '◠' },
  ];
  function pripravek(P, id, v) {
    v = v || vozik(P);
    if (id === 'vozik') return v;
    if (id === 'merka') return merka(P, v);
    if (id === 'uhlomer') return uhlomer(P);
    if (id === 'drzak') return drzak(P);
    if (id === 'opera') return opera(P);
    if (id === 'camber') return camber(P);
    return null;
  }
  /** obálka primitiv (pro náhledy a test) */
  function obalkaPrim(q) {
    if (q.t === 'box') return { x0: q.a[0], y0: q.a[1], z0: q.a[2], x1: q.b[0], y1: q.b[1], z1: q.b[2] };
    if (q.t === 'prof') { const xs = q.pts.map((p) => p[0]), zs = q.pts.map((p) => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: q.od, y1: q.do, ...(q.osa === 'x' ? { x0: q.od, x1: q.do, y0: Math.min(...xs), y1: Math.max(...xs) } : {}) }; }
    if (q.t === 'deska') { const xs = q.pts.map((p) => p[0]), ys = q.pts.map((p) => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0: q.od, z1: q.do }; }
    if (q.t === 'val' || q.t === 'hex' || q.t === 'kuzel') {
      const r = q.t === 'hex' ? q.af / Math.sqrt(3) : Math.max(q.r || 0, q.r0 || 0, q.r1 || 0), [x, y, z] = q.c, h = q.h, osa = q.osa || 'z';
      return { x0: osa === 'x' ? x : x - r, x1: osa === 'x' ? x + h : x + r, y0: osa === 'y' ? y : y - r, y1: osa === 'y' ? y + h : y + r, z0: osa === 'z' ? z : z - r, z1: osa === 'z' ? z + h : z + r };
    }
    return null;
  }

  const API = { RAD, DEG, SROUBY, LOZISKO_608, POUZITI, DREVO, OCEL, ZRNITOSTI, POPOUSTENI, CAMBER, PRIPRAVKY, OPERA,
    vychoziProjekt, slouc, seznamUhlu, doporuceneUhly, uhelZVylozeni, vylozeniZUhlu, citlivost, kalibrujH, delkaFazety, transformace,
    vozik, sKamene, vuleTela, modelVoziku, tabulkaVylozeni, poloha, merka, uhlomer, drzak, opera, camber, bruskaPoloha, bruskaNastaveni, hloubkaVybrusu,
    polomerCamberu, hoblik, pravitkovyTrik, pripravek, obalkaPrim, segmentyTextu, textPrim, delkaSroubu, kruhBody, ccw, plochaPolygonu, konvexniObal, cislo, fmtCislo };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.OSTR = API;
})(typeof window !== 'undefined' ? window : globalThis);
