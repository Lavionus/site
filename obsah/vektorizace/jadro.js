/* ============================================================
   vektorizace/jadro.js – trasování bitmapy do vektorů (SVG, DXF)
   Čisté funkce bez DOM: běží v prohlížeči, ve Web Workeru i v node.

   Vlastní implementace čistou místností (žádný kód z potrace ani jiné
   GPL knihovny). Použité algoritmy z publikací:
   - Otsu (1979) – automatický práh,
   - k-means++ (Arthur, Vassilvitskii 2007), median cut (Heckbert 1982),
   - sledování hranic po hranách pixelů (crack following) s pevným
     pravidlem odbočení na křižovatkách → uzavřené smyčky, vnější
     kladně, díry záporně orientované,
   - k-kosinová míra zakřivení pro rohy (Rosenfeld, Johnston 1973),
   - Douglas–Peucker (1973), proložení kubickými Bézierovými křivkami
     metodou nejmenších čtverců s Newtonovou reparametrizací
     (Schneider, Graphics Gems 1990),
   - ztenčení Zhang–Suen (1984) pro středovou čáru.

   Souřadnice: pixel (x, y) zabírá čtverec [x, x+1] × [y, y+1], osa y dolů.
   Smyčka = { p0:[x,y], s:[ ['L',x,y] | ['C',x1,y1,x2,y2,x,y] ], r:[bool] }
   (r[i] = uzel na konci úseku i je roh).
   ============================================================ */
