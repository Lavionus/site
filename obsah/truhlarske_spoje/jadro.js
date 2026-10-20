/* ============================================================
   Šablony truhlářských spojů – jádro (bez DOM)
   Každý spoj se z parametrů složí do dílů. Díl = seznam těles, těleso = vytažený mnohoúhelník
   (hranol) podél jedné osy: {osa:'x'|'y'|'z', poly:[[u,v]…], diry:[[[u,v]…]…], w0, w1}.
   Kanonické souřadnice (u, v, w) jsou cyklické, aby převod do (x, y, z) neměl zrcadlení:
     osa x: u = y, v = z, w = x      osa y: u = z, v = x, w = y      osa z: u = x, v = y, w = z
   Jednotky mm. Díly se v sestavě nepronikají; obal = co má po složení vyplnit dřevo,
   dutiny = záměrné prázdné místo (dno dlabu, rezerva v otvoru pro kolík, štěrbina lamely).
   ============================================================ */
(function (koren) {
  'use strict';

  /* ---------------- materiály a nástroje ---------------- */
  const MATERIALY = {
    smrk: { nazev: 'Smrk', tvrde: false, hustota: 450, sklon: 6 },
    borovice: { nazev: 'Borovice', tvrde: false, hustota: 520, sklon: 6 },
    modrin: { nazev: 'Modřín', tvrde: false, hustota: 600, sklon: 7 },
    lipa: { nazev: 'Lípa', tvrde: false, hustota: 530, sklon: 6 },
    topol: { nazev: 'Topol', tvrde: false, hustota: 450, sklon: 6 },
    olse: { nazev: 'Olše', tvrde: false, hustota: 550, sklon: 7 },
    buk: { nazev: 'Buk', tvrde: true, hustota: 720, sklon: 8 },
    dub: { nazev: 'Dub', tvrde: true, hustota: 700, sklon: 8 },
    jasan: { nazev: 'Jasan', tvrde: true, hustota: 690, sklon: 8 },
    javor: { nazev: 'Javor', tvrde: true, hustota: 650, sklon: 8 },
    tresen: { nazev: 'Třešeň', tvrde: true, hustota: 600, sklon: 8 },
    orech: { nazev: 'Ořech', tvrde: true, hustota: 640, sklon: 8 },
    preklizka: { nazev: 'Překližka (bříza)', tvrde: true, hustota: 680, sklon: 8, deska: true },
    mdf: { nazev: 'MDF', tvrde: false, hustota: 750, sklon: 6, deska: true, mdf: true },
  };
  const PILY = {
    rybinova: { nazev: 'Pila na rybiny (čepovka jemná)', kerf: 0.45 },
    cepovka: { nazev: 'Čepovka', kerf: 0.6 },
    dozuki: { nazev: 'Japonská dozuki', kerf: 0.35 },
    ryoba: { nazev: 'Japonská ryoba', kerf: 0.5 },
    pasova: { nazev: 'Pásová pila', kerf: 0.9 },
    kotoucova: { nazev: 'Kotoučová / formátovací pila', kerf: 3.0 },
    laser: { nazev: 'Laser (tenká překližka)', kerf: 0.2 },
    cnc: { nazev: 'CNC fréza', kerf: 6, cnc: true },
    vlastni: { nazev: 'Vlastní šířka řezu', kerf: 0.5 },
  };
  const LAMELY = {
    '0': { L: 47, S: 15, T: 4, hloubka: 8 },
    '10': { L: 53, S: 19, T: 4, hloubka: 10 },
    '20': { L: 56, S: 23, T: 4, hloubka: 12.3 },
  };
  const R_KOTOUCE = 50;   // fréza lamelovačky Ø 100 mm

  const SPOJE = {
    rybina: { nazev: 'Rybinový ozub průběžný', ikona: 'rybina', kratce: 'Through dovetail' },
    polokryta: { nazev: 'Rybina polokrytá', ikona: 'polokryta', kratce: 'Half-blind dovetail' },
    cinky: { nazev: 'Cinkový (krabicový) spoj', ikona: 'cinky', kratce: 'Box / finger joint' },
    cep: { nazev: 'Čep a dlab', ikona: 'cep', kratce: 'Mortise & tenon' },
    preplatovani: { nazev: 'Přeplátování', ikona: 'preplatovani', kratce: 'Half-lap' },
    pero: { nazev: 'Pero a drážka', ikona: 'pero', kratce: 'Tongue & groove' },
    koliky: { nazev: 'Kolíky', ikona: 'koliky', kratce: 'Dowels' },
    lamelo: { nazev: 'Lamely (lamelo)', ikona: 'lamelo', kratce: 'Biscuits' },
  };

  const VYCHOZI = {
    spoj: 'rybina', material: 'buk', tA: 18, tB: 18, sirka: 150, sirkaB: 70, delkaA: 220, delkaB: 200,
    sklonAuto: true, sklon: 8, pocet: 4, cepUzky: 8, pulcep: 6, kryti: 5,
    vule: 0.1, presah: 0.5, pila: 'cepovka', kerf: 0.6, dlato: 12,
    prstu: 7,
    cepVarianta: 'slepy', cepTl: 0, osazeni: 12, hloubkaDlabu: 0, dnoDlabu: 2, rozevreni: 12, licovat: false,
    plVarianta: 'roh', plHloubka: 0,
    peroVarianta: 'pevne', peroTl: 0, peroHl: 0,
    kolVarianta: 'roh', kolPrumer: 8, kolDelka: 35, kolRoztec: 64, kolOkraj: 30,
    lamVarianta: 'sparovka', lamVel: '20', lamRoztec: 150, lamOkraj: 50,
    pocetSpoju: 1,
  };

  /* ---------------- pomocné 2D/3D funkce ---------------- */
  const r3 = (x) => Math.round(x * 1000) / 1000;
  function plocha(poly) { let s = 0; for (let i = 0, n = poly.length; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  /** sudo-liché pravidlo přes vnější obrys i díry */
  function uvnitr(u, v, kruhy) {
    let in_ = false;
    for (const P of kruhy) for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i], b = P[j];
      if ((a[1] > v) !== (b[1] > v) && u < (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]) + a[0]) in_ = !in_;
    }
    return in_;
  }
  /** průsečíky přímky (souřadnice k = 0 → u, 1 → v, hodnota c) s mnohoúhelníky → setříděné hodnoty druhé souřadnice */
  function pruseciky(kruhy, k, c) {
    const out = [], o = 1 - k;
    for (const P of kruhy) for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i], b = P[j];
      if ((a[k] > c) !== (b[k] > c)) out.push(a[o] + (b[o] - a[o]) * (c - a[k]) / (b[k] - a[k]));
    }
    return out.sort((p, q) => p - q);
  }
  function z3D(osa, P) { return osa === 'x' ? [P[1], P[2], P[0]] : osa === 'y' ? [P[2], P[0], P[1]] : [P[0], P[1], P[2]]; }
  function do3D(osa, u, v, w) { return osa === 'x' ? [w, u, v] : osa === 'y' ? [v, w, u] : [u, v, w]; }
  const OSY = { x: 0, y: 1, z: 2 };
  /** index světové osy, kterou je u, v, w tělesa */
  function osyTelesa(osa) { return osa === 'x' ? [1, 2, 0] : osa === 'y' ? [2, 0, 1] : [0, 1, 2]; }

  /** hranol z „přirozeného“ zápisu: osa x → body (y, z); osa y → (x, z); osa z → (x, y) */
  function hranol(osa, body, w0, w1, diry) {
    const prevod = osa === 'y' ? (q) => [q[1], q[0]] : (q) => [q[0], q[1]];
    const cisti = (P) => vycistiPoly(P.map(prevod));
    return { osa, poly: cisti(body), diry: (diry || []).map(cisti), w0: Math.min(w0, w1), w1: Math.max(w0, w1) };
  }
  function kvadr(x0, x1, y0, y1, z0, z1) { return hranol('z', [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1); }
  /** odstraní opakované a přímkové body */
  function vycistiPoly(P) {
    let Q = [];
    for (const p of P) { const q = Q[Q.length - 1]; if (!q || Math.abs(q[0] - p[0]) > 1e-9 || Math.abs(q[1] - p[1]) > 1e-9) Q.push([p[0], p[1]]); }
    while (Q.length > 1 && Math.abs(Q[0][0] - Q[Q.length - 1][0]) < 1e-9 && Math.abs(Q[0][1] - Q[Q.length - 1][1]) < 1e-9) Q.pop();
    let zmena = true;
    while (zmena && Q.length > 3) {
      zmena = false;
      for (let i = 0; i < Q.length; i++) {
        const a = Q[(i + Q.length - 1) % Q.length], b = Q[i], c = Q[(i + 1) % Q.length];
        const kr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (Math.abs(kr) < 1e-9) { Q.splice(i, 1); zmena = true; break; }
      }
    }
    return Q;
  }
  function kruhPoly(cu, cv, r, n) { const P = []; n = n || 32; for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * 2 * Math.PI; P.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]); } return P; }

  function objemTelesa(T) { let A = Math.abs(plocha(T.poly)); for (const d of T.diry || []) A -= Math.abs(plocha(d)); return A * (T.w1 - T.w0); }
  function objemDilu(d) { return d.telesa.reduce((s, T) => s + objemTelesa(T), 0); }
  function bodVTelese(T, P) {
    const [u, v, w] = z3D(T.osa, P);
    if (w <= T.w0 || w >= T.w1) return false;
    return uvnitr(u, v, [T.poly].concat(T.diry || []));
  }
  const bodVDilu = (d, P) => d.telesa.some((T) => bodVTelese(T, P));
  function mezeTelesa(T) {
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of T.poly) { u0 = Math.min(u0, q[0]); u1 = Math.max(u1, q[0]); v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); }
    const a = do3D(T.osa, u0, v0, T.w0), b = do3D(T.osa, u1, v1, T.w1);
    return [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[2], b[2])];
  }
  function mezeDilu(d) {
    const m = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
    for (const T of d.telesa) { const b = mezeTelesa(T); for (let i = 0; i < 6; i += 2) { m[i] = Math.min(m[i], b[i]); m[i + 1] = Math.max(m[i + 1], b[i + 1]); } }
    return m;
  }
  function posunTeleso(T, dx) {
    const ix = osyTelesa(T.osa), o = [dx[ix[0]], dx[ix[1]], dx[ix[2]]];
    return { osa: T.osa, poly: T.poly.map((q) => [q[0] + o[0], q[1] + o[1]]), diry: (T.diry || []).map((D) => D.map((q) => [q[0] + o[0], q[1] + o[1]])), w0: T.w0 + o[2], w1: T.w1 + o[2] };
  }

  /* ---------------- hřeben (ozuby, prsty, čepy) ---------------- */
  /** obrys desky s výstupky na straně x = zaklad; zuby: [{h0,h1,l1,l0}] = z horní hrany u základny, u konce, dolní u konce, u základny
   *  deska jde od zaklad k xDal, z ∈ [0, W]; vrací body (x, z) */
  function hreben(zaklad, konec, zuby, W, xDal) {
    const P = [[xDal, 0], [xDal, W], [zaklad, W]];
    const Z = zuby.slice().sort((a, b) => b.h0 - a.h0);
    let cur = W;
    for (const t of Z) {
      if (t.h0 < cur - 1e-9) P.push([zaklad, t.h0]);
      P.push([konec, t.h1], [konec, t.l1], [zaklad, t.l0]);
      cur = t.l0;
    }
    if (cur > 1e-9) P.push([zaklad, 0]);
    return vycistiPoly(P);
  }

  function cislo(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
  /** doplní a omezí parametry */
  function normalizuj(vstup) {
    const p = Object.assign({}, VYCHOZI, vstup || {});
    for (const k of Object.keys(VYCHOZI)) if (typeof VYCHOZI[k] === 'number') p[k] = cislo(p[k], VYCHOZI[k]);
    if (!SPOJE[p.spoj]) p.spoj = 'rybina';
    if (!MATERIALY[p.material]) p.material = 'buk';
    if (!PILY[p.pila]) p.pila = 'cepovka';
    p.tA = Math.min(200, Math.max(3, p.tA)); p.tB = Math.min(200, Math.max(3, p.tB));
    p.sirka = Math.min(2000, Math.max(10, p.sirka)); p.sirkaB = Math.min(2000, Math.max(10, p.sirkaB));
    p.delkaA = Math.min(3000, Math.max(20, p.delkaA)); p.delkaB = Math.min(3000, Math.max(20, p.delkaB));
    p.vule = Math.min(2, Math.max(0, p.vule)); p.presah = Math.min(5, Math.max(0, p.presah));
    p.kerf = Math.min(10, Math.max(0.05, p.pila === 'vlastni' ? p.kerf : PILY[p.pila].kerf));
    p.dlato = Math.min(60, Math.max(2, p.dlato));
    p.sklon = Math.min(20, Math.max(3, p.sklon));
    if (p.sklonAuto) p.sklon = MATERIALY[p.material].sklon;
    p.pocet = Math.min(40, Math.max(1, Math.round(p.pocet)));
    p.prstu = Math.min(81, Math.max(2, Math.round(p.prstu)));
    p.cepUzky = Math.max(0.5, p.cepUzky); p.pulcep = Math.max(0.5, p.pulcep);
    p.kryti = Math.max(0.5, p.kryti);
    p.pocetSpoju = Math.min(100, Math.max(1, Math.round(p.pocetSpoju)));
    p.kolPrumer = Math.min(30, Math.max(3, p.kolPrumer)); p.kolDelka = Math.min(200, Math.max(10, p.kolDelka));
    p.kolRoztec = Math.min(1000, Math.max(10, p.kolRoztec)); p.kolOkraj = Math.min(500, Math.max(3, p.kolOkraj));
    p.lamRoztec = Math.min(1000, Math.max(40, p.lamRoztec)); p.lamOkraj = Math.min(500, Math.max(10, p.lamOkraj));
    if (!LAMELY[p.lamVel]) p.lamVel = '20';
    p.rozevreni = Math.min(40, Math.max(4, p.rozevreni));
    return p;
  }

  const fmt = (x, d) => { const k = Math.pow(10, d == null ? 1 : d); return String(Math.round(x * k) / k).replace('.', ','); };

  /* ================================================================
     ROZVRŽENÍ RYBIN
     ================================================================ */
  /** rozvrh ozubů na šířce W: krajní půlčepy hp, vnitřní čepy pc (úzká strana), n ozubů */
  function rozvrhRybin(p) {
    const W = p.sirka, n = p.pocet, N = p.sklon, l = p.spoj === 'polokryta' ? Math.min(p.kryti, p.tB - 1) : 0;
    const D = p.tB - l, s = D / N, hp = p.pulcep, pc = p.cepUzky;
    const T = (W - 2 * hp - (n - 1) * pc) / n;
    const ozuby = [];
    let z = hp;
    for (let i = 0; i < n; i++) { ozuby.push({ a: z, b: z + T }); z += T + pc; }
    return { W, n, N, l, D, s, hp, pc, T, Tuzky: T - 2 * s, cepSiroky: pc + 2 * s, pulcepSiroky: hp + s, ozuby, uhel: Math.atan(1 / N) * 180 / Math.PI };
  }
  /** návrh rozvržení podle tloušťky a šířky (klasický poměr: ozub ~ 2–3× čep) */
  function navrhRybin(p) {
    p = normalizuj(p);
    const t = p.tA, W = p.sirka;
    const pc = Math.max(3, Math.round(t * 0.35)), hp = Math.max(3, Math.round(t * 0.4));
    let n = Math.max(1, Math.round((W - 2 * hp) / (2.6 * t + pc)));
    return { pocet: n, cepUzky: pc, pulcep: hp };
  }

  /* ================================================================
     GENERÁTORY SPOJŮ
     každý vrací {dily, obal, dutiny, objemDutin, rozlozeni, sablony, koty, zona, info, varovani}
     ================================================================ */
  function rybina(p, V) {
    const R = rozvrhRybin(p), { W, l, D, s, N } = R, tA = p.tA, tB = p.tB, v = p.vule, pr = p.presah;
    const polo = p.spoj === 'polokryta';
    const zx = (z0, x) => z0 - (x - l) / N;            // horní stěna ozubu (u l je z0) – ozub se k základně zužuje
    const zxd = (z0, x) => z0 + (x - l) / N;           // dolní stěna
    const xKonA = polo ? l + v : -pr;                  // konec ozubů (u polokryté kratší o vůli)
    const xDalA = xKonA + p.delkaA;
    // díl A – ozuby (hřeben v rovině x-z, vytažený po y)
    const zuby = R.ozuby.map((o) => ({ h0: zx(o.b, tB) - v / 2, h1: zx(o.b, xKonA) - v / 2, l1: zxd(o.a, xKonA) + v / 2, l0: zxd(o.a, tB) + v / 2 }));
    const A = { id: 'A', nazev: polo ? 'Bok zásuvky (ozuby)' : 'Deska s ozuby', vlakno: 'x', telesa: [hranol('y', hreben(tB, xKonA, zuby, W, xDalA), 0, tA)] };
    // díl B – čepy
    const yKonB = -pr, yDalB = yKonB + p.delkaB;
    const B = { id: 'B', nazev: polo ? 'Čelo zásuvky (čepy, krytí)' : 'Deska s čepy', vlakno: 'y', telesa: [] };
    const hrany = [0].concat(R.ozuby.flatMap((o) => [o.a, o.b])).concat([W]);   // na úrovni x = l
    if (!polo) {
      for (let j = 0; j <= R.n; j++) {
        // čep j leží mezi horní stěnou ozubu j−1 a dolní stěnou ozubu j
        const zl = (x) => (j === 0 ? 0 : zx(hrany[2 * j], x) + v / 2), zh = (x) => (j === R.n ? W : zxd(hrany[2 * j + 1], x) - v / 2);
        const body = [[0, zl(0)], [tB, zl(tB)], [tB, zh(tB)], [0, zh(0)]];
        B.telesa.push(hranol('y', body, yKonB, tA));
      }
    } else {
      // krytí x ∈ [0, l] celé, dutiny po ozubech otevřené k vnitřní ploše x = tB
      const P = [[0, 0], [0, W], [tB, W]];
      for (let i = R.n - 1; i >= 0; i--) {
        const o = R.ozuby[i];
        P.push([tB, zx(o.b, tB) + v / 2], [l, zx(o.b, l) + v / 2], [l, zxd(o.a, l) - v / 2], [tB, zxd(o.a, tB) - v / 2]);
      }
      P.push([tB, 0]);
      B.telesa.push(hranol('y', P, yKonB, tA));
    }
    B.telesa.push(kvadr(0, tB, tA, yDalB, 0, W));
    const obal = [kvadr(0, tB, 0, Math.max(tA, yDalB), 0, W), kvadr(tB, Math.max(tB, xDalA), 0, tA, 0, W)];
    // kontrola šířky: v libovolném x ∈ (l, tB) součet ozubů + čepů = W − 2n·v
    const sirkaV = (x) => {
      const oz = R.ozuby.reduce((a, o) => a + (zx(o.b, x) - zxd(o.a, x) - v), 0);
      let ce = 0; for (let j = 0; j <= R.n; j++) ce += (j === R.n ? W : zxd(hrany[2 * j + 1], x) - v / 2) - (j === 0 ? 0 : zx(hrany[2 * j], x) + v / 2);
      return { ozuby: oz, cepy: ce };
    };
    // varování
    if (R.T <= 0) V.push(['chyba', `Ozuby se nevejdou: ${R.n} ozubů, čepy ${fmt(R.pc)} mm a půlčepy ${fmt(R.hp)} mm jsou dohromady širší než prkno ${fmt(W)} mm.`]);
    else if (R.Tuzky <= 0) V.push(['chyba', `Ozub se u základny zúží na ${fmt(R.Tuzky)} mm – při sklonu 1:${N} a tloušťce ${fmt(tB)} mm musí být ozuby širší nebo jich musí být méně.`]);
    else if (R.Tuzky < 4) V.push(['varovani', `Ozub je u základny jen ${fmt(R.Tuzky)} mm široký – snadno se ulomí.`]);
    if (R.pc < 3) V.push(['varovani', `Velmi úzké čepy (${fmt(R.pc)} mm, „londýnské“): řežte jen tenkou pilou a dutiny vybírejte úzkým dlátem; v měkkém dřevě se mohou ulomit.`]);
    if (R.pc < p.kerf * 1.5) V.push(['chyba', `Čep (${fmt(R.pc)} mm) je užší než 1,5× řez pily (${fmt(p.kerf, 2)} mm) – nedá se vyříznout.`]);
    if (R.hp < 3) V.push(['varovani', `Krajní půlčep ${fmt(R.hp)} mm je slabý – u hrany se odštípne. Doporučeno aspoň 4–6 mm.`]);
    if (N < 5) V.push(['varovani', `Sklon 1:${fmt(N)} je strmý – na hranách ozubů vznikne krátké vlákno a rohy se odštípnou.`]);
    if (N > 9) V.push(['varovani', `Sklon 1:${fmt(N)} je mírný – zámek drží méně; obvykle 1:6 (měkké) až 1:8 (tvrdé dřevo).`]);
    const mat = MATERIALY[p.material];
    if (mat.tvrde && N < 7 && !mat.deska) V.push(['info', `Pro tvrdé dřevo (${mat.nazev}) se doporučuje sklon 1:8 – strmý sklon v tvrdém dřevě zbytečně zeslabuje rohy ozubů.`]);
    if (!mat.tvrde && N > 7) V.push(['info', `Pro měkké dřevo (${mat.nazev}) se doporučuje sklon 1:6 – měkká vlákna se pod zatížením víc stlačí.`]);
    if (mat.mdf) V.push(['chyba', 'Do MDF rybiny nedělejte – ozuby se drolí a nemají vlákno. Použijte kolíky, lamely nebo pero.']);
    else if (mat.deska) V.push(['varovani', 'Rybiny v překližce: na ozubech se vrstvy štípou; jde to jen u kvalitní březové překližky a ostrého nástroje.']);
    if (R.T > 4 * tA) V.push(['info', `Ozuby jsou široké (${fmt(R.T)} mm) – při sesychání se mohou uvolnit, zvažte víc ozubů.`]);
    const dutA = R.cepSiroky - v, dutB = polo ? R.Tuzky : R.Tuzky;
    if (p.dlato > dutA + 0.01) V.push(['varovani', `Dláto ${fmt(p.dlato)} mm se nevejde do dutiny mezi ozuby (u základny ${fmt(dutA)} mm). Použijte užší dláto.`]);
    if (R.Tuzky > 0 && p.dlato > dutB + 0.01) V.push(['varovani', `Dláto ${fmt(p.dlato)} mm je širší než nejužší místo dutiny pro ozub v desce B (${fmt(dutB)} mm).`]);
    if (polo) {
      if (l < 3) V.push(['varovani', `Krytí ${fmt(l)} mm je tenké – čelo může prasknout. Obvykle 1/4 až 1/3 tloušťky čela.`]);
      if (D < tB * 0.5) V.push(['info', `Ozuby zasahují jen ${fmt(D)} mm (méně než polovina tloušťky čela) – spoj bude slabší.`]);
      if (p.kryti >= tB - 1) V.push(['chyba', 'Krytí je stejně tlusté jako čelo – na ozuby nezbývá místo.']);
    }
    if (p.vule > 0.3) V.push(['varovani', `Vůle ${fmt(p.vule, 2)} mm na každé stěně je velká – lepený spoj bude slabý (obvykle 0–0,15 mm).`]);
    if (PILY[p.pila].cnc) V.push(['info', 'CNC: vnitřní rohy budou mít poloměr frézy. Rybiny frézujte rybinovou frézou, nebo šablonu použijte jen na orýsování.']);
    const info = {
      'Sklon': `1:${fmt(N)} (${fmt(R.uhel, 1)}°)`, 'Ozubů': R.n, 'Ozub široký / u základny': `${fmt(R.T)} / ${fmt(R.Tuzky)} mm`,
      'Čep úzký / široký': `${fmt(R.pc)} / ${fmt(R.cepSiroky)} mm`, 'Krajní půlčep': `${fmt(R.hp)} / ${fmt(R.pulcepSiroky)} mm`,
      'Délka ozubů': `${fmt(D)} mm` + (polo ? ` (krytí ${fmt(l)} mm)` : ''), 'Základní čára na A': `${fmt(tB + (polo ? -l - v : pr))} mm od konce`,
      'Základní čára na B': `${fmt(tA + pr)} mm od konce`,
    };
    const dily = [A, B];
    A.rozmer = { L: p.delkaA, W, t: tA }; B.rozmer = { L: p.delkaB, W, t: tB };
    A.polotovar = kvadr(xKonA, xDalA, 0, tA, 0, W); B.polotovar = kvadr(0, tB, yKonB, yDalB, 0, W);
    const okolo = 18;
    const sablony = [
      { dil: 'A', typ: 'konec', nazev: 'A – ozuby', konecOsa: 'x', konecZnam: -1, konec: xKonA, delka: tB - xKonA + okolo, tlOsa: 'y', t0: 0, t1: tA, sOsa: 'z', s0: 0, s1: W, nazevPloch: ['vnější plocha', 'čelo', 'vnitřní plocha'] },
      { dil: 'B', typ: 'konec', nazev: polo ? 'B – čepy (z boku čela)' : 'B – čepy', konecOsa: 'y', konecZnam: -1, konec: yKonB, delka: tA - yKonB + okolo, tlOsa: 'x', t0: 0, t1: tB, sOsa: 'z', s0: 0, s1: W, nazevPloch: [polo ? 'líc čela (bez řezů)' : 'vnější plocha', 'čelo (konec)', 'vnitřní plocha'] },
    ];
    const koty = [
      { a: [0, -1, 0], b: [tB, -1, 0], pohled: 'y', odsaz: -10 },
      { a: [xKonA, 0, W], b: [tB, 0, W], pohled: 'y', odsaz: 10, popis: polo ? 'délka ozubu' : null },
      { a: [tB + 5, 0, R.ozuby[0].a], b: [tB + 5, 0, R.ozuby[0].b], pohled: 'y', odsaz: 0, popis: null, vodorovne: false, uKonce: 'l' },
      { a: [tB, 0, 0], b: [tB, 0, W], pohled: 'y', odsaz: 22 },
      { a: [0, 0, 0], b: [0, tA, 0], pohled: 'z', odsaz: -10 },
      { a: [0, yKonB, 0], b: [tB, yKonB, 0], pohled: 'z', odsaz: -10 },
      { a: [0, 0, W], b: [0, tA, W], pohled: 'x', odsaz: 10 },
    ];
    return {
      dily, obal, dutiny: [], zona: [Math.min(-pr, xKonA) - 2, tB + 20, yKonB - 2, tA + 20, -2, W + 2],
      rozlozeni: [{ dil: 'A', smer: [0, -1, 0], vzdal: tA + pr + 25, krok: 0 }],
      sablony, koty, info, rozvrh: R, sirkaV,
      kontrolaSklonu: { ozuby: R.ozuby, N, l },
    };
  }

  function cinky(p, V) {
    const W = p.sirka, n = p.prstu, f = W / n, tA = p.tA, tB = p.tB, v = p.vule, pr = p.presah;
    const intervaly = [];
    for (let i = 0; i < n; i++) intervaly.push([i * f + (i > 0 ? v / 2 : 0), (i + 1) * f - (i < n - 1 ? v / 2 : 0), i % 2 === 0 ? 'A' : 'B']);
    const xKonA = -pr, xDalA = xKonA + p.delkaA, yKonB = -pr, yDalB = yKonB + p.delkaB;
    const zubyA = intervaly.filter((q) => q[2] === 'A').map((q) => ({ h0: q[1], h1: q[1], l1: q[0], l0: q[0] }));
    const A = { id: 'A', nazev: 'Deska A (krajní prsty)', vlakno: 'x', telesa: [hranol('y', hreben(tB, xKonA, zubyA, W, xDalA), 0, tA)] };
    const B = { id: 'B', nazev: 'Deska B', vlakno: 'y', telesa: [] };
    for (const q of intervaly.filter((q) => q[2] === 'B')) B.telesa.push(hranol('y', [[0, q[0]], [tB, q[0]], [tB, q[1]], [0, q[1]]], yKonB, tA));
    B.telesa.push(kvadr(0, tB, tA, yDalB, 0, W));
    A.rozmer = { L: p.delkaA, W, t: tA }; B.rozmer = { L: p.delkaB, W, t: tB };
    A.polotovar = kvadr(xKonA, xDalA, 0, tA, 0, W); B.polotovar = kvadr(0, tB, yKonB, yDalB, 0, W);
    const obal = [kvadr(0, tB, 0, Math.max(tA, yDalB), 0, W), kvadr(tB, xDalA, 0, tA, 0, W)];
    if (f < 3) V.push(['chyba', `Prsty široké ${fmt(f)} mm se nedají vyrobit.`]);
    else if (f < Math.min(tA, tB) * 0.5) V.push(['varovani', `Prsty (${fmt(f)} mm) jsou užší než polovina tloušťky – zbytečně mnoho řezů a slabé prsty.`]);
    if (f > 3 * Math.max(tA, tB)) V.push(['info', `Široké prsty (${fmt(f)} mm) mají málo lepené plochy – zvažte víc prstů.`]);
    if (n % 2 === 0) V.push(['info', `Sudý počet prstů: na jedné hraně začíná deska A, na druhé deska B (nesouměrné). Obvykle se volí lichý počet.`]);
    if (PILY[p.pila].cnc) V.push(['varovani', `CNC fréza Ø ${fmt(p.kerf)} mm nechá ve vnitřních rozích zaoblení r = ${fmt(p.kerf / 2)} mm – přidejte „dogbone“ výřezy nebo rohy dočistěte dlátem.`]);
    if (p.kerf > f * 0.6 && !PILY[p.pila].cnc) V.push(['varovani', `Řez pily ${fmt(p.kerf)} mm je skoro tak široký jako prst – zvolte užší pilu nebo širší prsty.`]);
    if (p.kerf > 0.5 && !PILY[p.pila].cnc) {
      const k = f / p.kerf;
      V.push(['info', `Na kotoučové pile s přípravkem: prst ${fmt(f, 2)} mm = ${fmt(k, 2)}× šířka kotouče ${fmt(p.kerf, 2)} mm` + (Math.abs(k - Math.round(k)) < 0.02 ? ' (vychází na celé průchody).' : ' – nastavte drážkovací kotouč na šířku prstu.')]);
    }
    if (MATERIALY[p.material].mdf) V.push(['varovani', 'Cinky v MDF drží jen lepidlem – hrany prstů se drolí.']);
    if (p.vule > 0.3) V.push(['varovani', `Vůle ${fmt(p.vule, 2)} mm je velká – prsty budou viklat.`]);
    const info = { 'Prstů celkem': n, 'Šířka prstu': `${fmt(f, 2)} mm`, 'Prsty A / B': `${Math.ceil(n / 2)} / ${Math.floor(n / 2)}`, 'Délka prstů A': `${fmt(tB + pr)} mm`, 'Délka prstů B': `${fmt(tA + pr)} mm`, 'Lepená plocha': `${fmt((n - 1) * (tA * tB) / 100 + n * f * (tA + tB) / 100 * 0, 0)} cm² bočnic prstů` };
    info['Lepená plocha'] = `${fmt(((n - 1) * tA * tB + 0) / 100, 1)} cm² (boky prstů, podél vláken)`;
    const okolo = 18;
    return {
      dily: [A, B], obal, dutiny: [], zona: [-pr - 2, tB + 20, -pr - 2, tA + 20, -2, W + 2],
      rozlozeni: [{ dil: 'A', smer: [0, -1, 0], vzdal: tA + pr + 25, krok: 0 }],
      sablony: [
        { dil: 'A', typ: 'konec', nazev: 'A – prsty', konecOsa: 'x', konecZnam: -1, konec: xKonA, delka: tB + pr + okolo, tlOsa: 'y', t0: 0, t1: tA, sOsa: 'z', s0: 0, s1: W, nazevPloch: ['vnější plocha', 'čelo', 'vnitřní plocha'] },
        { dil: 'B', typ: 'konec', nazev: 'B – prsty', konecOsa: 'y', konecZnam: -1, konec: yKonB, delka: tA + pr + okolo, tlOsa: 'x', t0: 0, t1: tB, sOsa: 'z', s0: 0, s1: W, nazevPloch: ['vnější plocha', 'čelo', 'vnitřní plocha'] },
      ],
      koty: [
        { a: [0, -1, 0], b: [tB, -1, 0], pohled: 'y', odsaz: -10 },
        { a: [tB, 0, 0], b: [tB, 0, f], pohled: 'y', odsaz: 12 },
        { a: [tB, 0, 0], b: [tB, 0, W], pohled: 'y', odsaz: 24 },
        { a: [0, 0, 0], b: [0, tA, 0], pohled: 'z', odsaz: -10 },
        { a: [0, 0, W], b: [0, tA, W], pohled: 'x', odsaz: 10 },
      ],
      info, intervaly,
    };
  }

  function cepDlab(p, V) {
    const wB = p.sirkaB, tB = p.tB, W = p.sirka, tA = Math.min(p.tA, tB), v = p.vule, pr = p.presah, var_ = p.cepVarianta;
    if (p.tA > tB) V.push(['varovani', `Lub (${fmt(p.tA)} mm) je tlustší než noha/vlys (${fmt(tB)} mm) – počítám s tloušťkou ${fmt(tB)} mm.`]);
    // tloušťka čepu: 1/3 tloušťky, raději na šířku dláta, pokud je blízko
    let tc = p.cepTl > 0 ? p.cepTl : tA / 3;
    if (!(p.cepTl > 0) && Math.abs(p.dlato - tA / 3) <= tA / 3 * 0.3) tc = p.dlato;
    if (!(p.cepTl > 0) && tc !== p.dlato) tc = Math.round(tc);
    const zr0 = p.licovat ? 0 : (tB - tA) / 2, zr1 = zr0 + tA;
    const c0 = zr0 + (tA - tc) / 2, c1 = c0 + tc;
    const so = Math.max(0, Math.min(p.osazeni, W / 2 - 3)), m0 = so, m1 = W - so;
    const presB = Math.max(40, (p.delkaB - W) / 2), ys0 = -presB, ys1 = W + presB;
    const h = var_ === 'slepy' ? (p.hloubkaDlabu > 0 ? Math.min(p.hloubkaDlabu, wB - 3) : Math.round(wB * 2 / 3)) : wB;
    const dno = var_ === 'slepy' ? Math.max(0, Math.min(p.dnoDlabu, h - 5)) : 0;
    const lc = var_ === 'slepy' ? h - dno : wB + pr;       // délka čepu
    const xDal = wB + p.delkaA, xt = wB - lc;
    const A = { id: 'A', nazev: 'Lub / příčka (čep)', vlakno: 'x', telesa: [] };
    const B = { id: 'B', nazev: 'Noha / vlys (dlab)', vlakno: 'y', telesa: [] };
    const dily = [A, B];
    const rail = [[wB, 0], [xDal, 0], [xDal, W], [wB, W]];
    A.telesa.push(hranol('z', rail, zr0, c0 + v));
    A.telesa.push(hranol('z', rail, c1 - v, zr1));
    B.telesa.push(kvadr(0, wB, ys0, ys1, 0, c0));
    B.telesa.push(kvadr(0, wB, ys0, ys1, c1, tB));
    let wedges = null, k = 0, f = 0, e = 0, yKlin = 0;
    if (var_ === 'slepy') {
      A.telesa.push(hranol('z', [[xt, m0 + v], [wB, m0 + v], [wB, 0], [xDal, 0], [xDal, W], [wB, W], [wB, m1 - v], [xt, m1 - v]], c0 + v, c1 - v));
      B.telesa.push(hranol('z', [[0, ys0], [wB, ys0], [wB, m0], [wB - h, m0], [wB - h, m1], [wB, m1], [wB, ys1], [0, ys1]], c0, c1));
    } else if (var_ === 'pruchozi') {
      A.telesa.push(hranol('z', [[xt, m0 + v], [wB, m0 + v], [wB, 0], [xDal, 0], [xDal, W], [wB, W], [wB, m1 - v], [xt, m1 - v]], c0 + v, c1 - v));
      B.telesa.push(kvadr(0, wB, ys0, m0, c0, c1)); B.telesa.push(kvadr(0, wB, m1, ys1, c0, c1));
    } else {
      // s klínky: dlab se k vnější ploše (x = 0) rozevírá v délce k, čep má 2 zářezy, klínky je roztáhnou
      k = Math.round(wB * 0.7); f = Math.max(0.5, k / p.rozevreni); e = f + p.kerf;
      const sirC = m1 - m0, y1 = m0 + sirC / 4, y2 = m1 - sirC / 4; yKlin = y1;
      const yTop = (x) => (x < k ? m1 + f * (k - x) / k : m1), yBot = (x) => (x < k ? m0 - f * (k - x) / k : m0);
      const half = (x) => e / 2 * (k - x) / k;
      const xe = -pr;
      const P = [[wB, m0 + v], [wB, 0], [xDal, 0], [xDal, W], [wB, W], [wB, m1 - v], [k, m1 - v], [xe, yTop(xe) - v],
        [xe, y2 + half(xe)], [k, y2], [xe, y2 - half(xe)], [xe, y1 + half(xe)], [k, y1], [xe, y1 - half(xe)],
        [xe, yBot(xe) + v], [k, m0 + v]];
      A.telesa.push(hranol('z', P, c0 + v, c1 - v));
      B.telesa.push(hranol('z', [[0, ys0], [wB, ys0], [wB, m0], [k, m0], [0, m0 - f]], c0, c1));
      B.telesa.push(hranol('z', [[0, m1 + f], [k, m1], [wB, m1], [wB, ys1], [0, ys1]], c0, c1));
      wedges = { id: 'C', nazev: 'Klínky (2 ks)', vlakno: 'x', telesa: [y1, y2].map((yc) => hranol('z', [[xe, yc - half(xe)], [k, yc], [xe, yc + half(xe)]], c0 + v, c1 - v)), pocet: 1 };
      dily.push(wedges);
      if (f < 1) V.push(['info', `Rozevření dlabu je jen ${fmt(f, 2)} mm na stranu – klínky čep skoro neroztáhnou.`]);
      if (e > sirC / 4) V.push(['varovani', `Klínek (${fmt(e, 1)} mm) je široký vzhledem k čepu – čep by se mohl roztrhnout.`]);
    }
    A.rozmer = { L: p.delkaA + lc, W, t: tA }; B.rozmer = { L: ys1 - ys0, W: wB, t: tB };
    A.polotovar = kvadr(xt, xDal, 0, W, zr0, zr1); B.polotovar = kvadr(0, wB, ys0, ys1, 0, tB);
    if (wedges) { wedges.rozmer = { L: k + pr, W: e * (k + pr) / k, t: c1 - c0 - 2 * v }; wedges.polotovar = null; }
    const obal = [kvadr(0, wB, ys0, ys1, 0, tB), kvadr(wB, xDal, 0, W, zr0, zr1)];
    const dutiny = var_ === 'slepy' && dno > 0 ? [kvadr(wB - h, wB - h + dno, m0, m1, c0, c1)] : [];
    // varování
    if (tc < tA / 4) V.push(['varovani', `Čep ${fmt(tc)} mm je tenký (méně než 1/4 tloušťky ${fmt(tA)} mm).`]);
    if (tc > tA / 2) V.push(['varovani', `Čep ${fmt(tc)} mm je tlustší než polovina lubu – zeslabí se stěny dlabu (${fmt(c0)} a ${fmt(tB - c1)} mm).`]);
    if (Math.min(c0, tB - c1) < 5) V.push(['chyba', `Stěna dlabu je jen ${fmt(Math.min(c0, tB - c1))} mm – praskne při dlabání.`]);
    if (Math.abs(tc - p.dlato) > 0.01) V.push(['info', `Šířku dlabu ${fmt(tc)} mm nevybírejte dlátem ${fmt(p.dlato)} mm – dlab má mít šířku dláta (nastavte tloušťku čepu = ${fmt(p.dlato)} mm).`]);
    if (so < 5 && W > 40) V.push(['varovani', `Boční osazení ${fmt(so)} mm je malé – dlab se u konce může vylomit a spára nebude krytá.`]);
    if (m1 - m0 > 6 * tc) V.push(['info', `Čep je široký (${fmt(m1 - m0)} mm, víc než 6× tloušťka) – při sesychání se dlab uvolní; u širokých lubů dejte dva čepy nebo čep s ozubem.`]);
    if (var_ === 'slepy' && h < wB * 0.5) V.push(['info', `Dlab hluboký ${fmt(h)} mm (méně než polovina šířky nohy) – kratší čep drží méně.`]);
    if (var_ === 'slepy' && h > wB - 6) V.push(['varovani', `Slepý dlab ${fmt(h)} mm je skoro průchozí – nechte aspoň 6 mm materiálu.`]);
    if (MATERIALY[p.material].deska) V.push(['varovani', 'Čep a dlab z desky (překližka, MDF) – čep nemá souvislé vlákno; vhodnější jsou kolíky nebo lamely.']);
    if (p.vule > 0.25) V.push(['varovani', `Vůle ${fmt(p.vule, 2)} mm na každé líci čepu je velká – čep má jít do dlabu ztuha rukou.`]);
    const info = {
      'Tloušťka čepu': `${fmt(tc)} mm (1/${fmt(tA / tc, 1)} tloušťky)`, 'Šířka čepu': `${fmt(m1 - m0 - 2 * v)} mm`, 'Délka čepu': `${fmt(lc)} mm`,
      'Osazení líce': `${fmt(c0 - zr0)} / ${fmt(zr1 - c1)} mm`, 'Boční osazení': `${fmt(so)} mm`, 'Dlab': `${fmt(tc)} × ${fmt(m1 - m0)} × ${var_ === 'slepy' ? fmt(h) : 'skrz'} mm`,
      'Stěny dlabu': `${fmt(c0)} / ${fmt(tB - c1)} mm`,
    };
    if (wedges) Object.assign(info, { 'Zářezy pro klínky': `${fmt(k)} mm hluboké, pila ${fmt(p.kerf, 2)} mm`, 'Rozevření dlabu': `${fmt(f, 1)} mm na stranu (1:${fmt(p.rozevreni)})`, 'Klínek': `${fmt(e, 1)} mm na konci, délka ${fmt(k + pr)} mm` });
    const sablony = [
      { dil: 'A', typ: 'konec', nazev: 'A – čep', konecOsa: 'x', konecZnam: -1, konec: xt, delka: wB - xt + 20, tlOsa: 'z', t0: zr0, t1: zr1, sOsa: 'y', s0: 0, s1: W, hrany: true, nazevPloch: ['líc', 'čelo čepu', 'rub'] },
      { dil: 'B', typ: 'stred', nazev: 'B – dlab', normOsa: 'x', normZnam: +1, plocha: wB, hloubka: wB, dOsa: 'y', d0: m0 - 25, d1: m1 + 25, tlOsa: 'z', t0: 0, t1: tB, druha: var_ !== 'slepy', nazevPloch: ['líc', 'hrana (vstup dlabu)', 'rub', 'protější hrana (výstup)'] },
    ];
    if (wedges) sablony.push({ dil: 'C', typ: 'plocha', nazev: 'C – klínek', normOsa: 'z', normZnam: +1, plocha: c1 - v, u: 'x', v: 'y', okno: [-pr - 3, k + 3, yKlin - e - 3, yKlin + e + 3] });
    const koty = [
      { a: [wB, -2, tB], b: [xt, -2, tB], pohled: 'y', odsaz: 10 },
      { a: [0, -2, 0], b: [wB, -2, 0], pohled: 'y', odsaz: -10 },
      { a: [wB + 3, 0, c0], b: [wB + 3, 0, c1], pohled: 'y', odsaz: 0, uKonce: 'p' },
      { a: [wB + 30, 0, zr0], b: [wB + 30, 0, zr1], pohled: 'y', odsaz: 0, uKonce: 'p' },
      { a: [wB, m0, tB], b: [wB, m1, tB], pohled: 'z', odsaz: 0, uKonce: 'p' },
      { a: [wB + 30, 0, tB], b: [wB + 30, W, tB], pohled: 'z', odsaz: 0, uKonce: 'p' },
    ];
    return {
      dily, obal, dutiny, zona: [-pr - 2, wB + 40, m0 - 30, m1 + 30, -2, tB + 2],
      rozlozeni: (wedges ? [{ dil: 'C', smer: [-1, 0, 0], vzdal: k + pr + 30, krok: 0 }] : []).concat([{ dil: 'A', smer: [1, 0, 0], vzdal: lc + 30, krok: wedges ? 1 : 0 }]),
      sablony, koty, info, cep: { tc, c0, c1, m0, m1, h, lc, dno },
    };
  }

  function preplatovani(p, V) {
    const t = p.tA, W = p.sirka, WB = p.sirkaB, v = p.vule, pr = p.presah, var_ = p.plVarianta;
    const h = p.plHloubka > 0 ? Math.min(p.plHloubka, t - 1) : t / 2;
    if (Math.abs(p.tB - p.tA) > 0.01) V.push(['info', `Přeplátování počítá se stejnou tloušťkou obou dílů (${fmt(t)} mm).`]);
    const A = { id: 'A', nazev: 'Díl A', vlakno: 'x', telesa: [] }, B = { id: 'B', nazev: 'Díl B', vlakno: 'y', telesa: [] };
    let obal, sablony, koty, zona, LAc = p.delkaA, LBc = p.delkaB;
    if (var_ === 'roh') {
      A.telesa.push(hranol('y', [[-pr, 0], [LAc - pr, 0], [LAc - pr, t], [WB + v, t], [WB + v, h], [-pr, h]], 0, W));
      B.telesa.push(hranol('x', [[-pr, h], [W + v, h], [W + v, 0], [LBc - pr, 0], [LBc - pr, t], [-pr, t]], 0, WB));
      A.polotovar = kvadr(-pr, LAc - pr, 0, W, 0, t); B.polotovar = kvadr(0, WB, -pr, LBc - pr, 0, t);
      obal = [kvadr(0, LAc - pr, 0, W, 0, t), kvadr(0, WB, W, LBc - pr, 0, t)];
      A.nazev = 'Díl A (plátek dole)'; B.nazev = 'Díl B (plátek nahoře)';
      sablony = [
        { dil: 'A', typ: 'konec', nazev: 'A – plátek', konecOsa: 'x', konecZnam: -1, konec: -pr, delka: WB + pr + 20, tlOsa: 'z', t0: 0, t1: t, sOsa: 'y', s0: 0, s1: W, hrany: true, nazevPloch: ['spodní plocha', 'čelo', 'horní plocha'] },
        { dil: 'B', typ: 'konec', nazev: 'B – plátek', konecOsa: 'y', konecZnam: -1, konec: -pr, delka: W + pr + 20, tlOsa: 'z', t0: 0, t1: t, sOsa: 'x', s0: 0, s1: WB, hrany: true, nazevPloch: ['spodní plocha', 'čelo', 'horní plocha'] },
      ];
      zona = [-pr - 2, WB + 30, -pr - 2, W + 30, -2, t + 2];
      koty = [{ a: [0, W + 2, t], b: [WB, W + 2, t], pohled: 'z', odsaz: 0, uKonce: 'p' }, { a: [WB + 3, 0, t], b: [WB + 3, W, t], pohled: 'z', odsaz: 0, uKonce: 'p' }, { a: [-3, 0, 0], b: [-3, 0, h], pohled: 'y', odsaz: 0, uKonce: 'l' }, { a: [-3, 0, 0], b: [-3, 0, t], pohled: 'y', odsaz: -8, uKonce: 'l' }];
    } else {
      // kříž / T: A průběžně po x, B napříč
      const cx = (LAc - WB) / 2;
      const ya0 = var_ === 'kriz' ? Math.max(20, (LBc - W) / 2) : 0;
      const yb0 = var_ === 'kriz' ? 0 : -pr, yb1 = var_ === 'kriz' ? LBc : LBc - pr;
      A.telesa.push(hranol('y', [[0, 0], [LAc, 0], [LAc, t], [cx + WB + v / 2, t], [cx + WB + v / 2, h], [cx - v / 2, h], [cx - v / 2, t], [0, t]], ya0, ya0 + W));
      if (var_ === 'kriz') {
        B.telesa.push(hranol('x', [[yb0, 0], [ya0 - v / 2, 0], [ya0 - v / 2, h], [ya0 + W + v / 2, h], [ya0 + W + v / 2, 0], [yb1, 0], [yb1, t], [yb0, t]], cx, cx + WB));
        obal = [kvadr(0, LAc, ya0, ya0 + W, 0, t), kvadr(cx, cx + WB, yb0, ya0, 0, t), kvadr(cx, cx + WB, ya0 + W, yb1, 0, t)];
      } else {
        B.telesa.push(hranol('x', [[yb0, h], [ya0 + W + v, h], [ya0 + W + v, 0], [yb1, 0], [yb1, t], [yb0, t]], cx, cx + WB));
        obal = [kvadr(0, LAc, ya0, ya0 + W, 0, t), kvadr(cx, cx + WB, ya0 + W, yb1, 0, t)];
      }
      A.polotovar = kvadr(0, LAc, ya0, ya0 + W, 0, t); B.polotovar = kvadr(cx, cx + WB, yb0, yb1, 0, t);
      A.nazev = 'Díl A (průběžný)'; B.nazev = var_ === 'kriz' ? 'Díl B (křížem)' : 'Díl B (konec na A)';
      sablony = [
        { dil: 'A', typ: 'stred', nazev: 'A – zářez', normOsa: 'z', normZnam: +1, plocha: t, hloubka: t, dOsa: 'x', d0: cx - 20, d1: cx + WB + 20, tlOsa: 'y', t0: ya0, t1: ya0 + W, nazevPloch: ['hrana', 'horní plocha', 'hrana'], druha: false },
        var_ === 'kriz'
          ? { dil: 'B', typ: 'stred', nazev: 'B – zářez', normOsa: 'z', normZnam: -1, plocha: 0, hloubka: t, dOsa: 'y', d0: ya0 - 20, d1: ya0 + W + 20, tlOsa: 'x', t0: cx, t1: cx + WB, nazevPloch: ['hrana', 'spodní plocha', 'hrana'], druha: false }
          : { dil: 'B', typ: 'konec', nazev: 'B – plátek', konecOsa: 'y', konecZnam: -1, konec: yb0, delka: W + pr + 20, tlOsa: 'z', t0: 0, t1: t, sOsa: 'x', s0: cx, s1: cx + WB, hrany: true, nazevPloch: ['spodní plocha', 'čelo', 'horní plocha'] },
      ];
      zona = [cx - 30, cx + WB + 30, yb0 - 2, ya0 + W + 30, -2, t + 2];
      koty = [{ a: [cx, ya0 - 3, t], b: [cx + WB, ya0 - 3, t], pohled: 'z', odsaz: 0, uKonce: 'p' }, { a: [cx - 3, 0, 0], b: [cx - 3, 0, h], pohled: 'y', odsaz: 0, uKonce: 'l' }, { a: [cx + WB + 25, ya0, t], b: [cx + WB + 25, ya0 + W, t], pohled: 'z', odsaz: 0, uKonce: 'p' }];
    }
    A.rozmer = { L: LAc, W, t }; B.rozmer = { L: LBc, W: WB, t };
    if (h < t * 0.4 || h > t * 0.6) V.push(['info', `Plátek ${fmt(h)} mm není v polovině tloušťky – jeden z dílů bude slabší.`]);
    if (t < 10) V.push(['varovani', `Tloušťka ${fmt(t)} mm je na přeplátování malá – plátky budou křehké.`]);
    if (Math.abs(W - WB) > 0.01 && var_ === 'roh') V.push(['info', 'Díly mají různou šířku – vnější rohy nebudou lícovat.']);
    if (MATERIALY[p.material].mdf) V.push(['varovani', 'Přeplátování v MDF drží jen lepidlem v ploše – bez vlákna.']);
    const info = { 'Varianta': { roh: 'rohové', kriz: 'křížové', T: 'tvaru T' }[var_] || var_, 'Hloubka plátku': `${fmt(h)} mm z ${fmt(t)} mm`, 'Šířka zářezu v A': `${fmt(WB + v)} mm`, 'Šířka zářezu v B': `${fmt(W + v)} mm`, 'Lepená plocha': `${fmt(W * WB / 100, 1)} cm²` };
    return { dily: [A, B], obal, dutiny: [], zona, rozlozeni: [{ dil: 'B', smer: [0, 0, 1], vzdal: t + 25, krok: 0 }], sablony, koty, info };
  }

  function peroDrazka(p, V) {
    const t = p.tA, W = p.sirka, WB = p.sirkaB, v = p.vule, L = Math.min(p.delkaA, 400), var_ = p.peroVarianta;
    const tp = p.peroTl > 0 ? p.peroTl : Math.round(t / 3), dp = p.peroHl > 0 ? p.peroHl : Math.round(t / 2);
    const g = 0.5, c0 = (t - tp) / 2, c1 = c0 + tp;
    if (Math.abs(p.tB - p.tA) > 0.01) V.push(['info', `Pero a drážka počítá se stejnou tloušťkou obou desek (${fmt(t)} mm).`]);
    const A = { id: 'A', nazev: var_ === 'volne' ? 'Deska A (drážka)' : 'Deska A (pero)', vlakno: 'x', telesa: [] };
    const B = { id: 'B', nazev: 'Deska B (drážka)', vlakno: 'x', telesa: [] };
    const dily = [A, B];
    let dutiny;
    if (var_ === 'volne') {
      A.telesa.push(hranol('x', [[0, 0], [W, 0], [W, c0], [W - dp - g, c0], [W - dp - g, c1], [W, c1], [W, t], [0, t]], 0, L));
      B.telesa.push(hranol('x', [[W, 0], [W + WB, 0], [W + WB, t], [W, t], [W, c1], [W + dp + g, c1], [W + dp + g, c0], [W, c0]], 0, L));
      dily.push({ id: 'C', nazev: 'Volné pero (překližka)', vlakno: 'y', telesa: [hranol('x', [[W - dp, c0 + v], [W + dp, c0 + v], [W + dp, c1 - v], [W - dp, c1 - v]], 0, L)], rozmer: { L, W: 2 * dp, t: tp - 2 * v }, polotovar: kvadr(0, L, W - dp, W + dp, c0 + v, c1 - v) });
      dutiny = [hranol('x', [[W - dp - g, c0], [W - dp, c0], [W - dp, c1], [W - dp - g, c1]], 0, L), hranol('x', [[W + dp, c0], [W + dp + g, c0], [W + dp + g, c1], [W + dp, c1]], 0, L)];
    } else {
      A.telesa.push(hranol('x', [[0, 0], [W, 0], [W, c0 + v], [W + dp, c0 + v], [W + dp, c1 - v], [W, c1 - v], [W, t], [0, t]], 0, L));
      B.telesa.push(hranol('x', [[W, 0], [W + WB, 0], [W + WB, t], [W, t], [W, c1], [W + dp + g, c1], [W + dp + g, c0], [W, c0]], 0, L));
      dutiny = [hranol('x', [[W + dp, c0], [W + dp + g, c0], [W + dp + g, c1], [W + dp, c1]], 0, L)];
    }
    A.rozmer = { L, W: W + (var_ === 'volne' ? 0 : dp), t }; B.rozmer = { L, W: WB, t };
    A.polotovar = kvadr(0, L, 0, W + (var_ === 'volne' ? 0 : dp), 0, t); B.polotovar = kvadr(0, L, W, W + WB, 0, t);
    const obal = [kvadr(0, L, 0, W + WB, 0, t)];
    if (tp < 4) V.push(['varovani', `Pero ${fmt(tp)} mm je tenké – ulomí se.`]);
    if (tp > t / 2) V.push(['varovani', `Pero ${fmt(tp)} mm je tlustší než polovina desky – stěny drážky (${fmt(c0)} mm) prasknou.`]);
    if (c0 < 4) V.push(['chyba', `Stěna drážky má jen ${fmt(c0)} mm.`]);
    if (dp > t) V.push(['info', `Pero hlubší (${fmt(dp)} mm) než tloušťka desky – zbytečné.`]);
    if (dp < 5) V.push(['info', `Pero ${fmt(dp)} mm je mělké – spoj hlavně vyrovná desky, pevnost dá lepidlo na hranách.`]);
    if (MATERIALY[p.material].mdf && var_ !== 'volne') V.push(['info', 'U MDF je pevnější volné pero z překližky.']);
    const info = { 'Tloušťka pera': `${fmt(tp - 2 * v, 2)} mm (drážka ${fmt(tp)} mm)`, 'Hloubka': `${fmt(dp)} mm + ${fmt(g)} mm rezerva na dně`, 'Stěny drážky': `${fmt(c0)} mm`, 'Délka spoje (náhled)': `${fmt(L)} mm` };
    const sab = [
      { dil: 'A', typ: 'konec', nazev: var_ === 'volne' ? 'A – profil drážky' : 'A – profil pera', konecOsa: 'x', konecZnam: -1, konec: 0, delka: 30, tlOsa: 'z', t0: 0, t1: t, sOsa: 'y', s0: Math.max(0, W - 40), s1: W + (var_ === 'volne' ? 0 : dp), nazevPloch: ['líc', 'čelo (profil)', 'rub'] },
      { dil: 'B', typ: 'konec', nazev: 'B – profil drážky', konecOsa: 'x', konecZnam: -1, konec: 0, delka: 30, tlOsa: 'z', t0: 0, t1: t, sOsa: 'y', s0: W, s1: Math.min(W + WB, W + 40), nazevPloch: ['líc', 'čelo (profil)', 'rub'] },
    ];
    return {
      dily, obal, dutiny, zona: [-2, Math.min(L, 60), W - 40, W + 40, -2, t + 2],
      rozlozeni: [{ dil: 'A', smer: [0, -1, 0], vzdal: dp + 25, krok: 0 }].concat(var_ === 'volne' ? [{ dil: 'C', smer: [0, -1, 0], vzdal: dp + 15, krok: 1 }] : []),
      sablony: sab, koty: [{ a: [0, W, c0], b: [0, W, c1], pohled: 'x', odsaz: -dp - 8 }, { a: [0, W, t], b: [0, W + dp, t], pohled: 'x', odsaz: 8 }, { a: [0, W - 30, 0], b: [0, W - 30, t], pohled: 'x', odsaz: 0, uKonce: 'l' }],
      info, pero: { tp, dp, c0, c1, g },
    };
  }

  function rozmisti(Lj, e, s) {
    const n = Math.max(1, Math.floor((Lj - 2 * e) / s + 1e-9) + 1);
    if (n === 1 || Lj - 2 * e <= 0) return [Lj / 2];
    const out = []; for (let i = 0; i < n; i++) out.push(e + (Lj - 2 * e) * i / (n - 1)); return out;
  }

  function koliky(p, V) {
    const d = p.kolPrumer, Ld = p.kolDelka, v = p.vule, var_ = p.kolVarianta, g = 1, rh = d / 2 + v, rd = d / 2, seg = 32;
    const A = { id: 'A', nazev: 'Díl A', vlakno: 'x', telesa: [] }, B = { id: 'B', nazev: 'Díl B', vlakno: 'y', telesa: [] };
    const dily = [A, B];
    let obal, sablony, koty, zona, dutiny = [], poz, info, kolik = [];
    if (var_ === 'roh') {
      const tA = p.tA, tB = p.tB, W = p.sirka, LA = p.delkaA, LB = p.delkaB;
      poz = rozmisti(W, Math.min(p.kolOkraj, W / 2), p.kolRoztec);
      const dB = Math.min(Math.round(tB * 0.6), Ld - 10), dA = Ld - dB, yc = tA / 2;
      const hA = dA + g, hB = dB + g;
      const diry = poz.map((z) => kruhPoly(yc, z, rh, seg));
      A.telesa.push(hranol('x', [[0, 0], [tA, 0], [tA, W], [0, W]], tB, tB + hA, diry));
      A.telesa.push(hranol('x', [[0, 0], [tA, 0], [tA, W], [0, W]], tB + hA, tB + LA));
      B.telesa.push(hranol('x', [[0, 0], [LB, 0], [LB, W], [0, W]], 0, tB - hB));
      B.telesa.push(hranol('x', [[0, 0], [LB, 0], [LB, W], [0, W]], tB - hB, tB, diry));
      kolik = poz.map((z) => hranol('x', kruhPoly(yc, z, rd, seg), tB - dB, tB + dA));
      dily.push({ id: 'C', nazev: `Kolíky Ø ${fmt(d)} × ${fmt(Ld)} mm`, vlakno: 'x', telesa: kolik, pocet: poz.length, rozmer: { L: Ld, W: d, t: d }, polotovar: null, kolik: true });
      dutiny = poz.flatMap((z) => [hranol('x', kruhPoly(yc, z, rh, seg), tB - hB, tB + hA)]);
      A.rozmer = { L: LA, W, t: tA }; B.rozmer = { L: LB, W, t: tB };
      A.polotovar = kvadr(tB, tB + LA, 0, tA, 0, W); B.polotovar = kvadr(0, tB, 0, LB, 0, W);
      obal = [kvadr(0, tB, 0, LB, 0, W), kvadr(tB, tB + LA, 0, tA, 0, W)];
      A.nazev = 'Díl A (čelem na B)'; B.nazev = 'Díl B (otvory v ploše)';
      sablony = [
        { dil: 'A', typ: 'konec', nazev: 'A – otvory v čele', konecOsa: 'x', konecZnam: -1, konec: tB, delka: 25, tlOsa: 'y', t0: 0, t1: tA, sOsa: 'z', s0: 0, s1: W, nazevPloch: ['vnější plocha', 'čelo', 'vnitřní plocha'], znacky: poz.map((z) => [tB, yc, z]) },
        { dil: 'B', typ: 'stred', nazev: 'B – otvory v ploše', normOsa: 'x', normZnam: +1, plocha: tB, hloubka: tB, dOsa: 'y', d0: -0.001, d1: tA + 25, tlOsa: 'z', t0: 0, t1: W, jenPlocha: true, nazevPloch: ['', 'vnitřní plocha B (A přiléhá od konce)', ''], znacky: poz.map((z) => [tB, yc, z]) },
      ];
      zona = [-2, tB + Math.max(hA, 20) + 10, -2, tA + 25, -2, W + 2];
      koty = [{ a: [tB, -2, 0], b: [tB, -2, poz[0]], pohled: 'y', odsaz: 0, uKonce: 'l' }, { a: [tB - dB, -2, W], b: [tB + dA, -2, W], pohled: 'y', odsaz: 10 }, { a: [tB + 3, 0, 0], b: [tB + 3, yc, 0], pohled: 'z', odsaz: 0, uKonce: 'p' }];
      if (poz.length > 1) koty.push({ a: [tB, -2, poz[0]], b: [tB, -2, poz[1]], pohled: 'y', odsaz: 0, uKonce: 'l' });
      if (hB > tB - 3) V.push(['chyba', `Otvor v ploše B (${fmt(hB)} mm) by prošel deskou ${fmt(tB)} mm – zkraťte kolík nebo zvolte silnější desku.`]);
      if (dA < 2 * d) V.push(['varovani', `Kolík jde do čela A jen ${fmt(dA)} mm – do čela má jít aspoň 2,5× průměr.`]);
      if (d > tA / 2 + 0.01) V.push(['varovani', `Kolík Ø ${fmt(d)} mm je silnější než polovina tloušťky A (${fmt(tA)} mm) – stěny otvoru budou tenké.`]);
      info = { 'Kolíků': poz.length, 'Polohy od hrany': poz.map((z) => fmt(z)).join(', ') + ' mm', 'Otvor v čele A': `Ø ${fmt(2 * rh, 2)} × ${fmt(hA)} mm`, 'Otvor v ploše B': `Ø ${fmt(2 * rh, 2)} × ${fmt(hB)} mm`, 'Osa od plochy': `${fmt(yc)} mm` };
    } else {
      const t = p.tA, W = p.sirka, WB = p.sirkaB, L = Math.min(p.delkaA, 1200);
      poz = rozmisti(L, Math.min(p.kolOkraj, L / 2), p.kolRoztec);
      const dh = Ld / 2 + g, zc = t / 2;
      const diry = poz.map((x) => kruhPoly(x, zc, rh, seg));
      A.telesa.push(hranol('y', [[0, 0], [L, 0], [L, t], [0, t]], 0, W - dh));
      A.telesa.push(hranol('y', [[0, 0], [L, 0], [L, t], [0, t]], W - dh, W, diry));
      B.telesa.push(hranol('y', [[0, 0], [L, 0], [L, t], [0, t]], W, W + dh, diry));
      B.telesa.push(hranol('y', [[0, 0], [L, 0], [L, t], [0, t]], W + dh, W + WB));
      kolik = poz.map((x) => hranol('y', kruhPoly(x, zc, rd, seg), W - Ld / 2, W + Ld / 2));
      dily.push({ id: 'C', nazev: `Kolíky Ø ${fmt(d)} × ${fmt(Ld)} mm`, vlakno: 'y', telesa: kolik, pocet: poz.length, rozmer: { L: Ld, W: d, t: d }, polotovar: null, kolik: true });
      dutiny = poz.map((x) => hranol('y', kruhPoly(x, zc, rh, seg), W - dh, W + dh));
      A.vlakno = 'x'; B.vlakno = 'x';
      A.rozmer = { L, W, t }; B.rozmer = { L, W: WB, t };
      A.polotovar = kvadr(0, L, 0, W, 0, t); B.polotovar = kvadr(0, L, W, W + WB, 0, t);
      obal = [kvadr(0, L, 0, W + WB, 0, t)];
      A.nazev = 'Deska A'; B.nazev = 'Deska B';
      const xs = Math.min(L, poz[Math.min(1, poz.length - 1)] + 40);
      sablony = [
        { dil: 'A', typ: 'stred', nazev: 'A – otvory v hraně', normOsa: 'y', normZnam: +1, plocha: W, hloubka: W, dOsa: 'x', d0: 0, d1: L, tlOsa: 'z', t0: 0, t1: t, nazevPloch: ['líc', 'hrana (spára)', 'rub'], znacky: poz.map((x) => [x, W, zc]), max: 600 },
        { dil: 'B', typ: 'stred', nazev: 'B – otvory v hraně', normOsa: 'y', normZnam: -1, plocha: W, hloubka: WB, dOsa: 'x', d0: 0, d1: L, tlOsa: 'z', t0: 0, t1: t, nazevPloch: ['líc', 'hrana (spára)', 'rub'], znacky: poz.map((x) => [x, W, zc]), max: 600 },
      ];
      zona = [-2, xs, W - dh - 10, W + dh + 10, -2, t + 2];
      koty = [{ a: [0, W, t], b: [poz[0], W, t], pohled: 'z', odsaz: 0, uKonce: 'p' }, { a: [poz[0], W - Ld / 2, t], b: [poz[0], W + Ld / 2, t], pohled: 'z', odsaz: 0, uKonce: 'p' }, { a: [0, W, 0], b: [0, W, zc], pohled: 'x', odsaz: -8 }];
      if (poz.length > 1) koty.push({ a: [poz[0], W - 6, t], b: [poz[1], W - 6, t], pohled: 'z', odsaz: 0, uKonce: 'l' });
      if (d > t / 2 + 0.01) V.push(['varovani', `Kolík Ø ${fmt(d)} mm je silnější než polovina tloušťky ${fmt(t)} mm.`]);
      if (dh > Math.min(W, WB) - 5) V.push(['chyba', 'Otvor je hlubší než šířka desky.']);
      info = { 'Kolíků': poz.length, 'Polohy od konce': poz.map((x) => fmt(x)).join(', ') + ' mm', 'Otvory': `Ø ${fmt(2 * rh, 2)} × ${fmt(dh)} mm do každé hrany`, 'Osa od líce': `${fmt(zc)} mm` };
    }
    if (poz.length < 2) V.push(['varovani', 'Jen jeden kolík – spoj se může otáčet; dejte aspoň dva.']);
    if (p.kolOkraj < 2 * d) V.push(['varovani', `Krajní kolík ${fmt(p.kolOkraj)} mm od konce – blíž než 2× průměr se dřevo vyštípne.`]);
    if (p.kolRoztec > 160) V.push(['info', `Rozteč ${fmt(p.kolRoztec)} mm je velká – obvykle 64–150 mm (systém 32 mm: 64 / 96 / 128).`]);
    if (p.kolRoztec % 32 !== 0) V.push(['info', 'Rozteč není násobkem 32 mm – kolíkovací přípravky a nábytkové kování obvykle počítají s 32 mm.']);
    if (Ld < 3 * d) V.push(['info', `Kolík je krátký (${fmt(Ld)} mm na Ø ${fmt(d)} mm) – obvykle délka 4–5× průměr.`]);
    if (v > 0.15) V.push(['varovani', `Vůle ${fmt(v, 2)} mm na poloměru – kolíky budou volné; otvor se vrtá na jmenovitý průměr.`]);
    return { dily, obal, dutiny, zona, rozlozeni: [{ dil: 'A', smer: var_ === 'roh' ? [1, 0, 0] : [0, -1, 0], vzdal: Ld + 20, krok: 0 }, { dil: 'C', smer: var_ === 'roh' ? [1, 0, 0] : [0, -1, 0], vzdal: Ld / 2 + 10, krok: 1 }], sablony, koty, info, polohy: poz };
  }

  /** kruhová úseč (štěrbina lamely) – body (podél, kolmo), tětiva na kolmo = 0, do strany sm (±1) */
  function usec(stred, hloubka, sm, n) {
    const R = R_KOTOUCE, pul = Math.sqrt(2 * R * hloubka - hloubka * hloubka), P = [];
    n = n || 24;
    for (let i = 0; i <= n; i++) { const x = -pul + 2 * pul * i / n; P.push([stred + x, sm * (Math.sqrt(R * R - x * x) - (R - hloubka))]); }
    return { body: P, delka: 2 * pul };
  }
  function cocka(stred, L, S, n) {
    const Rb = ((L / 2) * (L / 2) + (S / 2) * (S / 2)) / S, P = []; n = n || 20;
    for (let i = 0; i <= n; i++) { const x = -L / 2 + L * i / n; P.push([stred + x, Math.max(0, Math.sqrt(Math.max(0, Rb * Rb - x * x)) - (Rb - S / 2))]); }
    for (let i = n - 1; i >= 1; i--) { const x = -L / 2 + L * i / n; P.push([stred + x, -Math.max(0, Math.sqrt(Math.max(0, Rb * Rb - x * x)) - (Rb - S / 2))]); }
    return P;
  }

  function lamelo(p, V) {
    const Lm = LAMELY[p.lamVel], v = p.vule, var_ = p.lamVarianta, ds = Lm.hloubka, sT = Lm.T;
    const A = { id: 'A', nazev: 'Díl A', vlakno: 'x', telesa: [] }, B = { id: 'B', nazev: 'Díl B', vlakno: 'y', telesa: [] };
    const dily = [A, B];
    let obal, sablony, koty, zona, dutiny = [], poz, info, Lj, tMin;
    const delkaSt = usec(0, ds, 1).delka;
    // zub/zářez do okraje desky: body (podél, kolmo) pro mnohoúhelník s výřezy úsečí
    const sVyrezy = (L, seam, sm, vzdal, poz_) => {
      // obdélník podél ∈ [0, L], kolmo od seam (strana sm) do vzdal; výřezy úsečí na seam
      const P = [[0, vzdal], [L, vzdal], [L, seam]];
      for (const x of poz_.slice().sort((a, b) => b - a)) { const u = usec(x, ds, -sm).body; for (let i = u.length - 1; i >= 0; i--) P.push([u[i][0], seam + u[i][1]]); }
      P.push([0, seam]);
      return P;
    };
    if (var_ === 'sparovka') {
      const t = p.tA, W = p.sirka, WB = p.sirkaB, L = Math.min(p.delkaA, 1500); Lj = L; tMin = t;
      poz = rozmisti(L, Math.min(p.lamOkraj, L / 2), p.lamRoztec);
      const c0 = (t - sT) / 2, c1 = c0 + sT;
      // A: y ∈ [0, W], štěrbiny do y < W (sm = +1 → směr ke spáře, výřez jde do −y)
      A.telesa.push(kvadr(0, L, 0, W, 0, c0), kvadr(0, L, 0, W, c1, t));
      A.telesa.push(hranol('z', sVyrezy(L, W, 1, 0, poz).map((q) => [q[0], q[1]]), c0, c1));
      B.telesa.push(kvadr(0, L, W, W + WB, 0, c0), kvadr(0, L, W, W + WB, c1, t));
      B.telesa.push(hranol('z', sVyrezy(L, W, -1, W + WB, poz), c0, c1));
      const lam = poz.map((x) => hranol('z', cocka(x, Lm.L, Lm.S).map((q) => [q[0], W + q[1]]), c0 + v, c1 - v));
      dily.push({ id: 'C', nazev: `Lamely č. ${p.lamVel} (${Lm.L}×${Lm.S}×${Lm.T})`, vlakno: 'x', telesa: lam, pocet: poz.length, rozmer: { L: Lm.L, W: Lm.S, t: Lm.T }, polotovar: null, lamela: true });
      dutiny = poz.flatMap((x) => [hranol('z', usec(x, ds, -1).body.map((q) => [q[0], W + q[1]]), c0, c1), hranol('z', usec(x, ds, 1).body.map((q) => [q[0], W + q[1]]), c0, c1)]);
      A.vlakno = 'x'; B.vlakno = 'x';
      A.rozmer = { L, W, t }; B.rozmer = { L, W: WB, t };
      A.polotovar = kvadr(0, L, 0, W, 0, t); B.polotovar = kvadr(0, L, W, W + WB, 0, t);
      obal = [kvadr(0, L, 0, W + WB, 0, t)];
      A.nazev = 'Deska A'; B.nazev = 'Deska B';
      sablony = [
        { dil: 'A', typ: 'stred', nazev: 'A – štěrbiny v hraně', normOsa: 'y', normZnam: +1, plocha: W, hloubka: W, dOsa: 'x', d0: 0, d1: L, tlOsa: 'z', t0: 0, t1: t, nazevPloch: ['líc', 'hrana (spára)', 'rub'], znacky: poz.map((x) => [x, W, t / 2]), znackaCara: true, max: 600 },
        { dil: 'B', typ: 'stred', nazev: 'B – štěrbiny v hraně', normOsa: 'y', normZnam: -1, plocha: W, hloubka: WB, dOsa: 'x', d0: 0, d1: L, tlOsa: 'z', t0: 0, t1: t, nazevPloch: ['líc', 'hrana (spára)', 'rub'], znacky: poz.map((x) => [x, W, t / 2]), znackaCara: true, max: 600 },
      ];
      zona = [-2, Math.min(L, poz[0] + delkaSt / 2 + 40), W - 25, W + 25, -2, t + 2];
      koty = [{ a: [0, W, t], b: [poz[0], W, t], pohled: 'z', odsaz: 0, uKonce: 'p' }, { a: [0, W, c0], b: [0, W, c1], pohled: 'x', odsaz: -ds - 8 }, { a: [poz[0] - delkaSt / 2, W, t], b: [poz[0] + delkaSt / 2, W, t], pohled: 'z', odsaz: 0, uKonce: 'l' }];
      info = { 'Lamel': poz.length, 'Polohy (střed) od konce': poz.map((x) => fmt(x)).join(', ') + ' mm', 'Štěrbina': `${fmt(delkaSt, 1)} × ${fmt(ds, 1)} mm do každé hrany, šířka ${fmt(sT)} mm`, 'Výška frézy od líce': `${fmt(c0)} mm (střed ${fmt(t / 2)} mm)` };
    } else {
      const tA = p.tA, tB = p.tB, W = p.sirka, LA = p.delkaA, LB = p.delkaB; Lj = W; tMin = Math.min(tA, tB);
      poz = rozmisti(W, Math.min(p.lamOkraj, W / 2), p.lamRoztec);
      const c0 = (tA - sT) / 2, c1 = c0 + sT;
      // prizmy podél y; přirozené body (x, z): podél = z, kolmo = x
      const sw = (P) => P.map((q) => [q[1], q[0]]);
      A.telesa.push(kvadr(tB, tB + LA, 0, c0, 0, W), kvadr(tB, tB + LA, c1, tA, 0, W));
      A.telesa.push(hranol('y', sw(sVyrezy(W, tB, -1, tB + LA, poz)), c0, c1));
      B.telesa.push(kvadr(0, tB, 0, c0, 0, W), kvadr(0, tB, c1, LB, 0, W));
      B.telesa.push(hranol('y', sw(sVyrezy(W, tB, 1, 0, poz)), c0, c1));
      const lam = poz.map((z) => hranol('y', sw(cocka(z, Lm.L, Lm.S).map((q) => [q[0], tB + q[1]])), c0 + v, c1 - v));
      dily.push({ id: 'C', nazev: `Lamely č. ${p.lamVel} (${Lm.L}×${Lm.S}×${Lm.T})`, vlakno: 'z', telesa: lam, pocet: poz.length, rozmer: { L: Lm.L, W: Lm.S, t: Lm.T }, polotovar: null, lamela: true });
      dutiny = poz.flatMap((z) => [hranol('y', sw(usec(z, ds, 1).body.map((q) => [q[0], tB + q[1]])), c0, c1), hranol('y', sw(usec(z, ds, -1).body.map((q) => [q[0], tB + q[1]])), c0, c1)]);
      A.rozmer = { L: LA, W, t: tA }; B.rozmer = { L: LB, W, t: tB };
      A.polotovar = kvadr(tB, tB + LA, 0, tA, 0, W); B.polotovar = kvadr(0, tB, 0, LB, 0, W);
      obal = [kvadr(0, tB, 0, LB, 0, W), kvadr(tB, tB + LA, 0, tA, 0, W)];
      A.nazev = 'Díl A (čelem na B)'; B.nazev = 'Díl B (štěrbiny v ploše)';
      sablony = [
        { dil: 'A', typ: 'konec', nazev: 'A – štěrbiny v čele', konecOsa: 'x', konecZnam: -1, konec: tB, delka: 25, tlOsa: 'y', t0: 0, t1: tA, sOsa: 'z', s0: 0, s1: W, nazevPloch: ['vnější plocha', 'čelo', 'vnitřní plocha'], znacky: poz.map((z) => [tB, tA / 2, z]), znackaCara: true },
        { dil: 'B', typ: 'stred', nazev: 'B – štěrbiny v ploše', normOsa: 'x', normZnam: +1, plocha: tB, hloubka: tB, dOsa: 'y', d0: -0.001, d1: tA + 25, tlOsa: 'z', t0: 0, t1: W, jenPlocha: true, nazevPloch: ['', 'vnitřní plocha B', ''], znacky: poz.map((z) => [tB, tA / 2, z]), znackaCara: true },
      ];
      zona = [-2, tB + ds + 25, -2, tA + 25, -2, W + 2];
      koty = [{ a: [tB, -2, 0], b: [tB, -2, poz[0]], pohled: 'y', odsaz: 0, uKonce: 'l' }, { a: [tB + 3, c0, 0], b: [tB + 3, c1, 0], pohled: 'z', odsaz: 0, uKonce: 'p' }];
      if (ds > tB - 4) V.push(['chyba', `Štěrbina ${fmt(ds)} mm v ploše B by skoro prošla deskou ${fmt(tB)} mm.`]);
      info = { 'Lamel': poz.length, 'Polohy (střed) od hrany': poz.map((z) => fmt(z)).join(', ') + ' mm', 'Štěrbina': `${fmt(delkaSt, 1)} × ${fmt(ds, 1)} mm, šířka ${fmt(sT)} mm`, 'Výška frézy': `${fmt(c0)} mm od vnější plochy A` };
    }
    if (tMin < 8) V.push(['chyba', `Desky pod 8 mm na lamely nejsou – štěrbina 4 mm by je rozštípla.`]);
    else if (tMin < 12 && p.lamVel !== '0') V.push(['varovani', `Pro tloušťku ${fmt(tMin)} mm použijte lamelu č. 0.`]);
    if (Lj < delkaSt + 10) V.push(['chyba', `Spoj je jen ${fmt(Lj)} mm dlouhý – štěrbina pro lamelu č. ${p.lamVel} má ${fmt(delkaSt, 1)} mm. Zvolte menší lamelu nebo kolíky.`]);
    if (poz.length > 1 && (poz[1] - poz[0]) < delkaSt + 5) V.push(['chyba', 'Štěrbiny se překrývají – zvětšete rozteč.']);
    if (p.lamOkraj < delkaSt / 2 + 5) V.push(['varovani', 'Krajní lamela je u konce tak blízko, že štěrbina vyjede ven.']);
    info['Lamela'] = `č. ${p.lamVel}: ${Lm.L} × ${Lm.S} × ${Lm.T} mm (lisovaný buk, nabobtná lepidlem)`;
    return { dily, obal, dutiny, zona, rozlozeni: [{ dil: 'A', smer: var_ === 'roh' ? [1, 0, 0] : [0, -1, 0], vzdal: 50, krok: 0 }, { dil: 'C', smer: var_ === 'roh' ? [1, 0, 0] : [0, -1, 0], vzdal: 25, krok: 1 }], sablony, koty, info, polohy: poz, delkaSterbiny: delkaSt };
  }

  /* ================================================================
     sestav – hlavní vstup
     ================================================================ */
  const BARVY_DILU = { A: '#c8955a', B: '#9a6a3c', C: '#e2c48c' };
  function sestav(vstup) {
    const p = normalizuj(vstup), V = [];
    let S;
    if (p.spoj === 'rybina' || p.spoj === 'polokryta') S = rybina(p, V);
    else if (p.spoj === 'cinky') S = cinky(p, V);
    else if (p.spoj === 'cep') S = cepDlab(p, V);
    else if (p.spoj === 'preplatovani') S = preplatovani(p, V);
    else if (p.spoj === 'pero') S = peroDrazka(p, V);
    else if (p.spoj === 'koliky') S = koliky(p, V);
    else S = lamelo(p, V);
    for (const d of S.dily) { d.barva = BARVY_DILU[d.id] || '#b0b0b0'; if (!d.pocet) d.pocet = 1; d.objem = objemDilu(d); }
    if (p.presah > 0 && ['pero', 'koliky', 'lamelo'].indexOf(p.spoj) < 0) V.push(['info', `Přesah ${fmt(p.presah, 1)} mm: ozuby, prsty a čepy vyčnívají a po slepení se zarovnají hoblíkem.`]);
    S.p = p; S.varovani = V.map((q) => ({ uroven: q[0], text: q[1] }));
    S.nazev = SPOJE[p.spoj].nazev;
    S.objemObalu = S.obal.reduce((s, T) => s + objemTelesa(T), 0);
    S.objemDutin = (S.dutiny || []).reduce((s, T) => s + objemTelesa(T), 0) - S.dily.filter((d) => d.kolik || d.lamela).reduce((s, d) => s + d.objem, 0);
    S.kusovnik = kusovnik(S);
    return S;
  }

  /* ---------------- kusovník ---------------- */
  function kusovnik(S) {
    const p = S.p, mat = MATERIALY[p.material], n = p.pocetSpoju, radky = [];
    for (const d of S.dily) {
      const ks = d.pocet * n;
      if (d.kolik) radky.push({ dil: d.id, nazev: 'Kolík bukový drážkovaný', ks, rozmer: `Ø ${fmt(p.kolPrumer)} × ${fmt(p.kolDelka)} mm`, material: 'buk', objem: d.objem * n / 1e6, hmotnost: d.objem * n / 1e9 * 720 });
      else if (d.lamela) radky.push({ dil: d.id, nazev: d.nazev.replace(/ \(.*/, ''), ks, rozmer: `${LAMELY[p.lamVel].L} × ${LAMELY[p.lamVel].S} × ${LAMELY[p.lamVel].T} mm`, material: 'lisovaný buk', objem: d.objem * n / 1e6, hmotnost: d.objem * n / 1e9 * 720 });
      else {
        const r = d.rozmer, ob = r.L * r.W * r.t;
        radky.push({ dil: d.id, nazev: d.nazev, ks: d.id === 'C' && S.p.spoj === 'cep' ? 2 * n : ks, rozmer: `${fmt(r.L)} × ${fmt(r.W)} × ${fmt(r.t)} mm`, material: d.id === 'C' && S.p.spoj === 'pero' ? 'překližka' : mat.nazev, objem: ob * ks / 1e6, hmotnost: ob * ks / 1e9 * mat.hustota, polotovar: true });
      }
    }
    return radky;
  }

  /* ---------------- předvolby ---------------- */
  const PREDVOLBY = {
    zasuvka: { nazev: 'Zásuvka (čelo polokrytá rybina)', p: { spoj: 'polokryta', material: 'buk', tA: 12, tB: 20, sirka: 120, delkaA: 400, delkaB: 160, pocet: 3, cepUzky: 6, pulcep: 7, kryti: 6, vule: 0.05, presah: 0.3, pila: 'rybinova', dlato: 10, pocetSpoju: 2 } },
    krabice: { nazev: 'Krabice (cinky)', p: { spoj: 'cinky', material: 'borovice', tA: 12, tB: 12, sirka: 100, delkaA: 250, delkaB: 180, prstu: 9, vule: 0.1, presah: 0.5, pila: 'kotoucova', pocetSpoju: 4 } },
    sperkovnice: { nazev: 'Šperkovnice (průběžná rybina 1:8)', p: { spoj: 'rybina', material: 'orech', tA: 10, tB: 10, sirka: 80, delkaA: 200, delkaB: 140, pocet: 3, cepUzky: 4, pulcep: 5, vule: 0.05, presah: 0.5, pila: 'dozuki', dlato: 6, pocetSpoju: 4 } },
    truhla: { nazev: 'Truhla (průběžná rybina 1:6)', p: { spoj: 'rybina', material: 'smrk', tA: 22, tB: 22, sirka: 380, delkaA: 900, delkaB: 450, pocet: 6, cepUzky: 10, pulcep: 10, vule: 0.1, presah: 1, pila: 'cepovka', dlato: 16, pocetSpoju: 4 } },
    ram: { nazev: 'Rám dveří (slepý čep s osazením)', p: { spoj: 'cep', material: 'dub', tA: 30, tB: 30, sirka: 90, sirkaB: 90, delkaA: 500, delkaB: 300, cepVarianta: 'slepy', osazeni: 15, dlato: 10, vule: 0.05, pocetSpoju: 4 } },
    noha: { nazev: 'Stolová noha + lub (slepý čep)', p: { spoj: 'cep', material: 'buk', tA: 22, tB: 70, sirka: 100, sirkaB: 70, delkaA: 700, delkaB: 720, cepVarianta: 'slepy', osazeni: 15, hloubkaDlabu: 40, licovat: false, dlato: 8, vule: 0.05, pocetSpoju: 8 } },
    lavice: { nazev: 'Lavice (průchozí čep s klínky)', p: { spoj: 'cep', material: 'jasan', tA: 36, tB: 40, sirka: 80, sirkaB: 60, delkaA: 400, delkaB: 420, cepVarianta: 'kliny', osazeni: 12, rozevreni: 12, dlato: 12, vule: 0.05, presah: 2, pila: 'cepovka', pocetSpoju: 4 } },
    obraz: { nazev: 'Rám obrazu (rohové přeplátování)', p: { spoj: 'preplatovani', plVarianta: 'roh', material: 'lipa', tA: 20, tB: 20, sirka: 50, sirkaB: 50, delkaA: 400, delkaB: 300, vule: 0.05, presah: 0, pocetSpoju: 4 } },
    deska: { nazev: 'Spárovaná deska stolu (lamely)', p: { spoj: 'lamelo', lamVarianta: 'sparovka', lamVel: '20', material: 'dub', tA: 28, tB: 28, sirka: 120, sirkaB: 120, delkaA: 1200, lamRoztec: 200, lamOkraj: 80, vule: 0, pocetSpoju: 5 } },
    korpus: { nazev: 'Korpus skříňky (kolíky)', p: { spoj: 'koliky', kolVarianta: 'roh', material: 'preklizka', tA: 18, tB: 18, sirka: 300, delkaA: 560, delkaB: 720, kolPrumer: 8, kolDelka: 35, kolRoztec: 96, kolOkraj: 37, vule: 0, pocetSpoju: 4 } },
    palubky: { nazev: 'Obklad / palubky (pero a drážka)', p: { spoj: 'pero', material: 'smrk', tA: 19, tB: 19, sirka: 96, sirkaB: 96, delkaA: 400, peroTl: 6, peroHl: 8, vule: 0.1, pocetSpoju: 10 } },
  };

  /* ---------------- objemová kontrola (voxely) ---------------- */
  /** vzorkuje mřížku v zóně: vrací {kolize, prazdno (objem uvnitř obalu bez dílu), mimo (objem dílů mimo obal), vzorku, krok} */
  function objemovaKontrola(S, krok) {
    const z = S.zona; krok = krok || 1;
    const fx = 0.3711, fy = 0.6173, fz = 0.2389;   // posun mimo hrany těles
    let kolize = 0, prazdno = 0, mimo = 0, n = 0, prazdnoMimoDutiny = 0;
    const dvol = krok * krok * krok;
    const pripravene = S.dily.map((d) => d.telesa.map((T) => ({ T, m: mezeTelesa(T) })));
    const vMezich = (m, P) => P[0] > m[0] && P[0] < m[1] && P[1] > m[2] && P[1] < m[3] && P[2] > m[4] && P[2] < m[5];
    const vSeznamu = (L, P) => L.some((q) => vMezich(q.m, P) && bodVTelese(q.T, P));
    const obal = S.obal.map((T) => ({ T, m: mezeTelesa(T) })), dut = (S.dutiny || []).map((T) => ({ T, m: mezeTelesa(T) }));
    const P = [0, 0, 0];
    for (let x = z[0] + krok * fx; x < z[1]; x += krok) for (let y = z[2] + krok * fy; y < z[3]; y += krok) for (let zz = z[4] + krok * fz; zz < z[5]; zz += krok) {
      P[0] = x; P[1] = y; P[2] = zz; n++;
      let k = 0; for (const L of pripravene) if (vSeznamu(L, P)) k++;
      if (k > 1) kolize++;
      const vObalu = vSeznamu(obal, P);
      if (vObalu && k === 0) { prazdno++; if (!vSeznamu(dut, P)) prazdnoMimoDutiny++; }
      if (!vObalu && k > 0) mimo++;
    }
    return { kolize: kolize * dvol, prazdno: prazdno * dvol, prazdnoMimoDutiny: prazdnoMimoDutiny * dvol, mimo: mimo * dvol, vzorku: n, krok };
  }

  const API = {
    MATERIALY, PILY, LAMELY, SPOJE, VYCHOZI, PREDVOLBY, BARVY_DILU,
    normalizuj, sestav, rozvrhRybin, navrhRybin, objemovaKontrola, kusovnik,
    plocha, uvnitr, pruseciky, z3D, do3D, osyTelesa, OSY, hranol, kvadr, kruhPoly, vycistiPoly,
    objemTelesa, objemDilu, bodVTelese, bodVDilu, mezeTelesa, mezeDilu, posunTeleso, fmt, usec, cocka, R_KOTOUCE,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.TSJ = API;
})(typeof window !== 'undefined' ? window : globalThis);
