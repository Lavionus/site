/* Rekonstrukce střetu vozidel – jádro bez DOM (test: _test/stret_vozidel_test.js).
   Zachování hybnosti v rovině (2D vektorově): ze směrů příjezdu, směrů a délek dojezdu do konečných
   poloh a součinitele zpomalení při dojezdu zpětně rychlosti obou vozidel před střetem.

   Souřadnice plánu: metry, x doprava (východ), y nahoru (sever).
   Úhly ve stupních od osy +x proti směru hodinových ručiček (0° = doprava, 90° = nahoru).
   Rychlosti uvnitř v m/s, navenek km/h. Hmotnosti kg. */
(function () {
  'use strict';

  const VERZE = 1;
  const G = 9.81;
  // Stejné rozsahy μ jako Rychlost z brzdné stopy (obsah/brzdna_draha.html, BRZDY.POVRCHY) –
  // test _test/stret_vozidel_test.js hlídá, že se nerozejdou.
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
  // Součinitel zpomalení při dojezdu f podle stavu kol (f = podíl × μ povrchu, nebo pevný rozsah)
  const KOLA = {
    blok: { nazev: 'blokovaná kola / smyk (f = μ)', podil: [1, 1] },
    castecne: { nazev: 'částečně brzděné, poškozené (f = podíl × μ)', podil: [0.3, 0.7] },
    volna: { nazev: 'volně se otáčející kola (valivý odpor)', f: [0.01, 0.03] },
    vlastni: { nazev: 'vlastní rozsah f' }
  };
  const MISTA = {
    predek: { nazev: 'předek', hodiny: [-75, 75] },
    pravy: { nazev: 'pravý bok', hodiny: [15, 165] },
    zadek: { nazev: 'zadek', hodiny: [105, 255] },
    levy: { nazev: 'levý bok', hodiny: [195, 345] }
  };

  const RAD = Math.PI / 180;
  const kmh = v => v * 3.6, ms = k => k / 3.6;
  const n360 = a => ((a % 360) + 360) % 360;
  const n180 = a => { const x = n360(a); return x > 180 ? x - 360 : x; };
  const jed = uhel => [Math.cos(uhel * RAD), Math.sin(uhel * RAD)];
  const uhelVektoru = (x, y) => n360(Math.atan2(y, x) / RAD);
  const delka = (x, y) => Math.hypot(x, y);
  // formát čísel v textech kontrol (stránka ho přepne podle jazyka)
  let jazyk = 'cs';
  const c = (x, d) => Number(x).toLocaleString(jazyk, { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 });

  // deterministický generátor (mulberry32) – Monte Carlo i syntetické chyby měření jsou opakovatelné
  function rng(seed) {
    let s = seed | 0;
    return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  /* ---------- projekt ---------- */
  function noveVozidlo(i) {
    return {
      nazev: i ? 'B' : 'A', hmotnost: i ? 1450 : 1300, naklad: 80, hmotTol: 50,
      delka: 4.5, sirka: 1.8, misto: i ? 'levy' : 'predek',
      theta: i ? 90 : 0, thetaTol: 3,
      stopa: 0, stopaTol: 0.3, tn: 0.2,
      phi: i ? 40 : 30, phiTol: 3, d: i ? 9 : 7, dTol: 0.3,
      kola: 'blok', podilMin: 0.3, podilMax: 0.7, fMin: 0.5, fMax: 0.7,
      znamaV: false, znamaOd: 0, znamaDo: 0, limit: 0,
      natoceni: null
    };
  }
  function novyProjekt() {
    return {
      verze: VERZE, id: 'p' + Date.now().toString(36), nazev: 'Nový střet', popis: '',
      povrch: 'asfalt_suchy', muMin: 0.65, muMax: 0.85,
      sklon: 0, sklonTol: 0, sklonSmer: 90,
      S: { x: 0, y: 0 },
      mc: { n: 4000, seed: 1 },
      vozidla: [noveVozidlo(0), noveVozidlo(1)],
      prekazky: [],
      ukazka: null
    };
  }
  // doplní chybějící pole (starší / ručně psaný JSON)
  function migruj(p) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.vozidla) || p.vozidla.length !== 2) throw new Error('Soubor neobsahuje projekt střetu dvou vozidel.');
    const z = novyProjekt();
    const out = Object.assign({}, z, p);
    out.S = Object.assign({}, z.S, p.S);
    out.mc = Object.assign({}, z.mc, p.mc);
    out.vozidla = p.vozidla.map((v, i) => {
      const o = Object.assign(noveVozidlo(i), v);
      for (const k of ['hmotnost', 'naklad', 'hmotTol', 'delka', 'sirka', 'theta', 'thetaTol', 'stopa', 'stopaTol', 'tn', 'phi', 'phiTol', 'd', 'dTol', 'podilMin', 'podilMax', 'fMin', 'fMax', 'znamaOd', 'znamaDo', 'limit']) {
        o[k] = Number(o[k]); if (!Number.isFinite(o[k])) o[k] = noveVozidlo(i)[k];
      }
      o.natoceni = o.natoceni == null || o.natoceni === '' || !Number.isFinite(+o.natoceni) ? null : +o.natoceni;
      o.nazev = String(o.nazev == null ? '' : o.nazev).slice(0, 30);
      if (!KOLA[o.kola]) o.kola = 'blok';
      if (!MISTA[o.misto]) o.misto = 'predek';
      return o;
    });
    for (const k of ['muMin', 'muMax', 'sklon', 'sklonTol', 'sklonSmer']) { out[k] = Number(out[k]); if (!Number.isFinite(out[k])) out[k] = z[k]; }
    // čísla, která UI vkládá do HTML (value="…", protokol) – z cizího JSON jen konečná čísla
    for (const [o, d] of [[out.S, z.S], [out.mc, z.mc]]) for (const k of Object.keys(d)) { o[k] = Number(o[k]); if (!Number.isFinite(o[k])) o[k] = d[k]; }
    out.nazev = String(out.nazev == null ? '' : out.nazev); out.popis = String(out.popis == null ? '' : out.popis);
    const uk = out.ukazka, pr = uk && uk.pravda;
    if (uk && !(UKAZKY.some(u => u.klic === uk.klic) && pr && ['v', 'u', 'd', 'f', 'm'].every(k => Array.isArray(pr[k]) && pr[k].length === 2))) out.ukazka = null;
    if (out.povrch !== 'vlastni' && !POVRCHY.some(q => q.id === out.povrch)) out.povrch = 'asfalt_suchy';
    out.prekazky = Array.isArray(p.prekazky) ? p.prekazky.filter(o => o && Number.isFinite(+o.x) && Number.isFinite(+o.y)).map(o => ({ x: +o.x, y: +o.y, r: +o.r || 0.2, popis: String(o.popis || '').slice(0, 40) })) : [];
    out.verze = VERZE;
    return out;
  }

  function rozsahMu(p) {
    if (p.povrch === 'vlastni') return [Math.min(p.muMin, p.muMax), Math.max(p.muMin, p.muMax)];
    const q = POVRCHY.find(x => x.id === p.povrch) || POVRCHY[0];
    return [q.min, q.max];
  }
  function rozsahF(p, v) {
    const [a, b] = rozsahMu(p);
    if (v.kola === 'blok') return [a, b];
    if (v.kola === 'castecne') return [a * Math.min(v.podilMin, v.podilMax), b * Math.max(v.podilMin, v.podilMax)];
    if (v.kola === 'volna') return KOLA.volna.f.slice();
    return [Math.min(v.fMin, v.fMax), Math.max(v.fMin, v.fMax)];
  }
  const hmotnost = v => v.hmotnost + v.naklad;
  // zpomalení (m/s²) při pohybu ve směru `smer` (°) na sklonu (%) stoupajícím ve směru `smerStoupani` (°)
  function zpomaleni(f, sklonPct, smer, smerStoupani) {
    const al = Math.atan((sklonPct || 0) / 100);
    return G * (f * Math.cos(al) + Math.sin(al) * Math.cos((smer - smerStoupani) * RAD));
  }
  // konečné polohy (těžiště) z bodu střetu, směru a délky dojezdu
  function konecnaPoloha(p, i) {
    const v = p.vozidla[i], [c, s] = jed(v.phi);
    return { x: p.S.x + v.d * c, y: p.S.y + v.d * s };
  }

  /* ---------- parametry s rozsahy (Monte Carlo, citlivost) ----------
     Každý nejistý vstup má rozsah [lo, hi]; hodnota = lo + t·(hi − lo), t = 0,5 = střed. */
  function parametry(p) {
    const out = [];
    p.vozidla.forEach((v, i) => {
      const X = v.nazev || (i ? 'B' : 'A'), m = hmotnost(v);
      out.push({ id: 'm' + i, i, k: 'm', nazev: `hmotnost ${X}`, lo: m - v.hmotTol, hi: m + v.hmotTol, j: 'kg' });
      out.push({ id: 'theta' + i, i, k: 'theta', nazev: `úhel příjezdu ${X}`, lo: v.theta - v.thetaTol, hi: v.theta + v.thetaTol, j: '°' });
      out.push({ id: 'phi' + i, i, k: 'phi', nazev: `úhel dojezdu ${X}`, lo: v.phi - v.phiTol, hi: v.phi + v.phiTol, j: '°' });
      out.push({ id: 'd' + i, i, k: 'd', nazev: `délka dojezdu ${X}`, lo: Math.max(0, v.d - v.dTol), hi: v.d + v.dTol, j: 'm' });
      const [f0, f1] = rozsahF(p, v);
      out.push({ id: 'f' + i, i, k: 'f', nazev: `součinitel dojezdu f ${X}`, lo: f0, hi: f1, j: '' });
      if (v.stopa > 0) {
        out.push({ id: 's' + i, i, k: 'stopa', nazev: `brzdná stopa ${X}`, lo: Math.max(0, v.stopa - v.stopaTol), hi: v.stopa + v.stopaTol, j: 'm' });
        const [a, b] = rozsahMu(p);
        out.push({ id: 'mu' + i, i, k: 'muStopa', nazev: `μ brzdné stopy ${X}`, lo: a, hi: b, j: '' });
      }
      if (v.znamaV) out.push({ id: 'zn' + i, i, k: 'znama', nazev: `známá rychlost ${X}`, lo: ms(Math.min(v.znamaOd, v.znamaDo)), hi: ms(Math.max(v.znamaOd, v.znamaDo)), j: 'km/h', naKmh: true });
    });
    if (p.sklon || p.sklonTol) out.push({ id: 'sklon', i: -1, k: 'sklon', nazev: 'sklon', lo: p.sklon - p.sklonTol, hi: p.sklon + p.sklonTol, j: '%' });
    return out;
  }
  // konkrétní hodnoty pro výpočet; t(par) → 0…1 (výchozí střed)
  function sestav(p, t, par) {
    par = par || parametry(p);
    const h = {
      m: [0, 0], theta: [0, 0], phi: [0, 0], d: [0, 0], f: [0, 0], stopa: [0, 0], muStopa: [0, 0],
      tn: p.vozidla.map(v => v.tn || 0), znama: [null, null], sklon: p.sklon || 0, sklonSmer: p.sklonSmer || 0
    };
    for (const q of par) {
      const x = q.lo + (t ? t(q) : 0.5) * (q.hi - q.lo);
      if (q.i < 0) h[q.k] = x; else h[q.k][q.i] = x;
    }
    return h;
  }

  /* ---------- jeden výpočet z konkrétních hodnot ---------- */
  function spocti(h) {
    const r = { ok: false };
    const aD = [0, 1].map(i => zpomaleni(h.f[i], h.sklon, h.phi[i], h.sklonSmer));
    if (aD.some(a => !(a > 0))) { r.chyba = 'dojezd'; r.text = 'Na tomto sklonu by vozidlo při zadaném součiniteli dojezdu nezastavilo.'; return r; }
    const u = [0, 1].map(i => Math.sqrt(2 * aD[i] * h.d[i]));
    const eu = [0, 1].map(i => jed(h.phi[i])), ev = [0, 1].map(i => jed(h.theta[i]));
    const P = [h.m[0] * u[0] * eu[0][0] + h.m[1] * u[1] * eu[1][0], h.m[0] * u[0] * eu[0][1] + h.m[1] * u[1] * eu[1][1]];
    let v, rezidum = 0;
    const zn = h.znama;
    if (zn[0] == null && zn[1] == null) {
      const det = Math.sin((h.theta[1] - h.theta[0]) * RAD);
      if (Math.abs(det) < Math.sin(5 * RAD)) { r.chyba = 'rovnobezne'; r.text = 'Směry příjezdu jsou (téměř) rovnoběžné – hybnost sama rychlosti neurčí. Zadejte známou rychlost jednoho vozidla.'; return r; }
      const a = (P[0] * ev[1][1] - ev[1][0] * P[1]) / det, b = (ev[0][0] * P[1] - ev[0][1] * P[0]) / det;
      v = [a / h.m[0], b / h.m[1]];
    } else if (zn[0] != null && zn[1] != null) {
      v = [zn[0], zn[1]];
      const Rx = P[0] - h.m[0] * v[0] * ev[0][0] - h.m[1] * v[1] * ev[1][0], Ry = P[1] - h.m[0] * v[0] * ev[0][1] - h.m[1] * v[1] * ev[1][1];
      rezidum = delka(Rx, Ry);
    } else {
      // známá rychlost jednoho vozidla → druhé z průmětu do jeho směru (nejmenší čtverce), zbytek = nesoulad
      const k = zn[0] != null ? 0 : 1, j = 1 - k;
      const Rx = P[0] - h.m[k] * zn[k] * ev[k][0], Ry = P[1] - h.m[k] * zn[k] * ev[k][1];
      v = []; v[k] = zn[k]; v[j] = (Rx * ev[j][0] + Ry * ev[j][1]) / h.m[j];
      rezidum = Math.abs(Rx * ev[j][1] - Ry * ev[j][0]);
    }
    r.v = v; r.u = u; r.aDojezd = aD; r.P = P;
    r.rezidum = rezidum; r.rezidumRel = rezidum / Math.max(1e-9, delka(P[0], P[1]));
    if (v.some(x => !(x >= 0))) { r.chyba = 'zaporna'; r.text = 'Rychlost před střetem vychází záporná – vstupy si odporují (zkontrolujte úhly a dojezdy).'; return r; }
    // rychlost na začátku brzdné stopy před střetem (jako Rychlost z brzdné stopy: + a·t_n/2 za náběh)
    r.v0 = [0, 1].map(i => {
      if (!(h.stopa[i] > 0)) return null;
      const a = zpomaleni(h.muStopa[i], h.sklon, h.theta[i], h.sklonSmer);
      if (!(a > 0)) return NaN;
      return Math.sqrt(v[i] * v[i] + 2 * a * h.stopa[i]) + a * (h.tn[i] || 0) / 2;
    });
    // změna rychlosti, směr síly (PDOF), energie, restituce
    const vv = [0, 1].map(i => [v[i] * ev[i][0], v[i] * ev[i][1]]), uu = [0, 1].map(i => [u[i] * eu[i][0], u[i] * eu[i][1]]);
    const dvv = [0, 1].map(i => [uu[i][0] - vv[i][0], uu[i][1] - vv[i][1]]);
    r.dv = dvv.map(x => delka(x[0], x[1]));
    r.pdof = dvv.map(x => uhelVektoru(x[0], x[1]));          // směr síly působící NA vozidlo (globálně)
    // hodinový směr: odkud síla přichází vůči podélné ose (0° = zepředu = 12 h, 90° = zprava = 3 h)
    r.hodinyUhel = [0, 1].map(i => n360(-(n180(r.pdof[i] + 180 - h.theta[i]))));
    r.hodiny = r.hodinyUhel.map(a => { const x = Math.round(a / 30) % 12; return x === 0 ? 12 : x; });
    r.Epred = 0.5 * (h.m[0] * v[0] * v[0] + h.m[1] * v[1] * v[1]);
    r.Epo = 0.5 * (h.m[0] * u[0] * u[0] + h.m[1] * u[1] * u[1]);
    r.ztrata = r.Epred - r.Epo;
    const vr = [vv[0][0] - vv[1][0], vv[0][1] - vv[1][1]], ur = [uu[0][0] - uu[1][0], uu[0][1] - uu[1][1]];
    const nl = delka(dvv[0][0], dvv[0][1]);
    if (nl > 1e-9) {
      const n = [dvv[0][0] / nl, dvv[0][1] / nl];
      const w = vr[0] * n[0] + vr[1] * n[1], w2 = ur[0] * n[0] + ur[1] * n[1];
      r.restituce = w < -1e-9 ? -w2 / w : NaN;
      // úhel mezi silou na A a opačnou relativní rychlostí (náraz „proti“ přibližování ≤ 90°)
      const vl = delka(vr[0], vr[1]);
      r.uhelSily = vl > 1e-9 ? Math.acos(Math.max(-1, Math.min(1, -(vr[0] * n[0] + vr[1] * n[1]) / vl))) / RAD : NaN;
    } else { r.restituce = NaN; r.uhelSily = NaN; }
    r.ok = true;
    return r;
  }

  const vyhodnot = p => spocti(sestav(p));

  /* ---------- Monte Carlo ---------- */
  function kvantil(serazene, q) {
    if (!serazene.length) return NaN;
    const x = (serazene.length - 1) * q, i = Math.floor(x), f = x - i;
    return i + 1 < serazene.length ? serazene[i] + f * (serazene[i + 1] - serazene[i]) : serazene[i];
  }
  const VELICINY = ['vA', 'vB', 'uA', 'uB', 'v0A', 'v0B', 'dvA', 'dvB', 'ztrata', 'restituce'];
  function monteCarlo(p, o) {
    o = o || {};
    const n = Math.max(100, Math.min(50000, Math.round(o.n || (p.mc && p.mc.n) || 4000)));
    const r = rng(o.seed != null ? o.seed : (p.mc && p.mc.seed) || 1);
    const par = parametry(p);
    const data = {}; VELICINY.forEach(k => { data[k] = []; });
    const duvody = {}; let zapornaE = 0, platnych = 0;
    // dovolená rychlost: posuzuje se rychlost na začátku brzdné stopy, bez stopy rychlost před střetem
    const limity = p.vozidla.map(v => v.limit > 0 ? v.limit : null), nad = [0, 0], posouzeno = [0, 0];
    const vzorky = [], kazdy = Math.max(1, Math.floor(n / (o.vzorku || 1500)));
    for (let k = 0; k < n; k++) {
      const t = par.map(() => r());
      let idx = 0;
      const h = sestav(p, () => t[idx++], par);
      const x = spocti(h);
      if (!x.ok) { duvody[x.chyba] = (duvody[x.chyba] || 0) + 1; continue; }
      platnych++;
      if (x.ztrata < 0) zapornaE++;
      data.vA.push(kmh(x.v[0])); data.vB.push(kmh(x.v[1])); data.uA.push(kmh(x.u[0])); data.uB.push(kmh(x.u[1]));
      if (x.v0[0] != null && Number.isFinite(x.v0[0])) data.v0A.push(kmh(x.v0[0]));
      if (x.v0[1] != null && Number.isFinite(x.v0[1])) data.v0B.push(kmh(x.v0[1]));
      data.dvA.push(kmh(x.dv[0])); data.dvB.push(kmh(x.dv[1])); data.ztrata.push(x.ztrata / 1000);
      if (Number.isFinite(x.restituce)) data.restituce.push(x.restituce);
      limity.forEach((L, i) => {
        if (L == null) return;
        const rv = x.v0[i] != null && Number.isFinite(x.v0[i]) ? x.v0[i] : x.v[i];
        posouzeno[i]++; if (kmh(rv) > L) nad[i]++;
      });
      if (k % kazdy === 0) vzorky.push([kmh(x.v[0]), kmh(x.v[1])]);
    }
    const q = {};
    for (const k of VELICINY) {
      const s = data[k].sort((a, b) => a - b);
      q[k] = s.length ? { od: kvantil(s, 0.025), med: kvantil(s, 0.5), do: kvantil(s, 0.975), n: s.length } : null;
    }
    const limit = limity.map((L, i) => L == null || !posouzeno[i] ? null : { limit: L, podil: nad[i] / posouzeno[i], n: posouzeno[i] });
    return { n, platnych, neplatnych: n - platnych, duvody, zapornaE, q, vzorky, limit };
  }

  /* ---------- citlivost: každý vstup zvlášť na dolní a horní mez, ostatní ve středu ---------- */
  function citlivost(p) {
    const par = parametry(p);
    const stred = vyhodnot(p);
    const radky = par.map(q => {
      const x = [0, 1].map(kraj => spocti(sestav(p, z => z === q ? kraj : 0.5, par)));
      const val = (i, j) => x[j].ok ? kmh(x[j].v[i]) : NaN;
      return { id: q.id, nazev: q.nazev, lo: q.lo, hi: q.hi, j: q.j, naKmh: q.naKmh,
        vA: [val(0, 0), val(0, 1)], vB: [val(1, 0), val(1, 1)], ok: x.every(y => y.ok) };
    });
    const rozpeti = r => Math.max(Math.abs(r.vA[1] - r.vA[0]) || 0, Math.abs(r.vB[1] - r.vB[0]) || 0);
    radky.sort((a, b) => rozpeti(b) - rozpeti(a));
    return { stred: stred.ok ? [kmh(stred.v[0]), kmh(stred.v[1])] : null, radky };
  }

  /* ---------- kontrola plausibility ---------- */
  function kontroly(p, x, mc) {
    const out = [];
    const pridej = (uroven, text) => out.push({ uroven, text });
    const V = p.vozidla, nz = i => V[i].nazev || (i ? 'B' : 'A');
    const zname = V.filter(v => v.znamaV).length;
    const odchylka = Math.abs(Math.sin((V[1].theta - V[0].theta) * RAD));
    if (!zname) {
      if (odchylka < Math.sin(5 * RAD)) pridej('chyba', 'Směry příjezdu jsou rovnoběžné (zadní najetí, čelní srážka v ose): ze zachování hybnosti nelze určit obě rychlosti. Zadejte známou rychlost jednoho vozidla (záznam, svědek, tachograf).');
      else if (odchylka < Math.sin(15 * RAD)) pridej('pozor', `Směry příjezdu svírají jen ${Math.round(Math.asin(odchylka) / RAD)}° – soustava rovnic je špatně podmíněná, malá chyba úhlu dá velkou chybu rychlosti. Zvažte zadání známé rychlosti jednoho vozidla.`);
    }
    if (!x.ok) { pridej('chyba', x.text); return out; }
    if (x.ztrata < 0) pridej('chyba', `Kinetická energie po střetu je větší než před ním (o ${Math.round(-x.ztrata / 1000)} kJ) – fyzikálně nemožné. Vstupy (dojezdy, f, úhly) si odporují.`);
    else pridej('ok', `Ztráta kinetické energie při střetu je kladná (${Math.round(x.ztrata / 1000)} kJ, ${Math.round(100 * x.ztrata / Math.max(1, x.Epred))} % energie před střetem).`);
    if (Number.isFinite(x.uhelSily)) {
      if (x.uhelSily > 90) pridej('chyba', `Síla na vozidlo ${nz(0)} nemíří proti vzájemnému přibližování (úhel ${Math.round(x.uhelSily)}° > 90°) – takový ráz nemůže nastat.`);
      else if (x.uhelSily > 60) pridej('pozor', `Směr síly se od relativní rychlosti odchyluje o ${Math.round(x.uhelSily)}° – možné jen u klouzavého (tečného) střetu.`);
      else pridej('ok', `Směr síly se od opačné relativní rychlosti odchyluje o ${Math.round(x.uhelSily)}°.`);
    }
    if (Number.isFinite(x.restituce)) {
      if (x.restituce < -0.05) pridej('chyba', `Po střetu by se vozidla ve směru síly dál přibližovala (restituce ${c(x.restituce, 2)} < 0) – vstupy si odporují.`);
      else if (x.restituce > 0.5) pridej('pozor', `Vysoká restituce ${c(x.restituce, 2)} – u silničních střetů bývá většinou do 0,3 (u velmi pomalých nárazů víc).`);
    }
    [0, 1].forEach(i => {
      const m = MISTA[V[i].misto], a = x.hodinyUhel[i];
      if (!m) return;
      const lo = m.hodiny[0], hi = m.hodiny[1];
      const uvnitr = n360(a - lo) <= hi - lo;
      if (!uvnitr) pridej('pozor', `Síla na vozidlo ${nz(i)} přichází z ${x.hodiny[i]} h, ale zadané místo nárazu je ${m.nazev} – ověřte úhly nebo místo poškození.`);
    });
    if (x.rezidumRel > 0.1) pridej('pozor', `Zadaná známá rychlost nesedí se směry: ${Math.round(100 * x.rezidumRel)} % hybnosti po střetu zůstává nevysvětleno.`);
    V.forEach((v, i) => { if (v.d < 1) pridej('pozor', `Krátký dojezd vozidla ${nz(i)} (${c(v.d, 1)} m) – úhel dojezdu a f jsou nejisté, relativní chyba velká.`); });
    if (mc) {
      const pod = mc.neplatnych / mc.n;
      if (pod > 0.1) pridej('pozor', `V ${Math.round(pod * 100)} % náhodných kombinací vstupů výpočet nemá řešení (záporná rychlost, rovnoběžné směry…) – interval je jen z platných.`);
      if (mc.platnych && mc.zapornaE / mc.platnych > 0.05) pridej('pozor', `V ${Math.round(100 * mc.zapornaE / mc.platnych)} % kombinací vstupů by energie po střetu vzrostla – vstupy jsou na hraně fyzikální možnosti.`);
      ['vA', 'vB'].forEach((k, i) => {
        const q = mc.q[k];
        if (q && q.med > 1 && (q.do - q.od) / q.med > 0.6) pridej('pozor', `Rychlost ${nz(i)} je velmi nejistá (interval ${Math.round(q.od)}–${Math.round(q.do)} km/h). Rozhodující vstupy ukáže citlivost.`);
      });
    }
    return out;
  }

  /* ---------- dopředná fyzika pro ukázky se známou pravdou ----------
     Ráz bodových hmot: impuls J ve směru n (síla na A), restituce e podél n, tečné složky beze změny.
     Dojezd přímočaře se stálým zpomalením a = g·(f·cos α + sin α·cos(φ − ψ)). */
  function dopredu(o) {
    const vv = [0, 1].map(i => { const [c, s] = jed(o.theta[i]); return [ms(o.v[i]) * c, ms(o.v[i]) * s]; });
    const vr = [vv[0][0] - vv[1][0], vv[0][1] - vv[1][1]];
    const smerN = uhelVektoru(-vr[0], -vr[1]) + (o.odchylkaSily || 0);
    const n = jed(smerN);
    const w = vr[0] * n[0] + vr[1] * n[1];
    const J = -(1 + o.e) * w / (1 / o.m[0] + 1 / o.m[1]);
    const uu = [[vv[0][0] + J / o.m[0] * n[0], vv[0][1] + J / o.m[0] * n[1]], [vv[1][0] - J / o.m[1] * n[0], vv[1][1] - J / o.m[1] * n[1]]];
    const u = uu.map(x => delka(x[0], x[1])), phi = uu.map(x => uhelVektoru(x[0], x[1]));
    const d = [0, 1].map(i => {
      const a = zpomaleni(o.f[i], o.sklon, phi[i], o.sklonSmer);
      return u[i] * u[i] / (2 * a) * (o.zkraceni ? o.zkraceni[i] : 1);
    });
    const v0 = [0, 1].map(i => {
      if (!(o.stopa && o.stopa[i] > 0)) return null;
      const a = zpomaleni(o.muStopa[i], o.sklon, o.theta[i], o.sklonSmer);
      return kmh(Math.sqrt(ms(o.v[i]) ** 2 + 2 * a * o.stopa[i]) + a * (o.tn ? o.tn[i] : 0.2) / 2);
    });
    return { u: u.map(kmh), phi, d, v0, J, smerN: n360(smerN) };
  }

  /* ---------- galerie ukázek ---------- */
  const UKAZKY = [
    {
      klic: 'celni', ik: '↗↙', nazev: 'Čelní šikmý střet',
      popis: 'Dvě osobní auta v protisměru na suchém asfaltu, jedno přejíždí do protisměru. Obě po střetu dojíždějí smykem.',
      zkusit: ['Porovnejte interval s pravdou v panelu Výsledky.', 'V Diagramu hybnosti se oba řetězce vektorů (před a po) sejdou v jednom bodě.', 'Táhněte konečnou polohu B v náčrtu a sledujte, jak se mění rychlosti.'],
      povrch: 'asfalt_suchy', sklon: 0, sklonSmer: 90, e: 0.08, odchylkaSily: 6, seed: 101,
      voz: [
        { nazev: 'A osobní', hmotnost: 1320, naklad: 160, hmotTol: 60, delka: 4.7, sirka: 1.8, misto: 'predek', theta: 15, v: 74, f: 0.71, kola: 'blok', rot: 35 },
        { nazev: 'B osobní', hmotnost: 1480, naklad: 80, hmotTol: 60, delka: 4.6, sirka: 1.8, misto: 'predek', theta: 140, v: 52, f: 0.77, kola: 'blok', rot: -50 }
      ]
    },
    {
      klic: 'krizovatka', ik: '┼', nazev: 'Boční střet v křižovatce',
      popis: 'A vjíždí do křižovatky a před střetem brzdí (stopa 14 m na mokrém asfaltu), B jede po hlavní a A ho zasáhne do pravého boku.',
      zkusit: ['Výsledky ukazují i rychlost A na začátku brzdné stopy – stejný výpočet jako stránka Rychlost z brzdné stopy, jen s rychlostí při střetu na konci stopy.', 'V obci je limit 50 km/h: Výsledky ukážou, v kolika procentech kombinací vstupů ho A a B překročili (u A se posuzuje rychlost na začátku brzdění).', 'Citlivost: který vstup interval nejvíc rozšiřuje?'],
      povrch: 'asfalt_mokry', sklon: 0, sklonSmer: 90, e: 0.1, odchylkaSily: -8, seed: 202,
      voz: [
        { nazev: 'A osobní', hmotnost: 1240, naklad: 90, hmotTol: 50, delka: 4.3, sirka: 1.75, misto: 'predek', theta: 90, v: 48, f: 0.55, kola: 'blok', stopa: 14, muStopa: 0.55, tn: 0.2, limit: 50, rot: 20 },
        { nazev: 'B osobní', hmotnost: 1390, naklad: 160, hmotTol: 50, delka: 4.6, sirka: 1.8, misto: 'pravy', theta: 0, v: 46, f: 0.5, kola: 'blok', limit: 50, rot: 40 }
      ]
    },
    {
      klic: 'zadni', ik: '⇉', nazev: 'Najetí zezadu',
      popis: 'A najede do pomaleji jedoucího B. Směry příjezdu jsou skoro rovnoběžné, takže hybnost sama nestačí – rychlost B je známá z jiného zdroje (záznam z kamery 15–25 km/h).',
      zkusit: ['Zrušte „známou rychlost“ u B – výpočet ohlásí, že rovnice nejsou řešitelné.', 'B po nárazu jen částečně brzdí (f = podíl μ), proto je jeho dojezd dlouhý a interval široký.'],
      povrch: 'asfalt_suchy', sklon: 0, sklonSmer: 90, e: 0.15, odchylkaSily: 0, seed: 303,
      voz: [
        { nazev: 'A osobní', hmotnost: 1460, naklad: 80, hmotTol: 60, delka: 4.7, sirka: 1.8, misto: 'predek', theta: 0, v: 63, f: 0.74, kola: 'blok', rot: 4 },
        { nazev: 'B osobní', hmotnost: 1180, naklad: 150, hmotTol: 60, delka: 4.1, sirka: 1.75, misto: 'zadek', theta: 3, v: 20, f: 0.36, kola: 'castecne', znama: [15, 25], rot: -6 }
      ]
    },
    {
      klic: 'kamion', ik: '🚛', nazev: 'Nákladní auto a osobní auto',
      popis: 'Nákladní souprava (18 t) zasáhne osobní auto (1,2 t) přejíždějící zprava. Ukazuje, jak špatně se ze zachování hybnosti určuje rychlost lehkého vozidla.',
      zkusit: ['Rychlost nákladního auta vyjde úzce, rychlost osobního auta velmi široce – o ní rozhoduje nepatrná odchylka dojezdu těžkého vozidla.', 'Citlivost ukáže, že nejvíc záleží na úhlu dojezdu nákladního auta.'],
      povrch: 'asfalt_suchy', sklon: 0, sklonSmer: 90, e: 0.05, odchylkaSily: 10, seed: 404,
      voz: [
        { nazev: 'A nákladní', hmotnost: 15200, naklad: 2800, hmotTol: 800, delka: 12, sirka: 2.55, misto: 'predek', theta: 0, v: 42, f: 0.5, kola: 'vlastni', fMin: 0.4, fMax: 0.6, rot: 4 },
        { nazev: 'B osobní', hmotnost: 1150, naklad: 75, hmotTol: 50, delka: 4.2, sirka: 1.75, misto: 'levy', theta: 90, v: 36, f: 0.72, kola: 'blok', rot: 70 }
      ]
    },
    {
      klic: 'svah', ik: '⛰', nazev: 'Šikmý střet z kopce na mokru',
      popis: 'Mokrý beton, sklon 6 % stoupající k severu. A jede z kopce, B přijíždí šikmo zleva; dojezd A vede z kopce, B do kopce.',
      zkusit: ['Nastavte sklon na 0 % a sledujte, o kolik se odhad posune.', 'Sklon působí na každý dojezd podle jeho směru: a = g·(f·cos α + sin α·cos(φ − ψ)).'],
      povrch: 'beton_mokry', sklon: 6, sklonTol: 1, sklonSmer: 90, e: 0.1, odchylkaSily: -5, seed: 505,
      voz: [
        { nazev: 'A osobní', hmotnost: 1550, naklad: 230, hmotTol: 70, delka: 4.8, sirka: 1.85, misto: 'predek', theta: 265, v: 58, f: 0.6, kola: 'blok', rot: -30 },
        { nazev: 'B dodávka', hmotnost: 2100, naklad: 400, hmotTol: 150, delka: 5.4, sirka: 2.0, misto: 'levy', theta: 30, v: 44, f: 0.52, kola: 'blok', rot: 45 }
      ]
    },
    {
      klic: 'sloup', ik: '⚠', nazev: 'MIMO MODEL: náraz do sloupu při dojezdu', mimo: true,
      popis: 'Stejný typ boční srážky, ale vozidlo B při dojezdu narazí do sloupu a zastaví se po 45 % volné dráhy. Model počítá jen se třením, takže energii pohlcenou sloupem nevidí.',
      zkusit: ['Interval rychlostí pravdu mine – nástroj neví o sekundárním nárazu a dojezd B považuje za celý brzdný.', 'V praxi se v takovém případě dojezd B nepoužije a energie nárazu do sloupu se odhadne zvlášť (deformace) – to tento nástroj neumí.'],
      povrch: 'asfalt_suchy', sklon: 0, sklonSmer: 90, e: 0.1, odchylkaSily: -6, seed: 606,
      voz: [
        { nazev: 'A osobní', hmotnost: 1300, naklad: 80, hmotTol: 50, delka: 4.4, sirka: 1.8, misto: 'predek', theta: 90, v: 55, f: 0.75, kola: 'blok', rot: 15 },
        { nazev: 'B osobní', hmotnost: 1350, naklad: 80, hmotTol: 50, delka: 4.5, sirka: 1.8, misto: 'levy', theta: 180, v: 50, f: 0.72, kola: 'blok', zkraceni: 0.45, rot: 60 }
      ]
    }
  ];
  const TOL = { theta: 3, phi: 3 };

  function vytvorUkazku(klic) {
    const U = UKAZKY.find(x => x.klic === klic);
    if (!U) return null;
    const r = rng(U.seed);
    const chyba = tol => (r() - 0.5) * tol;  // syntetická chyba měření v ±tol/2
    const V = U.voz;
    const pr = dopredu({
      m: V.map(v => v.hmotnost + v.naklad), v: V.map(v => v.v), theta: V.map(v => v.theta), e: U.e, odchylkaSily: U.odchylkaSily,
      f: V.map(v => v.f), sklon: U.sklon, sklonSmer: U.sklonSmer, stopa: V.map(v => v.stopa || 0), muStopa: V.map(v => v.muStopa || 0),
      tn: V.map(v => v.tn || 0.2), zkraceni: V.map(v => v.zkraceni || 1)
    });
    const p = novyProjekt();
    p.id = 'ukazka-' + klic; p.nazev = U.nazev; p.popis = U.popis;
    p.povrch = U.povrch; p.sklon = U.sklon; p.sklonTol = U.sklonTol || 0; p.sklonSmer = U.sklonSmer;
    p.vozidla = V.map((v, i) => {
      const o = noveVozidlo(i);
      Object.assign(o, { nazev: v.nazev, hmotnost: v.hmotnost, naklad: v.naklad, hmotTol: v.hmotTol, delka: v.delka, sirka: v.sirka, misto: v.misto, kola: v.kola });
      if (v.fMin != null) { o.fMin = v.fMin; o.fMax = v.fMax; }
      o.theta = Math.round(v.theta + chyba(TOL.theta)) + 0; o.thetaTol = TOL.theta;
      o.phi = Math.round(pr.phi[i] + chyba(TOL.phi)) + 0; o.phiTol = TOL.phi;
      const dTol = Math.max(0.3, Math.round(pr.d[i] * 0.05 * 10) / 10);
      o.d = Math.round((pr.d[i] + chyba(dTol)) * 10) / 10; o.dTol = dTol;
      if (v.stopa) { o.stopa = Math.round((v.stopa + chyba(0.3)) * 10) / 10; o.stopaTol = 0.3; o.tn = v.tn || 0.2; }
      if (v.limit) o.limit = v.limit;
      if (v.znama) { o.znamaV = true; o.znamaOd = v.znama[0]; o.znamaDo = v.znama[1]; }
      o.natoceni = Math.round(n360(pr.phi[i] + (v.rot || 0)));
      return o;
    });
    // překážka, do které vozidlo při dojezdu narazilo (jen do náčrtu): kousek za konečnou polohou ve směru dojezdu
    p.prekazky = [];
    V.forEach((v, i) => {
      if (!v.zkraceni) return;
      const K = konecnaPoloha(p, i), [ex, ey] = jed(p.vozidla[i].phi), o = 1.2;
      p.prekazky.push({ x: Math.round((K.x + ex * o) * 10) / 10, y: Math.round((K.y + ey * o) * 10) / 10, r: 0.15, popis: 'sloup' });
    });
    p.ukazka = {
      klic, mimo: !!U.mimo, zkusit: U.zkusit,
      pravda: { v: V.map(v => v.v), u: pr.u, v0: pr.v0, phi: pr.phi, d: pr.d, f: V.map(v => v.f), m: V.map(v => v.hmotnost + v.naklad) }
    };
    return p;
  }

  const API = {
    VERZE, G, POVRCHY, KOLA, MISTA, UKAZKY, kmh, ms, n360, n180, jed, uhelVektoru, rng, kvantil,
    noveVozidlo, novyProjekt, migruj, rozsahMu, rozsahF, hmotnost, zpomaleni, konecnaPoloha,
    parametry, sestav, nastavJazyk: j => { jazyk = j || 'cs'; }, spocti, vyhodnot, monteCarlo, citlivost, kontroly, dopredu, vytvorUkazku
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.STRET = API;
})();
