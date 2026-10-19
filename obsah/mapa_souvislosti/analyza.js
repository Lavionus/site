/* ============================================================
   mapa_souvislosti/analyza.js – síťová analýza mapy souvislostí.
   Čistý modul bez DOM (testuje se v node: _test/mapa_souvislosti_analyza_test.js).

   Vstup: mapa jako z MapaJadro.novaMapa()/nactiData().mapa. Hrany na neexistující uzel
   a smyčky (od === do) se ignorují. Směr hrany: '->' orientovaná od→do, '<->' a '--'
   se ve směrovém režimu berou oběma směry. Výchozí je neorientovaný pohled.

   Konvence jako networkx (kvůli ověřitelnosti):
     betweenness  – Brandes; nevážený graf = paralelní hrany sloučené do jedné,
                    vážený (vahy:'sila') = délka hrany 1/sila, z paralelních ta nejsilnější;
                    normalizace 1/((n-1)(n-2)) přes uspořádané dvojice (neorientovaně tedy 2/…).
     closeness    – vzdálenosti K uzlu (u orientovaného jako networkx), klasická s wf_improved,
                    harmonická dělená (n-1).
     pagerank     – visící uzly rozdělují rovnoměrně, paralelní hrany se sčítají jako váha.
     eigenvector  – neorientovaně, mocninná metoda na A+I, L2 normalizace.
     komunity     – Louvain (lokální přesuny + agregace), paralelní hrany = váha.
   Metriky „tvaru“ (jádra, shlukování, vzdálenosti) počítají s jednoduchým neorientovaným grafem.
   Mosty a kloubové body s neorientovaným multigrafem (dvě paralelní hrany nejsou most).
   Vše bez rekurze – řetěz o tisících uzlů nepřeteče zásobník.
   ============================================================ */
