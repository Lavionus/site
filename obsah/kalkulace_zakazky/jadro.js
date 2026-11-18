/* Kalkulace truhlářské zakázky – jádro bez DOM (test: _test/kalkulace_zakazky_test.js).
   Ceník materiálů, zakázky s variantami (materiál s prořezem, práce po operacích),
   režie, marže/přirážka, DPH podle data plnění, plán vs. skutečnost,
   CSV ceníku a import kusovníku z Řezného plánu a Návrhu skříní. */
(function (koren) {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_kalkulace_zakazky';

  /* Sazby DPH v ČR podle data uskutečnění plnění (zákon č. 235/2004 Sb.; od 1. 1. 2024
     novela 349/2023 Sb. sloučila snížené sazby 15 % a 10 % do 12 %). Stav 11/2026. */
  const SAZBY_DPH = [
    { od: '2024-01-01', zakladni: 21, snizena: 12, druha: null },
    { od: '2015-01-01', zakladni: 21, snizena: 15, druha: 10 },
    { od: '2013-01-01', zakladni: 21, snizena: 15, druha: null },
  ];
  const DRUHY_DPH = [
    { id: 'zakladni', nazev: 'základní' },
    { id: 'snizena', nazev: 'snížená (bydlení)' },
    { id: 'druha', nazev: 'druhá snížená (2015–2023)' },
  ];

  const KATEGORIE = [
    { id: 'deska', nazev: 'Desky', jednotka: 'm²', prorez: 15 },
    { id: 'hrana', nazev: 'Hranování', jednotka: 'bm', prorez: 10 },
    { id: 'masiv', nazev: 'Masiv', jednotka: 'm³', prorez: 30 },
    { id: 'kovani', nazev: 'Kování', jednotka: 'ks', prorez: 0 },
    { id: 'povrch', nazev: 'Povrchová úprava', jednotka: 'm²', prorez: 10 },
    { id: 'spoj', nazev: 'Spojovací materiál', jednotka: 'ks', prorez: 5 },
    { id: 'jine', nazev: 'Ostatní', jednotka: 'ks', prorez: 0 },
  ];
  const KAT = Object.fromEntries(KATEGORIE.map((k) => [k.id, k]));
  const JEDNOTKY = ['m²', 'bm', 'm³', 'ks', 'pár', 'kg', 'l', 'bal', 'h', 'km', 'kpl'];

  /* Výchozí sazby a ceny jsou orientační (stav 11/2026) – uživatel si je přepíše. */
  const OPERACE_VYCHOZI = [
    { id: 'navrh', nazev: 'Zaměření a návrh', jednotka: 'h', sazba: 550 },
    { id: 'rezani', nazev: 'Řezání (formátovací pila)', jednotka: 'h', sazba: 650 },
    { id: 'olepovani', nazev: 'Olepování hran', jednotka: 'h', sazba: 650 },
    { id: 'cnc', nazev: 'CNC obrábění', jednotka: 'h', sazba: 1200 },
    { id: 'povrch', nazev: 'Broušení a povrchová úprava', jednotka: 'h', sazba: 550 },
    { id: 'montaz', nazev: 'Montáž v dílně', jednotka: 'h', sazba: 550 },
    { id: 'montazu', nazev: 'Montáž u zákazníka', jednotka: 'h', sazba: 650 },
    { id: 'doprava', nazev: 'Doprava', jednotka: 'km', sazba: 16 },
  ];
  const CENIK_VYCHOZI = [
    ['DTD18B', 'DTD laminovaná 18 mm bílá', 'deska', 'm²', 290, 15],
    ['DTD18D', 'DTD laminovaná 18 mm dekor dub', 'deska', 'm²', 360, 15],
    ['MDF18', 'MDF 18 mm surová', 'deska', 'm²', 280, 15],
    ['HDF3', 'HDF 3 mm bílá (záda)', 'deska', 'm²', 95, 10],
    ['PREK18', 'Překližka bříza 18 mm', 'deska', 'm²', 950, 15],
    ['SPAR20D', 'Spárovka dub 20 mm', 'deska', 'm²', 2100, 20],
    ['ABS08', 'ABS hrana 0,8 × 22 mm', 'hrana', 'bm', 9, 10],
    ['ABS2', 'ABS hrana 2 × 22 mm', 'hrana', 'bm', 22, 10],
    ['MDUB', 'Masiv dub, fošny sušené', 'masiv', 'm³', 48000, 35],
    ['MSMRK', 'Masiv smrk KVH', 'masiv', 'm³', 12500, 20],
    ['ZAV110', 'Závěs nábytkový 110° s tlumením + podložka', 'kovani', 'ks', 95, 0],
    ['VYS500', 'Plnovýsuv s tlumením 500 mm (pár)', 'kovani', 'pár', 520, 0],
    ['UCH128', 'Úchytka 128 mm', 'kovani', 'ks', 85, 0],
    ['NOH100', 'Nožička rektifikační 100 mm', 'kovani', 'ks', 25, 0],
    ['OLEJ', 'Tvrdý voskový olej (2 vrstvy)', 'povrch', 'm²', 160, 10],
    ['LAK', 'Lak PU bezbarvý (základ + vrchní)', 'povrch', 'm²', 140, 10],
    ['KONF', 'Konfirmát 7 × 50', 'spoj', 'ks', 2, 5],
    ['KOLIK8', 'Kolík 8 × 35', 'spoj', 'ks', 0.6, 5],
    ['LEP', 'Lepidlo D3 (1 kg)', 'spoj', 'kg', 210, 0],
  ].map(([kod, nazev, kategorie, jednotka, cena, prorez]) => ({ kod, nazev, kategorie, jednotka, cena, prorez }));

  const STAVY = [
    { id: 'poptavka', nazev: 'Poptávka' }, { id: 'nabidka', nazev: 'Nabídka odeslána' },
    { id: 'prijata', nazev: 'Přijata' }, { id: 'hotova', nazev: 'Hotová' }, { id: 'zrusena', nazev: 'Nepřijata' },
  ];

  /* ---------- pomocné ---------- */
  const id = () => Math.random().toString(36).slice(2, 10);
  const kopie = (x) => JSON.parse(JSON.stringify(x));
  const dvoj = (n) => String(n).padStart(2, '0');
  function dnesIso(d) { d = d || new Date(); return d.getFullYear() + '-' + dvoj(d.getMonth() + 1) + '-' + dvoj(d.getDate()); }
  const jeDatum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  function cislo(x, vych) {
    if (typeof x === 'number') return isFinite(x) ? x : (vych === undefined ? 0 : vych);
    const n = parseFloat(String(x == null ? '' : x).replace(/\s| /g, '').replace(',', '.'));
    return isFinite(n) ? n : (vych === undefined ? 0 : vych);
  }
  const zaokr = (x, d) => { const k = Math.pow(10, d == null ? 2 : d); return Math.round((x + Number.EPSILON) * k) / k; };
  function bezDiakritiky(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  const normNazev = (s) => bezDiakritiky(s).toLowerCase().replace(/[×x*]/g, 'x').replace(/\s+/g, ' ').trim();

  /** Bezpečný výpočet výrazu: čísla (i s desetinnou čárkou), + - * / ( ) a ×. Neplatný → NaN. */
  function vyraz(text) {
    const s = String(text == null ? '' : text).replace(/\s| /g, '').replace(/×/g, '*').replace(/,/g, '.');
    if (!s) return 0;
    let i = 0;
    const cti = () => {
      let h = clen();
      while (s[i] === '+' || s[i] === '-') { const o = s[i++]; const b = clen(); h = o === '+' ? h + b : h - b; }
      return h;
    };
    const clen = () => {
      let h = faktor();
      while (s[i] === '*' || s[i] === '/') { const o = s[i++]; const b = faktor(); h = o === '*' ? h * b : h / b; }
      return h;
    };
    const faktor = () => {
      if (s[i] === '-') { i++; return -faktor(); }
      if (s[i] === '(') { i++; const h = cti(); if (s[i++] !== ')') throw 0; return h; }
      const m = /^\d+(\.\d+)?|^\.\d+/.exec(s.slice(i));
      if (!m) throw 0;
      i += m[0].length; return parseFloat(m[0]);
    };
    try { const h = cti(); return i === s.length && isFinite(h) ? h : NaN; } catch (e) { return NaN; }
  }

  function formatCislo(x, des) {
    const d = des == null ? 2 : des;
    return Number(x || 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: d });
  }
  function formatKc(x, des) {
    return Number(x || 0).toLocaleString('cs-CZ', { minimumFractionDigits: des || 0, maximumFractionDigits: des || 0 }).replace(/\s/g, ' ') + ' Kč';
  }

  /* ---------- DPH ---------- */
  function sazbaDph(datum, druh) {
    const d = jeDatum(datum) ? datum : dnesIso();
    const s = SAZBY_DPH.find((x) => d >= x.od) || SAZBY_DPH[SAZBY_DPH.length - 1];
    const v = s[druh || 'zakladni'];
    return v == null ? s.snizena : v;
  }

  /* ---------- data ---------- */
  function vychoziNastaveni() {
    return {
      firma: { nazev: '', adresa: '', ico: '', dic: '', telefon: '', email: '', web: '', banka: '' },
      platce: true, rezie: 25, rezieZaklad: 'prime', marze: 20, marzeRezim: 'prirazka', zaokrouhleni: 10,
      platnostDni: 30, operace: kopie(OPERACE_VYCHOZI),
      normy: { rezaniMinDilec: 2, olepovaniBmH: 40 },
      podminky: 'Cena je platná po dobu platnosti nabídky. Záloha 50 % při objednání, doplatek po předání. Termín dodání dle dohody.',
    };
  }
  function prazdna() {
    return { verze: VERZE, nastaveni: vychoziNastaveni(), cenik: CENIK_VYCHOZI.map((c) => Object.assign({ id: id() }, c)), zakazky: [], aktivni: null };
  }
  function normPolozka(p) {
    p = p || {};
    const kat = KAT[p.kategorie] ? p.kategorie : 'jine';
    return {
      id: p.id || id(), kategorie: kat, nazev: String(p.nazev || '').slice(0, 200), mnozstvi: String(p.mnozstvi == null ? '' : p.mnozstvi).slice(0, 120),
      jednotka: String(p.jednotka || KAT[kat].jednotka), cena: cislo(p.cena), prorez: Math.max(0, cislo(p.prorez, KAT[kat].prorez)), pozn: String(p.pozn || '').slice(0, 300),
    };
  }
  function normPrace(p) {
    p = p || {};
    return { id: p.id || id(), operace: String(p.operace || ''), nazev: String(p.nazev || '').slice(0, 200), mnozstvi: String(p.mnozstvi == null ? '' : p.mnozstvi).slice(0, 120), jednotka: String(p.jednotka || 'h'), sazba: cislo(p.sazba) };
  }
  function normVarianta(v, nast) {
    v = v || {}; nast = nast || vychoziNastaveni();
    return {
      id: v.id || id(), nazev: String(v.nazev || 'Varianta A').slice(0, 80),
      polozky: (Array.isArray(v.polozky) ? v.polozky : []).map(normPolozka),
      prace: (Array.isArray(v.prace) ? v.prace : []).map(normPrace),
      rezie: cislo(v.rezie, nast.rezie), rezieZaklad: v.rezieZaklad === 'prace' ? 'prace' : (v.rezieZaklad || nast.rezieZaklad) === 'prace' ? 'prace' : 'prime',
      marze: cislo(v.marze, nast.marze), marzeRezim: (v.marzeRezim || nast.marzeRezim) === 'marze' ? 'marze' : 'prirazka',
    };
  }
  function normZakazka(z, nast) {
    z = z || {};
    const varianty = (Array.isArray(z.varianty) && z.varianty.length ? z.varianty : [{}]).map((v) => normVarianta(v, nast));
    const sk = z.skutecnost && typeof z.skutecnost === 'object' ? z.skutecnost : null;
    return {
      id: z.id || id(), cislo: String(z.cislo || ''), nazev: String(z.nazev || 'Nová zakázka').slice(0, 150),
      zakaznik: { jmeno: '', adresa: '', kontakt: '', ...(z.zakaznik || {}) },
      datum: jeDatum(z.datum) ? z.datum : dnesIso(), plneni: jeDatum(z.plneni) ? z.plneni : '',
      stav: STAVY.some((s) => s.id === z.stav) ? z.stav : 'poptavka', druhDph: DRUHY_DPH.some((d) => d.id === z.druhDph) ? z.druhDph : 'zakladni',
      popis: String(z.popis || ''), podminky: z.podminky == null ? null : String(z.podminky),
      varianty, vybrana: varianty.some((v) => v.id === z.vybrana) ? z.vybrana : varianty[0].id,
      skutecnost: sk ? {
        material: (sk.material || []).map((m) => ({ id: m.id || id(), nazev: String(m.nazev || ''), plan: cislo(m.plan), castka: cislo(m.castka) })),
        prace: (sk.prace || []).map((p) => ({ id: p.id || id(), nazev: String(p.nazev || ''), jednotka: String(p.jednotka || 'h'), plan: cislo(p.plan), mnozstvi: cislo(p.mnozstvi), sazba: cislo(p.sazba) })),
        jine: (sk.jine || []).map((p) => ({ id: p.id || id(), nazev: String(p.nazev || ''), castka: cislo(p.castka) })),
      } : null,
      upraveno: z.upraveno || '',
    };
  }
  function migruj(d) {
    const p = prazdna();
    if (!d || typeof d !== 'object') return p;
    const vn = vychoziNastaveni();
    const n = Object.assign(vn, d.nastaveni || {});
    n.firma = Object.assign(vychoziNastaveni().firma, (d.nastaveni || {}).firma || {});
    n.normy = Object.assign(vychoziNastaveni().normy, (d.nastaveni || {}).normy || {});
    n.operace = (Array.isArray(n.operace) && n.operace.length ? n.operace : kopie(OPERACE_VYCHOZI)).map((o) => ({ id: String(o.id || id()), nazev: String(o.nazev || 'Operace'), jednotka: String(o.jednotka || 'h'), sazba: cislo(o.sazba) }));
    n.platce = n.platce !== false;
    const cenik = Array.isArray(d.cenik) ? d.cenik.map(normCenik) : p.cenik;
    const zakazky = Array.isArray(d.zakazky) ? d.zakazky.map((z) => normZakazka(z, n)) : [];
    return { verze: VERZE, nastaveni: n, cenik, zakazky, aktivni: zakazky.some((z) => z.id === d.aktivni) ? d.aktivni : (zakazky[0] ? zakazky[0].id : null) };
  }
  function normCenik(c) {
    c = c || {};
    const kat = KAT[c.kategorie] ? c.kategorie : 'jine';
    return { id: c.id || id(), kod: String(c.kod || '').slice(0, 40), nazev: String(c.nazev || '').slice(0, 200), kategorie: kat, jednotka: String(c.jednotka || KAT[kat].jednotka), cena: cislo(c.cena), prorez: Math.max(0, cislo(c.prorez, KAT[kat].prorez)) };
  }

  function cisloZakazky(zakazky, datum) {
    const rok = String(datum || dnesIso()).slice(0, 4);
    let max = 0;
    for (const z of zakazky || []) { const m = new RegExp('^' + rok + '-(\\d+)$').exec(z.cislo); if (m) max = Math.max(max, +m[1]); }
    return rok + '-' + String(max + 1).padStart(3, '0');
  }
  function novaZakazka(data) {
    const z = normZakazka({}, data.nastaveni);
    z.cislo = cisloZakazky(data.zakazky, z.datum);
    return z;
  }
  function duplikujVariantu(v, nazev) {
    const k = kopie(v); k.id = id(); k.nazev = nazev || (v.nazev + ' (kopie)');
    k.polozky.forEach((p) => { p.id = id(); }); k.prace.forEach((p) => { p.id = id(); });
    return k;
  }
  function duplikujZakazku(data, z) {
    const k = normZakazka(kopie(z), data.nastaveni);
    k.id = id(); k.cislo = cisloZakazky(data.zakazky, dnesIso()); k.nazev = z.nazev + ' (kopie)'; k.datum = dnesIso();
    k.stav = 'poptavka'; k.skutecnost = null;
    k.varianty = k.varianty.map((v) => { const n = duplikujVariantu(v, v.nazev); if (v.id === z.vybrana) k.vybrana = n.id; return n; });
    if (!k.varianty.some((v) => v.id === k.vybrana)) k.vybrana = k.varianty[0].id;
    return k;
  }

  /* ---------- výpočet ---------- */
  function zaokrouhli(x, krok) { krok = cislo(krok, 1); return krok > 0 ? Math.round(x / krok) * krok : zaokr(x); }
  function radekMaterialu(p) {
    const mn = vyraz(p.mnozstvi);
    const ok = isFinite(mn);
    const m = ok ? mn : 0;
    const spotreba = m * (1 + cislo(p.prorez) / 100);
    return { ok, mnozstvi: m, spotreba, zaklad: m * p.cena, celkem: spotreba * p.cena };
  }
  function radekPrace(p) { const mn = vyraz(p.mnozstvi), ok = isFinite(mn); return { ok, mnozstvi: ok ? mn : 0, celkem: (ok ? mn : 0) * p.sazba }; }

  /** Přirážky a ceny z přímých nákladů. o: {rezie, rezieZaklad, marze, marzeRezim}, n: nastavení, sazba DPH v % */
  function cenaZNakladu(material, prace, o, n, dph) {
    const prime = material + prace;
    const rezie = (o.rezieZaklad === 'prace' ? prace : prime) * cislo(o.rezie) / 100;
    const naklady = prime + rezie;
    const m = Math.min(cislo(o.marze), 95);
    const cenaRaw = o.marzeRezim === 'marze' ? naklady / (1 - m / 100) : naklady * (1 + m / 100);
    const cenaBezDph = zaokrouhli(cenaRaw, n.zaokrouhleni);
    const sazba = n.platce ? dph : 0;
    const dphKc = zaokr(cenaBezDph * sazba / 100);
    return { prime, rezie, naklady, cenaBezDph, zisk: cenaBezDph - naklady, marzeNaCene: cenaBezDph > 0 ? (cenaBezDph - naklady) / cenaBezDph * 100 : 0, sazbaDph: sazba, dph: dphKc, cenaSDph: zaokr(cenaBezDph + dphKc) };
  }
  function spocitejVariantu(v, n, dph) {
    const kat = {}; let mat = 0, zaklad = 0, chyby = 0, bezCeny = 0;
    for (const p of v.polozky) {
      const r = radekMaterialu(p);
      if (!r.ok) chyby++;
      if (!p.cena && r.mnozstvi) bezCeny++;
      mat += r.celkem; zaklad += r.zaklad;
      kat[p.kategorie] = (kat[p.kategorie] || 0) + r.celkem;
    }
    let prace = 0, hodiny = 0; const operace = {};
    for (const p of v.prace) {
      const r = radekPrace(p);
      if (!r.ok) chyby++;
      prace += r.celkem; if (p.jednotka === 'h') hodiny += r.mnozstvi;
      const k = p.operace || p.nazev; operace[k] = (operace[k] || 0) + r.celkem;
    }
    return Object.assign({ materialZaklad: zaklad, prorez: mat - zaklad, material: mat, kategorie: kat, prace, hodiny, operace, chyby, bezCeny }, cenaZNakladu(mat, prace, v, n, dph));
  }
  function dphZakazky(z) { return sazbaDph(z.plneni || z.datum, z.druhDph); }

  /* ---------- plán vs. skutečnost ---------- */
  function skutecnostZPlanu(v, n) {
    return {
      material: v.polozky.map((p) => { const c = zaokr(radekMaterialu(p).celkem); return { id: id(), nazev: p.nazev || KAT[p.kategorie].nazev, plan: c, castka: c }; }),
      prace: v.prace.map((p) => { const r = radekPrace(p); const op = (n.operace || []).find((o) => o.id === p.operace); return { id: id(), nazev: p.nazev || (op ? op.nazev : 'Práce'), jednotka: p.jednotka, plan: r.mnozstvi, mnozstvi: r.mnozstvi, sazba: p.sazba }; }),
      jine: [],
    };
  }
  function srovnani(z, n) {
    const v = z.varianty.find((x) => x.id === z.vybrana) || z.varianty[0];
    const dph = dphZakazky(z);
    const plan = spocitejVariantu(v, n, dph);
    const sk = z.skutecnost || skutecnostZPlanu(v, n);
    const material = sk.material.reduce((a, m) => a + m.castka, 0);
    const jine = sk.jine.reduce((a, m) => a + m.castka, 0);
    const prace = sk.prace.reduce((a, p) => a + p.mnozstvi * p.sazba, 0);
    const hodiny = sk.prace.filter((p) => p.jednotka === 'h').reduce((a, p) => a + p.mnozstvi, 0);
    const prime = material + jine + prace;
    const rezie = (v.rezieZaklad === 'prace' ? prace : prime) * cislo(v.rezie) / 100;
    const naklady = prime + rezie;
    const zisk = plan.cenaBezDph - naklady;
    return {
      varianta: v, plan,
      skut: { material, jine, prace, hodiny, prime, rezie, naklady, zisk, marzeNaCene: plan.cenaBezDph > 0 ? zisk / plan.cenaBezDph * 100 : 0 },
      rozdil: { material: material + jine - plan.material, prace: prace - plan.prace, hodiny: hodiny - plan.hodiny, naklady: naklady - plan.naklady, zisk: zisk - plan.zisk },
      hodinovyVydelek: hodiny > 0 ? (plan.cenaBezDph - material - jine) / hodiny : null,
    };
  }

  /* ---------- CSV ---------- */
  function parsujCsv(text) {
    text = String(text || '').replace(/^﻿/, '');
    const prvni = text.split(/\r?\n/).find((r) => r.trim()) || '';
    const odd = ['\t', ';', ','].map((o) => [o, prvni.split(o).length]).sort((a, b) => b[1] - a[1])[0][0];
    const radky = []; let r = [], pole = '', uv = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (uv) {
        if (c === '"') { if (text[i + 1] === '"') { pole += '"'; i++; } else uv = false; } else pole += c;
      } else if (c === '"' && pole === '') uv = true;
      else if (c === odd) { r.push(pole); pole = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; r.push(pole); radky.push(r); r = []; pole = ''; }
      else pole += c;
    }
    if (pole !== '' || r.length) { r.push(pole); radky.push(r); }
    return radky.filter((x) => x.some((p) => p.trim() !== '')).map((x) => x.map((p) => p.trim()));
  }
  const csvPole = (x) => { const s = String(x == null ? '' : x); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csvRadek = (a) => a.map(csvPole).join(';');
  const csvCislo = (x) => String(zaokr(x, 4)).replace('.', ',');

  function cenikDoCsv(cenik) {
    const out = [csvRadek(['kod', 'nazev', 'kategorie', 'jednotka', 'cena_bez_dph', 'prorez_pct'])];
    for (const c of cenik) out.push(csvRadek([c.kod, c.nazev, c.kategorie, c.jednotka, csvCislo(c.cena), csvCislo(c.prorez)]));
    return '﻿' + out.join('\r\n') + '\r\n';
  }
  const ALIASY_CENIK = {
    kod: ['kod', 'code', 'sku', 'cislo'], nazev: ['nazev', 'name', 'material', 'polozka', 'popis'], kategorie: ['kategorie', 'category', 'druh', 'skupina'],
    jednotka: ['jednotka', 'unit', 'mj'], cena: ['cena_bez_dph', 'cena', 'price', 'cena_mj', 'jednotkova_cena'], prorez: ['prorez_pct', 'prorez', 'odpad', 'waste'],
  };
  function kategorieZTextu(t, jednotka) {
    const s = normNazev(t);
    for (const k of KATEGORIE) if (s === k.id || s === normNazev(k.nazev)) return k.id;
    if (/hran|abs|pvc/.test(s)) return 'hrana';
    if (/masiv|fosn|hranol|kvh|prkn/.test(s)) return 'masiv';
    if (/kovan|zaves|vysuv|uchyt|nozk|panty?/.test(s)) return 'kovani';
    if (/olej|lak|mori|vosk|povrch|barv/.test(s)) return 'povrch';
    if (/vrut|konfirm|kolik|lepid|sroub|spoj/.test(s)) return 'spoj';
    if (/dtd|mdf|hdf|prekl|desk|sparov|osb/.test(s)) return 'deska';
    const j = String(jednotka || '').replace('2', '²').replace('3', '³');
    return { 'm²': 'deska', bm: 'hrana', 'm³': 'masiv' }[j] || 'jine';
  }
  /** → { polozky: [...], chyby: [text] } */
  function cenikZCsv(text) {
    const r = parsujCsv(text), chyby = [], polozky = [];
    if (!r.length) return { polozky, chyby: ['Soubor je prázdný.'] };
    const hl = r[0].map((h) => normNazev(h).replace(/[\s.-]+/g, '_'));
    const sl = {};
    for (const [k, al] of Object.entries(ALIASY_CENIK)) { const i = hl.findIndex((h) => al.includes(h)); if (i >= 0) sl[k] = i; }
    let data = r.slice(1);
    if (sl.nazev == null) {
      // bez hlavičky: nazev;jednotka;cena (případně kod;nazev;jednotka;cena)
      data = r;
      const s4 = r[0].length >= 4 && isFinite(cislo(r[0][3], NaN));
      Object.assign(sl, s4 ? { kod: 0, nazev: 1, jednotka: 2, cena: 3 } : { nazev: 0, jednotka: 1, cena: 2 });
    }
    data.forEach((x, i) => {
      const nazev = x[sl.nazev] || '';
      if (!nazev) return;
      const cena = cislo(sl.cena != null ? x[sl.cena] : '', NaN);
      if (!isFinite(cena)) { chyby.push(`Řádek ${i + 2}: „${nazev}“ nemá cenu.`); return; }
      const jednotka = (sl.jednotka != null && x[sl.jednotka]) ? x[sl.jednotka].replace(/^m2$/i, 'm²').replace(/^m3$/i, 'm³') : '';
      const kategorie = sl.kategorie != null && x[sl.kategorie] ? kategorieZTextu(x[sl.kategorie], jednotka) : kategorieZTextu(nazev, jednotka);
      polozky.push(normCenik({ kod: sl.kod != null ? x[sl.kod] : '', nazev, kategorie, jednotka: jednotka || KAT[kategorie].jednotka, cena, prorez: sl.prorez != null && x[sl.prorez] !== '' ? cislo(x[sl.prorez]) : undefined }));
    });
    return { polozky, chyby };
  }
  /** rezim 'sloucit' (přepíše shodné kódy/názvy, přidá nové) nebo 'nahradit' → { cenik, pridano, zmeneno } */
  function slucCenik(cenik, nove, rezim) {
    if (rezim === 'nahradit') return { cenik: nove.map(normCenik), pridano: nove.length, zmeneno: 0 };
    const out = cenik.map((c) => Object.assign({}, c)); let pridano = 0, zmeneno = 0;
    for (const n of nove) {
      const i = out.findIndex((c) => (n.kod && c.kod === n.kod) || normNazev(c.nazev) === normNazev(n.nazev));
      if (i >= 0) { out[i] = Object.assign({}, n, { id: out[i].id }); zmeneno++; } else { out.push(normCenik(n)); pridano++; }
    }
    return { cenik: out, pridano, zmeneno };
  }
  function najdiVCeniku(cenik, nazev, kategorie) {
    const n = normNazev(nazev);
    if (!n) return null;
    return cenik.find((c) => normNazev(c.nazev) === n || (c.kod && normNazev(c.kod) === n)) ||
      (kategorie ? cenik.find((c) => c.kategorie === kategorie && (normNazev(c.nazev).includes(n) || n.includes(normNazev(c.nazev)))) : null) || null;
  }

  /* ---------- import kusovníku ---------- */
  /* Podporované vstupy (jen čtení formátů jiných stránek webu):
     - JSON „kusovnik-v1“ – Řezný plán (Export kusovníku) i Návrh skříní (JSON pro řezný plán)
     - CSV kusovníku z Návrhu skříní (pozice;nazev;delka;sirka;tl;ks;material;…;hrana_d1…, hrany v mm tloušťky)
     - CSV dílců z Řezného plánu (označení;název;materiál;deska;hotová délka;hotová šířka;…;hrana D1…) – kus na řádek
     - obecné CSV s hlavičkou nazev;delka;sirka;ks;material (rozměry v mm) */
  function prectiKusovnik(text) {
    const t = String(text || '').replace(/^﻿/, '').trim();
    if (!t) throw new Error('Soubor je prázdný.');
    if (/^[[{]/.test(t)) {
      let o; try { o = JSON.parse(t); } catch (e) { throw new Error('Neplatný JSON: ' + e.message); }
      if (Array.isArray(o)) o = { dilce: o };
      if (o && o.projekt && typeof o.projekt === 'object' && !Array.isArray(o.dilce)) throw new Error('Tohle je export celého projektu – v původní stránce použijte „Export kusovníku“ / „JSON pro řezný plán“.');
      if (!o || (!Array.isArray(o.dilce) && !Array.isArray(o.tyce))) throw new Error('JSON neobsahuje kusovník (pole „dilce“ nebo „tyce“).');
      const typy = Object.fromEntries((o.hrany_typy || []).map((h) => [h.id, h]));
      const dilce = (o.dilce || []).map((d) => {
        let delka = cislo(d.delka), sirka = cislo(d.sirka), tl = cislo(d.tl);
        if ((!delka || !sirka) && d.rozmer) { const m = String(d.rozmer).match(/[\d.,]+/g) || []; delka = cislo(m[0]); sirka = cislo(m[1]); tl = cislo(m[2]); }
        const hrany = {};
        for (const s of ['d1', 'd2', 's1', 's2']) {
          const h = (d.hrany || {})[s];
          if (h) hrany[s] = typy[h] ? (typy[h].nazev || h) : String(h);
        }
        return { nazev: String(d.nazev || ''), delka, sirka, tl, ks: Math.max(1, cislo(d.ks, 1)), material: String(d.material || 'Deska'), hrany };
      });
      const tyce = (o.tyce || []).map((q) => ({ nazev: String(q.nazev || ''), delka: cislo(q.delka), ks: Math.max(1, cislo(q.ks, 1)), profil: String(q.profil || 'Masiv') }));
      const ceny = {};
      for (const d of o.desky || []) if (cislo(d.cena) > 0 && cislo(d.delka) > 0 && cislo(d.sirka) > 0) ceny[normNazev(d.material)] = cislo(d.cena) / (cislo(d.delka) * cislo(d.sirka) / 1e6);
      for (const h of o.hrany_typy || []) if (cislo(h.cena) > 0) ceny[normNazev(h.nazev || h.id)] = cislo(h.cena);
      return { zdroj: o.zdroj || 'JSON kusovník', projekt: o.projekt || '', dilce, tyce, ceny, desek: null };
    }
    const r = parsujCsv(t);
    const hl = r[0].map((h) => normNazev(h).replace(/[\s.-]+/g, '_'));
    const ix = (...jm) => hl.findIndex((h) => jm.includes(h));
    const dilce = [], tyce = [];
    if (ix('pozice') >= 0 && ix('hrana_d1') >= 0) {
      // Návrh skříní – hrany jako tloušťka v mm
      const c = { n: ix('nazev'), d: ix('delka'), s: ix('sirka'), tl: ix('tl'), ks: ix('ks'), m: ix('material'), h: ['hrana_d1', 'hrana_d2', 'hrana_s1', 'hrana_s2'].map((x) => ix(x)) };
      for (const x of r.slice(1)) {
        const hrany = {};
        ['d1', 'd2', 's1', 's2'].forEach((s, i) => { const v = cislo(x[c.h[i]]); if (v > 0) hrany[s] = 'Hrana ABS ' + formatCislo(v, 1) + ' mm'; });
        dilce.push({ nazev: x[c.n] || '', delka: cislo(x[c.d]), sirka: cislo(x[c.s]), tl: cislo(x[c.tl]), ks: Math.max(1, cislo(x[c.ks], 1)), material: x[c.m] || 'Deska', hrany });
      }
      return { zdroj: 'Návrh skříní (CSV)', projekt: '', dilce, tyce, ceny: {}, desek: null };
    }
    if (ix('oznaceni') >= 0 && ix('hotova_delka') >= 0) {
      const c = { n: ix('nazev'), m: ix('material'), deska: ix('deska'), d: ix('hotova_delka'), s: ix('hotova_sirka'), h: ['hrana_d1', 'hrana_d2', 'hrana_s1', 'hrana_s2'].map((x) => ix(x)) };
      const desky = new Set();
      for (const x of r.slice(1)) {
        if (/^nezarazeno/i.test(bezDiakritiky(x[c.deska] || ''))) continue;
        desky.add((x[c.m] || '') + '|' + (x[c.deska] || ''));
        const hrany = {};
        ['d1', 'd2', 's1', 's2'].forEach((s, i) => { if (x[c.h[i]]) hrany[s] = x[c.h[i]]; });
        dilce.push({ nazev: x[c.n] || '', delka: cislo(x[c.d]), sirka: cislo(x[c.s]), tl: 0, ks: 1, material: x[c.m] || 'Deska', hrany });
      }
      const desek = {};
      for (const k of desky) { const m = k.split('|')[0]; desek[m] = (desek[m] || 0) + 1; }
      return { zdroj: 'Řezný plán (CSV dílců)', projekt: '', dilce, tyce, ceny: {}, desek };
    }
    const c = { n: ix('nazev', 'name', 'dilec'), d: ix('delka', 'length', 'l'), s: ix('sirka', 'width', 'w'), ks: ix('ks', 'pocet', 'qty', 'mnozstvi'), m: ix('material', 'deska', 'profil') };
    if (c.d < 0) throw new Error('Nerozpoznaný formát. Očekávám JSON kusovník, CSV z Návrhu skříní, CSV dílců z Řezného plánu nebo CSV s hlavičkou nazev;delka;sirka;ks;material.');
    for (const x of r.slice(1)) {
      const delka = cislo(x[c.d]), sirka = c.s >= 0 ? cislo(x[c.s]) : 0, ks = Math.max(1, c.ks >= 0 ? cislo(x[c.ks], 1) : 1);
      if (!delka) continue;
      const nazev = c.n >= 0 ? x[c.n] : '', material = (c.m >= 0 && x[c.m]) || '';
      if (sirka > 0) dilce.push({ nazev, delka, sirka, tl: 0, ks, material: material || 'Deska', hrany: {} });
      else tyce.push({ nazev, delka, ks, profil: material || 'Masiv' });
    }
    return { zdroj: 'CSV', projekt: '', dilce, tyce, ceny: {}, desek: null };
  }

  /** Kusovník → položky materiálu (m² desek, bm hran, bm tyčí) + odhad práce podle norem. */
  function kusovnikNaPolozky(k, cenik, nast) {
    const desky = new Map(), hrany = new Map(), tyce = new Map();
    let pocetDilcu = 0, bmHran = 0;
    const pridej = (mapa, klic, mn, pozn) => { const x = mapa.get(klic) || { mn: 0, pozn: new Set() }; x.mn += mn; if (pozn) x.pozn.add(pozn); mapa.set(klic, x); };
    for (const d of k.dilce) {
      pocetDilcu += d.ks;
      pridej(desky, d.material, d.delka * d.sirka * d.ks / 1e6, d.nazev);
      for (const [s, h] of Object.entries(d.hrany || {})) {
        const bm = (s[0] === 'd' ? d.delka : d.sirka) * d.ks / 1000;
        pridej(hrany, h, bm); bmHran += bm;
      }
    }
    for (const q of k.tyce) { pocetDilcu += q.ks; pridej(tyce, q.profil, q.delka * q.ks / 1000, q.nazev); }
    const polozky = [], bezCeny = [];
    const vytvor = (kategorie, nazev, mn, jednotka, pozn) => {
      let c = najdiVCeniku(cenik, nazev, kategorie);
      if (c && c.jednotka !== jednotka) c = null; // jiná jednotka v ceníku → cenu nepřebírat
      const cena = c ? c.cena : (k.ceny[normNazev(nazev)] || 0);
      if (!cena) bezCeny.push(nazev);
      polozky.push(normPolozka({
        kategorie, nazev: c ? c.nazev : nazev, mnozstvi: String(zaokr(mn, 3)).replace('.', ','), jednotka,
        cena: zaokr(cena), prorez: c ? c.prorez : KAT[kategorie].prorez, pozn,
      }));
    };
    for (const [m, x] of desky) {
      const n = k.desek && k.desek[m] ? `řezný plán: ${k.desek[m]} desek` : '';
      vytvor('deska', m, x.mn, 'm²', [n, [...x.pozn].slice(0, 6).join(', ')].filter(Boolean).join(' · '));
    }
    for (const [h, x] of hrany) vytvor('hrana', h, x.mn, 'bm', '');
    for (const [p, x] of tyce) vytvor('masiv', p, x.mn, 'bm', [...x.pozn].slice(0, 6).join(', '));
    const normy = (nast && nast.normy) || vychoziNastaveni().normy;
    const ops = (nast && nast.operace) || OPERACE_VYCHOZI;
    const op = (oid) => ops.find((o) => o.id === oid);
    const prace = [];
    const rezani = pocetDilcu * cislo(normy.rezaniMinDilec) / 60;
    if (rezani > 0 && op('rezani')) prace.push(normPrace({ operace: 'rezani', nazev: `odhad: ${pocetDilcu} dílců × ${formatCislo(normy.rezaniMinDilec)} min`, mnozstvi: String(zaokr(rezani, 2)).replace('.', ','), jednotka: 'h', sazba: op('rezani').sazba }));
    const olep = cislo(normy.olepovaniBmH) > 0 ? bmHran / cislo(normy.olepovaniBmH) : 0;
    if (olep > 0 && op('olepovani')) prace.push(normPrace({ operace: 'olepovani', nazev: `odhad: ${formatCislo(zaokr(bmHran, 1))} bm / ${formatCislo(normy.olepovaniBmH)} bm/h`, mnozstvi: String(zaokr(olep, 2)).replace('.', ','), jednotka: 'h', sazba: op('olepovani').sazba }));
    return { polozky, prace, bezCeny, pocetDilcu, bmHran: zaokr(bmHran, 2), m2: zaokr([...desky.values()].reduce((a, x) => a + x.mn, 0), 3) };
  }

  /* ---------- nabídka ---------- */
  /** Rozpočítání ceny bez DPH do materiálu a práce (poměrem přímých nákladů) – pro rozpis v nabídce. */
  function rozpisCeny(vys) {
    if (!(vys.prime > 0)) return { material: 0, prace: 0 };
    const k = vys.cenaBezDph / vys.prime;
    const material = zaokr(vys.material * k);
    return { material, prace: zaokr(vys.cenaBezDph - material) };
  }
  function platnostDo(datum, dni) {
    const d = new Date((jeDatum(datum) ? datum : dnesIso()) + 'T12:00:00');
    d.setDate(d.getDate() + cislo(dni, 30));
    return dnesIso(d);
  }

  const API = {
    VERZE, KLIC, SAZBY_DPH, DRUHY_DPH, KATEGORIE, KAT, JEDNOTKY, OPERACE_VYCHOZI, CENIK_VYCHOZI, STAVY,
    id, kopie, dnesIso, cislo, zaokr, vyraz, formatCislo, formatKc, normNazev, sazbaDph,
    vychoziNastaveni, prazdna, migruj, normPolozka, normPrace, normVarianta, normZakazka, normCenik,
    cisloZakazky, novaZakazka, duplikujVariantu, duplikujZakazku,
    zaokrouhli, radekMaterialu, radekPrace, cenaZNakladu, spocitejVariantu, dphZakazky,
    skutecnostZPlanu, srovnani, parsujCsv, cenikDoCsv, cenikZCsv, slucCenik, najdiVCeniku, kategorieZTextu,
    prectiKusovnik, kusovnikNaPolozky, rozpisCeny, platnostDo,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.KZ = API;
})(typeof window !== 'undefined' ? window : globalThis);
