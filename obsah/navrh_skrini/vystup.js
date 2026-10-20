/* ============================================================
   Návrh skříní – výstupy bez DOM: 2D pohledy s kótami, výkresy dílců s dírami, řezný plán,
   SVG, DXF (CNC), strany PDF a jejich vykreslení přes jsPDF (předává se parametrem).
   Scéna = {prvky, x0, y0, x1, y1} v mm modelu, y nahoru. Velikost písma a čar se zadává v mm papíru × o.m
   (o.m = kolik mm modelu připadá na 1 mm papíru), aby texty měly stejnou velikost v náhledu i v PDF.
   prvek: {t:'r', x, y, w, h, s, c, f, d} | {t:'l', b:[[x,y]..], s, c, d, z} | {t:'k', x, y, r, s, c, f, d} | {t:'txt', x, y, h, txt, a, u, c, b}
   ============================================================ */
(function (koren) {
  'use strict';
  const NS = koren.NS || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const r1 = (x) => Math.round(x * 10) / 10;
  const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
  const cz = (x) => String(r1(x)).replace('.', ',').replace('-', '−');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const KOTA = '#1f5fa8', CERV = '#b3261e', SEDA = '#777777', ZEL = '#2c8a4a', ORAN = '#d04a00';
  const barvaDekoru = (m) => ((NS.DEKORY[m.dekor] || {}).barva) || '#dddddd';

  function Scena(m) {
    const pr = [];
    const sc = {
      m, prvky: pr,
      r(x, y, w, h, s, c, f, d, v) { pr.push({ t: 'r', x, y, w, h, s: s * m, c: c || '#000', f, d, v }); },
      l(b, s, c, d, z, v) { pr.push({ t: 'l', b, s: s * m, c: c || '#000', d, z, v }); },
      k(x, y, r, s, c, f, d, v) { pr.push({ t: 'k', x, y, r, s: s * m, c: c || '#000', f, d, v }); },
      txt(x, y, txt, h, a, u, c, v, b) { pr.push({ t: 'txt', x, y, h: h * m, txt: String(txt), a: a || 'l', u: u || 0, c: c || '#000', v, b }); },
      /** vodorovná kóta mezi x0 a x1 ve výšce y (pomocné čáry od yRef) */
      kotaH(x0, x1, y, yRef, txt, c) {
        c = c || KOTA;
        if (Math.abs(x1 - x0) < 0.01) return;
        if (yRef != null) { sc.l([[x0, yRef], [x0, y + Math.sign(y - yRef) * 1.5 * m]], 0.13, c, null, false, 'kota'); sc.l([[x1, yRef], [x1, y + Math.sign(y - yRef) * 1.5 * m]], 0.13, c, null, false, 'kota'); }
        sc.l([[x0, y], [x1, y]], 0.18, c, null, false, 'kota');
        const k = 1.2 * m;
        for (const x of [x0, x1]) sc.l([[x - k, y - k], [x + k, y + k]], 0.3, c, null, false, 'kota');
        const t = txt == null ? cz(Math.abs(x1 - x0)) : txt;
        const sir = t.length * 1.25 * m;
        if (sir < Math.abs(x1 - x0) - 2 * m) sc.txt((x0 + x1) / 2, y + 0.8 * m, t, 2.4, 'c', 0, c, 'kota');
        else sc.txt(Math.max(x0, x1) + 1.5 * m, y + 0.8 * m, t, 2.1, 'l', 0, c, 'kota');
      },
      kotaV(y0, y1, x, xRef, txt, c) {
        c = c || KOTA;
        if (Math.abs(y1 - y0) < 0.01) return;
        if (xRef != null) { sc.l([[xRef, y0], [x + Math.sign(x - xRef) * 1.5 * m, y0]], 0.13, c, null, false, 'kota'); sc.l([[xRef, y1], [x + Math.sign(x - xRef) * 1.5 * m, y1]], 0.13, c, null, false, 'kota'); }
        sc.l([[x, y0], [x, y1]], 0.18, c, null, false, 'kota');
        const k = 1.2 * m;
        for (const y of [y0, y1]) sc.l([[x - k, y - k], [x + k, y + k]], 0.3, c, null, false, 'kota');
        const t = txt == null ? cz(Math.abs(y1 - y0)) : txt;
        const sir = t.length * 1.25 * m;
        if (sir < Math.abs(y1 - y0) - 2 * m) sc.txt(x - 0.8 * m, (y0 + y1) / 2, t, 2.4, 'c', 90, c, 'kota');
        else sc.txt(x - 0.8 * m, Math.max(y0, y1) + 1.5 * m, t, 2.1, 'l', 90, c, 'kota');
      },
      hotovo() {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const P = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
        for (const e of pr) {
          if (e.t === 'r') { P(e.x, e.y); P(e.x + e.w, e.y + e.h); }
          else if (e.t === 'l') for (const q of e.b) P(q[0], q[1]);
          else if (e.t === 'k') { P(e.x - e.r, e.y - e.r); P(e.x + e.r, e.y + e.r); }
          else if (e.t === 'txt') {
            const w = e.txt.length * e.h * 0.52, a = e.a === 'r' ? -w : e.a === 'c' ? -w / 2 : 0;
            if (e.u === 90) { P(e.x - e.h, e.y + a); P(e.x, e.y + a + w); } else { P(e.x + a, e.y); P(e.x + a + w, e.y + e.h); }
          }
        }
        if (!isFinite(x0)) { x0 = y0 = 0; x1 = y1 = 1; }
        return { prvky: pr, x0, y0, x1, y1, m };
      },
    };
    return sc;
  }
  /** postaví scénu tak, aby se vešla do w × h mm papíru: vrací {sc, k (mm papíru na mm modelu)} */
  function naPapir(stav, w, h) {
    let sc = stav(1), k = 1;
    for (let i = 0; i < 3; i++) {
      k = Math.min(w / Math.max(1, sc.x1 - sc.x0), h / Math.max(1, sc.y1 - sc.y0));
      sc = stav(1 / k);
    }
    k = Math.min(w / Math.max(1, sc.x1 - sc.x0), h / Math.max(1, sc.y1 - sc.y0));
    return { sc, k };
  }
  const MERITKA = [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
  const hezkeMeritko = (k) => MERITKA.find((M) => 1 / M <= k + 1e-9) || 200;

  const FILL = { korpus: null, zada: '#efe9dc', sokl: null, celo: null, zasuvka: '#f4efe6', deska: null };
  const barvaDilce = (d, pruhl) => FILL[d.skupina] || barvaDekoru(d.mat);

  /* ---------------- pohled zepředu ---------------- */
  /** o: {cela (true), korpus (index | null), koty (true), m} */
  function pohledZepredu(V, o) {
    o = Object.assign({ cela: true, korpus: null, koty: true }, o || {});
    const m = o.m || Math.max(1, (V.sestava.x1 - V.sestava.x0) / 180);
    const sc = Scena(m);
    const vyber = (d) => (o.korpus == null || d.korpus === o.korpus) && (o.cela || d.skupina !== 'celo') && !(o.korpus != null && d.skupina === 'deska');
    const dil = V.dilce.filter(vyber).sort((a, b) => a.box.z1 - b.box.z1);
    // podlaha
    const ox = o.korpus == null ? V.sestava.x0 : V.korpusy[o.korpus].ox, ox1 = o.korpus == null ? V.sestava.x1 : ox + +V.korpusy[o.korpus].k.sirka;
    const yFloor = o.korpus == null ? 0 : V.korpusy[o.korpus].oy;
    if (o.korpus == null || V.korpusy[o.korpus].k.rada !== 'horni') sc.l([[ox - 60, 0], [ox1 + 60, 0]], 0.35, '#444', null, false, 'podlaha');
    // nožičky
    for (const K of V.korpusy) {
      if (o.korpus != null && K.index !== o.korpus) continue;
      if (K.rozmery.sokl === 'nozicky' && !(o.cela && V.projekt.N.nozicky.lista)) for (const x of [K.ox + 50, K.ox + +K.k.sirka - 50]) sc.r(x - 15, 0, 30, K.rozmery.sv, 0.2, '#333', '#888888', null, 'nozicka');
    }
    for (const d of dil) {
      const b = d.box;
      sc.r(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, d.skupina === 'celo' ? 0.3 : 0.2, '#222', barvaDilce(d), d.skupina === 'zasuvka' && !o.cela ? 'c' : null, d.skupina);
      if (d.skupina === 'celo' && d.pohyb && d.pohyb.typ === 'dvere') {
        // značka otevírání: od rohů na straně závěsů ke středu protější hrany
        const L = d.pohyb.zaves === 'L', xh = L ? b.x0 : b.x1, xo = L ? b.x1 : b.x0, ym = (b.y0 + b.y1) / 2;
        sc.l([[xh, b.y0], [xo, ym], [xh, b.y1]], 0.15, SEDA, 'c', false, 'oteviraní');
        for (const yz of d.zavesy || []) sc.r(xh + (L ? 0 : -4), yz - 10, 4, 20, 0.1, SEDA, '#999999', null, 'zaves');
      }
    }
    // díry úchytek
    if (o.cela) for (const q of V.diry) if (q.typ === 'uchytka') { const d = V.dilce.find((x) => x.id === q.dil); if (d && vyber(d)) sc.k(q.p[0], q.p[1], 4, 0.2, '#333', '#555555', null, 'uchytka'); }
    if (o.koty) {
      const N = V.projekt.N;
      if (o.korpus == null) {
        // řetězové kóty šířek po řadách
        const dol = V.korpusy.filter((K) => K.k.rada !== 'horni'), hor = V.korpusy.filter((K) => K.k.rada === 'horni');
        const yk = -14 * m;
        for (const K of dol) sc.kotaH(K.ox, K.ox + +K.k.sirka, yk, 0, null);
        if (dol.length > 1) { const a = Math.min(...dol.map((K) => K.ox)), b = Math.max(...dol.map((K) => K.ox + +K.k.sirka)); sc.kotaH(a, b, yk - 9 * m, yk, null); }
        if (hor.length) {
          const yt = Math.max(...hor.map((K) => K.oy + +K.k.vyska)) + 10 * m;
          for (const K of hor) sc.kotaH(K.ox, K.ox + +K.k.sirka, yt, K.oy + +K.k.vyska, null);
        }
        // výšky vlevo
        const xk = V.sestava.x0 - 12 * m;
        const K0 = dol[0];
        if (K0) {
          if (K0.rozmery.sv) sc.kotaV(0, K0.rozmery.sv, xk, K0.ox, null);
          sc.kotaV(K0.rozmery.sv || 0, +K0.k.vyska, xk, K0.ox, null);
          if (V.pracovniDesky.length) { const pd = V.pracovniDesky[0]; sc.kotaV(pd.box.y0, pd.box.y1, xk, pd.box.x0, null); sc.kotaV(0, pd.box.y1, xk - 9 * m, null, null); }
          else sc.kotaV(0, +K0.k.vyska, xk - 9 * m, null, null);
        }
        if (hor.length) {
          const H0 = hor[0];
          const yPd = V.pracovniDesky.length ? V.pracovniDesky[0].box.y1 : 0;
          if (yPd) sc.kotaV(yPd, H0.oy, xk, null, null);
          sc.kotaV(H0.oy, H0.oy + +H0.k.vyska, xk, H0.ox, null);
          sc.kotaV(0, H0.oy, xk - 18 * m, null, null);
        }
      } else {
        const K = V.korpusy[o.korpus], R = K.rozmery, W = +K.k.sirka, H = +K.k.vyska, x0 = K.ox, y0 = K.oy;
        sc.kotaH(x0, x0 + W, y0 - 12 * m, y0, null);
        // světlé šířky sloupců
        if (!o.cela) {
          for (const c of K.sloupce) sc.kotaH(x0 + c.cx0, x0 + c.cx1, y0 + R.yi1 - 8 * m, null, null, ZEL);
          sc.kotaV(y0 + R.yi0, y0 + R.yi1, x0 + K.sloupce[0].cx0 + 8 * m, null, null, ZEL);
        } else {
          // výšky čel vpravo
          const cela = V.dilce.filter((d) => d.korpus === o.korpus && d.skupina === 'celo' && Math.abs(d.box.x1 - (x0 + W)) < 10).sort((a, b) => a.box.y0 - b.box.y0);
          for (const d of cela) sc.kotaV(d.box.y0, d.box.y1, x0 + W + 9 * m, d.box.x1, null);
          const cl = V.dilce.filter((d) => d.korpus === o.korpus && d.skupina === 'celo' && Math.abs(d.box.y1 - (y0 + H)) < 10).sort((a, b) => a.box.x0 - b.box.x0);
          for (const d of cl) sc.kotaH(d.box.x0, d.box.x1, y0 + H + 8 * m, d.box.y1, null);
        }
        sc.kotaV(y0, y0 + H, x0 - 10 * m, x0, null);
        if (R.sv) sc.kotaV(y0, y0 + R.sv, x0 - 19 * m, null, null);
      }
    }
    return sc.hotovo();
  }

  /* ---------------- bokorys / řez korpusu ---------------- */
  /** řez rovinou x = střed prvního sloupce; vodorovně hloubka z (vpředu vpravo). o: {korpus, m, diry} */
  function rezBokem(V, o) {
    o = Object.assign({ korpus: 0, diry: true }, o || {});
    const K = V.korpusy[o.korpus];
    if (!K) return Scena(1).hotovo();
    const D = +K.k.hloubka, H = +K.k.vyska, R = K.rozmery;
    const m = o.m || Math.max(1, Math.max(D, H) / 150);
    const sc = Scena(m);
    const c0 = K.sloupce[0], xr = K.ox + (c0.cx0 + c0.cx1) / 2;
    const dil = V.dilce.filter((d) => d.korpus === o.korpus || (d.skupina === 'deska' && d.box.x0 <= K.ox + 1 && d.box.x1 >= K.ox + 1));
    // levý bok v pohledu (plocha za řezem)
    const bok = dil.find((d) => d.id === `K${o.korpus + 1}-BL`);
    const Y = (y) => y;
    if (bok) sc.r(bok.box.z0, Y(bok.box.y0), bok.box.z1 - bok.box.z0, bok.box.y1 - bok.box.y0, 0.25, '#555', '#f6f3ec', null, 'bok');
    if (bok && o.diry) {
      for (const q of V.diry) if (q.dil === bok.id && q.n === '-x') {
        const c = q.typ === 's32' ? '#333' : q.typ === 'zaves' ? CERV : q.typ === 'vysuv' ? ZEL : KOTA;
        sc.k(q.p[2], q.p[1], Math.max(q.d / 2, 1.2 * m * 0.6), 0.12, c, q.typ === 's32' ? null : c, null, 'dira');
      }
    }
    for (const d of dil) {
      const b = d.box;
      if (d === bok || d.id.endsWith('-BP')) continue;
      const proriznuty = b.x0 <= xr && b.x1 >= xr;
      if (!proriznuty) continue;
      sc.r(b.z0, Y(b.y0), b.z1 - b.z0, b.y1 - b.y0, 0.3, '#111', d.skupina === 'zasuvka' ? '#cdbfa6' : d.skupina === 'zada' ? '#bba98a' : barvaDilce(d), null, d.skupina);
    }
    if (K.k.rada !== 'horni') sc.l([[-30, 0], [D + 60, 0]], 0.35, '#444', null, false, 'podlaha');
    else { sc.l([[0, K.oy - 40], [0, K.oy + H + 40]], 0.35, '#444', null, false, 'zed'); }
    // kóty
    const yk = K.oy - 12 * m;
    sc.kotaH(0, D, yk, K.oy, null);
    const pr = dil.find((d) => d.skupina === 'celo');
    if (pr) sc.kotaH(D, pr.box.z1, yk, null, null);
    if (R.zi0 > 0) sc.kotaH(0, R.zi0, K.oy + H + 8 * m, K.oy + H, null);
    sc.kotaV(K.oy, K.oy + H, -10 * m, 0, null);
    if (K.s32 && bok && o.diry && V.diry.some((q) => q.dil === bok.id && q.typ === 's32')) {
      const zF = K.s32.radyZ[0];
      sc.kotaH(zF, D, K.oy + R.yi1 - 6 * m, null, cz(D - zF), CERV);
      if (K.s32.radyZ[1] != null) sc.kotaH(K.s32.radyZ[1], zF, K.oy + R.yi1 - 6 * m, null, cz(zF - K.s32.radyZ[1]) + ' = ' + Math.round((zF - K.s32.radyZ[1]) / 32) + ' × 32', CERV);
    }
    return sc.hotovo();
  }

  /* ---------------- půdorys ---------------- */
  function pudorys(V, o) {
    o = o || {};
    const m = o.m || Math.max(1, (V.sestava.x1 - V.sestava.x0) / 180);
    const sc = Scena(m);
    const dil = V.dilce.filter((d) => d.skupina !== 'deska').sort((a, b) => a.box.y1 - b.box.y1);
    for (const d of dil) { const b = d.box; sc.r(b.x0, -b.z1, b.x1 - b.x0, b.z1 - b.z0, 0.15, '#444', d.skupina === 'celo' ? barvaDekoru(d.mat) : '#f3f0e8', null, d.skupina); }
    for (const d of V.dilce.filter((x) => x.skupina === 'deska')) { const b = d.box; sc.r(b.x0, -b.z1, b.x1 - b.x0, b.z1 - b.z0, 0.3, ORAN, null, 'c', 'deska'); sc.txt(b.x0 + 4 * m, -b.z1 + 2 * m, d.nazev, 2.4, 'l', 0, ORAN); }
    sc.l([[V.sestava.x0 - 40, 0], [V.sestava.x1 + 40, 0]], 0.4, '#333', null, false, 'zed');
    sc.txt(V.sestava.x0, 2 * m, 'zeď', 2.4, 'l', 0, '#333');
    const zmax = V.sestava.z1;
    sc.kotaV(-zmax, 0, V.sestava.x1 + 10 * m, V.sestava.x1, null);
    return sc.hotovo();
  }

  /* ---------------- výkres dílce s dírami ---------------- */
  function nazevPlochy(V, d, plocha) {
    const K = V.korpusy[d.korpus];
    const osa = plocha === 'A' || plocha === 'B' ? d.osaT : (plocha[0] === 'd' ? d.osaS : d.osaD);
    const zn = plocha === 'A' || plocha === 'd1' || plocha === 's1' ? '-' : '+';
    let txt = NS.NAZEV_STRANY[zn + osa];
    if ((plocha === 'A' || plocha === 'B') && K) {
      const st = { x: K.ox + +K.k.sirka / 2, y: K.oy + +K.k.vyska / 2, z: +K.k.hloubka / 2 }[osa];
      const cd = (d.box[osa + '0'] + d.box[osa + '1']) / 2;
      if (osa === 'z' && d.skupina === 'celo') txt = zn === '+' ? 'líc (pohledová)' : 'rub (vnitřní)';
      else if (Math.abs(cd - st) > 1) txt += ((cd < st) === (zn === '-')) ? ' – vnější' : ' – vnitřní';
    }
    return txt;
  }
  /** o: {m, strana ('A'|'B'|auto)} → scéna + tabulka děr */
  function vykresDilce(V, id, o) {
    o = o || {};
    const d = V.dilce.find((x) => x.id === id);
    const r = d.rozmer, U = NS.boxRozmer(d.box, d.osaD), S2 = NS.boxRozmer(d.box, d.osaS), T = NS.boxRozmer(d.box, d.osaT);
    const diry = NS.diryDilce(V, id);
    const nA = diry.filter((q) => q.plocha === 'A').length, nB = diry.filter((q) => q.plocha === 'B').length;
    const strana = o.strana || (nB > nA ? 'B' : 'A');
    const zrc = strana === 'B';
    const Ux = (u) => (zrc ? U - u : u);
    const m = o.m || Math.max(0.6, Math.max(U, S2) / 160);
    const sc = Scena(m);
    const g = 10 * m, tt = Math.max(T, 2.5 * m);
    // hlavní pohled
    sc.r(0, 0, U, S2, 0.4, '#000', '#f6f1e6', null, 'obrys');
    // pásy hran (rozvinuté): d1 dole, d2 nahoře, s1/s2 vlevo/vpravo (zrcadlí se se stranou)
    const pasy = {
      d1: { x: 0, y: -g - tt, w: U, h: tt, vod: true },
      d2: { x: 0, y: S2 + g, w: U, h: tt, vod: true },
      s1: { x: zrc ? U + g : -g - tt, y: 0, w: tt, h: S2, vod: false },
      s2: { x: zrc ? -g - tt : U + g, y: 0, w: tt, h: S2, vod: false },
    };
    const hr = r.hrany;
    for (const [k, p] of Object.entries(pasy)) {
      sc.r(p.x, p.y, p.w, p.h, 0.25, '#333', hr[k] ? '#ffd9b0' : '#eeeeee', null, 'hrana');
      const nm = `${k} ${nazevPlochy(V, d, k)}${hr[k] ? ` – hrana ${cz(hr[k])} mm` : ''}`;
      if (p.vod) sc.txt(p.x + 2 * m, k === 'd1' ? p.y - 3.4 * m : p.y + p.h + 1 * m, nm, 2.2, 'l', 0, hr[k] ? ORAN : SEDA);
      else sc.txt(p.x < 0 ? p.x - 1 * m : p.x + p.w + 3.2 * m, p.y + 2 * m, nm, 2.2, 'l', 90, hr[k] ? ORAN : SEDA);
      // olepená hrana na obrysu
      if (hr[k]) {
        const L = { d1: [[0, 0], [U, 0]], d2: [[0, S2], [U, S2]], s1: [[Ux(0), 0], [Ux(0), S2]], s2: [[Ux(U), 0], [Ux(U), S2]] }[k];
        sc.l(L, 0.9, ORAN, null, false, 'hrana');
      }
    }
    // směr vláken
    if (d.smerVlaken === 'delka') {
      const y = S2 * 0.5, x0 = U * 0.3, x1 = U * 0.7;
      sc.l([[x0, y], [x1, y]], 0.2, '#a07a3a', null, false, 'vlakna');
      sc.l([[x1 - 3 * m, y - 1.5 * m], [x1, y], [x1 - 3 * m, y + 1.5 * m]], 0.2, '#a07a3a', null, false, 'vlakna');
      sc.txt((x0 + x1) / 2, y + 1.2 * m, 'směr vláken', 2.2, 'c', 0, '#a07a3a');
    }
    // díry
    const tab = [];
    diry.sort((a, b) => (a.plocha > b.plocha ? 1 : a.plocha < b.plocha ? -1 : 0) || a.u - b.u || a.v - b.v);
    diry.forEach((q, i) => {
      const c = q.kolize ? CERV : q.typ === 'miska' || q.typ === 'zaves' ? CERV : q.typ === 's32' ? '#000' : q.typ === 'vysuv' ? ZEL : KOTA;
      const rr = Math.max(q.d / 2, 0.8 * m);
      let x, y;
      if (q.plocha === 'A' || q.plocha === 'B') {
        x = Ux(q.u); y = q.v;
        const vlastni = q.plocha === strana;
        sc.k(x, y, rr, 0.25, c, null, vlastni ? null : 'c', 'dira');
        if (vlastni) { sc.l([[x - rr - 1 * m, y], [x + rr + 1 * m, y]], 0.12, c, null, false, 'kriz'); sc.l([[x, y - rr - 1 * m], [x, y + rr + 1 * m]], 0.12, c, null, false, 'kriz'); }
      } else {
        const p = pasy[q.plocha];
        const ww = zrc ? T - q.w : q.w;
        if (p.vod) { x = Ux(q.u); y = p.y + (q.plocha === 'd1' ? ww : T - ww) * tt / T; }
        else { y = q.v; x = p.x + (q.plocha === 's1' ? (zrc ? ww : T - ww) : (zrc ? T - ww : ww)) * tt / T; }
        sc.k(x, y, Math.min(rr, tt * 0.45 + 0.4 * m), 0.25, c, null, null, 'dira');
      }
      if (diry.length <= 80) sc.txt(x + rr * 0.7 + 0.5 * m, y + rr * 0.7 + 0.3 * m, String(i + 1), 1.9, 'l', 0, c, 'popis');
      tab.push({ c: i + 1, plocha: q.plocha, nazevPlochy: nazevPlochy(V, d, q.plocha), x: q.plocha === 'A' || q.plocha === 'B' ? r1(Ux(q.u)) : (pasy[q.plocha].vod ? r1(Ux(q.u)) : r1(q.v)),
        y: q.plocha === 'A' || q.plocha === 'B' ? r1(q.v) : r1(zrc ? T - q.w : q.w), d: q.d, hl: q.hl, popis: q.popis, typ: q.typ, kolize: q.kolize });
    });
    // kóty celkové a pořadnice děr
    sc.kotaH(0, U, -g - tt - 9 * m, -g - tt, null, '#000');
    sc.kotaV(0, S2, (zrc ? U + g + tt : -g - tt) + (zrc ? 10 : -10) * m, zrc ? U + g + tt : -g - tt, null, '#000');
    const plos = diry.filter((q) => q.plocha === 'A' || q.plocha === 'B');
    const xs = [...new Set(plos.map((q) => r1(Ux(q.u))))].sort((a, b) => a - b), ys = [...new Set(plos.map((q) => r1(q.v)))].sort((a, b) => a - b);
    if (xs.length <= 40) for (const x of xs) { sc.l([[x, S2], [x, S2 + 2.2 * m]], 0.13, KOTA, null, false, 'kota'); }
    if (xs.length <= 24) for (const x of xs) sc.txt(x + 0.6 * m, S2 + 2.6 * m, cz(x), 1.8, 'l', 90, KOTA, 'kota');
    if (ys.length <= 40) for (const y of ys) { const xe = zrc ? 0 : U; sc.l([[xe, y], [xe + (zrc ? -2.2 : 2.2) * m, y]], 0.13, KOTA, null, false, 'kota'); }
    if (ys.length <= 24) for (const y of ys) sc.txt(zrc ? -2.6 * m : U + 2.6 * m, y - 0.7 * m, cz(y), 1.8, zrc ? 'r' : 'l', 0, KOTA, 'kota');
    // počátek souřadnic
    sc.k(0, 0, 1.2 * m, 0.3, CERV, null, null, 'pocatek');
    sc.txt(1.6 * m, 1.4 * m, '0,0', 2, 'l', 0, CERV);
    // nadpis
    sc.txt(0, S2 + g + tt + 9 * m, `${d.id} – ${d.nazev}`, 3.4, 'l', 0, '#000', 'nadpis', true);
    sc.txt(0, S2 + g + tt + 4.5 * m, `${cz(r.delka)} × ${cz(r.sirka)} × ${cz(r.tl)} mm · ${NS.popisMaterialu(d.mat)} · pohled na stranu ${strana} (${nazevPlochy(V, d, strana)})${zrc ? ' – zrcadleno' : ''}`, 2.3, 'l', 0, '#333', 'nadpis');
    const vys = sc.hotovo();
    vys.tabulka = tab; vys.strana = strana; vys.dil = d;
    return vys;
  }

  /* ---------------- řezný plán – scéna jedné desky ---------------- */
  function scenaDesky(g, deska, o) {
    o = o || {};
    const m = o.m || Math.max(1, deska.w / 200);
    const sc = Scena(m);
    sc.r(0, 0, deska.w, deska.h, 0.35, '#000', '#f7f2e8', null, 'deska');
    if (g.okraj && g.mat.druh !== 'pracovni') sc.r(g.okraj, g.okraj, deska.w - 2 * g.okraj, deska.h - 2 * g.okraj, 0.12, SEDA, null, 'c', 'okraj');
    for (const p of deska.dily) {
      const y = deska.h - p.y - p.h;
      sc.r(p.x, y, p.w, p.h, 0.25, '#333', barvaDekoru(g.mat), null, 'dil');
      const h = Math.min(2.6, Math.max(1.4, Math.min(p.w, p.h) / m * 0.22));
      if (p.w / m > 14 && p.h / m > 5) {
        sc.txt(p.x + p.w / 2, y + p.h / 2 + 0.2 * h * m, `${p.pozice}. ${p.nazev}`, h, 'c', 0, '#000', 'popis');
        sc.txt(p.x + p.w / 2, y + p.h / 2 - 1.2 * h * m, `${cz(p.w)} × ${cz(p.h)}${p.otoceno ? ' ↻' : ''}`, h * 0.85, 'c', 0, '#333', 'popis');
      } else if (p.h / m > 14 && p.w / m > 5) sc.txt(p.x + p.w / 2 + 0.4 * h * m, y + p.h / 2, `${p.pozice}. ${cz(p.h)} × ${cz(p.w)}`, h * 0.85, 'c', 90, '#000', 'popis');
    }
    sc.kotaH(0, deska.w, -8 * m, 0, null, '#000');
    sc.kotaV(0, deska.h, -8 * m, 0, null, '#000');
    if (NS.maVlakna(g.mat)) sc.txt(deska.w - 2 * m, deska.h + 2 * m, 'vlákna →', 2.4, 'r', 0, '#a07a3a');
    return sc.hotovo();
  }

  /* ---------------- SVG ---------------- */
  function svgPrvek(e) {
    const Y = (y) => -y, s = n3(Math.max(0.03, e.s || 0.1));
    const dash = e.d === 'c' ? ` stroke-dasharray="${n3(e.s * 8)} ${n3(e.s * 5)}"` : e.d === 'o' ? ` stroke-dasharray="${n3(e.s * 24)} ${n3(e.s * 6)} ${n3(e.s * 3)} ${n3(e.s * 6)}"` : '';
    if (e.t === 'r') return `<rect x="${n3(e.x)}" y="${n3(Y(e.y + e.h))}" width="${n3(e.w)}" height="${n3(e.h)}" fill="${e.f || 'none'}" stroke="${e.c}" stroke-width="${s}"${dash}/>`;
    if (e.t === 'l') return `<path d="${e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(Y(q[1]))).join('')}${e.z ? 'Z' : ''}" fill="none" stroke="${e.c}" stroke-width="${s}" stroke-linecap="round"${dash}/>`;
    if (e.t === 'k') return `<circle cx="${n3(e.x)}" cy="${n3(Y(e.y))}" r="${n3(e.r)}" fill="${e.f || 'none'}" stroke="${e.c}" stroke-width="${s}"${e.d ? ` stroke-dasharray="${n3(e.r * 0.45)} ${n3(e.r * 0.35)}"` : ''}/>`;
    if (e.t === 'txt') {
      const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(Y(e.y))})"` : '';
      return `<text x="${n3(e.x)}" y="${n3(Y(e.y))}" font-size="${n3(e.h)}" text-anchor="${an}" fill="${e.c}"${e.b ? ' font-weight="bold"' : ''}${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** o: {okraj (mm modelu), sirkaPx (true = 100 %), skutecna (true = rozměry v mm papíru pro tisk 1:M), meritko} */
  function svg(sc, o) {
    o = o || {};
    const m = o.okraj == null ? 4 * (sc.m || 1) : o.okraj;
    const x = sc.x0 - m, y = -sc.y1 - m, w = sc.x1 - sc.x0 + 2 * m, h = sc.y1 - sc.y0 + 2 * m;
    const rozm = o.sirkaPx ? 'width="100%"' : o.meritko ? `width="${n3(w / o.meritko)}mm" height="${n3(h / o.meritko)}mm"` : `width="${n3(w)}mm" height="${n3(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n3(x)} ${n3(y)} ${n3(w)} ${n3(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`;
    s += `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}" fill="#ffffff"/>`;
    for (const e of sc.prvky) s += svgPrvek(e);
    return s + '</svg>';
  }

  /* ---------------- DXF dílců pro CNC (R12, mm) ---------------- */
  const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ø/g, '%%c').replace(/[−–]/g, '-').replace(/×/g, 'x').replace(/[^\x20-\x7e]/g, '');
  const vrstva = (s) => ascii(s).replace(/%%c/g, 'D').replace(/[^A-Za-z0-9_-]/g, '_').toUpperCase();
  /**
   * Každý dílec jako obdélník v rovině strany A (u = délka podél X, v = šířka podél Y), dílce pod sebou s mezerou 50 mm.
   * Vrstvy: OBRYS, VRT_D5_H12 (plošné díry ze strany A), RUB_D35_H13 (ze strany B, souřadnice při pohledu ze strany A),
   * HRANA_D1_D8_H25 (vodorovné díry do hrany – úsečka od hrany dovnitř délky hloubky), POPIS.
   */
  function dxfDilce(V, ids) {
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    const ent = [], vrstvy = new Set(['OBRYS', 'POPIS', 'HRANY_OLEPENI']);
    const line = (ly, x0, y0, x1, y1) => { vrstvy.add(ly); ent.push(['LINE', ly, x0, y0, x1, y1]); };
    const circ = (ly, x, y, r) => { vrstvy.add(ly); ent.push(['CIRCLE', ly, x, y, r]); };
    const text = (ly, x, y, h, t) => { vrstvy.add(ly); ent.push(['TEXT', ly, x, y, h, t]); };
    let oy = 0;
    for (const id of ids) {
      const d = V.dilce.find((x) => x.id === id);
      if (!d) continue;
      const U = NS.boxRozmer(d.box, d.osaD), S2 = NS.boxRozmer(d.box, d.osaS), T = NS.boxRozmer(d.box, d.osaT);
      line('OBRYS', 0, oy, U, oy); line('OBRYS', U, oy, U, oy + S2); line('OBRYS', U, oy + S2, 0, oy + S2); line('OBRYS', 0, oy + S2, 0, oy);
      const h = d.rozmer.hrany;
      if (h.d1) line('HRANY_OLEPENI', 0, oy + 1, U, oy + 1); if (h.d2) line('HRANY_OLEPENI', 0, oy + S2 - 1, U, oy + S2 - 1);
      if (h.s1) line('HRANY_OLEPENI', 1, oy, 1, oy + S2); if (h.s2) line('HRANY_OLEPENI', U - 1, oy, U - 1, oy + S2);
      text('POPIS', 0, oy + S2 + 6, 5, `${d.id} ${d.nazev} ${r1(U)}x${r1(S2)}x${r1(T)}`);
      for (const q of NS.diryDilce(V, id)) {
        const hl = q.hl == null ? 'SKRZ' : String(r1(q.hl)).replace('.', '_');
        const dd = String(q.d).replace('.', '_');
        if (q.plocha === 'A') circ(vrstva(`VRT_D${dd}_H${hl}`), q.u, oy + q.v, q.d / 2);
        else if (q.plocha === 'B') circ(vrstva(`RUB_D${dd}_H${hl}`), q.u, oy + q.v, q.d / 2);
        else {
          const ly = vrstva(`HRANA_${q.plocha}_D${dd}_H${hl}_Z${String(r1(q.w)).replace('.', '_')}`), hh = q.hl || 10;
          if (q.plocha === 'd1') line(ly, q.u, oy, q.u, oy + hh); else if (q.plocha === 'd2') line(ly, q.u, oy + S2, q.u, oy + S2 - hh);
          else if (q.plocha === 's1') line(ly, 0, oy + q.v, hh, oy + q.v); else line(ly, U, oy + q.v, U - hh, oy + q.v);
        }
      }
      oy += S2 + 50;
    }
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrstvy.size);
    let i = 1;
    for (const v of vrstvy) { g(0, 'LAYER'); g(2, v); g(70, 0); g(62, v === 'OBRYS' ? 7 : v === 'POPIS' ? 8 : v.startsWith('RUB') ? 1 : v.startsWith('HRANA_') ? 5 : v === 'HRANY_OLEPENI' ? 30 : 3 + (i++ % 4)); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    for (const e of ent) {
      if (e[0] === 'LINE') { g(0, 'LINE'); g(8, e[1]); g(10, n3(e[2])); g(20, n3(e[3])); g(30, 0); g(11, n3(e[4])); g(21, n3(e[5])); g(31, 0); }
      else if (e[0] === 'CIRCLE') { g(0, 'CIRCLE'); g(8, e[1]); g(10, n3(e[2])); g(20, n3(e[3])); g(30, 0); g(40, n3(e[4])); }
      else { g(0, 'TEXT'); g(8, e[1]); g(10, n3(e[2])); g(20, n3(e[3])); g(30, 0); g(40, n3(e[4])); g(1, ascii(e[5])); }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------------- CSV kusovníku ---------------- */
  function csvKusovnik(V) {
    const f = (x) => String(x).replace('.', ',');
    const out = ['pozice;nazev;delka;sirka;tl;ks;material;smer_vlaken;hrana_d1;hrana_d2;hrana_s1;hrana_s2;rez_delka;rez_sirka;dilce'];
    for (const x of V.kusovnik) out.push([x.pozice, '"' + x.nazev + '"', f(x.delka), f(x.sirka), f(x.tl), x.ks, '"' + x.material + '"', x.smerVlaken, f(x.hrany.d1), f(x.hrany.d2), f(x.hrany.s1), f(x.hrany.s2), f(x.rezDelka), f(x.rezSirka), '"' + x.dilce.join(' ') + '"'].join(';'));
    return out.join('\r\n') + '\r\n';
  }
  const textHran = (h) => {
    const s = [];
    if (h.d1 || h.d2) s.push(`D ${h.d1 && h.d2 ? '2×' : '1×'}${cz(h.d1 || h.d2)}`);
    if (h.s1 || h.s2) s.push(`Š ${h.s1 && h.s2 ? '2×' : '1×'}${cz(h.s1 || h.s2)}`);
    return s.join(', ') || '–';
  };

  /* ---------------- strany PDF (mm papíru, y dolů) ---------------- */
  /** o: {papir: 'a4'|'a3', vykresy (true), nazev, datum} */
  function strany(V, o) {
    o = Object.assign({ papir: 'a4', vykresy: true }, o || {});
    const [PW, PH] = o.papir === 'a3' ? [420, 297] : [297, 210];
    const ok = 10, out = [];
    const nazev = o.nazev || V.projekt.nazev || 'Návrh skříní';
    const nova = (typ) => { const st = { W: PW, H: PH, navrch: [], typ }; out.push(st); return st; };
    const T = (st, x, y, txt, h, a, c, u) => st.navrch.push({ t: 'txt', x, y, txt: String(txt), h: h || 3, a: a || 'l', c: c || '#000000', u: u || 0 });
    const Lp = (st, b, s, c) => st.navrch.push({ t: 'l', b, s: s || 0.2, c: c || '#000000' });
    const ramecek = (st, nadpis, cislo) => {
      st.navrch.push({ t: 'r', x: ok, y: ok, w: PW - 2 * ok, h: PH - 2 * ok, s: 0.35, c: '#000000' });
      Lp(st, [[ok, PH - ok - 9], [PW - ok, PH - ok - 9]], 0.25);
      T(st, ok + 3, PH - ok - 3.2, `${nazev} · ${nadpis}`, 3.2);
      T(st, PW - ok - 3, PH - ok - 3.2, `${o.datum || ''}  list ${cislo}`, 2.6, 'r', '#444444');
    };
    /** vloží scénu do obdélníku; vrací měřítko */
    const vloz = (st, stav, x, y, w, h, popis) => {
      const { sc, k } = naPapir(stav, w, h - (popis ? 6 : 0));
      const M = hezkeMeritko(k), kk = 1 / M;
      const { sc: sc2 } = { sc: stav(M) };
      const ww = (sc2.x1 - sc2.x0) * kk, hh = (sc2.y1 - sc2.y0) * kk;
      if (ww > w + 0.5 || hh > h - (popis ? 6 : 0) + 0.5) {
        // hezké měřítko se nevejde (texty) → použít přesné
        const X = (q) => x + (q - sc.x0) * k + (w - (sc.x1 - sc.x0) * k) / 2, Y = (q) => y + (popis ? 6 : 0) + (sc.y1 - q) * k;
        preved(sc, X, Y, k, st.navrch);
        if (popis) T(st, x, y + 3.5, `${popis} · měřítko ≈ 1:${cz(1 / k)}`, 2.8);
        return 1 / k;
      }
      const X = (q) => x + (q - sc2.x0) * kk + (w - ww) / 2, Y = (q) => y + (popis ? 6 : 0) + (sc2.y1 - q) * kk;
      preved(sc2, X, Y, kk, st.navrch);
      if (popis) T(st, x, y + 3.5, `${popis} · měřítko 1:${cz(M)}`, 2.8);
      return M;
    };
    let cislo = 0;
    // 1) přehled
    {
      const st = nova('prehled'); ramecek(st, 'Pohled zepředu', ++cislo);
      vloz(st, (m) => pohledZepredu(V, { cela: true, m }), ok + 5, ok + 4, PW - 2 * ok - 75, PH - 2 * ok - 18, 'Sestava – pohled zepředu (s čely)');
      let y = ok + 10; const x = PW - ok - 66;
      T(st, x, y, 'Souhrn', 4); y += 6;
      const N = V.projekt.N;
      const rad = [`Korpusů: ${V.korpusy.length}`, `Dílců: ${V.dilce.length} (${V.kusovnik.length} pozic)`, `Korpus: ${NS.popisMaterialu(N.korpusMat)}`, `Čela: ${NS.popisMaterialu(N.celaMat)}`, `Záda: ${NS.popisMaterialu(N.zadaMat)}`,
        `Čela: ${N.cela.montaz === 'vlozena' ? 'vložená' : 'na doraz'}, spára ${cz(N.cela.spara)} mm`, `Systém 32: řada ${cz(N.s32.odCela)} mm od čela`, `Rozměr sestavy: ${cz(V.sestava.x1 - V.sestava.x0)} × ${cz(V.sestava.y1 - V.sestava.y0)} × ${cz(V.sestava.z1 - V.sestava.z0)} mm`];
      for (const r of rad) { T(st, x, y, r, 2.6); y += 4.4; }
      y += 3;
      for (const v of V.varovani.slice(0, 8)) { T(st, x, y, '! ' + v.slice(0, 60), 2.2, 'l', '#b3261e'); y += 3.6; }
      // kontrolní čtverec 50 mm
      const yq = PH - ok - 12 - 50, xq = PW - ok - 60;
      st.navrch.push({ t: 'r', x: xq, y: yq, w: 50, h: 50, s: 0.25, c: '#000000' });
      T(st, xq + 25, yq + 26, '50 × 50 mm', 3, 'c');
      T(st, xq, yq - 2, 'Kontrola tisku (100 %):', 2.4);
    }
    // 2) korpusy
    for (const K of V.korpusy) {
      const st = nova('korpus'); ramecek(st, `${'K' + (K.index + 1)} ${K.k.nazev}`, ++cislo);
      const w3 = (PW - 2 * ok - 20) / 3;
      vloz(st, (m) => pohledZepredu(V, { cela: true, korpus: K.index, m }), ok + 4, ok + 4, w3, PH - 2 * ok - 60, 'Pohled zepředu');
      vloz(st, (m) => pohledZepredu(V, { cela: false, korpus: K.index, m }), ok + 10 + w3, ok + 4, w3, PH - 2 * ok - 60, 'Bez čel – světlosti');
      vloz(st, (m) => rezBokem(V, { korpus: K.index, m }), ok + 16 + 2 * w3, ok + 4, w3, PH - 2 * ok - 60, 'Řez bokem, vrtání levého boku');
      const k = K.k, R = K.rozmery;
      let y = PH - ok - 48;
      const pop = [`Vnější rozměr ${cz(k.sirka)} × ${cz(k.vyska)} × ${cz(k.hloubka)} mm (š × v × h), ${k.rada === 'horni' ? 'horní skříňka' : 'dolní / stojící'}`,
        `Dno ${R.sokl === 'boky' || k.dno === 'mezi' ? 'mezi boky' : 'pod boky'}, strop ${{ mezi: 'mezi boky', nad: 'přes boky', traverzy: 'traverzy' }[k.strop]}, záda ${{ drazka: 'v drážce', pribita: 'přibitá', vlozena: 'vložená' }[k.zada]}, spoje ${{ konfirmat: 'konfirmáty', kolik: 'kolíky', excentr: 'excentry + kolíky' }[k.spoj]}`,
        `Sokl: ${{ zadny: 'bez soklu', boky: 'boky na zem + soklová lišta', nozicky: 'nožičky + klipovaný sokl' }[R.sokl]}${R.sv ? ' ' + cz(R.sv) + ' mm' : ''}; světlá výška ${cz(R.yi1 - R.yi0)} mm, užitná hloubka ${cz(R.zCelo - R.zi0)} mm`,
        `Sloupce: ${K.sloupce.map((c) => cz(c.sirka)).join(' + ')} mm světle`];
      for (const r of pop) { T(st, ok + 4, y, r, 2.6); y += 4.4; }
    }
    // 3) kusovník
    {
      let st = null, y = 0;
      const sl = [0, 9, 70, 92, 112, 124, 134, 196, 214, 250];
      const hl = ['poz.', 'název', 'délka', 'šířka', 'tl.', 'ks', 'materiál', 'vlákna', 'hrany', 'řez. rozměr'];
      const hlav = () => { st = nova('kusovnik'); ramecek(st, 'Kusovník dílců', ++cislo); y = ok + 8; for (let i = 0; i < hl.length; i++) T(st, ok + 3 + sl[i], y, hl[i], 2.5, 'l', '#555555'); y += 1.5; Lp(st, [[ok + 2, y], [PW - ok - 2, y]], 0.15, '#999999'); y += 4; };
      hlav();
      for (const x of V.kusovnik) {
        if (y > PH - ok - 14) hlav();
        const rw = [String(x.pozice), x.nazev, cz(x.delka), cz(x.sirka), cz(x.tl), String(x.ks), x.material, x.smerVlaken === 'delka' ? 'podél délky' : 'libovolně', textHran(x.hrany), `${cz(x.rezDelka)} × ${cz(x.rezSirka)}`];
        for (let i = 0; i < rw.length; i++) T(st, ok + 3 + sl[i], y, rw[i].slice(0, i === 1 ? 34 : i === 6 ? 34 : 24), 2.5);
        y += 4.1;
      }
      y += 3;
      if (y > PH - ok - 30) hlav();
      T(st, ok + 3, y, 'Hrany: D = podél délky (d1/d2), Š = podél šířky (s1/s2). Řezný rozměr je zmenšený o tloušťku hran (pokud je zapnuto odečítání).', 2.4, 'l', '#444444'); y += 5;
      for (const h of NS.souhrnHran(V.kusovnik)) { T(st, ok + 3, y, `ABS hrana ${cz(h.tl)} mm: ${cz(h.bm)} bm (bez prořezu, přidejte ~10 %)`, 2.6); y += 4.2; }
      for (const m of NS.souhrnMaterialu(V.kusovnik)) { T(st, ok + 3, y, `${m.material}: ${cz(m.plocha)} m² čisté plochy, ${m.ks} ks`, 2.6); y += 4.2; }
    }
    // 4) kování
    {
      const st = nova('kovani'); ramecek(st, 'Kování a spojovací materiál', ++cislo);
      let y = ok + 9;
      T(st, ok + 3, y, 'Položka', 2.6, 'l', '#555555'); T(st, ok + 120, y, 'ks', 2.6, 'r', '#555555'); T(st, ok + 128, y, 'poznámka (typické hodnoty – ověřte u výrobce)', 2.6, 'l', '#555555'); y += 6;
      for (const k of V.kovani) { if (y > PH - ok - 14) break; T(st, ok + 3, y, k.nazev, 2.7); T(st, ok + 120, y, String(k.ks), 2.7, 'r'); T(st, ok + 128, y, k.pozn || '', 2.5, 'l', '#444444'); y += 4.6; }
      y += 4;
      T(st, ok + 3, y, 'Počty jsou orientační (bez rezervy). Délky výsuvů a typ závěsů zvolte podle katalogu konkrétního výrobce.', 2.5, 'l', '#444444');
    }
    // 5) řezný plán
    const RP = NS.reznyPlan(V.kusovnik, V.projekt.N);
    for (const g of RP) g.desky.forEach((d, i) => {
      const st = nova('rezani'); ramecek(st, `Řezný plán – ${g.material} – deska ${i + 1}/${g.desky.length} (${cz(d.vyuziti)} %)`, ++cislo);
      vloz(st, (m) => scenaDesky(g, d, { m }), ok + 6, ok + 4, PW - 2 * ok - 12, PH - 2 * ok - 18, `Formát ${cz(g.format[0])} × ${cz(g.format[1])} mm, prořez ${cz(g.prorez)} mm, ořez ${cz(g.okraj)} mm`);
    });
    // 6) výkresy dílců
    if (o.vykresy) {
      for (const d of V.dilce) {
        const diry = V.diry.filter((q) => q.dil === d.id);
        if (!diry.length) continue;
        const st = nova('dilec'); ramecek(st, `Výkres dílce ${d.id} – ${d.nazev}`, ++cislo);
        const wv = PW - 2 * ok - 104;
        let vk = null;
        vloz(st, (m) => (vk = vykresDilce(V, d.id, { m })), ok + 4, ok + 4, wv, PH - 2 * ok - 16, 'Plán vrtání');
        let y = ok + 8; const x = PW - ok - 98;
        const sl = [0, 7, 19, 33, 47, 57, 69];
        for (const [i, h] of ['#', 'plocha', 'x', 'y', 'Ø', 'hloubka', 'účel'].entries()) T(st, x + sl[i], y, h, 2.3, 'l', '#555555');
        y += 1.4; Lp(st, [[x, y], [PW - ok - 2, y]], 0.15, '#999999'); y += 3.6;
        for (const r of vk.tabulka) {
          if (y > PH - ok - 14) { T(st, x, y, `… a dalších ${vk.tabulka.length - r.c + 1} děr (viz DXF)`, 2.3, 'l', '#555555'); break; }
          const rw = [String(r.c), r.plocha, cz(r.x), cz(r.y), cz(r.d), r.hl == null ? 'skrz' : cz(r.hl), r.popis.split(' – ')[0]];
          for (let i = 0; i < rw.length; i++) T(st, x + sl[i], y, rw[i].slice(0, i === 6 ? 22 : 10), 2.3, 'l', r.kolize ? '#b3261e' : '#000000');
          y += 3.5;
        }
      }
    }
    return out;
  }
  function preved(sc, X, Y, k, arr) {
    for (const e of sc.prvky) {
      if (e.t === 'r') arr.push({ t: 'r', x: X(e.x), y: Y(e.y + e.h), w: e.w * k, h: e.h * k, s: e.s * k, c: e.c, f: e.f, d: e.d });
      else if (e.t === 'l') arr.push({ t: 'l', b: e.b.map((q) => [X(q[0]), Y(q[1])]), s: e.s * k, c: e.c, d: e.d, z: e.z });
      else if (e.t === 'k') arr.push({ t: 'e', x: X(e.x), y: Y(e.y), rx: e.r * k, ry: e.r * k, s: e.s * k, c: e.c, f: e.f, d: e.d });
      else if (e.t === 'txt') arr.push({ t: 'txt', x: X(e.x), y: Y(e.y), txt: e.txt, h: e.h * k, a: e.a, u: e.u, c: e.c });
    }
  }

  /* ---------------- PDF přes jsPDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[„“]/g, '"').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/↻/g, '(o)').replace(/→/g, '->');
  const bezchybne = (s) => String(s).replace(/↻/g, '(otočeno)').replace(/→/g, '->');
  function rgb(hex) { const h = String(hex || '#000000'); const v = parseInt(h.length === 4 ? h.slice(1).split('').map((c) => c + c).join('') : h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function pdf(jsPDF, str, o) {
    o = Object.assign({ compress: true }, o || {});
    let doc = null, uni = false;
    const TX = (s) => (uni ? bezchybne(s) : bezDiakritiky(s));
    for (const st of str) {
      const orient = st.W > st.H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [st.W, st.H], orientation: orient, compress: o.compress });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
        doc.setProperties({ title: o.nazev || 'Návrh skříní', creator: 'Návrh skříní a korpusů' });
      } else doc.addPage([st.W, st.H], orient);
      for (const e of st.navrch) {
        const c = rgb(e.c); doc.setDrawColor(...c);
        if (e.f) doc.setFillColor(...rgb(e.f));
        const s = Math.max(0.05, e.s || 0.2);
        doc.setLineWidth(s);
        if (e.d === 'c') doc.setLineDashPattern([Math.max(0.6, s * 8), Math.max(0.4, s * 5)], 0); else if (e.d === 'o') doc.setLineDashPattern([s * 24, s * 6, s * 3, s * 6], 0);
        if (e.t === 'l') {
          if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
          else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
        } else if (e.t === 'e') doc.ellipse(e.x, e.y, e.rx, e.ry, e.f ? 'FD' : 'S');
        else if (e.t === 'r') doc.rect(e.x, e.y, e.w, e.h, e.f ? 'FD' : 'S');
        else if (e.t === 'txt') {
          if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', 'normal');
          doc.setFontSize(e.h / 0.3528); doc.setTextColor(...c);
          const t = TX(e.txt), w = doc.getTextWidth(t), u = (e.u || 0) * Math.PI / 180;
          const kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0;
          doc.text(t, e.x - Math.cos(u) * kk, e.y + Math.sin(u) * kk, e.u ? { angle: e.u } : undefined);
        }
        if (e.d) doc.setLineDashPattern([], 0);
      }
    }
    if (!doc) doc = new jsPDF({ unit: 'mm', format: 'a4' });
    return doc;
  }

  const API = { Scena, naPapir, pohledZepredu, rezBokem, pudorys, vykresDilce, nazevPlochy, scenaDesky, svg, svgPrvek, dxfDilce, csvKusovnik, textHran, strany, pdf, bezDiakritiky, cz };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.NSV = API;
})(typeof window !== 'undefined' ? window : globalThis);
