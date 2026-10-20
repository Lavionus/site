/* ============================================================
   Vrtací šablony – jádro (bez DOM)
   Souřadnice dílu: mm, počátek v levém dolním rohu desky (pohled na vrtanou plochu),
   x doprava, y nahoru. Díra {x, y, d, hl (0 = skrz), typ, popis}.
   navrh(projekt) → { dily: [dil], varovani: [text], info }
   dil = { id, nazev, pohled, w, h, t, diry, ref: {x:'L'|'P'|null, y:'D'|'H'|null, nx, ny},
           kruh?, celo?, sablonaCela?, prehled?, podlaha?, odRohu?, osy?, znacky?, obrysy?, vodovaha? }
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;
  const r2 = (x) => Math.round(x * 100) / 100;
  const cislo = (v, z) => { const x = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : +v; return isFinite(x) ? x : z; };

  /** „37, 69; 261“ → [37, 69, 261] (desetinná čárka i tečka) */
  function seznamCisel(s) {
    const t = String(s == null ? '' : s).trim();
    let casti;
    if (t.includes(';')) casti = t.split(';');
    else if (/\s/.test(t)) casti = t.split(/,?\s+/);
    else if ((t.match(/,/g) || []).length > 1) casti = t.split(',');
    else casti = [t];
    return casti.map((q) => q.trim()).filter(Boolean).map((q) => parseFloat(q.replace(',', '.'))).filter((x) => isFinite(x));
  }
  /** „600x400; 400×500“ → [[600,400],[400,500]] */
  function seznamRozmeru(s) {
    const out = [];
    for (const m of String(s || '').matchAll(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/gi)) out.push([parseFloat(m[1].replace(',', '.')), parseFloat(m[2].replace(',', '.'))]);
    return out;
  }

  /** díry na roztečné kružnici: úhel od svislé osy (12 h) ve směru hodinových ručiček */
  function pcdBody(n, D, uhel, cx, cy) {
    const out = [], R = D / 2;
    for (let i = 0; i < n; i++) { const a = (uhel + i * 360 / n) * RAD; out.push([cx + R * Math.sin(a), cy + R * Math.cos(a)]); }
    return out;
  }
  /** rovnoměrné rozložení n bodů mezi a a b */
  const rozloz = (a, b, n) => (n <= 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1)));

  const NAZEV_HRANY = { L: 'levá hrana', P: 'pravá hrana', D: 'spodní hrana', H: 'horní hrana' };
  function dira(x, y, d, hl, typ, popis) { return { x: r2(x), y: r2(y), d: +d, hl: Math.max(0, +hl || 0), typ: typ || 'dira', popis: popis || '' }; }

  /** zrcadlení dílu podle svislé (osa 'x' → x' = w − x) nebo vodorovné osy */
  function zrcadliDil(dil, osa, zmeny) {
    const o = osa || 'x', d = JSON.parse(JSON.stringify(dil));
    if (o === 'x') {
      for (const q of d.diry) q.x = r2(dil.w - q.x);
      for (const q of d.znacky || []) q.x = r2(dil.w - q.x);
      for (const q of d.osy || []) if (q.osa === 'x') q.hodnota = r2(dil.w - q.hodnota);
      for (const q of d.obrysy || []) { const a = dil.w - q.x1, b = dil.w - q.x0; q.x0 = r2(a); q.x1 = r2(b); }
      if (d.ref.x) { d.ref.x = d.ref.x === 'L' ? 'P' : 'L'; }
    } else {
      for (const q of d.diry) q.y = r2(dil.h - q.y);
      for (const q of d.znacky || []) q.y = r2(dil.h - q.y);
      for (const q of d.osy || []) if (q.osa === 'y') q.hodnota = r2(dil.h - q.hodnota);
      for (const q of d.obrysy || []) { const a = dil.h - q.y1, b = dil.h - q.y0; q.y0 = r2(a); q.y1 = r2(b); }
      if (d.vodovaha != null) d.vodovaha = r2(dil.h - d.vodovaha);
      if (d.ref.y) { d.ref.y = d.ref.y === 'D' ? 'H' : 'D'; }
    }
    d.zrcadlo = { z: dil.id, osa: o };
    return Object.assign(d, zmeny || {});
  }

  /* ---------------- popis režimů: pole formuláře + výchozí hodnoty + generátor ---------------- */
  const ROZTECE_UCHYTEK = [0, 64, 96, 128, 160, 192, 224, 256, 320];
  const VESA = [[75, 75], [100, 100], [200, 100], [200, 200], [300, 200], [300, 300], [400, 200], [400, 300], [400, 400], [600, 400]];
  const PCD_PRESETY = [
    { id: '', nazev: '– vlastní –' },
    { id: 'r4x100', nazev: 'ráfek 4 × 100', n: 4, D: 100 }, { id: 'r4x108', nazev: 'ráfek 4 × 108', n: 4, D: 108 },
    { id: 'r5x100', nazev: 'ráfek 5 × 100', n: 5, D: 100 }, { id: 'r5x108', nazev: 'ráfek 5 × 108', n: 5, D: 108 },
    { id: 'r5x112', nazev: 'ráfek 5 × 112', n: 5, D: 112 }, { id: 'r5x114', nazev: 'ráfek 5 × 114,3', n: 5, D: 114.3 },
    { id: 'r5x120', nazev: 'ráfek 5 × 120', n: 5, D: 120 }, { id: 'r6x139', nazev: 'ráfek 6 × 139,7', n: 6, D: 139.7 },
    { id: 'dn50', nazev: 'příruba DN 50 PN 16 (typicky)', n: 4, D: 125, d: 18, vnejsi: 165, stred: 0 },
    { id: 'dn80', nazev: 'příruba DN 80 PN 16 (typicky)', n: 8, D: 160, d: 18, vnejsi: 200, stred: 0 },
    { id: 'dn100', nazev: 'příruba DN 100 PN 16 (typicky)', n: 8, D: 180, d: 18, vnejsi: 220, stred: 0 },
  ];
  const STRANA = [['levy', 'levý bok'], ['pravy', 'pravý bok']];

  const REZIMY = {
    /* ---------- nábytek ---------- */
    police32: {
      nazev: 'Systém 32 – police', ikona: '⋮⋮', skupina: 'nabytek',
      popis: 'Řady děr pro podpěrky polic v boku skříně: odsazení 37 mm od hrany, rozteč 32 mm.',
      pole: [
        { k: 'vyska', n: 'Výška boku (mm)', min: 50, max: 3000 }, { k: 'hloubka', n: 'Hloubka boku (mm)', min: 50, max: 1500 },
        { k: 'tloustka', n: 'Tloušťka desky (mm)', min: 6, max: 60, krok: 0.5 },
        { k: 'strana', n: 'Vrtaný bok (pohled zevnitř skříně)', t: 'v', m: STRANA },
        { k: 'rady', n: 'Řady děr', t: 'v', m: [['predni', 'jen přední'], ['obe', 'přední + zadní'], ['tri', 'přední, střední, zadní']] },
        { k: 'odsazeni', n: 'Přední řada od přední hrany (mm)', min: 5, max: 500, krok: 0.5 },
        { k: 'zadniNasobek', n: 'Zadní řada v násobku rozteče od přední (systém 32)', t: 'b', ukaz: (p) => p.rady !== 'predni' },
        { k: 'zadniOdsazeni', n: 'Zadní řada od zadní hrany (mm, nejméně)', min: 5, max: 500, krok: 0.5, ukaz: (p) => p.rady !== 'predni' },
        { k: 'roztec', n: 'Rozteč děr v řadě (mm)', min: 5, max: 500, krok: 0.5 },
        { k: 'prumer', n: 'Průměr díry (mm)', min: 1, max: 20, krok: 0.5 }, { k: 'hl', n: 'Hloubka díry (mm, 0 = skrz)', min: 0, max: 60, krok: 0.5 },
        { k: 'rozsah', n: 'Délka řady', t: 'v', m: [['pocet', 'začátek + počet děr'], ['konec', 'začátek + odsazení konce']] },
        { k: 'zacatek', n: 'První díra od spodní hrany (mm)', min: 0, max: 3000 },
        { k: 'pocet', n: 'Počet děr v řadě', min: 1, max: 200, krok: 1, ukaz: (p) => p.rozsah === 'pocet' },
        { k: 'konec', n: 'Poslední díra nejméně od horní hrany (mm)', min: 0, max: 3000, ukaz: (p) => p.rozsah === 'konec' },
        { k: 'vystredit', n: 'Vystředit řadu na výšku boku', t: 'b' },
        { k: 'pasy', n: 'Šablona po řadách (pruh k přední / zadní hraně) místo celého boku', t: 'b' },
        { k: 'protikus', n: 'Přidat zrcadlový protikus (druhý bok)', t: 'b' },
      ],
      vychozi: { pasy: true, vyska: 720, hloubka: 560, tloustka: 18, strana: 'levy', rady: 'obe', odsazeni: 37, zadniNasobek: true, zadniOdsazeni: 37, roztec: 32, prumer: 5, hl: 12, rozsah: 'konec', zacatek: 96, pocet: 18, konec: 96, vystredit: false, protikus: true },
      generuj(p, v) {
        const W = p.hloubka, H = p.vyska, r = Math.max(1, p.roztec);
        let y0 = p.zacatek, n;
        if (p.rozsah === 'pocet') n = Math.max(1, Math.round(p.pocet));
        else n = Math.max(1, Math.floor((H - p.konec - y0) / r + 1e-9) + 1);
        if (p.vystredit) y0 = (H - (n - 1) * r) / 2;
        const xs = [p.odsazeni];
        if (p.rady !== 'predni') {
          let xr;
          if (p.zadniNasobek) { const k = Math.floor((W - p.odsazeni - p.zadniOdsazeni) / r + 1e-9); xr = p.odsazeni + k * r; if (p.rady === 'tri') xs.push(p.odsazeni + Math.round(k / 2) * r); }
          else { xr = W - p.zadniOdsazeni; if (p.rady === 'tri') xs.push((p.odsazeni + xr) / 2); }
          if (xr > p.odsazeni + p.prumer) xs.push(xr); else v.push('Zadní řada se do hloubky boku nevejde.');
        }
        xs.sort((a, b) => a - b);
        const diry = [];
        for (const x of xs) for (let i = 0; i < n; i++) diry.push(dira(x, y0 + i * r, p.prumer, p.hl, 'dira', 'podpěrka police'));
        if (y0 + (n - 1) * r > H - p.prumer / 2 || y0 < p.prumer / 2) v.push('Řada děr přesahuje bok – zkontrolujte začátek a počet.');
        const levy = p.strana !== 'pravy', jmeno = (l) => (l ? 'Levý bok' : 'Pravý bok');
        const zaklad = (id, nazev, dd, ref) => ({ id, nazev, pohled: 'pohled na vnitřní plochu boku', w: W, h: H, t: p.tloustka, diry: dd, ref });
        let sada;
        if (p.pasy) {
          // každá řada vlastní pruh: přední k přední hraně, zadní k zadní hraně, střední k bližší
          sada = xs.map((x, i) => {
            const kZadni = W - x < x, nazevRady = xs.length === 1 ? '' : i === 0 ? ' – přední řada' : i === xs.length - 1 ? ' – zadní řada' : ' – střední řada';
            return zaklad('A' + (i + 1), jmeno(levy) + nazevRady, diry.filter((q) => q.x === r2(x)),
              kZadni ? { x: 'P', y: 'D', nx: 'zadní hrana', ny: 'spodní hrana' } : { x: 'L', y: 'D', nx: 'přední hrana', ny: 'spodní hrana' });
          });
        } else sada = [zaklad('A', jmeno(levy), diry, { x: 'L', y: 'D', nx: 'přední hrana', ny: 'spodní hrana' })];
        if (!levy) sada = sada.map((d) => zrcadliDil(d, 'x', { zrcadlo: null }));
        const dily = sada.slice();
        if (p.protikus) for (const d of sada) dily.push(zrcadliDil(d, 'x', { id: d.id.replace('A', 'B'), nazev: d.nazev.replace(jmeno(levy), jmeno(!levy)) + ' (protikus)' }));
        return { dily, info: `${xs.length} × ${n} děr, řada od ${r2(y0)} do ${r2(y0 + (n - 1) * r)} mm` };
      },
    },

    zavesy: {
      nazev: 'Miskové závěsy', ikona: '◐', skupina: 'nabytek',
      popis: 'Díry Ø 35 pro misky závěsů ve dvířkách a montážní destičky v boku.',
      pole: [
        { k: 'vyska', n: 'Výška dvířek (mm)', min: 100, max: 3000 }, { k: 'sirka', n: 'Šířka dvířek (mm)', min: 80, max: 1500 },
        { k: 'tloustka', n: 'Tloušťka dvířek (mm)', min: 12, max: 40, krok: 0.5 },
        { k: 'strana', n: 'Závěsy na straně (při pohledu zepředu)', t: 'v', m: [['levy', 'vlevo'], ['pravy', 'vpravo']] },
        { k: 'pocet', n: 'Počet závěsů', t: 'v', m: [['0', 'automaticky podle výšky'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']] },
        { k: 'odsazeniKraj', n: 'Střed misky od horní a spodní hrany (mm)', min: 40, max: 400 },
        { k: 'K', n: 'Vzdálenost misky od hrany dvířek K (mm, typ. 3–6)', min: 0, max: 15, krok: 0.5 },
        { k: 'prumerMisky', n: 'Průměr misky (mm)', min: 20, max: 40, krok: 0.5 }, { k: 'hlMisky', n: 'Hloubka misky (mm)', min: 5, max: 20, krok: 0.5 },
        { k: 'srouby', n: 'Předvrtat šrouby misky', t: 'b' },
        { k: 'roztecSroubu', n: 'Rozteč šroubů misky (mm)', min: 20, max: 70, krok: 0.5, ukaz: (p) => p.srouby },
        { k: 'posunSroubu', n: 'Osa šroubů od středu misky dovnitř dvířek (mm)', min: 0, max: 20, krok: 0.5, ukaz: (p) => p.srouby },
        { k: 'prumerSroubu', n: 'Předvrt šroubů Ø (mm)', min: 1, max: 6, krok: 0.5, ukaz: (p) => p.srouby },
        { k: 'hlSroubu', n: 'Hloubka předvrtu (mm)', min: 1, max: 20, krok: 0.5, ukaz: (p) => p.srouby },
        { k: 'bok', n: 'Šablona pro montážní destičky v boku', t: 'b' },
        { k: 'vyskaBoku', n: 'Výška boku (mm)', min: 100, max: 3000, ukaz: (p) => p.bok },
        { k: 'hloubkaBoku', n: 'Hloubka boku (mm)', min: 50, max: 1500, ukaz: (p) => p.bok },
        { k: 'posunVysky', n: 'Spodní hrana dvířek nad spodní hranou boku (mm, − = pod)', min: -200, max: 500, krok: 0.5, ukaz: (p) => p.bok },
        { k: 'destickaX', n: 'Destička: otvory od přední hrany boku (mm)', min: 5, max: 200, krok: 0.5, ukaz: (p) => p.bok },
        { k: 'destickaRoztec', n: 'Destička: rozteč otvorů svisle (mm)', min: 0, max: 100, krok: 0.5, ukaz: (p) => p.bok },
        { k: 'destickaD', n: 'Destička: Ø otvorů (mm)', min: 1, max: 10, krok: 0.5, ukaz: (p) => p.bok },
        { k: 'destickaHl', n: 'Destička: hloubka otvorů (mm)', min: 1, max: 30, krok: 0.5, ukaz: (p) => p.bok },
      ],
      vychozi: { vyska: 720, sirka: 450, tloustka: 18, strana: 'levy', pocet: '0', odsazeniKraj: 100, K: 4, prumerMisky: 35, hlMisky: 12.5, srouby: true, roztecSroubu: 48, posunSroubu: 6, prumerSroubu: 2.5, hlSroubu: 10, bok: true, vyskaBoku: 720, hloubkaBoku: 560, posunVysky: 0, destickaX: 37, destickaRoztec: 32, destickaD: 5, destickaHl: 12 },
      generuj(p, v) {
        const H = p.vyska, W = p.sirka, D = p.prumerMisky;
        const n = +p.pocet || (H <= 900 ? 2 : H <= 1600 ? 3 : H <= 2000 ? 4 : 5);
        const ys = rozloz(p.odsazeniKraj, H - p.odsazeniKraj, n);
        // vnitřní plocha dvířek: při pohledu zezadu se strany prohodí
        const vpravo = p.strana !== 'pravy';
        const xc = vpravo ? W - (p.K + D / 2) : p.K + D / 2, dovnitr = vpravo ? -1 : 1;
        const diry = [];
        for (const y of ys) {
          diry.push(dira(xc, y, D, p.hlMisky, 'miska', 'miska závěsu'));
          if (p.srouby) for (const s of [-1, 1]) diry.push(dira(xc + dovnitr * p.posunSroubu, y + s * p.roztecSroubu / 2, p.prumerSroubu, p.hlSroubu, 'predvrt', 'šroub misky'));
        }
        if (p.K < 3 || p.K > 6) v.push(`Vzdálenost K = ${p.K} mm je mimo běžný rozsah 3–6 mm – ověřte v návodu k závěsu.`);
        if (p.hlMisky > p.tloustka - 3) v.push(`Miska ${p.hlMisky} mm v dvířkách ${p.tloustka} mm – zbývá méně než 3 mm, hrozí provrtání líce.`);
        if (n >= 2 && ys[1] - ys[0] < D + 20) v.push('Misky jsou příliš blízko u sebe.');
        const dily = [{ id: 'A', nazev: 'Dvířka', pohled: 'pohled na vnitřní stranu dvířek (zezadu)', w: W, h: H, t: p.tloustka, diry,
          ref: { x: vpravo ? 'P' : 'L', y: 'D', nx: 'hrana se závěsy', ny: 'spodní hrana dvířek' } }];
        if (p.bok) {
          // bok na straně závěsů, pohled zevnitř: levý bok má přední hranu vlevo
          const levyBok = p.strana !== 'pravy', W2 = p.hloubkaBoku, x2 = levyBok ? p.destickaX : W2 - p.destickaX;
          const d2 = [];
          for (const y of ys) {
            const yb = y + p.posunVysky;
            if (p.destickaRoztec > 0) for (const s of [-1, 1]) d2.push(dira(x2, yb + s * p.destickaRoztec / 2, p.destickaD, p.destickaHl, 'dira', 'montážní destička'));
            else d2.push(dira(x2, yb, p.destickaD, p.destickaHl, 'dira', 'montážní destička'));
          }
          dily.push({ id: 'B', nazev: levyBok ? 'Levý bok – destičky' : 'Pravý bok – destičky', pohled: 'pohled na vnitřní plochu boku', w: W2, h: p.vyskaBoku, t: p.tloustka, diry: d2,
            ref: { x: levyBok ? 'L' : 'P', y: 'D', nx: 'přední hrana boku', ny: 'spodní hrana boku' } });
        }
        return { dily, info: `${n} závěsy, středy misek ${ys.map((y) => r2(y)).join(', ')} mm od spodní hrany, ${r2(p.K + D / 2)} mm od hrany` };
      },
    },

    uchytky: {
      nazev: 'Úchytky', ikona: '⊸', skupina: 'nabytek',
      popis: 'Otvory pro úchytky a knopky na dvířkách a čelech zásuvek.',
      pole: [
        { k: 'sirka', n: 'Šířka čela / dvířek (mm)', min: 30, max: 2000 }, { k: 'vyska', n: 'Výška čela / dvířek (mm)', min: 30, max: 3000 },
        { k: 'tloustka', n: 'Tloušťka (mm)', min: 6, max: 50, krok: 0.5 },
        { k: 'roztec', n: 'Rozteč úchytky (mm)', t: 'v', m: ROZTECE_UCHYTEK.map((x) => [String(x), x ? x + ' mm' : 'knopka (1 otvor)']).concat([['vlastni', 'vlastní…']]) },
        { k: 'roztecVlastni', n: 'Vlastní rozteč (mm)', min: 1, max: 1500, ukaz: (p) => p.roztec === 'vlastni' },
        { k: 'orientace', n: 'Orientace', t: 'v', m: [['vodorovne', 'vodorovně'], ['svisle', 'svisle']] },
        { k: 'umisteni', n: 'Umístění', t: 'v', m: [['stred', 'střed čela'], ['horni', 'u horní hrany'], ['dolni', 'u spodní hrany'], ['vlastni', 'vlastní souřadnice středu']] },
        { k: 'odsazeni', n: 'Střed úchytky od hrany (mm)', min: 0, max: 1000, ukaz: (p) => p.umisteni === 'horni' || p.umisteni === 'dolni' },
        { k: 'cx', n: 'Střed úchytky od levé hrany (mm)', min: 0, max: 2000, ukaz: (p) => p.umisteni === 'vlastni' },
        { k: 'cy', n: 'Střed úchytky od spodní hrany (mm)', min: 0, max: 3000, ukaz: (p) => p.umisteni === 'vlastni' },
        { k: 'pocet', n: 'Počet úchytek', t: 'v', m: [['1', '1'], ['2', '2 (ve čtvrtinách šířky)']] },
        { k: 'prumer', n: 'Průměr otvoru (mm, M4 → 5)', min: 1, max: 15, krok: 0.5 }, { k: 'hl', n: 'Hloubka (0 = skrz)', min: 0, max: 50, krok: 0.5 },
      ],
      vychozi: { sirka: 450, vyska: 180, tloustka: 18, roztec: '128', roztecVlastni: 128, orientace: 'vodorovne', umisteni: 'stred', odsazeni: 40, cx: 225, cy: 90, pocet: '1', prumer: 5, hl: 0 },
      generuj(p, v) {
        const W = p.sirka, H = p.vyska, r = p.roztec === 'vlastni' ? p.roztecVlastni : +p.roztec;
        let cy = H / 2, cxs = [W / 2];
        if (p.umisteni === 'horni') cy = H - p.odsazeni; else if (p.umisteni === 'dolni') cy = p.odsazeni; else if (p.umisteni === 'vlastni') { cy = p.cy; cxs = [p.cx]; }
        if (+p.pocet === 2 && p.umisteni !== 'vlastni') cxs = [W / 4, W * 3 / 4];
        const diry = [];
        for (const cx of cxs) {
          if (!r) diry.push(dira(cx, cy, p.prumer, p.hl, 'dira', 'knopka'));
          else if (p.orientace === 'svisle') for (const s of [-1, 1]) diry.push(dira(cx, cy + s * r / 2, p.prumer, p.hl, 'dira', 'úchytka ' + r + ' mm'));
          else for (const s of [-1, 1]) diry.push(dira(cx + s * r / 2, cy, p.prumer, p.hl, 'dira', 'úchytka ' + r + ' mm'));
        }
        for (const q of diry) if (q.x < q.d || q.x > W - q.d || q.y < q.d || q.y > H - q.d) { v.push('Otvor úchytky je mimo čelo nebo příliš u hrany.'); break; }
        const horni = p.umisteni === 'horni';
        return {
          dily: [{ id: 'A', nazev: 'Čelo / dvířka', pohled: 'pohled zepředu (na líc)', w: W, h: H, t: p.tloustka, diry,
            ref: { x: 'L', y: horni ? 'H' : 'D', nx: 'levá hrana', ny: horni ? 'horní hrana' : 'spodní hrana' },
            osy: [{ osa: 'x', hodnota: W / 2, popis: 'osa čela' }].concat(p.umisteni === 'stred' ? [{ osa: 'y', hodnota: H / 2, popis: 'osa čela' }] : []) }],
          info: r ? `rozteč ${r} mm, střed ${cxs.map(r2).join(' a ')} × ${r2(cy)} mm` : 'knopka',
        };
      },
    },

    koliky: {
      nazev: 'Kolíkové spoje', ikona: '⦙', skupina: 'nabytek',
      popis: 'Kolíky Ø 6/8/10 v čele jednoho dílu a v ploše (nebo čele) protikusu – zrcadlově, aby po složení lícovaly.',
      pole: [
        { k: 'typSpoje', n: 'Spoj', t: 'v', m: [['roh', 'čelo A do plochy B (roh, T-spoj)'], ['hrana', 'čelo A na čelo B (spárování)']] },
        { k: 'delka', n: 'Délka spoje (mm)', min: 20, max: 3000 }, { k: 'tloustka', n: 'Tloušťka dílu A (mm)', min: 8, max: 80, krok: 0.5 },
        { k: 'tloustkaB', n: 'Tloušťka dílu B (mm)', min: 8, max: 80, krok: 0.5 },
        { k: 'prumer', n: 'Průměr kolíku', t: 'v', m: [['6', 'Ø 6'], ['8', 'Ø 8'], ['10', 'Ø 10'], ['12', 'Ø 12']] },
        { k: 'delkaKoliku', n: 'Délka kolíku (mm)', min: 10, max: 120 },
        { k: 'rozlozeni', n: 'Rozložení', t: 'v', m: [['max', 'rovnoměrně, rozteč nejvýš…'], ['pocet', 'rovnoměrně, počet kolíků'], ['pevna', 'pevná rozteč od začátku']] },
        { k: 'roztec', n: 'Rozteč (mm)', min: 10, max: 1000, ukaz: (p) => p.rozlozeni !== 'pocet' },
        { k: 'pocet', n: 'Počet kolíků', min: 1, max: 60, krok: 1, ukaz: (p) => p.rozlozeni === 'pocet' },
        { k: 'odsazeniZacatek', n: 'První kolík od přední hrany (mm)', min: 5, max: 1000 },
        { k: 'odsazeniKonec', n: 'Poslední kolík od zadní hrany (mm)', min: 5, max: 1000 },
        { k: 'hlCelo', n: 'Hloubka do čela (mm)', min: 3, max: 80, krok: 0.5 },
        { k: 'hlPlocha', n: 'Hloubka do plochy B (mm)', min: 3, max: 80, krok: 0.5, ukaz: (p) => p.typSpoje === 'roh' },
        { k: 'odHranyB', n: 'Díry v B od čelní hrany B (mm, obvykle tl. A / 2)', min: 2, max: 500, krok: 0.5, ukaz: (p) => p.typSpoje === 'roh' },
      ],
      vychozi: { typSpoje: 'roh', delka: 560, tloustka: 18, tloustkaB: 18, prumer: '8', delkaKoliku: 35, rozlozeni: 'max', roztec: 128, pocet: 4, odsazeniZacatek: 37, odsazeniKonec: 37, hlCelo: 23, hlPlocha: 13, odHranyB: 9 },
      generuj(p, v) {
        const L = p.delka, t = p.tloustka, d = +p.prumer, a = p.odsazeniZacatek, b = L - p.odsazeniKonec;
        let xs;
        if (p.rozlozeni === 'pocet') xs = rozloz(a, b, Math.max(1, Math.round(p.pocet)));
        else if (p.rozlozeni === 'pevna') { xs = []; for (let x = a; x <= b + 1e-6; x += Math.max(1, p.roztec)) xs.push(x); }
        else xs = rozloz(a, b, Math.max(2, Math.ceil((b - a) / Math.max(1, p.roztec) - 1e-9) + 1));
        if (b < a) v.push('Odsazení začátku a konce jsou větší než délka spoje.');
        const diryA = xs.map((x) => dira(x, t / 2, d, p.hlCelo, 'dira', 'kolík Ø' + d));
        const A = { id: 'A', nazev: 'Díl A – čelo', pohled: 'pohled na čelo (hranu) dílu A', w: L, h: t, t: 60, celo: true, diry: diryA,
          ref: { x: 'L', y: 'D', nx: 'přední hrana', ny: 'lícová plocha A' } };
        let B;
        if (p.typSpoje === 'hrana') {
          B = zrcadliDil(A, 'x', { id: 'B', nazev: 'Díl B – čelo (protikus)', pohled: 'pohled na čelo (hranu) dílu B', h: p.tloustkaB });
          for (const q of B.diry) q.y = r2(p.tloustkaB / 2);
        } else {
          const hB = Math.max(p.odHranyB * 2 + d + 30, 60);
          B = zrcadliDil(Object.assign({}, A, { h: hB, celo: false, t: p.tloustkaB, diry: diryA.map((q) => Object.assign({}, q, { y: r2(p.odHranyB), hl: p.hlPlocha })) }), 'x',
            { id: 'B', nazev: 'Díl B – plocha (protikus)', pohled: 'pohled na plochu dílu B u čelní hrany', celo: false });
          B.ref.ny = 'čelní hrana B (sem přijde díl A)';
          if (p.hlPlocha > p.tloustkaB - 3) v.push(`Hloubka ${p.hlPlocha} mm do plochy B (${p.tloustkaB} mm) – zbývá méně než 3 mm, hrozí provrtání.`);
        }
        const hlB = p.typSpoje === 'hrana' ? p.hlCelo : p.hlPlocha;
        if (p.hlCelo + hlB < p.delkaKoliku + 1) v.push(`Součet hloubek ${r2(p.hlCelo + hlB)} mm je menší než délka kolíku ${p.delkaKoliku} mm + 1 mm na lepidlo.`);
        if (d > t / 2 + 0.01) v.push(`Kolík Ø ${d} je silnější než polovina tloušťky dílu A (${t} mm).`);
        return { dily: [A, B], info: `${xs.length} kolíků Ø ${d}, polohy ${xs.map(r2).join(', ')} mm od přední hrany` };
      },
    },

    konfirmaty: {
      nazev: 'Excentry / konfirmáty', ikona: '⊕', skupina: 'nabytek',
      popis: 'Spoj boku a police/dna: excentr Ø 15 (typicky 24 nebo 34 mm od hrany) nebo konfirmát.',
      pole: [
        { k: 'typ', n: 'Spojovací kování', t: 'v', m: [['excentr', 'excentr + svorník'], ['konfirmat', 'konfirmát (šroub)']] },
        { k: 'hloubka', n: 'Délka spoje = hloubka dílů (mm)', min: 50, max: 1500 },
        { k: 'vyskaBoku', n: 'Výška boku A (mm)', min: 50, max: 3000 }, { k: 'sirkaB', n: 'Šířka dílu B – police/dno (mm)', min: 50, max: 2000 },
        { k: 'tloustkaA', n: 'Tloušťka boku A (mm)', min: 8, max: 50, krok: 0.5 }, { k: 'tloustkaB', n: 'Tloušťka dílu B (mm)', min: 8, max: 50, krok: 0.5 },
        { k: 'poloha', n: 'Střed tloušťky B nad spodní hranou boku (mm)', min: 0, max: 3000, krok: 0.5 },
        { k: 'pocet', n: 'Počet spojů', min: 1, max: 20, krok: 1 },
        { k: 'odsazeni', n: 'První spoj od přední hrany (mm)', min: 10, max: 500 }, { k: 'odsazeniKonec', n: 'Poslední od zadní hrany (mm)', min: 10, max: 500 },
        { k: 'excVzd', n: 'Střed excentru od čelní hrany B (typicky 24 / 34 mm)', min: 10, max: 80, krok: 0.5, ukaz: (p) => p.typ === 'excentr' },
        { k: 'excD', n: 'Průměr excentru (mm)', min: 8, max: 30, krok: 0.5, ukaz: (p) => p.typ === 'excentr' },
        { k: 'excHl', n: 'Hloubka excentru (mm)', min: 5, max: 30, krok: 0.5, ukaz: (p) => p.typ === 'excentr' },
        { k: 'svD', n: 'Svorník v boku A: Ø (mm)', min: 2, max: 12, krok: 0.5, ukaz: (p) => p.typ === 'excentr' },
        { k: 'svHl', n: 'Svorník v boku A: hloubka (mm)', min: 3, max: 30, krok: 0.5, ukaz: (p) => p.typ === 'excentr' },
        { k: 'kanD', n: 'Kanálek v čele B: Ø (mm)', min: 3, max: 12, krok: 0.5, ukaz: (p) => p.typ === 'excentr' },
        { k: 'konfD', n: 'Konfirmát: průchozí díra v A Ø (mm)', min: 3, max: 12, krok: 0.5, ukaz: (p) => p.typ === 'konfirmat' },
        { k: 'konfPredvrt', n: 'Konfirmát: předvrt v čele B Ø (mm)', min: 2, max: 10, krok: 0.5, ukaz: (p) => p.typ === 'konfirmat' },
        { k: 'konfDelka', n: 'Délka konfirmátu (mm)', min: 20, max: 120, ukaz: (p) => p.typ === 'konfirmat' },
      ],
      vychozi: { typ: 'excentr', hloubka: 560, vyskaBoku: 720, sirkaB: 600, tloustkaA: 18, tloustkaB: 18, poloha: 9, pocet: 2, odsazeni: 37, odsazeniKonec: 37, excVzd: 34, excD: 15, excHl: 13, svD: 5, svHl: 11, kanD: 8, konfD: 7, konfPredvrt: 5, konfDelka: 50 },
      generuj(p, v) {
        const L = p.hloubka, xs = rozloz(p.odsazeni, L - p.odsazeniKonec, Math.max(1, Math.round(p.pocet)));
        const exc = p.typ === 'excentr';
        const A = { id: 'A', nazev: 'Bok A', pohled: 'pohled na vnitřní plochu boku', w: L, h: p.vyskaBoku, t: p.tloustkaA,
          diry: xs.map((x) => (exc ? dira(x, p.poloha, p.svD, p.svHl, 'dira', 'svorník excentru') : dira(x, p.poloha, p.konfD, 0, 'dira', 'konfirmát – průchozí'))),
          ref: { x: 'L', y: 'D', nx: 'přední hrana', ny: 'spodní hrana boku' } };
        const dily = [A];
        if (exc) {
          dily.push({ id: 'B', nazev: 'Díl B – plocha (excentry)', pohled: 'pohled na vnitřní plochu dílu B u čelní hrany', w: L, h: Math.min(p.sirkaB, Math.max(80, p.excVzd * 2 + 40)), t: p.tloustkaB,
            diry: xs.map((x) => dira(x, p.excVzd, p.excD, p.excHl, 'miska', 'excentr')), ref: { x: 'L', y: 'D', nx: 'přední hrana', ny: 'čelní hrana B (ke boku)' } });
          if (p.excHl > p.tloustkaB - 3) v.push('Excentr je hlubší, než dovolí tloušťka dílu B.');
        }
        const hlKan = exc ? r2(p.excVzd + p.kanD / 2) : r2(p.konfDelka - p.tloustkaA + 3);
        dily.push({ id: exc ? 'C' : 'B', nazev: 'Díl B – čelo', pohled: 'pohled na čelo dílu B', w: L, h: p.tloustkaB, t: 60, celo: true,
          diry: xs.map((x) => dira(x, p.tloustkaB / 2, exc ? p.kanD : p.konfPredvrt, hlKan, 'dira', exc ? 'kanálek svorníku' : 'předvrt konfirmátu')),
          ref: { x: 'L', y: 'D', nx: 'přední hrana', ny: 'vnitřní plocha B' } });
        if (p.poloha < p.tloustkaB / 2 - 0.01) v.push('Střed dílu B je níž než polovina jeho tloušťky – díl by přečníval bok.');
        return { dily, info: `${xs.length} × ${exc ? 'excentr Ø ' + p.excD + ' ve vzdálenosti ' + p.excVzd + ' mm' : 'konfirmát ' + p.konfD + ' × ' + p.konfDelka}` };
      },
    },

    vysuvy: {
      nazev: 'Výsuvy zásuvek', ikona: '☰', skupina: 'nabytek',
      popis: 'Řady děr pro kolejnice výsuvů v boku – polohy od přední hrany i úrovně jsou editovatelné.',
      pole: [
        { k: 'vyska', n: 'Výška boku (mm)', min: 50, max: 3000 }, { k: 'hloubka', n: 'Hloubka boku (mm)', min: 50, max: 1500 },
        { k: 'tloustka', n: 'Tloušťka (mm)', min: 6, max: 60, krok: 0.5 },
        { k: 'strana', n: 'Vrtaný bok (pohled zevnitř)', t: 'v', m: STRANA },
        { k: 'xPozice', n: 'Otvory kolejnice od přední hrany (mm, oddělit středníkem)', t: 's' },
        { k: 'predsazeni', n: 'Posun celé kolejnice dozadu (mm, např. vložená dvířka)', min: -100, max: 300, krok: 0.5 },
        { k: 'urovne', n: 'Osy kolejnic nad spodní hranou boku (mm; středník)', t: 's' },
        { k: 'prumer', n: 'Průměr (mm)', min: 1, max: 10, krok: 0.5 }, { k: 'hl', n: 'Hloubka (mm)', min: 1, max: 40, krok: 0.5 },
        { k: 'pasy', n: 'Šablona po řadách (pruh k přední / zadní hraně) místo celého boku', t: 'b' },
        { k: 'protikus', n: 'Přidat zrcadlový protikus (druhý bok)', t: 'b' },
      ],
      vychozi: { pasy: true, vyska: 720, hloubka: 560, tloustka: 18, strana: 'levy', xPozice: '37; 261; 453', predsazeni: 0, urovne: '80; 260; 440', prumer: 5, hl: 12, protikus: true },
      generuj(p, v) {
        const xs = seznamCisel(p.xPozice).map((x) => x + (+p.predsazeni || 0)), ys = seznamCisel(p.urovne);
        if (!xs.length || !ys.length) v.push('Zadejte polohy otvorů a úrovně kolejnic.');
        const diry = [];
        ys.forEach((y, j) => { for (const x of xs) diry.push(dira(x, y, p.prumer, p.hl, 'dira', 'výsuv ' + (j + 1))); });
        if (diry.some((q) => q.x > p.hloubka - q.d / 2 || q.y > p.vyska - q.d / 2)) v.push('Některé otvory leží mimo bok.');
        const levy = p.strana !== 'pravy';
        let dil = { id: 'A', nazev: levy ? 'Levý bok – výsuvy' : 'Pravý bok – výsuvy', pohled: 'pohled na vnitřní plochu boku', w: p.hloubka, h: p.vyska, t: p.tloustka, diry,
          ref: { x: 'L', y: 'D', nx: 'přední hrana', ny: 'spodní hrana' } };
        if (!levy) dil = zrcadliDil(dil, 'x', { zrcadlo: null });
        const dily = [dil];
        if (p.protikus) dily.push(zrcadliDil(dil, 'x', { id: 'B', nazev: (levy ? 'Pravý' : 'Levý') + ' bok – výsuvy (protikus)' }));
        return { dily, info: `${ys.length} kolejnic × ${xs.length} otvorů` };
      },
    },

    /* ---------- zeď ---------- */
    obraz: {
      nazev: 'Obraz na zeď', ikona: '🖼', skupina: 'zed',
      popis: 'Šablona velikosti rámu s místy pro hřebíky / hmoždinky a vodorovnou osou.',
      pole: [
        { k: 'sirka', n: 'Šířka rámu (mm)', min: 50, max: 3000 }, { k: 'vyska', n: 'Výška rámu (mm)', min: 50, max: 3000 },
        { k: 'hacky', n: 'Závěsy', t: 'v', m: [['1', '1 uprostřed'], ['2', '2 vedle sebe']] },
        { k: 'roztecHacku', n: 'Rozteč závěsů (mm)', min: 10, max: 3000, ukaz: (p) => p.hacky === '2' },
        { k: 'odHorni', n: 'Závěs (napnutá šňůra / očko) pod horní hranou (mm)', min: 0, max: 1000 },
        { k: 'rezimVysky', n: 'Výšku určuje', t: 'v', m: [['stred', 'střed obrazu'], ['horni', 'horní hrana'], ['dolni', 'spodní hrana']] },
        { k: 'vyskaOdPodlahy', n: 'Výška od podlahy (mm, střed obrazu obvykle 1450–1550)', min: 0, max: 4000 },
        { k: 'odRohu', n: 'Levá hrana rámu od rohu / zárubně (mm)', min: 0, max: 20000 },
        { k: 'prumer', n: 'Průměr díry (mm, hmoždinka)', min: 1, max: 14, krok: 0.5 }, { k: 'hl', n: 'Hloubka (mm)', min: 0, max: 120 },
        { k: 'celyRam', n: 'Šablona velikosti celého rámu (jinak jen pruh u horní hrany)', t: 'b' },
      ],
      vychozi: { celyRam: false, sirka: 600, vyska: 400, hacky: '2', roztecHacku: 400, odHorni: 60, rezimVysky: 'stred', vyskaOdPodlahy: 1500, odRohu: 800, prumer: 6, hl: 40 },
      generuj(p) {
        const W = p.sirka, H = p.vyska, yh = H - p.odHorni;
        const xs = p.hacky === '2' ? [W / 2 - p.roztecHacku / 2, W / 2 + p.roztecHacku / 2] : [W / 2];
        const podlaha = p.rezimVysky === 'horni' ? p.vyskaOdPodlahy - H : p.rezimVysky === 'dolni' ? p.vyskaOdPodlahy : p.vyskaOdPodlahy - H / 2;
        return {
          dily: [{ id: 'A', nazev: 'Obraz', pohled: p.celyRam ? 'šablona velikosti rámu – přiložit na zeď' : 'pruh u horní hrany rámu – přiložit na zeď', w: W, h: H, t: 20, sablonaCela: p.celyRam, pruhNahore: !p.celyRam, zed: true, podlaha, odRohu: p.odRohu, vodovaha: yh,
            diry: xs.map((x) => dira(x, yh, p.prumer, p.hl, 'zed', 'závěs')), ref: { x: null, y: null }, osy: [{ osa: 'x', hodnota: W / 2, popis: 'osa obrazu' }] }],
          info: `závěsy ${r2(podlaha + yh)} mm nad podlahou, ${xs.map((x) => r2(p.odRohu + x)).join(' a ')} mm od rohu`,
        };
      },
    },

    policka: {
      nazev: 'Polička na konzolách', ikona: '⊓', skupina: 'zed',
      popis: 'Otvory pro konzoly poličky ve stejné výšce, rozteč konzol a otvorů v konzole.',
      pole: [
        { k: 'delka', n: 'Délka poličky (mm)', min: 100, max: 5000 }, { k: 'konzol', n: 'Počet konzol', min: 1, max: 12, krok: 1 },
        { k: 'roztecKonzol', n: 'Rozteč konzol (mm)', min: 20, max: 5000 }, { k: 'otvoru', n: 'Otvorů v konzole (nad sebou)', min: 1, max: 4, krok: 1 },
        { k: 'roztecOtvoru', n: 'Rozteč otvorů v konzole (mm)', min: 5, max: 400, ukaz: (p) => p.otvoru > 1 },
        { k: 'vyskaPolicky', n: 'Horní plocha poličky od podlahy (mm)', min: 0, max: 4000 },
        { k: 'odHorni', n: 'Horní otvor pod horní plochou poličky (mm)', min: 0, max: 500 },
        { k: 'odRohu', n: 'Levý konec poličky od rohu (mm)', min: 0, max: 20000 },
        { k: 'prumer', n: 'Průměr díry (mm)', min: 1, max: 14, krok: 0.5 }, { k: 'hl', n: 'Hloubka (mm)', min: 0, max: 150 },
      ],
      vychozi: { delka: 800, konzol: 2, roztecKonzol: 600, otvoru: 2, roztecOtvoru: 80, vyskaPolicky: 1300, odHorni: 30, odRohu: 600, prumer: 6, hl: 50 },
      generuj(p, v) {
        const n = Math.max(1, Math.round(p.konzol)), m = Math.max(1, Math.round(p.otvoru)), H = Math.max(120, p.odHorni + (m - 1) * p.roztecOtvoru + 60);
        const diry = [];
        for (let i = 0; i < n; i++) {
          const x = p.delka / 2 + (i - (n - 1) / 2) * p.roztecKonzol;
          for (let j = 0; j < m; j++) diry.push(dira(x, H - p.odHorni - j * p.roztecOtvoru, p.prumer, p.hl, 'zed', 'konzola ' + (i + 1)));
        }
        if (n > 1 && (n - 1) * p.roztecKonzol > p.delka) v.push('Konzoly přesahují délku poličky.');
        return {
          dily: [{ id: 'A', nazev: 'Polička – konzoly', pohled: 'pruh zdi pod poličkou', w: p.delka, h: H, t: 20, zed: true, sablonaCela: true, podlaha: p.vyskaPolicky - H, odRohu: p.odRohu,
            vodovaha: H - p.odHorni, diry, ref: { x: null, y: 'H', ny: 'horní plocha poličky' }, osy: [{ osa: 'x', hodnota: p.delka / 2, popis: 'střed poličky' }] }],
          info: `${n} konzol, horní otvory ${r2(p.vyskaPolicky - p.odHorni)} mm nad podlahou`,
        };
      },
    },

    vesa: {
      nazev: 'Držák TV (VESA)', ikona: '▭', skupina: 'zed',
      popis: 'Vzor VESA 75–400 (a 600 × 400), obrys televize, výška středu nad podlahou a otvory držáku do zdi.',
      pole: [
        { k: 'vesa', n: 'Rozteč VESA (mm)', t: 'v', m: VESA.map(([a, b]) => [a + 'x' + b, a + ' × ' + b]) },
        { k: 'uhlopricka', n: 'Úhlopříčka TV (palce, jen pro obrys)', min: 10, max: 120 },
        { k: 'vyskaStredu', n: 'Střed obrazovky nad podlahou (mm)', min: 300, max: 3000 },
        { k: 'posunVesa', n: 'Střed VESA nad středem obrazovky (mm, − = pod)', min: -500, max: 500 },
        { k: 'vzorZdi', n: 'Otvory ve zdi', t: 'v', m: [['vesa', 'stejně jako VESA (rovná deska)'], ['vlastni', 'vlastní rozteč nástěnné desky držáku']] },
        { k: 'zedX', n: 'Rozteč na zdi vodorovně (mm, 0 = jedna řada svisle)', min: 0, max: 1500, ukaz: (p) => p.vzorZdi === 'vlastni' },
        { k: 'zedY', n: 'Rozteč na zdi svisle (mm, 0 = jedna řada vodorovně)', min: 0, max: 1500, ukaz: (p) => p.vzorZdi === 'vlastni' },
        { k: 'posunZdi', n: 'Střed otvorů ve zdi nad středem VESA (mm)', min: -500, max: 500, ukaz: (p) => p.vzorZdi === 'vlastni' },
        { k: 'odRohu', n: 'Střed TV od rohu (mm)', min: 0, max: 20000 },
        { k: 'prumer', n: 'Průměr díry (mm)', min: 4, max: 16, krok: 0.5 }, { k: 'hl', n: 'Hloubka (mm)', min: 0, max: 150 },
      ],
      vychozi: { vesa: '200x200', uhlopricka: 55, vyskaStredu: 1100, posunVesa: 0, vzorZdi: 'vesa', zedX: 0, zedY: 200, posunZdi: 0, odRohu: 1500, prumer: 10, hl: 70 },
      generuj(p, v) {
        const [vx, vy] = String(p.vesa).split('x').map(Number), dg = p.uhlopricka * 25.4;
        const W = dg * 16 / Math.hypot(16, 9), H = dg * 9 / Math.hypot(16, 9), cx = W / 2, cy = H / 2 + p.posunVesa;
        const znacky = [{ x: W / 2, y: H / 2, typ: 'stred', popis: 'střed obrazovky' }];
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) znacky.push({ x: cx + sx * vx / 2, y: cy + sy * vy / 2, typ: 'info', popis: 'VESA (na televizi)' });
        let diry = [];
        if (p.vzorZdi === 'vlastni') {
          const zx = +p.zedX || 0, zy = +p.zedY || 0, yy = cy + p.posunZdi;
          const xs = zx ? [cx - zx / 2, cx + zx / 2] : [cx], ys = zy ? [yy - zy / 2, yy + zy / 2] : [yy];
          for (const y of ys) for (const x of xs) diry.push(dira(x, y, p.prumer, p.hl, 'zed', 'držák'));
        } else for (const q of znacky.slice(1)) diry.push(dira(q.x, q.y, p.prumer, p.hl, 'zed', 'držák (VESA)'));
        if (vx > W - 40 || vy > H - 40) v.push('Rozteč VESA je na tuto úhlopříčku nezvykle velká – ověřte.');
        return {
          dily: [{ id: 'A', nazev: 'Televize ' + p.uhlopricka + '"', pohled: 'pohled na zeď (obrys TV jen orientačně)', w: r2(W), h: r2(H), t: 60, zed: true, podlaha: p.vyskaStredu - H / 2, odRohu: p.odRohu - W / 2,
            vodovaha: diry.length ? diry[0].y : cy, diry, znacky, ref: { x: null, y: null }, osy: [{ osa: 'x', hodnota: W / 2, popis: 'svislá osa TV' }] }],
          info: `VESA ${vx} × ${vy}, obrys TV ${Math.round(W)} × ${Math.round(H)} mm, střed ${p.vyskaStredu} mm nad podlahou`,
        };
      },
    },

    galerie: {
      nazev: 'Galerie obrazů', ikona: '▦', skupina: 'zed',
      popis: 'Rozvržení více obrazů na stěně: mezery, společná osa, vodorovně vyrovnané závěsy, šablona pro každý rám.',
      pole: [
        { k: 'obrazy', n: 'Rámy šířka×výška (mm), oddělit středníkem', t: 's' },
        { k: 'mezera', n: 'Mezera mezi rámy (mm)', min: 0, max: 2000 },
        { k: 'zarovnani', n: 'Zarovnat', t: 'v', m: [['stred', 'středy na společné ose'], ['horni', 'horní hrany'], ['dolni', 'spodní hrany']] },
        { k: 'osa', n: 'Výška osy / hrany nad podlahou (mm)', min: 0, max: 4000 },
        { k: 'sirkaSteny', n: 'Šířka stěny (mm)', min: 300, max: 30000 }, { k: 'vyskaSteny', n: 'Výška stěny (mm)', min: 1000, max: 8000 },
        { k: 'stredSkupiny', n: 'Střed skupiny od levého rohu (mm, 0 = střed stěny)', min: 0, max: 30000 },
        { k: 'hacky', n: 'Závěsy na rám', t: 'v', m: [['1', '1 uprostřed'], ['2', '2 (u krajů)']] },
        { k: 'krajHacku', n: 'Závěs od boční hrany rámu (mm)', min: 5, max: 1000, ukaz: (p) => p.hacky === '2' },
        { k: 'odHorni', n: 'Závěs pod horní hranou rámu (mm)', min: 0, max: 1000 },
        { k: 'prumer', n: 'Průměr díry (mm)', min: 1, max: 14, krok: 0.5 }, { k: 'hl', n: 'Hloubka (mm)', min: 0, max: 120 },
        { k: 'celyRam', n: 'Šablony velikosti celých rámů (jinak pruhy u horních hran)', t: 'b' },
      ],
      vychozi: { celyRam: false, obrazy: '500x700; 400x500; 500x700', mezera: 80, zarovnani: 'stred', osa: 1500, sirkaSteny: 3200, vyskaSteny: 2600, stredSkupiny: 0, hacky: '1', krajHacku: 80, odHorni: 50, prumer: 6, hl: 40 },
      generuj(p, v) {
        const r = seznamRozmeru(p.obrazy);
        if (!r.length) { v.push('Zadejte rozměry rámů, např. 500x700; 400x500.'); return { dily: [], info: '' }; }
        const celkem = r.reduce((s, q) => s + q[0], 0) + (r.length - 1) * p.mezera, hmax = Math.max(...r.map((q) => q[1]));
        const stred = p.stredSkupiny > 0 ? p.stredSkupiny : p.sirkaSteny / 2;
        let x = stred - celkem / 2;
        if (x < 0 || x + celkem > p.sirkaSteny) v.push('Skupina obrazů se nevejde na stěnu.');
        const vsechny = [], dily = [], obrysy = [];
        r.forEach(([w, h], i) => {
          const y0 = p.zarovnani === 'horni' ? p.osa - h : p.zarovnani === 'dolni' ? p.osa : p.osa - h / 2, yh = h - p.odHorni;
          const xs = p.hacky === '2' ? [p.krajHacku, w - p.krajHacku] : [w / 2];
          const d = xs.map((xx) => dira(xx, yh, p.prumer, p.hl, 'zed', 'obraz ' + (i + 1)));
          for (const q of d) vsechny.push(dira(x + q.x, y0 + q.y, q.d, q.hl, 'zed', q.popis));
          obrysy.push({ x0: r2(x), y0: r2(y0), x1: r2(x + w), y1: r2(y0 + h), popis: `${i + 1}: ${w} × ${h}` });
          dily.push({ id: String.fromCharCode(66 + i), nazev: `Obraz ${i + 1} (${w} × ${h})`, pohled: p.celyRam ? 'šablona velikosti rámu' : 'pruh u horní hrany rámu', w, h, t: 20, zed: true, sablonaCela: p.celyRam, pruhNahore: !p.celyRam,
            podlaha: r2(y0), odRohu: r2(x), vodovaha: yh, diry: d, ref: { x: null, y: null }, osy: [{ osa: 'x', hodnota: w / 2, popis: 'osa rámu' }] });
          x += w + p.mezera;
        });
        dily.unshift({ id: 'A', nazev: 'Stěna – rozvržení', pohled: 'pohled na stěnu (měřeno od levého rohu a podlahy)', w: p.sirkaSteny, h: p.vyskaSteny, t: 100, zed: true, prehled: true,
          diry: vsechny, obrysy, ref: { x: 'L', y: 'D', nx: 'levý roh stěny', ny: 'podlaha' }, osy: [{ osa: 'y', hodnota: p.osa, popis: 'osa skupiny' }, { osa: 'x', hodnota: stred, popis: 'střed skupiny' }] });
        void hmax;
        return { dily, info: `${r.length} rámů, šířka skupiny ${r2(celkem)} mm, začíná ${r2(stred - celkem / 2)} mm od rohu` };
      },
    },

    /* ---------- elektro ---------- */
    elektro: {
      nazev: 'Krabice KU 68', ikona: '◎', skupina: 'elektro',
      popis: 'Krabice pod omítku Ø 68 do řady s roztečí 71 mm pro vícenásobné rámečky vypínačů a zásuvek.',
      pole: [
        { k: 'pocet', n: 'Počet krabic v řadě', min: 1, max: 8, krok: 1 },
        { k: 'roztec', n: 'Rozteč (mm, běžně 71)', min: 60, max: 200, krok: 0.5 },
        { k: 'orientace', n: 'Řada', t: 'v', m: [['vodorovne', 'vodorovně'], ['svisle', 'svisle']] },
        { k: 'vyska', n: 'Střed (první) krabice nad hotovou podlahou (mm)', min: 50, max: 3000 },
        { k: 'odRohu', n: 'Střed první krabice od rohu / zárubně (mm)', min: 40, max: 10000 },
        { k: 'prumer', n: 'Průměr korunky (mm)', min: 40, max: 100, krok: 0.5 }, { k: 'hl', n: 'Hloubka (mm)', min: 10, max: 100 },
        { k: 'ramecek', n: 'Orientační obrys rámečku (mm na pozici)', min: 0, max: 120 },
      ],
      vychozi: { pocet: 2, roztec: 71, orientace: 'vodorovne', vyska: 300, odRohu: 150, prumer: 68, hl: 45, ramecek: 80 },
      generuj(p, v) {
        const n = Math.max(1, Math.round(p.pocet)), svisle = p.orientace === 'svisle';
        const W = p.odRohu + (svisle ? 0 : (n - 1) * p.roztec) + 250, H = p.vyska + (svisle ? (n - 1) * p.roztec : 0) + 250;
        const diry = [];
        for (let i = 0; i < n; i++) diry.push(dira(p.odRohu + (svisle ? 0 : i * p.roztec), p.vyska + (svisle ? i * p.roztec : 0), p.prumer, p.hl, 'krabice', 'krabice ' + (i + 1)));
        const obrysy = [];
        if (p.ramecek > 0) {
          const h = p.ramecek / 2, a = diry[0], b = diry[n - 1];
          obrysy.push({ x0: a.x - h, y0: a.y - h, x1: b.x + h, y1: b.y + h, popis: 'orientační obrys rámečku', carkovane: true });
        }
        if (p.roztec < p.prumer + 2) v.push('Rozteč je menší než průměr krabice + 2 mm – krabice se nevejdou vedle sebe.');
        if (p.odRohu < p.prumer / 2 + 20) v.push('Krabice je příliš blízko rohu / zárubně.');
        return {
          dily: [{ id: 'A', nazev: n > 1 ? `Řada ${n} krabic KU 68` : 'Krabice KU 68', pohled: 'pohled na zeď', w: W, h: H, t: 150, zed: true, podlaha: 0, odRohu: 0,
            vodovaha: svisle ? null : p.vyska, diry, obrysy, ref: { x: 'L', y: 'D', nx: 'roh / zárubeň', ny: 'hotová podlaha' },
            osy: svisle ? [{ osa: 'x', hodnota: p.odRohu, popis: 'svislá osa' }] : [] }],
          info: `${n} × Ø ${p.prumer}, rozteč ${p.roztec} mm, střed ${p.vyska} mm nad podlahou`,
        };
      },
    },

    /* ---------- obecné ---------- */
    pcd: {
      nazev: 'Roztečná kružnice', ikona: '⚙', skupina: 'obecne',
      popis: 'Díry na roztečné kružnici (PCD) – příruby, ráfky, víka, kruhová pole.',
      pole: [
        { k: 'preset', n: 'Předvolba', t: 'v', m: PCD_PRESETY.map((q) => [q.id, q.nazev]) },
        { k: 'pocet', n: 'Počet děr', min: 1, max: 72, krok: 1 }, { k: 'D', n: 'Průměr roztečné kružnice (mm)', min: 1, max: 3000, krok: 0.1 },
        { k: 'prumer', n: 'Průměr děr (mm)', min: 0.5, max: 200, krok: 0.1 }, { k: 'uhel', n: 'První díra od svislé osy (°, ve směru hod. ručiček)', min: -360, max: 360, krok: 0.5 },
        { k: 'vnejsi', n: 'Vnější průměr dílu (mm)', min: 2, max: 4000, krok: 0.5 }, { k: 'stred', n: 'Středový otvor Ø (mm, 0 = žádný)', min: 0, max: 3000, krok: 0.5 },
        { k: 'tloustka', n: 'Tloušťka dílu (mm)', min: 0.5, max: 200, krok: 0.5 }, { k: 'hl', n: 'Hloubka (0 = skrz)', min: 0, max: 200, krok: 0.5 },
      ],
      vychozi: { preset: '', pocet: 6, D: 100, prumer: 9, uhel: 0, vnejsi: 140, stred: 40, tloustka: 10, hl: 0 },
      generuj(p, v) {
        const R0 = p.vnejsi / 2, n = Math.max(1, Math.round(p.pocet));
        const diry = pcdBody(n, p.D, p.uhel, R0, R0).map(([x, y], i) => dira(x, y, p.prumer, p.hl, 'dira', 'PCD ' + (i + 1)));
        if (p.stred > 0) diry.push(dira(R0, R0, p.stred, p.hl, 'stred', 'středový otvor'));
        if (p.D / 2 + p.prumer / 2 > R0 - 1) v.push('Díry zasahují k vnějšímu okraji dílu.');
        if (n > 1 && p.D * Math.sin(Math.PI / n) < p.prumer + 1) v.push('Díry na kružnici se navzájem překrývají.');
        if (p.stred > 0 && p.stred / 2 > p.D / 2 - p.prumer / 2 - 1) v.push('Středový otvor zasahuje do děr na kružnici.');
        return {
          dily: [{ id: 'A', nazev: `Příruba ${n} × Ø ${p.prumer} na Ø ${p.D}`, pohled: 'pohled shora', w: p.vnejsi, h: p.vnejsi, t: p.tloustka, kruh: true, pcd: { D: p.D, cx: R0, cy: R0, uhel: p.uhel },
            diry, ref: { x: null, y: null, stred: true }, osy: [{ osa: 'x', hodnota: R0, popis: '' }, { osa: 'y', hodnota: R0, popis: '' }] }],
          info: `${n} děr, úhel mezi nimi ${r2(360 / n)}°, tětiva ${r2(p.D * Math.sin(Math.PI / n))} mm`,
        };
      },
    },

    mrizka: {
      nazev: 'Mřížka / pole děr', ikona: '⣿', skupina: 'obecne',
      popis: 'Pravidelné pole děr v řádcích a sloupcích, volitelně s posunutými řadami.',
      pole: [
        { k: 'sirka', n: 'Šířka desky (mm)', min: 5, max: 3000 }, { k: 'vyska', n: 'Výška desky (mm)', min: 5, max: 3000 },
        { k: 'tloustka', n: 'Tloušťka (mm)', min: 0.5, max: 200, krok: 0.5 },
        { k: 'sloupce', n: 'Sloupců', min: 1, max: 200, krok: 1 }, { k: 'radky', n: 'Řádků', min: 1, max: 200, krok: 1 },
        { k: 'roztecX', n: 'Rozteč vodorovně (mm)', min: 0.5, max: 2000, krok: 0.5 }, { k: 'roztecY', n: 'Rozteč svisle (mm)', min: 0.5, max: 2000, krok: 0.5 },
        { k: 'odsazeniX', n: 'První sloupec od levé hrany (mm)', min: 0, max: 3000, krok: 0.5 }, { k: 'odsazeniY', n: 'První řádek od spodní hrany (mm)', min: 0, max: 3000, krok: 0.5 },
        { k: 'vystredit', n: 'Vystředit pole na desce', t: 'b' },
        { k: 'posunRad', n: 'Každý druhý řádek posunout o půl rozteče', t: 'b' },
        { k: 'prumer', n: 'Průměr (mm)', min: 0.5, max: 200, krok: 0.1 }, { k: 'hl', n: 'Hloubka (0 = skrz)', min: 0, max: 200, krok: 0.5 },
      ],
      vychozi: { sirka: 200, vyska: 150, tloustka: 18, sloupce: 5, radky: 4, roztecX: 32, roztecY: 32, odsazeniX: 20, odsazeniY: 20, vystredit: true, posunRad: false, prumer: 5, hl: 10 },
      generuj(p, v) {
        const nx = Math.max(1, Math.round(p.sloupce)), ny = Math.max(1, Math.round(p.radky));
        const sx = (nx - 1) * p.roztecX + (p.posunRad && ny > 1 ? p.roztecX / 2 : 0), sy = (ny - 1) * p.roztecY;
        const x0 = p.vystredit ? (p.sirka - sx) / 2 : p.odsazeniX, y0 = p.vystredit ? (p.vyska - sy) / 2 : p.odsazeniY;
        const diry = [];
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) diry.push(dira(x0 + i * p.roztecX + (p.posunRad && j % 2 ? p.roztecX / 2 : 0), y0 + j * p.roztecY, p.prumer, p.hl, 'dira', `ř${j + 1} s${i + 1}`));
        if (diry.some((q) => q.x - q.d / 2 < 0 || q.y - q.d / 2 < 0 || q.x + q.d / 2 > p.sirka || q.y + q.d / 2 > p.vyska)) v.push('Pole děr přesahuje desku.');
        if (p.roztecX < p.prumer || p.roztecY < p.prumer) v.push('Rozteč je menší než průměr – díry se překrývají.');
        return { dily: [{ id: 'A', nazev: `Pole ${nx} × ${ny}`, pohled: 'pohled na plochu', w: p.sirka, h: p.vyska, t: p.tloustka, diry, ref: { x: 'L', y: 'D', nx: 'levá hrana', ny: 'spodní hrana' } }], info: `${nx * ny} děr` };
      },
    },

    vlastni: {
      nazev: 'Vlastní body', ikona: '✚', skupina: 'obecne',
      popis: 'Díry zadané ručně v tabulce, klikem do náhledu nebo importem CSV / DXF.',
      pole: [
        { k: 'sirka', n: 'Šířka desky (mm)', min: 5, max: 5000 }, { k: 'vyska', n: 'Výška desky (mm)', min: 5, max: 5000 },
        { k: 'tloustka', n: 'Tloušťka (mm)', min: 0.5, max: 300, krok: 0.5 },
        { k: 'refX', n: 'Referenční hrana vodorovně', t: 'v', m: [['L', 'levá'], ['P', 'pravá'], ['', 'žádná']] },
        { k: 'refY', n: 'Referenční hrana svisle', t: 'v', m: [['D', 'spodní'], ['H', 'horní'], ['', 'žádná']] },
        { k: 'prumer', n: 'Průměr nových děr (mm)', min: 0.5, max: 200, krok: 0.1 }, { k: 'hl', n: 'Hloubka nových děr (0 = skrz)', min: 0, max: 200, krok: 0.5 },
        { k: 'mrizkaKliku', n: 'Přichytávat klik na mřížku (mm, 0 = ne)', min: 0, max: 100, krok: 0.5 },
        { k: 'body', t: 'body' },
      ],
      vychozi: { sirka: 300, vyska: 200, tloustka: 18, refX: 'L', refY: 'D', prumer: 5, hl: 10, mrizkaKliku: 1, body: [{ x: 50, y: 50, d: 8, hl: 12, popis: '' }, { x: 250, y: 50, d: 8, hl: 12, popis: '' }, { x: 150, y: 150, d: 35, hl: 12.5, popis: 'miska' }] },
      generuj(p, v) {
        const body = Array.isArray(p.body) ? p.body : [];
        const diry = body.map((q) => dira(cislo(q.x, 0), cislo(q.y, 0), Math.max(0.1, cislo(q.d, p.prumer)), cislo(q.hl, p.hl), 'dira', q.popis || ''));
        if (!diry.length) v.push('Zatím žádné díry – klikněte do náhledu nebo je přidejte v tabulce.');
        if (diry.some((q) => q.x < 0 || q.y < 0 || q.x > p.sirka || q.y > p.vyska)) v.push('Některé díry leží mimo desku.');
        const nazvy = { L: 'levá hrana', P: 'pravá hrana', D: 'spodní hrana', H: 'horní hrana' };
        return { dily: [{ id: 'A', nazev: 'Deska', pohled: 'pohled na plochu', w: p.sirka, h: p.vyska, t: p.tloustka, diry, ref: { x: p.refX || null, y: p.refY || null, nx: nazvy[p.refX], ny: nazvy[p.refY] } }], info: `${diry.length} děr` };
      },
    },
  };
  const SKUPINY = [['nabytek', 'Nábytek'], ['zed', 'Zeď'], ['elektro', 'Elektro'], ['obecne', 'Obecné']];

  /* ---------------- šablona: oblast, chlopně, nastavení ---------------- */
  const NASTAVENI = {
    okrajSablony: 15, chlopen: 12, dosahRef: 150, popisy: 'vse', koty: true,
    papir: 'a4', papirW: 210, papirH: 297, okraj: 8, prekryv: 15, kalibX: 100, kalibY: 100,
    // STL
    stlTl: 6, dorazV: 10, dorazS: 6, otvor: 'vule', vule: 0.3, pouzdroD: 8, pouzdroPres: 0.1, pouzdroDo: 12, vedeni: 0, vedeniStena: 3,
    oznaceni: true, krouzekStena: 4, krouzekV: 10, srouubek: 3, stul: 220, par: false,
  };

  /** projekt = { rezim, p: {rezim: parametry}, nast } */
  function vychoziProjekt(rezim) {
    const p = {};
    for (const [k, R] of Object.entries(REZIMY)) p[k] = JSON.parse(JSON.stringify(R.vychozi));
    return { verze: 1, nazev: '', rezim: rezim || 'police32', p, nast: Object.assign({}, NASTAVENI) };
  }
  /** doplní chybějící hodnoty a převede čísla */
  function normalizuj(rezim, p) {
    const R = REZIMY[rezim], o = Object.assign({}, R.vychozi, p || {});
    for (const f of R.pole) {
      if (!f.k || f.t === 'body') continue;
      if (f.t === 'b') o[f.k] = !!o[f.k];
      else if (f.t === 'v' || f.t === 's') o[f.k] = o[f.k] == null ? R.vychozi[f.k] : String(o[f.k]);
      else {
        let x = cislo(o[f.k], R.vychozi[f.k]);
        if (f.min != null) x = Math.max(f.min, x);
        if (f.max != null) x = Math.min(f.max, x);
        o[f.k] = x;
      }
    }
    return o;
  }

  function navrh(projekt) {
    const rezim = REZIMY[projekt.rezim] ? projekt.rezim : 'police32', R = REZIMY[rezim];
    const p = normalizuj(rezim, projekt.p && projekt.p[rezim]);
    if (rezim === 'pcd' && p.preset) {
      const q = PCD_PRESETY.find((x) => x.id === p.preset);
      if (q && q.n) { p.pocet = q.n; p.D = q.D; if (q.d) p.prumer = q.d; if (q.vnejsi) p.vnejsi = q.vnejsi; if (q.stred != null) p.stred = q.stred; }
    }
    const varovani = [];
    const g = R.generuj(p, varovani);
    const nast = Object.assign({}, NASTAVENI, projekt.nast || {});
    for (const dil of g.dily) {
      // obecné kontroly
      for (const q of dil.diry) {
        if (q.hl > 0 && dil.t && !dil.zed && !dil.celo && q.hl > dil.t - 2) { varovani.push(`${dil.nazev}: díra Ø ${q.d} hloubky ${q.hl} mm v desce ${dil.t} mm – hrozí provrtání (zbývá < 2 mm).`); break; }
      }
      const pr = prekryvy(dil.diry);
      if (pr) varovani.push(`${dil.nazev}: ${pr} ${pr === 1 ? 'dvojice děr se překrývá' : 'dvojic děr se překrývá'}.`);
      dil.oblast = oblastSablony(dil, nast);
    }
    return { rezim, p, dily: g.dily, varovani, info: g.info || '', nast };
  }
  function prekryvy(diry) {
    let n = 0;
    if (diry.length > 600) return 0;
    for (let i = 0; i < diry.length; i++) for (let j = i + 1; j < diry.length; j++) {
      const a = diry[i], b = diry[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < (a.d + b.d) / 2 - 1e-6 && !(a.typ === 'stred' || b.typ === 'stred')) {
        // díra uvnitř jiné (předvrt v misce) se nepočítá jako chyba
        if (Math.hypot(a.x - b.x, a.y - b.y) + Math.min(a.d, b.d) / 2 > Math.max(a.d, b.d) / 2) n++;
      }
    }
    return n;
  }

  /**
   * Oblast šablony v souřadnicích dílu: obdélník kolem děr (okraj), protažený k referenčním hranám,
   * pokud jsou blíž než dosahRef; papír = oblast + chlopně za referenčními hranami.
   */
  function oblastSablony(dil, nast) {
    const n = Object.assign({}, NASTAVENI, nast || {}), m = +n.okrajSablony;
    if (dil.kruh) return { x0: 0, y0: 0, x1: dil.w, y1: dil.h, kruh: true, hrany: [], papir: { x0: -m * 0.5, y0: -m * 0.5, x1: dil.w + m * 0.5, y1: dil.h + m * 0.5 } };
    let x0, y0, x1, y1;
    if (dil.sablonaCela || dil.prehled) { x0 = 0; y0 = 0; x1 = dil.w; y1 = dil.h; }
    else if (dil.pruhNahore) {
      x0 = 0; x1 = dil.w; y1 = dil.h;
      y0 = Math.max(0, Math.min(dil.h - 20, ...dil.diry.map((q) => q.y - q.d / 2 - 6)) - m);
    }
    else {
      x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
      const body = dil.diry.map((q) => [q.x, q.y, q.d / 2 + 6]).concat((dil.znacky || []).map((q) => [q.x, q.y, 8]));
      for (const o of dil.obrysy || []) body.push([o.x0, o.y0, 0], [o.x1, o.y1, 0]);
      for (const [x, y, r] of body) { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); }
      if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = Math.min(dil.w, 100); y1 = Math.min(dil.h, 100); }
      x0 -= m; y0 -= m; x1 += m; y1 += m;
      if (!dil.zed) { x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(dil.w, x1); y1 = Math.min(dil.h, y1); }
      if (dil.celo) { y0 = 0; y1 = dil.h; }
    }
    const hrany = [], d = +n.dosahRef;
    const rx = dil.ref && dil.ref.x, ry = dil.ref && dil.ref.y;
    if (rx === 'L' && x0 <= d) { x0 = 0; hrany.push('L'); }
    if (rx === 'P' && dil.w - x1 <= d) { x1 = dil.w; hrany.push('P'); }
    if (ry === 'D' && y0 <= d) { y0 = 0; hrany.push('D'); }
    if (ry === 'H' && dil.h - y1 <= d) { y1 = dil.h; hrany.push('H'); }
    if (dil.celo) { if (!hrany.includes('D')) hrany.push('D'); hrany.push('H'); }
    if (dil.prehled || dil.sablonaCela || dil.pruhNahore) hrany.length = 0;
    const c = dil.prehled ? 0 : +n.chlopen;
    const papir = { x0: x0 - (hrany.includes('L') ? c : 0), y0: y0 - (hrany.includes('D') ? c : 0), x1: x1 + (hrany.includes('P') ? c : 0), y1: y1 + (hrany.includes('H') ? c : 0) };
    return { x0: r2(x0), y0: r2(y0), x1: r2(x1), y1: r2(y1), hrany, papir };
  }

  /** vzdálenost díry od referenčních hran dílu (nebo od rohu/podlahy u zdi) */
  function odRef(dil, q) {
    const rx = dil.ref && dil.ref.x, ry = dil.ref && dil.ref.y;
    let dx = rx === 'P' ? dil.w - q.x : q.x, dy = ry === 'H' ? dil.h - q.y : q.y;
    if (dil.ref && dil.ref.stred && dil.pcd) { dx = q.x - dil.pcd.cx; dy = q.y - dil.pcd.cy; }
    return { dx: r2(dx), dy: r2(dy), podlaha: dil.podlaha != null ? r2(dil.podlaha + q.y) : null, roh: dil.odRohu != null ? r2(dil.odRohu + q.x) : null };
  }

  /* ---------------- kalibrace a tisk ---------------- */
  const mmNaPt = (mm) => mm * 72 / 25.4;
  /** naměřené délky kontrolních úseček (nominál 100 mm) → korekční součinitele kx, ky */
  function korekceMeritka(namerenoX, namerenoY, nominal) {
    const N = nominal || 100, mx = cislo(namerenoX, N), my = cislo(namerenoY, N);
    const k = (m) => (m > N * 0.8 && m < N * 1.2 ? N / m : 1);
    return { kx: k(mx), ky: k(my), platne: mx > N * 0.8 && mx < N * 1.2 && my > N * 0.8 && my < N * 1.2 };
  }
  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };
  function rozmerPapiru(n) {
    if (n.papir === 'vlastni') return [Math.max(80, cislo(n.papirW, 210)), Math.max(80, cislo(n.papirH, 297))];
    return PAPIRY[n.papir] || PAPIRY.a4;
  }
  const PATA = 17, PRAVY_PAS = 13;
  /**
   * Rozvrh listů pro oblast (model mm, y nahoru) na papír pw × ph; korekce kx, ky.
   * Přesah g ≥ max(prekryv, největší Ø + 8): každá díra s křížem se celá vejde na některý list.
   * Vrací {W, H, uw, uh (mm papíru), uwM, uhM (mm modelu), nx, ny, g, listy: [{x0, y0, x1, y1, r, c}]}.
   */
  function rozvrhListu(obl, pw, ph, nast, maxD) {
    const n = Object.assign({}, NASTAVENI, nast || {}), K = korekceMeritka(n.kalibX, n.kalibY), ok = +n.okraj;
    const sw = obl.x1 - obl.x0, sh = obl.y1 - obl.y0;
    const varianta = (W, H) => {
      const uw = W - 2 * ok - PRAVY_PAS, uh = H - 2 * ok - PATA, uwM = uw / K.kx, uhM = uh / K.ky;
      if (sw <= uwM + 1e-6 && sh <= uhM + 1e-6) return { W, H, uw, uh, uwM, uhM, nx: 1, ny: 1, g: 0, jeden: true };
      const g = Math.min(Math.max(+n.prekryv || 0, (maxD || 0) + 8), uwM * 0.45, uhM * 0.45);
      const nx = sw <= uwM + 1e-6 ? 1 : Math.ceil((sw - g) / (uwM - g) - 1e-9), ny = sh <= uhM + 1e-6 ? 1 : Math.ceil((sh - g) / (uhM - g) - 1e-9);
      return { W, H, uw, uh, uwM, uhM, nx, ny, g, jeden: false };
    };
    const a = varianta(pw, ph), b = varianta(ph, pw);
    const v = b.nx * b.ny < a.nx * a.ny ? b : a;
    const listy = [];
    const cw = v.nx === 1 ? v.uwM : v.nx * (v.uwM - v.g) + v.g, chh = v.ny === 1 ? v.uhM : v.ny * (v.uhM - v.g) + v.g;
    const ox = obl.x0 - (cw - sw) / 2, top = obl.y1 + (chh - sh) / 2;
    for (let r = 0; r < v.ny; r++) for (let c = 0; c < v.nx; c++) {
      const x0 = ox + c * (v.uwM - v.g), y1 = top - r * (v.uhM - v.g);
      listy.push({ x0, x1: x0 + v.uwM, y0: y1 - v.uhM, y1, r, c });
    }
    return Object.assign(v, { listy, kx: K.kx, ky: K.ky });
  }

  /** nastavení hloubkového kroužku: vzdálenost od špičky vrtáku ke spodní ploše kroužku */
  function nastaveniKrouzku(q, nast, papirove) {
    const n = Object.assign({}, NASTAVENI, nast || {});
    if (!q.hl) return null;
    const nad = papirove ? 0 : (+n.stlTl || 0) + (+n.vedeni || 0);
    return r2(q.hl + nad);
  }
  /** průměr otvoru v přípravku pro vrták d */
  function otvorPripravku(d, nast) {
    const n = Object.assign({}, NASTAVENI, nast || {});
    if (n.otvor === 'pouzdro' && d <= (+n.pouzdroDo || 12)) return { d: r2(+n.pouzdroD - (+n.pouzdroPres || 0)), pouzdro: true };
    return { d: r2(d + (+n.vule || 0)), pouzdro: false };
  }

  /* ---------------- import bodů ---------------- */
  /** CSV/TXT: řádky „x;y[;d[;hloubka[;popis]]]“ (oddělovač ; , tab mezera; desetinná čárka jen se středníkem/tabem) */
  function importCSV(text, vych) {
    const v = Object.assign({ d: 5, hl: 0 }, vych || {}), out = [];
    for (const raw of String(text).split(/\r?\n/)) {
      const r = raw.trim();
      if (!r || /^[#/]/.test(r)) continue;
      const sep = r.includes(';') ? ';' : r.includes('\t') ? '\t' : r.includes(',') ? ',' : /\s+/;
      const c = r.split(sep).map((s) => s.trim());
      const num = (s) => { const x = parseFloat(String(s == null ? '' : s).replace(',', '.')); return isFinite(x) ? x : null; };
      const x = num(c[0]), y = num(c[1]);
      if (x == null || y == null) continue;                      // hlavička
      out.push({ x, y, d: num(c[2]) != null ? num(c[2]) : v.d, hl: num(c[3]) != null ? num(c[3]) : v.hl, popis: c.slice(4).join(' ') || '' });
    }
    return out;
  }
  /** DXF: CIRCLE → díra (Ø = 2r), POINT → díra s výchozím Ø; posune tak, aby minimum bylo v okraji */
  function importDXF(text, vych) {
    const v = Object.assign({ d: 5, hl: 0 }, vych || {});
    const L = String(text).split(/\r?\n/).map((s) => s.trim());
    const out = [];
    let i = 0, vEntitach = false;
    while (i < L.length - 1) {
      const kod = L[i], hod = L[i + 1];
      if (kod === '2' && hod === 'ENTITIES') vEntitach = true;
      if (kod === '0' && hod === 'ENDSEC') vEntitach = false;
      if (vEntitach && kod === '0' && (hod === 'CIRCLE' || hod === 'POINT')) {
        const typ = hod, e = {};
        i += 2;
        while (i < L.length - 1 && L[i] !== '0') { e[L[i]] = parseFloat(L[i + 1]); i += 2; }
        if (isFinite(e['10']) && isFinite(e['20'])) out.push({ x: e['10'], y: e['20'], d: typ === 'CIRCLE' && isFinite(e['40']) ? r2(e['40'] * 2) : v.d, hl: v.hl, popis: typ === 'CIRCLE' ? '' : 'bod' });
        continue;
      }
      i += 2;
    }
    return out;
  }

  const API = {
    REZIMY, SKUPINY, NASTAVENI, PCD_PRESETY, VESA, ROZTECE_UCHYTEK, NAZEV_HRANY, PAPIRY, PATA, PRAVY_PAS,
    vychoziProjekt, normalizuj, navrh, zrcadliDil, oblastSablony, odRef, pcdBody, rozloz, seznamCisel, seznamRozmeru,
    korekceMeritka, mmNaPt, rozmerPapiru, rozvrhListu, nastaveniKrouzku, otvorPripravku, importCSV, importDXF, r2,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.VS = API;
})(typeof window !== 'undefined' ? window : globalThis);
