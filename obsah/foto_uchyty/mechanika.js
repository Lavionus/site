/* Foto a kamerové úchyty – mechanika (bez DOM, jde require v node).
   Momenty od tíhy kamery a dílů v každém spoji (× dynamický součinitel: kolo, motorka, vibrace), únosnost spojů
   třením a ohybové napětí ramen. Hrubé inženýrské odhady – tištěný plast teče (creep), šrouby povolí;
   výsledek ukazuje řád a nejslabší místo, ne zaručenou nosnost.
   Vzorce:
   - předpětí šroubu F = T / (K · d), K = 0,2 (suchý závit)
   - prsty: třecí moment M = μ · F · n · r_ef, n = 4 třecí plochy (3 + 2 prsty), r_ef = 2/3 · (R³ − r³) / (R² − r²)
   - kulový kloub: M = μ · 2F · R_koule (dvě čelisti objímky)
   - otočný kloub: zuby 45° – vysmeknutí M = F · r_s · tan(45° + arctg μ)
   - závit: proti povolení zhruba 0,8 × utahovací moment; ohyb šroubu σ = M / (π d₃³ / 32)
   - objímka: pásová objímka M = μ · 2π F · R · 0,5 (tuhý tištěný kroužek nedosedne celý)
   - magnety: překlopení M = Σ F · 0,5 (plast mezi magnetem a ocelí) · rameno ≈ 0,5 R desky
   - kostky: využití = F_odtržení / (n·F₁) + Mx / (n·F₁·ny·r/2) + My / (n·F₁·nx·r/2), F₁ = síla výstupku (typicky 1–3 N)
   - rameno: σ = Mx / (a · b² / 6) + My / (b · a² / 6) v čele A; napříč vrstvami pevnost × 0,5 */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const K = uzel ? require('./jadro.js') : window.FOTU;
  const g = 9.81, KS = 0.2;

  const krizem = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const delka = a => Math.hypot(a[0], a[1], a[2]);

  /** Únosnosti spojů (N·mm). */
  function unosnosti(p) {
    const mat = K.MATERIALY[p.tisk.material], mu = mat.mu, q = p.prsty;
    const F5 = p.mech.utahM5 / (KS * K.M5.d / 1000);                 // N
    const r = q.dira / 2, R = q.R, ref = 2 / 3 * (R ** 3 - r ** 3) / (R * R - r * r);
    return {
      F5, ref, mu,
      prsty: mu * F5 * 4 * ref,
      zavit: 0.8 * p.mech.utahZavit * 1000,
      koule: Rk => mu * 2 * F5 * Rk,
      otocny: rs => F5 * rs * Math.tan(Math.PI / 4 + Math.atan(mu)),
      objimka: Rt => mu * 2 * Math.PI * F5 * Rt * 0.5,
    };
  }

  /** Rozbor sestavy: {hmotnost, radky: [{nazev, typ, M, Mcap, vyuziti, pozn, i}], ramena: [...], nejhorsi}. */
  function rozbor(p, model) {
    const mat = K.MATERIALY[p.tisk.material], U = unosnosti(p), dyn = p.mech.dyn;
    // hmoty: díly (plné, g) a zařízení
    const hmoty = [];
    for (const c of model.clanky) for (const d of c.casti) hmoty.push({ i: d.clanek, cast: d.cast, m: d.objem / 1000 * mat.hustota, r: d.tezSvet });
    if (model.zarizeni) hmoty.push({ i: model.zarizeni.clanek, cast: 0, m: model.zarizeni.hmotnost, r: model.zarizeni.tezSvet });
    const hmotnost = hmoty.reduce((s, h) => s + h.m, 0);
    const moment = (P, vyber) => {
      let M = [0, 0, 0];
      for (const h of hmoty) if (vyber(h)) {
        const d = [h.r[0] - P[0], h.r[1] - P[1], h.r[2] - P[2]], F = [0, 0, -h.m / 1000 * g * dyn];
        const x = krizem(d, F); M = [M[0] + x[0], M[1] + x[1], M[2] + x[2]];
      }
      return M;
    };
    const radky = [];
    const pridej = (i, nazev, typ, M, Mcap, pozn) => radky.push({ i, nazev, typ, M, Mcap, vyuziti: Mcap > 0 ? M / Mcap : null, pozn });
    // základna
    const c0 = p.clanky[0], o0 = model.O[0];
    if (c0 && c0.druh === 'objimka') {
      const W = model.W[0], osa = K.mat.smer(W, [1, 0, 0]), M = moment(K.mat.bod(W, [0, 0, 0]), () => true);
      pridej(0, '1. objímka na trubce', 'objimka', Math.abs(dot(M, osa)), U.objimka(o0.Rt), 'protočení kolem trubky');
    }
    if (c0 && c0.druh === 'magnet') {
      const W = model.W[0], M = moment(K.mat.bod(W, [0, 0, 0]), () => true), n = K.mat.smer(W, [0, 0, 1]);
      const Mpr = delka(krizem(n, krizem(M, n)));   // složka kolmá na normálu desky = překlopení
      pridej(0, '1. magnetická patka', 'magnet', Mpr, c0.pocet * c0.sila * 0.5 * o0.Rp * 0.5, 'překlopení přes okraj (síla magnetu přes 1,2 mm plastu ≈ ½)');
    }
    // začátek řetězu nasazený na kupované kostky: spoj se „světem“ v čele A prvního článku (osa Z čela míří do kostek → pro výpočet otočit)
    const spoje = model.spoje.slice();
    if (c0 && (c0.a === 'kv' || c0.a === 'kd') && o0.Fa) {
      const Fs = K.mat.mul(model.W[0], o0.Fa), sm = v => K.mat.smer(Fs, v).map(x => -x);
      spoje.unshift({ i: 0, typ: 'kostky', P: K.mat.bod(Fs, [0, 0, 0]), osa: sm([0, 0, 1]), osaZ: sm([0, 0, 1]), osaX: K.mat.smer(Fs, [1, 0, 0]), osaY: K.mat.smer(Fs, [0, 1, 0]), zacatek: true });
    }
    // spoje mezi články
    for (const s of spoje) {
      const M = moment(s.P, h => h.i >= s.i), ax = Math.abs(dot(M, s.osa)), perp = delka(krizem(s.osa, krizem(M, s.osa)));
      const jm = s.zacatek ? '1. článek na kostkách' : `spoj ${s.i}–${s.i + 1}`;
      if (s.typ === 'prsty') pridej(s.i, jm + ' (prsty)', 'prsty', ax, U.prsty, `šroub M5 ${K.fmt(p.mech.utahM5, 1)} N·m → ${K.fmt(U.F5, 0)} N`);
      else if (s.typ === 'zavit') {
        const zt = p.clanky[s.i].a.slice(1), z = K.ZAVITY[zt], d3 = z.d - 1.2268 * z.p, Wz = Math.PI * d3 ** 3 / 32;
        pridej(s.i, jm + ' (závit – povolení)', 'zavit', ax, U.zavit, `utaženo ${K.fmt(p.mech.utahZavit, 1)} N·m`);
        const kov = p.zavit.kov, lim = kov ? 400 : mat.sigma * K.NAPRIC_VRSTVAMI;
        pridej(s.i, jm + ' (závit – ohyb šroubu)', 'ohyb', perp, lim * Wz, kov ? 'ocelový šroub' : `tištěný šroub, ${mat.nazev} napříč vrstvami`);
      } else if (s.typ === 'kostky') {
        // přídržná síla výstupků: odtržení (síla podél osy spoje) + překlopení přes hranu mřížky v obou směrech
        const k = p.clanky.length && p.kostky, n = k.nx * k.ny, F1 = k.sila;
        let W = 0; for (const h of hmoty) if (h.i >= s.i) W += h.m / 1000 * g * dyn;
        const Fp = Math.max(0, -W * s.osaZ[2]);
        const Mx = Math.abs(dot(M, s.osaX)), My = Math.abs(dot(M, s.osaY));
        const cap = n * F1 > 0 ? Fp / (n * F1) + Mx / (n * F1 * k.ny * k.roztec / 2) + My / (n * F1 * k.nx * k.roztec / 2) : Infinity;
        radky.push({ i: s.i, nazev: jm + ' (kostky)', typ: 'kostky', M: cap * 100, Mcap: 100, vyuziti: cap, pozn: `${n} výstupků × ${K.fmt(F1, 1)} N · odtržení ${K.fmt(Fp, 1)} N · klopení ${K.fmt(Math.max(Mx, My), 0)} N·mm` });
      } else pridej(s.i, jm + ' (studená patka)', 'patka', perp, null, 'drží jen tvarem nožky');
    }
    // vnitřní klouby
    for (const v of model.vnitrni) {
      const c = p.clanky[v.i], o = model.O[v.i];
      const M = moment(v.P, h => h.i > v.i || (h.i === v.i && h.cast === 1));
      if (v.typ === 'koule') pridej(v.i, `${v.i + 1}. kulový kloub`, 'koule', delka(M), U.koule(o.Rk), `koule Ø ${K.fmt(c.koule)} mm, sevření M5`);
      else pridej(v.i, `${v.i + 1}. otočný kloub`, 'otocny', Math.abs(dot(M, v.osa)), U.otocny((o.ri + o.Rd) / 2), `aretace ${c.zubu} zubů po ${K.fmt(o.krok, 1)}°`);
    }
    // ramena: ohyb v čele A
    const ramena = [];
    model.clanky.forEach((cc, i) => {
      const c = p.clanky[i];
      if (c.druh !== 'rameno' && c.druh !== 'adapter') return;
      const o = model.O[i], d = cc.casti[0];
      if (!d || !o.FaCelo) return;
      const F = K.mat.mul(model.W[i], o.FaCelo), P = K.mat.bod(F, [0, 0, 0]);
      const M = moment(P, h => h.i > i || (h.i === i));
      const Ml = [dot(M, K.mat.smer(F, [1, 0, 0])), dot(M, K.mat.smer(F, [0, 1, 0]))];
      const a = Math.min(o.A.x1 - o.A.x0, o.B.x1 - o.B.x0 || Infinity), b = Math.min(o.A.y1 - o.A.y0, o.B.y1 - o.B.y0 || Infinity);
      const sigma = Math.abs(Ml[0]) / (a * b * b / 6) + Math.abs(Ml[1]) / (b * a * a / 6);
      const up = K.POLOHY.find(x => x.id === d.tisk.poloha).u, napric = Math.abs(up[2]) > 0.9;
      const lim = mat.sigma * (napric ? K.NAPRIC_VRSTVAMI : 1);
      ramena.push({ i, nazev: `${i + 1}. ${c.druh === 'rameno' ? 'rameno' : 'adaptér'}`, sigma, lim, k: sigma > 1e-9 ? lim / sigma : Infinity, napric, a, b });
      pridej(i, `${i + 1}. ${c.druh === 'rameno' ? 'rameno' : 'adaptér'} – ohyb u čela A`, 'rameno', sigma, lim, napric ? 'MPa · napříč vrstvami' : 'MPa · podél vrstev');
    });
    const sVyuzitim = radky.filter(r => r.vyuziti !== null);
    const nejhorsi = sVyuzitim.length ? sVyuzitim.reduce((a, b) => (b.vyuziti > a.vyuziti ? b : a)) : null;
    return { hmotnost, radky, ramena, nejhorsi, U, dyn };
  }

  /** Hlášení z mechaniky (celé věty kvůli překladu). */
  function hlaseni(p, r) {
    const H = [];
    for (const x of r.radky) {
      if (x.vyuziti === null) continue;
      const pole = x.typ === 'prsty' || x.typ === 'koule' || x.typ === 'otocny' || x.typ === 'objimka' ? ['mech.utahM5'] : x.typ === 'zavit' ? ['mech.utahZavit'] : x.typ === 'ohyb' ? ['zavit.kov'] : x.typ === 'magnet' ? [`clanky.0.pocet`] : [`clanky.${x.i}.druh`];
      if (x.typ === 'kostky') {
        if (x.vyuziti > 1) H.push({ uroven: 'varovani', pole: ['kostky.sila', 'kostky.nx'], text: `${x.nazev}: výstupky drží jen ${K.fmt(100 / x.vyuziti, 0)} % potřebné síly – kamera by z kostek spadla nebo se vyklopila. Zvětšete mřížku, zkraťte vyložení nebo spoj zajistěte gumičkou.` });
        else if (x.vyuziti > 0.6) H.push({ uroven: 'info', pole: ['kostky.sila'], text: `${x.nazev}: využití ${K.fmt(x.vyuziti * 100, 0)} % přídržné síly výstupků – otřesy ji snadno překonají.` });
        continue;
      }
      if (x.vyuziti > 1) H.push({ uroven: 'varovani', pole, text: `${x.nazev}: zatížení ${K.fmt(x.vyuziti * 100, 0)} % únosnosti – spoj se protočí nebo povolí. Zkraťte vyložení, utáhněte víc nebo zvolte pevnější spoj.` });
      else if (x.vyuziti > 0.6) H.push({ uroven: 'info', pole, text: `${x.nazev}: využití ${K.fmt(x.vyuziti * 100, 0)} % – malá rezerva (otřesy, povolení šroubu).` });
    }
    return H;
  }

  const API = { unosnosti, rozbor, hlaseni };
  if (uzel) module.exports = API; else window.FOTU_MECH = API;
})();
