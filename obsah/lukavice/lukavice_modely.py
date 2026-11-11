"""Lukavice – modely postavy a auta pro three.js, postavené skriptem v Blenderu.

Spuštění (bez okna):
    blender -b --factory-startup --python lukavice_modely.py -- [vystupni_adresar] [adresar_nahledu]

Vytvoří ve výstupním adresáři (výchozí = adresář skriptu):
  postava.glb – mladík v mikině a džínách, kostra + akce Stani, Chuze, Beh, Skok
  auto.glb    – malý hatchback; kola Kolo_PL/PP/ZL/ZP samostatně, Volant, materiály Lak/Sklo/…

Souřadnice: v Blenderu Z nahoru, předek do −Y, levá strana = +X.
Exportér (export_yup) z toho udělá three.js: Y nahoru, předek do +Z, levá = +X.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix, Quaternion, Euler, noise
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
VYSTUP = argv[0] if argv else os.path.dirname(os.path.abspath(__file__))
NAHLED = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scena = bpy.context.scene
scena.render.fps = 24


# ======================================================================== společné
def srgb(hexstr):
    """#rrggbb → lineární RGB (Blender pracuje lineárně)."""
    c = [int(hexstr[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


M = {}


def material(jmeno, barva, drsnost=0.7, kov=0.0, zar=None, sila=1.0, alfa=None):
    m = bpy.data.materials.new(jmeno)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(barva), 1)
    b.inputs['Roughness'].default_value = drsnost
    b.inputs['Metallic'].default_value = kov
    if zar:
        b.inputs['Emission Color'].default_value = (*srgb(zar), 1)
        b.inputs['Emission Strength'].default_value = sila
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
    M[jmeno] = m
    return m


class Sit:
    """Sběr vrcholů a ploch; každá plocha má jméno materiálu, každý vrchol značku (pro váhy)."""

    def __init__(s):
        s.v, s.f, s.m, s.g = [], [], [], []

    def bod(s, p, g=None):
        s.v.append(Vector(p))
        s.g.append(g)
        return len(s.v) - 1

    def plocha(s, idx, mat):
        s.f.append(tuple(idx))
        s.m.append(mat)

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


def zaobleny_kvadr(rozmer, r=0.02, seg=2):
    """bmesh kvádru se sraženými/zaoblenými hranami, střed v počátku."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * rozmer[0], v.co.y * rozmer[1], v.co.z * rozmer[2]))
    if r > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(r, min(rozmer) * 0.45), segments=seg,
                        profile=0.5, affect='EDGES', clamp_overlap=True)
    return bm


def koule_bm(seg=12, prst=8):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=prst, radius=1.0)
    return bm


def aplikuj_mod(ob, mod):
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def trojuhelniky(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


# ======================================================================== POSTAVA
material('Kuze', '#e2ad86', 0.6)
material('Vlasy', '#3b2617', 0.8)
material('Oci', '#1b1b20', 0.3)
material('Mikina', '#2f7275', 0.85)
material('MikinaLem', '#255b5e', 0.9)
material('Snurky', '#efefef', 0.6)
material('Dziny', '#3d5d8c', 0.9)
material('Boty', '#f1f0ec', 0.6)
material('Podrazka', '#7a6650', 0.9)
material('Rty', '#b86a5c', 0.6)

# kosti: jméno → (hlava, ocas, rodič)
KOSTI = {
    'Panev':       ((0, 0, 0.95),          (0, 0, 1.08),            None),
    'Pater':       ((0, 0, 1.08),          (0, 0, 1.28),            'Panev'),
    'Hrudnik':     ((0, 0, 1.28),          (0, 0, 1.45),            'Pater'),
    'Krk':         ((0, 0, 1.45),          (0, 0, 1.55),            'Hrudnik'),
    'Hlava':       ((0, 0, 1.55),          (0, 0, 1.75),            'Krk'),
}
for st, sx in (('L', 1), ('R', -1)):
    KOSTI.update({
        'Rameno.' + st:    ((0.18 * sx, 0, 1.39),       (0.235 * sx, 0.01, 1.12),   'Hrudnik'),
        'Predlokti.' + st: ((0.235 * sx, 0.01, 1.12),   (0.26 * sx, -0.005, 0.88),  'Rameno.' + st),
        'Ruka.' + st:      ((0.26 * sx, -0.005, 0.88),  (0.272 * sx, -0.012, 0.73), 'Predlokti.' + st),
        'Stehno.' + st:    ((0.095 * sx, 0, 0.95),      (0.1 * sx, -0.015, 0.50),   'Panev'),
        'Lytko.' + st:     ((0.1 * sx, -0.015, 0.50),   (0.1 * sx, 0.01, 0.095),    'Stehno.' + st),
        'Chodidlo.' + st:  ((0.1 * sx, 0.01, 0.095),    (0.1 * sx, -0.12, 0.03),    'Lytko.' + st),
    })


def catmull(body, kroky):
    """Interpolace (poloha, rx, ry) Catmull-Romem; vrací hustší seznam."""
    ven = []
    n = len(body)
    for i in range(n - 1):
        p0 = body[max(i - 1, 0)]
        p1, p2 = body[i], body[i + 1]
        p3 = body[min(i + 2, n - 1)]
        for k in range(kroky):
            t = k / kroky
            t2, t3 = t * t, t * t * t

            def cr(a, b, c, d):
                return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
            pos = Vector([cr(p0[0][j], p1[0][j], p2[0][j], p3[0][j]) for j in range(3)])
            ven.append((pos, cr(p0[1], p1[1], p2[1], p3[1]), cr(p0[2], p1[2], p2[2], p3[2])))
    ven.append(body[-1])
    return ven


def trubka(sit, body, n, mat_fn, g, kroky=2, ref=(0, -1, 0), cap=(1.0, 1.0), stin=None):
    """Hladká trubka podél bodů [(poloha, rx, ry)], zakulacené konce.
    ry míří ve směru `ref` (promítnutého kolmo na tečnu), rx do strany.
    mat_fn(poloha_středu_plochy, index_kruhu, u) → jméno materiálu."""
    body = [(Vector(p), rx, ry) for p, rx, ry in body]
    body = catmull(body, kroky)
    # zakulacení konců – přidá kruhy a pól
    def tecna(i):
        a = body[max(i - 1, 0)][0]
        b = body[min(i + 1, len(body) - 1)][0]
        return (b - a).normalized()
    t0, t1 = tecna(0), tecna(len(body) - 1)
    zac, kon = [], []
    for fi in (65, 35):
        f = math.radians(fi)
        p, rx, ry = body[0]
        r = (rx + ry) / 2 * cap[0]
        zac.append((p - t0 * r * math.sin(f), rx * math.cos(f), ry * math.cos(f)))
    for fi in (35, 65):
        f = math.radians(fi)
        p, rx, ry = body[-1]
        r = (rx + ry) / 2 * cap[1]
        kon.append((p + t1 * r * math.sin(f), rx * math.cos(f), ry * math.cos(f)))
    pol0 = body[0][0] - t0 * (body[0][1] + body[0][2]) / 2 * cap[0]
    pol1 = body[-1][0] + t1 * (body[-1][1] + body[-1][2]) / 2 * cap[1]
    kruhy = zac + body + kon
    # rámce paralelním přenosem
    tec = []
    for i in range(len(kruhy)):
        a = kruhy[max(i - 1, 0)][0]
        b = kruhy[min(i + 1, len(kruhy) - 1)][0]
        tec.append((b - a).normalized())
    N = Vector(ref)
    N = (N - tec[0] * N.dot(tec[0])).normalized()
    idx = []
    for i, (p, rx, ry) in enumerate(kruhy):
        T = tec[i]
        if i > 0:
            q = tec[i - 1].rotation_difference(T)
            N = q @ N
            N = (N - T * N.dot(T)).normalized()
        B = T.cross(N).normalized()
        rada = []
        for k in range(n):
            a = 2 * math.pi * k / n
            bod = p + B * math.cos(a) * rx + N * math.sin(a) * ry
            if stin:
                bod = stin(bod)
            rada.append(sit.bod(bod, g))
        idx.append(rada)
    ip0 = sit.bod(pol0 if not stin else stin(pol0), g)
    ip1 = sit.bod(pol1 if not stin else stin(pol1), g)
    for i in range(len(idx) - 1):
        for k in range(n):
            q = (idx[i][k], idx[i][(k + 1) % n], idx[i + 1][(k + 1) % n], idx[i + 1][k])
            c = sum((sit.v[j] for j in q), Vector()) / 4
            sit.plocha(q, mat_fn(c, i, k / n))
    for k in range(n):
        c = sit.v[idx[0][k]]
        sit.plocha((ip0, idx[0][(k + 1) % n], idx[0][k]), mat_fn(c, 0, k / n))
        c = sit.v[idx[-1][k]]
        sit.plocha((ip1, idx[-1][k], idx[-1][(k + 1) % n]), mat_fn(c, len(idx) - 1, k / n))


def koule_do(sit, stred, polomery, mat, g, seg=12, prst=8, uprav=None):
    bm = koule_bm(seg, prst)
    for v in bm.verts:
        v.co = Vector((v.co.x * polomery[0], v.co.y * polomery[1], v.co.z * polomery[2]))
        if uprav:
            v.co = uprav(v.co)
        v.co += Vector(stred)
    sit.pridej_bm(bm, mat, g)
    bm.free()


def postav_postavu():
    s = Sit()
    TRUP = ['Panev', 'Pater', 'Hrudnik', 'Krk', 'Stehno.L', 'Stehno.R']

    # ---- trup (mikina + džíny dole)
    def mat_trup(c, i, u):
        if c.z < 0.985:
            return 'Dziny'
        if c.z < 1.035:
            return 'MikinaLem'
        if c.z > 1.49:
            return 'Kuze'
        return 'Mikina'
    trubka(s, [
        ((0, 0.005, 0.86), 0.10, 0.075),
        ((0, 0.012, 0.92), 0.155, 0.11),
        ((0, 0.008, 1.00), 0.165, 0.115),
        ((0, 0.0, 1.10), 0.155, 0.108),
        ((0, -0.008, 1.24), 0.172, 0.12),
        ((0, -0.006, 1.35), 0.185, 0.118),
        ((0, 0.005, 1.425), 0.15, 0.085),
        ((0, 0.01, 1.47), 0.062, 0.058),
        ((0, 0.005, 1.53), 0.052, 0.052),
        ((0, 0.0, 1.58), 0.05, 0.05),
    ], 16, mat_trup, TRUP, kroky=2, cap=(0.5, 0.6))

    # kapuce za krkem (polštář) a šňůrky
    trubka(s, [
        ((0.085, -0.045, 1.445), 0.02, 0.03),
        ((0.095, 0.03, 1.465), 0.035, 0.04),
        ((0.0, 0.085, 1.47), 0.045, 0.05),
        ((-0.095, 0.03, 1.465), 0.035, 0.04),
        ((-0.085, -0.045, 1.445), 0.02, 0.03),
    ], 8, lambda c, i, u: 'Mikina', ['Hrudnik', 'Krk'], kroky=2, ref=(0, 0, 1))
    for sx in (1, -1):
        trubka(s, [((0.035 * sx, -0.105, 1.43), 0.006, 0.006),
                   ((0.04 * sx, -0.118, 1.33), 0.006, 0.006),
                   ((0.042 * sx, -0.12, 1.26), 0.006, 0.006)],
               5, lambda c, i, u: 'Snurky', ['Hrudnik'], kroky=1)
    # klokaní kapsa
    bm = zaobleny_kvadr((0.24, 0.03, 0.12), 0.012, 1)
    for v in bm.verts:
        v.co += Vector((0, -0.098, 1.09))
    s.pridej_bm(bm, 'Mikina', ['Pater', 'Panev'])
    bm.free()

    for st, sx in (('L', 1), ('R', -1)):
        # ---- ruka (rukáv + manžeta + dlaň)
        RUKA = ['Hrudnik', 'Rameno.' + st, 'Predlokti.' + st]

        def mat_rukav(c, i, u):
            return 'MikinaLem' if c.z < 0.925 else 'Mikina'
        trubka(s, [
            ((0.09 * sx, 0.0, 1.40), 0.06, 0.06),
            ((0.175 * sx, 0.0, 1.395), 0.065, 0.063),
            ((0.215 * sx, 0.005, 1.26), 0.055, 0.058),
            ((0.235 * sx, 0.01, 1.12), 0.047, 0.05),
            ((0.25 * sx, 0.002, 0.99), 0.044, 0.046),
            ((0.258 * sx, -0.004, 0.90), 0.042, 0.044),
        ], 10, mat_rukav, RUKA, kroky=2, ref=(0, -1, 0), cap=(1.0, 0.25))
        DLAN = ['Predlokti.' + st, 'Ruka.' + st]
        trubka(s, [
            ((0.259 * sx, -0.005, 0.915), 0.028, 0.03),
            ((0.263 * sx, -0.006, 0.87), 0.022, 0.04),
            ((0.268 * sx, -0.009, 0.81), 0.019, 0.042),
            ((0.272 * sx, -0.012, 0.755), 0.015, 0.032),
        ], 8, lambda c, i, u: 'Kuze', DLAN, kroky=2, ref=(0, -1, 0), cap=(1, 0.6))
        trubka(s, [((0.255 * sx, -0.03, 0.865), 0.011, 0.011),
                   ((0.25 * sx, -0.05, 0.83), 0.009, 0.009),
                   ((0.252 * sx, -0.056, 0.80), 0.008, 0.008)],
               6, lambda c, i, u: 'Kuze', DLAN, kroky=1)

        # ---- noha (džíny)
        NOHA = ['Panev', 'Stehno.' + st, 'Lytko.' + st]
        trubka(s, [
            ((0.09 * sx, 0.005, 1.00), 0.085, 0.09),
            ((0.1 * sx, 0.0, 0.86), 0.085, 0.088),
            ((0.1 * sx, -0.008, 0.70), 0.07, 0.072),
            ((0.1 * sx, -0.017, 0.50), 0.056, 0.06),
            ((0.1 * sx, -0.005, 0.32), 0.056, 0.062),
            ((0.1 * sx, 0.008, 0.16), 0.054, 0.056),
            ((0.1 * sx, 0.01, 0.075), 0.058, 0.06),
        ], 10, lambda c, i, u: 'Dziny', NOHA, kroky=2, ref=(0, -1, 0), cap=(0.4, 0.2))

        # ---- bota (tenisky) – trubka podél −Y, rovná podrážka
        BOTA = ['Chodidlo.' + st, 'Lytko.' + st]

        def mat_bota(c, i, u):
            return 'Podrazka' if c.z < 0.022 else 'Boty'
        trubka(s, [
            ((0.1 * sx, 0.075, 0.07), 0.045, 0.065),
            ((0.1 * sx, 0.03, 0.08), 0.052, 0.075),
            ((0.102 * sx, -0.05, 0.06), 0.054, 0.055),
            ((0.104 * sx, -0.13, 0.045), 0.05, 0.04),
            ((0.105 * sx, -0.185, 0.04), 0.04, 0.03),
        ], 12, mat_bota, BOTA, kroky=2, ref=(0, 0, 1), cap=(0.6, 0.9),
            stin=lambda p: Vector((p.x, p.y, max(p.z, 0.0))))

    # ---- hlava
    HLAVA = ['Hlava']
    HS, HR = Vector((0, -0.005, 1.622)), (0.094, 0.106, 0.118)

    def lebka(co):
        # užší brada a čelist, plošší týl
        if co.z < 0:
            k = 1 - 0.28 * min(1, -co.z / HR[2])
            co = Vector((co.x * k, co.y * (1 - 0.08 * min(1, -co.z / HR[2])), co.z))
        if co.y > 0:
            co.y *= 0.93
        return co
    koule_do(s, HS, HR, 'Kuze', HLAVA, 16, 12, lebka)
    for sx in (1, -1):
        koule_do(s, (0.092 * sx, 0.008, 1.612), (0.012, 0.022, 0.03), 'Kuze', HLAVA, 8, 6)    # uši
        koule_do(s, (0.034 * sx, -0.097, 1.64), (0.012, 0.006, 0.014), 'Oci', HLAVA, 8, 6)  # oči
        bm = zaobleny_kvadr((0.032, 0.008, 0.008), 0.003, 1)                                # obočí
        for v in bm.verts:
            v.co = Matrix.Rotation(-0.12 * sx, 3, 'Y') @ v.co + Vector((0.036 * sx, -0.098, 1.664))
        s.pridej_bm(bm, 'Vlasy', HLAVA)
        bm.free()
    trubka(s, [((0, -0.1, 1.645), 0.009, 0.006), ((0, -0.114, 1.612), 0.013, 0.012)],
           6, lambda c, i, u: 'Kuze', HLAVA, kroky=1, ref=(0, -1, 0))                       # nos
    koule_do(s, (0, -0.096, 1.578), (0.02, 0.006, 0.005), 'Rty', HLAVA, 8, 4)               # ústa

    # ---- vlasy: slupka těsně nad lebkou, k vlasové linii se ztenčí na nulu (žádný „kšilt“)
    bm = koule_bm(22, 14)
    LINIE = [(-0.13, 1.70), (-0.075, 1.685), (-0.04, 1.668), (-0.005, 1.648), (0.03, 1.615),
             (0.07, 1.578), (0.13, 1.565)]

    def linie(p):
        y = p.y - HS.y
        for (y0, z0), (y1, z1) in zip(LINIE, LINIE[1:]):
            if y <= y1:
                t = max(0.0, (y - y0) / (y1 - y0))
                z = z0 + (z1 - z0) * t
                break
        else:
            z = LINIE[-1][1]
        return z + 0.007 * noise.noise(Vector((p.x * 60, p.y * 60, 3.3)))

    for v in bm.verts:
        u = v.co.copy()
        p = Vector((u.x * HR[0], u.y * HR[1] * (0.93 if u.y > 0 else 1.0), u.z * HR[2])) * 1.035 + HS
        k = max(0.0, min(1.0, (p.z - linie(p)) / 0.045))
        n = noise.noise(Vector((u.x * 4.3, u.y * 4.3, u.z * 4.3)) + Vector((4, 1, 2)))
        p += (p - HS).normalized() * k * (0.016 + 0.013 * n)
        if u.y < -0.3 and u.z > 0.15:                    # ofina sčesaná dopředu a k pravé straně
            p += Vector((-0.012, -0.014, 0.006)) * k * min(1.0, (-u.y - 0.3) / 0.4)
        v.co = p
    smaz = [f for f in bm.faces if f.calc_center_median().z < linie(f.calc_center_median()) - 0.004]
    bmesh.ops.delete(bm, geom=smaz, context='FACES')
    s.pridej_bm(bm, 'Vlasy', HLAVA)
    bm.free()

    ob = s.objekt('PostavaTelo', prepocet=True)
    return ob, s


def vahy(ob, sit, kostra):
    """Váhy podle vzdálenosti od úseček kostí; kandidáti podle dílu a strany těla."""
    kosti = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in kostra.data.bones}
    for jm in kosti:
        ob.vertex_groups.new(name=jm)

    def vzd(p, a, b):
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        return (p - (a + ab * t)).length
    for i, v in enumerate(ob.data.vertices):
        kand = sit.g[i] or ['Panev']
        p = v.co
        ws = []
        for jm in kand:
            if jm.endswith('.L') and p.x < -0.015:
                continue
            if jm.endswith('.R') and p.x > 0.015:
                continue
            d = vzd(p, *kosti[jm])
            ws.append((1.0 / (d + 0.02) ** 5, jm))
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


def akce(kostra, jmeno, klice):
    """klice: [(snímek, {kost: (rx, ry, rz) ve stupních kolem os SVĚTA v klidové orientaci kosti,
                         'Panev@': (dx, dy, dz) posun pánve ve světě})]
    Konvence (Blender, předek −Y): +X u kosti mířící dolů = konec dozadu (stehno vzad, koleno ohnuté);
    u kosti mířící nahoru = předklon."""
    kostra.animation_data.action = None
    for snimek, data in klice:
        for pb in kostra.pose.bones:
            q_rest = pb.bone.matrix_local.to_quaternion()
            r = data.get(pb.name, (0, 0, 0))
            q_svet = Euler([math.radians(a) for a in r], 'XYZ').to_quaternion()
            pb.rotation_quaternion = q_rest.inverted() @ q_svet @ q_rest
            posun = Vector(data.get(pb.name + '@', (0, 0, 0)))
            pb.location = q_rest.inverted() @ posun
            pb.keyframe_insert('rotation_quaternion', frame=snimek)
            pb.keyframe_insert('location', frame=snimek)
    a = kostra.animation_data.action
    a.name = jmeno
    a.use_fake_user = True
    return a


def zrcadlo(poza):
    """Prohodí L a R (rotace kolem Y a Z se zrcadlením mění znaménko)."""
    ven = {}
    for k, v in poza.items():
        if k.endswith('@'):
            ven[k] = v
            continue
        if k.endswith('.L'):
            k2 = k[:-2] + '.R'
        elif k.endswith('.R'):
            k2 = k[:-2] + '.L'
        else:
            k2 = k
        ven[k2] = (v[0], -v[1], -v[2])
    return ven


def animace(kostra):
    for pb in kostra.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    kostra.animation_data_create()

    # ---- Stani: dýchání, 2 s (48 snímků)
    klid = {'Rameno.L': (2, -3, 0), 'Rameno.R': (2, 3, 0), 'Predlokti.L': (-10, 0, 0), 'Predlokti.R': (-10, 0, 0)}
    nadech = dict(klid)
    nadech.update({'Hrudnik': (-2.5, 0, 0), 'Krk': (1.5, 0, 0), 'Hlava': (1, 0, 1.5), 'Panev@': (0, 0, 0.004),
                   'Rameno.L': (1, -4.5, 0), 'Rameno.R': (1, 4.5, 0)})
    akce(kostra, 'Stani', [(1, klid), (25, nadech), (49, klid)])

    # ---- Chuze: 20 snímků = 0,833 s, dva kroky
    kontakt = {'Stehno.L': (-24, 0, 0), 'Lytko.L': (6, 0, 0), 'Chodidlo.L': (-14, 0, 0),
               'Stehno.R': (18, 0, 0), 'Lytko.R': (22, 0, 0), 'Chodidlo.R': (16, 0, 0),
               'Rameno.L': (18, -3, 0), 'Rameno.R': (-20, 3, 0),
               'Predlokti.L': (-12, 0, 0), 'Predlokti.R': (-28, 0, 0),
               'Panev': (0, 0, 5), 'Pater': (2, 0, -3), 'Hrudnik': (1, 0, -4), 'Panev@': (0, 0, -0.035)}
    prechod = {'Stehno.L': (2, 0, 0), 'Lytko.L': (4, 0, 0), 'Chodidlo.L': (-4, 0, 0),
               'Stehno.R': (-14, 0, 0), 'Lytko.R': (52, 0, 0), 'Chodidlo.R': (-8, 0, 0),
               'Rameno.L': (0, -3, 0), 'Rameno.R': (0, 3, 0),
               'Predlokti.L': (-15, 0, 0), 'Predlokti.R': (-15, 0, 0),
               'Pater': (2, 0, 0), 'Panev@': (0, 0, 0.012)}
    akce(kostra, 'Chuze', [(1, kontakt), (6, prechod), (11, zrcadlo(kontakt)), (16, zrcadlo(prechod)), (21, kontakt)])

    # ---- Beh: 17 snímků = 0,708 s, předklon, pokrčené lokty
    odraz = {'Stehno.L': (-52, 0, 0), 'Lytko.L': (38, 0, 0), 'Chodidlo.L': (-6, 0, 0),
             'Stehno.R': (24, 0, 0), 'Lytko.R': (38, 0, 0), 'Chodidlo.R': (28, 0, 0),
             'Rameno.L': (42, -6, 0), 'Rameno.R': (-48, 6, 0),
             'Predlokti.L': (-80, 0, 0), 'Predlokti.R': (-95, 0, 0),
             'Panev': (0, 0, 8), 'Pater': (12, 0, -6), 'Hrudnik': (5, 0, -6), 'Krk': (-8, 0, 0), 'Hlava': (-6, 0, 0),
             'Panev@': (0, 0, -0.045)}
    let = {'Stehno.L': (-28, 0, 0), 'Lytko.L': (22, 0, 0), 'Chodidlo.L': (-4, 0, 0),
           'Stehno.R': (-6, 0, 0), 'Lytko.R': (105, 0, 0), 'Chodidlo.R': (12, 0, 0),
           'Rameno.L': (10, -6, 0), 'Rameno.R': (-12, 6, 0),
           'Predlokti.L': (-88, 0, 0), 'Predlokti.R': (-88, 0, 0),
           'Pater': (12, 0, 0), 'Hrudnik': (5, 0, 0), 'Krk': (-8, 0, 0), 'Hlava': (-6, 0, 0),
           'Panev@': (0, 0, 0.03)}
    akce(kostra, 'Beh', [(1, odraz), (5.25, let), (9.5, zrcadlo(odraz)), (13.75, zrcadlo(let)), (18, odraz)])

    # ---- Skok: 19 snímků ≈ 0,79 s (snímky 1–20) (na místě; výšku skoku řeší hra)
    drep = {'Panev@': (0, 0.03, -0.13), 'Stehno.L': (-50, 0, 0), 'Stehno.R': (-50, 0, 0),
            'Lytko.L': (85, 0, 0), 'Lytko.R': (85, 0, 0), 'Chodidlo.L': (-35, 0, 0), 'Chodidlo.R': (-35, 0, 0),
            'Pater': (22, 0, 0), 'Hrudnik': (8, 0, 0), 'Krk': (-12, 0, 0),
            'Rameno.L': (40, -8, 0), 'Rameno.R': (40, 8, 0), 'Predlokti.L': (-20, 0, 0), 'Predlokti.R': (-20, 0, 0)}
    odskok = {'Panev@': (0, 0, 0.02), 'Chodidlo.L': (35, 0, 0), 'Chodidlo.R': (35, 0, 0),
              'Pater': (-4, 0, 0), 'Hlava': (-6, 0, 0),
              'Rameno.L': (-150, -10, 0), 'Rameno.R': (-150, 10, 0), 'Predlokti.L': (-15, 0, 0), 'Predlokti.R': (-15, 0, 0)}
    vzduch = {'Panev@': (0, 0, 0.0), 'Stehno.L': (-55, 0, 0), 'Stehno.R': (-35, 0, 0),
              'Lytko.L': (70, 0, 0), 'Lytko.R': (80, 0, 0), 'Chodidlo.L': (10, 0, 0), 'Chodidlo.R': (15, 0, 0),
              'Pater': (6, 0, 0),
              'Rameno.L': (-110, -20, 0), 'Rameno.R': (-110, 20, 0), 'Predlokti.L': (-30, 0, 0), 'Predlokti.R': (-30, 0, 0)}
    dopad = {'Panev@': (0, 0.02, -0.09), 'Stehno.L': (-38, 0, 0), 'Stehno.R': (-38, 0, 0),
             'Lytko.L': (65, 0, 0), 'Lytko.R': (65, 0, 0), 'Chodidlo.L': (-27, 0, 0), 'Chodidlo.R': (-27, 0, 0),
             'Pater': (16, 0, 0), 'Krk': (-8, 0, 0),
             'Rameno.L': (-35, -15, 0), 'Rameno.R': (-35, 15, 0), 'Predlokti.L': (-30, 0, 0), 'Predlokti.R': (-30, 0, 0)}
    akce(kostra, 'Skok', [(1, klid), (4, drep), (7, odskok), (11, vzduch), (15, dopad), (20, klid)])
    kostra.animation_data.action = bpy.data.actions['Stani']


kostra = postav_kostru()
telo, sit_tela = postav_postavu()
vahy(telo, sit_tela, kostra)
telo.parent = kostra
mod = telo.modifiers.new('Kostra', 'ARMATURE')
mod.object = kostra
animace(kostra)
POSTAVA = [kostra, telo]
print('POSTAVA trojúhelníků:', trojuhelniky(telo))


# ======================================================================== AUTO
material('Lak', '#c8322b', 0.35, 0.3)
material('Sklo', '#1c2630', 0.08, 0.0, alfa=0.35)
material('Svetla', '#f4f1e6', 0.15, 0.0, zar='#fffbe8', sila=1.0)
material('Koncova', '#c0141a', 0.25, 0.0, zar='#d01010', sila=0.6)
material('Plast', '#232427', 0.8)
material('Chrom', '#c9ccd1', 0.15, 1.0)
material('Pneu', '#1a1a1c', 0.9)
material('Disk', '#b9bdc3', 0.3, 0.9)
material('Interier', '#3a3b3f', 0.85)
material('Sedacky', '#2a2c31', 0.9)
material('Displej', '#1f3a52', 0.3, 0.0, zar='#3d7fb0', sila=0.6)
material('SPZ', '#f2f2ef', 0.5)

# ---- karoserie: řezy podél Y (předek = −Y), každý řez = zaoblený obdélník
#        y      půlšířka  spodek  vršek  vypouklost
RREZY = [
    (-2.150, 0.66, 0.34, 0.62, 0.00),
    (-2.135, 0.78, 0.30, 0.685, 0.01),
    (-2.090, 0.845, 0.28, 0.735, 0.02),
    (-2.000, 0.875, 0.27, 0.775, 0.025),
    (-1.850, 0.89, 0.26, 0.805, 0.03),
    (-1.600, 0.895, 0.255, 0.84, 0.03),
    (-1.300, 0.90, 0.25, 0.87, 0.03),
    (-1.050, 0.90, 0.25, 0.90, 0.02),
    (-0.800, 0.90, 0.25, 0.935, 0.005),
] + [(y, 0.90, 0.25, 0.94 + 0.06 * (y + 0.55) / 2.15, 0.0) for y in (-0.55, -0.25, 0.05, 0.35, 0.65, 0.95, 1.30, 1.60)] + [
    (1.850, 0.89, 0.265, 1.012, 0.0),
    (1.980, 0.875, 0.275, 1.005, 0.0),
    (2.070, 0.85, 0.29, 0.985, 0.0),
    (2.120, 0.81, 0.31, 0.94, 0.0),
    (2.150, 0.72, 0.35, 0.86, 0.0),
]


def rez(hw, zb, zt, crown):
    """Pravá polovina průřezu (x, z) od spodního středu po horní střed; zrcadlí se."""
    h = zt - zb
    rb, rt, t = min(0.07, h / 3), min(0.14, h / 2.6), 0.04
    pul = [(0, zb), (hw * 0.5, zb), (hw - rb, zb)]
    for a in (-60, -30):
        pul.append((hw - rb + rb * math.cos(math.radians(a)), zb + rb + rb * math.sin(math.radians(a))))
    pul += [(hw, zb + rb), (hw, zb + 0.45 * h)]
    cx, cz = hw - t - rt, zt - rt
    for a in (0, 30, 60, 90):
        pul.append((cx + rt * math.cos(math.radians(a)), cz + rt * math.sin(math.radians(a))))
    pul += [(cx * 0.5, zt + crown * 0.75), (0, zt + crown)]
    lev = [(-x, z) for x, z in reversed(pul[1:-1])]
    return pul + lev          # kruh: 13 + 11 = 24 bodů


def rez_v(y):
    """Interpolovaný průřez karoserie v místě y."""
    for a, b in zip(RREZY, RREZY[1:]):
        if a[0] <= y <= b[0]:
            t = (y - a[0]) / (b[0] - a[0])
            return [a[i] + (b[i] - a[i]) * t for i in range(1, 5)]
    return list((RREZY[0] if y < 0 else RREZY[-1])[1:])


def loft(sit, rezy, mat_fn, uzavrit=True, cap=True):
    """rezy: [(y, [(x, z), ...])] → plášť; mat_fn(i_rezu, j_bodu, stred) → materiál."""
    idx = [[sit.bod((x, y, z)) for x, z in body] for y, body in rezy]
    n = len(rezy[0][1])
    for i in range(len(idx) - 1):
        for j in range(n if uzavrit else n - 1):
            q = (idx[i][j], idx[i][(j + 1) % n], idx[i + 1][(j + 1) % n], idx[i + 1][j])
            c = sum((sit.v[k] for k in q), Vector()) / 4
            sit.plocha(q, mat_fn(i, j, c))
    if cap:
        sit.plocha(list(reversed(idx[0])), mat_fn(0, -1, sit.v[idx[0][0]]))
        sit.plocha(idx[-1], mat_fn(len(idx) - 1, -1, sit.v[idx[-1][0]]))
    return idx


def mat_karoserie(i, j, c):
    return 'Plast' if c.z < 0.33 else 'Lak'


s = Sit()
loft(s, [(y, rez(hw, zb, zt, cr)) for y, hw, zb, zt, cr in RREZY], mat_karoserie)
karoserie = s.objekt('Karoserie')


def kvadr_obj(jmeno, x0, x1, y0, y1, z0, z1, mat):
    s = Sit()
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0), (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    s.pridej_bm(bm, mat)
    bm.free()
    return s.objekt(jmeno, prepocet=True)


def valec_obj(jmeno, stred, r, x0, x1, mat, seg=20):
    s = Sit()
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=x1 - x0)
    for v in bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.z, stred[0] + v.co.x, stred[1] + v.co.y))
    s.pridej_bm(bm, mat)
    bm.free()
    return s.objekt(jmeno, prepocet=True)


ROZVOR, ROZCHOD, R_KOLA = 1.3, 0.8, 0.33
rezaky = [kvadr_obj('_kabina', -0.745, 0.745, -0.72, 1.82, 0.40, 1.5, 'Interier')]
for yk in (-ROZVOR, ROZVOR):
    for sx in (1, -1):
        rezaky.append(valec_obj('_podbeh', (yk, 0.35), 0.385, 0.6 * sx, 1.1 * sx, 'Plast', 24) if sx > 0 else
                      valec_obj('_podbeh', (yk, 0.35), 0.385, -1.1, -0.6, 'Plast', 24))
for rz in rezaky:
    m = karoserie.modifiers.new('B', 'BOOLEAN')
    m.operation, m.solver, m.object = 'DIFFERENCE', 'EXACT', rz
    m.material_mode = 'TRANSFER'
    aplikuj_mod(karoserie, m)
for rz in rezaky:
    bpy.data.objects.remove(rz)
hladit(karoserie, 38)

# ---- kabina (skleník): řezy podél Y, otevřené dole; výška střechy zr(y)
def zbelt(y):
    return rez_v(y)[2] - 0.035


SKLEN = []          # (y, zr): čelní sklo −0,80…0,10, střecha 0,10…1,35, zadní sklo 1,35…1,95
for k in range(6):
    t = k / 5
    y = -0.80 + 0.90 * t
    SKLEN.append((y, zbelt(y) + (1.42 - zbelt(y)) * (t * (1.35 - 0.35 * t))))
for y, z in ((0.22, 1.432), (0.45, 1.441), (0.55, 1.443), (0.65, 1.443), (0.90, 1.441), (1.15, 1.437), (1.35, 1.43)):
    SKLEN.append((y, z))
for k in range(1, 6):
    t = k / 5
    y = 1.35 + 0.60 * t
    SKLEN.append((y, 1.43 + (zbelt(y) - 1.43) * (t ** 1.5)))


def rez_skla(y, zr):
    zb = zbelt(y)
    h = max(zr - zb, 0.0)
    hb, ht = 0.80, 0.665
    hb = min(hb, rez_v(y)[0] - 0.1)
    ht = min(ht, hb)
    rc = min(0.075, h * 0.4)
    crown = 0.015 * min(1.0, h / 0.3)
    pul = [(hb, zb), (hb + (ht - hb) * 0.5, zb + h * 0.5), (ht, zb + h - rc),
           (ht - rc + rc * math.cos(math.radians(45)), zb + h - rc + rc * math.sin(math.radians(45))),
           (ht - rc, zb + h), ((ht - rc) * 0.5, zb + h + crown * 0.75), (0, zb + h + crown)]
    return pul + [(-x, z) for x, z in reversed(pul[:-1])]     # 13 bodů, otevřený


def mat_skla(i, j, c):
    y = c.y
    bok = j in (0, 1, 10, 11)
    roh = j in (2, 3, 8, 9)
    if bok:
        if 0.55 < y < 0.65 or y > 1.32:
            return 'Lak'
        return 'Sklo'
    if roh:
        return 'Lak'
    if -0.78 < y < 0.10 or y > 1.35:
        return 'Sklo'
    return 'Lak'


s = Sit()
loft(s, [(y, rez_skla(y, zr)) for y, zr in SKLEN], mat_skla, uzavrit=False, cap=False)
# rozdělit: plechová část (Lak) dostane tloušťku, sklo zůstane tenké
s_lak, s_sklo = Sit(), Sit()
for f, m in zip(s.f, s.m):
    cil = s_lak if m == 'Lak' else s_sklo
    novy = []
    for k in f:
        novy.append(cil.bod(s.v[k]))
    cil.plocha(novy, m)


def svar(ob, ven_od=None):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    # dissolve degenerovaných ploch na čelní a zadní hraně
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
    if ven_od is not None:
        for f in bm.faces:
            f.normal_update()
            stred = f.calc_center_median()
            smer = stred - Vector(ven_od)
            smer.x *= 1.0
            if f.normal.dot(smer) < 0:
                f.normal_flip()
    bm.to_mesh(ob.data)
    bm.free()


strecha = s_lak.objekt('Strecha', prepocet=False)
svar(strecha, (0, 0.5, 0.9))
m = strecha.modifiers.new('S', 'SOLIDIFY')
m.thickness, m.offset, m.use_rim, m.use_even_offset = 0.03, -1, True, True
aplikuj_mod(strecha, m)
hladit(strecha, 50)
okna = s_sklo.objekt('Okna', prepocet=False)
svar(okna, (0, 0.5, 0.9))
hladit(okna, 30)

# ---- detaily na povrchu (raycast na karoserii)
bvh = BVHTree.FromObject(karoserie, bpy.context.evaluated_depsgraph_get())


def na_povrch(odkud, smer):
    hit, nrm, _, _ = bvh.ray_cast(Vector(odkud), Vector(smer).normalized())
    return hit, nrm


DET = Sit()


def dil(rozmer, poloha, mat, r=0.01, seg=1, natoceni=None, normala=None):
    """Zaoblený kvádr; volitelně natočený tak, aby jeho lokální −Y mířilo podél `normala`."""
    bm = zaobleny_kvadr(rozmer, r, seg)
    R = Matrix.Identity(3)
    if normala is not None:
        R = Vector(normala).to_track_quat('-Y', 'Z').to_matrix()
    if natoceni is not None:
        R = Euler([math.radians(a) for a in natoceni], 'XYZ').to_matrix() @ R
    for v in bm.verts:
        v.co = R @ v.co + Vector(poloha)
    DET.pridej_bm(bm, mat)
    bm.free()


def nalep(odkud, smer, rozmer, mat, hloubka_ven=0.008, r=0.01, seg=1, mat_fn=None):
    """Plochý díl přilepený na karoserii: lokální Y = tloušťka podél normály."""
    hit, nrm = na_povrch(odkud, smer)
    if hit is None:
        print('MINUTO', odkud, smer)
        return
    nrm = Vector(nrm)
    stred = hit + nrm * (hloubka_ven - rozmer[1] / 2)
    dil(rozmer, stred, mat, r, seg, normala=-nrm)


for sx in (1, -1):
    # přední světla (protáhlá, kopírují roh přídě)
    for k, (x, z) in enumerate(((0.53, 0.655), (0.65, 0.65), (0.76, 0.64))):
        nalep((x * sx, -3, z), (0, 1, 0), (0.13, 0.06, 0.085 - 0.01 * k), 'Svetla', 0.012, 0.02)
    nalep((0.65 * sx, -3, 0.598), (0, 1, 0), (0.30, 0.03, 0.012), 'Plast', 0.006, 0.004)
    # mlhovky / spodní sání po stranách
    nalep((0.6 * sx, -3, 0.40), (0, 1, 0), (0.2, 0.04, 0.06), 'Plast', 0.006, 0.02)
    # zadní světla – obtočená kolem rohu
    for k, (x, z) in enumerate(((0.52, 0.87), (0.66, 0.875), (0.77, 0.87))):
        nalep((x * sx, 3, z), (0, -1, 0), (0.15, 0.06, 0.095), 'Koncova', 0.012, 0.012)
    hit, nrm = na_povrch((3 * sx, 1.97, 0.87), (-sx, 0, 0))
    dil((0.06, 0.11, 0.09), hit - Vector(nrm) * 0.045, 'Koncova', 0.015, 1, normala=-Vector(nrm))
    # kliky dveří
    for yk in (0.12, 1.02):
        hit, nrm = na_povrch((3 * sx, yk, 0.86), (-sx, 0, 0))
        dil((0.16, 0.03, 0.03), hit + Vector(nrm) * 0.008, 'Chrom', 0.012, 1, normala=-Vector(nrm),
            natoceni=None)
    # spáry dveří (tenké tmavé proužky po boku)
    for yk in (-0.76, 0.60, 1.56):
        bod = []
        for z in [0.36 + (rez_v(yk)[2] - 0.05 - 0.36) * k / 6 for k in range(7)]:
            hit, nrm = na_povrch((3 * sx, yk, z), (-sx, 0, 0))
            if hit is not None:
                bod.append((hit + Vector(nrm) * 0.0025, Vector(nrm)))
        for (a, na), (b, nb) in zip(bod, bod[1:]):
            d = Vector((0, 0.0045, 0))
            q = [DET.bod(a - d), DET.bod(a + d), DET.bod(b + d), DET.bod(b - d)]
            if sx < 0:
                q.reverse()
            DET.plocha(q if sx > 0 else q, 'Plast')
    # zrcátka: patka + pouzdro + sklíčko
    zx = 0.86 * sx
    dil((0.10, 0.10, 0.05), (zx, -0.64, 0.96), 'Plast', 0.015)
    dil((0.17, 0.10, 0.11), (0.97 * sx, -0.61, 1.02), 'Lak', 0.035, 2, natoceni=(0, 0, 8 * sx))
    dil((0.14, 0.01, 0.085), (0.975 * sx, -0.562, 1.02), 'Plast', 0.004, 1, natoceni=(0, 0, 8 * sx))
    # lemy podběhů (plastové oblouky)
    for yk in (-ROZVOR, ROZVOR):
        n = 11
        vnej, vnit = [], []
        for k in range(n + 1):
            a = math.radians(180 - 180 * k / n)
            yy, zz = yk + math.cos(a) * 0.385, 0.35 + math.sin(a) * 0.385
            hit, nrm = na_povrch((3 * sx, yy + math.cos(a) * 0.03, zz + math.sin(a) * 0.03), (-sx, 0, 0))
            xs = (hit.x if hit is not None else 0.9 * sx) + 0.012 * sx
            o = Vector((0, math.cos(a), math.sin(a)))
            vnit.append(DET.bod(Vector((xs, yy, zz)) - o * 0.0))
            vnej.append(DET.bod(Vector((xs, yy, zz)) + o * 0.05))
            if k == 0 or k == n:
                pass
        for k in range(n):
            q = [vnit[k], vnej[k], vnej[k + 1], vnit[k + 1]]
            DET.plocha(q, 'Plast')
            DET.plocha(list(reversed(q)), 'Plast')     # oboustranně (tenký lem)

# maska: mřížka chladiče s lamelami, logo, SPZ, spodní sání
hit, nrm = na_povrch((0, -3, 0.55), (0, 1, 0))
dil((0.74, 0.06, 0.14), (0, hit.y + 0.012, 0.55), 'Plast', 0.03, 1)
for k in range(3):
    dil((0.70, 0.012, 0.012), (0, hit.y - 0.022, 0.512 + k * 0.038), 'Chrom', 0.0)
dil((0.07, 0.02, 0.05), (0, hit.y - 0.03, 0.62), 'Chrom', 0.012, 1)
hit, nrm = na_povrch((0, -3, 0.41), (0, 1, 0))
dil((0.52, 0.03, 0.115), (0, hit.y - 0.005, 0.41), 'SPZ', 0.008)
dil((0.9, 0.04, 0.05), (0, hit.y + 0.0, 0.325), 'Plast', 0.015)
hit, nrm = na_povrch((0, 3, 0.62), (0, -1, 0))
dil((0.52, 0.03, 0.115), (0, hit.y + 0.008, 0.62), 'SPZ', 0.008)
dil((1.2, 0.05, 0.1), (0, hit.y - 0.005, 0.40), 'Plast', 0.02)        # zadní difuzor
dil((0.08, 0.1, 0.05), (-0.45, hit.y, 0.33), 'Chrom', 0.02)             # výfuk
# stěrače
for x in (0.05, 0.5):
    dil((0.48, 0.015, 0.012), (x - 0.2, -0.775, 0.955), 'Plast', 0.0, 1, natoceni=(0, 0, 6))
# zadní stěrač a třetí brzdové
dil((0.26, 0.015, 0.012), (0, 1.86, 1.09), 'Plast', 0.0)
dil((0.3, 0.03, 0.025), (0, 1.38, 1.44), 'Koncova', 0.0)
detaily = DET.objekt('Detaily', prepocet=False)
hladit(detaily, 35)

# ---- interiér
I = Sit()


def idil(rozmer, poloha, mat, r=0.02, seg=2, natoceni=None):
    bm = zaobleny_kvadr(rozmer, r, seg)
    R = Euler([math.radians(a) for a in (natoceni or (0, 0, 0))], 'XYZ').to_matrix()
    for v in bm.verts:
        v.co = R @ v.co + Vector(poloha)
    I.pridej_bm(bm, mat)
    bm.free()


# palubní deska: spodní blok, horní šikmá část pod čelním sklem, kryt budíků, displeje, větrání
idil((1.48, 0.42, 0.24), (0, -0.42, 0.76), 'Interier', 0.05, 1)
idil((1.48, 0.40, 0.07), (0, -0.50, 0.89), 'Interier', 0.03, 1, natoceni=(-10, 0, 0))
idil((0.30, 0.12, 0.07), (0.38, -0.25, 0.925), 'Plast', 0.03, 1)
idil((0.26, 0.012, 0.075), (0.38, -0.192, 0.90), 'Displej', 0.0, 1, natoceni=(-10, 0, 0))
idil((0.24, 0.02, 0.15), (0, -0.20, 0.85), 'Displej', 0.01, 1, natoceni=(-12, 0, 0))
for x in (-0.55, -0.2, 0.2, 0.62):
    idil((0.1, 0.02, 0.04), (x, -0.205, 0.82), 'Plast', 0.0, 1)
idil((0.20, 0.60, 0.22), (0, 0.02, 0.52), 'Interier', 0.04, 1)        # středový tunel
idil((0.05, 0.05, 0.12), (0, 0.02, 0.66), 'Plast', 0.02, 1)           # řadicí páka
# sedadla
for x in (0.38, -0.38):
    idil((0.48, 0.48, 0.13), (x, 0.24, 0.52), 'Sedacky', 0.05, 1, natoceni=(-4, 0, 0))
    idil((0.48, 0.12, 0.58), (x, 0.56, 0.86), 'Sedacky', 0.05, 1, natoceni=(-14, 0, 0))
    idil((0.26, 0.09, 0.17), (x, 0.65, 1.24), 'Sedacky', 0.04, 1, natoceni=(-10, 0, 0))
    idil((0.03, 0.03, 0.12), (x - 0.07, 0.64, 1.13), 'Plast', 0.0, 1)
    idil((0.03, 0.03, 0.12), (x + 0.07, 0.64, 1.13), 'Plast', 0.0, 1)
idil((1.18, 0.46, 0.13), (0, 1.15, 0.52), 'Sedacky', 0.05, 1)
idil((1.18, 0.13, 0.52), (0, 1.48, 0.84), 'Sedacky', 0.05, 1, natoceni=(-12, 0, 0))
for sx in (1, -1):
    idil((0.19, 0.84, 0.36), (0.655 * sx, 1.30, 0.58), 'Interier', 0.04, 1)      # kryty podběhů
    idil((0.06, 1.0, 0.10), (0.73 * sx, 0.10, 0.72), 'Interier', 0.02, 1)       # loketní opěrky ve dveřích
idil((1.40, 0.30, 0.03), (0, 1.80, 0.98), 'Interier', 0.0, 1)                 # roleta kufru
interier = I.objekt('Interier', prepocet=False)
hladit(interier, 40)

# ---- volant: sloupek (natočený prázdný uzel) → Volant (lokálně kruh v rovině XZ, osa = lokální Y)
sloupek = bpy.data.objects.new('VolantSloupek', None)
scena.collection.objects.link(sloupek)
sloupek.location = (0.38, -0.08, 0.86)
sloupek.rotation_euler = (math.radians(-24), 0, 0)
V = Sit()
n, m_ = 18, 5
idx = []
for k in range(n):
    a = 2 * math.pi * k / n
    c = Vector((math.cos(a) * 0.17, 0, math.sin(a) * 0.17))
    radial = Vector((math.cos(a), 0, math.sin(a)))
    rada = []
    for j in range(m_):
        b = 2 * math.pi * j / m_
        rada.append(V.bod(c + radial * math.cos(b) * 0.016 + Vector((0, 1, 0)) * math.sin(b) * 0.02))
    idx.append(rada)
for k in range(n):
    for j in range(m_):
        V.plocha((idx[k][j], idx[k][(j + 1) % m_], idx[(k + 1) % n][(j + 1) % m_], idx[(k + 1) % n][j]), 'Plast')
for uhel in (0, 180, 270):
    bm = zaobleny_kvadr((0.16, 0.02, 0.035), 0.008, 1)
    R = Matrix.Rotation(math.radians(uhel), 3, 'Y')
    for v in bm.verts:
        v.co = R @ (v.co + Vector((0.085, 0.01, 0)))
    V.pridej_bm(bm, 'Plast')
    bm.free()
bm = zaobleny_kvadr((0.09, 0.05, 0.08), 0.02, 2)
for v in bm.verts:
    v.co += Vector((0, 0.01, -0.005))
V.pridej_bm(bm, 'Interier')
bm.free()
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.03, radius2=0.03, depth=0.22)
for v in bm.verts:
    v.co = Vector((v.co.x, -v.co.z - 0.12, v.co.y))
V.pridej_bm(bm, 'Plast')       # sloupek (točí se s volantem, nevadí)
bm.free()
volant = V.objekt('Volant', prepocet=True)
volant.parent = sloupek
hladit(volant, 60)

# ---- kola: pneumatika (rotační profil kolem osy X) + disk s pěti paprsky
def kolo(jmeno, sx, sy):
    K = Sit()
    seg = 18
    prof = [(0.215, -0.095), (0.27, -0.108), (0.312, -0.103), (0.33, -0.075), (0.333, 0.0),
            (0.33, 0.075), (0.312, 0.103), (0.27, 0.108), (0.215, 0.095)]       # (r, x) – uzavřená smyčka
    idx = []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        idx.append([K.bod((x * sx, math.cos(a) * r, math.sin(a) * r)) for r, x in prof])
    p = len(prof)
    for k in range(seg):
        for j in range(p):
            q = [idx[k][j], idx[k][(j + 1) % p], idx[(k + 1) % seg][(j + 1) % p], idx[(k + 1) % seg][j]]
            K.plocha(q, 'Pneu')
    # ráfek: miska od pneumatiky do středu (otevřená, ven otočená k +sx)
    rprof = [(0.218, 0.088), (0.205, 0.08), (0.19, 0.045), (0.07, 0.04), (0.045, 0.07), (0.0, 0.072)]
    ridx = []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        ridx.append([K.bod((x * sx, math.cos(a) * r, math.sin(a) * r)) for r, x in rprof])
    for k in range(seg):
        for j in range(len(rprof) - 1):
            q = [ridx[k][j], ridx[(k + 1) % seg][j], ridx[(k + 1) % seg][j + 1], ridx[k][j + 1]]
            mat = 'Plast' if j == 2 else 'Disk'
            K.plocha(q, mat)
    for u in range(5):
        bm = zaobleny_kvadr((0.03, 0.15, 0.04), 0.0, 1)
        R = Matrix.Rotation(2 * math.pi * u / 5 + 0.3, 3, 'X')
        for v in bm.verts:
            v.co = R @ (v.co + Vector((0.065 * sx, 0.115, 0)))
        K.pridej_bm(bm, 'Disk')
        bm.free()
    ob = K.objekt(jmeno, prepocet=False)
    # pneumatika je uzavřená → normály přepočítat; disk otočit ven
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        c = f.calc_center_median()
        if math.hypot(c.y, c.z) < 0.205 and f.normal.x * sx < 0 and abs(f.normal.x) > 0.3:
            f.normal_flip()
    bm.to_mesh(ob.data)
    bm.free()
    hladit(ob, 45)
    ob.location = (ROZCHOD * sx, ROZVOR * sy, R_KOLA)
    return ob


kola = [kolo('Kolo_PL', 1, -1), kolo('Kolo_PP', -1, -1), kolo('Kolo_ZL', 1, 1), kolo('Kolo_ZP', -1, 1)]

koren = bpy.data.objects.new('Auto', None)
scena.collection.objects.link(koren)
for o in [karoserie, strecha, okna, detaily, interier, sloupek] + kola:
    o.parent = koren
AUTO = [koren, karoserie, strecha, okna, detaily, interier, sloupek, volant] + kola
for o in AUTO:
    if o.type == 'MESH':
        print('AUTO', o.name, trojuhelniky(o))
print('AUTO trojúhelníků celkem:', sum(trojuhelniky(o) for o in AUTO if o.type == 'MESH'))

# ======================================================================== export
def export(objekty, cesta, animace_ano):
    for o in bpy.data.objects:
        o.select_set(o in objekty)
    bpy.ops.export_scene.gltf(
        filepath=cesta, export_format='GLB', use_selection=True, export_yup=True,
        export_animations=animace_ano, export_animation_mode='ACTIONS', export_force_sampling=True, export_anim_slide_to_zero=True,
        export_cameras=False, export_lights=False, export_materials='EXPORT', export_apply=False)
    print('EXPORT OK', cesta, os.path.getsize(cesta), 'B')


export(POSTAVA, os.path.join(VYSTUP, 'postava.glb'), True)
if 'AUTO' in globals():
    export(AUTO, os.path.join(VYSTUP, 'auto.glb'), False)

# ======================================================================== náhledy (Workbench, jen pro kontrolu)
if NAHLED:
    os.makedirs(NAHLED, exist_ok=True)
    svet = bpy.data.worlds.new('Svet')
    svet.color = srgb('#c9dcea')
    scena.world = svet
    scena.render.engine = 'BLENDER_WORKBENCH'
    sh = scena.display.shading
    sh.light, sh.color_type, sh.show_shadows = 'STUDIO', 'MATERIAL', False
    sh.show_backface_culling = True
    sh.show_cavity = True
    scena.render.resolution_x, scena.render.resolution_y = 800, 800
    kam = bpy.data.objects.new('Kamera', bpy.data.cameras.new('Kamera'))
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
    if 'postava' in ZOBR:
        for jm, snimky in (('Stani', (1,)), ('Chuze', (1, 6)), ('Beh', (1, 5)), ('Skok', (4, 7, 11))):
            kostra.animation_data.action = bpy.data.actions[jm]
            for f in snimky:
                scena.frame_set(f)
                foto(f'postava_{jm}_{f}', (2.6, -3.4, 1.5), (0, 0, 0.88), 60)
        kostra.animation_data.action = bpy.data.actions['Stani']
        scena.frame_set(1)
        foto('postava_bok', (4.2, 0, 1.0), (0, 0, 0.88), 60)
        for jm, f in (('Chuze', 1), ('Beh', 1), ('Beh', 5)):
            kostra.animation_data.action = bpy.data.actions[jm]
            scena.frame_set(f)
            foto(f'postava_bok_{jm}_{f}', (4.2, 0, 1.0), (0, 0, 0.88), 60)
        kostra.animation_data.action = bpy.data.actions['Stani']
        scena.frame_set(1)
        foto('postava_hlava', (0.5, -1.2, 1.7), (0, 0, 1.63), 100)
        foto('postava_zezadu', (-1.5, 3.8, 1.3), (0, 0, 0.88), 60)
    if 'auto' in ZOBR and 'AUTO' in globals():
        for o in POSTAVA:
            o.hide_render = True
        foto('auto_predek', (4.5, -6.5, 2.4), (0, 0, 0.6), 45, 1000, 700)
        foto('auto_zadek', (-4.8, 6.2, 2.6), (0, 0, 0.6), 45, 1000, 700)
        foto('auto_bok', (8.5, 0, 0.8), (0, 0, 0.7), 45, 1000, 600)
        foto('auto_shora', (0.01, 0, 10), (0, 0, 0), 45, 700, 1000)
        foto('auto_ridic', (0.38, 0.35, 1.16), (0.38, -5, 1.0), 18, 1000, 620)
        foto('auto_interier', (2.4, 1.6, 2.1), (0, 0.2, 0.8), 30, 1000, 700)
        foto('auto_predek_zblizka', (2.2, -4.2, 1.1), (0, -1.6, 0.65), 45, 1000, 700)
    print('NAHLEDY OK')
