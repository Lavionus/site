/* Laboratoř nemožných tvarů – matematicky zvláštní tělesa: Diniho plocha, Gabrielův roh.
   (Gömböc má vlastní soubor gomboc.js.) */
(function (N) {
  'use strict';
  const { cos, sin, PI, sqrt, log, tan, exp } = Math;
  const Q = k => ({ nizka: 0.5, stredni: 1, vysoka: 2 })[k] || 1;

  /* ---------- Diniho plocha ---------- */
  N.registruj({
    id: 'dini', nazev: 'Diniho plocha', skupina: 'Matematicky zvláštní tělesa', stitek: 'presna',
    parametry: [
      { id: 'a', nazev: 'a (poloměr)', min: 0.3, max: 2, krok: 0.05, vychozi: 1 },
      { id: 'b', nazev: 'b (stoupání)', min: 0, max: 0.6, krok: 0.01, vychozi: 0.2 },
      { id: 'ot', nazev: 'Otáčky', min: 0.5, max: 4, krok: 0.5, vychozi: 2 },
      { id: 'v0', nazev: 'Začátek v (špička)', min: 0.01, max: 0.5, krok: 0.01, vychozi: 0.06 },
    ],
    generuj(p, k) {
      const f = (u, v) => [p.a * cos(u) * sin(v), p.a * sin(u) * sin(v), p.a * (cos(v) + log(tan(v / 2))) + p.b * u];
      return N.plocha({ f, u: [0, 2 * PI * p.ot], v: [p.v0, 2], nu: Math.round(70 * p.ot * Q(k)), nv: Math.round(70 * Q(k)) });
    },
    teorie: p => ({ chi: 1, orient: true, okraje: 1, pruniky: p.b === 0 && p.ot > 1 ? true : null,
      pozn: p.b === 0 && p.ot > 1 ? 'Při b = 0 se plocha nezvedá a další otáčky leží přesně na té první: plocha překrývá sama sebe.' : '' }),
    krivost: p => ({ K: -1 / (p.a * p.a + p.b * p.b) }),
    krivostKonst: p => -1 / (p.a * p.a + p.b * p.b),
    barveni: 'K',
    cisla(p, s) {
      const K = [...N.krivostDiskretni(s).values()].filter(isFinite).sort((x, y) => x - y);
      const q = f => K[Math.min(K.length - 1, Math.floor(f * K.length))];
      const Kt = -1 / (p.a * p.a + p.b * p.b);
      return [['K z trojúhelníků (úhlový defekt)', `medián ${N.fmt(q(0.5), 4)}; 5–95 %: ${N.fmt(q(0.05), 3)} … ${N.fmt(q(0.95), 3)}`, N.fmt(Kt, 4),
        Math.abs(q(0.5) - Kt) < 0.02 * Math.abs(Kt) ? '<span class="ok">✔</span>' : '<span class="ne">≈</span>',
        'Nezávislá kontrola jen ze sítě: (2π − součet úhlů u vrcholu) / (třetina plochy okolních trojúhelníků). U špičky jsou trojúhelníky protáhlé a odhad tam kolísá, proto medián.']];
    },
    popis: `<p>Šroubovitě stočená <b>pseudosféra</b>, kterou popsal Ulisse Dini roku 1866.
      x = a cos u sin v, y = a sin u sin v, z = a(cos v + ln tan(v/2)) + b·u.</p>
      <p>Má <b>konstantní zápornou Gaussovu křivost</b> K = −1/(a² + b²). V každém bodě je stejně „sedlovitá“,
      takže je to kus hyperbolické roviny vložený do prostoru. Pro b = 0 vznikne pseudosféra (traktricoid).</p>
      <p>Barvy ukazují K. Plocha je celá stejně modrá. Panel vlastností měří K dvěma nezávislými způsoby:
      z parametrizace (fundamentální formy) a jen z trojúhelníků sítě (úhlový defekt).</p>
      <p>Podle Hilbertovy věty (1901) nelze celou hyperbolickou rovinu hladce vnořit do ℝ³. Proto má každý takový model okraj nebo singularitu,
      tady ostrou špičku pro v → 0.</p>`,
    zdroje: ['U. Dini (1866).', 'D. Hilbert (1901), Über Flächen von konstanter Gaussscher Krümmung.'],
  });

  /* ---------- Gabrielův roh ---------- */
  function plochaRohu(a) {
    // A(a) = 2π ∫_1^a (1/x) √(1 + 1/x⁴) dx, substituce x = e^s: 2π ∫_0^{ln a} √(1 + e^{−4s}) ds (Simpson)
    const L = log(a), n = 4000, h = L / n;
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
      s += w * sqrt(1 + exp(-4 * i * h));
    }
    return 2 * PI * s * h / 3;
  }
  N.plochaRohu = plochaRohu;
  N.registruj({
    id: 'gabriel', nazev: 'Gabrielův roh', skupina: 'Matematicky zvláštní tělesa', stitek: 'presna',
    parametry: [
      { id: 'la', nazev: 'Délka a (log₁₀)', min: 0.3, max: 6, krok: 0.05, vychozi: 1, format: x => '10^' + x.toFixed(2).replace('.', ',') },
      { id: 'osa', nazev: 'Osa x', volby: [['lin', 'skutečná'], ['log', 'logaritmická']], vychozi: 'lin' },
    ],
    generuj(p, k) {
      const a = Math.pow(10, p.la), L = log(a);
      const f = p.osa === 'log'
        ? (s, t) => [s, cos(t) * exp(-s), sin(t) * exp(-s)]
        : (s, t) => [exp(s), cos(t) * exp(-s), sin(t) * exp(-s)];
      const sit = N.plocha({ f, u: [0, L], v: [0, 2 * PI], nu: Math.round(Math.max(60, 40 * L) * Q(k)), nv: Math.round(64 * Q(k)), sev: { v: 'per' } });
      sit.a = a;
      return sit;
    },
    teorie: (p, s) => {
      const a = Math.pow(10, p.la);
      return { chi: 0, orient: true, okraje: 2, pruniky: false, plocha: p.osa === 'lin' ? plochaRohu(a) : null,
        pozn: p.osa === 'log' ? 'Na logaritmické ose není tvar skutečný, proto se změřená plocha s teorií neporovnává. Čísla níže ale platí pro skutečný roh.' : '' };
    },
    cisla(p, s) {
      const a = Math.pow(10, p.la);
      const V = PI * (1 - 1 / a), A = plochaRohu(a);
      const r = [
        ['Objem π(1 − 1/a)', N.fmt(V, 7), `→ π = ${N.fmt(PI, 7)}`, '', 'V = π ∫₁^a dx/x² = π(1 − 1/a). Pro a → ∞ konverguje k π.'],
        ['Plocha 2π∫(1/x)√(1 + 1/x⁴)dx', N.fmt(A, 7), '→ ∞', '', 'Simpsonovo pravidlo s 4 000 úseky po substituci x = eˢ.'],
        ['Dolní mez plochy 2π ln a', N.fmt(2 * PI * log(a), 7), '→ ∞', '', 'Protože √(1 + 1/x⁴) > 1, je plocha větší než 2π ∫₁^a dx/x = 2π ln a, a to roste nade všechny meze.'],
        ['Poměr plocha / objem', N.fmt(A / V, 5), '→ ∞', ''],
      ];
      if (p.osa === 'lin') {
        // objem ze sítě: roh se skutečně uzavře dvěma víčky (vějíře trojúhelníků do středů kruhů)
        // a objem spočte obecná funkce – orientaci si určí sama z topologie
        const { nu, nv } = s.mriz, W = nv + 1, V0 = s.poz.length / 3;
        const poz = new Float64Array(s.poz.length + 6);
        poz.set(s.poz); poz.set([1, 0, 0, a, 0, 0], s.poz.length);
        const tri = Array.from(s.tri);
        for (let j = 0; j < nv; j++) { tri.push(V0, j + 1, j); tri.push(V0 + 1, nu * W + j, nu * W + j + 1); }
        const svar = new Int32Array(V0 + 2);
        svar.set(s.svar); svar[V0] = V0; svar[V0 + 1] = V0 + 1;
        const uz = { poz, tri: Uint32Array.from(tri), svar };
        const tu = N.topologie(uz);
        const Vsit = N.objemSite(uz, tu);
        r.push(['Objem změřený na síti (+ 2 víčka)', Vsit == null ? 'nelze' : N.fmt(Vsit, 6), N.fmt(V, 6), Vsit != null && Math.abs(Vsit - V) / V < 0.01 ? '<span class="ok">✔</span>' : '<span class="ne">≈</span>',
          `Síť se uzavře kruhovými víčky v x = 1 a x = a (χ uzavřené sítě = ${tu.chi}, tedy sféra) a objem se spočte větou o divergenci.`]);
      }
      return r;
    },
    popis: `<p>Roh vznikne rotací křivky y = 1/x pro x ≥ 1 kolem osy x. Popsal ho Evangelista Torricelli roku 1643 („akutní hyperbolické těleso“).</p>
      <p><b>Paradox:</b> objem je konečný, V = π(1 − 1/a) → π, ale plocha povrchu roste nade všechny meze, nejméně jako 2π ln a.
      Roh by tedy šel „naplnit“ π litry barvy, ale jeho vnitřní povrch by nešel natřít žádným konečným množstvím.</p>
      <p>Paradox mizí, když si uvědomíme, že vrstva barvy konstantní tloušťky se do úzkého hrdla nevejde. Matematická plocha nemá tloušťku.</p>
      <p>Model je přesný, ale konečný: zobrazuje se jen úsek 1 ≤ x ≤ a. Posuvník jde až do a = 10⁶. Čísla v panelu ukazují, jak se objem blíží π a plocha dál roste.
      Na skutečné ose je dlouhý roh jen tenká jehla, proto lze přepnout na logaritmickou osu (tvar je pak deformovaný, čísla ale platí).</p>`,
    zdroje: ['E. Torricelli (1643), De solido hyperbolico acuto.', 'J. Fleron (1999), Gabriel\'s wedding cake, College Math. J. 30.'],
  });
})(NEM);
