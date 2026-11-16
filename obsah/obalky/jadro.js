/* Rozpočet obálkovou metodou – jádro bez DOM (test: _test/obalky_test.js).
   Nulový rozpočet: příjem měsíce se rozdělí do obálek, až nezbude nepřidělená koruna.
   Zůstatky se počítají řetězově od prvního měsíce s daty – nic se „neuzavírá“,
   oprava starého výdaje se propíše do dalších měsíců.
   Na konci měsíce se zůstatek obálky podle její volby:
     prenest – zůstane v obálce, sporeni – kladný zbytek přejde do spořicí obálky,
     prijem  – kladný zbytek se vrátí do příjmu dalšího měsíce.
   Přečerpání (záporný zůstatek) se vždy přenáší do stejné obálky. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_obalky';

  const DRUHY = [
    { id: 'pevne', nazev: '🏠 Pevné výdaje' },
    { id: 'promenlive', nazev: '🛒 Proměnlivé výdaje' },
    { id: 'sporeni', nazev: '🐷 Spoření a cíle' },
    { id: 'rezerva', nazev: '🛟 Rezerva' }
  ];
  const ZBYTKY = [
    { id: 'prenest', nazev: 'přenést do dalšího měsíce' },
    { id: 'sporeni', nazev: 'převést do spoření' },
    { id: 'prijem', nazev: 'vrátit do příjmu dalšího měsíce' }
  ];
  const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

  /* ---------- pomocné ---------- */
  const zaokr = n => Math.round((Number(n) || 0) * 100) / 100;
  const dvoj = n => String(n).padStart(2, '0');
  function dnesIso(d) { d = d || new Date(); return d.getFullYear() + '-' + dvoj(d.getMonth() + 1) + '-' + dvoj(d.getDate()); }
  function jeDatum(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
    const [r, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(r, m - 1, d));
    return dt.getUTCFullYear() === r && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  const jeMesic = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));
  const mesicZ = datum => String(datum).slice(0, 7);
  function posunMesic(m, n) {
    const i = (+m.slice(0, 4)) * 12 + (+m.slice(5, 7) - 1) + n;
    return Math.floor(i / 12) + '-' + dvoj(i % 12 + 1);
  }
  const rozdilMesicu = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  const formatMesic = m => MESICE[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
  const formatDatum = s => jeDatum(s) ? (+s.slice(8, 10)) + '. ' + (+s.slice(5, 7)) + '. ' + s.slice(0, 4) : '';
  function formatKc(n, bezMeny) {
    n = zaokr(n);
    const s = Math.abs(n).toLocaleString('cs-CZ', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
    return (n < 0 ? '−' : '') + s + (bezMeny ? '' : ' Kč');
  }
  function bezDiakritiky(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  let citac = 0;
  function novyId(p) { return (p || 'x') + Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6); }

  /* Částka z textu: „1 234,50“, „-1.234,50 CZK“, „1,234.50“, „−250“ */
  function parsujCastku(s) {
    if (typeof s === 'number') return isFinite(s) ? s : NaN;
    let t = String(s || '').replace(/[\s  ]/g, '').replace(/[−–]/g, '-').replace(/[^\d,.\-+]/g, '');
    if (!t || !/\d/.test(t)) return NaN;
    const neg = /^-|-$/.test(t) || /^\+?-/.test(t);
    t = t.replace(/[+\-]/g, '');
    const c = t.lastIndexOf(','), d = t.lastIndexOf('.');
    if (c >= 0 && d >= 0) t = c > d ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
    else if (c >= 0) t = /^\d{1,3}(,\d{3})+$/.test(t) && t.split(',').length > 2 ? t.replace(/,/g, '') : t.replace(',', '.');
    else if (d >= 0 && t.split('.').length > 2) t = t.replace(/\./g, '');
    const n = parseFloat(t);
    return isNaN(n) ? NaN : (neg ? -n : n);
  }

  /* Datum z výpisu: 15.11.2026, 15. 11. 2026, 2026-11-15, 15/11/2026, 20261115 */
  function parsujDatum(s) {
    s = String(s || '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    let r, mm, d;
    if (m) { r = +m[1]; mm = +m[2]; d = +m[3]; }
    else if ((m = s.match(/^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})/))) { d = +m[1]; mm = +m[2]; r = +m[3]; if (r < 100) r += 2000; }
    else if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) { r = +m[1]; mm = +m[2]; d = +m[3]; }
    else return '';
    const iso = r + '-' + dvoj(mm) + '-' + dvoj(d);
    return jeDatum(iso) ? iso : '';
  }

  /* Měsíc z textu: „2027-06“, „6/2027“, „6.2027“, „06 2027“ → '2027-06' */
  function parsujMesic(s) {
    s = String(s || '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m) return jeMesic(m[1] + '-' + dvoj(+m[2])) ? m[1] + '-' + dvoj(+m[2]) : '';
    m = s.match(/^(\d{1,2})\s*[./ -]\s*(\d{4})$/);
    return m && jeMesic(m[2] + '-' + dvoj(+m[1])) ? m[2] + '-' + dvoj(+m[1]) : '';
  }

  /* ---------- data ---------- */
  function normObalka(o, i) {
    o = o || {};
    const druh = DRUHY.some(d => d.id === o.druh) ? o.druh : 'promenlive';
    const cil = o.cil && zaokr(o.cil.castka) > 0 ? { castka: zaokr(o.cil.castka), termin: jeMesic(o.cil.termin) ? o.cil.termin : '' } : null;
    return {
      id: String(o.id || novyId('o')),
      nazev: String(o.nazev || '').trim().slice(0, 60) || 'Obálka',
      druh,
      zbytek: ZBYTKY.some(z => z.id === o.zbytek) ? o.zbytek : (druh === 'pevne' ? 'prijem' : 'prenest'),
      cil: druh === 'sporeni' ? cil : null,
      skryta: !!o.skryta,
      poradi: isFinite(o.poradi) ? +o.poradi : (i || 0)
    };
  }
  function normVydaj(v) {
    v = v || {};
    return {
      id: String(v.id || novyId('v')),
      datum: jeDatum(v.datum) ? v.datum : dnesIso(),
      castka: zaokr(typeof v.castka === 'number' ? v.castka : parsujCastku(v.castka)),
      obalka: String(v.obalka || ''),
      popis: String(v.popis || '').trim().slice(0, 200),
      ...(v.otisk ? { otisk: String(v.otisk) } : {})
    };
  }
  function normPrijem(p) {
    p = p || {};
    return { id: String(p.id || novyId('p')), popis: String(p.popis || '').trim().slice(0, 80) || 'Příjem', castka: zaokr(typeof p.castka === 'number' ? p.castka : parsujCastku(p.castka)) };
  }
  function prazdna() {
    return { verze: VERZE, obalky: [], mesice: {}, vydaje: [], presuny: [], pravidla: [], nastaveni: { sporeniDo: '', csv: null } };
  }
  function migruj(d) {
    const z = prazdna();
    if (!d || typeof d !== 'object') return z;
    z.obalky = (Array.isArray(d.obalky) ? d.obalky : []).map(normObalka);
    const ids = new Set(z.obalky.map(o => o.id));
    for (const [m, x] of Object.entries(d.mesice && typeof d.mesice === 'object' ? d.mesice : {})) {
      if (!jeMesic(m) || !x) continue;
      const prid = {};
      for (const [id, c] of Object.entries(x.prideleno || {})) if (ids.has(id) && zaokr(c)) prid[id] = zaokr(c);
      z.mesice[m] = { prijmy: (Array.isArray(x.prijmy) ? x.prijmy : []).map(normPrijem).filter(p => p.castka), prideleno: prid };
    }
    z.vydaje = (Array.isArray(d.vydaje) ? d.vydaje : []).filter(v => v && jeDatum(v.datum)).map(normVydaj)
      .map(v => (ids.has(v.obalka) ? v : Object.assign(v, { obalka: '' })));
    z.presuny = (Array.isArray(d.presuny) ? d.presuny : []).filter(p => p && jeMesic(p.mesic) && ids.has(p.z) && ids.has(p.do) && p.z !== p.do && zaokr(p.castka) > 0)
      .map(p => ({ id: String(p.id || novyId('t')), mesic: p.mesic, z: p.z, do: p.do, castka: zaokr(p.castka), popis: String(p.popis || '').slice(0, 120) }));
    z.pravidla = (Array.isArray(d.pravidla) ? d.pravidla : []).filter(p => p && String(p.text || '').trim() && ids.has(p.obalka))
      .map(p => ({ text: String(p.text).trim().slice(0, 60), obalka: p.obalka }));
    const n = d.nastaveni || {};
    z.nastaveni.sporeniDo = ids.has(n.sporeniDo) ? n.sporeniDo : '';
    z.nastaveni.csv = n.csv && typeof n.csv === 'object' ? n.csv : null;
    return z;
  }

  function vychoziObalky() {
    const o = [
      ['Bydlení (nájem, hypotéka)', 'pevne'], ['Energie a voda', 'pevne'], ['Telefon a internet', 'pevne'], ['Pojištění', 'pevne'],
      ['Jídlo a drogerie', 'promenlive'], ['Doprava', 'promenlive'], ['Domácnost', 'promenlive'], ['Oblečení', 'promenlive'], ['Zábava a restaurace', 'promenlive'],
      ['Spoření', 'sporeni'], ['Dovolená', 'sporeni'],
      ['Rezerva na nečekané', 'rezerva']
    ];
    return o.map(([nazev, druh], i) => normObalka({ nazev, druh, poradi: i }));
  }

  const obalkaPodleId = (data, id) => data.obalky.find(o => o.id === id) || null;
  function seradObalky(obalky) {
    const pd = id => DRUHY.findIndex(d => d.id === id);
    return obalky.slice().sort((a, b) => pd(a.druh) - pd(b.druh) || a.poradi - b.poradi || a.nazev.localeCompare(b.nazev, 'cs'));
  }
  function mesic(data, m) {
    if (!data.mesice[m]) data.mesice[m] = { prijmy: [], prideleno: {} };
    return data.mesice[m];
  }

  /* První měsíc, od kterého se zůstatky počítají. */
  function prvniMesic(data) {
    let p = '';
    const zkus = m => { if (jeMesic(m) && (!p || m < p)) p = m; };
    Object.keys(data.mesice).forEach(zkus);
    data.vydaje.forEach(v => zkus(mesicZ(v.datum)));
    data.presuny.forEach(t => zkus(t.mesic));
    return p;
  }

  /* Měsíční cíl spoření: kolik ještě chybí a kolik ukládat měsíčně (vč. aktuálního měsíce). */
  function naCil(cil, mesicNyni, stav) {
    if (!cil) return null;
    const chybi = Math.max(0, zaokr(cil.castka - stav));
    if (!cil.termin) return { chybi, mesicu: null, mesicne: null, splneno: chybi === 0 };
    const mesicu = rozdilMesicu(mesicNyni, cil.termin) + 1;
    const mesicne = chybi === 0 ? 0 : mesicu <= 0 ? chybi : Math.ceil(chybi / mesicu);
    return { chybi, mesicu, mesicne, splneno: chybi === 0, poTerminu: mesicu <= 0 };
  }

  /* Stav jednoho měsíce. Prochází měsíce od prvního s daty a přenáší zůstatky. */
  function spocitej(data, cilovy) {
    const vydajeMes = {};
    for (const v of data.vydaje) (vydajeMes[mesicZ(v.datum)] = vydajeMes[mesicZ(v.datum)] || []).push(v);
    const zacatek = prvniMesic(data);
    let zustatky = {}, prenosNeprideleno = 0, vraceno = 0, vysledek = null;
    let m = zacatek && zacatek <= cilovy ? zacatek : cilovy;
    for (; ; m = posunMesic(m, 1)) {
      const x = data.mesice[m] || { prijmy: [], prideleno: {} };
      const vyd = vydajeMes[m] || [];
      const prijmy = zaokr(x.prijmy.reduce((s, p) => s + p.castka, 0));
      const kDispozici = zaokr(prijmy + prenosNeprideleno + vraceno);
      const rad = data.obalky.map(o => {
        const pocatek = zaokr(zustatky[o.id] || 0);
        const prideleno = zaokr(x.prideleno[o.id] || 0);
        const utraceno = zaokr(vyd.filter(v => v.obalka === o.id).reduce((s, v) => s + v.castka, 0));
        const prichozi = zaokr(data.presuny.filter(t => t.mesic === m && t.do === o.id).reduce((s, t) => s + t.castka, 0));
        const odchozi = zaokr(data.presuny.filter(t => t.mesic === m && t.z === o.id).reduce((s, t) => s + t.castka, 0));
        const zustatek = zaokr(pocatek + prideleno + prichozi - odchozi - utraceno);
        return { obalka: o, pocatek, prideleno, utraceno, prichozi, odchozi, zustatek };
      });
      const prideleno = zaokr(rad.reduce((s, r) => s + r.prideleno, 0));
      const nezarazeno = zaokr(vyd.filter(v => !v.obalka).reduce((s, v) => s + v.castka, 0));
      const neprideleno = zaokr(kDispozici - prideleno - nezarazeno);
      if (m >= cilovy) {
        rad.forEach(r => { r.cil = r.obalka.druh === 'sporeni' ? naCil(r.obalka.cil, m, zaokr(r.pocatek + r.prichozi - r.odchozi - r.utraceno + r.prideleno)) : null; });
        const utraceno = zaokr(vyd.reduce((s, v) => s + v.castka, 0));
        vysledek = { mesic: m, prijmy, zMinula: prenosNeprideleno, vraceno, kDispozici, prideleno, nezarazeno, neprideleno, utraceno,
          zustatekObalek: zaokr(rad.reduce((s, r) => s + r.zustatek, 0)), obalky: rad };
        break;
      }
      // přechod do dalšího měsíce
      const sporDo = obalkaPodleId(data, data.nastaveni.sporeniDo);
      const nove = {};
      vraceno = 0;
      for (const r of rad) {
        const o = r.obalka, b = r.zustatek;
        if (b > 0 && o.zbytek === 'sporeni' && sporDo && sporDo.id !== o.id) nove[sporDo.id] = (nove[sporDo.id] || 0) + b;
        else if (b > 0 && o.zbytek === 'prijem') vraceno += b;
        else nove[o.id] = (nove[o.id] || 0) + b;
      }
      zustatky = nove; vraceno = zaokr(vraceno); prenosNeprideleno = neprideleno;
    }
    return vysledek;
  }

  /* ---------- úpravy ---------- */
  function nastavPrideleno(data, m, id, castka) {
    const x = mesic(data, m);
    castka = zaokr(castka);
    if (castka) x.prideleno[id] = castka; else delete x.prideleno[id];
  }

  /* Šablona: přidělení a příjmy z minulého měsíce. prepsat=false → jen do prázdných. */
  function sablona(data, m, prepsat) {
    const pred = data.mesice[posunMesic(m, -1)];
    if (!pred) return { obalek: 0, prijmu: 0 };
    const x = mesic(data, m);
    let obalek = 0, prijmu = 0;
    for (const o of data.obalky) {
      if (o.skryta || !pred.prideleno[o.id]) continue;
      if (!prepsat && x.prideleno[o.id]) continue;
      x.prideleno[o.id] = pred.prideleno[o.id]; obalek++;
    }
    if (prepsat || !x.prijmy.length) {
      x.prijmy = pred.prijmy.map(p => normPrijem({ popis: p.popis, castka: p.castka }));
      prijmu = x.prijmy.length;
    }
    return { obalek, prijmu };
  }

  /* Spořicí obálky s cílem a termínem: přidělit tolik, kolik je potřeba měsíčně. */
  function podleCilu(data, m) {
    let n = 0;
    const s = spocitej(data, m);
    for (const r of s.obalky) {
      const o = r.obalka;
      if (o.druh !== 'sporeni' || !o.cil || !o.cil.termin || o.skryta) continue;
      const bez = zaokr(r.pocatek + r.prichozi - r.odchozi - r.utraceno);
      const c = naCil(o.cil, m, bez);
      nastavPrideleno(data, m, o.id, c.mesicne); n++;
    }
    return n;
  }

  function pridejVydaj(data, v) { const n = normVydaj(v); data.vydaje.push(n); return n; }
  function smazVydaj(data, id) { data.vydaje = data.vydaje.filter(v => v.id !== id); }
  function pridejPresun(data, t) {
    const castka = zaokr(t.castka);
    if (!obalkaPodleId(data, t.z) || !obalkaPodleId(data, t.do) || t.z === t.do || !(castka > 0) || !jeMesic(t.mesic)) return null;
    const n = { id: novyId('t'), mesic: t.mesic, z: t.z, do: t.do, castka, popis: String(t.popis || '').slice(0, 120) };
    data.presuny.push(n); return n;
  }
  function smazPresun(data, id) { data.presuny = data.presuny.filter(t => t.id !== id); }

  /* Obálku lze smazat jen bez výdajů a přesunů; jinak se skryje. */
  function smazObalku(data, id) {
    const pouzita = data.vydaje.some(v => v.obalka === id) || data.presuny.some(t => t.z === id || t.do === id);
    if (pouzita) { const o = obalkaPodleId(data, id); if (o) o.skryta = true; return 'skryta'; }
    data.obalky = data.obalky.filter(o => o.id !== id);
    for (const x of Object.values(data.mesice)) delete x.prideleno[id];
    data.pravidla = data.pravidla.filter(p => p.obalka !== id);
    if (data.nastaveni.sporeniDo === id) data.nastaveni.sporeniDo = '';
    return 'smazana';
  }

  /* ---------- přehled roku ---------- */
  function prehledRoku(data, rok) {
    const mesice = [], obalky = {};
    for (let i = 1; i <= 12; i++) {
      const m = rok + '-' + dvoj(i);
      const s = spocitej(data, m);
      mesice.push({ mesic: m, prijmy: s.prijmy, prideleno: s.prideleno, utraceno: s.utraceno, neprideleno: s.neprideleno, zustatekObalek: s.zustatekObalek,
        sporeni: zaokr(s.obalky.filter(r => r.obalka.druh === 'sporeni' || r.obalka.druh === 'rezerva').reduce((a, r) => a + r.zustatek, 0)) });
      for (const r of s.obalky) {
        const o = obalky[r.obalka.id] = obalky[r.obalka.id] || { obalka: r.obalka, prideleno: 0, utraceno: 0, mesicne: [] };
        o.prideleno = zaokr(o.prideleno + r.prideleno); o.utraceno = zaokr(o.utraceno + r.utraceno); o.mesicne.push(r.utraceno);
      }
    }
    const sum = k => zaokr(mesice.reduce((a, x) => a + x[k], 0));
    return { rok, mesice, obalky: seradObalky(Object.values(obalky).map(x => x.obalka)).map(o => obalky[o.id]),
      celkem: { prijmy: sum('prijmy'), prideleno: sum('prideleno'), utraceno: sum('utraceno') } };
  }

  /* ---------- CSV ---------- */
  function odhadniOddelovac(text) {
    const radky = text.split(/\r?\n/).filter(r => r.trim()).slice(0, 10);
    let nej = ',', skore = -1;
    for (const o of [';', ',', '\t', '|']) {
      const p = radky.map(r => r.split(o).length - 1);
      const s = p.length && Math.min(...p) > 0 && p.every(x => x === p[0]) ? p[0] * 10 : Math.min(...p, 99);
      if (s > skore) { skore = s; nej = o; }
    }
    return nej;
  }
  function parsujCsv(text, odd) {
    text = String(text || '').replace(/^\uFEFF/, '');
    odd = odd || odhadniOddelovac(text);
    const radky = []; let rad = [], pole = '', uvoz = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (uvoz) {
        if (c === '"') { if (text[i + 1] === '"') { pole += '"'; i++; } else uvoz = false; }
        else pole += c;
      } else if (c === '"' && pole === '') uvoz = true;
      else if (c === odd) { rad.push(pole); pole = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        rad.push(pole); pole = '';
        if (rad.some(x => x.trim())) radky.push(rad);
        rad = [];
      } else pole += c;
    }
    rad.push(pole);
    if (rad.some(x => x.trim())) radky.push(rad);
    return radky.map(r => r.map(x => x.trim()));
  }

  /* Řádek záhlaví = první řádek, ve kterém je sloupec s datem i s částkou v dalších řádcích; jinak první. */
  function odhadniMapovani(radky) {
    let hlava = 0;
    for (let i = 0; i < Math.min(radky.length - 1, 20); i++) {
      const dalsi = radky[i + 1];
      if (radky[i].length >= 2 && dalsi.some(x => parsujDatum(x)) && !radky[i].some(x => parsujDatum(x))) { hlava = i; break; }
    }
    if ((radky[hlava] || []).some(x => parsujDatum(x))) hlava = -1; // výpis bez záhlaví
    const h = (radky[hlava] || []).map(bezDiakritiky);
    const najdi = (...vzory) => h.findIndex(x => vzory.some(v => v.test(x)));
    const map = {
      hlavicka: hlava,
      datum: najdi(/datum (zauctovani|zuctovani|provedeni|transakce|platby)/, /^datum/, /date/),
      castka: najdi(/^castka/, /castka v/, /^objem/, /amount/, /^castka/),
      popis: [najdi(/nazev protiuctu|protistrana|nazev obchodnika|obchodnik|prijemce|counterparty|payee/), najdi(/zprava|popis|poznamka|ucel|description|detail|message/)].filter(i => i >= 0),
      znamenko: 'zaporne'
    };
    // bez názvů: datum = první sloupec s datem, částka = první číselný sloupec
    const vzor = radky[hlava + 1] || [];  // první datový řádek
    if (map.datum < 0) map.datum = vzor.findIndex(x => parsujDatum(x));
    if (map.castka < 0) map.castka = vzor.findIndex((x, i) => i !== map.datum && !isNaN(parsujCastku(x)) && /[,.]|^-/.test(x));
    if (map.popis.length === 0) { const i = vzor.findIndex((x, i) => i !== map.datum && i !== map.castka && /[a-zá-ž]{3}/i.test(x)); if (i >= 0) map.popis = [i]; }
    return map;
  }

  function otisk(datum, castka, popis) { return datum + '|' + zaokr(castka).toFixed(2) + '|' + bezDiakritiky(popis).replace(/\s+/g, ' ').trim(); }

  /* Návrh obálky: nejdřív ruční pravidla (text v popisu), pak naposledy použitá obálka u stejného popisu. */
  function navrhniObalku(data, popis) {
    const p = bezDiakritiky(popis);
    if (!p) return '';
    for (const r of data.pravidla) if (p.includes(bezDiakritiky(r.text))) return r.obalka;
    const klic = p.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
    for (let i = data.vydaje.length - 1; i >= 0; i--) {
      const v = data.vydaje[i];
      if (v.obalka && bezDiakritiky(v.popis).replace(/\d+/g, '').replace(/\s+/g, ' ').trim() === klic) return v.obalka;
    }
    return '';
  }

  /* Řádky výpisu → návrh výdajů. znamenko: 'zaporne' = výdaje jsou záporné (běžné), 'kladne' = všechny řádky jsou výdaje. */
  function pripravImport(data, radky, map) {
    const zname = new Set(data.vydaje.map(v => v.otisk || otisk(v.datum, v.castka, v.popis)));
    const out = [];
    for (let i = map.hlavicka + 1; i < radky.length; i++) {
      const r = radky[i];
      const datum = parsujDatum(r[map.datum]);
      let castka = parsujCastku(r[map.castka]);
      if (!datum || isNaN(castka) || castka === 0) continue;
      const popis = map.popis.map(j => r[j] || '').filter(Boolean).filter((x, k, a) => a.indexOf(x) === k).join(' · ').slice(0, 200);
      let druh = 'vydaj';
      if (map.znamenko === 'zaporne') { if (castka > 0) druh = 'prijem'; castka = Math.abs(castka); }
      else castka = Math.abs(castka);
      const ot = otisk(datum, druh === 'vydaj' ? castka : -castka, popis);
      out.push({ radek: i, datum, castka: zaokr(castka), popis, druh, otisk: ot, duplicita: zname.has(ot),
        obalka: druh === 'vydaj' ? navrhniObalku(data, popis) : '', vybrano: druh === 'vydaj' && !zname.has(ot) });
    }
    return out;
  }

  /* Uloží vybrané řádky: výdaje do výdajů, příjmy do příjmů měsíce. */
  function importuj(data, polozky) {
    let vydaju = 0, prijmu = 0;
    for (const p of polozky) {
      if (!p.vybrano) continue;
      if (p.druh === 'prijem') { mesic(data, mesicZ(p.datum)).prijmy.push(normPrijem({ popis: p.popis.slice(0, 80) || 'Příjem z výpisu', castka: p.castka })); prijmu++; }
      else { pridejVydaj(data, { datum: p.datum, castka: p.castka, popis: p.popis, obalka: p.obalka, otisk: p.otisk }); vydaju++; }
    }
    return { vydaju, prijmu };
  }

  function csvBunka(s) { s = String(s == null ? '' : s); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function vydajeCsv(data, odMesice, doMesice) {
    const r = [['Datum', 'Obálka', 'Popis', 'Částka'].join(';')];
    data.vydaje.filter(v => (!odMesice || mesicZ(v.datum) >= odMesice) && (!doMesice || mesicZ(v.datum) <= doMesice))
      .sort((a, b) => a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0)
      .forEach(v => { const o = obalkaPodleId(data, v.obalka); r.push([v.datum, o ? o.nazev : '', v.popis, String(v.castka).replace('.', ',')].map(csvBunka).join(';')); });
    return '\uFEFF' + r.join('\r\n') + '\r\n';
  }

  const api = {
    VERZE, KLIC, DRUHY, ZBYTKY, MESICE,
    zaokr, dnesIso, jeDatum, jeMesic, mesicZ, posunMesic, rozdilMesicu, formatMesic, formatDatum, formatKc, bezDiakritiky, novyId,
    parsujCastku, parsujDatum, parsujMesic,
    normObalka, normVydaj, normPrijem, prazdna, migruj, vychoziObalky, obalkaPodleId, seradObalky, mesic, prvniMesic,
    naCil, spocitej, nastavPrideleno, sablona, podleCilu, pridejVydaj, smazVydaj, pridejPresun, smazPresun, smazObalku,
    prehledRoku,
    odhadniOddelovac, parsujCsv, odhadniMapovani, otisk, navrhniObalku, pripravImport, importuj, vydajeCsv
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.ObalkyJadro = api;
})();
