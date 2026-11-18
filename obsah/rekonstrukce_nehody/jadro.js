/* Rekonstrukce dopravní nehody – výpočetní jádro (bez DOM, testovatelné v node).
   Vnitřní výpočty v SI (m, s, kg, rad); modely v MODELY pracují v jednotkách formuláře
   (km/h, °, m, %). Úhly: 0° = osa x (vpravo), kladně proti směru hodinových ručiček. */
(function (gl) {
  'use strict';
  const G = 9.81;
  const kmh = v => v * 3.6, ms = v => v / 3.6;
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

  // Součinitele adheze – SHODNĚ se stránkou 🚗 Rychlost z brzdné stopy (obsah/brzdna_draha.html).
  const POVRCHY = [
    { id: 'asfalt_suchy', nazev: 'asfalt suchý', min: 0.65, max: 0.85 },
    { id: 'asfalt_mokry', nazev: 'asfalt mokrý', min: 0.40, max: 0.65 },
    { id: 'beton_suchy', nazev: 'beton suchý', min: 0.65, max: 0.85 },
    { id: 'beton_mokry', nazev: 'beton mokrý', min: 0.45, max: 0.70 },
    { id: 'dlazba_sucha', nazev: 'dlažba (kostky) suchá', min: 0.55, max: 0.75 },
    { id: 'dlazba_mokra', nazev: 'dlažba (kostky) mokrá', min: 0.35, max: 0.55 },
    { id: 'sterk', nazev: 'štěrk, šotolina', min: 0.40, max: 0.65 },
    { id: 'snih', nazev: 'sníh ujetý', min: 0.15, max: 0.30 },
    { id: 'led', nazev: 'led, náledí', min: 0.05, max: 0.15 }
  ];

  /* ---------- doběh a smyk ---------- */
  // rychlost na začátku doběhu (m/s) přes úseky [{s, mu}] se zpomalením mu·g, vKonec (m/s) na konci
  function dobeh(useky, vKonec) {
    let v2 = (vKonec || 0) ** 2;
    for (const u of useky) if (u.s > 0 && u.mu > 0) v2 += 2 * u.mu * G * u.s;
    return Math.sqrt(v2);
  }
  // poloměr oblouku z tětivy c a vzepětí (středové pořadnice) m
  const polomerZTetivy = (c, m) => (m > 0 ? c * c / (8 * m) + m / 2 : NaN);
  // kritická rychlost (m/s) v oblouku R, adheze mu, příčný sklon e = tg(úhlu) (kladný = k vnitřku oblouku)
  function kritickaRychlost(R, mu, e) {
    e = e || 0;
    const jm = 1 - mu * e;
    if (!(R > 0) || jm <= 0) return NaN;
    const v2 = G * R * (mu + e) / jm;
    return v2 > 0 ? Math.sqrt(v2) : NaN;
  }

  /* ---------- srážka ---------- */
  // 2D zachování hybnosti: směry před (a1, a2) a po (b1, b2) v rad, rychlosti po u1, u2 (m/s) → rychlosti před
  function srazka2d(p) {
    const { m1, m2, a1, a2, b1, b2, u1, u2 } = p;
    const Px = m1 * u1 * Math.cos(b1) + m2 * u2 * Math.cos(b2);
    const Py = m1 * u1 * Math.sin(b1) + m2 * u2 * Math.sin(b2);
    const s = Math.sin(a2 - a1);
    if (Math.abs(s) < 1e-6) return { chyba: 'Směry před srážkou jsou rovnoběžné – 2D hybnost nemá jednoznačné řešení. Použijte centrický ráz / EES.' };
    const v1 = (Px * Math.sin(a2) - Py * Math.cos(a2)) / (m1 * s);
    const v2 = (Py * Math.cos(a1) - Px * Math.sin(a1)) / (m2 * s);
    const vek = (v, u) => [v * Math.cos(u), v * Math.sin(u)];
    const V1 = vek(v1, a1), V2 = vek(v2, a2), U1 = vek(u1, b1), U2 = vek(u2, b2);
    const D1 = [U1[0] - V1[0], U1[1] - V1[1]], D2 = [U2[0] - V2[0], U2[1] - V2[1]];
    const Epred = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2, Epo = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
    return {
      v1, v2, Px, Py, V1, V2, U1, U2, D1, D2,
      dv1: Math.hypot(...D1), dv2: Math.hypot(...D2),
      // směr změny rychlosti (odpovídá směru rázové síly působící na vozidlo)
      smerDv1: deg(Math.atan2(D1[1], D1[0])), smerDv2: deg(Math.atan2(D2[1], D2[0])),
      Epred, Epo, dE: Epred - Epo,
      podminenost: Math.abs(s) // < sin 10° ≈ 0,17 → špatně podmíněné
    };
  }
  // centrický (přímý) ráz s koeficientem restituce k; v1, v2 rychlosti před (m/s, se znaménkem v ose rázu)
  function razCentricky(m1, m2, v1, v2, k) {
    const M = m1 + m2, vr = v1 - v2, P = m1 * v1 + m2 * v2;
    const u1 = (P - m2 * k * vr) / M, u2 = (P + m1 * k * vr) / M;
    return { u1, u2, vc: P / M, dv1: u1 - v1, dv2: u2 - v2, Edef: 0.5 * m1 * m2 / M * (1 - k * k) * vr * vr };
  }
  // EES (energeticky ekvivalentní rychlosti, m/s) → deformační energie, rychlost přiblížení a Δv (centrický ráz)
  function zEES(m1, m2, ees1, ees2, k) {
    const M = m1 + m2, Edef = 0.5 * m1 * ees1 * ees1 + 0.5 * m2 * ees2 * ees2;
    const jm = m1 * m2 / M * (1 - k * k);
    if (jm <= 0) return { chyba: 'Pro k = 1 (dokonale pružný ráz) se energie nedeformuje.' };
    const vrel = Math.sqrt(2 * Edef / jm);
    return { Edef, vrel, dv1: m2 * (1 + k) * vrel / M, dv2: m1 * (1 + k) * vrel / M };
  }

  /* ---------- pád, skok, odhoz ---------- */
  // rychlost odletu (m/s): vodorovná vzdálenost d těžiště, pokles h (kladný = dopad níž), úhel odletu u (rad, + nahoru)
  function skok(d, h, u) {
    const jm = 2 * (d * Math.tan(u) + h);
    if (!(d > 0) || jm <= 0) return NaN;
    return d / Math.cos(u) * Math.sqrt(G / jm);
  }
  // Searle: odhoz z výšky ≈ 0 s klouzáním; s = celková vzdálenost odhozu, mu = tření těla o vozovku
  function odhozSearle(s, mu) {
    if (!(s > 0 && mu > 0)) return { vMin: NaN, vMax: NaN };
    return { vMin: Math.sqrt(2 * mu * G * s / (1 + mu * mu)), vMax: Math.sqrt(2 * mu * G * s) };
  }
  // Collins: vodorovný odhoz z výšky h + klouzání: s = v·√(2h/g) + v²/(2μg)
  function odhozCollins(s, mu, h) {
    if (!(s > 0 && mu > 0) || h < 0) return NaN;
    const B = Math.sqrt(2 * h / G);
    return mu * G * (-B + Math.sqrt(B * B + 2 * s / (mu * G)));
  }

  /* ---------- pohyb vozidla: reakce → náběh brzd → plné brzdění ---------- */
  // t od začátku reakce; během náběhu tn roste zpomalení lineárně 0 → a (shodně s brzdna_draha.html)
  function stavPohybu(t, o) {
    const { v0, tr = 0, tn = 0, a } = o;
    if (o.brzdi === false || t <= tr || !(a > 0)) return { x: v0 * t, v: v0 };
    let x = v0 * tr, tau = t - tr, v = v0;
    if (tn > 0) {
      const tRamp = v0 <= a * tn / 2 ? Math.sqrt(2 * v0 * tn / a) : tn;
      const tt = Math.min(tau, tRamp);
      x += v0 * tt - a * tt * tt * tt / (6 * tn);
      v = v0 - a * tt * tt / (2 * tn);
      if (tau <= tRamp || v <= 1e-12) return { x, v: Math.max(0, v) };
      tau -= tRamp;
    }
    const tb = Math.min(tau, v / a);
    return { x: x + v * tb - a * tb * tb / 2, v: v - a * tb };
  }
  function casZastaveni(o) {
    const { v0, tr = 0, tn = 0, a } = o;
    if (o.brzdi === false || !(a > 0)) return Infinity;
    if (tn > 0 && v0 <= a * tn / 2) return tr + Math.sqrt(2 * v0 * tn / a);
    return tr + tn + (v0 - a * tn / 2) / a;
  }
  // první čas, kdy f(t) dosáhne cíle (f monotónně roste) – půlení intervalu
  function pulení(f, cil, t0, t1) {
    for (let i = 0; i < 80; i++) { const t = (t0 + t1) / 2; if (f(t) < cil) t0 = t; else t1 = t; }
    return (t0 + t1) / 2;
  }
  function casDoVzdalenosti(D, o) {
    if (o.brzdi === false || !(o.a > 0)) return D / o.v0;
    const tS = casZastaveni(o);
    if (stavPohybu(tS, o).x < D) return null; // zastaví dřív
    return pulení(t => stavPohybu(t, o).x, D, 0, tS);
  }

  // Časoprostorová analýza (SI). p: vA, vK, a, tn, brzdil, vB, dB, dVolno, vLim, tr[]
  function casoprostor(p) {
    const { vA, a, tn, vB, dB, dVolno, vLim } = p;
    const brzdil = p.brzdil !== false;
    const vK = brzdil ? p.vK : vA;
    if (!(vA > 0) || !(vB > 0) || !(dB > 0)) return { chyba: 'Zadejte kladné rychlosti obou účastníků a dráhu chodce/vozidla B.' };
    if (brzdil && !(a > 0)) return { chyba: 'Zpomalení musí být kladné.' };
    if (brzdil && vK >= vA) return { chyba: 'Rychlost při střetu musí být menší než výchozí rychlost (jinak vozidlo nebrzdilo).' };
    const TB = dB / vB; // od vzniku nebezpečí do střetu
    const kurz = { v0: vA, tr: 0, tn, a, brzdi: brzdil };
    // skutečný průběh: brzdění začalo v čase 0, střet při v = vK
    const Tbrz = brzdil ? pulení(t => vA - stavPohybu(t, kurz).v, vA - vK, 0, casZastaveni(kurz)) : 0;
    const xBrz = brzdil ? stavPohybu(Tbrz, kurz).x : 0;
    const D = TB >= Tbrz ? xBrz + vA * (TB - Tbrz) : xBrz - stavPohybu(Tbrz - TB, kurz).x;
    const tVolno = TB + (dVolno || 0) / vB; // od vzniku nebezpečí do opuštění dráhy vozidla
    const varianty = [];
    for (const [nazev, v] of [['skutečná rychlost', vA], ['dovolená rychlost', vLim]]) {
      if (!(v > 0)) continue;
      for (const tr of p.tr) {
        const o = { v0: v, tr, tn, a };
        const tS = casZastaveni(o), sS = stavPohybu(tS, o).x;
        const r = { nazev, v, tr, sZast: sS, tZast: tS };
        if (sS <= D) { r.zastavi = true; r.rezerva = D - sS; }
        else {
          r.tPrijezd = casDoVzdalenosti(D, o);
          r.vPrijezd = stavPohybu(r.tPrijezd, o).v;
          r.casove = r.tPrijezd >= tVolno;
        }
        varianty.push(r);
      }
    }
    return { TB, Tbrz, xBrz, D, tImpl: TB - Tbrz, tVolno, vK, varianty };
  }

  /* ---------- nejistoty ---------- */
  function rng(seed) { // mulberry32
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const kvantil = (serazene, q) => {
    if (!serazene.length) return NaN;
    const i = (serazene.length - 1) * q, d = Math.floor(i), h = Math.ceil(i);
    return serazene[d] + (serazene[h] - serazene[d]) * (i - d);
  };
  // f(o) → objekt výstupů; nominal = hodnoty; tol = {klíč: ±}; rozdeleni 'rovnomerne' | 'normalni' (± = 2σ)
  function monteCarlo(f, nominal, tol, o = {}) {
    const n = o.n || 5000, r = rng(o.seed || 1), normal = o.rozdeleni === 'normalni';
    const meze = o.meze || {};
    const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    const vzorky = {}; let neplatne = 0;
    for (let i = 0; i < n; i++) {
      const x = Object.assign({}, nominal);
      for (const k in tol) {
        if (!(tol[k] > 0) || typeof nominal[k] !== 'number') continue;
        let v = nominal[k] + (normal ? gauss() * tol[k] / 2 : (2 * r() - 1) * tol[k]);
        if (meze[k]) v = Math.min(meze[k][1], Math.max(meze[k][0], v));
        x[k] = v;
      }
      const y = f(x);
      let ok = y && !y.chyba;
      if (ok) for (const k in y) if (typeof y[k] === 'number' && !isFinite(y[k])) ok = false;
      if (!ok) { neplatne++; continue; }
      for (const k in y) if (typeof y[k] === 'number') (vzorky[k] = vzorky[k] || []).push(y[k]);
    }
    const stat = {};
    for (const k in vzorky) {
      const s = vzorky[k].slice().sort((a, b) => a - b), m = s.reduce((a, b) => a + b, 0) / s.length;
      stat[k] = { p5: kvantil(s, 0.05), p50: kvantil(s, 0.5), p95: kvantil(s, 0.95), min: s[0], max: s[s.length - 1], prumer: m, sd: Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, s.length - 1)) };
    }
    return { n, neplatne, vzorky, stat };
  }
  // citlivost: každý vstup zvlášť na nominal ± tol (ostatní nominální) → změna výstupu vk
  function citlivost(f, nominal, tol, vk, meze = {}) {
    const zak = f(nominal)[vk], out = [];
    for (const k in tol) {
      if (!(tol[k] > 0) || typeof nominal[k] !== 'number') continue;
      const hod = z => { let v = nominal[k] + z * tol[k]; if (meze[k]) v = Math.min(meze[k][1], Math.max(meze[k][0], v)); const y = f(Object.assign({}, nominal, { [k]: v })); return y && !y.chyba ? y[vk] : NaN; };
      const dol = hod(-1), hor = hod(1);
      out.push({ k, dolni: dol - zak, horni: hor - zak, rozpeti: Math.abs(hor - dol) });
    }
    return { zaklad: zak, polozky: out.sort((a, b) => (b.rozpeti || 0) - (a.rozpeti || 0)) };
  }

  /* ---------- modely v jednotkách formuláře (sdílí formuláře, protokol i Monte Carlo) ---------- */
  // pole: k, n (název), j (jednotka), d (výchozí), tol (výchozí ±), mu (nabídka povrchů), typ 'chk', krok, mez [min,max]
  const MU = { mez: [0.01, 1.5], krok: 0.01, mu: true };
  const MODELY = {
    srazka: {
      nazev: 'Srážka – 2D hybnost',
      pole: [
        { k: 'm1', n: 'Hmotnost vozidla 1 (vč. osádky a nákladu)', j: 'kg', d: 1300, tol: 50, mez: [1, 1e5] },
        { k: 'm2', n: 'Hmotnost vozidla 2', j: 'kg', d: 1600, tol: 50, mez: [1, 1e5] },
        { k: 'a1', n: 'Směr jízdy 1 před srážkou α₁', j: '°', d: 0, tol: 3 },
        { k: 'a2', n: 'Směr jízdy 2 před srážkou α₂', j: '°', d: 90, tol: 3 },
        { k: 'b1', n: 'Směr pohybu těžiště 1 po srážce β₁', j: '°', d: 35, tol: 5 },
        { k: 'b2', n: 'Směr pohybu těžiště 2 po srážce β₂', j: '°', d: 60, tol: 5 },
        { k: 's1', n: 'Doběh těžiště 1 (střet → konečná poloha)', j: 'm', d: 12, tol: 0.5, mez: [0, 1e4] },
        Object.assign({ k: 'mu1', n: 'Součinitel doběhu 1 (efektivní)', j: '', d: 0.75, tol: 0.1 }, MU),
        { k: 's2', n: 'Doběh těžiště 2', j: 'm', d: 9, tol: 0.5, mez: [0, 1e4] },
        Object.assign({ k: 'mu2', n: 'Součinitel doběhu 2 (efektivní)', j: '', d: 0.75, tol: 0.1 }, MU),
        { k: 'ees1', n: 'EES vozidla 1 (z deformace; 0 = nezadáno)', j: 'km/h', d: 0, tol: 5, mez: [0, 300] },
        { k: 'ees2', n: 'EES vozidla 2 (0 = nezadáno)', j: 'km/h', d: 0, tol: 5, mez: [0, 300] }
      ],
      vystupy: [{ k: 'v1', n: 'v₁ před srážkou', j: 'km/h' }, { k: 'v2', n: 'v₂ před srážkou', j: 'km/h' }, { k: 'dv1', n: 'Δv₁', j: 'km/h' }, { k: 'dv2', n: 'Δv₂', j: 'km/h' }],
      f(p) {
        const u1 = dobeh([{ s: p.s1, mu: p.mu1 }]), u2 = dobeh([{ s: p.s2, mu: p.mu2 }]);
        const r = srazka2d({ m1: p.m1, m2: p.m2, a1: rad(p.a1), a2: rad(p.a2), b1: rad(p.b1), b2: rad(p.b2), u1, u2 });
        if (r.chyba) return r;
        const Eees = 0.5 * p.m1 * ms(p.ees1 || 0) ** 2 + 0.5 * p.m2 * ms(p.ees2 || 0) ** 2;
        return { v1: kmh(r.v1), v2: kmh(r.v2), dv1: kmh(r.dv1), dv2: kmh(r.dv2), u1: kmh(u1), u2: kmh(u2), dE: r.dE / 1000, Eees: Eees / 1000, detail: r };
      }
    },
    raz: {
      nazev: 'Centrický ráz a EES',
      pole: [
        { k: 'm1', n: 'Hmotnost vozidla 1', j: 'kg', d: 1300, tol: 50, mez: [1, 1e5] },
        { k: 'm2', n: 'Hmotnost vozidla 2', j: 'kg', d: 1600, tol: 50, mez: [1, 1e5] },
        { k: 'k', n: 'Koeficient restituce k', j: '', d: 0.15, tol: 0.05, mez: [0, 0.95], krok: 0.01 },
        { k: 'v1', n: 'Rychlost 1 před rázem (v ose rázu)', j: 'km/h', d: 50, tol: 0 },
        { k: 'v2', n: 'Rychlost 2 před rázem (protisměr záporně)', j: 'km/h', d: 0, tol: 0 },
        { k: 'ees1', n: 'EES vozidla 1', j: 'km/h', d: 30, tol: 5, mez: [0, 300] },
        { k: 'ees2', n: 'EES vozidla 2', j: 'km/h', d: 25, tol: 5, mez: [0, 300] }
      ],
      vystupy: [{ k: 'vrel', n: 'Rychlost přiblížení z EES', j: 'km/h' }, { k: 'dv1E', n: 'Δv₁ z EES', j: 'km/h' }, { k: 'dv2E', n: 'Δv₂ z EES', j: 'km/h' }, { k: 'u1', n: 'u₁ po rázu', j: 'km/h' }, { k: 'u2', n: 'u₂ po rázu', j: 'km/h' }],
      f(p) {
        const r = razCentricky(p.m1, p.m2, ms(p.v1), ms(p.v2), p.k), e = zEES(p.m1, p.m2, ms(p.ees1), ms(p.ees2), p.k);
        if (e.chyba) return e;
        return { u1: kmh(r.u1), u2: kmh(r.u2), vc: kmh(r.vc), dv1: kmh(r.dv1), dv2: kmh(r.dv2), Edef: r.Edef / 1000, vrel: kmh(e.vrel), dv1E: kmh(e.dv1), dv2E: kmh(e.dv2), EdefE: e.Edef / 1000 };
      }
    },
    dobeh: {
      nazev: 'Rychlost z doběhu / brzdění po úsecích',
      pole: [
        { k: 's1', n: 'Úsek 1 – délka', j: 'm', d: 15, tol: 0.5, mez: [0, 1e4] },
        Object.assign({ k: 'mu1', n: 'Úsek 1 – součinitel', j: '', d: 0.75, tol: 0.1 }, MU),
        { k: 's2', n: 'Úsek 2 – délka (0 = není)', j: 'm', d: 0, tol: 0.5, mez: [0, 1e4] },
        Object.assign({ k: 'mu2', n: 'Úsek 2 – součinitel', j: '', d: 0.5, tol: 0.1 }, MU),
        { k: 's3', n: 'Úsek 3 – délka (0 = není)', j: 'm', d: 0, tol: 0.5, mez: [0, 1e4] },
        Object.assign({ k: 'mu3', n: 'Úsek 3 – součinitel', j: '', d: 0.3, tol: 0.1 }, MU),
        { k: 'vk', n: 'Rychlost na konci (např. při střetu)', j: 'km/h', d: 0, tol: 0, mez: [0, 400] }
      ],
      vystupy: [{ k: 'v', n: 'Rychlost na začátku', j: 'km/h' }],
      f(p) { return { v: kmh(dobeh([{ s: p.s1, mu: p.mu1 }, { s: p.s2, mu: p.mu2 }, { s: p.s3, mu: p.mu3 }], ms(p.vk))) }; }
    },
    smyk: {
      nazev: 'Smyk v oblouku – kritická rychlost',
      pole: [
        { k: 'c', n: 'Tětiva c (na začátku stopy)', j: 'm', d: 20, tol: 0.2, mez: [0.1, 1e4] },
        { k: 'm', n: 'Vzepětí m (středová pořadnice)', j: 'm', d: 1.2, tol: 0.03, mez: [0.001, 1e3], krok: 0.01 },
        { k: 'rozchod', n: 'Rozchod kol (korekce R − t/2; 0 = bez)', j: 'm', d: 1.5, tol: 0, mez: [0, 3], krok: 0.05 },
        Object.assign({ k: 'mu', n: 'Součinitel boční adheze μ', j: '', d: 0.75, tol: 0.1 }, MU),
        { k: 'e', n: 'Příčný sklon (+ k vnitřku oblouku)', j: '%', d: 0, tol: 0.5, krok: 0.5 }
      ],
      vystupy: [{ k: 'v', n: 'Kritická rychlost', j: 'km/h' }, { k: 'R', n: 'Poloměr dráhy těžiště', j: 'm' }],
      f(p) {
        const Rs = polomerZTetivy(p.c, p.m), R = Rs - (p.rozchod || 0) / 2;
        return { Rs, R, v: kmh(kritickaRychlost(R, p.mu, (p.e || 0) / 100)) };
      }
    },
    cas: {
      nazev: 'Časoprostorová analýza',
      pole: [
        { k: 'vA', n: 'Výchozí rychlost vozidla A', j: 'km/h', d: 70, tol: 3, mez: [0.1, 400] },
        { k: 'brzdil', n: 'Vozidlo A před střetem brzdilo', typ: 'chk', d: 1 },
        { k: 'vK', n: 'Rychlost A při střetu', j: 'km/h', d: 40, tol: 3, mez: [0, 400] },
        Object.assign({ k: 'mu', n: 'Adheze při brzdění μ (zpomalení = μ·g)', j: '', d: 0.75, tol: 0.1 }, MU),
        { k: 'tr', n: 'Reakční doba – výpočtová', j: 's', d: 1.0, tol: 0, mez: [0, 5], krok: 0.1 },
        { k: 'trMin', n: 'Reakční doba – nejkratší', j: 's', d: 0.8, tol: 0, mez: [0, 5], krok: 0.1 },
        { k: 'trMax', n: 'Reakční doba – nejdelší', j: 's', d: 1.5, tol: 0, mez: [0, 5], krok: 0.1 },
        { k: 'tn', n: 'Prodleva (náběh) brzd', j: 's', d: 0.2, tol: 0.05, mez: [0, 2], krok: 0.05 },
        { k: 'vB', n: 'Rychlost chodce / vozidla B', j: 'km/h', d: 5, tol: 0.5, mez: [0.1, 400] },
        { k: 'dB', n: 'Dráha B od vzniku nebezpečí do místa střetu', j: 'm', d: 3.5, tol: 0.3, mez: [0.01, 1e4] },
        { k: 'dVolno', n: 'Dráha B za místem střetu do opuštění dráhy A', j: 'm', d: 1.0, tol: 0, mez: [0, 100] },
        { k: 'vLim', n: 'Nejvyšší dovolená rychlost', j: 'km/h', d: 50, tol: 0, mez: [0, 400] }
      ],
      vystupy: [{ k: 'tImpl', n: 'Implikovaná reakční doba', j: 's' }, { k: 'D', n: 'Vzdálenost A od místa střetu při vzniku nebezpečí', j: 'm' }, { k: 'TB', n: 'Doba od vzniku nebezpečí do střetu', j: 's' }],
      f(p) {
        const r = casoprostor({ vA: ms(p.vA), vK: ms(p.vK), a: p.mu * G, tn: p.tn, brzdil: !!p.brzdil, vB: ms(p.vB), dB: p.dB, dVolno: p.dVolno, vLim: ms(p.vLim), tr: [p.trMin, p.tr, p.trMax] });
        if (r.chyba) return r;
        return { tImpl: r.tImpl, D: r.D, TB: r.TB, detail: r };
      }
    },
    skok: {
      nazev: 'Pád / skok vozidla',
      pole: [
        { k: 'd', n: 'Vodorovná vzdálenost letu těžiště', j: 'm', d: 18, tol: 0.5, mez: [0.01, 1e3] },
        { k: 'h', n: 'Výška pádu těžiště (+ dopad níž)', j: 'm', d: 3, tol: 0.2, krok: 0.1 },
        { k: 'u', n: 'Úhel odletu (+ nahoru, − dolů)', j: '°', d: 0, tol: 2, mez: [-60, 60] }
      ],
      vystupy: [{ k: 'v', n: 'Rychlost odletu', j: 'km/h' }],
      f(p) { return { v: kmh(skok(p.d, p.h, rad(p.u))) }; }
    },
    odhoz: {
      nazev: 'Odhoz chodce',
      pole: [
        { k: 's', n: 'Vzdálenost odhozu (místo střetu → konečná poloha těla)', j: 'm', d: 25, tol: 1, mez: [0.1, 200] },
        { k: 'mu', n: 'Součinitel tření těla o povrch', j: '', d: 0.66, tol: 0.12, mez: [0.1, 1.5], krok: 0.01 },
        { k: 'h', n: 'Výška těžiště chodce při odhozu (Collins)', j: 'm', d: 1.0, tol: 0.2, mez: [0, 3], krok: 0.05 }
      ],
      vystupy: [{ k: 'vMin', n: 'Searle – minimum', j: 'km/h' }, { k: 'vMax', n: 'Searle – maximum', j: 'km/h' }, { k: 'vC', n: 'Collins', j: 'km/h' }],
      f(p) { const s = odhozSearle(p.s, p.mu); return { vMin: kmh(s.vMin), vMax: kmh(s.vMax), vC: kmh(odhozCollins(p.s, p.mu, p.h)) }; }
    }
  };
  const vychozi = id => Object.fromEntries(MODELY[id].pole.map(p => [p.k, p.d]));
  const vychoziTol = id => Object.fromEntries(MODELY[id].pole.filter(p => p.tol != null).map(p => [p.k, p.tol]));
  const meze = id => Object.fromEntries(MODELY[id].pole.filter(p => p.mez).map(p => [p.k, p.mez]));

  const API = { G, POVRCHY, kmh, ms, rad, deg, dobeh, polomerZTetivy, kritickaRychlost, srazka2d, razCentricky, zEES, skok, odhozSearle, odhozCollins, stavPohybu, casZastaveni, casDoVzdalenosti, casoprostor, rng, kvantil, monteCarlo, citlivost, MODELY, vychozi, vychoziTol, meze };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  gl.REKON = API;
})(typeof window !== 'undefined' ? window : globalThis);
