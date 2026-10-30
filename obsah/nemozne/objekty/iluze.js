/* Laboratoř nemožných tvarů – optické iluze: Penroseův trojúhelník, nemožné schodiště,
   Sugiharův dvojznačný válec. Všechno jsou skutečná 3D tělesa; iluze vzniká jen
   z vypočteného směru pohledu v ortografické projekci. */
(function (N) {
  'use strict';
  const { sin, cos, PI, sqrt, asin, abs, pow } = Math;

  /** Šestistěn z 8 vrcholů v pořadí kvádru (x0y0z0, x1y0z0, x1y1z0, x0y1z0, totéž pro z1). */
  function sestisten(v, poz, tri, barvy, ton) {
    const b = poz.length / 3;
    for (const x of v) poz.push(...x);
    const steny = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5]];
    for (const [a, c, d, e] of steny) {
      tri.push(b + a, b + c, b + d, b + a, b + d, b + e);
      const n = N.v.norm(N.v.cross(N.v.sub(v[c], v[a]), N.v.sub(v[d], v[a])));
      const t = ton(n);
      barvy.push(...t, ...t);
    }
  }
  const kvadr = (x0, x1, y0, y1, z0, z1) => [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  /** Odstín podle směru stěny: vršek světlý, boky středně, čela tmavě (jako klasická kresba). */
  const tonPodleNormaly = zakl => n => {
    const k = n[2] > 0.5 ? 1 : n[2] < -0.5 ? 0.35 : abs(n[0]) > abs(n[1]) ? 0.72 : 0.5;
    return zakl.map(x => x * k);
  };
  function hotovo(poz, tri, barvy, extra) {
    const P = Float64Array.from(poz), svar = new Int32Array(P.length / 3);
    for (let i = 0; i < svar.length; i++) svar[i] = i;
    return Object.assign({ poz: P, tri: Uint32Array.from(tri), svar, barvy: Float32Array.from(barvy), ploche: true, bezTopologie: true, bezMer: true }, extra);
  }
  /** Ortografický průmět bodu do roviny kolmé na směr d (jednotkový): souřadnice v rovině obrazu. */
  function prumet(p, d) {
    const k = p[0] * d[0] + p[1] * d[1] + p[2] * d[2];
    return [p[0] - k * d[0], p[1] - k * d[1], p[2] - k * d[2]];
  }
  const smer = (az, el) => [cos(el) * sin(az), -cos(el) * cos(az), sin(el)];

  /* ---------- Penroseův trojúhelník ---------- */
  const PEN_AZ = 3 * PI / 4, PEN_EL = asin(1 / sqrt(3));
  N.registruj({
    id: 'penrose', nazev: 'Penroseův trojúhelník', skupina: 'Optické iluze', stitek: 'iluze',
    parametry: [
      { id: 'L', nazev: 'Délka trámu', min: 2.5, max: 8, krok: 0.5, vychozi: 4 },
      { id: 'w', nazev: 'Tloušťka trámu', min: 0.4, max: 1.5, krok: 0.05, vychozi: 1 },
    ],
    generuj(p) {
      const L = p.L, w = p.w, o = -(L + w) / 2;
      const poz = [], tri = [], barvy = [], ton = tonPodleNormaly([0.95, 0.8, 0.45]);
      const pos = v => v.map(q => [q[0] + o, q[1] + o, q[2] + o]);
      // trám A podél x, trám B podél y (na A navazuje skutečným rohem), trám C svisle (na B skutečným rohem)
      sestisten(pos(kvadr(0, L + w, 0, w, 0, w)), poz, tri, barvy, ton);
      sestisten(pos(kvadr(L, L + w, w, L + w, 0, w)), poz, tri, barvy, ton);
      // C je seříznutý rovinou z = y − w: rovina obsahuje směr pohledu (1, 1, 1) i osu x, takže
      // z kouzelného pohledu je řez vidět jen jako čára a C nezakryje začátek trámu A
      sestisten(pos([[L, L, w], [L + w, L, w], [L + w, L + w, w], [L, L + w, w], [L, L, L - w], [L + w, L, L - w], [L + w, L + w, L], [L, L + w, L]]), poz, tri, barvy, ton);
      return hotovo(poz, tri, barvy, { L, w });
    },
    teorie: () => ({}),
    kamera: () => ({ az: PEN_AZ, el: PEN_EL, orto: true }),
    cisla(p) {
      const d = smer(PEN_AZ, PEN_EL), L = p.L;
      const a = prumet([0, 0, 0], d), b = prumet([L, L, L], d);
      return [
        ['Směr kouzelného pohledu', '(1, 1, 1)/√3', null, '', 'Izometrický pohled: osy x, y, z se promítnou pod úhly 120°.'],
        ['Mezera mezi konci trámů ve 3D', N.fmt(L * sqrt(3), 4), null, '', 'Začátek A a konec C jsou ve 3D od sebe vzdálené L√3.'],
        ['Mezera v průmětu', N.fmt(N.v.len(N.v.sub(a, b)), 3), 0, '<span class="ok">✔</span>', 'Vektor (L, L, L) je rovnoběžný se směrem pohledu, proto se v průmětu ztratí.'],
      ];
    },
    legenda: 'odstín podle směru stěny',
    popis: `<p>„Nemožný“ trojúhelník, který nakreslil Oscar Reutersvärd (1934) a proslavil Roger Penrose (1958).</p>
      <p>Tady je to <b>skutečné 3D těleso</b>: tři kolmé trámy podél os x, y a z. Spojené jsou jen dvěma rohy, třetí roh chybí.
      Konec svislého trámu leží přesně o vektor (L, L, L) od začátku prvního. Ten je rovnoběžný se směrem izometrického pohledu, a proto se v průmětu oba konce kryjí.</p>
      <p>Aby konec bližšího trámu nezakryl začátek vzdálenějšího, je svislý trám nahoře seříznutý rovinou z = y − w.
      Ta obsahuje směr pohledu, takže z kouzelného místa je řez vidět jen jako čára.</p>
      <p>Iluze funguje jen v <b>ortografické</b> projekci a jen z jednoho směru. Stačí pootočit a trik se prozradí.</p>`,
    zdroje: ['L. S. Penrose, R. Penrose (1958), Impossible objects: a special type of visual illusion, Brit. J. Psychology 49.', 'O. Reutersvärd (1934).'],
  });

  /* ---------- nemožné schodiště ---------- */
  N.registruj({
    id: 'schodiste', nazev: 'Nemožné schodiště', skupina: 'Optické iluze', stitek: 'iluze',
    parametry: [
      { id: 's', nazev: 'Krátké rameno (schodů)', min: 1, max: 4, krok: 1, vychozi: 2, cele: true },
      { id: 'H', nazev: 'Rozdíl ramen H', min: 2, max: 6, krok: 1, vychozi: 4, cele: true },
      { id: 'D', nazev: 'Tloušťka stavby', min: 0.3, max: 3, krok: 0.1, vychozi: 1.4 },
    ],
    generuj(p) {
      // ramena: +x a +y mají s + H schodů, −x a −y jen s; každý schod je o h výš.
      // Za celý okruh se schodiště posune o (H, H) a vystoupá o N·h = H: posun (H, H, H) ∥ (1, 1, 1).
      const s0 = p.s, L = s0 + p.H, delky = [L, L, s0, s0], Nn = 2 * L + 2 * s0, h = p.H / Nn;
      const DIR = [[1, 0], [0, 1], [-1, 0], [0, -1]], body = [];
      let x = 0, y = 0;
      for (let r = 0; r < 4; r++) for (let i = 0; i < delky[r]; i++) { body.push([x, y]); x += DIR[r][0]; y += DIR[r][1]; }
      // spoj uprostřed ramene −y: při stoupání vede od pozorovatele, bližší (vyšší) konec tak zakrývá nižší správně
      const start = 2 * L + s0 + Math.floor(s0 / 2);
      const poz = [], tri = [], barvy = [], ton = tonPodleNormaly([0.82, 0.78, 0.7]), D = p.D;
      const c = [(L - 1) / 2, (L - 1) / 2, 0];
      for (let k = 0; k < Nn; k++) {
        const j = (start + k) % Nn, [bx, by] = body[j];
        // schody za koncem pole (j < start) leží o celý okruh výš a dál
        const kolo = j < start ? 1 : 0;
        const ox = bx + kolo * p.H - c[0], oy = by + kolo * p.H - c[1], z = (j + kolo * Nn) * h - p.H;
        sestisten(kvadr(ox - 0.5, ox + 0.5, oy - 0.5, oy + 0.5, z - D, z), poz, tri, barvy, ton);
      }
      return hotovo(poz, tri, barvy, { Nn, h, delky });
    },
    teorie: () => ({}),
    kamera: () => ({ az: PEN_AZ, el: PEN_EL, orto: true }),
    cisla(p, s) {
      const d = smer(PEN_AZ, PEN_EL);
      const r = N.v.len(N.v.sub(prumet([0, 0, 0], d), prumet([p.H, p.H, p.H], d)));
      return [
        ['Ramena (počet schodů)', s.delky.join(' + '), null, ''],
        ['Výška schodu h', N.fmt(s.h, 4), `H / N = ${p.H}/${s.Nn}`, ''],
        ['Posun po jednom okruhu', `(${p.H}, ${p.H}, ${p.H})`, '∥ (1, 1, 1)', '<span class="ok">✔</span>', 'Dlouhá ramena předběhnou krátká o H a schodiště vystoupá o N·h = H.'],
        ['Mezera v průmětu', N.fmt(r, 3), 0, '<span class="ok">✔</span>', 'Posun je rovnoběžný se směrem pohledu, proto se v průmětu ztratí.'],
      ];
    },
    legenda: 'odstín podle směru stěny',
    popis: `<p>Schodiště, po kterém se dá jít pořád nahoru a stejně se vrátit na začátek (L. S. a R. Penrose, 1958; M. C. Escher, <i>Ascending and Descending</i>, 1960).</p>
      <p><b>Skutečná konstrukce:</b> ve 3D je to šroubovice se čtyřmi rameny <b>různé délky</b>. Ramena ve směru +x a +y mají o H schodů víc než ramena zpět.
      Za jeden okruh se tak schodiště posune o (H, H) a zároveň vystoupá o H (výška schodu je H/N). Celkový posun (H, H, H) míří přesně podél
      izometrického směru pohledu, takže poslední schod se v průmětu napojí na první. Každý schod přitom v obraze viditelně stoupá.</p>
      <p>Spoj je uprostřed ramene, které při stoupání vede od pozorovatele. Bližší (vyšší) konec tak zakrývá vzdálenější, stejně jako u skutečných schodů.
      V obrazu proto nic nenapovídá, kde je trik. Prozradí ho až pootočení.</p>`,
    zdroje: ['L. S. Penrose, R. Penrose (1958), Impossible objects, Brit. J. Psychology 49.'],
  });

  /* ---------- Sugiharův dvojznačný válec ---------- */
  const TVARY2 = {
    ctverec: { nazev: 'čtverec', g: (x, r) => r * pow(Math.max(0, 1 - pow(abs(x / r), 10)), 1 / 10) },
    kosoctverec: { nazev: 'kosočtverec', g: (x, r) => Math.max(0, r - abs(x)) },
    kruh: { nazev: 'kruh (kontrola)', g: (x, r) => sqrt(Math.max(0, r * r - x * x)) },
  };
  N.registruj({
    id: 'sugihara', nazev: 'Dvojznačný válec (Sugihara)', skupina: 'Optické iluze', stitek: 'iluze',
    parametry: [
      { id: 'tvar', nazev: 'Druhý pohled ukáže', volby: Object.entries(TVARY2).map(([k, v]) => [k, v.nazev]), vychozi: 'ctverec' },
      { id: 'th', nazev: 'Sklon pohledu θ (°)', min: 20, max: 65, krok: 1, vychozi: 45 },
      { id: 'D', nazev: 'Výška stěny', min: 0.3, max: 2.5, krok: 0.05, vychozi: 1.2 },
    ],
    generuj(p) {
      const th = p.th * PI / 180, r = 1, g = TVARY2[p.tvar].g;
      const horni = a => {
        // α ∈ (0, π): zadní větev, α ∈ (π, 2π): přední; v1 = obraz v pohledu 1 (kruh), v2 = obraz v pohledu 2
        const x = r * cos(a), v1 = r * sin(a), v2 = -Math.sign(sin(a)) * g(x, r);
        return [x, (v1 - v2) / (2 * sin(th)), (v1 + v2) / (2 * cos(th))];
      };
      const f = (a, t) => { const q = horni(a); return [q[0], q[1], q[2] - t * p.D]; };
      const sit = N.plocha({ f, u: [0, 2 * PI], v: [0, 1], nu: 400, nv: 6, sev: { u: 'per' } });
      sit.horni = horni;
      const b = new Float32Array(sit.tri.length);
      for (let i = 0; i < b.length; i += 3) b.set([0.85, 0.83, 0.78], i);
      sit.barvy = b;
      return sit;
    },
    teorie: () => ({ chi: 0, orient: true, okraje: 2 }),
    kamera: (p, i) => ({ az: i ? PI : 0, el: p.th * PI / 180, orto: true }),
    kameraPocet: 2,
    kameraText: '🔄 Pohled 1 / pohled 2',
    cisla(p, s) {
      // změřit, jak moc se průmět horní hrany liší od cílových křivek
      const th = p.th * PI / 180, g = TVARY2[p.tvar].g;
      let e1 = 0, e2 = 0;
      for (let i = 0; i < 2000; i++) {
        const a = 2 * PI * (i + 0.5) / 2000, q = s.horni(a);
        const v1 = q[1] * sin(th) + q[2] * cos(th), v2 = -q[1] * sin(th) + q[2] * cos(th);
        e1 = Math.max(e1, abs(Math.hypot(q[0], v1) - 1));
        e2 = Math.max(e2, abs(abs(v2) - g(q[0], 1)));
      }
      return [
        ['Odchylka průmětu 1 od kružnice', N.fmt(e1, 2), 0, e1 < 1e-9 ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>', 'Horní hrana se promítne podél směru (0, −cos θ, sin θ) a změří se vzdálenost od jednotkové kružnice ve 2 000 bodech.'],
        [`Odchylka průmětu 2 od tvaru „${TVARY2[p.tvar].nazev}“`, N.fmt(e2, 2), 0, e2 < 1e-9 ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>', 'Totéž z opačné strany.'],
      ];
    },
    legenda: '',
    popis: `<p>Kokichi Sugihara (2016) sestrojil předměty, které vypadají jako kulatá trubka, a v zrcadle jako hranatá.</p>
      <p><b>Konstrukce:</b> stěny jsou svislé, celé kouzlo je v prostorové křivce horní hrany. Pozorovatel se dívá shora pod úhlem θ,
      jednou zepředu a jednou zezadu. V obraze 1 má být bod hrany na výšce v₁ (kružnice), v obraze 2 na výšce v₂ (čtverec). Pro každý bod platí
      v₁ = y sin θ + z cos θ a v₂ = −y sin θ + z cos θ. Odtud přesně <b>y = (v₁ − v₂)/(2 sin θ)</b> a <b>z = (v₁ + v₂)/(2 cos θ)</b>.</p>
      <p>Přední větev hrany se v obrazu 1 jeví jako dolní půlka kružnice a v obrazu 2 jako horní hrana čtverce, zadní větev obráceně.
      Tlačítko přepíná mezi pohledy. Mezi nimi je vidět, jak je hrana ve skutečnosti zprohýbaná. Čtverec je kvůli hladkosti nahrazen superelipsou |x|¹⁰ + |y|¹⁰ = 1.</p>`,
    zdroje: ['K. Sugihara (2016), Ambiguous cylinders: a new class of impossible objects, Computer Aided Drafting, Design and Manufacturing 25(3).'],
  });
})(NEM);
