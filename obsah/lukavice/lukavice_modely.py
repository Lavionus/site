"""Lukavice – modely postavy a auta pro three.js, postavené skriptem v Blenderu.

Spuštění (bez okna):
    blender -b --factory-startup --python lukavice_modely.py -- [vystupni_adresar] [adresar_nahledu]
    (proměnná MODELY=auto nebo MODELY=postava postaví jen jeden model; náhledy renderuje Cycles)

Vytvoří ve výstupním adresáři (výchozí = adresář skriptu):
  postava.glb – muž v mikině se zipem a džínách; kostra + akce Stani, Chuze, Beh, Skok
  auto.glb    – hatchback; kola Kolo_PL/PP/ZL/ZP samostatně, Volant, materiály Lak/Sklo/Svetla/
                Koncova/Brzdova/Couvaci/…

Souřadnice: v Blenderu Z nahoru, předek do −Y, levá strana = +X.
Exportér (export_yup) z toho udělá three.js: Y nahoru, předek do +Z, levá = +X.
"""
import bpy, bmesh, math, sys, os
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler, noise
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
VYSTUP = argv[0] if argv else os.path.dirname(os.path.abspath(__file__))
NAHLED = argv[1] if len(argv) > 1 else None
MODELY = os.environ.get('MODELY', 'postava,auto')

bpy.ops.wm.read_factory_settings(use_empty=True)
scena = bpy.context.scene
scena.render.fps = 24


