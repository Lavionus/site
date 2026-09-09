# ◈ Nodus

Samostatný web s interaktivními výukovými aplikacemi pro základní školu —
čeština, matematika, cizí jazyky, prvouka a vlastivěda, přírodní vědy, zeměpis,
dějepis a informatika. Vše běží v prohlížeči, bez serveru a bez registrace,
po prvním otevření i offline (PWA + service worker).

Katalog je zároveň **kostrou osnov ZŠ**: 244 témat v 11 předmětech a 9 ročnících
plus 10 nástrojů bez vazby na předmět — dohromady 254 položek. Osnova je momentálně
pokrytá celá, žádné téma nezůstalo jen jako zástupce (🚧). Přehled je na stránce
[Osnova](obsah/osnova.html).

Živě: <https://lavionus.github.io/site/nodus/>

## Struktura

| Cesta | Obsah |
|---|---|
| `index.html` | rozcestník — menu, hledání, oblíbené, deep-linky přes `#obsah/…` |
| `apps.js` | katalog (jediný zdroj pravdy pro menu, hledání i úvodní přehled) |
| `obsah/prehled.html` | úvodní stránka v pracovní ploše (ročníky, předměty, tip dne, oblíbené) |
| `obsah/osnova.html` | mřížka ročníků × předmětů s přehledem pokrytí učiva |
| `obsah/ucitel.html` | kabinet učitele – rozcestník pro přípravu a nástroje do hodiny (ve dvou úrovních záložek) |
| `obsah/prezentace.html` | tvorba slidů, promítání na plátno a tisk podkladů |
| `obsah/predstaveni.html` | živé ukázky – zkrácené, ale funkční verze šesti aplikací na jedné stránce |
| `obsah/*.html` | jednotlivé výukové aplikace |
| `obsah/lib/`, `obsah/textures/`, `obsah/Anatomy/` | knihovny a data aplikací |
| `common.css`, `theme.js` | sdílený vzhled a přepínání světlého/tmavého režimu |
| `projektor.js` | zvětšení obrazu pro projektor a tabuli – používá rozcestník i prezentace |
| `podpis.js` | autorský podpis (`Nodus © Radovan Valenta · hdm@seznam.cz`) ve vlastním pruhu dole – patří do `<head>` **každé** stránky; název díla drží konstanta `DILO` |
| `rec.js` | čtení nahlas – systémový hlas, jinak vestavěný ze složky `hlas/` |
| `uloha.js` | společné chování úloh: zaklepání u chyby, zelená a automatický posun u správné odpovědi, skóre |
| `vyjmenovana.js` | řady vyjmenovaných slov (jediný zdroj pro doplňovačky, vyjmenovaná slova i diktáty) |
| `vyuka.css` | společný vzhled procvičovacích aplikací (plocha, možnosti, odezva, řazení, pravopisné díly) |
| `hlas/` | vestavěný syntetizér řeči (meSpeak/eSpeak, GPL) – viz `hlas/LICENCE.md` |
| `fonty/` | školní psací písmo Playwrite CZ (OFL) – viz `fonty/LICENCE.md` |
| `sw.js`, `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png` | PWA (cache `nodus-vN`) |
| `logo.svg` | značka (uzel) pro manifest a další použití; v hlavičkách je stejná cesta vložená inline (bere barvu z motivu a nezávisí na načtení souboru) |
| `favicon.svg`, `favicon.ico` | ikona v záložce prohlížeče |
| `Logo/` | zdrojové obrázky značky + `build_ikon.sh`, který z nich generuje celou sadu |

## Katalog a osnova

Každá položka v `apps.js` má kromě `soubor`, `nazev` a `tagy` také:

| Pole | Význam |
|---|---|
| `predmet` | id z `KATALOG_PREDMETY` (`cj`, `m`, `aj`, `dcj`, `prv`, `inf`, `f`, `ch`, `pr`, `z`, `d`); nástroje bez vazby na předmět ho nemají |
| `rocniky` | ročníky ZŠ, kterých se téma týká — podle nich filtruje menu i mřížka osnovy |
| `stav` | `'plan'` u připravovaných témat; hotové aplikace pole nemají |

Menu filtruje ve třech nezávislých osách (předmět, ročník, zobrazení
připravovaných — ten se skryje, dokud katalog žádné `stav: 'plan'` neobsahuje)
a hledání jde napříč všemi. Stránka `obsah/osnova.html` počítá
mřížku pokrytí přímo z katalogu — druhý zdroj pravdy neexistuje.

Rozdělení témat do ročníků odpovídá obvyklé praxi českých ŠVP. RVP ZV samo
stanovuje očekávané výstupy po obdobích (1.–3. a 4.–5. ročník, 2. stupeň),
ne po jednotlivých ročnících. Revidované RVP ZV bylo schváleno v lednu 2025
a povinné bude od září 2027 pro 1. a 6. ročník.

## Generátor pracovních listů

`obsah/pracovni_listy.html` skládá tisknutelné listy z vlastního katalogu
generátorů úloh (konstanta `G` uvnitř stránky). Každé téma má stejná metadata
jako katalog Nodusu, takže se výběr filtruje ve dvou osách jako menu:

| Pole | Význam |
|---|---|
| `p` | hlavní předmět — id z `PREDMETY` (shodné s `KATALOG_PREDMETY` v `apps.js`) |
| `p2` | vedlejší předměty; krajská města patří do vlastivědy i zeměpisu a filtr je najde v obou |
| `r` | ročníky, kterých se téma týká — podle nich filtruje nabídka |
| `t`, `instr` | název tématu a pokyn nad úlohami na listu |
| `gen(d, R)` | vrátí `{q, a}` pro obtížnost `d` a generátor náhody `R` |
| `sig` | podpis tvaru úlohy — úlohy se pak rozprostřou mezi všechny tvary, aby se na listu neopakovala stejná věta |

