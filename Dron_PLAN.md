# Plán: 🚁 Nad krajinou (od 7. 10. 2026)

Simulátor letu dronem. Popis hry je v `Dron_POPIS.md`. Tady jsou rozhodnutí, **závazná smlouva
rozhraní mezi moduly** (podle ní souběžně pracuje víc agentů) a záznamy z etap.

## Rozhodnutí (uživatel 7. 10. 2026: „jo, pusť se do toho“ → platí doporučení z popisu)

1. Název **Nad krajinou**. Krajina **česká vrchovina** (kopce, lesy, louky, pole, řeka, jezero, vesnice).
2. **CC0 fotografické textury** (Poly Haven, 1k, do `obsah/dron/tex/`), procedurální záloha pro „Nízká“.
3. **Simulátor s asistencemi**: věrná fyzika, začátečník létá v režimu GPS / Úhel s držením výšky.
4. **Kamerový dron i FPV** rovnocenně.
5. Desktop je hlavní cíl, mobil jen s nízkou kvalitou a dotykovými pákami. Vysílačka přes Gamepad API
   podle standardu (uživatel ji nemusí mít; testuje se klávesnice a gamepad).
6. Zvířata v jednoduché podobě ano (srnky, krávy, ptáci).

## Soubory a vlastníci (kdo smí soubor měnit)

Stránka `obsah/dron.html` + `obsah/dron/*.js` (obyčejné skripty, jmenný prostor `DRON`, uvnitř
`(function (D) { 'use strict'; … })(globalThis.DRON = globalThis.DRON || {});`). Komentáře a
identifikátory česky (bez diakritiky v identifikátorech), styl jako v ostatních hrách webu.

| Vlastník | Soubory |
|---|---|
| **Hlavní (integrace)** | `dron.html`, `spolecne.js`, `nahoda.js`, `sum.js`, `hra.js`, `kamera.js`, `osd.js`, `mise.js`, `ui.js`, tento plán, `_test/dron_snimek.py` |
| FYZIKA | `fyzika.js`, `rizeni.js`, `kolize.js`, `autopilot.js`, `_test/dron_fyzika_test.js` |
| TERÉN | `teren.js`, `teren_worker.js`, `_test/dron_teren_test.js` |
| TERÉN-VYKRESLENÍ | `terenvykres.js`, `textury.js`, `obsah/dron/tex/*` |
| OBLOHA | `obloha.js`, `post.js`, `pocasi.js` |
| VODA | `voda.js` |
| VEGETACE | `vegetace.js` |
| STAVBY | `stavby.js`, `dronmodel.js`, `zvirata.js` |
| ZVUK+VSTUP | `zvuk.js`, `vstup.js`, `_test/dron_vstup_test.js` |

**Pravidla pro souběžnou práci:**
- Cizí soubor se nemění. Potřebuješ změnu ve sdíleném souboru (`spolecne.js`, `hra.js`, `dron.html`)
  nebo v cizím modulu? Napiš ji do závěrečné zprávy (přesně co a proč), integruje ji hlavní.
- Nesahat na `apps.js`, `sw.js`, `index.html` ani jiné hry. Žádný git commit / push.
- Prohlížeč **jen** přes `python3 _test/dron_snimek.py` (má zámek → nanejvýš jeden Chromium na
  počítači, hlídá paměť, uklízí). Žádné jiné spouštění Chromia. Snímky pojmenovávej s předponou své
  oblasti (`voda_…`). Pracovní soubory do `_test/dron/<oblast>/`.
- Testy logiky v node: `node _test/dron_<oblast>_test.js` (soubory se dají `require`, plní `globalThis.DRON`).
- Headless prohlížeč běží v **DPI 1** se softwarovým WebGL (~15 fps) — výkon měř úvahou a počtem
  draw callů/trojúhelníků (`renderer.info`), ne fps ze snímku.

## Souřadnice a jednotky

Metry, sekundy, radiány. **Y nahoru.** Svět je čtverec 4096 × 4096 m se středem v počátku
(x, z ∈ −2048…2048). Dron má nos k **−Z**, pravou stranu k +X (jako kamera v three.js).
Kurz (yaw) 0 = k −Z, kladný = doleva (`rotation.y`), pomůcka `D.yawZQ(q)`. Kvaterniony jako pole
`[x, y, z, w]`. Typická výška terénu 150–450 m n. m.

## Hlavní smyčka a moduly (`hra.js`, `spolecne.js`)

```js
D.modul('voda', {
  poradi: 50,                 // pořadí init/update (obloha 10, teren 20, voda 30, vegetace 40, stavby 45,
                              // zvirata 48, pocasi 60, zvuk 70, kamera 90, osd 95, post 99)
  popis: 'voda',              // do načítací obrazovky
  async init(ctx) {},         // jednou po vygenerování krajiny; smí vrátit Promise
  update(ctx, dt) {},         // každý snímek; dt běží i v pauze/menu (svět žije), fyzika a mise stojí — ctx.pauza
  kvalita(ctx, uroven) {},    // 0 nízká … 3 ultra; volá se po init a při každé změně
});
```

