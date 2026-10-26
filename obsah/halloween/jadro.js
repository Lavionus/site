/* ============================================================
   halloween/jadro.js – geometrie halloweenských dekorací. Bez DOM.

     H.sestav(p)  → model {druh, sirka, vyska, cesty[], otevrene[], sirkaCary,
                           pomocne[], obrys?, diry?, info, varovani[]}
       cesty     – uzavřené obrysy materiálu (vyplňují se evenodd)
       otevrene  – čáry o šířce sirkaCary (čárová pavučina pro plotr)
       pomocne   – ohyby a značky (jen pro tisk/náhled, ne k řezání)
     H.SILUETY    – tvary v jednotkových souřadnicích (výška ≈ 1, y dolů)
     H.vychozi()

   Tvary se skládají sjednocením a rozdílem mnohoúhelníků přes Clipper
   (obsah/lib/clipper.min.js), čáry s tloušťkou přes ClipperOffset.
   Jednotky mm, počátek vlevo nahoře.
   ============================================================ */
(function (koren) {
  'use strict';
  const uzel = typeof module !== 'undefined' && module.exports;
  const CL = uzel ? require('../lib/clipper.min.js') : koren.ClipperLib;
  const KR = uzel ? require('../krajky/jadro.js') : koren.KRAJKY;
  const H = {};
  const TAU = Math.PI * 2;

  /* ---------- Clipper ---------- */
  const SC = 1000;
  const doC = p => p.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) }));
  const zC = p => p.map(q => [q.X / SC, q.Y / SC]);
  const kladne = p => (CL.Clipper.Area(doC(p)) < 0 ? p.slice().reverse() : p);   // ruční tvary vždy stejně orientované
  function operace(typ, a, b) {
    const c = new CL.Clipper();
    c.AddPaths(a.map(doC), CL.PolyType.ptSubject, true);
    if (b && b.length) c.AddPaths(b.map(doC), CL.PolyType.ptClip, true);
    const r = new CL.Paths();
    c.Execute(typ, r, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    return r.map(zC).filter(q => q.length > 2);
  }
  const sjednot = a => operace(CL.ClipType.ctUnion, a);
  const rozdil = (a, b) => operace(CL.ClipType.ctDifference, a, b);
  const prunik = (a, b) => operace(CL.ClipType.ctIntersection, a, b);
  function tahy(cary, w) {   // otevřené čáry → plochy o šířce w s kulatými konci
    const o = new CL.ClipperOffset(2, 0.02 * SC);
    o.AddPaths(cary.map(doC), CL.JoinType.jtRound, CL.EndType.etOpenRound);
    const r = new CL.Paths(); o.Execute(r, w / 2 * SC);
    return r.map(zC);
  }
  H.sjednot = sjednot; H.rozdil = rozdil; H.tahy = tahy;

  /* ---------- základní tvary (výsledek kladně orientovaný) ---------- */
  const elipsa = (cx, cy, rx, ry, n, uhel) => {
    const o = [], c = Math.cos(uhel || 0), s = Math.sin(uhel || 0);
    n = n || 48;
    for (let i = 0; i < n; i++) { const a = TAU * i / n, x = rx * Math.cos(a), y = ry * Math.sin(a); o.push([cx + x * c - y * s, cy + x * s + y * c]); }
    return kladne(o);
  };
  const obdelnik = (x0, y0, x1, y1) => kladne([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const mnoho = p => kladne(p);
  function bezier(a, c, b, n) {   // kvadratická, bez počátečního bodu
    const o = [];
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
    return o;
  }
  const zrcadli = pul => {   // pravá polovina od osy nahoře po osu dole → celý obrys
    const o = pul.slice();
    for (let i = pul.length - 2; i > 0; i--) o.push([-pul[i][0], pul[i][1]]);
    return kladne(o);
  };

  /* ---------- siluety: jednotkové souřadnice, y dolů ---------- */
  function netopyr() {
    const p = [[0, 0.02], [0.05, -0.12], [0.09, 0.02], [0.13, 0.06], [0.35, -0.08], [0.62, -0.14], [0.86, -0.08], [1.0, 0.05]];
    const zuby = [[0.74, 0.16], [0.5, 0.2], [0.28, 0.22], [0.13, 0.2]];
    let a = p[p.length - 1];
    for (const b of zuby) {   // vroubky spodního okraje křídla – oblouky prohnuté nahoru
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.3 * Math.hypot(b[0] - a[0], b[1] - a[1])];
      p.push(...bezier(a, m, b, 8)); a = b;
    }
    p.push([0.1, 0.33], [0.04, 0.42], [0, 0.44]);
    return [zrcadli(p)];
  }
  function duch() {
    const p = [];
    for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + Math.PI / 2 * i / 16; p.push([0.35 * Math.cos(a), 0.35 + 0.35 * Math.sin(a)]); }
    p.push([0.38, 0.75], [0.42, 0.95]);
    for (let i = 1; i <= 36; i++) { const x = 0.42 - 0.42 * i / 36; p.push([x, 0.95 - 0.06 * Math.abs(Math.sin(x / 0.42 * Math.PI * 1.5))]); }
    const telo = sjednot([zrcadli(p), elipsa(0.4, 0.5, 0.15, 0.06, 32, -0.5), elipsa(-0.4, 0.5, 0.15, 0.06, 32, 0.5)]);
    return rozdil(telo, [elipsa(-0.12, 0.33, 0.06, 0.09), elipsa(0.12, 0.33, 0.06, 0.09), elipsa(0, 0.56, 0.07, 0.1)]);
  }
  function dyneTelo() {
    const lalocky = [[-0.34, 0.22], [-0.13, 0.25], [0.13, 0.25], [0.34, 0.22]].map(([x, rx]) => elipsa(x, 0.6, rx, 0.42));
    const stopka = mnoho([[-0.05, 0.25], [0.05, 0.25], [0.07, 0.08], [0.13, 0.0], [0.1, -0.04], [0.02, 0.04]]);
    return sjednot(lalocky.concat([stopka]));
  }
  function kocka() {
    const usi = [mnoho([[-0.19, 0.22], [-0.17, 0.0], [-0.04, 0.12]]), mnoho([[0.19, 0.22], [0.17, 0.0], [0.04, 0.12]])];
    const ocas = [[0.22, 0.92]].concat(bezier([0.22, 0.92], [0.62, 0.9], [0.5, 0.45], 16));
    return sjednot([elipsa(0, 0.68, 0.28, 0.3), elipsa(0, 0.28, 0.2, 0.18), ...usi, ...tahy([ocas], 0.08)]);
  }
  function klobouk() {
    const kuzel = mnoho([[-0.26, 0.86], ...bezier([-0.26, 0.86], [-0.05, 0.4], [0.32, 0.02], 16), ...bezier([0.32, 0.02], [0.08, 0.4], [0.26, 0.86], 16)]);
    const t = sjednot([elipsa(0, 0.86, 0.52, 0.1), kuzel]);
    return rozdil(t, [obdelnik(-0.07, 0.68, 0.07, 0.8)]);
  }
  function nahrobek() {
    const t = sjednot([obdelnik(-0.3, 0.35, 0.3, 0.97), elipsa(0, 0.35, 0.3, 0.3), elipsa(0, 0.97, 0.46, 0.06)]);
    return rozdil(t, sjednot([obdelnik(-0.035, 0.3, 0.035, 0.62), obdelnik(-0.12, 0.38, 0.12, 0.45)]));
  }
  function mesic() { return rozdil([elipsa(0, 0.5, 0.5, 0.5, 96)], [elipsa(0.22, 0.4, 0.44, 0.44, 96)]); }
  function lebka() {
    const t = sjednot([elipsa(0, 0.42, 0.4, 0.4, 64), obdelnik(-0.21, 0.6, 0.21, 0.93), elipsa(0, 0.93, 0.21, 0.05)]);
    const diry = [elipsa(-0.15, 0.45, 0.1, 0.11), elipsa(0.15, 0.45, 0.1, 0.11), mnoho([[-0.05, 0.68], [0.05, 0.68], [0, 0.57]])];
    for (const x of [-0.11, 0, 0.11]) diry.push(obdelnik(x - 0.014, 0.79, x + 0.014, 0.92));
    return rozdil(t, diry);
  }
  function pavoukTvar() {
    const nohy = [];
    for (const st of [-1, 1]) for (let k = 0; k < 4; k++) {
      const y0 = 0.32 + (k - 1.5) * 0.05;
      nohy.push([[st * 0.06, y0], [st * 0.32, y0 - 0.2 + k * 0.1], [st * 0.48, y0 + (k - 1.5) * 0.2 + 0.08]]);
    }
    return sjednot([elipsa(0, 0.3, 0.11, 0.12), elipsa(0, 0.55, 0.15, 0.2), ...tahy(nohy, 0.045)]);
  }
  H.SILUETY = {
    netopyr: { nazev: '🦇 Netopýr', tvar: netopyr },
    duch: { nazev: '👻 Duch', tvar: duch },
    dyne: { nazev: '🎃 Dýně', tvar: () => sjednot(dyneTelo()) },
    kocka: { nazev: '🐈‍⬛ Kočka', tvar: kocka },
    pavouk: { nazev: '🕷 Pavouk', tvar: pavoukTvar },
    klobouk: { nazev: '🧙 Klobouk', tvar: klobouk },
    nahrobek: { nazev: '🪦 Náhrobek', tvar: nahrobek },
    mesic: { nazev: '🌙 Měsíc', tvar: mesic },
    lebka: { nazev: '💀 Lebka', tvar: lebka },
  };

  /* transformace: výška h mm, levý horní roh (x, y), zrcadlení */
  const meze = polys => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  };
  H.meze = meze;
  function umisti(polys, h, x, y, zrcadlo) {
    const m = meze(polys), k = h / m.h;
    return polys.map(p => p.map(([a, b]) => [x + (zrcadlo ? m.x1 - a : a - m.x0) * k, y + (b - m.y0) * k]));
  }
  H.umisti = umisti;

  /* ---------- obličej dýně (jednotky dýně, y od vršku stopky) ---------- */
  H.OCI = { trojuhelnik: 'trojúhelníky', zle: 'zlé', kulate: 'kulaté', vesele: 'veselé obloučky' };
  H.NOS = { trojuhelnik: 'trojúhelník', srdce: 'srdíčko', zadny: 'žádný' };
  H.USTA = { zubaty: 'úsměv se zuby (můstky)', zuby: 'úsměv se zoubky', zigzag: 'cik-cak', usmev: 'úsměv', ooo: 'údiv „ó"' };
  function oblicej(q, mustekJ) {
    const e = 0.12, diry = [];
    for (const st of [-1, 1]) {
      const cx = 0.2 * st, cy = 0.45, X = (x, y) => [cx + st * x, cy + y];
      if (q.oci === 'kulate') diry.push(elipsa(cx, cy, 0.75 * e, 0.75 * e));
      else if (q.oci === 'zle') diry.push(mnoho([X(-e, -0.1 * e), X(e, -0.65 * e), X(0.15 * e, 0.6 * e)]));
      else if (q.oci === 'vesele') {
        const o = [];
        for (let i = 0; i <= 16; i++) { const x = -e + 2 * e * i / 16; o.push(X(x, 0.3 * e - 0.9 * e * (1 - (x / e) ** 2))); }
        for (let i = 16; i >= 0; i--) { const x = -e + 2 * e * i / 16; o.push(X(x, 0.3 * e - 0.4 * e * (1 - (x / e) ** 2))); }
        diry.push(mnoho(o));
      } else diry.push(mnoho([X(-e, 0.55 * e), X(e, 0.55 * e), X(0, -0.8 * e)]));
    }
    const n = 0.06;
    if (q.nos === 'trojuhelnik') diry.push(mnoho([[-n, 0.6 + 0.6 * n], [n, 0.6 + 0.6 * n], [0, 0.6 - 0.8 * n]]));
    else if (q.nos === 'srdce') diry.push(...umisti(netvar('srdce'), 0.1, -0.055, 0.54));
    const m = 0.3, yt = x => 0.71 + 0.05 * (1 - (x / m) ** 2), yb = x => 0.71 + 0.17 * (1 - (x / m) ** 2), N = 40;
    const ustaUsmev = () => {
      const o = [];
      for (let i = 0; i <= N; i++) { const x = -m + 2 * m * i / N; o.push([x, yt(x)]); }
      for (let i = N; i >= 0; i--) { const x = -m + 2 * m * i / N; o.push([x, yb(x)]); }
      return mnoho(o);
    };
    const zubu = Math.max(1, Math.min(9, Math.round(q.zubu || 4)));
    if (q.usta === 'ooo') diry.push(elipsa(0, 0.8, 0.08, 0.09));
    else if (q.usta === 'zigzag') {
      const o = [], K = 2 * zubu + 1;
      for (let i = 0; i <= K; i++) { const x = -m + 2 * m * i / K; o.push([x, yt(x) + (i % 2 ? 0.06 : 0) - (i === 0 || i === K ? 0 : 0.01)]); }
      for (let i = N; i >= 0; i--) { const x = -m + 2 * m * i / N; o.push([x, yb(x)]); }
      diry.push(mnoho(o));
    } else if (q.usta === 'zuby') {
      const z = [], tw = Math.max(mustekJ, 0.6 * m / zubu);
      for (let i = 0; i < zubu; i++) {
        const x = -m + 2 * m * (i + 0.5) / zubu, nahore = i % 2 === 0, d = (yb(x) - yt(x)) * 0.45;
        z.push(nahore ? obdelnik(x - tw / 2, yt(x) - 0.05, x + tw / 2, yt(x) + d) : obdelnik(x - tw / 2, yb(x) - d, x + tw / 2, yb(x) + 0.05));
      }
      diry.push(...rozdil([ustaUsmev()], z));
    } else if (q.usta === 'zubaty') {
      const z = [];
      for (let i = 1; i < zubu + 1; i++) { const x = -m + 2 * m * i / (zubu + 1); z.push(obdelnik(x - mustekJ / 2, 0.6, x + mustekJ / 2, 0.95)); }
      diry.push(...rozdil([ustaUsmev()], z));
    } else diry.push(ustaUsmev());
    return diry;
  }
  const netvar = jmeno => {   // malé pomocné tvary
    if (jmeno === 'srdce') {
      const o = [];
      for (let i = 0; i < 48; i++) { const t = TAU * i / 48; o.push([16 * Math.sin(t) ** 3 / 32, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 32]); }
      return [kladne(o)];
    }
    return [];
  };

  /* ---------- režimy ---------- */
  H.vychozi = () => ({
    druh: 'pavucina', seed: 1,
    pavucina: { tvar: 'kruh', velikost: 180, paprsky: 14, zavity: 9, nepravidelnost: 0.5, prohnuti: 0.25, vlakno: 1.6, styl: 'rez', pavouk: true, velPavouka: 32 },
    dyne: { vyska: 160, oci: 'trojuhelnik', nos: 'trojuhelnik', usta: 'zubaty', zubu: 3, mustek: 6 },
    girlanda: { motiv: 'duch', sirka: 80, vyska: 100, panelu: 6, spojka: 0.5, tloustka: 6, retez: true },
    siluety: { motivy: Object.keys(H.SILUETY), pocet: 14, min: 30, max: 75, list: '210x297', okraj: 10, mezera: 5, zrcadlit: true, obliceje: true },
    barvy: {
      pavucina: ['#e8e8ec', '#1b1830'], dyne: ['#e8711a', '#ffd34d'],
      girlanda: ['#17151c', '#f0892e'], siluety: ['#17151c', '#f0892e'],
    },
  });

  function pavucina(q, rnd) {
    const D = Math.max(40, +q.velikost), N = Math.max(4, Math.min(48, Math.round(q.paprsky))), M = Math.max(2, Math.min(40, Math.round(q.zavity)));
    const r = Math.max(0, Math.min(1, +q.nepravidelnost)), w = Math.max(0.2, +q.vlakno), sag = Math.max(0, Math.min(0.8, +q.prohnuti));
    const roh = q.tvar === 'roh', varovani = [];
    const C = roh ? [w / 2, w / 2] : [D / 2, D / 2], R = roh ? D - w : D / 2 - w;   // vlákno nesmí přetéct přes okraj
    // paprsky: úhel a délka (u rohu krajní leží na stěnách)
    const pap = [];
    for (let i = 0; i < N; i++) {
      let a, L;
      if (roh) {
        a = Math.PI / 2 * i / (N - 1);
        if (i > 0 && i < N - 1) a += (rnd() - 0.5) * r * Math.PI / 2 / (N - 1) * 0.6;
        L = (i === 0 || i === N - 1) ? R - w / 2 : R * (1 - 0.25 * r * rnd()) - w / 2;
      } else {
        a = TAU * i / N + (rnd() - 0.5) * r * TAU / N * 0.6;
        L = R * (1 - 0.22 * r * rnd());
      }
      pap.push({ a, L, x: Math.cos(a), y: Math.sin(a) });
    }
    const bod = (i, f) => [C[0] + pap[i].x * pap[i].L * f, C[1] + pap[i].y * pap[i].L * f];
    const cary = [], otevrene = [];
    for (let i = 0; i < N; i++) cary.push([C, bod(i, 1)]);
    // závity: soustředné prohnuté oblouky (prohnutí ke středu)
    const hub = 0.1;
    const usekuMezi = roh ? N - 1 : N;
    for (let j = 1; j <= M; j++) {
      const fj = hub + (1 - hub) * Math.pow(j / (M + 0.6), 0.95);
      const f = pap.map(() => fj * (1 + (rnd() - 0.5) * 0.12 * r));
      const krivka = [bod(0, f[0])];
      for (let i = 0; i < usekuMezi; i++) {
        const i2 = (i + 1) % N, a = krivka[krivka.length - 1], b = bod(i2, f[i2]);
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], c = [mid[0] + (C[0] - mid[0]) * sag * 0.5, mid[1] + (C[1] - mid[1]) * sag * 0.5];
        krivka.push(...bezier(a, c, b, 10));
      }
      cary.push(krivka);
    }
    // rám: spojnice konců paprsků (u kruhu dokola), u rohu stěny
    const ram = [];
    for (let i = 0; i < N; i++) ram.push(bod(i, 1));
    if (!roh) ram.push(ram[0]);
    else ram.unshift([C[0], C[1] + 0]);
    cary.push(roh ? [bod(N - 1, 1), C, bod(0, 1)] : ram);
    if (roh) cary.push(ram.slice(1));
    // pavouk
    let pavouk = [];
    if (q.pavouk) {
      const s = Math.max(8, +q.velPavouka);
      if (roh) {
        const i = Math.floor(N / 2), kotva = bod(i, 0.55), y1 = kotva[1] + s * 0.9;
        cary.push([kotva, [kotva[0], y1]]);
        pavouk = umisti(pavoukTvar(), s, kotva[0] - s * 0.48, y1 - s * 0.25);
      } else {
        const i = Math.floor(rnd() * N), st = bod(i, 0.62), a = pap[i].a + Math.PI / 2;
        const t = umisti(pavoukTvar(), s, -s * 0.48, -s * 0.45);   // střed těla kolem počátku
        const c = Math.cos(a), sn = Math.sin(a);
        pavouk = t.map(p => p.map(([x, y]) => [st[0] + x * c - y * sn, st[1] + x * sn + y * c]));
      }
    }
    let cesty;
    if (q.styl === 'cary') { otevrene.push(...cary); cesty = pavouk.length ? sjednot(pavouk) : []; }
    else cesty = sjednot(tahy(cary, w).concat(pavouk));
    const m = meze(cesty.length ? cesty : cary);
    const sirka = roh ? D : D, vyska = Math.max(roh ? D : D, m.y1 + 1);
    return { druh: 'pavucina', sirka, vyska, cesty, otevrene, sirkaCary: w, pomocne: [], varovani,
      info: { vlaken: cary.length, delkaVlaken: cary.reduce((s, c) => s + c.reduce((a, b, k) => k ? a + Math.hypot(b[0] - c[k - 1][0], b[1] - c[k - 1][1]) : 0, 0), 0) / 1000 } };
  }

  function dyne(q, rnd) {
    const Hm = Math.max(40, +q.vyska), telo = dyneTelo(), mt = meze(telo), k = Hm / mt.h;
    const mustekJ = Math.max(0.5, +q.mustek) / k;
    const obr = telo.reduce((a, b) => Math.abs(KR.plocha(b)) > Math.abs(KR.plocha(a)) ? b : a);
    const diry = oblicej(q, mustekJ);
    const T = p => p.map(([x, y]) => [(x - mt.x0) * k + 5, (y - mt.y0) * k + 5]);
    const obrys = T(obr), d = diry.map(T);
    const model = { druh: 'dyne', sirka: mt.w * k + 10, vyska: Hm + 10, obrys, diry: d, cesty: [obrys].concat(d), otevrene: [], pomocne: [], varovani: [],
      info: { mustek: +q.mustek, otvoru: d.length, sirkaDyne: mt.w * k } };
    const b = KR.mustky(model);
    model.info.nejuzsi = b.min; model.info.kde = b;
    if (b.min < +q.mustek * 0.98) model.varovani.push(`Nejužší místo dužiny má ${b.min.toFixed(1)} mm – méně než zadaný můstek ${q.mustek} mm. Zvětšete dýni nebo uberte zuby.`);
    return model;
  }

  function girlanda(q) {
    const W = Math.max(20, +q.sirka), Hm = Math.max(20, +q.vyska), t = Math.max(1, +q.tloustka);
    const s = H.SILUETY[q.motiv] || H.SILUETY.netopyr;
    const tvar = s.tvar(), m = meze(tvar);
    const k = Math.min(Hm * 0.92 / m.h, W * 0.98 / m.w);
    const x0 = (W - m.w * k) / 2, y0 = (Hm - m.h * k) / 2;
    const polys = umisti(tvar, m.h * k, x0, y0);
    const yb = y0 + m.h * k * Math.max(0.05, Math.min(0.95, +q.spojka));
    const panel = obdelnik(0, 0, W, Hm);
    const jeden = prunik(sjednot(polys.concat([obdelnik(-1, yb - t / 2, W + 1, yb + t / 2)])), [panel]);
    const pomocne = [{ cesty: [[[0, -4], [0, Hm + 4]], [[W, -4], [W, Hm + 4]]], barva: '#1f6fd1', w: 0.35, carky: [3, 2], otevrene: true },
      { cesty: [[[0, yb - t / 2], [0, yb + t / 2]], [[W, yb - t / 2], [W, yb + t / 2]]], barva: '#2e9b3a', w: 1.6, otevrene: true }];
    const pomocneJeden = pomocne.map(x => Object.assign({}, x));
    const kusu = q.retez ? Math.max(1, Math.min(12, Math.round(q.panelu))) : 1;
    let cesty = jeden;
    if (kusu > 1) {
      const vse = [];
      for (let i = 0; i < kusu; i++) vse.push(...jeden.map(p => p.map(([x, y]) => [x + i * W, y])));
      cesty = sjednot(vse);
      pomocne[0].cesty = [];
      for (let i = 0; i <= kusu; i++) pomocne[0].cesty.push([[i * W, -4], [i * W, Hm + 4]]);
      pomocne.pop();
    }
    return { druh: 'girlanda', sirka: W * kusu, vyska: Hm, cesty, otevrene: [], pomocne, varovani: [], sablona: { druh: 'girlanda', cesty: jeden, otevrene: [], sirka: W, vyska: Hm, pomocne: pomocneJeden, varovani: [], info: {} },
      info: { panelu: Math.round(q.panelu), delkaPapiru: W * Math.round(q.panelu), kusu } };
  }

  function siluety(q, rnd) {
    const [Wp, Hp] = String(q.list).split('x').map(Number), okraj = +q.okraj || 10, g = Math.max(1, +q.mezera || 5);
    const W = Wp - 2 * okraj, Hh = Hp - 2 * okraj;
    const motivy = (q.motivy || []).filter(m => H.SILUETY[m]);
    const varovani = [];
    if (!motivy.length) return { druh: 'siluety', sirka: W, vyska: Hh, cesty: [], otevrene: [], pomocne: [], varovani: ['Vyberte aspoň jeden motiv.'], info: { kusu: 0 } };
    const lo = Math.max(10, Math.min(+q.min, +q.max)), hi = Math.max(lo, +q.max);
    const kusy = [];
    for (let i = 0; i < Math.max(1, Math.round(q.pocet)); i++) {
      const jm = motivy[i % motivy.length];
      let tvar = H.SILUETY[jm].tvar();
      if (jm === 'dyne' && q.obliceje) {
        const t = dyneTelo(), f = oblicej({ oci: Object.keys(H.OCI)[Math.floor(rnd() * 4)], nos: rnd() < 0.7 ? 'trojuhelnik' : 'zadny', usta: ['zuby', 'zigzag', 'usmev'][Math.floor(rnd() * 3)], zubu: 3 }, 0.04);
        tvar = rozdil(t, f);
      }
      const vel = lo + (hi - lo) * Math.pow(rnd(), 1.3), m = meze(tvar), h = vel * Math.min(1, m.h / m.w);   // velikost = delší strana
      kusy.push({ jm, tvar, h, w: m.w / m.h * h, zrc: q.zrcadlit && rnd() < 0.5 });
    }
    // regálové skládání: od nejvyšších, zleva doprava
    kusy.sort((a, b) => b.h - a.h);
    const cesty = []; let x = 0, y = 0, radek = 0, nevesel = 0, polozeno = 0;
    for (const k of kusy) {
      let h = k.h, w = k.w;
      if (w > W) { h *= W / w; w = W; }
      if (x + w > W) { x = 0; y += radek + g; radek = 0; }
      if (y + h > Hh) { nevesel++; continue; }
      cesty.push(...umisti(k.tvar, h, x, y, k.zrc));
      x += w + g; radek = Math.max(radek, h); polozeno++;
    }
    if (nevesel) varovani.push(`${nevesel} siluet se na list nevešlo – zmenšete velikost nebo počet.`);
    return { druh: 'siluety', sirka: W, vyska: Hh, cesty, otevrene: [], pomocne: [], varovani, info: { kusu: polozeno } };
  }

  H.sestav = function (p) {
    const rnd = KR.nahoda(p.seed || 1);
    if (p.druh === 'dyne') return dyne(p.dyne, rnd);
    if (p.druh === 'girlanda') return girlanda(p.girlanda);
    if (p.druh === 'siluety') return siluety(p.siluety, rnd);
    return pavucina(p.pavucina, rnd);
  };

  /* náhodné nastavení aktuálního režimu (rozměry zůstanou) */
  H.nahodny = function (p) {
    const n = JSON.parse(JSON.stringify(p));
    n.seed = (p.seed || 1) + 1;
    const rnd = KR.nahoda(n.seed * 7919), vyber = o => { const k = Object.keys(o); return k[Math.floor(rnd() * k.length)]; };
    if (p.druh === 'dyne') Object.assign(n.dyne, { oci: vyber(H.OCI), nos: vyber(H.NOS), usta: vyber(H.USTA), zubu: 2 + Math.floor(rnd() * 4) });
    else if (p.druh === 'girlanda') n.girlanda.motiv = vyber(H.SILUETY);
    else if (p.druh === 'pavucina') Object.assign(n.pavucina, { paprsky: 9 + Math.floor(rnd() * 12), zavity: 6 + Math.floor(rnd() * 9),
      nepravidelnost: Math.round(rnd() * 80) / 100, prohnuti: Math.round((0.15 + rnd() * 0.45) * 100) / 100 });
    return n;
  };

  if (uzel) module.exports = H;
  else koren.HALLOWEEN = H;
})(typeof window !== 'undefined' ? window : globalThis);
