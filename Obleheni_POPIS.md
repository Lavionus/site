# 🏝️ Ostrov v obležení: popis hry

*Návrh nové hry, verze 6. 10. 2026. Vychází z Tower Defense (`obsah/tower_defense.html`) a ze
Sector Defense (`obsah/tower_defense_sc.html`). Ostrov se generuje podobně jako v Trosečnících
(`obsah/trosecnici/svet.js`). Kódová jména souborů a jmenného prostoru jsou návrh.*

> **Stav 6. 10. 2026:** hra je hotová podle tohoto popisu. Rozhodnutí z odpovědí na otevřené otázky
> (fantasy, mapa 32 × 24 bez posunu, věže bez výdrže, předem dané cesty, SVG/kód grafika, jen zlato)
> a odchylky (vtrh pěchoty jako únik v TD) jsou v `Obleheni_PLAN.md`.

Ostrov v obležení je tower defense, kde hráč **brání ostrov**. Útoky nepřicházejí po jedné předem
nakreslené cestě. Přicházejí **z moře, ze vzduchu a nakonec i po souši**. Lodě obeplouvají mělčiny
a útesy, ostřelují pobřeží a na plážích vysazují výsadky. Letci letí přímo přes ostrov a vítr je
unáší. Mořské příšery se vynořují tam, kde je nikdo nečeká. Ostrov se pokaždé vygeneruje znovu ze
**seedu**, takže každá hra má jiné pláže, útesy, kopce a průlivy. Stejný seed ale dá vždy stejný ostrov.

Cíl je ubránit **pevnost** (citadelu) uprostřed ostrova a udržet naživu **přístav a vesnice**,
ze kterých plyne zlato.

---

## Obsah

