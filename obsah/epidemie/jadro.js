/* ============================================================
   epidemie/jadro.js – deterministické kompartmentové modely SIR a SEIR
   (soustava ODR řešená Rungeovou–Kuttovou metodou 4. řádu) a analytické
   vztahy (konečná velikost epidemie, práh stádní imunity, vrchol SIR,
   počáteční růstová rychlost). Čistý modul bez DOM – testuje se v node.

   Značení (vše v počtech osob, N = S + E + I + R + V je konstantní):
     β = c · p          c = kontaktní míra [kontaktů/den], p = pravděpodobnost přenosu při kontaktu
     σ = 1 / inkubace   γ = 1 / infekční období
     R0 = β / γ         (základní reprodukční číslo bez zásahů)
     R_t = R0 · m(t) · f_iso · S / N   (efektivní reprodukční číslo)

   Zásahy:
     m(t)   = 1 − omezení kontaktů v intervalu [od, do), jinak 1
     f_iso  = 1 − q · e^(−γ·d)  … podíl q infekčních se po d dnech izoluje a dál nešíří;
              při exponenciálně rozděleném infekčním období je e^(−γd) střední podíl
              infekční doby, který připadá až na dobu po izolaci (paměťovost exp. rozdělení).
     očkování: na začátku podíl v·e vnímavých → V (pokrytí v, účinnost e, „vše nebo nic“),
              od dne t_v navíc tok S → V rychlostí ν · e · S (ν = podíl zbývajících vnímavých za den).
   ============================================================ */
