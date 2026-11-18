/* Čtenářský deník – jádro bez DOM (test: _test/ctenarsky_denik_test.js).
   ISBN (kontrola, převod 10↔13), model knihy, police, sezení čtení, statistiky,
   čtenářská výzva, CSV (Goodreads import/export), převod odpovědí Open Library a Google Books. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_ctenarsky_denik';
  const POLICE = [
    { id: 'chci', nazev: '📋 Chci číst' },
    { id: 'ctu', nazev: '📖 Čtu' },
    { id: 'precteno', nazev: '✅ Přečteno' },
    { id: 'odlozeno', nazev: '⏸️ Odloženo' }
  ];
  const POLICE_ID = POLICE.map(p => p.id);
  const FORMATY = ['tištěná', 'e-kniha', 'audiokniha'];
  const SKOLA_POLE = [
    ['autorInfo', 'O autorovi'],
    ['misto', 'Místo a doba děje'],
    ['postavy', 'Hlavní postavy'],
    ['dej', 'Děj (stručně)'],
    ['myslenka', 'Hlavní myšlenka'],
    ['ukazka', 'Zajímavá ukázka / oblíbená pasáž'],
    ['nazor', 'Můj názor a hodnocení']
  ];

  /* ---------- pomocné ---------- */
  const DEN = 86400000;
  function jeDatum(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
    const [r, m, d] = s.split('-').map(Number);
    const t = new Date(Date.UTC(r, m - 1, d));
    return t.getUTCFullYear() === r && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }
  function dnesIso(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const naCas = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  function rozdilDni(a, b) { return Math.round((naCas(b) - naCas(a)) / DEN); }
  function pridejDny(s, n) { return new Date(naCas(s) + n * DEN).toISOString().slice(0, 10); }
  function formatDatum(s) { return jeDatum(s) ? `${+s.slice(8, 10)}. ${+s.slice(5, 7)}. ${s.slice(0, 4)}` : ''; }
  function bezDiakritiky(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function novyId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  const txt = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 300);
  const cislo = (v, min, max) => { const n = Math.round(Number(String(v == null ? '' : v).replace(',', '.'))); return Number.isFinite(n) && n >= min ? Math.min(n, max) : 0; };
  const seznam = (v, max) => [...new Set((Array.isArray(v) ? v : String(v || '').split(/[,;]/)).map(x => txt(x, 60)).filter(Boolean))].slice(0, max || 30);

  /* ---------- ISBN ---------- */
  function cistIsbn(s) { return String(s || '').toUpperCase().replace(/[^0-9X]/g, ''); }
  function kontrola10(prvnich9) {
    let s = 0;
    for (let i = 0; i < 9; i++) s += (10 - i) * +prvnich9[i];
    const c = (11 - s % 11) % 11;
    return c === 10 ? 'X' : String(c);
  }
  function kontrola13(prvnich12) {
    let s = 0;
    for (let i = 0; i < 12; i++) s += +prvnich12[i] * (i % 2 ? 3 : 1);
    return String((10 - s % 10) % 10);
  }
  function isbn10Platne(s) { return /^\d{9}[\dX]$/.test(s) && kontrola10(s) === s[9]; }
  function isbn13Platne(s) { return /^97[89]\d{10}$/.test(s) && kontrola13(s) === s[12]; }
  function eanPlatny(s) { return /^\d{13}$/.test(s) && kontrola13(s) === s[12]; }
  function isbn10na13(s) { const z = '978' + s.slice(0, 9); return z + kontrola13(z); }
  function isbn13na10(s) { if (!s.startsWith('978')) return ''; const z = s.slice(3, 12); return z + kontrola10(z); }
  /* libovolný zápis → { isbn13, isbn10, chyba } (isbn13 prázdné = neplatné) */
  function rozborIsbn(vstup) {
    const s = cistIsbn(vstup);
    if (!s) return { isbn13: '', isbn10: '', chyba: 'prázdné' };
    if (s.length === 10) {
      if (!isbn10Platne(s)) return { isbn13: '', isbn10: '', chyba: 'ISBN-10 má chybnou kontrolní číslici (správně ' + kontrola10(s) + ')' };
      return { isbn13: isbn10na13(s), isbn10: s, chyba: '' };
    }
    if (s.length === 13) {
      if (!/^97[89]/.test(s)) return { isbn13: '', isbn10: '', chyba: eanPlatny(s) ? 'tohle je čárový kód zboží (EAN), ne ISBN knihy – ISBN začíná 978 nebo 979' : 'není ISBN (musí začínat 978 nebo 979)' };
      if (!isbn13Platne(s)) return { isbn13: '', isbn10: '', chyba: 'ISBN-13 má chybnou kontrolní číslici (správně ' + kontrola13(s) + ')' };
      return { isbn13: s, isbn10: isbn13na10(s), chyba: '' };
    }
    return { isbn13: '', isbn10: '', chyba: 'ISBN má 10 nebo 13 znaků (zadáno ' + s.length + ')' };
  }

  /* ---------- model ---------- */
  function normSezeni(s) {
    if (!s || !jeDatum(s.datum)) return null;
    return { id: txt(s.id, 20) || novyId(), datum: s.datum, od: cislo(s.od, 0, 99999), do: cislo(s.do, 0, 99999), minut: cislo(s.minut, 0, 1440) };
  }
  function normCitat(c) {
    if (!c || !txt(c.text, 4000)) return null;
    return { id: txt(c.id, 20) || novyId(), text: txt(c.text, 4000), strana: cislo(c.strana, 0, 99999), pozn: txt(c.pozn, 1000), datum: jeDatum(c.datum) ? c.datum : '' };
  }
  function normKniha(k) {
    k = k || {};
    const isbn = rozborIsbn(k.isbn).isbn13 || cistIsbn(k.isbn).slice(0, 13);
    const skola = {};
    for (const [id] of SKOLA_POLE) skola[id] = txt(k.skola && k.skola[id], 6000);
    const sez = (Array.isArray(k.sezeni) ? k.sezeni : []).map(normSezeni).filter(Boolean).sort((a, b) => a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.do - b.do);
    const stran = cislo(k.stran, 0, 99999);
    return {
      id: txt(k.id, 30) || novyId(),
      isbn,
      titul: txt(k.titul, 300) || 'Bez názvu',
      podtitul: txt(k.podtitul, 300),
      autori: seznam(k.autori, 10),
      serie: txt(k.serie, 120),
      serieCislo: txt(k.serieCislo, 10),
      rok: cislo(k.rok, 0, 3000) || '',
      nakladatel: txt(k.nakladatel, 120),
      stran,
      jazyk: txt(k.jazyk, 20),
      format: FORMATY.includes(k.format) ? k.format : FORMATY[0],
      zanry: seznam(k.zanry, 12),
      stitky: seznam(k.stitky, 20),
      police: POLICE_ID.includes(k.police) ? k.police : 'chci',
      hodnoceni: cislo(k.hodnoceni, 0, 5),
      strana: Math.min(cislo(k.strana, 0, 99999), stran || 99999),
      zacatek: jeDatum(k.zacatek) ? k.zacatek : '',
      konec: jeDatum(k.konec) ? k.konec : '',
      sezeni: sez,
      poznamky: txt(k.poznamky, 20000),
      citaty: (Array.isArray(k.citaty) ? k.citaty : []).map(normCitat).filter(Boolean),
      pujceno: k.pujceno && txt(k.pujceno.komu, 80) ? { komu: txt(k.pujceno.komu, 80), od: jeDatum(k.pujceno.od) ? k.pujceno.od : '' } : null,
      skola,
      zdroj: ['openlibrary', 'google', 'goodreads', 'rucne'].includes(k.zdroj) ? k.zdroj : 'rucne',
      olKey: txt(k.olKey, 60),
      obalka: !!k.obalka,
      pridano: jeDatum(k.pridano) ? k.pridano : dnesIso()
    };
  }

  function procento(k) {
    if (k.police === 'precteno') return 100;
    if (!k.stran) return 0;
    return Math.min(100, Math.round(k.strana / k.stran * 100));
  }
  /* přesun na polici doplní data začátku/konce */
  function naPolici(k, police, datum) {
    if (!POLICE_ID.includes(police)) return k;
    k.police = police;
    if (police === 'ctu' && !k.zacatek) k.zacatek = datum;
    if (police === 'precteno') {
      if (!k.konec) k.konec = datum;
      if (!k.zacatek) k.zacatek = k.konec;
      if (k.stran) k.strana = k.stran;
    }
    if (police === 'chci') k.konec = '';
    return k;
  }
  /* zápis sezení: nová strana (kam jsem dočetl). Vrací true, když je dočteno. */
  function pridejSezeni(k, s) {
    const datum = jeDatum(s.datum) ? s.datum : dnesIso();
    const doStr = Math.min(cislo(s.strana, 0, 99999), k.stran || 99999);
    k.sezeni.push({ id: novyId(), datum, od: k.strana, do: doStr, minut: cislo(s.minut, 0, 1440) });
    k.strana = doStr;
    if (k.police === 'chci' || k.police === 'odlozeno') k.police = 'ctu';
    if (!k.zacatek || k.zacatek > datum) k.zacatek = datum;
    if (k.stran && doStr >= k.stran) { naPolici(k, 'precteno', datum); k.konec = datum; return true; }
    return false;
  }
  function smazSezeni(k, id) {
    k.sezeni = k.sezeni.filter(s => s.id !== id);
    const posl = k.sezeni[k.sezeni.length - 1];
    k.strana = posl ? posl.do : 0;
  }
  /* strana nebo procento → strana */
  function stranaZProcent(k, proc) { return k.stran ? Math.round(k.stran * Math.min(100, Math.max(0, proc)) / 100) : 0; }
  const precteneStrany = s => Math.max(0, s.do - s.od);

  /* tempo (stran/den) z posledních `dni` dní sezení */
  function tempo(knihy, dnes, dni) {
    dni = dni || 30;
    const od = pridejDny(dnes, -dni + 1);
    let str = 0;
    for (const k of knihy) for (const s of k.sezeni) if (s.datum >= od && s.datum <= dnes) str += precteneStrany(s);
    return str / dni;
  }
  /* odhad dočtení rozečtené knihy: tempo knihy od začátku, jinak celkové */
  function odhadDocteni(k, dnes, tempoCelkem) {
    if (!k.stran || k.police === 'precteno' || k.strana >= k.stran) return null;
    const zbyva = k.stran - k.strana;
    let t = 0;
    if (k.zacatek && k.strana > 0) t = k.strana / Math.max(1, rozdilDni(k.zacatek, dnes) + 1);
    if (!t) t = tempoCelkem || 0;
    if (!t) return null;
    const dni = Math.ceil(zbyva / t);
    return { zbyva, tempo: t, dni, datum: pridejDny(dnes, dni) };
  }

  /* ---------- statistiky ---------- */
  function precteneVRoce(knihy, rok) {
    return knihy.filter(k => k.police === 'precteno' && (!rok || (k.konec && +k.konec.slice(0, 4) === rok)));
  }
  function top(pocty, n) {
    return Object.entries(pocty).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'cs')).slice(0, n || 10).map(([nazev, pocet]) => ({ nazev, pocet }));
  }
  function statistiky(knihy, rok, dnes) {
    const prec = precteneVRoce(knihy, rok);
    const mesice = Array.from({ length: 12 }, () => ({ knihy: 0, stranyKnih: 0, stranySezeni: 0 }));
    for (const k of prec) if (k.konec) { const m = mesice[+k.konec.slice(5, 7) - 1]; m.knihy++; m.stranyKnih += k.stran; }
    for (const k of knihy) for (const s of k.sezeni) if (!rok || +s.datum.slice(0, 4) === rok) mesice[+s.datum.slice(5, 7) - 1].stranySezeni += precteneStrany(s);
    const zanry = {}, autori = {};
    for (const k of prec) {
      for (const z of k.zanry) zanry[z] = (zanry[z] || 0) + 1;
      for (const a of k.autori) autori[a] = (autori[a] || 0) + 1;
    }
    const hodn = prec.filter(k => k.hodnoceni);
    const delky = prec.filter(k => k.zacatek && k.konec).map(k => rozdilDni(k.zacatek, k.konec) + 1);
    const sStranami = prec.filter(k => k.stran);
    const roky = [...new Set(knihy.flatMap(k => [k.konec, ...k.sezeni.map(s => s.datum)]).filter(Boolean).map(d => +d.slice(0, 4)))].sort((a, b) => b - a);
    return {
      knih: prec.length,
      stran: prec.reduce((a, k) => a + k.stran, 0),
      stranSezeni: mesice.reduce((a, m) => a + m.stranySezeni, 0),
      mesice,
      zanry: top(zanry, 10),
      autori: top(autori, 10),
      prumerHodnoceni: hodn.length ? hodn.reduce((a, k) => a + k.hodnoceni, 0) / hodn.length : 0,
      prumerDni: delky.length ? delky.reduce((a, b) => a + b, 0) / delky.length : 0,
      prumerStran: sStranami.length ? sStranami.reduce((a, k) => a + k.stran, 0) / sStranami.length : 0,
      nejdelsi: sStranami.slice().sort((a, b) => b.stran - a.stran)[0] || null,
      tempo30: tempo(knihy, dnes, 30),
      hodnoceni: [1, 2, 3, 4, 5].map(h => prec.filter(k => k.hodnoceni === h).length),
      roky
    };
  }
  /* čtenářská výzva: cíl knih/stran za rok, porovnání s plánem k dnešku */
  function vyzva(knihy, cil, rok, dnes) {
    const prec = precteneVRoce(knihy, rok);
    const delkaRoku = rozdilDni(rok + '-01-01', (rok + 1) + '-01-01');
    let podil = 1;
    if (+dnes.slice(0, 4) === rok) podil = (rozdilDni(rok + '-01-01', dnes) + 1) / delkaRoku;
    else if (+dnes.slice(0, 4) < rok) podil = 0;
    const knih = prec.length, stran = prec.reduce((a, k) => a + k.stran, 0);
    const cilKnih = cislo(cil && cil.knih, 0, 10000), cilStran = cislo(cil && cil.stran, 0, 10000000);
    return {
      knih, stran, cilKnih, cilStran,
      planKnih: cilKnih * podil, planStran: cilStran * podil,
      naskokKnih: cilKnih ? Math.round((knih - cilKnih * podil) * 10) / 10 : 0,
      procentoKnih: cilKnih ? Math.min(100, Math.round(knih / cilKnih * 100)) : 0,
      procentoStran: cilStran ? Math.min(100, Math.round(stran / cilStran * 100)) : 0
    };
  }

  /* ---------- hledání, řazení ---------- */
  function filtruj(knihy, f) {
    f = f || {};
    const q = bezDiakritiky(f.text).trim();
    return knihy.filter(k => {
      if (f.police === 'pujceno') { if (!k.pujceno) return false; }
      else if (f.police && k.police !== f.police) return false;
      if (f.stitek && !k.stitky.includes(f.stitek) && !k.zanry.includes(f.stitek) && k.serie !== f.stitek) return false;
      if (!q) return true;
      return bezDiakritiky([k.titul, k.podtitul, k.autori.join(' '), k.serie, k.isbn, k.stitky.join(' '), k.zanry.join(' '), k.nakladatel].join(' ')).includes(q);
    });
  }
  const PORADI = { pridano: 'naposledy přidané', titul: 'název', autor: 'autor', hodnoceni: 'hodnocení', konec: 'datum dočtení', prubeh: 'průběh', serie: 'série' };
  function serad(knihy, podle) {
    const cs = (a, b) => String(a).localeCompare(String(b), 'cs');
    const r = knihy.slice();
    const f = {
      titul: (a, b) => cs(a.titul, b.titul),
      autor: (a, b) => cs(prijmeni(a.autori[0] || '~'), prijmeni(b.autori[0] || '~')) || cs(a.titul, b.titul),
      hodnoceni: (a, b) => b.hodnoceni - a.hodnoceni || cs(a.titul, b.titul),
      konec: (a, b) => cs(b.konec || '', a.konec || ''),
      prubeh: (a, b) => procento(b) - procento(a),
      serie: (a, b) => cs(a.serie || '~', b.serie || '~') || (parseFloat(a.serieCislo) || 0) - (parseFloat(b.serieCislo) || 0)
    }[podle] || ((a, b) => cs(b.pridano, a.pridano) || cs(b.id, a.id));
    return r.sort(f);
  }
  function prijmeni(jmeno) { const c = String(jmeno).trim().split(/\s+/); return c[c.length - 1] + ' ' + c.slice(0, -1).join(' '); }
  function vsechnyStitky(knihy) {
    const s = new Set(), z = new Set(), se = new Set();
    for (const k of knihy) { k.stitky.forEach(x => s.add(x)); k.zanry.forEach(x => z.add(x)); if (k.serie) se.add(k.serie); }
    const cs = (a, b) => a.localeCompare(b, 'cs');
    return { stitky: [...s].sort(cs), zanry: [...z].sort(cs), serie: [...se].sort(cs) };
  }
  function najdiDuplikat(knihy, k) {
    const klic = x => bezDiakritiky(x.titul).replace(/[^a-z0-9]/g, '') + '|' + bezDiakritiky(x.autori[0] || '').replace(/[^a-z]/g, '');
    return knihy.find(x => x.id !== k.id && ((k.isbn && x.isbn === k.isbn) || klic(x) === klic(k))) || null;
  }

  /* ---------- CSV ---------- */
  function parsujCsv(text) {
    const radky = []; let radek = [], pole = '', uvoz = false;
    text = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (uvoz) {
        if (c === '"') { if (text[i + 1] === '"') { pole += '"'; i++; } else uvoz = false; }
        else pole += c;
      } else if (c === '"') uvoz = true;
      else if (c === ',') { radek.push(pole); pole = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        radek.push(pole); pole = '';
        if (radek.length > 1 || radek[0] !== '') radky.push(radek);
        radek = [];
      } else pole += c;
    }
    radek.push(pole);
    if (radek.length > 1 || radek[0] !== '') radky.push(radek);
    return radky;
  }
  function naCsv(radky) {
    return '\uFEFF' + radky.map(r => r.map(v => {
      const s = String(v == null ? '' : v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n') + '\r\n';
  }
  const GR_POLICE = { read: 'precteno', 'currently-reading': 'ctu', 'to-read': 'chci' };
  const NA_GR = { precteno: 'read', ctu: 'currently-reading', chci: 'to-read', odlozeno: 'did-not-finish' };
  const grDatum = s => { const m = String(s || '').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; };
  /* Goodreads export (i náš vlastní CSV) → pole knih */
  function zGoodreads(text) {
    const r = parsujCsv(text);
    if (r.length < 2) return [];
    const hl = r[0].map(h => h.trim().toLowerCase());
    const sl = n => hl.indexOf(n.toLowerCase());
    if (sl('title') < 0) throw new Error('V CSV chybí sloupec Title – je to export z Goodreads?');
    const knihy = [];
    for (const row of r.slice(1)) {
      const v = n => { const i = sl(n); return i >= 0 && row[i] != null ? String(row[i]).trim() : ''; };
      let titul = v('Title');
      if (!titul) continue;
      let serie = v('Series'), serieCislo = v('Series Number');
      const m = titul.match(/^(.*?)\s*\(([^()]+?),?\s*#(\d+(?:\.\d+)?)\)\s*$/);
      if (m) { titul = m[1]; if (!serie) { serie = m[2]; serieCislo = m[3]; } }
      const pol = v('Exclusive Shelf').toLowerCase();
      const police = GR_POLICE[pol] || (/dnf|did-not|abandon|odlo|paus/.test(pol) ? 'odlozeno' : 'chci');
      const exkl = new Set([pol, 'read', 'currently-reading', 'to-read']);
      const stitky = seznam(v('Bookshelves'), 30).filter(s => !exkl.has(s.toLowerCase())).concat(seznam(v('Tags'), 30));
      const vazba = v('Binding').toLowerCase();
      const konec = grDatum(v('Date Read'));
      const k = normKniha({
        titul, serie, serieCislo,
        autori: [v('Author')].concat(seznam(v('Additional Authors'))),
        isbn: cistIsbn(v('ISBN13')) || cistIsbn(v('ISBN')),
        hodnoceni: v('My Rating'), nakladatel: v('Publisher'), stran: v('Number of Pages'),
        rok: v('Original Publication Year') || v('Year Published'),
        format: /kindle|ebook|e-kniha|digital/.test(vazba) ? 'e-kniha' : /audio/.test(vazba) ? 'audiokniha' : 'tištěná',
        police, konec, zacatek: grDatum(v('Started')) || (police === 'precteno' ? konec : ''),
        pridano: grDatum(v('Date Added')),
        strana: v('Current Page'),
        stitky, zanry: seznam(v('Genres')),
        poznamky: [v('My Review').replace(/<br\s*\/?>/gi, '\n'), v('Private Notes')].filter(Boolean).join('\n\n'),
        pujceno: v('Loaned To') ? { komu: v('Loaned To') } : null,
        zdroj: 'goodreads'
      });
      if (k.police === 'precteno' && k.stran) k.strana = k.stran;
      knihy.push(k);
    }
    return knihy;
  }
  /* export v rozložení Goodreads + vlastní sloupce (jde importovat zpět i do Goodreads) */
  function doCsv(knihy) {
    const hl = ['Title', 'Author', 'Additional Authors', 'ISBN', 'ISBN13', 'My Rating', 'Publisher', 'Binding', 'Number of Pages', 'Year Published',
      'Date Read', 'Date Added', 'Bookshelves', 'Exclusive Shelf', 'My Review', 'Series', 'Series Number', 'Genres', 'Tags', 'Started', 'Current Page', 'Loaned To', 'Quotes'];
    const gd = s => s ? s.replace(/-/g, '/') : '';
    const BINDING = { 'tištěná': 'Paperback', 'e-kniha': 'Kindle Edition', audiokniha: 'Audiobook' };
    return naCsv([hl].concat(knihy.map(k => [
      k.titul, k.autori[0] || '', k.autori.slice(1).join(', '), k.isbn ? isbn13na10(k.isbn) : '', k.isbn, k.hodnoceni || 0, k.nakladatel, BINDING[k.format],
      k.stran || '', k.rok, gd(k.konec), gd(k.pridano), [NA_GR[k.police]].concat(k.stitky).join(', '), NA_GR[k.police], k.poznamky,
      k.serie, k.serieCislo, k.zanry.join(', '), k.stitky.join(', '), gd(k.zacatek), k.strana || '', k.pujceno ? k.pujceno.komu : '',
      k.citaty.map(c => c.text + (c.strana ? ` (s. ${c.strana})` : '')).join(' | ')
    ])));
  }

  /* ---------- online zdroje ---------- */
  const OL = 'https://openlibrary.org';
  const urlOLIsbn = isbn => `${OL}/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const urlOLHledej = (q, n) => `${OL}/search.json?q=${encodeURIComponent(q)}&limit=${n || 20}&fields=key,title,subtitle,author_name,first_publish_year,isbn,cover_i,number_of_pages_median,language,subject,publisher`;
  const urlOLObalka = id => `https://covers.openlibrary.org/b/id/${id}-M.jpg`;
  const urlGoogle = isbn => `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
  const rokZ = s => { const m = String(s || '').match(/\b(1[0-9]{3}|20[0-9]{2})\b/); return m ? +m[1] : ''; };
  const JUNK = /staff picks|accessible book|protected daisy|in library|lending library|nyt:|new york times|award|^fiction$|^general$|large type|reading level|open_syllabus/i;
  const predmety = (a, n) => (a || []).map(x => typeof x === 'string' ? x : x && x.name).filter(x => x && x.length < 40 && !JUNK.test(x)).slice(0, n || 3);
  const obalkaId = url => { const m = String(url || '').match(/\/b\/id\/(\d+)/); return m ? +m[1] : 0; };
  /* api/books?jscmd=data → návrh knihy (+ coverId) nebo null */
  function zOpenLibrary(json, isbn) {
    const d = json && (json['ISBN:' + isbn] || Object.values(json)[0]);
    if (!d || !d.title) return null;
    return {
      kniha: normKniha({
        isbn, titul: d.title, podtitul: d.subtitle, autori: (d.authors || []).map(a => a.name),
        stran: d.number_of_pages, nakladatel: d.publishers && d.publishers[0] && d.publishers[0].name,
        rok: rokZ(d.publish_date), zanry: predmety(d.subjects), zdroj: 'openlibrary', olKey: d.key
      }),
      coverId: obalkaId(d.cover && (d.cover.medium || d.cover.large || d.cover.small))
    };
  }
  /* search.json → výsledky hledání */
  function zOpenLibraryHledani(json) {
    return ((json && json.docs) || []).filter(d => d.title).map(d => {
      const isbny = (d.isbn || []).map(cistIsbn);
      const isbn = isbny.find(isbn13Platne) || (isbny.find(isbn10Platne) ? isbn10na13(isbny.find(isbn10Platne)) : '');
      return {
        kniha: normKniha({
          isbn, titul: d.title, podtitul: d.subtitle, autori: d.author_name, rok: d.first_publish_year, stran: d.number_of_pages_median,
          jazyk: (d.language || []).slice(0, 2).join(', '), nakladatel: d.publisher && d.publisher[0], zanry: predmety(d.subject), zdroj: 'openlibrary', olKey: d.key
        }),
        coverId: d.cover_i || 0
      };
    });
  }
  function zGoogleBooks(json, isbn) {
    const it = json && json.items && json.items[0];
    const v = it && it.volumeInfo;
    if (!v || !v.title) return null;
    const ids = v.industryIdentifiers || [];
    const i13 = (ids.find(x => x.type === 'ISBN_13') || {}).identifier;
    const obr = v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail);
    return {
      kniha: normKniha({
        isbn: i13 || isbn, titul: v.title, podtitul: v.subtitle, autori: v.authors, rok: rokZ(v.publishedDate), nakladatel: v.publisher,
        stran: v.pageCount, jazyk: v.language, zanry: (v.categories || []).slice(0, 3), zdroj: 'google'
      }),
      obalkaUrl: obr ? String(obr).replace(/^http:/, 'https:') : ''
    };
  }

  /* ---------- záloha ---------- */
  function zeZalohy(d) {
    if (!d || !Array.isArray(d.knihy)) throw new Error('Tohle není záloha Čtenářského deníku.');
    return { knihy: d.knihy.map(normKniha), vyzvy: d.vyzvy && typeof d.vyzvy === 'object' ? d.vyzvy : {}, obalky: d.obalky && typeof d.obalky === 'object' ? d.obalky : {} };
  }

  const api = {
    VERZE, KLIC, POLICE, FORMATY, SKOLA_POLE, PORADI,
    jeDatum, dnesIso, rozdilDni, pridejDny, formatDatum, bezDiakritiky, novyId,
    cistIsbn, kontrola10, kontrola13, isbn10Platne, isbn13Platne, eanPlatny, isbn10na13, isbn13na10, rozborIsbn,
    normKniha, normCitat, procento, naPolici, pridejSezeni, smazSezeni, stranaZProcent, precteneStrany,
    tempo, odhadDocteni, statistiky, vyzva, precteneVRoce,
    filtruj, serad, vsechnyStitky, najdiDuplikat,
    parsujCsv, naCsv, zGoodreads, doCsv,
    urlOLIsbn, urlOLHledej, urlOLObalka, urlGoogle, zOpenLibrary, zOpenLibraryHledani, zGoogleBooks,
    zeZalohy
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.CtenarJadro = api;
})();
