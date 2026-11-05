#!/usr/bin/env python3
"""Export knih pro společnou čtečku (obsah/ctecka/) – všechna díla najednou.

Dílo = jedna položka rozcestníku a jedna stránka čtečky (sága, sbírka povídek, samostatný román…);
dílo má jednu nebo víc knih, kniha má kapitoly (soubory Markdown, první řádek „# Název“).

Pro každé dílo skript:
  - zkopíruje kapitoly do obsah/knihy/<dilo>/<kniha>/ (bez redakčních bloků <!-- … -->),
  - převede ilustrace PNG z obrazky/zdroj/ na WebP a zkopíruje jen ty použité + obálku,
  - zapíše obsah/knihy/<dilo>/knihy.json (seznam knih, kapitol, počty slov, otisky obsahu),
  - vygeneruje stránku čtečky obsah/<stranka> (krátká: nastavení díla + společné skripty),
a nakonec obsah/knihy/dila.json (seznam všech děl – čte ho Sazba knihy).

Nové dílo: přidat položku do DILA níže, spustit `python3 tools/knihy_export.py`, pak přidat stránku
do apps.js (sekce 📚 Knihy, "stav": "vyvoj"), `node tools/generate-index-icons.mjs` a zvednout verzi v sw.js.
Pozor: u existujícího díla neměnit "klic" (uložené pozice a poznámky čtenářů) ani "stranka" (odkazy).
"""
import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
OBSAH = WEB / "obsah"
KRONIKA = WEB.parent / "KronikaLidstva"


def kniha_kronik(cislo, nazev, podtitul):
    slozka = KRONIKA / "books" / f"book_{cislo:02d}"
    return {"id": f"kniha{cislo}", "nazev": nazev, "podtitul": podtitul,
            "koren": slozka, "kapitoly": slozka / "chapters", "vzor": "[0-9]*.md"}


DILA = [
    {
        "id": "kroniky", "nazev": "Kroniky vyhnanství", "ikona": "📚",
        "stranka": "kroniky.html", "klic": "webapp_kroniky", "soubor": "Kroniky_vyhnanstvi",
        "kratky": "Kroniky", "ikona180": "knihy/kroniky/ikona-180.png",
        "popis": "Čtečka ságy Kroniky vyhnanství v sedmi knihách: od Chebska roku 1172 přes pravěk a mezihvězdný soud "
                 "po blízkou budoucnost. Obsah, fulltextové hledání, záložky, zvýraznění a poznámky, předčítání, "
                 "motivy čtení, EPUB a offline čtení.",
        "knihy": [
            kniha_kronik(1, "I. Poslední drak", "Chebsko, léta Páně 1172"),
            kniha_kronik(2, "II. Krev starších", "Jáchymov, 1595"),
            kniha_kronik(3, "III. Paměť kamene", "Yucatán, 2026"),
            kniha_kronik(4, "IV. První vyhnanci", "Pod Atlasem, před 68 400 lety"),
            kniha_kronik(5, "V. Strážci ticha", "Chebsko, 2030"),
            kniha_kronik(6, "VI. Rozsudek", "Prstenec Halm, devět set let po procesu"),
            kniha_kronik(7, "VII. Druhý soud", "Chebsko, 2035"),
        ],
    },
    {
        "id": "povidky_kronik", "nazev": "Povídky ze světa Kronik", "ikona": "📜",
        "stranka": "kniha_povidky_kronik.html", "klic": "webapp_kniha_povidky_kronik", "soubor": "Povidky_ze_sveta_Kronik",
        "kratky": "Povídky", "ikona180": "knihy/kroniky/ikona-180.png",
        "popis": "Samostatné povídky ze světa ságy Kroniky vyhnanství: linie, které v románech nedostaly slovo. "
                 "Obsah, hledání, záložky, poznámky, předčítání, EPUB a offline čtení.",
        "knihy": [
            {"id": "sbirka1", "nazev": "Povídky ze světa Kronik vyhnanství",
             "podtitul": "Odnesli je vlci · Poslední zima obrů · Vejce na útesu",
             "koren": KRONIKA / "povidky", "kapitoly": KRONIKA / "povidky", "vzor": "[0-9][0-9]_*.md",
             "vynechat": "_poznamky.md"},
        ],
    },
]

KOMENTAR = re.compile(r"\s*<!--.*?-->\s*", re.S)
OBRAZEK = re.compile(r"^!\[[^\]]*\]\(([^)\s]+)\)\s*$", re.M)


def webp_z_originalu(slozka):
    """PNG v obrazky/zdroj → obrazky/*.webp, jen když chybí nebo je starší."""
    for png in sorted((slozka / "zdroj").glob("*.png")):
        webp = slozka / (png.stem + ".webp")
        if not webp.exists() or webp.stat().st_mtime < png.stat().st_mtime:
            subprocess.run(["magick", str(png), "-resize", "1400x1400>", "-quality", "80", str(webp)], check=True)


def otisk(data):
    return hashlib.sha1(data).hexdigest()[:10]