# ======================================================================== společné
def srgb(hexstr):
    """#rrggbb → lineární RGB (Blender pracuje lineárně)."""
    c = [int(hexstr[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


M = {}


def material(jmeno, barva, drsnost=0.7, kov=0.0, zar=None, sila=1.0, alfa=None, lak=0.0,
             barva_tex=None, normal_tex=None, normal_sila=1.0, drsnost_tex=None):
    m = bpy.data.materials.new(jmeno)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(barva), 1)
    b.inputs['Roughness'].default_value = drsnost
    b.inputs['Metallic'].default_value = kov
    if zar:
        b.inputs['Emission Color'].default_value = (*srgb(zar), 1)
        b.inputs['Emission Strength'].default_value = sila
    else:
        b.inputs['Emission Color'].default_value = (0, 0, 0, 1)
        b.inputs['Emission Strength'].default_value = 0.0
    if lak:
        b.inputs['Coat Weight'].default_value = lak
        b.inputs['Coat Roughness'].default_value = 0.05
    if barva_tex is not None:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = barva_tex
        if barva != '#ffffff':                     # barva × textura
            mix = nt.nodes.new('ShaderNodeMix')
            mix.data_type, mix.blend_type = 'RGBA', 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1.0
            mix.inputs[7].default_value = (*srgb(barva), 1)
            nt.links.new(t.outputs['Color'], mix.inputs[6])
            nt.links.new(mix.outputs[2], b.inputs['Base Color'])
        else:
            nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if normal_tex is not None:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = normal_tex
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = normal_sila
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    m.use_backface_culling = True                  # → glTF doubleSided: false
    if alfa is not None:
        b.inputs['Alpha'].default_value = alfa
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            pass
        try:
            m.blend_method = 'BLEND'
        except Exception:
            pass
    m.diffuse_color = (*srgb(barva), 1 if alfa is None else alfa)   # náhled ve Workbench
    m.roughness = drsnost
    m.metallic = kov
    M[jmeno] = m
    return m


def obrazek(jmeno, pole, data=False):
    """numpy pole (výška, šířka, 3|4) v 0..1, řádek 0 = dole → obrázek vložený do .blend (PNG)."""
    h, w = pole.shape[:2]
    if pole.shape[2] == 3:
        pole = np.concatenate([pole, np.ones((h, w, 1))], axis=2)
    img = bpy.data.images.new(jmeno, w, h, alpha=False)
    if data:
        img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(np.clip(pole, 0, 1).astype(np.float32).ravel())
    img.file_format = 'PNG'
    img.pack()
    return img


def normalova_mapa(vyska, sila=1.0):
    """Výšková mapa (h, w) → normálová mapa (tangentní prostor, opakovatelná)."""
    dx = (np.roll(vyska, -1, 1) - np.roll(vyska, 1, 1)) * sila
    dy = (np.roll(vyska, -1, 0) - np.roll(vyska, 1, 0)) * sila
    n = np.stack([-dx, -dy, np.ones_like(vyska)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


class Sit:
    """Sběr vrcholů a ploch; každá plocha má jméno materiálu (a volitelně UV),
    každý vrchol značku (seznam kostí pro váhy)."""

    def __init__(s):
        s.v, s.f, s.m, s.g, s.uv = [], [], [], [], []

    def bod(s, p, g=None):
        s.v.append(Vector(p))
        s.g.append(g)
        return len(s.v) - 1

    def plocha(s, idx, mat, uv=None):
        s.f.append(tuple(idx))
        s.m.append(mat)
        s.uv.append(uv)

    def pridej_bm(s, bm, mat, g=None, mat_fn=None, mat_world=None):
        zakl = len(s.v)
        bm.verts.index_update()
        for v in bm.verts:
            co = v.co.copy()
            if mat_world is not None:
                co = mat_world @ co
            s.v.append(co)
            s.g.append(g)
        for f in bm.faces:
            s.f.append(tuple(zakl + v.index for v in f.verts))
            s.m.append(mat_fn(f) if mat_fn else mat)
            s.uv.append(None)

    def objekt(s, jmeno, prepocet=True, ostry=None, rodic=None):
        mats = []
        for x in s.m:
            if x not in mats:
                mats.append(x)
        me = bpy.data.meshes.new(jmeno)
        me.from_pydata([tuple(v) for v in s.v], [], s.f)
        for mt in mats:
            me.materials.append(M[mt])
        for i, p in enumerate(me.polygons):
            p.material_index = mats.index(s.m[i])
        if any(u is not None for u in s.uv):
            uvl = me.uv_layers.new(name='UVMap')
            for i, p in enumerate(me.polygons):
                uv = s.uv[i]
                for k, li in enumerate(p.loop_indices):
                    uvl.data[li].uv = uv[k] if uv else (0.0, 0.0)
        ob = bpy.data.objects.new(jmeno, me)
        scena.collection.objects.link(ob)
        hladit(ob, ostry, prepocet)
        if rodic:
            ob.parent = rodic
        return ob


def hladit(ob, ostry=None, prepocet=False):
    """Hladké stínování; hrany ostřejší než `ostry` stupňů zůstanou ostré."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    if prepocet:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    if ostry is not None:
        lim = math.radians(ostry)
        for e in bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle(0) > lim:
                e.smooth = False
    bm.to_mesh(ob.data)
    bm.free()


def aplikuj_mod(ob, mod):
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def trojuhelniky(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def spow(c, e):
    return math.copysign(abs(c) ** e, c)


def superel(sit, stred, polomery, mat, e=1.0, seg=12, rings=8, R=None, g=None, orez=None, e2=None):
    """Superelipsoid: e=1 elipsoid, menší e = hranatější (zaoblený kvádr). R = rotační matice 3×3.
    orez(z_norm) → True = vynechat řadu (např. spodní polovinu)."""
    e2 = e if e2 is None else e2
    R = R or Matrix.Identity(3)
    st = Vector(stred)
    rady = []
    for j in range(1, rings):
        f = -math.pi / 2 + math.pi * j / rings
        rada = []
        for k in range(seg):
            t = 2 * math.pi * k / seg
            p = Vector((polomery[0] * spow(math.cos(f), e) * spow(math.cos(t), e2),
                        polomery[1] * spow(math.cos(f), e) * spow(math.sin(t), e2),
                        polomery[2] * spow(math.sin(f), e)))
            rada.append(sit.bod(st + R @ p, g))
        rady.append(rada)
    dno = sit.bod(st + R @ Vector((0, 0, -polomery[2])), g)
    vrch = sit.bod(st + R @ Vector((0, 0, polomery[2])), g)
    for j in range(len(rady) - 1):
        for k in range(seg):
            sit.plocha((rady[j][k], rady[j][(k + 1) % seg], rady[j + 1][(k + 1) % seg], rady[j + 1][k]), mat)
    for k in range(seg):
        sit.plocha((dno, rady[0][(k + 1) % seg], rady[0][k]), mat)
        sit.plocha((vrch, rady[-1][k], rady[-1][(k + 1) % seg]), mat)


def rot(x=0, y=0, z=0):
    return Euler((math.radians(x), math.radians(y), math.radians(z)), 'XYZ').to_matrix()


def pchip(body):
    """Monotónní kubická interpolace (bez překmitů) bodů [(x, y)] → funkce."""
    xs = [p[0] for p in body]
    ys = [p[1] for p in body]
    n = len(xs)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    m[0], m[-1] = d[0], d[-1]
    for k in range(1, n - 1):
        if d[k - 1] * d[k] <= 0:
            m[k] = 0.0
        else:
            w1, w2 = 2 * h[k] + h[k - 1], h[k] + 2 * h[k - 1]
            m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k])

    def f(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        i = 0
        while xs[i + 1] < x:
            i += 1
        t = (x - xs[i]) / h[i]
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
                + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1])
    return f


def chaikin(poly, kroky=2):
    for _ in range(kroky):
        nove = []
        for i in range(len(poly)):
            a, b = Vector(poly[i]), Vector(poly[(i + 1) % len(poly)])
            nove += [a * 0.75 + b * 0.25, a * 0.25 + b * 0.75]
        poly = nove
    return poly


def paprsek_na(p, d, strom):
    hit, nrm, _, _ = strom.ray_cast(Vector(p) - d * 0.6, d, 2.0)
    if hit is not None and nrm.dot(d) > 0:              # normála vždy proti paprsku
        nrm = -nrm
    return hit, nrm

def nalepka_na(sit, strom, stred, smer, osa_u, obrys, mat, vyska=0.004, kruhy=(1.0,), okraj=True,
            hladke=2, mat_okraj=None, g=None):
    """Plochá záplata kopírující povrch. obrys = polygon v (u, v) [m] kolem `stred`,
    `smer` = směr paprsku do povrchu. Vyhlazeno Chaikinem, s bočním okrajem k povrchu."""
    d = Vector(smer).normalized()
    u = (Vector(osa_u) - d * d.dot(Vector(osa_u))).normalized()
    v = u.cross(d)
    if v.z < -0.3:
        v = -v
    poly = chaikin([Vector(p) for p in obrys], 0 if len(obrys) >= 10 else hladke)
    cen = sum(poly, Vector((0, 0))) / len(poly)
    rady, dno = [], []
    for k, sc in enumerate(kruhy):
        rada = []
        for p in poly:
            q = cen + (p - cen) * sc
            bod = Vector(stred) + u * q.x + v * q.y
            hit, nrm = paprsek_na(bod, d, strom)
            if hit is None:
                print('NALEPKA MINULA', mat, stred)
                return
            rada.append(sit.bod(hit + nrm * vyska, g))
            if k == 0:
                dno.append(sit.bod(hit - nrm * 0.002, g))
        rady.append(rada)
    hit, nrm = paprsek_na(Vector(stred) + u * cen.x + v * cen.y, d, strom)
    stred_i = sit.bod(hit + nrm * vyska, g)
    n = len(poly)
    plochy = []
    for a, b in zip(rady, rady[1:]):
        for k in range(n):
            plochy.append(((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]), mat))
    for k in range(n):
        plochy.append(((rady[-1][k], rady[-1][(k + 1) % n], stred_i), mat))
    if okraj:
        for k in range(n):
            plochy.append(((dno[k], dno[(k + 1) % n], rady[0][(k + 1) % n], rady[0][k]), mat_okraj or mat))
    # orientace: první plocha musí mířit proti paprsku
    f0 = plochy[0][0]
    nn = (sit.v[f0[1]] - sit.v[f0[0]]).cross(sit.v[f0[2]] - sit.v[f0[0]])
    otoc = nn.dot(d) > 0
    for f, mt in plochy:
        sit.plocha(tuple(reversed(f)) if otoc else f, mt)

def obdelnik(a, b, r=0.3):
    """Obdélník ±a × ±b se sraženými rohy (Chaikin z něj udělá zaoblení)."""
    return [(-a + r * b, -b), (a - r * b, -b), (a, -b + r * b), (a, b - r * b), (a - r * b, b),
            (-a + r * b, b), (-a, b - r * b), (-a, -b + r * b)]

def kruh(r, n=10):
    return [(r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n)) for k in range(n)]

def prouzek_na(sit, strom, body, smer, sirka, mat, vyska=0.0015, g=None):
    """Úzký pásek po povrchu (spáry, lišty) přes body v prostoru promítnuté ve směru `smer`."""
    d = Vector(smer).normalized()
    hits = []
    for p in body:
        hit, nrm = paprsek_na(Vector(p), d, strom)
        if hit is not None:
            hits.append((hit, nrm))
    prev = None
    for i, (hit, nrm) in enumerate(hits):
        a = hits[max(i - 1, 0)][0]
        b = hits[min(i + 1, len(hits) - 1)][0]
        t = (b - a).normalized()
        bok = t.cross(nrm).normalized() * sirka / 2
        p = hit + nrm * vyska
        cur = (sit.bod(p - bok, g), sit.bod(p + bok, g))
        if prev:
            q = (prev[0], cur[0], cur[1], prev[1])
            nn = (sit.v[q[1]] - sit.v[q[0]]).cross(sit.v[q[2]] - sit.v[q[0]])
            sit.plocha(q if nn.dot(nrm) > 0 else tuple(reversed(q)), mat)
        prev = cur



# ======================================================================== POSTAVA
def smooth(a, b, x):
    """Hladký přechod 0→1 mezi a a b (a > b je dovoleno)."""
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def gauss(u, v=0.0):
    return math.exp(-(u * u + v * v))


def catmull(body, kroky):
    """Catmull-Rom přes seznamy čísel [(Vector, a, b, …)] → hustší seznam."""
    ven = []
    n = len(body)
    for i in range(n - 1):
        p0, p1, p2, p3 = body[max(i - 1, 0)], body[i], body[i + 1], body[min(i + 2, n - 1)]
        for k in range(kroky):
            t = k / kroky
            t2, t3 = t * t, t * t * t

            def cr(a, b, c, d):
                return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
            ven.append(tuple(cr(p0[j], p1[j], p2[j], p3[j]) for j in range(len(p1))))
    ven.append(body[-1])
    return ven


def trubka(sit, body, n, mat, g, kroky=2, ref=(0, -1, 0), cap=(1.0, 1.0), uv=None):
    """Hladká trubka podél bodů [(poloha, rx, ry_vpredu[, ry_vzadu])], zakulacené konce.
    ry míří ve směru `ref` (kolmo na tečnu), rx do strany. mat = jméno nebo fn(střed, i_kruhu, u).
    uv = (opakování_u, metrů_na_v) → UV pro opakovanou texturu."""
    body = [(Vector(b[0]), b[1], b[2], b[3] if len(b) > 3 else b[2]) for b in body]
    body = catmull(body, kroky)

    def tecna(seznam, i):
        return (seznam[min(i + 1, len(seznam) - 1)][0] - seznam[max(i - 1, 0)][0]).normalized()
    t0, t1 = tecna(body, 0), tecna(body, len(body) - 1)
    zac, kon = [], []
    for fi in (65, 35):
        f = math.radians(fi)
        p, rx, ryf, ryb = body[0]
        r = (rx + ryf) / 2 * cap[0]
        zac.append((p - t0 * r * math.sin(f), rx * math.cos(f), ryf * math.cos(f), ryb * math.cos(f)))
    for fi in (35, 65):
        f = math.radians(fi)
        p, rx, ryf, ryb = body[-1]
        r = (rx + ryf) / 2 * cap[1]
        kon.append((p + t1 * r * math.sin(f), rx * math.cos(f), ryf * math.cos(f), ryb * math.cos(f)))
    pol0 = body[0][0] - t0 * (body[0][1] + body[0][2]) / 2 * cap[0]
    pol1 = body[-1][0] + t1 * (body[-1][1] + body[-1][2]) / 2 * cap[1]
    kruhy = zac + body + kon
    N = Vector(ref)
    T = tecna(kruhy, 0)
    N = (N - T * N.dot(T)).normalized()
    idx, delka, dpred = [], [], 0.0
    for i, (p, rx, ryf, ryb) in enumerate(kruhy):
        T2 = tecna(kruhy, i)
        if i > 0:
            N = T.rotation_difference(T2) @ N
            N = (N - T2 * N.dot(T2)).normalized()
            dpred += (p - kruhy[i - 1][0]).length
        T = T2
        B = T.cross(N).normalized()
        rada = []
        for k in range(n):
            a = 2 * math.pi * k / n
            s = math.sin(a)
            rada.append(sit.bod(p + B * math.cos(a) * rx + N * s * (ryf if s > 0 else ryb), g))
        idx.append(rada)
        delka.append(dpred)
    ip0 = sit.bod(pol0, g)
    ip1 = sit.bod(pol1, g)
    mf = mat if callable(mat) else (lambda c, i, u: mat)

    def uvq(i, k):
        if not uv:
            return None
        u0, u1 = k / n * uv[0], (k + 1) / n * uv[0]
        v0, v1 = delka[i] / uv[1], delka[i + 1] / uv[1]
        return [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    for i in range(len(idx) - 1):
        for k in range(n):
            q = (idx[i][k], idx[i][(k + 1) % n], idx[i + 1][(k + 1) % n], idx[i + 1][k])
            c = sum((sit.v[j] for j in q), Vector()) / 4
            sit.plocha(q, mf(c, i, k / n), uvq(i, k))
    for k in range(n):
        u = [(k / n * uv[0], 0), ((k + 1) / n * uv[0], 0), (k / n * uv[0], 0)] if uv else None
        sit.plocha((ip0, idx[0][(k + 1) % n], idx[0][k]), mf(sit.v[idx[0][k]], 0, k / n), u)
        sit.plocha((ip1, idx[-1][k], idx[-1][(k + 1) % n]), mf(sit.v[idx[-1][k]], len(idx) - 1, k / n), u)


def hustota(n, rozsah, stred, sirka, zesileni):
    """n hodnot v intervalu `rozsah`, nahuštěných kolem `stred` (inverze distribuční funkce)."""
    a, b = rozsah
    xs = np.linspace(a, b, 2001)
    d = 1 + zesileni * np.exp(-((xs - stred) / sirka) ** 2)
    cdf = np.concatenate([[0], np.cumsum((d[1:] + d[:-1]) / 2 * np.diff(xs))])
    cdf /= cdf[-1]
    return list(np.interp(np.linspace(0, 1, n), cdf, xs))


# kosti: jméno → (hlava, ocas, rodič); proporce dospělého muže 1,75 m
KOSTI = {
    'Panev':   ((0, 0, 0.94),      (0, 0, 1.06),       None),
    'Pater':   ((0, 0, 1.06),      (0, 0.004, 1.24),   'Panev'),
    'Hrudnik': ((0, 0.004, 1.24),  (0, 0.01, 1.43),    'Pater'),
    'Krk':     ((0, 0.01, 1.43),   (0, 0.0, 1.545),    'Hrudnik'),
    'Hlava':   ((0, 0.0, 1.545),   (0, 0.0, 1.745),    'Krk'),
}
for st, sx in (('L', 1), ('R', -1)):
    KOSTI.update({
        'Klicni.' + st:    ((0.02 * sx, -0.01, 1.415),   (0.175 * sx, 0.005, 1.425),  'Hrudnik'),
        'Rameno.' + st:    ((0.185 * sx, 0.0, 1.41),     (0.212 * sx, 0.018, 1.10),   'Klicni.' + st),
        'Predlokti.' + st: ((0.212 * sx, 0.018, 1.10),   (0.236 * sx, -0.006, 0.85),  'Rameno.' + st),
        'Ruka.' + st:      ((0.236 * sx, -0.006, 0.85),  (0.236 * sx, -0.016, 0.70),  'Predlokti.' + st),
        'Stehno.' + st:    ((0.092 * sx, 0.0, 0.92),     (0.10 * sx, -0.012, 0.49),   'Panev'),
        'Lytko.' + st:     ((0.10 * sx, -0.012, 0.49),   (0.10 * sx, 0.016, 0.085),   'Stehno.' + st),
        'Chodidlo.' + st:  ((0.10 * sx, 0.016, 0.085),   (0.104 * sx, -0.115, 0.026), 'Lytko.' + st),
        'Spicka.' + st:    ((0.104 * sx, -0.115, 0.026), (0.105 * sx, -0.195, 0.02), 'Chodidlo.' + st),
    })

HS = Vector((0, -0.004, 1.628))          # střed hlavy
HR = (0.077, 0.099, 0.117)               # poloosy lebky


PROFIL = pchip([(-0.117, 0.0), (-0.112, 0.045), (-0.104, 0.077), (-0.095, 0.088), (-0.075, 0.092),
                (-0.055, 0.095), (-0.035, 0.096), (0.0, 0.094), (0.03, 0.097), (0.06, 0.093), (0.09, 0.072),
                (0.106, 0.045), (0.117, 0.0)])     # hloubka obličeje ve střední rovině podle výšky


def tvar_hlavy(th, fi):
    """Bod povrchu hlavy (lokálně kolem HS) pro zeměpisnou délku th (0 = obličej) a šířku fi."""
    cf, sf = math.cos(fi), math.sin(fi)
    X = HR[0] * cf * math.sin(th)
    ct = math.cos(th)
    Z = HR[2] * sf
    Y = -PROFIL(Z) * spow(ct, 0.8) if ct > 0 else -0.093 * cf * ct
    if Z < 0:                                           # čelist a brada užší, týl ke krku ustupuje
        k = smooth(0.0, -0.11, Z)
        X *= 1 - 0.24 * k * k - 0.08 * k
        if Y > 0:
            Y *= 1 - 0.6 * smooth(-0.015, -0.10, Z)
    if Z < -0.098:
        Z = -0.098 + (Z + 0.098) * 0.6
    if Z > 0.02:
        X *= 1 + 0.03 * smooth(0.02, 0.08, Z)
    if Y < 0:                                           # obličejové rysy (posun podél −Y = ven)
        ax = abs(X)
        d = 0.0
        d += 0.0075 * gauss((ax - 0.032) / 0.016, (Z - 0.006) / 0.0105)          # oční důlky
        d -= 0.0042 * gauss((ax - 0.032) / 0.026, (Z - 0.024) / 0.008)            # nadočnicové oblouky
        d -= 0.0035 * gauss((ax - 0.046) / 0.018, (Z + 0.014) / 0.017)            # lícní kosti
        zt = max(0.0, min(1.0, (0.014 - Z) / 0.05))                                # nos: kořen → špička
        if Z > -0.036:
            prof = 0.006 + 0.0145 * zt ** 1.6
        else:
            prof = 0.0205 * max(0.0, 1 - (-0.036 - Z) / 0.011) ** 1.5
        prof *= smooth(0.03, 0.012, Z)
        sig = 0.0065 + 0.0075 * zt
        d -= prof * gauss(X / sig)
        d -= 0.0055 * gauss((ax - 0.0125) / 0.0065, (Z + 0.036) / 0.0065)         # nosní křídla
        d -= 0.0012 * gauss(X / 0.004, (Z + 0.047) / 0.005)                         # žlábek pod nosem
        d -= 0.0030 * gauss(X / 0.018, (Z + 0.058) / 0.0045)                        # horní ret
        d -= 0.0034 * gauss(X / 0.016, (Z + 0.070) / 0.005)                         # dolní ret
        d += 0.0026 * gauss(X / 0.021, (Z + 0.0635) / 0.0017)                       # štěrbina úst
        d += 0.0012 * gauss((ax - 0.023) / 0.004, (Z + 0.064) / 0.004)             # koutky
        d += 0.0018 * gauss(X / 0.02, (Z + 0.080) / 0.0045)                         # rýha pod rtem
        d -= 0.0055 * gauss(X / 0.022, (Z + 0.097) / 0.011)                         # brada
        Y += d
    return Vector((X, Y, Z))


def je_ret(c):
    """Leží střed plochy (lokálně) na rtech?"""
    if c.y > -0.07:
        return False
    z = c.z + 0.064
    sir = 0.021 * max(0.0, 1 - (z / 0.0105) ** 2) ** 0.5
    return abs(c.x) < sir


def postav_postavu():
    # ---- textury (opakovatelné, generované): džínovina, úplet mikiny, prameny vlasů
    rng = np.random.default_rng(7)
    N = 256
    yy, xx = np.mgrid[0:N, 0:N]
    kepr = (np.sin((xx + yy) * 2 * np.pi / 6) * 0.5 + 0.5)                      # diagonální kepr
    sum_ = rng.random((N, N))
    sum_ = (sum_ + np.roll(sum_, 1, 0) + np.roll(sum_, 1, 1) + np.roll(sum_, 3, 0)) / 4
    nit = rng.random((1, N)) * 0.5 + rng.random((N, 1)) * 0.5                   # nestejnoměrná příze
    svet = 0.86 + 0.14 * kepr + 0.10 * (nit - 0.5) + 0.10 * (sum_ - 0.5)
    dziny_c = obrazek('dziny_barva', np.dstack([svet * 0x3e / 255, svet * 0x5f / 255, svet * 0x8e / 255]))
    dziny_n = obrazek('dziny_normal', np.round(normalova_mapa(kepr * 0.75 + sum_ * 0.25, 1.2) * 24) / 24, data=True)
    m = 128
    oko = (np.sin(xx[:m, :m] * 2 * np.pi / 4) * 0.5 + 0.5) * (np.sin(yy[:m, :m] * 2 * np.pi / 8) * 0.3 + 0.7)
    mikina_n = obrazek('mikina_normal', np.round(normalova_mapa(oko * 0.75 + sum_[:m, :m] * 0.25, 0.7) * 24) / 24,
                       data=True)
    pr = np.zeros((N, N))
    for _ in range(24):                                                          # prameny podél v
        f = rng.integers(3, 30)
        pr += np.sin(xx * 2 * np.pi * f / N + rng.random() * 6.3 + 0.8 * np.sin(yy * 2 * np.pi / N * rng.integers(1, 3)))
    pr = (pr - pr.min()) / (pr.max() - pr.min())
    vlasy_n = obrazek('vlasy_normal', normalova_mapa(pr, 2.5), data=True)
    vlasy_c = obrazek('vlasy_barva', np.dstack([(0.7 + 0.45 * pr) * c for c in (0x2c / 255, 0x1c / 255, 0x12 / 255)]))

    material('Kuze', '#dca486', 0.55)
    material('Rty', '#c47f72', 0.45)
    material('Oci', '#d9d2c6', 0.15)
    material('Duhovka', '#4a3322', 0.15)
    material('Zornice', '#050506', 0.1)
    material('Vlasy', '#ffffff', 0.5, barva_tex=vlasy_c, normal_tex=vlasy_n, normal_sila=0.8)
    material('Mikina', '#2d6a70', 0.9, normal_tex=mikina_n, normal_sila=0.5)
    material('MikinaLem', '#22555a', 0.95, normal_tex=mikina_n, normal_sila=0.9)
    material('Zip', '#2a2b2e', 0.35, 0.7)
    material('Snurky', '#e9e7e1', 0.7)
    material('Dziny', '#ffffff', 0.92, barva_tex=dziny_c, normal_tex=dziny_n, normal_sila=0.8)
    material('Steh', '#a87c48', 0.85)
    material('Boty', '#3b3e44', 0.65)
    material('Podrazka', '#efede6', 0.8)

    s = Sit()
    UV_L = (4, 0.12)                              # látka: 4 opakování po obvodu, 12 cm na opakování

    # ---- džíny: pánevní část a nohavice
    trubka(s, [((0, 0.006, 0.80), 0.10, 0.07, 0.08), ((0, 0.008, 0.86), 0.160, 0.10, 0.118),
               ((0, 0.008, 0.95), 0.168, 0.104, 0.112), ((0, 0.005, 1.00), 0.158, 0.10, 0.105)],
           18, 'Dziny', ['Panev', 'Stehno.L', 'Stehno.R'], kroky=2, ref=(0, -1, 0), cap=(0.5, 0.3), uv=UV_L)
    for st, sx in (('L', 1), ('R', -1)):
        trubka(s, [((0.09 * sx, 0.0, 0.98), 0.085, 0.09, 0.10), ((0.092 * sx, -0.003, 0.88), 0.088, 0.09, 0.104),
                   ((0.095 * sx, -0.006, 0.78), 0.081, 0.082, 0.088), ((0.098 * sx, -0.008, 0.66), 0.071, 0.072, 0.072),
                   ((0.10 * sx, -0.010, 0.56), 0.063, 0.065, 0.062), ((0.10 * sx, -0.013, 0.49), 0.059, 0.063, 0.058),
                   ((0.10 * sx, -0.006, 0.40), 0.058, 0.056, 0.064), ((0.10 * sx, 0.004, 0.28), 0.055, 0.054, 0.060),
                   ((0.10 * sx, 0.012, 0.17), 0.053, 0.055, 0.055), ((0.10 * sx, 0.012, 0.10), 0.057, 0.066, 0.057),
                   ((0.10 * sx, 0.012, 0.07), 0.059, 0.069, 0.059)],
               16, 'Dziny', ['Panev', 'Stehno.' + st, 'Lytko.' + st], kroky=2, cap=(0.4, 0.12), uv=UV_L)

    # ---- mikina (trup), lem dole
    def mat_mikina(c, i, u):
        return 'MikinaLem' if c.z < 0.988 else 'Mikina'
    trubka(s, [((0, 0.006, 0.932), 0.183, 0.118, 0.121), ((0, 0.006, 0.96), 0.181, 0.117, 0.119),
               ((0, 0.006, 0.99), 0.173, 0.113, 0.114), ((0, 0.006, 1.06), 0.163, 0.109, 0.108),
               ((0, 0.004, 1.15), 0.167, 0.116, 0.108), ((0, 0.002, 1.24), 0.179, 0.125, 0.11),
               ((0, 0.004, 1.32), 0.189, 0.121, 0.113), ((0, 0.008, 1.38), 0.191, 0.104, 0.106),
               ((0, 0.012, 1.425), 0.152, 0.08, 0.092), ((0, 0.012, 1.455), 0.08, 0.062, 0.074),
               ((0, 0.012, 1.47), 0.06, 0.055, 0.064)],
           18, mat_mikina, ['Panev', 'Pater', 'Hrudnik', 'Klicni.L', 'Klicni.R'], kroky=2, cap=(0.25, 0.3), uv=UV_L)
    # límec kolem krku a kapuce složená na zádech
    bvh_trup = BVHTree.FromPolygons([tuple(v) for v in s.v], s.f)
    trubka(s, [((0.026, -0.074, 1.455), 0.017, 0.022), ((0.072, -0.034, 1.476), 0.022, 0.028),
               ((0.074, 0.036, 1.49), 0.024, 0.03), ((0.0, 0.074, 1.494), 0.026, 0.03),
               ((-0.074, 0.036, 1.49), 0.024, 0.03), ((-0.072, -0.034, 1.476), 0.022, 0.028),
               ((-0.026, -0.074, 1.455), 0.017, 0.022)], 8, 'Mikina', ['Hrudnik', 'Krk'], kroky=2, ref=(0, 0, 1))
    superel(s, (0, 0.118, 1.385), (0.115, 0.04, 0.082), 'Mikina', e=0.8, seg=14, rings=8, R=rot(x=12),
            g=['Hrudnik'])
    for sx in (1, -1):                                                  # šňůrky kapuce
        trubka(s, [((0.03 * sx, -0.088, 1.44), 0.0045, 0.0045), ((0.034 * sx, -0.122, 1.36), 0.0045, 0.0045),
                   ((0.036 * sx, -0.127, 1.29), 0.0045, 0.0045)], 5, 'Snurky', ['Hrudnik'], kroky=1)
        superel(s, (0.036 * sx, -0.127, 1.282), (0.006, 0.006, 0.012), 'Zip', e=0.8, seg=6, rings=4,
                g=['Hrudnik'])

    # ---- rukávy, dlaně, prsty
    for st, sx in (('L', 1), ('R', -1)):
        def mat_rukav(c, i, u):
            return 'MikinaLem' if c.z < 0.902 else 'Mikina'
        trubka(s, [((0.14 * sx, 0.006, 1.405), 0.056, 0.058), ((0.19 * sx, 0.004, 1.395), 0.062, 0.064),
                   ((0.205 * sx, 0.008, 1.32), 0.057, 0.059), ((0.211 * sx, 0.014, 1.20), 0.049, 0.051),
                   ((0.214 * sx, 0.018, 1.10), 0.045, 0.047), ((0.222 * sx, 0.010, 1.00), 0.044, 0.045),
                   ((0.23 * sx, 0.0, 0.925), 0.040, 0.042), ((0.233 * sx, -0.003, 0.90), 0.034, 0.036),
                   ((0.235 * sx, -0.004, 0.868), 0.031, 0.033)],
               14, mat_rukav, ['Hrudnik', 'Klicni.' + st, 'Rameno.' + st, 'Predlokti.' + st], kroky=2,
               cap=(1.0, 0.15), uv=UV_L)
        DLAN = ['Predlokti.' + st, 'Ruka.' + st]
        # dlaň: tloušťka do strany (x), šířka dopředu/dozadu (y); vnitřní strana dlaně míří k tělu
        trubka(s, [((0.236 * sx, -0.006, 0.89), 0.017, 0.023), ((0.237 * sx, -0.008, 0.848), 0.019, 0.027),
                   ((0.238 * sx, -0.011, 0.795), 0.0190, 0.040), ((0.236 * sx, -0.013, 0.755), 0.0160, 0.041)],
               10, 'Kuze', DLAN, kroky=2, cap=(1.0, 0.45))
        for y, dl, r in ((-0.042, 0.072, 0.0086), (-0.020, 0.080, 0.0089), (0.002, 0.075, 0.0084),
                         (0.022, 0.060, 0.0074)):
            k = dl / 0.08 * 0.92
            body = [((0.237 * sx, y, 0.760), r, r),
                    ((0.236 * sx, y, 0.760 - 0.036 * k), r * 0.95, r * 0.95),
                    ((0.230 * sx, y, 0.760 - 0.063 * k), r * 0.88, r * 0.88),
                    ((0.221 * sx, y, 0.760 - 0.080 * k), r * 0.8, r * 0.8)]
            trubka(s, body, 6, 'Kuze', ['Ruka.' + st], kroky=1, cap=(0.6, 1.0))
        trubka(s, [((0.229 * sx, -0.030, 0.845), 0.012, 0.013), ((0.224 * sx, -0.050, 0.812), 0.011, 0.011),
                   ((0.218 * sx, -0.060, 0.785), 0.0095, 0.0095), ((0.215 * sx, -0.062, 0.762), 0.0085, 0.0085)],
               6, 'Kuze', DLAN, kroky=1, cap=(0.6, 1.0))

    # ---- boty: podrážka (vytažený obrys), svršek, jazyk, tkaničky
    for st, sx in (('L', 1), ('R', -1)):
        BOTA = ['Lytko.' + st, 'Chodidlo.' + st, 'Spicka.' + st]
        x0 = 0.102 * sx
        OBR = [(0.076, 0.018), (0.068, 0.033), (0.05, 0.040), (0.02, 0.042), (-0.02, 0.039), (-0.06, 0.044),
               (-0.10, 0.050), (-0.14, 0.049), (-0.17, 0.043), (-0.19, 0.033), (-0.203, 0.017)]

        def zved(y):
            return max(0.0, -0.15 - y) * 0.35
        rady = []
        for y, w in OBR:
            z0 = zved(y)
            rez = [(-w * 0.85, 0.0), (w * 0.85, 0.0), (w, 0.008), (w, 0.022), (w * 0.9, 0.03),
                   (-w * 0.9, 0.03), (-w, 0.022), (-w, 0.008)]
            rady.append([s.bod((x0 + x, y, z + z0), BOTA) for x, z in rez])
        for a, b in zip(rady, rady[1:]):
            for k in range(8):
                s.plocha((a[k], b[k], b[(k + 1) % 8], a[(k + 1) % 8]), 'Podrazka')
        s.plocha(tuple(rady[0]), 'Podrazka')
        s.plocha(tuple(reversed(rady[-1])), 'Podrazka')
        VR = [(0.070, 0.030, 0.098), (0.05, 0.039, 0.106), (0.02, 0.041, 0.102), (-0.02, 0.039, 0.092),
              (-0.06, 0.043, 0.077), (-0.10, 0.047, 0.062), (-0.14, 0.046, 0.051), (-0.17, 0.040, 0.043),
              (-0.19, 0.030, 0.037), (-0.20, 0.016, 0.032)]
        rady = []
        for y, w, h in VR:
            z0 = zved(y) + 0.026
            rada = []
            for k in range(11):
                a = math.pi * k / 10
                rada.append(s.bod((x0 + w * math.cos(a), y, z0 + (h - 0.026) * math.sin(a) ** 0.8), BOTA))
            rady.append(rada)

        def mat_svrsek(c):
            return 'Podrazka' if (c.y < -0.165 and c.z < 0.048) or (0.055 < c.y and c.z < 0.06) else 'Boty'
        for a, b in zip(rady, rady[1:]):
            for k in range(10):
                q = (a[k], a[k + 1], b[k + 1], b[k])
                c = sum((s.v[j] for j in q), Vector()) / 4
                s.plocha(q, mat_svrsek(c))
        s.plocha(tuple(rady[0]), 'Boty')
        s.plocha(tuple(reversed(rady[-1])), 'Boty')
        superel(s, (x0, -0.005, 0.104), (0.026, 0.04, 0.007), 'Boty', e=0.7, seg=10, rings=4, R=rot(x=-18), g=BOTA)
        for k in range(5):
            y = -0.025 - 0.019 * k
            h = pchip([(y_, h_) for y_, w_, h_ in reversed(VR)])(y)
            superel(s, (x0, y, h + 0.003), (0.024, 0.0035, 0.0028), 'Snurky', e=0.8, seg=6, rings=3,
                    R=rot(x=-22, z=(14 if k % 2 else -14)), g=BOTA)
        superel(s, (x0, 0.074, 0.098), (0.012, 0.006, 0.02), 'Podrazka', e=0.6, seg=6, rings=4, g=BOTA)

    # ---- krk a hlava (obličej z deformované koule nahuštěné do obličeje)
    trubka(s, [((0, 0.014, 1.41), 0.061, 0.056), ((0, 0.012, 1.48), 0.058, 0.054), ((0, 0.008, 1.56), 0.056, 0.054)],
           12, 'Kuze', ['Hrudnik', 'Krk', 'Hlava'], kroky=2, cap=(0.4, 0.4))
    HLAVA = ['Hlava']
    TH = hustota(39, (-math.pi, math.pi), 0.0, 0.65, 2.8)[:-1]
    FI = hustota(34, (-math.pi / 2, math.pi / 2), -0.30, 0.42, 3.2)[1:-1]
    sit_h = Sit()
    rady = [[sit_h.bod(HS + tvar_hlavy(th, fi), HLAVA) for th in TH] for fi in FI]
    nt = len(TH)
    for j in range(len(FI) - 1):
        for k in range(nt):
            q = (rady[j][k], rady[j][(k + 1) % nt], rady[j + 1][(k + 1) % nt], rady[j + 1][k])
            c = sum((sit_h.v[i] for i in q), Vector()) / 4 - HS
            sit_h.plocha(q, 'Rty' if je_ret(c) else 'Kuze')
    dno = sit_h.bod(HS + tvar_hlavy(0, -math.pi / 2), HLAVA)
    vrch = sit_h.bod(HS + tvar_hlavy(0, math.pi / 2), HLAVA)
    for k in range(nt):
        sit_h.plocha((dno, rady[0][(k + 1) % nt], rady[0][k]), 'Kuze')
        sit_h.plocha((vrch, rady[-1][k], rady[-1][(k + 1) % nt]), 'Kuze')
    # orientace ven, pak BVH pro umístění očí, obočí a vlasů
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in sit_h.v]
    for f in sit_h.f:
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.faces.ensure_lookup_table()
    obraceno = bm.faces[0].normal.dot(bm.faces[0].calc_center_median() - HS) < 0
    strom = BVHTree.FromBMesh(bm)
    bm.free()
    zakl = len(s.v)
    for v, g in zip(sit_h.v, sit_h.g):
        s.bod(v, g)
    for f, m, u in zip(sit_h.f, sit_h.m, sit_h.uv):
        s.plocha(tuple(zakl + i for i in f), m, u)

    def na_hlave(x, z, ven=0.0):
        hit, nrm, _, _ = strom.ray_cast(Vector((x, -0.3, z)), Vector((0, 1, 0)))
        return hit + Vector((0, -ven, 0))

    for sx in (1, -1):
        # oko: bělmo, duhovka, zornice, víčka s řasami
        pov = na_hlave(0.032 * sx, HS.z + 0.006)
        st_oka = Vector((0.032 * sx, pov.y + 0.0105, HS.z + 0.006))
        superel(s, st_oka, (0.0118, 0.0118, 0.0118), 'Oci', seg=12, rings=8, g=HLAVA)
        superel(s, st_oka + Vector((0, -0.0108, 0)), (0.0056, 0.0016, 0.0056), 'Duhovka', seg=10, rings=4, g=HLAVA)
        superel(s, st_oka + Vector((0, -0.0122, 0)), (0.0024, 0.0007, 0.0024), 'Zornice', seg=8, rings=3, g=HLAVA)

        def vicko(dz, dy, r, mat):
            body = []
            for t in (-1.0, -0.5, 0.0, 0.5, 1.0):
                body.append((st_oka + Vector((0.0125 * t * sx, -dy * (1 - 0.55 * t * t), dz * (1 - 0.75 * t * t))),
                             r, r))
            trubka(s, body, 5, mat, HLAVA, kroky=1, cap=(0.5, 0.5))
        vicko(0.0088, 0.0072, 0.0031, 'Kuze')
        vicko(0.0062, 0.0102, 0.0011, 'Vlasy')
        vicko(-0.0085, 0.0082, 0.0019, 'Kuze')
        # obočí
        obr = [na_hlave(x * sx, HS.z + z) for x, z in ((0.013, 0.0215), (0.025, 0.026), (0.038, 0.027),
                                                          (0.050, 0.0225), (0.057, 0.017))]
        prouzek_na(s, strom, [p + Vector((0, -0.1, 0)) for p in obr], (0, 1, 0), 0.0052, 'Vlasy', 0.0013, g=HLAVA)
        # ucho (boltec + lem)
        R = rot(z=-14 * sx)
        st_ucha = Vector((0.0755 * sx, 0.010, HS.z - 0.004))
        superel(s, st_ucha, (0.008, 0.019, 0.031), 'Kuze', e=0.9, seg=10, rings=8, R=R, g=HLAVA)
        body = [((0.0, -0.004, 0.029), 0.0042, 0.0042), ((0.0, 0.014, 0.022), 0.0048, 0.0048),
                ((0.0, 0.02, 0.0), 0.0048, 0.0048), ((0.0, 0.01, -0.024), 0.0055, 0.0055)]
        trubka(s, [(st_ucha + R @ Vector((0.0055 * sx, y, z)), r1, r2) for (_, y, z), r1, r2 in body], 6, 'Kuze',
               HLAVA, kroky=2)

    # ---- vlasy: slupka nad lebkou; k vlasové linii se ztenčí na nulu, nahoře objem a ofina
    def linie(th):
        a = abs(th)
        tab = [(0.0, 0.066), (0.3, 0.068), (0.55, 0.072), (0.8, 0.058), (0.98, 0.03), (1.06, -0.006),
               (1.14, -0.006), (1.22, 0.025), (1.55, 0.034), (1.8, 0.004), (2.3, -0.035), (math.pi, -0.06)]
        for (a0, z0), (a1, z1) in zip(tab, tab[1:]):
            if a <= a1:
                return z0 + (z1 - z0) * (a - a0) / (a1 - a0)
        return tab[-1][1]

    VT = hustota(33, (-math.pi, math.pi), 0.0, 1.0, 1.0)[:-1]
    TV = [0.0, 0.025, 0.06, 0.11, 0.18, 0.27, 0.38, 0.5, 0.63, 0.76, 0.88]   # řady od vlasové linie k temeni
    sit_v = Sit()
    vr = []

    def tloustka(th, z):
        return 0.003 + 0.011 * smooth(0.02, 0.10, z) + 0.005 * max(0.0, math.cos(th)) * smooth(0.06, 0.10, z)
    for t in TV:
        rada = []
        for th in VT:
            z = linie(th) + (HR[2] - linie(th)) * t
            fi = math.asin(max(-1.0, min(1.0, z / HR[2])))
            p = HS + tvar_hlavy(th, fi)
            smer = (p - HS).normalized()
            k = smooth(0.0, 0.2, t)
            tl = tloustka(th, z) + 0.0025 * noise.noise(smer * 6 + Vector((3, 1, 2)))
            p = p + smer * k * tl
            if math.cos(th) > 0.3 and z > 0.07:                      # ofina sčesaná nahoru a do strany
                p += Vector((-0.004, -0.002, 0.005)) * k * smooth(0.07, 0.10, z)
            rada.append(sit_v.bod(p, HLAVA))
        vr.append(rada)
    nv = len(VT)
    for j in range(len(TV) - 1):
        for k in range(nv):
            k2 = (k + 1) % nv
            q = (vr[j][k], vr[j][k2], vr[j + 1][k2], vr[j + 1][k])
            u0, u1 = k / nv * 6, (k + 1) / nv * 6
            sit_v.plocha(q, 'Vlasy', [(u0, TV[j] * 3), (u1, TV[j] * 3), (u1, TV[j + 1] * 3), (u0, TV[j + 1] * 3)])
    vrch = sit_v.bod(HS + tvar_hlavy(0, math.pi / 2) + Vector((0, 0, tloustka(0, HR[2]))), HLAVA)
    for k in range(nv):
        sit_v.plocha((vr[-1][k], vr[-1][(k + 1) % nv], vrch), 'Vlasy', [(k / nv * 6, 2.64), ((k + 1) / nv * 6, 2.64), (k / nv * 6, 3.0)])
    zakl = len(s.v)
    for v, g in zip(sit_v.v, sit_v.g):
        s.bod(v, g)
    for f, m, u in zip(sit_v.f, sit_v.m, sit_v.uv):
        s.plocha(tuple(zakl + i for i in f), m, u)

    # ---- jednotné normály (vše uzavřené kromě slupky vlasů – ta se otočí ven zvlášť)
    ob = s.objekt('PostavaTelo', prepocet=True)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    mats = [m.name for m in ob.data.materials]
    for f in bm.faces:
        if mats[f.material_index] == 'Vlasy':
            c = f.calc_center_median()
            if (c - HS).length > 0.06 and f.normal.dot(c - HS) < 0:
                f.normal_flip()
    bm.to_mesh(ob.data)
    bm.free()

    # ---- detaily přilepené na povrch (zip, kapsy, švy, kapsy džínů)
    bvh = bvh_trup                                     # jen džíny a trup – paprsky netrefí ruce
    D = Sit()
    TRUP = ['Panev', 'Pater', 'Hrudnik']
    prouzek_na(D, bvh, [(0, -0.4, z) for z in np.linspace(0.935, 1.445, 12)], (0, 1, 0), 0.011, 'Zip', 0.0022, g=TRUP)
    superel(D, (0.0, -0.127, 1.395), (0.006, 0.004, 0.014), 'Zip', e=0.6, seg=6, rings=4, g=['Hrudnik'])
    for sx in (1, -1):
        prouzek_na(D, bvh, [(sx * (0.065 + 0.07 * t), -0.4, 1.0 + 0.13 * t) for t in np.linspace(0, 1, 6)],
                   (0, 1, 0), 0.016, 'MikinaLem', 0.003, g=TRUP)
        st = 'L' if sx > 0 else 'R'
        NOHA = ['Panev', 'Stehno.' + st, 'Lytko.' + st]
        # boční šev nohavice
        prouzek_na(D, bvh, [(0.4 * sx, -0.004, z) for z in np.linspace(0.93, 0.085, 16)], (-sx, 0, 0), 0.004,
                   'Steh', 0.0012, g=NOHA)
        # zadní kapsa: záplata + prošití
        nalepka_na(D, bvh, (0.085 * sx, 0.3, 0.86), (0, -1, 0), (sx, 0, 0),
                   [(-0.06, 0.06), (0.06, 0.06), (0.055, -0.03), (0.0, -0.06), (-0.055, -0.03)],
                   'Dziny', 0.0022, kruhy=(1.0,), hladke=1, g=['Panev', 'Stehno.' + st])
        prouzek_na(D, bvh, [(sx * (0.085 + x), 0.3, z) for x, z in ((-0.052, 0.912), (-0.048, 0.835), (0, 0.808),
                                                                     (0.048, 0.835), (0.052, 0.912))],
                   (0, -1, 0), 0.0025, 'Steh', 0.0034, g=['Panev', 'Stehno.' + st])
        # přední kapsa (oblouk) a poklopec
        prouzek_na(D, bvh, [(sx * (0.085 + 0.07 * t), -0.4, 0.918 - 0.065 * t ** 0.6) for t in np.linspace(0, 1, 6)],
                   (0, 1, 0), 0.003, 'Steh', 0.0015, g=['Panev', 'Stehno.' + st])
    prouzek_na(D, bvh, [(0.028 * math.sin(a), -0.4, 0.93 - 0.075 * (1 - math.cos(a)) if a > 0 else 0.93)
                        for a in [0.0, 0.6, 1.1, 1.57]] + [(0.0, -0.4, 0.83)], (0, 1, 0), 0.0028, 'Steh',
               0.0015, g=['Panev'])
    det = D.objekt('_det', prepocet=False)
    for v, g in zip(D.v, D.g):
        s.g.append(g)
    # spojit detaily s tělem (jeden mesh = jeden SkinnedMesh)
    with bpy.context.temp_override(active_object=ob, selected_editable_objects=[ob, det]):
        bpy.ops.object.join()
    hladit(ob, None, False)
    return ob, s.g


def vahy(ob, znacky, kostra):
    """Váhy podle vzdálenosti od úseček kostí; kandidáti podle dílu a strany těla."""
    kosti = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in kostra.data.bones}
    for jm in kosti:
        ob.vertex_groups.new(name=jm)

    def vzd(p, a, b):
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        return (p - (a + ab * t)).length
    for i, v in enumerate(ob.data.vertices):
        kand = znacky[i] or ['Panev']
        p = v.co
        ws = []
        for jm in kand:
            if jm.endswith('.L') and p.x < -0.015:
                continue
            if jm.endswith('.R') and p.x > 0.015:
                continue
            d = vzd(p, *kosti[jm])
            ws.append((1.0 / (d + 0.015) ** 6, jm))
        if not ws:
            ws = [(1.0, kand[0])]
        ws.sort(reverse=True)
        ws = ws[:3]
        suma = sum(w for w, _ in ws)
        for w, jm in ws:
            if w / suma > 0.02:
                ob.vertex_groups[jm].add([i], w / suma, 'REPLACE')


def postav_kostru():
    kd = bpy.data.armatures.new('PostavaKostra')
    kostra = bpy.data.objects.new('Postava', kd)
    scena.collection.objects.link(kostra)
    bpy.context.view_layer.objects.active = kostra
    bpy.ops.object.mode_set(mode='EDIT')
    for jm, (h, t, _) in KOSTI.items():
        eb = kd.edit_bones.new(jm)
        eb.head, eb.tail, eb.roll = h, t, 0.0
    for jm, (_, _, rod) in KOSTI.items():
        if rod:
            kd.edit_bones[jm].parent = kd.edit_bones[rod]
            kd.edit_bones[jm].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return kostra


# ------------------------------------------------------------------------ animace (pózy + IK nohou)
def Rx(a):
    return Quaternion((1, 0, 0), math.radians(a))


def Ry(a):
    return Quaternion((0, 1, 0), math.radians(a))


def Rz(a):
    return Quaternion((0, 0, 1), math.radians(a))


REST = {jm: (Vector(h), Vector(t)) for jm, (h, t, _) in KOSTI.items()}
RODIC = {jm: r for jm, (_, _, r) in KOSTI.items()}
PATA = Vector((0, 0.07, 0.0))             # bod paty na zemi (vůči kotníku se počítá zvlášť pro stranu)
PRSTY = Vector((0, -0.115, 0.0))          # bříško chodidla na zemi


def poza(P):
    """Skalární parametry pózy → (světové rotace kostí W, posun pánve).
    Nohy se řeší IK: chodidlo dáno posunem dy, zdvihem a sklonem (kladný = pata nahoru, otáčí se kolem bříška;
    záporný = špička nahoru, otáčí se kolem paty)."""
    g = lambda k, d=0.0: P.get(k, d)
    W = {}
    posun = Vector((g('px'), g('py'), g('pz')))
    W['Panev'] = Rz(g('yaw')) @ Ry(g('list')) @ Rx(g('nakl'))
    W['Pater'] = Rz(g('yaw') * 0.3) @ Rx(g('nakl') + g('predklon') * 0.5)
    W['Hrudnik'] = Rz(g('hrud_yaw')) @ Ry(-g('list') * 0.3) @ Rx(g('nakl') + g('predklon'))
    W['Krk'] = Rz(g('hrud_yaw') * 0.4) @ Rx(g('predklon') * 0.4 + g('kyv') * 0.5)
    W['Hlava'] = Rz(g('hlava_yaw')) @ Ry(g('hlava_roll')) @ Rx(g('kyv'))
    for st, sx in (('L', 1), ('R', -1)):
        W['Klicni.' + st] = W['Hrudnik'] @ Rz(g('klic_' + st) * sx) @ Ry(-g('kraceni_' + st) * sx)
        Wr = W['Hrudnik'] @ Rx(g('paze_' + st)) @ Ry(-g('odtah_' + st, 4) * sx)
        W['Rameno.' + st] = Wr
        W['Predlokti.' + st] = Wr @ Rx(-g('loket_' + st, 10)) @ Rz(-g('rotace_' + st) * sx)
        W['Ruka.' + st] = W['Predlokti.' + st] @ Rx(-g('zapesti_' + st))
    # světová poloha hlavy kosti podle FK
    poloha = {}

    def hlava_kosti(jm):
        if jm in poloha:
            return poloha[jm]
        rod = RODIC[jm]
        if rod is None:
            p = REST[jm][0] + posun
        else:
            p = hlava_kosti(rod) + W[rod] @ (REST[jm][0] - REST[rod][0])
        poloha[jm] = p
        return p
    for st, sx in (('L', 1), ('R', -1)):
        H = hlava_kosti('Stehno.' + st)
        A0 = REST['Chodidlo.' + st][0]
        fi = g('chod_' + st)
        if fi >= 0:
            piv0 = Vector((A0.x, PRSTY.y, 0.0))
        else:
            piv0 = Vector((A0.x, PATA.y, 0.0))
        piv = piv0 + Vector((0, g('dy_' + st), g('zdvih_' + st)))
        A = piv + Rx(fi) @ (A0 - piv0)
        L1 = (REST['Stehno.' + st][1] - REST['Stehno.' + st][0]).length
        L2 = (REST['Lytko.' + st][1] - REST['Lytko.' + st][0]).length
        HA = A - H
        d = min(HA.length, (L1 + L2) * 0.9995)
        u = HA.normalized()
        a = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
        b = math.sqrt(max(L1 * L1 - a * a, 0.0))
        pol = Vector((0.06 * sx, -1, 0))
        w = (pol - u * pol.dot(u)).normalized()
        K = H + u * a + w * b
        A = H + u * d
        W['Stehno.' + st] = (REST['Stehno.' + st][1] - REST['Stehno.' + st][0]).rotation_difference(K - H)
        W['Lytko.' + st] = (REST['Lytko.' + st][1] - REST['Lytko.' + st][0]).rotation_difference(A - K)
        W['Chodidlo.' + st] = Rx(fi)
        W['Spicka.' + st] = Rx(g('spicka_' + st, fi if fi < 0 else 0.0))
    return W, posun


def akce_z_poz(kostra, jmeno, snimky):
    """snimky: [(snímek, parametry)] → akce s klíči rotace a polohy všech kostí v každém snímku."""
    kostra.animation_data.action = None
    pred = {}
    for snimek, P in snimky:
        W, posun = poza(P)
        for pb in kostra.pose.bones:
            jm = pb.name
            q_rest = pb.bone.matrix_local.to_quaternion()
            rod = RODIC[jm]
            rel = W[jm] if rod is None else W[rod].inverted() @ W[jm]
            q = q_rest.inverted() @ rel @ q_rest
            if jm in pred and pred[jm].dot(q) < 0:
                q.negate()
            pred[jm] = q
            pb.rotation_quaternion = q
            pb.location = q_rest.inverted() @ posun if rod is None else Vector()
            pb.keyframe_insert('rotation_quaternion', frame=snimek)
            pb.keyframe_insert('location', frame=snimek)
    a = kostra.animation_data.action
    a.name = jmeno
    a.use_fake_user = True
    for fc in a.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = 'LINEAR'
    return a


def krok_nohy(p, beta, delka, y_dopad, zdvih, fi_dopad, fi_odraz, vrchol=0.35):
    """Fáze nohy p∈[0,1) (0 = dopad paty) → (dy, zdvih, sklon, sklon_špičky).
    Na zemi se chodidlo sune dozadu stálou rychlostí: pata → celé chodidlo → bříško (odvalení)."""
    if p < beta:
        s = p / beta
        dy = y_dopad + delka * beta * s
        if s < 0.14:                                  # dopad na patu, špička klesá
            fi = fi_dopad * (1 - smooth(0.0, 0.14, s))
        elif s < 0.55:
            fi = 0.0
        else:                                         # pata se zvedá, odvaluje se přes bříško
            fi = fi_odraz * smooth(0.55, 1.0, s) ** 1.3
        sp = 0.0 if fi >= 0 else fi
        return dy, 0.0, fi, sp
    s = (p - beta) / (1 - beta)                       # švih: z polohy odrazu do dalšího dopadu
    y0, y1 = y_dopad + delka * beta, y_dopad
    e = 0.5 - 0.5 * math.cos(math.pi * s)
    dy = y0 + (y1 - y0) * (0.35 * s + 0.65 * e)
    w = 0.5 * s / vrchol if s < vrchol else 0.5 + 0.5 * (s - vrchol) / (1 - vrchol)
    z = zdvih * math.sin(math.pi * w)
    fi = fi_odraz * (1 - s) ** 2 + fi_dopad * s * s + 2 * s * (1 - s) * 8
    sp = fi * 0.6 * (1 - s)
    return dy, z, fi, sp


def cyklus(snimku, rychlost, beta, y_dopad, zdvih, fi_dopad, fi_odraz, panev, ruce, trup, vrchol):
    """Chůze/běh na místě: snimku = délka cyklu (24 fps), dva kroky; vrací seznam snímků s parametry."""
    T = snimku / 24.0
    delka = rychlost * T                                # dráha jednoho chodidla za cyklus
    ven = []
    for f in range(snimku + 1):
        p = f / snimku
        P = {}
        for st, faze in (('L', p), ('R', (p + 0.5) % 1.0)):
            dy, z, fi, sp = krok_nohy(faze, beta, delka, y_dopad, zdvih, fi_dopad, fi_odraz, vrchol)
            P['dy_' + st], P['zdvih_' + st], P['chod_' + st], P['spicka_' + st] = dy, z, fi, sp
        P.update(panev(p))
        P.update(trup(p))
        P.update(ruce(p))
        ven.append((f + 1, P))
    return ven


def animace(kostra):
    for pb in kostra.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    kostra.animation_data_create()
    c2 = lambda p, faze=0.0: math.cos(2 * math.pi * (p - faze))
    s2 = lambda p, faze=0.0: math.sin(2 * math.pi * (p - faze))

    # ---- Stani: dýchání a drobné přenášení váhy, 2 s (48 snímků)
    sn = []
    for f in range(49):
        t = f / 48
        P = {'pz': -0.008 + 0.003 * s2(t), 'px': 0.008 * s2(t, 0.1), 'list': -1.2 * s2(t, 0.1),
             'nakl': 1.0, 'predklon': -2.5 * (0.5 + 0.5 * s2(t)) + 1.0, 'kyv': 1.5 * s2(t, 0.3) - 1.0,
             'hlava_yaw': 3 * s2(t, 0.2), 'hlava_roll': 1.2 * s2(t, 0.4),
             'kraceni_L': 2.5 * (0.5 + 0.5 * s2(t)), 'kraceni_R': 2.5 * (0.5 + 0.5 * s2(t)),
             'paze_L': 2 + 1.5 * s2(t, 0.15), 'paze_R': 2 + 1.5 * s2(t, 0.65), 'odtah_L': 5, 'odtah_R': 5,
             'loket_L': 12, 'loket_R': 14, 'zapesti_L': 4, 'zapesti_R': 4, 'rotace_L': 0, 'rotace_R': 0}
        for st in ('L', 'R'):
            P['dy_' + st], P['zdvih_' + st], P['chod_' + st] = 0.0, 0.0, 0.0
        sn.append((f + 1, P))
    akce_z_poz(kostra, 'Stani', sn)

    # ---- Chuze: 20 snímků = 0,833 s, dva kroky po 0,75 m (1,8 m/s)
    def panev_ch(p):
        return {'pz': -0.032 + 0.016 * math.cos(4 * math.pi * (p - 0.25)), 'px': 0.018 * s2(p, 0.02),
                'yaw': -5 * c2(p), 'list': -3.5 * s2(p, 0.05), 'nakl': 3}

    def trup_ch(p):
        return {'hrud_yaw': 6 * c2(p), 'predklon': 2, 'kyv': 0.5 + 1.5 * math.cos(4 * math.pi * (p - 0.1)),
                'hlava_yaw': 1.5 * c2(p)}

    def ruce_ch(p):
        P = {}
        for st, sgn in (('L', 1), ('R', -1)):
            sw = 19 * c2(p) * sgn                       # levá paže vzad, když je levá noha vpředu
            P.update({'paze_' + st: sw + 2, 'odtah_' + st: 6, 'loket_' + st: 16 + 14 * max(0.0, -sw / 19),
                      'zapesti_' + st: 6, 'klic_' + st: -2.5 * sw / 19, 'rotace_' + st: 8})
        return P
    akce_z_poz(kostra, 'Chuze', cyklus(20, 1.8, 0.60, -0.31, 0.075, -16, 38, panev_ch, ruce_ch, trup_ch, 0.3))

    # ---- Beh: 17 snímků = 0,708 s, 5,5 m/s, předklon, pokrčené lokty
    def panev_b(p):
        return {'pz': -0.06 + 0.032 * math.cos(4 * math.pi * (p - 0.37)), 'px': 0.012 * s2(p, 0.05),
                'yaw': -8 * c2(p, 0.05), 'list': -3 * s2(p, 0.06), 'nakl': 7}

    def trup_b(p):
        return {'hrud_yaw': 11 * c2(p, 0.05), 'predklon': 6, 'kyv': 1 + 2 * math.cos(4 * math.pi * (p - 0.2)),
                'hlava_yaw': 2 * c2(p)}

    def ruce_b(p):
        P = {}
        for st, sgn in (('L', 1), ('R', -1)):
            sw = 38 * c2(p, 0.04) * sgn
            P.update({'paze_' + st: sw + 2, 'odtah_' + st: 10, 'loket_' + st: 82 + 16 * max(0.0, -sw / 38),
                      'zapesti_' + st: 10, 'klic_' + st: -5 * sw / 38, 'kraceni_' + st: 4, 'rotace_' + st: 25})
        return P
    akce_z_poz(kostra, 'Beh', cyklus(17, 5.5, 0.24, -0.25, 0.30, -6, 48, panev_b, ruce_b, trup_b, 0.38))

    # ---- Skok: 20 snímků ≈ 0,8 s (na místě; výšku skoku řeší hra), LoopOnce
    klid = {'pz': -0.008, 'nakl': 1, 'loket_L': 12, 'loket_R': 14, 'odtah_L': 5, 'odtah_R': 5, 'paze_L': 2,
            'paze_R': 2}
    drep = {'pz': -0.15, 'py': 0.03, 'nakl': 26, 'predklon': 8, 'kyv': -4, 'paze_L': 42, 'paze_R': 42,
            'loket_L': 20, 'loket_R': 20, 'odtah_L': 8, 'odtah_R': 8, 'zapesti_L': 10, 'zapesti_R': 10}
    odraz = {'pz': 0.03, 'nakl': -2, 'predklon': -4, 'kyv': 4, 'chod_L': 38, 'chod_R': 38, 'paze_L': -150,
             'paze_R': -150, 'loket_L': 15, 'loket_R': 15, 'odtah_L': 14, 'odtah_R': 14}
    vzduch = {'pz': 0.0, 'nakl': 6, 'predklon': 4, 'kyv': -4, 'dy_L': -0.12, 'zdvih_L': 0.26, 'chod_L': 12,
              'dy_R': -0.02, 'zdvih_R': 0.20, 'chod_R': 22, 'paze_L': -110, 'paze_R': -110, 'loket_L': 30,
              'loket_R': 30, 'odtah_L': 22, 'odtah_R': 22}
    dopad = {'pz': -0.10, 'py': 0.02, 'nakl': 18, 'predklon': 6, 'kyv': -2, 'paze_L': -35, 'paze_R': -35,
             'loket_L': 30, 'loket_R': 30, 'odtah_L': 18, 'odtah_R': 18}
    klice = [(1, klid), (4, drep), (7, odraz), (11, vzduch), (15, dopad), (20, klid)]
    nazvy = set(k for _, P in klice for k in P)

    def hodnota(P, k):
        if k in P:
            return P[k]
        return {'loket_L': 10, 'loket_R': 10, 'odtah_L': 4, 'odtah_R': 4}.get(k, 0.0)
    sn = []
    for f in range(1, 21):
        i = max(j for j in range(len(klice)) if klice[j][0] <= f)
        j = min(i + 1, len(klice) - 1)
        t = 0.0 if i == j else (f - klice[i][0]) / (klice[j][0] - klice[i][0])
        i0, j1 = max(i - 1, 0), min(j + 1, len(klice) - 1)
        P = {}
        for k in nazvy:
            a, b, c, d = (hodnota(klice[x][1], k) for x in (i0, i, j, j1))
            P[k] = 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t ** 3)
        sn.append((f, P))
    akce_z_poz(kostra, 'Skok', sn)
    kostra.animation_data.action = bpy.data.actions['Stani']


def postav_celou_postavu():
    kostra = postav_kostru()
    telo, znacky = postav_postavu()
    vahy(telo, znacky, kostra)
    telo.parent = kostra
    mod = telo.modifiers.new('Kostra', 'ARMATURE')
    mod.object = kostra
    animace(kostra)
    print('POSTAVA trojúhelníků:', trojuhelniky(telo))
    return [kostra, telo]


POSTAVA = postav_celou_postavu() if 'postava' in MODELY else None


# ======================================================================== AUTO
def postav_auto():
    # --- textura dezénu pneumatiky (normálová mapa, u = obvod, v = šířka běhounu)
    W, H = 512, 64
    u = np.linspace(0, 1, W, endpoint=False)[None, :]
    v = np.linspace(0, 1, H, endpoint=False)[:, None]
    bloky = 32
    faze = (u * bloky + 0.5 * (v > 0.5)) % 1.0
    drazka_pricna = (faze < 0.16) & ((v < 0.36) | (v > 0.64))           # příčné drážky na ramenech
    sik = ((u * bloky * 2 + v * 3.0) % 1.0) < 0.10                       # šikmé lamely uprostřed
    stred = (v > 0.40) & (v < 0.60)
    vys = np.ones((H, W))
    vys[np.broadcast_to(drazka_pricna, vys.shape)] = 0.0
    vys[np.broadcast_to(stred & sik, vys.shape)] = 0.35
    vys[np.broadcast_to((np.abs(v - 0.38) < 0.03) | (np.abs(v - 0.62) < 0.03), vys.shape)] = 0.0      # podélné drážky
    vys[np.broadcast_to(v > 0.88, vys.shape)] = 1.0                     # rovný pás pro boky pneu
    dezen = obrazek('dezen', normalova_mapa(vys, 2.5), data=True)

    material('Lak', os.environ.get('BARVA_LAKU', '#c8322b'), 0.3, 0.4, lak=0.6)
    material('Sklo', '#1a2530', 0.05, 0.0, alfa=0.3)
    material('Svetla', '#f4f3ee', 0.1, 0.0, zar='#fffbea', sila=1.0)
    material('Koncova', '#a3141b', 0.2, 0.0, zar='#a00a0a', sila=0.35)
    material('Brzdova', '#b8121a', 0.2, 0.0)
    material('Couvaci', '#e9e9e6', 0.15, 0.0)
    material('Plast', '#1d1e21', 0.75)
    material('Lesk', '#0b0c0e', 0.18)
    material('Chrom', '#d8dbe0', 0.12, 1.0)
    material('Pneu', '#1c1c1e', 0.88, normal_tex=dezen, normal_sila=1.0)
    material('Disk', '#b5b9bf', 0.28, 0.85)
    material('Kotouc', '#6e7074', 0.45, 0.8)
    material('Interier', '#2c2e32', 0.8)
    material('Sedacky', '#3a3c42', 0.95)
    material('Strop', '#8f8c86', 0.95)
    material('Displej', '#10202e', 0.25, 0.0, zar='#2f6f9e', sila=0.6)
    material('SPZ', '#f2f2ee', 0.45)
    material('Modra', '#1d3f9a', 0.5)

    # ------------------------------------------------------------ karoserie (podélné řezy)
    ZB = pchip([(-2.16, 0.40), (-2.13, 0.30), (-2.07, 0.245), (-1.92, 0.22), (-1.65, 0.205), (-0.95, 0.19),
                (0.95, 0.19), (1.65, 0.205), (1.92, 0.225), (2.07, 0.27), (2.13, 0.33), (2.16, 0.43)])
    ZS = pchip([(-2.16, 0.55), (-2.13, 0.665), (-2.08, 0.735), (-1.95, 0.775), (-1.6, 0.825), (-1.25, 0.87),
                (-0.92, 0.925), (-0.5, 0.95), (0.4, 0.97), (1.2, 0.995), (1.7, 1.005), (1.95, 0.985),
                (2.07, 0.95), (2.13, 0.90), (2.16, 0.80)])
    ZT = pchip([(-2.16, 0.56), (-2.13, 0.685), (-2.08, 0.765), (-1.95, 0.815), (-1.6, 0.87), (-1.25, 0.915),
                (-0.92, 0.955), (-0.5, 0.965), (0.4, 0.98), (1.2, 1.005), (1.7, 1.02), (1.95, 1.005),
                (2.07, 0.97), (2.13, 0.915), (2.16, 0.81)])
    HW = pchip([(-2.16, 0.50), (-2.145, 0.68), (-2.11, 0.78), (-2.04, 0.835), (-1.92, 0.855), (-1.7, 0.882),
                (-1.3, 0.894), (-0.95, 0.884), (-0.5, 0.878), (0.6, 0.880), (0.95, 0.888), (1.3, 0.898),
                (1.62, 0.893), (1.88, 0.872), (2.03, 0.835), (2.11, 0.77), (2.145, 0.66), (2.16, 0.56)])

    def profil(y):
        zb, zs, zt, hw = ZB(y), ZS(y), ZT(y), HW(y)
        h = zs - zb
        s = min(1.0, h / 0.5)
        pul = [(0.0, zb), (hw * 0.45, zb), (hw - 0.12 * s, zb + 0.002),
               (hw - 0.06 * s, zb + 0.016 * s), (hw - 0.03 * s, zb + 0.05 * s)]
        for f, dx in ((0.20, 0.012), (0.40, 0.003), (0.56, 0.0), (0.70, 0.004), (0.785, 0.007),
                      (0.825, 0.002), (0.87, 0.017)):
            pul.append((hw - dx * s, zb + f * h))
        pul += [(hw - 0.042 * s, zb + 0.955 * h), (hw - 0.075 * s, zs)]
        xe = hw - 0.075 * s
        for f in (0.72, 0.45, 0.2):
            pul.append((xe * f, zs + (zt - zs) * (1 - f * f)))
        pul.append((0.0, zt))
        return pul

    def smycka(pul):
        return pul + [(-x, z) for x, z in reversed(pul[1:-1])]

    ys = [-2.16, -2.155, -2.145, -2.13, -2.11, -2.085, -2.055, -2.02, -1.98, -1.93, -1.87, -1.80, -1.72]
    ys += [-1.63 + 3.26 * k / 25 for k in range(26)]
    ys += [-y for y in reversed(ys[:13])]
    s = Sit()
    idx = [[s.bod((x, y, z)) for x, z in smycka(profil(y))] for y in ys]
    n = len(idx[0])
    for i in range(len(idx) - 1):
        for j in range(n):
            q = (idx[i][j], idx[i][(j + 1) % n], idx[i + 1][(j + 1) % n], idx[i + 1][j])
            c = sum((s.v[k] for k in q), Vector()) / 4
            s.plocha(q, 'Plast' if c.z < 0.275 else 'Lak')
    s.plocha(list(reversed(idx[0])), 'Lak')
    s.plocha(idx[-1], 'Lak')
    karoserie = s.objekt('Karoserie')

    def kvadr_obj(x0, x1, y0, y1, z0, z1, mat):
        s = Sit()
        superel(s, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), ((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2),
                mat, e=0.12, seg=16, rings=8)
        return s.objekt('_rez')

    def valec_obj(stred, r, x0, x1, mat, seg=40):
        s = Sit()
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=x1 - x0)
        for v in bm.verts:
            v.co = Vector(((x0 + x1) / 2 + v.co.z, stred[0] + v.co.x, stred[1] + v.co.y))
        s.pridej_bm(bm, mat)
        bm.free()
        return s.objekt('_rez')

    ROZVOR, ROZCHOD, R_KOLA = 1.3, 0.8, 0.33
    rezaky = [kvadr_obj(-0.765, 0.765, -0.92, 1.86, 0.36, 1.7, 'Interier')]
    for yk in (-ROZVOR, ROZVOR):
        rezaky.append(valec_obj((yk, R_KOLA), 0.372, 0.58, 1.2, 'Plast'))
        rezaky.append(valec_obj((yk, R_KOLA), 0.372, -1.2, -0.58, 'Plast'))
    for rz in rezaky:
        m = karoserie.modifiers.new('B', 'BOOLEAN')
        m.operation, m.solver, m.object = 'DIFFERENCE', 'EXACT', rz
        m.material_mode = 'TRANSFER'
        aplikuj_mod(karoserie, m)
    for rz in rezaky:
        bpy.data.objects.remove(rz)
    hladit(karoserie, 40)

    # ------------------------------------------------------------ prosklená kabina
    ZR = pchip([(-0.92, ZS(-0.92)), (-0.65, 1.035), (-0.4, 1.155), (-0.15, 1.275), (0.02, 1.352), (0.18, 1.396),
                (0.45, 1.422), (0.8, 1.428), (1.15, 1.422), (1.42, 1.408), (1.55, 1.387), (1.63, 1.34),
                (1.72, 1.25), (1.82, 1.13), (1.92, ZS(1.92))])

    def profil_skla(y):
        zg, zr = ZS(y) - 0.004, ZR(y)
        h = max(zr - zg, 0.0)
        xg = HW(y) - 0.075
        xr = xg - 0.15 * min(1.0, h / 0.45)
        rc = min(0.075, h * 0.4)
        crown = (ZT(y) - ZS(y)) * (1 - min(1.0, h / 0.2)) + 0.022 * min(1.0, h / 0.3)
        pul = []
        for t in (0.0, 0.36, 0.7):
            pul.append((xg + (xr - xg) * t + 0.014 * math.sin(math.pi * t) * min(1, h / 0.3),
                        zg + (zr - rc - zg) * t))
        pul.append((xr, zr - rc))
        for a in (30, 60):
            pul.append((xr - rc + rc * math.cos(math.radians(a)), zr - rc + rc * math.sin(math.radians(a))))
        pul += [(xr - rc, zr), ((xr - rc) * 0.5, zr + crown * 0.75), (0.0, zr + crown)]
        return pul + [(-x, z) for x, z in reversed(pul[:-1])]       # 17 bodů, otevřený dole

    YS = [-0.92, -0.88, -0.82, -0.74, -0.64, -0.54, -0.44, -0.34, -0.24, -0.14, -0.07, -0.01, 0.07, 0.17,
          0.28, 0.40, 0.50, 0.56, 0.60, 0.66, 0.76, 0.88, 1.0, 1.12, 1.24, 1.32, 1.40, 1.48, 1.55, 1.58,
          1.64, 1.72, 1.82, 1.92]

    def mat_skla(j, c):
        y = c.y
        if j in (0, 1, 2, 13, 14, 15):                       # boky
            if 0.56 < y < 0.66:
                return 'Lesk'                                 # B-sloupek
            if y > 1.32 or y < -0.82:
                return 'Lak'
            return 'Sklo'
        if j in (3, 12):
            return 'Lesk' if -0.82 < y < 1.32 else 'Lak'      # černý rámeček nad okny
        if j in (4, 5, 10, 11):
            return 'Lak'
        if y < -0.11:
            return 'Sklo'
        if y < -0.04:
            return 'Lesk'
        if y < 1.55:
            return 'Lak'
        if y < 1.57:
            return 'Lesk'
        return 'Sklo'

    s_lak, s_sklo = Sit(), Sit()
    rady = [[Vector((x, y, z)) for x, z in profil_skla(y)] for y in YS]
    for i in range(len(rady) - 1):
        for j in range(16):
            q = [rady[i][j], rady[i][j + 1], rady[i + 1][j + 1], rady[i + 1][j]]
            c = sum(q, Vector()) / 4
            mat = mat_skla(j, c)
            cil = s_lak if mat != 'Sklo' else s_sklo
            cil.plocha([cil.bod(p) for p in q], mat)

    def svar(ob):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
        for f in bm.faces:                                # normály ven (od středu kabiny)
            f.normal_update()
            if f.normal.dot(f.calc_center_median() - Vector((0, 0.5, 0.9))) < 0:
                f.normal_flip()
        bm.to_mesh(ob.data)
        bm.free()

    strecha = s_lak.objekt('Strecha', prepocet=False)
    svar(strecha)
    n0 = len(strecha.data.materials)
    for _ in range(n0):
        strecha.data.materials.append(M['Strop'])     # vnitřní strana střechy a sloupků = čalounění
    m = strecha.modifiers.new('S', 'SOLIDIFY')
    m.thickness, m.offset, m.use_rim, m.use_even_offset = 0.028, -1, True, True
    m.material_offset = n0
    m.material_offset_rim = m.material_offset
    aplikuj_mod(strecha, m)
    hladit(strecha, 50)
    okna = s_sklo.objekt('Okna', prepocet=False)
    svar(okna)
    hladit(okna, 30)

    # ------------------------------------------------------------ nálepky a detaily na povrchu
    deps = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(karoserie, deps)
    bvh_s = BVHTree.FromObject(strecha, deps)
    DET = Sit()

    def nalepka(*args, strom=None, **kw):
        nalepka_na(DET, strom or bvh, *args, **kw)

    def prouzek(*args, strom=None, **kw):
        prouzek_na(DET, strom or bvh, *args, **kw)

    def paprsek(p, d, strom=None):
        return paprsek_na(p, d, strom or bvh)

    for sx in (1, -1):
        L = sx
        # přední světlomet: černé pouzdro, LED pásek, dva projektory; obtočený přes roh (+u = ven)
        d = Vector((-0.55 * sx, 1, -0.12))
        P = Vector((0.62 * sx, -2.0, 0.70))
        U = (sx, 0, 0.12)
        nalepka(P, d, U, [(-0.22, -0.028), (0.12, -0.045), (0.215, -0.02), (0.225, 0.035), (0.05, 0.05),
                          (-0.22, 0.03)], 'Lesk', 0.004, kruhy=(1.0, 0.5))
        nalepka(P, d, U, [(-0.20, -0.021), (0.12, -0.036), (0.20, -0.013), (0.19, -0.003), (0.11, -0.023),
                          (-0.20, -0.010)], 'Svetla', 0.0075, okraj=False, kruhy=(1.0,))
        for x in (-0.10, 0.04):
            nalepka(P + Vector((x * sx, 0, 0.018)), d, U, kruh(0.027, 12), 'Chrom', 0.0075, okraj=False)
            nalepka(P + Vector((x * sx, 0, 0.018)), d, U, kruh(0.016, 10), 'Svetla', 0.0095, okraj=False,
                    kruhy=(1.0,))
        # mlhovka v nárazníku
        nalepka(Vector((0.66 * sx, -2.0, 0.40)), Vector((-0.4 * sx, 1, 0)), (sx, 0, 0),
                obdelnik(0.07, 0.03, 0.5), 'Lesk', 0.003)
        nalepka(Vector((0.66 * sx, -2.0, 0.40)), Vector((-0.4 * sx, 1, 0)), (sx, 0, 0),
                kruh(0.025), 'Chrom', 0.006, okraj=False)
        # zadní svítilna obtočená kolem rohu: pouzdro, obrysová, brzdová, couvací (+u = ven)
        d = Vector((-0.6 * sx, -1, 0))
        P = Vector((0.70 * sx, 2.05, 0.915))
        U = (sx, 0, 0)
        tvar = [(-0.20, -0.03), (0.12, -0.05), (0.21, -0.03), (0.21, 0.045), (-0.20, 0.04)]
        nalepka(P, d, U, tvar, 'Lesk', 0.004, kruhy=(1.0, 0.5))
        nalepka(P, d, U, [(x * 0.93, y * 0.8) for x, y in tvar], 'Koncova', 0.0065, okraj=False, kruhy=(1.0, 0.5))
        nalepka(P + Vector((0, 0, 0.006)), d, U, [(x * 0.85, y * 0.3) for x, y in tvar], 'Brzdova', 0.0085,
                okraj=False, kruhy=(1.0,))
        nalepka(P + Vector((-0.15 * sx, 0, -0.016)), d, U, obdelnik(0.03, 0.013, 0.4), 'Couvaci', 0.0088,
                okraj=False, kruhy=(1.0,))
        # odrazka v zadním nárazníku
        nalepka(Vector((0.72 * sx, 2.1, 0.43)), Vector((-0.5 * sx, -1, 0)), (-sx, 0, 0),
                obdelnik(0.06, 0.011, 0.5), 'Koncova', 0.003)
        # spáry dveří, kapoty a víka
        ven = (-sx, 0, 0)

        def bok(body):
            return [(1.2 * sx, y, z) for y, z in body]
        prouzek(bok([(-0.835, 0.925), (-0.845, 0.80), (-0.86, 0.60), (-0.87, 0.40), (-0.87, 0.28)]),
                ven, 0.0045, 'Lesk')
        prouzek(bok([(0.605, 0.95), (0.60, 0.80), (0.595, 0.60), (0.59, 0.40), (0.588, 0.28)]), ven, 0.0045, 'Lesk')
        oblouk = [(1.36, 0.99), (1.33, 0.88), (1.30, 0.80)]
        for a in range(100, 181, 10):
            oblouk.append((ROZVOR + 0.43 * math.cos(math.radians(a)), R_KOLA + 0.43 * math.sin(math.radians(a))))
        oblouk.append((0.87, 0.28))
        prouzek(bok(oblouk), ven, 0.0045, 'Lesk')
        prouzek([(0.80 * sx, -1.985 + 0.0 * k, 0.9) for k in range(1)] +
                [((HW(y) - 0.10) * sx, y, 1.2) for y in (-1.97, -1.75, -1.5, -1.25, -1.0, -0.86)],
                (0, 0, -1), 0.004, 'Lesk')
        # lemy podběhů (lak, mírně vystouplé)
        for yk in (-ROZVOR, ROZVOR):
            body = [(1.2 * sx, yk + 0.392 * math.cos(math.radians(a)), R_KOLA + 0.392 * math.sin(math.radians(a)))
                    for a in range(0, 181, 9)]
            prouzek(body, ven, 0.03, 'Lak', 0.005)
        # kliky dveří s černou miskou
        for yk in (0.30, 1.16):
            hit, nrm = paprsek(Vector((1.2 * sx, yk, 0.80)), Vector(ven))
            nalepka(Vector((1.2 * sx, yk, 0.80)), Vector(ven), (0, 1, 0), obdelnik(0.075, 0.02, 0.6),
                    'Lesk', 0.0015, okraj=False)
            superel(DET, hit + nrm * 0.012, (0.012, 0.072, 0.014), 'Chrom', e=0.5, seg=10, rings=6)
        # zrcátko: patka, pouzdro v barvě vozu, sklo, blinkr
        superel(DET, (0.875 * sx, -0.66, 0.985), (0.06, 0.07, 0.022), 'Lesk', e=0.5, seg=10, rings=6)
        Rz = rot(z=-8 * sx)
        superel(DET, (0.96 * sx, -0.635, 1.03), (0.09, 0.06, 0.062), 'Lak', e=0.55, seg=14, rings=8, R=Rz)
        superel(DET, (0.966 * sx, -0.578, 1.03), (0.078, 0.006, 0.05), 'Chrom',
                e=0.4, seg=12, rings=6, R=Rz)
        superel(DET, (0.97 * sx, -0.67, 0.99), (0.06, 0.025, 0.008), 'Svetla', e=0.5, seg=8, rings=4, R=Rz)
        # lišta pod okny
        lista = [(sx * (HW(y) - 0.073), y, ZS(y) + 0.004) for y in [-0.70 + 0.1 * k for k in range(21)]]
        for a, b in zip(lista, lista[1:]):
            pass
        prouzek([(p[0] + 0.3 * sx, p[1], p[2] - 0.006) for p in lista], (-sx, 0, -0.35), 0.012, 'Chrom', 0.002)
        # stěrače vpředu
        Rs = rot(x=-62, z=4 + 6 * sx)
        superel(DET, (0.25 * sx, -0.86, 0.975), (0.24, 0.006, 0.006), 'Lesk', e=0.3, seg=6, rings=4,
                R=Rs)
    # víčko nádrže (pravý zadní blatník)
    prouzek([(-1.2, 1.62 + 0.07 * math.cos(a / 10 * 2 * math.pi), 0.80 + 0.07 * math.sin(a / 10 * 2 * math.pi))
             for a in range(11)], (1, 0, 0), 0.004, 'Lesk')
    # spára kapoty vpředu a víka kufru vzadu
    prouzek([(x, -2.6, 0.745 + 0.02 * (1 - (x / 0.8) ** 2)) for x in np.linspace(-0.62, 0.62, 13)], (0, 1, 0.9),
            0.004, 'Lesk')
    prouzek([(x, 2.6, 0.55) for x in np.linspace(-0.74, 0.74, 15)], (0, -1, 0), 0.004, 'Lesk')
    for sx in (1, -1):
        prouzek([(0.52 * sx, 2.6, z) for z in (0.55, 0.65, 0.75, 0.86)], (0, -1, 0), 0.004, 'Lesk')
    # maska: horní štěrbina s chromovou lištou, znak, velké spodní sání se žebry, SPZ
    d = Vector((0, 1, 0))
    nalepka((0, -2.1, 0.695), d, (1, 0, 0), obdelnik(0.36, 0.028, 0.6), 'Lesk', 0.003)
    nalepka((0, -2.1, 0.668), d, (1, 0, 0), obdelnik(0.36, 0.004, 0.5), 'Chrom', 0.005, okraj=False, hladke=1)
    nalepka((0, -2.1, 0.695), d, (1, 0, 0), kruh(0.042, 14), 'Chrom', 0.009)
    nalepka((0, -2.1, 0.695), d, (1, 0, 0), kruh(0.032, 14), 'Modra', 0.0105, okraj=False)
    nalepka((0, -2.1, 0.44), d, (1, 0, 0), [(-0.44, -0.08), (0.44, -0.08), (0.37, 0.085), (-0.37, 0.085)],
            'Lesk', 0.002, kruhy=(1.0, 0.5))
    for z in (0.39, 0.475):
        nalepka((0, -2.1, z), d, (1, 0, 0), obdelnik(0.37, 0.006, 0.5), 'Plast', 0.006, okraj=False, hladke=1)

    def spz(stred, smer, osa):
        nalepka(stred, smer, osa, obdelnik(0.26, 0.056, 0.15), 'SPZ', 0.012, hladke=1, mat_okraj='Lesk')
        P = Vector(stred)
        u = Vector(osa)
        nalepka(P - u * 0.233, smer, osa, obdelnik(0.022, 0.05, 0.1), 'Modra', 0.0135, okraj=False, hladke=0,
                kruhy=(1.0,))
        for k, x in enumerate((-0.17, -0.12, -0.07, -0.005, 0.045, 0.095, 0.145, 0.195)):
            if k == 3:
                continue
            nalepka(P + u * x, smer, osa, obdelnik(0.016, 0.034, 0.2), 'Lesk', 0.0135, okraj=False, hladke=0,
                    kruhy=(1.0,))

    spz((0, -2.1, 0.44), Vector((0, 1, 0)), (1, 0, 0))
    spz((0, 2.1, 0.70), Vector((0, -1, 0)), (-1, 0, 0))
    # zadní: znak, difuzor, výfuk, odvětrání
    nalepka((0, 2.1, 0.83), Vector((0, -1, 0)), (-1, 0, 0), kruh(0.04, 14), 'Chrom', 0.008)
    nalepka((0, 2.1, 0.33), Vector((0, -1, 0.3)), (-1, 0, 0), [(-0.5, -0.04), (0.5, -0.04), (0.42, 0.05),
                                                                (-0.42, 0.05)], 'Lesk', 0.003)
    superel(DET, (0.42, 2.105, 0.30), (0.045, 0.06, 0.028), 'Chrom', e=0.6, seg=10, rings=6)
    superel(DET, (0.42, 2.125, 0.30), (0.036, 0.05, 0.020), 'Lesk', e=0.6, seg=10, rings=6)
    # mřížka před čelním sklem
    nalepka((0, -1.0, 1.2), Vector((0, 0, -1)), (1, 0, 0), obdelnik(0.72, 0.07, 0.2), 'Plast', 0.003, kruhy=(1.0,))
    # zadní spoiler s třetím brzdovým světlem, zadní stěrač, ploutev antény
    superel(DET, (0, 1.585, 1.387), (0.62, 0.07, 0.016), 'Lak', e=0.35, seg=16, rings=6, R=rot(x=-10))
    superel(DET, (0, 1.64, 1.374), (0.13, 0.012, 0.007), 'Brzdova', e=0.3, seg=8, rings=4)
    superel(DET, (0.02, 1.86, 1.08), (0.006, 0.20, 0.006), 'Lesk', e=0.3, seg=6, rings=4, R=rot(x=-50, z=70))
    superel(DET, (0, 1.40, 1.43), (0.016, 0.08, 0.024), 'Lesk', e=0.8, seg=8, rings=5, R=rot(x=-6))
    detaily = DET.objekt('Detaily', prepocet=False)
    hladit(detaily, 50)

    # ------------------------------------------------------------ interiér
    I = Sit()

    def idil(rozmer, poloha, mat, e=0.35, seg=10, rings=6, R=None):
        superel(I, poloha, [r / 2 for r in rozmer], mat, e=e, seg=seg, rings=rings, R=R)

    # palubní deska jako vytažený profil (y, z) přes celou šířku
    prof = [(-0.92, 0.915), (-0.70, 0.955), (-0.52, 0.95), (-0.45, 0.92), (-0.43, 0.84), (-0.45, 0.74),
            (-0.52, 0.62), (-0.62, 0.52), (-0.92, 0.50)]
    xs = np.linspace(-0.765, 0.765, 9)
    rad = [[I.bod((x, y, z - 0.012 * (1 - (x / 0.765) ** 2))) for y, z in prof] for x in xs]
    for a, b in zip(rad, rad[1:]):
        for k in range(len(prof)):
            q = (a[k], a[(k + 1) % len(prof)], b[(k + 1) % len(prof)], b[k])
            I.plocha(q, 'Interier')
    I.plocha(list(reversed(rad[0])), 'Interier')
    I.plocha(rad[-1], 'Interier')
    # kryt budíků, displej budíků, střední displej, výdechy, ozdobná lišta
    idil((0.34, 0.20, 0.09), (0.38, -0.51, 0.955), 'Interier', e=0.5, seg=14, rings=8)
    idil((0.27, 0.012, 0.085), (0.38, -0.418, 0.915), 'Displej', e=0.2, seg=10, rings=6, R=rot(x=12))
    idil((0.27, 0.022, 0.16), (0.0, -0.455, 1.0), 'Lesk', e=0.2, seg=10, rings=6, R=rot(x=10))
    idil((0.25, 0.012, 0.14), (0.0, -0.443, 1.0), 'Displej', e=0.15, seg=10, rings=6, R=rot(x=10))
    for x in (-0.62, -0.09, 0.09, 0.62):
        idil((0.11, 0.02, 0.045), (x, -0.43, 0.865), 'Lesk', e=0.4, seg=10, rings=6)
    idil((1.40, 0.012, 0.018), (0, -0.432, 0.81), 'Chrom', e=0.2, seg=8, rings=4)
    # středový tunel s řadicí pákou
    idil((0.22, 0.75, 0.22), (0, 0.0, 0.47), 'Interier', e=0.3)
    idil((0.08, 0.08, 0.04), (0, -0.02, 0.585), 'Plast', e=0.8, seg=10, rings=6)
    idil((0.022, 0.022, 0.12), (0, -0.02, 0.64), 'Lesk', e=1.0, seg=8, rings=4)
    idil((0.05, 0.06, 0.05), (0, -0.025, 0.71), 'Lesk', e=0.9, seg=10, rings=6)
    idil((0.052, 0.062, 0.012), (0, -0.025, 0.725), 'Chrom', e=0.9, seg=10, rings=4)
    # sedadla s bočnicemi a opěrkami hlavy
    for x in (0.38, -0.38):
        idil((0.48, 0.50, 0.12), (x, 0.26, 0.49), 'Sedacky', R=rot(x=-5))
        for bx in (-0.205, 0.205):
            idil((0.08, 0.46, 0.10), (x + bx, 0.26, 0.53), 'Sedacky', e=0.6, seg=8, rings=4, R=rot(x=-5))
            idil((0.08, 0.13, 0.50), (x + bx * 1.02, 0.585, 0.88), 'Sedacky', e=0.6, seg=8, rings=5,
                 R=rot(x=-14))
        idil((0.44, 0.12, 0.60), (x, 0.61, 0.86), 'Sedacky', R=rot(x=-14))
        idil((0.26, 0.10, 0.17), (x, 0.69, 1.25), 'Sedacky', e=0.5, R=rot(x=-10))
        for px in (-0.07, 0.07):
            idil((0.014, 0.014, 0.12), (x + px, 0.68, 1.14), 'Chrom', e=1.0, seg=5, rings=3)
    idil((1.24, 0.48, 0.13), (0, 1.17, 0.52), 'Sedacky', seg=12, rings=5)
    idil((1.24, 0.13, 0.54), (0, 1.50, 0.85), 'Sedacky', seg=12, rings=5, R=rot(x=-16))
    for x in (-0.38, 0.38):
        idil((0.24, 0.09, 0.14), (x, 1.56, 1.17), 'Sedacky', e=0.5, seg=8, rings=4, R=rot(x=-14))
    for sx in (1, -1):
        idil((0.15, 0.80, 0.33), (0.66 * sx, 1.32, 0.56), 'Interier', e=0.4, seg=8, rings=4)   # kryty podběhů
        for yk in (0.0, 1.05):
            idil((0.06, 0.62, 0.05), (0.745 * sx, yk, 0.74), 'Interier', e=0.4, seg=8, rings=4)   # loketní opěrka
            idil((0.012, 0.09, 0.02), (0.72 * sx, yk - 0.22, 0.83), 'Chrom', e=0.5, seg=6, rings=3)  # klika
    idil((1.45, 0.28, 0.025), (0, 1.73, 0.98), 'Interier', e=0.2, seg=10, rings=4)                # roleta kufru
    # vnitřní zpětné zrcátko a sluneční clony
    idil((0.24, 0.035, 0.07), (0, 0.10, 1.29), 'Lesk', e=0.5, seg=12, rings=6, R=rot(x=20))
    idil((0.02, 0.02, 0.07), (0, 0.13, 1.34), 'Lesk', e=1.0, seg=6, rings=4)
    for x in (0.36, -0.36):
        idil((0.34, 0.16, 0.022), (x, 0.19, 1.33), 'Strop', e=0.3, seg=10, rings=4, R=rot(x=-14))
    interier = I.objekt('Interier', prepocet=False)
    hladit(interier, 45)

    # ------------------------------------------------------------ volant (sloupek = natočený prázdný uzel)
    sloupek = bpy.data.objects.new('VolantSloupek', None)
    scena.collection.objects.link(sloupek)
    sloupek.location = (0.38, -0.12, 0.885)
    sloupek.rotation_euler = (math.radians(-24), 0, 0)
    V = Sit()
    n, m_ = 24, 6
    idx = []
    for k in range(n):
        a = 2 * math.pi * k / n
        c = Vector((math.cos(a) * 0.178, 0, math.sin(a) * 0.178))
        radial = Vector((math.cos(a), 0, math.sin(a)))
        rada = []
        for j in range(m_):
            b = 2 * math.pi * j / m_
            rada.append(V.bod(c + radial * math.cos(b) * 0.016 + Vector((0, 1, 0)) * math.sin(b) * 0.021))
        idx.append(rada)
    for k in range(n):
        for j in range(m_):
            V.plocha((idx[k][j], idx[k][(j + 1) % m_], idx[(k + 1) % n][(j + 1) % m_], idx[(k + 1) % n][j]), 'Plast')
    for uhel, delka in ((0, 0.10), (180, 0.10), (270, 0.09)):
        R = Matrix.Rotation(math.radians(uhel), 3, 'Y')
        superel(V, R @ Vector((0.1, 0.012, 0)), (0.07, 0.012, 0.022), 'Plast', e=0.4, seg=8, rings=4, R=R)
    superel(V, (0, 0.0, -0.005), (0.065, 0.035, 0.055), 'Plast', e=0.5, seg=12, rings=6)
    superel(V, (0, -0.034, 0.0), (0.016, 0.004, 0.012), 'Chrom', e=0.8, seg=8, rings=4)
    superel(V, (0, 0.12, 0), (0.032, 0.11, 0.032), 'Lesk', e=1.0, seg=8, rings=5)
    volant = V.objekt('Volant', prepocet=True)
    volant.parent = sloupek
    hladit(volant, 60)

    # ------------------------------------------------------------ kola (pneu + disk s dvojitými paprsky)
    PROF = [(0.217, 0.093), (0.245, 0.101), (0.28, 0.104), (0.305, 0.102), (0.321, 0.097), (0.329, 0.085),
            (0.331, 0.06), (0.331, -0.06), (0.329, -0.085), (0.321, -0.097), (0.30, -0.103),
            (0.25, -0.101), (0.217, -0.093)]

    def kolo_sit(sx):
        K = Sit()
        seg = 26
        p = len(PROF)
        idx = []
        for k in range(seg + 1):                  # švem navíc kvůli UV
            a = 2 * math.pi * k / seg
            idx.append([K.bod((x * sx, math.cos(a) * r, math.sin(a) * r)) for r, x in PROF])
        for k in range(seg):
            for j in range(p - 1):
                q = [idx[k][j], idx[k][j + 1], idx[k + 1][j + 1], idx[k + 1][j]]
                # běhoun (j 5..8) má UV pro dezén: u po obvodu (4 opakování), v přes šířku
                u0, u1 = k / seg * 4, (k + 1) / seg * 4
                if 5 <= j <= 7:
                    v0 = (PROF[j][1] + 0.088) / 0.176 * 0.86
                    v1 = (PROF[j + 1][1] + 0.088) / 0.176 * 0.86
                else:
                    v0 = v1 = 0.95
                uv = [(u0, v0), (u0, v1), (u1, v1), (u1, v0)]
                K.plocha(q if sx > 0 else q[::-1], 'Pneu', uv)
        # ráfek: okraj + vnitřek (válec viditelný mezi paprsky), středová miska
        RPROF = [(0.212, 0.104), (0.222, 0.094), (0.214, 0.084), (0.204, 0.07), (0.20, -0.06), (0.10, -0.065)]
        ridx = []
        for k in range(seg + 1):
            a = 2 * math.pi * k / seg
            ridx.append([K.bod((x * sx, math.cos(a) * r, math.sin(a) * r)) for r, x in RPROF])
        for k in range(seg):
            for j in range(len(RPROF) - 1):
                q = [ridx[k][j], ridx[k + 1][j], ridx[k + 1][j + 1], ridx[k][j + 1]]
                K.plocha(q if sx > 0 else q[::-1], 'Disk' if j < 3 else 'Lesk')
        # brzdový kotouč
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.16, radius2=0.16, depth=0.025)
        for v in bm.verts:
            v.co = Vector((v.co.z - 0.02 * sx, v.co.x, v.co.y))
        K.pridej_bm(bm, 'Kotouc')
        bm.free()
        # paprsky: 5 dvojic, mírně miskovité (u náboje zapuštěné)
        for kk in range(10):
            a0 = 2 * math.pi * (kk // 2) / 5 + (0.13 if kk % 2 else -0.13)
            body = []
            for t in (0.0, 0.35, 0.7, 1.0):
                r = 0.055 + (0.205 - 0.055) * t
                a = a0 + (0.0 if kk % 2 else 0.0) - (0.10 if kk % 2 else -0.10) * t * 0.6
                x = 0.062 + 0.026 * t - 0.01 * t * t
                sir = 0.018 - 0.006 * t
                body.append((x, r, a, sir))
            rada = []
            for x, r, a, sir in body:
                c = Vector((0, math.cos(a), math.sin(a))) * r
                tng = Vector((0, -math.sin(a), math.cos(a)))
                kr = []
                for dx, dt in ((0.012, -1), (0.012, 1), (-0.012, 1), (-0.012, -1)):
                    kr.append(K.bod(Vector(((x + dx) * sx, 0, 0)) + c + tng * sir * dt * (0.8 if dx < 0 else 1)))
                rada.append(kr)
            for a_, b_ in zip(rada, rada[1:]):
                for j in range(4):
                    q = [a_[j], a_[(j + 1) % 4], b_[(j + 1) % 4], b_[j]]
                    K.plocha(q if sx > 0 else q[::-1], 'Disk')
        # náboj, středová krytka se znakem a šrouby
        superel(K, (0.068 * sx, 0, 0), (0.066, 0.066, 0.02), 'Disk', e=1.0, e2=1.0, seg=12, rings=4, R=rot(y=90))
        superel(K, (0.086 * sx, 0, 0), (0.03, 0.03, 0.007), 'Lesk', e=0.6, e2=1.0, seg=10, rings=3, R=rot(y=90))
        for b in range(5):
            a = 2 * math.pi * b / 5 + math.pi / 5
            superel(K, (0.086 * sx, math.cos(a) * 0.045, math.sin(a) * 0.045), (0.008, 0.009, 0.009), 'Chrom',
                    e=0.6, seg=5, rings=3)
        me_ob = K.objekt('_kolo', prepocet=False)
        bm = bmesh.new()
        bm.from_mesh(me_ob.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bm.to_mesh(me_ob.data)
        bm.free()
        hladit(me_ob, 40)
        me = me_ob.data
        bpy.data.objects.remove(me_ob)
        return me

    sit_kola = {1: kolo_sit(1), -1: kolo_sit(-1)}
    for sx in (1, -1):
        sit_kola[sx].name = 'Kolo_' + ('L' if sx > 0 else 'P')
    kola = []
    for jm, sx, sy in (('Kolo_PL', 1, -1), ('Kolo_PP', -1, -1), ('Kolo_ZL', 1, 1), ('Kolo_ZP', -1, 1)):
        ob = bpy.data.objects.new(jm, sit_kola[sx])
        scena.collection.objects.link(ob)
        ob.location = (ROZCHOD * sx, ROZVOR * sy, R_KOLA)
        kola.append(ob)

    # zkrácení na přesných 4,30 m (nárazníky a SPZ přesahují řezy karoserie)
    k = 4.30 / 4.348
    for o in (karoserie, strecha, okna, detaily):
        for v in o.data.vertices:
            v.co.y *= k
    koren = bpy.data.objects.new('Auto', None)
    scena.collection.objects.link(koren)
    for o in [karoserie, strecha, okna, detaily, interier, sloupek] + kola:
        o.parent = koren
    vse = [koren, karoserie, strecha, okna, detaily, interier, sloupek, volant] + kola
    for o in vse:
        if o.type == 'MESH':
            print('AUTO', o.name, trojuhelniky(o))
    print('AUTO trojúhelníků celkem:', sum(trojuhelniky(o) for o in vse if o.type == 'MESH'))
    return vse


AUTO = postav_auto() if 'auto' in MODELY else None


# ======================================================================== export
def export(objekty, cesta, animace_ano):
    for o in bpy.data.objects:
        o.select_set(o in objekty)
    bpy.ops.export_scene.gltf(
        filepath=cesta, export_format='GLB', use_selection=True, export_yup=True,
        export_animations=animace_ano, export_animation_mode='ACTIONS', export_force_sampling=True,
        export_anim_slide_to_zero=True, export_cameras=False, export_lights=False,
        export_materials='EXPORT', export_apply=False, export_image_format='AUTO')
    print('EXPORT OK', cesta, os.path.getsize(cesta), 'B')


if POSTAVA:
    export(POSTAVA, os.path.join(VYSTUP, 'postava.glb'), True)
if AUTO:
    export(AUTO, os.path.join(VYSTUP, 'auto.glb'), False)

# ======================================================================== náhledy (Cycles, jen pro kontrolu)
if NAHLED:
    os.makedirs(NAHLED, exist_ok=True)
    svet = bpy.data.worlds.new('Svet')
    svet.use_nodes = True
    nt = svet.node_tree
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(35)
    sky.sun_rotation = math.radians(200)
    nt.links.new(sky.outputs['Color'], nt.nodes['Background'].inputs['Color'])
    nt.nodes['Background'].inputs['Strength'].default_value = 0.12
    scena.world = svet
    scena.render.engine = 'CYCLES'
    scena.cycles.device = 'CPU'
    scena.cycles.samples = int(os.environ.get('VZORKY', '48'))
    scena.cycles.use_denoising = True
    scena.view_settings.view_transform = 'Standard'
    # zem
    zem = bpy.data.objects.new('Zem', bpy.data.meshes.new('Zem'))
    zem.data.from_pydata([(-30, -30, 0), (30, -30, 0), (30, 30, 0), (-30, 30, 0)], [], [(0, 1, 2, 3)])
    zem.data.materials.append(material('_zem', '#8a8a84', 0.9))
    scena.collection.objects.link(zem)
    kam = bpy.data.objects.new('Kamera', bpy.data.cameras.new('Kamera'))
    kam.data.clip_start = 0.02
    scena.collection.objects.link(kam)
    scena.camera = kam

    def foto(jmeno, odkud, cil, ohnisko=50, sirka=800, vyska=800):
        scena.render.resolution_x, scena.render.resolution_y = sirka, vyska
        kam.location = odkud
        kam.data.lens = ohnisko
        kam.rotation_euler = (Vector(cil) - Vector(odkud)).to_track_quat('-Z', 'Y').to_euler()
        scena.render.filepath = os.path.join(NAHLED, jmeno + '.png')
        bpy.ops.render.render(write_still=True)

    ZOBR = os.environ.get('NAHLEDY', 'postava,auto')
    if 'postava' in ZOBR and POSTAVA:
        for o in AUTO or []:
            o.hide_render = True
        kostra = POSTAVA[0]
        for jm, snimky in (('Stani', (1,)), ('Chuze', (1, 6)), ('Beh', (1, 5)), ('Skok', (4, 7, 11))):
            kostra.animation_data.action = bpy.data.actions[jm]
            for f in snimky:
                scena.frame_set(f)
                foto(f'postava_{jm}_{f}', (2.6, -3.4, 1.5), (0, 0, 0.88), 60, 500, 700)
        kostra.animation_data.action = bpy.data.actions['Stani']
        scena.frame_set(1)
        foto('postava_bok', (4.2, 0, 1.0), (0, 0, 0.88), 60, 500, 700)
        for jm, snimky in (('Chuze', (1, 4, 6, 8)), ('Beh', (1, 3, 5, 7))):
            kostra.animation_data.action = bpy.data.actions[jm]
            for f in snimky:
                scena.frame_set(f)
                foto(f'postava_bok_{jm}_{f}', (4.2, 0, 1.0), (0, 0, 0.88), 60, 500, 700)
        kostra.animation_data.action = bpy.data.actions['Stani']
        scena.frame_set(1)
        foto('postava_hlava', (0.45, -1.1, 1.68), (0, 0, 1.62), 110, 700, 700)
        foto('postava_hlava_bok', (1.2, -0.25, 1.66), (0, 0, 1.62), 110, 700, 700)
        foto('postava_ruka', (0.9, -0.7, 0.85), (0.26, -0.02, 0.80), 110, 700, 700)
        foto('postava_boty', (0.6, -1.2, 0.35), (0.0, -0.05, 0.08), 70, 700, 500)
        foto('postava_zezadu', (-1.5, 3.8, 1.3), (0, 0, 0.88), 60, 500, 700)
        for o in AUTO or []:
            o.hide_render = False
    if 'auto' in ZOBR and AUTO:
        for o in POSTAVA or []:
            o.hide_render = True
        foto('auto_predek', (4.5, -6.5, 2.0), (0, 0, 0.6), 45, 1000, 700)
        foto('auto_zadek', (-4.8, 6.2, 2.2), (0, 0, 0.6), 45, 1000, 700)
        foto('auto_bok', (8.5, 0, 0.8), (0, 0, 0.7), 45, 1000, 600)
        foto('auto_ridic', (0.38, 0.35, 1.16), (0.38, -5, 1.0), 18, 1000, 620)
        foto('auto_interier', (2.4, 1.6, 2.1), (0, 0.2, 0.8), 30, 1000, 700)
        foto('auto_predek_zblizka', (2.0, -3.8, 1.0), (0, -1.6, 0.6), 45, 1000, 700)
        foto('auto_kolo', (2.2, -2.0, 0.5), (0.8, -1.3, 0.33), 50, 700, 700)
    print('NAHLEDY OK')
