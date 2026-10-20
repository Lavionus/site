/* ============================================================
   Volvelle – výpočetní jádro (bez DOM)
   Kalendář (gregoriánský/juliánský), fáze Měsíce (Meeus, kap. 49), šifrovací kotouč,
   planisféra (projekce, obzor, hvězdný čas), logaritmické a lineární stupnice, převody jednotek.
   Úhly na kotouči: ve stupních, po směru hodinových ručiček od „dvanácté hodiny“, y dolů (jako SVG).
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;
  const mod = (a, n) => ((a % n) + n) % n;

  /* ---------------- geometrie ---------------- */
  /** bod ve vzdálenosti r pod úhlem a (° od „12 h“ po směru ručiček) */
  const P = (r, a) => [r * Math.sin(a * RAD), -r * Math.cos(a * RAD)];
  /** úhel bodu (x, y) ve stejné konvenci, 0..360 */
  const uhelBodu = (x, y) => mod(Math.atan2(x, -y) / RAD, 360);
  /** otočení bodu o ρ (° po směru ručiček) */
  const otoc = (q, rho) => { const c = Math.cos(rho * RAD), s = Math.sin(rho * RAD); return [q[0] * c - q[1] * s, q[0] * s + q[1] * c]; };
  /** body výseče mezikruží (r1 < r2, a1 → a2 po směru ručiček) */
  function vysec(r1, r2, a1, a2, krokSt) {
    const k = krokSt || 2, n = Math.max(2, Math.ceil(Math.abs(a2 - a1) / k)), b = [];
    for (let i = 0; i <= n; i++) b.push(P(r2, a1 + (a2 - a1) * i / n));
    if (r1 > 1e-6) for (let i = n; i >= 0; i--) b.push(P(r1, a1 + (a2 - a1) * i / n));
    else b.push([0, 0]);
    return b;
  }
  function kruhBody(r, n, cx, cy) { const b = []; n = n || 96; for (let i = 0; i < n; i++) { const q = P(r, i * 360 / n); b.push([q[0] + (cx || 0), q[1] + (cy || 0)]); } return b; }
  /** bod v mnohoúhelníku (sudo-liché pravidlo) */
  function vMnohouhelniku(q, b) {
    let uvnitr = false;
    for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
      const [xi, yi] = b[i], [xj, yj] = b[j];
      if ((yi > q[1]) !== (yj > q[1]) && q[0] < (xj - xi) * (q[1] - yi) / (yj - yi) + xi) uvnitr = !uvnitr;
    }
    return uvnitr;
  }
  /** „pěkné“ kroky stupnice: 1, 2, 5 × 10^n nejbližší k cíli */
  function peknyKrok(cil) {
    const e = Math.pow(10, Math.floor(Math.log10(cil))), m = cil / e;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e;
  }

  /* ---------------- kalendář ---------------- */
  const JMENA_DNU = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  const ZKR_DNU = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  const JMENA_MES = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  const MES_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  const ZKR_MES = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
  const DNY_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  /** juliánské číslo dne (poledne) pro gregoriánský ('g') nebo juliánský ('j') kalendář; funguje i pro záporné roky */
  function jdn(y, m, d, kal) {
    const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    if (kal === 'j') return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }
  /** datum z JDN (gregoriánsky) */
  function zJdn(J) {
    const a = J + 32044, b = Math.floor((4 * a + 3) / 146097), c = a - Math.floor(146097 * b / 4);
    const d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4), m = Math.floor((5 * e + 2) / 153);
    return { d: e - Math.floor((153 * m + 2) / 5) + 1, m: m + 3 - 12 * Math.floor(m / 10), y: 100 * b + d - 4800 + Math.floor(m / 10) };
  }
  const prestupny = (y, kal) => (kal === 'j' ? mod(y, 4) === 0 : (mod(y, 4) === 0 && mod(y, 100) !== 0) || mod(y, 400) === 0);
  /** den v týdnu 0 = neděle … 6 = sobota */
  const denTydne = (y, m, d, kal) => mod(jdn(y, m, d, kal) + 1, 7);
  const pocetDni = (y, m, kal) => (m === 2 && prestupny(y, kal) ? 29 : DNY_MES[m - 1]);
  const denRoku = (y, m, d, kal) => jdn(y, m, d, kal) - jdn(y, 1, 1, kal) + 1;
  /** kumulativní počet dní před měsícem m v nepřestupném roce */
  const predMesicem = (m) => { let s = 0; for (let i = 1; i < m; i++) s += DNY_MES[i - 1]; return s; };
  /**
   * kód roku K a kód měsíce M věčného kalendáře: den v týdnu = (K + M + d − 1) mod 7 (0 = neděle).
   * V přestupném roce se K zvětší o 1 a leden/únor mají vlastní kód (o 1 menší) – na kotouči „led*“, „úno*“.
   */
  const kodRoku = (y, kal) => mod(denTydne(y, 1, 1, kal) + (prestupny(y, kal) ? 1 : 0), 7);
  const kodMesice = (m, prestupnyLedUno) => mod(predMesicem(m) - (prestupnyLedUno && m <= 2 ? 1 : 0), 7);
  const denTydneKody = (y, m, d, kal) => mod(kodRoku(y, kal) + kodMesice(m, prestupny(y, kal)) + d - 1, 7);

  /** Velikonoční neděle (gregoriánsky, anonymní algoritmus Meeus/Jones/Butcher) */
  function velikonoce(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
    return { m: mes, d: den };
  }

  /* ---------------- čas a Měsíc ---------------- */
  /** juliánské datum z UTC (Date nebo složek) */
  const jdZData = (dt) => dt.getTime() / 86400000 + 2440587.5;
  const dataZJd = (jd) => new Date((jd - 2440587.5) * 86400000);
  /** ΔT = TT − UT v sekundách (polynomy Espenak & Meeus, 1900–2150) */
  function deltaT(rok) {
    const y = rok;
    if (y < 1900) { const u = (y - 1820) / 100; return -20 + 32 * u * u; }
    if (y < 1920) { const t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
    if (y < 1941) { const t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t ** 3; }
    if (y < 1961) { const t = y - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547; }
    if (y < 1986) { const t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
    if (y < 2005) { const t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
    if (y < 2050) { const t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    if (y < 2150) { const u = (y - 1820) / 100; return -20 + 32 * u * u - 0.5628 * (2150 - y); }
    const u = (y - 1820) / 100; return -20 + 32 * u * u;
  }
  const SYNODICKY = 29.530588853;
  /**
   * okamžik fáze Měsíce (Meeus, Astronomical Algorithms, kap. 49) – JD v UT.
   * k: celé = novoluní, +0,25 první čtvrť, +0,5 úplněk, +0,75 poslední čtvrť (k = 0 ≈ 6. 1. 2000)
   */
  function fazeMeeus(k) {
    const T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;
    const E = 1 - 0.002516 * T - 0.0000074 * T2;
    const M = (2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3) * RAD;
    const Mc = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * RAD;
    const F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * RAD;
    const O = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * RAD;
    const s = Math.sin, typ = Math.round(mod(k, 1) * 4) % 4;
    let c;
    if (typ === 0 || typ === 2) {
      const nov = typ === 0;
      c = (nov ? -0.40720 : -0.40614) * s(Mc) + (nov ? 0.17241 : 0.17302) * E * s(M) + (nov ? 0.01608 : 0.01614) * s(2 * Mc)
        + (nov ? 0.01039 : 0.01043) * s(2 * F) + (nov ? 0.00739 : 0.00734) * E * s(Mc - M) - (nov ? 0.00514 : 0.00515) * E * s(Mc + M)
        + (nov ? 0.00208 : 0.00209) * E * E * s(2 * M) - 0.00111 * s(Mc - 2 * F) - 0.00057 * s(Mc + 2 * F) + 0.00056 * E * s(2 * Mc + M)
        - 0.00042 * s(3 * Mc) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F) - 0.00024 * E * s(2 * Mc - M) - 0.00017 * s(O)
        - 0.00007 * s(Mc + 2 * M) + 0.00004 * s(2 * Mc - 2 * F) + 0.00004 * s(3 * M) + 0.00003 * s(Mc + M - 2 * F) + 0.00003 * s(2 * Mc + 2 * F)
        - 0.00003 * s(Mc + M + 2 * F) + 0.00003 * s(Mc - M + 2 * F) - 0.00002 * s(Mc - M - 2 * F) - 0.00002 * s(3 * Mc + M) + 0.00002 * s(4 * Mc);
    } else {
      c = -0.62801 * s(Mc) + 0.17172 * E * s(M) - 0.01183 * E * s(Mc + M) + 0.00862 * s(2 * Mc) + 0.00804 * s(2 * F) + 0.00454 * E * s(Mc - M)
        + 0.00204 * E * E * s(2 * M) - 0.00180 * s(Mc - 2 * F) - 0.00070 * s(Mc + 2 * F) - 0.00040 * s(3 * Mc) - 0.00034 * E * s(2 * Mc - M)
        + 0.00032 * E * s(M + 2 * F) + 0.00032 * E * s(M - 2 * F) - 0.00028 * E * E * s(Mc + 2 * M) + 0.00027 * E * s(2 * Mc + M) - 0.00017 * s(O)
        - 0.00005 * s(Mc - M - 2 * F) + 0.00004 * s(2 * Mc + 2 * F) - 0.00004 * s(Mc + M + 2 * F) + 0.00004 * s(Mc - 2 * M) + 0.00003 * s(Mc + M - 2 * F)
        + 0.00003 * s(3 * M) + 0.00002 * s(2 * Mc - 2 * F) + 0.00002 * s(Mc - M + 2 * F) - 0.00002 * s(3 * Mc + M);
      const W = 0.00306 - 0.00038 * E * Math.cos(M) + 0.00026 * Math.cos(Mc) - 0.00002 * Math.cos(Mc - M) + 0.00002 * Math.cos(Mc + M) + 0.00002 * Math.cos(2 * F);
      c += typ === 1 ? W : -W;
    }
    const A = [299.77 + 0.107408 * k - 0.009173 * T2, 251.88 + 0.016321 * k, 251.83 + 26.651886 * k, 349.42 + 36.412478 * k, 84.66 + 18.206239 * k,
      141.74 + 53.303771 * k, 207.14 + 2.453732 * k, 154.84 + 7.306860 * k, 34.52 + 27.261239 * k, 207.19 + 0.121824 * k, 291.34 + 1.844379 * k,
      161.72 + 24.198154 * k, 239.56 + 25.513099 * k, 331.55 + 3.592518 * k];
    const KA = [0.000325, 0.000165, 0.000164, 0.000126, 0.000110, 0.000062, 0.000060, 0.000056, 0.000047, 0.000042, 0.000040, 0.000037, 0.000035, 0.000023];
    for (let i = 0; i < 14; i++) c += KA[i] * s(A[i] * RAD);
    jde += c;
    const rok = 2000 + k / 12.3685;
    return jde - deltaT(rok) / 86400;
  }
  /** poslední novoluní před (nebo v) okamžiku jd a následující; vrací {k, jd, dalsi} */
  function novoluniPred(jd) {
    let k = Math.floor((jd - 2451550.09766) / SYNODICKY);
    while (fazeMeeus(k + 1) <= jd) k++;
    while (fazeMeeus(k) > jd) k--;
    return { k, jd: fazeMeeus(k), dalsi: fazeMeeus(k + 1) };
  }
  /** stáří Měsíce (dny od posledního skutečného novoluní) */
  function stariMesice(jd) { const n = novoluniPred(jd); return { stari: jd - n.jd, delka: n.dalsi - n.jd, novoluni: n.jd, k: n.k }; }
  /** stáří podle středního synodického měsíce od zvoleného novoluní (to, co ukáže kotouč otáčený po dnech) */
  const stariStredni = (jd, jdNovoluni) => mod(jd - jdNovoluni, SYNODICKY);
  /** osvětlený podíl kotouče (přibližně z fázového úhlu podle stáří) */
  const osvetleni = (stari, delka) => (1 - Math.cos(2 * Math.PI * stari / (delka || SYNODICKY))) / 2;
  const FAZE_JMENA = ['novoluní', 'dorůstající srpek', 'první čtvrť', 'dorůstající měsíc', 'úplněk', 'couvající měsíc', 'poslední čtvrť', 'couvající srpek'];
  /** jméno fáze podle stáří (8 dílů, hlavní fáze ±1/16 cyklu) */
  const jmenoFaze = (stari, delka) => FAZE_JMENA[Math.floor(mod(stari / (delka || SYNODICKY) * 8 + 0.5, 8))];
  /** všechny hlavní fáze v kalendářním roce (UT): [{typ 0..3, jd}] */
  function fazeRoku(y) {
    const z = jdn(y, 1, 1, 'g') - 0.5, k = jdn(y + 1, 1, 1, 'g') - 0.5, out = [];
    let kk = Math.floor((z - 2451550.09766) / SYNODICKY) - 1;
    for (; ; kk += 0.25) {
      const j = fazeMeeus(kk);
      if (j >= k) break;
      if (j >= z) out.push({ typ: Math.round(mod(kk, 1) * 4) % 4, jd: j, k: kk });
    }
    return out;
  }

  /* ---------------- šifrovací kotouč ---------------- */
  const ABECEDY = {
    en26: { nazev: 'anglická (26 písmen)', znaky: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
    cz27: { nazev: 'česká bez diakritiky + CH (27)', znaky: 'A B C D E F G H CH I J K L M N O P Q R S T U V W X Y Z'.split(' ') },
    cz42: { nazev: 'česká úplná s diakritikou a CH (42)', znaky: 'A Á B C Č D Ď E É Ě F G H CH I Í J K L M N Ň O Ó P Q R Ř S Š T Ť U Ú Ů V W X Y Ý Z Ž'.split(' ') },
    alberti: { nazev: 'Alberti (20 písmen + 1–4 / 24 znaků)', znaky: 'A B C D E F G I L M N O P Q R S T V X Z 1 2 3 4'.split(' '), vnitrni: 'a b c d e f g h i k l m n o p q r s t v x y z &'.split(' ') },
  };
  const bezDia = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  /** rozdělí text na tokeny abecedy (CH jako jeden znak); ostatní znaky projdou beze změny */
  function tokenizuj(text, abeceda) {
    const ab = ABECEDY[abeceda] || ABECEDY.en26, sada = new Set(ab.znaky), maCH = sada.has('CH'), dia = abeceda === 'cz42', out = [];
    let t = String(text).toUpperCase();
    if (!dia) t = bezDia(t);
    // Albertiho vnější kotouč nemá H, J, K, U, W, Y: latinské zvyklosti (J→I, U→V, W→VV, K→C, Y→I, H se vynechá, & → ET)
    if (abeceda === 'alberti') t = t.replace(/J/g, 'I').replace(/U/g, 'V').replace(/W/g, 'VV').replace(/K/g, 'C').replace(/Y/g, 'I').replace(/H/g, '').replace(/&/g, 'ET');
    for (let i = 0; i < t.length; i++) {
      if (maCH && t[i] === 'C' && t[i + 1] === 'H') { out.push({ z: 'CH', p: true }); i++; continue; }
      const c = t[i];
      out.push(sada.has(c) ? { z: c, p: true } : { z: c, p: false });
    }
    return out;
  }
  /** vnitřní (šifrová) abeceda: posunutá shodná (Caesar) nebo míchaná heslem */
  function vnitrniAbeceda(abeceda, heslo) {
    const ab = ABECEDY[abeceda] || ABECEDY.en26, zaklad = (ab.vnitrni || ab.znaky.map((z) => z.toLowerCase()));
    if (!heslo) return zaklad.slice();
    const tok = tokenizuj(heslo, abeceda).filter((t) => t.p).map((t) => zaklad[ab.znaky.indexOf(t.z)]);
    const out = [];
    for (const z of tok) if (z && !out.includes(z)) out.push(z);
    // zbytek abecedy od posledního písmene hesla dál (klasické míchání)
    const zac = out.length ? zaklad.indexOf(out[out.length - 1]) + 1 : 0;
    for (let i = 0; i < zaklad.length; i++) { const z = zaklad[(zac + i) % zaklad.length]; if (!out.includes(z)) out.push(z); }
    return out;
  }
  /**
   * šifrování kotoučem: vnější písmeno i ↔ vnitřní písmeno (i + posun) mod N.
   * o: {abeceda, vnitrni (pole), posun, perioda (Alberti: po kolika písmenech se kotouč pootočí, 0 = nikdy), krokPeriody, desifruj}
   */
  function kotoucSifra(text, o) {
    const ab = ABECEDY[o.abeceda] || ABECEDY.en26, vn = o.vnitrni || vnitrniAbeceda(o.abeceda, ''), N = ab.znaky.length;
    let posun = mod(o.posun || 0, N), n = 0;
    const out = [], maCHv = vn.some((z) => z.toUpperCase() === 'CH');
    for (const t of tokenizuj(text, o.abeceda)) {
      if (!t.p) { out.push(t.z); continue; }
      if (!o.desifruj) {
        const z = vn[mod(ab.znaky.indexOf(t.z) + posun, N)].toUpperCase();
        // samostatné C a H za sebou by se při dešifrování četly jako CH – oddělí se tečkou „·“
        if (z === 'H' && maCHv && out.length && out[out.length - 1] === 'C') out.push('·');
        out.push(z);
      }
      else {
        const j = vn.findIndex((z) => z.toUpperCase() === t.z);
        out.push(j < 0 ? t.z : ab.znaky[mod(j - posun, N)]);
      }
      n++;
      if (o.perioda > 0 && n % o.perioda === 0) posun = mod(posun + (o.krokPeriody || 1), N);
    }
    return out.join('');
  }
  /** při dešifrování musí šifrový text projít tokenizací vnitřní abecedy – vnitřní znaky jsou malé verze vnějších */
  function desifruj(text, o) {
    const ab = ABECEDY[o.abeceda] || ABECEDY.en26, vn = o.vnitrni || vnitrniAbeceda(o.abeceda, ''), N = ab.znaky.length;
    const sada = new Map(vn.map((z, i) => [z.toUpperCase(), i])), maCH = sada.has('CH');
    let t = String(text).toUpperCase(), posun = mod(o.posun || 0, N), n = 0;
    if (o.abeceda !== 'cz42') t = bezDia(t);
    const out = [];
    for (let i = 0; i < t.length; i++) {
      let z = t[i];
      if (z === '·' && maCH && t[i - 1] === 'C' && t[i + 1] === 'H') continue;
      if (maCH && z === 'C' && t[i + 1] === 'H') { z = 'CH'; i++; }
      if (!sada.has(z)) { out.push(z); continue; }
      out.push(ab.znaky[mod(sada.get(z) - posun, N)]);
      n++;
      if (o.perioda > 0 && n % o.perioda === 0) posun = mod(posun + (o.krokPeriody || 1), N);
    }
    return out.join('');
  }
  const sifruj = (text, o) => kotoucSifra(text, Object.assign({}, o, { desifruj: false }));
  /** text normalizovaný tak, jak ho vidí šifra (pro porovnání výsledku dešifrování) */
  const normalizuj = (text, abeceda) => tokenizuj(text, abeceda).map((t) => t.z).join('');

  /* ---------------- planisféra ---------------- */
  /** střední hvězdný čas v Greenwichi (°) pro JD (UT), IAU 1982 */
  function gmst(jd) {
    const T = (jd - 2451545.0) / 36525;
    return mod(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000, 360);
  }
  /**
   * parametry planisféry: fi (šířka, ± sever), lambda (délka, + východ), zona (h), rok, R (poloměr mapy v mm), okraj (° pod jižním bodem obzoru)
   * vrací objekt s funkcemi (souřadnice v rovině kotouče, střed = světový pól)
   */
  function planisfera(o) {
    const fi = o.fi, sever = fi >= 0, af = Math.abs(fi), s = sever ? 1 : -1;
    const dmin = -(90 - af) - (o.okraj == null ? 3 : o.okraj);   // nejjižnější deklinace na mapě (v „severní“ soustavě)
    const R = o.R;
    const rD = (d) => R * (90 - s * d) / (90 - dmin);              // vzdálenost od středu pro deklinaci d
    const dZr = (r) => s * (90 - r / R * (90 - dmin));
    /** poloha hvězdy na kotouči (otočení 0) */
    const hvezda = (ra, de) => P(rD(de), s * ra);
    /** úhel data na kotouči: GMST v místní půlnoci daného data (čas pásma) */
    const uhelData = (rok, m, d) => s * gmst(jdn(rok, m, d, 'g') - 0.5 - o.zona / 24);
    /** úhel hodiny (čas pásma, h) na krytu */
    const uhelCasu = (t) => s * (180 - o.lambda - 15 * t);
    /** otočení kotouče pro místní hvězdný čas (°) */
    const otoceniProLst = (lst) => s * (180 - lst);
    const lstZOtoceni = (rho) => mod(180 - s * rho, 360);
    /** obzor v soustavě krytu: body (az 0..360 od severu) */
    function obzor(n) {
      const b = [], fr = af * RAD;
      n = n || 240;
      for (let i = 0; i < n; i++) {
        const A = i / n * 2 * Math.PI;
        const d = Math.asin(Math.cos(A) * Math.cos(fr)) / RAD;
        const H = Math.atan2(-Math.sin(A), -Math.cos(A) * Math.sin(fr)) / RAD;
        b.push(P(R * (90 - d) / (90 - dmin), s * (180 - H)));
      }
      return b;
    }
    /** bod obzoru pro azimut A (° od severu, ve skutečné obloze) */
    function bodObzoru(A) {
      const fr = af * RAD, Ar = (sever ? A : 180 - A) * RAD;   // na jihu je pól na jihu – azimut se překlopí
      const d = Math.asin(Math.cos(Ar) * Math.cos(fr)) / RAD;
      const H = Math.atan2(-Math.sin(Ar), -Math.cos(Ar) * Math.sin(fr)) / RAD;
      return P(R * (90 - d) / (90 - dmin), s * (180 - H));
    }
    /** výška hvězdy nad obzorem (°) pro LST */
    function vyska(ra, de, lst) {
      const H = (lst - ra) * RAD;
      return Math.asin(Math.sin(fi * RAD) * Math.sin(de * RAD) + Math.cos(fi * RAD) * Math.cos(de * RAD) * Math.cos(H)) / RAD;
    }
    function azimut(ra, de, lst) {
      const H = (lst - ra) * RAD, f = fi * RAD, d = de * RAD;
      return mod(Math.atan2(-Math.sin(H) * Math.cos(d), Math.sin(d) * Math.cos(f) - Math.cos(d) * Math.sin(f) * Math.cos(H)) / RAD, 360);
    }
    /** skutečný LST (°) pro datum/čas pásma */
    const lstPro = (rok, m, d, t) => mod(gmst(jdn(rok, m, d, 'g') - 0.5 + (t - o.zona) / 24) + o.lambda, 360);
    /** zenit na krytu */
    const zenit = () => P(rD(fi), s * 180);
    return { fi, sever, s, dmin, R, rD, dZr, hvezda, uhelData, uhelCasu, otoceniProLst, lstZOtoceni, obzor, bodObzoru, vyska, azimut, lstPro, zenit };
  }
  /** ekliptika: (λ ekl.) → (α, δ), sklon pro J2000 */
  function eklZRov(lam) {
    const e = 23.4393 * RAD, l = lam * RAD;
    return [mod(Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) / RAD, 360), Math.asin(Math.sin(e) * Math.sin(l)) / RAD];
  }

  /* ---------------- stupnice ---------------- */
  /** úhel na kruhové logaritmické stupnici: dekady = počet dekád na obvod (C/D 1, A/B 2, K 3) */
  const uhelLog = (x, dekady) => mod(360 * Math.log10(x) / (dekady || 1), 360);
  const STUPNICE_LOG = {
    C: { dek: 1, f: (x) => Math.log10(x), od: 1, do: 10 },
    D: { dek: 1, f: (x) => Math.log10(x), od: 1, do: 10 },
    CI: { dek: 1, f: (x) => 1 - Math.log10(x), od: 1, do: 10 },
    A: { dek: 2, f: (x) => Math.log10(x) / 2, od: 1, do: 100 },
    B: { dek: 2, f: (x) => Math.log10(x) / 2, od: 1, do: 100 },
    K: { dek: 3, f: (x) => Math.log10(x) / 3, od: 1, do: 1000 },
    S: { f: (a) => Math.log10(10 * Math.sin(a * RAD)), od: 5.74, do: 90 },
    T: { f: (a) => Math.log10(10 * Math.tan(a * RAD)), od: 5.71, do: 45 },
    L: { f: (x) => x, od: 0, do: 1 },
  };
  /** úhel hodnoty na stupnici (° po směru ručiček, 1 na C/D nahoře) */
  const uhelStupnice = (sk, x) => 360 * STUPNICE_LOG[sk].f(x);
  /** inverze: hodnota na stupnici pod úhlem a (číselně, bisekcí) */
  function hodnotaStupnice(sk, a) {
    const S = STUPNICE_LOG[sk], cil = mod(a, 360) / 360;
    let lo = S.od, hi = S.do;
    const ros = S.f(hi) > S.f(lo);
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if ((S.f(m) < cil) === ros) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  /** dílky logaritmické stupnice v rozsahu (pro D/C, A/B, K): [{x, uroven 0 = hlavní s číslem, 1 střední, 2 drobný, popis}] */
  function dilkyLog(dekady) {
    const out = [];
    for (let e = 0; e < dekady; e++) {
      const k = Math.pow(10, e), hust = dekady === 1 ? 1 : dekady === 2 ? 0.5 : 0.34;
      // (od, do, drobný krok, střední krok) v rámci dekády 1–10
      const pasma = hust >= 1 ? [[1, 2, 0.01, 0.05], [2, 4, 0.02, 0.1], [4, 10, 0.05, 0.5]] : hust >= 0.5 ? [[1, 2, 0.02, 0.1], [2, 5, 0.05, 0.5], [5, 10, 0.1, 0.5]] : [[1, 2, 0.05, 0.5], [2, 5, 0.1, 0.5], [5, 10, 0.2, 1]];
      for (const [a, b, dr, st] of pasma) {
        const n = Math.round((b - a) / dr);
        for (let i = 0; i < n; i++) {
          const x = a + i * dr, cel = Math.abs(x - Math.round(x)) < 1e-9, str = Math.abs(x / st - Math.round(x / st)) < 1e-6;
          const lab = cel || (hust >= 1 && x < 2 && Math.abs(x * 10 - Math.round(x * 10)) < 1e-6);
          out.push({ x: x * k, uroven: cel ? 0 : lab ? 1 : str ? 1 : 2, popis: cel ? String(Math.round(x * k)) : (hust >= 1 && lab ? String(Math.round((x - 1) * 10)) : '') });
        }
      }
    }
    return out;
  }
  /** dílky goniometrické stupnice S nebo T (úhly ve stupních) */
  function dilkyGon(sk) {
    const out = [], konec = sk === 'S' ? 90 : 45, zac = sk === 'S' ? 6 : 6;
    const pasma = sk === 'S' ? [[6, 10, 0.25, 1], [10, 20, 0.5, 5], [20, 30, 1, 5], [30, 60, 2, 10], [60, 80, 5, 10], [80, 90, 10, 10]] : [[6, 10, 0.25, 1], [10, 20, 0.5, 5], [20, 45, 1, 5]];
    for (const [a, b, dr, lab] of pasma) {
      const n = Math.round((b - a) / dr);
      for (let i = 0; i < n; i++) {
        const x = a + i * dr, l = Math.abs(x / lab - Math.round(x / lab)) < 1e-6, cel = Math.abs(x - Math.round(x)) < 1e-6;
        out.push({ x, uroven: l ? 0 : cel ? 1 : 2, popis: l ? String(Math.round(x)) : '' });
      }
    }
    out.push({ x: konec, uroven: 0, popis: String(konec) });
    void zac;
    return out;
  }
  function dilkyL() { const out = []; for (let i = 0; i < 100; i++) out.push({ x: i / 100, uroven: i % 10 ? (i % 5 ? 2 : 1) : 0, popis: i % 10 ? '' : (i === 0 ? '0' : '.' + i / 10) }); return out; }

  /* ---------------- převody jednotek ---------------- */
  /** dvojice jednotek: a = hlavní jednotka (stupnice ven), b = převedená; f: a → b, g: b → a */
  const PREVODY = {
    teplota: { nazev: 'teplota °C ↔ °F', a: '°C', b: '°F', f: (c) => c * 9 / 5 + 32, g: (f) => (f - 32) * 5 / 9, od: -40, do: 250, log: false },
    trouba: { nazev: 'trouba °C ↔ plyn (Gas Mark)', a: '°C', b: 'plyn', f: (c) => (c < 135 ? (c - 107.5) / 27.5 * 0.5 + 0.5 : (c - 121) / 14), g: (g) => (g < 1 ? 107.5 + (g - 0.5) / 0.5 * 27.5 : 121 + 14 * g), od: 100, do: 260, log: false, diskretni: [[0.25, '¼'], [0.5, '½'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7'], [8, '8'], [9, '9']] },
    palce: { nazev: 'délka mm ↔ palce', a: 'mm', b: 'in', f: (x) => x / 25.4, g: (x) => x * 25.4, od: 0, do: 300, log: false },
    cm_palce: { nazev: 'délka cm ↔ palce', a: 'cm', b: 'in', f: (x) => x / 2.54, g: (x) => x * 2.54, od: 0, do: 100, log: false },
    km_mile: { nazev: 'vzdálenost km ↔ míle', a: 'km', b: 'mi', f: (x) => x / 1.609344, g: (x) => x * 1.609344, od: 1, do: 1000, log: true },
    kmh_mph: { nazev: 'rychlost km/h ↔ mph', a: 'km/h', b: 'mph', f: (x) => x / 1.609344, g: (x) => x * 1.609344, od: 0, do: 200, log: false },
    g_oz: { nazev: 'hmotnost g ↔ unce', a: 'g', b: 'oz', f: (x) => x / 28.349523125, g: (x) => x * 28.349523125, od: 5, do: 2000, log: true },
    kg_lb: { nazev: 'hmotnost kg ↔ libry', a: 'kg', b: 'lb', f: (x) => x / 0.45359237, g: (x) => x * 0.45359237, od: 0.1, do: 100, log: true },
    ml_cup: { nazev: 'objem ml ↔ hrnky (US cup)', a: 'ml', b: 'cup', f: (x) => x / 236.5882365, g: (x) => x * 236.5882365, od: 10, do: 1000, log: true },
    ml_floz: { nazev: 'objem ml ↔ fl oz (US)', a: 'ml', b: 'fl oz', f: (x) => x / 29.5735295625, g: (x) => x * 29.5735295625, od: 5, do: 1000, log: true },
    ml_lzice: { nazev: 'objem ml ↔ lžíce (15 ml)', a: 'ml', b: 'lžíce', f: (x) => x / 15, g: (x) => x * 15, od: 2.5, do: 300, log: true },
    l_gal: { nazev: 'objem l ↔ galony (US)', a: 'l', b: 'gal', f: (x) => x / 3.785411784, g: (x) => x * 3.785411784, od: 1, do: 200, log: true },
    bar_psi: { nazev: 'tlak bar ↔ psi', a: 'bar', b: 'psi', f: (x) => x * 14.503773773, g: (x) => x / 14.503773773, od: 0.1, do: 20, log: true },
  };
  /** mapování hodnoty a-jednotky na úhel (zac..zac+rozpeti) */
  function uhelPrevodu(pr, x, zac, rozpeti) {
    const f = pr.log ? Math.log10 : (v) => v, t = (f(x) - f(pr.od)) / (f(pr.do) - f(pr.od));
    return zac + rozpeti * t;
  }
  function hodnotaPrevodu(pr, a, zac, rozpeti) {
    const t = (a - zac) / rozpeti;
    return pr.log ? Math.pow(10, Math.log10(pr.od) + t * (Math.log10(pr.do) - Math.log10(pr.od))) : pr.od + t * (pr.do - pr.od);
  }
  /** dílky lineární / logaritmické stupnice pro rozsah [od, do] s cílovou hustotou (počet dílků) */
  function dilkyRozsah(od, doo, log, cilPocet) {
    const out = [];
    if (!log) {
      const krok = peknyKrok((doo - od) / (cilPocet || 120));
      const hl = peknyKrok(krok * 8), st = hl / 2;
      const z = Math.ceil(od / krok - 1e-9) * krok;
      for (let x = z; x <= doo + krok * 1e-6; x += krok) {
        const xx = Math.round(x / krok) * krok;
        const u = Math.abs(xx / hl - Math.round(xx / hl)) < 1e-6 ? 0 : Math.abs(xx / st - Math.round(xx / st)) < 1e-6 ? 1 : 2;
        out.push({ x: xx, uroven: u, popis: u === 0 ? cislo(xx) : '' });
      }
      return out;
    }
    const e0 = Math.floor(Math.log10(od)), e1 = Math.ceil(Math.log10(doo)), dek = Math.max(1, Math.log10(doo / od));
    const hust = (cilPocet || 120) / dek;    // dílků na dekádu
    for (let e = e0; e < e1; e++) {
      const k = Math.pow(10, e);
      const pasma = hust > 80 ? [[1, 2, 0.05, 0.5, 0.1], [2, 5, 0.1, 1, 0.5], [5, 10, 0.2, 1, 1]] : hust > 35 ? [[1, 2, 0.1, 0.5, 0.5], [2, 5, 0.2, 1, 1], [5, 10, 0.5, 1, 5]] : [[1, 2, 0.2, 1, 1], [2, 5, 0.5, 1, 1], [5, 10, 1, 5, 5]];
      for (const [a, b, dr, st, lab] of pasma) {
        const n = Math.round((b - a) / dr);
        for (let i = 0; i < n; i++) {
          const x = (a + i * dr) * k;
          if (x < od - 1e-9 || x > doo + 1e-9) continue;
          const m = a + i * dr, jeLab = Math.abs(m / lab - Math.round(m / lab)) < 1e-6, jeSt = Math.abs(m / st - Math.round(m / st)) < 1e-6;
          out.push({ x, uroven: jeLab ? 0 : jeSt ? 1 : 2, popis: jeLab ? cislo(x) : '' });
        }
      }
    }
    if (Math.abs(Math.log10(doo) - Math.round(Math.log10(doo))) < 1e-9) out.push({ x: doo, uroven: 0, popis: cislo(doo) });
    return out;
  }
  /** číslo česky (desetinná čárka, bez zbytečných nul) */
  function cislo(x, des) {
    if (des == null) { const a = Math.abs(x); des = a >= 100 || Math.abs(x - Math.round(x)) < 1e-9 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3; }
    let s = (Math.round(x * Math.pow(10, des)) / Math.pow(10, des)).toFixed(des);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s.replace('.', ',').replace('-', '−');
  }

  const API = {
    RAD, mod, P, uhelBodu, otoc, vysec, kruhBody, vMnohouhelniku, peknyKrok, cislo,
    JMENA_DNU, ZKR_DNU, JMENA_MES, MES_GEN, ZKR_MES, DNY_MES,
    jdn, zJdn, prestupny, denTydne, pocetDni, denRoku, predMesicem, kodRoku, kodMesice, denTydneKody, velikonoce,
    jdZData, dataZJd, deltaT, SYNODICKY, fazeMeeus, novoluniPred, stariMesice, stariStredni, osvetleni, FAZE_JMENA, jmenoFaze, fazeRoku,
    ABECEDY, tokenizuj, vnitrniAbeceda, sifruj, desifruj, normalizuj, kotoucSifra,
    gmst, planisfera, eklZRov,
    uhelLog, STUPNICE_LOG, uhelStupnice, hodnotaStupnice, dilkyLog, dilkyGon, dilkyL,
    PREVODY, uhelPrevodu, hodnotaPrevodu, dilkyRozsah,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.VOLV = API;
})(typeof window !== 'undefined' ? window : globalThis);