Volba ročníku zúží seznam témat a předvyplní obtížnost (1.–3. lehká,
4.–6. střední, 7.–9. těžká). Jakmile si ji učitel přenastaví ručně, ročník
už do ní nesahá.

Řešení se výchozím nastavením tiskne **na zvláštní stránce** a **kód listu**
(podle něj se dá tentýž list vyrobit znovu) jde jen na ni — na listy pro žáky
se tiskne, jen když si to učitel přepne volbou *Tisknout kód listu*. Celé
nastavení včetně textů v hlavičce, vybraných témat a kódu listu se průběžně
ukládá do `localStorage` (`worksheet_gen_v2`), takže se stránka otevře tam,
kde ji učitel opustil.

Arch v náhledu je vždy bílý papír, proto uvnitř `.sheet-page` **nesmí být
proměnné motivu** — ve světlém režimu vycházelo `--bg-hover` na bílém papíře
jako neviditelná čísla úloh a linka na jméno, a to i v tisku.

## Pro učitele

Učitelské stránky drží pohromadě `obsah/ucitel.html` (**Kabinet učitele**).
Stránka se přepíná mezi **dvěma částmi** (přepínač nahoře, volba se pamatuje
v `nodus_ucitel_cast`):

- **📋 Příprava na hodinu** — rozcestník po přípravných nástrojích (pracovní listy,
  slidy, osnova, ukázky, knihovna sad, kartičky, citace).
- **🧰 Nástroje do hodiny** — to, co běží přímo v hodině.

Nástroje jsou uvnitř ve **dvou úrovních záložek**: nahoře skupina, pod ní nástroje.

| Skupina | Nástroje |
|---|---|
| 🧭 Průběh hodiny | časovač (i stopky), semafor hluku |
| 🎲 Náhoda | kostka, mince |
| 👥 Práce se třídou | losování žáka, skupiny, skóre týmů |

Práce se třídou je schválně **poslední a schovaná** — uprostřed hodiny se sahá
spíš po časovači a kostce, seznam žáků se řeší při přípravě.

Pravidla, kterými se stránka řídí:

- **Čte se z poslední lavice.** Čísla i jména jsou v `clamp()` škále přes celou
  šířku, ne v okénku — nástroj se pouští na plátno, ne na notebook.
- **Celá obrazovka na plátno.** Časovač, semafor, kostka, mince, losování
  i skóre mají tlačítko ⛶ (klávesa `F`). Používá se Fullscreen API a když ho
  prohlížeč nebo rám odmítne, nástroj se roztáhne přes okno třídou `zvetseno`
  (`position: fixed`) — ve fullscreenu se skryjí ovládací drobnosti (`.drobne`)
  a písmo povyroste.
- **Seznam třídy je jeden.** Losování, skupiny i výběr do týmů berou jména
  ze stejného `nodus_tridy_v1`, aby se třída psala jen jednou. Tříd může být víc.
- **Losování bez opakování.** Dokud se kolo neuzavře, nikdo nepadne dvakrát
  (a vylosovaní jsou v seznamu odškrtnutí). Po vyčerpání začne samo nové kolo —
  losování nikdy nezůstane stát. Bez téhle volby aspoň nepadne tentýž žák dvakrát za sebou.
  Losovat jde i víc žáků naráz (dvojice, trojice) — vylosovaní jsou vždy různí.
- **Okno pro třídu.** Tlačítko „🖵 Okno pro třídu“ otevře tutéž stránku
  s `?tabule=1`; ta schová celé ovládání a ukazuje jen to, co má vidět třída
  (čas s prstencem, jméno, kostky, semafor, skupiny, skóre). Posílá se přes
  `BroadcastChannel('nodus_ucitel_tabule')` a **vysílá vždy jen otevřený nástroj** —
  jinak by si časovač a losování přebíjely obrazovku. Nové okno se po načtení
  zeptá zprávou `{dotaz:true}` a kabinet mu pošle poslední stav. Čas se posílá jen
  při změně sekundy, ne každý snímek. `sw.js` proto při hledání v cache zkouší
  i `ignoreSearch` — jinak by stránka s parametrem offline spadla.
- **Displej nesmí zhasnout.** Když běží odpočet nebo svítí semafor, drží stránka
  `navigator.wakeLock`; po návratu na záložku si ho vezme znovu.
- **Kdo dnes chybí.** Klik na jméno v losování žáka označí absenci — vypadne
  z losování i z dělení do skupin. Absence je vedle seznamu třídy
  (`nodus_absence_v1`) a platí jen na dnešek, takže se jména nemusí mazat a dopisovat.
- **Záloha do souboru.** `⤓ Záloha` uloží třídy i týmy jako JSON, `⤒ Obnovit` je
  načte zpátky — localStorage je jen v jednom prohlížeči, doma i ve škole by se
  jinak seznamy psaly dvakrát.
- **Klávesy platí jen v části s nástroji.** V přípravě mezerník nic nespouští,
  aby se stránka dala normálně procházet.
- **Odkazy respektují rám.** Uvnitř rozcestníku se dlaždice otevírají v jeho
  pracovní ploše (`postMessage`), samostatně otevřená stránka odkazuje přímo.

