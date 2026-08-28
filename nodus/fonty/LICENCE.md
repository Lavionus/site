# Psací písmo – původ a licence

| Soubor | Co to je |
|---|---|
| `playwrite-cz.woff2` | **Playwrite CZ** – česká školní psací abeceda (variabilní řez, osa `wght` 100–400) |
| `OFL.txt` | plné znění licence |

- Autoři: TypeTogether (Veronika Burian, José Scaglione), projekt Playwrite
- Zdroj: <https://github.com/TypeTogether/Playwrite>, vydáno přes Google Fonts
- **Licence: SIL Open Font License 1.1** – font se smí volně používat, vkládat do
  stránek i dále šířit, musí ale zůstat pod OFL a se zachovaným `OFL.txt`.

Písmo Playwrite existuje v národních variantách podle toho, jak se psací písmo
učí v jednotlivých zemích; `CZ` je česká varianta, takže tvary odpovídají tomu,
co se děti učí psát ve škole. Obsahuje celou českou diakritiku
(ě š č ř ž ý á í é ú ů ď ť ň i velká písmena).

Soubor v repozitáři je **zúžený na latinku** (`pyftsubset`, rozsahy latin +
latin-ext) – z původních 486 znaků zbylo vše potřebné pro češtinu, velikost
klesla na 68 kB. Variabilní osa tloušťky zůstala zachovaná, takže se dá vypsat
i světlejší tah (např. jako předloha k obtahování).

## Použití na stránkách

Písmo deklaruje `common.css`, stačí tedy sáhnout po proměnné:

```css
.neco { font-family: var(--font-psaci); line-height: 1.45; }
```

Psací tvary mají vysoké dotažnice (nahoře i dole), proto se jim vyplatí dát
větší `line-height` než tiskacímu písmu – jinak se horní klička nebo háček
u velkých písmen opticky dotýká řádku nad sebou.
