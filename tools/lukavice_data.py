#!/usr/bin/env python3
"""Data pro obsah/lukavice.html – 3D svět obce Lukavice (okres Ústí nad Orlicí).

Stáhne (nebo vezme z mezipaměti) mapová data OpenStreetMap (API /map po
čtvrtinách) a data ČÚZK (DMR 5G, DMP 1G, ortofoto – tools/lukavice_cuzk.py) a vyrobí:
  obsah/lukavice/data.json    budovy, cesty, železnice, stromy, místa (souřadnice v dm)
  obsah/lukavice/vyska.bin    mřížka výšek Uint16 v dm nad VYSKA_MIN (krok KROK m)
  obsah/lukavice/podklad.webp barevný podklad terénu (pole, louky, les, voda, cesty)
  obsah/lukavice/stromy.png   maska stromů po 2 m (255 = les, 120 = zahrada)
  obsah/lukavice/koryto.png   jemná vložka koryt potoků po 2 m (viz lukavice_cuzk.koryta)

Souřadnice světa: x na východ, z na jih, počátek ve středu obdélníku, metry.

Spuštění:  python3 tools/lukavice_data.py [--zdroj ADRESAR_MEZIPAMETI]
"""
import argparse, json, math, os, subprocess, urllib.request
import xml.etree.ElementTree as ET
import numpy as np
import lukavice_cuzk as cuzk
from PIL import Image, ImageDraw, ImageFilter

JIH, SEVER, ZAPAD, VYCHOD = 50.040, 50.074, 16.447, 16.527
LAT0, LON0 = (JIH + SEVER) / 2, (ZAPAD + VYCHOD) / 2
MX = 111320 * math.cos(math.radians(LAT0))   # metrů na stupeň délky
MZ = 110574                                  # metrů na stupeň šířky
SIRKA = (VYCHOD - ZAPAD) * MX
HLOUBKA = (SEVER - JIH) * MZ
KROK = 10           # m mezi body výškové mřížky
PX = 2.0            # m na pixel podkladu
UA = 'lavionus-site-data/1.0'
CIL = os.path.join(os.path.dirname(__file__), '..', 'obsah', 'lukavice')


def stahni(url, soubor):
    if os.path.exists(soubor) and os.path.getsize(soubor) > 1000:
        return
    print('stahuji', url)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=120) as r, open(soubor, 'wb') as f:
        f.write(r.read())


def svet(lat, lon):
    return (lon - LON0) * MX, -(lat - LAT0) * MZ


# ---------- OSM ----------
def nacti_osm(zdroj):
    uzly, cesty, relace = {}, {}, {}
    os.makedirs(os.path.join(zdroj, 'api'), exist_ok=True)
    k = 0
    for lon in ((ZAPAD, (ZAPAD + VYCHOD) / 2), ((ZAPAD + VYCHOD) / 2, VYCHOD)):
        for lat in ((JIH, LAT0), (LAT0, SEVER)):
            k += 1
            f = os.path.join(zdroj, 'api', f'c{k}.osm')
            stahni(f'https://api.openstreetmap.org/api/0.6/map?bbox={lon[0]},{lat[0]},{lon[1]},{lat[1]}', f)
            for e in ET.parse(f).getroot():
                tagy = {t.get('k'): t.get('v') for t in e.findall('tag')}
                if e.tag == 'node':
                    uzly[e.get('id')] = (float(e.get('lat')), float(e.get('lon')), tagy)
                elif e.tag == 'way':
                    cesty[e.get('id')] = ([n.get('ref') for n in e.findall('nd')], tagy)
                elif e.tag == 'relation':
                    relace[e.get('id')] = ([(m.get('type'), m.get('ref'), m.get('role')) for m in e.findall('member')], tagy)
    return uzly, cesty, relace


def body(uzly, refs):
    out = []
    for r in refs:
        if r in uzly:
            out.append(svet(uzly[r][0], uzly[r][1]))
    return out


