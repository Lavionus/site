/* ============================================================
   epidemie/model.js – rozšířený deterministický kompartmentový model.
   Čistý modul bez DOM (testy v node).

   Přihrádky v každé skupině g (věková skupina, v homogenním režimu jediná skupina):
     S  vnímaví            E  exponovaní (latence; lze vypnout → SIR)
     A  asymptomatičtí infekční (relativní infekčnost rA)
     I  symptomatičtí infekční      H  hospitalizovaní (mimo JIP)     C  na JIP
     R  zotavení (imunní)  D  zemřelí   V  chránění očkováním
   + pomocné kumulativní čítače: nakažení, hospitalizace, podané dávky.

   Síla infekce:
     λ_g(t) = p · s(t) · Σ_h C_gh(t) · (f_iso·I_h + rA·A_h) / N_h  +  ι(t)/N
     C(t) = Σ_prostředí m_prostředí(t) · C^prostředí · κ      (κ škáluje matici na průměr c kontaktů/den)
     s(t) = 1 + a · cos(2π (t − t_max)/365)                     (sezónnost)
     f_iso = 1 − q · e^(−γ d)                                   (izolace jen symptomatických)
   Toky:
     S → E: λS,  E → A: pA·σE,  E → I: (1−pA)·σE,  A → R: γA,  I → H: h_g·γI,  I → R: (1−h_g)·γI
     H → C: c_JIP·H/dH,  H → D: fH_g·H/dH,  H → R: zbytek,  C → D: fC_g·C/dC,  C → R: (1−fC_g)·C/dC
     R → S: ω R (slábnutí imunity),  V → S: ωV V,  S → V: dávky·e·S/(S+E+A+R) (očkovací kampaň)
   Hospitalizace a JIP: h_g = IHR_g/(1−pA), φ_g = IFR_g/IHR_g (úmrtí z hospitalizovaných),
     podíl ψ úmrtí nastane na JIP: fC_g = ψ·φ_g/c_JIP, fH_g = (1−ψ)·φ_g  ⇒  IFR_g = (1−pA)·h_g·(fH_g + c_JIP·fC_g).
   Reprodukční číslo: R = ρ(K) – spektrální poloměr matice dalších generací (next-generation matrix)
     K_gh = p · s(t) · C_gh(t) · (S_g/N_h) · D_h,   D = [(1−pA)·f_iso + pA·rA] / γ.
   ============================================================ */
