/* Šnekový převod – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Šnek (archimedovský, ZA – v osovém řezu přímé boky s úhlem záběru α) a šnekové kolo pro 3D tisk,
   volitelně držák se dvěma ložisky šneku a jedním ložiskem kola a kalibrační vzorek záběru (hřebínek + výseč kola).

   Souřadnice sestavy: osa kola = Z, střední rovina kola z = 0, šnek leží v ose X ve vzdálenosti a (rozteč os) na +Y.
   Místní soustava šneku (u, v, w): osa w = osa šneku, úhel ϕ = atan2(v, u) se měří od směru ke kolu.
   Převod do sestavy: x = w − wc, y = a − u, z = −v  (vlastní otočení, ne zrcadlo).

   Šnek: závit = lichoběžník v osovém řezu (rozteč px = π·m, tloušťka na roztečné přímce px/2 − j/2),
   příčný řez je archimedovská spirála, těleso = zkroucený výtah (CrossSection.extrude s twistem) seříznutý kužely 45°.

   Kolo se GENERUJE odvalováním: v každém vodorovném řezu z se kolo pootočí o φ, šnek-nástroj se posune o r2·φ
   (nástroj = šnek se závitem tlustším o j/2 a hlavou delší o hlavovou vůli c) a z kola se odebere vše, kam nástroj
   v některé poloze sáhne. Obrys řezu r(θ) = nejmenší poloměr na paprsku θ, kam nástroj sáhne (hvězdicový obrys:
   kde by vznikl podřez, odebere se víc – nikdy méně, takže šnek do kola nikdy nevnikne).
     • globoidní kolo: polotovar s hrdlem (anuloid kolem osy šneku), nástroj = skutečný šnek → zub objímá šnek,
       styk po čáře, větší únosnost. Horní polovina hrdla se rozšiřuje – u celého kola je seříznutá na úhel převisu.
     • válcové kolo: válcový polotovar, nástroj = hřeben (osový řez šneku) se sklonem γ ∪ skutečný šnek
       → evolventní šikmé zuby (β = γ), bodový styk, snese posun šneku v ose; nejjednodušší tisk.
   Zub v každém řezu se počítá jen pro jednu rozteč (všechny zuby jsou stejné), řezy se spojí do sítě a manifold
   pak odečte díru, náboj, stavěcí šroub a dělí kolo na půlky. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const ZG = uzel ? require('../ibc/geometrie.js') : window.IBC_GEOM;   // zavitovaTyc (vnitřní závit v náboji)
  const fmt = G.fmt, kopie = G.kopie;
  const PI = Math.PI, rad = s => s * PI / 180, deg = r => r * 180 / PI;

  /* ---------------- tabulky ---------------- */
  /** mu = součinitel tření suchého kluzného páru téhož materiálu, sigma = dovolené ohybové napětí tištěného zubu (MPa).
      Typické hodnoty z literatury a tabulek výrobců filamentů (11/2026) – ověřit zkouškou. */
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24, mu: 0.3, sigma: 15 },
    PETG: { nazev: 'PETG', hustota: 1.27, mu: 0.25, sigma: 12 },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, mu: 0.2, sigma: 15 },
    ABS: { nazev: 'ABS', hustota: 1.04, mu: 0.3, sigma: 12 },
    ASA: { nazev: 'ASA', hustota: 1.07, mu: 0.3, sigma: 12 },
  };
  /** Kuličková ložiska řady 6xx (ISO 15): d × D × B. */
  const LOZISKA = {
    623: { d: 3, D: 10, B: 4 }, 625: { d: 5, D: 16, B: 5 }, 688: { d: 8, D: 16, B: 5 },
    608: { d: 8, D: 22, B: 7 }, 6000: { d: 10, D: 26, B: 8 }, 6001: { d: 12, D: 28, B: 8 },
  };
  /** Metrické závity a matice ISO 4032: d, stoupání p, klíč s, výška matice mH. */
  const ZAVITY = {
    M3: { d: 3, p: 0.5, s: 5.5, mH: 2.4 }, M4: { d: 4, p: 0.7, s: 7, mH: 3.2 }, M5: { d: 5, p: 0.8, s: 8, mH: 4.7 },
    M6: { d: 6, p: 1, s: 10, mH: 5.2 }, M8: { d: 8, p: 1.25, s: 13, mH: 6.8 }, M10: { d: 10, p: 1.5, s: 16, mH: 8.4 }, M12: { d: 12, p: 1.75, s: 18, mH: 10.8 },
  };
  /** Pera DIN 6885: od průměru hřídele d → šířka b, hloubka drážky v náboji t2 (stejná tabulka jako ozubena_kola). */
  const PERA = [[6, 2, 1.0], [8, 3, 1.4], [10, 4, 1.8], [12, 5, 2.3], [17, 6, 2.8], [22, 8, 3.3], [30, 10, 3.3], [38, 12, 3.3], [44, 14, 3.8], [50, 16, 4.3]];
  const pero = d => { let v = null; for (const [od, b, t2] of PERA) if (d >= od) v = { b, t2 }; return v; };

  const NAZVY = {
    druh: { globoidni: 'globoidní kolo', valcove: 'válcové kolo se šikmými zuby' },
    dira: { kruh: 'kruhová díra', D: 'díra s ploškou (D)', sestihran: 'šestihran', pero: 'drážka pro pero', zavit: 'závitová díra' },
    ulozeni: { cepy: 'ložiskové čepy', dira: 'průchozí díra na hřídel' },
    poloha: { auto: 'automaticky', nastojato: 'nastojato', pulky: 'na boku – dvě půlky' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Šnekový převod', diry: 'kapka',
    zaber: { modul: 1.5, chodu: 1, zubu: 30, q: 10, uhel: 20, smer: 'pravy', vule: 0.15, hlavova: 0.25, roztec: 0 },
    kolo: {
      druh: 'globoidni', sirka: 0, pulky: false, kolicku: 3,
      naboj: 9, nabojD: 0, stavaci: true, sroub: 'M3',
      dira: { typ: 'D', prumer: 8, plocha: 7, zavit: 'M8' },
    },
    snek: { delka: 0, ulozeni: 'dira', cep: 5, cepDelka: 9, poloha: 'auto', dira: { typ: 'D', prumer: 5, plocha: 4.5, zavit: 'M5' } },
    skrin: { zapnuto: false, loziskoSnek: '625', loziskoKolo: '608', deska: 9, stena: 3, mezera: 1, vule: 0.1 },
    vypocet: { otacky: 1500, moment: 0.05, matSnek: 'PETG', matKolo: 'PETG', mazani: true, treni: 0 },
    tisk: { uhel: 45, vule: 0.15, kolicek: 1.75, kusu: 1, krok: 0.1, kalibrace: false },
  };
  const MEZE = {
    'zaber.modul': [0.5, 6], 'zaber.chodu': [1, 4, true], 'zaber.zubu': [10, 120, true], 'zaber.q': [5, 20], 'zaber.uhel': [14.5, 30],
    'zaber.vule': [0, 1], 'zaber.hlavova': [0.1, 0.4], 'zaber.roztec': [0, 600],
    'kolo.sirka': [0, 120], 'kolo.kolicku': [0, 6, true], 'kolo.naboj': [0, 40], 'kolo.nabojD': [0, 200],
    'kolo.dira.prumer': [1, 80], 'kolo.dira.plocha': [0.5, 80],
    'snek.delka': [0, 400], 'snek.cep': [2, 40], 'snek.cepDelka': [2, 40], 'snek.dira.prumer': [1, 60], 'snek.dira.plocha': [0.5, 60],
    'skrin.deska': [3, 25], 'skrin.stena': [1.6, 10], 'skrin.mezera': [0.3, 5], 'skrin.vule': [0, 0.5],
    'vypocet.otacky': [1, 30000], 'vypocet.moment': [0, 200], 'vypocet.treni': [0, 1],
    'tisk.uhel': [30, 70], 'tisk.vule': [0, 1], 'tisk.kolicek': [1, 6], 'tisk.kusu': [1, 10, true], 'tisk.krok': [0.02, 0.5],
  };
  const DIRY = ['kruh', 'D', 'sestihran', 'pero', 'zavit'];
  const VYCTY = {
    diry: ['kapka', 'kruh'], 'zaber.smer': ['pravy', 'levy'], 'kolo.druh': ['globoidni', 'valcove'], 'kolo.sroub': ['M3', 'M4', 'M5'],
    'kolo.dira.typ': DIRY, 'kolo.dira.zavit': Object.keys(ZAVITY), 'snek.dira.typ': DIRY.slice(0, 4), 'snek.dira.zavit': Object.keys(ZAVITY),
    'snek.ulozeni': ['cepy', 'dira'], 'snek.poloha': ['auto', 'nastojato', 'pulky'],
    'skrin.loziskoSnek': Object.keys(LOZISKA), 'skrin.loziskoKolo': Object.keys(LOZISKA),
    'vypocet.matSnek': Object.keys(MATERIALY), 'vypocet.matKolo': Object.keys(MATERIALY),
  };

  const PREDVOLBY = [
    { id: 'm15', nazev: 'Převod 1 : 30, modul 1,5', popis: 'globoidní kolo s nábojem a stavěcím šroubem, šnek na hřídel D 5 mm', p: {} },
    { id: 'motor', nazev: 'Malý motor 1 : 20, modul 1', popis: 'šnek na hřídel D 3 mm (převodový motorek), kolo na hřídel 4 mm',
      p: { nazev: 'Motorek 1 : 20', zaber: { modul: 1, zubu: 20, q: 10, vule: 0.12 }, kolo: { naboj: 8, sroub: 'M3', dira: { typ: 'kruh', prumer: 4 } }, snek: { dira: { typ: 'D', prumer: 3, plocha: 2.5 } } } },
    { id: 'samosvorny', nazev: 'Samosvorný zvedák 1 : 40, modul 2', popis: 'jednochodý šnek s q = 12 – zátěž se sama nespustí; kolo na šestihran 10 mm',
      p: { nazev: 'Zvedák 1 : 40', zaber: { modul: 2, zubu: 40, q: 12, vule: 0.2 }, kolo: { naboj: 0, stavaci: false, dira: { typ: 'sestihran', prumer: 10 } },
        snek: { dira: { typ: 'sestihran', prumer: 6 } }, vypocet: { otacky: 300, moment: 0.3, mazani: false, matKolo: 'PETG', matSnek: 'PA' } } },
    { id: 'ctyrchody', nazev: 'Čtyřchodý 1 : 10 – vratný', popis: 'γ ≈ 22°, účinnost přes 70 %, kolo se dá roztočit zpět',
      p: { nazev: 'Čtyřchodý 1 : 10', zaber: { modul: 1.5, chodu: 4, zubu: 40, q: 10 }, kolo: { dira: { typ: 'kruh', prumer: 8 } } } },
    { id: 'valcove', nazev: 'Válcové kolo – nejsnazší tisk', popis: 'šikmé zuby β = γ, bodový styk, snese posun šneku v ose',
      p: { nazev: 'Válcové kolo 1 : 25', zaber: { zubu: 25 }, kolo: { druh: 'valcove', sirka: 8 } } },
    { id: 'drzak', nazev: 'S držákem a ložisky 625 / 608', popis: 'šnek na čepech Ø 5 v ložiskách 625, kolo na hřídeli 8 v ložisku 608',
      p: { nazev: 'Převod v držáku', zaber: { modul: 1.25, zubu: 30, q: 12 }, snek: { ulozeni: 'cepy', cep: 5, cepDelka: 9 },
        kolo: { naboj: 9, stavaci: true, dira: { typ: 'D', prumer: 8, plocha: 7 } }, skrin: { zapnuto: true, loziskoSnek: '625', loziskoKolo: '608' } } },
    { id: 'pulky', nazev: 'Velký převod z půlek, modul 3', popis: 'kolo i šnek z půlek spojených kolíčky z filamentu – bez převisů, plný tvar hrdla',
      p: { nazev: 'Velký převod 1 : 30', zaber: { modul: 3, zubu: 30, q: 9, vule: 0.25 }, kolo: { pulky: true, naboj: 0, stavaci: false, kolicku: 3, dira: { typ: 'pero', prumer: 12 } },
        snek: { poloha: 'pulky', ulozeni: 'dira', dira: { typ: 'kruh', prumer: 8 } } } },
  ];

  function normalizuj(v) { return G.normalizuj(v, { VYCHOZI, MEZE, VYCTY }); }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }

  /* ---------------- odvozené rozměry ---------------- */
  function odvozene(p) {
    const Z = p.zaber, m = Z.modul, z1 = Z.chodu, z2 = Z.zubu, q = Z.q, al = rad(Z.uhel), h = Z.smer === 'levy' ? -1 : 1;
    const px = PI * m, pz = z1 * px, k = pz / (2 * PI);
    const r1 = q * m / 2, r2 = z2 * m / 2, c = Z.hlavova * m, j = Z.vule;
    const ga = Math.atan(z1 / q);
    const a0 = r1 + r2, a = Z.roztec > 0 ? Z.roztec : a0, x2 = (a - a0) / m;
    const ra1 = r1 + m, rf1 = r1 - m - c, Rc = ra1 + c;
    const ra2 = a - r1 + m, rf2 = a - Rc, rt = a - ra2;                  // hrdlo kola, pata kola, poloměr hrdla
    const rRim = ra2 + 3 * m / (z1 + 2);                                    // vnější průměr kola dae2 = da2 + 6m/(z1+2)
    const b2 = p.kolo.sirka > 0 ? p.kolo.sirka : Math.round((z1 >= 4 ? 0.67 : 0.75) * 2 * ra1 * 2) / 2;
    const glob = p.kolo.druh === 'globoidni';
    // horní polovina hrdla se u celého kola rozšiřuje – seříznout na úhel převisu (půlky se tisknou obě zúženou stranou nahoru)
    const zc = p.kolo.pulky ? Infinity : rt * Math.sin(rad(p.tisk.uhel));
    function rPolotovar(z) {
      if (!glob) return ra2;
      const zz = Math.min(Math.abs(z), zc, rt * 0.999);
      return Math.min(rRim, a - Math.sqrt(rt * rt - zz * zz));
    }
    const wp = px / 2 - j / 2, wc = px / 2 + j / 2;                         // tloušťka závitu šneku / nástroje na roztečné přímce
    const ta = Math.tan(al);
    const hz = ra1 - rf1;                                                   // výška závitu
    const Lcalc = (z1 <= 2 ? 11 + 0.06 * z2 : 12.5 + 0.09 * z2) * m;        // potřebná délka závitu (Niemann / DIN 3975)
    const Lmin = 2 * Math.sqrt(Math.max(0, ra2 * ra2 - (a - ra1) ** 2));   // kde špičky kola protnou hlavovou přímku šneku
    const L1 = p.snek.delka > 0 ? p.snek.delka : Math.ceil(Math.max(Lcalc, Lmin + 1) + 2 * (hz + 0.6));
    const vule = p.tisk.vule;
    const dira = (d, typ) => typ === 'zavit' ? ZAVITY[d.zavit].d / 2 : typ === 'sestihran' ? (d.prumer + vule) / 2 / Math.cos(PI / 6)
      : typ === 'pero' && pero(d.prumer) ? Math.hypot((pero(d.prumer).b + vule) / 2, (d.prumer + vule) / 2 + pero(d.prumer).t2) : (d.prumer + vule) / 2;
    const rDiraKolo = dira(p.kolo.dira, p.kolo.dira.typ);
    const rDiraSnek = p.snek.ulozeni === 'dira' ? dira(p.snek.dira, p.snek.dira.typ) : 0;
    const pulkySnek = p.snek.poloha === 'pulky' || (p.snek.poloha === 'auto' && p.snek.ulozeni === 'dira' && 90 - Z.uhel > p.tisk.uhel && hz > 3);
    const naboj = p.kolo.pulky ? 0 : p.kolo.naboj;
    const mat = ZAVITY[p.kolo.sroub], stavaci = p.kolo.stavaci && p.kolo.dira.typ !== 'zavit';
    const rNaboj = p.kolo.nabojD > 0 ? p.kolo.nabojD / 2 : Math.min(rf2 - 1, Math.max(rDiraKolo + 4, rDiraKolo * 1.8,
      stavaci ? Math.max(rDiraKolo + mat.mH + vule + 2.5, Math.hypot(rDiraKolo + mat.mH + vule + 0.8, (mat.s + vule) / Math.cos(PI / 6) / 2) + 1) : 0));
    const kolickySnek = rf1 - rDiraSnek >= p.tisk.kolicek + p.tisk.vule + 1.6;
    const rRimSkut = rPolotovar(b2 / 2);                                     // skutečný největší poloměr kola
    return {
      m, z1, z2, q, al, h, px, pz, k, r1, r2, c, j, ga, a0, a, x2, ra1, rf1, Rc, ra2, rf2, rt, rRim, rRimSkut, b2, glob, zc, rPolotovar,
      wp, wc, ta, hz, Lcalc, L1, Lmin, rDiraKolo, rDiraSnek, pulkySnek, naboj, rNaboj, kolickySnek, i: z2 / z1,
    };
  }

  /* ---------------- obrys kola generovaný odvalováním ---------------- */
  /** Je bod (X, Y) řezu z uvnitř nástroje posunutého o s? (souřadnice sestavy) */
  function nastroj(o, valc) {
    const { a, Rc, rf1, r1, px, k, h, ta, wc } = o, hk = h * k, Rc2 = Rc * Rc;
    const uvnitr = (X, Y, z, s) => {
      const dy = a - Y, r2 = dy * dy + z * z;
      if (r2 <= Rc2) {
        if (r2 <= rf1 * rf1) return true;
        const rho = Math.sqrt(r2);
        let u = X - s - hk * Math.atan2(-z, dy);
        u -= px * Math.round(u / px);
        if (Math.abs(u) <= wc / 2 - (rho - r1) * ta) return true;
      }
      if (valc && dy <= Rc) {   // hřeben se sklonem γ (evolventní šikmé zuby)
        if (dy <= rf1) return true;
        let u = X - s + hk * z / r1;
        u -= px * Math.round(u / px);
        if (Math.abs(u) <= wc / 2 - (dy - r1) * ta) return true;
      }
      return false;
    };
    return uvnitr;
  }
  /** Obrys jedné rozteče kola v řezu z: r(θ_j), θ_j = j·τ/n (θ od +Y proti směru hodinových ručiček). */
  function rezKola(o, z, n) {
    const tau = 2 * PI / o.z2, dth = tau / n, rTop = o.rPolotovar(z);
    const uvnitr = nastroj(o, !o.glob);
    const yLo = o.glob ? o.a - Math.sqrt(Math.max(0, o.Rc * o.Rc - z * z)) : o.a - o.Rc;
    const B = Math.acos(Math.max(-1, Math.min(1, yLo / rTop))) + dth;
    const dr = o.m / 16, out = new Float64Array(n);
    for (let jj = 0; jj < n; jj++) {
      const th = jj * dth;
      let rmin = rTop;
      const i0 = Math.ceil((-B - th) / dth), i1 = Math.floor((B - th) / dth);
      for (let i = i0; i <= i1; i++) {
        const fi = i * dth, be = th + fi, sb = Math.sin(be), cb = Math.cos(be), s = -o.r2 * fi;
        if (cb <= 1e-6) continue;
        let r = Math.max(0, yLo / cb);
        if (r >= rmin) continue;
        let pred = r;
        while (r < rmin) {
          if (uvnitr(-r * sb, r * cb, z, s)) {
            let lo = pred, hi = r;
            if (hi > lo) for (let t = 0; t < 8; t++) { const md = (lo + hi) / 2; if (uvnitr(-md * sb, md * cb, z, s)) hi = md; else lo = md; }
            rmin = Math.min(rmin, hi);
            break;
          }
          pred = r; r += dr;
        }
      }
      out[jj] = rmin;
    }
    return out;
  }
  /** Hustota sítě kola: n bodů na rozteč, řezy po výšce (lichý počet – řez v z = 0 pro dělení na půlky). */
  function hustotaKola(o) {
    let Nz = Math.max(9, Math.min(61, Math.ceil(o.b2 / 0.5)));
    if (Nz % 2 === 0) Nz++;
    let n = Math.max(24, Math.min(56, Math.round(o.px / 0.1)));
    n = Math.max(14, Math.min(n, Math.floor(90000 / (o.z2 * Nz))));
    return { n, Nz };
  }
  let mezipamet = null;
  /** Řezy kola (s mezipamětí – výpočet trvá desetiny sekundy). → {n, Nz, zs[], rez[][]} */
  function rezyKola(o) {
    const { n, Nz } = hustotaKola(o);
    const klic = JSON.stringify([o.m, o.z1, o.z2, o.q, o.al, o.h, o.a, o.c, o.j, o.b2, o.glob, o.zc, n, Nz]);
    if (mezipamet && mezipamet.klic === klic) return mezipamet.v;
    const zs = [], rez = [];
    for (let i = 0; i < Nz; i++) { const z = -o.b2 / 2 + o.b2 * i / (Nz - 1); zs.push(z); rez.push(rezKola(o, z, n)); }
    const v = { n, Nz, zs, rez };
    mezipamet = { klic, v };
    return v;
  }
  /** Uzavřená síť věnce kola z řezů (boky + víčka vějířem ze středu). */
  function sitKola(o, R) {
    const { n, Nz, zs, rez } = R, z2 = o.z2, N = z2 * n, dth = 2 * PI / N;
    const P = new Float32Array((N * Nz + 2) * 3), I = [];
    for (let k = 0; k < Nz; k++) for (let j = 0; j < N; j++) {
      const r = rez[k][j % n], t = j * dth, v = 3 * (k * N + j);
      P[v] = -r * Math.sin(t); P[v + 1] = r * Math.cos(t); P[v + 2] = zs[k];
    }
    const C0 = N * Nz, C1 = C0 + 1;
    P[3 * C0 + 2] = zs[0]; P[3 * C1 + 2] = zs[Nz - 1];
    for (let k = 0; k < Nz - 1; k++) for (let j = 0; j < N; j++) {
      const a = k * N + j, b = k * N + (j + 1) % N, c = b + N, d = a + N;
      I.push(a, b, c, a, c, d);
    }
    for (let j = 0; j < N; j++) {
      I.push(C0, (j + 1) % N, j);
      I.push(C1, (Nz - 1) * N + j, (Nz - 1) * N + (j + 1) % N);
    }
    return { poz: P, idx: new Uint32Array(I) };
  }

  /* ---------------- šnek: příčný řez ---------------- */
  /** Poloměr závitu v osové poloze u (střed závitu u = 0), tloušťka na roztečné přímce w. */
  function profilSneku(o, u, w) {
    const uu = Math.abs(u - o.px * Math.round(u / o.px));
    return Math.max(o.rf1, Math.min(o.ra1, o.r1 + (w / 2 - uu) / o.ta));
  }
  /** Příčný řez šneku v rovině w = w0 (archimedovská spirála), body proti směru hodinových ručiček. */
  function rezSneku(o, w0) {
    const { h, k, px } = o, w = o.wp;
    const uT = w / 2 - (o.ra1 - o.r1) * o.ta, uR = w / 2 + (o.r1 - o.rf1) * o.ta;
    const fis = [];
    const Ns = Math.max(120, Math.ceil(2 * PI * o.ra1 / 0.5));
    for (let i = 0; i < Ns; i++) fis.push(2 * PI * i / Ns);
    // rohy lichoběžníku přesně: u = w0 − h·k·ϕ = n·px ± uT / uR
    for (let nn = Math.floor((w0 - o.pz) / px) - 1; nn <= Math.ceil((w0 + o.pz) / px) + 1; nn++) for (const du of [uT, -uT, uR, -uR]) {
      const fi = (w0 - (nn * px + du)) / (h * k);
      const f = ((fi % (2 * PI)) + 2 * PI) % (2 * PI);
      fis.push(f);
    }
    fis.sort((x, y) => x - y);
    const b = [];
    let posl = -1;
    for (const f of fis) {
      if (f - posl < 1e-5 || 2 * PI - f < 1e-5) continue;
      posl = f;
      const r = profilSneku(o, w0 - h * k * f, w);
      b.push([r * Math.cos(f), r * Math.sin(f)]);
    }
    return b;
  }

  /* ---------------- stavba přes manifold ---------------- */
  const segmenty = r => Math.max(24, Math.min(160, Math.ceil(2 * PI * r / 0.35 / 4) * 4));
  /** Matice 4×4 (po sloupcích) z obrazů os a posunu. */
  const mat = (ex, ey, ez, t = [0, 0, 0]) => [...ex, 0, ...ey, 0, ...ez, 0, ...t, 1];

  function postav(w, p, volby = {}) {
    const t0 = Date.now();
    const o = odvozene(p);
    const { Manifold: M, CrossSection: CS, Mesh } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const kruhDira = (r, x = 0, y = 0) => { const n = segmenty(r); return k(k(CS.circle(r / Math.cos(PI / n), n)).translate([x, y])); };
    const obdelnik = (x0, y0, x1, y1) => k(k(CS.square([x1 - x0, y1 - y0])).translate([x0, y0]));
    const plocha = b => { let s = 0; for (let i = 0, j = b.length - 1; i < b.length; j = i++) s += b[j][0] * b[i][1] - b[i][0] * b[j][1]; return s; };
    const poly = body => k(new CS([plocha(body) < 0 ? body.slice().reverse() : body], 'NonZero'));
    const vysun = (cs, za, zb) => k(k(cs.extrude(zb - za)).translate([0, 0, za]));
    const otoc = (profil, r) => k(poly(profil).revolve(segmenty(r)));
    /** Kapka (díra s hrotem 45° nahoru) v rovině XY – po otočení vodorovná díra bez převisu; p.diry = 'kruh' → kruhová díra. */
    const kapka = (r, x = 0, y = 0) => p.diry === 'kruh' ? kruhDira(r, x, y) : k(k(CS.hull([kruhDira(r), poly([[-0.01, r * Math.SQRT2], [0.01, r * Math.SQRT2], [0, r * Math.SQRT2 - 0.02]])])).translate([x, y]));
    /** Vodorovná díra v ose X: řez v rovině YZ (y, z), od x0 do x1. */
    const vodorovneX = (cs, x0, x1) => k(k(cs.extrude(x1 - x0)).transform(mat([0, 1, 0], [0, 0, 1], [1, 0, 0], [x0, 0, 0])));
    /** Díra hřídele jako 2D řez (střed v počátku). */
    function diraCS(d, typ) {
      const v = p.tisk.vule, R = (d.prumer + v) / 2;
      if (typ === 'sestihran') {
        const Rv = R / Math.cos(PI / 6), b = [];
        for (let i = 0; i < 6; i++) b.push([Rv * Math.cos(PI / 6 + i * PI / 3), Rv * Math.sin(PI / 6 + i * PI / 3)]);
        return poly(b);
      }
      if (typ === 'D') {
        const f = Math.min(R - 0.2, d.plocha + v - R);   // ploška ve vzdálenosti f od osy (+Y), přes plošku = plocha + vůle
        return k(kruhDira(R).intersect(obdelnik(-R - 1, -R - 1, R + 1, f)));
      }
      if (typ === 'pero') {
        const pr = pero(d.prumer);
        if (pr) return k(kruhDira(R).add(obdelnik(-(pr.b + v) / 2, 0, (pr.b + v) / 2, R + pr.t2)));
      }
      if (typ === 'zavit') { const z = ZAVITY[d.zavit]; return kruhDira(z.d / 2 + v / 2 - 0.6 * z.p); }
      return kruhDira(R);
    }
    /** Odečte díru hřídele (u závitu i závitovou tyč) v rozsahu z0..z1. */
    function odectiDiru(telo, d, typ, z0, z1) {
      let t = k(telo.subtract(vysun(diraCS(d, typ), z0 - 1, z1 + 1)));
      if (typ === 'zavit') {
        const z = ZAVITY[d.zavit], n = Math.max(48, Math.min(120, Math.ceil(2 * PI * z.d / 2 / 0.5 / 4) * 4));
        const tyc = k(k(ZG.zavitovaTyc(w, k, { p: z.p, h: 0.6 * z.p, bok: 30, rMaj: z.d / 2 + p.tisk.vule / 2 }, z1 - z0 + 2, n, null)).translate([0, 0, z0 - 1]));
        t = k(t.subtract(tyc));
      }
      return t;
    }

    try {
      /* ---------- kolo ---------- */
      const R = rezyKola(o), sk = sitKola(o, R);
      let kolo = k(new M(new Mesh({ numProp: 3, vertProperties: sk.poz, triVerts: sk.idx })));
      if (kolo.status() !== 'NoError' || kolo.volume() <= 0) throw new Error('věnec kola se nepodařilo sestavit (' + kolo.status() + ')');
      const zH = o.b2 / 2, kd = p.kolo.dira;
      let zTop = zH;
      if (o.naboj > 0) {
        kolo = k(kolo.add(k(k(M.cylinder(o.naboj + 0.01, o.rNaboj, o.rNaboj, segmenty(o.rNaboj))).translate([0, 0, zH - 0.01]))));
        zTop = zH + o.naboj;
      }
      kolo = odectiDiru(kolo, kd, kd.typ, -zH, zTop);
      if (o.naboj > 0 && p.kolo.stavaci && kd.typ !== 'zavit') {
        const s = ZAVITY[p.kolo.sroub], v = p.tisk.vule, zs = zH + o.naboj / 2;
        const xn = o.rDiraKolo + 0.8 + (s.mH + v) / 2, e = (s.s + v) / Math.cos(PI / 6);
        const otvor = vodorovneX(kapka((s.d + 0.3) / 2, 0, zs), 0, o.rNaboj + 1);
        // matice plochami vodorovně (výška s), zasouvá se shora do štěrbiny šířky e
        const kapsa = k(k(M.cube([s.mH + v, e, zTop + 1 - (zs - (s.s + v) / 2)])).translate([xn - (s.mH + v) / 2, -e / 2, zs - (s.s + v) / 2]));
        kolo = k(kolo.subtract(otvor).subtract(kapsa));
      }
      if (p.kolo.pulky && p.kolo.kolicku > 0) {
        const rk = (o.rDiraKolo + o.rf2) / 2, rr = (p.tisk.kolicek + p.tisk.vule) / 2;
        for (let i = 0; i < p.kolo.kolicku; i++) {
          const u = 2 * PI * i / p.kolo.kolicku + (i === 0 ? rad(12) : 0);   // první kolíček pootočený – půlky nejdou složit špatně
          kolo = k(kolo.subtract(vysun(kruhDira(rr, -rk * Math.sin(u), rk * Math.cos(u)), -zH - 1, zH + 1)));
        }
      }
      const barvaKolo = '#E0A040', barvaSnek = '#4F86D9';
      const koloDily = p.kolo.pulky
        ? [sit(k, k(kolo.trimByPlane([0, 0, -1], 0)), 'kolo_dolni', 'Kolo – dolní půlka', barvaKolo, false),
          sit(k, k(kolo.trimByPlane([0, 0, 1], 0)), 'kolo_horni', 'Kolo – horní půlka', '#D08A2E', true)]
        : [sit(k, kolo, 'kolo', 'Šnekové kolo', barvaKolo, false)];

      /* ---------- šnek (místní soustava, osa Z) ---------- */
      const cepy = p.snek.ulozeni === 'cepy';
      const rc = p.snek.cep / 2, Jl = cepy ? p.snek.cepDelka : 0;
      const kuzel = cepy ? Math.max(0, o.rf1 - 0.3 - rc) : 0;
      const zt0 = Jl + kuzel, zt1 = zt0 + o.L1, Lw = zt1 + kuzel + Jl, wc = (zt0 + zt1) / 2;
      const twist = o.h * 360 * o.L1 / o.pz;
      const rez0 = rezSneku(o, zt0 - wc);
      let snek = k(k(poly(rez0).extrude(o.L1, Math.max(4, Math.ceil(Math.abs(twist) / 6)), twist)).translate([0, 0, zt0]));
      const Re = o.ra1 + 0.3, ch = Re - (o.rf1 - 0.3);
      snek = k(snek.intersect(otoc([[0, zt0], [o.rf1 - 0.3, zt0], [Re, zt0 + ch], [Re, zt1 - ch], [o.rf1 - 0.3, zt1], [0, zt1]], Re)));
      if (cepy) {
        const rk2 = o.rf1 - 0.3, pr = [[0, 0], [rc, 0], [rc, Jl], [rk2, zt0 + 0.3], [rk2, zt1 - 0.3], [rc, Lw - Jl], [rc, Lw], [0, Lw]];
        snek = k(snek.add(otoc(pr, rc + kuzel)));
      } else snek = odectiDiru(snek, p.snek.dira, p.snek.dira.typ, 0, Lw);
      let snekPulky = null;
      if (o.pulkySnek) {
        // dělení rovinou osy (v = 0); kolíčky kolmo na řez, nesouměrně (nejdou složit obráceně)
        const uh = (o.rDiraSnek + o.rf1) / 2, rr = (p.tisk.kolicek + p.tisk.vule) / 2, hl = Math.min(6, Math.sqrt(Math.max(0, o.rf1 * o.rf1 - uh * uh)) - 1);
        let s2 = snek;
        if (o.kolickySnek && hl > 0.8) for (const [u, z] of [[uh, zt0 + o.L1 * 0.25], [-uh, zt0 + o.L1 * 0.75]]) {
          const kol = k(k(M.cylinder(2 * hl, rr, rr, segmenty(rr))).transform(mat([1, 0, 0], [0, 0, 1], [0, -1, 0], [u, hl, z])));
          s2 = k(s2.subtract(kol));
        }
        const A = k(s2.trimByPlane([0, 1, 0], 0)), B = k(s2.trimByPlane([0, -1, 0], 0));
        snekPulky = [
          sit(k, k(A.transform(mat([1, 0, 0], [0, 0, 1], [0, -1, 0]))), 'snek_a', 'Šnek – půlka A', barvaSnek, false),
          sit(k, k(B.transform(mat([1, 0, 0], [0, 0, -1], [0, 1, 0]))), 'snek_b', 'Šnek – půlka B', '#3A6FBF', false),
        ];
      }
      const snekD = sit(k, snek, 'snek', 'Šnek', barvaSnek, false);

      /* ---------- držák ---------- */
      let skrin = null;
      if (p.skrin.zapnuto) skrin = sit(k, postavSkrin(), 'drzak', 'Držák', '#8A96A8', false);
      function postavSkrin() {
        const S = p.skrin, LS = LOZISKA[S.loziskoSnek], LK = LOZISKA[S.loziskoKolo], v = S.vule, st = S.stena;
        const g = odvozSkrin(p, o, Lw);
        const { zp0, zp1, xi, T, x0, x1, y0, y1 } = g;
        let d = k(k(M.cube([x1 - x0, y1 - y0, zp1 - zp0])).translate([x0, y0, zp0]));
        const yS0 = o.a - LS.D / 2 - st, yS1 = o.a + LS.D / 2 + st, zS1 = LS.D / 2 + st;
        for (const sg of [-1, 1]) {
          const xa = sg > 0 ? xi : -xi - T;
          d = k(d.add(k(k(M.cube([T, yS1 - yS0, zS1 - zp1 + 0.01])).translate([xa, yS0, zp1 - 0.01]))));
        }
        // ložiska šneku: kapsa od vnitřní stěny, za ní průchozí díra (kapky – vodorovná díra bez podpor)
        d = k(d.subtract(vodorovneX(kapka((LS.D + v) / 2, o.a, 0), xi - 0.01, xi + LS.B)));
        d = k(d.subtract(vodorovneX(kapka((LS.D + v) / 2, o.a, 0), -xi - LS.B, -xi + 0.01)));
        d = k(d.subtract(vodorovneX(kapka(LS.d / 2 + 1, o.a, 0), xi - 1, xi + T + 1)));
        d = k(d.subtract(vodorovneX(kapka(LS.d / 2 + 1, o.a, 0), -xi - T - 1, -xi + 1)));
        // ložisko kola: kapsa shora v desce, pod ní průchozí díra
        d = k(d.subtract(vysun(kruhDira((LK.D + v) / 2), zp1 - LK.B, zp1 + 1)));
        d = k(d.subtract(vysun(kruhDira(LK.d / 2 + 1), zp0 - 1, zp1)));
        // okno pod šnekem, když šnek sahá pod horní plochu desky
        if (g.okno) d = k(d.subtract(k(k(M.cube([2 * xi - 1, 2 * o.ra1 + 2, zp1 - zp0 + 2])).translate([-xi + 0.5, o.a - o.ra1 - 1, zp0 - 1]))));
        // upevňovací díry M4 v rozích křidélek
        for (const x of [x0 + 4.5, x1 - 4.5]) for (const y of [y0 + 4.5, y1 - 4.5]) d = k(d.subtract(vysun(kruhDira(2.2, x, y), zp0 - 1, zp1 + 1)));
        return d;
      }

      /* ---------- kalibrační vzorek ---------- */
      const kalibrace = volby.kalibrace ? postavKalibraci() : [];
      function postavKalibraci() {
        const n = R.n, iz = (R.Nz - 1) / 2, rz = R.rez[iz], tau = 2 * PI / o.z2, zubu = 4;
        const rIn = Math.max(2, o.rf2 - 5), b = [];
        const N = zubu * n;
        for (let j = 0; j <= N; j++) { const t = -zubu / 2 * tau + j * tau / n, r = rz[((j - zubu / 2 * n) % n + n) % n]; b.push([-r * Math.sin(t), r * Math.cos(t)]); }
        for (let j = 24; j >= 0; j--) { const t = -zubu / 2 * tau + zubu * tau * j / 24; b.push([-rIn * Math.sin(t), rIn * Math.cos(t)]); }
        const vysec = sit(k, vysun(poly(b), 0, 5), 'kal_kolo', 'Kalibrace – výseč kola', barvaKolo, false);
        const out = [vysec];
        for (let i = 0; i < 3; i++) {
          const sw = o.wp - (i - 1) * p.tisk.krok, zubuH = 5, hb = []; // hřebínek = osový řez šneku
          const x0 = -zubuH / 2 * o.px, y0 = o.rf1 - o.r1 - 4;
          const uT = sw / 2 - (o.ra1 - o.r1) * o.ta, uR = sw / 2 + (o.r1 - o.rf1) * o.ta;
          for (let t = 0; t < zubuH; t++) {
            const xc = x0 + (t + 0.5) * o.px;
            hb.push([xc - o.px / 2, o.rf1 - o.r1], [xc - uR, o.rf1 - o.r1], [xc - uT, o.ra1 - o.r1], [xc + uT, o.ra1 - o.r1], [xc + uR, o.rf1 - o.r1]);
          }
          hb.push([-x0, o.rf1 - o.r1], [-x0, y0]);
          for (let z = 0; z <= i; z++) { const xz = -x0 - 3 - 2.5 * z; hb.push([xz + 0.8, y0], [xz, y0 + 1.2], [xz - 0.8, y0]); }   // zářezy = číslo hřebínku
          hb.push([x0, y0]);
          out.push(sit(k, vysun(poly(hb), 0, 5), 'kal_hreben' + (i + 1), `Kalibrace – hřebínek ${i + 1} (vůle ${fmt(o.j + (i - 1) * p.tisk.krok, 2)} mm)`, barvaSnek, false));
        }
        return out;
      }

      const snekTisk = snekPulky || [snekD];
      const tisk = koloDily.concat(snekTisk, skrin ? [skrin] : []);
      return { kolo: koloDily, snek: snekD, snekPulky, skrin, kalibrace, tisk, Lw, wc, cepy, R, o, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  /** Rozměry držáku (sdílí stavba, kontroly i výkres). */
  function odvozSkrin(p, o, Lw) {
    const S = p.skrin, LS = LOZISKA[S.loziskoSnek], LK = LOZISKA[S.loziskoKolo], st = S.stena;
    const zp1 = -o.b2 / 2 - S.mezera, zp0 = zp1 - S.deska;
    const telo = p.snek.ulozeni === 'cepy' ? Lw - 2 * p.snek.cepDelka : Lw;
    const yStoj = o.a - LS.D / 2 - st;                                         // vnitřní hrana stojiny k ose kola
    const xKolo = Math.sqrt(Math.max(0, (o.rRimSkut + 1.5) ** 2 - yStoj * yStoj));
    const xi = Math.max(telo / 2 + 0.5, xKolo), T = LS.B + st;
    const cepChybi = p.snek.ulozeni === 'cepy' ? xi + LS.B - (telo / 2 + p.snek.cepDelka) : 0;   // o kolik čep nedosáhne přes ložisko
    const x0 = -Math.max(xi + T, LK.D / 2 + 2 * st) - 9, x1 = -x0;
    const y0 = -(LK.D / 2 + 2 * st) - 9, y1 = o.a + LS.D / 2 + st + 9;
    const okno = -o.ra1 < zp1 + 0.6;
    // nejbližší roh stojiny k ose kola
    const vzdStojina = Math.hypot(xi, o.a - LS.D / 2 - st);
    return { zp0, zp1, xi, T, x0, x1, y0, y1, okno, vzdStojina, LS, LK, cepChybi, telo };
  }

  /** Manifold → síť pro náhled a export (jako kloubova_hadice). */
  function sit(k, m0, jmeno, nazev, barva, otocit) {
    const m = k(m0.simplify(1e-4));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const teles = m.decompose().map(k).filter(x => x.volume() > 1e-3).length;
    return { jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles, barva, otocit };
  }

  /* ---------------- sestava (pootočení záběru) ---------------- */
  /** Úhel šneku (rad) k pootočení kola φ (rad): ψ = r2·φ / (h·k). */
  const uhelSneku = (o, fi) => o.r2 * fi / (o.h * o.k);
  /** Díly v sestavě: kolo pootočené o φ, šnek o odpovídající ψ (místní → sestava). */
  function sestava(model, fi = 0) {
    const o = model.o, ps = uhelSneku(o, fi), cs = Math.cos(ps), sn = Math.sin(ps), cf = Math.cos(fi), sf = Math.sin(fi);
    const out = [];
    for (const d of model.kolo) {   // půlky leží v sestavě na svém místě (otocit platí jen pro tisk)
      const P = new Float32Array(d.poz.length);
      for (let i = 0; i < P.length; i += 3) { const x = d.poz[i], y = d.poz[i + 1]; P[i] = cf * x - sf * y; P[i + 1] = sf * x + cf * y; P[i + 2] = d.poz[i + 2]; }
      out.push(Object.assign({}, d, { poz: P }));
    }
    const s = model.snek, P = new Float32Array(s.poz.length);
    for (let i = 0; i < P.length; i += 3) {
      const u0 = s.poz[i], v0 = s.poz[i + 1], w = s.poz[i + 2];
      const u = cs * u0 - sn * v0, v = sn * u0 + cs * v0;
      P[i] = w - model.wc; P[i + 1] = o.a - u; P[i + 2] = -v;
    }
    out.push(Object.assign({}, s, { poz: P }));
    if (model.skrin) out.push(model.skrin);
    return out;
  }

  /* ---------------- výpočty ---------------- */
  function vypocty(p, o) {
    const V = p.vypocet, MS = MATERIALY[V.matSnek], MK = MATERIALY[V.matKolo];
    const an = Math.atan(Math.tan(o.al) * Math.cos(o.ga));
    const mu = V.treni > 0 ? V.treni : (MS.mu + MK.mu) / 2 * (V.mazani ? 0.5 : 1);
    const rho = Math.atan(mu / Math.cos(an));
    const eta = Math.tan(o.ga) / Math.tan(o.ga + rho);
    const etaZpet = o.ga > rho ? Math.tan(o.ga - rho) / Math.tan(o.ga) : 0;
    const n2 = V.otacky / o.i, T2 = V.moment * o.i * eta;
    const P1 = V.moment * 2 * PI * V.otacky / 60, P2 = P1 * eta;
    const vs = PI * 2 * o.r1 * V.otacky / 60000 / Math.cos(o.ga);
    const Ft2 = 2000 * T2 / (2 * o.r2), Ft1 = 2000 * V.moment / (2 * o.r1), Fr = Ft2 * Math.tan(o.al);
    const y = Math.max(0.05, 0.154 - 0.912 / o.z2);   // Lewisův součinitel (α = 20°, plná výška zubu)
    const bEf = o.glob ? o.b2 : Math.min(o.b2, 2.5 * o.m);
    const sigma = Ft2 / (bEf * o.px * y);
    const S = sigma > 0 ? MK.sigma / sigma : Infinity;
    const z2min = 2 * (1 - o.x2) / Math.sin(o.al) ** 2;
    return { an, mu, rho, eta, etaZpet, samosvorny: o.ga <= rho, n2, T2, P1, P2, vs, Ft1, Ft2, Fr, sigma, S, bEf, z2min, y };
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p);
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = (pole, hodnota, text) => ({ text: text || `nastavit ${fmt(hodnota, 2)}`, pole, hodnota });
    if (Math.abs(o.x2) > 0.5) chyba(['zaber.roztec'], `Požadovaná rozteč os ${fmt(o.a, 2)} mm se od teoretické ${fmt(o.a0, 2)} mm liší o ${fmt(o.x2, 2)} modulu – posunutí profilu kola smí být nejvýš ±0,5.`, opr('zaber.roztec', 0, 'počítat rozteč z rozměrů'));
    else if (Math.abs(o.x2) > 1e-6) info(['zaber.roztec'], `Kolo má posunutý profil x₂ = ${fmt(o.x2, 3)} (rozteč ${fmt(o.a, 2)} místo ${fmt(o.a0, 2)} mm).`);
    if (o.wp / 2 - (o.ra1 - o.r1) * o.ta < 0.1 * o.m) chyba(['zaber.uhel', 'zaber.vule'], 'Závit šneku vyjde na hlavě špičatý – zmenšete úhel záběru nebo boční vůli.', opr('zaber.uhel', 20));
    if (o.j <= 0) var_(['zaber.vule'], 'Bez boční vůle se tištěný převod zadře – nastavte aspoň 0,1 mm.', opr('zaber.vule', 0.15));
    else if (o.j > 0.4 * o.m) var_(['zaber.vule'], `Boční vůle ${fmt(o.j, 2)} mm je na modul ${fmt(o.m, 2)} velká – převod bude „klepat“.`, opr('zaber.vule', Math.round(0.1 * o.m * 100) / 100 + 0.05));
    if (o.m < 0.8) var_(['zaber.modul'], `Modul ${fmt(o.m, 2)} je na tryskovou tiskárnu hodně jemný – zuby vytiskne jen tryska 0,25–0,3 mm (resin bez potíží).`);
    if (o.b2 / 2 >= 0.9 * o.Rc) chyba(['kolo.sirka'], `Kolo je široké ${fmt(o.b2)} mm – šnek ho obejme nejvýš do ${fmt(2 * 0.9 * o.Rc, 1)} mm.`, opr('kolo.sirka', 0, 'šířka automaticky'));
    else if (o.b2 < 2 * o.m) var_(['kolo.sirka'], `Kolo široké ${fmt(o.b2)} mm je na modul ${fmt(o.m, 2)} úzké – zub snese málo.`, opr('kolo.sirka', 0, 'šířka automaticky'));
    if (!o.glob && o.b2 > 2 * Math.sqrt(o.ra1 * o.ra1 - o.r1 * o.r1) + 1) info(['kolo.sirka', 'kolo.druh'], 'Válcové kolo se šnekem styká jen uprostřed šířky – širší kolo nepřidá únosnost, okraje zubů šnek jen obrousí.');
    const z2min = 2 * (1 - o.x2) / Math.sin(o.al) ** 2;
    if (o.z2 < z2min - 0.5) info(['zaber.zubu'], `${o.z2} zubů je pod mezí podřezání (≈ ${fmt(z2min, 1)}) – generátor zub u paty podřeže, zub je tam slabší. Pomůže větší úhel záběru nebo kladné posunutí (větší rozteč os).`);
    if (deg(o.ga) > 30) info(['zaber.chodu', 'zaber.q'], `Úhel stoupání ${fmt(deg(o.ga), 1)}° je velký – šnek tlačí kolo hodně do strany (osová síla), počítejte s axiálním ložiskem.`);
    if (o.L1 - 2 * (o.hz + 0.6) < o.Lmin - 0.05) var_(['snek.delka'], `Plný závit šneku (${fmt(o.L1 - 2 * (o.hz + 0.6), 1)} mm) nepokryje celý záběr – potřeba aspoň ${fmt(o.Lmin, 1)} mm.`, opr('snek.delka', 0, 'délka automaticky'));
    // šnek
    if (p.snek.ulozeni === 'dira') {
      const st = o.rf1 - o.rDiraSnek;
      if (st < 1.2) chyba(['snek.dira.prumer', 'zaber.q'], `Mezi dírou šneku a patou závitu zbývá ${fmt(st, 2)} mm – zmenšete díru nebo zvětšete součinitel q.`, opr('zaber.q', Math.ceil((2 * (o.rDiraSnek + 1.6) + 2 * o.m + 2 * o.c) / o.m * 2) / 2));
    } else {
      if (p.snek.cep / 2 > o.rf1 - 0.5) chyba(['snek.cep'], `Čep Ø ${fmt(p.snek.cep)} je silnější než pata závitu Ø ${fmt(2 * o.rf1, 1)}.`, opr('snek.cep', Math.floor(2 * (o.rf1 - 0.6))));
      if (o.pulkySnek) chyba(['snek.poloha', 'snek.ulozeni'], 'Šnek z půlek drží pohromadě jen na hřídeli – zvolte průchozí díru, nebo tisk nastojato.', opr('snek.ulozeni', 'dira', 'průchozí díra'));
    }
    if (o.pulkySnek && p.snek.ulozeni === 'dira' && !o.kolickySnek) info(['snek.poloha', 'tisk.kolicek'], 'Na kolíčky mezi dírou a patou závitu šneku není místo – půlky se jen nasadí na hřídel a slepí.');
    if (!o.pulkySnek && 90 - p.zaber.uhel > p.tisk.uhel)
      (o.hz > 3 ? var_ : info)(['snek.poloha'], `Šnek nastojato: spodní boky závitu převisají ${fmt(90 - p.zaber.uhel, 0)}° od svislice na šířku ${fmt(o.hz, 1)} mm` + (o.hz > 3 ? ' – vytiskněte ho na boku z půlek (průchozí díra), nebo s podporami.' : ' – tak krátký převis tiskárna zvládne bez podpor (boky mohou být mírně převěšené).'));
    // kolo
    const stKolo = o.rf2 - o.rDiraKolo;
    if (stKolo < Math.max(2, o.m)) chyba(['kolo.dira.prumer'], `Mezi dírou kola a patou zubů zbývá ${fmt(stKolo, 1)} mm – zmenšete díru nebo zvětšete kolo.`);
    if (o.naboj > 0) {
      if (o.rNaboj > o.rf2 - 0.5) chyba(['kolo.nabojD'], `Náboj Ø ${fmt(2 * o.rNaboj, 1)} je větší než pata zubů Ø ${fmt(2 * o.rf2, 1)}.`, opr('kolo.nabojD', 0, 'náboj automaticky'));
      if (o.rNaboj < o.rDiraKolo + 1.5) chyba(['kolo.nabojD'], `Náboj Ø ${fmt(2 * o.rNaboj, 1)} má kolem díry stěnu tenčí než 1,5 mm.`, opr('kolo.nabojD', 0, 'náboj automaticky'));
      if (p.kolo.stavaci && p.kolo.dira.typ !== 'zavit') {
        const s = ZAVITY[p.kolo.sroub], v = p.tisk.vule, e = (s.s + v) / Math.cos(PI / 6);
        if (o.naboj < s.s + v + 2) chyba(['kolo.naboj'], `Matice ${p.kolo.sroub} se do náboje vysokého ${fmt(o.naboj)} mm nevejde – potřeba aspoň ${fmt(s.s + v + 2, 1)} mm.`, opr('kolo.naboj', Math.ceil(s.s + v + 2)));
        const rPotreba = Math.max(o.rDiraKolo + s.mH + v + 2.4, Math.hypot(o.rDiraKolo + s.mH + v + 0.8, e / 2) + 0.8);
        if (o.rNaboj < rPotreba - 1e-6) chyba(['kolo.nabojD', 'kolo.sroub'], `Kapsa matice ${p.kolo.sroub} se mezi díru a obvod náboje nevejde – náboj aspoň Ø ${fmt(2 * rPotreba, 1)}.`, opr('kolo.nabojD', Math.ceil(2 * rPotreba)));
      }
    }
    if (p.kolo.pulky && p.kolo.naboj > 0) info(['kolo.naboj', 'kolo.pulky'], 'Kolo z půlek se tiskne bez náboje a stavěcího šroubu – na hřídeli ho drží tvar díry (D, šestihran, pero).');
    if (p.kolo.dira.typ === 'pero' && !pero(p.kolo.dira.prumer)) var_(['kolo.dira.prumer'], 'Pero se používá až od hřídele Ø 6 – díra bude kruhová.');
    if (p.kolo.dira.typ === 'zavit') info(['kolo.dira.typ'], `Vnitřní závit ${p.kolo.dira.zavit} se tiskne s vůlí ${fmt(p.tisk.vule, 2)} mm – u menších než M6 raději vyvrtat a vyřezat závitníkem.`);
    if (p.kolo.pulky && p.kolo.kolicku > 0) {
      const rk = (o.rDiraKolo + o.rf2) / 2;
      if (rk - o.rDiraKolo < (p.tisk.kolicek + p.tisk.vule) / 2 + 1) var_(['kolo.kolicku', 'tisk.kolicek'], 'Kolíčky půlek kola se mezi díru a paty zubů nevejdou.');
    }
    // držák
    if (p.skrin.zapnuto) {
      const g = odvozSkrin(p, o, delkaSneku(p, o));
      if (p.skrin.deska < g.LK.B + 1.2) chyba(['skrin.deska'], `Deska ${fmt(p.skrin.deska)} mm je na ložisko ${p.skrin.loziskoKolo} (šířka ${g.LK.B} mm) tenká.`, opr('skrin.deska', g.LK.B + 2));
      if (p.snek.ulozeni === 'cepy') {
        if (Math.abs(p.snek.cep - g.LS.d) > 0.01) var_(['snek.cep', 'skrin.loziskoSnek'], `Čep Ø ${fmt(p.snek.cep)} neodpovídá díře ložiska ${p.skrin.loziskoSnek} (Ø ${g.LS.d}).`, opr('snek.cep', g.LS.d));
        if (g.cepChybi > 1e-6) chyba(['snek.cepDelka'], `Stojiny musí stát ${fmt(g.xi, 1)} mm od středu (jinak se o ně otře kolo) – čep délky ${fmt(p.snek.cepDelka)} mm nedosáhne přes ložisko.`, opr('snek.cepDelka', Math.ceil(p.snek.cepDelka + g.cepChybi)));
      } else info(['skrin.loziskoSnek'], `Šnek na hřídeli Ø ${fmt(g.LS.d)} prochází oběma ložisky ${p.skrin.loziskoSnek}.`);
      if (Math.abs(p.kolo.dira.prumer - g.LK.d) > 0.01 && p.kolo.dira.typ !== 'zavit') info(['kolo.dira.prumer', 'skrin.loziskoKolo'], `Hřídel kola Ø ${fmt(p.kolo.dira.prumer)} vs. díra ložiska ${p.skrin.loziskoKolo} Ø ${g.LK.d} – hřídel s osazením, nebo jiné ložisko.`);
      if (g.okno) info(['skrin.mezera'], 'Šnek sahá pod horní plochu desky – deska má pod ním okno.');
    }
    const vodorovne = p.skrin.zapnuto || (!p.kolo.pulky && o.naboj > 0 && p.kolo.stavaci && p.kolo.dira.typ !== 'zavit');
    if (p.diry === 'kruh' && vodorovne) info([], 'Kruhové vodorovné díry mají převislý strop – tiskněte s podporami nebo zvolte kapku (👁 Zobrazení → 💧 Díry jako kapka).');
    return H;
  }
  /** Celková délka šneku (čepy + kužely + závit) – i bez stavby. */
  function delkaSneku(p, o) {
    const cepy = p.snek.ulozeni === 'cepy', kuzel = cepy ? Math.max(0, o.rf1 - 0.3 - p.snek.cep / 2) : 0;
    return o.L1 + 2 * kuzel + (cepy ? 2 * p.snek.cepDelka : 0);
  }

  /** Kontroly hotových sítí: těsnost/tělesa, převisy v tiskové poloze, špičaté zuby kola. */
  function kontrolyModelu(p, model) {
    const H = [], o = model.o;
    for (const d of model.tisk.concat(model.kalibrace)) {
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa.` });
    }
    // tloušťka hlavy zubu kola v řezu z = 0
    const R = model.R, rz = R.rez[(R.Nz - 1) / 2], rTop = o.rPolotovar(0);
    let n = 0; for (const r of rz) if (r >= rTop - 1e-3) n++;
    const hlava = n * 2 * PI / (o.z2 * R.n) * rTop;
    if (hlava < 0.15 * o.m) H.push({ uroven: 'varovani', pole: ['zaber.roztec', 'zaber.zubu'], text: `Zuby kola vycházejí na hlavě špičaté (ploška ${fmt(hlava, 2)} mm) – zmenšete posunutí profilu (rozteč os).` });
    return H;
  }
  /** Převisy dílu v tiskové poloze (mm²). */
  function rozborDilu(d, uhel) {
    const T = G.tiskoveRozlozeni([d], 1)[0];
    return G.rozborTisku(T, uhel);
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const o = odvozene(p);
    return `m ${fmt(o.m, 2)} · ${o.z1}chodý · ${o.z2} zubů (1 : ${fmt(o.i, 1)}) · ${NAZVY.druh[p.kolo.druh]} · a = ${fmt(o.a, 2)} mm`;
  }
  const TYP = 'snek';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Šnekového převodu');
  /** Náhodný, ale smysluplný převod (🎲). rnd = generátor 0–1. */
  function nahodny(p0, rnd = Math.random) {
    const vyber = a => a[Math.floor(rnd() * a.length)];
    const p = kopie(p0 || VYCHOZI);
    p.zaber.modul = vyber([0.8, 1, 1.25, 1.5, 2, 2.5, 3]);
    p.zaber.chodu = vyber([1, 1, 1, 2, 3, 4]);
    p.zaber.zubu = Math.round(16 + rnd() * 50);
    p.zaber.q = vyber([8, 9, 10, 11, 12, 14]);
    p.zaber.uhel = vyber([20, 20, 25]);
    p.zaber.smer = vyber(['pravy', 'levy']);
    p.zaber.roztec = 0;
    p.kolo.druh = vyber(['globoidni', 'valcove']);
    p.kolo.sirka = 0;
    p.kolo.pulky = rnd() < 0.25;
    p.snek.delka = 0;
    return normalizuj(p).p;
  }

  const API = {
    MATERIALY, LOZISKA, ZAVITY, PERA, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    normalizuj, predvolba, odvozene, nastroj, rezKola, rezyKola, sitKola, profilSneku, rezSneku, postav, sestava, uhelSneku,
    odvozSkrin, delkaSneku, vypocty, kontroly, kontrolyModelu, rozborDilu, pero,
    popis, ulozProjekt, nactiProjekt, nahodny, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt, segmenty,
  };
  if (uzel) module.exports = API; else window.SNEK = API;
})();
