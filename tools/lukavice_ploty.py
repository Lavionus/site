#!/usr/bin/env python3
"""Ploty kolem zahrad a dvorů pro obsah/lukavice.html – odvozené z katastrálních parcel.

Parcely: INSPIRE WFS ČÚZK (CP:CadastralParcel, otevřená data), stahované po
dlaždicích do mezipaměti (při přeplnění dlaždice se dělí na čtvrtiny).
Parcely neznají druh pozemku – „pozemek u domu" se odvodí z budov a cest
v obsah/lukavice/data.json (výstup tools/lukavice_data.py).

Výstup obsah/lukavice/ploty.json:
  {"ploty":  [[typ, [x,z,x,z,…]], …],            souřadnice v dm (celá čísla)
   "branky": [[typ, x, z, smer_rad, sirka_dm], …]}  smer = atan2(dx, dz) linie plotu
  typy plotů: pletivo, planky, kovovy, panely, zivy; brány: vrata, branka

Pravidla (heuristika):
  * pozemek u domu = parcela < 5000 m² obsahující dům nebo do 3 m od něj;
    každá taková parcela patří nejbližšímu domu → usedlost (skupina parcel);
    vnitřní hrany usedlosti plot nemají, společné hrany sousedů jen jednou;
  * vynechá se plot přes silnici (blíž než šířka/2 + 0,5 m od osy), podél zdí
    budov (do 0,8 m) a kusy kratší než 1,5 m;
  * uliční strana (do 6 m od okraje ulice, za ní není jiná usedlost) → typ
    usedlosti (kovový / laťkový / živý plot…), s vraty (+ brankou) u domu;
  * mezi sousedy pletivo (občas laťky), k polím pletivo (výjimečně panely).

Spuštění:  python3 tools/lukavice_ploty.py [--zdroj ADRESAR_MEZIPAMETI] [--nahled PNG]
"""
import argparse, json, math, os, sys, time, urllib.request, zlib
import xml.etree.ElementTree as ET
import numpy as np
import shapely
import shapely.ops
from shapely.geometry import Polygon, LineString, Point
from shapely.strtree import STRtree
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lukavice_data import JIH, SEVER, ZAPAD, VYCHOD, svet, UA, CIL  # noqa: E402

WFS = ('https://services.cuzk.cz/wfs/inspire-cp-wfs.asp?service=WFS&version=2.0.0'
       '&request=GetFeature&typeNames=CP:CadastralParcel'
       '&srsName=urn:ogc:def:crs:EPSG::4326'
       '&bbox={0:.5f},{1:.5f},{2:.5f},{3:.5f},urn:ogc:def:crs:EPSG::4326&count=5000')
NS = {'cp': 'http://inspire.ec.europa.eu/schemas/cp/4.0',
      'gml': 'http://www.opengis.net/gml/3.2',
      'wfs': 'http://www.opengis.net/wfs/2.0'}
DLAZDICE_LAT, DLAZDICE_LON = 0.005, 0.01
SEMINKO = 20261111

DOMY = {'house', 'residential', 'detached', 'semidetached_house', 'apartments',
        'farm', 'terrace', 'bungalow'}
ULICE = {'residential', 'living_street', 'tertiary', 'secondary', 'primary',
         'unclassified', 'service'}
MAX_PLOCHA = 5000      # m², větší parcela = pole / louka
DOSAH_DOMU = 3.0       # m
U_ZDI = 1.5            # m (plot těsně podél zdi nedává smysl)
ULICNI = 6.0           # m od okraje ulice
ULICNI_PARCELA = 15.0  # m – dál, pokud je za hranou silniční parcela
MIN_KUS = 1.5          # m
KROK = 1.0             # m, dělení hran na kousky pro klasifikaci


