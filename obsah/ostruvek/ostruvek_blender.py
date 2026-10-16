"""Ostrůvek – modely pro demo v three.js, postavené skriptem v Blenderu.

Spuštění (bez okna):
    blender -b --factory-startup --python ostruvek_blender.py -- [vystup.glb] [adresar_nahledu]

Vytvoří:
  Ostrov      – low-poly terén ostrova (písek / tráva / skála po ploškách)
  StromJehl, StromList, Ker, Kamen, Krystal, Houba – předlohy rekvizit
  Postava     – skřítek s kostrou a akcemi Stani, Chuze, Radost
Hra si předlohy z GLB vybere podle jména a rozmístí je sama.
"""
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
VYSTUP = argv[0] if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ostruvek.glb')
NAHLED = argv[1] if len(argv) > 1 else None
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scena = bpy.context.scene


def srgb(hexstr):
    """#rrggbb → lineární RGB (Blender pracuje lineárně)."""
    c = [int(hexstr[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def material(jmeno, barva, drsnost=0.85, zar=None, sila=0.0):
    m = bpy.data.materials.new(jmeno)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(barva), 1)
    b.inputs['Roughness'].default_value = drsnost
    if zar:
        b.inputs['Emission Color'].default_value = (*srgb(zar), 1)
        b.inputs['Emission Strength'].default_value = sila
    m.diffuse_color = (*srgb(barva), 1)          # pro náhled ve Workbench
    return m


M = {
    'pisek': material('Pisek', '#e8d49a'),
    'trava': material('Trava', '#6fbf4a'),
    'trava2': material('Trava2', '#5aa83e'),
    'skala': material('Skala', '#8d8a86'),
    'kura': material('Kura', '#7a5232'),
    'jehl': material('Jehlici', '#2f7d4f'),
    'listi': material('Listi', '#4fa83a'),
    'listi2': material('Listi2', '#7cc24a'),
    'kamen': material('Kamen', '#9c9a96', 0.95),
    'krystal': material('Krystal', '#5fe8ff', 0.2, '#1fb8e8', 0.9),
    'klobouk': material('HoubaKlobouk', '#d8402f'),
    'tecky': material('HoubaTecky', '#fff6e8'),
    'kuze': material('Kuze', '#f2c29b'),
    'cepice': material('Cepice', '#d23a3a'),
    'kabat': material('Kabat', '#3c78c8'),
    'pasek': material('Pasek', '#5a3b22'),
    'boty': material('Boty', '#3b2a1e'),
    'oci': material('Oci', '#1d1d24', 0.4),
    'vous': material('Vous', '#f4efe6'),
    'batoh': material('Batoh', '#a0703a'),
}


class Stavba:
    """Skládá díly do jednoho bmeshe; každý díl má materiál a případně skupinu (kost)."""

    def __init__(s):
        s.bm = bmesh.new()
        s.dl = s.bm.verts.layers.deform.verify()
        s.mats, s.skupiny = [], []

    def _hotovo(s, verts, mat, kost, poloha, meritko=(1, 1, 1), chveni=0.0, svar=False):
        if svar:
            bmesh.ops.remove_doubles(s.bm, verts=verts, dist=1e-5)
            verts = [v for v in verts if v.is_valid]
        for v in verts:
            co = Vector((v.co.x * meritko[0], v.co.y * meritko[1], v.co.z * meritko[2]))
            if chveni:
                co += Vector([random.uniform(-chveni, chveni) for _ in range(3)])
            v.co = co + Vector(poloha)
        if mat not in s.mats:
            s.mats.append(mat)
        mi = s.mats.index(mat)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = mi
        if kost:
            if kost not in s.skupiny:
                s.skupiny.append(kost)
            gi = s.skupiny.index(kost)
            for v in verts:
                v[s.dl][gi] = 1.0

    def kvadr(s, rozmer, poloha, mat, kost=None):
        r = bmesh.ops.create_cube(s.bm, size=1.0)
        s._hotovo(r['verts'], mat, kost, poloha, rozmer)

    def kuzel(s, r1, r2, vyska, poloha, mat, seg=8, kost=None, meritko=(1, 1, 1)):
        r = bmesh.ops.create_cone(s.bm, cap_ends=True, cap_tris=True, segments=seg,
                                  radius1=r1, radius2=r2, depth=vyska)
        s._hotovo(r['verts'], mat, kost, poloha, meritko, svar=True)

    def koule(s, polomer, poloha, mat, deleni=1, meritko=(1, 1, 1), chveni=0.0, kost=None):
        r = bmesh.ops.create_icosphere(s.bm, subdivisions=deleni, radius=polomer)
        s._hotovo(r['verts'], mat, kost, poloha, meritko, chveni)

    def objekt(s, jmeno, poloha=(0, 0, 0)):
        me = bpy.data.meshes.new(jmeno)
        s.bm.to_mesh(me)
        s.bm.free()
        for m in s.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(jmeno, me)
        for g in s.skupiny:
            ob.vertex_groups.new(name=g)
        ob.location = poloha
        scena.collection.objects.link(ob)
        return ob


# ---------------------------------------------------------------- terén
def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def vyska(x, y):
    r, uhel = math.hypot(x, y), math.atan2(y, x)
    R = 27 + 3.5 * noise.noise(Vector((math.cos(uhel) * 1.3, math.sin(uhel) * 1.3, 0.5)))
    t = 1 - r / R
    if t < 0:
        return max(-5.0, -0.5 + t * 12)
    h = -0.5 + 1.7 * smooth(t / 0.15)
    h += 1.8 * noise.noise(Vector((x * 0.07, y * 0.07, 2.0))) * smooth((t - 0.1) / 0.3)
    h += 6.5 * math.exp(-((x - 7) ** 2 + (y - 5) ** 2) / 55) * smooth(t / 0.4)
    return h


def teren():
    N, VEL = 64, 88.0
    krok = VEL / N
    verts = []
    for j in range(N + 1):
        for i in range(N + 1):
            x, y = -VEL / 2 + i * krok, -VEL / 2 + j * krok
            if 0 < i < N and 0 < j < N:
                x += random.uniform(-0.35, 0.35) * krok
                y += random.uniform(-0.35, 0.35) * krok
            verts.append((x, y, vyska(x, y)))
    faces = []
    for j in range(N):
        for i in range(N):
            a = j * (N + 1) + i
            b, c, d = a + 1, a + N + 2, a + N + 1
            faces += [(a, b, c), (a, c, d)] if (i + j) % 2 else [(a, b, d), (b, c, d)]
    me = bpy.data.meshes.new('Ostrov')
    me.from_pydata(verts, [], faces)
    me.update()
    for m in ('pisek', 'trava', 'trava2', 'skala'):
        me.materials.append(M[m])
    for p in me.polygons:
        z = sum(me.vertices[v].co.z for v in p.vertices) / 3
        c = p.center
        if p.normal.z < 0.78 or z > 5.2:
            p.material_index = 3
        elif z < 0.45:
            p.material_index = 0
        else:
            p.material_index = 1 if noise.noise(Vector((c.x * 0.15, c.y * 0.15, 7))) > -0.1 else 2
    ob = bpy.data.objects.new('Ostrov', me)
    scena.collection.objects.link(ob)
    return ob


teren()

# ---------------------------------------------------------------- rekvizity (předlohy v řadě mimo ostrov)
RADA_Y = -40.0

s = Stavba()
s.kuzel(0.16, 0.12, 0.8, (0, 0, 0.4), M['kura'], seg=6)
for z, r, h in ((1.15, 1.05, 1.3), (1.85, 0.8, 1.1), (2.45, 0.52, 0.9)):
    s.kuzel(r, 0.0, h, (0, 0, z), M['jehl'], seg=7)
s.objekt('StromJehl', (-9, RADA_Y, 0))

s = Stavba()
s.kuzel(0.18, 0.12, 1.4, (0, 0, 0.7), M['kura'], seg=6)
s.koule(1.05, (0, 0, 1.95), M['listi'], chveni=0.12, meritko=(1, 1, 0.85))
s.koule(0.6, (0.55, 0.3, 2.45), M['listi2'], chveni=0.08)
s.objekt('StromList', (-5.5, RADA_Y, 0))

s = Stavba()
s.koule(0.55, (0, 0, 0.3), M['listi'], chveni=0.1, meritko=(1, 1, 0.7))
s.koule(0.4, (0.45, 0.15, 0.25), M['listi2'], chveni=0.07, meritko=(1, 1, 0.75))
s.objekt('Ker', (-2.5, RADA_Y, 0))

s = Stavba()
s.koule(0.6, (0, 0, 0.18), M['kamen'], chveni=0.14, meritko=(1.15, 0.9, 0.65))
s.objekt('Kamen', (0, RADA_Y, 0))

s = Stavba()
s.kuzel(0.24, 0.0, 0.5, (0, 0, 0.75), M['krystal'], seg=6)
s.kuzel(0.0, 0.24, 0.32, (0, 0, 0.34), M['krystal'], seg=6)
s.objekt('Krystal', (2.2, RADA_Y, 0))

s = Stavba()
s.kuzel(0.07, 0.09, 0.28, (0, 0, 0.14), M['tecky'], seg=6)
s.kuzel(0.26, 0.05, 0.16, (0, 0, 0.34), M['klobouk'], seg=8)
for a in range(3):
    u = a * 2.1
    s.koule(0.035, (math.cos(u) * 0.16, math.sin(u) * 0.16, 0.36), M['tecky'], deleni=1)
s.objekt('Houba', (4.0, RADA_Y, 0))

# ---------------------------------------------------------------- postava (skřítek s kostrou)
# Dívá se k -Y (v glTF to je +Z, kam se dívá i postava v three.js při rotaci 0).
POSTAVA_POL = (7.5, RADA_Y, 0)
kd = bpy.data.armatures.new('PostavaKostra')
kostra = bpy.data.objects.new('Postava', kd)
scena.collection.objects.link(kostra)
bpy.context.view_layer.objects.active = kostra
bpy.ops.object.mode_set(mode='EDIT')
KOSTI = {
    #  jméno       hlava               ocas                  rodič
    'koren':   ((0, 0, 0.0),       (0, 0, 0.42),         None),
    'telo':    ((0, 0, 0.42),      (0, 0, 0.9),          'koren'),
    'hlava':   ((0, 0, 0.9),       (0, 0, 1.35),         'telo'),
    'ruka.L':  ((0.33, 0, 0.86),   (0.33, 0, 0.46),      'telo'),
    'ruka.R':  ((-0.33, 0, 0.86),  (-0.33, 0, 0.46),     'telo'),
    'noha.L':  ((0.13, 0, 0.42),   (0.13, 0, 0.02),      'koren'),
    'noha.R':  ((-0.13, 0, 0.42),  (-0.13, 0, 0.02),     'koren'),
}
for jm, (h, t, _) in KOSTI.items():
    eb = kd.edit_bones.new(jm)
    eb.head, eb.tail, eb.roll = h, t, 0.0
for jm, (_, _, rod) in KOSTI.items():
    if rod:
        kd.edit_bones[jm].parent = kd.edit_bones[rod]
bpy.ops.object.mode_set(mode='OBJECT')

s = Stavba()
for st, x in (('L', 0.13), ('R', -0.13)):
    s.kvadr((0.16, 0.17, 0.34), (x, 0, 0.26), M['kabat'], 'noha.' + st)
    s.kvadr((0.19, 0.27, 0.11), (x, -0.04, 0.055), M['boty'], 'noha.' + st)
    s.kvadr((0.13, 0.13, 0.32), (x * 2.55, 0, 0.7), M['kabat'], 'ruka.' + st)
    s.kvadr((0.12, 0.12, 0.1), (x * 2.55, 0, 0.5), M['kuze'], 'ruka.' + st)
s.kvadr((0.5, 0.36, 0.5), (0, 0, 0.67), M['kabat'], 'telo')
s.kvadr((0.52, 0.38, 0.07), (0, 0, 0.5), M['pasek'], 'telo')
s.kvadr((0.34, 0.16, 0.38), (0, 0.25, 0.7), M['batoh'], 'telo')
s.kvadr((0.44, 0.42, 0.4), (0, 0, 1.12), M['kuze'], 'hlava')
s.kvadr((0.36, 0.1, 0.22), (0, -0.235, 0.98), M['vous'], 'hlava')
s.kvadr((0.08, 0.06, 0.08), (0, -0.235, 1.13), M['kuze'], 'hlava')    # nos
s.kvadr((0.06, 0.02, 0.08), (0.11, -0.215, 1.2), M['oci'], 'hlava')
s.kvadr((0.06, 0.02, 0.08), (-0.11, -0.215, 1.2), M['oci'], 'hlava')
s.kuzel(0.3, 0.0, 0.5, (0, 0.03, 1.55), M['cepice'], seg=8, kost='hlava')
s.kvadr((0.5, 0.48, 0.06), (0, 0, 1.33), M['cepice'], 'hlava')
telo = s.objekt('PostavaTelo')
telo.parent = kostra
mod = telo.modifiers.new('Kostra', 'ARMATURE')
mod.object = kostra

# ---- akce
for pb in kostra.pose.bones:
    pb.rotation_mode = 'XYZ'
kostra.animation_data_create()
st = math.radians


def akce(jmeno, klice):
    """klice: [(snímek, {kost: {'r': (x, y, z) ve stupních, 'p': (x, y, z)}})]"""
    kostra.animation_data.action = None
    for snimek, data in klice:
        for pb in kostra.pose.bones:
            d = data.get(pb.name, {})
            pb.rotation_euler = [st(a) for a in d.get('r', (0, 0, 0))]
            pb.location = d.get('p', (0, 0, 0))
            pb.keyframe_insert('rotation_euler', frame=snimek)
            pb.keyframe_insert('location', frame=snimek)
    a = kostra.animation_data.action
    a.name = jmeno
    a.use_fake_user = True
    return a


def krok(n):   # n = +1 / -1 – která noha jde dopředu
    return {'noha.L': {'r': (30 * n, 0, 0)}, 'noha.R': {'r': (-30 * n, 0, 0)},
            'ruka.L': {'r': (-28 * n, 0, 0)}, 'ruka.R': {'r': (28 * n, 0, 0)},
            'telo': {'r': (0, 0, 6 * n)}, 'koren': {'p': (0, 0, 0)}}


prechod = {'koren': {'p': (0, 0.06, 0)}, 'telo': {'r': (4, 0, 0)}}   # kost koren míří vzhůru: lokální Y = svět Z
akce('Chuze', [(1, krok(1)), (6, prechod), (11, krok(-1)), (16, prechod), (21, krok(1))])
akce('Stani', [(1, {}),
               (25, {'koren': {'p': (0, -0.015, 0)}, 'hlava': {'r': (0, 0, 7)},
                     'ruka.L': {'r': (0, 0, 4)}, 'ruka.R': {'r': (0, 0, -4)}}),
               (49, {})])
ruce_nahoru = {'ruka.L': {'r': (0, 0, 150)}, 'ruka.R': {'r': (0, 0, -150)}}
akce('Radost', [(1, {}),
                (5, {'koren': {'p': (0, -0.08, 0)}, 'noha.L': {'r': (-10, 0, 0)}, 'noha.R': {'r': (-10, 0, 0)}}),
                (11, {**ruce_nahoru, 'koren': {'p': (0, 0.5, 0)}}),
                (17, {**ruce_nahoru, 'koren': {'p': (0, 0, 0)}}),
                (25, {})])
kostra.animation_data.action = bpy.data.actions['Stani']
kostra.location = POSTAVA_POL

# ---------------------------------------------------------------- export
bpy.ops.export_scene.gltf(
    filepath=VYSTUP, export_format='GLB', export_yup=True,
    export_animation_mode='ACTIONS', export_force_sampling=True,
    export_cameras=False, export_lights=False, export_materials='EXPORT')
print('EXPORT OK', VYSTUP, os.path.getsize(VYSTUP), 'B')

# ---------------------------------------------------------------- náhledy (Workbench, jen pro kontrolu)
if NAHLED:
    os.makedirs(NAHLED, exist_ok=True)
    voda = Stavba()
    voda.kvadr((120, 120, 0.02), (0, 0, -0.01), material('Voda', '#3a9ad9'))
    voda.objekt('Voda')
    svet = bpy.data.worlds.new('Svet')
    svet.color = srgb('#bfe3ff')
    scena.world = svet
    scena.render.engine = 'BLENDER_WORKBENCH'
    sh = scena.display.shading
    sh.light, sh.color_type, sh.show_shadows = 'STUDIO', 'MATERIAL', True
    scena.render.resolution_x, scena.render.resolution_y = 960, 600
    kam = bpy.data.objects.new('Kamera', bpy.data.cameras.new('Kamera'))
    scena.collection.objects.link(kam)
    scena.camera = kam

    def foto(jmeno, odkud, kam_cil, ohnisko=50):
        kam.location = odkud
        kam.data.lens = ohnisko
        kam.rotation_euler = (Vector(kam_cil) - Vector(odkud)).to_track_quat('-Z', 'Y').to_euler()
        scena.render.filepath = os.path.join(NAHLED, jmeno + '.png')
        bpy.ops.render.render(write_still=True)

    foto('ostrov', (38, -62, 42), (0, -4, 0), 35)
    foto('rekvizity', (-1, RADA_Y - 13, 4), (-1, RADA_Y, 1.0), 45)
    for jm, snimky in (('Chuze', (1, 6, 11)), ('Radost', (5, 11)), ('Stani', (25,))):
        kostra.animation_data.action = bpy.data.actions[jm]
        for f in snimky:
            scena.frame_set(f)
            foto(f'postava_{jm}_{f}', (POSTAVA_POL[0] + 2.2, RADA_Y - 3.2, 1.6), (POSTAVA_POL[0], RADA_Y, 0.75), 50)
    print('NAHLEDY OK')
