/* ==JADRO== výpočetní logika stránky tarif_spot.html bez DOM (testuje _test/tarif_spot_test.js)
   Všechny ceny uvnitř jádra: Kč/MWh bez DPH (silová, distribuce, daně), měsíční platy Kč/měsíc bez DPH.
   Časové řady: { t: Float64Array (unix s, začátek intervalu), k: Int32Array (délka s), v: Float64Array }.
   Čas pro uživatele je vždy místní čas Europe/Prague (SEČ/SELČ podle pravidla EU). */
const TARIF = (function () {
  'use strict';

  /* ------------------------------------------------------------------
     Regulované ceny 2026 (bez DPH) – ruční data, stav k 13. 10. 2026
     ------------------------------------------------------------------ */
  const REG = {
    rok: 2026,
    stavK: '13. 10. 2026',
    zdroj: 'ERÚ: cenový výměr č. 14/2025 (distribuce, sítě NN – kategorie D), č. 13/2025 ve znění č. 15/2025 a 1/2026 (systémové služby, POZE, nesíťová infrastruktura); daň z elektřiny – zákon č. 261/2007 Sb.',
    url14: 'https://www.tzb-info.cz/download.py?file=docu/predpisy/download/CV14-2025.pdf',
    url13: 'https://www.tzb-info.cz/download.py?file=docu/predpisy/download/CV13-2025.pdf',
    urlPoze: 'https://eru.gov.cz/sites/default/files/obsah/prilohy/20251229tzzmenovycenovyvymer.docx',
    systemove: 164.24,   // Kč/MWh – cena za systémové služby (ČEPS)
    poze: 0,             // Kč/MWh – od 1. 1. 2026 hradí POZE stát (změnový výměr č. 15/2025)
    pozeJistic: 0,       // Kč/A/měsíc – dtto (původně 8,32)
    nesitova: 12.87,     // Kč/OM/měsíc – OTE 1,61 + 1,38, datové centrum 5,88, poplatek ERÚ 4,00
    dan: 28.30,          // Kč/MWh – daň z elektřiny
    dph: 21,             // %
    UZEMI: { CEZ: 'ČEZ Distribuce', EGD: 'EG.D', PRE: 'PREdistribuce' },
    // horní meze pásem jističe (3f); index 0 = do 3×10 A i 1f do 1×25 A
    PASMA3: [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160],
    sazby: {
      D01d: { nazev: 'D01d – jednotarif, malá spotřeba', ntHodin: 0, tdd: 'TDD4',
        vt: { CEZ: 2666.66, EGD: 2711.14, PRE: 1854.71 }, nt: null,
        jistic: { CEZ: [50, 79, 99, 124, 158, 198, 248, 312], EGD: [48, 77, 96, 120, 154, 192, 240, 302], PRE: [44, 70, 88, 110, 140, 175, 219, 276] },
        zaA3: { CEZ: 4.95, EGD: 4.8, PRE: 4.38 }, zaA1: { CEZ: 1.65, EGD: 1.6, PRE: 1.46 } },
      D02d: { nazev: 'D02d – jednotarif, střední spotřeba', ntHodin: 0, tdd: 'TDD4',
        vt: { CEZ: 2078.58, EGD: 2295.34, PRE: 1516.53 }, nt: null,
        jistic: { CEZ: [102, 164, 205, 256, 327, 409, 512, 644], EGD: [100, 160, 200, 250, 320, 400, 500, 629], PRE: [87, 139, 173, 217, 277, 347, 434, 546] },
        zaA3: { CEZ: 10.23, EGD: 9.99, PRE: 8.67 }, zaA1: { CEZ: 3.41, EGD: 3.33, PRE: 2.89 } },
      D25d: { nazev: 'D25d – NT 8 h, akumulace (ohřev vody)', ntHodin: 8, tdd: 'TDD5',
        vt: { CEZ: 2252.45, EGD: 2243.88, PRE: 1656.49 }, nt: { CEZ: 116.5, EGD: 224.3, PRE: 175.2 },
        jistic: { CEZ: [107, 172, 215, 269, 344, 430, 537, 677], EGD: [98, 157, 196, 245, 314, 392, 491, 618], PRE: [80, 128, 160, 200, 256, 320, 401, 505] },
        zaA3: { CEZ: 10.74, EGD: 9.81, PRE: 8.01 }, zaA1: { CEZ: 3.58, EGD: 3.27, PRE: 2.67 } },
      D26d: { nazev: 'D26d – NT 8 h, akumulační vytápění', ntHodin: 8, tdd: 'TDD5',
        vt: { CEZ: 1202.06, EGD: 1237.94, PRE: 1009.35 }, nt: { CEZ: 116.5, EGD: 224.3, PRE: 175.2 },
        jistic: { CEZ: [145, 231, 289, 362, 463, 578, 723, 911], EGD: [140, 223, 279, 349, 446, 558, 698, 879], PRE: [110, 175, 219, 274, 350, 438, 548, 690] },
        zaA3: { CEZ: 14.46, EGD: 13.95, PRE: 10.95 }, zaA1: { CEZ: 4.82, EGD: 4.65, PRE: 3.65 } },
      D27d: { nazev: 'D27d – NT 8 h, elektromobil (18–8 h)', ntHodin: 8, tdd: 'TDD5',
        vt: { CEZ: 2252.45, EGD: 2243.88, PRE: 1656.49 }, nt: { CEZ: 116.5, EGD: 224.3, PRE: 175.2 },
        jistic: { CEZ: [102, 163, 204, 255, 326, 408, 510, 643], EGD: [93, 149, 187, 233, 299, 373, 467, 588], PRE: [76, 122, 152, 191, 244, 305, 381, 480] },
        zaA3: { CEZ: 10.2, EGD: 9.33, PRE: 7.62 }, zaA1: { CEZ: 3.4, EGD: 3.11, PRE: 2.54 } },
      D35d: { nazev: 'D35d – NT 20 h, hybridní vytápění', ntHodin: 20, tdd: 'TDD6',
        vt: { CEZ: 754.77, EGD: 749.87, PRE: 421.52 }, nt: { CEZ: 116.5, EGD: 224.3, PRE: 175.2 },
        jistic: { CEZ: [222, 355, 444, 555, 710, 888, 1110, 1399], EGD: [190, 304, 380, 475, 608, 760, 950, 1196], PRE: [154, 246, 308, 385, 492, 616, 770, 970] },
        zaA3: { CEZ: 22.2, EGD: 18.99, PRE: 15.39 }, zaA1: { CEZ: 7.4, EGD: 6.33, PRE: 5.13 } },
      D45d: { nazev: 'D45d – NT 20 h, přímotopy', ntHodin: 20, tdd: 'TDD7',
        vt: { CEZ: 754.77, EGD: 749.87, PRE: 421.52 }, nt: { CEZ: 116.5, EGD: 224.3, PRE: 175.2 },
        jistic: { CEZ: [222, 355, 444, 555, 710, 888, 1110, 1399], EGD: [190, 304, 380, 475, 608, 760, 950, 1196], PRE: [154, 246, 308, 385, 492, 616, 770, 970] },
        zaA3: { CEZ: 22.2, EGD: 18.99, PRE: 15.39 }, zaA1: { CEZ: 7.4, EGD: 6.33, PRE: 5.13 } },
      D56d: { nazev: 'D56d – NT 20 h, tepelné čerpadlo', ntHodin: 20, tdd: 'TDD7',
        vt: { CEZ: 754.77, EGD: 749.87, PRE: 421.52 }, nt: { CEZ: 116.5, EGD: 224.3, PRE: 175.2 },
        jistic: { CEZ: [222, 355, 444, 555, 710, 888, 1110, 1399], EGD: [190, 304, 380, 475, 608, 760, 950, 1196], PRE: [154, 246, 308, 385, 492, 616, 770, 970] },
        zaA3: { CEZ: 22.2, EGD: 18.99, PRE: 15.39 }, zaA1: { CEZ: 7.4, EGD: 6.33, PRE: 5.13 } },
      D57d: { nazev: 'D57d – NT 20 h, vytápění (TČ, přímotop)', ntHodin: 20, tdd: 'TDD7',
        vt: { CEZ: 754.77, EGD: 749.87, PRE: 421.52 }, nt: { CEZ: 116.5, EGD: 224.3, PRE: 175.2 },
        jistic: { CEZ: [222, 355, 444, 555, 710, 896, 1289, 1949, 3093, 5335, 10471, 19598], EGD: [189, 302, 378, 473, 605, 764, 1098, 1619, 2631, 4839, 9074, 17889], PRE: [154, 246, 308, 385, 492, 622, 933, 1433, 2494, 4801, 9841, 20779] },
        zaA3: { CEZ: 122.49, EGD: 111.81, PRE: 129.87 }, zaA1: { CEZ: 40.83, EGD: 37.27, PRE: 43.29 } },
      D61d: { nazev: 'D61d – víkendová (NT pá 12 h – ne 22 h)', ntHodin: -1, tdd: 'TDD4',
        vt: { CEZ: 3306.67, EGD: 3367.23, PRE: 2343.05 }, nt: { CEZ: 116.5, EGD: 224.3, PRE: 175.2 },
        jistic: { CEZ: [89, 143, 179, 224, 286, 358, 447, 563], EGD: [90, 144, 179, 224, 287, 359, 449, 565], PRE: [64, 103, 128, 161, 205, 257, 321, 404] },
        zaA3: { CEZ: 8.94, EGD: 8.97, PRE: 6.42 }, zaA1: { CEZ: 2.98, EGD: 2.99, PRE: 2.14 } },
    },
    // TDD5 je krajový (HDO), výchozí kraj podle distributora
    TDD5_KRAJE: ['Jižní Čechy', 'Jižní Morava', 'Praha', 'Severní Čechy', 'Severní Morava', 'Střední Čechy', 'Východní Čechy', 'Západní Čechy'],
    TDD5_VYCHOZI: { CEZ: 'Střední Čechy', EGD: 'Jižní Morava', PRE: 'Praha' },
  };

  /* Typické (ilustrativní) časy NT – skutečné určuje distributor signálem HDO. */
  function vychoziNT(sazba) {
    const h = new Array(24).fill(false);
    const nastav = (od, do_) => { for (let i = od; i !== do_; i = (i + 1) % 24) h[i] = true; };
    switch (sazba) {
      case 'D25d': case 'D26d': nastav(0, 6); nastav(13, 15); break;          // 6 + 2 h
      case 'D27d': nastav(22, 6); break;                                    // 8 h v okně 18–8
      case 'D35d': case 'D45d': case 'D56d': case 'D57d':
        h.fill(true); [8, 11, 16, 19].forEach(i => { h[i] = false; }); break; // 20 h, VT nejvýš 1 h v kuse
      default: break;
    }
    return h;
  }

  /* Měsíční plat za jistič (Kč/měsíc bez DPH) podle cenového výměru: pásma, nad 3×63 A
     (u D57d nad 3×160 A) a nad 1×25 A cena za každý 1 A jmenovité hodnoty (zaokrouhleno nahoru). */
  function platJistic(sazba, uzemi, faze, ampery) {
    const s = REG.sazby[sazba]; if (!s) throw new Error('Neznámá sazba ' + sazba);
    const tab = s.jistic[uzemi]; if (!tab) throw new Error('Neznámé území ' + uzemi);
    const A = Math.ceil(ampery);
    if (!(A > 0)) throw new Error('Neplatná hodnota jističe');
    if (faze === 1) return A <= 25 ? tab[0] : s.zaA1[uzemi] * A;
    for (let i = 0; i < tab.length; i++) if (A <= REG.PASMA3[i]) return tab[i];
    return s.zaA3[uzemi] * A;
  }

  /* Regulované složky pro zvolenou sazbu/území/jistič; prepis = ruční hodnoty (stejné klíče). */
  function regulovaneCeny(sazba, uzemi, faze, ampery, prepis) {
    const s = REG.sazby[sazba];
    const r = {
      distVT: s.vt[uzemi], distNT: s.nt ? s.nt[uzemi] : s.vt[uzemi],
      jisticMes: platJistic(sazba, uzemi, faze, ampery),
      systemove: REG.systemove, poze: REG.poze, nesitovaMes: REG.nesitova, dan: REG.dan, dph: REG.dph,
      dvoutarif: !!s.nt,
    };
    if (prepis) for (const k of Object.keys(prepis)) if (k in r && typeof prepis[k] === 'number' && isFinite(prepis[k])) r[k] = prepis[k];
    return r;
  }

  /* ------------------------------------------------------------------
     Čas – Europe/Prague bez závislosti na Intl
     ------------------------------------------------------------------ */
  function posledniNedele(rok, mesic1) {           // unix s, 01:00 UTC poslední neděle měsíce
    const d = new Date(Date.UTC(rok, mesic1, 0));
    return Date.UTC(rok, mesic1 - 1, d.getUTCDate() - d.getUTCDay(), 1) / 1000;
  }
  const _dst = {};
  function offsetPraha(t) {
    const y = new Date(t * 1000).getUTCFullYear();
    let p = _dst[y]; if (!p) p = _dst[y] = [posledniNedele(y, 3), posledniNedele(y, 10)];
    return (t >= p[0] && t < p[1]) ? 7200 : 3600;
  }
  function mistni(t) {
    const o = offsetPraha(t), d = new Date((t + o) * 1000);
    return { r: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes(),
      dvt: (d.getUTCDay() + 6) % 7, letni: o === 7200 };
  }
  const dvoj = n => (n < 10 ? '0' : '') + n;
  const klicDne = (r, m, d) => r + '-' + dvoj(m + 1) + '-' + dvoj(d);
  const klicMesice = (r, m) => r + '-' + dvoj(m + 1);
  /* místní čas → unix; u dvojznačné hodiny (podzim) letni=true dá první výskyt (SELČ);
     neexistující čas (jarní posun) vrátí null */
  function zMistniho(r, m, d, h, min, letni) {
    const base = Date.UTC(r, m, d, h || 0, min || 0) / 1000;
    const a = base - 7200, b = base - 3600;
    const okA = offsetPraha(a) === 7200, okB = offsetPraha(b) === 3600;
    if (okA && okB) return letni === false ? b : a;
    if (okA) return a; if (okB) return b;
    return null;
  }
  const zacatekDne = (r, m, d) => zMistniho(r, m, d, 0, 0);
  function pricistDny(r, m, d, n) { const x = new Date(Date.UTC(r, m, d + n)); return [x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()]; }

  function velikonoce(r) {                         // Velikonoční neděle (gregoriánský kalendář)
    const a = r % 19, b = Math.floor(r / 100), c = r % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mes = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
    return [mes - 1, den];
  }
  const _svatky = {};
  function jeSvatek(r, m, d) {
    let s = _svatky[r];
    if (!s) {
      s = new Set(['0-1', '4-1', '4-8', '6-5', '6-6', '8-28', '9-28', '10-17', '11-24', '11-25', '11-26']);
      const [vm, vd] = velikonoce(r);
      const pa = pricistDny(r, vm, vd, -2), po = pricistDny(r, vm, vd, 1);
      s.add(pa[1] + '-' + pa[2]); s.add(po[1] + '-' + po[2]);
      _svatky[r] = s;
    }
    return s.has(m + '-' + d);
  }
  /* 1–5 = po–pá, 6 = sobota, 7 = neděle nebo státní svátek */
  function typDne(r, m, d) {
    if (jeSvatek(r, m, d)) return 7;
    return ((new Date(Date.UTC(r, m, d)).getUTCDay() + 6) % 7) + 1;
  }
  const tridaDne = t => (t <= 5 ? 1 : t);

  /* ------------------------------------------------------------------
     Časové řady
     ------------------------------------------------------------------ */
  function novaRada(n) { return { t: new Float64Array(n), k: new Int32Array(n), v: new Float64Array(n) }; }
  function radaZPoli(t, k, v) {
    const r = novaRada(t.length);
    for (let i = 0; i < t.length; i++) { r.t[i] = t[i]; r.k[i] = Array.isArray(k) ? k[i] : k; r.v[i] = v[i]; }
    return r;
  }
  function delka(r) { return r.t.length; }

  /* úseky {od, krok, ceny[]} (EUR/MWh) + denní kurzy → řada Kč/MWh (kurzy = null → ponechá EUR) */
  function radaZUseku(useky, kurzy) {
    let n = 0; useky.forEach(u => { n += u.ceny.length; });
    const r = novaRada(n);
    let i = 0, denKurz = null, kurz = 1;
    const kOd = kurzy ? Date.UTC(+kurzy.od.slice(0, 4), +kurzy.od.slice(5, 7) - 1, +kurzy.od.slice(8, 10)) / 86400000 : 0;
    for (const u of useky) {
      for (let j = 0; j < u.ceny.length; j++, i++) {
        const t = u.od + j * u.krok;
        r.t[i] = t; r.k[i] = u.krok;
        if (kurzy) {
          const m = mistni(t), den = Date.UTC(m.r, m.m, m.d) / 86400000;
          if (den !== denKurz) {
            denKurz = den;
            const idx = Math.min(kurzy.kurzy.length - 1, Math.max(0, den - kOd));
            kurz = kurzy.kurzy[idx] / 1000;
          }
        }
        r.v[i] = u.ceny[j] * kurz;
      }
    }
    return r;
  }

  /* spojí řady (seřazené, nepřekrývající se) do jedné */
  function spojRady(rady) {
    const n = rady.reduce((s, r) => s + r.t.length, 0), o = novaRada(n);
    let i = 0;
    rady.slice().sort((a, b) => (a.t[0] || 0) - (b.t[0] || 0)).forEach(r => { o.t.set(r.t, i); o.k.set(r.k, i); o.v.set(r.v, i); i += r.t.length; });
    return o;
  }

  /* index posledního intervalu s t_i <= t (binární hledání), −1 když žádný */
  function indexCasu(r, t) {
    let lo = 0, hi = r.t.length - 1, res = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (r.t[mid] <= t) { res = mid; lo = mid + 1; } else hi = mid - 1; }
    return res;
  }

  /* časově vážený průměr řady na intervalu [t, t+d); NaN, pokud není celý pokryt */
  function prumerNaIntervalu(r, t, d) {
    let i = indexCasu(r, t);
    if (i < 0) return NaN;
    let pokryto = 0, suma = 0, kon = t + d;
    for (; i < r.t.length && r.t[i] < kon; i++) {
      const a = Math.max(t, r.t[i]), b = Math.min(kon, r.t[i] + r.k[i]);
      if (b > a) { suma += r.v[i] * (b - a); pokryto += b - a; }
    }
    return pokryto >= d - 1e-6 ? suma / pokryto : NaN;
  }

  /* výřez [od, do) */
  function vyrez(r, od, do_) {
    let a = indexCasu(r, od); if (a < 0) a = 0; else if (r.t[a] + r.k[a] <= od) a++;
    let b = a; while (b < r.t.length && r.t[b] < do_) b++;
    return { t: r.t.slice(a, b), k: r.k.slice(a, b), v: r.v.slice(a, b) };
  }

  /* agregace na celé hodiny (hranice hodin UTC = hranice místních hodin);
     prumer=true → časově vážený průměr (ceny), false → součet (energie) */
  function naHodiny(r, prumer) {
    const tt = [], vv = [], pp = [];
    for (let i = 0; i < r.t.length; i++) {
      let zbyva = r.k[i], t = r.t[i];
      while (zbyva > 0) {
        const hod = Math.floor(t / 3600) * 3600, kus = Math.min(zbyva, hod + 3600 - t);
        const podil = kus / r.k[i];
        if (!tt.length || tt[tt.length - 1] !== hod) { tt.push(hod); vv.push(0); pp.push(0); }
        if (prumer) vv[vv.length - 1] += r.v[i] * kus; else vv[vv.length - 1] += r.v[i] * podil;
        pp[pp.length - 1] += kus;
        t += kus; zbyva -= kus;
      }
    }
    const o = novaRada(tt.length);
    for (let i = 0; i < tt.length; i++) { o.t[i] = tt[i]; o.k[i] = 3600; o.v[i] = prumer ? vv[i] / pp[i] : vv[i]; }
    return o;
  }

  /* součet řady spotřeby a (libovolný krok) a hodinových řad: plusHod se rozpustí do intervalů hodiny
     rovnoměrně, minusHod (vybití baterie) úměrně spotřebě v intervalech – nikdy nevznikne záporný interval */
  function prictiHodinovou(a, plusHod, minusHod) {
    const o = { t: a.t.slice(), k: a.k.slice(), v: a.v.slice() };
    const mapa = r => { const m = new Map(); if (r) for (let i = 0; i < r.t.length; i++) m.set(r.t[i], r.v[i]); return m; };
    const P = mapa(plusHod), M = mapa(minusHod);
    for (let i = 0; i < o.t.length;) {
      const hod = Math.floor(o.t[i] / 3600) * 3600;
      let j = i; while (j < o.t.length && Math.floor(o.t[j] / 3600) * 3600 === hod) j++;
      const plus = P.get(hod) || 0;
      if (plus) for (let x = i; x < j; x++) o.v[x] += plus * Math.min(o.k[x], 3600) / 3600;
      const minus = M.get(hod) || 0;
      if (minus > 0) {
        let s = 0; for (let x = i; x < j; x++) s += Math.max(0, o.v[x]);
        const f = s > 0 ? Math.min(1, minus / s) : 0;
        for (let x = i; x < j; x++) o.v[x] -= Math.max(0, o.v[x]) * f;
      }
      i = j;
    }
    return o;
  }

  function soucet(r) { let s = 0; for (let i = 0; i < r.v.length; i++) s += r.v[i]; return s; }

  /* ------------------------------------------------------------------
     Profil: mapa dnů a přenesení na jiné období
     ------------------------------------------------------------------ */
  /* klíč dne → Float64Array(slotu) energie na „nástěnný“ slot (NaN = chybí);
     u dvojité podzimní hodiny průměr výskytů, u částečného pokrytí přepočet na celý slot */
  function mapaDnu(r, slotu) {
    const krok = 86400 / slotu, mapa = new Map(), pokr = new Map();
    for (let i = 0; i < r.t.length; i++) {
      let t = r.t[i], zbyva = r.k[i];
      while (zbyva > 0) {
        const m = mistni(t), sek = m.h * 3600 + m.min * 60 + (t % 60);
        const slot = Math.floor(sek / krok), konecSlotu = t - (sek - slot * krok) + krok;
        const kus = Math.min(zbyva, konecSlotu - t);
        const kl = klicDne(m.r, m.m, m.d);
        let a = mapa.get(kl), p = pokr.get(kl);
        if (!a) { a = new Float64Array(slotu); p = new Float64Array(slotu); mapa.set(kl, a); pokr.set(kl, p); }
        a[slot] += r.v[i] * kus / r.k[i]; p[slot] += kus;
        t += kus; zbyva -= kus;
      }
    }
    for (const [kl, a] of mapa) {
      const p = pokr.get(kl);
      for (let s = 0; s < slotu; s++) a[s] = p[s] > 0 ? a[s] * krok / p[s] : NaN;
    }
    return mapa;
  }

  function doplnDen(a) {                            // lineární doplnění NaN uvnitř dne
    const n = a.length, o = Float64Array.from(a);
    const plne = []; for (let i = 0; i < n; i++) if (!isNaN(o[i])) plne.push(i);
    if (!plne.length) return null;
    for (let i = 0; i < n; i++) {
      if (!isNaN(o[i])) continue;
      let L = -1, R = -1;
      for (const j of plne) { if (j < i) L = j; else { R = j; break; } }
      o[i] = L < 0 ? o[R] : R < 0 ? o[L] : o[L] + (o[R] - o[L]) * (i - L) / (R - L);
    }
    return o;
  }

  /* najde zdrojový den pro cílové datum: stejné datum → stejný typ dne (±3 dny, preferuje bližší rok)
     → stejná třída (pracovní/so/ne) ±7 → libovolný ±14 → null */
  function najdiZdrojovyDen(mapa, roky, r, m, d) {
    const k0 = klicDne(r, m, d);
    if (mapa.has(k0)) return k0;
    const typ = typDne(r, m, d), tr = tridaDne(typ);
    const poradi = roky.slice().sort((a, b) => Math.abs(a - r) - Math.abs(b - r) || b - a);
    const posuny = [0]; for (let i = 1; i <= 14; i++) posuny.push(-i, i);
    for (const [limit, test] of [[3, (x) => x === typ], [7, (x) => tridaDne(x) === tr], [14, () => true]]) {
      for (const ys of poradi) {
        let dd = d; const maxD = new Date(Date.UTC(ys, m + 1, 0)).getUTCDate(); if (dd > maxD) dd = maxD;
        for (const p of posuny) {
          if (Math.abs(p) > limit) continue;
          const [yr, mr, dr] = pricistDny(ys, m, dd, p);
          const kl = klicDne(yr, mr, dr);
          if (mapa.has(kl) && test(typDne(yr, mr, dr))) return kl;
        }
      }
    }
    return null;
  }

  /* přenese profil (mapa dnů) na období [od, do) (unix, začátky místních dní); vrací řadu po slotech */
  function prenesProfil(mapa, slotu, od, do_) {
    const krok = 86400 / slotu;
    const roky = [...new Set([...mapa.keys()].map(k => +k.slice(0, 4)))];
    // průměrný den jako záchrana
    const prum = new Float64Array(slotu), poc = new Float64Array(slotu);
    for (const a of mapa.values()) for (let s = 0; s < slotu; s++) if (!isNaN(a[s])) { prum[s] += a[s]; poc[s]++; }
    for (let s = 0; s < slotu; s++) prum[s] = poc[s] ? prum[s] / poc[s] : 0;
    const doplnene = new Map();
    const tt = [], vv = [];
    let nahrazenych = 0, presnych = 0;
    let m0 = mistni(od);
    let [r, m, d] = [m0.r, m0.m, m0.d];
    for (let start = zacatekDne(r, m, d); start < do_;) {
      const [r2, m2, d2] = pricistDny(r, m, d, 1);
      const konec = zacatekDne(r2, m2, d2);
      const kl = najdiZdrojovyDen(mapa, roky, r, m, d);
      let a = null;
      if (kl) { a = doplnene.get(kl); if (!a) { a = doplnDen(mapa.get(kl)); doplnene.set(kl, a); } }
      if (!a) { a = prum; nahrazenych++; } else if (kl === klicDne(r, m, d)) presnych++;
      for (let t = start; t < konec; t += krok) {
        if (t < od || t >= do_) continue;
        const x = mistni(t), s = Math.floor((x.h * 3600 + x.min * 60) / krok);
        tt.push(t); vv.push(a[s]);
      }
      start = konec; [r, m, d] = [r2, m2, d2];
    }
    const o = radaZPoli(tt, krok, vv);
    o.info = { nahrazenych, presnych };
    return o;
  }

  /* ------------------------------------------------------------------
     NT (nízký tarif)
     ------------------------------------------------------------------ */
  /* plan: {typ:'zadne'} | {typ:'denni', h:[24× bool]} | {typ:'vikend'} (pá 12:00 – ne 22:00) */
  function jeNTFn(plan) {
    if (!plan || plan.typ === 'zadne') return () => false;
    if (plan.typ === 'vikend') return t => { const x = mistni(t); return (x.dvt === 4 && x.h >= 12) || x.dvt === 5 || (x.dvt === 6 && x.h < 22); };
    const h = plan.h;
    return t => !!h[mistni(t).h];
  }
  function planProSazbu(sazba, hodiny) {
    const s = REG.sazby[sazba];
    if (!s || !s.nt) return { typ: 'zadne' };
    if (s.ntHodin < 0) return { typ: 'vikend' };
    return { typ: 'denni', h: hodiny || vychoziNT(sazba) };
  }
  function rozdelVTNT(r, plan) {
    const nt = jeNTFn(plan); let vt = 0, n = 0;
    for (let i = 0; i < r.t.length; i++) { if (nt(r.t[i])) n += r.v[i]; else vt += r.v[i]; }
    return { vt, nt: n };
  }
  /* přeškáluje profil tak, aby součet ve VT = kwhVT a v NT = kwhNT (u jednotarifu celkem = kwhVT + kwhNT) */
  function skalujVTNT(r, plan, kwhVT, kwhNT) {
    const o = { t: r.t, k: r.k, v: new Float64Array(r.v.length) };
    const nt = jeNTFn(plan);
    if (!plan || plan.typ === 'zadne') {
      const s = soucet(r), f = s > 0 ? (kwhVT + kwhNT) / s : 0;
      for (let i = 0; i < r.v.length; i++) o.v[i] = r.v[i] * f;
      return o;
    }
    const z = rozdelVTNT(r, plan);
    if (kwhNT > 0 && !(z.nt > 0)) throw new Error('V zadaných časech NT není žádná hodina – nastavte časy NT.');
    if (kwhVT > 0 && !(z.vt > 0)) throw new Error('Celý den je NT, ale zadali jste spotřebu ve VT.');
    const fv = z.vt > 0 ? kwhVT / z.vt : 0, fn = z.nt > 0 ? kwhNT / z.nt : 0;
    for (let i = 0; i < r.v.length; i++) o.v[i] = r.v[i] * (nt(r.t[i]) ? fn : fv);
    return o;
  }

  /* ------------------------------------------------------------------
     Náklady
     ------------------------------------------------------------------ */
  function mesiceObdobi(od, do_) {                   // [{klic, r, m, od, do, podil}] – podíl kalendářního měsíce v období
    const out = []; const a = mistni(od);
    let r = a.r, m = a.m;
    for (;;) {
      const zac = zacatekDne(r, m, 1), [r2, m2] = m === 11 ? [r + 1, 0] : [r, m + 1], kon = zacatekDne(r2, m2, 1);
      if (zac >= do_) break;
      const x = Math.max(zac, od), y = Math.min(kon, do_);
      if (y > x) out.push({ klic: klicMesice(r, m), r, m, od: x, do: y, podil: (y - x) / (kon - zac) });
      r = r2; m = m2;
    }
    return out;
  }

  /* průměrné ceny po měsících: aritmetické (časově vážené) a vážené profilem vahy (řada) */
  function cenyMesicu(ceny, mesice, vahy) {
    return mesice.map(M => {
      const c = vyrez(ceny, M.od, M.do); let s = 0, p = 0;
      for (let i = 0; i < c.t.length; i++) { s += c.v[i] * c.k[i]; p += c.k[i]; }
      let vazena = NaN;
      if (vahy) {
        const w = vyrez(vahy, M.od, M.do); let sw = 0, sp = 0;
        for (let i = 0; i < w.t.length; i++) { const cena = prumerNaIntervalu(ceny, w.t[i], w.k[i]); if (!isNaN(cena)) { sw += w.v[i]; sp += w.v[i] * cena; } }
        vazena = sw > 0 ? sp / sw : NaN;
      }
      return { aritm: p > 0 ? s / p : NaN, vazena, pokryti: p / (M.do - M.od) };
    });
  }

  /* hlavní výpočet scénáře.
     p = { spotreba: řada kWh (už v období), od, do, plan, reg: regulovaneCeny(),
           obchod: {typ:'fix', cenaVT, cenaNT, platMes} | {typ:'spot', ceny: řada Kč/MWh, prirazka, platMes, rezim:'prubeh'|'tdd'|'prumer', vahy?} } */
  function vypoctiScenar(p) {
    const { reg, obchod } = p;
    const mesice = mesiceObdobi(p.od, p.do);
    const idx = new Map(mesice.map((M, i) => [M.klic, i]));
    const nt = jeNTFn(p.plan);
    const rows = mesice.map(M => ({ klic: M.klic, r: M.r, m: M.m, podil: M.podil, kwh: 0, kwhVT: 0, kwhNT: 0, silova: 0,
      energieSpot: 0, kwhSpot: 0, platObchod: 0, distribuce: 0, jistic: 0, systemove: 0, poze: 0, nesitova: 0, dan: 0 }));
    let chybiKwh = 0, sumCena = 0, sumKwhCena = 0;
    const cm = obchod.typ === 'spot' ? cenyMesicu(obchod.ceny, mesice, obchod.rezim === 'tdd' ? (obchod.vahy || p.spotreba) : null) : null;
    const s = p.spotreba;
    for (let i = 0; i < s.t.length; i++) {
      const t = s.t[i]; if (t < p.od || t >= p.do) continue;
      const x = mistni(t), j = idx.get(klicMesice(x.r, x.m)); if (j === undefined) continue;
      const R = rows[j], e = s.v[i], jeNt = nt(t);
      R.kwh += e; if (jeNt) R.kwhNT += e; else R.kwhVT += e;
      if (obchod.typ === 'spot') {
        const cena = prumerNaIntervalu(obchod.ceny, t, s.k[i]);
        if (isNaN(cena)) { chybiKwh += e; continue; }
        R.energieSpot += e * cena / 1000; R.kwhSpot += e;
        sumCena += e * cena; sumKwhCena += e;
      }
    }
    rows.forEach((R, j) => {
      if (obchod.typ === 'fix') R.silova = (R.kwhVT * obchod.cenaVT + R.kwhNT * (reg.dvoutarif ? obchod.cenaNT : obchod.cenaVT)) / 1000;
      else {
        const rez = obchod.rezim;
        const cena = rez === 'tdd' ? cm[j].vazena : rez === 'prumer' ? cm[j].aritm : null;
        R.silova = (rez === 'prubeh' || cena === null || isNaN(cena) ? R.energieSpot : R.kwhSpot * cena / 1000) + R.kwhSpot * obchod.prirazka / 1000;
        R.cenaMesice = R.kwhSpot > 0 ? (R.silova / R.kwhSpot * 1000) : NaN;  // Kč/MWh vč. přirážky
        R.aritm = cm[j].aritm;
      }
      R.platObchod = obchod.platMes * R.podil;
      R.distribuce = (R.kwhVT * reg.distVT + R.kwhNT * reg.distNT) / 1000;
      R.jistic = reg.jisticMes * R.podil;
      R.systemove = R.kwh * reg.systemove / 1000;
      R.poze = R.kwh * reg.poze / 1000;
      R.nesitova = reg.nesitovaMes * R.podil;
      R.dan = R.kwh * reg.dan / 1000;
      R.bezDPH = R.silova + R.platObchod + R.distribuce + R.jistic + R.systemove + R.poze + R.nesitova + R.dan;
      R.dph = R.bezDPH * reg.dph / 100;
      R.sDPH = R.bezDPH + R.dph;
    });
    const sum = {};
    ['kwh', 'kwhVT', 'kwhNT', 'kwhSpot', 'energieSpot', 'silova', 'platObchod', 'distribuce', 'jistic', 'systemove', 'poze', 'nesitova', 'dan', 'bezDPH', 'dph', 'sDPH', 'podil']
      .forEach(k => { sum[k] = rows.reduce((a, R) => a + R[k], 0); });
    sum.mesicu = sum.podil;
    // skupiny pro graf/tabulku
    sum.skupiny = {
      silova: sum.silova,
      stale: sum.platObchod + sum.jistic + sum.nesitova,
      regulEnergie: sum.distribuce + sum.systemove + sum.poze,
      dane: sum.dan + sum.dph,
    };
    let vazena = NaN, aritm = NaN;
    if (obchod.typ === 'spot') {
      vazena = sumKwhCena > 0 ? sumCena / sumKwhCena : NaN;
      const c = vyrez(obchod.ceny, p.od, p.do); let a = 0, b = 0;
      for (let i = 0; i < c.t.length; i++) { a += c.v[i] * c.k[i]; b += c.k[i]; }
      aritm = b > 0 ? a / b : NaN;
    }
    return { mesice: rows, soucet: sum, vazena, aritm, profilovyFaktor: vazena / aritm, chybiKwh };
  }

  /* fixní nabídka zjednodušeně (bez časové řady) – pro kontroly a bod zvratu */
  function nakladFix(o) {
    const silova = (o.kwhVT * o.cenaVT + o.kwhNT * o.cenaNT) / 1000;
    return { silova, staly: o.platMes * o.mesicu, celkem: silova + o.platMes * o.mesicu };
  }

  /* bod zvratu (bez DPH; DPH je poměrná, na rovnosti nic nemění):
     – jednotná fixní cena silové elektřiny (VT = NT), při které fix = spot,
     – přirážka spotu, při které spot = fix */
  function bodZvratu(fix, spot) {
    const F = fix.soucet, S = spot.soucet;
    const fixOstatni = F.bezDPH - F.silova;
    const cenaFix = F.kwh > 0 ? (S.bezDPH - fixOstatni) * 1000 / F.kwh : NaN;
    return { cenaFix, deltaPrirazka: S.kwhSpot > 0 ? (F.bezDPH - S.bezDPH) * 1000 / S.kwhSpot : NaN };
  }

  /* ------------------------------------------------------------------
     Flexibilní spotřeba a baterie (denní bloky 12:00–12:00 – ceny na další den jsou známé od ~13 h)
     ------------------------------------------------------------------ */
  /* rozdělí energii do povolených hodin od nejlevnější, max pmax kWh za hodinu */
  function rozvrhni(ceny, povoleno, energie, pmax, kroky) {
    const n = ceny.length, out = new Float64Array(n);
    const ind = []; for (let i = 0; i < n; i++) if (povoleno[i]) ind.push(i);
    ind.sort((a, b) => ceny[a] - ceny[b] || a - b);
    let zbyva = energie;
    for (const i of ind) { if (zbyva <= 1e-12) break; const x = Math.min(zbyva, pmax * (kroky ? kroky[i] : 1)); out[i] = x; zbyva -= x; }
    return { alokace: out, nesplneno: Math.max(0, zbyva) };
  }
  /* neřízený stav: 'rovnomerne' v povolených hodinách, nebo 'hned' od první povolené hodiny plným výkonem */
  function zakladniRozvrh(n, povoleno, energie, pmax, zpusob) {
    const out = new Float64Array(n); const ind = []; for (let i = 0; i < n; i++) if (povoleno[i]) ind.push(i);
    if (!ind.length) return { alokace: out, nesplneno: energie };
    let zbyva = energie;
    if (zpusob === 'hned') { for (const i of ind) { const x = Math.min(zbyva, pmax); out[i] = x; zbyva -= x; if (zbyva <= 1e-12) break; } }
    else {
      // rovnoměrně, ale nejvýš pmax; přebytek rozdělí do zbylých hodin
      let volne = ind.slice();
      while (zbyva > 1e-12 && volne.length) {
        const dil = zbyva / volne.length, dalsi = [];
        for (const i of volne) { const x = Math.min(dil, pmax - out[i]); out[i] += x; zbyva -= x; if (out[i] < pmax - 1e-12) dalsi.push(i); }
        if (dalsi.length === volne.length && dil <= 1e-12) break;
        volne = dalsi;
      }
    }
    return { alokace: out, nesplneno: Math.max(0, zbyva) };
  }

  /* baterie: přesné optimum denního plánu jako tok s minimální cenou (spojitě, bez diskretizace).
     Uzly = hodiny; zdroj→i nabití (cena c_i, kap. P), i→i+1 uložení (kap. C), i→výstup vybití
     (výnos η·c_i za uloženou kWh, kap. min(P, spotřeba_i)/η – vybíjí jen do výše spotřeby, žádné přetoky).
     Den začíná i končí prázdný. Postupné nejkratší cesty (Bellman-Ford) dokud je cesta zisková.
     Nulový plán je přípustný → nikdy nezvýší náklad. */
  function baterieDen(ceny, zatez, C, P, eta) {
    const n = ceny.length, nab = new Float64Array(n), vyb = new Float64Array(n);
    if (!(C > 0) || !(P > 0) || !(eta > 0) || n < 2) return { nab, vyb, uspora: 0 };
    const S = n, Tt = n + 1, hrany = [], adj = Array.from({ length: n + 2 }, () => []);
    const pridej = (a, b, kap, cena) => {
      adj[a].push(hrany.length); hrany.push({ do: b, kap, cena, tok: 0 });
      adj[b].push(hrany.length); hrany.push({ do: a, kap: 0, cena: -cena, tok: 0 });
    };
    for (let i = 0; i < n; i++) {
      pridej(S, i, P, ceny[i] / 1000);
      const dv = Math.min(P, Math.max(0, zatez[i])) / eta;
      if (dv > 1e-12) pridej(i, Tt, dv, -eta * ceny[i] / 1000);
      if (i < n - 1) pridej(i, i + 1, C, 0);
    }
    let celkem = 0;
    for (let iter = 0; iter < 10 * n + 50; iter++) {
      const dist = new Float64Array(n + 2).fill(Infinity), pred = new Int32Array(n + 2).fill(-1);
      dist[S] = 0;
      for (let k = 0; k < n + 2; k++) {
        let zmena = false;
        for (let u = 0; u < n + 2; u++) {
          if (dist[u] === Infinity) continue;
          for (const e of adj[u]) {
            const h = hrany[e];
            if (h.kap - h.tok > 1e-12 && dist[u] + h.cena < dist[h.do] - 1e-15) { dist[h.do] = dist[u] + h.cena; pred[h.do] = e; zmena = true; }
          }
        }
        if (!zmena) break;
      }
      if (!(dist[Tt] < -1e-12)) break;
      let f = Infinity;
      for (let v = Tt; v !== S;) { const h = hrany[pred[v]]; f = Math.min(f, h.kap - h.tok); v = hrany[pred[v] ^ 1].do; }
      if (!(f > 1e-12) || f === Infinity) break;
      for (let v = Tt; v !== S;) { const e = pred[v]; hrany[e].tok += f; hrany[e ^ 1].tok -= f; v = hrany[e ^ 1].do; }
      celkem += f * dist[Tt];
    }
    for (const e of adj[S]) { const h = hrany[e]; if (h.do < n && h.kap > 0) nab[h.do] = Math.max(0, h.tok); }
    for (let i = 0; i < n; i++) for (const e of adj[i]) { const h = hrany[e]; if (h.do === Tt && h.kap > 0) vyb[i] = Math.max(0, h.tok) * eta; }
    // baterie nemůže v jedné hodině nabíjet i vybíjet (u záporných cen by model „pálil“ ztráty) – vzájemně odečíst,
    // stav nabití zůstane stejný
    for (let i = 0; i < n; i++) if (nab[i] > 0 && vyb[i] > 0) { const d = Math.min(nab[i], vyb[i] / eta); nab[i] -= d; vyb[i] -= d * eta; }
    let uspora = 0; for (let i = 0; i < n; i++) uspora += ceny[i] * (vyb[i] - nab[i]) / 1000;
    if (!(uspora > 0)) { nab.fill(0); vyb.fill(0); uspora = 0; }
    return { nab, vyb, uspora, _cena: celkem };
  }

  /* referenční jemné DP (jen pro testy konvergence) */
  function baterieDP(ceny, zatez, C, P, eta, N) {
    const n = ceny.length, q = C / N, maxNab = Math.min(N, Math.floor(P / q + 1e-9));
    let dp = new Float64Array(N + 1).fill(Infinity); dp[0] = 0;
    for (let t = 0; t < n; t++) {
      const maxVyb = Math.min(N, Math.floor(Math.min(P, Math.max(0, zatez[t])) / (eta * q) + 1e-9));
      const nove = new Float64Array(N + 1).fill(Infinity);
      for (let s = 0; s <= N; s++) {
        if (dp[s] === Infinity) continue;
        for (let s2 = Math.max(0, s - maxVyb); s2 <= Math.min(N, s + maxNab); s2++) {
          const d = s2 - s, c = d >= 0 ? ceny[t] * d * q / 1000 : ceny[t] * d * q * eta / 1000;
          if (dp[s] + c < nove[s2]) nove[s2] = dp[s] + c;
        }
      }
      dp = nove;
    }
    return Math.max(0, -dp[0]);
  }

  /* bloky po 24 h od 12:00 místního času nad hodinovou cenovou řadou → [{od index, do index, hodiny:[wall h], mesic}] */
  function denniBloky(hod) {
    const bloky = []; let akt = null;
    for (let i = 0; i < hod.t.length; i++) {
      const x = mistni(hod.t[i]);
      const [r, m, d] = x.h < 12 ? pricistDny(x.r, x.m, x.d, -1) : [x.r, x.m, x.d];
      const kl = klicDne(r, m, d);
      if (!akt || akt.klic !== kl) { akt = { klic: kl, od: i, do: i, hodiny: [], mesic: m }; bloky.push(akt); }
      akt.do = i + 1; akt.hodiny.push(x.h);
    }
    return bloky;
  }

  /* Flexibilní spotřebiče nad obdobím.
     cenaHod: hodinová řada proměnné ceny Kč/MWh (všechny složky za kWh bez DPH), zatezHod: hodinová spotřeba domácnosti (kWh)
     sp: { ohrev:{kwhDen, pmax, okno[24]}, ev:{kwhTyden, pmax, okno[24]}, tc:{kwhDen, pmax, mesice[12]}, baterie:{C, P, eta} } (každý volitelný)
     Krajní neúplné bloky (období nezačíná/nekončí ve 12:00) dostanou poměrnou část denní dávky.
     vrací hodinové řady zaklad/opt (kWh netto), optPlus (spotřebiče + nabíjení), vybito (dodávka z baterie) a souhrn */
  function flexibilni(cenaHod, zatezHod, sp) {
    const n = cenaHod.t.length;
    const zakl = new Float64Array(n), opt = new Float64Array(n), plus = new Float64Array(n), vybito = new Float64Array(n);
    let nesplneno = 0, energie = 0, bat = 0, nabito = 0, dodano = 0;
    const bloky = denniBloky(cenaHod);
    for (const B of bloky) {
      const ceny = Array.from(cenaHod.v.subarray(B.od, B.do)), hod = B.hodiny, m = B.mesic;
      const plny = hod[0] === 12 && (B.do < n ? true : hod[hod.length - 1] === 11);
      const podil = plny ? 1 : Math.min(1, hod.length / 24);
      const pridej = (spotr, energieDen, zpusob) => {
        const E = energieDen * podil;
        const povol = hod.map(h => !!spotr.okno[h]);
        const z = zakladniRozvrh(ceny.length, povol, E, spotr.pmax, zpusob);
        const o = rozvrhni(ceny, povol, E, spotr.pmax);
        for (let i = 0; i < ceny.length; i++) { zakl[B.od + i] += z.alokace[i]; opt[B.od + i] += o.alokace[i]; plus[B.od + i] += o.alokace[i]; }
        nesplneno += o.nesplneno; energie += E - o.nesplneno;
      };
      if (sp.ohrev && sp.ohrev.kwhDen > 0) pridej(sp.ohrev, sp.ohrev.kwhDen, 'rovnomerne');
      if (sp.ev && sp.ev.kwhTyden > 0) pridej(sp.ev, sp.ev.kwhTyden / 7, 'hned');
      if (sp.tc && sp.tc.kwhDen > 0 && sp.tc.mesice[m]) pridej({ okno: new Array(24).fill(true), pmax: sp.tc.pmax }, sp.tc.kwhDen, 'rovnomerne');
      if (sp.baterie && sp.baterie.C > 0) {
        const zat = ceny.map((_, i) => (zatezHod ? zatezHod[B.od + i] || 0 : 0) + opt[B.od + i]);
        const b = baterieDen(ceny, zat, sp.baterie.C, sp.baterie.P, sp.baterie.eta);
        for (let i = 0; i < ceny.length; i++) { opt[B.od + i] += b.nab[i] - b.vyb[i]; plus[B.od + i] += b.nab[i]; vybito[B.od + i] += b.vyb[i]; nabito += b.nab[i]; dodano += b.vyb[i]; }
        bat += b.uspora;
      }
    }
    let nZ = 0, nO = 0;
    for (let i = 0; i < n; i++) { nZ += zakl[i] * cenaHod.v[i] / 1000; nO += opt[i] * cenaHod.v[i] / 1000; }
    const r = v => ({ t: cenaHod.t, k: cenaHod.k, v });
    return {
      zaklad: r(zakl), opt: r(opt), optPlus: r(plus), vybito: r(vybito),
      nakladZaklad: nZ, nakladOpt: nO, uspora: nZ - nO, usporaBaterie: bat, energie, nabito, dodano, nesplneno, dni: bloky.length,
    };
  }

  /* řada „proměnné ceny“ (Kč/MWh bez DPH) pro optimalizaci a pro konečnou cenu za kWh:
     fix → VT/NT cena; spot účtovaný podle průběhu → spotová cena + přirážka;
     spot účtovaný měsíční cenou (TDD/průměr) → silovka je pro posun konstantní (konstCena), posun šetří jen distribuci;
     + distribuce VT/NT + systémové služby + POZE + daň */
  function promennaCena(hodCeny, plan, reg, obchod, konstCena) {
    const nt = jeNTFn(plan), o = novaRada(hodCeny.t.length);
    let konst = konstCena;
    if (obchod.typ === 'spot' && obchod.rezim !== 'prubeh' && !(isFinite(konst))) {
      let s = 0, k = 0; for (let i = 0; i < hodCeny.t.length; i++) { s += hodCeny.v[i] * hodCeny.k[i]; k += hodCeny.k[i]; }
      konst = k ? s / k : 0;
    }
    for (let i = 0; i < hodCeny.t.length; i++) {
      const t = hodCeny.t[i], n = nt(t);
      let sil;
      if (obchod.typ === 'fix') sil = n && reg.dvoutarif ? obchod.cenaNT : obchod.cenaVT;
      else sil = (obchod.rezim === 'prubeh' ? hodCeny.v[i] : konst) + obchod.prirazka;
      o.t[i] = t; o.k[i] = hodCeny.k[i];
      o.v[i] = sil + (n ? reg.distNT : reg.distVT) + reg.systemove + reg.poze + reg.dan;
    }
    return o;
  }

  /* ------------------------------------------------------------------
     Riziko, teplotní mapa, nejlevnější okno
     ------------------------------------------------------------------ */
  function statistika(hodnoty) {
    const a = hodnoty.filter(x => isFinite(x)).sort((x, y) => x - y);
    if (!a.length) return { min: NaN, median: NaN, max: NaN };
    const med = a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
    return { min: a[0], median: med, max: a[a.length - 1] };
  }

  /* matice den × 24 nástěnných hodin (průměr; NaN chybí) */
  function maticeDenHodina(r, od, do_) {
    const mapa = mapaDnu(vyrez(r, od, do_), 24);
    // mapaDnu vrací energii na slot → pro ceny (průměry) chceme hodnotu, ne součet: přepočet níže
    const dny = [...mapa.keys()].sort();
    const hodnoty = new Float64Array(dny.length * 24);
    dny.forEach((k, i) => { const a = mapa.get(k); for (let h = 0; h < 24; h++) hodnoty[i * 24 + h] = a[h]; });
    return { dny, hodnoty };
  }
  /* pro ceny: z řady udělá „energii“ v·k/3600, aby mapaDnu (součet na slot) dala průměr na hodinu */
  function maticeCen(ceny, od, do_) {
    const c = vyrez(ceny, od, do_), o = { t: c.t, k: c.k, v: new Float64Array(c.v.length) };
    for (let i = 0; i < c.v.length; i++) o.v[i] = c.v[i] * c.k[i] / 3600;
    return maticeDenHodina(o, od, do_);
  }

  function nejlevnejsiOkno(ceny, n) {
    if (!(n >= 1) || ceny.length < n) return null;
    let s = 0; for (let i = 0; i < n; i++) s += ceny[i];
    let best = s, start = 0;
    for (let i = n; i < ceny.length; i++) { s += ceny[i] - ceny[i - n]; if (s < best - 1e-9) { best = s; start = i - n + 1; } }
    return { start, prumer: best / n };
  }

  /* živá data spotovaelektrina.cz → {dnes:[{t,k,czk,eur}], zitra:[…]} */
  function parsujZivaData(json, dnes /* {r,m,d} */) {
    const prevod = (pole, den) => {
      if (!Array.isArray(pole) || !pole.length) return [];
      const ctvrt = pole.some(x => x.minute !== undefined && x.minute !== 0) || pole.length > 30;
      const k = ctvrt ? 900 : 3600;
      let posl = -Infinity;
      return pole.map(x => {
        let t = zMistniho(den[0], den[1], den[2], x.hour, x.minute || 0, true);
        if (t !== null && t <= posl) t = zMistniho(den[0], den[1], den[2], x.hour, x.minute || 0, false);
        if (t === null) t = posl + k;
        posl = t;
        return { t, k, czk: +x.priceCZK, eur: +x.priceEur };
      });
    };
    return { dnes: prevod(json.hoursToday, [dnes.r, dnes.m, dnes.d]), zitra: prevod(json.hoursTomorrow, pricistDny(dnes.r, dnes.m, dnes.d, 1)) };
  }

  /* ------------------------------------------------------------------
     CSV z portálů distributorů
     ------------------------------------------------------------------ */
  const RE_DATUM = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})|(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const RE_CAS = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;
  const RE_ZONA = /(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*(Z|[+-]\d{2}:?\d{2})(?![\d:])/i;
  const RE_SPATNY_STAV = /nezn|chyb|neplat|náhrad|nahrad|nedefin|invalid|error|missing/i;

  function rozdelRadek(l, sep) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === sep) { out.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    out.push(cur.trim());
    return out;
  }
  function cislo(s, des) {
    if (s === undefined || s === null) return NaN;
    let x = String(s).trim().replace(/\s| /g, '');
    if (!x) return NaN;
    if (des === ',') x = x.replace(/\./g, '').replace(',', '.');
    else if (des === '.') x = x.replace(/,/g, '');
    else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(x)) x = x.replace(/,/g, '');
    else if (/,\d+$/.test(x) && !/\.\d+$/.test(x)) x = x.replace(/\./g, '').replace(',', '.');
    if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(x)) return NaN;
    return parseFloat(x);
  }
  /* datum a čas z textu; poradi 'dm' | 'md' pro data s lomítkem; ISO čas se zónou (Z, +01:00) → abs (unix s) */
  function parsujDatum(s, poradi) {
    const z = RE_ZONA.exec(s);
    if (z) {
      const zona = z[3].toUpperCase() === 'Z' ? 'Z' : z[3].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
      const cas = z[2].length === 4 ? '0' + z[2] : z[2];
      const abs = Date.parse(z[1] + 'T' + cas + zona) / 1000;
      if (isFinite(abs)) { const x = mistni(abs); return { r: x.r, m: x.m, d: x.d, h: x.h, min: x.min, abs }; }
    }
    const m = RE_DATUM.exec(s); if (!m) return null;
    let d;
    if (m[1]) d = [+m[3], +m[2] - 1, +m[1]];
    else if (m[4]) d = [+m[4], +m[5] - 1, +m[6]];
    else d = poradi === 'md' ? [+m[9], +m[7] - 1, +m[8]] : [+m[9], +m[8] - 1, +m[7]];
    if (d[1] < 0 || d[1] > 11 || d[2] < 1 || d[2] > 31) return null;
    const zbytek = s.slice(m.index + m[0].length);
    const c = RE_CAS.exec(zbytek);
    return { r: d[0], m: d[1], d: d[2], h: c ? +c[1] : null, min: c ? +c[2] : null };
  }

  /* autodetekce formátu: oddělovač, hlavička, sloupce data/času/hodnoty/stavu, jednotka, desetinná značka, pořadí data */
  function detekujCSV(text) {
    const radky = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() !== '');
    if (!radky.length) throw new Error('Soubor je prázdný.');
    const vzorek = radky.slice(0, 60);
    let sep = ';', nejlepsi = -1;
    for (const s of [';', '\t', ',', '|']) {
      const poc = vzorek.map(l => rozdelRadek(l, s).length).filter(n => n > 1);
      if (!poc.length) continue;
      const mod = poc.sort((a, b) => poc.filter(x => x === b).length - poc.filter(x => x === a).length)[0];
      const skore = poc.filter(x => x === mod).length * (mod > 1 ? 1 : 0) + (s === ';' ? 0.5 : 0);
      if (skore > nejlepsi) { nejlepsi = skore; sep = s; }
    }
    const pole = radky.map(l => rozdelRadek(l, sep));
    let prvni = -1;
    for (let i = 0; i < Math.min(pole.length, 200); i++) {
      const r = pole[i];
      if (r.some(c => RE_DATUM.test(c)) && r.some(c => !RE_DATUM.test(c) && !isNaN(cislo(c)))) { prvni = i; break; }
    }
    if (prvni < 0) throw new Error('Nenašel jsem řádky s datem a hodnotou.');
    const hlavicka = prvni > 0 ? pole[prvni - 1].map(String) : [];
    const data = pole.slice(prvni, prvni + 200);
    const ncol = Math.max(...data.map(r => r.length));
    let colDatum = -1, colCas = -1;
    const podil = (c, f) => data.filter(r => f(r[c] || '')).length / data.length;
    for (let c = 0; c < ncol && colDatum < 0; c++) if (podil(c, x => RE_DATUM.test(x)) >= 0.9) colDatum = c;
    if (colDatum < 0) throw new Error('Nenašel jsem sloupec s datem.');
    if (!RE_CAS.test(data[0][colDatum])) {
      for (let c = 0; c < ncol; c++) if (c !== colDatum && podil(c, x => /^\s*\d{1,2}:\d{2}/.test(x)) >= 0.9) { colCas = c; break; }
    }
    // pořadí u data s lomítkem (americké m/d/rrrr)
    let poradi = 'dm';
    const lom = data.map(r => /(\d{1,2})\/(\d{1,2})\/\d{4}/.exec(r[colDatum] || '')).filter(Boolean);
    if (lom.some(m => +m[2] > 12) && !lom.some(m => +m[1] > 12)) poradi = 'md';
    const ciselne = [];
    for (let c = 0; c < ncol; c++) {
      if (c === colDatum || c === colCas) continue;
      const hodn = data.map(r => r[c]).filter(x => x !== undefined && x !== '');
      if (hodn.length && hodn.filter(x => !isNaN(cislo(x))).length >= hodn.length * 0.8) ciselne.push(c);
    }
    if (!ciselne.length) throw new Error('Nenašel jsem sloupec s hodnotami.');
    const jm = c => (hlavicka[c] || '').toLowerCase();
    // stavový sloupec
    let colStav = hlavicka.findIndex((h, c) => c !== colDatum && /status|stav|kvalit|příznak|priznak/i.test(h));
    if (colStav < 0) for (let c = 0; c < ncol; c++) if (!ciselne.includes(c) && c !== colDatum && c !== colCas && data.some(r => /naměřen|namer|platn|ok\b/i.test(r[c] || ''))) { colStav = c; break; }
    // EDC (skupina sdílení): sloupce IN-/OUT-<EAN>-D/-O; odběr = IN-…-O se záporným znaménkem
    const edc = hlavicka.findIndex(h => /^IN-\d+-O$/i.test(String(h).trim()));
    const zakazane = /(-a\b|−a|dodávk|dodavk|výrob|vyrob|export|status|stav|kvalit|příznak|priznak|flag|jalov|reakt|var\b|cos)/;
    const preferovane = [/\+a/, /odb[eě]r/, /spot[řr]eb/, /import|consum/, /činn|cinn/, /kwh/, /kw\b/, /hodnot|value|energ/];
    let colHodnota = edc >= 0 ? edc : ciselne.find(c => !zakazane.test(jm(c)) && preferovane.slice(0, 4).some(re => re.test(jm(c))));
    if (colHodnota === undefined) colHodnota = ciselne.find(c => !zakazane.test(jm(c)) && preferovane.some(re => re.test(jm(c))));
    if (colHodnota === undefined) colHodnota = ciselne.find(c => !zakazane.test(jm(c)));
    if (colHodnota === undefined) colHodnota = ciselne[0];
    // jednotka – z hlavičky sloupce, ze sloupce jednotky, jinak nejistá
    let jednotka = 'kWh', jednotkaJista = true;
    const jhl = jm(colHodnota);
    if (/kwh/.test(jhl)) jednotka = 'kWh';
    else if (/\bwh\b/.test(jhl)) jednotka = 'Wh';
    else if (/\bkw\b|\[kw\]|\(kw\)|výkon|vykon|power/.test(jhl)) jednotka = 'kW';
    else if (/\bw\b|\[w\]/.test(jhl)) jednotka = 'W';
    else jednotkaJista = false;
    for (let c = 0; c < ncol; c++) {
      const v = (data[0][c] || '').trim().toLowerCase();
      if (c !== colHodnota && /^(kwh|kw|wh|w)$/.test(v)) { jednotka = { kwh: 'kWh', kw: 'kW', wh: 'Wh', w: 'W' }[v]; jednotkaJista = true; break; }
    }
    const vzorHod = data.map(r => r[colHodnota] || '').join(' ');
    const des = sep !== ',' && /\d,\d/.test(vzorHod) ? ',' : (/\d\.\d/.test(vzorHod) ? '.' : ',');
    const vzorekHodnot = data.map(r => cislo(r[colHodnota], des)).filter(isFinite);
    const obratit = vzorekHodnot.length > 0 && vzorekHodnot.every(x => x <= 0) && vzorekHodnot.some(x => x < 0);
    return { sep, prvni, hlavicka, ncol, colDatum, colCas, colHodnota, colStav, jednotka, jednotkaJista, des, poradi, znacka: 'auto', ciselne, obratit,
      format: edc >= 0 ? 'EDC – skupina sdílení' : hlavicka.some(h => /^\+A\/\d+/i.test(h)) ? 'ČEZ Distribuce (PND)' : hlavicka.some(h => /počátek intervalu/i.test(h)) ? 'PREdistribuce' : '',
      nahled: pole.slice(Math.max(0, prvni - 1), prvni + 8) };
  }

  /* načte CSV; volby přepíšou autodetekci (sep, colDatum, colCas, colHodnota, colStav, jednotka, des, poradi,
     znacka: 'zacatek'|'konec'|'auto', zimni: true = celý rok SEČ) */
  function parsujCSV(text, volby) {
    const ts = text.replace(/^﻿/, '').trim();
    if (ts[0] === '{' || ts[0] === '[') return parsujJSON(ts, volby);
    const det = detekujCSV(text);
    const v = Object.assign({}, det, volby || {});
    if (volby && volby.jednotka) v.jednotkaJista = true;
    const radky = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() !== '');
    let zaznamy = [], bezCasu = [];
    let chybnych = 0, zapornych = 0, spatnyStav = 0;
    for (let i = v.prvni; i < radky.length; i++) {
      const r = rozdelRadek(radky[i], v.sep);
      const dt = parsujDatum((r[v.colDatum] || '') + (v.colCas >= 0 ? ' ' + (r[v.colCas] || '') : ''), v.poradi);
      let x = cislo(r[v.colHodnota], v.des);
      if (v.obratit && isFinite(x)) x = -x;
      if (!dt || isNaN(x)) { chybnych++; continue; }
      if (v.colStav >= 0 && RE_SPATNY_STAV.test(r[v.colStav] || '')) { spatnyStav++; continue; }
      if (dt.h === null) { bezCasu.push({ dt: Object.assign(dt, { h: 0, min: 0 }), x }); continue; }
      zaznamy.push({ dt, x });
    }
    let denni = false;
    if (zaznamy.length < 2 && bezCasu.length >= 2) { zaznamy = bezCasu; denni = true; }   // denní odečty bez času
    else chybnych += bezCasu.length;
    if (zaznamy.length < 2) throw new Error('Načetl jsem méně než 2 platné hodnoty.');
    zaznamy.forEach(z => { if (z.x < 0) zapornych++; });
    // krok (modus kladných rozdílů): absolutní časy, nebo nástěnné
    const minuty = zaznamy.map(z => z.dt.abs !== undefined ? z.dt.abs / 60 : Date.UTC(z.dt.r, z.dt.m, z.dt.d, z.dt.h, z.dt.min) / 60000);
    const poc = {};
    for (let i = 1; i < minuty.length; i++) { const d = minuty[i] - minuty[i - 1]; if (d > 0 && d <= 1440) poc[d] = (poc[d] || 0) + 1; }
    const krokMin = denni ? 1440 : +Object.keys(poc).sort((a, b) => poc[b] - poc[a])[0];
    if (!(krokMin > 0)) throw new Error('Nepodařilo se určit délku intervalu.');
    const krok = krokMin * 60;
    // značka času: hlasování podle hranic dnů v celém souboru
    let znacka = v.znacka, znackaJista = true;
    if (znacka === 'auto') {
      if (denni) znacka = zaznamy.some(z => z.dt.h === 24) ? 'konec' : 'zacatek';
      else {
        let konec = 0, zac = 0;
        const minDne = z => z.dt.h * 60 + z.dt.min;
        if (zaznamy.some(z => z.dt.h === 24)) konec += 3;
        const prvniZ = zaznamy[0], poslZ = zaznamy[zaznamy.length - 1];
        if (minDne(prvniZ) === krokMin) konec++; else if (minDne(prvniZ) === 0) zac++;
        if (minDne(poslZ) === 0) konec++; else if (minDne(poslZ) === 1440 - krokMin) zac++;
        // každý den: má-li den záznam 00:00 a zároveň 24h−krok, nic neříká; den, kterému chybí 00:00 a má 24h−krok…
        const dny = new Map();
        for (const z of zaznamy) { const k = z.dt.r * 400 + z.dt.m * 32 + z.dt.d; const a = dny.get(k) || { min: 1e9, max: -1 }; a.min = Math.min(a.min, minDne(z)); a.max = Math.max(a.max, minDne(z)); dny.set(k, a); }
        for (const a of dny.values()) { if (a.min === 0 && a.max === 0) konec++; }   // den jen s 00:00 = konec předchozího dne
        if (zaznamy.some(z => z.dt.abs !== undefined)) { znacka = konec > zac ? 'konec' : 'zacatek'; }
        else if (konec > zac) znacka = 'konec';
        else { znacka = 'zacatek'; if (konec === zac) znackaJista = false; }
      }
    }
    let pndKw = false;
    if (!v.jednotkaJista && /^ČEZ/.test(det.format) && krok <= 900) { v.jednotka = 'kW'; pndKw = true; }   // PND: čtvrthodinové profily jsou vždy kW
    const faktor = { kWh: 1, Wh: 0.001, kW: krok / 3600, W: krok / 3600 / 1000 }[v.jednotka];
    if (faktor === undefined) throw new Error('Neznámá jednotka ' + v.jednotka);
    const tt = [], vv = [];
    let posl = -Infinity, duplicit = 0, mimoPoradi = 0;
    for (const z of zaznamy) {
      let t;
      if (z.dt.abs !== undefined) t = z.dt.abs;
      else {
        let { r, m, d, h, min } = z.dt;
        if (h === 24) { [r, m, d] = pricistDny(r, m, d, 1); h = 0; }
        if (v.zimni) t = Date.UTC(r, m, d, h, min) / 1000 - 3600;
        else {
          t = zMistniho(r, m, d, h, min, true);
          if (t !== null && (znacka === 'konec' ? t - krok : t) <= posl) {   // podzim: druhý výskyt = SEČ
            const t2 = zMistniho(r, m, d, h, min, false);
            if (t2 !== t) t = t2;
          }
          if (t === null) t = Date.UTC(r, m, d, h, min) / 1000 - 3600;      // čas neexistující v SELČ → soubor v SEČ
        }
      }
      if (znacka === 'konec') t -= krok;
      if (t === posl) { duplicit++; continue; }
      if (t < posl) mimoPoradi++;
      tt.push(t); vv.push(z.x * faktor); posl = Math.max(posl, t);
    }
    const ind = tt.map((_, i) => i).sort((a, b) => tt[a] - tt[b]);
    const t2 = [], v2 = [];
    for (const i of ind) { if (t2.length && t2[t2.length - 1] === tt[i]) { duplicit++; continue; } t2.push(tt[i]); v2.push(vv[i]); }
    // denní data: délka dne 23/25 h podle místního času
    const kroky = t2.map((x, i) => { if (!denni) return krok; const m = mistni(x + 43200); const [r2, m2, d2] = pricistDny(m.r, m.m, m.d, 1); return zacatekDne(r2, m2, d2) - zacatekDne(m.r, m.m, m.d); });
    const rada = radaZPoli(t2, kroky, v2);
    const mezery = []; let chybiIntervalu = 0;
    for (let i = 1; i < t2.length; i++) {
      const d = t2[i] - t2[i - 1];
      if (d > kroky[i - 1] + 1) { const n = Math.round(d / krok) - 1; chybiIntervalu += n; if (mezery.length < 50) mezery.push({ od: t2[i - 1] + kroky[i - 1], do: t2[i], intervalu: n }); }
    }
    const kwh = v2.reduce((a, b) => a + b, 0);
    // věrohodnost
    const varovani = [];
    const dni = (t2[t2.length - 1] + kroky[kroky.length - 1] - t2[0]) / 86400;
    const rocne = dni > 0 ? kwh / dni * 365 : 0;
    if (pndKw) varovani.push('V hlavičce není jednotka – čtvrthodinové profily ČEZ PND jsou průměrný výkon v kW, přepočítávám na kWh (÷ 4).');
    else if (!v.jednotkaJista) varovani.push('V hlavičce není jednotka – beru ' + v.jednotka + '. Jsou-li to kW (průměrný výkon), je spotřeba ' + (krok === 900 ? '4×' : '') + ' jiná – nastavte jednotku ručně.');
    const maxInt = Math.max(...v2);
    if (maxInt > 50 * krok / 900) varovani.push('Nejvyšší hodnota ' + maxInt.toFixed(1) + ' kWh za interval je na domácnost nevěrohodná – nejsou to Wh?');
    if (rocne > 60000) varovani.push('Přepočteno na rok ' + Math.round(rocne) + ' kWh – nezvykle mnoho, zkontrolujte jednotku.');
    else if (rocne > 0 && rocne < 300) varovani.push('Přepočteno na rok jen ' + Math.round(rocne) + ' kWh – zkontrolujte jednotku (Wh × kWh).');
    const nul = v2.filter(x => x === 0).length;
    if (nul > v2.length * 0.5) varovani.push(Math.round(nul / v2.length * 100) + ' % hodnot je nulových – nejde o sloupec dodávky nebo o neplatná data?');
    if (!znackaJista) varovani.push('Nelze spolehlivě poznat, zda čas označuje začátek, nebo konec intervalu – beru začátek; případně změňte v nastavení.');
    if (spatnyStav) varovani.push(spatnyStav + ' hodnot má stav „neplatná/neznámá“ – vynechány a doplní se jako mezery.');
    if (denni || krok > 3600) varovani.push('Data bez čtvrthodinového průběhu (krok ' + (denni ? '1 den' : krok / 60 + ' min') + ') – průběh uvnitř ' + (denni ? 'dne' : 'intervalu') + ' se doplní tvarem TDD sazby.');
    return {
      rada, krok, denni, znacka, znackaJista, jednotka: v.jednotka, jednotkaJista: !!v.jednotkaJista, format: det.format, obratit: !!v.obratit, sep: v.sep, des: v.des,
      colDatum: v.colDatum, colCas: v.colCas, colHodnota: v.colHodnota, colStav: v.colStav, poradi: v.poradi,
      hlavicka: det.hlavicka, pocet: t2.length, od: t2[0], do: t2[t2.length - 1] + kroky[kroky.length - 1], kwh,
      mezery, chybiIntervalu, chybnych, duplicit, zapornych, mimoPoradi, spatnyStav, varovani,
    };
  }

  /* rozloží hrubá data (krok > 1 h, např. denní součty) do hodin podle tvaru (hodinová řada, např. TDD);
     intervaly ≤ 1 h ponechá. Vrací hodinovou/jemnější řadu a podíl energie, který byl rozložen. */
  function rozlozDleTvaru(r, tvar) {
    const tt = [], kk = [], vv = []; let rozlozeno = 0, celkem = 0;
    for (let i = 0; i < r.t.length; i++) {
      celkem += r.v[i];
      if (r.k[i] <= 3600) { tt.push(r.t[i]); kk.push(r.k[i]); vv.push(r.v[i]); continue; }
      const c = vyrez(tvar, r.t[i], r.t[i] + r.k[i]);
      let s = 0; for (let j = 0; j < c.t.length; j++) s += Math.max(0, c.v[j]);
      const n = Math.round(r.k[i] / 3600);
      for (let j = 0; j < n; j++) {
        const t = r.t[i] + j * 3600, x = indexCasu(c, t);
        const w = s > 0 && x >= 0 && c.t[x] === t ? Math.max(0, c.v[x]) / s : 1 / n;
        tt.push(t); kk.push(3600); vv.push(r.v[i] * w);
      }
      rozlozeno += r.v[i];
    }
    const o = radaZPoli(tt, kk, vv); o.podilRozlozeny = celkem > 0 ? rozlozeno / celkem : 0;
    return o;
  }

  /* JSON z OpenAPI EG.D (data.distribuce24.cz/rest/spotreby): {units:'KW'|'KWH', data:[{timestamp (UTC), value, status}]} */
  function parsujJSON(text, volby) {
    let j;
    try { j = JSON.parse(text); } catch (e) { throw new Error('Neplatný JSON.'); }
    if (Array.isArray(j)) j = j[0] || {};
    const pole = j.data || j.values || [];
    if (!Array.isArray(pole) || pole.length < 2) throw new Error('JSON neobsahuje pole „data“ s hodnotami.');
    const jedn = String((volby && volby.jednotka) || j.units || j.unit || 'kWh').toLowerCase();
    const body = pole.map(x => ({ t: Date.parse(x.timestamp || x.datetime || x.time) / 1000, v: +x.value, s: x.status }))
      .filter(x => isFinite(x.t) && isFinite(x.v)).sort((a, b) => a.t - b.t);
    if (body.length < 2) throw new Error('Méně než 2 platné hodnoty.');
    const poc = {}; for (let i = 1; i < body.length; i++) { const d = body[i].t - body[i - 1].t; if (d > 0) poc[d] = (poc[d] || 0) + 1; }
    const krok = +Object.keys(poc).sort((a, b) => poc[b] - poc[a])[0];
    const znacka = (volby && volby.znacka && volby.znacka !== 'auto') ? volby.znacka : 'zacatek';
    const f = jedn === 'kw' ? krok / 3600 : jedn === 'w' ? krok / 3600000 : jedn === 'wh' ? 0.001 : 1;
    const tt = [], vv = []; let duplicit = 0;
    for (const b of body) { const t = znacka === 'konec' ? b.t - krok : b.t; if (tt.length && tt[tt.length - 1] === t) { duplicit++; continue; } tt.push(t); vv.push(b.v * f); }
    const mezery = []; let chybiIntervalu = 0;
    for (let i = 1; i < tt.length; i++) { const d = tt[i] - tt[i - 1]; if (d > krok) { const n = Math.round(d / krok) - 1; chybiIntervalu += n; if (mezery.length < 50) mezery.push({ od: tt[i - 1] + krok, do: tt[i], intervalu: n }); } }
    return { rada: radaZPoli(tt, krok, vv), krok, znacka, jednotka: jedn === 'kw' ? 'kW' : jedn === 'wh' ? 'Wh' : jedn === 'w' ? 'W' : 'kWh', format: 'JSON (EG.D OpenAPI)',
      pocet: tt.length, od: tt[0], do: tt[tt.length - 1] + krok, kwh: vv.reduce((a, b) => a + b, 0), mezery, chybiIntervalu, chybnych: pole.length - body.length, duplicit, zapornych: vv.filter(x => x < 0).length, mimoPoradi: 0, hlavicka: [],
      jednotkaJista: true, znackaJista: !!(volby && volby.znacka && volby.znacka !== 'auto'), spatnyStav: 0,
      varovani: ['EG.D OpenAPI: časy jsou v UTC; zda označují začátek, nebo konec čtvrthodiny, není v dokumentaci jednoznačné – beru začátek.'] };
  }

  /* ------------------------------------------------------------------
     Kontrola přibalených dat (úplnost)
     ------------------------------------------------------------------ */
  function kontrolaRoku(json) {
    const od = zacatekDne(json.rok, 0, 1), konecRoku = zacatekDne(json.rok + 1, 0, 1);
    let t = od, n = 0, hodin = 0;
    for (const u of json.useky) {
      if (u.od !== t) return { ok: false, chyba: 'díra nebo překryv v ' + new Date(t * 1000).toISOString() };
      if (u.krok !== 900 && u.krok !== 3600) return { ok: false, chyba: 'neznámý krok ' + u.krok };
      for (const c of u.ceny) if (typeof c !== 'number' || !isFinite(c)) return { ok: false, chyba: 'neplatná cena' };
      n += u.ceny.length; t += u.krok * u.ceny.length; hodin += u.krok * u.ceny.length / 3600;
    }
    return { ok: json.uplny ? t === konecRoku : t <= konecRoku, intervalu: n, hodin, konec: t, ocekavanychHodin: (konecRoku - od) / 3600 };
  }

  return {
    REG, vychoziNT, platJistic, regulovaneCeny,
    offsetPraha, mistni, zMistniho, zacatekDne, klicDne, klicMesice, pricistDny, velikonoce, jeSvatek, typDne,
    novaRada, radaZPoli, radaZUseku, spojRady, indexCasu, prumerNaIntervalu, vyrez, naHodiny, prictiHodinovou, soucet, delka,
    mapaDnu, doplnDen, najdiZdrojovyDen, prenesProfil,
    jeNTFn, planProSazbu, rozdelVTNT, skalujVTNT,
    mesiceObdobi, cenyMesicu, vypoctiScenar, nakladFix, bodZvratu,
    rozvrhni, zakladniRozvrh, baterieDen, baterieDP, denniBloky, flexibilni, promennaCena,
    statistika, maticeDenHodina, maticeCen, nejlevnejsiOkno, parsujZivaData,
    rozdelRadek, cislo, parsujDatum, detekujCSV, parsujCSV, parsujJSON, rozlozDleTvaru, kontrolaRoku,
  };
})();
/* ==KONEC JADRA== */
if (typeof module !== 'undefined') module.exports = TARIF;
