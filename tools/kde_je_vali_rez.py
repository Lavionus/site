#!/usr/bin/env python3
"""Rozřeže archy postav z Codexu (purpurové pozadí #FF00FF) do jednoho atlasu pro Kde je Vali.

  python3 tools/kde_je_vali_rez.py <složka s archy> [--nahled]

Čte vali.png (2 × 2), dav1–3.png, navnady.png, veci.png, zvirata.png a viktor1–6.png (4 × 4). Pozadí se odstraní klíčováním purpurové,
z každé buňky zůstane hlavní postava (souvislé části nedotýkající se okraje + největší část).
Každý arch se zvětší tak, aby jeho medián výšky postav byl VYSKA px – děti zůstanou menší.
Výstup: obsah/kde_je_vali/sprity.webp + predmety.webp (pokoje) + sprity.js (VALI_SPRITY = [{x,y,w,h,druh[,nazev,k]}, …]).
"""
import sys, json
from pathlib import Path
from statistics import median
from PIL import Image, ImageDraw, ImageFilter

KOREN = Path(__file__).resolve().parent.parent
CIL = KOREN / 'obsah' / 'kde_je_vali'
VYSKA = 150          # medián výšky postavy v atlasu (px)
ARCHY = [('vali.png', 2, 'vali'), ('dav1.png', 4, 'dav'), ('dav2.png', 4, 'dav'),
         ('dav3.png', 4, 'dav'), ('navnady.png', 4, 'navnada'), ('veci.png', 4, 'vec'), ('zvirata.png', 4, 'zvire'),
         ('viktor1.png', 4, 'viktor'), ('viktor2.png', 4, 'viktor'), ('viktor3.png', 4, 'viktor'), ('viktor4.png', 4, 'viktor'),
         ('viktor5.png', 4, 'viktor'), ('viktor6.png', 4, 'viktor')]
VYSKA_VIKTOR = 140   # předměty do pokoje – delší strana v atlasu (ve hře se zmenšují podle obtížnosti)
# předměty a zvířata: v atlasu VYSKA_VECI px, ve hře PODIL výšky postavy (pole k = měřítko vůči postavám)
VYSKA_VECI = 110
PODIL = {'vec': 0.3, 'zvire': 0.36}
NAZVY = {
    'veci.png': ['svazek klíčů', 'brýle', 'zelený deštník', 'plyšový medvídek', 'kniha', 'budík', 'palčáky', 'pruhovaná šála',
                 'kšiltovka', 'láhev s pitím', 'fotoaparát', 'dalekohled', 'papírový drak', 'peněženka', 'červený míč', 'dárek'],
    'viktor1.png': ['kapesní hodinky', 'klíč', 'lupa', 'husí brk', 'kalamář', 'šálek', 'svícen', 'brýle', 'dýmka', 'dopis s pečetí',
                    'kompas', 'náprstek', 'nůžky', 'šachový kůň', 'hrací kostka', 'páví pero'],
    'viktor2.png': ['podkova', 'zvonek', 'přesýpací hodiny', 'cylindr', 'vějíř', 'flakon', 'prsten', 'mince', 'soška sovy',
                    'hrací skříňka', 'růže', 'motýl', 'louskáček', 'visací zámek', 'mušle', 'sklenka na víno'],
    'viktor3.png': ['porcelánová panenka', 'olejová lampa', 'ruční zrcátko', 'brož', 'monokl', 'cínový vojáček', 'káča', 'mlýnek na kávu',
                    'lžička', 'čajová konvice', 'krabička na čaj', 'kapesní nůž', 'levandule', 'klubko vlny', 'kroužek na ubrousek', 'pečetidlo'],
    'viktor4.png': ['metronom', 'operní kukátko', 'lahvička s lékem', 'váhy', 'hřeben', 'perly', 'vycházková hůl', 'fotografie',
                    'rukavička', 'mapa', 'soška slona', 'hrací karta', 'tabatěrka', 'mosazný dalekohled', 'jablko', '-'],   # „-“ = buňku vynechat (dýmka by se pletla s první)
    'viktor5.png': ['doutník', 'kulečníková koule', 'domino', 'ladička', 'foukací harmonika', 'noty', 'housle', 'flétna',
                    'mýdlo', 'holicí štětka', 'břitva', 'pudřenka', 'kartáč na šaty', 'náušnice', 'knoflík', 'cívka nití'],
    'viktor6.png': ['amonit', 'ametyst', 'skarabeus', 'hvězdice', 'mořský koník', 'ptačí vejce', 'ozubené kolo', 'klíček od hodin',
                    'kalíšek na vajíčko', 'solnička', 'hruška', 'citron', 'preclík', 'perník', 'kaštan', 'žalud'],
    'zvirata.png': ['kočka', 'pes', 'zajíc', 'kachna', 'ježek', 'papoušek', 'želva', 'myš', 'žába', 'veverka', 'sova', 'slepice',
                    'hlemýžď', 'liška', 'holub', 'tučňák'],
}


def je_pozadi(r, g, b):
    # purpurová a její přechody do obrysů: vysoké R i B, nízké G
    return r > 150 and b > 150 and g < 110 and abs(r - b) < 90


