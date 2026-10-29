/* Nožičky, krytky a podložky – jádro bez DOM (spustitelné v node).
   Parametry a jejich meze, předvolby, kontroly, stavba těles přes manifold-3d,
   rozmístění sady na podložce a odhad hmotnosti a doby tisku.
   Souřadnice: mm, osa Z nahoru = tisková poloha (díl leží na podložce z = 0).
   postav(w, p) → { kus: [díly jednoho kusu], dily: [rozmístěná sada], duchy: [noha/trubka pro náhled] }
   w = inicializovaný modul manifold (po setup()). Objekty WASM se po výpočtu uvolní. */
(function () {
  'use strict';
  const VERZE_FORMATU = 1;
  const RAD = Math.PI / 180;

  /* ---------- materiály (hustota g/cm³, dovolené ohybové protažení lamel, průtok mm³/s) ---------- */
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24, protazeni: 0.02, prutok: 8, barva: '#3f7bd6' },
    PETG: { nazev: 'PETG', hustota: 1.27, protazeni: 0.03, prutok: 7, barva: '#2f8f83' },
    ASA: { nazev: 'ABS / ASA', hustota: 1.06, protazeni: 0.03, prutok: 7, barva: '#7b6fd0' },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, protazeni: 0.04, prutok: 5, barva: '#b0a27a' },
    TPU: { nazev: 'TPU 95A', hustota: 1.21, protazeni: 0.25, prutok: 2.5, barva: '#d0663a' },
  };
  const BARVA_VLOZKY = '#2b2b2b';

  const TYPY = {
    nozicka: 'Nožička',
    pantofle: 'Pantofle na nohu',
    krytka: 'Krytka trubky',
    podlozka: 'Vyrovnávací podložka',
  };

  const VYCHOZI = {
    verze: VERZE_FORMATU, nazev: 'Nožička', typ: 'nozicka', material: 'PETG', vule: 0.2, kusu: 4, mezera: 6,
    nozicka: { tvar: 'valec', d: 40, d2: 30, ploska: 14, vyska: 18, srazeni: 1, upevneni: 'sroub',
      otvor: 4.5, hlava: 9, uhel: 90, zapusteni: 1, cepD: 8, cepL: 12 },
    pantofle: { profil: 'kruh', d: 22, a: 40, b: 20, r: 2, stena: 2.4, hloubka: 15, dno: 3, sklon: 0, konec: 'vodorovny' },
    krytka: { druh: 'vnitrni', profil: 'kruh', d: 25, a: 30, b: 20, r: 1.5, s: 1.5, hlava: 3, presahHlavy: 0.5, zkoseni: 0.6,
      hloubka: 14, lamel: 6, sterbina: 1.5, tl: 1.2, presah: 0.4, stena: 2 },
    podlozka: { rezim: 'klin', tvar: 'kruh', d: 40, a: 50, b: 40, r: 3, hMin: 1, sklon: 3, tOd: 0.5, krok: 0.5, zarezy: true },
    protiskluz: { pouzit: false, hloubka: 1.2, okraj: 2, vycnivani: 0.8, vule: 0.15 },
    tisk: { vypln: 30, previs: 45 },
  };

  /** Meze číselných polí [min, max]; mimo rozsah se ořízne. */
  const MEZE = {
    vule: [-0.3, 2], kusu: [1, 64], mezera: [2, 40],
    'nozicka.d': [6, 300], 'nozicka.d2': [4, 300], 'nozicka.ploska': [0, 300], 'nozicka.vyska': [2, 200], 'nozicka.srazeni': [0, 20],
    'nozicka.otvor': [1, 30], 'nozicka.hlava': [2, 60], 'nozicka.uhel': [60, 120], 'nozicka.zapusteni': [0, 50],
    'nozicka.cepD': [2, 50], 'nozicka.cepL': [2, 100],
    'pantofle.d': [4, 200], 'pantofle.a': [4, 300], 'pantofle.b': [4, 300], 'pantofle.r': [0, 100], 'pantofle.stena': [0.4, 20],
    'pantofle.hloubka': [1, 150], 'pantofle.dno': [0.4, 50], 'pantofle.sklon': [0, 30],
    'krytka.d': [4, 250], 'krytka.a': [4, 300], 'krytka.b': [4, 300], 'krytka.r': [0, 100], 'krytka.s': [0.3, 30],
    'krytka.hlava': [0.4, 30], 'krytka.presahHlavy': [0, 30], 'krytka.zkoseni': [0, 10], 'krytka.hloubka': [3, 150],
    'krytka.lamel': [2, 24], 'krytka.sterbina': [0.4, 10], 'krytka.tl': [0.4, 10], 'krytka.presah': [0, 3], 'krytka.stena': [0.4, 20],
    'podlozka.d': [6, 300], 'podlozka.a': [6, 300], 'podlozka.b': [6, 300], 'podlozka.r': [0, 150], 'podlozka.hMin': [0.2, 50],
    'podlozka.sklon': [0.2, 30], 'podlozka.tOd': [0.2, 50], 'podlozka.krok': [0.1, 20],
    'protiskluz.hloubka': [0.4, 10], 'protiskluz.okraj': [0.4, 30], 'protiskluz.vycnivani': [0, 5], 'protiskluz.vule': [-0.2, 1],
    'tisk.vypln': [0, 100], 'tisk.previs': [20, 70],
  };
  const VYCTY = {
    typ: Object.keys(TYPY), material: Object.keys(MATERIALY),
    'nozicka.tvar': ['valec', 'kuzel', 'kopule'], 'nozicka.upevneni': ['sroub', 'lepeni', 'cep'],
    'pantofle.profil': ['kruh', 'ctverec', 'obdelnik'], 'pantofle.konec': ['vodorovny', 'kolmy'],
    'krytka.druh': ['vnitrni', 'vnejsi'], 'krytka.profil': ['kruh', 'ctverec', 'obdelnik'],
    'podlozka.rezim': ['klin', 'sada'], 'podlozka.tvar': ['kruh', 'obdelnik'],
  };
  const CELA = new Set(['kusu', 'krytka.lamel']);

  /* ---------- pomocné ---------- */
  const kopie = o => JSON.parse(JSON.stringify(o));
  const vezmi = (o, c) => c.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, c, h) { const k = c.split('.'); const l = k.pop(); k.reduce((a, x) => a[x], o)[l] = h; }
  function cislo(s, nahr) {
    if (typeof s === 'number') return Number.isFinite(s) ? s : nahr;
    const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
    const x = t === '' ? NaN : Number(t);
    return Number.isFinite(x) ? x : nahr;
  }
  function fmt(x, des = 1) {
    if (!Number.isFinite(x)) return '–';
    const r = Math.round(x * 10 ** des) / 10 ** des;
    return String(Object.is(r, -0) ? 0 : r).replace('.', ',').replace('-', '−');
  }

  /** Doplní chybějící hodnoty, ořízne meze a výčty; hlaseni = co se změnilo (pro uživatele). */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hlaseni = [];
    const v = vstup && typeof vstup === 'object' ? vstup : {};
    const projdi = (vzor, zdroj, cesta) => {
      for (const k of Object.keys(vzor)) {
        const c = cesta ? cesta + '.' + k : k, h = zdroj ? zdroj[k] : undefined;
        if (vzor[k] && typeof vzor[k] === 'object') { projdi(vzor[k], h && typeof h === 'object' ? h : null, c); continue; }
        if (h === undefined) continue;
        if (typeof vzor[k] === 'boolean') { poloz(p, c, !!h); continue; }
        if (c === 'nazev') { poloz(p, c, String(h).slice(0, 120)); continue; }
        if (VYCTY[c]) {
          if (VYCTY[c].includes(h)) poloz(p, c, h); else hlaseni.push(`neznámá volba ${c} = ${h}`);
          continue;
        }
        let x = cislo(h, NaN);
        if (!Number.isFinite(x)) { hlaseni.push(`${c}: neplatné číslo`); continue; }
        const m = MEZE[c];
        if (CELA.has(c)) x = Math.round(x);
        if (m && (x < m[0] || x > m[1])) { const y = Math.min(m[1], Math.max(m[0], x)); hlaseni.push(`${c} omezeno na ${fmt(y, 2)}`); x = y; }
        poloz(p, c, x);
      }
    };
    projdi(VYCHOZI, v, '');
    p.verze = VERZE_FORMATU;
    return { p, hlaseni };
  }

  /* ---------- 2D obrysy (body proti směru hodinových ručiček) ---------- */
  const segKruh = r => Math.max(32, Math.min(160, Math.ceil(2 * Math.PI * Math.abs(r) / 0.6)));
  function kruh(r, n = segKruh(r)) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
    return pts;
  }
  /** Zaoblený obdélník L × W s poloměrem r, střed v počátku. */
  function obdelnik(L, W, r) {
    r = Math.max(0, Math.min(r, L / 2 - 1e-3, W / 2 - 1e-3));
    if (r < 0.05) return [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]];
    const n = Math.max(3, Math.ceil(segKruh(r) / 4)), pts = [];
    for (const [cx, cy, a0] of [[L / 2 - r, -W / 2 + r, -90], [L / 2 - r, W / 2 - r, 0], [-L / 2 + r, W / 2 - r, 90], [-L / 2 + r, -W / 2 + r, 180]]) {
      for (let i = 0; i <= n; i++) { const a = (a0 + 90 * i / n) * RAD; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    }
    return pts;
  }
  /** Obrys profilu (kruh / čtverec / obdélník) posunutý o `o` ven (záporné = dovnitř). */
  function obrys(prof, o) {
    if (prof.profil === 'kruh') return kruh(prof.d / 2 + o);
    const a = prof.a, b = prof.profil === 'ctverec' ? prof.a : prof.b;
    return obdelnik(a + 2 * o, b + 2 * o, prof.r + o);
  }
  /** Poloviční rozměr profilu ve směru X a Y (bez posunu). */
  function pul(prof) {
    if (prof.profil === 'kruh') return [prof.d / 2, prof.d / 2];
    return [prof.a / 2, (prof.profil === 'ctverec' ? prof.a : prof.b) / 2];
  }

  /* ---------- odvozené hodnoty a profil nožičky ---------- */
  /** Profil nožičky (r, z) v poloze „nábytkem dolů“: z = 0 dosedá na nábytek, z = H na podlahu. */
  function profilNozicky(n) {
    const H = n.vyska, Rm = n.d / 2;
    const pts = [[0, 0], [Rm, 0]];
    if (n.tvar === 'kopule') {
      const b = Math.min(n.ploska / 2, Rm - 0.01);
      const zc = (b * b + H * H - Rm * Rm) / (2 * H), R = Math.hypot(Rm, zc);
      const a0 = Math.atan2(0 - zc, Rm), a1 = Math.atan2(H - zc, b);
      const k = Math.max(12, Math.ceil(Math.abs(a1 - a0) * R / 0.6));
      for (let i = 1; i < k; i++) { const a = a0 + (a1 - a0) * i / k; pts.push([R * Math.cos(a), zc + R * Math.sin(a)]); }
      pts.push([b, H]);
    } else {
      const Rf = n.tvar === 'kuzel' ? n.d2 / 2 : Rm;
      const c = Math.min(n.srazeni, H * 0.8, Rf * 0.8);
      if (c > 0.01) { pts.push([Rf + (Rm - Rf) * c / H, H - c]); pts.push([Rf - c, H]); } else pts.push([Rf, H]);
    }
    pts.push([0, H]);
    return pts;
  }
  /** Poloměr plochy, která leží na podlaze (u kopule ploška, jinak spodní průměr minus sražení). */
  function polomerPodlahy(n) {
    if (n.tvar === 'kopule') return Math.min(n.ploska / 2, n.d / 2);
    const Rf = n.tvar === 'kuzel' ? n.d2 / 2 : n.d / 2;
    return Rf - Math.min(n.srazeni, n.vyska * 0.8, Rf * 0.8);
  }
  /** Největší převis (° od svislice) obrysu rotačního profilu v tiskové poloze; otoceni = podlahou dolů. */
  function previsProfilu(pts, otoceni, H) {
    // obrys jde proti směru hodinových ručiček v rovině (r, z): vnější normála úseku (dz, −dr),
    // úsek míří dolů, když se při průchodu vzdaluje od osy (dr > 0); otočení obrací pořadí
    const P = otoceni ? pts.map(([r, z]) => [r, H - z]).reverse() : pts;
    let max = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const [r1, z1] = P[i], [r2, z2] = P[i + 1], dr = r2 - r1, dz = z2 - z1;
      if (dr <= 1e-9) continue;
      if (Math.abs(dz) < 1e-9 && Math.min(z1, z2) < 1e-6) continue;   // plocha na podložce
      max = Math.max(max, Math.atan2(dr, Math.abs(dz)) / RAD);
    }
    return max;
  }

  function odvozene(p) {
    const o = { typ: p.typ, mat: MATERIALY[p.material] };
    if (p.typ === 'nozicka') {
      const n = p.nozicka;
      o.profil = profilNozicky(n);
      o.otoceni = n.upevneni === 'cep';   // čep musí trčet nahoru → tiskne se podlahou dolů
      o.previs = previsProfilu(o.profil, o.otoceni, n.vyska);
      o.rPodlahy = polomerPodlahy(n);
      const tz = 0.5 * (n.hlava - n.otvor) / Math.tan(n.uhel / 2 * RAD);
      o.kuzelSroubu = tz;
      o.podHlavou = n.vyska - (p.protiskluz.pouzit ? p.protiskluz.hloubka : 0) - n.zapusteni - tz;
      o.cepPrumer = n.cepD - 2 * p.vule;
      if (n.tvar === 'kopule') {
        const b = Math.min(n.ploska / 2, n.d / 2), zc = (b * b + n.vyska * n.vyska - n.d * n.d / 4) / (2 * n.vyska);
        o.rKopule = Math.hypot(n.d / 2, zc); o.maxPrumer = zc > 0 ? 2 * o.rKopule : n.d;
      } else o.maxPrumer = Math.max(n.d, n.tvar === 'kuzel' ? n.d2 : 0);
    } else if (p.typ === 'pantofle') {
      const t = p.pantofle, th = t.sklon * RAD, [ex, ey] = pul(t);
      o.eIn = ex + p.vule; o.eOut = o.eIn + t.stena; o.eyOut = ey + p.vule + t.stena;
      o.sRim = (t.dno + o.eIn * Math.sin(th)) / Math.cos(th) + t.hloubka;
      o.vyska = o.sRim * Math.cos(th) + o.eOut * Math.sin(th);
      o.vnitrni = [2 * o.eIn, 2 * (ey + p.vule)];
      o.dnoMin = t.dno - (p.protiskluz.pouzit ? p.protiskluz.hloubka : 0);
    } else if (p.typ === 'krytka') {
      const k = p.krytka, [ex, ey] = pul(k);
      o.vnitrniTrubky = [2 * (ex - k.s), 2 * (ey - k.s)];
      if (k.druh === 'vnitrni') {
        o.rukav = [o.vnitrniTrubky[0] - 2 * p.vule, o.vnitrniTrubky[1] - 2 * p.vule];
        o.zub = [o.vnitrniTrubky[0] + 2 * k.presah, o.vnitrniTrubky[1] + 2 * k.presah];
        o.hb = p.vule + k.presah;                                  // výška zubu nad rukávem
        o.zTop = k.hlava + k.hloubka;
        o.zP2 = o.zTop - o.hb * Math.tan(60 * RAD);                 // náběh 30° od svislice
        o.zP1 = o.zP2 - 0.6;
        o.zLow = o.zP1 - o.hb / Math.tan(p.tisk.previs * RAD);      // spodek zubu v úhlu převisu
        o.koren = Math.min(1, k.hloubka * 0.1);
        o.lJazyk = o.zTop - (k.hlava + o.koren);
        o.protazeni = o.lJazyk > 0 ? 3 * k.tl * k.presah / (2 * o.lJazyk * o.lJazyk) : Infinity;
        const obvod = k.profil === 'kruh' ? Math.PI * o.rukav[0] : 2 * (o.rukav[0] + o.rukav[1]);
        o.pocetLamel = k.profil === 'kruh' ? k.lamel : 4;
        o.sirkaJazyka = obvod / o.pocetLamel - k.sterbina;
        o.potrebaSterbiny = k.profil === 'kruh' ? 2 * Math.PI * k.presah / k.lamel : Math.SQRT2 * k.presah;
        o.dutina = [o.rukav[0] - 2 * k.tl, o.rukav[1] - 2 * k.tl];
        o.vyska = o.zTop;
        o.pudorys = [2 * (ex + k.presahHlavy), 2 * (ey + k.presahHlavy)];
      } else {
        o.vnitrni = [2 * (ex + p.vule), 2 * (ey + p.vule)];
        o.vyska = k.hlava + k.hloubka;
        o.pudorys = [o.vnitrni[0] + 2 * k.stena, o.vnitrni[1] + 2 * k.stena];
      }
    } else if (p.typ === 'podlozka') {
      const q = p.podlozka;
      o.Lx = q.tvar === 'kruh' ? q.d : q.a;
      o.Ly = q.tvar === 'kruh' ? q.d : q.b;
      o.hMax = q.hMin + o.Lx * Math.tan(q.sklon * RAD);
      o.tloustky = q.rezim === 'sada' ? Array.from({ length: p.kusu }, (_, i) => q.tOd + i * q.krok) : null;
      o.dnoMin = (q.rezim === 'sada' ? q.tOd : q.hMin) - (p.protiskluz.pouzit ? p.protiskluz.hloubka : 0);
    }
    o.protiskluz = p.protiskluz.pouzit && !(p.typ === 'krytka') && !(p.typ === 'nozicka' && p.nozicka.tvar === 'kopule');
    o.tlVlozky = p.protiskluz.hloubka + p.protiskluz.vycnivani;
    return o;
  }

  /* ---------- kontroly ---------- */
  /** Seznam hlášení {uroven: chyba|varovani|info|ok, text, pole}. Chyba = díl nelze vyrobit nebo nebude fungovat. */
  function kontroly(p) {
    const o = odvozene(p), h = [];
    const ch = (pole, text) => h.push({ uroven: 'chyba', text, pole });
    const va = (pole, text) => h.push({ uroven: 'varovani', text, pole });
    const inf = (pole, text) => h.push({ uroven: 'info', text, pole });
    const lim = p.tisk.previs, mat = o.mat;

    if (p.typ === 'nozicka') {
      const n = p.nozicka;
      if (n.tvar === 'kuzel' && Math.abs(n.d - n.d2) < 0.05) inf('nozicka.d2', 'Oba průměry kužele jsou stejné – je to válec.');
      if (n.tvar === 'kopule' && n.ploska / 2 >= n.d / 2 - 0.5) ch('nozicka.ploska', 'Ploška kopule musí být menší než průměr nožičky.');
      if (n.tvar === 'kopule' && n.ploska < 4) va('nozicka.ploska', 'Ploška pod 4 mm = téměř bodový dotyk, nožička bude tlačit do podlahy.');
      if (o.previs > 89 || (o.previs > lim && n.tvar === 'kopule' && o.otoceni)) ch(n.upevneni === 'cep' ? 'nozicka.upevneni' : 'nozicka.tvar',
        `Při tisku ${o.otoceni ? 'podlahou dolů (kvůli čepu)' : 'nábytkem dolů'} má obrys vodorovný převis – bez podpor nevytisknete. ${n.tvar === 'kopule' ? 'Kopuli tiskněte plochou k nábytku dolů (šroub nebo lepení).' : ''}`);
      else if (o.previs > lim) va(n.tvar === 'kopule' ? 'nozicka.vyska' : 'nozicka.d2',
        `Převis obrysu ${fmt(o.previs, 0)}° od svislice je víc než ${fmt(lim, 0)}° – potřeba podpor nebo jiný tvar.`);
      if (n.tvar === 'kopule' && o.maxPrumer > n.d + 0.1 && !o.otoceni)
        va('nozicka.vyska', `Kopule je vyšší než polokoule – nejširší místo (Ø ${fmt(o.maxPrumer)} mm) je nad podložkou a spodek přečnívá.`);
      if (n.upevneni === 'sroub') {
        if (n.otvor >= n.hlava) ch('nozicka.hlava', 'Průměr hlavy šroubu musí být větší než otvor.');
        if (n.hlava / 2 > o.rPodlahy - 0.8) ch('nozicka.hlava', `Hlava šroubu (Ø ${fmt(n.hlava)}) se nevejde do plochy na podlaze (Ø ${fmt(2 * o.rPodlahy)}).`);
        if (n.otvor / 2 > n.d / 2 - 1.2) ch('nozicka.otvor', 'Otvor pro šroub je skoro tak široký jako nožička.');
        if (o.podHlavou < 1.2) ch('nozicka.zapusteni', `Pod hlavou šroubu zbývá jen ${fmt(o.podHlavou, 2)} mm materiálu – zmenšete zapuštění nebo zvyšte nožičku.`);
        else if (o.podHlavou < 3) va('nozicka.zapusteni', `Pod hlavou šroubu je jen ${fmt(o.podHlavou)} mm – tenké dno se při dotažení může prolomit (doporučeno ≥ 3 mm).`);
        if (n.zapusteni < 0.5) va('nozicka.zapusteni', 'Hlava šroubu skoro u podlahy – při stlačení nožičky může škrábat. Zapusťte ji aspoň 0,5–1 mm.');
      }
      if (n.upevneni === 'cep') {
        if (o.cepPrumer < 3) va('nozicka.cepD', `Čep Ø ${fmt(o.cepPrumer)} mm je slabý – snadno se ulomí ve vrstvě u nožičky.`);
        if (n.cepL > 4 * o.cepPrumer) va('nozicka.cepL', 'Čep je dlouhý vůči průměru – ulomí se. Zkraťte jej nebo zvětšete průměr.');
        if (n.cepD >= n.d - 2) ch('nozicka.cepD', 'Čep je stejně široký jako nožička.');
        inf('nozicka.upevneni', 'Nožička s čepem se tiskne podlahou dolů (čep nahoru); čep se zalepí do vyvrtané díry.');
      }
      if (n.upevneni === 'lepeni') inf('nozicka.upevneni', 'Plochu k nábytku přilepte (oboustranná pěnová páska, kontaktní lepidlo, u PETG/PLA vteřinové lepidlo s aktivátorem).');
      if (o.protiskluz && n.upevneni === 'cep') va('protiskluz.pouzit', 'Kapsa pro vložku je při tisku podlahou dolů vespod – její strop se tiskne jako most.');
    }

    if (p.typ === 'pantofle') {
      const t = p.pantofle;
      if (t.stena < 1.2) ch('pantofle.stena', `Stěna ${fmt(t.stena, 2)} mm je méně než 3 perimetry – praskne.`);
      else if (t.stena < 1.6) va('pantofle.stena', 'Stěna pod 1,6 mm je u pantofle slabá – noha ji při posouvání roztrhne.');
      if (t.dno < 1.2) ch('pantofle.dno', `Dno ${fmt(t.dno, 2)} mm je tenké – noha jej prošlápne.`);
      else if (t.dno < 2) va('pantofle.dno', 'Dno pod 2 mm se rychle prodře; doporučeno 2,5–4 mm.');
      if (o.protiskluz && o.dnoMin < 1.2) ch('protiskluz.hloubka', `Nad kapsou pro vložku zbývá jen ${fmt(o.dnoMin, 2)} mm dna – zmenšete hloubku kapsy nebo zvětšete dno.`);
      if (t.hloubka < 6) va('pantofle.hloubka', 'Mělký návlek (pod 6 mm) z nohy snadno sklouzne.');
      if (t.sklon > lim) va('pantofle.sklon', `Stěna je skloněná o ${fmt(t.sklon)}° – víc než povolený převis ${fmt(lim, 0)}°.`);
      if (t.profil !== 'kruh' && t.r * 2 >= Math.min(t.a, t.profil === 'ctverec' ? t.a : t.b)) va('pantofle.r', 'Zaoblení rohů je tak velké, že profil je skoro kulatý.');
      if (p.vule < 0) inf('vule', 'Záporná vůle = nalisování; pantofle z PLA může prasknout, lepší je PETG nebo TPU.');
      if (p.vule > 0.6) va('vule', 'Velká vůle – pantofle se bude viklat; při větší vůli ji přilepte.');
      if (t.sklon > 0 && t.konec === 'kolmy') inf('pantofle.konec', 'Konec nohy kolmý k ose – dno je pod nohou nestejně tlusté (nejtenčí na nižší straně).');
      if (p.material === 'TPU') inf('material', 'Pantofle z TPU dobře drží (pruží) a nekloužou – vůli dejte 0 až −0,2 mm.');
    }

    if (p.typ === 'krytka') {
      const k = p.krytka;
      if (o.vnitrniTrubky[0] < 2 || o.vnitrniTrubky[1] < 2) ch('krytka.s', 'Stěna trubky je tlustší než polovina profilu.');
      if (k.hlava < 0.8) ch('krytka.hlava', `Čelo ${fmt(k.hlava, 2)} mm je tenké (méně než 4 vrstvy) – prorazí se.`);
      else if (k.hlava < 1.6) va('krytka.hlava', 'Čelo pod 1,6 mm je slabé; doporučeno 2–3 mm.');
      if (k.zkoseni >= k.hlava) va('krytka.zkoseni', 'Sražení je větší než tloušťka čela – omezí se.');
      if (k.druh === 'vnitrni') {
        if (o.dutina[0] < 0.6 || o.dutina[1] < 0.6) ch('krytka.tl', 'Lamely jsou tak tlusté, že uvnitř nezbude dutina – nemohou pružit. Zmenšete tloušťku lamel.');
        if (k.tl < 0.8) va('krytka.tl', 'Lamela pod 0,8 mm = méně než 2 perimetry, snadno se ulomí.');
        if (o.zLow < k.hlava + o.koren + 0.5) ch('krytka.hloubka', `Zasunutí ${fmt(k.hloubka)} mm je krátké pro zub lamely (potřeba aspoň ${fmt(o.zTop - o.zLow + o.koren + 0.5)} mm).`);
        const dov = mat.protazeni;
        if (o.protazeni > dov) ch('krytka.presah', `Lamely z ${mat.nazev} se při zasunutí prohnou o ${fmt(o.protazeni * 100, 1)} % – víc než snese materiál (${fmt(dov * 100, 0)} %). Prodlužte zasunutí, zeslabte lamely nebo zmenšete přesah zubu.`);
        else if (o.protazeni > 0.7 * dov) va('krytka.presah', `Lamely jsou namáhané na ${fmt(100 * o.protazeni / dov, 0)} % pružnosti ${mat.nazev} – po několika nasazeních mohou prasknout.`);
        if (k.presah < 0.15) va('krytka.presah', 'Přesah zubu pod 0,15 mm je menší než přesnost tisku – krytka může vypadávat.');
        if (k.sterbina < o.potrebaSterbiny) ch('krytka.sterbina', `Štěrbiny ${fmt(k.sterbina, 2)} mm se při stlačení lamel zavřou (potřeba ≥ ${fmt(o.potrebaSterbiny, 2)} mm) – lamely se o sebe zapřou.`);
        if (o.sirkaJazyka < 2) ch(k.profil === 'kruh' ? 'krytka.lamel' : 'krytka.sterbina', `Lamela je jen ${fmt(o.sirkaJazyka)} mm široká – zmenšete počet lamel nebo štěrbinu.`);
        if (k.profil !== 'kruh') inf('krytka.profil', 'Čtyřhranná krytka má štěrbiny v rozích – každá strana pruží jako jedna lamela.');
        if (p.vule < 0) va('vule', 'Záporná vůle rukávu – zub i rukáv se zapřou o trubku, zasunete ji jen silou.');
      } else {
        if (k.stena < 1.2) ch('krytka.stena', `Stěna krytky ${fmt(k.stena, 2)} mm je tenká.`);
        if (p.vule > 0.3) va('vule', 'Vnější krytka s vůlí nad 0,3 mm nebude držet – přilepte ji nebo zmenšete vůli (0 až −0,1 = nalisování).');
        if (p.vule < -0.15 && p.material !== 'TPU') va('vule', 'Silné nalisování tuhé krytky – může prasknout po vrstvách. TPU snese víc.');
      }
    }

    if (p.typ === 'podlozka') {
      const q = p.podlozka;
      const tMin = q.rezim === 'sada' ? q.tOd : q.hMin;
      if (tMin < 0.6) va(q.rezim === 'sada' ? 'podlozka.tOd' : 'podlozka.hMin', `Nejtenčí místo ${fmt(tMin, 2)} mm = jen 2–3 vrstvy; volte výšku vrstvy 0,1–0,15 mm.`);
      if (q.rezim === 'klin') {
        if (q.sklon < 2) inf('podlozka.sklon', `Malý sklon – horní plocha bude schodovitá (výška vrstvy 0,2 mm = schod po ${fmt(0.2 / Math.tan(q.sklon * RAD), 0)} mm).`);
        if (q.sklon > 15) va('podlozka.sklon', 'Sklon nad 15° – noha po klínu sklouzne; přidejte protiskluz nebo kapsu.');
      }
      if (q.rezim === 'sada' && p.kusu < 2) inf('kusu', 'Sada stupňovaných podložek s jediným kusem – nastavte víc kusů.');
      if (q.rezim === 'sada' && q.zarezy && p.kusu > 10) inf('podlozka.zarezy', 'Zářezů je nejvýš 10; další podložky mají 10 a liší se tloušťkou.');
      if (o.protiskluz && o.dnoMin < 0.8) ch('protiskluz.hloubka', `Nad kapsou pro vložku zbývá jen ${fmt(o.dnoMin, 2)} mm – zmenšete hloubku kapsy nebo zvětšete tloušťku.`);
    }

    // protiskluzová vložka z TPU
    if (p.protiskluz.pouzit) {
      if (p.typ === 'krytka') inf('protiskluz.pouzit', 'Krytka trubky nemá dosedací plochu – vložka se negeneruje.');
      else if (p.typ === 'nozicka' && p.nozicka.tvar === 'kopule') inf('protiskluz.pouzit', 'Kopule nemá rovnou plochu pro vložku – vložka se negeneruje.');
      else {
        const ps = p.protiskluz;
        if (ps.okraj < 1.2) va('protiskluz.okraj', 'Okraj kolem kapsy pod 1,2 mm se ulomí.');
        if (ps.vycnivani < 0.3) va('protiskluz.vycnivani', 'Vložka vyčnívá méně než 0,3 mm – po stlačení přestane dotýkat podlahu.');
        if (ps.vycnivani > ps.hloubka * 1.5) va('protiskluz.vycnivani', 'Vložka vyčnívá víc než 1,5× hloubky kapsy – při posunutí nábytku se vyloupne.');
        if (o.tlVlozky < 1) va('protiskluz.hloubka', 'Vložka je tenčí než 1 mm – z TPU se špatně tiskne i lepí.');
        if (p.material === 'TPU') inf('protiskluz.pouzit', 'Hlavní díl je z TPU – vložka není potřeba.');
        else inf('protiskluz.pouzit', `Vložku tiskněte z TPU (95A nebo měkčího), pomalu (20–30 mm/s) a se 100% výplní; do kapsy ji vlepte (vteřinové lepidlo na pryž). Hlavní díl: ${mat.nazev}.`);
        if (p.typ === 'pantofle' || p.typ === 'podlozka') inf('protiskluz.hloubka', 'Kapsa je ve spodní ploše – její strop se tiskne jako most přes celou kapsu. Zapněte ve sliceru mosty (bridging); jinak kapsu vynechte a vložku jen přilepte.');
        if (ps.vule < 0) inf('protiskluz.vule', 'Záporná vůle vložky = vtlačení; TPU to snese.');
      }
    }

    if (p.material === 'PLA' && (p.typ === 'pantofle' || p.typ === 'nozicka')) inf('material', 'PLA je tvrdé a křehké – na nožičky a pantofle je lepší PETG nebo TPU (a PLA měkne nad 50 °C, např. u topení).');
    if (!h.some(x => x.uroven === 'chyba' || x.uroven === 'varovani')) h.unshift({ uroven: 'ok', text: 'Bez chyb a varování – díl je tisknutelný bez podpor.', pole: null });
    return h;
  }

  /* ---------- stavba přes manifold ---------- */
  function postav(w, p) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const o = odvozene(p);
    const cs = pts => k(new CS([pts], 'Positive'));
    const hranol = (pts, z0, z1) => k(k(cs(pts).extrude(z1 - z0)).translate([0, 0, z0]));
    /** Komolé těleso mezi dvěma konvexními obrysy (obal bodů) – přesný přechod offsetu. */
    const komoly = (pts0, z0, pts1, z1) => k(M.hull([...pts0.map(([x, y]) => [x, y, z0]), ...pts1.map(([x, y]) => [x, y, z1])]));
    const valec = (r, z0, z1, r2) => k(k(M.cylinder(z1 - z0, r, r2 === undefined ? r : r2, segKruh(Math.max(r, r2 || 0)))).translate([0, 0, z0]));
    const sjednot = a => k(M.union(a));
    const odecti = (a, b) => (b.length ? k(M.difference([a, ...b])) : a);
    const sit = (m, nazev, barva, druh) => {
      const st = m.status();
      if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
      if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné – zkontrolujte rozměry`);
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
      const poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      return { nazev, barva, druh, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), plocha: m.surfaceArea(), rod: m.genus() };
    };
    const ps = p.protiskluz, barva = o.mat.barva;
    /** Kapsa pro vložku v dosedací ploše (na z = zPlochy, dolu = kapsa míří nahoru do tělesa). Vrací [kapsa, vložka]. */
    const kapsaAVlozka = (telo, zPlochy, dolu) => {
      const rez = k(telo.slice(dolu ? zPlochy + 0.01 : zPlochy - 0.01));
      const vnitr = k(rez.offset(-ps.okraj, 'Round', 2, segKruh(ps.okraj)));
      if (vnitr.isEmpty() || vnitr.area() < 1) throw new Error('Kapsa pro vložku: okraj je širší než dosedací plocha');
      const kapsa = dolu ? k(k(vnitr.extrude(ps.hloubka + 1)).translate([0, 0, zPlochy - 1]))
        : k(k(vnitr.extrude(ps.hloubka + 1)).translate([0, 0, zPlochy - ps.hloubka]));
      const vl = k(vnitr.offset(-ps.vule, 'Round', 2, 24));
      if (vl.isEmpty()) throw new Error('Vložka: vůle je větší než kapsa');
      return [kapsa, k(vl.extrude(o.tlVlozky))];
    };

    try {
      const kusy = [];     // [{dily: [...]}] – jeden nebo víc různých kusů (sada podložek)
      let duchy = [];
      const jedenKus = (telo, vlozka, nazev) => {
        const d = [sit(telo, nazev, barva, 'hlavni')];
        if (vlozka) d.push(sit(vlozka, 'Vložka TPU', BARVA_VLOZKY, 'vlozka'));
        return d;
      };

      if (p.typ === 'nozicka') {
        const n = p.nozicka, H = n.vyska;
        let telo = k(M.revolve(cs(o.profil.map(([r, z]) => [Math.max(0, r), z])), segKruh(n.d / 2), 360));
        const odeb = [];
        let vlozka = null;
        if (o.protiskluz) { const [kap, vl] = kapsaAVlozka(telo, H, false); odeb.push(kap); vlozka = vl; }
        const zPl = H - (o.protiskluz ? ps.hloubka : 0);   // plocha, ze které se zapouští hlava
        if (n.upevneni === 'sroub') {
          const zh = zPl - n.zapusteni;
          odeb.push(valec(n.otvor / 2, -1, H + 1));
          odeb.push(valec(n.hlava / 2, zh, H + 1));
          odeb.push(valec(n.otvor / 2, zh - o.kuzelSroubu, zh, n.hlava / 2));
        }
        telo = odecti(telo, odeb);
        if (n.upevneni === 'cep') {
          const r = o.cepPrumer / 2, f = Math.min(0.6, r * 0.3);
          const cep = sjednot([valec(r, -n.cepL + f, 0.5), valec(r - f, -n.cepL, -n.cepL + f, r)]);
          telo = sjednot([telo, cep]);
        }
        if (o.otoceni) telo = k(k(telo.rotate([180, 0, 0])).translate([0, 0, H]));
        kusy.push(jedenKus(telo, vlozka, p.nazev || 'Nožička'));
      }

      if (p.typ === 'pantofle') {
        const t = p.pantofle, th = t.sklon;
        const thr = th * RAD, sLow = -(o.eOut * Math.sin(thr) + 2) / Math.cos(thr) - 2;
        const vnejsi = hranol(obrys(t, p.vule + t.stena), sLow, o.sRim);
        let telo = k(k(vnejsi.rotate([0, th, 0])).trimByPlane([0, 0, 1], 0));
        const sKonec = (t.dno + o.eIn * Math.sin(thr)) / Math.cos(thr);
        const dutinaFn = (ofs, s1) => {
          const s0 = t.konec === 'kolmy' ? sKonec : sLow;
          let d = k(hranol(obrys(t, ofs), s0, s1).rotate([0, th, 0]));
          if (t.konec !== 'kolmy') d = k(d.trimByPlane([0, 0, 1], t.dno));
          return d;
        };
        const odeb = [dutinaFn(p.vule, o.sRim + 5)];
        let vlozka = null;
        if (o.protiskluz) { const [kap, vl] = kapsaAVlozka(telo, 0, true); odeb.push(kap); vlozka = vl; }
        telo = odecti(telo, odeb);
        kusy.push(jedenKus(telo, vlozka, p.nazev || 'Pantofle'));
        duchy.push(sit(dutinaFn(0, o.sRim + 30), 'Noha', '#9aa4ae', 'duch'));
      }

      if (p.typ === 'krytka') {
        const kr = p.krytka, T = ofs => obrys(kr, ofs);
        const zk = Math.min(kr.zkoseni, kr.hlava * 0.8);
        const casti = [];
        let odeb = [];
        if (kr.druh === 'vnitrni') {
          const ph = kr.presahHlavy;
          if (zk > 0.01) casti.push(komoly(T(ph - zk), 0, T(ph), zk));
          casti.push(hranol(T(ph), zk > 0.01 ? zk - 0.01 : 0, kr.hlava));
          const S = ofs => T(-kr.s - p.vule + ofs);
          const hb = o.hb;
          casti.push(hranol(S(0), kr.hlava - 0.2, o.zLow + 0.01));
          if (hb > 0.01) {
            casti.push(komoly(S(0), o.zLow, S(hb), o.zP1));
            casti.push(hranol(S(hb), o.zP1 - 0.01, o.zP2 + 0.01));
            casti.push(komoly(S(hb), o.zP2, S(0), o.zTop));
          } else casti.push(hranol(S(0), o.zLow, o.zTop));
          let telo = sjednot(casti);
          odeb.push(hranol(S(-kr.tl), kr.hlava, o.zTop + 1));
          const zs = kr.hlava + o.koren, vys = o.zTop + 1 - zs, [ex, ey] = pul(kr);
          const uhly = kr.profil === 'kruh'
            ? Array.from({ length: kr.lamel }, (_, i) => 360 * (i + 0.5) / kr.lamel)
            : [Math.atan2(ey, ex), Math.atan2(ey, -ex), Math.atan2(-ey, -ex), Math.atan2(-ey, ex)].map(a => a / RAD);
          const delka = Math.hypot(ex, ey) + 2;
          for (const u of uhly) odeb.push(k(k(k(M.cube([delka, kr.sterbina, vys])).translate([0, -kr.sterbina / 2, zs])).rotate([0, 0, u])));
          telo = odecti(telo, odeb);
          kusy.push(jedenKus(telo, null, p.nazev || 'Krytka'));
        } else {
          const I = ofs => T(p.vule + ofs), zTop = o.vyska;
          if (zk > 0.01) casti.push(komoly(I(kr.stena - zk), 0, I(kr.stena), zk));
          casti.push(hranol(I(kr.stena), zk > 0.01 ? zk - 0.01 : 0, zTop));
          let telo = sjednot(casti);
          const nab = Math.min(0.6, kr.stena * 0.4, kr.hloubka * 0.3);
          odeb = [hranol(I(0), kr.hlava, zTop + 1), komoly(I(0), zTop - nab, I(nab), zTop + 0.001), hranol(I(nab), zTop, zTop + 1)];
          telo = odecti(telo, odeb);
          kusy.push(jedenKus(telo, null, p.nazev || 'Krytka'));
        }
        const zt = kr.hlava;
        duchy.push(sit(odecti(hranol(T(0), zt, zt + kr.hloubka + 25), [hranol(T(-kr.s), zt - 1, zt + kr.hloubka + 26)]), 'Trubka', '#9aa4ae', 'duch'));
      }

      if (p.typ === 'podlozka') {
        const q = p.podlozka;
        const F = q.tvar === 'kruh' ? kruh(q.d / 2) : obdelnik(q.a, q.b, q.r);
        const zarezy = (pocet, vys) => {
          const out = [];
          for (let i = 0; i < pocet; i++) {
            let x, y;
            if (q.tvar === 'kruh') { const a = (-90 + (i - (pocet - 1) / 2) * 12) * RAD; x = q.d / 2 * Math.cos(a); y = q.d / 2 * Math.sin(a); }
            else { x = (i - (pocet - 1) / 2) * 4; y = -q.b / 2; }
            out.push(k(valec(1, -1, vys + 1).translate([x, y, 0])));
          }
          return out;
        };
        const s = q.rezim === 'sada' ? o.tloustky : [null];
        s.forEach((tl, i) => {
          let telo;
          if (tl === null) {
            const tg = Math.tan(q.sklon * RAD), nl = Math.hypot(tg, 1);
            telo = k(hranol(F, 0, o.hMax + 1).trimByPlane([tg / nl, 0, -1 / nl], -(q.hMin + o.Lx / 2 * tg) / nl));
          } else telo = hranol(F, 0, tl);
          const odeb = [];
          let vlozka = null;
          if (o.protiskluz) { const [kap, vl] = kapsaAVlozka(telo, 0, true); odeb.push(kap); vlozka = vl; }
          if (tl !== null && q.zarezy) odeb.push(...zarezy(Math.min(10, i + 1), tl));
          telo = odecti(telo, odeb);
          const nazev = tl === null ? (p.nazev || 'Klín') : `Podložka ${fmt(tl, 2)} mm`;
          kusy.push(jedenKus(telo, vlozka, nazev));
        });
      }

      // sada na podložce: N stejných kusů (u sady podložek N různých)
      const seznam = [];
      if (kusy.length > 1) kusy.forEach(d => seznam.push(...d));
      else for (let i = 0; i < p.kusu; i++) seznam.push(...kusy[0].map(d => Object.assign({}, d, { nazev: p.kusu > 1 ? `${d.nazev} ${i + 1}` : d.nazev })));
      const hlavni = seznam.filter(d => d.druh === 'hlavni'), vlozky = seznam.filter(d => d.druh === 'vlozka');
      const dily = rozloz([...hlavni, ...vlozky], p.mezera);
      return { kus: kusy[0], kusy, dily, duchy };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /* ---------- rozmístění na podložce ---------- */
  function obal(poz) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) { const v = poz[i + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; }
    return b;
  }
  function posun(d, dx, dy, dz) {
    const poz = new Float32Array(d.poz.length);
    for (let i = 0; i < poz.length; i += 3) { poz[i] = d.poz[i] + dx; poz[i + 1] = d.poz[i + 1] + dy; poz[i + 2] = d.poz[i + 2] + dz; }
    return Object.assign({}, d, { poz });
  }
  /** Řady (police) přibližně do čtverce; každý díl na z = 0, sada vystředěná kolem počátku. */
  function rozloz(dily, mezera) {
    const bb = dily.map(d => obal(d.poz));
    const plocha = bb.reduce((s, b) => s + (b[3] - b[0] + mezera) * (b[4] - b[1] + mezera), 0);
    const sirMax = Math.max(Math.sqrt(plocha) * 1.15, ...bb.map(b => b[3] - b[0]));
    const out = [];
    let x = 0, y = 0, radek = 0, maxX = 0;
    dily.forEach((d, i) => {
      const b = bb[i], sx = b[3] - b[0], sy = b[4] - b[1];
      if (x > 0 && x + sx > sirMax + 1e-6) { x = 0; y += radek + mezera; radek = 0; }
      out.push(posun(d, x - b[0], y - b[1], -b[2]));
      x += sx + mezera; radek = Math.max(radek, sy); maxX = Math.max(maxX, x - mezera);
    });
    const cx = maxX / 2, cy = (y + radek) / 2;
    return out.map(d => posun(d, -cx, -cy, 0));
  }

  /* ---------- odhad hmotnosti a času ---------- */
  /** Objem s výplní: obal = plocha × 1,2 mm (3 perimetry), uvnitř výplň. Vložky z TPU se 100 %. */
  function odhad(p, dily) {
    let g = 0, gTpu = 0, s = 0, V = 0;
    const mat = MATERIALY[p.material], tpu = MATERIALY.TPU;
    for (const d of dily) {
      const vl = d.druh === 'vlozka', m = vl ? tpu : mat;
      const obalV = Math.min(d.objem, d.plocha * 1.2 * 0.9);
      const Veff = vl ? d.objem : obalV + (d.objem - obalV) * p.tisk.vypln / 100;
      const hm = Veff / 1000 * m.hustota;
      if (vl) gTpu += hm; else g += hm;
      const b = obal(d.poz);
      s += Veff / m.prutok + (b[5] - b[2]) / 0.2 * 1.5;
      V += d.objem;
    }
    // filament 1,75 mm
    const filament = (g / mat.hustota + gTpu / tpu.hustota) * 1000 / (Math.PI * 0.875 * 0.875) / 1000;
    return { objem: V, hmotnost: g, hmotnostTpu: gTpu, filament, cas: s + 120 };
  }

  /* ---------- předvolby ---------- */
  const PREDVOLBY = [
    { nazev: 'Nožička Ø 40 × 18 na šroub', popis: 'válec se sražením, zapuštěná hlava šroubu 4 mm, PETG',
      p: { typ: 'nozicka', nazev: 'Nožička 40', material: 'PETG', kusu: 4, nozicka: { tvar: 'valec', d: 40, vyska: 18, srazeni: 1, upevneni: 'sroub', otvor: 4.5, hlava: 9, uhel: 90, zapusteni: 1 } } },
    { nazev: 'Kuželová nožička na čep', popis: 'Ø 45 → 32 × 30, čep Ø 8 do vyvrtané díry',
      p: { typ: 'nozicka', nazev: 'Kuželová nožička', material: 'PETG', kusu: 4, vule: 0.15, nozicka: { tvar: 'kuzel', d: 45, d2: 32, vyska: 30, srazeni: 1.2, upevneni: 'cep', cepD: 8, cepL: 12 } } },
    { nazev: 'Kopule pod přístroj (lepení)', popis: 'Ø 24 × 8, ploška 10 mm – pod tiskárnu, zesilovač, pračku',
      p: { typ: 'nozicka', nazev: 'Kopule', material: 'PETG', kusu: 4, nozicka: { tvar: 'kopule', d: 24, vyska: 8, ploska: 10, upevneni: 'lepeni' } } },
    { nazev: 'Nožička s vložkou TPU', popis: 'Ø 35 × 15 na šroub, protiskluzová vložka z TPU',
      p: { typ: 'nozicka', nazev: 'Nožička s vložkou', material: 'PETG', kusu: 4, nozicka: { tvar: 'valec', d: 35, vyska: 15, srazeni: 0.8, upevneni: 'sroub', otvor: 4, hlava: 8, zapusteni: 0.5 },
        protiskluz: { pouzit: true, hloubka: 1.2, okraj: 2, vycnivani: 0.8, vule: 0.15 } } },
    { nazev: 'Pantofle – kulatá noha židle Ø 22', popis: 'trubková židle, PETG + vložka TPU',
      p: { typ: 'pantofle', nazev: 'Pantofle Ø 22', material: 'PETG', kusu: 4, vule: 0.2, pantofle: { profil: 'kruh', d: 22, stena: 2.4, hloubka: 15, dno: 3.5, sklon: 0 },
        protiskluz: { pouzit: true, hloubka: 1.2, okraj: 2, vycnivani: 0.8, vule: 0.15 } } },
    { nazev: 'Pantofle – šikmá noha 40 × 40, 8°', popis: 'čtvercová noha skloněná o 8°, konec vodorovně, dno rovnoběžné s podlahou',
      p: { typ: 'pantofle', nazev: 'Pantofle šikmá', material: 'PETG', kusu: 4, vule: 0.25, pantofle: { profil: 'ctverec', a: 40, r: 3, stena: 2.4, hloubka: 14, dno: 3, sklon: 8, konec: 'vodorovny' } } },
    { nazev: 'Pantofle – stůl 50 × 25 z TPU', popis: 'obdélníková noha, celá z TPU, nalisování',
      p: { typ: 'pantofle', nazev: 'Pantofle stůl', material: 'TPU', kusu: 4, vule: -0.1, pantofle: { profil: 'obdelnik', a: 50, b: 25, r: 2, stena: 2, hloubka: 12, dno: 2.5, sklon: 0 } } },
    { nazev: 'Krytka do trubky Ø 25 × 1,5', popis: 'vnitřní, 6 pružných lamel se zubem, PETG',
      p: { typ: 'krytka', nazev: 'Krytka Ø 25', material: 'PETG', kusu: 4, vule: 0.2, krytka: { druh: 'vnitrni', profil: 'kruh', d: 25, s: 1.5, hlava: 3, presahHlavy: 0.5, zkoseni: 0.6, hloubka: 14, lamel: 6, sterbina: 1.5, tl: 1.2, presah: 0.4 } } },
    { nazev: 'Záslepka jeklu 30 × 30 × 2', popis: 'vnitřní, štěrbiny v rozích, PETG',
      p: { typ: 'krytka', nazev: 'Záslepka 30×30', material: 'PETG', kusu: 4, vule: 0.2, krytka: { druh: 'vnitrni', profil: 'ctverec', a: 30, r: 2.5, s: 2, hlava: 3, presahHlavy: 0, zkoseni: 0.6, hloubka: 15, sterbina: 1.5, tl: 1.4, presah: 0.4 } } },
    { nazev: 'Vnější krytka jeklu 40 × 20', popis: 'návlek přes konec profilu, nalisování',
      p: { typ: 'krytka', nazev: 'Krytka 40×20', material: 'PETG', kusu: 4, vule: 0.05, krytka: { druh: 'vnejsi', profil: 'obdelnik', a: 40, b: 20, r: 2, s: 2, hlava: 2.5, zkoseni: 0.8, hloubka: 12, stena: 2 } } },
    { nazev: 'Klín pod nohu 3°', popis: 'Ø 40, nejtenčí 2 mm, s vložkou TPU proti sklouznutí',
      p: { typ: 'podlozka', nazev: 'Klín 3°', material: 'PETG', kusu: 2, podlozka: { rezim: 'klin', tvar: 'kruh', d: 40, hMin: 2, sklon: 3 },
        protiskluz: { pouzit: true, hloubka: 0.8, okraj: 2.5, vycnivani: 0.6, vule: 0.15 } } },
    { nazev: 'Sada podložek 0,5–4 mm', popis: '8 čtvercových podložek po 0,5 mm se zářezy podle tloušťky',
      p: { typ: 'podlozka', nazev: 'Sada podložek', material: 'PETG', kusu: 8, podlozka: { rezim: 'sada', tvar: 'obdelnik', a: 40, b: 40, r: 4, tOd: 0.5, krok: 0.5, zarezy: true } } },
  ];
  function vychoziProjekt(i) {
    const pv = PREDVOLBY[i];
    return normalizuj(pv ? pv.p : {}).p;
  }

  /* ---------- projekt JSON ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_nozicky', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || o.format !== 'webapp_nozicky') throw new Error('Soubor není projekt Nožiček (chybí "format": "webapp_nozicky").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }

  const API = {
    VERZE_FORMATU, MATERIALY, TYPY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    kopie, vezmi, poloz, cislo, fmt, normalizuj, odvozene, kontroly, postav, rozloz, obal, odhad,
    profilNozicky, previsProfilu, vychoziProjekt, ulozProjekt, nactiProjekt, kruh, obdelnik, obrys,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.NOZ = API;
})();
