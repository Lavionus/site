/* ============================================================
   jadro.js – výpočetní jádro stránky „Světelné znečištění a tmavá
   obloha“ (obsah/svetelne_znecisteni.html). Bez DOM; běží
   v prohlížeči, ve web workeru i v node (testy).

   MODEL ODHADU JASU OBLOHY (orientační, NE měření):
   1) Vstup: denní radiance VIIRS DNB „Gap-Filled BRDF Corrected“
      (NASA Black Marble VNP46A2 přes NASA GIBS), dlaždice
      GoogleMapsCompatible z7 (~0,8 km/px na 50° s. š.). Barva
      dlaždice je šedá stupnice; převod šedi na nW/(cm²·sr) podle
      oficiální barevné mapy GIBS „VIIRS_DayNightBand_At_Sensor_Radiance“
      (180 tříd 0–38,2; nad 38,2 je saturace = podhodnocení center měst).
   2) Medián po pixelech z několika nocí (potlačí mraky, šum, ozáření).
   3) Odečtení podlahy 0,25 nW/(cm²·sr) (šum + airglow + odraz).
   4) Šíření do zenitu: umělý jas b = C · Σ R_i · A_i · K(d_i),
      K(d) = (d² + d0²)^(−1,25) – Walkerův zákon (jas ∝ d^−2,5),
      d0 = 2 km změkčuje blízké okolí, d ≤ 150 km.
   5) C nastaveno tak, aby model co nejlépe seděl na orientační
      zenitové hodnoty SQM 9 míst v ČR (Praha, Brno, Ostrava, Plzeň,
      Ondřejov, Jizerka, Manětín, Beskydy, Kvilda): RMS 0,14 mag.
      Kalibrační hodnoty jsou samy přibližné (±0,2–0,3 mag), proto
      stránka uvádí nejistotu ±0,5 mag/arcsec².
   6) Celkový jas = přirozený 22,0 mag/arcsec² (0,171 mcd/m²) + umělý.
   ============================================================ */
