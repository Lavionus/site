/* Návrhář diskových vaček – výpočetní jádro bez DOM.
   Jednotky: délky mm, úhly vstupně ve stupních, derivace podle úhlu natočení vačky v radiánech
   (s' = ds/dθ [mm/rad], s'' [mm/rad²], s''' [mm/rad³]); časové veličiny přes ω = 2πn/60.

   Geometrie (pevný rámec): střed vačky v počátku, osa zdvihátka svislá ve vzdálenosti e = −ε
   od středu, zdvihátko se pohybuje v +y. Vačka se otáčí ve směru hodinových ručiček (při „smer = 'ccw'“
   se celá úloha zrcadlí podle osy y). Bod vačky s vlastními souřadnicemi q se v okamžiku θ nachází v
   R(−θ)·q, tedy profil vačky ve vlastním rámci je q(θ) = R(θ)·P(θ), kde P je bod dotyku v pevném rámci.
   Excentricita ε > 0 znamená posunutí, které ZMENŠUJE tlakový úhel při náběhu:
     tan φ = (s' − ε) / (d0 + s),   d0 = √(Rp² − ε²),   Rp = Rb (+ Rr u kladky).            */
(function () {
  'use strict';
  const PI = Math.PI, TAU = 2 * PI;
  const RAD = PI / 180;

  // ───────────────────────── pohybové zákony (normované x ∈ [0,1], y ∈ [0,1]) ─────────────────────────
  // každý vrací [y, y', y'', y'''] (derivace podle x)
  const ZAKONY = {
    harmonicky: {
      nazev: 'Harmonický (kosinový)',
      kratce: 'harmonický',
      f(x) {
        const a = PI * x;
        return [(1 - Math.cos(a)) / 2, PI / 2 * Math.sin(a), PI * PI / 2 * Math.cos(a), -PI * PI * PI / 2 * Math.sin(a)];
      },
      Cv: PI / 2, Ca: PI * PI / 2, Cj: PI * PI * PI / 2,
      popis: 'Nejmenší špička zrychlení z běžných zákonů, ale na začátku a konci zdvihu má zrychlení skok (±π²/2·h/β²). ' +
        'Mezi výdržemi proto vzniká teoreticky nekonečný ryv (ráz) – vhodný jen pro malé otáčky nebo pro navazující zdvih–návrat bez výdrže.'
    },
    cykloidni: {
      nazev: 'Cykloidní (sinusové zrychlení)',
      kratce: 'cykloidní',
      f(x) {
        const a = TAU * x;
        return [x - Math.sin(a) / TAU, 1 - Math.cos(a), TAU * Math.sin(a), TAU * TAU * Math.cos(a)];
      },
      Cv: 2, Ca: TAU, Cj: TAU * TAU,
      popis: 'Zrychlení začíná i končí nulou, takže s výdržemi tvoří spojité zrychlení (ryv konečný, ale na krajích skok ±4π²). ' +
        'Za klid se platí vyšší rychlostí (2·h/β) a zrychlením (2π·h/β²) – větší tlakový úhel i menší poloměr křivosti.'
    },
    p345: {
      nazev: 'Polynomický 3-4-5',
      kratce: '3-4-5',
      f(x) {
        const x2 = x * x, x3 = x2 * x;
        return [10 * x3 - 15 * x2 * x2 + 6 * x3 * x2, 30 * x2 - 60 * x3 + 30 * x2 * x2, 60 * x - 180 * x2 + 120 * x3, 60 - 360 * x + 360 * x2];
      },
      Cv: 15 / 8, Ca: 10 / Math.sqrt(3), Cj: 60,
      popis: 'Kompromis: y = 10x³ − 15x⁴ + 6x⁵. Rychlost i zrychlení na krajích nulové, ryv na krajích skokem ±60. ' +
        'Špičky rychlosti a zrychlení leží mezi harmonickým a cykloidním zákonem.'
    },
    p4567: {
      nazev: 'Polynomický 4-5-6-7',
      kratce: '4-5-6-7',
      f(x) {
        const x2 = x * x, x3 = x2 * x, x4 = x2 * x2;
        return [35 * x4 - 84 * x4 * x + 70 * x3 * x3 - 20 * x4 * x3,
          140 * x3 - 420 * x4 + 420 * x4 * x - 140 * x3 * x3,
          420 * x2 - 1680 * x3 + 2100 * x4 - 840 * x4 * x,
          840 * x - 5040 * x2 + 8400 * x3 - 4200 * x4];
      },
      Cv: 35 / 16, Ca: null, Cj: null,
      popis: 'Spojitý i ryv (nulový na krajích) – nejhladší chod u rychloběžných vaček, ' +
        'ale nejvyšší rychlost a zrychlení ze zde nabízených zákonů.'
    }
  };
  // maxima 4-5-6-7 (|y''| a |y'''|) dopočítáme numericky jednou
  (function () {
    let a = 0, j = 0;
    for (let i = 0; i <= 20000; i++) { const r = ZAKONY.p4567.f(i / 20000); a = Math.max(a, Math.abs(r[2])); j = Math.max(j, Math.abs(r[3])); }
    ZAKONY.p4567.Ca = a; ZAKONY.p4567.Cj = j;
  })();

  // ───────────────────────── parametry ─────────────────────────
  const VYCHOZI = {
    zakonNabeh: 'cykloidni', zakonNavrat: 'cykloidni',
    Rb: 40, h: 20, beta1: 120, delta1: 60, beta2: 120,   // dolní výdrž = 360 − součet
    n: 300,                                                 // ot/min
    typ: 'kladka', Rr: 10, eps: 0, smer: 'cw',
    tloustka: 10, otvor: 16,
    m: 0.5, k: 2, F0: 20, svisle: true                     // kg, N/mm, N
  };

  function cislo(v) { return typeof v === 'number' && isFinite(v); }

  /** Ověří parametry; vrátí {chyby:[], p: normalizovaná kopie}. Chyby zabrání výpočtu. */
  function over(vstup) {
    const p = Object.assign({}, VYCHOZI, vstup || {});
    const chyby = [];
    const chce = (klic, popis, min, ostre) => {
      const v = p[klic];
      if (!cislo(v)) { chyby.push({ pole: klic, text: `${popis}: zadejte číslo.` }); return false; }
      if (ostre ? v <= min : v < min) { chyby.push({ pole: klic, text: `${popis} musí být ${ostre ? 'větší než' : 'alespoň'} ${String(min).replace('.', ',')}.` }); return false; }
      return true;
    };
    chce('Rb', 'Poloměr základní kružnice', 0, true);
    chce('h', 'Zdvih', 0, true);
    chce('beta1', 'Úhel náběhu', 0, true);
    chce('delta1', 'Horní výdrž', 0, false);
    chce('beta2', 'Úhel návratu', 0, true);
    chce('n', 'Otáčky', 0, false);
    if (!ZAKONY[p.zakonNabeh]) chyby.push({ pole: 'zakonNabeh', text: 'Neznámý zákon náběhu.' });
    if (!ZAKONY[p.zakonNavrat]) chyby.push({ pole: 'zakonNavrat', text: 'Neznámý zákon návratu.' });
    if (!['hrot', 'kladka', 'plochy'].includes(p.typ)) chyby.push({ pole: 'typ', text: 'Neznámý typ zdvihátka.' });
    if (p.smer !== 'cw' && p.smer !== 'ccw') p.smer = 'cw';
    if (!cislo(p.eps)) chyby.push({ pole: 'eps', text: 'Excentricita: zadejte číslo (může být 0 nebo záporná).' });
    if (p.typ === 'kladka') chce('Rr', 'Poloměr kladky', 0, true);
    if (cislo(p.beta1) && cislo(p.beta2) && cislo(p.delta1)) {
      const soucet = p.beta1 + p.delta1 + p.beta2;
      if (soucet > 360 + 1e-9) chyby.push({ pole: 'beta1', text: `Náběh + horní výdrž + návrat = ${fmt(soucet, 1)}° > 360°. Úhly se do jedné otáčky nevejdou.` });
    }
    if (p.typ !== 'plochy' && cislo(p.eps) && cislo(p.Rb)) {
      const Rp = p.Rb + (p.typ === 'kladka' && cislo(p.Rr) ? p.Rr : 0);
      if (Math.abs(p.eps) >= Rp) chyby.push({ pole: 'eps', text: `|Excentricita| musí být menší než poloměr ${p.typ === 'kladka' ? 'roztečné' : 'základní'} kružnice (${fmt(Rp, 1)} mm) – jinak se zdvihátko vačky nedotkne.` });
    }
    // disk
    chce('tloustka', 'Tloušťka vačky', 0, true);
    chce('otvor', 'Průměr otvoru', 0, false);
    // síly
    chce('m', 'Hmotnost zdvihátka', 0, false);
    chce('k', 'Tuhost pružiny', 0, false);
    if (!cislo(p.F0)) chyby.push({ pole: 'F0', text: 'Předpětí pružiny: zadejte číslo.' });
    p.delta2 = cislo(p.beta1) && cislo(p.beta2) && cislo(p.delta1) ? Math.max(0, 360 - p.beta1 - p.delta1 - p.beta2) : 0;
    return { chyby, p };
  }

  // ───────────────────────── pohyb s(θ) ─────────────────────────
  function useky(p) {
    const b1 = p.beta1, d1 = p.delta1, b2 = p.beta2;
    const u = [
      { typ: 'nabeh', od: 0, do: b1, zakon: p.zakonNabeh },
      { typ: 'vydrzH', od: b1, do: b1 + d1 },
      { typ: 'navrat', od: b1 + d1, do: b1 + d1 + b2, zakon: p.zakonNavrat },
      { typ: 'vydrzD', od: b1 + d1 + b2, do: 360 }
    ];
    return u.filter(x => x.do - x.od > 1e-12);
  }

  /** hodnoty v úseku u při normované poloze x (0..1) → [s, s', s'', s'''] (derivace podle θ v rad) */
  function vUseku(p, u, x) {
    const b = (u.do - u.od) * RAD;
    if (u.typ === 'vydrzH') return [p.h, 0, 0, 0];
    if (u.typ === 'vydrzD') return [0, 0, 0, 0];
    const y = ZAKONY[u.zakon].f(Math.min(1, Math.max(0, x)));
    const h = p.h, z = u.typ === 'nabeh' ? 1 : -1;
    return [u.typ === 'nabeh' ? h * y[0] : h * (1 - y[0]), z * h * y[1] / b, z * h * y[2] / (b * b), z * h * y[3] / (b * b * b)];
  }

  /** pohyb v úhlu θ (stupně, libovolný – bere se modulo 360) */
  function pohyb(p, thDeg, _u) {
    const u = _u || useky(p);
    let t = ((thDeg % 360) + 360) % 360;
    for (const s of u) if (t >= s.od && t < s.do) return vUseku(p, s, (t - s.od) / (s.do - s.od));
    const s = u[u.length - 1];
    return vUseku(p, s, 1);
  }

  /** skoky s, s', s'' na hranicích úseků (limita zleva vs. zprava) */
  function skoky(p) {
    const u = useky(p), vys = [];
    for (let i = 0; i < u.length; i++) {
      const L = u[i], R = u[(i + 1) % u.length];
      if (u.length === 1) break;
      const a = vUseku(p, L, 1), b = vUseku(p, R, 0);
      vys.push({ uhel: L.do % 360, ds: b[0] - a[0], dv: b[1] - a[1], da: b[2] - a[2], dj: b[3] - a[3], zleva: a, zprava: b });
    }
    return vys;
  }

  // ───────────────────────── geometrie ─────────────────────────
  function poloRozteci(p) { return p.typ === 'kladka' ? p.Rb + p.Rr : p.Rb; }

  /** tlakový úhel (rad) pro hrotové/kladkové zdvihátko */
  function tlakovyUhel(p, s, s1) {
    if (p.typ === 'plochy') return 0;
    const Rp = poloRozteci(p), d0 = Math.sqrt(Rp * Rp - p.eps * p.eps);
    return Math.atan2(s1 - p.eps, d0 + s);
  }

  /** Bod analytického výpočtu v úhlu θ: vrací objekt se vším potřebným.
      Souřadnice „pevné“ = v rámu stojanu v okamžiku θ; „vacka“ = ve vlastním rámu vačky (bez zrcadlení směru). */
  function bod(p, thDeg, _u) {
    const [s, s1, s2, s3] = pohyb(p, thDeg, _u);
    const th = thDeg * RAD, c = Math.cos(th), sn = Math.sin(th);
    const rot = (x, y) => [c * x - sn * y, sn * x + c * y];   // R(θ)
    const o = { th: thDeg, s, s1, s2, s3 };
    if (p.typ === 'plochy') {
      const D = p.Rb + s;
      const Pf = [-s1, D];                 // bod dotyku v pevném rámu (x měřeno od středu vačky)
      o.P = Pf; o.stred = [-p.eps, D];
      o.vacka = rot(Pf[0], Pf[1]);
      o.rho = p.Rb + s + s2;               // poloměr křivosti profilu
      o.phi = 0;
      o.dotykOdOsy = -s1 + p.eps;          // poloha dotyku na talíři vůči ose zdvihátka
      return o;
    }
    const e = -p.eps, Rp = poloRozteci(p);
    const d0 = Math.sqrt(Rp * Rp - e * e), D = d0 + s;
    const A = [-D, e + s1];                            // tečna roztečné křivky (pevný rám) = dq/dθ otočené zpět
    const B = [-e - 2 * s1, -D + s2];
    const nA = Math.hypot(A[0], A[1]);
    const krz = A[0] * B[1] - A[1] * B[0];
    o.rhoRoztec = krz === 0 ? Infinity : nA * nA * nA / krz;   // > 0 vypuklá, < 0 vydutá
    o.stred = [e, D];                                  // hrot / střed kladky
    o.roztec = rot(e, D);
    const nor = [A[1] / nA, -A[0] / nA];               // vnější normála (pevný rám)
    o.normala = nor;
    if (p.typ === 'kladka') {
      o.P = [e - p.Rr * nor[0], D - p.Rr * nor[1]];
      o.rho = o.rhoRoztec - p.Rr;                      // poloměr křivosti skutečného profilu (vypuklý > 0)
    } else {
      o.P = [e, D];
      o.rho = o.rhoRoztec;
    }
    o.vacka = rot(o.P[0], o.P[1]);
    o.phi = Math.atan2(s1 - p.eps, D);
    return o;
  }

  function zrcadli(p, b) { return p.smer === 'ccw' ? [-b[0], b[1]] : b; }

  /** Úplný rozbor návrhu. krok = vzorkování ve stupních. */
  function vypocet(vstup, volby) {
    const { chyby, p } = over(vstup);
    if (chyby.length) return { ok: false, chyby, p };
    const krok = (volby && volby.krok) || 0.5;
    const N = Math.round(360 / krok);
    const u = useky(p);
    const w = TAU * p.n / 60;
    const body = [];
    for (let i = 0; i < N; i++) body.push(bod(p, i * krok, u));
    body.push(Object.assign({}, body[0], { th: 360 }));
    // profil ve vlastním rámu vačky (s ohledem na směr)
    const profil = body.slice(0, N).map(b => zrcadli(p, b.vacka));
    const roztecna = p.typ === 'plochy' ? null : body.slice(0, N).map(b => zrcadli(p, b.roztec));
    // extrémy
    const ex = { sMax: 0, vMax: 0, vMin: 0, aMax: 0, aMin: 0, jMax: 0, jMin: 0, phiMax: 0, phiMin: 0, phiMaxUhel: 0, phiMinUhel: 0,
      rhoMin: Infinity, rhoMinUhel: 0, rhoRoztecMinVypukla: Infinity, rhoRoztecMinVypuklaUhel: 0, rMin: Infinity, rMax: 0 };
    for (const b of body) {
      ex.sMax = Math.max(ex.sMax, b.s);
      ex.vMax = Math.max(ex.vMax, b.s1); ex.vMin = Math.min(ex.vMin, b.s1);
      ex.aMax = Math.max(ex.aMax, b.s2); ex.aMin = Math.min(ex.aMin, b.s2);
      ex.jMax = Math.max(ex.jMax, b.s3); ex.jMin = Math.min(ex.jMin, b.s3);
      if (b.phi > ex.phiMax) { ex.phiMax = b.phi; ex.phiMaxUhel = b.th; }
      if (b.phi < ex.phiMin) { ex.phiMin = b.phi; ex.phiMinUhel = b.th; }
      if (b.rho > 0 && b.rho < ex.rhoMin) { ex.rhoMin = b.rho; ex.rhoMinUhel = b.th; }
      if (p.typ !== 'plochy' && b.rhoRoztec > 0 && b.rhoRoztec < ex.rhoRoztecMinVypukla) { ex.rhoRoztecMinVypukla = b.rhoRoztec; ex.rhoRoztecMinVypuklaUhel = b.th; }
      const r = Math.hypot(b.vacka[0], b.vacka[1]);
      ex.rMin = Math.min(ex.rMin, r); ex.rMax = Math.max(ex.rMax, r);
    }
    // nejmenší algebraický poloměr křivosti (pro plochý = podmínka konvexity)
    let rhoAlgMin = Infinity, rhoAlgUhel = 0;
    for (const b of body) if (b.rho < rhoAlgMin) { rhoAlgMin = b.rho; rhoAlgUhel = b.th; }
    // vydutá místa skutečného profilu (rho < 0) – nejmenší |rho|
    let vydutaMin = Infinity, vydutaUhel = 0;
    for (const b of body) if (b.rho < 0 && !(b.rhoRoztec > 0) && -b.rho < vydutaMin) { vydutaMin = -b.rho; vydutaUhel = b.th; }
    ex.rhoAlgMin = rhoAlgMin; ex.rhoAlgUhel = rhoAlgUhel; ex.vydutaMin = vydutaMin; ex.vydutaUhel = vydutaUhel;
    // talíř
    if (p.typ === 'plochy') {
      let a = Infinity, b2 = -Infinity;
      for (const b of body) { a = Math.min(a, b.dotykOdOsy); b2 = Math.max(b2, b.dotykOdOsy); }
      ex.talirOd = a; ex.talirDo = b2;
    }
    // časové veličiny
    const cas = { w, vMax: Math.max(ex.vMax, -ex.vMin) * w / 1000, aMax: Math.max(ex.aMax, -ex.aMin) * w * w / 1000,
      jMax: Math.max(ex.jMax, -ex.jMin) * w * w * w / 1000, perioda: p.n > 0 ? 60 / p.n : Infinity };
    // síly (tuhý model)
    const g = p.svisle ? 9.81 : 0;
    let FyMin = Infinity, FyMinUhel = 0, FnMax = 0, FnMaxUhel = 0;
    const sily = body.map(b => {
      const a = b.s2 * w * w / 1000;                     // m/s²
      const Fy = p.F0 + p.k * b.s + p.m * (a + g);       // síla ve směru osy zdvihátka, kterou musí vačka vyvinout
      const Fn = Fy / Math.cos(b.phi);
      if (Fy < FyMin) { FyMin = Fy; FyMinUhel = b.th; }
      if (Fn > FnMax) { FnMax = Fn; FnMaxUhel = b.th; }
      return { Fy, Fn };
    });
    // potřebné předpětí, aby Fy ≥ 0 všude
    let F0pot = -Infinity;
    for (const b of body) { const a = b.s2 * w * w / 1000; F0pot = Math.max(F0pot, -(p.k * b.s + p.m * (a + g))); }
    const silyEx = { FyMin, FyMinUhel, FnMax, FnMaxUhel, F0potreba: Math.max(0, F0pot), Mmax: 0 };
    // krouticí moment na hřídeli M = Fy·s' (výkonová rovnováha, bez tření) [N·mm]
    let Mmax = 0, Mmin = 0;
    body.forEach((b, i) => { const M = sily[i].Fy * b.s1; Mmax = Math.max(Mmax, M); Mmin = Math.min(Mmin, M); });
    silyEx.Mmax = Mmax; silyEx.Mmin = Mmin;

    const vys = { ok: true, p, body, profil, roztecna, ex, cas, sily, silyEx, useky: u, skoky: skoky(p), krok };
    vys.profilPolarni = jePolarneMonotonni(profil);
    vys.kontroly = kontroly(vys);
    return vys;
  }

  /** Je uzavřený polygon polárně monotónní (každý paprsek ze středu ho protne jen jednou)? */
  function jePolarneMonotonni(pts) {
    let celk = 0, zpet = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      let d = Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0]);
      while (d > PI) d -= TAU; while (d < -PI) d += TAU;
      celk += d;
      if (d * Math.sign(celk || d) < -1e-9) zpet++;
    }
    return Math.abs(Math.abs(celk) - TAU) < 1e-6 && zpet === 0;
  }

  // ───────────────────────── kontroly ─────────────────────────
  function fmt(x, d) {
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    let t = Math.abs(x).toFixed(d === undefined ? 1 : d);
    const [c, des] = t.split('.');
    t = (c.length > 4 ? c.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') : c) + (des ? ',' + des : '');
    return (x < 0 && /[1-9]/.test(t) ? '−' : '') + t;
  }
  const DEG = 180 / PI;

  function kontroly(v) {
    const { p, ex } = v, k = [];
    const add = (uroven, kod, text) => k.push({ uroven, kod, text });   // chyba | varovani | info | ok
    // 1) tlakový úhel
    if (p.typ !== 'plochy') {
      const pm = Math.max(ex.phiMax, -ex.phiMin) * DEG;
      if (pm > 45) add('chyba', 'tlak', `Tlakový úhel dosahuje ${fmt(pm)}° – nad ~45° hrozí zadření zdvihátka ve vedení. Zvětšete Rb, prodlužte úhly náběhu/návratu nebo použijte excentricitu.`);
      else if (pm > 30) add('varovani', 'tlak', `Největší tlakový úhel ${fmt(pm)}° překračuje obvyklou mez 30° pro translační zdvihátko (velké boční síly ve vedení).`);
      else add('ok', 'tlak', `Tlakový úhel nejvýše ${fmt(pm)}° (doporučeno ≤ 30°).`);
    } else add('ok', 'tlak', 'Ploché zdvihátko s talířem kolmým na osu má tlakový úhel trvale 0°.');
    // 2) křivost / podřezání
    if (p.typ === 'kladka') {
      const rr = ex.rhoRoztecMinVypukla;
      if (rr <= p.Rr) add('chyba', 'podrez', `Podřezání: nejmenší poloměr křivosti roztečné křivky ve vypuklé části je ${fmt(rr)} mm (u ${fmt(ex.rhoRoztecMinVypuklaUhel, 1)}°), ` +
        `což je méně než poloměr kladky ${fmt(p.Rr)} mm. Skutečný profil se v tomto místě přetočí (smyčka/hrot) a kladka by neprošla zadanou dráhou. Zvětšete Rb nebo zmenšete kladku.`);
      else if (rr < 1.5 * p.Rr) add('varovani', 'podrez', `Poloměr křivosti roztečné křivky ${fmt(rr)} mm je jen ${fmt(rr / p.Rr, 2)}× poloměr kladky – profil má ostré místo (ρ = ${fmt(rr - p.Rr)} mm), vysoký Hertzův tlak. Doporučuje se ρ_roztečné ≥ 1,5 až 3 × Rr.`);
      else add('ok', 'podrez', `Bez podřezání: min. ρ roztečné křivky ${fmt(rr)} mm > Rr = ${fmt(p.Rr)} mm (nejmenší ρ profilu ${fmt(ex.rhoMin)} mm).`);
      if (ex.vydutaMin < 5 * ex.rMax) {
        add('info', 'vyduta', `Profil má vydutá místa (nejmenší |ρ| = ${fmt(ex.vydutaMin)} mm). U kladky nevadí, obráběcí nástroj však musí mít poloměr menší než ${fmt(ex.vydutaMin)} mm.`);
      }
    } else if (p.typ === 'hrot') {
      if (ex.rhoMin < 0.5) add('varovani', 'hrot', `Profil má téměř ostrý vrchol (ρ = ${fmt(ex.rhoMin, 2)} mm) – hrot by zde rychle opotřeboval dráhu.`);
      add('info', 'hrot', 'Hrotové zdvihátko se dotýká v bodě: vysoký kontaktní tlak a opotřebení, vhodné jen pro malé síly a otáčky.' +
        (ex.vydutaMin < 5 * ex.rMax ? ` Vydutá místa (min. |ρ| ${fmt(ex.vydutaMin)} mm) hrot sleduje, obrábění vyžaduje nástroj o menším poloměru.` : ''));
    } else {
      if (ex.rhoAlgMin <= 0) add('chyba', 'konvex', `Profil není konvexní: Rb + s + s'' = ${fmt(ex.rhoAlgMin)} mm u ${fmt(ex.rhoAlgUhel, 1)}°. ` +
        'Plochý talíř by se dotýkal jen obálky (ve skutečnosti by „přeskočil“ vydutou část) – zdvih by neodpovídal zákonu. Zvětšete Rb nebo úhly náběhu/návratu.');
      else if (ex.rhoAlgMin < 0.1 * p.Rb + 2) add('varovani', 'konvex', `Nejmenší poloměr křivosti ${fmt(ex.rhoAlgMin)} mm je velmi malý (ostrá špička, vysoký kontaktní tlak).`);
      else add('ok', 'konvex', `Profil konvexní: min. ρ = Rb + s + s'' = ${fmt(ex.rhoAlgMin)} mm > 0.`);
      const sirka = ex.talirDo - ex.talirOd;
      add('info', 'talir', `Dotyk se na talíři pohybuje od ${fmt(ex.talirOd)} do ${fmt(ex.talirDo)} mm vůči ose zdvihátka (rozsah ${fmt(sirka)} mm = max s' − min s'). ` +
        `Talíř musí mít poloměr aspoň ${fmt(Math.max(-ex.talirOd, ex.talirDo))} mm + rezerva (≈ 2–5 mm).`);
      if (p.eps !== 0) add('info', 'excentr', 'U plochého talíře excentricita nemění profil ani tlakový úhel, jen přesouvá dotyk po talíři (ovlivní ohybový moment ve vedení).');
    }
    // 3) spojitost
    for (const s of v.skoky) {
      const uh = fmt(s.uhel, 1);
      const tolV = 1e-9 * Math.max(1, p.h), tolA = 1e-6 * Math.max(1, Math.abs(ex.aMax) + Math.abs(ex.aMin));
      if (Math.abs(s.dv) > tolV) add('chyba', 'skokv', `Skok rychlosti u ${uh}° (s' z ${fmt(s.zleva[1])} na ${fmt(s.zprava[1])} mm/rad) – teoreticky nekonečné zrychlení, ráz.`);
      else if (Math.abs(s.da) > tolA) add('varovani', 'skoka', `Skok zrychlení u ${uh}° (s'' z ${fmt(s.zleva[2])} na ${fmt(s.zprava[2])} mm/rad²) → nekonečný ryv; při vyšších otáčkách rázy a buzení kmitů.`);
    }
    // 4) geometrie disku
    if (p.otvor > 0) {
      const stena = ex.rMin - p.otvor / 2;
      if (stena <= 0) add('chyba', 'otvor', `Otvor ⌀ ${fmt(p.otvor)} mm je větší než nejmenší průměr profilu ${fmt(2 * ex.rMin)} mm.`);
      else if (stena < Math.max(3, 0.25 * p.otvor)) add('varovani', 'otvor', `Tenká stěna mezi otvorem a profilem: ${fmt(stena)} mm (doporučeno ≥ max(3 mm; 0,25·d)), počítejte i s drážkou pro pero.`);
    }
    if (p.typ === 'kladka' && p.Rr > p.Rb) add('info', 'kladka', `Kladka (Rr = ${fmt(p.Rr)} mm) je větší než základní kružnice – konstrukčně neobvyklé, ověřte zástavbu.`);
    if (p.delta2 === 0 && p.delta1 === 0) add('info', 'bezvydrze', 'Bez výdrží: zdvih přechází přímo v návrat (dvojitý zdvih).');
    // 5) síly
    if (p.n > 0) {
      const S = v.silyEx;
      if (S.FyMin < 0) add('chyba', 'odskok', `Ztráta kontaktu (odskok zdvihátka) u ${fmt(S.FyMinUhel, 1)}°: setrvačná síla převýší pružinu o ${fmt(-S.FyMin)} N. ` +
        `Potřebné předpětí pružiny je alespoň ${fmt(S.F0potreba)} N (při k = ${fmt(p.k, 2)} N/mm), s rezervou ≈ ${fmt(S.F0potreba * 1.3 + 1)} N.`);
      else add('ok', 'odskok', `Kontakt trvalý: nejmenší přítlak ve směru osy ${fmt(S.FyMin)} N (u ${fmt(S.FyMinUhel, 1)}°).`);
    }
    if (!v.profilPolarni && p.typ !== 'plochy') add('varovani', 'polar', 'Profil není polárně jednoznačný (paprsek ze středu ho protne vícekrát) – typicky důsledek podřezání. STL se vytvořit nedá.');
    return k;
  }

  /** Nejmenší Rb splňující kritéria (bisekce). Kritéria: phiMax [°], podřezání/konvexita s rezervou. */
  function minimalniRb(vstup, phiMaxDeg, rezervaRho) {
    phiMaxDeg = phiMaxDeg || 30; rezervaRho = rezervaRho || 0;
    const ok = Rb => {
      const v = vypocet(Object.assign({}, vstup, { Rb }), { krok: 1 });
      if (!v.ok) return false;
      const { p, ex } = v;
      if (p.typ !== 'plochy' && Math.max(ex.phiMax, -ex.phiMin) * DEG > phiMaxDeg) return false;
      if (p.typ === 'kladka' && ex.rhoRoztecMinVypukla <= p.Rr + rezervaRho) return false;
      if (p.typ === 'plochy' && ex.rhoAlgMin <= rezervaRho) return false;
      return true;
    };
    let hi = Math.max(1, (vstup.h || 10)) * 2;
    for (let i = 0; i < 30 && !ok(hi); i++) hi *= 2;
    if (!ok(hi)) return null;
    let lo = Math.max(1e-3, Math.abs(vstup.eps || 0) + 1e-3);
    if (ok(lo)) return lo;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
    return hi;
  }

  /** Normované srovnání zákonů pro tabulku: koeficienty a výsledky pro daný návrh */
  function porovnej(vstup, ids) {
    return ids.map(id => {
      const v = vypocet(Object.assign({}, vstup, { zakonNabeh: id, zakonNavrat: id }), { krok: 0.5 });
      return { id, zakon: ZAKONY[id], v };
    });
  }

  const API = { ZAKONY, VYCHOZI, over, useky, pohyb, vUseku, skoky, bod, tlakovyUhel, vypocet, kontroly, minimalniRb, porovnej, jePolarneMonotonni, fmt, RAD, DEG };
  if (typeof module !== 'undefined') module.exports = API; else window.Vacky = API;
})();
