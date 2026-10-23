/* ============================================================
   Písmolijna – jadro/operace.js
   Operace nad glyfy: afinní transformace, booleovské operace
   (Clipper + zpětná rekonstrukce původních křivek), obtažení tahem,
   zesílení, obrysové a stínované písmo, kurzíva, kapitálky,
   zaokrouhlení / extrémy / zjednodušení / směr, metriky
   (vystředění, automatické mezery a kerning), skládání diakritiky
   a interpolace dvou řezů. Bez DOM – běží i v node.
   Potřebuje model.js a krivky.js; booleany a ofset knihovnu Clipper
   (G.ClipperLib).
   ============================================================ */
(function (G) {
  'use strict';
  const P = G.PSL || (G.PSL = {});

  const S = 64;   // škála souřadnic pro Clipper (pracuje s celými čísly)
  const bod = (x, y) => ({ x, y });

  function clipper() {
    const C = G.ClipperLib;
    if (!C) throw new Error('Chybí knihovna Clipper (ClipperLib) – booleovské operace a ofset nejsou k dispozici.');
    return C;
  }

  /* Indexy obrysů podle výběru (null = všechny); jen platné a bez duplicit. */
  function indexy(g, vyber) {
    const n = g.obrysy.length;
    if (vyber == null) return Array.from({ length: n }, (_, i) => i);
    return vyber.filter((i, k, a) => Number.isInteger(i) && i >= 0 && i < n && a.indexOf(i) === k);
  }

  /* Je obrys „kubicky normalizovaný“ (před každým bodem na křivce 0 nebo 2 řídicí body)? */
  function jeKubicky(o) {
    const b = o.body, n = b.length;
    const start = b.findIndex(p => p.t !== 'o');
    if (start < 0) return false;
    let run = 0;
    for (let k = 1; k <= n; k++) {
      const p = b[(start + k) % n];
      if (p.t === 'o') run++;
      else { if (run !== 0 && run !== 2) return false; run = 0; }
    }
    return true;
  }
  function kubicky(o) { return jeKubicky(o) ? o : P.normalizujObrys(o); }

  /* ============================================================
     Afinní matice [a, b, c, d, e, f]:  x' = a·x + c·y + e,  y' = b·x + d·y + f
     ============================================================ */
  const rad = s => s * Math.PI / 180;
  P.matice = {
    identita: () => [1, 0, 0, 1, 0, 0],
    posun: (dx, dy) => [1, 0, 0, 1, dx || 0, dy || 0],
    meritko: (sx, sy, cx, cy) => {
      if (sy == null) sy = sx;
      cx = cx || 0; cy = cy || 0;
      return [sx, 0, 0, sy, cx - sx * cx, cy - sy * cy];
    },
    /* kladný úhel = proti směru hodinových ručiček (y nahoru) */
    otoceni: (stupne, cx, cy) => {
      const c = Math.cos(rad(stupne)), s = Math.sin(rad(stupne));
      cx = cx || 0; cy = cy || 0;
      return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
    },
    /* zkosení: x' = x + tg(ux)·(y − cy), y' = y + tg(uy)·(x − cx); kladné ux nakloní doprava */
    zkoseni: (stupneX, stupneY, cx, cy) => {
      const tx = Math.tan(rad(stupneX || 0)), ty = Math.tan(rad(stupneY || 0));
      cx = cx || 0; cy = cy || 0;
      return [1, ty, tx, 1, -tx * cy, -ty * cx];
    },
    zrcadloX: (cx) => [-1, 0, 0, 1, 2 * (cx || 0), 0],   // převrácení zleva doprava kolem svislé osy x = cx
    zrcadloY: (cy) => [1, 0, 0, -1, 0, 2 * (cy || 0)],   // převrácení vzhůru nohama kolem y = cy
    nasob: (a, b) => P.nasobMatice(a, b),                // nejdřív b, pak a
    inverze: (m) => {
      const det = m[0] * m[3] - m[1] * m[2];
      if (Math.abs(det) < 1e-15) return null;
      const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
      return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
    }
  };

  /* Transformuje obrysy (výběr), při vyber == null i komponenty a kotvy.
     Zrcadlení (det < 0) obrátí směr obrysů, aby zůstal správný. Vrací počet obrysů. */
  P.transformujGlyf = function (g, m, vyber) {
    const idx = indexy(g, vyber);
    const zrcadli = m[0] * m[3] - m[1] * m[2] < 0;
    for (const i of idx) {
      const o = g.obrysy[i];
      for (const b of o.body) { const p = P.transformujBod(m, b.x, b.y); b.x = p.x; b.y = p.y; }
      if (zrcadli) P.obratObrys(o);
    }
    if (vyber == null) {
      for (const k of g.komponenty || []) k.m = P.nasobMatice(m, k.m);
      for (const a of g.kotvy || []) { const p = P.transformujBod(m, a.x, a.y); a.x = p.x; a.y = p.y; }
    }
    return idx.length;
  };

  /* ============================================================
     Proložení mnohoúhelníku křivkami s pevnými zlomy
     (Schneider s předepsanými tečnami; body na extrémech).
     ============================================================ */
  const sub = (a, b) => bod(a.x - b.x, a.y - b.y);
  const add = (a, b) => bod(a.x + b.x, a.y + b.y);
  const mul = (a, k) => bod(a.x * k, a.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const delka = a => Math.hypot(a.x, a.y);
  function norm(a) { const l = Math.hypot(a.x, a.y); return l > 1e-12 ? bod(a.x / l, a.y / l) : bod(0, 0); }

  function bezier(d, u, t1, t2) {
    const p0 = d[0], p3 = d[d.length - 1];
    let C00 = 0, C01 = 0, C11 = 0, X0 = 0, X1 = 0;
    for (let i = 0; i < u.length; i++) {
      const t = u[i], s = 1 - t;
      const b0 = s * s * s, b1 = 3 * t * s * s, b2 = 3 * t * t * s, b3 = t * t * t;
      const A1 = mul(t1, b1), A2 = mul(t2, b2);
      C00 += dot(A1, A1); C01 += dot(A1, A2); C11 += dot(A2, A2);
      const tmp = sub(d[i], bod(p0.x * (b0 + b1) + p3.x * (b2 + b3), p0.y * (b0 + b1) + p3.y * (b2 + b3)));
      X0 += dot(A1, tmp); X1 += dot(A2, tmp);
    }
    const det = C00 * C11 - C01 * C01, L = Math.hypot(p3.x - p0.x, p3.y - p0.y);
    let a1 = 0, a2 = 0;
    if (Math.abs(det) > 1e-12) { a1 = (X0 * C11 - X1 * C01) / det; a2 = (C00 * X1 - C01 * X0) / det; }
    if (!(a1 > 1e-6 * L) || !(a2 > 1e-6 * L) || a1 > 4 * L || a2 > 4 * L) a1 = a2 = L / 3;
    return { typ: 'c', p0, p1: add(p0, mul(t1, a1)), p2: add(p3, mul(t2, a2)), p3 };
  }
  function parametryDelkou(d) {
    const u = [0];
    for (let i = 1; i < d.length; i++) u.push(u[i - 1] + Math.hypot(d[i].x - d[i - 1].x, d[i].y - d[i - 1].y));
    const L = u[u.length - 1] || 1;
    return u.map(x => x / L);
  }
  function chybaFit(d, b, u) {
    let max = 0, idx = Math.floor(d.length / 2);
    for (let i = 1; i < d.length - 1; i++) {
      const p = P.kubika(b.p0, b.p1, b.p2, b.p3, u[i]);
      const e = (p.x - d[i].x) ** 2 + (p.y - d[i].y) ** 2;
      if (e >= max) { max = e; idx = i; }
    }
    return [max, idx];
  }
  function preparametrizuj(d, u, b) {
    return u.map((t, i) => {
      const p = d[i], q = P.kubika(b.p0, b.p1, b.p2, b.p3, t), q1 = P.derivaceKubiky(b.p0, b.p1, b.p2, b.p3, t);
      const s = 1 - t;
      const q2 = bod(6 * s * (b.p2.x - 2 * b.p1.x + b.p0.x) + 6 * t * (b.p3.x - 2 * b.p2.x + b.p1.x),
        6 * s * (b.p2.y - 2 * b.p1.y + b.p0.y) + 6 * t * (b.p3.y - 2 * b.p2.y + b.p1.y));
      const num = (q.x - p.x) * q1.x + (q.y - p.y) * q1.y;
      const den = q1.x * q1.x + q1.y * q1.y + (q.x - p.x) * q2.x + (q.y - p.y) * q2.y;
      return Math.abs(den) < 1e-12 ? t : Math.max(0, Math.min(1, t - num / den));
    });
  }
  /* Proloží lomenou čáru d kubikami; t1 = tečna ven z prvního bodu, t2 = tečna
     z posledního bodu zpět (dovnitř). Vrací segmenty. */
  function prolozSTecnami(d, t1, t2, chyba, out, h) {
    out = out || []; h = h || 0;
    const e2 = chyba * chyba;
    if (d.length === 2) {
      const L = Math.hypot(d[1].x - d[0].x, d[1].y - d[0].y) / 3;
      out.push({ typ: 'c', p0: d[0], p1: add(d[0], mul(t1, L)), p2: add(d[1], mul(t2, L)), p3: d[1] });
      return out;
    }
    let u = parametryDelkou(d), b = bezier(d, u, t1, t2);
    let [err, split] = chybaFit(d, b, u);
    if (err < e2) { out.push(b); return out; }
    if (err < e2 * 25) {
      for (let k = 0; k < 8; k++) {
        u = preparametrizuj(d, u, b); b = bezier(d, u, t1, t2);
        [err, split] = chybaFit(d, b, u);
        if (err < e2) { out.push(b); return out; }
      }
    }
    if (h > 30 || d.length < 3) { out.push(b); return out; }
    split = Math.max(1, Math.min(d.length - 2, split));
    const tc = norm(sub(d[split - 1], d[split + 1]));
    prolozSTecnami(d.slice(0, split + 1), t1, tc, chyba, out, h + 1);
    prolozSTecnami(d.slice(split), mul(tc, -1), t2, chyba, out, h + 1);
    return out;
  }
  P.prolozSTecnami = function (pts, t1, t2, chyba) { return prolozSTecnami(pts, norm(t1), norm(t2), chyba || 1); };

  /* Jednostranná tečna: směr od bodu i k prvnímu bodu dál než „dosah“ (krok ±1). */
  function tecnaJednostranna(p, i, krok, dosah, mez) {
    const n = p.length, a = p[i];
    let j = i;
    for (let k = 1; k <= mez; k++) {
      j = ((i + krok * k) % n + n) % n;
      if (Math.hypot(p[j].x - a.x, p[j].y - a.y) >= dosah) break;
    }
    return norm(sub(p[j], a));
  }

  /* Extrémy v ose (hystereze s prahem) – vrací indexy vrcholů. */
  function extremyOsy(p, osa, prah) {
    const n = p.length, out = [];
    let m = 0;
    for (let i = 1; i < n; i++) if (p[i][osa] < p[m][osa]) m = i;
    let stoupa = true, c = m, mn = m;
    for (let k = 1; k <= n; k++) {
      const i = (m + k) % n, v = p[i][osa];
      if (stoupa) {
        if (v > p[c][osa]) c = i;
        else if (p[c][osa] - v > prah) { out.push(c); stoupa = false; c = i; }
      } else {
        if (v < p[c][osa]) c = i;
        else if (v - p[c][osa] > prah) { out.push(c); stoupa = true; c = i; }
      }
    }
    if (out.length) out.push(mn);
    // na plochém vrcholu vzít prostřední bod (jinak extrém ujede k začátku plošiny)
    const tol = Math.min(0.25, prah * 0.25);
    return out.map(i => {
      const v = p[i][osa];
      let a = 0, b = 0;
      while (a < n / 4 && Math.abs(p[(i - a - 1 + n) % n][osa] - v) <= tol) a++;
      while (b < n / 4 && Math.abs(p[(i + b + 1) % n][osa] - v) <= tol) b++;
      return (i + Math.round((b - a) / 2) + n) % n;
    });
  }

  /* Uzavřený mnohoúhelník → obrys. volby: chyba (1), roh (úhel ve stupních, 45; null = nehledat),
     rohy (pole indexů vnucených rohů), pevne (pole indexů vnucených hladkých bodů na křivce),
     extremy (true – body na extrémech), rovna (tolerance pro úsečky, chyba·0,5).
     Vrací {body} nebo null. */
  P.prolozMnohouhelnik = function (pol, volby) {
    const v = volby || {};
    const chyba = v.chyba || 1, rovna = v.rovna != null ? v.rovna : chyba * 0.5;
    const rohUhel = v.roh === null ? null : (v.roh == null ? 45 : v.roh);
    const vnuceneRohy = new Set(v.rohy || []), vnucenePevne = new Set(v.pevne || []);
    // odstranit totožné sousední vrcholy (s mapou indexů)
    const p = [], roh = [], pev = [];
    pol.forEach((q, i) => {
      const z = p[p.length - 1];
      if (z && Math.hypot(q.x - z.x, q.y - z.y) < 1e-6) { if (vnuceneRohy.has(i)) roh[p.length - 1] = true; return; }
      p.push(bod(q.x, q.y)); roh.push(vnuceneRohy.has(i)); pev.push(vnucenePevne.has(i));
    });
    while (p.length > 1 && Math.hypot(p[0].x - p[p.length - 1].x, p[0].y - p[p.length - 1].y) < 1e-6) {
      roh[0] = roh[0] || roh[p.length - 1]; p.pop(); roh.pop(); pev.pop();
    }
    const n = p.length;
    if (n < 3) return null;
    if (rohUhel != null) {
      const mez = Math.cos(rad(rohUhel));
      for (let i = 0; i < n; i++) {
        const a = norm(sub(p[i], p[(i - 1 + n) % n])), b = norm(sub(p[(i + 1) % n], p[i]));
        if (dot(a, b) < mez) roh[i] = true;
      }
    }
    // zlomy a tečny v nich
    const zlom = new Array(n).fill(false), tecna = new Array(n).fill(null);
    for (let i = 0; i < n; i++) if (roh[i]) zlom[i] = true;
    for (let i = 0; i < n; i++) if (pev[i] && !roh[i]) {
      zlom[i] = true; tecna[i] = norm(sub(p[(i + 1) % n], p[(i - 1 + n) % n]));
    }
    if (v.rovneHrany !== false) {
      // dlouhá hrana mezi krátkými (zploštěný oblouk vedle rovného úseku) = úsečka;
      // její konce jsou zlomy s tečnou ve směru hrany, aby navazující křivka byla hladká
      const L = p.map((q, i) => Math.hypot(p[(i + 1) % n].x - q.x, p[(i + 1) % n].y - q.y));
      const mez = v.dlouha || Math.max(8 * chyba, 4);
      const Lk = k => L[((k % n) + n) % n];
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (L[i] < mez) continue;
        const vlevo = roh[i] || 4 * Math.max(Lk(i - 1), Lk(i - 2)) <= L[i];
        const vpravo = roh[j] || 4 * Math.max(Lk(i + 1), Lk(i + 2)) <= L[i];
        if (!vlevo || !vpravo) continue;
        const smer = norm(sub(p[j], p[i]));
        for (const k of [i, j]) { zlom[k] = true; if (!roh[k] && !tecna[k]) tecna[k] = smer; }
      }
    }
    if (v.extremy !== false) {
      const prah = Math.max(chyba, 0.5);
      const blizko = Math.max(2 * chyba, 1);
      const zlomy = [];
      for (let i = 0; i < n; i++) if (zlom[i]) zlomy.push(p[i]);
      for (const osa of ['x', 'y']) for (const i of extremyOsy(p, osa, prah)) {
        if (zlom[i] || zlomy.some(q => Math.hypot(q.x - p[i].x, q.y - p[i].y) < blizko)) continue;
        zlomy.push(p[i]);
        const pr = p[(i - 1 + n) % n], dl = p[(i + 1) % n];
        zlom[i] = true;
        tecna[i] = osa === 'y' ? bod(Math.sign(dl.x - pr.x) || 1, 0) : bod(0, Math.sign(dl.y - pr.y) || 1);
      }
    }
    let s0 = zlom.indexOf(true);
    if (s0 < 0) { s0 = 0; zlom[0] = true; tecna[0] = norm(sub(p[1], p[n - 1])); }
    const dosah = Math.max(chyba * 2, 1e-3);
    const segs = [];
    let i = s0;
    do {
      let j = (i + 1) % n;
      const run = [p[i]];
      while (!zlom[j]) { run.push(p[j]); j = (j + 1) % n; }
      run.push(p[j]);
      let max = 0;
      for (const q of run) max = Math.max(max, P.vzdalOdPrimky(q, run[0], run[run.length - 1]));
      if (run.length === 2 || max <= rovna) segs.push({ typ: 'l', p0: run[0], p3: run[run.length - 1] });
      else {
        const t1 = tecna[i] || tecnaJednostranna(p, i, 1, dosah, run.length - 1);
        const t2 = tecna[j] ? mul(tecna[j], -1) : tecnaJednostranna(p, j, -1, dosah, run.length - 1);
        prolozSTecnami(run, t1, t2, chyba, segs);
      }
      i = j;
    } while (i !== s0);
    return obrysZeSegmentu(segs);
  };

  /* Sloučí segmenty kratší než min (body na křivce blíž než min) se sousedem;
     sousední segment převezme koncový bod a jeho řídicí bod se posune stejně. */
  function slucKratke(segs, min, otevreny) {
    const s = segs.map(q => Object.assign({}, q));
    const kratky = q => Math.hypot(q.p3.x - q.p0.x, q.p3.y - q.p0.y) < min &&
      (q.typ === 'l' || (Math.hypot(q.p1.x - q.p0.x, q.p1.y - q.p0.y) < 4 * min && Math.hypot(q.p2.x - q.p3.x, q.p2.y - q.p3.y) < 4 * min));
    for (let zmena = true; zmena && s.length > (otevreny ? 1 : 2);) {
      zmena = false;
      for (let i = 0; i < s.length; i++) {
        const q = s[i];
        if (!kratky(q)) continue;
        const dalsi = i + 1 < s.length ? i + 1 : (otevreny ? -1 : 0);
        if (dalsi >= 0 && dalsi !== i) {
          const d = s[dalsi], dx = q.p0.x - d.p0.x, dy = q.p0.y - d.p0.y;
          const nd = Object.assign({}, d, { p0: q.p0 });
          if (d.typ === 'c') nd.p1 = bod(d.p1.x + dx, d.p1.y + dy);
          s[dalsi] = nd;
        } else {
          const pi = i - 1;
          if (pi < 0) break;
          const d = s[pi], dx = q.p3.x - d.p3.x, dy = q.p3.y - d.p3.y;
          const nd = Object.assign({}, d, { p3: q.p3 });
          if (d.typ === 'c') nd.p2 = bod(d.p2.x + dx, d.p2.y + dy);
          s[pi] = nd;
        }
        s.splice(i, 1);
        zmena = true; break;
      }
    }
    return s;
  }
  P.slucKratkeSegmenty = function (obrys, min) {
    const seg = P.segmenty(obrys);
    if (!seg.length) return obrys;
    const r = obrysZeSegmentu(seg, obrys.otevreny, min == null ? 1 : min);
    if (r) obrys.body = r.body;
    return obrys;
  };

  /* Segmenty → obrys: vyhodí nulové segmenty a spojí navazující úsečky na jedné přímce. */
  function obrysZeSegmentu(segs, otevreny, minDelka) {
    let s = slucKratke(segs, minDelka == null ? 1 : minDelka, otevreny);
    for (let zmena = true; zmena && s.length > 2;) {
      zmena = false;
      for (let i = 0; i < s.length; i++) {
        if (otevreny && i === s.length - 1) break;
        const a = s[i], b = s[(i + 1) % s.length];
        if (a.typ === 'l' && b.typ === 'l' && P.vzdalOdPrimky(a.p3, a.p0, b.p3) < 0.5 &&
          dot(sub(a.p3, a.p0), sub(b.p3, a.p3)) > 0) {
          const nove = { typ: 'l', p0: a.p0, p3: b.p3 };
          if (i + 1 < s.length) s.splice(i, 2, nove); else { s.splice(i, 1); s[0] = nove; }
          zmena = true; break;
        }
      }
    }
    if (!s.length) return null;
    return P.zeSegmentu(s, !!otevreny);
  }

  /* ============================================================
     Booleovské operace
     ============================================================ */
  /* Zploští kubiku adaptivně a vrátí vnitřní parametry t (bez 0 a 1). */
  function plochost(p0, p1, p2, p3) {
    const ux = 3 * p1.x - 2 * p0.x - p3.x, uy = 3 * p1.y - 2 * p0.y - p3.y;
    const vx = 3 * p2.x - p0.x - 2 * p3.x, vy = 3 * p2.y - p0.y - 2 * p3.y;
    return Math.max(ux * ux, vx * vx) + Math.max(uy * uy, vy * vy);
  }
  function parametryZplosteni(s, tol, out) {
    const t2 = 16 * tol * tol;
    (function rek(p0, p1, p2, p3, ta, tb, h) {
      if (h > 14 || plochost(p0, p1, p2, p3) <= t2) { if (tb < 1 - 1e-12) out.push(tb); return; }
      const [a, b] = P.rozdelKubiku(p0, p1, p2, p3, 0.5), tm = (ta + tb) / 2;
      rek(a[0], a[1], a[2], a[3], ta, tm, h + 1);
      rek(b[0], b[1], b[2], b[3], tm, tb, h + 1);
    })(s.p0, s.p1, s.p2, s.p3, 0, 1, 0);
    return out;
  }

  /* Zdroj pro rekonstrukci: zploštěné obrysy s evidencí původu vrcholů. */
  function novyZdroj() { return { mapa: new Map(), segs: [] }; }
  function pridejDoZdroje(zdroj, obrys, tol) {
    const o = kubicky(obrys);
    const ci = zdroj.segs.length, segs = P.segmenty(o);
    zdroj.segs.push(segs);
    const n = segs.length, path = [];
    const zapis = (x, y, info) => {
      const X = Math.round(x * S), Y = Math.round(y * S), klic = X + ',' + Y;
      info.x = x; info.y = y;
      let l = zdroj.mapa.get(klic);
      if (!l) { l = []; zdroj.mapa.set(klic, l); }
      l.push(info);
      const z = path[path.length - 1];
      if (!z || z.X !== X || z.Y !== Y) path.push({ X, Y });
    };
    for (let k = 0; k < n; k++) {
      const s = segs[k];
      zapis(s.p0.x, s.p0.y, { druh: 'kotva', c: ci, k: k, kin: (k - 1 + n) % n });
      if (s.typ === 'c') for (const t of parametryZplosteni(s, tol, [])) {
        const q = P.kubika(s.p0, s.p1, s.p2, s.p3, t);
        zapis(q.x, q.y, { druh: 'vnitrni', c: ci, k: k, t: t });
      }
    }
    while (path.length > 1 && path[0].X === path[path.length - 1].X && path[0].Y === path[path.length - 1].Y) path.pop();
    return path;
  }
  function plochaCesty(path) {
    let a = 0;
    for (let i = 0, n = path.length; i < n; i++) { const p = path[i], q = path[(i + 1) % n]; a += p.X * q.Y - q.X * p.Y; }
    return a / 2;
  }

  function podkrivka(s, ta, tb) {   // ta < tb
    let c = [s.p0, s.p1, s.p2, s.p3];
    if (tb < 1 - 1e-12) c = P.rozdelKubiku(c[0], c[1], c[2], c[3], tb)[0];
    if (ta > 1e-12) c = P.rozdelKubiku(c[0], c[1], c[2], c[3], ta / tb)[1];
    return c;
  }

  const TOL_PRUSECIK = 0.4;
  /* Parametr t vrcholu run[i] na segmentu (c,k), nebo null. */
  function parametrVrcholu(v, c, k, s, jePrvni) {
    for (const inf of v.infos) {
      if (inf.c !== c) continue;
      if (inf.druh === 'vnitrni' && inf.k === k) return inf.t;
      if (inf.druh === 'kotva') {
        if (inf.k === k && inf.kin === k) return jePrvni ? 0 : 1;
        if (inf.k === k) return 0;
        if (inf.kin === k) return 1;
      }
    }
    const r = P.nejblizsiNaSegmentu(s, v.x, v.y);
    return r.d < TOL_PRUSECIK ? r.t : null;
  }

  /* Úsek výsledného mnohoúhelníku mezi dvěma zlomy → segmenty (přednostně přesná část původní křivky). */
  function rekonstruujUsek(run, zdroj) {
    const kand = new Map();
    const hlas = (c, k, w) => { const key = c + ':' + k; const z = kand.get(key); if (z) z.w += w; else kand.set(key, { c, k, w }); };
    for (let i = 0; i < run.length; i++) for (const inf of run[i].infos) {
      if (inf.druh === 'vnitrni') hlas(inf.c, inf.k, 2);
      else { hlas(inf.c, inf.k, 1); hlas(inf.c, inf.kin, 1); }
    }
    if (!kand.size) {
      // dva nové průsečíky bez vrcholů mezi nimi – najdi segment podle středu
      const m = bod((run[0].x + run[run.length - 1].x) / 2, (run[0].y + run[run.length - 1].y) / 2);
      zdroj.segs.forEach((segs, c) => segs.forEach((s, k) => {
        const o = P.obalkaBodu(s.typ === 'c' ? [s.p0, s.p1, s.p2, s.p3] : [s.p0, s.p3]);
        if (m.x >= o.x0 - 1 && m.x <= o.x1 + 1 && m.y >= o.y0 - 1 && m.y <= o.y1 + 1) hlas(c, k, 0);
      }));
    }
    const kandidati = Array.from(kand.values()).sort((a, b) => b.w - a.w);
    for (const kd of kandidati) {
      const s = zdroj.segs[kd.c][kd.k];
      const ts = [];
      let ok = true;
      for (let i = 0; i < run.length; i++) {
        const t = parametrVrcholu(run[i], kd.c, kd.k, s, i === 0);
        if (t == null) { ok = false; break; }
        ts.push(t);
      }
      if (!ok) continue;
      const roste = ts[ts.length - 1] > ts[0];
      if (Math.abs(ts[ts.length - 1] - ts[0]) < 1e-9 && s.typ === 'c') continue;
      for (let i = 1; i < ts.length && ok; i++) if (roste ? ts[i] < ts[i - 1] - 1e-6 : ts[i] > ts[i - 1] + 1e-6) ok = false;
      if (!ok) continue;
      const a = run[0], z = run[run.length - 1];
      if (s.typ === 'l') return [{ typ: 'l', p0: bod(a.x, a.y), p3: bod(z.x, z.y) }];
      let c = roste ? podkrivka(s, ts[0], ts[ts.length - 1]) : podkrivka(s, ts[ts.length - 1], ts[0]).reverse();
      const d0 = sub(a, c[0]), d3 = sub(z, c[3]);
      return [{ typ: 'c', p0: bod(a.x, a.y), p1: add(c[1], d0), p2: add(c[2], d3), p3: bod(z.x, z.y) }];
    }
    // náhradní proložení
    const pts = run.map(v => bod(v.x, v.y));
    let max = 0;
    for (const q of pts) max = Math.max(max, P.vzdalOdPrimky(q, pts[0], pts[pts.length - 1]));
    if (pts.length === 2 || max < 0.1) return [{ typ: 'l', p0: pts[0], p3: pts[pts.length - 1] }];
    return prolozSTecnami(pts, norm(sub(pts[1], pts[0])), norm(sub(pts[pts.length - 2], pts[pts.length - 1])), 0.25);
  }

  /* Cesta z Clipperu → obrys s rekonstrukcí původních křivek. */
  function cestaNaObrys(path, zdroj) {
    const V = path.map(pt => {
      const infos = zdroj.mapa.get(pt.X + ',' + pt.Y) || [];
      const x = infos.length ? infos[0].x : pt.X / S, y = infos.length ? infos[0].y : pt.Y / S;
      return { x, y, infos, zlom: !infos.length || infos.some(f => f.druh === 'kotva') };
    });
    const n = V.length;
    if (n < 3) return null;
    const s0 = V.findIndex(v => v.zlom);
    if (s0 < 0) return P.prolozMnohouhelnik(V.map(v => bod(v.x, v.y)), { chyba: 0.25, roh: 35 });
    const segs = [];
    let i = s0;
    do {
      let j = (i + 1) % n;
      const run = [V[i]];
      while (!V[j].zlom) { run.push(V[j]); j = (j + 1) % n; }
      run.push(V[j]);
      for (const s of rekonstruujUsek(run, zdroj)) segs.push(s);
      i = j;
    } while (i !== s0);
    return obrysZeSegmentu(segs);
  }

  function prochazejStrom(uzel, out) {
    for (const ch of uzel.Childs()) {
      out.push({ cesta: ch.Contour(), dira: ch.IsHole() });
      prochazejStrom(ch, out);
    }
    return out;
  }
  /* Nastaví orientaci cesty: vnější po směru hodinových ručiček (záporná plocha), díry proti. */
  function orientuj(c) {
    const a = plochaCesty(c.cesta);
    if ((c.dira && a < 0) || (!c.dira && a > 0)) c.cesta = c.cesta.slice().reverse();
    return c;
  }

  /* Společné jádro booleanů. Vrací počet výsledných obrysů. */
  function booleovska(g, typ, idxA, idxB, volby) {
    const C = clipper(), v = volby || {};
    const zdroj = novyZdroj();
    const uzavrene = i => !g.obrysy[i].otevreny && g.obrysy[i].body.length > 1;
    idxA = idxA.filter(uzavrene); idxB = idxB.filter(uzavrene);
    const cesty = idx => idx.map(i => pridejDoZdroje(zdroj, g.obrysy[i], v.tolerance || 0.2)).filter(c => c.length > 2);
    const A = cesty(idxA), B = cesty(idxB);
    const c = new C.Clipper();
    c.PreserveCollinear = true;
    c.StrictlySimple = true;   // obrysy dotýkající se v bodě rozdělit
    if (A.length) c.AddPaths(A, C.PolyType.ptSubject, true);
    if (B.length) c.AddPaths(B, C.PolyType.ptClip, true);
    const strom = new C.PolyTree();
    const ct = { sjednoceni: C.ClipType.ctUnion, prunik: C.ClipType.ctIntersection, rozdil: C.ClipType.ctDifference, xor: C.ClipType.ctXor }[typ];
    c.Execute(ct, strom, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
    const nove = [];
    for (const k of prochazejStrom(strom, [])) {
      if (k.cesta.length < 3) continue;
      orientuj(k);
      const o = cestaNaObrys(k.cesta, zdroj);
      if (!o || o.body.length < 2) continue;
      if (v.zaokrouhlit) P.zaokrouhli(o, 1);
      nove.push(o);
    }
    nahradObrysy(g, idxA.concat(idxB), nove);
    return nove.length;
  }
  /* Odstraní obrysy s danými indexy a na místo prvního vloží nové. */
  function nahradObrysy(g, idx, nove) {
    const smaz = new Set(idx);
    const kam = idx.length ? Math.min.apply(null, idx) : g.obrysy.length;
    const zbyle = [];
    let vlozeno = false;
    g.obrysy.forEach((o, i) => {
      if (i === kam && !vlozeno) { zbyle.push(...nove); vlozeno = true; }
      if (!smaz.has(i)) zbyle.push(o);
    });
    if (!vlozeno) zbyle.push(...nove);
    g.obrysy = zbyle;
  }

  /* Odstranit překryvy (sjednocení) vybraných obrysů. */
  P.sjednot = function (g, vyber, volby) { return booleovska(g, 'sjednoceni', indexy(g, vyber), [], volby); };
  P.prunik = function (g, a, b, volby) { return booleovska(g, 'prunik', indexy(g, a), indexy(g, b), volby); };
  /* Odečte obrysy b od obrysů a. */
  P.rozdil = function (g, a, b, volby) { return booleovska(g, 'rozdil', indexy(g, a), indexy(g, b), volby); };
  P.xor = function (g, a, b, volby) { return booleovska(g, 'xor', indexy(g, a), b == null ? [] : indexy(g, b), volby); };

  /* Plocha glyfu s ohledem na díry (vnější obrysy po směru = kladná výsledná plocha). */
  P.plochaGlyfu = function (obrysy) {
    let a = 0;
    for (const o of obrysy) if (!o.otevreny) a -= P.plochaObrysu(o);
    return a;
  };

  /* ============================================================
     Ofset: obtažení, zesílení, obrysové a stínované písmo
     ============================================================ */
  function naCestu(obrys, tol) {
    const pol = P.zplostni(kubicky(obrys), tol || 0.2), out = [];
    for (const q of pol) {
      const X = Math.round(q.x * S), Y = Math.round(q.y * S), z = out[out.length - 1];
      if (!z || z.X !== X || z.Y !== Y) out.push({ X, Y });
    }
    return out;
  }
  const JOIN = { kulate: 'jtRound', ostre: 'jtMiter', zkosene: 'jtSquare' };
  const KONCE = { kulate: 'etOpenRound', ploche: 'etOpenButt', ctverec: 'etOpenSquare' };

  /* Polystrom z Clipperu → obrysy proložené křivkami (správný směr). */
  function stromNaObrysy(strom, volby) {
    const v = volby || {}, out = [];
    for (const k of prochazejStrom(strom, [])) {
      if (k.cesta.length < 3) continue;
      orientuj(k);
      const pol = k.cesta.map(p => bod(p.X / S, p.Y / S));
      if (v.mapa) for (const q of pol) { const r = v.mapa(q.x, q.y); q.x = r.x; q.y = r.y; }
      const o = P.prolozMnohouhelnik(pol, { chyba: v.chyba || 0.5, roh: v.roh == null ? 30 : v.roh });
      if (o) { if (v.zaokrouhlit) P.zaokrouhli(o, 1); out.push(o); }
    }
    return out;
  }

  function sjednoceneCesty(obrysy) {
    const C = clipper(), c = new C.Clipper();
    const cesty = obrysy.filter(o => !o.otevreny).map(o => naCestu(o)).filter(p => p.length > 2);
    if (!cesty.length) return [];
    c.AddPaths(cesty, C.PolyType.ptSubject, true);
    const sol = new C.Paths();
    c.Execute(C.ClipType.ctUnion, sol, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
    return sol;
  }
  function ofsetCest(cesty, delta, spoje, limit) {
    const C = clipper();
    const co = new C.ClipperOffset(limit || 4, 0.1 * S);
    co.AddPaths(cesty, C.JoinType[JOIN[spoje] || 'jtMiter'], C.EndType.etClosedPolygon);
    const strom = new C.PolyTree();
    co.Execute(strom, delta * S);
    return strom;
  }

  /* Expand Stroke: obrysy (i otevřené) obtáhne perem o tloušťce; výsledek nahradí vybrané obrysy.
     volby: konce 'kulate'|'ploche'|'ctverec', spoje 'kulate'|'ostre'|'zkosene', limitOstri, vyber, chyba. */
  P.obtahni = function (g, tloustka, volby) {
    const C = clipper(), v = volby || {};
    const idx = indexy(g, v.vyber == null ? null : v.vyber);
    const co = new C.ClipperOffset(v.limitOstri || 4, 0.1 * S);
    const jt = C.JoinType[JOIN[v.spoje || 'kulate']];
    for (const i of idx) {
      const o = g.obrysy[i], cesta = naCestu(o);
      if (cesta.length < 2) continue;
      const et = o.otevreny ? C.EndType[KONCE[v.konce || 'kulate']] : C.EndType.etClosedLine;
      co.AddPath(cesta, jt, et);
    }
    const strom = new C.PolyTree();
    co.Execute(strom, Math.abs(tloustka) / 2 * S);
    const nove = stromNaObrysy(strom, { chyba: v.chyba || 0.5, zaokrouhlit: v.zaokrouhlit });
    nahradObrysy(g, idx, nove);
    return nove.length;
  };

  /* Change Weight: ofset uzavřených obrysů o „o“ jednotek (záporné = zúžit).
     volby: zachovatVysku (svisle zpět na původní rozsah), spoje ('ostre'), zachovatSirku (neměnit šířku). */
  P.zesil = function (g, o, volby) {
    const v = volby || {};
    const idx = indexy(g, null).filter(i => !g.obrysy[i].otevreny);
    if (!idx.length || !o) return 0;
    const puv = P.obalkaObrysu(idx.map(i => g.obrysy[i]));
    const strom = ofsetCest(sjednoceneCesty(idx.map(i => g.obrysy[i])), o, v.spoje || 'ostre', v.limitOstri);
    let mapa = null;
    if (v.zachovatVysku && puv) {
      // nová obálka v y je zhruba o „o“ větší nahoru i dolů – přeškálovat zpět
      let y0 = Infinity, y1 = -Infinity;
      for (const k of prochazejStrom(strom, [])) for (const p of k.cesta) { y0 = Math.min(y0, p.Y / S); y1 = Math.max(y1, p.Y / S); }
      if (y1 > y0) {
        const k = (puv.y1 - puv.y0) / (y1 - y0);
        mapa = (x, y) => bod(x, puv.y0 + (y - y0) * k);
      }
    }
    const nove = stromNaObrysy(strom, { chyba: v.chyba || 0.5, mapa });
    nahradObrysy(g, idx, nove);
    if (!v.zachovatSirku) {
      const dx = Math.round(o);
      for (const ob of nove) for (const b of ob.body) b.x += dx;
      for (const k of g.komponenty || []) k.m[4] += dx;
      for (const a of g.kotvy || []) a.x += dx;
      g.sirka = Math.max(0, g.sirka + 2 * dx);
    }
    if (v.zaokrouhlit) for (const ob of nove) P.zaokrouhli(ob, 1);
    return nove.length;
  };

  /* Vnitřní ofset glyfu o tloušťku jako nové obrysy (pomocník pro dutá písma). */
  function vnitrniObrysy(obrysy, tloustka, spoje) {
    const strom = ofsetCest(sjednoceneCesty(obrysy), -Math.abs(tloustka), spoje || 'ostre');
    return stromNaObrysy(strom, { chyba: 0.4 });
  }

  /* Outline: dutý font – vnější obrys zůstane, vnitřek zmenšený o tloušťku se odečte. */
  P.obrysovePismo = function (g, tloustka, volby) {
    const v = volby || {};
    const puvodni = indexy(g, null).filter(i => !g.obrysy[i].otevreny);
    if (!puvodni.length) return 0;
    const vnitrni = vnitrniObrysy(puvodni.map(i => g.obrysy[i]), tloustka, v.spoje);
    const zac = g.obrysy.length;
    for (const o of vnitrni) g.obrysy.push(o);
    const novaIdx = vnitrni.map((_, k) => zac + k);
    return P.rozdil(g, puvodni, novaIdx, v);
  };

  /* Stínované písmo: sjednocení glyfu a jeho posunuté kopie. volby.tloustka > 0 = původní
     tvar zůstane dutý (obrys o dané tloušťce), stín plný. */
  P.stinovane = function (g, dx, dy, volby) {
    const v = volby || {};
    const puvodni = indexy(g, null).filter(i => !g.obrysy[i].otevreny);
    if (!puvodni.length) return 0;
    const vnitrni = v.tloustka > 0 ? vnitrniObrysy(puvodni.map(i => g.obrysy[i]), v.tloustka, v.spoje) : [];
    for (const i of puvodni) {
      const k = P.klonuj(g.obrysy[i]);
      for (const b of k.body) { b.x += dx; b.y += dy; }
      g.obrysy.push(k);
    }
    const vse = indexy(g, null).filter(i => !g.obrysy[i].otevreny);
    let n = P.sjednot(g, vse, v);
    if (vnitrni.length) {
      const zbyle = indexy(g, null).filter(i => !g.obrysy[i].otevreny);
      const zac = g.obrysy.length;
      for (const o of vnitrni) g.obrysy.push(o);
      n = P.rozdil(g, zbyle, vnitrni.map((_, k) => zac + k), v);
    }
    return n;
  };

  /* Kurzíva: zkosení kolem účaří (kladný úhel = náklon doprava), volby.zuzit 0–0,1
     = zúžení glyfu i šířky. Vrací použitou matici. */
  P.kurziva = function (g, uhel, volby) {
    const v = volby || {};
    let m = P.matice.zkoseni(uhel, 0, 0, 0);
    const z = Math.max(0, Math.min(0.3, +v.zuzit || 0));
    if (z) {
      m = P.nasobMatice(m, P.matice.meritko(1 - z, 1, 0, 0));
      g.sirka = Math.round(g.sirka * (1 - z));
    }
    P.transformujGlyf(g, m, null);
    return m;
  };

  /* ============================================================
     Úpravy bodů
     ============================================================ */
  P.zaokrouhliGlyf = function (g, krok) {
    const k = krok || 1;
    let zmen = 0;
    const r = x => Math.round(x / k) * k;
    for (const o of g.obrysy) for (const b of o.body) {
      const x = r(b.x), y = r(b.y);
      if (x !== b.x || y !== b.y) zmen++;
      b.x = x; b.y = y;
    }
    for (const a of g.kotvy || []) { const x = r(a.x), y = r(a.y); if (x !== a.x || y !== a.y) zmen++; a.x = x; a.y = y; }
    for (const c of g.komponenty || []) { const x = Math.round(c.m[4]), y = Math.round(c.m[5]); if (x !== c.m[4] || y !== c.m[5]) zmen++; c.m[4] = x; c.m[5] = y; }
    if (Math.round(g.sirka) !== g.sirka) { g.sirka = Math.round(g.sirka); zmen++; }
    return zmen;
  };

  P.pridejExtremyGlyf = function (g, vyber) {
    let n = 0;
    for (const i of indexy(g, vyber)) {
      const o = g.obrysy[i];
      if (!jeKubicky(o)) o.body = P.normalizujObrys(o).body;
      n += P.pridejExtremy(o);
    }
    return n;
  };

  P.opravSmerGlyfu = function (g) { return P.opravSmer(g.obrysy); };
  P.obratSmerGlyfu = function (g, vyber) {
    const idx = indexy(g, vyber);
    for (const i of idx) P.obratObrys(g.obrysy[i]);
    return idx.length;
  };

  /* Počáteční bod uzavřeného obrysu (musí to být bod na křivce). */
  P.nastavPocatek = function (obrys, i) {
    const b = obrys.body;
    if (obrys.otevreny || i <= 0 || i >= b.length || b[i].t === 'o') return false;
    obrys.body = b.slice(i).concat(b.slice(0, i));
    return true;
  };

  /* Zjednodušení: zkusí odebrat každý hladký bod na křivce mezi dvěma kubikami a nahradit
     je jednou kubikou se zachovanými krajními tečnami; přijme, když odchylka < tol.
     volby: uhel (mez hladkosti ve stupních, 10), zachovatExtremy (true), vyber. Vrací počet odebraných bodů. */
  P.zjednodusGlyf = function (g, tol, volby) {
    const v = volby || {}, tolerance = tol == null ? 1 : tol;
    const mezHladka = Math.cos(rad(v.uhel == null ? 10 : v.uhel));
    let odebrano = 0;
    for (const i of indexy(g, v.vyber == null ? null : v.vyber)) {
      const o = g.obrysy[i];
      if (o.body.length < 3) continue;
      const pred = o.body.length;
      P.vycisti(o, 0.05);
      let segs = P.segmenty(o);
      for (let zmena = true, guard = 0; zmena && guard < 1000; guard++) {
        zmena = false;
        const n = segs.length;
        if (n < (o.otevreny ? 2 : 3)) break;
        for (let k = 0; k < n; k++) {
          if (o.otevreny && k === n - 1) break;
          const a = segs[k], b = segs[(k + 1) % n];
          if (a.typ !== 'c' || b.typ !== 'c') continue;
          const tin = norm(sub(a.p3, Math.hypot(a.p2.x - a.p3.x, a.p2.y - a.p3.y) > 1e-9 ? a.p2 : a.p1));
          const tout = norm(sub(Math.hypot(b.p1.x - b.p0.x, b.p1.y - b.p0.y) > 1e-9 ? b.p1 : b.p2, b.p0));
          if (dot(tin, tout) < mezHladka) continue;   // roh
          if (v.zachovatExtremy !== false) {
            const vod = Math.abs(tin.y) < 0.02, svi = Math.abs(tin.x) < 0.02;
            if ((vod && (a.p0.y - a.p3.y) * (b.p3.y - b.p0.y) < 0) || (svi && (a.p0.x - a.p3.x) * (b.p3.x - b.p0.x) < 0)) continue;
          }
          const vz = [];
          for (let q = 0; q <= 12; q++) vz.push(P.kubika(a.p0, a.p1, a.p2, a.p3, q / 12));
          for (let q = 1; q <= 12; q++) vz.push(P.kubika(b.p0, b.p1, b.p2, b.p3, q / 12));
          const t1 = norm(sub(Math.hypot(a.p1.x - a.p0.x, a.p1.y - a.p0.y) > 1e-9 ? a.p1 : a.p2, a.p0));
          const t2 = norm(sub(Math.hypot(b.p2.x - b.p3.x, b.p2.y - b.p3.y) > 1e-9 ? b.p2 : b.p1, b.p3));
          let u = parametryDelkou(vz), c = bezier(vz, u, t1, t2);
          for (let r = 0; r < 6; r++) { u = preparametrizuj(vz, u, c); c = bezier(vz, u, t1, t2); }
          let err = 0;
          for (const q of vz) err = Math.max(err, P.nejblizsiNaSegmentu(c, q.x, q.y).d);
          for (let q = 1; q < 12 && err < tolerance; q++) {   // i opačně: nová křivka ke starým
            const p = P.kubika(c.p0, c.p1, c.p2, c.p3, q / 12);
            err = Math.max(err, Math.min(P.nejblizsiNaSegmentu(a, p.x, p.y).d, P.nejblizsiNaSegmentu(b, p.x, p.y).d));
          }
          if (err < tolerance) {
            c.p0 = a.p0; c.p3 = b.p3;
            if (k + 1 < n) segs.splice(k, 2, c); else { segs.splice(k, 1); segs[0] = c; }
            zmena = true; break;
          }
        }
      }
      const r = P.zeSegmentu(segs, o.otevreny);
      o.body = r.body;
      odebrano += Math.max(0, pred - o.body.length);
    }
    return odebrano;
  };

  /* Zavolá fn(glyf, font, nazev) na vybrané glyfy (null = všechny). Vrací součet číselných výsledků. */
  P.vsechnyOperaceNaFont = function (font, nazvy, fn) {
    let soucet = 0;
    for (const n of nazvy || font.poradi) {
      const g = font.glyfy[n];
      if (!g) continue;
      const r = fn(g, font, n);
      soucet += typeof r === 'number' ? r : (r ? 1 : 0);
    }
    return soucet;
  };

  /* ============================================================
     Profily a metriky
     ============================================================ */
  /* Intervaly výplně (nenulové vinutí) na vodorovné přímce y. pols = zploštěné uzavřené obrysy. */
  function intervalyNaY(pols, y) {
    const pr = [];
    for (const pol of pols) {
      const n = pol.length;
      for (let i = 0; i < n; i++) {
        const a = pol[i], b = pol[(i + 1) % n];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          const x = a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y);
          pr.push({ x, w: b.y > a.y ? 1 : -1 });
        }
      }
    }
    pr.sort((p, q) => p.x - q.x);
    const out = [];
    let w = 0, zac = 0;
    for (const p of pr) {
      const pred = w; w += p.w;
      if (pred === 0 && w !== 0) zac = p.x;
      else if (pred !== 0 && w === 0) { if (p.x - zac > 1e-9) out.push([zac, p.x]); }
    }
    return out;
  }
  P.intervalyNaY = intervalyNaY;
  function polygonyGlyfu(font, g, tol) {
    return P.plneObrysy(font, g).filter(o => !o.otevreny).map(o => P.zplostni(o, tol || 1)).filter(p => p.length > 2);
  }

  /* Tloušťka kmene: vodorovný řez glyfem 'n' ve výšce xVyska/2 (resp. 'H' ve 0,25 výšky verzálek)
     – šířka prvního plného úseku. Vrací číslo nebo null. */
  P.tloustkaKmene = function (font, glyf) {
    const info = font.info;
    let g = typeof glyf === 'string' ? font.glyfy[glyf] : glyf, y;
    if (!g) g = font.glyfy.n || font.glyfy.H;
    if (!g) return null;
    if (g.nazev === 'H' || (g.nazev && /^[A-Z]$/.test(g.nazev))) y = info.vyskaVerzalek * 0.25;
    else y = info.xVyska / 2;
    const iv = intervalyNaY(polygonyGlyfu(font, g, 0.5), y + 0.01);
    return iv.length ? iv[0][1] - iv[0][0] : null;
  };

  /* Profil glyfu: pro y od y0 do y1 s krokem levý a pravý okraj výplně (null = prázdno). */
  function profil(font, g, y0, y1, krok) {
    const pols = polygonyGlyfu(font, g, 1);
    const ys = [], l = [], r = [];
    for (let y = y0; y <= y1 + 1e-9; y += krok) {
      const iv = intervalyNaY(pols, y + 0.013);
      ys.push(y);
      if (iv.length) { l.push(iv[0][0]); r.push(iv[iv.length - 1][1]); } else { l.push(null); r.push(null); }
    }
    return { ys, l, r };
  }
  P.profilGlyfu = profil;

  function jeVerzalka(g) {
    const u = (g.uni || [])[0];
    if (u != null) {
      const ch = String.fromCodePoint(u);
      if (/\p{Lu}|\p{Nd}/u.test(ch)) return true;
      if (/\p{Ll}/u.test(ch)) return false;
    }
    const zakl = (g.nazev || '').split('.')[0];
    if (zakl.length && /^[A-Z]/.test(zakl) && !/\.sc$/.test(g.nazev)) return true;
    return false;
  }

  /* Bílá plocha strany v pásmu (průměrná hloubka profilu omezená „mez“) a okraj výplně. */
  function stranaPlocha(pr, strana, mez) {
    const hodn = pr[strana];
    let ext = null;
    for (const x of hodn) if (x != null) ext = ext == null ? x : (strana === 'l' ? Math.min(ext, x) : Math.max(ext, x));
    if (ext == null) return null;
    let s = 0;
    for (const x of hodn) s += x == null ? mez : Math.min(mez, Math.abs(x - ext));
    return { ext, plocha: s / hodn.length };
  }

  /* Vystředí glyf v jeho šířce (stejné LSB a RSB). Vrací posun. */
  P.vystred = function (font, g) {
    const o = P.obalkaGlyfu(font, g);
    if (!o) return 0;
    const dx = Math.round((g.sirka - (o.x1 - o.x0)) / 2 - o.x0);
    if (dx) P.posunGlyf(g, dx, 0);
    return dx;
  };

  /* Automatické postranní mezery podle optické plochy mezery (jako HT Letterspacer):
     v pásmu účaří–x-výška (minusky, vzor 'n') nebo účaří–výška verzálek (verzálky a číslice, vzor 'H')
     se spočte průměrná hloubka profilu (omezená volby.hloubka × výška pásma, výchozí 0,1;
     volby.vliv = váha plochy, 1);
     mezera + hloubka má být stejná jako u vzoru. volby: vsechny (i interpunkce), minimum, krok.
     Vrací počet upravených glyfů. */
  P.automatickeMezery = function (font, nazvy, volby) {
    const v = volby || {}, info = font.info, upm = info.upm;
    const krok = v.krok || Math.max(4, Math.round(upm / 100));
    const hl = v.hloubka || 0.1, min = v.minimum != null ? v.minimum : -Math.round(upm * 0.02);
    const vliv = v.vliv != null ? v.vliv : 1;
    const vzor = (nazev, h) => {
      const g = font.glyfy[nazev];
      if (!g || P.glyfJePrazdny(g)) return null;
      const pr = profil(font, g, 0, h, krok), mez = h * hl;
      const L = stranaPlocha(pr, 'l', mez), R = stranaPlocha(pr, 'r', mez);
      if (!L || !R) return null;
      return ((L.ext + vliv * L.plocha) + (g.sirka - R.ext + vliv * R.plocha)) / 2;
    };
    const Wn = vzor('n', info.xVyska), WH = vzor('H', info.vyskaVerzalek);
    const cil = {
      minusky: Wn != null ? Wn : (WH != null ? WH * 0.9 : upm * 0.07),
      verzalky: WH != null ? WH : (Wn != null ? Wn * 1.1 : upm * 0.08)
    };
    let zmen = 0;
    for (const n of nazvy || font.poradi) {
      const g = font.glyfy[n];
      if (!g || P.glyfJePrazdny(g)) continue;
      const u = (g.uni || [])[0];
      const pismeno = u != null ? /\p{L}|\p{N}/u.test(String.fromCodePoint(u)) : /^[A-Za-z]/.test(n);
      if (!pismeno && !v.vsechny) continue;
      const velka = jeVerzalka(g), h = velka ? info.vyskaVerzalek : info.xVyska, W = velka ? cil.verzalky : cil.minusky;
      const pr = profil(font, g, 0, h, krok), mez = h * hl;
      const L = stranaPlocha(pr, 'l', mez), R = stranaPlocha(pr, 'r', mez);
      if (!L || !R) continue;
      const lsb = Math.max(min, Math.round(W - vliv * L.plocha)), rsb = Math.max(min, Math.round(W - vliv * R.plocha));
      const dx = Math.round(lsb - L.ext);
      const sirka = Math.max(0, Math.round(R.ext + dx + rsb));
      if (dx || sirka !== g.sirka) {
        if (dx) P.posunGlyf(g, dx, 0);
        g.sirka = sirka; zmen++;
      }
    }
    return zmen;
  };

  /* Automatický kerning: pro každý pár (levý × pravý) se v pásmu, kde se glyfy svisle překrývají,
     vzorkuje po volby.krok (10) vodorovná mezera profilů. Profil je omezený hloubkou
     (volby.hloubka, 0,08 em – hlubší místa než o tolik za krajním bodem glyfu se berou jako
     v této hloubce, takže „T“ nad „o“ nezajede až ke kmeni) a rozšířený o optický polštář
     (kruhové rozšíření o volby.polstar, 0,02 em). Vzdálenost páru = směs nejmenší mezery
     a průměrné mezery omezené hloubkou (volby.vaha = podíl průměru, 0,5; 0 = čistě nejmenší). Cíl = volby.cil, jinak průměr vzdáleností
     dvojic L|L a R|R – dobře vysázený font tak dvojice stejných tvarů nekernuje a kerning
     vzniká jen tam, kde se tvary k sobě hodí jinak než samy k sobě (AV, To, LT…).
     volby.vzor = 'H' / 'n' / 'auto' → cíl = vzdálenost dvojice vzorů (auto: 'H' pro verzálky, 'n' minusky).
     Kerning = cíl − vzdálenost, zaokrouhlený na 5, |k| < volby.prah (10) se nezapíše,
     omezení ±volby.max (0,25 em); kladný (rozevírající) kerning jen s volby.jenZaporne = false.
     Vrací počet zapsaných párů. */
  P.automatickyKerning = function (font, levy, pravy, volby) {
    const v = volby || {}, upm = font.info.upm;
    const krok = v.krok || 10, polstar = v.polstar != null ? v.polstar : upm * 0.02;
    const prah = v.prah != null ? v.prah : 10, maxK = v.max != null ? v.max : upm * 0.25;
    const vaha = v.vaha != null ? v.vaha : 0.5, hloubka = v.hloubka != null ? v.hloubka : upm * 0.08;
    const cache = new Map();
    const prof = n => {
      if (cache.has(n)) return cache.get(n);
      const g = font.glyfy[n];
      let r = null;
      if (g && !P.glyfJePrazdny(g)) {
        const o = P.obalkaGlyfu(font, g);
        if (o) {
          const y0 = Math.floor(o.y0 / krok) * krok;
          const p = profil(font, g, y0, o.y1, krok);
          const N = p.ys.length;
          // omezení hloubkou
          const l = p.l.map(x => x == null ? o.x0 + hloubka : Math.min(x, o.x0 + hloubka));
          const rr = p.r.map(x => x == null ? o.x1 - hloubka : Math.max(x, o.x1 - hloubka));
          // optický polštář: kruhové rozšíření profilu
          const w = Math.max(0, Math.floor(polstar / krok));
          const L = new Array(N), R = new Array(N);
          for (let i = 0; i < N; i++) {
            L[i] = l[i]; R[i] = rr[i];
            for (let j = Math.max(0, i - w); j <= Math.min(N - 1, i + w); j++) {
              const dy = (j - i) * krok, e = Math.sqrt(Math.max(0, polstar * polstar - dy * dy));
              if (l[j] - e < L[i]) L[i] = l[j] - e;
              if (rr[j] + e > R[i]) R[i] = rr[j] + e;
            }
          }
          r = { y0, ys: p.ys, l: L, r: R, sirka: g.sirka };
        }
      }
      cache.set(n, r);
      return r;
    };
    const vzdalenost = (a, b) => {
      const A = prof(a), B = prof(b);
      if (!A || !B) return null;
      const mezery = [];
      for (let i = 0; i < A.ys.length; i++) {
        const j = Math.round((A.ys[i] - B.y0) / krok);
        if (j < 0 || j >= B.ys.length) continue;
        mezery.push(A.sirka - A.r[i] + B.l[j]);
      }
      if (!mezery.length) return null;
      const dmin = Math.min.apply(null, mezery);
      if (!vaha) return dmin;
      let s = 0;
      for (const d of mezery) s += Math.min(d, dmin + hloubka);
      return (1 - vaha) * dmin + vaha * s / mezery.length;
    };
    const vlastni = new Map();
    const sam = n => { if (!vlastni.has(n)) vlastni.set(n, vzdalenost(n, n)); return vlastni.get(n); };
    let pocet = 0;
    for (const a of levy) for (const b of pravy) {
      if (!font.glyfy[a] || !font.glyfy[b]) continue;
      const d = vzdalenost(a, b);
      if (d == null) continue;
      let cil = v.cil;
      if (cil == null && v.vzor) {
        const ref = n => v.vzor !== 'auto' ? v.vzor : (jeVerzalka(font.glyfy[n]) && font.glyfy.H ? 'H' : (font.glyfy.n ? 'n' : 'H'));
        const ra = ref(a), rb = ref(b);
        cil = vzdalenost(ra, rb);
        if (cil == null) continue;
      }
      if (cil == null) {
        const da = sam(a), db = sam(b);
        if (da == null || db == null) continue;
        cil = (da + db) / 2;
      }
      let k = Math.round((cil - d) / 5) * 5;
      k = Math.max(-maxK, Math.min(maxK, k));
      if (k > 0 && v.jenZaporne !== false) k = 0;
      if (Math.abs(k) < prah) {
        if (v.smazatMale && font.kerning[a]) delete font.kerning[a][b];
        continue;
      }
      (font.kerning[a] || (font.kerning[a] = {}))[b] = k;
      pocet++;
    }
    return pocet;
  };

  /* ============================================================
     Kapitálky
     ============================================================ */
  /* Vytvoří glyfy 'a.sc' … z verzálek přeškálováním na x-výšku. volby: znaky (pole verzálek,
     výchozí A–Z), rozsir (vodorovný poměr navíc, 1.05), ztucnit (true), prepsat (false).
     Vrací seznam vytvořených názvů. */
  P.kapitalky = function (font, volby) {
    const v = volby || {}, info = font.info;
    const k = info.xVyska / info.vyskaVerzalek, sx = k * (v.rozsir || 1.05);
    const kmen = P.tloustkaKmene(font, 'H') || P.tloustkaKmene(font, 'n') || info.upm * 0.08;
    const zes = v.ztucnit === false ? 0 : (1 - k) * kmen / 2 * (v.silaZtucneni != null ? v.silaZtucneni : 0.5);
    const znaky = v.znaky || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const out = [];
    for (const zn of znaky) {
      const z = font.glyfy[zn];
      if (!z || P.glyfJePrazdny(z)) continue;
      const nazev = zn.toLowerCase() + '.sc';
      if (font.glyfy[nazev] && !v.prepsat) continue;
      const g = P.novyGlyf(nazev, null, Math.round(z.sirka * sx));
      g.obrysy = P.plneObrysy(font, z).filter(o => !o.otevreny);
      P.transformujGlyf(g, P.matice.meritko(sx, k, 0, 0), null);
      g.kotvy = (z.kotvy || []).map(a => ({ nazev: a.nazev, x: a.x * sx, y: a.y * k }));
      if (zes > 0.5 && G.ClipperLib) {
        P.zesil(g, zes, { zachovatVysku: true, zachovatSirku: true });
        // šířku zvětšit jen o polovinu ztučnění na každé straně
        P.posunGlyf(g, Math.round(zes / 2), 0);
        g.sirka += Math.round(zes);
      }
      P.zaokrouhliGlyf(g);
      P.pridejGlyf(font, g);
      out.push(nazev);
    }
    return out;
  };

  /* ============================================================
     Diakritika
     ============================================================ */
  const ZNAMENKA = {
    0x301: 'acute', 0x300: 'grave', 0x302: 'circumflex', 0x303: 'tilde', 0x308: 'dieresis', 0x30A: 'ring',
    0x30C: 'caron', 0x306: 'breve', 0x304: 'macron', 0x307: 'dotaccent', 0x30B: 'hungarumlaut',
    0x327: 'cedilla', 0x328: 'ogonek'
  };
  const DOLNI = { cedilla: 'bottom', ogonek: 'ogonek' };
  /* Tabulka rozkladu název → [základ, akcent, kotva]. */
  P.SKLADBA = (function () {
    const t = {};
    const rozsahy = [[0xC0, 0x17F], [0x1CD, 0x1DC], [0x1E2, 0x1E3], [0x218, 0x21B]];
    for (const [a, b] of rozsahy) for (let cp = a; cp <= b; cp++) {
      const d = Array.from(String.fromCodePoint(cp).normalize('NFD'));
      if (d.length !== 2) continue;
      const zakl = d[0].codePointAt(0), zn = ZNAMENKA[d[1].codePointAt(0)];
      if (!zn || !/[A-Za-z]/.test(d[0])) continue;
      let zaklad = d[0], kotva = DOLNI[zn] || 'top';
      if (!DOLNI[zn]) { if (zaklad === 'i') zaklad = 'dotlessi'; if (zaklad === 'j') zaklad = 'uni0237'; }
      if (zn === 'caron' && /[dltL]/.test(d[0])) kotva = 'top_right';
      t[P.nazevProUnicode(cp)] = [zaklad, zn, kotva];
      void zakl;
    }
    t.Lslash = ['L', 'uni0337', 'stred'];
    t.lslash = ['l', 'uni0337', 'stred'];
    return t;
  })();

  /* Vodorovný řez: krajní pravý okraj výplně v horním pásmu glyfu (pro ď ť ľ Ľ). */
  function pravyOkrajNahore(font, g, y0, y1) {
    const pols = polygonyGlyfu(font, g, 1);
    let xr = null;
    for (let y = y0; y <= y1; y += Math.max(1, (y1 - y0) / 12)) {
      const iv = intervalyNaY(pols, y + 0.013);
      if (iv.length) xr = xr == null ? iv[iv.length - 1][1] : Math.max(xr, iv[iv.length - 1][1]);
    }
    return xr;
  }

  /* Vytvoří 'dotlessi' z 'i' (bez horní tečky), když chybí. */
  P.vytvorDotlessi = function (font) {
    if (font.glyfy.dotlessi) return font.glyfy.dotlessi;
    const i = font.glyfy.i;
    if (!i) return null;
    const ob = P.plneObrysy(font, i);
    const mez = font.info.xVyska * 0.8;
    const zbyle = ob.filter(o => { const b = P.obalkaObrysu([o]); return b && b.y0 < mez; });
    if (!zbyle.length || zbyle.length === ob.length) return null;
    const g = P.novyGlyf('dotlessi', font.glyfy.uni0131 ? null : 0x131, i.sirka);
    g.obrysy = zbyle;
    g.kotvy = (i.kotvy || []).map(a => Object.assign({}, a));
    return P.pridejGlyf(font, g);
  };

  /* Jednoduché geometrické akcenty (podle tloušťky kmene), které ve fontu chybí. Vrací seznam vytvořených. */
  P.vychoziAkcenty = function (font, volby) {
    const v = volby || {}, info = font.info, u = info.upm;
    const kmen = P.tloustkaKmene(font) || u * 0.08;
    const s = Math.max(u * 0.035, Math.min(u * 0.12, kmen * 0.75));
    const b = info.xVyska + Math.round(u * 0.06), ha = u * 0.15, cx = 0;
    const vytvorene = [];
    const tah = (body, tl, konce, spoje) => {
      const g = { obrysy: [{ body: body.map(p => ({ x: p[0], y: p[1], t: 'l', s: false })), otevreny: true }] };
      P.obtahni(g, tl, { konce: konce || 'ploche', spoje: spoje || 'ostre' });
      return g.obrysy;
    };
    const kruh = (x, y, r) => P.elipsa(x, y, r, r);
    const tvary = {
      acute: () => tah([[cx - u * 0.05, b + s * 0.3], [cx + u * 0.06, b + ha]], s),
      grave: () => tah([[cx + u * 0.05, b + s * 0.3], [cx - u * 0.06, b + ha]], s),
      circumflex: () => tah([[cx - u * 0.11, b + s * 0.3], [cx, b + ha - s * 0.3], [cx + u * 0.11, b + s * 0.3]], s),
      caron: () => tah([[cx - u * 0.11, b + ha - s * 0.3], [cx, b + s * 0.3], [cx + u * 0.11, b + ha - s * 0.3]], s),
      macron: () => [P.obdelnik(cx - u * 0.12, b + ha * 0.35, cx + u * 0.12, b + ha * 0.35 + s * 0.8, true)],
      dieresis: () => [kruh(cx - u * 0.09, b + s * 0.65, s * 0.65), kruh(cx + u * 0.09, b + s * 0.65, s * 0.65)],
      dotaccent: () => [kruh(cx, b + s * 0.65, s * 0.65)],
      ring: () => {
        const r = u * 0.075, o = kruh(cx, b + r, r), d = P.obratObrys(kruh(cx, b + r, Math.max(r * 0.3, r - s * 0.6)));
        return [o, d];
      },
      breve: () => {
        const pts = [];
        for (let k = 0; k <= 12; k++) { const a = Math.PI + k / 12 * Math.PI; pts.push([cx + Math.cos(a) * u * 0.1, b + ha * 0.9 + Math.sin(a) * ha * 0.75]); }
        return tah(pts, s * 0.85, 'ploche', 'kulate');
      },
      tilde: () => {
        const pts = [];
        for (let k = 0; k <= 16; k++) { const x = -1 + 2 * k / 16; pts.push([cx + x * u * 0.11, b + ha * 0.5 + Math.sin(x * Math.PI) * ha * 0.3]); }
        return tah(pts, s * 0.8, 'kulate', 'kulate');
      },
      hungarumlaut: () => tah([[cx - u * 0.1, b + s * 0.3], [cx - u * 0.02, b + ha]], s * 0.85)
        .concat(tah([[cx + u * 0.03, b + s * 0.3], [cx + u * 0.11, b + ha]], s * 0.85)),
      cedilla: () => tah([[cx, u * 0.02], [cx, -u * 0.05], [cx + u * 0.06, -u * 0.09], [cx + u * 0.02, -u * 0.16], [cx - u * 0.06, -u * 0.17]], s * 0.6, 'ploche', 'kulate'),
      ogonek: () => tah([[cx + u * 0.04, u * 0.02], [cx - u * 0.03, -u * 0.07], [cx, -u * 0.16], [cx + u * 0.07, -u * 0.16]], s * 0.65, 'ploche', 'kulate'),
      quoteright: () => {
        const r = s * 0.75, top = info.vyskaVerzalek, y = top - r;
        const g = { obrysy: [kruh(cx, y, r)].concat(tah([[cx + r * 0.85, y], [cx + r * 0.5, y - u * 0.06], [cx - r * 0.5, top - u * 0.17]], r * 0.9, 'kulate', 'kulate')) };
        P.sjednot(g, null);
        return g.obrysy;
      },
      uni0337: () => tah([[-u * 0.11, -u * 0.06], [u * 0.11, u * 0.06]], s * 0.6)
    };
    const seznam = v.nazvy || Object.keys(tvary);
    const cmap = P.cmap(font);
    for (const nazev of seznam) {
      if (font.glyfy[nazev] || !tvary[nazev]) continue;
      const ob = tvary[nazev]();
      const o = P.obalkaObrysu(ob);
      if (!o) continue;
      const okr = Math.round(u * 0.05), dx = Math.round(okr - o.x0);
      const kombinacni = nazev === 'uni0337';
      const cp = P.unicodeZNazvu(nazev);
      const g = P.novyGlyf(nazev, cp != null && !cmap.has(cp) ? cp : null, kombinacni ? 0 : Math.round(o.x1 - o.x0 + 2 * okr));
      g.obrysy = ob;
      if (!kombinacni) P.posunGlyf(g, dx, 0);
      else P.posunGlyf(g, -Math.round((o.x0 + o.x1) / 2), 0);
      const ob2 = P.obalkaObrysu(g.obrysy);
      if (!DOLNI[nazev] && nazev !== 'quoteright' && !kombinacni)
        g.kotvy.push({ nazev: '_top', x: Math.round((ob2.x0 + ob2.x1) / 2), y: Math.round(ob2.y0 - u * 0.06) });
      P.zaokrouhliGlyf(g);
      P.pridejGlyf(font, g);
      vytvorene.push(nazev);
    }
    return vytvorene;
  };

  /* Sestaví složené glyfy z komponent (základ + akcent) podle P.SKLADBA.
     nazvy = seznam cílových názvů (null = vše, co jde). volby: mezera (0,08 em), prepsat
     (přepsat i glyfy s vlastními obrysy), vytvoritAkcenty (true – chybějící akcenty vygenerovat).
     Vrací seznam vytvořených / aktualizovaných názvů. */
  P.sestavAkcenty = function (font, nazvy, volby) {
    const v = volby || {}, info = font.info, u = info.upm;
    const mezera = v.mezera != null ? v.mezera : Math.round(u * 0.08);
    const cile = nazvy || Object.keys(P.SKLADBA);
    if (v.vytvoritAkcenty !== false) {
      const potreba = new Set();
      for (const n of cile) {
        const r = P.SKLADBA[n];
        if (!r || !font.glyfy[r[0] === 'dotlessi' && !font.glyfy.dotlessi ? 'i' : r[0]]) continue;
        if (r[2] === 'top_right') { if (!font.glyfy['caron.alt'] && !font.glyfy.quoteright) potreba.add('quoteright'); }
        else potreba.add(r[1]);
      }
      if (potreba.size && G.ClipperLib) P.vychoziAkcenty(font, { nazvy: Array.from(potreba) });
    }
    const sklon = Math.tan(rad(-(info.sklon || 0)));
    const cmap = P.cmap(font);
    const out = [];
    for (const nazev of cile) {
      const r = P.SKLADBA[nazev];
      if (!r) continue;
      let [zakladN, akcentN, kotva] = r;
      if (zakladN === 'dotlessi' && !font.glyfy.dotlessi) P.vytvorDotlessi(font);
      if (zakladN === 'uni0237' && !font.glyfy.uni0237) continue;
      const zaklad = font.glyfy[zakladN];
      if (!zaklad || P.glyfJePrazdny(zaklad)) continue;
      const velka = /^[A-Z]/.test(zakladN);
      let kand = kotva === 'top_right' ? ['caron.alt', 'quoteright'] : (velka ? [akcentN + '.cap', akcentN] : [akcentN]);
      const akcentJm = kand.find(k => font.glyfy[k] && !P.glyfJePrazdny(font.glyfy[k]));
      if (!akcentJm) continue;
      const akcent = font.glyfy[akcentJm];
      const stary = font.glyfy[nazev];
      if (stary && stary.obrysy.length && !v.prepsat) continue;
      const bo = P.obalkaGlyfu(font, zaklad), ao = P.obalkaGlyfu(font, akcent);
      if (!bo || !ao) continue;
      let dx, dy;
      const kz = (zaklad.kotvy || []).find(a => a.nazev === kotva), ka = (akcent.kotvy || []).find(a => a.nazev === '_' + kotva);
      if (kz && ka) { dx = kz.x - ka.x; dy = kz.y - ka.y; }
      else if (kotva === 'top') {
        const refH = velka ? info.vyskaVerzalek : info.xVyska;
        dy = Math.max(bo.y1, refH) + mezera - ao.y0;
        const stredZ = kz ? kz.x : (bo.x0 + bo.x1) / 2;
        const posun = sklon * ((ao.y0 + ao.y1) / 2 + dy - (kz ? kz.y : (bo.y0 + bo.y1) / 2));
        dx = stredZ + posun - (ao.x0 + ao.x1) / 2;
      } else if (kotva === 'bottom') {
        dy = Math.max(bo.y0, 0) + u * 0.02 - ao.y1;
        dx = (bo.x0 + bo.x1) / 2 - (ao.x0 + ao.x1) / 2;
      } else if (kotva === 'ogonek') {
        dy = Math.max(bo.y0, 0) + u * 0.02 - ao.y1;
        dx = bo.x1 - (ao.x1 - ao.x0) * 0.35 - ao.x1 + (ao.x1 - ao.x0) * 0.0;
      } else if (kotva === 'top_right') {
        const xr = pravyOkrajNahore(font, zaklad, bo.y1 - u * 0.15, bo.y1 - 1) || bo.x1;
        dx = xr + mezera * 0.5 - ao.x0;
        dy = bo.y1 - ao.y1;
      } else if (kotva === 'stred') {
        const y = velka ? info.vyskaVerzalek * 0.45 : Math.min(bo.y1 * 0.5, info.xVyska * 0.6);
        const iv = intervalyNaY(polygonyGlyfu(font, zaklad, 1), y + 0.013);
        const x = iv.length ? (iv[0][0] + iv[0][1]) / 2 : (bo.x0 + bo.x1) / 2;
        dx = x - (ao.x0 + ao.x1) / 2; dy = y - (ao.y0 + ao.y1) / 2;
      } else continue;
      dx = Math.round(dx); dy = Math.round(dy);
      const g = stary || P.novyGlyf(nazev, null, zaklad.sirka);
      g.obrysy = [];
      g.komponenty = [{ glyf: zakladN, m: [1, 0, 0, 1, 0, 0] }, { glyf: akcentJm, m: [1, 0, 0, 1, dx, dy] }];
      g.sirka = zaklad.sirka;
      if (kotva === 'top_right') g.sirka = Math.max(zaklad.sirka, Math.round(ao.x1 + dx + u * 0.02));
      const cp = P.unicodeZNazvu(nazev);
      if (cp != null && (!cmap.has(cp) || cmap.get(cp) === nazev) && g.uni.indexOf(cp) < 0) g.uni.push(cp);
      if (!stary) P.pridejGlyf(font, g);
      out.push(nazev);
    }
    return out;
  };

  /* ============================================================
     Interpolace
     ============================================================ */
  P.kompatibilni = function (a, b) {
    if (!a || !b) return false;
    if (a.obrysy.length !== b.obrysy.length) return false;
    for (let i = 0; i < a.obrysy.length; i++) {
      const p = a.obrysy[i], q = b.obrysy[i];
      if (p.body.length !== q.body.length || !!p.otevreny !== !!q.otevreny) return false;
      for (let k = 0; k < p.body.length; k++) if (p.body[k].t !== q.body[k].t) return false;
    }
    const ka = a.komponenty || [], kb = b.komponenty || [];
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i++) if (ka[i].glyf !== kb[i].glyf) return false;
    return true;
  };

  /* Mezistupeň (t = 0 → A, 1 → B, mimo 0..1 extrapolace). Glyfy v obou fontech a kompatibilní
     se interpolují; nekompatibilní se převezmou z bližšího řezu (volby.vynechat = vynechat úplně).
     volby: zaokrouhlit (true), styl. Vrací { font, preskoceno: [názvy nekompatibilních] }. */
  P.interpoluj = function (fontA, fontB, t, volby) {
    const v = volby || {};
    const kB = (fontA.info.upm || 1000) / (fontB.info.upm || 1000);
    const zao = v.zaokrouhlit === false ? (x => x) : (x => Math.round(x));
    const L = (a, b) => a + (b - a) * t;
    const LB = (a, b) => L(a, b * kB);
    const F = P.klonuj(Object.assign({}, fontA, { glyfy: {}, poradi: [], kerning: {} }));
    for (const k in fontA.info) {
      const a = fontA.info[k], b = fontB.info[k];
      if (typeof a === 'number' && typeof b === 'number' && k !== 'upm') {
        const meri = /^(ascender|descender|xVyska|vyskaVerzalek|lineGap|podtrzeniPoz|podtrzeniTl)$/.test(k);
        F.info[k] = k === 'sklon' ? L(a, b) : (meri ? zao(LB(a, b)) : Math.round(L(a, b)));
      }
    }
    if (v.styl) F.info.styl = v.styl;
    const preskoceno = [];
    for (const n of fontA.poradi) {
      const a = fontA.glyfy[n], b = fontB.glyfy[n];
      if (!b) continue;
      if (!P.kompatibilni(a, b)) {
        preskoceno.push(n);
        if (!v.vynechat) {
          const z = P.klonuj(t < 0.5 ? a : b);
          if (t >= 0.5 && kB !== 1) P.transformujGlyf(z, P.matice.meritko(kB, kB, 0, 0), null), z.sirka = Math.round(z.sirka * kB);
          z.nazev = n; z.uni = a.uni.slice();
          P.pridejGlyf(F, z);
        }
        continue;
      }
      const g = P.klonuj(a);
      g.sirka = zao(LB(a.sirka, b.sirka));
      g.obrysy.forEach((o, i) => o.body.forEach((p, k) => {
        const q = b.obrysy[i].body[k];
        p.x = zao(LB(p.x, q.x)); p.y = zao(LB(p.y, q.y));
      }));
      g.komponenty.forEach((c, i) => {
        const d = b.komponenty[i].m;
        c.m = c.m.map((x, k) => k < 4 ? L(x, d[k]) : zao(LB(x, d[k])));
      });
      g.kotvy = (a.kotvy || []).map(p => {
        const q = (b.kotvy || []).find(z => z.nazev === p.nazev);
        return q ? { nazev: p.nazev, x: zao(LB(p.x, q.x)), y: zao(LB(p.y, q.y)) } : Object.assign({}, p);
      });
      P.pridejGlyf(F, g);
    }
    // kerning: sjednocení párů, chybějící = 0
    const pary = new Set();
    for (const f of [fontA, fontB]) for (const l in f.kerning) for (const r in f.kerning[l]) pary.add(l + '\u0000' + r);
    const existuje = n => n.charAt(0) === '@' ? !!F.skupiny[n] : !!F.glyfy[n];
    for (const p of pary) {
      const [l, r] = p.split('\u0000');
      if (!existuje(l) || !existuje(r)) continue;
      const a = (fontA.kerning[l] || {})[r] || 0, b = (fontB.kerning[l] || {})[r] || 0;
      const h = Math.round(LB(a, b));
      if (h) (F.kerning[l] || (F.kerning[l] = {}))[r] = h;
    }
    F.ligatury = (F.ligatury || []).filter(l => F.glyfy[l.na] && l.z.every(n => F.glyfy[n]));
    return { font: F, preskoceno };
  };
})(typeof window !== 'undefined' ? window : globalThis);