- **Výběr délky časovač nespouští.** Předvolba (i vlastní počet minut) jen nastaví čas
  a tlačítko „Spustit“ začne pulsovat (`.btn.puls`, u `prefers-reduced-motion` místo
  animace obrys) — učitel pustí odpočet, až je třída připravená, ne když si vybírá délku.
- **Časovač počítá z hodin, ne přičítáním sekund.** Stav se v `requestAnimationFrame`
  smyčce dopočítává z `performance.now()`; `setInterval` v zabrané záložce zaostává
  a odpočet by lhal. Prstenec kolem číslic je SVG kružnice řízená `stroke-dashoffset`
  (u stopek ukazuje vteřiny v minutě). `+1 min` přičítá i do celku, jinak by prstenec přetekl.
- **Kostka umí víc než šestku.** Sady k4–k100 i vlastní rozsah, až deset kostek
  najednou se součtem, historie posledních dvanácti hodů a volitelná **paměť**:
  do vyčerpání kola padne každé číslo jen jednou (nad 200 čísel se paměť vypne,
  seznam by se nedal přečíst). Rozsah 1–6 se kreslí puntíky, ostatní číslicí.
  Nastavení i paměť drží `nodus_kostka_v1`.

- **Zvuk konce se plánuje dopředu.** Ve skryté záložce prohlížeč zastaví
  `requestAnimationFrame` a časovače přiškrtí; tóny naplánované do `AudioContextu`
  (`o.start(currentTime + zbývá)`) ale zazní přesně, takže konec času je slyšet,
  i když učitel mezitím přepnul do prezentace. Odpočet navíc jede kromě rAF
  i v `setInterval(500)`, který v pozadí běží dál.
- **Kostka i mince kreslí histogram.** Sloupečky četností (u víc kostek četnosti
  součtů) dělají z pomůcky pokus do pravděpodobnosti; jiný rozsah nebo počet kostek
  začíná nový pokus, nad 30 sloupečků se graf skryje.
- **Skupiny umí role a jmenovky.** Volitelně přidělí prvním členům role (mluvčí,
  zapisovatel, časoměřič, materiály) a `🏷 Jmenovky na lavice` je vytiskne
  po dvou na šířku (třída `tisk-jmenovky` přepne, co se tiskne).
- **Skóre se dá vzít zpět.** Překliknutí `+5` místo `+1` vrátí `↶ Vrátit bod`;
  zásobník změn se maže při vynulování, smazání týmů i obnovení ze zálohy.
- **Záložky jsou opravdové záložky.** `role="tablist"`/`tab`/`tabpanel`,
  `aria-selected` a přepínání šipkami; ve fullscreenu se řádek podzáložek
  přestěhuje dovnitř zvětšeného nástroje, takže se dá přepnout nástroj
  bez opuštění celé obrazovky (fullscreen převezme nový nástroj).

Časovač si zvuk skládá v `AudioContext` — žádný soubor navíc, funguje offline.
Skóre týmů a seznamy tříd zůstávají v `localStorage`, takže soutěž může běžet
přes několik hodin i dnů.

## Tvorba slidů a prezentace

`obsah/prezentace.html` skládá výklad ze slidů deseti druhů a promítá je na
plátno. Kromě editoru má **okno pro učitele**, **kvíz s vyhodnocením**,
**časovač úkolu** a tisk podkladů.

| Druh slidu | K čemu je |
|---|---|
| titulní | název hodiny a podtitul |
| text | nadpis a odrážky |
| dva sloupce | text vedle textu, nebo text vedle obrázku (dají se prohodit) |
| otázka | zadání; odpověď se odkryje až dalším posunem |
| kvíz | až šest možností, třída hádá, klik nebo klávesa `1`–`9` vyhodnotí |
| obrázek | z adresy, nebo soubor vložený přímo do prezentace |
| citát | velký text s podpisem autora |
| aplikace | **živá aplikace Nodusu** přímo ve slidu |
| časovač | velký odpočet pro samostatnou nebo skupinovou práci |
| tabule | prázdná plocha na kreslení při výkladu |

Na čem stránka stojí:

- **Jedno vykreslení pro všechno.** Náhled, miniatura v seznamu, promítané
  plátno, přehled slidů, okno pro učitele i miniatura v tisku prochází funkcí
  `vykresli`. Promítaný a vytištěný slide se proto nemůžou rozejít a nový druh
  slidu stačí přidat na jediném místě.
- **Pevné plátno 1280 px.** Slide má vždy stejné rozměry (720 px na výšku při
  16:9, 960 při 4:3) a teprve celý se škáluje do místa (`Projektor.vmestnej`).
  Kdyby se místo toho počítalo písmo podle okna, vypadala by příprava na
  projektoru jinak než na notebooku, kde vznikala — a učitel by to zjistil
  až ve třídě.
- **Živě běží jen promítaný slide.** Aplikace se vkládá do rámu jen na plátně;
  v seznamu, v přehledu a v tisku je místo ní zástupce. Dvacet současně
  běžících aplikací by z prohlížeče udělalo topení. Konec promítání rám
  vyprázdní, takže aplikace pod editorem dál neběží.
- **Text se nikdy nevkládá jako HTML.** Zápis zná jen odrážku (`- `),
  mezinadpis (`## `) a `**zvýraznění**`; všechno ostatní projde přes escape.
- **Zadání dřív než řešení.** Otázka i kvíz mají dva kroky (`odkryto`).
  U kvízu špatná volba zčervená a otázka běží dál, správná odkryje řešení
  i vysvětlení — vysvětlení se po chybě **neukáže**, jinak by si ho třída
  přečetla dřív, než dojde ke správné odpovědi.
