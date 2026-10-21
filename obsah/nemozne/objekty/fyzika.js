/* Laboratoř nemožných tvarů – tělesa se zvláštními fyzikálními vlastnostmi:
   tělesa konstantní šířky (Reuleauxův čtyřstěn, Meissnerova tělesa, hladká tělesa z opěrné funkce),
   oloid a valivé těleso ze dvou kružnic, sférikon. */
(function (N) {
  'use strict';
  const { sin, cos, PI, sqrt, acos, atan, abs, hypot } = Math;
  const Q = k => ({ nizka: 0.5, stredni: 1, vysoka: 2 })[k] || 1;
  const SK = 'Tělesa se zvláštními fyzikálními vlastnostmi';

  /* ---------- společné nástroje ---------- */

  /** Rovnoměrné směry na sféře (Fibonacciho mřížka). */
  function smery(n) {
    const out = [], z = PI * (3 - sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - 2 * (i + 0.5) / n, r = sqrt(1 - y * y);
      out.push([r * cos(z * i), r * sin(z * i), y]);
    }
    return out;
  }
  N.smery = smery;

  /** Šířka tělesa (vzdálenost dvou rovnoběžných opěrných rovin) ve směrech u: změřeno na vrcholech sítě. */
  N.sirkaTelesa = function (sit, n = 2000) {
    const { poz, tri } = sit, pouz = new Set(tri), body = [];
    for (const i of pouz) body.push([poz[3 * i], poz[3 * i + 1], poz[3 * i + 2]]);
    // přesné body hranice, které síť nemusí zachytit (ostré vrcholy a hrany)
    for (const b of sit.prvky || []) body.push(b);
    let mn = Infinity, mx = -Infinity, smn = null, smx = null;
    for (const u of smery(n)) {
      let a = Infinity, b = -Infinity;
      for (const p of body) { const d = p[0] * u[0] + p[1] * u[1] + p[2] * u[2]; if (d < a) a = d; if (d > b) b = d; }
      const w = b - a;
      if (w < mn) { mn = w; smn = u; }
      if (w > mx) { mx = w; smx = u; }
    }
    return { min: mn, max: mx, smn, smx };
  };

  /** Opěrná funkce sítě h(n) = max (X·n) přes použité vrcholy (těžiště v počátku). */
  function opora(body, n) {
    let m = -Infinity;
    for (const p of body) { const d = p[0] * n[0] + p[1] * n[1] + p[2] * n[2]; if (d > m) m = d; }
    return m;
  }
  function pouziteBody(sit) {
    const out = [];
    for (const i of new Set(sit.tri)) out.push([sit.poz[3 * i], sit.poz[3 * i + 1], sit.poz[3 * i + 2]]);
    for (const b of sit.prvky || []) out.push(b);       // přesné ostré vrcholy a hrany
    return out;
  }

  /** Dráha valení rozvinutelného tělesa: normály stěn (Gaussův obraz je křivka), sloučené
      a seřazené řetězením nejbližších sousedů. Vrací seznam jednotkových normál. */
  N.drahaValeni = function (sit) {
    const { poz, tri } = sit, mapa = new Map();
    for (let i = 0; i < tri.length; i += 3) {
      const a = N.bod(poz, tri[i]), b = N.bod(poz, tri[i + 1]), c = N.bod(poz, tri[i + 2]);
      const nn = N.v.cross(N.v.sub(b, a), N.v.sub(c, a)), l = N.v.len(nn);
      if (!(l > 1e-12)) continue;
      // konvexní těleso s těžištěm v počátku: vnější normála míří od počátku
      const zn = N.v.dot(nn, [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]]) < 0 ? -1 : 1;
      const n = nn.map(x => zn * x / l), k = n.map(x => Math.round(x * 400)).join(',');
      if (!mapa.has(k)) mapa.set(k, n);
    }
    const zbyva = [...mapa.values()], draha = [zbyva.pop()];
    while (zbyva.length) {
      const p = draha[draha.length - 1];
      let bi = -1, bd = -2;
      for (let i = 0; i < zbyva.length; i++) { const d = N.v.dot(p, zbyva[i]); if (d > bd) { bd = d; bi = i; } }
      if (bd < cos(0.25)) break;                 // velký skok: konec souvislé dráhy
      draha.push(zbyva.splice(bi, 1)[0]);
    }
    return draha;
  };

  /** Animace valení po stole podle dráhy normál; výška stolu z opěrné funkce sítě. */
  function valej(pohled, sit, ui, popis) {
    const body = pouziteBody(sit), draha = N.drahaValeni(sit);
    const krok = Math.max(1, Math.floor(draha.length / 500)), vyb = draha.filter((_, i) => i % krok === 0);
    const h = vyb.map(n => opora(body, n));
    const snimky = N.orientaceDolu(vyb).map((q, i) => ({ q, stul: -h[i] - 0.002 }));
    ui.zprava('Těleso se valí…');
    N.prehrajNaStole(pohled, snimky, 7000, () => ui.zprava(popis(Math.min(...h), Math.max(...h))));
  }

  /** Výška těžiště nad stolem pro všechny polohy na povrchových přímkách (normály stěn). */
  function vyskaPriValeni(sit) {
    const body = pouziteBody(sit), draha = N.drahaValeni(sit);
    let mn = Infinity, mx = -Infinity;
    for (const n of draha) { const h = opora(body, n); mn = Math.min(mn, h); mx = Math.max(mx, h); }
    return { min: mn, max: mx, n: draha.length };
  }

  /** Otáčení tělesa mezi stolem a deskou: u tělesa konstantní šířky se deska nehne. */
  function meziDeskami(pohled, sit, ui) {
    const body = pouziteBody(sit), snimky = [];
    let q = new THREE.Quaternion();
    const osa = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
    let mez = [Infinity, -Infinity];
    for (let i = 0; i < 480; i++) {
      // pomalu se měnící osa otáčení, aby se vystřídaly všechny směry
      osa.applyAxisAngle(new THREE.Vector3(0.6, -0.2, 0.77).normalize(), 0.05);
      q = new THREE.Quaternion().setFromAxisAngle(osa, 0.035).multiply(q);
      const qi = q.clone().invert(), z = new THREE.Vector3(0, 0, 1).applyQuaternion(qi);
      const nz = [z.x, z.y, z.z], horni = opora(body, nz), dolni = -opora(body, nz.map(x => -x));
      mez = [Math.min(mez[0], horni - dolni), Math.max(mez[1], horni - dolni)];
      snimky.push({ q: q.clone(), stul: dolni - 0.002, deska: horni + 0.002 });
    }
    ui.zprava('Těleso se otáčí mezi stolem a deskou…');
    N.prehrajNaStole(pohled, snimky, 9000, () => ui.zprava(`Vzdálenost stolu a desky během otáčení: <b>${N.fmt(mez[0], 5)} až ${N.fmt(mez[1], 5)}</b>
      (rozdíl ${N.fmt(mez[1] - mez[0], 2)}). ${mez[1] - mez[0] < 0.01 * mez[1] ? 'Deska se nehnula: těleso má konstantní šířku.' : 'Deska se hýbe: šířka tělesa není konstantní.'}`));
  }

  /* ---------- tělesa konstantní šířky ---------- */
  // pravidelný čtyřstěn s hranou s, těžiště v počátku
  function ctyrsten(s) {
    const k = s / (2 * sqrt(2));
    return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => v.map(x => x * k));
  }
  /** Oblouk ostré hrany AB: body ve vzdálenosti s od C i D (kružnice kolem osy CD), mezi A a B. */
  function oblouk(A, B, C, D) {
    const M = C.map((x, i) => (x + D[i]) / 2);
    const e1 = N.v.norm(N.v.sub(A, M)), ro = N.v.len(N.v.sub(A, M));
    const osa = N.v.norm(N.v.sub(D, C));
    const e2 = N.v.norm(N.v.cross(osa, e1));
    let tb = Math.atan2(N.v.dot(N.v.sub(B, M), e2), N.v.dot(N.v.sub(B, M), e1));
    return { M, e1, e2: tb < 0 ? e2.map(x => -x) : e2, ro, t1: abs(tb) };
  }
  const bodOblouku = (o, t) => [0, 1, 2].map(i => o.M[i] + o.ro * (cos(t) * o.e1[i] + sin(t) * o.e2[i]));

  /** Radiální funkce průniku koulí o poloměru s se středy ve vrcholech a ve všech bodech zadaných oblouků.
      Vrací { t, c }: vzdálenost hranice podél paprsku u a střed aktivní koule (pro přesnou normálu). */
  function prunikKouli(V, oblouky, s) {
    const vystup = (u, c) => { const b = u[0] * c[0] + u[1] * c[1] + u[2] * c[2]; return b + sqrt(b * b - (c[0] * c[0] + c[1] * c[1] + c[2] * c[2]) + s * s); };
    return u => {
      let t = Infinity, cc = null;
      for (const c of V) { const x = vystup(u, c); if (x < t) { t = x; cc = c; } }
      for (const o of oblouky) {
        // minimum přes body oblouku: vzorky + zlatý řez kolem nejlepšího
        const n = 16;
        let bi = 0, bv = Infinity;
        for (let i = 0; i <= n; i++) { const v = vystup(u, bodOblouku(o, o.t1 * i / n)); if (v < bv) { bv = v; bi = i; } }
        let a = o.t1 * Math.max(0, bi - 1) / n, b = o.t1 * Math.min(n, bi + 1) / n;
        const g = (sqrt(5) - 1) / 2;
        let x1 = b - g * (b - a), x2 = a + g * (b - a), f1 = vystup(u, bodOblouku(o, x1)), f2 = vystup(u, bodOblouku(o, x2));
        for (let it = 0; it < 40; it++) {
          if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = vystup(u, bodOblouku(o, x1)); }
          else { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = vystup(u, bodOblouku(o, x2)); }
        }
        const tm = (a + b) / 2, v = vystup(u, bodOblouku(o, tm));
        if (v < t) { t = v; cc = bodOblouku(o, tm); }
      }
      return { t, c: cc };
    };
  }

  // osa pólů sítě je obecně skloněná, aby póly neležely ve vrcholu ani na hraně
  const R0 = (() => {
    const a = N.v.norm([0.31, 0.17, 0.93]), b = N.v.norm(N.v.cross([1, 0, 0], a)), c = N.v.cross(a, b);
    return { a, b, c };
  })();
  const smer = (t, f) => [0, 1, 2].map(i => cos(t) * R0.a[i] + sin(t) * (cos(f) * R0.b[i] + sin(f) * R0.c[i]));

  const ACOS13 = acos(1 / 3);
  const SIRKA = {
    reuleaux: { nazev: 'Reuleauxův čtyřstěn', hladke: [] },
    mvrchol: { nazev: 'Meissner (hrany u vrcholu)', hladke: [[0, 1], [0, 2], [0, 3]] },
    mtroj: { nazev: 'Meissner (hrany v trojúhelníku)', hladke: [[1, 2], [2, 3], [1, 3]] },
    hladke: { nazev: 'hladké z opěrné funkce' },
  };

  function konstantniSirka(p, k) {
    const s = 2;
    if (p.tvar === 'hladke') {
      // opěrná funkce h(u) = s/2 + ε·xyz; lichá část dává konstantní šířku h(u) + h(−u) = s.
      // Bod hranice X(u) = h u + ∇_S h = (s/2 − 2ε xyz) u + ε (yz, xz, xy)
      const e = p.eps;
      const f = (t, fi) => {
        const u = smer(t, fi), [x, y, z] = u, m = s / 2 - 2 * e * x * y * z;
        return [m * x + e * y * z, m * y + e * x * z, m * z + e * x * y];
      };
      const sit = N.plocha({ f, u: [0, PI], v: [0, 2 * PI], nu: Math.round(90 * Q(k)), nv: Math.round(180 * Q(k)), sev: { v: 'per', bod: ['u0', 'u1'] } });
      sit.s = s;
      return sit;
    }
    const V = ctyrsten(s), obl = [];
    // ostré hrany jsou protilehlé k vyhlazeným; koule se středy na ostrých hranách hladí hrany protější
    for (const [i, j] of SIRKA[p.tvar].hladke) {
      const zbyle = [0, 1, 2, 3].filter(x => x !== i && x !== j);
      obl.push(oblouk(V[zbyle[0]], V[zbyle[1]], V[i], V[j]));
    }
    const r = prunikKouli(V, obl, s);
    const nu = Math.round(150 * Q(k)), nv = Math.round(300 * Q(k)), W = nv + 1;
    const poz = new Float64Array(3 * (nu + 1) * W), nor = new Float64Array(3 * (nu + 1) * W);
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const u = smer(PI * i / nu, 2 * PI * j / nv), q = r(u), kk = i * W + j;
      for (let a = 0; a < 3; a++) { poz[3 * kk + a] = q.t * u[a]; nor[3 * kk + a] = (q.t * u[a] - q.c[a]) / s; }
    }
    const sit = N.mrizka(poz, nu, nv, { v: 'per', bod: ['u0', 'u1'] });
    sit.nor = nor;
    sit.s = s;
    sit.ostreHrany = true;
    sit.mriz = null;            // bez šachovnice – ruší u ostrých hran
    // ostré prvky na hranici: 4 vrcholy a ostré hrany (oblouky ve vzdálenosti s od obou protějších vrcholů)
    const hladke = SIRKA[p.tvar].hladke.map(h => h.join());
    sit.prvky = V.slice();
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      if (hladke.includes([i, j].join())) continue;
      const zb = [0, 1, 2, 3].filter(x => x !== i && x !== j), o = oblouk(V[i], V[j], V[zb[0]], V[zb[1]]);
      for (let q = 1; q < 200; q++) sit.prvky.push(bodOblouku(o, o.t1 * q / 200));
    }
    return sit;
  }

  N.registruj({
    id: 'konstsirka', nazev: 'Tělesa konstantní šířky', skupina: SK, stitek: 'presna',
    parametry: [
      { id: 'tvar', nazev: 'Těleso', volby: Object.entries(SIRKA).map(([k, v]) => [k, v.nazev]), vychozi: 'mvrchol' },
      { id: 'eps', nazev: 'Odchylka ε (xyz)', min: 0, max: 1.2, krok: 0.01, vychozi: 0.5, kdy: p => p.tvar === 'hladke' },
    ],
    generuj: konstantniSirka,
    stitekDyn(p, s) {
      if (p.tvar !== 'hladke') return 'presna';
      return konvexni(s) ? 'presna' : 'ilustrativni';
    },
    stitekPozn(p, s) {
      if (p.tvar === 'hladke' && !konvexni(s)) return '<b>Pro tak velké ε už tvar není konvexní</b> (záporná Gaussova křivost): opěrná funkce pak nepopisuje skutečné těleso a „konstantní šířka“ ztrácí smysl.';
      if (p.tvar === 'reuleaux') return 'Průnik čtyř koulí je přesný, ale <b>nemá konstantní šířku</b>: panel to změří.';
      if (p.tvar !== 'hladke') return 'Průnik koulí o poloměru s se středy ve vrcholech a ve všech bodech tří ostrých hran. Minimum přes body oblouku se hledá zlatým řezem (přesnost ~10⁻¹²).';
      return '';
    },
    teorie(p, s) {
      const w = s.s;
      if (p.tvar === 'reuleaux') return { chi: 2, orient: true, okraje: 0, plocha: (8 * PI - 18 * ACOS13) * w * w, objem: w ** 3 / 12 * (3 * sqrt(2) - 49 * PI + 162 * atan(sqrt(2))), tolPlocha: 0.01, tolObjem: 0.01 };
      if (p.tvar === 'hladke') return { chi: 2, orient: true, okraje: 0 };
      return { chi: 2, orient: true, okraje: 0, plocha: (2 - sqrt(3) / 2 * ACOS13) * PI * w * w, objem: (2 / 3 - sqrt(3) / 4 * ACOS13) * PI * w ** 3, tolPlocha: 0.01, tolObjem: 0.01,
        pozn: 'Obě Meissnerova tělesa mají stejný objem i povrch. Podle Blaschkeho–Lebesgueovy domněnky mají nejmenší objem ze všech těles dané konstantní šířky.' };
    },
    cisla(p, s, top) {
      const w = s.s, sr = N.sirkaTelesa(s), konst = p.tvar !== 'reuleaux';
      const r = [
        ['Šířka – nejmenší (2 000 směrů)', N.fmt(sr.min, 6), konst ? N.fmt(w, 6) : null, konst ? (abs(sr.min - w) < 2e-3 * w ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>') : '',
          'Vzdálenost dvou rovnoběžných opěrných rovin, změřená ve 2 000 rovnoměrně rozložených směrech na vrcholech sítě a na přesných bodech ostrých vrcholů a hran.'],
        ['Šířka – největší', N.fmt(sr.max, 6), konst ? N.fmt(w, 6) : `${N.fmt((sqrt(3) - sqrt(2) / 2) * w, 6)} (středy protilehlých hran)`,
          konst ? (abs(sr.max - w) < 2e-3 * w ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>') : (abs(sr.max - (sqrt(3) - sqrt(2) / 2) * w) < 3e-3 * w ? '<span class="ok">✔</span>' : '<span class="ne">≈</span>')],
      ];
      if (konst && top) {
        const S = N.plochaSite(s), V = N.objemSite(s, top);
        r.push(['Blaschkeho vztah V = S·w/2 − πw³/3', N.fmt(V, 6), N.fmt(S * w / 2 - PI * w ** 3 / 3, 6), abs(V - (S * w / 2 - PI * w ** 3 / 3)) < 0.01 * V ? '<span class="ok">✔</span>' : '<span class="ne">≈</span>',
          'Pro každé těleso konstantní šířky w platí V = S·w/2 − πw³/3. Obě strany jsou spočtené z naměřeného povrchu S a objemu V.']);
        r.push(['Koule téže šířky (objem)', N.fmt(PI * w ** 3 / 6, 6), null, '', 'Koule má mezi tělesy dané konstantní šířky největší objem.']);
      }
      if (p.tvar === 'hladke') r.push(['Nejmenší Gaussova křivost', N.fmt(s.Kmin, 4), '> 0', konvexni(s) ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>']);
      return r;
    },
    tlacitka: [{ text: '🪵 Otáčet mezi deskami', akce: (pohled, p, s, ui) => meziDeskami(pohled, s, ui) }],
    popis: `<p><b>Těleso konstantní šířky</b> má ve všech směrech stejnou šířku: mezi dvěma rovnoběžnými deskami se dá libovolně otáčet a deska se nepohne.
      Koule není jediná taková.</p>
      <p><b>Reuleauxův čtyřstěn</b> (průnik čtyř koulí o poloměru s se středy ve vrcholech pravidelného čtyřstěnu) vypadá jako prostorový Reuleauxův trojúhelník,
      ale konstantní šířku <b>nemá</b>. Středy protilehlých hran jsou od sebe (√3 − √2/2)s ≈ 1,0249 s. Tlačítko „Otáčet mezi deskami“ ukáže, jak se deska zvedá.</p>
      <p><b>Meissnerova tělesa</b> (1911) vzniknou vyhlazením tří hran. Body naproti ostré hraně AB leží na koulích o poloměru s se středy na oblouku AB.
      Těleso je proto průnikem koulí se středy ve vrcholech a ve všech bodech tří ostrých hran. Protější hrana se tím nahradí rotační plochou (vnitřní částí vřetenového toru) kolem své osy.
      Vyhlazené hrany buď vycházejí z jednoho vrcholu, nebo tvoří trojúhelník. Vzniknou dvě různá tělesa se stejným objemem.</p>
      <p><b>Hladká tělesa</b> se dají vyrobit z opěrné funkce h(u) = s/2 + f(u), kde f je lichá (f(−u) = −f(u)). Pak h(u) + h(−u) = s. Bod hranice je X = h·u + ∇h.
      Zde f = ε·xyz. Jde to jen pro dost malé ε: podle měření křivosti přestane být tvar konvexní nad ε ≈ 0,919 (pro s = 2) a štítek zčervená.</p>`,
    zdroje: ['E. Meissner, F. Schilling (1912), Drei Gipsmodelle von Flächen konstanter Breite, Z. Math. Phys. 60.',
      'B. Kawohl, C. Weber (2011), Meissner\'s mysterious bodies, Math. Intelligencer 33(3) – objem a povrch.',
      'W. Blaschke (1915), Konvexe Bereiche gegebener konstanter Breite und kleinsten Inhalts – vztah V = Sw/2 − πw³/3.',
      'Wikipedia: Reuleaux tetrahedron – objem, povrch a vzdálenost středů protilehlých hran.'],
  });

  function konvexni(s) {
    if (s.Kmin === undefined) {
      if (!s.f) { s.Kmin = null; return true; }
      const st = N.statKrivosti(s.f, s.dom.u, s.dom.v, 60, 0.01);
      s.Kmin = st.K.min;
    }
    return s.Kmin === null || s.Kmin > 0;
  }

  /* ---------- oloid a valivé těleso ze dvou kružnic ---------- */
  const VALIVA = { oloid: { nazev: 'oloid (d = r)', d: 1 }, dvojkruh: { nazev: 'dvě kružnice (d = r√2)', d: sqrt(2) }, vlastni: { nazev: 'vlastní d' } };
  N.registruj({
    id: 'oloid', nazev: 'Oloid a valivá tělesa', skupina: SK, stitek: 'presna',
    parametry: [
      { id: 'tvar', nazev: 'Těleso', volby: Object.entries(VALIVA).map(([k, v]) => [k, v.nazev]), vychozi: 'oloid' },
      { id: 'd', nazev: 'Vzdálenost středů d', min: 1, max: 1.95, krok: 0.01, vychozi: 1.2, kdy: p => p.tvar === 'vlastni' },
    ],
    generuj(p, k) {
      const d = VALIVA[p.tvar].d || p.d, t0 = acos(1 / (1 + d));
      const nu = Math.round(220 * Q(k)), nv = Math.round(24 * Q(k)), poz = [], tri = [];
      // konvexní obal kružnic A (rovina z = 0, střed 0) a B (rovina y = 0, střed (d, 0, 0)), poloměr 1.
      // Povrchová přímka z bodu P(t) ∈ A vede do bodu Q ∈ B se společnou tečnou rovinou:
      // tan²α = (1 − d cos t)² − cos²t, Q = (d + cos t/(1 − d cos t), 0, ± tan α/(1 − d cos t))
      for (const zn of [1, -1]) {
        const b0 = poz.length / 3;
        for (let i = 0; i <= nu; i++) {
          // hustší vzorkování u konců (t0 a 2π − t0), kde se přímky rychle otáčejí
          const w = i / nu, tt = t0 + (2 * PI - 2 * t0) * (0.5 - 0.5 * cos(PI * w));
          const c = cos(tt), m = 1 - d * c, ta = sqrt(Math.max(0, m * m - c * c));
          const P = [cos(tt), sin(tt), 0], Qb = [d + c / m, 0, zn * ta / m];
          for (let j = 0; j <= nv; j++) { const l = j / nv; poz.push((1 - l) * P[0] + l * Qb[0] - d / 2, (1 - l) * P[1] + l * Qb[1], (1 - l) * P[2] + l * Qb[2]); }
        }
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
          const a = b0 + i * (nv + 1) + j, b = a + nv + 1, c = b + 1, e = a + 1;
          // spodní polovina má opačnou úhlopříčku: jinak by obě poloviny u koncové přímky sdílely tutéž hranu čtyřikrát
          if (zn > 0) tri.push(a, b, c, a, c, e); else tri.push(a, e, b, b, e, c);
        }
      }
      const sit = N.svarPodlePolohy({ poz: Float64Array.from(poz), tri: Uint32Array.from(tri) }, 1e-6);
      // degenerované trojúhelníky (po svaření u konců přímek) pryč
      const t2 = [];
      for (let i = 0; i < sit.tri.length; i += 3) {
        const a = sit.svar[sit.tri[i]], b = sit.svar[sit.tri[i + 1]], c = sit.svar[sit.tri[i + 2]];
        if (a !== b && b !== c && a !== c) t2.push(sit.tri[i], sit.tri[i + 1], sit.tri[i + 2]);
      }
      sit.tri = Uint32Array.from(t2);
      sit.ploche = true;
      sit.d = d;
      return sit;
    },
    teorie: (p, s) => {
      const d = s.d;
      const t = { chi: 2, orient: true, okraje: 0, rod: 0, pruniky: false };
      if (abs(d - 1) < 1e-9) Object.assign(t, { plocha: 4 * PI, objem: 3.0524184684, tolPlocha: 0.01, tolObjem: 0.01,
        pozn: 'Povrch oloidu je přesně 4πr², stejně jako u koule o poloměru r (Dirnböck a Stachel 1997).' });
      return t;
    },
    cisla(p, s) {
      const d = s.d, h = vyskaPriValeni(s);
      let teo = null, ok = '';
      if (abs(d - 1) < 1e-9) { teo = `${N.fmt(1 / sqrt(2), 5)} … ${N.fmt(0.75, 5)}`; ok = abs(h.min - 1 / sqrt(2)) < 3e-3 && abs(h.max - 0.75) < 3e-3 ? '<span class="ok">✔</span>' : '<span class="ne">≈</span>'; }
      if (abs(d - sqrt(2)) < 1e-9) { teo = `konstantní ${N.fmt(1 / sqrt(2), 5)}`; ok = abs(h.min - 1 / sqrt(2)) < 3e-3 && abs(h.max - 1 / sqrt(2)) < 3e-3 ? '<span class="ok">✔</span>' : '<span class="ne">≈</span>'; }
      return [
        ['Výška těžiště při valení', `${N.fmt(h.min, 5)} … ${N.fmt(h.max, 5)}`, teo, ok,
          `Opěrná funkce sítě ve směrech normál všech ${h.n} různých stěn: v každé poloze leží těleso na jedné povrchové přímce.`],
        ['Kolísání výšky těžiště', N.fmt((h.max - h.min) / h.max * 100, 3) + ' %', abs(d - sqrt(2)) < 1e-9 ? '0 %' : null, ''],
      ];
    },
    tlacitka: [{ text: '🛞 Valit po stole', akce: (pohled, p, s, ui) => valej(pohled, s, ui, (a, b) => `Během valení se výška těžiště měnila mezi <b>${N.fmt(a, 4)}</b> a <b>${N.fmt(b, 4)}</b>${b - a < 2e-3 ? ': těžiště jede rovně, valení je plynulé.' : ': těžiště se houpe.'}`) }],
    popis: `<p><b>Oloid</b> (Paul Schatz, 1929) je konvexní obal dvou stejných kružnic v kolmých rovinách, z nichž každá prochází středem druhé.
      Při valení se dotýká podložky postupně <b>celým svým povrchem</b>. Ten je rozvinutelný: dá se vystřihnout z papíru a slepit bez natahování.</p>
      <p>Povrch tvoří jen úsečky (povrchové přímky) mezi kružnicemi. K bodu P(t) první kružnice patří bod Q druhé, se kterým má společnou tečnou rovinu.
      Z podmínky dotyku vyjde přesně tan²α = (1 − d cos t)² − cos²t. Síť je ze samých takových úseček.</p>
      <p><b>Valivé těleso ze dvou kružnic</b> (two-circle roller) má středy kružnic dál od sebe, d = r√2. Jeho těžiště se při valení
      drží v konstantní výšce r/√2, takže se valí úplně plynule. Pro d &lt; r by se kružnice proplétaly, pro d ≥ 2r by se dotýkaly, proto je d omezené na [r, 1,95 r]. Oloid se naopak trochu houpe: výška těžiště kolísá mezi r/√2 a 3r/4.
      Obojí plyne z výšky h = cos α (1 − d cos t / 2) a panel to měří na síti.</p>`,
    zdroje: ['P. Schatz (1929), oloid; H. Dirnböck, H. Stachel (1997), The development of the oloid, J. Geom. Graphics 1(2) – povrch 4πr².',
      'Objem oloidu ≈ 3,0524184684 r³ (Wikipedia „Oloid“).', 'A. T. Stewart (1966), Two-circle roller, Am. J. Phys. 34.'],
  });

  /* ---------- sférikon ---------- */
  N.registruj({
    id: 'sferikon', nazev: 'Sférikon', skupina: SK, stitek: 'presna',
    parametry: [{ id: 'tvar', nazev: 'Těleso', volby: [['sferikon', 'sférikon (pootočeno o 90°)'], ['bikuzel', 'dvojkužel (bez pootočení)']], vychozi: 'sferikon' }],
    generuj(p, k) {
      const r = 1.6, b = p.tvar === 'sferikon' ? PI / 2 : 0, cb = cos(b), sb = sin(b);
      const nu = Math.round(80 * Q(k)) & ~1, nv = Math.round(60 * Q(k)), poz = [], tri = [];
      // dvojkužel s osou x (vrcholový úhel 90°: výška = poloměr), rozříznutý rovinou z = 0; horní půlka se otočí o b kolem osy z
      for (const [th0, th1, rot] of [[0, PI, true], [PI, 2 * PI, false]]) {
        const b0 = poz.length / 3;
        for (let i = 0; i <= nu; i++) {
          const x = -r + 2 * r * i / nu, ro = r - abs(x);
          for (let j = 0; j <= nv; j++) {
            const th = th0 + (th1 - th0) * j / nv, X = [x, ro * cos(th), ro * sin(th)];
            if (rot) poz.push(X[0] * cb - X[1] * sb, X[0] * sb + X[1] * cb, X[2]); else poz.push(...X);
          }
        }
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
          const a = b0 + i * (nv + 1) + j, c = a + nv + 1;
          tri.push(a, c + 1, c, a, a + 1, c + 1);
        }
      }
      const sit = N.svarPodlePolohy({ poz: Float64Array.from(poz), tri: Uint32Array.from(tri) }, 1e-6);
      const t2 = [];
      for (let i = 0; i < sit.tri.length; i += 3) {
        const a = sit.svar[sit.tri[i]], bb = sit.svar[sit.tri[i + 1]], c = sit.svar[sit.tri[i + 2]];
        if (a !== bb && bb !== c && a !== c) t2.push(sit.tri[i], sit.tri[i + 1], sit.tri[i + 2]);
      }
      sit.tri = Uint32Array.from(t2);
      sit.ploche = true;
      sit.r = r;
      return sit;
    },
    teorie: (p, s) => ({ chi: 2, orient: true, okraje: 0, rod: 0, pruniky: false, plocha: 2 * sqrt(2) * PI * s.r ** 2, objem: 2 / 3 * PI * s.r ** 3, tolPlocha: 0.01, tolObjem: 0.01 }),
    cisla(p, s) {
      const h = vyskaPriValeni(s);
      return [['Výška těžiště při valení', `${N.fmt(h.min, 5)} … ${N.fmt(h.max, 5)}`, `konstantní r/√2 = ${N.fmt(s.r / sqrt(2), 5)}`,
        abs(h.min - s.r / sqrt(2)) < 3e-3 && abs(h.max - s.r / sqrt(2)) < 3e-3 ? '<span class="ok">✔</span>' : '<span class="ne">≈</span>',
        'Těleso leží vždy na povrchové přímce kužele. Vzdálenost středu od tečné roviny kužele s vrcholovým úhlem 90° je r·sin 45°.']];
    },
    tlacitka: [{ text: '🛞 Valit po stole', akce: (pohled, p, s, ui) => valej(pohled, s, ui, (a, b) => `Výška těžiště během valení: <b>${N.fmt(a, 4)} až ${N.fmt(b, 4)}</b>. Sférikon se valí po klikaté dráze a jeho těžiště zůstává ve stejné výšce.`) }],
    popis: `<p><b>Sférikon</b> vznikne z dvojkuželu s vrcholovým úhlem 90°. Rozřízne se rovinou procházející osou a jedna půlka se otočí o 90°.
      Řez je čtverec, takže obě půlky zase přesně lícují.</p>
      <p>Celý povrch je jediná souvislá rozvinutelná plocha. Při valení se po klikaté dráze postupně dotkne podložky celým povrchem.
      Těžiště přitom zůstává ve stejné výšce r/√2 (vzdálenost osy od tečné roviny kužele). Valí se proto bez houpání, ačkoli na první pohled vypadá hranatě.</p>
      <p>Objem a povrch jsou stejné jako u dvojkuželu: V = 2πr³/3, S = 2√2 πr². Pootočení nic neubere ani nepřidá.</p>`,
    zdroje: ['C. Roberts (1969), sphericon; I. Stewart (1999), Cone with a twist, Scientific American 281(4).'],
  });
})(NEM);