def odbarvi(o: Image.Image) -> Image.Image:
    """Despill: purpurový nádech (R i B nad G, typicky prosvítající sklo) stáhne k zelené složce."""
    px = o.load()
    for y in range(o.height):
        for x in range(o.width):
            r, g, b, a = px[x, y]
            m = min(r, b)
            if a and m > g:
                px[x, y] = (r - (m - g), g, b - (m - g), a)
    return o


def postava(bunka: Image.Image) -> Image.Image | None:
    rgb = bunka.convert('RGB')
    w, h = rgb.size
    px = rgb.load()
    maska = Image.new('L', (w, h), 0)
    mp = maska.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if not je_pozadi(r, g, b):
                mp[x, y] = 255
    maska = maska.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    # souvislé části
    m = maska.copy(); p = m.load(); stitek = 1; casti = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if p[x, y] == 255 and stitek < 250:
                ImageDraw.floodfill(m, (x, y), stitek); casti.append(stitek); stitek += 1
    if not casti:
        return None
    hist = m.histogram()
    okraj = {p[x, 0] for x in range(w)} | {p[x, h - 1] for x in range(w)} | \
            {p[0, y] for y in range(h)} | {p[w - 1, y] for y in range(h)}
    hlavni = max(casti, key=lambda s: hist[s])
    nech = {s for s in casti if hist[s] >= 0.01 * hist[hlavni] and (s not in okraj or s == hlavni)}
    maska = m.point(lambda v: 255 if v in nech else 0)
    box = maska.getbbox()
    # odbarvení purpurového lemu: pixely na okraji masky ztmavit k obrysu
    vystup = rgb.convert('RGBA')
    vystup.putalpha(maska.filter(ImageFilter.GaussianBlur(0.6)))
    vp = vystup.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = vp[x, y]
            if a and r > 140 and b > 140 and g < 140:   # purpurový nádech na hraně
                s = min(r, g, b); vp[x, y] = (s, s, s, a)
    return vystup.crop(box)


def main():
    zdroj = Path(sys.argv[1])
    sprity = []   # (obrázek, druh)
    for soubor, n, druh in ARCHY:
        arch = Image.open(zdroj / soubor)
        W, H = arch.size
        kusy = []; jmena = []
        for i in range(n * n):
            c, r = i % n, i // n
            b = arch.crop((c * W // n, r * H // n, (c + 1) * W // n, (r + 1) * H // n))
            o = postava(b)
            if soubor in NAZVY and NAZVY[soubor][i] == '-':
                continue
            if o is None or o.height < H / n * 0.3:
                print(f'{soubor} buňka {i}: přeskočena'); continue
            if druh == 'viktor':
                o = odbarvi(o)
            kusy.append(o); jmena.append(NAZVY[soubor][i] if soubor in NAZVY else None)
        if druh == 'viktor':   # každý předmět zvlášť: delší strana = VYSKA_VIKTOR
            ks = [VYSKA_VIKTOR / max(o.size) for o in kusy]
        else:
            cil = VYSKA_VECI if druh in PODIL else VYSKA
            ks = [cil / median(o.height for o in kusy)] * len(kusy)
        k = ks[0]
        for o, jm, k in zip(kusy, jmena, ks):
            info = {'druh': druh}
            if jm: info['nazev'] = jm
            if druh in PODIL: info['k'] = round(PODIL[druh] * VYSKA / VYSKA_VECI, 4)
            sprity.append((o.resize((round(o.width * k), round(o.height * k)), Image.LANCZOS), info))
        print(f'{soubor}: {len(kusy)} postav, měřítko {k:.3f}')
    # policové skládání do atlasů: 0 = sprity.webp (venku), 1 = predmety.webp (pokoje, načítá se až v pokoji)
    data = [None] * len(sprity)
    CIL.mkdir(parents=True, exist_ok=True)
    for cislo, soubor in ((0, 'sprity.webp'), (1, 'predmety.webp')):
        vyber = [i for i, (o, info) in enumerate(sprity) if (info['druh'] == 'viktor') == bool(cislo)]
        SIRKA = 2048; x = y = radek = 0; mista = []
        for i in vyber:
            o = sprity[i][0]
            if x + o.width + 2 > SIRKA:
                x = 0; y += radek + 2; radek = 0
            mista.append((x, y)); x += o.width + 2; radek = max(radek, o.height)
        atlas = Image.new('RGBA', (SIRKA, y + radek), (0, 0, 0, 0))
        for i, (x, y) in zip(vyber, mista):
            o, info = sprity[i]
            atlas.paste(o, (x, y))
            data[i] = {'x': x, 'y': y, 'w': o.width, 'h': o.height, **info, **({'a': 1} if cislo else {})}
        atlas.save(CIL / soubor, 'WEBP', quality=88, method=6)
        print(f'{soubor} {atlas.size}, {len(vyber)} spritů')
        if '--nahled' in sys.argv:
            nah = Image.new('RGB', atlas.size, (70, 110, 70)); nah.paste(atlas, (0, 0), atlas)
            nah.save(zdroj / f'atlas{cislo}_nahled.png')
    (CIL / 'sprity.js').write_text('// generuje tools/kde_je_vali_rez.py – ručně neupravovat (a: 1 = atlas predmety.webp)\n'
                                   'const VALI_SPRITY = ' + json.dumps(data, separators=(',', ':')) + ';\n')

main()
