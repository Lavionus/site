/* ============================================================
   Písmolijna – jadro/krivky.js
   Geometrie obrysů: segmenty, obálka, plocha a směr, zploštění,
   dělení a proložení kubik, převod kubika ↔ kvadratika, extrémy,
   zjednodušení, cesta SVG ↔ obrysy, vykreslení na plátno.
   Bod obrysu: {x, y, t: 'l'|'c'|'o', s: hladký}. Bez DOM.
   ============================================================ */
(function (G) {
  'use strict';
  const P = G.PSL || (G.PSL = {});

  const bod = (x, y) => ({ x, y });
  const naBod = (p, t) => ({ x: p.x, y: p.y, t: t, s: false });

  /* ---------- segmenty ----------
     Vrací [{typ:'l'|'c', p0, p1, p2, p3, i0, i3}] – u úsečky jen p0, p3.
     i0/i3 jsou indexy bodů na křivce v poli body. */
  P.segmenty = function (obrys) {
    const b = obrys.body, n = b.length, out = [];
    if (n < 2) return out;
    let start = -1;
    if (obrys.otevreny) start = 0;
    else for (let i = 0; i < n; i++) if (b[i].t !== 'o') { start = i; break; }
    if (start < 0) return out;   // samé řídicí body – neplatný obrys
    const kroku = obrys.otevreny ? n - 1 : n;
    let i = start, prosto = 0;
    while (prosto < kroku) {
      const p0 = b[i];
      let j = (i + 1) % n, ridici = [];
      prosto++;
      while (b[j].t === 'o' && prosto < kroku) { ridici.push(b[j]); j = (j + 1) % n; prosto++; }
      if (obrys.otevreny && j < i) break;
      const p3 = b[j];
      if (b[j].t === 'o') break;   // obrys končí řídicím bodem
      if (ridici.length === 0) out.push({ typ: 'l', p0, p3, i0: i, i3: j });
      else if (ridici.length === 2) out.push({ typ: 'c', p0, p1: ridici[0], p2: ridici[1], p3, i0: i, i3: j });
      else if (ridici.length === 1) {   // kvadratika → přesná kubika
        const q = ridici[0];
        out.push({ typ: 'c', p0, p1: bod(p0.x + 2 / 3 * (q.x - p0.x), p0.y + 2 / 3 * (q.y - p0.y)),
          p2: bod(p3.x + 2 / 3 * (q.x - p3.x), p3.y + 2 / 3 * (q.y - p3.y)), p3, i0: i, i3: j });
      } else {   // víc řídicích bodů: TrueType řetěz kvadratik s implicitními body
        let a = p0;
        for (let k = 0; k < ridici.length; k++) {
          const q = ridici[k];
          const e = k + 1 < ridici.length ? bod((q.x + ridici[k + 1].x) / 2, (q.y + ridici[k + 1].y) / 2) : p3;
          out.push({ typ: 'c', p0: a, p1: bod(a.x + 2 / 3 * (q.x - a.x), a.y + 2 / 3 * (q.y - a.y)),
            p2: bod(e.x + 2 / 3 * (q.x - e.x), e.y + 2 / 3 * (q.y - e.y)), p3: e, i0: i, i3: j });
          a = e;
        }
      }
      i = j;
    }
    return out;
  };

  /* Normalizuje obrys: kvadratiky a řetězy řídicích bodů převede na kubiky (t='c' po dvou 'o'). */
  P.normalizujObrys = function (obrys) {
    const seg = P.segmenty(obrys);
    if (!seg.length) return obrys;
    const body = [];
    const prvni = seg[0].p0;
    if (obrys.otevreny) body.push(naBod(prvni, 'l'));
    for (const s of seg) {
      if (s.typ === 'c') { body.push(naBod(s.p1, 'o'), naBod(s.p2, 'o')); }
      const kon = naBod(s.p3, s.typ === 'c' ? 'c' : 'l');
      if (s.p3.s) kon.s = true;
      body.push(kon);
    }
    if (!obrys.otevreny && body.length > 1) {
      // poslední bod je zase první – přesunout ho na začátek
      const p = body.pop(); body.unshift(p);
      p.s = !!prvni.s;
    }
    const r = { body };
    if (obrys.otevreny) r.otevreny = true;
    return r;
  };

  /* Obrácení pořadí bodů se zachováním typů segmentů. */
  P.obratBody = function (body, otevreny) {
    const n = body.length;
    const rev = body.slice().reverse().map(b => Object.assign({}, b));
    for (let i = 0; i < n; i++) {
      if (rev[i].t === 'o') continue;
      const pred = rev[(i - 1 + n) % n];
      rev[i].t = (otevreny && i === 0) ? 'l' : (pred.t === 'o' ? 'c' : 'l');
    }
    return rev;
  };
  P.obratObrys = function (o) { o.body = P.obratBody(o.body, o.otevreny); return o; };

  /* ---------- body na kubice ---------- */
  P.kubika = function (p0, p1, p2, p3, t) {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return bod(a * p0.x + b * p1.x + c * p2.x + d * p3.x, a * p0.y + b * p1.y + c * p2.y + d * p3.y);
  };
  P.derivaceKubiky = function (p0, p1, p2, p3, t) {
    const u = 1 - t;
    return bod(3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
      3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y));
  };
  /* de Casteljau – vrací [[p0,a,b,m],[m,c,d,p3]] */
  P.rozdelKubiku = function (p0, p1, p2, p3, t) {
    const l = (a, b) => bod(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    const a = l(p0, p1), b = l(p1, p2), c = l(p2, p3), d = l(a, b), e = l(b, c), m = l(d, e);
    return [[p0, a, d, m], [m, e, c, p3]];
  };

  /* Kořeny derivace v (0,1) pro jednu souřadnici – extrémy. */
  function extremyT(a, b, c, d) {
    const A = -a + 3 * b - 3 * c + d, B = 2 * (a - 2 * b + c), C = b - a, r = [];
    if (Math.abs(A) < 1e-12) { if (Math.abs(B) > 1e-12) r.push(-C / B); }
    else {
      const D = B * B - 4 * A * C;
      if (D >= 0) { const s = Math.sqrt(D); r.push((-B + s) / (2 * A), (-B - s) / (2 * A)); }
    }
    return r.filter(t => t > 1e-6 && t < 1 - 1e-6);
  }
  P.extremyKubiky = function (s) {
    return extremyT(s.p0.x, s.p1.x, s.p2.x, s.p3.x).concat(extremyT(s.p0.y, s.p1.y, s.p2.y, s.p3.y)).sort((a, b) => a - b);
  };

  /* ---------- obálka ---------- */
  P.obalkaObrysu = function (obrysy) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const pridej = p => { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; };
    for (const o of obrysy) {
      for (const s of P.segmenty(o)) {
        pridej(s.p0); pridej(s.p3);
        if (s.typ === 'c') for (const t of P.extremyKubiky(s)) pridej(P.kubika(s.p0, s.p1, s.p2, s.p3, t));
      }
      if (o.body.length === 1) pridej(o.body[0]);
    }
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  };
  /* Obálka všech bodů včetně řídicích (rychlá, pro výběr). */
  P.obalkaBodu = function (body) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of body) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  };

  /* ---------- zploštění ---------- */
  function plochost(p0, p1, p2, p3) {
    const ux = 3 * p1.x - 2 * p0.x - p3.x, uy = 3 * p1.y - 2 * p0.y - p3.y;
    const vx = 3 * p2.x - p0.x - 2 * p3.x, vy = 3 * p2.y - p0.y - 2 * p3.y;
    return Math.max(ux * ux, vx * vx) + Math.max(uy * uy, vy * vy);   // 16 × kvadrát odchylky
  }
  function zplostiKubiku(p0, p1, p2, p3, tol2, out, h) {
    if (h > 16 || plochost(p0, p1, p2, p3) <= 16 * tol2) { out.push(bod(p3.x, p3.y)); return; }
    const [a, b] = P.rozdelKubiku(p0, p1, p2, p3, 0.5);
    zplostiKubiku(a[0], a[1], a[2], a[3], tol2, out, h + 1);
    zplostiKubiku(b[0], b[1], b[2], b[3], tol2, out, h + 1);
  }
  /* Obrys → mnohoúhelník [{x,y}] (bez opakování prvního bodu). tol v jednotkách em. */
  P.zplostni = function (obrys, tol) {
    const t2 = (tol || 0.5) * (tol || 0.5), out = [];
    const seg = P.segmenty(obrys);
    if (!seg.length) return obrys.body.filter(b => b.t !== 'o').map(b => bod(b.x, b.y));
    out.push(bod(seg[0].p0.x, seg[0].p0.y));
    for (const s of seg) {
      if (s.typ === 'l') out.push(bod(s.p3.x, s.p3.y));
      else zplostiKubiku(s.p0, s.p1, s.p2, s.p3, t2, out, 0);
    }
    if (!obrys.otevreny && out.length > 1) {
      const a = out[0], z = out[out.length - 1];
      if (Math.abs(a.x - z.x) < 1e-9 && Math.abs(a.y - z.y) < 1e-9) out.pop();
    }
    return out;
  };

  /* ---------- plocha a směr ---------- */
  P.plochaMnohouhelniku = function (pts) {
    let a = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
  };
  /* Kladná = proti směru hodinových ručiček (y nahoru). */
  P.plochaObrysu = function (obrys) { return P.plochaMnohouhelniku(P.zplostni(obrys, 0.25)); };
  P.poSmeru = function (obrys) { return P.plochaObrysu(obrys) < 0; };

  P.bodVMnohouhelniku = function (pts, x, y) {   // pravidlo nenulového vinutí
    let w = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      if (a.y <= y) { if (b.y > y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) > 0) w++; }
      else if (b.y <= y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) < 0) w--;
    }
    return w !== 0;
  };

  /* Vnější obrysy po směru hodinových ručiček, díry proti (podle hloubky vnoření).
     Vrací počet obrácených obrysů. */
  P.opravSmer = function (obrysy) {
    const pol = obrysy.map(o => P.zplostni(o, 0.5));
    const uz = obrysy.map((o, i) => (!o.otevreny && pol[i].length > 2) ? i : -1).filter(i => i >= 0);
    let obraceno = 0;
    obrysy.forEach((o, i) => {
      if (o.otevreny || pol[i].length < 3) return;
      const chciPoSmeru = P.hloubkaVnoreni(pol, uz, i) % 2 === 0;
      if (P.plochaMnohouhelniku(pol[i]) < 0 !== chciPoSmeru) { P.obratObrys(o); obraceno++; }
    });
    return obraceno;
  };
  /* Hloubka vnoření mnohoúhelníku pols[i] mezi pols[uz] (kolik ho jich obklopuje; stačí parita).
     Jediný bod těsně za hranou selže, když po té hraně vede i jiný (dotýkající se) obrys –
     proto hlasuje víc bodů u nejdelších hran ve dvou vzdálenostech; platí jen body uvnitř pols[i]. */
  P.hloubkaVnoreni = function (pols, uz, i) {
    const pol = pols[i], n = pol.length, ccw = P.plochaMnohouhelniku(pol) > 0;
    const hloubkaBodu = (x, y) => { let hl = 0; for (const j of uz) if (j !== i && P.bodVMnohouhelniku(pols[j], x, y)) hl++; return hl; };
    const hrany = [];
    for (let k = 0; k < n; k++) { const a = pol[k], b = pol[(k + 1) % n]; hrany.push({ a, b, L: Math.hypot(b.x - a.x, b.y - a.y) }); }
    hrany.sort((p, q) => q.L - p.L);
    let lichych = 0, sudych = 0;
    for (const h of hrany.slice(0, 6)) {
      if (h.L < 1e-6) continue;
      const nx = -(h.b.y - h.a.y) / h.L, ny = (h.b.x - h.a.x) / h.L;
      for (const t of [0.5, 0.3, 0.7]) for (const d of [0.5, Math.min(3, h.L / 4)]) {
        const x = h.a.x + (h.b.x - h.a.x) * t + nx * (ccw ? d : -d), y = h.a.y + (h.b.y - h.a.y) * t + ny * (ccw ? d : -d);
        if (!P.bodVMnohouhelniku(pol, x, y)) continue;
        if (hloubkaBodu(x, y) % 2) lichych++; else sudych++;
      }
    }
    if (!lichych && !sudych) { const vz = vnitrniBod(pol); return hloubkaBodu(vz.x, vz.y); }
    return lichych > sudych ? 1 : 0;
  };

  function vnitrniBod(pol) {
    // střed nejdelší hrany posunutý dovnitř o kousek (podle orientace)
    const ccw = P.plochaMnohouhelniku(pol) > 0;
    let best = 0, bi = 0;
    for (let i = 0; i < pol.length; i++) {
      const a = pol[i], b = pol[(i + 1) % pol.length];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d > best) { best = d; bi = i; }
    }
    const a = pol[bi], b = pol[(bi + 1) % pol.length];
    const nx = -(b.y - a.y) / best, ny = (b.x - a.x) / best, k = ccw ? 0.5 : -0.5;
    return bod((a.x + b.x) / 2 + nx * k, (a.y + b.y) / 2 + ny * k);
  }
  P.vnitrniBod = vnitrniBod;

  /* ---------- nejbližší bod na segmentu ---------- */
  P.nejblizsiNaSegmentu = function (s, x, y) {
    if (s.typ === 'l') {
      const dx = s.p3.x - s.p0.x, dy = s.p3.y - s.p0.y, L = dx * dx + dy * dy;
      let t = L ? ((x - s.p0.x) * dx + (y - s.p0.y) * dy) / L : 0;
      t = Math.max(0, Math.min(1, t));
      const px = s.p0.x + dx * t, py = s.p0.y + dy * t;
      return { t, x: px, y: py, d: Math.hypot(px - x, py - y) };
    }
    let best = { t: 0, d: Infinity };
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = P.kubika(s.p0, s.p1, s.p2, s.p3, t), d = Math.hypot(p.x - x, p.y - y);
      if (d < best.d) best = { t, x: p.x, y: p.y, d };
    }
    // zjemnění půlením intervalu
    let krok = 1 / N;
    for (let k = 0; k < 20; k++) {
      krok /= 2;
      for (const t of [best.t - krok, best.t + krok]) {
        if (t < 0 || t > 1) continue;
        const p = P.kubika(s.p0, s.p1, s.p2, s.p3, t), d = Math.hypot(p.x - x, p.y - y);
        if (d < best.d) best = { t, x: p.x, y: p.y, d };
      }
    }
    return best;
  };

  /* Vloží bod na křivce do segmentu (index v P.segmenty) v parametru t.
     Vrací index nového bodu v poli body. */
  P.vlozBod = function (obrys, iSeg, t) {
    const seg = P.segmenty(obrys)[iSeg];
    if (!seg) return -1;
    const b = obrys.body, n = b.length;
    if (seg.typ === 'l') {
      const nb = { x: seg.p0.x + (seg.p3.x - seg.p0.x) * t, y: seg.p0.y + (seg.p3.y - seg.p0.y) * t, t: 'l', s: false };
      const kam = seg.i3 === 0 && !obrys.otevreny ? n : seg.i3;
      b.splice(kam, 0, nb);
      return kam;
    }
    const [a, c] = P.rozdelKubiku(seg.p0, seg.p1, seg.p2, seg.p3, t);
    // nahradit dva řídicí body: a1 a2 m c1 c2
    const i1 = (seg.i0 + 1) % n, i2 = (seg.i0 + 2) % n;
    const nove = [naBod(a[1], 'o'), naBod(a[2], 'o'), Object.assign(naBod(a[3], 'c'), { s: true }), naBod(c[1], 'o'), naBod(c[2], 'o')];
    if (i2 > i1) {
      b.splice(i1, 2, ...nove);
      return i1 + 2;
    }
    // řídicí body přes konec pole (i1 = n-1, i2 = 0)
    b.splice(n - 1, 1); b.splice(0, 1);
    b.push(...nove);
    return b.length - 3;
  };

  /* Rozdělí obrysy na úsečky a kubiky; každý obrys vrátí jako pole segmentů
     s kopiemi bodů – pohodlné pro operace, které tvoří nové obrysy. */
  P.zeSegmentu = function (segs, otevreny) {
    const body = [];
    if (!segs.length) return { body };
    if (otevreny) body.push(naBod(segs[0].p0, 'l'));
    for (const s of segs) {
      if (s.typ === 'c') body.push(naBod(s.p1, 'o'), naBod(s.p2, 'o'), naBod(s.p3, 'c'));
      else body.push(naBod(s.p3, 'l'));
    }
    const r = { body };
    if (otevreny) r.otevreny = true;
    else if (body.length > 1) body.unshift(body.pop());
    P.urciHladkost(r);
    return r;
  };

  /* Hladký = tečny na obou stranách bodu na křivce jsou rovnoběžné. */
  P.urciHladkost = function (obrys, tolStupne) {
    const b = obrys.body, n = b.length, tol = Math.sin((tolStupne || 2) * Math.PI / 180);
    for (let i = 0; i < n; i++) {
      if (b[i].t === 'o') continue;
      if (obrys.otevreny && (i === 0 || i === n - 1)) { b[i].s = false; continue; }
      const p = b[(i - 1 + n) % n], q = b[(i + 1) % n];
      if (p.t !== 'o' && q.t !== 'o') { b[i].s = false; continue; }
      const ax = b[i].x - p.x, ay = b[i].y - p.y, bx = q.x - b[i].x, by = q.y - b[i].y;
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < 1e-9 || lb < 1e-9) { b[i].s = false; continue; }
      b[i].s = Math.abs(ax * by - ay * bx) / (la * lb) < tol && ax * bx + ay * by > 0;
    }
    return obrys;
  };

  /* ---------- extrémy, zaokrouhlení, zjednodušení ---------- */
  /* Vloží body do míst, kde má kubika vodorovnou/svislou tečnu. */
  P.pridejExtremy = function (obrys) {
    let pridano = 0;
    for (let guard = 0; guard < 500; guard++) {
      const seg = P.segmenty(obrys);
      let hotovo = true;
      for (let i = 0; i < seg.length; i++) {
        const s = seg[i];
        if (s.typ !== 'c') continue;
        const ts = P.extremyKubiky(s).filter(t => t > 0.02 && t < 0.98);
        if (!ts.length) continue;
        // jen extrém, který vybočuje mimo koncové body o víc než 0,5 jednotky
        const t = ts[0], p = P.kubika(s.p0, s.p1, s.p2, s.p3, t);
        const lo = (a, b) => Math.min(a, b) - 0.5, hi = (a, b) => Math.max(a, b) + 0.5;
        const venku = p.x < lo(s.p0.x, s.p3.x) || p.x > hi(s.p0.x, s.p3.x) || p.y < lo(s.p0.y, s.p3.y) || p.y > hi(s.p0.y, s.p3.y);
        if (!venku) continue;
        P.vlozBod(obrys, i, t); pridano++; hotovo = false; break;
      }
      if (hotovo) break;
    }
    return pridano;
  };

  P.zaokrouhli = function (obrys, krok) {
    const k = krok || 1;
    for (const b of obrys.body) { b.x = Math.round(b.x / k) * k; b.y = Math.round(b.y / k) * k; }
  };

  /* Odstraní nadbytečné body: dvojice totožných bodů, body uprostřed přímky,
     a kubiky, jejichž řídicí body leží na úsečce (→ úsečka). */
  P.vycisti = function (obrys, tol) {
    const t = tol == null ? 0.5 : tol;
    let o = P.normalizujObrys(obrys);
    let seg = P.segmenty(o);
    // kubika s řídicími body na spojnici → úsečka
    seg = seg.map(s => {
      if (s.typ !== 'c') return s;
      if (vzdalOdPrimky(s.p1, s.p0, s.p3) < t && vzdalOdPrimky(s.p2, s.p0, s.p3) < t && mezi(s.p1, s.p0, s.p3) && mezi(s.p2, s.p0, s.p3)) return { typ: 'l', p0: s.p0, p3: s.p3 };
      return s;
    });
    // nulové segmenty
    seg = seg.filter(s => Math.hypot(s.p3.x - s.p0.x, s.p3.y - s.p0.y) > 1e-6 || (s.typ === 'c' && (Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y) > t || Math.hypot(s.p2.x - s.p0.x, s.p2.y - s.p0.y) > t)));
    // sousední úsečky na jedné přímce
    let zmena = true;
    while (zmena && seg.length > 2) {
      zmena = false;
      for (let i = 0; i < seg.length; i++) {
        if (obrys.otevreny && i === seg.length - 1) break;
        const a = seg[i], b = seg[(i + 1) % seg.length];
        if (a.typ === 'l' && b.typ === 'l' && vzdalOdPrimky(a.p3, a.p0, b.p3) < t * 0.5 && mezi(a.p3, a.p0, b.p3)) {
          const nove = { typ: 'l', p0: a.p0, p3: b.p3 };
          if (i + 1 < seg.length) seg.splice(i, 2, nove); else { seg.splice(i, 1); seg[0] = nove; }
          zmena = true; break;
        }
      }
    }
    const hl = new Map();
    for (const b of obrys.body) if (b.t !== 'o') hl.set(b.x + ',' + b.y, b.s);
    const r = P.zeSegmentu(seg, obrys.otevreny);
    for (const b of r.body) if (b.t !== 'o' && hl.has(b.x + ',' + b.y)) b.s = hl.get(b.x + ',' + b.y) && b.s;
    obrys.body = r.body;
    return obrys;
  };
  function vzdalOdPrimky(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    if (L < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / L;
  }
  function mezi(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    if (L < 1e-9) return true;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L;
    return t >= -1e-6 && t <= 1 + 1e-6;
  }
  P.vzdalOdPrimky = vzdalOdPrimky;

  /* ---------- kubika → kvadratiky (pro TrueType) ----------
     Vrací pole kvadratik [{c:{x,y}, p:{x,y}}] začínající v p0. */
  P.kubikaNaKvadratiky = function (p0, p1, p2, p3, tol) {
    const out = [], t2 = (tol || 0.5);
    (function rek(a, b, c, d, h) {
      // řídicí bod kvadratiky = průměr dvou odhadů
      const q = bod((3 * (b.x + c.x) - a.x - d.x) / 4, (3 * (b.y + c.y) - a.y - d.y) / 4);
      // chyba: odchylka ve vzorcích
      let err = 0;
      for (const t of [0.25, 0.5, 0.75]) {
        const k = P.kubika(a, b, c, d, t), u = 1 - t;
        const qx = u * u * a.x + 2 * u * t * q.x + t * t * d.x, qy = u * u * a.y + 2 * u * t * q.y + t * t * d.y;
        err = Math.max(err, Math.hypot(k.x - qx, k.y - qy));
      }
      if (err <= t2 || h > 10) { out.push({ c: q, p: bod(d.x, d.y) }); return; }
      const [l, r] = P.rozdelKubiku(a, b, c, d, 0.5);
      rek(l[0], l[1], l[2], l[3], h + 1); rek(r[0], r[1], r[2], r[3], h + 1);
    })(p0, p1, p2, p3, 0);
    return out;
  };

  /* ---------- proložení bodů kubikami (Schneider 1990) ----------
     pts: [{x,y}] (otevřená lomená čára), chyba v jednotkách em.
     Vrací segmenty [{typ:'c', p0,p1,p2,p3}]. */
  P.prolozKrivkami = function (pts, chyba) {
    const e2 = (chyba || 2) * (chyba || 2);
    const v = [];
    for (const p of pts) if (!v.length || Math.hypot(p.x - v[v.length - 1].x, p.y - v[v.length - 1].y) > 1e-6) v.push(p);
    if (v.length < 2) return [];
    if (v.length === 2) return [primka(v[0], v[1])];
    const out = [];
    const t1 = norm(sub(v[1], v[0])), t2 = norm(sub(v[v.length - 2], v[v.length - 1]));
    fitCubic(v, 0, v.length - 1, t1, t2, e2, out, 0);
    return out;
  };
  function sub(a, b) { return bod(a.x - b.x, a.y - b.y); }
  function add(a, b) { return bod(a.x + b.x, a.y + b.y); }
  function mul(a, k) { return bod(a.x * k, a.y * k); }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function norm(a) { const l = Math.hypot(a.x, a.y) || 1; return bod(a.x / l, a.y / l); }
  function primka(a, b) {
    const d = Math.hypot(b.x - a.x, b.y - a.y) / 3, t = norm(sub(b, a));
    return { typ: 'c', p0: a, p1: add(a, mul(t, d)), p2: sub(b, mul(t, d)), p3: b };
  }
  function fitCubic(d, first, last, tHat1, tHat2, e2, out, hloubka) {
    const n = last - first + 1;
    if (n === 2) {
      const dist = Math.hypot(d[last].x - d[first].x, d[last].y - d[first].y) / 3;
      out.push({ typ: 'c', p0: d[first], p1: add(d[first], mul(tHat1, dist)), p2: add(d[last], mul(tHat2, dist)), p3: d[last] });
      return;
    }
    let u = chordLength(d, first, last);
    let bez = generateBezier(d, first, last, u, tHat1, tHat2);
    let [maxErr, split] = maxError(d, first, last, bez, u);
    if (maxErr < e2) { out.push(bez); return; }
    if (maxErr < e2 * 16) {
      for (let i = 0; i < 6; i++) {
        u = reparam(d, first, last, u, bez);
        bez = generateBezier(d, first, last, u, tHat1, tHat2);
        [maxErr, split] = maxError(d, first, last, bez, u);
        if (maxErr < e2) { out.push(bez); return; }
      }
    }
    if (hloubka > 40) { out.push(bez); return; }
    split = Math.max(first + 1, Math.min(last - 1, split));
    let tc = norm(sub(d[split - 1], d[split + 1]));
    fitCubic(d, first, split, tHat1, tc, e2, out, hloubka + 1);
    fitCubic(d, split, last, mul(tc, -1), tHat2, e2, out, hloubka + 1);
  }
  function chordLength(d, first, last) {
    const u = [0];
    for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1] + Math.hypot(d[i].x - d[i - 1].x, d[i].y - d[i - 1].y));
    const L = u[u.length - 1] || 1;
    return u.map(x => x / L);
  }
  function generateBezier(d, first, last, u, t1, t2) {
    const p0 = d[first], p3 = d[last];
    let C00 = 0, C01 = 0, C11 = 0, X0 = 0, X1 = 0;
    for (let i = 0; i < u.length; i++) {
      const t = u[i], s = 1 - t;
      const b1 = 3 * t * s * s, b2 = 3 * t * t * s, b0 = s * s * s, b3 = t * t * t;
      const A1 = mul(t1, b1), A2 = mul(t2, b2);
      C00 += dot(A1, A1); C01 += dot(A1, A2); C11 += dot(A2, A2);
      const tmp = sub(d[first + i], add(add(mul(p0, b0), mul(p0, b1)), add(mul(p3, b2), mul(p3, b3))));
      X0 += dot(A1, tmp); X1 += dot(A2, tmp);
    }
    const det = C00 * C11 - C01 * C01;
    let a1 = 0, a2 = 0;
    if (Math.abs(det) > 1e-12) { a1 = (X0 * C11 - X1 * C01) / det; a2 = (C00 * X1 - C01 * X0) / det; }
    const segLen = Math.hypot(p3.x - p0.x, p3.y - p0.y), eps = 1e-6 * segLen;
    if (a1 < eps || a2 < eps || a1 > segLen * 3 || a2 > segLen * 3) { a1 = a2 = segLen / 3; }
    return { typ: 'c', p0, p1: add(p0, mul(t1, a1)), p2: add(p3, mul(t2, a2)), p3 };
  }
  function maxError(d, first, last, b, u) {
    let max = 0, split = Math.floor((last - first + 1) / 2) + first;
    for (let i = first + 1; i < last; i++) {
      const p = P.kubika(b.p0, b.p1, b.p2, b.p3, u[i - first]);
      const e = (p.x - d[i].x) ** 2 + (p.y - d[i].y) ** 2;
      if (e >= max) { max = e; split = i; }
    }
    return [max, split];
  }
  function reparam(d, first, last, u, b) {
    return u.map((t, i) => {
      const p = d[first + i];
      const q = P.kubika(b.p0, b.p1, b.p2, b.p3, t);
      const q1 = P.derivaceKubiky(b.p0, b.p1, b.p2, b.p3, t);
      // druhá derivace
      const s = 1 - t;
      const q2 = bod(6 * s * (b.p2.x - 2 * b.p1.x + b.p0.x) + 6 * t * (b.p3.x - 2 * b.p2.x + b.p1.x),
        6 * s * (b.p2.y - 2 * b.p1.y + b.p0.y) + 6 * t * (b.p3.y - 2 * b.p2.y + b.p1.y));
      const num = (q.x - p.x) * q1.x + (q.y - p.y) * q1.y;
      const den = q1.x * q1.x + q1.y * q1.y + (q.x - p.x) * q2.x + (q.y - p.y) * q2.y;
      if (Math.abs(den) < 1e-12) return t;
      return Math.max(0, Math.min(1, t - num / den));
    });
  }

  /* Uzavřený mnohoúhelník → obrys z úseček a kubik. Rohy (úhel ostřejší než
     rohUhel stupňů) zůstanou ostré, rovné úseky (delší než rovnaDelka) zůstanou úsečkami. */
  P.mnohouhelnikNaObrys = function (pol, volby) {
    const v = volby || {};
    const chyba = v.chyba || 1.5, roh = (v.roh == null ? 50 : v.roh) * Math.PI / 180, rovna = v.rovna || Infinity;
    let p = [];
    for (const q of pol) if (!p.length || Math.hypot(q.x - p[p.length - 1].x, q.y - p[p.length - 1].y) > 1e-6) p.push(bod(q.x, q.y));
    if (p.length > 1 && Math.hypot(p[0].x - p[p.length - 1].x, p[0].y - p[p.length - 1].y) < 1e-6) p.pop();
    const n = p.length;
    if (n < 3) return null;
    // rohy
    const jeRoh = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
      const u = norm(sub(b, a)), w = norm(sub(c, b));
      const ang = Math.acos(Math.max(-1, Math.min(1, dot(u, w))));
      if (ang > roh) jeRoh[i] = true;
      if (Math.hypot(b.x - a.x, b.y - a.y) > rovna || Math.hypot(c.x - b.x, c.y - b.y) > rovna) jeRoh[i] = true;
    }
    let s0 = jeRoh.indexOf(true);
    const segs = [];
    if (s0 < 0) {
      // hladká smyčka: začni v bodě s nejmenším x (bývá to extrém) a uzavři
      s0 = 0; for (let i = 1; i < n; i++) if (p[i].x < p[s0].x) s0 = i;
      const cyc = [];
      for (let k = 0; k <= n; k++) cyc.push(p[(s0 + k) % n]);
      const t = norm(sub(p[(s0 + 1) % n], p[(s0 - 1 + n) % n]));
      const out = [];
      const mid = Math.floor(cyc.length / 2);
      fitCubic(cyc, 0, mid, t, norm(sub(cyc[mid - 1], cyc[mid + 1])), chyba * chyba, out, 0);
      fitCubic(cyc, mid, cyc.length - 1, norm(sub(cyc[mid + 1], cyc[mid - 1])), mul(t, -1), chyba * chyba, out, 0);
      for (const s of out) segs.push(s);
    } else {
      let i = s0;
      do {
        let j = (i + 1) % n;
        const run = [p[i]];
        while (!jeRoh[j]) { run.push(p[j]); j = (j + 1) % n; }
        run.push(p[j]);
        if (run.length === 2) segs.push({ typ: 'l', p0: run[0], p3: run[1] });
        else {
          // celá řada skoro na přímce → úsečka
          let max = 0;
          for (const q of run) max = Math.max(max, vzdalOdPrimky(q, run[0], run[run.length - 1]));
          if (max < chyba * 0.5) segs.push({ typ: 'l', p0: run[0], p3: run[run.length - 1] });
          else for (const s of P.prolozKrivkami(run, chyba)) segs.push(s);
        }
        i = j;
      } while (i !== s0);
    }
    const o = P.zeSegmentu(segs, false);
    return o;
  };

  /* ---------- SVG ---------- */
  function f(x) { return Math.round(x * 100) / 100; }
  P.obrysyNaSvg = function (obrysy) {
    let d = '';
    for (const o of obrysy) {
      const seg = P.segmenty(o);
      if (!seg.length) continue;
      d += 'M' + f(seg[0].p0.x) + ' ' + f(seg[0].p0.y);
      for (const s of seg) {
        if (s.typ === 'l') d += 'L' + f(s.p3.x) + ' ' + f(s.p3.y);
        else d += 'C' + [s.p1.x, s.p1.y, s.p2.x, s.p2.y, s.p3.x, s.p3.y].map(f).join(' ');
      }
      if (!o.otevreny) d += 'Z';
    }
    return d;
  };

  /* Cesta SVG (atribut d) → obrysy. Oblouky se převádějí na kubiky.
     m = volitelná matice [a,b,c,d,e,f] (např. převrácení osy y). */
  P.svgNaObrysy = function (d, m) {
    const tok = (d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || []);
    let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0, lcx = 0, lcy = 0, lq = null;
    const obrysy = []; let cur = null;
    const T = m || [1, 0, 0, 1, 0, 0];
    const tp = (x, y) => ({ x: T[0] * x + T[2] * y + T[4], y: T[1] * x + T[3] * y + T[5] });
    const num = () => parseFloat(tok[i++]);
    const jeCislo = () => i < tok.length && !/^[a-zA-Z]$/.test(tok[i]);
    const zacni = (x, y) => { cur = { body: [Object.assign(tp(x, y), { t: 'l', s: false })], otevreny: true }; obrysy.push(cur); };
    const lineTo = (x, y) => { if (!cur) zacni(cx, cy); cur.body.push(Object.assign(tp(x, y), { t: 'l', s: false })); };
    const curveTo = (x1, y1, x2, y2, x, y) => {
      if (!cur) zacni(cx, cy);
      cur.body.push(Object.assign(tp(x1, y1), { t: 'o', s: false }), Object.assign(tp(x2, y2), { t: 'o', s: false }), Object.assign(tp(x, y), { t: 'c', s: false }));
    };
    while (i < tok.length) {
      if (/^[a-zA-Z]$/.test(tok[i])) cmd = tok[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      const ox = rel ? cx : 0, oy = rel ? cy : 0;
      if (C === 'Z') {
        if (cur) uzavri(cur);
        cur = null; cx = sx; cy = sy; lq = null; lcx = cx; lcy = cy;
        if (jeCislo()) i++;
        continue;
      }
      if (!jeCislo()) { i++; continue; }
      if (C === 'M') {
        cx = ox + num(); cy = oy + num(); sx = cx; sy = cy; zacni(cx, cy);
        cmd = rel ? 'l' : 'L'; lcx = cx; lcy = cy; lq = null;
      } else if (C === 'L') { cx = ox + num(); cy = oy + num(); lineTo(cx, cy); lcx = cx; lcy = cy; lq = null; }
      else if (C === 'H') { cx = ox + num(); lineTo(cx, cy); lcx = cx; lcy = cy; lq = null; }
      else if (C === 'V') { cy = oy + num(); lineTo(cx, cy); lcx = cx; lcy = cy; lq = null; }
      else if (C === 'C') {
        const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num(), x = ox + num(), y = oy + num();
        curveTo(x1, y1, x2, y2, x, y); lcx = x2; lcy = y2; cx = x; cy = y; lq = null;
      } else if (C === 'S') {
        const x1 = 2 * cx - lcx, y1 = 2 * cy - lcy;
        const x2 = ox + num(), y2 = oy + num(), x = ox + num(), y = oy + num();
        curveTo(x1, y1, x2, y2, x, y); lcx = x2; lcy = y2; cx = x; cy = y; lq = null;
      } else if (C === 'Q' || C === 'T') {
        let qx, qy;
        if (C === 'Q') { qx = ox + num(); qy = oy + num(); }
        else { qx = lq ? 2 * cx - lq.x : cx; qy = lq ? 2 * cy - lq.y : cy; }
        const x = ox + num(), y = oy + num();
        curveTo(cx + 2 / 3 * (qx - cx), cy + 2 / 3 * (qy - cy), x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), x, y);
        lq = { x: qx, y: qy }; cx = x; cy = y; lcx = cx; lcy = cy;
      } else if (C === 'A') {
        const rx = num(), ry = num(), rot = num(), la = num(), sw = num(), x = ox + num(), y = oy + num();
        for (const c of oblouk(cx, cy, rx, ry, rot, la, sw, x, y)) curveTo(...c);
        cx = x; cy = y; lcx = cx; lcy = cy; lq = null;
      } else i++;
    }
    for (const o of obrysy) {
      if (o.otevreny && o.body.length > 2) {
        // SVG výplň obrys stejně uzavře
        uzavri(o);
      }
    }
    return obrysy.filter(o => o.body.length > 1).map(o => P.urciHladkost(o));
  };
  function uzavri(o) {
    const b = o.body, a = b[0], z = b[b.length - 1];
    if (b.length > 1 && Math.abs(a.x - z.x) < 1e-6 && Math.abs(a.y - z.y) < 1e-6) {
      // poslední bod splývá s prvním: typ posledního se přenese na první
      a.t = z.t; b.pop();
    } else a.t = 'l';
    delete o.otevreny;
    // přesun: poslední bod na křivce má být na konci, první bod nese typ uzavíracího segmentu
  }
  // SVG arc → kubiky (podle SVG implementačních poznámek F.6)
  function oblouk(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
    if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]];
    rx = Math.abs(rx); ry = Math.abs(ry);
    const ph = phi * Math.PI / 180, cs = Math.cos(ph), sn = Math.sin(ph);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const x1p = cs * dx + sn * dy, y1p = -sn * dx + cs * dy;
    let L = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
    if (L > 1) { rx *= Math.sqrt(L); ry *= Math.sqrt(L); }
    const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    let k = Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
    if (fa === fs) k = -k;
    const cxp = k * rx * y1p / ry, cyp = -k * ry * x1p / rx;
    const cx = cs * cxp - sn * cyp + (x1 + x2) / 2, cy = sn * cxp + cs * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
    const nseg = Math.ceil(Math.abs(dt) / (Math.PI / 2)), d = dt / nseg, out = [];
    const kk = 4 / 3 * Math.tan(d / 4);
    let t = t1;
    const P_ = (a) => { const ex = rx * Math.cos(a), ey = ry * Math.sin(a); return [cs * ex - sn * ey + cx, sn * ex + cs * ey + cy]; };
    const D_ = (a) => { const ex = -rx * Math.sin(a), ey = ry * Math.cos(a); return [cs * ex - sn * ey, sn * ex + cs * ey]; };
    for (let s = 0; s < nseg; s++) {
      const a = P_(t), b = P_(t + d), da = D_(t), db = D_(t + d);
      out.push([a[0] + kk * da[0], a[1] + kk * da[1], b[0] - kk * db[0], b[1] - kk * db[1], b[0], b[1]]);
      t += d;
    }
    return out;
  }

  /* Elipsa jako obrys ze čtyř kubik (po směru hodinových ručiček). */
  P.elipsa = function (cx, cy, rx, ry) {
    const k = 0.5522847498;
    const b = [
      { x: cx - rx, y: cy, t: 'c', s: true },
      { x: cx - rx, y: cy + ry * k, t: 'o' }, { x: cx - rx * k, y: cy + ry, t: 'o' }, { x: cx, y: cy + ry, t: 'c', s: true },
      { x: cx + rx * k, y: cy + ry, t: 'o' }, { x: cx + rx, y: cy + ry * k, t: 'o' }, { x: cx + rx, y: cy, t: 'c', s: true },
      { x: cx + rx, y: cy - ry * k, t: 'o' }, { x: cx + rx * k, y: cy - ry, t: 'o' }, { x: cx, y: cy - ry, t: 'c', s: true },
      { x: cx - rx * k, y: cy - ry, t: 'o' }, { x: cx - rx, y: cy - ry * k, t: 'o' }
    ];
    return { body: b.map(p => ({ x: p.x, y: p.y, t: p.t, s: !!p.s })) };
  };

  /* ---------- vykreslení (Canvas 2D nebo Path2D) ----------
     m = [a,b,c,d,e,f] z jednotek em do pixelů. */
  P.kresliObrysy = function (ctx, obrysy, m) {
    const T = m || [1, 0, 0, 1, 0, 0];
    const X = p => T[0] * p.x + T[2] * p.y + T[4], Y = p => T[1] * p.x + T[3] * p.y + T[5];
    for (const o of obrysy) {
      const seg = P.segmenty(o);
      if (!seg.length) continue;
      ctx.moveTo(X(seg[0].p0), Y(seg[0].p0));
      for (const s of seg) {
        if (s.typ === 'l') ctx.lineTo(X(s.p3), Y(s.p3));
        else ctx.bezierCurveTo(X(s.p1), Y(s.p1), X(s.p2), Y(s.p2), X(s.p3), Y(s.p3));
      }
      if (!o.otevreny) ctx.closePath();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
