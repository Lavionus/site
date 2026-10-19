/* ============================================================
   epidemie/metapop.js – metapopulační model: několik regionů (kraje ČR) propojených mobilitou.
   Čistý modul bez DOM.

   V každém regionu i běží homogenní SEIR(S) (stejné parametry nákazy a zásahy jako hlavní model).
   Lidé z regionu i tráví podíl m svých kontaktů mimo domov; ty se rozdělí mezi ostatní regiony
   podle gravitačního modelu (Zipf 1946; Viboud et al. 2006, Science 312: 447):
       w_ij = N_j / d_ij^a  (i ≠ j),    M_ij = m · w_ij / Σ_k≠i w_ik,    M_ii = 1 − m
   Síla infekce v regionu i:
       λ_i = β(t) · Σ_j M_ij · I_j^ef / N_j  +  ι_i(t) / N_i
   kde I^ef = (1−pA)·f_iso + pA·rA vážené infekční a β(t) = p·c·m(t)·s(t).
   Pro m = 0 jsou regiony oddělené; pro M_ij = N_j/N (úplné promíchání) je model totožný s homogenním.
   ============================================================ */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const Model = uzel ? require('./model.js') : window.EpiModel;
  const Data = uzel ? require('./data.js') : window.EpiData;

  /** Vzdálenost po povrchu Země [km] (haversine). */
  function vzdalenost(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dlat = (b.lat - a.lat) * rad, dlon = (b.lon - a.lon) * rad;
    const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /** Matice míchání M (řádky sčítají do 1). regiony: [{N, lat, lon}], m = podíl kontaktů mimo region, a = exponent vzdálenosti. */
  function maticeMobility(regiony, m, a) {
    const n = regiony.length;
    const M = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      let suma = 0;
      const w = new Array(n).fill(0);
      for (let j = 0; j < n; j++) if (j !== i) { w[j] = regiony[j].N / Math.pow(Math.max(1, vzdalenost(regiony[i], regiony[j])), a); suma += w[j]; }
      for (let j = 0; j < n; j++) M[i][j] = j === i ? 1 - m : (suma > 0 ? m * w[j] / suma : 0);
      if (suma === 0) M[i][i] = 1;
    }
    return M;
  }

  /**
   * Simulace. vstup = parametry rozšířeného modelu (homogenní část), volby:
   *   { regiony (výchozí kraje ČR), mobilita m, exponent a, zdroj (index regionu), M (vlastní matice místo gravitační), prah (příchod) }
   * Počáteční nakažení I0 jsou všichni v regionu „zdroj“; populace regionů se škáluje na N (zachová poměry).
   */
  function simuluj(vstup, volby = {}) {
    const { par, chyby } = Model.over(Object.assign({}, vstup, { vek: false }));
    if (chyby.length) throw new Error(chyby.join(' '));
    const st = Model.priprav(par);
    const pod = Model.podilyProstredi();
    const reg0 = volby.regiony || Data.kraje;
    const celk = reg0.reduce((a, r) => a + r.N, 0);
    const meritko = volby.skutecnaPopulace ? 1 : par.N / celk;
    const regiony = reg0.map(r => Object.assign({}, r, { N: r.N * meritko }));
    const n = regiony.length;
    const M = volby.M || maticeMobility(regiony, volby.mobilita != null ? volby.mobilita : 0.05, volby.exponent != null ? volby.exponent : 2);
    const zdroj = Math.max(0, Math.min(n - 1, volby.zdroj || 0));
    const faktor = (1 - par.podilA) * st.fIso + par.podilA * par.rA;
    const sigma = par.latence ? 1 / par.inkubace : Infinity, gamma = st.gamma, omega = st.omega;
    const NK = 5; // S, E, I, R, kum
    const y = new Float64Array(n * NK);
    for (let i = 0; i < n; i++) {
      const I0 = i === zdroj ? Math.min(par.I0, regiony[i].N) : 0;
      const V = (regiony[i].N - I0) * par.ockovaniPodil * par.ucinnost;
      y[i * NK] = regiony[i].N - I0 - V; y[i * NK + 2] = I0;
    }
    const Vreg = regiony.map((r, i) => r.N - y[i * NK] - y[i * NK + 2]);
    const beta = (t) => {
      const m = Model.nasobitele(par, t);
      let mc = 0; for (const s of Model.PROSTREDI) mc += pod[s] * m[s];
      return par.p * par.c * mc * Model.sezonnost(par, t) * faktor;
    };
    const imp = (t) => (t >= par.importyOd && t < par.importyDo) ? par.importy : 0;
    const Ntot = regiony.reduce((a, r) => a + r.N, 0);
    function f(t, y, dy) {
      const b = beta(t), ip = imp(t);
      const prev = new Float64Array(n);
      for (let j = 0; j < n; j++) prev[j] = y[j * NK + 2] / regiony[j].N;
      for (let i = 0; i < n; i++) {
        let s = 0; for (let j = 0; j < n; j++) s += M[i][j] * prev[j];
        const lam = b * s + ip / Ntot;   // importy rozdělené úměrně populaci
        const o = i * NK, S = Math.max(0, y[o]), E = y[o + 1], I = y[o + 2], R = y[o + 3];
        const inf = lam * S;
        const odE = Number.isFinite(sigma) ? sigma * E : 0;
        dy[o] = -inf + omega * R;
        if (Number.isFinite(sigma)) { dy[o + 1] = inf - odE; dy[o + 2] = odE - gamma * I; }
        else { dy[o + 1] = 0; dy[o + 2] = inf - gamma * I; }
        dy[o + 3] = gamma * I - omega * R;
        dy[o + 4] = inf;
      }
    }
    const nn = n * NK;
    const k1 = new Float64Array(nn), k2 = new Float64Array(nn), k3 = new Float64Array(nn), k4 = new Float64Array(nn), tmp = new Float64Array(nn);
    const h = par.krok, kroku = Math.ceil(par.dny / h - 1e-9);
    const vys = { par, regiony, M, zdroj, t: [], S: regiony.map(() => []), E: regiony.map(() => []), I: regiony.map(() => []), R: regiony.map(() => []), kum: regiony.map(() => []), V: Vreg };
    const zapis = (t) => { vys.t.push(t); for (let i = 0; i < n; i++) { vys.S[i].push(y[i * NK]); vys.E[i].push(y[i * NK + 1]); vys.I[i].push(y[i * NK + 2]); vys.R[i].push(y[i * NK + 3]); vys.kum[i].push(y[i * NK + 4]); } };
    zapis(0);
    let t = 0, dalsi = 1;
    for (let k = 1; k <= kroku; k++) {
      const hk = Math.min(h, par.dny - t);
      f(t, y, k1);
      for (let i = 0; i < nn; i++) tmp[i] = y[i] + hk / 2 * k1[i];
      f(t + hk / 2, tmp, k2);
      for (let i = 0; i < nn; i++) tmp[i] = y[i] + hk / 2 * k2[i];
      f(t + hk / 2, tmp, k3);
      for (let i = 0; i < nn; i++) tmp[i] = y[i] + hk * k3[i];
      f(t + hk, tmp, k4);
      for (let i = 0; i < nn; i++) y[i] += hk / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      t = k === kroku ? par.dny : t + hk;
      if (t >= dalsi - 1e-9 || k === kroku) { zapis(t); while (dalsi <= t + 1e-9) dalsi += 1; }
    }
    // příchod epidemie: první den, kdy kumulativně nakažených ≥ prah (výchozí 10 osob) – u zdroje den 0
    const prah = volby.prah || 10;
    vys.prichod = regiony.map((r, i) => {
      if (i === zdroj) return 0;
      const k = vys.kum[i].findIndex(x => x >= prah);
      return k < 0 ? null : vys.t[k];
    });
    vys.vrchol = regiony.map((r, i) => { let m = 0, d = 0; vys.I[i].forEach((v, k) => { if (v > m) { m = v; d = vys.t[k]; } }); return { I: m, t: d, podil: m / r.N }; });
    vys.zasazeni = regiony.map((r, i) => (vys.kum[i][vys.t.length - 1] + (i === zdroj ? par.I0 : 0)) / r.N);
    return vys;
  }

  const EpiMeta = { vzdalenost, maticeMobility, simuluj };
  if (uzel) module.exports = EpiMeta; else window.EpiMeta = EpiMeta;
})();
