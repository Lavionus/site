# Krumpáč – plán pokračování

Zadání (21. 10. 2026): „vlož vše navrhované“ + srdce nad maximum + nálezy typu štít, oštěp.
Hra: `obsah/krumpac.html` + `obsah/krumpac/`, zdroje grafiky a stavebnice úrovní v `_test/krumpac_zdroje/` (mimo git).
Testy: `node _test/krumpac_test.js [-v]`, `python3 _test/krumpac_snimek.py [dpi]`.

## Etapy
- [x] A. Jádro: srdce nad maximum (zlatá), štít (pohltí zásah), oštěpy (3 kusy, probodnou), vrhací sekera (z obchodu, nekonečná, prodleva), střely obecně (šípy, kameny), žebříky `|` a lano `!`, falešná zeď `F` (tajné místnosti), vstup nahoru/dolů/hod, dotyková tlačítka ▼ a 🪓
- [x] B. Postup: hvězdičky (všechny drahokamy, bez smrti, čas pod limitem), pokladnička drahokamů, obchod (dvojitý skok, silnější krumpáč, +srdce, vrhací sekera), mapa dolu s výběrem úrovně, uložení `webapp_hra_krumpac_*`
- [x] C. Nepřátelé: pavouk na vlákně `p`, kostlivec lučištník `k`, krtek `m`, ryba `r`
- [x] D. Světy: 2 Ledové jeskyně (led `I` klouže, rampouchy), 3 Zatopené štoly (voda `W`, plavání), 4 Kovárna (pásy `(` `)`, lisy `K`); každý vlastní pozadí, textura, hudba; 2 úrovně + boss — hotovo
- [x] E. Bossové: gobliní náčelník (svět 1), ledová pavoučice (svět 2), obří úhoř (svět 3), kamenný golem (svět 4, finále); ukazatel zdraví, fáze, po porážce se otevře východ — hotovo
- [x] F. Hudba: chiptune smyčka přes WebAudio pro každý svět, vypínač 🎵
- [x] G. Testy: jednotkové testy mechanik a bossů, bot přes běžné úrovně, test dosažitelnosti, snímky v prohlížeči

## Grafika (lokální ComfyUI, `_test/krumpac_zdroje/svety/`)
Postavy přes `--pixel` + „very small sprite in the middle of a large empty plain white background“ (nativní pixel art), bossové „small sprite“ (větší), předměty a pozadí přes `--model zimage`.