(function () {
  'use strict';

  const VYCHOZI = {
    model: 'SEIR',        // 'SIR' | 'SEIR'
    N: 10000,
    I0: 10,
    p: 0.05,              // pravděpodobnost přenosu při kontaktu
    c: 10,                // kontaktů za den
    inkubace: 5,          // dní (jen SEIR)
    infekcni: 5,          // dní
    dny: 200,
    krok: 0.1,            // krok RK4 v dnech
    // zásahy
    omezeni: 0,           // 0–1, snížení kontaktů
    omezeniOd: 0,
    omezeniDo: 1e9,
    ockovaniPodil: 0,     // pokrytí na začátku 0–1
    ockovaniTempo: 0,     // podíl zbývajících vnímavých za den
    ockovaniOd: 0,
    ucinnost: 1,          // účinnost vakcíny 0–1
    izolacePodil: 0,      // 0–1
    izolaceZpozdeni: 2    // dní od začátku infekčnosti
  };

  function cislo(v, def) { const x = Number(v); return Number.isFinite(x) ? x : def; }
  function omez(x, a, b) { return Math.min(b, Math.max(a, x)); }

  /** Doplní výchozí hodnoty a ověří parametry. Vrací { par, chyby[] }. */
  function over(vstup) {
    const v = Object.assign({}, VYCHOZI, vstup || {});
    const chyby = [];
    const par = {};
    par.model = v.model === 'SIR' ? 'SIR' : 'SEIR';
    par.N = Math.round(cislo(v.N, NaN));
    if (!(par.N >= 1)) chyby.push('Velikost populace musí být alespoň 1.');
    par.I0 = cislo(v.I0, NaN);
    if (!(par.I0 >= 0)) chyby.push('Počet počátečních nakažených nesmí být záporný.');
    else if (par.I0 > par.N) chyby.push('Počátečních nakažených nemůže být víc než celá populace.');
    par.p = cislo(v.p, NaN);
    if (!(par.p >= 0 && par.p <= 1)) chyby.push('Pravděpodobnost přenosu musí ležet v intervalu 0–1.');
    par.c = cislo(v.c, NaN);
    if (!(par.c >= 0)) chyby.push('Kontaktní míra nesmí být záporná.');
    par.inkubace = cislo(v.inkubace, NaN);
    if (par.model === 'SEIR' && !(par.inkubace > 0)) chyby.push('Délka inkubace musí být kladná.');
    par.infekcni = cislo(v.infekcni, NaN);
    if (!(par.infekcni > 0)) chyby.push('Infekční období musí být kladné.');
    par.dny = cislo(v.dny, NaN);
    if (!(par.dny > 0 && par.dny <= 5000)) chyby.push('Délka simulace musí být 1–5000 dní.');
    par.krok = cislo(v.krok, NaN);
    if (!(par.krok > 0 && par.krok <= 5)) chyby.push('Krok RK4 musí být v intervalu (0; 5] dne.');
    else if (par.dny / par.krok > 2e6) chyby.push('Příliš malý krok vzhledem k délce simulace (víc než 2 miliony kroků).');
    par.omezeni = omez(cislo(v.omezeni, 0), 0, 1);
    par.omezeniOd = Math.max(0, cislo(v.omezeniOd, 0));
    par.omezeniDo = Math.max(par.omezeniOd, cislo(v.omezeniDo, 1e9));
    par.ockovaniPodil = omez(cislo(v.ockovaniPodil, 0), 0, 1);
    par.ockovaniTempo = omez(cislo(v.ockovaniTempo, 0), 0, 1);
    par.ockovaniOd = Math.max(0, cislo(v.ockovaniOd, 0));
    par.ucinnost = omez(cislo(v.ucinnost, 1), 0, 1);
    par.izolacePodil = omez(cislo(v.izolacePodil, 0), 0, 1);
    par.izolaceZpozdeni = Math.max(0, cislo(v.izolaceZpozdeni, 0));
    return { par, chyby };
  }

  /** Odvozené veličiny modelu. */
  function odvozene(par) {
    const beta = par.c * par.p;
    const gamma = 1 / par.infekcni;
    const sigma = par.model === 'SEIR' ? 1 / par.inkubace : Infinity;
    const R0 = beta / gamma;
    const fIso = 1 - par.izolacePodil * Math.exp(-gamma * par.izolaceZpozdeni);
    return { beta, gamma, sigma, R0, fIso, R0iso: R0 * fIso };
  }

  /** Násobitel kontaktů v čase t. */
  function nasobitelKontaktu(par, t) {
    return (t >= par.omezeniOd && t < par.omezeniDo) ? 1 - par.omezeni : 1;
  }

  /** Počáteční stav [S, E, I, R, V, C] (C = kumulativní počet nákaz po t=0). */
  function pocatek(par) {
    const I = par.I0;
    const S0 = par.N - I;
    const V = S0 * par.ockovaniPodil * par.ucinnost;
    return [S0 - V, 0, I, 0, V, 0];
  }

  /** Pravá strana ODR. Vrací derivace [dS, dE, dI, dR, dV, dC]. */
  function derivace(par, od, t, y) {
    const [S, E, I] = y;
    const lambda = od.beta * nasobitelKontaktu(par, t) * od.fIso * I / par.N;
    const infekce = lambda * S;
    const ocko = (t >= par.ockovaniOd ? par.ockovaniTempo * par.ucinnost : 0) * S;
    const dS = -infekce - ocko;
    let dE, dI;
    if (par.model === 'SEIR') {
      dE = infekce - od.sigma * E;
      dI = od.sigma * E - od.gamma * I;
    } else {
      dE = 0;
      dI = infekce - od.gamma * I;
    }
    return [dS, dE, dI, od.gamma * I, ocko, infekce];
  }

  /** Jeden krok RK4. */
  function krokRK4(f, t, y, h) {
    const n = y.length;
    const k1 = f(t, y);
    const y2 = new Array(n), y3 = new Array(n), y4 = new Array(n), out = new Array(n);
    for (let i = 0; i < n; i++) y2[i] = y[i] + h / 2 * k1[i];
    const k2 = f(t + h / 2, y2);
    for (let i = 0; i < n; i++) y3[i] = y[i] + h / 2 * k2[i];
    const k3 = f(t + h / 2, y3);
    for (let i = 0; i < n; i++) y4[i] = y[i] + h * k3[i];
    const k4 = f(t + h, y4);
    for (let i = 0; i < n; i++) out[i] = y[i] + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    return out;
  }

  /**
   * Deterministická simulace. Výstup je vzorkovaný po 1 dni (při kroku > 1 den po kroku).
   * Vrací { par, od, t[], S[], E[], I[], R[], V[], C[], Rt[], incidence[], vrchol, konec }.
   */
  function simuluj(vstup) {
    const { par, chyby } = over(vstup);
    if (chyby.length) throw new Error(chyby.join(' '));
    const od = odvozene(par);
    const f = (t, y) => derivace(par, od, t, y);
    const h = par.krok;
    const kroku = Math.ceil(par.dny / h - 1e-9);
    // vzorkování po celých dnech: zaznamenej, když t překročí další celé číslo
    const vys = { par, od, t: [], S: [], E: [], I: [], R: [], V: [], C: [], Rt: [], incidence: [] };
    let y = pocatek(par);
    let t = 0;
    const zapis = (tt, yy) => {
      vys.t.push(tt);
      vys.S.push(yy[0]); vys.E.push(yy[1]); vys.I.push(yy[2]); vys.R.push(yy[3]); vys.V.push(yy[4]); vys.C.push(yy[5]);
      vys.Rt.push(od.R0 * nasobitelKontaktu(par, tt) * od.fIso * yy[0] / par.N);
      const n = vys.C.length;
      vys.incidence.push(n > 1 ? (yy[5] - vys.C[n - 2]) / (tt - vys.t[n - 2]) : 0);
    };
    zapis(0, y);
    let vrchol = { I: y[2], t: 0 };
    let dalsiZapis = 1;
    for (let k = 1; k <= kroku; k++) {
      const hk = Math.min(h, par.dny - t);
      y = krokRK4(f, t, y, hk);
      t = k === kroku ? par.dny : t + hk;
      if (y[2] > vrchol.I) vrchol = { I: y[2], t };
      if (t >= dalsiZapis - 1e-9 || k === kroku) {
        zapis(t, y);
        while (dalsiZapis <= t + 1e-9) dalsiZapis += 1;
      }
    }
    // vrchol je sledovaný v každém kroku RK4 (ne jen v denních vzorcích)
    vys.vrchol = vrchol;
    const posl = vys.t.length - 1;
    vys.konec = {
      S: vys.S[posl], E: vys.E[posl], I: vys.I[posl], R: vys.R[posl], V: vys.V[posl], C: vys.C[posl],
      N: vys.S[posl] + vys.E[posl] + vys.I[posl] + vys.R[posl] + vys.V[posl]
    };
    // den, kdy R_t poprvé klesne pod 1 (pokud vůbec)
    vys.denRtPod1 = null;
    for (let i = 0; i < vys.Rt.length; i++) if (vys.Rt[i] < 1) { vys.denRtPod1 = vys.t[i]; break; }
    let maxInc = 0, denMaxInc = 0;
    for (let i = 1; i < vys.incidence.length; i++) if (vys.incidence[i] > maxInc) { maxInc = vys.incidence[i]; denMaxInc = vys.t[i]; }
    vys.maxIncidence = { hodnota: maxInc, t: denMaxInc };
    return vys;
  }

  /**
   * Konečná velikost epidemie (podíl populace nakažený od t=0 včetně počátečních):
   * x = s0 + i0 − s0 · exp(−R0 · x). Pro s0 = 1, i0 → 0 klasické z = 1 − exp(−R0 z).
   * Platí pro homogenní míchání a jakékoli rozdělení infekčního období (SIR i SEIR).
   * Vrací 0 pro R0 ≤ 1 a i0 = 0 (netriviální kořen neexistuje).
   */
  function konecnaVelikost(R0, s0 = 1, i0 = 0) {
    if (!(R0 >= 0) || !(s0 >= 0) || !(i0 >= 0)) return NaN;
    if (s0 === 0) return i0;
    const g = x => x - s0 - i0 + s0 * Math.exp(-R0 * x);
    // g(0) = −i0 ≤ 0, g(s0+i0) > 0; hledáme kladný kořen → bisekce + Newton
    let a = i0 > 0 ? 0 : 1e-12, b = s0 + i0;
    if (i0 === 0 && R0 * s0 <= 1) return 0;
    if (g(a) > 0) return 0;
    for (let i = 0; i < 200; i++) {
      const m = (a + b) / 2;
      if (g(m) > 0) b = m; else a = m;
      if (b - a < 1e-15) break;
    }
    return (a + b) / 2;
  }

  /** Práh stádní imunity 1 − 1/R0 (0 pro R0 ≤ 1). */
  function prahStadniImunity(R0) {
    if (!(R0 > 0)) return 0;
    return Math.max(0, 1 - 1 / R0);
  }

  /** Podíl infekčních ve vrcholu SIR (s0 → 1, i0 → 0): 1 − (1 + ln R0)/R0. */
  function vrcholSIR(R0, s0 = 1, i0 = 0) {
    if (R0 * s0 <= 1) return i0;
    return i0 + s0 - (1 + Math.log(R0 * s0)) / R0;
  }

  /** Počáteční exponenciální růstová rychlost r [1/den]. SIR: β − γ; SEIR: (r+σ)(r+γ) = σβ. */
  function rustovaRychlost(model, beta, gamma, sigma) {
    if (model === 'SIR') return beta - gamma;
    const b = sigma + gamma, c = sigma * gamma - sigma * beta;
    return (-b + Math.sqrt(b * b - 4 * c)) / 2;
  }

  /** CSV (středník, desetinná čárka) z výsledku simulace. */
  function csv(vys) {
    const f = x => (Math.round(x * 1000) / 1000).toString().replace('.', ',');
    const r = ['den;S;E;I;R;V;kumulativne_nakazeni;denni_incidence;Rt'];
    for (let i = 0; i < vys.t.length; i++) {
      r.push([f(vys.t[i]), f(vys.S[i]), f(vys.E[i]), f(vys.I[i]), f(vys.R[i]), f(vys.V[i]), f(vys.C[i]), f(vys.incidence[i]), f(vys.Rt[i])].join(';'));
    }
    return r.join('\n');
  }

  const EpiJadro = {
    VYCHOZI, over, odvozene, nasobitelKontaktu, pocatek, derivace, krokRK4, simuluj,
    konecnaVelikost, prahStadniImunity, vrcholSIR, rustovaRychlost, csv
  };
  if (typeof module !== 'undefined') module.exports = EpiJadro; else window.EpiJadro = EpiJadro;
})();
