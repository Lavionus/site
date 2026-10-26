/* ============================================================
   krajky/jadro.js – geometrie krajek. Bez DOM, běží i v node.

     K.sestav(p)        → model dečky / lemovky v mm:
                          {druh, sirka, vyska, obrys, diry[], varovani[], info}
     K.podvinek(p)      → podvinek paličkované krajky (torchon):
                          {druh:'podvinek', sirka, vyska, spendliky[], cary[], info}
     K.mustky(model)    → nejužší můstek mezi otvory a okrajem {min, x, y}
     K.klin(p, model, F)→ výseč pro papír složený do F vrstev {ok, duvod, cesta, ohyby}
     K.nahodny(seed, p) → náhodný vzor (zachová druh, rozměry a můstek)
     K.vychozi()        → výchozí parametry

   Souřadnice: mm, počátek vlevo nahoře, osa y dolů (jako SVG).
   Otvor (motiv) se kreslí v jednotkové buňce u ∈ [−1, 1] (napříč),
   v ∈ [0, 1] (od středu ven / od spodní hrany nahoru) a zobrazí se do
   buňky pásu zmenšené o polovinu můstku z každé strany – sousední otvory
   tak mají mezi sebou vždy aspoň šířku můstku.
   ============================================================ */
(function (koren) {
  'use strict';
  const K = {};
  const TAU = Math.PI * 2;

  // náhodná čísla se semínkem (mulberry32) – stejné semínko = stejný vzor
  K.nahoda = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- motivy otvorů (souměrné podle u = 0) ---------- */
  const polarni = (n, rho) => {        // uzavřená křivka kolem středu buňky, φ od osy nahoru
    const o = [];
    for (let i = 0; i < n; i++) {
      const f = TAU * i / n, r = rho(f);
      o.push([r * Math.sin(f), 0.5 + 0.5 * r * Math.cos(f)]);
    }
    return o;
  };
  K.MOTIVY = {
    kapka: { nazev: '💧 Kapka', body: n => {
      const o = [];
      for (let i = 0; i < n; i++) {
        const t = TAU * i / n;
        o.push([Math.sin(t) * Math.pow(Math.abs(Math.sin(t / 2)), 1.3) / 0.62, (Math.cos(t) + 1) / 2]);
      }
      return o.map(([u, v]) => [Math.max(-1, Math.min(1, u)), v]);
    } },
    oval: { nazev: '🥚 Ovál', body: n => polarni(n, () => 1) },
    krouzek: { nazev: '⭕ Kroužek', ctverec: true, body: n => polarni(n, () => 1) },
    listek: { nazev: '🍃 Lístek', body: n => {
      const o = [], h = n / 2;
      for (let i = 0; i <= h; i++) { const v = i / h; o.push([Math.sin(Math.PI * v), v]); }
      for (let i = h - 1; i > 0; i--) { const v = i / h; o.push([-Math.sin(Math.PI * v), v]); }
      return o;
    } },
    oblouk: { nazev: '⛪ Gotické okno', body: n => {
      // svislé boky do výšky 0,55, nahoře lomený oblouk ze dvou kruhových výsečí
      const o = [[-1, 0], [1, 0]], m = Math.max(6, Math.round(n / 3)), th = Math.PI / 3, k = 0.45 / (2 * Math.sin(th));
      for (let i = 0; i <= m; i++) { const a = th * i / m; o.push([-1 + 2 * Math.cos(a), 0.55 + k * 2 * Math.sin(a)]); }
      for (let i = m - 1; i >= 0; i--) { const a = th * i / m; o.push([1 - 2 * Math.cos(a), 0.55 + k * 2 * Math.sin(a)]); }
      return o;
    } },
    kosoctverec: { nazev: '🔷 Kosočtverec', body: () => [[0, 0], [1, 0.5], [0, 1], [-1, 0.5]] },
    kvet: { nazev: '🌸 Kvítek', ctverec: true, body: n => polarni(n, f => 0.45 + 0.55 * Math.pow(Math.abs(Math.cos(5 * f / 2)), 0.8)) },
    trojlistek: { nazev: '☘️ Trojlístek', ctverec: true, body: n => polarni(n, f => 0.42 + 0.58 * Math.pow(Math.abs(Math.cos(3 * f / 2)), 0.7)) },
    srdce: { nazev: '❤️ Srdce', ctverec: true, body: n => {
      const o = [];
      for (let i = 0; i < n; i++) {
        const t = TAU * i / n;
        const x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        o.push([x / 16, (y + 17) / 29.2]);   // y ∈ [−17, 12] → špička dole (ke středu)
      }
      return o;
    } },
    hvezda: { nazev: '⭐ Hvězdička', ctverec: true, body: () => {
      const o = [];
      for (let i = 0; i < 10; i++) { const f = Math.PI * i / 5, r = i % 2 ? 0.42 : 1; o.push([r * Math.sin(f), 0.5 + 0.5 * r * Math.cos(f)]); }
      return o;
    } },
    vejir: { nazev: '🪭 Vějíř', body: n => {
      const o = [[0, 0]], m = Math.max(12, n);
      for (let i = 0; i <= m; i++) {   // horní hrana ze tří obloučků, zprava doleva
        const u = 1 - 2 * i / m, x = (1 - u) / 2 * 3, f = x - Math.floor(x);
        o.push([u * 0.97, 0.72 + 0.28 * Math.sqrt(Math.max(0, 1 - (2 * f - 1) * (2 * f - 1)))]);
      }
      return o;
    } },
  };

  /* ---------- profily okraje h(φ) ∈ [0, 1], φ ∈ [0, 1), vrchol v φ = 0,5 ---------- */
  const oblouk = f => Math.sqrt(Math.max(0, 1 - (2 * f - 1) * (2 * f - 1)));
  K.OKRAJE = {
    rovny: { nazev: 'rovný', h: () => 0 },
    oblouky: { nazev: 'obloučky', h: oblouk },
    spicky: { nazev: 'špičky', h: f => 1 - Math.abs(2 * f - 1) },
    vlnky: { nazev: 'vlnky', h: f => 0.5 - 0.5 * Math.cos(TAU * f) },
    pikoty: { nazev: 'obloučky s pikoty', h: f => {
      const x = 2 * f - 1;
      let b = 0;
      for (const c of [-0.55, 0, 0.55]) b = Math.max(b, Math.sqrt(Math.max(0, 1 - ((x - c) / 0.17) * ((x - c) / 0.17))));
      return 0.78 * oblouk(f) + 0.22 * b;
    } },
  };

  K.STREDY = { plny: 'plný', kruh: 'kruhový otvor', kvet: 'květ', hvezda: 'hvězda' };

  K.vychozi = () => ({
    druh: 'decka',
    prumer: 180, mustek: 1.6, symetrie: 8,
    pas: { delka: 300, vyska: 50 },
    stred: { typ: 'kvet', polomer: 18, nasobek: 1 },
    okraj: { typ: 'oblouky', vyska: 9, nasobek: 3, diry: true },
    kruhy: [
      { motiv: 'kapka', vaha: 1.2, nasobek: 2, rady: 1, strida: false, posun: false, otoc: false, vypln: 0.85 },
      { motiv: 'krouzek', vaha: 0.6, nasobek: 4, rady: 1, strida: false, posun: true, otoc: false, vypln: 0.8 },
      { motiv: 'oblouk', vaha: 1.4, nasobek: 4, rady: 1, strida: false, posun: false, otoc: false, vypln: 0.85 },
      { motiv: 'kosoctverec', vaha: 1, nasobek: 6, rady: 2, strida: true, posun: false, otoc: false, vypln: 0.8 },
    ],
    podvinek: { roztec: 3, uhel: 45, velikost: 4, pudice: 1, opakovani: 4, motivy: ['platno', 'pavouk'], vejir: true },
  });

  /* ---------- pomocné ---------- */
  const plocha = p => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(s) / 2; };
  const obvod = p => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]); return s; };
  function vzdBodUsecka(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  function vzdUsecek(a, b, c, d) {   // nejmenší vzdálenost dvou úseček (bez průsečíku = minimum koncových bodů)
    const x = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    if (x(a, b, c) * x(a, b, d) < 0 && x(c, d, a) * x(c, d, b) < 0) return 0;
    return Math.min(vzdBodUsecka(a[0], a[1], c[0], c[1], d[0], d[1]), vzdBodUsecka(b[0], b[1], c[0], c[1], d[0], d[1]),
      vzdBodUsecka(c[0], c[1], a[0], a[1], b[0], b[1]), vzdBodUsecka(d[0], d[1], a[0], a[1], b[0], b[1]));
  }
  K.plocha = plocha;
  function zhusti(p, krok) {   // rovné úseky se v kruhovém pásu ohýbají – přidat mezilehlé body
    const o = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], c = p[(i + 1) % p.length], n = Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / krok);
      for (let k = 0; k < n; k++) o.push([a[0] + (c[0] - a[0]) * k / n, a[1] + (c[1] - a[1]) * k / n]);
    }
    return o;
  }
  const cele = x => Math.max(1, Math.round(+x || 1));

  /* ---------- dečka a lemovka ---------- */
  K.sestav = function (p) {
    const b = Math.max(0.3, +p.mustek), S = cele(p.symetrie), varovani = [], diry = [];
    const decka = p.druh !== 'pas';
    let geo, sirka, vyska, s0, R, e;
    if (decka) {
      const Rmax = p.prumer / 2, C = Rmax;
      e = Math.max(0, Math.min(p.okraj.vyska, Rmax * 0.3));
      R = Rmax - e;
      sirka = vyska = p.prumer;
      geo = {
        perioda: TAU, start: 0, c0: 0, kruh: true,
        metr: s => s,
        bod: (t, s) => [C + s * Math.sin(t), C - s * Math.cos(t)],
        lokal: (t, s, x, y) => [C + s * Math.sin(t) + x * Math.cos(t) + y * Math.sin(t), C - s * Math.cos(t) + x * Math.sin(t) - y * Math.cos(t)],
      };
      s0 = p.stred.typ === 'plny' ? Math.max(b, p.stred.polomer) : Math.max(2 * b, p.stred.polomer);
      if (s0 > R * 0.8) { s0 = R * 0.8; varovani.push('Střed je skoro stejně velký jako celá dečka – zmenšen.'); }
    } else {
      const L = p.pas.delka, H = p.pas.vyska;
      e = Math.max(0, Math.min(p.okraj.vyska, H * 0.45));
      R = H - e;
      sirka = L; vyska = H;
      geo = {
        perioda: L - b, start: b / 2, c0: 0.5, kruh: false,
        metr: () => 1,
        bod: (t, s) => [t, H - s],
        lokal: (t, s, x, y) => [t + x, H - s - y],
      };
      s0 = b / 2;
    }

    /* střed dečky */
    if (decka && p.stred.typ !== 'plny') {
      const ri = s0 - b / 2, pp = S * cele(p.stred.nasobek), o = [];
      if (p.stred.typ === 'kruh') for (let i = 0; i < 96; i++) o.push(geo.bod(TAU * i / 96, ri));
      else if (p.stred.typ === 'kvet') {
        const n = Math.min(1440, pp * 40);
        for (let i = 0; i < n; i++) { const f = TAU * i / n; o.push(geo.bod(f, ri * (0.42 + 0.58 * Math.pow(Math.abs(Math.cos(pp * f / 2)), 0.8)))); }
      } else for (let i = 0; i < 2 * pp; i++) o.push(geo.bod(Math.PI * i / pp, i % 2 ? ri * 0.45 : ri));
      diry.push(o);
    }

    /* pásy motivů mezi středem a okrajem */
    const kruhy = p.kruhy || [], konec = R - b / 2, celkem = konec - s0;
    const vahy = kruhy.map(k => Math.max(0.05, +k.vaha || 1)), sv = vahy.reduce((a, c) => a + c, 0);
    const pasma = [];
    if (kruhy.length && celkem <= b) varovani.push('Na pásy motivů nezbylo místo – zmenšete střed nebo okraj.');
    else {
      let a0 = s0;
      kruhy.forEach((k, ki) => {
        const a1 = a0 + celkem * vahy[ki] / sv, motiv = K.MOTIVY[k.motiv] || K.MOTIVY.kapka;
        const n = S * cele(k.nasobek), D = geo.perioda / n, rady = Math.max(1, Math.min(6, cele(k.rady)));
        const f = Math.max(0.2, Math.min(1, +k.vypln || 0.85));
        const pasmo = { od: a0, do: a1, pocet: 0, nazev: motiv.nazev };
        pasma.push(pasmo);
        for (let r = 0; r < rady; r++) {
          const r0 = a0 + (a1 - a0) * r / rady, r1 = a0 + (a1 - a0) * (r + 1) / rady;
          const rin = r0 + b / 2, rout = r1 - b / 2, h = rout - rin;
          let off = (k.posun ? 0.5 : 0) + (k.strida && r % 2 ? 0.5 : 0);
          off -= Math.floor(off);
          const pul = (rr) => (f * D / 2 * geo.metr(rr) - b / 2) / geo.metr(rr);   // polovina šířky otvoru v jednotkách t
          if (h < 0.6 || pul(rin) * geo.metr(rin) < 0.3) { varovani.push(`Pás ${ki + 1} (${motiv.nazev}) je moc úzký – snižte počet nebo můstek.`); continue; }
          const tvar = zhusti(motiv.body(48), 0.06);
          const ks = (!geo.kruh && off) ? n - 1 : n;
          for (let c = 0; c < ks; c++) {
            const tc = geo.start + (c + geo.c0 + off) * D;
            let o;
            if (motiv.ctverec) {
              const vel = Math.min(2 * pul(rin) * geo.metr(rin), h), sm = (rin + rout) / 2;
              o = tvar.map(([u, v]) => geo.lokal(tc, sm, u * vel / 2, ((k.otoc ? 1 - v : v) - 0.5) * vel));
            } else {
              o = tvar.map(([u, v]) => { const s = rin + (k.otoc ? 1 - v : v) * h; return geo.bod(tc + u * pul(s), s); });
            }
            diry.push(o); pasmo.pocet++;
          }
        }
        a0 = a1;
      });
    }

    /* okraj */
    const prof = (K.OKRAJE[p.okraj.typ] || K.OKRAJE.rovny).h, E = S * cele(p.okraj.nasobek);
    const De = geo.perioda / E, obrys = [];
    if (decka) {
      const M = Math.min(4000, E * 48);
      for (let i = 0; i < M; i++) {
        const t = TAU * i / M, f = t / De + 0.5;
        obrys.push(geo.bod(t, R + e * prof(f - Math.floor(f))));
      }
    } else {
      const L = sirka, M = Math.min(4000, E * 48);
      obrys.push([0, vyska], [L, vyska], geo.bod(L, R));
      for (let i = M; i >= 0; i--) { const x = b / 2 + (L - b) * i / M, f = (x - b / 2) / De; obrys.push(geo.bod(x, R + e * prof(f - Math.floor(f)))); }
      obrys.push(geo.bod(0, R));
    }

    /* otvory v obloučcích okraje – velikost se zmenšuje, dokud nemá můstek k okraji */
    if (p.okraj.diry && p.okraj.typ !== 'rovny' && e > 2 * b) {
      let rho = Math.min((e - b) / 2, De * geo.metr(R) / 2 - b);
      const stredDiry = (k, rr) => geo.bod(geo.start + (k + geo.c0) * De, R + rr);
      const vzd = (s) => { let m = Infinity; for (let i = 0, j = obrys.length - 1; i < obrys.length; j = i++) m = Math.min(m, vzdBodUsecka(s[0], s[1], obrys[j][0], obrys[j][1], obrys[i][0], obrys[i][1])); return m; };
      for (let z = 0; z < 30 && rho > 0.4 && vzd(stredDiry(0, rho)) - rho < b; z++) rho *= 0.92;
      if (rho >= 0.5 && vzd(stredDiry(0, rho)) - rho >= b * 0.999) {
        for (let k = 0; k < E; k++) {
          const s = stredDiry(k, rho), o = [];
          for (let i = 0; i < 40; i++) { const a = TAU * i / 40; o.push([s[0] + rho * Math.cos(a), s[1] + rho * Math.sin(a)]); }
          diry.push(o);
        }
      } else varovani.push('Do obloučků okraje se otvor s dostatečným můstkem nevejde.');
    }

    const plochaObrys = plocha(obrys), plochaDer = diry.reduce((a, d) => a + plocha(d), 0);
    const mensi = diry.filter(d => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of d) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return Math.min(x1 - x0, y1 - y0) < 1.5; }).length;
    if (mensi) varovani.push(`${mensi} otvorů je menších než 1,5 mm – nůžkami ani plotrem se špatně řežou.`);
    return {
      druh: decka ? 'decka' : 'pas', sirka, vyska, obrys, diry, varovani, pasma,
      info: {
        otvoru: diry.length,
        rez: (obvod(obrys) + diry.reduce((a, d) => a + obvod(d), 0)) / 1000,   // m
        plocha: (plochaObrys - plochaDer) / 100,                                // cm²
        prolomeni: plochaObrys ? plochaDer / plochaObrys : 0,
        mustek: b,
      },
    };
  };

  /* Nejužší místo materiálu: nejmenší vzdálenost mezi dvěma různými křivkami
     (otvor–otvor, otvor–obrys). Úsečky se třídí do mřížky, porovnávají se jen sousedé. */
  K.mustky = function (m, mez) {
    mez = mez || Math.max(4, m.info.mustek * 3);
    const krivky = [m.obrys].concat(m.diry), mriz = new Map(), bunka = mez;
    const klic = (i, j) => i * 100003 + j;
    krivky.forEach((c, ci) => {
      for (let i = 0; i < c.length; i++) {
        const a = c[i], d = c[(i + 1) % c.length];
        const i0 = Math.floor(Math.min(a[0], d[0]) / bunka), i1 = Math.floor(Math.max(a[0], d[0]) / bunka);
        const j0 = Math.floor(Math.min(a[1], d[1]) / bunka), j1 = Math.floor(Math.max(a[1], d[1]) / bunka);
        for (let x = i0; x <= i1; x++) for (let y = j0; y <= j1; y++) {
          const k = klic(x, y);
          if (!mriz.has(k)) mriz.set(k, []);
          mriz.get(k).push([ci, a, d]);
        }
      }
    });
    let min = Infinity, kde = null;
    for (const [k, seznam] of mriz) {
      const x = Math.floor(k / 100003), y = k - x * 100003;
      const okoli = [];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const s = mriz.get(klic(x + dx, y + dy)); if (s) okoli.push(s); }
      for (const [ci, a, d] of seznam) for (const s of okoli) for (const [cj, c, e] of s) {
        if (cj <= ci) continue;
        const v = vzdUsecek(a, d, c, e);
        if (v < min) { min = v; kde = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]; }
      }
    }
    return { min, x: kde ? kde[0] : 0, y: kde ? kde[1] : 0 };
  };

  /* Výseč pro vystřihování ze složeného papíru: papír složený do F vrstev dá
     výseč 360°/F, která se přes ohyby zrcadlí. Jde to jen tehdy, když každý
     počet opakování (pásy, střed, okraj) je násobkem F/2. */
  K.klin = function (p, m, F) {
    if (m.druh !== 'decka') return { ok: false, duvod: 'Vystřihovánka jde jen u dečky.' };
    const S = cele(p.symetrie), pocty = [['okraj', S * cele(p.okraj.nasobek)]];
    if (p.stred.typ !== 'plny') pocty.push(['střed', S * cele(p.stred.nasobek)]);
    (p.kruhy || []).forEach((k, i) => pocty.push([`pás ${i + 1}`, S * cele(k.nasobek)]));
    const spatne = pocty.filter(([, n]) => n % (F / 2));
    if (spatne.length) return { ok: false, duvod: `Pro ${F} vrstev musí být každý počet opakování dělitelný ${F / 2}: ${spatne.map(([j, n]) => `${j} = ${n}`).join(', ')}.` };
    const C = m.sirka / 2, Rv = C + 3, a = TAU / F, cesta = [[C, C]], n = 48;
    for (let i = 0; i <= n; i++) { const t = a * i / n; cesta.push([C + Rv * Math.sin(t), C - Rv * Math.cos(t)]); }
    return { ok: true, cesta, ohyby: [[[C, C], [C, C - Rv]], [[C, C], [C + Rv * Math.sin(a), C - Rv * Math.cos(a)]]], uhel: 360 / F };
  };

  /* ---------- podvinek (torchon) ----------
     Mřížka špendlíků: body (i, j) se sudým i + j, krok po úhlopříčce = rozteč,
     úhel úhlopříčky od podélného okraje = uhel. Sloupec i = 0 je rovný kraj
     (footside), vpravo vějíře. Motiv = kosočtverec o straně `velikost` kroků;
     uvnitř plátna/půlhodu špendlíky nejsou, pavouk má jen středový. */
  K.PODVINEK_MOTIVY = {
    platno: { nazev: 'plátno', barva: '#7b3fa0' },
    pulhod: { nazev: 'půlhod', barva: '#2e8b3a' },
    pavouk: { nazev: 'pavouk', barva: '#c0392b' },
    pudice: { nazev: 'jen půdice', barva: '#000000' },
  };
  K.podvinek = function (q) {
    const s = Math.max(1, +q.roztec), al = Math.max(25, Math.min(65, +q.uhel)) * Math.PI / 180;
    const dx = s * Math.sin(al), dy = s * Math.cos(al);
    const g = Math.max(1, Math.min(4, cele(q.pudice))), N = Math.max(1, Math.min(60, cele(q.opakovani)));
    const motivy = (q.motivy && q.motivy.length ? q.motivy : ['platno']).filter(m => K.PODVINEK_MOTIVY[m]);
    let k = Math.max(2, Math.min(10, cele(q.velikost)));
    if (motivy.includes('pavouk') && k % 2) k++;   // pavouk potřebuje středový špendlík
    const ic = k + g, W = ic + k + g, Rj = 2 * (k + g);
    let jc0 = k + g;
    if ((ic + jc0 - k) % 2) jc0++;
    const J = jc0 + (N - 1) * Rj + k + g;
    const okraj = 6, x0 = okraj, y0 = okraj;
    const P = (i, j) => [x0 + i * dx, y0 + j * dy];
    const kosy = [];
    for (let r = 0; r < N; r++) kosy.push({ i: ic, j: jc0 + r * Rj, druh: motivy[r % motivy.length] });
    const vMotivu = (i, j, jen) => {   // 'uvnitr' (< k), 'na' (= k), nebo null
      for (const c of kosy) {
        if (c.druh === 'pudice') continue;
        const d = Math.abs(i - c.i) + Math.abs(j - c.j);
        if (d < k) return { c, kde: 'uvnitr', d };
        if (d === k && !jen) return { c, kde: 'na', d };
      }
      return null;
    };
    const spendliky = [], je = new Set(), cary = [];
    for (let j = 0; j <= J; j++) for (let i = 0; i <= W; i++) {
      if ((i + j) % 2) continue;
      const v = vMotivu(i, j, true);
      if (v && !(v.c.druh === 'pavouk' && v.d === 0)) continue;
      je.add(i + ',' + j);
      const [x, y] = P(i, j);
      spendliky.push({ x, y, druh: i === 0 ? 'kraj' : i === W ? 'vejir' : v ? 'pavouk' : 'pudice' });
    }
    const cara = (body, druh) => cary.push({ body, druh });
    // půdice: spojnice sousedních špendlíků po úhlopříčkách mimo motivy
    for (let j = 0; j < J; j++) for (let i = 0; i <= W; i++) {
      if (!je.has(i + ',' + j)) continue;
      for (const di of [-1, 1]) {
        const i2 = i + di, j2 = j + 1;
        if (!je.has(i2 + ',' + j2)) continue;
        const mi = (i + i2) / 2, mj = (j + j2) / 2;
        if (kosy.some(c => c.druh !== 'pudice' && Math.abs(mi - c.i) + Math.abs(mj - c.j) <= k)) continue;
        cara([P(i, j), P(i2, j2)], 'pudice');
      }
    }
    // rovný kraj
    const kraj = [];
    for (let j = 0; j <= J; j += 2) kraj.push(P(0, j));
    cara(kraj, 'kraj');
    // motivy
    for (const c of kosy) {
      if (c.druh === 'pudice') continue;
      const T = (a, b) => P(c.i + a, c.j + b);
      if (c.druh === 'pavouk') {
        const st = T(0, 0);
        for (let a = 1; a < k; a++) {
          cara([T(-a, -(k - a)), st, T(k - a, a)], 'pavouk');      // noha zleva shora → doprava dolů
          cara([T(a, -(k - a)), st, T(a - k, a)], 'pavouk');
        }
        cary.push({ druh: 'pavouk', kruh: { x: st[0], y: st[1], r: s * 0.45 } });
      } else {
        for (let a = 0; a <= k; a++) {
          cara([T(-a, -(k - a)), T(k - a, a)], c.druh);
          cara([T(a, -(k - a)), T(a - k, a)], c.druh);
        }
      }
    }
    // vějíře na pravé straně, jeden na opakování
    let vpravo = W * dx;
    if (q.vejir) {
      for (let r = 0; r < N; r++) {
        const jc = jc0 + r * Rj, vnitrni = [];
        for (let j = jc - k - g; j <= jc + k + g; j++) if ((W + j) % 2 === 0 && j >= 0 && j <= J) vnitrni.push(j);
        const m = vnitrni.length; if (m < 3) continue;
        const ry = (vnitrni[m - 1] - vnitrni[0]) * dy / 2, rx = ry * 0.85, [cx, cy] = P(W, (vnitrni[0] + vnitrni[m - 1]) / 2);
        vpravo = Math.max(vpravo, W * dx + rx);
        const vnejsi = [];
        for (let a = 0; a < m; a++) {
          const f = -Math.PI / 2 + Math.PI * a / (m - 1);
          vnejsi.push([cx + rx * Math.cos(f), cy + ry * Math.sin(f)]);
        }
        for (let a = 1; a < m - 1; a++) {
          spendliky.push({ x: vnejsi[a][0], y: vnejsi[a][1], druh: 'vejir' });
          cara([P(W, vnitrni[a]), vnejsi[a]], 'platno');
        }
        const obl = [];
        for (let a = 0; a <= 24; a++) { const f = -Math.PI / 2 + Math.PI * a / 24; obl.push([cx + rx * Math.cos(f), cy + ry * Math.sin(f)]); }
        cara(obl, 'vejirKraj');
      }
    }
    return {
      druh: 'podvinek', sirka: x0 + vpravo + okraj, vyska: y0 + J * dy + okraj, spendliky, cary,
      varovani: [],
      info: { spendliku: spendliky.length, sloupcu: W + 1, velikost: k, opakovani: N, delkaRapportu: Rj * dy, dx, dy },
    };
  };

  /* ---------- náhodný vzor ---------- */
  K.nahodny = function (seed, p) {
    const rnd = K.nahoda(seed), vyber = a => a[Math.floor(rnd() * a.length)], mezi = (a, b) => a + (b - a) * rnd();
    const n = JSON.parse(JSON.stringify(p));
    if (p.druh === 'podvinek') {
      n.podvinek.velikost = vyber([2, 3, 4, 4, 5, 6]);
      n.podvinek.pudice = vyber([1, 1, 2]);
      n.podvinek.motivy = vyber([['platno'], ['pulhod'], ['pavouk'], ['platno', 'pavouk'], ['platno', 'pulhod'], ['pavouk', 'pulhod', 'platno']]);
      n.podvinek.vejir = rnd() < 0.8;
      return n;
    }
    const decka = p.druh !== 'pas';
    const motivy = Object.keys(K.MOTIVY);
    n.symetrie = decka ? vyber([6, 8, 8, 10, 12, 16]) : vyber([4, 5, 6, 8, 10]);
    const S = n.symetrie, b = p.mustek;
    n.stred = { typ: vyber(['kvet', 'kvet', 'hvezda', 'plny', 'kruh']), polomer: Math.round(p.prumer * mezi(0.06, 0.12)), nasobek: 1 };
    const velikost = decka ? p.prumer / 2 : p.pas.vyska;
    n.okraj = { typ: vyber(['oblouky', 'oblouky', 'pikoty', 'spicky', 'vlnky']), vyska: Math.round(velikost * mezi(0.08, 0.14) * 10) / 10, nasobek: 1, diry: rnd() < 0.6 };
    const pocet = decka ? 3 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 3);
    n.kruhy = [];
    for (let i = 0; i < pocet; i++) n.kruhy.push({ motiv: vyber(motivy), vaha: Math.round(mezi(0.6, 1.6) * 10) / 10, nasobek: 1,
      rady: rnd() < 0.2 ? 2 + Math.floor(rnd() * 2) : 1, strida: rnd() < 0.7, posun: rnd() < 0.35, otoc: rnd() < 0.2, vypln: Math.round(mezi(0.65, 0.95) * 100) / 100 });
    // počty opakování podle obvodu, aby buňky vyšly zhruba čtvercové
    const s0 = decka ? n.stred.polomer : b, konec = (decka ? velikost - n.okraj.vyska : velikost - n.okraj.vyska) - b / 2;
    const sv = n.kruhy.reduce((a, k) => a + k.vaha, 0);
    let a0 = s0;
    for (const k of n.kruhy) {
      const sirkaP = (konec - s0) * k.vaha / sv, rs = a0 + sirkaP / 2, delka = decka ? TAU * rs : p.pas.delka;
      k.nasobek = Math.max(1, Math.round(delka / (S * sirkaP / k.rady * mezi(0.8, 1.5))));
      a0 += sirkaP;
    }
    const delkaOkr = decka ? TAU * (velikost - n.okraj.vyska) : p.pas.delka;
    n.okraj.nasobek = Math.max(1, Math.round(delkaOkr / (S * n.okraj.vyska * mezi(1.6, 2.6))));
    return n;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = K;
  else koren.KRAJKY = K;
})(typeof window !== 'undefined' ? window : globalThis);