`ctx` (= `DRON.ctx`): `THREE, renderer, scene, kamera` (aktivní PerspectiveCamera), `teren`,
`prostredi`, `dron` (stav fyziky), `dronModel`, `cas` (s), `hodina` (0–24, denní doba),
`pocasi` `{ oblacnost 0..1, vitr m/s, smerVetru rad, dest 0..1, mlha 0..1 }`, `kvalita` 0–3,
`kam` (stav kamer, `kam.rezim` ∈ fpv|chase|gimbal|los|volna), `vstup` (poslední vstup), `fps`,
`pauza`, `vykresli()` (výchozí `renderer.render(scene, kamera)`; **post.js ho smí nahradit**).

Události: `D.na(jmeno, f)`, `D.vyvolej(jmeno, data)`. Jména: `pripraveno`, `novyLet`, `rozmer`,
`kvalita`, `kamera`, `reset`, `pauza`, `foto`, `rezim`, `naraz` `{sila m/s, typ}`, `havarie`,
`pristani`, `branka` `{trat, index}`, `chybaModulu`.

Parametry URL (pro snímky a testy): `seed`, `mapa`, `cas` (hodina), `oblacnost`, `vitr`, `kvalita`,
`typ` (kamera|fpv|whoop), `rezim`, `kamera`, `pohled=x,y,z,yaw°,pitch°` (pevná volná kamera;
s `nad=1` je y nad terénem), `dron=x,z,výškaNadTerénem,kurz` (výška > 0,5 m = start ve vzduchu), `bez=modul1,modul2` (vypne moduly),
`krok=0.016` (pevné dt), `bezWorkeru=1`.

## Grafické konvence

- Renderer: `outputColorSpace = SRGB`, `toneMapping = ACESFilmic`, expozice 1, stíny PCFSoft.
  Materiály počítají **lineární HDR** barvu.
- Standardní materiály (`MeshStandardMaterial`, `MeshLambertMaterial`) **vždy přes
  `D.upravMaterial(mat, vlastniUprava?, klic?)`** — doplní vzdušnou perspektivu a stín mraků.
  Vestavěná `scene.fog` se nepoužívá.
- Vlastní `ShaderMaterial`: `uniforms: Object.assign({...vlastní}, D.U)`, do fragment shaderu vložit
  `D.GLSL.atmo` a výslednou barvu prohnat `dronAtmo(barva, worldPos, cameraPosition)` a přímé
  sluneční světlo násobit `dronMraky(worldPos)`; na konci `#include <tonemapping_fragment>` a
  `#include <colorspace_fragment>`.
- `D.U` sdílené uniformy: `uSunDir` (směr KE slunci), `uSunColor`, `uSkyColor`, `uFogColor`, `uHaze`,
  `uHazeFalloff`, `uTime`, `uWind` (vec2 m/s), `uDronPos`, `uDronTah` (0..1, pro proplach vrtulí).
  Obloha je každý snímek nastavuje podle denní doby a počasí. OBLOHA smí `D.GLSL.atmo` nahradit
  (stejné podpisy funkcí) a přidat uniformy do `D.U` — jen v `init()`.
- Slunce: OBLOHA vlastní `THREE.DirectionalLight` (`ctx.slunce.svetlo`) se stínem, který jede s kamerou
  (2–3 kaskády nebo jedna mapa + měkké vzdálené stíny z terénu). Ostatní moduly jen nastavují
  `castShadow` / `receiveShadow`.
- Rozpočet (kvalita Střední, notebook s integrovanou grafikou, 60 fps): celkem ≤ ~1,5 M trojúhelníků,
  ≤ ~150 draw callů. Instancování všude, kde je víc kusů stejného.

## Terén — data (`teren.js`, generuje TERÉN, čtou všichni)

`D.generujTeren(seed, mapa, prubeh?) → data` (čistá funkce, běží v node i ve Workeru),
`D.terenZDat(data) → teren` (doplní metody; data přijdou z Workeru bez metod).

```
data.velikost = 4096, data.n = 1025, data.krok = 4         // mřížka n×n, index = iz*n + ix
  x = −2048 + ix*krok, z = −2048 + iz*krok
data.vysky  Float32Array(n*n)        výška terénu (m)
data.maska  Uint8Array(n*n*4)        RGBA 0..255: R les, G pole/orná půda, B cesta, A vlhkost (břeh, mokřad)
data.voda   Float32Array(n*n)        výška hladiny tam, kde je voda, jinak −1e4 (D.TEREN.BEZ_VODY)
data.objekty.stromy  Float32Array(k*6)   [x, y, z, typ, meritko, natoceni]…  typ = index do D.STROMY
data.objekty.kameny  Float32Array(k*5)   [x, y, z, meritko, natoceni]…
data.stavby  [{ typ, x, y, z, uhel, sirka, delka, vyska, strecha }]
    typ: dum | stodola | kostel | vez (kostelní věž) | kaple | rozhledna | posed | seno (balík)
         | most | plot | ohrada | stozar (stožár vedení) | pristavani (startovní plocha H)
    y = terén v patě; sirka podél lokální osy x, delka podél z; uhel = natočení kolem Y;
    vyska = stěny, strecha = výška střechy nad stěnami (0 = plochá)
data.cesty   [{ typ: 'silnice'|'polni', sirka, body: [[x, z], …] }]
data.vedeni  [{ vyskaSloupu, body: [[x, y, z], …] }]   y = terén u sloupu; dráty prověšené mezi vrcholy
data.trate   [{ jmeno, branky: [{ x, y, z, uhel, sirka, vyska }] }]   y = terén; otvor sirka×vyska
data.cile    [{ id, jmeno, typ, x, y, z }]   zajímavá místa pro fotomise (kostel, rozhledna, most, jezero, vrchol…)
data.start   { x, y, z, smer }              startovní plocha (y = terén), smer = kurz
```

