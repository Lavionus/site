/* ============================================================
   Barefoot vložky – jádro: tvar chodidla a vložky z rozměrů, rezervy,
   ořezové čáry, perforace, kontrolní šablona s jazýčkem, velikosti bot.
   Souřadnice v mm: pravá noha shora, x → do strany (malíková strana vpravo),
   y → od paty (0) ke špičce. Levá noha je zrcadlo. Polygony jsou proti směru hodin.
   ============================================================ */
(function (koren) {
  'use strict';

  const fmt = (x, d) => { d = d || 0; const v = Math.round(x * Math.pow(10, d)) / Math.pow(10, d); return (Object.is(v, -0) ? 0 : v).toFixed(d).replace('.', ','); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const CL = koren.ClipperLib || (typeof require !== 'undefined' ? require('../lib/clipper.min.js') : null);
  /* odsazení dovnitř/ven přes Clipper (zaoblené rohy, bez smyček); bez Clipperu normálový posun */
  function odsadClip(P, d) {
    if (!CL) return posun(P, d);
    const SC = 1000, o = new CL.ClipperOffset(2, 0.01 * SC), r = new CL.Paths();
    o.AddPath(P.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) })), CL.JoinType.jtRound, CL.EndType.etClosedPolygon);
    o.Execute(r, d * SC);
    if (!r.length) return [];
    const Q = r.reduce((m, q) => (Math.abs(CL.Clipper.Area(q)) > Math.abs(CL.Clipper.Area(m)) ? q : m)).map((q) => [q.X / SC, q.Y / SC]);
    return plocha(Q) * plocha(P) < 0 ? Q.reverse() : Q;
  }

  /* Špičky prstů od palce k malíčku: [podíl šířky přes klouby od vnitřní hrany, podíl délky chodidla] */
  const TVARY = {
    egyptsky: { nazev: 'Egyptský', popis: 'palec je nejdelší, ostatní prsty šikmo ubývají (nejčastější)', body: [[0.16, 1.0], [0.40, 0.968], [0.58, 0.93], [0.74, 0.885], [0.88, 0.83]] },
    recky: { nazev: 'Řecký', popis: 'druhý prst přesahuje palec (Mortonův prst)', body: [[0.16, 0.985], [0.40, 1.0], [0.58, 0.955], [0.74, 0.90], [0.88, 0.84]] },
    rimsky: { nazev: 'Římský (čtvercový)', popis: 'první dva až tři prsty jsou skoro stejně dlouhé', body: [[0.16, 1.0], [0.40, 0.995], [0.58, 0.975], [0.74, 0.915], [0.88, 0.85]] },
  };

  const MATERIALY = {
    plst: { nazev: 'Vlněná plsť', tl: [3, 5], barva: '#8b8f96', pozn: 'hřeje i vlhká, saje pot, časem se slehne asi o čtvrtinu' },
    korek: { nazev: 'Korek (deska)', tl: [2, 3], barva: '#b8875a', pozn: 'lehký, neplesniví, tvaruje se teplem chodidla; na hranách se drolí' },
    kuze: { nazev: 'Kůže (vyčiněná rostlinně)', tl: [1.5, 2.5], barva: '#93623a', pozn: 'tenká a odolná, dobře saje pot; střihat ostrým nožem po šabloně' },
    eva: { nazev: 'EVA pěna', tl: [2, 4], barva: '#3d6fa3', pozn: 'levná a lehká, nesaje pot, zahřívá; vhodná na zkoušku tvaru' },
    kozesina: { nazev: 'Ovčí kožešina', tl: [6, 10], barva: '#e4d6bb', pozn: 'zimní vložka – sebere hodně objemu, počítejte s větší botou' },
    textil: { nazev: 'Lněná / konopná tkanina', tl: [1, 2], barva: '#c7b98f', pozn: 'na letní boty, prát; dvě vrstvy prošít po obvodu' },
  };

  const VYCHOZI = {
    rezim: 'vlozka',        // vlozka | kontrolni
    nohy: 'stejne',         // stejne | zvlast
    strany: 'obe',          // obe | prava | leva
    pDelka: 255, pSirka: 98, pPata: 64,
    lDelka: 255, lSirka: 98, lPata: 64,
    tvar: 'egyptsky',
    rezPrsty: 12, rezBok: 2, rezPata: 0,
    klenba: 3, pas: 2,
    material: 'plst', tloustka: 4,
    orez: true, orezKrok: 5, orezPocet: 3,
    perforace: false, perfRozt: 12, perfPrumer: 3, perfOkraj: 10,
    popisky: true, jmeno: '',
    noha: true,             // kreslit obrys chodidla do šablony
    jazyk: 50, znacky: true,
    delkaBoty: 0,           // vnitřní délka konkrétní boty → ořezová čára přesně na ni (0 = vypnuto)
    vrstvy: false, material2: 'korek', tloustka2: 2, vrstvaOds: 3,   // spodní vrstva menší o vrstvaOds mm
    pelota: false, pelotaDelka: 45, pelotaSirka: 32, pelotaPoz: 60,   // poz = střed v % délky vložky od paty
    podpatenka: false, podpatenkaPrumer: 45,
  };
  const MEZE = {
    pDelka: [90, 340], pSirka: [35, 140], pPata: [25, 100], lDelka: [90, 340], lSirka: [35, 140], lPata: [25, 100],
    rezPrsty: [0, 30], rezBok: [0, 8], rezPata: [0, 6], klenba: [0, 12], pas: [0, 8], tloustka: [0.5, 15],
    orezKrok: [2, 10], orezPocet: [0, 6], perfRozt: [6, 30], perfPrumer: [1, 8], perfOkraj: [4, 25], jazyk: [20, 100],
    delkaBoty: [0, 400], tloustka2: [0.5, 15], vrstvaOds: [0, 10], pelotaDelka: [20, 80], pelotaSirka: [15, 60], pelotaPoz: [45, 75], podpatenkaPrumer: [25, 70],
  };
  const VYCTY = { rezim: ['vlozka', 'kontrolni'], nohy: ['stejne', 'zvlast'], strany: ['obe', 'prava', 'leva'], tvar: Object.keys(TVARY), material: Object.keys(MATERIALY), material2: Object.keys(MATERIALY) };

  function normalizuj(q) {
    const p = Object.assign({}, VYCHOZI);
    for (const k of Object.keys(VYCHOZI)) {
      if (!q || q[k] === undefined || q[k] === null) continue;
      const vz = VYCHOZI[k];
      if (typeof vz === 'number') { const x = Number(q[k]); if (Number.isFinite(x)) p[k] = x; }
      else if (typeof vz === 'boolean') p[k] = !!q[k];
      else p[k] = String(q[k]);
    }
    for (const [k, [a, b]] of Object.entries(MEZE)) p[k] = Math.min(b, Math.max(a, p[k]));
    p.orezPocet = Math.round(p.orezPocet);
    for (const [k, L] of Object.entries(VYCTY)) if (!L.includes(p[k])) p[k] = VYCHOZI[k];
    p.jmeno = p.jmeno.slice(0, 40);
    if (p.nohy === 'stejne') { p.lDelka = p.pDelka; p.lSirka = p.pSirka; p.lPata = p.pPata; }
    return p;
  }

  /* ---------- geometrie ---------- */
  /* uzavřený centripetální Catmull-Rom spline (prochází všemi body, bez smyček) */
  function spline(B, n) {
    n = n || 24;
    const out = [], N = B.length, al = 0.5;
    const tj = (t, a, b) => t + Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6, al);
    for (let i = 0; i < N; i++) {
      const P0 = B[(i - 1 + N) % N], P1 = B[i], P2 = B[(i + 1) % N], P3 = B[(i + 2) % N];
      const t0 = 0, t1 = tj(t0, P0, P1), t2 = tj(t1, P1, P2), t3 = tj(t2, P2, P3);
      for (let k = 0; k < n; k++) {
        const t = t1 + (t2 - t1) * k / n, q = [0, 0];
        for (let d = 0; d < 2; d++) {
          const A1 = (t1 - t) / (t1 - t0) * P0[d] + (t - t0) / (t1 - t0) * P1[d];
          const A2 = (t2 - t) / (t2 - t1) * P1[d] + (t - t1) / (t2 - t1) * P2[d];
          const A3 = (t3 - t) / (t3 - t2) * P2[d] + (t - t2) / (t3 - t2) * P3[d];
          const B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2;
          const B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
          q[d] = (t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2;
        }
        out.push(q);
      }
    }
    return out;
  }

  function obalka(P) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of P) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  function plocha(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function obvod(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; }
  function bodVPolygonu(P, x, y) {
    let v = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) v = !v;
    }
    return v;
  }
  function vzdalenostKObrysu(P, x, y) {
    let m = Infinity;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
      m = Math.min(m, Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y));
    }
    return m;
  }
  /* průsečíky vodorovné přímky y s polygonem → [xmin, xmax] nebo null */
  function rezNaY(P, y) {
    const xs = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : null;
  }
  function nejsirsi(P, ya, yb) {
    let m = { w: 0, y: ya, x0: 0, x1: 0 };
    for (let k = 0; k <= 120; k++) { const y = lerp(ya, yb, k / 120), r = rezNaY(P, y); if (r && r[1] - r[0] > m.w) m = { w: r[1] - r[0], y, x0: r[0], x1: r[1] }; }
    return m;
  }
  /* posun hladkého obrysu po normále (d > 0 ven, d < 0 dovnitř); obrys proti směru hodin */
  function posun(P, d) {
    const N = P.length, out = [];
    for (let i = 0; i < N; i++) {
      const a = P[(i - 1 + N) % N], b = P[i], c = P[(i + 1) % N];
      let n1 = [b[1] - a[1], -(b[0] - a[0])], n2 = [c[1] - b[1], -(c[0] - b[0])];
      const l1 = Math.hypot(...n1) || 1, l2 = Math.hypot(...n2) || 1;
      n1 = [n1[0] / l1, n1[1] / l1]; n2 = [n2[0] / l2, n2[1] / l2];
      let n = [n1[0] + n2[0], n1[1] + n2[1]]; const ln = Math.hypot(...n) || 1; n = [n[0] / ln, n[1] / ln];
      const cos = Math.max(0.5, n[0] * n1[0] + n[1] * n1[1]);
      out.push([b[0] + n[0] * d / cos, b[1] + n[1] * d / cos]);
    }
    return out;
  }
  const zrcadli = (P, W) => P.map(([x, y]) => [W - x, y]).reverse();

  /* ---------- tvar ---------- */
  /* kontrolní body obrysu; m = {delka, sirka, pata}, r = rezervy {f: prsty, s: bok, h: pata} */
  function kontrolniBody(m, tvar, klenba, pas, r) {
    const L = m.delka, W = m.sirka, H = m.pata, T = (TVARY[tvar] || TVARY.egyptsky).body;
    const mi = 0.22 * Math.max(0, W - H), xc = mi + H / 2, s = r.s, f = r.f, h = r.h;
    const B = [
      [xc, -h],
      [xc + 0.42 * H + 0.9 * s, 0.045 * L - 0.6 * h],
      [mi + H + s, 0.15 * L],
      [lerp(mi + H, W, 0.42) - pas + s, 0.40 * L],
      [W + s, 0.635 * L],
      [0.975 * W + s, 0.745 * L + 0.35 * f],
    ];
    for (let k = 4; k >= 1; k--) B.push([T[k][0] * W + (T[k][0] - 0.5) * s, T[k][1] * L + f]);
    /* palec je široký asi čtvrtinu chodidla – špička zaoblená, ne do hrotu */
    B.push([0.25 * W - 0.25 * s, lerp(T[0][1], T[1][1], 0.35) * L + f]);
    B.push([T[0][0] * W - 0.34 * s, T[0][1] * L + f]);
    B.push([0.035 * W - 0.75 * s, (T[0][1] - 0.045) * L + 0.85 * f]);
    B.push([-s, 0.84 * L + 0.3 * f]);
    B.push([-s, 0.72 * L]);
    B.push([0.47 * mi + klenba - s, 0.45 * L]);
    B.push([mi - s, 0.15 * L]);
    B.push([xc - 0.42 * H - 0.9 * s, 0.045 * L - 0.6 * h]);
    return B;
  }
  /* obrys přesně na cílové rozměry: délka Lt, největší šířka Wt, šířka paty Ht (iterační dorovnání paty) */
  function obrys(m, tvar, klenba, pas, r) {
    const Lt = m.delka + r.f + r.h, Wt = m.sirka + 2 * r.s, Ht = m.pata + 2 * r.s;
    let pata = m.pata, P = null;
    for (let it = 0; it < 10; it++) {
      const S = spline(kontrolniBody({ delka: m.delka, sirka: m.sirka, pata }, tvar, klenba, pas, r), 26);
      const o = obalka(S);
      P = S.map(([x, y]) => [(x - o.x0) * Wt / o.w, (y - o.y0) * Lt / o.h]);
      const hp = nejsirsi(P, 0.05 * Lt, 0.3 * Lt).w;
      if (Math.abs(hp - Ht) < 0.05) break;
      pata = Math.max(15, Math.min(m.sirka - 1, pata * Ht / hp));
    }
    return P;
  }
  /* vložka a chodidlo jsou dva samostatné spliny – při malé rezervě může chodidlo místy (bok paty, palec) vyčnívat.
     Takové místo vložky se vytlačí po normále (plynule, Gaussovsky do okolí), indexy bodů zůstanou. */
  function nevycnivat(V, N) {
    const ven = N.map((q) => (bodVPolygonu(V, q[0], q[1]) ? 0 : vzdalenostKObrysu(V, q[0], q[1]))).map((d, i) => [N[i], d]).filter(([, d]) => d > 0.02);
    if (!ven.length) return V;
    const zn = plocha(V) > 0 ? 1 : -1, n = V.length;
    return V.map((q, i) => {
      let t = 0;
      for (const [b, d] of ven) t = Math.max(t, (d + 0.05) * Math.exp(-(((q[0] - b[0]) ** 2 + (q[1] - b[1]) ** 2) / 64)));
      if (t < 1e-3) return q;
      const a = V[(i - 1 + n) % n], c = V[(i + 1) % n], tx = c[0] - a[0], ty = c[1] - a[1], l = Math.hypot(tx, ty) || 1;
      return [q[0] + zn * ty / l * t, q[1] - zn * tx / l * t];
    });
  }
  function rozmery(P) {
    /* šířka jako posuvkou kolmo na délku (obálka), pata jako nejširší vodorovný řez v zadní části */
    const o = obalka(P), pt = nejsirsi(P, o.y0 + 0.05 * o.h, o.y0 + 0.3 * o.h);
    const ySirka = P.reduce((a, q) => (q[0] > a[0] ? q : a), P[0])[1];
    return { delka: o.h, sirka: o.w, pata: pt.w, ySirka, yPata: pt.y, plocha: Math.abs(plocha(P)), obvod: obvod(P) };
  }

  /* ---------- velikosti bot (orientační) ---------- */
  const NAVYSENI_KOPYTA = 8;  // délka kopyta ≈ vnitřní délka + 8 mm
  function velikosti(delkaNohy, vnitrni) {
    const kopyto = vnitrni + NAVYSENI_KOPYTA, palce = kopyto / 25.4;
    const eu = Math.round(kopyto / 6.667 * 2) / 2;
    let uk = 3 * palce - 25, detske = false;
    if (uk < 0.5) { uk = 3 * palce - 12; detske = true; }
    uk = Math.round(uk * 2) / 2;
    return { mondopoint: Math.round(delkaNohy), vnitrni: Math.round(vnitrni), kopyto: Math.round(kopyto), eu, uk, detske, usM: detske ? null : uk + 1, usW: detske ? null : uk + 2 };
  }
  function tridaSirky(delka, sirka) {
    const r = sirka / delka;
    if (r < 0.355) return { r, nazev: 'úzká', pozn: 'většina barefoot značek bude volná – hledejte „narrow“ modely nebo zúžit tkaničkami' };
    if (r < 0.385) return { r, nazev: 'střední', pozn: 'sedí na běžná barefoot kopyta' };
    if (r < 0.41) return { r, nazev: 'široká', pozn: 'hledejte modely „wide“ – běžná obuv bude tlačit v kloubech' };
    return { r, nazev: 'velmi široká', pozn: 'jen nejširší barefoot kopyta; vždy porovnejte šablonu s vnitřkem boty' };
  }

  /* ---------- prvky šablony ---------- */
  /* ořezové čáry ve špičce: vnitřní ekvidistanta obrysu; u ostré špičky (poloměr < d) by ležela níž, než říká popisek,
     proto se posun dohledá půlením tak, aby vrchol čáry ležel přesně na Lt − d. Čára, která by se rozpadla (bota je
     mnohem kratší než vložka), se vynechá – varování přidá doplnVyrobu. */
  function orezoveCary(P, p, Lt) {
    const L = [];
    if (p.rezim !== 'vlozka') return L;
    const cile = new Map();   // d → bota (stejná vzdálenost jen jednou)
    if (p.orez) for (let k = 1; k <= p.orezPocet; k++) cile.set(Math.round(k * p.orezKrok * 100) / 100, false);
    const dBota = p.delkaBoty > 0 ? Math.round((Lt - p.delkaBoty) * 100) / 100 : 0;
    if (dBota >= 0.5) cile.set(dBota, true);
    const ylim = 0.74 * Lt;
    let i0 = -1, i1 = -1;
    for (let i = 0; i < P.length; i++) if (P[i][1] > ylim) { if (i0 < 0) i0 = i; i1 = i; }
    if (i0 < 0) return L;
    /* kde je obrys zakřivenější než e (špička palce), vytvoří posun smyčku – takové body vyhodit.
       Vzdálenost stačí měřit k přední části obrysu (body čáry leží nad ylim − e), výsledky půlení se pamatují. */
    /* úseky přední části v mřížce po 4 mm: stačí zjistit, jestli je některý blíž než lim */
    const dMax = Math.max(0, ...cile.keys()), yPredni = ylim - 2 * dMax - 2, K = 4, mriz = new Map(), bunka = (cx, cy) => cx * 100003 + cy;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length]; if (a[1] <= yPredni && b[1] <= yPredni) continue;
      for (let cx = Math.floor(Math.min(a[0], b[0]) / K); cx <= Math.floor(Math.max(a[0], b[0]) / K); cx++)
        for (let cy = Math.floor(Math.min(a[1], b[1]) / K); cy <= Math.floor(Math.max(a[1], b[1]) / K); cy++) { const k = bunka(cx, cy); if (!mriz.has(k)) mriz.set(k, []); mriz.get(k).push(a, b); }
    }
    const dal = (x, y, lim) => {
      const r = Math.ceil(lim / K), x0 = Math.floor(x / K), y0 = Math.floor(y / K);
      for (let cx = x0 - r; cx <= x0 + r; cx++) for (let cy = y0 - r; cy <= y0 + r; cy++) {
        const U = mriz.get(bunka(cx, cy)); if (!U) continue;
        for (let i = 0; i < U.length; i += 2) { const a = U[i], b = U[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0; if (Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y) < lim) return false; }
      }
      return true;
    };
    const pamet = new Map();
    const cara = (e) => { if (!pamet.has(e)) pamet.set(e, posun(P, -e).slice(i0, i1 + 1).filter(([x, y]) => dal(x, y, e - 0.25))); return pamet.get(e); };
    const vrch = (B) => B.reduce((m, q) => Math.max(m, q[1]), -Infinity);
    L.vynechano = 0;   // čáry, které se na tuto vložku nevejdou (doplnVyrobu je ohlásí)
    for (const [d, bota] of [...cile].sort((a, b) => a[0] - b[0])) {
      if (Lt - d < 60) { if (!bota) L.vynechano++; continue; }
      let body = cara(d);
      if (body.length >= 2 && vrch(body) < Lt - d - 0.2) {
        let lo = 0, hi = d;
        for (let k = 0; k < 11; k++) { const e = (lo + hi) / 2, B = cara(e); if (B.length >= 2 && vrch(B) > Lt - d) lo = e; else hi = e; }
        body = cara(lo);
      }
      if (body.length < 2) { if (!bota) L.vynechano++; continue; }
      L.push({ d, body, vnitrni: Lt - d, bota });
    }
    return L;
  }

  function perforace(P, p) {
    const out = [];
    if (!p.perforace || p.rezim !== 'vlozka') return out;
    const o = obalka(P), a = p.perfRozt, r = p.perfPrumer / 2, hy = a * Math.sqrt(3) / 2, min = p.perfOkraj + r;
    /* střed otvoru musí ležet ve vnitřní ekvidistantě (vzdálenost od okraje ≥ min) – po řádcích přes průsečíky */
    const Q = CL ? odsadClip(P, -min) : null;
    let rad = 0;
    for (let y = o.y0 + min; y <= o.y1 - min; y += hy, rad++) {
      if (!Q) {
        for (let x = o.x0 + (rad % 2 ? a / 2 : 0); x <= o.x1; x += a) if (bodVPolygonu(P, x, y) && vzdalenostKObrysu(P, x, y) >= min) out.push({ x, y, r });
        continue;
      }
      const xs = [];
      for (let i = 0; i < Q.length; i++) { const u = Q[i], w = Q[(i + 1) % Q.length]; if ((u[1] > y) !== (w[1] > y)) xs.push(u[0] + (y - u[1]) / (w[1] - u[1]) * (w[0] - u[0])); }
      xs.sort((m, n) => m - n);
      for (let x = o.x0 + (rad % 2 ? a / 2 : 0); x <= o.x1; x += a) {
        let k = 0; while (k < xs.length && xs[k] < x) k++;
        if (k % 2) out.push({ x, y, r });
      }
    }
    return out;
  }
  /* kontrolní šablona: na patě jazýček na vytažení z boty, ve špičce značky délky nohy +0/+5/+10… */
  function jazycek(P, p, xc) {
    const tw = 18, J = p.jazyk, N = P.length;
    let a = 0; while (a < N / 2 && P[a][0] < xc + tw / 2) a++;
    let b = N - 1; while (b > N / 2 && P[b][0] > xc - tw / 2) b--;
    const ya = P[a][1], yb = P[b][1], Q = P.slice(a, b + 1);
    const R = 6, oblouk = [];
    for (let k = 0; k <= 8; k++) { const u = Math.PI + k / 8 * Math.PI / 2; oblouk.push([xc - tw / 2 + R + R * Math.cos(u), -J + R + R * Math.sin(u)]); }
    for (let k = 0; k <= 8; k++) { const u = 1.5 * Math.PI + k / 8 * Math.PI / 2; oblouk.push([xc + tw / 2 - R + R * Math.cos(u), -J + R + R * Math.sin(u)]); }
    Q.push([xc - tw / 2, yb], ...oblouk, [xc + tw / 2, ya]);
    return { obrys: Q, otvor: { x: xc, y: -J + 13, r: 4.5 } };
  }
  function znackyDelky(P, p, yNoha, Lt) {
    const out = [];
    if (p.rezim !== 'kontrolni' || !p.znacky) return out;
    for (let d = 0; d <= p.rezPrsty + 1e-9; d += 5) {
      const y = yNoha + d; if (y >= Lt - 0.5) break;
      const r = rezNaY(P, y); if (!r) continue;
      out.push({ d, y, x0: r[0], x1: r[1] });
    }
    return out;
  }

  /* ---------- výroba: spodní vrstva, podpory (pelota, podpatěnka) – pro oba režimy ---------- */
  function kapka(cx, cy, delka, sirka) {   // pelota: přední půlkruh, ocas k patě
    const a = sirka / 2, yc = cy + delka / 2 - a, y0 = cy - delka / 2, P = [];
    for (let k = 0; k <= 24; k++) { const u = Math.PI * k / 24; P.push([cx + a * Math.cos(u), yc + a * Math.sin(u)]); }
    for (let k = 1; k < 16; k++) { const t = k / 16, x = (1 - t) * (1 - t) * (cx - a) + 2 * (1 - t) * t * (cx - a * 0.75) + t * t * cx, y = (1 - t) * (1 - t) * yc + 2 * (1 - t) * t * (y0 + 0.25 * delka) + t * t * y0; P.push([x, y]); }
    for (let k = 1; k < 16; k++) { const t = k / 16, x = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * (cx + a * 0.75) + t * t * (cx + a), y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + 0.25 * delka) + t * t * yc; P.push([x, y]); }
    return P;
  }
  function doplnVyrobu(v) {
    const p = v.p, zmenseno = [];
    for (const n of v.nohy) {
      n.vrstva2 = null; n.podpory = [];
      if (p.rezim !== 'vlozka') continue;
      if (p.vrstvy && p.vrstvaOds > 0) { const V2 = odsadClip(n.vlozka, -p.vrstvaOds); n.vrstva2 = V2.length > 8 ? V2 : null; }
      else if (p.vrstvy) n.vrstva2 = n.vlozka.slice();
      const medVlevo = n.strana === 'P';   // pohled shora: u pravé nohy je palec vlevo
      if (p.pelota) {
        const cy = p.pelotaPoz / 100 * n.Lt, r = rezNaY(n.vlozka, cy);
        if (r) {
          const cx = medVlevo ? r[0] + 0.45 * (r[1] - r[0]) : r[1] - 0.45 * (r[1] - r[0]), sMax = 0.6 * (r[1] - r[0]), sir = Math.min(p.pelotaSirka, sMax);
          if (sir < p.pelotaSirka - 0.5) zmenseno.push(`${n.nazev}: pelota zúžena na ${fmt(sir)} mm (vložka je v tom místě široká ${fmt(r[1] - r[0])} mm)`);
          n.podpory.push({ nazev: 'pelota', body: kapka(cx, cy, p.pelotaDelka, sir) });
        }
      }
      if (p.podpatenka) {
        let rx = p.podpatenkaPrumer / 2, ry = rx * 1.15;
        const cy = Math.max(ry + 4, 0.13 * n.Lt), r = rezNaY(n.vlozka, cy), cx = r ? (r[0] + r[1]) / 2 : n.Wt / 2, P = [], rMax = 0.4 * (r ? r[1] - r[0] : n.Wt);
        if (rx > rMax) { zmenseno.push(`${n.nazev}: podpatěnka zmenšena na ${fmt(2 * rMax)} mm (pata je široká ${fmt(r ? r[1] - r[0] : n.Wt)} mm)`); rx = rMax; ry = rx * 1.15; }
        for (let k = 0; k < 48; k++) { const u = 2 * Math.PI * k / 48; P.push([cx + rx * Math.cos(u), cy + ry * Math.sin(u)]); }
        n.podpory.push({ nazev: 'podpatěnka', body: P });
      }
    }
    const vv = (uroven, text) => {   // varování ruší souhrnné „vypadá věrohodně“
      if (uroven !== 'info') v.varovani = v.varovani.filter((q) => q.uroven !== 'ok');
      v.varovani.push({ uroven, text });
    };
    if (p.rezim === 'vlozka' && p.delkaBoty > 0) for (const n of v.nohy) {
      const d = n.Lt - p.delkaBoty;
      if (d >= 0.5 && !n.orez.some((q) => q.bota)) vv('varovani', `${n.nazev}: bota (${fmt(p.delkaBoty)} mm) je o ${fmt(d)} mm kratší než vložka – tolik ve špičce oříznout nejde, zvolte menší rezervu nebo jinou botu.`);
      else if (d < -2) vv('info', `${n.nazev}: vložka je o ${fmt(-d)} mm kratší než bota (${fmt(p.delkaBoty)} mm) – v botě bude klouzat, zvětšete rezervu nebo offset.`);
      else if (d >= 0.5) vv('info', `${n.nazev}: na délku boty ${fmt(p.delkaBoty)} mm zkraťte vložku o ${fmt(d, 1)} mm po zvýrazněné červené čáře.`);
    }
    for (const t of zmenseno) vv('info', t + ' – jinak by přečnívala přes okraj vložky.');
    const vyn = Math.max(0, ...v.nohy.map((n) => (n.orez && n.orez.vynechano) || 0));
    if (p.rezim === 'vlozka' && p.orez && vyn) vv('info', `${vyn === 1 ? 'Jedna ořezová čára se' : vyn + ' ořezové čáry se'} na vložku nevejde (byla by blíž než 60 mm od paty nebo mimo špičku) – zmenšete krok nebo počet čar.`);
    if (p.rezim === 'vlozka' && p.vrstvy && p.tloustka + p.tloustka2 > 6) vv('varovani', `Dvě vrstvy mají dohromady ${fmt(p.tloustka + p.tloustka2, 1)} mm – v barefoot botě to ubere hodně místa nad prsty.`);
    if (p.rezim === 'vlozka' && (p.pelota || p.podpatenka)) vv('info', 'Pelota a podpatěnka jsou korekční prvky – patří k vložce doporučené odborníkem; u čistě barefoot vložky je obvykle nedáváme.');
    return v;
  }

  /* ---------- výpočet celé sady ---------- */
  function jednaNoha(p, strana) {
    const m = strana === 'P' ? { delka: p.pDelka, sirka: p.pSirka, pata: p.pPata } : { delka: p.lDelka, sirka: p.lSirka, pata: p.lPata };
    const r = { f: p.rezPrsty, s: p.rezBok, h: p.rezPata };
    let V = obrys(m, p.tvar, p.klenba, p.pas, r);
    let N = obrys(m, p.tvar, p.klenba, p.pas, { f: 0, s: 0, h: 0 }).map(([x, y]) => [x + r.s, y + r.h]);
    V = nevycnivat(V, N);
    const Lt = m.delka + r.f + r.h, Wt = m.sirka + 2 * r.s;
    const T = (TVARY[p.tvar] || TVARY.egyptsky).body;
    let prsty = T.map(([fx, fy], i) => ({ x: r.s + fx * m.sirka, y: r.h + fy * m.delka - [12, 8, 7, 6, 5.5][i] * m.delka / 255, r: [12, 8, 7, 6, 5.5][i] * m.delka / 255 }));
    let osa = [[r.s + 0.22 * Math.max(0, m.sirka - m.pata) + m.pata / 2, r.h + 0.03 * m.delka], [r.s + T[1][0] * m.sirka, r.h + T[1][1] * m.delka]];
    const xcPata = (() => { const q = rezNaY(V, 0.12 * Lt); return q ? (q[0] + q[1]) / 2 : Wt / 2; })();
    let tab = null;
    if (p.rezim === 'kontrolni') tab = jazycek(V, p, xcPata);
    const orez = orezoveCary(V, p, Lt), perf = perforace(V, p), znacky = znackyDelky(V, p, r.h + m.delka, Lt);
    const roz = rozmery(V), rozN = rozmery(N);
    if (strana === 'L') {
      const z = (P) => zrcadli(P, Wt);
      V = z(V); N = z(N);
      if (tab) tab = { obrys: z(tab.obrys), otvor: { x: Wt - tab.otvor.x, y: tab.otvor.y, r: tab.otvor.r } };
      for (const o of orez) o.body = o.body.map(([x, y]) => [Wt - x, y]).reverse();
      for (const q of perf) q.x = Wt - q.x;
      for (const q of znacky) { const a = Wt - q.x1, b = Wt - q.x0; q.x0 = a; q.x1 = b; }
      prsty = prsty.map((q) => Object.assign({}, q, { x: Wt - q.x }));
      osa = osa.map(([x, y]) => [Wt - x, y]);
    }
    for (const o of orez) o.velikost = velikosti(m.delka, o.vnitrni);
    const vel = velikosti(m.delka, Lt);
    return { strana, nazev: strana === 'P' ? 'pravá' : 'levá', m, r, vlozka: V, noha: N, tab, orez, perf, znacky, prsty, osa, Lt, Wt, roz, rozN, vel, sirka: tridaSirky(m.delka, m.sirka) };
  }

  function spocitej(q) {
    const p = normalizuj(q), nohy = [];
    if (p.strany !== 'prava') nohy.push(jednaNoha(p, 'L'));
    if (p.strany !== 'leva') nohy.push(jednaNoha(p, 'P'));
    const varovani = [], vv = (uroven, text) => varovani.push({ uroven, text });
    const mats = MATERIALY[p.material];
    for (const n of nohy) {
      const { m } = n, kdo = n.nazev + ' noha';
      if (m.pata >= m.sirka) vv('chyba', `${kdo}: pata (${fmt(m.pata)} mm) nemůže být širší než chodidlo přes klouby (${fmt(m.sirka)} mm) – zkontrolujte měření.`);
      else if (m.pata / m.sirka < 0.5) vv('varovani', `${kdo}: pata je proti šířce přes klouby nezvykle úzká (${fmt(m.pata / m.sirka * 100)} %); obvykle 60–72 %.`);
      else if (m.pata / m.sirka > 0.8) vv('varovani', `${kdo}: pata je proti šířce přes klouby nezvykle široká (${fmt(m.pata / m.sirka * 100)} %); obvykle 60–72 %.`);
      const r = m.sirka / m.delka;
      if (r < 0.31 || r > 0.47) vv('varovani', `${kdo}: poměr šířky k délce ${fmt(r * 100)} % je mimo běžný rozsah 33–44 % – neprohodili jste rozměry nebo jednotky?`);
    }
    if (nohy.length === 2) {
      const dl = Math.abs(p.pDelka - p.lDelka), ds = Math.abs(p.pSirka - p.lSirka);
      if (dl >= 4 || ds >= 3) vv('info', `Nohy se liší (délka o ${fmt(dl)} mm, šířka o ${fmt(ds)} mm). Botu vybírejte podle větší nohy; vložky můžete mít každou jinou.`);
    }
    if (p.rezim === 'vlozka') {
      if (p.rezPrsty < 8) vv('varovani', `Rezerva ve špičce ${fmt(p.rezPrsty)} mm je malá – chodidlo se při kroku prodlužuje a prsty potřebují místo (barefoot obvykle 10–15 mm).`);
      else if (p.rezPrsty > 20) vv('varovani', `Rezerva ve špičce ${fmt(p.rezPrsty)} mm je velká – bota bude „plavat“ a špička se bude ohýbat dřív než kloub palce.`);
    } else if (p.rezPrsty < 10) vv('info', 'U kontrolní šablony se jako rezerva obvykle bere 12 mm u dospělých a 12–17 mm u dětí (s rezervou na růst).');
    if (p.tloustka > 5 && p.rezim === 'vlozka') vv('varovani', `Vložka ${fmt(p.tloustka, 1)} mm ubere ze vnitřní výšky špičky i z citu pro podložku. Barefoot vložky bývají 1,5–5 mm; silnější jen do zimních bot o číslo větších.`);
    if (mats && (p.tloustka < mats.tl[0] - 0.01 || p.tloustka > mats.tl[1] + 0.01)) vv('info', `${mats.nazev} se obvykle dělá v tloušťce ${fmt(mats.tl[0], 1)}–${fmt(mats.tl[1], 1)} mm.`);
    if (p.klenba > 6) vv('info', 'Výrazné prohnutí u klenby kopíruje klasickou obuv; barefoot vložka bývá na vnitřní straně skoro rovná.');
    if (p.perforace && p.rezim === 'vlozka' && p.perfPrumer >= p.perfRozt * 0.6) vv('varovani', 'Otvory perforace jsou proti rozteči příliš velké – vložka se roztrhá.');
    if (!varovani.some((q) => q.uroven !== 'info')) vv('ok', 'Rozměry vypadají věrohodně.');
    const nazev = (p.rezim === 'kontrolni' ? 'Kontrolní šablona' : 'Barefoot vložky') + (p.jmeno ? ' – ' + p.jmeno : '') + ` (${nohy.map((n) => (n.strana === 'P' ? 'P ' : 'L ') + fmt(n.m.delka) + '×' + fmt(n.m.sirka)).join(', ')} mm)`;
    return doplnVyrobu({ p, nohy, varovani, nazev });
  }

  /* odhad délky chodidla z velikosti EU (zpětně k velikosti(); jen pro rychlý start) */
  function delkaZEu(eu, rezerva) { return Math.round(eu * 6.667 - NAVYSENI_KOPYTA - (rezerva === undefined ? 12 : rezerva)); }

  const API = { fmt, TVARY, MATERIALY, VYCHOZI, MEZE, normalizuj, spline, obalka, plocha, obvod, bodVPolygonu, vzdalenostKObrysu, rezNaY, nejsirsi, posun, zrcadli, kontrolniBody, obrys, rozmery, velikosti, tridaSirky, delkaZEu, spocitej, NAVYSENI_KOPYTA, doplnVyrobu, odsadClip, kapka, orezoveCary, perforace, jazycek, znackyDelky };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.BFJ = API;
})(typeof window !== 'undefined' ? window : globalThis);