def spoj_kruhy(seznamy):
    """Spojí úseky cest do uzavřených kruhů (multipolygon)."""
    useky = [list(s) for s in seznamy if len(s) > 1]
    kruhy = []
    while useky:
        k = useky.pop(0)
        zmena = True
        while k[0] != k[-1] and zmena:
            zmena = False
            for i, u in enumerate(useky):
                if u[0] == k[-1]: k += u[1:]
                elif u[-1] == k[-1]: k += u[-2::-1]
                elif u[-1] == k[0]: k = u[:-1] + k
                elif u[0] == k[0]: k = u[:0:-1] + k
                else: continue
                useky.pop(i); zmena = True; break
        if len(k) > 3:
            kruhy.append(k)
    return kruhy


def plochy(uzly, cesty, relace, klic):
    """[(hodnota, [vnější kruhy], [vnitřní kruhy])] pro tag klic."""
    out = []
    for refs, t in cesty.values():
        if klic in t and len(refs) > 3 and refs[0] == refs[-1]:
            out.append((t[klic], [body(uzly, refs)], []))
    for clenove, t in relace.values():
        if klic in t and t.get('type') == 'multipolygon':
            vn = [cesty[r][0] for ty, r, role in clenove if ty == 'way' and r in cesty and role != 'inner']
            vni = [cesty[r][0] for ty, r, role in clenove if ty == 'way' and r in cesty and role == 'inner']
            out.append((t[klic], [body(uzly, k) for k in spoj_kruhy(vn)], [body(uzly, k) for k in spoj_kruhy(vni)]))
    return out


# ---------- podklad ----------
BARVY = {
    'zaklad': (118, 152, 78), 'meadow': (118, 156, 76), 'grassland': (128, 152, 84),
    'farmland': (150, 146, 88), 'residential': (110, 142, 76), 'farmyard': (142, 132, 106),
    'industrial': (138, 136, 128), 'railway': (130, 124, 112), 'allotments': (112, 138, 76),
    'forest': (52, 82, 44), 'wood': (52, 82, 44), 'scrub': (88, 112, 60), 'wetland': (96, 124, 92),
    'water': (66, 104, 128), 'pitch': (92, 146, 70), 'park': (102, 146, 72), 'garden': (104, 142, 70),
    'recreation_ground': (106, 146, 74), 'religious': (120, 138, 92), 'parking': (110, 110, 108),
    'swimming_pool': (70, 150, 180), 'cemetery': (100, 120, 80), 'tree_row': (60, 92, 48),
}
CESTY = {  # šířka m, zpevněná
    'secondary': (7.0, 1), 'tertiary': (6.0, 1), 'unclassified': (5.0, 1), 'residential': (5.0, 1),
    'living_street': (4.5, 1), 'service': (3.5, 1), 'track': (3.0, 0), 'footway': (1.6, 1),
    'path': (1.4, 0), 'cycleway': (2.0, 1), 'steps': (1.6, 1), 'pedestrian': (3.0, 1),
}


def na_px(p):
    return ((p[0] + SIRKA / 2) / PX, (p[1] + HLOUBKA / 2) / PX)


