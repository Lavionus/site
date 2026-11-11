"""Data ČÚZK pro Lukavice 3D (otevřená data, © ČÚZK, CC BY 4.0) – volá tools/lukavice_data.py.

- DMR 5G (reliéf, po 2 m) → hrubá mřížka terénu (10 m) + jemná vložka koryt potoků (koryto.png)
- DMP 1G (povrch vč. budov, po 1 m) – DMR → výška okapu, tvar střechy a směr hřebene každé budovy
- Ortofoto (po 0,5 m) → barva střechy

Rastry se stahují z ArcGIS služeb ags.cuzk.cz v síti zeměpisných souřadnic (imageSR=4326) přes obdélník světa.
Ten je ve světových souřadnicích lineární (x ~ délka, z ~ šířka), takže stačí převzorkovat bez převodu z Křováka.
"""
import math, os, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw

UA = 'lavionus-site-data/1.0'


def _stahni(url, f):
    if os.path.exists(f) and os.path.getsize(f) > 10000:
        return
    for pokus in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=300) as r:
                d = r.read()
            if len(d) < 10000:
                raise RuntimeError(d[:300])
            open(f, 'wb').write(d)
            return
        except Exception as e:
            print('  chyba', e)
            time.sleep(5 * (pokus + 1))
    raise SystemExit('nestaženo ' + url)


class Rastr:
    """Mozaika dlaždic jedné služby přes celý obdélník světa; vzorkování ve světových metrech."""

    def __init__(self, zdroj, sluzba, m_px, nx, ny, fmt, extra, svet):
        J, S, Z, V, SIRKA, HLOUBKA = svet
        # ArcGIS zachovává poměr stran → pixely musí být čtvercové ve stupních (jinak server rozsah roztáhne);
        # v metrech je pak pixel ve směru x menší (m_px · MX/MZ), ve směru z přesně m_px
        H = round(HLOUBKA / m_px)
        W = round(H * (V - Z) / (S - J))
        os.makedirs(os.path.join(zdroj, 'cuzk'), exist_ok=True)
        radky = []
        for j in range(ny):
            rada = []
            for i in range(nx):
                x0, x1 = W * i // nx, W * (i + 1) // nx
                y0, y1 = H * j // ny, H * (j + 1) // ny
                lo0, lo1 = Z + (V - Z) * x0 / W, Z + (V - Z) * x1 / W
                la1, la0 = S - (S - J) * y0 / H, S - (S - J) * y1 / H
                jmeno = sluzba.split('/')[-2]
                f = os.path.join(zdroj, 'cuzk', f'{jmeno}_{m_px}_{W}x{H}_{j}_{i}.{fmt}')
                url = (f'https://ags.cuzk.cz/{sluzba}/export{"Image" if "Image" in sluzba else ""}?bbox={lo0},{la0},{lo1},{la1}'
                       f'&bboxSR=4326&imageSR=4326&size={x1 - x0},{y1 - y0}&format={fmt}&f=image{extra}')
                _stahni(url, f)
                img = Image.open(f)
                rada.append(np.asarray(img if fmt == 'tiff' else img.convert('RGB'), np.float32 if fmt == 'tiff' else np.uint8))
            radky.append(np.concatenate(rada, axis=1))
        self.a = np.concatenate(radky, axis=0)
        self.H, self.W = self.a.shape[:2]
        self.sx, self.sz = SIRKA / self.W, HLOUBKA / self.H
        self.x0, self.z0 = -SIRKA / 2, -HLOUBKA / 2

    def index(self, x, z):
        return (np.asarray(x) - self.x0) / self.sx - 0.5, (np.asarray(z) - self.z0) / self.sz - 0.5

    def bilin(self, x, z):
        fi, fj = self.index(x, z)
        fi = np.clip(fi, 0, self.W - 1.001); fj = np.clip(fj, 0, self.H - 1.001)
        i, j = fi.astype(int), fj.astype(int)
        u, v = fi - i, fj - j
        a = self.a
        return (a[j, i] * (1 - u) * (1 - v) + a[j, i + 1] * u * (1 - v) + a[j + 1, i] * (1 - u) * v + a[j + 1, i + 1] * u * v)


