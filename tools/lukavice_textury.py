#!/usr/bin/env python3
"""Textury povrchů pro obsah/lukavice.html – z obrázků z lokálního Stable Diffusion udělá navazující dlaždice.

Zdrojové obrázky (1024², Z-Image Turbo přes /mnt/sata/HOME/AI_Obrazky/obraz.py --model zimage), prompty:
  asfalt  "seamless tileable texture, top-down orthographic photo of old grey asphalt road surface, fine aggregate, subtle cracks, uniform even lighting, no shadows, no markings, flat"
  dlazba  "… grey granite cobblestone paving, small square setts in rows …"
  zamkova "… grey concrete interlocking paving blocks sidewalk …"
  sterk   "… compacted gravel and dirt country road surface, small stones, brown grey …"
  trava   "… short green lawn grass with small clover …"
  tasky   "… red clay roof tiles rows, straight on view …"

Spuštění: python3 tools/lukavice_textury.py ADRESAR_S_PNG  → obsah/lukavice/tex_<jméno>.webp (512²)
Mřížkové textury (dlažba, tašky) se oříznou na celý počet period (autokorelace), ostatní se prolnou s kopií
posunutou o půl dlaždice, takže švy zmizí.
"""
import os, subprocess, sys
import numpy as np
from PIL import Image

CIL = os.path.join(os.path.dirname(__file__), '..', 'obsah', 'lukavice')
MRIZKA = {'dlazba', 'zamkova', 'tasky'}
SEDA = {'tasky'}                    # tónuje se barvou vrcholů → jen jas


def perioda(seda, osa):
    """Nejsilnější perioda (px) podél osy z autokorelace průměrného profilu."""
    profil = seda.mean(axis=1 - osa)
    profil = profil - profil.mean()
    ac = np.correlate(profil, profil, 'full')[len(profil) - 1:]
    ac /= ac[0]
    # první výrazné lokální maximum za první nulou
    nula = np.argmax(ac < 0)
    k = nula + np.argmax(ac[nula:len(ac) // 2])
    return int(k)


def prolni(a):
    """Navazující dlaždice: prolnutí s kopií posunutou o půl (váha 1 uprostřed, 0 na okraji)."""
    h, w = a.shape[:2]
    b = np.roll(a, (h // 2, w // 2), axis=(0, 1))
    y = 1 - np.abs(np.linspace(-1, 1, h))[:, None]
    x = 1 - np.abs(np.linspace(-1, 1, w))[None, :]
    m = np.clip(np.minimum(x, y) * 3, 0, 1)[..., None]
    return a * m + b * (1 - m)


def main(zdroj):
    for jmeno in ('asfalt', 'dlazba', 'zamkova', 'sterk', 'trava', 'tasky'):
        img = Image.open(os.path.join(zdroj, jmeno + '.png')).convert('RGB')
        a = np.asarray(img, np.float32)
        if jmeno in MRIZKA:
            s = a.mean(axis=2)
            px, py = perioda(s, 1), perioda(s, 0)
            # sudý počet kusů → posun o půl dlaždice je celý počet period a prolnutí nezdvojí spáry
            nx, ny = max(2, 900 // px // 2 * 2), max(2, 900 // py // 2 * 2)
            a = a[40:40 + ny * py, 40:40 + nx * px]
            print(f'{jmeno}: perioda {px}×{py} px, výřez {nx}×{ny} kusů')
        a = prolni(a)
        # srovnat pomalé změny jasu (nerovnoměrné osvětlení v generovaném obrázku)
        mal = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((8, 8), Image.BILINEAR).resize((a.shape[1], a.shape[0]), Image.BICUBIC)
        a = a / np.maximum(np.asarray(mal, np.float32), 1) * a.reshape(-1, 3).mean(0)
        if jmeno in SEDA:
            l = a @ np.array([0.3, 0.59, 0.11], np.float32)
            a = np.repeat((l / l.mean() * 205)[..., None], 3, axis=2)
        out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS)
        png = os.path.join(zdroj, f'tex_{jmeno}.png')
        out.save(png)
        subprocess.run(['cwebp', '-quiet', '-q', '80', png, '-o', os.path.join(CIL, f'tex_{jmeno}.webp')], check=True)
        print(jmeno, os.path.getsize(os.path.join(CIL, f'tex_{jmeno}.webp')) // 1024, 'kB')


if __name__ == '__main__':
    main(sys.argv[1])
