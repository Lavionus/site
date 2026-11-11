/* French cleat – technický výkres (bez DOM, běží i v node).
   Obrysy pohledů dodá geometrie (projekce tělesa: sit.pohledy.bok / cela / shora), výkres k nim přidá lištu, zeď, osy a kóty.
   Nárys (zepředu) vlevo nahoře, profil zboku vpravo (zeď vlevo, jak se díl věší), pohled shora pod nárysem (zeď nahoře).
   vykres(p, o, pohledy, {datum}) → {W, H, meritko, m, prvky}  (mm papíru, y dolů)
   svg(v) → text SVG v mm; pdf(jsPDF, v, {pismo, nazev}) → dokument jsPDF. */
(function () {
  'use strict';
  const U = typeof module !== 'undefined' ? require('./jadro.js') : window.CLEAT;
  const fmt = (x, d = 1) => U.fmt(x, d);
  const S = { vid: 0.5, skr: 0.3, osa: 0.18, kota: 0.18, tenka: 0.25 };
  const W = 297, H = 210, OKRAJ = 10;
  const MERITKA = [[1, '1:1'], [0.5, '1:2'], [0.2, '1:5'], [0.1, '1:10']];

  function pohled(nazev) {
    const P = { nazev, prvky: [], koty: [], pozn: [] };
    P.cara = (b, typ = 'vid', z = false) => { P.prvky.push({ t: 'l', b, z, typ }); return P; };
    P.osa = (a, b) => P.cara([a, b], 'osa');
    P.kota = (p1, p2, n, od, txt) => { P.koty.push({ p1, p2, n, od, txt }); return P; };
    P.retez = (body, n, od) => { for (let i = 1; i < body.length; i++) P.kota(body[i - 1], body[i], n, od, null); return P; };
    return P;
  }
  const meze = polys => {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const pl of polys) for (const [x, y] of pl) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    return b;
  };

  function sestavPohledy(p, o, ph) {
    const nar = pohled('POHLED ZEPŘEDU'), bok = pohled('PROFIL ZBOKU – zeď vlevo'), shora = pohled('POHLED SHORA – zeď nahoře');
    ph.cela.forEach(pl => nar.cara(pl, 'vid', true));
    ph.bok.forEach(pl => bok.cara(pl, 'vid', true));
    ph.shora.forEach(pl => shora.cara(pl.map(([x, y]) => [x, -y]), 'vid', true));
    const bN = meze(ph.cela), bB = meze(ph.bok), bS = meze(ph.shora);
    const { T, H: Hl, pokles } = o;
    // lišta a zeď v profilu
    const lista = [[0, 0], [T, 0], [T, Hl], [0, Hl - pokles]];
    if (p.typ !== 'lista') bok.cara(lista, 'skr', true);
    const zMin = Math.min(bB[1], 0) - 6, zMax = Math.max(bB[3], Hl) + 6;
    const yz = o.yZed || 0;
    bok.cara([[yz, zMin], [yz, zMax]], 'tenka');
    for (let z = zMin + 4; z < zMax; z += 6) bok.cara([[yz, z], [yz - 3, z - 3]], 'tenka');   // šrafy zdi
    if (yz < -0.5) bok.cara([[yz, zMin], [0, zMin], [0, zMax], [yz, zMax]], 'skr');           // kontralať za lištou
    shora.cara([[bS[0] - 6, -yz], [bS[2] + 6, -yz]], 'tenka');
    for (let x = bS[0] - 2; x < bS[2] + 6; x += 6) shora.cara([[x, -yz], [x - 3, 3 - yz]], 'tenka');

    nar.kota([bN[0], bN[1]], [bN[2], bN[1]], [0, -1], 8, null);
    nar.kota([bN[2], bN[1]], [bN[2], bN[3]], [1, 0], 8, null);
    if (p.typ !== 'lista') bok.kota([0, bB[3]], [bB[2], bB[3]], [0, 1], 8, null);
    if (p.typ === 'zkouska') {
      const Z = o.zkouska;
      bok.kota([0, 0], [0, Hl], [-1, 0], 10, null).kota([0, 0], [T, 0], [0, -1], 6, null);
      if (Z.druh === 'merka') nar.pozn.push(`měrka profilu lišty ${fmt(T)} × ${fmt(Hl)} mm, úkos ${fmt(o.al)}°, výřez + ${fmt(Z.vule, 1)} mm, tloušťka ${fmt(Z.tl)} mm`);
      else {
        if (Z.vzorky.length) nar.retez([[Z.vzorky[0].x0, bN[3]], ...Z.vzorky.map(v => [v.x1, bN[3]])], [0, 1], 6);
        nar.pozn.push(`${Z.vzorky.length} zkušebních zámků, vůle ${Z.vule.map(c => fmt(c, 2)).join(' / ')} mm`);
      }
      return [nar, bok, shora];
    }
    if (p.typ === 'lista' && o.lista.druh !== 'dil') {
      const L = o.lista;
      nar.pozn.push(L.druh === 'koncovka' ? `koncovka lišty ${fmt(T)} × ${fmt(Hl)} mm, stěna ${fmt(p.lista.stena)}, nasunutí ${fmt(p.lista.hloubkaKoncovky)} mm`
        : `distanční podložka ${fmt(p.lista.velPodlozky)} × ${fmt(p.lista.velPodlozky)} × ${fmt(p.lista.tlPodlozky)} mm, otvor pro vrut ${fmt(L.d.v.d)}`);
      return [nar, bok, shora];
    }
    if (p.typ === 'lista') {
      const L = o.lista;
      bok.kota([0, 0], [T, 0], [0, -1], 7, null).kota([T, 0], [T, Hl], [1, 0], 7, null).kota([0, 0], [0, Hl - pokles], [-1, 0], 8, null);
      bok.osa([-2, L.zs], [T + 2, L.zs]);
      if (L.xs.length) {
        nar.retez([[bN[0], L.zs], ...L.xs.map(x => [x, L.zs])], [0, 1], bN[3] - L.zs + 6);
        nar.kota([L.xs[0], 0], [L.xs[0], L.zs], [-1, 0], 4, null);
        for (const x of L.xs) { nar.osa([x, L.zs - L.d.rh - 2], [x, L.zs + L.d.rh + 2]); nar.osa([x - L.d.rh - 2, L.zs], [x + L.d.rh + 2, L.zs]); }
      }
      bok.pozn.push(`úkos ${fmt(o.al)}° (horní plocha klesá ke zdi o ${fmt(pokles)} mm)`, `vrut ${fmt(L.d.v.d)}, otvor Ø ${fmt(L.d.v.otvor)}, zápustná hlava Ø ${fmt(2 * L.d.rh)}`);
      if (L.rybina) nar.pozn.push(`rybina ${fmt(L.dl)} mm, úhel 15°, vůle ${fmt(L.vule, 2)} mm`);
      if (L.zarezy.length) nar.pozn.push(`${L.zarezy.length} zářezů pro zub držáku po ${fmt(p.lista.zarezy)} mm`);
      return [nar, bok, shora];
    }
    // držák: lišta, zámek, záda
    bok.kota([0, 0], [0, Hl], [-1, 0], 10, null).kota([0, 0], [T, 0], [0, -1], 6, null);
    bok.kota([bB[2], bB[1]], [bB[2], bB[3]], [1, 0], 8, null);
    bok.pozn.push(`lišta ${fmt(T)} × ${fmt(Hl)} mm, úkos ${fmt(o.al)}°, vůle ${fmt(o.c, 2)} mm, ${o.zaves ? `mezera za lištou ${fmt(-o.yZed)} mm` : `od zdi ${fmt(o.gw)} mm`}`,
      `záda ${fmt(o.b)} mm, zámek ${o.zaves ? `závěs přes lištu, pás ${fmt(p.zada.nad)} mm, ocas ${fmt(p.zada.ocas)} mm za lištu` : o.kopieUkosu ? `kopíruje úkos, pás ${fmt(p.zada.nad)} mm` : `${fmt(p.zada.nad)} mm nad lištou`}, ${fmt(o.H - o.zBot)} mm pod horní hranou`);
    if (p.typ === 'hak') {
      const h = o.hak, q = p.hak;
      bok.kota([o.y0, o.zBot], [o.y0 + q.dosah, o.zBot], [0, -1], 14, null);
      if (q.tvar === 'J' || q.tvar === 'dvojity') bok.pozn.push(`hák: dosah ${fmt(q.dosah)}, špička ${fmt(h.vyskaSpicky)} nad ramenem, R ${fmt(h.Rin)}, tl. ${fmt(h.t0)} → ${fmt(h.t1)}${q.zahnuti ? `, zahnutí ${fmt(q.zahnuti)}°` : ''}`);
      if (q.tvar === 'dvojity') bok.pozn.push(`druhý hák: ${fmt(q.odstup2)} mm nad prvním, dosah ${fmt(q.dosah2)}, špička ${fmt(h.druhy.vyskaSpicky)}`);
      if (h.vDrazka) nar.pozn.push(`${h.vDrazka.xs.length} × V-drážka ve špičce: nahoře ${fmt(h.vDrazka.w0)}, dole ${fmt(h.vDrazka.wd)} mm, hloubka ${fmt(h.vDrazka.hd)} mm, stěny ${U.ZUBY[q.vZuby]}${h.vDrazka.ro ? `, otvor Ø ${fmt(2 * h.vDrazka.ro)}` : ''}`);
      if (q.vyskaRamene > 0) bok.pozn.push(`rameno ${fmt(q.vyskaRamene)} mm nad spodkem zad${h.vzpera ? `, vzpěra ${fmt(h.vzpera.ts)} mm do ${fmt(h.vzpera.a)} mm od zad` : ''}`);
      if (q.tvar === 'J' || q.tvar === 'dvojity') { /* popsáno výše */ }
      else if (q.tvar === 'role') bok.pozn.push(`tyč na roli Ø ${fmt(q.prumerTyce)}, délka ${fmt(h.delkaTyce)} mm, zarážka na konci`);
      else if (q.tvar === 'kolik') bok.pozn.push(`kolík: délka ${fmt(q.dosah)}, ${fmt(q.uhel)}° nahoru, tl. ${fmt(h.t0)} → ${fmt(h.t1)}${q.koule ? `, kulička Ø ${fmt(q.koule)}` : ''}`);
      else bok.pozn.push(`kolébka: lůžko Ø ${fmt(2 * h.rr, 1)} (tyč Ø ${fmt(q.prumerTyce)}), rohy ${fmt(h.roh)} nad středem`);
      if (!h.celou) nar.retez(h.xs.flat().map(x => [x, bN[3]]), [0, 1], 6);
    } else if (p.typ === 'police') {
      const q = o.police;
      bok.kota([o.y0, o.zTop], [o.y0 + q.D, o.zTop], [0, 1], 16, null);
      bok.pozn.push(`police: deska ${fmt(q.tp)}, lem ${fmt(q.lem)} × ${fmt(q.tl)}, vzpěra ${U.VZPERY[q.vzpera]}${p.police.sklon ? `, sklon ${fmt(p.police.sklon)}°` : ''}`);
    } else if (p.typ === 'svorka') {
      const q = o.svorka, P = p.svorka;
      if (q.tvar === 'klip') {
        bok.pozn.push(`klip na tyč Ø ${fmt(P.prumer)}: kroužek Ø ${fmt(2 * q.Ri, 2)} uvnitř, stěna ${fmt(P.stena)}, otvor ${fmt(q.otv, 1)} mm${P.nabeh ? `, náběh ${fmt(P.nabeh)}` : ''}`);
        if (q.svisle) shora.retez([[0, -q.uc], ...q.xs.map(x => [x, -q.uc])], [0, -1], bS[3] - q.uc + 8);
      } else {
        nar.retez([[0, q.zt], ...q.xs.map(x => [x, q.zt])], [0, 1], bN[3] - q.zt + 6);
        nar.pozn.push(`${q.n} × V-drážka: nahoře ${fmt(q.w0)}, dole ${fmt(q.wd)} mm, hloubka ${fmt(q.hd)} mm, stěny ${U.ZUBY[P.zuby]}${q.ro ? `, otvor Ø ${fmt(2 * q.ro)}` : ''}`);
      }
    } else if (p.typ === 'stojan' && o.stojan.vrtaky) {
      const q = o.stojan;
      for (const t of q.otvory) { shora.osa([t.x - t.d / 2 - 1.5, -t.y], [t.x + t.d / 2 + 1.5, -t.y]); shora.osa([t.x, -t.y - t.d / 2 - 1.5], [t.x, -t.y + t.d / 2 + 1.5]); }
      shora.pozn.push(`sada ${q.otvory.length} vrtáků ${fmt(q.prumery[0])}–${fmt(q.prumery[q.prumery.length - 1])} mm, otvor = Ø + ${fmt(p.stojan.vuleVrtaku, 2)} mm`);
      bok.pozn.push(`${q.rady.length} ${q.rady.length > 1 ? 'schody' : 'schod'} po ${fmt(p.stojan.schod)} mm, deska ${fmt(q.tp)} mm${p.stojan.popisky ? `, popisky ${fmt(p.stojan.vyskaPisma)} mm vyryté ${fmt(p.stojan.hloubkaPisma)} mm` : ''}`);
    } else if (p.typ === 'stojan') {
      const q = o.stojan, P = p.stojan;
      const xs = [...new Set(q.otvory.filter(t => t.rada === 0).map(t => t.x))];
      shora.retez([[bS[0], -q.yr[0]], ...xs.map(x => [x, -q.yr[0]])], [0, -1], bS[3] - q.yr[0] + 8);
      shora.kota([bS[2], 0], [bS[2], -q.yr[0]], [1, 0], 6, null);
      for (const t of q.otvory) { shora.osa([t.x - q.dx / 2 - 2, -t.y], [t.x + q.dx / 2 + 2, -t.y]); shora.osa([t.x, -t.y - q.dy / 2 - 2], [t.x, -t.y + q.dy / 2 + 2]); }
      shora.pozn.push(P.druh === 'drazka' ? `${P.pocet} drážek ${fmt(P.sirkaDrazky)} × ${fmt(q.dy)} mm${q.hrdlo ? `, hrdlo ${fmt(q.hrdlo)}` : ''}${q.nabeh ? `, náběh ${fmt(q.nabeh)}` : ''}` : `${q.otvory.length} × ${P.druh === 'sestihran' ? 'šestihran ' + fmt(P.prumer) : 'Ø ' + fmt(P.prumer)}${q.slepe ? `, hloubka ${fmt(q.hloubka)}` : ' skrz'}${q.sraz > 0.05 ? `, sražení ${fmt(q.sraz)}` : ''}`);
    } else if (p.typ === 'kapsa') {
      const q = o.kapsa;
      bok.pozn.push((q.tvar === 'kulata' ? `${q.xs.length} kelímky Ø ${fmt(2 * q.Ri)} uvnitř, stěna ${fmt(q.s)}` : `kapsa: stěna ${fmt(q.s)}, přihrádky ${fmt(q.wc)} mm${q.sikme ? `, čelo ${fmt(p.kapsa.celo)} %` : ''}`)
        + (q.dnoTyp === 'plne' ? `, dno ${fmt(q.sd)}` : q.dnoTyp === 'prstenec' ? `, prstenec lem ${fmt(q.lem)}` : ', bez dna'));
    } else if (p.typ === 'deska') {
      const q = o.deska, P = p.deska;
      const xs = [...new Set(q.otvory.map(t => t[0]))], zs = [...new Set(q.otvory.map(t => t[1]))];
      if (xs.length) nar.retez([[bN[0], bN[3]], ...xs.map(x => [x, bN[3]])], [0, 1], 6);
      if (zs.length) nar.retez([[bN[0], bN[1]], ...zs.map(z => [bN[0], z])], [-1, 0], 6);
      for (const [x, z] of q.otvory) { nar.osa([x - 6, z], [x + 6, z]); nar.osa([x, z - 6], [x, z + 6]); }
      if (q.pruvlaky.length) nar.pozn.push(`${q.pruvlaky.length} × pár průvlaků ${fmt(q.ws)} × ${fmt(q.sirS)} mm, rozteč ${fmt(q.a)}, drážka vzadu ${fmt(q.drazka)} mm`);
      if (q.kolejnice && q.kolejnice.length) nar.pozn.push(`${q.kolejnice.length} × kolejnička ${U.KOLEJNICE[P.kolTvar]} ${fmt(P.kolSirka)} / krk ${fmt(P.kolKrk)} × ${fmt(P.kolVyska)} mm, délka ${fmt(P.kolDelka)}${P.kolDoraz ? `, doraz ${fmt(P.kolDoraz)}` : ''}`);
      if (P.magnety) nar.pozn.push(`${P.magnety} × kapsa na magnet Ø ${fmt(P.magPrumer)} × ${fmt(P.magVyska)} mm zezadu, krytí ${fmt(P.magKryti)} mm`);
      if (q.otvory.length) nar.pozn.push(`${q.otvory.length} × ${P.otvory === 'zepredu' ? `předvrtání Ø ${fmt(q.pilot)} hl. ${fmt(o.b - 1)}` : `Ø ${fmt(q.d.v.otvor)}`}${P.otvory === 'zezadu' ? `, zápustná hlava vzadu Ø ${fmt(2 * q.d.rh)}` : P.otvory === 'matice' ? `, matice ${P.sroub} vzadu` : ''}`);
    }
    if (o.zub) bok.pozn.push(`zub proti posunu ${fmt(p.zada.zubSirka)} mm, hloubka ${fmt(p.zada.zubHloubka)} mm – do lišty zářez`);
    if (p.zada.odlehceni !== 'zadne') nar.pozn.push(`odlehčení zad: ${U.ODLEHCENI[p.zada.odlehceni]} ${fmt(p.zada.velOdlehceni)} mm`);
    if (p.zada.hrany === 'oble' && p.zada.sraz > 0) nar.pozn.push(`boky zaoblené R ${fmt(p.zada.sraz)}`);
    if (o.pojistka) nar.pozn.push(`pojistný vrut 3 mm: x ${fmt(o.pojistka.x)}, z ${fmt(o.pojistka.z)} od spodku lišty`);
    return [nar, bok, shora];
  }

  /* ---------- rozvržení na list (jako Úhelníky) ---------- */
  function rezervy(P) {
    const R = { l: 6, r: 6, t: 6, b: 6 };
    for (const k of P.koty) {
      const m = k.od + 7, [nx, ny] = k.n;
      if (Math.abs(nx) > 0.7) R[nx < 0 ? 'l' : 'r'] = Math.max(R[nx < 0 ? 'l' : 'r'], m);
      else if (Math.abs(ny) > 0.7) R[ny > 0 ? 't' : 'b'] = Math.max(R[ny > 0 ? 't' : 'b'], m);
    }
    R.t += 8;
    return R;
  }
  function mezePohledu(P) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const e of P.prvky) for (const [x, y] of e.b) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    return b;
  }
  function vykres(p, o, ph, opt = {}) {
    const pohledy = sestavPohledy(p, o, ph);
    const bb = pohledy.map(mezePohledu), rez = pohledy.map(rezervy);
    const textu = i => Math.max(0, ...pohledy[i].pozn.map(t => t.length * 1.45 + 4));
    const vel = (b, m, i) => [Math.max((b[2] - b[0]) * m + rez[i].l + rez[i].r, rez[i].l + textu(i)), (b[3] - b[1]) * m + rez[i].t + rez[i].b + 5 * pohledy[i].pozn.length];
    let volba = MERITKA[MERITKA.length - 1], rozm = null;
    for (const mm of MERITKA) {
      const [nN, nB, nP] = bb.map((b, i) => vel(b, mm[0], i));
      const sir = Math.max(nN[0], nP[0]) + nB[0], vys = Math.max(nN[1], nB[1]) + nP[1];
      const razitko = Math.max(nN[0], nP[0]) + 95 <= W - 2 * OKRAJ || Math.max(nN[1], nB[1]) + nP[1] + 26 <= H - 2 * OKRAJ;
      if (sir <= W - 2 * OKRAJ && vys <= H - 2 * OKRAJ - 6 && razitko) { volba = mm; rozm = { nN, nB, nP }; break; }
    }
    const m = volba[0];
    if (!rozm) { const [nN, nB, nP] = bb.map((b, i) => vel(b, m, i)); rozm = { nN, nB, nP }; }
    const sl1 = Math.max(rozm.nN[0], rozm.nP[0]), r1 = Math.max(rozm.nN[1], rozm.nB[1]);
    const x0 = OKRAJ + 2, y0 = OKRAJ + 1;
    const polohy = [[x0, y0], [x0 + sl1, y0], [x0, y0 + r1]];
    const prvky = [];
    const L = (b, typ, z) => prvky.push({ t: 'l', b, z, s: S[typ] || typ, d: typ === 'skr' ? 'c' : typ === 'osa' ? 'o' : undefined });
    const Tx = (x, y, txt, h = 3, a = 'l', u = 0) => prvky.push({ t: 'txt', x, y, txt, h, a, u });
    pohledy.forEach((P, i) => {
      const b = bb[i], [ox, oy] = polohy[i], REZ = rez[i];
      const map = ([u, v]) => [ox + REZ.l + (u - b[0]) * m, oy + REZ.t + (b[3] - v) * m];
      Tx(ox + REZ.l, oy + 5, P.nazev, 3.5);
      for (const e of P.prvky) L(e.b.map(map), e.typ, e.z);
      for (const k of P.koty) kota(map(k.p1), map(k.p2), [k.n[0], -k.n[1]], k.od, k.txt != null ? k.txt : fmt(Math.hypot(k.p2[0] - k.p1[0], k.p2[1] - k.p1[1]), 1), L, Tx);
      const yp = oy + REZ.t + (b[3] - b[1]) * m + REZ.b;
      P.pozn.forEach((t, j) => Tx(ox + REZ.l, yp + 5 * j, t, 2.8));
    });
    L([[OKRAJ, OKRAJ], [W - OKRAJ, OKRAJ], [W - OKRAJ, H - OKRAJ], [OKRAJ, H - OKRAJ]], 0.5, true);
    const rx = W - OKRAJ - 95, ry = H - OKRAJ - 24;
    L([[rx, ry], [W - OKRAJ, ry], [W - OKRAJ, H - OKRAJ], [rx, H - OKRAJ]], 0.5, true);
    L([[rx, ry + 10], [W - OKRAJ, ry + 10]], 0.25); L([[rx + 45, ry + 10], [rx + 45, H - OKRAJ]], 0.25);
    Tx(rx + 2, ry + 7, (p.nazev || U.TYPY[p.typ].nazev).slice(0, 48), 4.2);
    Tx(rx + 2, ry + 15, `Měřítko ${volba[1]}`, 3); Tx(rx + 2, ry + 21, 'Rozměry v mm', 2.6);
    Tx(rx + 47, ry + 15, `${U.MATERIALY[p.tisk.material].nazev} · ${opt.datum || ''}`, 2.6);
    Tx(rx + 47, ry + 21, 'github_site – French cleat', 2.6);
    const kx = OKRAJ + 4, ky = H - OKRAJ - 4;
    L([[kx, ky], [kx + 50 * m, ky]], 0.35); L([[kx, ky - 1.5], [kx, ky + 1]], 0.25); L([[kx + 50 * m, ky - 1.5], [kx + 50 * m, ky + 1]], 0.25);
    Tx(kx + 50 * m + 2, ky + 1, '= 50 mm (kontrola měřítka – tiskněte ve skutečné velikosti 100 %)', 2.4);
    return { W, H, meritko: volba[1], m, prvky };
  }
  function kota(P1, P2, n, od, txt, L, T) {
    const d = [P2[0] - P1[0], P2[1] - P1[1]], l = Math.hypot(d[0], d[1]);
    if (l < 0.3) return;
    const u = [d[0] / l, d[1] / l], D1 = [P1[0] + n[0] * od, P1[1] + n[1] * od], D2 = [P2[0] + n[0] * od, P2[1] + n[1] * od];
    L([[P1[0] + n[0], P1[1] + n[1]], [D1[0] + n[0] * 1.5, D1[1] + n[1] * 1.5]], 'kota');
    L([[P2[0] + n[0], P2[1] + n[1]], [D2[0] + n[0] * 1.5, D2[1] + n[1] * 1.5]], 'kota');
    L([D1, D2], 'kota');
    const sip = (B, s) => L([[B[0] + s * (u[0] * 2.5 - u[1] * 0.8), B[1] + s * (u[1] * 2.5 + u[0] * 0.8)], B, [B[0] + s * (u[0] * 2.5 + u[1] * 0.8), B[1] + s * (u[1] * 2.5 - u[0] * 0.8)]], 'kota');
    sip(D1, 1); sip(D2, -1);
    let uhel = Math.atan2(-u[1], u[0]) * 180 / Math.PI;
    if (uhel > 90.5 || uhel <= -89.5) uhel += 180;
    if (uhel > 180) uhel -= 360;
    const ur = uhel * Math.PI / 180, nahoru = [-Math.sin(ur), -Math.cos(ur)];
    const kratka = l < 9, M = kratka ? [D2[0] + u[0] * 4, D2[1] + u[1] * 4] : [(D1[0] + D2[0]) / 2, (D1[1] + D2[1]) / 2];
    T(M[0] + nahoru[0] * 0.8, M[1] + nahoru[1] * 0.8, txt, 2.8, kratka ? 'l' : 'c', uhel);
  }

  /* ---------- výstupy ---------- */
  const n3 = x => (Math.round(x * 1000) / 1000).toString();
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dash = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(s * 8)} ${n3(s * 5)}"` : d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '');
  function svg(v, o = {}) {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${o.sirkaPx ? 'width="100%"' : `width="${v.W}mm" height="${v.H}mm"`} viewBox="0 0 ${v.W} ${v.H}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`
      + `<rect width="${v.W}" height="${v.H}" fill="#ffffff"/>`;
    for (const e of v.prvky) {
      if (e.t === 'l') s += `<path d="${e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(q[1])).join('')}${e.z ? 'Z' : ''}" fill="none" stroke="#000" stroke-width="${n3(e.s)}" stroke-linecap="round" stroke-linejoin="round"${dash(e.d, Math.max(0.2, e.s))}/>`;
      else {
        const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(e.y)})"` : '';
        s += `<text x="${n3(e.x)}" y="${n3(e.y)}" font-size="${n3(e.h)}" text-anchor="${an}" fill="#000"${rot}>${esc(e.txt)}</text>`;
      }
    }
    return s + '</svg>';
  }
  const bezDiakritiky = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/→/g, '->');
  function pdf(jsPDF, v, opt = {}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
    let uni = false;
    if (opt.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', opt.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
    doc.setProperties({ title: opt.nazev || 'Výkres', creator: 'French cleat – výkres' });
    doc.setDrawColor(0, 0, 0); doc.setTextColor(0, 0, 0);
    for (const e of v.prvky) {
      if (e.t === 'txt') {
        const t = uni ? e.txt : bezDiakritiky(e.txt);
        doc.setFontSize(e.h / 0.3528);
        const w = doc.getTextWidth(t), kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0, ur = (e.u || 0) * Math.PI / 180;
        doc.text(t, e.x - Math.cos(ur) * kk, e.y + Math.sin(ur) * kk, e.u ? { angle: e.u } : undefined);
        continue;
      }
      doc.setLineWidth(e.s);
      const sd = Math.max(0.2, e.s);
      if (e.d === 'c') doc.setLineDashPattern([sd * 8, sd * 5], 0); else if (e.d === 'o') doc.setLineDashPattern([sd * 30, sd * 8, sd * 4, sd * 8], 0);
      if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
      else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
      if (e.d) doc.setLineDashPattern([], 0);
    }
    return doc;
  }

  const API = { vykres, svg, pdf, MERITKA };
  if (typeof module !== 'undefined') module.exports = API; else window.CLEAT_VYKRES = API;
})();