1. [Hlavní rozhodnutí](#1-hlavní-rozhodnutí)
2. [Co se přebírá z Tower Defense a co se mění](#2-co-se-přebírá-z-tower-defense-a-co-se-mění)
3. [Ostrov: generátor ze seedu](#3-ostrov-generátor-ze-seedu)
4. [Pevnost, přístav a vesnice](#4-pevnost-přístav-a-vesnice)
5. [Tři fronty: moře, vzduch, souš](#5-tři-fronty-moře-vzduch-souš)
6. [Nepřátelé](#6-nepřátelé)
7. [Věže a stavby](#7-věže-a-stavby)
8. [Aury, specializace, sloučení a hodnosti](#8-aury-specializace-sloučení-a-hodnosti)
9. [Pasti a zátarasy](#9-pasti-a-zátarasy)
10. [Počasí, příliv, vítr, den a noc](#10-počasí-příliv-vítr-den-a-noc)
11. [Ekonomika](#11-ekonomika)
12. [Vlny, hlídka a bossové](#12-vlny-hlídka-a-bossové)
13. [Schopnosti velitele](#13-schopnosti-velitele)
14. [Režimy: souostroví, nekonečná obrana, ostrov dne](#14-režimy-souostroví-nekonečná-obrana-ostrov-dne)
15. [Grafika a zvuk](#15-grafika-a-zvuk)
16. [Rozhraní a ovládání](#16-rozhraní-a-ovládání)
17. [Technické řešení](#17-technické-řešení)
18. [Postup vývoje po etapách](#18-postup-vývoje-po-etapách)
19. [Otevřené otázky](#19-otevřené-otázky)

---

## 1. Hlavní rozhodnutí

| | |
|---|---|
| Pohled | shora, mřížka polí jako v Tower Defense |
| Mapa | 48 × 34 polí. Ostrov zabírá zhruba 40–55 % plochy, zbytek je moře. Na mobilu jde mapu posouvat a přibližovat. |
| Cesty | **žádná pevná cesta**. Lodě plují po vodě podle hloubky, pozemní jednotky hledají cestu po souši k pevnosti, letci letí přímo. |
| Prohra | pevnost přijde o všechny body výdrže (místo „životů“ v TD) |
| Čas | reálný čas s pauzou, ⏸ / 1× / 2× / 3×. Simulace má pevný krok 30 tahů za sekundu, aby byla deterministická. |
| Náhoda | vše ze seedu (mulberry32 jako v TD a Trosečnících): ostrov, složení vln, počasí, vlastnosti nepřátel |
| Režimy | kampaň **Souostroví** (8 ostrovů), **Nekonečná obrana** na jednom ostrově, **Ostrov dne** |
| Téma | věk plachetnic s fantasy prvky: piráti, armáda cizí říše, mořské příšery, wyverny, harpyje, balony |
| Obtížnost | lehká / normální / těžká, stejné tři stupně jako v TD |

**Proč bez pevné cesty:** ostrov má pobřeží ze všech stran, takže útok může přijít odkudkoli. Jádro
hry je proto číst mapu. Hráč hledá, které pláže jsou přístupné, kde vede hluboký průliv a kam
dostřelí dělo z útesu. Na každém seedu to vychází jinak, a proto se hra neohraje.

---

## 2. Co se přebírá z Tower Defense a co se mění

| oblast | Tower Defense | Ostrov v obležení |
|---|---|---|
| mapa | náhodná lomená cesta, kopce a dolíky | generovaný ostrov: hloubka moře, pláže, útesy, kopce, les, řeka, bažina |
| cíl nepřátel | dojít na konec cesty | lodě: vylodit se nebo ostřelovat; pěchota: dojít k pevnosti; letci: zaútočit na pevnost nebo věže |
| životy | 20–25 životů, únik ubere 1–12 | pevnost má body výdrže, každý typ nepřítele ubere podle síly; přístav a vesnice mají vlastní výdrž |
| věže | nesmrtelné | **mají výdrž**: lodě, příšery a některé letce na ně útočí. Opravují se za zlato. |
| stavba | kamkoli mimo cestu | jen na souši; pobřežní věže jen u vody; výsledek ovlivňuje výška terénu |
| proti letcům | odstřelovač, tesla, laser, drony, radar | samostatná větev: harpunová balista, mušketýři, maják jako „radar“ |
| aury sousedů | ano (Chebyshevova vzdálenost 1) | **zůstává**, typy aur se přizpůsobí tématu |
| specializace na úrovni 3 | 2 volby | **zůstává** |
| sloučení 2×2 / 4×4 | mohutná a supermohutná věž | **zůstává** (bašta / pevnůstka) |
| hodnosti věží (XP) | Rekrut až Legenda | **zůstává** |
| imunity a odolnosti | 1 imunita + odolnosti vůči typům věží | **zůstává** |
| modifikátory vln | mlha, bouře, požehnání, posílení | nahrazuje je **počasí** (vítr, příliv, mlha, bouře) |
| artefakty z bossů | 5 trvalých bonusů | **zůstává**, tematicky (např. Kompas mrtvého kapitána) |
| pasti | bodce, bahno, mina | zátarasy na pláži, námořní miny, řetězová závora přes průliv |
| schopnosti | nálet, zmrazení | salva flotily, brander, bouře |
| biomy | změna vzhledu po levelu | každý ostrov souostroví má svůj biom (tropy, sopka, mlžné severní, korálový atol…) |
| endless | ano | ano, na jednom ostrově s rostoucí silou |

---

## 3. Ostrov: generátor ze seedu

Generátor je čistá funkce `generuj(seed, biom, velikost)` bez DOM. Volné kroky (inspirace
`trosecnici/svet.js`, kód se **zkopíruje, nesdílí**):

1. **Výška**: radiální spád od středu × fbm šum (3–4 oktávy). Seed posune střed, protáhne tvar
   (elipsa, půlměsíc) a občas přidá menší satelitní ostrůvek.
2. **Hloubka moře** podle vzdálenosti od pobřeží a šumu: `mělčina` (1–2 pole od břehu, korály),
   `střední`, `hluboké`. Na mělčinu nevyplují velké lodě. Hloubka se mění s přílivem (viz [10](#10-počasí-příliv-vítr-den-a-noc)).
3. **Pobřeží**: v každém úseku se podle sklonu rozhodne, jestli bude **pláž** (vylodění možné),
   nebo **útes** (vylodění nemožné, věž na útesu má velký dostřel na moře).
4. **Vnitrozemí**: louka, les (zpomaluje pěchotu, kryje před dělostřelbou, dá se vykácet),
   kopec (+dosah věží), skála (nestavitelná, neprůchodná), bažina (pomalá), **řeka** od kopců k moři
   (malé čluny jí mohou plout dovnitř ostrova!), **laguna** se zúženým vjezdem.
5. **Pevnost** se umístí na vyvýšené místo blízko středu. **Přístav** v nejchráněnější zátoce
   s hlubokou vodou. **1–3 vesnice** na loukách.
6. **Kontrola hratelnosti** (generátor zkouší další seed z řady, dokud neprojde):
   - aspoň 3 pláže, každá dosažitelná po vodě z okraje mapy a spojená po souši s pevností,
   - aspoň 2 různé světové strany, odkud lze doplout,
   - pevnost je od nejbližší pláže aspoň 8 polí cesty (prostor pro obranu),
   - aspoň 40 % souše je stavitelné.
7. **Body nástupu**: na okrajích mapy se vyberou 4–8 míst, odkud připlouvají lodě a přilétají
   letci. Jsou označené růžicí kompasu a hlídka hlásí, které z nich se v další vlně použije.

Seed se ukáže v nabídce (šestimístný kód), dá se zkopírovat a zadat ručně. Tlačítko „Jiný ostrov“
vygeneruje nový. Náhled ostrova se kreslí ještě před začátkem hry.

---

## 4. Pevnost, přístav a vesnice

| stavba | výdrž | co dělá | když padne |
|---|---|---|---|
| 🏰 **Pevnost** | 100 (lehká 130, těžká 75) | hlavní cíl; sama má slabé dělo s malým dosahem | prohra |
| ⚓ **Přístav** | 60 | +příjem zlata za vlnu; odemyká stavbu vlastních lodí (strážní šalupa) | příjem −40 %, šalupy nelze stavět, lze obnovit za zlato mezi vlnami |
| 🏘️ **Vesnice** | 30 každá | +příjem zlata, domobrana (malý bonus k opravám) | ztracený příjem, lze obnovit mezi vlnami |

Pevnost se mezi vlnami sama opraví o 5 bodů. Sklad (stavba) a artefakty mohou opravy zrychlit,
podobně jako 🏭 Sklad a 🏰 Hradby v TD obnovovaly životy.

---

## 5. Tři fronty: moře, vzduch, souš

### Moře
- Lodě plují po **poli toků** spočteném zvlášť pro každou třídu ponoru: čluny (i mělčina a řeka),
  brigy (střední a hluboká voda) a galeony (jen hluboká).
- Každá loď má **úkol**:
  - *výsadek*: doplout k přidělené pláži, vysadit pěchotu a odplout (nebo zůstat a krýt palbou),
  - *ostřelování*: zakotvit v dostřelu cíle (pobřežní věž, přístav, vesnice, pevnost) a pálit,
  - *proplutí*: pirátská loď, která chce jen „uloupit“ zlato v přístavu a utéct, jako únik v TD.
- Lodě mají **boky**: plnou salvu dají jen bokem, takže před palbou natáčejí. To je čitelné
  a dá se toho využít, protože otočená loď je chvíli bezbranná.
- Potopená loď zanechá na pár sekund trosky, které zpomalují další lodě (drobný efekt).

### Vzduch
- Letci letí **přímo** k cíli. Vítr je unáší (viz [10](#10-počasí-příliv-vítr-den-a-noc)),
  takže skutečná trasa je mírně zakřivená a hráč ji vidí v náhledu přerušovanou čarou.
- Některé letce zajímá pevnost, jiné útočí na věže (harpyje, wyverny), další shazují pěchotu
  (balony s výsadkem) kamkoli na ostrov.
- Na letce střílí jen věže s protivzdušnou schopností nebo věže v auře majáku (jako 📡 Radar v TD).

### Souš
- Pěchota z výsadků jde po **poli toků k pevnosti**. Cesta se přepočítá po každé stavbě.
- Palisády a zdi **mohou zablokovat** průchod, ale ne úplně. Stavba, která by od pevnosti odřízla
  poslední pláž, se nepovolí (stejně jako bludiště v klasických TD).
  Hráč si tak může stavět **bludiště na souši**, ale ne zátaras.
- Pěchota cestou útočí na věže, které má v bezprostřední blízkosti (sapéři bourají zdi).
- Pozemní nepřátelé, kteří dojdou k pevnosti, na ni útočí, dokud nepadnou. Nezmizí tedy jako
  „únik“ v TD. To je velká změna: hráč má ještě šanci je dorazit.

---

## 6. Nepřátelé

Hodnoty jsou výchozí návrh k vyvážení (HP, rychlost v polích/s, škoda na pevnosti).

### Lodě
| | nepřítel | HP | rychlost | ponor | úkol | zvláštnost |
|---|---|---|---|---|---|---|
| 🛶 | Pirátský člun | 40 | 2,2 | mělký | výsadek 2 pěšáků | pluje i po řece a laguně |
| ⛵ | Šalupa | 110 | 1,8 | střední | ostřelování | rychle natáčí boky |
| 🚢 | Brigantina | 260 | 1,3 | střední | výsadek 6 | |
| 🏴‍☠️ | Lupičská loď | 180 | 2,0 | střední | proplutí do přístavu | ukradne zlato, pokud doplave |
| ⚓ | Válečná galeona | 700 | 0,9 | hluboký | ostřelování | pancíř 8, dvě salvy |
| 🔥 | Brander (nepřátelský) | 90 | 2,4 | střední | najede do pobřežní věže a vybuchne | |
| 👻 | Přízračná loď | 300 | 1,4 | střední | výsadek kostlivců | v mlze neviditelná, prochází mělčinou |

### Mořští tvorové (pod hladinou)
| | nepřítel | HP | zvláštnost |
|---|---|---|---|
| 🦈 | Žraločí smečka | 30 ×4 | rychlá, napadá vlastní šalupy |
| 🐍 | Mořský had | 350 | **ponořený**: viditelný jen v dosahu majáku nebo když útočí; obtáčí a drtí pobřežní věž |
| 🦀 | Obří krab | 220 | vyleze na pláž a pokračuje po souši jako pěchota |

### Letci
| | nepřítel | HP | rychlost | cíl | zvláštnost |
|---|---|---|---|---|---|
| 🦅 | Harpyje | 35 | 3,0 | věže | hejna po 5 |
| 🎈 | Výsadkový balon | 150 | 0,8 | libovolné místo | při sestřelení vysadí polovinu pěšáků; silně unášen větrem |
| 🐉 | Wyverna | 400 | 1,8 | věže, pak pevnost | plive oheň plošně, zapaluje les |
| 🪁 | Kluzák s granátníkem | 60 | 2,6 | pevnost | jen při větru zezadu, shodí bombu |

### Pěchota (po vylodění)
| | nepřítel | HP | zvláštnost |
|---|---|---|---|
| 🗡️ | Pirát | 45 | základ |
| 🛡️ | Mariňák | 120 | pancíř 5 |
| 🪓 | Sapér | 70 | bourá zdi a pasti |
| 🔫 | Mušketýr | 60 | střílí na věže z dálky 3 polí |
| 💀 | Kostlivec | 50 | z přízračné lodi; imunní vůči jedu, zranitelný ohněm |
| 🥁 | Bubeník | 80 | aura: sousední pěšáci +20 % rychlost (protějšek 💊 léčitele v TD) |

**Vlastnosti z TD zůstávají:** každý nepřítel dostane jednu imunitu (mráz/jed/omráčení/kritický
zásah, tady spíš oheň/zpomalení/omráčení/kritický zásah) a odolnost 25–45 % vůči 1–2 typům věží,
ikonky nad pruhem HP a popis po najetí myší.

---

## 7. Věže a stavby

Ceny jsou výchozí odhad. „Moře / Vzduch / Souš“ = na koho věž umí střílet.

| | věž | cena | moře | vzduch | souš | kde smí stát | popis |
|---|---|---|---|---|---|---|---|
| 🏹 | **Strážní věž** (lučištníci) | 70 | ✓ (jen blízko) | – | ✓ | souš | rychlá, levná, základ |
| 💥 | **Pobřežní dělo** | 150 | ✓ | – | – | pole sousedící s vodou | dlouhý dostřel na moře; na útesu +30 % dosah |
| 💣 | **Moždíř** | 180 | ✓ | – | ✓ | souš | plošný výbuch, vrchní dráha, nemá minimální dosah jen do 2 polí |
| 🎯 | **Harpunová balista** | 160 | ✓ | ✓ | – | souš | proti letcům a příšerám; harpuna zpomalí a „přitáhne“ |
| 🎖️ | **Mušketýři** | 140 | – | ✓ | ✓ | souš | rychlá palba na vzduch i souš, krátký dosah |
| 🔥 | **Kotel řeckého ohně** | 210 | ✓ | – | ✓ | u vody nebo na pláži | zapálí moře / zem: plocha hoří několik sekund (DoT), zapaluje lodě |
| 🏮 | **Maják** | 175 | – | – | – | souš, nejlépe kopec | neútočí; odhalí ponořené tvory a přízračné lodě, sousedé zasáhnou letce (jako 📡 Radar), v noci a v mlze vrací dosah |
| 🚩 | **Prapor** | 150 | – | – | – | souš | neútočí; aura +poškození/kadence/dosah, jako v TD |
| 🧱 | **Palisáda / kamenná zeď** | 15 / 40 za pole | – | – | – | souš | blokuje pěchotu (nesmí odříznout poslední cestu), má výdrž |
| ⛵ | **Strážní šalupa** | 220 | ✓ | – | – | kotviště v přístavu | vlastní loď: hlídkuje na úseku moře, který hráč určí; může se potopit |
| 🏭 | **Sklad a dílna** | 200 | – | – | – | souš | neútočí; opravuje věže v sousedství, zrychluje opravu pevnosti |
| 🌾 | **Plantáž** | 120 | – | – | – | louka | příjem zlata za vlnu, terč nájezdů |

**Terén pod věží** (rozšíření kopců a dolíků z TD):
- kopec: +18 % dosah, ostatní normálně,
- útes: pobřežní dělo +30 % dosah, ostatní +10 %,
- les: věž je skrytá před dělostřelbou lodí (−50 % škody od lodí), −10 % dosah,
- pláž: levnější stavba (−10 %), ale nejvíc ohrožená výsadky,
- bažina: stavba stojí dvojnásob.

Les lze **vykácet** (malá cena, vrátí trochu zlata za dřevo). Mění tak průchodnost i krytí.

---

## 8. Aury, specializace, sloučení a hodnosti

Vše funguje jako v TD, jen s novými názvy.

**Aury sousedů** (vzdálenost 1, prapor a maják se specializací 2):
| věž | aura pro sousedy |
|---|---|
| 🏹 Strážní věž | +12 % kadence |
| 💥 Pobřežní dělo | +12 % poškození proti lodím |
| 💣 Moždíř | +10 % poškození |
| 🎯 Balista | střely sousedů lehce zpomalují |
| 🎖️ Mušketýři | +10 % kadence |
| 🔥 Kotel | střely sousedů zapalují (slabý DoT) |
| 🏮 Maják | sousedé zasáhnou letce a ponořené, +10 % dosah v noci |
| 🚩 Prapor | +dmg/kadence/dosah, roste s úrovní |
| 🏭 Sklad | sousedé se pomalu sami opravují |

**Synergie dvojic** (jako Roztříštění / Toxický výbuch / Značený cíl v TD):
- 🔥 Kotel + 💥 Dělo → *Žhavé koule*: dělo zapaluje lodě.
- 🎯 Balista + 🎖️ Mušketýři → *Strženi k zemi*: zasažený letec padá níž a mušketýři mu dávají 2× poškození.
- 🏮 Maják + 💣 Moždíř → *Navádění*: moždíř nemine ponořené tvory.

**Specializace na úrovni 3**, vždy dvě volby, například:
- Pobřežní dělo: *Řetězové koule* (láme stěžně, loď zpomalí na 50 %) / *Těžká ráže* (+60 % dmg, ignoruje pancíř).
- Moždíř: *Kartáč* (větší plocha proti pěchotě) / *Zápalné granáty*.
- Balista: *Síť* (letec na 2 s spadne a dá se zasáhnout ze země) / *Trojitá harpuna*.
- Maják: *Oslepující paprsek* (lodě v dosahu míří hůř) / *Daleký svit* (aura o pole dál).

**Sloučení 2×2 → bašta, 4×4 → pevnůstka** (mohutná a supermohutná věž v TD): stejné násobky
poškození a dosahu. Pevnůstka z pobřežních děl je „pobřežní baterie“ s vlastní grafikou.

**Hodnosti** (Rekrut → Veterán → Elita → Mistr → Legenda) a dělení XP se sousedy se přebírají
beze změny.

---

## 9. Pasti a zátarasy

| | past | cena | kde | účinek |
|---|---|---|---|---|
| 🪵 | Zátarasy na pláži | 40 | pláž | zpomalí vyloďující se pěchotu na 45 % po dobu 30 s |
| 🗡️ | Kůly v mělčině | 50 | mělčina | čluny a lodě s mělkým ponorem utrpí škodu, 10 zásahů |
| 💥 | Námořní mina | 70 | voda | výbuch 200 dmg, jedno použití |
| ⛓️ | Řetězová závora | 160 | přes průliv nebo vjezd do laguny (mezi dvěma břehy, nejvýš 5 polí) | lodě se zastaví, dokud řetěz nepřerazí (výdrž 300); čluny proklouznou |

Sapéři pasti na souši zneškodní, pokud na ně nikdo nestřílí.

---

## 10. Počasí, příliv, vítr, den a noc

Počasí nahrazuje modifikátory vln z TD. Losuje se ze seedu a ukazuje se **v náhledu vlny**, aby se
hráč stihl připravit.

- **Vítr** (8 směrů, síla 0–3): unáší letce, plachetnice plují po větru rychleji a proti větru
  pomaleji (o ±25 %). Kluzáky útočí jen po větru. Šipka větru je stále v rohu mapy.
- **Příliv a odliv**: cyklus přes několik vln. Při **odlivu** se z mělčiny stane pláž (nová místa
  pro výsadek!) a ze střední hloubky mělčina, takže galeony mají méně cest. Při **přílivu** se
  zaplaví nejnižší pláže a čluny se dostanou dál do řeky. Mapa ukazuje, co se změní, ještě před vlnou.
- **Mlha**: dosah věží −15 %, přízračné lodě neviditelné bez majáku.
- **Bouře**: lodě a letci +12 % rychlost, ale letce bouře náhodně zraňuje; moždíře míří hůř.
- **Noc** (každá 4. vlna): dosah všech věží −20 %, kromě věží v auře majáku.
- **Klid a slunce**: +25 % zlata ze zabití (náhrada za ✨ Požehnání).

---

## 11. Ekonomika

- Jedna měna: **zlato** 💰 (jako v TD). Dřevo z kácení se rovnou přepočítá na zlato.
- Příjem: zabití nepřítele, začátek vlny (+18 jako v TD), přístav, vesnice, plantáže.
- Prodej věže vrací 70 % utraceného, jako v TD.
- **Opravy** věží a budov za zlato mezi vlnami; během vlny pomaleji a dráž.
- Startovní zlato zhruba na 3 strážní věže a 1 pobřežní dělo.

---

## 12. Vlny, hlídka a bossové

- Ostrov v kampani má **10 vln**, 10. je boss.
- **Hlídka** v náhledu ukáže složení další vlny jako v TD (`🛶×4 🦅×5…`) a navíc **směr**
  (šipka u bodu nástupu na okraji mapy), počasí a příliv. Ve vyšších vlnách hlídka hlásí jen
  přibližný směr (kvadrant), aby hráč nemohl obranu pokaždé přesně přeskládat.
- Vlny se stavějí ze tří zásobníků (moře / vzduch / souš). Poměr se mění podle ostrova: sopečný
  ostrov má víc letců, atol víc lodí.
- **Bossové** (padnou z nich artefakty):
  | | boss | fronta | mechanika |
  |---|---|---|---|
  | 🐙 | **Kraken** | moře | chapadla se vynořují u pobřežních věží a strhávají je pod vodu; tělo je zranitelné jen při vynoření |
  | ⚓ | **Admirálská galeona** | moře | eskortují ji šalupy, po 50 % HP vysadí elitní mariňáky |
  | 🐉 | **Matka wyvern** | vzduch | zapaluje les, každých 15 s vypustí mláďata |
  | 👻 | **Holandský přízrak** | moře | mizí a objevuje se jinde, přivolává mlhu |
  | 🌋 | **Ohnivý titán** (sopečný ostrov) | souš | vyleze z kráteru, nikoli z moře; jde po souši k pevnosti |

**Artefakty** (trvalé bonusy pro zbytek kampaně, jako v TD): 🧭 Kompas mrtvého kapitána (hlídka
vždy ukáže přesný směr), 🦑 Inkoust krakena (+10 % poškození proti lodím), 🪶 Pero ptáka hromu
(+15 % poškození proti letcům), 💰 Pirátský poklad (+15 % zlata), 🧱 Kámen předků (+20 výdrže pevnosti).

---

## 13. Schopnosti velitele

Tři schopnosti s nabíjením (v TD dvě):
- 💣 **Salva flotily** (45 s): klikni na mapu, plošný zásah. Je to nálet z TD, ale funguje jen na moři a pobřeží.
- 🔥 **Brander** (60 s): vypustí vlastní hořící loď z přístavu, ta najede do nejbližší nepřátelské lodi a vybuchne.
- 🌪️ **Bouřný zpěv šamana** (90 s): na 4 s zastaví všechny lodě a letce (zmrazení z TD). Pěchotu nezastaví.

---

## 14. Režimy: souostroví, nekonečná obrana, ostrov dne

- **Souostroví (kampaň)**: mapa 8 ostrovů. Seed kampaně určí všechny ostrovy. Hráč si vybírá
  další ostrov z 2 sousedních, takže si volí cestu (např. sopečný ostrov s letci, nebo atol
  s loďmi). Z ostrova do dalšího si přenese artefakty a část zlata (jako přenos mezi levely v TD).
  Biomy: 🌴 tropický, 🌋 sopečný, 🪸 korálový atol, 🌫️ mlžný severní, 🏜️ suchý skalnatý,
  🌿 bažinatý mangrovník.
- **Nekonečná obrana**: jeden ostrov, vlny bez konce, boss každých 10 vln, počasí se střídá. Rekord
  se ukládá podle seedu i celkově.
- **Ostrov dne**: seed z data, stejný pro všechny, normální obtížnost. Rekord dne přes `rekord.js`.

---

## 15. Grafika a zvuk

- Stejný přístup jako TD: **SVG sprity v kódu** (věže, lodě, letci), předkreslené do bitmap,
  plus **předrenderované pozadí** ostrova.
- Moře: barva podle hloubky, animované vlnky a pěna u pláží (pomalá vrstva přes pozadí),
  odraz slunce, při odlivu se plynule odkrývá mělčina.
- Ostrov: pláže, tráva, les s korunami stromů, kopce se stínováním podle výšky, útesy s tmavou hranou.
- Lodě mají natočení podle kurzu, plachty se nafukují podle větru, za lodí brázda. Potopená loď
  se nakloní a zmizí v bublinách.
- Letci vrhají **stín na zem** posunutý podle výšky, aby bylo jasné, že jsou ve vzduchu.
- Efekty z TD (částice, otřesy, vznášející se čísla, bannery) se přebírají.
- Zvuk přes WebAudio (jako v TD): šum příboje podle vzdálenosti pobřeží od středu pohledu, výstřely
  děl s ozvěnou, křik racků v klidu, poplašný zvon při výsadku.
- Plátno respektuje `devicePixelRatio` (viz past z headless testů: testovat i DPI 2).

---

## 16. Rozhraní a ovládání

- HUD jako v TD: dva pevné řádky (💰, 🏰 výdrž pevnosti, ⚓/🏘️ stav přístavu a vesnic, 🌊 vlna,
  skóre, rekord; ovládání ⏸ rychlost, Vlna, Auto).
- Obchod s věžemi rozdělený na tři záložky **Moře / Vzduch / Souš / Podpora** a klávesové zkratky.
- Při výběru věže se ukáže dosah a **co z dosahu je moře, souš a vzduch**. Nepovolené pole je červené
  s vysvětlením („pobřežní dělo musí stát u vody“, „zeď by odřízla poslední cestu“).
- **Vrstvy mapy** (přepínač): hloubka moře, průchodnost pro lodě podle ponoru, pole toků pěchoty,
  dostřel všech věží, změna při odlivu.
- Šalupě se úsek hlídky zadá tažením po moři.
- Myš i dotyk, od 320 px, posun a přiblížení mapy na mobilu, světlé i tmavé téma (mapa je vždy
  „denní“, téma mění panely).
- Nabídka: seed, režim, obtížnost, náhled ostrova; pauza s nápovědou; „Co dál?“ po prohře.

---

## 17. Technické řešení

- **Soubory**: `obsah/obleheni.html` + složka `obsah/obleheni/` s obyčejnými skripty (ne ES moduly,
  aby to fungovalo i přes `file://`), jmenný prostor `OBL` (`globalThis.OBL`).
  - `nahoda.js` (mulberry32, odvozené seedy), `ostrov.js` (generátor, kontrola hratelnosti),
    `toky.js` (pole toků pro moře podle ponoru a pro souš, přepočet po stavbě, kontrola „neodříznout“),
    `data.js` (věže, nepřátelé, pasti, artefakty, počasí), `sim.js` (pevný krok, boj, vlny),
    `pocasi.js`, `kampan.js`, `grafika.js`, `sprity.js`, `zvuk.js`, `ui.js`.
  - Logika (`nahoda`, `ostrov`, `toky`, `data`, `sim`, `pocasi`, `kampan`) **nesahá na DOM ani
    localStorage** a jde načíst v node.
- **Determinismus**: simulace s pevným krokem 1/30 s, náhoda jen z PRNG simulace (žádné
  `Math.random` v logice; kosmetické částice mají vlastní PRNG). Stejný seed a stejné povely dají
  stejný výsledek, takže jde nahrát a přehrát záznam a testovat botem.
- **Pole toků** (BFS/Dijkstra po mřížce): moře 3× (podle ponoru) × 2 stavy přílivu, předpočítané;
  souš se přepočítá po každé stavbě nebo zničení zdi. 48 × 34 = 1 632 polí, takže výpočet je levný.
- **Ukládání** mezi vlnami do `webapp_hra_obleheni_save` (kampaň), rekordy přes `rekord.js`.
- Hlavička jako ostatní hry (`common.css`, `theme.js`, `podpis.js`, `rekord.js`, `dialog.js`).
- Do `apps.js` a `sw.js` (offline) až v poslední etapě.

### Testy
- `node _test/obleheni_ostrov.js [n]`: vygeneruje n seedů a ověří kontrolu hratelnosti, dosažitelnost
  pláží po vodě i po souši, že pevnost není na pláži a že stejný seed dá stejný ostrov.
- `node _test/obleheni_sim.js [fuzz]`: scénáře (loď se vylodí, zeď nesmí odříznout, příliv změní
  cesty) a fuzz s invarianty (nikdo nestojí ve zdi, loď nikdy na souši, zlato nikdy záporné,
  determinismus dvou běhů).
- `node _test/obleheni_bot.js`: jednoduchý bot staví podle pravidel a hraje kampaň na 3 obtížnosti.
  Slouží k vyvážení (na normální obtížnost by měl vyhrávat zhruba polovinu ostrovů).
- `python3 _test/obleheni_snimek.py`: headless snímky v DPI 1 i 2, snímky je potřeba prohlédnout.
  Testy úsporně: jeden Chromium a po testu ukončit session.

---

## 18. Postup vývoje po etapách

Stejně jako u ostatních her: „pokračuj“ = vzít první neodškrtnutou etapu, dotáhnout ji, otestovat
a zapsat výsledek do `Obleheni_PLAN.md`.

1. **Ostrov**: generátor ze seedu, hloubky, pláže a útesy, vnitrozemí, pevnost, přístav, vesnice,
   kontrola hratelnosti, předrenderované pozadí, náhled se seedem. Test `obleheni_ostrov.js`.
2. **Moře a lodě**: pole toků podle ponoru, body nástupu, čluny a brigantiny s výsadkem, pěchota po
   souši k pevnosti, výdrž pevnosti, prohra. Zatím jen strážní věž a pobřežní dělo.
3. **Věže a stavba**: všech 12 staveb, pravidla umístění, terén pod věží, palisády a kontrola
   „neodříznout“, prodej, vylepšení, opravy.
4. **Vzduch**: letci, vítr a jejich unášení, stíny, protivzdušné věže, maják.
5. **Systémy z TD**: aury, synergie, specializace, sloučení 2×2 a 4×4, hodnosti, imunity a odolnosti.
6. **Ostřelování a ponoření**: lodě útočí na věže, boky a salvy, mořští tvorové, brander, pasti
   včetně řetězové závory.
7. **Počasí a vlny**: příliv a odliv, mlha, bouře, noc, hlídka s náhledem a směrem, ekonomika
   přístavu, vesnic a plantáží, schopnosti velitele.
8. **Bossové a kampaň**: 5 bossů, artefakty, mapa souostroví, biomy, přenos mezi ostrovy,
   nekonečná obrana, ostrov dne, ukládání.
9. **Grafika a zvuk**: animované moře, lodě s plachtami, efekty, zvuk příboje a bitvy, vrstvy mapy.
10. **Bot, vyvážení, dokončení**: bot, ladění čísel, nápověda, „Co dál?“, katalog (`apps.js`),
    offline (`sw.js`), záznam do `HRY_PLAN.md`.

---

## 19. Otevřené otázky

1. **Téma**: plachetnice s fantasy (wyverny, kraken, přízraky), jak je navrženo, nebo čistě
   historické (bez příšer), nebo naopak víc fantasy (mágové, vzducholodě)?
   Fantasy
2. **Mřížka a velikost**: 48 × 34 s posunem a zoomem, nebo menší 32 × 24, která se vejde na
   obrazovku bez posouvání jako TD? mensi, bez posunu
3. **Věže s výdrží**: ponechat (víc taktiky, ale víc starostí s opravami), nebo jen pevnost
   a budovy jako v TD? stejne jako v td
4. **Bludiště na souši**: povolit palisády (stavba bludiště), nebo jen předem dané cesty mezi
   plážemi a pevností? jak myslis.
5. **Grafika**: SVG sprity jako v TD, nebo pixel art jako v Trosečnících, nebo malovaný styl jako
   v Síních pod horou? vyber sam
6. **Druhá surovina**: jen zlato, nebo i dřevo/kámen pro zdi a opravy? jen zlato
7. **Vlastní lodě**: strážní šalupa jako jediná vlastní jednotka, nebo celá malá flotila? staci salupa
8. **Název**: „Ostrov v obležení“, nebo např. „Strážci útesů“, „Bašta na útesech“, „Poslední přístav“? jak myslis ty
