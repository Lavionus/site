#!/usr/bin/env python3
"""Data pro Cestovatelskou mapu z Natural Earth (volné dílo, naturalearthdata.com).

Použití:  python3 -I tools/cestovni_mapa_data.py <složka s NE GeoJSON>
Čeká soubory (z github.com/nvkelso/natural-earth-vector, složka geojson/):
  ne_50m_admin_0_countries, ne_10m_admin_0_countries,
  ne_50m_rivers_lake_centerlines, ne_50m_lakes,
  ne_10m_rivers (= ne_10m_rivers_lake_centerlines), ne_10m_lakes,
  ne_50m_populated_places_simple, ne_10m_populated_places_simple   (vše .geojson)

Výstup do obsah/cestovni_mapa/:
  svet.js        window.CM_SVET – přehled světa v 1:50m (země, řeky, jezera, velká města)
  zeme/<A3>.json detail země v 1:10m (obrys, řeky a jezera oříznuté na zemi, města)

Kódování čar: pole celých čísel [x0, y0, dx1, dy1, …] v jednotkách Q stupně
(x = délka, y = šířka), delta od předchozího bodu.
"""
import json, os, sys
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union

ZDROJ = sys.argv[1]
CIL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'obsah', 'cestovni_mapa')
os.makedirs(os.path.join(CIL, 'zeme'), exist_ok=True)


def nacti(jmeno):
    with open(os.path.join(ZDROJ, jmeno + '.geojson'), encoding='utf-8') as f:
        return json.load(f)['features']


def koduj(souradnice, q):
    out, px, py = [], None, None
    for lon, lat in souradnice:
        x, y = round(lon / q), round(lat / q)
        if px is None:
            out += [x, y]
        elif x != px or y != py:
            out += [x - px, y - py]
        else:
            continue
        px, py = x, y
    return out


def prstence(geom, q, min_bodu=4):
    """Všechny prstence (vnější i díry) jako delta pole – kreslí se pravidlem evenodd."""
    res = []
    polys = [geom] if geom.geom_type == 'Polygon' else list(getattr(geom, 'geoms', []))
    for p in polys:
        if p.geom_type != 'Polygon' or p.is_empty:
            continue
        for ring in [p.exterior, *p.interiors]:
            k = koduj(ring.coords, q)
            if len(k) >= 2 * min_bodu:
                res.append(k)
    return res


def cary(geom, q):
    res = []
    if geom.is_empty:
        return res
    if geom.geom_type == 'LineString':
        geoms = [geom]
    elif geom.geom_type in ('MultiLineString', 'GeometryCollection'):
        geoms = [g for g in geom.geoms if g.geom_type == 'LineString']
    else:
        geoms = []
    for g in geoms:
        k = koduj(g.coords, q)
        if len(k) >= 4:
            res.append(k)
    return res


def kolo(x, n=3):
    return round(x, n)


def hlavni_bbox(g):
    """Obdélník hlavní části země: díly do 25° od největšího (bez zámořských území),
    délky posunuté přes antimeridián k němu."""
    polys = [g] if g.geom_type == 'Polygon' else list(g.geoms)
    hlavni = max(polys, key=lambda p: p.area)
    cx, cy = hlavni.centroid.x, hlavni.centroid.y
    bb = None
    for p in polys:
        c = p.centroid
        posun = 360 * round((cx - c.x) / 360)
        if abs(c.x + posun - cx) > 25 or abs(c.y - cy) > 25 or p.area < hlavni.area * 0.002:
            continue
        x0, y0, x1, y1 = p.bounds
        x0, x1 = x0 + posun, x1 + posun
        bb = [x0, y0, x1, y1] if bb is None else [min(bb[0], x0), min(bb[1], y0), max(bb[2], x1), max(bb[3], y1)]
    return [kolo(v, 2) for v in bb]


# ---------- země ----------
z50 = {f['properties']['ADM0_A3']: f for f in nacti('ne_50m_admin_0_countries')}
z10 = {f['properties']['ADM0_A3']: f for f in nacti('ne_10m_admin_0_countries')}

