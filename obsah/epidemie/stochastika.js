/* ============================================================
   epidemie/stochastika.js – stochastické verze homogenního modelu SEIR(S):
     • přesný Gillespieho algoritmus (SSA, Gillespie 1977) – každá událost zvlášť,
     • tau-leaping s binomickými přírůstky (Tian & Burrage 2004) – pro velké populace,
     • souborové běhy (ensemble) s kvantilovými pásy a pravděpodobností vymření,
     • větvící proces (Galton–Watson) se záporně binomickým počtem nákaz (superšíření, Lloyd-Smith et al. 2005).
   Čistý modul bez DOM; náhoda jen z generátoru se seedem.

   Stav: S, E, I, R (I zahrnuje symptomatické i asymptomatické; jejich průměrná infekčnost
   je zahrnuta do β_ef = p·c·m(t)·s(t)·[(1−pA)·f_iso + pA·rA]). Události a jejich intenzity:
     nákaza  S→E   β_ef·S·I/N + ι(t)·S/N        (bez latence S→I)
     E→I     σE,   I→R  γI,   R→S  ωR
   Časově proměnné intenzity (zásahy, sezónnost, importy) se berou po částech konstantní
   v rámci dne – díky bezpaměťovosti exponenciálního rozdělení stačí na hranici dne čekání vylosovat znovu.
   ============================================================ */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const Model = uzel ? require('./model.js') : window.EpiModel;
  const Agenti = uzel ? require('./agenti.js') : window.EpiAgenti;
  const mulberry32 = Agenti.mulberry32;

  // ---------- náhodná rozdělení ----------
  const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  /** ln Γ(x) pro x > 0 (Lanczos, g = 7). */
  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    let a = LANCZOS[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function exponencialni(rnd, intenzita) { return -Math.log(1 - rnd()) / intenzita; }
  const normalni = Agenti.normalni, gama = Agenti.gama;
  /** Poisson(λ): inverze pro λ < 10, jinak PTRS (Hörmann 1993). */
  function poisson(rnd, lam) {
    if (!(lam > 0)) return 0;
    if (lam < 10) {
      let k = 0, p = Math.exp(-lam), s = p;
      const u = rnd();
      while (u > s && k < 1000) { k++; p *= lam / k; s += p; }
      return k;
    }
    const slam = Math.sqrt(lam), loglam = Math.log(lam);
    const b = 0.931 + 2.53 * slam, a = -0.059 + 0.02483 * b, invalpha = 1.1239 + 1.1328 / (b - 3.4), vr = 0.9277 - 3.6224 / (b - 2);
    for (;;) {
      const U = rnd() - 0.5, V = rnd();
      const us = 0.5 - Math.abs(U);
      const k = Math.floor((2 * a / us + b) * U + lam + 0.43);
      if (us >= 0.07 && V <= vr) return k;
      if (k < 0 || (us < 0.013 && V > us)) continue;
      if (Math.log(V) + Math.log(invalpha) - Math.log(a / (us * us) + b) <= -lam + k * loglam - lgamma(k + 1)) return k;
    }
  }
  /** Binomické(n, p): inverze pro n·p < 10, jinak BTRS (Hörmann 1993). */
  function binomicke(rnd, n, p) {
    if (n <= 0 || p <= 0) return 0;
    if (p >= 1) return n;
    if (p > 0.5) return n - binomicke(rnd, n, 1 - p);
    if (n * p < 10) {
      const q = 1 - p, r = p / q;
      let k = 0, pk = Math.pow(q, n), s = pk;
      const u = rnd();
      while (u > s && k < n) { pk *= r * (n - k) / (k + 1); k++; s += pk; }
      return k;
    }
    const spq = Math.sqrt(n * p * (1 - p));
    const b = 1.15 + 2.53 * spq, a = -0.0873 + 0.0248 * b + 0.01 * p, c = n * p + 0.5, vr = 0.92 - 4.2 / b;
    const alpha = (2.83 + 5.1 / b) * spq, lpq = Math.log(p / (1 - p)), m = Math.floor((n + 1) * p);
    const h = lgamma(m + 1) + lgamma(n - m + 1);
    for (;;) {
      const u = rnd() - 0.5;
      let v = rnd();
      const us = 0.5 - Math.abs(u);
      const k = Math.floor((2 * a / us + b) * u + c);
      if (k < 0 || k > n) continue;
      if (us >= 0.07 && v <= vr) return k;
      v = Math.log(v * alpha / (a / (us * us) + b));
      if (v <= h - lgamma(k + 1) - lgamma(n - k + 1) + (k - m) * lpq) return k;
    }
  }
  /** Záporně binomické se střední hodnotou R a disperzí k (k = Infinity → Poisson). */
  function zapBinom(rnd, R, k) {
    if (!Number.isFinite(k)) return poisson(rnd, R);
    return poisson(rnd, gama(rnd, k, R / k));
  }

  // ---------- parametry homogenního stochastického modelu ----------
  /** Odvodí intenzity z parametrů rozšířeného modelu (homogenní verze). */
  function intenzity(vstup) {
    const { par, chyby } = Model.over(Object.assign({}, vstup, { vek: false }));
    if (chyby.length) throw new Error(chyby.join(' '));
    const st = Model.priprav(par);
    const pod = Model.podilyProstredi();
    const faktor = (1 - par.podilA) * st.fIso + par.podilA * par.rA;
    return {
      par, st,
      beta: (t) => {
        const m = Model.nasobitele(par, t);
        let mc = 0; for (const s of Model.PROSTREDI) mc += pod[s] * m[s];
        return par.p * par.c * mc * Model.sezonnost(par, t) * faktor;
      },
      imp: (t) => (t >= par.importyOd && t < par.importyDo) ? par.importy : 0,
      sigma: par.latence ? 1 / par.inkubace : Infinity, gamma: st.gamma, omega: st.omega,
      R0: par.p * par.c * faktor / st.gamma
    };
  }

  function pocatecniStav(par) {
    const N = Math.round(par.N), I0 = Math.round(par.I0);
    const V = Math.round((N - I0) * par.ockovaniPodil * par.ucinnost);
    return { N, S: N - I0 - V, E: 0, I: I0, R: 0, V, kum: 0 };
  }

  function novyZaznam() { return { t: [], S: [], E: [], I: [], R: [], kum: [] }; }
  function zapisDen(z, t, s) { z.t.push(t); z.S.push(s.S); z.E.push(s.E); z.I.push(s.I); z.R.push(s.R); z.kum.push(s.kum); }

  /**
   * Přesný Gillespieho algoritmus. Vrací záznam po dnech a počet událostí.
   * maxUdalosti chrání před zamrznutím (přerušeno = true).
   */
  function gillespie(vstup, seed, volby = {}) {
    const m = intenzity(vstup);
    const { par } = m;
    const rnd = mulberry32(Agenti.normalizujSeed(seed));
    const s = pocatecniStav(par);
    const N = s.N, dny = Math.round(par.dny);
    const z = novyZaznam();
    zapisDen(z, 0, s);
    let t = 0, udalosti = 0;
    const maxU = volby.maxUdalosti || 5e7;
    for (let den = 0; den < dny; den++) {
      const konec = den + 1;
      const b = m.beta(den), ip = m.imp(den);
      while (true) {
        const aInf = (b * s.I + ip) * s.S / N;
        const aE = Number.isFinite(m.sigma) ? m.sigma * s.E : 0;
        const aI = m.gamma * s.I, aR = m.omega * s.R;
        const a0 = aInf + aE + aI + aR;
        if (a0 <= 0) { t = konec; break; }
        const dt = exponencialni(rnd, a0);
        if (t + dt >= konec) { t = konec; break; }  // bezpaměťovost: na hranici dne losujeme znovu
        t += dt;
        const u = rnd() * a0;
        if (u < aInf) {
          s.S--; s.kum++;
          if (Number.isFinite(m.sigma)) s.E++; else s.I++;
        } else if (u < aInf + aE) { s.E--; s.I++; }
        else if (u < aInf + aE + aI) { s.I--; s.R++; }
        else { s.R--; s.S++; }
        if (++udalosti > maxU) return { z, udalosti, preruseno: true, N };
      }
      zapisDen(z, konec, s);
    }
    return { z, udalosti, preruseno: false, N };
  }

  /** Tau-leaping s binomickými přírůstky (nikdy nevzniknou záporné počty). */
  function tauLeaping(vstup, seed, tau = 0.1) {
    const m = intenzity(vstup);
    const { par } = m;
    const rnd = mulberry32(Agenti.normalizujSeed(seed));
    const s = pocatecniStav(par);
    const N = s.N, dny = Math.round(par.dny);
    const z = novyZaznam();
    zapisDen(z, 0, s);
    const krokuDen = Math.max(1, Math.round(1 / tau));
    const h = 1 / krokuDen;
    const pE = Number.isFinite(m.sigma) ? 1 - Math.exp(-m.sigma * h) : 1;
    const pI = 1 - Math.exp(-m.gamma * h), pR = 1 - Math.exp(-m.omega * h);
    for (let den = 0; den < dny; den++) {
      const b = m.beta(den), ip = m.imp(den);
      for (let k = 0; k < krokuDen; k++) {
        const lam = (b * s.I + ip) / N;
        const nInf = binomicke(rnd, s.S, 1 - Math.exp(-lam * h));
        const nEI = Number.isFinite(m.sigma) ? binomicke(rnd, s.E, pE) : 0;
        const nIR = binomicke(rnd, s.I, pI);
        const nRS = m.omega > 0 ? binomicke(rnd, s.R, pR) : 0;
        s.S += -nInf + nRS; s.R += nIR - nRS; s.I -= nIR; s.kum += nInf;
        if (Number.isFinite(m.sigma)) { s.E += nInf - nEI; s.I += nEI; } else s.I += nInf;
      }
      zapisDen(z, den + 1, s);
    }
    return { z, N };
  }

  /** Kvantil seřazeného pole (lineární interpolace, typ 7). */
  function kvantil(serazene, q) {
    const n = serazene.length;
    if (!n) return NaN;
    const h = (n - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
    return serazene[lo] + (h - lo) * (serazene[hi] - serazene[lo]);
  }

  /** Souhrn souboru běhů: kvantilové pásy po dnech a rozdělení konečné velikosti. */
  function souhrnSouboru(behy, veliciny = ['I', 'kum'], hranice) {
    const dny = behy[0].z.t.length;
    const pasy = {};
    for (const v of veliciny) {
      const q = { q025: [], q25: [], q50: [], q75: [], q975: [], prumer: [] };
      const sloupec = new Float64Array(behy.length);
      for (let d = 0; d < dny; d++) {
        for (let b = 0; b < behy.length; b++) sloupec[b] = behy[b].z[v][d];
        const s = Array.from(sloupec).sort((a, b) => a - b);
        q.q025.push(kvantil(s, 0.025)); q.q25.push(kvantil(s, 0.25)); q.q50.push(kvantil(s, 0.5));
        q.q75.push(kvantil(s, 0.75)); q.q975.push(kvantil(s, 0.975));
        q.prumer.push(s.reduce((a, x) => a + x, 0) / s.length);
      }
      pasy[v] = q;
    }
    const konecne = behy.map(b => b.z.kum[dny - 1]);
    const vymrele = konecne.filter(k => k < hranice).length;
    const velke = konecne.filter(k => k >= hranice);
    return {
      t: behy[0].z.t, pasy, konecne, vymrele, pocet: behy.length,
      pVymreni: vymrele / behy.length,
      prumerVelkych: velke.length ? velke.reduce((a, b) => a + b, 0) / velke.length : NaN
    };
  }

  /** Teoretická pravděpodobnost vymření ohniska (větvící proces) s I0 počátečními infekčními: (1/R0)^I0 pro exp. infekční dobu. */
  function pVymreniTeorie(R0, I0) { return R0 <= 1 ? 1 : Math.pow(1 / R0, I0); }

  // ---------- větvící proces se superšířením ----------
  /** Pravděpodobnostní vytvořující funkce počtu potomků: NB(R, k) nebo Poisson (k = ∞). */
  function pgf(R, k, s) {
    if (!Number.isFinite(k)) return Math.exp(-R * (1 - s));
    return Math.pow(1 + R / k * (1 - s), -k);
  }
  /** Pravděpodobnost vymření q = nejmenší kořen q = G(q) (iterace od 0 konverguje monotónně). */
  function pVymreniVetveni(R, k) {
    if (R <= 1) return 1;   // podkritický i kritický proces vymře s jistotou
    let q = 0;
    for (let i = 0; i < 100000; i++) {
      const n = pgf(R, k, q);
      if (Math.abs(n - q) < 1e-14) return n;
      q = n;
    }
    return q;
  }
  /** Podíl nakažených, kteří způsobí 80 % všech přenosů (z rozdělení NB, přesně přes pmf). */
  function podilPro80(R, k) {
    // pmf NB(R,k) nebo Poisson; procházíme od nejvyšších počtů potomků
    const kmax = Math.max(50, Math.ceil(R * 30 + 200));
    const pmf = new Float64Array(kmax + 1);
    if (!Number.isFinite(k)) { pmf[0] = Math.exp(-R); for (let x = 1; x <= kmax; x++) pmf[x] = pmf[x - 1] * R / x; }
    else {
      const p = k / (k + R);
      pmf[0] = Math.pow(p, k);
      for (let x = 1; x <= kmax; x++) pmf[x] = pmf[x - 1] * (x - 1 + k) / x * (1 - p);
    }
    let prenosy = 0, podil = 0;
    const cil = 0.8 * R;
    for (let x = kmax; x >= 1; x--) {
      const prispevek = x * pmf[x];
      if (prenosy + prispevek >= cil) { podil += (cil - prenosy) / x; return podil; }
      prenosy += prispevek; podil += pmf[x];
    }
    return podil;
  }
  /**
   * Simulace řetězců přenosu (Galton–Watson). Každý řetězec začíná jedním případem; skončí vymřením,
   * nebo překročením limitu případů (pak se počítá jako „velké ohnisko“).
   */
  function vetvici(R, k, pocet, seed, limit = 2000) {
    const rnd = mulberry32(Agenti.normalizujSeed(seed));
    const velikosti = [], potomci = [];
    let vymrelo = 0;
    for (let r = 0; r < pocet; r++) {
      let generace = 1, celkem = 1;
      while (generace > 0 && celkem < limit) {
        let dalsi = 0;
        for (let i = 0; i < generace; i++) {
          const x = zapBinom(rnd, R, k);
          if (potomci.length < 200000) potomci.push(x);
          dalsi += x;
        }
        generace = dalsi; celkem += dalsi;
      }
      if (generace === 0) { vymrelo++; velikosti.push(celkem); }
      else velikosti.push(Infinity);
    }
    return { pVymreni: vymrelo / pocet, velikosti, potomci, pocet };
  }

  const EpiStoch = {
    lgamma, gama, poisson, binomicke, zapBinom, normalni, intenzity, gillespie, tauLeaping, kvantil, souhrnSouboru,
    pVymreniTeorie, pgf, pVymreniVetveni, podilPro80, vetvici
  };
  if (uzel) module.exports = EpiStoch; else window.EpiStoch = EpiStoch;
})();