- **Do podkladů se odpovědi netisknou.** Žák dostane prázdné pole, učitel si
  svou kopii vytiskne s volbou *Tisknout odpovědi a řešení kvízů*.

### Okno pro učitele

Tlačítko *Okno pro učitele* otevře druhé okno téže stránky (adresa s kotvou
`#prezenter`; kotva a ne parametr proto, že service worker má stránku v cache
pod čistou adresou a s parametrem by se okno offline nenačetlo). Na plátně
zůstane slide, na notebooku učitel vidí **poznámky, následující slide, hodiny
a čas od začátku hodiny** a může odtud prezentaci ovládat.

Obě okna spojuje `BroadcastChannel`; kde chybí, zaskočí událost `storage` —
obě cesty doručují jen do *ostatních* oken, takže se okno neposlouchá samo.
Zprávy mají pořadové číslo, jinak by v prohlížeči, kde fungují obě cesty,
přišel každý posun dvakrát. Kanálem chodí **jen pozice**, ne sada: prezentace
s vloženými obrázky má klidně megabajty a posílat je při každém posunu by
okno zadusilo. Okno pro učitele si sadu čte ze stejného `localStorage`.

### Ovládání při promítání

`→`/`mezerník` další, `←` zpět, `1`–`9` odpověď v kvízu, `B` černá, `W` bílá,
`O` přehled slidů, `P` pero, `Z` zpět poslední tah, `E` smazat kresbu,
`T` pozastavit časovač, `N` poznámky, `F` celá obrazovka, `Esc` konec.
Pero má tři tloušťky včetně poloprůhledného zvýrazňovače a kresba se drží
u slidu, ne u obrazovky. Ovládací lišta se sama schová, aby na plátně
nesvítila přes výklad.

Když učitel klikne do aplikace ve slidu, klávesy chytá rám. Přeposílají se
proto do stránky klávesy prezentačního klikátka (`PageUp`/`PageDown`) a `Esc` —
šipky a mezerník ne, ty v aplikaci patří tomu, kdo v ní zrovna něco ovládá.

### Sestavení z textu

Celou prezentaci lze nasypat jako text (`Sada → Sestavit z textu`) a stejně tak
zpátky vypsat — učitel má přípravu v textovém editoru a nemusí ji překlikávat:

```
# Pravěk            → titulní slide (další řádek je podtitul)
---                 → oddělovač slidů
## Doba kamenná     → slide s textem
- paleolit          → odrážka
> zeptat se na …    → poznámka pro učitele (na plátno se nedostane)
? Otázka   / = Odpověď
?? Kvíz    / + správná možnost / * špatná možnost
! adresa | popisek  → obrázek        " text | autor → citát
@ obsah/bunka.html | nadpis → aplikace
T 10 | zadání       → časovač na 10 minut      ___ → tabule
```

Převod tam i zpět zachovává druhy slidů, poznámky i správné odpovědi (hlídá
to test). Čtyři **šablony hodin** (výklad, opakování, skupinová práce, pokus)
jsou popsané stejným zápisem — jsou to jen texty, ne zvláštní kód.

### Další drobnosti, které se osvědčily

- Seznam slidů má miniatury (tentýž `vykresli`, jen zmenšený) a **přetahování myší**;
  `Alt`+`↑`/`↓` posune vybraný, `Ctrl`+`D` duplikuje, `Ctrl`+`Z` vrátí smazaný.
  Mazání se proto na nic neptá — potvrzovací otázka u každého slidu při skládání
  prezentace jen zdržuje.
- Obrázek se dá do slidu **přetáhnout myší**; zmenší se na 1600 px a uloží se
  přímo do prezentace, takže funguje i bez internetu.
- Zápis do `localStorage` má kvótu kolem 5 MB a přeteče typicky vložený obrázek.
  Selhání se **hlásí** — mlčet by znamenalo, že učitel přijde o přípravu, aniž
  by tušil proč.
- Podklady se tisknou po 3 (s linkami na poznámky žáka), 6, 2, nebo po jednom
  na stránku na šířku — poslední volba slouží k uložení prezentace do PDF.
  Arch je vždy bílý papír, i když je prezentace tmavá.

Sady se ukládají do `localStorage` (`nodus_prezentace_v1`) a dají se vyvézt
i načíst jako JSON — tak se příprava přenese na školní počítač.

Testy: `python3 _test/run.py slidy.html` (druhy slidů, textový zápis, kvíz,
časovač, okno pro učitele, vkládání obrázku a tisk).

## Režim projektor

`projektor.js` zvětšuje obraz pro plátno nebo interaktivní tabuli. Zapíná se
v rozcestníku tlačítkem 📽️ nebo klávesou **F8**: schová menu i hlavičku,
požádá o celou obrazovku a nechá na obrazovce jen plovoucí lištu
(zvětšení −/+, výběr aplikace, celá obrazovka, konec). Úroveň zvětšení
si režim pamatuje (`nodus_projektor`).

Zvětšuje se **rám, ne obsah v něm**: rámu se nastaví rozměr zmenšený
o zvolený násobek a `transform: scale()` ho vykreslí na celou plochu.
Stránka uvnitř tak vidí menší okno a rozloží se podle něj. Zkoušelo se
i `zoom` vložený do dokumentu v rámu — u stránek, které staví na `100vh`
(a takových je tu většina: plátna, mapy, glóbusy), se plocha zvětšila i na
výšku, stránka přetekla a začala rolovat. Cena škálování rámu je měkčí
plátno při velkém zvětšení; text a SVG se překreslují ostře.

