/* Zásoby spíže a mrazáku – jádro bez DOM (test: _test/zasoby_test.js).
   Položky s množstvím, umístěním, datem spotřeby a minimální zásobou; doporučená doba
   mražení podle druhu; log spotřeby; rychlé přidání z textu; CSV a nákupní seznam. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_zasoby';

  const JEDNOTKY = ['ks', 'g', 'kg', 'ml', 'l', 'bal'];
  const UMISTENI = [
    { id: 'spiz', nazev: '🏠 Spíž' },
    { id: 'lednice', nazev: '🧊 Lednice' },
    { id: 'mrazak', nazev: '❄️ Mrazák' },
    { id: 'sklep', nazev: '🪜 Sklep' }
  ];
  const UMISTENI_MAPA = Object.fromEntries(UMISTENI.map(u => [u.id, u]));
  const KATEGORIE = ['maso', 'ryby', 'zelenina', 'ovoce', 'pečivo', 'hotová jídla', 'mléčné', 'trvanlivé', 'nápoje', 'koření', 'drogerie'];

  /* Doporučená doba uskladnění v mrazáku (měsíce od–do), orientačně podle běžných doporučení (stav 11/2026).
     Klíč = kategorie bez diakritiky a malými písmeny. */
  const DOBA_MRAZENI = {
    maso: [3, 12], ryby: [2, 6], zelenina: [8, 12], ovoce: [8, 12], pecivo: [3, 3], 'hotova jidla': [2, 3], mlecne: [1, 3]
  };
  const BRZY_DNI = 7;

  /* ---------- data ---------- */
  function jeDatum(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
    const [r, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(r, m - 1, d));
    return dt.getUTCFullYear() === r && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  const naDen = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
  const zDne = n => new Date(n * 86400000).toISOString().slice(0, 10);
  const dvoj = n => String(n).padStart(2, '0');
  function dnesIso(d) { d = d || new Date(); return d.getFullYear() + '-' + dvoj(d.getMonth() + 1) + '-' + dvoj(d.getDate()); }
  function pridejDny(s, n) { return zDne(naDen(s) + n); }
  function rozdilDni(a, b) { return naDen(b) - naDen(a); }
  function pridejMesice(s, n) {
    const r = +s.slice(0, 4), m = +s.slice(5, 7) - 1 + n, d = +s.slice(8, 10);
    const posledni = new Date(Date.UTC(r, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(r, m, Math.min(d, posledni))).toISOString().slice(0, 10);
  }
  function formatDatum(s) { return jeDatum(s) ? +s.slice(8, 10) + '.\u00a0' + +s.slice(5, 7) + '.\u00a0' + s.slice(0, 4) : ''; }
  function bezDiakritiky(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  let citac = 0;
  function novyId() { return 'Z' + Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6); }

  const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
  function normCislo(v, vychozi) {
    if (v === '' || v == null) return vychozi;
    const n = Number(String(v).replace(',', '.').replace(/\s/g, ''));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : vychozi;
  }
  function normPolozka(p) {
    p = p || {};
    const um = txt(p.umisteni, 40) || 'spiz';
    return {
      id: String(p.id || novyId()),
      nazev: txt(p.nazev, 120) || 'Bez názvu',
      mnozstvi: normCislo(p.mnozstvi, 1),
      jednotka: JEDNOTKY.includes(p.jednotka) ? p.jednotka : 'ks',
      umisteni: um,
      kategorie: txt(p.kategorie, 40),
      spotreba: jeDatum(p.spotreba) ? p.spotreba : '',
      zamrazeno: um === 'mrazak' && jeDatum(p.zamrazeno) ? p.zamrazeno : '',
      ean: String(p.ean == null ? '' : p.ean).replace(/\D/g, '').slice(0, 14),
      poznamka: txt(p.poznamka, 1000),
      minimum: normCislo(p.minimum, 0),
      vytvoreno: jeDatum(p.vytvoreno) ? p.vytvoreno : dnesIso()
    };
  }
  const DRUHY_ZAZNAMU = ['spotreba', 'vyhozeno', 'odebrano', 'pridano'];
  function normZaznam(z) {
    z = z || {};
    return {
      id: String(z.id || novyId()),
      datum: jeDatum(z.datum) ? z.datum : '',
      nazev: txt(z.nazev, 120),
      mnozstvi: normCislo(z.mnozstvi, 0),
      jednotka: JEDNOTKY.includes(z.jednotka) ? z.jednotka : 'ks',
      druh: DRUHY_ZAZNAMU.includes(z.druh) ? z.druh : 'odebrano',
      duvod: txt(z.duvod, 200)
    };
  }
  function prazdna() { return { verze: VERZE, polozky: [], historie: [], eany: {} }; }
  function migruj(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.polozky)) return prazdna();
    const polozky = d.polozky.map(normPolozka);
    const historie = (Array.isArray(d.historie) ? d.historie : []).map(normZaznam).filter(z => z.datum);
    const eany = {};
    if (d.eany && typeof d.eany === 'object') for (const k of Object.keys(d.eany)) { const e = k.replace(/\D/g, ''); if (e) eany[e] = txt(d.eany[k], 120); }
    for (const p of polozky) if (p.ean && !eany[p.ean]) eany[p.ean] = p.nazev;   // paměť EAN → název i ze starších položek
    return { verze: VERZE, polozky, historie, eany };
  }

  /* ---------- stav ---------- */
  function doporucenaDobaMrazeni(kategorie) {
    const k = bezDiakritiky(kategorie).trim();
    const d = DOBA_MRAZENI[k];
    return d ? { od: d[0], do: d[1] } : null;
  }
  /* Datum, podle kterého se hlídá: zadaná spotřeba, nebo u mrazáku odhad = zamrazeno + horní mez doporučené doby. */
  function hlidaneDatum(p) {
    if (p.spotreba) return { datum: p.spotreba, odhad: false };
    if (p.umisteni === 'mrazak' && p.zamrazeno) {
      const d = doporucenaDobaMrazeni(p.kategorie);
      if (d) return { datum: pridejMesice(p.zamrazeno, d.do), odhad: true };
    }
    return null;
  }
  /* → { stav: 'po' | 'brzy' | 'ok' | 'bez', dni, datum, odhad } – dni = kolik zbývá (záporné = po datu) */
  function stavPolozky(p, dnes) {
    const h = hlidaneDatum(p);
    if (!h) return { stav: 'bez', dni: null, datum: '', odhad: false };
    const dni = rozdilDni(dnes, h.datum);
    return { stav: dni < 0 ? 'po' : dni <= BRZY_DNI ? 'brzy' : 'ok', dni, datum: h.datum, odhad: h.odhad };
  }
  function popisZbyva(dni) {
    if (dni == null) return 'bez data';
    if (dni < 0) return 'prošlo před ' + (-dni) + (dni === -1 ? ' dnem' : ' dny');
    if (dni === 0) return 'dnes';
    if (dni === 1) return 'zítra';
    return 'za ' + dni + (dni < 5 ? ' dny' : ' dní');
  }
  function formatMnozstvi(n, j) {
    const s = Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000).replace('.', ',');
    return s + '\u00a0' + j;
  }

  function dokoupit(polozky) {
    return polozky.filter(p => p.mnozstvi <= 0 || (p.minimum > 0 && p.mnozstvi < p.minimum))
      .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
  }
  const PORADI = { po: 0, brzy: 1, ok: 2, bez: 3 };
  /* podle: 'datum' (stav, pak datum, pak název) | 'nazev' | 'umisteni' */
  function serad(polozky, dnes, podle) {
    const s = polozky.map(p => ({ p, s: stavPolozky(p, dnes) }));
    const podleNazvu = (a, b) => a.p.nazev.localeCompare(b.p.nazev, 'cs');
    if (podle === 'nazev') s.sort(podleNazvu);
    else if (podle === 'umisteni') s.sort((a, b) => popisUmisteni(a.p.umisteni).localeCompare(popisUmisteni(b.p.umisteni), 'cs') || podleNazvu(a, b));
    else s.sort((a, b) => PORADI[a.s.stav] - PORADI[b.s.stav] || (a.s.datum < b.s.datum ? -1 : a.s.datum > b.s.datum ? 1 : 0) || podleNazvu(a, b));
    return s;
  }
  /* f: { text, umisteni, kategorie } */
  function filtruj(polozky, f) {
    f = f || {};
    const q = bezDiakritiky(f.text).trim();
    return polozky.filter(p => {
      if (f.umisteni && p.umisteni !== f.umisteni) return false;
      if (f.kategorie && p.kategorie !== f.kategorie) return false;
      if (q && !bezDiakritiky([p.nazev, p.kategorie, p.poznamka, p.ean, popisUmisteni(p.umisteni)].join(' ')).includes(q)) return false;
      return true;
    });
  }
  function popisUmisteni(id) { return UMISTENI_MAPA[id] ? UMISTENI_MAPA[id].nazev.replace(/^\S+ /, '') : id; }
  function umisteniVsechna(polozky) {
    const vlastni = [...new Set(polozky.map(p => p.umisteni).filter(u => !UMISTENI_MAPA[u]))].sort((a, b) => a.localeCompare(b, 'cs'));
    return UMISTENI.map(u => ({ id: u.id, nazev: u.nazev })).concat(vlastni.map(u => ({ id: u, nazev: '📦 ' + u })));
  }
  function kategorieVsechny(polozky) {
    return [...new Set(KATEGORIE.concat(polozky.map(p => p.kategorie).filter(Boolean)))].sort((a, b) => a.localeCompare(b, 'cs'));
  }

  /* ---------- změny se zápisem do historie ---------- */
  function zapis(data, p, mnozstvi, druh, duvod, dnes) {
    data.historie.push(normZaznam({ datum: dnes, nazev: p.nazev, mnozstvi, jednotka: p.jednotka, druh, duvod }));
  }
  function najdi(data, id) { const p = data.polozky.find(x => x.id === id); if (!p) throw new Error('Položka nenalezena'); return p; }
  /* Změna množství o delta: záporná jde do historie jako „odebráno“, kladná jako „přidáno“. Pod nulu nejde. */
  function zmenMnozstvi(data, id, delta, dnes) {
    const p = najdi(data, id);
    const nove = Math.max(0, Math.round((p.mnozstvi + delta) * 1000) / 1000);
    const skutecne = nove - p.mnozstvi;
    if (!skutecne) return p;
    p.mnozstvi = nove;
    zapis(data, p, Math.abs(skutecne), skutecne < 0 ? 'odebrano' : 'pridano', '', dnes);
    return p;
  }
  /* Spotřebováno / vyhozeno: množství na nulu (položka zůstává kvůli minimu → „dokoupit“); bez minima se smaže. */
  function odepis(data, id, druh, duvod, dnes) {
    const p = najdi(data, id);
    zapis(data, p, p.mnozstvi, druh, duvod || '', dnes);
    if (p.minimum > 0) p.mnozstvi = 0;
    else data.polozky = data.polozky.filter(x => x.id !== id);
    return p;
  }
  function uloz(data, p) {
    p = normPolozka(p);
    const i = data.polozky.findIndex(x => x.id === p.id);
    if (i >= 0) data.polozky[i] = p; else data.polozky.push(p);
    if (p.ean) data.eany[p.ean] = p.nazev;
    return p;
  }
  function smazZaznam(data, id) { data.historie = data.historie.filter(z => z.id !== id); }

  /* ---------- rychlé přidání: „Mléko, 2 l, lednice, 20.11.“ ---------- */
  function parsujDatum(s, dnes) {
    s = String(s || '').trim();
    if (jeDatum(s)) return s;
    const m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})?$/);
    if (!m) return '';
    let r = m[3] ? +m[3] : +dnes.slice(0, 4);
    if (r < 100) r += 2000;
    let iso = r + '-' + dvoj(+m[2]) + '-' + dvoj(+m[1]);
    if (!jeDatum(iso)) return '';
    if (!m[3] && iso < dnes) iso = (r + 1) + iso.slice(4);   // bez roku a už minulé → příští rok
    return jeDatum(iso) ? iso : '';
  }
  function parsujMnozstvi(s) {
    const m = String(s || '').trim().match(/^(\d+(?:[.,]\d+)?)\s*([a-zěščřžýáíéúů.]*)$/i);
    if (!m) return null;
    const j = bezDiakritiky(m[2]).replace(/\./g, '');
    const jednotka = { '': 'ks', ks: 'ks', kus: 'ks', kusy: 'ks', kusu: 'ks', g: 'g', gram: 'g', gramu: 'g', kg: 'kg', kilo: 'kg', ml: 'ml', l: 'l', litr: 'l', litry: 'l', litru: 'l', bal: 'bal', baleni: 'bal' }[j];
    return jednotka ? { mnozstvi: normCislo(m[1], 1), jednotka } : null;
  }
  function parsujUmisteni(s) {
    const q = bezDiakritiky(s).trim();
    if (!q) return '';
    const u = UMISTENI.find(x => bezDiakritiky(x.nazev.replace(/^\S+ /, '')) === q || x.id === q);
    return u ? u.id : s.trim();
  }
  /* Části oddělené čárkou: název [, množství [jednotka]] [, umístění] [, datum]; pořadí dílů za názvem je volné. */
  function rychle(text, dnes) {
    // desetinná čárka („1,5 l“) není oddělovač dílů
    const dily = String(text || '').replace(/(\d),(\d)/g, '$1.$2').split(',').map(s => s.trim()).filter(Boolean);
    if (!dily.length) return null;
    const p = { nazev: dily.shift(), umisteni: 'spiz' };
    for (const d of dily) {
      const dat = parsujDatum(d, dnes), m = dat ? null : parsujMnozstvi(d);
      if (dat) p.spotreba = dat;
      else if (m) Object.assign(p, m);
      else p.umisteni = parsujUmisteni(d);
    }
    return normPolozka(p);
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

  /* ---------- výstupy ---------- */
  const csvB = v => { const s = String(v == null ? '' : v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function csv(polozky, dnes) {
    const r = [['Název', 'Množství', 'Jednotka', 'Umístění', 'Kategorie', 'Spotřeba', 'Zamrazeno', 'Stav', 'Minimum', 'EAN', 'Poznámka']].concat(
      serad(polozky, dnes, 'umisteni').map(({ p, s }) => [p.nazev, String(p.mnozstvi).replace('.', ','), p.jednotka, popisUmisteni(p.umisteni), p.kategorie,
        p.spotreba, p.zamrazeno, s.stav === 'bez' ? '' : (s.odhad ? 'odhad ' : '') + s.datum + ' (' + popisZbyva(s.dni) + ')', String(p.minimum).replace('.', ','), p.ean, p.poznamka]));
    return '﻿' + r.map(x => x.map(csvB).join(';')).join('\r\n');
  }
  /* Nákupní seznam jako prostý text (do schránky / Plánovače nákupů). Kolik koupit = minimum − stav (aspoň 1). */
  function nakupniText(polozky, dnes) {
    const d = dokoupit(polozky);
    if (!d.length) return '';
    return 'Nákupní seznam ' + formatDatum(dnes) + '\n' + d.map(p => {
      const kolik = Math.max(p.minimum - p.mnozstvi, p.mnozstvi <= 0 ? Math.max(p.minimum, 1) : 0) || 1;
      return '- ' + p.nazev + ' ' + formatMnozstvi(Math.round(kolik * 1000) / 1000, p.jednotka) + (p.mnozstvi > 0 ? ' (zbývá ' + formatMnozstvi(p.mnozstvi, p.jednotka) + ')' : '');
    }).join('\n');
  }
  function souhrn(polozky, dnes) {
    const r = { celkem: polozky.length, po: 0, brzy: 0, ok: 0, bez: 0, dokoupit: dokoupit(polozky).length };
    for (const p of polozky) r[stavPolozky(p, dnes).stav]++;
    return r;
  }

  const api = {
    VERZE, KLIC, JEDNOTKY, UMISTENI, KATEGORIE, DOBA_MRAZENI, BRZY_DNI,
    jeDatum, dnesIso, pridejDny, rozdilDni, pridejMesice, formatDatum, bezDiakritiky, novyId,
    normPolozka, normZaznam, prazdna, migruj,
    doporucenaDobaMrazeni, stavPolozky, popisZbyva, formatMnozstvi, popisUmisteni, umisteniVsechna, kategorieVsechny,
    dokoupit, serad, filtruj, souhrn,
    zmenMnozstvi, odepis, uloz, smazZaznam,
    rychle, parsujDatum, parsujMnozstvi, eanKontrola,
    csv, nakupniText
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.ZasobyJadro = api;
})();
