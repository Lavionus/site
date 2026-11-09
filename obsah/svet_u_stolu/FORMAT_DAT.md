# Formát dat – Svět u stolu

Každý datový soubor `obsah/svet_u_stolu/<region>_data.js` (koncovka `_data.js` – nástroje i18n je nepřekládají jako rozhraní) vypadá takto:

```js
/* Svět u stolu – data: <region>. Ověřeno <datum>. */
(window.SUS_DATA = window.SUS_DATA || []).push(
{
  id: 'cz-stedry-den',                 // unikátní, malá písmena, pomlčky, prefix = kód země
  zeme: ['CZ'],                        // ISO 3166-1 alpha-2 (víc zemí = pole); Skotsko 'GB-SCT', Wales 'GB-WLS', Anglie 'GB-ENG'
  misto: '',                           // volitelně upřesnění: 'jih USA', 'Kerala', 'Neapol'
  jidlo: 'Kapr s bramborovým salátem', // hlavní jídlo (krátce)
  emoji: '🐟',                         // jedno emoji jídla
  prilezitost: 'Štědrý den',           // název svátku/zvyku česky
  kdy: { typ: 'pevne', m: 12, d: 24 }, // viz níže
  kultura: 'krestanske',               // viz níže
  proc: 'Proč se to jí – symbolika, původ, zvyk. 2–4 věty, česky, věcně.',
  recept: {
    nazev: 'Smažený kapr',             // když se recept liší od názvu jídla
    porce: 4,
    cas: '1 h',
    suroviny: ['4 porce kapra', '2 vejce', '…'],
    postup: ['Kapra osolte…', '…']     // 3–8 kroků, rozkazovací způsob, vykání
  },
  zdroj: 'https://…'                   // 1 ověřovací odkaz (Wikipedie v jazyce země, UNESCO, oficiální web)
},
);
```

## `kdy` – typy

| typ | pole | příklad |
|---|---|---|
| `pevne` | `m`, `d`, volitelně `delka` (počet dní, výchozí 1) | `{typ:'pevne', m:1, d:1, delka:3}` = 1.–3. 1. |
| `velikonoce` | `posun` (dny od západní Velikonoční neděle) | Tučné úterý `{typ:'velikonoce', posun:-47}`, Velký pátek `-2` |
| `pravoslavne` | `posun` (od pravoslavné Velikonoční neděle) | Čisté pondělí `-48` |
| `cinsky` | `m`, `d` (lunární měsíc/den čínského kalendáře) | Nový rok `{m:1,d:1}`, Duanwu `{m:5,d:5}`, střed podzimu `{m:8,d:15}` |
| `islamsky` | `m`, `d` (hidžra, Umm al-Qura) | Íd al-Fitr `{m:10,d:1}`, Íd al-Adha `{m:12,d:10}`, ramadán `{m:9,d:1,delka:30}` |
| `zidovsky` | `m` (anglický název měsíce: Tishri, Heshvan, Kislev, Tevet, Shevat, Adar, Nisan, Iyar, Sivan, Tamuz, Av, Elul; Purim použije v přestupném roce Adar II), `d` | Roš ha-šana `{m:'Tishri',d:1}`; den = den, jehož VEČEREM svátek začíná se NEuvádí – uvádí se první celý den svátku |
| `tyden` | `m`, `wd` (0=ne … 6=so), `n` (1.–5. výskyt, -1 = poslední), volitelně `posun` | Díkůvzdání USA `{typ:'tyden', m:11, wd:4, n:4}` |
| `vrozsahu` | `m`, `od`, `wd` – první den `wd` od dne `od` | Midsommar `{typ:'vrozsahu', m:6, od:19, wd:5}` |
| `tabulka` | `data: {'2025':'10-20', … '2036':'…'}` (MM-DD), volitelně `delka` | hinduistické svátky, japonský Dojó no uši – **povinně roky 2025–2036**, ověřit |
| `obdobi` | `m`, `d`, `delka` – dlouhé období (sezóna, celý měsíc) | raci ve Švédsku `{typ:'obdobi', m:8, d:1, delka:31}` |

Datum vždy v gregoriánském kalendáři (pro pravoslavné Vánoce 7. 1. tedy `pevne m:1 d:7`).

## `kultura`

