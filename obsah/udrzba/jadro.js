/* Domácí údržba a revize – jádro bez DOM (testuje se v node: _test/udrzba_test.js).
   Kalendářní počty a iCalendar bere z jádra Evidence majetku (majetek/jadro.js).
   Obsah: předlohy úkolů, interval → příští termín, stav, výskyty v období, souhrny, ICS, migrace. */
(function () {
  'use strict';
  const M = typeof module !== 'undefined' ? require('../majetek/jadro.js') : window.MajetekJadro;

  const VERZE = 1;
  const KLIC = 'webapp_udrzba';
  const JEDNOTKY = { d: ['den', 'dny', 'dní'], t: ['týden', 'týdny', 'týdnů'], m: ['měsíc', 'měsíce', 'měsíců'], r: ['rok', 'roky', 'let'] };
  const KATEGORIE = [
    { id: 'topeni', nazev: '🔥 Topení a komín' },
    { id: 'voda', nazev: '💧 Voda a odpady' },
    { id: 'elektro', nazev: '⚡ Elektro a bezpečnost' },
    { id: 'spotrebice', nazev: '🧺 Spotřebiče' },
    { id: 'dum', nazev: '🏠 Dům, střecha, okna' },
    { id: 'auto', nazev: '🚗 Auto a doprava' },
    { id: 'domacnost', nazev: '📋 Doklady a domácnost' },
    { id: 'jine', nazev: '🔧 Ostatní' }
  ];

  /* Předlohy – typické intervaly. `povinne` = zákonná povinnost (stav k 10/2026, orientačně – ověřte u odborníka),
     `rada` = doporučení výrobců / dobrá praxe. Interval [počet, jednotka]. */
  const PREDLOHY = [
    { nazev: 'Kontrola kotle na tuhá paliva', kat: 'topeni', int: [3, 'r'], povinne: 'Zákon 201/2012 Sb. o ochraně ovzduší, § 17: kotel na pevná paliva 10–300 kW – kontrola technického stavu a provozu odborně způsobilou osobou 1× za 3 roky; doklad předložit obci na vyžádání.' },
    { nazev: 'Kontrola spalinové cesty (kominík)', kat: 'topeni', int: [1, 'r'], povinne: 'Nařízení vlády 91/2010 Sb.: kontrola spalinové cesty 1× ročně u všech druhů paliv; zpráva od kominíka (oprávněná osoba).' },
    { nazev: 'Čištění komína – tuhá paliva, celoroční provoz', kat: 'topeni', int: [4, 'm'], povinne: 'Nařízení vlády 91/2010 Sb.: spotřebič na pevná paliva do 50 kW – čištění 3× ročně při celoročním provozu (2× při sezónním). Smí i sám uživatel, kontrolu ne.' },
    { nazev: 'Čištění komína – tuhá paliva, sezónní provoz', kat: 'topeni', int: [6, 'm'], povinne: 'Nařízení vlády 91/2010 Sb.: pevná paliva do 50 kW, sezónní provoz – čištění 2× ročně.' },
    { nazev: 'Servisní prohlídka plynového kotle', kat: 'topeni', int: [1, 'r'], rada: 'Výrobci ji obvykle podmiňují zárukou. Seřízení hořáku, kontrola spalin a těsnosti.' },
    { nazev: 'Revize domovního plynovodu', kat: 'topeni', int: [3, 'r'], rada: 'V rodinném domě doporučeno 1× za 3 roky, v bytových domech ji ukládají předpisy o vyhrazených plynových zařízeních (zajišťuje vlastník domu).' },
    { nazev: 'Odvzdušnění radiátorů, kontrola tlaku v soustavě', kat: 'topeni', int: [1, 'r'], rada: 'Před topnou sezónou (září–říjen).' },
    { nazev: 'Vyčištění kamen / krbu a výměna těsnění dvířek', kat: 'topeni', int: [1, 'r'] },
    { nazev: 'Tepelné čerpadlo / klimatizace – vyčistit filtry', kat: 'topeni', int: [3, 'm'] },
    { nazev: 'Tepelné čerpadlo / klimatizace – servis', kat: 'topeni', int: [1, 'r'], rada: 'U větších zařízení s F-plyny je kontrola těsnosti povinná (podle množství chladiva); běžné domácí split jednotky většinou nespadají.' },
    { nazev: 'Rekuperace – výměna filtrů', kat: 'topeni', int: [6, 'm'] },

    { nazev: 'Bojler – odvápnění a kontrola anody', kat: 'voda', int: [2, 'r'], rada: 'U tvrdé vody raději 1× ročně. Opotřebená hořčíková anoda = koroze nádrže.' },
    { nazev: 'Výměna vložky předfiltru vody', kat: 'voda', int: [6, 'm'] },
    { nazev: 'Doplnit sůl do změkčovače', kat: 'voda', int: [1, 'm'] },
    { nazev: 'Rozbor vody ze studny', kat: 'voda', int: [1, 'r'], rada: 'Základní rozbor (dusičnany, bakterie) aspoň 1× ročně, úplný 1× za několik let.' },
    { nazev: 'Vývoz žumpy / septiku', kat: 'voda', int: [3, 'm'], rada: 'Doklady o vývozu uschovat – vodoprávní úřad je může požadovat.' },
    { nazev: 'Domovní ČOV – kontrola a odběr vzorků', kat: 'voda', int: [6, 'm'], rada: 'Podle provozního řádu výrobce a povolení vodoprávního úřadu.' },
    { nazev: 'Zavřít a vypustit venkovní vodu (zazimování)', kat: 'voda', int: [1, 'r'], rada: 'Před prvními mrazy, zjara zase otevřít.' },
    { nazev: 'Protočit hlavní uzávěr vody a ventily', kat: 'voda', int: [1, 'r'], rada: 'Ať v nouzi jdou zavřít.' },
    { nazev: 'Vyčistit sifony a perlátory', kat: 'voda', int: [6, 'm'] },

    { nazev: 'Test detektorů kouře', kat: 'elektro', int: [1, 'm'], rada: 'Tlačítkem; baterii měnit 1× ročně (pokud není desetiletá), celé čidlo po 10 letech.' },
    { nazev: 'Výměna detektoru CO', kat: 'elektro', int: [6, 'r'], rada: 'Čidla CO mají životnost obvykle 5–7 let – datum je na štítku.' },
    { nazev: 'Test proudového chrániče (tlačítko T)', kat: 'elektro', int: [6, 'm'] },
    { nazev: 'Revize elektroinstalace', kat: 'elektro', int: [5, 'r'], rada: 'V rodinném domě není opakovaná revize povinná (povinná je u nové instalace a změn); doporučuje se zhruba po 5–10 letech a při koupi nemovitosti.' },
    { nazev: 'Revize hromosvodu', kat: 'elektro', int: [5, 'r'], rada: 'U rodinného domu doporučeno; u některých staveb ji určuje projekt/stavební povolení.' },
    { nazev: 'Kontrola hasicího přístroje', kat: 'elektro', int: [1, 'r'], rada: 'Domácnost nemá povinnost (ta platí pro firmy – 1× ročně); u doma držených přístrojů kontrolovat tlak a datum dle výrobce.' },
    { nazev: 'Výměna baterií v záložním zdroji / UPS', kat: 'elektro', int: [3, 'r'] },

    { nazev: 'Digestoř – umýt tukový filtr', kat: 'spotrebice', int: [3, 'm'] },
    { nazev: 'Digestoř – vyměnit uhlíkový filtr', kat: 'spotrebice', int: [1, 'r'] },
    { nazev: 'Myčka – vyčistit filtr', kat: 'spotrebice', int: [1, 'm'] },
    { nazev: 'Pračka – čisticí program a sítko čerpadla', kat: 'spotrebice', int: [3, 'm'] },
    { nazev: 'Sušička – vyčistit kondenzátor', kat: 'spotrebice', int: [3, 'm'] },
    { nazev: 'Lednice – vysát mřížku kondenzátoru, vyčistit odtok', kat: 'spotrebice', int: [1, 'r'] },
    { nazev: 'Mraznička – odmrazit', kat: 'spotrebice', int: [1, 'r'] },
    { nazev: 'Kávovar – odvápnění', kat: 'spotrebice', int: [2, 'm'] },
    { nazev: 'Vysavač – vyměnit filtr', kat: 'spotrebice', int: [1, 'r'] },

    { nazev: 'Vyčistit okapy a svody', kat: 'dum', int: [1, 'r'], rada: 'Na podzim po opadu listí.' },
    { nazev: 'Kontrola střechy a oplechování', kat: 'dum', int: [1, 'r'], rada: 'Po zimě – posunuté tašky, prasklé lemování, mech.' },
    { nazev: 'Seřízení a promazání kování oken a dveří', kat: 'dum', int: [1, 'r'] },
    { nazev: 'Kontrola silikonů v koupelně a kuchyni', kat: 'dum', int: [1, 'r'] },
    { nazev: 'Nátěr dřevěných prvků (pergola, plot, okna)', kat: 'dum', int: [3, 'r'] },
    { nazev: 'Údržba garážových vrat (mazání, pružiny)', kat: 'dum', int: [1, 'r'] },

    { nazev: 'Technická kontrola (STK + emise)', kat: 'auto', int: [2, 'r'], povinne: 'Zákon 56/2001 Sb.: osobní auto – první STK 4 roky od registrace, dál každé 2 roky.' },
    { nazev: 'Servis auta (olej, filtry)', kat: 'auto', int: [1, 'r'], rada: 'Podle servisní knížky – často 1 rok nebo daný počet km, co nastane dřív.' },
    { nazev: 'Přezutí pneumatik', kat: 'auto', int: [6, 'm'], povinne: 'Zákon 361/2000 Sb.: od 1. 11. do 31. 3. zimní pneumatiky, pokud je na silnici zimní povaha (sníh, led, náledí) nebo ji lze očekávat.' },
    { nazev: 'Povinné ručení – výročí smlouvy', kat: 'auto', int: [1, 'r'], rada: 'Výpověď ke dni výročí aspoň 6 týdnů předem – hlídejte s předstihem.' },
    { nazev: 'Dálniční známka', kat: 'auto', int: [1, 'r'], rada: 'Roční elektronická známka platí 365 dní od zvoleného dne.' },
    { nazev: 'Lékárnička v autě – kontrola expirace', kat: 'auto', int: [1, 'r'] },
    { nazev: 'Kolo – servis (brzdy, řetěz, převody)', kat: 'auto', int: [1, 'r'] },

    { nazev: 'Domácí lékárnička – vyřadit prošlé léky', kat: 'domacnost', int: [1, 'r'], rada: 'Prošlé léky vrátit do lékárny.' },
    { nazev: 'Kontrola pojištění domu a domácnosti', kat: 'domacnost', int: [1, 'r'], rada: 'Odpovídá pojistná částka současné hodnotě?' },
    { nazev: 'Záloha dat z počítače a telefonu', kat: 'domacnost', int: [1, 'm'] },
    { nazev: 'Platnost dokladů (OP, pas, řidičák)', kat: 'domacnost', int: [10, 'r'], rada: 'Termín nastavte na datum konce platnosti mínus pár měsíců.' },
    { nazev: 'Odečty energií', kat: 'domacnost', int: [1, 'm'], rada: 'Stav měřidel si zapisujte ve stránce Domácí odečty.' }
  ];

  /* ---------- interval a termíny ---------- */
  function sklon(n, j) { const t = JEDNOTKY[j]; return n === 1 ? t[0] : n >= 2 && n <= 4 ? t[1] : t[2]; }
  function popisIntervalu(i) {
    if (!i || !(i.n > 0) || !JEDNOTKY[i.j]) return 'jednorázově';
    if (i.n === 1) return { d: 'denně', t: 'každý týden', m: 'každý měsíc', r: 'každý rok' }[i.j];
    return 'každé ' + i.n + ' ' + sklon(i.n, i.j);
  }
  function posun(iso, i, krat) {
    const k = (krat == null ? 1 : krat) * i.n;
    if (i.j === 'd') return M.pridejDny(iso, k);
    if (i.j === 't') return M.pridejDny(iso, 7 * k);
    if (i.j === 'm') return M.pridejMesice(iso, k);
    return M.pridejMesice(iso, 12 * k);
  }
  function maInterval(u) { return !!(u.interval && u.interval.n > 0 && JEDNOTKY[u.interval.j]); }
  /* Příští termín: poslední provedení + interval; nikdy neprovedeno → zadaný první termín (`od`). */
  function priste(u) {
    if (u.archiv) return null;
    if (M.jeDatum(u.posledni)) return maInterval(u) ? posun(u.posledni, u.interval) : null;
    return M.jeDatum(u.od) ? u.od : null;
  }
  /* stav: 'po' (po termínu), 'brzy' (do `predem` dní), 'ok', 'hotovo' (jednorázový provedený), 'nezadano', 'archiv' */
  function stav(u, dnes) {
    if (u.archiv) return { stav: 'archiv', zbyva: null, termin: null };
    const t = priste(u);
    if (!t) return { stav: M.jeDatum(u.posledni) ? 'hotovo' : 'nezadano', zbyva: null, termin: null };
    const zbyva = M.rozdilDni(dnes, t);
    const predem = u.predem >= 0 ? u.predem : 14;
    return { stav: zbyva < 0 ? 'po' : zbyva <= predem ? 'brzy' : 'ok', zbyva, termin: t };
  }
  function popisZbyva(z) {
    if (z == null) return '';
    if (z === 0) return 'dnes';
    if (z === 1) return 'zítra';
    if (z === -1) return 'včera';
    const a = Math.abs(z);
    return z > 0 ? 'za ' + a + ' ' + (a < 5 ? 'dny' : 'dní') : 'před ' + a + ' dny';
  }
  /* Termíny úkolu v intervalu [od, do] (včetně) – pro plán na rok. Po termínu se počítá od příštího (zpožděného) termínu. */
  function vyskyty(u, od, d) {
    const t = priste(u); if (!t) return [];
    const out = [];
    let x = t, k = 0;
    if (!maInterval(u)) return t >= od && t <= d ? [t] : [];
    while (x <= d && k < 1000) {
      if (x >= od) out.push(x);
      k++; x = posun(t, u.interval, k);
    }
    return out;
  }
  const PORADI_STAVU = { po: 0, brzy: 1, ok: 2, nezadano: 3, hotovo: 4, archiv: 5 };
  function serad(ukoly, dnes) {
    return ukoly.map(u => ({ u, s: stav(u, dnes) })).sort((a, b) =>
      PORADI_STAVU[a.s.stav] - PORADI_STAVU[b.s.stav] ||
      (a.s.termin && b.s.termin ? (a.s.termin < b.s.termin ? -1 : a.s.termin > b.s.termin ? 1 : 0) : 0) ||
      a.u.nazev.localeCompare(b.u.nazev, 'cs'));
  }
  function filtruj(ukoly, dnes, f) {
    f = f || {};
    const q = M.bezDiakritiky(f.text || '').trim();
    return ukoly.filter(u => {
      const s = stav(u, dnes).stav;
      if (f.stav === 'archiv') { if (s !== 'archiv') return false; }
      else if (s === 'archiv') return false;
      else if (f.stav === 'pozornost' && s !== 'po' && s !== 'brzy') return false;
      else if (f.stav === 'povinne' && !u.povinne) return false;
      if (f.kat && u.kat !== f.kat) return false;
      if (q && !M.bezDiakritiky([u.nazev, u.poznamka, u.misto, u.povinne].join(' ')).includes(q)) return false;
      return true;
    });
  }
  function souhrn(data, dnes) {
    const r = { po: 0, brzy: 0, ok: 0, nezadano: 0, celkem: 0, nakladyRok: 0, nakladyLetos: 0, provedeniLetos: 0 };
    for (const u of data.ukoly) {
      const s = stav(u, dnes).stav;
      if (s === 'archiv') continue;
      r.celkem++; if (r[s] != null) r[s]++;
    }
    const rok = dnes.slice(0, 4), predRokem = M.pridejMesice(dnes, -12);
    for (const h of data.historie) {
      const c = Number.isFinite(h.cena) ? h.cena : 0;
      if (h.datum.slice(0, 4) === rok) { r.nakladyLetos += c; r.provedeniLetos++; }
      if (h.datum > predRokem && h.datum <= dnes) r.nakladyRok += c;
    }
    return r;
  }

  /* ---------- úpravy dat ---------- */
  function normInterval(i) {
    const n = Math.round(Number(i && i.n));
    return n > 0 && JEDNOTKY[i.j] ? { n: Math.min(n, 999), j: i.j } : null;
  }
  function normCena(v) {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : M.cislo(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function normUkol(u) {
    u = u || {};
    const kat = KATEGORIE.some(k => k.id === u.kat) ? u.kat : 'jine';
    return {
      id: String(u.id || M.novyId('U')),
      nazev: String(u.nazev || '').trim().slice(0, 200) || 'Bez názvu',
      kat,
      interval: normInterval(u.interval),
      posledni: M.jeDatum(u.posledni) ? u.posledni : '',
      od: M.jeDatum(u.od) ? u.od : '',
      predem: Number.isFinite(+u.predem) && +u.predem >= 0 ? Math.min(Math.round(+u.predem), 365) : 14,
      misto: String(u.misto || '').slice(0, 120),
      poznamka: String(u.poznamka || '').slice(0, 4000),
      povinne: String(u.povinne || '').slice(0, 1000),
      rada: String(u.rada || '').slice(0, 1000),
      kontakt: String(u.kontakt || '').slice(0, 300),
      archiv: !!u.archiv
    };
  }
  function normZaznam(h) {
    return {
      id: String(h.id || M.novyId('H')),
      ukol: String(h.ukol || ''),
      datum: M.jeDatum(h.datum) ? h.datum : '',
      cena: normCena(h.cena),
      kdo: String(h.kdo || '').slice(0, 200),
      pozn: String(h.pozn || '').slice(0, 2000)
    };
  }
  function prazdna() { return { verze: VERZE, ukoly: [], historie: [] }; }
  function migruj(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.ukoly)) return prazdna();
    const ukoly = d.ukoly.map(normUkol);
    const ids = new Set(ukoly.map(u => u.id));
    const historie = (Array.isArray(d.historie) ? d.historie : []).map(normZaznam).filter(h => h.datum && ids.has(h.ukol));
    return { verze: VERZE, ukoly, historie };
  }
  function zPredlohy(p, dnes) {
    return normUkol({ nazev: p.nazev, kat: p.kat, interval: { n: p.int[0], j: p.int[1] }, povinne: p.povinne || '', rada: p.rada || '', od: dnes });
  }
  /* Zapíše provedení: přidá záznam do historie a posune „poslední“ (jen dopředu – starší zápis termín nevrací). */
  function provedeno(data, idUkolu, zaznam) {
    const u = data.ukoly.find(x => x.id === idUkolu);
    if (!u) throw new Error('Úkol neexistuje');
    const h = normZaznam(Object.assign({}, zaznam, { ukol: idUkolu }));
    if (!h.datum) throw new Error('Neplatné datum');
    data.historie.push(h);
    if (!u.posledni || h.datum > u.posledni) u.posledni = h.datum;
    return h;
  }
  /* Po smazání záznamu přepočítá „poslední“ z historie (bez historie zůstane ručně zadané datum). */
  function smazZaznam(data, idZaznamu) {
    const i = data.historie.findIndex(h => h.id === idZaznamu);
    if (i < 0) return false;
    const [h] = data.historie.splice(i, 1);
    const u = data.ukoly.find(x => x.id === h.ukol);
    if (u && u.posledni === h.datum) {
      const zbyle = data.historie.filter(x => x.ukol === u.id).map(x => x.datum).sort();
      u.posledni = zbyle.length ? zbyle[zbyle.length - 1] : '';
    }
    return true;
  }
  function smazUkol(data, id) {
    data.ukoly = data.ukoly.filter(u => u.id !== id);
    data.historie = data.historie.filter(h => h.ukol !== id);
  }
  function historieUkolu(data, id) { return data.historie.filter(h => h.ukol === id).sort((a, b) => a.datum < b.datum ? 1 : -1); }

  /* ---------- iCalendar: celodenní událost v příštím termínu, připomínka `predem` dní předem ---------- */
  function ics(ukoly, dnes, razitko) {
    const r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp//Domaci udrzba//CS', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    const ts = razitko || '20000101T000000Z';
    for (const u of ukoly) {
      const t = priste(u); if (!t) continue;
      const d = t.replace(/-/g, '');
      const popis = [popisIntervalu(u.interval), u.posledni ? 'Naposledy: ' + M.formatDatum(u.posledni) : '', u.misto, u.kontakt, u.povinne, u.poznamka].filter(Boolean).join('\n');
      r.push('BEGIN:VEVENT', 'UID:udrzba-' + u.id + '-' + d + '@udrzba.local', 'DTSTAMP:' + ts,
        'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + M.pridejDny(t, 1).replace(/-/g, ''),
        'SUMMARY:' + M.icsText('🔧 ' + u.nazev), 'DESCRIPTION:' + M.icsText(popis));
      if (u.predem > 0) r.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + M.icsText('Údržba: ' + u.nazev), 'TRIGGER:-P' + u.predem + 'D', 'END:VALARM');
      r.push('END:VEVENT');
    }
    r.push('END:VCALENDAR');
    return r.map(M.icsZalom).join('\r\n') + '\r\n';
  }

  const API = {
    VERZE, KLIC, JEDNOTKY, KATEGORIE, PREDLOHY,
    popisIntervalu, posun, priste, stav, popisZbyva, vyskyty, serad, filtruj, souhrn,
    normUkol, normZaznam, normCena, prazdna, migruj, zPredlohy, provedeno, smazZaznam, smazUkol, historieUkolu, ics,
    formatDatum: M.formatDatum, formatKc: M.formatKc, dnesIso: M.dnesIso, jeDatum: M.jeDatum, pridejMesice: M.pridejMesice
  };
  if (typeof module !== 'undefined') module.exports = API; else window.UdrzbaJadro = API;
})();