# ---------- stahování parcel ----------
def stahni_dlazdici(zdroj, b, hloubka=0):
    jm = os.path.join(zdroj, 'cp_%.5f_%.5f_%.5f_%.5f.xml' % b)
    if not (os.path.exists(jm) and os.path.getsize(jm) > 500):
        url = WFS.format(*b)
        print('stahuji', url)
        for pokus in range(4):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=180) as r:
                    data = r.read()
                break
            except Exception as e:  # noqa: BLE001
                print('  chyba', e, '– znovu za', 5 * (pokus + 1), 's')
                time.sleep(5 * (pokus + 1))
        else:
            raise SystemExit('stahování selhalo: ' + url)
        time.sleep(1.5)  # šetrně ke službě
        with open(jm, 'wb') as f:
            f.write(data)
    with open(jm, 'rb') as f:
        data = f.read()
    if b'truncatedResponse' in data[:5000] or b'ExceptionReport' in data[:5000]:
        if hloubka > 5:
            raise SystemExit('dlaždice nejde rozdělit: %s' % jm)
        la1, lo1, la2, lo2 = b
        lm, om = (la1 + la2) / 2, (lo1 + lo2) / 2
        vysl = []
        for c in ((la1, lo1, lm, om), (la1, om, lm, lo2), (lm, lo1, la2, om), (lm, om, la2, lo2)):
            vysl += stahni_dlazdici(zdroj, c, hloubka + 1)
        return vysl
    return [jm]


def nacti_parcely(zdroj):
    os.makedirs(zdroj, exist_ok=True)
    soubory = []
    la = JIH
    while la < SEVER - 1e-9:
        lo = ZAPAD
        while lo < VYCHOD - 1e-9:
            b = (la, lo, min(la + DLAZDICE_LAT, SEVER), min(lo + DLAZDICE_LON, VYCHOD))
            soubory += stahni_dlazdici(zdroj, b)
            lo += DLAZDICE_LON
        la += DLAZDICE_LAT
    parcely = {}
    for jm in soubory:
        koren = ET.parse(jm).getroot()
        for p in koren.iter('{%s}CadastralParcel' % NS['cp']):
            pid = p.get('{%s}id' % NS['gml'])
            if pid in parcely:
                continue
            pl = p.find('cp:areaValue', NS)
            lab = p.find('cp:label', NS)
            ext = p.find('.//gml:exterior//gml:posList', NS)
            if ext is None:
                continue
            c = [float(v) for v in ext.text.split()]
            pts = [svet(c[i], c[i + 1]) for i in range(0, len(c) - 1, 2)]
            diry = []
            for inn in p.findall('.//gml:interior//gml:posList', NS):
                ci = [float(v) for v in inn.text.split()]
                diry.append([svet(ci[i], ci[i + 1]) for i in range(0, len(ci) - 1, 2)])
            if len(pts) < 4:
                continue
            g = Polygon(pts, diry)
            if not g.is_valid:
                g = g.buffer(0)
            parcely[pid] = {'id': pid, 'label': lab.text if lab is not None else '',
                            'plocha': float(pl.text) if pl is not None else g.area, 'g': g}
    return list(parcely.values())


# ---------- pomocné ----------
def h01(*k):
    """Deterministické „náhodné" číslo 0–1 z klíčů."""
    return (zlib.crc32(('%d|' % SEMINKO + '|'.join(map(str, k))).encode()) & 0xffffffff) / 2 ** 32