def nacti(zdroj, svet):
    print('ČÚZK: DMR 5G, DMP 1G, ortofoto…')
    dmr = Rastr(zdroj, 'arcgis2/rest/services/dmr5g/ImageServer', 2, 2, 1, 'tiff', '&pixelType=F32&interpolation=RSP_BilinearInterpolation', svet)
    dmp = Rastr(zdroj, 'arcgis2/rest/services/dmp1g/ImageServer', 1, 3, 2, 'tiff', '&pixelType=F32&interpolation=RSP_BilinearInterpolation', svet)
    orto = Rastr(zdroj, 'arcgis1/rest/services/ORTOFOTO/MapServer', 0.5, 6, 3, 'jpg', '&transparent=false', svet)
    return dmr, dmp, orto


def hruba_mrizka(dmr, nx, nz, krok):
    """Terén po krok m: průměr DMR v okně krok × krok (proti aliasingu), pak vzorek v uzlech mřížky."""
    k = max(1, round(krok / dmr.sx))
    a = dmr.a
    c = np.pad(a, ((k // 2, k // 2), (k // 2, k // 2)), mode='edge').cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    box = (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)
    hl = Rastr.__new__(Rastr)
    hl.__dict__.update(dmr.__dict__); hl.a = box[:dmr.H, :dmr.W]
    zs = dmr.z0 + np.arange(nz) * krok
    xs = dmr.x0 + np.arange(nx) * krok
    X, Z = np.meshgrid(xs, zs)
    return hl.bilin(X, Z).astype(np.float32)


def vyska_hruba(Hm, krok, x0, z0, x, z):
    """Stejná triangulace jako jadro.js vyska(): úhlopříčka (i+1,j)–(i,j+1)."""
    nz, nx = Hm.shape
    fx = np.clip((np.asarray(x) - x0) / krok, 0, nx - 1.001)
    fz = np.clip((np.asarray(z) - z0) / krok, 0, nz - 1.001)
    i, j = fx.astype(int), fz.astype(int)
    u, v = fx - i, fz - j
    a, b, c, d = Hm[j, i], Hm[j, i + 1], Hm[j + 1, i], Hm[j + 1, i + 1]
    return np.where(u + v <= 1, a + (b - a) * u + (c - a) * v, d + (c - d) * (1 - u) + (b - d) * (1 - v))


def koryta(dmr, Hm, krok, potoky, cesty, zeleznice, cil):
    """koryto.png v mřížce DMR: R = (jemný DMR − hrubý terén)/4 cm + 128, G = váha 0–255 (náběh od okraje),
    B = 255 v pásu kolem potoka (tam se hrubý terén nekreslí a kreslí se jemná vložka).
    Pod silnicemi a kolejemi váha 0 (propustek). Vrací hladiny a šířky vody po 3 m pro každý potok."""
    W, H = dmr.W, dmr.H
    px = lambda p: ((p[0] - dmr.x0) / dmr.sx, (p[1] - dmr.z0) / dmr.sz)
    pas = Image.new('L', (W, H), 0)
    vaha = Image.new('L', (W, H), 0)
    dp, dv = ImageDraw.Draw(pas), ImageDraw.Draw(vaha)
    for w, s, pts in potoky:
        dp.line([px(p) for p in pts], fill=255, width=int(13 / dmr.sx), joint='curve')
    for sirka_m, hodnota in ((10, 90), (8, 180), (6, 255)):
        for w, s, pts in potoky:
            dv.line([px(p) for p in pts], fill=hodnota, width=int(sirka_m / dmr.sx), joint='curve')
    bez = Image.new('L', (W, H), 0)
    db = ImageDraw.Draw(bez)
    for druh, (sirka, z), pts in cesty:
        db.line([px(p) for p in pts], fill=255, width=max(2, int((sirka + 5) / dmr.sx)), joint='curve')
    for pts in zeleznice:
        db.line([px(p) for p in pts], fill=255, width=int(9 / dmr.sx), joint='curve')
    pasm = np.asarray(pas) > 0
    g = np.asarray(vaha, np.float32) / 255
    g[np.asarray(bez) > 0] = 0
    g = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(__import__('PIL.ImageFilter', fromlist=['x']).BoxBlur(1)), np.float32) / 255
    g[~pasm] = 0
    jj, ii = np.nonzero(pasm)
    xs, zs = dmr.x0 + (ii + 0.5) * dmr.sx, dmr.z0 + (jj + 0.5) * dmr.sz
    off = np.zeros((H, W), np.float32)
    off[jj, ii] = dmr.a[jj, ii] - vyska_hruba(Hm, krok, dmr.x0, dmr.z0, xs, zs)
    R = np.clip(np.round(off / 0.04) + 128, 0, 255).astype(np.uint8)
    R[~pasm] = 128
    obr = np.stack([R, (g * 255).round().astype(np.uint8), np.where(pasm, 255, 0).astype(np.uint8)], axis=2)
    Image.fromarray(obr).save(os.path.join(cil, 'koryto.png'), optimize=True)

    # hladina: dno příčného řezu ±4 m (jemný povrch = hrubý + váha × odchylka, jako v jádře) + 15 cm
    def jemna(x, z):
        fi, fj = dmr.index(x, z)
        i = np.clip(np.round(fi).astype(int), 0, W - 1); j = np.clip(np.round(fj).astype(int), 0, H - 1)
        return vyska_hruba(Hm, krok, dmr.x0, dmr.z0, x, z) + g[j, i] * off[j, i]
    vystup = []
    for w, s, pts in potoky:
        body = []
        for p, q in zip(pts, pts[1:]):
            n = max(1, int(math.hypot(q[0] - p[0], q[1] - p[1]) / 3))
            body += [(p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n) for k in range(n)]
        body.append(pts[-1])
        B = np.array(body)
        d = np.gradient(B, axis=0); d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-6)
        o = np.linspace(-4, 4, 17)
        X = B[:, 0:1] + d[:, 1:2] * o; Z = B[:, 1:2] - d[:, 0:1] * o
        prurez = jemna(X, Z)
        dno = prurez.min(axis=1)
        dno = np.array([np.median(dno[max(0, k - 2):k + 3]) for k in range(len(dno))])
        # hladina do třetiny hloubky koryta (nižší břeh ±4 m); mělčí než 30 cm = suchý příkop (hladina 0)
        breh = np.minimum(prurez[:, 0], prurez[:, -1])
        hloubka = breh - dno
        hladina = np.where(hloubka >= 0.2, dno + np.clip(hloubka * 0.4, 0.08, 0.4), 0)
        # krátké suché mezery (do 4 bodů = 12 m) mezi vodou dopočítat, ať potok neteče po kouscích
        mokro = np.nonzero(hladina > 0)[0]
        for a_, b_ in zip(mokro, mokro[1:]):
            if 1 < b_ - a_ <= 5:
                hladina[a_ + 1:b_] = np.linspace(hladina[a_], hladina[b_], b_ - a_ + 1)[1:-1]
        # šířka vody: kde je terén pod hladinou, nejvýš šířka potoka
        pod = prurez < hladina[:, None]
        sirka = np.clip(pod.sum(axis=1) * 0.5, 0.9, s)
        # střed vody = těžiště zatopené části řezu (OSM čára nevede přesně dnem)
        posun = np.where(pod.any(axis=1), (pod * o).sum(axis=1) / np.maximum(pod.sum(axis=1), 1), 0)
        stred = B + np.stack([d[:, 1] * posun, -d[:, 0] * posun], axis=1)
        vystup.append((s, [tuple(p) for p in stred], hladina, sirka))
    print(f'koryta: pás {pasm.sum() * dmr.sx * dmr.sz / 1e4:.1f} ha, max zahloubení {-off[g > 0.5].min() if (g > 0.5).any() else 0:.1f} m')
    return vystup


def obdelnik(pts):
    """Nejmenší natočený obdélník: střed, e1 (delší osa), e2, A, B (poloviny stran)."""
    P = np.array(pts)
    nej = None
    for k in range(len(P)):
        e = P[(k + 1) % len(P)] - P[k]
        l = np.hypot(*e)
        if l < 0.5: continue
        u = e / l; v = np.array([-u[1], u[0]])
        a, b = P @ u, P @ v
        s = (a.max() - a.min()) * (b.max() - b.min())
        if nej is None or s < nej[0]:
            nej = (s, u, v, a.min(), a.max(), b.min(), b.max())
    s, u, v, a0, a1, b0, b1 = nej
    c = u * (a0 + a1) / 2 + v * (b0 + b1) / 2
    A, B = (a1 - a0) / 2, (b1 - b0) / 2
    if B > A: u, v, A, B = v, -u, B, A
    return c, u, v, A, B


def rozbor_budov(budovy, dmr, dmp, orto):
    """Doplní budovám okap (abs. m n. m.), hřeben (m nad okapem), střechu, osu hřebene a barvu střechy."""
    from PIL import ImageFilter
    pocty = {}
    for b in budovy:
        pts = b['body']
        P = np.array(pts)
        mn, mx = P.min(0) - 1, P.max(0) + 1
        # body DMP (1 m) uvnitř půdorysu zmenšeného o ~1 m
        i0, j0 = np.floor(dmp.index(mn[0], mn[1])).astype(int)
        i1, j1 = np.ceil(dmp.index(mx[0], mx[1])).astype(int)
        w, h = i1 - i0 + 1, j1 - j0 + 1
        if w < 3 or h < 3: continue
        m = Image.new('L', (w, h), 0)
        ImageDraw.Draw(m).polygon([((p[0] - dmp.x0) / dmp.sx - 0.5 - i0, (p[1] - dmp.z0) / dmp.sz - 0.5 - j0) for p in pts], fill=255)
        m = np.asarray(m.filter(ImageFilter.MinFilter(3))) > 0
        jj, ii = np.nonzero(m)
        if len(jj) >= 8 and 0 <= j0 and j1 < dmp.H and 0 <= i0 and i1 < dmp.W:
            x, z = dmp.x0 + (ii + i0 + 0.5) * dmp.sx, dmp.z0 + (jj + j0 + 0.5) * dmp.sz
            povrch = dmp.a[jj + j0, ii + i0]
            zem = dmr.bilin(x, z)
            hn = np.clip(povrch - zem, 0, 30)
            ok = hn > 1.0
            if ok.sum() >= 6:
                c, e1, e2, A, B = obdelnik(pts)
                aa = (x - c[0]) * e1[0] + (z - c[1]) * e1[1]
                bb = (x - c[0]) * e2[0] + (z - c[1]) * e2[1]
                y = hn[ok]; aa, bb = aa[ok], bb[ok]
                modely = {'plocha': (np.zeros_like(y), 0, 0), 'sedlova': (-np.abs(bb), B, 0), 'sedlova_napric': (-np.abs(aa), A, 1),
                          'valbova': (-np.maximum(np.abs(bb), np.abs(aa) - (A - B)), B, 0), 'pultova': (bb, B, 0)}
                vysl = {}
                for jmeno, (f, polovina, osa) in modely.items():
                    if jmeno == 'plocha':
                        c0 = np.median(y); r = np.sqrt(np.mean((y - c0) ** 2)); vysl[jmeno] = (r, c0, 0, 0, 0)
                        continue
                    M = np.stack([np.ones_like(f), f], axis=1)
                    (c0, k), *_ = np.linalg.lstsq(M, y, rcond=None)
                    r = np.sqrt(np.mean((y - M @ np.array([c0, k])) ** 2))
                    if jmeno == 'pultova':
                        k = abs(k); okap, hr = c0 - k * B, 2 * k * B
                    elif k <= 0:
                        continue
                    else:
                        okap, hr = c0 - k * polovina, k * polovina
                    vysl[jmeno] = (r, okap, hr, osa, k)
                # jednodušší model má přednost, pokud složitější nesníží chybu znatelně
                nej = min(vysl, key=lambda n: vysl[n][0] * (1.0 if n == 'plocha' else 1.12 if n in ('sedlova', 'sedlova_napric') else 1.25))
                r, okap, hr, osa, k = vysl[nej]
                if nej != 'plocha' and hr < 0.7: nej, okap, hr = 'plocha', vysl['plocha'][1], 0
                zem0 = float(np.median(zem))
                if 1.8 <= okap <= 25 and hr <= 10:
                    b['okap'] = zem0 + okap
                    b['hreben'] = hr
                    b['strecha'] = {'sedlova_napric': 'sedlova'}.get(nej, nej)
                    b['osa'] = osa
                    pocty[nej] = pocty.get(nej, 0) + 1
        # barva střechy z ortofota: medián uvnitř půdorysu zmenšeného o ~1 m
        i0, j0 = np.floor(orto.index(mn[0], mn[1])).astype(int)
        i1, j1 = np.ceil(orto.index(mx[0], mx[1])).astype(int)
        if 0 <= j0 and j1 < orto.H and 0 <= i0 and i1 < orto.W:
            w, h = i1 - i0 + 1, j1 - j0 + 1
            m = Image.new('L', (w, h), 0)
            ImageDraw.Draw(m).polygon([((p[0] - orto.x0) / orto.sx - 0.5 - i0, (p[1] - orto.z0) / orto.sz - 0.5 - j0) for p in pts], fill=255)
            m = np.asarray(m.filter(ImageFilter.MinFilter(5))) > 0
            if m.sum() >= 4:
                px = orto.a[j0:j1 + 1, i0:i1 + 1][m].astype(np.float32)
                jas = px.mean(1)
                px = px[(jas > np.percentile(jas, 25)) & (jas < np.percentile(jas, 95))] if len(px) > 20 else px  # bez stínů a odlesků
                r, g_, bl = np.median(px, axis=0)
                b['barva'] = (int(r) << 16) | (int(g_) << 8) | int(bl)
    print('střechy z DMP:', pocty, f'(z {len(budovy)} budov)')


def drobne_stavby(budovy, cesty, dmr, dmp, orto, vyloucit=()):
    """Najde v rozdílu DMP − DMR malé stavby, které v OSM chybí (kůlny, garáže, přístřešky u domů).
    Kandidát: 2–6,5 m nad terénem, plochý vrch, v ortofotu nezelený, do 60 m od domu, mimo budovy a silnice,
    souvislá plocha 6–120 m² zhruba obdélníková. Vrací seznam budov ve stejném tvaru jako lukavice_data.budova()."""
    from PIL import ImageFilter
    W, H = dmp.W, dmp.H
    px = lambda p: ((p[0] - dmp.x0) / dmp.sx - 0.5, (p[1] - dmp.z0) / dmp.sz - 0.5)
    okoli, uz = Image.new('L', (W, H), 0), Image.new('L', (W, H), 0)
    do, du = ImageDraw.Draw(okoli), ImageDraw.Draw(uz)
    for b in budovy:
        pts = [px(p) for p in b['body']]
        du.polygon(pts, fill=255)
        du.line(pts + pts[:1], fill=255, width=4)              # +1,5 m kolem stávajících budov
        if b['druh'] in ('house', 'residential', 'detached', 'apartments', 'farm', 'semidetached_house') or (b['druh'] == 'yes' and b['vyska'] > 3):
            do.line(pts + pts[:1], fill=255, width=int(120 / dmp.sz))
            do.polygon(pts, fill=255)
    for druh, (sirka, z), pts in cesty:
        du.line([px(p) for p in pts], fill=255, width=max(2, int((sirka + 2) / dmp.sz)), joint='curve')
    for kruh in vyloucit:                                       # sportoviště (antuka je červená jako tašky)
        if len(kruh) > 2: du.polygon([px(p) for p in kruh], fill=255)
    okoli, uz = np.asarray(okoli) > 0, np.asarray(uz) > 0
    # výška nad terénem po řádcích (DMR bilineárně ve středech pixelů DMP)
    hn, o = nad_terenem(dmr, dmp, orto)
    xs = dmp.x0 + (np.arange(W) + 0.5) * dmp.sx
    # zeleň z ortofota (nejbližší pixel ortofota ve středu pixelu DMP)
    zelen = (2 * o[..., 1] - o[..., 0] - o[..., 2]) > 10
    jas = o.mean(axis=2)
    hrana = np.zeros_like(jas)       # zrnitost ortofota (koruny stromů jsou zrnité, střechy hladké)
    hrana[:, :-1] += np.abs(np.diff(jas, axis=1)); hrana[:-1] += np.abs(np.diff(jas, axis=0))
    plocha_px = dmp.sx * dmp.sz
    nove = []

    def pridej(jj, ii, druh, vyska=None):
        """Obdélník z oblasti pixelů (hlavní osy z kovariance); False, když tvar není stavba."""
        x = dmp.x0 + (ii + 0.5) * dmp.sx; z = dmp.z0 + (jj + 0.5) * dmp.sz
        P = np.stack([x, z], 1)
        stred = P.mean(0)
        w, v = np.linalg.eigh(np.cov((P - stred).T))
        e1, e2 = v[:, 1], v[:, 0]
        a, b = (P - stred) @ e1, (P - stred) @ e2
        a0, a1 = np.percentile(a, [2, 98]); b0, b1 = np.percentile(b, [2, 98])
        A, B = (a1 - a0) / 2 + 0.35, (b1 - b0) / 2 + 0.35
        if B < 1.0 or A * B * 4 < 6 or len(jj) * plocha_px / (A * B * 4) < 0.55: return False
        c0 = stred + e1 * (a0 + a1) / 2 + e2 * (b0 + b1) / 2
        rohy = [tuple(c0 + e1 * sa * A + e2 * sb * B) for sa, sb in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
        zem = float(np.median(dmr.bilin(x, z)))
        barva = np.median(o[jj, ii], axis=0)
        if vyska is None:
            h20, h90 = np.percentile(hn[jj, ii], [20, 90])
        else:
            h20, h90 = vyska, vyska + min(B, 3) * 0.7
        nove.append({'druh': druh or ('shed' if A * B * 4 < 40 else 'yes'), 'vyska': float(h20),
                     'strecha': 'pultova' if vyska is None and h90 - h20 > 0.3 else 'sedlova' if vyska else 'plocha',
                     'body': rohy, 'okap': zem + h20, 'hreben': float(max(0, h90 - h20)), 'osa': 0,
                     'barva': (int(barva[0]) << 16) | (int(barva[1]) << 8) | int(barva[2])})
        return True

    # 1) stavby v DMP: stěny dolů k zemi (4 px vně), jednolitá střecha v ortofotu
    kand = (hn > 2.2) & (hn < 12) & ~zelen & okoli & ~uz
    jj, ii, koreny, mapa = _oblasti(kand)
    for k in np.unique(koreny):
        sel = koreny == k
        if not (6 <= sel.sum() * plocha_px <= 600): continue
        cj, ci = jj[sel], ii[sel]
        venku = []
        for dj, di in ((0, 4), (0, -4), (3, 0), (-3, 0)):
            vj, vi = np.clip(cj + dj, 0, H - 1), np.clip(ci + di, 0, W - 1)
            mimo = mapa[vj, vi] != k
            venku.append(hn[vj[mimo], vi[mimo]])
        venku = np.concatenate(venku)
        if len(venku) == 0 or np.median(venku) > 1.0 or hrana[cj, ci].mean() > 34: continue
        pridej(cj, ci, None)
    z_dmp = len(nove)
    rozbor_budov(nove, dmr, dmp, orto)      # tvar střechy jako u ostatních budov
    # 2) kůlny s červenými taškami, které v DMP 1G nejsou: barva v ortofotu
    cervena = (o[..., 0] - o[..., 1] > 22) & (o[..., 0] - o[..., 2] > 35) & (o[..., 0] > 90) & okoli & ~uz & (hn < 2.2)
    jj, ii, koreny, mapa = _oblasti(cervena)
    for k in np.unique(koreny):
        sel = koreny == k
        if not (10 <= sel.sum() * plocha_px <= 150) or hrana[jj[sel], ii[sel]].mean() > 30: continue
        pridej(jj[sel], ii[sel], 'shed', vyska=2.6)
    print(f'stavby chybějící v OSM: {z_dmp} z DMP, {len(nove) - z_dmp} kůlen s červenou střechou z ortofota')
    return nove


def _oblasti(maska):
    """Souvislé oblasti (4-sousedství) pravdivých pixelů – union-find. Vrací (jj, ii, kořen pixelu, mapa kořenů)."""
    H, W = maska.shape
    idx = -np.ones((H, W), np.int64)
    jj, ii = np.nonzero(maska)
    idx[jj, ii] = np.arange(len(jj))
    rodic = np.arange(len(jj))
    def koren(a):
        while rodic[a] != a:
            rodic[a] = rodic[rodic[a]]; a = rodic[a]
        return a
    for (dj, di) in ((0, 1), (1, 0)):
        a = idx[:H - dj, :W - di]; b = idx[dj:, di:]
        m = (a >= 0) & (b >= 0)
        for p, q in zip(a[m], b[m]):
            rp, rq = koren(p), koren(q)
            if rp != rq: rodic[rq] = rp
    koreny = np.array([koren(k) for k in range(len(jj))], np.int64)
    mapa = -np.ones((H, W), np.int64)
    mapa[jj, ii] = koreny
    return jj, ii, koreny, mapa


def vyrovnej_silnice(Hm, krok, dmr, cesty, zeleznice):
    """Silnice a koleje jako hladké těleso: podélný profil z DMR v ose (medián 18 m proti propadům pod mosty,
    pak Gauss σ 8 m), uzly mřížky do šířka/2 + 4 m srovnané na profil, do šířka/2 + 14 m plynulý náběh
    na původní terén (násep / zářez). Ostatní terén jedno jemné vyhlazení 3 × 3. Mění Hm na místě."""
    from numpy.lib.stride_tricks import sliding_window_view
    nz, nx = Hm.shape
    # jemné vyhlazení všeho (binomické 1-2-1)
    p = np.pad(Hm, 1, mode='edge')
    Hm[:] = (p[:-2, :-2] + 2 * p[:-2, 1:-1] + p[:-2, 2:] + 2 * p[1:-1, :-2] + 4 * p[1:-1, 1:-1] + 2 * p[1:-1, 2:]
             + p[2:, :-2] + 2 * p[2:, 1:-1] + p[2:, 2:]) / 16
    x0, z0 = dmr.x0, dmr.z0
    citatel = np.zeros_like(Hm); jmenovatel = np.zeros_like(Hm); vaha_max = np.zeros_like(Hm)
    seznam = [(sirka, pts) for druh, (sirka, z), pts in cesty if sirka >= 3] + [(4.0, pts) for pts in zeleznice]
    jadro = np.exp(-0.5 * (np.arange(-12, 13) / 4) ** 2); jadro /= jadro.sum()
    for sirka, pts in seznam:
        body = []
        for a, b in zip(pts, pts[1:]):
            n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 2))
            body += [(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) for k in range(n)]
        body.append(pts[-1])
        B = np.array(body)
        prof = dmr.bilin(B[:, 0], B[:, 1])
        if len(prof) >= 9:
            prof = np.median(sliding_window_view(np.pad(prof, 4, mode='edge'), 9), axis=1)
        prof = np.convolve(np.pad(prof, 12, mode='edge'), jadro, mode='valid')
        vnitrni, vnejsi = sirka / 2 + 4, sirka / 2 + 14
        for (x, z), h in zip(B, prof):
            i0, i1 = max(0, int((x - vnejsi - x0) / krok)), min(nx - 1, int((x + vnejsi - x0) / krok) + 1)
            j0, j1 = max(0, int((z - vnejsi - z0) / krok)), min(nz - 1, int((z + vnejsi - z0) / krok) + 1)
            if i0 > i1 or j0 > j1: continue
            X = x0 + np.arange(i0, i1 + 1) * krok; Z = z0 + np.arange(j0, j1 + 1) * krok
            d = np.hypot(X[None, :] - x, Z[:, None] - z)
            t = np.clip((vnejsi - d) / (vnejsi - vnitrni), 0, 1)
            w = t * t * (3 - 2 * t)
            sl = (slice(j0, j1 + 1), slice(i0, i1 + 1))
            citatel[sl] += w * w * h; jmenovatel[sl] += w * w
            vaha_max[sl] = np.maximum(vaha_max[sl], w)
    m = jmenovatel > 0
    Hm[m] = Hm[m] * (1 - vaha_max[m]) + citatel[m] / jmenovatel[m] * vaha_max[m]
    print(f'vyrovnání silnic: {len(seznam)} úseků, ovlivněno {m.mean() * 100:.1f} % uzlů terénu')


