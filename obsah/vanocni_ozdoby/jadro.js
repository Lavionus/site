/* Vánoční ozdoby – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Čtyři druhy:
   • vločka – šestičetná, tvar ze semínka (stejné semínko = stejná vločka), sjednocení zaoblených úseček → jeden souvislý díl,
     žádný prvek užší než nastavené minimum;
   • hvězda – plochá, vypouklá (hrany do špičky), obrysová nebo zasouvací ze dvou plátů s výřezy;
   • baňka – rotační profil (koule, kapka, cibule, zvonek, špička) plný pro tisk ve vázovém režimu, převisy sražené na úhel tisku,
     povrch hladký / žebra / zkrut / fazety, hrdlo a samostatná čepička s očkem (zaklapne přes lem, nebo se lepí);
   • jmenovka – cedulka s textem (sazba z klicenky/jadro.js) vystouplým, zapuštěným nebo skrz, dírka na provázek.
   Vše se tiskne bez podpor a díly vznikají rovnou v tiskové poloze (z = 0 na podložce).

   postav(wasm, p, {font}) → {dily, sestava, kalibrace, o, info, cas}
   díl: {jmeno, nazev, role: 'podklad'|'text', poz, idx, objem, teles, ks, otocit: false, vaza?: true} */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const KLIC = uzel ? require('../klicenky/jadro.js') : window.KLIC;   // sazba textu z písma a barevný 3MF
  const fmt = G.fmt, kopie = G.kopie;
  const rad = s => s * Math.PI / 180, stup = r => r * 180 / Math.PI;

  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24 }, PETG: { nazev: 'PETG', hustota: 1.27 }, ABS: { nazev: 'ABS', hustota: 1.04 }, ASA: { nazev: 'ASA', hustota: 1.07 },
  };
  /** Zaklapnutí čepičky: lem na hrdle (přesah na poloměr, výška), pero v ústí čepičky, osová vůle. */
  const ZAKLAP = { presah: 0.5, lem: 0.8, pero: 0.8, osove: 0.1 };
  const NAZVY = {
    druh: { vlocka: 'vločka', hvezda: 'hvězda', banka: 'baňka', jmenovka: 'jmenovka na dárek' },
    styl: { plocha: 'plochá', vypoukla: 'vypouklá (hrany do špičky)', obrys: 'dutá obrysová', zasouvaci: 'prostorová zasouvací (2 pláty)' },
    profil: { koule: 'koule', kapka: 'kapka', cibule: 'cibule', zvonek: 'zvonek', spicka: 'špička' },
    povrch: { hladky: 'hladký', zebra: 'žebra', zkrut: 'zkrut', fazety: 'fazety' },
    spoj: { zaklapnuti: 'zaklapne přes lem', lepeni: 'přilepí se' },
    tvar: { visacka: 'visačka', obdelnik: 'obdélník', stromecek: 'stromeček', hvezda: 'hvězda', kolecko: 'kolečko' },
    rezim: { vystouply: 'vystouplý', zapusteny: 'zapuštěný', skrz: 'skrz' },
    dirka: { vlevo: 'vlevo', nahore: 'nahoře' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Vánoční ozdoba', diry: 'kapka', druh: 'vlocka', meritko: 100,
    ocko: { zap: true, prumer: 3, stena: 1.6, posun: 0 },
    vlocka: { seminko: 2026, prumer: 70, tloustka: 2, sirka: 2, vetvi: 3, delka: 100, vetvicky: true, minimum: 0.8 },
    hvezda: { styl: 'plocha', cipu: 5, vnejsi: 35, vnitrni: 15, tloustka: 2.4, vyska: 6, obrys: 3, vule: 0.15 },
    banka: {
      profil: 'koule', prumer: 50, vyska: 50, povrch: 'hladky', pocet: 12, hloubka: 1.5, zkrut: 90, srazit: true, dno: 12,
      hrdlo: 14, vyskaHrdla: 7, spoj: 'zaklapnuti', vule: 0.2, stenaCepicky: 1.2,
    },
    jmenovka: {
      tvar: 'visacka', sirka: 60, vyska: 32, tloustka: 2, zaobleni: 2, text: 'Pro Aničku', pismo: 'titan', velikost: 8, radkovani: 1.45,
      rezim: 'vystouply', vyskaTextu: 0.8, hloubka: 0.6, okraj: 2.5, dirka: 'vlevo',
    },
    barvy: { podklad: '#C0392B', text: '#F4E9D0' },
    tisk: { material: 'PLA', vrstva: 0.2, uhel: 45, stena: 0.45, dno: 0.8, podlozkaX: 220, podlozkaY: 220 },
  };
  const MEZE = {
    meritko: [25, 400],
    'ocko.prumer': [1.5, 10], 'ocko.stena': [0.8, 5], 'ocko.posun': [-2, 20],
    'vlocka.seminko': [0, 999999, 1], 'vlocka.prumer': [20, 250], 'vlocka.tloustka': [0.6, 10], 'vlocka.sirka': [0.4, 8], 'vlocka.vetvi': [0, 6, 1],
    'vlocka.delka': [30, 150], 'vlocka.minimum': [0.4, 3],
    'hvezda.cipu': [4, 16, 1], 'hvezda.vnejsi': [8, 150], 'hvezda.vnitrni': [2, 140], 'hvezda.tloustka': [0.6, 12], 'hvezda.vyska': [1, 40],
    'hvezda.obrys': [0.8, 20], 'hvezda.vule': [0, 0.6],
    'banka.prumer': [20, 150], 'banka.vyska': [20, 200], 'banka.pocet': [3, 48, 1], 'banka.hloubka': [0.2, 8], 'banka.zkrut': [-360, 360], 'banka.dno': [4, 60],
    'banka.hrdlo': [8, 40], 'banka.vyskaHrdla': [5, 20], 'banka.vule': [0, 0.8], 'banka.stenaCepicky': [0.8, 4],
    'jmenovka.sirka': [20, 200], 'jmenovka.vyska': [15, 200], 'jmenovka.tloustka': [0.8, 8], 'jmenovka.zaobleni': [0, 30], 'jmenovka.velikost': [3, 60],
    'jmenovka.radkovani': [0.9, 3], 'jmenovka.vyskaTextu': [0.2, 4], 'jmenovka.hloubka': [0.2, 4], 'jmenovka.okraj': [1, 20],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.stena': [0.3, 1.2], 'tisk.dno': [0.2, 3], 'tisk.podlozkaX': [60, 1000], 'tisk.podlozkaY': [60, 1000],
  };
  const VYCTY = {
    diry: ['kapka', 'kruh'], druh: Object.keys(NAZVY.druh), 'hvezda.styl': Object.keys(NAZVY.styl),
    'banka.profil': Object.keys(NAZVY.profil), 'banka.povrch': Object.keys(NAZVY.povrch), 'banka.spoj': Object.keys(NAZVY.spoj),
    'jmenovka.tvar': Object.keys(NAZVY.tvar), 'jmenovka.rezim': Object.keys(NAZVY.rezim), 'jmenovka.dirka': Object.keys(NAZVY.dirka),
    'tisk.material': Object.keys(MATERIALY),
  };

  /** Předvolby – jen odchylky od výchozího projektu; první skupina přepíná druh, další jsou hotové sady. Tisk a barvy zůstávají uživatelovy. */
  const PREDVOLBY = [
    { id: 'vlocka', skupina: 'Druh ozdoby', nazev: '❄️ Vločka', popis: 'Ø 70 mm, tvar ze semínka, očko na špičce', p: { nazev: 'Vločka', druh: 'vlocka' } },
    { id: 'hvezda', skupina: 'Druh ozdoby', nazev: '⭐ Hvězda', popis: 'pěticípá plochá, poloměr 35 mm', p: { nazev: 'Hvězda', druh: 'hvezda' } },
    { id: 'banka', skupina: 'Druh ozdoby', nazev: '🔴 Baňka', popis: 'koule Ø 50 do vázového režimu + čepička', p: { nazev: 'Baňka', druh: 'banka' } },
    { id: 'jmenovka', skupina: 'Druh ozdoby', nazev: '🏷️ Jmenovka na dárek', popis: 'visačka 60 × 32 mm s vystouplým textem', p: { nazev: 'Jmenovka', druh: 'jmenovka' } },

    { id: 'miniVlocka', skupina: 'Sada Stromek mini', nazev: 'Mini vločka Ø 40', popis: 'jemná, 2 větve, tloušťka 1,6 mm', p: { nazev: 'Mini vločka', druh: 'vlocka', vlocka: { prumer: 40, sirka: 1.4, vetvi: 2, tloustka: 1.6, seminko: 7, vetvicky: false }, ocko: { prumer: 2.5, stena: 1.2 } } },
    { id: 'miniHvezda', skupina: 'Sada Stromek mini', nazev: 'Mini hvězda 40 mm', popis: 'plochá pěticípá, poloměr 20 mm', p: { nazev: 'Mini hvězda', druh: 'hvezda', hvezda: { vnejsi: 20, vnitrni: 9, tloustka: 1.6 }, ocko: { prumer: 2.5, stena: 1.2 } } },
    { id: 'miniHvezda3d', skupina: 'Sada Stromek mini', nazev: 'Mini hvězda prostorová', popis: 'dva pláty do sebe, poloměr 22 mm', p: { nazev: 'Mini hvězda 3D', druh: 'hvezda', hvezda: { styl: 'zasouvaci', vnejsi: 22, vnitrni: 10, tloustka: 1.6 }, ocko: { prumer: 2.5, stena: 1.2 } } },
    { id: 'miniBanka', skupina: 'Sada Stromek mini', nazev: 'Mini baňka Ø 30', popis: 'koule, hrdlo Ø 10, čepička zaklapne', p: { nazev: 'Mini baňka', druh: 'banka', banka: { prumer: 30, vyska: 30, hrdlo: 10, vyskaHrdla: 6, dno: 8 }, ocko: { prumer: 2.5, stena: 1.2 } } },
    { id: 'miniZvonek', skupina: 'Sada Stromek mini', nazev: 'Mini zvonek', popis: 'zvonek Ø 28 × 30 mm', p: { nazev: 'Mini zvonek', druh: 'banka', banka: { profil: 'zvonek', prumer: 28, vyska: 30, hrdlo: 10, vyskaHrdla: 6 }, ocko: { prumer: 2.5, stena: 1.2 } } },

    { id: 'oknoVlocka', skupina: 'Sada Okno', nazev: 'Velká vločka Ø 130', popis: 'bohatě větvená, ramena 3 mm, tloušťka 1,6 mm', p: { nazev: 'Vločka do okna', druh: 'vlocka', vlocka: { prumer: 130, sirka: 3, vetvi: 5, tloustka: 1.6, seminko: 1224 } } },
    { id: 'oknoHvezda', skupina: 'Sada Okno', nazev: 'Obrysová hvězda 120 mm', popis: 'dutá, obrys 4 mm, tloušťka 1,6 mm', p: { nazev: 'Hvězda do okna', druh: 'hvezda', hvezda: { styl: 'obrys', vnejsi: 60, vnitrni: 26, obrys: 4, tloustka: 1.6 } } },
    { id: 'oknoHvezda8', skupina: 'Sada Okno', nazev: 'Osmicípá vypouklá hvězda', popis: 'hrany do špičky, poloměr 45 mm', p: { nazev: 'Osmicípá hvězda', druh: 'hvezda', hvezda: { styl: 'vypoukla', cipu: 8, vnejsi: 45, vnitrni: 22, tloustka: 1.2, vyska: 7 } } },
    { id: 'oknoHvezda3d', skupina: 'Sada Okno', nazev: 'Prostorová hvězda 100 mm', popis: 'šesticípá ze dvou plátů, vůle 0,15 mm', p: { nazev: 'Prostorová hvězda', druh: 'hvezda', hvezda: { styl: 'zasouvaci', cipu: 6, vnejsi: 50, vnitrni: 24, tloustka: 2 } } },

    { id: 'darekVisacka', skupina: 'Sada Dárky', nazev: 'Visačka se jménem', popis: '60 × 32 mm, vystouplý text, dírka vlevo', p: { nazev: 'Visačka', druh: 'jmenovka' } },
    { id: 'darekStromecek', skupina: 'Sada Dárky', nazev: 'Stromeček se jménem', popis: '48 × 62 mm, dírka pod špičkou', p: { nazev: 'Stromeček se jménem', druh: 'jmenovka', jmenovka: { tvar: 'stromecek', sirka: 48, vyska: 62, text: 'Táta', dirka: 'nahore', velikost: 6 }, barvy: { podklad: '#1E7F4F', text: '#F4E9D0' } } },
    { id: 'darekHvezda', skupina: 'Sada Dárky', nazev: 'Hvězda se jménem', popis: 'Ø 60 mm, zapuštěný text', p: { nazev: 'Hvězda se jménem', druh: 'jmenovka', jmenovka: { tvar: 'hvezda', sirka: 60, text: 'Eva', dirka: 'nahore', rezim: 'zapusteny', velikost: 7 }, barvy: { podklad: '#E0B030', text: '#7A1F1F' } } },
    { id: 'darekKolecko', skupina: 'Sada Dárky', nazev: 'Kolečko – text skrz', popis: 'Ø 45 mm, šablonové písmo, dírka nahoře', p: { nazev: 'Kolečko se jménem', druh: 'jmenovka', jmenovka: { tvar: 'kolecko', sirka: 45, text: 'JAN', pismo: 'saira', dirka: 'nahore', rezim: 'skrz', velikost: 9 } } },

    { id: 'bankaKapka', skupina: 'Baňky', nazev: 'Kapka se žebry', popis: 'Ø 45 × 70 mm, 12 žeber', p: { nazev: 'Kapka', druh: 'banka', banka: { profil: 'kapka', prumer: 45, vyska: 70, povrch: 'zebra' } } },
    { id: 'bankaCibule', skupina: 'Baňky', nazev: 'Cibule se zkrutem', popis: 'Ø 55 × 75 mm, 10 žeber zkroucených o 120°', p: { nazev: 'Cibule', druh: 'banka', banka: { profil: 'cibule', prumer: 55, vyska: 75, povrch: 'zkrut', pocet: 10, zkrut: 120 } } },
    { id: 'bankaFazety', skupina: 'Baňky', nazev: 'Fazetová koule', popis: 'Ø 55 mm, 10 fazet po obvodu', p: { nazev: 'Fazetová koule', druh: 'banka', banka: { prumer: 55, vyska: 55, povrch: 'fazety', pocet: 10 } } },
    { id: 'bankaSpicka', skupina: 'Baňky', nazev: 'Špička', popis: 'Ø 36 × 100 mm, hladká, dno Ø 8', p: { nazev: 'Špička', druh: 'banka', banka: { profil: 'spicka', prumer: 36, vyska: 100, dno: 8, hrdlo: 12 } } },
  ];

  /* ---------------- normalizace a projekt ---------------- */
  const BARVA_OK = /^#[0-9a-f]{6}$/i, PISMO_OK = /^[\w-]{1,80}$/;
  function normalizuj(v) {
    const r = G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
    for (const k of Object.keys(VYCHOZI.barvy)) {
      if (BARVA_OK.test(r.p.barvy[k])) r.p.barvy[k] = r.p.barvy[k].toUpperCase();
      else { r.hlaseni.push(`barvy.${k}: neplatná barva → ${VYCHOZI.barvy[k]}`); r.p.barvy[k] = VYCHOZI.barvy[k]; }
    }
    if (!PISMO_OK.test(r.p.jmenovka.pismo)) r.p.jmenovka.pismo = VYCHOZI.jmenovka.pismo;
    const radky = r.p.jmenovka.text.replace(/\r/g, '').split('\n');
    if (radky.length > KLIC.MAX_RADKU) { r.p.jmenovka.text = radky.slice(0, KLIC.MAX_RADKU).join('\n'); r.hlaseni.push(`jmenovka.text: nejvýš ${KLIC.MAX_RADKU} řádky, zbytek vynechán`); }
    return r;
  }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  function popis(p) {
    const o = odvozene(p);
    if (p.druh === 'vlocka') return `vločka Ø ${fmt(2 * o.R)} · semínko ${p.vlocka.seminko} · ${p.vlocka.vetvi} větve`;
    if (p.druh === 'hvezda') return `hvězda ${p.hvezda.cipu} cípů · R ${fmt(o.R)} / ${fmt(o.r)} · ${NAZVY.styl[p.hvezda.styl]}`;
    if (p.druh === 'banka') return `baňka ${NAZVY.profil[p.banka.profil]} Ø ${fmt(o.D)} × ${fmt(o.H)} · ${NAZVY.povrch[p.banka.povrch]}`;
    return `jmenovka ${NAZVY.tvar[p.jmenovka.tvar]} ${fmt(o.W)}${o.kruhova ? '' : ' × ' + fmt(o.Hj)} · „${p.jmenovka.text.replace(/\n/g, ' / ')}“`;
  }
  const TYP = 'vanocni_ozdoby';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Vánoční ozdoby');

  /* ---------------- 2D pomocné ---------------- */
  const kruh = (r, c = [0, 0], n = 48) => Array.from({ length: n }, (_, i) => { const a = 2 * Math.PI * i / n; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; });
  /** Úsečka a–b o šířce w se zaoblenými konci (obrys proti směru hodinových ručiček). */
  function kapsle(a, b, w, n = 8) {
    const f = Math.atan2(b[1] - a[1], b[0] - a[0]), r = w / 2, out = [];
    for (let i = 0; i <= n; i++) { const u = f - Math.PI / 2 + Math.PI * i / n; out.push([b[0] + r * Math.cos(u), b[1] + r * Math.sin(u)]); }
    for (let i = 0; i <= n; i++) { const u = f + Math.PI / 2 + Math.PI * i / n; out.push([a[0] + r * Math.cos(u), a[1] + r * Math.sin(u)]); }
    return out;
  }
  const otoc2 = (q, u) => [q[0] * Math.cos(u) - q[1] * Math.sin(u), q[0] * Math.sin(u) + q[1] * Math.cos(u)];
  function vBodu(b, x, y) {
    let uvnitr = false;
    for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
      const [xi, yi] = b[i], [xj, yj] = b[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) uvnitr = !uvnitr;
    }
    return uvnitr;
  }
  function vzdalenostKObrysu(b, x, y) {
    let d = Infinity;
    for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
      const [ax, ay] = b[j], [bx, by] = b[i], ux = bx - ax, uy = by - ay, l2 = ux * ux + uy * uy || 1e-12;
      const t = Math.max(0, Math.min(1, ((x - ax) * ux + (y - ay) * uy) / l2));
      d = Math.min(d, Math.hypot(ax + t * ux - x, ay + t * uy - y));
    }
    return d;
  }
  /** Vrcholy hvězdy: n cípů, cíp nahoru, střídavě vnější R a vnitřní r. */
  function hvezdaBody(n, R, r) {
    const b = [];
    for (let i = 0; i < 2 * n; i++) { const a = Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; b.push([q * Math.cos(a), q * Math.sin(a)]); }
    return b;
  }
  /** Deterministický generátor (mulberry32). */
  function nahodnik(a) {
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  /* ---------------- odvozené rozměry ---------------- */
  /** Měřítko násobí velikost tvaru (průměry, poloměry, výšku baňky, rozměr cedulky a písma); tloušťky, vůle, očko a hrdlo zůstávají. */
  function odvozene(p) {
    const k = p.meritko / 100, o = { k };
    if (p.druh === 'vlocka') {
      const v = p.vlocka;
      o.R = v.prumer * k / 2; o.w = Math.max(v.sirka, v.minimum); o.zesileno = v.sirka < v.minimum;
    } else if (p.druh === 'hvezda') {
      const h = p.hvezda, n = h.cipu;
      o.n = n; o.R = h.vnejsi * k; o.r = Math.min(h.vnitrni * k, 0.92 * o.R); o.orezano = h.vnitrni * k > 0.92 * o.R + 1e-9;
      o.plocha = n * o.R * o.r * Math.sin(Math.PI / n);
      // vzdálenost stran od středu (o tu se hvězda zmenší odsazením dovnitř) a úhel cípu
      const L = Math.hypot(o.R - o.r * Math.cos(Math.PI / n), o.r * Math.sin(Math.PI / n));
      o.ro = o.R * o.r * Math.sin(Math.PI / n) / L;
      o.uhelCipu = 2 * stup(Math.asin(o.r * Math.sin(Math.PI / n) / L));
      // zasouvací: výřezy se potkají ve středu hvězdy (tam je jádro nejširší – drží i u hvězd s tenkými cípy)
      o.yTop = o.R; o.yDno = n % 2 ? -o.r : -o.R; o.yStred = 0;
      o.vyrez = h.tloustka + 2 * h.vule;
    } else if (p.druh === 'banka') {
      const b = p.banka, zak = b.spoj === 'zaklapnuti';
      o.D = b.prumer * k; o.H = b.vyska * k; o.rh = b.hrdlo / 2; o.hh = b.vyskaHrdla; o.zak = zak;
      o.presah = zak ? ZAKLAP.presah : 0;
      o.rl = o.rh + b.vule;                     // ústí čepičky (pero)
      o.rc = o.rh + o.presah + b.vule;          // dutina čepičky
      o.ro = o.rc + b.stenaCepicky;             // vnější poloměr čepičky
      o.hk = o.hh - 1 - (o.rc - o.rh);          // výška válcové části dutiny; čepička sedí 1 mm nad tělem baňky
      // lem začíná tak, aby jeho spodní zkosení leželo osově 0,1 mm nad zkosením pera (rovnoběžné plochy 45°, radiálně od sebe o vůli)
      // (při nejnižším hrdle 5 mm se lem do dutiny čepičky vejde vždy)
      o.lemOd = 1 + ZAKLAP.pero + ZAKLAP.osove - b.vule;          // začátek lemu nad tělem baňky
      // rezerva sklonu: zkrut a fazety přidávají k převisu profilu
      const U = Math.tan(rad(p.tisk.uhel));
      let rezerva = 0;
      if (b.povrch === 'zkrut') rezerva = b.hloubka * b.pocet / 2 * Math.abs(rad(b.zkrut)) / Math.max(1, o.H);
      if (b.povrch === 'fazety') rezerva = o.D / 2 * (1 - Math.cos(Math.PI / b.pocet)) / (o.H / fazetPater(b.pocet, o.H, o.D));
      o.tanMez = Math.max(Math.tan(rad(15)), U - rezerva);
      Object.assign(o, bankaProfil(p, o));
    } else {
      const j = p.jmenovka;
      o.kruhova = j.tvar === 'kolecko' || j.tvar === 'hvezda';
      o.W = j.sirka * k; o.Hj = o.kruhova ? o.W : j.vyska * k; o.cap = j.velikost * k;
      o.hloubka = j.rezim === 'zapusteny' ? Math.min(j.hloubka, j.tloustka - 0.4) : 0;
    }
    return o;
  }

  /* ---------------- vločka ---------------- */
  /** Kostra jednoho ramene (osa +x, polovina y ≥ 0; druhou dá zrcadlení, zbytek otočení po 60°): úsečky {a, b, w}, kruhy {c, r}, středový šestiúhelník. */
  function vlockaKostra(p, o) {
    const v = p.vlocka, R = o.R, m = v.minimum;
    const w = o.w, wb = Math.max(0.8 * v.sirka, m), wt = Math.max(0.65 * v.sirka, m);
    const rnd = nahodnik(v.seminko + 0x9E3779B9), vyber = a => a[Math.floor(rnd() * a.length)];
    const alfa = rad(vyber([60, 60, 60, 50, 70, 45]));
    const obalka = vyber(['jedle', 'list', 'koruna', 'stridave']);
    const stred = vyber(['plny', 'prstenec', 'prstenec', 'dvojity', 'nic']);
    const spicka = vyber(['nic', 'vidlice', 'kosoctverec', 'kulicka', 'vidlice']);
    const useky = [], kruhy = [];
    const xe = R - w / 2;
    useky.push({ a: [0, 0], b: [xe, 0], w });
    // konec úsečky musí zůstat ve výseči ramene (0–30°) a uvnitř poloměru R – jinak se zkrátí
    const vejde = (q, ww) => q[1] >= -1e-9 && Math.hypot(q[0], q[1]) + ww / 2 <= R + 1e-9 && Math.atan2(q[1], q[0]) <= Math.PI / 6 + 1e-9;
    function usek(a, uhel, L, ww) {
      for (let i = 0; i < 40 && L > 1.5 * ww; i++, L *= 0.92) {
        const b = [a[0] + L * Math.cos(uhel), a[1] + L * Math.sin(uhel)];
        if (vejde(b, ww)) { useky.push({ a, b, w: ww }); return L; }
      }
      return 0;
    }
    const f = { jedle: t => 1 - 0.65 * t, list: t => 0.35 + 0.65 * Math.sin(Math.PI * t), koruna: t => 0.4 + 0.6 * t, stridave: (t, j) => (j % 2 ? 0.55 : 1) }[obalka];
    for (let j = 0; j < v.vetvi; j++) {
      const t = 0.22 + 0.66 * (j + 0.5 + 0.3 * (rnd() - 0.5)) / v.vetvi, d = t * xe;
      const L = usek([d, 0], alfa, v.delka / 100 * 0.45 * R * f(t, j) * (0.85 + 0.3 * rnd()), wb);
      const s = 0.45 + 0.2 * rnd();
      if (L && v.vetvicky && L > 5 * wt) {
        const c = [d + s * L * Math.cos(alfa), s * L * Math.sin(alfa)];
        usek(c, alfa - rad(60), 0.4 * L, wt);
        usek(c, alfa + rad(60), 0.4 * L, wt);
      }
    }
    const q1 = rnd(), q2 = rnd(), q3 = rnd();
    let hex = null;
    const prstenec = ro => useky.push({ a: [ro, 0], b: [ro * Math.cos(rad(60)), ro * Math.sin(rad(60))], w: wb });
    if (stred === 'plny') hex = Array.from({ length: 6 }, (_, i) => otoc2([Math.max(1.5 * w, R * (0.12 + 0.1 * q1)), 0], rad(60 * i)));
    if (stred === 'prstenec' || stred === 'dvojity') prstenec(R * (0.22 + 0.2 * q1));
    if (stred === 'dvojity') prstenec(R * (0.5 + 0.15 * q2));
    if (spicka === 'vidlice') { const lf = R * (0.1 + 0.08 * q3); usek([xe - lf, 0], alfa, lf, wt); }
    if (spicka === 'kosoctverec') {
      const a = Math.max(1.6 * wt, R * (0.06 + 0.05 * q3)), b = 0.6 * a;
      useky.push({ a: [xe - 2 * a, 0], b: [xe - a, b], w: wt }, { a: [xe - a, b], b: [xe, 0], w: wt });
    }
    if (spicka === 'kulicka') { const r = Math.max(0.9 * w, R * (0.04 + 0.03 * q3)); kruhy.push({ c: [R - r, 0], r }); }
    return { useky, kruhy, hex, styl: { alfa: stup(alfa), obalka, stred, spicka } };
  }
  /** Všechny obrysy vločky (bez očka): jedno rameno míří nahoru (+y). */
  function vlockaObrysy(p, o) {
    const K = vlockaKostra(p, o), out = [];
    for (let i = 0; i < 6; i++) for (const s of [1, -1]) {
      const T = q => otoc2([q[0], s * q[1]], Math.PI / 2 + i * Math.PI / 3);
      for (const u of K.useky) out.push(kapsle(T(u.a), T(u.b), u.w));
      for (const c of K.kruhy) out.push(kruh(c.r, T(c.c), 24));
    }
    if (K.hex) out.push(K.hex.map(q => otoc2(q, Math.PI / 2)));
    return { polygony: out, styl: K.styl };
  }

  /* ---------------- baňka: profil ---------------- */
  const elipsa = (t, t0) => Math.sqrt(Math.max(0, 1 - ((t0 - t) / t0) ** 2));
  /** Poloměr / největší poloměr podle výšky t ∈ 0–1 (0 = dole na podložce, 1 = u hrdla). */
  const PROFILY = {
    koule: t => Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)),
    kapka: t => (t <= 0.36 ? elipsa(t, 0.36) : Math.cos(Math.PI / 2 * (t - 0.36) / 0.64)),
    cibule: t => (t <= 0.34 ? elipsa(t, 0.34) : Math.cos(Math.PI / 2 * (t - 0.34) / 0.66) ** 3),
    zvonek: t => (0.5 + 0.5 * (1 - t) ** 2.2) * Math.sqrt(Math.max(0, 1 - t ** 6)),
    spicka: t => Math.sin(Math.PI * t ** 1.6),
  };
  /** Počet pater fazet (sudý – jedno patro vrcholů leží v polovině výšky, u koule na rovníku). */
  const fazetPater = (n, H, D) => Math.max(4, 2 * Math.round(n * H / (2 * Math.PI * D)));
  /** Profil těla baňky [[r, z]…] od dna (z = 0) po hrdlo (z = výška): seříznutý na průměr dna a hrdla, sklon sražený na úhel tisku (p.banka.srazit). */
  function bankaProfil(p, o) {
    const b = p.banka, f = PROFILY[b.profil], Rm = o.D / 2, H = o.H, N = 400, rd = b.dno / 2;
    const rr = i => Rm * f(i / N);
    let iLo = 0, iHi = N;
    while (iLo <= N && rr(iLo) < rd) iLo++;
    while (iHi >= 0 && rr(iHi) < o.rh) iHi--;
    if (iLo > N) return { chybaProfilu: 'dno' };
    if (iHi < 0) return { chybaProfilu: 'hrdlo' };
    const rez = (i0, i1, cil) => { const a = rr(i0), c = rr(i1); return (i0 + (cil - a) / (c - a || 1e-9) * (i1 - i0)) / N; };
    const tLo = iLo === 0 ? 0 : rez(iLo - 1, iLo, rd), tHi = iHi === N ? 1 : rez(iHi + 1, iHi, o.rh);
    if (!(tHi - tLo > 0.2)) return { chybaProfilu: 'nizka' };
    // seříznutý profil se natáhne na celou zadanou výšku – „výška“ je výška těla bez hrdla
    const Hb = H, NB = 160, dz = Hb / NB, r = [];
    for (let i = 0; i <= NB; i++) r.push(Rm * f(tLo + (tHi - tLo) * i / NB));
    if (iLo > 0) r[0] = rd;
    if (iHi < N) r[NB] = o.rh;
    if (b.srazit) {
      const t = o.tanMez * dz;
      for (let i = 1; i <= NB; i++) r[i] = Math.min(r[i], r[i - 1] + t);
      for (let i = NB - 1; i >= 0; i--) r[i] = Math.min(r[i], r[i + 1] + t);
    }
    let ven = 0, dovnitr = 0, rMax = 0;
    for (let i = 1; i <= NB; i++) { const s = (r[i] - r[i - 1]) / dz; ven = Math.max(ven, s); dovnitr = Math.max(dovnitr, -s); rMax = Math.max(rMax, r[i]); }
    return { profil: r.map((x, i) => [x, i * dz]), Hb, rDno: r[0], rMax, sklonVen: stup(Math.atan(ven)), sklonDovnitr: stup(Math.atan(dovnitr)) };
  }
  /** Poloměr profilu ve výšce z (lineárně mezi vzorky). */
  function polomerProfilu(profil, z) {
    const dz = profil[1][1] - profil[0][1], x = Math.max(0, Math.min(profil.length - 1, z / dz)), i = Math.min(profil.length - 2, Math.floor(x));
    return profil[i][0] + (profil[i + 1][0] - profil[i][0]) * (x - i);
  }
  /** Síť těla baňky (plné těleso, dno z = 0, vršek z = Hb) → {poz, idx}. */
  function bankaSit(p, o) {
    const b = p.banka, Hb = o.Hb, faz = b.povrch === 'fazety', n = b.pocet;
    const nT = faz ? n : b.povrch === 'hladky' ? 96 : Math.min(384, Math.max(96, n * 12));
    const pater = fazetPater(n, o.H, o.D);
    const zs = faz ? Array.from({ length: pater + 1 }, (_, i) => Hb * i / pater) : o.profil.map(q => q[1]);
    const a = Math.min(0.6, b.hloubka / o.rMax), psi = rad(b.zkrut);
    const zeslab = z => { const x = Math.max(0, Math.min(1, (Hb - z) / (0.15 * Hb))); return x * x * (3 - 2 * x); };   // k hrdlu se žebra vytratí (hrdlo je kruhové)
    const P = [], I = [];
    zs.forEach((z, k) => {
      // fazety: poslední patro opsané kolem hrdla (kruhové hrdlo nesmí přečnívat přes plošky)
      const rz = polomerProfilu(o.profil, z) / (faz && k === zs.length - 1 ? Math.cos(Math.PI / n) : 1);
      for (let i = 0; i < nT; i++) {
        const u = 2 * Math.PI * (i + (faz && k % 2 ? 0.5 : 0)) / nT;
        let m = 1;
        if (b.povrch === 'zebra' || b.povrch === 'zkrut') m = 1 - a * zeslab(z) * (0.5 - 0.5 * Math.cos(n * (u - (b.povrch === 'zkrut' ? psi * z / Hb : 0))));
        P.push(rz * m * Math.cos(u), rz * m * Math.sin(u), z);
      }
    });
    const K = zs.length, dno = P.length / 3, vrch = dno + 1;
    P.push(0, 0, 0, 0, 0, Hb);
    for (let k = 0; k < K - 1; k++) for (let i = 0; i < nT; i++) {
      const a0 = k * nT + i, a1 = k * nT + (i + 1) % nT, b0 = a0 + nT, b1 = a1 + nT;
      if (faz && k % 2 === 0) I.push(a0, a1, b0, b0, a1, b1);
      else I.push(a0, b1, b0, a0, a1, b1);
    }
    for (let i = 0; i < nT; i++) {
      I.push(dno, (i + 1) % nT, i);
      I.push(vrch, (K - 1) * nT + i, (K - 1) * nT + (i + 1) % nT);
    }
    return { poz: new Float32Array(P), idx: new Uint32Array(I) };
  }
  /** Obrys hrdla v rovině (r, z) od výšky z0: válec o poloměru rh s lemem pro zaklapnutí. */
  function hrdloObrys(o, z0) {
    const rh = o.rh, zt = z0 + o.hh, b = [[0, z0 - 0.3], [rh, z0 - 0.3]];
    if (o.zak) {
      const s = z0 + o.lemOd, q = ZAKLAP.presah;
      b.push([rh, s], [rh + q, s + q], [rh + q, s + q + ZAKLAP.lem], [rh, s + 2 * q + ZAKLAP.lem]);
    }
    b.push([rh, zt], [0, zt]);
    return b;
  }

  /* ---------------- jmenovka: tvary ---------------- */
  function cedulka(p, o) {
    const j = p.jmenovka, W = o.W, H = o.Hj;
    if (j.tvar === 'obdelnik') return [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]];
    if (j.tvar === 'kolecko') return kruh(W / 2, [0, 0], 96);
    if (j.tvar === 'hvezda') return hvezdaBody(5, W / 2, 0.55 * W / 2);
    if (j.tvar === 'visacka') {
      const c = Math.min(0.3 * H, 0.25 * W);
      return [[-W / 2 + c, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2 + c, H / 2], [-W / 2, H / 2 - c], [-W / 2, -H / 2 + c]];
    }
    // stromeček: kmen a tři patra
    const kw = 0.11 * W, kh = 0.14 * H, y0 = -H / 2 + kh, ht = (H - kh) / 3;
    const prava = [[kw, -H / 2], [kw, y0], [W / 2, y0], [0.2 * W, y0 + ht], [0.4 * W, y0 + ht], [0.14 * W, y0 + 2 * ht], [0.3 * W, y0 + 2 * ht]];
    return prava.concat([[0, H / 2]], prava.slice().reverse().map(q => [-q[0], q[1]]));
  }
  /** Střed dírky: od kraje (nahoře / vlevo) dovnitř po ose, až je kolem dírky stěna rP. */
  function stredDirky(obrys, smer, rP) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of obrys) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    const max = smer === 'nahore' ? b[3] - b[1] : b[2] - b[0];
    for (let s = 0; s < 0.6 * max; s += 0.1) {
      const q = smer === 'nahore' ? [0, b[3] - s] : [b[0] + s, 0];
      if (vBodu(obrys, q[0], q[1]) && vzdalenostKObrysu(obrys, q[0], q[1]) >= rP) return q;
    }
    return null;
  }

  /* ---------------- kontroly (bez geometrie) ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), t = p.tisk;
    const h = (uroven, text, pole, oprava) => H.push({ uroven, text, pole: pole || null, oprava });
    if (p.druh === 'vlocka') {
      const v = p.vlocka;
      if (o.zesileno) h('info', `Ramena ${fmt(v.sirka, 2)} mm jsou užší než nejtenčí povolený prvek – tisknou se ${fmt(v.minimum, 2)} mm.`, ['vlocka.sirka']);
      if (v.minimum < 2 * t.stena - 0.11) h('varovani', `Nejtenčí prvek ${fmt(v.minimum, 2)} mm je užší než dvě stopy trysky (${fmt(2 * t.stena, 2)} mm) – slicer ho může vynechat.`, ['vlocka.minimum'],
        { text: `Nastavit ${fmt(2 * t.stena, 2)} mm`, pole: 'vlocka.minimum', hodnota: Math.round(200 * t.stena) / 100 });
      if (v.tloustka < 3 * t.vrstva - 1e-9) h('varovani', `Tloušťka ${fmt(v.tloustka, 2)} mm jsou méně než 3 vrstvy – vločka bude křehká.`, ['vlocka.tloustka']);
      if (2 * o.R > 60 * Math.sqrt(o.w * v.tloustka)) h('varovani', `Vločka Ø ${fmt(2 * o.R, 0)} mm s rameny ${fmt(o.w, 1)} × ${fmt(v.tloustka, 1)} mm se snadno zlomí – zesilte ramena nebo tloušťku.`, ['vlocka.sirka', 'vlocka.tloustka']);
      if (v.vetvi === 0) h('info', 'Bez větví zůstane jen šest ramen se středem a špičkami podle semínka.', ['vlocka.vetvi']);
    }
    if (p.druh === 'hvezda') {
      const s = p.hvezda;
      if (o.orezano) h('varovani', `Vnitřní poloměr omezen na ${fmt(o.r, 1)} mm (92 % vnějšího) – jinak by cípy zmizely.`, ['hvezda.vnitrni']);
      if (o.uhelCipu < 20) h('varovani', `Cípy mají úhel jen ${fmt(o.uhelCipu, 0)}° – špičky se při tisku zakulatí a snadno ulomí. Zvětšete vnitřní poloměr.`, ['hvezda.vnitrni']);
      if (s.styl === 'obrys' && s.obrys >= o.ro - 0.5) h('chyba', `Obrys ${fmt(s.obrys, 1)} mm je širší než hvězda (do středu ${fmt(o.ro, 1)} mm) – uvnitř nezbude otvor.`, ['hvezda.obrys'],
        { text: `Obrys ${fmt(Math.max(0.8, o.ro / 3), 1)} mm`, pole: 'hvezda.obrys', hodnota: Math.max(0.8, Math.round(o.ro / 3 * 10) / 10) });
      if (s.styl === 'obrys' && s.obrys < 2 * t.stena - 0.11) h('varovani', `Obrys ${fmt(s.obrys, 2)} mm je užší než dvě stopy trysky.`, ['hvezda.obrys']);
      if (s.styl === 'zasouvaci') {
        if (s.tloustka < 1.2) h('varovani', `Pláty ${fmt(s.tloustka, 1)} mm jsou na zasouvání tenké – doporučeno aspoň 1,6 mm.`, ['hvezda.tloustka']);
        if (o.vyrez / 2 + 1 > o.ro) h('chyba', `Výřez ${fmt(o.vyrez, 1)} mm je moc široký pro jádro hvězdy (od středu ke stranám ${fmt(o.ro, 1)} mm) – pláty by se rozpadly. Zvětšete vnitřní poloměr nebo ztenčete pláty.`, ['hvezda.vnitrni', 'hvezda.tloustka']);
        const pata = 2 * o.r * Math.sin(Math.PI / o.n);
        if (o.vyrez > 0.6 * pata) h('varovani', `Výřez ${fmt(o.vyrez, 1)} mm zabere většinu cípu (u paty široký ${fmt(pata, 1)} mm) – z rozříznutého cípu zbudou jen tenké proužky. Ztenčete pláty nebo uberte cípy.`, ['hvezda.tloustka', 'hvezda.cipu']);
        if (s.vule < 0.05) h('info', 'Vůle pod 0,05 mm: pláty půjdou do sebe ztuha, případně výřez začistěte.', ['hvezda.vule']);
      }
      if (s.styl === 'vypoukla' && stup(Math.atan(s.vyska / o.ro)) > 60) h('info', 'Strmá vypouklá hvězda – vrchol bude ostrý.', ['hvezda.vyska']);
      if (s.styl !== 'vypoukla' && s.tloustka < 3 * t.vrstva - 1e-9) h('varovani', `Tloušťka ${fmt(s.tloustka, 2)} mm jsou méně než 3 vrstvy.`, ['hvezda.tloustka']);
    }
    if (p.druh === 'banka') {
      const b = p.banka;
      if (o.chybaProfilu === 'dno') h('chyba', `Dno Ø ${fmt(b.dno)} mm je větší než baňka Ø ${fmt(o.D)} mm.`, ['banka.dno']);
      else if (o.chybaProfilu === 'hrdlo') h('chyba', `Hrdlo Ø ${fmt(b.hrdlo)} mm je větší než baňka Ø ${fmt(o.D)} mm.`, ['banka.hrdlo']);
      else if (o.chybaProfilu) h('chyba', 'Po seříznutí na dno a hrdlo z baňky nic nezbude – zmenšete dno a hrdlo, nebo baňku zvětšete.', ['banka.dno', 'banka.hrdlo']);
      else {
        if (o.rDno < 4) h('varovani', `Dno Ø ${fmt(2 * o.rDno, 1)} mm drží na podložce slabě – použijte límec (brim).`, ['banka.dno']);
        if (!b.srazit && Math.max(o.sklonVen, o.sklonDovnitr) > t.uhel + 1.5) h('varovani', `Profil má sklon až ${fmt(Math.max(o.sklonVen, o.sklonDovnitr), 0)}° od svislice (tiskárna zvládne ${fmt(t.uhel, 0)}°) – ve vázovém režimu se stěna neudrží.`, ['banka.srazit'],
          { text: 'Srazit převisy', pole: 'banka.srazit', hodnota: true });
        if (b.srazit && o.rMax < o.D / 2 - 0.5) h('info', `Po sražení převisů má baňka největší průměr ${fmt(2 * o.rMax, 1)} mm místo ${fmt(o.D, 1)} mm – protáhněte výšku.`, ['banka.vyska']);
      }
      if (o.zak && b.vule >= ZAKLAP.presah - 0.1) h('varovani', `S vůlí ${fmt(b.vule, 2)} mm čepička přes lem ${fmt(ZAKLAP.presah, 1)} mm nezaklapne – zmenšete vůli, nebo čepičku přilepte.`, ['banka.vule']);
      if (p.ocko.zap && p.ocko.prumer / 2 + p.ocko.stena > o.ro) h('varovani', `Očko (šířka ${fmt(p.ocko.prumer + 2 * p.ocko.stena, 1)} mm) je širší než čepička Ø ${fmt(2 * o.ro, 1)} mm.`, ['ocko.prumer']);
      const schod = o.rh * (1 / Math.cos(Math.PI / b.pocet) - 1);
      if (b.povrch === 'fazety' && schod > t.stena) h('varovani', `Při ${b.pocet} fazetách vznikne u hrdla schod ${fmt(schod, 1)} mm, širší než stěna – vázový režim ho nezakryje. Zvyšte počet fazet.`, ['banka.pocet'],
        { text: 'Aspoň 10 fazet', pole: 'banka.pocet', hodnota: Math.max(10, b.pocet + 2) });
      h('info', `Baňka je plné těleso pro vázový režim (spirála): 1 stěna ${fmt(t.stena, 2)} mm, dno ${fmt(t.dno, 1)} mm, bez výplně a bez horních vrstev. Čepička se tiskne běžně.`);
    }
    if (p.druh === 'jmenovka') {
      const j = p.jmenovka;
      if (j.rezim === 'zapusteny' && o.hloubka < j.hloubka - 1e-9) h('varovani', `Hloubka textu omezena na ${fmt(o.hloubka, 2)} mm – pod textem musí zůstat aspoň 0,4 mm.`, ['jmenovka.hloubka', 'jmenovka.tloustka']);
      if (j.rezim === 'vystouply' && j.vyskaTextu < 2 * t.vrstva - 1e-9) h('varovani', 'Text má méně než 2 vrstvy – barva bude prosvítat.', ['jmenovka.vyskaTextu']);
      if (j.tloustka < 1.2) h('info', `Cedulka ${fmt(j.tloustka, 1)} mm je ohebná – na dárek stačí, na klíče ne.`, ['jmenovka.tloustka']);
    }
    if (p.ocko.zap && p.ocko.prumer < 2) h('info', `Otvor Ø ${fmt(p.ocko.prumer, 1)} mm – projde jen nit nebo tenký drátek.`, ['ocko.prumer']);
    return H;
  }

  /* ---------------- geometrie ---------------- */
  function preved(d, f) {
    const P = d.poz, out = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) { const q = f(P[i], P[i + 1], P[i + 2]); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; }
    return Object.assign({}, d, { poz: out });
  }
  function sit(km, m, jmeno, nazev, role) {
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const teles = m.decompose().map(km).filter(x => x.volume() > 1e-3).length;
    return { jmeno, nazev, role, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles, ks: 1, otocit: false };
  }

  /** Sestaví díly přes manifold-3d. Jmenovka potřebuje volby.font (opentype Font). */
  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p);
    const { Manifold: M, CrossSection: CS, Mesh } = w;
    const smaz = [];
    const km = x => { smaz.push(x); return x; };
    const cs = polys => km(new CS(polys, 'NonZero'));
    const vysun = (c, z0, z1) => km(km(c.extrude(z1 - z0)).translate([0, 0, z0]));
    const otoc = (body, n) => km(cs([body]).revolve(n));
    const ctx = { M, CS, Mesh, km, cs, vysun, otoc };
    try {
      const vys = { vlocka: postavVlocku, hvezda: postavHvezdu, banka: postavBanku, jmenovka: postavJmenovku }[p.druh](ctx, p, o, volby);
      return { dily: vys.dily, sestava: vys.sestava || vys.dily, kalibrace: vys.kalibrace || [], o, info: vys.info || {}, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /** Očko na špičce (směr ven): kroužek s krčkem do tvaru a otvor. posun > 0 zapouští očko do tvaru;
      vTvaru (obrys plného tvaru) = očko zapuštěné do dutého tvaru se se špičkou spojí příčkou. */
  function ockoCS(ctx, p, spicka, ven, krcek, vTvaru) {
    const d = p.ocko.prumer, Ro = d / 2 + p.ocko.stena, s = d / 2 - p.ocko.posun;
    const c = [spicka[0] + ven[0] * s, spicka[1] + ven[1] * s];
    const tvary = [kruh(Ro, c, 48)], uvnitr = p.ocko.posun >= d / 2 + Ro;
    if (!uvnitr) tvary.push(kapsle(c, [spicka[0] - ven[0] * Ro, spicka[1] - ven[1] * Ro], krcek));
    let plus = ctx.cs(tvary);
    if (vTvaru) plus = ctx.km(plus.add(ctx.km(ctx.cs([kapsle(c, spicka, krcek)]).intersect(vTvaru))));
    return { plus, otvor: ctx.cs([kruh(d / 2, c, 40)]), stred: c, Ro };
  }

  function postavVlocku(ctx, p, o) {
    const { km, cs, vysun } = ctx, v = p.vlocka;
    const V = vlockaObrysy(p, o);
    let tvar = km(cs(V.polygony).simplify(0.002));
    const info = { styl: V.styl, plochaBezOcka: tvar.area() };
    // nejtenčí prvek: otevření o 0,45 × minimum nesmí ubrat plochu
    const e = 0.45 * v.minimum;
    info.tenke = Math.max(0, 1 - km(km(tvar.offset(-e, 'Round', 2, 24)).offset(e, 'Round', 2, 24)).area() / info.plochaBezOcka);
    if (p.ocko.zap) {
      const q = Object.assign({}, p, { ocko: Object.assign({}, p.ocko, { stena: Math.max(p.ocko.stena, v.minimum) }) });
      const oc = ockoCS(ctx, q, [0, o.R], [0, 1], o.w);
      tvar = km(km(tvar.add(oc.plus)).subtract(oc.otvor));
      info.ocko = oc.stred;
    }
    info.obrys = tvar.toPolygons();
    return { dily: [sit(km, vysun(tvar, 0, v.tloustka), 'vlocka', 'Vločka', 'podklad')], info };
  }

  function postavHvezdu(ctx, p, o) {
    const { M, Mesh, km, cs, vysun } = ctx, s = p.hvezda, t = s.tloustka;
    const body = hvezdaBody(o.n, o.R, o.r), plna = cs([body]);
    const oc = p.ocko.zap ? ockoCS(ctx, p, [0, o.R], [0, 1], Math.max(2, 2 * p.ocko.stena), s.styl === 'obrys' ? plna : null) : null;
    const sOckem = c => (oc ? km(km(c.add(oc.plus)).subtract(oc.otvor)) : c);
    const info = { ocko: oc && oc.stred, obrys: body };
    if (s.styl === 'plocha') return { dily: [sit(km, vysun(sOckem(plna), 0, t), 'hvezda', 'Hvězda', 'podklad')], info };
    if (s.styl === 'obrys') {
      const vnitrek = km(plna.offset(-s.obrys, 'Miter', 20));
      info.plochaOtvoru = vnitrek.area();
      return { dily: [sit(km, vysun(sOckem(km(plna.subtract(vnitrek))), 0, t), 'hvezda', 'Hvězda – obrys', 'podklad')], info };
    }
    if (s.styl === 'vypoukla') {
      // spodek ve z = 0, hrana do výšky t, vrchol uprostřed ve výšce t + vyska; hřebeny k cípům, úžlabí k vnitřním vrcholům
      const N = body.length, P = [], I = [];
      for (const z of [0, t]) for (const q of body) P.push(q[0], q[1], z);
      P.push(0, 0, 0, 0, 0, t + s.vyska);
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        I.push(2 * N, j, i, i, j, N + j, i, N + j, N + i, 2 * N + 1, N + i, N + j);
      }
      let m = km(new M(new Mesh({ numProp: 3, vertProperties: new Float32Array(P), triVerts: new Uint32Array(I) })));
      if (oc) m = km(km(m.add(vysun(oc.plus, 0, t))).subtract(vysun(oc.otvor, -1, t + s.vyska + 1)));
      return { dily: [sit(km, m, 'hvezda', 'Hvězda – vypouklá', 'podklad')], info };
    }
    // zasouvací: plát A má výřez zdola do středu (a očko), plát B shora; otočené o 90° se zasunou do sebe
    const hs = o.vyrez / 2, obd = (y0, y1) => cs([[[-hs, y0], [hs, y0], [hs, y1], [-hs, y1]]]);
    // (u liché hvězdy je dole úžlabí a materiál vedle osy sahá níž než ono – výřez proto začíná pod celou hvězdou)
    const A = sit(km, vysun(km(sOckem(plna).subtract(obd(-o.R - 1, o.yStred + s.vule))), 0, t), 'platA', 'Plát A (s očkem)', 'podklad');
    const B = sit(km, vysun(km(plna.subtract(obd(o.yStred - s.vule, o.yTop + 1))), 0, t), 'platB', 'Plát B', 'text');
    // sestava: pláty nastojato (osa hvězdy = z), B otočený o 90° kolem svislé osy
    const y0 = Math.min(...body.map(q => q[1]));
    const sestava = [preved(A, (x, y, z) => [x, -(z - t / 2), y - y0]), preved(B, (x, y, z) => [z - t / 2, x, y - y0])];
    // zkušební spoj: dvě destičky s výřezem stejné šířky
    const zk = cs([[[-10, 0], [10, 0], [10, 14], [-10, 14]]]);
    const vzorek = sit(km, vysun(km(zk.subtract(cs([[[-hs, 7 - s.vule], [hs, 7 - s.vule], [hs, 15], [-hs, 15]]]))), 0, t), 'zkouska', 'Zkušební destička s výřezem', 'podklad');
    vzorek.ks = 2;
    return { dily: [A, B], sestava, kalibrace: [vzorek], info };
  }

  function postavBanku(ctx, p, o) {
    const { M, CS, Mesh, km, cs, vysun, otoc } = ctx, b = p.banka;
    if (o.chybaProfilu) throw new Error('Profil baňky nejde sestavit – viz záložka Kontrola.');
    const S = bankaSit(p, o);
    const telo = km(new M(new Mesh({ numProp: 3, vertProperties: S.poz, triVerts: S.idx })));
    const banka = sit(km, km(telo.add(otoc(hrdloObrys(o, o.Hb), 96))), 'banka', 'Baňka (vázový režim)', 'podklad');
    banka.vaza = true;
    // čepička: tiskne se otvorem dolů, strop dutiny je kužel 45°
    const rt = 1.2, rs = 0.6, zVrch = o.hk + o.ro - rt, q = o.rc - o.rl;
    let vnejsek = otoc([[0, 0], [o.ro, 0], [o.ro, o.hk], [rt, zVrch], [0, zVrch]], 96);
    const dutina = [[0, -1], [o.rl, -1]];
    if (q > 0) dutina.push([o.rl, ZAKLAP.pero], [o.rc, ZAKLAP.pero + q]);
    dutina.push([o.rc, o.hk], [rs, o.hk + o.rc - rs], [0, o.hk + o.rc - rs]);
    const info = { zVrch, zCepicky: o.Hb + 1 };
    let otvor = null;
    if (p.ocko.zap) {
      // očko = svislý plátek s vodorovnou dírou (kapka / kruh podle p.diry), kreslený v rovině (x, z) a vysunutý podél y
      const d = p.ocko.prumer, Ro = d / 2 + p.ocko.stena, ty = Math.max(1.6, p.ocko.stena), zc = zVrch + 0.8 + d / 2, kapka = p.diry !== 'kruh';
      const casti = [cs([[[-Ro, 0], [Ro, 0], [Ro, zc], [-Ro, zc]]]), cs([kruh(Ro, [0, zc], 48)])];
      if (kapka) casti.push(cs([kruh(Math.max(0.8, 0.7 * p.ocko.stena), [0, zc + d / 2 * Math.SQRT2], 24)]));
      const naStojato = (c, tl) => km(km(km(c.extrude(tl)).rotate([90, 0, 0])).translate([0, tl / 2, 0]));
      vnejsek = km(vnejsek.add(naStojato(km(CS.hull(casti)), ty)));
      otvor = naStojato(km(cs([G.obrysDiry(d / 2, 32, kapka)]).translate([0, zc])), ty + 2);
      info.ocko = { zc, ty, Ro, zVrchOcka: zc + (kapka ? d / 2 * Math.SQRT2 + Math.max(0.8, 0.7 * p.ocko.stena) : Ro) };
    }
    let cep = km(vnejsek.subtract(otoc(dutina, 96)));
    if (otvor) cep = km(cep.subtract(otvor));
    const cepicka = sit(km, cep, 'cepicka', 'Čepička s očkem', 'text');
    if (!p.ocko.zap) cepicka.nazev = 'Čepička';
    // zkušební hrdlo: krátký kužel s hrdlem – čepička se vyzkouší bez tisku celé baňky
    const zkouska = sit(km, otoc([[0, 0], [o.rh + 4, 0], [o.rh, 4]].concat(hrdloObrys(o, 4).slice(2)), 96), 'zkouska', 'Zkušební hrdlo (vázový režim)', 'podklad');
    zkouska.vaza = true;
    return { dily: [banka, cepicka], sestava: [banka, preved(cepicka, (x, y, z) => [x, y, z + info.zCepicky])], kalibrace: [zkouska], info };
  }

  function postavJmenovku(ctx, p, o, volby) {
    const { km, cs, vysun } = ctx, j = p.jmenovka, t = j.tloustka, SEG = 32;
    // tvar cedulky se zaoblením rohů (otevření a uzavření o poloměr zaoblení)
    let tvar = cs([cedulka(p, o)]);
    const rz = Math.min(j.zaobleni, 0.2 * Math.min(o.W, o.Hj));
    if (rz > 0.05 && j.tvar !== 'kolecko') tvar = km(km(km(km(tvar.offset(-rz, 'Round', 2, SEG)).offset(2 * rz, 'Round', 2, SEG)).offset(-rz, 'Round', 2, SEG)).simplify(0.002));
    const obrys = tvar.toPolygons().sort((a, b) => b.length - a.length)[0];
    const info = { obrys, rozmer: [o.W, o.Hj] };
    let dirka = null, plny = tvar;
    if (p.ocko.zap) {
      const c = stredDirky(obrys, j.dirka, p.ocko.prumer / 2 + p.ocko.stena);
      if (!c) throw new Error('Dírka se do cedulky nevejde – zmenšete otvor nebo stěnu očka.');
      dirka = { c, r: p.ocko.prumer / 2 };
      plny = km(tvar.subtract(cs([kruh(dirka.r, c, 40)])));
      info.dirka = c;
    }
    // text: sazba z klíčenek (výška verzálky = 1), zmenšený tak, aby se obdélník textu vešel do cedulky s okrajem
    let textK = null;
    const font = volby.font;
    if (j.text.trim()) {
      if (!font) throw new Error('Písmo se ještě nenačetlo.');
      const roz = KLIC.rozvrhniText(font, j.text, { radkovani: j.radkovani, zarovnani: 'stred' });
      info.chybi = roz.chybi;
      if (roz.obrysy.length) {
        const bb = [Infinity, Infinity, -Infinity, -Infinity];
        for (const q of obrys) { bb[0] = Math.min(bb[0], q[0]); bb[1] = Math.min(bb[1], q[1]); bb[2] = Math.max(bb[2], q[0]); bb[3] = Math.max(bb[3], q[1]); }
        const rP = dirka ? dirka.r + p.ocko.stena : 0;
        let kotva = [0, 0];
        if (j.tvar === 'stromecek') kotva = [0, -o.Hj / 2 + 0.14 * o.Hj + 0.4 * 0.86 * o.Hj / 3];
        else if (j.tvar === 'hvezda') kotva = [0, -0.03 * o.W];
        else if (dirka && j.dirka === 'vlevo') kotva = [(dirka.c[0] + rP + bb[2]) / 2, 0];
        else if (dirka) kotva = [0, (bb[1] + dirka.c[1] - rP) / 2];
        const vejde = c => {
          const hw = c * roz.sirka / 2, hh = c * roz.vyska / 2;
          for (let i = 0; i < 16; i++) {
            const u = i / 4 % 1, s = Math.floor(i / 4);
            const q = [[-hw + 2 * hw * u, -hh], [hw, -hh + 2 * hh * u], [hw - 2 * hw * u, hh], [-hw, hh - 2 * hh * u]][s];
            const x = kotva[0] + q[0], y = kotva[1] + q[1];
            if (!vBodu(obrys, x, y) || vzdalenostKObrysu(obrys, x, y) < j.okraj) return false;
            if (dirka && Math.hypot(x - dirka.c[0], y - dirka.c[1]) < dirka.r + j.okraj) return false;
          }
          return true;
        };
        let cap = o.cap;
        if (!vejde(cap)) { let a = 0, c = cap; for (let i = 0; i < 24; i++) { const s = (a + c) / 2; if (vejde(s)) a = s; else c = s; } cap = a; }
        if (!(cap >= 1.5)) throw new Error('Text se do cedulky nevejde – zkraťte ho, zvětšete cedulku nebo zmenšete okraj.');
        info.cap = cap; info.kotva = kotva; info.textRozmer = [cap * roz.sirka, cap * roz.vyska];
        const text0 = km(cs(roz.obrysy.map(b => b.map(([x, y]) => [kotva[0] + x * cap, kotva[1] + y * cap]))).simplify(0.004));
        textK = km(text0.intersect(plny));
        info.textOrez = Math.max(0, 1 - textK.area() / text0.area());
        const e = 0.2;
        info.tenke = Math.max(0, 1 - km(km(textK.offset(-e, 'Round', 2, 16)).offset(e, 'Round', 2, 16)).area() / textK.area());
      }
    }
    const dily = [];
    if (!textK) dily.push(sit(km, vysun(plny, 0, t), 'cedulka', 'Cedulka', 'podklad'));
    else if (j.rezim === 'vystouply') {
      dily.push(sit(km, vysun(plny, 0, t), 'cedulka', 'Cedulka', 'podklad'));
      dily.push(sit(km, vysun(textK, t, t + j.vyskaTextu), 'text', 'Text', 'text'));
    } else if (j.rezim === 'zapusteny') {
      // dno v barvě textu, nad ním cedulka s vybráním – při tisku jednou tryskou se barva mění ve výšce dna
      dily.push(sit(km, vysun(plny, 0, t - o.hloubka), 'dno', 'Dno (barva textu)', 'text'));
      dily.push(sit(km, vysun(km(plny.subtract(textK)), t - o.hloubka, t), 'cedulka', 'Cedulka s vybráním', 'podklad'));
    } else {
      // skrz: vnitřky písmen (O, A, e…) by vypadly – zůstane jen největší souvislý kus
      const kusy = km(plny.subtract(textK)).decompose().map(km).sort((a, c) => c.area() - a.area());
      info.ostruvku = kusy.length - 1;
      dily.push(sit(km, vysun(kusy[0], 0, t), 'cedulka', 'Cedulka s textem skrz', 'podklad'));
    }
    return { dily, info };
  }

  /* ---------------- tisk, kontroly modelu, hmotnost ---------------- */
  /** Díly na podložce: jmenovka zůstává pohromadě (text leží na cedulce), ostatní díly vedle sebe. */
  function kusyTisku(model, p, kalibrace) {
    const zdroj = kalibrace ? model.kalibrace : model.dily;
    if (!kalibrace && p.druh === 'jmenovka') return zdroj;
    return G.tiskoveRozlozeni(zdroj.flatMap(d => Array.from({ length: d.ks }, (_, i) => (d.ks > 1 ? Object.assign({}, d, { nazev: `${d.nazev} ${i + 1}` }) : d))), 1, 6, p.tisk.podlozkaX);
  }
  /** Plochy sítě: celkem, vodorovné dole (dno) a nahoře; největší sklon stěn ven (převis) a dovnitř ve stupních od svislice. */
  function rozborSite(d) {
    const P = d.poz, I = d.idx, b = G.obal(P);
    let celkem = 0, dno = 0, vrch = 0, ven = 0, dovnitr = 0;
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], c = 3 * I[t + 1], e = 3 * I[t + 2];
      const ux = P[c] - P[a], uy = P[c + 1] - P[a + 1], uz = P[c + 2] - P[a + 2], vx = P[e] - P[a], vy = P[e + 1] - P[a + 1], vz = P[e + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) continue;
      const A = l / 2, cz = nz / l, zmax = Math.max(P[a + 2], P[c + 2], P[e + 2]), zmin = Math.min(P[a + 2], P[c + 2], P[e + 2]);
      celkem += A;
      if (cz < -0.999 && zmax < b[2] + 0.01) dno += A;
      else if (cz > 0.999 && zmin > b[5] - 0.01) vrch += A;
      else if (A > 0.02 && Math.abs(cz) < 0.999) { if (cz < 0) ven = Math.max(ven, -cz); else dovnitr = Math.max(dovnitr, cz); }   // vodorovné schody (fazety u hrdla) hlídá kontrola zvlášť
    }
    return { celkem, dno, vrch, sklonVen: stup(Math.asin(Math.min(1, ven))), sklonDovnitr: stup(Math.asin(Math.min(1, dovnitr))) };
  }
  /** Objem materiálu dílu: plný díl, nebo ve vázovém režimu plášť × šířka stěny + dno × tloušťka dna. */
  function objemMaterialu(d, p) {
    if (!d.vaza) return d.objem;
    const r = rozborSite(d);
    return Math.min(d.objem, (r.celkem - r.dno - r.vrch) * p.tisk.stena + r.dno * p.tisk.dno);
  }
  function kontrolyModelu(p, model) {
    const H = [], t = p.tisk, info = model.info;
    const h = (uroven, text, pole, oprava) => H.push({ uroven, text, pole: pole || null, oprava });
    const naPodlozku = (a, b) => (a <= t.podlozkaX + 1e-6 && b <= t.podlozkaY + 1e-6) || (a <= t.podlozkaY + 1e-6 && b <= t.podlozkaX + 1e-6);
    for (const d of model.kalibrace) if (d.teles > 1) h('chyba', `${d.nazev}: díl se rozpadl na ${d.teles} části.`);
    for (const d of model.dily) {
      // u jmenovky jsou písmena samostatná tělesa ležící na cedulce – souvislost se tam nehlídá
      if (d.teles > 1 && p.druh !== 'jmenovka') h('chyba', `${d.nazev}: díl se rozpadl na ${d.teles} části – některý prvek není spojený.`);
      const b = G.obal(d.poz);
      if (!naPodlozku(b[3] - b[0], b[4] - b[1])) h('chyba', `${d.nazev} (${fmt(b[3] - b[0], 0)} × ${fmt(b[4] - b[1], 0)} mm) se nevejde na podložku ${fmt(t.podlozkaX)} × ${fmt(t.podlozkaY)}.`, ['tisk.podlozkaX', 'meritko']);
      if (d.vaza) {
        // hluboká zkroucená žebra a hrubé fazety přidávají sklon nad rezervu, se kterou se profil sráží
        const r = rozborSite(d), pv = p.banka.povrch;
        const pole = pv === 'zkrut' ? ['banka.zkrut', 'banka.hloubka'] : pv === 'fazety' ? ['banka.pocet'] : ['banka.srazit', 'tisk.uhel'];
        if (r.sklonVen > t.uhel + 1.5) h('varovani', `${d.nazev}: stěna se vyklání až ${fmt(r.sklonVen, 0)}° od svislice (mez ${fmt(t.uhel, 0)}°) – převis se bez podpor nevytiskne.`, pole);
        if (r.sklonDovnitr > t.uhel + 1.5) h('varovani', `${d.nazev}: stěna se zavírá až ${fmt(r.sklonDovnitr, 0)}° od svislice (mez ${fmt(t.uhel, 0)}°) – jedna stěna se tam roztrhá.`, pole);
        if (p.banka.srazit && Math.max(r.sklonVen, r.sklonDovnitr) > t.uhel + 1.5) {
          if (pv === 'zkrut') h('info', 'Sklon přidávají zkroucená žebra – zmenšete zkrut nebo hloubku žeber.', pole);
          if (pv === 'fazety') h('info', 'Sklon přidávají hrubé fazety – zvyšte počet fazet.', pole);
        }
      } else {
        const r = G.rozborTisku(d, t.uhel);
        if (r.previs > 1) h('varovani', `${d.nazev}: převisy nad ${fmt(t.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – může potřebovat podpory.`, ['tisk.uhel']);
        if (r.previs > 1 && p.diry === 'kruh' && d.jmeno === 'cepicka') h('info', 'Kruhová díra očka má převislý strop – zapněte Zobrazení → Díry jako kapka.');
        if (r.most > 2) h('info', `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu.`);
      }
    }
    if (p.druh === 'vlocka') {
      if (info.tenke > 0.005) h('varovani', `${fmt(info.tenke * 100, 1)} % plochy vločky je užší než ${fmt(p.vlocka.minimum, 2)} mm.`, ['vlocka.minimum']);
      else h('ok', `Vločka je jeden souvislý díl a žádný prvek není užší než ${fmt(p.vlocka.minimum, 2)} mm.`);
    }
    if (p.druh === 'jmenovka') {
      if (info.chybi && info.chybi.length) h('varovani', `Písmo nemá znaky ${info.chybi.join(' ')} – vynechají se. Zvolte jiné písmo.`, ['jmenovka.pismo']);
      if (info.cap && info.cap < model.o.cap - 0.01) h('info', `Výška verzálek zmenšena na ${fmt(info.cap, 1)} mm, aby se text vešel do cedulky.`, ['jmenovka.velikost']);
      if (info.cap && info.cap < 4) h('varovani', `Písmo vysoké jen ${fmt(info.cap, 1)} mm – drobné detaily se slijí.`, ['jmenovka.velikost', 'jmenovka.sirka']);
      if (info.textOrez > 0.01) h('varovani', `Text přesahuje cedulku – ořízne se ${fmt(info.textOrez * 100, 0)} % jeho plochy.`, ['jmenovka.velikost', 'jmenovka.okraj']);
      if (info.tenke > 0.05) h('varovani', `Tenké tahy písma: ${fmt(info.tenke * 100, 0)} % plochy textu je užší než stopa trysky 0,4 mm – zvolte tučnější písmo.`, ['jmenovka.pismo']);
      if (info.ostruvku > 0) h('varovani', `Text skrz: ${info.ostruvku} vnitřních ostrůvků písmen (např. v O, A, e) vypadlo. Šablonové písmo (Saira Stencil One, Black Ops One) je zachová.`, ['jmenovka.pismo']);
    }
    return H;
  }

  const API = {
    MATERIALY, ZAKLAP, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY, PROFILY,
    normalizuj, predvolba, popis, ulozProjekt, nactiProjekt, odvozene, kontroly, postav, kontrolyModelu,
    vlockaKostra, vlockaObrysy, hvezdaBody, bankaProfil, polomerProfilu, hrdloObrys, cedulka, stredDirky,
    kusyTisku, rozborSite, objemMaterialu, preved, kruh, kapsle, vBodu, vzdalenostKObrysu, nahodnik,
    kopie, vezmi: G.vezmi, poloz: G.poloz, fmt,
  };
  if (uzel) module.exports = API; else window.VANOCE = API;
})();