Rám s aplikací má v `index.html` atribut `allowfullscreen` — bez něj prohlížeč
odmítne celou obrazovku vyžádanou stránkou uvnitř rámu (typicky promítání
z `prezentace.html`).

Testy učitelských stránek: `python3 _test/run.py ucitelske.html`
(kabinet, slidy, promítání, podklady k tisku a režim projektor).

## Stránka živých ukázek

`obsah/predstaveni.html` je stránka, kterou se Nodus ukazuje kolegům, rodičům
nebo na projektoru. Neříká, co web umí — **nechá to vyzkoušet**: sedm zkrácených,
ale plně funkčních aplikací pod sebou.

| Ukázka | Co se v ní dá dělat | Předloha |
|---|---|---|
| Gravitační hřiště | tažením vystřelit planetku s předpovědí dráhy, zapnout gravitační pole a vektory, sledovat elipsu, dobu oběhu a výstřednost | `gravitacni_hriste.html` |
| Periodická tabulka | všech 118 prvků, klik dopočítá konfiguraci a rozběhne Bohrův model | `periodic_table.html` |
| Aerodynamický tunel | táhnout překážku proudem, měnit velikost a rychlost větru | `vitr_tunel.html` |
| Stavba buňky | klikat na organely v číslovaném schématu, přepínat rostlinnou/živočišnou | `bunka.html` |
| Kvadratická funkce | jezdci měnit a, b, c, sledovat vrchol, kořeny a diskriminant | `grafy_funkci.html` |
| Procvičování | odpovídat na 34 úloh z 11 předmětů s kartičkou „proč“ | jádro `uloha.js` |
| Generátor testů | složit a vytisknout list podle ročníku, tématu a obtížnosti | `pracovni_listy.html` |

Stránka **záměrně neodkazuje na plné verze aplikací** — každá karta místo toho
nese štítek *Ukázková verze* a pořadí (`3 / 7`). Kdo se chce dostat dál, má
k tomu tlačítka v úvodu a v závěru; uvnitř ukázky nemá co odvádět pozornost.

Kolem ukázek je pak to, co potřebují ostatní dvě publika: pás **pro školu**
(nic se neinstaluje, offline, data zůstávají ve škole, podle osnovy ZŠ) pro toho,
kdo o nasazení rozhoduje — mluví **jen o provozu, ne o ceně a účtech**, aby si
web nechal otevřené dveře k případné monetizaci, a **lepivá lišta ukázek** pro toho, kdo stránku
promítá — skáče se s ní mezi ukázkami a zvýrazněná položka říká, kde v pořadí
zrovna jsme. V hlavičce se kreslí síť uzlů (značka Nodusu je uzel); je to jen
kulisa pod obsahem, která se při `prefers-reduced-motion` nakreslí jednou
a zůstane stát.

Pravidla, kterými se stránka řídí:

- **Soběstačnost.** Stránka má vlastní kopii palety z `common.css`, vlastní
  přepínač motivu, vlastní vyhodnocení odpovědí i vlastní vektorové schéma buňky.
  Sdílené `podpis.js` a `apps.js` jsou v ní jen jako doplněk — když se soubor
  pošle mailem nebo nahraje jinam a oba chybí, stránka funguje dál (podpis si
  v takovém případě dopíše do patičky sama). Cena je jedno místo navíc při
  změně palety.
- **Vlastní motiv.** Jako jediná stránka Nodusu startuje ve **světlém** režimu –
  promítá se a ukazuje. `theme.js` proto nelinkuje (srovnával by ji se zbytkem
  webu) a volbu si pamatuje pod vlastním klíčem `nodus_ukazky_tema`; přepnutí
  tady nepřeklopí celý Nodus ani naopak. Výchozí `data-theme="light"` je rovnou
  v `<html>`, aby při načtení neproblesklo tmavé pozadí.
- **Tři režimy podle katalogu.** Podle toho, jestli se povedlo načíst `apps.js`,
  se stránka chová jako podstránka rozcestníku (volba se posílá rodiči přes
  `postMessage`), jako samostatně otevřená stránka Nodusu (odkazy na
  `../index.html#soubor`), nebo jako osamocený soubor — pak se odkazy do Nodusu,
  čísla katalogu i podpisový pruh nahradí tím, co dává smysl bez zbytku webu.
- **Data se neopisují.** Prvky, výpočet elektronové konfigurace, popisky organel
  i banky úloh generátoru jsou převzaté ze zdrojů plných verzí, aby ukázka
  neříkala něco jiného než aplikace, kterou má představit. Výjimkou je schéma
  buňky: to je nakreslené znovu (plná verze stojí na fotografii `Anatomy/Cell.png`,
  a 1,2 MB obrázku by ze stránky udělalo něco, co se nedá poslat jako jeden soubor).
  Kresba drží vlastní barvy nezávisle na motivu — organely mají v učebnicích
  ustálené barvy a na tmavém podkladu by ztratily kontrast.
- **Předpověď kreslí totéž, co pak poletí.** Dráha při míření se v gravitačním
  hřišti dopočítává **stejným leapfrogem** jako běžící simulace, dopředu do
  prvního oběhu, pádu do hvězdy nebo úniku z plátna; barva rovnou říká výsledek
  (zelená / červená / oranžová). Kdyby předpověď byla vlastní aproximace,
  ukázka by lhala. Gravitace samotná se dá **přikreslit** tlačítkem *Ukázat
  gravitaci* (výchozí je vypnutá, ať je v prázdném vesmíru vidět hlavně dráha):
  mřížka šipek k hvězdě s délkou podle 1/r² a u každé planetky žlutý vektor síly
  se zeleným vektorem rychlosti. Na fyziku přepínač nesahá, ta běží pořád.
