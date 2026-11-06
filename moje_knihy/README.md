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
- Když knihu upravíš a nahraješ znovu, čtečky ji samy stáhnou (pozice a poznámky zůstanou).
- Tento README, soubory začínající `_` nebo `.` se do seznamu nepočítají.
