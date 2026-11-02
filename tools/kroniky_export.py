#!/usr/bin/env python3
"""Zkopíruje kapitoly ságy Kroniky vyhnanství z ../KronikaLidstva do obsah/kroniky/.

Redakční bloky <!-- KONTINUITA … --> a _shrnuti.md se na web nedávají.
Ilustrace: originály PNG v books/book_NN/obrazky/zdroj/ → WebP (delší strana 1400 px)
v books/book_NN/obrazky/ (na ně odkazuje Markdown) → na web jen ty, na které kapitoly
odkazují, a obálka (obrazky/obalka.webp).
Po přepsání knih stačí spustit znovu: python3 tools/kroniky_export.py
"""
import json
import re
import shutil
import subprocess
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
ZDROJ = WEB.parent / "KronikaLidstva" / "books"
CIL = WEB / "obsah" / "kroniky"

KNIHY = [
    ("book_01", "kniha1", "I. Poslední drak", "Chebsko, léta Páně 1172"),
    ("book_02", "kniha2", "II. Krev starších", "Jáchymov, 1595"),
    ("book_03", "kniha3", "III. Paměť kamene", "Yucatán, 2026"),
    ("book_04", "kniha4", "IV. První vyhnanci", "Pod Atlasem, před 68 400 lety"),
    ("book_05", "kniha5", "V. Strážci ticha", "Chebsko, 2030"),
    ("book_06", "kniha6", "VI. Rozsudek", "Prstenec Halm, devět set let po procesu"),
]

KOMENTAR = re.compile(r"\s*<!--.*?-->\s*", re.S)
OBRAZEK = re.compile(r"^!\[[^\]]*\]\(([^)\s]+)\)\s*$", re.M)


def webp_z_originalu(slozka):
    """PNG v obrazky/zdroj → obrazky/*.webp, jen když chybí nebo je starší."""
    for png in sorted((slozka / "zdroj").glob("*.png")):
        webp = slozka / (png.stem + ".webp")
        if not webp.exists() or webp.stat().st_mtime < png.stat().st_mtime:
            subprocess.run(["magick", str(png), "-resize", "1400x1400>", "-quality", "80", str(webp)], check=True)


seznam = []
for slozka, id_knihy, nazev, podtitul in KNIHY:
    kniha_zdroj = ZDROJ / slozka
    obrazky_zdroj = kniha_zdroj / "obrazky"
    if obrazky_zdroj.is_dir():
        webp_z_originalu(obrazky_zdroj)
    cil = CIL / id_knihy
    shutil.rmtree(cil, ignore_errors=True)
    cil.mkdir(parents=True)
    kapitoly, pouzite = [], set()
    for md in sorted((kniha_zdroj / "chapters").glob("[0-9]*.md")):
        text = KOMENTAR.sub("\n", md.read_text(encoding="utf-8")).strip() + "\n"
        (cil / md.name).write_text(text, encoding="utf-8")
        pouzite.update(OBRAZEK.findall(text))
        titulek = text.splitlines()[0].lstrip("# ").strip()
        bez_obrazku = OBRAZEK.sub("", text)
        kapitoly.append({"soubor": md.name, "nazev": titulek, "slov": len(bez_obrazku.split())})
    obalka = "obrazky/obalka.webp" if (kniha_zdroj / "obrazky" / "obalka.webp").exists() else None
    if obalka:
        pouzite.add(obalka)
    for src in sorted(pouzite):
        puvodni = kniha_zdroj / src
        if not puvodni.exists():
            raise SystemExit(f"{md.name}: chybí obrázek {puvodni}")
        (cil / src).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(puvodni, cil / src)
    zaznam = {"id": id_knihy, "nazev": nazev, "podtitul": podtitul, "kapitoly": kapitoly}
    if obalka:
        zaznam["obalka"] = obalka
    seznam.append(zaznam)
    print(f"{nazev}: {len(kapitoly)} kapitol, {sum(k['slov'] for k in kapitoly)} slov, {len(pouzite)} obrázků")

(CIL / "knihy.json").write_text(json.dumps(seznam, ensure_ascii=False, indent=1), encoding="utf-8")