- **Běží jen to, co je vidět.** Každé plátno má vlastní `IntersectionObserver`;
  šest současně běžících animací by jinak zbytečně vytěžovalo notebook i tablet.

Pasti, na které se při psaní narazilo:

1. `grid-template-columns: 1fr` u sloupce s periodickou tabulkou se na mobilu
   roztáhl na šířku mřížky (580 px), vodorovný posuv uvnitř neměl co posouvat
   a tabulka se jen oříznula. Správně je **`minmax(0, 1fr)`** plus `min-width: 0`
   na položkách mřížky.
2. Duhová škála rychlosti (modrá → zelená → červená) v tunelu udělala ze
   **zeleného** volného proudu vizuální šum. Škála je proto zakotvená v rychlosti
   větru (modrá) a teprve zrychlení hoří do oranžova; ve světlém režimu má
   vlastní, tmavší sadu, jinak na bílém papíře zmizí.
3. Graf funkce musí **posunout výřez za vrcholem** — u malého `a` nebo velkého
   `c` leží vrchol mimo plátno a jezdec pak vypadá, že nic nedělá.
4. Skok z lišty musel dostat **vlastní obsluhu**: samotné `scroll-margin-top`
   nestačilo, protože `scrollIntoView` na zvýrazněné položce lepivé lišty
   dorovnával i svislé rolování a hlavička karty skončila schovaná pod lištou.
   Lištou se proto posouvá jen vodorovně a stránka se roluje ručně.
5. Míchaný list (*Mix témat ročníku*) nesmí být jen seznam úloh: u zadání jako
   „hustota →“ nebylo poznat, co se má dělat. Vybere se proto **pár témat**
   (zhruba jedno na čtyři úlohy, ne celý ročník) a úlohy se sázejí **po oddílech**
   s pokynem nad každým z nich; číslování běží přes celý list.
6. Linka na odpověď patří jen k úlohám, kde se odpovídá **za** zadání.
   Doplňovačky (vyjmenovaná slova, bě/pě/vě/mě) se vyplňují přímo ve slově —
   generátor je proto značí `vText: true` a linka se u nich vynechá; stejně tak
   u zadání, které si místo udělalo samo („značka ____, jednotka ____“).
7. Arch generátoru testů je jako v plné verzi **vždycky bílý papír**, takže
   uvnitř `.list` schválně nejsou proměnné motivu; ve světlém režimu by se
   jinak linky na jméno a čísla úloh slily s papírem.
8. Tisk schovává obsah pravidlem **„všechno kromě archu“**
   (`body > *:not(.obal)`, `.obal > *:not(#test)`), ne výčtem konkrétních
   prvků — ten se rozešel s obsahem, jakmile stránka dostala pás pro školu
   a lištu ukázek, a ty pak vyjely na papír nad arch. `@page { margin: 14mm }`
   musí být **mimo** `@media print`; vnořené `@page` Chrome zahodí a arch
   doléhá na ořezovou hranu.

## Psaní nové procvičovací aplikace

Stránka vystačí s krátkou kostrou – styly řeší `vyuka.css`, chování odpovědí `uloha.js`:

```html
<link rel="stylesheet" href="../common.css">
<link rel="stylesheet" href="../vyuka.css">
<script src="../theme.js"></script>
<script src="../podpis.js" defer></script>
<script src="../rec.js"></script>
<script src="../uloha.js"></script>
```
```js
const skore = Uloha.skore('nodus_muj_klic', document.getElementById('skore'));
Uloha.vyber({
  kam: plocha, odezva, moznosti: [{ klic: 'a', ikona: '🌷', popis: 'jaro' }, …],
  spravnyKlic: 'a', zpravaOk: '✅ …', poSpravne: skore.vyhodnot, dalsi: novaUloha,
});
```

K dispozici jsou i `Uloha.zamichej`, `Uloha.nahodne`, `Uloha.nahodneCislo` a `Uloha.trhni`
(pro vlastní úlohy typu klikání do obrázku nebo řazení do pořadí).

Volitelné pole `prodleva` říká, za jak dlouho se nabídne další otázka. Smí to být
i funkce `(napoprve) => ms` — stránky, které po odpovědi ukazují kartičku
s vysvětlením, potřebují delší pauzu, a po chybě ještě delší, protože právě
tehdy si má žák vysvětlení přečíst. Bez pole platí `Uloha.PRODLEVA` (900 ms).

## Posun na další otázku

Jak dlouho se po odpovědi čeká, si řídí **uživatel** — každý čte kartičku
„proč“ jinak rychle. Volba je jediná pro celý Nodus (`nodus_posun`
v `localStorage`) a `uloha.js` si k ní sám vloží přepínač do lišty `.ovladani`
každé procvičovací stránky; do stránek se kvůli tomu nesahá.

| Volba | Co dělá |
|---|---|
| automaticky – normálně / déle / hodně dlouho | pauzu, kterou si spočítala stránka, **násobí** 1× / 1,8× / 3× |
| ručně | místo časovače se pod kartičku vloží tlačítko **Pokračovat →** |

Násobek (a ne pevný počet vteřin) je zvolený schválně: zachová poměr mezi
krátkým „✅ Správně“ a rozborem souvětí, takže si stránky dál řídí vlastní
tempo a nastavení jen posune celou škálu.

