/* Laboratoř nemožných tvarů – uzly: trojlístek, osmičkový uzel, torusové uzly a spleti (p, q).
   Trubka kolem středové křivky s rotačně minimalizujícím rámem. */
(function (N) {
  'use strict';
  const { cos, sin, PI } = Math;
  const Q = k => ({ nizka: 0.5, stredni: 1, vysoka: 2 })[k] || 1;

  /** Trubka + kontrola, zda se trubka sama neprotne (vzdálenost nesousedních částí osy < 2r). */
  function trubkaSKontrolou(c, n, r, m, uzavrena = true) {
    const s = N.trubka(c, 0, 2 * PI, n, r, m, uzavrena);
    // okno: body blíž po oblouku než ~πr se nepočítají (sousedé na stejném místě osy)
    let delka = 0;
    for (let i = 0; i < n; i++) delka += N.v.len(N.v.sub(s.stred[i + 1], s.stred[i]));
    const okno = Math.max(2, Math.ceil(n * 3.2 * r / delka));
    s.minVzd = N.minVzdalenostKrivky(s.stred, okno);
    s.delka = delka;
    return s;
  }

  function radkyTrubky(p, s) {
    return [
      ['Délka osy uzlu', N.fmt(s.delka, 5), null, ''],
      ['Nejmenší vzdálenost větví osy', N.fmt(s.minVzd, 4), `> ${N.fmt(2 * p.r, 3)}`, s.minVzd > 2 * p.r ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>',
        'Aby se trubka nedotkla sama sebe, musí být nesousední části osy dál než dvojnásobek poloměru trubky.'],
    ];
  }

  N.registruj({
    id: 'trojlistek', nazev: 'Trojlístkový uzel', skupina: 'Uzly', stitek: 'presna',
    parametry: [{ id: 'r', nazev: 'Tloušťka trubky', min: 0.1, max: 1.2, krok: 0.02, vychozi: 0.45 }],
    generuj(p, k) {
      return trubkaSKontrolou(t => [sin(t) + 2 * sin(2 * t), cos(t) - 2 * cos(2 * t), -sin(3 * t)],
        Math.round(300 * Q(k)), p.r, Math.round(28 * Q(k)));
    },
    teorie: p => ({ chi: 0, orient: true, okraje: 0, rod: 1, pruniky: null,
      pozn: 'Povrch trubky je torus (χ = 0). Uzel samotný je vlastnost osy, ne povrchu: torus lze zauzlit, ale nejde ho rozmotat bez protnutí.' }),
    cisla: (p, s) => [['Počet křížení (min.)', '–', 3, ''], ...radkyTrubky(p, s)],
    popis: `<p>Nejjednodušší netriviální uzel. Nedá se rozmotat na kružnici, aniž by se lano přestřihlo.</p>
      <p>Osa: x = sin t + 2 sin 2t, y = cos t − 2 cos 2t, z = −sin 3t. Kolem ní se vede trubka s <b>rotačně minimalizujícím rámem</b>
      (Wangova metoda dvojího odrazu): průřez se kolem osy zbytečně nepřetáčí. Zbytkové pootočení po jednom oběhu se rozloží rovnoměrně,
      aby šev trubky přesně navázal.</p>
      <p>Trojlístek je zároveň torusový uzel (2, 3), viz „Torusový uzel“. Je <b>chirální</b>: levotočivý a pravotočivý trojlístek nejsou ekvivalentní.</p>`,
    zdroje: ['W. Wang, B. Jüttler, D. Zheng, Y. Liu (2008), Computation of rotation minimizing frames, ACM TOG 27(1).', 'C. Adams, The Knot Book.'],
  });

  N.registruj({
    id: 'osmickovy', nazev: 'Osmičkový uzel (4₁)', skupina: 'Uzly', stitek: 'presna',
    parametry: [{ id: 'r', nazev: 'Tloušťka trubky', min: 0.1, max: 0.8, krok: 0.02, vychozi: 0.3 }],
    generuj(p, k) {
      return trubkaSKontrolou(t => [(2 + cos(2 * t)) * cos(3 * t), (2 + cos(2 * t)) * sin(3 * t), sin(4 * t)],
        Math.round(360 * Q(k)), p.r, Math.round(24 * Q(k)));
    },
    teorie: () => ({ chi: 0, orient: true, okraje: 0, rod: 1, pruniky: null }),
    cisla: (p, s) => [['Počet křížení (min.)', '–', 4, ''], ...radkyTrubky(p, s)],
    popis: `<p>Druhý nejjednodušší uzel, se čtyřmi kříženími. Na rozdíl od trojlístku je <b>amfichirální</b>: je ekvivalentní svému zrcadlovému obrazu.</p>
      <p>Osa: x = (2 + cos 2t) cos 3t, y = (2 + cos 2t) sin 3t, z = sin 4t. Není to torusový uzel.</p>`,
    zdroje: ['Parametrizace: P. Bourke, Knots (paulbourke.net).'],
  });

  const JMENA = { '2,3': 'trojlístek', '2,5': 'pětilístek (cinquefoil)', '2,7': 'sedmilístek', '3,4': 'uzel 8₁₉', '3,5': 'uzel 10₁₂₄' };
  N.registruj({
    id: 'torusuzel', nazev: 'Torusový uzel (p, q)', skupina: 'Uzly', stitek: 'presna',
    parametry: [
      { id: 'p', nazev: 'p (oběhy kolem osy)', min: 1, max: 9, krok: 1, vychozi: 3, cele: true },
      { id: 'q', nazev: 'q (oběhy trubkou)', min: 1, max: 12, krok: 1, vychozi: 5, cele: true },
      { id: 'r', nazev: 'Tloušťka trubky', min: 0.05, max: 0.6, krok: 0.01, vychozi: 0.18 },
    ],
    generuj(p, k) {
      const d = N.gcd(p.p, p.q), pp = p.p / d, qq = p.q / d;
      const site = [];
      for (let c = 0; c < d; c++) {
        const off = 2 * PI * c / (pp * d);
        const s = trubkaSKontrolou(t => {
          const fi = pp * t, th = qq * t + off;
          const rr = 2 + cos(th);
          return [rr * cos(fi), rr * sin(fi), sin(th)];
        }, Math.round(Math.max(120, 90 * (pp + qq)) * Q(k)), p.r, Math.round(20 * Q(k)));
        site.push(s);
      }
      const sit = N.spoj(site);
      sit.stredy = site.map(s => s.stred);
      sit.delka = site.reduce((a, s) => a + s.delka, 0);
      // nejmenší vzdálenost i mezi komponentami
      let m = Math.min(...site.map(s => s.minVzd));
      for (let a = 0; a < d; a++) for (let b = a + 1; b < d; b++)
        for (const x of site[a].stred) for (const y of site[b].stred) m = Math.min(m, N.v.len(N.v.sub(x, y)));
      sit.minVzd = m;
      // komponenty spleti různými barvami
      if (d > 1) {
        const pal = [[0.29, 0.56, 0.85], [0.93, 0.55, 0.2], [0.3, 0.7, 0.4], [0.8, 0.3, 0.5], [0.6, 0.45, 0.85], [0.85, 0.75, 0.25]];
        const b = new Float32Array(sit.tri.length);
        let t = 0;
        site.forEach((s, i) => { for (let j = 0; j < s.tri.length / 3; j++, t++) b.set(pal[i % pal.length], 3 * t); });
        sit.barvy = b;
      }
      return sit;
    },
    teorie: p => {
      const d = N.gcd(p.p, p.q);
      return { chi: 0, orient: true, okraje: 0, komponenty: d, pruniky: null, rod: d === 1 ? 1 : null,
        pozn: d > 1 ? `NSD(${p.p}, ${p.q}) = ${d}: nevznikne uzel, ale spleť ${d} komponent – každá je torusový uzel (${p.p / d}, ${p.q / d}).`
          : (Math.min(p.p, p.q) === 1 ? 'Pro p = 1 nebo q = 1 je křivka nezauzlená (je to jen zvlněná kružnice).' : '') };
    },
    cisla(p, s) {
      const d = N.gcd(p.p, p.q), a = p.p / d, b = p.q / d;
      const r = [];
      if (d === 1) {
        const triv = Math.min(a, b) === 1;
        const jm = JMENA[Math.min(a, b) + ',' + Math.max(a, b)];
        r.push(['Typ', triv ? 'nezauzlená kružnice' : `torusový uzel T(${a}, ${b})${jm ? ' – ' + jm : ''}`, null, '']);
        r.push(['Počet křížení (min.)', '–', triv ? 0 : Math.min(a * (b - 1), b * (a - 1)), '', 'Pro torusový uzel T(p, q) platí c = min(p(q − 1), q(p − 1)) (Murasugi 1991).']);
      } else r.push(['Typ', `spleť ${d} komponent`, null, '']);
      return r.concat([
        ['Délka osy', N.fmt(s.delka, 5), null, ''],
        ['Nejmenší vzdálenost větví osy', N.fmt(s.minVzd, 4), `> ${N.fmt(2 * p.r, 3)}`, s.minVzd > 2 * p.r ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>',
          'Pokud je menší než dvojnásobek tloušťky trubky, trubka se protíná sama se sebou.']]);
    },
    legenda: 'každá komponenta spleti má vlastní barvu',
    popis: `<p>Křivka navinutá na torus: <i>p</i>-krát obejde osu symetrie a <i>q</i>-krát projde otvorem.
      x = (2 + cos qt) cos pt, y = (2 + cos qt) sin pt, z = sin qt.</p>
      <p>Pokud jsou <i>p</i> a <i>q</i> nesoudělná, vznikne jeden uzel. Pokud mají společného dělitele <i>d</i>, křivka se uzavře dřív
      a vznikne <b>spleť</b> <i>d</i> samostatných komponent. Aplikace je obarví různě a změřený počet komponent porovná s NSD(p, q).</p>
      <p>T(2, 3) je trojlístek, T(2, 5) pětilístek. T(p, q) a T(q, p) je tentýž uzel.</p>`,
    zdroje: ['K. Murasugi (1991), On the braid index of alternating links, Trans. AMS 326.', 'D. Rolfsen, Knots and Links.'],
  });
})(NEM);