Q_SVET, Q_DETAIL = 0.01, 0.002
svet_zeme = []
geom10 = {}
for k, f in sorted(z10.items()):
    p = f['properties']
    g10 = shape(f['geometry']).buffer(0)
    geom10[k] = g10
    zdroj50 = z50.get(k)
    g50 = shape(zdroj50['geometry']).buffer(0) if zdroj50 else g10.simplify(0.02, preserve_topology=True)
    a2 = p.get('ISO_A2_EH') or p.get('ISO_A2') or ''
    if a2 in ('-99', '-1'):
        a2 = ''
    minx, miny, maxx, maxy = g10.bounds
    svet_zeme.append({
        'k': k, 'a2': a2, 'n': p.get('NAME') or p.get('ADMIN'),
        'l': [kolo(p.get('LABEL_X') or g10.representative_point().x, 2),
              kolo(p.get('LABEL_Y') or g10.representative_point().y, 2)],
        'bb': [kolo(minx, 2), kolo(miny, 2), kolo(maxx, 2), kolo(maxy, 2)],
        'hb': hlavni_bbox(g10),
        'kont': p.get('CONTINENT', ''),
        'r': prstence(g50, Q_SVET, 3),
    })

# ---------- řeky a jezera ----------
reky50 = [x for f in nacti('ne_50m_rivers_lake_centerlines') for x in cary(shape(f['geometry']), Q_SVET)]
jezera50 = [x for f in nacti('ne_50m_lakes') for x in prstence(shape(f['geometry']).buffer(0), Q_SVET)]
reky10 = [(shape(f['geometry']), f['properties'].get('scalerank', 10)) for f in nacti('ne_10m_rivers')]
jezera10 = [shape(f['geometry']).buffer(0) for f in nacti('ne_10m_lakes')]

# ---------- města ----------
def mesto(f):
    p = f['properties']
    return [p['name'], kolo(p['latitude'], 4), kolo(p['longitude'], 4),
            int(p.get('scalerank', 10)), 1 if p.get('adm0cap') else 0, p.get('adm0_a3', '')]

mesta50 = [mesto(f) for f in nacti('ne_50m_populated_places_simple')]
mesta10 = [mesto(f) for f in nacti('ne_10m_populated_places_simple')]

with open(os.path.join(CIL, 'svet.js'), 'w', encoding='utf-8') as f:
    f.write('/* Generováno tools/cestovni_mapa_data.py z Natural Earth 1:50m (volné dílo, naturalearthdata.com).\n'
            '   Čáry: [x0, y0, dx, dy, …] v jednotkách Q stupně. Města: [jméno, šířka, délka, scalerank, hlavní město, A3]. */\n')
    f.write('window.CM_SVET = ')
    json.dump({'q': Q_SVET, 'qDetail': Q_DETAIL, 'zeme': svet_zeme, 'reky': reky50, 'jezera': jezera50,
               'mesta': mesta50}, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')

# ---------- detail zemí ----------
for k, g in geom10.items():
    gs = g.simplify(Q_DETAIL * 0.75, preserve_topology=True)
    obal = g.buffer(0.01)
    rk = []
    for r, rank in reky10:
        if r.intersects(obal):
            for c in cary(r.intersection(g), Q_DETAIL):
                rk.append([int(rank)] + c)
    jz = []
    for j in jezera10:
        if j.intersects(g):
            jz += prstence(j.intersection(g).simplify(Q_DETAIL, preserve_topology=True), Q_DETAIL)
    ms = [m[:5] for m in mesta10 if m[5] == k]
    with open(os.path.join(CIL, 'zeme', k + '.json'), 'w', encoding='utf-8') as f:
        json.dump({'q': Q_DETAIL, 'r': prstence(gs, Q_DETAIL), 'reky': rk, 'jezera': jz, 'mesta': ms},
                  f, ensure_ascii=False, separators=(',', ':'))

print('zemí:', len(svet_zeme), 'řek 50m:', len(reky50), 'jezer 50m:', len(jezera50), 'měst 10m:', len(mesta10))