Nové stránky nemusí dělat nic — stačí `dalsi` v `Uloha.odpoved`. Kdo si posun
plánuje sám (například po druhé chybě), volá místo `setTimeout(novaUloha, ms)`
funkci **`Uloha.posun(novaUloha, ms)`**; jinak by na takové stránce volba
neplatila.

## Pravopisné a mluvnické stránky

Stránky o pravopisu (`doplnovacky`, `vyjmenovana_slova`, `shoda_podmetu`,
`diktat_gen`, `cj2_tvrde_mekke`, `cj3_parove`, `cj2_abeceda`) a celá skupina
**Tvarosloví & skladba** (`cj2_druhy_vet`, `slovni_druhy`, `cj3_slovesa`,
`cj3_podstatna`, `cj4_pady`, `synonyma_antonyma`, `cj4_stavba_slova`,
`cj5_pridavna`, `cj5_skladebni_dvojice`, `cj5_zajmena_cislovky`, `vetny_rozbor`,
`cj6_slovni_zasoba`, `cj7_rozvijejici`, `cj7_neohebne`, `cj7_slovotvorba`,
`cj8_souveti`, `cj9_vyvoj_jazyka`), skupina **Čtení & literatura**
(`slabiky`, `cteni_s_porozumenim`, `cj6_baje`, `cj9_literatura_20`,
`literarni_smery`) a **Sloh a komunikace** (`cj4_prima_rec`, `cj8_sloh`)
drží stejný postup, aby se dítě neučilo pokaždé nové ovládání.
Díly na to jsou ve `vyuka.css`:

| Třída | K čemu je |
|---|---|
| `.veta-uloha` | věta nebo slovo s vynechaným písmenem; `.mezera.prazdna` je prázdné místo, `.mezera.doplneno` už doplněné |
| `.spoust` | písmeno, **podle kterého se pravopis rozhoduje** (obojetná souhláska, souhláska před i/y) – svítí žlutě už v zadání |
| `.podmet`, `.slovo-klik` | podtržený podmět a klikací slova ve větě (tečkovaná linka je vidět i na dotykovém displeji, kde není hover) |
| `.pravidlo` | kartička **proč** – ukáže se až po odpovědi (`.ok`), nebo na vyžádání jako nápověda (`.tip`) |
| `.rada` | pás vyjmenovaných slov; `span.sviti` rozsvítí to, o které v úloze šlo |
| `.pomucka` | trvalý přehled pod úlohou (souhlásky, páry, rody, abeceda); `.znak.sviti` rozsvítí právě probírané místo |
| `.klavesy`, `kbd` | klávesové zkratky vypsané u úlohy, ne až v patičce |
| `.pruh` | ukazatel postupu série |

Pravidla, která z toho plynou:

1. **Kde se rozhoduje, musí být vidět předem** (`.spoust`, podtržený podmět),
   **proč to tak je, až potom** (`.pravidlo.ok`). Kartička s pravidlem se nikdy
   neukazuje dřív než odpověď – jinak není co procvičovat.
2. **Nápověda zužuje, neprozrazuje.** Ukáže řadu, ve které se má hledat, rozsvítí
   souhlásku v přehledu, ztlumí polovinu možností — správnou odpověď neřekne.
3. **Chyba nezavírá úlohu.** Špatná možnost zaklepe a zčervená, otázka běží dál
   (řeší `uloha.js`); do skóre se počítá jen odpověď napoprvé.
4. **Přehled pod úlohou žije.** Souhláska, pár, rod, vzor nebo druh se v něm po
   odpovědi rozsvítí — přehled tak není jen text, ale ukazuje, kam probíraný jev patří.
5. **Odpověď se vysvětlí, ne jen potvrdí.** Po správné odpovědi přibude
   `.pravidlo.ok` s celým rozborem (mluvnické určení, schéma souvětí, stavba slova)
   a s větou, *proč* to tak je. Kvůli tomu má stránka delší `prodleva`
   (zhruba 2 s napoprvé, 3 s po chybě) — jinak kartička zmizí dřív, než se přečte.
6. **Nápověda je v `#btnNapoveda` a na klávese `H`.** Vloží `.pravidlo.tip`
   s postupem („na co se zeptej“) a ztlumí polovinu špatných možností. Sérii
   správných odpovědí napoprvé ukazuje `.ovladani .serie` (🔥 od tří).

## Zpracování připravovaného tématu

Momentálně žádné připravované téma v katalogu není, ale mechanika zůstává pro
další rozšiřování osnovy. Placeholder stránka popisuje, co má aplikace umět,
a cituje očekávaný výstup RVP. Až téma zpracuješ:

1. Přepiš `obsah/<slug>.html` na skutečnou aplikaci
   (v `<head>` nalinkovat `../common.css`, `../theme.js` a `../podpis.js`).
2. V `apps.js` u položky **smaž pole `stav`** — tím zmizí značka 🚧 z menu
   a téma se v osnově přepne na hotové.
3. Zvyš verzi cache v `sw.js` (`nodus-vN`), jinak návštěvníci uvidí novinku
   až při druhém načtení.

## Přidání nového tématu

Záznam do příslušné sekce v `apps.js` (`soubor`, `nazev`, `tagy`, `predmet`,
`rocniky`, případně `stav: 'plan'`) a odpovídající stránka v `obsah/`.

## Proudové motory

`obsah/proudove_motory.html` ukazuje v řezu osm druhů motorů (turbo-jet,
turbo-fan, turbo-prop, turbo-shaft, ram-jet, scramjet, raketový motor a
průmyslovou plynovou turbínu) a nechá jimi protékat vzduch. Stojí na dvou
věcech, které se nesmí rozejít:

