#!/usr/bin/env python3
"""Zkopíruje kapitoly ságy Kroniky vyhnanství z ../KronikaLidstva do obsah/kroniky/.

Redakční bloky <!-- KONTINUITA … --> a _shrnuti.md se na web nedávají.
Po přepsání knih stačí spustit znovu: python3 tools/kroniky_export.py
"""
import json
import re
import shutil
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
ZDROJ = WEB.parent / "KronikaLidstva" / "books"
CIL = WEB / "obsah" / "kroniky"

KNIHY = [
    ("book_01", "kniha1", "I. Poslední drak", "Chebsko, léta Páně 1172"),
    ("book_02", "kniha2", "II. Krev starších", "Jáchymov, 1595"),
]

KOMENTAR = re.compile(r"\s*<!--.*?-->\s*", re.S)

seznam = []
for slozka, id_knihy, nazev, podtitul in KNIHY:
    cil = CIL / id_knihy
    shutil.rmtree(cil, ignore_errors=True)
    cil.mkdir(parents=True)
    kapitoly = []
    for md in sorted((ZDROJ / slozka / "chapters").glob("[0-9]*.md")):
        text = KOMENTAR.sub("\n", md.read_text(encoding="utf-8")).strip() + "\n"
        (cil / md.name).write_text(text, encoding="utf-8")
        titulek = text.splitlines()[0].lstrip("# ").strip()
        kapitoly.append({"soubor": md.name, "nazev": titulek, "slov": len(text.split())})
    seznam.append({"id": id_knihy, "nazev": nazev, "podtitul": podtitul, "kapitoly": kapitoly})
    print(f"{nazev}: {len(kapitoly)} kapitol, {sum(k['slov'] for k in kapitoly)} slov")

(CIL / "knihy.json").write_text(json.dumps(seznam, ensure_ascii=False, indent=1), encoding="utf-8")
