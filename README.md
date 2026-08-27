# sites

Statický web se sbírkou malých HTML aplikací, hostovaný na GitHub Pages
(<https://lavionus.github.io/site/>). Bez backendu, data zůstávají v prohlížeči.

| Cesta | Web | Katalog | Stránky |
|---|---|---|---|
| `/` | hlavní rozcestník – 262 aplikací | `apps.js` | `obsah/` |
| `/nodus/` | ◈ **Nodus** – výukový web: 77 aplikací + 174 připravovaných témat podle osnov ZŠ | `nodus/apps.js` | `nodus/obsah/` |

Nodus má vlastní rozcestník, úvodní přehled, ikony, manifest i service worker,
takže se dá nasadit i samostatně – podrobnosti v [`nodus/README.md`](nodus/README.md).
Hlavní web na něj odkazuje z menu a z úvodní stránky; staré odkazy
`index.html#obsah/<výuková aplikace>` se automaticky přesměrují.

```bash
./test_local.sh          # lokální server na http://localhost:8000 (nikdy file://)
./upload.sh "zpráva"     # commit + pull --rebase + push
```

Po větší změně zvyš verzi cache v `sw.js` (`webapp-vN`), resp. v `nodus/sw.js`
(`nodus-vN`) – jinak návštěvník uvidí novou verzi až při druhém načtení.
