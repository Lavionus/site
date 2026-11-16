/* Měřáky z telefonu – jádro bez DOM (test: node _test/meraky_test.js).
   Úhly z vektoru gravitace, kalibrace, decibely, A-váhování (analogový předpis + digitální
   filtr bilineární transformací), Leq, dominantní frekvence, nota, odhad osvětlení z expozice,
   stroboskop (převody Hz/RPM, kvantování na snímky displeje). */
(function (koren) {
  'use strict';

  const RAD = 180 / Math.PI;
  const omez = (x, a, b) => Math.min(b, Math.max(a, x));

  /* ---------- vektory a úhly ----------
     Souřadnice zařízení podle W3C: x doprava, y nahoru (k horní hraně), z ven z displeje.
     u = jednotkový vektor „nahoru“ (proti gravitaci) v souřadnicích zařízení; telefon ležící
     displejem nahoru má u = (0, 0, 1) – stejně jako accelerationIncludingGravity podle specifikace. */
  function normuj(v) {
    const d = Math.hypot(v[0], v[1], v[2]);
    return d > 1e-9 ? [v[0] / d, v[1] / d, v[2] / d] : null;
  }

  /* DeviceOrientation (beta, gamma ve stupních, Eulerovy úhly Z-X'-Y'') → vektor nahoru. */
  function zOrientace(beta, gamma) {
    const b = beta / RAD, g = gamma / RAD;
    return [-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g)];
  }

  /* Znaménko accelerationIncludingGravity (některé prohlížeče na iOS ho mají obráceně):
     porovnání s vektorem z orientace. Vrací +1 / −1, bez rozhodnutí null. */
  function znamenkoGravitace(gMot, uOri) {
    const g = normuj(gMot);
    if (!g || !uOri) return null;
    const s = g[0] * uOri[0] + g[1] * uOri[1] + g[2] * uOri[2];
    return Math.abs(s) < 0.5 ? null : (s > 0 ? 1 : -1);
  }

  /* Exponenciální vyhlazení vektoru (alfa 0–1, menší = klidnější). */
  function vyhlad(pred, novy, alfa) {
    if (!pred) return novy.slice();
    return pred.map((p, i) => p + alfa * (novy[i] - p));
  }

  /* Natočení obrazovky (screen.orientation.angle 0/90/180/270): vektor do souřadnic obrazovky,
     aby bublina utíkala správným směrem i na šířku. */
  function naObrazovku(u, uhel) {
    const a = ((uhel || 0) % 360 + 360) % 360 / RAD;
    const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
    return [u[0] * c - u[1] * s, u[0] * s + u[1] * c, u[2]];
  }

  /* Telefon položený naplocho: náklon kolem obou os (stupně) a celkový náklon plochy. */
  function uhlyNaplocho(u) {
    return {
      x: Math.atan2(-u[0], u[2]) * RAD,   // kladné = pravá strana níž
      y: Math.atan2(-u[1], u[2]) * RAD,   // kladné = horní strana níž
      celkem: Math.acos(omez(Math.abs(u[2]), 0, 1)) * RAD
    };
  }

  /* Telefon postavený na hraně (lať): odchylka od nejbližší vodorovné/svislé polohy v rovině displeje.
     hrana: 0 = stojí na spodní hraně (na výšku), 1 = na levé, 2 = na horní, 3 = na pravé. */
  function uhelLat(u) {
    const fi = Math.atan2(-u[0], u[1]) * RAD;   // natočení kolem osy z
    const k = Math.round(fi / 90);
    return { uhel: fi - k * 90, hrana: ((k % 4) + 4) % 4, svislost: Math.acos(omez(Math.abs(u[2]), 0, 1)) * RAD };
  }

  /* Rozhodnutí naplocho × na hraně (s hysterezí kolem 45°). */
  function polohaTelefonu(u, predchozi) {
    const z = Math.abs(u[2]);
    if (predchozi === 'plocha') return z < 0.6 ? 'hrana' : 'plocha';
    if (predchozi === 'hrana') return z > 0.8 ? 'plocha' : 'hrana';
    return z > 0.7071 ? 'plocha' : 'hrana';
  }

  /* Sklon zvolené hrany vůči vodorovné rovině (stupně).
     'dlouha' = osa y (telefon přiložený delší hranou), 'kratka' = osa x, 'plocha' = záda telefonu. */
  function sklon(u, hrana) {
    if (hrana === 'plocha') return Math.acos(omez(Math.abs(u[2]), 0, 1)) * RAD;
    const s = hrana === 'kratka' ? u[0] : u[1];
    return Math.asin(omez(s, -1, 1)) * RAD;
  }

  /* Stupně → procenta, poměr 1 : n a zpět. */
  function stupneNaProcenta(st) {
    const a = Math.abs(st);
    return a >= 89.999 ? Infinity : Math.sign(st) * Math.tan(a / RAD) * 100;
  }
  const procentaNaStupne = p => Math.atan(p / 100) * RAD;
  function pomer(st) {
    const t = Math.tan(Math.abs(st) / RAD);
    return t < 1e-6 ? Infinity : 1 / t;
  }
  /* Rozdíl dvou úhlů (−180, 180]. */
  function rozdilUhlu(a, b) {
    let d = ((b - a) % 360 + 360) % 360;
    return d > 180 ? d - 360 : d;
  }

  /* Kalibrace otočením o 180°: v obou polohách naměřeno a, b → posun nuly a skutečný úhel. */
  function kalibraceOtocenim(a, b) { return { posun: (a + b) / 2, skutecny: (a - b) / 2 }; }

  /* Klid měření: rozptyl posledních hodnot pod prahem (pro automatický zámek). */
  function jeKlid(hodnoty, prah) {
    if (hodnoty.length < 5) return false;
    return Math.max(...hodnoty) - Math.min(...hodnoty) <= prah;
  }

  /* ---------- zvuk ---------- */
  const db = vykon => vykon > 1e-20 ? 10 * Math.log10(vykon) : -200;
  /* Střední kvadrát vzorků (Float32Array, −1…1) → dBFS; s posunem kalibrace → přibližné dB SPL. */
  function stredniKvadrat(vzorky) {
    let s = 0;
    for (let i = 0; i < vzorky.length; i++) s += vzorky[i] * vzorky[i];
    return vzorky.length ? s / vzorky.length : 0;
  }
  const dbfs = vzorky => db(stredniKvadrat(vzorky));

  /* Časové vážení F (125 ms) / S (1 s): exponenciální průměr kvadrátu. */
  function casoveVazeni(pred, novy, dt, tau) {
    if (pred == null) return novy;
    const k = 1 - Math.exp(-dt / tau);
    return pred + k * (novy - pred);
  }

  /* Leq – energetický průměr hladin v dB. */
  function leq(hladiny) {
    if (!hladiny.length) return null;
    let s = 0;
    for (const l of hladiny) s += Math.pow(10, l / 10);
    return 10 * Math.log10(s / hladiny.length);
  }

  /* A-váhování podle IEC 61672 (dB korekce na frekvenci f). */
  const A_F = [20.598997, 107.65265, 737.86223, 12194.217];
  function aVahaDb(f) {
    const f2 = f * f;
    const ra = (A_F[3] ** 2) * f2 * f2 /
      ((f2 + A_F[0] ** 2) * Math.sqrt((f2 + A_F[1] ** 2) * (f2 + A_F[2] ** 2)) * (f2 + A_F[3] ** 2));
    return 20 * Math.log10(ra) + 2.0;
  }
  /* C-váhování (pro úplnost u spektra). */
  function cVahaDb(f) {
    const f2 = f * f;
    const rc = (A_F[3] ** 2) * f2 / ((f2 + A_F[0] ** 2) * (f2 + A_F[3] ** 2));
    return 20 * Math.log10(rc) + 0.06;
  }

  /* Polynomy: koeficienty od nejvyšší mocniny (jako v MATLABu). */
  function nasob(p, q) {
    const r = new Array(p.length + q.length - 1).fill(0);
    for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) r[i + j] += p[i] * q[j];
    return r;
  }
  /* Bilineární transformace H(s) = N(s)/D(s) → H(z) = B(z⁻¹)/A(z⁻¹), s = 2fs (1 − z⁻¹)/(1 + z⁻¹). */
  function bilinear(num, den, fs) {
    const n = den.length - 1;
    const N = new Array(n + 1 - num.length).fill(0).concat(num);
    const k = 2 * fs;
    const prevod = poly => {
      let out = new Array(n + 1).fill(0);
      for (let i = 0; i <= n; i++) {          // člen s^m, m = n − i
        const m = n - i;
        let p = [Math.pow(k, m) * poly[i]];
        for (let j = 0; j < m; j++) p = nasob(p, [1, -1]);
        for (let j = 0; j < n - m; j++) p = nasob(p, [1, 1]);
        out = out.map((v, x) => v + p[x]);
      }
      return out;
    };
    const b = prevod(N), a = prevod(den);
    return { b: b.map(v => v / a[0]), a: a.map(v => v / a[0]) };
  }
  /* Digitální A-filtr pro vzorkovací frekvenci fs (stejně jako adsgn.m). */
  function koeficientyA(fs) {
    const w = A_F.map(f => 2 * Math.PI * f);
    const num = [w[3] * w[3] * Math.pow(10, 1.9997 / 20), 0, 0, 0, 0];
    let den = nasob([1, 2 * w[3], w[3] * w[3]], [1, 2 * w[0], w[0] * w[0]]);
    den = nasob(nasob(den, [1, w[2]]), [1, w[1]]);
    return bilinear(num, den, fs);
  }
  /* Frekvenční přenos digitálního filtru v dB. */
  function prenosDb(k, f, fs) {
    const w = 2 * Math.PI * f / fs;
    const ev = c => {
      let re = 0, im = 0;
      c.forEach((v, i) => { re += v * Math.cos(w * i); im -= v * Math.sin(w * i); });
      return Math.hypot(re, im);
    };
    return 20 * Math.log10(ev(k.b) / ev(k.a));
  }
  /* Filtrace signálu (přímá forma I) – v prohlížeči to dělá IIRFilterNode, tady pro test. */
  function filtruj(k, x) {
    const y = new Float64Array(x.length);
    for (let n = 0; n < x.length; n++) {
      let s = 0;
      for (let i = 0; i < k.b.length; i++) if (n - i >= 0) s += k.b[i] * x[n - i];
      for (let i = 1; i < k.a.length; i++) if (n - i >= 0) s -= k.a[i] * y[n - i];
      y[n] = s;
    }
    return y;
  }

  /* Orientační hladiny pro srovnání. */
  const HLADINY = [
    [20, 'šepot, tiché studio'], [30, 'tichá ložnice v noci'], [40, 'knihovna, tichá kancelář'],
    [50, 'klidná ulice, lednice'], [60, 'běžný rozhovor'], [70, 'vysavač, rušná ulice'],
    [80, 'kuchyňský robot, hlučná dílna'], [85, 'hranice, nad kterou chránit sluch při delším pobytu'],
    [90, 'sekačka, vrtačka'], [100, 'motorová pila, diskotéka'], [110, 'rockový koncert'], [120, 'práh bolesti']
  ];
  function popisHladiny(l) {
    let p = HLADINY[0][1];
    for (const [h, t] of HLADINY) if (l >= h - 5) p = t;
    return p;
  }

  /* ---------- spektrum ---------- */
  /* Dominantní frekvence ze spektra v dB (getFloatFrequencyData) s parabolickou interpolací. */
  function dominantni(spektrum, fs, fftSize, fMin, fMax) {
    const df = fs / fftSize;
    const i0 = Math.max(1, Math.ceil((fMin || 20) / df));
    const i1 = Math.min(spektrum.length - 2, Math.floor((fMax || fs / 2) / df));
    let im = -1, max = -Infinity;
    for (let i = i0; i <= i1; i++) if (spektrum[i] > max) { max = spektrum[i]; im = i; }
    if (im < 0 || !isFinite(max)) return null;
    const a = spektrum[im - 1], b = spektrum[im], c = spektrum[im + 1];
    const jm = a - 2 * b + c;
    const p = isFinite(a) && isFinite(c) && jm !== 0 ? omez(0.5 * (a - c) / jm, -0.5, 0.5) : 0;
    return { f: (im + p) * df, db: b - 0.25 * (a - c) * p, index: im };
  }
  /* Celková hladina ze spektra (dB na koš) s volitelným vážením. */
  function hladinaZeSpektra(spektrum, fs, fftSize, vaha) {
    const df = fs / fftSize;
    let s = 0;
    for (let i = 1; i < spektrum.length; i++) {
      const w = vaha === 'A' ? aVahaDb(i * df) : vaha === 'C' ? cVahaDb(i * df) : 0;
      s += Math.pow(10, (spektrum[i] + w) / 10);
    }
    return db(s);
  }
  const NOTY = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'H'];
  /* Frekvence → nejbližší nota (A4 = ladění) a odchylka v centech. */
  function nota(f, a4) {
    if (!(f > 0)) return null;
    const n = 12 * Math.log2(f / (a4 || 440)) + 57;   // C0 = 0
    const r = Math.round(n);
    return { nazev: NOTY[((r % 12) + 12) % 12] + Math.floor(r / 12), centy: Math.round((n - r) * 100) };
  }

  /* ---------- světlo ---------- */
  const srgbNaLin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  /* Průměrný relativní jas (lineární Y, 0–1) z RGBA dat obrázku. */
  function jasObrazu(data, krok) {
    krok = krok || 1;
    let s = 0, n = 0;
    for (let i = 0; i < data.length; i += 4 * krok) {
      s += 0.2126 * srgbNaLin(data[i] / 255) + 0.7152 * srgbNaLin(data[i + 1] / 255) + 0.0722 * srgbNaLin(data[i + 2] / 255);
      n++;
    }
    return n ? s / n : 0;
  }
  /* Podíl přepálených pixelů (aspoň jeden kanál ≥ 250). */
  function prepal(data) {
    let n = 0, c = 0;
    for (let i = 0; i < data.length; i += 4) { c++; if (data[i] >= 250 || data[i + 1] >= 250 || data[i + 2] >= 250) n++; }
    return c ? n / c : 0;
  }
  /* Expoziční hodnota pro ISO 100: EV = log2(N²/t) − log2(ISO/100). */
  const ev100 = (clona, cas, iso) => Math.log2(clona * clona / cas) - Math.log2(iso / 100);
  /* Odhad osvětlení: scéna jasnější/tmavší než střední šeď posune EV; E ≈ 2,5 · 2^EV (C = 250).
     jas = lineární Y obrazu, stredniSed = 0,18. Výsledek je ORIENTAČNÍ – kalibrační faktor ho dorovná. */
  function luxZExpozice(clona, cas, iso, jas, faktor) {
    const ev = ev100(clona, cas, iso) + Math.log2(Math.max(jas, 1e-4) / 0.18);
    return 2.5 * Math.pow(2, ev) * (faktor || 1);
  }
  /* Kalibrace podle známé hodnoty: nový faktor = známá / naměřená · starý. */
  const kalibracniFaktor = (znama, namerena, stary) => namerena > 0 ? (stary || 1) * znama / namerena : (stary || 1);
  const DOPORUCENI_LUX = [
    [50, 'chodba, schodiště'], [100, 'obývací pokoj (celkové)'], [200, 'kuchyň, koupelna'],
    [300, 'čtení, běžná práce'], [500, 'kancelář, psací stůl, PC'], [750, 'kreslení, jemná práce'],
    [1000, 'velmi jemná práce, dílna – přesné úkony'], [10000, 'zatažená obloha venku'], [100000, 'přímé slunce']
  ];

  /* ---------- stroboskop ---------- */
  const hzNaRpm = (f, znacek) => f * 60 / (znacek || 1);
  const rpmNaHz = (rpm, znacek) => rpm * (znacek || 1) / 60;
  /* Při jakých otáčkách se předmět jeví stojící: rychlost = k · f (k celé), u n značek děleno n.
     Při f = 2·F jsou vidět dvě kopie. Vrací kandidáty seřazené. */
  function kandidatiRpm(f, znacek) {
    const z = znacek || 1;
    return [0.5, 1, 2, 3, 4].map(k => ({ k, rpm: k * f * 60 / z }));
  }
  /* Displej bliká jen v celých snímcích: f ≈ fps / n. Vrátí nejbližší dosažitelnou frekvenci. */
  function kvantujNaSnimky(f, fps) {
    if (!(f > 0) || !(fps > 0)) return null;
    const n = Math.max(2, Math.round(fps / f));
    return { snimkuNaPeriodu: n, fSkutecna: fps / n, odchylka: fps / n - f };
  }
  /* Obnovovací frekvence z intervalů rAF (ms) – medián, zaokrouhlený na běžné hodnoty. */
  function odhadFps(intervaly) {
    const v = intervaly.filter(x => x > 2 && x < 100).sort((a, b) => a - b);
    if (v.length < 5) return null;
    const fps = 1000 / v[Math.floor(v.length / 2)];
    const bezne = [24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
    const blizko = bezne.find(b => Math.abs(b - fps) / b < 0.04);
    return blizko || Math.round(fps * 10) / 10;
  }
  /* Je v čase t (s) záblesk? f = frekvence, strida = podíl svitu 0–1. */
  const zablesk = (t, f, strida) => ((t * f) % 1 + 1) % 1 < strida;

  /* ---------- formátování ---------- */
  function cislo(x, des) {
    if (x == null || !isFinite(x)) return '—';
    return x.toFixed(des == null ? 1 : des).replace('.', ',').replace('-', '−');
  }

  const API = {
    normuj, zOrientace, znamenkoGravitace, vyhlad, naObrazovku, uhlyNaplocho, uhelLat, polohaTelefonu, sklon,
    stupneNaProcenta, procentaNaStupne, pomer, rozdilUhlu, kalibraceOtocenim, jeKlid,
    db, stredniKvadrat, dbfs, casoveVazeni, leq, aVahaDb, cVahaDb, bilinear, koeficientyA, prenosDb, filtruj,
    HLADINY, popisHladiny, dominantni, hladinaZeSpektra, nota,
    srgbNaLin, jasObrazu, prepal, ev100, luxZExpozice, kalibracniFaktor, DOPORUCENI_LUX,
    hzNaRpm, rpmNaHz, kandidatiRpm, kvantujNaSnimky, odhadFps, zablesk, cislo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.MERAKY = API;
})(typeof window !== 'undefined' ? window : globalThis);
