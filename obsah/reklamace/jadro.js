/* Reklamační protokol – jádro bez DOM (test: _test/reklamace_test.js).
   Evidence reklamací pro prodejce i spotřebitele: lhůty podle občanského zákoníku
   a zákona o ochraně spotřebitele (znění po novele 374/2022 Sb., účinné od 6. 1. 2023,
   ověřeno 16. 11. 2026), číselná řada, CSV, texty dopisů.
   Stárnoucí data: zákonné lhůty a paragrafy v PRAVO. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_reklamace';

  /* Právní rámec – při změně zákona upravit tady (ověřeno 16. 11. 2026). */
  const PRAVO = {
    overeno: '2026-11-16',
    lhutaVyrizeniDni: 30,      // § 19 odst. 3 zák. 634/1992 Sb. – jen spotřebitel
    odpovednostMesice: 24,     // § 2165 odst. 1 OZ (spotřebitel), § 2112 odst. 1 OZ (podnikatel – skryté vady)
    pouziteMinMesice: 12,      // § 2167 OZ – u použitého zboží lze ujednat kratší, nejméně 1 rok
    domnenkaMesice: 12         // § 2161 odst. 5 OZ – vada projevená do 1 roku se považuje za existující při převzetí
  };

  const STAVY = { prijato: '📥 Přijato', posudek: '🔬 Posudek', vyrizeno: '✅ Vyřízeno', zamitnuto: '⛔ Zamítnuto' };
  const POZADAVKY = { oprava: 'oprava', vymena: 'výměna', sleva: 'přiměřená sleva', odstoupeni: 'odstoupení od smlouvy (vrácení peněz)' };
  const ZPUSOBY = { oprava: 'oprava', vymena: 'výměna za nové zboží', sleva: 'přiměřená sleva', odstoupeni: 'odstoupení od smlouvy – vrácení kupní ceny', jine: 'jiné' };
  const UPLATNENI = { osobne: 'osobně v provozovně', posta: 'poštou / přepravcem', email: 'e-mailem / online' };
  const BRZY_DNI = 5;

  /* ---------- data a datumy ---------- */
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
  const pridejDny = (s, n) => zDne(naDen(s) + n);
  const rozdilDni = (a, b) => naDen(b) - naDen(a);
  /* § 605 odst. 2 OZ: lhůta v měsících končí dnem téhož čísla; když v měsíci není, posledním dnem měsíce. */
  function pridejMesice(s, n) {
    const r = +s.slice(0, 4), m = +s.slice(5, 7) - 1 + n, d = +s.slice(8, 10);
    const posledni = new Date(Date.UTC(r, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(r, m, Math.min(d, posledni))).toISOString().slice(0, 10);
  }
  function formatDatum(s) { return jeDatum(s) ? +s.slice(8, 10) + '. ' + +s.slice(5, 7) + '. ' + s.slice(0, 4) : ''; }

  /* Velikonoční neděle (anonymní gregoriánský algoritmus) */
  function velikonoce(r) {
    const a = r % 19, b = Math.floor(r / 100), c = r % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
    return r + '-' + dvoj(mes) + '-' + dvoj(den);
  }
  /* Státní svátky a ostatní svátky ČR (zák. 245/2000 Sb.) */
  function jeSvatek(s) {
    const md = s.slice(5);
    if (['01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26'].includes(md)) return true;
    const v = velikonoce(+s.slice(0, 4));
    return s === pridejDny(v, -2) || s === pridejDny(v, 1);   // Velký pátek, Velikonoční pondělí
  }
  function jePracovni(s) { const dt = new Date(naDen(s) * 86400000).getUTCDay(); return dt !== 0 && dt !== 6 && !jeSvatek(s); }
  /* § 607 OZ: připadne-li konec lhůty na sobotu, neděli nebo svátek, je posledním dnem nejbližší pracovní den. */
  function posunNaPracovni(s) { while (!jePracovni(s)) s = pridejDny(s, 1); return s; }

  /* ---------- záznam ---------- */
  let citac = 0;
  function novyId() { return 'R' + Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6); }
  const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
  const dat = v => jeDatum(v) ? v : '';
  const vyber = (v, mapa, vych) => Object.prototype.hasOwnProperty.call(mapa, v) ? v : vych;
  function cislo(v) {
    if (v === '' || v == null) return null;
    const n = Number(String(v).replace(',', '.').replace(/\s/g, ''));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  }
  function normOsoba(o) {
    o = o || {};
    return { jmeno: txt(o.jmeno, 120), adresa: txt(o.adresa, 300), ico: txt(o.ico, 20), telefon: txt(o.telefon, 40), email: txt(o.email, 120) };
  }
  function normReklamace(r) {
    r = r || {};
    const v = r.vyrizeni || {};
    const kupujiciTyp = r.kupujiciTyp === 'podnikatel' ? 'podnikatel' : 'spotrebitel';
    const pouzite = !!r.pouzite;
    let lhutaMesice = Math.round(Number(r.lhutaMesice)) || PRAVO.odpovednostMesice;
    if (kupujiciTyp === 'spotrebitel') lhutaMesice = pouzite ? Math.min(PRAVO.odpovednostMesice, Math.max(PRAVO.pouziteMinMesice, lhutaMesice)) : PRAVO.odpovednostMesice;
    else lhutaMesice = Math.min(120, Math.max(1, lhutaMesice));
    return {
      id: String(r.id || novyId()),
      role: r.role === 'spotrebitel' ? 'spotrebitel' : 'prodejce',
      cislo: txt(r.cislo, 40),
      kupujiciTyp,
      kupujici: normOsoba(r.kupujici),
      prodavajici: normOsoba(r.prodavajici),
      zbozi: txt(r.zbozi, 200),
      sn: txt(r.sn, 80),
      doklad: txt(r.doklad, 80),
      cena: cislo(r.cena),
      datumKoupe: dat(r.datumKoupe),
      datumPrevzeti: dat(r.datumPrevzeti) || dat(r.datumKoupe),
      datumUplatneni: dat(r.datumUplatneni) || dnesIso(),
      zpusobUplatneni: vyber(r.zpusobUplatneni, UPLATNENI, 'osobne'),
      vada: txt(r.vada, 3000),
      pozadavek: vyber(r.pozadavek, POZADAVKY, 'oprava'),
      prislusenstvi: txt(r.prislusenstvi, 500),
      stavZbozi: txt(r.stavZbozi, 500),
      pouzite,
      lhutaMesice,
      zarukaMesice: Math.min(600, Math.max(0, Math.round(Number(r.zarukaMesice)) || 0)),
      dohodnutaLhuta: dat(r.dohodnutaLhuta),
      vecPredana: r.vecPredana !== false,
      stav: vyber(r.stav, STAVY, 'prijato'),
      posudek: txt(r.posudek, 2000),
      vyrizeni: {
        datum: dat(v.datum),
        zpusob: vyber(v.zpusob, ZPUSOBY, ''),
        popis: txt(v.popis, 3000),
        castka: cislo(v.castka)
      },
      datumVraceni: dat(r.datumVraceni),
      poznamka: txt(r.poznamka, 3000),
      fotky: Array.isArray(r.fotky) ? r.fotky.map(String).slice(0, 40) : [],
      historie: (Array.isArray(r.historie) ? r.historie : []).filter(h => h && jeDatum(h.datum)).map(h => ({ datum: h.datum, text: txt(h.text, 300) })),
      vytvoreno: dat(r.vytvoreno) || dnesIso()
    };
  }
  function prazdna() {
    return { verze: VERZE, reklamace: [], nastaveni: { prefix: 'RK', firma: normOsoba(), ja: normOsoba(), provozovna: '' } };
  }
  function migruj(d) {
    const p = prazdna();
    if (!d || typeof d !== 'object' || !Array.isArray(d.reklamace)) return p;
    const n = d.nastaveni || {};
    return {
      verze: VERZE,
      reklamace: d.reklamace.map(normReklamace),
      nastaveni: { prefix: txt(n.prefix, 12).replace(/[^\p{L}\p{N}_\-]/gu, '') || 'RK', firma: normOsoba(n.firma), ja: normOsoba(n.ja), provozovna: txt(n.provozovna, 300) }
    };
  }

  /* ---------- číselná řada: PREFIX-ROK-NNNN ---------- */
  function dalsiCislo(seznam, prefix, rok) {
    const zac = prefix + '-' + rok + '-';
    let max = 0;
    for (const r of seznam) if (r.cislo && r.cislo.startsWith(zac)) { const n = parseInt(r.cislo.slice(zac.length), 10); if (n > max) max = n; }
    return zac + String(max + 1).padStart(4, '0');
  }

  /* ---------- lhůty ---------- */
  const uzavrena = r => r.stav === 'vyrizeno' || r.stav === 'zamitnuto';

  /* Dny, po které kupující nemohl věc užívat kvůli této reklamaci (§ 2165 odst. 4, § 1922 odst. 2 OZ):
     od uplatnění do vrácení věci (nebo vyřízení, u běžící reklamace do dneška). Zamítnutá = neoprávněná → 0. */
  function dnyNeuzivani(r, dnes) {
    if (r.stav === 'zamitnuto' || !r.vecPredana) return 0;
    const konec = r.datumVraceni || (uzavrena(r) && r.vyrizeni.datum) || dnes;
    return Math.max(0, rozdilDni(r.datumUplatneni, konec));
  }
  const klicZbozi = r => (r.sn || '').replace(/\s/g, '').toLowerCase();
  /* Součet dnů z dřívějších reklamací téhož kusu (stejné výrobní číslo, stejná role). */
  function predchoziDny(seznam, r, dnes) {
    const k = klicZbozi(r);
    if (!k) return 0;
    return seznam.filter(x => x.id !== r.id && x.role === r.role && klicZbozi(x) === k && x.datumUplatneni < r.datumUplatneni)
      .reduce((s, x) => s + dnyNeuzivani(x, dnes), 0);
  }

  /* Všechny lhůty jedné reklamace.
     → { vyrizeniDo, zbyva, stavLhuty: 'bez'|'bezi'|'brzy'|'prosla'|'vcas'|'pozde',
         konecOdpovednosti, konecZaruky, vcasUplatneno, domnenka, dnyNeuzivani, predchozi, novyKonec, novyKonecZaruky } */
  function lhuty(r, dnes, predchozi) {
    predchozi = predchozi || 0;
    const spotr = r.kupujiciTyp === 'spotrebitel';
    let vyrizeniDo = '';
    if (r.dohodnutaLhuta) vyrizeniDo = r.dohodnutaLhuta;
    else if (spotr) vyrizeniDo = posunNaPracovni(pridejDny(r.datumUplatneni, PRAVO.lhutaVyrizeniDni));
    let stavLhuty = 'bez', zbyva = null;
    if (vyrizeniDo) {
      if (uzavrena(r) && r.vyrizeni.datum) stavLhuty = r.vyrizeni.datum <= vyrizeniDo ? 'vcas' : 'pozde';
      else if (!uzavrena(r)) {
        zbyva = rozdilDni(dnes, vyrizeniDo);
        stavLhuty = zbyva < 0 ? 'prosla' : zbyva <= BRZY_DNI ? 'brzy' : 'bezi';
      }
    }
    const prevzeti = r.datumPrevzeti;
    const konecOdpovednosti = prevzeti ? posunNaPracovni(pridejDny(pridejMesice(prevzeti, r.lhutaMesice), predchozi)) : '';
    const konecZaruky = prevzeti && r.zarukaMesice ? posunNaPracovni(pridejDny(pridejMesice(prevzeti, r.zarukaMesice), predchozi)) : '';
    const hranice = [konecOdpovednosti, konecZaruky].filter(Boolean).sort().pop() || '';
    const vcasUplatneno = hranice ? r.datumUplatneni <= hranice : null;
    const domnenka = spotr && prevzeti ? r.datumUplatneni <= pridejMesice(prevzeti, PRAVO.domnenkaMesice) : false;
    const dny = dnyNeuzivani(r, dnes);
    return {
      vyrizeniDo, zbyva, stavLhuty, konecOdpovednosti, konecZaruky, vcasUplatneno, domnenka,
      dnyNeuzivani: dny, predchozi,
      novyKonec: konecOdpovednosti ? posunNaPracovni(pridejDny(pridejMesice(prevzeti, r.lhutaMesice), predchozi + dny)) : '',
      novyKonecZaruky: konecZaruky ? posunNaPracovni(pridejDny(pridejMesice(prevzeti, r.zarukaMesice), predchozi + dny)) : ''
    };
  }
  function lhutyVSeznamu(seznam, r, dnes) { return lhuty(r, dnes, predchoziDny(seznam, r, dnes)); }

  function popisZbyva(dni) {
    if (dni == null) return '';
    if (dni === 0) return 'dnes poslední den';
    if (dni < 0) { const n = -dni; return 'po lhůtě ' + n + (n === 1 ? ' den' : n < 5 ? ' dny' : ' dní'); }
    return 'zbývá ' + dni + (dni === 1 ? ' den' : dni < 5 ? ' dny' : ' dní');
  }

  /* ---------- seznam ---------- */
  function bezDiakritiky(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function filtruj(seznam, f) {
    f = f || {};
    const q = bezDiakritiky(f.text).trim();
    return seznam.filter(r => (!f.role || r.role === f.role) && (!f.stav || r.stav === f.stav) &&
      (!q || bezDiakritiky([r.cislo, r.zbozi, r.sn, r.doklad, r.vada, r.kupujici.jmeno, r.prodavajici.jmeno].join(' ')).includes(q)));
  }
  function souhrn(seznam, dnes) {
    const s = { celkem: seznam.length, otevrene: 0, brzy: 0, prosle: 0, vyrizene: 0, zamitnute: 0 };
    for (const r of seznam) {
      if (r.stav === 'vyrizeno') s.vyrizene++;
      else if (r.stav === 'zamitnuto') s.zamitnute++;
      else {
        s.otevrene++;
        const l = lhuty(r, dnes).stavLhuty;
        if (l === 'brzy') s.brzy++; else if (l === 'prosla') s.prosle++;
      }
    }
    return s;
  }
  /* Otevřené nahoru podle lhůty, uzavřené podle data uplatnění sestupně. */
  function serad(seznam, dnes) {
    return seznam.slice().sort((a, b) => {
      const ua = uzavrena(a), ub = uzavrena(b);
      if (ua !== ub) return ua ? 1 : -1;
      if (!ua) {
        const la = lhuty(a, dnes).vyrizeniDo || '9999', lb = lhuty(b, dnes).vyrizeniDo || '9999';
        if (la !== lb) return la < lb ? -1 : 1;
      }
      return a.datumUplatneni < b.datumUplatneni ? 1 : a.datumUplatneni > b.datumUplatneni ? -1 : 0;
    });
  }

  /* ---------- CSV ---------- */
  const csvB = v => { const s = String(v == null ? '' : v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csvC = n => n == null ? '' : String(n).replace('.', ',');
  function csv(seznam, dnes) {
    const r = [['Číslo', 'Role', 'Kupující', 'Typ kupujícího', 'Prodávající', 'Zboží', 'Výrobní číslo', 'Doklad', 'Cena', 'Koupeno', 'Převzato',
      'Uplatněno', 'Způsob uplatnění', 'Vada', 'Požadavek', 'Stav', 'Vyřídit do', 'Vyřízeno dne', 'Způsob vyřízení', 'Částka', 'Popis vyřízení',
      'Konec lhůty pro vady', 'Po prodloužení', 'Dny bez užívání', 'Domněnka 1 rok', 'Poznámka']];
    for (const x of seznam) {
      const l = lhutyVSeznamu(seznam, x, dnes);
      r.push([x.cislo, x.role === 'prodejce' ? 'prodejce' : 'spotřebitel', x.kupujici.jmeno, x.kupujiciTyp === 'spotrebitel' ? 'spotřebitel' : 'podnikatel',
        x.prodavajici.jmeno, x.zbozi, x.sn, x.doklad, csvC(x.cena), x.datumKoupe, x.datumPrevzeti, x.datumUplatneni, UPLATNENI[x.zpusobUplatneni],
        x.vada, POZADAVKY[x.pozadavek], STAVY[x.stav].replace(/^\S+\s/, ''), l.vyrizeniDo, x.vyrizeni.datum, ZPUSOBY[x.vyrizeni.zpusob] || '', csvC(x.vyrizeni.castka),
        x.vyrizeni.popis, l.konecOdpovednosti, l.novyKonec, l.dnyNeuzivani, l.domnenka ? 'ano' : 'ne', x.poznamka]);
    }
    return '\ufeff' + r.map(x => x.map(csvB).join(';')).join('\r\n');
  }

  /* ---------- dopisy spotřebitele ---------- */
  const osobaText = o => [o.jmeno, o.adresa, o.ico ? 'IČO: ' + o.ico : '', o.telefon ? 'tel.: ' + o.telefon : '', o.email].filter(Boolean).join('\n');
  const castkaText = n => n == null ? '' : n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' Kč';
  function dopisUplatneni(r, dnes) {
    const l = lhuty(r, dnes);
    return [
      osobaText(r.kupujici), '', 'Prodávající:', osobaText(r.prodavajici) || '…', '',
      'V ……………… dne ' + formatDatum(dnes), '',
      'Věc: Uplatnění práva z vadného plnění (reklamace)', '',
      `Dne ${formatDatum(r.datumKoupe) || '…'} jsem u Vás zakoupil(a) ${r.zbozi || '…'}${r.sn ? ', výrobní číslo ' + r.sn : ''}${r.cena != null ? ', za cenu ' + castkaText(r.cena) : ''}${r.doklad ? ' (doklad č. ' + r.doklad + ')' : ''}. Zboží jsem převzal(a) dne ${formatDatum(r.datumPrevzeti) || '…'}.`, '',
      'Zboží má tuto vadu:', r.vada || '…', '',
      `V souladu s § 2169 a násl. zákona č. 89/2012 Sb., občanský zákoník, uplatňuji právo z vadného plnění a požaduji jako způsob vyřízení: ${POZADAVKY[r.pozadavek]}.`,
      l.domnenka ? 'Vada se projevila do jednoho roku od převzetí, proto se podle § 2161 odst. 5 občanského zákoníku má za to, že věc byla vadná již při převzetí.' : '',
      `Žádám o písemné potvrzení o uplatnění reklamace podle § 19 odst. 1 zákona č. 634/1992 Sb., o ochraně spotřebitele, a o vyřízení reklamace včetně odstranění vady nejpozději do 30 dnů ode dne jejího uplatnění (§ 19 odst. 3 téhož zákona), tj. do ${formatDatum(l.vyrizeniDo)}.`,
      'Dále žádám o náhradu účelně vynaložených nákladů spojených s uplatněním reklamace (§ 1924 občanského zákoníku).',
      r.prislusenstvi ? '\nPřikládám: ' + r.prislusenstvi : '', '',
      'S pozdravem', '', '', '……………………………………', r.kupujici.jmeno || ''
    ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
  }
  function dopisOdstoupeni(r, dnes) {
    const l = lhuty(r, dnes);
    return [
      osobaText(r.kupujici), '', 'Prodávající:', osobaText(r.prodavajici) || '…', '',
      'V ……………… dne ' + formatDatum(dnes), '',
      'Věc: Odstoupení od kupní smlouvy pro nevyřízení reklamace v zákonné lhůtě', '',
      `Dne ${formatDatum(r.datumUplatneni)} jsem u Vás uplatnil(a) reklamaci zboží ${r.zbozi || '…'}${r.sn ? ', výrobní číslo ' + r.sn : ''}${r.cislo ? ' (reklamace č. ' + r.cislo + ')' : ''}, zakoupeného dne ${formatDatum(r.datumKoupe) || '…'}${r.cena != null ? ' za ' + castkaText(r.cena) : ''}.`,
      `Lhůta 30 dnů pro vyřízení reklamace podle § 19 odst. 3 zákona č. 634/1992 Sb., o ochraně spotřebitele, uplynula dne ${formatDatum(l.vyrizeniDo)}, aniž by mi bylo vyřízení reklamace oznámeno.`, '',
      'Z tohoto důvodu odstupuji od kupní smlouvy a žádám o vrácení kupní ceny' + (r.cena != null ? ' ve výši ' + castkaText(r.cena) : '') + ' na účet č. ……………………… / v hotovosti, a to bez zbytečného odkladu.',
      'Zároveň žádám o náhradu účelně vynaložených nákladů spojených s reklamací (§ 1924 občanského zákoníku).', '',
      'Pokud mé žádosti nevyhovíte, obrátím se na Českou obchodní inspekci (mimosoudní řešení spotřebitelských sporů, adr.coi.cz).', '',
      'S pozdravem', '', '', '……………………………………', r.kupujici.jmeno || ''
    ].join('\n');
  }

  const api = {
    VERZE, KLIC, PRAVO, STAVY, POZADAVKY, ZPUSOBY, UPLATNENI, BRZY_DNI,
    jeDatum, dnesIso, pridejDny, pridejMesice, rozdilDni, formatDatum, velikonoce, jeSvatek, jePracovni, posunNaPracovni,
    novyId, normOsoba, normReklamace, prazdna, migruj, dalsiCislo, uzavrena,
    dnyNeuzivani, predchoziDny, lhuty, lhutyVSeznamu, popisZbyva, bezDiakritiky, filtruj, souhrn, serad,
    csv, castkaText, osobaText, dopisUplatneni, dopisOdstoupeni
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ReklamaceJadro = api;
})();