(function () {
  'use strict';

  const EPS = 1e-9;

  /* deterministický generátor (mulberry32) – stejný jako v jádru */
  function nahoda(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function zamichej(n, rnd) {
    const p = new Int32Array(n);
    for (let i = 0; i < n; i++) p[i] = i;
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    return p;
  }
  const silaHrany = h => {
    const s = typeof h.sila === 'number' && isFinite(h.sila) && h.sila > 0 ? h.sila : 1;
    return s;
  };

  /* ---------- příprava grafu ---------- */
  /* G = { n, ids[], idx: Map id→i, hrany:[{a, b, smer, sila, id}] } – jen platné hrany */
  function priprav(mapa) {
    const uzly = (mapa && mapa.uzly) || [];
    const ids = [], idx = new Map();
    for (const u of uzly) if (u && !idx.has(u.id)) { idx.set(u.id, ids.length); ids.push(u.id); }
    const hrany = [];
    for (const h of (mapa && mapa.hrany) || []) {
      if (!h) continue;
      const a = idx.get(h.od), b = idx.get(h.do);
      if (a === undefined || b === undefined || a === b) continue;
      hrany.push({ a, b, smer: h.smer, sila: silaHrany(h), id: h.id });
    }
    return { n: ids.length, ids, idx, hrany };
  }

  /* CSR z polí oblouků (zdroj, cíl, hodnota) */
  function csr(n, z, c, v) {
    const off = new Int32Array(n + 1);
    for (let i = 0; i < z.length; i++) off[z[i] + 1]++;
    for (let i = 0; i < n; i++) off[i + 1] += off[i];
    const pos = off.slice(0, n);
    const adj = new Int32Array(z.length), hod = new Float64Array(z.length);
    for (let i = 0; i < z.length; i++) { const p = pos[z[i]]++; adj[p] = c[i]; hod[p] = v ? v[i] : 1; }
    return { n, off, adj, hod };
  }

  /* oblouky bez duplicit: hodnota = max síla (pro vážené) nebo 1.
     smerovy → '->' jen od→do; obraceny → otočit všechny oblouky */
  function oblouky(G, smerovy, obraceny) {
    const mapaP = new Map();
    const n = G.n;
    const pridej = (a, b, s) => {
      const k = obraceny ? b * n + a : a * n + b;
      const p = mapaP.get(k);
      if (p === undefined || s > p) mapaP.set(k, s);
    };
    for (const h of G.hrany) {
      pridej(h.a, h.b, h.sila);
      if (!smerovy || h.smer !== '->') pridej(h.b, h.a, h.sila);
    }
    const z = [], c = [], v = [];
    for (const [k, s] of mapaP) { z.push(Math.floor(k / n)); c.push(k % n); v.push(s); }
    return csr(n, z, c, v);
  }
  /* jednoduchý neorientovaný graf (s mezipamětí v G) */
  function jednoduchy(G) {
    if (!G._jed) G._jed = oblouky(G, false, false);
    return G._jed;
  }

  /* ---------- stupně ---------- */
  function stupne(mapa) {
    const G = priprav(mapa);
    const vys = new Map();
    const v = G.ids.map(() => ({ celkem: 0, vstup: 0, vystup: 0 }));
    for (const h of G.hrany) {
      v[h.a].celkem++; v[h.b].celkem++;
      v[h.a].vystup++; v[h.b].vstup++;
      if (h.smer !== '->') { v[h.a].vstup++; v[h.b].vystup++; }
    }
    G.ids.forEach((id, i) => vys.set(id, v[i]));
    return vys;
  }

  /* ---------- binární halda (vzdálenost, uzel) s líným mazáním ---------- */
  function halda() {
    const d = [], u = [];
    return {
      get velikost() { return d.length; },
      vloz(dist, uzel) {
        let i = d.length; d.push(dist); u.push(uzel);
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (d[p] <= dist) break;
          d[i] = d[p]; u[i] = u[p]; i = p;
        }
        d[i] = dist; u[i] = uzel;
      },
      vyjmi() {
        const top = u[0], topD = d[0];
        const ld = d.pop(), lu = u.pop();
        const n = d.length;
        if (n) {
          let i = 0;
          for (;;) {
            let l = 2 * i + 1;
            if (l >= n) break;
            if (l + 1 < n && d[l + 1] < d[l]) l++;
            if (d[l] >= ld) break;
            d[i] = d[l]; u[i] = u[l]; i = l;
          }
          d[i] = ld; u[i] = lu;
        }
        return [topD, top];
      }
    };
  }

  /* ---------- betweenness (Brandes) ---------- */
  function betweennessG(G, volby) {
    volby = volby || {};
    const n = G.n;
    const smerovy = !!volby.smerovy;
    const vazeny = volby.vahy === 'sila';
    const normalizovat = volby.normalizovat !== false;
    const g = oblouky(G, smerovy, false);
    const { off, adj, hod } = g;
    const delka = new Float64Array(hod.length);
    for (let i = 0; i < hod.length; i++) delka[i] = 6 / hod[i];   // 1/sila; ×6 → pro síly 1–3 celá čísla, přesné porovnání
    const bc = new Float64Array(n);
    const sigma = new Float64Array(n), delta = new Float64Array(n);
    const S = new Int32Array(n);
    const distI = new Int32Array(n), distF = new Float64Array(n);
    const fronta = new Int32Array(n);
    for (let s = 0; s < n; s++) {
      let pocet = 0;
      sigma.fill(0); delta.fill(0);
      sigma[s] = 1;
      if (!vazeny) {
        distI.fill(-1); distI[s] = 0;
        let hl = 0, ko = 0; fronta[ko++] = s;
        while (hl < ko) {
          const v = fronta[hl++]; S[pocet++] = v;
          const dv = distI[v] + 1;
          for (let p = off[v]; p < off[v + 1]; p++) {
            const w = adj[p];
            if (distI[w] < 0) { distI[w] = dv; fronta[ko++] = w; }
            if (distI[w] === dv) sigma[w] += sigma[v];
          }
        }
        for (let i = pocet - 1; i >= 0; i--) {
          const v = S[i], dv = distI[v] + 1;
          let dl = 0;
          for (let p = off[v]; p < off[v + 1]; p++) {
            const w = adj[p];
            if (distI[w] === dv) dl += sigma[v] / sigma[w] * (1 + delta[w]);
          }
          delta[v] = dl;
          if (v !== s) bc[v] += dl;
        }
      } else {
        distF.fill(Infinity); distF[s] = 0;
        const hot = new Uint8Array(n);
        const H = halda(); H.vloz(0, s);
        while (H.velikost) {
          const [dv, v] = H.vyjmi();
          if (hot[v] || dv > distF[v]) continue;
          hot[v] = 1; S[pocet++] = v;
          for (let p = off[v]; p < off[v + 1]; p++) {
            const w = adj[p]; if (hot[w]) continue;
            const alt = dv + delka[p];
            if (alt < distF[w] - EPS) { distF[w] = alt; sigma[w] = sigma[v]; H.vloz(alt, w); }
            else if (Math.abs(alt - distF[w]) <= EPS) sigma[w] += sigma[v];
          }
        }
        for (let i = pocet - 1; i >= 0; i--) {
          const v = S[i];
          let dl = 0;
          for (let p = off[v]; p < off[v + 1]; p++) {
            const w = adj[p];
            if (distF[w] !== Infinity && Math.abs(distF[w] - distF[v] - delka[p]) <= EPS && distF[w] > distF[v])
              dl += sigma[v] / sigma[w] * (1 + delta[w]);
          }
          delta[v] = dl;
          if (v !== s) bc[v] += dl;
        }
      }
    }
    /* škálování jako networkx: neorientovaně je každá dvojice započtena dvakrát */
    let k = 1;
    if (normalizovat) k = n > 2 ? 1 / ((n - 1) * (n - 2)) : 0;
    else if (!smerovy) k = 0.5;
    const vys = new Map();
    for (let i = 0; i < n; i++) vys.set(G.ids[i], bc[i] * k);
    return vys;
  }
  const betweenness = (mapa, volby) => betweennessG(priprav(mapa), volby);

  /* ---------- BFS vzdálenosti ---------- */
  function bfs(g, s, dist, fronta) {
    dist.fill(-1); dist[s] = 0;
    let hl = 0, ko = 0; fronta[ko++] = s;
    while (hl < ko) {
      const v = fronta[hl++], dv = dist[v] + 1;
      for (let p = g.off[v]; p < g.off[v + 1]; p++) { const w = g.adj[p]; if (dist[w] < 0) { dist[w] = dv; fronta[ko++] = w; } }
    }
    return ko;   // počet dosažených (vč. s); fronta[0..ko) v pořadí BFS
  }

  /* ---------- closeness ---------- */
  function closenessG(G, volby) {
    volby = volby || {};
    const n = G.n;
    const g = oblouky(G, !!volby.smerovy, true);   // obrácené: vzdálenosti K uzlu
    const dist = new Int32Array(n), fronta = new Int32Array(n);
    const vys = new Map();
    for (let u = 0; u < n; u++) {
      const r = bfs(g, u, dist, fronta);
      let soucet = 0, harm = 0;
      for (let i = 1; i < r; i++) { const d = dist[fronta[i]]; soucet += d; harm += 1 / d; }
      const klasicka = soucet > 0 && n > 1 ? ((r - 1) / soucet) * ((r - 1) / (n - 1)) : 0;
      vys.set(G.ids[u], { klasicka, harmonicka: n > 1 ? harm / (n - 1) : 0 });
    }
    return vys;
  }
  const closeness = (mapa, volby) => closenessG(priprav(mapa), volby);

  /* ---------- PageRank ---------- */
  function pagerankG(G, volby) {
    volby = volby || {};
    const n = G.n;
    const vys = new Map();
    if (!n) return vys;
    const alfa = typeof volby.tlumeni === 'number' ? volby.tlumeni : 0.85;
    const smerovy = volby.smerovy !== false;
    const tol = volby.tol || 1e-10, maxIter = volby.maxIter || 200;
    const z = [], c = [];
    for (const h of G.hrany) {
      z.push(h.a); c.push(h.b);
      if (!smerovy || h.smer !== '->') { z.push(h.b); c.push(h.a); }
    }
    const g = csr(n, z, c, null);   // paralelní oblouky zůstávají = váha
    const vystup = new Float64Array(n);
    for (let i = 0; i < n; i++) vystup[i] = g.off[i + 1] - g.off[i];
    let x = new Float64Array(n).fill(1 / n), nx = new Float64Array(n);
    for (let it = 0; it < maxIter; it++) {
      let visi = 0;
      for (let i = 0; i < n; i++) if (vystup[i] === 0) visi += x[i];
      const zaklad = (1 - alfa) / n + alfa * visi / n;
      nx.fill(zaklad);
      for (let i = 0; i < n; i++) {
        if (!vystup[i]) continue;
        const podil = alfa * x[i] / vystup[i];
        for (let p = g.off[i]; p < g.off[i + 1]; p++) nx[g.adj[p]] += podil;
      }
      let chyba = 0;
      for (let i = 0; i < n; i++) chyba += Math.abs(nx[i] - x[i]);
      const t = x; x = nx; nx = t;
      if (chyba < n * tol) break;
    }
    let s = 0;
    for (let i = 0; i < n; i++) s += x[i];
    for (let i = 0; i < n; i++) vys.set(G.ids[i], s > 0 ? x[i] / s : 1 / n);
    return vys;
  }
  const pagerank = (mapa, volby) => pagerankG(priprav(mapa), volby);

  /* ---------- vlastní vektor ---------- */
  function eigenvectorG(G, volby) {
    volby = volby || {};
    const n = G.n;
    const vys = new Map();
    if (!n) return vys;
    const g = jednoduchy(G);
    const tol = volby.tol || 1e-12, maxIter = volby.maxIter || 2000;
    let x = new Float64Array(n).fill(1 / n), nx = new Float64Array(n);
    for (let it = 0; it < maxIter; it++) {
      nx.set(x);   // A + I (jako networkx) – konverguje i u bipartitních grafů
      for (let i = 0; i < n; i++) for (let p = g.off[i]; p < g.off[i + 1]; p++) nx[g.adj[p]] += x[i];
      let norma = 0;
      for (let i = 0; i < n; i++) norma += nx[i] * nx[i];
      norma = Math.sqrt(norma) || 1;
      let chyba = 0;
      for (let i = 0; i < n; i++) { nx[i] /= norma; chyba += Math.abs(nx[i] - x[i]); }
      const t = x; x = nx; nx = t;
      if (chyba < n * tol) break;
    }
    for (let i = 0; i < n; i++) vys.set(G.ids[i], isFinite(x[i]) ? x[i] : 0);
    return vys;
  }
  const eigenvector = (mapa, volby) => eigenvectorG(priprav(mapa), volby);

  /* ---------- modularita ---------- */
  function hodnotaPrirazeni(prirazeni, id) {
    if (!prirazeni) return undefined;
    return typeof prirazeni.get === 'function' ? prirazeni.get(id) : prirazeni[id];
  }
  function modularitaG(G, prirazeni, rozliseni) {
    const res = typeof rozliseni === 'number' ? rozliseni : 1;
    const m = G.hrany.length;
    if (!m) return 0;
    /* komunita každého uzlu; chybějící = vlastní komunita */
    const kom = new Array(G.n);
    for (let i = 0; i < G.n; i++) { const c = hodnotaPrirazeni(prirazeni, G.ids[i]); kom[i] = c === undefined || c === null ? '\u0000' + i : c; }
    const vnitrni = new Map(), stupen = new Map();
    for (const h of G.hrany) {
      const ca = kom[h.a], cb = kom[h.b];
      stupen.set(ca, (stupen.get(ca) || 0) + 1);
      stupen.set(cb, (stupen.get(cb) || 0) + 1);
      if (ca === cb) vnitrni.set(ca, (vnitrni.get(ca) || 0) + 1);
    }
    let Q = 0;
    for (const [c, d] of stupen) Q += (vnitrni.get(c) || 0) / m - res * (d / (2 * m)) * (d / (2 * m));
    return Q;
  }
  const modularita = (mapa, prirazeni, rozliseni) => modularitaG(priprav(mapa), prirazeni, rozliseni);

  /* ---------- komunity (Louvain) ---------- */
  /* jedna úroveň: lokální přesuny; vrací komunitu každého uzlu (přečíslovanou) a jejich počet */
  function louvainUroven(g, vlastni, res, rnd) {
    const n = g.n, { off, adj, hod } = g;
    const k = new Float64Array(n);
    let m2 = 0;
    for (let i = 0; i < n; i++) {
      let s = 2 * vlastni[i];
      for (let p = off[i]; p < off[i + 1]; p++) s += hod[p];
      k[i] = s; m2 += s;
    }
    const kom = new Int32Array(n), tot = new Float64Array(n);
    for (let i = 0; i < n; i++) { kom[i] = i; tot[i] = k[i]; }
    if (m2 === 0) return { kom, pocet: n, zmena: false };
    const vahaK = new Float64Array(n), seznam = new Int32Array(n), znacka = new Int32Array(n).fill(-1);
    const poradi = zamichej(n, rnd);
    let zmena = false;
    for (let pruchod = 0; pruchod < 1000; pruchod++) {
      let presun = false;
      for (let oi = 0; oi < n; oi++) {
        const i = poradi[oi], ci = kom[i];
        let ns = 0;
        for (let p = off[i]; p < off[i + 1]; p++) {
          const j = adj[p]; if (j === i) continue;
          const c = kom[j];
          if (znacka[c] !== i) { znacka[c] = i; vahaK[c] = 0; seznam[ns++] = c; }
          vahaK[c] += hod[p];
        }
        tot[ci] -= k[i];
        const kiM = k[i] / m2;
        let nej = ci;
        let nejZisk = (znacka[ci] === i ? vahaK[ci] : 0) - res * tot[ci] * kiM;
        for (let t = 0; t < ns; t++) {
          const c = seznam[t];
          const zisk = vahaK[c] - res * tot[c] * kiM;
          if (zisk > nejZisk + 1e-12 || (Math.abs(zisk - nejZisk) <= 1e-12 && c === ci)) { nej = c; nejZisk = zisk; }
        }
        tot[nej] += k[i];
        if (nej !== ci) { kom[i] = nej; presun = true; zmena = true; }
        znacka[ci] = -1;
        for (let t = 0; t < ns; t++) znacka[seznam[t]] = -1;
      }
      if (!presun) break;
    }
    const nove = new Int32Array(n).fill(-1);
    let pocet = 0;
    for (let i = 0; i < n; i++) { if (nove[kom[i]] < 0) nove[kom[i]] = pocet++; kom[i] = nove[kom[i]]; }
    return { kom, pocet, zmena: zmena && pocet < n };
  }
  function agreguj(g, vlastni, kom, pocet) {
    const sv = new Float64Array(pocet);
    const mapaP = new Map();
    for (let i = 0; i < g.n; i++) {
      const ci = kom[i];
      sv[ci] += vlastni[i];
      for (let p = g.off[i]; p < g.off[i + 1]; p++) {
        const cj = kom[g.adj[p]];
        if (ci === cj) sv[ci] += g.hod[p] / 2;   // vnitřní hranu vidíme z obou konců
        else { const key = ci * pocet + cj; mapaP.set(key, (mapaP.get(key) || 0) + g.hod[p]); }
      }
    }
    const z = [], c = [], v = [];
    for (const [key, w] of mapaP) { z.push(Math.floor(key / pocet)); c.push(key % pocet); v.push(w); }
    return { g: csr(pocet, z, c, v), vlastni: sv };
  }
  function komunityG(G, volby) {
    volby = volby || {};
    const n = G.n;
    const seed = typeof volby.seed === 'number' ? volby.seed : 1;
    const res = typeof volby.rozliseni === 'number' ? volby.rozliseni : 1;
    const rnd = nahoda(seed);
    /* vážený neorientovaný graf: paralelní hrany se sčítají */
    const mapaP = new Map();
    for (const h of G.hrany) {
      const k1 = h.a * n + h.b, k2 = h.b * n + h.a;
      mapaP.set(k1, (mapaP.get(k1) || 0) + 1);
      mapaP.set(k2, (mapaP.get(k2) || 0) + 1);
    }
    const z = [], c = [], v = [];
    for (const [key, w] of mapaP) { z.push(Math.floor(key / n)); c.push(key % n); v.push(w); }
    let g = csr(n, z, c, v), vlastni = new Float64Array(n);
    let prirazeniI = new Int32Array(n);
    for (let i = 0; i < n; i++) prirazeniI[i] = i;
    const naMapu = pole => { const mp = new Map(); for (let i = 0; i < n; i++) mp.set(G.ids[i], pole[i]); return mp; };
    let Q = modularitaG(G, naMapu(prirazeniI), res);
    for (let uroven = 0; uroven < 100; uroven++) {
      const u = louvainUroven(g, vlastni, res, rnd);
      if (!u.zmena) break;
      const kandidat = new Int32Array(n);
      for (let i = 0; i < n; i++) kandidat[i] = u.kom[prirazeniI[i]];
      const Qn = modularitaG(G, naMapu(kandidat), res);
      if (!(Qn > Q + 1e-12)) break;
      Q = Qn; prirazeniI = kandidat;
      const a = agreguj(g, vlastni, u.kom, u.pocet);
      g = a.g; vlastni = a.vlastni;
    }
    /* přečíslování podle velikosti (sestupně), při shodě podle prvního uzlu */
    const vel = new Map(), prvni = new Map();
    for (let i = 0; i < n; i++) { const c0 = prirazeniI[i]; vel.set(c0, (vel.get(c0) || 0) + 1); if (!prvni.has(c0)) prvni.set(c0, i); }
    const poradi = Array.from(vel.keys()).sort((p, q) => vel.get(q) - vel.get(p) || prvni.get(p) - prvni.get(q));
    const nove = new Map(poradi.map((c0, i) => [c0, i]));
    const prirazeni = new Map();
    for (let i = 0; i < n; i++) prirazeni.set(G.ids[i], nove.get(prirazeniI[i]));
    return { prirazeni, pocet: poradi.length, modularita: modularitaG(G, prirazeni, res), velikosti: poradi.map(c0 => vel.get(c0)) };
  }
  const komunity = (mapa, volby) => komunityG(priprav(mapa), volby);

  /* ---------- mosty a kloubové body (iterativní DFS, Tarjan) ---------- */
  function mostyAKlouby(G) {
    const n = G.n;
    const z = [], c = [], v = [];
    G.hrany.forEach((h, e) => { z.push(h.a, h.b); c.push(h.b, h.a); v.push(e, e); });
    const g = csr(n, z, c, v);   // hod = index hrany
    const tin = new Int32Array(n).fill(-1), low = new Int32Array(n);
    const rodic = new Int32Array(n).fill(-1), rodicHrana = new Int32Array(n).fill(-1);
    const it = new Int32Array(n), deti = new Int32Array(n);
    const zas = new Int32Array(n);
    const mosty = [], kloub = new Uint8Array(n);
    let cas = 0;
    for (let r = 0; r < n; r++) {
      if (tin[r] >= 0) continue;
      let vrch = 0; zas[vrch++] = r; tin[r] = low[r] = cas++; it[r] = g.off[r];
      while (vrch) {
        const u = zas[vrch - 1];
        if (it[u] < g.off[u + 1]) {
          const p = it[u]++;
          const w = g.adj[p], e = g.hod[p];
          if (e === rodicHrana[u]) continue;
          if (tin[w] < 0) {
            rodic[w] = u; rodicHrana[w] = e; tin[w] = low[w] = cas++; it[w] = g.off[w];
            deti[u]++; zas[vrch++] = w;
          } else if (tin[w] < low[u]) low[u] = tin[w];
        } else {
          vrch--;
          const p = rodic[u];
          if (p >= 0) {
            if (low[u] < low[p]) low[p] = low[u];
            if (low[u] > tin[p]) mosty.push(rodicHrana[u]);
            if (rodic[p] >= 0 && low[u] >= tin[p]) kloub[p] = 1;
          }
        }
      }
      if (deti[r] > 1) kloub[r] = 1;
    }
    return { mostyE: mosty, kloub };
  }
  function mosty(mapa) {
    const G = priprav(mapa);
    return mostyAKlouby(G).mostyE.map(e => G.hrany[e].id);
  }
  function kloubove(mapa) {
    const G = priprav(mapa);
    const k = mostyAKlouby(G).kloub;
    return G.ids.filter((id, i) => k[i]);
  }

  /* ---------- k-jádra (Batagelj–Zaversnik) ---------- */
  function jadraG(G) {
    const n = G.n, g = jednoduchy(G);
    const deg = new Int32Array(n);
    let maxD = 0;
    for (let i = 0; i < n; i++) { deg[i] = g.off[i + 1] - g.off[i]; if (deg[i] > maxD) maxD = deg[i]; }
    const bin = new Int32Array(maxD + 1);
    for (let i = 0; i < n; i++) bin[deg[i]]++;
    let start = 0;
    for (let d = 0; d <= maxD; d++) { const num = bin[d]; bin[d] = start; start += num; }
    const vert = new Int32Array(n), pos = new Int32Array(n);
    for (let i = 0; i < n; i++) { pos[i] = bin[deg[i]]; vert[pos[i]] = i; bin[deg[i]]++; }
    for (let d = maxD; d >= 1; d--) bin[d] = bin[d - 1];
    if (maxD >= 0) bin[0] = 0;
    for (let i = 0; i < n; i++) {
      const v = vert[i];
      for (let p = g.off[v]; p < g.off[v + 1]; p++) {
        const u = g.adj[p];
        if (deg[u] > deg[v]) {
          const du = deg[u], pu = pos[u], pw = bin[du], w = vert[pw];
          if (u !== w) { pos[u] = pw; vert[pu] = w; pos[w] = pu; vert[pw] = u; }
          bin[du]++; deg[u]--;
        }
      }
    }
    const vys = new Map();
    for (let i = 0; i < n; i++) vys.set(G.ids[i], deg[i]);
    return vys;
  }
  const jadra = mapa => jadraG(priprav(mapa));

  /* ---------- shlukování ---------- */
  function shlukovaniG(G) {
    const n = G.n, g = jednoduchy(G);
    const znacka = new Int32Array(n).fill(-1);
    const lokalni = new Map();
    let soucet = 0, troj = 0, trojice = 0;
    for (let u = 0; u < n; u++) {
      const d = g.off[u + 1] - g.off[u];
      for (let p = g.off[u]; p < g.off[u + 1]; p++) znacka[g.adj[p]] = u;
      let t = 0;
      for (let p = g.off[u]; p < g.off[u + 1]; p++) {
        const v = g.adj[p];
        for (let q = g.off[v]; q < g.off[v + 1]; q++) if (znacka[g.adj[q]] === u) t++;
      }
      t /= 2;   // každý trojúhelník u–v–w viděn přes v i přes w
      const c = d > 1 ? 2 * t / (d * (d - 1)) : 0;
      lokalni.set(G.ids[u], c);
      soucet += c; troj += t; trojice += d * (d - 1) / 2;
    }
    return { lokalni, prumer: n ? soucet / n : 0, tranzitivita: trojice ? troj / trojice : 0 };
  }
  const shlukovani = mapa => shlukovaniG(priprav(mapa));

  /* ---------- komponenty (neorientovaně) ---------- */
  function komponentyG(G) {
    const n = G.n, g = jednoduchy(G);
    const komp = new Int32Array(n).fill(-1);
    const zas = new Int32Array(n);
    const velikosti = [];
    for (let s = 0; s < n; s++) {
      if (komp[s] >= 0) continue;
      const c = velikosti.length;
      let vrch = 0, vel = 0; zas[vrch++] = s; komp[s] = c;
      while (vrch) {
        const v = zas[--vrch]; vel++;
        for (let p = g.off[v]; p < g.off[v + 1]; p++) { const w = g.adj[p]; if (komp[w] < 0) { komp[w] = c; zas[vrch++] = w; } }
      }
      velikosti.push(vel);
    }
    return { komp, velikosti };
  }

  /* ---------- vzdálenosti ---------- */
  function vzdalenostiG(G, volby) {
    volby = volby || {};
    const n = G.n, g = jednoduchy(G);
    const { komp, velikosti } = komponentyG(G);
    if (!n) return { prumer: 0, prumernaDelka: 0, komponent: 0, odhad: false };
    let nejK = 0;
    for (let c = 1; c < velikosti.length; c++) if (velikosti[c] > velikosti[nejK]) nejK = c;
    const limit = volby.limit || 3000, vzorek = volby.vzorek || 300;
    const odhad = n > limit;
    let zdroje;
    if (odhad) zdroje = Array.from(zamichej(n, nahoda(volby.seed || 1)).subarray(0, Math.min(vzorek, n)));
    else { zdroje = new Array(n); for (let i = 0; i < n; i++) zdroje[i] = i; }
    const dist = new Int32Array(n), fronta = new Int32Array(n);
    let soucet = 0, dvojic = 0, prumer = 0, nejdal = -1;
    for (const s of zdroje) {
      const r = bfs(g, s, dist, fronta);
      for (let i = 1; i < r; i++) soucet += dist[fronta[i]];
      dvojic += r - 1;
      if (komp[s] === nejK && r > 1) {
        const ecc = dist[fronta[r - 1]];
        if (ecc > prumer) { prumer = ecc; nejdal = fronta[r - 1]; }
      }
    }
    if (odhad && nejdal >= 0) {
      /* dvojitý průchod: z nejvzdálenějšího nalezeného uzlu – zlepší dolní odhad průměru */
      for (let k = 0; k < 4 && nejdal >= 0; k++) {
        const r = bfs(g, nejdal, dist, fronta);
        const ecc = dist[fronta[r - 1]];
        if (ecc > prumer) { prumer = ecc; nejdal = fronta[r - 1]; } else break;
      }
    }
    return { prumer, prumernaDelka: dvojic ? soucet / dvojic : 0, komponent: velikosti.length, odhad };
  }
  const vzdalenosti = (mapa, volby) => vzdalenostiG(priprav(mapa), volby);

  /* ---------- shrnutí pro tabulku ---------- */
  function shrnuti(mapa, volby) {
    volby = volby || {};
    const G = priprav(mapa);
    const st = stupne(mapa);
    const bc = betweennessG(G, { smerovy: volby.smerovy, vahy: volby.vahy });
    const cl = closenessG(G, { smerovy: volby.smerovy });
    const pr = pagerankG(G, { tlumeni: volby.tlumeni, smerovy: volby.smerovy !== undefined ? volby.smerovy : true });
    const ev = eigenvectorG(G);
    const kom = komunityG(G, { seed: volby.seed, rozliseni: volby.rozliseni });
    const ja = jadraG(G);
    const sh = shlukovaniG(G);
    const mk = mostyAKlouby(G);
    const vz = vzdalenostiG(G);
    const mostyU = new Int32Array(G.n);
    for (const e of mk.mostyE) { mostyU[G.hrany[e].a]++; mostyU[G.hrany[e].b]++; }
    const radky = G.ids.map((id, i) => {
      const s = st.get(id);
      return {
        id, stupen: s.celkem, vstup: s.vstup, vystup: s.vystup,
        betweenness: bc.get(id), closeness: cl.get(id).harmonicka, closenessKlasicka: cl.get(id).klasicka,
        pagerank: pr.get(id), eigenvector: ev.get(id), komunita: kom.prirazeni.get(id),
        jadro: ja.get(id), shlukovani: sh.lokalni.get(id), mosty: mostyU[i], kloubovy: !!mk.kloub[i]
      };
    });
    const dvojic = jednoduchy(G).adj.length / 2;
    const n = G.n;
    return {
      radky,
      globalni: {
        uzlu: n, hran: G.hrany.length, hustota: n > 1 ? dvojic / (n * (n - 1) / 2) : 0,
        komponent: vz.komponent, modularita: kom.modularita, pocetKomunit: kom.pocet,
        prumer: vz.prumer, prumernaDelka: vz.prumernaDelka, odhadVzdalenosti: vz.odhad,
        tranzitivita: sh.tranzitivita, prumerneShlukovani: sh.prumer,
        mostu: mk.mostyE.length, kloubovych: radky.filter(r => r.kloubovy).length
      },
      komunity: kom
    };
  }

  const METRIKY = [
    { id: 'stupen', nazev: 'Stupeň', popis: 'kolik vztahů z uzlu vede nebo do něj míří – nejjednodušší míra propojenosti' },
    { id: 'vstup', nazev: 'Vstupní stupeň', popis: 'kolik vztahů do uzlu přichází (oboustranné a neorientované se počítají také)' },
    { id: 'vystup', nazev: 'Výstupní stupeň', popis: 'kolik vztahů z uzlu vychází (oboustranné a neorientované se počítají také)' },
    { id: 'betweenness', nazev: 'Mezilehlost', popis: 'jak často uzel leží na nejkratší cestě mezi ostatními – „most“ mezi tématy' },
    { id: 'closeness', nazev: 'Blízkost', popis: 'jak blízko má uzel v průměru ke všem ostatním (harmonický průměr vzdáleností, funguje i u rozpojené mapy)' },
    { id: 'pagerank', nazev: 'PageRank', popis: 'důležitost podle toho, kolik důležitých uzlů na tento uzel odkazuje – jako řazení stránek ve vyhledávači' },
    { id: 'eigenvector', nazev: 'Vliv (vlastní vektor)', popis: 'uzel je vlivný, když je spojený s jinými vlivnými uzly, ne jen s mnoha okrajovými' },
    { id: 'jadro', nazev: 'Jádro (k-core)', popis: 'nejvyšší k, pro které uzel patří do skupiny, kde má každý aspoň k sousedů – hloubka v hustém jádru mapy' },
    { id: 'shlukovani', nazev: 'Shlukování', popis: 'jaká část sousedů uzlu je propojena i navzájem – jak uzavřená je jeho „parta“' },
    { id: 'komunita', nazev: 'Komunita', popis: 'skupina uzlů propojených hustěji mezi sebou než se zbytkem mapy (metoda Louvain)' },
    { id: 'mosty', nazev: 'Mosty', popis: 'kolik vztahů uzlu je jediným spojením mezi dvěma částmi mapy – po jejich odebrání se mapa rozpadne' },
    { id: 'kloubovy', nazev: 'Kloubový uzel', popis: 'uzel, po jehož odebrání se mapa rozpadne na víc nespojených částí' }
  ];

  const API = {
    stupne, betweenness, closeness, pagerank, eigenvector, komunity, modularita,
    mosty, kloubove, jadra, shlukovani, vzdalenosti, shrnuti, METRIKY
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.MapaAnalyza = API;
})();
