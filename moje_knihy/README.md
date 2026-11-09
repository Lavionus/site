# Moje knihy pro Čtečku knih

Co sem nakopíruješ, to se po nahrání webu (`./upload.sh`) objeví ve Čtečce knih
v nabídce ➕ Přidat → 🌐 Moje knihy z webu. Seznam knih (`seznam.json`) se vyrobí sám –
při `./upload.sh` i `./test_local.sh` (nebo ručně `python3 tools/vlastni_knihy.py`).

- Kniha = jeden soubor `.md`, `.txt`, `.epub`, `.mobi`
  nebo složka s kapitolami `01_….md`, `02_….md`, obrázky a obálkou `obalka.jpg`.
- Název a autor u Markdownu z hlavičky na začátku prvního souboru (nepovinné):

  ```
  ---
  title: Název knihy
  author: Jméno Autora
  ---
  ```
- Když knihu upravíš a nahraješ znovu, čtečky ji samy stáhnou (pozice a poznámky zůstanou)
  a na kartě knihy ukážou 🆕 nová verze (s počtem přidaných slov), dokud ji čtenář neotevře.
- Přejmenovat soubor jde – čtečka knihu znovu napojí podle názvu (`title`), pokud je na webu jediná
  s tímto názvem. Smazaná kniha čtenářům zůstane, jen se značkou „není na webu“.
- Pozice čtení a poznámky drží kapitola podle nadpisu. Přejmenovaný nadpis čtečka pozná podle pořadí
  (kapitola zmizela a na stejném místě je nová); nejistější je přejmenovat a zároveň vložit kapitolu před ni.
- Kódování: UTF-8 (i s BOM), UTF-16 z Poznámkového bloku nebo starší windows-1250.
- Tento README, soubory začínající `_` nebo `.` se do seznamu nepočítají.