_mezipamet_nad = {}


def nad_terenem(dmr, dmp, orto):
    """Výška povrchu nad terénem (DMP − DMR) a barva ortofota, obojí v mřížce DMP. Počítá se jednou."""
    if 'hn' not in _mezipamet_nad:
        H, W = dmp.H, dmp.W
        hn = np.zeros((H, W), np.float32)
        xs = dmp.x0 + (np.arange(W) + 0.5) * dmp.sx
        for j in range(H):
            hn[j] = dmp.a[j] - dmr.bilin(xs, np.full(W, dmp.z0 + (j + 0.5) * dmp.sz))
        oi = np.clip(((xs - orto.x0) / orto.sx).astype(int), 0, orto.W - 1)
        oj = np.clip(((dmp.z0 + (np.arange(H) + 0.5) * dmp.sz - orto.z0) / orto.sz).astype(int), 0, orto.H - 1)
        _mezipamet_nad['hn'] = hn
        _mezipamet_nad['o'] = orto.a[oj[:, None], oi[None, :]].astype(np.float32)
    return _mezipamet_nad['hn'], _mezipamet_nad['o']


def stromy_z_dmp(zdroj, svet, dmr, orto, budovy, cesty, x0, z0, cil):
    """Polohy a výšky jednotlivých stromů z DMP OK (povrch z obrazové korelace VČETNĚ vegetace – DMP 1G ji nemá):
    vrcholy korun = lokální maxima výšky vegetace (DMP OK − DMR) mimo budovy
    a silnice, výška > 3 m; jehličnan podle tmavé modrozelené barvy v ortofotu.
    Zapíše stromy.bin: na strom Uint16 x, Uint16 z (decimetry od rohu světa), Uint8 výška/4 m, Uint8 druh (1 = jehličnan)."""
    dmp = Rastr(zdroj, 'arcgis2/rest/services/dmp/ImageServer', 1, 3, 2, 'tiff', '&pixelType=F32&interpolation=RSP_BilinearInterpolation', svet)
    H, W = dmp.H, dmp.W
    hn = np.zeros((H, W), np.float32)
    xs = dmp.x0 + (np.arange(W) + 0.5) * dmp.sx
    for j in range(H):
        hn[j] = dmp.a[j] - dmr.bilin(xs, np.full(W, dmp.z0 + (j + 0.5) * dmp.sz))
    oi = np.clip(((xs - orto.x0) / orto.sx).astype(int), 0, orto.W - 1)
    oj = np.clip(((dmp.z0 + (np.arange(H) + 0.5) * dmp.sz - orto.z0) / orto.sz).astype(int), 0, orto.H - 1)
    o = orto.a[oj[:, None], oi[None, :]].astype(np.float32)
    px = lambda p: ((p[0] - dmp.x0) / dmp.sx - 0.5, (p[1] - dmp.z0) / dmp.sz - 0.5)
    stavby = Image.new('L', (W, H), 0)
    ds = ImageDraw.Draw(stavby)
    for b in budovy:
        pts = [px(p) for p in b['body']]
        ds.polygon(pts, fill=255); ds.line(pts + pts[:1], fill=255, width=3)
    for druh, (sirka, z), pts in cesty:
        ds.line([px(p) for p in pts], fill=255, width=max(2, int(sirka / dmp.sz)), joint='curve')
    stavby = np.asarray(stavby) > 0
    # vyhlazená výška korun (3 × 3) a maximum v okně ~5,8 × 5 m (oddělitelný max-filtr)
    c = np.pad(hn, 1, mode='edge')
    hs = sum(c[dj:dj + H, di:di + W] for dj in range(3) for di in range(3)) / 9
    def max_okno(a, rx, rz):
        m = a.copy()
        for d in range(1, rx + 1):
            m[:, d:] = np.maximum(m[:, d:], a[:, :-d]); m[:, :-d] = np.maximum(m[:, :-d], a[:, d:])
        m2 = m.copy()
        for d in range(1, rz + 1):
            m2[d:] = np.maximum(m2[d:], m[:-d]); m2[:-d] = np.maximum(m2[:-d], m[d:])
        return m2
    mx = max_okno(hs, 4, 2)
    zelen = (2 * o[..., 1] - o[..., 0] - o[..., 2]) > -5
    vrcholy = (hs >= mx - 1e-4) & (hs > 3.0) & (hs < 40) & ~stavby & zelen
    jj, ii = np.nonzero(vrcholy)
    vys = hn[jj, ii]
    jas = o[jj, ii].mean(1)
    modrost = o[jj, ii, 2] - o[jj, ii, 0]
    jehlic = (jas < 62) & (modrost > -8)
    x = dmp.x0 + (ii + 0.5) * dmp.sx - x0
    z = dmp.z0 + (jj + 0.5) * dmp.sz - z0
    rec = np.zeros(len(jj), dtype=[('x', '<u2'), ('z', '<u2'), ('h', 'u1'), ('j', 'u1')])
    rec['x'] = np.clip(np.round(x * 10), 0, 65535); rec['z'] = np.clip(np.round(z * 10), 0, 65535)
    rec['h'] = np.clip(np.round(vys * 4), 0, 255); rec['j'] = jehlic
    rec.tofile(os.path.join(cil, 'stromy.bin'))
    print(f'stromy z DMP: {len(rec)} (jehličnanů {int(jehlic.sum())}), výška medián {np.median(vys):.1f} m')
