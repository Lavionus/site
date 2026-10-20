/* ============================================================
   Dřevo – pohyb, průhyb, povrchy · JÁDRO (čisté funkce, bez DOM)
   Jednotky: délky mm, síly N, napětí a moduly MPa (= N/mm²), vlhkost dřeva v % (MC),
   relativní vlhkost vzduchu v % (RH), teplota °C, hmotnost kg, objem m³.
   Export: window.DVJ i module.exports (node testy).
   ============================================================ */
(function (koren) {
  'use strict';
  const G = 9.81;
  const FSP = 28; // bod nasycení vláken (fiber saturation point), typicky 25–30 %

  /* ---------------- pomocné ---------------- */
  const omez = (x, a, b) => Math.min(b, Math.max(a, x));
  const cislo = (x, z) => { const v = typeof x === 'number' ? x : parseFloat(String(x).replace(',', '.')); return Number.isFinite(v) ? v : (z === undefined ? 0 : z); };
  function fmt(x, des, jednotka) {
    if (!Number.isFinite(x)) return '–';
    des = des === undefined ? 1 : des;
    const s = x.toLocaleString('cs-CZ', { minimumFractionDigits: des, maximumFractionDigits: des }).replace(/ /g, ' ');
    return jednotka ? s + ' ' + jednotka : s;
  }

  /* ============================================================
     1. VLHKOST A POHYB DŘEVA
     ============================================================ */

  /** Rovnovážná vlhkost dřeva (EMC, %) – Hailwood–Horrobin, Wood Handbook 2010, rov. 4-5 (SI tvar).
   *  t = teplota °C, rh = relativní vlhkost vzduchu v % (0–100). */
  function emc(t, rh) {
    const h = omez(cislo(rh) / 100, 0, 0.995), T = cislo(t);
    const W = 349 + 1.29 * T + 0.0135 * T * T;
    const K = 0.805 + 0.000736 * T - 0.00000273 * T * T;
    const K1 = 6.27 - 0.00938 * T - 0.000303 * T * T;
    const K2 = 1.91 + 0.0407 * T - 0.000293 * T * T;
    const kh = K * h;
    return (1800 / W) * (kh / (1 - kh) + (K1 * kh + 2 * K1 * K2 * kh * kh) / (1 + K1 * kh + K1 * K2 * kh * kh));
  }

  /** Inverzní úloha: jakou RH (%) při teplotě t dává cílovou EMC (bisekce). */
  function rhProEmc(t, mc) {
    let a = 0, b = 99.5;
    if (mc <= 0) return 0;
    if (emc(t, b) < mc) return NaN;
    for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (emc(t, m) < mc) a = m; else b = m; }
    return (a + b) / 2;
  }

  /** Tlak nasycené vodní páry (Pa) – Magnusova rovnice (Alduchov & Eskridge). */
  const tlakSyt = (t) => 610.94 * Math.exp(17.625 * t / (t + 243.04));

  /** RH v interiéru z venkovního vzduchu: stejný obsah páry + vnitřní produkce vlhkosti dp (Pa),
   *  vnitřní teplota tIn. Vrátí % (omezeno na 100). Model podle EN ISO 13788 (třídy vlhkosti). */
  function rhInterieru(tOut, rhOut, tIn, dp) {
    const pv = tlakSyt(tOut) * rhOut / 100 + (dp || 0);
    return omez(100 * pv / tlakSyt(tIn), 1, 100);
  }

  /** Koeficient rozměrové změny ve směru šířky desky podle úhlu letokruhů vůči ploše.
   *  uhel 0° = tangenciální řez (letokruhy rovnoběžně s plochou), 90° = radiální (zrcadlový řez).
   *  Transformace tenzoru: C(θ) = C_T cos²θ + C_R sin²θ. */
  function koefUhel(ct, cr, uhelSt) {
    const u = uhelSt * Math.PI / 180, c = Math.cos(u), s = Math.sin(u);
    return ct * c * c + cr * s * s;
  }

  /** Účinný koeficient pro šířku desky z polohy v kmeni: deska šířky w, střed desky posunut o x0
   *  od svislice dření, plocha desky ve vzdálenosti y0 od dřeně (mm). Letokruh v bodě x svírá
   *  s plochou úhel atan(|x|/y0). Integrace přes šířku (Simpson). Vrací { c, uhelStred, uhelOkraj }. */
  function koefZKmene(ct, cr, w, x0, y0) {
    y0 = Math.max(0.1, Math.abs(y0));
    const n = 200, h = w / n;
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const x = x0 - w / 2 + i * h, u = Math.atan(Math.abs(x) / y0) * 180 / Math.PI;
      const k = i === 0 || i === n ? 1 : (i % 2 ? 4 : 2);
      s += k * koefUhel(ct, cr, u);
    }
    const uhly = [x0 - w / 2, x0 + w / 2].map((x) => Math.atan(Math.abs(x) / y0) * 180 / Math.PI);
    return { c: s * h / 3 / w, uhelStred: Math.atan(Math.abs(x0) / y0) * 180 / Math.PI, uhelMin: Math.abs(x0) < w / 2 ? 0 : Math.min(...uhly), uhelMax: Math.max(...uhly) };
  }

  /** Změna rozměru (mm): ΔD = D · C · (MC2 − MC1), vlhkosti omezeny na 0…FSP (nad FSP se nemění). */
  function zmenaRozmeru(d, c, mc1, mc2, fsp) {
    const f = fsp || FSP;
    return d * c * (omez(mc2, 0, f) - omez(mc1, 0, f));
  }

  /** Výplň (panel) v rámu s drážkou. p = { svetlost, hloubkaDrazky, c, mcVyroba, mcMin, mcMax, rezerva, minZasunuti }
   *  světlost = viditelný otvor rámu napříč vlákny výplně. Vrací doporučenou šířku výplně a kontroly. */
  function vyplnRamu(p) {
    const g = p.hloubkaDrazky, rez = p.rezerva === undefined ? 0.5 : p.rezerva;
    const plna = p.svetlost + 2 * g; // od dna ke dnu drážky
    // iterace – roztažení počítáme z vlastní šířky výplně
    let w = plna;
    for (let i = 0; i < 6; i++) {
      const roz = Math.max(0, zmenaRozmeru(w, p.c, p.mcVyroba, p.mcMax));
      w = plna - roz - 2 * rez;
    }
    const roztazeni = Math.max(0, zmenaRozmeru(w, p.c, p.mcVyroba, p.mcMax));
    const smrsteni = Math.max(0, -zmenaRozmeru(w, p.c, p.mcVyroba, p.mcMin));
    const mezeraStrana = (plna - w) / 2; // mezera ke dnu drážky na každé straně při výrobě
    const zasunutiMin = g - mezeraStrana - smrsteni / 2; // výplň vystředěná, v nejsušším stavu
    const minZas = p.minZasunuti === undefined ? 4 : p.minZasunuti;
    const pas = smrsteni / 2; // pruh, který se v zimě odkryje u každé hrany (nenamořený!)
    return {
      sirkaVyplne: w, plna, roztazeni, smrsteni, mezeraStrana, zasunutiMin, pas,
      ok: zasunutiMin >= minZas && mezeraStrana >= roztazeni / 2,
      doporucenaDrazka: Math.ceil(mezeraStrana + smrsteni / 2 + minZas),
    };
  }

  /** Masivní deska stolu: celkový pohyb a podélné otvory pro spojovací prvky.
   *  p = { sirka, c, mcVyroba, mcMin, mcMax, pevnyBod: 'stred'|'zadni', polohy:[mm od zadní hrany], prumerSroubu, rezerva } */
  function deskaStolu(p) {
    const w = p.sirka, rez = p.rezerva === undefined ? 1 : p.rezerva;
    const celkem = zmenaRozmeru(w, p.c, p.mcMin, p.mcMax);
    const nahoru = Math.max(0, zmenaRozmeru(1, p.c, p.mcVyroba, p.mcMax)); // na 1 mm vzdálenosti
    const dolu = Math.max(0, -zmenaRozmeru(1, p.c, p.mcVyroba, p.mcMin));
    const pevny = p.pevnyBod === 'zadni' ? 0 : w / 2;
    const prvky = (p.polohy || []).map((x) => {
      const r = x - pevny, ar = Math.abs(r);
      const ven = ar * nahoru, dovnitr = ar * dolu; // posun od pevného bodu / k pevnému bodu
      const delkaOtvoru = (p.prumerSroubu || 4.5) + ven + dovnitr + 2 * rez;
      return { x, odPevneho: r, ven, dovnitr, delkaOtvoru, posunOtvoru: (ven - dovnitr) / 2 * Math.sign(r || 1) };
    });
    const dist = Math.max(pevny, w - pevny); // nejvzdálenější hrana od pevného bodu
    return { celkem, roztazeni: w * nahoru, smrsteni: w * dolu, pevny, prvky, hranaVen: dist * nahoru, hranaDovnitr: dist * dolu,
      // knoflík (button) na podélných lubech: vůle ke dnu drážky ≥ posun hrany ven, zasunutí ≥ posun dovnitř + 5 mm
      knofVuleDno: dist * nahoru + rez, knofZasunuti: dist * dolu + 5 };
  }

  /** Palubky / obklad: mezera mezi palubkami a u stěny. p = { kryci, pocet, c, mcMontaz, mcMax, mcMin } */
  function palubky(p) {
    const e1 = Math.max(0, zmenaRozmeru(p.kryci, p.c, p.mcMontaz, p.mcMax));
    const s1 = Math.max(0, -zmenaRozmeru(p.kryci, p.c, p.mcMontaz, p.mcMin));
    return { mezeraPalubka: e1, smrsteniPalubka: s1, celkemRoztazeni: e1 * p.pocet, celkemSmrsteni: s1 * p.pocet, sirkaPlochy: p.kryci * p.pocet,
      // pero se nesmí vysunout: hloubka zasunutí pera musí být > smrštění
      peroMin: s1 + 2 };
  }

  /** Roční průběh: klima {t[12], rh[12]} → EMC po měsících a vlhkost dřeva se zpožděním.
   *  tau = časová konstanta dřeva ve dnech (tenká deska ~5–10 d, 25 mm ~20–40 d, s lakem víc).
   *  Denní interpolace (kosinová mezi středy měsíců), 3 roky náběhu do ustáleného stavu. */
  function rocniPrubeh(klima, tau) {
    const emcM = klima.t.map((t, i) => emc(t, klima.rh[i]));
    const dny = 365, stredy = [];
    const delky = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let acc = 0;
    for (const d of delky) { stredy.push(acc + d / 2); acc += d; }
    const denni = new Array(dny);
    for (let d = 0; d < dny; d++) {
      let i = 0;
      while (i < 11 && d + 0.5 >= stredy[i + 1]) i++;
      let a, b, da, db;
      if (d + 0.5 < stredy[0]) { a = 11; b = 0; da = stredy[11] - 365; db = stredy[0]; }
      else if (i === 11) { a = 11; b = 0; da = stredy[11]; db = stredy[0] + 365; }
      else { a = i; b = i + 1; da = stredy[i]; db = stredy[i + 1]; }
      const u = (d + 0.5 - da) / (db - da), k = (1 - Math.cos(Math.PI * u)) / 2;
      denni[d] = emcM[a] * (1 - k) + emcM[b] * k;
    }
    const drevo = new Array(dny);
    let mc = denni[0];
    const T = Math.max(0.01, tau || 0);
    const a = tau > 0 ? 1 - Math.exp(-1 / T) : 1;
    for (let r = 0; r < 4; r++) for (let d = 0; d < dny; d++) { mc += a * (denni[d] - mc); if (r === 3) drevo[d] = mc; }
    const min = (v) => Math.min(...v), max = (v) => Math.max(...v);
    const mesDrevo = [];
    acc = 0;
    for (const dl of delky) { let s = 0; for (let d = acc; d < acc + dl; d++) s += drevo[d]; mesDrevo.push(s / dl); acc += dl; }
    return { emcM, denni, drevo, mesDrevo, min: min(drevo), max: max(drevo), emcMin: min(emcM), emcMax: max(emcM), prumer: drevo.reduce((s, v) => s + v, 0) / dny };
  }

  /** Měsíční průměry z hodinových dat Open-Meteo (časy ISO, t °C, rh %). EMC se počítá hodinově a průměruje. */
  function mesicniZHodin(casy, t, rh) {
    const s = Array.from({ length: 12 }, () => ({ t: 0, rh: 0, e: 0, n: 0 }));
    for (let i = 0; i < casy.length; i++) {
      if (t[i] == null || rh[i] == null) continue;
      const m = parseInt(String(casy[i]).slice(5, 7), 10) - 1;
      if (!(m >= 0 && m < 12)) continue;
      const q = s[m]; q.t += t[i]; q.rh += rh[i]; q.e += emc(t[i], rh[i]); q.n++;
    }
    return { t: s.map((q) => q.n ? q.t / q.n : NaN), rh: s.map((q) => q.n ? q.rh / q.n : NaN), emc: s.map((q) => q.n ? q.e / q.n : NaN), n: s.map((q) => q.n) };
  }

  /** Interiér odvozený z venkovního klimatu: vytápění na tTopeni, v létě tIn = max(tTopeni, tOut + dtLeto). */
  function klimaInterieru(venku, tTopeni, dp, dtLeto) {
    const t = venku.t.map((to) => Math.max(tTopeni, to + (dtLeto === undefined ? 3 : dtLeto)));
    return { t, rh: venku.t.map((to, i) => rhInterieru(to, venku.rh[i], t[i], dp)) };
  }

  /* ============================================================
     2. PRŮHYB POLIC – složený průřez + MKP nosníku (Euler–Bernoulli)
     ============================================================ */

  /** Složený průřez z obdélníků { b (šířka, vodorovně), h (výška), y (spodní hrana), E }.
   *  Vrací ohybovou tuhost EI (N·mm²), polohu neutrální osy, E·A a vzdálenosti krajních vláken. */
  function slozenyPrurez(casti) {
    let EA = 0, EAy = 0;
    for (const c of casti) { const A = c.b * c.h; EA += c.E * A; EAy += c.E * A * (c.y + c.h / 2); }
    const yn = EAy / EA;
    let EI = 0;
    for (const c of casti) { const A = c.b * c.h, d = c.y + c.h / 2 - yn; EI += c.E * (c.b * c.h ** 3 / 12 + A * d * d); }
    const yMin = Math.min(...casti.map((c) => c.y)), yMax = Math.max(...casti.map((c) => c.y + c.h));
    return { EI, yn, EA, yMin, yMax, plocha: casti.reduce((s, c) => s + c.b * c.h, 0) };
  }

  /** Analytické vzorce prostého nosníku (pro kontrolu a testy). */
  const pruhybRovnomerny = (q, L, EI) => 5 * q * L ** 4 / (384 * EI);
  const pruhybSila = (P, L, EI) => P * L ** 3 / (48 * EI);

  /** Banded řešič symetrické pozitivně definitní soustavy (bez pivotace), šířka pásu bw (horní). */
  function resPas(A, b, n, bw) {
    // A: plná matice uložená po řádcích jako Float64Array n*n – kvůli jednoduchosti, pracujeme jen v pásu
    for (let k = 0; k < n; k++) {
      const akk = A[k * n + k];
      if (Math.abs(akk) < 1e-30) throw new Error('Soustava je singulární – nosník není dostatečně podepřen.');
      const kon = Math.min(n - 1, k + bw);
      for (let i = k + 1; i <= kon; i++) {
        const f = A[i * n + k] / akk;
        if (f === 0) continue;
        for (let j = k; j <= kon; j++) A[i * n + j] -= f * A[k * n + j];
        b[i] -= f * b[k];
      }
    }
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      const kon = Math.min(n - 1, i + bw);
      for (let j = i + 1; j <= kon; j++) s -= A[i * n + j] * x[j];
      x[i] = s / A[i * n + i];
    }
    return x;
  }

  /** Nosník (police) MKP. p = { L, EI, q (N/mm, rovnoměrné po celé délce), sily:[{x, P (N)}],
   *  podpory:[{x, vetknuti:bool}], prvku } → { x[], w[] (mm, kladně dolů), M[] (N·mm), reakce[], wMax, xMax } */
  function nosnik(p) {
    const L = p.L, EI = p.EI;
    const N = p.prvku || 200;
    const body = new Set();
    for (let i = 0; i <= N; i++) body.add(+(L * i / N).toFixed(6));
    for (const s of p.podpory || []) body.add(+omez(s.x, 0, L).toFixed(6));
    for (const s of p.sily || []) body.add(+omez(s.x, 0, L).toFixed(6));
    const x = [...body].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 1e-6);
    const nn = x.length, n = 2 * nn;
    const K = new Float64Array(n * n), F = new Float64Array(n);
    for (let e = 0; e < nn - 1; e++) {
      const l = x[e + 1] - x[e], k = EI / l ** 3;
      const ke = [12, 6 * l, -12, 6 * l, 6 * l, 4 * l * l, -6 * l, 2 * l * l, -12, -6 * l, 12, -6 * l, 6 * l, 2 * l * l, -6 * l, 4 * l * l];
      const id = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) K[id[i] * n + id[j]] += k * ke[i * 4 + j];
      const q = p.q || 0;
      F[id[0]] += q * l / 2; F[id[1]] += q * l * l / 12; F[id[2]] += q * l / 2; F[id[3]] -= q * l * l / 12;
    }
    const najdi = (xx) => { let b = 0, d = Infinity; for (let i = 0; i < nn; i++) { const v = Math.abs(x[i] - xx); if (v < d) { d = v; b = i; } } return b; };
    for (const s of p.sily || []) F[2 * najdi(s.x)] += s.P;
    const K0 = K.slice(), F0 = F.slice();
    const vazby = [];
    for (const s of p.podpory || []) { const i = najdi(s.x); vazby.push(2 * i); if (s.vetknuti) vazby.push(2 * i + 1); }
    const pevne = [...new Set(vazby)];
    if (!pevne.length) throw new Error('Chybí podpory.');
    for (const d of pevne) {
      for (let j = 0; j < n; j++) { K[d * n + j] = 0; K[j * n + d] = 0; }
      K[d * n + d] = 1; F[d] = 0;
    }
    // kontrola stability: aspoň 2 podpory nebo 1 vetknutí
    const nPodpor = new Set((p.podpory || []).map((s) => najdi(s.x))).size;
    if (nPodpor < 2 && !(p.podpory || []).some((s) => s.vetknuti)) throw new Error('Police potřebuje aspoň 2 podpory (nebo vetknutí).');
    const u = resPas(K, F, n, 3);
    const w = [], th = [];
    for (let i = 0; i < nn; i++) { w.push(u[2 * i]); th.push(u[2 * i + 1]); }
    // reakce R = K0·u − F0 v podporových stupních volnosti
    const reakce = [];
    for (const s of p.podpory || []) {
      const i = najdi(s.x), d = 2 * i;
      let r = -F0[d];
      for (let j = Math.max(0, d - 3); j <= Math.min(n - 1, d + 3); j++) r += K0[d * n + j] * u[j];
      reakce.push({ x: x[i], R: -r });
    }
    // momenty v uzlech – průměr z křivosti sousedních prvků (Hermite, 2. derivace)
    const M = new Array(nn).fill(0), cnt = new Array(nn).fill(0);
    for (let e = 0; e < nn - 1; e++) {
      const l = x[e + 1] - x[e];
      const w1 = w[e], t1 = th[e], w2 = w[e + 1], t2 = th[e + 1];
      // w'' v ξ=0 a ξ=1
      const k0 = (-6 * w1 - 4 * l * t1 + 6 * w2 - 2 * l * t2) / (l * l);
      const k1 = (6 * w1 + 2 * l * t1 - 6 * w2 + 4 * l * t2) / (l * l);
      M[e] += -EI * k0; cnt[e]++; M[e + 1] += -EI * k1; cnt[e + 1]++;
    }
    for (let i = 0; i < nn; i++) M[i] = cnt[i] ? M[i] / cnt[i] : 0;
    // w kladné ve směru zatížení (dolů); M = −EI·w'' je kladný při tahu dole (prostý nosník)
    let wMax = 0, xMax = 0;
    for (let i = 0; i < nn; i++) if (Math.abs(w[i]) > Math.abs(wMax)) { wMax = w[i]; xMax = x[i]; }
    let Mmax = 0; for (const m of M) if (Math.abs(m) > Math.abs(Mmax)) Mmax = m;
    return { x, w, th, M, reakce, wMax, xMax, Mmax };
  }

  /** Úseky mezi podporami a převislé konce – maximální průhyb v každém a poměr L/δ. */
  function useky(vysl, podpory, L) {
    const xs = [...new Set(podpory.map((s) => omez(s.x, 0, L)))].sort((a, b) => a - b);
    const hr = [0, ...xs, L].filter((v, i, a) => i === 0 || v - a[i - 1] > 1e-6);
    const out = [];
    for (let i = 0; i < hr.length - 1; i++) {
      const a = hr[i], b = hr[i + 1];
      const konzola = (i === 0 && xs[0] > 1e-6) || (i === hr.length - 2 && xs[xs.length - 1] < L - 1e-6);
      let m = 0, xm = a;
      for (let j = 0; j < vysl.x.length; j++) if (vysl.x[j] >= a - 1e-9 && vysl.x[j] <= b + 1e-9 && Math.abs(vysl.w[j]) > Math.abs(m)) { m = vysl.w[j]; xm = vysl.x[j]; }
      const delka = b - a, ucinna = konzola ? 2 * delka : delka; // konzola – limit z dvojnásobku vyložení
      out.push({ a, b, delka, konzola, wMax: m, xMax: xm, pomer: Math.abs(m) > 1e-12 ? ucinna / Math.abs(m) : Infinity });
    }
    return out;
  }

  /** Celý výpočet police. p = {
   *   delka, hloubka, tloustka, E, rho, kdef, fm,
   *   lista: { b, h, E, rho, poloha:'horni'|'dolni'|'stred' } | null, (přední lišta, nalepená)
   *   zadni: { b, h, E, rho, poloha } | null,
   *   kgm (užitné zatížení kg/m), bodKg, bodX, vlastniTiha:bool, dotvarovani:bool,
   *   podpory: [{x, vetknuti}], limit (např. 300) } */
  function police(p) {
    const casti = [{ b: p.hloubka, h: p.tloustka, y: 0, E: p.E, nazev: 'deska', rho: p.rho, fm: p.fm }];
    const pridej = (l, nazev) => {
      if (!l || !(l.b > 0) || !(l.h > 0)) return;
      const y = l.poloha === 'dolni' ? 0 : l.poloha === 'stred' ? (p.tloustka - l.h) / 2 : p.tloustka - l.h;
      casti.push({ b: l.b, h: l.h, y, E: l.E || p.E, nazev, rho: l.rho || p.rho, fm: l.fm || p.fm });
    };
    pridej(p.lista, 'přední lišta'); pridej(p.zadni, 'zadní lišta');
    const pr = slozenyPrurez(casti);
    const prurezDesky = slozenyPrurez([casti[0]]);
    const qUzitne = (p.kgm || 0) * G / 1000; // N/mm
    const hmotnostPolice = casti.reduce((s, c) => s + c.b * c.h * 1e-9 * c.rho, 0) * p.delka; // kg (b·h mm² · L mm)
    const qVlastni = p.vlastniTiha ? hmotnostPolice * G / p.delka : 0;
    const q = qUzitne + qVlastni;
    const sily = p.bodKg > 0 ? [{ x: p.bodX, P: p.bodKg * G }] : [];
    const vysl = nosnik({ L: p.delka, EI: pr.EI, q, sily, podpory: p.podpory, prvku: p.prvku });
    const kd = p.dotvarovani ? 1 + (p.kdef || 0) : 1;
    const dlouho = { w: vysl.w.map((v) => v * kd), wMax: vysl.wMax * kd };
    const us = useky({ x: vysl.x, w: dlouho.w }, p.podpory, p.delka);
    const limit = p.limit || 300;
    const nejhorsi = us.reduce((a, b) => (b.pomer < a.pomer ? b : a), us[0]);
    // napětí v krajních vláknech každé části
    const napeti = casti.map((c) => {
      const dz = Math.max(Math.abs(c.y + c.h - pr.yn), Math.abs(c.y - pr.yn));
      const s = Math.abs(vysl.Mmax) * c.E * dz / pr.EI;
      return { nazev: c.nazev, sigma: s, fm: c.fm, vyuziti: c.fm ? s / c.fm : NaN };
    });
    // přípustné užitné zatížení (lineární úloha – škálování)
    let kgmMax = NaN;
    if (qUzitne > 0) {
      // úloha je lineární: průhyb = užitné·f + (vlastní tíha + bodová síla) → největší f, kdy platí limit
      const vU = nosnik({ L: p.delka, EI: pr.EI, q: qUzitne, sily: [], podpory: p.podpory, prvku: p.prvku });
      const vV = nosnik({ L: p.delka, EI: pr.EI, q: qVlastni, sily, podpory: p.podpory, prvku: p.prvku });
      const usU = useky({ x: vU.x, w: vU.w.map((v) => v * kd) }, p.podpory, p.delka);
      const usV = useky({ x: vV.x, w: vV.w.map((v) => v * kd) }, p.podpory, p.delka);
      let f = Infinity;
      usU.forEach((u, i) => {
        const dovol = (u.konzola ? 2 * u.delka : u.delka) / limit;
        const ost = Math.abs(usV[i].wMax);
        if (Math.abs(u.wMax) > 1e-12) f = Math.min(f, (dovol - ost) / Math.abs(u.wMax));
      });
      kgmMax = Math.max(0, f * p.kgm);
    }
    return {
      casti, prurez: pr, EIdesky: prurezDesky.EI, zesileni: pr.EI / prurezDesky.EI, q, qUzitne, qVlastni, hmotnostPolice,
      okamzite: vysl, dlouhodobe: dlouho, kd, useky: us, nejhorsi, limit, vyhovuje: nejhorsi.pomer >= limit,
      napeti, kgmMax, zatizeniCelkemKg: (p.kgm || 0) * p.delka / 1000 + (p.bodKg || 0),
    };
  }

  /** Rozmístění podpor: 'konce' | 'n' (rovnoměrně n podpor) | 'vlastni' (pole). odsazeni = od okraje (mm). */
  function rozmistiPodpory(L, typ, n, odsazeni, vlastni, vetknuti) {
    let xs;
    if (typ === 'vlastni') xs = (vlastni || []).map(Number).filter(Number.isFinite);
    else {
      const k = typ === 'konce' ? 2 : Math.max(2, Math.round(n || 2));
      const a = omez(odsazeni || 0, 0, L / 2), b = L - a;
      xs = Array.from({ length: k }, (_, i) => a + (b - a) * i / (k - 1));
    }
    return xs.map((x, i) => ({ x: omez(x, 0, L), vetknuti: !!vetknuti && (i === 0 || i === xs.length - 1) }));
  }

  /* ============================================================
     3. POVRCHOVÉ ÚPRAVY
     ============================================================ */

  /** Plocha dílu z kusovníku (m²). d = { delka, sirka, tloustka, ks, plochy:'vse'|'obe_hrany'|'obe'|'lic_hrany'|'lic' } */
  function plochaDilu(d) {
    const L = cislo(d.delka), W = cislo(d.sirka), T = cislo(d.tloustka), ks = Math.max(0, cislo(d.ks, 1));
    const plocha = L * W, hranyDelka = 2 * L * T, hranyCela = 2 * W * T;
    let a;
    switch (d.plochy) {
      case 'lic': a = plocha; break;
      case 'obe': a = 2 * plocha; break;
      case 'lic_hrany': a = plocha + hranyDelka + hranyCela; break;
      case 'obe_hrany': a = 2 * plocha + hranyDelka; break; // bez čel
      default: a = 2 * plocha + hranyDelka + hranyCela;
    }
    return a * ks / 1e6;
  }

  /** Spotřeba nátěrové hmoty (l). p = { plocha m², vrstvy, vydatnost m²/l, prvni (násobek 1. vrstvy), metoda (násobek), rezerva % } */
  function spotreba(p) {
    const vrstvy = Math.max(0, Math.round(p.vrstvy));
    const ekv = vrstvy > 0 ? (p.prvni || 1) + (vrstvy - 1) : 0; // ekvivalentní počet vrstev
    const cista = p.plocha * ekv / p.vydatnost;
    const celkem = cista * (p.metoda || 1) * (1 + (p.rezerva || 0) / 100);
    return { cista, celkem, naVrstvu: p.plocha / p.vydatnost * (p.metoda || 1), ekv, gNaM2: 1000 / p.vydatnost };
  }

  /** Nejlepší kombinace balení (l) pro požadované množství: minimum přebytku, při shodě méně kusů. */
  function baleni(potreba, velikosti, ceny) {
    const v = (velikosti || []).filter((x) => x > 0).sort((a, b) => b - a);
    if (!v.length || !(potreba > 0)) return { kusy: [], objem: 0, prebytek: 0, cena: 0 };
    const krok = 0.005; // 5 ml
    const cil = Math.ceil(potreba / krok - 1e-9), maxV = Math.round(v[0] / krok);
    const lim = cil + maxV;
    const nejl = new Array(lim + 1).fill(null);
    nejl[0] = { n: 0, c: 0, z: null, i: -1 };
    const vi = v.map((x) => Math.round(x / krok));
    for (let s = 0; s <= lim; s++) {
      if (!nejl[s]) continue;
      for (let i = 0; i < vi.length; i++) {
        const t = s + vi[i]; if (t > lim) continue;
        const c = nejl[s].c + (ceny && ceny[i] != null ? ceny[i] : 0);
        const kand = { n: nejl[s].n + 1, c, z: s, i };
        const o = nejl[t];
        const lepsi = !o || (ceny ? (c < o.c - 1e-9 || (Math.abs(c - o.c) < 1e-9 && kand.n < o.n)) : kand.n < o.n);
        if (lepsi) nejl[t] = kand;
      }
    }
    let best = -1;
    if (ceny) { let bc = Infinity; for (let s = cil; s <= lim; s++) if (nejl[s] && nejl[s].c < bc - 1e-9) { bc = nejl[s].c; best = s; } }
    else for (let s = cil; s <= lim; s++) if (nejl[s]) { best = s; break; }
    const kusy = {};
    for (let s = best; s > 0; s = nejl[s].z) { const x = v[nejl[s].i]; kusy[x] = (kusy[x] || 0) + 1; }
    const seznam = Object.keys(kusy).map(Number).sort((a, b) => b - a).map((x) => ({ objem: x, ks: kusy[x] }));
    return { kusy: seznam, objem: best * krok, prebytek: best * krok - potreba, cena: nejl[best].c };
  }

  /** Plán prací po dnech. system = [{ nazev, vrstvy, schnuti h, zrno, priprava, voda, setrit, vytvrzeni d, rychlost m²/h }],
   *  o = { plocha, start: hodina (desetinně), zacatek, konec (pracovní okno), zvednoutVlakno: bool } → kroky [{den, od, do, akce, typ}] */
  function planPraci(system, o) {
    const kroky = [];
    const den0 = 0, zac = o.zacatek === undefined ? 8 : o.zacatek, kon = o.konec === undefined ? 18 : o.konec;
    let t = (o.start === undefined ? zac : o.start); // hodiny od půlnoci dne 0
    const doOkna = (cas, trvani) => {
      // posune začátek práce do pracovního okna tak, aby se vešla (krátké úkony)
      let d = Math.floor(cas / 24), h = cas - d * 24;
      if (h < zac) h = zac;
      if (h + Math.min(trvani, kon - zac) > kon + 1e-9) { d++; h = zac; }
      return d * 24 + h;
    };
    const prace = (akce, trvani, typ) => {
      t = doOkna(t, trvani);
      kroky.push({ od: t, do: t + trvani, akce, typ });
      t += trvani;
    };
    const cekej = (h, akce) => { if (h > 0) { kroky.push({ od: t, do: t + h, akce, typ: 'schnuti' }); t += h; } };
    const plocha = Math.max(0.01, o.plocha || 1);
    const brus = (zr) => Math.max(0.25, plocha / 2.5) * (zr ? 1 : 1); // h, orientačně 2,5 m²/h na zrnitost
    const prvni = system[0];
    if (prvni) {
      const kon = parseInt(String(prvni.priprava || 'P180').replace(/\D/g, ''), 10) || 180;
      const rada = [80, 100, 120, 150, 180, 220, 240].filter((z) => z <= kon && z >= 120);
      if (!rada.length) rada.push(kon);
      prace('Broušení ' + rada.map((z) => 'P' + z).join(' → ') + ' (vždy po směru vláken, nepřeskakovat víc než 1 stupeň)', brus(true) * rada.length * 0.6, 'prace');
      prace('Odprášení (vysavač, prachovka), kontrola světlem z boku', 0.25, 'prace');
      if (system.some((s) => s.voda) && o.zvednoutVlakno !== false) {
        prace('Zvednutí vlákna: přetřít vlhkou houbou', 0.25 + plocha / 15, 'prace');
        cekej(2, 'Schnutí po navlhčení');
        prace('Přebroušení zvednutého vlákna ' + 'P' + kon + ' / P' + Math.min(320, kon + 40) + ', odprášit', brus(true) * 0.5 + 0.2, 'prace');
      }
    }
    system.forEach((s, si) => {
      const vr = Math.max(1, Math.round(s.vrstvy || 1));
      for (let i = 1; i <= vr; i++) {
        const nan = Math.max(0.2, plocha / (s.rychlost || 6));
        prace(`${s.nazev}: ${i}. vrstva` + (s.setrit ? ` – po ${s.setrit} min setřít přebytek` : ''), nan + (s.setrit ? s.setrit / 60 : 0), 'naneseni');
        const posledni = i === vr && si === system.length - 1;
        cekej(s.schnuti || 0, `Schnutí (${s.schnuti} h, při 20 °C a 50–65 % RH)`);
        const zr = String(s.zrno || '');
        if (!posledni && i < vr && !zr.startsWith('—')) prace(`Mezibroušení ${zr}, odprášit`, Math.max(0.25, brus(true) * 0.4), 'prace');
        if (i === vr && s.vytvrzeni > 0 && posledni) kroky.push({ od: t, do: t + s.vytvrzeni * 24, akce: `Vytvrzení – plné zatížení až po ${s.vytvrzeni} dnech (opatrně používat dřív)`, typ: 'vytvrzeni' });
      }
    });
    for (const k of kroky) { k.den = Math.floor(k.od / 24) + 1 - den0; }
    const konecPraci = kroky.length ? Math.max(...kroky.filter((k) => k.typ !== 'vytvrzeni').map((k) => k.do)) : 0;
    const konecVse = kroky.length ? Math.max(...kroky.map((k) => k.do)) : 0;
    return { kroky, dnuPraci: Math.ceil(konecPraci / 24 - 1e-9), dnuCelkem: Math.ceil(konecVse / 24 - 1e-9), konecPraci, konecVse };
  }
  /** Hodina (desetinně, od začátku dne 1) → 'den 2, 14:30' */
  function casText(h) {
    const d = Math.floor(h / 24), m = Math.round((h - d * 24) * 60);
    const hh = Math.floor(m / 60) % 24, mm = m % 60;
    return { den: d + 1, cas: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') };
  }

  /* ============================================================
     4. OBJEM, HMOTNOST, VLHKOST
     ============================================================ */

  /** Objem řeziva (m³) z rozměrů v mm. */
  const objemRezivo = (L, W, T, ks) => cislo(L) * cislo(W) * cislo(T) * Math.max(0, cislo(ks, 1)) / 1e9;
  /** Kulatina – Huberův vzorec (plm): střední průměr bez kůry d (cm), délka L (m). */
  const objemHuber = (dCm, Lm) => Math.PI / 4 * (dCm / 100) ** 2 * Lm;
  /** Kulatina – Smalianův vzorec (plm): průměry obou čel d1, d2 (cm). */
  const objemSmalian = (d1, d2, Lm) => Math.PI / 8 * ((d1 / 100) ** 2 + (d2 / 100) ** 2) * Lm;

  /** Hustota při vlhkosti mc (kg/m³) z hustoty při 12 %: hmotnost sušiny konstantní, objem se mění
   *  objemovým koeficientem cv ≈ C_T + C_R (na 1 %) do FSP. */
  function hustotaPriVlhkosti(rho12, mc, cv, fsp) {
    const f = fsp || FSP;
    const m0 = rho12 / 1.12; // sušina v 1 m³ objemu při 12 %
    const objem = 1 + (cv || 0) * (omez(mc, 0, f) - 12);
    return m0 * (1 + mc / 100) / objem;
  }
  /** Hmotnost po vysušení: m2 = m1 (1 + MC2) / (1 + MC1). */
  const hmotnostPoSuseni = (m1, mc1, mc2) => m1 * (1 + mc2 / 100) / (1 + mc1 / 100);
  /** Vlhkost dřeva vážením (sušárenská metoda): MC = (m − m0) / m0 · 100. */
  const vlhkostVazenim = (m, m0) => (m - m0) / m0 * 100;
  /** Relativní vlhkost (na mokrou hmotnost) → absolutní (na sušinu, MC) a zpět. */
  const relNaAbs = (w) => w / (100 - w) * 100;
  const absNaRel = (u) => u / (100 + u) * 100;

  /** Řezný seznam – souhrn. polozky [{ L, W, T, ks, rho12, cena }], o = { odpad %, mc, cv } */
  function souhrnReziva(polozky, o) {
    const odpad = (o && o.odpad) || 0, mcS = o && Number.isFinite(o.mc) ? o.mc : 12;
    let V = 0, m = 0, cena = 0;
    const radky = polozky.map((p) => {
      const v = objemRezivo(p.L, p.W, p.T, p.ks), vB = v * (1 + odpad / 100);
      const rho = hustotaPriVlhkosti(cislo(p.rho12, 500), mcS, p.cv || 0);
      // rozměry platí při 12 %: sušina kusů je stálá, hmotnost = sušina · (1 + MC)
      const r = { v, vBrutto: vB, hmotnost: v * cislo(p.rho12, 500) / 1.12 * (1 + mcS / 100), cena: vB * cislo(p.cena, 0), rho };
      V += v; m += r.hmotnost; cena += r.cena;
      return r;
    });
    return { radky, objem: V, objemBrutto: V * (1 + odpad / 100), hmotnost: m, cena };
  }

  const J = {
    G, FSP, omez, cislo, fmt,
    emc, rhProEmc, tlakSyt, rhInterieru, koefUhel, koefZKmene, zmenaRozmeru, vyplnRamu, deskaStolu, palubky, rocniPrubeh, mesicniZHodin, klimaInterieru,
    slozenyPrurez, pruhybRovnomerny, pruhybSila, nosnik, useky, police, rozmistiPodpory,
    plochaDilu, spotreba, baleni, planPraci, casText,
    objemRezivo, objemHuber, objemSmalian, hustotaPriVlhkosti, hmotnostPoSuseni, vlhkostVazenim, relNaAbs, absNaRel, souhrnReziva,
  };
  koren.DVJ = J;
  if (typeof module !== 'undefined' && module.exports) module.exports = J;
})(typeof window !== 'undefined' ? window : globalThis);
