/* Omalovánky z fotky – jádro bez DOM (test: _test/omalovanky_test.js, běží i ve workeru omalovanky/worker.js).
   Obrázky: RGBA Uint8ClampedArray, šedotón Float32Array 0 (černá) … 1 (bílá), masky Uint8Array 1 = čára (inkoust). */
(function () {
  'use strict';
  const VERZE = 1;
  const KLIC = 'webapp_omalovanky';
  const MAX_STRANA = 1600;   // pracovní rozlišení (delší strana v px); px nastavení platí pro tuhle velikost

  /* ---------- šedotón a kontrast ---------- */
  function sedotonovy(rgba, w, h) {
    const n = w * h, g = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const a = rgba[j + 3] / 255;   // průhledné = bílý papír
      g[i] = ((0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]) / 255) * a + (1 - a);
    }
    return g;
  }
  /* Roztáhne úrovně (1. a 99. percentil na 0…1) a vynásobí kontrast kolem středu. Na místě. */
  function upravKontrast(g, kontrast) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < g.length; i++) hist[Math.min(255, Math.max(0, g[i] * 255 | 0))]++;
    let lo = 0, hi = 255, s = 0;
    const m = g.length * 0.01;
    for (; lo < 255 && (s += hist[lo]) < m; lo++);
    s = 0;
    for (; hi > 0 && (s += hist[hi]) < m; hi--);
    let a = lo / 255, b = (hi + 1) / 255; const k = kontrast == null ? 1 : kontrast;
    if (b - a < 0.4) { const s = (a + b) / 2; a = Math.max(0, s - 0.2); b = a + 0.4; }   // nejvýš 2,5× – šum v ploché fotce nerozfoukat
    for (let i = 0; i < g.length; i++) {
      const v = ((g[i] - a) / (b - a) - 0.5) * k + 0.5;
      g[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
    return g;
  }

  /* ---------- Gaussovo rozmazání (oddělitelné, okraje opakované) ---------- */
  function gauss(g, w, h, sigma) {
    if (!(sigma > 0.05)) return Float32Array.from(g);
    const r = Math.ceil(sigma * 3), jadro = new Float32Array(2 * r + 1);
    let s = 0;
    for (let i = -r; i <= r; i++) s += (jadro[i + r] = Math.exp(-i * i / (2 * sigma * sigma)));
    for (let i = 0; i < jadro.length; i++) jadro[i] /= s;
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) {
        let v = 0;
        for (let i = -r; i <= r; i++) { const xx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i; v += g[o + xx] * jadro[i + r]; }
        tmp[o + x] = v;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0;
        for (let i = -r; i <= r; i++) { const yy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i; v += tmp[yy * w + x] * jadro[i + r]; }
        out[y * w + x] = v;
      }
    }
    return out;
  }
  function gaussRgba(rgba, w, h, sigma) {
    const n = w * h, kanaly = [0, 1, 2].map(c => { const k = new Float32Array(n); for (let i = 0; i < n; i++) { const a = rgba[i * 4 + 3] / 255; k[i] = rgba[i * 4 + c] * a + 255 * (1 - a); } return gauss(k, w, h, sigma); });
    const out = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) { out[i * 4] = kanaly[0][i]; out[i * 4 + 1] = kanaly[1][i]; out[i * 4 + 2] = kanaly[2][i]; out[i * 4 + 3] = 255; }
    return out;
  }

  /* ---------- Sobel, potlačení nemaxim, hystereze (zjednodušený Canny) ---------- */
  function sobel(g, w, h) {
    const mag = new Float32Array(w * h), smer = new Uint8Array(w * h);
    const p = (x, y) => g[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = p(x + 1, y - 1) + 2 * p(x + 1, y) + p(x + 1, y + 1) - p(x - 1, y - 1) - 2 * p(x - 1, y) - p(x - 1, y + 1);
      const gy = p(x - 1, y + 1) + 2 * p(x, y + 1) + p(x + 1, y + 1) - p(x - 1, y - 1) - 2 * p(x, y - 1) - p(x + 1, y - 1);
      const i = y * w + x;
      mag[i] = Math.hypot(gx, gy);
      let u = Math.atan2(gy, gx) * 180 / Math.PI; if (u < 0) u += 180;
      smer[i] = u < 22.5 || u >= 157.5 ? 0 : u < 67.5 ? 1 : u < 112.5 ? 2 : 3;   // směr gradientu
    }
    return { mag, smer };
  }
  function nemaxima(mag, smer, w, h) {
    const out = new Float32Array(w * h), D = [[1, 0], [1, 1], [0, 1], [-1, 1]];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, m = mag[i]; if (!m) continue;
      const [dx, dy] = D[smer[i]];
      if (m >= mag[i + dy * w + dx] && m > mag[i - dy * w - dx]) out[i] = m;
    }
    return out;
  }
  /* Hodnota, pod kterou leží podíl q nenulových prvků (histogram, stačí přibližně). */
  function percentil(pole, q) {
    let max = 0; for (let i = 0; i < pole.length; i++) if (pole[i] > max) max = pole[i];
    if (!max) return 0;
    const hist = new Uint32Array(1024); let n = 0;
    for (let i = 0; i < pole.length; i++) if (pole[i] > 0) { hist[Math.min(1023, pole[i] / max * 1023 | 0)]++; n++; }
    let s = 0; const cil = n * q;
    for (let b = 0; b < 1024; b++) { s += hist[b]; if (s >= cil) return (b + 1) / 1024 * max; }
    return max;
  }
  function prah(pole, t, pod) {
    const m = new Uint8Array(pole.length);
    for (let i = 0; i < pole.length; i++) m[i] = pod ? (pole[i] < t ? 1 : 0) : (pole[i] >= t ? 1 : 0);
    return m;
  }
  /* Silné body (≥ vysoky) + slabé (≥ nizky), které na silné navazují (8-okolí). */
  function hystereze(mag, w, h, nizky, vysoky) {
    const m = new Uint8Array(w * h), zas = new Int32Array(w * h); let v = 0;
    for (let i = 0; i < m.length; i++) if (mag[i] >= vysoky && mag[i] > 0) { m[i] = 1; zas[v++] = i; }
    while (v) {
      const i = zas[--v], x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (!m[j] && mag[j] >= nizky && mag[j] > 0) { m[j] = 1; zas[v++] = j; }
      }
    }
    return m;
  }

  /* ---------- XDoG (rozšířený rozdíl Gaussiánů, Winnemöller 2012) ----------
     u = 1 − ton·(1 − Gσ) + p·(Gσ − Gkσ); ton 0 = jen čáry na bílé, 1 = původní tvar s tóny.
     Výsledek 1 (bílá) pro u ≥ eps, jinak měkký přechod 1 + tanh(φ·(u − eps)). */
  function xdog(g, w, h, o) {
    o = Object.assign({ sigma: 1, k: 1.6, p: 20, ton: 0, eps: 0.5, phi: 10 }, o);
    const g1 = gauss(g, w, h, o.sigma), g2 = gauss(g, w, h, o.sigma * o.k), out = new Float32Array(w * h);
    for (let i = 0; i < out.length; i++) {
      const u = 1 - o.ton * (1 - g1[i]) + o.p * (g1[i] - g2[i]);
      const e = u >= o.eps ? 1 : 1 + Math.tanh(o.phi * (u - o.eps));
      out[i] = e < 0 ? 0 : e;
    }
    return out;
  }

  /* ---------- souvislé složky masky ---------- */
  function oznacSlozky(maska, w, h, osm) {
    const st = new Int32Array(w * h), zas = new Int32Array(w * h), velikosti = [0];
    let n = 0;
    for (let s = 0; s < st.length; s++) {
      if (!maska[s] || st[s]) continue;
      n++; let v = 0, poc = 0; st[s] = n; zas[v++] = s;
      while (v) {
        const i = zas[--v], x = i % w, y = (i - x) / w; poc++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || (!osm && dx && dy)) continue;
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (maska[j] && !st[j]) { st[j] = n; zas[v++] = j; }
        }
      }
      velikosti.push(poc);
    }
    return { stitky: st, pocet: n, velikosti };
  }
  /* Smaže útržky (8-souvislé složky) menší než minPx. Na místě, vrací počet smazaných složek. */
  function odstranDrobne(maska, w, h, minPx) {
    if (!(minPx > 1)) return 0;
    const { stitky, velikosti } = oznacSlozky(maska, w, h, true);
    let smazano = 0;
    for (let i = 1; i < velikosti.length; i++) if (velikosti[i] < minPx) smazano++;
    for (let i = 0; i < maska.length; i++) if (maska[i] && velikosti[stitky[i]] < minPx) maska[i] = 0;
    return smazano;
  }

  /* ---------- morfologie ---------- */
  /* Ztenčení na kostru 1 px (Zhang–Suen). Na místě. */
  function ztenci(maska, w, h) {
    let body = []; for (let i = 0; i < maska.length; i++) if (maska[i]) body.push(i);
    const smaz = [];
    const P = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : maska[y * w + x];
    let zmena = true;
    while (zmena) {
      zmena = false;
      for (let krok = 0; krok < 2; krok++) {
        smaz.length = 0;
        for (const i of body) {
          if (!maska[i]) continue;
          const x = i % w, y = (i - x) / w;
          const p2 = P(x, y - 1), p3 = P(x + 1, y - 1), p4 = P(x + 1, y), p5 = P(x + 1, y + 1), p6 = P(x, y + 1), p7 = P(x - 1, y + 1), p8 = P(x - 1, y), p9 = P(x - 1, y - 1);
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
          if (A !== 1) continue;
          if (krok === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
          smaz.push(i);
        }
        for (const i of smaz) maska[i] = 0;
        if (smaz.length) zmena = true;
      }
      body = body.filter(i => maska[i]);
    }
    return maska;
  }
  /* Zesílení čar na tloušťku t px (dilatace kruhem; sudá tloušťka se dorovná o 1 px doprava a dolů). */
  function zesil(maska, w, h, t) {
    t = Math.round(t);
    if (!(t > 1)) return Uint8Array.from(maska);
    const r = Math.floor((t - 1) / 2), sude = t % 2 === 0, off = [];
    for (let dy = -r; dy <= r + sude; dy++) for (let dx = -r; dx <= r + sude; dx++) {
      const cx = sude ? dx - 0.5 : dx, cy = sude ? dy - 0.5 : dy;
      if (cx * cx + cy * cy <= (t / 2) * (t / 2) + 0.25) off.push([dx, dy]);
    }
    const out = new Uint8Array(w * h);
    for (let i = 0; i < maska.length; i++) {
      if (!maska[i]) continue;
      const x = i % w, y = (i - x) / w;
      for (const [dx, dy] of off) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) out[yy * w + xx] = 1;
      }
    }
    return out;
  }

  /* ---------- posterizace do K barev (k-means, deterministický) ---------- */
  function posterizuj(rgba, w, h, K) {
    const n = w * h; K = Math.max(2, Math.min(40, K | 0));
    let seed = 12345; const nahoda = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const krok = Math.max(1, Math.floor(n / 30000)), vz = [];
    for (let i = 0; i < n; i += krok) vz.push([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]);
    const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    const st = [vz[Math.floor(nahoda() * vz.length)].slice()];   // k-means++
    const dist = vz.map(v => d2(v, st[0]));
    while (st.length < K) {
      let s = 0; for (const d of dist) s += d;
      if (!s) break;
      let r = nahoda() * s, j = 0;
      for (; j < dist.length - 1 && (r -= dist[j]) > 0; j++);
      st.push(vz[j].slice());
      for (let i = 0; i < vz.length; i++) dist[i] = Math.min(dist[i], d2(vz[i], vz[j]));
    }
    const nejbl = c => { let b = 0, bd = Infinity; for (let k = 0; k < st.length; k++) { const d = d2(c, st[k]); if (d < bd) { bd = d; b = k; } } return b; };
    for (let it = 0; it < 15; it++) {
      const sum = st.map(() => [0, 0, 0, 0]);
      for (const v of vz) { const s = sum[nejbl(v)]; s[0] += v[0]; s[1] += v[1]; s[2] += v[2]; s[3]++; }
      let pohyb = 0;
      sum.forEach((s, k) => { if (s[3]) { const c = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; pohyb += d2(c, st[k]); st[k] = c; } });
      if (pohyb < 1) break;
    }
    // světlé barvy první (čísla od světlé k tmavé), sloučit prázdné
    const pouzite = new Uint32Array(st.length), c = [0, 0, 0], idx = new Int32Array(n);
    for (let i = 0; i < n; i++) { c[0] = rgba[i * 4]; c[1] = rgba[i * 4 + 1]; c[2] = rgba[i * 4 + 2]; idx[i] = nejbl(c); pouzite[idx[i]]++; }
    const poradi = st.map((s, k) => k).filter(k => pouzite[k]).sort((a, b) => jas(st[b]) - jas(st[a]));
    const preklad = new Int32Array(st.length); poradi.forEach((k, i) => { preklad[k] = i; });
    const indexy = new Uint8Array(n);
    for (let i = 0; i < n; i++) indexy[i] = preklad[idx[i]];
    return { indexy, paleta: poradi.map(k => st[k].map(Math.round)) };
  }
  const jas = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  /* Většinový filtr 3×3 nad indexy barev (vyhladí zubaté hranice a šum). */
  function modus(indexy, w, h, K) {
    const out = Uint8Array.from(indexy), poc = new Uint16Array(K);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let best = indexy[y * w + x], bn = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) poc[indexy[(y + dy) * w + x + dx]]++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = indexy[(y + dy) * w + x + dx]; if (poc[k] > bn) { bn = poc[k]; best = k; } }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) poc[indexy[(y + dy) * w + x + dx]] = 0;
      if (bn >= 5) out[y * w + x] = best;
    }
    return out;
  }

  /* ---------- plochy (4-souvislé oblasti stejné barvy) ---------- */
  function oznacPlochy(indexy, w, h) {
    const n = w * h, st = new Int32Array(n).fill(-1), zas = new Int32Array(n), barva = [], velikost = [];
    let p = 0;
    for (let s = 0; s < n; s++) {
      if (st[s] >= 0) continue;
      const b = indexy[s]; let v = 0, poc = 0; st[s] = p; zas[v++] = s;
      while (v) {
        const i = zas[--v], x = i % w; poc++;
        if (x > 0 && st[i - 1] < 0 && indexy[i - 1] === b) { st[i - 1] = p; zas[v++] = i - 1; }
        if (x < w - 1 && st[i + 1] < 0 && indexy[i + 1] === b) { st[i + 1] = p; zas[v++] = i + 1; }
        if (i >= w && st[i - w] < 0 && indexy[i - w] === b) { st[i - w] = p; zas[v++] = i - w; }
        if (i + w < n && st[i + w] < 0 && indexy[i + w] === b) { st[i + w] = p; zas[v++] = i + w; }
      }
      barva.push(b); velikost.push(poc); p++;
    }
    return { stitky: st, pocet: p, barva, velikost };
  }
  /* Plochy menší než minPx přebarví na barvu souseda s nejdelší společnou hranicí. Vrací {indexy, slouceno}. */
  /* minR > 0: sloučí i úzké proužky (bod nejdál od hranice blíž než minR px) – přechody mezi barvami po rozmazání. */
  function sloucitMale(indexy, w, h, minPx, K, minR) {
    let ix = Uint8Array.from(indexy), slouceno = 0;
    if (!(minPx > 1) && !(minR > 0)) return { indexy: ix, slouceno };
    K = K || 256;
    for (let kolo = 0; kolo < 12; kolo++) {
      const P = oznacPlochy(ix, w, h), male = new Int32Array(P.pocet).fill(-1);
      let m = 0;
      let maxR = null;
      if (minR > 0) {
        const d = vzdalenostOdHranice(P.stitky, w, h); maxR = new Float32Array(P.pocet);
        for (let i = 0; i < d.length; i++) if (d[i] > maxR[P.stitky[i]]) maxR[P.stitky[i]] = d[i];
      }
      for (let i = 0; i < P.pocet; i++) if (P.velikost[i] < minPx || (maxR && maxR[i] < minR)) male[i] = m++;
      if (!m || P.pocet < 2) break;
      const hrany = new Uint32Array(m * K);
      const sousedi = (a, b) => {
        const pa = P.stitky[a], pb = P.stitky[b]; if (pa === pb) return;
        if (male[pa] >= 0) hrany[male[pa] * K + ix[b]]++;
        if (male[pb] >= 0) hrany[male[pb] * K + ix[a]]++;
      };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (x < w - 1) sousedi(i, i + 1);
        if (y < h - 1) sousedi(i, i + w);
      }
      const nova = new Int32Array(m).fill(-1); let zmen = 0;
      for (let r = 0; r < P.pocet; r++) {
        const j = male[r]; if (j < 0) continue;
        let best = -1, bn = 0;
        for (let k = 0; k < K; k++) if (hrany[j * K + k] > bn) { bn = hrany[j * K + k]; best = k; }
        if (best >= 0) { nova[j] = best; zmen++; }
      }
      if (!zmen) break;
      for (let i = 0; i < ix.length; i++) { const j = male[P.stitky[i]]; if (j >= 0 && nova[j] >= 0) ix[i] = nova[j]; }
      slouceno += zmen;
    }
    return { indexy: ix, slouceno };
  }
  /* Hranice ploch: bod, jehož pravý nebo dolní soused patří k jiné ploše. */
  function hranicePloch(indexy, w, h) {
    const m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((x < w - 1 && indexy[i + 1] !== indexy[i]) || (y < h - 1 && indexy[i + w] !== indexy[i])) m[i] = 1;
    }
    return m;
  }
  /* Vzdálenost k hranici plochy (zkosená metrika 1/√2, dva průchody). Okraj obrázku je hranice. */
  function vzdalenostOdHranice(stitky, w, h) {
    const n = w * h, d = new Float32Array(n), S = Math.SQRT2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, s = stitky[i];
      const hranice = x === 0 || y === 0 || x === w - 1 || y === h - 1 || stitky[i - 1] !== s || stitky[i + 1] !== s || stitky[i - w] !== s || stitky[i + w] !== s;
      d[i] = hranice ? 0 : 1e9;
    }
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (!d[i]) continue;
      d[i] = Math.min(d[i], d[i - 1] + 1, d[i - w] + 1, d[i - w - 1] + S, d[i - w + 1] + S);
    }
    for (let y = h - 2; y > 0; y--) for (let x = w - 2; x > 0; x--) {
      const i = y * w + x; if (!d[i]) continue;
      d[i] = Math.min(d[i], d[i + 1] + 1, d[i + w] + 1, d[i + w + 1] + S, d[i + w - 1] + S);
    }
    return d;
  }
  /* Pro každou plochu bod nejdál od hranice (tam se vejde číslo). Vrací [{x, y, cislo, r, px}], cislo = index barvy + 1. */
  function plochyACisla(indexy, w, h, P) {
    P = P || oznacPlochy(indexy, w, h);
    const d = vzdalenostOdHranice(P.stitky, w, h), best = new Int32Array(P.pocet).fill(-1), bd = new Float32Array(P.pocet).fill(-1);
    for (let i = 0; i < d.length; i++) { const s = P.stitky[i]; if (d[i] > bd[s]) { bd[s] = d[i]; best[s] = i; } }
    const vys = [];
    for (let s = 0; s < P.pocet; s++) {
      const i = best[s];
      vys.push({ x: i % w, y: Math.floor(i / w), cislo: P.barva[s] + 1, r: bd[s], px: P.velikost[s] });
    }
    return vys;
  }

  /* ---------- nastavení a celý převod ---------- */
  function vychozi() {
    return { verze: VERZE, rezim: 'omalovanka', metoda: 'xdog', detail: 5, tloustka: 4, utrzek: 60, kontrast: 1, invert: false,
      barev: 12, minPlocha: 0.15, vybarvene: false,
      format: 'a4', orientace: 'auto', okraj: 12, ramecek: true, nadpis: '', jmeno: true };
  }
  function migruj(d) {
    const v = vychozi();
    if (!d || typeof d !== 'object') return v;
    const o = Object.assign(v, d); o.verze = VERZE; return o;
  }
  /* Převod RGBA → výsledek. Parametry v px se vztahují k MAX_STRANA, u menších obrázků se úměrně zmenší. */
  function zpracuj(rgba, w, h, nast) {
    const N = migruj(nast), m = Math.max(0.3, Math.max(w, h) / MAX_STRANA), det = Math.max(1, Math.min(10, +N.detail || 5));
    const tl = Math.max(1, Math.round(N.tloustka * m)), utrzek = Math.round(N.utrzek * m * m);
    if (N.rezim === 'cisla') {
      const roz = gaussRgba(rgba, w, h, (3.2 - det * 0.25) * m);
      const post = posterizuj(roz, w, h, N.barev);
      let ix = modus(modus(post.indexy, w, h, post.paleta.length), w, h, post.paleta.length);
      ix = sloucitMale(ix, w, h, Math.max(4, w * h * N.minPlocha / 100), post.paleta.length, Math.max(1.5, 3 * m)).indexy;
      const pouzite = new Uint8Array(post.paleta.length), novy = new Uint8Array(post.paleta.length);   // nepoužité barvy pryč, přečíslovat
      for (let i = 0; i < ix.length; i++) pouzite[ix[i]] = 1;
      const paleta = post.paleta.filter((b, k) => pouzite[k]);
      let c = 0; for (let k = 0; k < pouzite.length; k++) if (pouzite[k]) novy[k] = c++;
      for (let i = 0; i < ix.length; i++) ix[i] = novy[ix[i]];
      const P = oznacPlochy(ix, w, h);
      return { typ: 'plochy', w, h, maska: zesil(hranicePloch(ix, w, h), w, h, Math.max(1, Math.round(tl * 0.6))),
        indexy: ix, paleta, cisla: plochyACisla(ix, w, h, P) };
    }
    const g = upravKontrast(sedotonovy(rgba, w, h), N.kontrast);
    if (N.rezim === 'skica') {
      const e = xdog(g, w, h, { sigma: (1.6 - det * 0.09) * m, k: 1.6, p: 12, ton: 0.45, eps: 0.75, phi: 4 });
      return { typ: 'sedy', w, h, sed: e };
    }
    let maska;
    if (N.metoda === 'canny') {
      const s = sobel(gauss(g, w, h, Math.max(0.8, (2.6 - det * 0.2) * m)), w, h), nm = nemaxima(s.mag, s.smer, w, h);
      const vys = percentil(nm, 0.97 - det * 0.035);
      maska = hystereze(nm, w, h, vys * 0.4, vys);
    } else {
      const e = xdog(g, w, h, { sigma: Math.max(1, (2.6 - det * 0.12) * m), k: 1.6, p: 40, ton: 0, eps: 0.95 - det * 0.04, phi: 100 });
      maska = prah(e, 0.5, true);
    }
    odstranDrobne(maska, w, h, utrzek);
    ztenci(maska, w, h);
    odstranDrobne(maska, w, h, Math.round(utrzek / 3));
    return { typ: 'cary', w, h, maska: zesil(maska, w, h, tl) };
  }
  /* Výsledek → RGBA (čísla do ploch kreslí stránka písmem). */
  function naRgba(vys, o) {
    o = o || {};
    const n = vys.w * vys.h, out = new Uint8ClampedArray(n * 4), inv = !!o.invert;
    for (let i = 0; i < n; i++) {
      let r, g, b;
      if (vys.typ === 'sedy') { r = g = b = vys.sed[i] * 255; }
      else if (vys.maska[i]) { r = g = b = o.barvaCar == null ? 0 : o.barvaCar; }
      else if (o.vybarvene && vys.paleta) { [r, g, b] = vys.paleta[vys.indexy[i]]; }
      else r = g = b = 255;
      if (inv) { r = 255 - r; g = 255 - g; b = 255 - b; }
      out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255;
    }
    return out;
  }
  /* Rozměr pracovního obrázku. */
  function pracovniRozmer(w, h, max) {
    max = max || MAX_STRANA; const k = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }
  /* Rozvržení listu v mm: formát, orientace (auto podle poměru obrázku), okraj, místo pro nadpis a legendu. */
  const FORMATY = { a4: [210, 297], a5: [148, 210] };
  function rozvrzeniListu(w, h, o) {
    let [lw, lh] = FORMATY[o.format] || FORMATY.a4;
    const nasirku = o.orientace === 'nasirku' || (o.orientace === 'auto' && w > h);
    if (nasirku) [lw, lh] = [lh, lw];
    const okraj = Math.max(0, +o.okraj || 0), dole = (o.nadpis || o.jmeno ? 14 : 0) + (o.legenda ? o.legenda : 0);
    const mw = lw - 2 * okraj, mh = Math.max(10, lh - 2 * okraj - dole), k = Math.min(mw / w, mh / h);
    const iw = w * k, ih = h * k;
    return { list: [lw, lh], nasirku, obr: { x: (lw - iw) / 2, y: okraj + (mh - ih) / 2, w: iw, h: ih }, okraj, dole: lh - okraj - dole };
  }

  const API = {
    VERZE, KLIC, MAX_STRANA, FORMATY,
    sedotonovy, upravKontrast, gauss, gaussRgba, sobel, nemaxima, percentil, prah, hystereze, xdog,
    oznacSlozky, odstranDrobne, ztenci, zesil, posterizuj, modus, oznacPlochy, sloucitMale, hranicePloch,
    vzdalenostOdHranice, plochyACisla, plochyAČisla: plochyACisla,
    vychozi, migruj, zpracuj, naRgba, pracovniRozmer, rozvrzeniListu
  };
  if (typeof module !== 'undefined') module.exports = API;
  else self.OmalovankyJadro = API;
})();
