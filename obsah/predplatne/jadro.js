/* Správce předplatných – jádro bez DOM (test: _test/predplatne_test.js).
   Datumové a textové pomůcky bere z jádra Evidence majetku (majetek/jadro.js): pridejMesice drží den v měsíci
   (31. 1. + 1 měsíc = 28./29. 2.), takže série obnov se počítá vždy od kotvy (začátek), ne řetězením. */
(function () {
  'use strict';
  const M = typeof module !== 'undefined' ? require('../majetek/jadro.js') : window.MajetekJadro;

  const VERZE = 1;
  const KLIC = 'webapp_predplatne';

  /* Orientační kurzy ČNB k 9. 11. 2026 – uživatel si je přepíše v nastavení. Ročně zkontrolovat. */
  const PARAMETRY = { rok: 2026, kurzy: { EUR: 24.36, USD: 21.76 } };
  const MENY = ['CZK', 'EUR', 'USD'];

  const KATEGORIE = [
    { id: 'streaming', nazev: '🎬 Streaming' },
    { id: 'software', nazev: '💻 Software a aplikace' },
    { id: 'pojisteni', nazev: '🛡️ Pojištění' },
    { id: 'telefon', nazev: '📱 Telefon a internet' },
    { id: 'domeny', nazev: '🌐 Domény a hosting' },
    { id: 'clenstvi', nazev: '🏋️ Členství a sport' },
    { id: 'media', nazev: '📰 Média a noviny' },
    { id: 'jine', nazev: '📦 Jiné' }
  ];
  const KAT = Object.fromEntries(KATEGORIE.map(k => [k.id, k]));
  const STAVY = { aktivni: '✅ Aktivní', pozastaveno: '⏸️ Pozastavené', zruseno: '🚫 Zrušené' };
  const ZPUSOBY = { karta: 'Platební karta', inkaso: 'Inkaso (SIPO, SEPA)', prevod: 'Bankovní převod', paypal: 'PayPal / Apple / Google', hotove: 'Hotově', jine: 'Jinak' };
  /* Interval: { n, j } – j = 't' týdny, 'm' měsíce. Předvolby pro výběr v dialogu. */
  const INTERVALY = [
    { id: 'tydne', nazev: 'týdně', n: 1, j: 't' },
    { id: 'mesicne', nazev: 'měsíčně', n: 1, j: 'm' },
    { id: 'ctvrtletne', nazev: 'čtvrtletně', n: 3, j: 'm' },
    { id: 'pulrocne', nazev: 'půlročně', n: 6, j: 'm' },
    { id: 'rocne', nazev: 'ročně', n: 12, j: 'm' },
    { id: 'vlastni', nazev: 'vlastní (N měsíců)', n: 0, j: 'm' }
  ];
  const TYDNU_V_ROCE = 365.25 / 7;

  /* ---------- normalizace ---------- */
  const txt = (v, max) => String(v == null ? '' : v).slice(0, max);
  function normInterval(i) {
    const n = Math.round(Number(i && i.n));
    const j = i && i.j === 't' ? 't' : 'm';
    return { n: n > 0 ? Math.min(n, 120) : 1, j };
  }
  function normCena(v) {
    const n = M.cislo ? M.cislo(v) : Number(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
  }
  function normPolozka(p) {
    p = p || {};
    return {
      id: String(p.id || M.novyId('P')),
      nazev: txt(p.nazev, 120).trim() || 'Bez názvu',
      kategorie: KAT[p.kategorie] ? p.kategorie : 'jine',
      cena: normCena(p.cena),
      mena: MENY.includes(p.mena) ? p.mena : 'CZK',
      interval: normInterval(p.interval),
      zacatek: M.jeDatum(p.zacatek) ? p.zacatek : '',
      priste: M.jeDatum(p.priste) ? p.priste : '',
      zpusob: ZPUSOBY[p.zpusob] ? p.zpusob : 'karta',
      osoba: txt(p.osoba, 80).trim(),
      stav: STAVY[p.stav] ? p.stav : 'aktivni',
      zkusebniDo: M.jeDatum(p.zkusebniDo) ? p.zkusebniDo : '',
      predem: Number.isFinite(+p.predem) && p.predem !== '' && p.predem != null && +p.predem >= 0 ? Math.min(Math.round(+p.predem), 90) : 3,
      odkaz: /^https?:\/\//i.test(txt(p.odkaz, 500).trim()) ? txt(p.odkaz, 500).trim() : '',
      poznamka: txt(p.poznamka, 2000)
    };
  }
  function normZaznam(z) {
    z = z || {};
    return {
      id: String(z.id || M.novyId('Z')),
      polozka: String(z.polozka || ''),
      datum: M.jeDatum(z.datum) ? z.datum : '',
      castka: normCena(z.castka),
      mena: MENY.includes(z.mena) ? z.mena : 'CZK',
      czk: Number.isFinite(+z.czk) ? Math.round(+z.czk * 100) / 100 : 0,
      pozn: txt(z.pozn, 500)
    };
  }
  function normKurzy(k) {
    const out = {};
    for (const m of MENY) {
      if (m === 'CZK') continue;
      const v = Number(k && String(k[m]).replace(',', '.'));
      out[m] = Number.isFinite(v) && v > 0 ? Math.round(v * 1000) / 1000 : PARAMETRY.kurzy[m];
    }
    return out;
  }
  function prazdna() { return { verze: VERZE, kurzy: normKurzy(), polozky: [], historie: [] }; }
  function migruj(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.polozky)) return prazdna();
    const polozky = d.polozky.map(normPolozka);
    const ids = new Set(polozky.map(p => p.id));
    const historie = (Array.isArray(d.historie) ? d.historie : []).map(normZaznam).filter(h => h.datum && ids.has(h.polozka));
    return { verze: VERZE, kurzy: normKurzy(d.kurzy), polozky, historie };
  }

  /* ---------- peníze ---------- */
  function vCzk(castka, mena, kurzy) {
    const k = mena === 'CZK' ? 1 : (kurzy && kurzy[mena]) || PARAMETRY.kurzy[mena] || 1;
    return Math.round(castka * k * 100) / 100;
  }
  /* roční náklad položky v CZK bez ohledu na stav */
  function rocne(p, kurzy) {
    const i = p.interval, za = i.j === 't' ? TYDNU_V_ROCE / i.n : 12 / i.n;
    return Math.round(vCzk(p.cena, p.mena, kurzy) * za * 100) / 100;
  }
  function mesicne(p, kurzy) { return Math.round(rocne(p, kurzy) / 12 * 100) / 100; }
  function popisIntervalu(i) {
    if (i.j === 't') return i.n === 1 ? 'týdně' : 'každé ' + i.n + ' týdny';
    const p = INTERVALY.find(x => x.j === 'm' && x.n === i.n && x.id !== 'vlastni');
    return p ? p.nazev : 'každých ' + i.n + ' měsíců';
  }

  /* ---------- termíny ---------- */
  function vyskyt(kotva, i, k) { return i.j === 't' ? M.pridejDny(kotva, 7 * i.n * k) : M.pridejMesice(kotva, i.n * k); }
  /* první výskyt série (kotva + k·interval, k ≥ 0), který je ≥ datum (ostre: > datum) */
  function prvniOd(kotva, i, datum, ostre) {
    let k;
    if (i.j === 't') k = Math.floor(M.rozdilDni(kotva, datum) / (7 * i.n)) - 1;
    else { const [r1, m1] = kotva.split('-').map(Number), [r2, m2] = datum.split('-').map(Number); k = Math.floor((r2 * 12 + m2 - (r1 * 12 + m1)) / i.n) - 2; }
    k = Math.max(0, k);
    for (let n = 0; n < 1000; n++, k++) {
      const d = vyskyt(kotva, i, k);
      if (ostre ? d > datum : d >= datum) return d;
    }
    return null;
  }
  /* Příští obnovení k danému dni: ručně zadané `priste`, pokud ještě nenastalo; jinak se dopočítá ze série
     od začátku (nebo od prošlého `priste`). Pozastavené a zrušené nemají obnovu. */
  function pristiObnova(p, dnes) {
    if (p.stav !== 'aktivni') return null;
    if (p.priste && p.priste >= dnes) return p.priste;
    const kotva = p.zacatek || p.priste;
    return kotva ? prvniOd(kotva, p.interval, dnes, false) : null;
  }
  /* další obnovení po daném termínu (série od začátku, jinak termín + interval) */
  function dalsiObnova(p, termin) {
    return p.zacatek ? prvniOd(p.zacatek, p.interval, termin, true) : vyskyt(termin, p.interval, 1);
  }
  /* všechna obnovení v období <od, do> – [{ p, datum, czk }] seřazená podle data */
  function obnovyVObdobi(polozky, od, do_, kurzy) {
    const out = [];
    for (const p of polozky) {
      let d = pristiObnova(p, od);
      for (let n = 0; d && d <= do_ && n < 400; n++) {
        out.push({ p, datum: d, czk: vCzk(p.cena, p.mena, kurzy) });
        d = dalsiObnova(p, d);
      }
    }
    return out.sort((a, b) => a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.p.nazev.localeCompare(b.p.nazev, 'cs'));
  }
  /* kalendář: 12 měsíců od měsíce `dnes` – [{ mesic: 'RRRR-MM', obnovy, czk }] */
  function kalendar(polozky, dnes, kurzy, pocet) {
    const [r, m] = dnes.split('-').map(Number);
    const out = [];
    for (let k = 0; k < (pocet || 12); k++) {
      const idx = r * 12 + (m - 1) + k, r2 = Math.floor(idx / 12), m2 = idx - r2 * 12 + 1;
      const od = k === 0 ? dnes : r2 + '-' + String(m2).padStart(2, '0') + '-01';
      const do_ = r2 + '-' + String(m2).padStart(2, '0') + '-' + M.dniVMesici(r2, m2);
      const obnovy = obnovyVObdobi(polozky, od, do_, kurzy);
      out.push({ mesic: r2 + '-' + String(m2).padStart(2, '0'), obnovy, czk: Math.round(obnovy.reduce((a, o) => a + o.czk, 0) * 100) / 100 });
    }
    return out;
  }
  /* zkušební období: zbývá dní (záporné = prošlo), null = není */
  function zkusebka(p, dnes) { return p.zkusebniDo && p.stav === 'aktivni' ? M.rozdilDni(dnes, p.zkusebniDo) : null; }

  /* ---------- zápis platby ---------- */
  function zaplaceno(data, id, z) {
    const p = data.polozky.find(x => x.id === id);
    if (!p) throw new Error('Položka nenalezena');
    const datum = M.jeDatum(z && z.datum) ? z.datum : M.dnesIso();
    const castka = z && z.castka !== '' && z.castka != null ? normCena(z.castka) : p.cena;
    const termin = pristiObnova(p, datum) || p.priste || p.zacatek || datum;
    data.historie.push(normZaznam({ polozka: id, datum, castka, mena: p.mena, czk: vCzk(castka, p.mena, data.kurzy), pozn: z && z.pozn }));
    if (!p.zacatek) p.zacatek = termin;
    p.priste = dalsiObnova(p, termin > datum ? termin : datum);
    return p.priste;
  }
  function smazZaznam(data, id) { data.historie = data.historie.filter(h => h.id !== id); }
  function smazPolozku(data, id) {
    data.polozky = data.polozky.filter(p => p.id !== id);
    data.historie = data.historie.filter(h => h.polozka !== id);
  }
  function historiePolozky(data, id) { return data.historie.filter(h => h.polozka === id).sort((a, b) => b.datum < a.datum ? -1 : b.datum > a.datum ? 1 : 0); }

  /* ---------- přehledy ---------- */
  function souhrn(data, dnes) {
    const r = { mesicne: 0, rocne: 0, aktivni: 0, pozastaveno: 0, zruseno: 0, obnovy7: 0, obnovy7Czk: 0, zkusebky: 0, usporaPozastavene: 0 };
    for (const p of data.polozky) {
      r[p.stav]++;
      if (p.stav === 'aktivni') { r.rocne += rocne(p, data.kurzy); const z = zkusebka(p, dnes); if (z != null && z >= 0 && z <= 14) r.zkusebky++; }
      if (p.stav === 'pozastaveno') r.usporaPozastavene += rocne(p, data.kurzy);
    }
    r.rocne = Math.round(r.rocne * 100) / 100;
    r.mesicne = Math.round(r.rocne / 12 * 100) / 100;
    r.usporaPozastavene = Math.round(r.usporaPozastavene * 100) / 100;
    for (const o of obnovyVObdobi(data.polozky, dnes, M.pridejDny(dnes, 7), data.kurzy)) { r.obnovy7++; r.obnovy7Czk += o.czk; }
    r.obnovy7Czk = Math.round(r.obnovy7Czk * 100) / 100;
    return r;
  }
  /* aktivní položky po kategoriích, sestupně podle ročních nákladů */
  function poKategoriich(polozky, kurzy) {
    const m = new Map();
    for (const p of polozky) {
      if (p.stav !== 'aktivni') continue;
      const k = m.get(p.kategorie) || { kategorie: p.kategorie, nazev: KAT[p.kategorie].nazev, pocet: 0, rocne: 0, mesicne: 0 };
      k.pocet++; k.rocne += rocne(p, kurzy); m.set(p.kategorie, k);
    }
    return [...m.values()].map(k => Object.assign(k, { rocne: Math.round(k.rocne * 100) / 100, mesicne: Math.round(k.rocne / 12 * 100) / 100 })).sort((a, b) => b.rocne - a.rocne);
  }
  function osoby(data) { return [...new Set(data.polozky.map(p => p.osoba).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs')); }

  /* klic: 'cena' (měsíčně sestupně), 'datum' (příští obnova vzestupně, bez termínu nakonec), 'nazev' */
  function serad(polozky, klic, dnes, kurzy) {
    const cmp = {
      cena: (a, b) => mesicne(b, kurzy) - mesicne(a, kurzy),
      datum: (a, b) => { const x = pristiObnova(a, dnes) || '9999', y = pristiObnova(b, dnes) || '9999'; return x < y ? -1 : x > y ? 1 : 0; },
      nazev: () => 0
    }[klic] || (() => 0);
    return polozky.slice().sort((a, b) => cmp(a, b) || a.nazev.localeCompare(b.nazev, 'cs'));
  }
  /* f: { text, kategorie, osoba, stav } – stav '' = aktivní + pozastavené, jinak přesně */
  function filtruj(polozky, f) {
    f = f || {};
    const q = M.bezDiakritiky(f.text || '').trim();
    return polozky.filter(p => {
      if (f.stav ? p.stav !== f.stav : p.stav === 'zruseno') return false;
      if (f.kategorie && p.kategorie !== f.kategorie) return false;
      if (f.osoba && p.osoba !== f.osoba) return false;
      if (q && !M.bezDiakritiky([p.nazev, p.osoba, p.poznamka, KAT[p.kategorie].nazev].join(' ')).includes(q)) return false;
      return true;
    });
  }

  /* ---------- export ---------- */
  function ics(polozky, dnes, kurzy, razitko) {
    const r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp//Spravce predplatnych//CS', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    const ts = razitko || '20000101T000000Z';
    const udalost = (uid, datum, nazev, popis, predem) => {
      const d = datum.replace(/-/g, '');
      r.push('BEGIN:VEVENT', 'UID:' + uid + '@predplatne.local', 'DTSTAMP:' + ts,
        'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + M.pridejDny(datum, 1).replace(/-/g, ''),
        'SUMMARY:' + M.icsText(nazev), 'DESCRIPTION:' + M.icsText(popis));
      if (predem > 0) r.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + M.icsText(nazev), 'TRIGGER:-P' + predem + 'D', 'END:VALARM');
      r.push('END:VEVENT');
    };
    for (const o of obnovyVObdobi(polozky, dnes, M.pridejMesice(dnes, 12), kurzy)) {
      const p = o.p, cena = p.cena + ' ' + p.mena + (p.mena !== 'CZK' ? ' (≈ ' + M.formatKc(o.czk, 0) + ')' : '');
      udalost('predplatne-' + p.id + '-' + o.datum.replace(/-/g, ''), o.datum, '💳 ' + p.nazev + ': ' + cena,
        [popisIntervalu(p.interval), ZPUSOBY[p.zpusob], p.osoba ? 'Platí: ' + p.osoba : '', p.odkaz ? 'Zrušení: ' + p.odkaz : '', p.poznamka].filter(Boolean).join('\n'), p.predem);
    }
    for (const p of polozky) {
      if (p.stav === 'aktivni' && p.zkusebniDo && p.zkusebniDo >= dnes) {
        udalost('predplatne-zkusebka-' + p.id, p.zkusebniDo, '⏳ Konec zkušebního období: ' + p.nazev,
          ['Po skončení se začne platit ' + p.cena + ' ' + p.mena + ' ' + popisIntervalu(p.interval) + '.', p.odkaz ? 'Zrušení: ' + p.odkaz : ''].filter(Boolean).join('\n'), p.predem);
      }
    }
    r.push('END:VCALENDAR');
    return r.map(M.icsZalom).join('\r\n') + '\r\n';
  }
  const SLOUPCE_CSV = ['Název', 'Kategorie', 'Stav', 'Cena', 'Měna', 'Interval', 'Měsíčně (Kč)', 'Ročně (Kč)', 'Příští obnovení', 'Začátek', 'Zkušební do', 'Způsob platby', 'Platí', 'Odkaz na zrušení', 'Poznámka'];
  function csv(polozky, dnes, kurzy) {
    const c = n => String(n).replace('.', ',');
    const r = [SLOUPCE_CSV.join(';')];
    for (const p of polozky) {
      r.push([M.csvBunka(p.nazev), M.csvBunka(KAT[p.kategorie].nazev.replace(/^\S+ /, '')), M.csvBunka(STAVY[p.stav].replace(/^\S+ /, '')),
        c(p.cena), p.mena, M.csvBunka(popisIntervalu(p.interval)), c(mesicne(p, kurzy)), c(rocne(p, kurzy)),
        pristiObnova(p, dnes) || '', p.zacatek, p.zkusebniDo, M.csvBunka(ZPUSOBY[p.zpusob]), M.csvBunka(p.osoba), M.csvBunka(p.odkaz), M.csvBunka(p.poznamka)].join(';'));
    }
    return '﻿' + r.join('\r\n') + '\r\n';
  }

  const API = {
    VERZE, KLIC, PARAMETRY, MENY, KATEGORIE, KAT, STAVY, ZPUSOBY, INTERVALY, SLOUPCE_CSV,
    normPolozka, normKurzy, prazdna, migruj, vCzk, rocne, mesicne, popisIntervalu,
    pristiObnova, dalsiObnova, obnovyVObdobi, kalendar, zkusebka,
    zaplaceno, smazZaznam, smazPolozku, historiePolozky,
    souhrn, poKategoriich, osoby, serad, filtruj, ics, csv,
    formatDatum: M.formatDatum, formatKc: M.formatKc, formatCislo: M.formatCislo, dnesIso: M.dnesIso, jeDatum: M.jeDatum, pridejDny: M.pridejDny, pridejMesice: M.pridejMesice, rozdilDni: M.rozdilDni
  };
  if (typeof module !== 'undefined') module.exports = API; else window.PredplatneJadro = API;
})();