(function (koren) {
  'use strict';

  /* ---------- převod šedi dlaždice GIBS na radianci ---------- */
  // šedé úrovně a dolní meze tříd z colormapy GIBS v1.3 (třída [LO_i, LO_{i+1}))
  const SEDI = [7,13,19,24,29,33,37,41,45,48,52,55,58,61,64,67,69,72,74,77,79,81,83,85,87,89,91,93,95,96,98,100,101,103,105,106,108,109,111,112,113,115,116,117,118,120,121,122,123,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255];
  const DOLNI = [0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1,1.1,1.2,1.3,1.4,1.5,1.6,1.7,1.8,1.9,2,2.1,2.2,2.3,2.4,2.5,2.6,2.7,2.8,2.9,3,3.1,3.2,3.3,3.4,3.5,3.6,3.7,3.8,3.9,4,4.1,4.2,4.3,4.4,4.5,4.6,4.7,4.8,4.9,5,5.1,5.2,5.3,5.4,5.5,5.6,5.7,5.8,5.9,6,6.1,6.2,6.3,6.4,6.5,6.6,6.7,6.8,7,7.1,7.2,7.3,7.4,7.6,7.7,7.8,7.9,8.1,8.2,8.3,8.5,8.6,8.8,8.9,9,9.2,9.3,9.5,9.6,9.8,10,10.1,10.3,10.4,10.6,10.8,11,11.1,11.3,11.5,11.7,11.8,12,12.2,12.4,12.6,12.8,13,13.2,13.4,13.6,13.9,14.1,14.3,14.5,14.7,15,15.2,15.4,15.7,15.9,16.2,16.4,16.7,16.9,17.2,17.5,17.7,18,18.3,18.6,18.8,19.1,19.4,19.7,20,20.3,20.7,21,21.3,21.6,21.9,22.3,22.6,23,23.3,23.7,24,24.4,24.8,25.1,25.5,25.9,26.3,26.7,27.1,27.5,27.9,28.3,28.8,29.2,29.6,30.1,30.5,31,31.5,31.9,32.4,32.9,33.4,33.9,34.4,34.9,35.5,36,36.5,37.1,37.6,38.2];
  const SATURACE = 38.2;
  // LUT[šeď] = radiance (střed třídy); šedi mimo seznam → nejbližší nižší třída. Index 0 = bez dat (NaN).
  const LUT = new Float32Array(256);
  (function () {
    let j = 0;
    for (let g = 0; g < 256; g++) {
      while (j + 1 < SEDI.length && SEDI[j + 1] <= g) j++;
      const lo = DOLNI[j], hi = j + 1 < DOLNI.length ? DOLNI[j + 1] : SATURACE;
      LUT[g] = g < SEDI[0] ? 0 : (j === SEDI.length - 1 ? SATURACE : (lo + hi) / 2);
    }
    LUT[0] = NaN;
  })();
  /* pixel RGBA dlaždice → kód šedi (0 = bez dat). Průhledný pixel = bez dat. */
  const kodPixelu = (r, g, b, a) => (a < 128 ? 0 : Math.max(1, r));

  /* ---------- konstanty modelu ---------- */
  const MODEL = {
    D0_KM: 2, R_MAX_KM: 150, PODLAHA: 0.25,
    C: Math.pow(10, -1.275),          // mcd/m² na (nW/(cm² sr) · km² · km^-2,5)
    PRIROZENY_MCD: 0.171,             // 22,0 mag/arcsec² (Falchi et al. 2016: 174 µcd/m²)
    NEJISTOTA_MAG: 0.5,
    ZOOM: 7,
    KALIBRACE: [                      // orientační zenitové SQM (mag/arcsec²), viz README v hlavičce
      ['Praha, Václavské nám.', 50.0815, 14.4280, 17.6], ['Brno, centrum', 49.1951, 16.6068, 18.2],
      ['Ostrava, centrum', 49.835, 18.29, 18.3], ['Plzeň, centrum', 49.747, 13.378, 18.4],
      ['Ondřejov', 49.9106, 14.7808, 20.3], ['Jizerka', 50.8186, 15.3463, 21.5],
      ['Manětín', 49.99, 13.23, 21.3], ['Beskydy, Bílá', 49.445, 18.456, 21.3], ['Kvilda', 49.02, 13.58, 21.6],
    ],
  };
  const jadro = (d, d0 = MODEL.D0_KM) => Math.pow(d * d + d0 * d0, -1.25);
  // aproximace K(d) součtem Gaussiánů w·exp(−d²/2σ²) (σ v km) – NNLS fit, max. rel. chyba 4 % pro d ≤ 150 km
  const GAUSS = [[1.2, 0.0966259], [2, 0.0426506], [3.2, 0.0202272], [5, 0.0066942], [8, 0.0024057],
    [13, 0.0007483], [21, 0.0002019], [34, 0.0000787], [55, 0.00001], [90, 0.000013]];
  const jadroGauss = d => GAUSS.reduce((s, [sg, w]) => s + w * Math.exp(-d * d / (2 * sg * sg)), 0);

  /* ---------- jas ↔ magnituda ---------- */
  // L [cd/m²] = 108 000 · 10^(−0,4 m)  ⇒  m = 20,0836 − 2,5·log10(L [mcd/m²])
  const mcdNaMag = mcd => 20.0836 - 2.5 * Math.log10(mcd);
  const magNaMcd = m => Math.pow(10, (20.0836 - m) / 2.5);

  /* ---------- Bortle (orientační převod) ---------- */
  // SQM meze podle převodní tabulky lightpollutionmap.info (J. Stare); Bortle (2001) třídy definoval
  // vizuálními kritérii, ne SQM – různé zdroje se v mezích liší o 0,2–0,5 mag.
  const BORTLE = [
    { t: 1, od: 21.99, nazev: 'Vynikající tmavá obloha', mhv: '7,6–8,0', popis: 'Zodiakální světlo a gegenschein výrazné, Mléčná dráha vrhá znatelný svit; airglow viditelný u obzoru.' },
    { t: 2, od: 21.89, nazev: 'Typická skutečně tmavá obloha', mhv: '7,1–7,5', popis: 'Mléčná dráha s detaily jako mramor, zodiakální světlo vrhá slabé stíny; žádné světelné kupole.' },
    { t: 3, od: 21.69, nazev: 'Venkovská obloha', mhv: '6,6–7,0', popis: 'Mléčná dráha stále složitá, u obzoru slabé světelné kupole; M33 viditelná přímým pohledem.' },
    { t: 4, od: 20.49, nazev: 'Přechod venkov/předměstí', mhv: '6,1–6,5', popis: 'Světelné kupole v několika směrech, Mléčná dráha výrazná jen vysoko nad obzorem.' },
    { t: 5, od: 19.50, nazev: 'Předměstská obloha', mhv: '5,6–6,0', popis: 'Mléčná dráha slabá, u obzoru vymytá; zodiakální světlo jen náznakem za nejlepších nocí.' },
    { t: 6, od: 18.94, nazev: 'Jasná předměstská obloha', mhv: '5,1–5,5', popis: 'Mléčná dráha jen v zenitu, obloha do 35° nad obzorem šedavě svítí.' },
    { t: 7, od: 18.38, nazev: 'Přechod předměstí/město', mhv: '4,6–5,0', popis: 'Celá obloha šedobílá, Mléčná dráha neviditelná; M31 a M44 jen na hranici.' },
    { t: 8, od: -Infinity, nazev: 'Městská obloha (třídy 8–9)', mhv: '≤ 4,5', popis: 'Obloha oranžově šedá, viditelné jen nejjasnější hvězdy a planety. Třídy 8 a 9 nelze ze SQM spolehlivě oddělit.' },
  ];
  function bortleZMag(m) {
    if (!Number.isFinite(m)) return null;
    for (const b of BORTLE) if (m >= b.od) return b.t;
    return 8;
  }
  const bortleRozsah = (mMin, mMax) => {
    const a = bortleZMag(mMax), b = bortleZMag(mMin);   // tmavší (vyšší mag) = nižší třída
    return a === b ? [a] : [a, b];
  };
  const textBortle = t => t === 8 ? '8–9' : String(t);

  /* ---------- souřadnice Web Mercator (pixely na zoomu z, dlaždice 256) ---------- */
  const MAX_LAT = 85.05112878;
  function lonNaX(lon, z) { return (lon + 180) / 360 * 256 * Math.pow(2, z); }
  function latNaY(lat, z) {
    const f = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI / 180;
    return (1 - Math.log(Math.tan(f) + 1 / Math.cos(f)) / Math.PI) / 2 * 256 * Math.pow(2, z);
  }
  function xNaLon(x, z) { return x / (256 * Math.pow(2, z)) * 360 - 180; }
  function yNaLat(y, z) { const n = Math.PI - 2 * Math.PI * y / (256 * Math.pow(2, z)); return Math.atan(Math.sinh(n)) * 180 / Math.PI; }
  const pixelKm = (lat, z) => 40075.016686 * Math.cos(lat * Math.PI / 180) / (256 * Math.pow(2, z));
  /* dlaždice potřebné pro bod: okraj m dlaždic tak, aby pokryl R_MAX */
  function dlazdiceKolem(lat, lon, z = MODEL.ZOOM, R = MODEL.R_MAX_KM) {
    const X = lonNaX(lon, z), Y = latNaY(lat, z), tx = Math.floor(X / 256), ty = Math.floor(Y / 256);
    const m = Math.max(1, Math.ceil(R / pixelKm(lat, z) / 256));
    const n = Math.pow(2, z), seznam = [];
    for (let j = -m; j <= m; j++) for (let i = -m; i <= m; i++) {
      const y = ty + j; if (y < 0 || y >= n) { seznam.push(null); continue; }
      seznam.push({ z, x: ((tx + i) % n + n) % n, y, i: i + m, j: j + m });
    }
    return { X, Y, tx, ty, m, strana: 2 * m + 1, seznam };
  }

  /* ---------- medián po pixelech (vstup: kódy šedi Uint8, 0 = bez dat) ----------
     výstup: radiance nad podlahou (Float32, bez dat = 0); u sudého počtu průměr dvou prostředních */
  function medianRadiance(pole, n, podlaha = MODEL.PODLAHA) {
    const r = new Float32Array(n), buf = new Uint8Array(Math.max(1, pole.length));
    let bezDat = 0, saturovano = 0;
    for (let p = 0; p < n; p++) {
      let k = 0;
      for (const a of pole) { if (!a) continue; const v = a[p]; if (v) buf[k++] = v; }
      if (!k) { bezDat++; continue; }
      for (let i = 1; i < k; i++) { const v = buf[i]; let j = i - 1; while (j >= 0 && buf[j] > v) { buf[j + 1] = buf[j]; j--; } buf[j + 1] = v; }
      const med = k % 2 ? LUT[buf[(k - 1) >> 1]] : (LUT[buf[(k >> 1) - 1]] + LUT[buf[k >> 1]]) / 2;
      if (med >= SATURACE) saturovano++;
      r[p] = Math.max(0, med - podlaha);
    }
    return { r, bezDat, saturovano };
  }

  /* ---------- přímý součet pro bod ---------- */
  // R: Float32 radiance (w×h), (cx, cy) pozice bodu v pixelech mozaiky, px = velikost pixelu (km)
  function umelyJasBodu(R, w, h, cx, cy, px, opt = {}) {
    const d0 = opt.d0 ?? MODEL.D0_KM, Rmax = opt.rMax ?? MODEL.R_MAX_KM, C = opt.C ?? MODEL.C;
    const rp = Rmax / px, A = px * px;
    const y0 = Math.max(0, Math.floor(cy - rp)), y1 = Math.min(h - 1, Math.ceil(cy + rp));
    const x0 = Math.max(0, Math.floor(cx - rp)), x1 = Math.min(w - 1, Math.ceil(cx + rp));
    let s = 0, blizko = 0;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) * px, dy2 = dy * dy;
      for (let x = x0; x <= x1; x++) {
        const v = R[y * w + x]; if (!v) continue;
        const dx = (x + 0.5 - cx) * px, d2 = dx * dx + dy2;
        if (d2 > Rmax * Rmax) continue;
        const k = v * A * Math.pow(d2 + d0 * d0, -1.25);
        s += k; if (d2 < 100) blizko += k;
      }
    }
    return { mcd: C * s, podilDo10km: s > 0 ? blizko / s : 0 };
  }

  /* ---------- pole jasu (vrstva) součtem rozmazání Gaussiány ---------- */
  function gaussKernel1D(sig) {
    const r = Math.max(1, Math.ceil(3.5 * sig)), k = new Float32Array(2 * r + 1);
    let s = 0;
    for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * sig * sig)); s += k[i + r]; }
    return { k, r, s };                      // s = Σ_k exp(−k²/2σ²) (nenormováno)
  }
  // jedno průchod krabicovým filtrem (poloměr r) po řádcích, nuly mimo okraj; výsledek / (2r+1)
  function boxRadky(src, dst, w, h, r) {
    const n = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const o = y * w; let acc = 0;
      for (let x = -r; x <= r; x++) if (x >= 0 && x < w) acc += src[o + x];
      for (let x = 0; x < w; x++) {
        dst[o + x] = acc / n;
        const ven = x - r, dovnitr = x + r + 1;
        if (ven >= 0) acc -= src[o + ven];
        if (dovnitr < w) acc += src[o + dovnitr];
      }
    }
  }
  function transponuj(src, dst, w, h) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dst[x * h + y] = src[y * w + x]; }
  // poloměry tří krabic aproximujících Gauss σ (Kovesi / Ivan Kutskir)
  function krabiceProGauss(sig) {
    const wIdeal = Math.sqrt(12 * sig * sig / 3 + 1);
    let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
    const wu = wl + 2, mIdeal = (12 * sig * sig - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4), m = Math.round(mIdeal);
    return [0, 1, 2].map(i => ((i < m ? wl : wu) - 1) / 2);
  }
  function rozmazGauss(src, w, h, sig) {
    const a = new Float32Array(src), b = new Float32Array(w * h);
    if (sig < 3) {                          // přesné oddělitelné jádro
      const { k, r, s } = gaussKernel1D(sig);
      const proj = (inp, out, W, H) => {
        for (let y = 0; y < H; y++) { const o = y * W;
          for (let x = 0; x < W; x++) { let acc = 0;
            for (let i = -r; i <= r; i++) { const xx = x + i; if (xx >= 0 && xx < W) acc += inp[o + xx] * k[i + r]; }
            out[o + x] = acc / s; } }
      };
      proj(a, b, w, h); transponuj(b, a, w, h); proj(a, b, h, w); transponuj(b, a, h, w);
      return a;
    }
    const kr = krabiceProGauss(sig);
    for (const r of kr) { boxRadky(a, b, w, h, r); a.set(b); }
    transponuj(a, b, w, h);
    const c = new Float32Array(w * h);
    for (const r of kr) { boxRadky(b, c, h, w, r); b.set(c); }
    transponuj(b, a, h, w);
    return a;
  }
  /* umělý jas (mcd/m²) pro každý pixel mozaiky; px = velikost pixelu v km */
  function poleUmelehoJasu(R, w, h, px, C = MODEL.C) {
    const vys = new Float32Array(w * h), A = px * px;
    for (const [sgKm, wt] of GAUSS) {
      const sig = sgKm / px;
      let soucin, rozm;
      if (sig < 0.3) { soucin = 1; rozm = R; }             // užší než pixel – jen vlastní pixel
      else { soucin = Math.pow(gaussKernel1D(sig).s, 2); rozm = rozmazGauss(R, w, h, sig); }
      const f = C * wt * A * soucin;
      for (let i = 0; i < vys.length; i++) vys[i] += f * rozm[i];
    }
    return vys;
  }
  function orizni(pole, w, x0, y0, sw, sh) {
    const v = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) v.set(pole.subarray((y0 + y) * w + x0, (y0 + y) * w + x0 + sw), y * sw);
    return v;
  }

  /* ---------- výsledek pro uživatele ---------- */
  function vysledek(umelyMcd, opt = {}) {
    const nat = MODEL.PRIROZENY_MCD, celk = nat + Math.max(0, umelyMcd);
    const mag = mcdNaMag(celk), dm = opt.nejistota ?? MODEL.NEJISTOTA_MAG;
    const mMin = Math.max(mag - dm, 0), mMax = Math.min(mag + dm, 22.0);
    return {
      umelyMcd, celkemMcd: celk, mag, mMin, mMax, pomer: umelyMcd / nat,
      bortle: bortleZMag(mag), bortleRozsah: bortleRozsah(mMin, mMax),
    };
  }
  /* slovní kategorie podle poměru umělý/přirozený jas (Falchi et al. 2016: < 1 % = neznečištěná) */
  function kategoriePomeru(p) {
    if (p < 0.01) return 'obloha bez měřitelného umělého jasu (< 1 % přirozeného)';
    if (p < 0.08) return 'mírně ovlivněná u obzoru, zenit téměř přirozený';
    if (p < 0.5) return 'znečištěná u obzoru, zenit znatelně zjasněný';
    if (p < 3) return 'znečištěná až do zenitu';
    return 'silně znečištěná – Mléčná dráha prakticky neviditelná';
  }

  /* ---------- barevná stupnice vrstvy (mag/arcsec²) ---------- */
  const STUPNICE = [
    [22.0, [0, 0, 0, 0]], [21.9, [20, 20, 30, 40]], [21.75, [40, 40, 70, 110]], [21.5, [30, 60, 160, 150]],
    [21.25, [20, 120, 200, 160]], [21.0, [20, 160, 120, 165]], [20.6, [70, 190, 60, 170]], [20.2, [170, 210, 40, 175]],
    [19.8, [240, 220, 40, 180]], [19.4, [250, 170, 30, 185]], [19.0, [245, 110, 30, 190]], [18.6, [230, 50, 40, 195]],
    [18.2, [200, 40, 120, 200]], [17.8, [240, 140, 220, 205]], [17.0, [255, 245, 255, 210]],
  ];
  function barvaMag(m) {
    if (!Number.isFinite(m)) return [0, 0, 0, 0];
    if (m >= STUPNICE[0][0]) return STUPNICE[0][1].slice();
    for (let i = 1; i < STUPNICE.length; i++) {
      const [m1, c1] = STUPNICE[i], [m0, c0] = STUPNICE[i - 1];
      if (m >= m1) { const t = (m0 - m) / (m0 - m1); return c0.map((v, j) => Math.round(v + (c1[j] - v) * t)); }
    }
    return STUPNICE[STUPNICE.length - 1][1].slice();
  }
  // předpočtená tabulka po 0,01 mag pro 16,0–22,0
  const BARVY = (() => { const t = new Uint8ClampedArray(601 * 4); for (let i = 0; i <= 600; i++) t.set(barvaMag(16 + i / 100), i * 4); return t; })();
  function barvaRychle(m, out, o) {
    let i = Math.round((m - 16) * 100); if (i < 0) i = 0; if (i > 600) i = 600;
    out[o] = BARVY[i * 4]; out[o + 1] = BARVY[i * 4 + 1]; out[o + 2] = BARVY[i * 4 + 2]; out[o + 3] = BARVY[i * 4 + 3];
  }

  /* ---------- výběr nocí VIIRS ---------- */
  // kandidátní data (UTC 'YYYY-MM-DD'): zpoždění produktu ~2–3 dny, rozestup několik dní
  function referencniNoci(dnes, pocet = 4, krok = 5, zpozdeni = 3) {
    const d0 = Date.UTC(dnes.getUTCFullYear(), dnes.getUTCMonth(), dnes.getUTCDate());
    return Array.from({ length: pocet }, (_, i) => new Date(d0 - (zpozdeni + i * krok) * 86400000).toISOString().slice(0, 10));
  }

  /* ---------- formátování ---------- */
  const cislo = (x, des = 1) => Number.isFinite(x) ? x.toLocaleString('cs-CZ', { minimumFractionDigits: des, maximumFractionDigits: des }).replace(/ /g, ' ') : '—';
  function souradnice(lat, lon) {
    return `${cislo(Math.abs(lat), 4)}° ${lat >= 0 ? 's' : 'j'}. š., ${cislo(Math.abs(lon), 4)}° ${lon >= 0 ? 'v' : 'z'}. d.`;
  }
  function vzdalenostKm(a, b) {          // haversine, R = 6371 km
    const R = 6371, f1 = a.lat * Math.PI / 180, f2 = b.lat * Math.PI / 180;
    const df = f2 - f1, dl = (b.lon - a.lon) * Math.PI / 180;
    const h = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /* ---------- validace a export/import míst ---------- */
  function platneMisto(m) {
    return m && Number.isFinite(+m.lat) && Number.isFinite(+m.lon) && +m.lat >= -90 && +m.lat <= 90 && +m.lon >= -180 && +m.lon <= 180;
  }
  const xmlEsc = s => String(s ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  function popisMista(m) {
    const c = [];
    if (m.odhad && Number.isFinite(m.odhad.mag)) c.push(`Odhad jasu oblohy (model, ne měření): ${cislo(m.odhad.mag, 2)} ± ${cislo(MODEL.NEJISTOTA_MAG, 1)} mag/arcsec², orientačně Bortle ${m.odhad.bortleRozsah.map(textBortle).join('–')}; data VIIRS ${(m.odhad.noci || []).join(', ')}`);
    if (Number.isFinite(m.vyska)) c.push(`Nadmořská výška ${Math.round(m.vyska)} m (Copernicus DEM přes Open-Meteo)`);
    if (m.poznamka) c.push(m.poznamka);
    return c.join('. ');
  }
  function exportGpx(mista, cas = new Date()) {
    const wpt = mista.filter(platneMisto).map(m =>
      `  <wpt lat="${(+m.lat).toFixed(6)}" lon="${(+m.lon).toFixed(6)}">\n` +
      (Number.isFinite(m.vyska) ? `    <ele>${(+m.vyska).toFixed(1)}</ele>\n` : '') +
      `    <name>${xmlEsc(m.nazev || 'Místo')}</name>\n` +
      `    <desc>${xmlEsc(popisMista(m))}</desc>\n` +
      `    <sym>${m.oblibene ? 'Star' : 'Flag, Blue'}</sym>\n  </wpt>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Světelné znečištění – tmavá obloha" xmlns="http://www.topografix.com/GPX/1/1">\n` +
      `  <metadata>\n    <name>Místa k pozorování oblohy</name>\n    <desc>Odhady jasu jsou modelové (VIIRS + Walkerův zákon), nejde o měření.</desc>\n    <time>${cas.toISOString()}</time>\n  </metadata>\n${wpt}${wpt ? '\n' : ''}</gpx>\n`;
  }
  function exportJson(mista, cas = new Date()) {
    return JSON.stringify({
      format: 'webapp_svetelne_znecisteni', verze: 1, exportovano: cas.toISOString(),
      upozorneni: 'Hodnoty jasu jsou modelový odhad z družicových dat VIIRS, nikoli měření. Nejistota ±0,5 mag/arcsec².',
      mista: mista.filter(platneMisto).map(m => ({
        nazev: m.nazev || 'Místo', lat: +(+m.lat).toFixed(6), lon: +(+m.lon).toFixed(6),
        vyska: Number.isFinite(m.vyska) ? m.vyska : null, oblibene: !!m.oblibene, poznamka: m.poznamka || '',
        odhad: m.odhad ? { mag: +m.odhad.mag.toFixed(2), mMin: +m.odhad.mMin.toFixed(2), mMax: +m.odhad.mMax.toFixed(2), bortle: m.odhad.bortleRozsah, pomerUmelyPrirozeny: +m.odhad.pomer.toFixed(3), noci: m.odhad.noci || [], typ: 'modelový odhad' } : null,
      })),
    }, null, 2);
  }
  const odXml = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&').trim();
  function importText(text) {
    const t = String(text || '').trim();
    if (!t) throw new Error('Soubor je prázdný.');
    let mista = [];
    if (t[0] === '{' || t[0] === '[') {
      let j; try { j = JSON.parse(t); } catch { throw new Error('Soubor není platný JSON.'); }
      const pole = Array.isArray(j) ? j : Array.isArray(j.mista) ? j.mista : null;
      if (!pole) throw new Error('JSON neobsahuje seznam míst (pole „mista“).');
      mista = pole.map(m => ({ nazev: String(m.nazev ?? m.name ?? 'Místo').slice(0, 120), lat: +m.lat, lon: +(m.lon ?? m.lng), vyska: Number.isFinite(+m.vyska) && m.vyska !== null ? +m.vyska : undefined, oblibene: m.oblibene !== false, poznamka: String(m.poznamka ?? '').slice(0, 500) }));
    } else if (/<gpx[\s>]/i.test(t)) {
      const re = /<(wpt|rtept|trkpt)\b([^>]*)>([\s\S]*?)<\/\1>|<(wpt)\b([^>]*)\/>/gi;
      let m;
      while ((m = re.exec(t))) {
        if ((m[1] || m[4]).toLowerCase() !== 'wpt') continue;
        const atr = m[2] || m[5] || '', obsah = m[3] || '';
        const lat = /\blat\s*=\s*["']([^"']+)["']/.exec(atr), lon = /\blon\s*=\s*["']([^"']+)["']/.exec(atr);
        const tag = n => { const x = new RegExp(`<${n}>([\\s\\S]*?)</${n}>`, 'i').exec(obsah); return x ? odXml(x[1]) : ''; };
        const ele = parseFloat(tag('ele'));
        mista.push({ nazev: (tag('name') || 'Místo').slice(0, 120), lat: lat ? +lat[1] : NaN, lon: lon ? +lon[1] : NaN, vyska: Number.isFinite(ele) ? ele : undefined, oblibene: true, poznamka: '' });
      }
      if (!mista.length) throw new Error('GPX neobsahuje žádné body (wpt).');
    } else throw new Error('Neznámý formát – očekávám GPX nebo JSON.');
    const platna = mista.filter(platneMisto).map(m => ({ ...m, lat: +m.lat, lon: +m.lon }));
    return { mista: platna, vyrazeno: mista.length - platna.length };
  }

  const JADRO = {
    LUT, SEDI, DOLNI, SATURACE, kodPixelu, MODEL, jadro, GAUSS, jadroGauss, mcdNaMag, magNaMcd,
    BORTLE, bortleZMag, bortleRozsah, textBortle, lonNaX, latNaY, xNaLon, yNaLat, pixelKm, dlazdiceKolem,
    medianRadiance, umelyJasBodu, gaussKernel1D, rozmazGauss, krabiceProGauss, poleUmelehoJasu, orizni,
    vysledek, kategoriePomeru, STUPNICE, barvaMag, barvaRychle, referencniNoci, cislo, souradnice, vzdalenostKm,
    platneMisto, xmlEsc, exportGpx, exportJson, importText, popisMista,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = JADRO;
  else koren.SZ_JADRO = JADRO;
})(typeof self !== 'undefined' ? self : this);
