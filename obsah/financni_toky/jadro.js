/* Finanční toky z bankovních výpisů – jádro (bez DOM, testovatelné v node).
   Import CSV výpisů (kódování, oddělovač, mapování sloupců, desetinná čárka, formáty data),
   duplicity a párování převodů, toky mezi účty (Sankey bez cyklů, graf vazeb, zůstatky),
   detekce vzorců jako INDICIE K PROVĚŘENÍ a syntetické ukázky se známou pravdou.
   Čas = „místní bez pásma“: t = Date.UTC(rok, měsíc, den, hod, min) – výpisy pásmo neuvádějí. */
(function (koren) {
  'use strict';

  /* ---------- drobnosti ---------- */
  const bezDiakritiky = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const norm = s => bezDiakritiky(s).toLowerCase().replace(/\s+/g, ' ').trim();
  const DEN = 86400000, HOD = 3600000;
  const zaokr = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
  const fmtCastka = (x, mena) => (x == null || !isFinite(x) ? '–' : x.toLocaleString('cs-CZ', { minimumFractionDigits: Number.isInteger(zaokr(x)) ? 0 : 2, maximumFractionDigits: 2 }).replace(/ /g, ' ') + (mena ? ' ' + mena : ''));
  const dva = n => String(n).padStart(2, '0');
  function fmtDatum(t, sCasem) {
    const d = new Date(t);
    const s = `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`;
    return sCasem ? `${s} ${dva(d.getUTCHours())}:${dva(d.getUTCMinutes())}` : s;
  }
  const isoDen = t => new Date(t).toISOString().slice(0, 10);

  // deterministický generátor pro ukázky (mulberry32)
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ---------- kódování ---------- */
  let mapa1250 = null;   // znak → bajt (z dekodéru windows-1250, funguje v prohlížeči i v node)
  function zakoduj1250(text) {
    if (!mapa1250) {
      mapa1250 = new Map();
      const dek = new TextDecoder('windows-1250');
      for (let b = 0x80; b <= 0xff; b++) { const z = dek.decode(Uint8Array.of(b)); if (z !== '�') mapa1250.set(z, b); }
    }
    const out = new Uint8Array(text.length);
    let n = 0;
    for (const z of text) { const c = z.codePointAt(0); out[n++] = c < 0x80 ? c : (mapa1250.get(z) || 0x3f); }
    return out.slice(0, n);
  }
  function dekoduj(bajty, kodovani = 'auto') {
    const b = bajty instanceof Uint8Array ? bajty : new Uint8Array(bajty);
    let kod = kodovani;
    if (kod === 'auto') {
      if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) kod = 'utf-8';
      else if ((b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff)) kod = b[0] === 0xff ? 'utf-16le' : 'utf-16be';
      else { try { new TextDecoder('utf-8', { fatal: true }).decode(b); kod = 'utf-8'; } catch (e) { kod = 'windows-1250'; } }
    }
    let text = new TextDecoder(kod).decode(b);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return { text, kodovani: kod };
  }

  /* ---------- CSV ---------- */
  function detekujOddelovac(text) {
    const radky = text.split(/\r?\n/).filter(r => r.trim()).slice(0, 40);
    let nej = ';', skore = -1;
    for (const o of [';', ',', '\t', '|']) {
      const pocty = radky.map(r => { let n = 0, q = false; for (const z of r) { if (z === '"') q = !q; else if (z === o && !q) n++; } return n; });
      const nenul = pocty.filter(n => n > 0);
      if (!nenul.length) continue;
      // nejčastější počet (hlavička + data mají stejný) × kolik řádků ho má
      const cet = {}; nenul.forEach(n => { cet[n] = (cet[n] || 0) + 1; });
      const [n, k] = Object.entries(cet).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      const s = k * Math.min(+n, 12);
      if (s > skore) { skore = s; nej = o; }
    }
    return nej;
  }
  function parsujCsv(text, odd) {
    const radky = []; let radek = [], pole = '', q = false, cislo = 1, zacatek = 1;
    const pridej = () => { if (radek.some(p => p.trim() !== '')) { const r = radek.map(p => p.trim()); r.radek = zacatek; radky.push(r); } };
    for (let i = 0; i < text.length; i++) {
      const z = text[i];
      if (q) {
        if (z === '"') { if (text[i + 1] === '"') { pole += '"'; i++; } else q = false; }
        else { if (z === '\n') cislo++; pole += z; }
      } else if (z === '"' && pole.trim() === '') { pole = ''; q = true; }
      else if (z === odd) { radek.push(pole); pole = ''; }
      else if (z === '\n' || z === '\r') {
        if (z === '\r' && text[i + 1] === '\n') i++;
        radek.push(pole); pole = '';
        pridej();
        radek = []; cislo++; zacatek = cislo;
      } else pole += z;
    }
    radek.push(pole);
    pridej();
    return radky;   // každý řádek nese .radek = číslo řádku v souboru (prázdné řádky se vynechají)
  }

  /* ---------- čísla a data ---------- */
  // desetinna: ',' | '.' | 'auto'
  function parsujCislo(s, desetinna = 'auto') {
    if (s == null) return null;
    let t = String(s).replace(/[  \s']/g, '').replace(/[−–]/g, '-').replace(/[^\d,.\-+()]/g, '');
    if (!t || !/\d/.test(t)) return null;
    let zapor = false;
    if (/^\(.*\)$/.test(t)) { zapor = true; t = t.slice(1, -1); }
    if (t.endsWith('-')) { zapor = true; t = t.slice(0, -1); }
    if (t.startsWith('-')) { zapor = !zapor; t = t.slice(1); } else if (t.startsWith('+')) t = t.slice(1);
    let d = desetinna;
    if (d === 'auto') {
      const c = t.lastIndexOf(','), p = t.lastIndexOf('.');
      if (c >= 0 && p >= 0) d = c > p ? ',' : '.';
      else if (c >= 0) d = (t.match(/,/g).length === 1 && !/^\d{1,3},\d{3}$/.test(t)) ? ',' : '.';
      else if (p >= 0) d = (t.match(/\./g).length === 1 && !/^\d{1,3}\.\d{3}$/.test(t)) ? '.' : ',';
      else d = ',';
    }
    const tis = d === ',' ? '.' : ',';
    t = t.split(tis).join('');
    if (d === ',') t = t.replace(',', '.');
    if (!/^\d*\.?\d*$/.test(t)) return null;
    const v = parseFloat(t);
    return isFinite(v) ? (zapor ? -v : v) : null;
  }
  // z hodnot sloupce s částkami odhadne desetinný oddělovač
  function detekujDesetinnou(hodnoty) {
    let c = 0, p = 0;
    for (const h of hodnoty) {
      const t = String(h || '').replace(/[\s ]/g, '');
      if (/,\d{1,2}$/.test(t)) c++;
      else if (/\.\d{1,2}$/.test(t)) p++;
      else if (/\.\d{3},/.test(t)) c++;
      else if (/,\d{3}\./.test(t)) p++;
    }
    return p > c ? '.' : ',';
  }
  // format: 'auto' | 'DMY' | 'MDY' | 'YMD'
  function parsujDatum(s, format = 'auto') {
    if (s == null) return null;
    const t = String(s).trim();
    if (!t) return null;
    let r, m, d, h = 0, mi = 0, se = 0, maCas = false;
    const cas = t.match(/(?:^|[ T])(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (cas) { h = +cas[1]; mi = +cas[2]; se = +(cas[3] || 0); maCas = true; }
    let x;
    if ((x = t.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/))) { r = +x[1]; m = +x[2]; d = +x[3]; }
    else if ((x = t.match(/^(\d{4})(\d{2})(\d{2})(?:\D|$)/))) { r = +x[1]; m = +x[2]; d = +x[3]; }
    else if ((x = t.match(/^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})/))) {
      let a = +x[1], b = +x[2]; r = +x[3]; if (r < 100) r += 2000;
      const lomitko = /\//.test(t.slice(0, x[0].length));
      const f = format === 'auto' ? (lomitko && b > 12 ? 'MDY' : 'DMY') : format;
      if (f === 'MDY') { m = a; d = b; } else { d = a; m = b; }
    } else return null;
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && h < 24 && mi < 60)) return null;
    const ms = Date.UTC(r, m - 1, d, h, mi, se);
    if (new Date(ms).getUTCDate() !== d) return null;
    return { t: ms, maCas };
  }
  function detekujFormatData(hodnoty) {
    let mdy = 0;
    for (const h of hodnoty) { const x = String(h || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}/); if (x && +x[2] > 12) mdy++; if (x && +x[1] > 12) return 'DMY'; }
    return mdy ? 'MDY' : 'auto';
  }

  /* ---------- čísla účtů ---------- */
  function ibanPlatny(iban) {
    const s = iban.slice(4) + iban.slice(0, 4);
    let z = 0;
    for (const ch of s) { const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55); for (const c of v) z = (z * 10 + +c) % 97; }
    return z === 1;
  }
  function vytvorIbanCz(predcisli, cislo, banka) {
    const bban = String(banka).padStart(4, '0') + String(predcisli || 0).padStart(6, '0') + String(cislo).padStart(10, '0');
    let z = 0;
    for (const c of bban + '123500') z = (z * 10 + +c) % 97;   // C=12 Z=35 + '00'
    return 'CZ' + dva(98 - z) + bban;
  }
  // kanonický tvar: tuzemský „předčíslí-číslo/banka“ bez úvodních nul, CZ IBAN převedený, jiný IBAN velkými bez mezer
  function normUcet(s, banka) {
    if (s == null) return '';
    let t = String(s).replace(/\s+/g, '').toUpperCase();
    if (!t) return '';
    if (banka && !t.includes('/') && /^\d{4}$/.test(String(banka).trim())) t += '/' + String(banka).trim();
    const iban = t.match(/^CZ\d{2}(\d{4})(\d{6})(\d{10})$/);
    if (iban) { const p = iban[2].replace(/^0+/, ''), c = iban[3].replace(/^0+/, ''); return (p ? p + '-' : '') + (c || '0') + '/' + iban[1]; }
    if (/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(t)) return t;
    const x = t.match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
    if (x) { const p = (x[1] || '').replace(/^0+/, ''), c = x[2].replace(/^0+/, ''); return (p ? p + '-' : '') + c + '/' + x[3]; }
    return t;
  }
  const VZOR_UCTU = /(?:CZ\d{2}(?:\s?\d{4}){5}|(?:\d{1,6}-)?\d{2,10}\s?[/-]\s?\d{4})/;
  function ucetZTextu(s) {
    const x = String(s || '').match(VZOR_UCTU);
    if (!x) return '';
    return normUcet(x[0].replace(/\s?-\s?(\d{4})$/, '/$1').replace(/\s/g, ''));
  }

  /* ---------- mapování sloupců ---------- */
  const POLE = [
    ['datum', 'Datum (i s časem)'], ['cas', 'Čas (zvlášť)'], ['castka', 'Částka (se znaménkem)'], ['prijem', 'Příjem / kredit'], ['vydaj', 'Výdaj / debet'],
    ['smer', 'Směr (příchozí/odchozí)'], ['mena', 'Měna'], ['ucet', 'Vlastní účet'], ['protiucet', 'Protiúčet'], ['banka', 'Kód banky protiúčtu'],
    ['protistrana', 'Název protistrany'], ['vs', 'VS'], ['ks', 'KS'], ['ss', 'SS'], ['zprava', 'Zpráva / popis'], ['typ', 'Typ transakce'], ['zustatek', 'Zůstatek po transakci']
  ];
  // synonyma hlaviček (bez diakritiky, malými); pořadí = priorita
  const SYNONYMA = {
    datum: ['datum zauctovani', 'datum provedeni', 'datum transakce', 'datum operace', 'datum a cas', 'booking date', 'transaction date', 'datum', 'date', 'den', 'valuta', 'value date', 'splatnost'],
    cas: ['cas transakce', 'cas', 'time'],
    castka: ['castka v mene uctu', 'castka', 'objem', 'amount', 'suma', 'obrat', 'castka transakce', 'hodnota'],
    prijem: ['prijem', 'prijmy', 'kredit', 'credit', 'prichozi castka', 'pripsano', 'dal'],
    vydaj: ['vydaj', 'vydaje', 'debet', 'debit', 'odchozi castka', 'odepsano', 'dati'],
    smer: ['smer', 'smer platby', 'direction', 'debet/kredit', 'd/c', 'cr/dr'],
    mena: ['mena uctu', 'mena', 'currency', 'ccy'],
    ucet: ['vlastni ucet', 'cislo uctu', 'muj ucet', 'ucet', 'account', 'own account', 'iban uctu'],
    protiucet: ['cislo protiuctu', 'protiucet', 'iban protiuctu', 'ucet protistrany', 'counterparty account', 'counter account', 'ucet prijemce/platce', 'cislo uctu protistrany'],
    banka: ['kod banky protiuctu', 'kod banky', 'banka protiuctu', 'banka', 'bank code', 'counterparty bank'],
    protistrana: ['nazev protiuctu', 'nazev protistrany', 'protistrana', 'nazev uctu protistrany', 'prijemce/platce', 'counterparty name', 'counterparty', 'obchodnik', 'prijemce', 'platce', 'nazev', 'name'],
    vs: ['variabilni symbol', 'variable symbol', 'vs'],
    ks: ['konstantni symbol', 'constant symbol', 'ks'],
    ss: ['specificky symbol', 'specific symbol', 'ss'],
    zprava: ['zprava pro prijemce', 'zprava pro platce', 'zprava', 'poznamka', 'popis', 'popis transakce', 'informace', 'message', 'description', 'detail', 'reference', 'ucel platby'],
    typ: ['typ transakce', 'typ operace', 'druh transakce', 'typ', 'druh', 'type', 'kategorie'],
    zustatek: ['zustatek po transakci', 'zustatek', 'disponibilni zustatek', 'balance', 'running balance']
  };
  function skoreHlavicky(bunky) {
    let s = 0;
    for (const b of bunky) { const n = norm(b); if (n && Object.values(SYNONYMA).some(v => v.includes(n))) s++; }
    return s;
  }
  function najdiHlavicku(radky) {
    let nej = 0, sk = -1;
    for (let i = 0; i < Math.min(radky.length, 40); i++) {
      const s = skoreHlavicky(radky[i]) * 10 + Math.min(radky[i].filter(b => b).length, 9);
      if (s > sk) { sk = s; nej = i; }
    }
    return nej;
  }
  function odhadniMapovani(hlavicka, data) {
    const m = {}, pouzite = new Set();
    const hl = hlavicka.map(norm);
    for (const [pole] of POLE) {
      for (const syn of SYNONYMA[pole]) {
        const i = hl.findIndex((h, j) => !pouzite.has(j) && h === syn);
        if (i >= 0) { m[pole] = i; pouzite.add(i); break; }
      }
    }
    // druhé kolo: hlavička obsahuje synonymum (např. „Datum zaúčtování platby“)
    for (const [pole] of POLE) {
      if (m[pole] != null) continue;
      for (const syn of SYNONYMA[pole]) {
        if (syn.length < 4) continue;
        const i = hl.findIndex((h, j) => !pouzite.has(j) && h.includes(syn));
        if (i >= 0) { m[pole] = i; pouzite.add(i); break; }
      }
    }
    // podle obsahu: datum, částka
    const vzorek = (data || []).slice(0, 30);
    const sloupec = i => vzorek.map(r => r[i]).filter(v => v != null && v !== '');
    if (m.datum == null) {
      const i = hlavicka.findIndex((_, j) => !pouzite.has(j) && sloupec(j).length && sloupec(j).every(v => parsujDatum(v)));
      if (i >= 0) { m.datum = i; pouzite.add(i); }
    }
    if (m.castka == null && m.prijem == null) {
      const i = hlavicka.findIndex((_, j) => !pouzite.has(j) && sloupec(j).length && sloupec(j).every(v => /^[-+−]?[\d\s .,]+(\s?[A-Z]{3})?$/.test(v)) && sloupec(j).some(v => /^[-−]/.test(v)));
      if (i >= 0) { m.castka = i; pouzite.add(i); }
    }
    if (m.prijem != null && m.vydaj == null && m.castka == null) delete m.prijem;   // samotný „kredit“ bez debetu nedává smysl
    return m;
  }

  /* ---------- typ transakce ---------- */
  function urciTyp(typText, zprava, protiucet) {
    const t = norm(typText) + ' ' + norm(zprava);
    if (protiucet) return 'prevod';   // hotovost ani karta protiúčet nemají
    if (/hotovost|vklad|vyber|bankomat|\batm\b|cash/.test(t)) return 'hotovost';
    if (/karta|kartou|card|\bpos\b|platba kartou/.test(t)) return 'karta';
    if (/poplat|\bfee\b|uroky?\b|urok |interest|dan z uroku/.test(t)) return 'poplatek';
    return 'jine';
  }
  const TYPY = { prevod: 'převod', hotovost: 'hotovost', karta: 'karta', poplatek: 'poplatek/úrok', jine: 'jiné' };

  /* ---------- příprava importu ---------- */
  function pripravImport(bajty, nazev, volby = {}) {
    const { text, kodovani } = dekoduj(bajty, volby.kodovani || 'auto');
    const oddelovac = volby.oddelovac || detekujOddelovac(text);
    const radky = parsujCsv(text, oddelovac);
    const hlavickaIdx = volby.hlavickaIdx != null ? volby.hlavickaIdx : najdiHlavicku(radky);
    const hlavicka = radky[hlavickaIdx] || [];
    const data = radky.slice(hlavickaIdx + 1);
    const mapovani = volby.mapovani || odhadniMapovani(hlavicka, data);
    const sloupec = i => i == null ? [] : data.map(r => r[i]).filter(Boolean);
    const castkoveHodnoty = [].concat(sloupec(mapovani.castka), sloupec(mapovani.prijem), sloupec(mapovani.vydaj), sloupec(mapovani.zustatek));
    const desetinna = volby.desetinna || detekujDesetinnou(castkoveHodnoty);
    const formatData = volby.formatData || detekujFormatData(sloupec(mapovani.datum));
    // vlastní účet: sloupec, preambule nad hlavičkou, název souboru
    let vlastniUcet = volby.vlastniUcet || '';
    if (!vlastniUcet && mapovani.ucet == null) {
      for (const r of radky.slice(0, hlavickaIdx)) { const u = ucetZTextu(r.join(' ')); if (u) { vlastniUcet = u; break; } }
      if (!vlastniUcet) vlastniUcet = ucetZTextu(String(nazev || '').replace(/_/g, ' '));
    }
    return { nazev, kodovani, oddelovac, radky, hlavickaIdx, hlavicka, mapovani, desetinna, formatData, vlastniUcet: normUcet(vlastniUcet), velikost: bajty.length || bajty.byteLength || 0 };
  }

  // převede připravený import na transakce; chyby = řádky, které nešly přečíst (s důvodem)
  function prevedImport(pr) {
    const m = pr.mapovani, data = pr.radky.slice(pr.hlavickaIdx + 1), transakce = [], chyby = [];
    const bunka = (r, k) => m[k] == null ? '' : (r[m[k]] || '').trim();
    data.forEach((r, i) => {
      const cisloRadku = r.radek || pr.hlavickaIdx + 2 + i;
      if (r.every(b => !b)) return;
      let dt = parsujDatum(bunka(r, 'datum'), pr.formatData);
      if (dt && m.cas != null && bunka(r, 'cas')) {
        const c = bunka(r, 'cas').match(/(\d{1,2}):(\d{2})/);
        if (c) dt = { t: dt.t - (dt.t % DEN) + (+c[1]) * HOD + (+c[2]) * 60000, maCas: true };
      }
      if (!dt) { chyby.push({ radek: cisloRadku, duvod: 'nečitelné datum „' + bunka(r, 'datum') + '“' }); return; }
      let castka = null;
      if (m.castka != null) castka = parsujCislo(bunka(r, 'castka'), pr.desetinna);
      else {
        const p = parsujCislo(bunka(r, 'prijem'), pr.desetinna), v = parsujCislo(bunka(r, 'vydaj'), pr.desetinna);
        if (p != null || v != null) castka = (p || 0) - Math.abs(v || 0);
      }
      if (castka == null) { chyby.push({ radek: cisloRadku, duvod: 'chybí částka' }); return; }
      if (m.smer != null) {
        const s = norm(bunka(r, 'smer'));
        if (castka > 0 && /^(odchozi|debet|debit|vydaj|d|dr|out)/.test(s)) castka = -castka;
        else if (castka < 0 && /^(prichozi|kredit|credit|prijem|c|cr|in)/.test(s)) castka = -castka;
      }
      const ucet = normUcet(bunka(r, 'ucet')) || pr.vlastniUcet || '';
      if (!ucet) { chyby.push({ radek: cisloRadku, duvod: 'neznámý vlastní účet' }); return; }
      const protiucet = normUcet(bunka(r, 'protiucet'), bunka(r, 'banka'));
      const zprava = bunka(r, 'zprava');
      const zm = m.zustatek != null ? parsujCislo(bunka(r, 'zustatek'), pr.desetinna) : null;
      transakce.push({
        ucet, t: dt.t, maCas: dt.maCas, castka: zaokr(castka), mena: (bunka(r, 'mena') || 'CZK').toUpperCase().slice(0, 3),
        protiucet, protistrana: bunka(r, 'protistrana'), vs: bunka(r, 'vs').replace(/^0+(?=\d)/, ''), ks: bunka(r, 'ks'), ss: bunka(r, 'ss'),
        zprava, typ: urciTyp(bunka(r, 'typ'), zprava + ' ' + bunka(r, 'protistrana'), protiucet), zustatek: zm, radek: cisloRadku
      });
    });
    return { transakce, chyby };
  }

  async function sha256Hex(bajty) {
    const c = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto : (typeof require === 'function' ? require('node:crypto').webcrypto : null);
    const h = await c.subtle.digest('SHA-256', bajty instanceof Uint8Array ? bajty : new Uint8Array(bajty));
    return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- projekt ---------- */
  const novyId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function prazdny(nazev) {
    return { id: novyId(), nazev: nazev || 'Nové šetření', znacka: '', zpracovatel: '', vytvoreno: Date.now(), zdroje: [], transakce: [], ucty: {}, dalsi: 1, parametry: vychoziParametry() };
  }
  const idTx = n => 'T' + String(n).padStart(4, '0');
  function pridejZdroj(p, zdroj, transakce) {
    const z = Object.assign({ id: 'Z' + (p.zdroje.length + 1) }, zdroj, { pocet: transakce.length, importovano: zdroj.importovano || Date.now() });
    while (p.zdroje.some(x => x.id === z.id)) z.id += 'b';
    p.zdroje.push(z);
    for (const t of transakce) p.transakce.push(Object.assign({ id: idTx(p.dalsi++), zdroj: z.id }, t));
    return z;
  }
  function pridejRucni(p, t) {
    const tx = Object.assign({ id: idTx(p.dalsi++), zdroj: 'ruční', rucni: true, mena: 'CZK', protiucet: '', protistrana: '', vs: '', ks: '', ss: '', zprava: '', maCas: false }, t);
    tx.ucet = normUcet(tx.ucet); tx.protiucet = normUcet(tx.protiucet);
    if (!tx.typ) tx.typ = urciTyp('', tx.zprava, tx.protiucet);
    p.transakce.push(tx);
    return tx;
  }

  // klíč protistrany v grafu (účet, jinak pseudouzel podle typu/názvu)
  function uzelProti(tx) {
    if (tx.protiucet) return tx.protiucet;
    if (tx.typ === 'hotovost') return 'HOTOVOST';
    if (tx.typ === 'poplatek') return 'BANKA (poplatky, úroky)';
    if (tx.protistrana) return (tx.typ === 'karta' ? 'karta: ' : 'název: ') + tx.protistrana.trim();
    return '? (neuvedeno)';
  }
  const jePseudo = u => !/\d/.test(u.split(':')[0]) || /^(karta|název):/.test(u) || u === 'HOTOVOST' || u.startsWith('BANKA') || u.startsWith('?');

  /* Duplicity: stejná transakce téhož účtu ve dvou různých výpisech (překrývající se období).
     V rámci jednoho výpisu se shodné řádky NEslučují – dvě stejné platby kartou mohou být skutečné.
     Párování: odchozí z A na B ↔ příchozí na B z A (stejná částka a měna, ≤ parDni) = jeden převod. */
  function prepocitej(p) {
    const tx = p.transakce;
    tx.forEach(t => { t.dup = null; t.par = null; t.uzel = uzelProti(t); });
    const klic = t => [t.ucet, isoDen(t.t), t.castka.toFixed(2), t.protiucet, t.vs, norm(t.zprava).slice(0, 40)].join('|');
    // k-tá shodná transakce výpisu S je duplicitou k-té shodné transakce dřívějšího výpisu (když tam je)
    const videno = new Map();
    for (const t of tx) {
      if (t.rucni) continue;
      const k = klic(t), poZdr = videno.get(k) || new Map();
      videno.set(k, poZdr);
      const moje = poZdr.get(t.zdroj) || []; poZdr.set(t.zdroj, moje);
      const poradi = moje.length; moje.push(t);
      for (const [z, seznam] of poZdr) if (z !== t.zdroj && seznam.length > poradi && seznam !== moje && !seznam[poradi].dup) { t.dup = seznam[poradi].id; break; }
    }
    const vlastni = new Set(tx.map(t => t.ucet));
    const parDni = (p.parametry && p.parametry.parDni != null ? p.parametry.parDni : 3) * DEN;
    const prichozi = new Map();   // kandidáti podle účtu, částky a měny (rychlé i pro tisíce transakcí)
    const kp = (u, c, m) => u + '|' + c.toFixed(2) + '|' + m;
    for (const t of tx) if (!t.dup && t.castka > 0) { const k = kp(t.ucet, t.castka, t.mena); (prichozi.get(k) || prichozi.set(k, []).get(k)).push(t); }
    for (const a of tx.filter(t => !t.dup && t.castka < 0 && t.protiucet && vlastni.has(t.protiucet))) {
      let nej = null;
      for (const b of prichozi.get(kp(a.protiucet, -a.castka, a.mena)) || []) {
        if (b.par || b.ucet !== a.protiucet || b.castka !== -a.castka || b.mena !== a.mena) continue;
        if (b.protiucet && b.protiucet !== a.ucet) continue;
        const d = Math.abs(b.t - a.t);
        if (d <= parDni && (!nej || d < Math.abs(nej.t - a.t))) nej = b;
      }
      if (nej) { a.par = nej.id; nej.par = a.id; if (!nej.protiucet) nej.uzel = a.ucet; }
    }
    return p;
  }
  const platne = p => p.transakce.filter(t => !t.dup);
  const vlastniUcty = p => [...new Set(p.transakce.map(t => t.ucet))];

  // popisek uzlu: název z projektu, jinak nejčastější název protistrany u toho čísla
  function popisky(p) {
    const cet = {};
    for (const t of p.transakce) if (t.protiucet && t.protistrana) { const c = cet[t.protiucet] || (cet[t.protiucet] = {}); c[t.protistrana] = (c[t.protistrana] || 0) + 1; }
    const out = {};
    for (const [u, c] of Object.entries(cet)) out[u] = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
    for (const z of p.zdroje) if (z.drzitel && z.ucet) out[z.ucet] = z.drzitel;
    for (const [u, v] of Object.entries(p.ucty || {})) if (v && v.nazev) out[u] = v.nazev;
    return out;
  }
  function popisUzlu(u, pop) {
    if (pop && pop[u]) return pop[u];
    if (u.startsWith('karta: ')) return u.slice(7) + ' (karta)';
    if (u.startsWith('název: ')) return u.slice(7);
    return u;
  }

  /* toky: jedna hrana na skutečný pohyb peněz (spárovaný převod jen jednou, z odchozí strany) */
  function toky(p) {
    const out = [];
    for (const t of platne(p)) {
      if (t.par && t.castka > 0) continue;
      if (t.castka < 0) out.push({ z: t.ucet, na: t.uzel, t: t.t, castka: -t.castka, mena: t.mena, tx: t.par ? [t.id, t.par] : [t.id] });
      else if (t.castka > 0) out.push({ z: t.uzel, na: t.ucet, t: t.t, castka: t.castka, mena: t.mena, tx: [t.id] });
    }
    return out.sort((a, b) => a.t - b.t);
  }
  function agregujToky(tk) {
    const m = new Map();
    for (const f of tk) {
      const k = f.z + '\u0000' + f.na;
      const e = m.get(k) || { z: f.z, na: f.na, castka: 0, pocet: 0, tx: [] };
      e.castka += f.castka; e.pocet++; e.tx.push(...f.tx); m.set(k, e);
    }
    return [...m.values()].map(e => Object.assign(e, { castka: zaokr(e.castka) }));
  }

  /* ---------- souhrny ---------- */
  function souhrnUctu(p) {
    const pop = popisky(p), out = [];
    for (const u of vlastniUcty(p)) {
      const tx = platne(p).filter(t => t.ucet === u);
      if (!tx.length) continue;
      const prij = tx.filter(t => t.castka > 0).reduce((a, t) => a + t.castka, 0), vyd = tx.filter(t => t.castka < 0).reduce((a, t) => a - t.castka, 0);
      out.push({ ucet: u, nazev: pop[u] || '', pocet: tx.length, prijmy: zaokr(prij), vydaje: zaokr(vyd), saldo: zaokr(prij - vyd),
        od: Math.min(...tx.map(t => t.t)), do: Math.max(...tx.map(t => t.t)), protistran: new Set(tx.map(t => t.uzel)).size,
        hotovost: zaokr(tx.filter(t => t.typ === 'hotovost').reduce((a, t) => a + Math.abs(t.castka), 0)) });
    }
    return out;
  }
  function souhrnProtistran(p) {
    const pop = popisky(p), m = new Map();
    for (const t of platne(p)) {
      const e = m.get(t.uzel) || { uzel: t.uzel, nazev: popisUzlu(t.uzel, pop), pocet: 0, prijato: 0, odeslano: 0, ucty: new Set(), od: t.t, do: t.t };
      e.pocet++; if (t.castka > 0) e.odeslano += t.castka; else e.prijato -= t.castka;   // z pohledu protistrany
      e.ucty.add(t.ucet); e.od = Math.min(e.od, t.t); e.do = Math.max(e.do, t.t); m.set(t.uzel, e);
    }
    return [...m.values()].map(e => Object.assign(e, { prijato: zaokr(e.prijato), odeslano: zaokr(e.odeslano), obrat: zaokr(e.prijato + e.odeslano), ucty: [...e.ucty] })).sort((a, b) => b.obrat - a.obrat);
  }
  // zůstatky: kumulovaný součet; když výpis nese zůstatek, posune se na skutečnou úroveň
  function zustatky(p) {
    const out = [];
    for (const u of vlastniUcty(p)) {
      const tx = platne(p).filter(t => t.ucet === u).sort((a, b) => a.t - b.t || (a.radek || 0) - (b.radek || 0));
      if (!tx.length) continue;
      let s = 0; const body = [];
      let posun = null;
      for (const t of tx) { s += t.castka; if (posun == null && t.zustatek != null) posun = t.zustatek - s; body.push({ t: t.t, z: s, tx: t.id }); }
      body.forEach(b => { b.z = zaokr(b.z + (posun || 0)); });
      out.push({ ucet: u, skutecny: posun != null, body });
    }
    return out;
  }

  /* ---------- Sankey bez cyklů ---------- */
  // 1) top hrany podle objemu, zbytek se vynechá (počítá se); 2) obousměrné páry → čistý tok (poznámka);
  // 3) zbylé cykly se rozpojí odebráním nejslabší hrany cyklu (poznámka); 4) vrstvy podle nejdelší cesty, propady vpravo.
  function sankey(agr, volby = {}) {
    const maxHran = volby.maxHran || 40;
    let hrany = agr.filter(h => h.z !== h.na).sort((a, b) => b.castka - a.castka);
    const vynechano = hrany.slice(maxHran); hrany = hrany.slice(0, maxHran).map(h => Object.assign({}, h));
    const slouceno = [], odebrano = [];
    const mapa = new Map(hrany.map(h => [h.z + '\u0000' + h.na, h]));
    for (const h of hrany) {
      const o = mapa.get(h.na + '\u0000' + h.z);
      if (!o || h.smazano || o.smazano) continue;
      const [vetsi, mensi] = h.castka >= o.castka ? [h, o] : [o, h];
      slouceno.push({ a: vetsi.z, b: vetsi.na, tam: vetsi.castka, zpet: mensi.castka });
      mensi.smazano = true; vetsi.castka = zaokr(vetsi.castka - mensi.castka); vetsi.cisty = true; vetsi.tx = vetsi.tx.concat(mensi.tx);
      if (vetsi.castka <= 0) vetsi.smazano = true;
    }
    hrany = hrany.filter(h => !h.smazano);
    // rozpojení cyklů
    for (let pruchod = 0; pruchod < 200; pruchod++) {
      const ven = {}; hrany.forEach(h => (ven[h.z] || (ven[h.z] = [])).push(h));
      const stav = {}, zasobnik = []; let cyklus = null;
      const dfs = u => {
        stav[u] = 1;
        for (const h of ven[u] || []) {
          if (cyklus) return;
          if (stav[h.na] === 1) { const i = zasobnik.findIndex(x => x.z === h.na); cyklus = zasobnik.slice(i).concat(h); return; }
          if (!stav[h.na]) { zasobnik.push(h); dfs(h.na); zasobnik.pop(); }
        }
        stav[u] = 2;
      };
      for (const u of Object.keys(ven)) { if (!stav[u] && !cyklus) dfs(u); }
      if (!cyklus) break;
      const min = cyklus.reduce((a, b) => (b.castka < a.castka ? b : a));
      odebrano.push({ z: min.z, na: min.na, castka: min.castka, cyklus: cyklus.map(h => h.z).concat(cyklus[cyklus.length - 1].na) });
      hrany = hrany.filter(h => h !== min);
    }
    // vrstvy
    const uzly = [...new Set(hrany.flatMap(h => [h.z, h.na]))];
    const vrstva = {}; uzly.forEach(u => { vrstva[u] = 0; });
    for (let i = 0; i < uzly.length; i++) { let zmena = false; for (const h of hrany) if (vrstva[h.na] < vrstva[h.z] + 1) { vrstva[h.na] = vrstva[h.z] + 1; zmena = true; } if (!zmena) break; }
    const maxV = Math.max(0, ...Object.values(vrstva));
    const maVen = new Set(hrany.map(h => h.z));
    uzly.forEach(u => { if (!maVen.has(u)) vrstva[u] = maxV; });
    const hodnota = {};
    uzly.forEach(u => { const i = hrany.filter(h => h.na === u).reduce((a, h) => a + h.castka, 0), o = hrany.filter(h => h.z === u).reduce((a, h) => a + h.castka, 0); hodnota[u] = Math.max(i, o); });
    return { uzly: uzly.map(u => ({ id: u, vrstva: vrstva[u], hodnota: zaokr(hodnota[u]) })), hrany, vrstev: maxV + 1, slouceno, odebrano, vynechano: vynechano.length, vynechanoCastka: zaokr(vynechano.reduce((a, h) => a + h.castka, 0)) };
  }
  // rozmístění: x podle vrstvy, y složené ve sloupci, pořadí podle barycentra předchůdců
  function rozvrhSankey(s, W, H, volby = {}) {
    const sirka = volby.sirkaUzlu || 14, mezera = volby.mezera || 10;
    const sloupce = Array.from({ length: s.vrstev }, () => []);
    s.uzly.forEach(u => sloupce[u.vrstva].push(u));
    const sum = sl => sl.reduce((a, u) => a + u.hodnota, 0);
    const meritko = Math.min(...sloupce.filter(sl => sl.length).map(sl => (H - mezera * (sl.length - 1)) / (sum(sl) || 1)));
    const pos = {};
    for (let it = 0; it < 4; it++) {
      sloupce.forEach((sl, i) => {
        if (it > 0 && i > 0) {
          const bc = u => { const p = s.hrany.filter(h => h.na === u.id && pos[h.z]); return p.length ? p.reduce((a, h) => a + (pos[h.z].y + pos[h.z].h / 2) * h.castka, 0) / p.reduce((a, h) => a + h.castka, 0) : H / 2; };
          sl.sort((a, b) => bc(a) - bc(b));
        } else if (it === 0) sl.sort((a, b) => b.hodnota - a.hodnota);
        const vyska = sum(sl) * meritko + mezera * (sl.length - 1);
        let y = Math.max(0, (H - vyska) / 2);
        const x = s.vrstev > 1 ? i * (W - sirka) / (s.vrstev - 1) : (W - sirka) / 2;
        for (const u of sl) { const h = Math.max(1, u.hodnota * meritko); pos[u.id] = { x, y, h, w: sirka }; y += h + mezera; }
      });
    }
    // pásy: odchozí seřazené podle y cíle, příchozí podle y zdroje
    const pasy = [];
    for (const u of Object.keys(pos)) {
      let y = pos[u].y;
      for (const h of s.hrany.filter(h => h.z === u).sort((a, b) => pos[a.na].y - pos[b.na].y)) { h._tl = Math.max(1, h.castka * meritko); h._y0 = y + h._tl / 2; y += h._tl; }
    }
    for (const u of Object.keys(pos)) {
      let y = pos[u].y;
      for (const h of s.hrany.filter(h => h.na === u).sort((a, b) => pos[a.z].y - pos[b.z].y)) { h._y1 = y + h._tl / 2; y += h._tl; }
    }
    for (const h of s.hrany) {
      const a = pos[h.z], b = pos[h.na], x0 = a.x + a.w, x1 = b.x, xm = (x0 + x1) / 2;
      pasy.push({ hrana: h, d: `M${x0.toFixed(1)},${h._y0.toFixed(1)} C${xm.toFixed(1)},${h._y0.toFixed(1)} ${xm.toFixed(1)},${h._y1.toFixed(1)} ${x1.toFixed(1)},${h._y1.toFixed(1)}`, tloustka: h._tl });
    }
    return { pos, pasy, meritko };
  }

  /* ---------- graf vazeb: silové rozmístění (deterministické) ---------- */
  function rozvrhGrafu(uzly, hrany, W, H, iteraci = 300) {
    const n = uzly.length, pos = {};
    uzly.forEach((u, i) => { const a = 2 * Math.PI * i / Math.max(1, n); pos[u] = { x: W / 2 + Math.cos(a) * W * 0.35, y: H / 2 + Math.sin(a) * H * 0.35 }; });
    const k = Math.sqrt(W * H / Math.max(1, n)) * 0.75;
    let tepl = W / 8;
    for (let it = 0; it < iteraci; it++) {
      const d = {}; uzly.forEach(u => { d[u] = { x: 0, y: 0 }; });
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = pos[uzly[i]], b = pos[uzly[j]]; let dx = a.x - b.x, dy = a.y - b.y; const r = Math.max(0.01, Math.hypot(dx, dy)); const f = k * k / r;
        dx /= r; dy /= r; d[uzly[i]].x += dx * f; d[uzly[i]].y += dy * f; d[uzly[j]].x -= dx * f; d[uzly[j]].y -= dy * f;
      }
      for (const h of hrany) {
        const a = pos[h.z], b = pos[h.na]; if (!a || !b || a === b) continue;
        let dx = a.x - b.x, dy = a.y - b.y; const r = Math.max(0.01, Math.hypot(dx, dy)); const f = r * r / k;
        dx /= r; dy /= r; d[h.z].x -= dx * f; d[h.z].y -= dy * f; d[h.na].x += dx * f; d[h.na].y += dy * f;
      }
      for (const u of uzly) {
        const v = d[u], r = Math.max(0.01, Math.hypot(v.x, v.y)), s = Math.min(r, tepl);
        pos[u].x = Math.min(W - 30, Math.max(30, pos[u].x + v.x / r * s)); pos[u].y = Math.min(H - 20, Math.max(20, pos[u].y + v.y / r * s));
      }
      tepl = Math.max(0.5, tepl * 0.985);
    }
    return pos;
  }

  /* ---------- detekce vzorců ---------- */
  const DETEKCE = {
    strukturovani: {
      nazev: 'Dělení pod limit (structuring / smurfing)', ikona: '🧱',
      popis: 'Několik vkladů nebo výběrů s částkou těsně pod zvoleným limitem v krátkém období na jednom účtu – typické pro rozdělování hotovosti, aby jednotlivá transakce nepřekročila hranici hlášení nebo kontroly. Limit nastav podle zadání (interní pravidla banky, hranice, kterou prověřuješ).',
      parametry: [
        { klic: 'limit', nazev: 'Limit (nastav podle zadání)', vychozi: 100000, jednotka: 'Kč', min: 1, krok: 1000 },
        { klic: 'pasmo', nazev: 'Pásmo pod limitem', vychozi: 10, jednotka: '%', min: 1, max: 50, krok: 1 },
        { klic: 'okno', nazev: 'Okno', vychozi: 7, jednotka: 'dní', min: 1, max: 90, krok: 1 },
        { klic: 'minPocet', nazev: 'Nejméně transakcí v okně', vychozi: 3, jednotka: '', min: 2, max: 50, krok: 1 },
        { klic: 'jenHotovost', nazev: 'Jen hotovost (vklady/výběry)', vychozi: 1, jednotka: 'ano=1', min: 0, max: 1, krok: 1 }
      ]
    },
    prutok: {
      nazev: 'Rychlý průtok', ikona: '⚡',
      popis: 'Příchozí platba, která z účtu do X hodin z velké části odejde dál. Odchozí platby se přiřazují k příchozím metodou LIFO (nejdřív se „utrácí“ to, co přišlo naposledy), takže starší zůstatek průtok nevytváří. Typické pro převodní účty (money mule) – ale i pro běžné splácení či přeposílání v rodině.',
      parametry: [
        { klic: 'okno', nazev: 'Do kolika hodin odejde', vychozi: 48, jednotka: 'h', min: 1, max: 720, krok: 1 },
        { klic: 'podil', nazev: 'Podíl, který musí odejít', vychozi: 80, jednotka: '%', min: 10, max: 100, krok: 5 },
        { klic: 'minCastka', nazev: 'Příchozí platba nejméně', vychozi: 10000, jednotka: 'Kč', min: 0, krok: 1000 }
      ]
    },
    okruhy: {
      nazev: 'Okruhy (peníze se vrátí)', ikona: '🔄',
      popis: 'Řetězec převodů, který začne i skončí na stejném účtu přes prostředníky, s časovou návazností (každý další převod nejdřív ve dni předchozího) a v okně X dní. Částka může cestou klesat o „poplatky“ – každý článek musí mít aspoň zvolený podíl první částky. Zpětné převody A ↔ B (půjčka a splátka) se za okruh nepovažují, dokud nesnížíš minimální délku na 2.',
      parametry: [
        { klic: 'okno', nazev: 'Celý okruh do', vychozi: 30, jednotka: 'dní', min: 1, max: 365, krok: 1 },
        { klic: 'minDelka', nazev: 'Nejméně převodů v okruhu', vychozi: 3, jednotka: '', min: 2, max: 8, krok: 1 },
        { klic: 'maxDelka', nazev: 'Nejvíce převodů v okruhu', vychozi: 6, jednotka: '', min: 2, max: 8, krok: 1 },
        { klic: 'podil', nazev: 'Článek aspoň z první částky', vychozi: 50, jednotka: '%', min: 1, max: 100, krok: 5 },
        { klic: 'minCastka', nazev: 'První převod nejméně', vychozi: 10000, jednotka: 'Kč', min: 0, krok: 1000 }
      ]
    },
    vejir: {
      nazev: 'Vějíř dovnitř / ven', ikona: '🪭',
      popis: 'Mnoho různých plátců posílá na jeden účet a peníze z něj odcházejí k jednomu či dvěma příjemcům (sběrný účet), nebo naopak jeden zdroj se rozdělí mnoha příjemcům (rozdělovací účet). Počítají se jen platby z/na bankovní účty nad zvolenou částku, karty a hotovost ne.',
      parametry: [
        { klic: 'minStran', nazev: 'Nejméně různých plátců / příjemců', vychozi: 5, jednotka: '', min: 2, max: 100, krok: 1 },
        { klic: 'okno', nazev: 'Okno', vychozi: 14, jednotka: 'dní', min: 1, max: 180, krok: 1 },
        { klic: 'podil', nazev: 'Podíl soustředěný na 1–2 účty', vychozi: 70, jednotka: '%', min: 10, max: 100, krok: 5 },
        { klic: 'minCastka', nazev: 'Platba nejméně', vychozi: 5000, jednotka: 'Kč', min: 0, krok: 500 }
      ]
    },
    kulate: {
      nazev: 'Kulaté částky', ikona: '⭕',
      popis: 'Účet, kde velké platby mají nápadně často kulatou částku (násobek zvolené hodnoty). Skutečné obchodní platby (faktury s DPH, mzdy) bývají „nekulaté“. Opakované platby stejné částky téže protistraně (nájem, trvalý příkaz) se nepočítají.',
      parametry: [
        { klic: 'nasobek', nazev: 'Kulatá = násobek', vychozi: 1000, jednotka: 'Kč', min: 10, krok: 10 },
        { klic: 'minCastka', nazev: 'Posuzovat platby od', vychozi: 10000, jednotka: 'Kč', min: 0, krok: 1000 },
        { klic: 'minPocet', nazev: 'Nejméně kulatých plateb', vychozi: 3, jednotka: '', min: 1, max: 100, krok: 1 },
        { klic: 'minPodil', nazev: 'Podíl kulatých mezi posuzovanými', vychozi: 50, jednotka: '%', min: 1, max: 100, krok: 5 }
      ]
    },
    casy: {
      nazev: 'Neobvyklé časy', ikona: '🌙',
      popis: 'Transakce v noci (případně o víkendu). Funguje jen u výpisů, které nesou čas transakce – výpisy jen s datem se přeskočí. Noční internetové bankovnictví může znamenat ovládání účtu někým jiným, ale i směnný provoz.',
      parametry: [
        { klic: 'od', nazev: 'Noc od', vychozi: 23, jednotka: 'h', min: 0, max: 23, krok: 1 },
        { klic: 'do', nazev: 'Noc do', vychozi: 5, jednotka: 'h', min: 0, max: 23, krok: 1 },
        { klic: 'minPocet', nazev: 'Nejméně takových transakcí', vychozi: 3, jednotka: '', min: 1, max: 100, krok: 1 },
        { klic: 'vikend', nazev: 'Počítat i víkend', vychozi: 0, jednotka: 'ano=1', min: 0, max: 1, krok: 1 }
      ]
    },
    zmena: {
      nazev: 'Náhlá změna chování účtu', ikona: '📈',
      popis: 'Denní obrat účtu v okně X dní je mnohonásobně vyšší než v předchozím základním období (u účtu, který měl dlouho malý pohyb a najednou jím protékají velké sumy). Porovnává průměrný denní obrat (příjmy + výdaje).',
      parametry: [
        { klic: 'zaklad', nazev: 'Základní období', vychozi: 60, jednotka: 'dní', min: 7, max: 365, krok: 1 },
        { klic: 'okno', nazev: 'Sledované okno', vychozi: 14, jednotka: 'dní', min: 1, max: 90, krok: 1 },
        { klic: 'nasobek', nazev: 'Kolikrát vyšší obrat', vychozi: 5, jednotka: '×', min: 1.5, max: 100, krok: 0.5 },
        { klic: 'minObrat', nazev: 'Obrat v okně nejméně', vychozi: 50000, jednotka: 'Kč', min: 0, krok: 5000 }
      ]
    }
  };
  function vychoziParametry() {
    const o = { parDni: 3 };
    for (const [k, d] of Object.entries(DETEKCE)) { o[k] = { zapnuto: true }; for (const p of d.parametry) o[k][p.klic] = p.vychozi; }
    return o;
  }
  function parametryDetekce(p, k) { return Object.assign({}, vychoziParametry()[k], (p.parametry || {})[k] || {}); }

  const poUctech = p => { const m = {}; for (const t of platne(p)) (m[t.ucet] || (m[t.ucet] = [])).push(t); Object.values(m).forEach(a => a.sort((x, y) => x.t - y.t || (y.castka > 0) - (x.castka > 0))); return m; };
  const soucet = a => zaokr(a.reduce((s, t) => s + Math.abs(t.castka), 0));

  const FN = {
    strukturovani(p, q) {
      const out = [], dolni = q.limit * (1 - q.pasmo / 100);
      for (const [u, tx] of Object.entries(poUctech(p))) {
        for (const smer of [1, -1]) {
          const kand = tx.filter(t => Math.sign(t.castka) === smer && Math.abs(t.castka) >= dolni && Math.abs(t.castka) < q.limit && (!q.jenHotovost || t.typ === 'hotovost'));
          // okna s ≥ minPocet transakcemi; překrývající se okna se sloučí do jednoho období
          const useky = [];
          for (let i = 0; i < kand.length; i++) {
            let j = i; while (j + 1 < kand.length && kand[j + 1].t - kand[i].t <= q.okno * DEN) j++;
            if (j - i + 1 < q.minPocet) continue;
            const posl = useky[useky.length - 1];
            if (posl && i <= posl[1]) posl[1] = Math.max(posl[1], j); else useky.push([i, j]);
          }
          for (const [i, j] of useky) {
            const sk = kand.slice(i, j + 1);
            {
              out.push({ ucet: u, tx: sk.map(t => t.id), od: sk[0].t, do: sk[sk.length - 1].t, skore: sk.length,
                text: `${sk.length} ${smer > 0 ? 'vkladů/příjmů' : 'výběrů/výdajů'} v pásmu ${fmtCastka(dolni)}–${fmtCastka(q.limit)} Kč během ${Math.max(1, Math.round((sk[sk.length - 1].t - sk[0].t) / DEN))} dní, celkem ${fmtCastka(soucet(sk))} Kč (každá zvlášť pod limitem, dohromady ${(soucet(sk) / q.limit).toFixed(1).replace('.', ',')}× limit).`,
                udaje: { pocet: sk.length, smer: smer > 0 ? 'vklady' : 'výběry', soucet: soucet(sk) } });
            }
          }
        }
      }
      return out;
    },
    prutok(p, q) {
      const out = [];
      for (const [u, tx] of Object.entries(poUctech(p))) {
        // LIFO: odchozí platba „spotřebuje“ nejdřív naposledy příchozí peníze
        const udalosti = [], vsechny = new Map();
        const zas2 = [];
        for (const t of tx) {
          if (t.castka > 0) { const o = { tx: t, zbyva: t.castka, odeslo: [] }; zas2.push(o); vsechny.set(t.id, o); }
          else if (t.castka < 0) {
            let potreba = -t.castka;
            for (let k = zas2.length - 1; k >= 0 && potreba > 0; k--) {
              const z = zas2[k]; if (z.zbyva <= 0.005) continue;
              const vzato = Math.min(z.zbyva, potreba); z.zbyva -= vzato; potreba -= vzato;
              if (t.t - z.tx.t <= q.okno * HOD) z.odeslo.push({ id: t.id, kolik: vzato, t: t.t, kam: t.uzel });
            }
            while (zas2.length && zas2[zas2.length - 1].zbyva <= 0.005) zas2.pop();
          }
        }
        for (const o of vsechny.values()) {
          if (o.tx.castka < q.minCastka) continue;
          const odeslo = o.odeslo.reduce((a, x) => a + x.kolik, 0);
          if (odeslo >= o.tx.castka * q.podil / 100) udalosti.push({ prichozi: o.tx, odeslo: zaokr(odeslo), za: Math.max(...o.odeslo.map(x => x.t)) - o.tx.t, odchozi: o.odeslo });
        }
        if (!udalosti.length) continue;
        const ids = new Set(); udalosti.forEach(e => { ids.add(e.prichozi.id); e.odchozi.forEach(x => ids.add(x.id)); });
        const prislo = zaokr(udalosti.reduce((a, e) => a + e.prichozi.castka, 0)), odeslo = zaokr(udalosti.reduce((a, e) => a + e.odeslo, 0));
        const kam = {}; udalosti.forEach(e => e.odchozi.forEach(x => { kam[x.kam] = (kam[x.kam] || 0) + x.kolik; }));
        const hlavni = Object.entries(kam).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
        const zaH = udalosti.map(e => e.za / HOD).sort((a, b) => a - b), median = zaH[Math.floor(zaH.length / 2)];
        out.push({ ucet: u, tx: [...ids], od: Math.min(...udalosti.map(e => e.prichozi.t)), do: Math.max(...udalosti.map(e => e.prichozi.t + e.za)), skore: udalosti.length,
          text: `${udalosti.length}× příchozí platba (celkem ${fmtCastka(prislo)} Kč), z níž do ${q.okno} h odešlo ≥ ${q.podil} % – celkem ${fmtCastka(odeslo)} Kč, medián ${median < 1 ? 'pod 1 h' : Math.round(median) + ' h'}${udalosti.some(e => !e.prichozi.maCas) ? ' (výpis bez času – den se počítá od půlnoci)' : ''}. Hlavní příjemci: ${hlavni.join(', ')}.`,
          udaje: { udalosti: udalosti.length, prislo, odeslo, dny: [...new Set(udalosti.map(e => isoDen(e.prichozi.t)))], prijemci: hlavni } });
      }
      return out;
    },
    okruhy(p, q) {
      const tk = toky(p).filter(f => !jePseudo(f.z) && !jePseudo(f.na) && f.z !== f.na);
      const ven = {}; tk.forEach(f => (ven[f.z] || (ven[f.z] = [])).push(f));
      const out = [], videno = new Set(); let kroku = 0;
      for (const prvni of tk) {
        if (prvni.castka < q.minCastka) continue;
        const start = prvni.z, cesta = [prvni], navstiveno = new Set([start, prvni.na]);
        const dfs = () => {
          if (++kroku > 300000 || out.length >= 50) return;
          const posl = cesta[cesta.length - 1];
          for (const f of ven[posl.na] || []) {
            if (f.t < posl.t - (posl.t % DEN) || f.t - prvni.t > q.okno * DEN || f.castka < prvni.castka * q.podil / 100 || f.castka > prvni.castka * 1.0001 / (q.podil / 100)) continue;
            if (f.na === start && cesta.length + 1 >= q.minDelka) {
              const uz = cesta.map(c => c.z).concat(f.z), min = uz.slice().sort()[0], i = uz.indexOf(min);
              const klic = uz.slice(i).concat(uz.slice(0, i)).join('>');
              if (!videno.has(klic)) {
                videno.add(klic);
                const cl = cesta.concat(f);
                out.push({ ucet: start, uzly: uz.concat(start), tx: [...new Set(cl.flatMap(c => c.tx))], od: prvni.t, do: f.t, skore: cl.length,
                  text: `Okruh ${cl.length} převodů za ${Math.max(0, Math.round((f.t - prvni.t) / DEN))} dní: ${uz.concat(start).join(' → ')}. Vyšlo ${fmtCastka(prvni.castka)} Kč, vrátilo se ${fmtCastka(f.castka)} Kč (${Math.round(f.castka / prvni.castka * 100)} %).`,
                  udaje: { delka: cl.length, uzly: uz.concat(start), vyslo: prvni.castka, vratilo: f.castka } });
              }
              continue;
            }
            if (navstiveno.has(f.na) || cesta.length + 1 >= q.maxDelka) continue;
            navstiveno.add(f.na); cesta.push(f); dfs(); cesta.pop(); navstiveno.delete(f.na);
          }
        };
        dfs();
      }
      if (out.length && (kroku > 300000 || out.length >= 50)) out.forEach(o => { o.neuplne = true; o.text += ' Hledání zastaveno na limitu (50 okruhů / 300 000 kroků) – další okruhy mohou existovat, zpřísni prahy.'; });
      return out;
    },
    vejir(p, q) {
      const out = [];
      for (const [u, tx] of Object.entries(poUctech(p))) {
        const banka = tx.filter(t => !jePseudo(t.uzel) && Math.abs(t.castka) >= q.minCastka);
        for (const smer of [1, -1]) {
          const hlavni = banka.filter(t => Math.sign(t.castka) === smer), opac = banka.filter(t => Math.sign(t.castka) === -smer);
          // posuvná okna nad časově seřazenými platbami s průběžnými součty – lineárně i pro tisíce transakcí
          let nej = null, a = 0, b = 0, c0 = 0, c1 = 0, sumHl = 0;
          const strany = new Map(), poStr = new Map();
          const pricti = (m, k, x) => { const v = (m.get(k) || 0) + x; if (Math.abs(v) < 1e-6) m.delete(k); else m.set(k, v); };
          for (let i = 0; i < hlavni.length; i++) {
            while (hlavni[a].t < hlavni[i].t) { pricti(strany, hlavni[a].uzel, -1); sumHl -= Math.abs(hlavni[a].castka); a++; }
            while (b < hlavni.length && hlavni[b].t - hlavni[i].t <= q.okno * DEN) { pricti(strany, hlavni[b].uzel, 1); sumHl += Math.abs(hlavni[b].castka); b++; }
            if (strany.size < q.minStran) continue;
            // druhá strana: kam (odkud) to jde – od začátku okna do jeho konce + okno
            // u vějíře dovnitř se hledá odtok po příchodu, u vějíře ven přítok před odchodem
            const od = smer > 0 ? hlavni[a].t : hlavni[a].t - q.okno * DEN, doT = smer > 0 ? hlavni[b - 1].t + q.okno * DEN : hlavni[b - 1].t;
            while (c1 < opac.length && opac[c1].t <= doT) { pricti(poStr, opac[c1].uzel, Math.abs(opac[c1].castka)); c1++; }
            while (c0 < c1 && opac[c0].t < od) { pricti(poStr, opac[c0].uzel, -Math.abs(opac[c0].castka)); c0++; }
            let t1 = null, t2 = null;
            for (const e of poStr) { if (!t1 || e[1] > t1[1]) { t2 = t1; t1 = e; } else if (!t2 || e[1] > t2[1]) t2 = e; }
            const top2 = [t1, t2].filter(Boolean), sumTop = top2.reduce((s, x) => s + x[1], 0);
            if (sumTop < sumHl * q.podil / 100 - 0.005) continue;
            if (!nej || strany.size > nej.strany) {
              const okno = hlavni.slice(a, b), druha = opac.slice(c0, c1), sumHlP = soucet(okno);
              const top = top2.map(([k]) => [k, zaokr(druha.filter(t => t.uzel === k).reduce((s, t) => s + Math.abs(t.castka), 0))]);
              nej = { strany: strany.size, okno, druha: druha.filter(t => top.some(x => x[0] === t.uzel)), top2: top, sumHl: sumHlP, sumTop: top.reduce((s, x) => s + x[1], 0) };
            }
          }
          if (nej) {
            const vse = nej.okno.concat(nej.druha);
            out.push({ ucet: u, tx: vse.map(t => t.id), od: Math.min(...vse.map(t => t.t)), do: Math.max(...vse.map(t => t.t)), skore: nej.strany,
              text: smer > 0
                ? `Vějíř dovnitř: ${nej.strany} různých plátců poslalo ${fmtCastka(nej.sumHl)} Kč a na ${nej.top2.map(x => x[0]).join(' a ')} odešlo ${fmtCastka(zaokr(nej.sumTop))} Kč (${Math.round(nej.sumTop / nej.sumHl * 100)} % přijatého).`
                : `Vějíř ven: ${fmtCastka(nej.sumHl)} Kč odešlo ${nej.strany} různým příjemcům a z ${nej.top2.map(x => x[0]).join(' a ')} přišlo ${fmtCastka(zaokr(nej.sumTop))} Kč (${Math.round(nej.sumTop / nej.sumHl * 100)} % odeslaného).`,
              udaje: { smer: smer > 0 ? 'dovnitř' : 'ven', strany: nej.strany, soustredeno: nej.top2.map(x => x[0]) } });
          }
        }
      }
      return out;
    },
    kulate(p, q) {
      const out = [];
      for (const [u, tx] of Object.entries(poUctech(p))) {
        const velke = tx.filter(t => Math.abs(t.castka) >= q.minCastka && t.typ !== 'poplatek');
        const opak = {}; velke.forEach(t => { const k = t.uzel + '|' + Math.abs(t.castka); opak[k] = (opak[k] || 0) + 1; });
        const posuz = velke.filter(t => opak[t.uzel + '|' + Math.abs(t.castka)] < 3);
        const kul = posuz.filter(t => Math.abs(Math.abs(t.castka) / q.nasobek - Math.round(Math.abs(t.castka) / q.nasobek)) < 1e-9);
        if (kul.length >= q.minPocet && kul.length >= posuz.length * q.minPodil / 100) {
          out.push({ ucet: u, tx: kul.map(t => t.id), od: kul[0].t, do: kul[kul.length - 1].t, skore: kul.length,
            text: `${kul.length} z ${posuz.length} plateb nad ${fmtCastka(q.minCastka)} Kč má kulatou částku (násobek ${fmtCastka(q.nasobek)} Kč), celkem ${fmtCastka(soucet(kul))} Kč. Opakované platby stejné částky téže protistraně vynechány (${velke.length - posuz.length}).`,
            udaje: { kulatych: kul.length, posuzovano: posuz.length } });
        }
      }
      return out;
    },
    casy(p, q) {
      const out = [];
      for (const [u, tx] of Object.entries(poUctech(p))) {
        const sCasem = tx.filter(t => t.maCas);
        const noc = h => q.od > q.do ? (h >= q.od || h < q.do) : (h >= q.od && h < q.do);
        const nal = sCasem.filter(t => { const d = new Date(t.t); return noc(d.getUTCHours()) || (q.vikend && (d.getUTCDay() === 0 || d.getUTCDay() === 6)); });
        if (nal.length >= q.minPocet) {
          out.push({ ucet: u, tx: nal.map(t => t.id), od: nal[0].t, do: nal[nal.length - 1].t, skore: nal.length,
            text: `${nal.length} z ${sCasem.length} transakcí s časem proběhlo ${q.vikend ? 'v noci nebo o víkendu' : 'v noci'} (${q.od}–${q.do} h), celkem ${fmtCastka(soucet(nal))} Kč.`,
            udaje: { pocet: nal.length, sCasem: sCasem.length } });
        }
      }
      return out;
    },
    zmena(p, q) {
      const out = [];
      for (const [u, tx] of Object.entries(poUctech(p))) {
        if (!tx.length) continue;
        // denní obraty + prefixové součty (rychlé i pro tisíce transakcí)
        const den0 = tx[0].t - (tx[0].t % DEN), dnu = Math.floor((tx[tx.length - 1].t - den0) / DEN) + 1;
        const obrat = new Float64Array(dnu + 1);
        tx.forEach(t => { obrat[Math.floor((t.t - den0) / DEN) + 1] += Math.abs(t.castka); });
        for (let i = 1; i <= dnu; i++) obrat[i] += obrat[i - 1];
        const mezi = (a, b) => obrat[Math.min(dnu, Math.max(0, b))] - obrat[Math.min(dnu, Math.max(0, a))];   // dny a … b−1
        let nej = null;
        for (const di of new Set(tx.map(t => Math.floor((t.t - den0) / DEN)))) {
          if (di < q.zaklad * 0.5) continue;   // málo historie na srovnání
          const zakladOd = Math.max(0, di - q.zaklad), dnuZaklad = Math.max(1, di - zakladOd);
          const obratO = mezi(di, di + q.okno), obratZ = mezi(zakladOd, di);
          if (obratO < q.minObrat) continue;
          const pomer = (obratO / q.okno) / Math.max(obratZ / dnuZaklad, 1);
          if (pomer >= q.nasobek && (!nej || pomer > nej.pomer)) nej = { pomer, d0: den0 + di * DEN, obratO, obratZ, dnuZaklad };
        }
        if (!nej) continue;
        const vOkne = tx.filter(x => x.t >= nej.d0 && x.t < nej.d0 + q.okno * DEN);
        out.push({ ucet: u, tx: vOkne.map(t => t.id), od: nej.d0, do: nej.d0 + q.okno * DEN, skore: Math.round(nej.pomer),
          text: `Od ${fmtDatum(nej.d0)} je průměrný denní obrat ${fmtCastka(Math.round(nej.obratO / q.okno))} Kč, v předchozích ${Math.round(nej.dnuZaklad)} dnech ${fmtCastka(Math.round(nej.obratZ / nej.dnuZaklad))} Kč – ${nej.pomer >= 100 ? 'více než 100' : nej.pomer.toFixed(1).replace('.', ',')}× více.`,
          udaje: { pomer: zaokr(nej.pomer, 1), od: isoDen(nej.d0) } });
      }
      return out;
    }
  };

  // spustí zapnuté detekce; nález = indicie k prověření
  function detekuj(p, jen) {
    prepocitej(p);
    const out = [];
    for (const k of Object.keys(DETEKCE)) {
      if (jen && !jen.includes(k)) continue;
      const q = parametryDetekce(p, k);
      if (!q.zapnuto) continue;
      FN[k](p, q).forEach((n, i) => out.push(Object.assign({ druh: k, id: k + '-' + (i + 1) }, n)));
    }
    return out;
  }

  /* ---------- export ---------- */
  const csvBunka = v => { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  // export pro Excel/Calc: text z výpisu začínající =, +, -, @ (nebo tab/CR) by se spustil jako vzorec → apostrof; záporná čísla zůstávají
  const csvBunkaExport = v => { const s = v == null ? '' : String(v); return csvBunka(/^[=+\-@\t\r]/.test(s) && !/^-\d[\d.,]*$/.test(s) ? "'" + s : s); };
  function doCsv(p, nalezy) {
    const poTx = {}; (nalezy || []).forEach(n => n.tx.forEach(id => { (poTx[id] || (poTx[id] = [])).push(DETEKCE[n.druh].nazev); }));
    const hl = ['id', 'zdroj', 'ucet', 'datum', 'cas', 'castka', 'mena', 'protiucet', 'protistrana', 'vs', 'ks', 'ss', 'zprava', 'typ', 'duplicita_s', 'par_s', 'indicie'];
    const r = p.transakce.slice().sort((a, b) => a.t - b.t).map(t => [t.id, t.zdroj, t.ucet, isoDen(t.t), t.maCas ? new Date(t.t).toISOString().slice(11, 16) : '', String(t.castka).replace('.', ','), t.mena, t.protiucet, t.protistrana, t.vs, t.ks, t.ss, t.zprava, TYPY[t.typ] || t.typ, t.dup || '', t.par || '', [...new Set(poTx[t.id] || [])].join(' | ')]);
    return '\ufeff' + [hl].concat(r).map(x => x.map(csvBunkaExport).join(';')).join('\r\n') + '\r\n';
  }
  // záloha projektu bez odvozených polí
  function doJson(p) {
    const o = JSON.parse(JSON.stringify(p));
    o.transakce.forEach(t => { delete t.dup; delete t.par; delete t.uzel; });
    return { format: 'webapp_financni_toky', verze: 1, projekt: o };
  }
  function zJson(o) {
    const p = o && o.format === 'webapp_financni_toky' ? o.projekt : o;
    if (!p || !Array.isArray(p.transakce) || !Array.isArray(p.zdroje)) throw new Error('soubor není záloha Finančních toků');
    p.parametry = Object.assign(vychoziParametry(), p.parametry || {});
    p.ucty = p.ucty || {}; p.dalsi = p.dalsi || p.transakce.length + 1;
    // záloha může přijít odjinud: čísla a ID se vynutí (UI je vkládá do HTML, výpočty potřebují konečná čísla)
    const cislo = (x, z) => Number.isFinite(+x) && x !== null && x !== '' ? +x : z;
    for (const [k, d] of Object.entries(DETEKCE)) {
      const q = p.parametry[k] = Object.assign({}, vychoziParametry()[k], p.parametry[k]);
      for (const x of d.parametry) q[x.klic] = cislo(q[x.klic], x.vychozi);
    }
    p.parametry.parDni = cislo(p.parametry.parDni, 3);
    p.transakce = p.transakce.filter(t => t && Number.isFinite(+t.t) && Number.isFinite(+t.castka)).map(t => Object.assign(t, {
      id: String(t.id).replace(/[^\w.-]/g, ''), t: +t.t, castka: zaokr(+t.castka), radek: cislo(t.radek, null), zustatek: cislo(t.zustatek, null),
      ucet: String(t.ucet || ''), protiucet: String(t.protiucet || ''), mena: String(t.mena || 'CZK'), zprava: String(t.zprava || ''), protistrana: String(t.protistrana || ''), vs: String(t.vs || '') }));
    p.zdroje.forEach(z => { z.pocet = cislo(z.pocet, 0); z.velikost = cislo(z.velikost, null); z.chyby = cislo(z.chyby, 0); z.importovano = cislo(z.importovano, Date.now()); });
    return prepocitej(p);
  }

  /* ---------- protokol ---------- */
  const MEZE = [
    'Výpisy ukazují jen bezhotovostní pohyby na zajištěných účtech. Hotovost po výběru, účty mimo podklady, kryptoaktiva, platby přes třetí osoby a zápočty nejsou vidět – chybějící článek může změnit celý obraz.',
    'Shoda se vzorcem není trestný čin ani důkaz úmyslu. Každá indicie má i legitimní vysvětlení (výplata a následné splátky, rodinné převody, sběr peněz za společný nákup, směnný provoz, tržby v hotovosti).',
    'Výsledky závisí na nastavených prazích; jiné prahy dají jiné nálezy. Parametry jsou v protokolu uvedeny.',
    'Výpisy bez času transakce se řadí jen podle dne (čas 00:00) – pořadí plateb v rámci dne a rychlost průtoku v hodinách jsou pak jen přibližné. Výpisy různých bank mohou uvádět datum zaúčtování nebo splatnosti; čas je místní bez časového pásma.',
    'Párování převodů a duplicit je heuristické (stejný účet, částka, měna, den / ±N dní). Dvě shodné platby téhož dne mohou být ve skutečnosti různé.',
    'Názvy protistran uvádí banka plátce a mohou být zkrácené nebo zavádějící; totožnost majitele účtu výpis neprokazuje.',
    'Zpracování osobních údajů: pracuj jen v rozsahu zadání. Pro výuku a předávání používej pseudonymizovaná data (čísla účtů a jména nahradit kódy).'
  ];
  function protokol(p, nalezy, volby = {}) {
    prepocitej(p);
    const pop = popisky(p), radek = '='.repeat(72), cara = '-'.repeat(72);
    const L = [];
    L.push(radek, 'PROTOKOL – ANALÝZA FINANČNÍCH TOKŮ Z BANKOVNÍCH VÝPISŮ', radek);
    L.push(`Šetření: ${p.nazev}${p.znacka ? '   Spisová značka: ' + p.znacka : ''}`);
    if (p.zpracovatel) L.push(`Zpracovatel: ${p.zpracovatel}`);
    L.push(`Vyhotoveno: ${volby.cas || new Date().toLocaleString('cs-CZ')}`);
    L.push('Nástroj: Finanční toky z bankovních výpisů (zpracování lokálně v prohlížeči)');
    if (p.ukazkaInfo) L.push(`POZOR: syntetická ukázka „${p.ukazkaInfo.nazev}“ – smyšlená data.`);
    L.push('', '1. ZDROJE (řetězec důkazů)', cara);
    for (const z of p.zdroje) {
      L.push(`${z.id}  ${z.soubor || z.nazev}  (${z.velikost != null ? z.velikost + ' B' : '?'}, ${z.kodovani || '?'}, oddělovač „${z.oddelovac === '\t' ? 'TAB' : z.oddelovac || '?'}“, desetinná „${z.desetinna || '?'}“)`);
      L.push(`    SHA-256: ${z.sha256 || '(neuvedeno)'}`);
      L.push(`    účet: ${z.ucet || 'ze sloupce'}${z.drzitel ? ' – ' + z.drzitel : ''}; transakcí ${z.pocet}${z.chyby ? ', nepřečtených řádků ' + z.chyby : ''}; importováno ${new Date(z.importovano).toLocaleString('cs-CZ')}`);
    }
    const rucni = p.transakce.filter(t => t.rucni);
    if (rucni.length) L.push(`Ruční záznamy: ${rucni.length} (${rucni.map(t => t.id).join(', ')})`);
    const upr = p.transakce.filter(t => t.upraveno && !t.rucni);
    if (upr.length) L.push(`Ručně upravené importované transakce: ${upr.map(t => t.id).join(', ')}`);
    const dup = p.transakce.filter(t => t.dup), par = p.transakce.filter(t => t.par && t.castka < 0);
    L.push(`Duplicity mezi výpisy (vyřazeny z analýzy): ${dup.length}${dup.length ? ' – ' + dup.slice(0, 30).map(t => t.id + '=' + t.dup).join(', ') + (dup.length > 30 ? ' …' : '') : ''}`);
    L.push(`Spárované převody mezi zajištěnými účty: ${par.length}${par.length ? ' – ' + par.slice(0, 30).map(t => t.id + '↔' + t.par).join(', ') + (par.length > 30 ? ' …' : '') : ''}`);
    L.push('', '2. ÚČTY', cara);
    for (const s of souhrnUctu(p)) L.push(`${s.ucet}${s.nazev ? ' (' + s.nazev + ')' : ''}: ${fmtDatum(s.od)} – ${fmtDatum(s.do)}, ${s.pocet} transakcí, příjmy ${fmtCastka(s.prijmy)}, výdaje ${fmtCastka(s.vydaje)}, saldo ${fmtCastka(s.saldo)}, hotovost ${fmtCastka(s.hotovost)}, protistran ${s.protistran}`);
    L.push('', '3. PARAMETRY DETEKCE', cara);
    for (const [k, d] of Object.entries(DETEKCE)) {
      const q = parametryDetekce(p, k);
      L.push(`${d.nazev}: ${q.zapnuto ? d.parametry.map(x => `${x.nazev.toLowerCase()} ${q[x.klic]}${x.jednotka && x.jednotka !== 'ano=1' ? ' ' + x.jednotka : ''}`).join('; ') : 'vypnuto'}`);
    }
    L.push(`Párování převodů: ±${p.parametry.parDni} dní`);
    L.push('', '4. INDICIE K PROVĚŘENÍ (nejde o závěry)', cara);
    if (!nalezy || !nalezy.length) L.push('Žádný vzorec nepřekročil nastavené prahy. To neznamená, že k ničemu nedošlo – viz meze.');
    const txById = new Map(p.transakce.map(t => [t.id, t]));
    (nalezy || []).forEach((n, i) => {
      L.push(`${i + 1}. [${DETEKCE[n.druh].nazev}] účet ${n.ucet}${pop[n.ucet] ? ' (' + pop[n.ucet] + ')' : ''}, ${fmtDatum(n.od)} – ${fmtDatum(n.do)}`);
      L.push('   ' + n.text);
      if (n.poznamka) L.push('   Poznámka: ' + n.poznamka);
      if (n.stav) L.push('   Stav prověření: ' + n.stav);
      const ukaz = n.tx.slice(0, 12).map(id => txById.get(id)).filter(Boolean).sort((a, b) => a.t - b.t);
      for (const t of ukaz) L.push(`     ${t.id}  ${fmtDatum(t.t, t.maCas).padEnd(17)} ${t.ucet.padEnd(18)} ${fmtCastka(t.castka).padStart(14)} ${t.mena}  ${t.uzel}${t.zprava ? '  „' + t.zprava.slice(0, 40) + '“' : ''}`);
      if (n.tx.length > 12) L.push(`     … a dalších ${n.tx.length - 12} transakcí: ${n.tx.slice(12).join(', ')}`);
    });
    const s = sankey(agregujToky(toky(p)), { maxHran: 40 });
    if (s.slouceno.length || s.odebrano.length) {
      L.push('', '5. POZNÁMKY K DIAGRAMU TOKŮ', cara);
      s.slouceno.forEach(x => L.push(`Obousměrný tok ${x.a} ⇄ ${x.b}: tam ${fmtCastka(x.tam)}, zpět ${fmtCastka(x.zpet)} – v diagramu jen čistý tok ${fmtCastka(zaokr(x.tam - x.zpet))}.`));
      s.odebrano.forEach(x => L.push(`Cyklus ${x.cyklus.join(' → ')}: v diagramu vynechána nejslabší hrana ${x.z} → ${x.na} (${fmtCastka(x.castka)}).`));
    }
    L.push('', `${s.slouceno.length || s.odebrano.length ? '6' : '5'}. MEZE A UPOZORNĚNÍ`, cara);
    MEZE.forEach(m => L.push('• ' + m));
    L.push('', 'Výsledky jsou podklad pro další prověřování (vyžádání podkladů od bank, výslech, ověření vysvětlení), ne důkaz samy o sobě.');
    return L.join('\n');
  }

  /* =====================================================================
     UKÁZKY – syntetické případy se ZNÁMOU PRAVDOU.
     Každá ukázka: pravdivé transakce (generované se semínkem) → CSV ve formátu smyšlené banky
     → stejný import jako u uživatele. Pole „pravda“ popisuje, co je do dat záměrně vloženo.
     Všechny osoby, firmy a účty jsou smyšlené (kódy bank 9991–9995 neexistují).
     ===================================================================== */
  const B = { alfa: '9991', beta: '9992', gama: '9993', delta: '9994', omega: '9995' };
  const U = (c, b) => c + '/' + b;
  const d = (r, m, den, h = 0, mi = 0) => Date.UTC(r, m - 1, den, h, mi);
  // mezibankovní převod se připíše jen v pracovní den (víkend, státní svátky ČR 2026) → posun na nejbližší další, čas zůstává
  const SVATKY = new Set(['01-01', '04-03', '04-06', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26']);
  const prac = t => { while ([0, 6].includes(new Date(t).getUTCDay()) || SVATKY.has(isoDen(t).slice(5))) t += DEN; return t; };

  // formáty výpisů smyšlených bank; pravda = co do souboru šlo (počet, součet, účet) – pro ověření importu
  const pravdaVypisu = (ucet, tx) => ({ ucet, pocet: tx.length, soucet: zaokr(tx.reduce((a, t) => a + t.castka, 0)) });
  function fmtCzCislo(x) { const s = Math.abs(x).toFixed(2).replace('.', ','); const [c, des] = s.split(','); return (x < 0 ? '-' : '') + c.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + des; }
  // A: windows-1250, středník, preambule s číslem účtu, datum d.m.yyyy bez času, částka se znaménkem a desetinnou čárkou, protiúčet + kód banky zvlášť, zůstatek
  function vypisAlfa(ucet, nazev, tx, pocatek) {
    const [cislo, banka] = ucet.split('/');
    const r = [`Výpis pohybů na účtu;${cislo}/${banka}`, `Majitel účtu;${nazev}`, `Období;${fmtDatum(tx[0].t)} - ${fmtDatum(tx[tx.length - 1].t)}`, '',
      'Datum zaúčtování;Částka;Měna;Protiúčet;Kód banky;Název protiúčtu;VS;KS;SS;Typ transakce;Zpráva pro příjemce;Zůstatek'];
    let z = pocatek || 0;
    for (const t of tx) {
      z += t.castka;
      const [pc, pb] = (t.protiucet || '').split('/');
      const dt = new Date(t.t);
      r.push([`${dva(dt.getUTCDate())}.${dva(dt.getUTCMonth() + 1)}.${dt.getUTCFullYear()}`, fmtCzCislo(t.castka), 'CZK', pc || '', pb || '', t.protistrana || '', t.vs || '', t.ks || '', '', t.typText || '', t.zprava || '', fmtCzCislo(z)].map(csvBunka).join(';'));
    }
    return { nazev: `alfa_vypis_${cislo}.csv`, bajty: zakoduj1250(r.join('\r\n') + '\r\n'), pravda: pravdaVypisu(ucet, tx) };
  }
  // B: UTF-8 s BOM, čárka, uvozovky, anglická hlavička, ISO datum + čas zvlášť, Credit/Debit, vlastní účet ve sloupci
  function vypisBeta(ucet, tx) {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const r = ['"Date","Time","Account","Counterparty account","Counterparty name","Credit","Debit","Currency","Variable symbol","Constant symbol","Specific symbol","Message","Type"'];
    for (const t of tx) {
      const dt = new Date(t.t);
      r.push([isoDen(t.t), `${dva(dt.getUTCHours())}:${dva(dt.getUTCMinutes())}`, ucet, t.protiucet || '', t.protistrana || '', t.castka > 0 ? t.castka.toFixed(2) : '', t.castka < 0 ? (-t.castka).toFixed(2) : '', 'CZK', t.vs || '', t.ks || '', '', t.zprava || '', t.typEn || ''].map(q).join(','));
    }
    return { nazev: `beta_export_${ucet.split('/')[0]}.csv`, bajty: new TextEncoder().encode('\ufeff' + r.join('\n') + '\n'), pravda: pravdaVypisu(ucet, tx) };
  }
  // C: UTF-8 bez BOM, středník, datum „d. m. yyyy H:MM“, objem s desetinnou čárkou bez mezer, protiúčet jako IBAN, účet jen v názvu souboru
  function vypisGama(ucet, tx) {
    const r = ['Datum;Objem;Měna;IBAN protiúčtu;Protistrana;Variabilní symbol;Poznámka;Druh'];
    const iban = u => { if (!u) return ''; const x = u.match(/^(?:(\d+)-)?(\d+)\/(\d{4})$/); return x ? vytvorIbanCz(x[1] || 0, x[2], x[3]).replace(/(.{4})/g, '$1 ').trim() : u; };
    for (const t of tx) r.push([fmtDatum(t.t, true).replace(/ (\d):/, ' $1:'), t.castka.toFixed(2).replace('.', ','), 'CZK', iban(t.protiucet), t.protistrana || '', t.vs || '', t.zprava || '', t.typText || ''].map(csvBunka).join(';'));
    const [c, b] = ucet.split('/');
    return { nazev: `gama_${c}-${b}.csv`, bajty: new TextEncoder().encode(r.join('\n') + '\n'), pravda: pravdaVypisu(ucet, tx) };
  }
  const tx0 = (t, castka, o = {}) => Object.assign({ t, castka: zaokr(castka) }, o);
  const karta = (t, castka, obchod) => tx0(t, -castka, { protistrana: obchod, typText: 'Platba kartou', typEn: 'Card payment', zprava: 'Platba kartou ' + obchod });
  const atm = (t, castka) => tx0(t, -castka, { protistrana: 'Bankomat', typText: 'Výběr z bankomatu', typEn: 'ATM withdrawal', zprava: 'Výběr hotovosti z bankomatu' });
  const prevod = (t, castka, protiucet, protistrana, zprava, vs) => tx0(t, castka, { protiucet, protistrana, zprava: zprava || '', vs: vs || '', typText: 'Převod', typEn: 'Transfer' });
  const OBCHODY = ['Albert Městec', 'Lékárna U Lva', 'Benzina Dolní Lhota', 'Pekárna Klas', 'Rohlík (smyšlený)', 'Kino Svět', 'Drogerie Mája', 'Trafika Hlavní'];
  const seradit = a => a.sort((x, y) => x.t - y.t);

  // běžné „pozadí“ domácnosti: karta 7–21 h, bankomat
  function karty(r, od, doT, naDen, rozsah) {
    const out = [];
    for (let t = od; t < doT; t += DEN) {
      const n = Math.floor(r() * (naDen * 2 + 0.999));
      for (let i = 0; i < n; i++) out.push(karta(t + (7 + Math.floor(r() * 14)) * HOD + Math.floor(r() * 60) * 60000, zaokr(rozsah[0] + r() * (rozsah[1] - rozsah[0]), 0) + 0.9, OBCHODY[Math.floor(r() * OBCHODY.length)]));
    }
    return out;
  }

  const UKAZKY = {
    mule: {
      nazev: 'Převodní účet (money mule)', ikona: '🐴',
      co: 'Účet studenta s malým pohybem; během 10 dnů na něj pět různých lidí pošle peníze a ty do pár hodin odcházejí v noci na jeden účet, zbytek se vybere v hotovosti.',
      najde: ['⚡ rychlý průtok (5 příchozích plateb)', '🌙 noční odchozí převody', '📈 náhlá změna chování', '🪭 vějíř dovnitř: 5 plátců → 1 příjemce'],
      vytvor() {
        const r = rng(101), MULE = U('1700017011', B.beta), CIL = 'LT947300010000017011';
        const tx = [];
        for (let m = 8; m <= 10; m++) tx.push(prevod(prac(d(2026, m, 1, 9, 5)), 4000, U('1700017019', B.alfa), 'Rodiče (smyšlení)', 'kapesné'));
        tx.push(...karty(r, d(2026, 8, 1), d(2026, 11, 10), 0.6, [80, 650]));
        for (let m = 8; m <= 10; m++) tx.push(atm(d(2026, m, 3, 17, 20), 1000));
        // vloženo: 5 obětí (podvodné inzeráty) → mule → do 6–16 h v noci na jeden zahraniční účet + výběr hotovosti
        const obeti = [[20, 10, 48750, 'J. Horák'], [22, 14, 61200, 'M. Šimková'], [26, 9, 39900, 'P. Beneš'], [21, 16, 72450, 'K. Marková'], [29, 11, 55300, 'V. Kolář']];
        obeti.forEach(([den, h, c, kdo], i) => {
          tx.push(prevod(d(2026, 10, den, h, 12), c, U('17000171' + (20 + i), B.alfa), kdo + ' (smyšlený)', 'platba za zboží z inzerátu', String(2026100 + i)));
          tx.push(prevod(d(2026, 10, den + 1, 2, 10 + i * 7), -zaokr(c * 0.9, 0), CIL, 'Global Fast Trade Ltd (smyšlená)', 'invoice ' + (77 + i)));
          tx.push(atm(d(2026, 10, den + 1, 10, 30), Math.round(c * 0.08 / 100) * 100 + 0));
        });
        return { soubory: [vypisBeta(MULE, seradit(tx))], drzitele: { [MULE]: 'Ondřej Vlk – student (smyšlený)', [CIL]: 'Global Fast Trade Ltd (smyšlená)' } };
      },
      pravda: { ucet: U('1700017011', B.beta), prutok: 5, casy: 5, zmena: true, vejir: { smer: 'dovnitř', strany: 5 }, transakci: null }
    },
    smurfing: {
      nazev: 'Vklady pod limit (smurfing)', ikona: '🧱',
      co: 'Malá obchodní firma: po dvou měsících běžných faktur přijde za 9 dní sedm vkladů hotovosti těsně pod limitem od různých vkladatelů a jeden vklad nad limitem; pak jeden velký převod ven. Výpis v kódování windows-1250 s desetinnou čárkou.',
      najde: ['🧱 dělení pod limit: 7 vkladů v pásmu 90–100 tis. Kč', 'vklad 130 000 Kč nad limitem a bezhotovostní platba 97 500 Kč se nezapočítají'],
      vytvor() {
        const r = rng(202), FIRMA = U('1700017021', B.alfa), tx = [];
        const odberatele = [['1700017022', 'Stavby Lhota s.r.o.'], ['1700017023', 'Domov Plus s.r.o.'], ['1700017024', 'Teplo Servis s.r.o.']];
        for (let i = 0; i < 9; i++) {
          const [c, n] = odberatele[i % 3];
          tx.push(prevod(prac(d(2026, 8, 3 + i * 6)), zaokr(18000 + r() * 70000, 0) + 0.5 + i, U(c, B.gama), n + ' (smyšlená)', 'faktura 2026' + (300 + i), String(2026300 + i)));
          tx.push(prevod(prac(d(2026, 8, 5 + i * 6)), -(zaokr(9000 + r() * 30000, 0) + 0.2), U('1700017029', B.delta), 'Velkoobchod Kovo (smyšlený)', 'dodávka materiálu'));
        }
        tx.push(prevod(d(2026, 9, 29), 97500, U('1700017023', B.gama), 'Domov Plus s.r.o. (smyšlená)', 'faktura 2026390', '2026390'));
        // vloženo: 7 vkladů hotovosti v pásmu 90–100 tis., 1 vklad nad limitem
        const vklady = [[12, 97400, 'J. Novák'], [13, 98900, 'P. Svoboda'], [14, 95700, 'L. Dvořák'], [16, 99300, 'J. Novák'], [17, 96800, 'M. Černý'], [19, 94600, 'P. Svoboda'], [20, 98100, 'L. Dvořák']];
        for (const [den, c, kdo] of vklady) tx.push(tx0(d(2026, 10, den), c, { typText: 'Vklad hotovosti', zprava: 'vklad hotovosti na pobočce – vkladatel ' + kdo }));
        tx.push(tx0(d(2026, 10, 15), 130000, { typText: 'Vklad hotovosti', zprava: 'vklad hotovosti na pobočce – vkladatel M. Černý' }));
        tx.push(prevod(d(2026, 10, 21), -812000, 'SK3112000000198742637541', 'Danube Metals a.s. (smyšlená)', 'záloha na dodávku'));
        return { soubory: [vypisAlfa(FIRMA, 'Kovo-Obchod Lhota s.r.o. (smyšlená)', seradit(tx), 152000)], drzitele: {} };
      },
      pravda: { ucet: U('1700017021', B.alfa), strukturovani: 7 }
    },
    okruh: {
      nazev: 'Okruh přes tři firmy', ikona: '🔄',
      co: 'Peníze vyjdou z firmy Alfa Stav, projdou přes tři firmy a za 8 dní se vrátí zpět (s „poplatky“). Zajištěné jsou jen dva výpisy – Alfa Stav a Gama Consult – a přesto je okruh vidět. Navíc půjčka a splátka mezi oběma firmami (to okruh není).',
      najde: ['🔄 okruh Alfa Stav → Beta Trade → Gama Consult → Delta Services → Alfa Stav', 'půjčka a splátka se spárují jako 2 převody, za okruh se nepovažují'],
      vytvor() {
        const r = rng(303), A = U('1700017031', B.gama), F1 = U('1700017032', B.delta), F2 = U('1700017033', B.gama), F3 = U('1700017034', B.omega);
        const ta = [], tf = [];
        for (let i = 0; i < 12; i++) {
          ta.push(prevod(prac(d(2026, 8, 2 + i * 5, 10)), zaokr(40000 + r() * 260000, 0) + 0.37, U('17000170' + (40 + (i % 4)), B.alfa), ['Obec Horní Lhota', 'Bytové družstvo Lípa', 'Pekárna Klas s.r.o.', 'Statek Lhota a.s.'][i % 4] + ' (smyšlená)', 'faktura 2026' + (500 + i), String(2026500 + i)));
          ta.push(prevod(prac(d(2026, 8, 4 + i * 5, 9)), -(zaokr(20000 + r() * 150000, 0) + 0.81), U('17000170' + (50 + (i % 3)), B.beta), ['Stavebniny Lhota', 'Půjčovna strojů', 'Beton Městec'][i % 3] + ' (smyšlená)', 'materiál'));
          tf.push(prevod(prac(d(2026, 8, 6 + i * 5, 14)), zaokr(15000 + r() * 40000, 0) + 0.15, U('17000170' + (60 + (i % 2)), B.alfa), ['Účetní kancelář Bílá', 'Realitka Lhota'][i % 2] + ' (smyšlená)', 'konzultace'));
        }
        // vloženo: okruh A → F1 → F2 → F3 → A, 3.–11. 9. 2026, každý článek o ~1 % méně
        ta.push(prevod(d(2026, 9, 3, 9, 40), -2480000, F1, 'Beta Trade s.r.o. (smyšlená)', 'faktura BT-2026-118 poradenství', '2026118'));
        tf.push(prevod(d(2026, 9, 7, 11, 5), 2455200, F1, 'Beta Trade s.r.o. (smyšlená)', 'faktura GC-2026-77 analýza trhu', '202677'));
        tf.push(prevod(d(2026, 9, 8, 15, 20), -2430600, F3, 'Delta Services s.r.o. (smyšlená)', 'faktura DS-2026-305 licence', '2026305'));
        ta.push(prevod(d(2026, 9, 11, 10, 0), 2406300, F3, 'Delta Services s.r.o. (smyšlená)', 'vrácení zálohy DS-2026-305', '2026305'));
        // vloženo: půjčka A → F2 a splátka F2 → A (obousměrně, není okruh)
        ta.push(prevod(d(2026, 9, 20, 9, 0), -300000, F2, 'Gama Consult s.r.o. (smyšlená)', 'zápůjčka dle smlouvy 3/2026'));
        tf.push(prevod(d(2026, 9, 20, 9, 30), 300000, A, 'Alfa Stav s.r.o. (smyšlená)', 'zápůjčka dle smlouvy 3/2026'));
        tf.push(prevod(d(2026, 10, 12, 13, 0), -300000, A, 'Alfa Stav s.r.o. (smyšlená)', 'splátka zápůjčky 3/2026'));
        ta.push(prevod(d(2026, 10, 12, 13, 45), 300000, F2, 'Gama Consult s.r.o. (smyšlená)', 'splátka zápůjčky 3/2026'));
        return { soubory: [vypisGama(A, seradit(ta)), vypisGama(F2, seradit(tf))], drzitele: { [A]: 'Alfa Stav s.r.o. (smyšlená)', [F2]: 'Gama Consult s.r.o. (smyšlená)' } };
      },
      pravda: { okruhy: [['1700017031/9993', '1700017032/9994', '1700017033/9993', '1700017034/9995', '1700017031/9993']], pary: 2 }
    },
    vejir: {
      nazev: 'Sběrný účet „investičního klubu“', ikona: '🪭',
      co: 'Dvanáct „investorů“ pošle během 10 dní kulaté částky na účet klubu; 85 % peněz odejde třemi převody na jeden účet. Typický obraz podvodné investice.',
      najde: ['🪭 vějíř dovnitř: 12 plátců → 1 příjemce', '⭕ kulaté částky', '⚡ rychlý průtok'],
      vytvor() {
        const r = rng(404), KLUB = U('1700017041', B.beta), CIL = U('1700017049', B.omega), tx = [];
        tx.push(prevod(d(2026, 9, 1, 10), 5000, U('1700017048', B.alfa), 'Zakladatel klubu (smyšlený)', 'vklad'));
        for (let i = 0; i < 4; i++) tx.push(tx0(d(2026, 9, 5 + i * 7, 9), -(190 + i), { protistrana: 'Banka', typEn: 'Fee', zprava: 'poplatek za vedení účtu' }));
        const vklady = [50000, 100000, 25000, 150000, 50000, 37500, 100000, 75000, 50000, 120000, 42800, 60000];
        vklady.forEach((c, i) => tx.push(prevod(prac(d(2026, 10, 1 + Math.floor(i * 0.8), 8 + (i % 9), 15)), c, U('17000172' + (10 + i), [B.alfa, B.gama, B.delta][i % 3]), `Investor ${i + 1} (smyšlený)`, 'vklad do klubu – smlouva ' + (i + 1))));
        const celkem = vklady.reduce((a, b) => a + b, 0);
        [0.3, 0.3, 0.25].forEach((k, i) => tx.push(prevod(prac(d(2026, 10, 4 + i * 3, 18, 0)), -zaokr(celkem * k, 0), CIL, 'Zlatý důl Holding (smyšlený)', 'převod prostředků')));
        return { soubory: [vypisBeta(KLUB, seradit(tx))], drzitele: { [KLUB]: 'Investiční klub Zlatý důl (smyšlený)' } };
      },
      pravda: { ucet: U('1700017041', B.beta), vejir: { smer: 'dovnitř', strany: 12 }, kulate: true }
    },
    cisty: {
      nazev: 'Běžná domácnost (kontrola planých poplachů)', ikona: '🏠',
      co: 'Půl roku běžného a spořicího účtu jedné domácnosti: výplata, nájem trvalým příkazem, převody na spoření, platby kartou, výběry z bankomatu. Běžný účet je ve dvou výpisech, které se o srpen překrývají. Nástroj by neměl hlásit nic.',
      najde: ['žádná indicie při výchozích prazích', 'duplicity: srpnové transakce z druhého výpisu', 'převody na spořicí účet spárované (6×)'],
      vytvor() {
        const r = rng(505), BEZ = U('1700017051', B.alfa), SPOR = U('1700017052', B.alfa), tb = [], ts = [];
        for (let m = 6; m <= 11; m++) {
          tb.push(prevod(prac(d(2026, m, 12, 6, 0)), 38254 + Math.round(r() * 900) + 0.0, U('1700017059', B.gama), 'Strojírny Lhota a.s. (smyšlené)', 'mzda ' + m + '/2026'));
          tb.push(prevod(prac(d(2026, m, 15, 6, 0)), -15000, U('1700017058', B.delta), 'Pronajímatel J. Malý (smyšlený)', 'nájem ' + m + '/2026', '1515'));
          tb.push(prevod(d(2026, m, 20, 6, 0), -5000, SPOR, 'Spoření', 'spoření'));
          ts.push(prevod(d(2026, m, 20, 6, 0), 5000, BEZ, 'Běžný účet', 'spoření'));
          ts.push(tx0(d(2026, m, 28), zaokr(3 + r() * 4), { typText: 'Úrok', zprava: 'připsaný úrok' }));
          tb.push(prevod(prac(d(2026, m, 25, 6, 0)), -2350, U('1700017057', B.beta), 'Energie Lhota (smyšlená)', 'záloha energie', '880017'));
          tb.push(prevod(prac(d(2026, m, 26, 6, 0)), -649, U('1700017056', B.beta), 'Operátor (smyšlený)', 'telefon'));
          tb.push(atm(d(2026, m, 3 + Math.floor(r() * 20)), [2000, 3000][Math.floor(r() * 2)]));
        }
        tb.push(...karty(r, d(2026, 6, 1), d(2026, 12, 1), 0.8, [60, 1800]));
        seradit(tb); seradit(ts);
        const v1 = tb.filter(t => t.t < d(2026, 9, 1)), v2 = tb.filter(t => t.t >= d(2026, 8, 1));
        const f1 = vypisAlfa(BEZ, 'Jana a Petr Novákovi (smyšlení)', v1, 12400), f2 = vypisAlfa(BEZ, 'Jana a Petr Novákovi (smyšlení)', v2, 12400 + tb.filter(t => t.t < d(2026, 8, 1)).reduce((a, t) => a + t.castka, 0));
        f1.nazev = 'alfa_vypis_1700017051_cerven-srpen.csv'; f2.nazev = 'alfa_vypis_1700017051_srpen-listopad.csv';
        return { soubory: [f1, f2, vypisAlfa(SPOR, 'Jana Nováková – spoření (smyšlené)', ts, 40000)], drzitele: {}, _dupl: tb.filter(t => t.t >= d(2026, 8, 1) && t.t < d(2026, 9, 1)).length };
      },
      pravda: { nalezu: 0, pary: 6, duplicit: 'srpen' }
    },
    pripad17: {
      nazev: 'Modelový případ 17/2026: notebooky přes bazar', ikona: '🗂️',
      co: 'Navazuje na vloupání do prodejny Elektro Novotný (15. 11. 2026). Výpisy tří účtů: bazar R. Kříže, L. Fiala, T. Brabec. Kříž 15. 11. večer vybere z bankomatu 6 000 Kč (záloha hotově při převzetí?), 16. 11. mu přijdou platby za 4 notebooky (75 400 Kč) a týž den pošle Fialovi a Brabcovi po 12 000 Kč – dohromady asi 40 % prodeje. Fiala druhý den vybere hotovost.',
      najde: ['⚡ rychlý průtok na účtu bazaru 16. 11.', '⚡ rychlý průtok u Fialy (výběr hotovosti)', 'převody Kříž → Fiala a Kříž → Brabec spárované napříč třemi bankami', 'u Brabce průtok není (peníze zůstaly)'],
      vytvor(MP) {
        const r = rng(1717);
        const jm = id => { const o = MP && MP.osoby && MP.osoby.find(x => x.id === id); return o ? o.jmeno : { kriz: 'Roman Kříž', fiala: 'Lukáš Fiala', brabec: 'Tomáš Brabec' }[id]; };
        const KRIZ = U('1700017171', B.alfa), FIALA = U('1700017172', B.beta), BRABEC = U('1700017173', B.gama);
        const tk = [], tf = [], tb = [];
        // bazar: drobné platby kupců (do 9 tis.) každé 1–3 dny, nákupy zboží každé 2 týdny z naspořeného
        for (let t = d(2026, 10, 1); t < d(2026, 11, 16); t += DEN * (1 + Math.floor(r() * 3))) tk.push(prevod(prac(t), zaokr(1500 + r() * 7400, 0), U('17000173' + (10 + Math.floor(r() * 40)), B.delta), 'Kupující bazar (smyšlený)', 'platba za zboží', String(26000 + Math.floor(r() * 999))));
        for (const den of [8, 22]) tk.push(prevod(d(2026, 10, den), -(zaokr(25000 + r() * 12000, 0) + 0.4), U('1700017179', B.omega), 'Výkup elektro (smyšlený)', 'nákup zboží'));
        tk.push(prevod(d(2026, 11, 5), -(zaokr(26000 + r() * 8000, 0) + 0.4), U('1700017179', B.omega), 'Výkup elektro (smyšlený)', 'nákup zboží'));
        // vloženo: 15. 11. večer výběr hotovosti (záloha při převzetí), 16. 11. 4 notebooky přes bazar a doplatek převodem Fialovi a Brabcovi
        tk.push(atm(d(2026, 11, 15, 20, 40), 6000));
        [[18900, 'Kupující A (smyšlený)'], [19500, 'Kupující B (smyšlený)'], [17800, 'Kupující C (smyšlený)'], [19200, 'Kupující D (smyšlený)']].forEach(([c, kdo], i) =>
          tk.push(prevod(d(2026, 11, 16), c, U('17000174' + (10 + i), B.delta), kdo, 'notebook z inzerátu', '161126' + i)));
        tk.push(prevod(d(2026, 11, 16), -12000, FIALA, jm('fiala'), 'za zboží'));
        tk.push(prevod(d(2026, 11, 16), -12000, BRABEC, jm('brabec'), 'za zboží'));
        // Fiala: mzda, nájem, karta; 16. 11. 16:42 příchozí od Kříže, 17. 11. ráno výběr 10 000
        tf.push(prevod(prac(d(2026, 10, 10, 6, 0)), 26400, U('1700017178', B.alfa), 'Autoservis Lhota (smyšlený)', 'mzda 9/2026'));
        tf.push(prevod(d(2026, 11, 10, 6, 0), 26400, U('1700017178', B.alfa), 'Autoservis Lhota (smyšlený)', 'mzda 10/2026'));
        for (const m of [10, 11]) tf.push(prevod(prac(d(2026, m, 18, 6, 0)), -11500, U('1700017177', B.gama), 'Bytové družstvo (smyšlené)', 'nájem', '5454'));
        tf.push(...karty(r, d(2026, 10, 1), d(2026, 11, 18), 0.7, [90, 900]));
        tf.push(prevod(d(2026, 11, 16, 16, 42), 12000, KRIZ, jm('kriz'), 'za zboží'));
        tf.push(atm(d(2026, 11, 17, 9, 20), 10000));
        // Brabec: mzda, nájem, karta; 16. 11. příchozí od Kříže, peníze zůstávají
        tb.push(prevod(d(2026, 10, 15, 7, 0), 31200, U('1700017176', B.beta), 'Doprava Lhota s.r.o. (smyšlená)', 'mzda'));
        tb.push(prevod(d(2026, 11, 13, 7, 0), 31200, U('1700017176', B.beta), 'Doprava Lhota s.r.o. (smyšlená)', 'mzda'));
        for (const m of [10, 11]) tb.push(prevod(prac(d(2026, m, 25, 8, 0)), -9800, U('1700017175', B.alfa), 'Pronajímatel (smyšlený)', 'nájem'));
        tb.push(...karty(r, d(2026, 10, 1), d(2026, 11, 18), 0.6, [90, 1200]));
        tb.push(prevod(d(2026, 11, 16, 17, 5), 12000, KRIZ, jm('kriz'), 'za zboží'));
        return {
          soubory: [vypisAlfa(KRIZ, jm('kriz') + ' – bazar (smyšlený)', seradit(tk), 61000), vypisBeta(FIALA, seradit(tf)), vypisGama(BRABEC, seradit(tb))],
          drzitele: { [KRIZ]: jm('kriz') + ' – bazar', [FIALA]: jm('fiala'), [BRABEC]: jm('brabec') }
        };
      },
      pravda: { kriz: U('1700017171', B.alfa), fiala: U('1700017172', B.beta), brabec: U('1700017173', B.gama), prutokDen: '2026-11-16', pary: 2 }
    }
  };

  // sestaví projekt ukázky přes stejný import jako u uživatele (otisky souborů async)
  async function ukazkaProjekt(klic, MP) {
    const u = UKAZKY[klic], data = u.vytvor(MP);
    const p = prazdny('Ukázka: ' + u.nazev);
    p.ukazkaInfo = { klic, nazev: u.nazev, ikona: u.ikona, co: u.co, najde: u.najde };
    for (const s of data.soubory) {
      const pr = pripravImport(s.bajty, s.nazev);
      const { transakce, chyby } = prevedImport(pr);
      const ucet = pr.vlastniUcet || (transakce[0] && transakce[0].ucet) || '';
      pridejZdroj(p, { nazev: s.nazev, soubor: s.nazev, sha256: await sha256Hex(s.bajty), velikost: s.bajty.length, kodovani: pr.kodovani, oddelovac: pr.oddelovac, desetinna: pr.desetinna, mapovani: pr.mapovani, ucet, drzitel: data.drzitele[ucet] || '', chyby: chyby.length }, transakce);
    }
    for (const [u2, n] of Object.entries(data.drzitele)) p.ucty[u2] = { nazev: n };
    p._ukazka = data;
    return prepocitej(p);
  }

  const API = {
    norm, bezDiakritiky, fmtCastka, fmtDatum, isoDen, DEN, HOD, zaokr,
    zakoduj1250, dekoduj, detekujOddelovac, parsujCsv, parsujCislo, detekujDesetinnou, parsujDatum, detekujFormatData,
    normUcet, ucetZTextu, vytvorIbanCz, ibanPlatny, POLE, SYNONYMA, najdiHlavicku, odhadniMapovani, urciTyp, TYPY,
    pripravImport, prevedImport, sha256Hex,
    prazdny, pridejZdroj, pridejRucni, prepocitej, platne, vlastniUcty, popisky, popisUzlu, uzelProti, jePseudo,
    toky, agregujToky, souhrnUctu, souhrnProtistran, zustatky, sankey, rozvrhSankey, rozvrhGrafu,
    DETEKCE, FN, vychoziParametry, parametryDetekce, detekuj, doCsv, doJson, zJson, protokol, MEZE,
    UKAZKY, ukazkaProjekt, vypisAlfa, vypisBeta, vypisGama
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.FINTOKY = API;
})(typeof window !== 'undefined' ? window : globalThis);
