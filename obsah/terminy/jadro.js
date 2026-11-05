/* Hlídač termínů – záruky, preventivní prohlídky, očkování, kontroly, doklady. Jádro bez DOM (test: _test/terminy_test.js).
   Počty termínů, historii zápisů a interval bere z jádra Domácí údržby (udrzba/jadro.js → majetek/jadro.js);
   tady jsou jen typy položek, předlohy, stav „vypršelo“ a iCalendar. */
(function () {
  'use strict';
  const M = typeof module !== 'undefined' ? require('../majetek/jadro.js') : window.MajetekJadro;
  const U = typeof module !== 'undefined' ? require('../udrzba/jadro.js') : window.UdrzbaJadro;

  const VERZE = 1;
  const KLIC = 'webapp_terminy';

  /* Typ určuje popisky polí v dialogu a co dává smysl: `opak` = má interval a „Hotovo“, `konec` = termín je konec platnosti
     (po něm stav „vypršelo“ místo „po termínu“). Pole: misto, posledni, od, interval – null = skrýt. */
  const TYPY = [
    { id: 'prevence', nazev: '🩺 Preventivní prohlídky', ikona: '🩺', predem: 21, hotovo: '✓ Proběhla',
      pole: { misto: 'Lékař / ordinace', posledni: 'Poslední prohlídka', od: 'První termín (když ještě nebyla)', interval: 'Opakovat každých' }, termin: 'příští prohlídka' },
    { id: 'ockovani', nazev: '💉 Očkování', ikona: '💉', predem: 30, hotovo: '💉 Zapsat dávku',
      pole: { misto: 'Vakcína (název přípravku)', posledni: 'Poslední dávka', od: 'Termín další dávky (když ještě nebyla)', interval: 'Přeočkovat za' }, termin: 'další dávka' },
    { id: 'kontrola', nazev: '📋 Plánované kontroly a vyšetření', ikona: '📋', predem: 3, hotovo: '✓ Proběhla', cas: true,
      pole: { misto: 'Kde / lékař', posledni: 'Naposledy proběhla', od: 'Datum kontroly', interval: 'Opakovat (0 = jen jednou)' }, termin: 'kontrola' },
    { id: 'zaruka', nazev: '🧾 Záruky', ikona: '🧾', predem: 30, konec: true, cena: true,
      pole: { misto: 'Obchod / prodejce', posledni: 'Datum koupě', od: null, interval: 'Délka záruky' }, termin: 'záruka do' },
    { id: 'doklad', nazev: '🪪 Doklady a průkazy', ikona: '🪪', predem: 60, konec: true,
      pole: { misto: 'Číslo / kdo vydal', posledni: null, od: 'Platí do', interval: null }, termin: 'platí do' },
    { id: 'jine', nazev: '📌 Ostatní', ikona: '📌', predem: 14, hotovo: '✓ Hotovo',
      pole: { misto: 'Místo / kdo', posledni: 'Naposledy', od: 'První termín', interval: 'Opakovat každých' }, termin: 'termín' }
  ];
  const TYP = Object.fromEntries(TYPY.map(t => [t.id, t]));

  const RADA_ZARUKA = 'Spotřebitel má zákonnou záruku (právo z vadného plnění) 24 měsíců od převzetí (§ 2165 občanského zákoníku), ' +
    'u použitého zboží ji lze smluvně zkrátit na 12 měsíců. Reklamaci musí prodejce vyřídit do 30 dnů. Uschovejte doklad o koupi. (Stav 11/2026.)';

  /* Předlohy – orientačně podle předpisů ke 11/2026 (vyhláška 70/2012 Sb. o preventivních prohlídkách, 537/2006 Sb. o očkování,
     zákon 166/1999 Sb. veterinární). `povinne` = povinnost ze zákona, `rada` = co hradí pojišťovna / doporučení. Ověřte u lékaře. */
  const PREDLOHY = [
    { typ: 'prevence', nazev: 'Preventivní prohlídka u praktického lékaře', int: [2, 'r'], pro: 'dospělí', rada: 'Hrazeno pojišťovnou od 18 let 1× za 2 roky (vyhláška 70/2012 Sb.) – krevní tlak, odběry, od 50 let i test na skryté krvácení.' },
    { typ: 'prevence', nazev: 'Preventivní prohlídka u zubaře', int: [1, 'r'], pro: 'dospělí', rada: 'Dospělí 1× ročně, těhotné 2× (vyhláška 70/2012 Sb.). Kdo prohlídku vynechá, riskuje vyšší doplatky za ošetření.' },
    { typ: 'prevence', nazev: 'Preventivní prohlídka u zubaře – dítě', int: [6, 'm'], pro: 'děti', rada: 'Děti do 18 let 2× ročně.' },
    { typ: 'prevence', nazev: 'Dentální hygiena', int: [6, 'm'], pro: 'všichni', rada: 'Doporučeno 1–2× ročně; pojišťovny na ni často přispívají z fondu prevence.' },
    { typ: 'prevence', nazev: 'Preventivní prohlídka u gynekologa', int: [1, 'r'], pro: 'ženy', rada: 'Od 15 let 1× ročně, včetně screeningu rakoviny děložního hrdla (cytologie, od 35 let i HPV test v daných letech).' },
    { typ: 'prevence', nazev: 'Mamografický screening', int: [2, 'r'], pro: 'ženy', rada: 'Ženy od 45 let 1× za 2 roky, bez horní věkové hranice. Žádanku vystaví gynekolog nebo praktik.' },
    { typ: 'prevence', nazev: 'Screening rakoviny tlustého střeva', int: [2, 'r'], pro: 'od 50 let', rada: 'Test na skryté krvácení ve stolici (TOKS): 50–54 let každý rok, od 55 let 1× za 2 roky – nebo místo něj screeningová kolonoskopie 1× za 10 let.' },
    { typ: 'prevence', nazev: 'Screening rakoviny prostaty (PSA)', int: [2, 'r'], pro: 'muži 50–69', rada: 'Program časného záchytu od 2024 – vyšetření PSA přes praktického lékaře; další interval určí lékař podle výsledku (2–4 roky).' },
    { typ: 'prevence', nazev: 'Screening rakoviny plic (CT)', int: [1, 'r'], pro: 'kuřáci 55–74', rada: 'Pro současné a bývalé silné kuřáky – nízkodávkové CT, doporučí praktický lékař.' },
    { typ: 'prevence', nazev: 'Preventivní prohlídka u pediatra', int: [2, 'r'], pro: 'děti', rada: 'V prvních letech častěji (dle kalendáře pediatra), od 3 let každé 2 roky (3, 5, 7… 17 let).' },
    { typ: 'prevence', nazev: 'Oční vyšetření', int: [2, 'r'], pro: 'všichni', rada: 'Doporučení; od 40 let i kvůli nitroočnímu tlaku (glaukom).' },
    { typ: 'prevence', nazev: 'Kontrola znamének u kožního lékaře', int: [1, 'r'], pro: 'všichni', rada: 'Doporučení, zvlášť při velkém počtu znamének nebo melanomu v rodině.' },
    { typ: 'prevence', nazev: 'Pracovnělékařská prohlídka (periodická)', int: [4, 'r'], pro: 'zaměstnanci', povinne: 'Vyhláška 79/2013 Sb.: interval podle kategorie práce a věku (zpravidla 1–6 let) – zajišťuje zaměstnavatel. Interval upravte podle posudku.' },
    { typ: 'prevence', nazev: 'Preventivní prohlídka u veterináře', int: [1, 'r'], pro: 'zvíře', rada: 'Zuby, váha, srdce; u starších zvířat i krevní testy.' },

    { typ: 'ockovani', nazev: 'Tetanus – přeočkování', int: [10, 'r'], pro: 'dospělí', povinne: 'Vyhláška 537/2006 Sb.: pravidelné přeočkování proti tetanu je povinné, po 10–15 letech od poslední dávky. Datum najdete v očkovacím průkazu.' },
    { typ: 'ockovani', nazev: 'Klíšťová encefalitida – přeočkování', int: [3, 'r'], pro: 'všichni', rada: 'Po základním očkování (3 dávky) první přeočkování za 3 roky, další po 5 letech; od 50/60 let (podle vakcíny) znovu po 3 letech.' },
    { typ: 'ockovani', nazev: 'Chřipka', int: [1, 'r'], pro: 'všichni', rada: 'Každý podzim (září–listopad). Od 60 let a u chronicky nemocných hrazeno pojišťovnou.' },
    { typ: 'ockovani', nazev: 'COVID-19', int: [1, 'r'], pro: 'rizikoví', rada: 'Posilující dávka podle aktuálního doporučení – hlavně pro seniory a chronicky nemocné.' },
    { typ: 'ockovani', nazev: 'Pneumokoky', int: [0, 'r'], pro: 'od 65 let', rada: 'Od 65 let hrazeno pojišťovnou; obvykle jednorázově (schéma určí lékař).' },
    { typ: 'ockovani', nazev: 'Pes – vzteklina', int: [1, 'r'], pro: 'zvíře', povinne: 'Veterinární zákon 166/1999 Sb.: pes musí být očkován proti vzteklině ve stáří 3–6 měsíců a pak opakovaně v intervalu podle použité vakcíny (1–3 roky, je v pasu zvířete). Interval upravte.' },
    { typ: 'ockovani', nazev: 'Pes / kočka – kombinovaná vakcína', int: [1, 'r'], pro: 'zvíře', rada: 'Psinka, parvoviróza, hepatitida (pes) / panleukopenie, rýma (kočka) – podle doporučení veterináře.' },

    { typ: 'doklad', nazev: 'Občanský průkaz', pro: 'všichni', rada: 'Dospělý 10 let, dítě do 15 let 5 let. Nový si zažádejte s předstihem – výroba trvá až 30 dní (rychlejší za poplatek).' },
    { typ: 'doklad', nazev: 'Cestovní pas', pro: 'všichni', rada: 'Dospělý 10 let, dítě do 15 let 5 let. Některé země vyžadují platnost aspoň 6 měsíců po návratu.' },
    { typ: 'doklad', nazev: 'Řidičský průkaz', pro: 'dospělí', rada: 'Platnost je na průkazu (pole 4b). Výměna na obecním úřadě obce s rozšířenou působností.' },
    { typ: 'doklad', nazev: 'Evropský průkaz zdravotního pojištění', pro: 'všichni', rada: 'Datum platnosti je na zadní straně karty pojištěnce; nový vydá pojišťovna zdarma.' },
    { typ: 'doklad', nazev: 'Cestovní pas zvířete / čip', pro: 'zvíře', rada: 'Pas platí trvale, hlídá se v něm platnost očkování proti vzteklině.' },
    { typ: 'doklad', nazev: 'Profesní průkaz / školení (BOZP, svářeč, řidič VZV…)', pro: 'dospělí', rada: 'Platnost a interval opakování určuje předpis nebo zaměstnavatel.' },

    { typ: 'jine', nazev: 'Odčervení psa / kočky', int: [3, 'm'], pro: 'zvíře', rada: 'U dospělých zvířat zpravidla 2–4× ročně podle způsobu života.' },
    { typ: 'jine', nazev: 'Ochrana proti klíšťatům a blechám (zvíře)', int: [3, 'm'], pro: 'zvíře', rada: 'Podle přípravku – obojek 6–8 měsíců, tableta 1–3 měsíce, pipeta 1 měsíc.' },
    { typ: 'jine', nazev: 'Výměna kontaktních čoček', int: [1, 'm'], pro: 'všichni' },
    { typ: 'jine', nazev: 'Domácí lékárnička – vyřadit prošlé léky', int: [1, 'r'], pro: 'domácnost', rada: 'Prošlé léky vrátit do lékárny.' }
  ];

  /* ---------- normalizace ---------- */
  function normInterval(i) {
    const n = Math.round(Number(i && i.n));
    return n > 0 && U.JEDNOTKY[i.j] ? { n: Math.min(n, 999), j: i.j } : null;
  }
  const txt = (v, max) => String(v == null ? '' : v).slice(0, max);
  function normPolozka(p) {
    p = p || {};
    const typ = TYP[p.typ] ? p.typ : 'jine', t = TYP[typ];
    const cena = U.normCena(p.cena);
    return {
      id: String(p.id || M.novyId('T')),
      typ,
      nazev: txt(p.nazev, 200).trim() || 'Bez názvu',
      osoba: txt(p.osoba, 80).trim(),
      interval: t.pole.interval ? normInterval(p.interval) : null,
      posledni: t.pole.posledni && M.jeDatum(p.posledni) ? p.posledni : '',
      od: t.pole.od && M.jeDatum(p.od) ? p.od : '',
      cas: t.cas && /^([01]\d|2[0-3]):[0-5]\d$/.test(p.cas || '') ? p.cas : '',
      predem: Number.isFinite(+p.predem) && p.predem !== '' && p.predem != null && +p.predem >= 0 ? Math.min(Math.round(+p.predem), 365) : t.predem,
      misto: txt(p.misto, 160),
      kontakt: txt(p.kontakt, 300),
      cena: t.cena ? cena : null,
      poznamka: txt(p.poznamka, 4000),
      povinne: txt(p.povinne, 1000),
      rada: txt(p.rada, 1000),
      archiv: !!p.archiv
    };
  }
  function prazdna() { return { verze: VERZE, ukoly: [], historie: [] }; }
  /* Položky se v datech jmenují `ukoly` – kvůli sdíleným funkcím historie z jádra údržby (provedeno, smazZaznam…). */
  function migruj(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.ukoly)) return prazdna();
    const ukoly = d.ukoly.map(normPolozka);
    const ids = new Set(ukoly.map(u => u.id));
    const historie = (Array.isArray(d.historie) ? d.historie : []).map(U.normZaznam).filter(h => h.datum && ids.has(h.ukol));
    return { verze: VERZE, ukoly, historie };
  }
  function zPredlohy(p, osoba, dnes) {
    const t = TYP[p.typ];
    return normPolozka({ typ: p.typ, nazev: p.nazev, osoba, interval: p.int ? { n: p.int[0], j: p.int[1] } : null,
      od: t.pole.posledni ? dnes : '', povinne: p.povinne, rada: p.rada });
  }

  /* ---------- stav ---------- */
  /* Jako údržba, jen u záruk a dokladů je po termínu „vyprselo“ (nic se nezmešká, jen to skončilo). */
  function stav(p, dnes) {
    const s = U.stav(p, dnes);
    if (s.stav === 'po' && TYP[p.typ].konec) s.stav = 'vyprselo';
    return s;
  }
  const PORADI = { po: 0, brzy: 1, ok: 2, nezadano: 3, hotovo: 4, vyprselo: 5, archiv: 6 };
  function serad(polozky, dnes) {
    return polozky.map(u => ({ u, s: stav(u, dnes) })).sort((a, b) =>
      PORADI[a.s.stav] - PORADI[b.s.stav] ||
      (a.s.termin && b.s.termin ? (a.s.termin < b.s.termin ? -1 : a.s.termin > b.s.termin ? 1 : 0) : 0) ||
      a.u.nazev.localeCompare(b.u.nazev, 'cs'));
  }
  /* f: { text, typ, osoba, stav: '' | 'pozornost' | 'vyprselo' | 'archiv' } */
  function filtruj(polozky, dnes, f) {
    f = f || {};
    const q = M.bezDiakritiky(f.text || '').trim();
    return polozky.filter(u => {
      const s = stav(u, dnes).stav;
      if (f.stav === 'archiv') { if (s !== 'archiv') return false; }
      else if (s === 'archiv') return false;
      else if (f.stav === 'pozornost' && s !== 'po' && s !== 'brzy') return false;
      else if (f.stav === 'vyprselo' && s !== 'vyprselo') return false;
      if (f.typ && u.typ !== f.typ) return false;
      if (f.osoba != null && f.osoba !== '' && u.osoba !== f.osoba) return false;
      if (q && !M.bezDiakritiky([u.nazev, u.osoba, u.misto, u.kontakt, u.poznamka].join(' ')).includes(q)) return false;
      return true;
    });
  }
  function osoby(data) {
    return [...new Set(data.ukoly.map(u => u.osoba).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'));
  }
  function souhrn(polozky, dnes) {
    const r = { po: 0, brzy: 0, ok: 0, nezadano: 0, hotovo: 0, vyprselo: 0, archiv: 0, celkem: 0, zarukyPlatne: 0 };
    for (const u of polozky) {
      const s = stav(u, dnes).stav;
      r[s]++;
      if (s !== 'archiv') r.celkem++;
      if (u.typ === 'zaruka' && (s === 'ok' || s === 'brzy')) r.zarukyPlatne++;
    }
    return r;
  }

  /* ---------- iCalendar: událost v příštím termínu; kontrola se zadaným časem jako hodinová událost ---------- */
  function ics(polozky, razitko) {
    const r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp//Hlidac terminu//CS', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    const ts = razitko || '20000101T000000Z';
    for (const u of polozky) {
      const t = U.priste(u); if (!t) continue;
      const T = TYP[u.typ], d = t.replace(/-/g, '');
      const nazev = T.ikona + ' ' + (T.konec ? (u.typ === 'zaruka' ? 'Konec záruky: ' : 'Konec platnosti: ') : '') + u.nazev + (u.osoba ? ' (' + u.osoba + ')' : '');
      const popis = [u.interval ? U.popisIntervalu(u.interval) : '', u.posledni ? T.pole.posledni + ': ' + M.formatDatum(u.posledni) : '',
        u.misto, u.kontakt, u.povinne, u.poznamka].filter(Boolean).join('\n');
      r.push('BEGIN:VEVENT', 'UID:terminy-' + u.id + '-' + d + '@terminy.local', 'DTSTAMP:' + ts);
      if (u.cas && t === u.od) {
        const zac = d + 'T' + u.cas.replace(':', '') + '00';
        const h = +u.cas.slice(0, 2) + 1, konec = h < 24 ? d + 'T' + String(h).padStart(2, '0') + u.cas.slice(3) + '00' : d + 'T235900';
        r.push('DTSTART:' + zac, 'DTEND:' + konec);
      } else r.push('DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + M.pridejDny(t, 1).replace(/-/g, ''));
      r.push('SUMMARY:' + M.icsText(nazev), 'DESCRIPTION:' + M.icsText(popis));
      if (u.predem > 0) r.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + M.icsText(nazev), 'TRIGGER:-P' + u.predem + 'D', 'END:VALARM');
      r.push('END:VEVENT');
    }
    r.push('END:VCALENDAR');
    return r.map(M.icsZalom).join('\r\n') + '\r\n';
  }

  const API = {
    VERZE, KLIC, TYPY, TYP, PREDLOHY, RADA_ZARUKA, JEDNOTKY: U.JEDNOTKY,
    normPolozka, prazdna, migruj, zPredlohy, stav, serad, filtruj, osoby, souhrn, ics,
    priste: U.priste, posun: U.posun, vyskyty: U.vyskyty, popisIntervalu: U.popisIntervalu, popisZbyva: U.popisZbyva,
    provedeno: U.provedeno, smazZaznam: U.smazZaznam, smazUkol: U.smazUkol, historieUkolu: U.historieUkolu,
    formatDatum: M.formatDatum, formatKc: M.formatKc, dnesIso: M.dnesIso, jeDatum: M.jeDatum, pridejMesice: M.pridejMesice
  };
  if (typeof module !== 'undefined') module.exports = API; else window.TerminyJadro = API;
})();