- **Geometrie.** Každý motor je pár kanálů popsaných klíčovými body
  `[x, vnější poloměr, vnitřní poloměr]`; kreslí se horní polovina a zrcadlí
  se dolů. `hranice` říká, kudy vede stěna, `vypln` (jen dvouproudový motor)
  kudy sahá výplň kanálu před rozdělovačem a `stenaIn` kde se kreslí
  rozdělovač proudů. Body za `hranice` slouží jen vlečce za tryskou.
- **Fyzika.** Tlaky a teploty počítá Braytonův cyklus z tlakového poměru
  kompresoru, teploty před turbínou a náporu (`ramT`, `ramP`) — proto čísla
  v měřicím panelu odpovídají skutečným motorům a proto ram-jet pod M 0,8 sám
  hlásí, že nemá tah. Rychlost proudu se **nekreslí od oka**: plyne z rovnice
  kontinuity `v ~ T / (p · A)`, takže se proud sám zrychlí v trysce a zpomalí
  v širokém sání. Ze stejného vzorce žije i graf pod motorem.

Dvě vědomé úlevy oku: teplota a tlak mají škálu společnou pro všechny motory
(jinak by 1 400 K výtok rakety vypadal stejně žhavě jako komora turbo-jetu) a
rychlost částic se násobí `stav.zisk`, protože turbovrtulový motor má výtok
130 m/s a proudový 900 — bez srovnání by jeden stál a druhý mihotal. Naměřená
čísla v panelu zůstávají skutečná.

Testy: `python3 _test/run.py motory.html` (cyklus, proudění a vykreslení všech
osmi motorů), `motory_paticka.html` (úzké okno 420 px) a `motory_snimky.html`,
který uloží snímek každého motoru do `_test/motor_*.png` — geometrii je potřeba
kontrolovat okem.

## Psací písmo

Ve složce `fonty/` je **Playwrite CZ** – česká varianta školní psací abecedy
(OFL, plná diakritika, 68 kB). `common.css` ho deklaruje jako `--font-psaci`,
takže stránka jen napíše:

```css
.pismenko { font-family: var(--font-psaci); line-height: 1.9; }
```

Soubor se stáhne až ve chvíli, kdy ho stránka opravdu použije; v `sw.js` je
v `JADRO`, takže funguje i offline. Vysoký řádek není zbytečnost – psací tvary
mají nahoře kličku a dole smyčku a při `line-height: 1` lezou z rámce ven.

Zatím ho používá `obsah/cj1_pismena.html` (úloha *Velké a malé*), kde si dítě
přepne mezi tiskacím a psacím písmem; volba se pamatuje v `localStorage`.

## Čtení nahlas

Stránky s procvičováním umí předříkat zadání přes Web Speech API. Volá se přes
sdílený `rec.js`, nikdy ne přímo `speechSynthesis` – samotné `'speechSynthesis'
in window` je totiž pravda i v prohlížeči bez jediného nainstalovaného hlasu
a řeč se pak „přehraje“ do ticha.

```html
<script src="../rec.js"></script>
```
```js
Rec.mluv('máma', { rychlost: 0.8 });          // vrací false, když hlas chybí
Rec.hlidejTlacitko(document.getElementById('btnCist'));
Rec.poznamkaOHlasu(rodicovskyPrvek);          // vysvětlivka, když hlas chybí
```

Pořadí je dané: **systémový hlas** (zní nejlíp), a když žádný pro daný jazyk
není, sáhne se po **vestavěném hlasu** ve složce `hlas/` (meSpeak = eSpeak
v JavaScriptu). Web tak mluví i na počítači bez jediného nainstalovaného hlasu –
typicky na Linuxu, kde `speech-dispatcher` bez syntetizéru hlásí jen modul `dummy`.

Vestavěný hlas se stahuje **až při prvním přehrání** (jádro 1,5 MB, gzipem asi
0,5 MB), pak si ho service worker drží v cache a funguje i offline. Zní strojově;
hezčí je systémový hlas (na Linuxu `sudo pacman -S espeak-ng`, ověření
`spd-say -l cs "ahoj"`, pak restart prohlížeče).

Podporované jazyky vestavěného hlasu: čeština, angličtina, němčina, francouzština
(přidání dalšího popisuje `hlas/LICENCE.md`).

## Vazba na hlavní web

Nodus je záměrně samostatný — složku lze nasadit i na vlastní doménu nebo
do jiného repozitáře. Zůstávají jen tyto vazby na nadřazený web
(`../../obsah/`, po vyjmutí složky vedou do prázdna):

- `obsah/iss.html`, `obsah/planet_globe.html` → odkaz na `weather_globe.html` (glóbus počasí)
- `obsah/eduMaps.html` → odkaz na `map_export.html` (tvorba map)
- `obsah/prehled.html` a `obsah/predstaveni.html` (patička) a `index.html`
  (tlačítko *Ostatní aplikace*) → `../index.html`

Opačným směrem je hlavní web závislý na této složce jediným místem:
`obsah/weather_globe.html` používá textury Země z `../nodus/obsah/textures/`
(aby se 34 MB textur neduplikovalo). Při osamostatnění Nodusu je potřeba textury
zkopírovat zpět.

## Vývoj a nasazení

```bash
./test_local.sh          # z kořene repozitáře, pak http://localhost:8000/nodus/
./upload.sh "zpráva"     # commit + push na GitHub Pages
```

Testovat vždy přes lokální server — otevření přes `file://` blokuje CORS
(textury, fetch, moduly).
