/* Řemenice GT2/HTD a napínáky – jádro bez DOM a THREE (spustitelné i v node).
   Profily drážek, normalizace parametrů, výpočty pohonu (délka řemene, osová vzdálenost,
   zuby v záběru), 2D obrys ozubení, kontroly a pomocné výpočty pro tisk.
   Tělesa staví geometrie.js přes manifold-3d.

   Souřadnice: osa řemenice = Z (tisková poloha, náboj dole na podložce), obrys ozubení v rovině XY.

   ZDROJE ROZMĚRŮ (sloupce PROFILY):
   - p (rozteč) a u (polovina PLD = vzdálenost roztečné čáry řemene od hlavové kružnice řemenice):
     GT2/GT3: Gates PowerGrip GT2 Belt Drive Design Manual (2MGT PLD 0,508 mm, 3MGT 0,762 mm);
     HTD 3M/5M: Gates PowerGrip HTD (PLD 0,762 / 1,143 mm); MXL: ISO 5296 / RMA IP-24 (PLD 0,508 mm);
     T2.5/T5: DIN 7721-2 a katalogové tabulky řemenic (hlavový průměr = roztečný − 0,6 / − 0,85 mm).
   - Tvar zubu řemene GT (R2 = poloměr boku, R3 = poloměr hlavy, b = vyosení středu boku, h = výška zubu):
     Gates GT2 2MGT: R2 1,00, R3 0,555, b 0,40, h 0,75 (střed R3 leží tečně uvnitř R2 – rozměry jsou
     navzájem konzistentní, viz test); 3MGT: R2 1,52, R3 0,85, b 0,61, h 1,14.
   - Šířka W a hloubka D drážky řemenice na hlavové kružnici (už s vůlí proti zubu řemene):
     podle parametrické řemenice „Parametric Pulley“ (droftarts, OpenSCAD, hodnoty tooth_width /
     tooth_depth odvozené z výkresů výrobců) – ověřené tisky na řemenech GT2/T/MXL/HTD.
   - Lichoběžníkové profily (T, MXL): úhel boků 40° (DIN 7721, ISO 5296).
   - rf = zaoblení hlavy zubu řemenice (GT2: R1 = 0,15 mm podle Gates). */
