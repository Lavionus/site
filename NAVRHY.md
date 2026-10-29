# Návrhy na další stránky/aplikace

Stav k 29. 10. 2026. Návrhy vycházejí z katalogu hlavního webu (`apps.js`, 438 stránek)
**i z katalogu Metodu** (`../metodus/apps.js`, 274 stránek), aby se nedublovalo.

Pravidla:

- Před přidáním návrhu ověřit oba katalogy (`grep -i <téma> apps.js ../metodus/apps.js`).
- Výuková témata (učivo ZŠ: jazyky, matematika, fyzika, přírodopis, hudební nauka…)
  patří do Metodu, ne sem.
- Zahradnická témata uživatel teď nechce (sekce Zahrada & pěstování se nerozšiřuje).
- Hotové návrhy přesunout do archivu na konci souboru.

## Otevřené návrhy

### 🌿 Příroda & venku

- **Atlas hub – houbaření a záměny** (`houby_atlas.html`). Praktický průvodce pro sběr:
  karta druhu s jednotnou ilustrací, jedlost/jedovatost, **nebezpečné záměny vedle sebe**,
  jednoduchý klíč (ano/ne otázky), sezónnost. Odlišit od Metodu: `pr6_houby` a „Houby
  a lišejníky“ učí systém a stavbu hub, tohle má být terénní pomůcka. Obrázky jsou jádro
  (Codex na pokyn, nebo lokální Z-Image).

### 🩺 Zdraví

- **Ilustrovaná první pomoc – rozšíření Lékárničky** (`first_aid_ref.html`, ne nová stránka).
  Postupy krok za krokem v obrázcích (zotavovací poloha, Heimlichův manévr, resuscitace)
  a tisk karty A4/A6 do auta a dílny. Metodus (`pr8_prvni_pomoc`, „Zdraví, nemoc a první
  pomoc“) to probírá jako učivo; tady jde o rychlou referenci a tisk.

### 📐 Technika

- **Průvodce spojovacím materiálem a nářadím** (`sprav_material.html`). Hmoždinky
  (do čeho kterou), nýty, hřebíky, typy hlav a bitů, vrtáky podle materiálu, pilové listy;
  kreslené karty + „čím to přichytit“ (materiál podkladu a zátěž → doporučení). Závity
  a šrouby vynechat – ty už jsou na hlavním webu (`Šrouby & závity`) i v Metodu.

### 🎮 Hry

- **Další gamebooky** do sekce 📖 Gamebooky. Engine (`obsah/gamebook/jadro.js`) je obecný,
  nový příběh = nový datový soubor jako `gamebook/pribeh.js` + ilustrace. Pak udělat
  výběr příběhu na titulní straně.
- **Dobble / Postřeh** (`dobble.html`). Generátor karet, kde mají každé dvě karty právě
  jeden společný symbol (projektivní rovina řádu 7 → 55 karet, 57 symbolů); hra na
  obrazovce + tisk karet. Potřebuje sadu 57 jednotných ikon (arch 4×4 přes Codex nebo
  lokální SD).
- **Obrazové sady pro Pexeso** (rozšíření `memory_game.html`, ne nová stránka). Tematické balíčky
  (zvířata, památky ČR, nářadí). Vlajky ne – Metodus má „Kvíz vlajky a města“.
- **Uzly – rozšíření Námořnických uzlů** (`uzly.html`) o horolezecké a rybářské uzly s animací kroků.

### 🏠 Domácnost

- **Domácí údržba – návaznosti.** Propojit s Evidencí majetku (úkol údržby u konkrétního
  spotřebiče) a s Domácími odečty (připomínka měsíčního odečtu). Až po zpětné vazbě
  uživatele na `udrzba.html`.

## Už je v Metodu (sem nepatří)

| Návrh | Kde je v Metodu |
|---|---|
| Němčina – slovíčka a časování | „🇩🇪 Němčina – slovíčka“, „Slovní zásoba NJ a FJ“, „Výslovnost NJ a FJ“ |
| Fyzikální pokusy pro děti (simulace) | „🔬 Fyzikální hřiště – síla, pohyb a energie“, „⚖️ Páka a jednoduché stroje“ |
| Notová osnova – čtení not | „🎼 Notová osnova – čtení not“, „🎹 Intervaly“, „🥁 Rytmus, délky not a takt“ |
| Obrazový slovník cizích jazyků | předměty `aj` a `dcj` (slovní zásoba) |
| Sekce pro děti (násobilka, vyjmenovaná slova, hodiny, zlomky) | „✖️ Procvičování násobilky“, „✍️ Vyjmenovaná slova“, „🕐 Učení hodin“, „🍕 Zlomky…“ |
| Houby a rostliny jako učivo | `pr6_houby`, „🍄 Houby a lišejníky“, „🌿 Stavba a systém rostlin“ |

## Archiv – realizováno

**29. 10. 2026:** 🔧 Domácí údržba a revize (`udrzba.html`), ⛏️ gamebook Hlubina pod
Černou horou (`gamebook.html`, nová sekce 📖 Gamebooky).

**Dřívější návrhy z tohoto souboru (všechny na webu):** Zettelkasten, vCard + QR,
docházka, zápis z porady, budík dle spánkových cyklů, oční tabulka, kalendář růstu dítěte,
lékárnička, kalkulačka kofeinu, rybářský kalendář, plánovač záhonů, astronomický kalendář
úkazů, komiksové stripy, storyboard, generátor nálepek, paleta z obrázku, spotřeba
barvy/tapety, betonová směs, sklon střechy, dimenzování kabelu, kalkulačka pružin,
URL builder, YAML ↔ JSON, Git cheatsheet, generátor .env, API tester, bingo kartičky,
generátor křížovek, O projektu.
