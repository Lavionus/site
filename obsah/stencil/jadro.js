/* ============================================================
   stencil/jadro.js – výpočetní jádro stránky „Šablona na sprej“
   Čisté funkce bez DOM (běží v prohlížeči i v node).

   Úmluva masek: Uint8Array w×h, 1 = VÝŘEZ (tudy projde barva),
   0 = MATERIÁL šablony. Souvislost: materiál 4-okolí (dva kousky
   fólie, které se dotýkají jen rohem, nedrží), výřez 8-okolí.
   Souřadnice obrysů: pixel (x, y) zabírá čtverec [x, x+1] × [y, y+1].

   Vlastní implementace (žádný kód z potrace ani jiných GPL knihoven):
   Otsu / vícestupňový Otsu, box-blur, komponenty, přesná euklidovská
   distanční transformace (Felzenszwalb–Huttenlocher) s nejbližším
   zdrojem, návrh můstků přes Voronoiovy sousednosti + Kruskal,
   marching squares, Douglas–Peucker, Chaikin, hlídání samoprotínání.
   ============================================================ */
(function (koren) {
  'use strict';
  const S = {};

  /* ---------- obraz ---------- */

  // RGBA → šedá (průhlednost se skládá na bílou)
  S.sedotisk = function (rgba, w, h) {
    const n = w * h, g = new Uint8ClampedArray(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const a = rgba[j + 3] / 255;
      const y = 0.2126 * rgba[j] + 0.7152 * rgba[j + 1] + 0.0722 * rgba[j + 2];
      g[i] = Math.round(y * a + 255 * (1 - a));
    }
    return g;
  };

  // jas a kontrast v rozsahu −100…100, gama 0,2…5
  S.jasKontrast = function (g, jas, kontrast, gama) {
    const lut = new Uint8ClampedArray(256);
    const k = Math.tan((Math.max(-99, Math.min(99, kontrast || 0)) / 100 + 1) * Math.PI / 4);
    const gm = gama > 0 ? gama : 1;
    for (let v = 0; v < 256; v++) {
      let x = Math.pow(v / 255, 1 / gm) * 255;
      x = (x - 128) * k + 128 + (jas || 0) * 2.55;
      lut[v] = Math.round(x);
    }
    const o = new Uint8ClampedArray(g.length);
    for (let i = 0; i < g.length; i++) o[i] = lut[g[i]];
    return o;
  };

  // jeden průchod klouzavého průměru v řádcích a sloupcích (okraje se opakují)
  function boxProchod(src, dst, w, h, r) {
    const tmp = new Float32Array(w * h), d = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const o = y * w; let s = 0;
      for (let k = -r; k <= r; k++) s += src[o + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) {
        tmp[o + x] = s / d;
        s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = s / d;
        s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
  // přibližně gaussovské rozmazání (3× box), sigma v pixelech
  S.rozmaz = function (g, w, h, sigma) {
    const out = new Float32Array(g.length);
    for (let i = 0; i < g.length; i++) out[i] = g[i];
    if (!(sigma > 0.3)) return out;
    // šířky tří boxů pro danou sigmu (Kovesi)
    const n = 3, wIdeal = Math.sqrt(12 * sigma * sigma / n + 1);
    let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
    const wu = wl + 2, m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
    for (let i = 0; i < n; i++) {
      const r = ((i < m ? wl : wu) - 1) / 2;
      if (r >= 1) boxProchod(out, out, w, h, r);
    }
    return out;
  };

  S.histogram = function (g) {
    const h = new Float64Array(256);
    for (let i = 0; i < g.length; i++) h[Math.max(0, Math.min(255, Math.round(g[i])))]++;
    return h;
  };

  // Otsu: vrací práh t, tmavá třída = hodnoty ≤ t
  S.otsu = function (hist) {
    let n = 0, suma = 0;
    for (let i = 0; i < 256; i++) { n += hist[i]; suma += i * hist[i]; }
    if (!n) return 127;
    let w0 = 0, s0 = 0, nej = -1, t = 127, tKonec = 127;
    for (let i = 0; i < 255; i++) {
      w0 += hist[i]; s0 += i * hist[i];
      if (!w0) continue;
      const w1 = n - w0; if (!w1) break;
      const m0 = s0 / w0, m1 = (suma - s0) / w1;
      const v = w0 * w1 * (m0 - m1) * (m0 - m1);
      if (v > nej + 1e-9) { nej = v; t = i; tKonec = i; }
      else if (Math.abs(v - nej) <= 1e-9) tKonec = i;   // plató: vzít střed
    }
    return Math.round((t + tKonec) / 2);
  };

  // vícestupňový Otsu: k prahů (vzestupně), k+1 tříd. Pro k ≥ 3 nad 64 koši.
  S.multiOtsu = function (hist, k) {
    if (k <= 1) return [S.otsu(hist)];
    const kose = k >= 3 ? 64 : 256, sir = 256 / kose;
    const H = new Float64Array(kose);
    for (let i = 0; i < 256; i++) H[Math.floor(i / sir)] += hist[i];
    const P = new Float64Array(kose + 1), Sm = new Float64Array(kose + 1);
    for (let i = 0; i < kose; i++) { P[i + 1] = P[i] + H[i]; Sm[i + 1] = Sm[i] + (i + 0.5) * sir * H[i]; }
    const clen = (a, b) => { const p = P[b] - P[a]; if (p <= 0) return 0; const s = Sm[b] - Sm[a]; return s * s / p; };
    let nej = -1, vys = null;
    const t = new Array(k);
    (function rek(uroven, od, hodnota) {
      if (uroven === k) {
        const v = hodnota + clen(od, kose);
        if (v > nej) { nej = v; vys = t.slice(); }
        return;
      }
      for (let i = od + 1; i <= kose - (k - uroven); i++) {
        t[uroven] = i;
        rek(uroven + 1, i, hodnota + clen(od, i));
      }
    })(0, 0, 0);
    // hranice koše i → práh = poslední hodnota tmavší třídy
    return vys.map(i => Math.min(254, Math.round(i * sir) - 1));
  };

  S.prah = function (g, t) {
    const m = new Uint8Array(g.length);
    for (let i = 0; i < g.length; i++) m[i] = g[i] <= t ? 1 : 0;
    return m;
  };

  /* Vrstvy pro vícebarevné sprejování. prahy vzestupně (t1 < t2 < …).
     Vrací masky v pořadí nástřiku: [0] = nejsvětlejší tón (první).
     kumulativni: vrstva i obsahuje i všechny tmavší tóny (barvy se
     překrývají, odpouští nepřesné přiložení); jinak jen svůj pás.   */
  S.vrstvy = function (g, prahy, kumulativni) {
    const t = prahy.slice().sort((a, b) => a - b), n = t.length, out = [];
    for (let j = 0; j < n; j++) {
      const horni = t[n - 1 - j], dolni = kumulativni || j === n - 1 ? -1 : t[n - 2 - j];
      const m = new Uint8Array(g.length);
      for (let i = 0; i < g.length; i++) m[i] = g[i] <= horni && g[i] > dolni ? 1 : 0;
      out.push(m);
    }
    return out;
  };

  S.inverze = function (m) {
    const o = new Uint8Array(m.length);
    for (let i = 0; i < m.length; i++) o[i] = m[i] ? 0 : 1;
    return o;
  };

  // vyhlazení obrysu: rozmazání masky a nový práh v polovině
  S.vyhladMasku = function (m, w, h, sigma) {
    if (!(sigma > 0.3)) return Uint8Array.from(m);
    const f = new Float32Array(m.length);
    for (let i = 0; i < m.length; i++) f[i] = m[i] ? 255 : 0;
    const r = S.rozmaz(f, w, h, sigma), o = new Uint8Array(m.length);
    for (let i = 0; i < m.length; i++) o[i] = r[i] >= 127.5 ? 1 : 0;
    return o;
  };

  // přidá okraj materiálu (rám šablony)
  S.obal = function (m, w, h, o) {
    const W = w + 2 * o, H = h + 2 * o, r = new Uint8Array(W * H);
    for (let y = 0; y < h; y++) r.set(m.subarray(y * w, y * w + w), (y + o) * W + o);
    return { maska: r, w: W, h: H };
  };

  /* ---------- komponenty ---------- */

  // označí komponenty pixelů s hodnotou `hodnota`; osmi = 8-okolí
  S.komponenty = function (m, w, h, hodnota, osmi) {
    const n = w * h, stitky = new Int32Array(n).fill(-1), fronta = new Int32Array(n);
    const plochy = [], okraj = [], bbox = [], sx = [], sy = [];
    let pocet = 0;
    for (let s = 0; s < n; s++) {
      if (m[s] !== hodnota || stitky[s] >= 0) continue;
      const id = pocet++;
      let hl = 0, ko = 0, pl = 0, dot = false, x0 = w, y0 = h, x1 = -1, y1 = -1, ssx = 0, ssy = 0;
      fronta[ko++] = s; stitky[s] = id;
      while (hl < ko) {
        const p = fronta[hl++], x = p % w, y = (p - x) / w;
        pl++; ssx += x; ssy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) dot = true;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            if (!osmi && dx && dy) continue;
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const q = yy * w + xx;
            if (m[q] === hodnota && stitky[q] < 0) { stitky[q] = id; fronta[ko++] = q; }
          }
        }
      }
      plochy.push(pl); okraj.push(dot); bbox.push([x0, y0, x1, y1]); sx.push(ssx / pl); sy.push(ssy / pl);
    }
    return { stitky, pocet, plochy, okraj, bbox, tx: sx, ty: sy };
  };

  // odstraní drobné výřezy i drobné kousky materiálu (menší než minPlocha px)
  S.odstranDrobnosti = function (m, w, h, minPlocha) {
    const o = Uint8Array.from(m);
    if (!(minPlocha >= 1)) return o;
    const kv = S.komponenty(o, w, h, 1, true);
    for (let i = 0; i < o.length; i++) { const s = kv.stitky[i]; if (s >= 0 && kv.plochy[s] < minPlocha) o[i] = 0; }
    const km = S.komponenty(o, w, h, 0, false);
    for (let i = 0; i < o.length; i++) { const s = km.stitky[i]; if (s >= 0 && !km.okraj[s] && km.plochy[s] < minPlocha) o[i] = 1; }
    return o;
  };

  /* Ostrůvky = komponenty materiálu, které nejsou spojené s rámem
     (s komponentou, která se dotýká okraje). */
  S.najdiOstrovy = function (m, w, h) {
    const k = S.komponenty(m, w, h, 0, false);
    const ostrovy = [];
    for (let i = 0; i < k.pocet; i++) if (!k.okraj[i]) {
      ostrovy.push({ id: i, plocha: k.plochy[i], bbox: k.bbox[i], tx: k.tx[i], ty: k.ty[i] });
    }
    return { stitky: k.stitky, pocet: k.pocet, okraj: k.okraj, ostrovy, komponenty: k };
  };

  /* ---------- distanční transformace ---------- */

  const NEK = 1e20;
  // 1D: f vstup, d výstup, arg výstup (index nejbližšího bodu)
  function dt1(f, n, d, arg, v, z) {
    let k = 0; v[0] = 0; z[0] = -NEK; z[1] = NEK;
    for (let q = 1; q < n; q++) {
      if (f[q] >= NEK) continue;
      if (f[v[k]] >= NEK) { v[k] = q; continue; }
      let s;
      while (true) {
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        if (s <= z[k] && k > 0) k--; else break;
      }
      if (s <= z[k]) { v[k] = q; z[k + 1] = NEK; continue; }
      k++; v[k] = q; z[k] = s; z[k + 1] = NEK;
    }
    if (f[v[0]] >= NEK) { for (let q = 0; q < n; q++) { d[q] = NEK; arg[q] = -1; } return; }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const dq = q - v[k];
      d[q] = dq * dq + f[v[k]]; arg[q] = v[k];
    }
  }
  /* Přesná EDT: zdroj[i] = 1 pro zdrojové pixely.
     Vrací d2 (čtverec vzdálenosti) a idx (index nejbližšího zdroje, −1 když není). */
  S.edt = function (zdroj, w, h) {
    const n = w * h, mx = Math.max(w, h);
    const f = new Float64Array(mx), d = new Float64Array(mx), arg = new Int32Array(mx);
    const v = new Int32Array(mx), z = new Float64Array(mx + 1);
    const d1 = new Float64Array(n), radek = new Int32Array(n);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = zdroj[y * w + x] ? 0 : NEK;
      dt1(f, h, d, arg, v, z);
      for (let y = 0; y < h; y++) { d1[y * w + x] = d[y]; radek[y * w + x] = arg[y]; }
    }
    const d2 = new Float32Array(n), idx = new Int32Array(n);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) f[x] = d1[o + x];
      dt1(f, w, d, arg, v, z);
      for (let x = 0; x < w; x++) {
        if (arg[x] < 0 || d[x] >= NEK) { d2[o + x] = Infinity; idx[o + x] = -1; continue; }
        d2[o + x] = d[x];
        idx[o + x] = radek[o + arg[x]] * w + arg[x];
      }
    }
    return { d2, idx };
  };

  /* ---------- můstky ---------- */

  // úsečka s poloměrem r (kapsle) → do masky zapíše materiál (0)
  S.aplikujMustky = function (m, w, h, mustky) {
    const o = Uint8Array.from(m);
    for (const b of mustky || []) {
      const r = Math.max(1, (b.s || 2) / 2), r2 = r * r;
      const ax = b.ax, ay = b.ay, bx = b.bx, by = b.by;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + r));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + r));
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = ax + t * dx - x, ey = ay + t * dy - y;
        if (ex * ex + ey * ey <= r2) o[y * w + x] = 0;
      }
    }
    return o;
  };

  function UF(n) {
    const p = new Int32Array(n); for (let i = 0; i < n; i++) p[i] = i;
    const najdi = a => { while (p[a] !== a) { p[a] = p[p[a]]; a = p[a]; } return a; };
    return { najdi, spoj: (a, b) => { a = najdi(a); b = najdi(b); if (a === b) return false; p[a] = b; return true; } };
  }

  /* Návrh můstků pro všechny ostrůvky.
     volby: sirka (px), naOstrov 1|2, smer 'nejkratsi'|'svisle'|'vodorovne',
            jenOstrov (index pixelu – navrhne jen pro ostrůvek, kterému patří)
     Vrací [{ax, ay, bx, by, s}] v pixelech (středy pixelů). */
  S.navrhniMustky = function (m, w, h, volby) {
    volby = volby || {};
    const sirka = Math.max(2, volby.sirka || 3);
    const info = S.najdiOstrovy(m, w, h);
    if (!info.ostrovy.length) return [];
    const lab = info.stitky, K = info.pocet;
    const uf = UF(K + 1), RAM = K;          // virtuální uzel „rám“
    for (let i = 0; i < K; i++) if (info.okraj[i]) uf.spoj(i, RAM);
    const vysledek = [];
    const pridej = (a, b) => {
      const ax = a % w, ay = (a - ax) / w, bx = b % w, by = (b - bx) / w;
      vysledek.push({ ax, ay, bx, by, s: sirka });
    };
    const jenId = volby.jenOstrov != null && volby.jenOstrov >= 0 ? lab[volby.jenOstrov] : -1;

    // 1) směrované můstky (styl šablonového písma)
    if (volby.smer === 'svisle' || volby.smer === 'vodorovne') {
      const svisle = volby.smer === 'svisle';
      // seřadit podle velikosti, aby velké ostrůvky dostaly můstky dřív
      const ostr = info.ostrovy.slice().sort((a, b) => b.plocha - a.plocha);
      for (const o of ostr) {
        if (jenId >= 0 && o.id !== jenId) continue;
        const [x0, y0, x1, y1] = o.bbox;
        // řez vedený těžištěm; když tam ostrůvek není, nejbližší řádek/sloupec s jeho pixely
        let c = Math.round(svisle ? o.tx : o.ty), nejC = -1;
        const lo = svisle ? x0 : y0, hi = svisle ? x1 : y1;
        for (let d = 0; d <= hi - lo && nejC < 0; d++) {
          for (const cc of [c - d, c + d]) {
            if (cc < lo || cc > hi) continue;
            for (let t = svisle ? y0 : x0; t <= (svisle ? y1 : x1); t++) {
              const p = svisle ? t * w + cc : cc * w + t;
              if (lab[p] === o.id) { nejC = cc; break; }
            }
            if (nejC >= 0) break;
          }
        }
        if (nejC < 0) continue;
        c = nejC;
        const kand = [];
        for (const smer of [-1, 1]) {
          // krajní pixel ostrůvku v tomto řezu
          let t = smer < 0 ? (svisle ? y0 : x0) : (svisle ? y1 : x1), start = -1;
          const konec = smer < 0 ? (svisle ? y1 : x1) : (svisle ? y0 : x0);
          for (; smer < 0 ? t <= konec : t >= konec; t -= smer) {
            const p = svisle ? t * w + c : c * w + t;
            if (lab[p] === o.id) { start = t; break; }
          }
          if (start < 0) continue;
          let u = start + smer, cil = -1;
          const max = svisle ? h : w;
          for (; u >= 0 && u < max; u += smer) {
            const p = svisle ? u * w + c : c * w + u;
            if (lab[p] >= 0 && lab[p] !== o.id) { cil = u; break; }
          }
          if (cil < 0) continue;
          const a = svisle ? start * w + c : c * w + start, b = svisle ? cil * w + c : c * w + cil;
          kand.push({ a, b, d: Math.abs(cil - start), cilId: lab[b] });
        }
        kand.sort((p, q) => p.d - q.d);
        const vzit = (volby.naOstrov || 1) >= 2 ? kand : kand.slice(0, 1);
        for (const k of vzit) { pridej(k.a, k.b); uf.spoj(o.id, k.cilId); }
      }
    }

    // 2) nejkratší můstky: Voronoiovy sousednosti komponent + Kruskal
    const zdroj = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (m[p]) continue;
      if ((x > 0 && m[p - 1]) || (x < w - 1 && m[p + 1]) || (y > 0 && m[p - w]) || (y < h - 1 && m[p + w])) zdroj[p] = 1;
    }
    const { idx } = S.edt(zdroj, w, h);
    const hrany = new Map();                      // klíč dvojice → nejlepší kandidát
    const kandOstr = new Map();                   // id ostrůvku → kandidáti (pro 2. můstek)
    const vzdal = (a, b) => { const ax = a % w, ay = (a - ax) / w, bx = b % w, by = (b - bx) / w; return Math.hypot(ax - bx, ay - by); };
    const zkus = (p, q) => {
      const a = idx[p], b = idx[q];
      if (a < 0 || b < 0) return;
      const la = lab[a], lb = lab[b];
      if (la === lb || la < 0 || lb < 0) return;
      const d = vzdal(a, b);
      const klic = la < lb ? la * K + lb : lb * K + la;
      const st = hrany.get(klic);
      if (!st || d < st.d) hrany.set(klic, { d, a, b, la, lb });
      for (const [id, z, c] of [[la, a, b], [lb, b, a]]) {
        if (info.okraj[id]) continue;
        let s = kandOstr.get(id); if (!s) kandOstr.set(id, s = []);
        s.push({ d, a: z, b: c, cil: id === la ? lb : la });
      }
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (x < w - 1 && (m[p] || m[p + 1])) zkus(p, p + 1);
      if (y < h - 1 && (m[p] || m[p + w])) zkus(p, p + w);
    }
    const serazene = [...hrany.values()].sort((p, q) => p.d - q.d);
    const stupen = new Map();
    const ukotvene = new Map();                   // id ostrůvku → [konce můstků na něm]
    for (const v of vysledek) {
      const a = v.ay * w + v.ax; const id = lab[a];
      if (!ukotvene.has(id)) ukotvene.set(id, []);
      ukotvene.get(id).push([v.ax, v.ay]);
      stupen.set(id, (stupen.get(id) || 0) + 1);
    }
    const chci = id => jenId < 0 || id === jenId;
    for (const e of serazene) {
      if (jenId >= 0 && e.la !== jenId && e.lb !== jenId) continue;
      if (!uf.spoj(e.la, e.lb)) continue;
      pridej(e.a, e.b);
      for (const [id, z] of [[e.la, e.a], [e.lb, e.b]]) {
        stupen.set(id, (stupen.get(id) || 0) + 1);
        if (!ukotvene.has(id)) ukotvene.set(id, []);
        ukotvene.get(id).push([z % w, Math.floor(z / w)]);
      }
      if (jenId >= 0 && uf.najdi(jenId) === uf.najdi(RAM)) break;
    }

    // 3) druhý můstek pro větší ostrůvky (ať se neotáčí kolem jednoho)
    if ((volby.naOstrov || 1) >= 2 && volby.smer !== 'svisle' && volby.smer !== 'vodorovne') {
      for (const o of info.ostrovy) {
        if (!chci(o.id) || (stupen.get(o.id) || 0) >= 2) continue;
        const [x0, y0, x1, y1] = o.bbox, diag = Math.hypot(x1 - x0 + 1, y1 - y0 + 1);
        if (diag < 4 * sirka) continue;
        const kotvy = ukotvene.get(o.id) || [];
        const kand = (kandOstr.get(o.id) || []).sort((p, q) => p.d - q.d);
        const prah = Math.max(3 * sirka, 0.45 * diag);
        const odstup = k => { const kx = k.a % w, ky = (k.a - kx) / w; return Math.min(...kotvy.map(([x, y]) => Math.hypot(x - kx, y - ky))); };
        const vyhovi = kand.filter(k => odstup(k) >= prah);
        if (!vyhovi.length) continue;
        // z téměř stejně krátkých vzít ten nejdál od prvního můstku (u O protilehlý)
        const mez = vyhovi[0].d * 1.25 + 1;
        let nej = vyhovi[0], nejO = -1;
        for (const k of vyhovi) { if (k.d > mez) break; const od = odstup(k); if (od > nejO) { nejO = od; nej = k; } }
        pridej(nej.a, nej.b);
      }
    }
    return vysledek;
  };

  /* ---------- tenká místa ---------- */

  /* Materiál užší než limit (px). Morfologické otevření kruhem o průměru
     limit; co zmizí, je tenké. Drobné zbytky v rozích se zahodí.      */
  S.tenkaMista = function (m, w, h, limit) {
    const n = w * h, mapa = new Uint8Array(n);
    if (!(limit > 1)) return { mapa, pocet: 0, plocha: 0, mista: [] };
    const r = limit / 2;
    const vyrez = new Uint8Array(n); let jeVyrez = false;
    for (let i = 0; i < n; i++) if (m[i]) { vyrez[i] = 1; jeVyrez = true; }
    if (!jeVyrez) return { mapa, pocet: 0, plocha: 0, mista: [] };
    const d1 = S.edt(vyrez, w, h).d2;
    const jadro = new Uint8Array(n), prah1 = (r + 0.5) * (r + 0.5);
    for (let i = 0; i < n; i++) if (!m[i] && d1[i] >= prah1) jadro[i] = 1;
    const d2 = S.edt(jadro, w, h).d2, prah2 = (r + 0.5) * (r + 0.5);
    for (let i = 0; i < n; i++) if (!m[i] && !(d2[i] <= prah2)) mapa[i] = 1;
    const k = S.komponenty(mapa, w, h, 1, true);
    const minPl = Math.max(3, 0.6 * r * r), mista = [];
    let plocha = 0;
    for (let i = 0; i < n; i++) { const s = k.stitky[i]; if (s >= 0 && k.plochy[s] < minPl) mapa[i] = 0; }
    for (let s = 0; s < k.pocet; s++) if (k.plochy[s] >= minPl) { mista.push({ x: k.tx[s], y: k.ty[s], plocha: k.plochy[s], bbox: k.bbox[s] }); plocha += k.plochy[s]; }
    return { mapa, pocet: mista.length, plocha, mista };
  };

  /* ---------- vektorizace ---------- */

  /* Marching squares nad středy pixelů (mimo obraz = materiál).
     Vrací uzavřené obrysy [[x,y],…] (bez opakování prvního bodu),
     orientované tak, že výřez leží vlevo (při ose y dolů). Sedlové
     buňky spojují výřez úhlopříčně (výřez 8-okolí, materiál 4-okolí). */
  S.kontury = function (m, w, h) {
    const W = w + 1;                    // buňky cx = -1..w-1 → posun o 1
    const val = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : m[y * w + x];
    // klíče hran: vodorovná hrana mezi středy (x,y)-(x+1,y): 2*((y+1)*(W+1)+(x+1)); svislá (x,y)-(x,y+1): +1
    const kH = (x, y) => 2 * ((y + 1) * (W + 1) + (x + 1));
    const kV = (x, y) => 2 * ((y + 1) * (W + 1) + (x + 1)) + 1;
    const dalsi = new Map(), bod = new Map();
    for (let cy = -1; cy < h; cy++) for (let cx = -1; cx < w; cx++) {
      const a = val(cx, cy), b = val(cx + 1, cy), c = val(cx + 1, cy + 1), d = val(cx, cy + 1);
      const kod = a | (b << 1) | (c << 2) | (d << 3);
      if (kod === 0 || kod === 15) continue;
      // hrany buňky: T, R, B, L se středy
      const E = {
        T: [kH(cx, cy), cx + 1, cy + 0.5],
        R: [kV(cx + 1, cy), cx + 1.5, cy + 1],
        B: [kH(cx, cy + 1), cx + 1, cy + 1.5],
        L: [kV(cx, cy), cx + 0.5, cy + 1],
      };
      let pary;
      switch (kod) {
        case 1: case 14: pary = [['T', 'L']]; break;
        case 2: case 13: pary = [['T', 'R']]; break;
        case 4: case 11: pary = [['R', 'B']]; break;
        case 8: case 7: pary = [['B', 'L']]; break;
        case 3: case 12: pary = [['L', 'R']]; break;
        case 6: case 9: pary = [['T', 'B']]; break;
        case 5: pary = [['T', 'R'], ['B', 'L']]; break;   // výřez a+c spojený → odříznout b a d
        case 10: pary = [['T', 'L'], ['R', 'B']]; break;  // výřez b+d spojený → odříznout a a c
      }
      // roh výřezu pro orientaci
      const rohy = [[a, cx + 0.5, cy + 0.5], [b, cx + 1.5, cy + 0.5], [c, cx + 1.5, cy + 1.5], [d, cx + 0.5, cy + 1.5]];
      for (const [e1, e2] of pary) {
        let p = E[e1], q = E[e2];
        // najít roh výřezu, který tato úsečka „vidí“ (u sedel ten na správné straně)
        let roh = null;
        for (const r of rohy) {
          if (!r[0]) continue;
          // u sedla 5/10 je každá úsečka mezi dvěma rohy výřezu – oba na stejné straně
          roh = r; break;
        }
        const cr = (q[1] - p[1]) * (roh[2] - p[2]) - (q[2] - p[2]) * (roh[1] - p[1]);
        if (cr > 0) { const t = p; p = q; q = t; }   // výřez vlevo: cross < 0 při y dolů
        dalsi.set(p[0], q[0]);
        bod.set(p[0], [p[1], p[2]]); bod.set(q[0], [q[1], q[2]]);
      }
    }
    const navstiveno = new Set(), obrysy = [];
    for (const start of dalsi.keys()) {
      if (navstiveno.has(start)) continue;
      const poly = [];
      let k = start, bezpecnost = dalsi.size + 2;
      while (!navstiveno.has(k) && bezpecnost-- > 0) {
        navstiveno.add(k); poly.push(bod.get(k));
        k = dalsi.get(k);
        if (k === undefined) break;
      }
      if (poly.length >= 3) obrysy.push(poly);
    }
    return obrysy;
  };

  S.plochaPoly = function (p) {
    let s = 0;
    for (let i = 0, n = p.length; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; }
    return s / 2;
  };

  // Douglas–Peucker pro uzavřený polygon
  S.zjednodus = function (p, eps) {
    const n = p.length;
    if (n < 5 || !(eps > 0)) return p.slice();
    // dva vzdálené body jako kotvy
    let i1 = 0, nej = -1;
    for (let i = 1; i < n; i++) { const d = (p[i][0] - p[0][0]) ** 2 + (p[i][1] - p[0][1]) ** 2; if (d > nej) { nej = d; i1 = i; } }
    const drz = new Uint8Array(n); drz[0] = 1; drz[i1] = 1;
    const e2 = eps * eps;
    const zas = [[0, i1], [i1, n]];
    while (zas.length) {
      const [a, b] = zas.pop();
      if (b - a < 2) continue;
      const A = p[a], B = p[b % n], dx = B[0] - A[0], dy = B[1] - A[1], l2 = dx * dx + dy * dy;
      let mx = -1, mi = -1;
      for (let i = a + 1; i < b; i++) {
        const P = p[i];
        let d;
        if (l2 === 0) d = (P[0] - A[0]) ** 2 + (P[1] - A[1]) ** 2;
        else { const c = (P[0] - A[0]) * dy - (P[1] - A[1]) * dx; d = c * c / l2; }
        if (d > mx) { mx = d; mi = i; }
      }
      if (mx > e2) { drz[mi] = 1; zas.push([a, mi], [mi, b]); }
    }
    const o = [];
    for (let i = 0; i < n; i++) if (drz[i]) o.push(p[i]);
    return o.length >= 3 ? o : p.slice();
  };

  // Chaikin (uzavřený), ostré rohy pod úhlem `ostry` (rad) se zachovají
  S.chaikin = function (p, kroky, ostry) {
    let a = p;
    const mez = ostry == null ? 0 : ostry;
    for (let k = 0; k < (kroky || 0); k++) {
      const n = a.length, o = [];
      for (let i = 0; i < n; i++) {
        const P = a[i], Q = a[(i + 1) % n];
        if (mez > 0) {
          const R = a[(i - 1 + n) % n];
          const v1x = R[0] - P[0], v1y = R[1] - P[1], v2x = Q[0] - P[0], v2y = Q[1] - P[1];
          const ug = Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1))));
          if (ug < mez) { o.push(P); o.push([0.75 * P[0] + 0.25 * Q[0], 0.75 * P[1] + 0.25 * Q[1]]); o.push([0.25 * P[0] + 0.75 * Q[0], 0.25 * P[1] + 0.75 * Q[1]]); continue; }
        }
        o.push([0.75 * P[0] + 0.25 * Q[0], 0.75 * P[1] + 0.25 * Q[1]]);
        o.push([0.25 * P[0] + 0.75 * Q[0], 0.25 * P[1] + 0.75 * Q[1]]);
      }
      a = o;
    }
    return a;
  };

  function protinaSe(a, b, c, d) {
    const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  /* Najde obrysy, jejichž hrany se kříží (samy se sebou i navzájem).
     Mřížka pro rychlost. Vrací Set indexů obrysů. */
  S.krizeni = function (polys) {
    const vadne = new Set();
    let bunka = 8, seg = [];
    polys.forEach((p, pi) => { for (let i = 0; i < p.length; i++) seg.push([pi, i, p[i], p[(i + 1) % p.length], p.length]); });
    if (!seg.length) return vadne;
    let delka = 0; for (const s of seg) delka += Math.hypot(s[3][0] - s[2][0], s[3][1] - s[2][1]);
    bunka = Math.max(2, 2 * delka / seg.length);
    const mrizka = new Map();
    seg.forEach((s, si) => {
      const x0 = Math.floor(Math.min(s[2][0], s[3][0]) / bunka), x1 = Math.floor(Math.max(s[2][0], s[3][0]) / bunka);
      const y0 = Math.floor(Math.min(s[2][1], s[3][1]) / bunka), y1 = Math.floor(Math.max(s[2][1], s[3][1]) / bunka);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const k = x * 73856093 ^ y * 19349663;
        let l = mrizka.get(k); if (!l) mrizka.set(k, l = []);
        l.push(si);
      }
    });
    for (const l of mrizka.values()) {
      for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
        const A = seg[l[i]], B = seg[l[j]];
        if (A[0] === B[0]) {
          const n = A[4], di = Math.abs(A[1] - B[1]);
          if (di <= 1 || di === n - 1) continue;      // sousední hrany sdílí bod
        }
        if (protinaSe(A[2], A[3], B[2], B[3])) { vadne.add(A[0]); vadne.add(B[0]); }
      }
    }
    return vadne;
  };

  /* Celá vektorizace: obrysy → zjednodušení → vyhlazení, s pojistkou proti
     křížení (vadné obrysy se zkusí jemněji, nakonec se nechají surové). */
  S.vektorizuj = function (m, w, h, volby) {
    volby = volby || {};
    const eps = volby.eps == null ? 0.7 : volby.eps, kroky = volby.vyhlazeni == null ? 1 : volby.vyhlazeni;
    const surove = S.kontury(m, w, h);
    const zprac = (p, e, k) => S.chaikin(S.zjednodus(p, e), k, 1.2);
    let vys = surove.map(p => zprac(p, eps, kroky));
    let opravy = 0;
    for (let pokus = 0; pokus < 4; pokus++) {
      const vadne = S.krizeni(vys);
      if (!vadne.size) break;
      opravy += vadne.size;
      const e = eps / Math.pow(2, pokus + 1), k = pokus >= 2 ? 0 : kroky;
      for (const i of vadne) vys[i] = pokus === 3 ? surove[i] : zprac(surove[i], e, k);
    }
    return { obrysy: vys, surove, opravy };
  };

  /* ---------- celé zpracování ---------- */

  /* g: šedotónový obraz (w×h), n: nastavení (viz výchozí v ui.js)
     rucni: pole po vrstvách [{u, v, u2, v2, s(mm)}] – souřadnice 0..1 v obraze
     Vrací {W, H, pad, pxNaMm, vrstvy:[…]} */
  S.zpracuj = function (g, w, h, n, rucni) {
    const pxNaMm = n.pxNaMm;
    let obr = S.jasKontrast(g, n.jas, n.kontrast, n.gama);
    let f = S.rozmaz(obr, w, h, (n.rozmazani || 0) * pxNaMm);
    const hist = S.histogram(f);
    const pocet = Math.max(1, Math.min(4, n.vrstev | 0 || 1));
    let prahy;
    if (n.prahAuto) prahy = S.multiOtsu(hist, pocet);
    else prahy = (n.prahy || [128]).slice(0, pocet);
    while (prahy.length < pocet) prahy.push(Math.min(254, (prahy[prahy.length - 1] || 0) + 40));
    prahy = prahy.slice().sort((a, b) => a - b);
    const masky = S.vrstvy(f, prahy, n.kumulativni !== false);
    const pad = Math.max(2, Math.round((n.okraj || 0) * pxNaMm));
    const vys = { pad, pxNaMm, prahy, hist, w, h, vrstvy: [] };
    masky.forEach((m0, vi) => {
      let m = n.inverze ? S.inverze(m0) : m0;
      m = S.vyhladMasku(m, w, h, (n.vyhlazeni || 0) * pxNaMm);
      m = S.odstranDrobnosti(m, w, h, (n.minPlocha || 0) * pxNaMm * pxNaMm);
      const ob = S.obal(m, w, h, pad);
      const W = ob.w, H = ob.h;
      vys.W = W; vys.H = H;
      const sPx = Math.max(2, (n.sirkaMustku || 2) * pxNaMm);
      const naPx = b => ({ ax: pad + b.u * w, ay: pad + b.v * h, bx: pad + b.u2 * w, by: pad + b.v2 * h, s: Math.max(2, (b.s || n.sirkaMustku || 2) * pxNaMm) });
      const ruc = ((rucni || [])[vi] || []).map(naPx);
      let m1 = S.aplikujMustky(ob.maska, W, H, ruc);
      let auto = [];
      if (n.mustkyAuto) {
        auto = S.navrhniMustky(m1, W, H, { sirka: sPx, naOstrov: n.mustkuNaOstrov || 1, smer: n.smerMustku || 'nejkratsi' });
        m1 = S.aplikujMustky(m1, W, H, auto);
      }
      const puvodniOstrovy = S.najdiOstrovy(ob.maska, W, H).ostrovy.length;
      const zbyle = S.najdiOstrovy(m1, W, H);
      const tenka = n.kontrolaTenkych === false ? { mapa: new Uint8Array(W * H), pocet: 0, mista: [] }
        : S.tenkaMista(m1, W, H, (n.limitTenkych || 1.5) * pxNaMm);
      const vek = S.vektorizuj(m1, W, H, { eps: n.zjednoduseni == null ? 0.7 : n.zjednoduseni, vyhlazeni: n.vyhlazeniVektoru == null ? 1 : n.vyhlazeniVektoru });
      let plochaVyrezu = 0; for (let i = 0; i < m1.length; i++) plochaVyrezu += m1[i];
      vys.vrstvy.push({
        prah: prahy[prahy.length - 1 - vi],
        maska: ob.maska, finalni: m1, stitky: zbyle.stitky,
        nepodlozene: zbyle.ostrovy, puvodniOstrovy,
        mustkyRucni: ruc, mustkyAuto: auto,
        tenka, obrysy: vek.obrysy, opravyKrizeni: vek.opravy,
        plochaVyrezuMm2: plochaVyrezu / (pxNaMm * pxNaMm),
      });
    });
    return vys;
  };

  // převod px můstku → normalizované souřadnice obrazu (pro uložení ručních můstků)
  S.mustekNaNorm = function (b, pad, w, h, pxNaMm) {
    return { u: (b.ax - pad) / w, v: (b.ay - pad) / h, u2: (b.bx - pad) / w, v2: (b.by - pad) / h, s: b.s / pxNaMm };
  };

  S.verze = 1;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
  else koren.STENCIL = S;
})(typeof window !== 'undefined' ? window : globalThis);
