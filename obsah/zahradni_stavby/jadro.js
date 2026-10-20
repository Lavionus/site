/* ============================================================
   Zahradní stavby ze dřeva – výpočetní jádro (bez DOM)
   Vyvýšený záhon (obdélník / L / U), kompostér 1–3 komory, pergola s lamelami.
   Souřadnice v mm: x = délka stavby, y = hloubka, z = nahoru, z = 0 je terén.
   Statika je zjednodušená (EN 1995 / EN 1991 v nejjednodušší podobě) – NEJDE O STATICKÝ POSUDEK.
   Export: window.ZSJ i module.exports.
   ============================================================ */
(function (koren) {
  'use strict';
  const PI = Math.PI, rad = (d) => d * PI / 180, deg = (r) => r * 180 / PI;
  const g = 9.81;

  /* ---------------- formátování ---------------- */
  function fmt(x, d) {
    d = d == null ? 0 : d;
    if (!Number.isFinite(x)) return '–';
    const s = Math.abs(x).toFixed(d), i = s.indexOf('.');
    let a = i < 0 ? s : s.slice(0, i); const b = i < 0 ? '' : s.slice(i + 1);
    if (a.length > 4) a = a.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const z = (x < 0 && Number(s) !== 0) ? '−' : '';
    return z + a + (b ? ',' + b : '');
  }
  const omez = (x, a, b) => Math.max(a, Math.min(b, x));
  const cislo = (x, v) => (Number.isFinite(+x) ? +x : v);

  /* ---------------- materiály (typické hodnoty EN 338, editovatelná cena) ---------------- */
  // fmk, fc0k, fc90k, fvk [MPa], E = E0,mean, E005 [MPa], rho = průměrná hustota [kg/m³], trv = třída trvanlivosti EN 350 (1 = velmi trvanlivé, 5 = netrvanlivé)
  const MATERIALY = {
    smrk_c16: { nazev: 'Smrk / borovice C16 (běžné řezivo)', fmk: 16, fc0k: 17, fc90k: 2.2, fvk: 3.2, E: 8000, E005: 5400, rho: 370, trv: 4, cena: 9000 },
    smrk_c24: { nazev: 'Smrk C24 / KVH (sušené, hoblované)', fmk: 24, fc0k: 21, fc90k: 2.5, fvk: 4.0, E: 11000, E005: 7400, rho: 420, trv: 4, cena: 13000 },
    modrin: { nazev: 'Modřín (pevnostně ~C24)', fmk: 24, fc0k: 21, fc90k: 2.5, fvk: 4.0, E: 11000, E005: 7400, rho: 590, trv: 3, cena: 17000 },
    douglaska: { nazev: 'Douglaska (pevnostně ~C24)', fmk: 24, fc0k: 21, fc90k: 2.5, fvk: 4.0, E: 11000, E005: 7400, rho: 530, trv: 3, cena: 16000 },
    dub: { nazev: 'Dub (D30)', fmk: 30, fc0k: 24, fc90k: 5.3, fvk: 3.9, E: 11000, E005: 9200, rho: 640, trv: 2, cena: 38000 },
    akat: { nazev: 'Akát / robinie (D40)', fmk: 40, fc0k: 27, fc90k: 5.5, fvk: 4.2, E: 13000, E005: 10900, rho: 660, trv: 1, cena: 32000 },
  };
  const OCHRANY = {
    nater: { nazev: 'Nátěr / máčení (impregnace štětcem, 2× + čela 3×)', priplatek: 0 },
    kdi: { nazev: 'Tlakově impregnované řezivo (KDI, třída použití 4)', priplatek: 0.3 },
    bez: { nazev: 'Bez chemické ochrany (trvanlivé dřevo, olej)', priplatek: 0 },
  };
  // třída provozu 3 (venku), EN 1995-1-1 tab. 3.1 a 3.2
  const KMOD = { stale: 0.5, kratkodobe: 0.7 }, KDEF = 2.0, GAMA_M = 1.3, GAMA_G = 1.35, GAMA_Q = 1.5;
  // charakteristická tíha sněhu na zemi podle sněhových oblastí ČR (ČSN EN 1991-1-3/NA), kN/m²
  const SNIH = { I: 0.7, II: 1.0, III: 1.5, IV: 2.0, V: 2.5, VI: 3.0, VII: 4.0 };
  const ZEMINY = {
    sucha: { nazev: 'suchá kyprá zemina / substrát (γ 14 kN/m³, φ 32°)', gama: 14, phi: 32 },
    vlhka: { nazev: 'vlhká zahradní zemina (γ 17 kN/m³, φ 30°)', gama: 17, phi: 30 },
    mokra: { nazev: 'zemina nasycená vodou (γ 20 kN/m³, φ 25°)', gama: 20, phi: 25 },
    kompost: { nazev: 'kompost, organická hmota (γ 8 kN/m³, φ 30°)', gama: 8, phi: 30 },
  };
  const VRSTVY = {
    vetve: { nazev: 'Hrubé větve, kmínky (drenáž)', podil: 0.25, sesedani: 0.35, hustota: 200, barva: '#6b4a2b' },
    stepka: { nazev: 'Jemné větve, štěpka, sláma', podil: 0.15, sesedani: 0.25, hustota: 250, barva: '#a5804f' },
    listi: { nazev: 'Obrácené drny, listí, posečená tráva', podil: 0.20, sesedani: 0.4, hustota: 300, barva: '#8f7a2e' },
    kompost: { nazev: 'Hrubý (polozralý) kompost, hnůj', podil: 0.20, sesedani: 0.2, hustota: 600, barva: '#4a3424' },
    zemina: { nazev: 'Zralý kompost + zahradní zemina (osevní vrstva)', podil: 0.20, sesedani: 0.08, hustota: 1300, barva: '#2e2219' },
  };
  const UZIVATELE = {
    stojici: { nazev: 'stojící', vyska: [800, 950], dosah: 650 },
    sedici: { nazev: 'sedící (na okraji / na židli)', vyska: [450, 650], dosah: 550 },
    vozik: { nazev: 'vozíčkář (příjezd bokem)', vyska: [650, 800], dosah: 500 },
  };
  const OBCHODNI_DELKY = [3000, 4000, 5000, 6000];
  const VRUTY = [40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300];
  const delkaVrutu = (min) => VRUTY.find((x) => x >= min) || 300;

  // ceník – typické orientační ceny (Kč vč. DPH, 2026), všechny editovatelné v UI
  const CENIK = {
    vrut5: { nazev: 'Vrut do dřeva 5 × L, pozink / nerez A2 (typicky)', jedn: 'ks', cena: 2.5 },
    vrut8: { nazev: 'Konstrukční vrut 8 × L s talířovou hlavou (typicky)', jedn: 'ks', cena: 14 },
    vrutKovani: { nazev: 'Vrut do kování 5 × 40 (anker)', jedn: 'ks', cena: 1.8 },
    svornik12: { nazev: 'Svorník M12 × L + 2 podložky + matice', jedn: 'ks', cena: 55 },
    tyc8: { nazev: 'Závitová tyč M8 pozink', jedn: 'm', cena: 40 },
    matice8: { nazev: 'Matice + velkoplošná podložka M8 (pár)', jedn: 'ks', cena: 7 },
    uhelnik: { nazev: 'Tesařský úhelník 90 × 90 × 65', jedn: 'ks', cena: 28 },
    patkaU: { nazev: 'Kotevní patka U s trnem do betonu', jedn: 'ks', cena: 290 },
    patkaDeska: { nazev: 'Patka s deskou na kotvy (do dlažby / desky)', jedn: 'ks', cena: 240 },
    zemniVrut: { nazev: 'Zemní vrut pro sloupek (typicky 70–90 mm, délka 600–800)', jedn: 'ks', cena: 380 },
    chemKotva: { nazev: 'Chemická kotva M10 (podíl kartuše + tyč)', jedn: 'ks', cena: 75 },
    beton: { nazev: 'Suchá betonová směs 25 kg (≈ 12 l betonu)', jedn: 'pytel', cena: 120 },
    sterk: { nazev: 'Štěrk 16/32 pod sloupky / pod záhon', jedn: 'm³', cena: 950 },
    pletivo: { nazev: 'Pletivo proti hryzcům, oko ≤ 13 mm, pozink', jedn: 'm²', cena: 95 },
    foliePE: { nazev: 'PE fólie 0,2 mm', jedn: 'm²', cena: 15 },
    folieNop: { nazev: 'Nopová fólie (ochrana stěn záhonu)', jedn: 'm²', cena: 45 },
    sponky: { nazev: 'Sponky do sponkovačky (nerez)', jedn: 'ks', cena: 0.3 },
    impregnace: { nazev: 'Impregnace / lazura na dřevo', jedn: 'l', cena: 260 },
    rozpera: { nazev: 'Rozpěrka lamel (3D tisk PETG, vlastní)', jedn: 'ks', cena: 6 },
    kamen: { nazev: 'Betonová dlaždice / kámen pod sloupek', jedn: 'ks', cena: 45 },
    zemina: { nazev: 'Zahradní zemina / substrát (dovoz)', jedn: 'm³', cena: 750 },
    kompost: { nazev: 'Kompost (dovoz)', jedn: 'm³', cena: 1100 },
  };

  /* ---------------- výchozí parametry ---------------- */
  const SPOLECNE = { material: 'smrk_c24', ochrana: 'nater', sirkaGeo: 50.08, delkaGeo: 14.42, orientace: 90, datum: '2026-06-21', cas: 13, prorez: 4, orez: 20, cenaVlastni: {} };
  const VYCHOZI = {
    zahon: Object.assign({}, SPOLECNE, {
      typ: 'zahon', tvar: 'obdelnik', delka: 2000, sirka: 1000, delkaB: 1600, vyska: 750,
      prknoB: 150, prknoT: 32, sloupek: 70, vyztuha: 'tahla', zapusteni: 200, roztecMax: 0,
      zemina: 'vlhka', pritizeni: 0, limitN: 150, horniLista: true, listaB: 120, listaT: 28, listaPresah: 20,
      folie: 'nopova', pletivo: true, rezerva: 50, vrstvyAuto: true, vrstvy: null, uzivatel: 'stojici', pristup: 'oboustranny', nakupNaplne: false,
    }),
    komposter: Object.assign({}, SPOLECNE, {
      typ: 'komposter', komor: 3, sirkaKomory: 1000, hloubka: 1000, vyska: 1000, lamelaB: 100, lamelaT: 28, mezera: 20,
      sloupek: 80, listaB: 25, listaH: 40, vule: 3, odsazeni: 30, kotveni: 'zemni_vrut', zapusteni: 0, pletivo: true, limitN: 100,
    }),
    pergola: Object.assign({}, SPOLECNE, {
      typ: 'pergola', varianta: 'volna', delka: 4000, hloubka: 3000, vyska: 2300, sloup: 120, vaznB: 80, vaznH: 200, presahV: 300, pole: 0,
      krokB: 60, krokH: 160, roztecK: 600, presahK: 300, zarez: 20, lamB: 100, lamT: 25, roztecL: 120, sklon: 60, krytina: 'lamely',
      pasky: true, paskaRameno: 600, paskaB: 80, kotveni: 'beton', patkaA: 400, patkaH: 800, odsazeni: 100, snih: 'II', limitN: 200, zakonceni: 'sikme',
    }),
  };
  const PREDVOLBY = {
    zahon_klasik: { nazev: 'Záhon 200 × 100 cm, výška 60 cm', p: { typ: 'zahon', tvar: 'obdelnik', delka: 2000, sirka: 1000, vyska: 600, prknoB: 150, prknoT: 28, sloupek: 60, vyztuha: 'tahla' } },
    zahon_vysoky: { nazev: 'Vysoký záhon pro stojící 300 × 120 × 85 cm', p: { typ: 'zahon', tvar: 'obdelnik', delka: 3000, sirka: 1200, vyska: 850, prknoB: 145, prknoT: 40, sloupek: 80, vyztuha: 'tahla', zapusteni: 0, uzivatel: 'stojici' } },
    zahon_vozik: { nazev: 'Záhon pro vozíčkáře 200 × 100 × 75 cm s lištou', p: { typ: 'zahon', tvar: 'obdelnik', delka: 2000, sirka: 1000, vyska: 750, prknoB: 150, prknoT: 32, sloupek: 70, horniLista: true, listaB: 145, uzivatel: 'vozik', pristup: 'oboustranny' } },
    zahon_L: { nazev: 'Záhon do L 240 × 180 cm, rameno 90 cm', p: { typ: 'zahon', tvar: 'L', delka: 2400, delkaB: 1800, sirka: 900, vyska: 700, prknoB: 145, prknoT: 32 } },
    zahon_U: { nazev: 'Záhon do U pro sezení 300 × 200 cm, rameno 80 cm', p: { typ: 'zahon', tvar: 'U', delka: 3000, delkaB: 2000, sirka: 800, vyska: 550, prknoB: 140, prknoT: 28, horniLista: true, listaB: 160, uzivatel: 'sedici' } },
    komp_3: { nazev: 'Kompostér 3 komory 100 × 100 × 100 cm', p: { typ: 'komposter', komor: 3, sirkaKomory: 1000, hloubka: 1000, vyska: 1000 } },
    komp_1: { nazev: 'Kompostér 1 komora 80 × 80 × 80 cm', p: { typ: 'komposter', komor: 1, sirkaKomory: 800, hloubka: 800, vyska: 800, sloupek: 70 } },
    komp_2: { nazev: 'Kompostér 2 komory 120 × 100 × 90 cm, lamely 32 mm', p: { typ: 'komposter', komor: 2, sirkaKomory: 1200, hloubka: 1000, vyska: 900, lamelaB: 120, lamelaT: 32 } },
    perg_volna: { nazev: 'Volná pergola 4 × 3 m s lamelami', p: { typ: 'pergola', varianta: 'volna', delka: 4000, hloubka: 3000 } },
    perg_zed: { nazev: 'Pergola u zdi 5 × 3 m', p: { typ: 'pergola', varianta: 'u_zdi', delka: 5000, hloubka: 3000, orientace: 90 } },
    perg_velka: { nazev: 'Velká pergola 6 × 4 m, vaznice 100 × 240', p: { typ: 'pergola', varianta: 'volna', delka: 6000, hloubka: 4000, vaznB: 100, vaznH: 240, krokH: 180, sloup: 140 } },
  };

  /* ---------------- zemní tlak a prkna ---------------- */
  /** zemní tlak v klidu (Jáky): K0 = 1 − sin φ; p(z) = K0·(γ·z + q) [kPa]; E = výslednice na 1 m délky [kN/m] */
  function zemniTlak(gama, phi, h, q) {
    q = q || 0;
    const K0 = 1 - Math.sin(rad(phi));
    const Etr = K0 * gama * h * h / 2, Eq = K0 * q * h;
    return { K0, pDole: K0 * (gama * h + q), E: Etr + Eq, Etr, Eq, rameno: (Etr + Eq) > 0 ? (Etr * h / 3 + Eq * h / 2) / (Etr + Eq) : 0 };
  }
  /** liniové zatížení pásu stěny mezi hloubkami z1 < z2 (m pod povrchem náplně) [kN/m] */
  function zatizeniPasu(z1, z2, K0, gama, q) {
    z1 = Math.max(0, z1); z2 = Math.max(0, z2);
    if (z2 <= z1) return 0;
    return K0 * (gama * (z2 * z2 - z1 * z1) / 2 + (q || 0) * (z2 - z1));
  }
  /** fd = kmod · fk / γM */
  const fd = (fk, kmod) => kmod * fk / GAMA_M;
  /**
   * posudek prkna (prostý nosník mezi sloupky, ohyb kolmo na plochu prkna)
   * o: {L [mm], q [kN/m = N/mm, charakteristické, stálé], b [mm výška prkna], t [mm tloušťka], mat, limitN}
   */
  function posudekPrkna(o) {
    const M = MATERIALY[o.mat] || MATERIALY.smrk_c24;
    const I = o.b * Math.pow(o.t, 3) / 12, W = o.b * o.t * o.t / 6;
    const Md = GAMA_G * o.q * o.L * o.L / 8; // Nmm
    const sigma = Md / W, f = fd(M.fmk, KMOD.stale);
    const wInst = 5 * o.q * Math.pow(o.L, 4) / (384 * M.E * I), wFin = wInst * (1 + KDEF);
    const wLim = o.L / (o.limitN || 150);
    return { I, W, Md: Md / 1e6, sigma, f, vyuzitiOhyb: sigma / f, wInst, wFin, wLim, vyuzitiPruhyb: wFin / wLim, ok: sigma <= f && wFin <= wLim };
  }
  /** největší rozpětí prkna, které vyhoví na ohyb i na konečný průhyb */
  function maxRozpetiPrkna(o) {
    if (!(o.q > 0)) return Infinity;
    const M = MATERIALY[o.mat] || MATERIALY.smrk_c24;
    const I = o.b * Math.pow(o.t, 3) / 12, W = o.b * o.t * o.t / 6;
    const Ls = Math.sqrt(8 * W * fd(M.fmk, KMOD.stale) / (GAMA_G * o.q));
    const Lw = Math.cbrt(384 * M.E * I / (5 * o.q * (1 + KDEF) * (o.limitN || 150)));
    return Math.min(Ls, Lw);
  }
  /** počet polí a mezilehlých sloupků pro světlé rozpětí S a limit Lmax */
  function pocetPoli(S, Lmax) {
    if (!(S > 0)) return { pole: 1, mezi: 0, roztec: 0 };
    const n = Number.isFinite(Lmax) && Lmax > 0 ? Math.max(1, Math.ceil(S / Lmax - 1e-9)) : 1;
    return { pole: n, mezi: n - 1, roztec: S / n };
  }
  /** únosnost podložky v tlaku kolmo k vláknům [kN]; D vnější, d otvor [mm] */
  function unosnostPodlozky(D, d, mat, kc90) {
    const M = MATERIALY[mat] || MATERIALY.smrk_c24;
    return (kc90 || 1.25) * fd(M.fc90k, KMOD.stale) * PI / 4 * (D * D - d * d) / 1000;
  }
  /** vzpěrný součinitel kc (EN 1995-1-1, 6.3.2), řezivo βc = 0,2 */
  function vzper(Lef, a, b, M) {
    const i = Math.min(a, b) / Math.sqrt(12), lam = Lef / i;
    const lr = lam / PI * Math.sqrt(M.fc0k / M.E005);
    const k = 0.5 * (1 + 0.2 * (lr - 0.3) + lr * lr);
    return { lam, lr, kc: lr <= 0.3 ? 1 : 1 / (k + Math.sqrt(k * k - lr * lr)) };
  }
  /** posudek nosníku (prostý nosník, rovnoměrné zatížení G a S) */
  function posudekNosniku(o) {
    // o: {L mm, qG, qS [N/mm], b, h, mat, limitN, I?, zmax?, hEf?}
    const M = MATERIALY[o.mat] || MATERIALY.smrk_c24;
    const I = o.I || o.b * Math.pow(o.h, 3) / 12, zmax = o.zmax || o.h / 2, W = I / zmax;
    const L = o.L, q1 = GAMA_G * o.qG + GAMA_Q * o.qS, q0 = GAMA_G * o.qG;
    const s1 = q1 * L * L / 8 / W, s0 = q0 * L * L / 8 / W;
    const vyOhyb = Math.max(s1 / fd(M.fmk, KMOD.kratkodobe), s0 / fd(M.fmk, KMOD.stale));
    const hEf = o.hEf || o.h, V = q1 * L / 2;
    const tau = 1.5 * V / (0.67 * o.b * hEf), vySmyk = tau / fd(M.fvk, KMOD.kratkodobe);
    const wG = 5 * o.qG * Math.pow(L, 4) / (384 * M.E * I), wS = 5 * o.qS * Math.pow(L, 4) / (384 * M.E * I);
    const wFin = wG * (1 + KDEF) + wS, wLim = L / (o.limitN || 200);
    return { sigma: s1, f: fd(M.fmk, KMOD.kratkodobe), vyuzitiOhyb: vyOhyb, tau, vyuzitiSmyk: vySmyk, wG, wS, wFin, wLim, vyuzitiPruhyb: wFin / wLim, ok: vyOhyb <= 1 && vySmyk <= 1 && wFin <= wLim };
  }

  /* ---------------- Slunce ---------------- */
  // vlastní implementace stejných vztahů jako SunCalc (V. Agafonkin, BSD) – použije se, když SunCalc není načten
  const DEN = 864e5, J1970 = 2440588, J2000 = 2451545, EKL = rad(23.4397);
  function slunceVlastni(datum, lat, lon) {
    const d = datum.valueOf() / DEN - 0.5 + J1970 - J2000;
    const M = rad(357.5291 + 0.98560028 * d);
    const C = rad(1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + rad(102.9372) + PI;
    const dec = Math.asin(Math.sin(EKL) * Math.sin(L)), ra = Math.atan2(Math.sin(L) * Math.cos(EKL), Math.cos(L));
    const lw = rad(-lon), phi = rad(lat), H = rad(280.16 + 360.9856235 * d) - lw - ra;
    return { azimuth: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)), altitude: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) };
  }
  let SC = koren.SunCalc || null;
  if (!SC && typeof require !== 'undefined') { try { SC = require('../lib/suncalc.min.js'); } catch (e) { SC = null; } }
  /** poloha Slunce: výška nad obzorem a azimut od severu po směru hodin [°] */
  function polohaSlunce(datum, lat, lon) {
    const S = (koren.SunCalc || SC) ? (koren.SunCalc || SC).getPosition(datum, lat, lon) : slunceVlastni(datum, lat, lon);
    let az = deg(S.azimuth) + 180; az = ((az % 360) + 360) % 360;
    return { vyska: deg(S.altitude), azimut: az, zdroj: (koren.SunCalc || SC) ? 'SunCalc' : 'vlastní' };
  }
  function posledniNedele(rok, mesic0) {
    const d = new Date(Date.UTC(rok, mesic0 + 1, 0));
    return d.getUTCDate() - d.getUTCDay();
  }
  /** místní čas → UTC; zona 'praha' = SEČ/SELČ podle pravidel EU, číslo = pevný posun v h */
  function utcZMistniho(datumStr, hodiny, zona) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datumStr || '')) || [0, 2026, 6, 21];
    const r = +m[1], mo = +m[2] - 1, dn = +m[3];
    const zakl = Date.UTC(r, mo, dn) + hodiny * 3600e3;
    if (zona !== 'praha' && zona != null) return new Date(zakl - cislo(zona, 1) * 3600e3);
    const zac = Date.UTC(r, 2, posledniNedele(r, 2), 1), kon = Date.UTC(r, 9, posledniNedele(r, 9), 1);
    const odhad = zakl - 3600e3;
    const letni = odhad >= zac && odhad < kon;
    return new Date(zakl - (letni ? 2 : 1) * 3600e3);
  }
  /** jednotkový vektor ke Slunci v souřadnicích stavby; orientace = azimut osy +x od severu [°] */
  function smerSlunceLokalne(vyska, azimut, orientace) {
    const h = rad(vyska), A = rad(azimut), a = rad(orientace);
    const E = Math.cos(h) * Math.sin(A), N = Math.cos(h) * Math.cos(A);
    const xE = Math.sin(a), xN = Math.cos(a), yE = -Math.cos(a), yN = Math.sin(a);
    return [E * xE + N * xN, E * yE + N * yN, Math.sin(h)];
  }
  /**
   * stín jedné lamely v rovině profilu (kolmé k ose lamely):
   * b = šířka, t = tloušťka, beta = sklon od vodorovné [°] (stoupá ve směru +s), s = osová rozteč, (sy, sz) = směr ke Slunci v rovině profilu
   * → délka stínu jedné lamely na vodorovné rovině, podíl zastínění (nekonečná řada stejných lamel)
   */
  function stinLamely(o) {
    if (!(o.sz > 1e-6)) return { delkaStinu: Infinity, zastineni: 1, propustnost: 0, uhelProfilu: 0 };
    const be = rad(o.beta), c = Math.cos(be), s = Math.sin(be);
    let mn = Infinity, mx = -Infinity;
    for (const du of [-o.b / 2, o.b / 2]) for (const dv of [-o.t / 2, o.t / 2]) {
      const y = du * c - dv * s, z = du * s + dv * c, yp = y - z * o.sy / o.sz;
      mn = Math.min(mn, yp); mx = Math.max(mx, yp);
    }
    const l = mx - mn, f = Math.min(1, l / o.s);
    return { delkaStinu: l, zastineni: f, propustnost: 1 - f, uhelProfilu: deg(Math.atan2(o.sz, o.sy)) };
  }
  /** průchod přímého slunce lamelami a krokvemi pergoly v daný okamžik (UTC Date) */
  function prostupSlunce(p, datum) {
    const P = polohaSlunce(datum, p.sirkaGeo, p.delkaGeo);
    if (P.vyska <= 0) return { slunce: P, nadObzorem: false, propustnost: 0, lamely: null, krokve: null };
    const v = smerSlunceLokalne(P.vyska, P.azimut, p.orientace);
    const lam = p.krytina === 'lamely' ? stinLamely({ b: p.lamB, t: p.lamT, beta: p.sklon, s: p.roztecL, sy: v[1], sz: v[2] }) : { zastineni: 0, propustnost: 1, delkaStinu: 0 };
    const kr = stinLamely({ b: p.krokH, t: p.krokB, beta: 90, s: p._roztecKef || p.roztecK, sy: v[0], sz: v[2] });
    const T = (1 - lam.zastineni) * (1 - kr.zastineni);
    return { slunce: P, nadObzorem: true, smer: v, lamely: lam, krokve: kr, propustnost: T, zastineni: 1 - T };
  }
  /** denní průběh po 15 min v místním čase; vážený průměr zastínění (váha = sin výšky ≈ ozáření vodorovné plochy) */
  function denniPrubeh(p, datumStr, krokH) {
    krokH = krokH || 0.25;
    const body = []; let sv = 0, sz = 0, maxV = -90, poledne = null;
    for (let h = 3; h <= 22.001; h += krokH) {
      const r = prostupSlunce(p, utcZMistniho(datumStr, h, 'praha'));
      if (!r.nadObzorem) continue;
      const w = Math.sin(rad(r.slunce.vyska));
      sv += w; sz += w * r.zastineni;
      body.push({ hod: h, vyska: r.slunce.vyska, azimut: r.slunce.azimut, zastineni: r.zastineni, lamely: r.lamely.zastineni, krokve: r.krokve.zastineni });
      if (r.slunce.vyska > maxV) { maxV = r.slunce.vyska; poledne = body[body.length - 1]; }
    }
    return { body, prumer: sv > 0 ? sz / sv : 1, poledne };
  }
  /** rozteč lamel pro plný stín v pravé poledne daného dne (výchozí 21. 6.) */
  function navrhRozteceLamel(p, datumStr) {
    const rok = (/^(\d{4})/.exec(p.datum || '') || [0, 2026])[1];
    const d = denniPrubeh(Object.assign({}, p, { roztecL: 1e9 }), datumStr || `${rok}-06-21`, 1 / 12);
    if (!d.poledne) return null;
    const v = smerSlunceLokalne(d.poledne.vyska, d.poledne.azimut, p.orientace);
    const st = stinLamely({ b: p.lamB, t: p.lamT, beta: p.sklon, s: 1, sy: v[1], sz: v[2] });
    return { roztec: st.delkaStinu, cas: d.poledne.hod, vyska: d.poledne.vyska };
  }
  /** tabulka vlivu sklonu lamel: zastínění v poledne léta a zimy, denní průměr 21. 6. */
  function tabulkaSklonu(p) {
    const rok = (/^(\d{4})/.exec(p.datum || '') || [0, 2026])[1], out = [];
    for (const b of [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90]) {
      const q = Object.assign({}, p, { sklon: b });
      const l = denniPrubeh(q, `${rok}-06-21`, 0.5), z = denniPrubeh(q, `${rok}-12-21`, 0.5), r = denniPrubeh(q, `${rok}-03-20`, 0.5);
      out.push({ sklon: b, letoPoledne: l.poledne ? l.poledne.zastineni : 1, letoPrumer: l.prumer, rovnodennost: r.prumer, zimaPoledne: z.poledne ? z.poledne.zastineni : 1, zimaPrumer: z.prumer, skore: l.prumer - z.prumer });
    }
    let nej = out[0]; for (const r of out) if (r.skore > nej.skore + 1e-9) nej = r;
    out.doporuceny = nej.sklon;
    return out;
  }

  /* ---------------- 1D optimalizace řezů ---------------- */
  /**
   * kusy: [{delka, oznaceni}] (mm); o: {delky: obchodní délky, prorez: šířka řezu, orez: zaříznutí konce tyče}
   * → {tyce: [{delka, kusy, vyuzito, zbytek}], koupeno, cista, odpad, nadmerne}
   */
  function narezovyPlan(kusy, o) {
    o = Object.assign({ delky: OBCHODNI_DELKY, prorez: 4, orez: 20 }, o || {});
    const delky = o.delky.slice().sort((a, b) => a - b), Lmax = delky[delky.length - 1];
    const potreba = (k) => k.delka + o.prorez;
    const vse = kusy.slice().sort((a, b) => b.delka - a.delka);
    const nadmerne = vse.filter((k) => k.delka + o.orez + o.prorez > Lmax);
    const ok = vse.filter((k) => k.delka + o.orez + o.prorez <= Lmax);
    const vyuziti = (t) => o.orez + t.kusy.reduce((a, k) => a + potreba(k), 0);
    function ffd(kap, best) {
      const tyce = [];
      for (const k of ok) {
        if (potreba(k) + o.orez > kap) return null;
        let cil = null, zb = Infinity;
        for (const t of tyce) {
          const vol = kap - t.pouzito;
          if (vol >= potreba(k) && (!best ? !cil : vol - potreba(k) < zb)) { cil = t; zb = vol - potreba(k); if (!best) break; }
        }
        if (!cil) { cil = { delka: kap, kusy: [], pouzito: o.orez }; tyce.push(cil); }
        cil.kusy.push(k); cil.pouzito += potreba(k);
      }
      return tyce;
    }
    const zmensi = (tyce) => tyce.map((t) => { const u = vyuziti(t); return Object.assign(t, { delka: delky.find((d) => d >= u - 1e-9) || t.delka }); });
    const kandidati = [];
    for (const d of delky) { const t = ffd(d, false); if (t) kandidati.push(t); }
    for (const best of [false, true]) { const t = ffd(Lmax, best); if (t) kandidati.push(zmensi(t)); }
    let nej = null, nejD = Infinity;
    for (const t of kandidati) { const D = t.reduce((a, x) => a + x.delka, 0); if (D < nejD - 1e-6 || (Math.abs(D - nejD) < 1e-6 && t.length < nej.length)) { nej = t; nejD = D; } }
    const tyce = (nej || []).map((t) => ({ delka: t.delka, kusy: t.kusy, vyuzito: vyuziti(t), zbytek: t.delka - vyuziti(t), nadmerna: false }));
    for (const k of nadmerne) { const D = Math.ceil((k.delka + o.orez + o.prorez) / 500) * 500; tyce.push({ delka: D, kusy: [k], vyuzito: k.delka + o.orez + o.prorez, zbytek: D - k.delka - o.orez - o.prorez, nadmerna: true }); }
    const koupeno = tyce.reduce((a, t) => a + t.delka, 0), cista = kusy.reduce((a, k) => a + k.delka, 0);
    return { tyce, koupeno, cista, odpad: koupeno - cista, nadmerne: nadmerne.length };
  }
  /** rozdělí úsek [a, b] na díly ≤ max se styky jen v povolených místech (podpory) */
  function rozdelUsek(a, b, max, podpory) {
    if (b - a <= max) return [[a, b]];
    const P = (podpory || []).filter((x) => x > a + 1 && x < b - 1).sort((x, y) => x - y), out = [];
    let z = a;
    while (b - z > max) {
      let c = null;
      for (const x of P) if (x > z + 1 && x - z <= max) c = x;
      if (c == null) c = z + max; // bez vhodné podpory – styk mimo podporu (upozorní se)
      out.push([z, c]); z = c;
    }
    out.push([z, b]);
    return out;
  }

  /* ---------------- geometrie dílů ---------------- */
  const OSY = { x: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], y: [[0, 1, 0], [0, 0, 1], [1, 0, 0]], z: [[0, 0, 1], [1, 0, 0], [0, 1, 0]] };
  const kriz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function rohyDilu(d) {
    if (d.tvar === 'hranol') { const R = []; for (const z of [d.z0, d.z1]) for (const q of d.poly) R.push([q[0], q[1], z]); return R; }
    const R = [];
    for (const a of [-0.5, 0.5]) for (const b of [-0.5, 0.5]) for (const c of [-0.5, 0.5])
      R.push([0, 1, 2].map((i) => d.c[i] + d.u[i] * d.roz[0] * a + d.v[i] * d.roz[1] * b + d.w[i] * d.roz[2] * c));
    return R;
  }
  function mezeDilu(d) {
    const m = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
    for (const q of rohyDilu(d)) for (let i = 0; i < 3; i++) { m[2 * i] = Math.min(m[2 * i], q[i]); m[2 * i + 1] = Math.max(m[2 * i + 1], q[i]); }
    return m;
  }
  function objemDilu(d) {
    if (d.tvar === 'hranol') return Math.abs(plocha(d.poly)) * (d.z1 - d.z0);
    return d.roz[0] * d.roz[1] * d.roz[2];
  }
  function povrchDilu(d) { const [a, b, c] = d.roz; return 2 * (a * b + b * c + c * a); }
  function plocha(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function obvod(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; }

  function Stavba(typ, p) {
    this.typ = typ; this.p = p; this.dily = []; this.kroky = []; this.varovani = []; this.info = {}; this.statika = []; this.material = []; this.cit = {};
  }
  Stavba.prototype.krok = function (nazev, popis) { this.kroky.push({ nazev, popis: popis || '' }); return this.kroky.length - 1; };
  Stavba.prototype.var = function (uroven, text) { this.varovani.push({ uroven, text }); };
  Stavba.prototype.pridej = function (d) {
    const pref = d.prefix || 'D';
    this.cit[pref] = (this.cit[pref] || 0) + 1;
    d.id = pref + this.cit[pref];
    delete d.prefix;
    this.dily.push(d); return d;
  };
  /** kvádr rovnoběžný s osami; osa = směr délky dílu; rez = {profil:[a,b], pozn} pro kusovník řeziva */
  Stavba.prototype.kvadr = function (o, x0, x1, y0, y1, z0, z1) {
    const [u, v, w] = OSY[o.osa || 'x'];
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), dz = Math.abs(z1 - z0);
    const R = { x: [dx, dy, dz], y: [dy, dz, dx], z: [dz, dx, dy] }[o.osa || 'x'];
    const d = Object.assign({ tvar: 'kvadr', c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], roz: R, u, v, w }, o);
    if (d.drevo && !d.rez) d.rez = { profil: [Math.min(R[1], R[2]), Math.max(R[1], R[2])], delka: R[0] };
    else if (d.drevo) d.rez = Object.assign({ delka: R[0] }, d.rez);
    return this.pridej(d);
  };
  /** kvádr mezi dvěma body (osa dílu = AB), průřez a × b, v = směr strany a (kolmo k AB) */
  Stavba.prototype.meziBody = function (o, A, B, a, b, v) {
    const u = norm([B[0] - A[0], B[1] - A[1], B[2] - A[2]]), L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    const vv = norm(v), w = kriz(u, vv);
    const d = Object.assign({ tvar: 'kvadr', c: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], roz: [L, a, b], u, v: vv, w }, o);
    if (d.drevo) d.rez = Object.assign({ profil: [Math.min(a, b), Math.max(a, b)], delka: L }, d.rez || {});
    return this.pridej(d);
  };
  Stavba.prototype.hranol = function (o, poly, z0, z1) { return this.pridej(Object.assign({ tvar: 'hranol', poly, z0, z1 }, o)); };
  Stavba.prototype.mat = function (klic, mnozstvi, pozn) {
    if (!(mnozstvi > 0)) return;
    const e = this.material.find((m) => m.klic === klic && m.pozn === (pozn || ''));
    if (e) e.mnozstvi += mnozstvi; else this.material.push({ klic, mnozstvi, pozn: pozn || '' });
  };

  /* ---------------- obrys záhonu ---------------- */
  function obrysZahonu(p) {
    const L = p.delka, W = p.sirka, B = p.delkaB;
    if (p.tvar === 'L') return [[0, 0], [L, 0], [L, W], [W, W], [W, B], [0, B]];
    if (p.tvar === 'U') return [[0, 0], [L, 0], [L, B], [L - W, B], [L - W, W], [W, W], [W, B], [0, B]];
    return [[0, 0], [L, 0], [L, W], [0, W]];
  }
  function hranyPolygonu(P) {
    const n = P.length, H = [];
    for (let k = 0; k < n; k++) {
      const A = P[k], B = P[(k + 1) % n], l = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const d = [(B[0] - A[0]) / l, (B[1] - A[1]) / l];
      H.push({ k, A, B, l, d, n: [-d[1], d[0]] });
    }
    for (let k = 0; k < n; k++) {
      const a = H[(k - 1 + n) % n].d, b = H[k].d;
      H[k].konvexZac = a[0] * b[1] - a[1] * b[0] > 0;
      H[(k - 1 + n) % n].konvexKon = H[k].konvexZac;
    }
    return H;
  }
  /** vnitřní obrys odsazený o t (pravoúhlý polygon, CCW) */
  function odsad(P, t) {
    const H = hranyPolygonu(P), n = P.length;
    return P.map((q, k) => { const a = H[(k - 1 + n) % n].n, b = H[k].n; return [q[0] + t * (a[0] + b[0]), q[1] + t * (a[1] + b[1])]; });
  }
  /** pás podél hrany: rozsah s (podél hrany) se střídáním rohů; hloubka od −ov do w − ov */
  function pasHrany(h, w, ov, radek) {
    const vlastniZac = (radek + h.k) % 2 === 1, vlastniKon = (radek + h.k + 1) % 2 === 0;
    const s0 = h.konvexZac ? (vlastniZac ? -ov : w - ov) : (vlastniZac ? -(w - ov) : ov);
    const s1 = h.konvexKon ? (vlastniKon ? h.l + ov : h.l - (w - ov)) : (vlastniKon ? h.l + (w - ov) : h.l - ov);
    return { s0, s1 };
  }
  const bodHrany = (h, s, hl) => [h.A[0] + s * h.d[0] + hl * h.n[0], h.A[1] + s * h.d[1] + hl * h.n[1]];

  /* ---------------- VYVÝŠENÝ ZÁHON ---------------- */
  function vrstvyAuto(vyskaNaplne) {
    if (vyskaNaplne < 350) return [{ id: 'kompost', tl: Math.round(vyskaNaplne * 0.35) }, { id: 'zemina', tl: vyskaNaplne - Math.round(vyskaNaplne * 0.35) }];
    const ids = ['vetve', 'stepka', 'listi', 'kompost', 'zemina'];
    const zem = Math.max(200, Math.round(vyskaNaplne * VRSTVY.zemina.podil));
    const zbyva = vyskaNaplne - zem, sp = ids.slice(0, 4).reduce((a, i) => a + VRSTVY[i].podil, 0);
    const out = ids.slice(0, 4).map((i) => ({ id: i, tl: Math.floor(zbyva * VRSTVY[i].podil / sp) }));
    out.push({ id: 'zemina', tl: vyskaNaplne - out.reduce((a, v) => a + v.tl, 0) });
    return out;
  }
  /** objemy vrstev náplně: plocha vnitřku [mm²], vrstvy [{id, tl}] → m³, hmotnost, sesednutí */
  function objemVrstev(plochaMm2, vrstvy) {
    let z = 0;
    const out = vrstvy.map((v) => {
      const V = VRSTVY[v.id] || VRSTVY.zemina, obj = plochaMm2 * v.tl / 1e9;
      const r = { id: v.id, nazev: V.nazev, tl: v.tl, z0: z, z1: z + v.tl, objem: obj, litry: obj * 1000, hmotnost: obj * V.hustota, sesednuti: v.tl * V.sesedani, barva: V.barva };
      z += v.tl; return r;
    });
    const celkem = out.reduce((a, v) => a + v.objem, 0), ses = out.reduce((a, v) => a + v.sesednuti, 0);
    return { vrstvy: out, objem: celkem, hmotnost: out.reduce((a, v) => a + v.hmotnost, 0), sesednuti: ses, dosypat: plochaMm2 * ses / 1e9 };
  }

  function zahon(p) {
    const S = new Stavba('zahon', p), M = MATERIALY[p.material];
    const t = p.prknoT, b = p.prknoB, ps = p.sloupek;
    if (p.tvar === 'L' && !(p.delka > p.sirka + 200 && p.delkaB > p.sirka + 200)) S.var('chyba', 'Záhon do L: obě ramena musí být delší než šířka ramene + 20 cm.');
    if (p.tvar === 'U' && !(p.delka >= 2 * p.sirka + 300 && p.delkaB > p.sirka + 200)) S.var('chyba', 'Záhon do U: délka musí být aspoň 2 × šířka ramene + 30 cm a ramena delší než jejich šířka.');
    const P = obrysZahonu(p), H = hranyPolygonu(P), Q = odsad(P, t);
    // řady prken
    let nr = Math.max(1, Math.ceil(p.vyska / b - 1e-6)), posledni = p.vyska - (nr - 1) * b;
    if (posledni < 30 && nr > 1) { nr -= 1; posledni = b; }
    const Hc = (nr - 1) * b + posledni;
    const hNapl = Math.max(0, Hc - p.rezerva);
    const Z = ZEMINY[p.zemina] || ZEMINY.vlhka, zt = zemniTlak(Z.gama, Z.phi, hNapl / 1000, p.pritizeni);
    // zatížení řad a limitní rozpětí
    const rady = [];
    for (let r = 0; r < nr; r++) {
      const z0 = r * b, z1 = r === nr - 1 ? Hc : (r + 1) * b, bb = z1 - z0;
      const q = zatizeniPasu((hNapl - z1) / 1000, (hNapl - z0) / 1000, zt.K0, Z.gama, p.pritizeni);
      rady.push({ r, z0, z1, b: bb, q, Lmax: maxRozpetiPrkna({ q, b: bb, t, mat: p.material, limitN: p.limitN }) });
    }
    const LmaxStat = Math.min(...rady.map((r) => r.Lmax));
    const Lmax = p.roztecMax > 0 ? Math.min(p.roztecMax, Number.isFinite(LmaxStat) ? LmaxStat * 10 : Infinity) : LmaxStat;
    if (p.roztecMax > 0 && p.roztecMax > LmaxStat) S.var('varovani', `Zadaná největší rozteč sloupků ${fmt(p.roztecMax)} mm je větší než staticky vyhovující ${fmt(LmaxStat)} mm – prkna se budou vyboulit.`);
    const kPodklad = S.krok('Podklad a pletivo', 'Vytyčte půdorys, odstraňte drn (obraťte ho – použije se do náplně), urovnejte a zhutněte podklad, případně pás štěrku pod stěny. Rozviňte pletivo proti hryzcům.');
    const kSloup = S.krok('Rohové sloupky', 'Osaďte rohové sloupky do svislice' + (p.zapusteni > 0 ? ` (zapuštění ${fmt(p.zapusteni)} mm do štěrkového lože)` : '') + '.');
    const kRady = [];
    for (let r = 0; r < nr; r++) kRady.push(S.krok(`Prkna – ${r + 1}. řada`, r === 0 ? 'První řadu vyrovnejte vodováhou – určuje rovinu celé stěny. Prkna přišroubujte ke sloupkům 2 vruty na každý sloupek.' : 'Další řada; rohy střídejte (přesah prken na vazbu).'));
    // sloupky
    const sloupky = [];
    H.forEach((h) => {
      if (h.konvexZac) { const c = bodHrany(h, t + ps / 2, t + ps / 2); sloupky.push({ c, typ: 'roh', k: h.k }); }
      else { const c = [h.A[0] - ps / 2 * (h.n[0] + h.d[0]), h.A[1] - ps / 2 * (h.n[1] + h.d[1])]; sloupky.push({ c, typ: 'vnejsi', k: h.k }); }
    });
    const kMezi = S.krok(p.vyztuha === 'tahla' ? 'Středové sloupky a táhla' : 'Středové sloupky', p.vyztuha === 'tahla' ? 'Mezi protilehlé středové sloupky provlečte závitové tyče s velkoplošnými podložkami – zachytí tlak zeminy (proti vyboulení).' : 'Středové sloupky zapusťte do země / do štěrku a přišroubujte k prknům – drží stěnu proti vyboulení.');
    const hranyInfo = [];
    H.forEach((h) => {
      const sA = h.konvexZac ? t + ps / 2 : ps / 2, sB = h.konvexKon ? h.l - t - ps / 2 : h.l - ps / 2;
      const pp = pocetPoli(sB - sA, Lmax);
      const podpory = [sA, sB];
      for (let j = 1; j < pp.pole; j++) {
        const s = sA + j * (sB - sA) / pp.pole; podpory.push(s);
        sloupky.push({ c: bodHrany(h, s, t + ps / 2), typ: 'mezi', k: h.k, s });
      }
      hranyInfo.push({ k: h.k, delka: h.l, rozpeti: pp.roztec, pole: pp.pole, podpory: podpory.sort((a, b2) => a - b2) });
    });
    const zSl0 = -p.zapusteni, zSl1 = Hc;
    for (const s of sloupky) {
      s.dil = S.kvadr({ prefix: 'S', skup: 'sloupek', nazev: s.typ === 'mezi' ? 'Středový sloupek' : s.typ === 'roh' ? 'Rohový sloupek' : 'Rohový sloupek (vnější kout)', mat: 'drevo', drevo: true, osa: 'z', krok: s.typ === 'mezi' ? kMezi : kSloup },
        s.c[0] - ps / 2, s.c[0] + ps / 2, s.c[1] - ps / 2, s.c[1] + ps / 2, zSl0, zSl1);
    }
    // prkna
    let vrutyPrkna = 0;
    for (let r = 0; r < nr; r++) {
      const R = rady[r];
      for (const h of H) {
        const { s0, s1 } = pasHrany(h, t, 0, r);
        const A = bodHrany(h, s0, 0), B = bodHrany(h, s1, t);
        const osa = Math.abs(h.d[0]) > 0.5 ? 'x' : 'y';
        const roz = R.b < b - 0.5 ? { profil: [t, b], pozn: `podélně rozříznout na ${fmt(R.b)} mm` } : null;
        S.kvadr({ prefix: 'P', skup: 'prkno', nazev: `Prkno stěny ${h.k + 1}, řada ${r + 1}`, mat: 'drevo', drevo: true, osa, krok: kRady[r], rez: roz, hrana: h.k, radek: r },
          Math.min(A[0], B[0]), Math.max(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[1], B[1]), R.z0, R.z1);
        const n = hranyInfo[h.k].podpory.filter((s) => s >= s0 - 1 && s <= s1 + 1).length;
        vrutyPrkna += 2 * n;
      }
    }
    S.mat('vrut5', vrutyPrkna, `5 × ${delkaVrutu(t + 35)} (prkna – sloupky)`);
    // táhla
    let tahla = 0, silaTahla = 0;
    const mezi = sloupky.filter((s) => s.typ === 'mezi');
    const zemTlakPole = (a) => ({ Ftr: a / 1000 * zt.Etr, Fq: a / 1000 * zt.Eq });
    const sekce = [];
    if (mezi.length) {
      const amax = Math.max(...hranyInfo.filter((x) => x.pole > 1).map((x) => x.rozpeti));
      const { Ftr, Fq } = zemTlakPole(amax), hn = hNapl / 1000, Wp = ps * ps * ps / 6;
      if (p.vyztuha === 'tahla') {
        const T = Ftr / 3 + Fq / 2, Mm = 0.1283 * Ftr * hn + Fq * hn / 8;
        silaTahla = T;
        const sig = GAMA_G * Mm * 1e6 / Wp;
        S.statika.push({ prvek: `Středový sloupek ${ps}×${ps} (táhlo nahoře)`, popis: `pole ${fmt(amax)} mm, síla od zeminy ${fmt(Ftr + Fq, 2)} kN`, vyuziti: sig / fd(M.fmk, KMOD.stale), detail: `σ = ${fmt(sig, 1)} MPa ≤ ${fmt(fd(M.fmk, KMOD.stale), 1)} MPa` });
        const Td = GAMA_G * T, FtRd = 0.9 * 400 * 36.6 / 1.25 / 1000;
        S.statika.push({ prvek: 'Táhlo M8 (4.6)', popis: `síla v táhle ${fmt(T, 2)} kN (návrhová ${fmt(Td, 2)} kN)`, vyuziti: Td / FtRd, detail: `únosnost v tahu ${fmt(FtRd, 1)} kN` });
        const Ds = [24, 30, 40, 50, 60], D = Ds.find((x) => unosnostPodlozky(x, 9, p.material) * 0.85 >= Td) || 60;
        S.statika.push({ prvek: `Podložka táhla ⌀ ${D} mm`, popis: 'otlačení dřeva kolmo k vláknům', vyuziti: Td / unosnostPodlozky(D, 9, p.material), detail: `únosnost ${fmt(unosnostPodlozky(D, 9, p.material), 2)} kN${D > 30 ? ' – použijte plech / dřevěnou příložku' : ''}` });
        sekce.push(['Táhla', `M8, síla ${fmt(T, 2)} kN, podložka ⌀ ${D} mm`]);
      } else {
        const Mm = Ftr * hn / 3 + Fq * hn / 2, sig = GAMA_G * Mm * 1e6 / Wp;
        S.statika.push({ prvek: `Středový sloupek ${ps}×${ps} (vetknutý v zemi)`, popis: `pole ${fmt(amax)} mm, moment u terénu ${fmt(Mm, 2)} kNm`, vyuziti: sig / fd(M.fmk, KMOD.stale), detail: `σ = ${fmt(sig, 1)} MPa ≤ ${fmt(fd(M.fmk, KMOD.stale), 1)} MPa` });
        if (p.zapusteni < 0.5 * Hc) S.var('varovani', `Středové sloupky jsou zapuštěné jen ${fmt(p.zapusteni)} mm (doporučeno ≥ ${fmt(0.5 * Hc)} mm = polovina výšky). Bez táhel je jejich vetknutí v měkké zemi nespolehlivé – zvolte výztuhu „táhla“.`);
      }
    }
    if (p.vyztuha === 'tahla') {
      const klice = new Set();
      for (const s of mezi) {
        const h = H[s.k];
        // paprsek dovnitř po normále, nejbližší protilehlá hrana
        let nej = null;
        for (const o of H) {
          if (o.k === h.k || Math.abs(o.n[0] + h.n[0]) > 1e-6 || Math.abs(o.n[1] + h.n[1]) > 1e-6) continue;
          const osaX = Math.abs(h.n[0]) > 0.5, val = osaX ? o.A[0] : o.A[1], start = osaX ? s.c[0] : s.c[1];
          const dist = (val - start) * (osaX ? h.n[0] : h.n[1]);
          const kolmo = osaX ? s.c[1] : s.c[0], a = osaX ? Math.min(o.A[1], o.B[1]) : Math.min(o.A[0], o.B[0]), bb = osaX ? Math.max(o.A[1], o.B[1]) : Math.max(o.A[0], o.B[0]);
          if (dist > 0 && kolmo > a && kolmo < bb && (!nej || dist < nej.dist)) nej = { o, dist };
        }
        if (!nej || nej.dist > 2600) continue;
        const A = [s.c[0] - h.n[0] * (ps / 2 + t + 25), s.c[1] - h.n[1] * (ps / 2 + t + 25)];
        const B = [s.c[0] + h.n[0] * (nej.dist - ps / 2 + 25), s.c[1] + h.n[1] * (nej.dist - ps / 2 + 25)];
        const key = [A, B].map((q) => q.map((x) => Math.round(x / 40)).join(',')).sort().join('|');
        if (klice.has(key)) continue;
        // u protilehlé strany: zkusit spárovat se sloupkem (jinak podložka na prkno)
        klice.add(key);
        const zT = Hc - Math.min(b, 120) / 2;
        S.meziBody({ prefix: 'T', skup: 'tahlo', nazev: 'Táhlo M8', mat: 'ocel', krok: kMezi }, [A[0], A[1], zT], [B[0], B[1], zT], 8, 8, [0, 0, 1]);
        const kl2 = [B, A].map((q) => q.map((x) => Math.round(x / 40)).join(',')).sort().join('|'); klice.add(kl2);
        tahla++;
        S.mat('tyc8', Math.hypot(B[0] - A[0], B[1] - A[1]) / 1000, '');
      }
      S.mat('matice8', tahla * 2, 'na každé táhlo 2 matice + 2 velkoplošné podložky');
      if (!tahla && mezi.length) S.var('info', 'Táhla se nenašla (protilehlé stěny jsou dál než 2,6 m) – středové sloupky zapusťte do země.');
    }
    // horní lišta
    if (p.horniLista) {
      const kL = S.krok('Horní lišta / sedátko', 'Krycí lišta chrání čela prken před vodou (hrana s mírným spádem ven) a slouží k opření nebo sezení.');
      for (const h of H) {
        const { s0, s1 } = pasHrany(h, p.listaB, p.listaPresah, 0);
        const A = bodHrany(h, s0, -p.listaPresah), B = bodHrany(h, s1, p.listaB - p.listaPresah);
        const osa = Math.abs(h.d[0]) > 0.5 ? 'x' : 'y';
        S.kvadr({ prefix: 'L', skup: 'lista', nazev: `Horní lišta stěny ${h.k + 1}`, mat: 'drevo', drevo: true, osa, krok: kL },
          Math.min(A[0], B[0]), Math.max(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[1], B[1]), Hc, Hc + p.listaT);
        S.mat('vrut5', 2 * Math.ceil((s1 - s0) / 400) + 2, `5 × ${delkaVrutu(p.listaT + 40)} (lišta)`);
      }
    }
    // pletivo a fólie
    const aIn = Math.abs(plocha(Q)) - sloupky.filter((s) => s.typ !== 'vnejsi').length * ps * ps, oIn = obvod(Q);
    if (p.pletivo) {
      S.hranol({ prefix: 'Z', skup: 'pletivo', nazev: 'Pletivo proti hryzcům', mat: 'pletivo', krok: kPodklad }, Q, -6, -2);
      S.mat('pletivo', (Math.abs(plocha(Q)) + oIn * 150) / 1e6 * 1.05, 'dno + vytažení 15 cm na stěny, přesahy 5 %');
      S.mat('sponky', Math.ceil(oIn / 100), 'pletivo ke stěnám á 10 cm');
    }
    let kFol = null;
    if (p.folie !== 'zadna') {
      kFol = S.krok('Fólie na stěny', (p.folie === 'nopova' ? 'Nopovou fólii (nopy ke dřevu – vzduchová mezera)' : 'PE fólii') + ' připevněte sponkami na vnitřní stranu stěn; dno nechte otevřené kvůli odtoku vody.');
      const Qf = odsad(P, t + 2);
      const Hf = H.map((h) => h);
      const hf = hranyPolygonu(Qf);
      for (const h of hf) {
        const A = bodHrany(h, 0, 0), B = bodHrany(h, h.l, 2);
        S.kvadr({ prefix: 'F', skup: 'folie', nazev: 'Fólie', mat: 'folie', osa: Math.abs(h.d[0]) > 0.5 ? 'x' : 'y', krok: kFol }, Math.min(A[0], B[0]), Math.max(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[1], B[1]), 0, Hc - 30);
      }
      void Hf;
      S.mat(p.folie === 'nopova' ? 'folieNop' : 'foliePE', oIn * (Hc - 30 + 100) / 1e6 * 1.1, 'vnitřní strana stěn, přesahy 10 %');
      S.mat('sponky', Math.ceil(oIn / 150) * 2, 'fólie á 15 cm ve dvou řadách');
    }
    // náplň
    let vrstvy = p.vrstvyAuto || !Array.isArray(p.vrstvy) || !p.vrstvy.length ? vrstvyAuto(hNapl) : p.vrstvy.map((v) => ({ id: v.id, tl: Math.max(0, cislo(v.tl, 0)) }));
    if (!p.vrstvyAuto && Array.isArray(p.vrstvy) && p.vrstvy.length) {
      const sp = vrstvy.slice(0, -1).reduce((a, v) => a + v.tl, 0);
      vrstvy[vrstvy.length - 1].tl = Math.max(0, hNapl - sp);
      if (sp > hNapl) S.var('chyba', `Vrstvy náplně (${fmt(sp)} mm bez horní) jsou vyšší než výška náplně ${fmt(hNapl)} mm.`);
    }
    const N = objemVrstev(aIn, vrstvy);
    const top = vrstvy[vrstvy.length - 1];
    if (top && top.id === 'zemina' && top.tl < 200 && hNapl >= 300) S.var('varovani', `Osevní vrstva má jen ${fmt(top.tl)} mm – pro zeleninu volte aspoň 200–250 mm.`);
    N.vrstvy.forEach((v, i) => {
      const k = S.krok(`Náplň – ${v.nazev.split(',')[0].toLowerCase()}`, `${fmt(v.tl)} mm, ${fmt(v.objem, 2)} m³` + (i === 0 ? '. Hrubý materiál dole zajišťuje drenáž.' : '.'));
      if (v.tl > 0) S.hranol({ prefix: 'N', skup: 'napln', nazev: v.nazev, mat: 'vrstva', barva: v.barva, krok: k, vrstva: v.id }, odsad(P, t + 3), v.z0, v.z1);
    });
    if (p.nakupNaplne) { const z = N.vrstvy.filter((v) => v.id === 'zemina').reduce((a, v) => a + v.objem, 0), k = N.vrstvy.filter((v) => v.id === 'kompost').reduce((a, v) => a + v.objem, 0); S.mat('zemina', z, 'osevní vrstva'); S.mat('kompost', k, 'hrubý kompost'); }
    S.napln = Object.assign(N, { plocha: aIn, vyska: hNapl, obvod: oIn });
    // statika prken
    const nejR = rady.reduce((a, r) => (r.q > a.q ? r : a), rady[0]);
    const amaxH = Math.max(...hranyInfo.map((x) => x.rozpeti));
    const pos = posudekPrkna({ L: amaxH, q: nejR.q, b: nejR.b, t, mat: p.material, limitN: p.limitN });
    S.statika.unshift({ prvek: `Spodní prkno ${t}×${fmt(nejR.b)} mm`, popis: `rozpětí ${fmt(amaxH)} mm, tlak zeminy ${fmt(nejR.q, 3)} kN/m`, vyuziti: Math.max(pos.vyuzitiOhyb, pos.vyuzitiPruhyb), detail: `σ = ${fmt(pos.sigma, 1)} / ${fmt(pos.f, 1)} MPa, průhyb konečný ${fmt(pos.wFin, 1)} mm ≤ L/${p.limitN} = ${fmt(pos.wLim, 1)} mm` });
    S.zemniTlak = Object.assign(zt, { hNapl, gama: Z.gama, phi: Z.phi, rady, Lmax: LmaxStat });
    // ergonomie
    const U = UZIVATELE[p.uzivatel] || UZIVATELE.stojici, Hh = Hc + (p.horniLista ? p.listaT : 0);
    const maxSirka = U.dosah * (p.pristup === 'oboustranny' ? 2 : 1);
    if (Hh < U.vyska[0] || Hh > U.vyska[1]) S.var('info', `Pro uživatele „${U.nazev}“ je doporučená výška horní hrany ${fmt(U.vyska[0] / 10)}–${fmt(U.vyska[1] / 10)} cm (teď ${fmt(Hh / 10)} cm).`);
    if (p.sirka > maxSirka) S.var('varovani', `Šířka ${fmt(p.sirka / 10)} cm je větší než pohodlný dosah (${U.nazev}, ${p.pristup === 'oboustranny' ? 'z obou stran' : 'z jedné strany'}: max. ${fmt(maxSirka / 10)} cm).`);
    if (p.uzivatel === 'vozik') {
      S.var('info', 'Pro vozíčkáře: zpevněný chodník kolem záhonu ≥ 90 cm (otáčení 150 cm), lišta široká 12–15 cm na opření loktů. Přístup čelně vyžaduje stolový záhon s podjezdem pro kolena (≥ 65 cm).');
      if (p.tvar === 'U' && p.delka - 2 * p.sirka < 1500) S.var('varovani', `Vnitřek U je široký ${fmt((p.delka - 2 * p.sirka) / 10)} cm – vozík se otočí až na 150 cm.`);
    }
    if (p.uzivatel === 'sedici' && (!p.horniLista || p.listaB < 140)) S.var('info', 'Pro sezení na okraji zvolte horní lištu širokou aspoň 14–16 cm.');
    if (p.tvar === 'U' && p.delka - 2 * p.sirka < 600) S.var('varovani', 'Vnitřní prostor U je užší než 60 cm – špatně se do něj chodí.');
    if (t < 25 && Hc > 500) S.var('varovani', `Prkna tloušťky ${t} mm jsou na výšku ${fmt(Hc)} mm tenká – volte aspoň 28–40 mm.`);
    if (posledni < b - 0.5) S.var('info', `Horní řada je podélně rozříznutá na ${fmt(posledni)} mm (výška ${fmt(Hc)} mm není násobkem šířky prkna).`);
    if (M.trv >= 4 && p.ochrana === 'bez') S.var('varovani', `${M.nazev} je málo trvanlivé (třída ${M.trv}) – bez ochrany vydrží v kontaktu se zeminou jen několik let. Zvolte KDI, nátěr nebo modřín/dub/akát.`);
    S.info = {
      'Tvar': { obdelnik: 'obdélník', L: 'do L', U: 'do U' }[p.tvar] || p.tvar,
      'Vnější rozměr': p.tvar === 'obdelnik' ? `${fmt(p.delka)} × ${fmt(p.sirka)} mm` : `${fmt(p.delka)} × ${fmt(p.delkaB)} mm, rameno ${fmt(p.sirka)} mm`,
      'Výška stěny': `${fmt(Hc)} mm (${nr} řad prken)` + (p.horniLista ? ` + lišta ${p.listaT} mm` : ''),
      'Výška náplně': `${fmt(hNapl)} mm`,
      'Zemní tlak v klidu': `K0 = ${fmt(zt.K0, 3)}, u dna ${fmt(zt.pDole, 2)} kPa, výslednice ${fmt(zt.E, 2)} kN/m`,
      'Největší rozteč sloupků (statika)': Number.isFinite(LmaxStat) ? `${fmt(LmaxStat)} mm` : 'neomezeno',
      'Sloupky': `${sloupky.length} ks (${sloupky.filter((s) => s.typ === 'mezi').length} středových)`,
      'Vnitřní plocha': `${fmt(aIn / 1e6, 2)} m²`,
      'Objem náplně': `${fmt(N.objem, 2)} m³ (${fmt(N.objem * 1000)} l)`,
      'Sesednutí za 1. rok': `≈ ${fmt(N.sesednuti / 10)} cm (dosypat ≈ ${fmt(N.dosypat, 2)} m³)`,
    };
    if (tahla) S.info['Táhla'] = `${tahla} ks M8, síla ${fmt(silaTahla, 2)} kN`;
    S.hrany = hranyInfo; S.obrys = P; S.obrysVnitrni = Q; S.vyska = Hc;
    return S;
  }

  /* ---------------- KOMPOSTÉR ---------------- */
  function komposter(p) {
    const S = new Stavba('komposter', p), M = MATERIALY[p.material];
    const n = omez(Math.round(p.komor), 1, 3), W = p.sirkaKomory, D = p.hloubka, ps = p.sloupek, t = p.lamelaT, b = p.lamelaB, m = p.mezera;
    const Xt = n * W + (n + 1) * ps, Dt = D + 2 * ps;
    const z0 = p.odsazeni;
    const rady = Math.max(1, Math.floor((p.vyska - z0 + m) / (b + m) + 1e-6));
    const Hc = z0 + rady * (b + m) - m;
    const lt = p.listaB, lw = p.listaH, v = p.vule;
    const slot = lt + t + v; // od čela sloupku k zadní liště
    if (2 * lt + t + v > ps + 30) S.var('varovani', `Vodicí lišty (${lt} + ${fmt(t + v)} + ${lt} mm) jsou hlubší než sloupek ${ps} mm – lišty budou přečnívat dozadu.`);
    const kKotv = S.krok('Kotvení', { zemni_vrut: 'Zatlučte / zašroubujte zemní vruty pro sloupky do roviny a svislice.', zapustit: 'Vykopejte jamky, na dno štěrk, sloupky zapusťte a obsypte štěrkem (ne beton – dřevo by v něm hnilo).', kameny: 'Pod sloupky položte betonové dlaždice nebo kameny do roviny.' }[p.kotveni] || '');
    const kSl = S.krok('Sloupky', 'Postavte sloupky, zavětrujte je latí a zkontrolujte úhlopříčky.');
    const kZad = S.krok('Zadní stěna', `Lamely s mezerami ${m} mm (větrání) – použijte rozpěrku stejné tloušťky.`);
    const kBok = S.krok('Boční stěny', 'Lamely bočních stěn, opět s mezerami.');
    const kPr = n > 1 ? S.krok('Přepážky', 'Přepážky mezi komorami (lamely na bocích středových sloupků).') : null;
    const kLi = S.krok('Vodicí lišty (drážky)', `Na čela sloupků připevněte lišty ${lt}×${lw} mm, mezi nimi drážka ${fmt(t + v)} mm pro vyjímatelná čela.`);
    const kCe = S.krok('Vyjímatelná čela', 'Prkna čela zasunujte shora do drážek podle toho, jak komora plní.');
    const kPl = p.pletivo ? S.krok('Pletivo na dno', 'Pletivo proti hryzcům pod každou komoru, okraje vytáhnout 10 cm na stěny.') : null;
    const zs0 = p.kotveni === 'zapustit' ? -Math.max(300, p.zapusteni) : p.kotveni === 'kameny' ? 0 : 0;
    const xs = []; for (let i = 0; i <= n; i++) xs.push(i * (W + ps));
    let vruty = 0;
    for (const x of xs) for (const y of [0, Dt - ps]) {
      S.kvadr({ prefix: 'S', skup: 'sloupek', nazev: 'Sloupek', mat: 'drevo', drevo: true, osa: 'z', krok: kSl }, x, x + ps, y, y + ps, zs0, Hc);
      if (p.kotveni === 'zemni_vrut') S.kvadr({ prefix: 'K', skup: 'kotva', nazev: 'Zemní vrut', mat: 'ocel', osa: 'z', krok: kKotv }, x + ps / 2 - 35, x + ps / 2 + 35, y + ps / 2 - 35, y + ps / 2 + 35, -700, 0);
      if (p.kotveni === 'kameny') S.kvadr({ prefix: 'K', skup: 'kotva', nazev: 'Dlaždice', mat: 'beton', osa: 'x', krok: kKotv }, x + ps / 2 - 150, x + ps / 2 + 150, y + ps / 2 - 150, y + ps / 2 + 150, -50, 0);
    }
    const nSl = xs.length * 2;
    if (p.kotveni === 'zemni_vrut') { S.mat('zemniVrut', nSl, ''); S.mat('vrut8', nSl * 2, '8 × 100 do objímky vrutu'); }
    if (p.kotveni === 'kameny') S.mat('kamen', nSl, '');
    if (p.kotveni === 'zapustit') S.mat('sterk', nSl * 0.3 * 0.3 * 0.4, 'obsyp sloupků');
    for (let r = 0; r < rady; r++) {
      const za = z0 + r * (b + m), zb = za + b;
      // zadní
      S.kvadr({ prefix: 'Z', skup: 'lamela', nazev: 'Lamela zadní stěny', mat: 'drevo', drevo: true, osa: 'x', krok: kZad }, -t, Xt + t, Dt, Dt + t, za, zb); vruty += 2 * (n + 1);
      // boky
      for (const [xa, xb] of [[-t, 0], [Xt, Xt + t]]) { S.kvadr({ prefix: 'B', skup: 'lamela', nazev: 'Lamela boční stěny', mat: 'drevo', drevo: true, osa: 'y', krok: kBok }, xa, xb, 0, Dt, za, zb); vruty += 4; }
      // přepážky
      for (let i = 1; i < n; i++) { const x = xs[i] + ps; S.kvadr({ prefix: 'R', skup: 'lamela', nazev: 'Lamela přepážky', mat: 'drevo', drevo: true, osa: 'y', krok: kPr }, x, x + t, slot + lt, Dt - ps, za, zb); vruty += 2; }
    }
    // lišty – na čele sloupků vždy dvě (vnější a vnitřní) na straně ke komoře
    let vrutyL = 0;
    for (let i = 0; i <= n; i++) {
      const x = xs[i];
      const strany = []; if (i > 0) strany.push([x - lw, x]); if (i < n) strany.push([x + ps, x + ps + lw]);
      for (const [xa, xb] of strany) for (const [ya, yb] of [[0, lt], [lt + t + v, 2 * lt + t + v]]) {
        S.kvadr({ prefix: 'V', skup: 'lista', nazev: 'Vodicí lišta drážky', mat: 'drevo', drevo: true, osa: 'z', krok: kLi }, xa, xb, ya, yb, z0, Hc);
        vrutyL += Math.ceil((Hc - z0) / 250) + 1;
      }
    }
    // čela – plná výška, prkna těsně na sebe
    const radyC = Math.max(1, Math.ceil((Hc - z0) / b - 1e-6));
    for (let i = 0; i < n; i++) {
      const xa = xs[i] + ps + v, xb = xs[i + 1] - v;
      for (let r = 0; r < radyC; r++) {
        const za = z0 + r * b, zb = Math.min(Hc, za + b);
        S.kvadr({ prefix: 'C', skup: 'celo', nazev: `Vyjímatelné čelo komory ${i + 1}`, mat: 'drevo', drevo: true, osa: 'x', krok: kCe, komora: i, rez: zb - za < b - 0.5 ? { profil: [t, b], pozn: `podélně na ${fmt(zb - za)} mm` } : null }, xa, xb, lt, lt + t, za, zb);
      }
    }
    if (p.pletivo) for (let i = 0; i < n; i++) {
      S.kvadr({ prefix: 'Q', skup: 'pletivo', nazev: 'Pletivo dna', mat: 'pletivo', osa: 'x', krok: kPl }, xs[i] + ps, xs[i + 1], ps, Dt - ps, -6, -2);
    }
    if (p.pletivo) { S.mat('pletivo', n * (W + 200) * (D + 200) / 1e6, 'dno + 10 cm na stěny'); S.mat('sponky', n * Math.ceil(2 * (W + D) / 100), ''); }
    S.mat('vrut5', vruty, `5 × ${delkaVrutu(t + 35)} (lamely – sloupky)`);
    S.mat('vrut5', vrutyL, `4–5 × ${delkaVrutu(lw + 25)} (lišty)`);
    // statika: tlak kompostu na lamely a čela
    const Z = ZEMINY.kompost, hk = (Hc - z0) / 1000, zt = zemniTlak(Z.gama, Z.phi, hk, 0);
    const qC = zatizeniPasu(hk - b / 1000, hk, zt.K0, Z.gama, 0);
    const pc = posudekPrkna({ L: W + 2 * lw * 0.5, q: qC, b, t, mat: p.material, limitN: p.limitN });
    S.statika.push({ prvek: `Spodní čelo ${t}×${b} (rozpětí ${fmt(W)} mm)`, popis: `tlak kompostu ${fmt(qC, 3)} kN/m`, vyuziti: Math.max(pc.vyuzitiOhyb, pc.vyuzitiPruhyb), detail: `průhyb ${fmt(pc.wFin, 1)} mm ≤ L/${p.limitN} = ${fmt(pc.wLim, 1)} mm` });
    const qB = zatizeniPasu(hk - (b + m) / 1000, hk - m / 1000 * 0, zt.K0, Z.gama, 0) * b / (b + m);
    const pb = posudekPrkna({ L: D + ps, q: qB, b, t, mat: p.material, limitN: p.limitN });
    S.statika.push({ prvek: `Spodní lamela boku ${t}×${b} (rozpětí ${fmt(D + ps)} mm)`, popis: `tlak kompostu ${fmt(qB, 3)} kN/m`, vyuziti: Math.max(pb.vyuzitiOhyb, pb.vyuzitiPruhyb), detail: `průhyb ${fmt(pb.wFin, 1)} mm ≤ ${fmt(pb.wLim, 1)} mm` });
    const Vk = W * D * (Hc - z0) / 1e9, podil = rady > 1 ? (rady - 1) * m / (Hc - z0) : 0;
    if (m < 8) S.var('varovani', `Mezera ${m} mm je malá – kompost potřebuje vzduch, volte 10–25 mm.`);
    if (m > 30) S.var('info', `Mezera ${m} mm je velká – materiál může vypadávat a vysychat.`);
    if (W > 1500) S.var('varovani', 'Komora širší než 1,5 m se špatně překopává a čela se prohýbají.');
    if (Hc > 1300) S.var('info', 'Komora vyšší než 1,3 m se špatně plní i vybírá.');
    if (Vk < 0.5) S.var('info', 'Komora menší než ~0,5 m³ se špatně zahřívá – rozklad bude pomalejší.');
    if (M.trv >= 4 && p.ochrana === 'bez') S.var('varovani', 'Smrk bez ochrany v kompostéru rychle hnije – použijte modřín, akát, KDI nebo počítejte s výměnou lamel.');
    S.komory = { pocet: n, objem: Vk, celkem: Vk * n, podilMezer: podil };
    S.info = {
      'Komory': `${n} × ${fmt(W)} × ${fmt(D)} mm (světlé)`,
      'Výška': `${fmt(Hc)} mm (${rady} lamel na stěnu, mezera ${m} mm, od země ${z0} mm)`,
      'Objem komory': `${fmt(Vk, 2)} m³ (${fmt(Vk * 1000)} l)`,
      'Objem celkem': `${fmt(Vk * n, 2)} m³`,
      'Podíl větracích mezer': `${fmt(podil * 100, 1)} % plochy stěn`,
      'Vnější rozměr': `${fmt(Xt + 2 * t)} × ${fmt(Dt + t)} mm`,
      'Drážka čel': `${fmt(t + v)} mm (prkno ${t} + vůle ${v}), hloubka ${lw} mm`,
      'Čela': `${radyC} prken na komoru, délka ${fmt(W - 2 * v)} mm`,
    };
    S.vyska = Hc; S.rozmer = [Xt, Dt];
    return S;
  }

  /* ---------------- PERGOLA ---------------- */
  function zatizeniPergoly(p, roztecK) {
    const M = MATERIALY[p.material], rg = M.rho * g / 1e9; // N/mm³
    const sk = SNIH[p.snih] || 1.0, s = 0.8 * sk / 1000; // N/mm²
    const gLam = p.krytina === 'lamely' ? rg * p.lamB * p.lamT / p.roztecL : 0;
    const gKr = rg * p.krokB * p.krokH / roztecK;
    const fS = p.krytina === 'lamely' ? 1 : Math.min(1, (p.krokB + 100) / roztecK);
    return { gLam, gKr, s: s * fS, sk, rg };
  }
  function posudekVaznice(p, a, roztecK) {
    const Z = zatizeniPergoly(p, roztecK), trib = p.varianta === 'u_zdi' ? p.hloubka / 2 + p.presahK : p.hloubka / 2 + p.presahK;
    const qG = (Z.gLam + Z.gKr) * trib + Z.rg * p.vaznB * p.vaznH, qS = Z.s * trib;
    return Object.assign(posudekNosniku({ L: a, qG, qS, b: p.vaznB, h: p.vaznH, mat: p.material, limitN: p.limitN }), { qG, qS, trib });
  }
  function pergola(p) {
    const S = new Stavba('pergola', p), M = MATERIALY[p.material];
    const ps = p.sloup, Lv = p.delka + 2 * p.presahV;
    // pole – automaticky nejmenší počet, který vyhoví
    let nPole = Math.max(1, Math.round(p.pole) || 0);
    if (!(p.pole > 0)) { nPole = 1; while (nPole < 12 && !posudekVaznice(p, p.delka / nPole, p.roztecK).ok) nPole++; }
    const a = p.delka / nPole;
    const xsS = []; for (let i = 0; i <= nPole; i++) xsS.push(i * a);
    const rady = p.varianta === 'u_zdi' ? [0] : [0, p.hloubka];
    const H = p.vyska, z0 = p.kotveni === 'zemni_vrut' ? 60 : p.odsazeni;
    const zV = H + p.vaznH, zK0 = zV - p.zarez, zK1 = zK0 + p.krokH;
    // krokve: nad každým sloupem + rovnoměrně mezi, krajní na koncích vaznice
    const xs = new Set();
    const kraj0 = -p.presahV + p.krokB / 2, kraj1 = p.delka + p.presahV - p.krokB / 2;
    const body = [kraj0, ...xsS, kraj1].filter((x, i, A) => A.indexOf(x) === i).sort((x, y) => x - y);
    for (let i = 0; i < body.length; i++) {
      xs.add(body[i]);
      if (i < body.length - 1) { const d = body[i + 1] - body[i], k = Math.ceil(d / p.roztecK - 1e-9); for (let j = 1; j < k; j++) xs.add(body[i] + j * d / k); }
    }
    const xK = [...xs].filter((x) => x >= kraj0 - 1 && x <= kraj1 + 1).sort((x, y) => x - y);
    // u krajů – sloučit krokve blíž než šířka krokve
    const xK2 = []; for (const x of xK) if (!xK2.length || x - xK2[xK2.length - 1] > p.krokB + 20) xK2.push(x);
    const roztecKef = Math.max(...xK2.slice(1).map((x, i) => x - xK2[i]), 1);
    p._roztecKef = roztecKef;
    const kZakl = S.krok({ beton: 'Betonové patky', zemni_vrut: 'Zemní vruty', dlazba: 'Patky na dlažbu / desku' }[p.kotveni] || 'Kotvení', {
      beton: `Vykopejte jámy ${fmt(p.patkaA / 10)} × ${fmt(p.patkaA / 10)} cm do nezámrzné hloubky ${fmt(p.patkaH / 10)} cm, zabetonujte a osaďte kotevní patky typu U do přesné osy (provázek, vodováha). Sloup ${fmt(p.odsazeni)} mm nad terénem – nesmí stát ve vodě.`,
      zemni_vrut: 'Zemní vruty zašroubujte přesně do os (svislost kontrolujte během šroubování). Vhodné do soudržné zeminy bez kamenů.',
      dlazba: 'Patky s deskou kotvěte do betonové desky / pevné dlažby chemickými kotvami.',
    }[p.kotveni] || '');
    const kSl = S.krok('Sloupy', 'Sloupy postavte do patek, zajistěte svorníky a dočasně zavětrujte šikmými latěmi ve dvou směrech.');
    const kVa = S.krok(p.varianta === 'u_zdi' ? 'Vaznice a nástěnný trám' : 'Vaznice', 'Vaznice na hlavy sloupů (čep nebo tesařské úhelníky), styk vaznice vždy nad sloupem přeplátováním.' + (p.varianta === 'u_zdi' ? ' Nástěnný trám kotvěte chemickými kotvami á 60 cm, s mezerou od zdi (podložky) kvůli vodě.' : ''));
    const kPa = p.pasky ? S.krok('Pásky (vzpěry)', `Pásky 45° s ramenem ${fmt(p.paskaRameno)} mm ztuží rám proti větru; čepujte je nebo připojte vruty 8 mm.`) : null;
    const kKr = S.krok('Krokve', `Krokve po ${fmt(roztecKef)} mm osedlejte na vaznice (zářez ${p.zarez} mm) a přišroubujte vruty s talířovou hlavou.`);
    const kLa = p.krytina === 'lamely' ? S.krok('Lamely', `Lamely ${p.lamT}×${p.lamB} mm pod úhlem ${p.sklon}° po ${fmt(p.roztecL)} mm – nastavujte rozpěrkami (šablona úhlu).`) : null;
    // kotvení
    for (const x of xsS) for (const y of rady) {
      if (p.kotveni === 'beton') {
        S.kvadr({ prefix: 'B', skup: 'patka', nazev: 'Betonová patka', mat: 'beton', osa: 'z', krok: kZakl }, x - p.patkaA / 2, x + p.patkaA / 2, y - p.patkaA / 2, y + p.patkaA / 2, -p.patkaH, 0);
        S.kvadr({ prefix: 'K', skup: 'kovani', nazev: 'Kotevní patka U', mat: 'ocel', osa: 'z', krok: kZakl }, x - ps / 2 - 4, x + ps / 2 + 4, y - 30, y + 30, 0, z0);
      } else if (p.kotveni === 'zemni_vrut') {
        S.kvadr({ prefix: 'K', skup: 'kovani', nazev: 'Zemní vrut', mat: 'ocel', osa: 'z', krok: kZakl }, x - 45, x + 45, y - 45, y + 45, -800, z0);
      } else {
        S.kvadr({ prefix: 'K', skup: 'kovani', nazev: 'Patka s deskou', mat: 'ocel', osa: 'z', krok: kZakl }, x - ps / 2 - 30, x + ps / 2 + 30, y - ps / 2 - 30, y + ps / 2 + 30, 0, z0);
      }
    }
    const nSl = xsS.length * rady.length;
    if (p.kotveni === 'beton') { const V = nSl * p.patkaA * p.patkaA * p.patkaH / 1e9; S.mat('patkaU', nSl, ''); S.mat('svornik12', nSl * 2, `M12 × ${fmt(ps + 30)} (sloup – patka)`); S.mat('beton', Math.ceil(V / 0.012), `${fmt(V, 3)} m³ betonu`); S.mat('sterk', nSl * p.patkaA * p.patkaA * 100 / 1e9, 'štěrk na dno jam 10 cm'); }
    else if (p.kotveni === 'zemni_vrut') { S.mat('zemniVrut', nSl, ''); S.mat('svornik12', nSl * 2, `M12 × ${fmt(ps + 30)}`); }
    else { S.mat('patkaDeska', nSl, ''); S.mat('chemKotva', nSl * 4, 'kotvy patek'); S.mat('svornik12', nSl * 2, `M12 × ${fmt(ps + 30)}`); }
    // sloupy
    for (const x of xsS) for (const y of rady) S.kvadr({ prefix: 'S', skup: 'sloup', nazev: 'Sloup', mat: 'drevo', drevo: true, osa: 'z', krok: kSl }, x - ps / 2, x + ps / 2, y - ps / 2, y + ps / 2, z0, H);
    S.mat('uhelnik', nSl * 2, 'vaznice – sloup'); S.mat('vrutKovani', nSl * 2 * 10, 'do úhelníků');
    // vaznice (styky nad sloupy)
    const usekyV = rozdelUsek(-p.presahV, p.delka + p.presahV, 6000 - 40, xsS);
    const yV = p.varianta === 'u_zdi' ? [0, p.hloubka] : rady;
    yV.forEach((y, iy) => {
      const zed = p.varianta === 'u_zdi' && iy === 1;
      for (const [x0, x1] of usekyV) S.kvadr({ prefix: 'V', skup: zed ? 'nastenny' : 'vaznice', nazev: zed ? 'Nástěnný trám' : 'Vaznice', mat: 'drevo', drevo: true, osa: 'x', krok: kVa }, x0, x1, y - p.vaznB / 2, y + p.vaznB / 2, H, zV);
    });
    if (usekyV.length > 1) {
      const mimo = usekyV.slice(0, -1).some(([, x1]) => !xsS.some((x) => Math.abs(x - x1) < 1));
      S.var(mimo ? 'varovani' : 'info', `Vaznice je delší než 6 m – skládá se z ${usekyV.length} kusů, styk přeplátováním ${mimo ? 'MIMO sloup (doplňte sloup pod styk!)' : 'nad sloupem'} (viz Šablony truhlářských spojů → přeplátování).`);
    }
    if (p.varianta === 'u_zdi') {
      S.kvadr({ prefix: 'W', skup: 'zed', nazev: 'Zeď domu (jen pro orientaci)', mat: 'zed', osa: 'x', krok: 0 }, -p.presahV - 600, p.delka + p.presahV + 600, p.hloubka + p.vaznB / 2 + 10, p.hloubka + p.vaznB / 2 + 260, -300, zK1 + 700);
      S.mat('chemKotva', Math.ceil(Lv / 600) + 1, 'nástěnný trám á 60 cm');
    }
    // pásky
    if (p.pasky) {
      const ar = p.paskaRameno, pb = p.paskaB;
      for (const y of rady) for (let i = 0; i < xsS.length; i++) {
        const x = xsS[i];
        for (const sm of [-1, 1]) {
          if ((i === 0 && sm < 0 && p.presahV < ar) || (i === xsS.length - 1 && sm > 0 && p.presahV < ar)) continue;
          const A = [x + sm * ps / 2, y, H - ar], B = [x + sm * (ps / 2 + ar), y, H];
          S.meziBody({ prefix: 'A', skup: 'paska', nazev: 'Pásek podélný', mat: 'drevo', drevo: true, krok: kPa, rez: { profil: [pb, pb], delka: ar * Math.SQRT2 + pb } }, A, B, pb, pb, [0, 1, 0]);
        }
        // příčný pásek pod krokví nad sloupem
        const smY = y === 0 ? 1 : -1, dz = zK0 - (H - ar);
        const A = [x, y + smY * ps / 2, H - ar], B = [x, y + smY * (ps / 2 + dz), zK0];
        S.meziBody({ prefix: 'A', skup: 'paska', nazev: 'Pásek příčný', mat: 'drevo', drevo: true, krok: kPa, rez: { profil: [pb, pb], delka: dz * Math.SQRT2 + pb } }, A, B, pb, pb, [1, 0, 0]);
      }
      const nP = S.dily.filter((d) => d.skup === 'paska').length;
      S.mat('vrut8', nP * 4, `8 × ${delkaVrutu(pb * 1.5 + 40)} (pásky, 2 na konec)`);
    }
    // krokve
    const y0K = -p.presahK, y1K = p.varianta === 'u_zdi' ? p.hloubka + p.vaznB / 2 : p.hloubka + p.presahK;
    for (const x of xK2) S.kvadr({ prefix: 'R', skup: 'krokev', nazev: 'Krokev', mat: 'drevo', drevo: true, osa: 'y', krok: kKr, zakonceni: p.zakonceni }, x - p.krokB / 2, x + p.krokB / 2, y0K, y1K, zK0, zK1);
    S.mat('vrut8', xK2.length * yV.length, `8 × ${delkaVrutu(p.krokH + p.vaznH / 2)} (krokev – vaznice)`);
    if (y1K - y0K > 6000) S.var('chyba', 'Krokve jsou delší než 6 m – zmenšete hloubku nebo přesah.');
    // lamely
    let nl = 0;
    if (p.krytina === 'lamely') {
      const be = rad(p.sklon), stopa = p.lamB * Math.cos(be) + p.lamT * Math.abs(Math.sin(be));
      const Ly = y1K - y0K - 20; nl = Math.max(1, Math.floor((Ly - stopa) / p.roztecL + 1e-9) + 1);
      const y0 = y0K + 10 + (Ly - stopa - (nl - 1) * p.roztecL) / 2 + stopa / 2;
      const zc = zK1 + p.lamB / 2 * Math.abs(Math.sin(be)) + p.lamT / 2 * Math.cos(be);
      const usekyL = rozdelUsek(-p.presahV, p.delka + p.presahV, 6000 - 40, xK2);
      for (let j = 0; j < nl; j++) {
        const yc = y0 + j * p.roztecL;
        for (const [x0, x1] of usekyL) S.pridej({ prefix: 'L', skup: 'lamela', nazev: 'Lamela', mat: 'drevo', drevo: true, tvar: 'kvadr', krok: kLa, c: [(x0 + x1) / 2, yc, zc], roz: [x1 - x0, p.lamB, p.lamT], u: [1, 0, 0], v: [0, Math.cos(be), Math.sin(be)], w: [0, -Math.sin(be), Math.cos(be)], rez: { profil: [Math.min(p.lamB, p.lamT), Math.max(p.lamB, p.lamT)], delka: x1 - x0 } });
      }
      const krizeni = nl * xK2.length;
      S.mat('vrut5', krizeni * (Math.abs(p.sklon) > 20 ? 1 : 2), `5 × ${delkaVrutu(p.lamT + 45)} (lamela – krokev)`);
      if (Math.abs(p.sklon) > 20 && Math.abs(p.sklon) < 89) S.mat('rozpera', krizeni, 'rozpěrka s úhlem (STL) nebo dřevěný klínek');
      if (usekyL.length > 1) S.var('info', `Lamely jsou delší než 6 m – ${usekyL.length} kusy se stykem na krokvi.`);
    }
    // statika
    const Z = zatizeniPergoly(p, roztecKef);
    const qGk = (Z.gLam) * roztecKef + Z.rg * p.krokB * p.krokH, qSk = Z.s * roztecKef;
    const Lk = p.hloubka;
    const pk = posudekNosniku({ L: Lk, qG: qGk, qS: qSk, b: p.krokB, h: p.krokH, mat: p.material, limitN: p.limitN, hEf: p.krokH - p.zarez });
    S.statika.push({ prvek: `Krokev ${p.krokB}×${p.krokH}`, popis: `rozpětí ${fmt(Lk)} mm, rozteč ${fmt(roztecKef)} mm, g ${fmt(qGk, 3)} + s ${fmt(qSk, 3)} kN/m`, vyuziti: Math.max(pk.vyuzitiOhyb, pk.vyuzitiSmyk, pk.vyuzitiPruhyb), detail: `σ ${fmt(pk.sigma, 1)} / ${fmt(pk.f, 1)} MPa, τ ${fmt(pk.tau, 2)} MPa, průhyb ${fmt(pk.wFin, 1)} ≤ ${fmt(pk.wLim, 1)} mm` });
    const pv = posudekVaznice(p, a, roztecKef);
    S.statika.push({ prvek: `Vaznice ${p.vaznB}×${p.vaznH}`, popis: `pole ${fmt(a)} mm (${nPole} ${nPole === 1 ? 'pole' : nPole < 5 ? 'pole' : 'polí'}), zatěžovací šířka ${fmt(pv.trib)} mm, g ${fmt(pv.qG, 3)} + s ${fmt(pv.qS, 3)} kN/m`, vyuziti: Math.max(pv.vyuzitiOhyb, pv.vyuzitiSmyk, pv.vyuzitiPruhyb), detail: `σ ${fmt(pv.sigma, 1)} / ${fmt(pv.f, 1)} MPa, průhyb ${fmt(pv.wFin, 1)} ≤ ${fmt(pv.wLim, 1)} mm` });
    if (p.krytina === 'lamely') {
      const be = rad(p.sklon), Il = (p.lamB * Math.pow(p.lamT, 3) * Math.pow(Math.cos(be), 2) + p.lamT * Math.pow(p.lamB, 3) * Math.pow(Math.sin(be), 2)) / 12;
      const zm = (p.lamB * Math.abs(Math.sin(be)) + p.lamT * Math.cos(be)) / 2;
      const ql = posudekNosniku({ L: roztecKef, qG: Z.rg * p.lamB * p.lamT, qS: Z.s * p.roztecL, b: p.lamT, h: p.lamB, I: Il, zmax: zm, mat: p.material, limitN: p.limitN });
      S.statika.push({ prvek: `Lamela ${p.lamT}×${p.lamB} pod ${p.sklon}°`, popis: `rozpětí ${fmt(roztecKef)} mm mezi krokvemi`, vyuziti: Math.max(ql.vyuzitiOhyb, ql.vyuzitiPruhyb), detail: `průhyb ${fmt(ql.wFin, 1)} ≤ ${fmt(ql.wLim, 1)} mm` });
    }
    const aTrib = nPole === 1 ? a / 2 + p.presahV : a, NG = ((Z.gLam + Z.gKr) * pv.trib + Z.rg * p.vaznB * p.vaznH) * aTrib + Z.rg * ps * ps * H, NS = Z.s * pv.trib * aTrib;
    const Nd = GAMA_G * NG + GAMA_Q * NS, Lef = (H - z0) * (p.pasky ? 1 : 2), vz = vzper(Lef, ps, ps, M);
    const sc = Nd / (ps * ps), fcd = fd(M.fc0k, KMOD.kratkodobe);
    S.statika.push({ prvek: `Sloup ${ps}×${ps}`, popis: `N = ${fmt(Nd / 1000, 2)} kN (návrh.), vzpěrná délka ${fmt(Lef)} mm, štíhlost ${fmt(vz.lam, 0)}`, vyuziti: sc / (vz.kc * fcd), detail: `σc ${fmt(sc, 2)} MPa ≤ kc·fc,d = ${fmt(vz.kc, 2)} × ${fmt(fcd, 1)} MPa` });
    if (!p.pasky) S.var('varovani', 'Bez pásků (vzpěr) drží volná pergola tvar jen vetknutím sloupů – běžné patky vetknutí nezajistí. Doplňte pásky nebo ztužení ve dvou směrech.');
    if (p.zarez > p.krokH / 4) S.var('varovani', `Zářez (osedlání) krokve ${p.zarez} mm je větší než 1/4 výšky krokve – oslabuje průřez nad podporou.`);
    if (p.presahV > a / 3) S.var('info', `Přesah vaznice ${fmt(p.presahV)} mm je velký vůči poli ${fmt(a)} mm – konzola se může prohýbat.`);
    if (p.presahK > p.hloubka / 3) S.var('info', `Přesah krokví ${fmt(p.presahK)} mm je velký vůči rozpětí.`);
    if (H < 2100) S.var('info', `Podchozí výška ${fmt(H)} mm je nízká – doporučeno ≥ 2,1 m (pod pásky ještě méně).`);
    if (p.kotveni === 'beton' && p.patkaH < 800) S.var('varovani', `Patka ${fmt(p.patkaH)} mm nedosahuje nezámrzné hloubky 800 mm – může ji zvedat mráz.`);
    if (Math.abs(p.sklon) < 15) S.var('info', 'Ploché lamely (pod 15°) drží vodu a sníh – volte sklon ≥ 15° a zkosenou horní hranu.');
    const nP = S.dily.filter((d) => d.skup === 'paska').length;
    S.info = {
      'Půdorys (osy sloupů)': `${fmt(p.delka)} × ${fmt(p.hloubka)} mm` + (p.varianta === 'u_zdi' ? ' (u zdi)' : ''),
      'Sloupy': `${nSl} ks ${ps}×${ps}, ${nPole} ${nPole < 5 ? 'pole' : 'polí'} po ${fmt(a)} mm` + (p.pole > 0 ? '' : ' (navrženo automaticky)'),
      'Podchozí výška': `${fmt(H)} mm, horní hrana ${fmt(zK1 + (p.krytina === 'lamely' ? p.lamB * Math.abs(Math.sin(rad(p.sklon))) + p.lamT * Math.cos(rad(p.sklon)) : 0))} mm`,
      'Krokve': `${xK2.length} ks ${p.krokB}×${p.krokH}, rozteč ≤ ${fmt(roztecKef)} mm`,
      'Lamely': p.krytina === 'lamely' ? `${nl} řad ${p.lamT}×${p.lamB}, rozteč ${fmt(p.roztecL)} mm, sklon ${p.sklon}°` : 'bez lamel',
      'Sníh': `oblast ${p.snih}: sk = ${fmt(Z.sk, 1)} kN/m², na konstrukci 0,8·sk${p.krytina === 'lamely' ? '' : ' jen na šířku krokví'}`,
    };
    if (nP) S.info['Pásky'] = `${nP} ks ${p.paskaB}×${p.paskaB}, rameno ${fmt(p.paskaRameno)} mm`;
    S.pole = { pocet: nPole, a, xsS, rady, xK: xK2, roztecK: roztecKef, nl };
    S.vyska = zK1;
    return S;
  }

  /* ---------------- kusovník, řezy, cena ---------------- */
  function dokonci(S) {
    const p = S.p, M = MATERIALY[p.material], O = OCHRANY[p.ochrana] || OCHRANY.nater;
    const drevo = S.dily.filter((d) => d.drevo && d.rez);
    // kusovník: skupiny podle profilu a délky
    const mapa = new Map();
    for (const d of drevo) {
      const pr = d.rez.profil.map((x) => Math.round(x)), L = Math.round(d.rez.delka);
      const k = `${d.nazev.replace(/ \d+(, řada \d+)?$/, '').replace(/ stěny \d+/, ' stěny')}|${pr.join('×')}|${L}|${d.rez.pozn || ''}`;
      if (!mapa.has(k)) mapa.set(k, { nazev: d.nazev.replace(/ stěny \d+, řada \d+$/, ' stěny').replace(/ stěny \d+$/, ' stěny').replace(/ komory \d+$/, ''), profil: pr, delka: L, ks: 0, pozn: d.rez.pozn || '', dily: [] });
      const e = mapa.get(k); e.ks++; e.dily.push(d.id);
    }
    const kusovnik = [...mapa.values()].sort((a, b) => a.profil[0] * a.profil[1] - b.profil[0] * b.profil[1] || b.delka - a.delka);
    for (const e of kusovnik) { e.objem = e.ks * e.profil[0] * e.profil[1] * e.delka / 1e9; e.hmotnost = e.objem * M.rho; e.celkemDelka = e.ks * e.delka; }
    // řezný plán po profilech
    const profily = new Map();
    for (const d of drevo) { const k = d.rez.profil.map((x) => Math.round(x)).join('×'); if (!profily.has(k)) profily.set(k, []); profily.get(k).push({ delka: Math.round(d.rez.delka), oznaceni: d.id, nazev: d.nazev }); }
    const cenaM3 = (p.cenaVlastni && p.cenaVlastni['drevo_' + p.material] > 0 ? p.cenaVlastni['drevo_' + p.material] : M.cena) * (1 + O.priplatek);
    const rezy = [...profily.entries()].map(([k, kusy]) => {
      const pr = k.split('×').map(Number), plan = narezovyPlan(kusy, { prorez: p.prorez, orez: p.orez });
      const m3 = plan.koupeno * pr[0] * pr[1] / 1e9;
      const souhrn = {}; for (const t of plan.tyce) souhrn[t.delka] = (souhrn[t.delka] || 0) + 1;
      return { profil: pr, klic: k, plan, objem: m3, cena: m3 * cenaM3, souhrn };
    });
    // impregnace
    const povrch = drevo.reduce((a, d) => a + povrchDilu(d), 0) / 1e6;
    if (p.ochrana === 'nater') S.mat('impregnace', povrch * 2 * 0.12 * 1.1, `${fmt(povrch, 1)} m² dřeva × 2 nátěry × 0,12 l/m²`);
    else if (p.ochrana === 'kdi') S.mat('impregnace', Math.max(0.25, povrch * 0.01), 'jen na zaříznutá čela a vývrty (ochranný nátěr)');
    else S.mat('impregnace', povrch * 0.08, 'olej na dřevo, 1 nátěr (volitelně)');
    // cena
    const cen = (k) => (p.cenaVlastni && p.cenaVlastni[k] >= 0 && p.cenaVlastni[k] !== '' && p.cenaVlastni[k] != null ? +p.cenaVlastni[k] : CENIK[k].cena);
    const material = S.material.map((m) => { const C = CENIK[m.klic]; const zaokr = C.jedn === 'ks' || C.jedn === 'pytel' ? Math.ceil(m.mnozstvi - 1e-9) : Math.round(m.mnozstvi * 100) / 100; return Object.assign({}, m, { nazev: C.nazev, jedn: C.jedn, mnozstvi: zaokr, cenaJ: cen(m.klic), cena: zaokr * cen(m.klic) }); });
    const cenaDrevo = rezy.reduce((a, r) => a + r.cena, 0), cenaMat = material.reduce((a, m) => a + m.cena, 0);
    S.kusovnik = kusovnik; S.rezy = rezy; S.materialy = material;
    S.cena = { drevo: cenaDrevo, material: cenaMat, celkem: cenaDrevo + cenaMat, cenaM3 };
    S.objemDreva = kusovnik.reduce((a, e) => a + e.objem, 0);
    S.hmotnostDreva = S.objemDreva * M.rho;
    S.povrchDreva = povrch;
    // rozsah scény
    const z = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
    for (const d of S.dily) { const m = mezeDilu(d); d.meze = m; for (let i = 0; i < 6; i += 2) { z[i] = Math.min(z[i], m[i]); z[i + 1] = Math.max(z[i + 1], m[i + 1]); } }
    S.zona = z;
    const delkaKusu = drevo.reduce((a, d) => a + Math.round(d.rez.delka), 0);
    S.kontrola = { delkaKusu, delkaKusovnik: kusovnik.reduce((a, e) => a + e.celkemDelka, 0), delkaPlan: rezy.reduce((a, r) => a + r.plan.cista, 0) };
    if (rezy.some((r) => r.plan.nadmerne)) S.var('varovani', 'Některé kusy jsou delší než 6 m – v kusovníku jsou jako „na objednávku“.');
    for (const s of S.statika) { if (s.vyuziti > 1) S.var('chyba', `${s.prvek}: využití ${fmt(s.vyuziti * 100)} % – NEVYHOVUJE (${s.detail}).`); else if (s.vyuziti > 0.85) S.var('varovani', `${s.prvek}: využití ${fmt(s.vyuziti * 100)} % – na hraně.`); }
    S.var('info', 'Statika je zjednodušená (prosté nosníky, třída provozu 3, bez větru a mimořádných zatížení) – nejde o statický posudek. U pergoly nad 20 m², u stavby na hranici pozemku nebo u zdi domu nechte konstrukci posoudit statikem.');
    return S;
  }

  function sestav(p0) {
    const typ = (p0 && p0.typ) || 'zahon';
    const p = Object.assign({}, VYCHOZI[typ] || VYCHOZI.zahon, p0 || {});
    for (const k of Object.keys(VYCHOZI[typ])) if (typeof VYCHOZI[typ][k] === 'number') p[k] = cislo(p[k], VYCHOZI[typ][k]);
    if (!MATERIALY[p.material]) p.material = 'smrk_c24';
    let S;
    if (typ === 'komposter') {
      p.komor = omez(Math.round(p.komor), 1, 3);
      for (const [k, a, b] of [['sirkaKomory', 300, 3000], ['hloubka', 300, 3000], ['vyska', 200, 2000], ['lamelaB', 40, 300], ['lamelaT', 10, 80], ['mezera', 0, 80], ['sloupek', 40, 200], ['listaB', 10, 80], ['listaH', 10, 100], ['vule', 0, 15], ['odsazeni', 0, 300], ['limitN', 50, 500]]) p[k] = omez(p[k], a, b);
      S = komposter(p);
    } else if (typ === 'pergola') {
      for (const [k, a, b] of [['delka', 1000, 15000], ['hloubka', 1000, 6000], ['vyska', 1500, 4000], ['sloup', 80, 300], ['vaznB', 40, 300], ['vaznH', 80, 400], ['presahV', 0, 1500], ['krokB', 30, 200], ['krokH', 60, 400], ['roztecK', 200, 2000], ['presahK', 0, 1500], ['zarez', 0, 100], ['lamB', 20, 300], ['lamT', 10, 100], ['roztecL', 30, 1000], ['sklon', -90, 90], ['paskaRameno', 200, 1500], ['paskaB', 40, 200], ['patkaA', 200, 1000], ['patkaH', 300, 2000], ['odsazeni', 0, 400], ['limitN', 50, 500], ['pole', 0, 12]]) p[k] = omez(p[k], a, b);
      if (!SNIH[p.snih]) p.snih = 'II';
      S = pergola(p);
    } else {
      for (const [k, a, b] of [['delka', 400, 12000], ['sirka', 300, 3000], ['delkaB', 400, 12000], ['vyska', 100, 1500], ['prknoB', 50, 400], ['prknoT', 12, 100], ['sloupek', 30, 200], ['zapusteni', 0, 1200], ['roztecMax', 0, 5000], ['pritizeni', 0, 20], ['limitN', 50, 500], ['listaB', 40, 300], ['listaT', 15, 80], ['listaPresah', 0, 60], ['rezerva', 0, 300]]) p[k] = omez(p[k], a, b);
      if (!['obdelnik', 'L', 'U'].includes(p.tvar)) p.tvar = 'obdelnik';
      S = zahon(p);
    }
    p.sirkaGeo = omez(p.sirkaGeo, -89, 89); p.delkaGeo = omez(p.delkaGeo, -180, 180);
    S.nazev = { zahon: 'Vyvýšený záhon', komposter: 'Kompostér', pergola: 'Pergola' }[typ] + (typ === 'zahon' && p.tvar !== 'obdelnik' ? ' do ' + p.tvar : '') + (typ === 'komposter' ? ` (${p.komor} ${p.komor === 1 ? 'komora' : 'komory'})` : '') + (typ === 'pergola' && p.varianta === 'u_zdi' ? ' u zdi' : '');
    return dokonci(S);
  }

  const API = {
    fmt, MATERIALY, OCHRANY, SNIH, ZEMINY, VRSTVY, UZIVATELE, CENIK, VYCHOZI, PREDVOLBY, OBCHODNI_DELKY, KMOD, KDEF, GAMA_M,
    zemniTlak, zatizeniPasu, posudekPrkna, maxRozpetiPrkna, pocetPoli, posudekNosniku, vzper, unosnostPodlozky,
    polohaSlunce, slunceVlastni, utcZMistniho, smerSlunceLokalne, stinLamely, prostupSlunce, denniPrubeh, navrhRozteceLamel, tabulkaSklonu,
    narezovyPlan, rozdelUsek, obrysZahonu, odsad, plocha, obvod, vrstvyAuto, objemVrstev, rohyDilu, mezeDilu, objemDilu, delkaVrutu,
    sestav,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.ZSJ = API;
})(typeof window !== 'undefined' ? window : globalThis);
