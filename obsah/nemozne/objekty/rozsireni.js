/* Laboratoř nemožných tvarů – rozšíření: Hopfova fibrace, trojperiodické minimální plochy
   (nodální aproximace), Amesův pokoj. */
(function (N) {
  'use strict';
  const { sin, cos, PI, sqrt, abs, hypot } = Math;
  const Q = k => ({ nizka: 0.5, stredni: 1, vysoka: 2 })[k] || 1;

  /** Barva z odstínu (0..1) a jasu. */
  function hsl(h, s, l) {
    const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0), f(8), f(4)];
  }

  /** Gaussovo číslo spletení dvou uzavřených lomených čar (body bez opakování posledního). */
  N.cisloSpleteni = function (A, B) {
    let s = 0;
    const na = A.length, nb = B.length;
    for (let i = 0; i < na; i++) {
      const a0 = A[i], a1 = A[(i + 1) % na], da = N.v.sub(a1, a0), ma = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2, (a0[2] + a1[2]) / 2];
      for (let j = 0; j < nb; j++) {
        const b0 = B[j], b1 = B[(j + 1) % nb], db = N.v.sub(b1, b0), mb = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2, (b0[2] + b1[2]) / 2];
        const r = N.v.sub(ma, mb), l = N.v.len(r);
        s += N.v.dot(r, N.v.cross(da, db)) / (l * l * l);
      }
    }
    return s / (4 * PI);
  };

  /* ---------- Hopfova fibrace ---------- */
  /** Vlákno nad bodem (θ, φ) sféry S²: z₁ = cos(θ/2) e^{iψ}, z₂ = sin(θ/2) e^{i(ψ+φ)}; stereografický průmět S³ → ℝ³ z pólu (0, 0, 0, 1). */
  function vlakno(th, fi) {
    return psi => {
      const x1 = cos(th / 2) * cos(psi), x2 = cos(th / 2) * sin(psi), x3 = sin(th / 2) * cos(psi + fi), x4 = sin(th / 2) * sin(psi + fi);
      return [x1 / (1 - x4), x2 / (1 - x4), x3 / (1 - x4)];
    };
  }
  N.hopfVlakno = vlakno;
  N.registruj({
    id: 'hopf', nazev: 'Hopfova fibrace', skupina: 'Topologické objekty', stitek: 'presna',
    parametry: [
      { id: 'L', nazev: 'Rovnoběžek na S²', min: 1, max: 5, krok: 1, vychozi: 2, cele: true },
      { id: 'M', nazev: 'Vláken na rovnoběžku', min: 3, max: 24, krok: 1, vychozi: 10, cele: true },
      { id: 'r', nazev: 'Tloušťka vlákna', min: 0.01, max: 0.1, krok: 0.005, vychozi: 0.05 },
    ],
    generuj(p, k) {
      const site = [], barvy = [], stredy = [];
      for (let a = 0; a < p.L; a++) {
        const th = PI * (p.L === 1 ? 0.5 : 0.3 + 0.4 * a / (p.L - 1));
        for (let b = 0; b < p.M; b++) {
          const fi = 2 * PI * b / p.M, s = N.trubka(vlakno(th, fi), 0, 2 * PI, Math.round(160 * Q(k)), p.r, Math.round(10 * Q(k)));
          site.push(s); stredy.push(s.stred.slice(0, -1));
          const c = hsl(b / p.M, 0.75, 0.38 + 0.3 * a / Math.max(1, p.L - 1));
          for (let t = 0; t < s.tri.length / 3; t++) barvy.push(...c);
        }
      }
      const sit = N.spoj(site);
      sit.barvy = Float32Array.from(barvy);
      sit.stredy = stredy;
      return sit;
    },
    teorie: p => ({ chi: 0, orient: true, okraje: 0, komponenty: p.L * p.M, pruniky: null,
      pozn: 'Každé vlákno je kružnice, žádná dvě se neprotínají a každá dvě jsou spletená (číslo spletení ±1). Trubky kolem vláken mají ale konečnou tloušťku, takže se při hustém nebo silném nastavení mohou dotknout – měření samoprůniků se týká trubek, ne vláken.' }),
    cisla(p, s) {
      const n = s.stredy.length, dvojice = [[0, 1], [0, n - 1], [Math.floor(n / 2), n - 1]].filter(([a, b]) => a !== b);
      const r = [];
      for (const [a, b] of dvojice) {
        const lk = N.cisloSpleteni(s.stredy[a], s.stredy[b]);
        r.push([`Číslo spletení vláken ${a + 1} a ${b + 1}`, N.fmt(lk, 5), '±1', abs(abs(lk) - 1) < 0.01 ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>',
          'Gaussův integrál (1/4π)∮∮ (r₁ − r₂)·(dr₁ × dr₂)/|r₁ − r₂|³, spočtený jako dvojitý součet přes úsečky obou vláken.']);
      }
      return r;
    },
    legenda: 'barva = poloha bodu na sféře S² (odstín = délka, jas = šířka)',
    popis: `<p>Heinz Hopf (1931) našel zobrazení trojrozměrné sféry S³ na obyčejnou sféru S², u kterého je vzorem každého bodu kružnice (vlákno).
      S³ se tak rozpadne na kružnice, které vyplní celý prostor, nikde se neprotnou a <b>každé dvě jsou spletené</b> jako dva články řetězu.</p>
      <p>Vlákno nad bodem (θ, φ): z₁ = cos(θ/2) e^{iψ}, z₂ = sin(θ/2) e^{i(ψ+φ)}, ψ ∈ [0, 2π). Do ℝ³ se S³ promítne stereograficky z pólu.
      Kružnice zůstanou kružnicemi (jedna by byla přímkou).</p>
      <p>Vlákna nad jednou rovnoběžkou sféry leží na jednom toru (nad rovníkem na Cliffordově toru). Toru jsou do sebe vnořené.
      Číslo spletení se tu měří numericky Gaussovým integrálem a vychází ±1.</p>`,
    zdroje: ['H. Hopf (1931), Über die Abbildungen der dreidimensionalen Sphäre auf die Kugelfläche, Math. Annalen 104.', 'D. W. Lyons (2003), An elementary introduction to the Hopf fibration, Math. Magazine 76.'],
  });

  /* ---------- trojperiodické minimální plochy (nodální aproximace) ---------- */
  const TPMS = {
    P: { nazev: 'Schwarz P', F: (x, y, z) => cos(x) + cos(y) + cos(z), rod: 3, index: 1, mrizka: 'prostá kubická' },
    D: { nazev: 'Schwarz D', F: (x, y, z) => sin(x) * sin(y) * sin(z) + sin(x) * cos(y) * cos(z) + cos(x) * sin(y) * cos(z) + cos(x) * cos(y) * sin(z), rod: 9, index: 4, mrizka: 'plošně centrovaná' },
    G: { nazev: 'gyroid (Schoen)', F: (x, y, z) => sin(x) * cos(y) + sin(y) * cos(z) + sin(z) * cos(x), rod: 5, index: 2, mrizka: 'prostorově centrovaná' },
  };
  function gradHess(F, x, y, z) {
    const h = 1e-4, f0 = F(x, y, z);
    const g = [(F(x + h, y, z) - F(x - h, y, z)) / (2 * h), (F(x, y + h, z) - F(x, y - h, z)) / (2 * h), (F(x, y, z + h) - F(x, y, z - h)) / (2 * h)];
    const d2 = (a, b) => {
      const e = [[h, 0, 0], [0, h, 0], [0, 0, h]];
      const p = (s, t) => F(x + s * e[a][0] + t * e[b][0], y + s * e[a][1] + t * e[b][1], z + s * e[a][2] + t * e[b][2]);
      if (a === b) return (p(1, 0) - 2 * f0 + p(-1, 0)) / (h * h);
      return (p(1, 1) - p(1, -1) - p(-1, 1) + p(-1, -1)) / (4 * h * h);
    };
    const H = [[d2(0, 0), d2(0, 1), d2(0, 2)], [0, d2(1, 1), d2(1, 2)], [0, 0, d2(2, 2)]];
    H[1][0] = H[0][1]; H[2][0] = H[0][2]; H[2][1] = H[1][2];
    return { g, H };
  }
  /** Střední a Gaussova křivost izoplochy F = 0 v bodě (vzorce pro implicitní plochy, Goldman 2005). */
  function krivostImplicitni(F, x, y, z) {
    const { g, H } = gradHess(F, x, y, z), gg = g[0] ** 2 + g[1] ** 2 + g[2] ** 2, l = sqrt(gg);
    const gHg = g.reduce((s, gi, i) => s + gi * g.reduce((t, gj, j) => t + H[i][j] * gj, 0), 0);
    const tr = H[0][0] + H[1][1] + H[2][2];
    const adj = [[H[1][1] * H[2][2] - H[1][2] * H[2][1], H[0][2] * H[2][1] - H[0][1] * H[2][2], H[0][1] * H[1][2] - H[0][2] * H[1][1]],
      [H[1][2] * H[2][0] - H[1][0] * H[2][2], H[0][0] * H[2][2] - H[0][2] * H[2][0], H[0][2] * H[1][0] - H[0][0] * H[1][2]],
      [H[1][0] * H[2][1] - H[1][1] * H[2][0], H[0][1] * H[2][0] - H[0][0] * H[2][1], H[0][0] * H[1][1] - H[0][1] * H[1][0]]];
    const gAg = g.reduce((s, gi, i) => s + gi * g.reduce((t, gj, j) => t + adj[i][j] * gj, 0), 0);
    return { H: (gHg - gg * tr) / (2 * gg * l), K: gAg / (gg * gg) };
  }
  N.krivostImplicitni = krivostImplicitni;

  function mrizkaPole(F, R, mn, krok) {
    const A = new Float32Array(R * R * R);
    for (let i = 0; i < R; i++) for (let j = 0; j < R; j++) for (let k = 0; k < R; k++) A[(i * R + j) * R + k] = F(mn + i * krok, mn + j * krok, mn + k * krok);
    return A;
  }
  const rodCache = new Map();
  N.registruj({
    id: 'tpms', nazev: 'Trojperiodické plochy (gyroid…)', skupina: 'Minimální plochy', stitek: 'aproximace',
    parametry: [
      { id: 'typ', nazev: 'Plocha', volby: Object.entries(TPMS).map(([k, v]) => [k, v.nazev]), vychozi: 'G' },
      { id: 'n', nazev: 'Počet buněk na hranu', min: 1, max: 3, krok: 1, vychozi: 2, cele: true },
    ],
    generuj(p, k) {
      const T = TPMS[p.typ], R = Math.round(36 * Q(k)) * p.n + 1, L = 2 * PI * p.n, krok = L / (R - 1);
      const sit = N.surfaceNets(mrizkaPole(T.F, R, 0, krok), R, 0, krok);
      // vrcholy surface nets leží jen přibližně na F = 0: dva Newtonovy kroky je posadí přesně na izoplochu
      const P = sit.poz;
      for (let v = 0; v < P.length; v += 3) for (let it = 0; it < 3; it++) {
        const { g } = gradHess(T.F, P[v], P[v + 1], P[v + 2]), f = T.F(P[v], P[v + 1], P[v + 2]), gg = g[0] ** 2 + g[1] ** 2 + g[2] ** 2;
        if (gg < 1e-12) break;
        for (let a = 0; a < 3; a++) P[v + a] -= f * g[a] / gg;
      }
      for (let v = 0; v < P.length; v += 3) { const { g } = gradHess(T.F, P[v], P[v + 1], P[v + 2]), l = hypot(...g) || 1; for (let a = 0; a < 3; a++) sit.nor[v + a] = g[a] / l; }
      for (let v = 0; v < P.length; v++) P[v] -= L / 2;
      sit.bezTopologie = true;
      sit.posun = L / 2;
      return sit;
    },
    teorie: () => ({}),
    cisla(p, s) {
      const T = TPMS[p.typ];
      // křivost ve vrcholech (posazených na izoplochu)
      let sH = 0, mH = 0, sK = 0, n = 0;
      for (let v = 0; v < s.poz.length; v += 3 * 7) {
        const c = krivostImplicitni(T.F, s.poz[v] + s.posun, s.poz[v + 1] + s.posun, s.poz[v + 2] + s.posun);
        if (!isFinite(c.H)) continue;
        sH += abs(c.H); mH = Math.max(mH, abs(c.H)); sK += sqrt(abs(c.K)); n++;
      }
      // rod na jedné periodické buňce (síť uzavřená na trojrozměrném toru)
      if (!rodCache.has(p.typ)) {
        const R = 40, sp = N.surfaceNets(mrizkaPole(T.F, R, 0, 2 * PI / R), R, 0, 2 * PI / R, true);
        rodCache.set(p.typ, N.topologie(sp));
      }
      const t = rodCache.get(p.typ), rod = (2 - t.chi) / 2;
      return [
        ['Střední křivost |H| (průměr)', N.fmt(sH / n, 4), '0 u přesné minimální plochy', '',
          `Vzorec pro implicitní plochu F = 0, v ${n} vrcholech posazených Newtonovou metodou přesně na izoplochu. Nenulová hodnota je odchylka aproximace od skutečné minimální plochy.`],
        ['Střední křivost |H| (maximum)', N.fmt(mH, 4), '0', ''],
        ['Typická křivost √|K|', N.fmt(sK / n, 4), null, '', 'Pro srovnání: velikost |H| vůči typické křivosti ukazuje, jak daleko je aproximace od minimality.'],
        ['Poměr |H| / √|K|', N.fmt(sH / sK * 100, 3) + ' %', '0 %', ''],
        ['Rod na jedné periodické buňce', `${rod} (χ = ${t.chi})`, T.rod, rod === T.rod ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>',
          `Síť jedné periody (40³) uzavřená přes protilehlé stěny buňky. Teorie: primitivní buňka má rod 3, kubická buňka obsahuje ${T.index} primitivní (${T.mrizka} mřížka), χ se násobí: rod = 1 + ${T.index}·2.`],
      ];
    },
    stitekPozn: (p) => `Zobrazená plocha je <b>nodální aproximace</b> F(x, y, z) = 0 (von Schnering a Nesper 1991). Přesná ${TPMS[p.typ].nazev}
      je jiná plocha se stejnou symetrií a topologií. Je dána Weierstrassovou reprezentací s eliptickými integrály. Panel měří, o kolik se aproximace od minimální plochy liší.`,
    popis: `<p><b>Trojperiodické minimální plochy</b> se opakují ve třech směrech a dělí prostor na dva propletené labyrinty.
      Hermann Schwarz popsal plochy P a D (1890), Alan Schoen roku 1970 objevil <b>gyroid</b>. Ten nemá žádné přímky ani zrcadlové roviny.
      Najdeme je v blanách buněk, v motýlích křídlech i v kopolymerech.</p>
      <p>Přesné parametrizace vedou na eliptické integrály. Zde se používají jednoduché <b>nodální aproximace</b>:
      P: cos x + cos y + cos z = 0; D: sin x sin y sin z + sin x cos y cos z + cos x sin y cos z + cos x cos y sin z = 0;
      gyroid: sin x cos y + sin y cos z + sin z cos x = 0. Mají správnou symetrii i topologii, ale <b>nejsou přesně minimální</b>.
      Proto žlutý štítek a měření střední křivosti, která by u přesné plochy byla všude nulová.</p>
      <p>Rod se měří na jedné periodické buňce uzavřené přes protilehlé stěny. Vychází 3 (P), 9 (D) a 5 (gyroid), protože kubická buňka obsahuje 1, 4, resp. 2 primitivní buňky rodu 3.</p>`,
    zdroje: ['H. A. Schwarz (1890), Gesammelte Mathematische Abhandlungen.', 'A. H. Schoen (1970), Infinite periodic minimal surfaces without self-intersections, NASA TN D-5541.',
      'H. G. von Schnering, R. Nesper (1991), Nodal surfaces of Fourier series, Z. Phys. B 83 – nodální aproximace.', 'R. Goldman (2005), Curvature formulas for implicit curves and surfaces, CAGD 22.'],
  });

  /* ---------- Amesův pokoj ---------- */
  // oko v počátku, pohled podél +y; zdánlivý (pravoúhlý) pokoj x ∈ [−3, 3], y ∈ [8, 14], z ∈ [−1.6, 1.4]
  const POKOJ = { x0: -3, x1: 3, y0: 8, y1: 14, z0: -1.6, z1: 1.4 };
  N.registruj({
    id: 'ames', nazev: 'Amesův pokoj', skupina: 'Optické iluze', stitek: 'iluze',
    parametry: [{ id: 'k', nazev: 'Protažení levého rohu', min: 1, max: 3, krok: 0.05, vychozi: 2 }],
    generuj(p) {
      // projektivní zobrazení se středem v oku: P' = P / (1 + w·P); zachovává paprsky z oka i roviny.
      // w je zvolené tak, aby zadní pravý roh zůstal na místě a zadní levý se vzdálil k-krát.
      const P = POKOJ, wy = -(1 - 1 / p.k) / (2 * P.y1), wx = -wy * P.y1 / P.x1;
      const w = [wx, wy, 0], map = q => { const d = 1 + w[0] * q[0] + w[1] * q[1]; return [q[0] / d, q[1] / d, q[2] / d]; };
      const poz = [], tri = [], barvy = [];
      const ctverec = (a, b, c, d, barva) => {
        const i = poz.length / 3;
        for (const q of [a, b, c, d]) poz.push(...map(q));
        tri.push(i, i + 1, i + 2, i, i + 2, i + 3);
        barvy.push(...barva, ...barva);
      };
      // podlaha – šachovnice, zadní stěna a boky s pruhy, strop
      const n = 6;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x0 = P.x0 + (P.x1 - P.x0) * i / n, x1 = P.x0 + (P.x1 - P.x0) * (i + 1) / n, y0 = P.y0 + (P.y1 - P.y0) * j / n, y1 = P.y0 + (P.y1 - P.y0) * (j + 1) / n;
        ctverec([x0, y0, P.z0], [x1, y0, P.z0], [x1, y1, P.z0], [x0, y1, P.z0], (i + j) % 2 ? [0.15, 0.15, 0.17] : [0.92, 0.9, 0.85]);
      }
      for (let i = 0; i < n; i++) {
        const x0 = P.x0 + (P.x1 - P.x0) * i / n, x1 = P.x0 + (P.x1 - P.x0) * (i + 1) / n;
        ctverec([x0, P.y1, P.z0], [x1, P.y1, P.z0], [x1, P.y1, P.z1], [x0, P.y1, P.z1], i % 2 ? [0.75, 0.62, 0.45] : [0.82, 0.7, 0.52]);
        const y0 = P.y0 + (P.y1 - P.y0) * i / n, y1 = P.y0 + (P.y1 - P.y0) * (i + 1) / n;
        ctverec([P.x0, y1, P.z0], [P.x0, y0, P.z0], [P.x0, y0, P.z1], [P.x0, y1, P.z1], i % 2 ? [0.55, 0.65, 0.75] : [0.62, 0.72, 0.82]);
        ctverec([P.x1, y0, P.z0], [P.x1, y1, P.z0], [P.x1, y1, P.z1], [P.x1, y0, P.z1], i % 2 ? [0.55, 0.65, 0.75] : [0.62, 0.72, 0.82]);
        ctverec([x0, P.y0, P.z1], [x0, P.y1, P.z1], [x1, P.y1, P.z1], [x1, P.y0, P.z1], [0.88, 0.88, 0.86]);
      }
      const pokoj = { poz: Float64Array.from(poz), tri: Uint32Array.from(tri), svar: Int32Array.from({ length: poz.length / 3 }, (_, i) => i) };
      // dvě stejně velké postavy (válec + hlava) na skutečné podlaze v zadních rozích
      const postavy = [], barvyP = [], polohy = [];
      for (const [vx, barva] of [[P.x0 + 0.8, [0.85, 0.2, 0.2]], [P.x1 - 0.8, [0.2, 0.35, 0.85]]]) {
        const pata = map([vx, P.y1 - 0.8, P.z0]), vys = 1.1, r = 0.22;
        polohy.push(pata);
        const telo = N.plocha({ f: (u, v) => [pata[0] + r * cos(v), pata[1] + r * sin(v), pata[2] + u], u: [0, vys * 0.75], v: [0, 2 * PI], nu: 4, nv: 20, sev: { v: 'per' } });
        const hlava = N.plocha({ f: (u, v) => [pata[0] + r * 0.9 * sin(u) * cos(v), pata[1] + r * 0.9 * sin(u) * sin(v), pata[2] + vys * 0.75 + r * 0.9 + r * 0.9 * cos(u)], u: [0, PI], v: [0, 2 * PI], nu: 10, nv: 20, sev: { v: 'per', bod: ['u0', 'u1'] } });
        for (const s of [telo, hlava]) { postavy.push(s); for (let t = 0; t < s.tri.length / 3; t++) barvyP.push(...barva); }
      }
      const sit = N.spoj([pokoj, ...postavy]);
      sit.barvy = Float32Array.from([...barvy, ...barvyP]);
      sit.ploche = true; sit.bezTopologie = true; sit.bezMer = true;
      sit.map = map; sit.polohy = polohy;
      return sit;
    },
    teorie: () => ({}),
    kamera: () => ({ az: 0, el: 0, vzd: 10, cil: [0, 10, 0], orto: false }),
    kameraText: '👁️ Kukátko',
    cisla(p, s) {
      // rohy skutečného pokoje promítnuté z oka musí padnout na rohy pravoúhlého pokoje
      const P = POKOJ;
      let odch = 0;
      for (const x of [P.x0, P.x1]) for (const y of [P.y0, P.y1]) for (const z of [P.z0, P.z1]) {
        const q = s.map([x, y, z]);
        odch = Math.max(odch, abs(q[0] / q[1] - x / y), abs(q[2] / q[1] - z / y));
      }
      const [a, b] = s.polohy.map(q => N.v.len(q));
      return [
        ['Skutečná výška obou postav', '1,1 + hlava', 'stejná', ''],
        ['Vzdálenost postav od oka', `${N.fmt(a, 4)} a ${N.fmt(b, 4)}`, null, ''],
        ['Zdánlivý poměr velikostí', N.fmt(Math.max(a, b) / Math.min(a, b), 4) + ' : 1', null, '', 'Úhlová velikost je nepřímo úměrná vzdálenosti od oka.'],
        ['Odchylka rohů od pravoúhlého pokoje (v obraze)', N.fmt(odch, 2), 0, odch < 1e-12 ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>',
          'Rohy skutečného pokoje promítnuté z oka (x/y, z/y) se porovnají s rohy pravoúhlého pokoje.'],
      ];
    },
    legenda: '',
    popis: `<p>Adelbert Ames (1946) postavil pokoj, který z kukátka vypadá jako obyčejná pravoúhlá místnost. Člověk v levém rohu se ale zdá být trpaslík a v pravém obr.</p>
      <p><b>Konstrukce:</b> každý bod pravoúhlého pokoje se posune po paprsku od oka projektivním zobrazením P' = P / (1 + w·P).
      Zobrazení zachovává přímky a roviny a z oka vypadá každý bod stejně. Vektor w je zvolený tak, aby zadní levý roh odjel k-krát dál.
      Skutečný pokoj má proto šikmou zadní stěnu, stoupající podlahu a klesající strop.</p>
      <p>Obě postavy jsou stejně vysoké a stojí na skutečné podlaze. Levá je ale dál, takže se zdá menší, a mozek „ví“, že pokoj je pravoúhlý.
      Iluze funguje jen z kukátka (perspektivní pohled z jednoho bodu). Zkuste pokojem otočit.</p>`,
    zdroje: ['A. Ames Jr. (1946); W. H. Ittelson (1952), The Ames demonstrations in perception.'],
  });
})(NEM);
