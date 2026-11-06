/* Dílna hlasů – úpravy hotové řeči (PCM Float32, mono), bez DOM.
   Výška a barva hlasu nezávisle (TD-PSOLA), rozsah intonace, vibrato, chvění, dech až šepot (LPC),
   efekty (telefon, rádio, robot, ozvěna, hala, jeskyně).
   window.HLASY_EFEKTY v prohlížeči, module.exports v node (_test/hlasy_test.js).
   Používá i Předčítač (obsah/predcitac/stranka.js) – úprava se aplikuje na každou větu. */
(function (koren) {
  'use strict';

  // vyska: půltóny; formant: násobek formantů (>1 = kratší hlasové ústrojí – žena, dítě);
  // intonace: rozsah melodie (0 = monotónní, 1 = beze změny); vibrato: hloubka v půltónech;
  // chveni: 0–1 nepravidelnost periody a hlasitosti; dech: 0–1 (1 = šepot); tempo: násobek rychlosti řeči
  const ZAKLAD = { vyska: 0, formant: 1, intonace: 1, vibrato: 0, vibratoHz: 5.5, chveni: 0, dech: 0, efekt: 'zadny', mira: 0.5, tempo: 1 };

  const EFEKTY = [
    ['zadny', 'žádný'], ['telefon', 'telefon'], ['radio', 'staré rádio'], ['robot', 'robot'],
    ['ozvena', 'ozvěna'], ['hala', 'hala'], ['jeskyne', 'jeskyně'],
  ];

  // předvolby počítají s mužským výchozím hlasem (jirka, Honza)
  const PRESETY = [
    { id: 'puvodni', nazev: '🎙️ Původní', param: {} },
    { id: 'zena', nazev: '👩 Žena', param: { vyska: 7, formant: 1.17, intonace: 1.15 } },
    { id: 'dite', nazev: '🧒 Dítě', param: { vyska: 10, formant: 1.3, intonace: 1.3, tempo: 1.05 } },
    { id: 'hluboky', nazev: '🧔 Hluboký muž', param: { vyska: -4, formant: 0.92 } },
    { id: 'obr', nazev: '🗿 Obr', param: { vyska: -9, formant: 0.78, tempo: 0.85, efekt: 'hala', mira: 0.25 } },
    { id: 'babicka', nazev: '👵 Babička', param: { vyska: 6, formant: 1.12, vibrato: 0.45, vibratoHz: 6, chveni: 0.35, dech: 0.2, tempo: 0.88 } },
    { id: 'dedecek', nazev: '👴 Dědeček', param: { vyska: -2, formant: 0.95, vibrato: 0.3, vibratoHz: 5, chveni: 0.4, dech: 0.15, tempo: 0.85 } },
    { id: 'skritek', nazev: '🧝 Skřítek', param: { vyska: 12, formant: 1.35, intonace: 1.4, tempo: 1.15 } },
    { id: 'carodejnice', nazev: '🧙‍♀️ Čarodějnice', param: { vyska: 8, formant: 1.2, chveni: 0.5, intonace: 1.6, dech: 0.1 } },
    { id: 'vypravec', nazev: '📖 Vypravěč', param: { vyska: -1, formant: 0.97, intonace: 1.2, tempo: 0.92, efekt: 'hala', mira: 0.12 } },
    { id: 'sepot', nazev: '🤫 Šepot', param: { dech: 1 } },
    { id: 'duch', nazev: '👻 Duch', param: { vyska: 3, dech: 0.6, vibrato: 0.6, vibratoHz: 3, efekt: 'jeskyne', mira: 0.5 } },
    { id: 'robot', nazev: '🤖 Robot', param: { intonace: 0, efekt: 'robot', mira: 0.6 } },
    { id: 'telefon', nazev: '☎️ Telefon', param: { efekt: 'telefon', mira: 0.5 } },
    { id: 'radio', nazev: '📻 Staré rádio', param: { efekt: 'radio', mira: 0.5 } },
  ];

  const uplne = p => Object.assign({}, ZAKLAD, p || {});

  // deterministický generátor (opakovatelný výsledek, testy)
  function nahoda(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const rms = x => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, x.length)); };

  /* ---------- základní tón (YIN), po 10 ms ---------- */
  function zakladniTon(x, sr, min = 60, max = 420) {
    const hop = Math.round(sr * 0.01), maxLag = Math.ceil(sr / min), minLag = Math.floor(sr / max), W = maxLag;
    const pocet = Math.ceil(x.length / hop) + 1;
    const f0 = new Float32Array(pocet), en = new Float32Array(pocet);
    let maxE = 0;
    for (let k = 0; k < pocet; k++) {
      let s = 0;
      for (let j = k * hop, e = Math.min(x.length, j + W); j < e; j++) s += x[j] * x[j];
      en[k] = s; if (s > maxE) maxE = s;
    }
    const d = new Float32Array(maxLag + 2);
    for (let k = 0; k < pocet; k++) {
      const a = k * hop;
      if (a + W + maxLag + 1 >= x.length || en[k] < maxE * 0.003) continue;
      for (let tau = 1; tau <= maxLag + 1; tau++) {
        let s = 0;
        for (let j = 0; j < W; j++) { const v = x[a + j] - x[a + j + tau]; s += v * v; }
        d[tau] = s;
      }
      let soucet = 0;
      for (let tau = 1; tau <= maxLag + 1; tau++) { soucet += d[tau]; d[tau] = soucet > 0 ? d[tau] * tau / soucet : 1; }
      let best = -1;
      for (let tau = minLag; tau <= maxLag; tau++) {
        if (d[tau] < 0.15) { while (tau < maxLag && d[tau + 1] < d[tau]) tau++; best = tau; break; }
      }
      if (best < 0) {
        let m = 1e9;
        for (let tau = minLag; tau <= maxLag; tau++) if (d[tau] < m) { m = d[tau]; best = tau; }
        if (m > 0.3) best = -1;
      }
      if (best > 1) {
        const a0 = d[best - 1], b0 = d[best], c0 = d[best + 1], jm = a0 - 2 * b0 + c0;
        f0[k] = sr / (jm > 0 ? best + 0.5 * (a0 - c0) / jm : best);
      }
    }
    // osamocené znělé/neznělé rámce pryč, medián ze tří proti skokům o oktávu
    const out = new Float32Array(pocet);
    for (let k = 0; k < pocet; k++) {
      const a = f0[k - 1] || 0, b = f0[k], c = f0[k + 1] || 0;
      if (!b) { out[k] = a && c ? (a + c) / 2 : 0; continue; }
      if (!a && !c) { out[k] = 0; continue; }
      out[k] = a && c ? [a, b, c].sort((p, q) => p - q)[1] : b;
    }
    return { f0: out, hop, stred: W / 2 };
  }

  function tonV(ton, i) {   // základní tón ve vzorku i (0 = neznělé)
    const t = (i - ton.stred) / ton.hop, k = Math.floor(t), fr = t - k;
    const a = ton.f0[k] || 0, b = ton.f0[k + 1] || 0;
    if (a && b) return a + fr * (b - a);
    return fr < 0.5 ? a : b;
  }

  /* ---------- značky period (vrcholy signálu ve znělých úsecích, jinak po 5 ms) ---------- */
  function znacky(x, sr, ton) {
    const out = [], U = Math.round(sr * 0.005);
    let t = 0;
    while (t < x.length) {
      const f = tonV(ton, t);
      if (f > 0) {
        const P = sr / f, prev = out.length && out[out.length - 1].znele ? out[out.length - 1] : null;
        const a = Math.max(0, Math.round(prev ? t - 0.2 * P : t)), b = Math.min(x.length - 1, Math.round(prev ? t + 0.2 * P : t + P));
        let m = a, mv = -Infinity;
        for (let j = a; j <= b; j++) if (x[j] > mv) { mv = x[j]; m = j; }
        if (prev && m <= prev.pos + 0.5 * P) m = Math.round(prev.pos + P);
        out.push({ pos: m, P, znele: true });
        t = Math.round(m + P);
      } else {
        out.push({ pos: t, P: U, znele: false });
        t += U;
      }
    }
    return out;
  }

  /* ---------- TD-PSOLA: nová výška (rozestup zrn) a barva (převzorkování zrna) ---------- */
  function psola(x, sr, p, rnd) {
    const ton = zakladniTon(x, sr), zn = znacky(x, sr, ton);
    const y = new Float32Array(x.length);
    if (!zn.length) return y;
    let sumLog = 0, n = 0;
    for (const m of zn) if (m.znele) { sumLog += Math.log(sr / m.P); n++; }
    const stredLog = n ? sumLog / n : Math.log(120);
    const posun = Math.pow(2, p.vyska / 12), phi = p.formant;
    let ts = zn[0].pos, ai = 0;
    while (ts < x.length) {
      while (ai + 1 < zn.length && Math.abs(zn[ai + 1].pos - ts) <= Math.abs(zn[ai].pos - ts)) ai++;
      const m = zn[ai], Lo = m.P / phi;
      let rozestup = Lo, zisk = 1;
      if (m.znele) {
        let cil = Math.exp(stredLog + p.intonace * (Math.log(sr / m.P) - stredLog)) * posun;
        if (p.vibrato) cil *= Math.pow(2, p.vibrato * Math.sin(2 * Math.PI * p.vibratoHz * ts / sr) / 12);
        if (p.chveni) { cil *= 1 + p.chveni * 0.06 * (rnd() * 2 - 1); zisk *= 1 + p.chveni * 0.35 * (rnd() * 2 - 1); }
        rozestup = sr / cil;
        zisk *= Math.min(1, rozestup / Lo);   // husté překrývání zrn nesmí zesilovat
      }
      const c = Math.round(ts), K = Math.floor(Lo);
      for (let k = -K; k <= K; k++) {
        const o = c + k;
        if (o < 0 || o >= y.length) continue;
        const src = m.pos + k * phi, i0 = Math.floor(src);
        if (i0 < 0 || i0 + 1 >= x.length) continue;
        const w = 0.5 + 0.5 * Math.cos(Math.PI * k / Lo);
        y[o] += zisk * w * (x[i0] + (src - i0) * (x[i0 + 1] - x[i0]));
      }
      ts += Math.max(1, rozestup);
    }
    return y;
  }

  /* ---------- LPC: šepot = obálka spektra buzená šumem ---------- */
  function levinson(r, rad) {
    const a = new Float64Array(rad + 1); a[0] = 1;
    let e = r[0];
    for (let i = 1; i <= rad; i++) {
      let s = r[i];
      for (let j = 1; j < i; j++) s += a[j] * r[i - j];
      const k = -s / e;
      const pred = a.slice();
      for (let j = 1; j < i; j++) a[j] = pred[j] + k * pred[i - j];
      a[i] = k;
      e *= 1 - k * k;
      if (e <= 0) { e = 1e-12; break; }
    }
    return { a, e };
  }

  function sepot(x, sr, rnd) {
    const N = Math.round(sr * 0.03) & ~1, H = N / 2, rad = sr > 16000 ? 20 : 14, ZAHRATI = 200;
    const pe = new Float32Array(x.length);   // preemfáze
    for (let i = 0; i < x.length; i++) pe[i] = x[i] - 0.95 * (i ? x[i - 1] : 0);
    const w = new Float32Array(N);
    let w2 = 0;
    for (let i = 0; i < N; i++) { w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N); w2 += w[i] * w[i]; }
    const y = new Float32Array(x.length), r = new Float64Array(rad + 1), ram = new Float32Array(N), stav = new Float64Array(rad + 1);
    for (let a0 = -H; a0 < x.length; a0 += H) {
      for (let i = 0; i < N; i++) { const j = a0 + i; ram[i] = j >= 0 && j < x.length ? pe[j] * w[i] : 0; }
      for (let l = 0; l <= rad; l++) { let s = 0; for (let i = l; i < N; i++) s += ram[i] * ram[i - l]; r[l] = s; }
      if (r[0] < 1e-9) continue;
      r[0] *= 1.0001;
      const { a, e } = levinson(r, rad), g = Math.sqrt(e / w2) * Math.sqrt(3);   // šum ±1 má rozptyl 1/3
      stav.fill(0);
      for (let i = -ZAHRATI; i < N; i++) {
        let v = g * (rnd() * 2 - 1);
        for (let j = 1; j <= rad; j++) v -= a[j] * stav[j];
        for (let j = rad; j > 1; j--) stav[j] = stav[j - 1];
        stav[1] = v;
        const o = a0 + i;
        if (i >= 0 && o >= 0 && o < y.length) y[o] += v * w[i];
      }
    }
    for (let i = 1; i < y.length; i++) y[i] += 0.95 * y[i - 1];   // deemfáze
    return y;
  }

  /* ---------- filtry a efekty ---------- */
  function bikvad(x, sr, typ, f, Q = 0.707, dB = 0) {
    const w0 = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w0), al = Math.sin(w0) / (2 * Q), A = Math.pow(10, dB / 40);
    let b0, b1, b2, a0, a1, a2;
    if (typ === 'dolni') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (typ === 'horni') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }   // špička
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }

  function prodluz(x, s, sr) { const y = new Float32Array(x.length + Math.round(s * sr)); y.set(x); return y; }

  // Schroederův dozvuk: 4 hřebenové filtry s tlumením + 2 všepropustné
  function dozvuk(x, sr, velikost, mira) {
    const k = sr / 44100 * velikost;
    const hreb = [1557, 1617, 1491, 1422].map(d => Math.round(d * k)), vsep = [225, 556].map(d => Math.round(d * k));
    const zpetna = 0.78 + 0.1 * Math.min(1, velikost / 2), tlum = 0.25;
    const mokry = new Float32Array(x.length);
    for (const d of hreb) {
      const buf = new Float32Array(d); let i = 0, lp = 0;
      for (let n = 0; n < x.length; n++) {
        const v = buf[i]; lp = v * (1 - tlum) + lp * tlum;
        buf[i] = x[n] + lp * zpetna; mokry[n] += v * 0.25;
        i = (i + 1) % d;
      }
    }
    for (const d of vsep) {
      const buf = new Float32Array(d); let i = 0;
      for (let n = 0; n < x.length; n++) {
        const b = buf[i], v = -mokry[n] * 0.5 + b; buf[i] = mokry[n] + b * 0.5; mokry[n] = v;
        i = (i + 1) % d;
      }
    }
    const y = new Float32Array(x.length);
    for (let n = 0; n < x.length; n++) y[n] = x[n] * (1 - mira * 0.5) + mokry[n] * mira * 1.2;
    return y;
  }

  function efekt(x, sr, typ, mira, rnd) {
    if (typ === 'telefon') {
      let y = bikvad(bikvad(bikvad(bikvad(x, sr, 'horni', 380), sr, 'horni', 380), sr, 'dolni', 3200), sr, 'dolni', 3200);
      const t = 1 + mira * 5, n = Math.tanh(t);
      for (let i = 0; i < y.length; i++) y[i] = Math.tanh(y[i] * 3 * t) / n / 3;
      return y;
    }
    if (typ === 'radio') {
      let y = bikvad(bikvad(bikvad(x, sr, 'horni', 280), sr, 'dolni', 4200), sr, 'spicka', 1600, 1, 6);
      const lv = rms(y) || 0.05;
      for (let i = 0; i < y.length; i++) {
        y[i] = Math.tanh(y[i] / lv * 0.6) * lv * 1.4 + (rnd() - 0.5) * lv * 0.12 * mira;
        if (rnd() < 0.0004 * mira) y[i] += (rnd() - 0.5) * lv * 6;   // praskání
      }
      return y;
    }
    if (typ === 'robot') {
      const y = new Float32Array(x.length), d = Math.round(sr * 0.006), buf = new Float32Array(d);
      let j = 0;
      for (let i = 0; i < x.length; i++) {
        const v = x[i] + buf[j] * 0.55; buf[j] = v; j = (j + 1) % d;   // kovový hřeben
        const ring = Math.sin(2 * Math.PI * 55 * i / sr);
        y[i] = v * (1 - mira) + v * ring * mira * 1.6;
      }
      return y;
    }
    if (typ === 'ozvena') {
      const z = prodluz(x, 1.2, sr), d = Math.round(sr * 0.3), fb = 0.25 + 0.35 * mira;
      for (let i = d; i < z.length; i++) z[i] += z[i - d] * fb;
      return z;
    }
    if (typ === 'hala') return dozvuk(prodluz(x, 1.2, sr), sr, 1.3, mira);
    if (typ === 'jeskyne') return dozvuk(prodluz(x, 2.2, sr), sr, 2.4, mira);
    return x;
  }

  const neutralniTvar = p => p.vyska === 0 && p.formant === 1 && p.intonace === 1 && !p.vibrato && !p.chveni;

  // hlavní funkce: PCM → upravené PCM (stejná vzorkovací frekvence, u dozvuku delší o doznění)
  function uprav(x, sr, param, seed = 1) {
    const p = uplne(param), rnd = nahoda(seed);
    if (!x.length) return new Float32Array(0);
    const vstupRms = rms(x);
    let y = neutralniTvar(p) ? Float32Array.from(x) : psola(x, sr, p, rnd);
    if (p.dech > 0) {
      const s = sepot(y, sr, rnd), d = Math.min(1, p.dech);
      for (let i = 0; i < y.length; i++) y[i] = y[i] * (1 - d) + s[i] * d * 1.1;
    }
    if (p.efekt && p.efekt !== 'zadny') y = efekt(y, sr, p.efekt, p.mira, rnd);
    // hlasitost jako vstup, špičky pod 0 dBFS
    const r = rms(y.subarray(0, x.length));
    if (r > 0 && vstupRms > 0) { const k = vstupRms / r; for (let i = 0; i < y.length; i++) y[i] *= k; }
    let spic = 0;
    for (let i = 0; i < y.length; i++) spic = Math.max(spic, Math.abs(y[i]));
    if (spic > 0.97) { const k = 0.97 / spic; for (let i = 0; i < y.length; i++) y[i] *= k; }
    return y;
  }

  const API = { ZAKLAD, EFEKTY, PRESETY, uplne, uprav, zakladniTon, tonV, znacky, psola, sepot, bikvad, efekt, rms, nahoda };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else koren.HLASY_EFEKTY = API;
})(typeof window !== 'undefined' ? window : globalThis);
