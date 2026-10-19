/* Krabičky – výpočetní jádro bez DOM a bez knihovny manifold.
   Parametry projektu (výchozí hodnoty, předvolby desek, normalizace a kontroly),
   kontrola sítě (těsnost, orientace, objem), měření tlouštěk paprsky,
   zápis STL (binární), 3MF (ZIP „stored“ + CRC32) a projektů JSON.
   Souřadnice modelu: mm, osa Z nahoru, střed půdorysu krabičky v počátku,
   dno krabičky v z = 0. */
(function () {
  'use strict';

  const VERZE_FORMATU = 1;
  const PLOCHY = ['x-', 'x+', 'y-', 'y+', 'viko', 'dno'];
  const NAZVY_PLOCH = { 'x-': 'levá stěna (−X)', 'x+': 'pravá stěna (+X)', 'y-': 'přední stěna (−Y)',
    'y+': 'zadní stěna (+Y)', viko: 'víko', dno: 'dno' };

  /* ---------- výchozí projekt ---------- */
  const VYCHOZI = {
    nazev: 'Krabička',
    vnitrni: { delka: 80, sirka: 60, vyska: 30 },  // dutina: od horní plochy dna po horní hranu stěn
    stena: 2, dno: 2, zaobleni: 4, segmenty: 48,
    tolerance: 0.2,         // kompenzace tisku: přičítá se k průměrům otvorů a rozměrům výřezů
    tryska: 0.4, minTloustka: 0.8,
    viko: {
      typ: 'nasazovaci',    // 'nasazovaci' | 'sroubovaci' | 'zadne' (otevřená vanička)
      tloustka: 2, vule: 0.2, osazeni: true, vyskaOsazeni: 5, stenaOsazeni: 1.6,
      zapadky: true, presahZapadky: 0.6,
      sroub: { prumer: 3, pilot: 2.5, hloubka: 10, sloupek: 7, zahloubeni: 'zadne', hlava: 6, hloubkaHlavy: 1.5 },
    },
    deska: {
      pouzit: false, nazev: 'Deska', delka: 70, sirka: 50, tloustka: 1.6, x: 5, y: 5, vyskaSoucastek: 12,
      sloupky: { vyska: 5, prumer: 6, dira: 2.5, pruchozi: false },
      otvory: [],
    },
    montaz: { typ: 'zadne', prumer: 4, delkaUcha: 10, sirkaUcha: 14, tloustkaUcha: 3, otvory: [] },
    vetrani: [], pruchodky: [], konektory: [],
  };

  /* Typy výřezů pro konektory: rozměr otvoru (už s místem pro zástrčku), bez tolerance tisku. */
  const KONEKTORY = {
    'usb-b': { nazev: 'USB-B', sirka: 12.5, vyska: 11.5, zaobleni: 0.8 },
    'usb-c': { nazev: 'USB-C', sirka: 10, vyska: 4.5, zaobleni: 1.5 },
    'usb-micro': { nazev: 'Micro-USB', sirka: 11, vyska: 7.5, zaobleni: 1.5 },
    'usb-a': { nazev: 'USB-A', sirka: 14, vyska: 7, zaobleni: 0.5 },
    'dc-55': { nazev: 'DC 5,5/2,1 (souosý)', sirka: 9.5, vyska: 11.5, zaobleni: 1 },
    'rj45': { nazev: 'RJ45 (Ethernet)', sirka: 16.5, vyska: 14, zaobleni: 0.5 },
    'sd': { nazev: 'microSD', sirka: 13, vyska: 3, zaobleni: 0.5 },
    'vlastni': { nazev: 'Vlastní', sirka: 10, vyska: 6, zaobleni: 1 },
  };

  /* Kabelové průchodky – průměr montážního otvoru podle závitu vývodky (typické katalogové hodnoty). */
  const PRUCHODKY = {
    m12: { nazev: 'vývodka M12×1,5', prumer: 12.2 },
    m16: { nazev: 'vývodka M16×1,5', prumer: 16.2 },
    m20: { nazev: 'vývodka M20×1,5', prumer: 20.2 },
    pg7: { nazev: 'vývodka PG7', prumer: 12.7 },
    pg9: { nazev: 'vývodka PG9', prumer: 15.4 },
    kabel5: { nazev: 'kabel Ø 5 mm', prumer: 5.5 },
    vlastni: { nazev: 'vlastní', prumer: 8 },
  };

  /* ---------- předvolby desek ----------
     Souřadnice děr a konektorů v mm od rohu desky (x podél delší hrany od strany s konektory,
     y od hrany u napájecího konektoru). */
  const PREDVOLBY = {
    prazdna: {
      nazev: 'Prázdná krabička (bez desky)',
      zdroj: '',
      uprav(p) {
        p.deska.pouzit = false;
        p.vnitrni = { delka: 80, sirka: 60, vyska: 30 };
        p.konektory = []; p.vetrani = []; p.pruchodky = [];
      },
    },
    arduino_uno: {
      nazev: 'Arduino Uno R3',
      zdroj: 'Obrys 68,58 × 53,34 mm (2,7 × 2,1″) a poloha USB-B/napájecího konektoru podle footprintu Arduino_UNO_R3 v oficiální knihovně KiCad (Module.pretty); '
        + 'díry Ø 3,2 mm v bodech (13,97; 2,54), (15,24; 50,8), (66,04; 7,62), (66,04; 35,56) mm podle výkresu Arduino (Eagle) – shodně s měřením na fóru Arduino (±0,5 mm). '
        + 'Výšky konektorů (≈ 11 mm nad deskou) jsou přibližné.',
      uprav(p) {
        Object.assign(p.deska, {
          pouzit: true, nazev: 'Arduino Uno R3', delka: 68.58, sirka: 53.34, tloustka: 1.6, x: 6.65, y: 1.6, vyskaSoucastek: 13,
          sloupky: { vyska: 6, prumer: 6, dira: 2.5, pruchozi: false },
          otvory: [[13.97, 2.54], [15.24, 50.8], [66.04, 7.62], [66.04, 35.56]],
        });
        p.vnitrni = { delka: 77, sirka: 56.5, vyska: 25 };
        p.konektory = [
          { nazev: 'USB-B', typ: 'usb-b', plocha: 'x-', vztah: 'deska', u: 38.1, v: 5.5, sirka: 12.5, vyska: 11.5, zaobleni: 0.8 },
          { nazev: 'Napájení DC', typ: 'dc-55', plocha: 'x-', vztah: 'deska', u: 7.62, v: 5.5, sirka: 9.5, vyska: 11.5, zaobleni: 1 },
        ];
        p.vetrani = [{ plocha: 'viko', u: 10, v: 0, pocet: 7, sirka: 2, delka: 30, rozestup: 5, orientace: 'svisle' }];
        p.pruchodky = [];
      },
    },
    esp32_devkitc: {
      nazev: 'ESP32-DevKitC V4',
      zdroj: 'Rozměr 54,4 × 27,9 mm (s přesahem antény; DPS pod lištami 48,2 mm) podle výkresu „Board Dimensions“ v Getting Started Guide '
        + 'ESP32-DevKitC V4 (docs.espressif.com, ESP-IDF). Deska nemá montážní díry – sloupky jsou jen opěry mezi řadami kolíků '
        + '(výška 9 mm kvůli kolíkovým lištám); desku zajistěte oboustrannou páskou nebo lepidlem.',
      uprav(p) {
        Object.assign(p.deska, {
          pouzit: true, nazev: 'ESP32-DevKitC V4', delka: 54.4, sirka: 27.9, tloustka: 1.6, x: 0.5, y: 1.6, vyskaSoucastek: 5,
          sloupky: { vyska: 9, prumer: 5, dira: 0, pruchozi: false },
          otvory: [[8, 9], [8, 18.9], [40, 9], [40, 18.9]],
        });
        p.vnitrni = { delka: 57, sirka: 31.1, vyska: 22 };
        p.konektory = [
          { nazev: 'Micro-USB', typ: 'usb-micro', plocha: 'x-', vztah: 'deska', u: 13.95, v: 1.5, sirka: 11, vyska: 7.5, zaobleni: 1.5 },
        ];
        p.vetrani = [{ plocha: 'viko', u: 8, v: 0, pocet: 5, sirka: 2, delka: 18, rozestup: 5, orientace: 'svisle' }];
        p.pruchodky = [];
      },
    },
    esp8266_nodemcu: {
      nazev: 'ESP8266 NodeMCU v1.0 (Amica)',
      zdroj: 'Rozměr 49 × 26 mm a díry Ø 3 mm v rozteči 44 × 21 mm podle údajů výrobců a ověřených krabiček pro desky 49 × 26 mm; '
        + 'oficiální výkres není k dispozici (projekt nodemcu-devkit-v1.0 má jen soubory DPS) – rozteč děr si přeměřte. '
        + 'Pozor: NodeMCU „v3“ od LoLin je větší (≈ 58 × 31 mm) a má jinou rozteč.',
      uprav(p) {
        Object.assign(p.deska, {
          pouzit: true, nazev: 'NodeMCU v1.0 (Amica)', delka: 49, sirka: 26, tloustka: 1.6, x: 0.5, y: 1.6, vyskaSoucastek: 5,
          sloupky: { vyska: 9, prumer: 5, dira: 2.1, pruchozi: false },
          otvory: [[2.5, 2.5], [46.5, 2.5], [2.5, 23.5], [46.5, 23.5]],
        });
        p.vnitrni = { delka: 52, sirka: 29.2, vyska: 22 };
        p.konektory = [
          { nazev: 'Micro-USB', typ: 'usb-micro', plocha: 'x-', vztah: 'deska', u: 13, v: 1.5, sirka: 11, vyska: 7.5, zaobleni: 1.5 },
        ];
        p.vetrani = [{ plocha: 'viko', u: 6, v: 0, pocet: 5, sirka: 2, delka: 16, rozestup: 5, orientace: 'svisle' }];
        p.pruchodky = [];
      },
    },
    univerzalni_7050: {
      nazev: 'Univerzální DPS 70 × 50 mm',
      zdroj: 'Běžná oboustranná prototypová deska 5 × 7 cm s rastrem 2,54 mm; díry Ø 2–3 mm cca 2,5 mm od okrajů se u výrobců liší – přeměřte.',
      uprav(p) {
        Object.assign(p.deska, {
          pouzit: true, nazev: 'Univerzální DPS 70 × 50', delka: 70, sirka: 50, tloustka: 1.6, x: 3, y: 3, vyskaSoucastek: 15,
          sloupky: { vyska: 5, prumer: 6, dira: 2.5, pruchozi: false },
          otvory: [[2.5, 2.5], [67.5, 2.5], [2.5, 47.5], [67.5, 47.5]],
        });
        p.vnitrni = { delka: 76, sirka: 56, vyska: 25 };
        p.konektory = [];
        p.vetrani = [
          { plocha: 'y-', u: 0, v: 13, pocet: 8, sirka: 2, delka: 8, rozestup: 5, orientace: 'svisle' },
          { plocha: 'y+', u: 0, v: 13, pocet: 8, sirka: 2, delka: 8, rozestup: 5, orientace: 'svisle' },
        ];
        p.pruchodky = [{ typ: 'pg7', plocha: 'x+', u: 0, v: 12, prumer: 12.7 }];
      },
    },
    univerzalni_9070: {
      nazev: 'Univerzální DPS 90 × 70 mm',
      zdroj: 'Prototypová deska 7 × 9 cm, díry obvykle Ø 3 mm cca 2,5 mm od okrajů – přeměřte.',
      uprav(p) {
        Object.assign(p.deska, {
          pouzit: true, nazev: 'Univerzální DPS 90 × 70', delka: 90, sirka: 70, tloustka: 1.6, x: 3, y: 3, vyskaSoucastek: 15,
          sloupky: { vyska: 5, prumer: 6, dira: 2.5, pruchozi: false },
          otvory: [[2.5, 2.5], [87.5, 2.5], [2.5, 67.5], [87.5, 67.5]],
        });
        p.vnitrni = { delka: 96, sirka: 76, vyska: 28 };
        p.konektory = [];
        p.vetrani = [{ plocha: 'viko', u: 0, v: 0, pocet: 9, sirka: 2, delka: 40, rozestup: 5, orientace: 'svisle' }];
        p.pruchodky = [{ typ: 'm16', plocha: 'x+', u: 0, v: 14, prumer: 16.2 }];
      },
    },
  };

  /* ---------- pomocné ---------- */
  const kopie = o => JSON.parse(JSON.stringify(o));
  const cislo = (x, d) => { const n = typeof x === 'string' ? parseFloat(x.replace(',', '.')) : Number(x); return Number.isFinite(n) ? n : d; };
  function fmt(x, des = 1) {
    if (!Number.isFinite(x)) return '–';
    const s = (Math.round(x * 10 ** des) / 10 ** des).toFixed(des).replace(/\.?0+$/, '');
    return s.replace('-', '−').replace('.', ',');
  }

  function vychoziProjekt(predvolba) {
    const p = kopie(VYCHOZI);
    if (predvolba && PREDVOLBY[predvolba]) PREDVOLBY[predvolba].uprav(p);
    return p;
  }

  /* Rozsahy číselných parametrů: [min, max]. Mimo rozsah se hodnota ořízne a vznikne hlášení. */
  const ROZSAHY = {
    'vnitrni.delka': [5, 500], 'vnitrni.sirka': [5, 500], 'vnitrni.vyska': [2, 300],
    stena: [0.2, 20], dno: [0.2, 20], zaobleni: [0, 100], segmenty: [8, 128],
    tolerance: [-1, 2], tryska: [0.1, 2], minTloustka: [0.1, 10],
    'viko.tloustka': [0.2, 20], 'viko.vule': [0, 3], 'viko.vyskaOsazeni': [0.5, 50], 'viko.stenaOsazeni': [0.3, 10],
    'viko.presahZapadky': [0.1, 3],
    'viko.sroub.prumer': [1, 10], 'viko.sroub.pilot': [0.5, 10], 'viko.sroub.hloubka': [1, 300], 'viko.sroub.sloupek': [2, 40],
    'viko.sroub.hlava': [1, 25], 'viko.sroub.hloubkaHlavy': [0, 20],
    'deska.delka': [1, 500], 'deska.sirka': [1, 500], 'deska.tloustka': [0.2, 10], 'deska.x': [-50, 500], 'deska.y': [-50, 500],
    'deska.vyskaSoucastek': [0, 300],
    'deska.sloupky.vyska': [0.5, 200], 'deska.sloupky.prumer': [1, 40], 'deska.sloupky.dira': [0, 30],
    'montaz.prumer': [1, 30], 'montaz.delkaUcha': [3, 100], 'montaz.sirkaUcha': [3, 200], 'montaz.tloustkaUcha': [0.5, 30],
  };
  const vezmi = (o, cesta) => cesta.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, cesta, h) { const k = cesta.split('.'); const p = k.pop(); k.reduce((a, x) => a[x], o)[p] = h; }

  /* Doplní chybějící hodnoty z výchozích, převede na čísla, ořízne do rozsahů.
     Vrací {p, hlaseni: [text]} – p je nová kopie. */
  function normalizuj(vstup) {
    const hlaseni = [];
    const p = kopie(VYCHOZI);
    const slij = (cil, zdroj) => {
      if (!zdroj || typeof zdroj !== 'object') return;
      for (const k of Object.keys(cil)) {
        if (!(k in zdroj)) continue;
        if (Array.isArray(cil[k])) { if (Array.isArray(zdroj[k])) cil[k] = kopie(zdroj[k]); }
        else if (cil[k] && typeof cil[k] === 'object') slij(cil[k], zdroj[k]);
        else cil[k] = zdroj[k];
      }
    };
    slij(p, vstup || {});
    p.nazev = String(p.nazev || 'Krabička').slice(0, 120);
    for (const [cesta, [mn, mx]] of Object.entries(ROZSAHY)) {
      const puv = vezmi(p, cesta), vych = vezmi(VYCHOZI, cesta);
      let h = cislo(puv, NaN);
      if (!Number.isFinite(h)) { if (puv !== undefined) hlaseni.push(`${cesta}: neplatná hodnota „${puv}“, použito ${fmt(vych, 2)}`); h = vych; }
      if (h < mn) { hlaseni.push(`${cesta}: ${fmt(h, 2)} je pod minimem ${fmt(mn, 2)}`); h = mn; }
      if (h > mx) { hlaseni.push(`${cesta}: ${fmt(h, 2)} je nad maximem ${fmt(mx, 2)}`); h = mx; }
      poloz(p, cesta, h);
    }
    p.segmenty = Math.round(p.segmenty);
    if (!['nasazovaci', 'sroubovaci', 'zadne'].includes(p.viko.typ)) { hlaseni.push('neznámý typ víka, použito nasazovací'); p.viko.typ = 'nasazovaci'; }
    if (!['zadne', 'valcove', 'kuzelove'].includes(p.viko.sroub.zahloubeni)) p.viko.sroub.zahloubeni = 'zadne';
    if (!['zadne', 'usi', 'dno'].includes(p.montaz.typ)) p.montaz.typ = 'zadne';
    for (const k of ['osazeni', 'zapadky']) p.viko[k] = !!p.viko[k];
    p.deska.pouzit = !!p.deska.pouzit; p.deska.sloupky.pruchozi = !!p.deska.sloupky.pruchozi;
    p.deska.nazev = String(p.deska.nazev || 'Deska').slice(0, 80);
    const body = (sez, co) => (Array.isArray(sez) ? sez : []).map(b => [cislo(b && b[0], NaN), cislo(b && b[1], NaN)])
      .filter(b => { const ok = b.every(Number.isFinite); if (!ok) hlaseni.push(`${co}: vynechán bod s neplatnou souřadnicí`); return ok; });
    p.deska.otvory = body(p.deska.otvory, 'díry desky');
    p.montaz.otvory = body(p.montaz.otvory, 'montážní otvory');
    const plocha = (x, i, co) => { if (PLOCHY.includes(x)) return x; hlaseni.push(`${co} ${i + 1}: neznámá plocha, použita −X`); return 'x-'; };
    const kladne = (x, d, co) => { const n = cislo(x, NaN); if (!(n > 0)) { hlaseni.push(`${co}: rozměr musí být kladný, použito ${fmt(d)}`); return d; } return Math.min(n, 400); };
    p.vetrani = (Array.isArray(p.vetrani) ? p.vetrani : []).map((v, i) => ({
      plocha: plocha(v.plocha, i, 'větrání'), u: cislo(v.u, 0), v: cislo(v.v, 10),
      pocet: Math.max(1, Math.min(60, Math.round(cislo(v.pocet, 5)))), sirka: kladne(v.sirka, 2, 'štěrbina'),
      delka: kladne(v.delka, 10, 'štěrbina'), rozestup: kladne(v.rozestup, 5, 'rozteč štěrbin'),
      orientace: v.orientace === 'vodorovne' ? 'vodorovne' : 'svisle',
    }));
    p.pruchodky = (Array.isArray(p.pruchodky) ? p.pruchodky : []).map((v, i) => ({
      typ: PRUCHODKY[v.typ] ? v.typ : 'vlastni', plocha: plocha(v.plocha, i, 'průchodka'),
      u: cislo(v.u, 0), v: cislo(v.v, 10), prumer: kladne(v.prumer, 8, 'průchodka'),
    }));
    p.konektory = (Array.isArray(p.konektory) ? p.konektory : []).map((v, i) => ({
      nazev: String(v.nazev || (KONEKTORY[v.typ] || KONEKTORY.vlastni).nazev).slice(0, 60),
      typ: KONEKTORY[v.typ] ? v.typ : 'vlastni', plocha: plocha(v.plocha, i, 'konektor'),
      vztah: v.vztah === 'deska' ? 'deska' : 'krabicka', u: cislo(v.u, 0), v: cislo(v.v, 5),
      sirka: kladne(v.sirka, 10, 'konektor'), vyska: kladne(v.vyska, 6, 'konektor'), zaobleni: Math.max(0, cislo(v.zaobleni, 0)),
    }));
    return { p, hlaseni };
  }

  /* ---------- odvozené rozměry ---------- */
  function odvozene(p) {
    const Li = p.vnitrni.delka, Wi = p.vnitrni.sirka, Hi = p.vnitrni.vyska, t = p.stena;
    const Lo = Li + 2 * t, Wo = Wi + 2 * t, Hb = p.dno + Hi;
    const R = Math.max(0, Math.min(p.zaobleni, Lo / 2 - 0.05, Wo / 2 - 0.05));
    const Ri = Math.max(0, R - t);
    const maViko = p.viko.typ !== 'zadne';
    const sroub = p.viko.typ === 'sroubovaci';
    const osazeni = maViko && (p.viko.typ === 'nasazovaci' || p.viko.osazeni);
    const Hv = maViko ? p.viko.tloustka : 0;
    const usi = p.montaz.typ === 'usi' ? p.montaz.delkaUcha : 0;
    // středy šroubových sloupků v rozích (tečně ke stěnám)
    const D = p.viko.sroub.sloupek;
    const sroubyXY = sroub ? [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => [sx * (Li / 2 - D / 2), sy * (Wi / 2 - D / 2)]) : [];
    const pcb0 = [-Li / 2 + p.deska.x, -Wi / 2 + p.deska.y, p.dno + p.deska.sloupky.vyska];   // roh desky (spodní plocha)
    return {
      Li, Wi, Hi, t, Lo, Wo, Hb, R, Ri, maViko, sroub, osazeni, Hv, sroubyXY, pcb0,
      celkem: [Lo + 2 * usi, Wo, Hb + Hv],
    };
  }

  /* Absolutní poloha prvku na ploše: {u, v} v souřadnicích plochy krabičky.
     Stěny: u = vodorovně podél stěny od středu (kladně ve směru +X/+Y), v = výška nad horní plochou dna.
     Víko a dno: u = x, v = y od středu. Prvky „vztah: deska“ mají u, v vůči rohu desky / horní ploše desky. */
  function absolutni(p, prvek) {
    if (prvek.vztah !== 'deska') return { u: prvek.u, v: prvek.v };
    const o = odvozene(p);
    const dx = o.pcb0[0], dy = o.pcb0[1], vrch = p.deska.sloupky.vyska + p.deska.tloustka;
    switch (prvek.plocha) {
      case 'x-': case 'x+': return { u: dy + prvek.u, v: vrch + prvek.v };
      case 'y-': case 'y+': return { u: dx + prvek.u, v: vrch + prvek.v };
      default: return { u: dx + prvek.u, v: dy + prvek.v };
    }
  }

  /* Obdélníky 2D (střed u, v; šířka podél u, výška podél v) všech výřezů – pro kontroly i pro geometrii. */
  function vyrezy(p) {
    const tol = p.tolerance, out = [];
    for (const [i, k] of p.konektory.entries()) {
      const a = absolutni(p, k);
      out.push({ druh: 'konektor', i, nazev: k.nazev, plocha: k.plocha, tvar: 'obdelnik', u: a.u, v: a.v,
        w: k.sirka + tol, h: k.vyska + tol, r: Math.min(k.zaobleni + tol / 2, (k.sirka + tol) / 2, (k.vyska + tol) / 2) });
    }
    for (const [i, k] of p.pruchodky.entries()) {
      const d = k.prumer + tol;
      out.push({ druh: 'pruchodka', i, nazev: (PRUCHODKY[k.typ] || PRUCHODKY.vlastni).nazev, plocha: k.plocha, tvar: 'kruh', u: k.u, v: k.v, w: d, h: d, r: d / 2 });
    }
    for (const [i, s] of p.vetrani.entries()) {
      const svisle = s.orientace === 'svisle';
      const w0 = s.sirka + tol, l0 = s.delka + tol;
      for (let j = 0; j < s.pocet; j++) {
        const off = (j - (s.pocet - 1) / 2) * s.rozestup;
        out.push({ druh: 'vetrani', i, j, nazev: 'štěrbina', plocha: s.plocha, tvar: 'obdelnik',
          u: s.u + (svisle ? off : 0), v: s.v + (svisle ? 0 : off), w: svisle ? w0 : l0, h: svisle ? l0 : w0, r: w0 / 2 });
      }
    }
    return out;
  }

  /* ---------- kontroly parametrů (tisknutelnost, kolize) ---------- */
  function kontroly(p) {
    const o = odvozene(p), H = [];
    const chyba = t => H.push({ uroven: 'chyba', text: t });
    const varuj = t => H.push({ uroven: 'varovani', text: t });
    const info = t => H.push({ uroven: 'info', text: t });
    const min = p.minTloustka, tr = p.tryska;
    const tloustka = (h, co) => {
      if (h < tr - 1e-9) chyba(`${co}: ${fmt(h, 2)} mm je méně než průměr trysky ${fmt(tr, 2)} mm – nevytiskne se.`);
      else if (h < min - 1e-9) varuj(`${co}: ${fmt(h, 2)} mm je pod minimální tloušťkou ${fmt(min, 2)} mm.`);
    };
    tloustka(p.stena, 'Stěna');
    tloustka(p.dno, 'Dno');
    if (p.stena < 2 * tr - 1e-9 && p.stena >= tr) info(`Stěna ${fmt(p.stena, 2)} mm odpovídá méně než dvěma perimetrům trysky ${fmt(tr, 2)} mm.`);
    if (o.maViko) tloustka(p.viko.tloustka, 'Víko');
    if (o.osazeni) {
      tloustka(p.viko.stenaOsazeni, 'Stěna osazení víka');
      const li = o.Li - 2 * p.viko.vule - 2 * p.viko.stenaOsazeni, wi = o.Wi - 2 * p.viko.vule - 2 * p.viko.stenaOsazeni;
      if (li <= 1 || wi <= 1) chyba('Osazení víka se do dutiny nevejde (příliš silná stěna osazení nebo vůle).');
      if (p.viko.vyskaOsazeni > o.Hi - 0.5) chyba('Osazení víka je vyšší než dutina krabičky.');
      if (p.viko.vule < 0.1) varuj(`Vůle víka ${fmt(p.viko.vule, 2)} mm je velmi těsná – na FDM tiskárně víko nejspíš nepůjde nasadit.`);
      if (p.viko.vule > 0.6) varuj(`Vůle víka ${fmt(p.viko.vule, 2)} mm je velká – víko bude volné.`);
      if (p.viko.typ === 'nasazovaci' && p.viko.zapadky) {
        const r = p.viko.presahZapadky;
        tloustka(p.stena - (r + p.tolerance / 2), 'Stěna v místě drážky západky');
        if (r <= p.viko.vule) varuj('Přesah západky je menší než vůle víka – západka nebude držet.');
        if (2 * r + 0.5 > p.viko.vyskaOsazeni) chyba('Západka se nevejde na výšku osazení.');
      }
    }
    if (o.sroub) {
      const s = p.viko.sroub;
      tloustka((s.sloupek - s.pilot - p.tolerance) / 2, 'Stěna šroubového sloupku');
      if (s.pilot >= s.prumer) varuj('Předvrtaný otvor pro samořezný šroub by měl být menší než průměr šroubu (obvykle 0,8–0,85 × d).');
      if (s.hloubka > o.Hi + p.dno - 0.6) chyba('Díra pro šroub je hlubší než krabička.');
      if (s.sloupek * 2 > Math.min(o.Li, o.Wi)) chyba('Šroubové sloupky v rozích se navzájem překrývají – zmenšete průměr sloupku.');
      if (s.zahloubeni !== 'zadne') {
        if (s.hlava <= s.prumer) chyba('Průměr hlavy šroubu musí být větší než průměr šroubu.');
        const hl = s.zahloubeni === 'kuzelove' ? (s.hlava - s.prumer) / 2 : s.hloubkaHlavy;
        tloustka(p.viko.tloustka - hl, 'Víko pod zahloubením hlavy šroubu');
      }
      if (s.hlava + p.tolerance > s.sloupek + 2 * p.stena) varuj('Hlava šroubu přesahuje šroubový sloupek i stěnu.');
    }
    if (o.R < p.zaobleni - 1e-6) info(`Zaoblení rohů omezeno na ${fmt(o.R, 2)} mm (polovina menšího vnějšího rozměru).`);
    if (o.R > 0 && o.R < p.stena) info('Zaoblení je menší než tloušťka stěny – vnitřní rohy dutiny zůstanou ostré.');

    // deska a sloupky
    if (p.deska.pouzit) {
      const d = p.deska, sl = d.sloupky;
      if (d.x < 0 || d.y < 0 || d.x + d.delka > o.Li + 1e-6 || d.y + d.sirka > o.Wi + 1e-6) chyba('Deska přesahuje vnitřní prostor krabičky.');
      if (sl.vyska + d.tloustka + d.vyskaSoucastek > o.Hi - (o.osazeni ? 0 : 0) + 1e-6)
        varuj(`Deska se součástkami (${fmt(sl.vyska + d.tloustka + d.vyskaSoucastek)} mm nad dnem) je vyšší než dutina (${fmt(o.Hi)} mm).`);
      if (sl.dira > 0) {
        tloustka((sl.prumer - sl.dira - p.tolerance) / 2, 'Stěna sloupku desky');
        if (sl.dira + p.tolerance >= sl.prumer) chyba('Díra ve sloupku je větší než sloupek.');
      }
      for (const [i, [hx, hy]] of d.otvory.entries()) {
        const X = o.pcb0[0] + hx, Y = o.pcb0[1] + hy, r = sl.prumer / 2;
        if (hx < 0 || hy < 0 || hx > d.delka || hy > d.sirka) varuj(`Sloupek ${i + 1} leží mimo obrys desky.`);
        if (Math.abs(X) + r > o.Li / 2 + 1e-6 || Math.abs(Y) + r > o.Wi / 2 + 1e-6) varuj(`Sloupek ${i + 1} zasahuje do stěny krabičky.`);
        for (const [sx, sy] of o.sroubyXY) {
          if (Math.hypot(X - sx, Y - sy) < r + p.viko.sroub.sloupek / 2) varuj(`Sloupek ${i + 1} koliduje se šroubovým sloupkem víka.`);
        }
        if (o.osazeni && sl.vyska + d.tloustka + d.vyskaSoucastek > o.Hi - p.viko.vyskaOsazeni
          && (Math.abs(X) > o.Li / 2 - p.viko.vule - p.viko.stenaOsazeni - r || Math.abs(Y) > o.Wi / 2 - p.viko.vule - p.viko.stenaOsazeni - r)) {
          // jen informace – osazení je u stěn
        }
      }
      if (o.osazeni && sl.vyska + d.tloustka + d.vyskaSoucastek > o.Hi - p.viko.vyskaOsazeni) {
        const okraj = Math.min(d.x, d.y, o.Li - d.x - d.delka, o.Wi - d.y - d.sirka);
        if (okraj < p.viko.vule + p.viko.stenaOsazeni) info('Součástky u okraje desky mohou narazit do osazení víka (zkontrolujte rozloženým pohledem).');
      }
    }

    // montáž
    if (p.montaz.typ === 'usi') {
      const m = p.montaz;
      tloustka(m.tloustkaUcha, 'Montážní ucho');
      tloustka((Math.min(m.sirkaUcha, m.delkaUcha) - m.prumer - p.tolerance) / 2, 'Okraj montážního ucha');
      if (m.prumer + p.tolerance >= m.delkaUcha) chyba('Otvor v montážním uchu je delší než ucho.');
      if (m.sirkaUcha > o.Wo) varuj('Montážní ucho je širší než krabička.');
    }
    if (p.montaz.typ === 'dno') {
      if (!p.montaz.otvory.length) info('Montáž dnem: nejsou zadané žádné otvory.');
      for (const [i, [x, y]] of p.montaz.otvory.entries()) {
        const r = (p.montaz.prumer + p.tolerance) / 2;
        if (Math.abs(x) + r > o.Li / 2 || Math.abs(y) + r > o.Wi / 2) varuj(`Montážní otvor ${i + 1} zasahuje do stěny.`);
      }
    }

    // výřezy
    const vy = vyrezy(p);
    const vrchStena = o.Hi;
    for (const z of vy) {
      const jm = z.druh === 'vetrani' ? `Větrání ${z.i + 1}` : z.druh === 'pruchodka' ? `Průchodka ${z.i + 1}` : `Konektor ${z.i + 1} (${z.nazev})`;
      if (z.druh === 'vetrani' && z.j > 0) continue;
      const vsech = z.druh === 'vetrani' ? vy.filter(q => q.druh === 'vetrani' && q.i === z.i) : [z];
      const umin = Math.min(...vsech.map(q => q.u - q.w / 2)), umax = Math.max(...vsech.map(q => q.u + q.w / 2));
      const vmin = Math.min(...vsech.map(q => q.v - q.h / 2)), vmax = Math.max(...vsech.map(q => q.v + q.h / 2));
      if (z.plocha === 'viko' || z.plocha === 'dno') {
        if (z.plocha === 'viko' && !o.maViko) { varuj(`${jm}: krabička nemá víko, výřez se neprovede.`); continue; }
        const lx = (z.plocha === 'viko' && o.osazeni) ? o.Li / 2 - p.viko.vule - p.viko.stenaOsazeni : o.Li / 2;
        const ly = (z.plocha === 'viko' && o.osazeni) ? o.Wi / 2 - p.viko.vule - p.viko.stenaOsazeni : o.Wi / 2;
        if (umin < -lx || umax > lx || vmin < -ly || vmax > ly) varuj(`${jm}: zasahuje mimo vnitřní plochu ${z.plocha === 'viko' ? 'víka (do osazení nebo okraje)' : 'dna (do stěny)'}.`);
        if (z.plocha === 'dno' && p.deska.pouzit) {
          for (const [hx, hy] of p.deska.otvory) {
            const X = o.pcb0[0] + hx, Y = o.pcb0[1] + hy, r = p.deska.sloupky.prumer / 2;
            if (X + r > umin && X - r < umax && Y + r > vmin && Y - r < vmax) { varuj(`${jm}: prochází pod sloupkem desky.`); break; }
          }
        }
      } else {
        const podelX = z.plocha[0] === 'y';
        const polo = (podelX ? o.Li : o.Wi) / 2, rovna = (podelX ? o.Lo : o.Wo) / 2 - o.R;
        if (umin < -polo || umax > polo) varuj(`${jm}: přesahuje šířku stěny (${NAZVY_PLOCH[z.plocha]}).`);
        else if (umin < -rovna || umax > rovna) info(`${jm}: zasahuje do zaobleného rohu.`);
        if (vmin < 0) varuj(`${jm}: zasahuje pod úroveň dna dutiny – prořízne i dno.`);
        if (vmax > vrchStena) info(`${jm}: sahá nad horní hranu stěny – vznikne otevřený zářez.`);
        if (o.osazeni && vmax > vrchStena - p.viko.vyskaOsazeni && vmin < vrchStena) info(`${jm}: je ve výšce osazení víka – osazení se v tom místě vybere.`);
        if (o.sroub && Math.max(Math.abs(umin), Math.abs(umax)) > polo - p.viko.sroub.sloupek) varuj(`${jm}: je blízko rohu se šroubovým sloupkem.`);
      }
      if (z.druh === 'vetrani') {
        const s = p.vetrani[z.i];
        tloustka(s.rozestup - s.sirka - p.tolerance, `${jm}: můstek mezi štěrbinami`);
      }
    }
    // vzájemné překrytí výřezů na stejné ploše
    for (let a = 0; a < vy.length; a++) for (let b = a + 1; b < vy.length; b++) {
      const A = vy[a], B = vy[b];
      if (A.plocha !== B.plocha || (A.druh === 'vetrani' && B.druh === 'vetrani' && A.i === B.i)) continue;
      const mezera = Math.max(Math.abs(A.u - B.u) - (A.w + B.w) / 2, Math.abs(A.v - B.v) - (A.h + B.h) / 2);
      if (mezera < min) {
        const jm = q => q.druh === 'vetrani' ? `větrání ${q.i + 1}` : q.druh === 'pruchodka' ? `průchodka ${q.i + 1}` : `konektor ${q.i + 1}`;
        varuj(`Výřezy ${jm(A)} a ${jm(B)} se ${mezera < 0 ? 'překrývají' : 'téměř dotýkají'} (${NAZVY_PLOCH[A.plocha]}).`);
        if (A.druh === 'vetrani' || B.druh === 'vetrani') b = vy.length;   // jedno hlášení na skupinu stačí
      }
    }
    const [cx, cy, cz] = o.celkem;
    if (Math.max(cx, cy) > 250 || cz > 250) info('Krabička je větší než 250 mm – ověřte velikost tiskové plochy.');
    return H;
  }

  /* ---------- kontrola sítě ---------- */
  /** Ověří, že trojúhelníková síť je uzavřená 2-varieta s konzistentní orientací:
      každá neorientovaná hrana patří právě dvěma trojúhelníkům a ty ji procházejí opačně.
      Vrací {trojuhelniku, vrcholu, hran, hranOkrajovych, hranNevarietnich, hranStejneOrientace,
      degenerovanych, objem, plocha, slozek (skořepin), dutin (uzavřených vnitřních dutin), teles,
      objemySlozek, rod (součet rodů skořepin), uzavrena, normalyVen, bbox}. */
  function kontrolaSite(poz, idx) {
    const nV = poz.length / 3, nT = idx.length / 3;
    const smer = new Map();          // klíč a*nV+b → počet výskytů orientované hrany
    let degenerovanych = 0, objem = 0, plocha = 0;
    const bbox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < nV; i++) for (let k = 0; k < 3; k++) {
      const v = poz[3 * i + k]; if (v < bbox[k]) bbox[k] = v; if (v > bbox[k + 3]) bbox[k + 3] = v;
    }
    for (let t = 0; t < nT; t++) {
      const a = idx[3 * t], b = idx[3 * t + 1], c = idx[3 * t + 2];
      for (const [p, q] of [[a, b], [b, c], [c, a]]) { const k = p * nV + q; smer.set(k, (smer.get(k) || 0) + 1); }
      const ax = poz[3 * a], ay = poz[3 * a + 1], az = poz[3 * a + 2];
      const ux = poz[3 * b] - ax, uy = poz[3 * b + 1] - ay, uz = poz[3 * b + 2] - az;
      const vx = poz[3 * c] - ax, vy = poz[3 * c + 1] - ay, vz = poz[3 * c + 2] - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const A = Math.hypot(nx, ny, nz) / 2;
      if (A < 1e-12 || a === b || b === c || a === c) degenerovanych++;
      plocha += A;
      // objem z divergence: součet (a · (b × c)) / 6
      const bx = poz[3 * b], by = poz[3 * b + 1], bz = poz[3 * b + 2], cx = poz[3 * c], cy = poz[3 * c + 1], cz = poz[3 * c + 2];
      objem += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    }
    let hranOkrajovych = 0, hranNevarietnich = 0, hranStejneOrientace = 0, hran = 0;
    for (const [k, n] of smer) {
      const a = Math.floor(k / nV), b = k - a * nV;
      const r = smer.get(b * nV + a) || 0;
      if (n > 1) hranStejneOrientace++;
      if (a < b || !r) {
        hran++;
        if (!r) hranOkrajovych++;
        else if (n !== 1 || r !== 1) hranNevarietnich++;
      }
    }
    // komponenty (union-find přes vrcholy trojúhelníků)
    const rod = new Int32Array(nV).map((_, i) => i);
    const najdi = x => { while (rod[x] !== x) { rod[x] = rod[rod[x]]; x = rod[x]; } return x; };
    const pouzite = new Uint8Array(nV);
    for (let t = 0; t < nT; t++) {
      const a = idx[3 * t], b = idx[3 * t + 1], c = idx[3 * t + 2];
      pouzite[a] = pouzite[b] = pouzite[c] = 1;
      const ra = najdi(a), rb = najdi(b), rc = najdi(c); rod[rb] = ra; rod[najdi(rc)] = ra;
    }
    let slozek = 0, Vp = 0;
    for (let i = 0; i < nV; i++) if (pouzite[i]) { Vp++; if (najdi(i) === i) slozek++; }
    // objem každé složky: záporný = uzavřená vnitřní dutina (skořepina obrácená dovnitř)
    const objSl = new Map();
    for (let t = 0; t < nT; t++) {
      const a = idx[3 * t], b = idx[3 * t + 1], c = idx[3 * t + 2];
      const ax = poz[3 * a], ay = poz[3 * a + 1], az = poz[3 * a + 2], bx = poz[3 * b], by = poz[3 * b + 1], bz = poz[3 * b + 2];
      const cx = poz[3 * c], cy = poz[3 * c + 1], cz = poz[3 * c + 2];
      const r = najdi(a);
      objSl.set(r, (objSl.get(r) || 0) + (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6);
    }
    const objemySlozek = [...objSl.values()].sort((x, y) => y - x);
    const dutin = objemySlozek.filter(v => v < 0).length;
    // Eulerova charakteristika: V − E + F = 2(S − g) pro S uzavřených složek
    const chi = Vp - hran + nT;
    const genus = slozek - chi / 2;
    const uzavrena = nT > 0 && !hranOkrajovych && !hranNevarietnich && !hranStejneOrientace;
    return {
      trojuhelniku: nT, vrcholu: Vp, hran, hranOkrajovych, hranNevarietnich, hranStejneOrientace, degenerovanych,
      objem, plocha, slozek, dutin, teles: slozek - dutin, objemySlozek, rod: genus, uzavrena, normalyVen: objem > 0, bbox,
    };
  }

  /* ---------- tloušťky stěn paprsky ----------
     Z náhodných bodů povrchu (vážených plochou, pevné semínko) se vyšle paprsek dovnitř tělesa
     (proti normále) a změří se vzdálenost k nejbližšímu dalšímu průsečíku s povrchem = místní tloušťka. */
  function tloustky(poz, idx, volby = {}) {
    const vzorku = volby.vzorku || 2000, limit = volby.limit || 0.8;
    const nT = idx.length / 3;
    const T = new Float64Array(nT * 9), N = new Float64Array(nT * 3), A = new Float64Array(nT), B = new Float64Array(nT * 6);
    let celk = 0;
    for (let t = 0; t < nT; t++) {
      for (let k = 0; k < 3; k++) { const v = idx[3 * t + k]; T[9 * t + 3 * k] = poz[3 * v]; T[9 * t + 3 * k + 1] = poz[3 * v + 1]; T[9 * t + 3 * k + 2] = poz[3 * v + 2]; }
      const o = 9 * t;
      const ux = T[o + 3] - T[o], uy = T[o + 4] - T[o + 1], uz = T[o + 5] - T[o + 2];
      const vx = T[o + 6] - T[o], vy = T[o + 7] - T[o + 1], vz = T[o + 8] - T[o + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz); A[t] = l / 2; celk += A[t];
      if (l > 0) { nx /= l; ny /= l; nz /= l; }
      N[3 * t] = nx; N[3 * t + 1] = ny; N[3 * t + 2] = nz;
      for (let k = 0; k < 3; k++) {
        B[6 * t + k] = Math.min(T[o + k], T[o + 3 + k], T[o + 6 + k]);
        B[6 * t + 3 + k] = Math.max(T[o + k], T[o + 3 + k], T[o + 6 + k]);
      }
    }
    // kumulativní plochy pro výběr trojúhelníku
    const kum = new Float64Array(nT); let s = 0;
    for (let t = 0; t < nT; t++) { s += A[t]; kum[t] = s; }
    let sem = 12345;
    const rnd = () => { sem = (Math.imul(sem, 1103515245) + 12345) >>> 0; return sem / 4294967296; };
    const body = []; let minT = Infinity, minBod = null, zahozeno = 0;
    const pocet = vzorku;
    for (let i = 0; i < pocet && celk > 0; i++) {
      const x = rnd() * celk;
      let lo = 0, hi = nT - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (kum[m] < x) lo = m + 1; else hi = m; }
      const t = lo, o = 9 * t;
      let r1 = rnd(), r2 = rnd(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
      // bod kousek od hran trojúhelníku, aby paprsek nešel hranou
      r1 = 0.05 + 0.9 * r1; r2 = 0.05 + 0.9 * r2; if (r1 + r2 > 0.95) { const k = 0.95 / (r1 + r2); r1 *= k; r2 *= k; }
      const px = T[o] + r1 * (T[o + 3] - T[o]) + r2 * (T[o + 6] - T[o]);
      const py = T[o + 1] + r1 * (T[o + 4] - T[o + 1]) + r2 * (T[o + 7] - T[o + 1]);
      const pz = T[o + 2] + r1 * (T[o + 5] - T[o + 2]) + r2 * (T[o + 8] - T[o + 2]);
      const dx = -N[3 * t], dy = -N[3 * t + 1], dz = -N[3 * t + 2];
      const [d, th] = paprsek(T, B, nT, px, py, pz, dx, dy, dz, t);
      if (!Number.isFinite(d)) continue;
      // výstupní plocha musí stát proti paprsku (≤ 60°); šikmé zásahy u rohů tloušťku neměří
      if (N[3 * th] * dx + N[3 * th + 1] * dy + N[3 * th + 2] * dz < 0.5) { zahozeno++; continue; }
      body.push([px, py, pz, d]);
      if (d < minT) { minT = d; minBod = [px, py, pz]; }
    }
    const tenke = body.filter(b => b[3] < limit - 1e-6);
    return { min: minT, minBod, vzorku: body.length, zahozeno, tenke, limit };
  }
  function paprsek(T, B, nT, px, py, pz, dx, dy, dz, vlastni) {
    let best = Infinity, bt = -1;
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    for (let t = 0; t < nT; t++) {
      if (t === vlastni) continue;
      // test obalového kvádru (slab)
      const b = 6 * t;
      let t0 = (B[b] - px) * ix, t1 = (B[b + 3] - px) * ix; if (t0 > t1) { const q = t0; t0 = t1; t1 = q; }
      let tmin = t0, tmax = t1;
      t0 = (B[b + 1] - py) * iy; t1 = (B[b + 4] - py) * iy; if (t0 > t1) { const q = t0; t0 = t1; t1 = q; }
      if (t0 > tmin) tmin = t0; if (t1 < tmax) tmax = t1;
      t0 = (B[b + 2] - pz) * iz; t1 = (B[b + 5] - pz) * iz; if (t0 > t1) { const q = t0; t0 = t1; t1 = q; }
      if (t0 > tmin) tmin = t0; if (t1 < tmax) tmax = t1;
      if (!(tmax >= Math.max(tmin, 0)) || tmin > best) continue;
      // Möller–Trumbore
      const o = 9 * t;
      const e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2];
      const e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
      const qx = dy * e2z - dz * e2y, qy = dz * e2x - dx * e2z, qz = dx * e2y - dy * e2x;
      const det = e1x * qx + e1y * qy + e1z * qz;
      if (Math.abs(det) < 1e-14) continue;
      const f = 1 / det;
      const sx = px - T[o], sy = py - T[o + 1], sz = pz - T[o + 2];
      const u = f * (sx * qx + sy * qy + sz * qz); if (u < -1e-9 || u > 1 + 1e-9) continue;
      const rx = sy * e1z - sz * e1y, ry = sz * e1x - sx * e1z, rz = sx * e1y - sy * e1x;
      const v = f * (dx * rx + dy * ry + dz * rz); if (v < -1e-9 || u + v > 1 + 1e-9) continue;
      const d = f * (e2x * rx + e2y * ry + e2z * rz);
      if (d > 1e-5 && d < best) { best = d; bt = t; }
    }
    return [best, bt];
  }

  /* ---------- transformace sítí ---------- */
  function presun(sit, dx, dy, dz) {
    const poz = new Float32Array(sit.poz.length);
    for (let i = 0; i < poz.length; i += 3) { poz[i] = sit.poz[i] + dx; poz[i + 1] = sit.poz[i + 1] + dy; poz[i + 2] = sit.poz[i + 2] + dz; }
    return { poz, idx: sit.idx };
  }
  /** Otočení o 180° kolem osy X (x, −y, −z) – zachová orientaci trojúhelníků. */
  function prevrat(sit) {
    const poz = new Float32Array(sit.poz.length);
    for (let i = 0; i < poz.length; i += 3) { poz[i] = sit.poz[i]; poz[i + 1] = -sit.poz[i + 1]; poz[i + 2] = -sit.poz[i + 2]; }
    return { poz, idx: sit.idx };
  }
  function obal(poz) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) { const v = poz[i + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; }
    return b;
  }
  /** Rozložení dílů pro tisk: krabička dnem dolů, víko převrácené deskou dolů vedle ní, vše na z = 0. */
  function tiskoveRozlozeni(dily, mezera = 10) {
    const out = []; let x = 0;
    for (const d of dily) {
      let s = d.jmeno === 'viko' ? prevrat(d) : { poz: d.poz, idx: d.idx };
      const b = obal(s.poz);
      s = presun(s, x - b[0], -(b[1] + b[4]) / 2, -b[2]);
      out.push(Object.assign({}, d, s));
      x += b[3] - b[0] + mezera;
    }
    // vycentrovat sestavu kolem počátku v ose X
    const sir = x - mezera;
    return out.map(d => Object.assign({}, d, presun(d, -sir / 2, 0, 0)));
  }

  /* ---------- STL (binární) ---------- */
  function stlBinarni(dily, hlavicka = 'krabicky - parametricka krabicka') {
    const nT = dily.reduce((s, d) => s + d.idx.length / 3, 0);
    const buf = new ArrayBuffer(84 + 50 * nT), dv = new DataView(buf), u8 = new Uint8Array(buf);
    for (let i = 0; i < Math.min(80, hlavicka.length); i++) u8[i] = hlavicka.charCodeAt(i) & 0x7f;
    dv.setUint32(80, nT, true);
    let o = 84;
    for (const d of dily) {
      const P = d.poz, I = d.idx;
      for (let t = 0; t < I.length; t += 3) {
        const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
        const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
        for (const [k, v] of [[0, a], [1, b], [2, c]]) {
          dv.setFloat32(o + 12 + 12 * k, P[v], true); dv.setFloat32(o + 16 + 12 * k, P[v + 1], true); dv.setFloat32(o + 20 + 12 * k, P[v + 2], true);
        }
        dv.setUint16(o + 48, 0, true);
        o += 50;
      }
    }
    return u8;
  }

  /* ---------- ZIP (uloženo, bez komprese) + CRC32 ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c >>> 0; }
    return t;
  })();
  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const utf8 = s => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8')));
  function zip(polozky, datum = new Date(2026, 0, 1)) {
    const dosCas = (datum.getHours() << 11) | (datum.getMinutes() << 5) | (datum.getSeconds() >> 1);
    const dosDat = ((Math.max(1980, datum.getFullYear()) - 1980) << 9) | ((datum.getMonth() + 1) << 5) | datum.getDate();
    const casti = [], centralni = []; let offset = 0;
    for (const p of polozky) {
      const data = typeof p.data === 'string' ? utf8(p.data) : p.data;
      const jmeno = utf8(p.name), crc = crc32(data);
      const lok = new Uint8Array(30 + jmeno.length), dv = new DataView(lok.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true);
      dv.setUint16(10, dosCas, true); dv.setUint16(12, dosDat, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true);
      dv.setUint16(26, jmeno.length, true); lok.set(jmeno, 30);
      casti.push(lok, data);
      const cen = new Uint8Array(46 + jmeno.length), cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
      cv.setUint16(12, dosCas, true); cv.setUint16(14, dosDat, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
      cv.setUint16(28, jmeno.length, true); cv.setUint32(42, offset, true); cen.set(jmeno, 46);
      centralni.push(cen);
      offset += lok.length + data.length;
    }
    const cdVel = centralni.reduce((s, c) => s + c.length, 0);
    const konec = new Uint8Array(22), kv = new DataView(konec.buffer);
    kv.setUint32(0, 0x06054b50, true); kv.setUint16(8, polozky.length, true); kv.setUint16(10, polozky.length, true);
    kv.setUint32(12, cdVel, true); kv.setUint32(16, offset, true);
    const vse = [...casti, ...centralni, konec];
    const out = new Uint8Array(vse.reduce((s, c) => s + c.length, 0));
    let o = 0; for (const c of vse) { out.set(c, o); o += c.length; }
    return out;
  }

  /* ---------- 3MF ---------- */
  const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cisloXml = x => { const r = Math.round(x * 1e5) / 1e5; return Object.is(r, -0) ? '0' : String(r); };
  function model3mf(dily, nazev = 'Krabička') {
    const r = [];
    r.push('<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="cs-CZ" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">');
    r.push(` <metadata name="Title">${xmlEsc(nazev)}</metadata>\n <metadata name="Application">krabicky (github_site)</metadata>`);
    r.push(' <resources>\n  <basematerials id="1">');
    dily.forEach(d => r.push(`   <base name="${xmlEsc(d.nazev || d.jmeno)}" displaycolor="${d.barva || '#808080'}"/>`));
    r.push('  </basematerials>');
    dily.forEach((d, i) => {
      r.push(`  <object id="${i + 2}" type="model" name="${xmlEsc(d.nazev || d.jmeno)}" pid="1" pindex="${i}">\n   <mesh>\n    <vertices>`);
      const P = d.poz, I = d.idx, v = [];
      for (let k = 0; k < P.length; k += 3) v.push(`     <vertex x="${cisloXml(P[k])}" y="${cisloXml(P[k + 1])}" z="${cisloXml(P[k + 2])}"/>`);
      r.push(v.join('\n'));
      r.push('    </vertices>\n    <triangles>');
      const t = [];
      for (let k = 0; k < I.length; k += 3) t.push(`     <triangle v1="${I[k]}" v2="${I[k + 1]}" v3="${I[k + 2]}"/>`);
      r.push(t.join('\n'));
      r.push('    </triangles>\n   </mesh>\n  </object>');
    });
    r.push(' </resources>\n <build>');
    dily.forEach((d, i) => r.push(`  <item objectid="${i + 2}"/>`));
    r.push(' </build>\n</model>\n');
    return r.join('\n');
  }
  function soubor3mf(dily, nazev) {
    const ct = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
    const rels = '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
    return zip([
      { name: '[Content_Types].xml', data: ct },
      { name: '_rels/.rels', data: rels },
      { name: '3D/3dmodel.model', data: model3mf(dily, nazev) },
    ]);
  }

  /* ---------- projekt JSON ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_krabicky', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || typeof o !== 'object') throw new Error('Soubor neobsahuje objekt projektu.');
    if (o.format !== 'webapp_krabicky') throw new Error('Soubor není projekt krabičky (chybí "format": "webapp_krabicky").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }

  const API = {
    VYCHOZI, PREDVOLBY, KONEKTORY, PRUCHODKY, PLOCHY, NAZVY_PLOCH, VERZE_FORMATU,
    vychoziProjekt, normalizuj, odvozene, absolutni, vyrezy, kontroly, kontrolaSite, tloustky,
    presun, prevrat, obal, tiskoveRozlozeni, stlBinarni, crc32, zip, model3mf, soubor3mf,
    ulozProjekt, nactiProjekt, fmt, kopie,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.KRAB = API;
})();
