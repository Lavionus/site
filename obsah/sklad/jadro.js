/* Skladová evidence – jádro bez DOM (test: _test/sklad_test.js).
   Skladové karty, doklady (příjemka P, výdejka V, převodka T, inventura I) s číselnou řadou,
   přepočet pohybů s oceněním FIFO nebo váženým průměrem, stav k datu, pohyby karty,
   seznam k objednání, CSV a záloha. */
(function () {
  'use strict';

  const VERZE = 1;
  const DB = 'webapp_sklad';
  const JEDNOTKY = ['ks', 'kg', 'g', 'l', 'ml', 'm', 'm²', 'm³', 'bal', 'pár', 'sada', 'role'];
  const DRUHY = {
    P: { nazev: 'Příjemka', rada: 'PR', ikona: '📥' },
    V: { nazev: 'Výdejka', rada: 'VY', ikona: '📤' },
    T: { nazev: 'Převodka', rada: 'PV', ikona: '🔁' },
    I: { nazev: 'Inventura', rada: 'IN', ikona: '📋' }
  };
  const METODY = { fifo: 'FIFO (první do skladu, první ven)', prumer: 'Vážený aritmetický průměr' };

  /* ---------- pomocné ---------- */
  const dvoj = n => String(n).padStart(2, '0');
  function dnesIso(d) { d = d || new Date(); return d.getFullYear() + '-' + dvoj(d.getMonth() + 1) + '-' + dvoj(d.getDate()); }
  function jeDatum(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
    const [r, m, d] = s.split('-').map(Number), dt = new Date(Date.UTC(r, m - 1, d));
    return dt.getUTCFullYear() === r && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  function formatDatum(s) { return jeDatum(s) ? +s.slice(8, 10) + '.\u00a0' + +s.slice(5, 7) + '.\u00a0' + s.slice(0, 4) : ''; }
  function bezDiakritiky(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  const r2 = x => Math.round(x * 100) / 100;
  const r3 = x => Math.round(x * 1000) / 1000;
  const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
  function cislo(v, vychozi) {
    if (v === '' || v == null) return vychozi;
    const n = Number(String(v).replace(/\s|\u00a0/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : vychozi;
  }
  let citac = 0;
  function novyId(p) { return (p || 'X') + Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6); }
  function formatCislo(x, des) {
    if (!Number.isFinite(x)) return '';
    return x.toLocaleString('cs-CZ', { minimumFractionDigits: des == null ? 0 : des, maximumFractionDigits: des == null ? 3 : des });
  }
  const formatKc = x => formatCislo(x, 2) + '\u00a0Kč';

  function eanKontrola(kod) {
    const s = String(kod || '').replace(/\D/g, '');
    if (![8, 12, 13, 14].includes(s.length)) return false;
    const c = s.split('').map(Number), kontrolni = c.pop();
    let suma = 0;
    for (let i = c.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) suma += c[i] * w;
    return (10 - (suma % 10)) % 10 === kontrolni;
  }

  /* ---------- normalizace dat ---------- */
  function normKarta(k) {
    k = k || {};
    return {
      id: String(k.id || novyId('K')),
      kod: txt(k.kod, 40),
      nazev: txt(k.nazev, 160) || 'Bez názvu',
      jednotka: txt(k.jednotka, 12) || 'ks',
      umisteni: txt(k.umisteni, 60),
      minimum: Math.max(0, cislo(k.minimum, 0)),
      cil: Math.max(0, cislo(k.cil, 0)),
      ean: String(k.ean || '').replace(/\D/g, '').slice(0, 14),
      poznamka: txt(k.poznamka, 1000)
    };
  }
  function normSklad(s) { s = s || {}; return { id: String(s.id || novyId('S')), nazev: txt(s.nazev, 80) || 'Sklad' }; }
  function normDoklad(d) {
    d = d || {};
    const druh = DRUHY[d.druh] ? d.druh : 'P';
    const pol = (Array.isArray(d.polozky) ? d.polozky : []).filter(p => p && p.karta).map(p => druh === 'I'
      ? { karta: String(p.karta), skutecne: Math.max(0, cislo(p.skutecne, 0)) }
      : { karta: String(p.karta), mnozstvi: Math.max(0, cislo(p.mnozstvi, 0)), cena: druh === 'P' ? Math.max(0, cislo(p.cena, 0)) : 0 });
    return {
      id: String(d.id || novyId('D')),
      druh,
      cislo: txt(d.cislo, 30),
      datum: jeDatum(d.datum) ? d.datum : dnesIso(),
      sklad: String(d.sklad || ''),
      cil: druh === 'T' ? String(d.cil || '') : '',
      partner: druh === 'P' || druh === 'V' ? txt(d.partner, 160) : '',
      poznamka: txt(d.poznamka, 1000),
      poradi: Number.isFinite(+d.poradi) ? +d.poradi : 0,
      polozky: pol
    };
  }
  function prazdna() {
    return { verze: VERZE, firma: { nazev: '', ico: '', adresa: '' }, metoda: 'fifo', sklady: [{ id: 'S1', nazev: 'Hlavní sklad' }], karty: [], doklady: [] };
  }
  function migruj(d) {
    const z = prazdna();
    if (!d || typeof d !== 'object') return z;
    if (d.firma && typeof d.firma === 'object') z.firma = { nazev: txt(d.firma.nazev, 120), ico: txt(d.firma.ico, 20), adresa: txt(d.firma.adresa, 200) };
    if (METODY[d.metoda]) z.metoda = d.metoda;
    if (Array.isArray(d.sklady) && d.sklady.length) z.sklady = d.sklady.map(normSklad);
    if (Array.isArray(d.karty)) z.karty = d.karty.map(normKarta);
    if (Array.isArray(d.doklady)) z.doklady = d.doklady.map(normDoklad);
    return z;
  }

  /* ---------- číselná řada: PR2026-0001 ---------- */
  function dalsiCislo(data, druh, datum) {
    const rok = (jeDatum(datum) ? datum : dnesIso()).slice(0, 4), pref = DRUHY[druh].rada + rok + '-';
    let max = 0;
    for (const d of data.doklady) if (d.cislo.startsWith(pref)) max = Math.max(max, parseInt(d.cislo.slice(pref.length), 10) || 0);
    return pref + String(max + 1).padStart(4, '0');
  }

  /* ---------- přepočet pohybů ----------
     Doklady se přehrají podle data (a pořadí založení). Pro každou dvojici karta+sklad se drží
     množství, hodnota a u FIFO vrstvy {q, c}. Výdej se ocení metodou, převodka přenese oceněné
     díly do cílového skladu, inventura nastaví množství na skutečné (rozdíl = příjem/výdej).
     Výdej nad stav se zapíše do chyb (stav jde do minusu, chybějící část v poslední ceně). */
  function seradDoklady(doklady) {
    return doklady.slice().sort((a, b) => a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.poradi - b.poradi);
  }
  function prepocet(data, moznosti) {
    moznosti = moznosti || {};
    const metoda = moznosti.metoda || data.metoda || 'fifo', doDatum = moznosti.doDatum || '9999-12-31';
    const stavy = new Map(), pohyby = [], chyby = [], posledniCena = {};
    const st = (karta, sklad) => {
      const k = karta + '|' + sklad;
      if (!stavy.has(k)) stavy.set(k, { karta, sklad, q: 0, hodnota: 0, vrstvy: [] });
      return stavy.get(k);
    };
    const jednotkova = s => s.q > 0 ? s.hodnota / s.q : (posledniCena[s.karta] || 0);
    function prijem(s, q, c) {
      if (q <= 0) return;
      if (metoda === 'fifo') {
        const deficit = s.q < 0 ? Math.min(-s.q, q) : 0;
        if (q - deficit > 0) s.vrstvy.push({ q: q - deficit, c });
        s.q = r3(s.q + q);
        s.hodnota = s.q > 0 ? r2(s.vrstvy.reduce((a, v) => a + v.q * v.c, 0)) : 0;
      } else {
        s.q = r3(s.q + q);
        s.hodnota = s.q > 0 ? r2(s.hodnota + q * c) : 0;
      }
    }
    // vrací díly [{q, c}] a chybějící množství
    function vydej(s, q) {
      const dily = [];
      let chybi = 0;
      if (q <= 0) return { dily, chybi };
      if (metoda === 'fifo') {
        let zbyva = q;
        while (zbyva > 1e-9 && s.vrstvy.length) {
          const v = s.vrstvy[0], vezmi = Math.min(v.q, zbyva);
          dily.push({ q: r3(vezmi), c: v.c });
          v.q = r3(v.q - vezmi); zbyva = r3(zbyva - vezmi);
          if (v.q <= 1e-9) s.vrstvy.shift();
        }
        if (zbyva > 1e-9) { chybi = zbyva; dily.push({ q: zbyva, c: posledniCena[s.karta] || 0 }); }
        s.q = r3(s.q - q);
        s.hodnota = s.q > 0 ? r2(s.vrstvy.reduce((a, v) => a + v.q * v.c, 0)) : 0;
      } else {
        const c = jednotkova(s);
        if (q > Math.max(s.q, 0) + 1e-9) chybi = r3(q - Math.max(s.q, 0));
        dily.push({ q, c });
        const nove = r3(s.q - q);
        s.hodnota = nove > 0 ? r2(s.hodnota - q * c) : 0;
        s.q = nove;
      }
      return { dily, chybi };
    }
    const zapis = (d, s, mnozstvi, hodnota) => pohyby.push({
      doklad: d.id, cislo: d.cislo, druh: d.druh, datum: d.datum, karta: s.karta, sklad: s.sklad,
      mnozstvi: r3(mnozstvi), hodnota: r2(hodnota), cenaJ: mnozstvi ? Math.abs(hodnota / mnozstvi) : 0,
      zustatek: s.q, zustatekHodnota: s.hodnota
    });
    const hodnotaDilu = dily => dily.reduce((a, x) => a + x.q * x.c, 0);

    for (const d of seradDoklady(data.doklady)) {
      if (d.datum > doDatum) continue;
      for (const p of d.polozky) {
        if (d.druh === 'P') {
          const s = st(p.karta, d.sklad);
          prijem(s, p.mnozstvi, p.cena);
          posledniCena[p.karta] = p.cena;
          zapis(d, s, p.mnozstvi, p.mnozstvi * p.cena);
        } else if (d.druh === 'V' || d.druh === 'T') {
          const s = st(p.karta, d.sklad), v = vydej(s, p.mnozstvi);
          if (v.chybi) chyby.push({ doklad: d.id, cislo: d.cislo, datum: d.datum, karta: p.karta, sklad: d.sklad, chybi: v.chybi });
          zapis(d, s, -p.mnozstvi, -hodnotaDilu(v.dily));
          if (d.druh === 'T') {
            const c = st(p.karta, d.cil);
            for (const x of v.dily) prijem(c, x.q, x.c);
            zapis(d, c, p.mnozstvi, hodnotaDilu(v.dily));
          }
        } else if (d.druh === 'I') {
          const s = st(p.karta, d.sklad), rozdil = r3(p.skutecne - s.q);
          if (rozdil > 0) {
            const c = metoda === 'fifo' ? (s.vrstvy.length ? s.vrstvy[s.vrstvy.length - 1].c : posledniCena[p.karta] || 0) : jednotkova(s);
            prijem(s, rozdil, c);
            zapis(d, s, rozdil, rozdil * c);
          } else if (rozdil < 0) {
            const v = vydej(s, -rozdil);
            zapis(d, s, rozdil, -hodnotaDilu(v.dily));
          }
        }
      }
    }
    return { metoda, stavy, pohyby, chyby, posledniCena };
  }

  /* Stav k datu po kartách (součet skladů, nebo jen jeden sklad). */
  function stavKDatu(data, datum, sklad, metoda) {
    const pr = prepocet(data, { doDatum: datum, metoda });
    const mapa = {};
    for (const k of data.karty) mapa[k.id] = { karta: k, q: 0, hodnota: 0 };
    for (const s of pr.stavy.values()) {
      if (sklad && s.sklad !== sklad) continue;
      const m = mapa[s.karta];
      if (!m) continue;
      m.q = r3(m.q + s.q); m.hodnota = r2(m.hodnota + s.hodnota);
    }
    const radky = Object.values(mapa).map(m => Object.assign(m, { cenaJ: m.q > 0 ? m.hodnota / m.q : 0 }));
    return { radky, celkem: r2(radky.reduce((a, m) => a + m.hodnota, 0)) };
  }

  /* Pohyby jedné karty s průběžným zůstatkem (pro celou firmu nebo jeden sklad). */
  function pohybyKarty(data, kartaId, sklad, metoda) {
    const pr = prepocet(data, { metoda });
    let q = 0, h = 0;
    return pr.pohyby.filter(p => p.karta === kartaId && (!sklad || p.sklad === sklad)).map(p => {
      q = r3(q + p.mnozstvi); h = r2(h + p.hodnota);
      return Object.assign({}, p, { zustatek: q, zustatekHodnota: q > 0 ? h : 0 });
    });
  }

  /* Karty pod minimem → co objednat (do cílové zásoby, jinak do minima), poslední dodavatel a cena. */
  function kObjednani(data, datum, metoda) {
    const st = stavKDatu(data, datum || '9999-12-31', '', metoda);
    const dodavatel = {}, cena = {};
    for (const d of seradDoklady(data.doklady)) if (d.druh === 'P') for (const p of d.polozky) { dodavatel[p.karta] = d.partner; cena[p.karta] = p.cena; }
    return st.radky.filter(r => r.karta.minimum > 0 && r.q < r.karta.minimum).map(r => ({
      karta: r.karta, q: r.q, navrh: r3(Math.max(r.karta.cil, r.karta.minimum) - r.q),
      dodavatel: dodavatel[r.karta.id] || '', cena: cena[r.karta.id] || 0
    })).sort((a, b) => (a.dodavatel || '\uffff').localeCompare(b.dodavatel || '\uffff', 'cs') || a.karta.nazev.localeCompare(b.karta.nazev, 'cs'));
  }

  /* Inventurní soupis: evidovaný stav karet ve skladu k datu (před inventurou toho dne). */
  function soupisInventury(data, sklad, datum, metoda, bezDokladu) {
    const d = Object.assign({}, data, { doklady: data.doklady.filter(x => x.id !== bezDokladu) });
    const st = stavKDatu(d, datum, sklad, metoda);
    return st.radky.map(r => ({ karta: r.karta, evidovano: r.q, cenaJ: r.cenaJ }));
  }
  /* Rozdíly inventury: skutečné − evidované a jejich ocenění (orientačně jednotkovou cenou). */
  function rozdilyInventury(soupis, skutecne) {
    return soupis.map(r => {
      const s = skutecne[r.karta.id] == null ? r.evidovano : skutecne[r.karta.id];
      const rozdil = r3(s - r.evidovano);
      return Object.assign({}, r, { skutecne: s, rozdil, hodnota: r2(rozdil * r.cenaJ) });
    });
  }

  /* Kontrola dokladu před uložením: vrací seznam chyb (texty). */
  function kontrolaDokladu(data, d) {
    const ch = [];
    if (!d.cislo) ch.push('Doklad nemá číslo.');
    if (data.doklady.some(x => x.id !== d.id && x.cislo === d.cislo)) ch.push('Číslo ' + d.cislo + ' už má jiný doklad.');
    if (!data.sklady.some(s => s.id === d.sklad)) ch.push('Vyberte sklad.');
    if (d.druh === 'T' && (!data.sklady.some(s => s.id === d.cil) || d.cil === d.sklad)) ch.push('Převodka potřebuje jiný cílový sklad.');
    if (!d.polozky.length) ch.push('Doklad nemá žádnou položku.');
    if (d.druh !== 'I' && d.polozky.some(p => !(p.mnozstvi > 0))) ch.push('Každá položka musí mít kladné množství.');
    if (d.polozky.some(p => !data.karty.some(k => k.id === p.karta))) ch.push('Položka odkazuje na neexistující kartu.');
    return ch;
  }
  /* Výdeje, které by po změně dokladů šly do minusu (nové oproti původnímu stavu). */
  function noveNedostatky(pred, po) {
    const klic = c => c.doklad + '|' + c.karta + '|' + c.sklad;
    const bylo = new Set(prepocet(pred).chyby.map(klic));
    return prepocet(po).chyby.filter(c => !bylo.has(klic(c)));
  }
  function ulozDoklad(data, d) {
    d = normDoklad(d);
    const i = data.doklady.findIndex(x => x.id === d.id);
    if (i >= 0) { d.poradi = data.doklady[i].poradi; data.doklady[i] = d; }
    else { d.poradi = data.doklady.reduce((m, x) => Math.max(m, x.poradi), 0) + 1; data.doklady.push(d); }
    return d;
  }
  function pouzitaKarta(data, kartaId) { return data.doklady.some(d => d.polozky.some(p => p.karta === kartaId)); }
  function pouzitySklad(data, skladId) { return data.doklady.some(d => d.sklad === skladId || d.cil === skladId); }
  function hodnotaDokladu(data, d, pr) {
    if (d.druh === 'I') return null;
    pr = pr || prepocet(data);
    return r2(pr.pohyby.filter(p => p.doklad === d.id && (d.druh !== 'T' || p.mnozstvi < 0)).reduce((a, p) => a + Math.abs(p.hodnota), 0));
  }

  /* ---------- hledání karty ---------- */
  function najdiKartu(data, text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const ean = t.replace(/\D/g, '');
    return data.karty.find(k => k.kod && k.kod.toLowerCase() === t.toLowerCase())
      || (ean.length >= 8 && data.karty.find(k => k.ean === ean))
      || data.karty.find(k => popisKarty(k) === t)
      || data.karty.find(k => k.nazev.toLowerCase() === t.toLowerCase()) || null;
  }
  function popisKarty(k) { return (k.kod ? k.kod + ' – ' : '') + k.nazev; }
  function filtrKaret(karty, text) {
    const q = bezDiakritiky(text).trim();
    if (!q) return karty;
    return karty.filter(k => bezDiakritiky([k.kod, k.nazev, k.ean, k.umisteni, k.poznamka].join(' ')).includes(q));
  }

  /* ---------- CSV ---------- */
  function csvB(v) { const s = String(v == null ? '' : v); return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  const cz = x => String(x).replace('.', ',');
  function csv(radky) { return '\ufeff' + radky.map(r => r.map(csvB).join(';')).join('\r\n'); }
  function parseCsv(text) {
    text = String(text || '').replace(/^\ufeff/, '');
    const prvni = text.split(/\r?\n/)[0] || '';
    const odd = (prvni.match(/;/g) || []).length >= (prvni.match(/,/g) || []).length ? ';' : (prvni.includes('\t') ? '\t' : ',');
    const radky = [];
    let r = [], pole = '', uvoz = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (uvoz) {
        if (c === '"' && text[i + 1] === '"') { pole += '"'; i++; }
        else if (c === '"') uvoz = false;
        else pole += c;
      } else if (c === '"') uvoz = true;
      else if (c === odd) { r.push(pole); pole = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        r.push(pole); pole = '';
        if (r.some(x => x.trim())) radky.push(r);
        r = [];
      } else pole += c;
    }
    r.push(pole);
    if (r.some(x => x.trim())) radky.push(r);
    return radky;
  }
  const SLOUPCE_KARET = ['Kód', 'Název', 'Jednotka', 'Umístění', 'Minimum', 'Cílová zásoba', 'EAN', 'Poznámka'];
  function csvKaret(karty) {
    return csv([SLOUPCE_KARET].concat(karty.map(k => [k.kod, k.nazev, k.jednotka, k.umisteni, cz(k.minimum), cz(k.cil), k.ean, k.poznamka])));
  }
  /* Import karet z CSV (hlavička podle názvů sloupců, bez diakritiky); shoda podle kódu, jinak podle názvu. */
  function importKaret(data, text) {
    const r = parseCsv(text);
    if (r.length < 2) return { nove: 0, upravene: 0, chyby: ['Soubor nemá hlavičku a data.'] };
    const hl = r[0].map(h => bezDiakritiky(h).trim());
    const sl = n => hl.indexOf(bezDiakritiky(n));
    const idx = { kod: sl('Kód'), nazev: sl('Název'), jednotka: sl('Jednotka'), umisteni: sl('Umístění'), minimum: sl('Minimum'), cil: sl('Cílová zásoba'), ean: sl('EAN'), poznamka: sl('Poznámka') };
    if (idx.nazev < 0 && idx.kod < 0) return { nove: 0, upravene: 0, chyby: ['Chybí sloupec „Název“ nebo „Kód“.'] };
    let nove = 0, upravene = 0;
    const chyby = [];
    r.slice(1).forEach((radek, i) => {
      const v = {};
      for (const [k, j] of Object.entries(idx)) if (j >= 0 && radek[j] != null) v[k] = radek[j].trim();
      if (!v.nazev && !v.kod) { chyby.push('Řádek ' + (i + 2) + ': chybí kód i název.'); return; }
      const puv = (v.kod && data.karty.find(k => k.kod === v.kod)) || (!v.kod && v.nazev && data.karty.find(k => k.nazev === v.nazev));
      if (puv) { Object.assign(puv, normKarta(Object.assign({}, puv, v, { id: puv.id }))); upravene++; }
      else { data.karty.push(normKarta(v)); nove++; }
    });
    return { nove, upravene, chyby };
  }
  function csvStavu(stav, sklady) {
    return csv([['Kód', 'Název', 'Jednotka', 'Množství', 'Jedn. cena', 'Hodnota', 'Minimum', 'Umístění']].concat(stav.radky.map(r =>
      [r.karta.kod, r.karta.nazev, r.karta.jednotka, cz(r.q), cz(r2(r.cenaJ)), cz(r.hodnota), cz(r.karta.minimum), r.karta.umisteni])));
  }
  function csvPohybu(data, pohyby) {
    const k = Object.fromEntries(data.karty.map(x => [x.id, x])), s = Object.fromEntries(data.sklady.map(x => [x.id, x.nazev]));
    return csv([['Datum', 'Doklad', 'Druh', 'Sklad', 'Kód', 'Název', 'Množství', 'Jednotka', 'Jedn. cena', 'Hodnota', 'Zůstatek']].concat(pohyby.map(p => {
      const kk = k[p.karta] || { kod: '', nazev: '?', jednotka: '' };
      return [p.datum, p.cislo, DRUHY[p.druh].nazev, s[p.sklad] || p.sklad, kk.kod, kk.nazev, cz(p.mnozstvi), kk.jednotka, cz(r2(p.cenaJ)), cz(p.hodnota), cz(p.zustatek)];
    })));
  }

  const api = {
    VERZE, DB, JEDNOTKY, DRUHY, METODY,
    dnesIso, jeDatum, formatDatum, formatCislo, formatKc, bezDiakritiky, cislo, r2, r3, novyId, eanKontrola,
    normKarta, normSklad, normDoklad, prazdna, migruj,
    dalsiCislo, seradDoklady, prepocet, stavKDatu, pohybyKarty, kObjednani, soupisInventury, rozdilyInventury,
    kontrolaDokladu, noveNedostatky, ulozDoklad, pouzitaKarta, pouzitySklad, hodnotaDokladu,
    najdiKartu, popisKarty, filtrKaret,
    csv, parseCsv, csvKaret, importKaret, csvStavu, csvPohybu
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.SkladJadro = api;
})();
