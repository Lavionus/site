/* ============================================================
   Kleště, pinzety a svorky — knihovna čelistí.

   Čelist se staví v „zavřené“ poloze: osa x vede od kořene čelisti
   (x = 0, tam se napojí rameno) ke špičce, rozhraní obou čelistí je
   přímka y = 0 (u zahnuté čelisti oblouk), z jde od podložky nahoru.
   Strana sig = +1 je horní čelist (y ≥ mezera/2), sig = −1 dolní.

   Reliéf plochy (zoubky, mřížka…) je funkce r(s, v): o kolik plocha
   vystupuje k protější čelisti. U „doplňkových“ vzorů má dolní čelist
   reliéf opačný, takže do sebe obě plochy přesně zapadnou; u výřezů
   (půlkruh, drážky) mají obě stejný a vznikne otvor.

   Každý druh: { nazev, skupina, popis, parametry: [...], info(p, c),
   stavba(p, c, sig) → {telesa, tpu} }. c = {t, w, g, L}: tloušťka
   a šířka ramene u kořene, mezera mezi čelistmi v zavřené poloze,
   doporučená délka.
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.KJ || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const { lerp, omez, hladce, troj, zlomek, rad } = J;

  /* ---------------- společné parametry ---------------- */
  const P_L = { id: 'L', nazev: 'Délka čelisti', min: 3, max: 220, krok: 0.5, jednotka: 'mm', vychozi: c => c.L || 20 };
  const P_KONEC = {
    id: 'konec', nazev: 'Tvar špičky', typ: 'volba', vychozi: 'rovny',
    volby: [['rovny', 'rovná'], ['zaobleny', 'zaoblená z boku'], ['kulaty', 'zaoblená shora'], ['zkoseny', 'zkosená'], ['spicaty', 'zašpičatělá']]
  };
  const P_TK = { id: 'tKonec', nazev: 'Tloušťka u špičky', min: 20, max: 150, krok: 5, jednotka: '%', vychozi: 80 };
  const P_WK = { id: 'wKonec', nazev: 'Šířka u špičky', min: 10, max: 200, krok: 5, jednotka: '%', vychozi: 80 };
  const P_OHYB = { id: 'ohyb', nazev: 'Zahnutí čelisti', min: -80, max: 80, krok: 1, jednotka: '°', vychozi: 0,
    napoveda: 'Ohyb v rovině nástroje; obě čelisti se ohnou souběžně a v zavřené poloze se dál dotýkají.' };
  const SPOL = [P_L, P_KONEC, P_TK, P_WK, P_OHYB];

  // přesah ramene do čelisti (rameno končí uvnitř čelisti, slicer je sloučí)
  const presahPro = (L, t) => omez(Math.min(L * 0.18, 1.5 * t), 0.6, 4);

  /* Průběh tloušťky a šířky po délce: lineární zúžení + tvar špičky.
     Vrací {tl(s), sir(s), kraj (kde končí vzor), zjemni: [s]}. */
  function profil(p, c, L, presah, o) {
    o = o || {};
    const t0 = c.t, w0 = c.w;
    const tK = (o.tKonec != null ? o.tKonec : p.tKonec != null ? p.tKonec : 100) / 100;
    const wK = (o.wKonec != null ? o.wKonec : p.wKonec != null ? p.wKonec : 100) / 100;
    const konec = o.konec || p.konec || 'rovny';
    const Lr = Math.max(0.5, L - presah);
    // zúžení začíná plynule (nulový sklon u kořene, pak lineárně) – rameno
    // na čelist navazuje bez zlomu plochy
    const nab = 0.3, f = s => { const x = omez((s - presah) / Lr, 0, 1); return (x < nab ? x * x / (2 * nab) : x - nab / 2) / (1 - nab / 2); };
    const tZ = s => o.tl ? o.tl(s) : lerp(t0, t0 * tK, f(s));
    const wZ = s => o.sir ? o.sir(s) : lerp(w0, w0 * wK, f(s));
    const tE = Math.max(0.4, tZ(L)), wE = Math.max(0.4, wZ(L));
    let R = 0, kraj = 0.4;
    const zjemni = [];
    let tl = s => Math.max(0.35, tZ(s)), sir = s => Math.max(0.35, wZ(s));
    const oblouk = (Rr, fn) => {
      for (let k = 1; k < 14; k++) zjemni.push(L - Rr * (1 - Math.sin(Math.PI / 2 * k / 14)));
      return fn;
    };
    if (konec === 'zaobleny') {
      R = Math.min(tE, Lr * 0.45);
      tl = oblouk(R, s => { const x = (s - (L - R)) / R; return Math.max(0.35, x > 0 ? tZ(s) * Math.sqrt(Math.max(0, 1 - x * x * 0.985)) : tZ(s)); });
      kraj = R;
    } else if (konec === 'kulaty') {
      R = Math.min(wE * 0.9, Lr * 0.45);
      sir = oblouk(R, s => { const x = (s - (L - R)) / R; return Math.max(0.35, x > 0 ? wZ(s) * Math.sqrt(Math.max(0, 1 - x * x * 0.985)) : wZ(s)); });
      kraj = R;
    } else if (konec === 'zkoseny') {
      R = Math.min(2 * tE, Lr * 0.5);
      tl = s => { const x = omez((s - (L - R)) / R, 0, 1); return Math.max(0.35, tZ(s) * lerp(1, 0.22, x)); };
      zjemni.push(L - R);
      kraj = R * 0.5;
    } else if (konec === 'spicaty') {
      R = Lr * 0.4;
      const k = s => { const x = omez((s - (L - R)) / R, 0, 1); return lerp(1, 0.06, Math.pow(x, 0.85)); };
      tl = s => Math.max(0.35, tZ(s) * k(s));
      sir = s => Math.max(0.35, wZ(s) * k(s));
      for (let i = 1; i < 10; i++) zjemni.push(L - R + R * i / 10);
      kraj = R * 0.6;
    }
    return { tl, sir, kraj: Math.max(0.4, kraj), zjemni };
  }

  /* Obecná čelist tažením průřezu.
     o: {L, c, sig, tl, sir, ohyb (°), rel(s,v,w), relV, krokS, krokV,
         zlomy: [s], miska(s,v,w) → posun plochy od rozhraní, uPlochy (posun plochy)} */
  function tazena(o) {
    const L = o.L, g2 = o.c.g / 2, sig = o.sig, s0 = o.sZac || 0, Lc = o.Lohyb || L;
    const sb = Math.max(o.presah + 0.5, Lc * 0.3);
    // poloměr ohybu musí být větší než tloušťka (vnitřní strana by se přeložila)
    let tMax = 0;
    for (let k = 0; k <= 20; k++) tMax = Math.max(tMax, o.tl(Lc * k / 20));
    // (i s odsazením plochy uPlochy – plocha u polštářku je dál od osy)
    const rMin = g2 + (o.uPlochy || 0) + tMax + 1 + (o.hloubkaMisky || 0);
    let beta = rad(o.ohyb || 0);
    if (o.betaPevna != null) beta = o.betaPevna;          // úhel převzatý od sousedního tělesa (polštářek, plochá protičelist)
    else if (beta && Math.abs((Lc - sb) / beta) < rMin) beta = Math.sign(beta) * (Lc - sb) / rMin;
    const rho = beta ? (Lc - sb) / beta : 0;
    const C = s => {
      if (!beta || s <= sb) return { p: [s, 0], t: [1, 0] };
      const a = (s - sb) / rho;
      return { p: [sb + rho * Math.sin(a), rho * (1 - Math.cos(a))], t: [Math.cos(a), Math.sin(a)] };
    };
    // vzorky po délce
    const krok = Math.min(o.krokS || (L - s0) / 40, (L - s0) / 24, 2);
    let S = [];
    const n = Math.max(8, Math.ceil((L - s0) / krok));
    for (let i = 0; i <= n; i++) S.push(s0 + (L - s0) * i / n);
    for (const z of (o.zlomy || [])) if (z > s0 + 1e-4 && z < L - 1e-4) S.push(z);
    S.sort((a, b) => a - b);
    S = S.filter((s, i) => i === 0 || s - S[i - 1] > 2e-3);
    if (L - S[S.length - 1] > 1e-9) S.push(L); else S[S.length - 1] = L;
    // body plochy (stejný počet ve všech průřezech)
    let wMax = 0;
    for (const s of S) wMax = Math.max(wMax, o.sir(s));
    const m = o.relV ? Math.min(240, Math.max(3, Math.ceil(wMax / (o.krokV || wMax / 8)) + 1)) : 2;
    const uP = o.uPlochy || 0;
    const stanice = [];
    for (const s of S) {
      const t = o.tl(s), w = o.sir(s), q = C(s);
      const nn = [-q.t[1], q.t[0]];
      const u0 = g2 + uP, u1 = g2 + uP + t;
      const rez = [];
      // zadní strana: u misky se prohýbá s plochou (stejný počet bodů)
      const mz = o.miska ? m : 2;
      for (let k = 0; k < mz; k++) rez.push([u1, w * k / (mz - 1)]);
      for (let k = 0; k < m; k++) {
        const v = w * (1 - k / (m - 1));
        // reliéf nesmí prorazit zadní stranu ani se odtrhnout od plochy
        const r = o.rel ? Math.max(-(t - 0.4), Math.min(o.rel(s, v, w), 0.9 * t + 2)) : 0;
        rez.push([u0 - r, v]);
      }
      if (o.miska) for (const b of rez) b[0] += o.miska(s, b[1], w);
      // souměrné rozšíření: střed šířky zůstává ve středu ramene
      if (o.stred != null) { const dv = (o.stred - w) / 2; for (const b of rez) b[1] += dv; }
      stanice.push({ P: [q.p[0], q.p[1], 0], U: [sig * nn[0], sig * nn[1], 0], W: [0, 0, 1], rez });
    }
    const t = J.tazeni(stanice, false);
    t.beta = beta;                    // skutečný úhel zahnutí (po omezení)
    if (!o.sZac) { const q = C(L); t.spicka = q.p; t.spickaS = L; }   // osa rozhraní na konci čelisti (střed předpětí špiček)
    return t;
  }

  // obálka vzoru: náběh na začátku i konci oblasti
  function obalka(sA, sB, nab) {
    return s => hladce((s - sA) / nab) * hladce((sB - s) / nab);
  }

  /* Standardní čelist: profil + vzor reliéfu. vzor(p, c, oblast) →
     {f(s,v,w), v: závisí na v, krokS, krokV, zlomy, doplnek} */
  // délka oblasti vzoru (sB − sA) u standardní čelisti
  function mistoVzoru(p, c) {
    const presah = presahPro(p.L, c.t), pr = profil(p, c, p.L, presah);
    return (p.L - pr.kraj) - (presah + 0.4);
  }
  function standardni(p, c, sig, vzor, navic) {
    navic = navic || {};
    const L = p.L, presah = presahPro(L, c.t);
    const pr = profil(p, c, L, presah, navic.profil);
    const sA = presah + 0.4, sB = L - pr.kraj;
    let o = { L, c, sig, presah, tl: pr.tl, sir: pr.sir, ohyb: p.ohyb, zlomy: pr.zjemni.slice(), uPlochy: navic.uPlochy };
    if (vzor && sB > sA + 0.3) {
      const v = vzor(sA, sB);
      const zn = v.doplnek === false ? 1 : sig;
      // u doplňkových vzorů se hloubka omezí souměrně (výstupek i prohlubeň stejně),
      // jinak by po ořezu u tenké špičky zoubky do sebe nezapadly a čelisti nedosedly
      o.rel = v.doplnek === false ? (s, vv, w) => v.f(s, vv, w)
        : (s, vv, w) => { const lim = Math.max(0, o.tl(s) - 0.45); return zn * omez(v.f(s, vv, w), -lim, lim); };
      o.relV = !!v.v; o.krokS = v.krokS; o.krokV = v.krokV;
      o.zlomy = o.zlomy.concat(v.zlomy || []);
      if (v.tl) { const t0 = o.tl; o.tl = s => Math.max(t0(s), v.tl(s)); }
    }
    if (navic.miska) { o.miska = navic.miska; o.relV = true; o.krokV = Math.min(o.krokV || 99, navic.krokV || 99); }
    if (navic.krokS) o.krokS = Math.min(o.krokS || 99, navic.krokS);
    if (navic.stred) o.stred = c.w;
    if (navic.hloubkaMisky) o.hloubkaMisky = navic.hloubkaMisky;
    if (navic.betaPevna != null) o.betaPevna = navic.betaPevna;
    return tazena(o);
  }

  // zlomy periodického vzoru v oblasti
  function zlomyPer(sA, sB, p, faze) {
    const out = [];
    for (let k = Math.floor(sA / p) - 1; k * p <= sB + p; k++) for (const f of faze) {
      const s = (k + f) * p;
      if (s > sA - p && s < sB + p) out.push(s);
    }
    return out;
  }

  /* ---------------- vzory ---------------- */
  const vzorPricne = (p) => (sA, sB) => {
    const e = obalka(sA, sB, Math.max(p.p * 0.6, 0.3));
    return { f: s => p.h * (troj(s / p.p + 0.25) - 0.5) * e(s), krokS: p.p / 4, zlomy: zlomyPer(sA, sB, p.p, [0.25, 0.75]) };
  };

  /* Rozměry kulatého okénka: vnitřní poloměr v hloubce h od plochy čelisti
     (kulové lůžko = koule o průměru D se středem na rozhraní čelistí). */
  function kruhRozmery(p, c) {
    const g2 = (c.g || 0) / 2, Rb = p.D / 2, rMin = Math.max(0.5, Rb * 0.35);
    const rIn = h => p.luzko ? Math.max(rMin, Math.sqrt(Math.max(0, Rb * Rb - (g2 + h) * (g2 + h)))) : Rb;
    const Ro = rIn(0) + p.lem;
    const xs = presahPro(Math.max(8, p.krcek + 4), c.t) + 0.3 + p.krcek;
    return { rIn, Ro, xs };
  }

  /* ---------------- knihovna ---------------- */
  const P_ROZTEC = (vych, min) => ({ id: 'p', nazev: 'Rozteč zoubků', min: min || 0.3, max: 12, krok: 0.1, jednotka: 'mm', vychozi: vych });
  const P_HLOUBKA = (vych) => ({ id: 'h', nazev: 'Hloubka zoubků', min: 0.1, max: 6, krok: 0.05, jednotka: 'mm', vychozi: vych });
  const roztecZ = c => +omez(c.w * 0.09, 0.5, 3.5).toFixed(1);

  const CELISTI = {
    hladka: {
      nazev: 'Hladké', skupina: 'Ploché', popis: 'Rovná hladká plocha – drží jemně a nepoškodí povrch (papír, fólie, pečivo).',
      parametry: SPOL,
      stavba: (p, c, sig) => ({ telesa: [standardni(p, c, sig, null)] })
    },
    pricne: {
      nazev: 'Příčné zoubkování', skupina: 'Zoubkované', popis: 'Klasické rýhy napříč – „anatomická“ pinzeta, peán, ploché kleště. Zoubky obou čelistí do sebe zapadnou.',
      parametry: [...SPOL, P_ROZTEC(roztecZ), P_HLOUBKA(c => +(roztecZ(c) * 0.45).toFixed(2))],
      kontrola: (p, c) => p.h / 2 + 0.6 > c.t * (p.tKonec / 100) ? 'Zoubky jsou na tloušťku čelisti u špičky příliš hluboké.' : null,
      stavba: (p, c, sig) => ({ telesa: [standardni(p, c, sig, vzorPricne(p))] })
    },
    pilove: {
      nazev: 'Pilové zuby', skupina: 'Zoubkované', popis: 'Šikmé zuby jako pila – drží proti vytržení jedním směrem (kluzké maso, ryby, gril).',
      parametry: [...SPOL, P_ROZTEC(c => +omez(c.w * 0.12, 0.6, 5).toFixed(1)), P_HLOUBKA(c => +(omez(c.w * 0.12, 0.6, 5) * 0.5).toFixed(2)),
        { id: 'smer', nazev: 'Zuby míří', typ: 'volba', vychozi: 'dovnitr', volby: [['dovnitr', 'k nástroji (drží tah)'], ['ven', 'ke špičce']] }],
      stavba: (p, c, sig) => ({
        telesa: [standardni(p, c, sig, (sA, sB) => {
          const e = obalka(sA, sB, Math.max(p.p * 0.6, 0.3)), zn = p.smer === 'ven' ? -1 : 1;
          return { f: s => p.h * (zlomek(zn * s / p.p) - 0.5) * e(s), krokS: p.p / 5, zlomy: zlomyPer(sA, sB, p.p, [-0.012, 0.012].map(x => x)).map(s => s) };
        })]
      })
    },
    vlnite: {
      nazev: 'Vlnité (zubaté okraje)', skupina: 'Zoubkované', popis: 'Velké oblé vlny jako u kuchyňských kleští – drží klobásy, zeleninu i pečivo.',
      parametry: [...SPOL, P_ROZTEC(c => +omez(c.w * 0.35, 2, 10).toFixed(1), 1), P_HLOUBKA(c => +omez(c.w * 0.12, 0.8, 3).toFixed(1))],
      stavba: (p, c, sig) => ({
        telesa: [standardni(p, c, sig, (sA, sB) => {
          const e = obalka(sA, sB, p.p * 0.5);
          return { f: s => p.h * 0.5 * Math.sin(2 * Math.PI * s / p.p) * e(s), krokS: p.p / 14 };
        })]
      })
    },
    mrizka: {
      nazev: 'Křížové rýhování', skupina: 'Zoubkované', popis: 'Mřížka jehlanů (diamant) – pevný úchop ze všech směrů; jehelce, kombinačky.',
      parametry: [...SPOL, P_ROZTEC(c => +omez(c.w * 0.14, 0.6, 3).toFixed(1)), P_HLOUBKA(c => +(omez(c.w * 0.14, 0.6, 3) * 0.45).toFixed(2))],
      stavba: (p, c, sig) => ({
        telesa: [standardni(p, c, sig, (sA, sB) => {
          const e = obalka(sA, sB, Math.max(p.p * 0.6, 0.3));
          return {
            v: true, krokS: p.p / 4, krokV: p.p / 4, zlomy: zlomyPer(sA, sB, p.p, [0, 0.25, 0.5, 0.75]),
            f: (s, v, w) => { const q = v - w / 2; return p.h * (Math.min(troj((s + q) / p.p), troj((s - q) / p.p)) - 0.5) * e(s); }
          };
        })]
      })
    },
    podelne: {
      nazev: 'Podélné drážky', skupina: 'Zoubkované', popis: 'Žlábky po délce čelisti – pero a drážka, drží tenké předměty souose (klip na sáčky, drát).',
      parametry: [...SPOL, P_ROZTEC(c => +omez(c.w * 0.2, 0.6, 4).toFixed(1)), P_HLOUBKA(c => +(omez(c.w * 0.2, 0.6, 4) * 0.4).toFixed(2))],
      stavba: (p, c, sig) => ({
        telesa: [standardni(p, c, sig, (sA, sB) => {
          const e = obalka(sA, sB, Math.max(p.p, 0.5));
          return { v: true, krokV: p.p / 6, f: (s, v, w) => p.h * (troj((v - w / 2) / p.p + 0.25) - 0.5) * e(s) };
        })]
      })
    },
    debakey: {
      nazev: 'Atraumatické (DeBakey)', skupina: 'Zoubkované', popis: 'Podélné řady jemných zoubků – drží pevně, ale netrhá (cévní pinzety a svorky).',
      parametry: [...SPOL,
        { id: 'pv', nazev: 'Rozteč řad', min: 0.4, max: 6, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.w * 0.22, 0.6, 3).toFixed(1) },
        P_ROZTEC(c => +omez(c.w * 0.07, 0.4, 2).toFixed(1)), P_HLOUBKA(c => +omez(c.w * 0.05, 0.25, 1.2).toFixed(2))],
      stavba: (p, c, sig) => ({
        telesa: [standardni(p, c, sig, (sA, sB) => {
          const e = obalka(sA, sB, Math.max(p.p, 0.4));
          return {
            v: true, krokS: p.p / 4, krokV: p.pv / 6, zlomy: zlomyPer(sA, sB, p.p, [0.25, 0.75]),
            f: (s, v, w) => p.h * (0.55 * (troj((v - w / 2) / p.pv + 0.25) - 0.5) + 0.45 * (troj(s / p.p + 0.25) - 0.5)) * e(s)
          };
        })]
      })
    },
    zuby12: {
      nazev: 'Chirurgické zuby 1×2', skupina: 'Zoubkované', popis: 'Na špičce jeden zub proti dvěma (Kocher, chirurgická pinzeta) – drží i kluzkou tkáň; zbytek čelisti může mít rýhy.',
      parametry: [P_L, P_TK, P_WK, P_OHYB,
        { id: 'lt', nazev: 'Délka zubů', min: 0.8, max: 15, krok: 0.1, jednotka: 'mm', vychozi: c => +omez((c.L || 20) * 0.12, 1.2, 5).toFixed(1) },
        { id: 'ht', nazev: 'Výška zubů', min: 0.2, max: 6, krok: 0.05, jednotka: 'mm', vychozi: c => +omez(c.t * 0.4, 0.4, 2.5).toFixed(2) },
        { id: 'wt', nazev: 'Šířka středního zubu', min: 10, max: 60, krok: 1, jednotka: '% šířky', vychozi: 34 },
        { id: 'ryhy', nazev: 'Rýhy na zbytku čelisti', typ: 'prepinac', vychozi: true },
        P_ROZTEC(c => +omez(c.w * 0.08, 0.5, 3).toFixed(1)), P_HLOUBKA(c => +(omez(c.w * 0.08, 0.5, 3) * 0.4).toFixed(2))],
      kontrola: (p, c) => p.ht + 0.6 > c.t * p.tKonec / 100 ? 'Zuby jsou vyšší, než dovolí tloušťka špičky.' : null,
      stavba: (p, c, sig) => ({
        telesa: [standardni(p, c, sig, (sA, sB) => {
          const z1 = Math.max(sA + 0.5, sB - p.lt), nab = Math.min(0.4, p.lt * 0.25);
          const eZ = s => hladce((s - z1) / nab) * hladce((sB + 0.35 - s) / 0.25);
          const eR = obalka(sA, z1, Math.max(p.p * 0.6, 0.3));
          return {
            v: true, krokS: Math.min(p.p / 4, p.lt / 8), krokV: Math.max(0.08, p.wt / 100 * c.w / 6),
            zlomy: (p.ryhy ? zlomyPer(sA, z1, p.p, [0.25, 0.75]) : []).concat([z1, z1 + nab, sB - 0.25, sB]),
            f: (s, v, w) => {
              const pas = 2 * hladce((p.wt / 200 * w - Math.abs(v - w / 2)) / Math.max(0.12, w * 0.03) + 0.5) - 1;
              const ez = eZ(s);
              const r = p.ryhy ? p.h * (troj(s / p.p + 0.25) - 0.5) * eR(s) : 0;
              return r * (1 - ez) + p.ht * pas * ez;
            }
          };
        }, { profil: { konec: 'rovny' } })]
      })
    },
    jehla: {
      nazev: 'Jehlový hrot', skupina: 'Špičaté', popis: 'Zúžení až do jemného hrotu – třísky, SMD součástky, vlasy, modelářské díly.',
      parametry: [P_L, P_OHYB,
        { id: 'hrot', nazev: 'Šířka hrotu', min: 0.25, max: 4, krok: 0.05, jednotka: 'mm', vychozi: c => +omez(c.w * 0.08, 0.4, 2).toFixed(2) },
        { id: 'tHrot', nazev: 'Tloušťka hrotu', min: 0.3, max: 4, krok: 0.05, jednotka: 'mm', vychozi: c => +omez(c.t * 0.35, 0.45, 2).toFixed(2) },
        { id: 'ryhy', nazev: 'Jemné rýhy u hrotu', typ: 'prepinac', vychozi: false }],
      stavba: (p, c, sig) => {
        const presah = presahPro(p.L, c.t), Lr = p.L - presah;
        const f = s => Math.pow(omez((s - presah) / Lr, 0, 1), 0.75);
        const o = {
          profil: {
            konec: 'rovny', tl: s => lerp(c.t, p.tHrot, f(s)), sir: s => lerp(c.w, p.hrot, f(s))
          }
        };
        const pp = { p: Math.max(0.3, p.tHrot * 0.8), h: Math.min(0.25, p.tHrot * 0.3) };
        return { telesa: [standardni(p, c, sig, p.ryhy ? (sA, sB) => vzorPricne(pp)(Math.max(sA, p.L - Lr * 0.45), sB) : null, o)] };
      }
    },
    lopatka: {
      nazev: 'Široká lopatka', skupina: 'Ploché', popis: 'Tenké rozšířené plošky se zaoblenými rohy – známky, fólie, plátky, citlivé papíry.',
      parametry: [P_L, P_OHYB,
        { id: 'W', nazev: 'Šířka lopatky', min: 2, max: 120, krok: 0.5, jednotka: 'mm', vychozi: c => +(c.w * 1.6).toFixed(1) },
        { id: 'tl', nazev: 'Tloušťka lopatky', min: 0.5, max: 10, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.t * 0.6, 0.6, 4).toFixed(1) },
        { id: 'stred', nazev: 'Rozšířit souměrně', typ: 'prepinac', vychozi: true, napoveda: 'Souměrně vypadá jako skutečný nástroj, ale část čelisti je pod úrovní ramen – při tisku naležato potřebuje podpěry. Vypnuto = rozšíření jen nahoru, tisk bez podpěr.' }],
      stavba: (p, c, sig) => {
        const presah = presahPro(p.L, c.t), Lr = p.L - presah;
        const f = s => omez((s - presah) / Lr, 0, 1);
        return {
          telesa: [standardni(p, c, sig, null, {
            profil: { konec: 'kulaty', tl: s => lerp(c.t, p.tl, hladce(f(s) * 2.5)), sir: s => lerp(c.w, p.W, hladce(f(s) * 1.6)) },
            stred: p.stred
          })]
        };
      }
    },
    lzice: {
      nazev: 'Lžíce', skupina: 'Tvarované', popis: 'Prohnuté misky – salát, těstoviny, kostky ledu, drobné kuličky.',
      parametry: [P_L, P_OHYB,
        { id: 'W', nazev: 'Šířka misky', min: 4, max: 150, krok: 0.5, jednotka: 'mm', vychozi: c => +(c.w * 1.8).toFixed(1) },
        { id: 'D', nazev: 'Hloubka misky', min: 0, max: 40, krok: 0.5, jednotka: 'mm', vychozi: c => +(c.w * 0.25).toFixed(1) },
        { id: 'tl', nazev: 'Tloušťka stěny', min: 0.6, max: 8, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.t * 0.5, 1, 3).toFixed(1) },
        { id: 'delkaMisky', nazev: 'Délka misky', min: 20, max: 100, krok: 5, jednotka: '%', vychozi: 75 },
        { id: 'stred', nazev: 'Rozšířit souměrně', typ: 'prepinac', vychozi: true, napoveda: 'Souměrně vypadá jako skutečný nástroj, ale část čelisti je pod úrovní ramen – při tisku naležato potřebuje podpěry. Vypnuto = rozšíření jen nahoru, tisk bez podpěr.' }],
      info: (p, c) => ({ minMezera: 0 }),
      stavba: (p, c, sig) => {
        const presah = presahPro(p.L, c.t);
        const sc0 = Math.max(presah + 1, p.L * (1 - p.delkaMisky / 100)), hl = (p.L - sc0) / 2, sm = p.L - hl;
        // miska nejvýš 0,4× šířky a 0,6× délky (jinak strmé stěny přeloží síť)
        const D = Math.min(p.D, p.W * 0.4, (p.L - sc0) * 0.6);
        const cup = s => { const x = (s - sm) / hl; return p.W * Math.sqrt(Math.max(0, 1 - x * x)); };
        const env = s => { const x = (s - sm) / hl; return Math.sqrt(Math.max(0, 1 - x * x)); };
        const zj = [];
        for (let k = 1; k < 16; k++) zj.push(p.L - hl * (1 - Math.sin(Math.PI / 2 * k / 16)));
        const o = {
          profil: {
            konec: 'rovny',
            tl: s => lerp(c.t, p.tl, hladce((s - presah) / Math.max(0.5, sc0 - presah + hl * 0.3))),
            sir: s => s < sm ? Math.max(c.w, cup(s)) : Math.max(0.4, cup(s))
          },
          miska: (s, v, w) => D * env(s) * (1 - Math.pow((2 * v - w) / Math.max(w, 1e-6), 2)),
          krokV: p.W / 18, krokS: Math.min(p.L / 60, hl / 16), stred: p.stred, hloubkaMisky: D
        };
        const t = standardni(p, c, sig, null, o);
        return { telesa: [t] };
      }
    },
    okenko: {
      nazev: 'Oválné okénko', skupina: 'Tvarované', popis: 'Prstenec s otvorem (kleště na tampony, Foerster) – drží měkké a kulaté věci bez sklouznutí.',
      parametry: [P_L,
        { id: 'W', nazev: 'Šířka oválu', min: 3, max: 120, krok: 0.5, jednotka: 'mm', vychozi: c => +(c.w * 1.5).toFixed(1) },
        { id: 'lem', nazev: 'Šířka lemu', min: 0.8, max: 20, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.w * 0.25, 1.2, 6).toFixed(1) },
        { id: 'tl', nazev: 'Tloušťka', min: 0.8, max: 20, krok: 0.1, jednotka: 'mm', vychozi: c => +c.t.toFixed(1) },
        { id: 'zoubky', nazev: 'Rýhy na lemu', typ: 'prepinac', vychozi: true },
        { id: 'stred', nazev: 'Rozšířit souměrně', typ: 'prepinac', vychozi: true, napoveda: 'Souměrně vypadá jako skutečný nástroj, ale část čelisti je pod úrovní ramen – při tisku naležato potřebuje podpěry. Vypnuto = rozšíření jen nahoru, tisk bez podpěr.' }],
      kontrola: (p, c) => p.lem * 2 + 1 > Math.min(p.W, p.L * 0.8) ? 'Lem je na velikost oválu příliš široký – okénko zmizí.' : null,
      stavba: (p, c, sig) => {
        // krček (krátká čelist) + prstenec jako deska v rovině (x, z)
        const presah = presahPro(p.L, c.t);
        const W = Math.max(p.W, c.w), xs = presah + 0.3, Le = Math.max(p.lem * 2 + 1, p.L - xs);
        const krcek = standardni({ L: xs + p.lem * 0.6, ohyb: 0 }, c, sig, null, { profil: { konec: 'rovny' } });
        const n = 72, ven = [], dov = [];
        const cx = xs + Le / 2, cz = p.stred ? c.w / 2 : W / 2;
        const ax = Le / 2, az = W / 2, lem = Math.min(p.lem, Math.min(ax, az) * 0.7), bx = ax - lem, bz = az - lem;
        const zub = p.zoubky ? Math.min(0.5, p.tl * 0.15) : 0;
        for (let k = 0; k < n; k++) {
          const a = 2 * Math.PI * k / n;
          ven.push([cx + ax * Math.cos(a), cz + az * Math.sin(a)]);
          dov.push([cx + bx * Math.cos(a), cz + bz * Math.sin(a)]);
        }
        const g2 = c.g / 2;
        // reliéf lemu: drobné vlnky po obvodu na ploše čelisti → deska z pruhů
        const telesa = [krcek];
        const deska = J.deska(ven.map(q => [q[0], q[1], 0, p.tl]), [dov.map(q => [q[0], q[1], 0, p.tl])]);
        // (x, z, u) → (x, sig·(g/2 + u), z)
        telesa.push(J.transformuj(deska, q => [q[0], sig * (g2 + q[2]), q[1]]));
        if (zub) {
          // vroubky na lemu: malé hranolky po obvodu na straně plochy
          for (let k = 0; k < 28; k++) {
            const a0 = 2 * Math.PI * (k + 0.15) / 28, a1 = 2 * Math.PI * (k + 0.55) / 28;
            const pts = [];
            for (const a of [a0, a1]) pts.push([cx + (ax - 0.15) * Math.cos(a), cz + (az - 0.15) * Math.sin(a)]);
            for (const a of [a1, a0]) pts.push([cx + (bx + 0.15) * Math.cos(a), cz + (bz + 0.15) * Math.sin(a)]);
            const h = J.deska(pts.map(q => [q[0], q[1], -zub, 0.05]));
            telesa.push(J.transformuj(h, q => [q[0], sig * (g2 + q[2]), q[1]]));
          }
        }
        return { telesa };
      },
      info: (p, c) => ({ minMezera: p.zoubky ? 2 * Math.min(0.5, p.tl * 0.15) + 0.1 : 0 })
    },
    kruh: {
      nazev: 'Kulaté okénko', skupina: 'Tvarované', popis: 'Kruhový prstenec; s kulovým lůžkem obě čelisti obejmou kouli (kuličky, korálky, ložiskové kuličky, bonbony) a ta nevypadne.',
      parametry: [
        { id: 'D', nazev: 'Průměr koule / okénka', min: 2, max: 150, krok: 0.5, jednotka: 'mm', vychozi: c => +omez(c.w * 1.3, 4, 40).toFixed(1) },
        { id: 'lem', nazev: 'Šířka lemu', min: 0.8, max: 25, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.w * 0.25, 1.2, 6).toFixed(1) },
        { id: 'tl', nazev: 'Tloušťka prstence', min: 0.8, max: 25, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.t * 1.2, 1.2, 8).toFixed(1) },
        { id: 'luzko', nazev: 'Kulové lůžko', typ: 'prepinac', vychozi: true,
          napoveda: 'Vnitřní hrana je vybraná do koule zadaného průměru, takže koule sedí v obou čelistech. Vypnuto = válcový otvor.' },
        { id: 'krcek', nazev: 'Krček', min: 0, max: 60, krok: 0.5, jednotka: 'mm', vychozi: c => +omez(c.t * 1.2, 1.5, 8).toFixed(1) },
        { id: 'stred', nazev: 'Prstenec souměrně k ramenu', typ: 'prepinac', vychozi: true,
          napoveda: 'Střed okénka ve středu šířky ramene (vypadá přirozeně, ale při tisku naležato potřebuje podpěry). Vypnuto = prstenec leží na podložce.' }],
      presah: (p, c) => presahPro(Math.max(8, p.krcek + 4), c.t),
      info: () => ({ minMezera: 0.2 }),
      delka: (p, c) => {
        const r = kruhRozmery(p, c || { t: 2, w: 8, g: 0 });
        return r.xs + 2 * r.Ro;
      },
      kontrola: (p, c) => (p.luzko && c.g / 2 + 0.3 >= p.D / 2) ? 'Mezera mezi čelistmi je větší než koule – lůžko by ji nedrželo.' : null,
      stavba: (p, c, sig) => {
        const g2 = c.g / 2, R = kruhRozmery(p, c);
        const krcek = standardni({ L: R.xs + p.lem * 0.6, ohyb: 0 }, c, sig, null, { profil: { konec: 'rovny' } });
        // průřez prstence v (poloměr, hloubka od plochy čelisti)
        const prof = [[R.Ro, 0], [R.Ro, p.tl]];
        for (let k = 0; k <= 14; k++) { const h = p.tl * (1 - k / 14); prof.push([R.rIn(h), h]); }
        const xc = R.xs + R.Ro, zc = p.stred ? c.w / 2 : R.Ro, st = [], n = 72;
        for (let k = 0; k < n; k++) {
          const a = 2 * Math.PI * k / n;
          st.push({ P: [xc, sig * g2, zc], U: [Math.cos(a), 0, Math.sin(a)], W: [0, sig, 0], rez: prof });
        }
        return { telesa: [krcek, J.tazeni(st, true)] };
      }
    },
    oblouk: {
      nazev: 'Obloukové (obejmou válec)', skupina: 'Tvarované', popis: 'Dva půlkruhové oblouky obejmou sklenici, láhev, trubku nebo kelímek daného průměru.',
      parametry: [
        { id: 'D', nazev: 'Průměr úchopu', min: 4, max: 200, krok: 0.5, jednotka: 'mm', vychozi: c => +omez((c.L || 20) * 1.2, 10, 90).toFixed(1) },
        { id: 'tl', nazev: 'Tloušťka oblouku', min: 1, max: 15, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.t * 0.8, 1.5, 6).toFixed(1) },
        { id: 'krcek', nazev: 'Krček', min: 0, max: 60, krok: 0.5, jednotka: 'mm', vychozi: c => +omez(c.t * 1.5, 3, 15).toFixed(1) },
        { id: 'uhel', nazev: 'Rozsah oblouku', min: 90, max: 180, krok: 5, jednotka: '°', vychozi: 170 },
        { id: 'zebra', nazev: 'Žebírka uvnitř', typ: 'prepinac', vychozi: true }],
      delka: (p, c) => {
        const R = p.D / 2, xs = Math.max(presahPro(p.krcek + 2, c.t) + 0.5, p.krcek), cx = xs + R + p.tl * 0.5;
        const g2 = (c.g || 0) / 2, a1 = Math.max(Math.PI - rad(p.uhel), Math.asin(omez((g2 + 0.01) / R, 0, 0.9)));
        return Math.max(xs + p.tl * 0.5 + 0.3, cx + (R + p.tl) * Math.cos(a1));
      },
      presah: (p, c) => presahPro(p.krcek + 2, c.t),
      stavba: (p, c, sig) => {
        const g2 = c.g / 2, R = p.D / 2;
        const presah = presahPro(p.krcek + 2, c.t);
        const xs = Math.max(presah + 0.5, p.krcek);
        // krček až do oblouku
        const krcek = standardni({ L: xs + p.tl * 0.5 + 0.3, ohyb: 0 }, c, sig, null, { profil: { konec: 'rovny' } });
        const cx = xs + R + p.tl * 0.5;
        const a0 = Math.PI - Math.asin(omez((g2 + 0.01) / R, 0, 0.9));
        const a1 = Math.max(Math.PI - rad(p.uhel), Math.asin(omez((g2 + 0.01) / R, 0, 0.9)));
        const n = Math.max(24, Math.ceil(R * (a0 - a1) / 0.8));
        const st = [];
        const zeb = p.zebra ? Math.min(0.8, p.tl * 0.3) : 0, nz = Math.max(3, Math.round(R * (a0 - a1) / 4));
        for (let k = 0; k <= n; k++) {
          const a = lerp(a0, a1, k / n);
          const er = [Math.cos(a), sig * Math.sin(a)];
          // žebírka: vlny na vnitřní ploše
          const r = zeb ? zeb * 0.5 * (1 - Math.cos(2 * Math.PI * nz * k / n)) * hladce(k / n * 8) * hladce((n - k) / n * 8) : 0;
          const w = c.w;
          st.push({ P: [cx, 0, 0], U: [er[0], er[1], 0], W: [0, 0, 1], rez: [[R + p.tl, 0], [R + p.tl, w], [R - r, w], [R - r, 0]] });
        }
        return { telesa: [krcek, J.tazeni(st, false)] };
      }
    },
    drapy: {
      nazev: 'Drápy / háčky', skupina: 'Tvarované', popis: 'Špička zahnutá do drápů (kleště na led, na cukr, na polena) – zaseknou se do předmětu.',
      parametry: [P_L, P_TK,
        { id: 'pocet', nazev: 'Počet drápů', min: 1, max: 6, krok: 1, vychozi: c => c.w > 14 ? 3 : c.w > 8 ? 2 : 1 },
        { id: 'hk', nazev: 'Délka drápu', min: 1, max: 40, krok: 0.5, jednotka: 'mm', vychozi: c => +omez(c.t * 1.6, 2, 14).toFixed(1) },
        { id: 'd', nazev: 'Zahnutí dovnitř', min: 0.3, max: 30, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.t * 0.8, 1, 8).toFixed(1) },
        { id: 'sirDrapu', nazev: 'Šířka drápu', min: 10, max: 100, krok: 5, jednotka: '%', vychozi: 60 }],
      info: (p, c) => ({ minMezera: 2 * p.d + 0.4 }),
      stavba: (p, c, sig) => {
        const g2 = c.g / 2;
        const tE = Math.max(1, c.t * p.tKonec / 100);
        const Lp = Math.max(presahPro(p.L, c.t) + 1, p.L - p.hk * 0.6);
        const deska = standardni({ L: Lp, ohyb: 0 }, c, sig, null, { profil: { konec: 'rovny', tKonec: 100 * (tE / c.t), wKonec: 100 } });
        // dráp: vnější oblouk od hřbetu ke hrotu, vnitřní zpět k ploše; při
        // krajních rozměrech se zahnutí zmenšuje, dokud se obrys nekříží
        const hk = Math.min(p.hk, Math.max(1, p.L - presahPro(p.L, c.t) - 0.5));
        const x0 = p.L - hk, n = 18;
        const drap = d => {
          const obr = [[x0 - Math.min(2, hk * 0.3), g2 + tE * 0.98]];
          for (let k = 0; k <= n; k++) {
            const a = Math.PI / 2 * (1 - k / n);
            obr.push([x0 + hk * Math.cos(a), g2 - d + (tE * 0.98 + d) * Math.sin(a)]);
          }
          for (let k = n - 1; k >= 1; k--) {
            const a = Math.PI / 2 * (1 - k / n);
            obr.push([x0 + hk * 0.45 + hk * 0.55 * Math.cos(a), g2 - d + d * Math.sin(a) * 0.999]);
          }
          obr.push([x0 + hk * 0.45, g2 + 0.001], [x0 - Math.min(2, hk * 0.3), g2 + 0.001]);
          return obr;
        };
        let d = p.d, obr = drap(d);
        for (let i = 0; i < 30 && !J.jednoduchy(obr, 1e-6); i++) { d *= 0.85; obr = drap(d); }
        const telesa = [deska];
        const k = Math.round(p.pocet), wp = Math.max(0.6, c.w / k * p.sirDrapu / 100);
        for (let i = 0; i < k; i++) {
          const z0 = k === 1 ? (c.w - wp) / 2 : (c.w - wp) * i / (k - 1);
          const d = J.deska(obr.map(q => [q[0], q[1], z0, z0 + wp]));
          telesa.push(sig > 0 ? d : J.zrcadliY(d));
        }
        return { telesa };
      }
    },
    kulate: {
      nazev: 'Kulaté (kužely)', skupina: 'Špičaté', popis: 'Kuželové čelisti na ohýbání drátu do oček a smyček; volitelně jen jedna kulatá (plocho-kulaté).',
      parametry: [P_L, P_OHYB,
        { id: 'r0', nazev: 'Průměr u kořene', min: 1, max: 30, krok: 0.1, jednotka: 'mm', vychozi: c => +Math.min(c.t, c.w).toFixed(1) },
        { id: 'r1', nazev: 'Průměr u špičky', min: 0.4, max: 20, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(Math.min(c.t, c.w) * 0.3, 0.8, 4).toFixed(1) },
        { id: 'jedna', nazev: 'Druhá čelist plochá', typ: 'prepinac', vychozi: false }],
      stavba: (p, c, sig) => {
        const L = p.L, g2 = c.g / 2, presah = presahPro(L, c.t);
        const r0 = Math.min(p.r0, c.w) / 2, r1 = Math.min(p.r1, 2 * r0) / 2;
        // ohyb omezený tak, aby se kužel (ani plochá protičelist) nepřeložil; obě čelisti stejně
        const sb = Math.max(presah + 0.5, L * 0.3), rMin = g2 + Math.max(2 * r0, c.t) + 1;
        let beta = rad(p.ohyb || 0);
        if (beta && Math.abs((L - sb) / beta) < rMin) beta = Math.sign(beta) * (L - sb) / rMin;
        if (p.jedna && sig < 0) return { telesa: [standardni({ L: p.L, konec: 'zaobleny', tKonec: 60, wKonec: 60, ohyb: p.ohyb }, c, sig, null, { betaPevna: beta })] };
        const krcek = standardni({ L: presah + 0.6, ohyb: 0 }, c, sig, null, { profil: { konec: 'rovny' } });
        const rho = beta ? (L - sb) / beta : 0;
        const st = [], n = Math.max(24, Math.ceil(L / 0.6)), vc = c.w / 2;
        for (let k = 0; k <= n; k++) {
          const s = L * k / n;
          let q = { p: [s, 0], t: [1, 0] };
          if (beta && s > sb) { const a = (s - sb) / rho; q = { p: [sb + rho * Math.sin(a), rho * (1 - Math.cos(a))], t: [Math.cos(a), Math.sin(a)] }; }
          const x = omez((s - presah) / (L - presah), 0, 1);
          let r = lerp(r0, r1, x);
          const zb = Math.min(r1 * 1.5, (L - presah) * 0.2);
          if (s > L - zb) r *= Math.sqrt(Math.max(0.04, 1 - Math.pow((s - (L - zb)) / zb, 2)));
          const nn = [-q.t[1], q.t[0]];
          st.push({ P: [q.p[0], q.p[1], 0], U: [sig * nn[0], sig * nn[1], 0], W: [0, 0, 1], rez: J.elipsa(g2 + r, vc, r, r, 28) });
        }
        return { telesa: [krcek, J.tazeni(st, false)] };
      }
    },
    polokruh: {
      nazev: 'Půlkruhový výřez', skupina: 'Výřezy', popis: 'V obou čelistech půlkruh – po zavření kruhový otvor pro trubku, tyč, kabel nebo šroub.',
      parametry: [...SPOL,
        { id: 'D', nazev: 'Průměr otvoru', min: 0.5, max: 80, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.w * 0.6, 2, 25).toFixed(1) },
        { id: 'poloha', nazev: 'Poloha výřezu', min: 10, max: 90, krok: 1, jednotka: '%', vychozi: 55 },
        { id: 'ryhy', nazev: 'Rýhy ve výřezu', typ: 'prepinac', vychozi: true }],
      kontrola: (p, c) => { const m = mistoVzoru(p, c); return p.D / 2 > m / 2 - 0.2 ? 'Otvor Ø ' + p.D + ' mm se na čelist nevejde – zmenší se na Ø ' + (2 * Math.max(0.3, m / 2 - 0.2)).toFixed(1) + ' mm. Prodlužte čelisti.' : null; },
      stavba: (p, c, sig) => ({
        telesa: [standardni(p, c, sig, (sA, sB) => {
          const R = Math.min(p.D / 2, Math.max(0.3, (sB - sA) / 2 - 0.2)), sc = lerp(sA + R, sB - R, p.poloha / 100);
          const zuby = p.ryhy ? Math.min(0.35, R * 0.12) : 0, pz = Math.max(0.8, R * 0.35);
          const zl = [];
          for (let k = 0; k <= 40; k++) zl.push(sc - R + 2 * R * k / 40);
          return {
            doplnek: false, krokS: Math.max(0.1, R / 20), zlomy: zl,
            f: s => {
              const x = s - sc; if (Math.abs(x) >= R) return 0;
              const h = Math.sqrt(R * R - x * x);
              return -h + (zuby ? zuby * (troj(Math.atan2(x, h) * R / pz + 0.25) - 0.5) * hladce((R - Math.abs(x)) / (R * 0.2)) : 0);
            },
            tl: s => { const d = Math.abs(s - sc); return d > R + 4 ? 0 : (R + 1.4 + zuby) * hladce((R + 4 - d) / 4); }
          };
        })]
      })
    },
    prizma: {
      nazev: 'Prizmatická drážka (V)', skupina: 'Výřezy', popis: 'Výřez do V – univerzálně drží kulaté předměty různých průměrů (trubky, tyče, šrouby).',
      parametry: [...SPOL,
        { id: 'B', nazev: 'Šířka drážky', min: 0.5, max: 80, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.w * 0.8, 2, 30).toFixed(1) },
        { id: 'uhelV', nazev: 'Úhel V', min: 60, max: 150, krok: 5, jednotka: '°', vychozi: 90 },
        { id: 'poloha', nazev: 'Poloha drážky', min: 10, max: 90, krok: 1, jednotka: '%', vychozi: 55 }],
      kontrola: (p, c) => { const m = mistoVzoru(p, c); return p.B / 2 > m / 2 - 0.2 ? 'Drážka ' + p.B + ' mm se na čelist nevejde – zúží se na ' + (2 * Math.max(0.3, m / 2 - 0.2)).toFixed(1) + ' mm. Prodlužte čelisti.' : null; },
      stavba: (p, c, sig) => ({
        telesa: [standardni(p, c, sig, (sA, sB) => {
          const b = Math.min(p.B / 2, Math.max(0.3, (sB - sA) / 2 - 0.2)), d = b / Math.tan(rad(p.uhelV / 2)), sc = lerp(sA + b, sB - b, p.poloha / 100);
          return {
            doplnek: false, zlomy: [sc - b, sc, sc + b], krokS: Math.max(0.2, b / 10),
            f: s => -Math.max(0, d * (1 - Math.abs(s - sc) / b)),
            tl: s => { const x = Math.abs(s - sc); return x > b + 4 ? 0 : (d + 1.4) * hladce((b + 4 - x) / 4); }
          };
        })]
      })
    },
    drazky: {
      nazev: 'Drážky na drát', skupina: 'Výřezy', popis: 'Několik příčných půlkruhových drážek – drží drát, šňůru, kabel nebo stéblo napříč.',
      parametry: [...SPOL,
        { id: 'pocet', nazev: 'Počet drážek', min: 1, max: 12, krok: 1, vychozi: 3 },
        { id: 'dg', nazev: 'Průměr drážky', min: 0.3, max: 20, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.t * 0.5, 0.8, 6).toFixed(1) }],
      kontrola: (p, c) => p.dg / 2 + 1 > c.t ? 'Drážky jsou hlubší než tloušťka čelisti – čelist se pod nimi zesílí.' : null,
      stavba: (p, c, sig) => ({
        telesa: [standardni(p, c, sig, (sA, sB) => {
          const r = p.dg / 2, k = Math.round(p.pocet), polohy = [];
          for (let i = 0; i < k; i++) polohy.push(lerp(sA + r + 0.5, sB - r - 0.3, k === 1 ? 0.5 : i / (k - 1)));
          const zl = [];
          for (const s0 of polohy) for (let j = 0; j <= 16; j++) zl.push(s0 - r + 2 * r * j / 16);
          return {
            doplnek: false, zlomy: zl, krokS: Math.max(0.08, r / 8),
            f: s => { let m = 0; for (const s0 of polohy) { const x = s - s0; if (Math.abs(x) < r) m = Math.min(m, -Math.sqrt(r * r - x * x)); } return m; },
            // pod drážkou aspoň 1 mm materiálu (i u tenké špičky) – čelist se tam zesílí
            tl: s => { let d = Infinity; for (const s0 of polohy) d = Math.min(d, Math.abs(s - s0)); return d > r + 3 ? 0 : (r + 1.0) * hladce((r + 3 - d) / 3); }
          };
        })]
      })
    },
    hreben: {
      nazev: 'Svěrací hřebínky', skupina: 'Výřezy', popis: 'Oblé příčné hřebínky proti sobě – přiškrtí hadičku, sáček nebo kabel (svorky na hadičky).',
      parametry: [...SPOL,
        { id: 'pocet', nazev: 'Počet hřebínků', min: 1, max: 6, krok: 1, vychozi: 2 },
        { id: 'hr', nazev: 'Výška hřebínku', min: 0.3, max: 10, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.t * 0.45, 0.8, 4).toFixed(1) },
        { id: 'rr', nazev: 'Poloměr hřebínku', min: 0.3, max: 15, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.t * 0.6, 1, 6).toFixed(1) }],
      info: (p, c) => ({ minMezera: 2 * p.hr + 0.3 }),
      stavba: (p, c, sig) => ({
        telesa: [standardni(p, c, sig, (sA, sB) => {
          const r = Math.max(p.rr, p.hr), k = Math.round(p.pocet), polohy = [];
          for (let i = 0; i < k; i++) polohy.push(lerp(sA + r + 0.3, sB - r - 0.3, k === 1 ? 0.5 : i / (k - 1)));
          const zl = [];
          for (const s0 of polohy) for (let j = 0; j <= 16; j++) zl.push(s0 - r + 2 * r * j / 16);
          return {
            doplnek: false, zlomy: zl, krokS: Math.max(0.1, r / 8),
            f: s => { let m = 0; for (const s0 of polohy) { const x = (s - s0) / r; if (Math.abs(x) < 1) m = Math.max(m, p.hr * Math.sqrt(1 - x * x)); } return m; },
            // výstupek smí být nejvýš 0,9·t + 2 – pod vysokým hřebínkem se čelist zesílí,
            // aby měl celou výšku (s ní počítá i nejmenší mezera čelistí)
            tl: s => { let d = Infinity; for (const s0 of polohy) d = Math.min(d, Math.abs(s - s0)); return d > r + 4 ? 0 : ((p.hr - 2) / 0.9 + 0.2) * hladce((r + 4 - d) / 4); }
          };
        })]
      })
    },
    navlek: {
      nazev: 'Měkké polštářky (TPU)', skupina: 'Ploché', popis: 'Tuhá čelist + polštářek z pružného filamentu (TPU) jako samostatný díl – neklouže a nepoškrábe.',
      parametry: [...SPOL,
        { id: 'tp', nazev: 'Tloušťka polštářku', min: 0.6, max: 8, krok: 0.1, jednotka: 'mm', vychozi: c => +omez(c.t * 0.35, 1, 3).toFixed(1) },
        { id: 'zebra', nazev: 'Žebrování polštářku', typ: 'prepinac', vychozi: true }],
      kontrola: (p, c) => p.tp + 0.8 > c.t ? 'Polštářek je skoro tak tlustý jako čelist – tuhá část by byla příliš tenká.' : null,
      stavba: (p, c, sig) => {
        const tuha = standardni(p, c, sig, null, { uPlochy: p.tp, profil: { tl: null } });
        // tuhá čelist: plocha je odsunutá o tp (polštářek vyplní mezeru)
        const presah = presahPro(p.L, c.t);
        const pr = profil(p, c, p.L, presah);
        const s0 = presah + 0.6, s1 = p.L - Math.max(0.3, pr.kraj * 0.6);
        const pz = Math.max(0.8, p.tp * 1.2);
        // polštářek sleduje stejnou (případně zahnutou) osu jako čelist
        const pol = tazena({
          L: s1, sZac: s0, Lohyb: p.L, c, sig, presah, ohyb: p.ohyb, betaPevna: tuha.beta,
          tl: () => p.tp, sir: s => Math.max(0.35, pr.sir(s) - 0.2),
          rel: p.zebra ? (s => sig * Math.min(0.3, p.tp * 0.25) * (troj((s - s0) / pz + 0.25) - 0.5) * hladce((s - s0) / pz) * hladce((s1 - s) / pz)) : null,
          krokS: pz / 4, zlomy: []
        });
        return { telesa: [tuha], tpu: [J.posun(pol, 0, 0, 0.1)] };
      }
    }
  };

  // délka čelisti od kořene ke špičce (kvůli rozměrům nástroje)
  function delka(id, p, c) {
    const C = CELISTI[id];
    return C.delka ? C.delka(p, c) : p.L;
  }
  function info(id, p, c) {
    const C = CELISTI[id];
    const i = C.info ? C.info(p, c) : {};
    return { minMezera: i.minMezera || 0, presah: C.presah ? C.presah(p, c) : presahPro(p.L, c.t), delka: delka(id, p, c) };
  }

  /* Výchozí hodnoty parametrů čelisti pro daný nástroj (c = {t, w, L}). */
  function vychozi(id, c) {
    const o = {};
    for (const q of CELISTI[id].parametry) o[q.id] = typeof q.vychozi === 'function' ? q.vychozi(c) : q.vychozi;
    return o;
  }

  function kontrolaCelisti(id, p, c) {
    const C = CELISTI[id];
    return C.kontrola ? C.kontrola(p, c) : null;
  }

  /* Postaví čelist pro stranu sig. Ohyb u navlek/okenko/oblouk/drapy se nepoužije. */
  function postav(id, p, c, sig) {
    const C = CELISTI[id];
    const out = C.stavba(p, c, sig);
    out.tpu = out.tpu || [];
    return out;
  }

  const KC = { CELISTI, postav, info, vychozi, delka, kontrolaCelisti, presahPro };
  koren.KC = KC;
  if (typeof module !== 'undefined' && module.exports) module.exports = KC;
})(typeof window !== 'undefined' ? window : globalThis);
