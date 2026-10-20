/* ============================================================
   Dřevěné hračky – kuličková dráha (věž z modulů) + jednoduchá fyzikální simulace (bez DOM)
   Moduly jsou krychle M × M × M na mřížce (i, j, k). Dráha vede po obvodu obdélníku a × b modulů,
   v každém patře projede s modulů a v posledním propadne otvorem do modulu pod ním.
   Drážka se po délce prohlubuje o sklon × délka, takže kulička se valí i ve vodorovně složené věži.
   ============================================================ */
(function (koren) {
  'use strict';
  const DH = koren.DH || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const { cz, r1, r2 } = DH;
  const SMERY = { '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] };
  const opak = (s) => (s[0] === '+' ? '-' : '+') + s[1];
  const smerZ = (dx, dy) => (dx > 0 ? '+x' : dx < 0 ? '-x' : dy > 0 ? '+y' : '-y');

  /** obvod obdélníku a × b (proti směru hodin od [0,0]) */
  function obvod(a, b) {
    const o = [];
    for (let i = 0; i < a; i++) o.push([i, 0]);
    for (let j = 1; j < b; j++) o.push([a - 1, j]);
    for (let i = a - 2; i >= 0; i--) o.push([i, b - 1]);
    for (let j = b - 2; j >= 1; j--) o.push([0, j]);
    return o;
  }
  DH.obvodDrahy = obvod;

  /** bod na straně modulu (lokálně 0..M) */
  const bodStrany = (s, M) => ({ '-x': [0, M / 2], '+x': [M, M / 2], '-y': [M / 2, 0], '+y': [M / 2, M] })[s];

  /** osa drážky v modulu: [[x, y, s]] (s = délka od vstupu), typ geometrie */
  function osaDrazky(vstup, vystup, M) {
    const c = [M / 2, M / 2], pts = [];
    const A = vstup === 'shora' || vstup === 'start' ? c : bodStrany(vstup, M);
    const B = vystup === 'dolu' ? c : bodStrany(vystup, M);
    let geom;
    if (A === c || B === c) geom = A === c ? 'zacatek' : 'konec';
    else if (vystup === opak(vstup)) geom = 'rovna';
    else geom = 'zatacka';
    if (geom === 'zatacka') {
      // roh společný oběma stranám
      const sx = [vstup, vystup].find((q) => q[1] === 'x'), sy = [vstup, vystup].find((q) => q[1] === 'y');
      const rx = sx[0] === '+' ? M : 0, ry = sy[0] === '+' ? M : 0, R = M / 2;
      const a0 = Math.atan2(A[1] - ry, A[0] - rx), a1 = Math.atan2(B[1] - ry, B[0] - rx);
      let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const n = 16;
      for (let i = 0; i <= n; i++) { const a = a0 + da * i / n; pts.push([rx + R * Math.cos(a), ry + R * Math.sin(a), Math.abs(da) * R * i / n]); }
      return { geom, pts, delka: Math.abs(da) * R, R, roh: [rx, ry] };
    }
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = 8;
    for (let i = 0; i <= n; i++) pts.push([A[0] + (B[0] - A[0]) * i / n, A[1] + (B[1] - A[1]) * i / n, L * i / n]);
    return { geom, pts, delka: L };
  }
  DH.osaDrazky = osaDrazky;

  /**
   * Rozvržení věže.
   * p: {M, d (Ø kuličky), a, b, patra, s (modulů v patře), sklon (%), vule, hloubka (vstupní, mm), dno (min. tl. dna)}
   * → {bunky:[{i,j,k, vstup, vystup, geom, pts, delka, eIn, eOut, start, cil}], podpery:[{i,j,k}], chyby:[], sirka (drážky)}
   */
  DH.rozvrhDrahy = (p) => {
    const M = p.M, a = Math.max(2, Math.round(p.a)), b = Math.max(2, Math.round(p.b)), O = obvod(a, b), P = O.length;
    const s = Math.max(2, Math.min(P, Math.round(p.s))), n = Math.max(1, Math.round(p.patra)), sk = p.sklon / 100;
    const chyby = [], bunky = [];
    for (let L = 0; L < n; L++) {
      const k = n - 1 - L;
      let e = p.hloubka;
      for (let m = 0; m < s; m++) {
        const t = L * (s - 1) + m, [i, j] = O[t % P];
        let vstup, vystup;
        if (m === 0) vstup = L === 0 ? 'start' : 'shora';
        else { const [pi, pj] = O[(t - 1) % P]; vstup = opak(smerZ(i - pi, j - pj)); }
        if (m === s - 1) {
          if (L < n - 1) vystup = 'dolu';
          else {
            const ven = [];
            if (i === 0) ven.push('-x'); if (i === a - 1) ven.push('+x'); if (j === 0) ven.push('-y'); if (j === b - 1) ven.push('+y');
            vystup = ven.find((q) => q !== vstup) || ven[0];
          }
        } else { const [ni, nj] = O[(t + 1) % P]; vystup = smerZ(ni - i, nj - j); }
        const o = osaDrazky(vstup, vystup, M);
        const eIn = e, eOut = e + sk * o.delka;
        e = eOut;
        bunky.push(Object.assign({ i, j, k, vstup, vystup, eIn, eOut, start: m === 0 && L === 0, cil: L === n - 1 && m === s - 1, patro: L }, o));
      }
      const max = M - p.dno;
      if (e > max + 1e-9) chyby.push(`Patro ${L + 1}: drážka by na konci byla hluboká ${cz(e)} mm (víc než M − dno = ${cz(max)}). Snižte sklon nebo počet modulů v patře (max. sklon ${cz(100 * (max - p.hloubka) / bunky.slice(-s).reduce((q, c) => q + c.delka, 0), 1)} %).`);
    }
    // kolize (dvě buňky na stejném místě)
    const obs = new Set();
    for (const c of bunky) { const key = c.i + ',' + c.j + ',' + c.k; if (obs.has(key)) chyby.push(`Modul ${key} je v dráze dvakrát.`); obs.add(key); }
    // podpěry: pod každou buňkou až k zemi
    const podpery = [];
    const sloupce = {};
    for (const c of bunky) { const key = c.i + ',' + c.j; sloupce[key] = Math.max(sloupce[key] == null ? -1 : sloupce[key], c.k); }
    for (const [key, kmax] of Object.entries(sloupce)) {
      const [i, j] = key.split(',').map(Number);
      for (let k = 0; k < kmax; k++) if (!obs.has(i + ',' + j + ',' + k)) podpery.push({ i, j, k });
    }
    return { bunky, podpery, chyby, a, b, s, n, sirka: p.d + 2 * p.vule, M };
  };

  /** úhel, při kterém kulička přejede přes hranu drážky hloubky e (poloměr r) */
  const uhelHrany = (e, r) => (e >= r ? 80 * Math.PI / 180 : Math.acos(1 - e / r));

  /**
   * Simulace: valení po nakloněné drážce (a = 5/7·g·(sin θ − Crr·cos θ), v zatáčkách 2× odpor),
   * volný pád otvorem (kulička po dopadu konzervativně z klidu).
   * → {snimky:[[t, x, y, z]], cas, vMax, zastavena:{bunka}|null, zatacky:[{bunka, v, vMax, ok}], body (3D osa)}
   */
  DH.simulaceDrahy = (R, p) => {
    const M = R.M, r = p.d / 2, g = DH.G * 1000, Crr = p.crr, dt = 1 / 240;
    const sn = [], zat = [];
    let t = 0, v = 0, vMax = 0, zast = null;
    const svet = (c, q) => [c.i * M + q[0], c.j * M + q[1]];
    const zStredu = (c, sLok) => c.k * M + M - (c.eIn + (c.eOut - c.eIn) * (sLok / (c.delka || 1))) + r;
    let posledni = null;
    for (let ci = 0; ci < R.bunky.length && !zast; ci++) {
      const c = R.bunky[ci];
      // pád z předchozí buňky
      if (posledni && c.vstup === 'shora') {
        const z0 = posledni[3], z1 = zStredu(c, 0), h = Math.max(0, z0 - z1), tp = Math.sqrt(2 * h / g);
        for (let q = dt; q < tp; q += dt) sn.push([t + q, posledni[1], posledni[2], z0 - 0.5 * g * q * q]);
        t += tp; v = 0;
      }
      const theta = Math.atan(p.sklon / 100), crr = c.geom === 'zatacka' ? 2 * Crr : Crr;
      const acc = (5 / 7) * g * (Math.sin(theta) - crr * Math.cos(theta));
      let s = 0;
      const L = c.delka;
      const bodNa = (sl) => {
        const pts = c.pts; let i = 1; while (i < pts.length - 1 && pts[i][2] < sl) i++;
        const A = pts[i - 1], B = pts[i], f = (sl - A[2]) / ((B[2] - A[2]) || 1);
        const [x, y] = svet(c, [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]);
        return [x, y, zStredu(c, sl)];
      };
      if (c.geom === 'zatacka') {
        const e = Math.min(c.eIn, c.eOut), phi = uhelHrany(e, r), vm = Math.sqrt(g * c.R * Math.tan(phi));
        zat.push({ bunka: ci, vVstup: v, vMax: vm });
      }
      let kroku = 0;
      while (s < L) {
        if (acc <= 0 && v <= 1e-6) { zast = { bunka: ci, s }; break; }
        v = Math.max(0, v + acc * dt); s += v * dt; t += dt; vMax = Math.max(vMax, v);
        const q = bodNa(Math.min(s, L)); sn.push([t, q[0], q[1], q[2]]);
        if (++kroku > 2e5) { zast = { bunka: ci, s }; break; }
      }
      if (c.geom === 'zatacka') { const z = zat[zat.length - 1]; z.vVystup = v; z.v = Math.max(z.vVstup, v); z.ok = z.v <= z.vMax; }
      posledni = sn[sn.length - 1] || [t, ...bodNa(0)];
    }
    // výjezd do misky
    if (!zast && posledni) {
      const c = R.bunky[R.bunky.length - 1], [dx, dy] = SMERY[c.vystup] || [1, 0];
      for (let q = 0; q < 0.35; q += dt) { const x = posledni[1] + dx * v * q, y = posledni[2] + dy * v * q, z = Math.max(r + 4, posledni[3] - 0.5 * g * q * q); sn.push([t + q, x, y, z]); if (z <= r + 4) { v *= 0.98; } }
      t += 0.35;
    }
    return { snimky: sn, cas: t, vMax, zastavena: zast, zatacky: zat };
  };

  /** obrys kanálu drážky v modulu (pro 3D a šablonu): polygony šířky w podél osy + jamka / otvor */
  DH.kanalDrazky = (c, w, M, dOtv) => {
    const casti = DH.tlustaCara(c.pts.map((q) => [q[0], q[1]]), w);
    if (c.vstup === 'shora' || c.vstup === 'start') casti.push(DH.kruh(M / 2, M / 2, (c.start ? Math.max(dOtv, w * 1.6) : dOtv) / 2, 40));
    let k = DH.sjednot(casti);
    k = DH.prunik(k, [DH.obdelnik(0, 0, M, M)]);
    return k;
  };

  DH.GEN.draha = {
    nazev: 'Kuličková dráha', ikona: '🔮', typ: 'hracka',
    popis: 'Věž z kostek s drážkami pro kuličku: sklon, zatáčky, propady do nižšího patra, výpočet hloubek drážek, simulace kuličky.',
    pole: [
      { sk: 'Moduly a kulička' },
      { k: 'M', n: 'Modul (hrana kostky, mm)', t: 'n', min: 30, max: 100, krok: 1 },
      { k: 'd', n: 'Ø kuličky (mm)', t: 'n', min: 8, max: 40, krok: 0.5 },
      { k: 'vule', n: 'Vůle drážky na stranu (mm)', t: 'n', min: 0.3, max: 5, krok: 0.1 },
      { k: 'hloubka', n: 'Hloubka drážky na začátku patra (mm)', t: 'n', min: 3, max: 40, krok: 0.5 },
      { k: 'dno', n: 'Min. dřevo pod drážkou (mm)', t: 'n', min: 3, max: 30, krok: 0.5 },
      { k: 'otvor', n: 'Ø propadového otvoru (mm)', t: 'n', min: 8, max: 50, krok: 0.5 },
      { sk: 'Věž' },
      { k: 'a', n: 'Půdorys – modulů v x', t: 'n', min: 2, max: 6, krok: 1 },
      { k: 'b', n: 'Půdorys – modulů v y', t: 'n', min: 2, max: 6, krok: 1 },
      { k: 'patra', n: 'Počet pater s dráhou', t: 'n', min: 1, max: 12, krok: 1 },
      { k: 's', n: 'Modulů dráhy v jednom patře', t: 'n', min: 2, max: 20, krok: 1 },
      { k: 'sklon', n: 'Sklon drážky (%)', t: 'n', min: 0.5, max: 25, krok: 0.1 },
      { k: 'crr', n: 'Součinitel valivého odporu (typicky 0,005–0,02)', t: 'n', min: 0, max: 0.1, krok: 0.001 },
    ],
    vychozi: { M: 45, d: 16, vule: 1, hloubka: 10, dno: 8, otvor: 20, a: 2, b: 2, patra: 4, s: 4, sklon: 4, crr: 0.01 },
    predvolby: [
      { id: 'vez2', nazev: 'Věž 2 × 2, 4 patra (kulička 16 mm)', p: {} },
      { id: 'vez3', nazev: 'Šnek 3 × 3, 5 pater', p: { a: 3, b: 3, patra: 5, s: 6, sklon: 3.5, M: 45 } },
      { id: 'drevena', nazev: 'Velká kulička Ø 25 (dřevěná), modul 60', p: { M: 60, d: 25, hloubka: 14, otvor: 30, dno: 10, sklon: 5, crr: 0.015 } },
      { id: 'pomala', nazev: 'Pomalá – mírný sklon 2 %', p: { sklon: 2, patra: 6, s: 4 } },
    ],
    vypocet(p, spol) {
      const N = { typ: 'hracka', dily: [], telesa: [], kusovnik: [], bezpecnost: [], info: [], varovani: [], koty: [], tabulky: [], stl: [], male: [] };
      const R = DH.rozvrhDrahy(p), M = p.M, w = R.sirka, mat = (DH.MATERIALY[spol.material] || {}).nazev;
      N.draha = R;
      for (const c of R.chyby) N.varovani.push(c);
      if (p.otvor < p.d + 2) N.varovani.push(`Propadový otvor Ø ${cz(p.otvor)} je jen o ${cz(p.otvor - p.d)} mm větší než kulička – může se zaseknout (doporučeno ≥ Ø kuličky + 3 mm).`);
      if (p.hloubka < p.d * 0.35) N.varovani.push(`Drážka ${cz(p.hloubka)} mm je mělká (méně než 35 % Ø kuličky) – kulička vyskočí.`);
      if (p.sklon < 100 * p.crr * 1.5) N.varovani.push(`Sklon ${cz(p.sklon)} % je blízko valivému odporu (${cz(100 * p.crr)} %) – nepřesnost výroby kuličku zastaví. Doporučeno 3–6 %.`);
      if (w > M - 8) N.varovani.push('Drážka je skoro tak široká jako modul – stěny budou tenké.');
      // simulace
      const sim = DH.simulaceDrahy(R, p);
      N.sim = sim;
      if (sim.zastavena) N.varovani.push(`Simulace: kulička se zastaví v modulu ${sim.zastavena.bunka + 1} – zvyšte sklon.`);
      for (const z of sim.zatacky) if (!z.ok) N.varovani.push(`Zatáčka v modulu ${z.bunka + 1}: rychlost ${cz(z.v / 1000, 2)} m/s je větší než ${cz(z.vMax / 1000, 2)} m/s – kulička může vyjet přes okraj. Prohlubte drážku nebo snižte sklon.`);
      N.info.push(`Dráha: ${R.bunky.length} modulů s drážkou + ${R.podpery.length} plných, ${R.n} ${R.n === 1 ? 'patro' : R.n < 5 ? 'patra' : 'pater'}, výška věže ${cz(R.n * M)} mm, půdorys ${cz(R.a * M)} × ${cz(R.b * M)} mm.`);
      N.info.push(`Šířka drážky ${cz(w)} mm, hloubka ${cz(p.hloubka)} → ${cz(Math.max(...R.bunky.map((c) => c.eOut)))} mm, sklon ${cz(p.sklon)} % (${cz(Math.atan(p.sklon / 100) * 180 / Math.PI, 2)}°).`);
      if (!sim.zastavena) N.info.push(`Kulička dojede za ${cz(sim.cas, 1)} s, nejvyšší rychlost ${cz(sim.vMax / 1000, 2)} m/s (bez odrazů, po pádu z klidu).`);
      // moduly – skupiny podle geometrie a hloubek
      const sk = {}, klic = (c) => `${c.geom}|${c.start ? 'S' : ''}|${r1(Math.round(c.eIn * 2) / 2)}|${r1(Math.round(c.eOut * 2) / 2)}`;
      R.bunky.forEach((c, i) => { const k = klic(c); (sk[k] = sk[k] || { c, ks: 0, cisla: [] }).ks++; sk[k].cisla.push(i + 1); c.typId = k; });
      const NAZ = { rovna: 'rovná drážka', zatacka: 'zatáčka 90°', zacatek: 'příjem shora → strana', konec: 'strana → propad' };
      let poz = 1, idx = 0;
      for (const [k, q] of Object.entries(sk)) {
        const c = q.c, id = 'D' + (++idx);
        q.id = id;
        for (const b of R.bunky) if (b.typId === k) b.dilId = id;
        const kanal = DH.kanalDrazky(c, w, M, p.otvor);
        const ob = [{ b: DH.obdelnik(0, 0, M, M), typ: 'pomocna' }].concat(kanal.map((b) => ({ b, typ: 'gravir' })));
        ob.push({ b: c.pts.map((t) => [t[0], t[1]]), typ: 'osa', otevrena: true });
        const kruhy = [];
        if (c.vystup === 'dolu') kruhy.push({ x: M / 2, y: M / 2, r: p.otvor / 2, typ: 'otvor' });
        const A = c.pts[0], B = c.pts[c.pts.length - 1];
        const texty = [{ x: A[0], y: A[1] + 4, txt: `hl. ${cz(c.eIn)}`, h: 3 }, { x: B[0], y: B[1] - 6, txt: c.vystup === 'dolu' ? `hl. ${cz(c.eOut)} · otvor skrz` : `hl. ${cz(c.eOut)}`, h: 3 }];
        N.dily.push({ id, nazev: `${c.start ? 'start (miska) – ' : ''}${NAZ[c.geom]}`, ks: q.ks, tl: M, mat: spol.material, obrysy: ob, kruhy, texty, sablona: true, poznamka: `moduly č. ${q.cisla.join(', ')}`, modul: c });
        N.kusovnik.push(DH.polozka(poz++, `modul ${id} – ${c.start ? 'start, ' : ''}${NAZ[c.geom]}`, q.ks, DH.rozmerTxt(M, M, M), mat, `drážka š. ${cz(w)}, hloubka ${cz(c.eIn)} → ${cz(c.eOut)}${c.vystup === 'dolu' ? `, otvor Ø ${cz(p.otvor)} skrz` : ''}${c.geom === 'zatacka' ? `, R ${cz(M / 2)}` : ''}`));
        N.stl.push({ id: 'modul:' + id, nazev: `Modul ${id} (${NAZ[c.geom]})` });
      }
      if (R.podpery.length) N.kusovnik.push(DH.polozka(poz++, 'plný modul (podpěra)', R.podpery.length, DH.rozmerTxt(M, M, M), mat, 'bez drážky'));
      N.kusovnik.push(DH.polozka(poz++, 'záchytná miska / cíl', 1, DH.rozmerTxt(2 * M, M, M * 0.4), mat, 'vyfrézovaná prohlubeň nebo rámeček z lišt'));
      N.kusovnik.push(DH.polozka(poz++, 'kuličky', 4, `Ø ${cz(p.d)}`, p.d < 20 ? 'sklo' : 'buk / sklo', 'typické skleněné kuličky ~16 mm, dřevěné 20–25 mm'));
      N.male.push({ nazev: 'kulička', tvar: { typ: 'koule', d: p.d }, volny: true });
      if (p.d < 44.5) N.bezpecnost.push({ u: +spol.vek < 3 ? 'chyba' : 'pozor', t: `Kulička Ø ${cz(p.d)} mm je malý díl / malá koule (americká ASTM F963 zakazuje koule < 44,5 mm pro děti do 3 let). Kuličková dráha je hračka od 3 let – označit „Nevhodné pro děti do 3 let“.` });
      // 3D: moduly
      let poradi = 0;
      const tel = (c, podpera) => ({ typ: 'modul', x: c.i * M, y: c.j * M, z: c.k * M, M, sx: M, sy: M, sz: M, barva: podpera ? '#c99a62' : ['#e6c896', '#d9b98a'][(c.i + c.j + c.k) % 2], sklad: c.k * 100 + (poradi++), bunka: podpera ? null : c, w, otvor: p.otvor });
      const vse = R.bunky.map((c) => ({ c, pod: false })).concat(R.podpery.map((c) => ({ c, pod: true }))).sort((A, B) => A.c.k - B.c.k);
      for (const q of vse) N.telesa.push(tel(q.c, q.pod));
      // miska u výjezdu
      const cl = R.bunky[R.bunky.length - 1], [dx, dy] = SMERY[cl.vystup] || [1, 0];
      const mx = cl.i * M + (dx > 0 ? M + 6 : dx < 0 ? -2 * M - 6 : -M / 2), my = cl.j * M + (dy > 0 ? M + 6 : dy < 0 ? -M - 6 : 0);
      N.telesa.push({ typ: 'box', x: mx, y: my, z: 0, sx: dx ? 2 * M : 2 * M, sy: M, sz: 6, barva: '#b98552', sklad: 99999 });
      for (const [ox, oy, sx, sy] of [[0, 0, 2 * M, 5], [0, M - 5, 2 * M, 5], [0, 0, 5, M], [2 * M - 5, 0, 5, M]]) N.telesa.push({ typ: 'box', x: mx + ox, y: my + oy, z: 6, sx, sy, sz: M * 0.3, barva: '#b98552', sklad: 99999 });
      N.kulicka = { r: p.d / 2 };
      // stabilita věže (dítě do ní strčí)
      const hm = vse.map((q) => ({ m: M ** 3 * 1e-9 * DH.hustota(spol.material) * 0.9, x: q.c.i * M + M / 2, y: q.c.j * M + M / 2, z: q.c.k * M + M / 2 }));
      const op = [[0, 0], [R.a * M, 0], [R.a * M, R.b * M], [0, R.b * M]];
      const st = DH.stabilita(hm, op, { F: 5, z: R.n * M, smer: [1, 0] });
      N.stabilita = st;
      N.info.push(`Věž převrhne vodorovná síla ${cz(st.Fkrit, 1)} N na horní hraně (statický úhel převržení ${cz(st.uhel, 0)}°). Moduly stačí volně skládat; u vyšších věží než 4 × půdorys je slepte nebo spojte kolíky.`);
      if (R.n * M > 4 * Math.min(R.a, R.b) * M) N.bezpecnost.push({ u: 'pozor', t: 'Věž je vysoká vůči půdorysu – snadno se převrhne. Spojte moduly kolíky nebo rozšiřte půdorys.' });
      N.bezpecnost.push({ u: 'ok', t: `Otvor Ø ${cz(p.otvor)} mm a drážka ${cz(w)} mm jsou mimo pásmo 5–12 mm, kde uvíznou prsty${(p.otvor > 5 && p.otvor < 12) || (w > 5 && w < 12) ? ' – POZOR, tady ne!' : ''}.` });
      if ((p.otvor > 5 && p.otvor < 12) || (w > 5 && w < 12)) N.bezpecnost.push({ u: 'chyba', t: 'Drážka nebo otvor v pásmu 5–12 mm – riziko uvíznutí prstu.' });
      N.animace = { sklad: true, kulicka: true };
      N.koty.push({ pohled: 'predni', txt: 'věž' });
      return N;
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DH;
})(typeof window !== 'undefined' ? window : globalThis);
