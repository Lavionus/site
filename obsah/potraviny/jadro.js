/* ============================================================
   potraviny/jadro.js – čistá logika Deníku jídla (bez DOM).
   Živiny, výpočty množství, hledání, EAN, cíle (BMR, EFSA),
   deník (stav, souhrny, statistiky), recepty, import/export.
   V prohlížeči window.DENIK_JADRO, v node module.exports
   (testy _test/potraviny_test.js).
   ============================================================ */
(function (koren) {
  'use strict';

  const FORMAT = 'denik-jidla';
  const VERZE_FORMATU = 1;

  /* ---------- živiny ---------- */
  // k: klíč, n: název, j: jednotka, d: desetinná místa, s: skupina
  const ZIVINY = [
    { k: 'kcal', n: 'Energie', j: 'kcal', d: 0, s: 'zaklad' },
    { k: 'tuk', n: 'Tuky', j: 'g', d: 1, s: 'zaklad' },
    { k: 'nasycene', n: 'z toho nasycené MK', j: 'g', d: 1, s: 'zaklad', pod: true },
    { k: 'sacharidy', n: 'Sacharidy', j: 'g', d: 1, s: 'zaklad' },
    { k: 'cukry', n: 'z toho cukry', j: 'g', d: 1, s: 'zaklad', pod: true },
    { k: 'vlaknina', n: 'Vláknina', j: 'g', d: 1, s: 'zaklad' },
    { k: 'bilkoviny', n: 'Bílkoviny', j: 'g', d: 1, s: 'zaklad' },
    { k: 'sul', n: 'Sůl', j: 'g', d: 2, s: 'zaklad' },
    { k: 'mufa', n: 'Mononenasycené MK', j: 'g', d: 1, s: 'tuky' },
    { k: 'pufa', n: 'Polynenasycené MK', j: 'g', d: 1, s: 'tuky' },
    { k: 'trans', n: 'Trans MK', j: 'g', d: 2, s: 'tuky' },
    { k: 'chol', n: 'Cholesterol', j: 'mg', d: 0, s: 'tuky' },
    { k: 'voda', n: 'Voda v potravinách', j: 'g', d: 0, s: 'ostatni' },
    { k: 'alk', n: 'Alkohol', j: 'g', d: 1, s: 'ostatni' },
    { k: 'kof', n: 'Kofein', j: 'mg', d: 0, s: 'ostatni' },
    { k: 'ca', n: 'Vápník', j: 'mg', d: 0, s: 'mineraly' },
    { k: 'fe', n: 'Železo', j: 'mg', d: 1, s: 'mineraly' },
    { k: 'mg', n: 'Hořčík', j: 'mg', d: 0, s: 'mineraly' },
    { k: 'p', n: 'Fosfor', j: 'mg', d: 0, s: 'mineraly' },
    { k: 'k', n: 'Draslík', j: 'mg', d: 0, s: 'mineraly' },
    { k: 'zn', n: 'Zinek', j: 'mg', d: 1, s: 'mineraly' },
    { k: 'cu', n: 'Měď', j: 'mg', d: 2, s: 'mineraly' },
    { k: 'mn', n: 'Mangan', j: 'mg', d: 2, s: 'mineraly' },
    { k: 'se', n: 'Selen', j: 'µg', d: 0, s: 'mineraly' },
    { k: 'jod', n: 'Jód', j: 'µg', d: 0, s: 'mineraly' },
    { k: 'vitA', n: 'Vitamin A', j: 'µg', d: 0, s: 'vitaminy' },
    { k: 'vitC', n: 'Vitamin C', j: 'mg', d: 0, s: 'vitaminy' },
    { k: 'vitD', n: 'Vitamin D', j: 'µg', d: 1, s: 'vitaminy' },
    { k: 'vitE', n: 'Vitamin E', j: 'mg', d: 1, s: 'vitaminy' },
    { k: 'vitK', n: 'Vitamin K', j: 'µg', d: 0, s: 'vitaminy' },
    { k: 'b1', n: 'Thiamin (B1)', j: 'mg', d: 2, s: 'vitaminy' },
    { k: 'b2', n: 'Riboflavin (B2)', j: 'mg', d: 2, s: 'vitaminy' },
    { k: 'b3', n: 'Niacin (B3)', j: 'mg', d: 1, s: 'vitaminy' },
    { k: 'b5', n: 'Kys. pantothenová (B5)', j: 'mg', d: 1, s: 'vitaminy' },
    { k: 'b6', n: 'Vitamin B6', j: 'mg', d: 2, s: 'vitaminy' },
    { k: 'b9', n: 'Folát (B9)', j: 'µg', d: 0, s: 'vitaminy' },
    { k: 'b12', n: 'Vitamin B12', j: 'µg', d: 1, s: 'vitaminy' },
  ];
  const ZIV = Object.fromEntries(ZIVINY.map(z => [z.k, z]));
  const ZAKLAD = ZIVINY.filter(z => z.s === 'zaklad').map(z => z.k);
  const MIKRO = ZIVINY.filter(z => z.s !== 'zaklad').map(z => z.k);

  const SKUPINY = {
    ovoce: 'Ovoce', zelenina: 'Zelenina', obiloviny: 'Obiloviny a přílohy', pecivo: 'Pečivo',
    'pečivo': 'Pečivo', mlecne: 'Mléčné výrobky', 'mléčné': 'Mléčné výrobky', vejce: 'Vejce',
    maso: 'Maso a masné výrobky', uzeniny: 'Uzeniny', ryby: 'Ryby a mořské plody',
    lusteniny: 'Luštěniny a tofu', orechy: 'Ořechy a semínka', tuky: 'Tuky a oleje',
    sladke: 'Sladkosti a pochutiny', slane: 'Slané pochutiny', omacky: 'Omáčky a dochucovadla',
    koreni: 'Koření a dochucovadla', napoje: 'Nápoje', alkohol: 'Alkoholické nápoje',
    hotova: 'Hotová jídla', doplnky: 'Doplňky stravy a sportovní výživa', detske: 'Dětská výživa',
    ostatni: 'Ostatní', recept: 'Recepty', vlastni: 'Vlastní potraviny',
  };

  const JIDLA_VYCHOZI = [
    { id: 'snidane', nazev: 'Snídaně' },
    { id: 'svacina1', nazev: 'Dopolední svačina' },
    { id: 'obed', nazev: 'Oběd' },
    { id: 'svacina2', nazev: 'Odpolední svačina' },
    { id: 'vecere', nazev: 'Večeře' },
    { id: 'druha', nazev: 'Druhá večeře' },
  ];

  /* ---------- pomocné ---------- */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function cislo(x) {
    if (x === null || x === undefined || x === '') return null;
    const v = typeof x === 'number' ? x : parseFloat(String(x).replace(',', '.').replace(/\s/g, ''));
    return Number.isFinite(v) ? v : null;
  }
  function zaokrouhli(v, d) {
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    const m = Math.pow(10, d || 0);
    return Math.round(v * m) / m;
  }
  function formatCislo(v, d) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '–';
    let r = zaokrouhli(v, d);
    if (Object.is(r, -0)) r = 0;
    return r.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: d || 0 });
  }
  // tvar podle počtu: tvar(1,'den','dny','dní') → 'den', 3 → 'dny', 5 → 'dní', 1,5 → 'dne'
  function tvar(n, jeden, dva, pet, zlomek) {
    const x = Math.abs(n);
    if (x !== Math.floor(x)) return zlomek || dva;
    if (x === 1) return jeden;
    if (x >= 2 && x <= 4) return dva;
    return pet;
  }
  function pocet(n, jeden, dva, pet) { return formatCislo(n, 0) + ' ' + tvar(n, jeden, dva, pet); }
  function noveId(predpona) {
    return (predpona || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function hash(s) { // krátký stabilní otisk (FNV-1a)
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36);
  }

  /* ---------- datum (místní čas, bez posunu přes UTC) ---------- */
  function datumKlic(d) {
    const x = d instanceof Date ? d : new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  function zKlice(k) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null;
  }
  function posunDen(k, o) {
    const d = zKlice(k); d.setDate(d.getDate() + o); return datumKlic(d);
  }
  function rozdilDni(a, b) { return Math.round((zKlice(b) - zKlice(a)) / 864e5); }
  const DNY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  const MESICE = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  function popisDne(k, dnes) {
    const d = zKlice(k);
    const r = rozdilDni(dnes, k);
    const zakl = d.getDate() + '. ' + MESICE[d.getMonth()] + (d.getFullYear() !== zKlice(dnes).getFullYear() ? ' ' + d.getFullYear() : '');
    if (r === 0) return 'Dnes, ' + zakl;
    if (r === -1) return 'Včera, ' + zakl;
    if (r === 1) return 'Zítra, ' + zakl;
    return DNY[d.getDay()][0].toUpperCase() + DNY[d.getDay()].slice(1) + ' ' + zakl;
  }

  /* ---------- EAN ---------- */
  function eanKontrola(kod) {
    const s = String(kod || '').replace(/\D/g, '');
    if (![8, 12, 13, 14].includes(s.length)) return false;
    const c = s.split('').map(Number);
    const kontrolni = c.pop();
    let suma = 0;
    for (let i = c.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) suma += c[i] * w;
    return (10 - (suma % 10)) % 10 === kontrolni;
  }
  // varianty kódu pro hledání (UPC-A ↔ EAN-13 s nulou na začátku)
  function eanVarianty(kod) {
    const s = String(kod || '').replace(/\D/g, '');
    const v = [s];
    if (s.length === 12) v.push('0' + s);
    if (s.length === 13 && s[0] === '0') v.push(s.slice(1));
    if (s.length === 14 && s[0] === '0') v.push(s.slice(1));
    return v;
  }
  function eanZeme(kod) {
    const s = String(kod || '');
    if (s.length !== 13) return '';
    const p = +s.slice(0, 3);
    if (p === 859) return 'ČR';
    if (p === 858) return 'Slovensko';
    if (p >= 400 && p <= 440) return 'Německo';
    if (p === 590) return 'Polsko';
    if (p >= 900 && p <= 919) return 'Rakousko';
    if (p === 599) return 'Maďarsko';
    if (p >= 300 && p <= 379) return 'Francie';
    if (p >= 800 && p <= 839) return 'Itálie';
    if (p >= 870 && p <= 879) return 'Nizozemsko';
    if ((p >= 20 && p <= 29) || (p >= 40 && p <= 49) || (p >= 200 && p <= 299)) return 'vnitřní kód obchodu';
    if (p >= 0 && p <= 139) return 'USA/Kanada';
    return '';
  }

  /* ---------- potraviny: převod dat ---------- */
  // Jednotný tvar potraviny v aplikaci:
  // { id, typ: 'v'(výrobek)|'s'(surovina)|'m'(moje)|'r'(recept)|'o'(online OFF), nazev, znacka, ean,
  //   skupina, n: {kcal,…} na 100 g/ml, porce: [{n, g}], ml: bool, priznaky, nutriscore, nova,
  //   obrazek, skeny, mnozstvi, rok, zdroj }
  function vyrobekZRadku(r) {
    // ['ean','nazev','znacka','mnozstvi','kcal','tuk','nasycene','sacharidy','cukry','vlaknina',
    //  'bilkoviny','sul','porce_g','porce_text','baleni_g','nutriscore','nova','skupina','obrazek',
    //  'skeny','priznaky','rok','mikro']
    const n = {};
    const kl = ['kcal', 'tuk', 'nasycene', 'sacharidy', 'cukry', 'vlaknina', 'bilkoviny', 'sul'];
    for (let i = 0; i < 8; i++) if (r[4 + i] !== null && r[4 + i] !== undefined) n[kl[i]] = r[4 + i];
    if (r[22]) Object.assign(n, r[22]);
    const porce = [];
    if (r[12]) porce.push({ n: 'porce' + (r[13] && !/^\d+([.,]\d+)?\s*(g|ml)$/i.test(r[13]) ? ' (' + r[13] + ')' : ''), g: r[12] });
    if (r[14] && r[14] !== r[12]) porce.push({ n: 'celé balení', g: r[14] });
    return {
      id: 'v' + r[0], typ: 'v', ean: r[0], nazev: r[1], znacka: r[2] || '', mnozstvi: r[3] || '',
      n, porce, ml: !!(r[20] & 4), priznaky: r[20] || 0, nutriscore: r[15], nova: r[16],
      skupina: r[17] || 'ostatni', obrazek: r[18], skeny: r[19] || 0, rok: r[21],
    };
  }
  function surovinaZRadku(r) {
    // ['id','nazev','skupina','kcal','tuk','nasycene','sacharidy','cukry','vlaknina','bilkoviny','sul','porce','mikro','popis_usda']
    const n = {};
    const kl = ['kcal', 'tuk', 'nasycene', 'sacharidy', 'cukry', 'vlaknina', 'bilkoviny', 'sul'];
    for (let i = 0; i < 8; i++) if (r[3 + i] !== null && r[3 + i] !== undefined) n[kl[i]] = r[3 + i];
    if (r[12]) Object.assign(n, r[12]);
    // tekutiny se zadávají v ml (hustota se bere 1 g/ml – u mléka a nápojů rozdíl do 3 %)
    const ml = r[2] === 'napoje' || /^(Mléko|Podmáslí|Kefír)|nápoj|džus/i.test(r[1]);
    return {
      id: 's' + r[0], typ: 's', nazev: r[1], znacka: '', skupina: r[2],
      n, porce: (r[11] || []).map(p => ({ n: p[0], g: p[1] })), ml,
      priznaky: 0, popis: r[13], skeny: 0,
    };
  }
  // výrobek z odpovědi API Open Food Facts (product)
  function vyrobekZOff(p, ean) {
    if (!p) return null;
    const nm = p.nutriments || {};
    const g = k => { const v = cislo(nm[k + '_100g']); return v; };
    const nazevZ = (...k) => { for (const x of k) if (p[x] && String(p[x]).trim()) return String(p[x]).trim(); return ''; };
    const nazev = nazevZ('product_name_cs', 'product_name_sk', 'product_name', 'product_name_en', 'generic_name_cs', 'generic_name');
    if (!nazev) return null;
    const n = {};
    let kcal = g('energy-kcal');
    if (kcal === null && g('energy-kj') !== null) kcal = g('energy-kj') / 4.184;
    if (kcal === null && g('energy') !== null) kcal = g('energy') / 4.184;
    if (kcal !== null && kcal >= 0 && kcal <= 950) n.kcal = zaokrouhli(kcal, 0);
    const mapa = { tuk: 'fat', nasycene: 'saturated-fat', sacharidy: 'carbohydrates', cukry: 'sugars', vlaknina: 'fiber', bilkoviny: 'proteins', sul: 'salt' };
    for (const [k, o] of Object.entries(mapa)) { const v = g(o); if (v !== null && v >= 0 && v <= 100) n[k] = zaokrouhli(v, k === 'sul' ? 2 : 1); }
    if (n.sul === undefined && g('sodium') !== null) n.sul = zaokrouhli(g('sodium') * 2.5, 2);
    const mik = { ca: ['calcium', 1e3], fe: ['iron', 1e3], mg: ['magnesium', 1e3], k: ['potassium', 1e3], zn: ['zinc', 1e3], vitC: ['vitamin-c', 1e3], vitD: ['vitamin-d', 1e6], b12: ['vitamin-b12', 1e6], kof: ['caffeine', 1e3], chol: ['cholesterol', 1e3] };
    for (const [k, [o, m]] of Object.entries(mik)) { const v = g(o); if (v !== null && v > 0) n[k] = zaokrouhli(v * m, 3); }
    const sq = cislo(p.serving_quantity), pq = cislo(p.product_quantity);
    const porce = [];
    if (sq && sq > 0 && sq <= 2000) porce.push({ n: 'porce' + (p.serving_size ? ' (' + p.serving_size + ')' : ''), g: sq });
    if (pq && pq > 0 && pq <= 20000 && pq !== sq) porce.push({ n: 'celé balení', g: pq });
    const ml = /\d\s*(ml|l|cl|dl)\b/i.test(p.quantity || '') || /^(ml|l)$/i.test(p.product_quantity_unit || '');
    const kod = String(p.code || ean || '');
    return {
      id: 'v' + kod, typ: 'o', ean: kod, nazev: nazev.slice(0, 120), znacka: String(p.brands || '').split(',')[0].trim().slice(0, 40),
      mnozstvi: String(p.quantity || '').slice(0, 30), n, porce, ml, priznaky: n.kcal === undefined ? 2 : 0,
      nutriscore: /^[a-e]$/.test(p.nutriscore_grade || '') ? p.nutriscore_grade : null,
      nova: [1, 2, 3, 4].includes(p.nova_group) ? p.nova_group : null, skupina: 'ostatni', skeny: 0,
      slozeni: p.ingredients_text_cs || p.ingredients_text || null,
      alergeny: Array.isArray(p.allergens_tags) ? p.allergens_tags.filter(x => typeof x === 'string').slice(0, 30) : null,
      stopy: Array.isArray(p.traces_tags) ? p.traces_tags.filter(x => typeof x === 'string').slice(0, 30) : null,
      stazeno: datumKlic(new Date()), zdroj: 'Open Food Facts (online)',
    };
  }

  // URL obrázku výrobku na serveru Open Food Facts
  function obrazekUrl(ean, klic, velikost) {
    if (!ean || !klic) return null;
    let cesta = ean;
    if (ean.length > 8) {
      const p = ean.padStart(13, '0');
      cesta = p.slice(0, 3) + '/' + p.slice(3, 6) + '/' + p.slice(6, 9) + '/' + p.slice(9);
    }
    return 'https://images.openfoodfacts.org/images/products/' + cesta + '/' + klic + '.' + (velikost || 200) + '.jpg';
  }

  /* ---------- výpočty množství ---------- */
  function zivinyZa(food100, gramy) {
    const v = {};
    const f = (cislo(gramy) || 0) / 100;
    for (const k in food100) {
      const x = food100[k];
      if (typeof x === 'number' && Number.isFinite(x)) v[k] = x * f;
    }
    return v;
  }
  function secti(cil, pridej) {
    for (const k in pridej) if (Number.isFinite(pridej[k])) cil[k] = (cil[k] || 0) + pridej[k];
    return cil;
  }
  // kontrola souladu energie s makroživinami (Atwater); vrací null, pokud nelze posoudit
  function energieSedi(n) {
    if (!n || !Number.isFinite(n.kcal) || !['tuk', 'sacharidy', 'bilkoviny'].every(k => Number.isFinite(n[k]))) return null;
    const v = 9 * n.tuk + 4 * n.sacharidy + 4 * n.bilkoviny + 2 * (n.vlaknina || 0) + 7 * (n.alk || 0);
    return Math.abs(n.kcal - v) <= Math.max(30, 0.25 * n.kcal);
  }
  function energieZMaker(n) {
    if (!['tuk', 'sacharidy', 'bilkoviny'].every(k => Number.isFinite(n[k]))) return null;
    return 9 * n.tuk + 4 * n.sacharidy + 4 * n.bilkoviny + 2 * (n.vlaknina || 0) + 7 * (n.alk || 0);
  }
  // rozdělení energie mezi makroživiny v %
  function podilEnergie(n) {
    const t = 9 * (n.tuk || 0), s = 4 * (n.sacharidy || 0), b = 4 * (n.bilkoviny || 0), a = 7 * (n.alk || 0);
    const c = t + s + b + a;
    if (c <= 0) return { tuk: 0, sacharidy: 0, bilkoviny: 0, alk: 0 };
    return { tuk: 100 * t / c, sacharidy: 100 * s / c, bilkoviny: 100 * b / c, alk: 100 * a / c };
  }

  /* ---------- hledání ---------- */
  // Index: pole záznamů {f: potravina, t: normalizovaný text, nz: normalizovaný název}
  function vytvorIndex(potraviny) {
    return potraviny.map(f => ({ f, nz: norm(f.nazev), t: norm(f.nazev + ' ' + (f.znacka || '') + ' ' + (f.ean || '')) }));
  }
  function slova(t) { return t.split(/[^a-z0-9%]+/).filter(Boolean); }

  // společné body za typ, kvalitu dat, oblibu a délku názvu (přesné i tolerantní hledání)
  function bodyPotraviny(x, volby) {
    const f = x.f;
    let b = 0;
    if (f.typ === 's') b += 6;          // obecné suroviny – krátké, časté
    if (f.typ === 'm' || f.typ === 'r') b += 14;
    if (f.priznaky & 2) b -= 15;        // výrobek bez živin
    if (f.priznaky & 1) b -= 3;
    b += Math.min(12, Math.log2(1 + (f.skeny || 0)) * 2);
    b -= Math.min(6, x.nz.length / 20); // kratší název = obecnější shoda
    if (volby && volby.bonus && volby.bonus.has(f.id)) b += volby.bonus.get(f.id);
    return b;
  }
  // vrátí seřazené výsledky; volby: {limit, bonus: Map(id→číslo), filtr: f=>bool}
  function hledej(index, dotaz, volby) {
    volby = volby || {};
    const limit = volby.limit || 60;
    const q = norm(dotaz).trim();
    if (!q) return [];
    const cislice = q.replace(/\s/g, '');
    if (/^\d{6,14}$/.test(cislice)) {
      // přesné shody (vč. variant UPC/EAN) první, pak kódy začínající zadanými číslicemi
      const v = eanVarianty(cislice);
      const ok = x => x.f.ean && (!volby.filtr || volby.filtr(x.f));
      const presne = index.filter(x => ok(x) && v.includes(x.f.ean));
      const zacatek = index.filter(x => ok(x) && !v.includes(x.f.ean) && x.f.ean.startsWith(cislice));
      return presne.concat(zacatek).slice(0, limit).map(x => x.f);
    }
    const tokeny = slova(q);
    if (!tokeny.length) return [];
    // náhradní kmen pro skloňované tvary (chleba → chleb, jablka → jablk, rohliky → rohlik)
    const kmeny = tokeny.map(tk => {
      if (tk.length < 5) return null;
      const k = tk.replace(/(ami|ech|ach|ich|ove|ova|ovy|em|ou|um|ky|ka|ko|ce|a|e|i|o|u|y)$/, '');
      return k.length >= 4 && k !== tk ? k : null;
    });
    const vys = [];
    for (const x of index) {
      if (volby.filtr && !volby.filtr(x.f)) continue;
      let skore = 0, ok = true;
      for (let ti = 0; ti < tokeny.length; ti++) {
        const tk = tokeny[ti];
        // shoda v názvu má jasnou přednost před shodou jen ve značce (např. „rohlík“ × značka Rohlík.cz)
        const iN = x.nz.indexOf(tk);
        if (iN >= 0) {
          skore += (iN === 0 || /[^a-z0-9]/.test(x.nz[iN - 1])) ? 14 : 5;
          continue;
        }
        const i = x.t.indexOf(tk);
        if (i >= 0) { skore += (i === 0 || /[^a-z0-9]/.test(x.t[i - 1])) ? 4 : 1; continue; }
        const km = kmeny[ti];
        const iK = km ? x.nz.indexOf(km) : -1;
        if (iK >= 0 && (iK === 0 || /[^a-z0-9]/.test(x.nz[iK - 1]))) { skore += 9; continue; }
        ok = false; break;
      }
      if (!ok) continue;
      if (x.nz.startsWith(tokeny[0])) skore += 12;
      else if (kmeny[0] && x.nz.startsWith(kmeny[0])) skore += 9;
      if (x.nz === q) skore += 30;
      skore += bodyPotraviny(x, volby);
      vys.push({ f: x.f, skore });
    }
    vys.sort((a, b) => b.skore - a.skore || a.f.nazev.length - b.f.nazev.length);
    if (!vys.length && !volby.presne) return tolerantne(index, tokeny, volby, limit);
    return vys.slice(0, limit).map(v => v.f);
  }

  // Vzdálenost OSA (Damerau–Levenshtein bez opakovaných transpozic) s předčasným ukončením nad `max`.
  function vzdalenost(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let pred2 = null, pred = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const akt = [i];
      let minR = i;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(pred[j] + 1, akt[j - 1] + 1, pred[j - 1] + c);
        if (pred2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pred2[j - 2] + 1);
        akt.push(v);
        if (v < minR) minR = v;
      }
      if (minR > max) return max + 1;
      pred2 = pred; pred = akt;
    }
    return pred[b.length];
  }
  // Záložní hledání s tolerancí překlepů (jogrt, rohilk, banany→banán): každé slovo dotazu musí
  // odpovídat začátku některého slova názvu s nejvýš 1 chybou (2 u slov od 8 písmen).
  function tolerantne(index, tokeny, volby, limit) {
    const tk = tokeny.filter(x => x.length >= 3);
    if (!tk.length || tk.length !== tokeny.length) return [];
    const vys = [];
    for (const x of index) {
      if (volby.filtr && !volby.filtr(x.f)) continue;
      if (!x.sl) x.sl = slova(x.nz);
      let skore = 0, ok = true;
      for (const t of tk) {
        const max = t.length >= 8 ? 2 : 1;
        let nej = max + 1;
        for (const s of x.sl) {
          if (s.length < t.length - max) continue;
          // předfiltr: při 1–2 chybách se první písmeno shoduje nebo je přehozené/vypuštěné
          if (s[0] !== t[0] && s[0] !== t[1] && s[1] !== t[0]) continue;
          const d = Math.min(vzdalenost(t, s.slice(0, t.length), max), vzdalenost(t, s, max));
          if (d < nej) nej = d;
          if (!nej) break;
        }
        if (nej > max) { ok = false; break; }
        skore += 10 - nej * 4;
      }
      if (!ok) continue;
      skore += bodyPotraviny(x, volby);
      vys.push({ f: x.f, skore });
    }
    vys.sort((a, b) => b.skore - a.skore);
    const v = vys.slice(0, limit).map(x => x.f);
    v.tolerantni = true;
    return v;
  }

  /* ---------- profil a cíle ---------- */
  const AKTIVITA = [
    { pal: 1.2, n: 'Minimální (převážně vsedě či vleže)' },
    { pal: 1.4, n: 'Sedavé zaměstnání, málo pohybu' },
    { pal: 1.6, n: 'Mírně aktivní (chůze, lehký sport 1–3× týdně)' },
    { pal: 1.8, n: 'Aktivní (sport 3–5× týdně nebo fyzická práce)' },
    { pal: 2.0, n: 'Velmi aktivní (každodenní trénink, těžká práce)' },
  ];
  function vek(narozeni, k) {
    const n = zKlice(narozeni), d = zKlice(k || datumKlic(new Date()));
    if (!n || !d) return null;
    let v = d.getFullYear() - n.getFullYear();
    if (d.getMonth() < n.getMonth() || (d.getMonth() === n.getMonth() && d.getDate() < n.getDate())) v--;
    return v >= 0 && v <= 130 ? v : null; // datum v budoucnu nebo nesmysl = neznámý věk
  }
  // Mifflin-St Jeor (Am J Clin Nutr 1990;51:241–247)
  function bmr(profil, k) {
    const kg = cislo(profil.vaha), cm = cislo(profil.vyska), r = vek(profil.narozeni, k);
    if (!kg || !cm || r === null) return null;
    return 10 * kg + 6.25 * cm - 5 * r + (profil.pohlavi === 'z' ? -161 : 5);
  }
  function bmi(kg, cm) {
    kg = cislo(kg); cm = cislo(cm);
    if (!kg || !cm) return null;
    return kg / Math.pow(cm / 100, 2);
  }
  function bmiPopis(b) {
    if (b === null) return '';
    if (b < 18.5) return 'podváha';
    if (b < 25) return 'normální hmotnost';
    if (b < 30) return 'nadváha';
    if (b < 35) return 'obezita I. stupně';
    if (b < 40) return 'obezita II. stupně';
    return 'obezita III. stupně';
  }

  // Referenční hodnoty EFSA pro dospělé (DRV Finder, EFSA; re-use with acknowledgement).
  // [klíč, muži, ženy, typ (PRI/AI/…), horní limit z potravy (null = neuvádí se / jen doplňky)]
  const EFSA_DOSPELI = {
    vlaknina: { m: 25, z: 25, typ: 'AI' },
    ca: { m: 950, z: 950, typ: 'PRI', mlady: 1000, ul: 2500 },
    fe: { m: 11, z: 16, typ: 'PRI', zPo50: 11 },
    mg: { m: 350, z: 300, typ: 'AI' },
    p: { m: 550, z: 550, typ: 'AI' },
    k: { m: 3500, z: 3500, typ: 'AI' },
    zn: { m: 11.7, z: 9.3, typ: 'PRI', ul: 25 },
    cu: { m: 1.6, z: 1.3, typ: 'AI', ul: 5 },
    mn: { m: 3, z: 3, typ: 'AI' },
    se: { m: 70, z: 70, typ: 'AI', ul: 255 },
    jod: { m: 150, z: 150, typ: 'AI', ul: 600 },
    vitA: { m: 750, z: 650, typ: 'PRI', ul: 3000 },
    vitC: { m: 110, z: 95, typ: 'PRI' },
    vitD: { m: 15, z: 15, typ: 'AI', ul: 100 },
    vitE: { m: 13, z: 11, typ: 'AI', ul: 300 },
    vitK: { m: 70, z: 70, typ: 'AI' },
    b1: { naMJ: 0.1, typ: 'PRI' },
    b2: { m: 1.6, z: 1.6, typ: 'PRI' },
    b3: { naMJ: 1.6, typ: 'PRI' },
    b5: { m: 5, z: 5, typ: 'AI' },
    b6: { m: 1.7, z: 1.6, typ: 'PRI', ul: 12 },
    b9: { m: 330, z: 330, typ: 'PRI' },
    b12: { m: 4, z: 4, typ: 'AI' },
    voda: { m: 2500, z: 2000, typ: 'AI' }, // ml celkové vody za den (z nápojů i jídla)
  };

  // výchozí rozdělení makroživin (procenta energie) podle cíle
  function cile(profil, k) {
    profil = profil || {};
    const vys = { kcal: null, bmr: null, tdee: null, zivinyCil: {}, limity: {}, poznamky: [] };
    const zaklad = bmr(profil, k);
    const pal = cislo(profil.pal) || 1.4;
    if (zaklad) {
      vys.bmr = zaklad;
      vys.tdee = zaklad * pal;
    }
    let kcal = cislo(profil.kcalRucne);
    if (!kcal && vys.tdee) {
      const tydne = cislo(profil.tempo) || 0; // kg za týden, záporné = hubnutí
      kcal = vys.tdee + tydne * 7700 / 7;
      const minimum = profil.pohlavi === 'z' ? 1200 : 1500;
      if (kcal < minimum) { kcal = minimum; vys.poznamky.push('Cíl je omezen bezpečným minimem ' + minimum + ' kcal/den.'); }
      if (kcal < vys.bmr) vys.poznamky.push('Cíl je nižší než bazální metabolismus – zvaž pomalejší tempo.');
    }
    vys.kcal = kcal ? Math.round(kcal) : null;
    // skutečné tempo (kg/týden) podle cíle – po omezení minimem nebo při ručním cíli se liší od zvoleného
    if (vys.kcal && vys.tdee) vys.tempoSkutecne = (vys.kcal - vys.tdee) * 7 / 7700;
    if (vys.tempoSkutecne !== undefined && (cislo(profil.tempo) || 0) < 0 && vys.tempoSkutecne >= 0 && !cislo(profil.kcalRucne))
      vys.poznamky.push('Při tvém výdeji nejde s bezpečným minimem energie hubnout – pomůže víc pohybu.');
    const kg = cislo(profil.vaha);
    const roz = profil.makra || { bilkoviny: 20, tuk: 30, sacharidy: 50 };
    if (vys.kcal) {
      const pB = roz.bilkoviny || 20, pT = roz.tuk || 30, pS = Math.max(0, 100 - pB - pT);
      let bil = vys.kcal * pB / 100 / 4, tuk, sach;
      if (profil.bilkovinyNaKg && kg) {
        // bílkoviny pevně v g/kg; zbytek energie se rozdělí mezi tuky a sacharidy v poměru jejich procent
        bil = Math.min(cislo(profil.bilkovinyNaKg) * kg, vys.kcal * 0.6 / 4);
        const zbyva = Math.max(0, vys.kcal - bil * 4);
        tuk = zbyva * (pT / (pT + pS || 1)) / 9;
        sach = zbyva * (pS / (pT + pS || 1)) / 4;
        if (bil * 4 / vys.kcal > 0.35) vys.poznamky.push('Bílkoviny tvoří ' + Math.round(bil * 400 / vys.kcal) + ' % energie – to je hodně.');
      } else {
        tuk = vys.kcal * pT / 100 / 9;
        sach = Math.max(0, (vys.kcal - bil * 4 - tuk * 9) / 4);
      }
      vys.zivinyCil.bilkoviny = bil;
      vys.zivinyCil.tuk = tuk;
      vys.zivinyCil.sacharidy = sach;
      vys.makraProcenta = { bilkoviny: bil * 400 / vys.kcal, tuk: tuk * 900 / vys.kcal, sacharidy: sach * 400 / vys.kcal };
      vys.limity.nasycene = vys.kcal * 0.10 / 9;   // < 10 % energie (WHO, SPV)
      vys.limity.cukry = vys.kcal * 0.10 / 4;      // volné cukry < 10 % energie (WHO) – na etiketě jsou všechny cukry
    }
    if (kg) vys.minBilkoviny = 0.83 * kg; // EFSA PRI
    vys.limity.sul = 5; // g/den (WHO; EFSA: sodík 2 g ≈ sůl 5 g)
    // mikroživiny podle EFSA
    const r = vek(profil.narozeni, k);
    const z = profil.pohlavi === 'z';
    const mj = vys.kcal ? vys.kcal / 238.83 : (z ? 8.4 : 10.5);
    for (const [kl, h] of Object.entries(EFSA_DOSPELI)) {
      let v;
      if (h.naMJ) v = h.naMJ * mj;
      else v = z ? h.z : h.m;
      if (kl === 'ca' && r !== null && r < 25) v = h.mlady;
      if (kl === 'fe' && z && r !== null && r >= 50) v = h.zPo50;
      if (kl === 'voda') { vys.vodaMl = v; continue; }
      vys.zivinyCil[kl] = v;
      if (h.ul) vys.limity[kl + '_ul'] = h.ul;
    }
    if (r !== null && r < 18) vys.poznamky.push('Referenční hodnoty jsou pro dospělé (18+). U dětí a dospívajících se liší.');
    return vys;
  }

  /* ---------- stav deníku ---------- */
  function novyStav() {
    return {
      format: FORMAT, verze: VERZE_FORMATU,
      profil: { pohlavi: 'm', narozeni: '', vyska: '', vaha: '', pal: 1.4, tempo: 0, makra: { bilkoviny: 20, tuk: 30, sacharidy: 50 } },
      nastaveni: { jidla: JIDLA_VYCHOZI.map(j => ({ ...j })), online: true, obrazky: true, mikro: true, pohybKCili: true },
      dny: {},          // 'YYYY-MM-DD' → { z: [záznamy], voda: ml, pohyb: [{id,nazev,kcal}], pozn: '' }
      potraviny: {},    // snímky potravin použitých v deníku: klíč → potravina (n na 100 g)
      vlastni: {},      // id → vlastní potravina
      recepty: {},      // id → recept
      vahy: {},         // datum → kg
      oblibene: [],     // id potravin
      cache: {},        // výrobky stažené online: ean → potravina
      sablony: {},      // uložená jídla: id → {id, nazev, polozky: [{f (snímek), g, porce}]}
    };
  }
  // klíč snímku: id + otisk hodnot (změna údajů nepřepíše staré záznamy)
  function klicSnimku(f) {
    return f.id + '@' + hash(JSON.stringify([f.nazev, f.znacka || '', f.n, f.ml ? 1 : 0, (f.porce || []).map(p => [p.n, p.g])]));
  }
  function snimek(f) {
    const s = { id: f.id, typ: f.typ, nazev: f.nazev, n: { ...f.n } };
    if (f.znacka) s.znacka = f.znacka;
    if (f.ean) s.ean = f.ean;
    if (f.ml) s.ml = true;
    if (f.porce && f.porce.length) s.porce = f.porce.map(p => ({ n: p.n, g: p.g }));
    if (f.skupina) s.skupina = f.skupina;
    return s;
  }
  function den(stav, k) {
    if (!stav.dny[k]) stav.dny[k] = { z: [], voda: 0, pohyb: [] };
    const d = stav.dny[k];
    if (!Array.isArray(d.z)) d.z = [];
    if (!Array.isArray(d.pohyb)) d.pohyb = [];
    if (!Number.isFinite(d.voda)) d.voda = 0;
    return d;
  }
  function pridejZaznam(stav, k, jidlo, f, gramy, volby) {
    const g = cislo(gramy);
    if (!g || g <= 0 || g > 100000) throw new Error('Neplatné množství');
    const ks = klicSnimku(f);
    if (!stav.potraviny[ks]) stav.potraviny[ks] = snimek(f);
    const z = { id: noveId('z'), p: ks, j: jidlo, g: zaokrouhli(g, 1), t: Date.now() };
    if (volby && volby.porce) z.porce = volby.porce;
    den(stav, k).z.push(z);
    // nedávné: posledních 60 různých potravin
    return z;
  }
  function rychlyZaznam(stav, k, jidlo, nazev, n) {
    const f = { id: 'q' + hash(nazev + JSON.stringify(n)), typ: 'q', nazev: nazev || 'Rychlý záznam', n: {} };
    // rychlý záznam = hodnoty za celou porci; uloží se jako „100 g“ s hodnotami ×1
    for (const kl of ['kcal', 'tuk', 'sacharidy', 'bilkoviny']) { const v = cislo(n[kl]); if (v !== null && v >= 0) f.n[kl] = v; }
    if (!Number.isFinite(f.n.kcal)) {
      const e = energieZMaker({ tuk: f.n.tuk || 0, sacharidy: f.n.sacharidy || 0, bilkoviny: f.n.bilkoviny || 0 });
      if (e) f.n.kcal = Math.round(e);
    }
    if (!Number.isFinite(f.n.kcal)) throw new Error('Zadej energii nebo makroživiny');
    const z = pridejZaznam(stav, k, jidlo, f, 100);
    z.rychly = true;
    return z;
  }
  function najdiZaznam(stav, k, id) {
    const d = stav.dny[k];
    if (!d) return null;
    return d.z.find(z => z.id === id) || null;
  }
  function smazZaznam(stav, k, id) {
    const d = stav.dny[k];
    if (!d) return false;
    const i = d.z.findIndex(z => z.id === id);
    if (i < 0) return false;
    d.z.splice(i, 1);
    return true;
  }
  function presunZaznam(stav, k, id, cilDen, cilJidlo, kopie) {
    const z = najdiZaznam(stav, k, id);
    if (!z) return null;
    const novy = { ...z, id: noveId('z'), j: cilJidlo || z.j, t: Date.now() };
    den(stav, cilDen).z.push(novy);
    if (!kopie) smazZaznam(stav, k, id);
    return novy;
  }
  function kopirujJidlo(stav, zDne, jidlo, naDen, naJidlo) {
    const d = stav.dny[zDne];
    if (!d) return 0;
    const zaznamy = d.z.filter(z => z.j === jidlo);
    for (const z of zaznamy) den(stav, naDen).z.push({ ...z, id: noveId('z'), j: naJidlo || jidlo, t: Date.now() });
    return zaznamy.length;
  }

  function zivinyZaznamu(stav, z) {
    const f = stav.potraviny[z.p];
    if (!f) return {};
    return zivinyZa(f.n, z.g);
  }
  // souhrn dne: {celkem, jidla:{id:{…}}, pokryti:{kl: podíl energie se známou hodnotou}}
  function souhrnDne(stav, k) {
    const d = stav.dny[k];
    const vys = { celkem: {}, jidla: {}, pocet: 0, pohyb: 0, voda: 0, napoje: 0, pokryti: {} };
    if (!d) return vys;
    const energieZnama = {};
    let energie = 0;
    for (const z of d.z) {
      const v = zivinyZaznamu(stav, z);
      // nápoje (tekutiny bez většího obsahu alkoholu) se počítají do pitného režimu
      const f = stav.potraviny[z.p];
      if (f && f.ml && !z.rychly && ['napoje', 'mlecne', 'vlastni'].includes(f.skupina || 'vlastni') && (f.n.alk || 0) < 2 && (f.n.kcal || 0) < 120) vys.napoje += z.g;
      secti(vys.celkem, v);
      if (!vys.jidla[z.j]) vys.jidla[z.j] = {};
      secti(vys.jidla[z.j], v);
      vys.pocet++;
      const e = v.kcal || 0;
      energie += e;
      for (const kl of MIKRO) if (Number.isFinite(v[kl])) energieZnama[kl] = (energieZnama[kl] || 0) + e;
      for (const kl of ZAKLAD) if (Number.isFinite(v[kl])) energieZnama[kl] = (energieZnama[kl] || 0) + e;
    }
    for (const kl of ZIVINY.map(z => z.k)) vys.pokryti[kl] = energie > 0 ? (energieZnama[kl] || 0) / energie : 0;
    vys.pohyb = (d.pohyb || []).reduce((s, p) => s + (cislo(p.kcal) || 0), 0);
    vys.voda = d.voda || 0;
    return vys;
  }
  // statistika za období [od, do] (klíče dní, včetně)
  function statistika(stav, od, doK) {
    const dny = [];
    for (let k = od; k <= doK; k = posunDen(k, 1)) {
      const s = souhrnDne(stav, k);
      dny.push({ k, s, zapsano: s.pocet > 0 });
    }
    const zapsane = dny.filter(d => d.zapsano);
    const prumer = {};
    for (const d of zapsane) secti(prumer, d.s.celkem);
    for (const kl in prumer) prumer[kl] /= zapsane.length || 1;
    // nejvýznamnější potraviny podle energie
    const podle = new Map();
    for (let k = od; k <= doK; k = posunDen(k, 1)) {
      const dd = stav.dny[k];
      if (!dd) continue;
      for (const z of dd.z) {
        const f = stav.potraviny[z.p];
        if (!f) continue;
        const kl = f.nazev + (f.znacka ? ' · ' + f.znacka : '');
        const x = podle.get(kl) || { nazev: f.nazev, znacka: f.znacka || '', kcal: 0, pocet: 0, g: 0 };
        x.kcal += (f.n.kcal || 0) * z.g / 100; x.pocet++; x.g += z.g;
        podle.set(kl, x);
      }
    }
    const top = [...podle.values()].sort((a, b) => b.kcal - a.kcal).slice(0, 15);
    return { dny, zapsanych: zapsane.length, prumer, top };
  }
  // Odhad skutečného denního výdeje z příjmu a trendu hmotnosti za posledních `dni` dní:
  // výdej ≈ průměrný příjem − změna hmotnosti × 7 700 kcal/kg. Potřebuje dost zapsaných dní a vážení.
  function odhadVydeje(stav, doK, dni) {
    dni = dni || 28;
    const od = posunDen(doK, -(dni - 1));
    let soucet = 0, zapsano = 0;
    for (let k = od; k <= doK; k = posunDen(k, 1)) {
      const s = souhrnDne(stav, k);
      if (s.pocet && (s.celkem.kcal || 0) > 400) { soucet += s.celkem.kcal; zapsano++; }
    }
    const vahy = Object.entries(stav.vahy).filter(([k]) => k >= od && k <= doK).map(([k, v]) => [rozdilDni(od, k), v]).sort((a, b) => a[0] - b[0]);
    if (zapsano < 10 || vahy.length < 4) return { dostatek: false, zapsano, vazeni: vahy.length, potrebaDni: 10, potrebaVazeni: 4 };
    const rozpeti = vahy[vahy.length - 1][0] - vahy[0][0];
    if (rozpeti < 14) return { dostatek: false, zapsano, vazeni: vahy.length, potrebaDni: 10, potrebaVazeni: 4, rozpeti };
    // lineární regrese hmotnosti v čase (kg/den) – tlumí kolísání vody
    const n = vahy.length, sx = vahy.reduce((a, v) => a + v[0], 0), sy = vahy.reduce((a, v) => a + v[1], 0);
    const sxx = vahy.reduce((a, v) => a + v[0] * v[0], 0), sxy = vahy.reduce((a, v) => a + v[0] * v[1], 0);
    const sklon = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const prijem = soucet / zapsano;
    return { dostatek: true, vydej: prijem - sklon * 7700, prijem, zmenaTydne: sklon * 7, zapsano, vazeni: n, dni };
  }
  function kopirujDen(stav, zDne, naDen) {
    const d = stav.dny[zDne];
    if (!d) return 0;
    const zaznamy = d.z.slice();   // kopie – při kopii na týž den by se jinak procházelo rostoucí pole
    for (const z of zaznamy) den(stav, naDen).z.push({ ...z, id: noveId('z'), t: Date.now() });
    return zaznamy.length;
  }

  // „Odkud to mám?“ – potraviny seřazené podle množství zvolené živiny za období
  function zdrojeZiviny(stav, od, doK, kl, limit) {
    const podle = new Map();
    let celkem = 0, energie = 0, energieZnama = 0;
    for (let k = od; k <= doK; k = posunDen(k, 1)) {
      const d = stav.dny[k];
      if (!d) continue;
      for (const z of d.z) {
        const f = stav.potraviny[z.p];
        if (!f) continue;
        const e = (f.n.kcal || 0) * z.g / 100;
        energie += e;
        if (!Number.isFinite(f.n[kl])) continue;
        energieZnama += e;
        const v = f.n[kl] * z.g / 100;
        celkem += v;
        const klic = f.id + '|' + f.nazev;
        const x = podle.get(klic) || { nazev: f.nazev, znacka: f.znacka || '', hodnota: 0, pocet: 0 };
        x.hodnota += v; x.pocet++;
        podle.set(klic, x);
      }
    }
    const seznam = [...podle.values()].filter(x => x.hodnota > 0).sort((a, b) => b.hodnota - a.hodnota);
    return { celkem, seznam: seznam.slice(0, limit || 15), pocet: seznam.length, pokryti: energie > 0 ? energieZnama / energie : 1 };
  }
  // CSV s jedním řádkem za den (pro nutričního terapeuta / tabulkový procesor)
  function exportSouhrnyCsv(stav, od, doK) {
    const kl = ['kcal', 'tuk', 'nasycene', 'sacharidy', 'cukry', 'vlaknina', 'bilkoviny', 'sul'];
    const dny = [...new Set(Object.keys(stav.dny).concat(Object.keys(stav.vahy)))].filter(k => (!od || k >= od) && (!doK || k <= doK)).sort();
    const radky = [['datum', 'počet položek', ...kl.map(k => ZIV[k].n + ' (' + ZIV[k].j + ')'), 'voda vypitá (ml)', 'nápoje z deníku (ml)', 'pohyb (kcal)', 'hmotnost (kg)', 'poznámka'].join(';')];
    for (const k of dny) {
      const s = souhrnDne(stav, k);
      const d = stav.dny[k] || {};
      if (!s.pocet && !s.voda && !s.pohyb && !d.pozn && stav.vahy[k] === undefined) continue;
      radky.push([k, s.pocet, ...kl.map(x => Number.isFinite(s.celkem[x]) ? String(zaokrouhli(s.celkem[x], ZIV[x].d + 1)).replace('.', ',') : ''),
        s.voda || '', s.napoje || '', s.pohyb || '', stav.vahy[k] !== undefined ? String(stav.vahy[k]).replace('.', ',') : '', d.pozn || ''].map(csvPole).join(';'));
    }
    return '\ufeff' + radky.join('\r\n');
  }

  // po sobě jdoucí dny se záznamem končící dnem k (nebo předchozím, pokud dnes zatím nic)
  function serie(stav, k) {
    let n = 0, d = k;
    const ma = x => stav.dny[x] && stav.dny[x].z.length > 0;
    if (!ma(d)) d = posunDen(d, -1);
    while (ma(d)) { n++; d = posunDen(d, -1); if (n > 3660) break; }
    return n;
  }
  function nedavne(stav, limit) {
    // posledních N různých potravin podle času přidání
    const vse = [];
    for (const k in stav.dny) for (const z of stav.dny[k].z) if (!z.rychly) vse.push(z);
    vse.sort((a, b) => b.t - a.t);
    const vid = new Set(), vys = [];
    for (const z of vse) {
      const f = stav.potraviny[z.p];
      if (!f || vid.has(f.id)) continue;
      vid.add(f.id);
      vys.push({ f, g: z.g, porce: z.porce });
      if (vys.length >= (limit || 40)) break;
    }
    return vys;
  }
  function caste(stav, limit) {
    const pocet = new Map();
    for (const k in stav.dny) for (const z of stav.dny[k].z) {
      if (z.rychly) continue;
      const f = stav.potraviny[z.p];
      if (!f) continue;
      const x = pocet.get(f.id) || { f, n: 0, g: z.g };
      x.n++; x.g = z.g; x.f = f;
      pocet.set(f.id, x);
    }
    return [...pocet.values()].sort((a, b) => b.n - a.n).slice(0, limit || 40);
  }
  // nejčastější potraviny v daném jídle (snídaně → vločky, mléko…) za posledních `dni` dní;
  // vrací [{f (snímek), g, porce, n}] – g a porce z posledního použití
  function castePrJidlo(stav, jidlo, k, dni, limit) {
    const od = posunDen(k, -(dni || 60));
    const pocet = new Map();
    for (const den of Object.keys(stav.dny)) {
      if (den < od || den > k) continue;
      for (const z of stav.dny[den].z) {
        if (z.j !== jidlo || z.rychly) continue;
        const f = stav.potraviny[z.p];
        if (!f || !Number.isFinite(f.n.kcal)) continue;
        const x = pocet.get(f.id) || { f, n: 0, g: z.g, porce: z.porce, t: 0 };
        x.n++;
        if ((z.t || 0) >= x.t) { x.t = z.t || 0; x.g = z.g; x.porce = z.porce; x.f = f; }
        pocet.set(f.id, x);
      }
    }
    return [...pocet.values()].filter(x => x.n >= 2).sort((a, b) => b.n - a.n || b.t - a.t).slice(0, limit || 4);
  }
  // úklid snímků potravin, na které už žádný záznam neodkazuje
  function uklid(stav) {
    const pouzite = new Set();
    for (const k in stav.dny) {
      const d = stav.dny[k];
      for (const z of d.z) pouzite.add(z.p);
      if (!d.z.length && !d.voda && !(d.pohyb && d.pohyb.length) && !d.pozn) delete stav.dny[k];
    }
    let n = 0;
    for (const ks in stav.potraviny) if (!pouzite.has(ks)) { delete stav.potraviny[ks]; n++; }
    return n;
  }

  /* ---------- vlastní potraviny a recepty ---------- */
  /* ---------- uložená jídla (šablony) ---------- */
  function ulozSablonu(stav, nazev, zaznamy, id) {
    if (!nazev || !String(nazev).trim()) throw new Error('Chybí název');
    const polozky = (zaznamy || []).map(z => {
      const f = z.f || stav.potraviny[z.p];
      if (!f || !(cislo(z.g) > 0)) return null;
      const p = { f: snimek(f), g: cislo(z.g) };
      if (z.porce) p.porce = { n: String(z.porce.n), pocet: cislo(z.porce.pocet) };
      if (z.rychly) p.rychly = true;
      return p;
    }).filter(Boolean);
    if (!polozky.length) throw new Error('Jídlo je prázdné');
    const s = { id: id && stav.sablony[id] ? id : noveId('t'), nazev: String(nazev).trim().slice(0, 80), polozky, zmeneno: Date.now() };
    stav.sablony[s.id] = s;
    return s;
  }
  function pouzijSablonu(stav, id, k, jidlo, nasobek) {
    const s = stav.sablony[id];
    if (!s) return [];
    const m = cislo(nasobek) > 0 ? cislo(nasobek) : 1;
    return s.polozky.map(p => {
      const z = pridejZaznam(stav, k, jidlo, p.f, p.g * m, p.porce ? { porce: { n: p.porce.n, pocet: p.porce.pocet * m } } : null);
      if (p.rychly) z.rychly = true;
      return z;
    });
  }
  function souhrnSablony(s) {
    const c = {};
    for (const p of s.polozky) secti(c, zivinyZa(p.f.n, p.g));
    return c;
  }

  /* ---------- alergeny (příloha II nařízení 1169/2011) a vyhýbané složky ---------- */
  // k = klíč taxonomie Open Food Facts bez pomlček
  // s = kmeny (bez diakritiky, hledají se na začátku slova) – česky, anglicky, něco německy
  // d = kmeny s diakritikou (kde bez ní splývají jiná slova: sýr × syrový)
  // x = výjimky odstraněné z textu před hledáním (rybíz ≠ ryby, kakaové máslo ≠ mléko…)
  const ALERGENY = [
    { k: 'gluten', n: 'Lepek (pšenice, žito, ječmen, oves…)',
      s: ['lepek', 'lepku', 'lepkem', 'obilovin', 'psen', 'zitn', 'zito', 'zitk', 'jecm', 'oves', 'ovsen', 'spald', 'kamut', 'chleb', 'chlib', 'rohlik', 'peciv', 'testovin', 'mouk', 'kuskus', 'bulgur', 'kroup', 'krupic', 'strouhank', 'susenk', 'oplatk', 'pivo', 'piv ', 'bageta', 'zeml', 'croissant', 'knedl', 'pizza', 'vlock', 'palacink', 'livan', 'tortil', 'spaget', 'nudl', 'lasag', 'toast', 'piskot', 'pernik', 'krekr', 'seitan', 'wheat', 'barley', 'rye', 'oat', 'spelt', 'gluten', 'flour', 'weizen', 'gerste', 'roggen', 'hafer', 'dinkel', 'ble ', 'froment', 'farine de ble'],
      x: ['bezlepk\\w*( \\w+)?', 'bez lepku', 'gluten free', 'glutenfree', 'obilovin\\w* bez lepku',
        '(ryzov|kukuricn|pohankov|mandlov|kokosov|cizrnov|bramborov|tapiokov|kastanov|quinoov|amarantov|lnen|konopn|sojov|hrachov|cockov|fazolov|jahelnn?)\\w* (mouk|skrob|nud|vlock|testovin)\\w*',
        '(sklenen|konjak|kelp)\\w* nud\\w*', '(chickpea|potato|soy|soya|tapioca|rice|corn|maize|almond|coconut|buckwheat|pea|lentil|chestnut|quinoa|amaranth|millet|sorghum|cassava|banana) (flour|starch|noodles|flakes)', 'buckwheat'] },
    { k: 'crustaceans', n: 'Korýši', s: ['krevet', 'krab', 'humr', 'langust', 'raci', 'rak', 'garnat', 'shrimp', 'prawn', 'crab', 'lobster', 'krill'],
      x: ['krabic\\w*', 'rakytn\\w*', 'rakoczi\\w*', 'rakous\\w*', 'raketk\\w*'] },
    { k: 'eggs', n: 'Vejce', s: ['vejce', 'vajec', 'vaj', 'majonez', 'tatark', 'bilek', 'zloutek', 'omelet', 'egg', 'eier', 'eigelb', 'oeuf'], x: ['eggplant\\w*'] },
    { k: 'fish', n: 'Ryby', s: ['ryb', 'losos', 'tunak', 'tresk', 'kapr', 'pstruh', 'sled', 'makrel', 'sardin', 'sardel', 'ancov', 'pangas', 'candat', 'stik', 'tilapi', 'fish', 'salmon', 'tuna', 'anchov', 'herring', 'mackerel', 'sardine', 'fisch', 'poisson'],
      x: ['rybiz\\w*', 'rybyz\\w*'] },
    { k: 'peanuts', n: 'Arašídy (podzemnice olejná)', s: ['arasid', 'burak', 'podzemnic', 'peanut', 'erdnuss', 'arachide', 'cacahuete'] },
    { k: 'soybeans', n: 'Sója', s: ['soj', 'tofu', 'tempeh', 'edamame', 'soy', 'soja', 'miso'] },
    { k: 'milk', n: 'Mléko (vč. laktózy)',
      s: ['mlek', 'mlec', 'jogurt', 'maslo', 'masla', 'masle', 'smetan', 'tvaroh', 'kefir', 'podmasl', 'zakys', 'eidam', 'gouda', 'ementa', 'parmaz', 'mozzarel', 'ricott', 'cottage', 'niva', 'brie', 'camembert', 'feta', 'zmrzlin', 'hermel', 'tvaruz', 'mascarpon', 'gorgonzol', 'lakto', 'laktoz', 'kasein', 'syrovatk', 'milk', 'butter', 'cream', 'cheese', 'whey', 'lactose', 'casein', 'yogurt', 'yoghurt', 'milch', 'sahne', 'molke', 'quark', 'lait', 'beurre', 'fromage', 'creme fraiche'],
      d: ['sýr'],
      x: ['kakaov\\w* mas\\w*', 'arasidov\\w* mas\\w*', 'bambuck\\w* mas\\w*', 'shea\\w* mas\\w*', '(kokosov|mandlov|ovesn|sojov|ryzov|rostlinn|orechov|konopn)\\w* (mlek|mlec|napoj|smetan|jogurt|alternativ)\\w*', 'kyselin\\w* mlecn\\w*', 'mlecnan\\w*', 'cocoa butter', 'peanut butter', 'shea butter', '(coconut|almond|oat|soy|rice) (milk|cream|drink|yogurt)\\w*', 'ice cream',
        'maslovnik\\w*', 'maslov\\w* dyn\\w*', 'butternut\\w*'] },
    { k: 'nuts', n: 'Skořápkové plody (ořechy)', s: ['orech', 'mandl', 'kesu', 'pistac', 'lisk', 'makadam', 'pekan', 'nutella', 'almond', 'hazelnut', 'walnut', 'cashew', 'pistachio', 'pecan', 'macadamia', 'brazil nut', 'nuss', 'haselnuss', 'mandel', 'noisette', 'amande', 'noix'],
      x: ['muskatov\\w* orech\\w*', 'kokosov\\w* orech\\w*', 'podzemnic\\w* orech\\w*', 'arasidov\\w* orech\\w*', 'nutmeg', 'coconut', 'kokos\\w*', 'erdnuss\\w*'] },
    { k: 'celery', n: 'Celer', s: ['celer', 'celery', 'sellerie', 'celeri'] },
    { k: 'mustard', n: 'Hořčice', s: ['horcic', 'mustard', 'senf', 'moutarde'] },
    { k: 'sesameseeds', n: 'Sezam', s: ['sezam', 'tahini', 'sesam'] },
    { k: 'sulphurdioxideandsulphites', n: 'Oxid siřičitý a siřičitany', s: ['vino', 'vinn', 'susene merun', 'rozink', 'disirici', 'siricit', 'oxid siricit', 'e220', 'e221', 'e222', 'e223', 'e224', 'e226', 'e227', 'e228', 'sulphite', 'sulfite', 'sulphur dioxide', 'metabisulf', 'wine'],
      x: ['kyselin\\w* vinn\\w*', 'vinn\\w* kamen\\w*', 'vinan\\w*', 'tartaric\\w*', 'vinn\\w* kys\\w*'] },
    { k: 'lupin', n: 'Vlčí bob (lupina)', s: ['lupin', 'vlci bob', 'vlciho bob'], x: ['lupink\\w*', 'lupen\\w*'] },
    { k: 'molluscs', n: 'Měkkýši', s: ['musle', 'muslic', 'slavk', 'chobotnic', 'olihen', 'kalamar', 'slimak', 'ustric', 'sepie', 'mollus', 'mussel', 'squid', 'octopus', 'oyster', 'clam', 'scallop'],
      x: ['hliv\\w* ustricn\\w*', 'oyster mushroom\\w*', 'ustricn\\w* hub\\w*'] },
  ];
  const klicAlergenu = t => String(t || '').toLowerCase().replace(/^[a-z]{2}:/, '').replace(/[^a-z0-9]/g, '');
  // E-kódy jednotně bez mezer a pomlček (E 150d, E-150d → e150d)
  const normE = s => s.replace(/(^|[^a-z0-9])e\s*-?\s*(\d{3,4})\s*([a-z]?)(?![a-z0-9])/g, '$1e$2$3');
  // kmen na začátku slova („rak“ nesmí najít „bramborák“)
  const maKmen = (text, kmen) => { let i = text.indexOf(kmen); while (i >= 0) { if (i === 0 || /[^a-z0-9]/.test(text[i - 1])) return true; i = text.indexOf(kmen, i + 1); } return false; };
  const maKmenD = (text, kmen) => { let i = text.indexOf(kmen); while (i >= 0) { if (i === 0 || !/[\p{L}\p{N}]/u.test(text[i - 1])) return true; i = text.indexOf(kmen, i + 1); } return false; };
  const vyjimkyRe = new Map();
  function bezVyjimek(text, a) {
    if (!a.x) return text;
    if (!vyjimkyRe.has(a.k)) vyjimkyRe.set(a.k, new RegExp('(^|[^a-z0-9])(' + a.x.join('|') + ')', 'g'));
    return text.replace(vyjimkyRe.get(a.k), '$1 ');
  }
  function obsahujeAlergen(a, text, puvodni) {
    const t = bezVyjimek(text, a);
    return a.s.some(s => maKmen(t, s)) || !!(puvodni && a.d && a.d.some(s => maKmenD(puvodni, s)));
  }
  // začátek části o stopách / křížové kontaminaci
  const RE_STOPY = /(muze obsahovat|muzou obsahovat|moze obsahovat|moze zawierac|stopy|stopov\w* mnozstv|vyrobeno v (zavode|provozu|podniku)|vyrabeno v|zpracovava|may contain|traces|kann spuren|spuren von|kann .{0,80}enthalten|peut contenir|traces eventuelles|puo contenere|puede contener)/;
  // rozdělení textu složení na hlavní část a stopy po větách (vícejazyčné etikety mají stopy uprostřed)
  function rozdelStopy(cely, surovy) {
    let hlavni = '', stopy = '', hlavniPuv = '';
    const re = /[^.;!\n]+[.;!\n]*/g;   // věta = úsek do tečky, středníku, vykřičníku nebo konce řádku
    let m;
    while ((m = re.exec(cely))) {
      const veta = m[0];
      const i = veta.search(RE_STOPY);
      const puv = surovy.slice(m.index, m.index + veta.length);
      if (i < 0) { hlavni += veta + ' '; hlavniPuv += puv + ' '; }
      else { hlavni += veta.slice(0, i) + ' '; hlavniPuv += puv.slice(0, i) + ' '; stopy += veta.slice(i) + ' '; }
    }
    return { hlavni, stopy, hlavniPuv };
  }
  // synonyma vyhýbaných složek (začátek slova uživatele → další hledané tvary)
  const SYNONYMA = [
    [/^glutam/, ['glutam', 'e621', 'e622', 'e623', 'e624', 'e625']], [/^aspartam/, ['aspartam', 'e951']], [/^acesulfam/, ['acesulfam', 'e950']],
    [/^sukraloz/, ['sukraloz', 'sucralos', 'e955']], [/^sacharin/, ['sacharin', 'e954']], [/^karagenan/, ['karagenan', 'carrageen', 'e407']],
    [/^dusitan/, ['dusitan', 'e249', 'e250']], [/^palm/, ['palm']], [/^glukozo.?fruktoz/, ['glukozo fruktoz', 'glukozovo fruktoz', 'glucose fructose']],
    [/^fosfat/, ['fosfat', 'difosfat', 'trifosfat', 'polyfosfat', 'e338', 'e339', 'e340', 'e341', 'e450', 'e451', 'e452']],
  ];
  function tvaryVyhybani(s) { for (const [re, alt] of SYNONYMA) if (re.test(s)) return [s].concat(alt); return [s]; }
  // text převážně v cyrilici / řečtině – kmeny ho nepřečtou
  const ciziPismo = s => { const p = (s.match(/[\u0370-\u03ff\u0400-\u04ff]/g) || []).length; const l = (s.match(/[a-z\u00c0-\u024f]/gi) || []).length; return p > 20 && p > l; };
  // Výsledek: {obsahuje, stopy, slova, slovaStopy, odhad, zdroj: 'tagy'|'slozeni'|'nazev'|null}
  //   odhad = jen podle názvu; zdroj = odkud kontrola vychází (bez údajů o složení = 'nazev')
  function kontrolaAlergenu(f, slozeni, profil) {
    const hlidane = (profil && Array.isArray(profil.alergeny)) ? profil.alergeny : [];
    const slovaV = String((profil && profil.vyhybat) || '').split(/[,;\n]/).map(s => normE(norm(s).trim())).filter(s => s.length >= 3);
    const vys = { obsahuje: [], stopy: [], slova: [], slovaStopy: [], odhad: false, zdroj: null };
    if (!hlidane.length && !slovaV.length) return vys;
    const nazev = normE(norm((f && f.nazev) || ''));
    let surovy = slozeni && slozeni[0] ? String(slozeni[0]).toLowerCase() : '';
    if (surovy && ciziPismo(surovy)) { vys.ciziPismo = true; surovy = ''; }
    const nz = surovy ? norm(surovy) : '';
    // E-kódy sjednotit až po rozdělení na věty (normE mění délku, rozdělení potřebuje shodné indexy s původním textem)
    const roz = surovy && nz.length === surovy.length ? rozdelStopy(nz, surovy) : { hlavni: nz, stopy: '', hlavniPuv: surovy };
    const cely = normE(nz);
    const hlavni = normE(roz.hlavni), stopyText = normE(roz.stopy), hlavniPuv = roz.hlavniPuv;
    const tagy = slozeni && ((slozeni[2] && slozeni[2].length) || (slozeni[3] && slozeni[3].length));
    if (slozeni && (tagy || cely)) {
      vys.zdroj = tagy ? 'tagy' : 'slozeni';
      const al = new Set((slozeni[2] || []).map(klicAlergenu));
      const st = new Set((slozeni[3] || []).map(klicAlergenu));
      for (const k of hlidane) {
        const a = ALERGENY.find(x => x.k === k);
        if (!a) continue;
        if (al.has(k) || (hlavni && obsahujeAlergen(a, hlavni, hlavniPuv))) vys.obsahuje.push(k);
        else if (st.has(k) || (stopyText && obsahujeAlergen(a, stopyText))) vys.stopy.push(k);
      }
    } else if (f) {
      // bez údajů o složení (obecná / vlastní potravina, výrobek s chybějícím složením): odhad podle názvu
      vys.zdroj = 'nazev';
      const bezLepku = /(^|[^a-z])(bezlepk|bez lepku|gluten ?free)/.test(nazev);
      for (const k of hlidane) {
        const a = ALERGENY.find(x => x.k === k);
        if (k === 'gluten' && bezLepku) continue;
        if (a && obsahujeAlergen(a, nazev, String(f.nazev || '').toLowerCase())) { vys.obsahuje.push(k); vys.odhad = true; }
      }
    }
    for (const s of slovaV) {
      const tvary = tvaryVyhybani(s);
      if (tvary.some(x => maKmen(hlavni, x) || maKmen(nazev, x))) vys.slova.push(s);
      else if (tvary.some(x => maKmen(stopyText, x))) vys.slovaStopy.push(s);
    }
    return vys;
  }
  // sloučení výsledků více potravin (recept, uložené jídlo); zdroj = nejslabší z nich
  function slucAlergeny(vysledky) {
    const vys = { obsahuje: [], stopy: [], slova: [], slovaStopy: [], odhad: false, zdroj: null };
    const poradi = { tagy: 0, slozeni: 1, nazev: 2 };
    for (const v of vysledky) {
      if (!v) continue;
      for (const kl of ['obsahuje', 'stopy', 'slova', 'slovaStopy']) for (const x of v[kl]) if (!vys[kl].includes(x)) vys[kl].push(x);
      vys.odhad = vys.odhad || v.odhad;
      vys.nacita = vys.nacita || !!v.nacita;
      vys.chyba = vys.chyba || !!v.chyba;
      vys.ciziPismo = vys.ciziPismo || !!v.ciziPismo;
      if (v.zdroj && (vys.zdroj === null || poradi[v.zdroj] > poradi[vys.zdroj])) vys.zdroj = v.zdroj;
    }
    vys.stopy = vys.stopy.filter(k => !vys.obsahuje.includes(k));
    vys.slovaStopy = vys.slovaStopy.filter(s => !vys.slova.includes(s));
    return vys;
  }

  /* ---------- porovnání potravin (na 100 g) ---------- */
  function porovnej(potraviny) {
    const radky = [];
    for (const z of ZIVINY) {
      const hodnoty = potraviny.map(f => (f.n && Number.isFinite(f.n[z.k])) ? f.n[z.k] : null);
      const zname = hodnoty.filter(v => v !== null);
      if (!zname.length) continue;
      radky.push({ k: z.k, n: z.n, j: z.j, d: z.d, pod: !!z.pod, s: z.s, hodnoty, min: Math.min(...zname), max: Math.max(...zname) });
    }
    // bílkoviny na 100 kcal – užitečné srovnání „sytosti“
    radky.push({ k: 'bil100', n: 'Bílkoviny na 100 kcal', j: 'g', d: 1, s: 'odvozene',
      hodnoty: potraviny.map(f => f.n && f.n.kcal > 5 && Number.isFinite(f.n.bilkoviny) ? f.n.bilkoviny * 100 / f.n.kcal : null) });
    return radky;
  }

  function overPotravinu(f) {
    const chyby = [];
    if (!f.nazev || !String(f.nazev).trim()) chyby.push('Chybí název');
    const n = f.n || {};
    if (!Number.isFinite(n.kcal)) chyby.push('Chybí energie');
    for (const k of ['tuk', 'nasycene', 'sacharidy', 'cukry', 'vlaknina', 'bilkoviny', 'sul']) {
      if (n[k] !== undefined && (!Number.isFinite(n[k]) || n[k] < 0 || n[k] > 100)) chyby.push(ZIV[k].n + ': hodnota mimo 0–100 g');
    }
    if (Number.isFinite(n.kcal) && (n.kcal < 0 || n.kcal > 950)) chyby.push('Energie mimo rozsah 0–950 kcal/100 g');
    if (Number.isFinite(n.cukry) && Number.isFinite(n.sacharidy) && n.cukry > n.sacharidy + 0.05) chyby.push('Cukrů je víc než sacharidů');
    if (Number.isFinite(n.nasycene) && Number.isFinite(n.tuk) && n.nasycene > n.tuk + 0.05) chyby.push('Nasycených MK je víc než tuků');
    const s = ['tuk', 'sacharidy', 'bilkoviny', 'sul', 'vlaknina'].reduce((a, k) => a + (n[k] || 0), 0);
    if (s > 100.5) chyby.push('Součet živin přesahuje 100 g');
    if (f.ean && !eanKontrola(f.ean)) chyby.push('EAN nemá platnou kontrolní číslici');
    return chyby;
  }
  function ulozVlastni(stav, f) {
    const chyby = overPotravinu(f);
    if (chyby.length) throw new Error(chyby.join('\n'));
    const id = f.id && f.id.startsWith('m') ? f.id : noveId('m');
    const x = {
      id, typ: 'm', nazev: String(f.nazev).trim().slice(0, 120), znacka: String(f.znacka || '').trim().slice(0, 40),
      n: {}, porce: (f.porce || []).filter(p => p && p.n && cislo(p.g) > 0).map(p => ({ n: String(p.n).slice(0, 40), g: cislo(p.g) })),
      ml: !!f.ml, skupina: f.skupina || 'vlastni', zmeneno: Date.now(),
    };
    if (f.ean) x.ean = String(f.ean).replace(/\D/g, '');
    for (const k in f.n) if (ZIV[k] && Number.isFinite(f.n[k])) x.n[k] = f.n[k];
    if (f.puvod) x.puvod = f.puvod;
    stav.vlastni[id] = x;
    return x;
  }
  // recept: {nazev, porci, hmotnost (hotového jídla, g; prázdné = součet surovin), suroviny:[{f (snímek), g}]}
  function spocitejRecept(r) {
    const celkem = {};
    let syrova = 0;
    for (const s of r.suroviny || []) {
      const g = cislo(s.g) || 0;
      if (!s.f || g <= 0) continue;
      secti(celkem, zivinyZa(s.f.n, g));
      syrova += g;
    }
    const hotova = cislo(r.hmotnost) > 0 ? cislo(r.hmotnost) : syrova;
    const na100 = {};
    if (hotova > 0) for (const k in celkem) na100[k] = celkem[k] * 100 / hotova;
    // které živiny chybí u některé suroviny (součet je pak podhodnocen)
    const neuplne = [];
    for (const k of ZAKLAD) if ((r.suroviny || []).some(s => s.f && !Number.isFinite(s.f.n[k]))) neuplne.push(k);
    const porci = Math.max(1, Math.round(cislo(r.porci) || 1));
    return { celkem, na100, syrova, hotova, porci, porceG: hotova / porci, neuplne };
  }
  function ulozRecept(stav, r) {
    if (!r.nazev || !String(r.nazev).trim()) throw new Error('Chybí název receptu');
    if (!r.suroviny || !r.suroviny.length) throw new Error('Recept nemá žádné suroviny');
    const v = spocitejRecept(r);
    if (v.hotova <= 0) throw new Error('Recept nemá žádnou hmotnost');
    const id = r.id && r.id.startsWith('r') ? r.id : noveId('r');
    const x = {
      id, typ: 'r', nazev: String(r.nazev).trim().slice(0, 120), porci: v.porci,
      hmotnost: cislo(r.hmotnost) > 0 ? cislo(r.hmotnost) : null, postup: String(r.postup || '').slice(0, 5000),
      suroviny: r.suroviny.filter(s => s.f && cislo(s.g) > 0).map(s => ({ f: snimek(s.f), g: cislo(s.g) })),
      zmeneno: Date.now(),
    };
    stav.recepty[id] = x;
    return x;
  }
  // recept jako potravina (pro deník a hledání)
  function receptJakoPotravina(r) {
    const v = spocitejRecept(r);
    const n = {};
    for (const k in v.na100) n[k] = zaokrouhli(v.na100[k], 3);
    return {
      id: r.id, typ: 'r', nazev: r.nazev, znacka: 'recept', n, skupina: 'recept',
      porce: [{ n: 'porce (1/' + v.porci + ' receptu)', g: zaokrouhli(v.porceG, 1) }, { n: 'celý recept', g: zaokrouhli(v.hotova, 1) }],
      priznaky: 0,
    };
  }

  /* ---------- import / export ---------- */
  function exportJson(stav) {
    return JSON.stringify({ ...stav, format: FORMAT, verze: VERZE_FORMATU, exportovano: new Date().toISOString() }, null, 1);
  }
  // bezpečné kopírování mapy z cizích dat (bez __proto__ a podobných klíčů)
  const ZAKAZANE = new Set(['__proto__', 'constructor', 'prototype']);
  function mapa(x, overHodnotu) {
    const m = {};
    if (!x || typeof x !== 'object' || Array.isArray(x)) return m;
    for (const k of Object.keys(x)) {
      if (ZAKAZANE.has(k)) continue;
      const v = overHodnotu ? overHodnotu(x[k], k) : x[k];
      if (v !== undefined && v !== null) m[k] = v;
    }
    return m;
  }
  function overN(n) {
    const v = {};
    if (!n || typeof n !== 'object') return v;
    for (const k of Object.keys(n)) if (ZIV[k] && Number.isFinite(n[k]) && n[k] >= 0) v[k] = n[k];
    return v;
  }
  function overSnimek(f) {
    if (!f || typeof f !== 'object' || typeof f.nazev !== 'string' || !f.nazev) return null;
    const s = { ...f, nazev: f.nazev.slice(0, 160), n: overN(f.n) };
    if (s.porce !== undefined) s.porce = Array.isArray(s.porce) ? s.porce.filter(p => p && typeof p.n === 'string' && cislo(p.g) > 0).map(p => ({ n: p.n, g: cislo(p.g) })) : [];
    return s;
  }
  function overRecept(r) {
    if (!r || typeof r !== 'object' || typeof r.nazev !== 'string' || !r.nazev.trim() || !Array.isArray(r.suroviny)) return null;
    const suroviny = r.suroviny.map(s => s && overSnimek(s.f) && cislo(s.g) > 0 ? { f: overSnimek(s.f), g: cislo(s.g) } : null).filter(Boolean);
    if (!suroviny.length) return null;
    return { ...r, suroviny, porci: Math.max(1, Math.round(cislo(r.porci) || 1)) };
  }
  function normalizujStav(x) {
    const s = novyStav();
    if (!x || typeof x !== 'object') return s;
    if (x.profil && typeof x.profil === 'object') {
      const p = x.profil, c = (v, min, max) => { const n = cislo(v); return n !== null && n >= min && n <= max ? n : ''; };
      Object.assign(s.profil, {
        pohlavi: p.pohlavi === 'z' ? 'z' : 'm',
        narozeni: typeof p.narozeni === 'string' && zKlice(p.narozeni) ? p.narozeni : '',
        vyska: c(p.vyska, 100, 250), vaha: c(p.vaha, 25, 350), cilVaha: c(p.cilVaha, 25, 350),
        pal: c(p.pal, 1, 2.5) || 1.4, tempo: c(p.tempo, -1.5, 1) || 0,
        kcalRucne: c(p.kcalRucne, 800, 6000), bilkovinyNaKg: c(p.bilkovinyNaKg, 0.6, 3),
        alergeny: Array.isArray(p.alergeny) ? p.alergeny.filter(k => ALERGENY.some(a => a.k === k)) : [],
        vyhybat: typeof p.vyhybat === 'string' ? p.vyhybat.slice(0, 300) : '',
      });
      if (p.makra && typeof p.makra === 'object') {
        const b = c(p.makra.bilkoviny, 10, 40), tk = c(p.makra.tuk, 15, 60);
        if (b !== '' && tk !== '' && b + tk <= 90) s.profil.makra = { bilkoviny: b, tuk: tk, sacharidy: 100 - b - tk };
      }
    }
    if (x.nastaveni && typeof x.nastaveni === 'object') {
      Object.assign(s.nastaveni, mapa(x.nastaveni));
      const jj = Array.isArray(s.nastaveni.jidla) ? s.nastaveni.jidla.filter(j => j && typeof j.id === 'string' && typeof j.nazev === 'string' && j.nazev.trim())
        .map(j => ({ id: j.id, nazev: j.nazev.slice(0, 40), ...(j.skryto ? { skryto: true } : {}) })) : [];
      s.nastaveni.jidla = jj.length ? jj : JIDLA_VYCHOZI.map(j => ({ ...j }));
    }
    s.potraviny = mapa(x.potraviny, overSnimek);
    s.vlastni = mapa(x.vlastni, f => { const v = overSnimek(f); return v && Number.isFinite(v.n.kcal) ? v : null; });
    s.cache = mapa(x.cache, f => { const v = overSnimek(f); return v && v.ean ? v : null; });
    s.recepty = mapa(x.recepty, (r, k) => { const v = overRecept(r); return v ? { ...v, id: k } : null; });
    s.sablony = mapa(x.sablony, sb => {
      if (!sb || typeof sb.nazev !== 'string' || !sb.nazev.trim() || !Array.isArray(sb.polozky)) return null;
      const polozky = sb.polozky.map(p => p && overSnimek(p.f) && cislo(p.g) > 0
        ? { f: overSnimek(p.f), g: cislo(p.g), ...(p.porce && typeof p.porce.n === 'string' && cislo(p.porce.pocet) > 0 ? { porce: { n: p.porce.n, pocet: cislo(p.porce.pocet) } } : {}), ...(p.rychly ? { rychly: true } : {}) }
        : null).filter(Boolean);
      return polozky.length ? { ...sb, nazev: sb.nazev.slice(0, 80), polozky } : null;
    });
    for (const k of Object.keys(s.sablony)) s.sablony[k].id = k;   // id vždy podle klíče (ručně upravené zálohy)
    s.vahy = mapa(x.vahy, (v, k) => zKlice(k) && cislo(v) > 0 && cislo(v) < 400 ? cislo(v) : null);
    if (Array.isArray(x.oblibene)) s.oblibene = x.oblibene.filter(v => typeof v === 'string');
    if (x.dny && typeof x.dny === 'object') {
      for (const k of Object.keys(x.dny)) {
        const d = x.dny[k];
        if (!zKlice(k) || !d || typeof d !== 'object') continue;
        const dd = den(s, k);
        dd.z = (Array.isArray(d.z) ? d.z : []).filter(z => z && typeof z.p === 'string' && cislo(z.g) > 0 && Object.prototype.hasOwnProperty.call(s.potraviny, z.p))
          .map(z => ({ ...z, j: typeof z.j === 'string' ? z.j : 'snidane', g: cislo(z.g), id: typeof z.id === 'string' ? z.id : noveId('z'), t: cislo(z.t) || 0 }));
        dd.voda = Math.max(0, cislo(d.voda) || 0);
        // id pohybů bez id odvozené i z pořadí – dva shodné pohyby nesmí splynout
        dd.pohyb = Array.isArray(d.pohyb) ? d.pohyb.filter(p => p && cislo(p.kcal) !== null)
          .map((p, i) => ({ ...p, id: typeof p.id === 'string' ? p.id : 'p' + hash(k + '#' + i + (p.nazev || '') + p.kcal + (p.minuty || '')), kcal: cislo(p.kcal) })) : [];
        if (d.pozn) dd.pozn = String(d.pozn).slice(0, 2000);
      }
    }
    return s;
  }
  function importJson(text) {
    let x;
    try { x = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON'); }
    if (!x || x.format !== FORMAT) throw new Error('Soubor není záloha Deníku jídla');
    if (x.verze > VERZE_FORMATU) throw new Error('Záloha je z novější verze aplikace');
    return normalizujStav(x);
  }
  // sloučení: záznamy z importu se přidají ke dnům, které už existují (bez duplicit podle id)
  function slucStav(cil, zdroj) {
    let pridano = 0;
    Object.assign(cil.potraviny, zdroj.potraviny);
    for (const k in zdroj.vlastni) if (!cil.vlastni[k]) cil.vlastni[k] = zdroj.vlastni[k];
    for (const k in zdroj.recepty) if (!cil.recepty[k]) cil.recepty[k] = zdroj.recepty[k];
    for (const k in zdroj.cache) if (!cil.cache[k]) cil.cache[k] = zdroj.cache[k];
    for (const k in zdroj.sablony) if (!cil.sablony[k]) cil.sablony[k] = zdroj.sablony[k];
    for (const k in zdroj.vahy) if (cil.vahy[k] === undefined) cil.vahy[k] = zdroj.vahy[k];
    for (const id of zdroj.oblibene) if (!cil.oblibene.includes(id)) cil.oblibene.push(id);
    // jídla, která cíl nezná (vlastní jídla z jiného zařízení), se doplní
    for (const j of zdroj.nastaveni.jidla) if (!cil.nastaveni.jidla.some(x => x.id === j.id)) cil.nastaveni.jidla.push({ ...j });
    for (const [k, d] of Object.entries(zdroj.dny)) {
      const dd = den(cil, k);
      const ids = new Set(dd.z.map(z => z.id));
      for (const z of d.z) if (!ids.has(z.id)) { dd.z.push(z); pridano++; }
      if (!dd.voda && d.voda) dd.voda = d.voda;
      if (d.pohyb) for (const p of d.pohyb) if (!dd.pohyb.some(q => q.id === p.id)) dd.pohyb.push(p);
      if (d.pozn && d.pozn !== dd.pozn) dd.pozn = dd.pozn && !dd.pozn.includes(d.pozn) ? (dd.pozn + '\n' + d.pozn).slice(0, 2000) : d.pozn;
    }
    return pridano;
  }
  function csvPole(v) {
    let s = v === null || v === undefined ? '' : String(v);
    // ochrana proti vzorcům v tabulkovém procesoru (=, +, -, @ na začátku textu)
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCsv(stav, od, doK) {
    const jm = Object.fromEntries((stav.nastaveni.jidla || JIDLA_VYCHOZI).map(j => [j.id, j.nazev]));
    const kl = ['kcal', 'tuk', 'nasycene', 'sacharidy', 'cukry', 'vlaknina', 'bilkoviny', 'sul'];
    const radky = [['datum', 'jídlo', 'potravina', 'značka', 'EAN', 'množství (g)', ...kl.map(k => ZIV[k].n + ' (' + ZIV[k].j + ')')].join(';')];
    const dny = Object.keys(stav.dny).filter(k => (!od || k >= od) && (!doK || k <= doK)).sort();
    for (const k of dny) for (const z of stav.dny[k].z) {
      const f = stav.potraviny[z.p];
      if (!f) continue;
      const v = zivinyZa(f.n, z.g);
      radky.push([k, jm[z.j] || z.j, f.nazev, f.znacka || '', f.ean || '', z.rychly ? 'porce' : String(z.g).replace('.', ','),
        ...kl.map(x => Number.isFinite(v[x]) ? String(zaokrouhli(v[x], ZIV[x].d + 1)).replace('.', ',') : '')].map(csvPole).join(';'));
    }
    return '﻿' + radky.join('\r\n');
  }

  const API = {
    FORMAT, VERZE_FORMATU, ZIVINY, ZIV, ZAKLAD, MIKRO, SKUPINY, JIDLA_VYCHOZI, AKTIVITA, EFSA_DOSPELI,
    norm, cislo, zaokrouhli, formatCislo, noveId, hash, tvar, pocet,
    datumKlic, zKlice, posunDen, rozdilDni, popisDne,
    eanKontrola, eanVarianty, eanZeme,
    vyrobekZRadku, surovinaZRadku, vyrobekZOff, obrazekUrl,
    zivinyZa, secti, energieSedi, energieZMaker, podilEnergie,
    vytvorIndex, hledej,
    vek, bmr, bmi, bmiPopis, cile,
    novyStav, klicSnimku, snimek, den, pridejZaznam, rychlyZaznam, najdiZaznam, smazZaznam, presunZaznam,
    kopirujJidlo, kopirujDen, castePrJidlo, zivinyZaznamu, souhrnDne, statistika, odhadVydeje, serie, nedavne, caste, uklid,
    overPotravinu, ulozVlastni, spocitejRecept, ulozRecept, receptJakoPotravina,
    exportJson, importJson, normalizujStav, slucStav, exportCsv, exportSouhrnyCsv, zdrojeZiviny,
    ulozSablonu, pouzijSablonu, souhrnSablony, vzdalenost, kontrolaAlergenu, slucAlergeny, ALERGENY, porovnej,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.DENIK_JADRO = API;
})(typeof window !== 'undefined' ? window : this);
