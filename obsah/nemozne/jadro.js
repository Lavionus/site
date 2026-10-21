/* Laboratoř nemožných tvarů – jádro (bez DOM a bez three.js, testovatelné v node).
   Síť = { poz: Float64Array(3·V), tri: Uint32Array(3·F), svar: Int32Array(V) – zástupce
   po sešití švů, nor?: Float64Array(3·V), mriz?: {nu, nv} }.
   Švy se sešívají PODLE PARAMETRU (indexů mřížky), ne podle polohy: poloha by slila
   i body na čarách samoprůniku a topologie by vyšla špatně. */
var NEM = globalThis.NEM = globalThis.NEM || {};
(function (N) {
  'use strict';

  /* ---------- drobnosti ---------- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  N.v = { sub, cross, dot, len, norm };
  const bod = (poz, i) => [poz[3 * i], poz[3 * i + 1], poz[3 * i + 2]];
  N.bod = bod;

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
  N.gcd = gcd;

  /* ---------- union-find ---------- */
  function UF(n) { this.p = new Int32Array(n); for (let i = 0; i < n; i++) this.p[i] = i; }
  UF.prototype.najdi = function (i) {
    const p = this.p;
    while (p[i] !== i) { p[i] = p[p[i]]; i = p[i]; }
    return i;
  };
  UF.prototype.spoj = function (a, b) {
    a = this.najdi(a); b = this.najdi(b);
    if (a !== b) { if (a < b) this.p[b] = a; else this.p[a] = b; }
  };

  /* ---------- parametrická mřížka ----------
     o.f(u, v) → [x, y, z]; o.u = [u0, u1], o.v = [v0, v1]; o.nu, o.nv = počet dílků.
     o.sev = pravidla sešití:
       u: 'per'  … (u1, v) ≡ (u0, v)            u: 'flip' … (u1, v) ≡ (u0, v0 + v1 − v)
       v: 'per'  … (u, v1) ≡ (u, v0)            v: 'flip' … (u, v1) ≡ (u0 + u1 − u, v0)
       bod: ['u0', …] … celý okraj se stáhne do jednoho bodu (pól)
       anti: 'u1' … na okraji u1 se ztotožní body s v a v + půl periody (disk → projektivní rovina) */
  N.plocha = function (o) {
    const nu = o.nu, nv = o.nv, f = o.f;
    const [u0, u1] = o.u, [v0, v1] = o.v;
    const W = nv + 1, V = (nu + 1) * W;
    const poz = new Float64Array(3 * V), uv = new Float64Array(2 * V);
    for (let i = 0; i <= nu; i++) {
      const u = u0 + (u1 - u0) * i / nu;
      for (let j = 0; j <= nv; j++) {
        const v = v0 + (v1 - v0) * j / nv;
        const k = i * W + j, p = f(u, v);
        poz[3 * k] = p[0]; poz[3 * k + 1] = p[1]; poz[3 * k + 2] = p[2];
        uv[2 * k] = u; uv[2 * k + 1] = v;
      }
    }
    const sit = N.mrizka(poz, nu, nv, o.sev || {});
    sit.uv = uv;
    sit.f = f;
    sit.dom = { u: o.u, v: o.v };
    sit.nor = N.normalyParam(sit, f, (u1 - u0) / nu, (v1 - v0) / nv);
    return sit;
  };

  /** Síť z hotových poloh mřížky (nu+1)×(nv+1) se sešitím podle pravidel. */
  N.mrizka = function (poz, nu, nv, sev) {
    const W = nv + 1, V = (nu + 1) * W;
    const id = (i, j) => i * W + j;
    const uf = new UF(V);
    if (sev.u === 'per') for (let j = 0; j <= nv; j++) uf.spoj(id(nu, j), id(0, j));
    if (sev.u === 'flip') for (let j = 0; j <= nv; j++) uf.spoj(id(nu, j), id(0, nv - j));
    if (sev.v === 'per') for (let i = 0; i <= nu; i++) uf.spoj(id(i, nv), id(i, 0));
    if (sev.v === 'flip') for (let i = 0; i <= nu; i++) uf.spoj(id(i, nv), id(nu - i, 0));
    for (const b of sev.bod || []) {
      for (let t = 1; t <= (b[0] === 'u' ? nv : nu); t++) {
        if (b === 'u0') uf.spoj(id(0, t), id(0, 0));
        if (b === 'u1') uf.spoj(id(nu, t), id(nu, 0));
        if (b === 'v0') uf.spoj(id(t, 0), id(0, 0));
        if (b === 'v1') uf.spoj(id(t, nv), id(0, nv));
      }
    }
    if (sev.anti === 'u1') {
      if (nv % 2) throw new Error('antipodální šev potřebuje sudé nv');
      for (let j = 0; j < nv / 2; j++) uf.spoj(id(nu, j), id(nu, j + nv / 2));
    }
    const svar = new Int32Array(V);
    for (let k = 0; k < V; k++) svar[k] = uf.najdi(k);
    const tri = [];
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
      tri.push(a, b, c, a, c, d);
    }
    return { poz, tri: Uint32Array.from(tri), svar, mriz: { nu, nv } };
  };

  /** Normály z parametrizace: fu × fv centrálními diferencemi. Kde je parametrizace
      degenerovaná (póly), vezme se průměr normál sousedních trojúhelníků mřížky. */
  N.normalyParam = function (sit, f, du, dv) {
    const { poz, uv, tri } = sit, V = poz.length / 3;
    const nor = new Float64Array(3 * V);
    const hu = du * 0.05, hv = dv * 0.05;
    const nahrada = N.normalySten(sit);
    for (let k = 0; k < V; k++) {
      const u = uv[2 * k], v = uv[2 * k + 1];
      const fu = sub(f(u + hu, v), f(u - hu, v)), fv = sub(f(u, v + hv), f(u, v - hv));
      let n = cross(fu, fv);
      const l = len(n);
      if (!(l > 1e-9 * (len(fu) * len(fv) + 1e-300)) || !isFinite(l)) n = bod(nahrada, k);
      else n = [n[0] / l, n[1] / l, n[2] / l];
      nor[3 * k] = n[0]; nor[3 * k + 1] = n[1]; nor[3 * k + 2] = n[2];
    }
    return nor;
  };

  /** Normály vrcholů jako průměr normál přilehlých trojúhelníků (bez sešití – lokální orientace). */
  N.normalySten = function (sit) {
    const { poz, tri } = sit, V = poz.length / 3;
    const nor = new Float64Array(3 * V);
    for (let t = 0; t < tri.length; t += 3) {
      const a = tri[t], b = tri[t + 1], c = tri[t + 2];
      const n = cross(sub(bod(poz, b), bod(poz, a)), sub(bod(poz, c), bod(poz, a)));
      for (const k of [a, b, c]) { nor[3 * k] += n[0]; nor[3 * k + 1] += n[1]; nor[3 * k + 2] += n[2]; }
    }
    for (let k = 0; k < V; k++) {
      const n = norm(bod(nor, k));
      nor[3 * k] = n[0]; nor[3 * k + 1] = n[1]; nor[3 * k + 2] = n[2];
    }
    return nor;
  };

  /** Svaří trojúhelníkovou polévku podle polohy (pro tělesa, která nejsou z jedné mřížky:
      fraktály, iluze). Kvantizace na mřížku s krokem tol. */
  N.svarPodlePolohy = function (sit, tol) {
    const { poz } = sit, V = poz.length / 3;
    if (!tol) {
      let m = 0;
      for (let i = 0; i < poz.length; i++) m = Math.max(m, Math.abs(poz[i]));
      tol = (m || 1) * 1e-7;
    }
    const mapa = new Map(), svar = new Int32Array(V);
    for (let k = 0; k < V; k++) {
      const klic = Math.round(poz[3 * k] / tol) + ',' + Math.round(poz[3 * k + 1] / tol) + ',' + Math.round(poz[3 * k + 2] / tol);
      const z = mapa.get(klic);
      if (z === undefined) { mapa.set(klic, k); svar[k] = k; } else svar[k] = z;
    }
    sit.svar = svar;
    return sit;
  };

  /** Spojí víc sítí do jedné (indexy se posunou, svar také). */
  N.spoj = function (site) {
    let V = 0, T = 0;
    for (const s of site) { V += s.poz.length / 3; T += s.tri.length; }
    const poz = new Float64Array(3 * V), tri = new Uint32Array(T), svar = new Int32Array(V);
    let nor = site.every(s => s.nor) ? new Float64Array(3 * V) : null;
    let ov = 0, ot = 0;
    for (const s of site) {
      const n = s.poz.length / 3;
      poz.set(s.poz, 3 * ov);
      if (nor) nor.set(s.nor, 3 * ov);
      for (let i = 0; i < s.tri.length; i++) tri[ot + i] = s.tri[i] + ov;
      for (let i = 0; i < n; i++) svar[ov + i] = (s.svar ? s.svar[i] : i) + ov;
      ov += n; ot += s.tri.length;
    }
    const r = { poz, tri, svar };
    if (nor) r.nor = nor;
    return r;
  };

  /** Přesný ořez parametrické sítě: ponechá část, kde g(bod) ≤ 0. Trojúhelníky přes hranici
      se rozříznou; nový vrchol na hraně se najde bisekcí v parametrech (u, v), takže leží
      přesně na ploše i na hranici. Vrcholy se sdílí podle sešité hrany (švy zůstanou sešité).
      Vrcholy, kde je plocha nekonečná nebo NaN, se berou jako vnější. */
  N.orizni = function (sit, g) {
    const { poz, uv, tri, svar, f } = sit;
    const V = poz.length / 3;
    const hod = new Float64Array(V);
    for (let k = 0; k < V; k++) {
      const p = bod(poz, k);
      hod[k] = isFinite(p[0] + p[1] + p[2]) ? g(p) : Infinity;
    }
    const P = Array.from(poz), U = Array.from(uv), S = Array.from(svar), NN = sit.nor ? Array.from(sit.nor) : null;
    const nove = new Map(), out = [];
    const naHrane = (a, b) => {                 // a uvnitř, b venku
      const sa = svar[a], sb = svar[b];
      const klic = sa < sb ? sa + ',' + sb : sb + ',' + sa;
      const z = nove.get(klic);
      if (z) {
        // stejná sešitá hrana, ale možná z druhé strany švu: použít vrchol z vlastní kopie (u, v)
        const k = z.get(a + ',' + b);
        if (k !== undefined) return k;
      }
      let lo = 0, hi = 1, ua = [uv[2 * a], uv[2 * a + 1]], ub = [uv[2 * b], uv[2 * b + 1]];
      for (let it = 0; it < 50; it++) {
        const m = (lo + hi) / 2, p = f(ua[0] + m * (ub[0] - ua[0]), ua[1] + m * (ub[1] - ua[1]));
        const x = isFinite(p[0] + p[1] + p[2]) ? g(p) : Infinity;
        if (x <= 0) lo = m; else hi = m;
      }
      const uu = ua[0] + lo * (ub[0] - ua[0]), vv = ua[1] + lo * (ub[1] - ua[1]), p = f(uu, vv);
      const k = P.length / 3;
      P.push(p[0], p[1], p[2]); U.push(uu, vv);
      if (NN) {
        const h = 1e-6, n = norm(cross(sub(f(uu + h, vv), f(uu - h, vv)), sub(f(uu, vv + h), f(uu, vv - h))));
        NN.push(n[0], n[1], n[2]);
      }
      // zástupce pro sešití: první vytvořený vrchol této sešité hrany
      let mapa = z;
      if (!mapa) { mapa = new Map(); mapa.zastupce = k; nove.set(klic, mapa); }
      S.push(mapa.zastupce);
      mapa.set(a + ',' + b, k);
      return k;
    };
    for (let i = 0; i < tri.length; i += 3) {
      const t = [tri[i], tri[i + 1], tri[i + 2]], vn = t.map(k => hod[k] <= 0);
      const n = vn.filter(x => x).length;
      if (n === 3) { out.push(...t); continue; }
      if (n === 0) continue;
      // natočit tak, aby t[0] byl ten „osamocený“ vrchol
      const osam = n === 1 ? vn.indexOf(true) : vn.indexOf(false);
      const a = t[osam], b = t[(osam + 1) % 3], c = t[(osam + 2) % 3];
      if (n === 1) {
        out.push(a, naHrane(a, b), naHrane(a, c));
      } else {
        const ab = naHrane(b, a), ac = naHrane(c, a);
        out.push(ab, b, c, ab, c, ac);
      }
    }
    const r = Object.assign({}, sit, { poz: Float64Array.from(P), uv: Float64Array.from(U), svar: Int32Array.from(S), tri: Uint32Array.from(out), mriz: null });
    if (NN) r.nor = Float64Array.from(NN);
    return r;
  };

  /* ---------- topologie ---------- */

  /** Trojúhelníky přepsané na sešité indexy; degenerované (po stažení pólu) vypadnou.
      Vrací { t: Uint32Array, puvodni: Uint32Array – index původního trojúhelníku }. */
  function sesiteTri(sit) {
    const { tri, svar } = sit, t = [], pu = [];
    for (let i = 0; i < tri.length; i += 3) {
      const a = svar[tri[i]], b = svar[tri[i + 1]], c = svar[tri[i + 2]];
      if (a === b || b === c || a === c) continue;
      t.push(a, b, c); pu.push(i / 3);
    }
    return { t: Uint32Array.from(t), puvodni: Uint32Array.from(pu) };
  }
  N.sesiteTri = sesiteTri;

  /** Mapa hran: klíč → seznam {t (index v sešitých), smer: +1 když trojúhelník jde a→b s a<b}. */
  function mapaHran(t) {
    const m = new Map();
    for (let i = 0; i < t.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const a = t[i + k], b = t[i + (k + 1) % 3];
        const klic = a < b ? a * 4294967296 + b : b * 4294967296 + a;
        let z = m.get(klic);
        if (!z) m.set(klic, z = []);
        z.push({ t: i / 3, smer: a < b ? 1 : -1 });
      }
    }
    return m;
  }
  N.mapaHran = mapaHran;

  /** Kompletní topologický rozbor sítě (měřený, ne opsaný z teorie). */
  N.topologie = function (sit) {
    const { t, puvodni } = sesiteTri(sit);
    const F = t.length / 3;
    const pouzite = new Set(t);
    const V = pouzite.size;
    const hrany = mapaHran(t);
    const E = hrany.size;
    let nemanifold = 0;
    const okrajoveHrany = [];
    const sous = Array.from({ length: F }, () => []);
    for (const [klic, z] of hrany) {
      if (z.length === 1) okrajoveHrany.push(klic);
      else if (z.length > 2) nemanifold++;
      if (z.length === 2) {
        // stejný směr průchodu hranou = nesouhlasná orientace sousedů
        const stejne = z[0].smer === z[1].smer;
        sous[z[0].t].push(z[1].t, stejne ? -1 : 1);
        sous[z[1].t].push(z[0].t, stejne ? -1 : 1);
      }
    }
    // orientace: BFS se znaménky
    const zn = new Int8Array(F);
    let orient = true, komponenty = 0;
    const kompT = new Int32Array(F).fill(-1);
    const fronta = new Int32Array(F);
    const kompOrient = [];
    for (let s = 0; s < F; s++) {
      if (zn[s]) continue;
      let ok = true;
      zn[s] = 1; kompT[s] = komponenty;
      let h = 0, k = 0; fronta[k++] = s;
      while (h < k) {
        const x = fronta[h++], sx = sous[x];
        for (let i = 0; i < sx.length; i += 2) {
          const y = sx[i], chci = zn[x] * sx[i + 1];
          if (!zn[y]) { zn[y] = chci; kompT[y] = komponenty; fronta[k++] = y; }
          else if (zn[y] !== chci) ok = false;
        }
      }
      kompOrient.push(ok);
      if (!ok) orient = false;
      komponenty++;
    }
    // okrajové křivky = komponenty grafu okrajových hran
    const ufV = new Map();
    const najdi = x => { while (ufV.get(x) !== x) { ufV.set(x, ufV.get(ufV.get(x))); x = ufV.get(x); } return x; };
    for (const klic of okrajoveHrany) {
      const a = Math.floor(klic / 4294967296), b = klic % 4294967296;
      if (!ufV.has(a)) ufV.set(a, a);
      if (!ufV.has(b)) ufV.set(b, b);
      const ra = najdi(a), rb = najdi(b);
      if (ra !== rb) ufV.set(ra, rb);
    }
    const okrajeSet = new Set();
    for (const x of ufV.keys()) okrajeSet.add(najdi(x));
    const chi = V - E + F;
    const okraje = okrajeSet.size;
    // rod (orientovatelná) / počet křížení (neorientovatelná) – jen pro jednu komponentu
    let rod = null, krizky = null;
    if (komponenty === 1 && !nemanifold) {
      if (orient) rod = (2 - chi - okraje) / 2; else krizky = 2 - chi - okraje;
    }
    return { V, E, F, chi, okraje, orient, komponenty, nemanifold, rod, krizky, zn, kompT, kompOrient, t, puvodni, okrajoveHrany };
  };

  /** Okrajové křivky jako úsečky (pro vykreslení): Float64Array po 6 číslech. */
  N.okrajoveUsecky = function (sit, top) {
    top = top || N.topologie(sit);
    const out = new Float64Array(top.okrajoveHrany.length * 6);
    let i = 0;
    for (const klic of top.okrajoveHrany) {
      const a = Math.floor(klic / 4294967296), b = klic % 4294967296;
      out.set(bod(sit.poz, a), i); out.set(bod(sit.poz, b), i + 3); i += 6;
    }
    return out;
  };

  /** Šíření barvy po jedné straně plochy z trojúhelníku start (index původního trojúhelníku).
      Stav = (trojúhelník, strana ±1) – dvojité pokrytí plochy. Přes hranu se strana zachová,
      když sousedé procházejí hranou opačně (souhlasná orientace), jinak se otočí.
      Vrací { krok: Int32Array(2·Fpůvodních) – krok, kdy se strana obarvila (−1 nikdy;
      index 2t = líc, 2t+1 = rub), kroku: počet kroků, obeStrany: true, když se barva dostala
      na rub výchozího trojúhelníku (= plocha je neorientovatelná). */
  N.sireniStrany = function (sit, top, start) {
    top = top || N.topologie(sit);
    const { t, puvodni } = top, F = t.length / 3;
    const zpet = new Int32Array(sit.tri.length / 3).fill(-1);
    for (let i = 0; i < F; i++) zpet[puvodni[i]] = i;
    const s0 = zpet[start];
    const krokS = new Int32Array(2 * F).fill(-1);
    const hrany = mapaHran(t);
    const sous = Array.from({ length: F }, () => []);
    for (const z of hrany.values()) if (z.length === 2) {
      const stejne = z[0].smer === z[1].smer ? -1 : 1;
      sous[z[0].t].push(z[1].t, stejne); sous[z[1].t].push(z[0].t, stejne);
    }
    let kroku = 0;
    if (s0 >= 0) {
      let vrstva = [s0 * 2];
      krokS[s0 * 2] = 0;
      while (vrstva.length) {
        const dalsi = [];
        kroku++;
        for (const st of vrstva) {
          const x = st >> 1, strana = st & 1 ? -1 : 1, sx = sous[x];
          for (let i = 0; i < sx.length; i += 2) {
            const y = sx[i], sy = strana * sx[i + 1];
            const k = 2 * y + (sy > 0 ? 0 : 1);
            if (krokS[k] < 0) { krokS[k] = kroku; dalsi.push(k); }
          }
        }
        vrstva = dalsi;
      }
    }
    const krok = new Int32Array(sit.tri.length / 3 * 2).fill(-1);
    for (let i = 0; i < F; i++) { krok[2 * puvodni[i]] = krokS[2 * i]; krok[2 * puvodni[i] + 1] = krokS[2 * i + 1]; }
    return { krok, kroku, obeStrany: s0 >= 0 && krokS[2 * s0 + 1] >= 0 };
  };

  /* ---------- míry ---------- */

  N.plochaSite = function (sit) {
    const { poz, tri } = sit;
    let A = 0;
    for (let i = 0; i < tri.length; i += 3) {
      const a = bod(poz, tri[i]);
      A += len(cross(sub(bod(poz, tri[i + 1]), a), sub(bod(poz, tri[i + 2]), a))) / 2;
    }
    return A;
  };

  /** Objem uzavřené orientovatelné sítě (věta o divergenci). Orientace se bere z rozboru,
      takže nevadí, jestli generátor vyrobil trojúhelníky souhlasně. Pro otevřené nebo
      neorientovatelné plochy vrací null – objem tam nemá smysl. */
  N.objemSite = function (sit, top) {
    top = top || N.topologie(sit);
    if (top.okraje || !top.orient || top.nemanifold) return null;
    const { poz } = sit, { t, zn, kompT } = top;
    const obj = new Float64Array(top.komponenty);
    for (let i = 0; i < t.length; i += 3) {
      const a = bod(poz, t[i]), b = bod(poz, t[i + 1]), c = bod(poz, t[i + 2]);
      obj[kompT[i / 3]] += zn[i / 3] * dot(a, cross(b, c)) / 6;
    }
    let s = 0;
    for (const x of obj) s += Math.abs(x);
    return s;
  };

  /** Těžiště homogenního tělesa (uzavřená orientovatelná síť). */
  N.teziste = function (sit, top) {
    top = top || N.topologie(sit);
    const { poz } = sit, { t, zn } = top;
    let V = 0; const c = [0, 0, 0];
    for (let i = 0; i < t.length; i += 3) {
      const a = bod(poz, t[i]), b = bod(poz, t[i + 1]), d = bod(poz, t[i + 2]);
      const v = zn[i / 3] * dot(a, cross(b, d)) / 6;
      V += v;
      for (let k = 0; k < 3; k++) c[k] += v * (a[k] + b[k] + d[k]) / 4;
    }
    return [c[0] / V, c[1] / V, c[2] / V];
  };

  /** Obalový kvádr a koule. */
  N.obal = function (poz) {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) {
      const x = poz[i + k];
      if (!isFinite(x)) continue;
      if (x < mn[k]) mn[k] = x;
      if (x > mx[k]) mx[k] = x;
    }
    const stred = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    return { mn, mx, stred, r: len(sub(mx, mn)) / 2 || 1 };
  };

  /** Kontrola konečnosti všech souřadnic. */
  N.konecna = function (sit) {
    for (const x of sit.poz) if (!isFinite(x)) return false;
    return true;
  };

  /* ---------- křivost ---------- */

  /** Gaussova K a střední H křivost z parametrizace f(u, v) v bodě (u, v) – první
      a druhá fundamentální forma, derivace centrálními diferencemi s krokem h. */
  N.krivostParam = function (f, u, v, h, hv = h) {
    const hu = h;
    const p = f(u, v);
    const pu1 = f(u + hu, v), pu0 = f(u - hu, v), pv1 = f(u, v + hv), pv0 = f(u, v - hv);
    const p11 = f(u + hu, v + hv), p10 = f(u + hu, v - hv), p01 = f(u - hu, v + hv), p00 = f(u - hu, v - hv);
    const fu = [], fv = [], fuu = [], fvv = [], fuv = [];
    for (let k = 0; k < 3; k++) {
      fu[k] = (pu1[k] - pu0[k]) / (2 * hu);
      fv[k] = (pv1[k] - pv0[k]) / (2 * hv);
      fuu[k] = (pu1[k] - 2 * p[k] + pu0[k]) / (hu * hu);
      fvv[k] = (pv1[k] - 2 * p[k] + pv0[k]) / (hv * hv);
      fuv[k] = (p11[k] - p10[k] - p01[k] + p00[k]) / (4 * hu * hv);
    }
    const n = cross(fu, fv), ln = len(n);
    if (!(ln > 0)) return null;
    const nn = [n[0] / ln, n[1] / ln, n[2] / ln];
    const E = dot(fu, fu), F = dot(fu, fv), G = dot(fv, fv);
    const L = dot(fuu, nn), M = dot(fuv, nn), Nn = dot(fvv, nn);
    const D = E * G - F * F;
    if (!(D > 0)) return null;
    return { K: (L * Nn - M * M) / D, H: (E * Nn - 2 * F * M + G * L) / (2 * D) };
  };

  /** Statistiky křivosti na vzorku parametrů (vynechá degenerované body a okraj).
      Vrací { K: {min, max, prumer}, H: {...}, absH: {max, prumer}, n }. */
  N.statKrivosti = function (f, u, v, n = 40, okraj = 0.02, filtr = null) {
    const [u0, u1] = u, [v0, v1] = v;
    // krok derivace zvlášť pro každý parametr (u Diniho plochy je rozsah u desetkrát větší než v)
    const hu = 2e-5 * Math.abs(u1 - u0), hv = 2e-5 * Math.abs(v1 - v0);
    const st = () => ({ min: Infinity, max: -Infinity, sum: 0 });
    const K = st(), H = st(), aH = st();
    let pocet = 0;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const uu = u0 + (u1 - u0) * (okraj + (1 - 2 * okraj) * i / n);
      const vv = v0 + (v1 - v0) * (okraj + (1 - 2 * okraj) * j / n);
      if (filtr && !filtr(uu, vv)) continue;
      const k = N.krivostParam(f, uu, vv, hu, hv);
      if (!k || !isFinite(k.K) || !isFinite(k.H)) continue;
      for (const [s, x] of [[K, k.K], [H, k.H], [aH, Math.abs(k.H)]]) {
        s.min = Math.min(s.min, x); s.max = Math.max(s.max, x); s.sum += x;
      }
      pocet++;
    }
    const fin = s => ({ min: s.min, max: s.max, prumer: s.sum / (pocet || 1) });
    return { K: fin(K), H: fin(H), absH: fin(aH), n: pocet };
  };

  /** Křivost v každém vrcholu mřížky (pro barevnou mapu). co = 'K' | 'H'. */
  N.krivostVrcholu = function (sit, co) {
    const { uv, f } = sit, V = uv.length / 2;
    const out = new Float64Array(V);
    let rozsah = 0;
    for (let k = 0; k < V; k++) { rozsah = Math.max(rozsah, Math.abs(uv[2 * k]), Math.abs(uv[2 * k + 1])); }
    const h = 1e-4 * Math.max(1, rozsah);
    for (let k = 0; k < V; k++) {
      const r = N.krivostParam(f, uv[2 * k], uv[2 * k + 1], h);
      out[k] = r && isFinite(r[co]) ? r[co] : NaN;
    }
    return out;
  };

  /** Diskrétní Gaussova křivost (úhlový defekt / třetina plochy okolí) ve vnitřních vrcholech
      sešité sítě – nezávislá kontrola, počítá se jen z trojúhelníků. */
  N.krivostDiskretni = function (sit, top) {
    top = top || N.topologie(sit);
    const { poz } = sit, { t } = top;
    const uhel = new Map(), plocha = new Map(), okrajV = new Set();
    for (const klic of top.okrajoveHrany) { okrajV.add(Math.floor(klic / 4294967296)); okrajV.add(klic % 4294967296); }
    for (let i = 0; i < t.length; i += 3) {
      const id = [t[i], t[i + 1], t[i + 2]], p = id.map(k => bod(poz, k));
      const A = len(cross(sub(p[1], p[0]), sub(p[2], p[0]))) / 2;
      for (let k = 0; k < 3; k++) {
        const a = sub(p[(k + 1) % 3], p[k]), b = sub(p[(k + 2) % 3], p[k]);
        const c = Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b) || 1))));
        uhel.set(id[k], (uhel.get(id[k]) || 0) + c);
        plocha.set(id[k], (plocha.get(id[k]) || 0) + A / 3);
      }
    }
    const K = new Map();
    for (const [k, s] of uhel) if (!okrajV.has(k)) K.set(k, (2 * Math.PI - s) / plocha.get(k));
    return K;
  };

  /* ---------- samoprůniky ---------- */

  /** Úsečky průniku dvojic trojúhelníků, které nesdílejí sešitý vrchol.
      Prostorová mřížka podle obalů trojúhelníků. Vrací Float64Array po 6 číslech. */
  N.samopruniky = function (sit, maxUsecek = 200000) {
    const { t } = sesiteTri(sit);
    const poz = sit.poz;
    const F = t.length / 3;
    if (!F) return new Float64Array(0);
    const ob = N.obal(poz);
    const tmn = new Float64Array(3 * F), tmx = new Float64Array(3 * F), roz = new Float64Array(F);
    for (let i = 0; i < F; i++) {
      for (let k = 0; k < 3; k++) { tmn[3 * i + k] = Infinity; tmx[3 * i + k] = -Infinity; }
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
        const x = poz[3 * t[3 * i + r] + k];
        if (x < tmn[3 * i + k]) tmn[3 * i + k] = x;
        if (x > tmx[3 * i + k]) tmx[3 * i + k] = x;
      }
      roz[i] = Math.max(tmx[3 * i] - tmn[3 * i], tmx[3 * i + 1] - tmn[3 * i + 1], tmx[3 * i + 2] - tmn[3 * i + 2]);
    }
    // strom obalů (BVH): listy po 4 trojúhelnících, dělení podle mediánu nejdelší osy
    const idx = new Int32Array(F); for (let i = 0; i < F; i++) idx[i] = i;
    const uzly = [];   // {mn:[3], mx:[3], a, b (rozsah v idx), l, r}
    const stred = (i, k) => tmn[3 * i + k] + tmx[3 * i + k];
    function stav(a, b) {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let q = a; q < b; q++) { const i = idx[q]; for (let k = 0; k < 3; k++) { if (tmn[3 * i + k] < mn[k]) mn[k] = tmn[3 * i + k]; if (tmx[3 * i + k] > mx[k]) mx[k] = tmx[3 * i + k]; } }
      const u = { mn, mx, a, b, l: -1, r: -1 };
      const id = uzly.push(u) - 1;
      if (b - a > 4) {
        const ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
        const k = ext[0] >= ext[1] && ext[0] >= ext[2] ? 0 : ext[1] >= ext[2] ? 1 : 2;
        const cast = Array.from(idx.subarray(a, b)).sort((x, y) => stred(x, k) - stred(y, k));
        idx.set(cast, a);
        const m = (a + b) >> 1;
        u.l = stav(a, m); u.r = stav(m, b);
      }
      return id;
    }
    stav(0, F);
    const out = [];
    const zkus = (i, j) => {
      for (let k = 0; k < 3; k++) if (tmn[3 * i + k] > tmx[3 * j + k] || tmn[3 * j + k] > tmx[3 * i + k]) return false;
      const ai = t[3 * i], bi = t[3 * i + 1], ci = t[3 * i + 2], aj = t[3 * j], bj = t[3 * j + 1], cj = t[3 * j + 2];
      if (ai === aj || ai === bj || ai === cj || bi === aj || bi === bj || bi === cj || ci === aj || ci === bj || ci === cj) return false;
      const s = prunikTrojuhelniku(bod(poz, ai), bod(poz, bi), bod(poz, ci), bod(poz, aj), bod(poz, bj), bod(poz, cj));
      if (s) out.push(...s);
      return out.length >= 6 * maxUsecek;
    };
    const zasobnik = [];
    for (let i = 0; i < F; i++) {
      zasobnik.length = 0; zasobnik.push(0);
      while (zasobnik.length) {
        const u = uzly[zasobnik.pop()];
        let mimo = false;
        for (let k = 0; k < 3; k++) if (tmn[3 * i + k] > u.mx[k] || u.mn[k] > tmx[3 * i + k]) { mimo = true; break; }
        if (mimo) continue;
        if (u.l < 0) { for (let q = u.a; q < u.b; q++) { const j = idx[q]; if (j > i && zkus(i, j)) return Float64Array.from(out); } }
        else zasobnik.push(u.l, u.r);
      }
    }
    return Float64Array.from(out);
  };

  /** Průnik dvou trojúhelníků jako úsečka [x1,y1,z1,x2,y2,z2] nebo null. */
  function prunikTrojuhelniku(a0, a1, a2, b0, b1, b2) {
    const na = cross(sub(a1, a0), sub(a2, a0)), nb = cross(sub(b1, b0), sub(b2, b0));
    const db = [dot(na, sub(b0, a0)), dot(na, sub(b1, a0)), dot(na, sub(b2, a0))];
    const da = [dot(nb, sub(a0, b0)), dot(nb, sub(a1, b0)), dot(nb, sub(a2, b0))];
    const eps = 1e-14;
    if ((db[0] > eps && db[1] > eps && db[2] > eps) || (db[0] < -eps && db[1] < -eps && db[2] < -eps)) return null;
    if ((da[0] > eps && da[1] > eps && da[2] > eps) || (da[0] < -eps && da[1] < -eps && da[2] < -eps)) return null;
    const smer = cross(na, nb);
    if (len(smer) < 1e-14 * (len(na) * len(nb) + 1e-300)) return null;   // koplanární – ignorujeme
    const seg = (P, d) => {
      // úsek, kde trojúhelník P protíná rovinu druhého: body na hranách se změnou znaménka
      const body = [];
      for (let k = 0; k < 3; k++) {
        const p = P[k], q = P[(k + 1) % 3], dp = d[k], dq = d[(k + 1) % 3];
        if (dp === 0) body.push(p);
        if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
          const s = dp / (dp - dq);
          body.push([p[0] + s * (q[0] - p[0]), p[1] + s * (q[1] - p[1]), p[2] + s * (q[2] - p[2])]);
        }
      }
      if (body.length < 2) return null;
      const tt = body.map(b => dot(b, smer));
      let iMin = 0, iMax = 0;
      for (let k = 1; k < tt.length; k++) { if (tt[k] < tt[iMin]) iMin = k; if (tt[k] > tt[iMax]) iMax = k; }
      return [body[iMin], body[iMax], tt[iMin], tt[iMax]];
    };
    const sa = seg([a0, a1, a2], da), sb = seg([b0, b1, b2], db);
    if (!sa || !sb) return null;
    const lo = Math.max(sa[2], sb[2]), hi = Math.min(sa[3], sb[3]);
    if (lo >= hi) return null;
    const P = lo === sa[2] ? sa[0] : sb[0], Q = hi === sa[3] ? sa[1] : sb[1];
    // dotyk v jediném bodě (úsečka nulové délky vůči velikosti trojúhelníků) není průnik
    const meritko = Math.max(len(sub(a1, a0)), len(sub(a2, a0)), len(sub(b1, b0)), len(sub(b2, b0)));
    if (len(sub(Q, P)) < 1e-7 * meritko) return null;
    return [P[0], P[1], P[2], Q[0], Q[1], Q[2]];
  }
  N.prunikTrojuhelniku = prunikTrojuhelniku;

  /* ---------- trubka kolem křivky ---------- */

  /** Trubka kolem křivky c(t), t ∈ [t0, t1], s rotačně minimalizujícím rámem
      (metoda dvojího odrazu, Wang a kol. 2008). U uzavřené křivky se zbytkové pootočení
      rámu rozloží rovnoměrně, aby šev seděl. r může být číslo nebo funkce r(t). */
  N.trubka = function (c, t0, t1, n, r, m, uzavrena = true) {
    const P = [], T = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * i / n;
      P.push(c(t));
      const h = (t1 - t0) / n * 0.01;
      T.push(norm(sub(c(t + h), c(t - h))));
    }
    if (uzavrena) { P[n] = P[0]; T[n] = T[0]; }
    // počáteční normála kolmá k tečně
    const t0v = T[0];
    let pom = Math.abs(t0v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let R = [norm(cross(cross(t0v, pom), t0v))];
    for (let i = 0; i < n; i++) {
      const v1 = sub(P[i + 1], P[i]), c1 = dot(v1, v1);
      const ri = R[i], ti = T[i];
      if (c1 < 1e-30) { R.push(ri); continue; }
      const rL = sub(ri, v1.map(x => x * 2 / c1 * dot(v1, ri)));
      const tL = sub(ti, v1.map(x => x * 2 / c1 * dot(v1, ti)));
      const v2 = sub(T[i + 1], tL), c2 = dot(v2, v2);
      R.push(c2 < 1e-30 ? rL : norm(sub(rL, v2.map(x => x * 2 / c2 * dot(v2, rL)))));
    }
    let zbytek = 0;
    if (uzavrena) {
      const s = cross(T[n], R[n]);
      zbytek = Math.atan2(dot(R[0], s), dot(R[0], R[n]));
    }
    const W = m + 1, poz = new Float64Array(3 * (n + 1) * W), nor = new Float64Array(3 * (n + 1) * W);
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * i / n;
      const rr = typeof r === 'function' ? r(t) : r;
      const ti = T[i];
      const fi = zbytek * i / n;
      // pootočení normály kolem tečny o fi
      let N1 = R[i], B1 = cross(ti, N1);
      const N2 = norm([N1[0] * Math.cos(fi) + B1[0] * Math.sin(fi), N1[1] * Math.cos(fi) + B1[1] * Math.sin(fi), N1[2] * Math.cos(fi) + B1[2] * Math.sin(fi)]);
      const B2 = cross(ti, N2);
      for (let j = 0; j <= m; j++) {
        const a = 2 * Math.PI * j / m;
        const d = [N2[0] * Math.cos(a) + B2[0] * Math.sin(a), N2[1] * Math.cos(a) + B2[1] * Math.sin(a), N2[2] * Math.cos(a) + B2[2] * Math.sin(a)];
        const k = i * W + j;
        for (let q = 0; q < 3; q++) { poz[3 * k + q] = P[i][q] + rr * d[q]; nor[3 * k + q] = d[q]; }
      }
    }
    if (uzavrena) for (let j = 0; j <= m; j++) for (let q = 0; q < 3; q++) {
      poz[3 * (n * W + j) + q] = poz[3 * j + q]; nor[3 * (n * W + j) + q] = nor[3 * j + q];
    }
    // vinutí mřížky (+u, +v) dává normálu T × d = −d → otočíme v, aby normála mířila ven
    const sit = N.mrizka(poz, n, m, uzavrena ? { u: 'per', v: 'per' } : { v: 'per' });
    // prohození pořadí vrcholů trojúhelníků, aby fu × fv mířilo ven
    for (let i = 0; i < sit.tri.length; i += 3) { const x = sit.tri[i + 1]; sit.tri[i + 1] = sit.tri[i + 2]; sit.tri[i + 2] = x; }
    sit.nor = nor;
    sit.stred = P;
    return sit;
  };

  /** Nejmenší vzdálenost dvou nesousedních bodů křivky (pro varování o samoprůniku trubky).
      Body vzdálené po křivce méně než okno se neporovnávají. */
  N.minVzdalenostKrivky = function (P, okno) {
    const n = P.length - 1;
    let m = Infinity;
    for (let i = 0; i < n; i++) for (let j = i + okno; j < n; j++) {
      if (n - (j - i) < okno) continue;
      const d = len(sub(P[i], P[j]));
      if (d < m) m = d;
    }
    return m;
  };

  /** Surface nets: izoplocha F = 0 na pravidelné mřížce R³ (F[(i·R + j)·R + k], bod mn + i·krok).
      Jeden vrchol v každé buňce, kterou plocha protíná (průměr průsečíků na hranách), a čtyřúhelník
      kolem každé hrany mřížky se změnou znaménka. periodicke = true: mřížka je jedna perioda
      (indexy modulo R) a výsledná síť je uzavřená plocha na trojrozměrném toru – pro měření rodu. */
  N.surfaceNets = function (F, R, mn, krok, periodicke = false) {
    const w = i => periodicke ? ((i % R) + R) % R : i;
    const id = (i, j, k) => (w(i) * R + w(j)) * R + w(k);
    const C = periodicke ? R : R - 1;                         // počet buněk v každém směru
    const bunka = new Int32Array(C * C * C).fill(-1);
    const bid = (i, j, k) => { const a = periodicke ? w(i) : i, b = periodicke ? w(j) : j, c = periodicke ? w(k) : k; return (a * C + b) * C + c; };
    const poz = [], nor = [];
    const ROHY = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const HRANY = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const h = new Float64Array(8);
    for (let i = 0; i < C; i++) for (let j = 0; j < C; j++) for (let k = 0; k < C; k++) {
      let neg = 0;
      for (let c = 0; c < 8; c++) { h[c] = F[id(i + ROHY[c][0], j + ROHY[c][1], k + ROHY[c][2])]; if (h[c] < 0) neg++; }
      if (neg === 0 || neg === 8) continue;
      let sx = 0, sy = 0, sz = 0, m = 0;
      for (const [a, b] of HRANY) {
        if ((h[a] < 0) === (h[b] < 0)) continue;
        const t = h[a] / (h[a] - h[b]);
        sx += ROHY[a][0] + t * (ROHY[b][0] - ROHY[a][0]);
        sy += ROHY[a][1] + t * (ROHY[b][1] - ROHY[a][1]);
        sz += ROHY[a][2] + t * (ROHY[b][2] - ROHY[a][2]);
        m++;
      }
      bunka[bid(i, j, k)] = poz.length / 3;
      poz.push(mn + (i + sx / m) * krok, mn + (j + sy / m) * krok, mn + (k + sz / m) * krok);
      // normála = gradient pole (rozdíly hodnot v rozích buňky), míří k větším hodnotám
      const gx = (h[1] + h[3] + h[5] + h[7]) - (h[0] + h[2] + h[4] + h[6]);
      const gy = (h[2] + h[3] + h[6] + h[7]) - (h[0] + h[1] + h[4] + h[5]);
      const gz = (h[4] + h[5] + h[6] + h[7]) - (h[0] + h[1] + h[2] + h[3]);
      const l = Math.hypot(gx, gy, gz) || 1;
      nor.push(gx / l, gy / l, gz / l);
    }
    const tri = [];
    const quad = (a, b, c, d, obratit) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      if (obratit) tri.push(a, d, c, a, c, b); else tri.push(a, b, c, a, c, d);
    };
    const od = periodicke ? 0 : 1, do_ = periodicke ? R : R - 1;
    for (let i = od; i < do_; i++) for (let j = od; j < do_; j++) for (let k = od; k < do_; k++) {
      const v = F[id(i, j, k)] < 0;
      // hrana ve směru x z (i, j, k) do (i+1, j, k): okolní buňky (i, j−1..j, k−1..k)
      if ((periodicke || i < R - 1) && (F[id(i + 1, j, k)] < 0) !== v)
        quad(bunka[bid(i, j - 1, k - 1)], bunka[bid(i, j, k - 1)], bunka[bid(i, j, k)], bunka[bid(i, j - 1, k)], !v);
      if ((periodicke || j < R - 1) && (F[id(i, j + 1, k)] < 0) !== v)
        quad(bunka[bid(i - 1, j, k - 1)], bunka[bid(i - 1, j, k)], bunka[bid(i, j, k)], bunka[bid(i, j, k - 1)], !v);
      if ((periodicke || k < R - 1) && (F[id(i, j, k + 1)] < 0) !== v)
        quad(bunka[bid(i - 1, j - 1, k)], bunka[bid(i, j - 1, k)], bunka[bid(i, j, k)], bunka[bid(i - 1, j, k)], !v);
    }
    const P = Float64Array.from(poz), svar = new Int32Array(P.length / 3);
    for (let i = 0; i < svar.length; i++) svar[i] = i;
    return { poz: P, nor: Float64Array.from(nor), tri: Uint32Array.from(tri), svar };
  };

  /* ---------- registr objektů ---------- */
  N.objekty = N.objekty || [];
  N.registruj = function (o) {
    if (N.objekty.some(x => x.id === o.id)) throw new Error('duplicitní objekt ' + o.id);
    N.objekty.push(o);
  };
  N.objekt = id => N.objekty.find(o => o.id === id);
  N.vychoziParametry = function (o) {
    const p = {};
    for (const x of o.parametry || []) p[x.id] = x.vychozi;
    return p;
  };

  N.STITKY = {
    presna: { znak: '🟢', nazev: 'Přesná parametrizace', text: 'Plochu přesně definuje vzorec. Odchylka vzniká jen převodem do sítě trojúhelníků.' },
    numericka: { znak: '🔵', nazev: 'Numerický výpočet přesné definice', text: 'Definice je přesná, hodnoty se ale počítají numericky (řady, iterace, izoplocha). Odhad chyby je uveden.' },
    iterace: { znak: '🟣', nazev: 'Konečná iterace fraktálu', text: 'Zobrazuje se n-tý krok konstrukce. Limitní objekt zobrazit nelze, jeho vlastnosti ukazují limity čísel.' },
    iluze: { znak: '🟠', nazev: 'Přesná konstrukce iluze', text: 'Skutečné 3D těleso, které z vypočteného směru pohledu vytváří iluzi nemožného objektu.' },
    ilustrativni: { znak: '🔴', nazev: 'Ilustrativní model', text: 'Tvar jen připomíná skutečný objekt. Požadovanou vlastnost NEMÁ nebo nebyla ověřena.' },
    aproximace: { znak: '🟡', nazev: 'Doložená aproximace', text: 'Tvar se k přesnému objektu jen blíží. Zdroj aproximace je uveden a odchylka od přesné vlastnosti je změřena.' },
    overena: { znak: '🟢', nazev: 'Numericky ověřený model', text: 'Vlastnost byla změřena přímo na této síti. Platí pro zvolené rozlišení.' },
  };
})(NEM);
if (typeof module !== 'undefined') module.exports = NEM;