(function () {
  'use strict';
  const VERZE_FORMATU = 1;

  const PROFILY = {
    gt2: { nazev: 'GT2 – 2 mm', p: 2, u: 0.254, tvar: 'gt', R2: 1.0, R3: 0.555, b: 0.40, h: 0.75, W: 1.494, D: 0.764, rf: 0.15, H: 1.38, sirky: [6, 9, 10, 12], zmin: 12 },
    gt3: { nazev: 'GT3 – 3 mm', p: 3, u: 0.381, tvar: 'gt', R2: 1.52, R3: 0.85, b: 0.61, h: 1.14, W: 2.31, D: 1.169, rf: 0.25, H: 2.41, sirky: [6, 9, 15], zmin: 16 },
    htd3: { nazev: 'HTD 3M', p: 3, u: 0.381, tvar: 'htd', W: 2.27, D: 1.289, rf: 0.25, H: 2.4, sirky: [6, 9, 15], zmin: 10 },
    htd5: { nazev: 'HTD 5M', p: 5, u: 0.5715, tvar: 'htd', W: 3.781, D: 2.199, rf: 0.4, H: 3.8, sirky: [9, 15, 25], zmin: 14 },
    t25: { nazev: 'T2.5', p: 2.5, u: 0.3, tvar: 'lich', W: 1.678, D: 0.7, rf: 0.2, H: 1.3, sirky: [4, 6, 10], zmin: 10 },
    t5: { nazev: 'T5', p: 5, u: 0.425, tvar: 'lich', W: 3.264, D: 1.19, rf: 0.4, H: 2.2, sirky: [6, 10, 16], zmin: 10 },
    mxl: { nazev: 'MXL – 2,032 mm', p: 2.032, u: 0.254, tvar: 'lich', W: 1.321, D: 0.508, rf: 0.13, H: 1.14, sirky: [3.2, 6.4, 9.5], zmin: 10 },
  };

  /** Ložiska: [vnitřní d, vnější D, šířka B] v mm (ISO 15, řady 6xx, 6xxx, miniaturní MR). */
  const LOZISKA = {
    '608': [8, 22, 7], '688': [8, 16, 5], '6000': [10, 26, 8], '625': [5, 16, 5], '624': [4, 13, 5],
    '623': [3, 10, 4], 'MR105': [5, 10, 4], 'MR85': [5, 8, 2.5], 'MR63': [3, 6, 2.5],
  };

  /** Těsná pera DIN 6885-1: pro hřídel d ∈ (od, do] → šířka b, hloubka drážky v náboji t2. */
  const PERA = [
    [6, 8, 2, 1.0], [8, 10, 3, 1.4], [10, 12, 4, 1.8], [12, 17, 5, 2.3],
    [17, 22, 6, 2.8], [22, 30, 8, 3.3], [30, 38, 10, 3.3],
  ];
  /** Matice M3 (ISO 4032): otvor na klíč s, výška m. */
  const MATICE_M3 = { s: 5.5, m: 2.4 };

  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24 }, PETG: { nazev: 'PETG', hustota: 1.27 },
    ABS: { nazev: 'ABS', hustota: 1.04 }, ASA: { nazev: 'ASA', hustota: 1.07 },
    PA: { nazev: 'PA (nylon)', hustota: 1.14 }, TPU: { nazev: 'TPU 95A', hustota: 1.21 },
  };

  const VYCHOZI = {
    nazev: 'Řemenice GT2 20 zubů',
    dily: { r1: true, r2: false, kladka: false, napinak: false },
    profil: 'gt2',
    z1: 20,
    sirkaRemene: 6, vuleSirky: 1,
    priruby: { typ: 'obe', presah: 1.5, tloustka: 1, ukos: 45 },
    naboj: { pouzit: true, prumer: 16, vyska: 7, sroubu: 1, otvorSroubu: 3.2, matice: true, vuleMatice: 0.3 },
    otvor: { typ: 'hladky', prumer: 5, plocha: 0.5, vule: 0.15 },
    komp: { drazka: 0, prumer: 0 },
    pohon: { z2: 40, otvor2: 8, rezim: 'C', C: 100, L: 400, otacky: 1000 },
    kladka: { lozisko: '625', pocet: 1, prumer: 20, vule: 0.1, osazeni: true },
    napinak: { typ: 'rameno', delka: 30, sirka: 12, tloustka: 5, cep: 5.3, osa: 5.2, zdvih: 15, nalitek: 1 },
    tisk: { material: 'PLA', jemnost: 0.25 },
  };

  const ROZSAHY = {
    z1: [8, 200], sirkaRemene: [2, 50], vuleSirky: [0, 4],
    'priruby.presah': [0.3, 10], 'priruby.tloustka': [0.4, 6], 'priruby.ukos': [0, 60],
    'naboj.prumer': [4, 120], 'naboj.vyska': [1, 40], 'naboj.sroubu': [0, 2], 'naboj.otvorSroubu': [2, 4], 'naboj.vuleMatice': [0, 1],
    'otvor.prumer': [1, 60], 'otvor.plocha': [0.1, 5], 'otvor.vule': [-0.3, 1],
    'komp.drazka': [-0.5, 0.8], 'komp.prumer': [-1, 1],
    'pohon.z2': [8, 300], 'pohon.otvor2': [1, 60], 'pohon.C': [5, 5000], 'pohon.L': [20, 20000], 'pohon.otacky': [0, 100000],
    'kladka.pocet': [1, 2], 'kladka.prumer': [4, 200], 'kladka.vule': [-0.3, 0.6],
    'napinak.delka': [4, 300], 'napinak.sirka': [4, 80], 'napinak.tloustka': [1, 30], 'napinak.cep': [1, 30],
    'napinak.osa': [1, 30], 'napinak.zdvih': [1, 200], 'napinak.nalitek': [0, 10],
    'tisk.jemnost': [0.05, 1],
  };
  const VYBERY = {
    profil: Object.keys(PROFILY), 'priruby.typ': ['obe', 'jedna', 'zadna'], 'otvor.typ': ['hladky', 'd', 'pero'],
    'pohon.rezim': ['C', 'L'], 'kladka.lozisko': Object.keys(LOZISKA), 'napinak.typ': ['rameno', 'drazka'],
    'tisk.material': Object.keys(MATERIALY),
  };
  const CELA = new Set(['z1', 'pohon.z2', 'naboj.sroubu', 'kladka.pocet']);

  /* ---------- drobnosti ---------- */
  const kopie = o => JSON.parse(JSON.stringify(o));
  const vezmi = (o, c) => c.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, c, h) { const k = c.split('.'), l = k.pop(); k.reduce((a, x) => a[x], o)[l] = h; }
  const omez = (x, a, b) => Math.min(b, Math.max(a, x));
  function cislo(s, nahr) {
    if (typeof s === 'number') return Number.isFinite(s) ? s : nahr;
    const t = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
    const n = t === '' ? NaN : Number(t);
    return Number.isFinite(n) ? n : nahr;
  }
  function fmt(x, des = 1) {
    if (!Number.isFinite(x)) return '—';
    const r = Math.round(x * 10 ** des) / 10 ** des;
    return String(Object.is(r, -0) ? 0 : r).replace('.', ',').replace('-', '−');
  }

  /* ---------- normalizace ---------- */
  function normalizuj(vstup) {
    const hlaseni = [], p = kopie(VYCHOZI), v = vstup || {};
    if (typeof v.nazev === 'string') p.nazev = v.nazev.slice(0, 120);
    for (const [c, [a, b]] of Object.entries(ROZSAHY)) {
      const x = vezmi(v, c);
      if (x === undefined) continue;
      let n = cislo(x, NaN);
      if (!Number.isFinite(n)) { hlaseni.push(`${c}: neplatné číslo`); continue; }
      if (CELA.has(c)) n = Math.round(n);
      if (n < a || n > b) hlaseni.push(`${c}: omezeno na ${a}–${b}`);
      poloz(p, c, omez(n, a, b));
    }
    for (const [c, mozne] of Object.entries(VYBERY)) {
      const x = vezmi(v, c);
      if (x !== undefined && mozne.includes(String(x))) poloz(p, c, String(x));
    }
    for (const c of ['r1', 'r2', 'kladka', 'napinak']) if (v.dily && c in v.dily) p.dily[c] = !!v.dily[c];
    for (const c of ['naboj.pouzit', 'naboj.matice', 'kladka.osazeni']) { const x = vezmi(v, c); if (x !== undefined) poloz(p, c, !!x); }
    return { p, hlaseni };
  }

  /* ---------- pohon ---------- */
  const roztecny = (prof, z) => z * prof.p / Math.PI;
  /** Délka řemene (po roztečné čáře) otevřeného převodu se dvěma řemenicemi d1, d2 ve vzdálenosti os C.
      φ = asin((d2 − d1) / 2C), L = 2C·cos φ + π(d1 + d2)/2 + φ(d2 − d1). */
  function delkaRemene(d1, d2, C) {
    const s = (d2 - d1) / (2 * C);
    if (!(C > 0) || Math.abs(s) >= 1) return NaN;
    const f = Math.asin(s);
    return 2 * C * Math.cos(f) + Math.PI * (d1 + d2) / 2 + f * (d2 - d1);
  }
  /** Osová vzdálenost pro danou délku řemene (délka roste s C monotónně → půlení intervalu). */
  function osovaVzdalenost(d1, d2, L) {
    let a = Math.abs(d2 - d1) / 2 + 1e-9, b = L / 2;
    if (!(delkaRemene(d1, d2, b) >= L) || !(delkaRemene(d1, d2, a) <= L)) return NaN;
    for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (delkaRemene(d1, d2, m) < L) a = m; else b = m; }
    return (a + b) / 2;
  }
  /** Úhel opásání malé řemenice (rad). */
  function opasani(d1, d2, C) { return Math.PI - 2 * Math.asin(Math.abs(d2 - d1) / (2 * C)); }

  /** Kompletní výpočet pohonu z parametrů projektu. */
  function pohon(p) {
    const prof = PROFILY[p.profil], z1 = p.z1, z2 = p.pohon.z2;
    const d1 = roztecny(prof, z1), d2 = roztecny(prof, z2);
    let C, L;
    if (p.pohon.rezim === 'L') { L = p.pohon.L; C = osovaVzdalenost(d1, d2, L); }
    else { C = p.pohon.C; L = delkaRemene(d1, d2, C); }
    const N = L / prof.p;
    const res = { d1, d2, C, L, N, i: z2 / z1, platne: Number.isFinite(C) && Number.isFinite(L) };
    if (!res.platne) return res;
    const zs = Math.min(z1, z2), th = opasani(d1, d2, C);
    res.opasani = th;
    res.zubuVZaberu = Math.floor(zs * th / (2 * Math.PI) + 1e-9);
    res.zubuVZaberuPresne = zs * th / (2 * Math.PI);
    // uzavřený řemen má celý počet zubů – nejbližší délky a jejich osové vzdálenosti
    const Nd = Math.floor(N + 1e-9), Nh = Math.ceil(N - 1e-9);
    res.blizke = [...new Set([Nd, Nh])].filter(n => n > 0).map(n => ({ N: n, L: n * prof.p, C: osovaVzdalenost(d1, d2, n * prof.p) }));
    res.n2 = p.pohon.otacky * z1 / z2;
    res.v = p.pohon.otacky * Math.PI * d1 / 60000;   // m/s
    return res;
  }

  /* ---------- profil drážky ---------- */
  /** Polovina profilu drážky (s ≥ 0) od dna (s = 0) k hlavové kružnici (d = 0) v jednotkách prof.
      s = po obvodu, d = hloubka pod hlavovou kružnicí. Vrací body bez škálování na W, D. */
  function pulDrazky(prof, W, D, n) {
    const B = [];
    if (prof.tvar === 'gt') {
      // zub řemene: hlava R3 se středem na ose, bok R2 se středem na hlavové přímce v −b, tečně uvnitř
      const { R2, R3, b } = prof, yc = Math.sqrt((R2 - R3) ** 2 - b * b), h0 = yc + R3, s0 = R2 - b;
      const at = Math.atan2(yc, b), sx = (W / 2) / s0, sy = D / h0;
      for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + (at - Math.PI / 2) * i / n; B.push([R3 * Math.cos(a) * sx, (yc + R3 * Math.sin(a)) * sy]); }
      for (let i = 1; i <= n; i++) { const a = at * (1 - i / n); B.push([(-b + R2 * Math.cos(a)) * sx, R2 * Math.sin(a) * sy]); }
    } else if (prof.tvar === 'htd') {
      // kruhový zub: dno půlkruh poloměru W/2 a rovné boky, mělčí drážka = kruhová úseč
      if (D >= W / 2) {
        const r = W / 2, c = D - r;
        for (let i = 0; i <= n; i++) { const a = Math.PI / 2 * (1 - i / n); B.push([r * Math.cos(a), c + r * Math.sin(a)]); }
        if (c > 1e-6) B.push([r, 0]);
      } else {
        const r = (W * W / 4 + D * D) / (2 * D), c = D - r, a0 = Math.asin((r - D) / r);
        for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + (a0 - Math.PI / 2) * i / n; B.push([r * Math.cos(a), c + r * Math.sin(a)]); }
      }
    } else {
      // lichoběžník s boky 40°
      const wb = Math.max(0.05, W / 2 - D * Math.tan(20 * Math.PI / 180));
      B.push([0, D], [wb, D], [W / 2, 0]);
    }
    B[B.length - 1] = [W / 2, 0];   // konec přesně na hlavové kružnici
    return B;
  }
  /** Celý profil drážky od s = −W/2 do +W/2. */
  function profilDrazky(prof, W, D, n = 8) {
    const P = pulDrazky(prof, W, D, n);
    const L = P.slice(1).reverse().map(([s, d]) => [-s, d]);
    return L.concat(P);
  }

  /** Rozměry ozubení řemenice se z zuby. */
  function ozubeni(p, z) {
    const prof = PROFILY[p.profil];
    const PD = roztecny(prof, z), OD = PD - 2 * prof.u + p.komp.prumer, R = OD / 2;
    const W = prof.W + p.komp.drazka, D = prof.D;
    const pOD = Math.PI * OD / z;                 // rozteč na hlavové kružnici
    const mustek = pOD - W;                       // šířka hlavy zubu řemenice po obvodu
    return { prof, z, PD, OD, R, W, D, Rpata: R - D, pOD, mustek, rf: Math.max(0, Math.min(prof.rf, 0.45 * mustek)) };
  }
  /** 2D obrys ozubení (proti směru hodinových ručiček), drážka i má osu v úhlu 2πi/z.
      jemnost = největší délka úsečky na oblouku hlavové kružnice (mm). */
  function obrysOzubeni(p, z, jemnost = 0.25) {
    const oz = ozubeni(p, z);
    if (oz.mustek <= 0.02) return { ...oz, body: null };
    const prof = PROFILY[p.profil], P = profilDrazky(prof, oz.W, oz.D, prof.tvar === 'lich' ? 1 : 7), R = oz.R, body = [];
    const nObl = Math.max(1, Math.ceil(oz.mustek / jemnost));
    for (let i = 0; i < z; i++) {
      const t = 2 * Math.PI * i / z;
      for (const [s, d] of P) { const a = t + s / R, r = R - d; body.push([r * Math.cos(a), r * Math.sin(a)]); }
      const a0 = t + oz.W / 2 / R, a1 = t + 2 * Math.PI / z - oz.W / 2 / R;
      for (let k = 1; k < nObl; k++) { const a = a0 + (a1 - a0) * k / nObl; body.push([R * Math.cos(a), R * Math.sin(a)]); }
    }
    return { ...oz, body };
  }

  /* ---------- výškové členění řemenice (osa Z, náboj dole) ---------- */
  function vrstvy(p, oz) {
    const pr = p.priruby, Hn = p.naboj.pouzit ? p.naboj.vyska : 0;
    const dolni = pr.typ !== 'zadna', horni = pr.typ === 'obe';
    const Rf = oz.R + pr.presah, hk = pr.ukos > 0 ? pr.presah * Math.tan(pr.ukos * Math.PI / 180) : 0;
    const Bz = p.sirkaRemene + p.vuleSirky;
    const zt0 = Hn + (dolni ? pr.tloustka + hk : 0), zt1 = zt0 + Bz;
    const H = zt1 + (horni ? hk + pr.tloustka : 0);
    return { Hn, dolni, horni, Rf, hk, Bz, zt0, zt1, H };
  }
  /** Otvor: největší poloměr (i s drážkou pro pero) a rozměry pera. */
  function otvor(p, d) {
    const o = p.otvor, v = o.vule, r = (d + v) / 2;
    if (o.typ === 'pero') {
      const pero = PERA.find(([a, b]) => d > a && d <= b);
      if (!pero) return { r, rMax: r, chyba: `pro hřídel ⌀ ${fmt(d)} mm nemá DIN 6885 pero (6–38 mm)` };
      const [, , b, t2] = pero;
      return { r, rMax: Math.hypot(d / 2 + t2 + v / 2, (b + v) / 2), pero: { b: b + v, t2, x: d / 2 + t2 + v / 2 } };
    }
    if (o.typ === 'd') return { r, rMax: r, plochaX: d / 2 - o.plocha + v / 2 };
    return { r, rMax: r };
  }
  /** Poloha matice a šroubu v náboji. */
  function matice(p, ot) {
    const n = p.naboj, s = MATICE_M3.s + n.vuleMatice, m = MATICE_M3.m + n.vuleMatice, e = s / Math.cos(Math.PI / 6);
    const Rn = n.prumer / 2, rn = (ot.r + Rn) / 2;
    // kapsa je otevřená ke spodnímu čelu náboje; šroub co nejvýš tak, aby nad maticí zbylo 0,4 mm
    const zs = n.matice ? Math.min(n.vyska / 2, n.vyska - e / 2 - 0.4) : n.vyska / 2;
    return { s, m, e, rn, zs, stenaVnitrni: rn - m / 2 - ot.r, stenaVnejsi: Rn - rn - m / 2 };
  }
  /** Vodicí kladka: rozměry. */
  function kladka(p) {
    const k = p.kladka, [d, D, B] = LOZISKA[k.lozisko];
    const v = vrstvy(Object.assign({}, p, { naboj: { pouzit: false } }), { R: k.prumer / 2 });
    const rSedlo = (D + k.vule) / 2, lip = Math.min(1, 0.2 * (D - d));
    return { d, D, B, ...v, rSedlo, rOsazeni: rSedlo - lip, stena: k.prumer / 2 - rSedlo, delkaLozisek: k.pocet * B };
  }

  /* ---------- kontroly ---------- */
  function kontroly(p, sestava) {
    const H = [];
    const add = (uroven, text, pole = [], oprava) => H.push({ uroven, text, pole, oprava });
    const prof = PROFILY[p.profil], d = p.dily;
    if (!d.r1 && !d.r2 && !d.kladka && !d.napinak) add('chyba', 'Není vybraný žádný díl k tisku.', ['dily.r1']);
    const kontrolaRemenice = (z, dOtv, pz, po, jm) => {
      const oz = ozubeni(p, z);
      if (z < prof.zmin) add('varovani', `${jm}: ${z} zubů je pod doporučeným minimem ${prof.zmin} pro ${prof.nazev} – řemen se víc ohýbá a rychleji opotřebí.`, [pz]);
      if (oz.mustek <= 0.02) add('chyba', `${jm}: drážky se překrývají (hlava zubu ${fmt(oz.mustek, 2)} mm) – zmenšete kompenzaci drážky nebo přidejte zuby.`, ['komp.drazka', pz]);
      else if (oz.mustek < 0.3) add('varovani', `${jm}: hlava zubu je jen ${fmt(oz.mustek, 2)} mm – tryska 0,4 mm ji nevytiskne přesně.`, ['komp.drazka', pz]);
      const ot = otvor(p, dOtv);
      if (ot.chyba) add('chyba', `${jm}: ${ot.chyba}.`, [po, 'otvor.typ']);
      if (p.otvor.typ === 'd' && p.otvor.plocha >= dOtv / 2) add('chyba', `${jm}: plocha D-hřídele ${fmt(p.otvor.plocha, 2)} mm je větší než poloměr hřídele.`, ['otvor.plocha']);
      const stena = oz.Rpata - ot.rMax;
      if (stena < 1) add('chyba', `${jm}: stěna mezi otvorem a patou zubů je ${fmt(stena, 2)} mm (min. 1 mm).`, [po, pz]);
      else if (stena < 1.6) add('varovani', `${jm}: tenká stěna mezi otvorem a patou zubů (${fmt(stena, 2)} mm).`, [po, pz]);
      if (p.naboj.pouzit) {
        const stN = p.naboj.prumer / 2 - ot.rMax;
        if (stN < 1.2) add('chyba', `${jm}: stěna náboje je ${fmt(stN, 2)} mm – zvětšete průměr náboje.`, ['naboj.prumer', po]);
        if (p.naboj.sroubu > 0 && p.naboj.matice) {
          const m = matice(p, ot);
          if (m.stenaVnitrni < 0.6 || m.stenaVnejsi < 0.6) {
            const potreba = Math.ceil((ot.r + m.m + 1.6) * 2);
            add('chyba', `${jm}: kapsa na matici M3 se do náboje nevejde (stěny ${fmt(m.stenaVnitrni, 2)} / ${fmt(m.stenaVnejsi, 2)} mm) – náboj aspoň ⌀ ${potreba} mm.`,
              ['naboj.prumer'], { text: `náboj ⌀ ${potreba} mm`, pole: 'naboj.prumer', hodnota: potreba });
          }
          if (m.zs < 2) {
            const potreba = Math.ceil(m.e / 2 + 2.4);
            add('chyba', `${jm}: náboj je nízký pro matici M3 (šroub by byl ${fmt(m.zs, 2)} mm nad podložkou).`, ['naboj.vyska'], { text: `výška ${potreba} mm`, pole: 'naboj.vyska', hodnota: potreba });
          }
        } else if (p.naboj.sroubu > 0 && p.naboj.prumer / 2 - ot.r < 3) add('varovani', `${jm}: závit M3 přímo v plastu potřebuje aspoň 3 mm materiálu – zapněte kapsu na matici.`, ['naboj.matice']);
        const v = vrstvy(p, oz);
        if (!v.dolni && p.naboj.prumer / 2 > oz.Rpata) add('info', `${jm}: náboj je širší než pata zubů a bez dolní příruby funguje jako příruba.`, ['priruby.typ']);
      }
      return oz;
    };
    let oz1 = null, oz2 = null;
    if (d.r1 || d.r2) oz1 = kontrolaRemenice(p.z1, p.otvor.prumer, 'z1', 'otvor.prumer', 'Řemenice 1');
    if (d.r2) oz2 = kontrolaRemenice(p.pohon.z2, p.pohon.otvor2, 'pohon.z2', 'pohon.otvor2', 'Řemenice 2');
    if (d.r1 || d.r2 || d.kladka) {
      const pr = p.priruby;
      if (pr.typ === 'zadna') add('info', 'Bez přírub řemen vede jen zarovnání os – na hnané i hnací řemenici je dobré mít aspoň jednu přírubu.', ['priruby.typ']);
      else if (pr.presah < 0.6 * prof.H) add('varovani', `Příruba přesahuje hlavu zubu jen o ${fmt(pr.presah, 2)} mm, řemen ${prof.nazev} je silný ${fmt(prof.H, 2)} mm – může přes ni sjet (doporučeno aspoň ${fmt(0.6 * prof.H, 1)} mm).`,
        ['priruby.presah'], { text: `přesah ${fmt(Math.ceil(prof.H * 6) / 10)} mm`, pole: 'priruby.presah', hodnota: Math.ceil(prof.H * 6) / 10 });
      if (pr.typ === 'obe' && pr.ukos < 40) add('varovani', `Horní příruba má úkos ${fmt(pr.ukos, 0)}° – převis nad ozubením se bez podpor nevytiskne čistě (doporučeno 45°).`,
        ['priruby.ukos'], { text: 'úkos 45°', pole: 'priruby.ukos', hodnota: 45 });
      if (!prof.sirky.includes(p.sirkaRemene)) add('info', `Šířka řemene ${fmt(p.sirkaRemene)} mm není běžná pro ${prof.nazev} (běžné: ${prof.sirky.map(x => fmt(x)).join(', ')} mm).`, ['sirkaRemene']);
      if (p.vuleSirky < 0.3) add('varovani', 'Vůle na šířku řemene pod 0,3 mm – řemen bude o přírubu dřít.', ['vuleSirky']);
    }
    // pohon
    const po = pohon(p);
    if (!po.platne) add('chyba', p.pohon.rezim === 'L' ? `Řemen ${fmt(p.pohon.L)} mm je na tyto řemenice krátký.` : 'Osová vzdálenost je menší než rozdíl poloměrů řemenic.', [p.pohon.rezim === 'L' ? 'pohon.L' : 'pohon.C']);
    else {
      const ozA = ozubeni(p, p.z1), ozB = ozubeni(p, p.pohon.z2), vA = vrstvy(p, ozA), vB = vrstvy(p, ozB);
      const ra = vA.dolni ? vA.Rf : ozA.R, rb = vB.dolni ? vB.Rf : ozB.R;
      if (po.C < ra + rb + 0.5) add('chyba', `Řemenice se při osové vzdálenosti ${fmt(po.C)} mm překrývají (součet vnějších poloměrů ${fmt(ra + rb)} mm).`, [p.pohon.rezim === 'L' ? 'pohon.L' : 'pohon.C']);
      if (po.zubuVZaberu < 6) add('varovani', `V záběru na menší řemenici ${po.zubuVZaberu === 1 ? 'je jen 1 zub' : po.zubuVZaberu < 5 ? `jsou jen ${po.zubuVZaberu} zuby` : `je jen ${po.zubuVZaberu} zubů`} (doporučeno aspoň 6) – řemen může přeskakovat. Zvětšete menší řemenici nebo osovou vzdálenost.`,
        [p.z1 <= p.pohon.z2 ? 'z1' : 'pohon.z2', p.pohon.rezim === 'L' ? 'pohon.L' : 'pohon.C']);
      if (p.pohon.rezim === 'C' && Math.abs(po.N - Math.round(po.N)) > 0.02) add('info', `Délka řemene ${fmt(po.L, 2)} mm = ${fmt(po.N, 2)} zubů – uzavřený řemen má celý počet zubů, viz nejbližší délky v záložce Pohon.`, ['pohon.C']);
      if (p.pohon.rezim === 'L' && Math.abs(p.pohon.L / prof.p - Math.round(p.pohon.L / prof.p)) > 0.02) add('varovani', `Délka ${fmt(p.pohon.L, 2)} mm není násobkem rozteče ${fmt(prof.p, 3)} mm – uzavřený řemen takovou délku mít nemůže.`, ['pohon.L'],
        { text: `${Math.round(p.pohon.L / prof.p)} zubů = ${fmt(Math.round(p.pohon.L / prof.p) * prof.p, 2)} mm`, pole: 'pohon.L', hodnota: Math.round(p.pohon.L / prof.p) * prof.p });
    }
    // kladka
    if (d.kladka) {
      const k = kladka(p);
      if (k.stena < 0.8) add('chyba', `Kladka: stěna kolem ložiska ${p.kladka.lozisko} je ${fmt(k.stena, 2)} mm – zvětšete průměr kladky aspoň na ${fmt(Math.ceil(k.rSedlo * 2 + 2.4))} mm.`,
        ['kladka.prumer'], { text: `⌀ ${Math.ceil(k.rSedlo * 2 + 2.4)} mm`, pole: 'kladka.prumer', hodnota: Math.ceil(k.rSedlo * 2 + 2.4) });
      else if (k.stena < 1.2) add('varovani', `Kladka: tenká stěna kolem ložiska (${fmt(k.stena, 2)} mm).`, ['kladka.prumer']);
      if (k.delkaLozisek > k.H + 1e-9) add('chyba', `Kladka: ložiska (${p.kladka.pocet} × ${fmt(k.B)} mm) jsou delší než kladka (${fmt(k.H, 2)} mm).`, ['kladka.pocet', 'sirkaRemene']);
      else if (p.kladka.osazeni && k.H - k.delkaLozisek < 0.6) add('info', 'Kladka: na vnitřní osazení nezbývá místo (potřeba aspoň 0,6 mm) – ložiska drží jen nalisováním.', ['kladka.osazeni']);
      if (p.kladka.vule < 0) add('info', 'Kladka: záporná vůle = nalisování; tištěný otvor bývá menší, ověřte zkušebním kusem.', ['kladka.vule']);
    }
    // napínák
    if (d.napinak) {
      const n = p.napinak, dm = Math.max(n.cep, n.osa);
      if (n.sirka - dm < 3) add('chyba', `Napínák: šířka ${fmt(n.sirka)} mm nechá kolem otvoru ⌀ ${fmt(dm)} jen ${fmt((n.sirka - dm) / 2, 2)} mm stěny (min. 1,5 mm).`,
        ['napinak.sirka'], { text: `šířka ${fmt(Math.ceil(dm + 4))} mm`, pole: 'napinak.sirka', hodnota: Math.ceil(dm + 4) });
      if (n.delka - (n.cep + n.osa) / 2 < 2) add('chyba', `Napínák: otvory jsou příliš blízko (mezi nimi ${fmt(n.delka - (n.cep + n.osa) / 2, 2)} mm, min. 2 mm).`, ['napinak.delka']);
      if (n.tloustka < 3) add('varovani', 'Napínák: rameno tenčí než 3 mm se pod tahem řemene prohne.', ['napinak.tloustka']);
      const [dl] = LOZISKA[p.kladka.lozisko];
      if (Math.abs(n.osa - dl) > 0.6 || n.osa < dl) add('info', `Napínák: otvor osy ${fmt(n.osa, 2)} mm neodpovídá ložisku ${p.kladka.lozisko} (vnitřní ⌀ ${fmt(dl)} mm).`, ['napinak.osa'],
        { text: `⌀ ${fmt(dl + 0.2, 1)} mm`, pole: 'napinak.osa', hodnota: dl + 0.2 });
    }
    if (sestava && sestava.chyba) add('chyba', 'Geometrie: ' + sestava.chyba, []);
    return { hlaseni: H, oz1, oz2, pohon: po };
  }

  /* ---------- tisk ---------- */
  /** Odhad pro plný díl (doporučená výplň řemenic 100 %): hmotnost, filament 1,75 mm, čas (hrubě). */
  function odhadTisku(objem, vyska, material) {
    const m = MATERIALY[material] || MATERIALY.PLA;
    const g = objem / 1000 * m.hustota;
    const delka = objem / (Math.PI * 0.875 ** 2) / 1000;          // m
    const min = objem / 5 / 60 + vyska / 0.2 * 2.5 / 60;            // 5 mm³/s + výměna vrstvy 2,5 s
    return { g, delka, min };
  }
  /** Rozmístění dílů na podložce vedle sebe (z ≥ 0, mezera 6 mm). */
  function rozmisti(dily, mezera = 6) {
    const obal = poz => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) { const v = poz[i + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; } return b; };
    const out = []; let x = 0;
    for (const d of dily) {
      const b = obal(d.poz), poz = new Float32Array(d.poz.length);
      for (let i = 0; i < poz.length; i += 3) { poz[i] = d.poz[i] - b[0] + x; poz[i + 1] = d.poz[i + 1] - (b[1] + b[4]) / 2; poz[i + 2] = d.poz[i + 2] - b[2]; }
      out.push(Object.assign({}, d, { poz }));
      x += b[3] - b[0] + mezera;
    }
    const sir = x - mezera;
    for (const d of out) for (let i = 0; i < d.poz.length; i += 3) d.poz[i] -= sir / 2;
    return out;
  }

  function ulozProjekt(p) { return JSON.stringify({ format: 'webapp_remenice', verze: VERZE_FORMATU, projekt: p }, null, 2); }
  function nactiProjekt(text) {
    let o; try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON.'); }
    if (!o || o.format !== 'webapp_remenice') throw new Error('Soubor není projekt řemenice (chybí "format": "webapp_remenice").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }

  const API = {
    PROFILY, LOZISKA, PERA, MATICE_M3, MATERIALY, VYCHOZI, ROZSAHY, VERZE_FORMATU,
    kopie, vezmi, poloz, cislo, fmt, normalizuj,
    roztecny, delkaRemene, osovaVzdalenost, opasani, pohon,
    pulDrazky, profilDrazky, ozubeni, obrysOzubeni, vrstvy, otvor, matice, kladka,
    kontroly, odhadTisku, rozmisti, ulozProjekt, nactiProjekt,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.REMENICE = API;
})();
