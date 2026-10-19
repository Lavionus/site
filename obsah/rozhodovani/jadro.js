/* ============================================================
   rozhodovani/jadro.js – výpočetní jádro vícekriteriálního rozhodování.
   Čistý modul bez DOM (testuje se v node: _test/rozhodovani_test.js).

   Značení: X[i][j] – hodnota alternativy i v kritériu j,
            typy[j] ∈ 'max' | 'min' | 'subj' (subjektivní 1–10, chová se jako 'max'),
            w[j]   – váhy (normalizované na součet 1).

   Metody:
     WSM  – vážený součet (Weighted Sum Model) s normalizací
            'minmax'  r = (x − min)/(max − min),        náklad: (max − x)/(max − min)
            'podil'   r = x / max,                       náklad: min / x       (vyžaduje x > 0)
            'vektor'  r = x / √Σx²,                      náklad: 1 − x / √Σx²  (Jahan & Edwards 2015)
     WPM  – vážený součin  S_i = Π (x_ij / max_j)^w_j, náklad (min_j / x_ij)^w_j   (vyžaduje x > 0)
     TOPSIS – Hwang & Yoon (1981): vektorová normalizace, vážení, vzdálenost
            od ideálu a anti-ideálu, C_i = S⁻ / (S⁺ + S⁻)
     PROMETHEE II – Brans & Vincke (1985): čistý tok φ = φ⁺ − φ⁻,
            preferenční funkce 'obvykla' (typ I) nebo 'linearni' (typ III, p = rozpětí kritéria)
   AHP – Saaty (1980): vlastní vektor (mocninná metoda) i geometrický průměr řádků,
         λmax, CI = (λmax − n)/(n − 1), CR = CI / RI, práh 0,1.
   ============================================================ */
