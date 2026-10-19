/* ============================================================
   epidemie/site.js – epidemie na síti kontaktů.
   Generátory sítí (neorientované, bez smyček a násobných hran), jejich statistiky,
   stochastická simulace SEIR na síti se superšířením a silově orientované rozložení pro kreslení.
   Čistý modul bez DOM.

   Sítě:
     • Erdős–Rényi G(n, p), p = k̄/(n−1)                       (Erdős & Rényi 1959; Batagelj & Brandes 2005 – generování v O(n+m))
     • Watts–Strogatz: kruh se sousedy do vzdálenosti k/2, přepojení s pravděpodobností β (Watts & Strogatz 1998)
     • Barabási–Albert: preferenční připojování, m hran na nový uzel (Barabási & Albert 1999)
     • Domácnosti + komunita: úplné grafy domácností + náhodné komunitní hrany (ER)
   Přenos: infekční uzel i nakazí vnímavého souseda po hraně e za krok dt s pravděpodobností
     1 − exp(−τ · w_e · m_e(t) · ν_i · dt),  τ = p·c / k̄  (průměrně stejná síla infekce jako v ODR),
     w_e = relativní váha (domácnost w_D, ostatní 1), ν_i ~ Gama(k, 1/k) = individuální infekčnost (superšíření).
   Odhad R0 pro konfigurační síť: R0 ≈ T · (⟨k²⟩ − ⟨k⟩)/⟨k⟩, T = přenosnost po hraně
     (exponenciální infekční doba: T = τ/(τ+γ); pevná doba D: T = 1 − e^(−τD)).
   ============================================================ */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const Agenti = uzel ? require('./agenti.js') : window.EpiAgenti;
  const Stoch = uzel ? require('./stochastika.js') : window.EpiStoch;
  const Model = uzel ? require('./model.js') : window.EpiModel;
  const mulberry32 = Agenti.mulberry32;

  /** Ze seznamu hran sestaví CSR (offsety, sousedé, váhy hran). Duplicitní hrany a smyčky zahodí. */
  function zHran(n, hrany, domacnostId) {
    const klice = new Set();
    const cist = [];
    for (const [a, b, w] of hrany) {
      if (a === b) continue;
      const u = Math.min(a, b), v = Math.max(a, b);
      const k = u * n + v;
      if (klice.has(k)) continue;
      klice.add(k); cist.push([u, v, w || 1]);
    }
    const stupen = new Int32Array(n);
    for (const [u, v] of cist) { stupen[u]++; stupen[v]++; }
    const off = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) off[i + 1] = off[i] + stupen[i];
    const sous = new Int32Array(off[n]), vaha = new Float32Array(off[n]);
    const kurzor = off.slice(0, n);
    for (const [u, v, w] of cist) {
      sous[kurzor[u]] = v; vaha[kurzor[u]++] = w;
      sous[kurzor[v]] = u; vaha[kurzor[v]++] = w;
    }
    return { n, off, sous, vaha, m: cist.length, hrany: cist, domacnost: domacnostId || null };
  }

  function erdosRenyi(n, k, rnd) {
    const p = Math.min(1, k / Math.max(1, n - 1));
    const hrany = [];
    if (p <= 0) return zHran(n, hrany);
    // Batagelj–Brandes: přeskakování geometricky rozdělených mezer
    const lp = Math.log(1 - p);
    let v = 1, w = -1;
    while (v < n) {
      const r = rnd();
      w = w + 1 + (p >= 1 ? 0 : Math.floor(Math.log(1 - r) / lp));
      while (w >= v && v < n) { w -= v; v++; }
      if (v < n) hrany.push([v, w, 1]);
    }
    return zHran(n, hrany);
  }

  function wattsStrogatz(n, k, beta, rnd) {
    const pul = Math.max(1, Math.floor(k / 2));
    const sada = new Set();
    const klic = (a, b) => Math.min(a, b) * n + Math.max(a, b);
    const hrany = [];
    for (let i = 0; i < n; i++) for (let j = 1; j <= pul; j++) { const b = (i + j) % n; hrany.push([i, b]); sada.add(klic(i, b)); }
    for (const e of hrany) {
      if (rnd() >= beta) continue;
      const a = e[0];
      for (let pokus = 0; pokus < 20; pokus++) {
        const b = Math.floor(rnd() * n);
        if (b === a || sada.has(klic(a, b))) continue;
        sada.delete(klic(e[0], e[1])); sada.add(klic(a, b)); e[1] = b;
        break;
      }
    }
    return zHran(n, hrany.map(([a, b]) => [a, b, 1]));
  }

  function barabasiAlbert(n, m, rnd) {
    m = Math.max(1, Math.min(m, n - 1));
    const hrany = [], cile = [];
    for (let i = 0; i <= m && i < n; i++) for (let j = 0; j < i; j++) { hrany.push([i, j, 1]); cile.push(i, j); }
    for (let v = m + 1; v < n; v++) {
      const vybrane = new Set();
      while (vybrane.size < m) vybrane.add(cile[Math.floor(rnd() * cile.length)]);
      for (const u of vybrane) { hrany.push([v, u, 1]); cile.push(v, u); }
    }
    return zHran(n, hrany);
  }

  /** Ilustrativní rozdělení velikosti domácností (1–6 osob), průměr ≈ 2,4. */
  const DOMACNOSTI = [0.30, 0.29, 0.18, 0.16, 0.05, 0.02];
  function domacnosti(n, kKomunita, wDomov, rnd) {
    const id = new Int32Array(n);
    const hrany = [];
    let i = 0, d = 0;
    while (i < n) {
      let u = rnd(), vel = 1;
      for (let s = 0; s < DOMACNOSTI.length; s++) { if (u < DOMACNOSTI[s]) { vel = s + 1; break; } u -= DOMACNOSTI[s]; vel = s + 1; }
      vel = Math.min(vel, n - i);
      for (let a = i; a < i + vel; a++) { id[a] = d; for (let b = i; b < a; b++) hrany.push([a, b, wDomov]); }
      i += vel; d++;
    }
    const kom = erdosRenyi(n, kKomunita, rnd);
    for (const [a, b] of kom.hrany) if (id[a] !== id[b]) hrany.push([a, b, 1]);
    return zHran(n, hrany, id);
  }

  /** Vytvoří síť podle typu. */
  function vytvorSit(typ, n, volby, seed) {
    const rnd = mulberry32(Agenti.normalizujSeed(seed));
    const k = volby.k || 6;
    let g;
    if (typ === 'ws') g = wattsStrogatz(n, k, volby.beta != null ? volby.beta : 0.1, rnd);
    else if (typ === 'ba') g = barabasiAlbert(n, Math.max(1, Math.round(k / 2)), rnd);
    else if (typ === 'dom') g = domacnosti(n, volby.kKomunita != null ? volby.kKomunita : 4, volby.wDomov || 3, rnd);
    else g = erdosRenyi(n, k, rnd);
    g.typ = typ;
    return g;
  }

  /** Statistiky sítě: průměrný stupeň, ⟨k²⟩, max stupeň, histogram, shlukovací koeficient (průměr lokálních). */
  function statistiky(g, sShlukovanim = true) {
    const { n, off, sous } = g;
    let s1 = 0, s2 = 0, max = 0;
    const hist = [];
    for (let i = 0; i < n; i++) {
      const d = off[i + 1] - off[i];
      s1 += d; s2 += d * d; if (d > max) max = d;
      hist[d] = (hist[d] || 0) + 1;
    }
    for (let d = 0; d <= max; d++) hist[d] = hist[d] || 0;
    let shluk = NaN;
    if (sShlukovanim) {
      const znacka = new Int32Array(n).fill(-1);
      let suma = 0;
      for (let i = 0; i < n; i++) {
        const d = off[i + 1] - off[i];
        if (d < 2) continue;
        for (let q = off[i]; q < off[i + 1]; q++) znacka[sous[q]] = i;
        let troj = 0;
        for (let q = off[i]; q < off[i + 1]; q++) {
          const j = sous[q];
          for (let r = off[j]; r < off[j + 1]; r++) if (znacka[sous[r]] === i) troj++;
        }
        suma += troj / (d * (d - 1));   // každý trojúhelník započten 2× → děleno d(d−1) místo d(d−1)/2
      }
      shluk = suma / n;
    }
    return { prumer: s1 / n, k2: s2 / n, max, hist, shluk, m: g.m };
  }

  /** Přenosnost po hraně T a odhad R0 = T(⟨k²⟩−⟨k⟩)/⟨k⟩ (konfigurační model). */
  function R0Site(stat, tau, gamma, pevne) {
    const T = pevne ? 1 - Math.exp(-tau / gamma) : tau / (tau + gamma);
    return { T, R0: stat.prumer > 0 ? T * (stat.k2 - stat.prumer) / stat.prumer : 0 };
  }

  /** Konečná velikost na síti ER (Poissonovy stupně) pro přenosnost T: z = 1 − exp(−k̄ T z) (Newman 2002). */
  function konecnaVelikostER(k, T) {
    const R = k * T;
    if (R <= 1) return 0;
    let z = 0.5;
    for (let i = 0; i < 10000; i++) { const n = 1 - Math.exp(-R * z); if (Math.abs(n - z) < 1e-14) return n; z = n; }
    return z;
  }

  /**
   * Simulace SEIR na síti. par = parametry rozšířeného modelu (p, c, inkubace, infekcni, latence, zasahy, izolace…),
   * volby: { seed, superK (Infinity = bez superšíření), pevne (pevné délky), dt }.
   */
  function vytvorEpidemii(g, vstup, volby) {
    const { par, chyby } = Model.over(Object.assign({}, vstup, { vek: false }));
    if (chyby.length) throw new Error(chyby.join(' '));
    const n = g.n;
    const stat = statistiky(g, false);
    const rnd = mulberry32(Agenti.normalizujSeed(volby.seed));
    const tau = stat.prumer > 0 ? par.p * par.c / stat.prumer : 0;
    const gamma = 1 / par.infekcni, sigma = par.latence ? 1 / par.inkubace : Infinity;
    const superK = volby.superK > 0 ? volby.superK : Infinity;
    const sim = {
      g, par, n, rnd, tau, gamma, sigma, superK, pevne: !!volby.pevne, dt: volby.dt || 0.1, t: 0, krokCislo: 0,
      stav: new Uint8Array(n), casovac: new Float64Array(n), nu: new Float64Array(n).fill(1),
      iso: new Uint8Array(n), isoCas: new Float64Array(n).fill(-1),
      sekundarni: new Int32Array(n), denNakazy: new Int32Array(n).fill(-1), zdroj: new Int32Array(n).fill(-1),
      kum: 0, zaznam: { t: [], S: [], E: [], I: [], R: [], V: [], kum: [] }, pocet: [0, 0, 0, 0, 0], prenosy: []
    };
    const pod = Model.podilyProstredi();
    sim.pod = pod;
    const I0 = Math.max(0, Math.min(n, Math.round(par.I0)));
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < I0; i++) {
      const j = i + Math.floor(rnd() * (n - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
      nastavI(sim, idx[i]); sim.denNakazy[idx[i]] = 0;
    }
    const nV = Math.round((n - I0) * par.ockovaniPodil * par.ucinnost);
    for (let i = I0; i < I0 + nV; i++) {
      const j = i + Math.floor(rnd() * (n - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
      sim.stav[idx[i]] = 4;
    }
    spocti(sim); zapis(sim, 0);
    return sim;
  }
  function delka(sim, prumer) { return sim.pevne ? prumer : -Math.log(1 - sim.rnd()) * prumer; }
  function nastavI(sim, i, zbytek = 0) {
    sim.stav[i] = 2;
    sim.casovac[i] = delka(sim, sim.par.infekcni) + zbytek;
    sim.nu[i] = Number.isFinite(sim.superK) ? Stoch.gama(sim.rnd, sim.superK, 1 / sim.superK) : 1;
    sim.iso[i] = 0; sim.isoCas[i] = -1;
    if (sim.par.izolacePodil > 0 && sim.rnd() < sim.par.izolacePodil) {
      if (sim.par.izolaceZpozdeni <= 0) sim.iso[i] = 1;
      else if (sim.par.izolaceZpozdeni < sim.casovac[i]) sim.isoCas[i] = sim.par.izolaceZpozdeni;
    }
  }
  function spocti(sim) { const p = [0, 0, 0, 0, 0]; for (let i = 0; i < sim.n; i++) p[sim.stav[i]]++; sim.pocet = p; }
  function zapis(sim, t) {
    const z = sim.zaznam, p = sim.pocet;
    z.t.push(t); z.S.push(p[0]); z.E.push(p[1]); z.I.push(p[2]); z.R.push(p[3]); z.V.push(p[4]); z.kum.push(sim.kum);
  }
  /** Jeden krok dt. */
  function krok(sim) {
    const { g, par, n, stav, casovac, rnd, dt } = sim;
    const t = sim.t;
    const m = Model.nasobitele(par, t);
    const s = Model.sezonnost(par, t);
    const mDomov = m.domov;
    // ostatní hrany: vážený průměr mimodomácích prostředí; u sítí bez domácností všechna prostředí
    const mOst = g.domacnost
      ? (sim.pod.skola * m.skola + sim.pod.prace * m.prace + sim.pod.ostatni * m.ostatni) / (sim.pod.skola + sim.pod.prace + sim.pod.ostatni)
      : (sim.pod.domov * m.domov + sim.pod.skola * m.skola + sim.pod.prace * m.prace + sim.pod.ostatni * m.ostatni);
    const nove = [];
    const den = Math.floor(t + dt + 1e-9);
    for (let i = 0; i < n; i++) {
      if (stav[i] !== 2 || sim.iso[i]) continue;
      const zaklad = sim.tau * sim.nu[i] * s * dt;
      for (let q = g.off[i]; q < g.off[i + 1]; q++) {
        const j = g.sous[q];
        if (stav[j] !== 0) continue;
        const dom = g.domacnost && g.domacnost[i] === g.domacnost[j];
        const lam = zaklad * g.vaha[q] * (dom ? mDomov : mOst);
        if (lam > 0 && rnd() < 1 - Math.exp(-lam)) {
          stav[j] = 5; // dočasně: nakažen v tomto kroku
          nove.push(j); sim.sekundarni[i]++; sim.zdroj[j] = i; sim.denNakazy[j] = den;
          sim.prenosy.push({ a: i, b: j, t: t + dt });
        }
      }
    }
    // průběh nemoci až po přenosu (infekční v tomto kroku šířili celý krok)
    for (let i = 0; i < n; i++) {
      if (stav[i] === 1) { casovac[i] -= dt; if (casovac[i] <= 0) nastavI(sim, i, casovac[i]); }
      else if (stav[i] === 2) {
        casovac[i] -= dt;
        if (casovac[i] <= 0) { stav[i] = 3; sim.iso[i] = 0; continue; }
        if (sim.isoCas[i] > 0) { sim.isoCas[i] -= dt; if (sim.isoCas[i] <= 0) { sim.iso[i] = 1; sim.isoCas[i] = -1; } }
      }
    }
    for (const j of nove) {
      if (Number.isFinite(sim.sigma)) { stav[j] = 1; casovac[j] = delka(sim, par.inkubace); }
      else nastavI(sim, j);
    }
    if (sim.prenosy.length > 300) sim.prenosy.splice(0, sim.prenosy.length - 300);
    sim.kum += nove.length;
    sim.krokCislo++;
    sim.t = sim.krokCislo * dt;
    spocti(sim);
    const d = Math.round(sim.t);
    if (Math.abs(sim.t - d) < dt / 2 && d > sim.zaznam.t[sim.zaznam.t.length - 1]) zapis(sim, d);
  }
  function skoncila(sim) { return sim.pocet[1] + sim.pocet[2] === 0; }
  function behni(g, par, volby, dny) {
    const sim = vytvorEpidemii(g, par, volby);
    const cil = Math.round(dny != null ? dny : sim.par.dny);
    while (sim.zaznam.t[sim.zaznam.t.length - 1] < cil) {
      if (skoncila(sim)) {  // doplnit záznam bez počítání
        const z = sim.zaznam, d = z.t[z.t.length - 1] + 1;
        z.t.push(d); z.S.push(z.S[z.S.length - 1]); z.E.push(0); z.I.push(0); z.R.push(z.R[z.R.length - 1]); z.V.push(z.V[z.V.length - 1]); z.kum.push(sim.kum);
        continue;
      }
      krok(sim);
    }
    return sim;
  }

  /**
   * Silově orientované rozložení (Fruchterman & Reingold 1991): odpudivé síly mezi všemi dvojicemi (O(n²) – jen pro kreslení
   * malých sítí do ~1 500 uzlů), přitažlivé po hranách, slabá gravitace ke středu, postupné ochlazování.
   * Vrací {x, y} v [0,1] a funkci krok() pro postupný výpočet.
   */
  function rozlozeni(g, seed) {
    const n = g.n, rnd = mulberry32((Agenti.normalizujSeed(seed) ^ 0x9e3779b9) >>> 0);
    const x = new Float64Array(n), y = new Float64Array(n);
    if (g.typ === 'ws') {
      for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; x[i] = 0.5 + 0.4 * Math.cos(a); y[i] = 0.5 + 0.4 * Math.sin(a); }
    } else for (let i = 0; i < n; i++) { x[i] = 0.1 + 0.8 * rnd(); y[i] = 0.1 + 0.8 * rnd(); }
    const k = 0.9 * Math.sqrt(1 / Math.max(1, n));
    let teplota = g.typ === 'ws' ? 0.01 : 0.08;
    const dx = new Float64Array(n), dy = new Float64Array(n);
    function krok() {
      dx.fill(0); dy.fill(0);
      const k2 = k * k;
      for (let i = 0; i < n; i++) {
        const xi = x[i], yi = y[i];
        for (let j = i + 1; j < n; j++) {
          let ddx = xi - x[j], ddy = yi - y[j];
          let d2 = ddx * ddx + ddy * ddy;
          if (d2 < 1e-10) { ddx = 1e-4 * (rnd() - 0.5); ddy = 1e-4 * (rnd() - 0.5); d2 = ddx * ddx + ddy * ddy; }
          const f = k2 / d2;
          dx[i] += ddx * f; dy[i] += ddy * f; dx[j] -= ddx * f; dy[j] -= ddy * f;
        }
      }
      for (const [a, b, w] of g.hrany) {
        const ddx = x[a] - x[b], ddy = y[a] - y[b];
        const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1e-6;
        const f = d / k * Math.min(2, w);
        dx[a] -= ddx * f; dy[a] -= ddy * f; dx[b] += ddx * f; dy[b] += ddy * f;
      }
      for (let i = 0; i < n; i++) {
        dx[i] += (0.5 - x[i]) * 0.3; dy[i] += (0.5 - y[i]) * 0.3;
        const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
        const s = Math.min(d, teplota) / d;
        x[i] = Math.min(0.98, Math.max(0.02, x[i] + dx[i] * s));
        y[i] = Math.min(0.98, Math.max(0.02, y[i] + dy[i] * s));
      }
      teplota = Math.max(0.001, teplota * 0.975);
    }
    return { x, y, krok };
  }

  const EpiSit = { zHran, erdosRenyi, wattsStrogatz, barabasiAlbert, domacnosti, vytvorSit, statistiky, R0Site, konecnaVelikostER, vytvorEpidemii, krok, skoncila, behni, rozlozeni, DOMACNOSTI };
  if (uzel) module.exports = EpiSit; else window.EpiSit = EpiSit;
})();
