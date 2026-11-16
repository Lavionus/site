/* Běžecký plán a tempa – jádro bez DOM (test: _test/bezecky_plan_test.js).
   Výkonnostní index VDOT podle rovnic Daniels–Gilbert (Oxygen Power, 1979), Riegelův vzorec,
   tréninková tempa, kalkulačka tempa, mezičasy, úprava na teplotu a převýšení,
   generátor tréninkového plánu a export .ics. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_bezecky_plan';

  const VZDALENOSTI = [
    { id: '1500', m: 1500, nazev: '1500 m' },
    { id: 'mile', m: 1609.344, nazev: '1 míle' },
    { id: '3000', m: 3000, nazev: '3000 m' },
    { id: '5k', m: 5000, nazev: '5 km' },
    { id: '10k', m: 10000, nazev: '10 km' },
    { id: '15k', m: 15000, nazev: '15 km' },
    { id: 'pul', m: 21097.5, nazev: 'Půlmaraton' },
    { id: 'mar', m: 42195, nazev: 'Maraton' }
  ];
  const VZD = Object.fromEntries(VZDALENOSTI.map(v => [v.id, v]));
  const ZAVODY = ['5k', '10k', 'pul', 'mar'];

  /* ---------- Daniels–Gilbert ----------
     VO2 (ml/kg/min) = −4,60 + 0,182258·v + 0,000104·v²   (v v m/min)
     podíl VO2max udržitelný po dobu t (min) = 0,8 + 0,1894393·e^(−0,012778·t) + 0,2989558·e^(−0,1932605·t)
     VDOT = VO2 / podíl */
  const vo2 = v => -4.60 + 0.182258 * v + 0.000104 * v * v;
  const podilMax = t => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  function vdot(m, s) {
    if (!(m > 0 && s > 0)) return NaN;
    const t = s / 60;
    return vo2(m / t) / podilMax(t);
  }
  /* rychlost (m/min) odpovídající dané spotřebě kyslíku – inverze kvadratické rovnice */
  function rychlostZVo2(x) {
    const a = 0.000104, b = 0.182258, c = -4.60 - x;
    return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  }
  /* čas (s) na vzdálenost m, který odpovídá danému VDOT (půlení intervalu) */
  function predikce(vd, m) {
    let lo = m / 12, hi = m / 0.5;                 // 12 m/s … 0,5 m/s
    for (let i = 0; i < 80; i++) {
      const s = (lo + hi) / 2;
      if (vdot(m, s) > vd) lo = s; else hi = s;
    }
    return (lo + hi) / 2;
  }
  /* Riegel (1981): T2 = T1 · (D2/D1)^1,06 */
  const riegel = (m1, s1, m2, k) => s1 * Math.pow(m2 / m1, k || 1.06);

  /* tréninková tempa v s/km; E = 60–70 % VO2max, T = 88 %, I = 97,5 %,
     M = tempo předpovězeného maratonu, R = I − 6 s na 400 m (pravidlo J. Danielse) */
  const tempoZPodilu = (vd, p) => 60000 / rychlostZVo2(vd * p);
  function tempa(vd) {
    const I = tempoZPodilu(vd, 0.975);
    return {
      E: [tempoZPodilu(vd, 0.70), tempoZPodilu(vd, 0.60)],
      M: predikce(vd, 42195) / 42.195,
      T: tempoZPodilu(vd, 0.88),
      I,
      R: I - 15
    };
  }
  /* tempo závodu na zvolenou vzdálenost (s/km) */
  const tempoZavodu = (vd, id) => predikce(vd, VZD[id].m) / (VZD[id].m / 1000);

  /* ---------- formáty a čtení ---------- */
  const dvoj = n => String(n).padStart(2, '0');
  function formatCas(s, desetiny) {
    if (!isFinite(s)) return '–';
    const zaok = desetiny ? Math.round(s * 10) / 10 : Math.round(s);
    const h = Math.floor(zaok / 3600), m = Math.floor(zaok % 3600 / 60), sek = zaok % 60;
    const ss = desetiny ? sek.toFixed(1).padStart(4, '0') : dvoj(sek);
    return h ? h + ':' + dvoj(m) + ':' + ss : m + ':' + ss;
  }
  const formatTempo = s => isFinite(s) && s > 0 ? formatCas(s) : '–';
  const kmh = sPerKm => sPerKm > 0 ? 3600 / sPerKm : NaN;
  const formatKm = x => isFinite(x) ? String(Math.round(x * 100) / 100).replace('.', ',') : '–';
  const cislo = (x, d) => isFinite(x) ? x.toFixed(d == null ? 1 : d).replace('.', ',') : '–';
  /* "1:23:45", "23:45", "23,5" (min), "45" (min) → sekundy; neplatné → NaN */
  function parsujCas(t) {
    t = String(t == null ? '' : t).trim().replace(',', '.');
    if (!t) return NaN;
    if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t) * 60;
    const c = t.split(':');
    if (c.length > 3 || c.some(x => !/^\d+(\.\d+)?$/.test(x))) return NaN;
    const n = c.map(Number);
    if (n.slice(1).some(x => x >= 60)) return NaN;
    return n.reduce((a, x) => a * 60 + x, 0);
  }
  /* tempo "4:30" = min:s na km → s/km */
  function parsujTempo(t) {
    t = String(t == null ? '' : t).trim().replace(',', '.');
    if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t) * 60;
    const c = t.split(':');
    if (c.length !== 2 || c.some(x => !/^\d+(\.\d+)?$/.test(x)) || +c[1] >= 60) return NaN;
    return +c[0] * 60 + +c[1];
  }
  const parsujCislo = t => { const x = parseFloat(String(t == null ? '' : t).replace(',', '.').replace(/\s/g, '')); return isFinite(x) ? x : NaN; };

  /* kalkulačka: ze dvou údajů (m, s, s/km) dopočítá třetí */
  function dopocti(o) {
    const m = o.m > 0 ? o.m : NaN, s = o.s > 0 ? o.s : NaN, p = o.tempo > 0 ? o.tempo : NaN;
    if (isFinite(m) && isFinite(s)) return { m, s, tempo: s / (m / 1000), dopocteno: 'tempo' };
    if (isFinite(m) && isFinite(p)) return { m, s: p * m / 1000, tempo: p, dopocteno: 's' };
    if (isFinite(s) && isFinite(p)) return { m: s / p * 1000, s, tempo: p, dopocteno: 'm' };
    return null;
  }

  /* mezičasy: úsek po `usek` metrech, negativní split = druhá polovina o `neg` % rychlejší než první */
  function mezicasy(m, s, usek, neg) {
    const n = (neg || 0) / 100, pul = m / 2;
    const h1 = s / (2 - n), h2 = h1 * (1 - n);
    const kum = x => x <= pul ? x / pul * h1 : h1 + (x - pul) / pul * h2;
    const rad = [];
    let pred = 0;
    for (let x = usek; ; x += usek) {
      const k = Math.min(x, m), t = kum(k);
      rad.push({ m: k, usek: t - pred, cas: t, tempo: (t - pred) / ((k - (rad.length ? rad[rad.length - 1].m : 0)) / 1000) });
      pred = t;
      if (k >= m - 1e-9) break;
      if (rad.length > 500) break;
    }
    return rad;
  }

  /* ---------- úprava na teplotu (orientačně) ----------
     Zjednodušená křivka podle trendu v Ely M. R. et al. (2007), Impact of weather on marathon-running
     performance, Med Sci Sports Exerc 39(3):487–493: optimum kolem 10 °C, nad ~12 °C zpomalení roste
     rychleji než lineárně (≈ 3 % při 20 °C, ≈ 5 % při 25 °C, ≈ 8 % při 30 °C). Vlhkost a slunce efekt zesilují. */
  function zpomaleniTeplota(t) {
    if (!isFinite(t) || t <= 12) return 0;
    const d = t - 12;
    return 0.25 * d + 0.012 * d * d;               // %
  }

  /* ---------- převýšení (orientačně) ----------
     Energetická cena běhu ve sklonu i (Minetti A. E. et al. 2002, J Appl Physiol 93:1039–1046):
     C(i) = 155,4i⁵ − 30,4i⁴ − 43,3i³ + 46,3i² + 19,5i + 3,6 (J/kg/m). Stoupání a klesání leží na úsecích
     s průměrným sklonem `sklon`; z úspory z kopce se započte jen polovina (v závodě ji běžec plně nevyužije). */
  const cenaMinetti = i => 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;
  function faktorPrevyseni(m, nahoru, dolu, sklon) {
    nahoru = Math.max(0, nahoru || 0); dolu = Math.max(0, dolu || 0);
    if (!(m > 0) || !(nahoru + dolu)) return 1;
    let g = Math.min(0.4, Math.max(sklon || 0.05, (nahoru + dolu) / m));
    const lu = nahoru / g, ld = dolu / g, c0 = cenaMinetti(0);
    const cDolu = c0 - (c0 - cenaMinetti(-g)) / 2;
    return ((m - lu - ld) * c0 + lu * cenaMinetti(g) + ld * cDolu) / (m * c0);
  }

  /* ---------- data a kalendář ---------- */
  function jeDatum(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
    const [r, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(r, m - 1, d));
    return dt.getUTCFullYear() === r && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  const naDen = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
  const zDne = n => new Date(n * 86400000).toISOString().slice(0, 10);
  const pridejDny = (s, n) => zDne(naDen(s) + n);
  const denTydne = s => (new Date(naDen(s) * 86400000).getUTCDay() + 6) % 7;   // 0 = pondělí
  const pondeli = s => pridejDny(s, -denTydne(s));
  function dnesIso(d) { d = d || new Date(); return d.getFullYear() + '-' + dvoj(d.getMonth() + 1) + '-' + dvoj(d.getDate()); }
  const formatDatum = s => { const [r, m, d] = s.split('-'); return +d + '. ' + +m + '. ' + r; };

  /* ---------- generátor plánu ---------- */
  const LADENI = { '5k': [0.6], '10k': [0.6], pul: [0.75, 0.5], mar: [0.8, 0.65, 0.45] };
  const VRCHOL = { '5k': 40, '10k': 50, pul: 60, mar: 70 };       // doporučený vrchol km/týden při 5 dnech
  const DLOUHY_MAX = { '5k': 14, '10k': 18, pul: 22, mar: 32 };
  /* rozvržení dní (0 = po … 6 = ne) pro dlouhý běh v neděli */
  const ROZVRH = {
    3: { 1: 'Q1', 3: 'E', 6: 'L' },
    4: { 1: 'Q1', 2: 'E', 4: 'Q2', 6: 'L' },
    5: { 1: 'Q1', 2: 'E', 4: 'Q2', 5: 'E', 6: 'L' },
    6: { 0: 'E', 1: 'Q1', 2: 'E', 4: 'Q2', 5: 'E', 6: 'L' }
  };
  const FAZE = { zaklad: 'Základ', rozvoj: 'Rozvoj', specifika: 'Závodní příprava', ladeni: 'Ladění' };
  const pul = x => Math.round(x * 2) / 2;
  const mezi = (x, a, b) => Math.min(b, Math.max(a, x));

  function objemy(vstup) {
    const z = vstup.zavod, lad = LADENI[z], n = vstup.tydnu - lad.length;
    const start = Math.max(10, vstup.objem);
    const vrchol = Math.max(start, VRCHOL[z] * vstup.dni / 5);
    const rad = [];
    let b = start, max = start;
    for (let k = 1; k <= n; k++) {
      if (k > 1) b = Math.min(vrchol, b * 1.1);
      const odlehceni = k % 4 === 0 && k < n;
      if (odlehceni) { rad.push({ km: b * 0.8, odlehceni: true }); b = b / 1.1; }  // po odlehčení pokračuje ze stejné úrovně
      else rad.push({ km: b, odlehceni: false });
      max = Math.max(max, b);
    }
    lad.forEach(f => rad.push({ km: max * f, odlehceni: false, ladeni: true }));
    return { rad, vrchol, max, dosazeno: max >= vrchol - 0.5 };
  }

  function fazeTydne(k, n, nLad) {
    if (k > n - nLad) return 'ladeni';
    const tren = n - nLad, z = Math.ceil(tren * 0.3), r = Math.round(tren * 0.35);
    return k <= z ? 'zaklad' : k <= z + r ? 'rozvoj' : 'specifika';
  }

  /* jeden trénink kvality; vrací {typ, nazev, popis, km} */
  function kvalita(druh, vol, vd, z) {
    const P = tempa(vd), f = formatTempo;
    if (druh === 'S') return { typ: 'S', nazev: 'Lehký běh + rovinky', km: pul(Math.max(4, vol * 0.15)),
      popis: `lehce ${f(P.E[0])}–${f(P.E[1])} /km, na konci 6–8× 100 m rovinky (uvolněně rychle, chůze zpět)` };
    if (druh === 'R') {
      const prace = mezi(vol * 0.05, 1.6, 8), d = prace >= 3 ? 400 : 200, n = mezi(Math.round(prace * 1000 / d), 6, 16);
      return { typ: 'R', nazev: 'Opakování (R)', km: pul(3.5 + n * d / 1000 * 2),
        popis: `rozklus 2 km E, ${n}× ${d} m v tempu R ${f(P.R * d / 1000)} (${f(P.R)} /km), pauza ${d} m klusem, výklus 1,5 km E` };
    }
    if (druh === 'I') {
      const prace = mezi(vol * 0.08, 3, 10), d = prace >= 5 ? 1000 : 800, n = mezi(Math.round(prace * 1000 / d), 3, 10);
      return { typ: 'I', nazev: 'Intervaly (I)', km: pul(3.5 + n * d / 1000 * 1.6),
        popis: `rozklus 2 km E, ${n}× ${d} m v tempu I ${f(P.I * d / 1000)} (${f(P.I)} /km), pauza 2–3 min klusem, výklus 1,5 km E` };
    }
    if (druh === 'T') {
      const n = mezi(Math.round(vol * 0.10), 3, 10);
      return { typ: 'T', nazev: 'Prahový běh (T)', km: pul(3.5 + n * 1.1),
        popis: `rozklus 2 km E, ${n}× 1 km v tempu T ${f(P.T)} /km, pauza 1 min klusem, výklus 1,5 km E` };
    }
    if (druh === 'Z') {
      const tz = tempoZavodu(vd, z);
      if (z === 'pul') { const n = mezi(Math.round(vol * 0.15), 4, 12);
        return { typ: 'Z', nazev: 'Závodní tempo', km: pul(3.5 + n), popis: `rozklus 2 km E, ${n} km souvisle v tempu půlmaratonu ${f(tz)} /km, výklus 1,5 km E` }; }
      if (z === 'mar') { const n = mezi(Math.round(vol * 0.15), 5, 14);
        return { typ: 'M', nazev: 'Maratonské tempo (M)', km: pul(3.5 + n), popis: `rozklus 2 km E, ${n} km souvisle v tempu M ${f(tz)} /km, výklus 1,5 km E` }; }
      const d = z === '5k' ? 1000 : 2000, n = z === '5k' ? mezi(Math.round(vol * 0.12), 4, 6) : mezi(Math.round(vol * 0.12 / 2), 3, 4);
      return { typ: 'Z', nazev: 'Závodní tempo', km: pul(3.5 + n * d / 1000 * 1.3),
        popis: `rozklus 2 km E, ${n}× ${d / 1000} km v tempu závodu ${f(tz)} /km, pauza 2 min klusem, výklus 1,5 km E` };
    }
    throw new Error('neznámý druh ' + druh);
  }
  const DRUHY_FAZE = { zaklad: ['S', 'R'], rozvoj: ['I', 'T'], specifika: ['T', 'Z'], ladeni: ['Z', 'S'] };

  function normVstup(v) {
    v = v || {};
    return {
      zavod: ZAVODY.includes(v.zavod) ? v.zavod : '10k',
      datum: jeDatum(v.datum) ? v.datum : pridejDny(dnesIso(), 84),
      tydnu: mezi(Math.round(+v.tydnu) || 12, 8, 20),
      dni: mezi(Math.round(+v.dni) || 4, 3, 6),
      objem: mezi(+v.objem || 20, 10, 200),
      vdot: mezi(+v.vdot || 40, 20, 85),
      dlouhyDen: +v.dlouhyDen === 5 ? 5 : 6
    };
  }

  function generujPlan(vstupZ) {
    const v = normVstup(vstupZ), z = v.zavod, P = tempa(v.vdot), f = formatTempo;
    const nLad = LADENI[z].length, ob = objemy(v);
    const zacatek = pridejDny(pondeli(v.datum), -7 * (v.tydnu - 1));
    const posun = v.dlouhyDen === 6 ? 0 : -1;
    const lehky = km => ({ typ: 'E', nazev: 'Lehký běh (E)', km: pul(km), popis: `lehce ${f(P.E[0])}–${f(P.E[1])} /km, konverzační tempo` });
    const tydny = [];
    for (let k = 1; k <= v.tydnu; k++) {
      const faze = fazeTydne(k, v.tydnu, nLad), vol = ob.rad[k - 1].km, od = pridejDny(zacatek, 7 * (k - 1));
      const zavodni = k === v.tydnu, druhy = DRUHY_FAZE[faze];
      const sloty = Object.entries(ROZVRH[v.dni]).map(([d, s]) => ({ den: (+d + posun + 7) % 7, slot: s }));
      const dny = [];
      // dlouhý běh
      const podil = v.dni === 3 ? 0.4 : v.dni === 4 ? 0.33 : 0.28;
      let lKm = mezi(vol * podil, 6, DLOUHY_MAX[z]);
      // trénink kvality (při 3 dnech jen jeden, střídá se)
      const q = {};
      if (v.dni === 3) q.Q1 = kvalita(druhy[k % 2], vol, v.vdot, z);
      else { q.Q1 = kvalita(druhy[0], vol, v.vdot, z); if (!ob.rad[k - 1].odlehceni) q.Q2 = kvalita(druhy[1], vol, v.vdot, z); }
      const eDny = sloty.filter(s => s.slot === 'E' || (s.slot !== 'L' && !q[s.slot])).length;   // v odlehčovacím týdnu jen jedna kvalita
      const zbyva = vol - lKm - (q.Q1 ? q.Q1.km : 0) - (q.Q2 ? q.Q2.km : 0);
      const eKm = eDny ? Math.max(3, zbyva / eDny) : 0;
      for (const s of sloty.sort((a, b) => a.den - b.den)) {
        const datum = pridejDny(od, s.den);
        let t;
        if (s.slot === 'L') {
          const mSeg = z === 'mar' && faze === 'specifika' ? mezi(Math.round(lKm * 0.4), 6, 16) : 0;
          t = mSeg
            ? { typ: 'L', nazev: 'Dlouhý běh s úsekem M', km: pul(lKm), popis: `${formatKm(pul(lKm))} km, z toho posledních ${mSeg} km v tempu M ${f(P.M)} /km, zbytek lehce ${f(P.E[1])} /km` }
            : { typ: 'L', nazev: 'Dlouhý běh (L)', km: pul(lKm), popis: `${formatKm(pul(lKm))} km lehce ${f(P.E[0])}–${f(P.E[1])} /km` };
        } else if (s.slot === 'E') t = lehky(eKm);
        else t = q[s.slot] || lehky(eKm);
        dny.push(Object.assign({ datum }, t));
      }
      if (zavodni) {
        // závodní týden: nic po závodě, den před ním jen výklus, závod v den závodu
        const vzd = VZD[z].m / 1000;
        const zb = dny.filter(d => d.datum < v.datum && d.datum !== pridejDny(v.datum, -1))
          .map((d, i) => i === 0 && d.typ !== 'E'
            ? Object.assign(d, kvalita('Z', vol * 0.6, v.vdot, z), { km: pul(Math.min(d.km, 3.5 + Math.min(4, vzd / 3))) })
            : Object.assign(d, lehky(Math.min(d.km, Math.max(3, vol * 0.15)))));
        if (zb.length && zb[0].typ === 'Z') zb[0].popis = `rozklus 2 km E, 3–4× 1 km v tempu závodu ${f(tempoZavodu(v.vdot, z))} /km, pauza 2 min, výklus 1,5 km`;
        dny.length = 0; dny.push(...zb);
        const predem = pridejDny(v.datum, -1);
        if (predem >= od) dny.push({ datum: predem, typ: 'S', nazev: 'Výklus před závodem', km: 3, popis: '15–20 min velmi lehce + 4× 100 m rovinky, nebo volno' });
        dny.push({ datum: v.datum, typ: 'zavod', nazev: '🏁 Závod: ' + VZD[z].nazev, km: vzd,
          popis: `cíl ${formatCas(predikce(v.vdot, VZD[z].m))} (${f(tempoZavodu(v.vdot, z))} /km); prvních pár km nezačínat rychleji` });
      }
      dny.sort((a, b) => a.datum < b.datum ? -1 : 1);
      tydny.push({ cislo: k, od, faze, nazevFaze: FAZE[faze], odlehceni: ob.rad[k - 1].odlehceni, cil: Math.round(vol),
        km: Math.round(dny.reduce((a, d) => a + d.km, 0) * 10) / 10, dny });
    }
    return { vstup: v, tydny, vrchol: Math.round(ob.vrchol), dosazeno: ob.dosazeno, vytvoreno: dnesIso() };
  }

  /* ---------- .ics (RFC 5545) ---------- */
  const icsText = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function skladej(radek) {           // max. 75 oktetů na řádek
    const out = []; let cur = '', n = 0;
    for (const ch of radek) {
      const cp = ch.codePointAt(0), b = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; }
      cur += ch; n += b;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  function ics(plan, razitko) {
    const st = (razitko || new Date().toISOString()).replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15) + 'Z';
    const r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lavionus//Bezecky plan//CS', 'CALSCALE:GREGORIAN'];
    for (const t of plan.tydny) for (const d of t.dny) {
      const ds = d.datum.replace(/-/g, '');
      r.push('BEGIN:VEVENT', 'UID:' + ds + '-' + d.typ + '@bezecky-plan', 'DTSTAMP:' + st,
        'DTSTART;VALUE=DATE:' + ds, 'DTEND;VALUE=DATE:' + pridejDny(d.datum, 1).replace(/-/g, ''),
        'SUMMARY:' + icsText(`🏃 ${d.nazev} – ${formatKm(d.km)} km`), 'DESCRIPTION:' + icsText(`${d.popis}\nTýden ${t.cislo}/${plan.tydny.length} · ${t.nazevFaze}`),
        'TRANSP:TRANSPARENT', 'END:VEVENT');
    }
    r.push('END:VCALENDAR');
    return r.map(skladej).join('\r\n') + '\r\n';
  }

  /* ---------- uložená data ---------- */
  const prazdna = () => ({ verze: VERZE, vysledek: { vzd: '10k', m: 10000, cas: '50:00' }, plan: null, hotovo: {} });
  function migruj(d) {
    const p = prazdna();
    if (!d || typeof d !== 'object') return p;
    if (d.vysledek && d.vysledek.m > 0) p.vysledek = { vzd: String(d.vysledek.vzd || ''), m: +d.vysledek.m, cas: String(d.vysledek.cas || '') };
    if (d.plan && Array.isArray(d.plan.tydny)) p.plan = d.plan;
    if (d.hotovo && typeof d.hotovo === 'object') for (const k in d.hotovo) if (jeDatum(k) && d.hotovo[k]) p.hotovo[k] = true;
    return p;
  }
  /* plnění plánu: odběhnuté km / naplánované do dneška */
  function plneni(plan, hotovo, dnes) {
    let pl = 0, hot = 0, nPl = 0, nHot = 0;
    if (plan) for (const t of plan.tydny) for (const d of t.dny) {
      if (d.datum <= dnes) { pl += d.km; nPl++; }
      if (hotovo[d.datum]) { hot += d.km; nHot++; }
    }
    return { km: Math.round(hot * 10) / 10, kmPlan: Math.round(pl * 10) / 10, treninku: nHot, treninkuPlan: nPl };
  }

  const api = {
    VERZE, KLIC, VZDALENOSTI, VZD, ZAVODY, FAZE, VRCHOL, DLOUHY_MAX,
    vo2, podilMax, vdot, rychlostZVo2, predikce, riegel, tempa, tempoZavodu,
    formatCas, formatTempo, formatKm, kmh, cislo, parsujCas, parsujTempo, parsujCislo,
    dopocti, mezicasy, zpomaleniTeplota, cenaMinetti, faktorPrevyseni,
    jeDatum, pridejDny, denTydne, pondeli, dnesIso, formatDatum,
    normVstup, objemy, generujPlan, ics, prazdna, migruj, plneni
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.BehJadro = api;
})();
