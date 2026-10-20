/* ============================================================
   Šablony oblouků a profilů – režimy: nohy, soustružení, lišty, opěradla, luby (bez DOM)
   Registruje se do OBLR.REZIMY (viz rezimy.js).
   ============================================================ */
(function (koren) {
  'use strict';
  const O = koren.OBL || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const KR = koren.OBLK || (typeof require !== 'undefined' ? require('./kresba.js') : null);
  const R0 = koren.OBLR || (typeof require !== 'undefined' ? require('./rezimy.js') : null);
  const PI = Math.PI, cz = KR.cz, { c, mm, st, deska } = R0.pom, REZIMY = R0.REZIMY, vysledek = R0.vysledek;

  /* ================= kabriolová noha ================= */
  // klasická předloha (Queen Anne) v poměrech: z / L (0 = podlaha), x / a (0 = vnitřní roh)
  const KABRIOLY = {
    klasicka: {
      n: 'Queen Anne – klasická',
      predni: [[0, 0.88], [0.03, 0.92], [0.06, 0.82], [0.10, 0.69], [0.16, 0.66], [0.30, 0.72], [0.45, 0.82], [0.58, 0.94], [0.66, 1.0], [0.72, 0.98], [0.77, 0.86], [0.80, 0.64, 1], [1.0, 0.64]],
      zadni: [[0, 0.16], [0.05, 0.18], [0.10, 0.26], [0.16, 0.28], [0.28, 0.26], [0.45, 0.20], [0.62, 0.12], [0.74, 0.04], [0.80, 0.0, 1], [1.0, 0.0]],
    },
    stihla: {
      n: 'Štíhlá – odkládací stolek',
      predni: [[0, 0.82], [0.03, 0.88], [0.07, 0.78], [0.12, 0.70], [0.30, 0.70], [0.50, 0.78], [0.62, 0.90], [0.69, 0.96], [0.74, 0.93], [0.78, 0.72, 1], [1.0, 0.72]],
      zadni: [[0, 0.20], [0.06, 0.24], [0.12, 0.27], [0.30, 0.26], [0.50, 0.19], [0.66, 0.08], [0.78, 0.0, 1], [1.0, 0.0]],
    },
  };
  function kabriolZPredlohy(id, L, a, g) {
    const P = KABRIOLY[id] || KABRIOLY.klasicka, prev = (q) => ({ z: O.r2(q[0] * L / g), x: O.r2(q[1] * a / g), zlom: !!q[2] });
    return { predni: P.predni.map(prev), zadni: P.zadni.map(prev) };
  }
  /** přepočet předlohy na polotovar: z do L, x do a (anizotropně) */
  function prizpusobKabriol(p) {
    const g = c(p.g, 25, 1), L = c(p.L, 700, 50), a = c(p.a, 70, 10);
    const vse = (p.predni || []).concat(p.zadni || []);
    const zmax = Math.max(...vse.map((q) => O.cislo(q.z, 0))), xmax = Math.max(...vse.map((q) => O.cislo(q.x, 0)));
    if (!(zmax > 0 && xmax > 0)) return p;
    const kz = L / g / zmax, kx = a / g / xmax, f = (q) => ({ z: O.r2(O.cislo(q.z, 0) * kz), x: O.r2(O.cislo(q.x, 0) * kx), zlom: !!q.zlom });
    return Object.assign({}, p, { predni: p.predni.map(f), zadni: p.zadni.map(f) });
  }
  const sloupceKabriol = [{ k: 'z', n: 'z (čtv.)' }, { k: 'x', n: 'x (čtv.)' }, { k: 'zlom', n: 'roh', t: 'b' }];
  const vychKab = kabriolZPredlohy('klasicka', 700, 70, 25);
  REZIMY.kabriol = {
    nazev: 'Kabriolová noha', ikona: '🦵', skupina: 'nohy',
    popis: 'Prohnutá noha (cabriole) z předlohy v mřížce: přední a zadní čára jako spline, šablona 1:1 k obkreslení na dvě sousední plochy hranolu, oba pohledy a 3D tvar po vyřezání pásovou pilou.',
    vychozi: { L: 700, a: 70, g: 25, predloha: 'klasicka', predni: vychKab.predni, zadni: vychKab.zadni, mrizka: true },
    pole: [
      { k: 'L', n: 'Délka nohy L (mm)', t: 'n', min: 100, max: 1200, krok: 1 },
      { k: 'a', n: 'Průřez hranolu a × a (mm)', t: 'n', min: 20, max: 200, krok: 1 },
      { k: 'g', n: 'Mřížka: 1 čtverec = (mm)', t: 'n', min: 2, max: 100, krok: 0.5 },
      { k: 'mrizka', n: 'Tisknout mřížku na šablonu', t: 'b' },
      { k: 'predni', n: 'Přední čára (koleno, špička) – ve čtvercích mřížky', t: 'tab', sloupce: sloupceKabriol, novy: () => ({ z: 0, x: 1 }) },
      { k: 'zadni', n: 'Zadní čára – ve čtvercích mřížky', t: 'tab', sloupce: sloupceKabriol, novy: () => ({ z: 0, x: 0.5 }) },
    ],
    predvolby: [
      { n: 'Queen Anne – jídelní stůl 700 / 70', p: Object.assign({ L: 700, a: 70, g: 25, predloha: 'klasicka' }, kabriolZPredlohy('klasicka', 700, 70, 25)) },
      { n: 'Queen Anne – židle 440 / 55', p: Object.assign({ L: 440, a: 55, g: 20, predloha: 'klasicka' }, kabriolZPredlohy('klasicka', 440, 55, 20)) },
      { n: 'Štíhlá – stolek 560 / 50', p: Object.assign({ L: 560, a: 50, g: 20, predloha: 'stihla' }, kabriolZPredlohy('stihla', 560, 50, 20)) },
    ],
    vypocet(p) {
      const V = vysledek(), L = c(p.L, 700, 100), a = c(p.a, 70, 20), g = c(p.g, 25, 1);
      const mmUzly = (u) => (u || []).map((q) => ({ z: O.cislo(q.z, NaN) * g, x: O.cislo(q.x, NaN) * g, zlom: !!q.zlom })).filter((q) => isFinite(q.z) && isFinite(q.x));
      const Pp = mmUzly(p.predni), Pz = mmUzly(p.zadni);
      if (Pp.length < 2 || Pz.length < 2) { V.varovani.push('Přední i zadní čára potřebují aspoň 2 body.'); V.dily.push({ id: 'A', nazev: 'Profil', prvky: [], obrys: null, stl: false }); return V; }
      const N = O.kabriol(Pp, Pz, L, a, 1.5);
      V.varovani.push(...N.varovani);
      const zmax = Math.max(...Pp.concat(Pz).map((q) => q.z));
      if (Math.abs(zmax - L) > 1) V.varovani.push(`Předloha je vysoká ${mm(zmax, 0)}, noha ${mm(L, 0)} – použijte „Přizpůsobit předlohu polotovaru“ nebo změňte mřížku.`);
      const polygon = (dx, zrc) => O.zjednodus(N.rezy.map((q) => [q.x1, q.z]), 0.02).concat(O.zjednodus(N.rezy.slice().reverse().map((q) => [q.x0, q.z]), 0.02)).map((q) => [dx + (zrc ? a - q[0] : q[0]), q[1]]);
      const obr = O.odstranDuplicity(polygon(0, false));
      // A – šablona profilu
      const K = KR.nova();
      if (p.mrizka !== false) K.mrizka(0, 0, Math.ceil(a / g) * g, Math.ceil(L / g) * g, g, true);
      K.car([[0, 0], [a, 0], [a, L], [0, L]], 'pomocna', { z: true });
      K.car(obr, 'obrys', { z: true });
      for (const q of Pp) K.bod(q.x, q.z, 0.9, 'druha');
      for (const q of Pz) K.bod(q.x, q.z, 0.9, 'druha');
      const kot = N.kotnik, kol = N.koleno, rz = (z) => N.rezy.reduce((b, q) => (Math.abs(q.z - z) < Math.abs(b.z - z) ? q : b));
      const qk = rz(kot.z), ql = rz(kol.z);
      K.kota([qk.x0, qk.z], [qk.x1, qk.z], 0, 'kotník ' + cz(kot.s, 1), { bezVynasecek: true });
      K.kota([ql.x0, ql.z], [ql.x1, ql.z], 0, 'koleno ' + cz(kol.s, 1), { bezVynasecek: true });
      K.kota([a, 0], [a, L], -12, 'L ' + cz(L, 0)).kota([0, 0], [a, 0], -(p.mrizka !== false ? 9 : 6), 'a ' + cz(a, 0));
      K.text(a + 2, L - 6, 'hlava (čtyřhran)', 2.4, 'l', 0, 'pomocna').text(-2, L / 2, 'vnitřní roh – plocha k lubům', 2.4, 'c', 90, 'pomocna');
      K.text(a / 2, -16, 'obkreslit na 2 sousední plochy', 2.4, 'c', 0, 'kota');
      V.dily.push({ id: 'A', nazev: 'Šablona profilu 1:1', prvky: K.prvky, obrys: [obr], stl: true });
      // B – dva pohledy
      const K2 = KR.nova(), dx = a + 45;
      K2.car([[0, 0], [a, 0], [a, L], [0, L]], 'pomocna', { z: true }).car(obr, 'obrys', { z: true });
      const obr2 = polygon(dx, true);
      K2.car([[dx, 0], [dx + a, 0], [dx + a, L], [dx, L]], 'pomocna', { z: true }).car(obr2, 'obrys', { z: true });
      for (const [z, t] of [[kot.z, 'kotník'], [kol.z, 'koleno']]) { K2.car([[-6, z], [dx + a + 6, z]], 'pomocna'); K2.text(dx + a + 7, z - 0.8, t, 2.4, 'l', 0, 'pomocna'); }
      K2.text(a / 2, -6, 'plocha 1', 2.8, 'c', 0, 'kota').text(dx + a / 2, -6, 'plocha 2 (otočeno o 90°)', 2.8, 'c', 0, 'kota');
      K2.kota([0, L], [a, L], 6, cz(a, 0)).kota([dx, L], [dx + a, L], 6, cz(a, 0));
      // řez v kotníku a kolenu – pohled shora
      const yR = -40;
      for (const [q, t, x0] of [[qk, 'řez v kotníku', 0], [ql, 'řez v koleni', dx]]) {
        K2.car([[x0, yR - a], [x0 + a, yR - a], [x0 + a, yR], [x0, yR]], 'pomocna', { z: true });
        K2.car([[x0 + q.x0, yR - a + q.x0], [x0 + q.x1, yR - a + q.x0], [x0 + q.x1, yR - a + q.x1], [x0 + q.x0, yR - a + q.x1]], 'krivka', { z: true });
        K2.text(x0 + a / 2, yR - a - 5, t + ' ' + cz(q.x1 - q.x0, 1) + ' × ' + cz(q.x1 - q.x0, 1), 2.4, 'c', 0, 'kota');
      }
      V.dily.push({ id: 'B', nazev: 'Dva pohledy a řezy', prvky: K2.prvky, obrys: null, stl: false });
      V.hodnoty.push(['Polotovar', `${cz(a, 0)} × ${cz(a, 0)} × ${cz(L, 0)} mm`], ['Mřížka', `${cz(g, 1)} mm (${cz(L / g, 1)} × ${cz(a / g, 1)} čtverců)`], ['Kotník (nejužší)', `${mm(kot.s, 1)} ve výšce ${mm(kot.z, 0)}`],
        ['Koleno (nejširší)', `${mm(kol.s, 1)} ve výšce ${mm(kol.z, 0)}`], ['Odpad po vyřezání', cz(100 * (1 - N.rezy.reduce((s, q) => s + Math.pow(Math.max(0, q.x1 - q.x0), 2), 0) / N.rezy.length / (a * a)), 0) + ' %']);
      V.tabulky.push({ nazev: 'Šířka profilu po výšce', hlavicka: ['z od podlahy', 'zadní čára x', 'přední čára x', 'šířka'], radky: N.rezy.filter((_, i) => i % Math.max(1, Math.round(N.rezy.length / 30)) === 0).map((q) => [cz(q.z, 0), cz(q.x0, 1), cz(q.x1, 1), cz(q.x1 - q.x0, 1)]) });
      V.kusovnik.push(['Hranol na nohu', 4, `${cz(a, 0)} × ${cz(a, 0)} × ${cz(L + 20, 0)}`, 'tvrdé dřevo (třešeň, ořech, buk)', 'rovná vlákna, letokruhy úhlopříčně, +20 mm na délku'], ['Šablona', 1, `${cz(a, 0)} × ${cz(L, 0)}`, 'MDF 4–6 mm / překližka', 'nebo 3D tisk (STL)']);
      V.teleso = { typ: 'loft', rezy: N.rezy.map((q) => ({ z: q.z, x0: q.x0, x1: q.x1, y0: q.x0, y1: q.x1 })), a };
      V.info = `Kotník ${mm(kot.s, 1)}, koleno ${mm(kol.s, 1)}.`;
      return V;
    },
  };

  /* ================= kuželová noha ================= */
  REZIMY.kuzel = {
    nazev: 'Kuželová noha', ikona: '📐', skupina: 'nohy',
    popis: 'Noha zúžená na 1–4 stranách (taper). Úbytek na stranu, úhel, nastavení přípravku na okružní pilu pro 1. a 2. průchod, výkres saní a podložka pro protilehlé plochy.',
    vychozi: { L: 720, a: 45, b: 28, s: 120, strany: '2s', sirkaJig: 200 },
    pole: [
      { k: 'L', n: 'Délka nohy L (mm)', t: 'n', min: 100, max: 1500, krok: 1 },
      { k: 'a', n: 'Průřez nahoře a × a (mm)', t: 'n', min: 15, max: 200, krok: 0.5 },
      { k: 'b', n: 'Rozměr u paty b (mm)', t: 'n', min: 5, max: 200, krok: 0.5 },
      { k: 's', n: 'Čtyřhran nahoře (nezužuje se) s (mm)', t: 'n', min: 0, max: 600, krok: 1 },
      { k: 'strany', n: 'Zúžené strany', t: 'v', m: [['1', '1 strana'], ['2s', '2 sousední (vnitřní) strany'], ['2p', '2 protilehlé strany'], ['4', 'všechny 4 strany']] },
      { k: 'sirkaJig', n: 'Šířka saní přípravku (mm)', t: 'n', min: 100, max: 400, krok: 5 },
    ],
    predvolby: [
      { n: 'Jídelní stůl – 2 vnitřní strany', p: { L: 720, a: 45, b: 28, s: 120, strany: '2s' } },
      { n: 'Konferenční stolek – 4 strany', p: { L: 420, a: 40, b: 22, s: 90, strany: '4' } },
      { n: 'Shaker noční stolek', p: { L: 640, a: 38, b: 22, s: 140, strany: '2s' } },
    ],
    vypocet(p) {
      const V = vysledek(), L = c(p.L, 720, 100), a = c(p.a, 45, 15), b = Math.min(c(p.b, 28, 5), a - 0.5), s = Math.min(c(p.s, 120, 0), L - 20);
      const N = O.kuzelovaNoha(L, a, b, s, p.strany || '2s');
      // A – pohledy
      const K = KR.nova(), dx = a + 50;
      const obrysPohledu = (osa, x0) => { const p0 = O.prurezKuzelu(N, 0, osa), pz = O.prurezKuzelu(N, N.lz, osa); return O.odstranDuplicity([[x0 + p0[0], 0], [x0 + p0[1], 0], [x0 + pz[1], N.lz], [x0 + a, L], [x0, L], [x0 + pz[0], N.lz]]); };
      const A1 = obrysPohledu('x', 0), A2 = obrysPohledu('y', dx);
      K.car(A1, 'obrys', { z: true }).car(A2, 'obrys', { z: true });
      for (const x0 of [0, dx]) { K.car([[x0 - 4, N.lz], [x0 + a + 4, N.lz]], 'pomocna'); K.car([[x0 + a / 2, -4], [x0 + a / 2, L + 4]], 'osa'); }
      K.text(dx + a + 6, N.lz - 0.8, 'začátek zúžení', 2.4, 'l', 0, 'pomocna');
      K.kota([0, L], [a, L], 6, 'a ' + cz(a, 1)).kota([dx, L], [dx + a, L], 6, 'a ' + cz(a, 1));
      const pa = O.prurezKuzelu(N, 0, 'x'), pb = O.prurezKuzelu(N, 0, 'y');
      K.kota([pa[0], 0], [pa[1], 0], -7, cz(pa[1] - pa[0], 1)).kota([dx + pb[0], 0], [dx + pb[1], 0], -7, cz(pb[1] - pb[0], 1));
      K.kota([0, 0], [0, L], 10, 'L ' + cz(L, 0)).kota([dx + a, N.lz], [dx + a, L], -10, 's ' + cz(s, 0)).kota([dx + a, 0], [dx + a, N.lz], -10, 'zúžení ' + cz(N.lz, 0));
      K.text(a / 2, -16, 'pohled na plochu 1', 2.6, 'c', 0, 'kota').text(dx + a / 2, -16, 'pohled na plochu 2', 2.6, 'c', 0, 'kota');
      K.text(dx + a + 6, N.lz / 2, `α = ${cz(N.uhelSt, 2)}°`, 2.8, 'l', 0, 'kota');
      V.dily.push({ id: 'A', nazev: 'Pohledy na nohu 1:1', prvky: K.prvky, obrys: [A1], stl: true });
      // B – saně (přípravek na okružní pilu)
      const K2 = KR.nova(), Wj = Math.max(c(p.sirkaJig, 200, 100), a + 80), x0 = 40, Lj = L + x0 + 40, ta = Math.tan(N.uhel);
      K2.car([[0, 0], [Lj, 0], [Lj, Wj], [0, Wj]], 'obrys', { z: true });
      K2.car([[0, 0], [Lj, 0]], 'druha').text(Lj / 2, 2, 'HRANA SANÍ = LINIE KOTOUČE (ořízne se prvním průchodem)', 2.6, 'c', 0, 'druha');
      const fence = (u, styl, popis) => {
        // pravítko: přímka přes (x0, a − u) a (x0 + lz, a); prodloužená po celé délce saní
        const k = u / N.lz, y = (x) => a - u + k * (x - x0);
        K2.car([[x0 - 20, y(x0 - 20)], [Lj - 10, y(Lj - 10)]], styl);
        K2.text(Lj - 12, y(Lj - 12) + 1.5, popis, 2.4, 'r', O.deg(Math.atan(k)), styl === 'druha' ? 'druha' : 'kota');
        return y;
      };
      const y1 = fence(N.u, 'krivka', '1. průchod – pravítko (opěrná plocha nohy)');
      if (N.pruchody.some((q) => q.posun > N.u * 1.5)) fence(2 * N.u, 'provazek', '2. průchod (protilehlé plochy) – nebo podložka tl. u u paty');
      // noha (čárkovaně): referenční plocha na pravítku
      const nohaY = (x) => y1(x) - a;
      K2.car([[x0, nohaY(x0)], [x0 + L, nohaY(x0 + L)], [x0 + L, y1(x0 + L)], [x0, y1(x0)]], { s: 0.3, c: '#444444', d: 'c', v: 'pomocna' }, { z: true });
      K2.text(x0 + L / 2, (nohaY(x0 + L / 2) + y1(x0 + L / 2)) / 2, 'noha (pata u zarážky)', 2.6, 'c', O.deg(Math.atan(N.u / N.lz)), 'pomocna');
      K2.car([[x0 - 18, y1(x0) - a - 2], [x0, y1(x0) - a - 2], [x0, y1(x0) + 25], [x0 - 18, y1(x0) + 25]], 'krivka', { z: true }).text(x0 - 9, y1(x0) + 28, 'zarážka paty', 2.4, 'c', 0, 'kota');
      for (const f of [0.35, 0.8]) { const x = x0 + L * f; K2.car([[x - 15, y1(x) - a * 0.5], [x + 15, y1(x) - a * 0.5], [x + 15, y1(x) + 30], [x - 15, y1(x) + 30]], 'pomocna', { z: true }); K2.text(x, y1(x) + 33, 'upínka', 2.4, 'c', 0, 'pomocna'); }
      K2.kota([x0, 0], [x0, a - N.u], -6, cz(a - N.u, 1)).kota([x0 + N.lz, 0], [x0 + N.lz, a], -6, cz(a, 1)).kota([x0, Wj], [x0 + N.lz, Wj], 6, 'délka zúžení ' + cz(N.lz, 0));
      K2.text(8, Wj - 8, `Saně ${cz(Lj, 0)} × ${cz(Wj, 0)} mm, překližka 12–18 mm. Úhel pravítka ${cz(N.uhelSt, 2)}°.`, 3, 'l', 0, 'krivka');
      K2.text(8, Wj - 13, 'Ruce vždy na saních a na posunovači, nikdy ne mezi nohu a kotouč; kryt a rozpěrný klín ponechat.', 2.6, 'l', 0, 'druha');
      V.dily.push({ id: 'B', nazev: 'Přípravek na okružní pilu (saně)', prvky: K2.prvky, obrys: [[[0, 0], [Lj, 0], [Lj, Wj], [0, Wj]]], stl: false, proc: 'Saně jsou delší než tisková plocha – vyrobte je z překližky podle výkresu (DXF pro CNC).' });
      if (p.strany === '2p' || p.strany === '4') {
        const K3 = KR.nova(), pod = [[0, 0], [60, 0], [60, 25], [0, 25]];
        K3.car(pod, 'obrys', { z: true }).text(30, 14, `podložka tl. ${cz(N.u, 2)} mm`, 3, 'c', 0, 'krivka').text(30, 8, 'vložit mezi pravítko a zúženou plochu u paty', 2.2, 'c', 0, 'pomocna');
        V.dily.push({ id: 'C', nazev: 'Podložka pro 2. průchod', prvky: K3.prvky, obrys: [pod], stl: true, tlStl: Math.max(0.4, N.u) });
      }
      V.hodnoty.push(['Úbytek na zúženou stranu u', mm(N.u, 2)], ['Úhel zúžení α', st(N.uhelSt)], ['Délka zúžení', mm(N.lz, 0)], ['Průřez u paty', `${cz(N.patX, 1)} × ${cz(N.patY, 1)} mm`],
        ['Posun pravítka na 300 mm (1. průchod)', mm(300 * ta, 2)]);
      V.tabulky.push({ nazev: 'Průchody na pile', hlavicka: ['průchod', 'plocha', 'úhel pravítka', 'posun u paty', 'poznámka'], radky: N.pruchody.map((q, i) => [String(i + 1), String(q.strana), st(O.deg(q.uhel)), mm(q.posun, 2), q.pozn || ''].slice(0, 5)) });
      V.kusovnik.push(['Hranol na nohu', 4, `${cz(a + 3, 0)} × ${cz(a + 3, 0)} × ${cz(L + 15, 0)}`, 'tvrdé dřevo', 'po srovnání na a × a × L'], ['Saně', 1, `${cz(Lj, 0)} × ${cz(Wj, 0)} × 15`, 'překližka / MDF', 'rovná hrana podél podélného pravítka'],
        ['Opěrné pravítko', 1, `${cz(L + 40, 0)} × 40 × 18`, 'překližka', 'přišroubovat pod úhlem α'], ['Zarážka paty', 1, `60 × ${cz(a + 30, 0)} × 18`, 'překližka', ''], ['Vodorovná rychloupínka', 2, 'typická, upínací síla ≥ 100 kg', 'kov', 'vruty 4 × 20'], ['Vruty', 8, '4 × 30', 'ocel', 'mimo dráhu kotouče']);
      V.teleso = { typ: 'loft', rezy: [0, N.lz, L].map((z) => { const x = O.prurezKuzelu(N, z, 'x'), y = O.prurezKuzelu(N, z, 'y'); return { z, x0: x[0], x1: x[1], y0: y[0], y1: y[1] }; }), a };
      V.info = `Úbytek ${mm(N.u, 2)} na stranu, úhel ${st(N.uhelSt)}.`;
      return V;
    },
  };

  /* ================= soustružený profil ================= */
  const prv = (typ, l, d1, d2, dx) => ({ typ, l, d1, d2: d2 == null ? d1 : d2, dx: dx == null ? d1 : dx });
  const ctyrPrvni = (Pr) => Pr.prvky.some((q) => q.typ === 'ctyrhran');
  const PREDVOLBY_SOUSTRUH = [
    { n: 'Noha stolu 720 (čtyřhran + korálky)', p: { prvky: [prv('ctyrhran', 130, 64), prv('koralek', 14, 52, 52, 60), prv('vyzlabek', 18, 54, 54, 40), prv('ogee', 50, 44, 58), prv('valec', 20, 58), prv('kuzel', 400, 56, 34), prv('koralek', 12, 32, 32, 38), prv('kuzel', 60, 34, 28), prv('zaobleni', 16, 28, 20)] } },
    { n: 'Kuželka 300', p: { prvky: [prv('zaobleni', 12, 54, 60), prv('koralek', 150, 60, 60, 100), prv('vyzlabek', 60, 58, 58, 34), prv('koralek', 50, 36, 36, 52), prv('zaobleni', 28, 46, 6)] } },
    { n: 'Svícen 220', p: { prvky: [prv('valec', 16, 90), prv('ogee', 30, 88, 40), prv('koralek', 12, 36, 36, 46), prv('kuzel', 110, 32, 26), prv('koralek', 10, 28, 28, 36), prv('vyzlabek', 22, 40, 40, 30), prv('valec', 20, 46)] } },
    { n: 'Rukojeť dláta 130', p: { prvky: [prv('valec', 18, 22), prv('koralek', 6, 24, 24, 28), prv('ogee', 34, 26, 34), prv('kuzel', 56, 34, 30), prv('zaobleni', 16, 30, 16)] } },
    { n: 'Sloupek zábradlí 800', p: { prvky: [prv('ctyrhran', 100, 50), prv('koralek', 12, 40, 40, 46), prv('vyzlabek', 16, 42, 42, 30), prv('ogee', 120, 32, 44), prv('koralek', 120, 44, 44, 60), prv('ogee', 80, 44, 30), prv('koralek', 12, 30, 30, 40), prv('kuzel', 190, 34, 34), prv('ctyrhran', 150, 50)] } },
    { n: 'Příčka židle (Windsor) 400', p: { prvky: [prv('valec', 25, 16), prv('kuzel', 80, 18, 24), prv('koralek', 10, 24, 24, 30), prv('koralek', 170, 24, 24, 32), prv('koralek', 10, 24, 24, 30), prv('kuzel', 80, 24, 18), prv('valec', 25, 16)] } },
  ];
  REZIMY.soustruh = {
    nazev: 'Soustružený profil', ikona: '🏺', skupina: 'nohy',
    popis: 'Editor profilu soustruženého dílu z prvků (válec, kužel, korálek, výžlabek, ogee, zaoblení, čtyřhran). Výkres s průměry, kontrolní šablona (negativ), měrka průměrů s výřezy, rozměrová lať a 3D rotační těleso.',
    vychozi: Object.assign({ vule: 0.3, m: 25, vuleMerky: 0, hloubkaVyrezu: 18 }, JSON.parse(JSON.stringify(PREDVOLBY_SOUSTRUH[0].p))),
    pole: [
      { k: 'prvky', n: 'Prvky profilu zleva doprava (Ø v mm)', t: 'tab', sloupce: [{ k: 'typ', n: 'prvek', t: 'v', m: Object.entries(O.TYPY_PRVKU) }, { k: 'l', n: 'délka' }, { k: 'd1', n: 'Ø začátek' }, { k: 'd2', n: 'Ø konec' }, { k: 'dx', n: 'Ø vrchol/dno' }], novy: (p) => { const q = (p.prvky || [])[p.prvky.length - 1]; return prv('valec', 30, q ? O.cislo(q.d2, 40) : 40); } },
      { k: 'vule', n: 'Vůle kontrolní šablony (mm)', t: 'n', min: 0, max: 3, krok: 0.05 },
      { k: 'm', n: 'Šířka šablony nad profilem (mm)', t: 'n', min: 10, max: 100, krok: 1 },
      { k: 'vuleMerky', n: 'Přídavek výřezů měrky (mm, + = širší)', t: 'n', min: -1, max: 2, krok: 0.05 },
      { k: 'hloubkaVyrezu', n: 'Hloubka výřezů měrky (mm)', t: 'n', min: 8, max: 40, krok: 1 },
    ],
    predvolby: PREDVOLBY_SOUSTRUH,
    vypocet(p) {
      const V = vysledek(), Pr = O.profilSoustruhu(p.prvky || [], 0.4);
      V.varovani.push(...Pr.varovani);
      if (!Pr.prvky.length) { V.varovani.push('Přidejte aspoň jeden prvek.'); V.dily.push({ id: 'A', nazev: 'Profil', prvky: [], obrys: null, stl: false }); return V; }
      const Ld = Pr.delka, rM = Pr.dMax / 2;
      Pr.prvky.forEach((q, i) => {
        if (q.typ === 'ctyrhran') return;
        for (const s of [Pr.prvky[i - 1], Pr.prvky[i + 1]]) if (s && s.typ === 'ctyrhran' && Math.max(q.F.r1, q.F.r2, q.F.extrem ? q.F.extrem.r : 0) * 2 > O.cislo(s.d1, 0) + 1e-6) V.varovani.push(`Prvek ${i + 1} má průměr větší než sousední čyřhran – nevyjde z hranolu.`);
      });
      // A – výkres
      const K = KR.nova(), horni = O.zjednodus(Pr.body, 0.01), obr = O.odstranDuplicity(horni.concat(horni.slice().reverse().map((q) => [q[0], -q[1]])));
      K.car(obr, 'obrys', { z: true }).car([[-8, 0], [Ld + 8, 0]], 'osa');
      for (const h of Pr.hranice.slice(1, -1)) { const r = Math.max(h.dL, h.dP) / 2; K.car([[h.z, -r], [h.z, r]], 'tenka'); }
      for (const q of Pr.prvky) if (q.typ === 'ctyrhran') { const r = O.cislo(q.d1, 0) * Math.SQRT2 / 2; K.car([[q.z0, r], [q.z1, r]], 'pomocna').car([[q.z0, -r], [q.z1, -r]], 'pomocna'); K.text((q.z0 + q.z1) / 2, 2, '□ ' + cz(O.cislo(q.d1, 0), 1), 2.6, 'c', 0, 'kota'); }
      const yc = rM + 8;
      Pr.prvky.forEach((q, i) => { K.kota([q.z0, yc], [q.z1, yc], 0, cz(q.z1 - q.z0, 1), { bezVynasecek: true, h: 2.2 }); K.text((q.z0 + q.z1) / 2, yc + 4.5, String(i + 1), 2.2, 'c', 0, 'pomocna'); });
      for (const h of Pr.hranice) K.car([[h.z, Math.max(h.dL, h.dP) / 2 + 1], [h.z, yc + 1.5]], 'kota');
      K.kota([0, -rM], [Ld, -rM], -12, 'celková délka ' + cz(Ld, 1));
      const unik = []; for (const k of Pr.koty) if (k.typ !== 'ctyrhran' && k.d > 0.5 && !unik.some((u) => Math.abs(u.z - k.z) < 0.5 && Math.abs(u.d - k.d) < 0.05)) unik.push(k);
      unik.forEach((k, i) => { const y = -rM - 22 - (i % 3) * 5; K.car([[k.z, -k.d / 2], [k.z, y + 2]], 'tenka'); K.text(k.z, y - 0.8, 'Ø' + cz(k.d, 1), 2.2, 'c', 0, 'kota'); });
      V.dily.push({ id: 'A', nazev: 'Výkres profilu 1:1', prvky: K.prvky, obrys: null, stl: false });
      // B – kontrolní šablona (negativ)
      const vule = c(p.vule, 0.3, 0), m = c(p.m, 25, 10), yT = rM + vule + m;
      const prof = O.zjednodus(Pr.body.slice(1, -1).map((q) => [q[0], q[1] + vule]), 0.01);
      const sab = O.odstranDuplicity([[prof[0][0], yT]].concat(prof, [[prof[prof.length - 1][0], yT]]));
      const K2 = KR.nova();
      K2.car(sab, 'obrys', { z: true }).car([[-5, 0], [Ld + 5, 0]], 'osa').text(Ld / 2, 1.5, 'osa otáčení (nepatří k šabloně)', 2.4, 'c', 0, 'osa');
      Pr.prvky.forEach((q, i) => K2.text((q.z0 + q.z1) / 2, yT - 5, String(i + 1), 2.6, 'c', 0, 'pomocna'));
      K2.text(4, yT - 10, `vůle ${cz(vule, 2)} mm – přikládat jen k zastavenému dílu`, 2.4, 'l', 0, 'kota');
      K2.kota([0, yT], [Ld, yT], 6, cz(Ld, 1));
      V.dily.push({ id: 'B', nazev: 'Kontrolní šablona (negativ)', prvky: K2.prvky, obrys: [sab], stl: true });
      // C – měrka průměrů (výřezy)
      const prumery = []; for (const k of unik) if (!prumery.some((d) => Math.abs(d.d - k.d) < 0.05)) prumery.push(k);
      const dv = c(p.vuleMerky, 0, -1, 2), hv = c(p.hloubkaVyrezu, 18, 8), Hm = hv + 22, mez = 8, maxW = 205;
      const K3 = KR.nova(), merky = [];
      let rada = [], w = mez, yOff = 0;
      const dokonci = () => {
        if (!rada.length) return;
        const W = w, pol = [[0, 0]];
        for (const r of rada) { pol.push([r.x, 0], [r.x, hv], [r.x + r.s, hv], [r.x + r.s, 0]); }
        pol.push([W, 0], [W, Hm], [0, Hm]);
        const P = O.odstranDuplicity(pol).map((q) => [q[0], q[1] + yOff]);
        K3.car(P, 'obrys', { z: true });
        for (const r of rada) { K3.text(r.x + r.s / 2, yOff + hv + 9, '#' + r.i, 2.6, 'c', 0, 'krivka'); K3.text(r.x + r.s / 2, yOff + hv + 4, 'Ø' + cz(r.d, 1), 2.4, 'c', 0, 'kota'); K3.text(r.x + r.s / 2, yOff + hv + 14, 'z ' + cz(r.z, 0), 2, 'c', 0, 'pomocna'); }
        merky.push(P); yOff -= Hm + 12; rada = []; w = mez;
      };
      prumery.forEach((k, i) => { const s = Math.max(0.5, k.d + dv), sir = Math.max(s, 16); if (w + sir + mez > maxW && rada.length) dokonci(); rada.push({ x: w + (sir - s) / 2, s, d: k.d, z: k.z, i: i + 1 }); w += sir + mez; });
      dokonci();
      V.dily.push({ id: 'C', nazev: 'Měrka průměrů (výřezy)', prvky: K3.prvky, obrys: merky.length ? merky : null, stl: merky.length > 0, vice: true });
      // D – rozměrová lať
      const K4 = KR.nova(), Hl = 34, lat = [[0, 0], [Ld, 0], [Ld, Hl], [0, Hl]];
      K4.car(lat, 'obrys', { z: true });
      for (const h of Pr.hranice) K4.car([[h.z, 0], [h.z, Hl]], 'krivka');
      unik.forEach((k) => { if (k.kde === 'extrem') K4.car([[k.z, 0], [k.z, 9]], 'kota'); K4.text(k.z + (k.kde === 'konec' ? -1 : 1.2), 11, 'Ø' + cz(k.d, 1), 2.2, k.kde === 'konec' ? 'r' : 'l', 90, 'kota'); });
      Pr.prvky.forEach((q, i) => K4.text((q.z0 + q.z1) / 2, Hl - 5, String(i + 1), 2.6, 'c', 0, 'pomocna'));
      V.dily.push({ id: 'D', nazev: 'Rozměrová lať (story stick)', prvky: K4.prvky, obrys: [lat], stl: true });
      const ctyr = Pr.prvky.filter((q) => q.typ === 'ctyrhran'), dToc = Math.max(0, ...Pr.prvky.filter((q) => q.typ !== 'ctyrhran').map((q) => 2 * Math.max(q.F.r1, q.F.r2, q.F.extrem ? q.F.extrem.r : 0)));
      const hran = Math.max(Math.ceil(dToc + 6), ...ctyr.map((q) => O.cislo(q.d1, 0) + 3));
      V.hodnoty.push(['Celková délka', mm(Ld, 1)], [ctyrPrvni(Pr) ? 'Největší Ø (vč. úhlopříčky čtyřhranu)' : 'Největší Ø', mm(Pr.dMax, 1)], ['Nejmenší Ø', mm(Pr.dMin, 1)], ['Objem', cz(Pr.objem / 1000, 1) + ' cm³'], ['Polotovar', `${cz(hran, 0)} × ${cz(hran, 0)} × ${cz(Ld + 50, 0)} mm`], ['Počet prvků', String(Pr.prvky.length)]);
      V.tabulky.push({ nazev: 'Kótované průměry (měrka, posuvka, sizing tool)', hlavicka: ['#', 'z od levého konce', 'Ø', 'místo'], radky: unik.map((k, i) => [String(i + 1), cz(k.z, 1), cz(k.d, 2), k.popis]) });
      V.tabulky.push({ nazev: 'Prvky', hlavicka: ['#', 'prvek', 'od z', 'do z', 'Ø'], radky: Pr.prvky.map((q, i) => [String(i + 1), O.TYPY_PRVKU[q.typ] || q.typ, cz(q.z0, 1), cz(q.z1, 1), cz(2 * q.F.r1, 1) + (Math.abs(q.F.r2 - q.F.r1) > 1e-6 ? ' → ' + cz(2 * q.F.r2, 1) : '') + (q.F.extrem ? ' (' + cz(2 * q.F.extrem.r, 1) + ')' : '')]) });
      V.kusovnik.push(['Polotovar', 1, `${cz(hran, 0)} × ${cz(hran, 0)} × ${cz(Ld + 50, 0)}`, 'tvrdé dřevo', '+50 mm na upnutí mezi hroty'], ['Kontrolní šablona', 1, `${cz(Ld, 0)} × ${cz(yT, 0)}`, 'MDF / překližka 4 mm / 3D tisk', ''], ['Měrka průměrů', merky.length, `${prumery.length} výřezů`, 'PETG / překližka', 'výřezy ověřte posuvkou']);
      V.teleso = { typ: 'rotace', body: Pr.body, ctyrhrany: ctyr.map((q) => ({ z0: q.z0, z1: q.z1, a: O.cislo(q.d1, 0) })) };
      V.profil = Pr;
      V.info = `Délka ${mm(Ld, 1)}, Ø ${cz(Pr.dMin, 1)}–${cz(Pr.dMax, 1)} mm.`;
      return V;
    },
  };

  /* ================= profily lišt a hran ================= */
  REZIMY.lista = {
    nazev: 'Profily hran a lišt', ikona: '🪵', skupina: 'hrany',
    popis: 'Řez hrany desky nebo lišty: oblounek, výžlabek, ogee, římské ogee, fazeta, polodrážka. Kóty 1:1, doporučená fréza (poloměr, výška řezu, ložisko, počet průchodů) a kontrolní šablona.',
    vychozi: { typ: 'oblounek', T: 22, w: 60, R: 6, R2: 4, f: 0, a: 5, b: 5, obe: false, seznam: '3; 4; 5; 6; 6,35; 8; 9,5; 10; 12; 12,7; 15; 16; 19; 20; 25', pruchod: 3, delka: 300 },
    pole: [
      { k: 'typ', n: 'Profil', t: 'v', m: Object.entries(O.TYPY_LIST) },
      { k: 'T', n: 'Tloušťka desky T (mm)', t: 'n', min: 4, max: 120, krok: 0.5 },
      { k: 'R', n: 'Poloměr R (mm)', t: 'n', min: 0.5, max: 60, krok: 0.5, ukaz: (p) => !['fazeta', 'polodrazka'].includes(p.typ) },
      { k: 'R2', n: 'Druhý poloměr R2 (mm)', t: 'n', min: 0.5, max: 60, krok: 0.5, ukaz: (p) => p.typ === 'ogee' || p.typ === 'rimske' },
      { k: 'f', n: 'Osazení (schůdek) f (mm)', t: 'n', min: 0, max: 20, krok: 0.5, ukaz: (p) => p.typ === 'oblounek' || p.typ === 'vyzlabek' },
      { k: 'a', n: 'Šířka a (mm)', t: 'n', min: 0.5, max: 60, krok: 0.5, ukaz: (p) => p.typ === 'fazeta' || p.typ === 'polodrazka' },
      { k: 'b', n: 'Hloubka b (mm)', t: 'n', min: 0.5, max: 60, krok: 0.5, ukaz: (p) => p.typ === 'fazeta' || p.typ === 'polodrazka' },
      { k: 'obe', n: 'Profil i na spodní hraně', t: 'b' },
      { k: 'pruchod', n: 'Max. úběr na průchod (mm, typ. 3 tvrdé / 5 měkké)', t: 'n', min: 0.5, max: 15, krok: 0.5 },
      { k: 'seznam', n: 'Typické poloměry fréz (editovatelné)', t: 's' },
    ],
    predvolby: [
      { n: 'Hrana stolové desky – oblounek R6', p: { typ: 'oblounek', T: 26, R: 6, f: 0 } },
      { n: 'Oblounek s osazením R9,5 / 1,5', p: { typ: 'oblounek', T: 22, R: 9.5, f: 1.5 } },
      { n: 'Římské ogee – rám', p: { typ: 'rimske', T: 22, R: 5, R2: 5 } },
      { n: 'Výžlabek R12 – krycí lišta', p: { typ: 'vyzlabek', T: 20, R: 12, f: 0 } },
      { n: 'Fazeta 3 mm oboustranně', p: { typ: 'fazeta', T: 18, a: 3, b: 3, obe: true } },
      { n: 'Polodrážka 10 × 10 pro zadní stěnu', p: { typ: 'polodrazka', T: 18, a: 10, b: 10 } },
    ],
    vypocet(p) {
      const V = vysledek(), P = O.profilListy(p), K = KR.nova(), T = P.T, w = P.w;
      K.srafa(P.obrys, 3, 'material').car(P.obrys, 'krivka', { z: true });
      K.kota([w - P.sirka, T], [w, T], 8, cz(P.sirka, 1)).kota([w, T - P.vyska], [w, T], -8, cz(P.vyska, 1)).kota([0, 0], [0, T], 8, 'T ' + cz(T, 1));
      if (P.zbyvaBoku > 0.2) K.kota([w, P.obe ? P.vyska : 0], [w, T - P.vyska], -20, 'ložisko ' + cz(P.zbyvaBoku, 1));
      const s = P.krivka[Math.floor(P.krivka.length / 2)];
      const rTxt = p.typ === 'ogee' || p.typ === 'rimske' ? `R ${cz(c(p.R, 6), 1)} / R2 ${cz(c(p.R2, 4), 1)}` : p.typ === 'fazeta' ? `${cz(c(p.a, 5), 1)} × ${cz(c(p.b, 5), 1)}` : p.typ === 'polodrazka' ? `${cz(c(p.a, 5), 1)} × ${cz(c(p.b, 5), 1)}` : 'R ' + cz(c(p.R, 6), 1);
      const kon = [Math.min(s[0] - 14, w - P.sirka - 8), T + 14];
      K.car([s, kon], 'kota').text(kon[0] - 1, kon[1] + 0.5, rTxt, 2.8, 'r', 0, 'kota');
      K.text(0, T + 18, O.TYPY_LIST[p.typ] || 'profil', 3, 'l', 0, 'krivka');
      V.dily.push({ id: 'A', nazev: 'Řez profilu 1:1', prvky: K.prvky, obrys: [P.obrys], stl: false });
      // kontrolní šablona – negativ kolem rohu
      const o = 12, x0 = w - P.sirka - o, yb = T - P.vyska - o;
      const sab = O.odstranDuplicity([[x0, T]].concat(P.krivka, [[w, yb], [w + o + 6, yb], [w + o + 6, T + o + 6], [x0, T + o + 6]]));
      const K2 = KR.nova();
      K2.car(sab, 'obrys', { z: true }).car([[x0 - 10, T], [w - P.sirka, T]], 'pomocna').car([[w, yb], [w, yb - 10]], 'pomocna');
      K2.text(x0, T + o + 9, 'kontrolní šablona – přiložit k horní ploše a boku', 2.4, 'l', 0, 'kota');
      V.dily.push({ id: 'B', nazev: 'Kontrolní šablona (negativ)', prvky: K2.prvky, obrys: [sab], stl: true });
      const typ = O.typickyPolomer(c(p.R, 6), p.seznam), uber = Math.max(P.sirka, P.vyska), n = Math.max(1, Math.ceil(uber / c(p.pruchod, 3, 0.5)));
      V.hodnoty.push(['Profil', O.TYPY_LIST[p.typ] || ''], ['Šířka × výška profilu', `${cz(P.sirka, 1)} × ${cz(P.vyska, 1)} mm`], ['Fréza', P.frez], ['Výška řezu (vyložení)', mm(P.vyska, 1)]);
      if (!['fazeta', 'polodrazka'].includes(p.typ)) V.hodnoty.push(['Poloměr ve výběru typických', typ.presne != null ? 'R ' + cz(typ.presne, 2) + ' (typický)' : `není – nejbližší R ${typ.mensi != null ? cz(typ.mensi, 2) : '–'} / R ${typ.vetsi != null ? cz(typ.vetsi, 2) : '–'}`]);
      V.hodnoty.push(['Vedení frézy', P.lozisko ? `ložisko po zbylém boku (${cz(P.zbyvaBoku, 1)} mm)` : 'bok nezbývá – vést podle pravítka frézky / stolu'], ['Doporučené průchody', `${n} (úběr ≤ ${cz(c(p.pruchod, 3), 1)} mm)`]);
      if (!P.lozisko) V.varovani.push('Na boku nezůstane plocha pro ložisko – použijte pravítko (frézovací stůl) nebo nechte hranu o 2 mm vyšší.');
      if (p.obe && !P.obe) V.varovani.push('Profil je vyšší než polovina desky – na obě hrany se nevejde.');
      V.kusovnik.push(['Fréza', 1, P.frez, 'SK (tvrdokov)', 'typická – ověřte u výrobce'], ['Kontrolní šablona', 1, `${cz(P.sirka + 30, 0)} × ${cz(P.vyska + 30, 0)}`, 'PETG / tvrdý karton', '']);
      V.teleso = { typ: 'vytlac', lista: true, tvary: [{ obrys: P.obrys, h: c(p.delka, 300, 50), barva: 0xd9b98a }] };
      V.info = P.frez;
      return V;
    },
  };

  /* ================= opěradlo židle ================= */
  REZIMY.operadlo = {
    nazev: 'Opěradlo židle', ikona: '🪑', skupina: 'hrany',
    popis: 'Prohnutá příčka nebo lamela opěradla: přední a zadní oblouk, rozvinutá délka, lepení z dýh (formy s kompenzací odpružení) nebo vyřezání z masivu.',
    vychozi: { c: 420, h: 35, t: 18, H: 90, zpusob: 'laminace', tlDyhy: 2, odp: 'auto', odpVlastni: 3, forma: 40, presah: 40 },
    pole: [
      { k: 'c', n: 'Šířka opěradla (tětiva přední plochy) c', t: 'n', min: 100, max: 2000, krok: 1 },
      { k: 'h', n: 'Prohnutí h (vzepětí přední plochy)', t: 'n', min: 1, max: 300, krok: 0.5 },
      { k: 't', n: 'Tloušťka lamely t', t: 'n', min: 3, max: 60, krok: 0.5 },
      { k: 'H', n: 'Výška lamely (svisle)', t: 'n', min: 20, max: 400, krok: 1 },
      { k: 'zpusob', n: 'Výroba', t: 'v', m: [['laminace', 'lepení z dýh ve formě'], ['masiv', 'vyřezání z masivu']] },
      { k: 'tlDyhy', n: 'Tloušťka dýhy / lamely (mm)', t: 'n', min: 0.5, max: 6, krok: 0.1, ukaz: (p) => p.zpusob !== 'masiv' },
      { k: 'odp', n: 'Odpružení', t: 'v', m: [['auto', 'odhad 1 / n² (orientačně)'], ['vlastni', 'vlastní %'], ['zadne', 'bez kompenzace']], ukaz: (p) => p.zpusob !== 'masiv' },
      { k: 'odpVlastni', n: 'Odpružení (%)', t: 'n', min: 0, max: 30, krok: 0.5, ukaz: (p) => p.zpusob !== 'masiv' && p.odp === 'vlastni' },
      { k: 'forma', n: 'Tloušťka formy za oblouk (mm)', t: 'n', min: 15, max: 200, krok: 1, ukaz: (p) => p.zpusob !== 'masiv' },
      { k: 'presah', n: 'Přesah formy za konce (mm)', t: 'n', min: 0, max: 200, krok: 1, ukaz: (p) => p.zpusob !== 'masiv' },
    ],
    predvolby: [
      { n: 'Jídelní židle – horní příčka z masivu', p: { c: 420, h: 30, t: 22, H: 70, zpusob: 'masiv' } },
      { n: 'Lepená lamela opěradla', p: { c: 440, h: 45, t: 12, H: 120, zpusob: 'laminace', tlDyhy: 1.5 } },
      { n: 'Lavice – opěradlo 1200', p: { c: 1200, h: 40, t: 20, H: 110, zpusob: 'laminace', tlDyhy: 2.5 } },
      { n: 'Windsor – oblouk opěradla', p: { c: 500, h: 120, t: 20, H: 30, zpusob: 'laminace', tlDyhy: 2 } },
    ],
    vypocet(p) {
      const V = vysledek(), cc = c(p.c, 420, 100), h = Math.min(c(p.h, 35, 1), cc / 2), t = c(p.t, 18, 3), H = c(p.H, 90, 20);
      const T = O.tetivaVzepeti(cc, h), R = T.r, cy = h - R, uL = Math.atan2(-cy, -cc / 2), th = T.uhel, rozvin = (R + t / 2) * th;
      const lam = (r1, r2, cyy, u0, sw) => { const a1 = O.bodyOblouku(0, cyy, r1, u0, -sw, 1), a2 = O.bodyOblouku(0, cyy, r2, u0 - sw, sw, 1); return O.odstranDuplicity(a1.concat(a2)); };
      const slat = lam(R, R + t, cy, uL, th);
      const K = KR.nova();
      K.car(slat, 'obrys', { z: true }).car([[0, -22], [0, h + t + 8]], 'osa');
      K.kota([-cc / 2, 0], [cc / 2, 0], -10, 'c ' + cz(cc, 1)).kota([0, 0], [0, h], -12, 'h ' + cz(h, 1));
      K.car([[-cc / 2, 0], [cc / 2, 0]], 'tenka');
      const uP = PI / 2 - th / 4;
      K.kotaR([0, cy], [R * Math.cos(uP), cy + R * Math.sin(uP)], 'R přední ' + cz(R, 1), Math.min(70, R * 0.4));
      K.kotaR([0, cy], [(R + t) * Math.cos(PI / 2 + th / 4), cy + (R + t) * Math.sin(PI / 2 + th / 4)], 'R zadní ' + cz(R + t, 1), Math.min(70, R * 0.4));
      K.text(0, h + t + 4, `rozvinutá délka (střed) ${cz(rozvin, 1)} mm`, 2.6, 'c', 0, 'kota').text(0, -18, 'strana k sedícímu (přední, vydutá)', 2.4, 'c', 0, 'pomocna');
      V.dily.push({ id: 'A', nazev: 'Lamela opěradla 1:1 (pohled shora)', prvky: K.prvky, obrys: [slat], stl: true });
      V.hodnoty.push(['Poloměr přední plochy', mm(R, 1)], ['Poloměr zadní plochy', mm(R + t, 1)], ['Středový úhel', st(O.deg(th))], ['Rozvinutá délka (střed)', mm(rozvin, 1)], ['Délka přední / zadní plochy', `${cz(R * th, 1)} / ${cz((R + t) * th, 1)} mm`]);
      if (p.zpusob === 'masiv') {
        const bb = O.meze(slat), K2 = KR.nova();
        K2.car([[bb.x0 - 5, bb.y0 - 5], [bb.x1 + 5, bb.y0 - 5], [bb.x1 + 5, bb.y1 + 5], [bb.x0 - 5, bb.y1 + 5]], 'pomocna', { z: true }).car(slat, 'obrys', { z: true });
        K2.kota([bb.x0 - 5, bb.y0 - 5], [bb.x1 + 5, bb.y0 - 5], -8).kota([bb.x1 + 5, bb.y0 - 5], [bb.x1 + 5, bb.y1 + 5], -8);
        K2.text((bb.x0 + bb.x1) / 2, bb.y1 + 9, 'vlákna podél délky polotovaru', 2.4, 'c', 0, 'pomocna');
        V.dily.push({ id: 'B', nazev: 'Polotovar z masivu', prvky: K2.prvky, obrys: null, stl: false });
        const tl = bb.y1 - bb.y0 + 10;
        V.hodnoty.push(['Tloušťka polotovaru', mm(tl, 0)], ['Využití materiálu', cz(100 * t / tl, 0) + ' %']);
        V.kusovnik.push(['Polotovar příčky', 1, `${cz(bb.x1 - bb.x0 + 10, 0)} × ${cz(tl, 0)} × ${cz(H + 5, 0)}`, 'masiv (jasan, dub, buk)', 'vyřezat pásovou pilou, dorovnat hoblíkem/škrabkou']);
        if (h + t > 2.5 * t) V.varovani.push('Velké prohnutí z masivu = hodně odpadu a krátká vlákna na koncích. Zvažte lepení z dýh.');
        V.teleso = deska(slat, H, 0xd9b98a);
      } else {
        const n = Math.max(1, Math.round(t / c(p.tlDyhy, 2, 0.5))), s = p.odp === 'zadne' ? 0 : p.odp === 'vlastni' ? c(p.odpVlastni, 3, 0, 30) / 100 : O.odpruzeni(n);
        const Rm = (R + t / 2) * (1 - s), Ri = Rm - t / 2, Ro = Rm + t / 2, pres = c(p.presah, 40, 0), Fm = c(p.forma, 40, 15), sw = (rozvin + 2 * pres) / Rm;
        const u0 = PI / 2 + sw / 2;
        const aIn = O.bodyOblouku(0, 0, Ri, u0, -sw, 1), yb = Math.min(...aIn.map((q) => q[1])) - Fm;
        const formaA = O.odstranDuplicity(aIn.concat([[aIn[aIn.length - 1][0], yb], [aIn[0][0], yb]]));
        const aOut = O.bodyOblouku(0, 0, Ro, u0, -sw, 1), yt = Ro + Fm;
        const formaB = O.odstranDuplicity(aOut.concat([[aOut[aOut.length - 1][0], yt], [aOut[0][0], yt]]));
        const lamF = O.bodyOblouku(0, 0, Rm, PI / 2 + rozvin / Rm / 2, -rozvin / Rm, 1);
        for (const [id, naz, F, popis] of [['B', 'Forma – vnitřní (vypouklý) díl', formaA, `R ${cz(Ri, 1)}`], ['C', 'Forma – vnější (vydutý) díl', formaB, `R ${cz(Ro, 1)}`]]) {
          const Kf = KR.nova();
          Kf.car(F, 'obrys', { z: true }).car(lamF, 'pomocna').car([[0, yb - 4], [0, yt + 4]], 'osa');
          const bb = O.meze(F);
          Kf.text(0, (bb.y0 + bb.y1) / 2, `${naz.toUpperCase()} ${popis}`, 3, 'c', 0, 'krivka').text(0, (bb.y0 + bb.y1) / 2 - 5, s > 0 ? `přehnuto o ${cz(s * 100, 1)} % na odpružení` : 'bez kompenzace odpružení', 2.4, 'c', 0, 'pomocna');
          Kf.kota([bb.x0, bb.y0], [bb.x1, bb.y0], -8);
          V.dily.push({ id, nazev: naz, prvky: Kf.prvky, obrys: [F], stl: true });
        }
        V.hodnoty.push(['Počet dýh', `${n} × ${cz(t / n, 2)} mm`], ['Odpružení (kompenzace)', cz(s * 100, 1) + ' %' + (p.odp === 'auto' ? ' – odhad 1/n², ověřte zkouškou' : '')], ['Poloměr formy – vnitřní / vnější', `${cz(Ri, 1)} / ${cz(Ro, 1)} mm`]);
        V.kusovnik.push(['Dýha / lamela', n, `${cz(rozvin + 40, 0)} × ${cz(H + 10, 0)} × ${cz(t / n, 2)}`, 'loupaná/krájená dýha nebo řezané lamely', 'vlákna podél, +40 mm na délku'],
          ['Forma – vrstvy MDF', 2 * Math.ceil((H + 20) / 19), `${cz(O.meze(formaA).x1 - O.meze(formaA).x0, 0)} × ${cz(Math.max(O.meze(formaA).y1 - yb, yt - O.meze(formaB).y0), 0)} × 19`, 'MDF 19 mm', 'slepit na výšku ≥ lamela + 20 mm'],
          ['Lepidlo', 1, 'močovinoformaldehydové / epoxid', '', 'PVA tečou – kríp, horší držení tvaru'], ['Svěrky', 6, 'typické šroubové', '', 'nebo vakuový vak']);
        V.teleso = deska(slat, H, 0xd9b98a);
      }
      V.info = `R přední ${mm(R, 1)}, rozvin ${mm(rozvin, 1)}.`;
      return V;
    },
  };

  /* ================= oblouk spodní hrany lubu ================= */
  REZIMY.apron = {
    nazev: 'Oblouk lubu (apron)', ikona: '🛋', skupina: 'hrany',
    popis: 'Výřez spodní hrany lubu stolu, komody nebo lavice: kruhový, eliptický, parabolický nebo dvojitý oblouk s rovnými konci u nohou. Celá nebo poloviční šablona.',
    vychozi: { L: 900, H: 110, v: 35, typ: 'oblouk', e: 60, nozka: 40, t: 20, polovina: false },
    pole: [
      { k: 'L', n: 'Délka lubu L (mm)', t: 'n', min: 100, max: 4000, krok: 1 },
      { k: 'H', n: 'Šířka (výška) lubu H (mm)', t: 'n', min: 20, max: 600, krok: 1 },
      { k: 'v', n: 'Hloubka výřezu v (mm)', t: 'n', min: 1, max: 500, krok: 0.5 },
      { k: 'typ', n: 'Tvar', t: 'v', m: [['oblouk', 'kruhový oblouk'], ['elipsa', 'poloelipsa'], ['parabola', 'parabola'], ['dvojity', 'dva oblouky s nožkou uprostřed']] },
      { k: 'e', n: 'Rovné konce u nohou e (mm)', t: 'n', min: 0, max: 1000, krok: 1 },
      { k: 'nozka', n: 'Šířka nožky uprostřed (mm)', t: 'n', min: 0, max: 400, krok: 1, ukaz: (p) => p.typ === 'dvojity' },
      { k: 't', n: 'Tloušťka lubu (mm)', t: 'n', min: 6, max: 80, krok: 1 },
      { k: 'polovina', n: 'Poloviční šablona (otočit podle osy)', t: 'b' },
    ],
    predvolby: [
      { n: 'Jídelní stůl – plochý oblouk', p: { L: 900, H: 110, v: 30, typ: 'oblouk', e: 60 } },
      { n: 'Konferenční stolek – elipsa', p: { L: 1000, H: 90, v: 40, typ: 'elipsa', e: 80 } },
      { n: 'Komoda – dvojitý oblouk', p: { L: 1100, H: 120, v: 45, typ: 'dvojity', e: 70, nozka: 50 } },
      { n: 'Shaker lavice – parabola', p: { L: 1200, H: 140, v: 70, typ: 'parabola', e: 120 } },
    ],
    vypocet(p) {
      const V = vysledek(), L = c(p.L, 900, 100), H = c(p.H, 110, 20), e = Math.min(c(p.e, 60, 0), L / 2 - 10), v = Math.min(c(p.v, 35, 1), H - 2), Lc = L - 2 * e, nz = Math.min(c(p.nozka, 40, 0), Lc - 20);
      if (c(p.v, 35) > H - 15) V.varovani.push('Nad výřezem zůstane méně než 15 mm – lub zeslábne a může prasknout.');
      let fy, R = null;
      if (p.typ === 'elipsa') fy = (x) => O.vyskaElipsy(Lc / 2, v, x - L / 2);
      else if (p.typ === 'parabola') fy = (x) => v * (1 - Math.pow(2 * (x - L / 2) / Lc, 2));
      else if (p.typ === 'dvojity') { const cd = (Lc - nz) / 2, xs1 = e + cd / 2, xs2 = L - e - cd / 2; R = O.tetivaVzepeti(cd, Math.min(v, cd / 2)).r; fy = (x) => (x <= L / 2 - nz / 2 ? O.vyskaOblouku(cd, Math.min(v, cd / 2), x - xs1) : x >= L / 2 + nz / 2 ? O.vyskaOblouku(cd, Math.min(v, cd / 2), x - xs2) : 0); if (v > cd / 2) V.varovani.push('Hloubka je větší než polovina jednoho oblouku – omezeno na půlkruh.'); }
      else { R = O.tetivaVzepeti(Lc, Math.min(v, Lc / 2)).r; fy = (x) => O.vyskaOblouku(Lc, Math.min(v, Lc / 2), x - L / 2); }
      const n = Math.max(60, Math.ceil(Lc / 1.5)), krivka = [];
      for (let i = 0; i <= n; i++) { const x = e + Lc * i / n, y = fy(x); krivka.push([x, Math.max(0, y == null ? 0 : y)]); }
      const cela = O.odstranDuplicity([[0, 0]].concat(e > 0 ? [[e, 0]] : [], krivka, e > 0 ? [[L - e, 0]] : [], [[L, 0], [L, H], [0, H]]));
      // poloviční obrys: levá polovina uzavřená po ose
      const polovina = p.polovina ? O.odstranDuplicity([[0, 0]].concat(e > 0 ? [[e, 0]] : [], krivka.filter((q) => q[0] <= L / 2 + 1e-6), [[L / 2, Math.max(0, fy(L / 2) || 0)], [L / 2, H], [0, H]])) : null;
      const obr = polovina || cela, K = KR.nova(), xk = polovina ? L / 2 : L;
      K.car(obr, 'obrys', { z: true });
      if (polovina) K.car([[L / 2, -8], [L / 2, H + 8]], 'osa').text(L / 2 - 2, H + 3, 'OSA – šablonu otočit a obkreslit druhou polovinu', 2.6, 'r', 0, 'osa');
      else K.car([[L / 2, -6], [L / 2, H + 6]], 'osa');
      K.kota([0, H], [xk, H], 8, polovina ? 'L/2 ' + cz(L / 2, 1) : 'L ' + cz(L, 1)).kota([0, 0], [0, H], 10, 'H ' + cz(H, 1));
      const ym = Math.max(0, fy(p.typ === 'dvojity' ? e + (Lc - nz) / 4 : L / 2) || 0), xm = p.typ === 'dvojity' ? e + (Lc - nz) / 4 : L / 2;
      K.kota([xm, 0], [xm, ym], -8, 'v ' + cz(ym, 1));
      if (e > 0) K.kota([0, 0], [e, 0], -8, 'e ' + cz(e, 0));
      if (p.typ === 'dvojity' && nz > 0) K.kota([L / 2 - nz / 2, 0], [L / 2 + nz / 2, 0], -8, cz(nz, 0));
      K.car([[e, 0], [L - e, 0]].map((q) => [Math.min(q[0], xk), q[1]]), 'pomocna');
      K.text(xk / 2, H - 8, 'LUB – líc', 3, 'c', 0, 'krivka');
      V.dily.push({ id: 'A', nazev: polovina ? 'Lub – poloviční šablona 1:1' : 'Lub – šablona 1:1', prvky: K.prvky, obrys: [obr], stl: true });
      V.hodnoty.push(['Tvar', { oblouk: 'kruhový oblouk', elipsa: 'poloelipsa', parabola: 'parabola', dvojity: 'dva kruhové oblouky' }[p.typ] || 'kruhový oblouk'], ['Tětiva výřezu', mm(Lc, 1)], ['Hloubka výřezu', mm(v, 1)], ['Zbývá nad výřezem', mm(H - v, 1)]);
      if (R) V.hodnoty.push(['Poloměr oblouku', mm(R, 1)]);
      let delka = 0; for (let i = 1; i < krivka.length; i++) delka += O.vzd(krivka[i - 1], krivka[i]);
      V.hodnoty.push(['Délka křivky výřezu', mm(delka, 1)]);
      V.kusovnik.push(['Lub', 1, `${cz(L, 0)} × ${cz(H, 0)} × ${cz(c(p.t, 20), 0)}`, 'masiv', 'délka bez čepů – přičtěte čepy']);
      V.teleso = deska(cela, c(p.t, 20, 6), 0xd9b98a, true);
      V.info = `Výřez ${mm(Lc, 0)} × ${mm(v, 1)}${R ? ', R ' + cz(R, 1) + ' mm' : ''}.`;
      return V;
    },
  };

  const API = { KABRIOLY, kabriolZPredlohy, prizpusobKabriol, PREDVOLBY_SOUSTRUH };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.OBLP = API;
})(typeof window !== 'undefined' ? window : globalThis);