(function () {
  'use strict';

  const EPS = 1e-12;

  /* ---------- pomocné ---------- */
  function jeCislo(x) { return typeof x === 'number' && isFinite(x); }

  /** Převede text s desetinnou čárkou / mezerami na číslo; prázdné → null, nesmysl → NaN. */
  function parsujCislo(t) {
    if (t === null || t === undefined) return null;
    if (typeof t === 'number') return isFinite(t) ? t : NaN;
    const s = String(t).trim().replace(/[\s  ]/g, '').replace(',', '.').replace('−', '-');
    if (s === '') return null;
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    return Number(s);
  }

  /** Zobrazení čísla česky (desetinná čárka, mezera jako oddělovač tisíců). */
  function formatCislo(x, des) {
    if (!jeCislo(x)) return '–';
    if (des === undefined) des = 3;
    let s = Math.abs(x).toFixed(des);
    let [cela, zl] = s.split('.');
    cela = cela.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const zn = x < 0 && Number(s) !== 0 ? '−' : '';
    return zn + cela + (zl ? ',' + zl : '');
  }

  /** Váhy na součet 1. Záporné → 0; vše nulové → rovnoměrně. */
  function normalizujVahy(v) {
    const k = v.map(x => (jeCislo(x) && x > 0 ? x : 0));
    const s = k.reduce((a, b) => a + b, 0);
    if (s <= 0) return k.map(() => 1 / (k.length || 1));
    return k.map(x => x / s);
  }

  function prinos(typ) { return typ !== 'min'; }   // 'max' i 'subj' = čím víc, tím líp

  function sloupec(X, j) { return X.map(r => r[j]); }

  /* ---------- kontrola vstupu ---------- */
  /**
   * Zkontroluje matici. Vrací {ok, chyby:[{i,j,text}], kladne:bool (všechny hodnoty > 0)}
   */
  function zkontrolujMatici(X, typy) {
    const chyby = [];
    let kladne = true;
    if (!Array.isArray(X) || !X.length) chyby.push({ i: -1, j: -1, text: 'Chybí alternativy.' });
    if (!Array.isArray(typy) || !typy.length) chyby.push({ i: -1, j: -1, text: 'Chybí kritéria.' });
    if (chyby.length) return { ok: false, chyby, kladne: false };
    X.forEach((r, i) => typy.forEach((t, j) => {
      const x = r[j];
      if (x === null || x === undefined || x === '') chyby.push({ i, j, text: 'Prázdná buňka.' });
      else if (!jeCislo(x)) chyby.push({ i, j, text: 'Není číslo.' });
      else {
        if (t === 'subj' && (x < 1 || x > 10)) chyby.push({ i, j, text: 'Subjektivní hodnocení musí být 1–10.' });
        if (x <= 0) kladne = false;
      }
    }));
    return { ok: chyby.length === 0, chyby, kladne };
  }

  /* ---------- normalizace ---------- */
  const NORMALIZACE = {
    minmax: { nazev: 'min-max (lineární škála 0–1)', kratce: 'min-max' },
    podil: { nazev: 'podíl k maximu (x / max, náklad min / x)', kratce: 'podíl k max.' },
    vektor: { nazev: 'vektorová (x / √Σx²)', kratce: 'vektorová' }
  };

  /**
   * Normalizace matice. Vrací {R} nebo vyhodí Error s českou hláškou.
   * Kritérium, kde mají všechny alternativy stejnou hodnotu, dostane u min-max r = 1
   * (všechny jsou „nejlepší“, kritérium nerozlišuje).
   */
  function normalizuj(X, typy, metoda) {
    const m = X.length, n = typy.length;
    const R = X.map(() => new Array(n).fill(0));
    for (let j = 0; j < n; j++) {
      const s = sloupec(X, j), b = prinos(typy[j]);
      const mn = Math.min(...s), mx = Math.max(...s);
      if (metoda === 'minmax') {
        const d = mx - mn;
        for (let i = 0; i < m; i++) R[i][j] = d <= EPS * Math.max(1, Math.abs(mx)) ? 1 : (b ? (s[i] - mn) / d : (mx - s[i]) / d);
      } else if (metoda === 'podil') {
        if (mn <= 0) throw new Error('Normalizace podílem k maximu vyžaduje kladné hodnoty (kritérium ' + (j + 1) + ').');
        for (let i = 0; i < m; i++) R[i][j] = b ? s[i] / mx : mn / s[i];
      } else if (metoda === 'vektor') {
        if (mn < 0) throw new Error('Vektorová normalizace vyžaduje nezáporné hodnoty (kritérium ' + (j + 1) + ').');
        const nrm = Math.sqrt(s.reduce((a, x) => a + x * x, 0));
        for (let i = 0; i < m; i++) R[i][j] = nrm <= EPS ? (b ? 0 : 1) : (b ? s[i] / nrm : 1 - s[i] / nrm);
      } else throw new Error('Neznámá normalizace: ' + metoda);
    }
    return R;
  }

  /* ---------- metody ---------- */
  function wsm(X, typy, w, norm) {
    const R = normalizuj(X, typy, norm || 'minmax');
    const prispevky = R.map(r => r.map((x, j) => x * w[j]));
    const skore = prispevky.map(r => r.reduce((a, b) => a + b, 0));
    return { skore, R, prispevky };
  }

  function wpm(X, typy, w) {
    const m = X.length, n = typy.length;
    for (let j = 0; j < n; j++) for (let i = 0; i < m; i++)
      if (!(X[i][j] > 0)) throw new Error('Vážený součin vyžaduje kladné hodnoty všech kritérií.');
    const R = normalizuj(X, typy, 'podil');
    // logaritmické příspěvky (záporné nebo 0): ln S_i = Σ w_j ln r_ij
    const logPrispevky = R.map(r => r.map((x, j) => w[j] * Math.log(x)));
    const skore = logPrispevky.map(r => Math.exp(r.reduce((a, b) => a + b, 0)));
    return { skore, R, logPrispevky };
  }

  function topsis(X, typy, w) {
    const m = X.length, n = typy.length;
    const V = X.map(() => new Array(n).fill(0));
    const ideal = new Array(n), anti = new Array(n);
    for (let j = 0; j < n; j++) {
      const s = sloupec(X, j);
      const nrm = Math.sqrt(s.reduce((a, x) => a + x * x, 0));
      for (let i = 0; i < m; i++) V[i][j] = nrm <= EPS ? 0 : w[j] * s[i] / nrm;
      const vs = sloupec(V, j);
      const hi = Math.max(...vs), lo = Math.min(...vs);
      ideal[j] = prinos(typy[j]) ? hi : lo;
      anti[j] = prinos(typy[j]) ? lo : hi;
    }
    const dPlus = V.map(r => Math.sqrt(r.reduce((a, v, j) => a + (v - ideal[j]) ** 2, 0)));
    const dMinus = V.map(r => Math.sqrt(r.reduce((a, v, j) => a + (v - anti[j]) ** 2, 0)));
    const skore = dPlus.map((dp, i) => (dp + dMinus[i] <= EPS ? 0.5 : dMinus[i] / (dp + dMinus[i])));
    return { skore, V, ideal, anti, dPlus, dMinus };
  }

  /**
   * PROMETHEE II. funkce 'obvykla' – P(d) = 1 pro d > 0;
   * 'linearni' – P(d) = min(1, d / p), p = rozpětí kritéria (max − min), q = 0.
   */
  function promethee(X, typy, w, funkce) {
    const m = X.length, n = typy.length;
    const rozpeti = typy.map((t, j) => { const s = sloupec(X, j); return Math.max(...s) - Math.min(...s); });
    const P = (d, j) => {
      if (d <= 0) return 0;
      if (funkce === 'obvykla') return 1;
      return rozpeti[j] <= EPS ? 0 : Math.min(1, d / rozpeti[j]);
    };
    const pi = X.map(() => new Array(m).fill(0));
    for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) {
      if (a === b) continue;
      let s = 0;
      for (let j = 0; j < n; j++) {
        const d = prinos(typy[j]) ? X[a][j] - X[b][j] : X[b][j] - X[a][j];
        s += w[j] * P(d, j);
      }
      pi[a][b] = s;
    }
    const k = m > 1 ? m - 1 : 1;
    const phiPlus = pi.map(r => r.reduce((a, b) => a + b, 0) / k);
    const phiMinus = pi.map((_, a) => pi.reduce((s, r) => s + r[a], 0) / k);
    const skore = phiPlus.map((p, i) => p - phiMinus[i]);
    return { skore, phiPlus, phiMinus, pi };
  }

  /* ---------- hodnotové funkce (MAVT) ---------- */
  /** Po částech lineární hodnotová funkce: body [[x, u], …] seřazené podle x, u ∈ ⟨0, 1⟩, mimo rozsah konstantní. */
  function hodnotaFunkce(body, x) {
    if (!body || !body.length) return NaN;
    if (x <= body[0][0]) return body[0][1];
    for (let k = 1; k < body.length; k++) {
      const [x1, u1] = body[k];
      if (x <= x1) {
        const [x0, u0] = body[k - 1];
        return x1 - x0 <= EPS ? u1 : u0 + (u1 - u0) * (x - x0) / (x1 - x0);
      }
    }
    return body[body.length - 1][1];
  }

  /** Vyčistí body funkce: čísla, u oříznuté do 0–1, seřazené, bez duplicit x. Vrací null, je-li méně než 2 body. */
  function vycistiFunkci(body) {
    if (!Array.isArray(body)) return null;
    const b = body.filter(q => Array.isArray(q) && jeCislo(q[0]) && jeCislo(q[1]))
      .map(q => [q[0], Math.max(0, Math.min(1, q[1]))]).sort((a, c) => a[0] - c[0]);
    const v = [];
    b.forEach(q => { if (!v.length || q[0] - v[v.length - 1][0] > 1e-12) v.push(q); else v[v.length - 1] = q; });
    return v.length >= 2 && v.length <= 12 ? v : null;
  }

  /**
   * Předloha hodnotové funkce pro rozsah lo–hi.
   * druh: 'linearni' | 'saturace' (param = bod nasycení) | 'cil' (param = cílová hodnota) |
   *       'konkavni' (klesající přírůstek užitku) | 'konvexni' (rostoucí přírůstek)
   */
  function predlohaFunkce(druh, lo, hi, typ, param) {
    if (!(hi > lo)) hi = lo + 1;
    const max = typ !== 'min';
    const lin = max ? [[lo, 0], [hi, 1]] : [[lo, 1], [hi, 0]];
    const p = jeCislo(param) ? Math.max(lo, Math.min(hi, param)) : (lo + hi) / 2;
    let b;
    if (druh === 'saturace') b = max ? [[lo, 0], [p, 1], [hi, 1]] : [[lo, 1], [p, 1], [hi, 0]];
    else if (druh === 'cil') b = [[lo, p === lo ? 1 : 0], [p, 1], [hi, p === hi ? 1 : 0]];
    else if (druh === 'konkavni' || druh === 'konvexni') {
      const e = druh === 'konkavni' ? 0.5 : 2;
      b = [0, 0.25, 0.5, 0.75, 1].map(t => {
        const x = lo + t * (hi - lo);
        return [x, max ? Math.pow(t, e) : Math.pow(1 - t, e)];
      });
    } else b = lin;
    return vycistiFunkci(b.map(q => [+q[0].toPrecision(12), +q[1].toFixed(4)]));
  }

  /**
   * MAVT – aditivní model hodnotových funkcí: S_i = Σ w_j u_j(x_ij).
   * funkce[j] = body nebo null (pak lineární min-max podle směru kritéria).
   */
  function mavt(X, typy, w, funkce) {
    funkce = funkce || [];
    const R0 = normalizuj(X, typy, 'minmax');
    const R = X.map((r, i) => r.map((x, j) => (funkce[j] ? hodnotaFunkce(funkce[j], x) : R0[i][j])));
    const prispevky = R.map(r => r.map((x, j) => x * w[j]));
    const skore = prispevky.map(r => r.reduce((a, b) => a + b, 0));
    return { skore, R, prispevky };
  }

  /**
   * VIKOR (Opricovic 1998; Opricovic & Tzeng 2004, EJOR 156).
   * F_ij = (f⁺ − f)/(f⁺ − f⁻), S = Σ w F, R = max w F, Q = v·(S − S⁺)/(S⁻ − S⁺) + (1 − v)·(R − R⁺)/(R⁻ − R⁺).
   * Menší Q je lepší; jako „skóre“ (větší = lepší) vrací 1 − Q.
   * kompromis: podmínky C1 (přijatelná výhoda Q(a2) − Q(a1) ≥ 1/(m − 1)) a C2 (stabilita: a1 nejlepší i podle S nebo R).
   */
  function vikor(X, typy, w, v) {
    v = jeCislo(v) ? Math.max(0, Math.min(1, v)) : 0.5;
    const m = X.length, n = typy.length;
    const F = X.map(() => new Array(n).fill(0));
    for (let j = 0; j < n; j++) {
      const s = sloupec(X, j), b = prinos(typy[j]);
      const fp = b ? Math.max(...s) : Math.min(...s), fm = b ? Math.min(...s) : Math.max(...s);
      const d = fp - fm;
      for (let i = 0; i < m; i++) F[i][j] = Math.abs(d) <= EPS ? 0 : (fp - s[i]) / d;
    }
    const S = F.map(r => r.reduce((a, f, j) => a + w[j] * f, 0));
    const R = F.map(r => Math.max(...r.map((f, j) => w[j] * f)));
    const Sp = Math.min(...S), Sm = Math.max(...S), Rp = Math.min(...R), Rm = Math.max(...R);
    const Q = S.map((x, i) => v * (Sm - Sp <= EPS ? 0 : (x - Sp) / (Sm - Sp)) + (1 - v) * (Rm - Rp <= EPS ? 0 : (R[i] - Rp) / (Rm - Rp)));
    const ser = Q.map((q, i) => i).sort((a, b) => Q[a] - Q[b] || a - b);
    const DQ = m > 1 ? 1 / (m - 1) : 1;
    const a1 = ser[0];
    const C1 = m < 2 || Q[ser[1]] - Q[a1] >= DQ - 1e-12;
    const C2 = S[a1] <= Sp + 1e-12 || R[a1] <= Rp + 1e-12;
    let kompromis;
    if (!C1) kompromis = ser.filter(i => Q[i] - Q[a1] < DQ - 1e-12);
    else if (!C2) kompromis = ser.slice(0, 2);
    else kompromis = [a1];
    return { skore: Q.map(q => 1 - q), F, S, R, Q, v, DQ, C1, C2, kompromis };
  }

  const METODY = [
    { id: 'wsm-minmax', nazev: 'Vážený součet – min-max', kratce: 'WSM min-max' },
    { id: 'wsm-podil', nazev: 'Vážený součet – podíl k maximu', kratce: 'WSM podíl' },
    { id: 'wsm-vektor', nazev: 'Vážený součet – vektorová', kratce: 'WSM vektor' },
    { id: 'wpm', nazev: 'Vážený součin (WPM)', kratce: 'WPM' },
    { id: 'topsis', nazev: 'TOPSIS', kratce: 'TOPSIS' },
    { id: 'promethee', nazev: 'PROMETHEE II', kratce: 'PROMETHEE II' },
    { id: 'vikor', nazev: 'VIKOR (kompromisní řešení)', kratce: 'VIKOR' },
    { id: 'mavt', nazev: 'Hodnotové funkce (MAVT)', kratce: 'MAVT' }
  ];

  /** Spustí metodu podle id. Vrací {skore, ...} nebo vyhodí Error. */
  function spust(id, X, typy, w, volby) {
    volby = volby || {};
    switch (id) {
      case 'wsm-minmax': return wsm(X, typy, w, 'minmax');
      case 'wsm-podil': return wsm(X, typy, w, 'podil');
      case 'wsm-vektor': return wsm(X, typy, w, 'vektor');
      case 'wpm': return wpm(X, typy, w);
      case 'topsis': return topsis(X, typy, w);
      case 'promethee': return promethee(X, typy, w, volby.prometheeFunkce || 'linearni');
      case 'promethee-obvykla': return promethee(X, typy, w, 'obvykla');
      case 'vikor': return vikor(X, typy, w, volby.vikorV);
      case 'mavt': return mavt(X, typy, w, volby.funkce);
      default: throw new Error('Neznámá metoda: ' + id);
    }
  }

  /* ---------- pořadí ---------- */
  /** Soutěžní pořadí (1 = nejlepší, shoda → stejné nejlepší místo, „1, 1, 3“). */
  function poradi(skore, tol) {
    tol = tol === undefined ? 1e-9 : tol;
    return skore.map(s => 1 + skore.filter(t => t > s + tol * Math.max(1, Math.abs(s))).length);
  }
  /** Průměrné pořadí pro korelaci (shoda → průměr míst). */
  function prumernePoradi(skore, tol) {
    tol = tol === undefined ? 1e-9 : tol;
    return skore.map(s => {
      const vyssi = skore.filter(t => t > s + tol * Math.max(1, Math.abs(s))).length;
      const stejne = skore.filter(t => Math.abs(t - s) <= tol * Math.max(1, Math.abs(s))).length;
      return vyssi + (stejne + 1) / 2;
    });
  }
  /** Spearmanův koeficient (Pearson na průměrných pořadích). */
  function spearman(r1, r2) {
    const n = r1.length;
    if (n < 2) return 1;
    const m1 = r1.reduce((a, b) => a + b, 0) / n, m2 = r2.reduce((a, b) => a + b, 0) / n;
    let c = 0, v1 = 0, v2 = 0;
    for (let i = 0; i < n; i++) { c += (r1[i] - m1) * (r2[i] - m2); v1 += (r1[i] - m1) ** 2; v2 += (r2[i] - m2) ** 2; }
    if (v1 <= EPS || v2 <= EPS) return v1 <= EPS && v2 <= EPS ? 1 : 0;
    return c / Math.sqrt(v1 * v2);
  }
  /** Index vítěze (první s maximálním skóre). */
  function vitez(skore) {
    let b = 0;
    for (let i = 1; i < skore.length; i++) if (skore[i] > skore[b] + 1e-12) b = i;
    return b;
  }

  /** Porovná všechny metody. Vrací {metody:[{id, nazev, skore, poradi, chyba}], spearman:[[]]} */
  function porovnejMetody(X, typy, w, volby, ids) {
    const vys = METODY.filter(m => !ids || ids.includes(m.id)).map(m => {
      try {
        const r = spust(m.id, X, typy, w, volby);
        return { id: m.id, nazev: m.nazev, kratce: m.kratce, skore: r.skore, poradi: poradi(r.skore), prum: prumernePoradi(r.skore), chyba: null };
      } catch (e) {
        return { id: m.id, nazev: m.nazev, kratce: m.kratce, skore: null, poradi: null, prum: null, chyba: e.message };
      }
    });
    const sp = vys.map(a => vys.map(b => (a.prum && b.prum ? spearman(a.prum, b.prum) : null)));
    return { metody: vys, spearman: sp };
  }

  /* ---------- citlivost ---------- */
  /** Váhy po změně váhy kritéria j na t (ostatní v původním poměru). */
  function vahyPriZmene(w, j, t) {
    const n = w.length, zb = 1 - w[j];
    return w.map((x, k) => {
      if (k === j) return t;
      if (zb <= 1e-12) return (1 - t) / (n - 1);
      return x * (1 - t) / zb;
    });
  }

  /**
   * Citlivost vítěze na váhu kritéria j.
   * Vrací {j, w0, vitez, od, do, vitezPod, vitezNad, prubeh:[{t, skore}]}
   *   [od, do] – interval váhy kritéria j (ostatní váhy proporcionálně), v němž zůstává vítěz;
   *   vitezPod/vitezNad – kdo vyhraje těsně pod „od“ / nad „do“ (null, je-li mez 0 nebo 1).
   * U vážených součtů je skóre lineární v t, takže meze jsou přesné (bisekce na lineárních funkcích);
   * u ostatních metod jde o souvislý interval kolem současné váhy nalezený vzorkováním + bisekcí.
   */
  function citlivost(metodaId, X, typy, w, j, volby) {
    volby = volby || {};
    const kroky = volby.kroky || 100;
    const n = w.length;
    const sk = t => spust(metodaId, X, typy, vahyPriZmene(w, j, t), volby).skore;
    const w0 = w[j];
    const v0 = vitez(sk(w0));
    const prubeh = [];
    for (let k = 0; k <= kroky; k++) { const t = k / kroky; prubeh.push({ t, skore: sk(t) }); }
    if (n < 2) return { j, w0, vitez: v0, od: 0, do: 1, vitezPod: null, vitezNad: null, prubeh };
    const drzi = t => vitez(sk(t)) === v0;
    const hranice = (vnitrni, vnejsi) => {           // bisekce mezi bodem s vítězem a bez něj
      let a = vnitrni, b = vnejsi;
      for (let k = 0; k < 50; k++) { const c = (a + b) / 2; if (drzi(c)) a = c; else b = c; }
      return { mez: a, venku: b };
    };
    // dolů
    let od = 0, vitezPod = null, posl = w0;
    for (let k = Math.floor(w0 * kroky + 1e-9); k >= 0; k--) {
      const t = Math.min(w0, k / kroky);
      if (!drzi(t)) { const h = hranice(posl, t); od = h.mez; vitezPod = vitez(sk(h.venku)); break; }
      posl = t;
    }
    // nahoru
    let doo = 1, vitezNad = null;
    posl = w0;
    for (let k = Math.ceil(w0 * kroky - 1e-9); k <= kroky; k++) {
      const t = Math.max(w0, k / kroky);
      if (!drzi(t)) { const h = hranice(posl, t); doo = h.mez; vitezNad = vitez(sk(h.venku)); break; }
      posl = t;
    }
    return { j, w0, vitez: v0, od, do: doo, vitezPod, vitezNad, prubeh };
  }

  /** Nejmenší změna váhy (absolutně), při které se změní vítěz; Infinity, pokud se v celém rozsahu 0–1 nezmění. */
  function rezervaCitlivosti(c) {
    return Math.min(c.vitezPod !== null ? c.w0 - c.od : Infinity, c.vitezNad !== null ? c.do - c.w0 : Infinity);
  }

  /* ---------- AHP ---------- */
  /** Saatyho náhodné indexy RI pro n = 1…15 (Saaty 1980, tab. 1.7 / Saaty 1990 EJOR 48). */
  const RI = [0, 0, 0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49, 1.51, 1.48, 1.56, 1.57, 1.59];
  const SAATY = [1 / 9, 1 / 8, 1 / 7, 1 / 6, 1 / 5, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  /** Sestaví reciprokou matici z horního trojúhelníku: horni(i, j) → a_ij pro i < j. */
  function ahpMatice(n, horni) {
    const A = [];
    for (let i = 0; i < n; i++) { A.push(new Array(n).fill(1)); }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = horni(i, j);
      if (!(a > 0) || !isFinite(a)) throw new Error('Párové porovnání musí být kladné číslo.');
      A[i][j] = a; A[j][i] = 1 / a;
    }
    return A;
  }

  function nasob(A, v) { return A.map(r => r.reduce((s, a, k) => s + a * v[k], 0)); }

  /** Hlavní vlastní vektor mocninnou metodou. Vrací {w, lambda, iterace}. */
  function ahpVlastniVektor(A, tol, maxIt) {
    tol = tol || 1e-13; maxIt = maxIt || 10000;
    const n = A.length;
    let w = new Array(n).fill(1 / n);
    let it = 0;
    for (; it < maxIt; it++) {
      const y = nasob(A, w);
      const s = y.reduce((a, b) => a + b, 0);
      const nw = y.map(x => x / s);
      const d = nw.reduce((a, x, k) => Math.max(a, Math.abs(x - w[k])), 0);
      w = nw;
      if (d < tol) break;
    }
    const Aw = nasob(A, w);
    const lambda = Aw.reduce((a, x, k) => a + x / w[k], 0) / n;
    return { w, lambda, iterace: it + 1 };
  }

  /** Geometrický průměr řádků (Crawford & Williams 1985). */
  function ahpGeometricky(A) {
    const n = A.length;
    const g = A.map(r => Math.exp(r.reduce((s, a) => s + Math.log(a), 0) / n));
    const s = g.reduce((a, b) => a + b, 0);
    const w = g.map(x => x / s);
    const Aw = nasob(A, w);
    const lambda = Aw.reduce((a, x, k) => a + x / w[k], 0) / n;
    return { w, lambda };
  }

  /** Konzistence: {n, lambda, CI, RI, CR, konzistentni} (CR = null pro n > 15). */
  function ahpKonzistence(A, lambda) {
    const n = A.length;
    if (lambda === undefined) lambda = ahpVlastniVektor(A).lambda;
    if (n <= 2) return { n, lambda: n, CI: 0, RI: 0, CR: 0, konzistentni: true };
    const CI = Math.max(0, (lambda - n) / (n - 1));
    const ri = n < RI.length ? RI[n] : null;
    const CR = ri ? CI / ri : null;
    return { n, lambda, CI, RI: ri, CR, konzistentni: CR === null ? null : CR <= 0.1 };
  }

  /** Nejméně konzistentní porovnání: max |ln(a_ij · w_j / w_i)|; návrh = nejbližší Saatyho hodnota w_i / w_j. */
  function ahpNejhorsiPar(A, w) {
    const n = A.length;
    let best = null;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const e = Math.abs(Math.log(A[i][j] * w[j] / w[i]));
      if (!best || e > best.odchylka) {
        const cil = w[i] / w[j];
        let navrh = SAATY[0];
        for (const s of SAATY) if (Math.abs(Math.log(s / cil)) < Math.abs(Math.log(navrh / cil))) navrh = s;
        best = { i, j, odchylka: e, aktualni: A[i][j], idealni: cil, navrh };
      }
    }
    return best;
  }

  /** Úplné vyhodnocení AHP. */
  function ahp(A) {
    const ev = ahpVlastniVektor(A);
    const gm = ahpGeometricky(A);
    const k = ahpKonzistence(A, ev.lambda);
    return { vlastni: ev.w, geometricky: gm.w, lambda: ev.lambda, iterace: ev.iterace, CI: k.CI, RI: k.RI, CR: k.CR,
      konzistentni: k.konzistentni, nejhorsi: A.length > 2 ? ahpNejhorsiPar(A, ev.w) : null };
  }

  /** Posuvník −8…+8 → Saatyho hodnota (kladné: levé kritérium důležitější). */
  function posuvnikNaSaaty(p) {
    p = Math.round(p);
    if (p >= 0) return p + 1;
    return 1 / (1 - p);
  }
  function saatyNaPosuvnik(a) {
    if (!(a > 0)) return 0;
    if (a >= 1) return Math.round(a) - 1;
    return 1 - Math.round(1 / a);
  }

  /* ---------- způsoby vážení ---------- */
  /** Rank-order centroid (Barron & Barrett 1996): w_k = (1/n) Σ_{i=k}^{n} 1/i. */
  function rocVahy(n) {
    const w = [];
    for (let k = 1; k <= n; k++) { let s = 0; for (let i = k; i <= n; i++) s += 1 / i; w.push(s / n); }
    return w;
  }
  /** ROC z pořadí kritérií (1 = nejdůležitější). Shodné pořadí → průměr ROC vah obsazených pozic. */
  function rocZPoradi(poradiKrit) {
    const n = poradiKrit.length;
    const roc = rocVahy(n);
    const idx = poradiKrit.map((r, j) => j).sort((a, b) => poradiKrit[a] - poradiKrit[b] || a - b);
    const w = new Array(n).fill(0);
    let pos = 0;
    while (pos < n) {
      let k = pos;
      while (k + 1 < n && poradiKrit[idx[k + 1]] === poradiKrit[idx[pos]]) k++;
      const prum = roc.slice(pos, k + 1).reduce((a, b) => a + b, 0) / (k - pos + 1);
      for (let q = pos; q <= k; q++) w[idx[q]] = prum;
      pos = k + 1;
    }
    return w;
  }

  /** Průměrná pořadí z hodnot (větší hodnota = lepší = pořadí 1). */
  function poradiZHodnot(h) { return prumernePoradi(h, 1e-12); }

  /**
   * Kendallův koeficient shody W (s korekcí na shody). poradi: hodnotitelé × položky (průměrná pořadí).
   * W = 12 S / (m²(n³ − n) − m Σ T), T = Σ (t³ − t) přes skupiny shod u každého hodnotitele.
   */
  function kendallW(poradi) {
    const m = poradi.length;
    if (m < 2) return null;
    const n = poradi[0].length;
    if (n < 2) return null;
    const soucty = new Array(n).fill(0);
    poradi.forEach(r => r.forEach((x, j) => { soucty[j] += x; }));
    const prumer = soucty.reduce((a, b) => a + b, 0) / n;
    const S = soucty.reduce((a, x) => a + (x - prumer) ** 2, 0);
    let T = 0;
    poradi.forEach(r => {
      const pocty = {};
      r.forEach(x => { const k = x.toFixed(6); pocty[k] = (pocty[k] || 0) + 1; });
      Object.values(pocty).forEach(t => { T += t ** 3 - t; });
    });
    const jm = m * m * (n ** 3 - n) - m * T;
    return jm <= EPS ? 1 : 12 * S / jm;
  }

  /** Agregace vah skupiny: 'aritm' (aritmetický průměr) nebo 'geom' (geometrický průměr, znormalizovaný). */
  function agregujVahy(seznam, zpusob) {
    const m = seznam.length;
    if (!m) return [];
    const n = seznam[0].length;
    const w = new Array(n).fill(0);
    if (zpusob === 'geom') {
      for (let j = 0; j < n; j++) w[j] = Math.exp(seznam.reduce((a, v) => a + Math.log(Math.max(v[j], 1e-9)), 0) / m);
    } else for (let j = 0; j < n; j++) w[j] = seznam.reduce((a, v) => a + v[j], 0) / m;
    return normalizujVahy(w);
  }

  const REZIMY_VAH = ['primo', 'body', 'poradi', 'swing', 'ahp', 'skupina'];

  /** Reciproká matice AHP z párů projektu. */
  function ahpMaticeProjektu(P) {
    const k = P.kriteria;
    return ahpMatice(k.length, (i, j) => posuvnikNaSaaty(ctiPar(P.ahp.pary, k[i].id, k[j].id)));
  }

  /** Váhy projektu podle režimu. Vrací {w, ahp?, skupina?} */
  function vahyProjektu(P) {
    const k = P.kriteria, n = k.length;
    const r = P.vahyRezim;
    if (r === 'body') return { w: normalizujVahy(k.map(x => x.body)) };
    if (r === 'poradi') return { w: rocZPoradi(k.map(x => x.poradi)) };
    if (r === 'swing') return { w: normalizujVahy(k.map(x => x.swing)) };
    if (r === 'ahp' && n >= 2) {
      const a = ahp(ahpMaticeProjektu(P));
      return { w: P.ahp.odvozeni === 'geometricky' ? a.geometricky : a.vlastni, ahp: a };
    }
    if (r === 'skupina' && P.skupina.hodnotitele.length) {
      const jednotlive = P.skupina.hodnotitele.map(h => normalizujVahy(k.map(x => h.body[x.id])));
      const w = agregujVahy(jednotlive, P.skupina.agregace);
      const W = kendallW(jednotlive.map(v => poradiZHodnot(v)));
      const rozpeti = k.map((_, j) => [Math.min(...jednotlive.map(v => v[j])), Math.max(...jednotlive.map(v => v[j]))]);
      return { w, skupina: { jednotlive, W, rozpeti } };
    }
    return { w: normalizujVahy(k.map(x => x.vaha)) };
  }

  /* ---------- vyřazovací prahy a dominance ---------- */
  /**
   * Vyřazení alternativ, které nesplní povinný práh (prahMin ≤ x ≤ prahMax).
   * Vrací pole po alternativách: [] = vyhovuje, jinak [{j, text}].
   */
  function eliminace(X, kriteria) {
    return X.map(r => {
      const d = [];
      kriteria.forEach((k, j) => {
        const x = r[j];
        if (!jeCislo(x)) return;
        if (jeCislo(k.prahMin) && x < k.prahMin) d.push({ j, text: `${k.nazev} ${formatCislo(x, 6).replace(/,?0+$/, '')} < ${formatCislo(k.prahMin, 6).replace(/,?0+$/, '')}` });
        if (jeCislo(k.prahMax) && x > k.prahMax) d.push({ j, text: `${k.nazev} ${formatCislo(x, 6).replace(/,?0+$/, '')} > ${formatCislo(k.prahMax, 6).replace(/,?0+$/, '')}` });
      });
      return d;
    });
  }

  /**
   * Paretova dominance. Porovnává preferenční hodnoty: s hodnotovou funkcí u(x), jinak x (u minimalizace −x).
   * Vrací pole po alternativách: indexy alternativ, které ji dominují (alespoň stejně dobré všude, někde lepší).
   */
  function dominance(X, typy, funkce) {
    funkce = funkce || [];
    const V = X.map(r => r.map((x, j) => (funkce[j] ? hodnotaFunkce(funkce[j], x) : prinos(typy[j]) ? x : -x)));
    const tol = (a) => 1e-9 * Math.max(1, Math.abs(a));
    return V.map((a, i) => V.map((b, k) => {
      if (k === i) return -1;
      let lepsi = false;
      for (let j = 0; j < a.length; j++) {
        if (b[j] < a[j] - tol(a[j])) return -1;
        if (b[j] > a[j] + tol(a[j])) lepsi = true;
      }
      return lepsi ? k : -1;
    }).filter(k => k >= 0));
  }

  /* ---------- nejistota: SMAA-2 (Lahdelma & Salminen 2001) ---------- */
  /** Deterministický generátor (mulberry32). */
  function generator(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Rovnoměrně náhodné váhy na simplexu (Dirichlet(1,…,1)). */
  function nahodneVahy(n, rnd) {
    const e = []; for (let j = 0; j < n; j++) e.push(-Math.log(1 - rnd()));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map(x => x / s);
  }

  /**
   * Připraví simulaci SMAA. nastaveni:
   *   metoda, volby (pro spust), w (současné váhy),
   *   vahy: 'uniformni' (bez informace) | 'poradi' (jen pořadí vah zachováno) | 'kolem' (w · U(1 − δ, 1 + δ)),
   *   rozptylVah δ, nejistoty[j] (relativní ± u hodnot), intervaly[i][j] ([lo, hi] | null), typy, seed
   * Vrací {krok(k), vysledek()}.
   */
  function vytvorSmaa(X, nast) {
    const m = X.length, n = nast.typy.length;
    const rnd = generator(nast.seed || 12345);
    const b = X.map(() => new Array(m).fill(0));
    const stredW = X.map(() => new Array(n).fill(0));
    const vyhry = new Array(m).fill(0);
    let platne = 0, neplatne = 0, posledniChyba = null;
    const poradiW = nast.w.map((x, j) => j).sort((a, c) => nast.w[c] - nast.w[a] || a - c);
    const nej = nast.nejistoty || [];
    const intv = nast.intervaly || [];
    function vahy() {
      if (nast.vahy === 'uniformni') return nahodneVahy(n, rnd);
      if (nast.vahy === 'poradi') {
        const u = nahodneVahy(n, rnd).sort((a, c) => c - a);
        const w = new Array(n); poradiW.forEach((j, k) => { w[j] = u[k]; }); return w;
      }
      const d = jeCislo(nast.rozptylVah) ? nast.rozptylVah : 0.2;
      return normalizujVahy(nast.w.map(x => x * (1 + d * (2 * rnd() - 1))));
    }
    function hodnoty() {
      return X.map((r, i) => r.map((x, j) => {
        const iv = intv[i] && intv[i][j];
        let y = x;
        if (iv && jeCislo(iv[0]) && jeCislo(iv[1])) y = iv[0] + (iv[1] - iv[0]) * rnd();
        else if (nej[j] > 0) y = x * (1 + nej[j] * (2 * rnd() - 1));
        if (nast.typy[j] === 'subj') y = Math.max(1, Math.min(10, y));
        return y;
      }));
    }
    return {
      krok(k) {
        for (let q = 0; q < k; q++) {
          const w = vahy(), Y = hodnoty();
          let sk;
          try { sk = spust(nast.metoda, Y, nast.typy, w, nast.volby).skore; } catch (e) { neplatne++; posledniChyba = e.message; continue; }
          const por = poradi(sk);
          por.forEach((r, i) => { b[i][r - 1]++; });
          const v = vitez(sk);
          vyhry[v]++;
          for (let j = 0; j < n; j++) stredW[v][j] += w[j];
          platne++;
        }
        return platne + neplatne;
      },
      vysledek() {
        const N = platne || 1;
        return {
          platne, neplatne, posledniChyba,
          b: b.map(r => r.map(x => x / N)),                       // b[i][r] = podíl simulací, kdy je i na místě r+1
          centralniVahy: stredW.map((r, i) => (vyhry[i] ? r.map(x => x / vyhry[i]) : null)),
          ocekavanePoradi: b.map(r => r.reduce((a, x, k) => a + x * (k + 1), 0) / N)
        };
      }
    };
  }
  function smaa(X, nast, iterace) {
    const s = vytvorSmaa(X, nast);
    s.krok(iterace || 2000);
    return s.vysledek();
  }

  /* ---------- slovní vysvětlení ---------- */
  /**
   * Proč vyhrála alternativa: aditivní rozklad rozdílu skóre vítěze a druhého (u WSM/MAVT přesný,
   * u ostatních metod přibližný – rozklad podle váženého součtu min-max).
   */
  function vysvetli(X, typy, w, nazvyAlt, nazvyKrit, metodaId, volby, doplnky) {
    volby = volby || {}; doplnky = doplnky || {};
    const m = X.length;
    if (m < 2) return null;
    const hl = spust(metodaId, X, typy, w, volby);
    const por = poradi(hl.skore);
    const ser = hl.skore.map((s, i) => i).sort((a, b) => por[a] - por[b] || a - b);
    const v = ser[0], d = ser[1];
    let rozklad, presny = true, nazevRozkladu;
    if (metodaId === 'mavt') { rozklad = mavt(X, typy, w, volby.funkce); nazevRozkladu = 'hodnotových funkcí'; }
    else if (metodaId.startsWith('wsm-')) { rozklad = wsm(X, typy, w, metodaId.slice(4)); nazevRozkladu = 'váženého součtu'; }
    else { rozklad = wsm(X, typy, w, 'minmax'); presny = false; nazevRozkladu = 'váženého součtu (min-max)'; }
    const rozdily = w.map((_, j) => ({ j, d: rozklad.prispevky[v][j] - rozklad.prispevky[d][j] }));
    const plus = rozdily.filter(x => x.d > 0.005).sort((a, b) => b.d - a.d);
    const minus = rozdily.filter(x => x.d < -0.005).sort((a, b) => a.d - b.d);
    const f = x => formatCislo(x, 3);
    const vety = [];
    const shoda = por[d] === por[v];
    vety.push(shoda
      ? `${nazvyAlt[v]} a ${nazvyAlt[d]} mají stejné skóre (${f(hl.skore[v])}) – model mezi nimi nerozhodne.`
      : `Nejlépe vychází ${nazvyAlt[v]} (skóre ${f(hl.skore[v])}), druhá je ${nazvyAlt[d]} (${f(hl.skore[d])}).`);
    if (plus.length) vety.push(`Oproti ní ${nazvyAlt[v]} získává hlavně v kritériích ${plus.slice(0, 3).map(x => `${nazvyKrit[x.j]} (+${f(x.d)})`).join(', ')}.`);
    if (minus.length) vety.push(`Ztrácí naopak v ${minus.slice(0, 3).map(x => `${nazvyKrit[x.j]} (${f(x.d)})`).join(', ')}${plus.length ? ', ale zisky převáží' : ''}.`);
    if (!presny) vety.push(`(Rozdíly po kritériích jsou orientační – rozklad podle ${nazevRozkladu}, zvolená metoda ${metodaId === 'topsis' ? 'TOPSIS' : metodaId === 'vikor' ? 'VIKOR' : metodaId === 'wpm' ? 'WPM' : 'PROMETHEE II'} není aditivní.)`);
    const dom = dominance(X, typy, volby.funkce);
    const dominovane = dom.map((x, i) => (x.length ? i : -1)).filter(i => i >= 0);
    if (dom[v].length === 0 && dominovane.length) vety.push(`Alternativy ${dominovane.map(i => nazvyAlt[i]).join(', ')} jsou dominované – jiná alternativa je stejně dobrá nebo lepší ve všech kritériích, takže by neměly vyhrát při žádných vahách.`);
    if (doplnky.citlivost && doplnky.citlivost.length) {
      const rez = doplnky.citlivost.map(c => ({ j: c.j, r: rezervaCitlivosti(c) })).sort((a, b) => a.r - b.r)[0];
      if (!isFinite(rez.r)) vety.push('Výsledek je vůči vahám velmi odolný: změnou kterékoli jedné váhy (při zachování poměru ostatních) se vítěz nezmění.');
      else vety.push(rez.r < 0.05
        ? `Pozor: stačí změnit váhu kritéria ${nazvyKrit[rez.j]} o ${formatCislo(rez.r * 100, 1)} procentního bodu a vyhraje jiná alternativa.`
        : `Výsledek je vůči vahám odolný: vítěz se nezmění, dokud se žádná váha nezmění aspoň o ${formatCislo(rez.r * 100, 1)} p. b. (nejcitlivější je ${nazvyKrit[rez.j]}).`);
    }
    if (doplnky.smaa) {
      const p1 = doplnky.smaa.b[v][0];
      vety.push(`Při zadané nejistotě vah a hodnot vychází ${nazvyAlt[v]} první v ${formatCislo(p1 * 100, 0)} % simulací.`);
    }
    return { vitez: v, druhy: d, plus, minus, presny, text: vety.join(' ') };
  }

  /* ---------- sdílený odkaz ---------- */
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function base64url(bajty) {
    let s = '';
    for (let i = 0; i < bajty.length; i += 3) {
      const a = bajty[i], b = bajty[i + 1], c = bajty[i + 2];
      const x = (a << 16) | ((b || 0) << 8) | (c || 0);
      s += B64[(x >> 18) & 63] + B64[(x >> 12) & 63] + (b === undefined ? '' : B64[(x >> 6) & 63]) + (c === undefined ? '' : B64[x & 63]);
    }
    return s;
  }
  function zBase64url(t) {
    if (!/^[A-Za-z0-9_-]*$/.test(t) || t.length % 4 === 1) throw new Error('Odkaz je poškozený.');
    const out = [];
    for (let i = 0; i < t.length; i += 4) {
      const c = [0, 1, 2, 3].map(k => (i + k < t.length ? B64.indexOf(t[i + k]) : -1));
      const x = (c[0] << 18) | (c[1] << 12) | ((c[2] < 0 ? 0 : c[2]) << 6) | (c[3] < 0 ? 0 : c[3]);
      out.push((x >> 16) & 255);
      if (c[2] >= 0) out.push((x >> 8) & 255);
      if (c[3] >= 0) out.push(x & 255);
    }
    return Uint8Array.from(out);
  }

  /** Text buňky: číslo nebo interval „a–b“ (pomlčka, spojovník, „..“). Vrací {hodnota, interval} | {chyba}. */
  function parsujHodnotu(t) {
    const s = String(t === null || t === undefined ? '' : t).trim();
    if (s === '') return { hodnota: null, interval: null };
    const c = '[-−+]?[\\d\\s ]*[.,]?\\d+(?:e[-+]?\\d+)?';
    const m = s.match(new RegExp('^(' + c + ')\\s*(?:–|—|\\.\\.|-|\\s-\\s)\\s*(' + c + ')$', 'i'));
    if (m) {
      const a = parsujCislo(m[1]), b = parsujCislo(m[2]);
      if (jeCislo(a) && jeCislo(b)) {
        const lo = Math.min(a, b), hi = Math.max(a, b);
        return { hodnota: (lo + hi) / 2, interval: lo === hi ? null : [lo, hi] };
      }
    }
    const x = parsujCislo(s);
    return jeCislo(x) ? { hodnota: x, interval: null } : { chyba: true, hodnota: NaN, interval: null };
  }

  /* ---------- projekt ---------- */
  function noveId() { return 'k' + Math.random().toString(36).slice(2, 9); }

  /** Kontrola a doplnění importovaného projektu. Vyhodí Error s českou hláškou. */
  function overProjekt(p) {
    if (!p || typeof p !== 'object') throw new Error('Soubor neobsahuje projekt.');
    if (!Array.isArray(p.kriteria) || !Array.isArray(p.alternativy)) throw new Error('Projekt musí mít seznam kritérií a alternativ.');
    if (p.kriteria.length > 30 || p.alternativy.length > 60) throw new Error('Projekt je příliš velký (max. 30 kritérií a 60 alternativ).');
    const cislo = (x, lo, hi, vych) => (jeCislo(x) && x >= lo && x <= hi ? x : vych);
    const kriteria = p.kriteria.map((k, j) => ({
      id: typeof k.id === 'string' && k.id ? k.id.slice(0, 40) : noveId(),
      nazev: String(k.nazev || 'Kritérium').slice(0, 80),
      typ: ['max', 'min', 'subj'].includes(k.typ) ? k.typ : 'max',
      jednotka: String(k.jednotka || '').slice(0, 20),
      vaha: cislo(k.vaha, 0, 100, 50),
      body: cislo(k.body, 0, 1000, jeCislo(k.vaha) ? Math.round(cislo(k.vaha, 0, 100, 50)) : 10),
      poradi: Math.round(cislo(k.poradi, 1, 30, j + 1)),
      swing: cislo(k.swing, 0, 100, 50),
      funkce: vycistiFunkci(k.funkce),
      prahMin: jeCislo(k.prahMin) ? k.prahMin : null,
      prahMax: jeCislo(k.prahMax) ? k.prahMax : null,
      nejistota: cislo(k.nejistota, 0, 1, 0)
    }));
    const ids = new Set();
    kriteria.forEach(k => { while (ids.has(k.id)) k.id = noveId(); ids.add(k.id); });
    const alternativy = p.alternativy.map(a => ({
      nazev: String((a && a.nazev) || 'Alternativa').slice(0, 80),
      hodnoty: kriteria.map((_, j) => {
        const v = a && Array.isArray(a.hodnoty) ? a.hodnoty[j] : null;
        return jeCislo(v) ? v : null;
      }),
      intervaly: kriteria.map((_, j) => {
        const v = a && Array.isArray(a.intervaly) ? a.intervaly[j] : null;
        return Array.isArray(v) && jeCislo(v[0]) && jeCislo(v[1]) && v[0] < v[1] ? [v[0], v[1]] : null;
      })
    }));
    // hodnota buňky s intervalem je vždy jeho střed (deterministický výpočet), interval slouží simulaci nejistoty
    alternativy.forEach(a => a.intervaly.forEach((iv, j) => { if (iv) a.hodnoty[j] = (iv[0] + iv[1]) / 2; }));
    const skupinaVstup = p.skupina && Array.isArray(p.skupina.hodnotitele) ? p.skupina.hodnotitele.slice(0, 20) : [];
    const hodnotitele = skupinaVstup.map((h, q) => {
      const body = {};
      kriteria.forEach(k => { const x = h && h.body ? h.body[k.id] : null; body[k.id] = cislo(x, 0, 100, 50); });
      return { nazev: String((h && h.nazev) || 'Hodnotitel ' + (q + 1)).slice(0, 60), body };
    });
    const sm = p.smaa || {};
    const ahpPary = {};
    if (p.ahp && p.ahp.pary && typeof p.ahp.pary === 'object')
      for (const [k, v] of Object.entries(p.ahp.pary)) if (jeCislo(v) && v >= -8 && v <= 8) ahpPary[k] = Math.round(v);
    return {
      verze: 2,
      nazev: String(p.nazev || 'Bez názvu').slice(0, 120),
      poznamka: String(p.poznamka || '').slice(0, 2000),
      kriteria, alternativy,
      vahyRezim: REZIMY_VAH.includes(p.vahyRezim) ? p.vahyRezim : 'primo',
      ahp: { pary: ahpPary, odvozeni: p.ahp && p.ahp.odvozeni === 'geometricky' ? 'geometricky' : 'vlastni' },
      metoda: METODY.some(m => m.id === p.metoda) ? p.metoda : 'wsm-minmax',
      prefFunkce: p.prefFunkce === 'obvykla' ? 'obvykla' : 'linearni',
      vikorV: cislo(p.vikorV, 0, 1, 0.5),
      skupina: { hodnotitele, agregace: p.skupina && p.skupina.agregace === 'geom' ? 'geom' : 'aritm' },
      smaa: { vahy: ['uniformni', 'poradi', 'kolem'].includes(sm.vahy) ? sm.vahy : 'kolem', rozptylVah: cislo(sm.rozptylVah, 0, 1, 0.2),
        iterace: Math.round(cislo(sm.iterace, 100, 50000, 4000)) }
    };
  }

  /** Klíč páru kritérií pro AHP (nezávislý na pořadí, hodnota je vždy „první vůči druhému“ v uloženém směru). */
  function klicPar(idA, idB) { return idA + '|' + idB; }
  /** Hodnota posuvníku pro (A, B) z uložených párů (případně obráceně). */
  function ctiPar(pary, idA, idB) {
    const k1 = klicPar(idA, idB), k2 = klicPar(idB, idA);
    if (k1 in pary) return pary[k1];
    if (k2 in pary) return -pary[k2];
    return 0;
  }

  /* ---------- export CSV ---------- */
  function csvPole(x) {
    const s = x === null || x === undefined ? '' : String(x);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csvCislo(x, des) {
    if (!jeCislo(x)) return '';
    return (des === undefined ? String(+x.toFixed(6)) : x.toFixed(des)).replace('.', ',');
  }
  /** CSV pro český Excel (středník, desetinná čárka, BOM přidá volající). */
  function vytvorCsv(projekt, w, porovnani, vybrana) {
    const radky = [];
    const R = a => radky.push(a.map(csvPole).join(';'));
    R(['Projekt', projekt.nazev]);
    R([]);
    R(['Kritérium', 'Typ', 'Jednotka', 'Váha']);
    const typText = { max: 'maximalizovat', min: 'minimalizovat', subj: 'subjektivní 1–10' };
    projekt.kriteria.forEach((k, j) => R([k.nazev, typText[k.typ], k.jednotka, csvCislo(w[j], 4)]));
    R([]);
    R(['Alternativa'].concat(projekt.kriteria.map(k => k.nazev + (k.jednotka ? ' [' + k.jednotka + ']' : ''))));
    projekt.alternativy.forEach(a => R([a.nazev].concat(a.hodnoty.map(v => csvCislo(v)))));
    R([]);
    if (porovnani) {
      R(['Alternativa'].concat(porovnani.metody.flatMap(m => [m.kratce + ' skóre', m.kratce + ' pořadí'])));
      projekt.alternativy.forEach((a, i) => R([a.nazev].concat(porovnani.metody.flatMap(m =>
        m.skore ? [csvCislo(m.skore[i], 4), m.poradi[i]] : ['nelze', '']))));
      R([]);
      R(['Vybraná metoda', vybrana || '']);
    }
    return radky.join('\r\n') + '\r\n';
  }

  const API = {
    EPS, NORMALIZACE, METODY, RI, SAATY,
    parsujCislo, formatCislo, normalizujVahy, zkontrolujMatici,
    normalizuj, wsm, wpm, topsis, promethee, spust,
    poradi, prumernePoradi, spearman, vitez, porovnejMetody,
    vahyPriZmene, citlivost, rezervaCitlivosti,
    ahpMatice, ahpVlastniVektor, ahpGeometricky, ahpKonzistence, ahpNejhorsiPar, ahp,
    posuvnikNaSaaty, saatyNaPosuvnik, klicPar, ctiPar,
    noveId, overProjekt, vytvorCsv,
    hodnotaFunkce, vycistiFunkci, predlohaFunkce, mavt, vikor,
    rocVahy, rocZPoradi, kendallW, agregujVahy, REZIMY_VAH, ahpMaticeProjektu, vahyProjektu,
    eliminace, dominance, generator, nahodneVahy, vytvorSmaa, smaa, vysvetli,
    base64url, zBase64url, parsujHodnotu
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.Rozhodovani = API;
})();
