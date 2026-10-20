/* ============================================================
   Šablony oblouků a profilů – režimy: oblouky a křivky (bez DOM)
   Každý režim: {nazev, ikona, skupina, popis, pole:[…], vychozi:{…}, predvolby:[{n, p}], vypocet(p) → V}
   V = {dily:[{id, nazev, prvky, obrys:[prstenec, …díry] | null, stl (bool), tlStl}], hodnoty:[[popis, hodnota]],
        tabulky:[{nazev, hlavicka, radky}], kusovnik:[[položka, ks, rozměr, materiál, pozn.]], varovani:[], teleso:{…}, info}
   pole: {k, n, t:'n'|'v'|'b'|'tab', min, max, krok, m:[[hodnota, popis]], ukaz:(p)=>bool, sloupce (tab)}
   ============================================================ */
(function (koren) {
  'use strict';
  const O = koren.OBL || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const KR = koren.OBLK || (typeof require !== 'undefined' ? require('./kresba.js') : null);
  const PI = Math.PI, cz = KR.cz, mm = (x, d) => cz(x, d == null ? 1 : d) + ' mm', st = (u, d) => cz(u, d == null ? 2 : d) + '°';
  const c = (v, vych, min, max) => { let x = O.cislo(v, vych); if (min != null) x = Math.max(min, x); if (max != null) x = Math.min(max, x); return x; };

  const SKUPINY = [['krivky', 'Oblouky a křivky'], ['nohy', 'Nohy a soustružení'], ['hrany', 'Lišty, opěradla, luby']];
  const REZIMY = {};

  /* ---------------- společné pomůcky ---------------- */
  /** uzavřená šablona pod křivkou: křivka + základna v y = yb */
  const podKrivkou = (body, yb) => O.odstranDuplicity(body.concat([[body[body.length - 1][0], yb], [body[0][0], yb]]));
  const nadKrivkou = (body, yt) => O.odstranDuplicity(body.concat([[body[body.length - 1][0], yt], [body[0][0], yt]]));
  /** pořadnice (svislé výšky křivky nad základnou y0) po kroku od osy x=xs; kreslí a vrací řádky tabulky */
  function poradnice(K, fy, xa, xb, xs, krok, y0, kreslit) {
    const radky = [];
    if (!(krok > 0)) return radky;
    const n0 = Math.ceil((xa - xs) / krok - 1e-9), n1 = Math.floor((xb - xs) / krok + 1e-9);
    if (n1 - n0 > 400) return radky;
    for (let i = n0; i <= n1; i++) {
      const x = xs + i * krok, y = fy(x);
      if (y == null || !isFinite(y)) continue;
      radky.push([cz(x - xa, 1), cz(x - xs, 1), cz(y - y0, 2)]);
      if (kreslit && Math.abs(y - y0) > 3) {
        K.car([[x, y0], [x, y]], 'tenka');
        K.text(x - 0.8, y0 + 2, cz(y - y0, 1), 2.1, 'l', 90, 'kota');
      }
    }
    return radky;
  }
  const TAB_PORADNIC = (radky, popis) => ({ nazev: popis || 'Pořadnice – výška křivky nad základnou', hlavicka: ['od levého konce', 'od osy', 'výška y'], radky });
  const poleSablony = [
    { k: 'm', n: 'Podklad šablony pod křivkou (mm)', t: 'n', min: 0, max: 200, krok: 1 },
    { k: 'krok', n: 'Pořadnice po (mm, 0 = žádné)', t: 'n', min: 0, max: 500, krok: 5 },
  ];
  const deska = (obrys, h, barva, stojici) => ({ typ: 'vytlac', stojici: !!stojici, tvary: [{ obrys, h: h || 6, barva: barva || 0x3f8f5a }] });

  /* ---------------- oblouk z tětivy a vzepětí ---------------- */
  REZIMY.tetiva = {
    nazev: 'Oblouk z tětivy', ikona: '◠', skupina: 'krivky',
    popis: 'Kruhový oblouk zadaný tětivou (rozpětím) a vzepětím, nebo tětivou a poloměrem. Výpočet poloměru, středu, úhlu a délky; pořadnice pro vynesení bez trámkového kružítka.',
    vychozi: { c: 600, zadani: 'vzepeti', h: 60, R: 800, velky: false, sirka: 0, m: 25, krok: 50 },
    pole: [
      { k: 'c', n: 'Tětiva – rozpětí c (mm)', t: 'n', min: 10, max: 6000, krok: 1 },
      { k: 'zadani', n: 'Zadat', t: 'v', m: [['vzepeti', 'vzepětí h'], ['polomer', 'poloměr R']] },
      { k: 'h', n: 'Vzepětí h (mm)', t: 'n', min: 0.5, max: 3000, krok: 0.5, ukaz: (p) => p.zadani !== 'polomer' },
      { k: 'R', n: 'Poloměr R (mm)', t: 'n', min: 1, max: 100000, krok: 1, ukaz: (p) => p.zadani === 'polomer' },
      { k: 'velky', n: 'Oblouk větší než půlkruh', t: 'b', ukaz: (p) => p.zadani === 'polomer' },
      { k: 'sirka', n: 'Šířka obloukového dílu (0 = jen šablona)', t: 'n', min: 0, max: 500, krok: 1 },
    ].concat(poleSablony),
    predvolby: [
      { n: 'Plochý oblouk dvířek 400 / 25', p: { c: 400, zadani: 'vzepeti', h: 25, sirka: 60 } },
      { n: 'Obloukový lub 1200 / 60', p: { c: 1200, zadani: 'vzepeti', h: 60, sirka: 0 } },
      { n: 'Horní vlys okna R 900', p: { c: 800, zadani: 'polomer', R: 900, sirka: 80 } },
      { n: 'Půlkruh 500', p: { c: 500, zadani: 'vzepeti', h: 250, sirka: 0 } },
    ],
    vypocet(p) {
      const V = vysledek(), K = KR.nova(), cc = c(p.c, 600, 10);
      let h = c(p.h, 60, 0.1);
      if (p.zadani === 'polomer') {
        let R = c(p.R, 800, 1);
        if (R < cc / 2) { V.varovani.push(`Poloměr ${mm(R)} je menší než polovina tětivy – použito R = c/2 (půlkruh).`); R = cc / 2; }
        h = O.vzepetiZPolomeru(cc, R, !!p.velky) || cc / 2;
      }
      const T = O.tetivaVzepeti(cc, h), cy = T.stredY, R = T.r, m = c(p.m, 25, 0), w = c(p.sirka, 0, 0);
      const arc = O.bodyOblouku(0, cy, R, Math.atan2(-cy, -cc / 2), -T.uhel, 1);
      let obrys;
      if (w > 0 && w < R) {
        const vnitrni = O.bodyOblouku(0, cy, R - w, Math.atan2(-cy, -cc / 2) - T.uhel, T.uhel, 1);
        obrys = O.odstranDuplicity(arc.concat(vnitrni));
        K.car(arc, 'obrys').car(vnitrni, 'obrys').car([arc[arc.length - 1], vnitrni[0]], 'obrys').car([vnitrni[vnitrni.length - 1], arc[0]], 'obrys');
        K.car([[-cc / 2, 0], [cc / 2, 0]], 'pomocna');
      } else {
        if (w >= R) V.varovani.push('Šířka dílu je větší než poloměr – ignorována.');
        obrys = podKrivkou(arc, -m);
        K.car(obrys, 'obrys', { z: true });
        K.car([[-cc / 2, 0], [cc / 2, 0]], 'tenka');
      }
      K.car([[0, -m - 4], [0, h + 6]], 'osa');
      const xa = Math.min(...arc.map((q) => q[0])), xb = Math.max(...arc.map((q) => q[0]));
      const rad = poradnice(K, (x) => (Math.abs(x) <= cc / 2 ? O.vyskaOblouku(cc, h, x) : null), -cc / 2, cc / 2, 0, c(p.krok, 50, 0), 0, w <= 0);
      K.kota([-cc / 2, 0], [cc / 2, 0], -(m + 8), 'tětiva ' + cz(cc, 1));
      K.kota([0, 0], [0, h], -Math.min(14, cc / 8), 'h ' + cz(h, 1));
      const viditelny = R - h < 0.9 * cc + m;
      const uP = PI / 2 - T.uhel / 4, P = [R * Math.cos(uP), cy + R * Math.sin(uP)];
      if (viditelny) { K.kriz(0, cy, 6, 'S'); K.kotaR([0, cy], P, 'R ' + cz(R, 1)); }
      else K.kotaR([0, cy], P, `R ${cz(R, 1)} (střed ${cz(R - h, 0)} mm pod tětivou)`, Math.min(80, R * 0.5));
      V.hodnoty.push(['Poloměr R', mm(R, 2)], ['Vzepětí h', mm(h, 2)], ['Tětiva c', mm(cc, 1)], ['Středový úhel', st(O.deg(T.uhel))], ['Délka oblouku', mm(T.delka)],
        ['Střed pod tětivou', mm(R - h, 1)], ['Šířka v nejširším místě', mm(xb - xa)]);
      if (w > 0 && w < R) V.hodnoty.push(['Vnitřní poloměr', mm(R - w, 2)], ['Délka vnitřního oblouku', mm((R - w) * T.uhel)]);
      V.hodnoty.push(['Trámkové kružítko / provázek', mm(R, 1)]);
      V.tabulky.push(TAB_PORADNIC(rad));
      V.dily.push({ id: 'A', nazev: w > 0 ? 'Obloukový díl 1:1' : 'Šablona oblouku 1:1', prvky: K.prvky, obrys: [obrys], stl: true });
      V.teleso = deska(obrys, w > 0 ? 20 : 6, w > 0 ? 0xd9b98a : null);
      if (w > 0) V.kusovnik.push(['Obloukový díl', 1, `${cz(xb - xa + 10, 0)} × ${cz(h + w + 10, 0)} × tl.`, 'masiv / překližka', 'polotovar včetně přídavku 5 mm']);
      V.info = `Oblouk R ${cz(R, 1)} mm, úhel ${st(O.deg(T.uhel), 1)}, délka ${mm(T.delka)}.`;
      return V;
    },
  };

  /* ---------------- oblouk ze tří bodů ---------------- */
  REZIMY.tribody = {
    nazev: 'Oblouk ze 3 bodů', ikona: '⌒', skupina: 'krivky',
    popis: 'Kruhový oblouk procházející třemi body (např. změřenými na zdi nebo na předloze). Střed, poloměr, úhel a délka oblouku.',
    vychozi: { x1: 0, y1: 0, x2: 260, y2: 70, x3: 600, y3: 20, m: 25 },
    pole: [
      { k: 'x1', n: 'P1 x', t: 'n', krok: 0.5 }, { k: 'y1', n: 'P1 y', t: 'n', krok: 0.5 },
      { k: 'x2', n: 'P2 x (bod na oblouku)', t: 'n', krok: 0.5 }, { k: 'y2', n: 'P2 y', t: 'n', krok: 0.5 },
      { k: 'x3', n: 'P3 x', t: 'n', krok: 0.5 }, { k: 'y3', n: 'P3 y', t: 'n', krok: 0.5 },
      { k: 'm', n: 'Podklad šablony pod tětivou (mm)', t: 'n', min: 0, max: 200, krok: 1 },
    ],
    predvolby: [
      { n: 'Nesouměrný oblouk', p: { x1: 0, y1: 0, x2: 260, y2: 70, x3: 600, y3: 20 } },
      { n: 'Výřez pod parapet', p: { x1: 0, y1: 0, x2: 400, y2: 45, x3: 800, y3: 0 } },
    ],
    vypocet(p) {
      const V = vysledek(), K = KR.nova(), A = [c(p.x1, 0), c(p.y1, 0)], B = [c(p.x2, 0), c(p.y2, 0)], C = [c(p.x3, 0), c(p.y3, 0)], m = c(p.m, 25, 0);
      const o = O.obloukZTriBodu(A, B, C);
      for (const [q, t] of [[A, 'P1'], [B, 'P2'], [C, 'P3']]) K.kriz(q[0], q[1], 4, t, 'druha');
      if (!o) {
        V.varovani.push('Body leží v přímce – oblouk neexistuje (poloměr nekonečný).');
        K.car([A, C], 'obrys');
        V.dily.push({ id: 'A', nazev: 'Přímka', prvky: K.prvky, obrys: null, stl: false });
        return V;
      }
      const arc = O.bodyOblouku(o.cx, o.cy, o.r, o.u0, o.sweep, 1);
      const L = O.vzd(A, C), ux = (C[0] - A[0]) / L, uy = (C[1] - A[1]) / L, Mc = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2];
      let nx = -uy, ny = ux;
      if ((o.stredOblouku[0] - Mc[0]) * nx + (o.stredOblouku[1] - Mc[1]) * ny < 0) { nx = -nx; ny = -ny; }
      const obrys = O.odstranDuplicity(arc.concat([[C[0] - nx * m, C[1] - ny * m], [A[0] - nx * m, A[1] - ny * m]]));
      K.car(obrys, 'obrys', { z: true }).car([A, C], 'tenka');
      const leve = -uy * nx + ux * ny > 0;
      K.kota(A, C, (leve ? -1 : 1) * (m + 8), 'tětiva ' + cz(L, 1));
      if (o.vzepeti > 2) K.kota(Mc, o.stredOblouku, 0, 'h ' + cz(o.vzepeti, 1), { bezVynasecek: true });
      const P = [o.cx + o.r * Math.cos(o.u0 + o.sweep * 0.3), o.cy + o.r * Math.sin(o.u0 + o.sweep * 0.3)];
      const bb = O.meze(obrys), velikost = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
      if (Math.hypot(o.cx - Mc[0], o.cy - Mc[1]) < 1.2 * velikost) { K.kriz(o.cx, o.cy, 6, 'S'); K.kotaR([o.cx, o.cy], P, 'R ' + cz(o.r, 1)); }
      else K.kotaR([o.cx, o.cy], P, `R ${cz(o.r, 1)} (střed mimo šablonu)`, Math.min(80, o.r * 0.5));
      V.hodnoty.push(['Střed S (x; y)', `${cz(o.cx, 2)}; ${cz(o.cy, 2)}`], ['Poloměr R', mm(o.r, 2)], ['Středový úhel', st(O.deg(o.uhel))], ['Délka oblouku P1→P3', mm(o.delka)],
        ['Tětiva P1–P3', mm(L, 1)], ['Vzepětí nad tětivou', mm(o.vzepeti, 2)], ['Směr', o.sweep < 0 ? 'po směru hodin' : 'proti směru hodin']);
      V.dily.push({ id: 'A', nazev: 'Šablona oblouku 1:1', prvky: K.prvky, obrys: [obrys], stl: true });
      V.teleso = deska(obrys, 6);
      V.info = `Kružnice se středem [${cz(o.cx, 1)}; ${cz(o.cy, 1)}] a poloměrem ${mm(o.r, 2)}.`;
      return V;
    },
  };

  /* ---------------- segmentový oblouk ---------------- */
  REZIMY.segment = {
    nazev: 'Segmentový oblouk', ikona: '⬡', skupina: 'krivky',
    popis: 'Oblouk nebo prstenec slepený z lichoběžníkových segmentů (oblouk zárubně, rám zrcadla, segmentová mísa). Pokosový úhel, délky hran, šířka prkna a délka pásu.',
    vychozi: { R: 150, w: 40, n: 12, uhel: 360, prorez: 3, tl: 20 },
    pole: [
      { k: 'R', n: 'Vnější poloměr hotového dílu R (mm)', t: 'n', min: 10, max: 3000, krok: 1 },
      { k: 'w', n: 'Šířka hotového dílu (radiálně)', t: 'n', min: 2, max: 1000, krok: 1 },
      { k: 'n', n: 'Počet segmentů', t: 'n', min: 2, max: 72, krok: 1 },
      { k: 'uhel', n: 'Celkový úhel oblouku (°)', t: 'n', min: 10, max: 360, krok: 1 },
      { k: 'prorez', n: 'Prořez pily (mm)', t: 'n', min: 0, max: 8, krok: 0.1 },
      { k: 'tl', n: 'Tloušťka prkna / vrstvy (mm)', t: 'n', min: 3, max: 120, krok: 1 },
    ],
    predvolby: [
      { n: 'Prstenec mísy Ø 300, 12 segmentů', p: { R: 150, w: 40, n: 12, uhel: 360 } },
      { n: 'Oblouk zárubně 180°, 6 dílů', p: { R: 450, w: 70, n: 6, uhel: 180, tl: 40 } },
      { n: 'Rám kulatého zrcadla, 8 dílů', p: { R: 300, w: 60, n: 8, uhel: 360, tl: 22 } },
    ],
    vypocet(p) {
      const V = vysledek(), R = c(p.R, 150, 10), w = Math.min(c(p.w, 40, 2), R), n = Math.round(c(p.n, 12, 2, 72)), uhel = c(p.uhel, 360, 10, 360);
      const S = O.segmentovyOblouk(R, w, n, uhel, c(p.prorez, 3, 0));
      const K = KR.nova(), Th = O.rad(S.uhel), u0 = PI / 2 - Th / 2;
      const kruh = (r, styl) => K.car(O.bodyOblouku(0, 0, r, u0, Th, 1.5), styl);
      for (const s of S.segmenty) K.car(s.body, 'obrys', { z: true });
      kruh(R, 'krivka'); if (S.r > 0) kruh(S.r, 'krivka');
      K.kriz(0, 0, 6, 'S');
      const s0 = S.segmenty[0];
      K.kotaR([0, 0], [R * Math.cos(s0.osa), R * Math.sin(s0.osa)], 'R ' + cz(R, 1));
      if (S.r > 0 && n > 2) { const s1 = S.segmenty[Math.min(n - 1, 1)]; K.kotaR([0, 0], [S.r * Math.cos(s1.osa), S.r * Math.sin(s1.osa)], 'r ' + cz(S.r, 1)); }
      for (let i = 0; i < n; i++) { const s = S.segmenty[i], rr = (R + S.r) / 2; K.text(rr * Math.cos(s.osa), rr * Math.sin(s.osa) - 1.2, String(i + 1), 3, 'c', 0, 'kota'); }
      V.dily.push({ id: 'A', nazev: 'Sestava segmentů 1:1', prvky: K.prvky, obrys: null, stl: false });
      // jeden segment s kótami
      const K2 = KR.nova(), ph = S.phi, Ro = R / Math.cos(ph), Ri = S.r;
      const seg = [[Ri * Math.sin(-ph), Ri * Math.cos(-ph)], [Ro * Math.sin(-ph), Ro * Math.cos(-ph)], [Ro * Math.sin(ph), Ro * Math.cos(ph)], [Ri * Math.sin(ph), Ri * Math.cos(ph)]].map((q) => [q[0], q[1] - S.r * Math.cos(ph)]);
      // pozn.: x = r·sin(u), y = r·cos(u) – osa segmentu svisle, vnitřní hrana na y = 0
      K2.car(seg, 'obrys', { z: true });
      K2.car(O.bodyOblouku(0, -S.r * Math.cos(ph), R, PI / 2 + ph, -2 * ph, 0.5), 'krivka');
      if (S.r > 0) K2.car(O.bodyOblouku(0, -S.r * Math.cos(ph), S.r, PI / 2 + ph, -2 * ph, 0.5), 'krivka');
      K2.kota(seg[1], seg[2], 8, 'vnější ' + cz(S.vnejsi, 1));
      K2.kota(seg[0], seg[3], -8, 'vnitřní ' + cz(S.vnitrni, 1));
      K2.kota([seg[2][0], 0], [seg[2][0], seg[2][1]], -10, 'šířka prkna ' + cz(S.sirkaPrkna, 1));
      K2.text(0, (seg[1][1]) / 2, `pokos ${cz(S.pokos, 2)}° na každém konci`, 2.8, 'c', 0, 'kota');
      K2.text(0, (seg[1][1]) / 2 - 4.5, 'osa segmentu', 2.2, 'c', 0, 'pomocna');
      K2.car([[0, -4], [0, seg[1][1] + 4]], 'osa');
      V.dily.push({ id: 'B', nazev: 'Jeden segment 1:1', prvky: K2.prvky, obrys: [seg], stl: true });
      V.hodnoty.push(['Pokosový úhel (od kolmice)', st(S.pokos)], ['Úhel mezi čely sousedních segmentů', st(2 * S.pokos)], ['Vnější hrana segmentu', mm(S.vnejsi, 2)], ['Vnitřní hrana segmentu', mm(S.vnitrni, 2)],
        ['Šířka prkna (min.)', mm(S.sirkaPrkna, 2)], ['Vnitřní poloměr', mm(S.r, 1)], ['Délka pásu (segmenty střídavě otočené)', mm(S.delkaPasu, 0)], ['Přesah rohu za kruh R', mm(S.mezera, 2)]);
      V.tabulky.push({ nazev: 'Nastavení pily', hlavicka: ['položka', 'hodnota', 'poznámka'], radky: [
        ['pokosová zarážka', st(S.pokos), 'úhel od kolmice ke kotouči'],
        ['zkušební slepení', `${n} segmentů`, 'mezera v posledním spoji = chyba úhlu × 2n'],
        ['chyba 0,1° na řez', st(0.1 * 2 * n, 1), 'celková chyba po obvodu (360° prstenec)'],
      ] });
      V.kusovnik.push(['Segment', n, `${cz(S.vnejsi + 2, 1)} × ${cz(S.sirkaPrkna + 2, 1)} × ${cz(c(p.tl, 20), 0)}`, 'masiv', 'přídavek 1 mm na stranu'], ['Pás na segmenty', 1, `${cz(S.delkaPasu + 50, 0)} × ${cz(S.sirkaPrkna + 4, 0)} × ${cz(c(p.tl, 20), 0)}`, 'masiv', 'vč. 50 mm na upnutí']);
      if (S.uhel >= 359.9 && S.r <= 0) V.varovani.push('Vnitřní poloměr je nulový – vznikne plný kotouč.');
      V.teleso = { typ: 'vytlac', tvary: S.segmenty.map((s, i) => ({ obrys: s.body, h: c(p.tl, 20, 3), barva: i % 2 ? 0xc9a36b : 0xa97c45 })) };
      V.info = `${n} segmentů s pokosem ${st(S.pokos)}; vnější hrana ${mm(S.vnejsi, 1)}.`;
      return V;
    },
  };

  /* ---------------- elipsa ---------------- */
  REZIMY.elipsa = {
    nazev: 'Elipsa a provázek', ikona: '⬭', skupina: 'krivky',
    popis: 'Elipsa ze šířky a výšky: ohniska, délka provázku pro zahradnickou konstrukci (dva hřebíky + tužka), obvod, pořadnice. Celá, poloviční nebo čtvrtinová šablona (deska stolu, oblouk lubu).',
    vychozi: { sirka: 900, vyska: 600, cast: 'polovina', m: 20, krok: 50, provazek: true },
    pole: [
      { k: 'sirka', n: 'Šířka – osa x (mm)', t: 'n', min: 10, max: 6000, krok: 1 },
      { k: 'vyska', n: 'Výška – osa y (mm)', t: 'n', min: 10, max: 6000, krok: 1 },
      { k: 'cast', n: 'Šablona', t: 'v', m: [['cela', 'celá elipsa'], ['polovina', 'polovina (nad osou x)'], ['ctvrt', 'čtvrtina']] },
      { k: 'provazek', n: 'Zakreslit provázek a hřebíky', t: 'b' },
      { k: 'krok', n: 'Pořadnice po (mm, 0 = žádné)', t: 'n', min: 0, max: 500, krok: 5 },
    ],
    predvolby: [
      { n: 'Oválný stůl 1600 × 1000 (čtvrtina)', p: { sirka: 1600, vyska: 1000, cast: 'ctvrt' } },
      { n: 'Eliptický oblouk lubu 800 / 80', p: { sirka: 800, vyska: 160, cast: 'polovina' } },
      { n: 'Zrcadlo 500 × 700', p: { sirka: 500, vyska: 700, cast: 'cela' } },
    ],
    vypocet(p) {
      const V = vysledek(), a = c(p.sirka, 900, 10) / 2, b = c(p.vyska, 600, 10) / 2, E = O.elipsa(a, b), K = KR.nova();
      const cast = p.cast || 'polovina', svisla = b > a;
      const F1 = svisla ? [0, -E.c] : [-E.c, 0], F2 = svisla ? [0, E.c] : [E.c, 0];
      let body, obrys;
      if (cast === 'cela') { body = O.bodyElipsy(a, b, 1440); obrys = O.odstranDuplicity(body); }
      else if (cast === 'ctvrt') { body = O.bodyElipsy(a, b, 720, 0, PI / 2); obrys = O.odstranDuplicity(body.concat([[0, 0]])); }
      else { body = O.bodyElipsy(a, b, 1080, 0, PI); obrys = O.odstranDuplicity(body); }
      K.car(obrys, 'obrys', { z: true });
      const x0 = cast === 'ctvrt' ? 0 : -a, y0 = cast === 'cela' ? -b : 0;
      K.car([[x0 - 6, 0], [a + 6, 0]], 'osa').car([[0, y0 - 6], [0, b + 6]], 'osa');
      const vidF = (F) => (cast === 'cela' || (cast === 'polovina' && F[1] >= 0) || (cast === 'ctvrt' && F[0] >= 0 && F[1] >= 0));
      for (const [F, t] of [[F1, 'F1'], [F2, 'F2']]) if (vidF(F)) K.kriz(F[0], F[1], 4, t + ' hřebík', 'druha');
      if (p.provazek !== false) {
        const u = cast === 'ctvrt' ? PI / 4 : PI / 3, P = [a * Math.cos(u), b * Math.sin(u)];
        K.car([F1, P, F2], 'provazek');
        K.kruh(P[0], P[1], 1.6, 'druha').text(P[0] + 2.5, P[1] + 2, 'tužka', 2.6, 'l', 0, 'druha');
        K.text(0, svisla ? 4 : -4.5, `provázek: smyčka ${cz(E.provazekSmycka, 1)} mm (nebo otevřený ${cz(E.provazekOtevreny, 1)} mm s konci na hřebících)`, 2.6, 'c', 0, 'druha');
      }
      const rad = poradnice(K, (x) => O.vyskaElipsy(a, b, x), x0, a, 0, c(p.krok, 50, 0), 0, true);
      K.kota([x0, 0], [a, 0], -(cast === 'cela' ? b + 10 : 10), (cast === 'ctvrt' ? 'a ' + cz(a, 1) : 'šířka ' + cz(2 * a, 1)));
      K.kota([0, y0], [0, b], -(a + 10), cast === 'cela' ? 'výška ' + cz(2 * b, 1) : 'b ' + cz(b, 1));
      if (!svisla && E.c > 5 && cast !== 'ctvrt') K.kota(F1, F2, 10, '2c ' + cz(2 * E.c, 1));
      if (cast === 'ctvrt' && E.c > 5 && !svisla) K.kota([0, 0], F2, 10, 'c ' + cz(E.c, 1));
      const delkaCasti = cast === 'cela' ? E.obvod : cast === 'polovina' ? E.obvod / 2 : E.obvod / 4;
      V.hodnoty.push(['Hlavní poloosa', mm(E.a, 1)], ['Vedlejší poloosa', mm(E.b, 1)], ['Ohniska od středu c', mm(E.c, 2)], ['Vzdálenost hřebíků 2c', mm(2 * E.c, 2)],
        ['Provázek – uzavřená smyčka', mm(E.provazekSmycka, 1)], ['Provázek – otevřený (konce na hřebících)', mm(E.provazekOtevreny, 1)], ['Obvod celé elipsy', mm(E.obvod, 1)],
        ['Délka křivky šablony', mm(delkaCasti, 1)], ['Plocha celé elipsy', cz(E.plocha / 1e6, 4) + ' m²'], ['Výstřednost e', cz(E.excentricita, 4)]);
      V.tabulky.push(TAB_PORADNIC(rad, 'Pořadnice – výška elipsy nad osou x'));
      V.dily.push({ id: 'A', nazev: { cela: 'Celá elipsa 1:1', polovina: 'Polovina elipsy 1:1', ctvrt: 'Čtvrtina elipsy 1:1' }[cast], prvky: K.prvky, obrys: [obrys], stl: true });
      V.teleso = deska(obrys, 6);
      V.info = `Hřebíky ${mm(2 * E.c, 1)} od sebe, smyčka provázku ${mm(E.provazekSmycka, 1)}.`;
      return V;
    },
  };

  /* ---------------- parabola ---------------- */
  REZIMY.parabola = {
    nazev: 'Parabola', ikona: '∩', skupina: 'krivky',
    popis: 'Parabolický oblouk ze šířky a výšky: ohnisko, řídicí přímka, délka oblouku, poloměr ve vrcholu. Pro oblouky lubů, výřezy a mostky.',
    vychozi: { w: 600, h: 200, m: 20, krok: 50, ohnisko: true },
    pole: [
      { k: 'w', n: 'Šířka (rozpětí) w', t: 'n', min: 10, max: 6000, krok: 1 },
      { k: 'h', n: 'Výška h', t: 'n', min: 1, max: 3000, krok: 1 },
      { k: 'ohnisko', n: 'Zakreslit ohnisko a řídicí přímku', t: 'b' },
    ].concat(poleSablony),
    predvolby: [{ n: 'Nízký parabolický lub 900 / 60', p: { w: 900, h: 60 } }, { n: 'Vysoký oblouk 400 / 300', p: { w: 400, h: 300 } }],
    vypocet(p) {
      const V = vysledek(), w = c(p.w, 600, 10), h = c(p.h, 200, 1), m = c(p.m, 20, 0), P = O.parabola(w, h), K = KR.nova();
      const n = Math.max(60, Math.ceil(w / 1.5)), body = [];
      for (let i = 0; i <= n; i++) { const x = -w / 2 + w * i / n; body.push([x, P.y(x)]); }
      const obrys = podKrivkou(body, -m);
      K.car(obrys, 'obrys', { z: true }).car([[-w / 2, 0], [w / 2, 0]], 'tenka').car([[0, -m - 4], [0, h + 6]], 'osa');
      if (p.ohnisko !== false) {
        if (P.f < 1.5 * h + m) K.kriz(0, h - P.f, 4, 'F ohnisko', 'druha');
        if (P.f < 0.6 * h) K.car([[-w / 2, h + P.f], [w / 2, h + P.f]], 'provazek').text(-w / 2, h + P.f + 1.5, 'řídicí přímka', 2.4, 'l', 0, 'druha');
      }
      const rad = poradnice(K, (x) => (Math.abs(x) <= w / 2 ? P.y(x) : null), -w / 2, w / 2, 0, c(p.krok, 50, 0), 0, true);
      K.kota([-w / 2, 0], [w / 2, 0], -(m + 8), 'w ' + cz(w, 1)).kota([0, 0], [0, h], -Math.min(14, w / 8), 'h ' + cz(h, 1));
      V.hodnoty.push(['Rovnice', `y = ${cz(h, 2)} · (1 − (2x / ${cz(w, 1)})²)`], ['Ohnisko pod vrcholem f', mm(P.f, 2)], ['Délka oblouku', mm(P.delka)], ['Poloměr křivosti ve vrcholu', mm(P.rVrcholu, 1)], ['Sklon u paty', st(P.uhelPaty)]);
      V.tabulky.push(TAB_PORADNIC(rad));
      V.dily.push({ id: 'A', nazev: 'Šablona paraboly 1:1', prvky: K.prvky, obrys: [obrys], stl: true });
      V.teleso = deska(obrys, 6);
      V.info = `Délka oblouku ${mm(P.delka)}, ohnisko ${mm(P.f, 1)} pod vrcholem.`;
      return V;
    },
  };

  /* ---------------- řetězovka ---------------- */
  REZIMY.retezovka = {
    nazev: 'Řetězovka', ikona: '◡', skupina: 'krivky',
    popis: 'Křivka volně visícího řetězu (catenary) – obrácená je ideální tlačený oblouk (klenba, oblouk přístřešku). Ze rozpětí a průvěsu nebo délky řetězu.',
    vychozi: { L: 800, zadani: 'pruves', h: 300, s: 1100, smer: 'oblouk', m: 20, krok: 50 },
    pole: [
      { k: 'L', n: 'Rozpětí L (mm)', t: 'n', min: 10, max: 10000, krok: 1 },
      { k: 'zadani', n: 'Zadat', t: 'v', m: [['pruves', 'výšku (průvěs) h'], ['delka', 'délku řetězu s']] },
      { k: 'h', n: 'Výška / průvěs h (mm)', t: 'n', min: 1, max: 10000, krok: 1, ukaz: (p) => p.zadani !== 'delka' },
      { k: 's', n: 'Délka řetězu s (mm, > L)', t: 'n', min: 11, max: 30000, krok: 1, ukaz: (p) => p.zadani === 'delka' },
      { k: 'smer', n: 'Tvar', t: 'v', m: [['oblouk', 'obrácená – oblouk (vrchol nahoře)'], ['visici', 'visící (vrchol dole)']] },
    ].concat(poleSablony),
    predvolby: [{ n: 'Oblouk 800 / 300', p: { L: 800, zadani: 'pruves', h: 300, smer: 'oblouk' } }, { n: 'Visící police – řetěz 1000 na 900', p: { L: 900, zadani: 'delka', s: 1000, smer: 'visici' } }],
    vypocet(p) {
      const V = vysledek(), L = c(p.L, 800, 10), m = c(p.m, 20, 0), K = KR.nova();
      let R = p.zadani === 'delka' ? O.retezovkaZDelky(L, c(p.s, 1100)) : O.retezovkaZPruvesu(L, c(p.h, 300, 0.5));
      if (!R) { V.varovani.push('Délka řetězu musí být větší než rozpětí – použita výška L/3.'); R = O.retezovkaZPruvesu(L, L / 3); }
      const h = R.h, obl = p.smer !== 'visici', n = Math.max(80, Math.ceil(L / 1.5)), body = [];
      for (let i = 0; i <= n; i++) { const x = -L / 2 + L * i / n, y = R.y(x); body.push([x, obl ? h - y : y]); }
      const obrys = obl ? podKrivkou(body, -m) : nadKrivkou(body, h + m);
      K.car(obrys, 'obrys', { z: true }).car([[-L / 2, obl ? 0 : h], [L / 2, obl ? 0 : h]], 'tenka').car([[0, -m - 4], [0, h + m + 4]], 'osa');
      const rad = poradnice(K, (x) => { const y = R.y(x); return obl ? h - y : y; }, -L / 2, L / 2, 0, c(p.krok, 50, 0), obl ? 0 : h, true);
      K.kota([-L / 2, obl ? 0 : h], [L / 2, obl ? 0 : h], obl ? -(m + 8) : m + 8, 'L ' + cz(L, 1)).kota([0, 0], [0, h], -Math.min(14, L / 8), 'h ' + cz(h, 1));
      V.hodnoty.push(['Parametr a (= poloměr ve vrcholu)', mm(R.a, 2)], ['Výška / průvěs h', mm(h, 2)], ['Délka řetězu / oblouku', mm(R.delka)], ['Sklon u paty', st(R.uhelPaty)], ['Rovnice', `y = a · (cosh(x / a) − 1), a = ${cz(R.a, 2)}`]);
      V.tabulky.push(TAB_PORADNIC(rad, obl ? 'Pořadnice – výška oblouku nad patkami' : 'Pořadnice – svislá vzdálenost od úchytů (ve výšce h)'));
      V.dily.push({ id: 'A', nazev: obl ? 'Řetězovkový oblouk 1:1' : 'Visící řetězovka 1:1', prvky: K.prvky, obrys: [obrys], stl: true });
      V.teleso = deska(obrys, 6);
      V.info = `Parametr a = ${mm(R.a, 1)}, délka ${mm(R.delka)}. Kontrola: pověste řetízek délky ${cz(R.delka, 0)} mm mezi dva body ${cz(L, 0)} mm od sebe.`;
      return V;
    },
  };

  /* ---------------- pružná lať (spline) ---------------- */
  REZIMY.lat = {
    nazev: 'Pružná lať', ikona: '〰', skupina: 'krivky',
    popis: 'Plynulá křivka přes body jako ohnutá lať (batten) přes hřebíky: kubický spline s minimální energií ohybu, nebo parametrický spline pro větší ohyby. Hřebínek křivosti, nejmenší poloměr a kontrola tloušťky lati.',
    vychozi: { metoda: 'kubicky', body: [{ x: 0, y: 0 }, { x: 150, y: 48 }, { x: 350, y: 72 }, { x: 560, y: 40 }, { x: 700, y: 0 }], hrebinek: true, tlLati: 6, eps: 0.6, m: 20 },
    pole: [
      { k: 'metoda', n: 'Model lati', t: 'v', m: [['kubicky', 'kubický spline y(x) – malé průhyby (ohyb nosníku)'], ['parametricky', 'parametrický spline podle délky – větší ohyby']] },
      { k: 'body', n: 'Body (hřebíky) – mm', t: 'tab', sloupce: [{ k: 'x', n: 'x' }, { k: 'y', n: 'y' }, { k: 'zlom', n: 'roh', t: 'b' }], novy: (p) => { const b = p.body || []; const q = b[b.length - 1] || { x: 0, y: 0 }; return { x: O.r2(q.x + 100), y: q.y }; } },
      { k: 'hrebinek', n: 'Hřebínek křivosti (kontrola plynulosti)', t: 'b' },
      { k: 'tlLati', n: 'Tloušťka lati (mm)', t: 'n', min: 0.5, max: 40, krok: 0.5 },
      { k: 'eps', n: 'Dovolené přetvoření dřeva (%, typ. 0,5–0,8)', t: 'n', min: 0.1, max: 3, krok: 0.05 },
      { k: 'm', n: 'Podklad šablony pod nejnižším bodem (mm)', t: 'n', min: 0, max: 200, krok: 1 },
    ],
    predvolby: [
      { n: 'Prohnutý lub 700', p: { metoda: 'kubicky', body: [{ x: 0, y: 0 }, { x: 150, y: 48 }, { x: 350, y: 72 }, { x: 560, y: 40 }, { x: 700, y: 0 }] } },
      { n: 'S-křivka sedáku', p: { metoda: 'kubicky', body: [{ x: 0, y: 30 }, { x: 120, y: 8 }, { x: 260, y: 0 }, { x: 380, y: 20 }, { x: 450, y: 55 }] } },
      { n: 'Bok rozšířené skříňky (parametrický)', p: { metoda: 'parametricky', body: [{ x: 0, y: 0 }, { x: 60, y: 120 }, { x: 40, y: 300 }, { x: 90, y: 480 }, { x: 200, y: 560 }] } },
    ],
    vypocet(p) {
      const V = vysledek(), K = KR.nova(), uz = (p.body || []).map((q) => [O.cislo(q.x, NaN), O.cislo(q.y, NaN), !!q.zlom]);
      const S = O.lat(uz, p.metoda, 1);
      V.varovani.push(...S.varovani);
      if (S.body.length < 2) { V.dily.push({ id: 'A', nazev: 'Křivka', prvky: K.prvky, obrys: null, stl: false }); return V; }
      const ymin = Math.min(...S.body.map((q) => q[1])), m = c(p.m, 20, 0), yb = ymin - m;
      const obrys = podKrivkou(S.body, yb);
      K.car(obrys, 'obrys', { z: true });
      S.uzly.forEach((q, i) => K.kriz(q[0], q[1], 3.5, String(i + 1), 'druha'));
      if (p.hrebinek !== false && S.kMax > 0) {
        const sk = Math.min(30, Math.max(8, (O.meze(S.body).x1 - O.meze(S.body).x0) * 0.06)) / S.kMax, obal = [];
        for (const [P, n, k] of S.hrebinek) { const Q = [P[0] - n[0] * k * sk, P[1] - n[1] * k * sk]; K.car([P, Q], 'zelena'); obal.push(Q); }
        K.car(obal, 'zelena');
      }
      if (S.kde && isFinite(S.rMin)) K.kriz(S.kde[0], S.kde[1], 3, 'Rmin ' + cz(S.rMin, 0), 'kota');
      const bb = O.meze(S.body);
      K.kota([bb.x0, yb], [bb.x1, yb], -8);
      const tl = c(p.tlLati, 6, 0.1), eps = c(p.eps, 0.6, 0.05) / 100;
      const prt = isFinite(S.rMin) ? tl / (2 * S.rMin) : 0;
      V.hodnoty.push(['Model', S.metoda === 'kubicky' ? 'kubický spline y(x) – min. ∫y″² dx' : 'parametrický spline podle délky oblouku'], ['Délka křivky (délka lati)', mm(S.delka)],
        ['Nejmenší poloměr ohybu', isFinite(S.rMin) ? mm(S.rMin, 1) : '∞ (přímka)'], ['Energie ohybu ∫κ² ds', cz(S.energie * 1000, 4) + ' ·10⁻³ 1/mm'],
        ['Přetvoření lati tl. ' + cz(tl, 1), cz(prt * 100, 3) + ' %'], ['Nejtlustší lať pro ' + cz(eps * 100, 2) + ' %', isFinite(S.rMin) ? mm(2 * S.rMin * eps, 1) : '–']);
      if (prt > eps) V.varovani.push(`Lať tl. ${cz(tl, 1)} mm se v nejostřejším místě protáhne o ${cz(prt * 100, 2)} % > ${cz(eps * 100, 2)} % – hrozí zlomení; použijte tenčí lať nebo ji napařte.`);
      V.tabulky.push({ nazev: 'Body (hřebíky)', hlavicka: ['#', 'x', 'y'], radky: S.uzly.map((q, i) => [String(i + 1), cz(q[0], 1), cz(q[1], 1)]) });
      V.dily.push({ id: 'A', nazev: 'Šablona křivky 1:1', prvky: K.prvky, obrys: [obrys], stl: true });
      V.teleso = deska(obrys, 6);
      V.info = `Délka lati ${mm(S.delka)}, nejmenší poloměr ${isFinite(S.rMin) ? mm(S.rMin, 0) : '∞'}.`;
      return V;
    },
  };

  /* ---------------- výsledek a výpočet ---------------- */
  function vysledek() { return { dily: [], hodnoty: [], tabulky: [], kusovnik: [], varovani: [], teleso: null, info: '' }; }
  function normalizuj(rezim, p) {
    const R = REZIMY[rezim]; if (!R) return {};
    const out = JSON.parse(JSON.stringify(R.vychozi));
    for (const k of Object.keys(p || {})) if (p[k] !== undefined && p[k] !== null && p[k] !== '') out[k] = p[k];
    return out;
  }
  function vypocti(rezim, p) {
    const R = REZIMY[rezim]; if (!R) throw new Error('neznámý režim ' + rezim);
    const V = R.vypocet(normalizuj(rezim, p));
    V.rezim = rezim; V.nazev = R.nazev;
    for (const d of V.dily) d.meze = KR.mezePrvku(d.prvky);
    return V;
  }
  function vychoziProjekt(rezim) {
    const p = {};
    for (const k of Object.keys(REZIMY)) p[k] = JSON.parse(JSON.stringify(REZIMY[k].vychozi));
    return { rezim: rezim || 'tetiva', p, nast: Object.assign({}, NASTAVENI), nazev: '', dil: 0 };
  }
  const NASTAVENI = { papir: 'a4', okraj: 8, prekryv: 15, papirW: 210, papirH: 297, kalibX: 100, kalibY: 100, popisy: true, stlTl: 4, stlStul: 220, stlVule: 0.15, stlCislo: true, ukazListy: true };

  const API = { SKUPINY, REZIMY, NASTAVENI, vypocti, normalizuj, vychoziProjekt, vysledek, pom: { podKrivkou, nadKrivkou, poradnice, TAB_PORADNIC, deska, c, mm, st } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.OBLR = API;
})(typeof window !== 'undefined' ? window : globalThis);
