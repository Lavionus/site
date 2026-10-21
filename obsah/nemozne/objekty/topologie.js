/* Laboratoř nemožných tvarů – topologické objekty: torus, Möbiova páska, Kleinova láhev,
   Boyova plocha, Římská plocha. Všechny jsou přesné parametrizace. */
(function (N) {
  'use strict';
  const { cos, sin, PI, sqrt } = Math;
  const Q = k => ({ nizka: 0.5, stredni: 1, vysoka: 2 })[k] || 1;   // násobek rozlišení

  /* ---------- torus ---------- */
  N.registruj({
    id: 'torus', nazev: 'Torus', skupina: 'Topologické objekty', stitek: 'presna',
    parametry: [
      { id: 'R', nazev: 'Hlavní poloměr R', min: 0.2, max: 3, krok: 0.05, vychozi: 2 },
      { id: 'r', nazev: 'Vedlejší poloměr r', min: 0.1, max: 3, krok: 0.05, vychozi: 0.8 },
    ],
    generuj(p, k) {
      const n = Math.round(96 * Q(k)), m = Math.round(48 * Q(k));
      return N.plocha({
        f: (u, v) => [(p.R + p.r * cos(v)) * cos(u), (p.R + p.r * cos(v)) * sin(u), p.r * sin(v)],
        u: [0, 2 * PI], v: [0, 2 * PI], nu: n, nv: m, sev: { u: 'per', v: 'per' },
      });
    },
    teorie: p => p.r < p.R
      ? { chi: 0, orient: true, okraje: 0, rod: 1, plocha: 4 * PI * PI * p.R * p.r, objem: 2 * PI * PI * p.R * p.r * p.r, pruniky: false }
      : { chi: 0, orient: true, okraje: 0, rod: 1, pruniky: null,
          pozn: 'Pro r ≥ R je to vřetenový torus: vnitřní část projde osou a plocha se sama sebe dotkne ve dvou bodech na ose (proto měření nenajde žádnou čáru průniku). Vzorce 4π²Rr a 2π²Rr² platí jen pro r < R.' },
    cesta: { v: 0, popis: 'po vnějším rovníku' },
    popis: `<p>Plocha rodu 1: povrch koblihy. Vznikne rotací kružnice o poloměru <i>r</i> kolem osy ve vzdálenosti <i>R</i>.</p>
      <p>Parametrizace: x = (R + r cos v) cos u, y = (R + r cos v) sin u, z = r sin v.</p>
      <p>Eulerova charakteristika χ = 0, orientovatelná, bez okraje. Plocha 4π²Rr, objem 2π²Rr² (Pappovy věty).
      Panel vlastností obě čísla měří přímo na síti, takže je vidět i chyba vzorkování.</p>`,
    zdroje: ['Pappos–Guldinovy věty o rotačních tělesech.'],
  });

  /* ---------- Möbiova páska ---------- */
  N.registruj({
    id: 'mobius', nazev: 'Möbiova páska', skupina: 'Topologické objekty', stitek: 'presna',
    parametry: [
      { id: 'R', nazev: 'Poloměr', min: 0.5, max: 3, krok: 0.05, vychozi: 2 },
      { id: 'w', nazev: 'Šířka', min: 0.1, max: 2.5, krok: 0.05, vychozi: 1.2 },
      { id: 'n', nazev: 'Počet půlotáček', min: 0, max: 7, krok: 1, vychozi: 1, cele: true },
    ],
    generuj(p, k) {
      const n = p.n, nu = Math.round(160 * Q(k)), nv = Math.round(16 * Q(k));
      return N.plocha({
        f: (u, s) => [(p.R + s * cos(n * u / 2)) * cos(u), (p.R + s * cos(n * u / 2)) * sin(u), s * sin(n * u / 2)],
        u: [0, 2 * PI], v: [-p.w / 2, p.w / 2], nu, nv, sev: { u: n % 2 ? 'flip' : 'per' },
      });
    },
    teorie: p => ({ chi: 0, orient: p.n % 2 === 0, okraje: p.n % 2 ? 1 : 2,
      pruniky: p.w / 2 >= p.R ? null : false,
      pozn: p.n % 2 ? 'Lichý počet půlotáček: jedna strana a jeden okraj.' : 'Sudý počet půlotáček: dvě strany a dva okraje (zkroucené mezikruží).' }),
    cesta: { v: 0, popis: 'po střední kružnici' },
    popis: `<p>Páska s jednou stranou a jedním okrajem. Vznikne slepením obdélníku s jedním převrácením.</p>
      <p>Parametrizace s <i>n</i> půlotáčkami: x = (R + s cos(nu/2)) cos u, y = (R + s cos(nu/2)) sin u, z = s sin(nu/2),
      u ∈ [0, 2π], s ∈ [−w/2, w/2].</p>
      <p>Při <b>lichém n</b> se bod (2π, s) ztotožní s bodem (0, −s): plocha je neorientovatelná a má jeden okraj.
      Při <b>sudém n</b> vznikne oboustranné zkroucené mezikruží se dvěma okraji. Zkuste nástroj
      „Obarvit jednu stranu“ a „Mravenec“.</p>`,
    zdroje: ['A. F. Möbius (1858), J. B. Listing (1858).'],
  });

  /* ---------- Kleinova láhev ---------- */
  N.registruj({
    id: 'klein', nazev: 'Kleinova láhev', skupina: 'Topologické objekty', stitek: 'presna',
    parametry: [
      { id: 'tvar', nazev: 'Imerze', volby: [['lahev', 'klasická „láhev“'], ['osmicka', 'osmička (figure-8)']], vychozi: 'lahev' },
      { id: 'R', nazev: 'Poloměr osmičky', min: 1.2, max: 4, krok: 0.1, vychozi: 2.5, kdy: p => p.tvar === 'osmicka' },
    ],
    generuj(p, k) {
      if (p.tvar === 'osmicka') {
        const R = p.R;
        return N.plocha({
          f: (u, v) => {
            const r = R + cos(u / 2) * sin(v) - sin(u / 2) * sin(2 * v);
            return [r * cos(u), r * sin(u), sin(u / 2) * sin(v) + cos(u / 2) * sin(2 * v)];
          },
          u: [0, 2 * PI], v: [0, 2 * PI], nu: Math.round(140 * Q(k)), nv: Math.round(56 * Q(k)), sev: { u: 'flip', v: 'per' },
        });
      }
      // klasická láhev (parametrizace podle Wolfram MathWorld / Wikipedie), v posunuté o π/2,
      // aby šev byl (π, v) ≡ (0, −v); zvětšeno 2×
      const f = (u, w) => {
        const v = w - PI / 2;
        const c = cos(u), s = sin(u), cv = cos(v), sv = sin(v);
        const c2 = c * c, c3 = c2 * c, c4 = c2 * c2, c5 = c4 * c, c6 = c4 * c2, c7 = c6 * c;
        const x = -2 / 15 * c * (3 * cv - 30 * s + 90 * c4 * s - 60 * c6 * s + 5 * c * cv * s);
        const y = -1 / 15 * s * (3 * cv - 3 * c2 * cv - 48 * c4 * cv + 48 * c6 * cv - 60 * s + 5 * c * cv * s
          - 5 * c3 * cv * s - 80 * c5 * cv * s + 80 * c7 * cv * s);
        const z = 2 / 15 * (3 + 5 * c * s) * sv;
        return [2 * x, 2 * z, 2 * y - 2];
      };
      return N.plocha({ f, u: [0, PI], v: [0, 2 * PI], nu: Math.round(160 * Q(k)), nv: Math.round(48 * Q(k)), sev: { u: 'flip', v: 'per' } });
    },
    teorie: () => ({ chi: 0, orient: false, okraje: 0, krizky: 2, pruniky: true,
      pozn: 'V ℝ³ jde jen o imerzi: plocha musí sama sebe protnout. Bez samoprůniku existuje až ve 4D.' }),
    cesta: { v: PI / 2, popis: 'podél láhve' },
    pohledVychozi: p => p.tvar === 'lahev' ? { az: 0.35, el: 0.12 } : { az: -0.6, el: 0.6 },
    popis: `<p>Uzavřená plocha bez okraje, která nemá vnitřek ani vnějšek. Vznikne slepením dvou konců válce
      „obráceně“, tedy s převrácením orientace.</p>
      <p>V trojrozměrném prostoru ji nejde sestrojit bez samoprůniku. Zobrazený model je <b>imerze</b>:
      lokálně je to plocha, ale protíná sama sebe. Čáru průniku zvýrazní volba „Samoprůniky“.</p>
      <p>Topologie: χ = 0, neorientovatelná, nemá okraj. Je to spojení dvou projektivních rovin (2 křížky).</p>
      <p><b>Láhev</b> je klasický tvar s hrdlem procházejícím stěnou. <b>Osmička</b> je trubka s průřezem tvaru osmičky,
      která se po obvodu pootočí o půl otáčky.</p>`,
    zdroje: ['F. Klein (1882).', 'Parametrizace láhve: Wolfram MathWorld „Klein Bottle“ (rovnice podle R. Ferréola).',
      'Imerze osmička: standardní parametrizace (viz Wikipedia „Klein bottle – figure 8 immersion“).'],
  });

  /* ---------- Boyova plocha ---------- */
  function boy(r, t) {
    // Bryantova–Kusnerova parametrizace, w = r e^{it} v jednotkovém kruhu.
    // Kvůli kořenům jmenovatele uvnitř kruhu se počítá s čitatelem · conj(jmenovatel).
    const wr = r * cos(t), wi = r * sin(t);
    const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
    const w = [wr, wi], w2 = mul(w, w), w3 = mul(w2, w), w4 = mul(w2, w2), w6 = mul(w3, w3);
    const s5 = sqrt(5);
    const d = [w6[0] + s5 * w3[0] - 1, w6[1] + s5 * w3[1]];
    const dc = [d[0], -d[1]], dd = d[0] * d[0] + d[1] * d[1];
    const n1 = mul(w, [1 - w4[0], -w4[1]]), n2 = mul(w, [1 + w4[0], w4[1]]), n3 = [1 + w6[0], w6[1]];
    const a1 = mul(n1, dc), a2 = mul(n2, dc), a3 = mul(n3, dc);
    const G1 = -1.5 * a1[1], G2 = -1.5 * a2[0], G3 = a3[1] - dd / 2;
    const GG = G1 * G1 + G2 * G2 + G3 * G3;
    return [G1 * dd / GG, G2 * dd / GG, G3 * dd / GG];
  }
  N.boy = boy;
  N.registruj({
    id: 'boy', nazev: 'Boyova plocha', skupina: 'Topologické objekty', stitek: 'presna',
    parametry: [],
    generuj(p, k) {
      return N.plocha({ f: (r, t) => { const b = boy(r, t); return [2.2 * b[0], 2.2 * b[1], 2.2 * b[2]]; },
        u: [0, 1], v: [0, 2 * PI], nu: Math.round(80 * Q(k)), nv: Math.round(180 * Q(k)) & ~1, sev: { v: 'per', bod: ['u0'], anti: 'u1' } });
    },
    teorie: () => ({ chi: 1, orient: false, okraje: 0, krizky: 1, pruniky: true,
      pozn: 'Imerze projektivní roviny: na rozdíl od Římské plochy nemá žádné singulární body, ale má trojný bod.' }),
    popis: `<p>Imerze <b>projektivní roviny</b> ℝP² do prostoru. Objevil ji Werner Boy v roce 1901, když měl dokázat, že taková imerze neexistuje.</p>
      <p>Použitá je <b>Bryantova–Kusnerova parametrizace</b>: pro komplexní w v jednotkovém kruhu se spočtou tři racionální funkce
      g₁, g₂, g₃ a bod je (g₁, g₂, g₃)/(g₁² + g₂² + g₃²). Protilehlé body hraniční kružnice (w a −w) padnou na stejné místo.
      Tak vznikne projektivní rovina. Aplikace tento šev sešívá podle parametru a změřená χ = 1 to potvrzuje.</p>
      <p>Plocha má trojnou symetrii a jeden trojný bod, kde se protínají tři listy.</p>`,
    zdroje: ['W. Boy (1903), Math. Annalen 57.', 'R. Bryant (1988), Surfaces of mean curvature one in hyperbolic space; R. Kusner (1987), Conformal geometry and complete minimal surfaces.'],
  });

  /* ---------- Římská plocha (Steiner) ---------- */
  // osa polokoule je obecně skloněná, aby hraniční kružnice neležela na rovině dvojných bodů
  const OSA = (() => { const a = [0.3, 0.45, 0.84]; const l = Math.hypot(...a); return a.map(x => x / l); })();
  const B1 = (() => { const t = [1, 0, 0]; const d = t[0] * OSA[0]; const b = [t[0] - d * OSA[0], -d * OSA[1], -d * OSA[2]]; const l = Math.hypot(...b); return b.map(x => x / l); })();
  const B2 = [OSA[1] * B1[2] - OSA[2] * B1[1], OSA[2] * B1[0] - OSA[0] * B1[2], OSA[0] * B1[1] - OSA[1] * B1[0]];
  N.registruj({
    id: 'roman', nazev: 'Římská plocha (Steiner)', skupina: 'Topologické objekty', stitek: 'presna',
    parametry: [],
    generuj(p, k) {
      const f = (fi, th) => {
        const c = cos(fi), s = sin(fi), ct = cos(th), st = sin(th);
        const x = c * OSA[0] + s * (ct * B1[0] + st * B2[0]);
        const y = c * OSA[1] + s * (ct * B1[1] + st * B2[1]);
        const z = c * OSA[2] + s * (ct * B1[2] + st * B2[2]);
        return [4 * y * z, 4 * x * z, 4 * x * y];
      };
      return N.plocha({ f, u: [0, PI / 2], v: [0, 2 * PI], nu: Math.round(70 * Q(k)), nv: Math.round(200 * Q(k)) & ~1, sev: { v: 'per', bod: ['u0'], anti: 'u1' } });
    },
    teorie: () => ({ chi: 1, orient: false, okraje: 0, krizky: 1, pruniky: true,
      pozn: 'Není to imerze: v šesti zaštípnutých bodech (pinch points) se plocha láme. Tři úsečky dvojných bodů se protínají v trojném bodě v počátku.' }),
    popis: `<p>Jakob Steiner ji objevil roku 1844 v Římě. Je to obraz jednotkové sféry při zobrazení (x, y, z) ↦ (yz, xz, xy).</p>
      <p>Protilehlé body sféry mají stejný obraz. Plocha je proto opět projektivní rovina (χ = 1, neorientovatelná).
      Aplikace kreslí jen jednu polokouli a její okraj sešije podle parametru (w ≡ −w).</p>
      <p>Na rozdíl od Boyovy plochy má <b>6 singulárních bodů</b> (konce tří úseček samoprůniku), takže nejde o imerzi.
      Splňuje algebraickou rovnici y²z² + x²z² + x²y² = xyz (zde zvětšeno 4×).</p>`,
    zdroje: ['J. Steiner (1844), publikoval K. Weierstrass (1863).', 'Wolfram MathWorld „Roman Surface“.'],
  });
})(NEM);
