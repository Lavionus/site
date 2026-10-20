/* ============================================================
   Dřevěné hračky – puzzle (dělení na dílky) a zvířátka pro lupenkovou pilu (bez DOM)
   Hrany dílků: 'jigsaw' (zámky), 'vlna' (slepé dílky – bez zámků, pro nejmenší), 'rovne'.
   Sousední dílky sdílejí tutéž lomenou čáru hrany → dílky se nepřekrývají a pokrývají celou plochu.
   ============================================================ */
(function (koren) {
  'use strict';
  const DH = koren.DH || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const { cz, r1 } = DH;

  /** doporučení podle věku: max. počet dílků a nejmenší šířka dílku (mm) – typické, editovatelné */
  DH.PUZZLE_VEK = [
    { vek: 1, max: 3, min: 80, hrana: 'rovne', tl: 18, pozn: 'vkládačka s úchyty, 1–3 tvary' },
    { vek: 2, max: 6, min: 60, hrana: 'vlna', tl: 18, pozn: 'slepé dílky, velké, silné' },
    { vek: 3, max: 12, min: 48, hrana: 'vlna', tl: 15, pozn: 'slepé nebo velké zámky' },
    { vek: 4, max: 24, min: 40, hrana: 'jigsaw', tl: 12, pozn: 'zámky, desítky dílků' },
    { vek: 5, max: 36, min: 34, hrana: 'jigsaw', tl: 9, pozn: '' },
    { vek: 6, max: 60, min: 28, hrana: 'jigsaw', tl: 6, pozn: '' },
    { vek: 8, max: 150, min: 20, hrana: 'jigsaw', tl: 4, pozn: 'překližka 4 mm, laser' },
  ];
  DH.puzzleVek = (vek) => DH.PUZZLE_VEK.reduce((m, q) => (vek >= q.vek ? q : m), DH.PUZZLE_VEK[0]);

  /**
   * Lomená čára hrany z A do B. s = velikost zámku (mm, ~ menší rozměr buňky), smer ±1 (strana výstupku),
   * rnd = generátor náhody (posun a velikost zámku). Vrací body včetně A i B.
   */
  DH.hranaPuzzle = (A, B, typ, s, smer, rnd) => {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L, nx = -uy * smer, ny = ux * smer;
    const P = (a, v) => [A[0] + ux * a + nx * v, A[1] + uy * a + ny * v];
    if (typ === 'rovne' || L < 1) return [A.slice(), B.slice()];
    const out = [];
    if (typ === 'vlna') {
      const amp = 0.07 * s * (0.8 + 0.4 * rnd()), n = Math.max(12, Math.round(L / 3)), f = rnd() < 0.5 ? 1 : 2;
      for (let i = 0; i <= n; i++) { const t = i / n; out.push(P(L * t, amp * Math.sin(Math.PI * f * t) * (f === 2 ? 1 : 1.4))); }
      return out;
    }
    // jigsaw: krk + kulatý výstupek (zámek) uprostřed hrany
    const c = L / 2 + (rnd() - 0.5) * 0.12 * s, r = 0.105 * s * (0.9 + 0.2 * rnd()), cy = 0.17 * s;
    const aL = 235 * Math.PI / 180, aR = 305 * Math.PI / 180;
    const nL = [c + r * Math.cos(aL), cy + r * Math.sin(aL)], nR = [c + r * Math.cos(aR), cy + r * Math.sin(aR)];
    const z0 = c - 0.15 * s, z1 = c + 0.15 * s;
    out.push(P(0, 0), P(z0, 0));
    // náběh do krku (kvadratická Bézierova křivka)
    for (let i = 1; i <= 6; i++) { const t = i / 6, u = 1 - t; const k = [c - 0.05 * s, 0]; out.push(P(u * u * z0 + 2 * u * t * k[0] + t * t * nL[0], 2 * u * t * k[1] + t * t * nL[1])); }
    // oblouk přes vrchol: od 235° přes 180°, 90°, 0° do −55°
    const n = 26;
    for (let i = 1; i < n; i++) { const a = aL - (i / n) * (aL - (aR - 2 * Math.PI)); out.push(P(c + r * Math.cos(a), cy + r * Math.sin(a))); }
    out.push(P(nR[0], nR[1]));
    for (let i = 1; i <= 6; i++) { const t = i / 6, u = 1 - t; const k = [c + 0.05 * s, 0]; out.push(P(u * u * nR[0] + 2 * u * t * k[0] + t * t * z1, u * u * nR[1] + 2 * u * t * k[1])); }
    out.push(P(L, 0));
    return out;
  };

  /**
   * Mřížka dílků W × H (cols × rows). → {dilky:[{r, c, b}], hrany:[lomené čáry vnitřních řezů], obrys}
   */
  DH.mrizkaPuzzle = (W, H, cols, rows, typ, seed) => {
    const rnd = DH.nahoda(seed || 7), cw = W / cols, ch = H / rows, s = Math.min(cw, ch);
    const X = [], Y = [];
    for (let c = 0; c <= cols; c++) X.push(c * cw);
    for (let r = 0; r <= rows; r++) Y.push(r * ch);
    const hH = {}, hV = {}, hrany = [];
    for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) {
      const A = [X[c], Y[r]], B = [X[c + 1], Y[r]];
      hH[r + ',' + c] = r === 0 || r === rows ? [A, B] : DH.hranaPuzzle(A, B, typ, s, rnd() < 0.5 ? 1 : -1, rnd);
      if (r > 0 && r < rows) hrany.push(hH[r + ',' + c]);
    }
    for (let c = 0; c <= cols; c++) for (let r = 0; r < rows; r++) {
      const A = [X[c], Y[r]], B = [X[c], Y[r + 1]];
      hV[r + ',' + c] = c === 0 || c === cols ? [A, B] : DH.hranaPuzzle(A, B, typ, s, rnd() < 0.5 ? 1 : -1, rnd);
      if (c > 0 && c < cols) hrany.push(hV[r + ',' + c]);
    }
    const dilky = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const b = [];
      const pridej = (pts) => { for (const p of pts) { const q = b[b.length - 1]; if (!q || Math.abs(q[0] - p[0]) > 1e-9 || Math.abs(q[1] - p[1]) > 1e-9) b.push(p); } };
      pridej(hH[r + ',' + c]);
      pridej(hV[r + ',' + (c + 1)]);
      pridej(hH[(r + 1) + ',' + c].slice().reverse());
      pridej(hV[r + ',' + c].slice().reverse());
      if (Math.abs(b[0][0] - b[b.length - 1][0]) < 1e-9 && Math.abs(b[0][1] - b[b.length - 1][1]) < 1e-9) b.pop();
      dilky.push({ r, c, b: DH.plocha(b) < 0 ? b.reverse() : b });
    }
    return { dilky, hrany, obrys: DH.obdelnik(0, 0, W, H), cw, ch };
  };

  /** počet sloupců a řádků pro cílový počet dílků s buňkami co nejbližšími čtverci */
  DH.rozdeleni = (W, H, n) => {
    let nej = null;
    for (let c = 1; c <= 40; c++) for (let r = 1; r <= 40; r++) {
      const pomer = (W / c) / (H / r), chyba = Math.abs(Math.log(pomer)) * 2 + Math.abs(c * r - n) / n;
      if (!nej || chyba < nej.chyba) nej = { c, r, chyba };
    }
    return nej;
  };

  /**
   * Dělení libovolného obrysu (zvířátko) na ~n dílků: mřížka přes obálku ∩ obrys, malé zbytky se
   * připojí k sousednímu dílku, se kterým sdílí nejdelší hranici.
   * → {dilky:[{b (vnější), diry:[]}], hrany (řezy uvnitř obrysu), obrys}
   */
  DH.delObrys = (obrys, n, typ, seed, minPlocha) => {
    const bb = DH.bbox(obrys), A = Math.abs(DH.plochaPoli(obrys));
    const cell = Math.sqrt(A / Math.max(1, n));
    const cols = Math.max(1, Math.round(bb.w / cell)), rows = Math.max(1, Math.round(bb.h / cell));
    const m = DH.mrizkaPuzzle(bb.w + 0.02, bb.h + 0.02, cols, rows, typ, seed);
    let kusy = [];
    for (const d of m.dilky) {
      const b = DH.posun(d.b, bb.x0 - 0.01, bb.y0 - 0.01), pr = DH.prunik([b], obrys);
      for (const g of DH.skupiny(pr)) kusy.push({ polys: [g.b].concat(g.diry), plocha: DH.plocha(g.b) + g.diry.reduce((s, q) => s + DH.plocha(q), 0) });
    }
    const limit = minPlocha != null ? minPlocha : 0.4 * A / Math.max(1, n);
    for (let it = 0; it < 200; it++) {
      kusy.sort((a, b) => a.plocha - b.plocha);
      const f = kusy[0];
      if (!f || f.plocha >= limit || kusy.length < 2) break;
      const ofs = DH.offset(f.polys, 0.6);
      let nej = -1, np = 0;
      for (let i = 1; i < kusy.length; i++) { const q = Math.abs(DH.plochaPoli(DH.prunik(ofs, kusy[i].polys))); if (q > np) { np = q; nej = i; } }
      if (nej < 0) break;
      const u = DH.sjednot(f.polys.concat(kusy[nej].polys));
      const s = DH.skupiny(u);
      if (s.length !== 1) break;
      kusy[nej] = { polys: [s[0].b].concat(s[0].diry), plocha: DH.plochaPoli(u) };
      kusy.splice(0, 1);
    }
    const dilky = kusy.map((k) => { const s = DH.skupiny(k.polys)[0]; return { b: s.b, diry: s.diry }; });
    // řezy: hrany mřížky jen tam, kde oddělují dva různé dílky
    const hrany = [];
    const ktery = (p) => dilky.findIndex((d) => DH.vPolygonu(p, d.b) && !d.diry.some((h) => DH.vPolygonu(p, h)));
    for (const h0 of m.hrany) {
      const h = DH.posun(h0, bb.x0 - 0.01, bb.y0 - 0.01), husta = [];
      for (let i = 1; i < h.length; i++) { const [a, b] = [h[i - 1], h[i]], l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(l / 0.5)); for (let j = i === 1 ? 0 : 1; j <= k; j++) husta.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); }
      let run = [];
      for (let i = 0; i < husta.length; i++) {
        const p = husta[i], q = husta[Math.min(husta.length - 1, i + 1)], o = husta[Math.max(0, i - 1)];
        const tx = q[0] - o[0], ty = q[1] - o[1], l = Math.hypot(tx, ty) || 1, nx = -ty / l * 0.3, ny = tx / l * 0.3;
        const a = ktery([p[0] + nx, p[1] + ny]), b = ktery([p[0] - nx, p[1] - ny]);
        if (a >= 0 && b >= 0 && a !== b) run.push(p); else { if (run.length > 1) hrany.push(run); run = []; }
      }
      if (run.length > 1) hrany.push(run);
    }
    return { dilky, hrany, obrys, cols, rows };
  };

  /**
   * Kontrola dílků: pokrytí obrysu a překryvy.
   * → {plochaObrysu, plochaDilku, rozdil (poměr), prekryv (mm² součet průniků dvojic), minSirka, nejmensi}
   */
  DH.kontrolaDilku = (dilky, obrys) => {
    const pa = Math.abs(DH.plochaPoli(obrys));
    const pd = dilky.reduce((s, d) => s + Math.abs(DH.plocha(d.b)) - (d.diry || []).reduce((q, h) => q + Math.abs(DH.plocha(h)), 0), 0);
    let prekryv = 0;
    const bbs = dilky.map((d) => DH.bbox([d.b]));
    for (let i = 0; i < dilky.length; i++) for (let j = i + 1; j < dilky.length; j++) {
      const a = bbs[i], b = bbs[j];
      if (a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0) continue;
      prekryv += Math.abs(DH.plochaPoli(DH.prunik([dilky[i].b].concat(dilky[i].diry || []), [dilky[j].b].concat(dilky[j].diry || []))));
    }
    // sjednocení dílků = obrys
    const u = DH.sjednot(dilky.flatMap((d) => [d.b].concat(d.diry || [])));
    const zbytek = Math.abs(DH.plochaPoli(DH.rozdil(obrys, u))) + Math.abs(DH.plochaPoli(DH.rozdil(u, obrys)));
    let minS = Infinity, nej = -1;
    dilky.forEach((d, i) => { const s = DH.sirky(d.b).min; if (s < minS) { minS = s; nej = i; } });
    return { plochaObrysu: pa, plochaDilku: pd, rozdil: Math.abs(pd - pa) / (pa || 1), prekryv, zbytek, minSirka: minS, nejmensi: nej };
  };

  /** posoudí dílky podle věku (malé díly, nejmenší šířka, počet) → položky bezpečnosti */
  function posudDilky(N, dilky, tl, vek, nazev) {
    const V = DH.puzzleVek(vek);
    let malych = 0, uzkych = 0;
    for (const d of dilky) {
      const t = DH.malyDil({ typ: 'deska', b: d.b, tl }); d.malyTest = t; if (t.maly) malych++;
      if (DH.sirky(d.b).min < V.min) uzkych++;
    }
    if (malych) N.bezpecnost.push({ u: vek < 3 ? 'chyba' : 'pozor', t: `${malych} ${malych === 1 ? 'dílek projde' : 'dílků projde'} válcem pro malé díly (Ø 31,7 mm, EN 71-1)${vek < 3 ? ' – pro děti do 3 let nepřípustné, zvětšete dílky nebo tloušťku' : ' – označit „Nevhodné pro děti do 3 let“'}.` });
    else N.bezpecnost.push({ u: 'ok', t: `Žádný z ${dilky.length} dílků neprojde válcem pro malé díly (Ø 31,7 mm) při tloušťce ${cz(tl)} mm.` });
    if (uzkych) N.bezpecnost.push({ u: 'pozor', t: `${uzkych} ${uzkych === 1 ? 'dílek je užší' : 'dílků je užších'} než doporučených ${cz(V.min)} mm pro věk ${cz(vek, 0)}+ (typické doporučení).` });
    if (dilky.length > V.max) N.bezpecnost.push({ u: 'pozor', t: `${dilky.length} dílků je víc, než se typicky doporučuje pro věk ${cz(vek, 0)}+ (do ${V.max}).` });
    if (tl < V.tl && vek < 4) N.bezpecnost.push({ u: 'pozor', t: `Tloušťka ${cz(tl)} mm – pro nejmenší je lepší ≥ ${V.tl} mm (dílek se lépe uchopí, neláme se, hůř se strká do pusy).` });
  }

  /** dílky → tělesa (xy, tloušťka nahoru), rozložení pro animaci skládání */
  function telesaDilku(N, dilky, tl, z0, barvy) {
    const bb = DH.bbox(dilky.map((d) => d.b)), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    dilky.forEach((d, i) => {
      const c = DH.bbox([d.b]), mx = (c.x0 + c.x1) / 2 - cx, my = (c.y0 + c.y1) / 2 - cy, l = Math.hypot(mx, my) || 1;
      N.telesa.push({ typ: 'extr', rovina: 'xy', b: d.b, diry: d.diry || [], tl, x: 0, y: 0, z: z0 || 0, barva: (barvy || ['#e6c896', '#d9b98a', '#c99a62', '#efd9a8', '#b98552'])[i % (barvy ? barvy.length : 5)], sklad: i, rozlet: [mx / l * 40, my / l * 40, 30 + (i % 3) * 12] });
    });
  }

  /* ============================================================
     3) ZVÍŘÁTKA – figurka, puzzle ze zvířátka, vkládačka
     ============================================================ */
  const VOLBY_TVARU = Object.keys(DH.TVARY).map((k) => [k, DH.TVARY[k].nazev]).concat([['import', 'vlastní (import SVG)']]);
  DH.GEN.zviratka = {
    nazev: 'Zvířátka a vkládačky', ikona: '🐘', typ: 'hracka',
    popis: 'Šablony 1:1 pro lupenkovou pilu: stojící figurka, zvířátko rozdělené na dílky, vkládačka s úchyty. Vlastní tvary nebo import SVG.',
    pole: [
      { sk: 'Tvar' },
      { k: 'tvar', n: 'Tvar', t: 'v', m: VOLBY_TVARU },
      { k: 'rezim', n: 'Výrobek', t: 'v', m: [['figurka', 'stojící figurka'], ['puzzle', 'zvířátko z dílků'], ['vkladacka', 'vkládačka (rám s výřezy + podložka)']] },
      { k: 'sirka', n: 'Šířka tvaru (mm)', t: 'n', min: 40, max: 600, krok: 1 },
      { k: 'tl', n: 'Tloušťka dřeva (mm)', t: 'n', min: 3, max: 60, krok: 0.5 },
      { k: 'zaobleniObrysu', n: 'Zaoblení koutů obrysu (mm)', t: 'n', min: 0, max: 15, krok: 0.5 },
      { sk: 'Dílky' },
      { k: 'dilku', n: 'Počet dílků (přibližně)', t: 'n', min: 2, max: 40, krok: 1, ukaz: (p) => p.rezim === 'puzzle' },
      { k: 'hrana', n: 'Řez mezi dílky', t: 'v', m: [['vlna', 'vlnka (slepé dílky)'], ['jigsaw', 'zámky (jigsaw)'], ['rovne', 'rovné řezy']], ukaz: (p) => p.rezim === 'puzzle' },
      { k: 'seed', n: 'Varianta řezu (číslo)', t: 'n', min: 1, max: 9999, krok: 1, ukaz: (p) => p.rezim === 'puzzle' },
      { sk: 'Vkládačka' },
      { k: 'sada', n: 'Tvary ve vkládačce', t: 'v', m: [['jeden', 'jen zvolený tvar'], ['zakladni', 'kruh, čtverec, trojúhelník, hvězda'], ['zvirata', 'slon, kočka, ryba, želva']], ukaz: (p) => p.rezim === 'vkladacka' },
      { k: 'ram', n: 'Okraj rámu (mm)', t: 'n', min: 10, max: 80, krok: 1, ukaz: (p) => p.rezim === 'vkladacka' },
      { k: 'podlozkaTl', n: 'Tloušťka podložky (mm)', t: 'n', min: 0, max: 12, krok: 0.5, ukaz: (p) => p.rezim === 'vkladacka' },
      { k: 'vule', n: 'Vůle dílku v rámu (mm, při řezu laserem)', t: 'n', min: 0, max: 2, krok: 0.05, ukaz: (p) => p.rezim === 'vkladacka' },
      { k: 'uchyt', n: 'Úchyt (kolíček) – Ø (0 = bez)', t: 'n', min: 0, max: 30, krok: 0.5, ukaz: (p) => p.rezim === 'vkladacka' },
    ],
    vychozi: { tvar: 'slon', rezim: 'figurka', sirka: 160, tl: 20, zaobleniObrysu: 3, dilku: 5, hrana: 'vlna', seed: 11, sada: 'zakladni', ram: 25, podlozkaTl: 4, vule: 0.3, uchyt: 10 },
    predvolby: [
      { id: 'slon', nazev: 'Stojící slon 160 mm', p: {} },
      { id: 'dino', nazev: 'Dinosaurus z 6 dílků', p: { tvar: 'dino', rezim: 'puzzle', dilku: 6, sirka: 220, tl: 18 } },
      { id: 'vkl', nazev: 'Vkládačka – základní tvary (od 1 roku)', p: { rezim: 'vkladacka', sada: 'zakladni', sirka: 80, tl: 15, uchyt: 10 } },
      { id: 'zvirata', nazev: 'Vkládačka – 4 zvířátka', p: { rezim: 'vkladacka', sada: 'zvirata', sirka: 110, tl: 12 } },
    ],
    vypocet(p, spol, nast, data) {
      const N = { typ: 'hracka', dily: [], telesa: [], kusovnik: [], bezpecnost: [], info: [], varovani: [], koty: [], tabulky: [], stl: [], male: [] };
      const mat = (DH.MATERIALY[spol.material] || {}).nazev, vek = +spol.vek;
      const tv = DH.tvarMm(p.tvar, { sirka: p.sirka, zaobleni: p.zaobleniObrysu }, data);
      if (tv.prazdny) { N.varovani.push('Načtěte SVG s tvarem (tlačítko Import SVG) nebo zvolte vestavěný tvar.'); return N; }
      const gravir = (det) => det.map((d) => ({ b: d.b, typ: 'gravir', otevrena: d.otevrena }));
      if (p.rezim === 'figurka') {
        const ob = tv.obrys.map((b) => ({ b, typ: DH.plocha(b) > 0 ? 'rez' : 'otvor' }));
        N.dily.push({ id: 'F', nazev: tv.nazev, ks: 1, tl: p.tl, mat: spol.material, obrysy: ob.concat(gravir(tv.detaily)), kruhy: [], texty: [], male: { typ: 'deska', b: tv.obrys[0], tl: p.tl }, volny: true, poznamka: 'detaily (oko, ucho) vypálit / vyrýt, ne vrtat' });
        N.kusovnik.push(DH.polozka(1, 'figurka – ' + tv.nazev, 1, DH.rozmerTxt(tv.w, tv.h, p.tl), mat, 'lupenková pila, pilka č. 5–7; hrany zaoblit'));
        N.telesa.push({ typ: 'extr', rovina: 'xz', b: tv.obrys[0], diry: tv.obrys.slice(1).filter((b) => DH.plocha(b) < 0), tl: p.tl, x: 0, y: 0, z: 0, barva: '#d9b98a', sklad: 0, detaily: tv.detaily });
        // stabilita figurky: chodidla = průnik obrysu s pásem y < 1 mm
        const pas = DH.prunik(tv.obrys, [DH.obdelnik(-1, -1, tv.w + 1, 1)]);
        if (tv.stoji && pas.length) {
          const bbP = DH.bbox(pas), op = [[bbP.x0, 0], [bbP.x1, 0], [bbP.x1, p.tl], [bbP.x0, p.tl]];
          const hm = [{ m: 1, x: DH.stredTelesa(N.telesa[0])[0], y: p.tl / 2, z: DH.stredTelesa(N.telesa[0])[2] }];
          const st = DH.stabilita(hm, op);
          N.stabilita = st;
          const bocni = Math.atan2(p.tl / 2, st.cog.z) * 180 / Math.PI;
          N.info.push(`Figurka stojí na ${cz(bbP.w)} mm (od ${cz(bbP.x0)} do ${cz(bbP.x1)}), těžiště ${cz(st.cog.x)} mm od kraje ve výšce ${cz(st.cog.z)} mm. Převrhne se po náklonu ${cz(Math.min(Math.abs(st.uhel), bocni), 0)}° (do boku ${cz(bocni, 0)}°).`);
          if (!st.vPolygonu) N.varovani.push('Těžiště figurky leží mimo chodidla – nebude stát. Přidejte podstavec nebo upravte tvar.');
          if (bocni < 12) N.varovani.push(`Figurka je na svou výšku tenká (do boku spadne už při ${cz(bocni, 0)}°) – zvětšete tloušťku nebo přidejte podstavec.`);
        } else if (!tv.stoji) N.info.push('Tvar nemá rovná chodidla – použijte jako ležící hračku, nebo do spodku vyřízněte drážku do podstavce.');
      } else if (p.rezim === 'puzzle') {
        const D = DH.delObrys(tv.obrys, p.dilku, p.hrana, p.seed);
        const k = DH.kontrolaDilku(D.dilky, tv.obrys);
        N.kontrola = k;
        const ob = tv.obrys.map((b) => ({ b, typ: 'rez' })).concat(D.hrany.map((b) => ({ b, typ: 'rez', otevrena: true }))).concat(gravir(tv.detaily));
        N.dily.push({ id: 'Z', nazev: `${tv.nazev} – ${D.dilky.length} dílků`, ks: 1, tl: p.tl, mat: spol.material, obrysy: ob, kruhy: [], texty: [], poznamka: 'nejdřív vyříznout obrys, pak vnitřní řezy' });
        D.dilky.forEach((d, i) => { N.male.push({ nazev: `dílek ${i + 1}`, tvar: { typ: 'deska', b: d.b, tl: p.tl }, volny: true }); });
        N.dilky = D.dilky;
        posudDilky(N, D.dilky, p.tl, vek);
        N.male = [];   // posouzeno výše
        telesaDilku(N, D.dilky, p.tl, 0);
        N.kusovnik.push(DH.polozka(1, `${tv.nazev} z dílků`, D.dilky.length, DH.rozmerTxt(tv.w, tv.h, p.tl), mat, `řez ${p.hrana === 'jigsaw' ? 'se zámky' : p.hrana === 'vlna' ? 'vlnkou' : 'rovný'}, kontrola: pokrytí ${cz(100 * (1 - k.rozdil), 2)} %, překryv ${cz(k.prekryv, 2)} mm²`));
        N.info.push(`${D.dilky.length} dílků (mřížka ${D.cols} × ${D.rows} oříznutá obrysem, malé zbytky připojeny k sousedům). Nejužší dílek ${cz(k.minSirka)} mm.`);
      } else {
        // vkládačka
        const sady = { jeden: [p.tvar], zakladni: ['kruh', 'ctverec', 'trojuhelnik', 'hvezda'], zvirata: ['slon', 'kocka', 'ryba', 'zelva'] };
        const ids = sady[p.sada] || [p.tvar];
        const tvary = ids.map((id) => (id === p.tvar ? tv : DH.tvarMm(id, { sirka: p.sirka, zaobleni: p.zaobleniObrysu }, data))).filter((t) => !t.prazdny);
        const sl = tvary.length <= 3 ? tvary.length : 2, ra = Math.ceil(tvary.length / sl), mez = Math.max(p.ram * 0.8, 18);
        const bunW = Math.max(...tvary.map((t) => t.w)), bunH = Math.max(...tvary.map((t) => t.h));
        const W = 2 * p.ram + sl * bunW + (sl - 1) * mez, H = 2 * p.ram + ra * bunH + (ra - 1) * mez;
        const vyrezy = [], kusy = [];
        tvary.forEach((t, i) => {
          const c = i % sl, r = ra - 1 - Math.floor(i / sl), x = p.ram + c * (bunW + mez) + (bunW - t.w) / 2, y = p.ram + r * (bunH + mez) + (bunH - t.h) / 2;
          const ob = t.obrys.filter((b) => DH.plocha(b) > 0).map((b) => DH.posun(b, x, y));
          vyrezy.push(...ob);
          const kus = p.vule > 0 ? DH.offset(ob, -p.vule) : ob;
          const vb = DH.vnitrniBod(kus[0]);
          kusy.push({ t, b: kus[0], diry: [], uchyt: vb, det: t.detaily.map((d) => ({ b: DH.posun(d.b, x, y), otevrena: d.otevrena })) });
        });
        const ramB = DH.zaoblenyObd(0, 0, W, H, Math.max(8, spol.zaobleni * 4));
        N.dily.push({ id: 'R', nazev: 'rám s výřezy', ks: 1, tl: p.tl, mat: spol.material, obrysy: [{ b: ramB, typ: 'rez' }].concat(vyrezy.map((b) => ({ b, typ: 'rez' }))), kruhy: [], texty: [], poznamka: 'výřezy: navrtat startovní otvor Ø 2 na čáře, pilku provléct' });
        if (p.podlozkaTl > 0) N.dily.push({ id: 'B', nazev: 'podložka', ks: 1, tl: p.podlozkaTl, mat: 'briza', obrysy: [{ b: ramB, typ: 'rez' }], kruhy: [], texty: [], poznamka: 'přilepit pod rám (PVA), zatížit' });
        kusy.forEach((k, i) => {
          const kr = p.uchyt > 0 ? [{ x: k.uchyt.x, y: k.uchyt.y, r: p.uchyt / 2, typ: 'otvor' }] : [];
          N.dily.push({ id: 'V' + (i + 1), nazev: 'vkládací dílek – ' + k.t.nazev, ks: 1, tl: p.tl, mat: spol.material, obrysy: [{ b: k.b, typ: 'rez' }].concat(gravir(k.det)), kruhy: kr, texty: [], male: { typ: 'deska', b: k.b, tl: p.tl }, volny: true, poznamka: p.uchyt > 0 ? `otvor Ø ${cz(p.uchyt)} hl. ${cz(Math.min(p.tl - 4, 10))} pro úchyt` : '' });
        });
        if (p.uchyt > 0 && tvary.length) {
          const vys = Math.max(18, p.uchyt * 1.8);
          N.kusovnik.push(DH.polozka(3, 'úchyt – dřevěný kolíček / STL', kusy.length, `Ø ${cz(p.uchyt)} × ${cz(vys + Math.min(p.tl - 4, 10))}`, 'buk', `vlepit (PVA D3), nad dílkem ${cz(vys)} mm`));
          N.male.push({ nazev: 'úchyt (kolíček)', tvar: { typ: 'valec', d: p.uchyt, h: vys + Math.min(p.tl - 4, 10) }, volny: false });
          N.stl.push({ id: 'uchyt', nazev: `Úchyt Ø ${cz(p.uchyt)} s kulovou hlavou`, d: p.uchyt, h: vys, zasun: Math.min(p.tl - 4, 10) });
          if (p.uchyt < 12 && vek < 2) N.bezpecnost.push({ u: 'pozor', t: 'Pro batolata je pohodlnější velký úchyt (kulička Ø 20–25 mm) – malý kolíček se hůř drží.' });
        }
        N.kusovnik.unshift(DH.polozka(1, 'rám', 1, DH.rozmerTxt(W, H, p.tl), mat, `${tvary.length} výřezů`), DH.polozka(2, 'podložka', p.podlozkaTl > 0 ? 1 : 0, DH.rozmerTxt(W, H, p.podlozkaTl), 'překližka', ''));
        // 3D: rám s otvory + podložka + dílky nad rámem
        N.telesa.push({ typ: 'extr', rovina: 'xy', b: ramB, diry: vyrezy.map((b) => b.slice().reverse()), tl: p.tl, x: 0, y: 0, z: p.podlozkaTl, barva: '#d9b98a', sklad: 0 });
        if (p.podlozkaTl > 0) N.telesa.push({ typ: 'extr', rovina: 'xy', b: ramB, tl: p.podlozkaTl, x: 0, y: 0, z: 0, barva: '#c99a62', sklad: 0 });
        kusy.forEach((k, i) => {
          N.telesa.push({ typ: 'extr', rovina: 'xy', b: k.b, tl: p.tl, x: 0, y: 0, z: p.podlozkaTl, barva: ['#e8a33d', '#4f8fc0', '#6aab5b', '#d0574e'][i % 4], sklad: i + 1, rozlet: [0, 0, p.tl + 30], detaily: k.det });
          if (p.uchyt > 0) N.telesa.push({ typ: 'valec', osa: 'z', x: k.uchyt.x, y: k.uchyt.y, z: p.podlozkaTl + p.tl, r: p.uchyt / 2, h: Math.max(18, p.uchyt * 1.8), barva: '#f1e0bd', sklad: i + 1, rozlet: [0, 0, p.tl + 30] });
        });
        const dilky = kusy.map((k) => ({ b: k.b }));
        posudDilky(N, dilky, p.tl, vek);
        N.dilky = dilky;
        const g = DH.mezera(p.vule * 2 + (+spol.kerf || 0));
        N.info.push(`Rám ${cz(W)} × ${cz(H)} mm, ${tvary.length} ${tvary.length === 1 ? 'tvar' : tvary.length < 5 ? 'tvary' : 'tvarů'}. Mezera dílek–rám ≈ ${cz(p.vule * 2 + (+spol.kerf || 0), 2)} mm (vůle + prořez).`);
        if (g.u === 'chyba') N.bezpecnost.push({ u: 'pozor', t: 'Mezera mezi dílkem a rámem: ' + g.t });
        N.koty.push({ pohled: 'pudorys', txt: 'vkládačka' });
      }
      if (tv.detaily.length) N.bezpecnost.push({ u: 'ok', t: 'Oči a detaily jsou vypálené / vyryté (ne vrtané) – žádné otvory 5–12 mm na prsty, žádné nalepené oči (malé díly).' });
      N.info.push(`Tvar ${tv.nazev}: ${cz(tv.w)} × ${cz(tv.h)} mm, plocha ${cz(Math.abs(DH.plochaPoli(tv.obrys)) / 100, 1)} cm². Prořez lupenkové pily ≈ 0,5–1 mm, laseru ≈ 0,1–0,2 mm.`);
      N.animace = { sklad: p.rezim !== 'figurka' };
      return N;
    },
  };

  /* ============================================================
     4) PUZZLE Z OBRÁZKU – deska W × H rozdělená na dílky, obrázek se tiskne pod řezy
     ============================================================ */
  DH.GEN.puzzle = {
    nazev: 'Puzzle z obrázku', ikona: '🧩', typ: 'hracka',
    popis: 'Obrázek (fotka, kresba) nalepený na překližku a rozdělený na dílky: zámky nebo slepé dílky, velikost podle věku, rámeček.',
    pole: [
      { sk: 'Deska' },
      { k: 'W', n: 'Šířka (mm)', t: 'n', min: 50, max: 1000, krok: 1 },
      { k: 'H', n: 'Výška (mm)', t: 'n', min: 50, max: 1000, krok: 1 },
      { k: 'podleObrazku', n: 'Poměr stran podle obrázku', t: 'b' },
      { k: 'tl', n: 'Tloušťka (mm)', t: 'n', min: 3, max: 30, krok: 0.5 },
      { k: 'roh', n: 'Zaoblení rohů desky (mm)', t: 'n', min: 0, max: 50, krok: 1 },
      { sk: 'Dílky' },
      { k: 'podleVeku', n: 'Počet dílků podle věku dítěte', t: 'b' },
      { k: 'dilku', n: 'Počet dílků (přibližně)', t: 'n', min: 2, max: 500, krok: 1, ukaz: (p) => !p.podleVeku },
      { k: 'hrana', n: 'Řez', t: 'v', m: [['auto', 'podle věku'], ['jigsaw', 'zámky (jigsaw)'], ['vlna', 'vlnka (slepé dílky)'], ['rovne', 'rovné']] },
      { k: 'seed', n: 'Varianta řezu (číslo)', t: 'n', min: 1, max: 9999, krok: 1 },
      { k: 'ram', n: 'Rámeček s podložkou (okraj, mm; 0 = bez)', t: 'n', min: 0, max: 60, krok: 1 },
    ],
    vychozi: { W: 240, H: 180, podleObrazku: true, tl: 9, roh: 6, podleVeku: true, dilku: 24, hrana: 'auto', seed: 3, ram: 0 },
    predvolby: [
      { id: 'a5', nazev: 'Fotka 24 × 18 cm, podle věku', p: {} },
      { id: 'mini', nazev: 'Pro dvouleté – 6 slepých dílků s rámem', p: { W: 200, H: 200, podleVeku: false, dilku: 6, hrana: 'vlna', tl: 18, ram: 20 } },
      { id: 'velke', nazev: '48 dílků A4 se zámky, překližka 4 mm', p: { W: 297, H: 210, podleVeku: false, dilku: 48, hrana: 'jigsaw', tl: 4, roh: 0 } },
    ],
    vypocet(p, spol, nast, data) {
      const N = { typ: 'hracka', dily: [], telesa: [], kusovnik: [], bezpecnost: [], info: [], varovani: [], koty: [], tabulky: [], stl: [], male: [] };
      const vek = +spol.vek, V = DH.puzzleVek(vek), mat = (DH.MATERIALY[spol.material] || {}).nazev;
      let W = p.W, H = p.H;
      if (p.podleObrazku && data && data.obrazekPomer > 0) H = r1(W / data.obrazekPomer);
      const hrana = p.hrana === 'auto' ? V.hrana : p.hrana;
      let n = p.podleVeku ? V.max : p.dilku;
      if (p.podleVeku) {
        // co nejvíc dílků do limitu věku, ale dílek ne užší než doporučení
        n = Math.max(2, Math.min(V.max, Math.floor((W / V.min) * (H / V.min))));
      }
      const R = DH.rozdeleni(W, H, n);
      const M = DH.mrizkaPuzzle(W, H, R.c, R.r, hrana, p.seed);
      let obrys = DH.obdelnik(0, 0, W, H);
      if (p.roh > 0) {
        obrys = DH.zaoblenyObd(0, 0, W, H, Math.min(p.roh, Math.min(M.cw, M.ch) / 3));
        for (const d of M.dilky) { const q = DH.prunik([d.b], [obrys]); d.b = q.length ? q.reduce((m, b) => (Math.abs(DH.plocha(b)) > Math.abs(DH.plocha(m)) ? b : m)) : d.b; }
      }
      const dilky = M.dilky.map((d) => ({ b: d.b, diry: [], r: d.r, c: d.c }));
      const k = DH.kontrolaDilku(dilky, [obrys]);
      N.kontrola = k; N.dilky = dilky; N.obrazekRam = { x: 0, y: 0, w: W, h: H };
      const ob = [{ b: obrys, typ: 'rez' }].concat(M.hrany.map((b) => ({ b, typ: 'rez', otevrena: true })));
      N.dily.push({ id: 'P', nazev: `puzzle ${R.c} × ${R.r} = ${R.c * R.r} dílků`, ks: 1, tl: p.tl, mat: spol.material, obrysy: ob, kruhy: [], texty: [], obrazek: true, poznamka: 'obrázek nalepit na desku (lepidlo na papír / sprej), přelakovat, pak řezat ze strany obrázku' });
      posudDilky(N, dilky, p.tl, vek);
      telesaDilku(N, dilky, p.tl, p.ram > 0 ? 3 : 0);
      N.kusovnik.push(DH.polozka(1, 'deska puzzle (překližka)', 1, DH.rozmerTxt(W, H, p.tl), mat, `${R.c * R.r} dílků ${R.c} × ${R.r}, dílek ≈ ${cz(M.cw)} × ${cz(M.ch)} mm`));
      N.kusovnik.push(DH.polozka(2, 'tisk obrázku', 1, DH.rozmerTxt(W, H), 'papír 120–160 g / fotopapír', 'tisknout z PDF 1:1 (list s obrázkem), lepit bez bublin'));
      if (p.ram > 0) {
        const Wr = W + 2 * p.ram + 2, Hr = H + 2 * p.ram + 2, rb = DH.zaoblenyObd(0, 0, Wr, Hr, Math.max(6, p.roh + p.ram / 2));
        const otv = DH.posun(DH.zaoblenyObd(0, 0, W + 2, H + 2, p.roh), p.ram, p.ram);
        N.dily.push({ id: 'R', nazev: 'rámeček', ks: 1, tl: p.tl, mat: spol.material, obrysy: [{ b: rb, typ: 'rez' }, { b: otv, typ: 'rez' }], kruhy: [], texty: [], poznamka: 'výřez o 1 mm větší než puzzle' });
        N.dily.push({ id: 'B', nazev: 'podložka rámečku', ks: 1, tl: 3, mat: 'briza', obrysy: [{ b: rb, typ: 'rez' }], kruhy: [], texty: [] });
        N.kusovnik.push(DH.polozka(3, 'rámeček + podložka', 2, DH.rozmerTxt(Wr, Hr, p.tl) + ' / 3', 'překližka', 'slepit'));
        for (const t of N.telesa) { t.x += p.ram + 1; t.y += p.ram + 1; }
        N.telesa.push({ typ: 'extr', rovina: 'xy', b: rb, diry: [otv.slice().reverse()], tl: p.tl, x: 0, y: 0, z: 3, barva: '#c99a62', sklad: -1, bezObrazku: true });
        N.telesa.push({ typ: 'extr', rovina: 'xy', b: rb, tl: 3, x: 0, y: 0, z: 0, barva: '#b98552', sklad: -1, bezObrazku: true });
        N.obrazekRam = { x: p.ram + 1, y: p.ram + 1, w: W, h: H };
      }
      N.obrazek3d = true;
      N.info.push(`${R.c} × ${R.r} = ${R.c * R.r} dílků, buňka ${cz(M.cw)} × ${cz(M.ch)} mm, nejužší dílek ${cz(k.minSirka)} mm. Doporučení pro ${cz(vek, 0)}+: do ${V.max} dílků, dílek ≥ ${cz(V.min)} mm, ${V.hrana === 'jigsaw' ? 'zámky' : 'slepé dílky'}${V.pozn ? ' – ' + V.pozn : ''}.`);
      N.info.push(`Kontrola: dílky pokrývají ${cz(100 * k.plochaDilku / k.plochaObrysu, 3)} % plochy, součet překryvů ${cz(k.prekryv, 3)} mm².`);
      if (!(data && data.maObrazek)) N.info.push('Nahrajte obrázek – vytiskne se 1:1 pod řezy (PDF), uloží se jen v tomto prohlížeči (IndexedDB).');
      N.bezpecnost.push({ u: 'ok', t: 'Obrázek tiskněte laserovou tiskárnou nebo pigmentovým inkoustem a přelakujte vodou ředitelným lakem s EN 71-3 – dítě dílky olizuje.' });
      N.animace = { sklad: true };
      return N;
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DH;
})(typeof window !== 'undefined' ? window : globalThis);
