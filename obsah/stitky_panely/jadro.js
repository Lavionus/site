/* ============================================================
   Štítky a čelní panely – výpočetní jádro (bez DOM, testovatelné v node).

   Souřadnice: milimetry, počátek v levém horním rohu panelu, osa y dolů
   (stejně jako SVG). Úhel otočení prvku: ve stupních, kladný = po směru
   hodinových ručiček na obrazovce.

   Prvek  → primitiva (lokálně kolem kotvy) → transformace (x, y, rot)
   Primitivum:
     {t:'kruh', cx, cy, r, role, tah, vypln}
     {t:'cesta', p:[['M',x,y],['L',x,y],['A',r,x,y,velky,cw],['C',x1,y1,x2,y2,x,y],['Z']], role, tah, vypln}
     {t:'text', x, y, text, vel, zarov, tucne, rot, role}   (y = střed výšky verzálek)
   role: 'cut' = řez/otvor k výrobě, 'graf' = potisk/gravírování,
         'pom' = pomocné (kóty, poznámky), 'nahled' = jen v editoru (zábor knoflíku…)
   ============================================================ */
(function () {
  'use strict';

  const MM_NA_PT = 72 / 25.4;
  const HP = 5.08;
  const U19 = 44.45;
  const EURO_3U = 128.5;
  const PALEC = 25.4;

  function mmNaPt(mm) { return mm * 72 / 25.4; }
  function ptNaMm(pt) { return pt * 25.4 / 72; }
  const rad = (s) => s * Math.PI / 180;
  const zaokr = (x, d = 6) => { const m = Math.pow(10, d); const v = Math.round(x * m) / m; return Object.is(v, -0) ? 0 : v; };

  /* ---------- čísla v češtině ---------- */
  function fmt(x, des = 2, orez = true) {
    if (!isFinite(x)) return '–';
    let s = (Math.abs(x) < Math.pow(10, -des) / 2 ? 0 : x).toFixed(des);
    if (orez && s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s.replace('.', ',').replace('-', '−');
  }

  /* Výraz z pole: desetinná čárka i tečka, + − * / ( ), jednotky mm, cm, in, hp, u.
     „128,5/2“ → 64,25; „8hp“ → 40,64; „1in“ → 25,4. Chyba → NaN. */
  function vyraz(str) {
    if (typeof str === 'number') return str;
    if (str == null) return NaN;
    const s = String(str).trim().toLowerCase().replace(/[−–]/g, '-').replace(/×/g, '*').replace(/\s+/g, '');
    if (!s) return NaN;
    let i = 0;
    const JEDN = { mm: 1, cm: 10, in: PALEC, '"': PALEC, hp: HP, u: U19 };
    function cislo() {
      const m = /^(\d+(?:[.,]\d*)?|[.,]\d+)/.exec(s.slice(i));
      if (!m) throw new Error('číslo');
      i += m[0].length;
      let v = parseFloat(m[0].replace(',', '.'));
      const j = /^(mm|cm|in|hp|u|")/.exec(s.slice(i));
      if (j) { v *= JEDN[j[1]]; i += j[0].length; }
      return v;
    }
    function faktor() {
      if (s[i] === '-') { i++; return -faktor(); }
      if (s[i] === '+') { i++; return faktor(); }
      if (s[i] === '(') { i++; const v = soucet(); if (s[i] !== ')') throw new Error(')'); i++; return v; }
      return cislo();
    }
    function soucin() {
      let v = faktor();
      while (s[i] === '*' || s[i] === '/') { const o = s[i++]; const w = faktor(); v = o === '*' ? v * w : v / w; }
      return v;
    }
    function soucet() {
      let v = soucin();
      while (s[i] === '+' || s[i] === '-') { const o = s[i++]; const w = soucin(); v = o === '+' ? v + w : v - w; }
      return v;
    }
    try { const v = soucet(); if (i !== s.length) return NaN; return isFinite(v) ? v : NaN; } catch (e) { return NaN; }
  }

  /* ---------- normy a šablony ---------- */
  function eurorackSirka(hp) { return hp * HP - 0.3; }
  /* Montážní otvory Eurorack podle Doepfer A-100: Ø 3,2 mm, 7,5 mm od levého okraje,
     3 mm od horního a dolního okraje; od 7 HP i druhý pár v x = 7,5 + (HP − 3)·5,08. */
  function eurorackOtvory(hp, vyska = EURO_3U) {
    const xs = [7.5];
    if (hp >= 7) xs.push(7.5 + (hp - 3) * HP);
    const o = [];
    for (const x of xs) for (const y of [3, vyska - 3]) o.push({ x: zaokr(x), y: zaokr(y), d: 3.2 });
    return o;
  }
  function rack19Vyska(u) { return u * U19 - 0.8; }
  /* Otvory 19" (EIA-310): rozteč středů 465,1 mm vodorovně, svisle na pozicích
     6,35 a 38,1 mm od hranice U (panel začíná 0,4 mm pod ní). U 1U oba otvory,
     u vyšších krajní (první U nahoře, poslední dole). */
  function rack19Otvory(u, sirka = 482.6, rozpeti = 465.1, d = 6.4) {
    const x1 = (sirka - rozpeti) / 2, x2 = sirka - x1;
    const ys = [6.35 - 0.4, (u - 1) * U19 + 38.1 - 0.4];
    const o = [];
    for (const x of [x1, x2]) for (const y of ys) o.push({ x: zaokr(x), y: zaokr(y), d });
    return o;
  }

  const SABLONY = [
    { id: 'euro3u', kat: 'Eurorack', nazev: 'Eurorack 3U (128,5 mm)', param: [{ k: 'hp', nazev: 'Šířka (HP)', vychozi: 8, min: 1, max: 104 }],
      vytvor: (p) => ({ panel: { sirka: zaokr(eurorackSirka(p.hp)), vyska: EURO_3U, r: 0, typ: 'eurorack', nazev: `Eurorack ${p.hp} HP` }, otvory: eurorackOtvory(p.hp) }) },
    { id: 'euro1u_ij', kat: 'Eurorack', nazev: 'Eurorack 1U Intellijel (39,65 mm)', param: [{ k: 'hp', nazev: 'Šířka (HP)', vychozi: 8, min: 1, max: 104 }],
      vytvor: (p) => ({ panel: { sirka: zaokr(eurorackSirka(p.hp)), vyska: 39.65, r: 0, typ: 'eurorack1u', nazev: `1U Intellijel ${p.hp} HP` }, otvory: eurorackOtvory(p.hp, 39.65) }) },
    { id: 'euro1u_pl', kat: 'Eurorack', nazev: 'Eurorack 1U Pulp Logic (43,18 mm)', param: [{ k: 'hp', nazev: 'Šířka (HP)', vychozi: 8, min: 1, max: 104 }],
      vytvor: (p) => ({ panel: { sirka: zaokr(eurorackSirka(p.hp)), vyska: 43.18, r: 0, typ: 'eurorack1u', nazev: `1U Pulp Logic ${p.hp} HP` }, otvory: eurorackOtvory(p.hp, 43.18) }) },
    { id: 'rack19', kat: 'Rack', nazev: '19" panel (482,6 mm)', param: [{ k: 'u', nazev: 'Výška (U)', vychozi: 1, min: 1, max: 12 }],
      vytvor: (p) => ({ panel: { sirka: 482.6, vyska: zaokr(rack19Vyska(p.u)), r: 0, typ: 'rack19', nazev: `19" ${p.u}U` }, otvory: rack19Otvory(p.u) }) },
    { id: 'rack10', kat: 'Rack', nazev: '10" panel (254 mm)', param: [{ k: 'u', nazev: 'Výška (U)', vychozi: 1, min: 1, max: 12 }],
      vytvor: (p) => ({ panel: { sirka: 254, vyska: zaokr(rack19Vyska(p.u)), r: 0, typ: 'rack10', nazev: `10" ${p.u}U` }, otvory: rack19Otvory(p.u, 254, 236.5) }) },
    { id: 'h1590a', kat: 'Krabička (víko)', nazev: 'Hammond 1590A – 92,6 × 38,5', pevne: { sirka: 92.6, vyska: 38.5, r: 4 } },
    { id: 'h1590b', kat: 'Krabička (víko)', nazev: 'Hammond 1590B – 112,4 × 60,5', pevne: { sirka: 112.4, vyska: 60.5, r: 4 } },
    { id: 'h125b', kat: 'Krabička (víko)', nazev: 'Hammond 1590N1 / 125B – 121 × 66', pevne: { sirka: 121, vyska: 66, r: 4 } },
    { id: 'h1590bb', kat: 'Krabička (víko)', nazev: 'Hammond 1590BB – 119,5 × 94', pevne: { sirka: 119.5, vyska: 94, r: 4 } },
    { id: 'h1590xx', kat: 'Krabička (víko)', nazev: 'Hammond 1590XX – 145 × 121', pevne: { sirka: 145, vyska: 121, r: 5 } },
    { id: 'h1590dd', kat: 'Krabička (víko)', nazev: 'Hammond 1590DD – 188 × 120', pevne: { sirka: 188, vyska: 120, r: 5 } },
    { id: 'st50x20', kat: 'Štítek', nazev: 'Štítek 50 × 20', pevne: { sirka: 50, vyska: 20, r: 2 } },
    { id: 'st60x30', kat: 'Štítek', nazev: 'Štítek 60 × 30', pevne: { sirka: 60, vyska: 30, r: 2 } },
    { id: 'st70x37', kat: 'Štítek', nazev: 'Samolepka 70 × 37 (arch 3 × 8)', pevne: { sirka: 70, vyska: 37, r: 0 } },
    { id: 'st80x40', kat: 'Štítek', nazev: 'Štítek 80 × 40', pevne: { sirka: 80, vyska: 40, r: 2 } },
    { id: 'st100x60', kat: 'Štítek', nazev: 'Typový štítek 100 × 60', pevne: { sirka: 100, vyska: 60, r: 3 } },
    { id: 'karta', kat: 'Štítek', nazev: 'Karta ID-1 (85,6 × 53,98)', pevne: { sirka: 85.6, vyska: 53.98, r: 3.18 } },
    { id: 'a6', kat: 'Štítek', nazev: 'A6 na šířku (148 × 105)', pevne: { sirka: 148, vyska: 105, r: 0 } },
    { id: 'vlastni', kat: 'Vlastní', nazev: 'Vlastní rozměr', param: [
      { k: 'sirka', nazev: 'Šířka (mm)', vychozi: 100, min: 1, max: 2000 },
      { k: 'vyska', nazev: 'Výška (mm)', vychozi: 50, min: 1, max: 2000 },
      { k: 'r', nazev: 'Rádius rohů (mm)', vychozi: 0, min: 0, max: 500 }],
      vytvor: (p) => ({ panel: { sirka: p.sirka, vyska: p.vyska, r: Math.min(p.r, p.sirka / 2, p.vyska / 2), typ: 'vlastni', nazev: 'Vlastní panel' }, otvory: [] }) },
  ];

  /* Archy samolepek A4 (210 × 297): okraje a rozteče v mm. */
  const ARCHY = [
    { id: 'a4_3x8_70x37', nazev: 'A4 3 × 8 – 70 × 37 (bez okrajů)', sl: 3, ra: 8, w: 70, h: 37, x0: 0, y0: 0.5, dx: 70, dy: 37 },
    { id: 'a4_3x7_70x42', nazev: 'A4 3 × 7 – 70 × 42,3', sl: 3, ra: 7, w: 70, h: 42.3, x0: 0, y0: 0.45, dx: 70, dy: 42.3 },
    { id: 'a4_3x11_70x25', nazev: 'A4 3 × 11 – 70 × 25,4', sl: 3, ra: 11, w: 70, h: 25.4, x0: 0, y0: 8.8, dx: 70, dy: 25.4 },
    { id: 'a4_2x7_99x38', nazev: 'A4 2 × 7 – 99,1 × 38,1 (typ L7163)', sl: 2, ra: 7, w: 99.1, h: 38.1, x0: 4.65, y0: 15.15, dx: 101.6, dy: 38.1 },
    { id: 'a4_3x8_63x34', nazev: 'A4 3 × 8 – 63,5 × 33,9 (typ L7159)', sl: 3, ra: 8, w: 63.5, h: 33.9, x0: 7.2, y0: 12.9, dx: 66, dy: 33.9 },
    { id: 'a4_3x7_63x38', nazev: 'A4 3 × 7 – 63,5 × 38,1 (typ L7160)', sl: 3, ra: 7, w: 63.5, h: 38.1, x0: 7.2, y0: 15.15, dx: 66, dy: 38.1 },
    { id: 'a4_5x13_38x21', nazev: 'A4 5 × 13 – 38,1 × 21,2 (typ L7651)', sl: 5, ra: 13, w: 38.1, h: 21.2, x0: 4.75, y0: 10.7, dx: 40.6, dy: 21.2 },
    { id: 'a4_2x4_105x74', nazev: 'A4 2 × 4 – 105 × 74', sl: 2, ra: 4, w: 105, h: 74, x0: 0, y0: 0.5, dx: 105, dy: 74 },
    { id: 'a4_2x2_105x148', nazev: 'A4 2 × 2 – 105 × 148,5', sl: 2, ra: 2, w: 105, h: 148.5, x0: 0, y0: 0, dx: 105, dy: 148.5 },
    { id: 'a4_1x1', nazev: 'A4 1 × 1 – 210 × 297', sl: 1, ra: 1, w: 210, h: 297, x0: 0, y0: 0, dx: 210, dy: 297 },
  ];
  /* Pozice štítků na archu, po řádcích zleva; start = index prvního volného (0…), pocet = kolik vytisknout. */
  function archPozice(a, start = 0, pocet = Infinity) {
    const n = a.sl * a.ra, out = [];
    for (let i = Math.max(0, start | 0); i < n && out.length < pocet; i++) {
      const s = i % a.sl, r = Math.floor(i / a.sl);
      out.push({ i, sl: s, ra: r, x: zaokr(a.x0 + s * a.dx), y: zaokr(a.y0 + r * a.dy), w: a.w, h: a.h });
    }
    return out;
  }
  function archKontrola(a, strW = 210, strH = 297) {
    const chyby = [];
    if (!(a.sl >= 1 && a.ra >= 1)) chyby.push('Počet sloupců a řádků musí být aspoň 1.');
    if (a.dx < a.w - 1e-9) chyby.push('Vodorovná rozteč je menší než šířka štítku – štítky by se překrývaly.');
    if (a.dy < a.h - 1e-9) chyby.push('Svislá rozteč je menší než výška štítku.');
    const pravy = a.x0 + (a.sl - 1) * a.dx + a.w, spodni = a.y0 + (a.ra - 1) * a.dy + a.h;
    if (pravy > strW + 0.05 || spodni > strH + 0.05 || a.x0 < -0.05 || a.y0 < -0.05) chyby.push('Štítky přesahují arch ' + fmt(strW) + ' × ' + fmt(strH) + ' mm.');
    return chyby;
  }

  /* ---------- katalog součástek (typické hodnoty – ověřte v datasheetu) ---------- */
  // otvory: {t:'kruh', d, x, y} | {t:'d', d, f (vzdálenost plošky od středu), f2 (druhá ploška)} | {t:'obd', w, h, r, x, y} | {t:'dsub', a, h, uhel} | {t:'klic', d, w, r2}
  const KONEKTORY = [
    { id: 'jack35', nazev: 'Jack 3,5 mm (Thonkiconn PJ398SM)', otvory: [{ t: 'kruh', d: 6 }], zabor: 8 },
    { id: 'jack35n', nazev: 'Jack 3,5 mm s maticí M6 (obecný)', otvory: [{ t: 'kruh', d: 6.2 }], zabor: 9 },
    { id: 'jack635', nazev: 'Jack 6,3 mm (Neutrik NMJ, Cliff)', otvory: [{ t: 'kruh', d: 9.5 }], zabor: 13 },
    { id: 'xlrd', nazev: 'XLR / Neutrik D (Ø 24 + 2 × M3)', otvory: [{ t: 'kruh', d: 24 }, { t: 'kruh', d: 3.2, x: -9.5, y: -12 }, { t: 'kruh', d: 3.2, x: 9.5, y: 12 }], zabor: 31 },
    { id: 'bnc', nazev: 'BNC panelový (D 9,7 / 8,9)', otvory: [{ t: 'd', d: 9.7, f: 4.05 }], zabor: 13 },
    { id: 'dc21', nazev: 'Napájecí DC 2,1 / 2,5 mm (Ø 11)', otvory: [{ t: 'kruh', d: 11 }], zabor: 14 },
    { id: 'din5', nazev: 'DIN 5 / MIDI (Ø 15,5 + 2 × M3, rozteč 22,5)', otvory: [{ t: 'kruh', d: 15.5 }, { t: 'kruh', d: 3.2, x: -11.25, y: 0 }, { t: 'kruh', d: 3.2, x: 11.25, y: 0 }], zabor: 27 },
    { id: 'de9', nazev: 'D-SUB DE-9 (orientační výřez + 2 × M3)', otvory: [{ t: 'dsub', a: 19.6, h: 11, uhel: 10 }, { t: 'kruh', d: 3.2, x: -12.5, y: 0 }, { t: 'kruh', d: 3.2, x: 12.5, y: 0 }], zabor: 31 },
    { id: 'iec', nazev: 'Síťový IEC C14 šroubovací (27,5 × 19,5 + 2 × M3)', otvory: [{ t: 'obd', w: 27.5, h: 19.5, r: 1 }, { t: 'kruh', d: 3.2, x: -20, y: 0 }, { t: 'kruh', d: 3.2, x: 20, y: 0 }], zabor: 48 },
    { id: 'banan', nazev: 'Zdířka 4 mm (banánek, M6)', otvory: [{ t: 'kruh', d: 6.2 }], zabor: 11 },
    { id: 'usbc', nazev: 'USB-C panelový (9,2 × 3,6)', otvory: [{ t: 'obd', w: 9.2, h: 3.6, r: 1.6 }], zabor: 11 },
    { id: 'sma', nazev: 'SMA přírubový (Ø 6,5)', otvory: [{ t: 'kruh', d: 6.5 }], zabor: 9 },
  ];
  const OVLADACE = [
    { id: 'pot9', nazev: 'Potenciometr 9 mm Alpha (M7)', otvory: [{ t: 'kruh', d: 7.2 }], zabor: 11 },
    { id: 'pot16', nazev: 'Potenciometr 16 mm (M7)', otvory: [{ t: 'kruh', d: 7.5 }], zabor: 15 },
    { id: 'pot24', nazev: 'Potenciometr 24 mm (3/8")', otvory: [{ t: 'kruh', d: 9.8 }], zabor: 20 },
    { id: 'enk', nazev: 'Enkodér (M7)', otvory: [{ t: 'kruh', d: 7.2 }], zabor: 13 },
    { id: 'prep', nazev: 'Otočný přepínač (3/8")', otvory: [{ t: 'kruh', d: 9.8 }], zabor: 20 },
    { id: 'trimr', nazev: 'Trimr – otvor pro šroubovák', otvory: [{ t: 'kruh', d: 3.5 }], zabor: 5 },
    { id: 'pac6', nazev: 'Páčkový spínač mini (M6)', otvory: [{ t: 'kruh', d: 6.3 }], zabor: 10 },
    { id: 'pac12', nazev: 'Páčkový spínač (M12)', otvory: [{ t: 'kruh', d: 12.2 }], zabor: 16 },
    { id: 'tl7', nazev: 'Tlačítko 7 mm (PBS)', otvory: [{ t: 'kruh', d: 7.2 }], zabor: 10 },
    { id: 'tl12', nazev: 'Tlačítko / antivandal 12 mm', otvory: [{ t: 'kruh', d: 12.2 }], zabor: 15 },
    { id: 'tl16', nazev: 'Tlačítko / antivandal 16 mm', otvory: [{ t: 'kruh', d: 16.2 }], zabor: 19 },
    { id: 'tl19', nazev: 'Tlačítko / antivandal 19 mm', otvory: [{ t: 'kruh', d: 19.2 }], zabor: 22 },
    { id: 'tl22', nazev: 'Průmyslové 22 mm (Ø 22,3 s drážkou)', otvory: [{ t: 'klic', d: 22.3, w: 3.2, r2: 12.95 }], zabor: 30 },
    { id: 'arc24', nazev: 'Arkádové tlačítko 24 mm', otvory: [{ t: 'kruh', d: 24 }], zabor: 30 },
    { id: 'arc30', nazev: 'Arkádové tlačítko 30 mm', otvory: [{ t: 'kruh', d: 30 }], zabor: 35 },
    { id: 'kol', nazev: 'Kolébkový spínač 19,2 × 12,9', otvory: [{ t: 'obd', w: 19.2, h: 12.9, r: 0 }], zabor: 21 },
    { id: 'lcd1602', nazev: 'Okno LCD 16 × 2 (71 × 24 + 4 × M2,5)', otvory: [{ t: 'obd', w: 71, h: 24, r: 0 }, { t: 'kruh', d: 2.7, x: -37.5, y: -15.5 }, { t: 'kruh', d: 2.7, x: 37.5, y: -15.5 }, { t: 'kruh', d: 2.7, x: -37.5, y: 15.5 }, { t: 'kruh', d: 2.7, x: 37.5, y: 15.5 }], zabor: 0 },
    { id: 'oled096', nazev: 'Okno OLED 0,96" (23 × 12)', otvory: [{ t: 'obd', w: 23, h: 12, r: 0 }], zabor: 0 },
  ];
  const SYMBOLY = [
    ['zem', 'Zem (uzemnění)'], ['kostra', 'Kostra / šasi'], ['ochrana', 'Ochranné uzemnění'], ['napajeni', 'Zap/vyp (IEC 5009)'],
    ['vystraha', 'Výstraha'], ['blesk', 'Nebezpečné napětí'], ['sinus', 'Sinus'], ['obdelnik', 'Obdélník (puls)'],
    ['pila', 'Pila'], ['trojuhelnik', 'Trojúhelník'], ['stridave', 'Střídavé ~'], ['ss', 'Stejnosměrné'],
    ['trida2', 'Třída ochrany II'], ['pojistka', 'Pojistka'], ['plus', 'Plus'], ['minus', 'Minus'],
    ['sipka_n', 'Šipka nahoru'], ['sipka_d', 'Šipka dolů'], ['sipka_l', 'Šipka vlevo'], ['sipka_p', 'Šipka vpravo'],
    ['vstup', 'Vstup'], ['vystup', 'Výstup'], ['dioda', 'Dioda / LED'], ['repro', 'Reproduktor'],
  ];
  const ZNACKY = [['tecka', 'Tečka'], ['ryska', 'Ryska'], ['trojuhelnik', 'Trojúhelník'], ['krizek', 'Středicí křížek'], ['kruh', 'Kroužek']];

  /* ---------- typy prvků ---------- */
  const POPISEK = { popisek: '', popPoloha: 'nad', popOdstup: 2, popVel: 2.5, popTucne: false };
  const TYPY = {
    text: { nazev: 'Text', druh: 'graf', vychozi: { text: 'TEXT', vel: 3, zarov: 'middle', tucne: false, radkovani: 1.5 } },
    symbol: { nazev: 'Symbol', druh: 'graf', vychozi: { druh: 'zem', vel: 6, tah: 0 } },
    znacka: { nazev: 'Značka', druh: 'graf', vychozi: { druh: 'tecka', vel: 1.5 } },
    otvor: { nazev: 'Kruhový otvor', druh: 'cut', vychozi: Object.assign({ prumer: 3.2, ploska: 0, dvePlosky: false, zabor: 0 }, POPISEK) },
    otvorObd: { nazev: 'Obdélníkový otvor', druh: 'cut', vychozi: Object.assign({ sirka: 20, vyska: 10, r: 0, zabor: 0 }, POPISEK) },
    stupnice: { nazev: 'Stupnice', druh: 'graf', vychozi: Object.assign({ r: 8, delka: 1.5, delkaVedl: 0.8, pocet: 10, mezi: 1, rozsah: 300, natoceni: 0, smer: 'cw',
      tah: 0.3, tahVedl: 0.2, oblouk: false, styl: 'carky', popisky: 'cisla', od: 0, do: 10, des: 0, vlastni: '', velPisma: 1.8, odstup: 1, orientace: 'vodorovne',
      otvor: 7.2, zabor: 11 }, POPISEK, { popOdstup: 2.5 }) },
    led: { nazev: 'LED', druh: 'cut', vychozi: Object.assign({ prumer: 3.2, krouzek: 0, barva: '#ff3b30', zabor: 0 }, POPISEK) },
    konektor: { nazev: 'Konektor', druh: 'cut', vychozi: Object.assign({ druh: 'jack35', zabor: null }, POPISEK) },
    ovladac: { nazev: 'Tlačítko / ovladač', druh: 'cut', vychozi: Object.assign({ druh: 'tl12', zabor: null }, POPISEK) },
    kota: { nazev: 'Kóta', druh: 'pom', vychozi: { dx: 20, dy: 0, odsaz: -6, smer: 'vodorovna', vel: 2.5, des: 2, prefix: '', tah: 0.18 } },
    cara: { nazev: 'Čára', druh: 'graf', vychozi: { dx: 20, dy: 0, tah: 0.3 } },
    obdelnik: { nazev: 'Obdélník', druh: 'graf', vychozi: { sirka: 30, vyska: 15, r: 1, tah: 0.3, vypln: false } },
    kruh: { nazev: 'Kruh', druh: 'graf', vychozi: { prumer: 10, tah: 0.3, vypln: false } },
  };

  /* ---------- pomocná geometrie cest ---------- */
  function obdCesta(w, h, r, cx = 0, cy = 0) {
    r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
    const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
    if (r <= 1e-9) return [['M', x0, y0], ['L', x1, y0], ['L', x1, y1], ['L', x0, y1], ['Z']];
    return [['M', x0 + r, y0], ['L', x1 - r, y0], ['A', r, x1, y0 + r, 0, 1], ['L', x1, y1 - r], ['A', r, x1 - r, y1, 0, 1],
      ['L', x0 + r, y1], ['A', r, x0, y1 - r, 0, 1], ['L', x0, y0 + r], ['A', r, x0 + r, y0, 0, 1], ['Z']];
  }
  /* Kruh s ploškou (D) nahoře ve vzdálenosti f od středu, volitelně i dole (f2). */
  function dCesta(d, f, f2, cx = 0, cy = 0) {
    const r = d / 2;
    if (!(f > 0 && f < r)) return null;
    const c = Math.sqrt(r * r - f * f);
    if (f2 > 0 && f2 < r) {
      const c2 = Math.sqrt(r * r - f2 * f2);
      return [['M', cx + c, cy - f], ['A', r, cx + c2, cy + f2, 0, 1], ['L', cx - c2, cy + f2], ['A', r, cx - c, cy - f, 0, 1], ['Z']];
    }
    return [['M', cx + c, cy - f], ['A', r, cx - c, cy - f, 1, 1], ['Z']];
  }
  /* Kruh s pravoúhlou drážkou nahoře (šířka w, vnější okraj drážky ve vzdálenosti r2 od středu). */
  function klicCesta(d, w, r2, cx = 0, cy = 0) {
    const r = d / 2, hw = w / 2, c = Math.sqrt(r * r - hw * hw);
    return [['M', cx + hw, cy - c], ['L', cx + hw, cy - r2], ['L', cx - hw, cy - r2], ['L', cx - hw, cy - c], ['A', r, cx + hw, cy - c, 1, 0], ['Z']];
  }
  /* Lichoběžník D-SUB: horní šířka a, výška h, boky skloněné o uhel ° od svislice. */
  function dsubCesta(a, h, uhel, cx = 0, cy = 0) {
    const b = a - 2 * h * Math.tan(rad(uhel));
    return [['M', cx - a / 2, cy - h / 2], ['L', cx + a / 2, cy - h / 2], ['L', cx + b / 2, cy + h / 2], ['L', cx - b / 2, cy + h / 2], ['Z']];
  }

  /* Střed oblouku (konvence SVG: velky = large-arc, cw = sweep → kladný směr úhlu, na obrazovce s y dolů po směru hodin). */
  function obloukStred(x1, y1, x2, y2, r, velky, cw) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
    const d = Math.hypot(dx, dy) / 2;
    if (d < 1e-12) return { cx: x1, cy: y1, r: Math.abs(r), a1: 0, delta: 0 };
    r = Math.max(Math.abs(r), d);
    const h = Math.sqrt(Math.max(0, r * r - d * d));
    const nx = -dy / (2 * d), ny = dx / (2 * d);
    const kand = [{ cx: mx + nx * h, cy: my + ny * h }, { cx: mx - nx * h, cy: my - ny * h }];
    const DVA = 2 * Math.PI;
    for (const k of kand) {
      const a1 = Math.atan2(y1 - k.cy, x1 - k.cx), a2 = Math.atan2(y2 - k.cy, x2 - k.cx);
      let delta = cw ? ((a2 - a1) % DVA + DVA) % DVA : -(((a1 - a2) % DVA + DVA) % DVA);
      const jeVelky = Math.abs(delta) > Math.PI + 1e-9;
      if (jeVelky === !!velky || h < 1e-9) return { cx: k.cx, cy: k.cy, r, a1, delta };
    }
    const k = kand[0], a1 = Math.atan2(y1 - k.cy, x1 - k.cx), a2 = Math.atan2(y2 - k.cy, x2 - k.cx);
    return { cx: k.cx, cy: k.cy, r, a1, delta: cw ? Math.PI : -Math.PI };
  }
  /* Oblouk → kubické Bézierovy křivky (úseky ≤ 90°). Vrací pole ['C', x1,y1,x2,y2,x,y]. */
  function obloukNaBeziery(x1, y1, x2, y2, r, velky, cw) {
    const o = obloukStred(x1, y1, x2, y2, r, velky, cw);
    if (Math.abs(o.delta) < 1e-12) return [['L', x2, y2]];
    const n = Math.max(1, Math.ceil(Math.abs(o.delta) / (Math.PI / 2) - 1e-9));
    const kr = o.delta / n, k = 4 / 3 * Math.tan(kr / 4), out = [];
    let a = o.a1;
    for (let i = 0; i < n; i++) {
      const b = a + kr;
      const p0x = o.cx + o.r * Math.cos(a), p0y = o.cy + o.r * Math.sin(a);
      const p3x = i === n - 1 ? x2 : o.cx + o.r * Math.cos(b), p3y = i === n - 1 ? y2 : o.cy + o.r * Math.sin(b);
      out.push(['C', p0x - k * o.r * Math.sin(a), p0y + k * o.r * Math.cos(a),
        o.cx + o.r * Math.cos(b) + k * o.r * Math.sin(b), o.cy + o.r * Math.sin(b) - k * o.r * Math.cos(b), p3x, p3y]);
      a = b;
    }
    return out;
  }
  function kruhNaBeziery(cx, cy, r) {
    return [['M', cx + r, cy]].concat(obloukNaBeziery(cx + r, cy, cx - r, cy, r, 0, 1), obloukNaBeziery(cx - r, cy, cx + r, cy, r, 0, 1), [['Z']]);
  }
  /* Cesta jen z M/L/C/Z (oblouky převedené). */
  function cestaBezOblouku(p) {
    const out = []; let x = 0, y = 0, sx = 0, sy = 0;
    for (const c of p) {
      if (c[0] === 'A') { for (const b of obloukNaBeziery(x, y, c[2], c[3], c[1], c[4], c[5])) out.push(b); x = c[2]; y = c[3]; }
      else {
        out.push(c.slice());
        if (c[0] === 'M') { x = sx = c[1]; y = sy = c[2]; }
        else if (c[0] === 'L') { x = c[1]; y = c[2]; }
        else if (c[0] === 'C') { x = c[5]; y = c[6]; }
        else if (c[0] === 'Q') { x = c[3]; y = c[4]; }
        else if (c[0] === 'Z') { x = sx; y = sy; }
      }
    }
    return out;
  }
  /* Zploštění cesty na lomené čáry (pro ohraničení, DXF polyline, testy). */
  function zplostiCestu(p, segOblouk = 24, segBez = 12) {
    const tahy = []; let akt = null, x = 0, y = 0, sx = 0, sy = 0;
    for (const c of p) {
      if (c[0] === 'M') { akt = [[c[1], c[2]]]; tahy.push(akt); x = sx = c[1]; y = sy = c[2]; }
      else if (c[0] === 'L') { akt.push([c[1], c[2]]); x = c[1]; y = c[2]; }
      else if (c[0] === 'A') {
        const o = obloukStred(x, y, c[2], c[3], c[1], c[4], c[5]);
        const n = Math.max(2, Math.ceil(segOblouk * Math.abs(o.delta) / (2 * Math.PI)));
        for (let i = 1; i <= n; i++) { const a = o.a1 + o.delta * i / n; akt.push(i === n ? [c[2], c[3]] : [o.cx + o.r * Math.cos(a), o.cy + o.r * Math.sin(a)]); }
        x = c[2]; y = c[3];
      } else if (c[0] === 'C' || c[0] === 'Q') {
        const q = c[0] === 'Q';
        for (let i = 1; i <= segBez; i++) {
          const t = i / segBez, u = 1 - t;
          if (q) akt.push([u * u * x + 2 * u * t * c[1] + t * t * c[3], u * u * y + 2 * u * t * c[2] + t * t * c[4]]);
          else akt.push([u * u * u * x + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5], u * u * u * y + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6]]);
        }
        x = q ? c[3] : c[5]; y = q ? c[4] : c[6];
      } else if (c[0] === 'Z') { if (akt) { akt.push([sx, sy]); akt.uzavrena = true; } x = sx; y = sy; }
    }
    return tahy;
  }

  /* ---------- písmo (opentype.js Font, v prohlížeči i v node) ---------- */
  const PISMA = { normal: null, tucne: null };
  function nastavPismo(font, tucne) { PISMA[tucne ? 'tucne' : 'normal'] = font; }
  function pismoPro(tucne) { return (tucne && PISMA.tucne) || PISMA.normal || PISMA.tucne; }
  function vyskaVerzalekEm(font) {
    const ch = font && font.tables && font.tables.os2 && font.tables.os2.sCapHeight;
    return ch ? ch / font.unitsPerEm : 0.716;
  }
  /* Velikost písma v mm (em) pro požadovanou výšku verzálek. */
  function emProVel(vel, font) { return vel / vyskaVerzalekEm(font); }
  function sirkaTextu(text, vel, tucne) {
    const f = pismoPro(tucne);
    if (f) return f.getAdvanceWidth(text, emProVel(vel, f), { kerning: true });
    return text.length * vel * (tucne ? 0.86 : 0.8); // odhad pro Arial/Liberation bez načteného písma
  }
  /* Text → příkazy obrysů (M/L/Q/C/Z) v mm, s otočením. Bez písma vrací null. */
  const _cacheText = new Map();
  function textNaPrikazy(prim) {
    const f = pismoPro(prim.tucne);
    if (!f || !prim.text) return null;
    const em = emProVel(prim.vel, f);
    const klic = (f === PISMA.tucne ? 'B' : 'N') + '|' + prim.vel + '|' + prim.zarov + '|' + prim.text;
    let lok = _cacheText.get(klic);
    if (!lok) {
      const w = f.getAdvanceWidth(prim.text, em, { kerning: true });
      const x0 = prim.zarov === 'middle' ? -w / 2 : prim.zarov === 'end' ? -w : 0;
      const path = f.getPath(prim.text, x0, prim.vel / 2, em, { kerning: true });
      lok = path.commands.map((c) => {
        switch (c.type) {
          case 'M': return ['M', c.x, c.y];
          case 'L': return ['L', c.x, c.y];
          case 'Q': return ['Q', c.x1, c.y1, c.x, c.y];
          case 'C': return ['C', c.x1, c.y1, c.x2, c.y2, c.x, c.y];
          default: return ['Z'];
        }
      });
      if (_cacheText.size > 3000) _cacheText.clear();
      _cacheText.set(klic, lok);
    }
    const a = rad(prim.rot || 0), cs = Math.cos(a), sn = Math.sin(a), X = prim.x, Y = prim.y;
    const T = (x, y) => [x * cs - y * sn + X, x * sn + y * cs + Y];
    return lok.map((c) => {
      if (c[0] === 'Z') return ['Z'];
      const o = [c[0]];
      for (let i = 1; i < c.length; i += 2) { const p = T(c[i], c[i + 1]); o.push(p[0], p[1]); }
      return o;
    });
  }

  /* ---------- transformace primitiv ---------- */
  function transformuj(prims, X, Y, rot) {
    const a = rad(rot || 0), cs = Math.cos(a), sn = Math.sin(a);
    const T = (x, y) => [x * cs - y * sn + X, x * sn + y * cs + Y];
    return prims.map((p) => {
      const q = Object.assign({}, p);
      if (p.t === 'kruh') { const c = T(p.cx, p.cy); q.cx = c[0]; q.cy = c[1]; }
      else if (p.t === 'text') { const c = T(p.x, p.y); q.x = c[0]; q.y = c[1]; q.rot = (p.rot || 0) + (rot || 0); }
      else if (p.t === 'cesta') {
        q.p = p.p.map((c) => {
          if (c[0] === 'Z') return ['Z'];
          if (c[0] === 'A') { const e = T(c[2], c[3]); return ['A', c[1], e[0], e[1], c[4], c[5]]; }
          const o = [c[0]];
          for (let i = 1; i < c.length; i += 2) { const e = T(c[i], c[i + 1]); o.push(e[0], e[1]); }
          return o;
        });
      }
      return q;
    });
  }

  /* ---------- poradí / proměnné v textu ---------- */
  function nahradPromenne(text, ctx = {}) {
    if (!text || text.indexOf('{') < 0) return text;
    return text.replace(/\{(n|datum|rok)(?::(\d+))?\}/g, (m, k, w) => {
      if (k === 'n') { const n = ctx.n != null ? ctx.n : 1; return w ? String(n).padStart(+w, '0') : String(n); }
      const d = ctx.datum || new Date();
      if (k === 'rok') return String(d.getFullYear());
      return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear();
    });
  }

  /* ---------- geometrie stupnice ---------- */
  /* Úhly hlavních dílků (° od 12 h po směru hodin) a hodnoty. Při rozsahu 360° se poslední dílek nekreslí (splývá s prvním). */
  function stupniceUhly(s) {
    const n = Math.max(1, Math.round(s.pocet)), roz = Math.max(1, Math.min(360, s.rozsah));
    const start = (s.natoceni || 0) - roz / 2, krok = roz / n;
    const plny = roz >= 360 - 1e-9;
    const hl = [], vedl = [];
    const m = Math.max(1, Math.round(s.mezi || 1));
    for (let i = 0; i <= n; i++) {
      if (plny && i === n) break;
      const t = s.smer === 'ccw' ? n - i : i;
      hl.push({ uhel: start + i * krok, hodnota: s.od + (s.do - s.od) * t / n, i: t });
      if (i < n) for (let j = 1; j < m; j++) vedl.push(start + (i + j / m) * krok);
    }
    return { hlavni: hl, vedlejsi: vedl, start, krok, rozsah: roz };
  }
  const polar = (r, uhel) => [r * Math.sin(rad(uhel)), -r * Math.cos(rad(uhel))];

  function stupnicePrimitiva(s) {
    const pr = [], g = stupniceUhly(s);
    const vlastni = String(s.vlastni || '').split(/[;|]/).map((x) => x.trim());
    const tecky = s.styl === 'tecky';
    for (const h of g.hlavni) {
      if (tecky) { const c = polar(s.r + s.delka / 2, h.uhel); pr.push({ t: 'kruh', cx: c[0], cy: c[1], r: s.delka / 2, role: 'graf', tah: 0, vypln: true }); }
      else { const a = polar(s.r, h.uhel), b = polar(s.r + s.delka, h.uhel); pr.push({ t: 'cesta', p: [['M', a[0], a[1]], ['L', b[0], b[1]]], role: 'graf', tah: s.tah, vypln: false }); }
    }
    for (const u of g.vedlejsi) {
      if (tecky) { const c = polar(s.r + s.delka / 2, u); pr.push({ t: 'kruh', cx: c[0], cy: c[1], r: s.delkaVedl / 2, role: 'graf', tah: 0, vypln: true }); }
      else { const a = polar(s.r, u), b = polar(s.r + s.delkaVedl, u); pr.push({ t: 'cesta', p: [['M', a[0], a[1]], ['L', b[0], b[1]]], role: 'graf', tah: s.tahVedl, vypln: false }); }
    }
    if (s.oblouk) {
      if (g.rozsah >= 360 - 1e-9) pr.push({ t: 'kruh', cx: 0, cy: 0, r: s.r, role: 'graf', tah: s.tahVedl, vypln: false });
      else {
        const a = polar(s.r, g.start), b = polar(s.r, g.start + g.rozsah);
        pr.push({ t: 'cesta', p: [['M', a[0], a[1]], ['A', s.r, b[0], b[1], g.rozsah > 180 ? 1 : 0, 1]], role: 'graf', tah: s.tahVedl, vypln: false });
      }
    }
    if (s.popisky !== 'zadne') {
      const vel = s.velPisma;
      g.hlavni.forEach((h, k) => {
        let txt = s.popisky === 'vlastni' ? (vlastni[s.smer === 'ccw' ? g.hlavni.length - 1 - k : k] || '') : fmt(h.hodnota, s.des | 0, false);
        if (!txt) return;
        const kon = s.r + s.delka + s.odstup;
        if (s.orientace === 'radialne') {
          const c = polar(kon + vel / 2, h.uhel);
          pr.push({ t: 'text', x: c[0], y: c[1], text: txt, vel, zarov: 'middle', tucne: false, rot: h.uhel, role: 'graf' });
        } else {
          const w = sirkaTextu(txt, vel, false);
          const off = Math.abs(Math.cos(rad(h.uhel))) * vel / 2 + Math.abs(Math.sin(rad(h.uhel))) * w / 2;
          const c = polar(kon + off, h.uhel);
          pr.push({ t: 'text', x: c[0], y: c[1], text: txt, vel, zarov: 'middle', tucne: false, rot: 0, role: 'graf' });
        }
      });
    }
    if (s.otvor > 0) pr.push({ t: 'kruh', cx: 0, cy: 0, r: s.otvor / 2, role: 'cut', tah: 0, vypln: false });
    return pr;
  }
  /* Vnější poloměr stupnice včetně popisků (pro umístění titulku a zábor). */
  function stupniceVnejsi(s) {
    let r = s.r + Math.max(s.delka, s.delkaVedl || 0);
    if (s.popisky !== 'zadne') r += s.odstup + s.velPisma * 1.6;
    return r;
  }

  /* ---------- symboly ---------- */
  function symbolPrimitiva(druh, s, tahZadany) {
    const t = tahZadany > 0 ? tahZadany : Math.max(0.15, s * 0.08), h = s / 2, pr = [];
    const L = (body, uzavr) => { const p = [['M', body[0][0], body[0][1]]]; for (let i = 1; i < body.length; i++) p.push(['L', body[i][0], body[i][1]]); if (uzavr) p.push(['Z']); return p; };
    const tah = (body, uzavr) => pr.push({ t: 'cesta', p: L(body, uzavr), role: 'graf', tah: t, vypln: false });
    const plny = (body) => pr.push({ t: 'cesta', p: L(body, true), role: 'graf', tah: 0, vypln: true });
    const sipka = (x1, y1, x2, y2) => {
      const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d, hl = s * 0.32, hw = s * 0.2;
      tah([[x1, y1], [x2 - ux * hl * 0.9, y2 - uy * hl * 0.9]]);
      plny([[x2, y2], [x2 - ux * hl - uy * hw, y2 - uy * hl + ux * hw], [x2 - ux * hl + uy * hw, y2 - uy * hl - ux * hw]]);
    };
    const vzorek = (fn, n = 48) => { const b = []; for (let i = 0; i <= n; i++) { const u = i / n; b.push([-h + u * s, fn(u)]); } return b; };
    switch (druh) {
      case 'zem': tah([[0, -h], [0, -h * 0.1]]); tah([[-h * 0.8, -h * 0.1], [h * 0.8, -h * 0.1]]); tah([[-h * 0.5, h * 0.25], [h * 0.5, h * 0.25]]); tah([[-h * 0.2, h * 0.6], [h * 0.2, h * 0.6]]); break;
      case 'kostra': tah([[0, -h], [0, 0]]); tah([[-h * 0.8, 0], [h * 0.8, 0]]);
        for (const x of [-0.8, 0, 0.8]) tah([[x * h, 0], [x * h - h * 0.35, h * 0.55]]); break;
      case 'ochrana': pr.push({ t: 'kruh', cx: 0, cy: 0, r: h - t / 2, role: 'graf', tah: t, vypln: false });
        tah([[0, -h * 0.65], [0, -h * 0.05]]); tah([[-h * 0.5, -h * 0.05], [h * 0.5, -h * 0.05]]); tah([[-h * 0.32, h * 0.22], [h * 0.32, h * 0.22]]); tah([[-h * 0.14, h * 0.49], [h * 0.14, h * 0.49]]); break;
      case 'napajeni': {
        const r = h * 0.78, a = 40, p1 = polar(r, a), p2 = polar(r, -a);
        pr.push({ t: 'cesta', p: [['M', p1[0], p1[1] + h * 0.1], ['A', r, p2[0], p2[1] + h * 0.1, 1, 1]], role: 'graf', tah: t, vypln: false });
        tah([[0, -h], [0, h * 0.05]]); break;
      }
      case 'vystraha': {
        const tl = t * 1.1; pr.push({ t: 'cesta', p: L([[0, -h], [h, h * 0.8], [-h, h * 0.8]], true), role: 'graf', tah: tl, vypln: false });
        tah([[0, -h * 0.35], [0, h * 0.3]]); pr.push({ t: 'kruh', cx: 0, cy: h * 0.55, r: t * 0.9, role: 'graf', tah: 0, vypln: true }); break;
      }
      case 'blesk': plny([[h * 0.15, -h], [-h * 0.45, h * 0.1], [-h * 0.02, h * 0.1], [-h * 0.25, h], [h * 0.5, -h * 0.2], [h * 0.05, -h * 0.2], [h * 0.35, -h]]); break;
      case 'sinus': tah(vzorek((u) => -Math.sin(u * 2 * Math.PI) * h * 0.6)); break;
      case 'obdelnik': tah([[-h, h * 0.6], [-h, -h * 0.6], [0, -h * 0.6], [0, h * 0.6], [h, h * 0.6], [h, -h * 0.6]]); break;
      case 'pila': tah([[-h, h * 0.6], [0, -h * 0.6], [0, h * 0.6], [h, -h * 0.6], [h, h * 0.6]]); break;
      case 'trojuhelnik': tah([[-h, 0], [-h / 2, -h * 0.6], [h / 2, h * 0.6], [h, 0]]); break;
      case 'stridave': tah(vzorek((u) => -Math.sin(u * 2 * Math.PI) * h * 0.3)); break;
      case 'ss': tah([[-h, -h * 0.2], [h, -h * 0.2]]);
        for (let i = 0; i < 3; i++) { const x0 = -h + i * (2 * h / 3) + h * 0.08; tah([[x0, h * 0.25], [x0 + h * 0.5, h * 0.25]]); } break;
      case 'trida2': tah([[-h, -h], [h, -h], [h, h], [-h, h]], true); tah([[-h * 0.5, -h * 0.5], [h * 0.5, -h * 0.5], [h * 0.5, h * 0.5], [-h * 0.5, h * 0.5]], true); break;
      case 'pojistka': tah([[-h * 0.6, -h * 0.35], [h * 0.6, -h * 0.35], [h * 0.6, h * 0.35], [-h * 0.6, h * 0.35]], true); tah([[-h, 0], [h, 0]]); break;
      case 'plus': tah([[-h, 0], [h, 0]]); tah([[0, -h], [0, h]]); break;
      case 'minus': tah([[-h, 0], [h, 0]]); break;
      case 'sipka_n': sipka(0, h, 0, -h); break;
      case 'sipka_d': sipka(0, -h, 0, h); break;
      case 'sipka_l': sipka(h, 0, -h, 0); break;
      case 'sipka_p': sipka(-h, 0, h, 0); break;
      case 'vstup': sipka(0, -h, 0, h * 0.35); tah([[-h * 0.6, h * 0.8], [h * 0.6, h * 0.8]]); break;
      case 'vystup': sipka(0, h * 0.8, 0, -h); tah([[-h * 0.6, h * 0.8], [h * 0.6, h * 0.8]]); break;
      case 'dioda': plny([[-h * 0.45, -h * 0.55], [-h * 0.45, h * 0.55], [h * 0.45, 0]]); tah([[h * 0.45, -h * 0.55], [h * 0.45, h * 0.55]]); tah([[-h, 0], [h, 0]]); break;
      case 'repro': tah([[-h * 0.7, -h * 0.3], [-h * 0.2, -h * 0.3], [-h * 0.2, h * 0.3], [-h * 0.7, h * 0.3]], true);
        tah([[-h * 0.2, -h * 0.3], [h * 0.5, -h * 0.9], [h * 0.5, h * 0.9], [-h * 0.2, h * 0.3]]); break;
      default: tah([[-h, -h], [h, h]]); tah([[-h, h], [h, -h]]);
    }
    return pr;
  }
  function znackaPrimitiva(druh, v) {
    switch (druh) {
      case 'tecka': return [{ t: 'kruh', cx: 0, cy: 0, r: v / 2, role: 'graf', tah: 0, vypln: true }];
      case 'ryska': return [{ t: 'cesta', p: [['M', 0, -v / 2], ['L', 0, v / 2]], role: 'graf', tah: Math.max(0.15, v * 0.15), vypln: false }];
      case 'trojuhelnik': return [{ t: 'cesta', p: [['M', -v / 2, -v * 0.43], ['L', v / 2, -v * 0.43], ['L', 0, v * 0.43], ['Z']], role: 'graf', tah: 0, vypln: true }];
      case 'krizek': return [{ t: 'cesta', p: [['M', -v, 0], ['L', v, 0], ['M', 0, -v], ['L', 0, v]], role: 'graf', tah: Math.max(0.1, v * 0.05), vypln: false },
        { t: 'kruh', cx: 0, cy: 0, r: v * 0.6, role: 'graf', tah: Math.max(0.1, v * 0.05), vypln: false }];
      default: return [{ t: 'kruh', cx: 0, cy: 0, r: v / 2, role: 'graf', tah: Math.max(0.15, v * 0.12), vypln: false }];
    }
  }

  /* ---------- otvory ze součástky ---------- */
  function otvorPrimitivum(o) {
    const x = o.x || 0, y = o.y || 0;
    switch (o.t) {
      case 'kruh': return { t: 'kruh', cx: x, cy: y, r: o.d / 2, role: 'cut', tah: 0, vypln: false };
      case 'd': return { t: 'cesta', p: dCesta(o.d, o.f, o.f2, x, y), role: 'cut', tah: 0, vypln: false };
      case 'obd': return { t: 'cesta', p: obdCesta(o.w, o.h, o.r, x, y), role: 'cut', tah: 0, vypln: false };
      case 'dsub': return { t: 'cesta', p: dsubCesta(o.a, o.h, o.uhel, x, y), role: 'cut', tah: 0, vypln: false };
      case 'klic': return { t: 'cesta', p: klicCesta(o.d, o.w, o.r2, x, y), role: 'cut', tah: 0, vypln: false };
    }
    return null;
  }
  function katalogPolozka(typ, druh) {
    const k = typ === 'konektor' ? KONEKTORY : OVLADACE;
    return k.find((x) => x.id === druh) || k[0];
  }
  /* Poloměr „dosahu“ otvoru kolem kotvy (pro titulek). */
  function polomerOtvoru(o) {
    const x = o.x || 0, y = o.y || 0;
    let r = o.t === 'kruh' || o.t === 'd' ? o.d / 2 : o.t === 'klic' ? o.r2 : o.t === 'dsub' ? Math.hypot(o.a / 2, o.h / 2) : Math.hypot(o.w / 2, o.h / 2);
    return Math.hypot(x, y) + r;
  }

  function popisekPrimitiva(p, polomer) {
    if (!p.popisek) return [];
    const vel = p.popVel || 2.5, od = (p.popOdstup != null ? p.popOdstup : 2);
    const y = p.popPoloha === 'pod' ? polomer + od + vel / 2 : -(polomer + od + vel / 2);
    return [{ t: 'text', x: 0, y, text: p.popisek, vel, zarov: 'middle', tucne: !!p.popTucne, rot: 0, role: 'graf', jePopisek: true }];
  }

  /* ---------- kóta ---------- */
  function kotaHodnota(k) {
    return k.smer === 'vodorovna' ? Math.abs(k.dx) : k.smer === 'svisla' ? Math.abs(k.dy) : Math.hypot(k.dx, k.dy);
  }
  function kotaPrimitiva(k) {
    const pr = [], t = k.tah || 0.18, vel = k.vel || 2.5, mezera = 0.6, pres = 1.2, sh = Math.max(1.2, vel * 0.7), sw = sh * 0.33;
    const P1 = [0, 0], P2 = [k.dx, k.dy];
    let A, B, ux, uy, nx, ny;
    if (k.smer === 'vodorovna') {
      const yr = (k.odsaz < 0 ? Math.min(0, k.dy) : Math.max(0, k.dy)) + k.odsaz;
      A = [0, yr]; B = [k.dx, yr];
    } else if (k.smer === 'svisla') {
      const xr = (k.odsaz < 0 ? Math.min(0, k.dx) : Math.max(0, k.dx)) + k.odsaz;
      A = [xr, 0]; B = [xr, k.dy];
    } else {
      const d = Math.hypot(k.dx, k.dy) || 1; const nx0 = -k.dy / d, ny0 = k.dx / d;
      A = [nx0 * k.odsaz, ny0 * k.odsaz]; B = [k.dx + nx0 * k.odsaz, k.dy + ny0 * k.odsaz];
    }
    const delka = Math.hypot(B[0] - A[0], B[1] - A[1]);
    ux = delka > 1e-9 ? (B[0] - A[0]) / delka : 1; uy = delka > 1e-9 ? (B[1] - A[1]) / delka : 0;
    const vyn = (P, Q) => { // vynášecí čára z bodu P k bodu Q na kótě (s mezerou a přesahem)
      const dx = Q[0] - P[0], dy = Q[1] - P[1], d = Math.hypot(dx, dy);
      if (d < 1e-6) return;
      const vx = dx / d, vy = dy / d;
      pr.push({ t: 'cesta', p: [['M', P[0] + vx * Math.min(mezera, d), P[1] + vy * Math.min(mezera, d)], ['L', Q[0] + vx * pres, Q[1] + vy * pres]], role: 'pom', tah: t, vypln: false });
    };
    vyn(P1, A); vyn(P2, B);
    pr.push({ t: 'cesta', p: [['M', A[0], A[1]], ['L', B[0], B[1]]], role: 'pom', tah: t, vypln: false });
    const venku = delka < 2.6 * sh;
    const sip = (Q, smer) => { // smer = ±1: hrot v Q, tělo směrem dovnitř (smer=+1 → podél u)
      const bx = Q[0] + ux * sh * smer, by = Q[1] + uy * sh * smer;
      pr.push({ t: 'cesta', p: [['M', Q[0], Q[1]], ['L', bx - uy * sw, by + ux * sw], ['L', bx + uy * sw, by - ux * sw], ['Z']], role: 'pom', tah: 0, vypln: true });
    };
    if (venku) { sip(A, -1); sip(B, 1); pr.push({ t: 'cesta', p: [['M', A[0] - ux * sh * 2, A[1] - uy * sh * 2], ['L', A[0], A[1]], ['M', B[0], B[1]], ['L', B[0] + ux * sh * 2, B[1] + uy * sh * 2]], role: 'pom', tah: t, vypln: false }); }
    else { sip(A, 1); sip(B, -1); }
    // text nad kótou, čitelný zdola nebo zprava
    let uhel = Math.atan2(uy, ux) * 180 / Math.PI;
    if (uhel > 89.999) uhel -= 180; else if (uhel < -90.001) uhel += 180;
    const ur = rad(uhel), nX = Math.sin(ur), nY = -Math.cos(ur); // normála „nahoru“ vůči textu
    nx = nX; ny = nY;
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, o = vel / 2 + 0.8;
    const txt = (k.prefix || '') + fmt(kotaHodnota(k), k.des != null ? k.des : 2);
    pr.push({ t: 'text', x: mx + nx * o, y: my + ny * o, text: txt, vel, zarov: 'middle', tucne: false, rot: uhel, role: 'pom' });
    return pr;
  }

  /* ---------- prvek → primitiva ---------- */
  function lokalniPrimitiva(p, ctx = {}) {
    const pr = [];
    switch (p.typ) {
      case 'text': {
        const radky = nahradPromenne(String(p.text == null ? '' : p.text), ctx).split('\n');
        const kr = p.vel * (p.radkovani || 1.5);
        radky.forEach((r, i) => pr.push({ t: 'text', x: 0, y: (i - (radky.length - 1) / 2) * kr, text: r, vel: p.vel, zarov: p.zarov || 'middle', tucne: !!p.tucne, rot: 0, role: 'graf' }));
        break;
      }
      case 'symbol': return symbolPrimitiva(p.druh, p.vel, p.tah);
      case 'znacka': return znackaPrimitiva(p.druh, p.vel);
      case 'otvor': {
        const d = dCesta(p.prumer, p.ploska, p.dvePlosky ? p.ploska : 0);
        pr.push(d ? { t: 'cesta', p: d, role: 'cut', tah: 0, vypln: false } : { t: 'kruh', cx: 0, cy: 0, r: p.prumer / 2, role: 'cut', tah: 0, vypln: false });
        if (p.zabor > 0) pr.push({ t: 'kruh', cx: 0, cy: 0, r: p.zabor / 2, role: 'nahled', tah: 0.15, vypln: false });
        pr.push(...popisekPrimitiva(p, Math.max(p.prumer / 2, (p.zabor || 0) / 2)));
        break;
      }
      case 'otvorObd':
        pr.push({ t: 'cesta', p: obdCesta(p.sirka, p.vyska, p.r), role: 'cut', tah: 0, vypln: false });
        if (p.zabor > 0) pr.push({ t: 'kruh', cx: 0, cy: 0, r: p.zabor / 2, role: 'nahled', tah: 0.15, vypln: false });
        pr.push(...popisekPrimitiva(p, p.popPoloha === 'pod' || p.popPoloha === 'nad' ? p.vyska / 2 : 0));
        break;
      case 'stupnice':
        pr.push(...stupnicePrimitiva(p));
        if (p.zabor > 0) pr.push({ t: 'kruh', cx: 0, cy: 0, r: p.zabor / 2, role: 'nahled', tah: 0.15, vypln: false });
        pr.push(...popisekPrimitiva(p, stupniceVnejsi(p)));
        break;
      case 'led':
        pr.push({ t: 'kruh', cx: 0, cy: 0, r: p.prumer / 2, role: 'cut', tah: 0, vypln: false });
        pr.push({ t: 'kruh', cx: 0, cy: 0, r: p.prumer / 2 * 0.8, role: 'nahled', tah: 0, vypln: true, barva: p.barva || '#ff3b30' });
        if (p.krouzek > 0) pr.push({ t: 'kruh', cx: 0, cy: 0, r: p.prumer / 2 + p.krouzek, role: 'graf', tah: 0.3, vypln: false });
        pr.push(...popisekPrimitiva(p, p.prumer / 2 + (p.krouzek > 0 ? p.krouzek + 0.15 : 0)));
        break;
      case 'konektor': case 'ovladac': {
        const k = katalogPolozka(p.typ, p.druh);
        let rmax = 0;
        for (const o of k.otvory) { const q = otvorPrimitivum(o); if (q) pr.push(q); rmax = Math.max(rmax, polomerOtvoru(o)); }
        const zab = p.zabor != null ? p.zabor : k.zabor;
        if (zab > 0) pr.push({ t: 'kruh', cx: 0, cy: 0, r: zab / 2, role: 'nahled', tah: 0.15, vypln: false });
        const vys = k.otvory[0].t === 'obd' ? k.otvory[0].h / 2 : rmax;
        pr.push(...popisekPrimitiva(p, Math.max(vys, (zab || 0) / 2)));
        break;
      }
      case 'kota': return kotaPrimitiva(p);
      case 'cara': pr.push({ t: 'cesta', p: [['M', 0, 0], ['L', p.dx, p.dy]], role: 'graf', tah: p.tah, vypln: false }); break;
      case 'obdelnik': pr.push({ t: 'cesta', p: obdCesta(p.sirka, p.vyska, p.r), role: 'graf', tah: p.vypln ? 0 : p.tah, vypln: !!p.vypln }); break;
      case 'kruh': pr.push({ t: 'kruh', cx: 0, cy: 0, r: p.prumer / 2, role: 'graf', tah: p.vypln ? 0 : p.tah, vypln: !!p.vypln }); break;
    }
    return pr;
  }
  function prvekPrimitiva(p, ctx) {
    const pr = transformuj(lokalniPrimitiva(p, ctx), p.x, p.y, p.rot || 0);
    for (const q of pr) { q.id = p.id; if (p.typ === 'kota' && q.role === 'graf') q.role = 'pom'; }
    return pr;
  }

  /* ---------- ohraničení ---------- */
  /* Body určující ohraničení cesty: koncové body, u oblouků přesné extrémy (0°, 90°, 180°, 270° uvnitř oblouku), Bézier zploštěně. */
  function extremyCesty(p) {
    const out = []; let x = 0, y = 0, sx = 0, sy = 0;
    for (const c of p) {
      if (c[0] === 'M' || c[0] === 'L') { x = c[1]; y = c[2]; if (c[0] === 'M') { sx = x; sy = y; } out.push([x, y]); }
      else if (c[0] === 'A') {
        const o = obloukStred(x, y, c[2], c[3], c[1], c[4], c[5]);
        out.push([c[2], c[3]]);
        const a0 = Math.min(o.a1, o.a1 + o.delta), a1 = Math.max(o.a1, o.a1 + o.delta);
        for (let k = Math.ceil(a0 / (Math.PI / 2) - 1e-12); k * Math.PI / 2 <= a1 + 1e-12; k++) {
          const a = k * Math.PI / 2; out.push([o.cx + o.r * Math.cos(a), o.cy + o.r * Math.sin(a)]);
        }
        x = c[2]; y = c[3];
      } else if (c[0] === 'C' || c[0] === 'Q') {
        for (const b of zplostiCestu([['M', x, y], c], 8, 24)[0]) out.push(b);
        x = c[0] === 'C' ? c[5] : c[3]; y = c[0] === 'C' ? c[6] : c[4];
      } else if (c[0] === 'Z') { x = sx; y = sy; }
    }
    return out;
  }
  function ohraniceniPrimitiv(prims, sRoli) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const pridej = (x, y, m = 0) => { x0 = Math.min(x0, x - m); y0 = Math.min(y0, y - m); x1 = Math.max(x1, x + m); y1 = Math.max(y1, y + m); };
    for (const p of prims) {
      if (sRoli && sRoli.indexOf(p.role) < 0) continue;
      const m = (p.tah || 0) / 2;
      if (p.t === 'kruh') { pridej(p.cx - p.r, p.cy - p.r, m); pridej(p.cx + p.r, p.cy + p.r, m); }
      else if (p.t === 'cesta') { for (const b of extremyCesty(p.p)) pridej(b[0], b[1], m); }
      else if (p.t === 'text') {
        const w = sirkaTextu(p.text, p.vel, p.tucne), x0l = p.zarov === 'middle' ? -w / 2 : p.zarov === 'end' ? -w : 0;
        const a = rad(p.rot || 0), cs = Math.cos(a), sn = Math.sin(a);
        for (const [x, y] of [[x0l, -p.vel / 2], [x0l + w, -p.vel / 2], [x0l, p.vel / 2 + p.vel * 0.3], [x0l + w, p.vel / 2 + p.vel * 0.3]])
          pridej(x * cs - y * sn + p.x, x * sn + y * cs + p.y);
      }
    }
    if (!isFinite(x0)) return null;
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  function ohraniceniPrvku(p, ctx, sRoli) { return ohraniceniPrimitiv(prvekPrimitiva(p, ctx), sRoli || ['cut', 'graf', 'pom']); }

  /* ---------- přichytávání ---------- */
  /* bod {x,y}; mr = {krok, zapnuto}; cile = [{x,y}] body jiných prvků; tol v mm. Vrací {x,y, vodX, vodY} (vodítka). */
  function prichyt(bod, mr, cile = [], tol = 1) {
    let x = bod.x, y = bod.y, vodX = null, vodY = null;
    let nejX = tol, nejY = tol;
    for (const c of cile) {
      const dx = Math.abs(c.x - bod.x), dy = Math.abs(c.y - bod.y);
      if (dx < nejX) { nejX = dx; x = c.x; vodX = c.x; }
      if (dy < nejY) { nejY = dy; y = c.y; vodY = c.y; }
    }
    if (mr && mr.zapnuto && mr.krok > 0) {
      const o = mr.pocatek || { x: 0, y: 0 };
      if (vodX === null) x = o.x + Math.round((bod.x - o.x) / mr.krok) * mr.krok;
      if (vodY === null) y = o.y + Math.round((bod.y - o.y) / mr.krok) * mr.krok;
    }
    return { x: zaokr(x, 6), y: zaokr(y, 6), vodX, vodY };
  }

  /* ---------- zarovnání a rozmístění ---------- */
  /* polozky: [{id, bb:{x0,y0,x1,y1}}]; vrací posuny {id: {dx,dy}}. vzhledem: 'vyber' | 'panel' (panel = {sirka,vyska}). */
  function zarovnej(polozky, zpusob, panel) {
    const out = {};
    if (!polozky.length) return out;
    let R;
    if (panel) R = { x0: 0, y0: 0, x1: panel.sirka, y1: panel.vyska };
    else R = polozky.reduce((a, p) => ({ x0: Math.min(a.x0, p.bb.x0), y0: Math.min(a.y0, p.bb.y0), x1: Math.max(a.x1, p.bb.x1), y1: Math.max(a.y1, p.bb.y1) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
    for (const p of polozky) {
      const b = p.bb; let dx = 0, dy = 0;
      if (zpusob === 'vlevo') dx = R.x0 - b.x0;
      else if (zpusob === 'vpravo') dx = R.x1 - b.x1;
      else if (zpusob === 'stredH') dx = (R.x0 + R.x1) / 2 - (b.x0 + b.x1) / 2;
      else if (zpusob === 'nahoru') dy = R.y0 - b.y0;
      else if (zpusob === 'dolu') dy = R.y1 - b.y1;
      else if (zpusob === 'stredV') dy = (R.y0 + R.y1) / 2 - (b.y0 + b.y1) / 2;
      out[p.id] = { dx: zaokr(dx), dy: zaokr(dy) };
    }
    return out;
  }
  /* Rozmístění středů rovnoměrně mezi krajními (osa 'x' nebo 'y'); polozky [{id, x, y}] (kotvy). */
  function rozmisti(polozky, osa) {
    const out = {};
    if (polozky.length < 3) return out;
    const s = polozky.slice().sort((a, b) => a[osa] - b[osa]);
    const a = s[0][osa], b = s[s.length - 1][osa], krok = (b - a) / (s.length - 1);
    s.forEach((p, i) => { out[p.id] = osa === 'x' ? { dx: zaokr(a + i * krok - p.x), dy: 0 } : { dx: 0, dy: zaokr(a + i * krok - p.y) }; });
    return out;
  }

  /* ---------- řady otvorů ---------- */
  function radaLinearni(n, roztec, uhel = 0) {
    const out = [], a = rad(uhel);
    for (let i = 0; i < n; i++) out.push({ x: zaokr(i * roztec * Math.cos(a)), y: zaokr(i * roztec * Math.sin(a)) });
    return out;
  }
  function radaMrizka(sloupce, radky, dx, dy, sachovnice = false) {
    const out = [];
    for (let r = 0; r < radky; r++) for (let s = 0; s < sloupce; s++) out.push({ x: zaokr(s * dx + (sachovnice && r % 2 ? dx / 2 : 0)), y: zaokr(r * dy) });
    return out;
  }
  /* Kruhová řada: n otvorů na roztečné kružnici o průměru D, první v úhlu start (° od 12 h po směru), rozsah 360 = celý kruh. Středem je (0,0). */
  function radaKruhova(n, D, start = 0, rozsah = 360, otacet = false) {
    const out = [], plny = rozsah >= 360 - 1e-9, krok = n <= 1 ? 0 : rozsah / (plny ? n : n - 1);
    for (let i = 0; i < n; i++) { const u = start + i * krok, p = polar(D / 2, u); out.push({ x: zaokr(p[0]), y: zaokr(p[1]), rot: otacet ? zaokr(u, 6) : 0 }); }
    return out;
  }
  function radaMezi(x1, y1, x2, y2, n) {
    const out = [];
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); out.push({ x: zaokr(x1 + (x2 - x1) * t), y: zaokr(y1 + (y2 - y1) * t) }); }
    return out;
  }

  /* ---------- projekt ---------- */
  let _id = 0;
  function noveId() { _id++; return 'p' + Date.now().toString(36) + '_' + _id.toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function vychoziVrstvy() {
    return [
      { id: 'v_cut', nazev: 'Výroba – obrys a otvory', role: 'cut', viditelna: true, zamcena: false },
      { id: 'v_potisk', nazev: 'Potisk / gravírování', role: 'graf', viditelna: true, zamcena: false },
      { id: 'v_koty', nazev: 'Kóty a poznámky', role: 'pom', viditelna: true, zamcena: false },
    ];
  }
  function vychoziVrstvaPro(proj, typ) {
    const druh = TYPY[typ] ? TYPY[typ].druh : 'graf';
    const v = proj.vrstvy.find((v) => v.role === druh) || proj.vrstvy[0];
    return v.id;
  }
  function novyPrvek(typ, x, y, param = {}, proj) {
    if (!TYPY[typ]) throw new Error('Neznámý typ prvku: ' + typ);
    const p = Object.assign({ id: noveId(), typ, x, y, rot: 0, vrstva: proj ? vychoziVrstvaPro(proj, typ) : null, zamceny: false }, JSON.parse(JSON.stringify(TYPY[typ].vychozi)), param);
    return p;
  }
  function novyProjekt(sablonaId = 'euro3u', param = {}) {
    const s = SABLONY.find((x) => x.id === sablonaId) || SABLONY[0];
    const pp = {};
    for (const q of s.param || []) pp[q.k] = param[q.k] != null && isFinite(param[q.k]) ? Math.max(q.min, Math.min(q.max, +param[q.k])) : q.vychozi;
    const v = s.pevne ? { panel: Object.assign({ typ: 'krabicka', nazev: s.nazev }, s.pevne), otvory: [] } : s.vytvor(pp);
    const proj = {
      format: 'stitky_panely', verze: 1,
      panel: Object.assign({ obrys: true, material: 'hlinik', sablona: s.id, param: pp }, v.panel),
      vrstvy: vychoziVrstvy(), prvky: [],
      nastaveni: { mrizka: s.id.startsWith('euro') ? 0.5 : 1, mrizkaZobr: true, prichyt: true, prichytObj: true, pocatek: 'lh' },
    };
    for (const o of v.otvory) proj.prvky.push(novyPrvek('otvor', o.x, o.y, { prumer: o.d, montazni: true }, proj));
    return proj;
  }
  function cisloOk(x) { return typeof x === 'number' && isFinite(x); }
  /* Kontrola a doplnění načteného projektu. Vrací {projekt, chyby, varovani}. */
  function nactiProjekt(data) {
    const chyby = [], varovani = [];
    let o = data;
    if (typeof data === 'string') { try { o = JSON.parse(data); } catch (e) { return { projekt: null, chyby: ['Soubor není platný JSON.'], varovani }; } }
    if (!o || typeof o !== 'object' || o.format !== 'stitky_panely') return { projekt: null, chyby: ['Soubor není projekt editoru štítků a panelů (chybí format „stitky_panely“).'], varovani };
    if (o.verze > 1) varovani.push('Projekt je z novější verze editoru – některé vlastnosti se mohou ztratit.');
    const p = o.panel || {};
    if (!(cisloOk(p.sirka) && p.sirka > 0 && p.sirka <= 5000 && cisloOk(p.vyska) && p.vyska > 0 && p.vyska <= 5000)) return { projekt: null, chyby: ['Neplatné rozměry panelu.'], varovani };
    const proj = {
      format: 'stitky_panely', verze: 1,
      panel: Object.assign({ r: 0, obrys: true, material: 'hlinik', typ: 'vlastni', nazev: '' }, p),
      vrstvy: Array.isArray(o.vrstvy) && o.vrstvy.length ? o.vrstvy.filter((v) => v && v.id).map((v) => Object.assign({ nazev: 'Vrstva', role: 'graf', viditelna: true, zamcena: false }, v)) : vychoziVrstvy(),
      prvky: [],
      nastaveni: Object.assign({ mrizka: 1, mrizkaZobr: true, prichyt: true, prichytObj: true, pocatek: 'lh' }, o.nastaveni || {}),
    };
    if (!proj.vrstvy.length) proj.vrstvy = vychoziVrstvy();
    const ids = new Set();
    for (const q of Array.isArray(o.prvky) ? o.prvky : []) {
      if (!q || !TYPY[q.typ]) { varovani.push('Vynechán prvek neznámého typu' + (q && q.typ ? ' „' + q.typ + '“' : '') + '.'); continue; }
      if (!cisloOk(q.x) || !cisloOk(q.y)) { varovani.push('Vynechán prvek bez platné polohy.'); continue; }
      const n = Object.assign({}, JSON.parse(JSON.stringify(TYPY[q.typ].vychozi)), q);
      if (!n.id || ids.has(n.id)) n.id = noveId();
      ids.add(n.id);
      if (!proj.vrstvy.some((v) => v.id === n.vrstva)) n.vrstva = vychoziVrstvaPro(proj, n.typ);
      proj.prvky.push(n);
    }
    return { projekt: proj, chyby, varovani };
  }

  /* ---------- obrys panelu ---------- */
  function obrysPrimitivum(panel) {
    return { t: 'cesta', p: obdCesta(panel.sirka, panel.vyska, panel.r || 0, panel.sirka / 2, panel.vyska / 2), role: 'cut', tah: 0, vypln: false, obrys: true };
  }

  /* Všechna primitiva projektu ve vykreslovacím pořadí (vrstvy, pak prvky). ctx.n = pořadové číslo. */
  function vsechnaPrimitiva(proj, ctx = {}) {
    const out = [];
    if (proj.panel.obrys !== false) out.push(obrysPrimitivum(proj.panel));
    const poradi = new Map(proj.vrstvy.map((v, i) => [v.id, i]));
    const prvky = proj.prvky.slice().sort((a, b) => (poradi.get(a.vrstva) || 0) - (poradi.get(b.vrstva) || 0));
    for (const p of prvky) for (const q of prvekPrimitiva(p, ctx)) { q.vrstva = p.vrstva; out.push(q); }
    return out;
  }

  /* ---------- SVG ---------- */
  const n4 = (x) => { const v = Math.round(x * 10000) / 10000; return String(Object.is(v, -0) ? 0 : v); };
  function cestaNaD(p) {
    return p.map((c) => {
      if (c[0] === 'Z') return 'Z';
      if (c[0] === 'A') return 'A' + n4(c[1]) + ' ' + n4(c[1]) + ' 0 ' + (c[4] ? 1 : 0) + ' ' + (c[5] ? 1 : 0) + ' ' + n4(c[2]) + ' ' + n4(c[3]);
      return c[0] + c.slice(1).map(n4).join(' ');
    }).join('');
  }
  function escXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  /* Jedno primitivum → SVG. styl: {barva, tahRezu, textJakoText} */
  function primNaSvg(p, styl = {}) {
    const barva = styl.barva || '#000';
    const tah = p.role === 'cut' ? (styl.tahRezu || 0.1) : p.tah;
    const atr = p.vypln && p.role !== 'cut' ? `fill="${barva}" stroke="none"` : `fill="none" stroke="${barva}" stroke-width="${n4(tah || 0.1)}" stroke-linecap="round" stroke-linejoin="round"`;
    if (p.t === 'kruh') return `<circle cx="${n4(p.cx)}" cy="${n4(p.cy)}" r="${n4(p.r)}" ${atr}/>`;
    if (p.t === 'cesta') return `<path d="${cestaNaD(p.p)}" ${atr}/>`;
    if (p.t === 'text') {
      const pr = styl.textJakoText ? null : textNaPrikazy(p);
      if (pr) return `<path d="${cestaNaD(pr)}" fill="${barva}" stroke="none"/>`;
      const em = emProVel(p.vel, pismoPro(p.tucne));
      return `<text x="0" y="${n4(p.vel / 2)}" transform="translate(${n4(p.x)} ${n4(p.y)}) rotate(${n4(p.rot || 0)})" font-family="Liberation Sans, Arial, Helvetica, sans-serif" font-size="${n4(em)}"${p.tucne ? ' font-weight="bold"' : ''} text-anchor="${p.zarov || 'middle'}" fill="${barva}">${escXml(p.text)}</text>`;
    }
    return '';
  }
  /* Export SVG v mm. moznosti: {cut, graf, pom, zrcadlit, tahRezu, barvaRezu, barvaPotisku, barvaPom, n, textJakoText, podklad} */
  function doSvg(proj, m = {}) {
    const M = Object.assign({ cut: true, graf: true, pom: false, zrcadlit: false, tahRezu: 0.1, barvaRezu: '#FF0000', barvaPotisku: '#000000', barvaPom: '#0000FF', n: 1, textJakoText: false, podklad: null }, m);
    const W = proj.panel.sirka, H = proj.panel.vyska;
    const prims = vsechnaPrimitiva(proj, { n: M.n, datum: M.datum });
    const viditelne = (q) => true;
    const cut = prims.filter((q) => q.role === 'cut' && viditelne(q));
    const graf = prims.filter((q) => q.role === 'graf');
    const pom = prims.filter((q) => q.role === 'pom');
    const L = [];
    L.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
    L.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="${n4(W)}mm" height="${n4(H)}mm" viewBox="0 0 ${n4(W)} ${n4(H)}">`);
    L.push(`<title>${escXml(proj.panel.nazev || 'Panel')} – ${fmt(W)} × ${fmt(H)} mm</title>`);
    L.push('<desc>Měřítko 1:1, jednotky mm. Vrstva „cut“ = řez/otvory (' + M.barvaRezu + '), „engrave“ = gravírování/potisk (' + M.barvaPotisku + ').</desc>');
    const obal = M.zrcadlit ? `<g transform="translate(${n4(W)} 0) scale(-1 1)">` : '<g>';
    L.push(obal);
    if (M.podklad) L.push(`<rect x="0" y="0" width="${n4(W)}" height="${n4(H)}" fill="${M.podklad}"/>`);
    if (M.graf && graf.length) {
      L.push('<g id="engrave" inkscape:groupmode="layer" inkscape:label="engrave (gravírování / potisk)">');
      const podle = new Map();
      for (const q of graf) { const k = q.vrstva || 'ostatni'; if (!podle.has(k)) podle.set(k, []); podle.get(k).push(q); }
      for (const [k, arr] of podle) {
        const v = proj.vrstvy.find((x) => x.id === k);
        L.push(`<g id="engrave_${escXml(String(k).replace(/[^A-Za-z0-9_-]/g, '_'))}" inkscape:groupmode="layer" inkscape:label="${escXml(v ? v.nazev : 'potisk')}">`);
        for (const q of arr) L.push(primNaSvg(q, { barva: M.barvaPotisku, textJakoText: M.textJakoText }));
        L.push('</g>');
      }
      L.push('</g>');
    }
    if (M.pom && pom.length) {
      L.push('<g id="koty" inkscape:groupmode="layer" inkscape:label="kóty a poznámky (nevyrábět)">');
      for (const q of pom) L.push(primNaSvg(q, { barva: M.barvaPom, textJakoText: M.textJakoText }));
      L.push('</g>');
    }
    if (M.cut && cut.length) {
      L.push('<g id="cut" inkscape:groupmode="layer" inkscape:label="cut (řez a otvory)">');
      for (const q of cut) L.push(primNaSvg(q, { barva: M.barvaRezu, tahRezu: M.tahRezu }));
      L.push('</g>');
    }
    L.push('</g>');
    L.push('</svg>');
    return L.join('\n');
  }

  /* ---------- DXF (R12, mm, y nahoru) ---------- */
  function doDxf(proj, m = {}) {
    const M = Object.assign({ cut: true, graf: false, pom: false, n: 1 }, m);
    const H = proj.panel.vyska, out = [];
    const g = (kod, hod) => { out.push(String(kod)); out.push(String(hod)); };
    const f = (x) => (Math.round(x * 1e6) / 1e6).toString();
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(9, '$MEASUREMENT'); g(70, 1);
    g(9, '$EXTMIN'); g(10, 0); g(20, 0); g(9, '$EXTMAX'); g(10, f(proj.panel.sirka)); g(20, f(H)); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, 3);
    for (const [n, c] of [['CUT', 1], ['ENGRAVE', 5], ['DIM', 3]]) { g(0, 'LAYER'); g(2, n); g(70, 0); g(62, c); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const Y = (y) => H - y;
    const pline = (body, vrstva, uzavr) => {
      g(0, 'POLYLINE'); g(8, vrstva); g(66, 1); g(70, uzavr ? 1 : 0);
      for (const b of body) { g(0, 'VERTEX'); g(8, vrstva); g(10, f(b[0])); g(20, f(Y(b[1]))); }
      g(0, 'SEQEND'); g(8, vrstva);
    };
    const prims = vsechnaPrimitiva(proj, { n: M.n });
    for (const q of prims) {
      const vr = q.role === 'cut' ? 'CUT' : q.role === 'graf' ? 'ENGRAVE' : q.role === 'pom' ? 'DIM' : null;
      if (!vr || (vr === 'CUT' && !M.cut) || (vr === 'ENGRAVE' && !M.graf) || (vr === 'DIM' && !M.pom)) continue;
      if (q.t === 'kruh') { g(0, 'CIRCLE'); g(8, vr); g(10, f(q.cx)); g(20, f(Y(q.cy))); g(40, f(q.r)); }
      else if (q.t === 'cesta') {
        // úsečky a oblouky přesně, Bézierovy křivky zploštěné
        let x = 0, y = 0, sx = 0, sy = 0;
        for (const c of q.p) {
          if (c[0] === 'M') { x = sx = c[1]; y = sy = c[2]; }
          else if (c[0] === 'L' || c[0] === 'Z') {
            const ex = c[0] === 'Z' ? sx : c[1], ey = c[0] === 'Z' ? sy : c[2];
            if (Math.hypot(ex - x, ey - y) > 1e-9) { g(0, 'LINE'); g(8, vr); g(10, f(x)); g(20, f(Y(y))); g(11, f(ex)); g(21, f(Y(ey))); }
            x = ex; y = ey;
          } else if (c[0] === 'A') {
            const o = obloukStred(x, y, c[2], c[3], c[1], c[4], c[5]);
            // v DXF (y nahoru) je úhel = −úhel v souřadnicích s y dolů; oblouk se kreslí proti směru hodin od 50 do 51
            const u1 = -o.a1 * 180 / Math.PI, u2 = -(o.a1 + o.delta) * 180 / Math.PI;
            const [zac, kon] = o.delta > 0 ? [u2, u1] : [u1, u2];
            const nrm = (u) => ((u % 360) + 360) % 360;
            g(0, 'ARC'); g(8, vr); g(10, f(o.cx)); g(20, f(Y(o.cy))); g(40, f(o.r)); g(50, f(nrm(zac))); g(51, f(nrm(kon)));
            x = c[2]; y = c[3];
          } else if (c[0] === 'C' || c[0] === 'Q') {
            const tah = zplostiCestu([['M', x, y], c], 24, 16)[0];
            pline(tah, vr, false);
            x = c[0] === 'C' ? c[5] : c[3]; y = c[0] === 'C' ? c[6] : c[4];
          }
        }
      } else if (q.t === 'text') {
        const pr = textNaPrikazy(q);
        if (pr) for (const tah of zplostiCestu(pr, 24, 6)) pline(tah, vr, !!tah.uzavrena);
        else { g(0, 'TEXT'); g(8, vr); g(10, f(q.x)); g(20, f(Y(q.y + q.vel / 2))); g(40, f(q.vel)); g(50, f(-(q.rot || 0))); g(1, q.text); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return out.join('\n') + '\n';
  }

  /* ---------- tabulka otvorů ---------- */
  function pocatekBod(proj, kod) {
    const W = proj.panel.sirka, H = proj.panel.vyska;
    if (kod === 'stred') return { x: W / 2, y: H / 2, osaY: 1 };
    if (kod === 'ld') return { x: 0, y: H, osaY: -1 };
    return { x: 0, y: 0, osaY: 1 };
  }
  /* Převod mezi interními souřadnicemi a zobrazenými (podle počátku; u 'ld' a 'stred' je osa y nahoru). */
  function naZobrazene(proj, x, y, kod) { const o = pocatekBod(proj, kod); return kod === 'lh' || !kod ? { x, y } : { x: x - o.x, y: o.y - y }; }
  function zZobrazenych(proj, x, y, kod) { const o = pocatekBod(proj, kod); return kod === 'lh' || !kod ? { x, y } : { x: x + o.x, y: o.y - y }; }

  function popisOtvoru(q) {
    if (q.t === 'kruh') return 'Ø ' + fmt(q.r * 2);
    const bb = ohraniceniPrimitiv([q]);
    return bb ? fmt(bb.w) + ' × ' + fmt(bb.h) + ' (tvar)' : '';
  }
  function tabulkaOtvoru(proj, kod = 'lh') {
    const rad = [];
    let i = 0;
    for (const p of proj.prvky) {
      const pr = prvekPrimitiva(p).filter((q) => q.role === 'cut');
      for (const q of pr) {
        i++;
        const bb = ohraniceniPrimitiv([q]);
        const c = q.t === 'kruh' ? { x: q.cx, y: q.cy } : { x: bb.cx, y: bb.cy };
        const z = naZobrazene(proj, c.x, c.y, kod);
        const nazev = p.typ === 'konektor' || p.typ === 'ovladac' ? katalogPolozka(p.typ, p.druh).nazev : (p.montazni ? 'Montážní otvor' : TYPY[p.typ].nazev);
        rad.push({ c: i, id: p.id, nazev, x: zaokr(z.x, 4), y: zaokr(z.y, 4), rozmer: popisOtvoru(q), prumer: q.t === 'kruh' ? zaokr(q.r * 2, 4) : null });
      }
    }
    return rad;
  }

  /* ---------- kontrola výroby ---------- */
  function kontrola(proj, m = {}) {
    const M = Object.assign({ minMustek: 1.5, minText: 1.5, minTah: 0.1 }, m);
    const W = proj.panel.sirka, H = proj.panel.vyska, out = [];
    const add = (uroven, text, ids) => out.push({ uroven, text, ids: ids || [] });
    const otvory = [], zabory = [];
    for (const p of proj.prvky) {
      const pr = prvekPrimitiva(p);
      for (const q of pr) {
        if (q.role === 'cut') { const bb = ohraniceniPrimitiv([q]); otvory.push({ p, q, bb }); }
        if (q.role === 'nahled' && !q.vypln && q.t === 'kruh') zabory.push({ p, q });
        if (q.t === 'text' && (q.role === 'graf') && q.vel < M.minText) add('varovani', `Text „${q.text}“ má výšku verzálek ${fmt(q.vel)} mm – pod ${fmt(M.minText)} mm bývá při tisku i gravírování nečitelný.`, [p.id]);
        if (q.t !== 'text' && q.role === 'graf' && !q.vypln && q.tah > 0 && q.tah < M.minTah) add('varovani', `${TYPY[p.typ].nazev}: tloušťka čáry ${fmt(q.tah)} mm je pod ${fmt(M.minTah)} mm.`, [p.id]);
      }
      const bb = ohraniceniPrvku(p, {}, ['cut', 'graf']);
      if (bb && (bb.x1 < 0 || bb.y1 < 0 || bb.x0 > W || bb.y0 > H)) add('chyba', `${TYPY[p.typ].nazev} leží celý mimo panel.`, [p.id]);
      else if (bb && (bb.x0 < -1e-6 || bb.y0 < -1e-6 || bb.x1 > W + 1e-6 || bb.y1 > H + 1e-6)) {
        const jenGraf = !pr.some((q) => q.role === 'cut' && (() => { const b = ohraniceniPrimitiv([q]); return b.x0 < 0 || b.y0 < 0 || b.x1 > W || b.y1 > H; })());
        add(jenGraf ? 'varovani' : 'chyba', `${TYPY[p.typ].nazev} přesahuje okraj panelu.`, [p.id]);
      }
    }
    // můstek k okraji
    for (const o of otvory) {
      const b = o.bb, d = Math.min(b.x0, b.y0, W - b.x1, H - b.y1);
      if (!o.p.montazni && d >= 0 && d < M.minMustek) add('varovani', `Otvor (${popisOtvoru(o.q)}) je jen ${fmt(d)} mm od okraje panelu (doporučeno ≥ ${fmt(M.minMustek)} mm).`, [o.p.id]);
    }
    // otvor vs otvor
    for (let i = 0; i < otvory.length; i++) for (let j = i + 1; j < otvory.length; j++) {
      const a = otvory[i], b = otvory[j];
      let d;
      if (a.q.t === 'kruh' && b.q.t === 'kruh') d = Math.hypot(a.q.cx - b.q.cx, a.q.cy - b.q.cy) - a.q.r - b.q.r;
      else d = Math.max(a.bb.x0 - b.bb.x1, b.bb.x0 - a.bb.x1, a.bb.y0 - b.bb.y1, b.bb.y0 - a.bb.y1);
      if (d < -1e-6) add('chyba', `Otvory se překrývají (${popisOtvoru(a.q)} a ${popisOtvoru(b.q)}).`, [a.p.id, b.p.id]);
      else if (d < M.minMustek) add('varovani', `Můstek mezi otvory je jen ${fmt(d)} mm (${popisOtvoru(a.q)} a ${popisOtvoru(b.q)}).`, [a.p.id, b.p.id]);
    }
    // zábory knoflíků a matic
    for (let i = 0; i < zabory.length; i++) for (let j = i + 1; j < zabory.length; j++) {
      const a = zabory[i].q, b = zabory[j].q;
      if (zabory[i].p.id === zabory[j].p.id) continue;
      const d = Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.r - b.r;
      if (d < -1e-6) add('varovani', `Zábor (knoflík, matice) dvou prvků se překrývá o ${fmt(-d)} mm.`, [zabory[i].p.id, zabory[j].p.id]);
    }
    // specifika norem
    const typ = proj.panel.typ;
    if (typ === 'eurorack' || typ === 'eurorack1u') {
      const pas = typ === 'eurorack' ? 9.5 : 4;
      for (const o of otvory) if (!o.p.montazni && (o.bb.y0 < pas || o.bb.y1 > H - pas))
        add('varovani', `Otvor zasahuje do pásu ${fmt(pas)} mm u horní/dolní hrany – za panelem jsou montážní lišty, součástka se tam obvykle nevejde.`, [o.p.id]);
    }
    if (typ === 'rack19' || typ === 'rack10') {
      for (const o of otvory) if (!o.p.montazni && (o.bb.x0 < 15.9 || o.bb.x1 > W - 15.9))
        add('varovani', 'Otvor leží v oblasti uší racku (15,9 mm od kraje) – zakryje ho sloupek racku.', [o.p.id]);
    }
    return out;
  }

  /* ---------- tisk: dlaždice a kalibrace ---------- */
  /* Rozdělí plochu W×H na stránky s užitnou plochou pw×ph a překryvem. */
  function dlazdice(W, H, pw, ph, prekryv = 10) {
    const krokX = pw - prekryv, krokY = ph - prekryv;
    if (krokX <= 0 || krokY <= 0) throw new Error('Překryv je větší než užitná plocha stránky.');
    const nx = W <= pw ? 1 : Math.ceil((W - prekryv) / krokX), ny = H <= ph ? 1 : Math.ceil((H - prekryv) / krokY);
    const out = [];
    for (let r = 0; r < ny; r++) for (let s = 0; s < nx; s++) {
      const x0 = s * krokX, y0 = r * krokY;
      out.push({ s, r, x0: zaokr(x0), y0: zaokr(y0), w: zaokr(Math.min(pw, W - x0)), h: zaokr(Math.min(ph, H - y0)) });
    }
    return { nx, ny, dily: out };
  }
  /* Korekce měřítka: kolikrát zvětšit, aby úsek „ocekavano“ měřil po tisku přesně. */
  function korekceMeritka(namereno, ocekavano = 100) {
    if (!(namereno > 0)) return { faktor: 1, odchylka: 0, zprava: 'Zadejte naměřenou délku.' , stav: 'nic' };
    const faktor = ocekavano / namereno, odch = (namereno - ocekavano) / ocekavano * 100;
    let stav = 'ok', zprava = 'Tiskárna tiskne přesně (odchylka ' + fmt(odch, 2) + ' %).';
    if (Math.abs(odch) > 0.3) { stav = 'mez'; zprava = 'Odchylka ' + fmt(odch, 2) + ' % – lze kompenzovat korekcí ' + fmt(faktor * 100, 2) + ' %.'; }
    if (Math.abs(odch) > 2) { stav = 'chyba'; zprava = 'Odchylka ' + fmt(odch, 1) + ' % je příliš velká – nejspíš je v tiskovém dialogu zapnuto „Přizpůsobit stránce“. Zvolte „Skutečná velikost / 100 %“ a vytiskněte znovu; korekci použijte jen na zbytkovou chybu.'; }
    return { faktor, odchylka: odch, zprava, stav };
  }

  const API = {
    MM_NA_PT, HP, U19, EURO_3U, mmNaPt, ptNaMm, fmt, vyraz, zaokr,
    eurorackSirka, eurorackOtvory, rack19Vyska, rack19Otvory, SABLONY, ARCHY, archPozice, archKontrola,
    KONEKTORY, OVLADACE, SYMBOLY, ZNACKY, TYPY, katalogPolozka,
    obdCesta, dCesta, klicCesta, dsubCesta, obloukStred, obloukNaBeziery, kruhNaBeziery, cestaBezOblouku, zplostiCestu, extremyCesty,
    PISMA, nastavPismo, pismoPro, emProVel, vyskaVerzalekEm, sirkaTextu, textNaPrikazy,
    transformuj, nahradPromenne, stupniceUhly, stupnicePrimitiva, stupniceVnejsi, symbolPrimitiva, znackaPrimitiva, kotaHodnota, kotaPrimitiva,
    lokalniPrimitiva, prvekPrimitiva, ohraniceniPrimitiv, ohraniceniPrvku, prichyt, zarovnej, rozmisti,
    radaLinearni, radaMrizka, radaKruhova, radaMezi, noveId, novyPrvek, novyProjekt, nactiProjekt, vychoziVrstvy, vychoziVrstvaPro,
    obrysPrimitivum, vsechnaPrimitiva, cestaNaD, primNaSvg, escXml, doSvg, doDxf, pocatekBod, naZobrazene, zZobrazenych,
    tabulkaOtvoru, popisOtvoru, kontrola, dlazdice, korekceMeritka,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.SP = API;
})();
