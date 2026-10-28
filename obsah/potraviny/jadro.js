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
  const vlastniKlic = (o, k) => !!o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
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
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], 12);
    return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;   // 2026-02-31 není datum
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
    return doplnNapoj({
      id: 'v' + r[0], typ: 'v', ean: r[0], nazev: r[1], znacka: r[2] || '', mnozstvi: r[3] || '',
      n, porce, ml: !!(r[20] & 4), priznaky: r[20] || 0, nutriscore: r[15], nova: r[16],
      skupina: r[17] || 'ostatni', obrazek: r[18], skeny: r[19] || 0, rok: r[21],
    });
  }
  function surovinaZRadku(r) {
    // ['id','nazev','skupina','kcal','tuk','nasycene','sacharidy','cukry','vlaknina','bilkoviny','sul','porce','mikro','popis_usda']
    const n = {};
    const kl = ['kcal', 'tuk', 'nasycene', 'sacharidy', 'cukry', 'vlaknina', 'bilkoviny', 'sul'];
    for (let i = 0; i < 8; i++) if (r[3 + i] !== null && r[3 + i] !== undefined) n[kl[i]] = r[3 + i];
    if (r[12]) Object.assign(n, r[12]);
    // tekutiny se zadávají v ml; USDA udává hodnoty na 100 g → přepočet hustotou na 100 ml
    const ml = r[2] === 'napoje' || r[2] === 'alkohol' || !!r[15] || /^(Mléko|Podmáslí|Kefír)|nápoj|džus/i.test(r[1]);
    const f = {
      id: 's' + r[0], typ: 's', nazev: r[1], znacka: '', skupina: r[2],
      n, porce: (r[11] || []).map(p => ({ n: p[0], g: p[1] })), ml,
      priznaky: 0, popis: r[13], skeny: 0, zdroj: r[14] || 'USDA FoodData Central',
    };
    if (r[15] && DRUHY_NAPOJU[r[15]]) f.druh = r[15];
    if (ml) {
      const ro = HUSTOTA[druhNapoje(f)] || 1;
      if (ro !== 1) for (const k in n) n[k] = zaokrouhli(n[k] * ro, n[k] < 1 ? 3 : 2);
      // porce USDA jsou v gramech → na ml
      if (ro !== 1) f.porce = f.porce.map(p => ({ n: p.n, g: zaokrouhli(p.g / ro, 0) }));
    }
    return doplnNapoj(f);
  }
  /* ---------- nápoje ---------- */
  // druh nápoje určuje typické porce, pitný režim a sledování alkoholu
  const DRUHY_NAPOJU = {
    pivo: { n: 'Pivo, cider', porce: [['velké pivo (0,5 l)', 500], ['malé pivo (0,3 l)', 300], ['plechovka (0,33 l)', 330]] },
    vino: { n: 'Víno', porce: [['sklenka (0,2 l)', 200], ['deci (0,1 l)', 100], ['láhev (0,75 l)', 750]] },
    destilat: { n: 'Destilát, likér', porce: [['panák (4 cl)', 40], ['malý panák (2 cl)', 20]] },
    mleko: { n: 'Mléko, mléčný nápoj', porce: [['sklenice (250 ml)', 250], ['do kávy (30 ml)', 30], ['malá sklenice (150 ml)', 150]] },
    dzus: { n: 'Džus, smoothie', porce: [['sklenice (250 ml)', 250], ['malá sklenice (150 ml)', 150]] },
    kava: { n: 'Káva, čaj', porce: [['hrnek (250 ml)', 250], ['šálek (150 ml)', 150], ['espresso (40 ml)', 40]] },
    voda: { n: 'Voda', porce: [['sklenice (250 ml)', 250], ['láhev (0,5 l)', 500]] },
    napoj: { n: 'Nealko nápoj', porce: [['sklenice (250 ml)', 250], ['plechovka (0,33 l)', 330], ['láhev (0,5 l)', 500]] },
  };
  // hustota (g/ml) – jen pro přepočet surovin USDA (hodnoty na 100 g); výrobky mají údaje z etikety na 100 ml
  const HUSTOTA = { mleko: 1.03, dzus: 1.04, pivo: 1.01, vino: 0.99, destilat: 0.95 };
  const SK_NAPOJE = ['napoje', 'alkohol', 'mlecne', 'vlastni'];
  function druhNapoje(f) {
    if (!f || !f.ml) return '';
    if (f.druh && DRUHY_NAPOJU[f.druh]) return f.druh;
    const pr = f.priznaky || 0, alk = (f.n && f.n.alk) || 0;
    if (pr & 8) return 'pivo';
    if (pr & 16) return 'vino';
    if (pr & 32) return 'destilat';
    const t = norm(f.nazev || '');
    const napojova = (pr & 256) || SK_NAPOJE.includes(f.skupina || 'vlastni');
    if (!napojova && f.typ === 'v') return '';   // výrobek z databáze bez znaku nápoje (olej, omáčka, zmrzlina)
    if (/\b(pivo|piva|lezak|radler|cider|beer|bier|lager|pils\w*)\b/.test(t)) return 'pivo';
    if (napojova && /\b(vino|wine|prosecco|sekt|sampanske)\b/.test(t)) return 'vino';
    if (/\b(vodka|rum|gin|whisk(e)?y|slivovice|becherovka|liker|tequila|brandy|fernet|palenka|borovicka|destilat)\b/.test(t)) return 'destilat';
    if (f.skupina === 'alkohol' || alk >= 1) return alk > 15 ? 'destilat' : alk > 6 ? 'vino' : 'pivo';
    if (/\b(kava|caj|espresso|latte|cappuccino|coffee)\b/.test(t) && !/\b(ledov\w*|ice|iced)\b/.test(t)) return 'kava';
    if (/\b(mleko|mlecny|kefir\w*|podmasli|acidofil\w*|jogurtovy napoj|milk|drink)\b/.test(t) && (f.skupina === 'mlecne' || /mlek|kefir|podmasli|milk/.test(t))) return 'mleko';
    if (/\b(dzus|nektar|smoothie|most|juice|stava)\b/.test(t)) return 'dzus';
    if (/\b(voda|water|mattoni|magnesia|ondrasovka|podebradka|rajec|aquila|dobra voda|toma)\b/.test(t) && (f.n.kcal || 0) < 30) return 'voda';
    if (napojova) return f.skupina === 'mlecne' ? 'mleko' : 'napoj';
    return '';   // olej, omáčka, sirup bez skupiny… – tekutina, ale ne nápoj
  }
  // doplní druh a typické porce nápoje (bez duplicit s porcemi z etikety)
  function doplnNapoj(f) {
    const d = druhNapoje(f);
    if (!d) return f;
    f.druh = d;
    const porce = (f.porce || []).map(p => ({ ...p }));
    const blizko = (a, b) => Math.abs(a - b) <= b * 0.05;
    for (const [n, g] of DRUHY_NAPOJU[d].porce) {
      const shoda = porce.find(p => blizko(p.g, g));
      // „celé balení“ 0,5 l u piva je prostě velké pivo; jinak se typická porce přidá, jen když podobná chybí
      if (shoda && shoda.n === 'celé balení' && Math.abs(shoda.g - g) < 1) shoda.n = n;
      else if (!shoda) porce.push({ n, g });
    }
    f.porce = porce;
    return f;
  }
  // název výchozí porce nápoje v daném seznamu porcí (typická porce, nebo podobně velká z etikety)
  function vychoziPorceNapoje(f, porce) {
    const d = druhNapoje(f);
    if (!d) return null;
    const [n, g] = DRUHY_NAPOJU[d].porce[0];
    const sez = porce || f.porce || [];
    if (!sez.length || sez.some(p => p.n === n)) return n;
    const p = sez.find(x => Math.abs(x.g - g) <= g * 0.05);
    return p ? p.n : n;
  }
  // kolik z nápoje se počítá do pitného režimu (0 nebo 1); režim: 'prisny' | 'bezny' | 'vse'
  // běžně: všechny nápoje včetně piva a mléka; ne víno, destiláty a husté kalorické tekutiny (sirup, likér)
  function doPitnehoRezimu(f, nastaveni) {
    if (!f || !f.ml) return 0;
    const ns = nastaveni || {};
    const vyj = ns.pitnyVyjimky && ns.pitnyVyjimky[f.id];
    if (vyj === true) return 1;
    if (vyj === false) return 0;
    if (ns.napojeDoVody === false) return 0;
    const d = druhNapoje(f);
    if (!d) return 0;
    const kcal = f.n.kcal || 0, alk = f.n.alk || 0;
    const rezim = ns.pitnyRezim || 'bezny';
    if (rezim === 'vse') return 1;
    if (rezim === 'prisny') return kcal <= 20 && alk < 0.5 ? 1 : 0;
    // víno a destiláty ne (nealko víno ano); neznámý obsah alkoholu se u nich bere jako běžný
    const alkZnamy = Number.isFinite(f.n.alk) ? alk : (d === 'vino' || d === 'destilat' ? 10 : 0);
    if (alkZnamy > 7 || ((d === 'vino' || d === 'destilat') && alkZnamy >= 1.2)) return 0;
    return kcal <= 150 ? 1 : 0;
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
    const kat = Array.isArray(p.categories_tags) ? p.categories_tags : [];
    const napojKat = kat.some(x => /^en:(beverages|alcoholic-beverages|juices-and-nectars|waters|sodas|beers|wines|milks|dairy-drinks)$/.test(x));
    const ml = /\d\s*(ml|l|cl|dl)\b/i.test(p.quantity || '') || /^(ml|l|cl|dl)$/i.test(p.product_quantity_unit || '')
      || (napojKat && !/\d\s*(g|kg)\b/i.test(p.quantity || '') && !/^(g|kg)$/i.test(p.product_quantity_unit || ''));
    const alk = cislo(nm.alcohol_100g !== undefined ? nm.alcohol_100g : nm.alcohol);
    if (ml && alk !== null && alk >= 0 && alk <= 80) n.alk = zaokrouhli(alk * 0.789, 2);   // OFF: % obj.
    const kod = String(p.code || ean || '');
    let priz = n.kcal === undefined ? 2 : 0;
    if (kat.some(x => /^en:(beers|non-alcoholic-beers|lagers|ciders)$/.test(x))) priz |= 8;
    else if (kat.some(x => /^en:(wines|red-wines|white-wines|sparkling-wines)$/.test(x))) priz |= 16;
    else if (kat.some(x => /^en:(spirits|distilled-spirits|liqueurs|vodkas|rums|whiskies|gins)$/.test(x))) priz |= 32;
    if (ml) priz |= 4;
    return doplnNapoj({
      id: 'v' + kod, typ: 'o', ean: kod, nazev: nazev.slice(0, 120), znacka: String(p.brands || '').split(',')[0].trim().slice(0, 40),
      mnozstvi: String(p.quantity || '').slice(0, 30), n, porce, ml, priznaky: priz,
      nutriscore: /^[a-e]$/.test(p.nutriscore_grade || '') ? p.nutriscore_grade : null,
      nova: [1, 2, 3, 4].includes(p.nova_group) ? p.nova_group : null, skupina: 'ostatni', skeny: 0,
      slozeni: p.ingredients_text_cs || p.ingredients_text || null,
      alergeny: Array.isArray(p.allergens_tags) ? p.allergens_tags.filter(x => typeof x === 'string').slice(0, 30) : null,
      stopy: Array.isArray(p.traces_tags) ? p.traces_tags.filter(x => typeof x === 'string').slice(0, 30) : null,
      stazeno: datumKlic(new Date()), zdroj: 'Open Food Facts (online)',
      ...(napojKat && !kat.includes('en:alcoholic-beverages') ? { skupina: 'napoje' } : kat.includes('en:alcoholic-beverages') ? { skupina: 'alkohol' } : {}),
    });
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
  // syrové ↔ hotové: [syrová, hotová, metoda]. Poměr hmotnosti hotové/syrové se počítá z naměřeného složení
  // obou potravin v databázi: obiloviny a luštěniny podle sušiny (při vaření přibude jen voda),
  // maso a ryby podle bílkovin (při tepelné úpravě se neztrácejí). Zelenina a brambory chybí záměrně:
  // část sušiny se při vaření vyluhuje, poměr by ze složení vyšel nespolehlivě.
  const PREVODY_VAHY = [
    ['Rýže bílá (syrová)', 'Rýže bílá vařená', 'susina'], ['Rýže natural (syrová)', 'Rýže natural vařená', 'susina'],
    ['Těstoviny (suché)', 'Těstoviny vařené', 'susina'], ['Kuskus (suchý)', 'Kuskus vařený', 'susina'], ['Bulgur (suchý)', 'Bulgur vařený', 'susina'],
    ['Quinoa (suchá)', 'Quinoa vařená', 'susina'], ['Jáhly (syrové)', 'Jáhly vařené', 'susina'], ['Pohanka (suchá)', 'Pohanka vařená', 'susina'],
    ['Kroupy (syrové)', 'Kroupy vařené', 'susina'], ['Čočka (suchá)', 'Čočka vařená', 'susina'], ['Fazole červené (suché)', 'Fazole červené vařené', 'susina'],
    ['Fazole bílé (suché)', 'Fazole bílé vařené', 'susina'], ['Cizrna (suchá)', 'Cizrna vařená', 'susina'],
    ['Kuřecí prsa (syrová)', 'Kuřecí prsa pečená', 'bilkoviny'], ['Kuřecí stehna bez kůže (syrová)', 'Kuřecí stehna pečená (bez kůže)', 'bilkoviny'],
    ['Kuře s kůží (syrové)', 'Kuře s kůží pečené', 'bilkoviny'], ['Vepřová plec (syrová)', 'Vepřová plec pečená', 'bilkoviny'],
    ['Vepřová pečeně / kotleta libová (karé, syrová)', 'Vepřová kotleta libová dušená', 'bilkoviny'], ['Vepřová panenka (syrová)', 'Vepřová panenka pečená', 'bilkoviny'], ['Hovězí hrudí (syrové)', 'Hovězí hrudí dušené (libové)', 'bilkoviny'],
    ['Mleté hovězí 15 % tuku (syrové)', 'Hovězí karbanátek opečený (hamburgerový)', 'bilkoviny'],
    ['Kapr (syrový)', 'Kapr pečený', 'bilkoviny'], ['Losos (syrový)', 'Losos pečený', 'bilkoviny'], ['Treska (syrová)', 'Treska pečená', 'bilkoviny'],
    ['Pstruh duhový (syrový)', 'Pstruh pečený', 'bilkoviny'], ['Krevety (syrové)', 'Krevety vařené', 'bilkoviny'],
    ['Vepřová krkovice (syrová)', 'Vepřová krkovice dušená', 'bilkoviny'], ['Vepřová žebra (syrová)', 'Vepřová žebra pečená', 'bilkoviny'],
    ['Vepřová kýta (syrová)', 'Vepřová kýta pečená', 'bilkoviny'], ['Hovězí plec libová (syrová)', 'Hovězí plec dušená (libová)', 'bilkoviny'],
    ['Hovězí na guláš (plec, syrové)', 'Hovězí na guláš dušené (plec)', 'bilkoviny'], ['Jehněčí kýta libová (syrová)', 'Jehněčí kýta pečená (libová)', 'bilkoviny'],
    ['Kuřecí křídla s kůží (syrová)', 'Kuřecí křídla pečená (s kůží)', 'bilkoviny'],
    ['Hrách loupaný zelený (suchý)', 'Hrách loupaný vařený', 'susina'], ['Špalda (zrno, syrová)', 'Špalda vařená', 'susina'],
    ['Rýže parboiled (syrová)', 'Rýže parboiled vařená', 'susina'], ['Vaječné těstoviny (suché)', 'Vaječné těstoviny vařené', 'susina'],
    ['Kuřecí srdce (syrová)', 'Kuřecí srdce vařená', 'bilkoviny'],
    ['Kuřecí žaludky (syrové)', 'Kuřecí žaludky vařené', 'bilkoviny'], ['Vepřové ledvinky (syrové)', 'Vepřové ledvinky dušené', 'bilkoviny'],
    ['Vepřový mozeček (syrový)', 'Vepřový mozeček dušený', 'bilkoviny'], ['Mleté krůtí (syrové)', 'Mleté krůtí tepelně upravené', 'bilkoviny'],
    ['Sumeček americký (kanálový, syrový)', 'Sumeček americký (kanálový) pečený', 'bilkoviny'], ['Úhoř (syrový)', 'Úhoř pečený', 'bilkoviny'],
    ['Pangasius (syrový)', 'Pangasius tepelně upravený', 'bilkoviny'],
  ];
  let faktoryVahy = {};   // název → {stav, protejsek, faktor, metoda}; plní nastavPrevody() z databáze
  // spočítá poměry z naměřeného složení dvojic (potraviny = obecné potraviny z databáze)
  function nastavPrevody(potraviny) {
    const podle = new Map(potraviny.map(f => [f.nazev, f]));
    faktoryVahy = {};
    for (const [s, v, metoda] of PREVODY_VAHY) {
      const a = podle.get(s), b = podle.get(v);
      if (!a || !b) continue;
      let k = null;
      if (metoda === 'susina' && Number.isFinite(a.n.voda) && Number.isFinite(b.n.voda) && b.n.voda < 100) k = (100 - a.n.voda) / (100 - b.n.voda);
      if (metoda === 'bilkoviny' && a.n.bilkoviny > 0 && b.n.bilkoviny > 0) k = a.n.bilkoviny / b.n.bilkoviny;
      if (!(k > 0.3 && k < 6)) continue;
      k = zaokrouhli(k, 2);
      faktoryVahy[s] = { stav: 'syrove', protejsek: v, faktor: k, metoda };
      faktoryVahy[v] = { stav: 'hotove', protejsek: s, faktor: k, metoda };
    }
    return Object.keys(faktoryVahy).length / 2;
  }
  // pro potravinu z dvojice vrátí {stav: 'syrove'|'hotove', protejsek, faktor (hotové/syrové), metoda}
  function prevodVahy(f) {
    return (f && f.nazev && faktoryVahy[f.nazev]) || null;
  }
  // gramy potraviny f, když uživatel zvážil opačný stav (syrové místo hotového nebo naopak)
  function prepocetVahy(f, gramy, vazeno) {
    const p = prevodVahy(f);
    if (!p || !vazeno || vazeno === p.stav) return gramy;
    return p.stav === 'hotove' ? gramy * p.faktor : gramy / p.faktor;
  }
  // odhadnutá položka → naměřená obecná potravina téhož jídla (stejný název se páruje sám)
  const PAROVANI_ODHADU = {   // jen skutečně stejné jídlo / potravina
    'Tvaroh polotučný': 'Tvaroh polotučný (medián etiket)', 'Tvaroh nízkotučný': 'Tvaroh nízkotučný (medián etiket)',
    'Tvaroh tučný': 'Tvaroh tučný (kvark, 45 % tuku v sušině)', 'Hermelín': 'Hermelín (medián etiket)', 'Eidam 30 %': 'Eidam 30 % (medián etiket)',
    'Salám Vysočina': 'Salám Vysočina (medián etiket)', 'Lučina (smetanový tvarohový sýr)': 'Lučina (medián etiket)',
    'Mléko polotučné 1,5 %': 'Mléko polotučné (medián etiket)', 'Mléko plnotučné 3,5 %': 'Mléko plnotučné (medián etiket)',
    'Syrovátkový protein (prášek)': 'Syrovátkový protein (medián etiket)', 'Proteinová tyčinka': 'Proteinová tyčinka (medián etiket)',
    'Ovesná kaše na mléce': 'Ovesná kaše z vloček na polotučném mléce', 'Lasagne boloňské': 'Lasagne s masem',
    'Sushi maki s lososem': 'Sushi nebo maki s mořskými plody', 'Gyros v pitě': 'Gyros v pitě (sendvič)', 'Palačinky': 'Palačinka bez náplně (balená)',
    'Palačinky s marmeládou': 'Palačinka s marmeládou (domácí)',
    'Kuřecí řízek smažený': 'Kuřecí prsa smažená v obalu', 'Strouhanka': 'Strouhanka (suchá, bez koření)',
    'Pečená kachna (bez kůže)': 'Kachna pečená bez kůže',
  };
  // naměřená varianta pro odhadnutou položku (obecné potraviny = suroviny z databáze), jinak null
  function namerenaVarianta(f, suroviny) {
    if (!f || !f.odhad) return null;
    const cil = PAROVANI_ODHADU[f.nazev] || f.nazev;
    return (suroviny || []).find(s => s.nazev === cil && s.typ === 's' && Number.isFinite(s.n.kcal)) || null;
  }
  // synonyma obecných potravin (hledají se jako název): jak lidé píší × jak se potravina jmenuje
  const ALIASY = {
    'Volské oko': 'sázené vejce, smažené vejce, vejce na oko, vajíčko na oko',
    'Míchaná vejce': 'vaječina, míchaná vajíčka',
    'Vejce vařené natvrdo': 'vajíčko natvrdo, vařené vejce, vejce natvrdo',
    'Vejce celé': 'vejce, vajíčko, vajíčka, vejce syrové',
    'Jogurt bílý plnotučný': 'jogurt, bílý jogurt',
    'Houskový knedlík': 'knedlík, knedlíky, houskové knedlíky',
    'Bramborový knedlík': 'bramborové knedlíky',
    'Losos pečený': 'losos',
    'Svíčková na smetaně s knedlíkem': 'svíčková',
    'Hovězí guláš s knedlíkem': 'guláš',
    'Vepřový řízek smažený': 'řízek, smažený řízek',
    'Vepřo knedlo zelo': 'vepřo knedlo, vepřová s knedlíkem a zelím',
    'Bramborová kaše': 'kaše bramborová, šťouchané brambory',
    'Rýže bílá vařená': 'vařená rýže, rýže',
    'Těstoviny vařené': 'těstoviny, vařené těstoviny, špagety, makarony, nudle, kolínka, penne',
    'Brambory vařené (loupané)': 'vařené brambory, brambory',
    'Hranolky smažené': 'hranolky, hranolky z fritézy, french fries',
    'Hranolky (mražené, pečené v troubě)': 'hranolky z trouby',
    'Žemle (kaiserka)': 'kaiserka',
    'Chléb konzumní (kmínový)': 'chleba, chléb, konzumní chléb, kmínový chléb',
    'Rohlík tukový': 'rohlík, rohlíky',
    'Mléko polotučné (medián etiket)': 'mléko, polotučné mléko',
    'Tvaroh polotučný (medián etiket)': 'tvaroh, měkký tvaroh',
    'Eidam 30 % (medián etiket)': 'eidam, sýr, plátkový sýr',
    'Párky (vepřové a hovězí)': 'párky, vídeňské párky', 'Párek vepřový': 'párek',
    'Šunka (cca 11 % tuku)': 'šunka, šunka výběrová',
    'Ovesná kaše z vloček na polotučném mléce': 'ovesná kaše, kaše, porridge',
    'Batáty pečené (sladké brambory)': 'sladké brambory, batát',
    'Pizza sýrová (margherita)': 'pizza, pizza margherita',
    'Hamburger': 'burger',
    'Oříšková pomazánka s kakaem': 'nutella, nugeta',
    'Kobliha glazovaná (donut)': 'donut, kobliha',
    'Kuřecí prsa pečená': 'kuřecí maso, kuřecí plátek', 'Kuře s kůží pečené': 'kuře pečené, pečené kuře',
    'Hummus': 'humus, cizrnová pomazánka',
    'Gyros v pitě': 'gyros',
    'Kebab v tortille': 'kebab, wrap',
    'Smažený sýr': 'smažák',
    'Krabí tyčinky (surimi)': 'krabí tyčinky',
    'Espresso': 'káva espresso, presso',
    'Káva (černá, bez cukru)': 'káva, kafe, turek',
    'Kuřecí prsa smažená v obalu': 'kuřecí řízek', 'Telecí řízek v obalu opečený na pánvi (vídeňský)': 'vídeňský řízek, wiener schnitzel',
    'Hovězí na guláš (plec, syrové)': 'gulášové maso', 'Hovězí kýta libová (syrová)': 'hovězí zadní, zadní',
    'Sleď uzený': 'uzenáč', 'Hovězí dršťky vařené': 'dršťky', 'Obilná káva (kávovina) připravená s vodou': 'melta, caro, kávovina, cikorka',
    'Kapusta (syrová)': 'kapusta hlávková, savojská kapusta', 'Přepuštěné máslo (ghí)': 'přepuštěné máslo, ghee, přepuštěné', 'Strouhanka (suchá, bez koření)': 'strouhanka',
    'Vaječné těstoviny (suché)': 'vaječné nudle, nudle do polévky', 'Jarní cibulka': 'zelená cibulka, jarní cibulka, zelené cibulky, zelenou cibulku', 'Bazalka čerstvá': 'bazalka, čerstvá bazalka', 'Petržel kořenová (syrová)': 'petrželový kořen, kořenová petržel, petržel kořen',
    'Petrželová nať': 'petrželka, petržel nať', 'Chilli mleté (kajenský pepř)': 'mleté chilli, kajenský pepř', 'Chilli paprička čerstvá (červená)': 'chilli, chilli paprička, chilli papričky', 'Zázvor čerstvý (kořen)': 'čerstvý zázvor, zázvor',
    'Losos uzený (z chovu)': 'uzený losos', 'Pangasius (syrový)': 'pangas', 'Kuřecí srdce (syrová)': 'kuřecí srdíčka, kuřecí srdíčky, srdíčka, srdíčky',
    'Kondenzované mléko neslazené (plnotučné)': 'zahuštěné mléko', 'Bujón hovězí (kostka, suchý)': 'bujón, kostka bujónu, hovězí bujón', 'Bujón drůbeží (kostka, suchý)': 'kuřecí bujón, drůbeží bujón',
    'Topinambur': 'jeruzalémský artyčok', 'Jablečné pyré neslazené (přesnídávka)': 'jablečná přesnídávka, jablečné pyré', 'Gnocchi bramborové (syrové, balené)': 'gnocchi, bramborové noky',
    'Vepřový mozeček (syrový)': 'mozeček', 'Husí sádlo': 'sádlo husí',
  };
  // vařená zelenina (bez tuku a soli) se najde i jako dušená bez tuku – makroživiny prakticky stejné
  for (const n of ['Brokolice vařená', 'Květák vařený', 'Mrkev vařená', 'Špenát vařený', 'Zelí bílé vařené', 'Zelí červené vařené', 'Kapusta vařená',
    'Kedluben vařený', 'Pórek vařený', 'Cuketa vařená', 'Lilek vařený', 'Růžičková kapusta vařená', 'Celer bulvový vařený', 'Cibule vařená',
    'Pastinák vařený', 'Paprika červená vařená', 'Hrášek zelený vařený', 'Fazolky zelené vařené', 'Kadeřávek vařený', 'Chřest vařený (mražený)']) {
    ALIASY[n] = (ALIASY[n] ? ALIASY[n] + ', ' : '') + 'dušená bez tuku, dušené bez tuku, dušený bez tuku';
  }
  // nářeční a slovenské názvy (připojí se k synonymům výše)
  const ALIASY_NAREC = {
    'Brambory syrové': 'zemáky, erteple, brambory, zemiaky', 'Brambory vařené (loupané)': 'vařené zemáky, zemiaky varené',
    'Rajče': 'rajské, rajské jablíčko, rajčata, paradajka, paradajky', 'Okurka salátová': 'okurka, uhorka, šalátová uhorka',
    'Okurky kyselé': 'kyselé okurky, sterilované okurky, čalamáda, kyslé uhorky', 'Mrkev': 'mrkva', 'Cibule': 'cibuľa',
    'Česnek': 'cesnak', 'Paprika červená': 'paprika', 'Jablko': 'jabĺko, jablka', 'Hruška': 'hruška, hrušky',
    'Švestky': 'slivky, trnky, švestka', 'Meruňky': 'marhule, meruňka', 'Borůvky': 'čučoriedky, černice, borůvka',
    'Brusinky čerstvé': 'brusnice', 'Zelí bílé': 'zelí, biela kapusta', 'Kysané zelí': 'kyslá kapusta', 'Kukuřice sterilovaná (scezená)': 'kukurica',
    'Hrášek zelený': 'hrášek', 'Cuketa': 'cukina', 'Lilek': 'baklažán', 'Dýně': 'tekvica, tykev', 'Celer bulvový': 'zeler, celer',
    'Pórek': 'pór', 'Červená řepa': 'cvikla, řepa', 'Máslo': 'maslo', 'Cukr krystal': 'cukr, cukor', 'Smetana ke šlehání (cca 36 %)': 'šlehačka, smotana na šľahanie',
    'Zakysaná smetana': 'kyslá smotana', 'Rohlík tukový': 'rožok, rohlíček', 'Houska': 'žemle, žemľa, buchta (pečivo)',
    'Chléb konzumní (kmínový)': 'chlieb, šumava chléb', 'Vejce celé': 'vajce, vajíčka', 'Tvaroh polotučný (medián etiket)': 'tvaroh, tvarôh',
    'Těstoviny vařené': 'cestoviny', 'Hranolky smažené': 'hranolčeky', 'Kobliha s marmeládou': 'šiška, kobliha, koblížek',
    'Pomazánkové máslo': 'pomazánkové, pomazánka máslová', 'Kuřecí prsa (syrová)': 'kuracie prsia, kuřecí maso syrové',
    'Mleté vepřové (syrové)': 'mleté maso, mleté mäso', 'Káva (černá, bez cukru)': 'káva, kafe, kava', 'Rajčatový protlak': 'paradajkový pretlak, protlak',
    'Jahody': 'jahoda', 'Banán': 'banány', 'Pomeranč': 'pomaranč, pomeranče', 'Mandarinka': 'mandarínka, mandarinky', 'Citron': 'citrón',
    'Brokolice': 'brokolica', 'Květák': 'karfiol', 'Špenát': 'špenát', 'Fazole červené v konzervě': 'fazole, fazuľa',
    'Caffè latte': 'latte, latté, kafe latte', 'Svařené víno': 'svařák, svařáček, punč vinný', 'Syrovátkový protein (medián etiket)': 'protein, whey, proteinový prášek',
    'Sushi nebo maki s mořskými plody': 'sushi, maki', 'Lasagne s masem': 'lasagne, lasagna, lazaně', 'Vitamin D3 1000 IU (tableta)': 'vitamin d, déčko',
    'Beton (Becherovka s tonikem)': 'beton', 'Cuba libre': 'cuba, rum s colou', 'Vinný střik': 'střik, vinný střik',
    'Skyr (0,2 % tuku)': 'skyr', 'Tvaroh tučný (kvark, 45 % tuku v sušině)': 'tučný tvaroh, kvark', 'Tvaroh nízkotučný (medián etiket)': 'nízkotučný tvaroh, odtučněný tvaroh',
    'Hermelín (medián etiket)': 'hermelín', 'Šunka nejvyšší jakosti (medián etiket)': 'šunka nejvyšší jakosti', 'Bílý jogurt (medián etiket)': 'jogurt, bílý jogurt',
    'Sůl': 'soľ', 'Ocet': 'ocot', 'Olivový olej': 'olivový olej', 'Slunečnicový olej': 'olej, slnečnicový olej',
  };
  for (const k in ALIASY_NAREC) ALIASY[k] = ALIASY[k] ? ALIASY[k] + ', ' + ALIASY_NAREC[k] : ALIASY_NAREC[k];
  function vytvorIndex(potraviny) {
    return potraviny.map(f => {
      const al = f.aliasy || ALIASY[f.nazev];
      return { f, nz: norm(f.nazev), t: norm(f.nazev + ' ' + (f.znacka || '') + ' ' + (f.ean || '')), a: al ? norm(al) : '' };
    });
  }
  function slova(t) { return t.split(/[^a-z0-9%]+/).filter(Boolean); }

  // syrová surovina podle normalizovaného názvu („(karé, syrová)“, „Brambory syrové“; ne „Pizza sýrová (margherita)“)
  const SYROVE = /[(,] ?syrov|\bsyrov[aey]?$/;
  // společné body za typ, kvalitu dat, oblibu a délku názvu (přesné i tolerantní hledání)
  function bodyPotraviny(x, volby) {
    const f = x.f;
    let b = 0;
    if (f.typ === 's') b += SYROVE.test(x.nz) ? 9 : 6;   // obecné suroviny – krátké, časté; syrové před tepelně upravenými
    if (f.typ === 'm' || f.typ === 'r') b += 14;
    if (f.typ === 'd') b += f.odhad ? 1 : 4;   // doplňky správce; odhady až za naměřenými
    if (f.priznaky & 2) b -= 15;        // výrobek bez živin
    if (f.priznaky & 1) b -= 3;
    if (f.priznaky & 512) b -= 40;      // zjevně chybné hodnoty – až na konec (kód je pořád najde)
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
        let iN = x.nz.indexOf(tk);
        if (iN < 0 && x.a) { const iA = x.a.indexOf(tk); if (iA >= 0 && (iA === 0 || /[^a-z0-9]/.test(x.a[iA - 1]))) { skore += 14; continue; } }
        if (iN >= 0) {
          const zac = iN === 0 || /[^a-z0-9]/.test(x.nz[iN - 1]);
          skore += zac ? 14 : 5;
          // celé slovo („sýr“ v „Sýr eidam“) před začátkem delšího slova („syrovátkový“)
          if (zac && !/[a-z0-9]/.test(x.nz[iN + tk.length] || '')) skore += 4;
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
      // obecné potraviny (a vlastní, recepty, doplňky) mají u stejné shody přednost před výrobky:
      // „rýže“ má najít rýži, ne výrobek, který se jmenuje jen „Rýže“
      // odhady (vypočtené/odhadnuté doplňky) přednost nemají – mají se řadit za hodnoty z databází
      const obecna = x.f.typ === 's' || (x.f.typ === 'd' && !x.f.odhad) || x.f.typ === 'm' || x.f.typ === 'r';
      const alias = x.a && (x.a === q || x.a.split(/\s*,\s*/).includes(q));
      const odhad = x.f.typ === 'd' && x.f.odhad;   // odhad: za databázemi, ale před nesouvisejícími výrobky
      if (x.nz.startsWith(tokeny[0]) || alias) skore += obecna ? 18 : odhad ? 15 : 12;
      else if (kmeny[0] && x.nz.startsWith(kmeny[0])) skore += 9;
      if (x.nz === q || alias) skore += obecna ? 30 : odhad ? 20 : 12;
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
        let nej = max + 1, prvni = false;
        for (let si = 0; si < x.sl.length; si++) {
          const s = x.sl[si];
          if (s.length < t.length - max) continue;
          // předfiltr: při 1–2 chybách se první písmeno shoduje nebo je přehozené/vypuštěné
          if (s[0] !== t[0] && s[0] !== t[1] && s[1] !== t[0]) continue;
          const d = Math.min(vzdalenost(t, s.slice(0, t.length), max), vzdalenost(t, s, max));
          if (d < nej || (d === nej && si === 0)) { nej = d; prvni = si === 0; }
          if (!nej && prvni) break;
        }
        if (nej > max) { ok = false; break; }
        skore += 10 - nej * 4 + (prvni ? 4 : 0);   // překlep v prvním slově názvu = nejspíš hledaná věc
      }
      if (!ok) continue;
      // jako v přesném hledání: obecné potraviny před výrobky („jogrt“ → Jogurt bílý)
      if (x.f.typ === 's' || (x.f.typ === 'd' && !x.f.odhad) || x.f.typ === 'm' || x.f.typ === 'r') skore += 6;
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
    // přibližně podle FAO/WHO/UNU 2004: sedavý 1,40–1,69, aktivní 1,70–1,99, velmi aktivní 2,00–2,40
    { pal: 1.2, n: 'Velmi nízká (převážně vleže, nemoc, upoutání na lůžko)' },
    { pal: 1.4, n: 'Sedavý způsob života (kancelář, doprava autem, málo chůze)' },
    { pal: 1.6, n: 'Sedavý s pohybem (hodně chůze nebo práce vestoje, lehký sport)' },
    { pal: 1.8, n: 'Aktivní (fyzická práce nebo asi hodina sportu denně)' },
    { pal: 2.0, n: 'Velmi aktivní (těžká fyzická práce nebo každodenní náročný trénink)' },
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
    // těhotenství a kojení: navýšení energie podle EFSA (2013) – +70 / +260 / +500 kcal v 1.–3. trimestru, kojení +500 kcal
    const STAV = { t1: 70, t2: 260, t3: 500, koj: 500 };
    const zvlastni = profil.pohlavi === 'z' && STAV[profil.stav] !== undefined;
    if (vys.tdee && zvlastni) vys.tdee += STAV[profil.stav];
    const rVek = vek(profil.narozeni, k);
    const bmiTed = bmi(profil.vaha, profil.vyska);
    let tydne = cislo(profil.tempo) || 0; // kg za týden, záporné = hubnutí
    // hubnutí se nepočítá při podváze, v těhotenství a při kojení ani u dětí a dospívajících
    if (tydne < 0 && (zvlastni || (bmiTed !== null && bmiTed < 18.5) || (rVek !== null && rVek < 18))) {
      vys.poznamky.push(zvlastni ? 'V těhotenství a při kojení se hubnutí nedoporučuje – cíl je nastaven na udržení (s navýšením podle EFSA). Poraď se s lékařem.'
        : rVek !== null && rVek < 18 ? 'U dětí a dospívajících se hubnutí řídí jen s lékařem – cíl je nastaven na udržení.'
          : 'Při podváze (BMI pod 18,5) se hubnutí nedoporučuje – cíl je nastaven na udržení hmotnosti. Při potížích s jídlem se poraď s lékařem.');
      tydne = 0;
      vys.hubnutiZablokovano = true;
    }
    let kcal = cislo(profil.kcalRucne);
    const minimum = profil.pohlavi === 'z' ? 1200 : 1500;
    if (!kcal && vys.tdee) {
      kcal = vys.tdee + tydne * 7700 / 7;
      // bezpečné minimum chrání před příliš přísnou redukční dietou; při udržení se cíl řídí výdejem
      if (tydne < 0 && kcal < minimum) {
        kcal = Math.max(kcal, Math.min(minimum, vys.tdee));
        vys.poznamky.push('Cíl je omezen bezpečným minimem ' + minimum + ' kcal/den.');
      }
      if (tydne < 0 && kcal < vys.bmr) vys.poznamky.push('Cíl je nižší než bazální metabolismus – zvaž pomalejší tempo.');
    } else if (kcal && kcal < minimum) {
      vys.poznamky.push('Ručně zadaný cíl je pod obvyklým bezpečným minimem (' + minimum + ' kcal/den). Tak nízký příjem dlouhodobě jen pod dohledem lékaře.');
    }
    if (zvlastni) vys.poznamky.push('Referenční hodnoty vitaminů a minerálů jsou pro dospělé mimo těhotenství a kojení – některé potřeby (folát, jód, železo) jsou vyšší. Kofein nejvýš 200 mg denně (EFSA).');
    const cv = bmi(profil.cilVaha, profil.vyska);
    if (cv !== null && cv < 18.5) vys.poznamky.push('Cílová hmotnost odpovídá BMI ' + formatCislo(cv, 1) + ' – to je podváha. Zvaž vyšší cíl.');
    vys.kcal = kcal ? Math.round(kcal) : null;
    // skutečné tempo (kg/týden) podle cíle – po omezení minimem nebo při ručním cíli se liší od zvoleného
    if (vys.kcal && vys.tdee) vys.tempoSkutecne = (vys.kcal - vys.tdee) * 7 / 7700;
    vys.kofeinLimit = zvlastni ? 200 : 400;
    if (vys.tempoSkutecne !== undefined && tydne < 0 && vys.tempoSkutecne > -0.005 && !cislo(profil.kcalRucne))
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
      if (kl === 'voda') { vys.vodaMl = v + (zvlastni ? (profil.stav === 'koj' ? 700 : 300) : 0); continue; }   // EFSA 2010: těhotenství +300 ml, kojení +700 ml
      vys.zivinyCil[kl] = v;
      if (h.ul) vys.limity[kl + '_ul'] = h.ul;
    }
    if (r !== null && r < 18) vys.poznamky.push('Referenční hodnoty jsou pro dospělé (18+). U dětí a dospívajících se liší.');
    return vys;
  }

  /* ---------- pohyb (2024 Adult Compendium of Physical Activities) ----------
     MET = násobek klidového výdeje. Se známým klidovým výdejem (BMR z profilu, Mifflin–St Jeor) se počítá
     výdej = MET × BMR/1440 × minuty („korigovaný MET“ – standardní 1 MET = 3,5 ml O₂/kg/min klidový výdej
     většiny dospělých nadsazuje, nejvíc u žen a lidí s vyšší hmotností); bez profilu standardně
     MET × 3,5 × kg / 200 kcal/min (ACSM). K dennímu cíli se přičítá jen energie NAVÍC = (MET − 1) × klid,
     protože cíl (BMR × PAL) klidový výdej celého dne už obsahuje. Hodnoty MET se přebírají beze změny. */
  const INTENZITA = [
    { k: 'lehka', n: 'lehká', od: 0 },        // < 3 MET
    { k: 'stredni', n: 'střední', od: 3 },    // 3–5,9 MET
    { k: 'vysoka', n: 'vysoká', od: 6 },      // ≥ 6 MET
  ];
  function intenzitaMet(met) {
    met = cislo(met);
    if (!met) return null;
    return met >= 6 ? INTENZITA[2] : met >= 3 ? INTENZITA[1] : INTENZITA[0];
  }
  // posilovací činnosti (WHO: posilování svalů aspoň 2 dny v týdnu) – podle popisu v Compendiu
  const SILOVE = /resistance|calisthenics|circuit training|body weight|kettle ?bell|weight lifting|squats|power lifting/i;
  // další činnosti, které WHO (2020) počítá k posilování svalů: pilates, power jóga, lezení, těžká práce na zahradě
  const SILOVE_KODY = new Set(['02105', '02160', '15534', '15535', '15537', '08050', '08019', '08020']);
  // pohyby.json → katalog { kategorie, seznam, kod: {kód → pohyb}, rady: {řada → [pohyby podle rychlosti]} }
  function pripravPohyby(data) {
    if (!data || data.format !== 'denik-pohyby' || !Array.isArray(data.radky)) throw new Error('Katalog pohybů má neznámý formát.');
    const kat = { seznam: [], kod: {}, rady: {}, kategorie: Array.isArray(data.kategorie) ? data.kategorie : [], zdroj: data.zdroj || '', url: data.url || '' };
    for (const r of data.radky) {
      const [kod, k, rada, nazev, met, od, dO, hledat, popis] = r;
      if (!/^\d{5}$/.test(kod) || !(cislo(met) > 0)) continue;
      const p = { kod, kat: k, rada: rada || '', nazev, met: cislo(met), od: cislo(od), do: cislo(dO), hledat: hledat || '', popis: popis || '' };
      p.sila = (p.kat === 'posilovna' && SILOVE.test(p.popis)) || SILOVE_KODY.has(p.kod);
      p.n = norm(nazev + ' ' + p.hledat);
      kat.seznam.push(p); kat.kod[kod] = p;
      if (p.rada) (kat.rady[p.rada] = kat.rady[p.rada] || []).push(p);
    }
    for (const rr of Object.values(kat.rady)) rr.sort((a, b) => (a.od || 0) - (b.od || 0) || (a.do || 0) - (b.do || 0));
    return kat;
  }
  // typická rychlost činnosti (km/h) – střed rozsahu ze zdroje
  function rychlostPohybu(p) {
    if (!p) return null;
    if (p.od && p.do) return (p.od + p.do) / 2;
    return p.od || p.do || null;
  }
  function popisRychlosti(p) {
    if (!p || !(p.od || p.do)) return '';
    const f = v => formatCislo(v, 1);
    if (p.od && p.do) return p.od === p.do ? f(p.od) + ' km/h' : f(p.od) + '–' + f(p.do) + ' km/h';
    return p.od ? 'nad ' + f(p.od) + ' km/h' : 'pod ' + f(p.do) + ' km/h';
  }
  // tempo běhu: 6:15 min/km
  function tempoMinKm(kmh) {
    if (!(kmh > 0)) return '';
    const s = Math.round(3600 / kmh);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' min/km';
  }
  // vybere v řadě činnost odpovídající rychlosti; mezery mezi rozsahy dělí napůl; mimo = 'pod' | 'nad'
  function pohybPodleRychlosti(rada, kmh) {
    if (!Array.isArray(rada) || !rada.length || !(kmh > 0)) return null;
    const dolni = p => p.od || 0, horni = p => p.do || Infinity;
    for (let i = 0; i < rada.length; i++) {
      const p = rada[i], dalsi = rada[i + 1];
      const hranice = dalsi ? (horni(p) + dolni(dalsi)) / 2 : Infinity;
      if (kmh < hranice || !dalsi) {
        let mimo = null;
        // o víc než 10–15 % mimo celou řadu – nejspíš jiná činnost (chůze 10 km/h je už běh)
        if (i === 0 && p.od && kmh < p.od * 0.85) mimo = 'pod';
        if (!dalsi && p.do && kmh > p.do * 1.1) mimo = 'nad';
        return { p, mimo };
      }
    }
    return null;
  }
  // hmotnost platná pro den: nejbližší vážení do 30 dní (dřívější má přednost), jinak hmotnost z profilu
  function hmotnostKDni(stav, k) {
    let nej = null, vzd = Infinity;
    for (const d in (stav && stav.vahy) || {}) {
      const r = Math.abs(rozdilDni(d, k)) + (d > k ? 0.5 : 0);
      if (r < vzd) { vzd = r; nej = d; }
    }
    const prof = cislo(stav && stav.profil && stav.profil.vaha);
    if (nej && (vzd <= 30 || !(prof > 0))) return cislo(stav.vahy[nej]);
    return prof > 0 ? prof : null;
  }
  // energie činnosti: { brutto, klid, navic } v kcal (navic = přičítá se k cíli)
  function energiePohybu(met, minuty, kg, bmrDen) {
    met = cislo(met); minuty = cislo(minuty); kg = cislo(kg);
    if (!(met > 0) || !(minuty > 0) || !(kg > 0)) return null;
    const naMin = cislo(bmrDen) > 0 ? bmrDen / 1440 : 3.5 * kg / 200;   // klidový výdej kcal/min
    const klid = naMin * minuty, brutto = met * klid;
    return { brutto, klid, navic: Math.max(0, brutto - klid), korigovano: cislo(bmrDen) > 0 };
  }
  // výpočet záznamu: { pohyb (z katalogu), minuty?, km?, kroky?, delkaKroku (m) } → doplněné hodnoty
  // Ze vzdálenosti a času se určí rychlost a v řadě se vybere odpovídající činnost; ze vzdálenosti bez času se čas dopočítá.
  function vypoctiPohyb(katalog, vstup, kg, bmrDen) {
    let p = vstup.pohyb;
    if (!p) return null;
    let minuty = cislo(vstup.minuty), km = cislo(vstup.km);
    const kroky = cislo(vstup.kroky);
    if (!(km > 0) && kroky > 0 && cislo(vstup.delkaKroku) > 0) km = kroky * vstup.delkaKroku / 1000;
    if (!(minuty > 0)) minuty = null;
    if (!(km > 0)) km = null;
    let rychlost = null, mimo = null, zmena = false;
    const rada = p.rada && katalog && katalog.rady[p.rada];
    if (km && minuty) {
      rychlost = km / (minuty / 60);
      if (rada) {
        const v = pohybPodleRychlosti(rada, rychlost);
        if (v) { zmena = v.p !== p; p = v.p; mimo = v.mimo; }
      }
    } else if (km && !minuty) {
      const v = rychlostPohybu(p);
      if (v) { minuty = km / v * 60; rychlost = v; }
    } else if (minuty && !km && p.od && p.do) {
      rychlost = rychlostPohybu(p);
    }
    const e = minuty ? energiePohybu(p.met, minuty, kg, bmrDen) : null;
    return { p, minuty, km, kroky: kroky > 0 ? kroky : null, rychlost, mimo, zmena, energie: e, intenzita: intenzitaMet(p.met) };
  }
  // nedávno zapsané pohyby (nejnovější první, bez opakování) – rychlá nabídka
  function nedavnePohyby(stav, n) {
    const vys = [], videno = new Set();
    for (const k of Object.keys((stav && stav.dny) || {}).sort().reverse()) {
      const dd = stav.dny[k].pohyb || [];
      for (let i = dd.length - 1; i >= 0; i--) {
        const p = dd[i], klic = p.kod || 'r:' + norm(p.nazev);
        if (videno.has(klic)) continue;
        videno.add(klic);
        vys.push({ ...p, den: k });
        if (vys.length >= (n || 8)) return vys;
      }
    }
    return vys;
  }
  // týdenní přehled pohybu proti doporučení WHO 2020 (150–300 min středně nebo 75–150 min intenzivně, posilování 2 dny)
  function tydenPohybu(stav, odK, doK) {
    const vys = { lehka: 0, stredni: 0, vysoka: 0, nezname: 0, kcal: 0, dnySila: 0, dnyPohyb: 0, ekvivalent: 0, dny: {} };
    for (let k = odK; k <= doK; k = posunDen(k, 1)) {
      const dd = (stav.dny[k] && stav.dny[k].pohyb) || [];
      let sila = false, neco = false;
      for (const p of dd) {
        const m = cislo(p.minuty) || 0;
        vys.kcal += cislo(p.kcal) || 0;
        const i = intenzitaMet(p.met) || INTENZITA.find(x => x.k === p.int);
        if (!m) continue;
        neco = true;
        if (i) vys[i.k] += m; else vys.nezname += m;
        if (p.sila) sila = true;
      }
      if (sila) vys.dnySila++;
      if (neco) vys.dnyPohyb++;
      vys.dny[k] = dd.length;
    }
    vys.ekvivalent = vys.stredni + 2 * vys.vysoka;   // WHO: 1 min intenzivního = 2 min středního
    vys.splneno = vys.ekvivalent >= 150;
    vys.idealni = vys.ekvivalent >= 300;
    return vys;
  }
  // PAL v profilu už počítá se sportem → s přičítáním pohybu k cíli by se energie započítala dvakrát
  function dvojiPohyb(stav) {
    return !!(stav && stav.nastaveni && stav.nastaveni.pohybKCili && (cislo(stav.profil && stav.profil.pal) || 1.4) >= 1.6);
  }
  function hledejPohyb(katalog, dotaz, max) {
    const q = norm(dotaz).trim();
    if (!katalog || !q) return [];
    const slova = q.split(/\s+/).filter(Boolean);
    const vys = [];
    for (const p of katalog.seznam) {
      if (!slova.every(s => p.n.includes(s))) continue;
      const nz = norm(p.nazev);
      vys.push({ p, b: (nz.startsWith(q) ? 20 : 0) + (nz.includes(q) ? 10 : 0) - nz.length / 100 });
    }
    return vys.sort((a, b) => b.b - a.b).slice(0, max || 30).map(x => x.p);
  }

  /* ---------- sdílení receptu nebo uloženého jídla (QR kód, odkaz) ----------
     Balík nese jen to nutné: u potravin ze společné databáze id, množství, název a základní živiny
     (příjemce si vezme aktuální údaje ze své databáze, základ slouží jako záloha), u vlastních
     potravin všechny živiny. Na řetězec (deflate + base64url) ho převádí aplikace. */
  const FORMAT_SDILENI = 'ds1';
  const ZAKL_SDILENI = ['kcal', 'tuk', 'nasycene', 'sacharidy', 'cukry', 'vlaknina', 'bilkoviny', 'sul'];
  const zDatabaze = id => typeof id === 'string' && /^[svd]/.test(id);
  function zkratN(n, vse) {
    const o = {};
    for (const k of Object.keys(n || {})) {
      if (!ZIV[k] || !Number.isFinite(n[k]) || (!vse && !ZAKL_SDILENI.includes(k))) continue;
      const v = n[k];
      o[k] = zaokrouhli(v, v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : 3);
    }
    return o;
  }
  // druh 'r' = recept, 's' = uložené jídlo (id = jejich id), 'j' = chod jídla z deníku (id = { den, jidlo, nazev })
  function balikSdileni(stav, druh, id) {
    let zdroj, polozky;
    if (druh === 'j') {
      const d = id && typeof id.den === 'string' && vlastniKlic(stav.dny, id.den) ? stav.dny[id.den] : null;
      polozky = polozkyZaznamu(stav, d ? d.z.filter(z => z.j === id.jidlo) : []);
      if (!polozky.length) throw new Error('Jídlo je prázdné – není co sdílet');
      zdroj = { nazev: String(id.nazev || 'Jídlo').trim().slice(0, 80) || 'Jídlo' };
    } else {
      zdroj = druh === 'r' ? stav.recepty[id] : druh === 's' ? stav.sablony[id] : null;
      if (!zdroj || !vlastniKlic(druh === 'r' ? stav.recepty : stav.sablony, id)) throw new Error('Položka ke sdílení neexistuje');
      polozky = druh === 'r' ? zdroj.suroviny : zdroj.polozky;
    }
    const b = { f: FORMAT_SDILENI, t: druh, n: zdroj.nazev, p: [] };
    if (druh === 'j' && typeof id.jidlo === 'string') b.j = id.jidlo;
    if (druh === 'r') {
      b.porci = zdroj.porci || 1;
      if (cislo(zdroj.hmotnost) > 0) b.hm = zdroj.hmotnost;
      if (zdroj.postup) b.po = String(zdroj.postup).slice(0, 3000);
    }
    for (const x of polozky) {
      const f = x.f, db = zDatabaze(f.id);
      const e = { g: zaokrouhli(x.g, 1), n: f.nazev, v: zkratN(f.n, !db) };
      if (db) e.i = f.id;
      if (f.znacka) e.z = f.znacka;
      if (f.ml) e.ml = 1;
      if (f.druh) e.d = f.druh;
      if (!db && f.porce && f.porce.length) e.pc = f.porce.slice(0, 5).map(p => [p.n, p.g]);
      if (x.porce) e.por = [x.porce.n, x.porce.pocet];
      if (x.rychly) e.ry = 1;
      b.p.push(e);
    }
    return b;
  }
  // balík (nedůvěryhodný – z QR/odkazu) → { druh, nazev, porci, hmotnost, postup, polozky: [{ f, g, porce?, rychly? }], zDatabaze, nahradni }
  // najdi(id) vrátí potravinu z databáze příjemce (nebo null – pak se použijí údaje z balíku)
  function zBalikuSdileni(b, najdi) {
    if (!b || typeof b !== 'object' || b.f !== FORMAT_SDILENI || !['r', 's', 'j'].includes(b.t) || !Array.isArray(b.p)) throw new Error('Tohle není sdílený recept ani jídlo z Deníku jídla.');
    const nazev = typeof b.n === 'string' && b.n.trim() ? b.n.trim().slice(0, b.t === 'r' ? 120 : 80) : '';
    if (!nazev) throw new Error('Sdílená položka nemá název.');
    if (!b.p.length || b.p.length > 150) throw new Error('Sdílená položka nemá platný seznam potravin.');
    const vys = { druh: b.t, nazev, polozky: [], zDatabaze: 0, nahradni: [] };
    if (b.t === 'j') vys.jidlo = typeof b.j === 'string' && /^[a-z0-9_]{1,24}$/.test(b.j) ? b.j : null;   // chod u odesílatele (snidane, obed…)
    if (b.t === 'r') {
      vys.porci = Math.min(100, Math.max(1, Math.round(cislo(b.porci) || 1)));
      if (cislo(b.hm) > 0 && cislo(b.hm) < 100000) vys.hmotnost = cislo(b.hm);
      vys.postup = typeof b.po === 'string' ? b.po.slice(0, 5000) : '';
    }
    for (const e of b.p) {
      if (!e || typeof e !== 'object') continue;
      const g = cislo(e.g);
      if (!(g > 0) || g > 100000) continue;
      let f = typeof e.i === 'string' && zDatabaze(e.i) && najdi ? najdi(e.i) : null;
      if (f) { f = snimek(f); vys.zDatabaze++; }
      else {
        const nz = typeof e.n === 'string' && e.n.trim() ? e.n.trim() : 'Potravina';
        // vlastní (nebo u příjemce chybějící) potravina: nová vlastní položka ze sdílených údajů
        const dbId = typeof e.i === 'string' && zDatabaze(e.i) ? e.i : null;
        f = overSnimek({ id: dbId || 'm' + hash(nz + JSON.stringify(e.v || {})), typ: dbId ? dbId[0] : 'm',
          nazev: nz, n: e.v || {}, ...(typeof e.z === 'string' ? { znacka: e.z.slice(0, 40) } : {}), ...(e.ml ? { ml: true } : {}),
          ...(typeof e.d === 'string' ? { druh: e.d } : {}),
          ...(Array.isArray(e.pc) ? { porce: e.pc.filter(p => Array.isArray(p) && typeof p[0] === 'string' && cislo(p[1]) > 0).map(p => ({ n: p[0].slice(0, 40), g: cislo(p[1]) })) } : {}) });
        if (!f) continue;
        if (!Number.isFinite(f.n.kcal)) continue;
        if (typeof e.i === 'string') vys.nahradni.push(nz);
      }
      const x = { f, g };
      if (Array.isArray(e.por) && typeof e.por[0] === 'string' && cislo(e.por[1]) > 0) x.porce = { n: e.por[0].slice(0, 40), pocet: cislo(e.por[1]) };
      if (e.ry) x.rychly = true;
      vys.polozky.push(x);
    }
    if (!vys.polozky.length) throw new Error('Ve sdílené položce nejsou žádné použitelné potraviny.');
    return vys;
  }
  // uloží přijatou položku do stavu jako nový recept nebo uložené jídlo (potraviny jsou v něm jako snímky)
  function ulozSdilene(stav, x) {
    if (x.druh === 'r') return ulozRecept(stav, { nazev: x.nazev, porci: x.porci, hmotnost: x.hmotnost, postup: x.postup, suroviny: x.polozky.map(p => ({ f: p.f, g: p.g })) });
    return ulozSablonu(stav, x.nazev, x.polozky);   // uložené jídlo i sdílený chod jídla
  }
  // přijatý chod jídla (nebo uložené jídlo) rovnou do deníku: den k, jídlo dne jidlo
  function pridejSdileneDoDne(stav, x, k, jidlo) {
    return x.polozky.map(p => {
      const z = pridejZaznam(stav, k, jidlo, p.f, p.g, p.porce ? { porce: { n: p.porce.n, pocet: p.porce.pocet } } : null);
      if (p.rychly) z.rychly = true;
      return z;
    });
  }

  /* ---------- k čemu živiny jsou ----------
     Vitaminy a minerály: znění schválených zdravotních tvrzení EU (nařízení Komise (EU) č. 432/2012),
     zkrácené na hlavní účinky. Ostatní: doporučení WHO a EFSA. */
  const UCINKY_ZDROJ = 'Účinky vitaminů a minerálů podle schválených zdravotních tvrzení EU (nařízení Komise č. 432/2012); limity podle WHO a EFSA.';
  const UCINKY = {
    kcal: 'Palivo pro všechno, co tělo dělá – dech, srdce, mozek i pohyb. Dlouhodobý přebytek se ukládá jako tuk, nedostatek ho spotřebovává.',
    tuk: 'Zdroj energie a nezbytných mastných kyselin; bez tuku se nevstřebají vitaminy A, D, E a K.',
    nasycene: 'Hlavně máslo, sýry, tučné maso, uzeniny a kokosový tuk. Nahrazení nasycených tuků nenasycenými přispívá k udržení normální hladiny cholesterolu v krvi. WHO: pod 10 % energie.',
    sacharidy: 'Hlavní zdroj energie pro mozek a svaly. Nejlepší jsou celozrnné přílohy, luštěniny, ovoce a zelenina.',
    cukry: 'Rychlá energie bez dalších živin. Údaj zahrnuje i přirozený cukr z ovoce a mléka; WHO doporučuje volné (přidané) cukry pod 10 % energie kvůli zubům a hmotnosti.',
    vlaknina: 'Podporuje trávení a pocit sytosti. Vláknina z pšeničných otrub urychluje průchod střevem, beta-glukany z ovsa a ječmene přispívají k udržení normální hladiny cholesterolu.',
    bilkoviny: 'Stavební materiál těla: přispívají k nárůstu a udržení svalové hmoty a k udržení normálního stavu kostí. Dobře sytí.',
    sul: 'Sodík tělo potřebuje, většina lidí ho ale jí příliš. Snížení příjmu sodíku přispívá k udržení normálního krevního tlaku. WHO: méně než 5 g soli denně.',
    mufa: 'Olivový a řepkový olej, ořechy, avokádo. Nahrazení nasycených tuků nenasycenými přispívá k udržení normální hladiny cholesterolu v krvi.',
    pufa: 'Rostlinné oleje, ořechy, semínka a ryby (omega-3 a omega-6). Kyselina linolová přispívá k udržení normální hladiny cholesterolu v krvi.',
    trans: 'Hlavně ztužené tuky a průmyslové pečivo. Nemají žádný přínos a zvyšují riziko onemocnění srdce – čím méně, tím lépe (WHO).',
    chol: 'Tělo si ho vyrábí samo. Hladinu cholesterolu v krvi ovlivňují víc nasycené a trans tuky než cholesterol z jídla.',
    voda: 'Voda z jídla (polévky, ovoce, zelenina) kryje asi pětinu potřeby. Voda přispívá k udržení normálních tělesných a kognitivních funkcí.',
    alk: 'Dodává 7 kcal na gram a žádné živiny. Podle WHO neexistuje bezpečná dávka alkoholu.',
    kof: 'Zvyšuje bdělost a soustředění. Dospělí do 400 mg denně, v těhotenství a při kojení do 200 mg (EFSA).',
    ca: 'Přispívá k udržení normálního stavu kostí a zubů, k normální činnosti svalů a k normální srážlivosti krve.',
    fe: 'Přispívá k normální tvorbě červených krvinek a hemoglobinu, k přenosu kyslíku v těle a ke snížení míry únavy a vyčerpání.',
    mg: 'Přispívá ke snížení míry únavy a vyčerpání, k normální činnosti svalů a nervové soustavy a k udržení normálního stavu kostí.',
    p: 'Přispívá k udržení normálního stavu kostí a zubů a k normálnímu energetickému metabolismu.',
    k: 'Přispívá k normální činnosti svalů a nervové soustavy a k udržení normálního krevního tlaku.',
    zn: 'Přispívá k normální funkci imunitního systému, k udržení normálního stavu vlasů, nehtů a pokožky a k ochraně buněk před oxidativním stresem.',
    cu: 'Přispívá k normální funkci imunitního systému, k normálnímu přenosu železa v těle a k normální pigmentaci vlasů a pokožky.',
    mn: 'Přispívá k udržení normálního stavu kostí, k normálnímu energetickému metabolismu a k ochraně buněk před oxidativním stresem.',
    se: 'Přispívá k normální funkci imunitního systému a štítné žlázy a k udržení normálního stavu vlasů a nehtů.',
    jod: 'Přispívá k normální tvorbě hormonů štítné žlázy, k normální činnosti nervové soustavy a k normálním kognitivním funkcím.',
    vitA: 'Přispívá k udržení normálního zraku a normálního stavu pokožky a k normální funkci imunitního systému.',
    vitC: 'Přispívá k normální funkci imunitního systému, k tvorbě kolagenu (cévy, kosti, kůže, dásně), ke zvýšení vstřebávání železa a ke snížení míry únavy.',
    vitD: 'Přispívá k normálnímu vstřebávání vápníku, k udržení normálního stavu kostí, zubů a svalů a k normální funkci imunitního systému. Hlavním zdrojem je slunce, z jídla hlavně ryby a vejce.',
    vitE: 'Přispívá k ochraně buněk před oxidativním stresem.',
    vitK: 'Přispívá k normální srážlivosti krve a k udržení normálního stavu kostí.',
    b1: 'Přispívá k normálnímu energetickému metabolismu, k normální činnosti nervové soustavy a k normální funkci srdce.',
    b2: 'Přispívá k udržení normálního zraku a normálního stavu pokožky a ke snížení míry únavy a vyčerpání.',
    b3: 'Přispívá k normálnímu energetickému metabolismu, k normální činnosti nervové soustavy a ke snížení míry únavy a vyčerpání.',
    b5: 'Přispívá k normálnímu energetickému metabolismu a k normální duševní výkonnosti.',
    b6: 'Přispívá k normální tvorbě červených krvinek, k normální funkci imunitního systému a ke snížení míry únavy a vyčerpání.',
    b9: 'Přispívá k normální krvetvorbě a ke snížení míry únavy a vyčerpání; v těhotenství k růstu mateřských tkání.',
    b12: 'Přispívá k normální tvorbě červených krvinek, k normální činnosti nervové soustavy a ke snížení míry únavy. Ve významném množství je jen v živočišných potravinách – vegani potřebují doplněk.',
  };
  // v kolika (různých) potravinách z období živina je: obsahuje (> 0), nula (= 0), chybi (údaj neznámý)
  function vyskytZiviny(stav, od, doK) {
    const videno = new Map();
    for (let k = od; k <= doK; k = posunDen(k, 1)) {
      const d = stav.dny[k];
      if (!d) continue;
      for (const z of d.z) { const f = stav.potraviny[z.p]; if (f) videno.set(f.id + '|' + f.nazev, f); }
    }
    const vys = { celkem: videno.size, n: {} };
    for (const z of ZIVINY) {
      const x = { obsahuje: 0, nula: 0, chybi: 0 };
      for (const f of videno.values()) {
        const v = f.n[z.k];
        if (!Number.isFinite(v)) x.chybi++; else if (v > 0) x.obsahuje++; else x.nula++;
      }
      vys.n[z.k] = x;
    }
    return vys;
  }
  // nejbohatší obecné potraviny na živinu – podle množství v obvyklé porci (koření, doplňky a alkohol stranou)
  function nejlepsiZdroje(potraviny, kl, n) {
    const vys = [];
    for (const f of potraviny || []) {
      if (!f || (f.typ !== 's' && !(f.typ === 'd' && !f.odhad)) || ['koreni', 'doplnky', 'alkohol'].includes(f.skupina)) continue;
      const v = f.n && f.n[kl];
      if (!(v > 0)) continue;
      const p = (f.porce || []).find(x => x.g >= 10 && x.g <= 350 && !/^hrnek/.test(x.n) && (f.n.kcal || 0) * x.g / 100 <= 400);
      // bez porce: 100 g, u energeticky hutných potravin (semínka, kakao) nejvýš 200 kcal
      const g = p ? p.g : Math.round(Math.min(100, f.n.kcal > 0 ? 20000 / f.n.kcal : 100));
      vys.push({ f, porce: p ? p.n : g + ' ' + (f.ml ? 'ml' : 'g'), g, hodnota: v * g / 100 });
    }
    vys.sort((a, b) => b.hodnota - a.hodnota);
    // jedna položka na „rodinu“ (různé varianty téže potraviny) – podle prvního slova názvu
    const rod = new Set(), out = [];
    for (const x of vys) { const r = norm(x.f.nazev).split(/[\s,(]/)[0]; if (rod.has(r)) continue; rod.add(r); out.push(x); if (out.length >= (n || 6)) break; }
    return out;
  }

  /* ---------- import jídelníčku z tabulky (export Kalorických tabulek a jiných aplikací: Excel/CSV) ----------
     Tabulka se čte jako řádky buněk. Hledá se řádek záhlaví (energie + makroživiny), nad položkami řádky s datem
     a s názvem jídla dne (Snídaně, Oběd…). Každá položka = název, množství a živiny za snědené množství. */
  const IMPORT_SLOUPCE = [
    ['nazev', /^(potravina|nazev|nazev potraviny|polozka|jidlo|potraviny|food|name|item)$/],
    ['mnozstvi', /mnozstvi|hmotnost|porce|gramaz|amount|quantity|^g$|gramy/],
    ['kcal', /kcal|kalorie|calories/],
    ['kj', /\bkj\b/],
    ['energie', /^energie|energy/],
    ['bilkoviny', /bilkov|protein/],
    ['sacharidy', /sachar|carb/],
    ['cukry', /cukr|sugar/],
    ['tuk', /^tuky?\b|tuky? ?\(|^fat|^tuk|celkove tuky/],
    ['nasycene', /nasycen|saturat/],
    ['vlaknina', /vlakn|fib/],
    ['sul', /^sul|salt/],
    ['sodik', /sodik|sodium/],
    ['datum', /^datum|^date|^den$/],
    ['chod', /^(chod|denni doba|jidlo dne|meal|cas jidla|typ jidla)$/],
  ];
  const JIDLA_TEXT = [
    ['druha', /druha vecere|2\. vecere|pozdni vecere/],
    ['svacina1', /dopoledni svacina|presnidavka|svacina 1|1\. svacina/],
    ['svacina2', /odpoledni svacina|svacina 2|2\. svacina|^svacina/],
    ['snidane', /^snidane|breakfast/],
    ['obed', /^obed|lunch/],
    ['vecere', /^vecere|dinner/],
  ];
  const SOUHRN_TEXT = /^(celkem|soucet|suma|total|cil|zbyva|prumer|denni souhrn|souhrn)\b/;
  function textBunky(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return datumKlic(v);
    return String(v).replace(/\s+/g, ' ').trim();
  }
  function cisloBunky(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const t = textBunky(v).replace(/ /g, ' ');
    const m = /^-?\d[\d ]*(?:[.,]\d+)?/.exec(t);
    return m ? cislo(m[0].replace(/ /g, '')) : null;
  }
  function datumBunky(v) {
    if (v instanceof Date && !isNaN(v)) return datumKlic(v);
    const t = textBunky(v);
    let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
    if (m) { const k = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0'); return zKlice(k) ? k : null; }
    m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(t);
    if (m) { const k = m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); return zKlice(k) ? k : null; }
    return null;
  }
  function jidloZTextu(t) {
    const n = norm(t).replace(/[^a-z0-9. ]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const [id, re] of JIDLA_TEXT) if (re.test(n)) return id;
    return null;
  }
  // „150 g“, „1 ks (60 g)“, „250 ml“, „2 lžíce (30 g)“ → gramy (ml ≈ g), jinak null
  function gramyZMnozstvi(v, vychoziJednotka) {
    if (typeof v === 'number') return vychoziJednotka === 'g' && v > 0 ? v : null;
    const t = norm(textBunky(v));
    let m = /(\d+(?:[.,]\d+)?)\s*(g|ml|gramu|gr)\b/.exec(t.replace(/\(([^)]*)\)/g, ' $1 '));
    if (m) return cislo(m[1]);
    m = /(\d+(?:[.,]\d+)?)\s*(kg|l)\b/.exec(t);
    if (m) return cislo(m[1]) * 1000;
    if (/^\d+(?:[.,]\d+)?$/.test(t) && vychoziJednotka === 'g') return cislo(t);
    return null;
  }
  function najdiZahlavi(radek) {
    const map = {};
    radek.forEach((v, i) => {
      const t = norm(textBunky(v)).replace(/[\[\]]/g, '').trim();
      if (!t || t.length > 40) return;
      for (const [k, re] of IMPORT_SLOUPCE) if (map[k] === undefined && re.test(t)) {
        map[k] = i;
        if (k === 'energie' && /\bkj\b/.test(t)) { delete map.energie; map.kj = i; }
        if (k === 'energie' && /kcal/.test(t)) { delete map.energie; map.kcal = i; }
        break;
      }
    });
    const energie = map.kcal !== undefined || map.kj !== undefined || map.energie !== undefined;
    const makro = ['bilkoviny', 'sacharidy', 'tuk'].filter(k => map[k] !== undefined).length;
    return energie && makro >= 2 ? map : null;
  }
  // radky: pole řádků (pole buněk). volby: { den (výchozí datum), jidlo (výchozí jídlo) }
  function rozeberTabulkuJidel(radky, volby) {
    volby = volby || {};
    const vys = { polozky: [], dny: new Set(), mapovani: null, preskoceno: 0, energieKj: false };
    let map = null, den = volby.den || null, jidlo = volby.jidlo || 'snidane', jednotkaG = true;
    for (const radek of radky || []) {
      if (!Array.isArray(radek)) continue;
      const neprazdne = radek.map(textBunky).filter(Boolean);
      if (!neprazdne.length) continue;
      const z = najdiZahlavi(radek);
      // samotné číslo v množství = gramy, pokud záhlaví neříká jinak (ks, porce)
      if (z) { map = z; vys.mapovani = map; jednotkaG = map.mnozstvi === undefined || !/\b(ks|kus|porce|porc)\b/.test(norm(textBunky(radek[map.mnozstvi]))); continue; }
      // datum (samostatný řádek nebo sloupec)
      const dSloupec = map && map.datum !== undefined ? datumBunky(radek[map.datum]) : null;
      const eSloupec = map ? [map.kcal, map.kj, map.energie].find(i => i !== undefined) : undefined;
      const energieRadku = eSloupec !== undefined ? cisloBunky(radek[eSloupec]) : null;
      if (dSloupec) den = dSloupec;
      else if (energieRadku === null) { for (const v of radek) { const d = datumBunky(v); if (d) { den = d; break; } } }
      // jídlo dne (samostatný řádek nebo sloupec)
      const ch = map && map.chod !== undefined ? jidloZTextu(textBunky(radek[map.chod])) : null;
      if (ch) jidlo = ch;
      else if (energieRadku === null) { const j = jidloZTextu(neprazdne[0]); if (j) { jidlo = j; continue; } }
      if (!map || energieRadku === null) continue;
      let nazev = map.nazev !== undefined ? textBunky(radek[map.nazev]) : '';
      if (!nazev) nazev = radek.map(textBunky).find(t => t && !/^-?\d+([.,]\d+)?$/.test(t) && !datumBunky(t) && !jidloZTextu(t)) || '';
      const nn = norm(nazev);
      if (!nazev || SOUHRN_TEXT.test(nn) || (!ch && jidloZTextu(nazev) && nn.length < 25)) { vys.preskoceno++; continue; }
      const n = {};
      for (const k of ['bilkoviny', 'sacharidy', 'cukry', 'tuk', 'nasycene', 'vlaknina', 'sul']) {
        if (map[k] === undefined) continue;
        const v = cisloBunky(radek[map[k]]);
        if (v !== null && v >= 0 && v < 5000) n[k] = v;
      }
      if (n.sul === undefined && map.sodik !== undefined) { const v = cisloBunky(radek[map.sodik]); if (v !== null && v >= 0) n.sul = v > 50 ? v * 2.5 / 1000 : v * 2.5; }   // sodík v mg nebo g
      let e = null;
      if (map.kcal !== undefined) e = cisloBunky(radek[map.kcal]);
      if (e === null && map.kj !== undefined) { const kj = cisloBunky(radek[map.kj]); if (kj !== null) { e = kj / 4.184; vys.energieKj = true; } }
      if (e === null && map.energie !== undefined) {
        e = cisloBunky(radek[map.energie]);
        // jednotka neuvedená: kJ, když hodnota sedí s makroživinami ×4,184 lépe než v kcal
        const m = energieZMaker({ tuk: n.tuk || 0, sacharidy: n.sacharidy || 0, bilkoviny: n.bilkoviny || 0 });
        if (e !== null && m && Math.abs(e / 4.184 - m) < Math.abs(e - m)) { e = e / 4.184; vys.energieKj = true; }
      }
      if (e === null || e < 0 || e > 20000) { vys.preskoceno++; continue; }
      n.kcal = zaokrouhli(e, 1);
      const mn = map.mnozstvi !== undefined ? radek[map.mnozstvi] : null;
      const g = gramyZMnozstvi(mn, jednotkaG ? 'g' : null);
      const k = den || datumKlic(new Date());
      vys.dny.add(k);
      vys.polozky.push({ den: k, jidlo, nazev: nazev.slice(0, 120), mnozstvi: mn === null || mn === undefined ? '' : textBunky(mn).slice(0, 40), g: g > 0 && g <= 5000 ? g : null, n });
    }
    vys.dny = [...vys.dny].sort();
    return vys;
  }
  // zápis importovaných položek do deníku; stejná položka ve stejném dni a jídle se podruhé nepřidá
  function importujPolozky(stav, polozky, volby) {
    volby = volby || {};
    let pridano = 0, duplicit = 0;
    const jidla = (stav.nastaveni.jidla || JIDLA_VYCHOZI).map(j => j.id);
    for (const x of polozky) {
      const jid = jidla.includes(x.jidlo) ? x.jidlo : jidla[0];
      const nazev = x.nazev + (x.mnozstvi && !x.g ? ' (' + x.mnozstvi + ')' : '');
      // bez gramů: „porce“ – hodnoty rozložit na násobky 100 g, aby na 100 g nepřesáhly rozumné meze
      const g = x.g || 100 * Math.max(1, Math.ceil(Math.max((x.n.kcal || 0) / 900, ['tuk', 'sacharidy', 'bilkoviny', 'cukry', 'vlaknina', 'nasycene'].reduce((a, k) => a + (x.n[k] || 0), 0) / 95)));
      const n100 = {};
      for (const k of Object.keys(x.n)) if (ZIV[k] && Number.isFinite(x.n[k])) n100[k] = zaokrouhli(x.n[k] * 100 / g, 3);
      const f = { id: 'q' + hash('imp|' + nazev + JSON.stringify(n100)), typ: 'q', nazev, n: n100 };
      if (volby.zdroj) f.znacka = volby.zdroj;
      const d = stav.dny[x.den];
      const ks = klicSnimku(f);
      if (d && d.z.some(z => z.p === ks && z.j === jid && Math.abs(z.g - g) < 0.01)) { duplicit++; continue; }
      const z = pridejZaznam(stav, x.den, jid, f, g);
      if (!x.g) z.rychly = true;
      z.imp = 1;
      pridano++;
    }
    return { pridano, duplicit };
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
      plan: {},         // jídelníček: den → [{id, j (jídlo), druh 'r' recept | 's' uložené jídlo | 'f' potravina, ref, porci, f, g}]
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
    if (f.druh) s.druh = f.druh;
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
    const vys = { celkem: {}, jidla: {}, pocet: 0, pohyb: 0, voda: 0, napoje: 0, pokryti: {}, tekute: { kcal: 0, cukry: 0, ml: 0 }, alk: 0 };
    if (!d) return vys;
    const energieZnama = {};
    let energie = 0;
    for (const z of d.z) {
      const v = zivinyZaznamu(stav, z);
      // nápoje se počítají do pitného režimu podle nastavení; tekuté kalorie zvlášť (i alkohol)
      const f = stav.potraviny[z.p];
      if (f && !z.rychly) vys.napoje += z.g * doPitnehoRezimu(f, stav.nastaveni);
      if (f && !z.rychly && druhNapoje(f)) {
        vys.tekute.kcal += v.kcal || 0; vys.tekute.cukry += v.cukry || 0; vys.tekute.ml += z.g;
      }
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
    vys.alk = vys.celkem.alk || 0;
    return vys;
  }
  // „Co ti chybí“: živiny, kterých je za zapsané dny období dlouhodobě málo (pod 75 % cíle), a potraviny,
  // které je doplní – nejdřív ty, které už jíš, pak nové z kandidátů (obecné potraviny s ověřenými hodnotami).
  // U živin se bere jen tam, kde známe hodnoty aspoň u 60 % snědené energie (jinak by tip mohl být falešný).
  const TIPOVANE = ['vlaknina', 'bilkoviny', 'ca', 'fe', 'mg', 'k', 'zn', 'jod', 'se', 'vitC', 'vitD', 'b9', 'b12'];
  function tipyNaZiviny(stav, od, doK, cile, kandidati, volby) {
    volby = volby || {};
    const dny = [];
    for (let k = od; k <= doK; k = posunDen(k, 1)) { const s = souhrnDne(stav, k); if (s.pocet && (s.celkem.kcal || 0) >= 400) dny.push(s); }
    if (dny.length < 3) return { dni: dny.length, tipy: [] };
    const kcalCil = cile.kcal || dny.reduce((a, s) => a + (s.celkem.kcal || 0), 0) / dny.length;
    // potraviny z deníku v období (s počtem použití)
    const pouzite = new Map();
    for (let k = od; k <= doK; k = posunDen(k, 1)) {
      const d = stav.dny[k];
      if (!d) continue;
      for (const z of d.z) { const f = stav.potraviny[z.p]; if (!f || z.rychly) continue; const x = pouzite.get(f.id) || { f, n: 0, g: 0 }; x.n++; x.g += z.g; x.f = f; pouzite.set(f.id, x); }
    }
    const tipy = [];
    for (const kl of TIPOVANE) {
      const cil = cile.zivinyCil[kl];
      if (!cil || (volby.mikro === false && ZIV[kl].s !== 'zaklad')) continue;
      let e = 0, ez = 0, suma = 0;
      for (const s of dny) { const ee = s.celkem.kcal || 0; e += ee; ez += ee * (s.pokryti[kl] || 0); suma += s.celkem[kl] || 0; }
      const pokryti = e ? ez / e : 0;
      if (pokryti < 0.6) continue;
      const prumer = suma / dny.length / pokryti;   // dopočet za jídlo bez údaje
      const podil = prumer / cil;
      if (podil >= 0.75) continue;
      const potreba = cil / kcalCil * 100;          // kolik živiny je třeba na 100 kcal
      const hustota = f => (Number.isFinite(f.n[kl]) && f.n.kcal > 0 ? f.n[kl] / f.n.kcal * 100 : 0);
      // realistická porce: ne americké „hrnky“; suché luštěniny 50 g, ořechy a semínka hrst 30 g
      const porce = f => {
        if (!f.ml && /such|sušen/i.test(f.nazev || '')) return { n: '50 g', g: 50 };
        if (f.skupina === 'orechy' || /semínk|semen|sezam|mák|ořech/i.test(f.nazev || '')) return { n: 'hrst (30 g)', g: 30 };
        if (!f.ml && (f.n.kcal || 0) > 350) return { n: '30 g', g: 30 };     // čokoláda, kakao, sušenky…
        const p = (f.porce || []).find(x => x.g >= 15 && x.g <= 250 && (f.ml || !/hrnek|šálek/i.test(x.n)));
        return p ? { n: p.n, g: p.g } : { n: '100 ' + (f.ml ? 'ml' : 'g'), g: 100 };
      };
      const moje = [...pouzite.values()].filter(x => hustota(x.f) >= potreba * 1.3)
        .sort((a, b) => hustota(b.f) * Math.log(1 + b.n) - hustota(a.f) * Math.log(1 + a.n)).slice(0, 3)
        .map(x => { const p = porce(x.f); return { f: x.f, porce: p, mnozstvi: x.f.n[kl] * p.g / 100, pouzito: x.n }; });
      const jeMoje = new Set(moje.map(x => x.f.id));
      const nove = (kandidati || []).filter(f => !jeMoje.has(f.id) && !pouzite.has(f.id) && f.skupina !== 'koreni' && hustota(f) >= potreba * 1.5 && (!volby.vyloucit || !volby.vyloucit(f)))
        .map(f => { const p = porce(f); return { f, porce: p, mnozstvi: f.n[kl] * p.g / 100, h: hustota(f) }; })
        .filter(x => x.mnozstvi >= cil * 0.08)       // jedna porce pokryje aspoň 8 % denní potřeby
        .sort((a, b) => b.mnozstvi - a.mnozstvi).slice(0, 3);
      tipy.push({ k: kl, n: ZIV[kl].n, j: ZIV[kl].j, d: ZIV[kl].d, prumer, cil, podil, pokryti, moje, nove });
    }
    tipy.sort((a, b) => a.podil - b.podil);
    return { dni: dny.length, tipy: tipy.slice(0, volby.limit || 4) };
  }
  /* ---------- recept z vloženého textu („200 g mouky, 2 vejce, 1 lžíce oleje“) ---------- */
  // jednotka → gramy (u objemu 1 ml ≈ 1 g); kus = podle porce potraviny (doplní rozhraní po spárování)
  const JEDNOTKY_RECEPTU = [
    [/^(kg|kila?|kilogram\w*)$/, 1000], [/^(dkg|deka|dag)$/, 10], [/^(g|gr|gram\w*)$/, 1], [/^(mg)$/, 0.001],
    [/^(l|litr\w*)$/, 1000], [/^(dl|decilitr\w*|deci)$/, 100], [/^(cl)$/, 10], [/^(ml|mililitr\w*)$/, 1],
    [/^(lžíce|lžíc[eíi]?|lžic\w*|pl|polévkov\w*)$/, 15, 'lžíce'], [/^(lžička|lžičk\w*|lžiček|čl|kl|kávov\w*)$/, 5, 'lžička'],
    [/^(hrn[eí]?[kč]\w*|šál[eo]?k\w*)$/, 250, 'hrnek'], [/^(špet\w*|štipk\w*)$/, 0.5, 'špetka'],
    [/^(hrst\w*)$/, 30, 'hrst'], [/^(svaz\w*|svazeč\w*)$/, 30, 'svazek'], [/^(plát\w*)$/, 20, 'plátek'],
    [/^(stroužk?\w*|stroužek)$/, 4, 'stroužek'], [/^(ks|kus\w*|kousk\w*)$/, null, 'kus'],
    [/^(balení|bal|balíč\w*|sáč\w*|konzerv\w*|plechovk\w*|kostk\w*|kostič\w*)$/, null, 'balení'],
  ];
  const ZLOMKY = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
  function cisloRecept(s) {
    s = s.trim().replace(/[½¼¾⅓⅔]/g, m => ' ' + ZLOMKY[m]).trim();
    let m = s.match(/^(\d+)\s+(\d+(?:\.\d+)?)$/);                     // „1 0.5“ ze „1½“
    if (m) return +m[1] + +m[2];
    m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) return +m[2] ? +m[1] / +m[2] : null;
    m = s.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/);   // rozsah „2–3“ → průměr
    if (m) return (cislo(m[1]) + cislo(m[2])) / 2;
    return cislo(s);
  }
  const RE_CISLO = '(\\d+\\s*\\/\\s*\\d+|\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?\\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔])';
  // způsob krájení („nakrájená na plátky“, „na kostičky“) není součást názvu ani porce
  const RE_KRAJENI = /(^|\s)(((na|po|roz)?krájen|nasekan|nastrouhan|natrhan)\S*\s*)?na\s+((malé|velké|větší|menší|jemné|tenké|silné|drobné|hrubé)\s+)?(plát|kostič|kostk|koleč|nudlič|proužk|kous|čtvrt|půl|polovin|osmin|jemno|hrubo|drobno|měsíč|klínk|plátk|krouž|hranol)\S*/gi;
  function rozeberSuroviny(text) {
    const vys = [];
    for (let radek of String(text || '').split(/\r?\n|;|(?<!\d),(?=\s*\d)|,(?=\s+\d)/)) {
      radek = radek.replace(/^[\s•*·\-–—▪◦\d]+[.)]\s+/, m => (/\d/.test(m) && !/[.)]\s+$/.test(m) ? m : '')).replace(/^[\s•*·\-–—▪◦]+/, '').trim();
      if (!radek || /:$/.test(radek) || radek.length > 120) continue;
      let mn = null, jed = null, g = null, druh = null, nazev = radek;
      const zkusJednotku = slovo => { const s = norm(slovo).replace(/\.$/, ''); for (const [re, gr, d] of JEDNOTKY_RECEPTU) if (re.test(s) || re.test(slovo.toLowerCase().replace(/\.$/, ''))) return { gr, d: d || null }; return null; };
      const cist = radek.replace(RE_KRAJENI, ' ').replace(/\s+/g, ' ').trim() || radek;
      let m = cist.match(new RegExp('^' + RE_CISLO + '\\s*([^\\s\\d]+\\.?)?\\s*(.*)$'));
      if (!m) m = (() => { const k = cist.match(new RegExp('^(.*?)[\\s,–-]+' + RE_CISLO + '\\s*([^\\s\\d]+\\.?)?$')); return k ? [k[0], k[2], k[3], k[1]] : null; })();
      if (m) {
        mn = cisloRecept(m[1]);
        const j = m[2] ? zkusJednotku(m[2]) : null;
        if (j) { jed = m[2].replace(/\.$/, ''); druh = j.d; if (j.gr !== null && mn !== null) g = mn * j.gr; nazev = m[3]; }
        else { nazev = ((m[2] || '') + ' ' + (m[3] || '')).trim(); druh = 'kus'; }   // „2 vejce“
      }
      nazev = nazev.replace(/\(.*?\)/g, ' ').replace(RE_KRAJENI, ' ').replace(/(^|\s)(dle chuti|podle chuti|na ozdobu|na posypání|na vymazání|na smažení|na podlití|cca|asi|trochu|případně)(?=\s|$|,)/gi, ' ')
        .replace(/^(\s*(of|z|ze)\s+)/i, '').replace(/[,.;:]+$/, '').replace(/\s+/g, ' ').trim();
      if (!nazev) continue;
      vys.push({ radek, mnozstvi: mn, jednotka: jed, druh, g: g !== null ? zaokrouhli(g, 1) : null, nazev });
    }
    return vys;
  }
  // tvary slov ze seznamu surovin (2. pád) → 1. pád; nepravidelné a typické případy zvlášť
  const NEPRAVIDELNE = { jater: 'játra', soli: 'sůl', soľ: 'sůl', syra: 'eidam', syru: 'eidam', syr: 'eidam', vajec: 'vejce', vajicek: 'vejce', vejci: 'vejce', masla: 'máslo',
    rajcat: 'rajče', rajcata: 'rajče', rajcete: 'rajče', brambor: 'brambory', jablek: 'jablko', hrusek: 'hruška', svestek: 'švestky', cibuli: 'cibule',
    testovin: 'těstoviny', spaget: 'těstoviny', spagety: 'těstoviny', nudli: 'těstoviny', orechu: 'ořechy', mandli: 'mandle', banany: 'banán',
    oleje: 'řepkový olej', olej: 'řepkový olej', octa: 'ocet', pepre: 'pepř', vody: 'voda', mleka: 'mléko', masa: 'maso', zeli: 'zelí', mrkve: 'mrkev', prsou: 'prsa', medu: 'med',
    kakaa: 'kakao', zloutku: 'žloutek', zloutky: 'žloutek', bilku: 'bílek', bilky: 'bílek', vlocek: 'vločky', fazoli: 'fazole', cocky: 'čočka', prasku: 'prášek', tvarohu: 'tvaroh', jogurtu: 'jogurt', sadla: 'sádlo', slaniny: 'slanina', sunky: 'šunka' };
  function tvaryNazvu(nazev) {
    const slova = norm(nazev).split(' ').filter(Boolean).slice(0, 3);
    const tvary = s => {
      const v = new Set([s]);
      if (NEPRAVIDELNE[s]) v.add(norm(NEPRAVIDELNE[s]));
      const k = (kon, nah) => { if (s.length > kon.length + 2 && s.endsWith(kon)) v.add(s.slice(0, -kon.length) + nah); };
      k('ych', 'e'); k('ych', 'y'); k('ych', 'a'); k('ich', 'i'); k('iho', 'i'); k('eho', 'e'); k('eho', 'y'); k('ou', 'a'); k('ek', 'ky');
      k('y', 'a'); k('u', ''); k('a', 'o'); k('a', ''); k('e', ''); k('i', 'e'); k('i', 'a');
      return [...v];
    };
    const t0 = tvary(slova[0] || ''), t1 = slova[1] ? tvary(slova[1]) : [''];
    const vys = new Set([norm(nazev)]);
    for (const a of t0) for (const b of t1) vys.add((a + ' ' + b).trim());
    for (const a of t0) vys.add(a);
    return [...vys].slice(0, 24);
  }
  // potravina pro řádek receptu: nejdřív obecné suroviny (a vlastní potraviny), syrové před tepelně upravenými;
  // když nic nesedí, výrobky z databáze
  function najdiSurovinu(indexSurovin, indexVse, nazev) {
    let nej = null, nejB = 0, nejUpr = false, syr = null, syrB = 0;
    const slova = norm(nazev).split(' ').filter(Boolean).slice(0, 3);
    const kmeny = slova.map(w => tvaryNazvu(w).filter(x => !x.includes(' ')).map(x => x.slice(0, Math.max(3, x.length - 2))));
    // kandidáti: celý název; bez prvního slova (přídavné jméno: „strouhaného sýra“) s malou srážkou
    const varianty = tvaryNazvu(nazev).map(t => [t, 0]);
    if (slova.length > 1) for (const t of tvaryNazvu(slova.slice(1).join(' '))) varianty.push([t, 0.3]);
    const ohodnot = (index, srazka) => {
      for (const [t, sr] of varianty) {
        const prvni = t.split(' ')[0];
        if (prvni.length < 2) continue;
        for (const f of hledej(index, t, { limit: 8 })) {
          if (!Number.isFinite(f.n.kcal)) continue;
          const slovaF = norm(f.nazev).replace(/\bbez \S+/g, ' ').replace(/[()/,.]/g, ' ').split(' ').filter(Boolean);
          if (!slovaF.length) continue;
          let b = 0;
          if (slovaF[0] === prvni) b = 4;
          else if (slovaF[0].startsWith(prvni) && prvni.length >= 4) b = 3;
          else if (slovaF.includes(prvni)) b = 2.5;
          else if (slovaF.some(w => w.startsWith(prvni) && prvni.length >= 4)) b = 2;
          // celý řádek (i ve 2. pádě) je synonymem potraviny („gulášové maso“, „melty“; krátká jako „sýr“ ne)
          const al = sr === 0 && (t.includes(' ') || t.length >= 5) && (f.aliasy || ALIASY[f.nazev]);
          const shodaAlias = !!al && norm(al).split(/\s*,\s*/).includes(t);
          if (shodaAlias) b = Math.max(b, 4.5);
          if (!b) continue;
          // ostatní slova původního názvu: shoda přidá, chybějící (např. „hladké“, „hrubé“) ubere;
          // synonymum celý řádek pokrývá, předložky a krátká slova („na plátky“) se nepočítají
          if (!shodaAlias) kmeny.forEach((km, i) => {
            if (!slova[i] || slova[i].length < 3 || /^(bez|pro|nebo|pod|nad)$/.test(slova[i])) return;
            if (t.split(' ')[0].startsWith(km[0] || '~')) return;
            const shoda = slovaF.some(x => km.some(k => x.startsWith(k)));
            b += shoda ? 0.8 : -0.5;
          });
          if (/syrov|such|\(syr/.test(norm(f.nazev))) b += 0.4;
          // upravená potravina, když řádek receptu úpravu nezmiňuje („pečeně“ v „(karé, syrová)“ je kus masa, ne úprava)
          const nzF = norm(f.nazev);
          const upr = !SYROVE.test(nzF) && /varen|pecen|smazen|dusen|grilovan|opecen|upraven|obal|michan|natvrdo|volske|kase|konzerv|tycink|poleva|dezert|cokolad|protein/.test(nzF) && !/varen|pecen|smazen|dusen|grilovan|opecen|obal|cokolad|protein/.test(t + ' ' + norm(nazev));
          if (upr) b -= 0.8;
          if (f.typ === 'm') b += 0.3;
          b -= sr + srazka + (t === norm(nazev) ? 0 : 0.1);
          if (/(^|\s)(srdce|jazyk|ledvin|mozec|zaludk|drstk|nozick)/.test(nzF) && !/srdc|srdic|jazyk|ledvin|mozec|zaludk|drst|nozic/.test(norm(nazev))) b -= 1;
          // při shodném skóre čerstvá / nezpracovaná před sušenou, mletou a práškem („cibule na kroužky“)
          const zprac = x => /susen|mlet|prasek/.test(norm(x.nazev));
          if (b > nejB + 1e-9 || (Math.abs(b - nejB) < 1e-9 && nej && zprac(nej) && !zprac(f))) { nejB = b; nej = f; nejUpr = upr; }
          if (SYROVE.test(nzF) && b > syrB) { syrB = b; syr = f; }
        }
      }
    };
    ohodnot(indexSurovin, 0);
    // recept počítá se syrovou vahou: dobře sedící syrová surovina má přednost před upravenou („kuřecí prsa bez kůže“)
    if (nejUpr && syr && syrB >= 3) { nej = syr; nejB = syrB; nejUpr = false; }
    // výrobky jen když obecná surovina nesedí dobře (nebo sedí jen tepelně upravená – v receptu bývá syrová)
    if (!(nej && nejB >= 3.5 && !nejUpr)) ohodnot(indexVse, 0.5);
    if (nej && nejB >= 1.8) return nej;
    const nal = hledej(indexVse, nazev, { limit: 6 });
    return nal.find(f => Number.isFinite(f.n.kcal)) || null;
  }
  // gramy suroviny podle spárované potraviny (u „kusů“ a balení podle jejích porcí)
  function gramySuroviny(r, f) {
    if (r.g !== null && r.g !== undefined) return { g: r.g, odhad: false };
    if (r.mnozstvi === null || r.mnozstvi === undefined) return { g: null, odhad: true };   // „máslo na vymazání“
    const pocet = r.mnozstvi;
    const porce = (f && f.porce) || [];
    let p = null;
    // běžná balení do pečení (na 1 balení) – i bez slova „balení“: „1 vanilkový cukr“, „1 prášek do pečiva“
    const radek = norm(r.radek || r.nazev);
    const typ = (r.druh === 'balení' || r.druh === 'kus') && !/(^|\s)(list|platk|kelim|chia)/.test(radek) && !/hotov/.test(norm((f && f.nazev) || '')) &&
      [[/kypr|prasek do pec|prasku do pec/, 12], [/pudink/, 40], [/vanilk[a-z]* cukr|vanilin/, 20], [/drozdi|kvasnic/, 42], [/zelatin/, 20]]
        .find(([re]) => re.test(radek) && !(re.source.startsWith('drozdi') && /susen|pivo/.test(radek)));
    if (typ) return { g: zaokrouhli(pocet * typ[1], 1), odhad: false };
    if (r.druh === 'balení') {
      p = porce.find(x => /balení/.test(x.n)) || (/^kost/.test(norm(r.jednotka || '')) && porce.find(x => /^kostka/.test(x.n)));
    }
    else if (r.druh === 'stroužek') p = porce.find(x => /stroužek/.test(x.n));
    else {
      // „2 cm zázvoru“ podle porce „kousek (2 cm)“; „2 bobkové listy“, „1 hlávka“ podle porce stejného slova
      const text = norm((r.radek || r.nazev).replace(RE_KRAJENI, ' '));
      const cm = text.match(/(^|\s)(\d+(?:[.,]\d+)?)\s*cm\b/), pcm = cm && porce.find(x => /\(\d+ cm\)/.test(x.n));
      if (pcm) return { g: zaokrouhli(cislo(cm[2]) / +pcm.n.match(/\((\d+) cm\)/)[1] * pcm.g, 1), odhad: false };
      p = porce.find(x => { const w = norm(x.n).split(/[ (]/)[0]; return w.length >= 4 && !/^(porce|hrnek|lzice|lzicka|balen|mal|vel|stred|prso|filet)/.test(w) && new RegExp('(^|\\s)' + w.slice(0, Math.max(3, w.length - 2))).test(text); })
        || porce.find(x => /^střední kus\b/.test(x.n)) || porce.find(x => /^kus\b/.test(x.n)) || porce.find(x => /kus|vejce/.test(x.n))
        || porce.find(x => /^(balení|kostka)(?=\s|$|\()/.test(x.n));   // „1 vanilkový cukr“ = 1 balení
    }
    if (p) return { g: zaokrouhli(pocet * p.g, 1), odhad: false };
    if (f && f.skupina === 'koreni') return { g: null, odhad: true };   // „3 hřebíčky“ nejsou 300 g
    return { g: zaokrouhli(pocet * 100, 1), odhad: true };
  }
  /* ---------- tabulka výživových údajů z textu (OCR fotky etikety) ---------- */
  // pořadí je důležité: „z toho nasycené…“ a „z toho cukry“ dřív než tuky a sacharidy
  const ETIKETA = [
    ['nasycene', /nasycen|nasyten|nasýten|gesatt|gesätt|saturat|nasycon|telit/],
    ['cukry', /cukr|cukor|zucker|sugar|sucre|cukier/],
    ['vlaknina', /vlaknin|vláknin|ballast|fibre|fiber|blonnik|błonnik|vlakn/],
    ['bilkoviny', /bilkovin|bílkovin|bielkovin|eiwei|protein|bialk|białk/],
    ['sul', /(^|\s)(sul|sůl|sol|soľ|sól|salz|salt|sel)\b/],
    ['tuk', /(^|\s)(tuk|tuky|tukov|fett|fat|fats|tluszcz|tłuszcz|graisse|zsir)/],
    ['sacharidy', /sacharid|kohlenhydrat|carbohydrat|weglowodan|węglowodan|glucid|szenhidr/],
  ];
  function opravCislaOcr(s) {
    // O/o → 0 a I/l → 1 jen uvnitř čísel („1O,5 g“, „O,8 g“, „l5 g“)
    return s.replace(/(?<=[\d,.])[oO](?=[\d,.\s]*(g|kj|kcal|mg)\b)|\b[oO](?=[,.]\d)/gi, '0').replace(/(?<=\s|^)[Il](?=\d)/g, '1');
  }
  // ztracené desetinné čárky: u čísel bez čárky zkusí ÷10 a ÷100 a vybere kombinaci, se kterou sedí
  // energie a pravidla (nasycené ≤ tuky, cukry ≤ sacharidy, sůl do 10 g, součet do 100 g)
  function opravCarky(n, bezCarky) {
    const kl = Object.keys(bezCarky).filter(k => n[k] >= (k === 'sul' ? 2 : 10));
    if (!kl.length) {
      for (const k of Object.keys(n)) if (k !== 'kcal' && n[k] > 100) delete n[k];
      return [];
    }
    const vol = kl.map(k => [n[k], n[k] / 10, n[k] / 100].filter(v => v <= 100));
    let nej = null, nejS = Infinity;
    const zkus = (i, akt) => {
      if (i === kl.length) {
        const x = { ...n, ...akt };
        let s = 0;
        if (Number.isFinite(x.kcal) && x.kcal > 0) {
          const vyp = 9 * (x.tuk || 0) + 4 * (x.sacharidy || 0) + 4 * (x.bilkoviny || 0) + 2 * (x.vlaknina || 0);
          s += Math.abs(vyp - x.kcal) / x.kcal;
        }
        if (x.nasycene > (x.tuk ?? Infinity) + 0.1) s += 1;
        if (x.cukry > (x.sacharidy ?? Infinity) + 0.1) s += 1;
        if (x.sul > 10) s += 1;
        if ((x.tuk || 0) + (x.sacharidy || 0) + (x.bilkoviny || 0) + (x.vlaknina || 0) + (x.sul || 0) > 100) s += 2;
        s += Object.keys(akt).filter(k => akt[k] !== n[k]).length * 0.03;   // změna jen když pomůže
        if (s < nejS) { nejS = s; nej = akt; }
        return;
      }
      for (const v of vol[i]) zkus(i + 1, { ...akt, [kl[i]]: v });
    };
    zkus(0, {});
    const zmeny = [];
    for (const k of kl) { if (nej && nej[k] !== undefined && nej[k] !== n[k]) { n[k] = zaokrouhli(nej[k], k === 'sul' ? 2 : 1); zmeny.push(k); } }
    for (const k of Object.keys(n)) if (k !== 'kcal' && n[k] > 100) delete n[k];
    return zmeny;
  }
  function rozeberEtiketu(text) {
    const radky = String(text || '').split(/\r?\n/).map(r => opravCislaOcr(r).toLowerCase()).filter(r => r.trim());
    const n = {}, bezCarky = {};
    let posledniBezCarky = false;
    const cislo1 = s => {
      const m = s.match(/(<\s*)?(\d{1,4}(?:[ \u00a0]\d{3})?(?:[.,]\d{1,3})?)\s*(mg|g)?\b/);
      if (!m) return null;
      let c = m[2].replace(/[ \u00a0]/g, '');
      if (/^0\d+$/.test(c)) c = '0.' + c.slice(1);        // „09 g“ = 0,9 g (čárka se ztratila)
      let v = cislo(c);
      if (v === null) return null;
      posledniBezCarky = !/[.,]/.test(c) && !m[1];
      if (m[1]) v = 0;                      // „< 0,5 g“ → prakticky nula
      if (m[3] === 'mg') v /= 1000;
      return v;
    };
    // energie: kJ a kcal kdekoli v řádcích s „energ“/„kj“/„kcal“
    for (const r of radky) {
      if (!/energ|kj|kcal|brennwert|wartość/.test(r)) continue;
      const kcal = r.match(/(\d{1,4}(?:[.,]\d)?)\s*kcal/);
      const kj = r.match(/(\d{2,5}(?:[.,]\d)?)\s*kj/);
      const dvojice = r.match(/kj\s*\/\s*kcal\D*(\d{2,5})\s*\/\s*(\d{1,4})/);
      if (dvojice) { n.kcal = cislo(dvojice[2]); break; }
      if (kcal) { n.kcal = cislo(kcal[1]); break; }
      if (kj && n.kcal === undefined) n.kcal = zaokrouhli(cislo(kj[1]) / 4.184, 0);
    }
    for (const r of radky) {
      const nr = norm(r);
      for (const [kl, re] of ETIKETA) {
        if (n[kl] !== undefined) continue;
        const m = re.exec(nr) || re.exec(r);
        if (!m) continue;
        if (kl === 'tuk' && ETIKETA[0][1].test(nr)) continue;          // řádek nasycených
        if (kl === 'sacharidy' && ETIKETA[1][1].test(nr)) continue;     // řádek cukrů
        if (kl === 'sul' && /sodik|natri|sodium/.test(nr)) continue;
        const v = cislo1(r.slice(Math.max(0, m.index)).replace(/^[^\d<]*/, ''));
        // čísla bez čárky si poznamenat – OCR malou desetinnou čárku často ztratí („3,1 g“ → „31 g“)
        if (v !== null && v >= 0 && (v <= 100 || posledniBezCarky)) { n[kl] = zaokrouhli(v, kl === 'sul' ? 2 : 1); if (posledniBezCarky) bezCarky[kl] = true; }
        break;
      }
      // sodík místo soli
      if (n.sul === undefined && /sodik|sodík|natrium|sodium/.test(nr)) { const v = cislo1(r.replace(/^[^\d<]*/, '')); if (v !== null && v <= 40) n.sul = zaokrouhli(v * 2.5, 2); }
    }
    const opraveno = opravCarky(n, bezCarky);
    const ml = /100\s*ml/.test(radky.join(' '));
    const nalezeno = Object.keys(n).length;
    return { n, ml, nalezeno, sedi: energieSedi(n), opraveno };
  }

  /* ---------- jídelníček a nákupní seznam ---------- */
  function pridejDoPlanu(stav, k, jidlo, polozka) {
    if (!zKlice(k)) throw new Error('Neplatný den');
    const x = { id: noveId('n'), j: jidlo, druh: polozka.druh };
    if (polozka.druh === 'r') { if (!vlastniKlic(stav.recepty, polozka.ref)) throw new Error('Recept neexistuje'); x.ref = polozka.ref; x.porci = cislo(polozka.porci) > 0 ? cislo(polozka.porci) : 1; }
    else if (polozka.druh === 's') { if (!vlastniKlic(stav.sablony, polozka.ref)) throw new Error('Uložené jídlo neexistuje'); x.ref = polozka.ref; x.porci = cislo(polozka.porci) > 0 ? cislo(polozka.porci) : 1; }
    else if (polozka.druh === 'f') { const g = cislo(polozka.g); if (!(g > 0)) throw new Error('Neplatné množství'); x.f = snimek(polozka.f); x.g = zaokrouhli(g, 1); }
    else throw new Error('Neznámá položka plánu');
    (stav.plan[k] = stav.plan[k] || []).push(x);
    return x;
  }
  function smazZPlanu(stav, k, id) {
    if (!stav.plan[k]) return;
    stav.plan[k] = stav.plan[k].filter(x => x.id !== id);
    if (!stav.plan[k].length) delete stav.plan[k];
  }
  // položka plánu → {nazev, ziviny, suroviny: [{f, g}]} (recept a uložené jídlo se rozloží na suroviny)
  function rozvinPolozkuPlanu(stav, x) {
    if (x.druh === 'r') {
      const r = vlastniKlic(stav.recepty, x.ref) ? stav.recepty[x.ref] : null;
      if (!r) return null;
      const v = spocitejRecept(r), podil = x.porci / v.porci;
      const ziv = {}; for (const k in v.celkem) ziv[k] = v.celkem[k] * podil;
      return { nazev: r.nazev, popis: pocet(x.porci, 'porce', 'porce', 'porcí'), ziviny: ziv, suroviny: r.suroviny.map(s => ({ f: s.f, g: s.g * podil })) };
    }
    if (x.druh === 's') {
      const s = vlastniKlic(stav.sablony, x.ref) ? stav.sablony[x.ref] : null;
      if (!s) return null;
      const ziv = {}; for (const p of s.polozky) secti(ziv, zivinyZa(p.f.n, p.g * x.porci));
      return { nazev: s.nazev, popis: x.porci !== 1 ? x.porci + '×' : '', ziviny: ziv, suroviny: s.polozky.filter(p => !p.rychly).map(p => ({ f: p.f, g: p.g * x.porci })) };
    }
    if (x.druh === 'f') return { nazev: x.f.nazev, popis: zaokrouhli(x.g, 0) + (x.f.ml ? ' ml' : ' g'), ziviny: zivinyZa(x.f.n, x.g), suroviny: [{ f: x.f, g: x.g }] };
    return null;
  }
  function souhrnPlanuDne(stav, k) {
    const c = {};
    for (const x of stav.plan[k] || []) { const p = rozvinPolozkuPlanu(stav, x); if (p) secti(c, p.ziviny); }
    return c;
  }
  // zapsat naplánovaný den do deníku (recept jako porce receptu, uložené jídlo po položkách)
  function zapisPlanDoDeniku(stav, k) {
    let n = 0;
    for (const x of stav.plan[k] || []) {
      if (x.druh === 'r' && vlastniKlic(stav.recepty, x.ref)) {
        const f = receptJakoPotravina(stav.recepty[x.ref]);
        pridejZaznam(stav, k, x.j, f, f.porce[0].g * x.porci, { porce: { n: f.porce[0].n, pocet: x.porci } }); n++;
      } else if (x.druh === 's' && vlastniKlic(stav.sablony, x.ref)) n += pouzijSablonu(stav, x.ref, k, x.j, x.porci).length;
      else if (x.druh === 'f') { pridejZaznam(stav, k, x.j, x.f, x.g); n++; }
    }
    return n;
  }
  // nákupní seznam za dny [od, do]: suroviny sečtené podle potraviny, seřazené podle skupiny a názvu
  function nakupniSeznam(stav, od, doK) {
    const m = new Map();
    for (let k = od; k <= doK; k = posunDen(k, 1)) {
      for (const x of stav.plan[k] || []) {
        const p = rozvinPolozkuPlanu(stav, x);
        if (!p) continue;
        for (const s of p.suroviny) {
          if (!s.f || !(s.g > 0)) continue;
          const kl = s.f.id || s.f.nazev;
          const y = m.get(kl) || { f: s.f, g: 0, pouzito: 0 };
          y.g += s.g; y.pouzito++;
          m.set(kl, y);
        }
      }
    }
    const poradi = Object.keys(SKUPINY);
    return [...m.values()].map(y => {
      const kus = (y.f.porce || []).find(p => /^(střední kus|kus)\b/.test(p.n) && p.g >= 20);
      return { ...y, g: zaokrouhli(y.g, 0), kusu: kus ? Math.ceil(y.g / kus.g - 0.15) : null, skupina: y.f.skupina || 'ostatni' };
    }).sort((a, b) => (poradi.indexOf(a.skupina) - poradi.indexOf(b.skupina)) || a.f.nazev.localeCompare(b.f.nazev, 'cs'));
  }
  // standardní nápoj = 10 g čistého alkoholu (malé pivo, deci vína, panák destilátu)
  function standardniNapoje(gAlk) { return (gAlk || 0) / 10; }
  // nejčastější nápoje za posledních `dni` dní (pro rychlé tlačítka u pitného režimu)
  function casteNapoje(stav, k, dni, limit) {
    const od = posunDen(k, -(dni || 30));
    const pocet = new Map();
    for (const den of Object.keys(stav.dny)) {
      if (den < od || den > k) continue;
      for (const z of stav.dny[den].z) {
        const f = stav.potraviny[z.p];
        if (!f || z.rychly || !druhNapoje(f) || !Number.isFinite(f.n.kcal)) continue;
        const x = pocet.get(f.id) || { f, n: 0, g: z.g, porce: z.porce, t: -1 };
        x.n++;
        if ((z.t || 0) >= x.t) { x.t = z.t || 0; x.g = z.g; x.porce = z.porce; x.f = f; }
        pocet.set(f.id, x);
      }
    }
    return [...pocet.values()].sort((a, b) => b.n - a.n || b.t - a.t).slice(0, limit || 3);
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
    // nápoje: tekuté kalorie, alkohol, pitný režim
    const n = zapsane.length || 1;
    const tekute = { kcal: 0, cukry: 0, ml: 0 };
    let alkCelkem = 0, dnyBezAlk = 0, alkMax = 0, pitny = 0;
    for (const d of zapsane) {
      tekute.kcal += d.s.tekute.kcal; tekute.cukry += d.s.tekute.cukry; tekute.ml += d.s.tekute.ml;
      alkCelkem += d.s.alk; alkMax = Math.max(alkMax, d.s.alk);
      if (d.s.alk < 0.5) dnyBezAlk++;
      pitny += d.s.voda + d.s.napoje;
    }
    const napoje = {
      kcal: tekute.kcal / n, cukry: tekute.cukry / n, ml: tekute.ml / n,
      podil: prumer.kcal > 0 ? tekute.kcal / n / prumer.kcal : 0,
      alk: alkCelkem / n, alkMax, alkTydne: alkCelkem / Math.max(1, dny.length) * 7, dnyBezAlk, pitny: pitny / n,
    };
    return { dny, zapsanych: zapsane.length, prumer, top, napoje };
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
    const radky = [['datum', 'počet položek', ...kl.map(k => ZIV[k].n + ' (' + ZIV[k].j + ')'), 'voda vypitá (ml)', 'nápoje z deníku (ml)', 'alkohol (g)', 'tekuté kalorie (kcal)', 'pohyb (kcal)', 'hmotnost (kg)', 'poznámka'].join(';')];
    for (const k of dny) {
      const s = souhrnDne(stav, k);
      const d = stav.dny[k] || {};
      if (!s.pocet && !s.voda && !s.pohyb && !d.pozn && stav.vahy[k] === undefined) continue;
      radky.push([k, s.pocet, ...kl.map(x => Number.isFinite(s.celkem[x]) ? String(zaokrouhli(s.celkem[x], ZIV[x].d + 1)).replace('.', ',') : ''),
        s.voda ? Math.round(s.voda) : '', s.napoje ? Math.round(s.napoje) : '', s.alk >= 0.05 ? String(zaokrouhli(s.alk, 1)).replace('.', ',') : '', s.tekute.kcal >= 0.5 ? Math.round(s.tekute.kcal) : '', s.pohyb ? Math.round(s.pohyb) : '', stav.vahy[k] !== undefined ? String(stav.vahy[k]).replace('.', ',') : '', d.pozn || ''].map(csvPole).join(';'));
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
  // záznamy deníku (nebo položky { f, g }) → položky se snímky potravin
  function polozkyZaznamu(stav, zaznamy) {
    return (zaznamy || []).map(z => {
      const f = z.f || stav.potraviny[z.p];
      if (!f || !(cislo(z.g) > 0)) return null;
      const p = { f: snimek(f), g: cislo(z.g) };
      if (z.porce) p.porce = { n: String(z.porce.n), pocet: cislo(z.porce.pocet) };
      if (z.rychly) p.rychly = true;
      return p;
    }).filter(Boolean);
  }
  function ulozSablonu(stav, nazev, zaznamy, id) {
    if (!nazev || !String(nazev).trim()) throw new Error('Chybí název');
    const polozky = polozkyZaznamu(stav, zaznamy);
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
  /* ---------- doplňky správce (společná databáze data/doplnky.json) ---------- */
  // Správce vytvoří potravinu jako vlastní, vyexportuje ji a skript ji sloučí do doplnky.json.
  // Doplněk má id 'd' + EAN (nebo otisk názvu a značky), takže se nemíchá s vlastními 'm…' uživatelů.
  const FORMAT_DOPLNKY = 'denik-doplnky';
  function idDoplnku(f) {
    const ean = String(f.ean || '').replace(/\D/g, '');
    const n = s => norm(s || '').replace(/\s+/g, ' ').trim();
    return 'd' + (ean || hash(n(f.nazev) + '|' + n(f.znacka)));
  }
  function doplnekZVlastni(f) {
    const x = { id: idDoplnku(f), nazev: String(f.nazev || '').trim().slice(0, 120), znacka: String(f.znacka || '').trim().slice(0, 40), n: {} };
    if (f.ean) x.ean = String(f.ean).replace(/\D/g, '');
    for (const k in (f.n || {})) if (ZIV[k] && Number.isFinite(f.n[k])) x.n[k] = f.n[k];
    if (f.ml) x.ml = true;
    if (f.ml && f.druh && DRUHY_NAPOJU[f.druh]) x.druh = f.druh;
    if (f.skupina && f.skupina !== 'vlastni' && SKUPINY[f.skupina]) x.skupina = f.skupina;
    const porce = (f.porce || []).filter(p => p && p.n && cislo(p.g) > 0).map(p => ({ n: String(p.n).slice(0, 40), g: cislo(p.g) }));
    if (porce.length) x.porce = porce;
    x.zmeneno = datumKlic(new Date());
    return x;
  }
  // kontrola položky doplňků; vrací seznam chyb (prázdný = v pořádku)
  function overDoplnek(x) {
    if (!x || typeof x !== 'object') return ['Položka není objekt'];
    const chyby = overPotravinu(x);
    if (typeof x.id !== 'string' || !/^d[0-9a-z]{1,24}$/.test(x.id)) chyby.push('Neplatné id (čekám d + EAN nebo otisk)');
    if (x.ean && !/^\d{8}$|^\d{12,14}$/.test(x.ean)) chyby.push('EAN musí mít 8 nebo 12–14 číslic');
    if (x.n && typeof x.n === 'object') for (const k in x.n) if (!ZIV[k]) chyby.push('Neznámá živina „' + k + '“');
    if (x.porce !== undefined && (!Array.isArray(x.porce) || x.porce.some(p => !p || typeof p.n !== 'string' || !(cislo(p.g) > 0)))) chyby.push('Neplatné porce');
    if (x.druh !== undefined && !DRUHY_NAPOJU[x.druh]) chyby.push('Neznámý druh nápoje');
    if (x.skupina !== undefined && !SKUPINY[x.skupina]) chyby.push('Neznámá skupina');
    if (x.odhad !== undefined && typeof x.odhad !== 'boolean') chyby.push('Příznak odhad musí být true/false');
    if (x.zdroj !== undefined && typeof x.zdroj !== 'string') chyby.push('Zdroj musí být text');
    if (Number.isFinite(x.n && x.n.kcal) && energieSedi(x.n) === false) chyby.push('Energie nesedí s makroživinami (zkontroluj opis)');
    return chyby;
  }
  // potravina pro aplikaci z položky doplňků (typ 'd')
  function doplnekZDat(x) {
    const f = {
      id: x.id, typ: 'd', nazev: x.nazev, znacka: x.znacka || '', n: { ...x.n }, porce: (x.porce || []).map(p => ({ n: p.n, g: cislo(p.g) })),
      ml: !!x.ml, skupina: x.skupina || 'ostatni', priznaky: (x.ml ? 4 : 0) | (x.druh ? 256 : 0), skeny: 0, zdroj: 'správce', zmeneno: x.zmeneno || '',
    };
    if (x.ean) f.ean = x.ean;
    if (x.druh) f.druh = x.druh;
    if (x.odhad) f.odhad = true;
    if (typeof x.zdroj === 'string') f.zdrojText = x.zdroj.slice(0, 300);
    return doplnNapoj(f);
  }
  function exportDoplnku(seznam) {
    return JSON.stringify({ format: FORMAT_DOPLNKY, verze: 1, vytvoreno: new Date().toISOString(), polozky: seznam.map(doplnekZVlastni) }, null, 1);
  }
  // celý nový soubor doplňků: ponechané zveřejněné položky + vlastní potraviny ke sdílení (ty mají přednost)
  function sestavDoplnky(ponechat, sdilet) {
    return slucDoplnky({ polozky: ponechat || [] }, { polozky: (sdilet || []).map(doplnekZVlastni) });
  }
  // sloučení exportu do stávajících doplňků: stejné id nebo EAN = aktualizace (id zůstane původní)
  function slucDoplnky(stare, nove) {
    const polozky = (stare && Array.isArray(stare.polozky) ? stare.polozky : []).map(x => ({ ...x }));
    const vys = { pridano: [], zmeneno: [], chyby: [] };
    for (const x of (nove && Array.isArray(nove.polozky) ? nove.polozky : [])) {
      const ch = overDoplnek(x);
      if (ch.length) { vys.chyby.push((x && x.nazev ? x.nazev : '?') + ': ' + ch.join('; ')); continue; }
      const i = polozky.findIndex(p => p.id === x.id || (x.ean && p.ean === x.ean));
      if (i >= 0) {
        // beze změny obsahu → ponechat původní datum (a nehlásit jako změnu)
        const stabil = o => Array.isArray(o) ? '[' + o.map(stabil).join(',') + ']'
          : o && typeof o === 'object' ? '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stabil(o[k])).join(',') + '}' : JSON.stringify(o);
        const bez = o => stabil({ ...o, id: '', zmeneno: '' });
        if (bez(polozky[i]) === bez(x)) continue;
        // zdroj hodnot a příznak odhadu export z vlastní potraviny nenese – zachovat původní
        const st = polozky[i];
        polozky[i] = { ...(st.zdroj ? { zdroj: st.zdroj } : {}), ...(st.odhad ? { odhad: st.odhad } : {}), ...x, id: st.id }; vys.zmeneno.push(x.nazev);
      }
      else { polozky.push({ ...x }); vys.pridano.push(x.nazev); }
    }
    polozky.sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
    return { data: { format: FORMAT_DOPLNKY, verze: 1, zmeneno: datumKlic(new Date()), polozky }, ...vys };
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
    if (x.ml && f.druh && DRUHY_NAPOJU[f.druh]) x.druh = f.druh;
    if (f.sdilet) x.sdilet = true;   // správce: sdílet ve společné databázi
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
  function overN(n, volne) {
    const v = {};
    if (!n || typeof n !== 'object') return v;
    // na 100 g: energie nejvýš 1000 kcal (čistý tuk 900), gramové živiny nejvýš 100 g; tablety mají mikroživin hodně, proto jen hrubá mez.
    // Rychlé záznamy (typ q) nesou hodnoty za celou porci – u nich jen hrubá mez.
    const max = k => (volne ? 1e6 : k === 'kcal' ? 1000 : ZIV[k].j === 'g' ? 100 : 1e7);
    for (const k of Object.keys(n)) if (ZIV[k] && Number.isFinite(n[k]) && n[k] >= 0 && n[k] <= max(k)) v[k] = n[k];
    return v;
  }
  function overSnimek(f) {
    if (!f || typeof f !== 'object' || typeof f.nazev !== 'string' || !f.nazev) return null;
    const s = { ...f, nazev: f.nazev.slice(0, 160), n: overN(f.n, f.typ === 'q') };
    if (s.druh !== undefined && !DRUHY_NAPOJU[s.druh]) delete s.druh;
    if (s.porce !== undefined) s.porce = Array.isArray(s.porce) ? s.porce.filter(p => p && typeof p.n === 'string' && cislo(p.g) > 0).map(p => ({ n: p.n, g: cislo(p.g) })) : [];
    return s;
  }
  function overRecept(r) {
    if (!r || typeof r !== 'object' || typeof r.nazev !== 'string' || !r.nazev.trim() || !Array.isArray(r.suroviny)) return null;
    const suroviny = r.suroviny.map(s => s && overSnimek(s.f) && cislo(s.g) > 0 ? { f: overSnimek(s.f), g: cislo(s.g) } : null).filter(Boolean);
    if (!suroviny.length) return null;
    return { ...r, suroviny, porci: Math.max(1, Math.round(cislo(r.porci) || 1)) };
  }
  // záznam pohybu: jen známá pole v rozumném rozsahu
  function overPohyb(p, k, i) {
    if (!p || typeof p !== 'object') return null;
    const kcal = cislo(p.kcal);
    if (kcal === null || kcal < 0 || kcal > 20000) return null;
    const v = { id: typeof p.id === 'string' && p.id ? p.id : 'p' + hash(k + '#' + i + (p.nazev || '') + kcal + (p.minuty || '')),
      nazev: (typeof p.nazev === 'string' && p.nazev.trim() ? p.nazev.trim() : 'Aktivita').slice(0, 80), kcal };
    const c = (x, min, max) => { const n = cislo(x); return n !== null && n >= min && n <= max ? n : null; };
    const m = c(p.minuty, 0.5, 1440); if (m !== null) v.minuty = m;
    if (typeof p.kod === 'string' && /^\d{5}$/.test(p.kod)) v.kod = p.kod;
    const met = c(p.met, 0.5, 30); if (met !== null) v.met = met;
    const km = c(p.km, 0.01, 1000); if (km !== null) v.km = km;
    const kr = c(p.kroky, 1, 300000); if (kr !== null) v.kroky = Math.round(kr);
    const b = c(p.brutto, 0, 30000); if (b !== null) v.brutto = b;
    if (p.sila === true) v.sila = true;
    if (p.ruc === true) v.ruc = true;
    if (INTENZITA.some(x => x.k === p.int)) v.int = p.int;
    return v;
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
      if (['t1', 't2', 't3', 'koj'].includes(p.stav)) s.profil.stav = p.stav;
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
      if (!['bezny', 'prisny', 'vse'].includes(s.nastaveni.pitnyRezim)) delete s.nastaveni.pitnyRezim;
      if (!['100', '112', '125', '140'].includes(s.nastaveni.pismo)) delete s.nastaveni.pismo;
      if (s.nastaveni.energie !== 'kj') delete s.nastaveni.energie;
      if (s.nastaveni.spravce !== true) delete s.nastaveni.spravce;
      for (const k of ['online', 'obrazky', 'mikro', 'pohybKCili', 'napojeDoVody', 'infoOnline', 'infoPlocha', 'bezHodnot']) {
        if (k in s.nastaveni && typeof s.nastaveni[k] !== 'boolean') { if (k in novyStav().nastaveni) s.nastaveni[k] = novyStav().nastaveni[k]; else delete s.nastaveni[k]; }
      }
      for (const k of ['zaloha', 'uklid']) if (k in s.nastaveni && !(typeof s.nastaveni[k] === 'string' && zKlice(s.nastaveni[k]))) delete s.nastaveni[k];
      if ('skrytZalohu' in s.nastaveni && s.nastaveni.skrytZalohu !== true && !(typeof s.nastaveni.skrytZalohu === 'string' && zKlice(s.nastaveni.skrytZalohu))) delete s.nastaveni.skrytZalohu;
      { const kr = cislo(s.nastaveni.krok); if (!(kr >= 30 && kr <= 150)) delete s.nastaveni.krok; }
      s.nastaveni.pitnyVyjimky = mapa(s.nastaveni.pitnyVyjimky, v => typeof v === 'boolean' ? v : null);
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
    for (const k of Object.keys(s.sablony)) s.sablony[k].id = k;
    s.planNakup = mapa(x.planNakup, (v, k) => zKlice(k) && Array.isArray(v) ? v.filter(z => typeof z === 'string').slice(0, 500) : null);
    s.plan = mapa(x.plan, (seznam, k) => {
      if (!zKlice(k) || !Array.isArray(seznam)) return null;
      const ok = seznam.filter(p => p && typeof p.j === 'string' && (
        ((p.druh === 'r' || p.druh === 's') && vlastniKlic(p.druh === 'r' ? s.recepty : s.sablony, p.ref) && cislo(p.porci) > 0) ||
        (p.druh === 'f' && overSnimek(p.f) && cislo(p.g) > 0)))
        .map(p => p.druh === 'f' ? { id: typeof p.id === 'string' ? p.id : noveId('n'), j: p.j, druh: 'f', f: overSnimek(p.f), g: cislo(p.g) }
          : { id: typeof p.id === 'string' ? p.id : noveId('n'), j: p.j, druh: p.druh, ref: p.ref, porci: cislo(p.porci) });
      return ok.length ? ok : null;
    });   // id vždy podle klíče (ručně upravené zálohy)
    s.vahy = mapa(x.vahy, (v, k) => zKlice(k) && cislo(v) >= 25 && cislo(v) <= 350 ? cislo(v) : null);
    if (Array.isArray(x.oblibene)) s.oblibene = x.oblibene.filter(v => typeof v === 'string');
    if (x.dny && typeof x.dny === 'object') {
      for (const k of Object.keys(x.dny)) {
        const d = x.dny[k];
        if (!zKlice(k) || !d || typeof d !== 'object') continue;
        const dd = den(s, k);
        dd.z = (Array.isArray(d.z) ? d.z : []).filter(z => z && typeof z.p === 'string' && cislo(z.g) > 0 && cislo(z.g) <= 100000 && Object.prototype.hasOwnProperty.call(s.potraviny, z.p))
          .map(z => ({ ...z, j: typeof z.j === 'string' ? z.j : 'snidane', g: cislo(z.g), id: typeof z.id === 'string' ? z.id : noveId('z'), t: cislo(z.t) || 0 }));
        dd.voda = Math.min(20000, Math.max(0, cislo(d.voda) || 0));
        // id pohybů bez id odvozené i z pořadí – dva shodné pohyby nesmí splynout
        dd.pohyb = Array.isArray(d.pohyb) ? d.pohyb.map((p, i) => overPohyb(p, k, i)).filter(Boolean) : [];
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
    for (const k in zdroj.plan || {}) {
      const c = (cil.plan[k] = cil.plan[k] || []);
      for (const p of zdroj.plan[k]) if (!c.some(x => x.id === p.id)) c.push(p);
    }
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
      // poznámky: obsahuje-li jedna druhou, zůstane delší; jinak se spojí (žádný text se neztratí)
      if (d.pozn && d.pozn !== dd.pozn) {
        if (!dd.pozn || d.pozn.includes(dd.pozn)) dd.pozn = d.pozn;
        else if (!dd.pozn.includes(d.pozn)) dd.pozn = (dd.pozn + '\n' + d.pozn).slice(0, 2000);
      }
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
    FORMAT_DOPLNKY, sestavDoplnky, idDoplnku, doplnekZVlastni, overDoplnek, doplnekZDat, exportDoplnku, slucDoplnky,
    VERZE_KODU: '2026-10-28a', FORMAT, VERZE_FORMATU, ZIVINY, ZIV, ZAKLAD, MIKRO, SKUPINY, JIDLA_VYCHOZI, AKTIVITA, EFSA_DOSPELI,
    norm, cislo, zaokrouhli, formatCislo, noveId, hash, tvar, pocet,
    datumKlic, zKlice, posunDen, rozdilDni, popisDne,
    eanKontrola, eanVarianty, eanZeme,
    vyrobekZRadku, surovinaZRadku, vyrobekZOff, obrazekUrl,
    zivinyZa, secti, energieSedi, energieZMaker, podilEnergie,
    vytvorIndex, hledej,
    vek, bmr, bmi, bmiPopis, cile,
    novyStav, klicSnimku, snimek, den, pridejZaznam, rychlyZaznam, najdiZaznam, smazZaznam, presunZaznam,
    kopirujJidlo, kopirujDen, castePrJidlo, casteNapoje, tipyNaZiviny, rozeberSuroviny, gramySuroviny, tvaryNazvu, najdiSurovinu,
    prevodVahy, prepocetVahy, nastavPrevody, PREVODY_VAHY, namerenaVarianta, PAROVANI_ODHADU, rozeberEtiketu, pridejDoPlanu, smazZPlanu, rozvinPolozkuPlanu, souhrnPlanuDne, zapisPlanDoDeniku, nakupniSeznam, DRUHY_NAPOJU, druhNapoje, doplnNapoj, vychoziPorceNapoje, doPitnehoRezimu, standardniNapoje, zivinyZaznamu, souhrnDne, statistika, odhadVydeje, serie, nedavne, caste, uklid,
    overPotravinu, ulozVlastni, spocitejRecept, ulozRecept, receptJakoPotravina,
    exportJson, importJson, normalizujStav, overPohyb, slucStav, exportCsv, exportSouhrnyCsv, zdrojeZiviny,
    rozeberTabulkuJidel, importujPolozky,
    UCINKY, UCINKY_ZDROJ, vyskytZiviny, nejlepsiZdroje,
    FORMAT_SDILENI, balikSdileni, zBalikuSdileni, ulozSdilene, pridejSdileneDoDne,
    INTENZITA, intenzitaMet, pripravPohyby, rychlostPohybu, popisRychlosti, tempoMinKm, pohybPodleRychlosti, hmotnostKDni, energiePohybu, vypoctiPohyb, nedavnePohyby, tydenPohybu, dvojiPohyb, hledejPohyb,
    ulozSablonu, pouzijSablonu, souhrnSablony, vzdalenost, kontrolaAlergenu, slucAlergeny, ALERGENY, porovnej,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.DENIK_JADRO = API;
})(typeof window !== 'undefined' ? window : this);
