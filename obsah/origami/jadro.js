/* Origami – jádro bez DOM (test: _test/origami_test.js).
   Model papíru = plošky (fazety): polygon v souřadnicích papíru `p`, afinní zobrazení `m`
   (papír → aktuální poloha na stole) a vrstva `z` (větší = blíž k divákovi).
   Operace: přehyb přímkou (údolní/horský/obrácený, všech nebo horních vrstev), otočení,
   pootočení, klíčový stav (sklad, který se nedá popsat jedním přehybem).
   Přehyby se zapisují jako rysky v souřadnicích papíru → z nich vzniká vzor přehybů (crease pattern).
   Souřadnice: y roste dolů (jako SVG). Rysky mají typ 'V' (údolí) / 'M' (hora) vůči straně,
   která ležela na začátku nahoře; vůči barevné straně je převádí vzorPrehybu(). */
(function () {
  'use strict';

  const EPS = 1e-7;

  /* ---------- vektory a afinní zobrazení m = [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f ---------- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mulS = (a, k) => [a[0] * k, a[1] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const delka = a => Math.hypot(a[0], a[1]);
  const jedn = a => { const l = delka(a); return [a[0] / l, a[1] / l]; };
  const kolmice = a => [-a[1], a[0]];
  const stred = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  const ID = [1, 0, 0, 1, 0, 0];
  const ap = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  function slozM(A, B) { // A ∘ B
    return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
      A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  }
  const det = m => m[0] * m[3] - m[1] * m[2];
  function invM(m) {
    const d = det(m), a = m[3] / d, b = -m[1] / d, c = -m[2] / d, e = m[0] / d;
    return [a, b, c, e, -(a * m[4] + c * m[5]), -(b * m[4] + e * m[5])];
  }
  /** Zrcadlení podle přímky bodem o se směrem u (jednotkovým). */
  function odrazM(o, u) {
    const a = u[0] * u[0] - u[1] * u[1], b = 2 * u[0] * u[1];
    return [a, b, b, -a, o[0] - (a * o[0] + b * o[1]), o[1] - (b * o[0] - a * o[1])];
  }
  function rotaceM(st, uhelSt) {
    const r = uhelSt * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return [c, s, -s, c, st[0] - (c * st[0] - s * st[1]), st[1] - (s * st[0] + c * st[1])];
  }
  /** Afinní zobrazení ze tří dvojic bodů (papír → stůl). */
  function mZBodu(p, c) {
    const P = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[2][0] - p[0][0], p[2][1] - p[0][1]];
    const C = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[2][0] - c[0][0], c[2][1] - c[0][1]];
    const dP = P[0] * P[3] - P[2] * P[1];
    if (Math.abs(dP) < 1e-12) throw new Error('mZBodu: body papíru leží na přímce');
    // M2 = C · P⁻¹ (sloupce: obrazy vektorů)
    const iP = [P[3] / dP, -P[1] / dP, -P[2] / dP, P[0] / dP];
    const a = C[0] * iP[0] + C[2] * iP[1], b = C[1] * iP[0] + C[3] * iP[1];
    const cc = C[0] * iP[2] + C[2] * iP[3], d = C[1] * iP[2] + C[3] * iP[3];
    return [a, b, cc, d, c[0][0] - (a * p[0][0] + cc * p[0][1]), c[0][1] - (b * p[0][0] + d * p[0][1])];
  }

  /* ---------- polygony ---------- */
  function plocha(poly) { let s = 0; for (let i = 0; i < poly.length; i++) s += cross(poly[i], poly[(i + 1) % poly.length]); return s / 2; }
  function teziste(poly) { let x = 0, y = 0; for (const p of poly) { x += p[0]; y += p[1]; } return [x / poly.length, y / poly.length]; }
  function vzdUsecka(p, a, b) {
    const ab = sub(b, a), l2 = dot(ab, ab);
    const t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
    return delka(sub(p, add(a, mulS(ab, t))));
  }
  function obsahujeBod(poly, p, tol = 1e-6) {
    for (let i = 0; i < poly.length; i++) if (vzdUsecka(p, poly[i], poly[(i + 1) % poly.length]) < tol) return true;
    let uvnitr = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) uvnitr = !uvnitr;
    }
    return uvnitr;
  }
  /** Rozdělí polygon podle hodnot d (znaménková vzdálenost vrcholů) – vrací [kladna, zaporna]. */
  function rozdelPoly(poly, d) {
    const A = [], B = [];
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length, p = poly[i], q = poly[j], dp = d[i], dq = d[j];
      if (dp >= -EPS) A.push(p);
      if (dp <= EPS) B.push(p);
      if ((dp > EPS && dq < -EPS) || (dp < -EPS && dq > EPS)) {
        const x = lerp(p, q, dp / (dp - dq));
        A.push(x); B.push(x);
      }
    }
    return [cistiPoly(A), cistiPoly(B)];
  }
  function cistiPoly(poly) {
    const r = [];
    for (const p of poly) if (!r.length || delka(sub(p, r[r.length - 1])) > 1e-9) r.push(p);
    if (r.length > 1 && delka(sub(r[0], r[r.length - 1])) < 1e-9) r.pop();
    return r;
  }
  /** Ořízne úsečku konvexním polygonem (libovolné orientace). Vrací [a, b] nebo null. */
  function orizniUsecku(a, b, poly) {
    const s = plocha(poly) > 0 ? 1 : -1;
    let t0 = 0, t1 = 1;
    const ab = sub(b, a);
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const e = sub(q, p), n = [-e[1] * s, e[0] * s]; // vnitřní normála
      const num = dot(sub(a, p), n), den = dot(ab, n);
      if (Math.abs(den) < 1e-12) { if (num < -1e-6) return null; continue; }
      const t = -num / den;
      if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
      if (t0 > t1 - 1e-9) return null;
    }
    return [lerp(a, b, t0), lerp(a, b, t1)];
  }
  /** Společná část dvou hran (kolineárních) s kladnou délkou, nebo null. */
  function spolecnaHrana(a1, a2, b1, b2) {
    const u = sub(a2, a1), L = delka(u);
    if (L < 1e-9) return null;
    const n = [-u[1] / L, u[0] / L];
    if (Math.abs(dot(sub(b1, a1), n)) > 1e-6 || Math.abs(dot(sub(b2, a1), n)) > 1e-6) return null;
    const t1 = dot(sub(b1, a1), u) / (L * L), t2 = dot(sub(b2, a1), u) / (L * L);
    const lo = Math.max(0, Math.min(t1, t2)), hi = Math.min(1, Math.max(t1, t2));
    if ((hi - lo) * L < 1e-6) return null;
    return [lerp(a1, a2, lo), lerp(a1, a2, hi)];
  }

  /* ---------- stav papíru ---------- */
  /** listy: [{w, h, rubNahoru}] – rubNahoru = začíná se bílou (rubovou) stranou nahoru. */
  function novyStav(listy) {
    listy = (listy || [{ w: 1, h: 1 }]).map(l => ({ w: l.w || 1, h: l.h || 1, rubNahoru: !!l.rubNahoru }));
    const facety = listy.map((l, s) => ({ p: [[0, 0], [l.w, 0], [l.w, l.h], [0, l.h]], m: ID.slice(), z: 0, s }));
    return { listy, facety, rysky: [] };
  }
  const kopieStavu = st => ({ listy: st.listy, facety: st.facety.map(f => Object.assign({}, f)), rysky: st.rysky.slice() });
  const polohaFacety = f => f.p.map(p => ap(f.m, p));
  function ohraniceni(facety) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const f of facety) for (const q of (f.c || polohaFacety(f))) {
      x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
    }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, st: [(x0 + x1) / 2, (y0 + y1) / 2] };
  }
  /** Seřadí vrstvy na celá čísla 0..n-1 (zachová pořadí i shody). */
  function normalizujZ(facety) {
    const hodnoty = [...new Set(facety.map(f => f.z))].sort((a, b) => a - b);
    const mapa = new Map(hodnoty.map((h, i) => [h, i]));
    for (const f of facety) f.z = mapa.get(f.z);
  }
  /** Aktuální poloha bodu papíru (horní ploška, která ho obsahuje). */
  function bod(st, P, s = 0) {
    let nej = null;
    for (const f of st.facety) {
      if (f.s !== s || f.nemap || !obsahujeBod(f.p, P)) continue;
      if (!nej || f.z > nej.z) nej = f;
    }
    if (!nej) throw new Error('bod mimo papír: ' + P);
    return ap(nej.m, P);
  }
  const vyres = (st, x) => typeof x === 'function' ? x(st) : x;
  const vidimeHorniStranu = f => det(f.m) > 0;

  /* ---------- přehyb ---------- */
  /** Přímka přehybu z operace: {o, u, n}, n míří na pohyblivou stranu. */
  function caraOperace(st, op) {
    if (op.k) {
      const P = vyres(st, op.k[0]), Q = vyres(st, op.k[1]);
      const n = jedn(sub(P, Q));
      return { o: stred(P, Q), u: kolmice(n), n, P };
    }
    const c = vyres(st, op.cara), A = vyres(st, c[0]), B = vyres(st, c[1]), S = vyres(st, op.strana);
    const u = jedn(sub(B, A));
    let n = kolmice(u);
    if (dot(sub(S, A), n) < 0) n = mulS(n, -1);
    return { o: A, u, n };
  }

  /** Sdílí plošky hranu papíru? Hrana ležící na přímce přehybu (vz ≈ 0) se nepočítá – to je právě ohýbaný kloub. */
  function sousedi(f, g, vz) {
    if (f.s !== g.s) return false;
    for (let i = 0; i < f.p.length; i++) {
      const a1 = f.p[i], a2 = f.p[(i + 1) % f.p.length];
      for (let j = 0; j < g.p.length; j++) {
        const h = spolecnaHrana(a1, a2, g.p[j], g.p[(j + 1) % g.p.length]);
        if (h && !(vz && Math.abs(vz(ap(f.m, h[0]))) < 1e-6 && Math.abs(vz(ap(f.m, h[1]))) < 1e-6)) return true;
      }
    }
    return false;
  }
  const naOkrajiListu = (a, b, l) => (Math.abs(a[0]) < 1e-9 && Math.abs(b[0]) < 1e-9) || (Math.abs(a[1]) < 1e-9 && Math.abs(b[1]) < 1e-9) ||
    (Math.abs(a[0] - l.w) < 1e-9 && Math.abs(b[0] - l.w) < 1e-9) || (Math.abs(a[1] - l.h) < 1e-9 && Math.abs(b[1] - l.h) < 1e-9);

  /** Provede přehyb. Vrací {stav, kusy, pohyb (Set indexů v kusy), cara, rysky (nové)}.
      op: {druh: 'udoli'|'hora'|'vnitrni'|'vnejsi', k:[P,Q] | cara:[A,B]+strana:S, vrstvy:n (horních n
      na místě `bod`, záporné = zespodu), bod, filtr(teziste)→bool, rozlozit} */
  function prehyb(st, op) {
    const druh = op.druh || 'udoli';
    const cara = caraOperace(st, op);
    const vz = q => dot(sub(q, cara.o), cara.n);
    // 1) rozdělení plošek přímkou
    const kusy = [];
    st.facety.forEach((f, i) => {
      const c = polohaFacety(f), d = c.map(vz);
      const max = Math.max(...d), min = Math.min(...d);
      if (min >= -EPS) kusy.push(Object.assign({}, f, { strana: 1, puvod: i }));
      else if (max <= EPS) kusy.push(Object.assign({}, f, { strana: -1, puvod: i }));
      else {
        const [A, B] = rozdelPoly(f.p, d);
        kusy.push(Object.assign({}, f, { p: A, strana: 1, puvod: i, rozdelen: true }));
        kusy.push(Object.assign({}, f, { p: B, strana: -1, puvod: i, rozdelen: true }));
      }
    });
    // 2) výběr pohyblivých kusů
    const kand = kusy.map((k, i) => i).filter(i => kusy[i].strana === 1 && (!op.filtr || op.filtr(teziste(polohaFacety(kusy[i])))) &&
      (!op.papir || op.papir(teziste(kusy[i].p), kusy[i].s)));
    let pohyb;
    if (op.vrstvy) {
      const B = vyres(st, op.bod || (op.k && op.k[0]));
      if (!B) throw new Error('přehyb s vrstvami potřebuje bod');
      const naBode = kand.filter(i => obsahujeBod(polohaFacety(kusy[i]), B)).sort((a, b) => op.vrstvy > 0 ? kusy[b].z - kusy[a].z : kusy[a].z - kusy[b].z);
      pohyb = new Set(naBode.slice(0, Math.abs(op.vrstvy)));
      if (!pohyb.size) throw new Error('v bodě přehybu není papír: ' + B.map(v => v.toFixed(3)));
      const fronta = [...pohyb];
      while (fronta.length) {
        const i = fronta.pop();
        if (kusy[i].nemap) continue;
        for (const j of kand) if (!pohyb.has(j) && sousedi(kusy[i], kusy[j], vz)) { pohyb.add(j); fronta.push(j); }
      }
    } else pohyb = new Set(kand);
    // 3) rozdělené plošky, kterými nic nehýbe, zase spojit
    const vysl = [], novePohyb = new Set();
    const hybaPuvod = new Set([...pohyb].map(i => kusy[i].puvod));
    const hotovo = new Set();
    kusy.forEach((k, i) => {
      if (k.rozdelen && !hybaPuvod.has(k.puvod)) {
        if (hotovo.has(k.puvod)) return;
        hotovo.add(k.puvod);
        const f = Object.assign({}, st.facety[k.puvod], { strana: 0, puvod: k.puvod });
        vysl.push(f); return;
      }
      if (pohyb.has(i)) novePohyb.add(vysl.length);
      vysl.push(k);
    });
    // 4) rysky na pohyblivých kusech (hrany ležící na přímce)
    const rysky = [];
    const zPoh = [...novePohyb].map(i => vysl[i].z);
    const zMid = (Math.max(...zPoh) + Math.min(...zPoh)) / 2;
    for (const i of novePohyb) {
      const f = vysl[i];
      if (f.nemap) continue;
      const c = polohaFacety(f);
      for (let a = 0; a < f.p.length; a++) {
        const b = (a + 1) % f.p.length;
        if (Math.abs(vz(c[a])) > 1e-6 || Math.abs(vz(c[b])) > 1e-6) continue;
        if (naOkrajiListu(f.p[a], f.p[b], st.listy[f.s])) continue;
        let proDivaka = druh === 'hora' ? 'M' : 'V';
        if (druh === 'vnitrni') proDivaka = f.z >= zMid ? 'M' : 'V';
        if (druh === 'vnejsi') proDivaka = f.z >= zMid ? 'V' : 'M';
        const t = vidimeHorniStranu(f) ? proDivaka : (proDivaka === 'V' ? 'M' : 'V');
        rysky.push({ a: f.p[a], b: f.p[b], t, s: f.s });
      }
    }
    if (op.rozlozit) {
      const novy = kopieStavu(st);
      novy.rysky = pridejRysky(novy.rysky, rysky);
      return { stav: novy, kusy: vysl, pohyb: novePohyb, cara, rysky, druh };
    }
    // 5) zrcadlení a nové vrstvy
    const R = odrazM(cara.o, cara.u);
    const zAll = vysl.map(f => f.z), zMax = Math.max(...zAll), zMin = Math.min(...zAll);
    const zMaxP = Math.max(...zPoh), zMinP = Math.min(...zPoh);
    const facety = vysl.map((f, i) => {
      const g = { p: f.p, m: f.m, z: f.z, s: f.s };
      if (f.nemap) g.nemap = true;
      if (!novePohyb.has(i)) return g;
      g.m = slozM(R, f.m);
      if (druh === 'udoli') g.z = zMax + 1 + (zMaxP - f.z);
      else if (druh === 'hora') g.z = zMin - 1 - (f.z - zMinP);
      else if (druh === 'vnitrni') g.z = zMid + (f.z - zMid) * 0.3;
      else g.z = f.z + (f.z >= zMid ? 1000 : -1000);
      return g;
    });
    normalizujZ(facety);
    const novy = { listy: st.listy, facety, rysky: pridejRysky(st.rysky, rysky) };
    return { stav: novy, kusy: vysl, pohyb: novePohyb, cara, rysky, druh };
  }

  /** Přidá rysky; stejná úsečka (i obráceně) se nahradí novějším typem. */
  function pridejRysky(stare, nove) {
    const klic = r => {
      const a = r.a.map(v => v.toFixed(5)).join(','), b = r.b.map(v => v.toFixed(5)).join(',');
      return r.s + ':' + (a < b ? a + '|' + b : b + '|' + a);
    };
    const mapa = new Map(stare.map(r => [klic(r), r]));
    for (const r of nove) mapa.set(klic(r), r);
    return [...mapa.values()];
  }

  /* ---------- otočení a pootočení ---------- */
  function otoc(st, osa) {
    const b = ohraniceni(st.facety);
    const F = osa === 'x' ? [1, 0, 0, -1, 0, 2 * b.st[1]] : [-1, 0, 0, 1, 2 * b.st[0], 0];
    const facety = st.facety.map(f => Object.assign({}, f, { m: slozM(F, f.m), z: -f.z }));
    normalizujZ(facety);
    return { listy: st.listy, facety, rysky: st.rysky };
  }
  function pootoc(st, uhel) {
    const R = rotaceM(ohraniceni(st.facety).st, uhel);
    return { listy: st.listy, facety: st.facety.map(f => Object.assign({}, f, { m: slozM(R, f.m) })), rysky: st.rysky };
  }

  /* ---------- klíčový stav ---------- */
  /** Plošky klíčového stavu: [{p, c, z, s}] (p = papír, c = poloha) nebo bez p = jen obrázek
      ({c, z, lic: true/false}). Rysky mapovaných plošek se doplní automaticky ze sousedství. */
  function klicovyStav(st, plosky) {
    const listy = st.listy.slice();
    for (const k of plosky) if (!listy[k.s || 0]) listy[k.s] = Object.assign({}, listy[0]);
    st = { listy, facety: st.facety, rysky: st.rysky };
    const facety = plosky.map(k => {
      const s = k.s || 0;
      if (k.p) return { p: k.p, m: mZBodu(k.p, k.c), z: k.z, s };
      // nemapovaná ploška (jen obrázek): strana podle lic/rub vůči horní straně listu
      const horniJeLic = !st.listy[s].rubNahoru;
      const nahore = (k.lic !== false) === horniJeLic; // výchozí = barevná strana
      return nahore ? { p: k.c.map(q => q.slice()), m: ID.slice(), z: k.z, s, nemap: true }
        : { p: k.c.map(q => [-q[0], q[1]]), m: [-1, 0, 0, 1, 0, 0], z: k.z, s, nemap: true };
    });
    normalizujZ(facety);
    const rysky = ryskyZeSousedstvi(facety, st.listy);
    return { listy: st.listy, facety, rysky: pridejRysky(st.rysky, rysky) };
  }
  const stejneM = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  function ryskyZeSousedstvi(facety, listy) {
    const r = [];
    for (let i = 0; i < facety.length; i++) for (let j = i + 1; j < facety.length; j++) {
      const f = facety[i], g = facety[j];
      if (f.nemap || g.nemap || f.s !== g.s || stejneM(f.m, g.m)) continue;
      for (let a = 0; a < f.p.length; a++) for (let b = 0; b < g.p.length; b++) {
        const h = spolecnaHrana(f.p[a], f.p[(a + 1) % f.p.length], g.p[b], g.p[(b + 1) % g.p.length]);
        if (!h || naOkrajiListu(h[0], h[1], listy[f.s])) continue;
        const U = vidimeHorniStranu(f) ? f : g, O = U === f ? g : f;
        r.push({ a: h[0], b: h[1], t: U.z > O.z ? 'M' : 'V', s: f.s });
      }
    }
    return r;
  }

  /* ---------- průběh modelu ---------- */
  /** Provede operaci, vrací {stav, anim}. */
  function proved(st, op) {
    if (op.op === 'prehyb') {
      const r = prehyb(st, op);
      return { stav: r.stav, anim: { typ: 'prehyb', kusy: r.kusy, pohyb: r.pohyb, cara: r.cara, druh: r.druh, rozlozit: !!op.rozlozit } };
    }
    if (op.op === 'otoc') return { stav: otoc(st, op.osa), anim: { typ: 'otoc', osa: op.osa || 'y', st: ohraniceni(st.facety).st } };
    if (op.op === 'pootoc') return { stav: pootoc(st, op.uhel), anim: { typ: 'pootoc', uhel: op.uhel, st: ohraniceni(st.facety).st } };
    if (op.op === 'stav') return { stav: klicovyStav(st, op.plosky(st)), anim: { typ: 'prolnuti' } };
    if (op.op === 'vice') { // několik operací v jednom kroku (např. oba rohy) – animují se postupně
      let s = st;
      const casti = [];
      for (const o of op.ops) { const r = proved(s, o); casti.push({ op: o, pred: s, po: r.stav, anim: r.anim }); s = r.stav; }
      return { stav: s, anim: { typ: 'vice', casti } };
    }
    throw new Error('neznámá operace ' + op.op);
  }
  /** Sestaví model: {zacatek: stav, kroky: [{op, pred, po, anim}]}. */
  function sestav(model) {
    let st = novyStav(model.listy);
    for (const op of model.uvod || []) st = proved(st, op).stav;
    const zacatek = st;
    const kroky = [];
    for (const op of model.kroky) {
      let r;
      try { r = proved(st, op); } catch (e) { throw new Error(`${model.id || 'model'}, krok ${kroky.length + 1}: ${e.message}`); }
      kroky.push({ op, pred: st, po: r.stav, anim: r.anim });
      st = r.stav;
    }
    return { zacatek, kroky, konec: st };
  }

  /* ---------- snímek pro kreslení (2D i 3D) ---------- */
  /** Seznam polygonů {b: [[x,y,h]...], horni: bool (vidíme horní stranu listu), s, f (ploška – kvůli ryskám), poradi}.
      t ∈ [0,1] = průběh animace kroku. */
  function snimek(krok, t) {
    const a = krok && krok.anim;
    const zakladni = st => st.facety.map(f => ({ b: polohaFacety(f).map(q => [q[0], q[1], f.z * 0.004]), horni: vidimeHorniStranu(f), s: f.s, f, m: f.m, poradi: f.z }));
    if (!krok) return [];
    if (a && a.typ === 'vice' && t > 0 && t < 1) {
      const n = a.casti.length, i = Math.min(n - 1, Math.floor(t * n));
      return snimek(a.casti[i], t * n - i);
    }
    if (!a || t <= 0) return zakladni(krok.pred);
    if (t >= 1 && a.typ !== 'prehyb') return zakladni(krok.po);
    if (a.typ === 'prehyb') {
      if (t >= 1 && !a.rozlozit) return zakladni(krok.po);
      const th = a.rozlozit ? Math.PI * 0.9 * Math.sin(Math.PI * t) : Math.PI * t;
      const smer = (a.druh === 'hora') ? -1 : 1;
      const zs = a.kusy.map(k => k.z), zMax = Math.max(...zs), zMin = Math.min(...zs);
      const cos = Math.cos(th), sin = Math.sin(th);
      return a.kusy.map((k, i) => {
        const c = polohaFacety(k);
        if (!a.pohyb.has(i)) return { b: c.map(q => [q[0], q[1], k.z * 0.004]), horni: vidimeHorniStranu(k), s: k.s, f: k, m: k.m, poradi: k.z };
        const b = c.map(q => {
          const d = dot(sub(q, a.cara.o), a.cara.n);
          const r = sub(q, mulS(a.cara.n, d * (1 - cos)));
          return [r[0], r[1], k.z * 0.004 + smer * d * sin];
        });
        const horni = vidimeHorniStranu(k) === (cos >= 0);
        // pořadí kreslení: nad (údolí) / pod (hora) ostatními, po polovině obrácené
        const rel = cos >= 0 ? k.z - zMin : zMax - k.z;
        const poradi = smer > 0 ? zMax + 1 + rel : zMin - 1 - (zMax - zMin - rel);
        // m pro kreslení rysek: zobrazení papír → průmět (afinní, protože jde o rovinnou plošku)
        const m = Math.abs(cos) < 1e-3 ? null : mZBodu(k.p.slice(0, 3), b.slice(0, 3).map(q => [q[0], q[1]]));
        return { b, horni, s: k.s, f: k, m, poradi };
      });
    }
    if (a.typ === 'otoc') {
      const cos = Math.cos(Math.PI * t), sin = Math.sin(Math.PI * t);
      return krok.pred.facety.map(f => {
        const b = polohaFacety(f).map(q => a.osa === 'x'
          ? [q[0], a.st[1] + (q[1] - a.st[1]) * cos, f.z * 0.004 * cos - (q[1] - a.st[1]) * sin]
          : [a.st[0] + (q[0] - a.st[0]) * cos, q[1], f.z * 0.004 * cos + (q[0] - a.st[0]) * sin]);
        const m = Math.abs(cos) < 1e-3 ? null : mZBodu(f.p.slice(0, 3), b.slice(0, 3).map(q => [q[0], q[1]]));
        return { b, horni: vidimeHorniStranu(f) === (cos >= 0), s: f.s, f, m, poradi: cos >= 0 ? f.z : -f.z };
      });
    }
    if (a.typ === 'pootoc') {
      const R = rotaceM(a.st, a.uhel * t);
      return krok.pred.facety.map(f => {
        const m = slozM(R, f.m);
        return { b: f.p.map(p => { const q = ap(m, p); return [q[0], q[1], f.z * 0.004]; }), horni: vidimeHorniStranu(f), s: f.s, f, m, poradi: f.z };
      });
    }
    // prolnutí: obě sady s průhledností
    return zakladni(krok.pred).map(x => Object.assign(x, { pruhl: 1 - t })).concat(zakladni(krok.po).map(x => Object.assign(x, { pruhl: t, poradi: x.poradi + 1e4 })));
  }

  /* ---------- kreslení do SVG ---------- */
  const BARVY = { lic: '#d9534f', lic2: '#3b6fb6', rub: '#fbf8f1', cara: '#1d1d1f', ryska: '#8c8c8c' };
  const f3 = v => (Math.round(v * 1000) / 1000).toString();
  const bodyStr = pts => pts.map(q => f3(q[0]) + ',' + f3(q[1])).join(' ');
  function barvaStrany(st, poly, barvy) {
    const l = st.listy[poly.s] || st.listy[0];
    const horniLic = !l.rubNahoru;
    const lic = poly.horni === horniLic;
    const sada = poly.s ? barvy.lic2 : barvy.lic;
    return lic ? sada : barvy.rub;
  }
  /** Rámec pro kreslení: ohraničení + okraj. */
  function ramec(kroky, okraj = 0.12) {
    let b = null;
    for (const k of kroky) for (const st of [k.pred, k.po]) {
      if (!st) continue;
      const o = ohraniceni(st.facety);
      b = b ? { x0: Math.min(b.x0, o.x0), y0: Math.min(b.y0, o.y0), x1: Math.max(b.x1, o.x1), y1: Math.max(b.y1, o.y1) } : o;
    }
    const roz = Math.max(b.x1 - b.x0, b.y1 - b.y0) * okraj;
    return { x: b.x0 - roz, y: b.y0 - roz, w: b.x1 - b.x0 + 2 * roz, h: b.y1 - b.y0 + 2 * roz };
  }
  /** Polygony + rysky jako SVG fragment. */
  function svgPolygony(st, polys, barvy) {
    const r = [];
    const serazene = polys.slice().sort((a, b) => a.poradi - b.poradi);
    for (const p of serazene) {
      const op = p.pruhl !== undefined ? ` opacity="${f3(p.pruhl)}"` : '';
      r.push(`<g${op}><polygon points="${bodyStr(p.b)}" fill="${barvaStrany(st, p, barvy)}" stroke="${barvy.cara}" stroke-width="1.3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`);
      if (p.m && !p.f.nemap && st.rysky.length) {
        const cary = [];
        for (const ry of st.rysky) {
          if (ry.s !== p.s) continue;
          const o = orizniUsecku(ry.a, ry.b, p.f.p);
          if (!o || delka(sub(o[1], o[0])) < 1e-6) continue;
          const a = ap(p.m, o[0]), b = ap(p.m, o[1]);
          cary.push(`M${f3(a[0])} ${f3(a[1])}L${f3(b[0])} ${f3(b[1])}`);
        }
        if (cary.length) r.push(`<path d="${cary.join('')}" stroke="${barvy.ryska}" stroke-width="0.7" fill="none" vector-effect="non-scaling-stroke"/>`);
      }
      r.push('</g>');
    }
    return r.join('');
  }

  /* značky: šipky a čáry přehybu (v souřadnicích modelu, šířky v px díky non-scaling-stroke) */
  const POMLCKY = { udoli: '7 4', hora: '8 3 1.5 3 1.5 3', vnitrni: '7 4', vnejsi: '8 3 1.5 3 1.5 3' };
  /** Úsek přímky přehybu přes papír. */
  function usekCary(facety, cara, presah) {
    let t0 = Infinity, t1 = -Infinity;
    const A = sub(cara.o, mulS(cara.u, 100)), B = add(cara.o, mulS(cara.u, 100));
    for (const f of facety) {
      const o = orizniUsecku(A, B, polohaFacety(f));
      if (!o) continue;
      for (const q of o) { const t = dot(sub(q, cara.o), cara.u); t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
    }
    if (t0 > t1) return null;
    return [add(cara.o, mulS(cara.u, t0 - presah)), add(cara.o, mulS(cara.u, t1 + presah))];
  }
  /** Reprezentativní bod, který se přehybem pohne (nejvzdálenější vrchol horního pohyblivého kusu). */
  function bodPohybu(r) {
    let nej = null, nejD = -1;
    const horni = [...r.pohyb].map(i => r.kusy[i]).sort((a, b) => b.z - a.z);
    const zMax = horni.length ? horni[0].z : 0;
    for (const k of horni) {
      if (k.z !== zMax && nej) continue;
      for (const q of polohaFacety(k)) { const d = dot(sub(q, r.cara.o), r.cara.n); if (d > nejD + 1e-9) { nejD = d; nej = q; } }
    }
    return nej;
  }
  function hrot(konec, smer, vel, plny) {
    const n = kolmice(smer), z = sub(konec, mulS(smer, vel));
    const a = add(z, mulS(n, vel * 0.45)), b = sub(z, mulS(n, vel * 0.45));
    return plny ? `<polygon points="${bodyStr([konec, a, b])}" fill="#1d1d1f" stroke="#fff" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`
      : `<polyline points="${bodyStr([a, konec, b])}" fill="none" stroke="#1d1d1f" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`;
  }
  /** Oblouková šipka z P do Q; vel = měřítko hrotu. */
  function sipka(P, Q, vel, typ, vyduti = 0.35) {
    const d = sub(Q, P), L = delka(d);
    if (L < 1e-6) return '';
    const n = kolmice(jedn(d));
    const C = add(stred(P, Q), mulS(n, L * vyduti));
    const smerKonec = jedn(sub(Q, C)), smerZac = jedn(sub(P, C));
    const draha = `M${f3(P[0])} ${f3(P[1])}Q${f3(C[0])} ${f3(C[1])} ${f3(Q[0])} ${f3(Q[1])}`;
    let s = `<path d="${draha}" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` +
      `<path d="${draha}" fill="none" stroke="#1d1d1f" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
    s += hrot(Q, smerKonec, vel, typ !== 'hora');
    if (typ === 'rozlozit') s += hrot(P, smerZac, vel * 0.8, false);
    return s;
  }
  /** Rovná dutá šipka (zatlačit, rozevřít…). */
  function sipkaRovna(P, Q, vel) {
    const d = jedn(sub(Q, P));
    return `<line x1="${f3(P[0])}" y1="${f3(P[1])}" x2="${f3(Q[0])}" y2="${f3(Q[1])}" stroke="#fff" stroke-width="3.6" vector-effect="non-scaling-stroke"/>` +
      `<line x1="${f3(P[0])}" y1="${f3(P[1])}" x2="${f3(Q[0])}" y2="${f3(Q[1])}" stroke="#1d1d1f" stroke-width="1.6" vector-effect="non-scaling-stroke"/>` +
      hrot(Q, d, vel, false) + hrot(sub(Q, mulS(d, vel * 0.5)), d, vel, false);
  }
  /** Značky kroku (čára přehybu, šipka, symbol otočení…) do SVG. */
  function svgZnacky(krok, ram) {
    const vel = Math.max(ram.w, ram.h) * 0.045;
    const op = krok.op, a = krok.anim, r = [];
    if (a.typ === 'vice') return a.casti.map(c => svgZnacky(c, ram)).join('') + (op.sipky || []).map(s => sipkaRovna(vyres(krok.pred, s[0]), vyres(krok.pred, s[1]), vel)).join('');
    if (a.typ === 'prehyb') {
      // čára jen přes pohyblivé plošky (+ kousek přesahu)
      const u = usekCary(a.kusy.filter((k, i) => a.pohyb.has(i)), a.cara, vel * 0.8);
      if (u) {
        r.push(`<line x1="${f3(u[0][0])}" y1="${f3(u[0][1])}" x2="${f3(u[1][0])}" y2="${f3(u[1][1])}" stroke="#fff" stroke-width="3.4" vector-effect="non-scaling-stroke"/>`);
        r.push(`<line x1="${f3(u[0][0])}" y1="${f3(u[0][1])}" x2="${f3(u[1][0])}" y2="${f3(u[1][1])}" stroke="#1d1d1f" stroke-width="1.6" stroke-dasharray="${POMLCKY[a.druh]}" vector-effect="non-scaling-stroke"/>`);
      }
      const P = op.k ? vyres(krok.pred, op.k[0]) : bodPohybu(a);
      if (P) {
        const d = dot(sub(P, a.cara.o), a.cara.n);
        const Q = sub(P, mulS(a.cara.n, 2 * d));
        const Pz = lerp(P, Q, 0.06), Qz = lerp(P, Q, 0.94);
        const typ = op.rozlozit ? 'rozlozit' : (a.druh === 'hora' || a.druh === 'vnitrni') ? 'hora' : 'udoli';
        r.push(sipka(Pz, Qz, vel, typ, (op.vyduti || 0.35) * (op.obratSipku ? -1 : 1)));
      }
    } else if (a.typ === 'otoc') {
      r.push(symbolOtoceni(ram.x + ram.w - vel * 2.6, ram.y + vel * 2.2, vel * 1.6));
    } else if (a.typ === 'pootoc') {
      r.push(symbolPootoceni(ram.x + ram.w - vel * 2.6, ram.y + vel * 2.2, vel * 1.6, a.uhel));
    }
    for (const s of op.sipky || []) {
      const P = vyres(krok.pred, s[0]), Q = vyres(krok.pred, s[1]);
      r.push(s[2] === 'oblouk' ? sipka(P, Q, vel, 'udoli') : sipkaRovna(P, Q, vel));
    }
    return r.join('');
  }
  function symbolOtoceni(x, y, R) {
    // dvě protiběžné půlkruhové šipky – „otočte papír“
    const o1 = `M${f3(x - R)} ${f3(y)}A${f3(R)} ${f3(R * 0.55)} 0 0 1 ${f3(x + R)} ${f3(y)}`;
    const o2 = `M${f3(x + R)} ${f3(y + R * 0.25)}A${f3(R)} ${f3(R * 0.55)} 0 0 1 ${f3(x - R)} ${f3(y + R * 0.25)}`;
    return `<g class="sym-otoc"><path d="${o1}" fill="none" stroke="#1d1d1f" stroke-width="1.6" vector-effect="non-scaling-stroke"/>` +
      hrot([x + R, y], [0.15, 1], R * 0.45, true) +
      `<path d="${o2}" fill="none" stroke="#1d1d1f" stroke-width="1.6" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>` +
      hrot([x - R, y + R * 0.25], [-0.15, -1], R * 0.45, false) + '</g>';
  }
  function symbolPootoceni(x, y, R, uhel) {
    const sm = uhel >= 0 ? 1 : 0;
    const a0 = [x - R, y], a1 = [x + R * 0.7, y - R * 0.7];
    const d = `M${f3(a0[0])} ${f3(a0[1])}A${f3(R)} ${f3(R)} 0 0 ${sm} ${f3(a1[0])} ${f3(a1[1])}`;
    return `<path d="${d}" fill="none" stroke="#1d1d1f" stroke-width="1.6" vector-effect="non-scaling-stroke"/>` + hrot(a1, jedn(uhel >= 0 ? [0.7, 0.7] : [-0.7, -0.7]), R * 0.45, true);
  }
  /** Celé SVG kroku. t = průběh animace (0 = diagram před krokem se značkami). */
  function svgKroku(sestava, i, t, volby) {
    volby = volby || {};
    const barvy = Object.assign({}, BARVY, volby.barvy || {});
    const ram = volby.ramec || ramec([sestava.kroky[Math.min(i, sestava.kroky.length - 1)]]);
    const vb = `${f3(ram.x)} ${f3(ram.y)} ${f3(ram.w)} ${f3(ram.h)}`;
    let obsah;
    if (i >= sestava.kroky.length) { // hotový model
      const k = sestava.kroky[sestava.kroky.length - 1];
      obsah = svgPolygony(k.po, snimek({ pred: k.po, anim: null }, 0), barvy);
    } else {
      const k = sestava.kroky[i];
      // rysky kreslí stav po kroku (u přehybu s rozložením jsou nové rysky vidět hned)
      let stR = t > 0 ? k.po : k.pred;
      if (k.anim.typ === 'vice' && t > 0 && t < 1) { const n = k.anim.casti.length; stR = k.anim.casti[Math.min(n - 1, Math.floor(t * n))].po; }
      obsah = svgPolygony(stR, snimek(k, t), barvy);
      if (!t && volby.znacky !== false) obsah += svgZnacky(k, ram);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="diagram${volby.trida ? ' ' + volby.trida : ''}" preserveAspectRatio="xMidYMid meet">${obsah}</svg>`;
  }

  /* ---------- vzor přehybů (crease pattern) ---------- */
  /** Rysky listu s vůči zvolené straně: 'lic' (barevná) nebo 'rub'. Při pohledu na rub je vzor zrcadlený
      a hora/údolí prohozené. Vrací [{a, b, t}] v souřadnicích listu (0..w, 0..h). */
  function vzorPrehybu(sestava, strana = 'lic', s = 0, osa = 'x') {
    const l = sestava.konec.listy[s];
    const prohod = t => t === 'V' ? 'M' : 'V';
    const zrc = (q, o) => o === 'y' ? [q[0], l.h - q[1]] : [l.w - q[0], q[1]];
    // 1) do pohledu na líc (rysky jsou vůči straně, která byla na začátku nahoře)
    let r = sestava.konec.rysky.filter(x => x.s === s).map(x => l.rubNahoru ? { a: zrc(x.a, 'x'), b: zrc(x.b, 'x'), t: prohod(x.t) } : { a: x.a, b: x.b, t: x.t });
    // 2) pohled na rub = zrcadlo podle osy, kolem které se list při tisku otáčí
    if (strana === 'rub') r = r.map(x => ({ a: zrc(x.a, osa), b: zrc(x.b, osa), t: prohod(x.t) }));
    return r;
  }

  /* ---------- papír k tisku: rozvržení čtverců na A4 ---------- */
  const A4 = { w: 210, h: 297 };
  /** Kolik čtverců strany a (mm) se vejde na A4 s okrajem tiskárny a mezerou; vrací pozice levých horních rohů. */
  function rozvrzeni(a, okraj = 6, mezera = 4, list = A4) {
    a = Number(a);
    if (!(a > 0)) return { pozice: [], sloupcu: 0, radku: 0 };
    const sl = Math.floor((list.w - 2 * okraj + mezera) / (a + mezera));
    const rd = Math.floor((list.h - 2 * okraj + mezera) / (a + mezera));
    if (sl < 1 || rd < 1) return { pozice: [], sloupcu: 0, radku: 0 };
    const sirka = sl * a + (sl - 1) * mezera, vyska = rd * a + (rd - 1) * mezera;
    const x0 = (list.w - sirka) / 2, y0 = (list.h - vyska) / 2;
    const pozice = [];
    for (let r = 0; r < rd; r++) for (let c = 0; c < sl; c++) pozice.push({ x: x0 + c * (a + mezera), y: y0 + r * (a + mezera) });
    return { pozice, sloupcu: sl, radku: rd, a };
  }
  /** Největší čtverec z A4 (s okrajem). */
  const maxCtverec = (okraj = 6, list = A4) => Math.min(list.w, list.h) - 2 * okraj;
  /** Poloha čtverce na rubové stránce při oboustranném tisku.
      otaceni 'dlouha' = list se otáčí kolem delší hrany (zrcadlí se vodorovně), 'kratka' = kolem kratší (svisle). */
  function zrcadliPozici(poz, a, otaceni = 'dlouha', list = A4) {
    return otaceni === 'kratka' ? { x: poz.x, y: list.h - poz.y - a } : { x: list.w - poz.x - a, y: poz.y };
  }

  /* ---------- vzory papíru (SVG <pattern>, jednotky mm) ---------- */
  const VZORY = [
    { id: 'plna', nazev: 'Jednobarevný' },
    { id: 'puntiky', nazev: 'Puntíky' },
    { id: 'pruhy', nazev: 'Pruhy' },
    { id: 'diagonaly', nazev: 'Šikmé pruhy' },
    { id: 'kostka', nazev: 'Šachovnice' },
    { id: 'mrizka', nazev: 'Mřížka' },
    { id: 'seigaiha', nazev: 'Vlny seigaiha' },
    { id: 'asanoha', nazev: 'Konopný list (asanoha)' },
    { id: 'kosoctverce', nazev: 'Kosočtverce' },
    { id: 'hvezdicky', nazev: 'Hvězdičky' },
    { id: 'kvitky', nazev: 'Kvítky' },
    { id: 'prechod', nazev: 'Barevný přechod' }
  ];
  /** Definice vzoru: vrací {defs, fill} – fill použitelný jako atribut fill. m = velikost motivu v mm. */
  function vzorSvg(id, typ, b1, b2, m = 10) {
    m = Math.max(2, Number(m) || 10);
    const pat = (w, h, obsah, rot) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${f3(w)}" height="${f3(h)}"${rot ? ` patternTransform="rotate(${rot})"` : ''}><rect width="${f3(w)}" height="${f3(h)}" fill="${b1}"/>${obsah}</pattern>`;
    const s = m, h = m / 2;
    switch (typ) {
      case 'puntiky': return { defs: pat(s, s, `<circle cx="${f3(h / 2)}" cy="${f3(h / 2)}" r="${f3(s * 0.14)}" fill="${b2}"/><circle cx="${f3(h * 1.5)}" cy="${f3(h * 1.5)}" r="${f3(s * 0.14)}" fill="${b2}"/>`), fill: `url(#${id})` };
      case 'pruhy': return { defs: pat(s, s, `<rect width="${f3(s)}" height="${f3(h)}" fill="${b2}"/>`), fill: `url(#${id})` };
      case 'diagonaly': return { defs: pat(s, s, `<rect width="${f3(h)}" height="${f3(s)}" fill="${b2}"/>`, 45), fill: `url(#${id})` };
      case 'kostka': return { defs: pat(s, s, `<rect width="${f3(h)}" height="${f3(h)}" fill="${b2}"/><rect x="${f3(h)}" y="${f3(h)}" width="${f3(h)}" height="${f3(h)}" fill="${b2}"/>`), fill: `url(#${id})` };
      case 'mrizka': return { defs: pat(h, h, `<path d="M0 0H${f3(h)}M0 0V${f3(h)}" stroke="${b2}" stroke-width="${f3(m * 0.04)}"/>`), fill: `url(#${id})` };
      case 'seigaiha': {
        // soustředné kruhy ve vystřídaných řadách (vlny)
        const vlna = (cx, cy) => [1, 0.75, 0.5, 0.25].map((k, i) => `<circle cx="${f3(cx)}" cy="${f3(cy)}" r="${f3(h * k)}" fill="${i % 2 ? b1 : b2}"/>`).join('');
        return { defs: `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${f3(s)}" height="${f3(h)}"><rect width="${f3(s)}" height="${f3(h)}" fill="${b1}"/>${vlna(h, 0)}${vlna(0, h / 2)}${vlna(s, h / 2)}${vlna(h, h)}</pattern>`, fill: `url(#${id})` };
      }
      case 'asanoha': {
        // trojúhelníková síť s paprsky ze středů – zjednodušený konopný list
        const w = s, v = s * Math.sqrt(3) / 2, c = [w / 2, v / 3];
        const cary = [[0, 0], [w, 0], [w / 2, v]].map(q => `M${f3(c[0])} ${f3(c[1])}L${f3(q[0])} ${f3(q[1])}`).join('') +
          `M0 0L${f3(w)} 0L${f3(w / 2)} ${f3(v)}Z M${f3(w / 2)} ${f3(v)}L${f3(w)} ${f3(2 * v)}M${f3(w / 2)} ${f3(v)}L0 ${f3(2 * v)}` +
          [[0, 2 * v], [w, 2 * v], [w / 2, v]].map(q => `M${f3(w / 2)} ${f3(v + 2 * v / 3)}L${f3(q[0])} ${f3(q[1])}`).join('');
        return { defs: `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${f3(w)}" height="${f3(2 * v)}"><rect width="${f3(w)}" height="${f3(2 * v)}" fill="${b1}"/><path d="${cary}" stroke="${b2}" stroke-width="${f3(m * 0.035)}" fill="none"/></pattern>`, fill: `url(#${id})` };
      }
      case 'kosoctverce': return { defs: pat(s, s, `<path d="M${f3(h)} 0L${f3(s)} ${f3(h)}L${f3(h)} ${f3(s)}L0 ${f3(h)}Z" fill="${b2}"/>`), fill: `url(#${id})` };
      case 'hvezdicky': {
        const hv = (cx, cy, r) => { const b = []; for (let i = 0; i < 10; i++) { const u = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; b.push([cx + rr * Math.cos(u), cy + rr * Math.sin(u)]); } return `<polygon points="${bodyStr(b)}" fill="${b2}"/>`; };
        return { defs: pat(s, s, hv(h / 2, h / 2, s * 0.18) + hv(h * 1.5, h * 1.5, s * 0.18)), fill: `url(#${id})` };
      }
      case 'kvitky': {
        const kv = (cx, cy, r) => [0, 72, 144, 216, 288].map(u => { const a = u * Math.PI / 180; return `<circle cx="${f3(cx + r * Math.cos(a))}" cy="${f3(cy + r * Math.sin(a))}" r="${f3(r * 0.75)}" fill="${b2}"/>`; }).join('') + `<circle cx="${f3(cx)}" cy="${f3(cy)}" r="${f3(r * 0.55)}" fill="${b1}"/>`;
        return { defs: pat(s, s, kv(h / 2, h / 2, s * 0.09) + kv(h * 1.5, h * 1.5, s * 0.09)), fill: `url(#${id})` };
      }
      case 'prechod': return { defs: `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient>`, fill: `url(#${id})` };
      default: return { defs: '', fill: b1 };
    }
  }

  /** SVG čar vzoru přehybů ve čtverci (x, y, a mm). Údolí čárkovaně, hora čerchovaně. */
  function svgVzoruPrehybu(vzor, list, x, y, a, volby) {
    volby = volby || {};
    const k = a / Math.max(list.w, list.h);
    const barva = volby.barva || '#555';
    const sirka = volby.sirka || 0.3;
    const obrys = list.w !== list.h ? `<rect x="${f3(x)}" y="${f3(y)}" width="${f3(list.w * k)}" height="${f3(list.h * k)}" fill="none" stroke="${barva}" stroke-width="${sirka}"/>` : '';
    return obrys + vzor.map(r => {
      const A = [x + r.a[0] * k, y + r.a[1] * k], B = [x + r.b[0] * k, y + r.b[1] * k];
      const pom = r.t === 'V' ? '3 1.6' : '3.5 1 0.6 1';
      return `<line x1="${f3(A[0])}" y1="${f3(A[1])}" x2="${f3(B[0])}" y2="${f3(B[1])}" stroke="${barva}" stroke-width="${sirka}" stroke-dasharray="${pom}"/>`;
    }).join('');
  }

  /** SVG jedné stránky A4 (mm) se čtverci k vystřižení.
      v: {a, okraj, mezera, spad, strana: 'lic'|'rub', otaceni, vzorLic, vzorRub: {typ, b1, b2, m}, cp: {vzor, list, strana, barva}
          (vzor přehybů – vzorPrehybu už ve správném pohledu), barvy: [..] (barvy jednotlivých čtverců, přepíše b1), pocet, znacky} */
  function stranaPapiru(v) {
    const spad = Math.max(0, Number(v.spad) || 0);
    const roz = rozvrzeni(v.a, v.okraj, Math.max(Number(v.mezera) || 0, 2 * spad + 2));
    const n = v.pocet === undefined ? roz.pozice.length : Math.min(v.pocet, roz.pozice.length);
    const rub = v.strana === 'rub';
    const vz = rub ? v.vzorRub : v.vzorLic;
    const defs = [], telo = [];
    for (let i = 0; i < n; i++) {
      const poz = rub ? zrcadliPozici(roz.pozice[i], v.a, v.otaceni) : roz.pozice[i];
      const b1 = v.barvy && !rub ? v.barvy[i % v.barvy.length] : vz.b1;
      const id = `v${rub ? 'r' : 'l'}${i}`;
      const vzor = vzorSvg(id, vz.typ, b1, vz.b2, vz.m);
      if (vzor.defs) defs.push(vzor.defs);
      const x = poz.x, y = poz.y, a = v.a;
      // vzor vlastním souřadnicovým systémem čtverce (stejný motiv na každém čtverci)
      telo.push(`<g transform="translate(${f3(x)} ${f3(y)})"><rect x="${f3(-spad)}" y="${f3(-spad)}" width="${f3(a + 2 * spad)}" height="${f3(a + 2 * spad)}" fill="${vzor.fill}"/></g>`);
      if (v.cp && v.cp.strana === v.strana) telo.push(svgVzoruPrehybu(v.cp.vzor, v.cp.list, x, y, a, { barva: v.cp.barva || '#444', sirka: 0.25 }));
      if (v.znacky !== false) { // ořezové značky v rozích (mimo čtverec)
        const d = 3, o = spad + 1;
        const zn = [];
        for (const [cx, cy, sx, sy] of [[x, y, -1, -1], [x + a, y, 1, -1], [x + a, y + a, 1, 1], [x, y + a, -1, 1]]) {
          zn.push(`M${f3(cx + sx * o)} ${f3(cy)}h${f3(sx * d)}M${f3(cx)} ${f3(cy + sy * o)}v${f3(sy * d)}`);
        }
        telo.push(`<path d="${zn.join('')}" stroke="#888" stroke-width="0.2" fill="none"/>`);
      }
      if (v.popisky && !rub) telo.push(`<text x="${f3(x + a / 2)}" y="${f3(y + a + spad + 3.2)}" font-size="2.6" text-anchor="middle" fill="#777" font-family="sans-serif">${v.popisky[i] || ''}</text>`);
    }
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${A4.w} ${A4.h}" width="${A4.w}mm" height="${A4.h}mm"><defs>${defs.join('')}</defs><rect width="${A4.w}" height="${A4.h}" fill="#fff"/>${telo.join('')}</svg>`, pocet: n, naStranu: roz.pozice.length };
  }

  /* ---------- modulární origami – Sonobe ---------- */
  const SONOBE = [
    { n: 3, nazev: 'Trojboká dvojjehlan (3 moduly)', barev: 3 },
    { n: 6, nazev: 'Krychle (6 modulů)', barev: 3 },
    { n: 12, nazev: 'Hvězdný osmistěn (12 modulů)', barev: 3 },
    { n: 30, nazev: 'Hvězdný dvacetistěn – koule (30 modulů)', barev: 3 },
    { n: 90, nazev: 'Velká koule (90 modulů)', barev: 3 }
  ];
  /** Rozdělí n modulů do k barev co nejrovnoměrněji (tradičně 3 barvy – každá „osa“ jednou barvou). */
  function rozdelBarvy(n, k) {
    n = Math.max(0, Math.floor(n)); k = Math.max(1, Math.floor(k));
    const r = Array(k).fill(Math.floor(n / k));
    for (let i = 0; i < n % k; i++) r[i]++;
    return r;
  }
  /** Stránky pro n modulů: {stranek, naStranu}. */
  function stranekModulu(n, a, okraj, mezera) {
    const na = rozvrzeni(a, okraj, mezera).pozice.length;
    return { naStranu: na, stranek: na ? Math.ceil(n / na) : 0 };
  }

  const api = {
    EPS, ID, ap, slozM, det, invM, odrazM, rotaceM, mZBodu,
    sub, add, mulS, dot, cross, delka, jedn, kolmice, stred, lerp,
    plocha, teziste, obsahujeBod, rozdelPoly, orizniUsecku, spolecnaHrana,
    novyStav, kopieStavu, polohaFacety, ohraniceni, normalizujZ, bod, vyres,
    caraOperace, prehyb, otoc, pootoc, klicovyStav, ryskyZeSousedstvi, pridejRysky, proved, sestav,
    snimek, BARVY, ramec, svgPolygony, svgZnacky, svgKroku, sipka, sipkaRovna, symbolOtoceni,
    vzorPrehybu, stranaPapiru, A4, rozvrzeni, maxCtverec, zrcadliPozici, VZORY, vzorSvg, svgVzoruPrehybu,
    SONOBE, rozdelBarvy, stranekModulu, POMLCKY
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.OrigamiJadro = api;
})();
