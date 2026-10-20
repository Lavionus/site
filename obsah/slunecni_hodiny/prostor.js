/* ============================================================
   Sluneční hodiny – prostorová sestava (bez DOM, bez three.js)
   - sestava(R, ms): plochy ciferníku a gnomon ve světových souřadnicích (V, S, N) v mm,
     poloha Slunce a stín gnomonu spočítaný průmětem do roviny ciferníku (pro 3D i test shody s 2D)
   - bokorys(R): boční pohled / řez s kótami (scéna jako v jadro.js)
   ============================================================ */
(function (koren) {
  'use strict';
  const SH = typeof module !== 'undefined' && module.exports ? require('./jadro.js') : koren.SH;
  const RAD = Math.PI / 180;
  const sin = (x) => Math.sin(x * RAD), cos = (x) => Math.cos(x * RAD), tan = (x) => Math.tan(x * RAD);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const plus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const kr = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const f1 = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',');

  /** bod roviny (x, y) → svět */
  const zRoviny = (F, q) => plus(plus(F.O3, kr(F.ex, q[0])), kr(F.ey, q[1]));
  /** svět → souřadnice roviny */
  const doRoviny = (F, P) => { const d = minus(P, F.O3); return [dot(d, F.ex), dot(d, F.ey)]; };
  /** průmět bodu P ve směru od Slunce (−s) do roviny F */
  function promitni(F, P, s) {
    const sn = dot(s, F.n); if (sn <= 1e-9) return null;
    const lam = dot(minus(P, F.O3), F.n) / sn;
    return lam < -1e-9 ? null : minus(P, kr(s, lam));
  }
  /** obdélník scény (papír, y dolů) → obdélník v souřadnicích roviny (y nahoru) */
  const rectScena = (sc) => ({ x0: sc.x0, x1: sc.x1, y0: -sc.y1, y1: -sc.y0 });

  /** dráha Slunce pro deklinaci d: pole jednotkových vektorů nad obzorem */
  function draha(fi, d) {
    const out = [];
    for (let t = -180; t <= 180; t += 2) { const v = SH.vektorSlunce(t, d, fi); if (v[2] > -0.02) out.push(v); else if (out.length && out[out.length - 1] !== null) out.push(null); }
    return out;
  }

  /**
   * Sestava pro okamžik ms (UTC).
   * {plochy:[{O3, ex, ey, n, rect, nazev, w?, h?}], gnomony:[{t:'troj'|'deska'|'tyc'|'kolik'|'retez', body, r?}],
   *  stin:{plocha (index), body2D (rovina), bod2D, bod3D} | null, slunce:{v, vyska, azimut}, drahy:{den, leto, zima}, meritko, podlaha}
   */
  function sestava(R, ms) {
    const p = R.p, I = R.info, fi = p.sirka, pol = SH.polohaSlunce(ms, fi, p.delka), s = pol.vektor;
    const osa = [0, cos(fi), sin(fi)], U = [0, 0, 1];
    const out = { plochy: [], gnomony: [], stin: null, slunce: { v: s, vyska: pol.vyska, azimut: pol.azimut }, poloha: pol };
    out.drahy = { den: draha(fi, pol.deklinace), leto: draha(fi, 23.44), zima: draha(fi, -23.44) };
    const sviti = pol.vyska > 0;
    const typ = p.typ;
    if (typ === 'vodorovne' || typ === 'svisle' || typ === 'deklinujici' || typ === 'polarni') {
      const pl = R.m.pl, kruh = p.tvar === 'kruh' && typ !== 'polarni', rr = +p.sirkaMm / 2;
      const F = { O3: [0, 0, 0], ex: pl.ex, ey: pl.ey, n: pl.n, rect: kruh ? { x0: -rr, x1: rr, y0: -rr, y1: rr } : rectScena(R.cifernik), kruh, nazev: 'ciferník' };
      out.plochy.push(F);
      const h = I.vyskaNodu, O = I.pataNodu, O3 = zRoviny(F, O), G3 = plus(O3, kr(pl.n, h));
      if (I.Cq) out.gnomony.push({ t: 'troj', body: [zRoviny(F, I.Cq), O3, G3] });
      else {
        const o = I.oblast, y0 = o.cy - o.b, y1 = o.cy + o.b;
        out.gnomony.push({ t: 'deska', body: [zRoviny(F, [O[0], y0]), zRoviny(F, [O[0], y1]), plus(zRoviny(F, [O[0], y1]), kr(pl.n, h)), plus(zRoviny(F, [O[0], y0]), kr(pl.n, h))] });
      }
      out.nodus = G3;
      if (sviti && dot(s, pl.n) > 1e-9) {
        const Q = promitni(F, G3, s), b = doRoviny(F, Q);
        let body2D;
        if (I.Cq) body2D = [I.Cq, b, O];
        else { const o = I.oblast; body2D = [[b[0] - 0.6, o.cy - o.b], [b[0] + 0.6, o.cy - o.b], [b[0] + 0.6, o.cy + o.b], [b[0] - 0.6, o.cy + o.b]]; }
        out.stin = { plocha: 0, body2D, bod2D: b, bod3D: Q };
      }
      out.meritko = Math.max(R.cifernik.w, R.cifernik.h);
    } else if (typ === 'ekvatorialni') {
      const D = I.D, h = I.vyskaNodu, W0 = [0, 0, 0];
      for (const q of I.plochy) {
        const pl = SH.rovina(q.typ, fi, 0);
        out.plochy.push({ O3: minus(W0, kr(pl.ex, q.ox)), ex: pl.ex, ey: pl.ey, n: pl.n, rect: { x0: q.ox - D / 2, x1: q.ox + D / 2, y0: -D / 2, y1: D / 2 }, nazev: q.typ, kruh: true, ox: q.ox });
      }
      out.gnomony.push({ t: 'tyc', body: [minus(W0, kr(osa, h * 1.6)), plus(W0, kr(osa, h * 1.6))], r: Math.max(0.5, p.prumerTyce / 2) });
      out.nodusy = [plus(W0, kr(osa, h)), minus(W0, kr(osa, h))];
      out.nodus = out.nodusy[0];
      if (sviti) {
        out.plochy.forEach((F, i) => {
          if (dot(s, F.n) <= 1e-9 || out.stin) return;
          const tip = plus(W0, kr(F.n, h)), Q = promitni(F, tip, s), b = doRoviny(F, Q);
          out.stin = { plocha: i, body2D: [[F.ox, 0], b], bod2D: b, bod3D: Q, cara: true };
        });
      }
      out.meritko = D * 1.6;
    } else if (typ === 'analematicke') {
      const pl = SH.rovina('vodorovne', fi, 0), F = { O3: [0, 0, 0], ex: pl.ex, ey: pl.ey, n: pl.n, rect: rectScena(R.cifernik), nazev: 'ciferník' };
      out.plochy.push(F);
      const A = R.analema, dd = SH.slunce(ms).deklinace, Fp = [A.stred[0], A.yD(dd)], hg = A.vyskaGnomonu;
      const pata = zRoviny(F, Fp), vrch = plus(pata, kr(U, hg));
      out.gnomony.push({ t: 'tyc', body: [pata, vrch], r: Math.max(1, hg * 0.02) });
      out.nodus = vrch;
      if (sviti) { const Q = promitni(F, vrch, s), b = doRoviny(F, Q); out.stin = { plocha: 0, body2D: [Fp, b], bod2D: b, bod3D: Q, cara: true }; }
      out.meritko = Math.max(R.cifernik.w, R.cifernik.h);
    } else if (typ === 'kapesni') {
      const rz = I.rozvin, n = rz.steny, W = rz.W, T = rz.T, H = rz.vyska;
      const i = R.sloupecProDatum(ms + p.posunUTC * 3600000), c = I.sloupce[Math.max(0, i)];
      const uhel0 = (k) => (n === 2 ? [-90, 0, 90, 180][k] : (k + 0.5) * 360 / n);
      // pruhy rozvinu: stěny (a boky destičky) v pořadí kolem hranolu
      const pruhy = rz.pruhy.map((q, k) => ({ x0: q[0], w: q[1], druh: q[2], stena: q[3], uhel: uhel0(k), vzd: n === 2 ? (k % 2 ? W / 2 : T / 2) : W / (2 * Math.tan(Math.PI / n)) }));
      const aktivni = pruhy.find((q) => q.druh === 'stena' && q.stena === c.stena);
      // natočení: normála aktivní stěny míří k vodorovnému azimutu Slunce
      const azS = Math.atan2(s[1], s[0]) / RAD, psi = azS - aktivni.uhel;
      const zavesZ = H;
      for (const q of pruhy) {
        const th = q.uhel + psi, nrm = [cos(th), sin(th), 0], prav = [-sin(th), cos(th), 0];
        const O3 = plus(plus(kr(nrm, q.vzd), kr(prav, -(q.x0 + q.w / 2))), kr(U, zavesZ));
        out.plochy.push({ O3, ex: prav, ey: U, n: nrm, rect: { x0: q.x0, x1: q.x0 + q.w, y0: -H, y1: 0 }, nazev: q.druh + q.stena, aktivni: q === aktivni });
      }
      const F = out.plochy[pruhy.indexOf(aktivni)];
      const otvor = zRoviny(F, [c.xc, -I.otvor]), hrot = plus(otvor, kr(F.n, c.kolik));
      out.gnomony.push({ t: 'kolik', body: [minus(otvor, kr(F.n, Math.min(T, 3))), hrot], r: Math.max(0.4, p.prumerTyce / 2) });
      out.gnomony.push({ t: 'retez', body: [[0, 0, zavesZ], [0, 0, zavesZ + H * 0.6]] });
      out.nodus = hrot;
      out.sloupec = c.nazev;
      if (sviti) {
        const Q = promitni(F, hrot, s);
        if (Q) { const b = doRoviny(F, Q); out.stin = { plocha: pruhy.indexOf(aktivni), body2D: [[c.xc, -I.otvor], b], bod2D: b, bod3D: Q, cara: true }; }
      }
      out.meritko = H * 1.8;
      out.zaves = [0, 0, zavesZ + H * 0.6];
    }
    // podlaha pod nejnižším bodem
    let zmin = Infinity;
    for (const F of out.plochy) for (const q of [[F.rect.x0, F.rect.y0], [F.rect.x1, F.rect.y0], [F.rect.x0, F.rect.y1], [F.rect.x1, F.rect.y1]]) zmin = Math.min(zmin, zRoviny(F, q)[2]);
    for (const g of out.gnomony) for (const b of g.body) zmin = Math.min(zmin, b[2]);
    out.podlaha = typ === 'vodorovne' || typ === 'analematicke' ? -0.5 : zmin - out.meritko * 0.05;
    return out;
  }

  /* ---------------- bokorys s kótami ---------------- */
  function bokorys(R) {
    const p = R.p, I = R.info, typ = p.typ, pr = [];
    const L = (b, s, v, d) => pr.push({ t: 'l', b, s: s || 0.5, v: v || 'hodiny', d });
    const T = (x, y, txt, a, h, u) => pr.push({ t: 'txt', x, y, txt, h: h || 4, a: a || 'c', u: u || 0, v: 'text' });
    // kóta mezi A a B s odsazením off (kolmo vlevo od směru A→B)
    const kota = (A, B, txt, off) => {
      const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * off, ny = dx / l * off;
      const A2 = [A[0] + nx, A[1] + ny], B2 = [B[0] + nx, B[1] + ny];
      L([A, [A2[0] + nx * 0.15, A2[1] + ny * 0.15]], 0.25, 'pomoc'); L([B, [B2[0] + nx * 0.15, B2[1] + ny * 0.15]], 0.25, 'pomoc');
      L([A2, B2], 0.3, 'datum');
      const k = Math.min(2.5, l * 0.2), ux = dx / l, uy = dy / l;
      for (const [P, z] of [[A2, 1], [B2, -1]]) L([[P[0] + (ux * k + uy * k * 0.35) * z, P[1] + (uy * k - ux * k * 0.35) * z], P, [P[0] + (ux * k - uy * k * 0.35) * z, P[1] + (uy * k + ux * k * 0.35) * z]], 0.3, 'datum');
      let u = Math.atan2(dy, dx) / RAD; if (u > 90) u -= 180; if (u < -90) u += 180;
      const sx = (A2[0] + B2[0]) / 2 + nx / Math.abs(off || 1) * 3, sy = (A2[1] + B2[1]) / 2 + ny / Math.abs(off || 1) * 3;
      T(sx, sy, txt, 'c', 3.4, u);
    };
    const oblouk = (S0, r, a0, a1, txt) => {
      const b = []; for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24; b.push([S0[0] + r * cos(a), S0[1] + r * sin(a)]); }
      L(b, 0.3, 'datum'); const am = (a0 + a1) / 2; T(S0[0] + (r + 5) * cos(am), S0[1] + (r + 5) * sin(am), txt, 'c', 3.4);
    };
    const fi = Math.abs(p.sirka), h = I.vyskaNodu;
    // měřítko kresby: největší rozměr ~ 120 jednotek
    if (typ === 'vodorovne') {
      const psi = I.vyskaStylu, Lb = h / tan(psi), k = 110 / Math.max(Lb, h, 1);
      const C = [0, 0], O = [Lb * k, 0], G = [Lb * k, h * k], ext = 15;
      L([[-ext, 0], [O[0] + ext * 2, 0]], 0.8, 'obrys'); T(O[0] + ext * 2, -14, 'sever →', 'r', 3.4); T(-ext, 4, 'deska ciferníku', 'l', 3.2);
      pr.push({ t: 'p', b: [C, O, G], v: 'vypln', f: true });
      L([C, O, G, C], 0.6, 'hodiny');
      pr.push({ t: 'k', x: G[0], y: G[1], r: 1.6, s: 0.4, v: 'stinbod', f: true });
      T(G[0] + 3, G[1] + 3, 'nodus', 'l', 3.4);
      oblouk(C, Math.min(30, O[0] * 0.5), 0, psi, f1(psi) + '°');
      kota(O, G, 'h = ' + f1(h) + ' mm', -8);
      kota(C, O, f1(Lb) + ' mm', -7);
      const d = 40; L([G, [G[0] + d * cos(psi), G[1] + d * sin(psi)]], 0.3, 'pomoc', true);
      T(G[0] + d * cos(psi) + 2, G[1] + d * sin(psi) + 2, 'k nebeskému pólu', 'l', 3.2);
      T(-ext, -24, 'Gnomon stojí kolmo na desce v poledníku; styl míří k pólu pod úhlem = zem. šířka.', 'l', 3.2);
    } else if (typ === 'svisle' || typ === 'deklinujici') {
      const psi = I.vyskaStylu, Lb = h / tan(psi), k = 110 / Math.max(Lb, h, 1);
      const C = [0, Lb * k], O = [0, 0], G = [h * k, 0], ext = 15;
      L([[0, -ext * 2], [0, C[1] + ext]], 0.8, 'obrys'); T(-3, C[1] + ext - 3, 'stěna', 'r', 3.4);
      pr.push({ t: 'p', b: [C, O, G], v: 'vypln', f: true });
      L([C, O, G, C], 0.6, 'hodiny');
      pr.push({ t: 'k', x: G[0], y: G[1], r: 1.6, s: 0.4, v: 'stinbod', f: true });
      T(G[0] + 3, G[1] - 4, 'nodus', 'l', 3.4);
      oblouk(C, Math.min(30, C[1] * 0.4), -90, -90 + psi, f1(psi) + '°');
      kota(O, G, 'h = ' + f1(h) + ' mm', -8);
      kota(C, O, f1(Lb) + ' mm', 8);
      const d = 30, lg = Math.hypot(G[0] - C[0], G[1] - C[1]) || 1; L([G, [G[0] + (G[0] - C[0]) / lg * d, G[1] + (G[1] - C[1]) / lg * d]], 0.3, 'pomoc', true);
      T(G[0] + (G[0] - C[0]) / lg * d + 2, G[1] + (G[1] - C[1]) / lg * d - 3, 'k pólu', 'l', 3.2);
      T(G[0] + 6, C[1] * 0.6, typ === 'svisle' ? 'jih →' : 'ven ze stěny →', 'l', 3.4);
      T(-ext - 20, -ext * 2 - 8, 'Gnomon stojí kolmo ke stěně podél podstylu; styl je rovnoběžný se zemskou osou.', 'l', 3.2);
    } else if (typ === 'polarni') {
      const k = 100 / Math.max(h * 3, 1), dl = 100;
      const A = [0, 0], B = [dl * cos(fi), dl * sin(fi)];
      L([[-10, 0], [dl * cos(fi) + 30, 0]], 0.5, 'pomoc'); T(dl * cos(fi) + 30, -5, 'sever →', 'r', 3.4);
      L([A, B], 1, 'obrys'); T(B[0] * 0.5 + 6, B[1] * 0.5 - 6, 'deska (rovnoběžně s osou Země)', 'l', 3.2, fi);
      const nx = -sin(fi), ny = cos(fi), hh = Math.max(10, h * k);
      const A2 = [A[0] + nx * hh, A[1] + ny * hh], B2 = [B[0] + nx * hh, B[1] + ny * hh];
      L([A2, B2], 1.4, 'hodiny'); T((A2[0] + B2[0]) / 2 - 4, (A2[1] + B2[1]) / 2 + 4, 'styl', 'r', 3.4);
      L([[A[0] + B[0] * 0.2, A[1] + B[1] * 0.2], [A2[0] + B[0] * 0.2, A2[1] + B[1] * 0.2]], 0.5, 'hodiny');
      L([[A[0] + B[0] * 0.8, A[1] + B[1] * 0.8], [A2[0] + B[0] * 0.8, A2[1] + B[1] * 0.8]], 0.5, 'hodiny');
      oblouk(A, 25, 0, fi, f1(fi) + '°');
      kota([B[0] * 0.8, B[1] * 0.8], [A2[0] + B[0] * 0.8, A2[1] + B[1] * 0.8], 'h = ' + f1(h) + ' mm', 8);
    } else if (typ === 'ekvatorialni') {
      const S0 = [60, 50], R0 = 45, ad = fi - 90;
      // deska kolmo na osu, tyč podél osy
      L([[S0[0] - R0 * cos(ad), S0[1] - R0 * sin(ad)], [S0[0] + R0 * cos(ad), S0[1] + R0 * sin(ad)]], 1.6, 'obrys');
      const hk = Math.min(40, Math.max(12, h)), ux = cos(fi), uy = sin(fi);
      // pozor: osa míří k severu nahoru (vpravo nahoru), deska kolmo
      L([[S0[0] - uy * 0 - ux * hk * 1.5, S0[1] - uy * hk * 1.5], [S0[0] + ux * hk * 1.5, S0[1] + uy * hk * 1.5]], 0.8, 'hodiny');
      for (const z of [1, -1]) pr.push({ t: 'k', x: S0[0] + z * ux * hk, y: S0[1] + z * uy * hk, r: 1.6, s: 0.4, v: 'stinbod', f: true });
      L([[0, 0], [130, 0]], 0.5, 'pomoc'); T(130, -5, 'sever →', 'r', 3.4);
      oblouk(S0, 18, 0, fi, 'osa ' + f1(fi) + '°');
      L([S0, [S0[0] + 30, S0[1]]], 0.25, 'pomoc', true);
      kota(S0, [S0[0] + ux * hk, S0[1] + uy * hk], 'nodus ' + f1(h) + ' mm', 7);
      T(S0[0] + R0 * cos(ad) + 3, S0[1] + R0 * sin(ad) - 3, 'deska: strana A nahoře, B dole', 'l', 3.2);
      T(0, -12, 'Deska je rovnoběžná s rovníkem (skloněná o ' + f1(90 - fi) + '°), tyč míří k pólu.', 'l', 3.2);
    } else if (typ === 'analematicke') {
      const hg = R.analema.vyskaGnomonu, k = 70 / Math.max(hg, 1), M = R.analema.M;
      const sir = 120;
      L([[0, 0], [sir, 0]], 1, 'obrys'); T(sir, -5, 'sever →', 'r', 3.4);
      const dy = M * Math.cos(fi * RAD) * Math.tan(23.44 * RAD), kk = sir * 0.35 / Math.max(M, 1);
      L([[sir / 2 - dy * kk, -1.5], [sir / 2 + dy * kk, -1.5]], 2.2, 'datum'); T(sir / 2, -7, 'datová stupnice (zima ← → léto)', 'c', 3.2);
      L([[sir / 2 + dy * kk * 0.5, 0], [sir / 2 + dy * kk * 0.5, hg * k]], 1.4, 'hodiny');
      kota([sir / 2 + dy * kk * 0.5, 0], [sir / 2 + dy * kk * 0.5, hg * k], 'gnomon ' + f1(hg) + ' mm', -8);
      T(0, hg * k + 6, 'Svislý gnomon (tyč nebo člověk) se posouvá po stupnici podle data.', 'l', 3.2);
    } else if (typ === 'kapesni') {
      const rz = I.rozvin, H = rz.vyska, Lk = I.vyskaNodu, k = 100 / Math.max(H, Lk * 2.2), ho = I.otvor;
      const hS = Math.max(...I.sloupce.flatMap((c) => c.znacky.map((z) => z.h)), 30);
      const tl = (rz.steny === 2 ? rz.T : rz.W) * k, x0 = 20;
      L([[x0, 0], [x0 + tl, 0], [x0 + tl, H * k], [x0, H * k], [x0, 0]], 0.8, 'obrys');
      L([[x0 + tl / 2, H * k], [x0 + tl / 2, H * k + 18]], 0.4, 'pomoc', true); T(x0 + tl / 2 + 3, H * k + 14, 'řetízek', 'l', 3.2);
      const yo = (H - ho) * k, hrot = [x0 + tl + Lk * k, yo];
      L([[x0 + tl, yo], hrot], 1.3, 'hodiny');
      // sluneční paprsek přes hrot kolíku na stěnu
      const d = Lk * Math.tan(hS * RAD) * k, Q = [x0 + tl, yo - d];
      L([[hrot[0] + 30 * cos(hS), hrot[1] + 30 * sin(hS)], Q], 0.5, 'stinbod', true);
      T(hrot[0] + 30 * cos(hS) + 2, hrot[1] + 30 * sin(hS), 'paprsek, h = ' + f1(hS) + '°', 'l', 3.2);
      pr.push({ t: 'k', x: Q[0], y: Q[1], r: 1.2, s: 0, v: 'stinbod', f: true });
      kota([x0 + tl, yo], hrot, 'L = ' + f1(Lk) + ' mm', 7);
      kota([x0, yo], [x0, Q[1]], 'd = L · tan h = ' + f1(Lk * Math.tan(hS * RAD)) + ' mm', -7);
      oblouk(hrot, 12, 180, 180 + hS, '');
      T(0, -10, 'Hranol visí svisle, stěnou ke Slunci; kolík je vodorovný a stín jeho hrotu padá svisle dolů.', 'l', 3.2);
    }
    return SH._naPapir ? SH._naPapir(pr) : obalka(pr);
  }
  /** jednoduchá obálka a převod na papír (y dolů) */
  function obalka(pr) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const out = pr.map((e) => {
      const f = Object.assign({}, e);
      if (e.b) { f.b = e.b.map((q) => [q[0], -q[1]]); for (const q of f.b) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); } }
      if (e.t === 'k' || e.t === 'txt') {
        f.y = -e.y;
        const w = e.t === 'txt' ? SH.sirkaTextu(e.txt, e.h) : e.r, xa = e.t === 'txt' ? (e.a === 'l' ? f.x : e.a === 'r' ? f.x - w : f.x - w / 2) : f.x - w, xb = e.t === 'txt' ? xa + w : f.x + w;
        x0 = Math.min(x0, xa); x1 = Math.max(x1, xb); y0 = Math.min(y0, f.y - (e.h || e.r)); y1 = Math.max(y1, f.y + (e.h || e.r));
      }
      return f;
    });
    return { prvky: out, x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  const API = { sestava, bokorys, promitni, zRoviny, doRoviny, draha };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SHP = API;
})(typeof window !== 'undefined' ? window : globalThis);
