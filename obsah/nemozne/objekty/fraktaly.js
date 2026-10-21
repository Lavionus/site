/* Laboratoř nemožných tvarů – fraktály: Mengerova houba, Sierpińského čtyřstěn,
   Kochova vločka (vysunutá), Mandelbulb (síť ve Web Workeru). */
(function (N) {
  'use strict';
  const { sqrt, PI, cos, sin, log } = Math;

  /* ---------- Mengerova houba ---------- */
  /** Buňka (x, y, z) mřížky 3ⁿ je plná, pokud v žádném řádu nemají dvě souřadnice číslici 1. */
  function mengerPlna(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      const a = x % 3 === 1, b = y % 3 === 1, c = z % 3 === 1;
      if (a + b + c >= 2) return false;
      x = (x / 3) | 0; y = (y / 3) | 0; z = (z / 3) | 0;
    }
    return true;
  }
  N.mengerPlna = mengerPlna;

  /** Povrch sjednocení plných voxelů: stěna mezi plnou a prázdnou buňkou. Vrcholy mřížky
      jsou sdílené, takže síť je rovnou sešitá. barva(osa, znaménko) → [r, g, b]. */
  function voxelovyPovrch(M, plna, velikost) {
    const W = M + 1, idx = new Map(), poz = [], tri = [], barvy = [];
    const vrchol = (x, y, z) => {
      const k = (x * W + y) * W + z;
      let i = idx.get(k);
      if (i === undefined) { i = poz.length / 3; idx.set(k, i); poz.push(x * velikost / M - velikost / 2, y * velikost / M - velikost / 2, z * velikost / M - velikost / 2); }
      return i;
    };
    const ton = [[0.86, 0.62, 0.3], [0.72, 0.5, 0.24], [0.95, 0.78, 0.45]];
    const ctverec = (a, b, c, d, osa) => { tri.push(a, b, c, a, c, d); barvy.push(...ton[osa], ...ton[osa]); };
    const plnaB = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < M && y < M && z < M && plna(x, y, z);
    for (let x = 0; x < M; x++) for (let y = 0; y < M; y++) for (let z = 0; z < M; z++) {
      if (!plna(x, y, z)) continue;
      // šest stěn; vinutí tak, aby normála mířila ven z plné buňky
      if (!plnaB(x - 1, y, z)) ctverec(vrchol(x, y, z), vrchol(x, y, z + 1), vrchol(x, y + 1, z + 1), vrchol(x, y + 1, z), 0);
      if (!plnaB(x + 1, y, z)) ctverec(vrchol(x + 1, y, z), vrchol(x + 1, y + 1, z), vrchol(x + 1, y + 1, z + 1), vrchol(x + 1, y, z + 1), 0);
      if (!plnaB(x, y - 1, z)) ctverec(vrchol(x, y, z), vrchol(x + 1, y, z), vrchol(x + 1, y, z + 1), vrchol(x, y, z + 1), 1);
      if (!plnaB(x, y + 1, z)) ctverec(vrchol(x, y + 1, z), vrchol(x, y + 1, z + 1), vrchol(x + 1, y + 1, z + 1), vrchol(x + 1, y + 1, z), 1);
      if (!plnaB(x, y, z - 1)) ctverec(vrchol(x, y, z), vrchol(x, y + 1, z), vrchol(x + 1, y + 1, z), vrchol(x + 1, y, z), 2);
      if (!plnaB(x, y, z + 1)) ctverec(vrchol(x, y, z + 1), vrchol(x + 1, y, z + 1), vrchol(x + 1, y + 1, z + 1), vrchol(x, y + 1, z + 1), 2);
    }
    const P = Float64Array.from(poz), svar = new Int32Array(P.length / 3);
    for (let i = 0; i < svar.length; i++) svar[i] = i;
    return { poz: P, tri: Uint32Array.from(tri), svar, barvy: Float32Array.from(barvy), ploche: true };
  }

  N.registruj({
    id: 'menger', nazev: 'Mengerova houba', skupina: 'Fraktály', stitek: 'iterace',
    parametry: [{ id: 'n', nazev: 'Úroveň n', min: 0, max: 4, krok: 1, vychozi: 3, cele: true }],
    generuj(p) {
      const M = Math.pow(3, p.n);
      const s = voxelovyPovrch(M, (x, y, z) => mengerPlna(x, y, z, p.n), 3);
      if (p.n >= 4) s.bezTopologie = true;
      return s;
    },
    teorie: p => {
      const L = 3, n = p.n;
      // χ plného tělesa: χ(M₀) = 1, χ(M_{k+1}) = 20 χ(M_k) − 24 χ(K_k), kde K_k je styčná stěna
      // (Sierpińského koberec úrovně k, χ = 1 − (8ᵏ − 1)/7); hrany a rohy se v inkluzi–exkluzi vyruší
      let chiM = 1;
      for (let k = 0; k < n; k++) chiM = 20 * chiM - 24 * (1 - (Math.pow(8, k) - 1) / 7);
      return { chi: 2 * chiM, rod: 1 - chiM, orient: true, okraje: 0, komponenty: 1, plocha: L * L * (2 * Math.pow(20 / 9, n) + 4 * Math.pow(8 / 9, n)), objem: L * L * L * Math.pow(20 / 27, n),
        tolPlocha: 1e-9, tolObjem: 1e-9,
        pozn: n >= 4 ? 'Úroveň 4 má přes 330 tisíc čtverců: topologický rozbor se kvůli rychlosti vynechává.' : '' };
    },
    cisla: p => {
      const n = p.n;
      return [
        ['Počet krychliček', Math.pow(20, n).toLocaleString('cs-CZ'), '20ⁿ', ''],
        ['Podíl objemu (20/27)ⁿ', N.fmt(Math.pow(20 / 27, n), 5), '→ 0', ''],
        ['Hausdorffova dimenze', N.fmt(log(20) / log(3), 6), 'log 20 / log 3', ''],
      ];
    },
    legenda: 'stěny obarvené podle směru',
    bezMalovani: false,
    popis: `<p>Z krychle se vyřízne prostřední krychlička a středy všech šesti stěn (zbude 20 z 27 dílů). Totéž se opakuje s každým zbylým dílem.
      Karl Menger ji popsal roku 1926.</p>
      <p>Na n-té úrovni: <b>objem</b> (20/27)ⁿ L³ → 0, ale <b>povrch</b> L²(2(20/9)ⁿ + 4(8/9)ⁿ) → ∞.
      Limitní houba má nulový objem, nekonečný povrch a Hausdorffovu dimenzi log 20 / log 3 ≈ 2,727.</p>
      <p>Panel vlastností měří plochu a objem přímo na síti a porovnává je se vzorci. Měla by se shodovat přesně, protože síť je tvořená čtverci.
      Měří také Eulerovu charakteristiku povrchu a rod (počet „děr“): 0, 5, 81, 1 409… Teorie: plné těleso Mₙ má
      χ(Mₙ₊₁) = 20 χ(Mₙ) − 24 χ(Kₙ), kde 24 je počet dvojic dílů slepených stěnou a Kₙ je ta stěna, Sierpińského koberec s (8ⁿ − 1)/7 dírami.
      Povrch tělesa má χ = 2 χ(Mₙ) a rod 1 − χ(Mₙ).</p>
      <p>Mengerova houba je <b>univerzální křivka</b>: obsahuje homeomorfní kopii každé jednorozměrné kompaktní metrické množiny.</p>`,
    zdroje: ['K. Menger (1926), Allgemeine Räume und Cartesische Räume.'],
  });

  /* ---------- Sierpińského čtyřstěn ---------- */
  N.registruj({
    id: 'sierpinski', nazev: 'Sierpińského čtyřstěn', skupina: 'Fraktály', stitek: 'iterace',
    parametry: [{ id: 'n', nazev: 'Úroveň n', min: 0, max: 7, krok: 1, vychozi: 5, cele: true }],
    generuj(p) {
      const s3 = 1 / sqrt(3), a = 2.6;
      const V0 = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => v.map(x => x * a * s3 * 0.75));
      const poz = [], tri = [], svar = [], barvy = [];
      const pal = [[0.85, 0.35, 0.3], [0.95, 0.75, 0.3], [0.35, 0.7, 0.45], [0.3, 0.55, 0.85]];
      const rek = (v, n) => {
        if (n === 0) {
          const b = poz.length / 3;
          for (const x of v) { poz.push(...x); svar.push(svar.length); }
          // čtyři stěny, vinutí ven (orientace se pro jistotu určí i v rozboru)
          for (const [i, j, k, s] of [[0, 1, 2, 3], [0, 3, 1, 2], [0, 2, 3, 1], [1, 3, 2, 0]]) { tri.push(b + i, b + j, b + k); barvy.push(...pal[s]); }
          return;
        }
        const m = (i, j) => v[i].map((x, k) => (x + v[j][k]) / 2);
        rek([v[0], m(0, 1), m(0, 2), m(0, 3)], n - 1);
        rek([m(0, 1), v[1], m(1, 2), m(1, 3)], n - 1);
        rek([m(0, 2), m(1, 2), v[2], m(2, 3)], n - 1);
        rek([m(0, 3), m(1, 3), m(2, 3), v[3]], n - 1);
      };
      rek(V0, p.n);
      const s = { poz: Float64Array.from(poz), tri: Uint32Array.from(tri), svar: Int32Array.from(svar), barvy: Float32Array.from(barvy), ploche: true };
      s.hrana = N.v.len(N.v.sub(V0[0], V0[1]));
      return s;
    },
    teorie: (p, s) => {
      const e = s.hrana, A0 = sqrt(3) * e * e, V0 = e * e * e / (6 * sqrt(2)), n = p.n;
      return { chi: 2 * Math.pow(4, n), orient: true, okraje: 0, komponenty: Math.pow(4, n), plocha: A0, objem: V0 / Math.pow(2, n), tolPlocha: 1e-9, tolObjem: 1e-9,
        pozn: 'Čtyřstěnečky se navzájem dotýkají jen ve vrcholech. Jako plochy jsou to oddělené sféry (χ = 2 každá), proto χ = 2·4ⁿ.' };
    },
    cisla: p => [
      ['Počet čtyřstěnů', Math.pow(4, p.n).toLocaleString('cs-CZ'), '4ⁿ', ''],
      ['Hausdorffova dimenze', 2, 'log 4 / log 2', ''],
    ],
    legenda: 'stěny obarvené podle směru',
    popis: `<p>Čtyřstěn se nahradí čtyřmi polovičními čtyřstěny v rozích. Prostřední oktaedr se vynechá. Krok se opakuje.</p>
      <p>Zvláštnost: <b>povrch se nemění</b> (4 · ¼ původního = celý), zatímco <b>objem klesá</b> jako (1/2)ⁿ → 0.
      Limitní útvar má nulový objem a konečnou plochu. Jeho Hausdorffova dimenze je log 4 / log 2 = 2, i když nejde o plochu v obvyklém smyslu.</p>
      <p>Pohled podél osy, která spojuje středy protilehlých hran, ukáže plný čtverec: průměty čtyřstěnečků do sebe přesně zapadnou.</p>`,
    zdroje: ['W. Sierpiński (1915), trojrozměrné zobecnění trojúhelníku.'],
    kamera: () => ({ az: 0, el: PI / 2 - 1e-3, orto: true }),
    kameraText: '⬛ Pohled podél osy',
    kameraJenTlacitkem: true,
  });

  /* ---------- Kochova vločka ve 3D ---------- */
  function kochBody(n, s) {
    let P = [0, 1, 2].map(i => { const a = PI / 2 + i * 2 * PI / 3; return [s / sqrt(3) * cos(a), s / sqrt(3) * sin(a)]; });
    // body jdou proti směru hodinových ručiček: vnějšek je vpravo od směru chůze
    for (let k = 0; k < n; k++) {
      const Q = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        const d = [(b[0] - a[0]) / 3, (b[1] - a[1]) / 3];
        const p1 = [a[0] + d[0], a[1] + d[1]], p2 = [a[0] + 2 * d[0], a[1] + 2 * d[1]];
        // vrchol výběžku: d otočené o −60°, tedy doprava = ven
        const c = cos(-PI / 3), sn = sin(-PI / 3);
        const v = [p1[0] + d[0] * c - d[1] * sn, p1[1] + d[0] * sn + d[1] * c];
        Q.push(a, p1, v, p2);
      }
      P = Q;
    }
    return P;
  }
  /** Triangulace jednoduchého mnohoúhelníku ořezáváním uší (body proti směru ručiček).
      Ucho se testuje proti všem zbývajícím vrcholům (zkratka jen přes nekonvexní vrcholy
      selhávala u téměř kolineárních bodů jemné vločky). */
  function usi(P) {
    const n = P.length, out = [];
    const prev = new Int32Array(n), next = new Int32Array(n);
    for (let i = 0; i < n; i++) { prev[i] = (i + n - 1) % n; next[i] = (i + 1) % n; }
    const cr = (a, b, c) => (P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0]);
    let rozsah = 0;
    for (const q of P) rozsah = Math.max(rozsah, Math.abs(q[0]), Math.abs(q[1]));
    const eps = 1e-12 * rozsah * rozsah;
    const jeUcho = i => {
      const a = prev[i], c = next[i];
      if (cr(a, i, c) <= eps) return false;
      const x0 = Math.min(P[a][0], P[i][0], P[c][0]), x1 = Math.max(P[a][0], P[i][0], P[c][0]);
      const y0 = Math.min(P[a][1], P[i][1], P[c][1]), y1 = Math.max(P[a][1], P[i][1], P[c][1]);
      for (let j = next[c]; j !== a; j = next[j]) {
        const q = P[j];
        if (q[0] < x0 || q[0] > x1 || q[1] < y0 || q[1] > y1) continue;
        // tolerance: vrchol na úhlopříčce (kolineární body vločky) se počítá jako uvnitř
        if (cr(a, i, j) >= -eps && cr(i, c, j) >= -eps && cr(c, a, j) >= -eps) return false;
      }
      return true;
    };
    let zbyva = n, i = 0, bez = 0;
    while (zbyva > 3 && bez <= zbyva) {
      if (jeUcho(i)) {
        const a = prev[i], c = next[i];
        out.push(a, i, c);
        next[a] = c; prev[c] = a; zbyva--;
        i = a; bez = 0;
      } else { i = next[i]; bez++; }
    }
    if (zbyva === 3) out.push(prev[i], i, next[i]);
    return out;
  }
  N.usi = usi;
  N.kochBody = kochBody;
  N.registruj({
    id: 'koch', nazev: 'Kochova vločka (3D vysunutí)', skupina: 'Fraktály', stitek: 'iterace',
    parametry: [
      { id: 'n', nazev: 'Úroveň n', min: 0, max: 5, krok: 1, vychozi: 4, cele: true },
      { id: 'h', nazev: 'Výška', min: 0.1, max: 4, krok: 0.1, vychozi: 1 },
      { id: 'tw', nazev: 'Zkroucení (°)', min: 0, max: 180, krok: 5, vychozi: 0 },
    ],
    generuj(p) {
      const s = 3, B = kochBody(p.n, s);                  // proti směru ručiček
      const m = B.length, vrstvy = Math.max(1, Math.round(p.tw / 4)), poz = [];
      for (let k = 0; k <= vrstvy; k++) {
        const z = p.h * k / vrstvy - p.h / 2, a = p.tw * PI / 180 * k / vrstvy, c = cos(a), sn = sin(a);
        for (const q of B) poz.push(q[0] * c - q[1] * sn, q[0] * sn + q[1] * c, z);
      }
      const tri = [];
      for (let k = 0; k < vrstvy; k++) for (let i = 0; i < m; i++) {
        const a = k * m + i, b = k * m + (i + 1) % m, c = (k + 1) * m + (i + 1) % m, d = (k + 1) * m + i;
        tri.push(a, b, c, a, c, d);
      }
      const ucha = usi(B);
      for (let i = 0; i < ucha.length; i += 3) {
        tri.push(ucha[i], ucha[i + 2], ucha[i + 1]);                                     // dno (normála dolů)
        tri.push(vrstvy * m + ucha[i], vrstvy * m + ucha[i + 1], vrstvy * m + ucha[i + 2]); // víko
      }
      const P = Float64Array.from(poz), svar = new Int32Array(P.length / 3);
      for (let i = 0; i < svar.length; i++) svar[i] = i;
      return { poz: P, tri: Uint32Array.from(tri), svar, ploche: true, strana: s, body: m };
    },
    teorie: (p, sit) => {
      const s = sit.strana, A0 = sqrt(3) / 4 * s * s, An = A0 * (8 / 5 - 3 / 5 * Math.pow(4 / 9, p.n)), O = 3 * s * Math.pow(4 / 3, p.n);
      return { chi: 2, orient: true, okraje: 0, rod: 0, objem: An * p.h, tolObjem: p.tw ? 0.005 : 1e-9,
        pozn: p.tw ? 'Zkroucený plášť je přímková plocha. Síť ho nahrazuje rovnými trojúhelníky, proto se změřený objem nepatrně liší od přesného A·h.' : '', plocha: p.tw === 0 ? 2 * An + O * p.h : null, tolPlocha: 1e-9, pruniky: false };
    },
    cisla(p, sit) {
      const s = sit.strana, A0 = sqrt(3) / 4 * s * s, n = p.n;
      return [
        ['Počet vrcholů obrysu', sit.body.toLocaleString('cs-CZ'), '3 · 4ⁿ', ''],
        ['Obvod 3s(4/3)ⁿ', N.fmt(3 * s * Math.pow(4 / 3, n), 6), '→ ∞', ''],
        ['Obsah podstavy', N.fmt(A0 * (8 / 5 - 3 / 5 * Math.pow(4 / 9, n)), 6), `→ 8/5 · A₀ = ${N.fmt(1.6 * A0, 6)}`, ''],
        ['Hausdorffova dimenze obrysu', N.fmt(log(4) / log(3), 6), 'log 4 / log 3', ''],
      ];
    },
    popis: `<p>Kochova křivka: každá úsečka se rozdělí na třetiny a nad prostřední se postaví rovnostranný výběžek. Tři takové křivky tvoří vločku (H. von Koch, 1904).</p>
      <p>Obvod roste jako 3s(4/3)ⁿ → ∞, ale obsah zůstává konečný: A = A₀(8/5 − 3/5 · (4/9)ⁿ) → 8/5 A₀.
      Vysunutím vznikne hranol s konečným objemem a pláštěm, jehož plocha roste nade všechny meze.</p>
      <p><b>Zkroucení</b> otáčí průřez s výškou. Objem se nezmění (Cavalieriho princip: všechny řezy mají stejný obsah).
      Panel to potvrdí měřením na síti. Podstava se trianguluje ořezáváním uší.</p>`,
    zdroje: ['H. von Koch (1904), Sur une courbe continue sans tangente…'],
  });

  /* ---------- Mandelbulb ---------- */
  let worker = null, cekajici = new Map(), pocitadlo = 0;
  function spocitej(zadani) {
    if (!worker) {
      worker = new Worker('nemozne/worker.js');
      worker.onmessage = e => { const f = cekajici.get(e.data.id); cekajici.delete(e.data.id); if (f) f(e.data); };
    }
    const id = ++pocitadlo;
    return new Promise(res => { cekajici.set(id, res); worker.postMessage(Object.assign({ id }, zadani)); });
  }
  N.registruj({
    id: 'mandelbulb', nazev: 'Mandelbulb', skupina: 'Fraktály', stitek: 'numericka',
    parametry: [
      { id: 'mocnina', nazev: 'Mocnina n', min: 2, max: 12, krok: 1, vychozi: 8, cele: true },
      { id: 'iter', nazev: 'Iterace', min: 3, max: 20, krok: 1, vychozi: 10, cele: true },
    ],
    pomaly: true,
    generuj(p, k) {
      const res = { nizka: 96, stredni: 144, vysoka: 208 }[k] || 144;
      return spocitej({ typ: 'mandelbulb', mocnina: p.mocnina, iter: p.iter, res }).then(d => ({
        poz: d.poz, tri: d.tri, svar: d.svar, nor: d.nor, bezTopologie: true, res, prah: d.prah, cas: d.cas,
      }));
    },
    teorie: () => ({}),
    stitekPozn: (p, s) => s && s.res ? `Síť je izoplocha odhadu vzdálenosti DE = ${N.fmt(s.prah, 2)} (polovina buňky) na mřížce ${s.res}³,
      po ${p.iter} iteracích. Je to obálka množiny, ne množina sama: skutečný fraktál má nekonečně mnoho detailů menších než buňka mřížky.
      Výpočet trval ${N.fmt(s.cas / 1000, 2)} s ve Web Workeru.` : '',
    cisla: (p, s) => [['Mřížka', `${s.res}³ = ${(s.res ** 3).toLocaleString('cs-CZ')} bodů`, null, '']],
    popis: `<p>Trojrozměrná obdoba Mandelbrotovy množiny (D. White a P. Nylander, 2009). Bod c patří do množiny, pokud posloupnost
      v ↦ vⁿ + c, v₀ = 0, zůstává omezená. Mocnina v ve 3D se definuje ve sférických souřadnicích:
      r ↦ rⁿ, θ ↦ nθ, φ ↦ nφ.</p>
      <p>Na rozdíl od Mandelbrotovy množiny v rovině to <b>není</b> „pravý“ 3D analog: neexistuje trojrozměrná algebra s násobením, které by se chovalo jako komplexní čísla
      (Frobeniova věta). White–Nylanderův vzorec je jedna z mnoha možných voleb.</p>
      <p>Síť je izoplocha <b>odhadu vzdálenosti</b> DE = ½ · ln r · r / |dr| spočítaná na pravidelné mřížce metodou surface nets.
      Topologický rozbor se nedělá: na hranici rozlišení vznikají drobné artefakty, takže χ by nic nevypovídala.</p>`,
    zdroje: ['D. White, P. Nylander (2009), skytopia.com/project/fractal/mandelbulb.html.', 'J. C. Hart a kol. (1989), ray tracing deterministic 3-D fractals (odhad vzdálenosti).',
      'S. Gibson (1998), Constrained elastic surface nets.'],
  });
})(NEM);