(function (koren) {
  'use strict';
  const V = {};

  /* ================= obraz ================= */

  // RGBA → šedá 0–255 (průhlednost se skládá na bílou)
  V.sedotisk = function (rgba, w, h) {
    const n = w * h, g = new Uint8ClampedArray(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const a = rgba[j + 3] / 255;
      const y = 0.2126 * rgba[j] + 0.7152 * rgba[j + 1] + 0.0722 * rgba[j + 2];
      g[i] = Math.round(y * a + 255 * (1 - a));
    }
    return g;
  };

  // jeden průchod box filtru v řádcích (s okrajem opakováním krajního pixelu)
  function boxRadky(src, dst, w, h, r) {
    const d = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let s = src[o] * (r + 1);
      for (let x = 1; x <= r; x++) s += src[o + Math.min(x, w - 1)];
      for (let x = 0; x < w; x++) {
        dst[o + x] = s / d;
        s += src[o + Math.min(x + r + 1, w - 1)] - src[o + Math.max(x - r, 0)];
      }
    }
  }
  function transponuj(src, dst, w, h) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dst[x * h + y] = src[y * w + x];
  }
  // přibližné Gaussovo rozostření jednoho kanálu (3× box, Kovesi/Wells)
  function rozmazKanal(f, w, h, sigma) {
    const n = 3, wIdeal = Math.sqrt(12 * sigma * sigma / n + 1);
    let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
    const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
    const a = f, b = new Float32Array(f.length);
    for (let i = 0; i < n; i++) {
      const r = ((i < m ? wl : wl + 2) - 1) >> 1;
      if (r < 1) continue;
      boxRadky(a, b, w, h, r); transponuj(b, a, w, h);
      boxRadky(a, b, h, w, r); transponuj(b, a, h, w);
    }
    return a;
  }
  V.rozmaz = function (rgba, w, h, sigma) {
    if (!(sigma > 0.2)) return rgba;
    const n = w * h, out = new Uint8ClampedArray(rgba.length), f = new Float32Array(n);
    for (let c = 0; c < 4; c++) {
      for (let i = 0; i < n; i++) f[i] = rgba[i * 4 + c];
      rozmazKanal(f, w, h, sigma);
      for (let i = 0; i < n; i++) out[i * 4 + c] = f[i];
    }
    return out;
  };

  // bilineární zvětšení (malé obrázky → hladší obrysy)
  V.zvetsi = function (rgba, w, h, k) {
    if (!(k > 1)) return { data: rgba, w, h };
    const W = Math.round(w * k), H = Math.round(h * k), out = new Uint8ClampedArray(W * H * 4);
    for (let Y = 0; Y < H; Y++) {
      const sy = Math.min(h - 1, Math.max(0, (Y + 0.5) / k - 0.5)), y0 = Math.floor(sy), y1 = Math.min(h - 1, y0 + 1), fy = sy - y0;
      for (let X = 0; X < W; X++) {
        const sx = Math.min(w - 1, Math.max(0, (X + 0.5) / k - 0.5)), x0 = Math.floor(sx), x1 = Math.min(w - 1, x0 + 1), fx = sx - x0;
        const a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, d = (y1 * w + x1) * 4, o = (Y * W + X) * 4;
        for (let q = 0; q < 4; q++) {
          out[o + q] = (rgba[a + q] * (1 - fx) + rgba[b + q] * fx) * (1 - fy) + (rgba[c + q] * (1 - fx) + rgba[d + q] * fx) * fy;
        }
      }
    }
    return { data: out, w: W, h: H };
  };

  V.orez = function (rgba, w, h, r) {
    if (!r) return { data: rgba, w, h };
    const x0 = Math.max(0, Math.min(w - 1, Math.round(r.x))), y0 = Math.max(0, Math.min(h - 1, Math.round(r.y)));
    const W = Math.max(1, Math.min(w - x0, Math.round(r.w))), H = Math.max(1, Math.min(h - y0, Math.round(r.h)));
    if (x0 === 0 && y0 === 0 && W === w && H === h) return { data: rgba, w, h };
    const out = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) out.set(rgba.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + W) * 4), y * W * 4);
    return { data: out, w: W, h: H };
  };

  /* ================= práh ================= */

  V.histogram = function (g) {
    const hi = new Float64Array(256);
    for (let i = 0; i < g.length; i++) hi[g[i]]++;
    return hi;
  };
  // Otsu: práh maximalizující rozptyl mezi třídami; vrací t, inkoust = g < t
  V.otsu = function (g) {
    const hi = V.histogram(g); let n = 0, suma = 0;
    for (let i = 0; i < 256; i++) { n += hi[i]; suma += i * hi[i]; }
    let wB = 0, sB = 0, nej = -1, t = 128;
    for (let i = 0; i < 256; i++) {
      wB += hi[i]; if (!wB) continue;
      const wF = n - wB; if (!wF) break;
      sB += i * hi[i];
      const mB = sB / wB, mF = (suma - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
      if (v > nej) { nej = v; t = i + 1; }
    }
    return t;
  };
  V.prahuj = function (g, t, invert) {
    const m = new Uint8Array(g.length);
    for (let i = 0; i < g.length; i++) m[i] = ((g[i] < t) !== !!invert) ? 1 : 0;
    return m;
  };

  /* ================= komponenty a skvrny ================= */

  // označí souvislé oblasti hodnoty `hodnota`; vrací {lab (Int32, -1 = jiné), velikost[], okraj[]}
  V.komponenty = function (m, w, h, hodnota, osmi) {
    const lab = new Int32Array(w * h).fill(-1), velikost = [], okraj = [];
    const fronta = new Int32Array(w * h);
    for (let s = 0; s < w * h; s++) {
      if (m[s] !== hodnota || lab[s] >= 0) continue;
      const id = velikost.length; let hl = 0, kon = 0, pocet = 0, okr = false;
      lab[s] = id; fronta[kon++] = s;
      while (hl < kon) {
        const p = fronta[hl++], x = p % w, y = (p - x) / w; pocet++;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) okr = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (!osmi && dx && dy) continue;
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const q = Y * w + X;
          if (m[q] === hodnota && lab[q] < 0) { lab[q] = id; fronta[kon++] = q; }
        }
      }
      velikost.push(pocet); okraj.push(okr);
    }
    return { lab, velikost, okraj };
  };

  // odstraní skvrny inkoustu menší než min a zaplní stejně malé díry (ne ty u okraje)
  V.odstranSkvrny = function (m, w, h, min, osmi) {
    if (!(min > 1)) return m;
    const out = new Uint8Array(m);
    const ink = V.komponenty(out, w, h, 1, osmi !== false);
    for (let i = 0; i < out.length; i++) if (out[i] && ink.velikost[ink.lab[i]] < min) out[i] = 0;
    const pozadi = V.komponenty(out, w, h, 0, osmi === false);
    for (let i = 0; i < out.length; i++) {
      const l = pozadi.lab[i];
      if (!out[i] && pozadi.velikost[l] < min && !pozadi.okraj[l]) out[i] = 1;
    }
    return out;
  };

  // mapa štítků barev (255 = průhledné): malé oblasti se sloučí s nejčastějším sousedem
  V.sloucMaleOblasti = function (L, w, h, min) {
    if (!(min > 1)) return L;
    const out = new Uint8Array(L);
    for (let kolo = 0; kolo < 3; kolo++) {
      let zmena = false;
      const lab = new Int32Array(w * h).fill(-1), fronta = new Int32Array(w * h), clen = new Int32Array(w * h);
      for (let s = 0; s < w * h; s++) {
        if (lab[s] >= 0 || out[s] === 255) continue;
        const c = out[s]; let hl = 0, kon = 0;
        lab[s] = s; fronta[kon++] = s;
        while (hl < kon) {
          const p = fronta[hl++], x = p % w;
          const sous = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
          for (const q of sous) if (q >= 0 && q < w * h && out[q] === c && lab[q] < 0) { lab[q] = s; fronta[kon++] = q; }
        }
        if (kon >= min) continue;
        const hlasy = new Map();
        for (let i = 0; i < kon; i++) {
          const p = fronta[i], x = p % w; clen[i] = p;
          const sous = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
          for (const q of sous) if (q >= 0 && q < w * h && out[q] !== c && out[q] !== 255) hlasy.set(out[q], (hlasy.get(out[q]) || 0) + 1);
        }
        let nej = -1, nejN = 0;
        hlasy.forEach((n, k) => { if (n > nejN) { nejN = n; nej = k; } });
        if (nej >= 0) { for (let i = 0; i < kon; i++) out[fronta[i]] = nej; zmena = true; }
      }
      if (!zmena) break;
    }
    return out;
  };

  /* ================= kvantizace barev ================= */

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // vzorek neprůhledných pixelů (rovnoměrný krok)
  function vzorek(rgba, max) {
    const n = rgba.length / 4, krok = Math.max(1, Math.floor(n / max)), v = [];
    for (let i = 0; i < n; i += krok) if (rgba[i * 4 + 3] >= 128) v.push(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    return v;
  }
  function d2(a, i, b, j) { const r = a[i] - b[j], g = a[i + 1] - b[j + 1], c = a[i + 2] - b[j + 2]; return r * r + g * g + c * c; }

  V.kmeans = function (rgba, k, seed) {
    const v = vzorek(rgba, 40000), n = v.length / 3;
    if (!n) return [[255, 255, 255]];
    k = Math.max(1, Math.min(k, n));
    const rnd = mulberry32(seed || 1), C = [];
    // k-means++ výběr středů
    let i0 = Math.floor(rnd() * n); C.push(v[i0 * 3], v[i0 * 3 + 1], v[i0 * 3 + 2]);
    const dist = new Float64Array(n).fill(Infinity);
    while (C.length / 3 < k) {
      const c = C.length - 3; let suma = 0;
      for (let i = 0; i < n; i++) { const d = d2(v, i * 3, C, c); if (d < dist[i]) dist[i] = d; suma += dist[i]; }
      if (!suma) break;
      let r = rnd() * suma, vyb = n - 1;
      for (let i = 0; i < n; i++) { r -= dist[i]; if (r <= 0) { vyb = i; break; } }
      C.push(v[vyb * 3], v[vyb * 3 + 1], v[vyb * 3 + 2]);
    }
    const K = C.length / 3, prir = new Int32Array(n);
    for (let it = 0; it < 20; it++) {
      const s = new Float64Array(K * 4); let zm = 0;
      for (let i = 0; i < n; i++) {
        let nej = 0, nd = Infinity;
        for (let c = 0; c < K; c++) { const d = d2(v, i * 3, C, c * 3); if (d < nd) { nd = d; nej = c; } }
        if (prir[i] !== nej) zm++;
        prir[i] = nej; s[nej * 4] += v[i * 3]; s[nej * 4 + 1] += v[i * 3 + 1]; s[nej * 4 + 2] += v[i * 3 + 2]; s[nej * 4 + 3]++;
      }
      for (let c = 0; c < K; c++) if (s[c * 4 + 3]) { C[c * 3] = s[c * 4] / s[c * 4 + 3]; C[c * 3 + 1] = s[c * 4 + 1] / s[c * 4 + 3]; C[c * 3 + 2] = s[c * 4 + 2] / s[c * 4 + 3]; }
      if (it > 0 && zm < n * 0.001) break;
    }
    const pal = [];
    for (let c = 0; c < K; c++) pal.push([Math.round(C[c * 3]), Math.round(C[c * 3 + 1]), Math.round(C[c * 3 + 2])]);
    return pal;
  };

  V.medianCut = function (rgba, k) {
    const v = vzorek(rgba, 60000), n = v.length / 3;
    if (!n) return [[255, 255, 255]];
    let krabice = [Array.from({ length: n }, (_, i) => i)];
    const rozsah = b => {
      const mn = [255, 255, 255], mx = [0, 0, 0];
      for (const i of b) for (let c = 0; c < 3; c++) { const x = v[i * 3 + c]; if (x < mn[c]) mn[c] = x; if (x > mx[c]) mx[c] = x; }
      const r = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], osa = r.indexOf(Math.max(...r));
      return { osa, r: r[osa] };
    };
    while (krabice.length < k) {
      let nej = -1, nejR = 0, nejOsa = 0;
      krabice.forEach((b, i) => { if (b.length < 2) return; const r = rozsah(b); const sk = r.r * Math.sqrt(b.length); if (sk > nejR) { nejR = sk; nej = i; nejOsa = r.osa; } });
      if (nej < 0 || nejR === 0) break;
      const b = krabice[nej].sort((a, c) => v[a * 3 + nejOsa] - v[c * 3 + nejOsa]);
      // medián posunout na nejbližší změnu hodnoty (jinak by se dělila jedna barva na dvě)
      const hod = i => v[b[i] * 3 + nejOsa];
      let pul = b.length >> 1, lo = pul, hi = pul;
      while (lo > 0 && hod(lo - 1) === hod(lo)) lo--;
      while (hi < b.length && hod(hi - 1) === hod(hi)) hi++;
      pul = lo > 0 && (pul - lo <= hi - pul || hi >= b.length) ? lo : hi;
      krabice.splice(nej, 1, b.slice(0, pul), b.slice(pul));
    }
    return krabice.map(b => {
      const s = [0, 0, 0]; for (const i of b) for (let c = 0; c < 3; c++) s[c] += v[i * 3 + c];
      return s.map(x => Math.round(x / b.length));
    });
  };

  // přiřadí každému pixelu nejbližší barvu palety (255 = průhledný pixel)
  V.priradPalete = function (rgba, pal) {
    const n = rgba.length / 4, L = new Uint8Array(n), P = pal.flat(), K = pal.length, cache = new Map();
    for (let i = 0; i < n; i++) {
      if (rgba[i * 4 + 3] < 128) { L[i] = 255; continue; }
      const key = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
      let c = cache.get(key);
      if (c === undefined) {
        let nd = Infinity; c = 0;
        for (let j = 0; j < K; j++) { const d = d2(rgba, i * 4, P, j * 3); if (d < nd) { nd = d; c = j; } }
        if (cache.size < 200000) cache.set(key, c);
      }
      L[i] = c;
    }
    return L;
  };

  /* ================= trasování obrysů ================= */

  // směry 0 = +x, 1 = +y, 2 = −x, 3 = −y (osa y dolů); inkoust je vždy VPRAVO od směru chůze
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

  /* Vrací smyčky po hranách pixelů: { v:[x0,y0,x1,y1,…] (všechny mřížkové body),
     plocha (vnější > 0, díra < 0), bod:[x,y] (střed pixelu uvnitř oblasti, kterou smyčka ohraničuje),
     box:[minx,miny,maxx,maxy] }. osmi = inkoust spojený i přes roh (díry pak 4-souvislé). */
  V.obrysy = function (m, w, h, osmi) {
    osmi = osmi !== false;
    const W = w + 1, bity = new Uint8Array(W * (h + 1));
    const ink = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (m[y * w + x] !== 1) continue;
      if (!ink(x, y - 1)) bity[y * W + x] |= 1;
      if (!ink(x + 1, y)) bity[y * W + x + 1] |= 2;
      if (!ink(x, y + 1)) bity[(y + 1) * W + x + 1] |= 4;
      if (!ink(x - 1, y)) bity[(y + 1) * W + x] |= 8;
    }
    const smycky = [];
    for (let s = 0; s < bity.length; s++) {
      while (bity[s]) {
        const d0 = bity[s] & 1 ? 0 : bity[s] & 2 ? 1 : bity[s] & 4 ? 2 : 3;
        bity[s] &= ~(1 << d0);
        let x = s % W, y = (s - x) / W, d = d0;
        const v = [x, y];
        let minx = x, miny = y, maxx = x, maxy = y, A = 0;
        for (;;) {
          const nx = x + DX[d], ny = y + DY[d];
          A += x * ny - nx * y;
          x = nx; y = ny;
          const vi = y * W + x;
          let b = bity[vi]; if (vi === s) b |= 1 << d0;
          let nd;
          if ((b & (b - 1)) === 0) nd = b === 1 ? 0 : b === 2 ? 1 : b === 4 ? 2 : 3;
          else nd = osmi ? (d + 3) & 3 : (d + 1) & 3;   // křižovatka: vlevo = spojit přes roh
          if (vi === s && nd === d0) break;
          bity[vi] &= ~(1 << nd);
          v.push(x, y);
          if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
          d = nd;
        }
        const plocha = A / 2;
        // bod uvnitř: střed pixelu vpravo (vnější) / vlevo (díra) od první hrany
        const strana = plocha > 0 ? (d0 + 1) & 3 : (d0 + 3) & 3;
        const bod = [v[0] + DX[d0] / 2 + DX[strana] / 2, v[1] + DY[d0] / 2 + DY[strana] / 2];
        smycky.push({ v, plocha, bod, box: [minx, miny, maxx, maxy] });
      }
    }
    return smycky;
  };

  // paprsek doprava; bod nikdy neleží na mřížce (střed pixelu)
  V.uvnitrMrizky = function (v, px, py) {
    let uv = false; const n = v.length;
    for (let i = 0; i < n; i += 2) {
      const x1 = v[i], y1 = v[i + 1], j = (i + 2) % n, x2 = v[j], y2 = v[j + 1];
      if (x1 !== x2) continue;
      if ((y1 > py) !== (y2 > py) && x1 > px) uv = !uv;
    }
    return uv;
  };

  // rodič každé smyčky = nejmenší smyčka opačného znaménka, která ji obsahuje (−1 = kořen)
  V.vnoreni = function (smycky) {
    const poradi = smycky.map((_, i) => i).sort((a, b) => Math.abs(smycky[a].plocha) - Math.abs(smycky[b].plocha));
    return smycky.map(s => {
      const [px, py] = s.bod, zn = s.plocha > 0;
      for (const j of poradi) {
        const t = smycky[j];
        if ((t.plocha > 0) === zn || Math.abs(t.plocha) <= Math.abs(s.plocha)) continue;
        const b = t.box;
        if (px < b[0] || px > b[2] || py < b[1] || py > b[3]) continue;
        if (V.uvnitrMrizky(t.v, px, py)) return j;
      }
      return -1;
    });
  };

  /* ================= vyhlazení: rohy, DP, Bézier ================= */

  // středy jednotkových hran → husté body bez schodů
  function stredy(v) {
    const n = v.length / 2, p = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      p[i * 2] = (v[i * 2] + v[j * 2]) / 2; p[i * 2 + 1] = (v[i * 2 + 1] + v[j * 2 + 1]) / 2;
    }
    return p;
  }

  // průsečík přímek a + t·u a b + s·w
  function prusecik(ax, ay, ux, uy, bx, by, wx, wy) {
    const det = ux * wy - uy * wx;
    if (Math.abs(det) < 1e-9) return null;
    const t = ((bx - ax) * wy - (by - ay) * wx) / det;
    return [ax + t * ux, ay + t * uy];
  }

  /* rohy: k-kosinová míra – úhel mezi body i−k, i, i+k; roh = odbočení nad práh,
     lokální maximum. Vrací [{i, x, y}] s upřesněnou polohou (průsečík sousedních stran). */
  V.najdiRohy = function (p, prahStupne, kMax) {
    const n = p.length / 2;
    const k = Math.max(1, Math.min(kMax || 4, Math.floor((n - 1) / 4)));
    if (n < 8) return [];
    const ot = new Float64Array(n), prah = prahStupne * Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const a = ((i - k) % n + n) % n, b = (i + k) % n;
      const ax = p[a * 2] - p[i * 2], ay = p[a * 2 + 1] - p[i * 2 + 1], bx = p[b * 2] - p[i * 2], by = p[b * 2 + 1] - p[i * 2 + 1];
      const c = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1);
      ot[i] = Math.PI - Math.acos(Math.max(-1, Math.min(1, c)));
    }
    const rohy = [];
    for (let i = 0; i < n; i++) {
      if (ot[i] < prah) continue;
      let max = true;
      for (let j = 1; j <= k && max; j++) {
        const a = ot[((i - j) % n + n) % n], b = ot[(i + j) % n];
        if (a > ot[i] || b > ot[i] || a === ot[i]) max = false;
      }
      if (!max) continue;
      // upřesnění: průsečík přímek strany před a za rohem
      const a1 = ((i - k) % n + n) % n, a2 = ((i - 1) % n + n) % n, b1 = (i + 1) % n, b2 = (i + k) % n;
      let x = p[i * 2], y = p[i * 2 + 1];
      if (k >= 2) {
        const q = prusecik(p[a1 * 2], p[a1 * 2 + 1], p[a2 * 2] - p[a1 * 2], p[a2 * 2 + 1] - p[a1 * 2 + 1],
          p[b2 * 2], p[b2 * 2 + 1], p[b1 * 2] - p[b2 * 2], p[b1 * 2 + 1] - p[b2 * 2 + 1]);
        if (q && Math.hypot(q[0] - x, q[1] - y) < 1.5) { x = q[0]; y = q[1]; }
      }
      rohy.push({ i, x, y });
    }
    // rohy těsně u sebe (méně než k) → nechat silnější
    for (let j = rohy.length - 1; j > 0; j--) if (rohy[j].i - rohy[j - 1].i < k) rohy.splice(ot[rohy[j].i] > ot[rohy[j - 1].i] ? j - 1 : j, 1);
    if (rohy.length > 1 && rohy[0].i + n - rohy[rohy.length - 1].i < k) rohy.pop();
    return rohy;
  };

  // Douglas–Peucker nad polem bodů [x,y,…] (otevřená lomená čára), vrací indexy ponechaných bodů
  V.douglasPeucker = function (p, eps) {
    const n = p.length / 2, drz = new Uint8Array(n);
    drz[0] = drz[n - 1] = 1;
    const zas = [[0, n - 1]];
    while (zas.length) {
      const [a, b] = zas.pop();
      const ax = p[a * 2], ay = p[a * 2 + 1], dx = p[b * 2] - ax, dy = p[b * 2 + 1] - ay, L = Math.hypot(dx, dy);
      let nej = -1, nd = eps;
      for (let i = a + 1; i < b; i++) {
        const ex = p[i * 2] - ax, ey = p[i * 2 + 1] - ay;
        const d = L > 1e-12 ? Math.abs(ex * dy - ey * dx) / L : Math.hypot(ex, ey);
        if (d > nd) { nd = d; nej = i; }
      }
      if (nej >= 0) { drz[nej] = 1; zas.push([a, nej], [nej, b]); }
    }
    const out = [];
    for (let i = 0; i < n; i++) if (drz[i]) out.push(i);
    return out;
  };

  /* ---- Schneider: proložení kubikami ---- */
  function bez(b, t) {
    const u = 1 - t, a = u * u * u, c = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
    return [a * b[0] + c * b[2] + d * b[4] + e * b[6], a * b[1] + c * b[3] + d * b[5] + e * b[7]];
  }
  function normuj(x, y) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }

  function generujBezier(P, i0, i1, u, t1, t2) {
    const x0 = P[i0 * 2], y0 = P[i0 * 2 + 1], x3 = P[i1 * 2], y3 = P[i1 * 2 + 1];
    let c00 = 0, c01 = 0, c11 = 0, X0 = 0, X1 = 0;
    for (let i = i0; i <= i1; i++) {
      const t = u[i - i0], s = 1 - t, b0 = s * s * s, b1 = 3 * s * s * t, b2 = 3 * s * t * t, b3 = t * t * t;
      const a0x = t1[0] * b1, a0y = t1[1] * b1, a1x = t2[0] * b2, a1y = t2[1] * b2;
      c00 += a0x * a0x + a0y * a0y; c01 += a0x * a1x + a0y * a1y; c11 += a1x * a1x + a1y * a1y;
      const tx = P[i * 2] - (x0 * (b0 + b1) + x3 * (b2 + b3)), ty = P[i * 2 + 1] - (y0 * (b0 + b1) + y3 * (b2 + b3));
      X0 += a0x * tx + a0y * ty; X1 += a1x * tx + a1y * ty;
    }
    const det = c00 * c11 - c01 * c01, delka = Math.hypot(x3 - x0, y3 - y0);
    let al = det ? (X0 * c11 - X1 * c01) / det : 0, ar = det ? (c00 * X1 - c01 * X0) / det : 0;
    const eps = 1e-6 * delka;
    if (!det || al < eps || ar < eps || al > delka * 3 || ar > delka * 3) al = ar = delka / 3;
    return [x0, y0, x0 + t1[0] * al, y0 + t1[1] * al, x3 + t2[0] * ar, y3 + t2[1] * ar, x3, y3];
  }
  function newton(b, x, y, t) {
    const q = bez(b, t);
    const s = 1 - t;
    const q1 = [3 * (s * s * (b[2] - b[0]) + 2 * s * t * (b[4] - b[2]) + t * t * (b[6] - b[4])),
      3 * (s * s * (b[3] - b[1]) + 2 * s * t * (b[5] - b[3]) + t * t * (b[7] - b[5]))];
    const q2 = [6 * (s * (b[4] - 2 * b[2] + b[0]) + t * (b[6] - 2 * b[4] + b[2])),
      6 * (s * (b[5] - 2 * b[3] + b[1]) + t * (b[7] - 2 * b[5] + b[3]))];
    const cit = (q[0] - x) * q1[0] + (q[1] - y) * q1[1];
    const jm = q1[0] * q1[0] + q1[1] * q1[1] + (q[0] - x) * q2[0] + (q[1] - y) * q2[1];
    if (!jm) return t;
    return Math.max(0, Math.min(1, t - cit / jm));
  }
  function maxChyba(P, i0, i1, b, u) {
    let max = 0, kde = (i0 + i1) >> 1;
    for (let i = i0 + 1; i < i1; i++) {
      const q = bez(b, u[i - i0]), d = (q[0] - P[i * 2]) ** 2 + (q[1] - P[i * 2 + 1]) ** 2;
      if (d >= max) { max = d; kde = i; }
    }
    return [max, kde];
  }
  function tecnaStred(P, i0, i1, i, m) {
    const a = Math.max(i0, i - m), b = Math.min(i1, i + m);
    return normuj(P[a * 2] - P[b * 2], P[a * 2 + 1] - P[b * 2 + 1]);   // míří dozadu
  }
  // plocha mezi kubikou a její tětivou (vzorkováním)
  function plochaKubiky(b) {
    let A = 0, px = b[0], py = b[1];
    for (let i = 1; i <= 24; i++) { const q = bez(b, i / 24); A += px * q[1] - q[0] * py; px = q[0]; py = q[1]; }
    return (A + px * b[1] - b[0] * py) / 2;
  }
  /* Přijatá kubika se doladí délkou obou táhel (stejný poměr), aby plocha pod ní odpovídala
     datům – jinak má proložení s pevnými tečnami sklon „vtahovat“ tvar dovnitř. */
  function dorovnejPlochu(P, i0, i1, b, u, chyba) {
    let cil = 0;
    for (let i = i0; i < i1; i++) cil += P[i * 2] * P[i * 2 + 3] - P[i * 2 + 2] * P[i * 2 + 1];
    cil = (cil + P[i1 * 2] * P[i0 * 2 + 1] - P[i0 * 2] * P[i1 * 2 + 1]) / 2;
    const s = f => [b[0], b[1], b[0] + (b[2] - b[0]) * f, b[1] + (b[3] - b[1]) * f, b[6] + (b[4] - b[6]) * f, b[7] + (b[5] - b[7]) * f, b[6], b[7]];
    let f0 = 1, a0 = plochaKubiky(b) - cil, f1 = 1.1, a1 = plochaKubiky(s(f1)) - cil;
    for (let it = 0; it < 4 && Math.abs(a1) > 1e-6 && Math.abs(a1 - a0) > 1e-12; it++) {
      const f2 = Math.max(0.6, Math.min(1.6, f1 - a1 * (f1 - f0) / (a1 - a0)));
      f0 = f1; a0 = a1; f1 = f2; a1 = plochaKubiky(s(f1)) - cil;
    }
    const nb = s(f1);
    return maxChyba(P, i0, i1, nb, u)[0] < chyba * chyba * 2.25 ? nb : b;
  }
  function prolozKubikou(P, i0, i1, t1, t2, chyba, out, hloubka) {
    const n = i1 - i0 + 1;
    if (n <= 2) {
      const x0 = P[i0 * 2], y0 = P[i0 * 2 + 1], x3 = P[i1 * 2], y3 = P[i1 * 2 + 1], d = Math.hypot(x3 - x0, y3 - y0) / 3;
      out.push([x0, y0, x0 + t1[0] * d, y0 + t1[1] * d, x3 + t2[0] * d, y3 + t2[1] * d, x3, y3]);
      return;
    }
    let u = new Float64Array(n); u[0] = 0;
    for (let i = 1; i < n; i++) u[i] = u[i - 1] + Math.hypot(P[(i0 + i) * 2] - P[(i0 + i - 1) * 2], P[(i0 + i) * 2 + 1] - P[(i0 + i - 1) * 2 + 1]);
    const L = u[n - 1] || 1; for (let i = 0; i < n; i++) u[i] /= L;
    let b = generujBezier(P, i0, i1, u, t1, t2), [ch, kde] = maxChyba(P, i0, i1, b, u);
    const e2 = chyba * chyba;
    if (ch < e2) { out.push(dorovnejPlochu(P, i0, i1, b, u, chyba)); return; }
    if (ch < e2 * 9) {
      for (let it = 0; it < 6; it++) {
        const u2 = new Float64Array(n);
        for (let i = 0; i < n; i++) u2[i] = newton(b, P[(i0 + i) * 2], P[(i0 + i) * 2 + 1], u[i]);
        u = u2; b = generujBezier(P, i0, i1, u, t1, t2); [ch, kde] = maxChyba(P, i0, i1, b, u);
        if (ch < e2) { out.push(dorovnejPlochu(P, i0, i1, b, u, chyba)); return; }
      }
    }
    if (hloubka > 40 || n < 4) { out.push(b); return; }
    kde = Math.max(i0 + 1, Math.min(i1 - 1, kde));
    const tc = tecnaStred(P, i0, i1, kde, 2);
    prolozKubikou(P, i0, kde, t1, tc, chyba, out, hloubka + 1);
    prolozKubikou(P, kde, i1, [-tc[0], -tc[1]], t2, chyba, out, hloubka + 1);
  }
  // tečna na začátku (směr dopředu) z prvních m bodů
  function tecnaZacatek(P, i0, i1, m) { const j = Math.min(i1, i0 + m); return normuj(P[j * 2] - P[i0 * 2], P[j * 2 + 1] - P[i0 * 2 + 1]); }
  function tecnaKonec(P, i0, i1, m) { const j = Math.max(i0, i1 - m); return normuj(P[j * 2] - P[i1 * 2], P[j * 2 + 1] - P[i1 * 2 + 1]); }

  // kubika téměř přímá → úsečka
  function jeRovna(b, tol) {
    const dx = b[6] - b[0], dy = b[7] - b[1], L = Math.hypot(dx, dy);
    if (L < 1e-9) return Math.hypot(b[2] - b[0], b[3] - b[1]) < tol && Math.hypot(b[4] - b[0], b[5] - b[1]) < tol;
    const d1 = Math.abs((b[2] - b[0]) * dy - (b[3] - b[1]) * dx) / L, d2_ = Math.abs((b[4] - b[0]) * dy - (b[5] - b[1]) * dx) / L;
    const t1 = ((b[2] - b[0]) * dx + (b[3] - b[1]) * dy) / (L * L), t2 = ((b[4] - b[0]) * dx + (b[5] - b[1]) * dy) / (L * L);
    return d1 < tol && d2_ < tol && t1 > -0.05 && t1 < 1.05 && t2 > -0.05 && t2 < 1.05;
  }

  /* úsek hustých bodů P[i0..i1] (otevřený) → seznam úseků smyčky; t1/t2 = tečny konců (null = odhad) */
  function prolozUsek(P, i0, i1, volby, t1, t2) {
    const s = [];
    if (!volby.krivky) {
      const sub = P.subarray(i0 * 2, i1 * 2 + 2), idx = V.douglasPeucker(sub, volby.tolerance);
      for (let j = 1; j < idx.length; j++) s.push(['L', sub[idx[j] * 2], sub[idx[j] * 2 + 1]]);
      return s;
    }
    const out = [];
    prolozKubikou(P, i0, i1, t1 || tecnaZacatek(P, i0, i1, 3), t2 || tecnaKonec(P, i0, i1, 3), volby.tolerance, out, 0);
    const tolR = Math.min(0.12, volby.tolerance * 0.25);
    for (const b of out) s.push(jeRovna(b, tolR) ? ['L', b[6], b[7]] : ['C', b[2], b[3], b[4], b[5], b[6], b[7]]);
    return s;
  }

  // sloučí po sobě jdoucí kolineární úsečky (rovné strany jedním uzlem)
  function sloucUsecky(p0, s, r) {
    let px = p0[0], py = p0[1];
    const os = [], or = [];
    for (let i = 0; i < s.length; i++) {
      const u = s[i];
      if (u[0] === 'L' && os.length && os[os.length - 1][0] === 'L' && !or[or.length - 1]) {
        const pr = os[os.length - 1], ax = pr[1] - px, ay = pr[2] - py;   // px,py = začátek předchozí
        const bx = u[1] - pr[1], by = u[2] - pr[2];
        const kr = Math.abs(ax * by - ay * bx) / ((Math.hypot(ax, ay) * Math.hypot(bx, by)) || 1);
        if (kr < 0.02 && ax * bx + ay * by > 0) { os[os.length - 1] = u; or[or.length - 1] = r[i]; continue; }
      }
      if (os.length) { const pr = os[os.length - 1]; px = pr[pr.length - 2]; py = pr[pr.length - 1]; }
      os.push(u); or.push(r[i]);
    }
    return { s: os, r: or };
  }

  /* ---- vyhlazení přes polygon ----
     1) úsek mezi rohy se pokryje co nejdelšími hranami, od nichž žádný bod neodchýlí víc než eps
        (digitální přímky – schody pixelů zmizí),
     2) každou hranu nahradí přímka proložená jejími body (PCA), vrcholy = průsečíky sousedních přímek,
     3) v hladkých vrcholech kvadratická křivka ze středu hrany do středu další hrany s řídicím bodem
        ve vrcholu (spojitá tečna), u rohů úsečky,
     4) hustě navzorkovaná křivka se zhustí Schneiderovým proložením kubikami s danou tolerancí. */
  function polygonizuj(P, i0, i1, eps) {
    const idx = [i0];
    let a = i0;
    while (a < i1) {
      let b = a + 1;
      while (b < i1) {
        const c = b + 1, ax = P[a * 2], ay = P[a * 2 + 1], dx = P[c * 2] - ax, dy = P[c * 2 + 1] - ay, L = Math.hypot(dx, dy);
        let ok = L > 1e-9;
        for (let i = a + 1; i < c && ok; i++) {
          const ex = P[i * 2] - ax, ey = P[i * 2 + 1] - ay;
          if (Math.abs(ex * dy - ey * dx) / L > eps) ok = false;
          else { const t = (ex * dx + ey * dy) / (L * L); if (t < -0.01 || t > 1.01) ok = false; }   // bez zpětných kroků
        }
        if (!ok) break;
        b = c;
      }
      idx.push(b); a = b;
    }
    return idx;
  }
  // přímka body P[a..b] (těžiště + hlavní směr)
  function primka(P, a, b) {
    const n = b - a + 1;
    let cx = 0, cy = 0;
    for (let i = a; i <= b; i++) { cx += P[i * 2]; cy += P[i * 2 + 1]; }
    cx /= n; cy /= n;
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = a; i <= b; i++) { const x = P[i * 2] - cx, y = P[i * 2 + 1] - cy; sxx += x * x; sxy += x * y; syy += y * y; }
    let dx, dy;
    if (n < 3 || sxx + syy < 1e-9) { dx = P[b * 2] - P[a * 2]; dy = P[b * 2 + 1] - P[a * 2 + 1]; }
    else { const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); dx = Math.cos(th); dy = Math.sin(th); }
    const l = Math.hypot(dx, dy) || 1;
    return { cx, cy, dx: dx / l, dy: dy / l };
  }
  /* vrcholy polygonu úseku: pole [x,y,…]; pevne0/pevne1 = krajní body se nehýbou (rohy) */
  function vrcholyPolygonu(P, idx, pevne0, pevne1, cyklus) {
    const m = idx.length - 1, L = [];
    for (let k = 0; k < m; k++) L.push(primka(P, idx[k], idx[k + 1]));
    const V_ = [];
    for (let k = 0; k <= m; k++) {
      let x = P[idx[k] * 2], y = P[idx[k] * 2 + 1];
      const pevny = (k === 0 && pevne0) || (k === m && pevne1);
      let A = null, B = null;
      if (!pevny) {
        if (k > 0 && k < m) { A = L[k - 1]; B = L[k]; }
        else if (cyklus) { A = L[m - 1]; B = L[0]; }
      }
      if (A && B) {
        const q = prusecik(A.cx, A.cy, A.dx, A.dy, B.cx, B.cy, B.dx, B.dy);
        if (q && Math.hypot(q[0] - x, q[1] - y) < 1.0) { x = q[0]; y = q[1]; }
        else {   // téměř rovnoběžné: průmět na průměr obou přímek
          const px = (A.cx + B.cx) / 2, py = (A.cy + B.cy) / 2, dx = A.dx + B.dx, dy = A.dy + B.dy, l = Math.hypot(dx, dy) || 1;
          const t = ((x - px) * dx + (y - py) * dy) / (l * l);
          const nx = px + t * dx, ny = py + t * dy;
          if (Math.hypot(nx - x, ny - y) < 1.0) { x = nx; y = ny; }
        }
      }
      V_.push(x, y);
    }
    return Float64Array.from(V_);
  }
  /* vzorkuje křivku z polygonu W ([x,y,…], m+1 vrcholů). Otevřený úsek: začne ve W0, skončí ve Wm,
     u konců rovné půlhrany. Cyklus: hladké všechny vrcholy, začne středem hrany 0. Vrací {B, t1, t2}. */
  function krivkaZPolygonu(W, cyklus) {
    const m = W.length / 2 - 1, B = [];
    const pridej = (x, y) => { const n = B.length; if (n && Math.abs(B[n - 2] - x) < 1e-9 && Math.abs(B[n - 1] - y) < 1e-9) return; B.push(x, y); };
    const usecka = (x0, y0, x1, y1) => { const k = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.7)); for (let i = 1; i <= k; i++) pridej(x0 + (x1 - x0) * i / k, y0 + (y1 - y0) * i / k); };
    const kvadr = (x0, y0, cx, cy, x1, y1) => {
      const k = Math.max(2, Math.ceil((Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy)) / 0.7));
      for (let i = 1; i <= k; i++) { const t = i / k, u = 1 - t; pridej(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1); }
    };
    const mid = k => [(W[k * 2] + W[k * 2 + 2]) / 2, (W[k * 2 + 1] + W[k * 2 + 3]) / 2];
    if (!cyklus) {
      pridej(W[0], W[1]);
      if (m === 1) { usecka(W[0], W[1], W[2], W[3]); }
      else {
        let [px, py] = mid(0); usecka(W[0], W[1], px, py);
        for (let k = 1; k < m; k++) { const [qx, qy] = mid(k); kvadr(px, py, W[k * 2], W[k * 2 + 1], qx, qy); px = qx; py = qy; }
        usecka(px, py, W[m * 2], W[m * 2 + 1]);
      }
      return { B: Float64Array.from(B), t1: normuj(W[2] - W[0], W[3] - W[1]), t2: normuj(W[(m - 1) * 2] - W[m * 2], W[(m - 1) * 2 + 1] - W[m * 2 + 1]) };
    }
    // cyklus: W[m] == W[0]
    let [px, py] = mid(0); pridej(px, py);
    for (let k = 1; k <= m; k++) {
      const kk = k % m, [qx, qy] = mid(kk);
      kvadr(px, py, W[kk * 2], W[kk * 2 + 1], qx, qy); px = qx; py = qy;
    }
    return { B: Float64Array.from(B) };
  }
  V._polygon = { polygonizuj, vrcholyPolygonu, krivkaZPolygonu };

  /* Korekce plochy: vyhlazená křivka B (body) se posune po normále tak, aby plocha pod ní
     (uzavřená tětivou mezi konci) byla stejná jako u mřížkového obrysu raw. Otevřený úsek má
     posun u konců (rohů) plynule utlumený na nulu. Upravuje B na místě. */
  function shoelace(p) { let A = 0; const n = p.length; for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; A += p[i] * p[j + 1] - p[j] * p[i + 1]; } return A / 2; }
  function korekcePlochy(B, raw, cyklus) {
    const n = B.length / 2;
    if (n < 3) return;
    const N = new Float64Array(n * 2), w = new Float64Array(n);
    let L = 0; const s = new Float64Array(n);
    for (let i = 1; i < n; i++) { L += Math.hypot(B[i * 2] - B[i * 2 - 2], B[i * 2 + 1] - B[i * 2 - 1]); s[i] = L; }
    for (let i = 0; i < n; i++) {
      const a = cyklus ? (i - 1 + n) % n : Math.max(0, i - 1), b = cyklus ? (i + 1) % n : Math.min(n - 1, i + 1);
      const tx = B[b * 2] - B[a * 2], ty = B[b * 2 + 1] - B[a * 2 + 1], l = Math.hypot(tx, ty) || 1;
      N[i * 2] = ty / l; N[i * 2 + 1] = -tx / l;
      w[i] = cyklus ? 1 : Math.max(0, Math.min(1, s[i] / 3, (L - s[i]) / 3));
    }
    const A0 = shoelace(B), cil = shoelace(raw);
    const T = new Float64Array(B.length), del = 0.05;
    for (let i = 0; i < n * 2; i++) T[i] = B[i] + del * w[i >> 1] * N[i];
    const k = (shoelace(T) - A0) / del;
    if (Math.abs(k) < 1e-6) return;
    const d = Math.max(-0.75, Math.min(0.75, (cil - A0) / k));
    for (let i = 0; i < n * 2; i++) B[i] += d * w[i >> 1] * N[i];
  }

  /* vyhladí jednu mřížkovou smyčku → { p0, s:[úseky], r:[rohy] } */
  V.vyhladSmycku = function (v, volby) {
    const P = stredy(v), n = P.length / 2;
    const eps = Math.max(0.55, Math.min(1.5, 0.6 + 0.3 * volby.tolerance));
    const rohy = volby.uhel >= 180 ? [] : V.najdiRohy(P, volby.uhel, 5);
    const Q = new Float64Array(n * 4 + 2); Q.set(P); Q.set(P, n * 2); Q[n * 4] = P[0]; Q[n * 4 + 1] = P[1];
    let s = [], r = [], p0;
    const hlad = !volby.krivky ? null : volby;
    if (n < 6) {   // drobnost: polygon ze středů
      p0 = [P[0], P[1]];
      for (let i = 1; i <= n; i++) { s.push(['L', Q[i * 2], Q[i * 2 + 1]]); r.push(true); }
      return { p0, s, r };
    }
    if (!rohy.length) {
      const idx = polygonizuj(Q, 0, n, eps);
      if (idx.length < 4) { idx.length = 0; for (let k = 0; k <= 3; k++) idx.push(Math.round(k * n / 3)); }   // aspoň trojúhelník
      const W = vrcholyPolygonu(Q, idx, false, false, true);
      W[W.length - 2] = W[0]; W[W.length - 1] = W[1];
      if (!hlad) {
        // DP na uzavřeném polygonu: rozdělit ve vrcholu 0 a nejvzdálenějším vrcholu
        const m = W.length / 2 - 1; let dal = 1, dmax = -1;
        for (let k = 1; k < m; k++) { const d = Math.hypot(W[k * 2] - W[0], W[k * 2 + 1] - W[1]); if (d > dmax) { dmax = d; dal = k; } }
        const e = Math.max(0.3, volby.tolerance);
        const h1 = V.douglasPeucker(W.subarray(0, dal * 2 + 2), e), h2 = V.douglasPeucker(W.subarray(dal * 2), e).map(i => i + dal);
        const id = h1.concat(h2.slice(1, -1));
        const Wz = Float64Array.from(id.flatMap(i => [W[i * 2], W[i * 2 + 1]]));
        if (Wz.length >= 6) korekcePlochy(Wz, v, true);
        p0 = [Wz[0], Wz[1]];
        for (let k = 1; k <= Wz.length / 2; k++) { const q = k % (Wz.length / 2); s.push(['L', Wz[q * 2], Wz[q * 2 + 1]]); r.push(true); }
      } else {
        const { B } = krivkaZPolygonu(W, true), nb = B.length / 2;
        korekcePlochy(B, v, true);
        // čtyři části s plynulou tečnou v místech napojení (kružnici dvě kubiky nevystihnou)
        const C = new Float64Array(B.length + 2); C.set(B); C[B.length] = B[0]; C[B.length + 1] = B[1];
        const tecna = i => { const a = (i - 1 + nb) % nb, b = (i + 1) % nb; return normuj(B[b * 2] - B[a * 2], B[b * 2 + 1] - B[a * 2 + 1]); };
        const casti = nb >= 16 ? 4 : 2, del = [];
        for (let q = 0; q <= casti; q++) del.push(Math.round(q * nb / casti));
        p0 = [B[0], B[1]];
        for (let q = 0; q < casti; q++) {
          const ta = tecna(del[q] % nb), tb = tecna(del[q + 1] % nb);
          s = s.concat(prolozUsek(C, del[q], del[q + 1], volby, ta, [-tb[0], -tb[1]]));
        }
        r = s.map(() => false);
      }
    } else {
      p0 = [rohy[0].x, rohy[0].y];
      for (let j = 0; j < rohy.length; j++) {
        const A = rohy[j], Bc = rohy[(j + 1) % rohy.length];
        const i0 = A.i, i1 = Bc.i > A.i ? Bc.i : Bc.i + n;
        const zx0 = Q[i0 * 2], zy0 = Q[i0 * 2 + 1], zx1 = Q[i1 * 2], zy1 = Q[i1 * 2 + 1];
        Q[i0 * 2] = A.x; Q[i0 * 2 + 1] = A.y; Q[i1 * 2] = Bc.x; Q[i1 * 2 + 1] = Bc.y;
        const idx = polygonizuj(Q, i0, i1, eps);
        const W = vrcholyPolygonu(Q, idx, true, true, false);
        Q[i0 * 2] = zx0; Q[i0 * 2 + 1] = zy0; Q[i1 * 2] = zx1; Q[i1 * 2 + 1] = zy1;
        // mřížkový obrys úseku: roh A, vrcholy v[i0+1..i1], roh B
        const raw = [A.x, A.y];
        for (let i = i0 + 1; i <= i1; i++) { const q = i % n; raw.push(v[q * 2], v[q * 2 + 1]); }
        raw.push(Bc.x, Bc.y);
        let us;
        if (!hlad || W.length === 4) {
          let Wd = W;
          if (W.length > 4) { const id = V.douglasPeucker(W, Math.max(0.3, volby.tolerance)); Wd = Float64Array.from(id.flatMap(i => [W[i * 2], W[i * 2 + 1]])); }
          if (Wd.length > 4) korekcePlochy(Wd, raw, false);
          us = []; for (let k = 1; k < Wd.length / 2; k++) us.push(['L', Wd[k * 2], Wd[k * 2 + 1]]);
        } else {
          const { B, t1, t2 } = krivkaZPolygonu(W, false);
          korekcePlochy(B, raw, false);
          us = prolozUsek(B, 0, B.length / 2 - 1, volby, t1, t2);
        }
        for (let q = 0; q < us.length; q++) { s.push(us[q]); r.push(q === us.length - 1 || !hlad); }
      }
    }
    const sl = sloucUsecky(p0, s, r);
    return { p0, s: sl.s, r: sl.r };
  };

  /* ================= geometrie výsledku ================= */

  // zploštění smyčky na body [x,y,…]; tol = max. odchylka (adaptivní dělení kubik)
  V.zplosti = function (sm, tol) {
    tol = tol || 0.05;
    const out = [sm.p0[0], sm.p0[1]];
    let x = sm.p0[0], y = sm.p0[1];
    for (const u of sm.s) {
      if (u[0] === 'L') { out.push(u[1], u[2]); x = u[1]; y = u[2]; continue; }
      const b = [x, y, u[1], u[2], u[3], u[4], u[5], u[6]];
      (function del(b, h) {
        const dx = b[6] - b[0], dy = b[7] - b[1], L = Math.hypot(dx, dy) || 1e-9;
        const d1 = Math.abs((b[2] - b[0]) * dy - (b[3] - b[1]) * dx) / L, d2_ = Math.abs((b[4] - b[0]) * dy - (b[5] - b[1]) * dx) / L;
        if (h > 12 || Math.max(d1, d2_) * 0.75 <= tol) { out.push(b[6], b[7]); return; }
        const m = (a, c) => (a + c) / 2;
        const x01 = m(b[0], b[2]), y01 = m(b[1], b[3]), x12 = m(b[2], b[4]), y12 = m(b[3], b[5]), x23 = m(b[4], b[6]), y23 = m(b[5], b[7]);
        const xa = m(x01, x12), ya = m(y01, y12), xb = m(x12, x23), yb = m(y12, y23), xm = m(xa, xb), ym = m(ya, yb);
        del([b[0], b[1], x01, y01, xa, ya, xm, ym], h + 1); del([xm, ym, xb, yb, x23, y23, b[6], b[7]], h + 1);
      })(b, 0);
      x = u[5]; y = u[6];
    }
    return out;
  };
  V.plochaBodu = function (p) {
    let A = 0; const n = p.length;
    for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; A += p[i] * p[j + 1] - p[j] * p[i + 1]; }
    return A / 2;
  };
  V.plochaSmycky = function (sm) { return V.plochaBodu(V.zplosti(sm, 0.02)); };

  /* ================= středová čára ================= */

  // Zhang–Suen ztenčení (in place kopie)
  V.ztenci = function (m, w, h) {
    const a = new Uint8Array(m), smaz = [];
    const P = (x, y) => (x >= 0 && y >= 0 && x < w && y < h) ? a[y * w + x] : 0;
    let zmena = true;
    while (zmena) {
      zmena = false;
      for (let krok = 0; krok < 2; krok++) {
        smaz.length = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (!a[y * w + x]) continue;
          const p2 = P(x, y - 1), p3 = P(x + 1, y - 1), p4 = P(x + 1, y), p5 = P(x + 1, y + 1), p6 = P(x, y + 1), p7 = P(x - 1, y + 1), p8 = P(x - 1, y), p9 = P(x - 1, y - 1);
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const s = [p2, p3, p4, p5, p6, p7, p8, p9, p2]; let A = 0;
          for (let i = 0; i < 8; i++) if (!s[i] && s[i + 1]) A++;
          if (A !== 1) continue;
          if (krok === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
          smaz.push(y * w + x);
        }
        for (const i of smaz) a[i] = 0;
        if (smaz.length) zmena = true;
      }
    }
    return a;
  };

  // kostra → lomené čáry (středy pixelů); vrací [{p:[x,y,…], uzavrena}]
  V.kostraNaCary = function (a, w, h, minDelka) {
    const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const sous = i => {
      const x = i % w, y = (i - x) / w, o = [];
      const A = (X, Y) => X >= 0 && Y >= 0 && X < w && Y < h && a[Y * w + X];
      // m-sousedství: diagonálu jen když ji nespojuje společný přímý soused (bez trojúhelníků)
      for (const [dx, dy] of N8) {
        if (!A(x + dx, y + dy)) continue;
        if (dx && dy && (A(x + dx, y) || A(x, y + dy))) continue;
        o.push((y + dy) * w + x + dx);
      }
      return o;
    };
    const st = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (a[i]) st[i] = sous(i).length;
    const navst = new Set(), cary = [];
    const klic = (i, j) => i < j ? i * 4294967296 + j : j * 4294967296 + i;
    const jeUzel = i => st[i] !== 2;
    const bodXY = i => { const x = i % w; return [x + 0.5, (i - x) / w + 0.5]; };
    function jdi(z, d) {
      const cesta = [z, d]; navst.add(klic(z, d));
      let pred = z, cur = d;
      while (!jeUzel(cur)) {
        const dal = sous(cur).filter(q => q !== pred && !navst.has(klic(cur, q)));
        if (!dal.length) break;
        const q = dal[0]; navst.add(klic(cur, q)); pred = cur; cur = q; cesta.push(cur);
        if (cur === z) break;
      }
      return cesta;
    }
    for (let i = 0; i < w * h; i++) {
      if (!a[i] || !jeUzel(i)) continue;
      for (const q of sous(i)) if (!navst.has(klic(i, q))) {
        const c = jdi(i, q);
        const konec = c[c.length - 1], volnyKonec = st[i] === 1 || st[konec] === 1;
        if (volnyKonec && c.length < minDelka && !(st[i] === 1 && st[konec] === 1 && c.length >= 3)) continue;   // výběžek
        cary.push({ idx: c, uzavrena: false });
      }
    }
    // čisté kružnice (všechny body stupně 2)
    for (let i = 0; i < w * h; i++) {
      if (!a[i] || st[i] !== 2) continue;
      const s = sous(i).filter(q => !navst.has(klic(i, q)));
      if (s.length < 2) continue;
      const c = jdi(i, s[0]);
      if (c.length >= 4) cary.push({ idx: c, uzavrena: c[c.length - 1] === i });
    }
    return cary.map(c => { const p = []; for (const i of c.idx) p.push(...bodXY(i)); return { p, uzavrena: c.uzavrena }; });
  };

  // otevřená lomená čára → hladká (Schneider) nebo zjednodušená (DP) cesta
  V.vyhladCaru = function (p, volby) {
    const P = Float64Array.from(p), n = P.length / 2;
    const p0 = [P[0], P[1]];
    if (n < 2) return { p0, s: [], r: [], otevrena: true };
    const eps = Math.max(0.75, Math.min(1.5, 0.7 + 0.3 * volby.tolerance));
    const idx = V._polygon.polygonizuj(P, 0, n - 1, eps);
    const W = V._polygon.vrcholyPolygonu(P, idx, true, true, false);
    let s = [];
    if (!volby.krivky || W.length === 4) {
      for (let k = 1; k < W.length / 2; k++) s.push(['L', W[k * 2], W[k * 2 + 1]]);
    } else {
      const { B, t1, t2 } = V._polygon.krivkaZPolygonu(W, false);
      s = prolozUsek(B, 0, B.length / 2 - 1, volby, t1, t2);
    }
    return { p0, s, r: s.map(() => false), otevrena: true };
  };

  /* ================= hlavní průchod ================= */

  V.VYCHOZI = {
    rezim: 'cb',            // 'cb' | 'barvy' | 'stred'
    styl: 'vypln',          // 'vypln' | 'cary' (obrys pro řezání)
    orez: null, zvetseni: 1, rozmazani: 0,
    prah: 'otsu', invert: false,
    barev: 6, kvantizace: 'kmeans', vrstveni: 'stoh', bezPozadi: false,
    skvrny: 4, tolerance: 0.5, uhel: 45, krivky: true, osmi: true,
    paleta: null            // pevná paleta [[r,g,b],…] místo kvantizace
  };

  function hex(c) { return '#' + c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join(''); }
  V.hex = hex;

  // trasuje binární masku → tvary [{smycky:[vnější, díry…]}]
  V.trasujMasku = function (m, w, h, volby) {
    const sm = V.obrysy(m, w, h, volby.osmi);
    const rod = V.vnoreni(sm);
    const vyhl = sm.map(s => V.vyhladSmycku(s.v, volby));
    const tvary = [], kde = new Map();
    sm.forEach((s, i) => { if (s.plocha > 0) { kde.set(i, tvary.length); tvary.push({ smycky: [vyhl[i]], plochaPx: s.plocha }); } });
    sm.forEach((s, i) => {
      if (s.plocha > 0) return;
      const t = kde.get(rod[i]);
      if (t !== undefined) { tvary[t].smycky.push(vyhl[i]); tvary[t].plochaPx += s.plocha; }
      else tvary.push({ smycky: [vyhl[i]], plochaPx: s.plocha });   // nemělo by nastat
    });
    return tvary;
  };

  /* Celá vektorizace. rgba = Uint8ClampedArray, výsledek:
     { w, h, vrstvy:[{barva, tvary, cary, plochaPx}], paleta, prah, stat:{cest, uzlu} } */
  V.vektorizuj = function (rgba, w, h, volbyVstup) {
    const volby = Object.assign({}, V.VYCHOZI, volbyVstup || {});
    let o = V.orez(rgba, w, h, volby.orez);
    if (volby.zvetseni > 1) o = V.zvetsi(o.data, o.w, o.h, volby.zvetseni);
    let data = volby.rozmazani > 0 ? V.rozmaz(o.data, o.w, o.h, volby.rozmazani) : o.data;
    const W = o.w, H = o.h;
    const vys = { w: W, h: H, vrstvy: [], paleta: null, prah: null, styl: volby.styl, rezim: volby.rezim };

    if (volby.rezim === 'cb' || volby.rezim === 'stred') {
      const g = V.sedotisk(data, W, H);
      const t = volby.prah === 'otsu' || volby.prah == null ? V.otsu(g) : +volby.prah;
      vys.prah = t;
      let m = V.prahuj(g, t, volby.invert);
      m = V.odstranSkvrny(m, W, H, volby.skvrny, volby.osmi);
      if (volby.rezim === 'stred') {
        const k = V.ztenci(m, W, H);
        const cary = V.kostraNaCary(k, W, H, Math.max(3, volby.skvrny)).map(c => V.vyhladCaru(c.p, volby));
        vys.vrstvy.push({ barva: '#000000', tvary: [], cary, plochaPx: 0 });
      } else {
        const tvary = V.trasujMasku(m, W, H, volby);
        let A = 0; for (let i = 0; i < m.length; i++) A += m[i];
        vys.vrstvy.push({ barva: '#000000', tvary, cary: [], plochaPx: A });
      }
    } else {
      let pal = volby.paleta || (volby.kvantizace === 'mediancut' ? V.medianCut(data, volby.barev) : V.kmeans(data, volby.barev, 7));
      let L = V.priradPalete(data, pal);
      L = V.sloucMaleOblasti(L, W, H, volby.skvrny);
      const pocty = new Array(pal.length).fill(0);
      for (let i = 0; i < L.length; i++) if (L[i] !== 255) pocty[L[i]]++;
      // pořadí vrstev: největší plocha dospod
      const poradi = pal.map((_, i) => i).filter(i => pocty[i] > 0).sort((a, b) => pocty[b] - pocty[a]);
      const rank = new Int16Array(256).fill(-1); poradi.forEach((c, r) => { rank[c] = r; });
      vys.paleta = poradi.map(i => hex(pal[i]));
      const stoh = volby.vrstveni === 'stoh' && volby.styl !== 'cary';
      const m = new Uint8Array(W * H);
      poradi.forEach((c, r) => {
        if (volby.bezPozadi && r === 0) return;
        for (let i = 0; i < L.length; i++) { const k = rank[L[i]]; m[i] = (k < 0) ? 0 : stoh ? (k >= r ? 1 : 0) : (k === r ? 1 : 0); }
        const tvary = V.trasujMasku(m, W, H, volby);
        vys.vrstvy.push({ barva: hex(pal[c]), tvary, cary: [], plochaPx: pocty[c] });
      });
    }
    vys.stat = V.statistika(vys);
    return vys;
  };

  V.statistika = function (vys) {
    let cest = 0, uzlu = 0, smycek = 0;
    for (const v of vys.vrstvy) {
      for (const t of v.tvary) { cest++; for (const s of t.smycky) { smycek++; uzlu += s.s.length; } }
      for (const c of v.cary) { cest++; uzlu += c.s.length + 1; }
    }
    return { cest, uzlu, smycek, vrstev: vys.vrstvy.length };
  };

  /* ================= výstupy ================= */

  function cislo(x, des) {
    const k = Math.pow(10, des), r = Math.round(x * k) / k;
    let s = (Object.is(r, -0) ? 0 : r).toString();
    if (s.indexOf('e') >= 0) s = r.toFixed(des);
    if (s.startsWith('0.')) s = s.slice(1); else if (s.startsWith('-0.')) s = '-' + s.slice(2);
    return s;
  }
  // spojí čísla s minimem oddělovačů (záporné znaménko a „.5“ slouží jako oddělovač)
  function spoj(cisla) {
    let o = '';
    for (const c of cisla) o += (o && c[0] !== '-' ? ' ' : '') + c;
    return o;
  }
  /* SVG data cesty z jedné smyčky/čáry; souřadnice se nejdřív zaokrouhlí, relativní
     příkazy se počítají ze zaokrouhlených hodnot (žádné hromadění chyb) */
  V.dCesty = function (sm, des, rel) {
    const k = Math.pow(10, des), R = x => Math.round(x * k) / k;
    let cx = R(sm.p0[0]), cy = R(sm.p0[1]);
    let d = 'M' + spoj([cislo(cx, des), cislo(cy, des)]);
    let posl = 'M';
    const sx = cx, sy = cy, n = sm.s.length;
    for (let q = 0; q < n; q++) {
      const u = sm.s[q];
      // poslední úsečka zpět do začátku je zbytečná – uzavře ji Z
      if (q === n - 1 && !sm.otevrena && u[0] === 'L' && R(u[1]) === sx && R(u[2]) === sy) break;
      const body = [];
      for (let i = 1; i < u.length; i += 2) body.push(R(u[i]), R(u[i + 1]));
      const ex = body[body.length - 2], ey = body[body.length - 1];
      if (u[0] === 'L' && ex === cx && ey === cy) continue;
      let prik = u[0], cis;
      if (rel) { prik = prik.toLowerCase(); cis = body.map((v, i) => cislo(v - (i % 2 ? cy : cx), des)); }
      else cis = body.map(v => cislo(v, des));
      if (prik === 'l' && cis.length === 2 && rel) {
        if (cis[1] === '0') { prik = 'h'; cis = [cis[0]]; } else if (cis[0] === '0') { prik = 'v'; cis = [cis[1]]; }
      } else if (prik === 'L' && cis.length === 2) {
        if (ey === cy) { prik = 'H'; cis = [cis[0]]; } else if (ex === cx) { prik = 'V'; cis = [cis[1]]; }
      }
      d += (prik === posl && prik !== 'M' ? (cis[0][0] === '-' ? '' : ' ') : prik) + spoj(cis);
      posl = prik; cx = ex; cy = ey;
    }
    if (!sm.otevrena) d += 'Z';
    return d;
  };

  // tloušťka čáry v px obrázku: z mm podle fyzické šířky, jinak odhad podle velikosti
  V.tloustkaPx = function (vys, volby, stred) {
    const mmNaPx = volby.sirkaMm > 0 ? volby.sirkaMm / vys.w : 0;
    if (mmNaPx) return (volby.tloustkaMm || 0.3) / mmNaPx;
    return Math.max(1, vys.w / 400) * (stred ? 3 : 1);
  };

  /* SVG dokument. volby: { des (2), rel (true), sirkaMm (0 = px), jednaCesta, styl, tloustkaMm, pozadi } */
  V.doSVG = function (vys, volby) {
    volby = Object.assign({ des: 2, rel: true, sirkaMm: 0, jednaCesta: false, tloustkaMm: 0.3, cary: null }, volby || {});
    const { w, h } = vys, cary = volby.cary != null ? volby.cary : vys.styl === 'cary';
    const mmNaPx = volby.sirkaMm > 0 ? volby.sirkaMm / w : 0;
    const rozm = mmNaPx ? ` width="${cislo(w * mmNaPx, 3)}mm" height="${cislo(h * mmNaPx, 3)}mm"` : ` width="${w}" height="${h}"`;
    let o = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1"${rozm} viewBox="0 0 ${w} ${h}">\n`;
    o += '<!-- Vektorizace – lavionus.github.io/site -->\n';
    vys.vrstvy.forEach((v, i) => {
      const id = `vrstva-${i + 1}-${v.barva.slice(1)}`;
      const stred = v.cary.length > 0;
      if (stred) o += `<g id="${id}" fill="none" stroke="${v.barva}" stroke-width="${cislo(V.tloustkaPx(vys, volby, true), 3)}" stroke-linecap="round" stroke-linejoin="round">\n`;
      else if (cary) o += `<g id="${id}" fill="none" stroke="${v.barva}" stroke-width="${cislo(V.tloustkaPx(vys, volby, false), 3)}">\n`;
      else o += `<g id="${id}" fill="${v.barva}" fill-rule="evenodd">\n`;
      const cesty = [];
      for (const t of v.tvary) cesty.push(t.smycky.map(s => V.dCesty(s, volby.des, volby.rel)).join(''));
      for (const c of v.cary) cesty.push(V.dCesty(c, volby.des, volby.rel));
      if (volby.jednaCesta) { if (cesty.length) o += `<path d="${cesty.join('')}"/>\n`; }
      else for (const d of cesty) o += `<path d="${d}"/>\n`;
      o += '</g>\n';
    });
    return o + '</svg>\n';
  };

  // nejbližší barva AutoCAD (ACI) ze základních
  const ACI = [[1, 255, 0, 0], [2, 255, 255, 0], [3, 0, 255, 0], [4, 0, 255, 255], [5, 0, 0, 255], [6, 255, 0, 255], [7, 0, 0, 0], [8, 128, 128, 128], [9, 192, 192, 192], [30, 255, 127, 0], [250, 51, 51, 51], [252, 105, 105, 105], [254, 190, 190, 190]];
  V.aci = function (h) {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    let nej = 7, nd = Infinity;
    for (const [c, R, G, B] of ACI) { const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2; if (d < nd) { nd = d; nej = c; } }
    return nej;
  };

  /* DXF R12 (AC1009): POLYLINE po vrstvách, křivky aproximované úsečkami s odchylkou tolMm,
     jednotky mm (osa y nahoru). Bez sirkaMm = 1 px → 1 jednotka. */
  V.doDXF = function (vys, volby) {
    volby = Object.assign({ sirkaMm: 0, tolMm: 0.05 }, volby || {});
    const mm = volby.sirkaMm > 0 ? volby.sirkaMm / vys.w : 1;
    const tolPx = volby.tolMm / mm;
    const r = [];
    const g = (k, v) => { r.push(String(k), String(v)); };
    const f = x => (Math.round(x * 10000) / 10000).toString();
    const jmena = vys.vrstvy.map((v, i) => `BARVA_${i + 1}_${v.barva.slice(1).toUpperCase()}`);
    g(0, 'SECTION'); g(2, 'HEADER');
    g(9, '$ACADVER'); g(1, 'AC1009');
    g(9, '$INSUNITS'); g(70, volby.sirkaMm > 0 ? 4 : 0);
    g(9, '$EXTMIN'); g(10, 0); g(20, 0); g(30, 0);
    g(9, '$EXTMAX'); g(10, f(vys.w * mm)); g(20, f(vys.h * mm)); g(30, 0);
    g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, jmena.length + 1);
    g(0, 'LAYER'); g(2, '0'); g(70, 0); g(62, 7); g(6, 'CONTINUOUS');
    jmena.forEach((j, i) => { g(0, 'LAYER'); g(2, j); g(70, 0); g(62, V.aci(vys.vrstvy[i].barva)); g(6, 'CONTINUOUS'); });
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    let pocet = 0;
    const poly = (body, vrstva, zavrena) => {
      let n = body.length / 2;
      if (zavrena && n > 1 && body[0] === body[n * 2 - 2] && body[1] === body[n * 2 - 1]) n--;
      if (n < 2) return;
      g(0, 'POLYLINE'); g(8, vrstva); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, zavrena ? 1 : 0);
      for (let i = 0; i < n; i++) { g(0, 'VERTEX'); g(8, vrstva); g(10, f(body[i * 2] * mm)); g(20, f((vys.h - body[i * 2 + 1]) * mm)); g(30, 0); }
      g(0, 'SEQEND'); g(8, vrstva); pocet++;
    };
    vys.vrstvy.forEach((v, i) => {
      for (const t of v.tvary) for (const s of t.smycky) poly(V.zplosti(s, tolPx), jmena[i], true);
      for (const c of v.cary) poly(V.zplosti(c, tolPx), jmena[i], false);
    });
    g(0, 'ENDSEC'); g(0, 'EOF');
    return { text: r.join('\n') + '\n', pocet };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = V;
  koren.VEKTORIZACE = V;
})(typeof self !== 'undefined' ? self : this);