def body_dm(seznam):
    return [(seznam[i] / 10, seznam[i + 1] / 10) for i in range(0, len(seznam) - 1, 2)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zdroj', default='/tmp/claude-1000/-mnt-sata-HOME-OSS-Workspace/'
                    '0c7cf1b9-b236-40e5-a554-788a4aea3a12/scratchpad/parcely')
    ap.add_argument('--nahled', default=None, help='PNG kontrolní obrázek výřezu centra')
    ap.add_argument('--stred', default=None, help='střed náhledu x,z v m')
    a = ap.parse_args()

    data = json.load(open(os.path.join(CIL, 'data.json')))
    parcely = nacti_parcely(a.zdroj)
    print('parcel:', len(parcely))

    # budovy a domy
    budovy, domy = [], []
    for druh, _v, _s, pts, *_ in data['budovy']:
        b = body_dm(pts)
        if len(b) < 3:
            continue
        g = Polygon(b)
        if not g.is_valid:
            g = g.buffer(0)
        budovy.append(g)
        if druh in DOMY or (druh == 'yes' and 50 <= g.area <= 350):
            domy.append(g)
    print('budov:', len(budovy), 'domů:', len(domy))
    strom_bud = STRtree(budovy)
    strom_domu = STRtree(domy)

    # cesty: osy jako linie + poloviční šířka
    osy, pul, ulice = [], [], []
    for druh, sirka, _zp, pts in data['cesty']:
        b = body_dm(pts)
        if len(b) < 2:
            continue
        osy.append(LineString(b))
        pul.append(sirka / 20)
        ulice.append(druh in ULICE)
    pul = np.array(pul)
    ulice = np.array(ulice)
    strom_cest = STRtree(osy)

    # ---------- pozemky u domu → usedlosti ----------
    geom = [p['g'] for p in parcely]
    strom_par = STRtree(geom)
    # silniční parcela = úzký pruh, kterým vede osa cesty (plocha / délka osy < 14 m)
    silnicni = np.zeros(len(geom), bool)
    delka = np.zeros(len(geom))
    pq = strom_cest.query(np.array(geom, dtype=object), predicate='intersects')
    for i, j in zip(*pq):
        delka[i] += geom[i].intersection(osy[j]).length
    for i in range(len(geom)):
        silnicni[i] = delka[i] > 8 and parcely[i]['plocha'] / delka[i] < 14
    print('silničních parcel:', int(silnicni.sum()))
    usedlost = {}  # index parcely → index domu
    for i, p in enumerate(parcely):
        if p['plocha'] >= MAX_PLOCHA or p['g'].is_empty or silnicni[i]:
            continue
        kand = strom_domu.query(p['g'], predicate='dwithin', distance=DOSAH_DOMU)
        if len(kand) == 0:
            continue
        g = p['g']
        nejlepsi, skore = None, None
        for k in kand:
            d = domy[k]
            prekryv = g.intersection(d).area / max(d.area, 1)
            s = (-prekryv, g.distance(d))
            if skore is None or s < skore:
                nejlepsi, skore = k, s
        # parcela bez domu (jen do 3 m od něj): menší a ne daleko táhlá (pruh pole)
        if -skore[0] < 0.1 and (p['plocha'] > 2500 or
                                 g.centroid.distance(domy[nejlepsi].centroid) > 45):
            continue
        usedlost[i] = int(nejlepsi)
    print('pozemků u domu:', len(usedlost))

    skupiny = {}
    for i, d in usedlost.items():
        skupiny.setdefault(d, []).append(i)
    obrysy = []
    for d, idx in skupiny.items():
        u = unary_union([geom[i] for i in idx])
        for poly in getattr(u, 'geoms', [u]):
            if poly.geom_type != 'Polygon':
                continue
            obrysy.append(poly.exterior)
    print('usedlostí:', len(skupiny))
    hrany = shapely.union_all(obrysy, grid_size=0.01)
    hrany = shapely.line_merge(hrany)
    linie = [l for l in getattr(hrany, 'geoms', [hrany]) if l.geom_type == 'LineString']

    # ---------- kousky hran a jejich klasifikace ----------
    kusy = []   # (linie_idx, A, B)
    for li, l in enumerate(linie):
        c = list(l.coords)
        for j in range(len(c) - 1):
            ax, az = c[j]
            bx, bz = c[j + 1]
            L = math.hypot(bx - ax, bz - az)
            n = max(1, int(math.ceil(L / KROK)))
            for k in range(n):
                t0, t1 = k / n, (k + 1) / n
                kusy.append((li, (ax + (bx - ax) * t0, az + (bz - az) * t0),
                             (ax + (bx - ax) * t1, az + (bz - az) * t1)))
    A = np.array([k[1] for k in kusy])
    B = np.array([k[2] for k in kusy])
    M = (A + B) / 2
    D = B - A
    Ld = np.hypot(D[:, 0], D[:, 1]) + 1e-9
    N = np.stack([-D[:, 1] / Ld, D[:, 0] / Ld], 1)
    stredy = shapely.points(M)

    # vzdálenost k budově
    ib, db = strom_bud.query_nearest(stredy, return_distance=True, all_matches=False)
    d_bud = np.full(len(kusy), 1e9)
    d_bud[ib[0]] = db
    # cesty: přes silnici? blízko ulice?
    pres_cestu = np.zeros(len(kusy), bool)
    u_ulice = np.zeros(len(kusy), bool)
    u_ulice_daleko = np.zeros(len(kusy), bool)
    pary = strom_cest.query(stredy, predicate='dwithin', distance=float(pul.max() + ULICNI))
    if pary.size:
        dd = shapely.distance(stredy[pary[0]], np.array(osy, dtype=object)[pary[1]])
        hr = pul[pary[1]]
        m1 = dd < hr + 0.5
        pres_cestu[pary[0][m1]] = True
        m2 = (dd < hr + ULICNI) & ulice[pary[1]]
        u_ulice[pary[0][m2]] = True
        m3 = (dd < hr + ULICNI_PARCELA) & ulice[pary[1]]
        u_ulice_daleko[pary[0][m3]] = True
    # strany: parcela vlevo/vpravo
    sk_par = np.full(len(geom), -1)
    for i, d in usedlost.items():
        sk_par[i] = d
    plochy = np.array([p['plocha'] for p in parcely])

    def strana(P):
        pt = shapely.points(P)
        q = strom_par.query(pt, predicate='within')
        sk = np.full(len(P), -2)       # -2 = mimo parcely
        pl = np.full(len(P), 0.0)
        si = np.zeros(len(P), bool)
        sk[q[0]] = sk_par[q[1]]
        pl[q[0]] = plochy[q[1]]
        si[q[0]] = silnicni[q[1]]
        return sk, pl, si
    skL, plL, siL = strana(M + N * 1.0)
    skP, plP, siP = strana(M - N * 1.0)

    typ = np.empty(len(kusy), object)
    vlastnik = np.full(len(kusy), -1)
    ULICNI_TYPY = [('kovovy', 0.38), ('planky', 0.30), ('zivy', 0.20), ('pletivo', 0.12)]

    def ulicni_typ(d):
        r = h01('ulice', d)
        for t, w in ULICNI_TYPY:
            if r < w:
                return t
            r -= w
        return 'pletivo'

    for k in range(len(kusy)):
        if pres_cestu[k] or d_bud[k] < U_ZDI:
            typ[k] = None
            continue
        a_, b_ = skL[k], skP[k]
        if a_ >= 0 and b_ >= 0:
            if a_ == b_:
                typ[k] = None
                continue
            par = (min(a_, b_), max(a_, b_))
            typ[k] = 'planky' if h01('bok', *par) < 0.15 else 'pletivo'
            vlastnik[k] = par[0]
            continue
        own = a_ if a_ >= 0 else b_
        jine_pl = plP[k] if a_ >= 0 else plL[k]
        jine_si = siP[k] if a_ >= 0 else siL[k]
        vlastnik[k] = own
        if own < 0:
            typ[k] = None
        elif u_ulice[k] or (jine_si and u_ulice_daleko[k]):
            typ[k] = 'U:' + ulicni_typ(own)
        elif jine_pl >= MAX_PLOCHA:
            typ[k] = 'panely' if h01('pole', own) < 0.08 else 'pletivo'
        else:
            typ[k] = 'planky' if h01('zad', own) < 0.1 else 'pletivo'

    # ---------- souvislé běhy stejného typu ----------
    behy = []  # [typ, vlastnik, [body]]
    for k in range(len(kusy)):
        t = typ[k]
        if t is None:
            continue
        if behy and behy[-1][3] == kusy[k][0] and behy[-1][0] == t and behy[-1][1] == vlastnik[k] \
                and behy[-1][4] == k - 1:
            behy[-1][2].append(kusy[k][2])
            behy[-1][4] = k
        else:
            behy.append([t, vlastnik[k], [kusy[k][1], kusy[k][2]], kusy[k][0], k])
    behy = [[t, v, b] for t, v, b, _li, _k in behy]

    # ---------- brány: na nejdelším uličním běhu usedlosti, nejblíž domu ----------
    branky = []
    vysledek = []
    podle_vl = {}
    for i, (t, v, b) in enumerate(behy):
        if t.startswith('U:'):
            podle_vl.setdefault(v, []).append(i)
    # řadový dům = jiný dům do 0,5 m
    radovy = [len(strom_domu.query(d, predicate='dwithin', distance=0.5)) > 1 for d in domy]
    rozrez = {}  # index běhu → seznam (s0, s1) mezer v metrech po délce
    for v, idx in podle_vl.items():
        dum = domy[v].centroid
        nej = None
        for i in idx:
            l = LineString(behy[i][2])
            if l.length < 5:
                continue
            s = l.project(dum)
            s = min(max(s, 2.2), l.length - 2.2)
            vzd = l.interpolate(s).distance(dum)
            klic = vzd - 0.3 * min(l.length, 30)
            if nej is None or klic < nej[0]:
                nej = (klic, i, s, l)
        if nej is None:
            continue
        _, i, s, l = nej
        if radovy[v]:   # řadový dům – jen branka
            mezery = [(s - 0.5, s + 0.5, 'branka', 10)]
        else:
            mezery = [(s - 1.75, s + 1.75, 'vrata', 35)]
        if not radovy[v] and l.length > 9 and h01('branka', v) < 0.7:
            s2 = s + 3.0 if s + 3.0 + 0.6 < l.length - 0.3 else s - 3.0
            if 0.8 < s2 < l.length - 0.8:
                mezery.append((s2 - 0.5, s2 + 0.5, 'branka', 10))
        rozrez[i] = mezery
        for s0, s1, bt, sirka in mezery:
            p0, p1 = l.interpolate(s0), l.interpolate(s1)
            pm = l.interpolate((s0 + s1) / 2)
            branky.append([bt, round(pm.x * 10), round(pm.y * 10),
                           round(math.atan2(p1.x - p0.x, p1.y - p0.y), 3), sirka])

    for i, (t, v, b) in enumerate(behy):
        l = LineString(b)
        casti = [l]
        if i in rozrez:
            casti, s_akt = [], 0.0
            for s0, s1, _bt, _s in sorted(rozrez[i]):
                if s0 > s_akt:
                    casti.append(shapely.ops.substring(l, s_akt, s0))
                s_akt = s1
            if s_akt < l.length:
                casti.append(shapely.ops.substring(l, s_akt, l.length))
        for c in casti:
            if c.is_empty or c.length < MIN_KUS:
                continue
            c = c.simplify(0.15)
            vysledek.append([t[2:] if t.startswith('U:') else t,
                             [round(q * 10) for xy in c.coords for q in xy]])

    # spojit navazující kusy stejného typu (konec = začátek)
    vysledek = spoj(vysledek)

    vystup = {'ploty': vysledek, 'branky': branky}
    cil = os.path.join(CIL, 'ploty.json')
    with open(cil, 'w') as f:
        json.dump(vystup, f, separators=(',', ':'))
    print('zapsáno', cil, os.path.getsize(cil) // 1024, 'kB')
    km = {}
    for t, b in vysledek:
        L = sum(math.hypot(b[j + 2] - b[j], b[j + 3] - b[j + 1]) for j in range(0, len(b) - 2, 2)) / 10000
        km[t] = km.get(t, 0) + L
    print('plotů:', len(vysledek), 'km:', {t: round(v, 2) for t, v in sorted(km.items())},
          'celkem %.1f km' % sum(km.values()))
    print('bran:', sum(1 for b in branky if b[0] == 'vrata'), 'branek:', sum(1 for b in branky if b[0] == 'branka'))
    if a.nahled:
        nahled(a.nahled, data, vysledek, branky, parcely, usedlost,
               tuple(map(float, a.stred.split(','))) if a.stred else None)


def spoj(ploty):
    from collections import defaultdict
    zac = defaultdict(list)
    for i, (t, b) in enumerate(ploty):
        zac[(t, b[0], b[1])].append(i)
    pouzito = [False] * len(ploty)
    out = []
    for i, (t, b) in enumerate(ploty):
        if pouzito[i]:
            continue
        pouzito[i] = True
        b = list(b)
        while True:
            dal = [j for j in zac.get((t, b[-2], b[-1]), []) if not pouzito[j]]
            if not dal:
                break
            j = dal[0]
            pouzito[j] = True
            b += ploty[j][1][2:]
        out.append([t, b])
    return out


BARVY = {'pletivo': (40, 170, 60), 'planky': (160, 100, 40), 'kovovy': (40, 60, 220),
         'panely': (130, 130, 130), 'zivy': (0, 110, 0)}


def nahled(soubor, data, ploty, branky, parcely, usedlost, stred=None, pul=220, mer=3.0):
    from PIL import Image, ImageDraw
    if stred is None:
        # centrum = nejhustší místo domů
        xs = np.array([b[3][0] for b in data['budovy']]) / 10
        zs = np.array([b[3][1] for b in data['budovy']]) / 10
        H, ex, ez = np.histogram2d(xs, zs, bins=30)
        ix, iz = np.unravel_index(H.argmax(), H.shape)
        stred = ((ex[ix] + ex[ix + 1]) / 2, (ez[iz] + ez[iz + 1]) / 2)
    cx, cz = stred
    W = int(2 * pul * mer)
    img = Image.new('RGB', (W, W), (235, 240, 225))
    dr = ImageDraw.Draw(img)

    def px(x, z):
        return ((x - cx + pul) * mer, (z - cz + pul) * mer)
    for i, p in enumerate(parcely):
        g = p['g']
        if g.is_empty or g.geom_type != 'Polygon':
            continue
        if g.bounds[2] < cx - pul or g.bounds[0] > cx + pul or g.bounds[3] < cz - pul or g.bounds[1] > cz + pul:
            continue
        fill = (250, 245, 200) if i in usedlost else None
        dr.polygon([px(*q) for q in g.exterior.coords], fill=fill, outline=(200, 190, 170))
    for druh, sirka, _z, pts in data['cesty']:
        b = [px(*q) for q in body_dm(pts)]
        if len(b) > 1:
            dr.line(b, fill=(255, 255, 255) if druh in ULICE else (220, 200, 160),
                    width=max(1, int(sirka / 10 * mer)))
    for druh, _v, _s, pts, *_ in data['budovy']:
        b = [px(*q) for q in body_dm(pts)]
        if len(b) > 2:
            dr.polygon(b, fill=(120, 120, 120) if druh in DOMY else (170, 170, 170), outline=(60, 60, 60))
    for t, b in ploty:
        q = [px(b[j] / 10, b[j + 1] / 10) for j in range(0, len(b) - 1, 2)]
        dr.line(q, fill=BARVY[t], width=3)
    for t, x, z, s, w in branky:
        X, Z = px(x / 10, z / 10)
        r = 6 if t == 'vrata' else 3
        dr.ellipse((X - r, Z - r, X + r, Z + r), fill=(230, 0, 0) if t == 'vrata' else (255, 140, 0))
    img.save(soubor)
    print('náhled', soubor, 'střed', stred)


if __name__ == '__main__':
    main()