def podklad(seznam_ploch, cesty_seznam, potoky, zeleznice, budovy, rng):
    W, H = int(SIRKA / PX), int(HLOUBKA / PX)
    obr = np.zeros((H, W, 3), np.float32)
    obr[:] = BARVY['zaklad']
    les = Image.new('L', (W, H), 0)
    zahrady = Image.new('L', (W, H), 0)
    poradi = ['residential', 'religious', 'cemetery', 'farmyard', 'industrial', 'railway', 'meadow', 'grassland',
              'farmland', 'allotments', 'recreation_ground', 'park', 'garden', 'scrub', 'wetland', 'forest', 'wood',
              'pitch', 'parking', 'water', 'swimming_pool']
    for druh in poradi:
        for hodnota, vnejsi, vnitrni in seznam_ploch:
            if hodnota != druh or not vnejsi:
                continue
            maska = Image.new('L', (W, H), 0)
            d = ImageDraw.Draw(maska)
            for k in vnejsi:
                if len(k) > 2: d.polygon([na_px(p) for p in k], fill=255)
            for k in vnitrni:
                if len(k) > 2: d.polygon([na_px(p) for p in k], fill=0)
            m = np.asarray(maska, np.float32)[..., None] / 255
            if m.max() == 0:
                continue
            barva = np.array(BARVY[druh], np.float32)
            if druh == 'farmland':   # každé pole jiný odstín a směr brázd
                barva = barva * rng.uniform(0.86, 1.1) * rng.uniform(0.96, 1.04, 3)
                ys, xs = np.nonzero(m[..., 0])
                y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
                uhel = rng.uniform(0, math.pi)
                yy, xx = np.mgrid[y0:y1, x0:x1]
                pruh = np.sin((xx * math.cos(uhel) + yy * math.sin(uhel)) * 1.6) * 0.07 + 1
                vyrez = obr[y0:y1, x0:x1]
                mm = m[y0:y1, x0:x1]
                vyrez[:] = vyrez * (1 - mm) + (barva * pruh[..., None]) * mm
                continue
            if druh == 'meadow':
                barva = barva * rng.uniform(0.92, 1.08, 3)
            obr[:] = obr * (1 - m) + barva * m
            if druh in ('forest', 'wood'):
                les.paste(255, mask=maska)
            if druh in ('residential', 'garden', 'allotments', 'religious'):
                zahrady.paste(255, mask=maska)
    obr_pil = Image.fromarray(np.clip(obr, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(obr_pil)
    for druh, sirka, pts in potoky:
        d.line([na_px(p) for p in pts], fill=(92, 104, 70), width=max(2, int((sirka + 2) / PX)), joint='curve')
    for druh, (sirka, zpev), pts in cesty_seznam:   # krajnice pod pásy silnic
        barva = (96, 92, 80) if zpev else (122, 108, 84)
        d.line([na_px(p) for p in pts], fill=barva, width=max(1, int((sirka + 1.5) / PX)), joint='curve')
    for pts in zeleznice:
        d.line([na_px(p) for p in pts], fill=(112, 104, 96), width=int(5 / PX), joint='curve')
    zastaveno = Image.new('L', (W, H), 0)
    dz = ImageDraw.Draw(zastaveno)
    for b in budovy:
        dz.polygon([na_px(p) for p in b['body']], fill=255)
    for druh, (sirka, zpev), pts in cesty_seznam:
        dz.line([na_px(p) for p in pts], fill=255, width=max(2, int((sirka + 3) / PX)))
    for pts in zeleznice:
        dz.line([na_px(p) for p in pts], fill=255, width=int(8 / PX))
    for druh, sirka, pts in potoky:
        dz.line([na_px(p) for p in pts], fill=255, width=max(2, int(sirka / PX)))
    # stín pod budovami (ambient occlusion) a šum
    ao = np.asarray(zastaveno.filter(ImageFilter.GaussianBlur(2)), np.float32)[..., None] / 255
    a = np.asarray(obr_pil, np.float32)
    a *= 1 - ao * 0.25
    sum_ = rng.normal(1, 0.05, (H // 4 + 1, W // 4 + 1)).astype(np.float32)
    sum_ = np.asarray(Image.fromarray(sum_).resize((W, H), Image.BILINEAR))[..., None]
    a *= sum_ * rng.normal(1, 0.025, (H, W, 1)).astype(np.float32)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), les, zahrady, zastaveno


# ---------- budovy ----------
def plocha(pts):
    return 0.5 * sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))


def zjednodus(pts, tol=0.35):
    """Vyhodí body téměř na přímce (OSM obrysy mají zbytečné uzly)."""
    out = list(pts)
    zmena = True
    while zmena and len(out) > 3:
        zmena = False
        for i in range(len(out)):
            a, b, c = out[i - 1], out[i], out[(i + 1) % len(out)]
            dx, dz = c[0] - a[0], c[1] - a[1]
            l = math.hypot(dx, dz) or 1
            if abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / l < tol or math.hypot(b[0] - a[0], b[1] - a[1]) < 0.3:
                out.pop(i); zmena = True; break
    return out


def budova(pts, t):
    druh = t.get('building', 'yes')
    s = abs(plocha(pts))
    try:
        patra = float(t.get('building:levels', '').replace(',', '.'))
    except ValueError:
        patra = None
    strecha = t.get('roof:shape')
    if druh in ('garage', 'garages', 'roof', 'carport', 'shed') or (druh == 'yes' and s < 30):
        vyska, strecha = 2.6, strecha or ('pultova' if s < 30 else 'plocha')
    elif druh in ('barn', 'farm_auxiliary', 'stable', 'cowshed'):
        vyska, strecha = 4.5, strecha or 'sedlova'
    elif druh in ('industrial', 'warehouse', 'commercial', 'service'):
        vyska, strecha = (patra * 3.5 if patra else 6.0), strecha or ('nizka' if s < 1500 else 'plocha')
    elif druh in ('church', 'chapel'):
        vyska, strecha = (11.0 if druh == 'church' else 4.0), 'sedlova'
    else:
        vyska = (patra * 2.9 if patra else (5.8 if s > 140 else 3.0)) + 0.4
        strecha = strecha or ('plocha' if druh == 'apartments' and (patra or 1) > 3 else 'sedlova')
    if 'height' in t:
        try: vyska = float(t['height'].replace(',', '.').split()[0]) * 0.75
        except ValueError: pass
    strecha = {'gabled': 'sedlova', 'hipped': 'valbova', 'flat': 'plocha', 'skillion': 'pultova',
               'pyramidal': 'valbova', 'half-hipped': 'valbova'}.get(strecha, strecha)
    if strecha not in ('sedlova', 'valbova', 'plocha', 'pultova', 'nizka'):
        strecha = 'sedlova'
    return {'druh': druh, 'vyska': vyska, 'strecha': strecha, 'body': pts}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zdroj', default='/tmp/lukavice_zdroj')
    a = ap.parse_args()
    os.makedirs(a.zdroj, exist_ok=True)
    os.makedirs(CIL, exist_ok=True)
    rng = np.random.default_rng(7)

    dmr, dmp, orto = cuzk.nacti(a.zdroj, (JIH, SEVER, ZAPAD, VYCHOD, SIRKA, HLOUBKA))
    nx, nz = int(SIRKA // KROK) + 1, int(HLOUBKA // KROK) + 1
    vysky = cuzk.hruba_mrizka(dmr, nx, nz, KROK)

    uzly, cesty, relace = nacti_osm(a.zdroj)
    uvnitr = lambda p: abs(p[0]) < SIRKA / 2 - 2 and abs(p[1]) < HLOUBKA / 2 - 2

    budovy = []
    for refs, t in cesty.values():
        if 'building' in t and refs[0] == refs[-1] and len(refs) > 3:
            pts = body(uzly, refs[:-1])
            if len(pts) < 3 or not all(uvnitr(p) for p in pts):
                continue
            if plocha(pts) < 0:      # jednotně proti směru hodinových ručiček (v x/z)
                pts.reverse()
            pts = zjednodus(pts)
            if len(pts) >= 3 and abs(plocha(pts)) > 4:
                budovy.append(budova(pts, t))

    def oriznout(pts):
        """Rozdělí lomenou čáru na úseky uvnitř světa."""
        out, cur = [], []
        for p in pts:
            if uvnitr(p): cur.append(p)
            else:
                if len(cur) > 1: out.append(cur)
                cur = []
        if len(cur) > 1: out.append(cur)
        return out

    seznam_cest, potoky, zeleznice = [], [], []
    for refs, t in cesty.values():
        h = t.get('highway')
        if h in CESTY and t.get('area') != 'yes':
            sirka, zpev = CESTY[h]
            if t.get('surface') in ('asphalt', 'paved', 'concrete', 'paving_stones', 'sett'): zpev = 1
            elif t.get('surface') in ('gravel', 'dirt', 'ground', 'grass', 'unpaved', 'fine_gravel', 'compacted'): zpev = 0
            if h == 'track' and t.get('tracktype') == 'grade1': zpev = 1
            for u in oriznout(body(uzly, refs)):
                seznam_cest.append((h, (sirka, zpev), u))
        w = t.get('waterway')
        if w in ('stream', 'river', 'ditch', 'drain', 'canal'):
            for u in oriznout(body(uzly, refs)):
                potoky.append((w, {'river': 8, 'canal': 5, 'stream': 2.5}.get(w, 1.5), u))
        if t.get('railway') == 'rail':
            for u in oriznout(body(uzly, refs)):
                zeleznice.append(u)

    seznam_ploch = plochy(uzly, cesty, relace, 'landuse') + plochy(uzly, cesty, relace, 'natural') \
        + [(v, k, i) for v, k, i in plochy(uzly, cesty, relace, 'leisure') if v in BARVY] \
        + [('parking', k, i) for v, k, i in plochy(uzly, cesty, relace, 'amenity') if v == 'parking']
    cuzk.vyrovnej_silnice(vysky, KROK, dmr, seznam_cest, zeleznice)
    vmin = math.floor(float(vysky.min())) - 1
    ((vysky - vmin) * 10).round().astype('<u2').tofile(os.path.join(CIL, 'vyska.bin'))
    print('výšky', vysky.shape, round(float(vysky.min())), '–', round(float(vysky.max())), 'm')
    hladiny = cuzk.koryta(dmr, vysky, KROK, potoky, seznam_cest, zeleznice, CIL)
    cuzk.rozbor_budov(budovy, dmr, dmp, orto)
    sportoviste = [k for v, vn, vni in plochy(uzly, cesty, relace, 'leisure') if v in ('pitch', 'sports_centre', 'playground') for k in vn]
    budovy += [b for b in cuzk.drobne_stavby(budovy, seznam_cest, dmr, dmp, orto, sportoviste) if all(uvnitr(p) for p in b['body'])]
    cuzk.stromy_z_dmp(a.zdroj, (JIH, SEVER, ZAPAD, VYCHOD, SIRKA, HLOUBKA), dmr, orto, budovy, seznam_cest, -SIRKA / 2, -HLOUBKA / 2, CIL)
    obr, les, zahrady, zastaveno = podklad(seznam_ploch, seznam_cest, potoky, zeleznice, budovy, rng)
    png = os.path.join(a.zdroj, 'podklad.png')
    obr.save(png)
    subprocess.run(['cwebp', '-quiet', '-q', '82', png, '-o', os.path.join(CIL, 'podklad.webp')], check=True)

    # stromy: les a zahrady jako maska (255 = les, 120 = zahrada) – rozsadí je stránka;
    # stromořadí a jednotlivé stromy z OSM jako body
    lesm, zahm, zasm = (np.asarray(m) > 0 for m in (les, zahrady, zastaveno))
    maska = np.where(lesm, 255, np.where(zahm, 120, 0)).astype(np.uint8)
    maska[zasm] = 0
    Image.fromarray(maska).save(os.path.join(CIL, 'stromy.png'), optimize=True)
    stromy = []
    for refs, t in cesty.values():
        if t.get('natural') == 'tree_row':
            pts = body(uzly, refs)
            for p, q in zip(pts, pts[1:]):
                n = max(1, int(math.hypot(q[0] - p[0], q[1] - p[1]) / 8))
                for k in range(n):
                    stromy.append((p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n, 0))
    for la, lo, t in uzly.values():
        if t.get('natural') == 'tree':
            stromy.append((*svet(la, lo), 0))
    stromy = [s for s in stromy if uvnitr(s)]

    mista = []
    for la, lo, t in uzly.values():
        if 'name' not in t:
            continue
        druh = t.get('place') or t.get('amenity') or t.get('historic') or t.get('natural') or t.get('railway')
        if druh and uvnitr(svet(la, lo)):
            mista.append([t['name'], *(round(v * 10) for v in svet(la, lo)), druh])
    for refs, t in cesty.values():
        if 'name' in t and ('amenity' in t or t.get('building') in ('church', 'chapel')):
            pts = body(uzly, refs)
            if pts and uvnitr(pts[0]):
                cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
                mista.append([t['name'], round(cx * 10), round(cz * 10), t.get('amenity') or t.get('building')])
    obec = next((m for m in mista if m[0] == 'Lukavice' and m[3] == 'village'), None)

    # drobné objekty z OSM (uzly) a čárové prvky: ploty, živé ploty, elektrické vedení
    DRUHY_UZLU = {('highway', 'bus_stop'): 'zastavka', ('highway', 'crossing'): 'prechod',
                  ('historic', 'wayside_cross'): 'kriz', ('historic', 'wayside_shrine'): 'kaplicka',
                  ('historic', 'memorial'): 'pomnik', ('amenity', 'post_box'): 'schranka',
                  ('amenity', 'recycling'): 'kontejnery', ('amenity', 'bench'): 'lavicka',
                  ('leisure', 'picnic_table'): 'lavicka', ('railway', 'level_crossing'): 'prejezd',
                  ('power', 'pole'): 'sloup', ('power', 'tower'): 'stozar'}
    objekty = []
    for la, lo, t in uzly.values():
        for (k, v), druh in DRUHY_UZLU.items():
            if t.get(k) == v and uvnitr(svet(la, lo)):
                objekty.append([druh, *(round(c * 10) for c in svet(la, lo))])
                break
    ploty, vedeni = [], []
    for refs, t in cesty.values():
        if t.get('barrier') in ('fence', 'hedge', 'wall'):
            for u in oriznout(body(uzly, refs)):
                ploty.append([{'fence': 'plot', 'hedge': 'zivy', 'wall': 'zed'}[t['barrier']], u])
        if t.get('power') in ('line', 'minor_line'):
            for u in oriznout(body(uzly, refs)):
                vedeni.append(['vn' if t['power'] == 'line' else 'nn', u])

    dm = lambda pts: [v for p in pts for v in (round(p[0] * 10), round(p[1] * 10))]
    data = {
        'zdroj': '© přispěvatelé OpenStreetMap (ODbL); DMR 5G, DMP 1G a ortofoto © ČÚZK (CC BY 4.0)',
        'stazeno': __import__('datetime').date.today().isoformat(),
        'puvod': [LAT0, LON0], 'sirka': round(SIRKA, 1), 'hloubka': round(HLOUBKA, 1),
        'krok': KROK, 'nx': vysky.shape[1], 'nz': vysky.shape[0], 'vyskaMin': vmin, 'px': PX,
        'maska': [maska.shape[1], maska.shape[0]],
        'start': [obec[1], obec[2]] if obec else [0, 0],
        # [druh, výška stěn dm (odhad z OSM), střecha, obrys dm, okap abs. dm | 0, hřeben dm | 0, osa hřebene 0/1, barva střechy | -1]
        'budovy': [[b['druh'], round(b['vyska'] * 10), b['strecha'], dm(b['body']), round(b.get('okap', 0) * 10),
                    round(b.get('hreben', 0) * 10), b.get('osa', 0), b.get('barva', -1)] for b in budovy],
        'koryto': [dmr.W, dmr.H],
        'cesty': [[h, round(s * 10), z, dm(p)] for h, (s, z), p in seznam_cest],
        # [šířka dm, body po 3 m dm, hladina abs. dm, šířka vody dm]
        'potoky': [[round(s * 10), dm(p), [round(v * 10) for v in hl], [round(v * 10) for v in sr]] for s, p, hl, sr in hladiny],
        'zeleznice': [dm(p) for p in zeleznice],
        'stromy': [v for x, z, j in stromy for v in (round(x * 10), round(z * 10), j)],
        'mista': mista,
        'objekty': objekty,
        'ploty': [[d, dm(p)] for d, p in ploty],
        'vedeni': [[d, dm(p)] for d, p in vedeni],
    }
    with open(os.path.join(CIL, 'data.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f"budov {len(budovy)}, cest {len(seznam_cest)}, potoků {len(potoky)}, kolejí {len(zeleznice)}, "
          f"stromů {len(stromy)}, míst {len(mista)}, objektů {len(objekty)}, plotů {len(ploty)}, vedení {len(vedeni)}, start {data['start']}")
    for f in ('data.json', 'vyska.bin', 'podklad.webp', 'stromy.png', 'stromy.bin', 'koryto.png'):
        print(f, os.path.getsize(os.path.join(CIL, f)) // 1024, 'kB')


if __name__ == '__main__':
    main()
