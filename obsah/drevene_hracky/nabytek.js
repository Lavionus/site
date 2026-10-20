/* ============================================================
   Dětský nábytek – učící věž / schůdky, stoleček a židlička podle výšky dítěte, skříňka / truhla na hračky
   Souřadnice: x šířka (zleva), y hloubka (0 = přední hrana), z nahoru. Mm, kg, N.
   ============================================================ */
(function (koren) {
  'use strict';
  const DH = koren.DH || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const { cz, r1 } = DH;
  const G = DH.G;

  const vyskaDitete = (p, spol) => (p.vyskaDitete > 0 ? p.vyskaDitete : Math.round(DH.vyskaZVeku(+spol.vek)));
  const box = (N, nazev, x, y, z, sx, sy, sz, barva, sklad) => { const t = { typ: 'box', x, y, z, sx, sy, sz, barva: barva || '#d9b98a', sklad: sklad || 0, nazev }; N.telesa.push(t); return t; };
  /** díl k řezání z obdélníku (s otvory) */
  const dilObd = (N, id, nazev, ks, w, h, tl, mat, poz, navic) => {
    const d = Object.assign({ id, nazev, ks, tl, mat, obrysy: [{ b: DH.zaoblenyObd(0, 0, w, h, navic && navic.r != null ? navic.r : 0), typ: 'rez' }], kruhy: [], texty: [], poznamka: '' }, navic || {});
    if (navic && navic.otvory) d.obrysy.push(...navic.otvory.map((b) => ({ b, typ: 'otvor' })));
    N.dily.push(d);
    return d;
  };
  /** tabulka stability z případů */
  function vyhodnotStabilitu(N, pripady, opora) {
    const radky = [];
    let nejhorsi = Infinity;
    for (const c of pripady) {
      const s = DH.stabilita(c.hmoty, opora, c.sila);
      const b = s.bezpecnost;
      const stav = !s.vPolygonu ? 'chyba' : b != null ? (b < 1 ? 'chyba' : b < 1.5 ? 'pozor' : 'ok') : 'ok';
      if (b != null) nejhorsi = Math.min(nejhorsi, b); else if (!s.vPolygonu) nejhorsi = 0;
      radky.push([c.nazev, `${cz(s.cog.m, 1)} kg`, `${cz(s.cog.z, 0)} mm`, `${cz(s.rezerva, 0)} mm`, `${cz(s.uhel, 0)}°`, c.sila ? `${cz(c.sila.F, 0)} N / ${cz(c.sila.F * (b || 0), 0)} N` : '–', b != null ? cz(b, 2) : (s.vPolygonu ? 'stojí' : 'PŘEVRHNE'), stav]);
      c.vysledek = s;
      if (stav !== 'ok') N.bezpecnost.push({ u: stav, t: `Stabilita – ${c.nazev}: ${!s.vPolygonu ? 'těžiště leží mimo opěrný polygon, PŘEVRHNE SE' : `bezpečnost ${cz(b, 2)} (síla k převržení ${cz(c.sila.F * b, 0)} N proti předpokladu ${cz(c.sila.F, 0)} N)`}. ${c.rada || ''}` });
    }
    N.tabulky.push({ nadpis: 'Stabilita proti převržení (těžiště vs. opěrný polygon)', hlavicka: ['případ', 'hmotnost', 'těžiště z', 'rezerva', 'úhel', 'síla / k převržení', 'bezpečnost', 'stav'], radky });
    if (nejhorsi >= 1.5) N.bezpecnost.push({ u: 'ok', t: `Stabilita: ve všech případech bezpečnost ≥ 1,5 (nejmenší ${isFinite(nejhorsi) ? cz(nejhorsi, 2) : '–'}).` });
    N.stabilitaPripady = pripady;
    return nejhorsi;
  }
  DH.vyhodnotStabilitu = vyhodnotStabilitu;

  /* ============================================================
     5a) UČÍCÍ VĚŽ / SCHŮDKY
     ============================================================ */
  DH.GEN.vez = {
    nazev: 'Učící věž / schůdky', ikona: '🪜', typ: 'nabytek',
    popis: 'Zjednodušená učící věž (learning tower) k lince nebo schůdky: výška plošiny podle dítěte, zábradlí, výpočet převržení.',
    pole: [
      { sk: 'Dítě a linka' },
      { k: 'typ', n: 'Výrobek', t: 'v', m: [['vez', 'učící věž (plošina + zábradlí)'], ['schudky', 'schůdky – 2 stupně']] },
      { k: 'vyskaDitete', n: 'Výška dítěte (mm, 0 = podle věku)', t: 'n', min: 0, max: 1600, krok: 10 },
      { k: 'linka', n: 'Výška pracovní desky linky (mm)', t: 'n', min: 600, max: 1100, krok: 5, ukaz: (p) => p.typ === 'vez' },
      { k: 'plosina', n: 'Výška plošiny (mm, 0 = výpočet)', t: 'n', min: 0, max: 700, krok: 5 },
      { k: 'pozic', n: 'Počet nastavitelných poloh plošiny', t: 'n', min: 1, max: 6, krok: 1, ukaz: (p) => p.typ === 'vez' },
      { k: 'krokPozic', n: 'Krok poloh (mm)', t: 'n', min: 30, max: 150, krok: 5, ukaz: (p) => p.typ === 'vez' && p.pozic > 1 },
      { k: 'zabradli', n: 'Zábradlí nad plošinou (mm, 0 = výpočet)', t: 'n', min: 0, max: 900, krok: 10, ukaz: (p) => p.typ === 'vez' },
      { sk: 'Konstrukce' },
      { k: 'W', n: 'Šířka vnější (mm)', t: 'n', min: 300, max: 800, krok: 5 },
      { k: 'Db', n: 'Hloubka dole (mm)', t: 'n', min: 250, max: 900, krok: 5 },
      { k: 'Dt', n: 'Hloubka nahoře (mm)', t: 'n', min: 150, max: 900, krok: 5, ukaz: (p) => p.typ === 'vez' },
      { k: 't', n: 'Tloušťka desek (mm)', t: 'n', min: 12, max: 40, krok: 1 },
      { k: 'pricka', n: 'Ø příček zábradlí (mm)', t: 'n', min: 20, max: 45, krok: 1, ukaz: (p) => p.typ === 'vez' },
      { k: 'sila', n: 'Síla opření / zatáhnutí (N, 0 = 20 % váhy dítěte)', t: 'n', min: 0, max: 500, krok: 5 },
    ],
    vychozi: { typ: 'vez', vyskaDitete: 0, linka: 900, plosina: 0, pozic: 3, krokPozic: 60, zabradli: 0, W: 450, Db: 520, Dt: 400, t: 18, pricka: 28, sila: 0 },
    predvolby: [
      { id: 'vez', nazev: 'Učící věž k lince 90 cm', p: {} },
      { id: 'vez85', nazev: 'Věž – linka 85 cm, dítě 95 cm', p: { linka: 850, vyskaDitete: 950 } },
      { id: 'schudky', nazev: 'Schůdky k umyvadlu', p: { typ: 'schudky', plosina: 300, W: 440, Db: 460 } },
    ],
    vypocet(p, spol) {
      const N = { typ: 'nabytek', dily: [], telesa: [], kusovnik: [], bezpecnost: [], info: [], varovani: [], koty: [], tabulky: [], stl: [], male: [] };
      const S = vyskaDitete(p, spol), m = DH.hmotnostZVysky(S), E = DH.ergonomie(S), t = p.t, W = p.W, mat = (DH.MATERIALY[spol.material] || {}).nazev;
      const ro = DH.hustota(spol.material);
      p = Object.assign({}, p, { sila: p.sila > 0 ? p.sila : Math.round(0.2 * m * G) });
      N.info.push(`Předpokládaná vodorovná síla dítěte (opření, zatáhnutí) ${cz(p.sila, 0)} N.`);
      let poz = 1;
      if (p.typ === 'schudky') {
        const H = p.plosina > 0 ? p.plosina : Math.round(Math.min(350, 0.28 * S) / 5) * 5, h1 = H / 2, D = p.Db, d1 = D / 2;
        // bočnice: schodovitý profil (y, z)
        const bok = [[0, 0], [D, 0], [D, H], [d1, H], [d1, h1], [0, h1]];
        const zbok = DH.zaobli([bok], 0, 0)[0] || bok;
        N.telesa.push({ typ: 'extr', rovina: 'yz', b: zbok, tl: t, x: 0, y: 0, z: 0, barva: '#d9b98a', sklad: 0 });
        N.telesa.push({ typ: 'extr', rovina: 'yz', b: zbok, tl: t, x: W - t, y: 0, z: 0, barva: '#d9b98a', sklad: 0 });
        box(N, 'stupeň 1', t, 0, h1 - t, W - 2 * t, d1 + 10, t, '#e6c896', 1);
        box(N, 'stupeň 2', t, d1, H - t, W - 2 * t, D - d1, t, '#e6c896', 2);
        box(N, 'čelo 1', t, 10, h1 - t - 80, W - 2 * t, t, 80, '#c99a62', 1);
        box(N, 'čelo 2', t, d1 + 10, H - t - 80, W - 2 * t, t, 80, '#c99a62', 2);
        box(N, 'záda', t, D - t, H * 0.25, W - 2 * t, t, H * 0.5, '#c99a62', 3);
        N.dily.push({ id: 'A', nazev: 'bočnice', ks: 2, tl: t, mat: spol.material, obrysy: [{ b: zbok, typ: 'rez' }], kruhy: [], texty: [] });
        dilObd(N, 'B', 'stupeň 1', 1, W - 2 * t, d1 + 10, t, spol.material, poz, { r: 3 });
        dilObd(N, 'C', 'stupeň 2', 1, W - 2 * t, D - d1, t, spol.material, poz, { r: 3 });
        dilObd(N, 'D', 'čelo pod stupněm', 2, W - 2 * t, 80, t, spol.material);
        dilObd(N, 'E', 'zadní vzpěra', 1, W - 2 * t, H * 0.5, t, spol.material);
        N.kusovnik.push(DH.polozka(poz++, 'bočnice (schodovitá)', 2, DH.rozmerTxt(D, H, t), mat, 'kouty vyříznout přímočarou pilou, zaoblit R ≥ 3'));
        N.kusovnik.push(DH.polozka(poz++, 'stupeň 1', 1, DH.rozmerTxt(W - 2 * t, d1 + 10, t), mat, 'protiskluzová páska nebo drážky'));
        N.kusovnik.push(DH.polozka(poz++, 'stupeň 2', 1, DH.rozmerTxt(W - 2 * t, D - d1, t), mat, ''));
        N.kusovnik.push(DH.polozka(poz++, 'čelo pod stupněm', 2, DH.rozmerTxt(W - 2 * t, 80, t), mat, 'ztužení proti zkosení'));
        N.kusovnik.push(DH.polozka(poz++, 'zadní vzpěra', 1, DH.rozmerTxt(W - 2 * t, H * 0.5, t), mat, ''));
        N.kusovnik.push(DH.polozka(poz++, 'konfirmát / vrut do dřeva', 20, 'typicky 4 × 40', 'ocel', 'předvrtat, zahloubit, zatmelit'));
        N.kusovnik.push(DH.polozka(poz++, 'protiskluzové podložky (filc / guma)', 4, 'Ø 20', 'guma', 'na hladkou podlahu'));
        const hm = DH.hmotyTeles(N.telesa, ro);
        const op = [[0, 0], [W, 0], [W, D], [0, D]].map((q) => [q[0], q[1]]);
        const opCCW = [[0, 0], [W, 0], [W, D], [0, D]];
        const zc = H + 0.55 * S;
        const pripady = [
          { nazev: 'dítě stojí na horním stupni uprostřed, opře se dopředu', hmoty: hm.concat([{ m, x: W / 2, y: (d1 + D) / 2, z: zc }]), sila: { F: p.sila, z: H + 0.7 * S, smer: [0, -1] } },
          { nazev: 'dítě na přední hraně horního stupně, tah dozadu', hmoty: hm.concat([{ m, x: W / 2, y: d1 + 80, z: zc }]), sila: { F: p.sila, z: H + 0.7 * S, smer: [0, 1] } },
          { nazev: 'dítě na horním stupni, opře se do boku', hmoty: hm.concat([{ m, x: W / 2, y: (d1 + D) / 2, z: zc }]), sila: { F: p.sila, z: H + 0.7 * S, smer: [1, 0] }, rada: 'Rozšiřte schůdky.' },
          { nazev: 'dítě stojí na kraji dolního stupně', hmoty: hm.concat([{ m, x: W / 2, y: 80, z: h1 + 0.55 * S }]), sila: { F: p.sila, z: h1 + 0.7 * S, smer: [0, -1] }, rada: 'Prodlužte spodní stupeň dopředu nebo přidejte hmotnost.' },
        ];
        vyhodnotStabilitu(N, pripady, opCCW);
        N.info.push(`Dítě ${cz(S / 10, 0)} cm (${cz(m, 1)} kg). Schůdky ${cz(W)} × ${cz(D)} mm, výška ${cz(H)} mm, stupně po ${cz(h1)} mm.`);
        if (h1 > 200) N.varovani.push(`Výška stupně ${cz(h1)} mm je pro malé dítě vysoká (pohodlně do ~180 mm).`);
        N.koty.push({ pohled: 'bok', a: [0, h1], b: [0, 0], txt: `${cz(h1)}`, o: -30 }, { pohled: 'bok', a: [D, H], b: [D, 0], txt: `${cz(H)}`, o: 30 });
        N.op = op;
        N.animace = { sklad: true };
        return N;
      }
      // ---------- učící věž ----------
      const loket = 0.63 * S;
      const vyp = Math.round((p.linka - (loket - 80)) / 5) * 5;           // pracovní deska ~8 cm pod loktem
      const hp = p.plosina > 0 ? p.plosina : Math.max(150, Math.min(650, vyp));
      const pozic = Math.round(p.pozic), krok = p.krokPozic;
      const hMin = hp - Math.floor((pozic - 1) / 2) * krok, hMax = hMin + (pozic - 1) * krok;
      const zab = p.zabradli > 0 ? p.zabradli : Math.round(Math.max(500, 0.6 * S) / 10) * 10;
      const Hs = hMax + t + zab, sF = (p.Db - p.Dt) / 2;
      const yF = (z) => sF * z / Hs, yB = (z) => p.Db - sF * z / Hs;   // přední a zadní hrana bočnice ve výšce z
      // bočnice: lichoběžník s otvorem pro ruku
      const bok = [[0, 0], [p.Db, 0], [p.Db - sF, Hs], [sF, Hs]];
      const bokZ = DH.zaobli([bok], 25, 0)[0] || bok;
      const madlo = (() => { const zc = Hs - 70, yc = (yF(zc) + yB(zc)) / 2, L = Math.min(130, (yB(zc) - yF(zc)) * 0.5); const o = DH.zaoblenyObd(yc - L / 2, zc - 16, yc + L / 2, zc + 16, 15.9, 8); return o; })();
      for (const x of [0, W - t]) N.telesa.push({ typ: 'extr', rovina: 'yz', b: bokZ, diry: [madlo.slice().reverse()], tl: t, x, y: 0, z: 0, barva: '#d9b98a', sklad: 0 });
      // lišty pro plošinu (na každou polohu pár)
      const lH = 25, lT = 20;
      for (let i = 0; i < pozic; i++) {
        const z = hMin + i * krok - lH;
        for (const x of [t, W - t - lT]) box(N, 'lišta', x, yF(z + lH) + 25, z, lT, yB(z + lH) - yF(z + lH) - 50, lH, '#b98552', 1);
      }
      // plošina v nejvyšší poloze (náhled)
      const yp0 = yF(hp) + 15, yp1 = yB(hp) - 15;
      box(N, 'plošina', t, yp0, hp, W - 2 * t, yp1 - yp0, t, '#e6c896', 2);
      // schod vzadu
      const hs = Math.round(hMin / 2 / 5) * 5, ys1 = yB(hs + t) - 5, ys0 = ys1 - 160;
      box(N, 'schod', t, ys0, hs, W - 2 * t, ys1 - ys0, t, '#e6c896', 3);
      // spodní vzpěry vpředu a vzadu
      box(N, 'vzpěra přední', t, yF(80) + 2, 0, W - 2 * t, t, 80, '#c99a62', 1);
      box(N, 'vzpěra zadní', t, yB(80) - t - 2, 0, W - 2 * t, t, 80, '#c99a62', 1);
      // příčky zábradlí (kulatina)
      const r = p.pricka / 2, Lp = W - 2 * t + 2 * 12;
      const zT = Hs - 35, zM = hMax + t + zab / 2;
      const pr = [{ n: 'příčka přední horní', z: zT, y: yF(zT) + r + 8 }, { n: 'příčka přední střední', z: zM, y: yF(zM) + r + 8 }, { n: 'příčka zadní horní', z: zT, y: yB(zT) - r - 8 }];
      for (const q of pr) N.telesa.push({ typ: 'valec', osa: 'x', x: t - 12, y: q.y, z: q.z, r, h: Lp, barva: '#f1e0bd', sklad: 4, nazev: q.n });
      // díly
      N.dily.push({ id: 'A', nazev: 'bočnice', ks: 2, tl: t, mat: spol.material, obrysy: [{ b: bokZ, typ: 'rez' }, { b: madlo, typ: 'otvor' }], kruhy: pr.map((q) => ({ x: q.y, y: q.z, r: r + 0.25, typ: 'otvor' })), texty: [], poznamka: `otvory příček Ø ${cz(p.pricka + 0.5)} hl. 12; lišty na výšky ${Array.from({ length: pozic }, (_, i) => cz(hMin + i * krok, 0)).join(', ')} mm (horní hrana)`, cary: Array.from({ length: pozic }, (_, i) => [[yF(hMin + i * krok) + 25, hMin + i * krok], [yB(hMin + i * krok) - 25, hMin + i * krok]]) });
      dilObd(N, 'B', 'plošina', 1, W - 2 * t, yp1 - yp0, t, spol.material, poz, { r: 4 });
      dilObd(N, 'C', 'schod', 1, W - 2 * t, ys1 - ys0, t, spol.material, poz, { r: 4 });
      dilObd(N, 'D', 'vzpěra', 2, W - 2 * t, 80, t, spol.material);
      N.kusovnik.push(DH.polozka(poz++, 'bočnice (lichoběžník s madlem)', 2, DH.rozmerTxt(p.Db, Hs, t), mat, `nahoře hloubka ${cz(p.Dt)} mm, rohy R 25`));
      N.kusovnik.push(DH.polozka(poz++, 'plošina', 1, DH.rozmerTxt(W - 2 * t, yp1 - yp0, t), mat, `polohy ${Array.from({ length: pozic }, (_, i) => cz(hMin + i * krok, 0)).join(' / ')} mm`));
      N.kusovnik.push(DH.polozka(poz++, 'lišta pod plošinu', 2 * pozic, DH.rozmerTxt(yB(hMin) - yF(hMin) - 50, lH, lT), mat, 'přišroubovat 3 vruty + lepit'));
      N.kusovnik.push(DH.polozka(poz++, 'schod (vzadu)', 1, DH.rozmerTxt(W - 2 * t, ys1 - ys0, t), mat, `výška ${cz(hs)} mm`));
      N.kusovnik.push(DH.polozka(poz++, 'spodní vzpěra', 2, DH.rozmerTxt(W - 2 * t, 80, t), mat, 'vpředu a vzadu'));
      N.kusovnik.push(DH.polozka(poz++, 'příčka zábradlí (kulatina)', 3, `Ø ${cz(p.pricka)} × ${cz(Lp)}`, 'buk', 'zapustit 12 mm do bočnic, lepit + vrut zboku'));
      N.kusovnik.push(DH.polozka(poz++, 'vrut do dřeva', 30, 'typicky 4 × 40', 'ocel', 'hlavy zapustit a zatmelit'));
      N.kusovnik.push(DH.polozka(poz++, 'zajištění plošiny (2 vruty nebo kolíky)', 2, 'typicky 4 × 30', 'ocel', 'plošinu přišroubovat k liště, aby nevyklouzla'));
      // ergonomie
      N.info.push(`Dítě ${cz(S / 10, 0)} cm (${cz(m, 1)} kg), loket ve stoje ≈ ${cz(loket, 0)} mm. Pro linku ${cz(p.linka)} mm vychází plošina ${cz(vyp)} mm (deska ~8 cm pod loktem); zvoleno ${cz(hp)} mm, polohy ${cz(hMin)}–${cz(hMax)} mm.`);
      N.info.push(`Věž ${cz(W)} × ${cz(p.Db)} mm (nahoře ${cz(p.Dt)}), výška ${cz(Hs)} mm, zábradlí ${cz(zab)} mm nad nejvyšší polohou plošiny.`);
      if (zab < 0.5 * S) N.bezpecnost.push({ u: 'pozor', t: `Zábradlí ${cz(zab)} mm je nižší než polovina výšky dítěte (${cz(0.5 * S, 0)} mm) – těžiště dítěte je nad ním, může se přepadnout.` });
      // mezery
      const mezery = [['plošina (nejnižší) – střední příčka', zM - r - (hMin + t)], ['střední – horní příčka', zT - zM - 2 * r], ['mezi lištami polohy', krok - lH - t]];
      for (const [n, g] of mezery) { const q = DH.mezera(g); if (q.u !== 'ok') N.bezpecnost.push({ u: q.u, t: `${n}: ${q.t}` }); }
      N.tabulky.push({ nadpis: 'Mezery (prsty 5–12 mm, hlava 65–230 mm)', hlavicka: ['místo', 'mezera', 'posouzení'], radky: mezery.map(([n, g]) => { const q = DH.mezera(g); return [n, cz(g, 0) + ' mm', q.u === 'ok' ? 'v pořádku' : q.t]; }) });
      // stabilita
      const hm = DH.hmotyTeles(N.telesa, ro);
      const op = [[0, 0], [W, 0], [W, p.Db], [0, p.Db]];
      const zc = hMax + t + 0.55 * S, zr = Hs - 35;
      const pripady = [
        { nazev: 'dítě stojí uprostřed, opře se dopředu do zábradlí', hmoty: hm.concat([{ m, x: W / 2, y: (yp0 + yp1) / 2, z: zc }]), sila: { F: p.sila, z: zr, smer: [0, -1] }, rada: 'Prodlužte spodek dopředu (větší hloubka dole).' },
        { nazev: 'dítě se zakloní / zatáhne dozadu', hmoty: hm.concat([{ m, x: W / 2, y: (yp0 + yp1) / 2, z: zc }]), sila: { F: p.sila, z: zr, smer: [0, 1] } },
        { nazev: 'dítě se opře do boku', hmoty: hm.concat([{ m, x: W / 2, y: (yp0 + yp1) / 2, z: zc }]), sila: { F: p.sila, z: zr, smer: [1, 0] }, rada: 'Rozšiřte věž nebo snižte zábradlí.' },
        { nazev: 'dítě leze po zadním schodu (stojí na hraně)', hmoty: hm.concat([{ m, x: W / 2, y: ys1 - 80, z: hs + 0.55 * S }]), sila: { F: p.sila, z: hs + 0.7 * S, smer: [0, 1] }, rada: 'Schod posuňte dovnitř nebo prodlužte spodek dozadu.' },
      ];
      vyhodnotStabilitu(N, pripady, op);
      N.bezpecnost.push({ u: 'ok', t: 'Věž postavte čelem k lince a nenechávejte dítě bez dozoru. Plošinu zajistěte vruty – volně položená plošina se při lezení vysune.' });
      N.koty.push({ pohled: 'bok', a: [p.Db + 40, hp + t], b: [p.Db + 40, 0], txt: `plošina ${cz(hp)}`, o: 0 });
      N.koty.push({ pohled: 'bok', a: [-40, Hs], b: [-40, hMax + t], txt: `zábradlí ${cz(zab)}`, o: 0 });
      N.ergo = E;
      N.animace = { sklad: true };
      return N;
    },
  };

  /* ============================================================
     5b) STOLEČEK A ŽIDLIČKA podle výšky dítěte (EN 1729-1)
     ============================================================ */
  DH.GEN.stul = {
    nazev: 'Stoleček a židlička', ikona: '🪑', typ: 'nabytek',
    popis: 'Výška sedu a stolu podle výšky dítěte (velikosti ČSN EN 1729-1), nohy, luby, opěradlo; prostor pro kolena a stabilita židle.',
    pole: [
      { sk: 'Dítě' },
      { k: 'vyskaDitete', n: 'Výška dítěte (mm, 0 = podle věku)', t: 'n', min: 0, max: 1900, krok: 10 },
      { k: 'pravidlo', n: 'Rozměry podle', t: 'v', m: [['en', 'ČSN EN 1729-1 (velikostní třídy)'], ['umerne', 'úměrně výšce postavy'], ['rucne', 'ručně zadané výšky']] },
      { k: 'sedRucne', n: 'Výška sedu (mm)', t: 'n', min: 150, max: 550, krok: 5, ukaz: (p) => p.pravidlo === 'rucne' },
      { k: 'stulRucne', n: 'Výška stolu (mm)', t: 'n', min: 300, max: 850, krok: 5, ukaz: (p) => p.pravidlo === 'rucne' },
      { k: 'vyrobit', n: 'Vyrobit', t: 'v', m: [['oboji', 'stůl i židli'], ['stul', 'jen stůl'], ['zidle', 'jen židli']] },
      { sk: 'Stůl' },
      { k: 'stulW', n: 'Deska – šířka (mm)', t: 'n', min: 300, max: 1600, krok: 10 },
      { k: 'stulD', n: 'Deska – hloubka (mm)', t: 'n', min: 250, max: 1000, krok: 10 },
      { k: 'deskaT', n: 'Tloušťka desky (mm)', t: 'n', min: 12, max: 40, krok: 1 },
      { k: 'noha', n: 'Průřez nohy stolu (mm)', t: 'n', min: 25, max: 80, krok: 1 },
      { k: 'lub', n: 'Výška lubu (mm)', t: 'n', min: 30, max: 120, krok: 5 },
      { k: 'rohR', n: 'Zaoblení rohů desky (mm)', t: 'n', min: 0, max: 100, krok: 1 },
      { sk: 'Židle' },
      { k: 'nohaZ', n: 'Průřez nohy židle (mm)', t: 'n', min: 20, max: 60, krok: 1 },
      { k: 'opera', n: 'Opěradlo nad sedákem (mm, 0 = výpočet)', t: 'n', min: 0, max: 500, krok: 5 },
      { k: 'sila', n: 'Síla opření (N, 0 = 20 % váhy dítěte)', t: 'n', min: 0, max: 400, krok: 5 },
    ],
    vychozi: { vyskaDitete: 0, pravidlo: 'en', sedRucne: 260, stulRucne: 460, vyrobit: 'oboji', stulW: 600, stulD: 450, deskaT: 20, noha: 40, lub: 60, rohR: 25, nohaZ: 30, opera: 0, sila: 0 },
    predvolby: [
      { id: 'tri', nazev: 'Pro tříleté (podle věku)', p: {} },
      { id: 'skolak', nazev: 'Školák 120 cm – velikost 3', p: { vyskaDitete: 1250, stulW: 700, stulD: 500 } },
      { id: 'batole', nazev: 'Batole 85 cm – velikost 0', p: { vyskaDitete: 870, stulW: 500, stulD: 400, noha: 36, nohaZ: 28 } },
    ],
    vypocet(p, spol) {
      const N = { typ: 'nabytek', dily: [], telesa: [], kusovnik: [], bezpecnost: [], info: [], varovani: [], koty: [], tabulky: [], stl: [], male: [] };
      const S = vyskaDitete(p, spol), m = DH.hmotnostZVysky(S), E = DH.ergonomie(S), mat = (DH.MATERIALY[spol.material] || {}).nazev, ro = DH.hustota(spol.material);
      p = Object.assign({}, p, { sila: p.sila > 0 ? p.sila : Math.round(0.2 * m * G) });
      const sed = p.pravidlo === 'rucne' ? p.sedRucne : p.pravidlo === 'umerne' ? E.umerne.sed : E.sed;
      const stulH = p.pravidlo === 'rucne' ? p.stulRucne : p.pravidlo === 'umerne' ? E.umerne.stul : E.stul;
      N.ergo = E;
      N.tabulky.push({ nadpis: 'Velikosti podle ČSN EN 1729-1 (výška sedu h8, výška stolu h1; hloubka a šířka sedu orientačně)', hlavicka: ['velikost', 'barva', 'výška postavy', 'sed h8', 'stůl h1', 'hloubka sedu', 'šířka sedu', ''], radky: DH.EN1729.map((q) => [String(q.vel), q.barva, `${q.od}–${q.do}`, String(q.sed), String(q.stul), String(q.hloubka), String(q.sirka), q.vel === E.velikost ? '◀ vaše dítě' : '']) });
      N.tabulky.push({ nadpis: 'Medián výšky podle věku (WHO, průměr chlapců a dívek)', hlavicka: ['věk', 'výška', 'velikost EN 1729', 'sed', 'stůl', ''], radky: DH.VYSKA_VEK.filter((q) => q[0] >= 1.5 && q[0] <= 12).map(([v, h]) => { const e = DH.ergonomie(h); return [`${String(v).replace('.', ',')} r.`, `${h} mm`, String(e.velikost), String(e.sed), String(e.stul), '']; }) });
      N.info.push(`Dítě ${cz(S / 10, 0)} cm${p.vyskaDitete > 0 ? '' : ` (medián pro ${cz(+spol.vek, 1)} let)`} → velikost ${E.velikost} (${E.barva}) podle EN 1729-1: sed ${E.sed} mm, stůl ${E.stul} mm. Úměrně postavě: sed ${E.umerne.sed}, stůl ${E.umerne.stul} mm. Zvoleno: sed ${cz(sed)} mm, stůl ${cz(stulH)} mm.`);
      if (E.mimoRozsah) N.varovani.push('Výška dítěte je mimo rozsah tabulky EN 1729-1 (800–2070 mm).');
      const rozd = stulH - sed;
      if (rozd < 0.15 * S || rozd > 0.23 * S) N.varovani.push(`Rozdíl stůl − sed ${cz(rozd)} mm je mimo obvyklé rozmezí 15–23 % výšky postavy (${cz(0.15 * S, 0)}–${cz(0.23 * S, 0)} mm).`);
      let poz = 1, sklad = 0;
      const t = p.deskaT, n = p.noha;
      if (p.vyrobit !== 'zidle') {
        const W = p.stulW, D = p.stulD, zn = stulH - t, ins = 20;
        box(N, 'deska stolu', 0, 0, zn, W, D, t, '#e6c896', 2);
        for (const [x, y] of [[ins, ins], [W - ins - n, ins], [ins, D - ins - n], [W - ins - n, D - ins - n]]) box(N, 'noha stolu', x, y, 0, n, n, zn, '#c99a62', 0);
        const lt = 18;
        box(N, 'lub dlouhý', ins + n, ins + 6, zn - p.lub, W - 2 * (ins + n), lt, p.lub, '#d9b98a', 1);
        box(N, 'lub dlouhý', ins + n, D - ins - 6 - lt, zn - p.lub, W - 2 * (ins + n), lt, p.lub, '#d9b98a', 1);
        box(N, 'lub krátký', ins + 6, ins + n, zn - p.lub, lt, D - 2 * (ins + n), p.lub, '#d9b98a', 1);
        box(N, 'lub krátký', W - ins - 6 - lt, ins + n, zn - p.lub, lt, D - 2 * (ins + n), p.lub, '#d9b98a', 1);
        const rr = Math.min(p.rohR, Math.min(W, D) / 2);
        dilObd(N, 'T1', 'deska stolu', 1, W, D, t, spol.material, 0, { r: rr });
        dilObd(N, 'T2', 'noha stolu', 4, n, zn, n, spol.material);
        dilObd(N, 'T3', 'lub dlouhý', 2, W - 2 * (ins + n) + 2 * 15, p.lub, lt, spol.material, 0, { poznamka: 'čepy 15 mm do noh' });
        dilObd(N, 'T4', 'lub krátký', 2, D - 2 * (ins + n) + 2 * 15, p.lub, lt, spol.material, 0, { poznamka: 'čepy 15 mm do noh' });
        N.kusovnik.push(DH.polozka(poz++, 'deska stolu', 1, DH.rozmerTxt(W, D, t), mat, `rohy R ${cz(rr)}`));
        N.kusovnik.push(DH.polozka(poz++, 'noha stolu', 4, DH.rozmerTxt(n, n, zn), mat, 'hrany sražené, dole filc'));
        N.kusovnik.push(DH.polozka(poz++, 'lub dlouhý (vč. čepů 2 × 15)', 2, DH.rozmerTxt(W - 2 * (ins + n) + 30, p.lub, lt), mat, ''));
        N.kusovnik.push(DH.polozka(poz++, 'lub krátký (vč. čepů 2 × 15)', 2, DH.rozmerTxt(D - 2 * (ins + n) + 30, p.lub, lt), mat, ''));
        N.kusovnik.push(DH.polozka(poz++, 'kotvicí příchytka desky (typicky „Z“ / osmička)', 8, 'typicky', 'ocel', 'deska pracuje – nelepit k lubům'));
        // kolena
        const podLub = zn - p.lub, stehno = sed + Math.round(0.085 * S) + 20;
        if (p.vyrobit === 'oboji' && podLub < stehno) N.varovani.push(`Pod lubem stolu je ${cz(podLub)} mm, stehna sedícího dítěte potřebují ≈ ${cz(stehno)} mm – zmenšete výšku lubu.`);
        else N.info.push(`Volná výška pod lubem ${cz(podLub)} mm (stehna ≈ ${cz(stehno)} mm).`);
        if (rr < 10) N.bezpecnost.push({ u: 'pozor', t: `Rohy desky R ${cz(rr)} mm jsou ve výšce hlavy batolete – doporučeno R ≥ 10 mm (lépe 25 mm).` });
        // stabilita stolu: dítě se opře o kraj
        const hm = DH.hmotyTeles(N.telesa.filter((q) => /stolu|lub/.test(q.nazev)), ro);
        const op = [[ins, ins], [W - ins, ins], [W - ins, D - ins], [ins, D - ins]];
        const pripady = [{ nazev: 'stůl: dítě se svou vahou opře o roh desky', hmoty: hm.concat([{ m: m * 0.5, x: 0, y: 0, z: stulH }]), sila: null }];
        N._stul = { pripady, op };
        N.koty.push({ pohled: 'predni', a: [W + 30, stulH], b: [W + 30, 0], txt: `stůl ${cz(stulH)}`, o: 0 });
      }
      if (p.vyrobit !== 'stul') {
        const ox = p.vyrobit === 'oboji' ? p.stulW / 2 - Math.max(E.sirka + 40, 240) / 2 : 0, oy = p.vyrobit === 'oboji' ? p.stulD + 60 : 0;   // židle odsunutá od stolu, opěradlem ven
        const sw = Math.max(E.sirka + 40, 240), sd = E.hloubka, st = 18, nz = p.nohaZ;
        const op = p.opera > 0 ? p.opera : Math.round(Math.max(160, 0.18 * S) / 5) * 5;
        const zs = sed - st;
        box(N, 'sedák', ox, oy, zs, sw, sd, st, '#e6c896', sklad + 2);
        for (const [x, y, h] of [[ox, oy + 5, zs], [ox + sw - nz, oy + 5, zs], [ox, oy + sd - nz, zs + st + op], [ox + sw - nz, oy + sd - nz, zs + st + op]]) box(N, 'noha židle', x, y, 0, nz, nz, h, '#c99a62', sklad);
        const ol = 60, lt = 18;
        const spodni = 0.65 * op - 105 >= 40;
        box(N, 'opěrák horní', ox + nz, oy + sd - nz / 2 - lt / 2, zs + st + op - ol, sw - 2 * nz, lt, ol, '#d9b98a', sklad + 3);
        if (spodni) box(N, 'opěrák spodní', ox + nz, oy + sd - nz / 2 - lt / 2, zs + st + op * 0.35, sw - 2 * nz, lt, ol * 0.75, '#d9b98a', sklad + 3);
        box(N, 'lub židle', ox + nz, oy + 10, zs - 50, sw - 2 * nz, lt, 50, '#d9b98a', sklad + 1);
        box(N, 'lub židle', ox + nz, oy + sd - nz / 2 - lt / 2, zs - 50, sw - 2 * nz, lt, 50, '#d9b98a', sklad + 1);
        box(N, 'příčka boční', ox + nz / 2 - lt / 2, oy + nz + 5, 90, lt, sd - 2 * nz - 5, 40, '#d9b98a', sklad + 1);
        box(N, 'příčka boční', ox + sw - nz / 2 - lt / 2, oy + nz + 5, 90, lt, sd - 2 * nz - 5, 40, '#d9b98a', sklad + 1);
        dilObd(N, 'Z1', 'sedák', 1, sw, sd, st, spol.material, 0, { r: 10 });
        dilObd(N, 'Z2', 'přední noha židle', 2, nz, zs, nz, spol.material);
        dilObd(N, 'Z3', 'zadní noha židle (s opěradlem)', 2, nz, zs + st + op, nz, spol.material);
        dilObd(N, 'Z4', 'opěrák', spodni ? 2 : 1, sw - 2 * nz + 20, ol, lt, spol.material, 0, { r: 8 });
        N.kusovnik.push(DH.polozka(poz++, 'sedák', 1, DH.rozmerTxt(sw, sd, st), mat, `výška sedu ${cz(sed)} mm, přední hrana zaoblená R ≥ 10`));
        N.kusovnik.push(DH.polozka(poz++, 'přední noha židle', 2, DH.rozmerTxt(nz, nz, zs), mat, ''));
        N.kusovnik.push(DH.polozka(poz++, 'zadní noha židle', 2, DH.rozmerTxt(nz, nz, zs + st + op), mat, 'průběžná až do opěradla'));
        N.kusovnik.push(DH.polozka(poz++, spodni ? 'opěrák (2 lamely, čepy 10)' : 'opěrák (lamela, čepy 10)', spodni ? 2 : 1, DH.rozmerTxt(sw - 2 * nz + 20, ol, lt), mat, spodni ? 'horní 60 mm, spodní 45 mm' : 'lamela 60 mm v horní části opěradla'));
        N.kusovnik.push(DH.polozka(poz++, 'lub + boční příčka', 4, DH.rozmerTxt(sw - 2 * nz + 20, 50, lt), mat, 'čepy nebo kolíky Ø 8'));
        N.info.push(`Židle: sedák ${cz(sw)} × ${cz(sd)} mm ve výšce ${cz(sed)} mm, opěradlo ${cz(op)} mm nad sedákem (lamela ${cz(op - ol)}–${cz(op)} mm nad sedákem${spodni ? ', spodní lamela v bederní výšce' : ''}).`);
        const mz = spodni ? [['sedák – spodní lamela', op * 0.35], ['mezi lamelami opěradla', op - ol - op * 0.35 - ol * 0.75]] : [['sedák – lamela opěradla', op - ol]];
        N.tabulky.push({ nadpis: 'Mezery židle (kontrola prstů 5–12 mm)', hlavicka: ['místo', 'mezera', 'posouzení'], radky: mz.map(([n, g]) => { const q = DH.mezera(g, { jenPrsty: true }); return [n, cz(g, 0) + ' mm', q.u === 'ok' ? 'v pořádku' : q.t]; }) });
        for (const [n, g] of mz) { const q = DH.mezera(g, { jenPrsty: true }); if (q.u !== 'ok') N.bezpecnost.push({ u: q.u, t: `${n}: ${q.t}` }); }
        // stabilita židle
        const hm = DH.hmotyTeles(N.telesa.filter((t) => /židle|sedák|opěrák|příčka boční/.test(t.nazev || '')), ro);
        const opZ = [[ox, oy + 5], [ox + sw, oy + 5], [ox + sw, oy + sd], [ox, oy + sd]];
        const zc = sed + 0.2 * S;
        const pripady = [
          { nazev: 'židle: dítě se opře do opěradla (dozadu)', hmoty: hm.concat([{ m, x: ox + sw / 2, y: oy + sd * 0.55, z: zc }]), sila: { F: p.sila, z: zs + st + op, smer: [0, 1] }, rada: 'Zadní nohy roztáhněte dozadu nebo snižte opěradlo.' },
          { nazev: 'židle: dítě sedí vpředu na sedáku a odstrčí se dopředu', hmoty: hm.concat([{ m, x: ox + sw / 2, y: oy + sd * 0.3, z: zc }]), sila: { F: p.sila, z: sed, smer: [0, -1] } },
          { nazev: 'židle: dítě se nakloní do boku', hmoty: hm.concat([{ m, x: ox + sw / 2, y: oy + sd / 2, z: zc }]), sila: { F: p.sila, z: zc, smer: [1, 0] } },
        ];
        if (N._stul) pripady.unshift(...N._stul.pripady.map((c) => Object.assign(c, { opora: N._stul.op })));
        // vyhodnotit každý případ se správným polygonem
        const vsechny = [];
        for (const c of pripady) vsechny.push(c);
        const stulC = vsechny.filter((c) => c.opora), zidleC = vsechny.filter((c) => !c.opora);
        if (stulC.length) vyhodnotStabilitu(N, stulC, stulC[0].opora);
        vyhodnotStabilitu(N, zidleC, opZ);
        N.koty.push({ pohled: 'bok', a: [oy - 30, sed], b: [oy - 30, 0], txt: `sed ${cz(sed)}`, o: 0 });
      } else if (N._stul) vyhodnotStabilitu(N, N._stul.pripady, N._stul.op);
      delete N._stul;
      N.bezpecnost.push({ u: 'ok', t: 'Všechny hrany sražené R ≥ 2 mm, rohy desek R ≥ 10 mm. Spoje čep–dlab nebo kolíky + lepidlo D3; vruty jen se zapuštěnou hlavou.' });
      N.vysky = { sed, stul: stulH, S };
      N.animace = { sklad: true };
      return N;
    },
  };

  /* ============================================================
     5c) SKŘÍŇKA / TRUHLA NA HRAČKY
     ============================================================ */
  DH.GEN.skrinka = {
    nazev: 'Skříňka na hračky', ikona: '🗄️', typ: 'nabytek',
    popis: 'Otevřený regálek s policemi a přihrádkami nebo truhla s víkem: větrací otvory, zpomalovač víka, výpočet převržení a kotvení ke zdi.',
    pole: [
      { k: 'typ', n: 'Výrobek', t: 'v', m: [['regal', 'regálek s policemi'], ['truhla', 'truhla s víkem']] },
      { k: 'W', n: 'Šířka (mm)', t: 'n', min: 300, max: 1600, krok: 10 },
      { k: 'H', n: 'Výška (mm)', t: 'n', min: 250, max: 1500, krok: 10 },
      { k: 'D', n: 'Hloubka (mm)', t: 'n', min: 200, max: 600, krok: 10 },
      { k: 't', n: 'Tloušťka desek (mm)', t: 'n', min: 12, max: 30, krok: 1 },
      { k: 'police', n: 'Počet polic (mezi dnem a stropem)', t: 'n', min: 0, max: 6, krok: 1, ukaz: (p) => p.typ === 'regal' },
      { k: 'pricky', n: 'Svislé přepážky', t: 'n', min: 0, max: 4, krok: 1, ukaz: (p) => p.typ === 'regal' },
      { k: 'sokl', n: 'Sokl (mm)', t: 'n', min: 0, max: 120, krok: 5 },
      { k: 'uchyt', n: 'Úchytový otvor ve víku / bocích (š. × v., mm)', t: 'n', min: 0, max: 160, krok: 5 },
      { k: 'testHm', n: 'Zkušební hmotnost na přední hraně (kg)', t: 'n', min: 0, max: 60, krok: 0.5 },
    ],
    vychozi: { typ: 'regal', W: 800, H: 640, D: 300, t: 18, police: 1, pricky: 1, sokl: 40, uchyt: 100, testHm: 22.7 },
    predvolby: [
      { id: 'regal', nazev: 'Nízký regálek 80 × 64 cm', p: {} },
      { id: 'vysoky', nazev: 'Vyšší regál 80 × 110 cm', p: { H: 1100, police: 3 } },
      { id: 'truhla', nazev: 'Truhla na hračky 70 × 40 × 40', p: { typ: 'truhla', W: 700, H: 420, D: 400, sokl: 30 } },
    ],
    vypocet(p, spol) {
      const N = { typ: 'nabytek', dily: [], telesa: [], kusovnik: [], bezpecnost: [], info: [], varovani: [], koty: [], tabulky: [], stl: [], male: [] };
      const { W, H, D, t } = p, mat = (DH.MATERIALY[spol.material] || {}).nazev, ro = DH.hustota(spol.material);
      const S = Math.round(DH.vyskaZVeku(+spol.vek)), m = DH.hmotnostZVysky(S);
      let poz = 1;
      const uchW = p.uchyt, uchH = Math.round(p.uchyt * 0.3);
      const otvUch = (cx, cy) => (uchW > 0 ? [DH.zaoblenyObd(cx - uchW / 2, cy - uchH / 2, cx + uchW / 2, cy + uchH / 2, uchH / 2 - 0.1, 8)] : []);
      // boky
      const bok = DH.zaoblenyObd(0, 0, D, H, [0, 0, 6, 6]);
      const uchB = p.typ === 'truhla' ? otvUch(D / 2, H - 60) : [];
      for (const x of [0, W - t]) N.telesa.push({ typ: 'extr', rovina: 'yz', b: bok, diry: uchB.map((b) => b.slice().reverse()), tl: t, x, y: 0, z: 0, barva: '#d9b98a', sklad: 0 });
      N.dily.push({ id: 'A', nazev: 'bok', ks: 2, tl: t, mat: spol.material, obrysy: [{ b: bok, typ: 'rez' }].concat(uchB.map((b) => ({ b, typ: 'otvor' }))), kruhy: [], texty: [] });
      N.kusovnik.push(DH.polozka(poz++, 'bok', 2, DH.rozmerTxt(D, H, t), mat, p.typ === 'truhla' && uchW ? `úchyt ${cz(uchW)} × ${cz(uchH)}` : 'horní rohy R 6'));
      const vW = W - 2 * t;
      box(N, 'dno', t, 0, p.sokl, vW, D - 4, t, '#e6c896', 1);
      if (p.sokl > 0) box(N, 'sokl', t, 20, 0, vW, t, p.sokl, '#c99a62', 1);
      dilObd(N, 'B', 'dno', 1, vW, D - 4, t, spol.material);
      N.kusovnik.push(DH.polozka(poz++, 'dno', 1, DH.rozmerTxt(vW, D - 4, t), mat, ''));
      if (p.sokl > 0) N.kusovnik.push(DH.polozka(poz++, 'sokl (zapuštěný 20 mm)', 1, DH.rozmerTxt(vW, p.sokl, t), mat, ''));
      N.kusovnik.push(DH.polozka(poz++, 'záda (HDF / překližka 4)', 1, DH.rozmerTxt(W - 4, H - p.sokl - 2, 4), 'HDF / překližka', 'do polodrážky nebo přibít sponkami – ztuží proti zkosení'));
      box(N, 'záda', 2, D - 4, p.sokl, W - 4, 4, H - p.sokl - 2, '#efd9a8', 4);
      if (p.typ === 'regal') {
        box(N, 'strop', t, 0, H - t, vW, D - 4, t, '#e6c896', 3);
        dilObd(N, 'C', 'strop', 1, vW, D - 4, t, spol.material, 0, { r: 0 });
        N.kusovnik.push(DH.polozka(poz++, 'strop', 1, DH.rozmerTxt(vW, D - 4, t), mat, ''));
        const n = Math.round(p.police), vnitrni = H - t - (p.sokl + t), krok = vnitrni / (n + 1);
        for (let i = 1; i <= n; i++) box(N, 'police', t, 0, p.sokl + t + i * krok - t / 2, vW, D - 4, t, '#e6c896', 2);
        if (n) { dilObd(N, 'D', 'police', n, vW, D - 4, t, spol.material); N.kusovnik.push(DH.polozka(poz++, 'police (pevná)', n, DH.rozmerTxt(vW, D - 4, t), mat, `osa po ${cz(krok, 0)} mm, kolíky / konfirmáty`)); }
        const k = Math.round(p.pricky);
        if (k) {
          const hP = krok - t;
          for (let j = 1; j <= k; j++) box(N, 'přepážka', t + j * (vW - k * t) / (k + 1) + (j - 1) * t, 0, p.sokl + t, t, D - 4, hP, '#c99a62', 3);
          dilObd(N, 'E', 'svislá přepážka (spodní patro)', k, D - 4, hP, t, spol.material);
          N.kusovnik.push(DH.polozka(poz++, 'svislá přepážka', k, DH.rozmerTxt(D - 4, hP, t), mat, 'v dolním patře'));
        }
        N.info.push(`Regálek ${cz(W)} × ${cz(H)} × ${cz(D)} mm, ${n} ${n === 1 ? 'police' : 'polic'}, světlá výška pater ${cz(krok - t, 0)} mm.`);
        if (krok - t < 230 && krok - t > 65) N.bezpecnost.push({ u: 'pozor', t: `Světlá výška patra ${cz(krok - t, 0)} mm – dítě sem může strčit hlavu (90–230 mm); nevadí u otevřené police, ale nesmí být zavíratelná.` });
      } else {
        // truhla: víko s pantem, větrací otvory, zpomalovač
        box(N, 'víko', 0, 0, H, W, D, t, '#e6c896', 5);
        const viko = DH.zaoblenyObd(0, 0, W, D, 10);
        N.dily.push({ id: 'C', nazev: 'víko', ks: 1, tl: t, mat: spol.material, obrysy: [{ b: viko, typ: 'rez' }], kruhy: [], texty: [] });
        box(N, 'čelo', t, 0, p.sokl, vW, t, H - p.sokl, '#d9b98a', 2);
        const celo = DH.obdelnik(0, 0, vW, H - p.sokl), vetr = [DH.kruh(vW * 0.25, (H - p.sokl) * 0.75, 17.5, 40), DH.kruh(vW * 0.75, (H - p.sokl) * 0.75, 17.5, 40)];
        N.dily.push({ id: 'D', nazev: 'čelo s větracími otvory', ks: 1, tl: t, mat: spol.material, obrysy: [{ b: celo, typ: 'rez' }].concat(vetr.map((b) => ({ b, typ: 'otvor' }))), kruhy: [], texty: [], poznamka: '2 větrací otvory Ø 35 (každý 962 mm²)' });
        N.kusovnik.push(DH.polozka(poz++, 'víko', 1, DH.rozmerTxt(W, D, t), mat, 'rohy R 10'));
        N.kusovnik.push(DH.polozka(poz++, 'čelo', 1, DH.rozmerTxt(vW, H - p.sokl, t), mat, '2 větrací otvory Ø 35, vzdálené od sebe > 150 mm'));
        N.kusovnik.push(DH.polozka(poz++, 'zpomalovač / držák víka (lid stay) pro dětské truhly', 2, 'typicky 150–250 N podle hmotnosti víka', 'ocel', 'víko musí zůstat stát v každé poloze, nesmí samo spadnout'));
        N.kusovnik.push(DH.polozka(poz++, 'pant (piánový / 2 × pant 60)', 1, `${cz(W - 40)} mm`, 'ocel', 'mezi víkem a zády'));
        const vahaViko = W * D * t * 1e-9 * ro;
        N.info.push(`Truhla ${cz(W)} × ${cz(H)} × ${cz(D)} mm, víko ${cz(vahaViko, 2)} kg → moment v pantu ${cz(vahaViko * G * D / 2000, 2)} N·m (podle toho zvolte zpomalovač).`);
        N.bezpecnost.push({ u: 'pozor', t: 'Truhla s víkem: EN 71-1 vyžaduje u hraček, do kterých se dítě vejde, větrací otvory a víko, které nespadne samo (držák/zpomalovač). Navrženy 2 otvory Ø 35 mm (≈ 960 mm² každý) – ověřte požadavky v platném znění normy. Víko bez zámku a západky.' });
        const g = DH.mezera(3);
        N.bezpecnost.push({ u: 'pozor', t: `Mezera mezi víkem a boky při zavírání = místo přivření prstů. Zpomalovač brání pádu víka; mezeru v pantu nechte < 5 mm nebo > 12 mm. (${g.t})` });
        if (uchW) N.bezpecnost.push({ u: 'ok', t: `Úchytové otvory ${cz(uchW)} × ${cz(uchH)} mm – mimo pásmo 5–12 mm.` });
      }
      // stabilita (otevřený regál: dítě šplhá po polici)
      const hm = DH.hmotyTeles(N.telesa.filter((x) => x.nazev !== 'víko' || true), ro);
      const op = [[0, 0], [W, 0], [W, D], [0, D]];
      const zHorni = H - t;
      const pripady = [
        p.typ === 'truhla' ? null : { nazev: `bez kotvení: zkušební hmotnost ${cz(p.testHm, 1)} kg na přední hraně, tah dopředu ${cz(0.3 * p.testHm * G, 0)} N nahoře`, hmoty: hm.concat([{ m: p.testHm, x: W / 2, y: -10, z: zHorni }]), sila: { F: 0.3 * p.testHm * G, z: zHorni, smer: [0, -1] }, rada: 'Skříňku je nutné připevnit ke zdi (kotvicí pásek / úhelník do hmoždinky).' },
        { nazev: `dítě (${cz(m, 1)} kg) šplhá – stojí na spodní polici a táhne se nahoru`, hmoty: hm.concat([{ m, x: W / 2, y: -15, z: p.sokl + t + 0.55 * S }]), sila: { F: 0.25 * m * G, z: Math.min(H, p.sokl + 0.9 * S), smer: [0, -1] }, rada: 'Kotvit ke zdi.' },
      ].filter(Boolean);
      const nej = vyhodnotStabilitu(N, pripady, op);
      const kotvit = H > 600 || H / D > 2 || nej < 1.5;
      N.kotvit = kotvit;
      N.bezpecnost.push({ u: kotvit ? 'pozor' : 'ok', t: kotvit ? `Kotvení ke zdi: ${H > 600 ? `výška ${cz(H)} mm > 600 mm` : H / D > 2 ? 'štíhlý poměr výška/hloubka' : 'nízká bezpečnost proti převržení'} – přišroubujte ke zdi kotvicím páskem (součást kusovníku). Převržený nábytek je vážné riziko pro děti.` : 'Nízká a široká skříňka – kotvení ke zdi není nutné, ale doporučené.' });
      if (kotvit) N.kusovnik.push(DH.polozka(poz++, 'kotvicí pásek / úhelník ke zdi + hmoždinky', 2, 'typicky', 'ocel / textil', 'do nosného zdiva nebo profilu'));
      N.kusovnik.push(DH.polozka(poz++, 'kolík Ø 8 × 35 + konfirmáty 7 × 50', 16, 'typicky', 'buk / ocel', 'spoje korpusu'));
      N.animace = { sklad: true };
      return N;
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DH;
})(typeof window !== 'undefined' ? window : globalThis);
