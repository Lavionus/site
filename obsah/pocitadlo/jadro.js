/* Počítadlo kusů – jádro bez DOM (test: _test/pocitadlo_test.js).
   Více počítadel s krokem, cílem a limitem; každý klik se zapisuje s časem (hodnota = součet změn);
   agregace po intervalech, statistiky a rychlost za hodinu; uložené relace a jejich porovnání; CSV. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_pocitadlo';
  const BARVY = ['#2f80ed', '#eb5757', '#27ae60', '#f2994a', '#9b51e0', '#00a3a3', '#d4a017', '#e84393', '#5d6d7e', '#8d6e63'];
  const MINUTA = 60000, HODINA = 3600000;
  const INTERVALY = [
    { id: 'm1', ms: MINUTA, nazev: '1 min' },
    { id: 'm5', ms: 5 * MINUTA, nazev: '5 min' },
    { id: 'm15', ms: 15 * MINUTA, nazev: '15 min' },
    { id: 'h1', ms: HODINA, nazev: '1 h' },
    { id: 'd1', ms: 24 * HODINA, nazev: '1 den' }
  ];
  const MAX_SLOUPCU = 240;

  let citac = 0;
  const novyId = () => Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6);
  const cislo = (v, vychozi) => { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : vychozi; };
  const kladneNeboNull = v => { const n = cislo(v, null); return n === null || v === '' ? null : n; };
  const jeBarva = s => /^#[0-9a-f]{6}$/i.test(String(s || ''));

  /* ---------- normalizace a migrace ---------- */
  function normPocitadlo(p, i) {
    p = p || {};
    const krok = Math.round(cislo(p.krok, 1));
    return {
      id: String(p.id || novyId()),
      nazev: String(p.nazev || '').trim().slice(0, 60) || 'Počítadlo ' + ((i || 0) + 1),
      barva: jeBarva(p.barva) ? p.barva.toLowerCase() : BARVY[(i || 0) % BARVY.length],
      hodnota: Math.round(cislo(p.hodnota, 0)),
      krok: krok >= 1 ? Math.min(krok, 1e6) : 1,
      cil: kladneNeboNull(p.cil),
      limit: kladneNeboNull(p.limit),
      zaporne: !!p.zaporne
    };
  }
  function normKlik(k) {
    if (!k || !Number.isFinite(+k.t) || !k.p) return null;
    const d = Math.round(cislo(k.d, 0));
    if (!d) return null;
    const o = { t: +k.t, p: String(k.p), d };
    if (k.r) o.r = 1;
    return o;
  }
  /* Hodnota počítadla = součet jeho změn (kliky jsou zdroj pravdy). */
  function prepocti(pocitadla, kliky) {
    const s = {};
    kliky.forEach(k => { s[k.p] = (s[k.p] || 0) + k.d; });
    pocitadla.forEach(p => { p.hodnota = s[p.id] || 0; });
  }
  function normRelace(r) {
    r = r || {};
    const pocitadla = (Array.isArray(r.pocitadla) ? r.pocitadla : []).map(normPocitadlo);
    const ids = new Set(pocitadla.map(p => p.id));
    const kliky = (Array.isArray(r.kliky) ? r.kliky : []).map(normKlik).filter(k => k && ids.has(k.p)).sort((a, b) => a.t - b.t);
    prepocti(pocitadla, kliky);
    const start = Number.isFinite(+r.start) && +r.start > 0 ? +r.start : (kliky.length ? kliky[0].t : Date.now());
    return {
      id: String(r.id || novyId()),
      nazev: String(r.nazev || '').trim().slice(0, 80),
      poznamka: String(r.poznamka || '').slice(0, 500),
      start,
      konec: Number.isFinite(+r.konec) && +r.konec > 0 ? +r.konec : null,
      pocitadla, kliky
    };
  }
  function prazdna(ted) {
    return { verze: VERZE, aktualni: normRelace({ start: ted || Date.now(), pocitadla: [{ nazev: 'Počítadlo 1' }] }), archiv: [], aktivni: 0 };
  }
  function migruj(d) {
    if (!d || typeof d !== 'object' || !d.aktualni) return prazdna();
    const aktualni = normRelace(d.aktualni);
    aktualni.konec = null;
    const archiv = (Array.isArray(d.archiv) ? d.archiv : []).map(normRelace);
    const aktivni = Math.max(0, Math.min(aktualni.pocitadla.length - 1, Math.round(cislo(d.aktivni, 0))));
    return { verze: VERZE, aktualni, archiv, aktivni };
  }

  /* ---------- počítání ---------- */
  function najdi(rel, id) { return rel.pocitadla.find(p => p.id === id) || null; }
  function pridejPocitadlo(rel, vlastnosti) {
    const p = normPocitadlo(Object.assign({}, vlastnosti, { id: null, hodnota: 0 }), rel.pocitadla.length);
    if (!vlastnosti || !jeBarva(vlastnosti.barva)) {
      const pouzite = new Set(rel.pocitadla.map(x => x.barva));
      p.barva = BARVY.find(b => !pouzite.has(b)) || p.barva;
    }
    rel.pocitadla.push(p);
    return p;
  }
  function upravPocitadlo(rel, id, vlastnosti) {
    const p = najdi(rel, id); if (!p) return null;
    const n = normPocitadlo(Object.assign({}, p, vlastnosti, { id: p.id, hodnota: p.hodnota }), rel.pocitadla.indexOf(p));
    Object.assign(p, n);
    return p;
  }
  function smazPocitadlo(rel, id) {
    rel.pocitadla = rel.pocitadla.filter(p => p.id !== id);
    rel.kliky = rel.kliky.filter(k => k.p !== id);
  }
  /* Které hranice změna překročila: 'cil' (dosažen), 'limit' (dosažen), 'nadLimit' (přičítá se nad limitem). */
  function upozorneni(p, pred, po) {
    const u = [];
    if (p.cil !== null && pred < p.cil && po >= p.cil) u.push('cil');
    if (p.limit !== null && po > pred) {
      if (pred < p.limit && po >= p.limit) u.push('limit');
      else if (pred >= p.limit) u.push('nadLimit');
    }
    return u;
  }
  /* Klik: smer +1 / −1 (násobí se krokem). Bez povolených záporných hodnot se nejde pod nulu. */
  function klik(rel, id, smer, t) {
    const p = najdi(rel, id); if (!p) return null;
    let d = (smer < 0 ? -1 : 1) * p.krok;
    if (!p.zaporne && p.hodnota + d < 0) d = p.hodnota > 0 ? -p.hodnota : 0;
    const pred = p.hodnota;
    if (d) { p.hodnota += d; rel.kliky.push({ t: t || Date.now(), p: id, d }); }
    return { hodnota: p.hodnota, d, upozorneni: upozorneni(p, pred, p.hodnota) };
  }
  function nastavHodnotu(rel, id, hodnota, t) {
    const p = najdi(rel, id); if (!p) return null;
    let v = Math.round(cislo(hodnota, p.hodnota));
    if (!p.zaporne && v < 0) v = 0;
    const d = v - p.hodnota, pred = p.hodnota;
    if (d) { p.hodnota = v; rel.kliky.push({ t: t || Date.now(), p: id, d, r: 1 }); }
    return { hodnota: v, d, upozorneni: upozorneni(p, pred, v) };
  }
  /* Vrátí poslední klik (volitelně jen daného počítadla). */
  function zpet(rel, id) {
    for (let i = rel.kliky.length - 1; i >= 0; i--) {
      const k = rel.kliky[i];
      if (id && k.p !== id) continue;
      rel.kliky.splice(i, 1);
      const p = najdi(rel, k.p); if (p) p.hodnota -= k.d;
      return k;
    }
    return null;
  }
  function vynulujPocitadlo(rel, id) {
    rel.kliky = rel.kliky.filter(k => k.p !== id);
    const p = najdi(rel, id); if (p) p.hodnota = 0;
  }

  /* ---------- relace ---------- */
  function kopie(o) { return JSON.parse(JSON.stringify(o)); }
  /* Uloží kopii aktuální relace do archivu; konec = poslední klik (nebo teď). */
  function ulozRelaci(data, nazev, ted) {
    const r = kopie(data.aktualni);
    r.id = novyId();
    r.nazev = String(nazev || '').trim().slice(0, 80) || 'Relace ' + (data.archiv.length + 1);
    r.konec = r.kliky.length ? r.kliky[r.kliky.length - 1].t : (ted || Date.now());
    data.archiv.unshift(r);
    return r;
  }
  /* Nová relace: stejná počítadla (názvy, barvy, kroky, cíle), hodnoty na nule. */
  function novaRelace(data, ted) {
    const a = data.aktualni;
    a.kliky = []; a.pocitadla.forEach(p => { p.hodnota = 0; });
    a.start = ted || Date.now(); a.nazev = ''; a.poznamka = ''; a.konec = null;
  }
  /* Obnoví uloženou relaci jako aktuální (pokračování v počítání). */
  function pokracujRelaci(data, id) {
    const r = data.archiv.find(x => x.id === id); if (!r) return null;
    data.aktualni = Object.assign(kopie(r), { konec: null });
    data.aktivni = 0;
    return data.aktualni;
  }

  /* ---------- agregace a statistiky ---------- */
  /* Kliky do intervalů po krokMs zarovnaných na místní čas (tzMs = posun proti UTC v ms, např. +3600000 pro SEČ).
     Vrací { zacatky: [t…], rady: {idPocitadla: [součet…]}, krokMs }. Pro prázdná data prázdné pole. */
  function agreguj(kliky, krokMs, tzMs, idcka, od, doCas) {
    tzMs = tzMs || 0;
    const filtr = idcka ? new Set(idcka) : null;
    const k = kliky.filter(x => (!filtr || filtr.has(x.p)) && (od == null || x.t >= od) && (doCas == null || x.t <= doCas));
    const rady = {};
    (idcka || [...new Set(k.map(x => x.p))]).forEach(id => { rady[id] = []; });
    if (!k.length) return { zacatky: [], rady, krokMs };
    const zarovnej = t => Math.floor((t + tzMs) / krokMs) * krokMs - tzMs;
    const prvni = zarovnej(od != null ? Math.min(od, k[0].t) : k[0].t);
    const posledni = zarovnej(doCas != null ? Math.max(doCas, k[k.length - 1].t) : k[k.length - 1].t);
    const n = Math.round((posledni - prvni) / krokMs) + 1;
    const zacatky = Array.from({ length: n }, (_, i) => prvni + i * krokMs);
    Object.keys(rady).forEach(id => { rady[id] = new Array(n).fill(0); });
    k.forEach(x => { const i = Math.round((zarovnej(x.t) - prvni) / krokMs); (rady[x.p] || (rady[x.p] = new Array(n).fill(0)))[i] += x.d; });
    return { zacatky, rady, krokMs };
  }
  /* Nejmenší interval, při kterém graf nepřesáhne MAX_SLOUPCU sloupců. */
  function vhodnyInterval(trvaniMs) {
    return (INTERVALY.find(i => trvaniMs / i.ms < MAX_SLOUPCU) || INTERVALY[INTERVALY.length - 1]).id;
  }
  function kumulativne(rada, zaklad) {
    let s = zaklad || 0;
    return rada.map(v => (s += v));
  }
  /* Statistiky jednoho počítadla (nebo všech, id = null) v relaci.
     doCas = konec měření (teď pro běžící relaci, konec pro uloženou). */
  function statistiky(rel, id, doCas) {
    const k = rel.kliky.filter(x => !id || x.p === id);
    let pricteno = 0, odecteno = 0;
    k.forEach(x => { if (x.d > 0) pricteno += x.d; else odecteno -= x.d; });
    const prvni = k.length ? k[0].t : null, posledni = k.length ? k[k.length - 1].t : null;
    const konec = doCas != null ? doCas : (rel.konec || posledni);
    const trvani = prvni !== null ? Math.max(0, (konec || posledni) - prvni) : 0;
    // tempo počítáme z přičtených kusů; pod 1 minutu měření nemá smysl
    const zaHodinu = trvani >= MINUTA ? pricteno / (trvani / HODINA) : null;
    const okno = 15 * MINUTA;
    const posl15 = konec ? k.filter(x => x.d > 0 && x.t > konec - okno && x.t <= konec).reduce((s, x) => s + x.d, 0) : 0;
    const zaHodinu15 = trvani >= okno ? posl15 * 4 : null;
    const minuty = {};
    k.forEach(x => { if (x.d > 0) { const m = Math.floor(x.t / MINUTA); minuty[m] = (minuty[m] || 0) + x.d; } });
    const maxZaMinutu = Object.values(minuty).reduce((a, b) => Math.max(a, b), 0);
    const kladne = k.filter(x => x.d > 0);
    const prumernyOdstup = kladne.length > 1 ? (kladne[kladne.length - 1].t - kladne[0].t) / (kladne.length - 1) : null;
    return { pocetKliku: k.length, pricteno, odecteno, cisto: pricteno - odecteno, prvni, posledni, trvani, zaHodinu, zaHodinu15, maxZaMinutu, prumernyOdstup };
  }
  /* Odhad, kdy se dosáhne cíle při současném tempu (ms od doCas), null = nelze. */
  function odhadCile(p, st) {
    if (p.cil === null || p.hodnota >= p.cil || !st.zaHodinu) return null;
    return (p.cil - p.hodnota) / st.zaHodinu * HODINA;
  }
  /* Porovnání relací: řádky = počítadla spárovaná podle názvu (bez ohledu na velikost písmen). */
  function porovnej(relace, ted) {
    const sloupce = relace.map(r => {
      const st = statistiky(r, null, r.konec || ted);
      const celkem = r.pocitadla.reduce((s, p) => s + p.hodnota, 0);
      return { id: r.id, nazev: r.nazev || 'Aktuální relace', start: r.start, trvani: st.trvani, kliku: st.pocetKliku, celkem, zaHodinu: st.zaHodinu };
    });
    const radky = [], mapa = {};
    relace.forEach((r, i) => r.pocitadla.forEach(p => {
      const klic = p.nazev.trim().toLowerCase();
      if (!mapa[klic]) { mapa[klic] = { nazev: p.nazev, barva: p.barva, hodnoty: new Array(relace.length).fill(null) }; radky.push(mapa[klic]); }
      mapa[klic].hodnoty[i] = (mapa[klic].hodnoty[i] || 0) + p.hodnota;
    }));
    return { sloupce, radky };
  }

  /* ---------- formáty ---------- */
  const dvoj = n => String(n).padStart(2, '0');
  function casText(t, sekundy) {
    const d = new Date(t);
    return d.getFullYear() + '-' + dvoj(d.getMonth() + 1) + '-' + dvoj(d.getDate()) + ' ' + dvoj(d.getHours()) + ':' + dvoj(d.getMinutes()) + (sekundy === false ? '' : ':' + dvoj(d.getSeconds()));
  }
  function formatTrvani(ms) {
    if (ms == null) return '–';
    const s = Math.round(ms / 1000);
    if (s < 60) return s + ' s';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' min ' + dvoj(s % 60) + ' s';
    const h = Math.floor(m / 60);
    if (h < 48) return h + ' h ' + dvoj(m % 60) + ' min';
    return Math.floor(h / 24) + ' d ' + (h % 24) + ' h';
  }
  function formatCislo(n, des) {
    if (n == null || !Number.isFinite(n)) return '–';
    const f = Math.pow(10, des || 0);
    return String(Math.round(n * f) / f).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  /* Barva textu (tmavá/světlá) čitelná na pozadí dané barvy. */
  function textNaBarve(hex) {
    if (!jeBarva(hex)) return '#000';
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return L > 0.18 ? '#111' : '#fff';
  }

  const csvB = v => { const s = String(v == null ? '' : v); return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csvText = r => '﻿' + r.map(x => x.map(csvB).join(';')).join('\r\n');
  /* Všechny kliky relace: čas, počítadlo, změna, stav po kliku. */
  function csvKliky(rel) {
    const stav = {}, jmeno = {};
    rel.pocitadla.forEach(p => { stav[p.id] = 0; jmeno[p.id] = p.nazev; });
    const r = [['Čas', 'Počítadlo', 'Změna', 'Stav', 'Ručně']];
    rel.kliky.forEach(k => { stav[k.p] += k.d; r.push([casText(k.t), jmeno[k.p], (k.d > 0 ? '+' : '') + k.d, stav[k.p], k.r ? 'ano' : '']); });
    return csvText(r);
  }
  /* Souhrn relací: řádek na počítadlo v každé relaci. */
  function csvSouhrn(relace, ted) {
    const r = [['Relace', 'Začátek', 'Trvání (min)', 'Počítadlo', 'Hodnota', 'Přičteno', 'Odečteno', 'Kliků', 'Za hodinu', 'Cíl', 'Limit']];
    relace.forEach(rel => rel.pocitadla.forEach(p => {
      const st = statistiky(rel, p.id, rel.konec || ted);
      r.push([rel.nazev || 'Aktuální relace', casText(rel.start, false), String(Math.round(st.trvani / MINUTA * 10) / 10).replace('.', ','), p.nazev, p.hodnota,
        st.pricteno, st.odecteno, st.pocetKliku, st.zaHodinu == null ? '' : String(Math.round(st.zaHodinu * 10) / 10).replace('.', ','), p.cil == null ? '' : p.cil, p.limit == null ? '' : p.limit]);
    }));
    return csvText(r);
  }
  /* Řádek pro graf: intervaly → CSV (čas začátku, sloupec na počítadlo). */
  function csvIntervaly(agr, pocitadla) {
    const ids = Object.keys(agr.rady);
    const jm = id => (pocitadla.find(p => p.id === id) || { nazev: id }).nazev;
    const r = [['Začátek intervalu'].concat(ids.map(jm))];
    agr.zacatky.forEach((t, i) => r.push([casText(t, false)].concat(ids.map(id => agr.rady[id][i]))));
    return csvText(r);
  }

  const api = {
    VERZE, KLIC, BARVY, INTERVALY, MINUTA, HODINA, MAX_SLOUPCU,
    novyId, normPocitadlo, normKlik, normRelace, prazdna, migruj, prepocti,
    najdi, pridejPocitadlo, upravPocitadlo, smazPocitadlo, klik, nastavHodnotu, zpet, vynulujPocitadlo, upozorneni,
    ulozRelaci, novaRelace, pokracujRelaci,
    agreguj, vhodnyInterval, kumulativne, statistiky, odhadCile, porovnej,
    casText, formatTrvani, formatCislo, textNaBarve, csvKliky, csvSouhrn, csvIntervaly
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.PocitadloJadro = api;
})();
