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


  /* ---------- kompas ---------- */
  /* Směr zadní kamery (osa −z) podle W3C příkladu z absolutní orientace (alpha, beta, gamma); 0 = sever, po směru hodin. */
  function azimutKamery(alpha, beta, gamma) {
    const x = (beta || 0) / RAD, y = (gamma || 0) / RAD, z = (alpha || 0) / RAD;
    const cX = Math.cos(x), cY = Math.cos(y), cZ = Math.cos(z), sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z);
    const vx = -cZ * sY - sZ * sX * cY, vy = -sZ * sY + cZ * sX * cY;
    return uhel360(Math.atan2(vx, vy) * RAD);
  }
  /* Směr horní hrany telefonu ležícího naplocho (alpha roste proti směru hodin) + natočení obrazovky. */
  const azimutHrany = (alpha, uhelObrazovky) => uhel360(360 - alpha + (uhelObrazovky || 0));
  const uhel360 = a => ((a % 360) + 360) % 360;
  /* Magnetický → zeměpisný azimut (deklinace kladná = východní). */
  const zemepisny = (magn, deklinace) => uhel360(magn + (deklinace || 0));
  const SVETOVE = ['S', 'SSV', 'SV', 'VSV', 'V', 'VJV', 'JV', 'JJV', 'J', 'JJZ', 'JZ', 'ZJZ', 'Z', 'ZSZ', 'SZ', 'SSZ'];
  const svetovaStrana = a => SVETOVE[Math.round(uhel360(a) / 22.5) % 16];
  /* Vyhlazení úhlu přes jednotkový vektor (aby 359° → 1° neprolétlo přes 180°). */
  function vyhladUhel(pred, novy, alfa) {
    if (pred == null) return uhel360(novy);
    return uhel360(pred + alfa * rozdilUhlu(pred, novy));
  }
  /* Deklinace pro střed ČR – lineární odhad (WMM2025: Praha ≈ 5,2° V v 2025, +0,13°/rok). Stav 11/2026. */
  const deklinaceCR = rok => Math.round((5.2 + 0.13 * ((rok || 2026) - 2025)) * 10) / 10;

  /* ---------- výškoměr (náklon zadní kamery) ---------- */
  /* Elevace osy zadní kamery nad vodorovnou rovinou (stupně) z vektoru nahoru. */
  const elevaceKamery = u => Math.asin(omez(-u[2], -1, 1)) * RAD;
  /* Výška ze známé vodorovné vzdálenosti: úhel k vrcholu a k patě (pata obvykle záporná). */
  const vyskaZeVzdalenosti = (d, vrchol, pata) => d * (Math.tan(vrchol / RAD) - Math.tan(pata / RAD));
  /* Vzdálenost k patě z výšky oka (telefonu) nad rovinou paty. */
  function vzdalenostZVysky(hOka, pata) {
    if (!(pata < -0.05)) return null;
    return hOka / Math.tan(-pata / RAD);
  }

  /* ---------- FFT a vibrace ---------- */
  /* Amplitudové spektrum reálného signálu (délka = mocnina 2, Hannovo okno, odstraněná střední hodnota).
     Vrací amplitudy košů 0…N/2 v jednotkách signálu (sinus amplitudy A dá ≈ A). */
  function amplitudy(x) {
    const N = x.length, re = new Float64Array(N), im = new Float64Array(N);
    let str = 0; for (let i = 0; i < N; i++) str += x[i]; str /= N;
    for (let i = 0; i < N; i++) re[i] = (x[i] - str) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
    for (let i = 1, j = 0; i < N; i++) {                      // bitová inverze
      let b = N >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; }
    }
    for (let len = 2; len <= N; len <<= 1) {
      const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < N; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
          re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
    const out = new Float64Array(N / 2 + 1);
    for (let k = 0; k <= N / 2; k++) out[k] = Math.hypot(re[k], im[k]) * 4 / N;   // ×2 jednostranné, ×2 Hann
    return out;
  }
  /* Dominantní frekvence z amplitudového spektra (parabolická interpolace v log měřítku). */
  function spickaAmplitud(amp, fs, fMin) {
    const N = (amp.length - 1) * 2, df = fs / N;
    let im = -1, max = 0;
    for (let k = Math.max(1, Math.ceil((fMin || 0) / df)); k < amp.length - 1; k++) if (amp[k] > max) { max = amp[k]; im = k; }
    if (im < 0) return null;
    const a = Math.log(amp[im - 1] + 1e-12), b = Math.log(amp[im] + 1e-12), c = Math.log(amp[im + 1] + 1e-12), jm = a - 2 * b + c;
    const p = jm < 0 ? omez(0.5 * (a - c) / jm, -0.5, 0.5) : 0;
    return { f: (im + p) * df, amp: max };
  }
  const efektivni = x => Math.sqrt(stredniKvadrat(x));
  /* Orientační intenzita otřesu ze špičkového zrychlení (m/s²) – zjednodušená tabulka podle USGS (PGA → MMI). */
  function intenzitaOtresu(pga) {
    const g = pga / 9.80665 * 100;   // % g
    const T = [[0.17, 'I – necítí se'], [1.4, 'II–III – slabé'], [3.9, 'IV – mírné'], [9.2, 'V – silné'], [18, 'VI – velmi silné'], [34, 'VII – ničivé'], [Infinity, 'VIII+ – bořivé']];
    return T.find(t => g < t[0])[1];
  }

  /* ---------- otáčky gyroskopem ---------- */
  const radSNaRpm = w => w * 60 / (2 * Math.PI);
  const stSNaRpm = w => w / 6;
  /* Kolísání (wow) – směrodatná odchylka v % průměru. */
  function kolisani(hodnoty) {
    if (hodnoty.length < 3) return null;
    const m = hodnoty.reduce((a, b) => a + b, 0) / hodnoty.length;
    if (!m) return null;
    const v = hodnoty.reduce((a, b) => a + (b - m) ** 2, 0) / (hodnoty.length - 1);
    return { prumer: m, procent: Math.sqrt(v) / Math.abs(m) * 100 };
  }
  const OTACKY_GRAMOFONU = [100 / 3, 45, 78];

  /* ---------- krokoměr ---------- */
  /* Detektor kroků: velikost zrychlení s gravitací (m/s²), vyhlazená; krok = vzestup přes práh nad klouzavým průměrem
     a od minulého kroku aspoň minInterval ms. Stav se drží v objektu st. */
  function detektorKroku(st, a, t, citlivost) {
    st.lp = st.lp == null ? a : st.lp + 0.3 * (a - st.lp);          // vyhlazení šumu
    st.avg = st.avg == null ? a : st.avg + 0.02 * (a - st.avg);     // pomalý průměr ≈ g
    const prah = (citlivost || 1.2);
    const nad = st.lp - st.avg > prah;
    let krok = false;
    if (nad && !st.nad && (st.posl == null || t - st.posl > 280)) { krok = true; st.posl = t; st.kroky = (st.kroky || 0) + 1; }
    st.nad = nad ? true : (st.lp - st.avg < prah * 0.3 ? false : st.nad);
    return krok;
  }
  const delkaKroku = vyskaCm => Math.round(vyskaCm * 0.415) / 100;   // m, chůze

  /* ---------- GPS ---------- */
  /* Vzdálenost dvou bodů na kouli (m). */
  function haversin(lat1, lon1, lat2, lon2) {
    const R = 6371008.8, f1 = lat1 / RAD, f2 = lat2 / RAD, df = (lat2 - lat1) / RAD, dl = (lon2 - lon1) / RAD;
    const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  /* Počáteční azimut z bodu 1 do bodu 2 (stupně). */
  function azimutBodu(lat1, lon1, lat2, lon2) {
    const f1 = lat1 / RAD, f2 = lat2 / RAD, dl = (lon2 - lon1) / RAD;
    return uhel360(Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)) * RAD);
  }
  /* Přičíst úsek trasy? Jen když je bod dost přesný a posun větší než šum. */
  function pricistUsek(d, presnost1, presnost2, maxPresnost) {
    const lim = maxPresnost || 30;
    if (presnost1 > lim || presnost2 > lim) return false;
    return d > Math.max(3, 0.5 * (presnost1 + presnost2));
  }
  const JEDNOTKY_RYCHLOSTI = { 'km/h': 3.6, 'm/s': 1, 'mph': 2.236936, 'uzly': 1.943844 };
  /* Tempo min/km z m/s. */
  function tempo(ms) {
    if (!(ms > 0.3)) return null;
    const s = 1000 / ms;
    return Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0').replace('60', '59');
  }
  /* Souřadnice ve stupních → stupně, minuty, vteřiny. */
  function dms(st, kladne, zaporne) {
    const a = Math.abs(st), d = Math.floor(a), m = Math.floor((a - d) * 60), s = (a - d - m / 60) * 3600;
    return d + '° ' + m + '′ ' + s.toFixed(1).replace('.', ',') + '″ ' + (st >= 0 ? kladne : zaporne);
  }

  /* ---------- pravítko ---------- */
  const KARTA_MM = { sirka: 85.6, vyska: 53.98 };   // ISO/IEC 7810 ID-1
  const pxNaMm = (px, mm) => px / mm;
  const mmNaPalce = mm => mm / 25.4;

  /* ---------- ladička ---------- */
  /* Výška tónu metodou YIN (de Cheveigné & Kawahara 2002). x = vzorky, fs = vzorkování. Vrací {f, jistota} nebo null. */
  function yin(x, fs, fMin, fMax, prah) {
    const tMin = Math.max(2, Math.floor(fs / (fMax || 2000))), tMax = Math.min(Math.floor(x.length / 2), Math.ceil(fs / (fMin || 40)));
    const W = x.length - tMax;
    if (W < 32 || tMax <= tMin) return null;
    const d = new Float64Array(tMax + 1);
    for (let t = 1; t <= tMax; t++) { let s = 0; for (let i = 0; i < W; i++) { const r = x[i] - x[i + t]; s += r * r; } d[t] = s; }
    const cm = new Float64Array(tMax + 1); cm[0] = 1;
    let sum = 0;
    for (let t = 1; t <= tMax; t++) { sum += d[t]; cm[t] = sum > 0 ? d[t] * t / sum : 1; }
    let tau = -1;
    const p = prah || 0.12;
    for (let t = tMin; t < tMax; t++) if (cm[t] < p) { while (t + 1 < tMax && cm[t + 1] < cm[t]) t++; tau = t; break; }
    if (tau < 0) {                                      // bez jistého tónu: globální minimum, ale s nízkou jistotou
      let m = Infinity; for (let t = tMin; t < tMax; t++) if (cm[t] < m) { m = cm[t]; tau = t; }
      if (m > 0.35) return null;
    }
    const a = cm[tau - 1], b = cm[tau], c = cm[tau + 1], jm = a - 2 * b + c;
    const posun = jm > 0 ? omez(0.5 * (a - c) / jm, -0.5, 0.5) : 0;
    return { f: fs / (tau + posun), jistota: omez(1 - b, 0, 1) };
  }
  /* Frekvence noty podle názvu (A4, C♯3, H2) – pro ladění strun. */
  function frekvenceNoty(nazev, a4) {
    const m = /^([A-H])([♯#b♭]?)(-?\d)$/.exec(nazev);
    if (!m) return null;
    const zakl = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, H: 11, B: 10 }[m[1]];
    const posun = m[2] === '♯' || m[2] === '#' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
    const n = +m[3] * 12 + zakl + posun;
    return (a4 || 440) * Math.pow(2, (n - 57) / 12);
  }
  const centyMezi = (f, ref) => 1200 * Math.log2(f / ref);
  const LADENI = {
    chromaticky: { nazev: 'chromaticky (libovolný tón)', struny: [] },
    kytara: { nazev: 'kytara E A D G H E', struny: ['E2', 'A2', 'D3', 'G3', 'H3', 'E4'] },
    basa: { nazev: 'baskytara E A D G', struny: ['E1', 'A1', 'D2', 'G2'] },
    ukulele: { nazev: 'ukulele G C E A', struny: ['G4', 'C4', 'E4', 'A4'] },
    housle: { nazev: 'housle G D A E', struny: ['G3', 'D4', 'A4', 'E5'] },
    viola: { nazev: 'viola C G D A', struny: ['C3', 'G3', 'D4', 'A4'] },
    cello: { nazev: 'violoncello C G D A', struny: ['C2', 'G2', 'D3', 'A3'] },
    mandolina: { nazev: 'mandolína G D A E', struny: ['G3', 'D4', 'A4', 'E5'] },
    dropD: { nazev: 'kytara drop D', struny: ['D2', 'A2', 'D3', 'G3', 'H3', 'E4'] }
  };
  /* Nejbližší struna k frekvenci. */
  function nejblizsiStruna(f, struny, a4) {
    let nej = null;
    for (const s of struny) { const c = centyMezi(f, frekvenceNoty(s, a4)); if (!nej || Math.abs(c) < Math.abs(nej.centy)) nej = { struna: s, centy: c }; }
    return nej;
  }

  /* ---------- třetinooktávy ---------- */
  /* Středy třetinooktávových pásem (IEC 61260, zaokrouhlené názvy) od 25 Hz do fMax. */
  const TRETINY = [25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000];
  /* Hladiny v pásmech ze spektra v dB na koš. Přesný střed = 1000·10^(n/10), meze ×10^(±1/20). */
  function tretinoveOktavy(spektrum, fs, fftSize, vaha) {
    const df = fs / fftSize, out = [];
    for (const nom of TRETINY) {
      const n = Math.round(10 * Math.log10(nom / 1000)), fc = 1000 * Math.pow(10, n / 10);
      const f1 = fc * Math.pow(10, -0.05), f2 = fc * Math.pow(10, 0.05);
      if (f2 > fs / 2) break;
      let s = 0, poc = 0;
      for (let i = Math.max(1, Math.ceil(f1 / df)); i * df < f2 && i < spektrum.length; i++) {
        const w = vaha === 'A' ? aVahaDb(i * df) : vaha === 'C' ? cVahaDb(i * df) : 0;
        s += Math.pow(10, (spektrum[i] + w) / 10); poc++;
      }
      out.push({ f: nom, db: poc ? db(s) : null });
    }
    return out;
  }

  /* ---------- denní expozice hluku ---------- */
  /* LEX,8h = LAeq,T + 10·log(T / 8 h); dávka v % vůči 85 dB(A) za 8 h (NV 272/2011: horní akční hodnota 85, limit 87). */
  const lex8h = (laeq, sekund) => laeq + 10 * Math.log10(sekund / 28800);
  const davka = (laeq, sekund, kriterium) => 100 * sekund / 28800 * Math.pow(10, (laeq - (kriterium || 85)) / 10);
  /* Kolik hodin vydržet na hladině L, než se dosáhne 100 % dávky (pravidlo 3 dB). */
  const povolenaDoba = (l, kriterium) => 8 * Math.pow(10, ((kriterium || 85) - l) / 10);

  /* ---------- generátor tónu ---------- */
  /* Frekvence logaritmického přeladění v čase t ∈ [0, T]. */
  const sweepLog = (f1, f2, t, T) => f1 * Math.pow(f2 / f1, omez(t / T, 0, 1));
  /* Poloha posuvníku 0–1 ↔ frekvence 20 Hz – 20 kHz (logaritmicky). */
  const posuvnikNaF = p => 20 * Math.pow(1000, omez(p, 0, 1));
  const fNaPosuvnik = f => Math.log(f / 20) / Math.log(1000);
  /* Růžový šum: Paul Kelletův filtr (stav b = pole 7 čísel). */
  function ruzovy(b, bily) {
    b[0] = 0.99886 * b[0] + bily * 0.0555179; b[1] = 0.99332 * b[1] + bily * 0.0750759;
    b[2] = 0.96900 * b[2] + bily * 0.1538520; b[3] = 0.86650 * b[3] + bily * 0.3104856;
    b[4] = 0.55000 * b[4] + bily * 0.5329522; b[5] = -0.7616 * b[5] - bily * 0.0168980;
    const out = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + bily * 0.5362;
    b[6] = bily * 0.115926;
    return out * 0.11;
  }

  /* ---------- tep z kamery (PPG) ---------- */
  /* Tep z časové řady jasu (hodnoty, časy v s): odstraní trend, najde špičku spektra v pásmu 40–200 tepů/min.
     Vrací {bpm, kvalita 0–1} nebo null. Používá DFT na rovnoměrně převzorkovaném signálu. */
  function tepZeSignalu(hodnoty, casy) {
    const n = hodnoty.length;
    if (n < 64) return null;
    const T = casy[n - 1] - casy[0];
    if (T < 5) return null;
    const fs = 20, N = 256, M = Math.min(N, Math.floor(T * fs));
    const y = new Float64Array(N);
    let j = 0;
    for (let i = 0; i < M; i++) {                       // převzorkování posledních M/fs sekund
      const t = casy[n - 1] - (M - 1 - i) / fs;
      while (j < n - 2 && casy[j + 1] < t) j++;
      const k = omez((t - casy[j]) / ((casy[j + 1] - casy[j]) || 1), 0, 1);
      y[i] = hodnoty[j] + k * (hodnoty[j + 1] - hodnoty[j]);
    }
    // odečíst klouzavý průměr (1 s) – trend z pohybu prstu
    const z = new Float64Array(N), w = fs;
    for (let i = 0; i < M; i++) {
      let s = 0, c = 0;
      for (let q = Math.max(0, i - w / 2); q < Math.min(M, i + w / 2); q++) { s += y[q]; c++; }
      z[i] = y[i] - s / c;
    }
    const amp = amplitudy(z), df = fs / N;
    let im = -1, max = 0, celk = 0;
    for (let k = 1; k < amp.length - 1; k++) {
      const f = k * df;
      if (f >= 0.67 && f <= 3.33) { celk += amp[k] * amp[k]; if (amp[k] > max) { max = amp[k]; im = k; } }
    }
    if (im < 1) return null;
    const a = amp[im - 1], b = amp[im], c = amp[im + 1], jm = a - 2 * b + c;
    const p = jm < 0 ? omez(0.5 * (a - c) / jm, -0.5, 0.5) : 0;
    const okoli = (amp[im - 1] ** 2 + b * b + amp[im + 1] ** 2) + (amp[2 * im] ? amp[2 * im] ** 2 : 0);
    return { bpm: (im + p) * df * 60, kvalita: celk ? omez(okoli / celk, 0, 1) : 0 };
  }

  /* ---------- deník ---------- */
  /* CSV se středníkem a desetinnou čárkou (česky otevře Excel). */
  function csv(radky) {
    const esc = v => { const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '\uFEFF' + radky.map(r => r.map(esc).join(';')).join('\r\n');
  }

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
    hzNaRpm, rpmNaHz, kandidatiRpm, kvantujNaSnimky, odhadFps, zablesk, cislo,
    azimutKamery, azimutHrany, uhel360, zemepisny, svetovaStrana, vyhladUhel, deklinaceCR,
    elevaceKamery, vyskaZeVzdalenosti, vzdalenostZVysky,
    amplitudy, spickaAmplitud, efektivni, intenzitaOtresu, radSNaRpm, stSNaRpm, kolisani, OTACKY_GRAMOFONU,
    detektorKroku, delkaKroku, haversin, azimutBodu, pricistUsek, JEDNOTKY_RYCHLOSTI, tempo, dms,
    KARTA_MM, pxNaMm, mmNaPalce, yin, frekvenceNoty, centyMezi, LADENI, nejblizsiStruna,
    TRETINY, tretinoveOktavy, lex8h, davka, povolenaDoba, sweepLog, posuvnikNaF, fNaPosuvnik, ruzovy,
    tepZeSignalu, csv
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.MERAKY = API;
})(typeof window !== 'undefined' ? window : globalThis);
