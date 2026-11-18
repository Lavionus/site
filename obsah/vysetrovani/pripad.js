/* Modelový případ 17/2026 – smyšlený spis, který prochází nástroji sekce Vyšetřování.
   Jediný zdroj dat případu: každý nástroj si z něj při otevření s ?pripad=17 načte
   svou část (do vlastního odděleného úložiště, data uživatele nepřepisuje).
   Všechny osoby, místa, vozidla, čísla i otisky jsou smyšlené. */
(function () {
  'use strict';

  const P = {
    id: '17',
    cislo: 'KRPX-1717/TČ-2026 (fiktivní)',
    nazev: 'Vloupání do prodejny Elektro Novotný',
    misto: 'Horní Lhota, Hlavní 17 (smyšlená obec)',
    zpracovatel: 'nprap. Jana Modelová (fiktivní)',
    shrnuti: 'V noci na 15. 11. 2026 kolem 02:08 neznámý pachatel rozbil výlohu prodejny elektroniky, odcizil 6 notebooků a ujel osobním vozidlem. Případ ukazuje cestu od ohledání místa činu po protokol – a to, jak se z dílčích stop skládá vyvrácené alibi.',

    // souřadnice smyšlených míst (WGS-84) – sdílí je časová analýza, náčrt i vazby
    mista: {
      prodejna:  { nazev: 'Prodejna Elektro Novotný, Hlavní 17', lat: 49.60000, lon: 15.50000 },
      cerpaci:   { nazev: 'Čerpací stanice U Křížku (kamera)',  lat: 49.61450, lon: 15.52300 },
      domFiala:  { nazev: 'Bydliště L. Fialy, Dolní Lhota 54',   lat: 49.64000, lon: 15.54000 },
      domBrabec: { nazev: 'Bydliště T. Brabce, Horní Lhota 3',   lat: 49.60350, lon: 15.49400 },
      bazar:     { nazev: 'Bazar R. Kříže, Nádražní 8, Městec',  lat: 49.66900, lon: 15.58200 }
    },

    osoby: [
      { id: 'novotny',   jmeno: 'Karel Novotný',   role: 'poškozený',  popis: 'majitel prodejny, 58 let' },
      { id: 'dvorakova', jmeno: 'Marie Dvořáková', role: 'svědkyně',   popis: 'sousedka, ve 02:10 slyšela tříštění skla a viděla tmavé kombi' },
      { id: 'brabec',    jmeno: 'Tomáš Brabec',    role: 'podezřelý',  popis: '31 let, výška 187 cm, držitel vozidla 1HL 0017', vyska: 187, telefon: '+420 700 111 017' },
      { id: 'fiala',     jmeno: 'Lukáš Fiala',     role: 'podezřelý',  popis: '27 let, výška 174 cm, tvrdí, že celou noc spal doma v Dolní Lhotě', vyska: 174, telefon: '+420 700 222 017' },
      { id: 'kriz',      jmeno: 'Roman Kříž',      role: 'prověřovaná osoba', popis: 'provozuje bazar elektroniky, 16. 11. nabízel 4 notebooky shodného typu', telefon: '+420 700 333 017' }
    ],

    vozidla: [
      { id: 'octavia', rz: '1HL 0017', popis: 'Škoda Octavia kombi, tmavě modrá, starší provedení bez ABS', drzitel: 'brabec' }
    ],

    // hovory (výpis provozních a lokalizačních údajů – smyšlený)
    hovory: [
      { kdy: '2026-11-14T22:40', od: 'brabec', komu: 'fiala', s: 95 },
      { kdy: '2026-11-15T01:31', od: 'fiala',  komu: 'brabec', s: 20 },
      { kdy: '2026-11-15T03:05', od: 'fiala',  komu: 'kriz',   s: 210 },
      { kdy: '2026-11-15T10:12', od: 'kriz',   komu: 'fiala',  s: 64 },
      { kdy: '2026-11-16T09:30', od: 'kriz',   komu: 'brabec', s: 41 }
    ],

    // stopy a důkazy – čísla značek odpovídají náčrtu místa činu
    dukazy: [
      { c: '1', nazev: 'Střepy výlohy s krevní stopou', druh: 'biologická stopa', misto: 'pod rozbitou výlohou, vnitřní strana', zajistil: 'prap. Petr Ukázkový (fiktivní)', kdy: '2026-11-15T09:05', obal: 'papírová obálka, pečeť 0170001', stav: 'odesláno na KÚP – DNA' },
      { c: '2', nazev: 'Šlápěcí stopa obuvi (vel. cca 44)', druh: 'trasologická stopa', misto: 'prodejní plocha, 1,8 m od výlohy', zajistil: 'prap. Petr Ukázkový (fiktivní)', kdy: '2026-11-15T09:20', obal: 'gelová folie + fotodokumentace', stav: 'porovnání s obuví podezřelých' },
      { c: '3', nazev: 'Páčidlo 60 cm', druh: 'věcná stopa / nástroj', misto: 'dvůr za prodejnou u popelnic', zajistil: 'prap. Petr Ukázkový (fiktivní)', kdy: '2026-11-15T09:40', obal: 'papírový obal, pečeť 0170003', stav: 'daktyloskopie, mechanoskopie' },
      { c: '4', nazev: 'Nedopalek cigarety', druh: 'biologická stopa', misto: 'chodník před vchodem', zajistil: 'prap. Petr Ukázkový (fiktivní)', kdy: '2026-11-15T09:10', obal: 'papírová obálka, pečeť 0170004', stav: 'odesláno na KÚP – DNA' },
      { c: '5', nazev: 'Záznam kamery čerpací stanice (USB)', druh: 'digitální stopa', misto: 'čerpací stanice U Křížku – vydáno provozovatelem', zajistil: 'nprap. Jana Modelová (fiktivní)', kdy: '2026-11-15T13:30', obal: 'USB flash, pečeť 0170005', stav: 'analýza výšky osoby', sha256: 'fbdbcd3c5e11f0f9bb7f11cbf6c54a64e07641dd4dec359959d6f61ee3402b34' },
      { c: '6', nazev: 'Export polohové historie telefonu L. Fialy', druh: 'digitální stopa', misto: 'vydáno dobrovolně (Google Takeout)', zajistil: 'nprap. Jana Modelová (fiktivní)', kdy: '2026-11-16T10:00', obal: 'kopie na DVD-R, pečeť 0170006', stav: 'časová analýza', sha256: 'b60dac3c7d8db36635bbcf8a5517d285281b6c42187a7dbc89097268dff620db' },
      { c: '7', nazev: 'Brzdná stopa 38,5 m – fotodokumentace a měření', druh: 'dopravní stopa', misto: 'křižovatka Hlavní × K Lesu, 140 m od prodejny', zajistil: 'prap. Petr Ukázkový (fiktivní)', kdy: '2026-11-15T10:15', obal: 'fotografie, záznam měření', stav: 'výpočet rychlosti', sha256: '0f3a06a61f3d9b47d2dc03c9e536f3552e0d7998a5b298e12fbb798bd606631f' }
    ],

    // brzdná stopa vozidla při úniku – vstup pro výpočet rychlosti
    brzdna: { s: 38.5, povrch: 'suchý asfalt', sklon: 0, poznamka: 'stopa od zablokovaných kol bez ABS, obec – limit 50 km/h' },

    // časová osa: typ udalost | dukaz | svedek; volitelně osoby (id), do, misto, zdroj, jistota (overeno|pravdepodobne|tvrzeni), nejistota (min)
    udalosti: [
      { kdy: '2026-11-14T22:00', do: '2026-11-15T07:00', typ: 'svedek', osoby: ['fiala'], misto: 'Bydliště L. Fialy, Dolní Lhota 54', jistota: 'tvrzeni', text: 'Tvrzení L. Fialy: celou noc spal doma v Dolní Lhotě, nikam nejel.' },
      { kdy: '2026-11-14T22:40', typ: 'udalost', text: 'Hovor T. Brabec → L. Fiala (95 s) – podle výpisu.' },
      { kdy: '2026-11-15T01:31', typ: 'udalost', text: 'Hovor L. Fiala → T. Brabec (20 s); telefon L. Fialy už mimo domov (polohová historie).' },
      { kdy: '2026-11-15T01:52', typ: 'dukaz',   text: 'Kamera čerpací stanice U Křížku: tmavé kombi projíždí směrem na Horní Lhotu (stopa č. 5).' },
      { kdy: '2026-11-15T02:08', typ: 'udalost', text: 'Rozbití výlohy – čidlo zabezpečení hlásí poplach 02:08:40.' },
      { kdy: '2026-11-15T02:10', typ: 'svedek',  text: 'M. Dvořáková slyší tříštění skla, z okna vidí tmavé kombi a dvě osoby.' },
      { kdy: '2026-11-15T02:14', typ: 'dukaz',   text: 'Únik vozidla – brzdná stopa 38,5 m na křižovatce Hlavní × K Lesu (stopa č. 7), výpočet 82–94 km/h v obci (limit 50).' },
      { kdy: '2026-11-15T01:58', do: '2026-11-15T02:14', typ: 'dukaz', osoby: ['fiala'], misto: 'Prodejna Elektro Novotný, Hlavní 17', zdroj: 'poloha', jistota: 'pravdepodobne', nejistota: 2, text: 'Polohová historie telefonu L. Fialy (stopa č. 6): telefon u prodejny v Horní Lhotě.' },
      { kdy: '2026-11-15T02:21', typ: 'dukaz',   osoby: ['brabec'], jistota: 'pravdepodobne', text: 'Kamera čerpací stanice (stopa č. 5): řidič tankuje, odhad výšky asi 189 cm (95% interval 184–194 cm) – L. Fialu (174 cm) vylučuje, s T. Brabcem (187 cm) je slučitelný; totožnost sama výška neprokazuje.' },
      { kdy: '2026-11-15T03:05', typ: 'udalost', text: 'Hovor L. Fiala → R. Kříž (210 s).' },
      { kdy: '2026-11-15T08:30', typ: 'udalost', text: 'Zahájení ohledání místa činu.' },
      { kdy: '2026-11-15T09:05', typ: 'dukaz',   text: 'Zajištěny stopy č. 1–4 (střepy s krví, šlápěcí stopa, páčidlo, nedopalek).' },
      { kdy: '2026-11-16T09:30', typ: 'svedek',  text: 'Oznámení: R. Kříž nabízí v bazaru 4 notebooky shodného typu a výrobních řad.' },
      { kdy: '2026-11-16T10:00', typ: 'dukaz',   osoby: ['fiala'], text: 'L. Fiala dobrovolně vydal polohovou historii telefonu (stopa č. 6).' }
    ],

    // protokol o ohledání – předvyplněné hodnoty pro generátor protokolů
    protokol: {
      typ: 'ohledani',
      povaha: 'vloupání do prodejny, krádež 6 notebooků (§ 205 TZ)',
      rozsah: 'prodejna 8 × 6 m, dvůr za prodejnou, chodník před vchodem, křižovatka Hlavní × K Lesu',
      misto: 'Horní Lhota, Hlavní 17 – prodejna Elektro Novotný a přilehlý dvůr (smyšlené místo)',
      zacatek: '2026-11-15T08:30', konec: '2026-11-15T11:10',
      pritomni: ['nprap. Jana Modelová – vedoucí ohledání (fiktivní)', 'prap. Petr Ukázkový – kriminalistický technik (fiktivní)', 'Karel Novotný – poškozený (fiktivní)'],
      popis: 'Výloha vpravo od vchodu rozbita, otvor cca 90 × 70 cm, střepy převážně uvnitř prodejny – sklo rozbito zvenku. Z regálu u výlohy chybí 6 notebooků. Na prodejní ploše šlápěcí stopa obuvi, na dvoře za prodejnou odhozené páčidlo. Na křižovatce Hlavní × K Lesu brzdná stopa 38,5 m.',
      stopy: 'č. 1 střepy s krví, č. 2 šlápěcí stopa, č. 3 páčidlo, č. 4 nedopalek, č. 7 brzdná stopa – viz evidenční deník a náčrt.'
    },

    // osoba k výslechu a témata pro generátor otázek
    // otevřené otázky jdou před obecné, konfrontace se zjištěními až na konec (model PEACE)
    vyslech: {
      osoba: 'Lukáš Fiala', role: 'podezrely',
      otevrene: [
        'Popište vlastními slovy, jak jste strávil večer 14. 11. 2026 a noc na 15. 11. – od 20 hodin do rána.',
        'S kým jste byl tu noc v kontaktu – osobně nebo telefonicky?',
        'Kdo kromě vás má přístup k vašemu mobilnímu telefonu?',
        'Jaký je váš vztah k Tomáši Brabcovi a Romanu Křížovi?'
      ],
      konfrontace: [
        'Ve 01:31 jste volal Tomáši Brabcovi. O čem jste spolu mluvili?',
        'Polohová historie vašeho telefonu ukazuje mezi 01:58 a 02:14 Horní Lhotu, ne Dolní Lhotu. Jak to vysvětlíte?',
        'Ve 03:05 jste téměř 4 minuty telefonoval s Romanem Křížem. Čeho se hovor týkal?'
      ]
    },

    // kroky průvodce – pořadí odpovídá práci na případu
    kroky: [
      { soubor: 'spis.html',                    nazev: 'Spis případu', ukol: 'Otevři spis 17/2026 – osoby, stopy, místa a události na jednom místě. Další nástroje do něj zapisují a čtou z něj.' },
      { soubor: 'investigation_checklist.html', nazev: 'Příprava ohledání', ukol: 'Projdi kontrolní seznam ohledání místa činu – co zajistit dřív, než se na místo vstoupí.' },
      { soubor: 'scene_sketch.html',            nazev: 'Náčrt místa činu', ukol: 'Prohlédni si náčrt prodejny se značkami stop 1–4 a fotopozicemi. Všimni si, kde leží střepy – sklo bylo rozbito zvenku.' },
      { soubor: 'fotodokumentace.html',         nazev: 'Fotodokumentace', ukol: 'Čtyři snímky z místa se značkami stop. Klik na značku otevře stopu ve spisu; 🖨️ Fototabulka sestaví přílohu k protokolu.' },
      { soubor: 'evidence_log.html',            nazev: 'Evidence důkazů', ukol: 'Každá stopa má číslo, obal s pečetí a řetězec předání. Digitální stopy nesou otisk SHA-256.' },
      { soubor: 'teren.html',                   nazev: 'Předání stopy v terénu', ukol: 'Na telefonu načti QR štítek stopy č. 5 (USB se záznamem kamery) a zapiš její předání – objeví se v řetězci předání v deníku.' },
      { soubor: 'brzdna_draha.html',            nazev: 'Rychlost z brzdné stopy', ukol: 'Z 38,5 m dlouhé stopy na suchém asfaltu spočítej rychlost vozidla při úniku.' },
      { soubor: 'vyska_z_fotky.html',           nazev: 'Výška osoby z kamery', ukol: 'Ze snímku čerpací stanice odhadni výšku řidiče i s nejistotou a porovnej s podezřelými (187 cm a 174 cm).' },
      { soubor: 'casova_analyza.html',          nazev: 'Časová analýza polohy', ukol: 'Ověř alibi L. Fialy – „celou noc doma“ – proti polohové historii jeho telefonu.' },
      { soubor: 'vazby_analyza.html',           nazev: 'Analýza vazeb', ukol: 'Graf osob, telefonů a vozidla: kdo komu volal a kdo je spojnicí mezi pachateli a překupníkem.' },
      { soubor: 'financni_toky.html',           nazev: 'Finanční stopy', ukol: 'Výpisy účtů ukážou, kam šly peníze za notebooky z bazaru R. Kříže – a kdo je dostal krátce po činu.' },
      { soubor: 'case_timeline.html',           nazev: 'Časová osa případu', ukol: 'Poskládej zjištění z předchozích kroků do jedné chronologie a rozliš události, důkazy a výpovědi.' },
      { soubor: 'rozbor_vypovedi.html',         nazev: 'Rozbor výpovědi', ukol: 'Ve výpovědi L. Fialy vyznač časy, osoby a místa. Tvrzení „celou noc doma“ přenes na časovou osu ke srovnání s polohou telefonu.' },
      { soubor: 'interview_questions.html',     nazev: 'Příprava výslechu', ukol: 'Připrav výslech L. Fialy – otevřené otázky nejdřív, rozpory (poloha telefonu) až nakonec.' },
      { soubor: 'nastenka.html',                nazev: 'Nástěnka vyšetřovatele', ukol: 'Shrnutí na jedné ploše: tvrzení Fialy a provázky k důkazům, které ho vyvracejí nebo s ním souvisejí.' },
      { soubor: 'protocol_gen.html',            nazev: 'Protokol o ohledání', ukol: 'Výsledek práce: protokol o ohledání místa činu s odkazy na stopy a náčrt.' }
    ]
  };

  const aktivni = (() => { try { return new URLSearchParams(location.search).get('pripad') === P.id; } catch (e) { return false; } })();
  const vRozcestniku = (() => { try { return window.parent !== window && window.parent.location.origin === location.origin; } catch (e) { return false; } })();

  // otevření stránky webu: v rozcestníku přes záložku (hash), samostatně přímo
  function otevri(soubor) {
    if (vRozcestniku) window.parent.postMessage({ otevri: 'obsah/' + soubor }, '*');
    else location.href = soubor.replace(/^.*\//, '');
  }

  // pruh průvodce nahoře na stránce nástroje (jen v režimu modelového případu)
  function pruh() {
    if (!aktivni) return;
    const soubor = location.pathname.split('/').pop();
    const i = P.kroky.findIndex(k => k.soubor === soubor);
    if (i < 0) return;
    const k = P.kroky[i], pred = P.kroky[i - 1], dalsi = P.kroky[i + 1];
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const css = document.createElement('style');
    css.textContent = `.mp-pruh{position:sticky;top:0;z-index:1000;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;
      background:var(--bg-elevated);border-bottom:2px solid var(--accent);padding:8px 12px;font:14px/1.35 system-ui,sans-serif;color:var(--text)}
      .mp-pruh b{color:var(--accent)} .mp-pruh .mp-ukol{flex:1 1 280px;color:var(--text-muted)}
      .mp-pruh button{background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font:inherit}
      .mp-pruh button.mp-dalsi{background:var(--accent);color:var(--on-accent,#fff);border-color:var(--accent)}
      .mp-pruh.samostatne{padding-right:110px} /* štítek stavu z podpis.js vpravo nahoře */
      @media print{.mp-pruh{display:none}}`;
    document.head.appendChild(css);
    const d = document.createElement('div');
    d.className = 'mp-pruh';
    d.dataset.i18n = 'ne';   // pruh je součást smyšleného spisu (česká data)
    d.setAttribute('role', 'navigation');
    d.innerHTML = `<span>🕵️ <b>Modelový případ 17/2026</b> · krok ${i + 1}/${P.kroky.length}: <b>${esc(k.nazev)}</b></span>
      <span class="mp-ukol">${esc(k.ukol)}</span>
      <span><button type="button" data-mp="prehled" title="Přehled případu">☰ Přehled</button>
      ${pred ? `<button type="button" data-mp="${i - 1}" title="${esc(pred.nazev)}">◀ Zpět</button>` : ''}
      ${dalsi ? `<button type="button" class="mp-dalsi" data-mp="${i + 1}" title="${esc(dalsi.nazev)}">Další: ${esc(dalsi.nazev)} ▶</button>`
              : `<button type="button" class="mp-dalsi" data-mp="prehled">✓ Hotovo – zpět na přehled</button>`}</span>`;
    d.addEventListener('click', e => {
      const b = e.target.closest('[data-mp]'); if (!b) return;
      const c = b.dataset.mp;
      otevri(c === 'prehled' ? 'vysetrovani.html?pripad=' + P.id : P.kroky[+c].soubor + '?pripad=' + P.id);
    });
    if (!vRozcestniku) d.classList.add('samostatne');
    document.body.prepend(d);
  }

  window.MODELOVY_PRIPAD = P;
  window.ModelovyPripad = { aktivni, otevri, pruh };
  if (aktivni) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pruh);
    else pruh();
  }
})();
