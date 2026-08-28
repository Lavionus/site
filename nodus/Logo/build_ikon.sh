#!/bin/bash
# Vygeneruje celou sadu ikon Nodusu ze zdrojového Logo.png.
#
# Postup: Logo.png se ořízne na značku, převede na dvoubarevnou masku a
# potrace z ní udělá vektor. Z jedné vektorové cesty pak vzniká všechno
# ostatní – díky tomu jsou ikony ostré v každé velikosti a nemají pozadí
# ze skenu (bílý čtverec) ani kompresní artefakty JPEGu.
#
# Potřebuje: imagemagick, potrace, inkscape, python3 (Pillow není nutné).
# Spouští se ručně, jen když se změní podklad – výstupy jsou v gitu.
set -e
cd "$(dirname "$0")"
PRAC=$(mktemp -d)
trap 'rm -rf "$PRAC"' EXIT

# 1) ořez na značku (bbox v Logo.png) + mírné rozostření, aby po prahování
#    nezůstalo schodovité okrajové zoubkování
magick Logo.png -crop 782x737+236+218 +repage -colorspace gray -blur 0x1.2 \
       -threshold 70% "$PRAC/uzel.pbm"

# 2) vektorizace (jedna cesta, ~1,2 kB)
potrace "$PRAC/uzel.pbm" -s -o "$PRAC/uzel.svg" -a 1.3 -O 0.6 -t 20 --flat

# 3) z cesty vygenerovat logo.svg, favicon.svg/ico, icon-*.png, apple-touch-icon.png
python3 - "$PRAC" <<'PY'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1])
d = re.search(r'<path d="(.*?)"/>', (p / 'uzel.svg').read_text(), re.S).group(1)
(p / 'path.txt').write_text(' '.join(d.split()))
PY
python3 gen_ikon.py "$PRAC" ..

echo "Ikony přegenerovány do nodus/. Nezapomeň zvýšit verzi cache v nodus/sw.js."
