/* ============================================================
   epidemie/analyza.js – analýza dat o incidenci. Čistý modul bez DOM.
     • čtení CSV (datum nebo číslo dne; oddělovač ; , tabulátor),
     • diskretizace sériového intervalu (gama rozdělení),
     • odhad R_t podle Cori et al. (2013, Am J Epidemiol 178: 1505) – bayesovský, posuvné okno τ dní,
       apriorní Gama(a, b) (výchozí střední hodnota 5, sm. odchylka 5 jako v EpiEstim),
     • doba zdvojnásobení z log-lineární regrese s 95% intervalem spolehlivosti,
     • fitování R0 a počátečního počtu nakažených SEIR modelu metodou maximální věrohodnosti
       (Poissonova věrohodnost denních případů), 95% interval z profilové věrohodnosti,
     • syntetická data z obnovovací rovnice (renewal equation) se známým R_t.
   ============================================================ */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const Jadro = uzel ? require('./jadro.js') : window.EpiJadro;
  const Stoch = uzel ? require('./stochastika.js') : window.EpiStoch;
  const Agenti = uzel ? require('./agenti.js') : window.EpiAgenti;

  // ---------- speciální funkce ----------
  const lgamma = Stoch.lgamma;
  /** Regularizovaná dolní neúplná gama funkce P(a, x) (řada / řetězový zlomek, Numerical Recipes). */
  function gamaP(a, x) {
    if (x <= 0) return 0;
    if (x < a + 1) {
      let sum = 1 / a, del = sum, ap = a;
      for (let n = 0; n < 1000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-15) break; }
      return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
    }
    let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (let i = 1; i < 1000; i++) {
      const an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  /** Distribuční funkce gama(tvar k, měřítko θ). */
  function gamaCDF(x, k, theta) { return gamaP(k, x / theta); }
  /** Kvantil gama rozdělení (bisekce na CDF). */
  function gamaKvantil(q, k, theta) {
    let lo = 0, hi = Math.max(1, k * theta);
    while (gamaCDF(hi, k, theta) < q) hi *= 2;
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (gamaCDF(m, k, theta) < q) lo = m; else hi = m; if (hi - lo < 1e-12 * Math.max(1, hi)) break; }
    return (lo + hi) / 2;
  }
  /** 97,5% kvantil Studentova t rozdělení (tabulka pro df ≤ 30, jinak aproximace). */
  const T975 = [NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131,
    2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  function t975(df) { if (df < 1) return NaN; if (df <= 30) return T975[Math.floor(df)]; return 1.959964 + 2.37 / df; }

  // ---------- CSV ----------
  function datumZTextu(s) {
    s = s.trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(s);
    if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    return null;
  }
  /**
   * Načte CSV s incidencí: 1. sloupec datum (RRRR-MM-DD nebo D. M. RRRR) nebo číslo dne, 2. sloupec počet případů.
   * Chybějící dny mezi daty doplní nulou a ohlásí. Vrací { dny[], pripady[], datumy[]|null, varovani[] }.
   */
  function nactiCSV(text, sloupec = 1) {
    const radky = String(text).replace(/^﻿/, '').split(/\r?\n/).map(r => r.trim()).filter(r => r && !r.startsWith('#'));
    if (!radky.length) throw new Error('Soubor je prázdný.');
    const oddel = radky[0].includes(';') ? ';' : radky[0].includes('\t') ? '\t' : ',';
    const varovani = [];
    const zaznamy = [];
    radky.forEach((r, i) => {
      const b = r.split(oddel).map(x => x.trim().replace(/^"|"$/g, ''));
      if (b.length <= sloupec) { if (i > 0) varovani.push(`Řádek ${i + 1}: chybí sloupec s počtem.`); return; }
      const hod = Number(b[sloupec].replace(/\s/g, '').replace(',', '.'));
      const d = datumZTextu(b[0]);
      const den = d == null ? Number(b[0].replace(',', '.')) : null;
      if (!Number.isFinite(hod) || (d == null && !Number.isFinite(den))) { if (i > 0) varovani.push(`Řádek ${i + 1} přeskočen (není číslo).`); return; }
      if (hod < 0) { varovani.push(`Řádek ${i + 1}: záporný počet nahrazen nulou.`); }
      zaznamy.push({ d, den, hod: Math.max(0, Math.round(hod)) });
    });
    if (zaznamy.length < 2) throw new Error('V souboru nejsou aspoň dva platné řádky (den;počet).');
    const sDatem = zaznamy.every(z => z.d != null);
    if (!sDatem && zaznamy.some(z => z.d != null)) throw new Error('Smíšené datumy a čísla dnů v prvním sloupci.');
    const klic = z => sDatem ? Math.round(z.d / 864e5) : Math.round(z.den);
    zaznamy.sort((a, b) => klic(a) - klic(b));
    const od = klic(zaznamy[0]), doK = klic(zaznamy[zaznamy.length - 1]);
    if (doK - od > 20000) throw new Error('Příliš dlouhé období (víc než 20 000 dní).');
    const pripady = new Array(doK - od + 1).fill(0), mame = new Array(doK - od + 1).fill(false);
    for (const z of zaznamy) { const i = klic(z) - od; if (mame[i]) varovani.push('Duplicitní den – hodnoty sečteny.'); pripady[i] += z.hod; mame[i] = true; }
    const chybi = mame.filter(x => !x).length;
    if (chybi) varovani.push(`Chybí ${chybi} dní – doplněno nulou.`);
    return {
      dny: pripady.map((_, i) => i), pripady,
      datumy: sDatem ? pripady.map((_, i) => new Date((od + i) * 864e5).toISOString().slice(0, 10)) : null,
      varovani: [...new Set(varovani)]
    };
  }

  // ---------- sériový interval a Cori ----------
  /** Diskrétní sériový interval w_s (s = 1…smax) z gama(průměr, sm. odchylka): w_s = F(s) − F(s−1), normováno. */
  function serioveRozdeleni(prumer, sd, smax) {
    const k = (prumer / sd) ** 2, theta = sd * sd / prumer;
    smax = smax || Math.ceil(prumer + 6 * sd);
    const w = [0];
    for (let s = 1; s <= smax; s++) w.push(gamaCDF(s, k, theta) - gamaCDF(s - 1, k, theta));
    const suma = w.reduce((a, b) => a + b, 0);
    return w.map(x => x / suma);
  }
  /** Infekční tlak Λ_t = Σ_{s≥1} I_{t−s} w_s. */
  function infekcniTlak(I, w) {
    return I.map((_, t) => { let s = 0; for (let k = 1; k < w.length && k <= t; k++) s += I[t - k] * w[k]; return s; });
  }
  /**
   * Odhad R_t (Cori et al. 2013). Okno [t−τ+1, t]. Aposteriorní rozdělení Gama(a + ΣI, 1/(1/b + ΣΛ)).
   * Výstup od dne, kdy je okno celé a kumulativně aspoň minPripadu případů.
   */
  function cori(I, w, volby = {}) {
    const tau = volby.okno || 7, a = volby.a != null ? volby.a : 1, b = volby.b != null ? volby.b : 5;
    const min = volby.minPripadu != null ? volby.minPripadu : 12;
    const L = infekcniTlak(I, w);
    const vys = { t: [], prumer: [], q025: [], q975: [], tvar: [], meritko: [] };
    let kum = 0;
    for (let t = 0; t < I.length; t++) {
      kum += I[t];
      if (t < tau || kum < min) continue;
      let sI = 0, sL = 0;
      for (let s = t - tau + 1; s <= t; s++) { sI += I[s]; sL += L[s]; }
      const tvar = a + sI, mer = 1 / (1 / b + sL);
      vys.t.push(t); vys.prumer.push(tvar * mer); vys.tvar.push(tvar); vys.meritko.push(mer);
      vys.q025.push(gamaKvantil(0.025, tvar, mer)); vys.q975.push(gamaKvantil(0.975, tvar, mer));
    }
    return vys;
  }

  /** Doba zdvojnásobení: regrese ln(případů) na čas v okně [od, do] (nulové dny vynechány). */
  function dobaZdvojeni(I, od, doDen) {
    const x = [], y = [];
    for (let t = Math.max(0, od); t <= Math.min(I.length - 1, doDen); t++) if (I[t] > 0) { x.push(t); y.push(Math.log(I[t])); }
    const n = x.length;
    if (n < 3) return null;
    const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
    const r = sxy / sxx, a = my - r * mx;
    let sse = 0; for (let i = 0; i < n; i++) sse += (y[i] - a - r * x[i]) ** 2;
    const se = Math.sqrt(sse / (n - 2) / sxx);
    const tq = t975(n - 2);
    const rLo = r - tq * se, rHi = r + tq * se;
    const zdv = (rr) => rr > 0 ? Math.log(2) / rr : (rr < 0 ? -Math.log(2) / rr : Infinity);
    return {
      r, se, rLo, rHi, n, a,
      rust: r > 0, doba: zdv(r),
      // interval pro dobu: jen když interval r neobsahuje 0
      dobaLo: (rLo > 0 || rHi < 0) ? Math.min(zdv(rLo), zdv(rHi)) : null,
      dobaHi: (rLo > 0 || rHi < 0) ? Math.max(zdv(rLo), zdv(rHi)) : null
    };
  }

  // ---------- syntetická data ----------
  /** Obnovovací proces: I_t ~ Poisson(R_t Λ_t); Rt = funkce dne. Vrací pole denních případů. */
  function syntetickaObnova(Rt, w, dny, I0, seed) {
    const rnd = Agenti.mulberry32(Agenti.normalizujSeed(seed));
    const I = [I0];
    for (let t = 1; t < dny; t++) {
      let L = 0; for (let k = 1; k < w.length && k <= t; k++) L += I[t - k] * w[k];
      I.push(Stoch.poisson(rnd, Rt(t) * L));
    }
    return I;
  }

  // ---------- fitování SEIR ----------
  /** Denní nové nákazy SEIR (jádro, homogenní) pro dané R0 a I0, zachycené s pravděpodobností hlaseni. */
  function modelIncidence(R0, I0, pevne, dny) {
    const p = R0 / (pevne.c * pevne.infekcni);
    const v = Jadro.simuluj({ model: pevne.latence === false ? 'SIR' : 'SEIR', N: pevne.N, I0, p: Math.min(1, p), c: pevne.c, inkubace: pevne.inkubace, infekcni: pevne.infekcni, dny: Math.max(1, dny - 1), krok: 0.25 });
    const out = [];
    for (let t = 0; t < dny; t++) out.push(t === 0 ? I0 : (v.C[t] - v.C[t - 1]) * (pevne.hlaseni || 1));
    return out;
  }
  function logVer(data, mu, od = 0) {
    let ll = 0;
    for (let t = od; t < data.length; t++) {
      const m = Math.max(1e-9, mu[t]);
      ll += data[t] * Math.log(m) - m - lgamma(data[t] + 1);
    }
    return ll;
  }
  /** Nelder–Mead minimalizace (2D) – jednoduchá a robustní. */
  function nelderMead(f, x0, krok, iter = 400) {
    const n = x0.length;
    let s = [x0.slice()];
    for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += krok[i]; s.push(x); }
    let fs = s.map(f);
    for (let it = 0; it < iter; it++) {
      const ord = fs.map((v, i) => i).sort((a, b) => fs[a] - fs[b]);
      s = ord.map(i => s[i]); fs = ord.map(i => fs[i]);
      if (Math.abs(fs[n] - fs[0]) < 1e-10) break;
      const c = new Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += s[i][j] / n;
      const xr = c.map((v, j) => v + (v - s[n][j])), fr = f(xr);
      if (fr < fs[0]) {
        const xe = c.map((v, j) => v + 2 * (v - s[n][j])), fe = f(xe);
        if (fe < fr) { s[n] = xe; fs[n] = fe; } else { s[n] = xr; fs[n] = fr; }
      } else if (fr < fs[n - 1]) { s[n] = xr; fs[n] = fr; }
      else {
        const xc = c.map((v, j) => v + 0.5 * (s[n][j] - v)), fc = f(xc);
        if (fc < fs[n]) { s[n] = xc; fs[n] = fc; }
        else for (let i = 1; i <= n; i++) { s[i] = s[i].map((v, j) => s[0][j] + 0.5 * (v - s[0][j])); fs[i] = f(s[i]); }
      }
    }
    const k = fs.indexOf(Math.min(...fs));
    return { x: s[k], f: fs[k] };
  }
  /** Zlatý řez – minimum unimodální funkce na [a, b]. */
  function zlatyRez(f, a, b, tol = 1e-6) {
    const g = (Math.sqrt(5) - 1) / 2;
    let c = b - g * (b - a), d = a + g * (b - a), fc = f(c), fd = f(d);
    while (b - a > tol) {
      if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); }
      else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); }
    }
    return (a + b) / 2;
  }
  /**
   * Fit R0 a I0 (počáteční infekční) homogenního SEIR na denní případy (Poissonova věrohodnost).
   * pevne = { N, c, inkubace, infekcni, latence, hlaseni }. 95% interval R0 z profilové věrohodnosti (pokles o 1,92).
   */
  function fitujSEIR(data, pevne) {
    const dny = data.length;
    // den 0 = počáteční nakažení (nejsou to nové nákazy modelu) → věrohodnost od dne 1
    const zaporna = ([lr, li]) => -logVer(data, modelIncidence(Math.exp(lr), Math.exp(li), pevne, dny), 1);
    const start = [Math.log(2), Math.log(Math.max(1, data[0] || 1))];
    let nej = nelderMead(zaporna, start, [0.3, 0.7]);
    nej = nelderMead(zaporna, nej.x, [0.05, 0.2]);
    const R0 = Math.exp(nej.x[0]), I0 = Math.exp(nej.x[1]);
    const llMax = -nej.f;
    // profil: pro dané R0 optimalizovat ln I0
    const profil = (R) => { const li = zlatyRez(x => zaporna([Math.log(R), x]), nej.x[1] - 4, nej.x[1] + 4, 1e-4); return -zaporna([Math.log(R), li]); };
    const hranice = (smer) => {
      let lo = R0, hi = R0;
      let krok = 0.02 * R0;
      for (let i = 0; i < 60; i++) {
        hi = Math.max(0.01, R0 + smer * krok);
        if (llMax - profil(hi) > 1.92) break;
        lo = hi; krok *= 1.6;
        if (i === 59) return null;
      }
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (llMax - profil(m) > 1.92) hi = m; else lo = m; }
      return (lo + hi) / 2;
    };
    const dolni = hranice(-1), horni = hranice(1);
    const fit = modelIncidence(R0, I0, pevne, dny);
    return { R0, I0, logVer: llMax, ciR0: [dolni, horni], fit };
  }

  const EpiAnalyza = { gamaP, gamaCDF, gamaKvantil, t975, nactiCSV, serioveRozdeleni, infekcniTlak, cori, dobaZdvojeni, syntetickaObnova, modelIncidence, logVer, nelderMead, zlatyRez, fitujSEIR };
  if (uzel) module.exports = EpiAnalyza; else window.EpiAnalyza = EpiAnalyza;
})();