def exportuj_knihu(kniha, cil_dila):
    koren = kniha["koren"]
    if (koren / "obrazky").is_dir():
        webp_z_originalu(koren / "obrazky")
    cil = cil_dila / kniha["id"]
    shutil.rmtree(cil, ignore_errors=True)
    cil.mkdir(parents=True)
    kapitoly, pouzite = [], set()
    soubory = [md for md in sorted(kniha["kapitoly"].glob(kniha["vzor"]))
               if not (kniha.get("vynechat") and md.name.endswith(kniha["vynechat"]))]
    if not soubory:
        raise SystemExit(f"{kniha['nazev']}: v {kniha['kapitoly']} nejsou žádné kapitoly")
    for md in soubory:
        text = KOMENTAR.sub("\n", md.read_text(encoding="utf-8")).strip() + "\n"
        (cil / md.name).write_text(text, encoding="utf-8")
        pouzite.update(OBRAZEK.findall(text))
        titulek = text.splitlines()[0].lstrip("# ").strip()
        bez_obrazku = OBRAZEK.sub("", text)
        # otisk obsahu: čtečka ho připojí k adrese (?h=…) – změněný soubor = nová adresa, kterou
        # neobslouží ani CDN GitHub Pages (max-age 600), ani stará kopie v cache prohlížeče
        kapitoly.append({"soubor": md.name, "nazev": titulek, "slov": len(bez_obrazku.split()),
                         "h": otisk(text.encode("utf-8"))})
    obalka = "obrazky/obalka.webp" if (koren / "obrazky" / "obalka.webp").exists() else None
    if obalka:
        pouzite.add(obalka)
    for src in sorted(pouzite):
        puvodni = koren / src
        if not puvodni.exists():
            raise SystemExit(f"{kniha['nazev']}: chybí obrázek {puvodni}")
        (cil / src).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(puvodni, cil / src)
    zaznam = {"id": kniha["id"], "nazev": kniha["nazev"], "podtitul": kniha["podtitul"], "kapitoly": kapitoly,
              "otisky": {src: otisk((cil / src).read_bytes()) for src in sorted(pouzite)}}
    if obalka:
        zaznam["obalka"] = obalka
    print(f"  {kniha['nazev']}: {len(kapitoly)} kapitol, {sum(k['slov'] for k in kapitoly)} slov, {len(pouzite)} obrázků")
    return zaznam


def nastaveni_ctecky(dilo):
    """Co potřebuje čtečka v prohlížeči (window.CTECKA_DILO)."""
    return {"id": dilo["id"], "nazev": dilo["nazev"], "ikona": dilo["ikona"], "data": f"knihy/{dilo['id']}/",
            "stranka": dilo["stranka"], "klic": dilo["klic"], "soubor": dilo["soubor"]}


def stranka(dilo):
    e = lambda s: html.escape(s, quote=True)
    nast = json.dumps(nastaveni_ctecky(dilo), ensure_ascii=False)
    ikona = f'<link rel="apple-touch-icon" href="{e(dilo["ikona180"])}">\n' if dilo.get("ikona180") else ""
    return f"""<!DOCTYPE html>
<html lang="cs">
<head>
<!-- Vygenerováno: python3 tools/knihy_export.py – neupravovat ručně (nastavení díla je v DILA v tom skriptu).
     Čtečka je společná pro všechna díla: obsah/ctecka/ (sablona.js = HTML, ctecka.css, jadro.js, ctecka.js). -->
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(dilo["nazev"])} – čtečka</title>
<meta name="description" content="{e(dilo["popis"])}">
<!-- iPad/iPhone: přidaná na plochu běží bez lišt prohlížeče (Brave/Chrome na iOS celou obrazovku webu nedovolí) -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="{e(dilo.get("kratky", dilo["nazev"]))}">
{ikona}<link rel="stylesheet" href="../common.css">
<link rel="stylesheet" href="ctecka/ctecka.css">
<script src="../theme.js"></script>
<script src="../dialog.js"></script>
<script src="../podpis.js" defer></script>
<script>window.CTECKA_DILO = {nast};</script>
<script src="ctecka/jadro.js"></script>
<script src="ctecka/ctecka.js" defer></script>
</head>
<body>
<script src="ctecka/sablona.js"></script>
</body>
</html>
"""


def main():
    vyber = set(sys.argv[1:])
    seznam_del = []
    for dilo in DILA:
        seznam_del.append({**nastaveni_ctecky(dilo), "popis": dilo["popis"]})
        if vyber and dilo["id"] not in vyber:
            continue
        print(f"{dilo['nazev']} → obsah/knihy/{dilo['id']}/, obsah/{dilo['stranka']}")
        cil_dila = OBSAH / "knihy" / dilo["id"]
        cil_dila.mkdir(parents=True, exist_ok=True)
        knihy = [exportuj_knihu(k, cil_dila) for k in dilo["knihy"]]
        (cil_dila / "knihy.json").write_text(json.dumps(knihy, ensure_ascii=False, indent=1), encoding="utf-8")
        (OBSAH / dilo["stranka"]).write_text(stranka(dilo), encoding="utf-8")
    (OBSAH / "knihy" / "dila.json").write_text(json.dumps(seznam_del, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
