# Generuje sadu ikon Nodusu z vektorizovaného loga (viz build_ikon.sh).
import pathlib, subprocess, sys

S = pathlib.Path(sys.argv[1])          # pracovní složka
OUT = pathlib.Path(sys.argv[2])        # cíl (nodus/)
D = (S / 'path.txt').read_text().strip()
W, H = 782, 737                        # rozměr vektorizované předlohy
MODRA = '#2f6fce'                      # --accent světlého motivu

def uzel(barva, x=0, y=0, k=1.0):
    """Značka jako <g>; potrace kreslí v desetinách a s převrácenou osou Y."""
    return (f'<g transform="translate({x:g},{y+H*k:g}) scale({0.1*k:g},{-0.1*k:g})" '
            f'fill="{barva}">\n<path d="{D}"/>\n</g>')

def ctverec(velikost, podil, soubor, pozadi=MODRA, radius=0):
    """Značka vycentrovaná ve čtvercové dlaždici (podíl = kolik z šířky zabere)."""
    k = podil * velikost / W
    x, y = (velikost - W * k) / 2, (velikost - H * k) / 2
    tvar = (f'<rect width="{velikost}" height="{velikost}" rx="{radius}" fill="{pozadi}"/>'
            if pozadi else '')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {velikost} {velikost}" '
           f'width="{velikost}" height="{velikost}">\n{tvar}\n{uzel("#fff", x, y, k)}\n</svg>')
    (S / soubor).write_text(svg)
    return S / soubor

# 1) logo.svg – průhledné, barvu bere z okolního textu (funguje v obou motivech)
(OUT / 'logo.svg').write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="currentColor" '
    f'role="img" aria-label="Nodus">\n{uzel("currentColor")}\n</svg>\n')

# 2) favicon.svg – plná modrá dlaždice s bílým uzlem (stejný jazyk jako ikona PWA).
#    Bez zaoblení: průhledné rohy si prohlížeč při vykreslení do záložky
#    podloží bílou, takže by ikona měla bílé růžky. Zaoblení si podle
#    vlastního vkusu doplní systém sám.
zdroj = ctverec(64, 0.74, 'favicon-src.svg', radius=0)
(OUT / 'favicon.svg').write_text(zdroj.read_text() + '\n')

# 3) rastry
ulohy = [
    ('icon-192.png', 192, 0.74, 0),
    ('icon-512.png', 512, 0.74, 0),
    ('icon-maskable-512.png', 512, 0.55, 0),   # obsah v bezpečné zóně (80 % kruhu)
    ('apple-touch-icon.png', 180, 0.70, 0),
]
for jmeno, vel, podil, r in ulohy:
    src = ctverec(vel, podil, jmeno.replace('.png', '-src.svg'), radius=r)
    subprocess.run(['inkscape', str(src), '-w', str(vel), '-h', str(vel),
                    '-o', str(OUT / jmeno)], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('hotovo', jmeno)

# 4) favicon.ico (16/32/48) – záloha pro prohlížeče bez SVG ikon
casti = []
for vel in (16, 32, 48):
    src = ctverec(vel, 0.78, f'ico-{vel}.svg', radius=0)
    png = S / f'ico-{vel}.png'
    subprocess.run(['inkscape', str(src), '-w', str(vel), '-h', str(vel), '-o', str(png)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    casti.append(str(png))
subprocess.run(['magick'] + casti + [str(OUT / 'favicon.ico')], check=True)
print('hotovo favicon.ico')
