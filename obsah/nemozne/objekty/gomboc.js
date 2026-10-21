/* Laboratoř nemožných tvarů – Gömböc a srovnávací tělesa.
   Analytický tvar podle M. L. Sloana (2023): r⁴ = 1 + 4ε sin θ cos(φ − P(θ)).
   Aplikace NIC nepřebírá z tvrzení článku: těžiště, rovnovážné polohy i konvexitu
   měří sama (rovnovaha.js) a podle výsledku volí štítek. */
(function (N) {
  'use strict';
  const { sin, cos, PI, pow, abs } = Math;
  const Q = k => ({ nizka: 0.5, stredni: 1, vysoka: 2 })[k] || 1;

  const TVARY = {
    g5: { nazev: 'Gömböc – Sloan 1 (P = 5θ)', gomboc: true, P: t => 5 * t },
    gc: { nazev: 'Gömböc – Sloan 2', gomboc: true, P: t => 1.5 * PI * (cos(t) - cos(t) ** 3 / 3) },
    eli: { nazev: 'elipsoid (srovnání)', r: (t, f) => 1 / Math.sqrt((sin(t) * cos(f) / 1.3) ** 2 + (sin(t) * sin(f) / 1) ** 2 + (cos(t) / 0.75) ** 2) },
    kos: { nazev: 'zaoblená kostka (srovnání)', r: (t, f) => { const x = sin(t) * cos(f), y = sin(t) * sin(f), z = cos(t); return pow(pow(abs(x), 6) + pow(abs(y), 6) + pow(abs(z), 6), -1 / 6); } },
  };
  function radialni(p) {
    const T = TVARY[p.tvar];
    if (T.r) return T.r;
    const e = p.eps, P = T.P;
    return (t, f) => pow(1 + 4 * e * sin(t) * cos(f - P(t)), 0.25);
  }

  N.radialniGomboc = radialni;
  const cache = new Map();
  function rozbor(p) {
    const klic = p.tvar + '|' + (TVARY[p.tvar].gomboc ? p.eps : '');
    if (cache.has(klic)) return cache.get(klic);
    const r = radialni(p);
    const a = N.rozborRovnovah(r, 160, 320);
    a.konvex = N.konvexitaRadialni(r, 200, 400);
    if (cache.size > 40) cache.clear();
    cache.set(klic, a);
    return a;
  }
  N.rozborGomboc = rozbor;

  function overeno(p, a) {
    return TVARY[p.tvar].gomboc && a.S === 1 && a.U === 1 && a.H === 0 && a.konvex.Kmin > 0 && Math.hypot(...a.G) < 1e-6;
  }

  N.registruj({
    id: 'gomboc', nazev: 'Gömböc', skupina: 'Matematicky zvláštní tělesa', stitek: 'overena',   // platí pro výchozí parametry; skutečný štítek určí stitekDyn
    parametry: [
      { id: 'tvar', nazev: 'Těleso', volby: Object.entries(TVARY).map(([k, v]) => [k, v.nazev]), vychozi: 'gc' },
      { id: 'eps', nazev: 'Odchylka od koule ε', min: 0.002, max: 0.15, krok: 0.0005, vychozi: 0.03, kdy: p => TVARY[p.tvar].gomboc, format: x => x.toFixed(4).replace('.', ',') },
      { id: 'zv', nazev: 'Zvýraznění tvaru ×', min: 1, max: 12, krok: 1, vychozi: 1, cele: true, kdy: p => TVARY[p.tvar].gomboc },
    ],
    generuj(p, k) {
      const r = radialni(p), z = TVARY[p.tvar].gomboc ? p.zv : 1;
      // zobrazení: odchylka od jednotkové koule zvětšená z× (jen vizuálně; ověřuje se skutečný tvar)
      const f = (t, fi) => { const rr = 1 + z * (r(t, fi) - 1); return [rr * sin(t) * cos(fi), rr * sin(t) * sin(fi), rr * cos(t)]; };
      const sit = N.plocha({ f, u: [0, PI], v: [0, 2 * PI], nu: Math.round(90 * Q(k)), nv: Math.round(180 * Q(k)), sev: { v: 'per', bod: ['u0', 'u1'] } });
      sit.rozbor = rozbor(p);
      sit.fZobr = f;
      // hodnoty pro barvy: odchylka skutečného (nezvýrazněného) poloměru od 1
      sit.hodnoty = new Float64Array(sit.uv.length / 2);
      for (let i = 0; i < sit.hodnoty.length; i++) sit.hodnoty[i] = r(sit.uv[2 * i], sit.uv[2 * i + 1]) - 1;
      return sit;
    },
    stitekDyn: (p, s) => TVARY[p.tvar].gomboc ? (overeno(p, s.rozbor) ? 'overena' : 'ilustrativni') : 'presna',
    stitekPozn(p, s) {
      const a = s.rozbor;
      if (!TVARY[p.tvar].gomboc) return 'Srovnávací těleso, není to Gömböc. Ukazuje, kolik rovnovážných poloh má běžné konvexní těleso.';
      if (overeno(p, a)) return `<b>Tento tvar je Gömböc – ověřeno zde, numericky:</b> 1 stabilní a 1 nestabilní poloha, žádné sedlo,
        nejmenší Gaussova křivost K = ${N.fmt(a.konvex.Kmin, 3)} &gt; 0 (konvexní) na mřížce 200 × 400 bodů, těžiště v počátku.
        ${p.zv > 1 ? `<br><b>Pozor:</b> zobrazení je ${p.zv}× zvýrazněné, aby byl tvar vidět. Zvýrazněný tvar sám Gömböc být nemusí. Ověřuje se skutečný tvar.` : ''}`;
      const duvod = [];
      if (a.konvex.Kmin <= 0) duvod.push(`<b>není konvexní</b>: K klesá až na ${N.fmt(a.konvex.Kmin, 3)}, záporná je na ${N.fmt(a.konvex.podil * 100, 2)} % povrchu`);
      if (a.S !== 1 || a.U !== 1) duvod.push(`má ${a.S} stabilních a ${a.U} nestabilních poloh`);
      return `<b>Tento tvar NENÍ Gömböc</b>: ${duvod.join('; ')}. Gömböc musí být konvexní a homogenní.
        Rovnovážné polohy hladkého, ale nekonvexního tělesa už nejsou jen kritické body vzdálenosti od těžiště, protože se těleso může opřít o dva body.`;
    },
    teorie: p => ({ chi: 2, orient: true, okraje: 0, rod: 0, pruniky: false }),
    cisla(p, s) {
      const a = s.rozbor, gomb = TVARY[p.tvar].gomboc;
      const ok = b => b ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>';
      const ocek = { eli: [2, 2, 2], kos: [6, 8, 12] }[p.tvar] || [1, 1, 0];
      return [
        ['Stabilní polohy S', a.S, ocek[0], ok(a.S === ocek[0]), `Minima vzdálenosti povrchu od těžiště. Mřížka ${a.nt} × ${a.nf} našla ${a.diskretni.S} kandidátů, Newtonova metoda je sloučila.`],
        ['Nestabilní polohy U', a.U, ocek[1], ok(a.U === ocek[1]), 'Maxima vzdálenosti od těžiště.'],
        ['Sedlové polohy H', a.H, ocek[2], ok(a.H === ocek[2]), 'Sedlové body vzdálenosti od těžiště.'],
        ['Kontrola S − H + U', a.PH, 2, ok(a.PH === 2), 'Poincaréova–Hopfova věta: pro každé těleso tvaru koule platí S − H + U = 2. Kontroluje, že se žádný bod nevynechal.'],
        ['Nejmenší Gaussova křivost', N.fmt(a.konvex.Kmin, 4), '> 0', ok(a.konvex.Kmin > 0), `Konvexní těleso má K > 0 všude. Měřeno v ${a.konvex.n.toLocaleString('cs-CZ')} bodech.`],
        ['Těžiště (numericky)', a.G.map(x => N.fmt(x, 2)).join('; '), '0; 0; 0', ok(Math.hypot(...a.G) < 1e-6), 'Integrál přes objem tělesa (středová pravidla, 320 × 640).'],
        ['Objem', N.fmt(a.V, 6), gomb ? `4π/3 = ${N.fmt(4 * PI / 3, 6)}` : null, '', gomb ? 'Pro Sloanův tvar je ∫r³ sin θ dθ dφ / 3 blízko objemu koule.' : ''],
      ];
    },
    poZobrazeni(pohled, p, s) {
      const a = s.rozbor, f = s.fZobr, d = pohled.obal.r * 0.035;
      const znacky = new THREE.Group();
      const koule = (b, barva) => { const m = new THREE.Mesh(new THREE.SphereGeometry(d, 16, 12), new THREE.MeshStandardMaterial({ color: barva })); m.position.set(...f(b.t, b.f)); znacky.add(m); };
      a.stabilni.forEach(b => koule(b, 0x22aa55));
      a.nestabilni.forEach(b => koule(b, 0xdd3333));
      a.sedla.forEach(b => koule(b, 0xe8b400));
      pohled.vrstva('rovnovahy', znacky);
    },
    legenda: '',
    tlacitka: [{ text: '🎲 Pustit na stůl', akce: kutalej }, { text: '↺ Zpět', akce: (pohled) => { pohled.orientace(null); pohled.stul(null); } }],
    barveni: 'strany',
    hodnotyText: 'vzdálenost od těžiště r − 1',
    popis: `<p>Gömböc je <b>konvexní homogenní</b> těleso s jedinou stabilní a jedinou nestabilní rovnovážnou polohou. Položený na stůl
      se vždy převalí do téže polohy, podobně jako vstávací panáček, ale bez závaží uvnitř. Existenci takového tělesa předpověděl V. Arnold (1995),
      dokázali a první tvar sestrojili G. Domokos a P. Várkonyi (2006).</p>
      <p>V rovině takový tvar neexistuje: každá konvexní křivka má aspoň 4 rovnovážné polohy (2 stabilní a 2 nestabilní, souvisí to s větou o čtyřech vrcholech).
      Ve 3D to jde, ale tvar musí být téměř kulový a velmi pečlivě vyladěný.</p>
      <p><b>Model:</b> analytický tvar M. L. Sloana (2023): r⁴ = 1 + 4ε sin θ cos(φ − P(θ)), kde P(θ) = 5θ (varianta 1)
      nebo P(θ) = (3π/2)(cos θ − cos³θ/3) (varianta 2). Funkce P je zvolená tak, aby těžiště leželo přesně v počátku.
      Vzdálenost povrchu od středu má pak právě dva kritické body.</p>
      <p><b>Co ověřuje aplikace:</b> těžiště numerickou integrací, rovnovážné polohy (kritické body vzdálenosti od těžiště: mřížka, Newtonova metoda,
      kontrola Poincaré–Hopf) a <b>konvexitu</b> (Gaussova křivost na husté mřížce). Zelený štítek se objeví, jen když projdou všechny tři kontroly.</p>
      <p><b>Konvexita je slabé místo:</b> Sloan uvádí, že stačí ε ≤ 0,15 (var. 1), resp. 0,17 (var. 2). Naše měření ukazuje, že tvar přestane být konvexní už
      pro ε nad ≈ 0,0323 (var. 1), resp. ≈ 0,0355 (var. 2). Nejdřív se promáčkne místo stabilní polohy. To se shoduje s nezávislou analýzou
      T. Coueyho (2026), který pro variantu 2 udává mez ≈ 0,036 a pro ε = 0,05 záporné K na 4 % povrchu (aplikace naměří 3,9 %).
      Posuvníkem ε lze hranici překročit a štítek zčervená.</p>
      <p>Skutečný Gömböc firmy Domokos–Várkonyi má jiný, ručně vyladěný tvar s ostřejšími hranami. Jeho přesná data nejsou zveřejněná,
      proto se zde nezobrazuje. Tento model je jiné, matematicky popsané těleso stejné třídy.</p>
      <p>Tlačítko <b>Pustit na stůl</b> položí těleso v náhodné poloze a nechá ho kvazistaticky kutálet tak, aby těžiště klesalo
      (gradientní sestup po opěrné funkci). Gömböc skončí vždy ve stejné poloze, elipsoid ve dvou různých.</p>`,
    zdroje: ['P. L. Várkonyi, G. Domokos (2006), Mono-monostatic bodies: the answer to Arnold\'s question, Math. Intelligencer 28(4), 34–38.',
      'M. L. Sloan (2023), An Analytical Gomboc, arXiv:2306.14914.',
      'T. Couey (2026), arXiv:2604.17120 (konvexita Sloanovy parametrizace, v2).',
      'G. Domokos, J. Papadopulos, A. Ruina (1994), Static equilibria of planar, rigid bodies: is there anything new? J. Elasticity 36.'],
  });

  /* ---------- kutálení na stole ---------- */
  const historie = { klic: null, konce: [] };
  function kutalej(pohled, p, s, ui) {
    const r = radialni(p), a = s.rozbor, G = a.G;
    // náhodný počáteční směr „dolů“ v soustavě tělesa; kutálení po hladkém tělese (rovnovaha.js)
    const z = 2 * Math.random() - 1, fi = 2 * PI * Math.random();
    const k = N.kutaleni(r, G, [Math.sqrt(1 - z * z) * cos(fi), Math.sqrt(1 - z * z) * sin(fi), z]);
    // pro animaci stačí nejvýš ~400 snímků
    const krok = Math.max(1, Math.ceil(k.drahy.length / 400));
    const drahy = k.drahy.filter((_, i) => i % krok === 0 || i === k.drahy.length - 1);
    const vysky = k.vysky.filter((_, i) => i % krok === 0 || i === k.vysky.length - 1);
    const konec = k.konec;
    // ve kterém spočítaném stabilním bodě těleso skončilo
    const stab = a.stabilni.map(b => [sin(b.t) * cos(b.f), sin(b.t) * sin(b.f), cos(b.t)]);
    let iStab = -1, odch = Infinity;
    stab.forEach((w, i) => { const d = Math.acos(Math.min(1, N.v.dot(w, konec))); if (d < odch) { odch = d; iStab = i; } });
    const klic = p.tvar + '|' + p.eps;
    if (historie.klic !== klic) { historie.klic = klic; historie.konce = []; historie.pokusu = 0; }
    if (!historie.konce.some(c => N.v.dot(c, konec) > 0.999)) historie.konce.push(konec);
    const pokusu = ++historie.pokusu;
    // animace: těleso se natáčí tak, aby n mířilo dolů
    const meritko = TVARY[p.tvar].gomboc ? p.zv : 1;
    const snimky = N.orientaceDolu(drahy).map((q, i) => ({ q, stul: -(1 + meritko * (vysky[i] - 1)) - 0.002 }));
    ui.zprava('Těleso se kutálí…');
    N.prehrajNaStole(pohled, snimky, Math.min(6000, 800 + snimky.length * 6), () => {
        ui.zprava(`Těleso se zastavilo po ${k.kroku} krocích sestupu ve stabilní poloze ${iStab + 1} z ${stab.length}${k.konecTyp && k.konecTyp !== 'min' ? ' (POZOR: koncový bod není minimum)' : ''}.
          Výška těžiště klesla z ${N.fmt(vysky[0], 5)} na ${N.fmt(vysky[vysky.length - 1], 5)}.
          Pokusů s tímto tvarem: <b>${pokusu}</b>, různých koncových poloh: <b>${historie.konce.length}</b>${TVARY[p.tvar].gomboc ? '' : ` (teorie: ${a.S})`}.`);
    });
  }
})(NEM);
