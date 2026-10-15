/* ============================================================
   Kleště, pinzety a svorky — konstrukce nástrojů a předvolby.

   Pět konstrukcí (generátorů), každá v „zavřené“ poloze: čelisti
   začínají v x = 0 a rozhraní mezi nimi je osa x.
     vidlice  – pinzeta / kleště na topinky: hlava se štěrbinou a dvě
                pružná ramena (jedna deska), rozevřou se ohybem u hlavy,
     krizova  – reverzní pinzeta a svorka: ramena se kříží, v klidu je
                zavřená, stiskem se otevře; v místě křížení jsou ramena
                v půlce výšky nad sebou s vůlí,
     smycka   – kuchyňské kleště s pružným okem vzadu; volitelně
                rohatka na konci (svorka na hadičky),
     nuzky    – dva díly na čepu tištěné najednou (peán, jehelec, kleště
                na led, na sklenice, kombinačky…), kroužky nebo rukojeti,
                volitelně rohatka,
     klip     – klip na sáčky: čelisti přes celou délku, pant z tenkého
                pásku a západka.

   stavba(p, cel, theta) → { casti: [{nazev, role, telesa}], varovani,
   info }. theta = rozevření pro náhled (stupně; u křížové stisk).
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.KJ || require('./jadro.js');
  const KC = koren.KC || require('./celisti.js');
  const { lerp, omez, hladce, rad, zlomek } = J;
  const EPS = 0.012;

  /* ---------------- čelisti s mezipamětí ---------------- */
  const pamet = new Map();
  // uhelSpicek (°): čelisti se k sobě sbíhají – A se natočí kolem bodu u své
  // špičky o −β, B o +β (β = polovina úhlu); mezera ve špičce zůstane, u kořene
  // se otevře, takže při stisku se nejdřív dotknou špičky
  function celisti(cel, c, mezeraUziv, uhelSpicek) {
    const inf = KC.info(cel.id, cel.p, c);
    const g = Math.max(mezeraUziv || 0, inf.minMezera);
    const cc = { t: c.t, w: c.w, g, L: c.L };
    const klic = JSON.stringify([cel.id, cel.p, cc]);
    let r = pamet.get(klic);
    if (!r) {
      r = { A: KC.postav(cel.id, cel.p, cc, 1), B: KC.postav(cel.id, cel.p, cc, -1) };
      for (const t of r.A.telesa) t.celist = 'A';
      for (const t of r.B.telesa) t.celist = 'B';
      pamet.set(klic, r);
      if (pamet.size > 40) pamet.delete(pamet.keys().next().value);
    }
    // špička = konec osy rozhraní (u zahnutých čelistí není na ose x)
    // (krček tvarovaných čelistí má vlastní krátkou osu – ten se nepočítá)
    let spicka = [inf.delka, 0];
    // jen těleso, které jde po celé délce čelisti (délka po ose; u zahnutých
    // čelistí je konec blíž počátku, deska drápů nebo krček je kratší)
    for (const t of r.A.telesa) if (t.spicka && t.spickaS >= 0.95 * inf.delka) spicka = t.spicka;
    return { A: r.A, B: r.B, g, presah: inf.presah, delka: inf.delka, spicka, kontrola: KC.kontrolaCelisti(cel.id, cel.p, cc), beta: rad(uhelSpicek || 0) / 2 };
  }
  // předpětí špiček strany sig (+1 = A nahoře, −1 = B dole) v zavřené soustavě čelistí
  const stredSpicky = (cj, sig) => [cj.spicka[0], cj.spicka[1] + sig * cj.g / 2];
  const spicky = (cj, sig) => q => cj && cj.beta ? J.otoc2(q, stredSpicky(cj, sig), -sig * cj.beta) : q;
  // tělesa čelisti: předpětí špiček, pak úhel čelistí α (kolem počátku)
  const natocCelist = (tt, cj, sig, alfa) => otocVse(cj && cj.beta ? otocVse(tt, stredSpicky(cj, sig), -sig * cj.beta) : tt, [0, 0], alfa);

  const otocVse = (tt, s, u) => tt.map(t => J.otocTeleso(t, s, u));

  // vroubky úchopu: oblé hrbolky v pásmu [x0, x1]
  function vroubky(n, hl, x0, x1) {
    if (!(n > 0) || !(hl > 0) || x1 <= x0) return { f: () => 0, zlomy: [] };
    const pv = (x1 - x0) / n, zlomy = [];
    hl = Math.min(hl, pv * 0.5);
    for (let k = 0; k <= n * 10; k++) zlomy.push(x0 + pv * k / 10);
    return { f: x => (x <= x0 || x >= x1) ? 0 : hl * Math.pow(Math.sin(Math.PI * (x - x0) / pv), 2), zlomy };
  }

  // otvor na pověšení (kruh jako díra desky)
  function kruhDira(cx, cy, r, a, b, n) {
    const out = [];
    n = n || 40;
    for (let k = 0; k < n; k++) { const u = 2 * Math.PI * k / n; out.push([cx + r * Math.cos(u), cy + r * Math.sin(u), a, b]); }
    return out;
  }

  /* Uzavřený kroužek (rukojeť) tažením obdélníku po kružnici. */
  function krouzek(cx, cy, rc, tr, w, n) {
    n = n || 64;
    const st = [];
    for (let k = 0; k < n; k++) {
      const a = 2 * Math.PI * k / n, e = [Math.cos(a), Math.sin(a)];
      st.push({ P: [cx, cy, 0], U: [e[0], e[1], 0], W: [0, 0, 1], rez: J.obdelnik(rc - tr / 2, rc + tr / 2, 0, w, Math.min(1.2, tr * 0.3, w * 0.25), 4) });
    }
    return J.tazeni(st, true);
  }

  /* Průřez ramen z parametru p.prurez (null = obdélník). */
  function tvarRamen(p, war) {
    // (volá se u všech ramenných nástrojů – hlídá i hodnoty „uprostřed“)
    if (p.tlStred > 0 && p.tlStred < 1.2) war.push('Tloušťka uprostřed ramene ' + p.tlStred + ' mm je na tisk příliš malá (rameno se zlomí) – nastavte aspoň 1,2 mm, nebo 0 = plynule.');
    if (p.sirStred > 0 && p.sirStred < 2.5) war.push('Šířka uprostřed ramene ' + p.sirStred + ' mm je na tisk příliš malá – nastavte aspoň 2,5 mm, nebo 0 = plynule.');
    if (!p.prurez || !p.prurez.kotvy) return null;
    const r = J.vzorkujPrurez(p.prurez, 56);
    if (!r) { war.push('Vlastní průřez ramen se sám kříží – použit obdélník. Upravte body v návrháři průřezu.'); return null; }
    return r;
  }
  /* Body průřezu: obdélník, nebo vlastní tvar do stejného rámečku.
     ven = ±1 strana osy U, kde je vnější (úchopová) strana; vr = vroubek. */
  function rezPasu(tvar, u0, u1, v0, v1, ven, vr, k, zaobl) {
    if (!tvar) {
      const a0 = u0 - (ven < 0 ? vr || 0 : 0), a1 = u1 + (ven > 0 ? vr || 0 : 0);
      // zaoblené hrany: k čelisti se zaoblení plynule ztrácí (počet bodů stejný)
      if (zaobl > 0) return J.obdelnik(a0, a1, v0, v1, Math.max(0.02, zaobl * (1 - (k || 0))), 4);
      return J.obdelnik(a0, a1, v0, v1, 0, 1);
    }
    return J.rezRamene(tvar, u0, u1, v0, v1, ven, vr || 0, k || 0);
  }
  // stanice pásu s průřezem ramen: fn(i) → {u0, u1, v0, v1, ven, vr}
  const pasTvar = (tvar, zaobl) => (P, fn) => J.pasPoKrivce(P, i => { const q = fn(i); return { rez: rezPasu(tvar, q.u0, q.u1, q.v0, q.v1, q.ven || 1, q.vr || 0, q.k || 0, zaobl || 0) }; }, 0, 1);

  /* ---------- společné pro ramena ---------- */
  // průběh veličiny po délce ramene f ∈ ⟨0; 1⟩: lineárně a → b, případně
  // s jinou hodnotou uprostřed (stred > 0) v poměrné poloze poloha
  // (dolní mez: uprostřed nejméně 0,8 mm, nebo kraje, jsou-li tenčí – tenčí rameno se nevytiskne a průřez se přeloží)
  // (u čelisti, f = 1, dobíhá s nulovým sklonem – plocha ramene přejde do čelisti bez zlomu)
  function prubeh(a, b, stred, poloha) {
    const bmp = prohnuti(1, poloha), min = Math.min(0.8, a, b), nab = 0.25;
    const e = f => { const y = 1 - f; return 1 - (y < nab ? y * y / (2 * nab) : y - nab / 2) / (1 - nab / 2); };
    return f => Math.max(min, lerp(a, b, e(omez(f, 0, 1))) + (stred > 0 ? (stred - lerp(a, b, poloha)) * bmp(f) : 0));
  }
  // konec ramene u čelisti (osa ramene v y = yc; yc > 0 horní strana A, < 0 dolní B),
  // čelist s předpětím špiček (cj.beta) a natočená o alfa
  // zrc = rameno B stavěné jako horní a pak zrcadlené: střed předpětí je zrcadlem
  // středu čelisti B (u zahnutých čelistí není B zrcadlem A)
  function konecRamene(yc, ov, alfa, cj, zrc) {
    const sig = yc < 0 ? -1 : 1, b = cj && cj.beta ? -sig * cj.beta : 0;
    const T = zrc && cj && cj.beta ? (q => { const c = stredSpicky(cj, -1); return J.otoc2(q, [c[0], -c[1]], -cj.beta); }) : spicky(cj, sig);
    const R = q => J.otoc2(T(q), [0, 0], alfa);
    return { koren: R([0, yc]), stred: R([ov / 2, yc]), konec: R([ov, yc]), smer: J.otocV2([1, 0], alfa + b) };
  }
  // prolnutí průřezu ramene do obdélníku čelisti: d = vzdálenost od kořene čelisti
  const prolnuti = (d, Lp) => d <= 0 ? 1 : Lp > 0 ? hladce(1 - d / Lp) : 0;
  // indexy a vzdálenost bodů lomené čáry od bodu Q (nejbližší bod = kořen)
  /* Osa ramene končící v čelisti (…, kořen, střed, konec): přesně v kořeni
     stanice a hned za ní (0,08 mm) druhá. Rameno je v čelisti o EPS menší;
     kdyby se zmenšovalo po delším úseku, plochy ramene a čelisti by se tam
     protínaly pod malým úhlem a v náhledu by byl vidět šev. */
  function ostryKoren(P, K) {
    const L = Math.hypot(K.konec[0] - K.koren[0], K.konec[1] - K.koren[1]) || 1;
    const s = [(K.konec[0] - K.koren[0]) / L, (K.konec[1] - K.koren[1]) / L];
    const dot = q => (q[0] - K.koren[0]) * s[0] + (q[1] - K.koren[1]) * s[1];
    let i = P.length;
    while (i > 0 && dot(P[i - 1]) > -0.15) i--;
    // druhá stanice dál, když osa v kořeni lomí (jinak se vnitřní strana
    // průřezu o tloušťce až ~6 mm na krátkém úseku přeloží dozadu)
    let d2 = 0.08;
    if (i > 0) {
      const q = P[i - 1], l = Math.hypot(K.koren[0] - q[0], K.koren[1] - q[1]) || 1;
      const sinZlom = Math.abs(((K.koren[0] - q[0]) * s[1] - (K.koren[1] - q[1]) * s[0]) / l);
      d2 = Math.min(0.8, 0.08 + 6 * sinZlom);
    }
    return P.slice(0, i).concat([K.koren.slice(), [K.koren[0] + d2 * s[0], K.koren[1] + d2 * s[1]]], P.slice(i).filter(q => dot(q) > d2 + 0.2));
  }
  function vzdalenostOd(P, S, Q) {
    let iq = 0, m = Infinity;
    P.forEach((q, i) => { const d = Math.hypot(q[0] - Q[0], q[1] - Q[1]); if (d < m) { m = d; iq = i; } });
    return { iq, d: i => S[iq] - S[i] };
  }
  const P_PRUREZ = [
    { id: 'tlStred', nazev: 'Tloušťka uprostřed ramene', min: 0, max: 30, krok: 0.1, jednotka: 'mm', vychozi: 0, skupina: 'prurez',
      napoveda: '0 = plynule mezi koncovými tloušťkami. Větší hodnota rameno uprostřed zpevní, menší ho změkčí. U nůžek s rovnými rukojeťmi se rukojeť nezúží pod jejich zesílení.' },
    { id: 'sirStred', nazev: 'Šířka uprostřed ramene', min: 0, max: 80, krok: 0.5, jednotka: 'mm', vychozi: 0, skupina: 'prurez',
      napoveda: '0 = plynule. Šířka je výška ramene při tisku naležato.' },
    { id: 'polohaStredu', nazev: 'Místo „uprostřed“', min: 15, max: 85, krok: 1, jednotka: '% délky', vychozi: 50, skupina: 'prurez' },
    { id: 'zaobleniHran', nazev: 'Zaoblení hran ramene', min: 0, max: 6, krok: 0.1, jednotka: 'mm', vychozi: 0, skupina: 'prurez',
      napoveda: 'Platí pro obdélníkový průřez; u vlastního tvaru určuje zaoblení křivka.' }
  ];
  const P_CELIST = [
    { id: 'uhelSpicek', nazev: 'Předpětí špiček', min: 0, max: 10, krok: 0.25, jednotka: '°', vychozi: 0, skupina: 'celist',
      napoveda: 'Čelisti se k sobě sbíhají o tento úhel: při stisku se nejdřív dotknou špičky a až s větší silou zbytek – největší přítlak je ve špičkách. Obvykle 1–3°. 0 = rovnoběžné čelisti.' },
    { id: 'uhelCelisti', nazev: 'Úhel čelistí k ramenům', min: -75, max: 75, krok: 1, jednotka: '°', vychozi: 0, skupina: 'celist',
      napoveda: 'Natočí obě čelisti v rovině nástroje (zahnuté pinzety a kleště). Čelisti se dál dotýkají.' },
    { id: 'prechod', nazev: 'Délka přechodu rameno → čelist', min: 0, max: 60, krok: 0.5, jednotka: 'mm', vychozi: 6, skupina: 'celist',
      napoveda: 'Na této délce se osa ramene plynule stočí do čelisti a průřez se prolne do průřezu čelisti.' }
  ];

  /* Prohnutí ramene: 0 na koncích (bez zlomu), vrchol h v poměrné poloze a. */
  function prohnuti(h, a) {
    a = omez(a, 0.1, 0.9);
    return f => !h ? 0 : f <= 0 || f >= 1 ? 0 : f < a ? h * hladce(f / a) : h * hladce((1 - f) / (1 - a));
  }
  /* Prohnutí ramen až ve třech vrcholech: křivka prochází body (0, 0),
     (poloha_i, výška_i) a (1, 0) a mezi nimi se plynule prolíná (v každém
     vrcholu i na koncích má nulový sklon). Nulové vrcholy 2 a 3 se vynechají. */
  function prohnutiVice(p) {
    // jen nenulové vrcholy (nulový by křivku v tom místě stáhl k nule);
    // výchozí polohy jako ve specifikaci parametrů
    const v = [];
    if (p.prohnuti) v.push([(p.vrchol || 45) / 100, p.prohnuti]);
    if (p.prohnuti2) v.push([(p.vrchol2 || 70) / 100, p.prohnuti2]);
    if (p.prohnuti3) v.push([(p.vrchol3 || 20) / 100, p.prohnuti3]);
    const K = [[0, 0]].concat(v.map(([a, h]) => [omez(a, 0.05, 0.95), h]).sort((a, b) => a[0] - b[0]), [[1, 0]]);
    if (K.every(k => !k[1])) return () => 0;
    return f => {
      if (f <= 0 || f >= 1) return 0;
      let i = 0;
      while (i < K.length - 2 && f > K[i + 1][0]) i++;
      const a = K[i], b = K[i + 1];
      return b[0] - a[0] < 1e-9 ? b[1] : lerp(a[1], b[1], hladce((f - a[0]) / (b[0] - a[0])));
    };
  }
  /* Prohnutí ramen Bézierovou křivkou: kotvy {p: [f, h], a, b} – f = poloha
     po délce ramene (0 spoj, 1 čelist), h = prohnutí ven v mm; úchyty a/b
     relativně. Úseky mají kontrolní body s rostoucím f, takže f(t) je
     monotónní a křivka je funkcí polohy. Bez křivky se odvodí z vrcholů. */
  function krivkaZVrcholu(p) {
    const v = [[(p.vrchol || 45) / 100, p.prohnuti || 0]];
    if (p.prohnuti2) v.push([(p.vrchol2 || 70) / 100, p.prohnuti2]);
    if (p.prohnuti3) v.push([(p.vrchol3 || 20) / 100, p.prohnuti3]);
    const B = [[0, 0]].concat(v.filter(q => q[1]).map(([a, h]) => [omez(a, 0.05, 0.95), h]).sort((a, b) => a[0] - b[0]), [[1, 0]]);
    return { kotvy: B.map((q, i) => {
      const l = i > 0 ? (q[0] - B[i - 1][0]) / 3 : 0, r = i < B.length - 1 ? (B[i + 1][0] - q[0]) / 3 : 0;
      return { p: q.slice(), a: [-l, 0], b: [r, 0] };
    }) };
  }
  function prohnutiKrivkou(kr) {
    const K = kr.kotvy.slice().sort((a, b) => a.p[0] - b.p[0]);
    const X = [], Y = [];
    for (let i = 0; i + 1 < K.length; i++) {
      const A = K[i], C = K[i + 1], x0 = A.p[0], x3 = C.p[0];
      const P = [A.p, [omez(A.p[0] + A.b[0], x0, x3), A.p[1] + A.b[1]], [omez(C.p[0] + C.a[0], x0, x3), C.p[1] + C.a[1]], C.p];
      for (let k = i ? 1 : 0; k <= 48; k++) { const q = J.bez(P[0], P[1], P[2], P[3], k / 48); X.push(Math.max(q[0], X.length ? X[X.length - 1] : -Infinity)); Y.push(q[1]); }
    }
    return f => {
      if (!(f > X[0])) return Y[0];
      if (!(f < X[X.length - 1])) return Y[Y.length - 1];
      let lo = 0, hi = X.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (X[m] <= f) lo = m; else hi = m; }
      return X[hi] - X[lo] < 1e-12 ? Y[hi] : lerp(Y[lo], Y[hi], (f - X[lo]) / (X[hi] - X[lo]));
    };
  }
  const prohnutiRamen = p => (p.prohnutiKrivka && p.prohnutiKrivka.kotvy && p.prohnutiKrivka.kotvy.length >= 2) ? prohnutiKrivkou(p.prohnutiKrivka) : prohnutiVice(p);
  const P_PROHNUTI = (vych) => ({ id: 'prohnuti', nazev: 'Prohnutí ramen od sebe', min: 0, max: 60, krok: 0.5, jednotka: 'mm', vychozi: vych, skupina: 'prohnuti', skryty: true,
    napoveda: 'O kolik se každé rameno vyklene ven. Při stisku se pak dřív dotknou čelisti než ramena.' });
  const P_VRCHOL = { id: 'vrchol', nazev: 'Poloha 1. vrcholu', min: 5, max: 95, krok: 1, jednotka: '% od spoje', vychozi: 45, skupina: 'prohnuti', skryty: true };
  const P_VRCHOLY23 = [
    { id: 'prohnuti2', skryty: true, nazev: 'Prohnutí ve 2. vrcholu', min: -10, max: 60, krok: 0.5, jednotka: 'mm', vychozi: 0, skupina: 'prohnuti', napoveda: '0 = vrchol se nepoužije. Záporná hodnota rameno v tom místě prohne dovnitř.' },
    { id: 'vrchol2', skryty: true, nazev: 'Poloha 2. vrcholu', min: 5, max: 95, krok: 1, jednotka: '% od spoje', vychozi: 70, skupina: 'prohnuti', kdy: p => !!p.prohnuti2 },
    { id: 'prohnuti3', skryty: true, nazev: 'Prohnutí ve 3. vrcholu', min: -10, max: 60, krok: 0.5, jednotka: 'mm', vychozi: 0, skupina: 'prohnuti' },
    { id: 'vrchol3', skryty: true, nazev: 'Poloha 3. vrcholu', min: 5, max: 95, krok: 1, jednotka: '% od spoje', vychozi: 20, skupina: 'prohnuti', kdy: p => !!p.prohnuti3 }
  ];
  // starší názvy spojů (oblouk → oko, dvojitý oblouk → dvojité oko)
  const typSpoje = p => ({ oblouk: 'oko', dvojity: 'dvojite' })[p.spoj] || p.spoj || 'hlava';

  /* Otočení stanic (poloha i osa U) – pro ohyb pružné části. uhel(i) */
  function ohniStanice(st, stred, uhel) {
    return st.map((s, i) => {
      const u = uhel(i);
      if (!u) return s;
      const q = J.otoc2(s.P, stred, u), v = J.otocV2(s.U, u);
      return { P: [q[0], q[1], s.P[2]], U: [v[0], v[1], 0], W: s.W, rez: s.rez };
    });
  }
  const zrcadliStanice = st => st.map(s => ({ P: [s.P[0], -s.P[1], s.P[2]], U: [s.U[0], -s.U[1], 0], W: s.W, rez: s.rez }));
  const otocStanice = (st, stred, u) => ohniStanice(st, stred, () => u);

  /* ==================================================================
     VIDLICE – pinzeta / kleště na topinky
     ================================================================== */
  const P_TISK = (vych, max) => ({ id: 'otevreni', nazev: 'Rozevření při tisku', min: 2, max: max || 60, krok: 0.5, jednotka: '°', vychozi: vych, skupina: 'tisk',
    napoveda: 'Úhel mezi rameny, ve kterém se nástroj tiskne (pružné nástroje v něm zůstanou v klidu, kloubové se jen v této poloze tisknou).' });
  const P_MEZERA = { id: 'mezera', nazev: 'Mezera mezi čelistmi', min: 0, max: 20, krok: 0.05, jednotka: 'mm', vychozi: 0,
    napoveda: 'Mezera v zavřené poloze. Některé čelisti (drápy, hřebínky) si ji samy zvětší, aby do sebe nenarazily.' };

  const vidlice = {
    nazev: 'Pinzeta s hlavou',
    rozestup: (p, cel) => zakladVidlice(p, cel),
    parametry: [
      { id: 'L', nazev: 'Celková délka', min: 30, max: 450, krok: 1, jednotka: 'mm', vychozi: 120 },
      { id: 'tb', nazev: 'Tloušťka ramene u spoje', min: 0.8, max: 15, krok: 0.1, jednotka: 'mm', vychozi: 2.4, skupina: 'prurez' },
      { id: 't', nazev: 'Tloušťka ramene u čelisti', min: 0.8, max: 15, krok: 0.1, jednotka: 'mm', vychozi: 2, skupina: 'prurez' },
      { id: 'wb', nazev: 'Šířka ramene u spoje', min: 2, max: 60, krok: 0.5, jednotka: 'mm', vychozi: 10, skupina: 'prurez' },
      { id: 'w', nazev: 'Šířka ramene u čelisti', min: 2, max: 60, krok: 0.5, jednotka: 'mm', vychozi: 8, skupina: 'prurez' },
      ...P_PRUREZ, ...P_CELIST,
      { id: 'rs', skryty: true, nazev: 'Poloměr štěrbiny', min: 0.4, max: 20, krok: 0.1, jednotka: 'mm', vychozi: 2, napoveda: 'Polovina vnitřní mezery mezi rameny u spoje.' },
      { id: 'spoj', nazev: 'Spojení ramen', typ: 'volba', vychozi: 'hlava', skupina: 'spoj',
        volby: [['hlava', 'hlava se štěrbinou (standard)'], ['oko', 'oko – větší rozsah'], ['dvojite', 'dvojité oko – větší síla'], ['meandr', 'meandrová pružina – nejměkčí']],
        napoveda: 'Hlava: ramena se ohýbají u hlavy. Pružinové spoje: ramena jsou tuhá a pruží pásek vzadu – podle tvaru větší rozsah nebo větší síla.' },
      { id: 'nabehHlavy', nazev: 'Plynulý náběh do hlavy', min: 0, max: 10, krok: 0.1, jednotka: 'mm', vychozi: 1.5, skupina: 'spoj', kdy: p => typSpoje(p) === 'hlava',
        napoveda: 'O kolik se rameno u hlavy zaobleně rozšíří – plynulý přechod místo ostrého rohu (a pevnější kořen ramene).' },
      { id: 'Lb', nazev: 'Délka hlavy', min: 4, max: 80, krok: 0.5, jednotka: 'mm', vychozi: 16, skupina: 'spoj', kdy: p => typSpoje(p) === 'hlava' },
      { id: 'zakonceni', nazev: 'Zakončení hlavy', typ: 'volba', vychozi: 'oble', volby: [['oble', 'oblé'], ['rovne', 'rovné'], ['spicate', 'špičaté']], skupina: 'spoj', kdy: p => typSpoje(p) === 'hlava' },
      { id: 'pruzna', nazev: 'Délka pružné části', min: 10, max: 90, krok: 1, jednotka: '% ramen', vychozi: 40, skupina: 'spoj', kdy: p => typSpoje(p) === 'hlava' },
      { id: 'otvor', nazev: 'Otvor na pověšení', min: 0, max: 20, krok: 0.5, jednotka: 'mm', vychozi: 0, skupina: 'spoj', kdy: p => typSpoje(p) === 'hlava' },
      { id: 'tSpoj', nazev: 'Tloušťka pružného pásku', min: 0.6, max: 10, krok: 0.1, jednotka: 'mm', vychozi: 1.6, skupina: 'spoj', kdy: p => typSpoje(p) !== 'hlava',
        napoveda: 'Tenčí = měkčí a větší rozsah, tlustší = větší síla čelistí.' },
      { id: 'Rspoj', nazev: 'Poloměr oka', min: 2, max: 60, krok: 0.5, jednotka: 'mm', vychozi: 7, skupina: 'spoj', kdy: p => ['oko', 'dvojite'].includes(typSpoje(p)) },
      { id: 'uhelOka', nazev: 'Úhel, který opisuje oko', min: 120, max: 340, krok: 5, jednotka: '°', vychozi: 270, skupina: 'spoj', kdy: p => ['oko', 'dvojite'].includes(typSpoje(p)),
        napoveda: '180° = půlkruh; víc = uzavřenější oko s delším páskem (měkčí, větší rozsah), méně = mělký oblouk (tužší).' },
      { id: 'protazeni', nazev: 'Protažení oka', min: 40, max: 250, krok: 5, jednotka: '%', vychozi: 100, skupina: 'spoj', kdy: p => ['oko', 'dvojite'].includes(typSpoje(p)),
        napoveda: '100 % = kruhové; víc = protáhlé dozadu (elipsa), méně = zploštělé.' },
      { id: 'mezSpoj', nazev: 'Mezera mezi oky', min: 0.4, max: 15, krok: 0.1, jednotka: 'mm', vychozi: 1.2, skupina: 'spoj', kdy: p => typSpoje(p) === 'dvojite' },
      { id: 'zavity', nazev: 'Počet závitů meandru', min: 1, max: 6, krok: 1, vychozi: 2, skupina: 'spoj', kdy: p => p.spoj === 'meandr' },
      { id: 'delkaSpoje', nazev: 'Délka meandru', min: 3, max: 80, krok: 0.5, jednotka: 'mm', vychozi: 10, skupina: 'spoj', kdy: p => p.spoj === 'meandr' },
      { id: 'pruzina', nazev: 'Vnitřní vzpěrná pružina', typ: 'prepinac', vychozi: false, skupina: 'pruzina',
        napoveda: 'Oblouček mezi rameny, který se při stisku stlačí – čelisti drží větší silou a pinzeta se sama rozevře.' },
      { id: 'pruzinaPoloha', nazev: 'Poloha pružiny', min: 10, max: 85, krok: 1, jednotka: '% ramen', vychozi: 30, skupina: 'pruzina' },
      { id: 'pruzinaT', nazev: 'Tloušťka pružiny', min: 0.4, max: 6, krok: 0.05, jednotka: 'mm', vychozi: 0.9, skupina: 'pruzina' },
      { id: 'pruzinaHloubka', nazev: 'Prohnutí pružiny', min: 1, max: 80, krok: 0.5, jednotka: 'mm', vychozi: 8, skupina: 'pruzina' },
      { id: 'vroubky', nazev: 'Vroubky úchopu', min: 0, max: 30, krok: 1, vychozi: 8, skupina: 'uchop' },
      { id: 'hlVroubku', nazev: 'Výška vroubků', min: 0, max: 3, krok: 0.05, jednotka: 'mm', vychozi: 0.4, skupina: 'uchop' },
      { id: 'uchopOd', nazev: 'Úchop od', min: 0, max: 95, krok: 1, jednotka: '% ramen', vychozi: 35, skupina: 'uchop' },
      { id: 'uchopDo', nazev: 'Úchop do', min: 5, max: 100, krok: 1, jednotka: '% ramen', vychozi: 70, skupina: 'uchop' },
      P_PROHNUTI(1.5), P_VRCHOL, ...P_VRCHOLY23,
      { id: 'rozevreni', nazev: 'Rozevření ramen (úhel)', min: 0, max: 90, krok: 0.5, jednotka: '°', vychozi: 0, skupina: 'prohnuti',
        napoveda: 'Úhel, o který jsou ramena v klidu (= největší rozevření bez násilí). 0 = podle rozestupu u čelistí v editoru; zadaný úhel přepočítá 3. bod.' },

      P_MEZERA,
      { id: 'zamek', nazev: 'Zámkový kroužek', typ: 'prepinac', vychozi: false, skupina: 'zamek',
        napoveda: 'Samostatně tištěný rámeček; nasunutý k čelistem pinzetu zamkne.' },
      { id: 'zamekPoloha', nazev: 'Poloha kroužku', min: 20, max: 95, krok: 1, jednotka: '% ramen', vychozi: 80, skupina: 'zamek' },
      { id: 'vule', nazev: 'Vůle kroužku', min: 0, max: 1.5, krok: 0.05, jednotka: 'mm', vychozi: 0.25, skupina: 'zamek' },
      Object.assign(P_TISK(14), { skryty: true })
    ],
    // rozevření při tisku plyne z rozestupu ramen u čelistí
    pohyb: (p, cel) => { const th = cel ? zakladVidlice(p, cel).thR : p.otevreni; return { min: 0, max: Math.max(th * 1.4, 10), tisk: th, nazev: 'Rozevření' }; },
    stavba(p, cel, theta) {
      // tištěný (klidový) tvar je dán rozestupem ramen; theta = zobrazené rozevření
      const B = zakladVidlice(p, cel), war = B.war.slice();
      const { cj, g, ov, spoj, hlava, rs, Hb2, yk, tj, S, La, xp, xc, C, Lf, fi, f, PA, Sg } = B;
      const thR = B.thR, dl = rad(theta - thR) / 2;          // natočení z tištěného tvaru
      const ur = vroubky(p.vroubky, p.hlVroubku, xp + La * p.uchopOd / 100, xp + La * Math.max(p.uchopOd + 1, p.uchopDo) / 100);
      // vzorky po délce ramen
      let X = [];
      const n = Math.max(40, Math.ceil(La / 0.8));
      for (let i = 0; i <= n; i++) X.push(xp + La * i / n);
      for (let i = 1; i <= 6; i++) X.push(ov * i / 6);
      X = X.concat(ur.zlomy.filter(x => x > xp && x < 0));
      X.sort((a, b) => a - b);
      X = X.filter((x, i) => i === 0 || x - X[i - 1] > 0.05);
      // šířka ramene v místě x (i se šířkou uprostřed) – podle ní kroužek zámku a pružina
      const zb = x => x <= 0 ? wF(f(x)) : p.w;
      // plynulý náběh: rameno se u hlavy zaobleně rozšíří ven, hlava je o tolik vyšší
      const F = hlava ? Math.max(0, p.nabehHlavy == null ? 1.5 : p.nabehHlavy) : 0, Hh = Hb2 + F;
      const Lfl = Math.max(3, 3 * F + p.tb);
      const nabehH = x => F * (1 - hladce((x - xp) / Lfl));
      // hlava; když se do ní štěrbina nevejde, hlava se prodlouží
      const zad = Lb => {
        const H = [];
        if (p.zakonceni === 'rovne') H.push([xp - Lb, Hh], [xp - Lb, -Hh]);
        else if (p.zakonceni === 'spicate') H.push([xp - Lb * 0.45, Hh], [xp - Lb, 0], [xp - Lb * 0.45, -Hh]);
        else {
          const Rx = Math.min(Lb, Hh) * 0.95, cx = xp - Lb + Rx;
          for (let k = 0; k <= 24; k++) { const a = Math.PI / 2 + Math.PI * k / 24; H.push([cx + Rx * Math.cos(a), Hh * Math.sin(a)]); }
        }
        return H;
      };
      let Lb = hlava ? p.Lb : S.pk;
      const sterbina = [];
      for (let k = 0; k <= 16; k++) { const a = Math.PI / 2 + Math.PI * k / 16; sterbina.push([xp + rs * Math.cos(a), rs * Math.sin(a)]); }
      const vejde = Lb => {
        const H = [[xp, Hh]].concat(zad(Lb), [[xp, -Hh]]);
        return sterbina.every(q => J.uvnitr2(q, H) || q[0] >= xp - 1e-9) && sterbina.every(q => {
          let m = Infinity;
          for (let i = 0; i + 1 < H.length; i++) m = Math.min(m, J.vzdUsecek(q, q, H[i], H[i + 1]));
          return m >= Math.min(1, p.tb * 0.8);
        });
      };
      for (let i = 0; hlava && i < 80 && !vejde(Lb); i++) Lb += 1;
      if (Lb > p.Lb) war.push('Hlava prodloužena na ' + Lb.toFixed(0) + ' mm, aby se do ní vešla štěrbina mezi rameny.');
      // hlava = deska se štěrbinou; ramena do ní zasahují
      const O = [[xp, Hh, 0, p.wb]];
      for (const q of zad(Lb)) O.push([q[0], q[1], 0, p.wb]);
      O.push([xp, -Hh, 0, p.wb], [xp, -rs, 0, p.wb]);
      for (let k = 1; k < 16; k++) { const a = -Math.PI / 2 - Math.PI * k / 16; O.push([xp + rs * Math.cos(a), rs * Math.sin(a), 0, p.wb]); }
      O.push([xp, rs, 0, p.wb]);
      // rameno A (horní): osa uprostřed tloušťky + prohnutí ven; na konci se
      // na délce přechodu plynule stočí do (případně natočené) čelisti
      const pol = (p.polohaStredu || 50) / 100;
      const tlF = prubeh(p.tb, p.t, p.tlStred, pol), wF = prubeh(p.wb, p.w, p.sirStred, pol);
      // osa ramene v tištěném tvaru: vnitřní plocha v polovině rozestupu
      const yc = x => Sg(f(x)) / 2 + tlF(f(x)) / 2;
      const yout0 = x => Sg(f(x)) / 2 + tlF(f(x));
      const zavreny = (q, sig) => J.otoc2([q[0], sig * q[1]], [PA[0], sig * PA[1]], -sig * rad(thR) / 2 * (hlava ? fi(q[0]) : 1));
      const alfa = rad(p.uhelCelisti || 0), Lp = omez(p.prechod == null ? 6 : p.prechod, 0, La * 0.6);
      const zac = xp - Math.min(1.5, Lb * 0.35), xB = -Lp;
      const tvar = tvarRamen(p, war);
      for (const x of X) if (x < 0 && f(x) < 0.97 && Sg(f(x)) < 0.3) { war.push('Ramena se v tištěném tvaru dotýkají – zvětšete rozestup.'); break; }
      for (const x of X) if (x < 0 && f(x) > 0.05 && f(x) < 0.85 && zavreny([x, Sg(f(x)) / 2], 1)[1] < 0.15) { war.push('Při stisku se ramena dotknou dřív než čelisti – zvětšete rozestup uprostřed ramen.'); break; }
      function rameno(al, zrc) {
        // konec ramene u čelisti v tištěném tvaru: čelist natočená o úhel a rozevřená o thR/2
        const K0 = konecRamene(g / 2 + p.t / 2, ov, al, cj, zrc), ot = q => J.otoc2(q, PA, rad(thR) / 2);
        const K = { koren: ot(K0.koren), stred: ot(K0.stred), konec: ot(K0.konec), smer: J.otocV2(K0.smer, rad(thR) / 2) };
        const P = [], XV = [];
        // přechod začíná délku Lp před skutečným kořenem čelisti (ten je po rozevření kousek vzadu)
        const xBk = Math.min(xB, K.koren[0] - Math.max(Lp, 0.5));
        for (const x of [zac].concat(X)) if (x < xBk - 0.05) { P.push([x, yc(Math.max(x, xp))]); XV.push(x); }
        if (Lp > 0.05) {
          const dx = 0.05, x0 = Math.max(xBk, xp), sm = [2 * dx, yc(x0 + dx) - yc(x0 - dx)];
          const H = J.krivka([[x0, yc(x0)], K.koren], sm, K.smer, 0.35), RH = J.ramce(H);
          for (let j = P.length ? 0 : 0; j < H.length; j++) { if (P.length && Math.hypot(H[j][0] - P[P.length - 1][0], H[j][1] - P[P.length - 1][1]) < 0.02) continue; P.push(H[j]); XV.push(lerp(x0, 0, RH.S[j] / RH.L)); }
        } else { P.push(K.koren); XV.push(0); }
        // hned za kořenem stanice, kde se rameno schová do čelisti (viz ostryKoren)
        P.push([K.koren[0] + 0.08 * K.smer[0], K.koren[1] + 0.08 * K.smer[1]], K.stred, K.konec); XV.push(0.08, ov / 2, ov);
        // za kořenem čelisti už je osa jiná (natočená); body před přechodem drží křivku rozestupu
        const R = J.ramce(P), vz = vzdalenostOd(P, R.S, K.koren);
        // průřez v bodě i; část zasunutá do čelisti (vJ) i do hlavy (vH) je o EPS
        // menší ze všech stran – žádné plochy v jedné rovině (v náhledu bez švu,
        // slicer je spojí čistě)
        const atr = i => {
          const x = XV[i], vJ = x > 0, vH = x < xp - 1e-9, fx = f(Math.max(x, xp)), tl = vJ ? p.t : tlF(fx), ww = vJ ? p.w : wF(fx), e = (vJ || vH) ? EPS : 0;
          return { u0: -tl / 2 + e, u1: tl / 2 - e + (x < 0 ? nabehH(Math.max(x, xp)) : 0), v0: e, v1: ww - e, vr: x < 0 ? ur.f(x) : 0, k: prolnuti(vz.d(i), Lp) };
        };
        const st = J.pasPoKrivce(P, i => { const a = atr(i); return { rez: rezPasu(tvar, a.u0, a.u1, a.v0, a.v1, 1, a.vr, a.k, p.zaobleniHran) }; }, 0, 1);
        return { st, XV, P, atr };
      }
      // hlava: ramena se ohýbají u kořene; pružinový spoj: ramena tuhá, otáčí se kolem středu spoje
      const ohyb = hlava
        ? (st, sig, XV) => ohniStanice(st, [xp, sig * yk], i => sig * dl * fi(Math.max(XV[i], xp)))
        : (st, sig) => otocStanice(st, C, sig * dl);
      const rA = rameno(alfa), rB = rameno(-alfa, true);
      {
        const P = rA.st.map(q => q.P), R = J.minPolomer(P, 2, P.length - 2);
        const tmax = Math.max(p.t, p.tb, p.tlStred || 0) / 2 + Math.max(p.hlVroubku || 0, 0) + 0.3;
        if (R < tmax) war.push('Prohnutí ramen je místy prudší, než dovolí jejich tloušťka (poloměr ' + R.toFixed(1) + ' mm) – zmírněte křivku prohnutí.');
      }
      let ramena;
      if (hlava) {
        const stA = ohyb(rA.st, 1, rA.XV), stB = ohyb(zrcadliStanice(rB.st), -1, rB.XV);
        if (J.prelozene(stA) || J.prelozene(stB)) war.push('Rameno je zahnuté ostřeji, než dovolí jeho tloušťka – zmenšete prohnutí, úhel čelistí nebo tloušťku, případně prodlužte přechod.');
        ramena = [J.tazeni(stA, false), J.tazeni(stB, false)];
      } else ramena = spojitePasy(rA, rB);
      /* Pružinový spoj jako JEDEN souvislý pás: čelist A ← rameno A ← spojka ←
         pásek oka/meandru → spojka → rameno B → čelist B. Tloušťka a tvar průřezu
         přechází plynule, žádná patka ani švy. U dvojitého oka se vnější pásek
         plynule odpojí z vnější strany ramen (větev). Při rozevírání jsou ramena
         se spojkami tuhá (otočení kolem středu spoje) a pásek se ohýbá. */
      function spojitePasy(rA, rB) {
        const xa = xp - S.pk;
        const jadro = dr => { const P = dr.map(q => [q[0] + xp, q[1]]); let a = 0, b = P.length - 1; while (a < b && P[a][0] > xa + 1e-6) a++; while (b > a && P[b][0] > xa + 1e-6) b--; return P.slice(a, b + 1); };
        const jd0 = jadro(S.drahy[0]);
        // spojka z ramene do pásku: plynulá esovka; když je na délce krčku moc
        // ostrá (poloměr < půl tloušťky ramene), začne se už o kus dál na rameni
        const spojka = (z, smer, k) => J.krivka([z, k], smer, [-1, 0], 0.35);
        const smerKorene = (P, i) => { const j = Math.min(P.length - 1, i + 1), d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]) || 1; return [(P[i][0] - P[j][0]) / d, (P[i][1] - P[j][1]) / d]; };
        const zacatek = (r, sig, cil) => {
          let i = 0;
          for (let ext = 0; ext <= La * 0.35; ext += 0.5) {
            i = Math.max(0, r.XV.findIndex(x => x >= xp + ext - 1e-9));
            const a = r.atr(i), z = [r.P[i][0], sig * r.P[i][1]], sm = smerKorene(r.P, i);
            if (J.minPolomer(spojka(z, [sm[0], sig * sm[1]], cil)) >= (a.u1 - a.u0) / 2 + 0.4) break;
          }
          return i;
        };
        const iA = zacatek(rA, 1, jd0[0]), iB = zacatek(rB, -1, jd0[jd0.length - 1]);
        const PA_ = rA.P.slice(iA), PB_ = rB.P.slice(iB).map(q => [q[0], -q[1]]);
        const smA = smerKorene(PA_, 0), smB = smerKorene(PB_, 0);
        const tlA = rA.atr(iA).u1 - rA.atr(iA).u0, tlB = rB.atr(iB).u1 - rB.atr(iB).u0;
        const out = [];
        // --- hlavní pás (ramena + vnitřní pásek)
        {
          const jd = jd0;
          const cA = spojka(PA_[0], smA, jd[0]), cB = spojka(PB_[0], smB, jd[jd.length - 1]).reverse();
          const body = [], druh = [], prm = [];
          for (let i = PA_.length - 1; i >= 0; i--) { body.push(PA_[i]); druh.push('A'); prm.push(iA + i); }
          cA.forEach((q, j) => { if (j) { body.push(q); druh.push('cA'); prm.push(j / (cA.length - 1)); } });
          jd.forEach((q, j) => { if (j) { body.push(q); druh.push('pas'); prm.push(0); } });
          cB.forEach((q, j) => { if (j) { body.push(q); druh.push('cB'); prm.push(1 - j / (cB.length - 1)); } });
          PB_.forEach((q, j) => { if (j) { body.push(q); druh.push('B'); prm.push(iB + j); } });
          const st = J.pasPoKrivce(body, i => {
            const d = druh[i];
            if (d === 'A' || d === 'B') {
              // osa jde opačně než u samostatného ramene → průřez zrcadlově (vnější strana = −U)
              const a = (d === 'A' ? rA : rB).atr(prm[i]);
              return { rez: rezPasu(tvar, -a.u1, -a.u0, a.v0, a.v1, -1, a.vr, a.k, p.zaobleniHran) };
            }
            const tl = d === 'pas' ? tj : lerp(d === 'cA' ? tlA : tlB, tj, hladce(prm[i]));
            return { rez: rezPasu(tvar, -tl / 2, tl / 2, 0, p.wb, -1, 0, 0, p.zaobleniHran) };
          }, 0, 1);
          out.push(J.tazeni(ohniPas(st, druh), false));
          if (J.prelozene(ohniPas(st, druh))) war.push('Pružný spoj je zahnutý ostřeji, než dovolí jeho tloušťka – zvětšete oko nebo ztenčete pásek.');
        }
        // --- vnější pásek dvojitého oka: plynulá větev z vnější strany ramen
        if (S.drahy[1]) {
          const jd = jadro(S.drahy[1]);
          const Lv = Math.max(3, 2 * tj);
          // větev začíná uvnitř ramene u jeho vnější plochy, kus za začátkem hlavní spojky
          const uvnitr = (r, sig, i0) => {
            let i = r.XV.findIndex(x => x >= r.XV[i0] + Lv); if (i < 0) i = r.XV.length - 1;
            const a = r.atr(i), q = r.P[i], n = J.ramce(r.P).N[i], u = a.u1 - tj / 2 - 0.05, sm = smerKorene(r.P, i);
            return { z: [q[0] + u * n[0], sig * (q[1] + u * n[1])], sm: [sm[0], sig * sm[1]] };
          };
          const zA = uvnitr(rA, 1, iA), zB = uvnitr(rB, -1, iB);
          const cA = spojka(zA.z, zA.sm, jd[0]), cB = spojka(zB.z, zB.sm, jd[jd.length - 1]).reverse();
          const body = [], druh = [];
          cA.forEach(q => { body.push(q); druh.push('cA'); });
          jd.forEach((q, j) => { if (j) { body.push(q); druh.push('pas'); } });
          cB.forEach((q, j) => { if (j) { body.push(q); druh.push('cB'); } });
          const st = J.pasPoKrivce(body, i => {
            const x = body[i][0], v1 = x > xp ? Math.min(p.wb, wF(f(x))) - EPS : p.wb, v0 = x > xp ? EPS : 0;
            return { rez: rezPasu(tvar, -tj / 2, tj / 2, v0, v1, -1, 0, 0, p.zaobleniHran) };
          }, 0, 1);
          out.push(J.tazeni(ohniPas(st, druh), false));
        }
        return out;
      }
      // ohyb pásu: ramena se spojkami tuhé (±dl kolem středu spoje), pásek mezi nimi plynule
      function ohniPas(st, druh) {
        const i0 = druh.indexOf('pas'), i1 = druh.lastIndexOf('pas');
        const S0 = [];
        let L = 0;
        for (let i = 0; i < st.length; i++) { if (i > 0) L += Math.hypot(st[i].P[0] - st[i - 1].P[0], st[i].P[1] - st[i - 1].P[1]); S0.push(L); }
        const a0 = st[Math.max(0, i0 - 1)].P, b0 = st[Math.min(st.length - 1, i1 + 1)].P;
        const qa = J.otoc2(a0, C, dl), qb = J.otoc2(b0, C, -dl), dA = [qa[0] - a0[0], qa[1] - a0[1]], dB = [qb[0] - b0[0], qb[1] - b0[1]];
        const s0 = S0[Math.max(0, i0 - 1)], s1 = S0[Math.min(st.length - 1, i1 + 1)];
        return st.map((q, i) => {
          const d = druh[i];
          if (d === 'A' || d === 'cA') { const r = J.otoc2(q.P, C, dl), U = J.otocV2(q.U, dl); return { P: [r[0], r[1], 0], U: [U[0], U[1], 0], W: q.W, rez: q.rez }; }
          if (d === 'B' || d === 'cB') { const r = J.otoc2(q.P, C, -dl), U = J.otocV2(q.U, -dl); return { P: [r[0], r[1], 0], U: [U[0], U[1], 0], W: q.W, rez: q.rez }; }
          const l = hladce((S0[i] - s0) / Math.max(1e-6, s1 - s0));
          // oko se rozevírá / svírá postupným natáčením kolem středu (tvar oblouku
          // zůstane, posunem by se pásek v sevřené poloze zmačkal); meandr posunem
          // (otáčením by se jeho řady křížily)
          if (spoj !== 'meandr') { const u = lerp(dl, -dl, l), r = J.otoc2(q.P, C, u), U = J.otocV2(q.U, u); return { P: [r[0], r[1], 0], U: [U[0], U[1], 0], W: q.W, rez: q.rez }; }
          return { P: [q.P[0] + lerp(dA[0], dB[0], l), q.P[1] + lerp(dA[1], dB[1], l), 0], U: q.U, W: q.W, rez: q.rez };
        });
      }
      const diry = [];
      if (hlava && p.otvor > 0) {
        const r = p.otvor / 2, xh = xp - (Lb + rs) / 2;
        const H = [[xp, Hh]].concat(zad(Lb), [[xp, -Hh]]);
        const okraj = q => { let m = Infinity; for (let i = 0; i + 1 < H.length; i++) m = Math.min(m, J.vzdUsecek(q, q, H[i], H[i + 1])); return m; };
        const body = kruhDira(xh, 0, r, 0, 0, 24).map(q => [q[0], q[1]]);
        const mimo = body.some(q => !J.uvnitr2(q, H) || okraj(q) < 1 || Math.hypot(q[0] - xp, q[1]) < rs + 1);
        if (mimo) war.push('Otvor na pověšení se do hlavy nevejde – zvětšete hlavu nebo zmenšete otvor.');
        else diry.push(kruhDira(xh, 0, r, 0, p.wb));
      }
      const u = rad(theta) / 2;
      const stredA = hlava ? [xp, yk] : C, stredB = hlava ? [xp, -yk] : C;
      // čelisti: natočení α, pak celkové rozevření theta/2 kolem kořene / středu spoje
      const jawA = otocVse(natocCelist(cj.A.telesa, cj, 1, alfa), stredA, u), jawB = otocVse(natocCelist(cj.B.telesa, cj, -1, alfa), stredB, -u);
      const telesa = [...ramena, ...jawA, ...jawB];
      if (hlava) telesa.unshift(J.deska(O, diry));       // pružný spoj je součástí pásu ramen (spojitePasy)
      // vnitřní vzpěrná pružina mezi rameny (konce se pohybují s rameny)
      if (p.pruzina) {
        const xs = xp + La * omez(p.pruzinaPoloha, 5, 95) / 100, tp = Math.min(p.pruzinaT, p.tb * 0.9);
        if (p.pruzinaT > p.tb * 0.9 + 1e-9) war.push('Pružina je tenčí, než je zadáno: ' + tp.toFixed(2).replace('.', ',') + ' mm (nejvýš 0,9 × tloušťka ramene u hlavy).');
        const ya = Sg(f(xs)) / 2 + Math.min(0.6, tlF(f(xs)) * 0.3);
        const zadMin = (hlava ? xp - rs * 0.4 : xp) + tp;
        const dP = Math.min(p.pruzinaHloubka, xs - zadMin);
        if (dP < p.pruzinaHloubka - 0.01) war.push('Prohnutí vnitřní pružiny zmenšeno na ' + dP.toFixed(1) + ' mm – jinak by narazila do spoje.');
        if (dP > 0.5) {
          const A1 = [xs, ya], vrch = [xs - dP, 0], B1 = [xs, -ya];
          const smer = (a, b) => { const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; };
          const P = J.krivka([A1, vrch, B1], smer(A1, vrch), smer(vrch, B1), 0.4);
          const R = J.ramce(P);
          const trA = q => hlava ? J.otoc2(q, [xp, yk], dl * fi(xs)) : J.otoc2(q, C, dl);
          const trB = q => hlava ? J.otoc2(q, [xp, -yk], -dl * fi(xs)) : J.otoc2(q, C, -dl);
          const qA = trA(A1), qB = trB(B1), dA = [qA[0] - A1[0], qA[1] - A1[1]], dB = [qB[0] - B1[0], qB[1] - B1[1]];
          const st = J.pasPoKrivce(P, () => ({ u0: -tp / 2, u1: tp / 2, v0: 0, v1: zb(xs) }), 0, 1).map((q, i) => {
            const l = R.S[i] / R.L;
            return { P: [q.P[0] + lerp(dA[0], dB[0], l), q.P[1] + lerp(dA[1], dB[1], l), 0], U: q.U, W: q.W, rez: q.rez };
          });
          if (J.prelozene(st)) war.push('Vnitřní pružina je zahnutá ostřeji, než dovolí její tloušťka – zmenšete prohnutí nebo tloušťku.');
          telesa.push(J.tazeni(st, false));
        }
      }
      const casti = [{ nazev: 'Nástroj', role: 'telo', telesa }];
      const tpu = [...otocVse(natocCelist(cj.A.tpu, cj, 1, alfa), stredA, u), ...otocVse(natocCelist(cj.B.tpu, cj, -1, alfa), stredB, -u)];
      if (tpu.length) casti.push({ nazev: 'Polštářky (TPU)', role: 'tpu', telesa: tpu });
      if (p.zamek) {
        const xl = xp + La * p.zamekPoloha / 100;
        const Hz = 2 * zavreny([xl, yout0(xl)], 1)[1];
        if (Hz < 1) war.push('V místě zámkového kroužku jsou ramena prohnutá dovnitř až k sobě – kroužek tam nemá smysl, posuňte ho.');
        const H = Math.max(1, Hz) + 2 * p.vule, W = zb(xl) + 2 * p.vule, tr = omez(p.t * 0.7, 1.2, 4), lr = omez(p.w * 0.6, 4, 12);
        const cx = J.obal(telesa).lo[0] - 4 - H / 2 - tr, ven = [[cx - H / 2 - tr, -W / 2 - tr], [cx + H / 2 + tr, -W / 2 - tr], [cx + H / 2 + tr, W / 2 + tr], [cx - H / 2 - tr, W / 2 + tr]];
        const dov = [[cx - H / 2, -W / 2], [cx + H / 2, -W / 2], [cx + H / 2, W / 2], [cx - H / 2, W / 2]];
        casti.push({ nazev: 'Zámkový kroužek', role: 'kruh', skupina: 'kruh', telesa: [J.deska(ven.map(q => [q[0], q[1], 0, lr]), [dov.map(q => [q[0], q[1], 0, lr])])] });
      }
      if (p.t < 1.2) war.push('Ramena tenčí než 1,2 mm budou při tisku křehká.');
      return { casti, varovani: war, info: { pruzna: true, tiskNaBoku: true, rozevreniTisk: thR } };
    }
  };

  /* Dráha oblouku / oka od bodu (xa, Ra) k (xa, −Ra) za nimi (do −x):
     oblouk (elipsa Re × Re·protažení) opisuje úhel uhel; s úchyty ho spojují
     plynulé náběhy. Pro 180° a Ra = Re je to přesný půlkruh se středem v xa.
     cxPevne = střed (pro soustředné oblouky dvojitého spoje). */
  function lukDraha(xa, Ra, Re, uhel, prot, krok, cxPevne, tl) {
    krok = krok || 0.35;
    const phi = rad(omez(uhel || 180, 90, 345)), Ry = Re, Rx = Re * (prot || 100) / 100, f0 = Math.PI - phi / 2;
    const obl = (cx, a0, a1, n) => { const P = []; for (let k = 0; k <= n; k++) { const a = lerp(a0, a1, k / n); P.push([cx + Rx * Math.cos(a), Ry * Math.sin(a)]); } return P; };
    const n = Math.max(24, Math.ceil(phi * Math.max(Rx, Ry) / krok));
    if (cxPevne == null && Math.abs(phi - Math.PI) < 1e-3 && Math.abs(Ra - Re) < 1e-6) return { P: obl(xa, Math.PI / 2, 1.5 * Math.PI, n), cx: xa, Ra };
    if (phi > Math.PI + 1e-3) {
      // víc než půlkruh: rovný kousek od úchytu, tečný zaoblovací oblouk (rf)
      // a hlavní oblouk; výška úchytu vyjde z geometrie (vrací se Ra)
      const tE0 = [-Rx * Math.sin(f0), Ry * Math.cos(f0)], lt = Math.hypot(tE0[0], tE0[1]);
      const h = Math.atan2(tE0[1] / lt, tE0[0] / lt);         // směr pásku v bodě E
      const D = Math.PI - h;                                    // o kolik se zaoblení stočí
      const rf = Math.max(1.6 * (tl || 1), Re * 0.3);
      const cx = cxPevne != null ? cxPevne : xa - 1 - rf * Math.sin(D) - Rx * Math.cos(f0);
      const E = [cx + Rx * Math.cos(f0), Ry * Math.sin(f0)];
      // střed zaoblení vpravo od směru jízdy v E (otáčí se po směru hodin)
      const Cf = [E[0] + rf * Math.sin(h), E[1] - rf * Math.cos(h)];
      const Q = [Cf[0], Cf[1] - rf];                            // začátek zaoblení (směr −x), pod středem
      const nf = Math.max(6, Math.ceil(D * rf / krok)), za = [];
      // od Q (úhel 270°) po směru hodin do E
      for (let k = 0; k <= nf; k++) { const a = 1.5 * Math.PI - D * k / nf; za.push([Cf[0] + rf * Math.cos(a), Cf[1] + rf * Math.sin(a)]); }
      const nahoru = [[xa, Q[1]]].concat(za);
      const ob = obl(cx, f0, 2 * Math.PI - f0, n);
      const dolu = nahoru.map(q => [q[0], -q[1]]).reverse();
      return { P: nahoru.concat(ob.slice(1, -1), dolu), cx, Ra: Q[1] };
    }
    const dL = Math.max(2, Re * 0.45, 3 * (tl || 1));
    const cx = cxPevne != null ? cxPevne : xa - dL - Rx * Math.cos(f0);
    const E = [cx + Rx * Math.cos(f0), Ry * Math.sin(f0)], tE = [-Rx * Math.sin(f0), Ry * Math.cos(f0)];
    const l = Math.hypot(tE[0], tE[1]), tn = [tE[0] / l, tE[1] / l];
    const nab = J.krivka([[xa, Ra], E], [-1, 0], tn, krok);
    const ob = obl(cx, f0, 2 * Math.PI - f0, n);
    const zpet = J.krivka([[E[0], -E[1]], [xa, -Ra]], [-tn[0], tn[1]], [1, 0], krok);
    return { P: nab.concat(ob.slice(1, -1), zpet), cx, Ra };
  }

  /* Hladká Bézierova křivka přes body [[f, hodnota], …] (úchyty podle sklonu
     sousedních bodů, na krajích jednostranně) – přímka zůstane přímkou. */
  function krivkaBody(B) {
    B = B.slice().sort((a, b) => a[0] - b[0]);
    return { kotvy: B.map((q, i) => {
      const L = B[i - 1], R = B[i + 1];
      // u spoje/oka (první bod) vodorovně – rameno z něj vychází plynule
      const m = !L ? 0 : R ? (R[1] - L[1]) / (R[0] - L[0]) : (q[1] - L[1]) / (q[0] - L[0]);
      const dl = L ? (q[0] - L[0]) / 3 : 0, dr = R ? (R[0] - q[0]) / 3 : 0;
      return { p: q.slice(), a: [-dl, -m * dl], b: [dr, m * dr] };
    }) };
  }
  /* Křivka rozestupu s bodem u čelistí upraveným na zadané rozevření (°):
     kořen čelisti J0 otočený o úhel/2 kolem středu otáčení PA dá výšku osy. */
  function sCilem(kr, PA, J0, t, uhel) {
    // bod u čelistí E leží v x = 0 (tak se z něj počítá θtisk): úhel E−PA = úhel J0−PA + uhel/2
    const k = JSON.parse(JSON.stringify(kr)), n = k.kotvy.length - 1;
    const aE = Math.min(rad(85), Math.atan2(J0[1] - PA[1], J0[0] - PA[0]) + rad(uhel) / 2);
    const yE = PA[1] + (0 - PA[0]) * Math.tan(aE);
    const S1 = Math.max(0.2, 2 * (yE - t / 2)), S0 = k.kotvy[0].p[1], S1s = k.kotvy[n].p[1];
    // celá křivka se úměrně roztáhne od bodu u oka (tvar zůstane, jen víc/méně rozevřený)
    const m = Math.abs(S1s - S0) > 1e-6 ? (S1 - S0) / (S1s - S0) : 1;
    for (const kv of k.kotvy) { kv.p[1] = Math.max(0.2, S0 + (kv.p[1] - S0) * m); kv.a[1] *= m; kv.b[1] *= m; }
    if (Math.abs(S1s - S0) <= 1e-6) k.kotvy[n].p[1] = S1;
    return k;
  }
  const platnaKrivka = k => k && Array.isArray(k.kotvy) && k.kotvy.length >= 2;
  const pamet2 = new Map();
  const zapamatuj = (klic, fn) => {
    if (pamet2.has(klic)) return pamet2.get(klic);
    const r = fn();
    pamet2.set(klic, r);
    if (pamet2.size > 30) pamet2.delete(pamet2.keys().next().value);
    return r;
  };

  /* Základ pinzety: rozměry, spoj a hlavně ROZESTUP ramen v tištěném tvaru –
     vnitřní mezera mezi rameny po délce (f = 0 u spoje, 1 u čelistí). Rozevření
     při tisku se dopočítá z rozestupu u čelistí (otočení kolem kořene ramene /
     středu spoje, které čelisti zavře). Bez vlastní křivky se rozestup odvodí
     z dřívějších parametrů (poloměr štěrbiny, prohnutí, rozevření při tisku). */
  function zakladVidlice(p, cel) {
    return zapamatuj(JSON.stringify(['v', p, cel.id, cel.p]), () => {
      const war = [];
      const c = { t: p.t, w: p.w, L: cel.p.L };
      const cj = celisti(cel, c, p.mezera, p.uhelSpicek);
      if (cj.kontrola) war.push(cj.kontrola);
      const g = cj.g, ov = cj.presah;
      const spoj = typSpoje(p), hlava = spoj === 'hlava';
      const vlastni = platnaKrivka(p.rozestup);
      const rs = vlastni ? Math.max(0.3, p.rozestup.kotvy[0].p[1] / 2) : Math.max(p.rs, g / 2 + 0.3);
      const Hb2 = rs + p.tb, yk = rs + p.tb / 2;
      const tj = Math.max(0.6, p.tSpoj || 1.6);
      const S = hlava ? null : navrhSpoje(p, spoj, rs, Hb2, yk, tj, war);
      let La = p.L - (hlava ? p.Lb : S.hloubka) - cj.delka;
      if (La < 8) { war.push('Ramena jsou příliš krátká – prodlužte nástroj nebo zkraťte čelisti.'); La = 8; }
      const xp = -La, xc = xp - (hlava ? 0 : S.pk), C = [xc, 0];
      const Lf = Math.max(2, La * p.pruzna / 100);
      const fi = x => hladce((x - xp) / Lf);
      const f = x => omez((x - xp) / (-xp), 0, 1);
      const PA = hlava ? [xp, yk] : C;
      let kr = p.rozestup;
      if (!vlastni) {
        const bow = prohnutiRamen(p), th = rad(p.otevreni || 14) / 2;
        const mez = fr => { const x = xp + La * fr, q = J.otoc2([x, lerp(rs, g / 2, fr) + bow(fr)], PA, th * (hlava ? fi(x) : 1)); return Math.max(0.2, 2 * q[1]); };
        const F = new Set([0.5, 1]);
        for (const [h, v] of [[p.prohnuti, p.vrchol || 45], [p.prohnuti2, p.vrchol2 || 70], [p.prohnuti3, p.vrchol3 || 20]]) if (h) F.add(omez(v / 100, 0.05, 0.95));
        if ([...F].some(x => Math.abs(x - 0.5) < 0.15 && x !== 0.5)) F.delete(0.5);
        kr = krivkaBody([[0, 2 * rs]].concat([...F].map(fr => [fr, mez(fr)])));
      }
      // kořen čelisti A v zavřené poloze (s předpětím špiček)
      const J0 = spicky(cj, 1)([0, g / 2 + p.t / 2]);
      if (p.rozevreni > 0) kr = sCilem(kr, PA, J0, p.t, p.rozevreni);
      const Sg = prohnutiKrivkou(kr);
      const E = [0, Sg(1) / 2 + p.t / 2];
      let thR = 2 * (Math.atan2(E[1] - PA[1], E[0] - PA[0]) - Math.atan2(J0[1] - PA[1], J0[0] - PA[0])) * 180 / Math.PI;
      if (!(thR > 0.5)) { war.push('Rozestup u čelistí je menší než mezera čelistí – čelisti by se nerozevřely. Zvětšete 3. bod rozestupu.'); thR = 0.5; }
      return { war, c, cj, g, ov, spoj, hlava, rs, Hb2, yk, tj, S, La, xp, xc, C, Lf, fi, f, PA, kr, Sg, thR, vlastni };
    });
  }

  /* Základ kleští s okem: oko (poloměr R, úchyt podle 1. bodu rozestupu),
     rozestup ramen v tištěném tvaru (f = 0 u oka, 1 u čelistí) a z něj
     rozevření při tisku (otočení kolem středu oka, které čelisti zavře). */
  function zakladSmycky(p, cel) {
    return zapamatuj(JSON.stringify(['s', p, cel.id, cel.p]), () => {
      const war = [];
      const c = { t: p.t, w: p.w, L: cel.p.L };
      const cj = celisti(cel, c, p.mezera, p.uhelSpicek);
      if (cj.kontrola) war.push(cj.kontrola);
      const g = cj.g, ov = cj.presah, t = p.t, w = p.w, yA = g / 2 + t / 2;
      const vlastni = platnaKrivka(p.rozestup);
      const R0 = Math.max(p.R, t / 2 + 0.6);
      const Ra = vlastni ? Math.max(t / 2 + 0.6, p.rozestup.kotvy[0].p[1] / 2 + t / 2) : R0;
      const R = Math.max(R0, Ra);
      // oko se nejdřív navrhne pro odhad, pak se posune tak, aby celková délka
      // (zadní okraj oka … špička čelistí) přesně odpovídala L
      let xl = -(p.L - cj.delka) + R + t / 2;
      let uhO = p.uhelOka || 180, LK;
      for (let i = 0; i < 60; i++) {
        LK = lukDraha(xl, Ra, R, uhO, p.protazeniOka, 0.5, null, t);
        if (LK.Ra >= t / 2 + 0.6 || uhO <= 120) break;
        uhO -= 5;
      }
      if (uhO < (p.uhelOka || 180)) war.push('Úhel oka zmenšen na ' + uhO + '° – při větším by se konce pásku v krčku dotkly. Pro větší úhel zvětšete poloměr oka.');
      const minX = Math.min(...LK.P.map(q => q[0]));
      xl += (-(p.L - cj.delka) + t / 2) - minX;
      if (xl > -8) { war.push('Nástroj je na zvolené čelisti příliš krátký.'); xl = -8; }
      LK = lukDraha(xl, Ra, R, uhO, p.protazeniOka, 0.5, null, t);
      const C = [xl, 0], fx = x => omez((x - xl) / (-xl), 0, 1);
      const Ru = LK.Ra;
      let kr = p.rozestup;
      if (!vlastni) {
        // ze starého zadání: zavřený tvar + prohnutí, rozevřený o „rozevření při tisku“
        const bow = prohnutiRamen(p), th = rad(p.otevreni || 22) / 2;
        const mez = fr => { const x = xl + (-xl) * fr, yc = lerp(Ru, yA, hladce(fr)) + bow(fr); return Math.max(0.2, 2 * J.otoc2([x, yc - t / 2], C, th)[1]); };
        const F = new Set([0.5, 1]);
        for (const [h, v] of [[p.prohnuti, p.vrchol || 45], [p.prohnuti2, p.vrchol2 || 70], [p.prohnuti3, p.vrchol3 || 20]]) if (h) F.add(omez(v / 100, 0.05, 0.95));
        if ([...F].some(x => Math.abs(x - 0.5) < 0.15 && x !== 0.5)) F.delete(0.5);
        kr = krivkaBody([[0, Math.max(0.2, 2 * Ru - t)]].concat([...F].map(fr => [fr, mez(fr)])));
      }
      const J0 = spicky(cj, 1)([0, yA]);
      if (p.rozevreni > 0) kr = sCilem(kr, C, J0, t, p.rozevreni);
      const Sg = prohnutiKrivkou(kr);
      const E = [0, Sg(1) / 2 + t / 2];
      let thR = 2 * (Math.atan2(E[1] - C[1], E[0] - C[0]) - Math.atan2(J0[1] - C[1], J0[0] - C[0])) * 180 / Math.PI;
      if (!(thR > 0.5)) { war.push('Rozestup u čelistí je menší než mezera čelistí – čelisti by se nerozevřely. Zvětšete 3. bod rozestupu.'); thR = 0.5; }
      return { war, cj, g, ov, t, w, yA, R, xl, C, luk: LK.P, Ru, kr, Sg, thR, fx, vlastni };
    });
  }

  /* Pružinový spoj pinzety v místních souřadnicích (kořen ramen v x = 0):
     dráhy pásků vedou od horního ramene (y > 0) k dolnímu, krček je
     x ∈ ⟨−pk; 0⟩ (tam je spojka z ramene do pásku, viz spojitePasy).
     Vrací {pk, hloubka, drahy}. */
  function navrhSpoje(p, spoj, rs, Hb2, yk, tj, war) {
    const pk = Math.max(2, tj * 1.5), xa = -pk, dovnitr = Math.min(1.2, pk * 0.5);
    const drahy = [];
    let Ra = yk;
    const sUchyty = (P, ra) => J.prevzorkuj([[xa + dovnitr, ra]].concat(P, [[xa + dovnitr, -ra]]), 0.35);
    if (spoj === 'oko' || spoj === 'dvojite') {
      // oko: ramena se u patek sbíhají do krčku a pásek opíše oko o daném úhlu;
      // dvojité oko = druhý pásek jako rovnoběžná křivka vně prvního (stálá mezera)
      const d2 = spoj === 'dvojite' ? tj + Math.max(0.4, p.mezSpoj || 1.2) : 0;
      const Re = Math.max(p.Rspoj, Ra + tj + 0.5);
      // zaoblení náběhu musí snést i vnější (posunutou) křivku
      // úhel oka se zmenšuje, dokud úchyty obou konců pásku nejsou od sebe (krček)
      let uh = p.uhelOka || 270, L;
      for (let i = 0; i < 60; i++) {
        L = lukDraha(xa, Ra, Re, uh, p.protazeni, 0.3, null, Math.max(tj, (d2 + tj) / 1.4));
        if (L.Ra >= tj / 2 + 0.5 || uh <= 120) break;
        uh -= 5;
      }
      if (uh < (p.uhelOka || 270)) war.push('Úhel oka zmenšen na ' + uh + '° – při větším by se konce pásku v krčku dotkly. Pro větší úhel zvětšete poloměr oka.');
      Ra = L.Ra;
      const vnitrni = sUchyty(L.P, Ra);
      drahy.push(vnitrni);
      if (d2) {
        // vnější pásek: posun vnitřní dráhy doprava od směru (ven z oka)
        const R = J.ramce(vnitrni);
        const vnejsi = J.prevzorkuj(vnitrni.map((q, i) => [q[0] - d2 * R.N[i][0], q[1] - d2 * R.N[i][1]]), 0.3);
        // úchyty vnějšího pásku vodorovně do patky
        vnejsi[0] = [xa + dovnitr, vnejsi[0][1]]; vnejsi[vnejsi.length - 1] = [xa + dovnitr, vnejsi[vnejsi.length - 1][1]];
        drahy.push(vnejsi);
      }
    } else if (spoj === 'meandr') {
      const m = 2 * Math.max(1, Math.round(p.zavity));       // počet vodorovných úseků (sudý)
      const sp = Math.max(tj + 0.6, 2 * yk / (m - 1));
      Ra = sp * (m - 1) / 2;
      const r = sp / 2, xL = xa - Math.max(p.delkaSpoje, 2 * r + tj), xR = xa - r - tj * 0.6;
      const P = [[xa + dovnitr, Ra], [xa, Ra]];
      for (let j = 0; j < m; j++) {
        const y = Ra - j * sp, kam = j % 2 === 0 ? xL : (j === m - 1 ? xa : xR);
        P.push([kam, y]);
        if (j < m - 1) {
          const cy = y - r, vlevo = j % 2 === 0;
          for (let k = 1; k < 16; k++) { const a = Math.PI / 2 + (vlevo ? 1 : -1) * Math.PI * k / 16; P.push([kam + r * Math.cos(a), cy + r * Math.sin(a)]); }
        }
      }
      P.push([xa + dovnitr, -Ra]);
      drahy.push(J.prevzorkuj(P, 0.3));
    }
    let minX = 0;
    for (const d of drahy) for (const q of d) minX = Math.min(minX, q[0]);
    return { pk, hloubka: -minX + tj / 2, drahy };
  }

  /* ==================================================================
     KŘÍŽOVÁ – reverzní pinzeta / svorka (v klidu zavřená)
     ================================================================== */
  const krizova = {
    nazev: 'Křížová (reverzní)',
    parametry: [
      { id: 'L', nazev: 'Celková délka', min: 30, max: 300, krok: 1, jednotka: 'mm', vychozi: 110 },
      { id: 'Lb', nazev: 'Délka hlavy', min: 4, max: 60, krok: 0.5, jednotka: 'mm', vychozi: 12 },
      { id: 't', nazev: 'Tloušťka ramen', min: 0.8, max: 12, krok: 0.1, jednotka: 'mm', vychozi: 2, skupina: 'prurez' },
      { id: 'w', nazev: 'Šířka ramen (výška nástroje)', min: 2.5, max: 40, krok: 0.5, jednotka: 'mm', vychozi: 8, skupina: 'prurez' },
      ...P_PRUREZ, ...P_CELIST,
      { id: 'Y0', nazev: 'Rozevření u hlavy', min: 1.5, max: 40, krok: 0.5, jednotka: 'mm', vychozi: 6, napoveda: 'Vzdálenost ramen od osy u hlavy – čím víc, tím dál od čelistí je křížení.' },
      { id: 'kriz', nazev: 'Poloha křížení', min: 25, max: 85, krok: 1, jednotka: '% ramen', vychozi: 62 },
      { id: 'pruzna', nazev: 'Délka pružné části', min: 10, max: 60, krok: 1, jednotka: '% ramen', vychozi: 35 },
      { id: 'zakonceni', nazev: 'Zakončení hlavy', typ: 'volba', vychozi: 'oble', volby: [['oble', 'oblé'], ['rovne', 'rovné']] },
      { id: 'otvor', nazev: 'Otvor na pověšení', min: 0, max: 15, krok: 0.5, jednotka: 'mm', vychozi: 0 },
      { id: 'vroubky', nazev: 'Vroubky úchopu', min: 0, max: 20, krok: 1, vychozi: 6, skupina: 'uchop' },
      { id: 'hlVroubku', nazev: 'Výška vroubků', min: 0, max: 2, krok: 0.05, jednotka: 'mm', vychozi: 0.4, skupina: 'uchop' },
      { id: 'mezera', nazev: 'Mezera v klidu', min: 0.15, max: 10, krok: 0.05, jednotka: 'mm', vychozi: 0.3,
        napoveda: 'Čelisti se tisknou zavřené; mezera zabrání jejich slepení. Drží předměty silnější než mezera.' },
      { id: 'vule', nazev: 'Vůle v křížení', min: 0.15, max: 1.2, krok: 0.05, jednotka: 'mm', vychozi: 0.4, skupina: 'tisk',
        napoveda: 'Svislá i boční vůle mezi rameny v místě, kde jdou přes sebe.' },
      { id: 'stisk', nazev: 'Největší stisk', min: 2, max: 25, krok: 0.5, jednotka: '°', vychozi: 9, skupina: 'tisk' }
    ],
    pohyb: p => ({ min: 0, max: p.stisk, tisk: 0, nazev: 'Stisk (otevře čelisti)' }),
    stavba(p, cel, theta) {
      const war = [];
      const c = { t: p.t, w: p.w, L: cel.p.L };
      const cj = celisti(cel, c, p.mezera, p.uhelSpicek);
      if (cj.kontrola) war.push(cj.kontrola);
      const g = cj.g, ov = cj.presah, t = p.t, w = p.w, cl = p.vule;
      let La = p.L - p.Lb - cj.delka;
      if (La < 12) { war.push('Ramena jsou příliš krátká.'); La = 12; }
      const xb = -La, yA = g / 2 + t / 2, Y0 = Math.max(p.Y0, t / 2 + cl + 0.5);
      // osa ramene A: z hlavy (dole) přes křížení k horní čelisti
      const xk = xb + La * p.kriz / 100;
      const alfa = rad(p.uhelCelisti || 0), Lp = omez(p.prechod == null ? 6 : p.prechod, 0, -xk * 0.8);
      const pol = (p.polohaStredu || 50) / 100;
      const tlF = prubeh(t, t, p.tlStred, pol), wF = prubeh(w, w, p.sirStred, pol);
      const Lf = Math.max(3, La * p.pruzna / 100);
      const ur = vroubky(p.vroubky, p.hlVroubku, xb + 2, xb + (xk - xb) * 0.7);
      // za křížením je vnitřní strana (−U) o 0,6·vůle odsazená, aby se ramena
      // u čelistí nepřiblížila na méně než vůli
      const ods = x => 0.6 * cl * hladce((x - xk) / Math.max(2, -xk * 0.3));
      const pasT = pasTvar(tvarRamen(p, war), p.zaobleniHran);
      // osa ramene A: z hlavy (dole) přes křížení k horní čelisti (natočené o al)
      function draha(al, zrc) {
        const K = konecRamene(yA, ov, al, cj, zrc);
        let P = J.krivka([[xb, -Y0], [xk, 0], K.koren], [1, 0], K.smer, 0.4);
        P = [[xb - Math.min(4, p.Lb * 0.6), -Y0]].concat(P, [K.stred, K.konec]);
        P = ostryKoren(J.prevzorkuj(P, 0.4), K);
        const R = J.ramce(P), vz = vzdalenostOd(P, R.S, K.koren);
        const sB = Math.max(0, P.findIndex(q => q[0] >= xb)), s0 = R.S[sB];
        const fL = i => omez((R.S[i] - s0) / Math.max(1e-6, R.S[vz.iq] - s0), 0, 1);
        const fi = i => hladce((R.S[i] - s0) / Lf) * (i >= sB ? 1 : 0);
        // průřez: vnější strana (dál od osy v úchopu) = −U
        const rez = (i, lam, horni) => {
          const x = P[i][0], vJ = i > vz.iq, tl = vJ ? t : tlF(fL(i)), ww = vJ ? w : Math.max(wF(fL(i)), w * hladce(lam * 4));
          const u0 = -tl / 2 + ods(x) + (vJ ? EPS : 0), u1 = tl / 2 - (vJ ? EPS : 0);
          const v0 = (vJ ? EPS : 0) + (horni ? lam * (w / 2 + cl / 2) : 0), v1 = (vJ ? ww - EPS : ww) - (horni ? 0 : lam * (ww - w / 2 + cl / 2));
          return { u0, u1, v0, v1, ven: -1, vr: ur.f(x), k: prolnuti(vz.d(i), Lp) };
        };
        return { P, R, rez, fi };
      }
      const dA = draha(alfa), dBm = draha(-alfa, true);
      const pohyb = (d, sig) => (st, psi) => ohniStanice(st, [xb, -sig * Y0], i => sig * rad(psi) * d.fi(i));
      const pohybA = pohyb(dA, 1), pohybB = pohyb(dBm, -1);
      const stA0 = pasT(dA.P, i => dA.rez(i, 0)), stB0 = zrcadliStanice(pasT(dBm.P, i => dBm.rez(i, 0)));
      // překryv při stisku 0 … max (každé rameno proti druhému)
      const vz = [0, p.stisk / 3, p.stisk * 2 / 3, p.stisk];
      const nabeh = Math.max(w * 0.7, 2);
      const lamA = J.podilPulky(dA.R.S, J.prekryvPasu(dA.P.length - 1, vz.length, k => [J.stopyPasu(pohybA(stA0, vz[k])), J.stopyPasu(pohybB(stB0, vz[k]))], cl), nabeh);
      const lamB = J.podilPulky(dBm.R.S, J.prekryvPasu(dBm.P.length - 1, vz.length, k => [J.stopyPasu(pohybB(stB0, vz[k])), J.stopyPasu(pohybA(stA0, vz[k]))], cl), nabeh);
      for (let i = 0; i < dA.P.length; i++) if (lamA[i] > 0 && dA.P[i][0] > -1) { war.push('Křížení je příliš blízko čelistí – posuňte ho dozadu nebo zvětšete rozevření u hlavy.'); break; }
      const stA = pasT(dA.P, i => dA.rez(i, lamA[i], false));
      // rameno B: zrcadlo (s opačným úhlem čelisti) s horní polovinou v křížení
      const stB = zrcadliStanice(pasT(dBm.P, i => dBm.rez(i, lamB[i], true)));
      const fi = dA.fi, P = dA.P;
      if (J.prelozene(pohybA(stA, theta)) || J.prelozene(pohybB(stB, theta))) war.push('Rameno je zahnuté ostřeji, než dovolí jeho tloušťka – síť se přeloží. Zmenšete vyklenutí/rozevření nebo tloušťku.');
      const ramA = J.tazeni(pohybA(stA, theta), false), ramB = J.tazeni(pohybB(stB, theta), false);
      // hlava
      const H2 = Y0 + t / 2 + 0.8, xz = xb - p.Lb;
      const O = [[xb + 0.01, H2, 0, w]];
      if (p.zakonceni === 'rovne') O.push([xz, H2, 0, w], [xz, -H2, 0, w]);
      else { const Rx = Math.min(p.Lb, H2) * 0.95; for (let k = 0; k <= 24; k++) { const a = Math.PI / 2 + Math.PI * k / 24; O.push([xz + Rx + Rx * Math.cos(a), H2 * Math.sin(a), 0, w]); } }
      O.push([xb + 0.01, -H2, 0, w]);
      const diry = [];
      if (p.otvor > 0) {
        // otvor mezi zadním okrajem hlavy a konci ramen, které do hlavy zasahují
        const r = p.otvor / 2, xs = xb - Math.min(4, p.Lb * 0.6), xh = (xz + xs) / 2;
        const doRamene = Math.hypot(Math.max(0, xs - xh), Math.max(0, Y0 - t / 2 - 0.3));
        if (r > Math.min((xs - xz) / 2 - 1.2, H2 - 1.2, doRamene - 0.8)) war.push('Otvor na pověšení se do hlavy nevejde – prodlužte hlavu nebo zmenšete otvor.');
        else diry.push(kruhDira(xh, 0, r, 0, w));
      }
      const hlava = J.deska(O, diry);
      // čelisti: tuhé, otočené jako konec ramene
      const iK = P.length - 1, uA = rad(theta) * fi(iK);
      const telesa = [hlava, ramA, ramB, ...otocVse(natocCelist(cj.A.telesa, cj, 1, alfa), [xb, -Y0], uA), ...otocVse(natocCelist(cj.B.telesa, cj, -1, alfa), [xb, Y0], -uA)];
      const casti = [{ nazev: 'Nástroj', role: 'telo', telesa }];
      const tpu = [...otocVse(natocCelist(cj.A.tpu, cj, 1, alfa), [xb, -Y0], uA), ...otocVse(natocCelist(cj.B.tpu, cj, -1, alfa), [xb, Y0], -uA)];
      if (tpu.length) casti.push({ nazev: 'Polštářky (TPU)', role: 'tpu', telesa: tpu });
      if (w < 3) war.push('Při šířce pod 3 mm zbude v křížení na každé rameno méně než 1,3 mm.');
      return { casti, varovani: war, info: { pruzna: true, tiskVKlidu: true } };
    }
  };

  /* ==================================================================
     SMYČKA – kuchyňské kleště s pružným okem, svorka s rohatkou
     ================================================================== */
  const smycka = {
    nazev: 'S pružným okem',
    rozestup: (p, cel) => zakladSmycky(p, cel),
    parametry: [
      { id: 'L', nazev: 'Celková délka', min: 30, max: 500, krok: 1, jednotka: 'mm', vychozi: 200 },
      { id: 't', nazev: 'Tloušťka ramen (pásku)', min: 0.8, max: 12, krok: 0.1, jednotka: 'mm', vychozi: 2.6, skupina: 'prurez' },
      { id: 'w', nazev: 'Šířka ramen', min: 3, max: 60, krok: 0.5, jednotka: 'mm', vychozi: 16, skupina: 'prurez' },
      ...P_PRUREZ, ...P_CELIST,
      { id: 'R', nazev: 'Poloměr oka', min: 1.5, max: 60, krok: 0.5, jednotka: 'mm', vychozi: 10, skupina: 'oko' },
      { id: 'uhelOka', nazev: 'Úhel, který opisuje oko', min: 120, max: 330, krok: 5, jednotka: '°', vychozi: 180, skupina: 'oko',
        napoveda: '180° = půlkruh; víc = kapkovité oko (měkčí pružení), méně = mělký oblouk.' },
      { id: 'protazeniOka', nazev: 'Protažení oka', min: 40, max: 250, krok: 5, jednotka: '%', vychozi: 100, skupina: 'oko' },
      { id: 'vroubky', nazev: 'Vroubky úchopu', min: 0, max: 30, krok: 1, vychozi: 10, skupina: 'uchop' },
      { id: 'hlVroubku', nazev: 'Výška vroubků', min: 0, max: 3, krok: 0.05, jednotka: 'mm', vychozi: 0.6, skupina: 'uchop' },
      { id: 'uchopOd', nazev: 'Úchop od', min: 0, max: 95, krok: 1, jednotka: '% ramen', vychozi: 15, skupina: 'uchop' },
      { id: 'uchopDo', nazev: 'Úchop do', min: 5, max: 100, krok: 1, jednotka: '% ramen', vychozi: 55, skupina: 'uchop' },
      P_PROHNUTI(6), P_VRCHOL, ...P_VRCHOLY23,
      { id: 'rozevreni', nazev: 'Rozevření ramen (úhel)', min: 0, max: 90, krok: 0.5, jednotka: '°', vychozi: 0, skupina: 'prohnuti',
        napoveda: 'Úhel, o který jsou ramena v klidu (= největší rozevření bez násilí). 0 = podle rozestupu u čelistí v editoru; zadaný úhel přepočítá 3. bod.' },

      P_MEZERA,
      { id: 'rohatka', nazev: 'Rohatka (samosvorná)', typ: 'prepinac', vychozi: false, skupina: 'rohatka',
        napoveda: 'Jazýček s pilkou na konci horní čelisti a zub na dolní – svorka zůstane sevřená.' },
      { id: 'zubu', nazev: 'Počet zubů rohatky', min: 2, max: 20, krok: 1, vychozi: 6, skupina: 'rohatka' },
      { id: 'roztecR', nazev: 'Rozteč zubů', min: 0.8, max: 5, krok: 0.1, jednotka: 'mm', vychozi: 1.6, skupina: 'rohatka' },
      { id: 'vule', nazev: 'Vůle rohatky', min: 0.15, max: 1.2, krok: 0.05, jednotka: 'mm', vychozi: 0.35, skupina: 'rohatka' },
      Object.assign(P_TISK(22, 90), { skryty: true })
    ],
    pohyb: (p, cel) => { const th = cel ? zakladSmycky(p, cel).thR : p.otevreni; return { min: 0, max: Math.max(th * 1.3, 10), tisk: th, nazev: 'Rozevření' }; },
    stavba(p, cel, theta) {
      const B = zakladSmycky(p, cel), war = B.war.slice();
      const { cj, g, ov, t, w, yA, R, xl, C, luk, Ru, Sg, thR, fx } = B;
      const dl = rad(theta - thR) / 2;          // ohyb oka z tištěného tvaru
      const alfa = rad(p.uhelCelisti || 0), Lp = omez(p.prechod == null ? 6 : p.prechod, 0, -xl * 0.5);
      // konce ramen u čelistí v tištěném tvaru: natočené o α a rozevřené o ±thR/2 kolem středu oka
      const ot = (K, sig) => { const o = q => J.otoc2(q, C, sig * rad(thR) / 2); return { koren: o(K.koren), stred: o(K.stred), konec: o(K.konec), smer: J.otocV2(K.smer, sig * rad(thR) / 2) }; };
      const KA = ot(konecRamene(yA, ov, alfa, cj), 1), KB = ot(konecRamene(-yA, ov, alfa, cj), -1);
      const xP = -Lp;     // začátek přechodu
      const pol = (p.polohaStredu || 50) / 100;
      const tlF = prubeh(t, t, p.tlStred, pol), wF = prubeh(w, w, p.sirStred, pol);
      // osa ramene: vnitřní plocha v polovině rozestupu; u oka náběh na skutečný úchyt
      const oprava = Ru - (Sg(0) / 2 + t / 2);
      const yR = x => Sg(fx(x)) / 2 + tlF(fx(x)) / 2 + oprava * (1 - hladce(fx(x) / 0.25));
      const rameno = (sig, K) => {
        const P = [];
        const x0 = Math.max(xl + 1, Math.min(xP, K.koren[0] - Math.max(Lp, 1.5 * t)));
        const n = Math.max(8, Math.ceil((x0 - xl) / 0.5));
        for (let k = 0; k <= n; k++) { const x = xl + (x0 - xl) * k / n; P.push([x, sig * yR(x)]); }
        const d = 0.05, sm = [2 * d, sig * (yR(x0 + d) - yR(x0 - d))];
        const H = J.krivka([[x0, sig * yR(x0)], K.koren], sm, K.smer, 0.5);
        return P.concat(H.slice(1));
      };
      const ramA = rameno(1, KA).reverse(), ramB = rameno(-1, KB);
      let P = [KA.konec, KA.stred].concat(ramA, luk.slice(1, -1), ramB, [KB.stred, KB.konec]);
      P = ostryKoren(ostryKoren(J.prevzorkuj(P, 0.5).reverse(), KA).reverse(), KB);
      const Rm = J.ramce(P);
      {
        const tmax = Math.max(t, p.tlStred || 0) / 2 + (p.hlVroubku || 0) + 0.3;
        const iL0 = vzdalenostOd(P, Rm.S, luk[0]).iq, iL1 = vzdalenostOd(P, Rm.S, luk[luk.length - 1]).iq;
        if (Math.min(J.minPolomer(P, 2, iL0), J.minPolomer(P, iL1, P.length - 2)) < tmax) war.push('Rozestup ramen se místy mění prudčeji, než dovolí jejich tloušťka – zmírněte křivku rozestupu.');
        for (let k = 1; k < 20; k++) {
          const fr = k / 20, x = xl + (-xl) * fr, q = J.otoc2([x, Sg(fr) / 2], C, -rad(thR) / 2);
          if (Sg(fr) < 0.3) { war.push('Ramena se v tištěném tvaru dotýkají – zvětšete rozestup.'); break; }
          if (fr < 0.85 && q[1] < 0.15) { war.push('Při stisku se ramena dotknou dřív než čelisti – zvětšete rozestup uprostřed ramen.'); break; }
        }
      }
      // ohyb: oko se rozevře, ramena se otočí kolem středu oka
      const iA = vzdalenostOd(P, Rm.S, KA.koren).iq, iB = vzdalenostOd(P, Rm.S, KB.koren).iq;
      const i0 = vzdalenostOd(P, Rm.S, luk[0]).iq, i1 = vzdalenostOd(P, Rm.S, luk[luk.length - 1]).iq;
      const sMid = (Rm.S[i0] + Rm.S[i1]) / 2, sOka = Math.max(1, (Rm.S[i1] - Rm.S[i0]) / 2);
      const fi = i => hladce(Math.abs(Rm.S[i] - sMid) / sOka);
      const sg = i => Rm.S[i] < sMid ? 1 : -1;
      const ur = vroubky(p.vroubky, p.hlVroubku, xl + (-xl) * p.uchopOd / 100, xl + (-xl) * Math.max(p.uchopOd + 1, p.uchopDo) / 100);
      const pasT = pasTvar(tvarRamen(p, war), p.zaobleniHran);
      const st = pasT(P, i => {
        const x = P[i][0], vJ = i < iA || i > iB, fl = fx(x), tl = vJ ? t : tlF(fl), ww = vJ ? w : wF(fl);
        return { u0: -tl / 2 + (vJ ? EPS : 0), u1: tl / 2 - (vJ ? EPS : 0), v0: vJ ? EPS : 0, v1: vJ ? ww - EPS : ww, ven: -1,
          vr: x > xl && !vJ ? ur.f(x) : 0, k: prolnuti(Math.min(Rm.S[i] - Rm.S[iA], Rm.S[iB] - Rm.S[i]), Lp) };
      });
      const u = rad(theta) / 2;
      const stO = ohniStanice(st, C, i => sg(i) * dl * fi(i));
      if (J.prelozene(stO)) war.push('Rameno je zahnuté ostřeji, než dovolí jeho tloušťka – síť se přeloží. Zmenšete vyklenutí/rozevření nebo tloušťku.');
      const pas_ = J.tazeni(stO, false);
      const telesa = [pas_];
      let telA = cj.A.telesa.slice(), telB = cj.B.telesa.slice();
      if (p.rohatka) {
        const r = rohatkaSmycky(p, cel, cj, g, t, w);
        if (r.chyba) war.push(r.chyba);
        else { telA = telA.concat(r.A); telB = telB.concat(r.B); }
      }
      telesa.push(...otocVse(natocCelist(telA, cj, 1, alfa), [xl, 0], u), ...otocVse(natocCelist(telB, cj, -1, alfa), [xl, 0], -u));
      const casti = [{ nazev: 'Nástroj', role: 'telo', telesa }];
      const tpu = [...otocVse(natocCelist(cj.A.tpu, cj, 1, alfa), [xl, 0], u), ...otocVse(natocCelist(cj.B.tpu, cj, -1, alfa), [xl, 0], -u)];
      if (tpu.length) casti.push({ nazev: 'Polštářky (TPU)', role: 'tpu', telesa: tpu });
      if (R < t * 1.5) war.push('Oko je malé proti tloušťce pásku – v ohybu bude velké napětí a může prasknout.');
      return { casti, varovani: war, info: { pruzna: true, tiskNaBoku: true, rozevreniTisk: thR } };
    }
  };

  // jazýček s pilkou (díl horní čelisti) a zub pod dolní čelistí
  function rohatkaSmycky(p, cel, cj, g, t, w) {
    const id = cel.id, cp = cel.p;
    if ((cp.ohyb || 0) !== 0) return { chyba: 'Rohatka potřebuje rovné čelisti (zahnutí 0°).' };
    if (cp.konec && cp.konec !== 'rovny') return { chyba: 'Rohatka potřebuje čelisti s rovnou špičkou.' };
    if (['oblouk', 'okenko', 'kruh', 'drapy', 'kulate', 'jehla', 'lopatka', 'lzice'].includes(id)) return { chyba: 'K těmto čelistem se rohatka nehodí – zvolte ploché nebo hřebínky.' };
    const Lj = cj.delka, cl = p.vule, pz = p.roztecR, hz = Math.min(pz * 0.55, cl + 0.6), nz = Math.round(p.zubu);
    const tE = t * (cp.tKonec != null ? cp.tKonec : 100) / 100;
    const tt = Math.max(1.6, t * 0.8), xi = Lj + cl, xo = xi + tt;
    const yAo = g / 2 + tE, yB = -(g / 2 + tE);
    // pilka na vnitřní ploše jazýčku pod dolní čelistí: zuby y_k = yB − k·pz,
    // každý zub = šikmá plocha nahoru a vodorovná hrana dole (drží proti rozevření)
    const yZ0 = yB - nz * pz, yDno = yZ0 - 1.2, dl = Math.min(0.05, pz * 0.05);
    const ovh = Math.min(4, Lj * 0.3);
    const J1 = [[Lj - ovh, yAo - tE * 0.55], [Lj - ovh, yAo], [xo, yAo], [xo, yDno], [xi, yDno], [xi, yZ0]];
    for (let k = nz - 1; k >= 0; k--) {
      const yd = yB - (k + 1) * pz, yh = yB - k * pz;
      J1.push([xi - hz, yd + dl], [xi, yh]);
    }
    J1.push([xi, yAo - tE * 0.55]);
    // zub pod dolní čelistí: v zavřené poloze sedí v horním zubu pilky
    const m = 0.05, ovz = Math.min(3, Lj * 0.25);
    const Z = [[Lj - ovz, yB + tE * 0.5], [Lj - ovz, yB - pz], [xi - hz - m, yB - pz], [xi - m, yB - m], [Lj - 0.02, yB - m], [Lj - 0.02, yB + tE * 0.5]];
    let A, B;
    try { A = J.deska(J1.map(q => [q[0], q[1], 0, w])); B = J.deska(Z.map(q => [q[0], q[1], 0, w])); } catch (e) { return { chyba: 'Rohatku se nepodařilo sestavit.' }; }
    return { A: [A], B: [B] };
  }

  /* ==================================================================
     NŮŽKY – dva díly na čepu (tisk najednou)
     ================================================================== */
  const nuzky = {
    nazev: 'Nůžkové s kloubem',
    parametry: [
      { id: 'predni', nazev: 'Rameno před čepem', min: 3, max: 250, krok: 0.5, jednotka: 'mm', vychozi: 25 },
      { id: 'zadni', nazev: 'Rameno za čepem', min: 15, max: 400, krok: 0.5, jednotka: 'mm', vychozi: 70 },
      { id: 't', nazev: 'Tloušťka ramen', min: 1.5, max: 15, krok: 0.1, jednotka: 'mm', vychozi: 4, skupina: 'prurez' },
      { id: 'w', nazev: 'Šířka ramen (výška dílu)', min: 3, max: 30, krok: 0.5, jednotka: 'mm', vychozi: 7, skupina: 'prurez' },
      ...P_PRUREZ.map(q => q.id === 'tlStred' || q.id === 'sirStred' ? Object.assign({}, q, { napoveda: 'U nůžkových kleští platí pro ramena za čepem (rukojeti). 0 = beze změny.' }) : q), ...P_CELIST,
      { id: 'Yh', nazev: 'Rozevření rukojetí', min: 3, max: 120, krok: 0.5, jednotka: 'mm', vychozi: 18, napoveda: 'Vzdálenost konce rukojeti od osy, když jsou čelisti zavřené.' },
      { id: 'oblouk', nazev: 'Prohnutí předních ramen od sebe', napoveda: 'Vyklenutí ramen mezi čepem a čelistmi (kleště na led, na sklenice).', min: 0, max: 120, krok: 0.5, jednotka: 'mm', vychozi: 0 },
      { id: 'rukojeti', nazev: 'Rukojeti', typ: 'volba', vychozi: 'kruzky', volby: [['kruzky', 'kroužky na prsty'], ['rovne', 'rovné rukojeti']] },
      { id: 'dr', nazev: 'Vnitřní průměr kroužku', min: 8, max: 45, krok: 0.5, jednotka: 'mm', vychozi: 20, kdy: p => p.rukojeti === 'kruzky' },
      { id: 'tr', nazev: 'Síla kroužku', min: 1.5, max: 10, krok: 0.1, jednotka: 'mm', vychozi: 3.5, kdy: p => p.rukojeti === 'kruzky' },
      { id: 'th', nazev: 'Síla rukojeti', min: 2, max: 30, krok: 0.5, jednotka: 'mm', vychozi: 8, kdy: p => p.rukojeti === 'rovne' },
      { id: 'dk', nazev: 'Průměr kloubu', min: 6, max: 60, krok: 0.5, jednotka: 'mm', vychozi: 14, skupina: 'kloub' },
      { id: 'cep', nazev: 'Typ čepu', typ: 'volba', vychozi: 'najednou', skupina: 'kloub',
        volby: [['najednou', 'hřibový – tisk najednou'], ['zapusteny', 'zapuštěný kuželový – tisk najednou'], ['zacvak', 'zacvakávací na dílu A – díly zvlášť'],
          ['kolik', 'samostatný kolík se zacvaknutím'], ['sroub', 'šroub s maticí'], ['kovovy', 'kovový kolík / nýt']] },
      { id: 'dc', nazev: 'Průměr čepu / kolíku', min: 2, max: 30, krok: 0.1, jednotka: 'mm', vychozi: 5, skupina: 'kloub', kdy: p => p.cep !== 'sroub' },
      { id: 'sroub', nazev: 'Velikost šroubu', typ: 'volba', vychozi: 'M3', skupina: 'kloub', kdy: p => p.cep === 'sroub',
        volby: [['M2', 'M2'], ['M2.5', 'M2,5'], ['M3', 'M3'], ['M4', 'M4'], ['M5', 'M5'], ['M6', 'M6']] },
      { id: 'zacvak', nazev: 'Přesah zobáčku', min: 0.2, max: 1.5, krok: 0.05, jednotka: 'mm', vychozi: 0.5, skupina: 'kloub', kdy: p => p.cep === 'zacvak' || p.cep === 'kolik',
        napoveda: 'O kolik zobáček přesahuje otvor. Větší = drží pevněji, ale hůř se nasazuje.' },
      { id: 'vule', nazev: 'Vůle kloubu', min: 0.15, max: 1, krok: 0.05, jednotka: 'mm', vychozi: 0.35, skupina: 'kloub',
        napoveda: 'Mezera mezi čepem a otvorem i mezi díly nad sebou. Pro FDM obvykle 0,3–0,45 mm.' },
      P_MEZERA,
      { id: 'rohatka', nazev: 'Rohatka (samosvorná)', typ: 'prepinac', vychozi: false, skupina: 'rohatka',
        napoveda: 'Ozubené lišty u rukojetí jako u peánu – nástroj zůstane sevřený; uvolní se vybočením rukojetí do strany.' },
      { id: 'roztecR', nazev: 'Rozteč zubů', min: 0.8, max: 5, krok: 0.1, jednotka: 'mm', vychozi: 1.6, skupina: 'rohatka' },
      { id: 'hz', nazev: 'Výška zubů', min: 0.3, max: 3, krok: 0.05, jednotka: 'mm', vychozi: 0.8, skupina: 'rohatka' },
      P_TISK(30, 80),
      { id: 'maxRozevreni', nazev: 'Maximální rozevření', min: 0, max: 150, krok: 1, jednotka: '°', vychozi: 0, skupina: 'tisk',
        napoveda: '0 = 60°. Rozsah, ve kterém se díly nesmí srazit (a rozsah posuvníku).' },
      { id: 'doraz', nazev: 'Doraz při maximálním rozevření', typ: 'prepinac', vychozi: false, skupina: 'tisk',
        napoveda: 'Výstupek u kloubu na dílu A, o který se díl B zastaví – nástroj se nerozevře víc.' }
    ],
    pohyb: p => { const mx = p.maxRozevreni > 0 ? Math.max(p.maxRozevreni, p.otevreni) : Math.max(60, p.otevreni); return { min: 0, max: mx, tisk: p.otevreni, nazev: 'Rozevření' }; },
    stavba(p, cel, theta) {
      const war = [];
      const t = p.t, w = p.w, cl = p.vule;
      const c = { t, w, L: cel.p.L };
      const cj = celisti(cel, c, p.mezera, p.uhelSpicek);
      if (cj.kontrola) war.push(cj.kontrola);
      const g = cj.g, ov = cj.presah;
      const KL = kloubNuzek(p, w, cl, war), dEnd = KL.rMax + 0.8;
      let Rd = Math.max(p.dk / 2, Math.sqrt(dEnd * dEnd + t * t / 4) + 0.6, KL.rMax + 1.4);
      if (Rd > p.dk / 2 + 0.01) war.push('Průměr kloubu zvětšen na ' + (2 * Rd).toFixed(1) + ' mm, aby se do něj vešel čep i ramena.');
      // kloub nesmí zasahovat do čelistí ani do rukojeti
      const predni = Math.max(p.predni, Rd + t + 2), zadni = Math.max(p.zadni, Rd + 3 * t + 6);
      if (predni > p.predni) war.push('Rameno před čepem prodlouženo na ' + predni.toFixed(1) + ' mm – jinak by kloub zasahoval do čelistí.');
      if (zadni > p.zadni) war.push('Rameno za čepem prodlouženo na ' + zadni.toFixed(1) + ' mm kvůli velikosti kloubu.');
      const P0 = [-predni, 0];
      // rameno A: vnitřní plocha o 0,6·vůle od rozhraní (ramena se nedotknou)
      const tA = t - 0.6 * cl, yA = g / 2 + 0.6 * cl + tA / 2;
      const HA = [P0[0] - zadni, -Math.max(p.Yh, t)];
      // přední rameno jde souběžně s osou a až před čepem se stočí do křížení
      // (sbíhající se ramena by se překrývala po celé délce)
      const xS = Math.min(-0.5, P0[0] + Rd + 1.5 * t);
      // vyklenutí nejvýš 0,7× délky přímé části, jinak křivka udělá smyčku
      const obl = Math.max(-yA * 0.5, Math.min(p.oblouk, Math.abs(xS) * 0.7));
      if (Math.abs(obl - p.oblouk) > 0.05) war.push('Vyklenutí ramen zmenšeno na ' + obl.toFixed(1) + ' mm – na tak krátkém rameni by se křivka zauzlila.');
      const smerKon = (() => { const d = [HA[0] - P0[0], HA[1] - P0[1]], l = Math.hypot(d[0], d[1]); return [d[0] / l, d[1] / l]; })();
      const alfa = rad(p.uhelCelisti || 0), Lp = omez(p.prechod == null ? 6 : p.prechod, 0, Math.abs(xS) * 0.9);
      const pol = (p.polohaStredu || 50) / 100;
      const bump = prohnuti(1, pol);
      const rc = (p.dr || 20) / 2 + (p.tr || 3.5) / 2;
      const kruhA = p.rukojeti === 'kruzky' ? [HA[0] + smerKon[0] * rc, HA[1] + smerKon[1] * rc] : null;
      const pasT = pasTvar(tvarRamen(p, war), p.zaobleniHran);
      // dráha ramene horní strany s čelistí natočenou o al (u dílu B se pak zrcadlí)
      function draha(al, zrc) {
        const K = konecRamene(yA, ov, al, cj, zrc);
        const pred = [K.koren];
        if (obl) pred.push([xS / 2, yA + obl]);
        pred.push([xS, yA], P0, HA);
        let P = [K.konec, K.stred].concat(J.krivka(pred, [-K.smer[0], -K.smer[1]], smerKon, 0.5));
        P = ostryKoren(J.prevzorkuj(P, 0.45).reverse(), K).reverse();
        // rozdělení na rameno před a za čepem
        const d = P.map(q => Math.hypot(q[0] - P0[0], q[1] - P0[1]));
        const i1 = d.findIndex(x => x < dEnd), i2 = d.length - 1 - d.slice().reverse().findIndex(x => x < dEnd);
        const rez = (a, b) => { const k = (dEnd - d[a]) / (d[b] - d[a]); return [lerp(P[a][0], P[b][0], k), lerp(P[a][1], P[b][1], k)]; };
        // bod ořezu těsně u předchozího vzorku by dal úsek pod 0,05 mm (průřez se překlopí)
        const blizko = (q, r) => Math.hypot(q[0] - r[0], q[1] - r[1]) < 0.15;
        const Pp = P.slice(0, i1), cP = rez(i1 - 1, i1);
        if (Pp.length > 2 && blizko(Pp[Pp.length - 1], cP)) Pp.pop();
        Pp.push(cP);
        const zb2 = P.slice(i2 + 1), cZ = rez(i2 + 1, i2);
        if (zb2.length > 2 && blizko(zb2[0], cZ)) zb2.shift();
        let Pz = [cZ].concat(zb2);
        // rukojeť: konec do kroužku / zesílená rukojeť
        if (p.rukojeti === 'kruzky') Pz = Pz.concat([[HA[0] + smerKon[0] * p.tr * 0.35, HA[1] + smerKon[1] * p.tr * 0.35]]);
        else Pz = Pz.concat([[HA[0] + smerKon[0] * p.th * 0.5, HA[1] + smerKon[1] * p.th * 0.5]]);
        Pz = J.prevzorkuj(Pz, 0.45);
        const Rp = J.ramce(Pp), Rz = J.ramce(Pz), iK = vzdalenostOd(Pp, Rp.S, K.koren).iq;
        // tloušťka a šířka za čepem (rukojeť): rovná rukojeť se zesílí, uprostřed volitelně jinak
        const fZ = i => Rz.S[i] / Rz.L;
        const tlZ = i => {
          let tt = Math.max(Math.min(0.8, t), t + (p.tlStred > 0 ? (p.tlStred - t) * bump(fZ(i)) : 0));
          if (p.rukojeti !== 'rovne') return tt;
          const s = Rz.S[i], L = Rz.L, s1 = L * 0.35, zb = p.th * 0.5;
          tt = lerp(tt, Math.max(tt, p.th), hladce((s - s1 * 0.6) / (s1 * 0.8 + 1e-6)));
          if (s > L - zb) tt *= Math.sqrt(Math.max(0.06, 1 - Math.pow((s - (L - zb)) / zb, 2)));
          return tt;
        };
        const wZ = i => Math.max(Math.min(0.8, w), w + (p.sirStred > 0 ? (p.sirStred - w) * bump(fZ(i)) : 0));
        // průřezy; lam = podíl půlení výšky v kloubu, horni = díl B (horní polovina)
        const rPred = (i, lam, horni) => {
          const vJ = i < iK, ve = vJ ? EPS : 0;
          return { u0: -tA / 2 + ve, u1: tA / 2 - ve, v0: ve + (horni ? lam * (w / 2 + cl / 2) : 0), v1: (w - ve) - (horni ? 0 : lam * (w / 2 + cl / 2)),
            ven: -1, k: prolnuti(Rp.S[i] - Rp.S[iK], Lp) };
        };
        const rZad = (i, lam, horni) => {
          // v místě půlení u kloubu musí mít rameno aspoň plnou šířku (jinak se poloviny převrátí)
          const ww = Math.max(wZ(i), w * hladce(lam * 4));
          return { u0: -tlZ(i) / 2, u1: tlZ(i) / 2, v0: horni ? lam * (w / 2 + cl / 2) : 0, v1: horni ? ww : ww - lam * (ww - w / 2 + cl / 2), ven: 1 };
        };
        // místní poloměr ohybu osy proti polovině tloušťky (jinak se průřez přeloží)
        let tesne = false;
        for (let i = 1; i + 1 < Pz.length && !tesne; i++) if (J.minPolomer(Pz, i, i + 2) < tlZ(i) / 2 + 0.1) tesne = true;
        for (let i = 1; i + 1 < Pp.length && !tesne; i++) if (J.minPolomer(Pp, i, i + 2) < tA / 2 + 0.1) tesne = true;
        return { Pp, Pz, Rp, Rz, rPred, rZad, tesne };
      }
      const dA = draha(alfa), dB = draha(-alfa, true);
      if (dA.tesne || dB.tesne) war.push('Rameno je v ohybu u čepu tlustší, než dovolí jeho zakřivení – zmenšete tloušťku uprostřed ramen nebo ji posuňte dál od čepu.');
      const st0 = d => ({ p: pasT(d.Pp, i => d.rPred(i, 0)), z: pasT(d.Pz, i => d.rZad(i, 0)) });
      const sA = st0(dA), sBm = st0(dB);
      // překryv s druhým dílem při rozevření 0 … max: druhý díl = zrcadlo, otočené o −θ
      const tMax = p.maxRozevreni > 0 ? Math.max(p.maxRozevreni, p.otevreni) : Math.max(60, p.otevreni);
      const vz = [0, 0.1, 0.25, 0.5, 0.75, 1].map(k => k * tMax);
      const stopyDruheho = (s, th) => J.stopyPasu(otocStanice(zrcadliStanice(s.p), P0, -rad(th)))
        .concat(J.stopyPasu(otocStanice(zrcadliStanice(s.z), P0, -rad(th))), [J.stopaKruhu(P0, Rd)]);
      function lamy(d, s, druhy) {
        const sO = vz.map(th => stopyDruheho(druhy, th));
        const prP = J.prekryvPasu(d.Pp.length - 1, vz.length, k => [J.stopyPasu(s.p), sO[k]], cl);
        // náběh na poloviční výšku smí vést jen po rameni, ne až do čelisti
        const iF = prP.indexOf(1), iJ = d.Pp.findIndex(q => Math.hypot(q[0], q[1]) > Lp + ov + 0.5 && q[0] < -0.5);
        const nabP = iF > 0 && iJ >= 0 ? Math.max(1, Math.min(w * 0.7, d.Rp.S[iF] - d.Rp.S[iJ])) : Math.max(w * 0.7, 2);
        return {
          lamP: J.podilPulky(d.Rp.S, prP, nabP),
          lamZ: J.podilPulky(d.Rz.S, J.prekryvPasu(d.Pz.length - 1, vz.length, k => [J.stopyPasu(s.z), sO[k]], cl), Math.max(w * 0.7, 2))
        };
      }
      const LA = lamy(dA, sA, sBm), LB = lamy(dB, sBm, sA);
      for (let i = 0; i < dA.Pp.length; i++) if (LA.lamP[i] > 0.01 && dA.Pp[i][0] > -0.5) { war.push('Ramena se u čelistí překrývají – zvětšete mezeru nebo rameno před čepem.'); break; }
      const zd = w / 2 - cl / 2;                 // spodní polovina kloubu (díl A)
      if (J.prelozene(sA.p) || J.prelozene(sA.z) || J.prelozene(sBm.p)) war.push('Rameno je zahnuté ostřeji, než dovolí jeho tloušťka – síť se přeloží. Zmenšete vyklenutí, úhel čelistí nebo tloušťku, případně prodlužte přechod.');
      // díl A (dole v kloubu) s čepem
      const K = KL.postav(P0, Rd);
      const A = [
        J.tazeni(pasT(dA.Pp, i => dA.rPred(i, LA.lamP[i])), false),
        J.tazeni(pasT(dA.Pz, i => dA.rZad(i, LA.lamZ[i])), false),
        ...K.A
      ];
      // díl B (nahoře v kloubu) – zrcadlo dráhy s opačným úhlem čelisti
      const stPB = zrcadliStanice(pasT(dB.Pp, i => dB.rPred(i, LB.lamP[i], true)));
      const stZB = zrcadliStanice(pasT(dB.Pz, i => dB.rZad(i, LB.lamZ[i], true)));
      const B = [J.tazeni(stPB, false), J.tazeni(stZB, false), ...K.B];
      // doraz: výstupek na dílu A těsně za kloubem, o který se přední rameno B
      // zastaví při maximálním rozevření
      if (p.doraz) {
        const thM = rad(tMax), r1 = Rd + cl + 0.3, r2 = Rd + 0.3 + Math.max(2.5, 0.8 * t);
        // úhlový rozsah předního ramene B (zavřená poloha) v pásmu r1…r2
        let fMin = Infinity;
        for (const q of stPB) for (const [u] of q.rez) {
          const x = q.P[0] + u * q.U[0] - P0[0], y = q.P[1] + u * q.U[1] - P0[1], r = Math.hypot(x, y);
          if (r >= r1 - 0.5 && r <= r2 + 0.5) fMin = Math.min(fMin, Math.atan2(y, x));
        }
        if (!isFinite(fMin)) war.push('Doraz se nepodařilo umístit – přední rameno je od kloubu příliš daleko.');
        else {
          const sirka = Math.max(2.5, t) / ((r1 + r2) / 2), f1 = fMin - thM, f0 = f1 - sirka;
          // zadní rameno (rukojeť) B nesmí při žádném rozevření 0…max do dorazu
          // narazit – při velkém maximálním rozevření by výstupek ležel na ní
          const uhlyZ = [];
          for (const q of stZB) for (const [u] of q.rez) {
            const x = q.P[0] + u * q.U[0] - P0[0], y = q.P[1] + u * q.U[1] - P0[1], r = Math.hypot(x, y);
            if (r >= Rd - 1 && r <= r2 + 1) uhlyZ.push(Math.atan2(y, x));
          }
          const vRozsahu = (a, lo, hi) => { const d = ((a - lo) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); return d <= hi - lo; };
          const okraj = rad(3);
          let srazka = false;
          for (let th = 0; th <= thM + 1e-9 && !srazka; th += rad(2)) for (const a of uhlyZ) if (vRozsahu(a - th, f0 - okraj, f1 + okraj)) { srazka = true; break; }
          if (srazka) war.push('Doraz pro maximální rozevření ' + Math.round(tMax) + '° by narazil do rukojeti druhého dílu – zmenšete maximální rozevření; doraz se nevložil.');
          else {
            const vysec = (ra, rb, a0, a1, z0, z1) => {
              const o = [];
              for (let k = 0; k <= 8; k++) { const a = lerp(a0, a1, k / 8); o.push([P0[0] + rb * Math.cos(a), P0[1] + rb * Math.sin(a), z0, z1]); }
              for (let k = 8; k >= 0; k--) { const a = lerp(a0, a1, k / 8); o.push([P0[0] + ra * Math.cos(a), P0[1] + ra * Math.sin(a), z0, z1]); }
              return J.deska(o);
            };
            A.push(vysec(r1, r2, f0, f1, 0, w), vysec(Rd - 0.6, r1 + 0.4, f0, f1, 0, zd));
            if (p.otevreni > tMax - 2) war.push('Tiskové rozevření je u dorazu – zmenšete ho aspoň o 2° pod maximální rozevření.');
          }
        }
      }
      const Pz = dA.Pz;
      if (kruhA) {
        A.push(krouzek(kruhA[0], kruhA[1], rc, p.tr, w));
        B.push(krouzek(kruhA[0], -kruhA[1], rc, p.tr, w));
        const ro = rc + p.tr / 2;
        if (Math.abs(kruhA[1]) < ro + 0.8) war.push('Kroužky se v zavřené poloze překrývají – zvětšete rozevření rukojetí.');
      }
      let tiskMin = 0;
      if (p.rohatka) {
        const r = rohatkaNuzek(p, Pz, P0, t, w, cl);
        if (r.chyba) war.push(r.chyba);
        else { A.push(r.A); B.push(r.B); tiskMin = r.tiskMin; if (p.otevreni < tiskMin) war.push('Rohatka se při tiskovém rozevření překrývá – zvětšete rozevření při tisku aspoň na ' + Math.ceil(tiskMin) + '°.'); }
      }
      A.push(...natocCelist(cj.A.telesa, cj, 1, alfa));
      B.push(...natocCelist(cj.B.telesa, cj, -1, alfa));
      const u = -rad(theta);
      // díly tištěné zvlášť mají každý svou skupinu (B se tiskne obráceně)
      const casti = [
        { nazev: K.cep.length || p.cep === 'sroub' || p.cep === 'kovovy' ? 'Díl A' : 'Díl A s čepem', role: 'A', telesa: A, skupina: K.zvlast ? 'A' : 'sestava', rozpad: [0, 0, 0] },
        { nazev: 'Díl B', role: 'B', telesa: otocVse(B, P0, u), skupina: K.zvlast ? 'B' : 'sestava', otocit: K.zvlast, rozpad: [0, 0, 1] }
      ];
      if (K.cep.length) casti.push({ nazev: 'Kolík', role: 'cep', telesa: K.cep, skupina: 'cep', rozpad: [0, 0, -1] });
      const tpu = [...natocCelist(cj.A.tpu, cj, 1, alfa), ...otocVse(natocCelist(cj.B.tpu, cj, -1, alfa), P0, u)];
      if (tpu.length) casti.push({ nazev: 'Polštářky (TPU)', role: 'tpu', telesa: tpu });
      if (w < 4) war.push('Při šířce pod 4 mm zbude v kloubu na každý díl méně než 1,8 mm.');
      return { casti, varovani: war, info: { kloub: true, vule: cl, tiskMin, tipyKloubu: K.tipy, tiskZvlast: K.zvlast } };
    }
  };

  /* ==================================================================
     KLOUB NŮŽEK – typy čepu
     Díl A má v kloubu spodní polovinu (z 0 … zd), díl B horní (zh … w).
     kloubNuzek → { rMax (největší otvor – kam až smí ramena), postav(P0, Rd) }
     postav → { A: [tělesa], B: [tělesa], cep: [tělesa samostatného kolíku],
                zvlast (díly se tisknou zvlášť), tipy: [text] }
     ================================================================== */
  const SROUBY = {   // d, hlava dk × k, matice s (přes plochy) × m
    M2: [2, 3.8, 2, 4, 1.6], 'M2.5': [2.5, 4.5, 2.5, 5, 2], M3: [3, 5.5, 3, 5.5, 2.4], M4: [4, 7, 4, 7, 3.2], M5: [5, 8.5, 5, 8, 4], M6: [6, 10, 6, 10, 5]
  };
  const DELKY_SROUBU = [6, 8, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 50, 60];

  // prstenec rotací průřezu [[r, z], …] kolem svislé osy (uzavřené tažení)
  function prstenec(cx, cy, prof, n) {
    n = n || 64;
    const st = [];
    for (let k = 0; k < n; k++) {
      const a = 2 * Math.PI * k / n;
      st.push({ P: [cx, cy, 0], U: [Math.cos(a), Math.sin(a), 0], W: [0, 0, 1], rez: prof });
    }
    return J.tazeni(st, true);
  }
  // polovina rozříznutého čepu (y ≥ s/2 pro sig = 1): tažení svisle,
  // R = [[z, r], …] průběh poloměru (zachycovací zobáček)
  function pulCepu(cx, cy, R, sig, s) {
    const st = [];
    for (const [z, r] of R) {
      const a0 = Math.asin(Math.min(0.9, (s / 2) / r)), rez = [];
      for (let k = 0; k <= 18; k++) { const a = a0 + (Math.PI - 2 * a0) * k / 18; rez.push([r * Math.cos(a), sig * r * Math.sin(a)]); }
      st.push({ P: [cx, cy, z], U: [1, 0, 0], W: [0, 1, 0], rez });
    }
    return J.tazeni(st, false);
  }
  function sestiuhelnik(cx, cy, s, a, b) {
    const R = s / Math.sqrt(3), out = [];
    for (let k = 0; k < 6; k++) { const u = Math.PI / 6 + k * Math.PI / 3; out.push([cx + R * Math.cos(u), cy + R * Math.sin(u), a, b]); }
    return out;
  }

  function kloubNuzek(p, w, cl, war) {
    const typ = p.cep || 'najednou', rp = p.dc / 2;
    const zd = w / 2 - cl / 2, zh = w / 2 + cl / 2;
    const vs = 0.15;                                   // vůle zacvaknutí (díly se skládají)
    const lip = Math.max(0.2, p.zacvak || 0.5);
    const s = Math.max(0.8, 2 * lip + 0.3);            // šířka zářezu v čepu
    const sr = SROUBY[p.sroub] || SROUBY.M3;
    let rMax;
    if (typ === 'najednou') rMax = rp + cl;
    else if (typ === 'zapusteny') rMax = rp + Math.max(1, cl + 0.8) + cl * 1.42;
    else if (typ === 'zacvak') rMax = rp + vs;
    else if (typ === 'kolik') rMax = rp + 1.2 + 0.2;
    else if (typ === 'sroub') rMax = Math.max((sr[3] + 0.3) / Math.sqrt(3), sr[1] / 2 + 0.3, sr[0] / 2 + 0.2);
    else rMax = rp + 0.15;                             // kovový kolík
    if ((typ === 'zacvak' || typ === 'kolik') && rp < s / 2 + 0.7) war.push('Čep je na zacvaknutí tenký – zvětšete průměr čepu aspoň na ' + (s + 1.4).toFixed(1) + ' mm.');

    function postav(P0, Rd) {
      const [cx, cy] = P0, A = [], B = [], cep = [], tipy = [];
      let zvlast = false;
      const disk = (r0, a, b, diry) => J.deska(kruhDira(cx, cy, r0, a, b, 64), (diry || []).map(d => d.map(q => [q[0], q[1], a, b])));
      // rozříznutý zobáček nad horní plochou dílu B (z = w)
      const zobacek = (zs) => {
        const z0 = w + 0.15, z1 = z0 + 0.35, zt = z1 + (lip + 0.3) * 1.2;
        const R = [[zs, rp], [z0 - 0.01, rp], [z0, rp + lip], [z1, rp + lip], [zt, Math.max(0.6, rp - 0.3)]];
        return [pulCepu(cx, cy, R, 1, s), pulCepu(cx, cy, R, -1, s)];
      };
      if (typ === 'najednou') {
        const rd = rp + cl, rh = Math.min(rd + 1.1, Rd - 0.3), z1 = w + cl, h = 0.9;
        A.push(disk(Rd, 0, zd), J.rotace([[0, 0], [rp, 0], [rp, z1], [rh, z1 + (rh - rp)], [rh, z1 + (rh - rp) + h], [0, z1 + (rh - rp) + h]], 40, cx, cy));
        B.push(disk(Rd, zh, w, [kruhDira(cx, cy, rd, zh, w, 40)]));
        tipy.push(`Kloub se tiskne najednou: hřibový čep dílu A prochází otvorem dílu B s vůlí ${cl} mm. Po tisku ho opatrně rozhýbejte.`);
      } else if (typ === 'zapusteny') {
        // kuželová hlava zarovnaná s horní plochou, otvor B s kuželovým zahloubením
        let rhd = rp + Math.max(1, cl + 0.8);
        let zc = w - (rhd - rp);
        if (zc < zh + 0.6) { rhd = rp + Math.max(0.3, w - zh - 0.6); zc = w - (rhd - rp); }
        const k2 = cl * Math.SQRT2;
        A.push(disk(Rd, 0, zd), J.rotace([[0, 0], [rp, 0], [rp, zc], [rhd, w], [0, w]], 48, cx, cy));
        const zk = Math.max(zh + 0.05, zc + cl - k2);
        B.push(prstenec(cx, cy, [[Rd, zh], [Rd, w], [rhd + k2, w], [rp + cl, zk], [rp + cl, zh]]));
        tipy.push(`Zapuštěný čep: kuželová hlava lícuje s horní plochou, tiskne se najednou s vůlí ${cl} mm (kuželem i do strany).`);
      } else if (typ === 'zacvak') {
        zvlast = true;
        const zs = Math.max(zd * 0.5, zh - Math.max(2, 1.5 * rp));
        A.push(disk(Rd, 0, zd), J.rotace([[0, 0], [rp, 0], [rp, zs + 0.4], [0, zs + 0.4]], 40, cx, cy), ...zobacek(zs));
        B.push(disk(Rd, zh, w, [kruhDira(cx, cy, rp + vs, zh, w, 40)]));
        tipy.push('Zacvakávací čep: díly A a B se tisknou zvlášť (díl B obráceně). Po tisku nasaďte díl B na čep a zatlačte – rozříznutý čep pruží a zobáček zacvakne nad dílem B.');
      } else if (typ === 'kolik') {
        zvlast = true;
        const rk = rp + 1.2, zk = rk - rp, zs = Math.max(zk + 0.6, zh - Math.max(2, 1.5 * rp));
        // díl A: otvor se zahloubením zespodu (hlava kolíku lícuje s podložkou)
        A.push(prstenec(cx, cy, [[Rd, 0], [Rd, zd], [rp + vs, zd], [rp + vs, zk], [rk + 0.2, 0]]));
        B.push(disk(Rd, zh, w, [kruhDira(cx, cy, rp + vs, zh, w, 40)]));
        cep.push(J.rotace([[0, 0], [rk, 0], [rp, zk], [rp, zs + 0.4], [0, zs + 0.4]], 40, cx, cy), ...zobacek(zs));
        tipy.push('Samostatný kolík: tisknou se tři díly (B obráceně, kolík nastojato hlavou dolů). Kolík prostrčte zespodu dílem A i B, zobáček zacvakne nahoře; kloub jde znovu rozebrat stlačením zobáčku.');
      } else if (typ === 'sroub') {
        const [d, dk, k, sm, m] = sr, rs = d / 2 + 0.2, hn = m + 0.3, kc = k + 0.2;
        if (hn > zd - 0.6) war.push(`Matice ${p.sroub} se do spodní poloviny kloubu nevejde – zvětšete šířku dílu aspoň na ${(2 * (hn + 0.6) + cl).toFixed(1)} mm.`);
        A.push(J.deska(kruhDira(cx, cy, Rd, 0, Math.min(hn, zd - 0.4), 64), [sestiuhelnik(cx, cy, sm + 0.3, 0, Math.min(hn, zd - 0.4))]),
          disk(Rd, Math.min(hn, zd - 0.4) - 0.01, zd, [kruhDira(cx, cy, rs, 0, 0, 32)]));
        const zahl = (w - zh) - kc >= 0.8;
        if (zahl) B.push(disk(Rd, zh, w - kc, [kruhDira(cx, cy, rs, 0, 0, 32)]), disk(Rd, w - kc - 0.01, w, [kruhDira(cx, cy, dk / 2 + 0.3, 0, 0, 40)]));
        else B.push(disk(Rd, zh, w, [kruhDira(cx, cy, rs, 0, 0, 32)]));
        const sevreni = (zahl ? w - kc : w);
        const L = DELKY_SROUBU.find(x => x >= sevreni - 0.5) || DELKY_SROUBU[DELKY_SROUBU.length - 1];
        tipy.push(`Šroub ${p.sroub || 'M3'}×${L} s maticí: kloub se tiskne najednou s vůlí ${cl} mm, matici vložte zespodu do šestihranného lůžka, šroub shora` + (zahl ? ' (hlava se zapustí).' : '.') + ' Utáhněte jen tak, aby se kleště volně otáčely.');
        if (!zahl) tipy.push('Na zahloubení hlavy šroubu je díl tenký – hlava zůstane nad povrchem.');
      } else {
        // kovový kolík / nýt: v A natěsno, v B volně
        A.push(disk(Rd, 0, zd, [kruhDira(cx, cy, rp - 0.03, 0, 0, 40)]));
        B.push(disk(Rd, zh, w, [kruhDira(cx, cy, rp + 0.15, 0, 0, 40)]));
        tipy.push(`Kovový kolík Ø ${p.dc} mm (hřebík, drát, nýt): tiskne se najednou, kolík se zalisuje do dílu A a v dílu B se volně otáčí. Délka kolíku ${w.toFixed(1)} mm, konce můžete roznýtovat.`);
      }
      return { A, B, cep, zvlast, tipy };
    }
    return { rMax, postav, zd, zh };
  }

  // ozubené lišty rohatky na obloucích kolem čepu
  function rohatkaNuzek(p, Pz, P0, t, w, cl) {
    const RA = [Pz[Pz.length - 1][0] - P0[0], Pz[Pz.length - 1][1] - P0[1]];
    const rr = Math.hypot(RA[0], RA[1]) * (p.rukojeti === 'kruzky' ? 0.97 : 0.86);
    // bod osy ramene A ve vzdálenosti rr
    let fiA = null;
    for (let i = 1; i < Pz.length; i++) {
      const a = Math.hypot(Pz[i - 1][0] - P0[0], Pz[i - 1][1] - P0[1]), b = Math.hypot(Pz[i][0] - P0[0], Pz[i][1] - P0[1]);
      if ((a - rr) * (b - rr) <= 0) { const k = (rr - a) / (b - a || 1); fiA = Math.atan2(lerp(Pz[i - 1][1], Pz[i][1], k) - P0[1], lerp(Pz[i - 1][0], Pz[i][0], k) - P0[0]); break; }
    }
    if (fiA === null || fiA > -Math.PI / 2) return { chyba: 'Rohatku nelze umístit – rukojeti musí mířit dozadu za čep.' };
    const delta = Math.PI + fiA;             // polovina úhlu mezi rukojetmi
    const tb = Math.min(t, 3.2), pz = p.roztecR;
    let f = 1 - (t / 2 + tb / 2 + cl + 1.2) / (2 * delta * rr);
    if (f < 0.56) return { chyba: 'Rukojeti jsou u rohatky příliš blízko u sebe – zvětšete jejich rozevření.' };
    f = Math.min(f, 0.7);
    const om = (2 * f - 1) * 2 * delta;     // úhel překryvu lišt v zavřené poloze
    const tau = a => { let x = a - Math.PI; x = Math.atan2(Math.sin(x), Math.cos(x)); return x * rr; };
    const zi = a => w / 2 + p.hz * (zlomek(tau(a) / pz) - 0.5);
    const lista = (a0, a1, horni) => {
      const L = Math.abs(a1 - a0) * rr, n = Math.max(12, Math.ceil(L / (pz / 8)));
      const A = [];
      for (let k = 0; k <= n; k++) A.push(lerp(a0, a1, k / n));
      // zlomy pilky (tau = k·pz) ± ε
      const tmin = Math.min(tau(a0), tau(a1)), tmax = Math.max(tau(a0), tau(a1));
      for (let k = Math.ceil(tmin / pz); k * pz <= tmax; k++) for (const e of [-0.008, 0.008]) {
        const tt = k * pz + e; if (tt <= tmin || tt >= tmax) continue;
        // úhel s tau = tt na úseku a0..a1
        const a = Math.PI + tt / rr; const q = Math.atan2(Math.sin(a), Math.cos(a));
        for (const cand of [q, q - 2 * Math.PI, q + 2 * Math.PI]) if ((cand - a0) * (cand - a1) < 0) A.push(cand);
      }
      A.sort((x, y) => a1 > a0 ? x - y : y - x);
      const st = [];
      for (const a of A) {
        const e = [Math.cos(a), Math.sin(a)];
        const z = zi(a);
        st.push({ P: [P0[0], P0[1], 0], U: [e[0], e[1], 0], W: [0, 0, 1], rez: J.obdelnik(rr - tb / 2, rr + tb / 2, horni ? z : 0, horni ? w : z, 0, 1) });
      }
      return J.tazeni(st, false);
    };
    const eps = (t * 0.45) / rr;
    const A = lista(fiA + eps, fiA - f * 2 * delta, true);
    const fiB = Math.PI - delta;
    const B = lista(fiB - eps, fiB + f * 2 * delta, false);
    return { A, B, tiskMin: (om + cl / rr) * 180 / Math.PI + 2 };
  }

  /* ==================================================================
     KLIP – klip na sáčky se západkou
     ================================================================== */
  const klip = {
    nazev: 'Klip se západkou',
    bezRamen: true,
    celisti: ['hladka', 'podelne', 'pricne', 'pilove', 'vlnite', 'mrizka', 'debakey', 'hreben', 'drazky', 'navlek'],
    pevneCelisti: { ohyb: 0, konec: 'rovny', tKonec: 100, wKonec: 100 },
    parametry: [
      { id: 'L', nazev: 'Délka klipu', min: 20, max: 300, krok: 1, jednotka: 'mm', vychozi: 90 },
      { id: 't', nazev: 'Tloušťka ramen', min: 1.5, max: 15, krok: 0.1, jednotka: 'mm', vychozi: 3.5 },
      { id: 'w', nazev: 'Šířka', min: 4, max: 40, krok: 0.5, jednotka: 'mm', vychozi: 10 },
      { id: 'th', nazev: 'Tloušťka pantu', min: 0.4, max: 3, krok: 0.05, jednotka: 'mm', vychozi: 0.9, napoveda: 'Tenký pružný pásek; z PETG nebo PP vydrží tisíce ohybů, z PLA méně.' },
      { id: 'thHak', nazev: 'Síla háčku', min: 0.8, max: 6, krok: 0.1, jednotka: 'mm', vychozi: 1.8 },
      { id: 'zachyt', nazev: 'Zachycení háčku', min: 0.4, max: 5, krok: 0.1, jednotka: 'mm', vychozi: 1.4 },
      { id: 'vule', nazev: 'Vůle háčku', min: 0.1, max: 1, krok: 0.05, jednotka: 'mm', vychozi: 0.3 },
      P_MEZERA,
      P_TISK(28, 80)
    ],
    pohyb: p => ({ min: 0, max: Math.max(p.otevreni * 1.3, 10), tisk: p.otevreni, nazev: 'Rozevření' }),
    stavba(p, cel, theta) {
      const war = [];
      const cp = Object.assign({}, cel.p, klip.pevneCelisti, { L: p.L });
      const t = p.t, w = p.w, c = { t, w, L: p.L };
      const cj = celisti({ id: cel.id, p: cp }, c, p.mezera);
      if (cj.kontrola) war.push(cj.kontrola);
      const g = cj.g, pr = cj.presah, L = p.L, th = Math.min(p.th, t * 0.8);
      if (p.th > t * 0.8 + 1e-9) war.push('Pant je tenčí, než je zadáno: ' + th.toFixed(2).replace('.', ',') + ' mm (nejvýš 0,8 × tloušťka čelistí).');
      const Rh = g / 2 + t - th / 2;
      // pant: rovně v čelisti A → půloblouk → rovně v čelisti B
      const P = [[pr * 0.8, Rh], [0, Rh]];
      for (let k = 1; k < 40; k++) { const a = Math.PI / 2 + Math.PI * k / 40; P.push([Rh * Math.cos(a), Rh * Math.sin(a)]); }
      P.push([0, -Rh], [pr * 0.8, -Rh]);
      const Pp = J.prevzorkuj(P, 0.3), Rm = J.ramce(Pp);
      // A je na začátku → podíl ohybu: 1 v čelisti A, 0 v čelisti B
      const fi = i => Pp[i][0] >= 0 ? (Pp[i][1] > 0 ? 1 : 0) : hladce(0.5 + Math.atan2(Pp[i][1], -Pp[i][0]) / Math.PI);
      const st = J.pasPoKrivce(Pp, i => {
        const vJ = Pp[i][0] > 0;
        // vnější strana pantu (−U) lícuje s hřbetem čelistí – v čelisti o kousek uvnitř
        return { u0: -th / 2 + (vJ ? EPS : 0), u1: th / 2 - (vJ ? EPS : 0), v0: vJ ? EPS : 0, v1: vJ ? w - EPS : w };
      }, 0, 1);
      const u = rad(theta);
      const pant = J.tazeni(ohniStanice(st, [0, 0], i => u * fi(i)), false);
      // háček na konci čelisti A
      const yAo = g / 2 + t, yBo = -(g / 2 + t), cl = p.vule;
      const xi = L + cl, xo = xi + p.thHak, ylt = yBo - cl, lipT = Math.max(1.2, t * 0.4), ylb = ylt - lipT;
      const ovh = Math.min(4, L * 0.1), zach = Math.min(p.zachyt, L * 0.3);
      const hak = J.deska([[L - ovh, yAo - t * 0.45], [L - ovh, yAo], [xo, yAo], [xo, ylb], [L - zach, ylb], [L - zach, ylb + lipT * 0.4], [L - zach * 0.15, ylt], [xi, ylt], [xi, yAo - t * 0.45]]
        .map(q => [q[0], q[1], 0, w]));
      const casti = [{ nazev: 'Klip', role: 'telo', telesa: [pant, ...otocVse(cj.A.telesa.concat([hak]), [0, 0], u), ...cj.B.telesa] }];
      const tpu = [...otocVse(cj.A.tpu, [0, 0], u), ...cj.B.tpu];
      if (tpu.length) casti.push({ nazev: 'Polštářky (TPU)', role: 'tpu', telesa: tpu });
      return { casti, varovani: war, info: { pruzna: true, tiskNaBoku: true } };
    }
  };

  const GENERATORY = { vidlice, krizova, smycka, nuzky, klip };

  /* ==================================================================
     PŘEDVOLBY – co uživatel vybírá v galerii
     ================================================================== */
  const KATEGORIE = [
    ['pinzety', 'Pinzety'],
    ['kleste', 'Kleště'],
    ['kuchyn', 'Kuchyňské kleště'],
    ['svorky', 'Svorky a samosvorné']
  ];
  const PREDVOLBY = [
    // pinzety
    { id: 'pinzeta-anatomicka', kat: 'pinzety', nazev: 'Pinzeta anatomická', popis: 'Rovná pinzeta s příčnými rýhami.', gen: 'vidlice', p: {}, cel: 'pricne', celP: { L: 24, konec: 'zaobleny', tKonec: 70, wKonec: 45 } },
    { id: 'pinzeta-jehlova', kat: 'pinzety', nazev: 'Pinzeta jehlová', popis: 'Jemný hrot na třísky a SMD.', gen: 'vidlice', p: { w: 7, wb: 9 }, cel: 'jehla', celP: { L: 30 } },
    { id: 'pinzeta-zahnuta', kat: 'pinzety', nazev: 'Pinzeta zahnutá', popis: 'Hrot zahnutý v rovině rozevření.', gen: 'vidlice', p: { w: 7, wb: 9 }, cel: 'jehla', celP: { L: 30, ohyb: 35 } },
    { id: 'pinzeta-chirurgicka', kat: 'pinzety', nazev: 'Pinzeta chirurgická 1×2', popis: 'Zub proti dvěma zubům.', gen: 'vidlice', p: {}, cel: 'zuby12', celP: { L: 24, wKonec: 60 } },
    { id: 'pinzeta-debakey', kat: 'pinzety', nazev: 'Pinzeta atraumatická', popis: 'Podélné řady jemných zoubků (DeBakey).', gen: 'vidlice', p: { L: 150, w: 7 }, cel: 'debakey', celP: { L: 30, konec: 'zaobleny', wKonec: 55 } },
    { id: 'pinzeta-znamky', kat: 'pinzety', nazev: 'Pinzeta na známky', popis: 'Široké tenké lopatky.', gen: 'vidlice', p: { w: 7, wb: 9, vroubky: 6 }, cel: 'lopatka', celP: { L: 26 } },
    { id: 'pinzeta-mekka', kat: 'pinzety', nazev: 'Pinzeta s polštářky', popis: 'Polštářky z TPU – sklo, objektivy, mince.', gen: 'vidlice', p: { w: 9, wb: 10, t: 2.4, tb: 2.6 }, cel: 'navlek', celP: { L: 24, konec: 'zaobleny' } },
    { id: 'pinzeta-zamek', kat: 'pinzety', nazev: 'Pinzeta se zámkem', popis: 'Posuvný kroužek ji drží zavřenou.', gen: 'vidlice', p: { zamek: true }, cel: 'pricne', celP: { L: 24, konec: 'zaobleny', tKonec: 70, wKonec: 55 } },
    { id: 'pinzeta-kucharska', kat: 'pinzety', nazev: 'Kuchařská pinzeta', popis: 'Dlouhá pinzeta na servírování (30 cm).', gen: 'vidlice', p: { prohnuti: 5, L: 300, Lb: 28, t: 3, tb: 3.4, w: 10, wb: 12, rs: 3, otevreni: 10, vroubky: 12, otvor: 6 }, cel: 'pricne', celP: { L: 45, konec: 'zaobleny', wKonec: 70 } },
    { id: 'pinzeta-oblouk', kat: 'pinzety', nazev: 'Pinzeta s půlkruhovým okem', popis: 'Pružný oblouk místo hlavy – větší rozevření.', gen: 'vidlice', p: { spoj: 'oko', Rspoj: 7, uhelOka: 200, tSpoj: 1.5, otevreni: 18 }, cel: 'pricne', celP: { L: 24, konec: 'zaobleny', tKonec: 70, wKonec: 45 } },
    { id: 'pinzeta-silna', kat: 'pinzety', nazev: 'Silná pinzeta (dvojité oko)', popis: 'Dvě oka – větší přítlak čelistí.', gen: 'vidlice', p: { spoj: 'dvojite', Rspoj: 6, uhelOka: 260, tSpoj: 1.3, mezSpoj: 1.2, w: 9, wb: 10 }, cel: 'mrizka', celP: { L: 22, wKonec: 70 } },
    { id: 'pinzeta-oko', kat: 'pinzety', nazev: 'Pinzeta s okem', popis: 'Měkký chod a velký rozsah.', gen: 'vidlice', p: { spoj: 'oko', Rspoj: 8, uhelOka: 300, tSpoj: 1.3, otevreni: 20 }, cel: 'jehla', celP: { L: 28 } },
    { id: 'pinzeta-meandr', kat: 'pinzety', nazev: 'Pinzeta s meandrem', popis: 'Nejměkčí – na křehké díly.', gen: 'vidlice', p: { spoj: 'meandr', zavity: 2, delkaSpoje: 10, tSpoj: 1, otevreni: 18 }, cel: 'hladka', celP: { L: 24, konec: 'zaobleny', tKonec: 60, wKonec: 50 } },
    { id: 'pinzeta-pruzina', kat: 'pinzety', nazev: 'Pinzeta s vnitřní pružinou', popis: 'Vzpěrná pružina mezi rameny přidá sílu.', gen: 'vidlice', p: { pruzina: true, pruzinaPoloha: 28, pruzinaT: 0.9, pruzinaHloubka: 9, rs: 3 }, cel: 'pricne', celP: { L: 24, konec: 'zaobleny', tKonec: 70, wKonec: 45 } },
    { id: 'pinzeta-reverzni', kat: 'pinzety', nazev: 'Reverzní pinzeta', popis: 'V klidu zavřená, stiskem se otevře.', gen: 'krizova', p: {}, cel: 'jehla', celP: { L: 26 } },
    { id: 'pinzeta-reverzni-plocha', kat: 'pinzety', nazev: 'Reverzní pinzeta plochá', popis: 'Křížová s rýhovanými čelistmi – pájení, lepení.', gen: 'krizova', p: { w: 9 }, cel: 'pricne', celP: { L: 22, konec: 'zaobleny', wKonec: 60 } },
    // kleště
    { id: 'kleste-ploche', kat: 'kleste', nazev: 'Ploché kleště', popis: 'Krátké rýhované čelisti, rovné rukojeti.', gen: 'nuzky', p: { predni: 22, zadni: 85, t: 5, w: 8, Yh: 14, rukojeti: 'rovne', th: 10, otevreni: 25 }, cel: 'pricne', celP: { L: 26, tKonec: 70, wKonec: 70 } },
    { id: 'kleste-jehlove', kat: 'kleste', nazev: 'Jehlové kleště', popis: 'Dlouhé zúžené čelisti.', gen: 'nuzky', p: { predni: 22, zadni: 85, t: 5, w: 8, Yh: 14, rukojeti: 'rovne', th: 10 }, cel: 'jehla', celP: { L: 40, hrot: 1.6, tHrot: 1.6, ryhy: true } },
    { id: 'kleste-kulate', kat: 'kleste', nazev: 'Kulaté kleště', popis: 'Kuželové čelisti na očka z drátu.', gen: 'nuzky', p: { predni: 22, zadni: 85, t: 5, w: 8, Yh: 14, rukojeti: 'rovne', th: 10 }, cel: 'kulate', celP: { L: 32 } },
    { id: 'kleste-trubkove', kat: 'kleste', nazev: 'Kleště na trubky', popis: 'Půlkruhový výřez pro trubku či tyč.', gen: 'nuzky', p: { predni: 26, zadni: 100, t: 6, w: 10, Yh: 16, rukojeti: 'rovne', th: 12 }, cel: 'polokruh', celP: { L: 34, D: 14 } },
    { id: 'kleste-prizma', kat: 'kleste', nazev: 'Kleště s V-drážkou', popis: 'Prizma pro kulaté předměty různých průměrů.', gen: 'nuzky', p: { predni: 26, zadni: 100, t: 6, w: 10, Yh: 16, rukojeti: 'rovne', th: 12 }, cel: 'prizma', celP: { L: 34, B: 14 } },
    { id: 'kleste-sroub', kat: 'kleste', nazev: 'Kleště se šroubem', popis: 'Kloub na šroub M3 s maticí – jde dotáhnout.', gen: 'nuzky', p: { predni: 24, zadni: 85, t: 5, w: 9, Yh: 14, rukojeti: 'rovne', th: 10, cep: 'sroub', sroub: 'M3', dk: 16 }, cel: 'pricne', celP: { L: 26, tKonec: 70, wKonec: 70 } },
    { id: 'kleste-kolik', kat: 'kleste', nazev: 'Kleště s rozebíratelným kolíkem', popis: 'Tři díly, kolík zacvakne a jde vyndat.', gen: 'nuzky', p: { predni: 24, zadni: 80, t: 5, w: 8, Yh: 16, rukojeti: 'kruzky', cep: 'kolik', dc: 5, dk: 16 }, cel: 'mrizka', celP: { L: 22, tKonec: 80, wKonec: 75 } },
    { id: 'kleste-led', kat: 'kleste', nazev: 'Kleště na led a polena', popis: 'Vyklenutá ramena s drápy.', gen: 'nuzky', p: { predni: 70, zadni: 90, t: 6, w: 10, Yh: 22, oblouk: 26, rukojeti: 'rovne', th: 12, dk: 18, dc: 6, otevreni: 20 }, cel: 'drapy', celP: { L: 26, d: 5, hk: 10 } },
    { id: 'kleste-sklenice', kat: 'kleste', nazev: 'Kleště na zavařovací sklenice', popis: 'Oblouky obejmou hrdlo sklenice.', gen: 'nuzky', p: { predni: 45, zadni: 90, t: 6, w: 10, Yh: 22, rukojeti: 'rovne', th: 12, dk: 18, dc: 6, otevreni: 20 }, cel: 'oblouk', celP: { D: 70, tl: 4, krcek: 8 } },
    { id: 'kleste-kelimky', kat: 'kleste', nazev: 'Laboratorní kleště na kelímky', popis: 'Malé oblouky na kelímky a zkumavky.', gen: 'nuzky', p: { predni: 60, zadni: 110, t: 4.5, w: 8, Yh: 16, rukojeti: 'kruzky', dr: 20 }, cel: 'oblouk', celP: { D: 22, tl: 2.5, krcek: 10 } },
    { id: 'kleste-tampony', kat: 'kleste', nazev: 'Kleště na tampony', popis: 'Oválná okénka (Foerster) s rohatkou.', gen: 'nuzky', p: { predni: 70, zadni: 80, t: 4, w: 7, Yh: 18, rohatka: true }, cel: 'okenko', celP: { L: 26, W: 12, lem: 2.5 } },
    // kuchyňské
    { id: 'kleste-topinky', kat: 'kuchyn', nazev: 'Kleště na topinky', popis: 'Dřevěný typ – hlava a dvě ploché lamely.', gen: 'vidlice', p: { prohnuti: 7, vrchol: 40, L: 300, Lb: 26, t: 5.5, tb: 6.5, w: 22, wb: 22, rs: 4, pruzna: 30, otevreni: 9, vroubky: 4, hlVroubku: 0.8, uchopOd: 3, uchopDo: 14, zakonceni: 'rovne', otvor: 0 }, cel: 'hladka', celP: { L: 40, konec: 'zkoseny', tKonec: 90, wKonec: 100 } },
    { id: 'kleste-pecivo', kat: 'kuchyn', nazev: 'Kleště na pečivo', popis: 'Pružné oko a široké vlnité čelisti.', gen: 'smycka', p: { prohnuti: 10, L: 230, t: 2.6, w: 22, R: 10 }, cel: 'vlnite', celP: { L: 55, wKonec: 115 } },
    { id: 'kleste-gril', kat: 'kuchyn', nazev: 'Grilovací kleště', popis: 'Dlouhé, s pilovými zuby proti vyklouznutí.', gen: 'smycka', p: { prohnuti: 12, L: 320, t: 3, w: 20, R: 12, otevreni: 20 }, cel: 'pilove', celP: { L: 60, konec: 'zaobleny', wKonec: 110 } },
    { id: 'kleste-salat', kat: 'kuchyn', nazev: 'Kleště na salát', popis: 'Pružné oko a dvě lžíce.', gen: 'smycka', p: { prohnuti: 10, L: 250, t: 2.6, w: 18, R: 11, otevreni: 22 }, cel: 'lzice', celP: { L: 70, W: 42, D: 6, tl: 2 } },
    { id: 'kleste-salat-nuzky', kat: 'kuchyn', nazev: 'Nůžkové kleště na salát', popis: 'Kloub, kroužky a lžíce.', gen: 'nuzky', p: { predni: 45, zadni: 85, t: 5, w: 9, Yh: 18, rukojeti: 'kruzky', dr: 22, tr: 4, otevreni: 25 }, cel: 'lzice', celP: { L: 70, W: 40, D: 5, tl: 2.2 } },
    { id: 'kleste-cukr', kat: 'kuchyn', nazev: 'Kleště na cukr', popis: 'Malé, s drápky na kostky cukru.', gen: 'smycka', p: { prohnuti: 3, L: 115, t: 1.8, w: 10, R: 6, otevreni: 26, vroubky: 6 }, cel: 'drapy', celP: { L: 16, pocet: 2, hk: 4, d: 1.6 } },
    { id: 'kleste-kulicky', kat: 'kleste', nazev: 'Kleště na kuličky', popis: 'Kulatá okénka s kulovým lůžkem drží kouli.', gen: 'nuzky', p: { predni: 30, zadni: 75, t: 4, w: 8, Yh: 16, rukojeti: 'kruzky' }, cel: 'kruh', celP: { D: 12, lem: 2.5, tl: 3, krcek: 6 } },
    { id: 'kleste-kostky', kat: 'kuchyn', nazev: 'Kleště na kostky ledu', popis: 'Pružné oko a misky s okénkem.', gen: 'smycka', p: { prohnuti: 6, L: 170, t: 2.2, w: 12, R: 8 }, cel: 'okenko', celP: { L: 30, W: 26, lem: 3, zoubky: true } },
    { id: 'kleste-spagety', kat: 'kuchyn', nazev: 'Kleště na špagety', popis: 'Křížové rýhování drží i kluzké těstoviny.', gen: 'smycka', p: { prohnuti: 10, L: 240, t: 2.6, w: 20, R: 10 }, cel: 'mrizka', celP: { L: 55, p: 3, h: 1.4, konec: 'kulaty', wKonec: 100 } },
    // svorky
    { id: 'pean-rovny', kat: 'svorky', nazev: 'Peán rovný', popis: 'Samosvorná svorka s rohatkou.', gen: 'nuzky', p: { rohatka: true }, cel: 'pricne', celP: { L: 26, tKonec: 75, wKonec: 70 } },
    { id: 'pean-zahnuty', kat: 'svorky', nazev: 'Peán zahnutý', popis: 'Zahnuté čelisti, rohatka.', gen: 'nuzky', p: { rohatka: true }, cel: 'pricne', celP: { L: 26, tKonec: 75, wKonec: 70, ohyb: 30 } },
    { id: 'kocher', kat: 'svorky', nazev: 'Kocherova svorka', popis: 'Rýhy a zuby 1×2 na špičce, rohatka.', gen: 'nuzky', p: { rohatka: true, predni: 30, zadni: 80 }, cel: 'zuby12', celP: { L: 30, wKonec: 70 } },
    { id: 'jehelec', kat: 'svorky', nazev: 'Jehelec', popis: 'Krátké čelisti s křížovým rýhováním, rohatka.', gen: 'nuzky', p: { rohatka: true, predni: 20, zadni: 85, t: 4.5 }, cel: 'mrizka', celP: { L: 14, tKonec: 85, wKonec: 75 } },
    { id: 'svorka-cevni', kat: 'svorky', nazev: 'Cévní svorka', popis: 'Atraumatické čelisti a rohatka.', gen: 'nuzky', p: { rohatka: true, predni: 30, zadni: 75 }, cel: 'debakey', celP: { L: 34, wKonec: 70, ohyb: 15 } },
    { id: 'svorka-reverzni', kat: 'svorky', nazev: 'Reverzní svorka', popis: 'Křížová svorka – drží sama, stiskem povolí.', gen: 'krizova', p: { L: 80, Lb: 10, t: 2.4, w: 10, Y0: 7, kriz: 58 }, cel: 'pricne', celP: { L: 18, p: 1.2, h: 0.5 } },
    { id: 'kolicek', kat: 'svorky', nazev: 'Kolíček s drážkami', popis: 'Křížový kolíček na šňůru a kabely.', gen: 'krizova', p: { L: 75, Lb: 9, t: 2.6, w: 10, Y0: 7, kriz: 55, mezera: 0.4 }, cel: 'drazky', celP: { L: 20, pocet: 2, dg: 2.6 } },
    { id: 'svorka-hadicky', kat: 'svorky', nazev: 'Svorka na hadičky', popis: 'Pružné oko, hřebínky a rohatka.', gen: 'smycka', p: { prohnuti: 1.5, L: 70, t: 2.2, w: 9, R: 4.5, rohatka: true, otevreni: 18, vroubky: 0 }, cel: 'hreben', celP: { L: 26, pocet: 1, hr: 1.2, rr: 2 } },
    { id: 'klip-sacky', kat: 'svorky', nazev: 'Klip na sáčky', popis: 'Pant, západka a pero s drážkou.', gen: 'klip', p: {}, cel: 'podelne', celP: { p: 2.4, h: 1.1 } },
    { id: 'klip-chleba', kat: 'svorky', nazev: 'Klip na chleba', popis: 'Krátký klip s vlnitými čelistmi.', gen: 'klip', p: { L: 60, w: 14 }, cel: 'vlnite', celP: { p: 5, h: 1.6 } }
  ];

  // seznam čelistí, které generátor dovolí
  function povoleneCelisti(gen) {
    const G = GENERATORY[gen];
    return G.celisti ? G.celisti.slice() : Object.keys(KC.CELISTI);
  }

  function vychoziParametry(gen) {
    const o = {};
    for (const q of GENERATORY[gen].parametry) o[q.id] = q.vychozi;
    return o;
  }

  // kontext pro výchozí hodnoty čelisti (tloušťka/šířka ramene)
  function kontextCelisti(gen, p, celP) {
    return { t: p.t, w: p.w, L: (celP && celP.L) || Math.max(10, (p.L || 100) * 0.2) };
  }

  /* Stav z předvolby: {predvolba, gen, p, cel, celP} */
  function zPredvolby(id) {
    const pv = PREDVOLBY.find(x => x.id === id) || PREDVOLBY[0];
    const p = Object.assign(vychoziParametry(pv.gen), pv.p);
    const c = kontextCelisti(pv.gen, p, pv.celP);
    const celP = Object.assign(KC.vychozi(pv.cel, c), pv.celP);
    return { predvolba: pv.id, gen: pv.gen, p, cel: pv.cel, celP };
  }

  /* ==================================================================
     OPTIMALIZACE TVARU
     Podle materiálu (dovolené protažení eps a vůle tisku najednou) navrhne
     změny parametrů s důvodem. Pravidla:
       – pružná místa (ohyb u hlavy, pásek oka, pant) nesmí přetáhnout
         0,6·eps při rozevření z tisku do zavřené polohy: ε ≈ t·φ / (2·L),
       – rozestup: při stisku se musí dotknout nejdřív čelisti (mezera
         uprostřed v zavřené poloze aspoň max(1 mm, 10 % rozestupu u čelistí)),
       – rameno jako nosník stálé pevnosti: tloušťka ~ √(vzdálenost od čelisti),
       – kleště: páka rukojeť : čelist ≥ 2,5, kloub ≥ 2,8× čep, vůle podle materiálu.
     ================================================================== */
  function optimalizuj(stav, mat) {
    const eps = (mat && mat.eps) || 0.02, vuleMat = (mat && mat.vule) || 0.35;
    const s2 = JSON.parse(JSON.stringify(stav)), p = s2.p, zmeny = [];
    const G = GENERATORY[s2.gen];
    const spec = id => G.parametry.find(q => q.id === id);
    const zaokr = (id, v) => { const q = spec(id); if (!q || q.krok == null) return v; return omez(Math.round(v / q.krok) * q.krok, q.min, q.max); };
    const zmen = (id, na, proc) => {
      const q = spec(id); na = zaokr(id, na);
      if (p[id] != null && Math.abs(na - p[id]) < 1e-6) return;
      zmeny.push({ id, nazev: q ? q.nazev : id, jednotka: q && q.jednotka || '', z: p[id], na, proc });
      p[id] = na;
    };
    const cel = () => ({ id: s2.cel, p: Object.assign({}, s2.celP, G.pevneCelisti || {}) });
    const fmt = v => (Math.round(v * 10) / 10).toString().replace('.', ',');

    if (s2.gen === 'vidlice' || s2.gen === 'smycka') {
      // 1) průběh tloušťky ramene (nosník stálé pevnosti) a plynulý přechod
      if (s2.gen === 'vidlice') {
        if (p.tb < p.t * 1.15) zmen('tb', p.t * 1.25, 'Kořen ramene nese největší ohybový moment – má být silnější než konec u čelisti.');
        const ideal = Math.max(p.t, p.tb * Math.SQRT1_2), lin = (p.tb + p.t) / 2;
        if (Math.abs(ideal - lin) >= 0.15 && Math.abs(ideal - p.t) >= 0.1) zmen('tlStred', ideal, 'Tloušťka uprostřed podle nosníku stálé pevnosti (t ~ √vzdálenosti od čelisti) – stejné napětí po celé délce, méně materiálu.');
        if (p.w < 2.5 * p.t) zmen('w', 2.5 * p.t, 'Šířka aspoň 2,5× tloušťka – rameno se při stisku nevybočí do strany.');
      }
      if ((p.prechod == null ? 6 : p.prechod) < Math.max(4, 2 * p.t)) zmen('prechod', Math.max(4, 2 * p.t), 'Delší přechod rameno → čelist = plynulý tvar bez vrubu, kde by rameno praskalo.');
      // 2) pružné místo
      const B0 = s2.gen === 'vidlice' ? zakladVidlice(p, cel()) : zakladSmycky(p, cel());
      const phi = rad(B0.thR);                               // otočení mezi tiskem a zavřením (obě strany)
      if (s2.gen === 'vidlice') {
        const spoj = typSpoje(p);
        if (spoj === 'hlava') {
          const Lf = p.tb * (phi / 2) / (2 * 0.6 * eps);       // délka ohybové zóny pro 60 % dovoleného protažení
          const proc = omez(Math.ceil(Lf / B0.La * 100), 25, 90);
          if (proc > p.pruzna + 2) zmen('pruzna', proc, `Ohyb u hlavy rozložen na ${fmt(B0.La * proc / 100)} mm – protažení materiálu ≈ ${fmt(100 * p.tb * (phi / 2) / (2 * B0.La * proc / 100))} % (dovoleno ${fmt(100 * eps)} %).`);
          if (Lf > 0.9 * B0.La) zmen('tb', Math.max(1, 2 * 0.6 * eps * 0.9 * B0.La / (phi / 2)), 'Ani 90 % délky na ohyb nestačí – kořen ramene se ztenčí, aby materiál nepraskl.');
          if ((p.nabehHlavy == null ? 1.5 : p.nabehHlavy) < 0.6 * p.tb) zmen('nabehHlavy', 0.6 * p.tb, 'Zaoblený náběh do hlavy snižuje špičku napětí v kořeni ramene.');
        } else {
          // délka pásku závisí na jeho tloušťce (oko se přizpůsobí) – dopočítat
          // do ustálení, aby druhá optimalizace už nic neměnila
          const t0 = p.tSpoj;
          let Ls = 0, na = p.tSpoj, B1 = B0;
          for (let it = 0; it < 6; it++) {
            Ls = 0;
            for (const d of B1.S.drahy) { const R = J.ramce(d); Ls = Math.max(Ls, R.L); }
            const tmax = 1.2 * eps * Ls / Math.max(rad(B1.thR), 1e-3);
            const n2 = zaokr('tSpoj', omez(Math.min(0.85 * tmax, p.tb), 0.6, 4));
            if (Math.abs(n2 - na) < 1e-6) break;
            na = n2; p.tSpoj = na; B1 = zakladVidlice(p, cel());
          }
          p.tSpoj = t0;
          if (Math.abs(na - p.tSpoj) > 0.05) zmen('tSpoj', na, `Pásek dlouhý ${fmt(Ls)} mm se ohne o ${fmt(B1.thR)}° – nejsilnější bezpečná tloušťka pro ${fmt(100 * eps)} % protažení (větší síla, nepraskne).`);
        }
      } else {
        const Ls = Math.max(1, (p.R || 10) * rad(p.uhelOka || 180));
        const eNyni = p.t * phi / (2 * Ls);
        if (eNyni > 0.6 * eps) zmen('R', Math.min(60, p.t * phi / (1.2 * eps * rad(p.uhelOka || 180))), `Oko je na pásek ${fmt(p.t)} mm malé (protažení ${fmt(100 * eNyni)} %) – větší poloměr rozloží ohyb.`);
      }
      // 3) rozestup: při stisku se dotknou nejdřív čelisti
      const B = s2.gen === 'vidlice' ? zakladVidlice(p, cel()) : zakladSmycky(p, cel());
      const Sg = B.Sg, S0 = Sg(0), S1 = Sg(1), m = Math.max(1, 0.1 * S1);
      const PA = s2.gen === 'vidlice' ? B.PA : B.C;
      const xOd = s2.gen === 'vidlice' ? B.xp : B.xl, Lr = -xOd;
      const zavreny = (fr, S) => {
        const x = xOd + Lr * fr, ot = rad(B.thR) / 2 * (s2.gen === 'vidlice' && B.hlava ? B.fi(x) : 1);
        return 2 * J.otoc2([x, S / 2], PA, -ot)[1];
      };
      // jen když podmínka neplatí; tvar křivky (i vlastní body) zůstane – střed se
      // jen přizvedne hladkou vlnou sin(π·f) (konce se nemění)
      let Smid = Sg(0.5);
      if (zavreny(0.5, Smid) < m) {
        Smid = Math.max(Smid, (S0 + S1) / 2);
        for (let i = 0; i < 200 && zavreny(0.5, Smid) < m; i++) Smid += 0.2;
      }
      const d = Smid - Sg(0.5);
      const nove = JSON.parse(JSON.stringify(B.kr));
      for (const kv of nove.kotvy) {
        const f = kv.p[0];
        kv.p[1] += d * Math.sin(Math.PI * f);
        // sklon vlny v bodě se přičte k úchytům
        const sk = d * Math.PI * Math.cos(Math.PI * f);
        kv.a[1] += sk * kv.a[0]; kv.b[1] += sk * kv.b[0];
      }
      const lisi = Math.abs(d) > 0.3;
      if (lisi) {
        zmeny.push({ id: 'rozestup', nazev: 'Rozestup ramen uprostřed', jednotka: 'mm', z: Sg(0.5), na: Smid,
          proc: `Mírně vyboulená ramena: v zavřené poloze zůstane uprostřed mezera ${fmt(zavreny(0.5, Smid))} mm, takže se nejdřív dotknou čelisti a čelisti drží celou silou.` });
        p.rozestup = nove;
      }
    } else if (s2.gen === 'nuzky') {
      // (u čelistí, které předmět obejmou nebo jen nesou, na páce nezáleží)
      if (p.zadni < 2.2 * p.predni && !['oblouk', 'drapy', 'okenko', 'kruh'].includes(s2.cel)) zmen('zadni', 2.5 * p.predni, 'Páka rukojeť : čelist 2,5 : 1 – čelisti stisknou 2,5× větší silou, než vyvine ruka.');
      const dk = Math.max(2.8 * p.dc, 3 * p.t);
      if (p.dk < dk) zmen('dk', dk, 'Kloub aspoň 2,8× průměr čepu a 3× tloušťka ramen – nevyviklá se.');
      if (Math.abs(p.vule - vuleMat) > 0.01) zmen('vule', vuleMat, `Vůle kloubu doporučená pro zvolený materiál (tisk najednou bez slepení).`);
      if ((p.prechod == null ? 6 : p.prechod) < 1.5 * p.t) zmen('prechod', 1.5 * p.t, 'Plynulý přechod rameno → čelist bez vrubu.');
      if (p.rohatka) { const m = sestav(s2, p.otevreni); if (m.info.tiskMin && p.otevreni < m.info.tiskMin + 3) zmen('otevreni', Math.ceil(m.info.tiskMin + 3), 'Rohatka se při tisku nesmí překrývat – tiskové rozevření s rezervou.'); }
    } else if (s2.gen === 'krizova') {
      const La = p.L - p.Lb - KC.info(s2.cel, s2.celP, { t: p.t, w: p.w }).delka;
      const Lf = p.t * rad(p.stisk) / (2 * 0.6 * eps), proc = omez(Math.ceil(Lf / La * 100), 20, 60);
      if (proc > p.pruzna + 2) zmen('pruzna', proc, `Ohyb ramen u hlavy rozložen tak, aby protažení při plném stisku nepřekročilo ${fmt(60 * eps)} %.`);
      if (p.kriz < 50 || p.kriz > 72) zmen('kriz', 62, 'Křížení kolem 60 % délky – vyvážená páka mezi stiskem a otevřením čelistí.');
      if (p.mezera < 0.25) zmen('mezera', 0.3, 'Mezera v klidu aspoň 0,3 mm, jinak se čelisti při tisku slepí.');
      if (Math.abs(p.vule - vuleMat) > 0.01) zmen('vule', vuleMat, 'Vůle v křížení podle materiálu.');
    } else if (s2.gen === 'klip') {
      // poloměr pantu jako ve stavbě: g/2 + t − th/2 (závisí na th → ustálit)
      const inf = KC.info(s2.cel, cel().p, { t: p.t, w: p.w }), g = Math.max(p.mezera || 0, inf.minMezera), th = rad(p.otevreni);
      let tn = Math.min(p.th, p.t * 0.8), Ls = 0;
      for (let it = 0; it < 8; it++) {
        const Rh = g / 2 + p.t - tn / 2;
        Ls = Math.PI * Rh;
        tn = Math.min(omez(0.9 * 1.2 * eps * Ls / th, 0.4, 3), p.t * 0.8);
      }
      const tmax = tn / 0.9;
      if (p.th > tmax || p.th < 0.6 * tmax) zmen('th', tn, `Pant se ohne o ${fmt(p.otevreni)}° na délce ${fmt(Ls)} mm – nejsilnější tloušťka, která vydrží opakované ohýbání.`);
      if (Math.abs(p.vule - 0.3) > 0.05) zmen('vule', 0.3, 'Vůle háčku 0,3 mm – zacvakne s jistotou, ale nedrhne.');
    }
    return { stav: s2, zmeny };
  }

  // rozestup ramen: vlastní křivka, nebo odvozená z parametrů (pro editor)
  function rozestup(stav, vychozi) {
    const G = GENERATORY[stav.gen];
    if (!G.rozestup) return null;
    const p = Object.assign({}, stav.p);
    if (vychozi) delete p.rozestup;
    const B = G.rozestup(p, { id: stav.cel, p: Object.assign({}, stav.celP, G.pevneCelisti || {}) });
    return { kr: JSON.parse(JSON.stringify(B.kr)), thR: B.thR, g: B.g };
  }

  // rozsah pohybu a tisková poloha (u pinzety plyne z tvaru, proto i čelisti)
  function pohyb(stav) {
    const G = GENERATORY[stav.gen];
    const celP = Object.assign({}, stav.celP, G.pevneCelisti || {});
    return G.pohyb(stav.p, { id: stav.cel, p: celP });
  }

  function sestav(stav, theta) {
    const G = GENERATORY[stav.gen];
    const celP = Object.assign({}, stav.celP, G.pevneCelisti || {});
    const m = G.stavba(stav.p, { id: stav.cel, p: celP }, theta);
    return m;
  }

  /* Rozložení na podložku k tisku. Díly se stejnou skupinou (výchozí
     „sestava“) zůstávají spolu, jak jsou (tisk najednou); ostatní skupiny
     se otočí (otocit = vzhůru nohama kolem osy x), položí na z = 0 a
     rozmístí vedle sebe po ose y s mezerou. */
  function rozlozeni(m, mezera) {
    mezera = mezera == null ? 6 : mezera;
    const sk = new Map();
    for (const c of m.casti) {
      const k = c.skupina || 'sestava';
      if (!sk.has(k)) sk.set(k, []);
      sk.get(k).push(c);
    }
    const out = [];
    let y = null;
    for (const [, casti] of sk) {
      const tt = casti.map(c => ({ c, telesa: (c.telesaTisk || c.telesa).map(t => c.otocit ? J.transformuj(t, q => [q[0], -q[1], -q[2]]) : t) }));
      const ob = J.obal(tt.flatMap(x => x.telesa));
      const dy = y == null ? 0 : y - ob.lo[1], dz = -ob.lo[2];
      for (const x of tt) out.push(Object.assign({}, x.c, { telesa: x.telesa.map(t => J.posun(t, 0, dy, dz)) }));
      y = ob.hi[1] + dy + mezera;
    }
    return out;
  }

  const KD = { optimalizuj, rozestup, pohyb, krivkaBody, zakladVidlice, zakladSmycky, krivkaZVrcholu, prohnutiKrivkou, rozlozeni, GENERATORY, PREDVOLBY, KATEGORIE, povoleneCelisti, vychoziParametry, kontextCelisti, zPredvolby, sestav };
  koren.KD = KD;
  if (typeof module !== 'undefined' && module.exports) module.exports = KD;
})(typeof window !== 'undefined' ? window : globalThis);
