/* ============================================================
   epidemie/agenti.js – stochastický agentový model (individual-based).
   Čistý modul bez DOM, všechna náhoda jde z jednoho generátoru se seedem
   (mulberry32), takže stejný seed + stejné parametry = stejný průběh.

   Svět: jednotkový čtverec s periodickými okraji (torus) – žádný okraj,
   každý agent má v průměru stejný počet sousedů v dosahu r:
       k = (N − 1) · π r²   →   r = √(k / (π (N − 1)))
   Kontakt = jiný agent v dosahu během jednoho časového kroku dt.
   Infekční agent nakazí vnímavého souseda za krok s pravděpodobností
       1 − exp(−p · κ · dt),   κ = c / k   [intenzita kontaktu na souseda za den],
   takže při dokonalém promíchání vychází střední počet nákaz za den β·S/N
   jako v deterministickém modelu (β = c·p).
   Omezení kontaktů zmenšuje dosah: r_ef = r·√(1 − m) → střední počet sousedů klesne o podíl m.
   Hledání sousedů: prostorová mřížka (bucket grid) s buňkou ≥ r, prohledává se 3×3 buněk.
   ============================================================ */
(function () {
  'use strict';
  const Jadro = (typeof module !== 'undefined') ? require('./jadro.js') : window.EpiJadro;
  // rozšířený model (časová osa zásahů, sezónnost) – volitelně; načte se líně, aby nevznikla kruhová závislost
  function modelRozsireny() { return (typeof module !== 'undefined') ? require('./model.js') : window.EpiModel; }

  /**
   * Funkce násobitelů v čase: m(t) = násobitel kontaktů (zmenšuje dosah), s(t) = sezónní násobitel přenosnosti.
   * Pokud vstup obsahuje pole zasahy (časová osa rozšířeného modelu), použije se ono, jinak jednoduché „omezení od–do“.
   */
  function casoveFunkce(vstup, par) {
    if (vstup && Array.isArray(vstup.zasahy)) {
      const M = modelRozsireny();
      const { par: pm } = M.over({ zasahy: vstup.zasahy, sezonA: vstup.sezonA || 0, sezonMax: vstup.sezonMax || 0 });
      const pod = M.podilyProstredi();
      return {
        m: (t) => { const n = M.nasobitele(pm, t); let x = 0; for (const k of M.PROSTREDI) x += pod[k] * n[k]; return x; },
        s: (t) => M.sezonnost(pm, t)
      };
    }
    return { m: (t) => Jadro.nasobitelKontaktu(par, t), s: () => 1 };
  }

  const S = 0, E = 1, I = 2, R = 3, V = 4;
  const AGENT_VYCHOZI = {
    seed: 12345,
    sousede: 6,          // střední počet agentů v dosahu
    mobilita: 0.05,      // délka strany světa za den
    skoky: 0.02,         // dálkové přesuny na agenta za den
    rozdeleni: 'exp',    // 'exp' | 'pevne' (délka inkubace a infekčnosti)
    superK: 0,           // disperze individuální infekčnosti k (0 nebo ∞ = všichni stejně infekční)
    dtAgent: 0.1,        // časový krok agentového modelu [den]
    maxAgentu: 50000
  };

  /** Generátor mulberry32 – rychlý, 32bitový stav, dostatečný pro výuku (ne pro kryptografii). */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalni(rnd) {
    let u = 0; while (u === 0) u = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  }
  /** Gama(tvar k, měřítko θ) – Marsaglia & Tsang (2000), pro k < 1 zesílení U^(1/k). */
  function gama(rnd, k, theta = 1) {
    if (!(k > 0)) return 0;
    if (k < 1) return gama(rnd, k + 1, theta) * Math.pow(1 - rnd(), 1 / k);
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do { x = normalni(rnd); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      const u = rnd();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v * theta;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * theta;
    }
  }
  /** Seed z čísla nebo textu → uint32. */
  function normalizujSeed(s) {
    if (typeof s === 'number' && Number.isFinite(s)) return (Math.floor(Math.abs(s)) % 4294967296) >>> 0;
    const t = String(s == null ? '' : s).trim();
    if (/^\d+$/.test(t)) return (Number(t) % 4294967296) >>> 0;
    let h = 2166136261 >>> 0; // FNV-1a
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }

  function overAgenty(vstup) {
    const { par, chyby } = Jadro.over(vstup);
    const v = Object.assign({}, AGENT_VYCHOZI, vstup || {});
    par.seed = normalizujSeed(v.seed);
    par.sousede = Number(v.sousede);
    if (!(par.sousede > 0)) chyby.push('Počet sousedů v dosahu musí být kladný.');
    par.mobilita = Math.max(0, Number(v.mobilita) || 0);
    par.skoky = Math.max(0, Number(v.skoky) || 0);
    par.rozdeleni = v.rozdeleni === 'pevne' ? 'pevne' : 'exp';
    par.superK = Number(v.superK) > 0 && Number.isFinite(Number(v.superK)) ? Number(v.superK) : Infinity;
    par.dtAgent = Number(v.dtAgent);
    if (!(par.dtAgent > 0 && par.dtAgent <= 1)) chyby.push('Krok agentového modelu musí být v (0; 1] dne.');
    if (par.N > v.maxAgentu) chyby.push('Agentový režim zvládne nejvýš ' + v.maxAgentu.toLocaleString('cs-CZ') + ' agentů.');
    if (par.N < 2) chyby.push('Agentový režim potřebuje aspoň 2 agenty.');
    if (Number.isFinite(par.I0) && par.I0 !== Math.round(par.I0)) chyby.push('Počet počátečních nakažených musí být v agentovém režimu celé číslo.');
    return { par, chyby };
  }

  /** Vytvoří simulaci. */
  function vytvor(vstup) {
    const { par, chyby } = overAgenty(vstup);
    if (chyby.length) throw new Error(chyby.join(' '));
    const n = par.N;
    const od = Jadro.odvozene(par);
    const rnd = mulberry32(par.seed);
    // dosah: k = (N−1)·π r², omezený na r ≤ 0,5 (polovina světa)
    let k = par.sousede;
    const kMax = (n - 1) * Math.PI * 0.25;
    let varovani = null;
    if (k > kMax) { varovani = 'Požadovaný počet sousedů je pro tak malou populaci nedosažitelný, použito ' + kMax.toFixed(1).replace('.', ',') + '.'; k = kMax; }
    const r = Math.sqrt(k / (Math.PI * (n - 1)));
    const kappa = k > 0 ? par.c / k : 0;
    const nc = Math.max(1, Math.min(1024, Math.floor(1 / r)));
    const casove = casoveFunkce(vstup, par);
    const sim = {
      nasob: casove.m, sezon: casove.s,
      par, od, rnd, n, k, r, kappa, nc, varovani,
      t: 0, krokCislo: 0,
      x: new Float64Array(n), y: new Float64Array(n), uhel: new Float64Array(n),
      stav: new Uint8Array(n), casovac: new Float64Array(n),
      iso: new Uint8Array(n), isoCas: new Float64Array(n), nu: new Float64Array(n).fill(1),   // isoCas > 0 = zbývá do izolace; −1 = neizoluje se
      zdroj: new Int32Array(n).fill(-1), sekundarni: new Int32Array(n), denNakazy: new Int32Array(n).fill(-1),
      nove: new Uint8Array(n), noveSeznam: new Int32Array(n),
      bunka: new Int32Array(n), pocty: new Int32Array(nc * nc + 1), poradi: new Int32Array(n),
      pocet: [0, 0, 0, 0, 0], kumulativne: 0,
      prenosy: [],            // posledních několik přenosů pro animaci
      zaznam: { t: [], S: [], E: [], I: [], R: [], V: [], C: [], incidence: [], RtTeor: [] }
    };
    for (let i = 0; i < n; i++) {
      sim.x[i] = rnd(); sim.y[i] = rnd(); sim.uhel[i] = rnd() * 2 * Math.PI; sim.isoCas[i] = -1;
    }
    // počáteční nakažení: přesně I0 náhodně vybraných (částečný Fisher–Yates)
    const idx = new Int32Array(n); for (let i = 0; i < n; i++) idx[i] = i;
    const I0 = Math.min(n, Math.round(par.I0));
    for (let i = 0; i < I0; i++) {
      const j = i + Math.floor(rnd() * (n - i));
      const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
      nastavInfekcni(sim, idx[i], 0);
      sim.denNakazy[idx[i]] = 0;
    }
    // počáteční očkování: přesně round((N − I0)·v·e) z vnímavých
    const nV = Math.round((n - I0) * par.ockovaniPodil * par.ucinnost);
    for (let i = I0; i < I0 + nV; i++) {
      const j = i + Math.floor(rnd() * (n - i));
      const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
      sim.stav[idx[i]] = V;
    }
    prepocitej(sim);
    zapisDen(sim, 0);
    return sim;
  }

  function delka(sim, prumer) {
    if (sim.par.rozdeleni === 'pevne') return prumer;
    return -Math.log(1 - sim.rnd()) * prumer;
  }

  function nastavInfekcni(sim, i, zbytek) {
    sim.stav[i] = I;
    sim.casovac[i] = delka(sim, sim.par.infekcni) + zbytek;
    if (Number.isFinite(sim.par.superK)) sim.nu[i] = gama(sim.rnd, sim.par.superK, 1 / sim.par.superK);
    sim.iso[i] = 0;
    sim.isoCas[i] = -1;
    if (sim.par.izolacePodil > 0 && sim.rnd() < sim.par.izolacePodil) {
      const d = sim.par.izolaceZpozdeni;
      if (d <= 0) sim.iso[i] = 1;
      else if (d < sim.casovac[i]) sim.isoCas[i] = d;
    }
  }

  function prepocitej(sim) {
    const p = [0, 0, 0, 0, 0];
    for (let i = 0; i < sim.n; i++) p[sim.stav[i]]++;
    sim.pocet = p;
  }

  function zapisDen(sim, t) {
    const z = sim.zaznam, p = sim.pocet;
    z.t.push(t); z.S.push(p[S]); z.E.push(p[E]); z.I.push(p[I]); z.R.push(p[R]); z.V.push(p[V]);
    const nC = z.C.length;
    z.incidence.push(nC ? (sim.kumulativne - z.C[nC - 1]) / (t - z.t[nC - 1] || 1) : 0);
    z.C.push(sim.kumulativne);
    z.RtTeor.push(sim.od.R0 * sim.od.fIso * sim.nasob(t) * sim.sezon(t) * p[S] / sim.n);
  }

  /** Sestaví prostorovou mřížku (counting sort podle buňky). */
  function mrizka(sim) {
    const { n, nc, x, y, bunka, pocty, poradi } = sim;
    pocty.fill(0);
    for (let i = 0; i < n; i++) {
      let cx = Math.floor(x[i] * nc), cy = Math.floor(y[i] * nc);
      if (cx >= nc) cx = nc - 1; if (cy >= nc) cy = nc - 1;
      const b = cy * nc + cx;
      bunka[i] = b; pocty[b + 1]++;
    }
    for (let b = 0; b < nc * nc; b++) pocty[b + 1] += pocty[b];
    // pocty[b] = začátek buňky b; použijeme kopii jako kurzor
    const kurzor = sim._kurzor || (sim._kurzor = new Int32Array(nc * nc));
    kurzor.set(pocty.subarray(0, nc * nc));
    for (let i = 0; i < n; i++) poradi[kurzor[bunka[i]]++] = i;
  }

  /** Jeden časový krok dt. */
  function krok(sim) {
    const { par, n, x, y, uhel, stav, casovac, iso, isoCas, rnd } = sim;
    const dt = par.dtAgent;
    const t = sim.t;
    const m = sim.nasob(t);
    // 1) pohyb (izolovaní stojí), náhodné otočky a dálkové přesuny
    const dalka = par.mobilita * dt;
    const pOtocka = 1 - Math.exp(-2 * dt);
    const pSkok = 1 - Math.exp(-par.skoky * dt);
    for (let i = 0; i < n; i++) {
      if (iso[i]) continue;
      if (pSkok > 0 && rnd() < pSkok) { x[i] = rnd(); y[i] = rnd(); continue; }
      if (rnd() < pOtocka) uhel[i] = rnd() * 2 * Math.PI;
      let nx = x[i] + Math.cos(uhel[i]) * dalka, ny = y[i] + Math.sin(uhel[i]) * dalka;
      nx -= Math.floor(nx); ny -= Math.floor(ny);
      x[i] = nx < 1 ? nx : 0; y[i] = ny < 1 ? ny : 0;
    }
    // 2) přenos – jen od neizolovaných infekčních, sousedé z mřížky 3×3
    const rEf = sim.r * Math.sqrt(m);
    const r2 = rEf * rEf;
    const intenzita = par.p * sim.kappa * dt * sim.sezon(t);
    const pInf = 1 - Math.exp(-intenzita);
    const hetero = Number.isFinite(par.superK);
    let noveN = 0;
    if (r2 > 0 && pInf > 0) {
      mrizka(sim);
      const { nc, pocty, poradi, nove, noveSeznam, zdroj, sekundarni, denNakazy } = sim;
      const hrubeSila = nc < 3;
      const den = Math.floor(t + dt + 1e-9);
      for (let i = 0; i < n; i++) {
        if (stav[i] !== I || iso[i]) continue;
        const xi = x[i], yi = y[i];
        const pI = hetero ? 1 - Math.exp(-intenzita * sim.nu[i]) : pInf;
        const zkus = (j) => {
          if (j === i || stav[j] !== S || nove[j]) return;
          let dx = x[j] - xi, dy = y[j] - yi;
          if (dx > 0.5) dx -= 1; else if (dx < -0.5) dx += 1;
          if (dy > 0.5) dy -= 1; else if (dy < -0.5) dy += 1;
          if (dx * dx + dy * dy >= r2) return;
          if (rnd() < pI) {
            nove[j] = 1; noveSeznam[noveN++] = j;
            zdroj[j] = i; sekundarni[i]++; denNakazy[j] = den;
            sim.prenosy.push({ x1: xi, y1: yi, x2: x[j], y2: y[j], t: t + dt });
          }
        };
        if (hrubeSila) { for (let j = 0; j < n; j++) zkus(j); continue; }
        const cx = sim.bunka[i] % nc, cy = (sim.bunka[i] - cx) / nc;
        for (let oy = -1; oy <= 1; oy++) {
          const by = (cy + oy + nc) % nc;
          for (let ox = -1; ox <= 1; ox++) {
            const b = by * nc + (cx + ox + nc) % nc;
            for (let q = pocty[b], e = pocty[b + 1]; q < e; q++) zkus(poradi[q]);
          }
        }
      }
    }
    // 3) průběh nemoci (až po přenosu: kdo byl v tomto kroku infekční, šířil celý krok)
    for (let i = 0; i < n; i++) {
      const s = stav[i];
      if (s === E) {
        casovac[i] -= dt;
        if (casovac[i] <= 0) nastavInfekcni(sim, i, casovac[i]);
      } else if (s === I) {
        casovac[i] -= dt;
        if (casovac[i] <= 0) { stav[i] = R; iso[i] = 0; isoCas[i] = -1; continue; }
        if (isoCas[i] > 0) { isoCas[i] -= dt; if (isoCas[i] <= 0) { iso[i] = 1; isoCas[i] = -1; } }
      }
    }
    // 4) průběžné očkování vnímavých (kromě právě nakažených)
    if (par.ockovaniTempo > 0 && t >= par.ockovaniOd) {
      const pV = 1 - Math.exp(-par.ockovaniTempo * par.ucinnost * dt);
      for (let i = 0; i < n; i++) if (stav[i] === S && !sim.nove[i] && rnd() < pV) stav[i] = V;
    }
    // 5) nově nakažení dostanou stav až teď (časovače jim běží od dalšího kroku)
    {
      const { nove, noveSeznam } = sim;
      for (let q = 0; q < noveN; q++) {
        const j = noveSeznam[q];
        nove[j] = 0;
        if (par.model === 'SEIR') { stav[j] = E; casovac[j] = delka(sim, par.inkubace); }
        else nastavInfekcni(sim, j, 0);
      }
      if (sim.prenosy.length > 400) sim.prenosy.splice(0, sim.prenosy.length - 400);
    }
    sim.kumulativne += noveN;
    sim.krokCislo++;
    sim.t = sim.krokCislo * dt;
    prepocitej(sim);
    const den = Math.round(sim.t);
    if (Math.abs(sim.t - den) < dt / 2 && den > sim.zaznam.t[sim.zaznam.t.length - 1]) zapisDen(sim, den);
    return noveN;
  }

  /** Simuluje do zadaného dne (celé číslo). */
  function dojdiDo(sim, den) {
    while (sim.zaznam.t[sim.zaznam.t.length - 1] < den) krok(sim);
  }

  /** Je epidemie u konce (žádný E ani I)? */
  function skoncila(sim) { return sim.pocet[E] + sim.pocet[I] === 0; }

  /**
   * Empirické reprodukční číslo podle dne nákazy: průměr sekundárních nákaz
   * u kohorty nakažené daný den. Kohorta je „úplná“, když už nikdo z ní není E ani I.
   */
  function rtEmpiricky(sim, minVelikost = 5) {
    const dny = sim.zaznam.t.length;
    const soucet = new Float64Array(dny), pocet = new Int32Array(dny), otevrene = new Int32Array(dny);
    for (let i = 0; i < sim.n; i++) {
      const d = sim.denNakazy[i];
      if (d < 0 || d >= dny) continue;
      soucet[d] += sim.sekundarni[i]; pocet[d]++;
      if (sim.stav[i] === E || sim.stav[i] === I) otevrene[d]++;
    }
    const t = [], hodnota = [], uplna = [], velikost = [];
    for (let d = 0; d < dny; d++) {
      if (pocet[d] < minVelikost) continue;
      t.push(d); hodnota.push(soucet[d] / pocet[d]); uplna.push(otevrene[d] === 0); velikost.push(pocet[d]);
    }
    return { t, hodnota, uplna, velikost };
  }

  /** Bezobrazová simulace na daný počet dní (nebo do vyhasnutí, pokud doDoby=false). */
  function behni(vstup, dny) {
    const sim = vytvor(vstup);
    const cil = Math.round(dny != null ? dny : sim.par.dny);
    while (sim.zaznam.t[sim.zaznam.t.length - 1] < cil) krok(sim);
    return sim;
  }

  const EpiAgenti = { S, E, I, R, V, AGENT_VYCHOZI, mulberry32, normalni, gama, normalizujSeed, overAgenty, vytvor, krok, dojdiDo, skoncila, rtEmpiricky, behni, mrizka };
  if (typeof module !== 'undefined') module.exports = EpiAgenti; else window.EpiAgenti = EpiAgenti;
})();
