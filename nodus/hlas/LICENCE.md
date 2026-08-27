# Vestavěný hlas – původ a licence

Tato složka obsahuje **meSpeak.js v2.0.7** (N. Landsteiner, masswerk.at), což je
syntetizér řeči **eSpeak** přeložený do JavaScriptu.

| Soubor | Co to je |
|---|---|
| `mespeak.js` | rozhraní, načítá jádro a hlasy |
| `mespeak-core.js` | jádro eSpeaku (asm.js), běží ve web workeru |
| `voices/cs.json` | český hlas |
| `voices/en/en.json`, `voices/en/en-us.json` | anglické hlasy |
| `voices/de.json`, `voices/fr.json` | německý a francouzský hlas |

- Projekt: <https://www.masswerk.at/mespeak/>
- eSpeak: <https://espeak.sourceforge.net/>
- **Licence: GNU GPL** (eSpeak i meSpeak). Soubory jsou zde v nezměněné podobě,
  ve zdrojovém tvaru, jak je licence vyžaduje.

Vlastní kód webu (`rec.js` a stránky v `obsah/`) na knihovnu jen odkazuje;
při dalším šíření je potřeba zachovat tento soubor i původní hlavičky v souborech.

## Přidání dalšího jazyka

Stáhnout příslušný `.json` z <https://www.masswerk.at/mespeak/voices/> do
`voices/` a doplnit řádek do `ZALOHA_JAZYKY` v `../rec.js` (jazyk → soubor a id
hlasu; id je uvedené v samotném JSONu jako `voice_id`).
