# Fonty

Všechny fonty v této složce jsou volně šiřitelné – většina pod licencí
**SIL Open Font License 1.1** (plné znění `OFL.txt`), tři pod **Apache License 2.0**
(`APACHE-2.0.txt`). Obě licence dovolují fonty používat, šířit, vkládat do webů
i jimi tisknout.

Zdroje: [Google Fonts](https://github.com/google/fonts) (adresáře `ofl/` a `apache/`),
[Alcarin Tengwar](https://github.com/Tosche/Alcarin-Tengwar) (Toshi Omagari),
Liberation Fonts (Red Hat), [Noto](https://notofonts.github.io/).

Dva fonty jsou **výřezy**: z Noto Sans Egyptian Hieroglyphs (1 MB) zůstaly jen
znaky jednosouhláskové „abecedy“, z Noto Sans Symbols 2 (1,2 MB) jen Braillovo
písmo. OFL úpravy dovoluje a Noto nemá vyhrazený název fontu. Výřez vyrobí
`python3 -m fontTools.subset … --unicodes=…` (seznam znaků v `prepis.js`).

Katalog pro stránky je v `fonty.js` (`KATALOG`). **Nový font** = soubor sem,
řádek v katalogu (ověřit českou diakritiku) a spustit `python3 sestav_js.py`,
který font zabalí do `js/<soubor>.js` – ten se použije, když stránka běží
z disku (file://) a nesmí soubor fontu načíst přes fetch().

| Soubor | Rodina | Copyright | Licence |
|---|---|---|---|
| `BebasNeue-Regular.ttf` | Bebas Neue | Copyright 2019 The Bebas Neue Project Authors (https://github.com/dharmatype/Bebas-Neue) | SIL Open Font License 1.1 |
| `Anton-Regular.ttf` | Anton | Copyright 2020 The Anton Project Authors (https://github.com/googlefonts/AntonFont.git) | SIL Open Font License 1.1 |
| `ArchivoBlack-Regular.ttf` | Archivo Black | Copyright 2017 The Archivo Black Project Authors (https://github.com/Omnibus-Type/ArchivoBlack) | SIL Open Font License 1.1 |
| `RussoOne-Regular.ttf` | Russo One | Copyright (c) 2011-2012, Jovanny Lemonad (jovanny.ru), with Reserved Font Name "Russo" | SIL Open Font License 1.1 |
| `FjallaOne-Regular.ttf` | Fjalla One | Copyright 2012 The Fjalla Project Authors (https://github.com/SorkinType/FjallaOne) | SIL Open Font License 1.1 |
| `Staatliches-Regular.ttf` | Staatliches | Copyright 2018 The Staatliches Project Authors (https://github.com/googlefonts/staatliches) | SIL Open Font License 1.1 |
| `LiberationSans-Bold.ttf` | Liberation Sans | Digitized data copyright (c) 2010 Google Corporation. Copyright (c) 2012 Red Hat, Inc. | SIL Open Font License 1.1 |
| `RubikMonoOne-Regular.ttf` | Rubik Mono One | Copyright 2015 The Rubik Project Authors (mail@hubertfischer.com) | SIL Open Font License 1.1 |
| `BowlbyOneSC-Regular.ttf` | Bowlby One SC | Copyright (c) 2011, vernon adams (vern@newtypography.co.uk), with Reserved Font Names "Bowlby" | SIL Open Font License 1.1 |
| `AlfaSlabOne-Regular.ttf` | Alfa Slab One | Copyright 2016 The Alfa Slab One Project Authors (http://www.jmsole.cl / info@jmsole.cl), with Reserved Font Name "Alfa Slab". | SIL Open Font License 1.1 |
| `LiberationSerif-Bold.ttf` | Liberation Serif | Digitized data copyright (c) 2010 Google Corporation. Copyright (c) 2012 Red Hat, Inc. | SIL Open Font License 1.1 |
| `AbrilFatface-Regular.ttf` | Abril Fatface | Copyright (c) 2011, Copyright (c) 2011, TypeTogether (www.type-together.com), with Reserved Font Names "Abril" and "Abril Fatface" | SIL Open Font License 1.1 |
| `Ultra-Regular.ttf` | Ultra | Copyright (c) 2010 by Brian J. Bonislawsky DBA Astigmatic (AOETI). All rights reserved. Available under the Apache 2.0 licence.http://www.apache.org/licenses/LICENSE-2.0.html | Apache 2.0 |
| `PlayfairDisplaySC-Black.ttf` | Playfair Display SC Black | Copyright 2017 The Playfair Display Project Authors (https://github.com/clauseggers/Playfair-Display), with Reserved Font Name "Playfair Display". | SIL Open Font License 1.1 |
| `Marcellus-Regular.ttf` | Marcellus | Copyright (c) 2012 by Brian J. Bonislawsky DBA Astigmatic (AOETI) (astigma@astigmatic.com), with ReservedFont Name "Marcellus" | SIL Open Font License 1.1 |
| `Diplomata-Regular.ttf` | Diplomata | Copyright 2011 The Diplomata Project Authors (https://github.com/etunni/diplomata), with Reserved Font Name "Diplomata" | SIL Open Font License 1.1 |
| `SairaStencilOne-Regular.ttf` | Saira Stencil One | Copyright 2019 The Saira Stencil Project Authors (https://github.com/Omnibus-Type/Saira) | SIL Open Font License 1.1 |
| `BlackOpsOne-Regular.ttf` | Black Ops One | Copyright 2022 The PinyonScript Project Authors (https://github.com/SorkinType/Black-Ops) | SIL Open Font License 1.1 |
| `Bungee-Regular.ttf` | Bungee | Copyright 2023 The Bungee Project Authors (https://github.com/djrrb/Bungee) | SIL Open Font License 1.1 |
| `TitanOne-Regular.ttf` | Titan One | Copyright (c) 2011 Rodrigo Fuenzalida (hello@rfuenzalida.com), with Reserved Font Name "Titan One" | SIL Open Font License 1.1 |
| `Righteous-Regular.ttf` | Righteous | Copyright (c) 2011 by Brian J. Bonislawsky DBA Astigmatic (AOETI) (astigma@astigmatic.com), with ReservedFont Name "Righteous" | SIL Open Font License 1.1 |
| `Bangers-Regular.ttf` | Bangers | Copyright 2010 The Bangers Project Authors (https://github.com/googlefonts/bangers) | SIL Open Font License 1.1 |
| `PressStart2P-Regular.ttf` | Press Start 2P | Copyright 2012 The Press Start 2P Project Authors (cody@zone38.net), with Reserved Font Name "Press Start 2P" | SIL Open Font License 1.1 |
| `LuckiestGuy-Regular.ttf` | Luckiest Guy | Copyright (c) 2010 by Brian J. Bonislawsky DBA Astigmatic (AOETI). All rights reserved. Available under the Apache 2.0 licence.http://www.apache.org/licenses/LICENSE-2.0.html | Apache 2.0 |
| `EmblemaOne-Regular.ttf` | Emblema One | Copyright (c) 2011 by Sorkin Type Co with Reserved Font Names "Emblema" and "Emblema One" | SIL Open Font License 1.1 |
| `Sancreek-Regular.ttf` | Sancreek | Copyright 2011 The Sancreek Project Authors (https://github.com/googlefonts/sancreek) | SIL Open Font License 1.1 |
| `VT323-Regular.ttf` | VT323 | Copyright 2011, The VT323 Project Authors (peter.hull@oikoi.com) | SIL Open Font License 1.1 |
| `Monoton-Regular.ttf` | Monoton | Copyright (c) 2011 by vernon adams. All rights reserved. | SIL Open Font License 1.1 |
| `Audiowide-Regular.ttf` | Audiowide | Copyright (c) 2012 by Brian J. Bonislawsky DBA Astigmatic (AOETI) (astigma@astigmatic.com), with ReservedFont Name "Audiowide" | SIL Open Font License 1.1 |
| `Michroma-Regular.ttf` | Michroma | Copyright 2011 The Michroma Project Authors (https://github.com/googlefonts/Michroma-font) | SIL Open Font License 1.1 |
| `SpaceMono-Bold.ttf` | Space Mono | Copyright 2016 The Space Mono Project Authors (https://github.com/googlefonts/spacemono) | SIL Open Font License 1.1 |
| `MajorMonoDisplay-Regular.ttf` | Major Mono Display | Copyright 2018 The Major Mono Project Authors (https://github.com/googlefonts/majormono) | SIL Open Font License 1.1 |
| `SpecialElite-Regular.ttf` | Special Elite | Copyright (c) 2010 by Brian J. Bonislawsky DBA Astigmatic (AOETI). All rights reserved. Available under the Apache 2.0 licence.http://www.apache.org/licenses/LICENSE-2.0.html | Apache 2.0 |
| `Lobster-Regular.ttf` | Lobster | Copyright 2010 The Lobster Project Authors (https://github.com/impallari/The-Lobster-Font), with Reserved Font Name "Lobster". | SIL Open Font License 1.1 |
| `Pacifico-Regular.ttf` | Pacifico | Copyright 2018 The Pacifico Project Authors (https://github.com/googlefonts/Pacifico) | SIL Open Font License 1.1 |
| `KaushanScript-Regular.ttf` | Kaushan Script | Copyright (c) 2011, Pablo Impallari (www.impallari.com/impallari@gmail.com),Copyright (c) 2011, Igino Marini. (www.ikern.com/mail@iginomarini.com),with Reserved Font Name Kaushan Script. | SIL Open Font License 1.1 |
| `GreatVibes-Regular.ttf` | Great Vibes | Copyright 2010 The Great Vibes Pro Project Authors (https://github.com/googlefonts/great-vibes) | SIL Open Font License 1.1 |
| `Courgette-Regular.ttf` | Courgette | Copyright (c) 2012, Sorkin Type Co (www.sorkintype.com) with Reserved Font Name "Courgette". | SIL Open Font License 1.1 |
| `MarckScript-Regular.ttf` | Marck Script | Copyright (c) 2011, Denis Masharov <denis.masharov@gmail.com>, Marck Fogel, with Reserved Font Names "Marck Script". | SIL Open Font License 1.1 |
| `BerkshireSwash-Regular.ttf` | Berkshire Swash | Copyright (c) 2012 by Brian J. Bonislawsky DBA Astigmatic (AOETI) (astigma@astigmatic.com), with ReservedFont Name "Berkshire Swash" | SIL Open Font License 1.1 |
| `PatrickHand-Regular.ttf` | Patrick Hand | Copyright (c) 2012 Patrick Wagesreiter (mail@patrickwagesreiter.at) | SIL Open Font License 1.1 |
| `AmaticSC-Bold.ttf` | Amatic SC | Copyright 2015 The Amatic SC Project Authors (https://github.com/googlefonts/AmaticSC) | SIL Open Font License 1.1 |
| `Allura-Regular.ttf` | Allura | Copyright 2010 The Allura Project Authors (https://github.com/googlefonts/allura) | SIL Open Font License 1.1 |
| `Parisienne-Regular.ttf` | Parisienne | Copyright (c) 2012 by Brian J. Bonislawsky DBA Astigmatic (AOETI) (astigma@astigmatic.com), with ReservedFont Name "Parisienne" | SIL Open Font License 1.1 |
| `PinyonScript-Regular.ttf` | Pinyon Script | Copyright 2022 The PinyonScript Project Authors (https://github.com/SorkinType/Pinyon) | SIL Open Font License 1.1 |
| `Italianno-Regular.ttf` | Italianno | Copyright 2009 The Italianno Project Authors (https://github.com/googlefonts/italianno) | SIL Open Font License 1.1 |
| `UncialAntiqua-Regular.ttf` | Uncial Antiqua | Copyright (c) 2011 by Brian J. Bonislawsky DBA Astigmatic (AOETI) (astigma@astigmatic.com), with ReservedFont Name "Uncial Antiqua" | SIL Open Font License 1.1 |
| `PirataOne-Regular.ttf` | Pirata One | Copyright (c) 2012, Rodrigo Fuenzalida, Nicolas Massi (www.taip.com.ar / abc.taip.com.ar), with Reserved Font Name 'Pirata' | SIL Open Font License 1.1 |
| `MedievalSharp.ttf` | MedievalSharp | wmk69 SIL Open Font License v.1.1 | SIL Open Font License 1.1 |
| `CinzelDecorative-Bold.ttf` | Cinzel Decorative | Copyright © 2012 Natanael Gama (info@ndiscovered.com), with Reserved Font Name 'Cinzel' | SIL Open Font License 1.1 |
| `Metamorphous-Regular.ttf` | Metamorphous | Copyright (c) 2011, Sorkin Type Co (www.sorkintype.com)with Reserved Font Name "Metamorphous". | SIL Open Font License 1.1 |
| `GrenzeGotisch-Variable.ttf` | Grenze Gotisch | Copyright 2020 The Grenze Gotisch Project Authors (https://github.com/Omnibus-Type/Grenze-Gotisch) | SIL Open Font License 1.1 |
| `Jacquard24-Regular.ttf` | Jacquard 24 | Copyright 2023 The Soft Type Project Authors (https://github.com/scfried/soft-type-jacquard) | SIL Open Font License 1.1 |
| `Fondamento-Regular.ttf` | Fondamento | Copyright (c) 2011 by Brian J. Bonislawsky DBA Astigmatic (AOETI) (astigma@astigmatic.com), with ReservedFont Name "Fondamento" | SIL Open Font License 1.1 |
| `IMFellEnglish-Regular.ttf` | IM FELL English | © 2007 Igino Marini (www.iginomarini.com) With Reserved Font Name IM FELL English Roman | SIL Open Font License 1.1 |
| `EagleLake-Regular.ttf` | Eagle Lake | Copyright (c) 2012 by Brian J. Bonislawsky DBA Astigmatic (AOETI) (astigma@astigmatic.com), with ReservedFont Name "Eagle Lake" | SIL Open Font License 1.1 |
| `NewRocker-Regular.ttf` | New Rocker | Copyright (c) 2012, Pablo Impallari (www.impallari.com/impallari@gmail.com), Copyright (c) 2012, Brenda Gallo (gbrenda1987@gmail.com), Copyright (c) 2012, Rodrigo Fuenzalida (www.rfuenzalida.com/hello@rfuenzalida.com), with Reserved Font Name 'New Rocker' | SIL Open Font License 1.1 |
| `Nosifer-Regular.ttf` | Nosifer | Copyright (c) 2011, Typomondo, with Reserved Font Name "Nosifer" | SIL Open Font License 1.1 |
| `Butcherman-Regular.ttf` | Butcherman | Copyright (c) 2011, Typomondo, with Reserved Font Name  "Butcherman". | SIL Open Font License 1.1 |
| `Eater-Regular.ttf` | Eater | Copyright (c) 2011, Typomondo, with Reserved Font Name "Eater" | SIL Open Font License 1.1 |
| `AlcarinTengwar-Bold.ttf` | Alcarin Tengwar | Copyright (c) 2022, Toshi Omagari (https://tosche.net), with Reserved Font Name Alcarin | SIL Open Font License 1.1 |
| `AlcarinTengwar-Regular.ttf` | Alcarin Tengwar | Copyright (c) 2022, Toshi Omagari (https://tosche.net), with Reserved Font Name Alcarin | SIL Open Font License 1.1 |
| `NotoSansRunic-Regular.ttf` | Noto Sans Runic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/runic) | SIL Open Font License 1.1 |
| `NotoSansGlagolitic-Regular.ttf` | Noto Sans Glagolitic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/glagolitic) | SIL Open Font License 1.1 |
| `NotoSansOgham-Regular.ttf` | Noto Sans Ogham | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/ogham) | SIL Open Font License 1.1 |
| `NotoSansEgyptianHieroglyphs-Vyber.ttf` | Noto Sans Egyptian Hieroglyphs (výřez znaků) | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/egyptian-hieroglyphs) | SIL Open Font License 1.1 |
| `NotoSansSymbols2-Braille.ttf` | Noto Sans Symbols 2 (výřez znaků) | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/symbols) | SIL Open Font License 1.1 |
| `NotoSansPhoenician-Regular.ttf` | Noto Sans Phoenician | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/phoenician) | SIL Open Font License 1.1 |
| `NotoSansOldItalic-Regular.ttf` | Noto Sans Old Italic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/old-italic) | SIL Open Font License 1.1 |
| `NotoSansGothic-Regular.ttf` | Noto Sans Gothic | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/gothic) | SIL Open Font License 1.1 |
