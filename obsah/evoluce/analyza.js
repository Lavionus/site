/* ============================================================
   evoluce/analyza.js – statistika nad výsledky simulace (bez DOM).

   • popisná statistika a 95% interval spolehlivosti (Studentovo t),
   • lineární regrese (normální rovnice, Gaussova–Jordanova inverze),
   • selekční analýza podle Landeho a Arnolda (1983) nad dokončenými
     životy: diferenciál S, gradient β (směrový) a γ (kvadratický),
   • souhrn a agregace dávkových replik, CSV.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- popisná statistika ---------- */
  const T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131,
    2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  /** Kvantil t(0,975) pro df stupňů volnosti (tabulka do 30, dál aproximace s chybou < 0,003). */
  function tKvantil(df) {
    if (!(df >= 1)) return NaN;
    if (df <= 30) return T975[Math.floor(df) - 1];
    return 1.95996 + 2.4 / df + 2.6 / (df * df);
  }
  /** {n, prum, sd (výběrová), se, ci (polovina šířky 95% intervalu), min, max} */
  function popis(xs) {
    const v = xs.filter(Number.isFinite), n = v.length;
    if (!n) return { n: 0, prum: NaN, sd: NaN, se: NaN, ci: NaN, min: NaN, max: NaN };
    let s = 0, min = Infinity, max = -Infinity;
    for (const x of v) { s += x; if (x < min) min = x; if (x > max) max = x; }
    const prum = s / n;
    let q = 0; for (const x of v) q += (x - prum) * (x - prum);
    const sd = n > 1 ? Math.sqrt(q / (n - 1)) : 0, se = n > 1 ? sd / Math.sqrt(n) : NaN;
    return { n, prum, sd, se, ci: n > 1 ? tKvantil(n - 1) * se : NaN, min, max };
  }
  function harmonickyPrumer(xs) {
    const v = xs.filter(x => x > 0);
    if (!v.length) return 0;
    let s = 0; for (const x of v) s += 1 / x;
    return v.length / s;
  }

  /* ---------- lineární algebra ---------- */
  /** Inverze čtvercové matice (pole řádků) Gaussovou–Jordanovou eliminací s pivotací; singulární → null. */
  function inverze(A) {
    const n = A.length, M = A.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    let mez = 0; for (let i = 0; i < n; i++) mez = Math.max(mez, Math.abs(A[i][i]));
    mez = Math.max(mez * 1e-13, 1e-300);
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < mez) return null;
      [M[c], M[piv]] = [M[piv], M[c]];
      const d = M[c][c];
      for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c];
        if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
      }
    }
    return M.map(r => r.slice(n));
  }
  /** OLS z postačujících statistik: M = XᵀX, v = Xᵀy, yy = Σy², n; idx = použité sloupce. → {b, se, rss, df} | null */
  function regreseSumy(M, v, yy, n, idx) {
    const k = idx.length;
    if (n <= k) return null;
    const inv = inverze(idx.map(a => idx.map(b => M[a][b])));
    if (!inv) return null;
    const Xy = idx.map(a => v[a]);
    const b = inv.map(r => r.reduce((s, x, j) => s + x * Xy[j], 0));
    const rss = Math.max(0, yy - b.reduce((s, x, j) => s + x * Xy[j], 0));
    const df = n - k, s2 = rss / df;
    return { b, se: inv.map((r, i) => Math.sqrt(Math.max(0, s2 * r[i]))), rss, df };
  }
  /** OLS: X (řádky s prvním sloupcem 1), y. → {b, se, r2, n, df} | null */
  function regrese(X, y) {
    const n = X.length, k = n ? X[0].length : 0;
    const M = Array.from({ length: k }, () => new Array(k).fill(0)), v = new Array(k).fill(0);
    let yy = 0, sy = 0;
    for (let i = 0; i < n; i++) {
      const r = X[i]; yy += y[i] * y[i]; sy += y[i];
      for (let a = 0; a < k; a++) { v[a] += r[a] * y[i]; for (let b = 0; b < k; b++) M[a][b] += r[a] * r[b]; }
    }
    const r = regreseSumy(M, v, yy, n, Array.from({ length: k }, (_, i) => i));
    if (!r) return null;
    const sst = yy - sy * sy / n;
    return Object.assign(r, { r2: sst > 0 ? 1 - r.rss / sst : 0, n });
  }

  /* ---------- selekční analýza ---------- */
  /* Součet = {n, sw, sww, xx (horní trojúhelník D×D), xw (D), h (geny × biny × [n, Σw, Σw²])},
     x = [1, u₀…, u₀²…], u = (g − střed)/rozsah. Stejný formát vede jádro po kohortách. */
  function prazdnySoucet(G, B) {
    const D = 1 + 2 * G;
    return { n: 0, sw: 0, sww: 0, xx: new Array(D * (D + 1) / 2).fill(0), xw: new Array(D).fill(0), h: new Array(G * B * 3).fill(0) };
  }
  /** Součet ze záznamů {g, w} (stejný výpočet jako jádro). */
  function secti(zivoty, geny, B) {
    B = B || 16;
    const G = geny.length, D = 1 + 2 * G, S = prazdnySoucet(G, B);
    for (const z of zivoty) {
      if (!z || !Array.isArray(z.g) || !Number.isFinite(z.w)) continue;
      const x = [1];
      for (let j = 0; j < G; j++) x.push((z.g[j] - (geny[j].min + geny[j].max) / 2) / (geny[j].max - geny[j].min));
      for (let j = 0; j < G; j++) x.push(x[1 + j] * x[1 + j]);
      const w = z.w;
      S.n++; S.sw += w; S.sww += w * w;
      let q = 0;
      for (let a = 0; a < D; a++) { S.xw[a] += x[a] * w; for (let b = a; b < D; b++) S.xx[q++] += x[a] * x[b]; }
      for (let j = 0; j < G; j++) {
        let b = Math.floor((x[1 + j] + 0.5) * B); if (b >= B) b = B - 1; if (b < 0) b = 0;
        const o = (j * B + b) * 3; S.h[o]++; S.h[o + 1] += w; S.h[o + 2] += w * w;
      }
    }
    return S;
  }
  /** Lineární kombinace součtů: [[součet, koeficient], …] (např. vše − oběti katastrofy). */
  function kombinuj(casti) {
    const p = casti.find(c => c[0]);
    if (!p) return null;
    const R = { n: 0, sw: 0, sww: 0, xx: p[0].xx.map(() => 0), xw: p[0].xw.map(() => 0), h: p[0].h.map(() => 0) };
    for (const [S, k] of casti) {
      if (!S) continue;
      R.n += k * S.n; R.sw += k * S.sw; R.sww += k * S.sww;
      for (let i = 0; i < R.xx.length; i++) R.xx[i] += k * S.xx[i];
      for (let i = 0; i < R.xw.length; i++) R.xw[i] += k * S.xw[i];
      for (let i = 0; i < R.h.length; i++) R.h[i] += k * S.h[i];
    }
    return R;
  }

  /**
   * Lande & Arnold (1983) ze součtu. Fitness relativní (w / w̄), znaky standardizované (z − z̄)/sd.
   *   S  = cov(w_rel, z_std)        – selekční diferenciál (přímý + nepřímý výběr), v jednotkách sd
   *   β  = parciální regrese w_rel na všechny znaky – přímý směrový výběr
   *   γ  = 2 × koeficient u z² v modelu se čtverci – zakřivení (γ < 0 stabilizující, > 0 disruptivní)
   * Znaky bez rozptylu se z modelu vynechají. Regrese běží ve standardizovaném prostoru:
   * součty se převedou lineární transformací T (z = (u − m)/sd, z² = (u² − 2mu + m²)/sd²).
   */
  function selekceZeSum(S, geny) {
    const G = geny.length, D = 1 + 2 * G, N = S ? Math.round(S.n) : 0;
    if (N < 10) return { n: N, chyba: 'Málo jedinců (potřeba aspoň 10).' };
    const W = S.sw / N;
    if (!(W > 0)) return { n: N, chyba: 'Žádný z jedinců neměl potomky – fitness nelze relativizovat.' };
    const varW = Math.max(0, S.sww / N - W * W);
    const M = Array.from({ length: D }, () => new Array(D).fill(0));
    let q = 0;
    for (let a = 0; a < D; a++) for (let b = a; b < D; b++) { M[a][b] = M[b][a] = S.xx[q++]; }
    const m = [], sd = [], aktivni = [];
    for (let j = 0; j < G; j++) {
      m.push(M[0][1 + j] / N);
      sd.push(Math.sqrt(Math.max(0, M[1 + j][1 + j] / N - m[j] * m[j])));
      if (sd[j] > 1e-5) aktivni.push(j); // menší sd je jen zaokrouhlovací šum ze součtů (gen je fixovaný)
    }
    // T: řádky = nové proměnné (1, z_j, z_j²) jako kombinace starých (1, u_j, u_j²)
    const T = Array.from({ length: D }, () => new Array(D).fill(0));
    T[0][0] = 1;
    for (const j of aktivni) {
      const a = 1 + j, c = 1 + G + j, s1 = sd[j], s2 = sd[j] * sd[j];
      T[a][0] = -m[j] / s1; T[a][a] = 1 / s1;
      T[c][0] = m[j] * m[j] / s2; T[c][a] = -2 * m[j] / s2; T[c][c] = 1 / s2;
    }
    const TM = T.map(r => M[0].map((_, b) => r.reduce((s, x, k) => s + x * M[k][b], 0)));
    const Mz = TM.map(r => T.map(t => r.reduce((s, x, k) => s + x * t[k], 0)));
    const vz = T.map(r => r.reduce((s, x, k) => s + x * S.xw[k], 0) / W);
    const yy = S.sww / (W * W), sst = yy - N;
    const lin = aktivni.length ? regreseSumy(Mz, vz, yy, N, [0].concat(aktivni.map(j => 1 + j))) : null;
    const kv = aktivni.length ? regreseSumy(Mz, vz, yy, N, [0].concat(aktivni.map(j => 1 + j), aktivni.map(j => 1 + G + j))) : null;
    const B = S.h.length / (3 * G), t = tKvantil;
    const vysl = [];
    for (let j = 0; j < G; j++) {
      const d = geny[j], L = d.max - d.min, a = aktivni.indexOf(j);
      const r = { j, prum: (d.min + d.max) / 2 + m[j] * L, sd: sd[j] * L, S: NaN, beta: NaN, seBeta: NaN, gamma: NaN, seGamma: NaN, profil: [] };
      if (a >= 0) {
        r.S = vz[1 + j] / N;
        if (lin) { r.beta = lin.b[1 + a]; r.seBeta = lin.se[1 + a]; }
        if (kv) { const k = aktivni.length; r.gamma = 2 * kv.b[1 + k + a]; r.seGamma = 2 * kv.se[1 + k + a]; }
      }
      for (let b = 0; b < B; b++) {
        const o = (j * B + b) * 3, n = Math.round(S.h[o]);
        let w = NaN, ci = NaN;
        if (n > 0) {
          const mw = S.h[o + 1] / n;
          w = mw / W;
          if (n > 1) ci = t(n - 1) * Math.sqrt(Math.max(0, (S.h[o + 2] / n - mw * mw) * n / (n - 1)) / n) / W;
        }
        r.profil.push({ od: d.min + L * b / B, do: d.min + L * (b + 1) / B, n, w, ci });
      }
      vysl.push(r);
    }
    return { n: N, W, varW, I: varW / (W * W), r2: lin && sst > 0 ? 1 - lin.rss / sst : NaN, geny: vysl, aktivni };
  }
  /** Selekční analýza přímo ze záznamů {g, w}. */
  function selekce(zivoty, geny, volby) {
    return selekceZeSum(secti(zivoty, geny, (volby && volby.biny) || 16), geny);
  }
  /** Průkaznost koeficientu: |x| > 1,96 · SE (~ p < 0,05). */
  function pruka(x, se) { return Number.isFinite(x) && Number.isFinite(se) && se > 0 && Math.abs(x) > 1.96 * se; }

  /**
   * Výběr uzavřených kohort ze stavu jádra (stav.kohorty, šířka kohorty `sirka`).
   * okno = kolik kroků narození zpět od poslední uzavřené kohorty (Infinity = všechny).
   * → {soucet, od, do, kohort, otevrenych, nejstarsiZivy} | {chyba, nejstarsiZivy}
   */
  function uzavreneKohorty(stav, sirka, okno, bezKatastrofy) {
    const K = stav.kohorty || {};
    let nejstarsi = Infinity;
    for (const o of stav.orgs) { const z = stav.rod[o.id]; if (z && z.n < nejstarsi) nejstarsi = z.n; }
    const uz = [], otevrene = [];
    for (const k of Object.keys(K)) {
      const c = K[k];
      if (c.nb > 0 && c.nd === c.nb) uz.push(+k); else otevrene.push(+k);
    }
    if (!uz.length) return { chyba: 'Zatím se neuzavřela žádná kohorta.', nejstarsiZivy: nejstarsi };
    uz.sort((a, b) => a - b);
    const posledni = uz[uz.length - 1], odIdx = Number.isFinite(okno) ? posledni - Math.max(1, Math.round(okno / sirka)) + 1 : -Infinity;
    const vybrane = uz.filter(i => i >= odIdx);
    const casti = [];
    for (const i of vybrane) { casti.push([K[i].vse, 1]); if (bezKatastrofy && K[i].kat) casti.push([K[i].kat, -1]); }
    return {
      soucet: kombinuj(casti), od: vybrane[0] * sirka, do: (posledni + 1) * sirka - 1, kohort: vybrane.length,
      otevrenych: otevrene.length, nejstarsiZivy: nejstarsi,
    };
  }

  /* ---------- dávkové repliky ---------- */
  /** Souhrn jedné repliky: průměry znaků a velikosti populace v posledním `podil` záznamů (vymřelá → null). */
  function souhrnRepliky(v, podil) {
    podil = podil || 0.2;
    if (v.vymrelo !== null) return { vymrelo: v.vymrelo, n: 0, prum: null };
    const R = v.rada, od = Math.max(0, Math.floor(R.length * (1 - podil)));
    const cast = R.slice(od).filter(b => b.n > 0);
    if (!cast.length) return { vymrelo: null, n: 0, prum: null };
    const G = cast[0].prum.length, prum = new Array(G).fill(0);
    let n = 0;
    for (const b of cast) { n += b.n; for (let j = 0; j < G; j++) prum[j] += b.prum[j]; }
    return { vymrelo: null, n: n / cast.length, prum: prum.map(x => x / cast.length) };
  }
  /** Průběh přes repliky v čase: pro každý čas záznamu průměr ± 95% CI znaku `gi` (nebo velikosti, gi = 'n').
      Vymřelé repliky se od vymření nepočítají (n v bodě říká, kolik jich ještě žije). */
  function prubehReplik(vysledky, gi) {
    const casy = new Map();
    for (const v of vysledky) for (const b of v.rada) {
      if (!casy.has(b.t)) casy.set(b.t, []);
      if (b.n > 0 || gi === 'n') casy.get(b.t).push(gi === 'n' ? b.n : b.prum[gi]);
    }
    return Array.from(casy.entries()).sort((a, b) => a[0] - b[0]).map(([t, xs]) => Object.assign({ t }, popis(xs)));
  }

  /* ---------- CSV ---------- */
  /** RFC 4180 (čárka, desetinná tečka), nebo „české“ (středník, desetinná čárka – Excel v CZ). */
  function csv(radky, cesky) {
    const odd = cesky ? ';' : ',';
    const bunka = x => {
      if (x === null || x === undefined) return '';
      if (typeof x === 'number') { if (!Number.isFinite(x)) return ''; const s = String(+x.toPrecision(10)); return cesky ? s.replace('.', ',') : s; }
      const s = String(x);
      return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return radky.map(r => r.map(bunka).join(odd)).join('\r\n') + '\r\n';
  }

  const API = { tKvantil, popis, harmonickyPrumer, inverze, regrese, regreseSumy, secti, kombinuj, selekce, selekceZeSum, uzavreneKohorty, pruka, souhrnRepliky, prubehReplik, csv };
  if (typeof module !== 'undefined') module.exports = API;
  else (typeof window !== 'undefined' ? window : self).EvoAnalyza = API;
})();
