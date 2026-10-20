/* ============================================================
   Planetárium Slunce–Země–Měsíc – výpočetní jádro (bez DOM)
   - astronomie: střední pohyby (Meeus, J2000) + přibližné skutečné polohy, fáze, roční období, zatmění
   - hledání převodů: řetězové zlomky + prohledávání součinů dvojic zubů
   - návrh mechanismu telluria: rameno, pevná centrální kola, soukolí na rameni, rozmístění os,
     kontrola roztečí a kolizí, kinematika (Willisova rovnice), kusovník
   Jednotky: mm, dny (JD), úhly ve stupních (není-li řečeno jinak).
   Souřadnice půdorysu: počátek = osa Slunce (centrální sloup), +x = směr ramene k Zemi při návrhu,
   z nahoru (horní plocha ramene z = 0).
   Export: window.PLAN i module.exports.
   ============================================================ */
(function (koren) {
  'use strict';
  const PI = Math.PI, TAU = 2 * PI, RAD = PI / 180;

  /* ---------- astronomické konstanty ---------- */
  const K = {
    ROK: 365.2422,          // tropický rok (dny) – jedna otáčka ramene
    SYN: 29.530589,         // synodický měsíc
    SID: 27.321662,         // siderický měsíc
    TROP: 27.321582,        // tropický měsíc (vůči jarnímu bodu)
    DRAK: 27.212221,        // drakonický měsíc (vůči uzlu)
    UZLY: 6798.383,         // perioda ustupování uzlů (18,61 r)
    DEN_SID: 0.99726957,    // hvězdný den
    VENUSE: 224.701, MERKUR: 87.969,
    SKLON: 23.44, SKLON_MESICE: 5.14,
    J2000: 2451545.0
  };
  /** požadované otáčky (absolutně, vůči hvězdám/jarnímu bodu) za jednu otáčku ramene (= tropický rok) */
  const CILE = {
    mesicSyn: K.ROK / K.SYN,              // 12,36827 – synodické oběhy za rok (vůči rameni)
    mesicAbs: K.ROK / K.SYN + 1,          // 13,36827 – oběhy vůči jarnímu bodu
    mesicSid: K.ROK / K.SID,              // 13,36823 – siderické (vůči hvězdám)
    uzly: -K.ROK / K.UZLY,                // −0,05373 – uzly ustupují
    den: K.ROK + 1,                       // 366,2422 – otočky Země vůči hvězdám
    venuse: K.ROK / K.VENUSE, merkur: K.ROK / K.MERKUR
  };

  const norm360 = (x) => ((x % 360) + 360) % 360;
  const norm180 = (x) => { const y = norm360(x); return y > 180 ? y - 360 : y; };
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };

  /* ---------- čas ---------- */
  function jdZData(d) { return d.getTime() / 86400000 + 2440587.5; }
  function dataZJd(jd) { return new Date((jd - 2440587.5) * 86400000); }

  /* ---------- ideální astronomie (střední pohyby s konstantami výše) ---------- */
  /** Střední ekliptikální délky (°) k datu JD: Slunce (geocentricky), Země (heliocentricky), Měsíc, uzel, GMST. */
  function idealni(jd) {
    const d = jd - K.J2000;
    const slunce = norm360(280.46646 + 360 / K.ROK * d);
    const D = norm360(297.8501921 + 360 / K.SYN * d);         // střední elongace Měsíce
    const mesic = norm360(slunce + D);
    const uzel = norm360(125.04452 - 360 / K.UZLY * d);
    const gmst = norm360(280.46061837 + 360.98564736629 * d);
    return { slunce, zeme: norm360(slunce + 180), mesic, D, uzel, gmst,
      venuse: norm360(181.979801 + 360 / K.VENUSE * d), merkur: norm360(252.250906 + 360 / K.MERKUR * d) };
  }
  /** Přibližná skutečná poloha (hlavní periodické členy, přesnost ~0,1–0,3°) – pro porovnání. */
  function skutecne(jd) {
    const d = jd - K.J2000, s = (x) => Math.sin(x * RAD);
    const L = 280.46646 + 0.98564736 * d, M = 357.52911 + 0.98560028 * d;
    const slunce = norm360(L + 1.914602 * s(M) + 0.019993 * s(2 * M));
    const Lm = 218.3164477 + 13.17639648 * d, Mm = 134.9633964 + 13.06499295 * d;
    const D = 297.8501921 + 12.19074912 * d, F = 93.272095 + 13.22935024 * d;
    const mesic = norm360(Lm + 6.288774 * s(Mm) + 1.274027 * s(2 * D - Mm) + 0.658314 * s(2 * D) + 0.213618 * s(2 * Mm)
      - 0.185116 * s(M) - 0.114332 * s(2 * F) + 0.058793 * s(2 * D - 2 * Mm) + 0.057066 * s(2 * D - M - Mm));
    const sirka = 5.128122 * s(F) + 0.280602 * s(Mm + F) + 0.277693 * s(Mm - F) + 0.173237 * s(2 * D - F);
    return { slunce, mesic, sirka, D: norm360(mesic - slunce) };
  }

  /* ---------- fáze, roční období, zatmění ---------- */
  const FAZE = ['novoluní', 'dorůstající srpek', 'první čtvrť', 'dorůstající Měsíc', 'úplněk', 'couvající Měsíc', 'poslední čtvrť', 'ubývající srpek'];
  function faze(D) {
    const e = norm360(D);
    return { D: e, osvetleni: (1 - Math.cos(e * RAD)) / 2, nazev: FAZE[Math.floor(((e + 22.5) % 360) / 45)],
      stari: e / 360 * K.SYN, dorusta: e < 180 };
  }
  function rocniObdobi(lambdaSlunce, jizni) {
    const i = Math.floor(norm360(lambdaSlunce) / 90);
    const sever = ['jaro', 'léto', 'podzim', 'zima'][i], jih = ['podzim', 'zima', 'jaro', 'léto'][i];
    const dekl = Math.asin(Math.sin(K.SKLON * RAD) * Math.sin(lambdaSlunce * RAD)) / RAD;
    return { nazev: jizni ? jih : sever, sever, jih, deklinace: dekl, index: i };
  }
  /** Délka dne (h) na šířce φ při deklinaci δ (bez refrakce). */
  function delkaDne(fi, dekl) {
    const c = -Math.tan(fi * RAD) * Math.tan(dekl * RAD);
    if (c <= -1) return 24; if (c >= 1) return 0;
    return 2 * Math.acos(c) / RAD / 15;
  }
  /**
   * Zatmění podle polohy uzlu: elongace D (Měsíc − Slunce) a argument šířky F = λ_M − Ω.
   * Meeus (kap. 54): při novoluní/úplňku je zatmění vyloučeno, když |sin F| > 0,36.
   * Okno (± dny od fáze) určuje, zda jsme „u“ novoluní / úplňku.
   */
  function zatmeni(D, F, oknoDni) {
    const okno = (oknoDni == null ? 1 : oknoDni) * 360 / K.SYN;
    const dN = Math.abs(norm180(D)), dU = Math.abs(norm180(D - 180));
    const sF = Math.abs(Math.sin(F * RAD));
    const uUzlu = Math.abs(norm180(F)) < 90 ? Math.abs(norm180(F)) : 180 - Math.abs(norm180(F)); // vzdálenost od bližšího uzlu
    let typ = null;
    if (dN <= okno && sF <= 0.36) typ = 'slunce';
    if (dU <= okno && sF <= 0.36) typ = 'mesic';
    return { typ, uUzlu, sinF: sF, uNovoluni: dN <= okno, uUplnku: dU <= okno };
  }
  /**
   * Zatmění podle Meeuse (Astronomical Algorithms, kap. 54): pro novoluní (k celé) / úplněk (k + ½)
   * spočte okamžik, γ (nejmenší vzdálenost osy stínu od středu Země v poloměrech Země) a u (poloměr polostínu).
   */
  function zatmeniMeeus(k) {
    const T = k / 1236.85, s = (x) => Math.sin(x * RAD), c = (x) => Math.cos(x * RAD);
    const uplnek = !Number.isInteger(k);
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T;
    const M = 2.5534 + 29.10535670 * k - 0.0000014 * T * T;
    const Mm = 201.5643 + 385.81693528 * k + 0.0107582 * T * T;
    const F = 160.7108 + 390.67050284 * k - 0.0016118 * T * T;
    const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T * T;
    const E = 1 - 0.002516 * T, F1 = F - 0.02665 * s(Om), A1 = 299.77 + 0.107408 * k - 0.009173 * T * T;
    jde += (uplnek ? -0.4065 : -0.4075) * s(Mm) + (uplnek ? 0.1727 : 0.1721) * E * s(M) + 0.0161 * s(2 * Mm) - 0.0097 * s(2 * F1)
      + 0.0073 * E * s(Mm - M) - 0.0050 * E * s(Mm + M) - 0.0023 * s(Mm - 2 * F1) + 0.0021 * E * s(2 * M) + 0.0012 * s(Mm + 2 * F1)
      + 0.0006 * E * s(2 * Mm + M) - 0.0004 * s(3 * Mm) - 0.0003 * E * s(M + 2 * F1) + 0.0003 * s(A1) - 0.0002 * E * s(M - 2 * F1)
      - 0.0002 * E * s(2 * Mm - M) - 0.0002 * s(Om);
    const P = 0.2070 * E * s(M) + 0.0024 * E * s(2 * M) - 0.0392 * s(Mm) + 0.0116 * s(2 * Mm) - 0.0073 * E * s(Mm + M) + 0.0067 * E * s(Mm - M) + 0.0118 * s(2 * F1);
    const Q = 5.2207 - 0.0048 * E * c(M) + 0.0020 * E * c(2 * M) - 0.3299 * c(Mm) - 0.0060 * E * c(Mm + M) + 0.0041 * E * c(Mm - M);
    const W = Math.abs(c(F1));
    const gama = (P * c(F1) + Q * s(F1)) * (1 - 0.0048 * W);
    const u = 0.0059 + 0.0046 * E * c(M) - 0.0182 * c(Mm) + 0.0004 * c(2 * Mm) - 0.0005 * c(M + Mm);
    const ag = Math.abs(gama);
    if (!uplnek) {
      if (ag > 1.5433 + u) return null;
      let druh = 'částečné';
      if (ag < 0.9972) druh = u < 0 ? 'úplné' : u > 0.0047 ? 'prstencové' : 'prstencovo-úplné';
      return { jd: jde, typ: 'slunce', druh, gama, u, F: norm360(F) };
    }
    const pen = (1.5573 + u - ag) / 0.5450, umb = (1.0128 - u - ag) / 0.5450;
    if (pen < 0) return null;
    return { jd: jde, typ: 'mesic', druh: umb >= 1 ? 'úplné' : umb > 0 ? 'částečné' : 'polostínové', gama, u, velikost: umb > 0 ? umb : pen, F: norm360(F) };
  }
  /** Nejbližší zatmění od JD dál (nejvýše n kusů). */
  function dalsiZatmeni(jd, n) {
    const k0 = Math.floor((jd - 2451550.09766) / K.SYN) - 1, out = [];
    for (let k = k0; k < k0 + 400 && out.length < (n || 6); k += 0.5) {
      const F = norm360(160.7108 + 390.67050284 * k);
      if (Math.abs(Math.sin(F * RAD)) > 0.36) continue;
      const z = zatmeniMeeus(k);
      if (z && z.jd >= jd) out.push(z);
    }
    return out;
  }

  /* ============================================================
     Hledání převodů
     ============================================================ */
  /** Řetězový zlomek čísla x: členy a sblížené zlomky p/q. */
  function retezovyZlomek(x, maxCleny, maxQ) {
    const cleny = [], sbl = [];
    let p0 = 1, q0 = 0, p1 = Math.floor(x), q1 = 1, r = x - Math.floor(x);
    cleny.push(Math.floor(x)); sbl.push({ p: p1, q: q1, v: p1 / q1, chyba: p1 / q1 / x - 1 });
    for (let i = 1; i < (maxCleny || 12) && r > 1e-12; i++) {
      const a = Math.floor(1 / r); r = 1 / r - a;
      const p2 = a * p1 + p0, q2 = a * q1 + q0;
      if (maxQ && q2 > maxQ) break;
      cleny.push(a); sbl.push({ p: p2, q: q2, v: p2 / q2, chyba: p2 / q2 / x - 1 });
      p0 = p1; q0 = q1; p1 = p2; q1 = q2;
    }
    return { cleny, sblizene: sbl };
  }
  /** Rozklad celého N na n činitelů z rozsahu [a, b] (vzestupně); null, když nejde. */
  function cinitele(N, n, a, b) {
    if (n === 0) return N === 1 ? [] : null;
    if (n === 1) return N >= a && N <= b ? [N] : null;
    for (let d = Math.min(b, Math.floor(N)); d >= a; d--) {
      if (N % d) continue;
      const zb = cinitele(N / d, n - 1, a, d);
      if (zb) return zb.concat([d]);
    }
    return null;
  }
  /** Zkusí zlomek p/q rozložit na n dvojic kol z rozsahu (s případným rozšířením p·k/q·k). */
  function zlomekNaKola(p, q, n, zMin, zMax) {
    for (let k = 1; k <= 200; k++) {
      const P = p * k, Q = q * k;
      if (P > Math.pow(zMax, n) || Q > Math.pow(zMax, n)) break;
      for (let nn = 1; nn <= n; nn++) {
        const cp = cinitele(P, nn, zMin, zMax), cq = cinitele(Q, nn, zMin, zMax);
        if (cp && cq) return cp.map((zp, i) => [zp, cq[i]]);
      }
    }
    return null;
  }

  const cacheJednoduchych = new Map();
  /** Všechny různé poměry jedné dvojice zubů z rozsahu (zkrácené zlomky, nejmenší zástupce). */
  function jednoducheStupne(zMin, zMax) {
    const klic = zMin + ':' + zMax;
    if (cacheJednoduchych.has(klic)) return cacheJednoduchych.get(klic);
    const m = new Map();
    for (let a = zMin; a <= zMax; a++) for (let b = zMin; b <= zMax; b++) {
      const g = gcd(a, b), k = (a / g) + '/' + (b / g);
      const st = m.get(k);
      if (!st || a + b < st.a + st.b) m.set(k, { a, b, v: a / b });
    }
    const pole = [...m.values()].sort((x, y) => x.v - y.v);
    const vals = new Float64Array(pole.length); pole.forEach((s, i) => { vals[i] = s.v; });
    const out = { pole, vals };
    cacheJednoduchych.set(klic, out);
    return out;
  }
  function binarni(vals, t) { let lo = 0, hi = vals.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (vals[mid] < t) lo = mid + 1; else hi = mid; } return lo; }

  /**
   * Hledání převodu o velikosti |cil| = Π z_hnací / z_hnané.
   * o: {cil, stupne (1–3), zMin, zMax, pocet, souose (jen 2 stupně: z1+z2 = z3+z4), maxZubu (součet)}
   * Vrací [{kola: [[zH, zN], …], pomer, chyba (relativní), zaRokDni (odchylka dnů za rok), denZaRoku}].
   */
  function hledejPrevody(o) {
    const cil = Math.abs(+o.cil), n = Math.max(1, Math.min(3, o.stupne | 0 || 2));
    const zMin = Math.max(5, o.zMin | 0 || 10), zMax = Math.max(zMin + 1, o.zMax | 0 || 120);
    const pocet = o.pocet || 25, KAP = Math.max(80, pocet * 4);
    if (!(cil > 0) || !isFinite(cil)) return [];
    const { pole, vals } = jednoducheStupne(zMin, zMax);
    const top = []; let horsi = Infinity;
    const klice = new Set();
    const pridej = (st) => {
      let P = 1; for (const s of st) P *= s.v;
      const ch = Math.abs(P / cil - 1);
      if (top.length >= KAP && ch >= horsi) return;
      const klic = st.map((s) => s.a + '/' + s.b).sort().join(',');
      if (klice.has(klic)) return;
      klice.add(klic);
      top.push({ st: st.slice(), ch, P, soucet: st.reduce((x, s) => x + s.a + s.b, 0) });
      if (top.length > KAP * 2) { top.sort((x, y) => x.ch - y.ch || x.soucet - y.soucet); top.length = KAP; horsi = top[KAP - 1].ch; }
    };
    const okoli = (t, odI, f) => { const j = binarni(vals, t); for (let q = Math.max(odI, j - 2); q <= Math.min(vals.length - 1, j + 2); q++) f(pole[q]); };
    if (n === 1) okoli(cil, 0, (s) => pridej([s]));
    else if (n === 2 && o.souose) {
      for (let S = 2 * zMin; S <= 2 * zMax; S++) {
        const dv = [];
        for (let a = Math.max(zMin, S - zMax); a <= Math.min(zMax, S - zMin); a++) dv.push({ a, b: S - a, v: a / (S - a) });
        for (const x of dv) {
          const t = cil / x.v;              // a/(S−a) = t → a = S t/(1+t)
          const a0 = Math.round(S * t / (1 + t));
          for (let a = a0 - 1; a <= a0 + 1; a++) { const b = S - a; if (a >= zMin && a <= zMax && b >= zMin && b <= zMax) pridej([x, { a, b, v: a / b }]); }
        }
      }
    } else if (n === 2) {
      for (let i = 0; i < pole.length; i++) {
        const x = pole[i]; if (x.v * x.v > cil * 1.0001) break;
        okoli(cil / x.v, i, (y) => pridej([x, y]));
      }
    } else {
      const rMax = zMax / zMin;
      for (let i = 0; i < pole.length; i++) {
        const x = pole[i];
        if (x.v * rMax * rMax < cil * 0.9999) continue;
        if (x.v * x.v * x.v > cil * 1.0001) break;
        const yOd = Math.max(i, binarni(vals, cil / (x.v * rMax) * 0.9999));
        for (let j = yOd; j < pole.length; j++) {
          const y = pole[j]; if (x.v * y.v * y.v > cil * 1.0001) break;
          okoli(cil / (x.v * y.v), j, (zz) => pridej([x, y, zz]));
        }
      }
    }
    top.sort((x, y) => x.ch - y.ch || x.soucet - y.soucet);
    let vys = top.map((t) => hodnotPrevod(t.st.map((s) => [s.a, s.b]), cil));
    if (o.maxZubu) vys = vys.filter((v) => v.soucet <= o.maxZubu);
    return vys.slice(0, pocet);
  }
  /** Vyhodnocení převodu: poměr, relativní chyba a „odchylka 1 den za X let“ (chyba × čas). */
  function hodnotPrevod(kola, cil) {
    let P = 1, soucet = 0, maxZ = 0; for (const [a, b] of kola) { P *= a / b; soucet += a + b; maxZ = Math.max(maxZ, a, b); }
    const chyba = P / Math.abs(cil) - 1, zaRokDni = Math.abs(chyba) * K.ROK;
    return { kola, pomer: P, chyba, zaRokDni, denZaRoku: zaRokDni > 0 ? 1 / zaRokDni : Infinity, soucet, maxZ };
  }
  /** Výběr „rozumného“ převodu: z nejlepších podle chyby ten s nejmenším součtem zubů, je-li chyba ≤ mez. */
  function vyberPrevod(seznam, mezDnuZaRok) {
    if (!seznam.length) return null;
    const mez = mezDnuZaRok == null ? 0.02 : mezDnuZaRok;
    const vyhovi = seznam.filter((v) => v.zaRokDni <= mez);
    if (!vyhovi.length) return seznam[0];
    return vyhovi.reduce((a, b) => (b.soucet < a.soucet ? b : a));
  }

  /* ============================================================
     Návrh mechanismu
     ============================================================ */
  const VYCHOZI = {
    m: 1.5, b: 6, mezera: 2, tlRamene: 5, alfa: 20,
    dStred: 8, dHridel: 4, krokTrubek: 1, vuleOtvor: 0.2, vuleZub: 0.1, vuleKolize: 1,
    zMin: 12, zMax: 100, D: 0,
    zemeTyp: 'mezikolo', zC: 30, dRemenice: 30,
    mesic: true, mesicStupne: 2, mesicKola: null,
    naklon: true, uzly: true, uzlyStupne: 2, uzlyKola: null,
    den: false, denStupne: 3, denKola: null, mDen: 1,
    planety: false, zK: 15, zA: 60, zKv: null, zV: null, zKm: null, zMe: null,
    globus: 50, mesicD: 14, mesicR: 55, lampa: 36,
    sklon: K.SKLON, sklonMesice: K.SKLON_MESICE,
    jd0: 2461041.5          // 1. 1. 2026 0:00 UT – datum, ke kterému se model seřídí
  };
  const ra = (m, z) => m * (z + 2) / 2;      // hlavová kružnice (bez korekce)

  /** poloha bodu cesty: oblouk z úseků l_i, konec ve vzdálenosti D, strana ±1 → body od O k E */
  function obloukCesty(l, D, strana) {
    const n = l.length, suma = l.reduce((a, b) => a + b, 0);
    const konec = (kap) => { let x = 0, y = 0; for (let i = 0; i < n; i++) { const t = kap * (i - (n - 1) / 2); x += l[i] * Math.cos(t); y += l[i] * Math.sin(t); } return [x, y]; };
    if (n === 1) { if (Math.abs(l[0] - D) > 1e-6 * Math.max(1, D)) return null; return [[0, 0], [D, 0]]; }
    if (D > suma + 1e-9) return null;
    let kap = 0;
    if (D < suma - 1e-9) {
      let lo = 0, hi = Math.min(PI, TAU / n);
      const f = (k) => Math.hypot(...konec(k)) - D;
      if (f(hi) > 0) return null;
      for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
      kap = (lo + hi) / 2;
    }
    const [ex, ey] = konec(kap), rot = -Math.atan2(ey, ex), c = Math.cos(rot), s = Math.sin(rot);
    const body = [[0, 0]]; let x = 0, y = 0;
    for (let i = 0; i < n; i++) {
      const t = kap * (i - (n - 1) / 2);
      x += l[i] * Math.cos(t); y += l[i] * Math.sin(t);
      body.push([x * c - y * s, strana * (x * s + y * c)]);
    }
    body[n] = [D, 0];
    return body;
  }

  /**
   * Definice soukolí (vlaku) na rameni: první kolo pevné na centrálním sloupu, poslední na ose Země.
   * stupne = [[zH, zN], …], i0Cil = požadovaný Willisův poměr (se znaménkem).
   * Vrací rozvržení: hřídele (body), kola, záběry – pro zvolené umístění mezikol.
   */
  function rozvrhniVlak(def, D, p, strana, hostitel, pridavek) {
    const m = def.m || p.m, st = def.stupne, n = st.length;
    let zak = 1; for (const [a, b] of st) zak *= a / b;
    const znamCil = def.i0Cil < 0 ? -1 : 1;
    // počet mezikol: parita (−1)^(n + k) = znaménko cíle
    let k = ((n + (znamCil < 0 ? 1 : 0)) % 2 === 0) ? 0 : 1;
    if (def.remen) k = 0;
    const delkaBez = st.reduce((s, [a, b]) => s + m * (a + b) / 2, 0);
    const navrhni = (kk) => {
      const mezi = [];
      if (kk > 0) {
        // zbytek délky dorovnají mezikola v hostitelském stupni
        const chybi = D - delkaBez;
        let zi = Math.ceil((chybi / kk) / m + 0.5);
        zi = Math.max(p.zMin, Math.min(p.zMax, Math.max(zi, p.zMin) + (pridavek || 0)));
        for (let i = 0; i < kk; i++) mezi.push(zi);
      }
      return mezi;
    };
    let mezi = navrhni(k);
    let delka = def.remen ? D : delkaBez + mezi.reduce((s, z) => s + m * z, 0);
    if (!def.remen && delka < D - 1e-9 && k + 2 <= 3) { k += 2; mezi = navrhni(k); delka = delkaBez + mezi.reduce((s, z) => s + m * z, 0); }
    // úseky cesty a příslušnost hřídelů
    const l = [], hridele = [{ typ: 'stred' }], kola = [], zabery = [];
    for (let s = 0; s < n; s++) {
      const [zH, zN] = st[s], hostí = s === hostitel && mezi.length;
      const zs = hostí ? [zH].concat(mezi, [zN]) : [zH, zN];
      if (def.remen) { l.push(D); hridele.push({ typ: 'zeme' }); continue; }
      for (let i = 0; i < zs.length - 1; i++) {
        l.push(m * (zs[i] + zs[i + 1]) / 2);
        const posledni = s === n - 1 && i === zs.length - 2;
        hridele.push({ typ: posledni ? 'zeme' : (i < zs.length - 2 ? 'mezikolo' : 'vlozena') });
      }
    }
    const body = obloukCesty(l, D, strana);
    if (!body) return { ok: false, duvod: def.remen ? '' : (delka < D ? 'soukolí je kratší než rameno (zvětšete zuby nebo modul)' : 'soukolí nelze ohnout na délku ramene (zmenšete zuby nebo prodlužte rameno)'), mezi, delka };
    hridele.forEach((h, i) => { h.x = body[i][0]; h.y = body[i][1]; });
    // kola po hřídelích
    let hi = 0;
    for (let s = 0; s < n; s++) {
      const [zH, zN] = st[s], hostí = s === hostitel && mezi.length && !def.remen;
      const zs = hostí ? [zH].concat(mezi, [zN]) : [zH, zN];
      let pred = null;
      for (let i = 0; i < zs.length; i++) {
        const hr = hi + i;
        const role = i === 0 ? 'hnaci' : i === zs.length - 1 ? 'hnane' : 'mezikolo';
        const g = { vlak: def.id, stupen: s, z: zs[i], hridel: hr, role, remenice: !!def.remen };
        kola.push(g);
        if (pred) zabery.push({ a: pred, b: g, remen: !!def.remen });
        pred = g;
      }
      hi += zs.length - 1;
    }
    return { ok: true, hridele, kola, zabery, mezi, delka, l, strana, hostitel };
  }

  /** Přepárování stupňů (součin se nemění): největší hnací kolo na sloup, největší hnané na osu Země. */
  function preparuj(kola) {
    const h = kola.map((k) => k[0]).sort((a, b) => b - a), n = kola.map((k) => k[1]).sort((a, b) => a - b);
    return h.map((zh, i) => [zh, n[i]]);
  }

  /** Úplný návrh. Vrací objekt mechanismu (nebo s chybami). */
  function navrh(vstup) {
    const p = Object.assign({}, VYCHOZI, vstup || {});
    for (const k of ['m', 'b', 'mezera', 'tlRamene', 'dStred', 'dHridel', 'krokTrubek', 'vuleOtvor', 'vuleZub', 'vuleKolize', 'zMin', 'zMax', 'D', 'zC', 'dRemenice', 'zK', 'zA', 'globus', 'mesicD', 'mesicR', 'lampa', 'sklon', 'sklonMesice', 'jd0', 'mDen']) p[k] = +p[k];
    const chyby = [], varovani = [], m = p.m;
    if (!(m > 0)) chyby.push('Modul musí být kladný.');
    if (!(p.zMin >= 6 && p.zMax > p.zMin)) chyby.push('Rozsah zubů musí být např. 10–120.');
    if (chyby.length) return { ok: false, chyby, varovani, p };

    /* ---- soukolí (vlaky) ---- */
    const vlaky = [];
    // pořadí trubek na ose E (zevnitř): den, Země, Měsíc, uzly → odhad otvoru posledního kola vlaku
    const poradiE = ['den', 'zeme', 'mesic', 'uzly'].filter((id) => id === 'zeme' || (id === 'mesic' && p.mesic) || (id === 'uzly' && p.mesic && p.naklon && p.uzly) || (id === 'den' && p.den));
    const otvorE = (id) => p.dHridel + poradiE.indexOf(id) * p.krokTrubek + p.vuleOtvor;
    const venecOk = (mm, z, otvor) => mm * (z - 2.5) / 2 - otvor / 2 >= 1.2 * mm + 0.4;
    /** automatická volba převodu: přesnost ≤ mez, nejmenší součet zubů, kola na sloupu a na ose E musí mít dost silný věnec */
    const auto = (cil, n, id, mm) => {
      const s = hledejPrevody({ cil: Math.abs(cil), stupne: n, zMin: p.zMin, zMax: p.zMax, pocet: 150 });
      const pref = s.filter((v) => v.zaRokDni <= 0.02).sort((a, b) => a.soucet - b.soucet).concat(s.filter((v) => v.zaRokDni > 0.02));
      for (const v of pref) {
        const kola = preparuj(v.kola);
        if (venecOk(mm, kola[0][0], p.dStred + p.vuleOtvor) && venecOk(mm, kola[n - 1][1], otvorE(id))) return Object.assign({}, v, { kola });
      }
      return s[0] ? Object.assign({}, s[0], { kola: preparuj(s[0].kola) }) : null;
    };
    if (p.den) {
      const i0 = 1 - CILE.den, sel = p.denKola || (auto(i0, p.denStupne, 'den', p.mDen > 0 ? p.mDen : p.m) || {}).kola;
      if (sel) vlaky.push({ id: 'den', nazev: 'Rotace Země (den)', i0Cil: i0, stupne: sel, cilAbs: CILE.den, perioda: K.DEN_SID, m: p.mDen > 0 ? p.mDen : p.m });
      else varovani.push('Pro rotaci Země se nenašel převod v rozsahu zubů.');
    }
    vlaky.push(p.zemeTyp === 'remen'
      ? { id: 'zeme', nazev: 'Rovnoběžná osa Země', i0Cil: 1, stupne: [[1, 1]], remen: true, cilAbs: 0 }
      : { id: 'zeme', nazev: 'Rovnoběžná osa Země', i0Cil: 1, stupne: [[p.zC, p.zC]], cilAbs: 0 });
    if (p.mesic) {
      const i0 = 1 - CILE.mesicAbs, sel = p.mesicKola || (auto(i0, p.mesicStupne, 'mesic', p.m) || {}).kola;
      if (sel) vlaky.push({ id: 'mesic', nazev: 'Nosič Měsíce', i0Cil: i0, stupne: sel, cilAbs: CILE.mesicAbs, perioda: K.SYN });
      else varovani.push('Pro Měsíc se nenašel převod v rozsahu zubů.');
    }
    if (p.mesic && p.naklon && p.uzly) {
      const i0 = 1 - CILE.uzly, sel = p.uzlyKola || (auto(i0, p.uzlyStupne, 'uzly', p.m) || {}).kola;
      if (sel) vlaky.push({ id: 'uzly', nazev: 'Uzly dráhy Měsíce', i0Cil: i0, stupne: sel, cilAbs: CILE.uzly, perioda: K.UZLY });
      else varovani.push('Pro uzly se nenašel převod v rozsahu zubů.');
    }

    /* ---- délka ramene ---- */
    const delkaVlaku = (v) => v.remen ? 0 : v.stupne.reduce((s, [a, b]) => s + (v.m || m) * (a + b) / 2, 0);
    const Dmin = p.lampa / 2 + (p.mesic ? p.mesicR + p.mesicD / 2 : p.globus / 2) + 10;
    let D = p.D > 0 ? p.D : Math.max(Dmin, Math.ceil(Math.max(...vlaky.map(delkaVlaku)) * 0.97));
    if (p.zemeTyp !== 'remen' && !(p.D > 0)) D = Math.max(D, m * (p.zC + p.zMin));
    D = Math.round(D * 10) / 10;
    if (D < Dmin) varovani.push(`Rameno ${fmt(D, 1)} mm je krátké: Měsíc by narážel do lampy (minimum ≈ ${fmt(Dmin, 0)} mm).`);

    /* ---- vrstvy: zdola den, Země, Měsíc, uzly (vnitřní trubka = nejnižší kolo) ---- */
    let vrstva = 0;
    for (const v of vlaky) { v.vrstva0 = vrstva; vrstva += v.stupne.length; }
    const nVrstev = vrstva;
    const zVrstvy = (k) => p.mezera + k * (p.b + p.mezera);

    /* ---- rozvržení: zkus strany a hostitele mezikol, vyber bez kolizí a nejužší ---- */
    const kontrolaKolizi = (S) => {
      const kol = [];
      const { hr, kola, zabery } = S;
      const zabira = (a, b) => zabery.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
      for (let i = 0; i < kola.length; i++) for (let j = i + 1; j < kola.length; j++) {
        const A = kola[i], B = kola[j];
        if (A.vrstva !== B.vrstva || A.hr === B.hr || zabira(A, B)) continue;
        const d = Math.hypot(A.x - B.x, A.y - B.y), mez = A.ra + B.ra + p.vuleKolize;
        if (d < mez) kol.push({ typ: 'kola', a: A, b: B, presah: mez - d });
      }
      // kolo × cizí hřídel procházející jeho vrstvou; čep lze uchytit zespodu (rameno) nebo shora (můstek) – vybere se lepší
      for (const H of hr) {
        const r = H.typ === 'stred' ? p.dStred / 2 : H.typ === 'zeme' ? H.rVnejsi || p.dHridel : p.dHridel / 2 + 2;
        const vlastni = kola.filter((k) => k.hr === H);
        const pevna = H.typ === 'stred' || H.typ === 'zeme';
        const vrch = pevna ? Infinity : Math.max(...vlastni.map((k) => k.vrstva)), spod = pevna ? -1 : Math.min(...vlastni.map((k) => k.vrstva));
        const zasahy = (od, po) => {
          const out = [];
          for (const G of kola) {
            if (G.hr === H || G.vrstva < od || G.vrstva > po) continue;
            const d = Math.hypot(G.x - H.x, G.y - H.y), mez = G.ra + r + p.vuleKolize;
            if (d < mez) out.push({ typ: 'hridel', a: G, h: H, presah: mez - d });
          }
          return out;
        };
        if (pevna) { kol.push(...zasahy(-1, Infinity)); continue; }
        const dole = zasahy(-1, vrch), nahore = zasahy(spod, Infinity);
        const sk = (z) => z.reduce((s2, c) => s2 + 1000 + c.presah, 0) + (z === nahore ? 50 : 0);
        H.shora = sk(nahore) < sk(dole);
        kol.push(...(H.shora ? nahore : dole));
      }
      return kol;
    };
  const zkusD = (D) => {
    const varianty = vlaky.map((v) => {
      const out = [];
      const klice = new Set();
      for (const prid of [0, 6, 14, 24]) for (const strana of [1, -1]) for (let h = v.stupne.length - 1; h >= 0; h--) {
        const r = rozvrhniVlak(v, D, p, strana, h, prid);
        if (r.ok) {
          const k = r.mezi.join(',') + '|' + strana + '|' + (r.mezi.length ? h : '');
          if (klice.has(k)) continue;
          klice.add(k); out.push(r);
        } else if (!out.length && h === 0 && strana === -1 && prid === 24) out.push(r);
      }
      return out;
    });
    const sestav = (volba) => {
      const hr = [{ id: 'O', typ: 'stred', x: 0, y: 0, nazev: 'centrální sloup (Slunce)' }, { id: 'E', typ: 'zeme', x: D, y: 0, nazev: 'osa Země' }];
      const kola = [], zabery = [];
      volba.forEach((r, vi) => {
        const v = vlaky[vi];
        if (!r.ok) return;
        const mapa = r.hridele.map((h, i) => {
          if (h.typ === 'stred') return hr[0];
          if (h.typ === 'zeme') return hr[1];
          const id = v.id + i;
          const n = { id, typ: h.typ, x: h.x, y: h.y, vlak: v.id, nazev: (h.typ === 'mezikolo' ? 'čep mezikola ' : 'vložená hřídel ') + v.nazev.toLowerCase() };
          hr.push(n); return n;
        });
        for (const g of r.kola) {
          const hh = mapa[g.hridel];
          const vr = v.vrstva0 + g.stupen;
          const mv = v.m || m;
          const kolo = Object.assign({}, g, { hr: hh, x: hh.x, y: hh.y, vrstva: vr, z0: zVrstvy(vr), m: mv,
            d: g.remenice ? p.dRemenice : mv * g.z, ra: g.remenice ? p.dRemenice / 2 + 1.5 : ra(mv, g.z) });
          g.ref = kolo; kola.push(kolo);
        }
        for (const e of r.zabery) zabery.push({ a: e.a.ref, b: e.b.ref, remen: e.remen });
      });
      return { hr, kola, zabery };
    };
    // paprskové hledání (beam search): vlaky postupně, drží se K nejlepších částečných sestav
    const hodnot = (volba) => {
      const S = sestav(volba), kol = kontrolaKolizi(S);
      const sirka = Math.max(0, ...S.hr.map((h) => Math.abs(h.y)));
      return { skore: kol.reduce((s, c) => s + 1000 + c.presah * 10, 0) + sirka + volba.reduce((s, r) => s + (r.ok ? 0 : 1e6), 0), S, kol, volba };
    };
    let paprsky = [{ volba: [] }];
    for (let i = 0; i < vlaky.length; i++) {
      const nove = [];
      for (const pp of paprsky) for (const r of varianty[i]) nove.push(hodnot(pp.volba.concat([r])));
      nove.sort((x, y) => x.skore - y.skore);
      paprsky = nove.slice(0, 10);
    }
    let nejlepsi = paprsky[0] || hodnot([]);
    nejlepsi.D = D;
    return nejlepsi;
  };
    let nejlepsi = zkusD(D);
    if (!(p.D > 0) && nejlepsi.skore >= 1000) {
      for (let Dz = D + 4; Dz <= D + 160; Dz += 4) {
        const n2 = zkusD(Dz);
        if (n2.skore < nejlepsi.skore) nejlepsi = n2;
        if (n2.skore < 1000) break;
      }
      D = nejlepsi.D;
    }
    const { S, kol, volba } = nejlepsi;
    volba.forEach((r, i) => { if (!r.ok) chyby.push(`${vlaky[i].nazev}: ${r.duvod || 'nelze rozmístit'}.`); vlaky[i].rozvrh = r; });

    /* ---- osa Země: soustředné trubky (zevnitř: den, Země, Měsíc, uzly) ---- */
    const naE = S.kola.filter((g) => g.hr.id === 'E').sort((a, b) => a.vrstva - b.vrstva);
    let dIn = p.dHridel;
    const trubky = [];
    naE.forEach((g, i) => {
      const dV = i === 0 ? p.dHridel : dIn + p.krokTrubek;
      trubky.push({ vlak: g.vlak, dVnejsi: dV, dVnitrni: i === 0 ? 0 : dIn + p.krokTrubek * 0.1, kolo: g });
      g.otvor = dV + p.vuleOtvor; g.uchyceni = 'pevně na ' + (i === 0 ? 'hřídeli' : 'trubce') + ' Ø' + fmt(dV, 1);
      dIn = dV;
    });
    const E = S.hr[1]; E.rVnejsi = dIn / 2; E.trubky = trubky;
    for (const g of S.kola) {
      if (g.hr.id === 'O') { g.otvor = p.dStred + p.vuleOtvor; g.uchyceni = 'pevně na centrálním sloupu (nehybné)'; g.pevne = true; }
      else if (g.hr.id !== 'E') { g.otvor = p.dHridel + p.vuleOtvor; g.uchyceni = g.role === 'mezikolo' ? 'volně na čepu' : 'volně na čepu, spojené s kolem druhého stupně (dvojkolo)'; }
    }
    const kol2 = kontrolaKolizi(S);

    /* ---- výšky ---- */
    const zKol = zVrstvy(nVrstev - 1) + p.b;
    const mustek = S.hr.some((h) => h.shora);
    const zMustek = zKol + p.mezera;                     // spodek horního můstku
    const zTop = mustek ? zMustek + p.tlRamene : zKol;
    const zUzly = zTop + 3, zRamMesice = zUzly + (p.mesic && p.naklon ? 2.5 + 2 * (p.mesicR + 4) * Math.tan(p.sklonMesice * RAD) + 3 : 3);
    const Hg = Math.max(zRamMesice + 6 + p.globus / 2, zTop + 12 + p.globus / 2);
    for (const t of trubky) t.delka = (t.vlak === 'den' ? Hg : t.vlak === 'zeme' ? Hg - p.globus / 2 * Math.cos(p.sklon * RAD) - 2 : t.vlak === 'mesic' ? zRamMesice : zUzly) - t.kolo.z0 + 1;

    /* ---- kinematika (Willis): relativní otáčky vůči rameni, propagace přes záběry ---- */
    const kinem = kinematika(S.kola, S.zabery);
    const vystupy = {};
    for (const v of vlaky) {
      const fin = S.kola.find((g) => g.vlak === v.id && g.hr.id === 'E');
      if (!fin) continue;
      let i0 = 1; for (const [a, b] of v.stupne) i0 *= -a / b; // každý záběr −, mezikola jen mění znaménko
      const mezi = v.rozvrh && v.rozvrh.ok && !v.remen ? v.rozvrh.mezi.length : 0;
      if (v.remen) i0 = 1; else i0 *= Math.pow(-1, mezi);
      const abs = 1 - i0, delta = abs - v.cilAbs;
      vystupy[v.id] = { kolo: fin, i0, abs, absKinem: fin.omegaAbs, rel: fin.omegaRel, cil: v.cilAbs, delta,
        chyba: v.cilAbs ? abs / v.cilAbs - 1 : abs,
        dnuZaRok: v.perioda ? Math.abs(delta) * v.perioda : 0 };
      const o = vystupy[v.id]; o.denZaRoku = o.dnuZaRok > 0 ? 1 / o.dnuZaRok : Infinity;
    }
    if (vystupy.mesic) vystupy.mesic.mesicVsSid = vystupy.mesic.abs / CILE.mesicSid - 1;
    if (vystupy.uzly) vystupy.uzly.stupnuZaRok = Math.abs(vystupy.uzly.delta) * 360;

    /* ---- pohon: klika → hřídel K → kolo ramene zA (pod ramenem) + planety ---- */
    const aK = m * (p.zK + p.zA) / 2;
    const pohon = { zK: p.zK, zA: p.zA, aK, dnuNaOtacku: K.ROK * p.zK / p.zA, otacekZaRok: p.zA / p.zK };
    const planety = [];
    if (p.planety) {
      const S0 = p.zK + p.zA, aK = m * S0 / 2;
      // souosost: m'·(z_K' + z_P) = m·(z_K + z_A) – lze použít i jiný normalizovaný modul
      const MOD = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.125, 1.25, 1.375, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4];
      for (const [id, nazev, cil, zKx, zX] of [['venuse', 'Venuše', CILE.venuse, p.zKv, p.zV], ['merkur', 'Merkur', CILE.merkur, p.zKm, p.zMe]]) {
        let best = null;
        const q = cil * p.zK / p.zA;
        if (zKx > 0 && zX > 0) best = { a: +zKx, b: +zX, mm: 2 * aK / (+zKx + +zX) };
        else for (const mm of MOD) {
          const Sx = 2 * aK / mm;
          if (Math.abs(Sx - Math.round(Sx)) > 1e-9) continue;
          const S2 = Math.round(Sx), a0 = Math.round(S2 * q / (1 + q));
          for (let a = a0 - 2; a <= a0 + 2; a++) {
            const b = S2 - a;
            if (a < p.zMin || b < p.zMin || a > p.zMax * 1.5 || b > p.zMax * 1.5) continue;
            const ch = Math.abs((a / b) / (p.zK / p.zA) / cil - 1);
            if (!best || ch < best.ch - 1e-12 || (Math.abs(ch - best.ch) < 1e-12 && Math.abs(mm - m) < Math.abs(best.mm - m))) best = { a, b, ch, mm };
          }
        }
        if (!best) { chyby.push(`${nazev}: nenašel se souosý převod.`); continue; }
        const pomer = (best.a / best.b) / (p.zK / p.zA);
        planety.push({ id, nazev, zK: best.a, z: best.b, m: best.mm, pomer, cil, chyba: pomer / cil - 1, a: best.mm * (best.a + best.b) / 2 });
      }
      for (const pl of planety) { pl.souose = Math.abs(pl.a - aK) < 1e-9; if (!pl.souose) chyby.push(`${pl.nazev}: rozteč ${fmt(pl.a, 3)} mm ≠ ${fmt(aK, 3)} mm – kolo by nebylo souosé s centrálním sloupem.`); }
      // poloměry drah (ne v měřítku): mezi lampou a vnitřním okrajem dráhy Měsíce
      const vnitr = D - (p.mesic ? p.mesicR + p.mesicD / 2 : p.globus / 2) - 6, r0 = p.lampa / 2 + 8;
      if (vnitr - r0 < 14) varovani.push('Venuše a Merkur se mezi lampu a Měsíc nevejdou – prodlužte rameno nebo zmenšete dráhu Měsíce.');
      planety[0].r = r0 + (vnitr - r0) * 0.8; planety[1].r = r0 + (vnitr - r0) * 0.3;
    }

    /* ---- kontroly ---- */
    const kontroly = [];
    for (const e of S.zabery) {
      const d = Math.hypot(e.a.x - e.b.x, e.a.y - e.b.y), a = e.remen ? d : e.a.m * (e.a.z + e.b.z) / 2;
      kontroly.push({ typ: 'roztec', ok: Math.abs(d - a) < 1e-6, a, d, z1: e.a.z, z2: e.b.z, remen: e.remen, text: `${e.remen ? 'řemínek' : 'záběr'} z${e.a.z}–z${e.b.z}: ${e.remen ? 'rozteč' : 'a = (z1+z2)·m/2 ='} ${fmt(a, 3)} mm, skutečná vzdálenost os ${fmt(d, 3)} mm` });
    }
    for (const c of kol2) {
      const t = c.typ === 'kola' ? `Kolize kol z${c.a.z} a z${c.b.z} ve vrstvě ${c.a.vrstva + 1} (přesah ${fmt(c.presah, 1)} mm)` : `Kolo z${c.a.z} (vrstva ${c.a.vrstva + 1}) zasahuje do hřídele „${c.h.nazev}“ (přesah ${fmt(c.presah, 1)} mm)`;
      chyby.push(t + ' – změňte délku ramene, modul nebo převod.');
    }
    for (const g of S.kola) if (!g.remenice) {
      const venec = g.m * (g.z - 2.5) / 2 - g.otvor / 2;
      if (venec <= 0.3) chyby.push(`Kolo z${g.z} (${g.hr.id === 'O' ? 'na sloupu' : g.hr.id === 'E' ? 'na ose Země' : 'na čepu ' + g.hr.id}): otvor Ø${fmt(g.otvor, 2)} zasahuje do ozubení (patní kružnice Ø${fmt(g.m * (g.z - 2.5), 2)}).`);
      else if (venec < g.m) varovani.push(`Kolo z${g.z}: tenký věnec pod zuby (${fmt(venec, 2)} mm).`);
    }
    for (const g of S.kola) if (!g.remenice && g.z < 17) varovani.push(`Kolo z${g.z}: méně než 17 zubů → podřezání paty (pro 3D tisk obvykle nevadí, zub je jen slabší).`);
    if (p.mesic && p.mesicR + p.mesicD / 2 + 4 > D - p.lampa / 2) varovani.push('Dráha Měsíce zasahuje k lampě.');
    if (p.mesic && p.mesicR < p.globus / 2 + p.mesicD / 2 + 4) varovani.push('Měsíc by narážel do glóbu – zvětšete poloměr jeho dráhy.');
    if (S.hr.some((h) => h.id !== 'O' && h.id !== 'E' && Math.hypot(h.x, h.y) > D + 1e-6)) varovani.push('Některá hřídel leží za osou Země – rameno bude delší.');

    const mech = { ok: chyby.length === 0, chyby, varovani, p, D, vlaky, hridele: S.hr, kola: S.kola, zabery: S.zabery, kinem, vystupy,
      vrstev: nVrstev, zVrstvy, zKol, mustek, zMustek, zTop, zUzly, zRamMesice, Hg, trubky, pohon, planety, kontroly, kolize: kol2 };
    mech.rameno = obrysRamene(mech);
    fazeKol(mech);
    mech.kusovnik = kusovnik(mech);
    return mech;
  }

  /**
   * Kinematika: otáčky každého kola vůči rameni (ω_rel) a absolutně (ω_abs = 1 + ω_rel), za 1 otáčku ramene.
   * Willis: pevné centrální kolo má ω_abs = 0 → ω_rel = −1; vnější záběr: ω_rel,B = −ω_rel,A · zA / zB,
   * řemínek: ω_rel,B = ω_rel,A · dA / dB; kola na společné hřídeli (mimo osu E) mají stejné ω.
   */
  function kinematika(kola, zabery) {
    for (const g of kola) { g.omegaRel = null; g.omegaAbs = null; }
    for (const g of kola) if (g.hr.id === 'O') { g.omegaRel = -1; }
    let zmena = true, iter = 0;
    while (zmena && iter++ < 100) {
      zmena = false;
      for (const e of zabery) {
        for (const [A, B] of [[e.a, e.b], [e.b, e.a]]) {
          if (A.omegaRel != null && B.omegaRel == null) { B.omegaRel = e.remen ? A.omegaRel * A.d / B.d : -A.omegaRel * A.z / B.z; zmena = true; }
        }
      }
      for (const A of kola) if (A.omegaRel != null) for (const B of kola) {
        if (B.omegaRel == null && B.hr === A.hr && A.hr.id !== 'E' && A.hr.id !== 'O' && B.vlak === A.vlak && B.role !== 'mezikolo' && A.role !== 'mezikolo') { B.omegaRel = A.omegaRel; zmena = true; }
      }
    }
    for (const g of kola) g.omegaAbs = g.omegaRel == null ? null : 1 + g.omegaRel;
    return kola.map((g) => ({ vlak: g.vlak, z: g.z, rel: g.omegaRel, abs: g.omegaAbs }));
  }

  /** Počáteční natočení kol, aby zuby zapadaly (v rámci ramene); úhel zubu 0 = +x místního rámce. */
  function fazeKol(mech) {
    const kola = mech.kola;
    for (const g of kola) g.psi0 = null;
    const pevne = kola.filter((g) => g.hr.id === 'O');
    for (const g of pevne) g.psi0 = 0;
    let zmena = true, it = 0;
    while (zmena && it++ < 100) {
      zmena = false;
      for (const e of mech.zabery) for (const [A, B] of [[e.a, e.b], [e.b, e.a]]) {
        if (A.psi0 == null || B.psi0 != null) continue;
        if (e.remen) { B.psi0 = 0; zmena = true; continue; }
        const fAB = Math.atan2(B.y - A.y, B.x - A.x), fBA = fAB + PI;
        B.psi0 = fBA + PI / B.z - (A.psi0 - fAB) * A.z / B.z; zmena = true;
      }
      for (const A of kola) if (A.psi0 != null) for (const B of kola) if (B.psi0 == null && B.hr === A.hr && A.hr.id !== 'E') { B.psi0 = 0; zmena = true; }
    }
    for (const g of kola) if (g.psi0 == null) g.psi0 = 0;
  }

  /** Obrys ramene: konvexní obal kružnic kolem os na rameni (O, E, čepy) + otvory. */
  function obrysRamene(mech) {
    const p = mech.p, kruhy = [];
    for (const h of mech.hridele) {
      let dOtv;
      if (h.id === 'O') dOtv = p.dStred + p.vuleOtvor;
      else if (h.id === 'E') dOtv = 2 * (h.rVnejsi || p.dHridel / 2) + p.vuleOtvor;
      else dOtv = p.dHridel - 0.05;       // čep nalisovaný do ramene
      const rN = Math.max(dOtv / 2 + 5, h.id === 'O' ? p.dStred / 2 + 7 : 6);
      kruhy.push({ x: h.x, y: h.y, r: rN, otvor: dOtv / 2, id: h.id, nazev: h.nazev });
    }
    const body = [];
    for (const k of kruhy) for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; body.push([k.x + k.r * Math.cos(a), k.y + k.r * Math.sin(a)]); }
    const obrys = konvexniObal(body);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of obrys) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { obrys, otvory: kruhy, tl: p.tlRamene, x0, x1, y0, y1, delka: x1 - x0, sirka: y1 - y0 };
  }
  function konvexniObal(P) {
    const b = P.slice().sort((a, c) => a[0] - c[0] || a[1] - c[1]);
    const kr = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
    const dol = [], hor = [];
    for (const q of b) { while (dol.length >= 2 && kr(dol[dol.length - 2], dol[dol.length - 1], q) <= 1e-12) dol.pop(); dol.push(q); }
    for (let i = b.length - 1; i >= 0; i--) { const q = b[i]; while (hor.length >= 2 && kr(hor[hor.length - 2], hor[hor.length - 1], q) <= 1e-12) hor.pop(); hor.push(q); }
    hor.pop(); dol.pop();
    return dol.concat(hor); // proti směru hodin
  }

  /* ---------- poloha modelu a ideálu v čase ---------- */
  /**
   * Stav k datu JD. Model je seřízen podle ideálu k datu p.jd0; rameno je kalendář (= ideální délka Země),
   * ostatní výstupy se točí podle převodů. Vrací úhly (°) a natočení kol (rad, absolutně).
   */
  function stav(mech, jd) {
    const id = idealni(jd), id0 = idealni(mech.p.jd0);
    const otacky = (jd - mech.p.jd0) / K.ROK;           // otáčky ramene od seřízení
    const ramenoDeg = id.zeme;                           // rameno míří od Slunce k Zemi
    const v = mech.vystupy;
    const model = {
      zeme: id.zeme, slunce: id.slunce,
      osaZeme: v.zeme ? norm360(360 * v.zeme.abs * otacky) : 0,       // natočení nosiče osy (mělo by být 0)
      mesic: v.mesic ? norm360(id0.mesic + 360 * v.mesic.abs * otacky) : id.mesic,
      uzel: v.uzly ? norm360(id0.uzel + 360 * v.uzly.abs * otacky) : id0.uzel,   // bez precese: uzly pevně v prostoru
      gmst: v.den ? norm360(id0.gmst + 360 * v.den.abs * otacky) : null
    };
    model.D = norm360(model.mesic - model.slunce);
    const fazeM = faze(model.D), fazeI = faze(id.D);
    const sklonM = mech.p.sklonMesice;
    const naklon = mech.p.mesic && mech.p.naklon;
    const betaM = naklon ? sklonM * Math.sin((model.mesic - model.uzel) * RAD) : 0;
    const betaI = sklonM * Math.sin((id.mesic - id.uzel) * RAD);
    // natočení kol: ψ = ψ0 + 2π·ω_rel·otáčky, absolutně + úhel ramene (rameno se točí z návrhové polohy +x)
    const thR = ramenoDeg * RAD;
    const kola = mech.kola.map((g) => g.psi0 + TAU * (g.omegaRel || 0) * otacky);
    const dPhase = norm180(model.D - id.D);
    return { jd, otacky, rameno: ramenoDeg, thR, idealni: id, model, kola,
      faze: { model: fazeM, idealni: fazeI, rozdilDeg: dPhase, rozdilDni: dPhase / 360 * K.SYN, rozdilHod: dPhase / 360 * K.SYN * 24 },
      obdobi: rocniObdobi(skutecne(jd).slunce), betaM, betaI,
      zatmeniModel: naklon ? zatmeni(model.D, model.mesic - model.uzel, 1) : { typ: null, bezSklonu: true, uNovoluni: Math.abs(norm180(model.D)) < 12, uUplnku: Math.abs(norm180(model.D - 180)) < 12 },
      zatmeniIdeal: zatmeni(id.D, id.mesic - id.uzel, 1),
      planety: mech.planety.map((pl) => ({ id: pl.id, model: norm360(id0[pl.id] + 360 * pl.pomer * otacky), idealni: id[pl.id] })) };
  }

  /** Rozcházení modelu a ideálu: fáze Měsíce (dny) po N letech od seřízení. */
  function rozchazeni(mech, roky) {
    const v = mech.vystupy.mesic;
    if (!v) return null;
    const dTurns = (v.abs - CILE.mesicAbs) * roky;      // rozdíl oběhů
    return { roky, dnu: dTurns * K.SYN, stupnu: dTurns * 360 };
  }

  /* ---------- kusovník ---------- */
  function kusovnik(mech) {
    const p = mech.p, out = [], m = p.m;
    let poz = 1;
    const nazevVlaku = Object.fromEntries(mech.vlaky.map((v) => [v.id, v.nazev]));
    const kola = mech.kola.slice().sort((a, b) => a.vrstva - b.vrstva || a.x - b.x);
    kola.forEach((g, i) => { g.poz = 'K' + (i + 1); });
    for (const g of kola) {
      out.push({ poz: g.poz, druh: g.remenice ? 'řemenice' : 'kolo', nazev: (g.remenice ? 'Řemenice Ø' + fmt(g.d, 0) : `Kolo z${g.z}`) + ' – ' + nazevVlaku[g.vlak].toLowerCase() + (g.role === 'mezikolo' ? ' (mezikolo)' : ''),
        ks: 1, z: g.remenice ? null : g.z, m: g.remenice ? null : g.m, d: g.d, da: g.remenice ? g.d + 3 : g.m * (g.z + 2), b: p.b, otvor: g.otvor, vrstva: g.vrstva + 1, osa: g.hr.id === 'O' ? 'O' : g.hr.id === 'E' ? 'E' : g.hr.id,
        otacekRok: g.omegaAbs, uchyceni: g.uchyceni });
    }
    const pz = (t) => out.push(Object.assign({ poz: 'D' + (poz++) }, t));
    // pohon
    pz({ druh: 'kolo', nazev: `Pastorek kliky z${p.zK}`, ks: 1, z: p.zK, m, d: m * p.zK, da: m * (p.zK + 2), b: p.b, otvor: p.dHridel + p.vuleOtvor, osa: 'K', uchyceni: 'pevně na hřídeli kliky', otacekRok: mech.pohon.otacekZaRok, pohon: true });
    pz({ druh: 'kolo', nazev: `Kolo ramene z${p.zA}`, ks: 1, z: p.zA, m, d: m * p.zA, da: m * (p.zA + 2), b: p.b, otvor: p.dStred + p.vuleOtvor, osa: 'O', uchyceni: 'přišroubované zespodu k náboji ramene', otacekRok: 1, pohon: true });
    for (const pl of mech.planety) {
      pz({ druh: 'kolo', nazev: `Pastorek ${pl.nazev} z${pl.zK}`, ks: 1, z: pl.zK, m: pl.m, d: pl.m * pl.zK, da: pl.m * (pl.zK + 2), b: p.b, otvor: p.dHridel + p.vuleOtvor, osa: 'K', uchyceni: 'pevně na hřídeli kliky', pohon: true, otacekRok: mech.pohon.otacekZaRok });
      pz({ druh: 'kolo', nazev: `Kolo ${pl.nazev} z${pl.z}`, ks: 1, z: pl.z, m: pl.m, d: pl.m * pl.z, da: pl.m * (pl.z + 2), b: p.b, otvor: (pl.id === 'venuse' ? p.dStred - 2 : p.dStred - 4) + p.vuleOtvor, osa: 'O', uchyceni: 'pevně na trubce/hřídeli uvnitř sloupu', pohon: true, otacekRok: pl.pomer });
    }
    // hřídele a trubky
    const Lsloup = mech.Hg + p.tlRamene + 40;
    pz({ druh: 'hřídel', nazev: `Centrální sloup Ø${fmt(p.dStred, 1)} (nehybný)`, ks: 1, rozmer: `Ø${fmt(p.dStred, 1)} × ${fmt(Lsloup, 0)} mm`, poznamka: mech.planety.length ? 'trubka – uvnitř hřídele Venuše a Merkuru' : 'ocel / mosaz; pevná kola nalepit nebo zajistit kolíkem' });
    for (const h of mech.hridele.filter((x) => x.id !== 'O' && x.id !== 'E')) {
      const vr = mech.kola.filter((g) => g.hr === h).map((g) => g.vrstva), hore = Math.max(...vr), dole = Math.min(...vr);
      const L = h.shora ? mech.zMustek + p.tlRamene - mech.zVrstvy(dole) + 1 : mech.zVrstvy(hore) + p.b + p.tlRamene + 2;
      pz({ druh: 'hřídel', nazev: `Čep ${h.id} Ø${fmt(p.dHridel, 1)} (${h.typ === 'mezikolo' ? 'mezikolo' : 'dvojkolo'})`, ks: 1, rozmer: `Ø${fmt(p.dHridel, 1)} × ${fmt(L, 0)} mm`, poznamka: `${h.shora ? 'nalisovat shora do horního můstku' : 'nalisovat do ramene'} v bodě [${fmt(h.x, 2)}; ${fmt(h.y, 2)}] mm` });
    }
    for (const t of mech.trubky) pz({ druh: 'hřídel', nazev: (t.dVnitrni ? 'Trubka' : 'Hřídel') + ` osy Země – ${nazevVlaku[t.vlak].toLowerCase()}`, ks: 1, rozmer: `Ø${fmt(t.dVnejsi, 1)}${t.dVnitrni ? '/' + fmt(t.dVnitrni, 1) : ''} × ${fmt(t.delka + p.tlRamene, 0)} mm`, poznamka: 'teleskopické mosazné trubky (krok ' + fmt(p.krokTrubek, 1) + ' mm)' });
    if (mech.mustek) {
      pz({ druh: 'díl', nazev: 'Horní můstek (deska)', ks: 1, rozmer: `${fmt(mech.rameno.delka, 0)} × ${fmt(mech.rameno.sirka, 0)} × ${fmt(p.tlRamene, 1)} mm`, poznamka: `stejný obrys jako rameno, ${fmt(mech.zMustek, 1)} mm nad ramenem; nese čepy uchycené shora (${mech.hridele.filter((h) => h.shora).map((h) => h.id).join(', ')})` });
      pz({ druh: 'hřídel', nazev: 'Sloupky můstku', ks: 3, rozmer: `Ø6 × ${fmt(mech.zMustek, 1)} mm (distanční, se závitem M3)`, poznamka: 'na okraji desky mimo kola' });
    }
    pz({ druh: 'díl', nazev: 'Rameno (deska)', ks: 1, rozmer: `${fmt(mech.rameno.delka, 0)} × ${fmt(mech.rameno.sirka, 0)} × ${fmt(p.tlRamene, 1)} mm`, poznamka: 'překližka / plexi (laser) nebo 3D tisk; šablona v PDF' });
    pz({ druh: 'ložisko', nazev: 'Uložení ramene na sloupu', ks: 1, rozmer: p.dStred === 8 ? 'kuličkové ložisko 688 (8×16×5) nebo kluzné pouzdro' : `kluzné pouzdro Ø${fmt(p.dStred, 1)}`, poznamka: 'pod rameno axiální podložka (PTFE / mosaz)' });
    pz({ druh: 'ložisko', nazev: 'Podložky mezi vrstvami', ks: mech.kola.length + 2, rozmer: `Ø${fmt(p.dHridel, 1)} / Ø${fmt(p.dHridel + 4, 1)} × ${fmt(p.mezera, 1)} mm`, poznamka: 'distanční podložky = mezera mezi vrstvami kol' });
    pz({ druh: 'díl', nazev: `Glóbus Ø${fmt(p.globus, 0)} mm`, ks: 1, rozmer: `na ose skloněné o ${fmt(p.sklon, 2)}°`, poznamka: p.den ? 'otáčí se – spojka (kardan 1:1) mezi svislou hřídelí dne a šikmou osou' : 'nasazený na šikmý čep nosiče osy' });
    if (p.mesic) pz({ druh: 'díl', nazev: `Měsíc Ø${fmt(p.mesicD, 0)} mm na rameni r = ${fmt(p.mesicR, 0)} mm`, ks: 1, rozmer: 'kulička (dřevo / 3D tisk)', poznamka: p.naklon ? `tyčka jezdí po šikmém kotouči uzlů (sklon ${fmt(p.sklonMesice, 2)}°)` : 'v rovině ekliptiky' });
    if (p.mesic && p.naklon) pz({ druh: 'díl', nazev: 'Šikmý kotouč uzlů' + (p.uzly ? ' (otáčí se – precese uzlů)' : ' (pevný – bez precese)'), ks: 1, rozmer: `Ø${fmt(2 * p.mesicR + 8, 0)} mm, sklon horní plochy ${fmt(p.sklonMesice, 2)}°`, poznamka: 'STL v exportu; tyčka Měsíce se volně posouvá v rameni Měsíce a spodkem jezdí po kotouči' });
    pz({ druh: 'díl', nazev: `Lampa (Slunce) Ø${fmt(p.lampa, 0)} mm`, ks: 1, rozmer: 'LED 5–12 V, matné stínítko', poznamka: 'na vrcholu sloupu, střed ve výšce středu glóbu' });
    pz({ druh: 'díl', nazev: 'Pohon: klika přes kuželové soukolí 1:1 nebo převodový motorek', ks: 1, rozmer: `1 otáčka kliky = ${fmt(mech.pohon.dnuNaOtacku, 2)} dne`, poznamka: `hřídel kliky ${fmt(mech.pohon.aK, 2)} mm od středu; motorek 1 ot/min → rok za ${fmt(mech.pohon.otacekZaRok, 1)} min` });
    pz({ druh: 'díl', nazev: 'Podstavec s kalendářním kruhem', ks: 1, rozmer: `Ø ≥ ${fmt(2 * (mech.D + (p.mesic ? p.mesicR : 0) + 30), 0)} mm`, poznamka: 'kruh se 365¼ dny a znameními; rameno ukazuje datum' });
    return out;
  }

  function fmt(v, des) {
    if (v == null || !isFinite(v)) return '–';
    return (des == null ? String(v) : Number(v).toFixed(des)).replace('-', '−').replace('.', ',');
  }

  const API = { K, CILE, VYCHOZI, norm360, norm180, gcd, jdZData, dataZJd, idealni, skutecne, faze, rocniObdobi, delkaDne, zatmeni, zatmeniMeeus, dalsiZatmeni,
    retezovyZlomek, cinitele, zlomekNaKola, jednoducheStupne, hledejPrevody, hodnotPrevod, vyberPrevod,
    obloukCesty, rozvrhniVlak, preparuj, navrh, kinematika, fazeKol, obrysRamene, konvexniObal, stav, rozchazeni, kusovnik, fmt, ra };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PLAN = API;
})(typeof window !== 'undefined' ? window : globalThis);