Metody `teren`: `vyska(x,z)`, `normala(x,z,out?) → [nx,ny,nz]`, `sklon(x,z)` (rad),
`hladina(x,z)` (výška hladiny nebo −Infinity), `maska(x,z,out?) → [les,pole,cesta,vlhkost]`, `vMape(x,z)`.

## Fyzika (`fyzika.js`, `rizeni.js`, `kolize.js`, `autopilot.js` — FYZIKA)

```
D.TYPY_DRONU = { kamera: {...}, fpv: {...}, whoop: {...} }   // jmeno, hmotnost, rezimy[], vychoziRezim, …
D.novyDron(typ, start{x,y,z,smer}) → dron
D.vytvorProstredi(teren, pocasi, seed) → prostredi { teren, pocasi, vitr(x,y,z,t,out), kolize… }
D.krokFyziky(dron, vstup, prostredi, dt)          // dt = 1/240, deterministické
D.autopilot(dron, cil, prostredi) → vstup          // pro bota, návrat domů a ukázky
dron: { typ, T, p[3], v[3], q[4], w[3] (úhlové rychlosti v těle), motory[4] 0..1 otáčky, tah 0..1,
        rezim ('gps'|'uhel'|'horizont'|'acro'), armed, baterie { procent, napeti, clanky },
        stav ('pripraven'|'leti'|'pristal'|'havarie'), poskozeni 0..1, naZemi, cas, vyskaNadZemi, … }
```
Fyzika volá `D.vyvolej('naraz'|'havarie'|'pristani', …)`, pokud `D.vyvolej` existuje.

**Vítr** vane DO směru `smerVetru`, tj. vektor (cos s, sin s) v xz (`D.vitrVektor(pocasi)`).
Branka: `D.BRANKA = { ram: 0.3, dole: 0.3 }` — spodní lať na zemi, otvor od y+0,3 do y+0,3+vyska.

## Vstup (`vstup.js` — ZVUK+VSTUP)

`D.vstup.cti(ctx) → { plyn 0..1 (0.5 = střed páky), yaw, pitch, roll ∈ −1..1, gimbal ∈ −1..1,
plynStred: bool (páka plynu se sama vrací na střed — klávesnice, gamepad), prepinace { arm, rezim },
udalosti: ['kamera','reset','pauza','foto','rezim',…] }`. pitch +1 = páka od sebe = nos dolů = let
vpřed. roll +1 = doprava. yaw +1 = doprava. `D.vstup.zdroj` (klavesnice|gamepad|rc|dotyk),
`D.vstup.otevriNastaveni(element)` vykreslí nastavení ovládání a kalibraci vysílačky do daného prvku.

## Zvuk (`zvuk.js` — ZVUK+VSTUP)

Modul `zvuk` (poradi 70). Web Audio až po prvním gestu uživatele. Čte `ctx.dron.motory`, `tah`,
rychlost, `ctx.kam.rezim` (LOS = zeslabit podle vzdálenosti), počasí, denní dobu.
`D.zvuk.hlasitost(0..1)`, `D.zvuk.ztlum(bool)`.

## Model dronu (`dronmodel.js` — STAVBY)

`D.vytvorModelDronu(typ) → { skupina: THREE.Group, kameraFPV: Vector3 (v souřadnicích dronu),
update(dron, dt, ctx) }` — vrtule se točí podle `dron.motory`, při rychlé rotaci průhledný disk,
LED, v FPV pohledu se nesmí model vykreslit přes kameru (vrtule smí být vidět na okraji).

## Etapy

- [x] 1. Kostra (hlavní) — stránka, smyčka, sdílené uniformy, zástupné moduly, snímkovač se zámkem
- [ ] 2. Souběžně (agenti): ~~fyzika~~ ✔ (95 testů) · ~~zvuk+vstup~~ ✔ (424 testů) · · terén · vykreslení terénu · obloha+post · voda · vegetace · stavby+model · zvuk+vstup
- [ ] 3. Integrace — kamery, OSD, menu, mise, letová škola, závody, přehrávání
- [ ] 4. Ladění — výkon a kvalita, bot, nápověda, offline (`sw.js`), katalog (`apps.js`), revize
