/* MIC – jádro rozboru žlutých sledovacích teček (Machine Identification Code).
   Bez DOM: pracuje nad RGBA polem (Uint8ClampedArray), běží v prohlížeči i v node.
   Postup: žlutost → tečky (spojité oblasti) → mřížka (úhel + rozteč) → složky na mřížce
   → hledání vzoru Xerox DocuColor (15×8, lichá parita, popis EFF) + obecná perioda vzoru. */
(function (g) {
  'use strict';

  // ---------- 1) žlutost ----------
  // d = žlutost pixelu minus žlutost okolí (box blur o poloměru r) → tečky vystoupí i na nažloutlém papíře
  function zlutostRozdil(data, w, h, r) {
    const n = w * h, y = new Float32Array(n);
    for (let i = 0, k = 0; i < n; i++, k += 4) y[i] = ((data[k] + data[k + 1]) >> 1) - data[k + 2];
    const bg = rozmaz(y, w, h, r);
    for (let i = 0; i < n; i++) y[i] -= bg[i];
    return y;
  }

  function rozmaz(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const o = y * w; let s = 0, n = 0;
      for (let x = 0; x < Math.min(r, w); x++) { s += src[o + x]; n++; }
      for (let x = 0; x < w; x++) {
        if (x + r < w) { s += src[o + x + r]; n++; }
        if (x - r - 1 >= 0) { s -= src[o + x - r - 1]; n--; }
        tmp[o + x] = s / n;
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let y = 0; y < Math.min(r, h); y++) { s += tmp[y * w + x]; n++; }
      for (let y = 0; y < h; y++) {
        if (y + r < h) { s += tmp[(y + r) * w + x]; n++; }
        if (y - r - 1 >= 0) { s -= tmp[(y - r - 1) * w + x]; n--; }
        out[y * w + x] = s / n;
      }
    }
    return out;
  }

  // šum rozdílu (robustně přes MAD ze vzorku)
  function sum(d) {
    const krok = Math.max(1, Math.floor(d.length / 200000)), v = [];
    for (let i = 0; i < d.length; i += krok) v.push(d[i]);
    const s = Float32Array.from(v).sort(), med = s[s.length >> 1];
    for (let i = 0; i < s.length; i++) s[i] = Math.abs(s[i] - med);
    s.sort();
    return Math.max(0.5, 1.4826 * s[s.length >> 1]);
  }

  // ---------- 2) tečky ----------
  // o: { dpi, citlivost (násobek šumu, výchozí 5), d (předpočítaný rozdíl) }
  function najdiTecky(data, w, h, o = {}) {
    const dpi = o.dpi || 600, mer = dpi / 600;
    const r = Math.max(4, Math.round(10 * mer));
    const d = o.d || zlutostRozdil(data, w, h, r);
    const sigma = sum(d);
    const prah = Math.max(6, (o.citlivost || 5) * sigma);
    const maxPlocha = Math.max(12, Math.round(140 * mer * mer));
    const n = w * h, maska = new Uint8Array(n);
    for (let i = 0, k = 0; i < n; i++, k += 4)
      if (d[i] > prah && data[k] + data[k + 1] > 220) maska[i] = 1;   // jen světlé (žluté) pixely, ne tmavé okraje písma
    const tecky = [], zas = new Int32Array(n > 1 << 20 ? 1 << 20 : n);
    let zahozeno = 0;
    for (let start = 0; start < n; start++) {
      if (!maska[start]) continue;
      let sp = 0, plocha = 0, sx = 0, sy = 0, sw = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, pretek = false;
      zas[sp++] = start; maska[start] = 0;
      while (sp) {
        const p = zas[--sp], x = p % w, y = (p - x) / w, vaha = d[p] - prah * 0.5;
        plocha++; sx += x * vaha; sy += y * vaha; sw += vaha;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        const sous = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
        for (const q of sous) if (q >= 0 && maska[q]) {
          maska[q] = 0;
          if (sp < zas.length) zas[sp++] = q; else pretek = true;
        }
      }
      const sirka = x1 - x0 + 1, vyska = y1 - y0 + 1, mez = 3 * Math.sqrt(plocha) + 2;
      if (pretek || plocha > maxPlocha || sirka > mez || vyska > mez) { zahozeno++; continue; }
      tecky.push({ x: sx / sw, y: sy / sw, a: plocha, s: sw });
      if (tecky.length >= 60000) break;
    }
    return { tecky, prah, sigma, zahozeno, d };
  }

  // ---------- pomocná mřížka kyblíků ----------
  function kyblik(body, bunka) {
    const m = new Map();
    body.forEach((b, i) => {
      const k = Math.floor(b.x / bunka) * 100000 + Math.floor(b.y / bunka);
      let s = m.get(k); if (!s) m.set(k, s = []); s.push(i);
    });
    return {
      okoli(x, y, rad, fn) {
        const cx = Math.floor(x / bunka), cy = Math.floor(y / bunka), kk = Math.ceil(rad / bunka);
        for (let i = cx - kk; i <= cx + kk; i++) for (let j = cy - kk; j <= cy + kk; j++) {
          const s = m.get(i * 100000 + j); if (s) for (const t of s) fn(t);
        }
      }
    };
  }

  function koherence(rozdily, p) {
    let c = 0, s = 0; const k = 2 * Math.PI / p;
    for (let i = 0; i < rozdily.length; i++) { c += Math.cos(k * rozdily[i]); s += Math.sin(k * rozdily[i]); }
    return rozdily.length ? Math.hypot(c, s) / rozdily.length : 0;
  }

  // ---------- 3) mřížka: úhel natočení a rozteč v obou osách ----------
  function odhadniMrizku(tecky) {
    const n = tecky.length;
    if (n < 20) return null;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const t of tecky) { x0 = Math.min(x0, t.x); x1 = Math.max(x1, t.x); y0 = Math.min(y0, t.y); y1 = Math.max(y1, t.y); }
    const s = Math.max(4, Math.sqrt((x1 - x0 + 1) * (y1 - y0 + 1) / n));
    const K = kyblik(tecky, s);
    // nejbližší soused (typická vzdálenost)
    const nn = [];
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 4000))) {
      const t = tecky[i]; let best = 1e9;
      K.okoli(t.x, t.y, 3 * s, j => {
        if (j === i) return;
        const dd = Math.hypot(tecky[j].x - t.x, tecky[j].y - t.y);
        if (dd > 1.5 && dd < best) best = dd;
      });
      if (best < 1e9) nn.push(best);
    }
    if (nn.length < 10) return null;
    nn.sort((a, b) => a - b);
    const d0 = nn[nn.length >> 1];
    // natočení: při správném úhlu se průměty teček slijí do ostrých řad a sloupců (deskew)
    const vz = []; for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 6000))) vz.push(tecky[i].x, tecky[i].y);
    const ostrost = (th, kos) => {
      const c = Math.cos(th), sn = Math.sin(th), hu = new Map(), hv = new Map();
      for (let k = 0; k < vz.length; k += 2) {
        const u = Math.round((vz[k] * c + vz[k + 1] * sn) / kos), v = Math.round((-vz[k] * sn + vz[k + 1] * c) / kos);
        hu.set(u, (hu.get(u) || 0) + 1); hv.set(v, (hv.get(v) || 0) + 1);
      }
      let q = 0; hu.forEach(x => { q += x * x; }); hv.forEach(x => { q += x * x; });
      return q;
    };
    let uhel = 0, bq = -1;
    for (let du = -20; du <= 20.001; du += 0.1) { const q = ostrost(du * Math.PI / 180, 2); if (q > bq) { bq = q; uhel = du * Math.PI / 180; } }
    const hrube = uhel; bq = -1;
    for (let du = -0.15; du <= 0.1501; du += 0.005) { const th = hrube + du * Math.PI / 180, q = ostrost(th, 1); if (q > bq) { bq = q; uhel = th; } }

    // dvojice do vzdálenosti 6·d0 (vzorek)
    const R = 6 * d0, dvojice = [];
    const K2 = kyblik(tecky, R / 2), krok = Math.max(1, Math.floor(n / 2500));
    for (let i = 0; i < n && dvojice.length < 400000; i += krok) {
      const t = tecky[i];
      K2.okoli(t.x, t.y, R, j => {
        if (j <= i) return;
        const dx = tecky[j].x - t.x, dy = tecky[j].y - t.y;
        if (dx * dx + dy * dy <= R * R) dvojice.push(dx, dy);
      });
    }
    const vyber = (th, osa) => {   // rozdíly podél osy pro dvojice ležící v téže řadě/sloupci
      const c = Math.cos(th), sn = Math.sin(th), out = [], tol = 0.3 * d0;
      for (let k = 0; k < dvojice.length; k += 2) {
        const u = dvojice[k] * c + dvojice[k + 1] * sn, v = -dvojice[k] * sn + dvojice[k + 1] * c;
        if (osa === 0 && Math.abs(v) < tol && Math.abs(u) > 1) out.push(u);
        if (osa === 1 && Math.abs(u) < tol && Math.abs(v) > 1) out.push(v);
        if (out.length >= 30000) break;
      }
      return out;
    };
    const roztec = (roz) => {
      if (roz.length < 15) return null;
      const abs = roz.map(Math.abs).sort((a, b) => a - b);
      const dmin = abs[Math.floor(abs.length * 0.05)];       // nejkratší běžná vzdálenost v řadě
      const lo = Math.max(2, 0.3 * dmin), hi = 1.25 * Math.max(dmin, d0 * 0.5);
      const krivka = []; let max = 0;
      for (let p = lo; p <= hi; p *= 1.003) { const c = koherence(roz, p); krivka.push([p, c]); if (c > max) max = c; }
      let p = lo;
      for (const [pp, c] of krivka) if (c >= 0.85 * max) p = pp;    // největší koherentní rozteč (ne její zlomky)
      let pc = 0; const horni = p;                                     // …a vrchol jejího píku
      for (const [pp, c] of krivka) if (pp >= horni * 0.88 && pp <= horni && c > pc) { pc = c; p = pp; }
      let bp = p, bc = 0;
      for (let q = p * 0.995; q <= p * 1.005; q *= 1.0002) { const c = koherence(roz, q); if (c > bc) { bc = c; bp = q; } }
      return { p: bp, c: bc };
    };
    let rx = roztec(vyber(uhel, 0)), ry = roztec(vyber(uhel, 1));
    if (!rx || !ry) return null;
    // doladění úhlu
    return { uhel, px: rx.p, py: ry.p, kx: rx.c, ky: ry.c, d0 };
  }

  // ---------- 4) složky teček ležících na společné mřížce ----------
  function slozky(tecky, m, minTecek = 12) {
    const n = tecky.length, c = Math.cos(m.uhel), s = Math.sin(m.uhel);
    const u = new Float64Array(n), v = new Float64Array(n);
    tecky.forEach((t, i) => { u[i] = t.x * c + t.y * s; v[i] = -t.x * s + t.y * c; });
    const rad = Math.max(3.2 * Math.max(m.px, m.py), 4 * m.d0), tol = 0.22;   // řídké vzory: dosah i podle sousedů
    const K = kyblik(tecky.map((t, i) => ({ x: u[i], y: v[i] })), rad);
    const sous = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      K.okoli(u[i], v[i], rad, j => {
        if (j <= i) return;
        const a = (u[j] - u[i]) / m.px, b = (v[j] - v[i]) / m.py, ra = Math.round(a), rb = Math.round(b);
        if ((ra || rb) && Math.abs(a - ra) < tol && Math.abs(b - rb) < tol && Math.hypot(ra * m.px, rb * m.py) <= rad) {
          sous[i].push(j, ra, rb); sous[j].push(i, -ra, -rb);
        }
      });
    }
    const ci = new Int32Array(n), cj = new Int32Array(n), id = new Int32Array(n).fill(-1), vysl = [];
    for (let st = 0; st < n; st++) {
      if (id[st] >= 0 || !sous[st].length) continue;
      const cl = vysl.length, fronta = [st], clen = [];
      id[st] = cl; ci[st] = 0; cj[st] = 0;
      while (fronta.length) {
        const p = fronta.pop(); clen.push(p);
        const L = sous[p];
        for (let k = 0; k < L.length; k += 3) {
          const q = L[k];
          if (id[q] >= 0) continue;
          id[q] = cl; ci[q] = ci[p] + L[k + 1]; cj[q] = cj[p] + L[k + 2]; fronta.push(q);
        }
      }
      vysl.push(clen);
    }
    // osiřelé malé shluky (krajní tečky dlaždice daleko od zbytku) připojit k velké skupině
    // přes nejbližší tečku, jejíž vzdálenost padne na mřížku
    const rad2 = 2.2 * rad;
    vysl.forEach((clen, cl) => {
      if (clen.length >= minTecek) return;
      let best = null;
      for (const p of clen) K.okoli(u[p], v[p], rad2, q => {
        const cq = id[q];
        if (cq < 0 || cq === cl || vysl[cq].length < minTecek) return;
        const a = (u[q] - u[p]) / m.px, b = (v[q] - v[p]) / m.py, ra = Math.round(a), rb = Math.round(b);
        const dd = Math.hypot(u[q] - u[p], v[q] - v[p]);
        if (dd <= rad2 && Math.abs(a - ra) < tol && Math.abs(b - rb) < tol && (!best || dd < best.dd)) best = { p, q, ra, rb, dd, cq };
      });
      if (!best) return;
      const di = ci[best.q] - best.ra - ci[best.p], dj = cj[best.q] - best.rb - cj[best.p];
      for (const p of clen) { ci[p] += di; cj[p] += dj; id[p] = best.cq; }
      vysl[best.cq].push(...clen);
      vysl[cl] = [];
    });
    const out = [];
    vysl.forEach((clen) => {
      if (clen.length < minTecek) { clen.forEach(p => { if (id[p] === -1 || vysl[id[p]] === clen) id[p] = -1; }); return; }
      let imin = 1e9, imax = -1e9, jmin = 1e9, jmax = -1e9, su = 0, sv = 0;
      const obs = new Map();
      for (const p of clen) {
        imin = Math.min(imin, ci[p]); imax = Math.max(imax, ci[p]); jmin = Math.min(jmin, cj[p]); jmax = Math.max(jmax, cj[p]);
        su += u[p] - ci[p] * m.px; sv += v[p] - cj[p] * m.py;
        obs.set(ci[p] + ',' + cj[p], p);
      }
      const W = imax - imin + 1, H = jmax - jmin + 1, G = new Uint8Array(W * H);
      for (const p of clen) G[(cj[p] - jmin) * W + ci[p] - imin] = 1;
      out.push({ tecky: clen, imin, jmin, W, H, G, u0: su / clen.length, v0: sv / clen.length, pocet: obs.size });
    });
    out.sort((a, b) => b.pocet - a.pocet);
    out.forEach((sl, k) => sl.tecky.forEach(p => { id[p] = k; }));
    return { slozky: out, id, ci, cj };
  }

  // střed buňky (i,j) složky → souřadnice obrázku
  function bunkaNaObraz(sl, m, i, j) {
    const uu = sl.u0 + i * m.px, vv = sl.v0 + j * m.py, c = Math.cos(m.uhel), s = Math.sin(m.uhel);
    return { x: uu * c - vv * s, y: uu * s + vv * c };
  }

  // ---------- 5) Xerox DocuColor (EFF): 15 sloupců × 8 řad ----------
  // Řada 0 = parita sloupců, sloupec 0 = parita řad, parita lichá. Sloupec čten shora 64…1.
  // Sloupce (číslováno od 1 jako EFF): 2 minuta, 5 hodina, 6 den, 7 měsíc, 8 rok, 10 oddělovač (vše 1),
  // 11–14 sériové číslo po dvou číslicích (14 = nejvyšší), 15 neznámé, 3,4,9 nevyužité.
  const ORIENTACE = [
    { nazev: 'normálně', f: (c, r) => [c, r], w: 15, h: 8 },
    { nazev: 'zrcadlově', f: (c, r) => [14 - c, r], w: 15, h: 8 },
    { nazev: 'vzhůru nohama (zrcadlově)', f: (c, r) => [c, 7 - r], w: 15, h: 8 },
    { nazev: 'otočeno o 180°', f: (c, r) => [14 - c, 7 - r], w: 15, h: 8 },
    { nazev: 'otočeno o 90° (zrcadlově)', f: (c, r) => [r, c], w: 8, h: 15 },
    { nazev: 'otočeno o 90° doprava', f: (c, r) => [7 - r, c], w: 8, h: 15 },
    { nazev: 'otočeno o 90° doleva', f: (c, r) => [r, 14 - c], w: 8, h: 15 },
    { nazev: 'otočeno o 90° (zrcadlově, převráceně)', f: (c, r) => [7 - r, 14 - c], w: 8, h: 15 },
  ];
  ORIENTACE.forEach(o => { o.mapa = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 15; c++) o.mapa.push(o.f(c, r)); });

  function xeroxHodnoty(bity) {          // bity[r*15+c] → 15 hodnot sloupců
    const val = [];
    for (let c = 0; c < 15; c++) { let x = 0; for (let r = 1; r < 8; r++) x = x * 2 + bity[r * 15 + c]; val.push(x); }
    return val;
  }

  function xeroxDekoduj(val) {
    const ser = [13, 12, 11, 10].map(c => val[c]);
    return {
      minuta: val[1], hodina: val[4], den: val[5], mesic: val[6], rok: val[7],
      serie: ser.map(x => String(x).padStart(2, '0')).join(''),
      sloupec15: val[14], oddelovac: val[9] === 127, nevyuzite: [val[2], val[3], val[8]],
      platne: val[1] <= 59 && val[4] <= 23 && val[7] <= 99 && val[5] >= 1 && val[5] <= 31 && val[6] >= 1 && val[6] <= 12 && ser.every(x => x <= 99),
    };
  }

  // tmave(i, j) → true, pokud buňka (globální souřadnice složky) leží pod tmavým tiskem: tam smí tečka chybět
  // a lze ji doplnit podle parity (nejvýš 2 doplněné tečky na okno).
  function xeroxHledej(sl, tmave) {
    const { G, W, H } = sl, hlasy = new Map(), bity = new Uint8Array(120);
    ORIENTACE.forEach((o) => {
      for (let oj = -2; oj + o.h <= H + 2; oj++) for (let ii = -2; ii + o.w <= W + 2; ii++) {   // okno smí přesahovat (krajní tečka může chybět)
        const spatneS = [];
        for (let c = 0; c < 15 && spatneS.length <= 2; c++) {          // parita sloupců (lichá)
          let k = 0;
          for (let r = 0; r < 8; r++) { const [di, dj] = o.mapa[r * 15 + c]; const x = ii + di, y = oj + dj; k += bity[r * 15 + c] = x >= 0 && y >= 0 && x < W && y < H ? G[y * W + x] : 0; }
          if (!(k & 1)) spatneS.push(c);
        }
        if (spatneS.length > 2 || (spatneS.length && !tmave)) continue;
        const spatneR = [];
        for (let r = 1; r < 8; r++) { let k = 0; for (let c = 0; c < 15; c++) k += bity[r * 15 + c]; if (!(k & 1)) spatneR.push(r); }
        if (spatneR.length > spatneS.length) continue;
        let doplneno = 0;
        if (spatneS.length) {
          // možná rozmístění chybějících teček do řad: vadné řady + horní paritní řada (0), u dvou teček i obě v téže řadě
          const moznosti = [];
          if (spatneS.length === 1) moznosti.push([spatneR.length ? spatneR[0] : 0]);
          else if (spatneR.length === 2) moznosti.push(spatneR, [spatneR[1], spatneR[0]]);
          else if (spatneR.length === 1) moznosti.push([spatneR[0], 0], [0, spatneR[0]]);
          else for (let r = 0; r < 8; r++) moznosti.push([r, r]);
          const platne = moznosti.filter(rr => spatneS.every((c, k) => {
            if (bity[rr[k] * 15 + c]) return false;
            const [di, dj] = o.mapa[rr[k] * 15 + c];
            return tmave(sl.imin + ii + di, sl.jmin + oj + dj);
          }));
          if (platne.length !== 1) continue;                     // nejednoznačné nebo nemožné
          spatneS.forEach((c, k) => { bity[platne[0][k] * 15 + c] = 1; });
          doplneno = spatneS.length;
        }
        const val = xeroxHodnoty(bity), dek = xeroxDekoduj(val);
        if (!dek.platne) continue;
        const klic = val.join(',');
        let h = hlasy.get(klic);
        if (!h) hlasy.set(klic, h = { val, ...dek, orientace: o.nazev, pocet: 0, presne: 0, mista: [], bity: Uint8Array.from(bity) });
        h.pocet++; if (!doplneno) h.presne++;
        if (h.mista.length < 60) h.mista.push({ i: sl.imin + ii, j: sl.jmin + oj, w: o.w, h: o.h, doplneno });
      }
    });
    return [...hlasy.values()];
  }

  // kandidát přiložený na složku: nejlepší poloha (ii, oj), kolik teček vysvětlí a kolik je v rozporu.
  // vahaRozporu: 3 = přísné ověření, 1 = jen zarovnání (pro skládání)
  function xeroxPriloz(bity, o, sl, tmave, vahaRozporu = 3) {
    const { G, W, H } = sl;
    let best = { shoda: 0, rozpor: 1e9, ii: 0, oj: 0, chybi: 0 };
    for (let oj = -2; oj + o.h <= H + 2; oj++) for (let ii = -2; ii + o.w <= W + 2; ii++) {
      let shoda = 0, rozpor = 0, chybi = 0;
      for (let k = 0; k < 120; k++) {
        const [di, dj] = o.mapa[k], x = ii + di, y = oj + dj;
        const g = x >= 0 && y >= 0 && x < W && y < H ? G[y * W + x] : 0;
        if (g && bity[k]) shoda++;
        else if (g && !bity[k]) rozpor++;                                   // tečka navíc
        else if (!g && bity[k]) {
          if (tmave && !tmave(sl.imin + x, sl.jmin + y)) rozpor++;           // chybí na světlém papíře
          else chybi++;                                                      // zakrytá tiskem
        }
      }
      if (shoda - vahaRozporu * rozpor > best.shoda - vahaRozporu * best.rozpor) best = { shoda, rozpor, ii, oj, chybi };
    }
    return best;
  }

  // složení kódu ze všech výskytů: kandidát zarovná každou složku, o buňce rozhodne hlasování
  // (vidět tečka × prázdný světlý papír; buňky pod tmavým tiskem nehlasují)
  function xeroxSloz(h, sl, tm) {
    const o = ORIENTACE.find(x => x.nazev === h.orientace), ano = new Int32Array(120), ne = new Int32Array(120);
    let pouzito = 0;
    sl.forEach(s => {
      if (s.pocet < 15) return;
      const p = xeroxPriloz(h.bity, o, s, tm(s), 1);
      if (p.shoda < 15 || p.rozpor > 6) return;
      pouzito++;
      const t = tm(s);
      for (let k = 0; k < 120; k++) {
        const [di, dj] = o.mapa[k], x = p.ii + di, y = p.oj + dj;
        const g = x >= 0 && y >= 0 && x < s.W && y < s.H ? s.G[y * s.W + x] : 0;
        if (g) ano[k]++; else if (!t || !t(s.imin + x, s.jmin + y)) ne[k]++;
      }
    });
    if (pouzito < 2) return null;
    const bity = new Uint8Array(120);
    for (let k = 0; k < 120; k++) bity[k] = ano[k] > ne[k] ? 1 : 0;
    if (!xeroxParita(bity).ok) return null;
    const val = xeroxHodnoty(bity), dek = xeroxDekoduj(val);
    if (!dek.platne) return null;
    return { val, ...dek, orientace: h.orientace, pocet: 0, presne: 0, mista: [], bity, slozeno: pouzito };
  }

  // ověření kandidáta na všech složkách: podpora = složky vysvětlené bez rozporu; místa výskytů pro kreslení
  function xeroxOver(h, sl, tm) {
    const o = ORIENTACE.find(x => x.nazev === h.orientace);
    h.podpora = 0; h.skore = 0;
    const mista = [];
    sl.forEach((s, k) => {
      if (s.pocet < 15) return;
      const p = xeroxPriloz(h.bity, o, s, tm(s));
      if (p.rozpor === 0 && p.shoda >= 15) {
        h.podpora++;
        if (mista.length < 200) mista.push({ i: s.imin + p.ii, j: s.jmin + p.oj, w: o.w, h: o.h, doplneno: p.chybi, slozka: k });
      }
      h.skore += Math.max(0, p.shoda - 3 * p.rozpor);
    });
    if (mista.length) h.mista = mista;
  }

  function xeroxVsechny(sl, tmaveFn) {
    const vse = new Map(), tm = s => tmaveFn && ((i, j) => tmaveFn(s, i, j));
    sl.forEach((s, k) => xeroxHledej(s, tm(s)).forEach(h => {
      h.mista.forEach(mi => { mi.slozka = k; });
      const klic = h.val.join(','), b = vse.get(klic);
      if (b) { b.pocet += h.pocet; b.presne += h.presne; b.mista.push(...h.mista.slice(0, 60 - b.mista.length)); } else vse.set(klic, h);
    }));
    const kand = [...vse.values()].sort((a, b) => b.pocet - a.pocet).slice(0, 20);
    kand.forEach(h => xeroxOver(h, sl, tm));
    kand.sort((a, b) => b.podpora - a.podpora || b.skore - a.skore || b.pocet - a.pocet);
    // složené čtení (doplní buňky, které v žádném jednotlivém okně nebyly vidět všechny najednou)
    for (let kolo = 0; kolo < 2 && kand.length; kolo++) {
      const sloz = xeroxSloz(kand[0], sl, tm);
      if (!sloz) break;
      const klic = sloz.val.join(','), byl = kand.find(h => h.val.join(',') === klic);
      if (byl) { byl.slozeno = sloz.slozeno; break; }
      xeroxOver(sloz, sl, tm);
      kand.push(sloz);
      kand.sort((a, b) => b.podpora - a.podpora || b.skore - a.skore || b.pocet - a.pocet);
    }
    // jistota: vysoká jen s přesně přečteným oknem, nebo s jasným náskokem před dalším kandidátem
    kand.forEach((h, n) => {
      const dalsi = n === 0 ? kand[1] : kand[0], naskok = !dalsi || dalsi.skore < 0.85 * h.skore;
      h.jistota = h.podpora >= 3 && (h.presne >= 1 || naskok) && (n === 0 || h.presne >= 1) ? 'vysoká'
        : (h.podpora >= 2 && naskok) || h.presne >= 2 ? 'střední' : 'nízká';
    });
    return kand;
  }

  function xeroxMatice({ minuta = 0, hodina = 0, den = 1, mesic = 1, rok = 0, serie = '00000000', sloupec15 = 0 }) {
    const val = new Array(15).fill(0), s = String(serie).replace(/\D/g, '').padStart(8, '0').slice(-8);
    val[1] = minuta; val[4] = hodina; val[5] = den; val[6] = mesic; val[7] = rok % 100; val[9] = 127; val[14] = sloupec15;
    [13, 12, 11, 10].forEach((c, k) => { val[c] = +s.slice(2 * k, 2 * k + 2); });
    const b = new Uint8Array(120);
    for (let c = 1; c < 15; c++) for (let r = 1; r < 8; r++) b[r * 15 + c] = (val[c] >> (7 - r)) & 1;
    for (let r = 1; r < 8; r++) { let k = 0; for (let c = 1; c < 15; c++) k += b[r * 15 + c]; b[r * 15] = (k & 1) ? 0 : 1; }
    for (let c = 0; c < 15; c++) { let k = 0; for (let r = 1; r < 8; r++) k += b[r * 15 + c]; b[c] = (k & 1) ? 0 : 1; }
    return b;
  }

  // ---------- 6) obecná perioda (pro vzory jiných výrobců) ----------
  // perioda složky; když vodorovná chybí (zkosený vzor otočený o 90°), zkusí se svislá → transponovano
  function perioda(sl, maxS = 48) {
    const p = periodaG(sl.G, sl.W, sl.H, maxS);
    if (p && p.dlazdice) return p;
    const T = new Uint8Array(sl.W * sl.H);
    for (let j = 0; j < sl.H; j++) for (let i = 0; i < sl.W; i++) T[i * sl.H + j] = sl.G[j * sl.W + i];
    const q = periodaG(T, sl.H, sl.W, maxS);
    return q && q.dlazdice ? { ...q, transponovano: true } : p;
  }

  function periodaG(G, W, H, maxS) {
    const body = []; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (G[j * W + i]) body.push(i, j);
    if (body.length < 40) return null;
    const skore = (di, dj) => {
      let shoda = 0, n = 0;
      for (let k = 0; k < body.length; k += 2) {
        const i = body[k] + di, j = body[k + 1] + dj;
        if (i < 0 || j < 0 || i >= W || j >= H) continue;
        n++; shoda += G[j * W + i];
      }
      return n >= 20 ? shoda / n : 0;
    };
    let s1 = null, s2 = null;
    for (let a = 2; a <= Math.min(maxS, W - 2) && !s1; a++) { const sc = skore(a, 0); if (sc >= 0.6) s1 = { a, sc }; }
    if (!s1) return null;
    for (let b = 2; b <= Math.min(maxS, H - 2) && !s2; b++) {
      let best = null;
      for (let c = 0; c < s1.a; c++) { const sc = skore(c, b); if (sc >= 0.6 && (!best || sc > best.sc)) best = { b, c, sc }; }
      s2 = best;
    }
    if (!s2) return { a: s1.a, skoreA: s1.sc };
    const { a } = s1, { b, c } = s2, jedn = new Float32Array(a * b), vse = new Float32Array(a * b);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const kk = Math.floor(j / b), jj = j - kk * b, ii = ((i - kk * c) % a + a) % a;
      vse[jj * a + ii]++; jedn[jj * a + ii] += G[j * W + i];
    }
    let max = 0; const pomer = new Float32Array(a * b);
    for (let k = 0; k < a * b; k++) { pomer[k] = vse[k] ? jedn[k] / vse[k] : 0; max = Math.max(max, pomer[k]); }
    const dlazdice = new Uint8Array(a * b); for (let k = 0; k < a * b; k++) dlazdice[k] = pomer[k] >= 0.5 * max ? 1 : 0;
    return { a, b, c, skoreA: s1.sc, skoreB: s2.sc, dlazdice, pomer };
  }

  // ---------- 7) celý rozbor ----------
  // rozbor nad hotovým seznamem teček; tmaveXY(x, y) = leží bod obrazu pod tmavým tiskem?
  function rozborTecek(tecky, tmaveXY) {
    const vysl = { mrizka: null, sl: null, xerox: [], perioda: null };
    if (tecky.length < 20) return vysl;
    const m = vysl.mrizka = odhadniMrizku(tecky);
    if (!m) return vysl;
    vysl.sl = slozky(tecky, m);
    vysl.xerox = xeroxVsechny(vysl.sl.slozky, (sl, i, j) => { const p = bunkaNaObraz(sl, m, i, j); return tmaveXY(p.x, p.y); });
    if (vysl.sl.slozky.length) vysl.perioda = perioda(vysl.sl.slozky[0]);
    return vysl;
  }

  function rozbor(data, w, h, o = {}) {
    const t = najdiTecky(data, w, h, o);
    return { ...t, ...rozborTecek(t.tecky, (px, py) => {
      const x = Math.round(px), y = Math.round(py);
      if (x < 0 || y < 0 || x >= w || y >= h) return true;
      const k = (y * w + x) * 4;
      return data[k] + data[k + 1] + data[k + 2] < 3 * 150;
    }) };
  }

  // Celá stránka po pruzích (šetří paměť): ctiPruh(y0, y1) → RGBA řádků y0…y1-1 o šířce w.
  // prubeh(podil) se volá po každém pruhu (await – UI se může překreslit). Vrací i mapu jasu (pro „tmavé pod tečkou").
  async function rozborPruhy(ctiPruh, w, h, o = {}, prubeh) {
    const r = Math.max(4, Math.round(10 * (o.dpi || 600) / 600)), okraj = r + 8;
    const pruh = Math.max(64, Math.floor((o.pruhPx || 6e6) / w));
    const jas = new Uint8Array(w * h), tecky = [], prahy = [], sigmy = [];
    let zahozeno = 0;
    for (let y = 0; y < h; y += pruh) {
      const y0 = Math.max(0, y - okraj), y1 = Math.min(h, y + pruh + okraj), hh = y1 - y0, data = ctiPruh(y0, y1);
      for (let yy = y; yy < Math.min(h, y + pruh); yy++) {
        const zd = (yy - y0) * w * 4, cil = yy * w;
        for (let x = 0, k = zd; x < w; x++, k += 4) jas[cil + x] = (data[k] + data[k + 1] + data[k + 2]) / 3;
      }
      const t = najdiTecky(data, w, hh, o);
      for (const tk of t.tecky) {
        const ty = tk.y + y0;
        if (ty >= y && ty < y + pruh && tecky.length < 200000) { tk.y = ty; tecky.push(tk); }
      }
      zahozeno += t.zahozeno; prahy.push(t.prah); sigmy.push(t.sigma);
      if (prubeh) await prubeh(Math.min(1, (y + pruh) / h));
    }
    const med = a => a.slice().sort((p, q) => p - q)[a.length >> 1] || 0;
    const tmaveXY = (px, py) => {
      const x = Math.round(px), y = Math.round(py);
      return x < 0 || y < 0 || x >= w || y >= h || jas[y * w + x] < 150;
    };
    return { tecky, zahozeno, prah: med(prahy), sigma: med(sigmy), jas, ...rozborTecek(tecky, tmaveXY) };
  }

  // ---------- porovnání výtisků ----------
  // bit dlaždice periody v libovolném bodě mřížky (dlaždice s posunem řad c)
  function bitDlazdice(p, i, j) {
    const kk = Math.floor(j / p.b), jj = j - kk * p.b, ii = ((i - kk * p.c) % p.a + p.a) % p.a;
    return p.dlazdice[jj * p.a + ii];
  }
  // podobnost dvou dlaždic 0–1 (Jaccard) přes všechny posuny a 8 orientací listu (otočení o 90°/180°, zrcadlo)
  const TRANSFORMACE = [
    (i, j) => [i, j], (i, j) => [-i, -j], (i, j) => [j, -i], (i, j) => [-j, i],
    (i, j) => [-i, j], (i, j) => [i, -j], (i, j) => [j, i], (i, j) => [-j, -i],
  ];
  function podobnostDlazdic(p1, p2) {
    if (!p1 || !p2 || !p1.dlazdice || !p2.dlazdice || p1.a * p1.b !== p2.a * p2.b) return { podobnost: 0 };
    let best = { podobnost: 0 };
    TRANSFORMACE.forEach((T, t) => {
      for (let dj = 0; dj < p2.b; dj++) for (let di = 0; di < p2.a; di++) {
        let obe = 0, aspon = 0;
        for (let j = 0; j < p1.b; j++) for (let i = 0; i < p1.a; i++) {
          const [x, y] = T(i, j), A = bitDlazdice(p1, i, j), B = bitDlazdice(p2, x + di, y + dj);
          if (A && B) obe++; if (A || B) aspon++;
        }
        const pd = aspon ? obe / aspon : 0;
        if (pd > best.podobnost) best = { podobnost: pd, di, dj, otoc: t > 0 || !!p1.transponovano !== !!p2.transponovano, transformace: t };
      }
    });
    return best;
  }

  // parita okna Xerox: které sloupce / řady (1–7) mají sudý počet teček
  function xeroxParita(bity) {
    const sloupce = [], radky = [];
    for (let c = 0; c < 15; c++) { let k = 0; for (let r = 0; r < 8; r++) k += bity[r * 15 + c]; sloupce.push(!!(k & 1)); }
    for (let r = 0; r < 8; r++) { let k = 0; for (let c = 0; c < 15; c++) k += bity[r * 15 + c]; radky.push(r === 0 || !!(k & 1)); }
    return { sloupce, radky, ok: sloupce.every(Boolean) && radky.every(Boolean) };
  }

  // ---------- 8) zvýraznění a vyčištění ----------
  function zvyrazni(d, prah, w, h) {
    const out = new Uint8ClampedArray(w * h * 4), k = 200 / Math.max(1, prah);
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      const v = 255 - Math.max(0, d[i]) * k;
      out[p] = v; out[p + 1] = v; out[p + 2] = Math.min(255, v + 40); out[p + 3] = 255;
    }
    return out;
  }

  // neutralizuje žlutý nádech v okolí teček (modrý kanál = průměr R,G); vrací počet upravených pixelů
  function vycisti(data, d, prah, w, h) {
    const n = w * h, m = new Uint8Array(n);
    for (let i = 0, k = 0; i < n; i++, k += 4) if (d[i] > prah * 0.35 && data[k] + data[k + 1] > 220) m[i] = 1;
    let zmen = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let hit = 0;
      for (let dy = -2; dy <= 2 && !hit; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx]) { hit = 1; break; }
      }
      if (!hit) continue;
      const k = (y * w + x) * 4, rg = (data[k] + data[k + 1]) >> 1;
      if (data[k + 2] < rg) { data[k + 2] = rg; zmen++; }
    }
    return zmen;
  }

  // ---------- 9) zkušební „sken" s tečkami Xerox ----------
  function nahoda(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  function ukazka(o = {}) {
    const w = o.w || 1600, h = o.h || 1200, rnd = nahoda(o.seed || 7), data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { const z = 246 + rnd() * 8; data[i * 4] = z; data[i * 4 + 1] = z; data[i * 4 + 2] = z - 2; data[i * 4 + 3] = 255; }
    const obdelnik = (x0, y0, x1, y1, r, gg, b) => {
      for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
        const k = (y * w + x) * 4; data[k] = r; data[k + 1] = gg; data[k + 2] = b;
      }
    };
    // „text": řádky tmavých slov
    for (let y = 90; y < h - 60; y += 46) {
      if (rnd() < 0.25) continue;
      let x = 80 + rnd() * 40;
      while (x < w - 120) { const dl = 25 + rnd() * 90; obdelnik(x | 0, y, (x + dl) | 0, y + 18, 30, 30, 34); x += dl + 14; }
    }
    obdelnik(w - 260, 40, w - 60, 140, 245, 215, 40);           // žluté logo – nesmí se plést s tečkami
    const bity = xeroxMatice(o.kod || {}), p = o.roztec || 14, uhel = (o.uhel ?? 0.35) * Math.PI / 180;
    const cu = Math.cos(uhel), su = Math.sin(uhel), tecka = (x, y) => {
      for (let yy = Math.floor(y - 3); yy <= y + 3; yy++) for (let xx = Math.floor(x - 3); xx <= x + 3; xx++) {
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const a = Math.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * 1.1 * 1.1)), k = (yy * w + xx) * 4;
        if (data[k] < 120) continue;                                  // pod černým tiskem tečka není vidět
        data[k + 1] -= a * 10; data[k + 2] -= a * 95;
      }
    };
    const tw = o.otocit ? 8 : 15, th = o.otocit ? 15 : 8;
    for (let ty = 0; ty * (th + 6) * p < h + 200; ty++) for (let tx = 0; tx * (tw + 5) * p < w + 200; tx++) {
      const ox = tx * (tw + 5) * p + (ty % 2) * 2.3 * p + (rnd() - 0.5) * 0.8 * p, oy = ty * (th + 6) * p + (rnd() - 0.5) * 0.8 * p;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 15; c++) {
        if (!bity[r * 15 + c]) continue;
        const [i, j] = o.otocit ? [7 - r, c] : [c, r];
        const X = ox + i * p - 100, Y = oy + j * p - 100;
        tecka(X * cu - Y * su + 40, X * su + Y * cu + 30);
      }
    }
    return { w, h, data };
  }

  const MIC = { zlutostRozdil, najdiTecky, rozborTecek, rozborPruhy, bitDlazdice, podobnostDlazdic, xeroxParita, odhadniMrizku, slozky, bunkaNaObraz, xeroxHledej, xeroxVsechny, xeroxMatice, xeroxDekoduj, xeroxHodnoty, perioda, rozbor, zvyrazni, vycisti, ukazka, ORIENTACE };
  if (typeof module !== 'undefined' && module.exports) module.exports = MIC; else g.MIC = MIC;
})(typeof window !== 'undefined' ? window : globalThis);
