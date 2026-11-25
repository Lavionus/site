# Písma z Google Fonts – lokální kopie

Stránky `trip_planner`, `wedding_invite` a `font_preview` dřív načítaly písma přímo
z `fonts.googleapis.com`. Teď je berou odsud, takže fungují offline a web
neposílá adresu návštěvníka Googlu.

Složku plní `python3 tools/gfonts_lokalne.py <jmeno> "<adresa css2>"`: zapíše
`<jmeno>.css` a soubory `.woff2` (jen řezy latin a latin-ext). CSS ručně
neupravovat – jiný výběr písem = spustit nástroj znovu s jinou adresou
(původní adresa je v hlavičce každého CSS).

Všechna písma jsou volně šiřitelná: většina pod SIL Open Font License 1.1,
některá pod Apache License 2.0, Ubuntu pod Ubuntu Font Licence 1.0. Licenci
a autory konkrétní rodiny uvádí její stránka na <https://fonts.google.com>
(záložka License).