`krestanske` (katolické/protestantské), `pravoslavne`, `zidovske`, `islamske`, `hinduisticke`,
`vychodoasijske` (čínské, japonské, korejské, vietnamské lidové/buddhistické), `persko` (Nourúz, Jalda),
`lidove` (lidové zvyky bez náboženského jádra, slunovraty), `statni` (státní svátky, výročí),
`novodobe` (novodobé „dny jídla“, marketing – Pí den, Pepero, KFC v Japonsku).

## Pravidla obsahu

- Česky, s diakritikou, věcně, bez kýče. Cizí názvy jídel v původní podobě (latinkou), u japonštiny/čínštiny
  česká transkripce + v závorce běžný přepis jen pokud se liší (např. „ťiao-c’ (jiaozi)“).
- Každá položka musí být **skutečně rozšířená tradice** spojená s daným dnem/svátkem, ověřená zdrojem.
  Nejistotu nepsat jako fakt – raději položku vynechat.
- Recept: domácí verze, suroviny dostupné v ČR (exotické nahradit a napsat čím), metrické míry.
- Žádné duplicity: jedna země + jeden svátek = jedna položka (víc jídel téhož večera vyjmenovat v `jidlo`/`proc`,
  recept na to nejtypičtější).

## Historické tradice (pole `doba` a `pramen`)

Položka, která popisuje, co se k danému dni jedlo **v minulé epoše** (dnes už ne, nebo jinak), má navíc:

```js
  doba: 'terezianska',          // id epochy z tabulky níže (povinné u historických položek)
  pramen: 'M. D. Rettigová: Domácí kuchařka, 1826',  // dobový pramen (kuchařka, kronika, autor); volitelné, ale vítané
```

- `id` s prefixem `hist-` + kód země, např. `hist-at-terezie-vanoce`.
- `zeme` = dnešní státy, kde se to odehrávalo; `misto` upřesní (Vídeň, Řím, Londýn, Tenochtitlan).
- `kdy` = den v dnešním (gregoriánském) kalendáři, kdy svátek připadá; když se tehdy řídil jiným kalendářem
  (juliánský, římský, aztécký), uveď to v `proc` (např. „Saturnálie začínaly 17. prosince římského kalendáře“).
- `proc` popíše dobu, společnost, kdo to jedl (dvůr, měšťané, venkov) a proč – 3–5 vět, věcně, žádné legendy jako fakta.
- `recept` = rekonstrukce podle pramene upravená pro dnešní kuchyň (napiš to v `nazev`, např. „Kořeněné víno podle Apicia“);
  dobové suroviny nahraď dostupnými a uveď čím.
- `kultura`: navíc hodnota `pohanske` (antická a předkřesťanská náboženství – Saturnálie, Jól, Samhain, aztécké svátky).

| id | epocha | | id | epocha |
|---|---|---|---|---|
| egypt | Starověký Egypt | | renesance | Renesance (1400–1620) |
| mezopotamie | Mezopotámie | | tudorovci | Tudorovská Anglie |
| indie-stara | Starověká Indie | | osmanska | Osmanská říše |
| recko | Antické Řecko | | ming-cching | Čína Ming a Čching |
| persie-stara | Starověká Persie | | mughalove | Mughalská Indie |
| keltove | Keltové | | edo | Japonsko Edo |
| rim | Antický Řím | | baroko | Baroko (1620–1740) |
| cina-stara | Čína Chan–Tchang | | kolonialni-amerika | Koloniální Amerika |
| mezoamerika | Mayové a Aztékové | | stary-rezim | Francie starého režimu |
| byzanc | Byzanc | | terezianska | Tereziánská doba (1740–1780) |
| slovane | Předkřesťanští Slované | | napoleonska | Napoleonská doba |
| vikingove | Germáni a Vikingové | | biedermeier | Biedermeier a obrození (1815–1848) |
| abbasovci | Islámský zlatý věk | | carske-rusko | Carské Rusko |
| heian | Japonsko Heian | | viktorianska | Viktoriánská Anglie |
| stredovek | Středověká Evropa | | rakousko-uhersko | Rakousko-Uhersko (1867–1918) |
| cechy-stredovek | Přemyslovci a Lucemburkové | | belle-epoque | Belle époque |
| inkove | Inkové | | prvni-republika | První republika |
| | | | valka | Válka a přídělový systém (1939–1954) |
| | | | sovetsky-svaz | Sovětský svaz |
| | | | socialismus | Socialistické Československo |
| | | | povalecna-amerika | Poválečná Amerika (1945–1970) |