(function () {
  'use strict';
  const Data = (typeof module !== 'undefined') ? require('./data.js') : window.EpiData;

  const PROSTREDI = ['domov', 'skola', 'prace', 'ostatni'];
  const NAZVY_PROSTREDI = { vse: 'všechny kontakty', domov: 'domácnost', skola: 'škola', prace: 'práce', ostatni: 'ostatní (volný čas, doprava…)' };
  const KOMP = ['S', 'E', 'A', 'I', 'H', 'C', 'R', 'D', 'V', 'kInf', 'kHosp', 'kDavky'];
  const NK = KOMP.length;
  const [iS, iE, iA, iI, iH, iC, iR, iD, iV, iKI, iKH, iKD] = KOMP.map((_, i) => i);

  // ---------- data: agregace 16 pětiletých skupin do 8 desetiletých ----------
  /** Agreguje matici kontaktů M (n×n) do skupin podle mapy skupina[i] → J, váženo populací (kontakty se sčítají přes j, průměrují přes i). */
  function agregujMatici(M, pop, mapa, G) {
    const out = Array.from({ length: G }, () => new Array(G).fill(0));
    const popG = new Array(G).fill(0);
    for (let i = 0; i < M.length; i++) popG[mapa[i]] += pop[i];
    for (let i = 0; i < M.length; i++) for (let j = 0; j < M.length; j++) out[mapa[i]][mapa[j]] += pop[i] * M[i][j];
    for (let I = 0; I < G; I++) for (let J = 0; J < G; J++) out[I][J] /= popG[I];
    return { M: out, pop: popG };
  }
  /** Reciprocita: počet kontaktů skupiny i se skupinou j musí být roven počtu kontaktů j s i: C_ij N_i = C_ji N_j. */
  function symetrizuj(M, pop) {
    const G = M.length;
    const out = Array.from({ length: G }, () => new Array(G).fill(0));
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) out[i][j] = (M[i][j] * pop[i] + M[j][i] * pop[j]) / (2 * pop[i]);
    return out;
  }
  const MAPA8 = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7];
  let _cache8 = null;
  /** Data pro 8 věkových skupin ČR: populace, matice podle prostředí (symetrizované). */
  function dataCR8() {
    if (_cache8) return _cache8;
    const matice = {};
    let pop = null;
    for (const s of PROSTREDI) {
      const a = agregujMatici(Data.kontakty[s], Data.populaceCR5, MAPA8, 8);
      pop = a.pop;
      matice[s] = symetrizuj(a.M, a.pop);
    }
    _cache8 = { skupiny: Data.zavaznost8.skupiny.slice(), pop, matice, ihr: Data.zavaznost8.ihr.slice(), ifr: Data.zavaznost8.ifr.slice() };
    return _cache8;
  }
  /** Průměrný počet kontaktů za den v populaci pro matici M. */
  function prumerKontaktu(M, pop) {
    let s = 0, n = 0;
    for (let i = 0; i < M.length; i++) { let r = 0; for (let j = 0; j < M.length; j++) r += M[i][j]; s += pop[i] * r; n += pop[i]; }
    return s / n;
  }
  /** Podíly kontaktů podle prostředí v ČR (pro homogenní model). */
  function podilyProstredi() {
    const d = dataCR8();
    const c = {}; let celk = 0;
    for (const s of PROSTREDI) { c[s] = prumerKontaktu(d.matice[s], d.pop); celk += c[s]; }
    for (const s of PROSTREDI) c[s] /= celk;
    return c;
  }

  // ---------- lineární algebra ----------
  /** Spektrální poloměr nezáporné matice (mocninná metoda; pro G ≤ 2 přesně). */
  function spektralniPolomer(K) {
    const n = K.length;
    if (n === 1) return Math.abs(K[0][0]);
    if (n === 2) {
      const tr = K[0][0] + K[1][1], det = K[0][0] * K[1][1] - K[0][1] * K[1][0];
      const disk = Math.max(0, tr * tr / 4 - det);
      return Math.abs(tr / 2) + Math.sqrt(disk);
    }
    let v = new Array(n).fill(1 / n), lam = 0;
    // posun o malou kladnou diagonálu zaručí konvergenci i u periodických matic
    const posun = 1e-9;
    for (let it = 0; it < 500; it++) {
      const w = new Array(n).fill(0);
      for (let i = 0; i < n; i++) { let s = posun * v[i]; for (let j = 0; j < n; j++) s += K[i][j] * v[j]; w[i] = s; }
      let norma = 0; for (let i = 0; i < n; i++) norma += Math.abs(w[i]);
      if (norma === 0) return 0;
      for (let i = 0; i < n; i++) w[i] /= norma;
      const nove = norma - posun;
      const zmena = Math.abs(nove - lam);
      v = w; lam = nove;
      if (it > 5 && zmena < 1e-13 * Math.max(1, lam)) break;
    }
    return lam;
  }

  // ---------- parametry ----------
  const VYCHOZI = {
    N: 100000, I0: 10, p: 0.05, c: 10,
    latence: true, inkubace: 5, infekcni: 5,
    podilA: 0, rA: 0.5,
    vek: false,
    zavaznost: true, ihrNasobek: 1, ifrNasobek: 1, podilJIP: 0.2, umrtiNaJIP: 0.5, dobaH: 8, dobaC: 10, kapH: 0, kapC: 0,
    imunitaDny: 0,         // 0 = trvalá imunita; jinak střední doba ochrany po prodělání (dny)
    imunitaVDny: 0,        // totéž po očkování
    sezonA: 0, sezonMax: 0,
    importy: 0, importyOd: 0, importyDo: 1e9,
    zasahy: [],            // [{ typ: 'vse'|'domov'|'skola'|'prace'|'ostatni', od, do, sila }]
    izolacePodil: 0, izolaceZpozdeni: 2,
    ockovaniPodil: 0, ucinnost: 0.9,
    kampanOd: 0, kampanDavky: 0, kampanPriorita: 'nejstarsi', kampanUcast: 0.8,
    dny: 365, krok: 0.25
  };
  const PRIORITY = { nejstarsi: 'nejstarší napřed', nejmladsi: 'nejmladší napřed', rovnomerne: 'rovnoměrně podle zbývajících', kontakty: 'nejvíc kontaktů napřed' };

  function cislo(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }

  /** Ověří a doplní parametry. Vrací { par, chyby }. */
  function over(vstup) {
    const v = Object.assign({}, VYCHOZI, vstup || {});
    const chyby = [];
    const par = Object.assign({}, v);
    for (const k of Object.keys(VYCHOZI)) if (typeof VYCHOZI[k] === 'number') par[k] = cislo(v[k], NaN);
    par.latence = !!v.latence; par.vek = !!v.vek; par.zavaznost = !!v.zavaznost;
    const rozsah = (k, a, b, text) => { if (!(par[k] >= a && par[k] <= b)) chyby.push(text); };
    rozsah('N', 1, 1e10, 'Velikost populace musí být 1 až 10 miliard.');
    rozsah('I0', 0, par.N, 'Počet počátečních nakažených musí být 0 až N.');
    rozsah('p', 0, 1, 'Pravděpodobnost přenosu musí ležet v intervalu 0–1.');
    rozsah('c', 0, 1000, 'Kontaktní míra musí být 0–1000 za den.');
    if (par.latence) rozsah('inkubace', 1e-3, 1000, 'Délka latence musí být kladná.');
    rozsah('infekcni', 1e-3, 1000, 'Infekční období musí být kladné.');
    rozsah('podilA', 0, 1, 'Podíl asymptomatických musí být 0–1.');
    rozsah('rA', 0, 1, 'Relativní infekčnost asymptomatických musí být 0–1.');
    rozsah('podilJIP', 0, 1, 'Podíl JIP musí být 0–1.');
    rozsah('umrtiNaJIP', 0, 1, 'Podíl úmrtí na JIP musí být 0–1.');
    rozsah('dobaH', 0.1, 365, 'Doba hospitalizace musí být 0,1–365 dní.');
    rozsah('dobaC', 0.1, 365, 'Doba na JIP musí být 0,1–365 dní.');
    rozsah('ihrNasobek', 0, 100, 'Násobek hospitalizací musí být 0–100.');
    rozsah('ifrNasobek', 0, 100, 'Násobek smrtnosti musí být 0–100.');
    rozsah('imunitaDny', 0, 1e6, 'Doba imunity nesmí být záporná.');
    rozsah('imunitaVDny', 0, 1e6, 'Doba ochrany po očkování nesmí být záporná.');
    rozsah('sezonA', 0, 1, 'Sezónní amplituda musí být 0–1.');
    rozsah('importy', 0, 1e9, 'Importy nesmí být záporné.');
    rozsah('izolacePodil', 0, 1, 'Podíl izolovaných musí být 0–1.');
    rozsah('izolaceZpozdeni', 0, 1000, 'Zpoždění izolace nesmí být záporné.');
    rozsah('ockovaniPodil', 0, 1, 'Počáteční proočkovanost musí být 0–1.');
    rozsah('ucinnost', 0, 1, 'Účinnost vakcíny musí být 0–1.');
    rozsah('kampanDavky', 0, 1e9, 'Počet dávek za den nesmí být záporný.');
    rozsah('kampanUcast', 0, 1, 'Ochota k očkování musí být 0–1.');
    rozsah('dny', 1, 10000, 'Délka simulace musí být 1–10 000 dní.');
    rozsah('krok', 1e-3, 5, 'Krok RK4 musí být v intervalu (0; 5] dne.');
    if (par.dny / par.krok > 2e6) chyby.push('Příliš malý krok vzhledem k délce simulace.');
    if (!PRIORITY[par.kampanPriorita]) par.kampanPriorita = 'nejstarsi';
    par.zasahy = (Array.isArray(v.zasahy) ? v.zasahy : []).map(z => ({
      typ: NAZVY_PROSTREDI[z.typ] ? z.typ : 'vse', od: Math.max(0, cislo(z.od, 0)), do: Math.max(0, cislo(z.do, 0)), sila: Math.min(1, Math.max(0, cislo(z.sila, 0)))
    })).filter(z => z.do > z.od);
    return { par, chyby };
  }

  /** Sestaví strukturu modelu (skupiny, matice, závažnost) z parametrů. */
  function priprav(par) {
    const d = dataCR8();
    let G, pop, matice, ihr, ifr, skupiny;
    if (par.vek) {
      G = 8; skupiny = d.skupiny;
      const celk = d.pop.reduce((a, b) => a + b, 0);
      pop = d.pop.map(x => x / celk * par.N);
      const prumer = prumerKontaktu(PROSTREDI.reduce((M, s) => M.map((r, i) => r.map((x, j) => x + d.matice[s][i][j])), Array.from({ length: 8 }, () => new Array(8).fill(0))), d.pop);
      const kappa = prumer > 0 ? par.c / prumer : 0;
      matice = {}; for (const s of PROSTREDI) matice[s] = d.matice[s].map(r => r.map(x => x * kappa));
      ihr = d.ihr; ifr = d.ifr;
    } else {
      G = 1; skupiny = ['vše'];
      pop = [par.N];
      const podily = podilyProstredi();
      matice = {}; for (const s of PROSTREDI) matice[s] = [[par.c * podily[s]]];
      // průměrná závažnost vážená populací ČR (za předpokladu stejného zasažení všech věkových skupin)
      const celk = d.pop.reduce((a, b) => a + b, 0);
      ihr = [d.ihr.reduce((a, x, i) => a + x * d.pop[i] / celk, 0)];
      ifr = [d.ifr.reduce((a, x, i) => a + x * d.pop[i] / celk, 0)];
    }
    // přepočet na pravděpodobnosti přechodů
    const h = [], fH = [], fC = [], varovani = [];
    let omezenoIFR = false;
    for (let g = 0; g < G; g++) {
      const IHR = Math.min(1, ihr[g] * par.ihrNasobek), IFR = Math.min(1, ifr[g] * par.ifrNasobek);
      let hg = par.zavaznost && par.podilA < 1 ? IHR / (1 - par.podilA) : 0;
      if (hg > 1) { hg = 1; varovani.push('Podíl hospitalizovaných symptomatických omezen na 100 %.'); }
      // φ = pravděpodobnost úmrtí hospitalizovaného; podíl ψ úmrtí nastává na JIP, zbytek na běžném lůžku
      let fh = 0, fc = 0;
      if (par.zavaznost && IHR > 0) {
        let phi = IFR / IHR;
        if (phi > 1) { phi = 1; omezenoIFR = true; }
        const psi = par.podilJIP > 0 ? par.umrtiNaJIP : 0;
        fc = par.podilJIP > 0 ? psi * phi / par.podilJIP : 0;
        if (fc > 1) { fc = 1; omezenoIFR = true; }
        fh = phi - par.podilJIP * fc;
        if (fh > 1 - par.podilJIP) { fh = 1 - par.podilJIP; omezenoIFR = true; }
      }
      h.push(hg); fH.push(fh); fC.push(fc);
    }
    if (omezenoIFR) varovani.push('Zadanou smrtnost nejde při daném podílu JIP přesně splnit – u některých skupin je oříznuta.');
    // pořadí priorit očkování
    let poradi = [...Array(G).keys()];
    const radkoveSoucty = poradi.map(g => PROSTREDI.reduce((a, s) => a + matice[s][g].reduce((x, y) => x + y, 0), 0));
    if (par.kampanPriorita === 'nejstarsi') poradi.reverse();
    else if (par.kampanPriorita === 'kontakty') poradi.sort((a, b) => radkoveSoucty[b] - radkoveSoucty[a]);
    const gamma = 1 / par.infekcni;
    const fIso = 1 - par.izolacePodil * Math.exp(-gamma * par.izolaceZpozdeni);
    return {
      G, skupiny, pop, matice, h, fH, fC, poradi, radkoveSoucty, varovani,
      sigma: par.latence ? 1 / par.inkubace : Infinity, gamma, fIso,
      omega: par.imunitaDny > 0 ? 1 / par.imunitaDny : 0,
      omegaV: par.imunitaVDny > 0 ? 1 / par.imunitaVDny : 0,
      ihrSkut: h.map((x, g) => x * (1 - par.podilA)),
      ifrSkut: h.map((x, g) => x * (1 - par.podilA) * (fH[g] + par.podilJIP * fC[g]))
    };
  }

  /** Násobitele kontaktů podle prostředí v čase t (zásahy se násobí). */
  function nasobitele(par, t) {
    const m = { domov: 1, skola: 1, prace: 1, ostatni: 1 };
    for (const z of par.zasahy) {
      if (t < z.od || t >= z.do) continue;
      if (z.typ === 'vse') for (const s of PROSTREDI) m[s] *= 1 - z.sila;
      else m[z.typ] *= 1 - z.sila;
    }
    return m;
  }
  function sezonnost(par, t) { return par.sezonA > 0 ? 1 + par.sezonA * Math.cos(2 * Math.PI * (t - par.sezonMax) / 365) : 1; }
  function importy(par, t) { return (t >= par.importyOd && t < par.importyDo) ? par.importy : 0; }

  /** Efektivní matice kontaktů v čase t. */
  function maticeV(st, m) {
    const G = st.G;
    const C = Array.from({ length: G }, () => new Array(G).fill(0));
    for (const s of PROSTREDI) {
      const ms = m[s]; if (ms === 0) continue;
      const M = st.matice[s];
      for (let g = 0; g < G; g++) for (let h = 0; h < G; h++) C[g][h] += ms * M[g][h];
    }
    return C;
  }

  /** Matice dalších generací K (G×G). S = vektor vnímavých (výchozí = celá populace). */
  function maticeDalsichGeneraci(par, st, t, S, sZasahy = true) {
    const m = sZasahy ? nasobitele(par, t) : { domov: 1, skola: 1, prace: 1, ostatni: 1 };
    const C = maticeV(st, m);
    const fIso = sZasahy ? st.fIso : 1;
    const D = ((1 - par.podilA) * fIso + par.podilA * par.rA) / st.gamma;
    const s = sZasahy ? sezonnost(par, t) : 1;
    const K = [];
    for (let g = 0; g < st.G; g++) {
      K.push([]);
      for (let h = 0; h < st.G; h++) K[g].push(par.p * s * C[g][h] * (S ? S[g] : st.pop[g]) / st.pop[h] * D);
    }
    return K;
  }
  /** Základní reprodukční číslo R0 (bez zásahů, plně vnímavá populace, průměrná sezóna). */
  function R0(vstup) {
    const { par, chyby } = over(vstup);
    if (chyby.length) throw new Error(chyby.join(' '));
    const st = priprav(par);
    return spektralniPolomer(maticeDalsichGeneraci(par, st, 0, null, false));
  }

  /** Rozdělení dávek mezi skupiny (dávek/den) podle priority. */
  function davky(par, st, y, t) {
    const G = st.G, out = new Array(G).fill(0);
    if (par.kampanDavky <= 0 || t < par.kampanOd) return out;
    const zbyva = new Array(G);
    for (let g = 0; g < G; g++) zbyva[g] = Math.max(0, par.kampanUcast * st.pop[g] - y[g * NK + iKD]);
    let kap = par.kampanDavky;
    if (par.kampanPriorita === 'rovnomerne') {
      const suma = zbyva.reduce((a, b) => a + b, 0);
      if (suma <= 0) return out;
      for (let g = 0; g < G; g++) out[g] = Math.min(zbyva[g], kap * zbyva[g] / suma);
      return out;
    }
    for (const g of st.poradi) {
      if (kap <= 0) break;
      const a = Math.min(kap, zbyva[g]); // hladké dobíhání: skupina dostane nejvýš „zbývá za 1 den“
      out[g] = a; kap -= a;
    }
    return out;
  }

  /** Pravá strana soustavy ODR. */
  function derivace(par, st, t, y, dy) {
    const G = st.G;
    const m = nasobitele(par, t);
    const C = maticeV(st, m);
    const sez = sezonnost(par, t);
    const imp = importy(par, t);
    const Ntot = st.pop.reduce((a, b) => a + b, 0);
    const J = new Array(G);
    for (let h = 0; h < G; h++) J[h] = (st.fIso * y[h * NK + iI] + par.rA * y[h * NK + iA]) / st.pop[h];
    const dv = davky(par, st, y, t);
    const { sigma, gamma, omega, omegaV } = st;
    const pA = par.podilA;
    for (let g = 0; g < G; g++) {
      const o = g * NK;
      let lam = 0;
      for (let h = 0; h < G; h++) lam += C[g][h] * J[h];
      lam = par.p * sez * lam + imp / Ntot;
      const S = y[o + iS], E = y[o + iE], A = y[o + iA], I = y[o + iI], H = y[o + iH], Cc = y[o + iC], R = y[o + iR], V = y[o + iV];
      const inf = lam * Math.max(0, S);
      const zdravi = S + E + A + R;
      const vac = dv[g] > 0 && zdravi > 0 ? dv[g] * par.ucinnost * Math.max(0, S) / zdravi : 0;
      const hg = st.h[g], fh = st.fH[g], fc = st.fC[g];
      dy[o + iS] = -inf - vac + omega * R + omegaV * V;
      let doA, doI;
      if (par.latence) { dy[o + iE] = inf - sigma * E; doA = pA * sigma * E; doI = (1 - pA) * sigma * E; }
      else { dy[o + iE] = 0; doA = pA * inf; doI = (1 - pA) * inf; }
      dy[o + iA] = doA - gamma * A;
      dy[o + iI] = doI - gamma * I;
      const hosp = hg * gamma * I;
      const odH = H / par.dobaH, odC = Cc / par.dobaC;
      dy[o + iH] = hosp - odH;
      dy[o + iC] = par.podilJIP * odH - odC;
      dy[o + iD] = fh * odH + fc * odC;
      dy[o + iR] = gamma * A + (1 - hg) * gamma * I + (1 - par.podilJIP - fh) * odH + (1 - fc) * odC - omega * R;
      dy[o + iV] = vac - omegaV * V;
      dy[o + iKI] = inf;
      dy[o + iKH] = hosp;
      dy[o + iKD] = dv[g];
    }
  }

  /** Počáteční stav. */
  function pocatek(par, st) {
    const G = st.G, y = new Float64Array(G * NK);
    const Ntot = st.pop.reduce((a, b) => a + b, 0);
    for (let g = 0; g < G; g++) {
      const o = g * NK;
      const I0 = par.I0 * st.pop[g] / Ntot;
      const zbytek = st.pop[g] - I0;
      const V = zbytek * par.ockovaniPodil * par.ucinnost;
      y[o + iS] = zbytek - V;
      y[o + iV] = V;
      y[o + iA] = par.podilA * I0;
      y[o + iI] = (1 - par.podilA) * I0;
      y[o + iKD] = zbytek * par.ockovaniPodil;
    }
    return y;
  }

  /**
   * Simulace. Výstup po dnech: t[], celkem {S,E,A,I,H,C,R,D,V,kInf,kHosp,kDavky}[], skupiny[g] {…}[], Rt[], incidence[], hospPrijmy[], umrtiDen[].
   */
  function simuluj(vstup, volby = {}) {
    const { par, chyby } = over(vstup);
    if (chyby.length) throw new Error(chyby.join(' '));
    const st = priprav(par);
    const G = st.G, n = G * NK;
    const f = (t, y, dy) => derivace(par, st, t, y, dy);
    const k1 = new Float64Array(n), k2 = new Float64Array(n), k3 = new Float64Array(n), k4 = new Float64Array(n), tmp = new Float64Array(n);
    let y = pocatek(par, st);
    const krokRK4 = (t, h) => {
      f(t, y, k1);
      for (let i = 0; i < n; i++) tmp[i] = y[i] + h / 2 * k1[i];
      f(t + h / 2, tmp, k2);
      for (let i = 0; i < n; i++) tmp[i] = y[i] + h / 2 * k2[i];
      f(t + h / 2, tmp, k3);
      for (let i = 0; i < n; i++) tmp[i] = y[i] + h * k3[i];
      f(t + h, tmp, k4);
      for (let i = 0; i < n; i++) y[i] += h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    };
    const vys = { par, st, t: [], celkem: {}, skupiny: [], Rt: [], incidence: [], hospPrijmy: [], umrtiDen: [] };
    for (const k of KOMP) vys.celkem[k] = [];
    for (let g = 0; g < G; g++) { const o = {}; for (const k of KOMP) o[k] = []; vys.skupiny.push(o); }
    const bezRt = !!volby.bezRt;
    const zapis = (t) => {
      vys.t.push(t);
      for (let i = 0; i < NK; i++) {
        let s = 0;
        for (let g = 0; g < G; g++) { const v = y[g * NK + i]; vys.skupiny[g][KOMP[i]].push(v); s += v; }
        vys.celkem[KOMP[i]].push(s);
      }
      if (!bezRt) {
        const S = []; for (let g = 0; g < G; g++) S.push(Math.max(0, y[g * NK + iS]));
        vys.Rt.push(spektralniPolomer(maticeDalsichGeneraci(par, st, t, S, true)));
      }
      const j = vys.t.length - 1;
      const dt = j ? t - vys.t[j - 1] : 1;
      vys.incidence.push(j ? (vys.celkem.kInf[j] - vys.celkem.kInf[j - 1]) / dt : 0);
      vys.hospPrijmy.push(j ? (vys.celkem.kHosp[j] - vys.celkem.kHosp[j - 1]) / dt : 0);
      vys.umrtiDen.push(j ? (vys.celkem.D[j] - vys.celkem.D[j - 1]) / dt : 0);
    };
    zapis(0);
    const h = par.krok;
    const kroku = Math.ceil(par.dny / h - 1e-9);
    let t = 0, dalsi = 1;
    let vrcholI = { hodnota: y.reduce((a, _, i) => (i % NK === iI || i % NK === iA) ? a + y[i] : a, 0), t: 0 };
    for (let k = 1; k <= kroku; k++) {
      const hk = Math.min(h, par.dny - t);
      krokRK4(t, hk);
      t = k === kroku ? par.dny : t + hk;
      let inf = 0; for (let g = 0; g < G; g++) inf += y[g * NK + iI] + y[g * NK + iA];
      if (inf > vrcholI.hodnota) vrcholI = { hodnota: inf, t };
      if (t >= dalsi - 1e-9 || k === kroku) { zapis(t); while (dalsi <= t + 1e-9) dalsi += 1; }
    }
    vys.R0 = spektralniPolomer(maticeDalsichGeneraci(par, st, 0, null, false));
    vys.vrcholInfekcnich = vrcholI;
    vys.souhrn = souhrn(vys);
    return vys;
  }

  function maxS(arr, t) { let m = -Infinity, k = 0; for (let i = 0; i < arr.length; i++) if (arr[i] > m) { m = arr[i]; k = i; } return { hodnota: m, t: t[k] }; }

  function souhrn(v) {
    const c = v.celkem, last = v.t.length - 1, N = v.par.N;
    const dnyNad = (arr, kap) => kap > 0 ? arr.reduce((a, x) => a + (x > kap ? 1 : 0), 0) : 0;
    const vrcholH = maxS(c.H, v.t), vrcholC = maxS(c.C, v.t);
    let denRt = null; for (let i = 0; i < v.Rt.length; i++) if (v.Rt[i] < 1) { denRt = v.t[i]; break; }
    const nakazeni = c.kInf[last] + v.par.I0;
    return {
      N, nakazeni, podilNakazenych: nakazeni / N,
      vrcholI: v.vrcholInfekcnich, vrcholH, vrcholC, maxIncidence: maxS(v.incidence, v.t),
      umrti: c.D[last], hospitalizace: c.kHosp[last], davky: c.kDavky[last],
      dnyNadKapH: dnyNad(c.H, v.par.kapH), dnyNadKapC: dnyNad(c.C, v.par.kapC),
      denRtPod1: denRt, bezi: (c.E[last] + c.A[last] + c.I[last]) > Math.max(0.5, 1e-5 * N),
      zachovani: KOMP.slice(0, 9).reduce((a, k) => a + c[k][last], 0),
      poSkupinach: v.skupiny.map((s, g) => ({
        skupina: v.st.skupiny[g], N: v.st.pop[g],
        nakazeni: s.kInf[last] + v.par.I0 * v.st.pop[g] / N, hosp: s.kHosp[last], umrti: s.D[last], davky: s.kDavky[last]
      }))
    };
  }

  /** CSV výstup (středník, desetinná čárka). */
  function csv(v) {
    const f = x => (Math.round(x * 1000) / 1000).toString().replace('.', ',');
    const r = ['den;S;E;A;I;H;JIP;R;D;V;kumulativne_nakazeni;nove_nakazy_den;prijmy_hosp_den;umrti_den;Rt'];
    const c = v.celkem;
    for (let i = 0; i < v.t.length; i++) r.push([v.t[i], c.S[i], c.E[i], c.A[i], c.I[i], c.H[i], c.C[i], c.R[i], c.D[i], c.V[i], c.kInf[i], v.incidence[i], v.hospPrijmy[i], v.umrtiDen[i], v.Rt[i]].map(f).join(';'));
    return r.join('\n');
  }

  /**
   * Lze konečnou velikost spočítat analyticky? Jen když se parametry v čase nemění: bez slábnutí imunity,
   * sezónnosti, importů a kampaně; zásahy buď žádné, nebo platí po celou dobu od dne 0.
   */
  function analytickaPlatnost(par) {
    if (par.imunitaDny > 0 || par.sezonA > 0 || par.importy > 0 || par.kampanDavky > 0) return false;
    return par.zasahy.every(z => z.od <= 0 && z.do >= par.dny);
  }
  /**
   * Konečná velikost pro skupinový model (SIR/SEIR, bez vymírání imunity):
   *   x_g = s_g0 · (1 − exp(−p · D · Σ_h C_gh x_h)),  x_g = podíl skupiny g nakažený po t = 0,
   * kde s_g0 = počáteční podíl vnímavých, D = [(1−pA)·f_iso + pA·rA]/γ. Pro jednu skupinu: x = s0(1 − e^(−R0 x)).
   * Počáteční nakažení se zanedbávají (i0 → 0). Řeší se iterací z x = s0 (monotónně konverguje k netriviálnímu kořeni).
   */
  function konecnaVelikostSkupin(vstup) {
    const { par, chyby } = over(vstup);
    if (chyby.length) throw new Error(chyby.join(' '));
    const st = priprav(par);
    const C = maticeV(st, nasobitele(par, 0));
    const D = ((1 - par.podilA) * st.fIso + par.podilA * par.rA) / st.gamma;
    const s0 = st.pop.map(() => 1 - par.ockovaniPodil * par.ucinnost);
    let x = s0.slice();
    for (let it = 0; it < 100000; it++) {
      let zmena = 0;
      const nove = x.map((_, g) => {
        let s = 0; for (let h = 0; h < st.G; h++) s += C[g][h] * x[h];
        return s0[g] * (1 - Math.exp(-par.p * D * s));
      });
      for (let g = 0; g < st.G; g++) { zmena = Math.max(zmena, Math.abs(nove[g] - x[g])); x[g] = nove[g]; }
      if (zmena < 1e-13) break;
    }
    const Ntot = st.pop.reduce((a, b) => a + b, 0);
    return { poSkupinach: x, celkem: x.reduce((a, xg, g) => a + xg * st.pop[g], 0) / Ntot };
  }

  const EpiModel = {
    analytickaPlatnost, konecnaVelikostSkupin,
    VYCHOZI, PROSTREDI, NAZVY_PROSTREDI, PRIORITY, KOMP, over, priprav, dataCR8, agregujMatici, symetrizuj, prumerKontaktu, podilyProstredi,
    spektralniPolomer, nasobitele, sezonnost, maticeDalsichGeneraci, R0, davky, derivace, pocatek, simuluj, csv
  };
  if (typeof module !== 'undefined') module.exports = EpiModel; else window.EpiModel = EpiModel;
})();
