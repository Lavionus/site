/* Generátor protokolů – jádro (šablony, náležitosti, kontrola úplnosti, převod z modelového případu).
   Bez DOM, testovatelné v node: _test/protocol_gen_test.js.
   Právní odkazy: zákon č. 141/1961 Sb., trestní řád (TŘ). Ověřeno k datu 11/2026 – před použitím ověř
   aktuální znění. Kde si odstavcem nejsme jistí, uvádí se jen paragraf. Texty poučení jsou shrnutí
   vlastními slovy, ne úřední formulace. Položky „praxe“ nejsou zákonné náležitosti, ale kriminalistická
   a úřední zvyklost. */
(function (koren) {
  'use strict';

  const OVERENO = '11/2026';

  /* ---------- pole formuláře ----------
     typ: text | area | date | time | check; spolecna pole má každá šablona */
  const SPOLECNA_POLE = [
    { id: 'organ', label: 'Označení orgánu (útvar, adresa)', typ: 'text', ph: 'Policie ČR, KŘP …, SKPV, oddělení …' },
    { id: 'cj', label: 'Číslo jednací / ČVS', typ: 'text', ph: 'KRPA-1234/TČ-2026' },
    { id: 'datum', label: 'Datum úkonu', typ: 'date' },
    { id: 'casOd', label: 'Zahájeno v', typ: 'time' },
    { id: 'casDo', label: 'Ukončeno v', typ: 'time' },
    { id: 'misto', label: 'Místo úkonu', typ: 'text', ph: 'adresa, místnost, popis místa' },
    { id: 'predmet', label: 'Předmět úkonu', typ: 'text' },
    { id: 'sepsal', label: 'Úkon provedl a protokol sepsal (jméno, hodnost, funkce)', typ: 'text' }
  ];
  const ZAVER = { id: 'zaver', label: 'Závěr – přečtení, námitky, opravy a doplňky', typ: 'area',
    vychozi: 'Protokol byl přítomným osobám předložen k přečtení. Námitky proti obsahu nebyly vzneseny, opravy ani doplňky nebyly provedeny.' };

  // poučení – shrnutí vlastními slovy (do náhledu i jako popisek zaškrtávátka)
  const POUCENI = {
    svedekVyznam: 'Svědek byl poučen o významu svědecké výpovědi, o svých právech a povinnostech a o povinnosti vypovídat pravdivě a nic nezamlčet.',
    svedekKriva: 'Svědek byl upozorněn na trestní následky křivé výpovědi (§ 346 trestního zákoníku).',
    svedekOdeprit: 'Svědek byl poučen, že může odepřít výpověď jako příbuzný obviněného v pokolení přímém, jeho sourozenec, osvojitel, osvojenec, manžel, partner nebo druh, a dále tehdy, kdyby výpovědí způsobil nebezpečí trestního stíhání sobě nebo osobám blízkým.',
    obvVypoved: 'Obviněný byl poučen, že se může vyjádřit ke všem skutečnostem, které se mu kladou za vinu, i k důkazům o nich, že však není povinen vypovídat a nesmí být k výpovědi ani k doznání nijak donucován.',
    obvObhajce: 'Obviněný byl poučen o právu zvolit si obhájce a radit se s ním, a to i během úkonů, a o tom, v jakých případech musí mít obhájce (nutná obhajoba).',
    obvDalsi: 'Obviněný byl poučen o právu navrhovat důkazy, podávat žádosti a opravné prostředky a nahlížet do spisu v rozsahu podle zákona.',
    obvJazyk: 'Obviněný byl poučen o právu jednat v mateřském jazyce nebo v jazyce, který ovládá, a o právu na tlumočníka.',
    vydaniVyzva: 'Osoba byla vyzvána k vydání věci důležité pro trestní řízení a upozorněna, že nevyhoví-li výzvě, může jí být věc odňata, případně uložena pořádková pokuta.',
    vysvOdeprit: 'Osoba byla poučena, že vysvětlení může odepřít, pokud by jím způsobila nebezpečí trestního stíhání sobě nebo osobám blízkým, a že vysvětlení nesmí být požadováno, pokud by jím porušila zákonem uloženou nebo uznanou povinnost mlčenlivosti.',
    vysvAdvokat: 'Osoba byla poučena o právu na právní pomoc advokáta při podání vysvětlení.'
  };

  /* ---------- pomocné testy náležitostí ---------- */
  const vypl = id => p => !!String((p.pole || {})[id] || '').trim();
  const zatrz = id => p => !!(p.pole || {})[id];
  const osobaRole = re => p => (p.osoby || []).find(o => re.test(o.role || '') && String(o.jmeno || '').trim());
  const maOsobu = re => p => !!osobaRole(re)(p);
  const veciOk = p => (p.veci || []).length > 0 && p.veci.every(v => String(v.popis || '').trim());

  const RE = {
    svedek: /svěd/i, obvineny: /obvin/i, obhajce: /obhájc|obhájk/i, tlumocnik: /tlumočn/i,
    vydal: /vydáv|vydal/i, odnato: /odňat|odnět|držitel/i, nezucastnena: /nezúčastněn/i,
    vysvetleni: /vysvětl/i, ospod: /sociáln|OSPOD|pedagog|psycholog/i
  };

  // společné náležitosti protokolu (§ 55 TŘ)
  const SPOLECNE_NAL = [
    { id: 'organ', text: 'Označení orgánu činného v trestním řízení', par: '§ 55', povinne: true, pole: 'organ', ok: vypl('organ') },
    { id: 'misto', text: 'Místo úkonu', par: '§ 55', povinne: true, pole: 'misto', ok: vypl('misto') },
    { id: 'datum', text: 'Datum úkonu', par: '§ 55', povinne: true, pole: 'datum', ok: vypl('datum') },
    { id: 'casOd', text: 'Čas zahájení úkonu', par: '§ 55', povinne: true, pole: 'casOd', ok: vypl('casOd') },
    { id: 'predmet', text: 'Předmět úkonu', par: '§ 55', povinne: true, pole: 'predmet', ok: vypl('predmet') },
    { id: 'osoby', text: 'Jména a příjmení zúčastněných osob a jejich role v úkonu', par: '§ 55', povinne: true, pole: 'osoby',
      ok: p => (p.osoby || []).length > 0 && p.osoby.every(o => String(o.jmeno || '').trim() && String(o.role || '').trim()) },
    { id: 'prubeh', text: 'Popis průběhu úkonu, z něhož je patrné dodržení zákona', par: '§ 55', povinne: true, pole: 'prubeh', ok: vypl('prubeh') },
    { id: 'sepsal', text: 'Kdo úkon provedl a protokol sepsal', par: '§ 55', povinne: true, pole: 'sepsal', ok: vypl('sepsal') },
    { id: 'cj', text: 'Číslo jednací / ČVS', par: 'praxe', povinne: false, pole: 'cj', ok: vypl('cj') },
    { id: 'casDo', text: 'Čas ukončení úkonu', par: 'praxe', povinne: false, pole: 'casDo', ok: vypl('casDo') },
    { id: 'zaver', text: 'Závěr: přečtení protokolu, námitky, opravy a doplňky, podpisy', par: '§ 55 a násl.', povinne: false, pole: 'zaver', ok: vypl('zaver') }
  ];

  /* ---------- šablony ---------- */
  const SABLONY = {
    ohledani: {
      nazev: 'Protokol o ohledání (místa činu)', titul: 'PROTOKOL O OHLEDÁNÍ MÍSTA ČINU',
      predmet: 'ohledání místa činu', par: '§ 113 TŘ',
      popis: 'Ohledání věci, místa nebo těla k zjištění skutečností důležitých pro trestní řízení. Ohledání místa činu bývá neodkladným nebo neopakovatelným úkonem.',
      role: ['vedoucí ohledání', 'kriminalistický technik', 'nezúčastněná osoba', 'soudce', 'znalec', 'poškozený', 'svědek', 'tlumočník'],
      pole: [
        { id: 'povaha', label: 'Věc / povaha události', typ: 'text', ph: 'např. vloupání do prodejny' },
        { id: 'rozsah', label: 'Rozsah ohledaného prostoru', typ: 'area' },
        { id: 'podminky', label: 'Podmínky (počasí, osvětlení, teplota)', typ: 'text' },
        { id: 'stav', label: 'Výchozí stav a změny před ohledáním (kdo místo střežil, kdo vstoupil)', typ: 'area' },
        { id: 'neodkladny', label: 'Jde o neodkladný nebo neopakovatelný úkon před zahájením trestního stíhání', typ: 'check' },
        { id: 'prubeh', label: 'Popis zjištěného stavu a průběhu ohledání', typ: 'area', velke: true },
        { id: 'dokumentace', label: 'Dokumentace (fotografie, video, náčrt, plánek)', typ: 'text' }
      ],
      veci: true, vecLabel: 'Zajištěné stopy a věci',
      nalezitosti: [
        { id: 'rozsah', text: 'Rozsah a vymezení ohledaného místa', par: 'praxe', povinne: false, pole: 'rozsah', ok: vypl('rozsah') },
        { id: 'stav', text: 'Výchozí stav místa a změny před ohledáním', par: 'praxe', povinne: false, pole: 'stav', ok: vypl('stav') },
        { id: 'podminky', text: 'Podmínky ohledání (počasí, osvětlení)', par: 'praxe', povinne: false, pole: 'podminky', ok: vypl('podminky') },
        { id: 'dokumentace', text: 'Odkaz na fotodokumentaci a náčrt', par: 'praxe', povinne: false, pole: 'dokumentace', ok: vypl('dokumentace') },
        { id: 'veci', text: 'Seznam zajištěných stop s číslem, popisem a obalem', par: 'praxe', povinne: false, pole: 'veci', ok: veciOk },
        { id: 'nezucastnena', text: 'U neodkladného/neopakovatelného úkonu před zahájením trestního stíhání přibrat nezúčastněnou osobu, případně soudce (ověř aktuální znění)', par: '§ 158a', povinne: false, pole: 'osoby',
          kdy: zatrz('neodkladny'), ok: p => maOsobu(RE.nezucastnena)(p) || maOsobu(/soudc/i)(p) }
      ]
    },
    svedek: {
      nazev: 'Protokol o výslechu svědka', titul: 'PROTOKOL O VÝSLECHU SVĚDKA',
      predmet: 'výslech svědka', par: '§ 97 a násl. TŘ',
      popis: 'Svědek je povinen vypovídat pravdivě a nic nezamlčet. Před výslechem se zjišťuje totožnost a poměr k obviněnému a svědek se poučuje.',
      role: ['svědek', 'vyslýchající', 'zapisovatel', 'tlumočník', 'zmocněnec svědka', 'zástupce OSPOD', 'zákonný zástupce'],
      pole: [
        { id: 'totoznost', label: 'Totožnost ověřena podle (doklad, číslo)', typ: 'text' },
        { id: 'pomer', label: 'Poměr svědka k obviněnému a ke stranám', typ: 'text', ph: 'např. bez vztahu / soused / příbuzný' },
        { id: 'pouceniVyznam', label: POUCENI.svedekVyznam, typ: 'check', pouceni: true },
        { id: 'pouceniKriva', label: POUCENI.svedekKriva, typ: 'check', pouceni: true },
        { id: 'pouceniOdeprit', label: POUCENI.svedekOdeprit, typ: 'check', pouceni: true },
        { id: 'vyjadreni', label: 'Vyjádření svědka k poučení (porozuměl, chce/nechce vypovídat)', typ: 'text' },
        { id: 'mladistvy', label: 'Svědek je mladší 18 let', typ: 'check' },
        { id: 'jazyk', label: 'Svědek neovládá český jazyk (je třeba tlumočník)', typ: 'check' },
        { id: 'prubeh', label: 'Souvislá výpověď svědka (pokud možno doslovně)', typ: 'area', velke: true },
        { id: 'otazky', label: 'Otázky a odpovědi (otázka – odpověď)', typ: 'area' }
      ],
      nalezitosti: [
        { id: 'svedek', text: 'Svědek uveden jménem s rolí „svědek“ a datem narození', par: '§ 101', povinne: true, pole: 'osoby',
          ok: p => { const o = osobaRole(RE.svedek)(p); return !!(o && String(o.narozeni || '').trim()); } },
        { id: 'totoznost', text: 'Zjištění totožnosti svědka', par: '§ 101', povinne: true, pole: 'totoznost', ok: vypl('totoznost') },
        { id: 'pomer', text: 'Poměr svědka k obviněnému a ke stranám', par: '§ 101', povinne: true, pole: 'pomer', ok: vypl('pomer') },
        { id: 'pouceniVyznam', text: 'Poučení o významu výpovědi, právech a povinnostech', par: '§ 101', povinne: true, pole: 'pouceniVyznam', ok: zatrz('pouceniVyznam') },
        { id: 'pouceniKriva', text: 'Upozornění na trestní následky křivé výpovědi', par: '§ 101', povinne: true, pole: 'pouceniKriva', ok: zatrz('pouceniKriva') },
        { id: 'pouceniOdeprit', text: 'Poučení o právu odepřít výpověď', par: '§ 100, § 101', povinne: true, pole: 'pouceniOdeprit', ok: zatrz('pouceniOdeprit') },
        { id: 'vyjadreni', text: 'Vyjádření svědka k poučení', par: 'praxe', povinne: false, pole: 'vyjadreni', ok: vypl('vyjadreni') },
        { id: 'otazky', text: 'Zaznamenané otázky a odpovědi', par: '§ 55', povinne: false, pole: 'otazky', ok: vypl('otazky') },
        { id: 'tlumocnik', text: 'Přibraný tlumočník (svědek neovládá jazyk)', par: '§ 28', povinne: true, pole: 'osoby', kdy: zatrz('jazyk'), ok: maOsobu(RE.tlumocnik) },
        { id: 'mladistvy', text: 'U svědka mladšího 18 let posoudit přibrání OSPOD nebo osoby se zkušenostmi s výchovou mládeže', par: '§ 102', povinne: false, pole: 'osoby',
          kdy: zatrz('mladistvy'), ok: maOsobu(RE.ospod) }
      ]
    },
    obvineny: {
      nazev: 'Protokol o výslechu obviněného', titul: 'PROTOKOL O VÝSLECHU OBVINĚNÉHO',
      predmet: 'výslech obviněného', par: '§ 91–95 TŘ',
      popis: 'Na počátku prvního výslechu se zjišťuje totožnost obviněného a obviněný se poučuje o svých právech. Obviněný nesmí být k výpovědi ani doznání donucován.',
      role: ['obviněný', 'vyslýchající', 'obhájce', 'zapisovatel', 'tlumočník', 'zákonný zástupce', 'státní zástupce'],
      pole: [
        { id: 'prvni', label: 'Jde o první výslech obviněného', typ: 'check' },
        { id: 'usneseni', label: 'Usnesení o zahájení trestního stíhání (číslo, kdy doručeno)', typ: 'text' },
        { id: 'pouceniVypoved', label: POUCENI.obvVypoved, typ: 'check', pouceni: true },
        { id: 'pouceniObhajce', label: POUCENI.obvObhajce, typ: 'check', pouceni: true },
        { id: 'pouceniDalsi', label: POUCENI.obvDalsi, typ: 'check', pouceni: true },
        { id: 'pouceniJazyk', label: POUCENI.obvJazyk, typ: 'check', pouceni: true },
        { id: 'vyjadreni', label: 'Vyjádření obviněného k poučení (porozuměl, chce/nechce vypovídat, obhájce)', typ: 'text' },
        { id: 'nutna', label: 'Jde o případ nutné obhajoby', typ: 'check' },
        { id: 'jazyk', label: 'Obviněný neovládá český jazyk (je třeba tlumočník)', typ: 'check' },
        { id: 'prubeh', label: 'Výpověď obviněného (souvislé vylíčení, pokud možno doslovně)', typ: 'area', velke: true },
        { id: 'otazky', label: 'Otázky a odpovědi, případná konfrontace s důkazy', typ: 'area' }
      ],
      nalezitosti: [
        { id: 'obvineny', text: 'Obviněný uveden jménem s rolí „obviněný“, datem narození a bydlištěm', par: '§ 55, § 91', povinne: true, pole: 'osoby',
          ok: p => { const o = osobaRole(RE.obvineny)(p); return !!(o && String(o.narozeni || '').trim() && String(o.adresa || '').trim()); } },
        { id: 'pouceniVypoved', text: 'Poučení o právu vyjádřit se a nevypovídat; zákaz donucování', par: '§ 33, § 91, § 92', povinne: true, pole: 'pouceniVypoved', ok: zatrz('pouceniVypoved') },
        { id: 'pouceniObhajce', text: 'Poučení o právu zvolit si obhájce a radit se s ním', par: '§ 33, § 91', povinne: true, pole: 'pouceniObhajce', ok: zatrz('pouceniObhajce') },
        { id: 'pouceniDalsi', text: 'Poučení o dalších právech obviněného', par: '§ 33', povinne: false, pole: 'pouceniDalsi', ok: zatrz('pouceniDalsi') },
        { id: 'pouceniJazyk', text: 'Poučení o právu na tlumočníka a jednání v jazyce, který ovládá', par: '§ 2, § 28', povinne: false, pole: 'pouceniJazyk', ok: zatrz('pouceniJazyk') },
        { id: 'usneseni', text: 'Usnesení o zahájení trestního stíhání doručeno nejpozději na počátku prvního výslechu', par: '§ 160', povinne: false, pole: 'usneseni',
          kdy: zatrz('prvni'), ok: vypl('usneseni') },
        { id: 'vyjadreni', text: 'Vyjádření obviněného k poučení', par: 'praxe', povinne: false, pole: 'vyjadreni', ok: vypl('vyjadreni') },
        { id: 'otazky', text: 'Zaznamenané otázky a odpovědi', par: '§ 55', povinne: false, pole: 'otazky', ok: vypl('otazky') },
        { id: 'obhajce', text: 'Obhájce (nutná obhajoba)', par: '§ 36', povinne: true, pole: 'osoby', kdy: zatrz('nutna'), ok: maOsobu(RE.obhajce) },
        { id: 'tlumocnik', text: 'Přibraný tlumočník (obviněný neovládá jazyk)', par: '§ 28', povinne: true, pole: 'osoby', kdy: zatrz('jazyk'), ok: maOsobu(RE.tlumocnik) }
      ]
    },
    vydani: {
      nazev: 'Protokol o vydání věci', titul: 'PROTOKOL O VYDÁNÍ VĚCI',
      predmet: 'vydání věci důležité pro trestní řízení', par: '§ 78 TŘ',
      popis: 'Kdo má u sebe věc důležitou pro trestní řízení, je povinen ji na vyzvání vydat. Osobě, která věc vydala, se vydá potvrzení o převzetí nebo opis protokolu.',
      role: ['osoba vydávající věc', 'převzal (policista)', 'nezúčastněná osoba', 'tlumočník', 'zástupce právnické osoby'],
      pole: [
        { id: 'pouceniVyzva', label: POUCENI.vydaniVyzva, typ: 'check', pouceni: true },
        { id: 'prubeh', label: 'Průběh vydání (kdo, kde, za jakých okolností věc vydal)', typ: 'area', velke: true },
        { id: 'potvrzeni', label: 'Osobě bylo vydáno potvrzení o převzetí věci nebo opis protokolu', typ: 'check' },
        { id: 'vyjadreni', label: 'Vyjádření osoby (původ věci, vlastnictví, námitky)', typ: 'text' }
      ],
      veci: true, vecLabel: 'Vydané věci',
      nalezitosti: [
        { id: 'vydal', text: 'Osoba, která věc vydala (role „osoba vydávající věc“)', par: '§ 78', povinne: true, pole: 'osoby', ok: maOsobu(RE.vydal) },
        { id: 'pouceniVyzva', text: 'Výzva k vydání věci a upozornění na následky nevydání', par: '§ 78', povinne: true, pole: 'pouceniVyzva', ok: zatrz('pouceniVyzva') },
        { id: 'veci', text: 'Přesný popis vydaných věcí (aby je nebylo možné zaměnit)', par: '§ 55, § 78', povinne: true, pole: 'veci', ok: veciOk },
        { id: 'potvrzeni', text: 'Potvrzení o převzetí věci nebo opis protokolu', par: '§ 79', povinne: true, pole: 'potvrzeni', ok: zatrz('potvrzeni') },
        { id: 'obal', text: 'Obal a zajištění proti záměně (pečeť, číslo)', par: 'praxe', povinne: false, pole: 'veci', ok: p => (p.veci || []).length > 0 && p.veci.every(v => String(v.obal || '').trim()) },
        { id: 'vyjadreni', text: 'Vyjádření osoby k věci', par: 'praxe', povinne: false, pole: 'vyjadreni', ok: vypl('vyjadreni') }
      ]
    },
    odneti: {
      nazev: 'Protokol o odnětí věci', titul: 'PROTOKOL O ODNĚTÍ VĚCI',
      predmet: 'odnětí věci důležité pro trestní řízení', par: '§ 79 TŘ',
      popis: 'Není-li věc vydána na vyzvání, může být odňata na základě příkazu. Policejní orgán potřebuje k příkazu předchozí souhlas státního zástupce; bez něj jen, pokud ho nelze získat předem a věc nesnese odkladu.',
      role: ['osoba, které byla věc odňata', 'odňal (policista)', 'nezúčastněná osoba', 'tlumočník'],
      pole: [
        { id: 'vyzva', label: 'Předchozí výzva k vydání a proč věc nebyla vydána', typ: 'text' },
        { id: 'prikaz', label: 'Příkaz k odnětí (kdo vydal, číslo, datum; u policejního orgánu souhlas státního zástupce)', typ: 'text' },
        { id: 'bezPrikazu', label: 'Odňato bez předchozího příkazu/souhlasu (věc nesnesla odkladu)', typ: 'check' },
        { id: 'duvodBez', label: 'Důvod, proč příkaz nebo souhlas nebylo možné získat předem', typ: 'text' },
        { id: 'prubeh', label: 'Průběh odnětí', typ: 'area', velke: true },
        { id: 'potvrzeni', label: 'Osobě bylo vydáno potvrzení o převzetí věci nebo opis protokolu', typ: 'check' },
        { id: 'vyjadreni', label: 'Vyjádření osoby (námitky, původ věci)', typ: 'text' }
      ],
      veci: true, vecLabel: 'Odňaté věci',
      nalezitosti: [
        { id: 'odnato', text: 'Osoba, které byla věc odňata', par: '§ 79', povinne: true, pole: 'osoby', ok: maOsobu(RE.odnato) },
        { id: 'prikaz', text: 'Příkaz k odnětí, nebo důvod odnětí bez předchozího příkazu', par: '§ 79', povinne: true, pole: 'prikaz',
          ok: p => vypl('prikaz')(p) || (zatrz('bezPrikazu')(p) && vypl('duvodBez')(p)) },
        { id: 'veci', text: 'Přesný popis odňatých věcí (aby je nebylo možné zaměnit)', par: '§ 55, § 79', povinne: true, pole: 'veci', ok: veciOk },
        { id: 'potvrzeni', text: 'Potvrzení o převzetí věci nebo opis protokolu', par: '§ 79', povinne: true, pole: 'potvrzeni', ok: zatrz('potvrzeni') },
        { id: 'vyzva', text: 'Předchozí výzva k vydání (věc nebyla vydána)', par: '§ 79', povinne: false, pole: 'vyzva', ok: vypl('vyzva') },
        { id: 'nezucastnena', text: 'Přibraná nezúčastněná osoba (ověř, zda ji úkon vyžaduje)', par: '§ 79', povinne: false, pole: 'osoby', ok: maOsobu(RE.nezucastnena) },
        { id: 'souhlas', text: 'Dodatečný příkaz/souhlas po odnětí bez předchozího příkazu', par: '§ 79', povinne: false, pole: 'prikaz', kdy: zatrz('bezPrikazu'), ok: vypl('prikaz') },
        { id: 'obal', text: 'Obal a zajištění proti záměně (pečeť, číslo)', par: 'praxe', povinne: false, pole: 'veci', ok: p => (p.veci || []).length > 0 && p.veci.every(v => String(v.obal || '').trim()) }
      ]
    },
    vysvetleni: {
      nazev: 'Úřední záznam o podání vysvětlení', titul: 'ÚŘEDNÍ ZÁZNAM O PODÁNÍ VYSVĚTLENÍ',
      predmet: 'podání vysvětlení', par: '§ 158 odst. 6 TŘ',
      popis: 'Podání vysvětlení není výslech; sepisuje se o něm záznam, ne protokol. Jako důkaz v řízení před soudem lze záznam použít jen v případech, které stanoví zákon.',
      role: ['podávající vysvětlení', 'policista', 'advokát', 'tlumočník', 'zákonný zástupce'],
      pole: [
        { id: 'totoznost', label: 'Totožnost ověřena podle (doklad, číslo)', typ: 'text' },
        { id: 'pouceniOdeprit', label: POUCENI.vysvOdeprit, typ: 'check', pouceni: true },
        { id: 'pouceniAdvokat', label: POUCENI.vysvAdvokat, typ: 'check', pouceni: true },
        { id: 'prubeh', label: 'Obsah vysvětlení', typ: 'area', velke: true }
      ],
      nalezitosti: [
        { id: 'osoba', text: 'Osoba podávající vysvětlení', par: '§ 158', povinne: true, pole: 'osoby', ok: maOsobu(RE.vysvetleni) },
        { id: 'pouceniOdeprit', text: 'Poučení o možnosti odepřít vysvětlení a o mlčenlivosti', par: '§ 158', povinne: true, pole: 'pouceniOdeprit', ok: zatrz('pouceniOdeprit') },
        { id: 'pouceniAdvokat', text: 'Poučení o právu na právní pomoc advokáta', par: '§ 158', povinne: false, pole: 'pouceniAdvokat', ok: zatrz('pouceniAdvokat') },
        { id: 'totoznost', text: 'Ověření totožnosti', par: 'praxe', povinne: false, pole: 'totoznost', ok: vypl('totoznost') }
      ]
    }
  };

  /* ---------- práce s protokoly ---------- */
  let citac = 0;
  function noveId() { return 'p' + Date.now().toString(36) + (citac++).toString(36); }

  function polaSablony(klic) {
    const s = SABLONY[klic];
    return SPOLECNA_POLE.concat(s.pole, [ZAVER]);
  }

  function novy(klic, nyni) {
    if (!SABLONY[klic]) throw new Error('Neznámá šablona: ' + klic);
    const s = SABLONY[klic];
    const pole = {};
    polaSablony(klic).forEach(f => { pole[f.id] = f.typ === 'check' ? false : (f.vychozi || ''); });
    pole.predmet = s.predmet;
    return { id: noveId(), sablona: klic, nazev: s.nazev, upraveno: nyni || new Date().toISOString(), pole, osoby: [], veci: [] };
  }

  // změna šablony: zachová společná a shodná pole, osoby i věci
  function zmenSablonu(p, klic) {
    const n = novy(klic);
    Object.keys(n.pole).forEach(k => { if (k !== 'predmet' && p.pole[k] !== undefined && p.pole[k] !== '') n.pole[k] = p.pole[k]; });
    if (p.pole.predmet && p.pole.predmet !== SABLONY[p.sablona].predmet) n.pole.predmet = p.pole.predmet;
    return Object.assign({}, p, { sablona: klic, pole: n.pole, nazev: p.nazev === SABLONY[p.sablona].nazev ? n.nazev : p.nazev });
  }

  function nalezitosti(klic) { return SPOLECNE_NAL.concat(SABLONY[klic].nalezitosti); }

  /* kontrola úplnosti: povinné/doporučené náležitosti, které chybí, a stav polí ke zvýraznění */
  function kontrola(p) {
    const vys = { chybiPovinne: [], chybiDoporucene: [], splneno: [], pole: {} };
    nalezitosti(p.sablona).forEach(n => {
      if (n.kdy && !n.kdy(p)) return;
      if (n.ok(p)) { vys.splneno.push(n); return; }
      (n.povinne ? vys.chybiPovinne : vys.chybiDoporucene).push(n);
      if (n.povinne || !vys.pole[n.pole]) vys.pole[n.pole] = n.povinne ? 'povinne' : 'doporucene';
    });
    return vys;
  }

  /* ---------- modelový případ 17/2026 → protokol o ohledání ---------- */
  function zModelovehoPripadu(P) {
    const m = P.protokol;
    const p = novy('ohledani', m.zacatek + ':00');
    p.id = 'pripad' + P.id;
    p.nazev = 'Ohledání – ' + P.nazev + ' (modelový případ ' + P.id + '/2026)';
    const [d, t] = m.zacatek.split('T');
    Object.assign(p.pole, {
      organ: 'Policie České republiky, krajské ředitelství policie (fiktivní), SKPV, oddělení obecné kriminality',
      cj: P.cislo, datum: d, casOd: t, casDo: m.konec.split('T')[1], misto: m.misto,
      sepsal: P.zpracovatel, povaha: m.povaha, rozsah: m.rozsah,
      prubeh: m.popis + '\n\nZajištěné stopy: ' + m.stopy,
      dokumentace: 'fotodokumentace a náčrt místa činu se značkami stop (viz Náčrt místa činu)',
      neodkladny: true
    });
    p.osoby = m.pritomni.map(s => {
      const [jmeno, role] = s.split(' – ');
      return { jmeno: jmeno.trim(), role: (role || '').replace(/\s*\(fiktivní\)\s*$/, '').trim(), narozeni: '', adresa: '' };
    });
    const od = m.zacatek, do_ = m.konec;
    p.veci = (P.dukazy || []).filter(x => x.kdy >= od && x.kdy <= do_)
      .map(x => ({ c: x.c, popis: x.nazev + ' (' + x.druh + ')', obal: x.obal, misto: x.misto }));
    return p;
  }

  /* ---------- export / import ---------- */
  function exportuj(protokoly) {
    return JSON.stringify({ format: 'webapp_protocol_gen', verze: 1, exportovano: new Date().toISOString(), protokoly }, null, 2);
  }
  // vrátí platné protokoly; kolidující id dostanou nové
  function importuj(text, existujiciId) {
    const d = JSON.parse(text);
    const seznam = Array.isArray(d) ? d : (d && d.protokoly);
    if (!Array.isArray(seznam)) throw new Error('Soubor neobsahuje seznam protokolů.');
    const ids = new Set(existujiciId || []);
    return seznam.filter(p => p && SABLONY[p.sablona] && p.pole && typeof p.pole === 'object').map(p => {
      const zaklad = novy(p.sablona);
      const q = {
        id: typeof p.id === 'string' && !ids.has(p.id) ? p.id : noveId(),
        sablona: p.sablona, nazev: String(p.nazev || zaklad.nazev), upraveno: String(p.upraveno || zaklad.upraveno),
        pole: Object.assign(zaklad.pole, p.pole),
        osoby: Array.isArray(p.osoby) ? p.osoby.filter(o => o && typeof o === 'object').map(o => ({ jmeno: String(o.jmeno || ''), role: String(o.role || ''), narozeni: String(o.narozeni || ''), adresa: String(o.adresa || '') })) : [],
        veci: Array.isArray(p.veci) ? p.veci.filter(v => v && typeof v === 'object').map(v => ({ c: String(v.c || ''), popis: String(v.popis || ''), obal: String(v.obal || ''), misto: String(v.misto || '') })) : []
      };
      ids.add(q.id);
      return q;
    });
  }

  const API = { OVERENO, SABLONY, SPOLECNA_POLE, ZAVER, POUCENI, polaSablony, novy, zmenSablonu, nalezitosti, kontrola, zModelovehoPripadu, exportuj, importuj };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else koren.PROTOKOL_JADRO = API;
})(typeof window !== 'undefined' ? window : globalThis);
