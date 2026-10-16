/* Modelář 3D – pole a úpravy těles (bez DOM, jde v node; plocha a díry potřebují ClipperLib).
   Pole: lineární (mřížka X × Y × Z), kruhové (kolem svislé osy, volitelně
   natáčet kopie), spirálové (úhel, stoupání a přírůstek poloměru na krok).
   Rozdělení rovinou: z tělesa vzniknou dvě skupiny „těleso − poloprostor“
   (poloprostor = velký kvádr jako díra), takže výsledek zůstane parametrický.
   Vzor děr: rovinná plocha pod kliknutím → 2D oblast (clipper) → středy děr
   v mřížce nebo šachovnici uvnitř oblasti s okrajem → skica s dírami
   vytažená do tělesa a seskupená s ním. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const V = THREE.Vector3, PI = Math.PI;
  const zaokr = (x, d = 1e6) => { const r = Math.round(x * d) / d; return r === 0 ? 0 : r; };

  // ------------------------------------------------------------ pole
  /** Kopie vybraných uzlů v poli. Originál je první prvek pole.
      v.typ 'linearni': pocet [nx, ny, nz], rozestup [dx, dy, dz]
      v.typ 'kruhove':  pocet, uhel (celkový rozsah °; 360 = rovnoměrně dokola), stred [x, y], natacet
      v.typ 'spiralove': pocet, uhelKrok (°), stoupaniKrok (mm), polomerKrok (mm), stred [x, y], natacet
      Vrací {dok, kopie}. */
  M.poleUzlu = function (dok, ids, v) {
    const set = new Set(ids);
    const zdroje = dok.uzly.filter(u => set.has(u.id) && !u.zamceno);
    if (!zdroje.length) return { dok, kopie: [] };
    const transformace = [];                             // pro každý prvek pole: {posun, uhel (° kolem Z), stred}
    if (v.typ === 'linearni') {
      const [nx, ny, nz] = (v.pocet || [1, 1, 1]).map(n => Math.max(1, Math.round(n)));
      const d = v.rozestup || [0, 0, 0];
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
        if (i || j || k) transformace.push({ posun: [i * d[0], j * d[1], k * d[2]], uhel: 0 });
    } else {
      const n = Math.max(1, Math.round(v.pocet || 1));
      const c = v.stred || [0, 0];
      for (let i = 1; i < n; i++) {
        let uhel, z = 0, dr = 0;
        if (v.typ === 'kruhove') {
          const plny = Math.abs(Math.abs(v.uhel) - 360) < 1e-9;
          uhel = plny ? Math.sign(v.uhel) * 360 * i / n : (n > 1 ? v.uhel * i / (n - 1) : 0);   // −360° = celý kruh opačným směrem
        } else { uhel = v.uhelKrok * i; z = (v.stoupaniKrok || 0) * i; dr = (v.polomerKrok || 0) * i; }
        transformace.push({ uhel, z, dr, stred: c });
      }
    }
    const kopie = [], nove = [];
    let d = dok;
    for (const t of transformace) for (const u of zdroje) {
      let p = new V(...u.poloha), q = M.quatUzlu(u);
      if (t.posun) p.add(new V(...t.posun));
      else {
        const c = new V(t.stred[0], t.stred[1], 0), rel = p.clone().sub(c);
        const r = Math.hypot(rel.x, rel.y);
        if (t.dr && r > 1e-9) rel.multiplyScalar(Math.max(0, r + t.dr) / r).setZ(p.z - c.z);
        // těleso přesně ve středu spirály: odstup ve směru otáčení (jinak by spirála nikdy nevyrostla)
        else if (t.dr > 0) rel.set(t.dr, 0, p.z - c.z);
        const qa = new THREE.Quaternion().setFromAxisAngle(new V(0, 0, 1), t.uhel * PI / 180);
        p = rel.applyQuaternion(qa).add(c);
        p.z += t.z;
        if (v.natacet !== false) q = qa.clone().multiply(q);
      }
      const k = M.normalizujUzel(Object.assign(M.noveIdHluboko(u), { zamceno: false, nazev: M.nazevKopie({ uzly: d.uzly.concat(nove) }, u),
        poloha: p.toArray().map(x => zaokr(x)), rotace: M.rotaceZQuat(q) }));
      nove.push(k); kopie.push(k.id);
    }
    d = M.pridejUzly(d, nove);
    return { dok: d, kopie };
  };

  // ------------------------------------------------------------ rozdělení rovinou
  /** Rovina pro rozdělení: osa ('x' | 'y' | 'z'), poloha (mm od středu tělesa podél osy),
      naklonění [a, b] (° kolem dvou os kolmých k ose). Vrací {bod, normala}. */
  M.rovinaRozdeleni = function (u, osa = 'z', poloha = 0, nakloneni = [0, 0]) {
    const ob = M.obalkaUzlu(u);
    const c = [0, 1, 2].map(k => (ob.min[k] + ob.max[k]) / 2);
    const i = 'xyz'.indexOf(osa);
    const n = new V(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
    const kolme = [new V(i === 0 ? 0 : 1, i === 0 ? 1 : 0, 0), null];
    kolme[1] = new V().crossVectors(n, kolme[0]).normalize();
    n.applyAxisAngle(kolme[0], (nakloneni[0] || 0) * PI / 180).applyAxisAngle(kolme[1], (nakloneni[1] || 0) * PI / 180).normalize();
    const bod = new V(...c);
    bod.setComponent(i, c[i] + poloha);
    return { bod: bod.toArray(), normala: n.toArray().map(x => zaokr(x, 1e9)) };
  };

  /** Rozdělí uzel rovinou na dvě skupiny (kladná strana = kam míří normála).
      Každá část je průnik tělesa s poloprostorem – obálka průniku sedí na skutečný díl
      (u řezu podél osy přesně), takže inspektor, položení i kontrola tisku vidí skutečnou velikost.
      mezera = o kolik se kladná část odsune podél normály (záporná zůstane, kde je – spodní díl
      tak zůstane na desce). Vrací {dok, ids: [kladna, zaporna]}. */
  M.rozdelRovinou = function (dok, id, rovina, mezera = 0) {
    const u = M.najdiUzel(dok, id);
    if (!u || u.zamceno) return { dok, ids: [] };
    const ob = M.obalkaUzlu(u);
    const diag = Math.hypot(ob.max[0] - ob.min[0], ob.max[1] - ob.min[1], ob.max[2] - ob.min[2]);
    // poloprostor musí těleso přesahovat; kvádr víc než MAX_ROZMER (10 m) model neunese
    if (diag > 4800) throw new Error('těleso je na rozdělení rovinou příliš velké (víc než 4,8 m)');
    const L = Math.min(4 * diag + 100, 10000);
    const n = new V(...rovina.normala).normalize(), b = new V(...rovina.bod);
    // rovina musí těleso protínat, jinak by jedna část byla prázdná
    // skutečné vrcholy (rohy obálky by u koule pustily rovinu, která ji mine)
    let vMin = Infinity, vMax = -Infinity;
    {
      const vr = M.vrcholyUzlu(u), e = M.maticeUzlu(u).elements;
      for (let i = 0; i < vr.length; i += 3) {
        const x = vr[i], y = vr[i + 1], z = vr[i + 2];
        const d = (e[0] * x + e[4] * y + e[8] * z + e[12] - b.x) * n.x + (e[1] * x + e[5] * y + e[9] * z + e[13] - b.y) * n.y + (e[2] * x + e[6] * y + e[10] * z + e[14] - b.z) * n.z;
        if (d < vMin) vMin = d; if (d > vMax) vMax = d;
      }
    }
    if (vMax < 1e-3 || vMin > -1e-3) throw new Error('rovina těleso neprotíná – posuň ji dovnitř tělesa');
    // mezera: odsune se díl, který je výš (při normále dolů ten záporný) – spodní zůstane na desce
    const odsunout = n.z < -1e-6 ? -1 : 1;
    const q = new THREE.Quaternion().setFromUnitVectors(new V(0, 0, 1), n);
    // poloprostor = obří kvádr jednou stěnou na rovině; „kladný“ leží ve směru normály
    const poloprostor = znamenko => M.novyUzel('kvadr', { role: 'teleso', rozmer: [L, L, L], nazev: 'řez',
      poloha: b.clone().addScaledVector(n, znamenko * L / 2).toArray().map(x => zaokr(x)), rotace: M.rotaceZQuat(q) });
    const cast = (znamenko, nazev) => {
      // díra se řeže jako těleso (průnik s poloprostorem), role se vrátí celé části
      const kopie = Object.assign(M.noveIdHluboko(u), { role: 'teleso', skryto: false });
      const d0 = M.pridejUzly(M.novyDokument(), [kopie, poloprostor(znamenko)]);
      const r = M.seskupUzly(d0, d0.uzly.map(x => x.id), { nazev, operace: 'prunik' });
      let g = M.najdiUzel(r.dok, r.id);
      // seskupení vzalo obálku i s obřím poloprostorem: střed a základ podle obálky průniku
      const v = M.vrcholyUzlu(g), mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[i + k]); mx[k] = Math.max(mx[k], v[i + k]); }
      const st = [0, 1, 2].map(k => zaokr((mn[k] + mx[k]) / 2));
      const zaklad = [0, 1, 2].map(k => Math.max(0.01, zaokr(mx[k] - mn[k])));
      const posun = znamenko === odsunout ? znamenko * mezera : 0;
      g = M.normalizujUzel(Object.assign({}, g, {
        deti: g.deti.map(d => Object.assign({}, d, { poloha: d.poloha.map((x, k) => zaokr(x - st[k])) })),
        poloha: g.poloha.map((x, k) => zaokr(x + st[k] + n.getComponent(k) * posun)),
        zaklad, rozmer: zaklad, barva: u.barva, role: u.role,
      }));
      return g;
    };
    // názvy podle polohy: u vodorovného řezu horní a spodní, jinak podle hlavní osy normály
    const osa = [0, 1, 2].reduce((m, i) => Math.abs(n.getComponent(i)) > Math.abs(n.getComponent(m)) ? i : m, 0);
    const kladne = n.getComponent(osa) > 0;
    const jmena = osa === 2 ? ['horní část', 'spodní část'] : osa === 0 ? ['pravá část', 'levá část'] : ['zadní část', 'přední část'];
    const a = cast(1, `${u.nazev} (${jmena[kladne ? 0 : 1]})`), z = cast(-1, `${u.nazev} (${jmena[kladne ? 1 : 0]})`);
    const uzly = [];
    for (const x of dok.uzly) if (x.id === id) uzly.push(a, z); else uzly.push(x);
    return { dok: Object.assign({}, dok, { uzly }), ids: [a.id, z.id] };
  };

  // ------------------------------------------------------------ rovinná plocha a díry
  const S = 1000;                                        // clipper v µm
  /** Rovinná plocha pod trojúhelníkem t (síť ve světě {poz, idx}): sousední trojúhelníky
      ve stejné rovině. Vrací {bod, normala, u, v, oblast: [[ [u, v], … ], …]} (2D v rovině). */
  M.oblastPlochy = function (sit, t, tolUhel = 0.5, tolVzd = 0.02) {
    const p = sit.poz, idx = sit.idx;
    const vrchol = i => new V(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    const normala = f => {
      const a = vrchol(idx[f * 3]), b = vrchol(idx[f * 3 + 1]), c = vrchol(idx[f * 3 + 2]);
      return new V().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    };
    const n = normala(t), bod = vrchol(idx[t * 3]);
    const cosTol = Math.cos(tolUhel * PI / 180);
    // stejná rovina (normála i vzdálenost); souvislost se zajistí sjednocením v 2D
    const vybrane = [];
    for (let f = 0; f < idx.length / 3; f++) {
      const m = normala(f);
      if (m.dot(n) < cosTol) continue;
      if (Math.abs(vrchol(idx[f * 3]).sub(bod).dot(n)) > tolVzd) continue;
      vybrane.push(f);
    }
    // báze roviny: u = průmět světové X (nebo Y), v = n × u
    let u = new V(1, 0, 0).addScaledVector(n, -n.x);
    if (u.lengthSq() < 1e-6) u = new V(0, 1, 0).addScaledVector(n, -n.y);
    u.normalize();
    const v = new V().crossVectors(n, u);
    const do2D = q => { const d = q.clone().sub(bod); return { X: Math.round(d.dot(u) * S), Y: Math.round(d.dot(v) * S) }; };
    const CL = globalThis.ClipperLib;
    const c = new CL.Clipper();
    for (const f of vybrane) {
      const tri = [0, 1, 2].map(k => do2D(vrchol(idx[f * 3 + k])));
      if (CL.Clipper.Area(tri) < 0) tri.reverse();
      c.AddPath(tri, CL.PolyType.ptSubject, true);
    }
    const strom = new CL.PolyTree();
    c.Execute(CL.ClipType.ctUnion, strom, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    // jen souvislá část, která obsahuje kliknutý trojúhelník
    const tez = [0, 1, 2].map(k => do2D(vrchol(idx[t * 3 + k]))).reduce((s, q) => ({ X: s.X + q.X / 3, Y: s.Y + q.Y / 3 }), { X: 0, Y: 0 });
    const oblast = [];
    for (const vnejsi of strom.Childs()) {
      if (CL.Clipper.PointInPolygon(tez, vnejsi.Contour()) === 0) continue;
      oblast.push(vnejsi.Contour().map(q => [q.X / S, q.Y / S]));
      for (const dira of vnejsi.Childs()) oblast.push(dira.Contour().map(q => [q.X / S, q.Y / S]));
    }
    return { bod: bod.toArray(), normala: n.toArray(), u: u.toArray(), v: v.toArray(), oblast };
  };

  /** Obrys jedné díry se středem [x, y]: tvar 'kruh' | 'sestiuhelnik' | 'ctverec' | 'sterbina'. */
  M.obrysDiry = function (tvar, x, y, velikost, seg = 32) {
    const r = velikost / 2, o = [];
    if (tvar === 'ctverec') return [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]];
    if (tvar === 'sestiuhelnik') { const R = r / Math.cos(PI / 6); for (let i = 0; i < 6; i++) o.push([x + R * Math.cos(PI / 6 + i * PI / 3), y + R * Math.sin(PI / 6 + i * PI / 3)]); return o; }
    if (tvar === 'sterbina') {                         // podélná drážka 3 × šířka, kulaté konce
      const d = velikost, w = d / 3 / 2;
      for (let i = 0; i <= seg / 2; i++) { const a = -PI / 2 + PI * i / (seg / 2); o.push([x + d - w + w * Math.cos(a), y + w * Math.sin(a)]); }
      for (let i = 0; i <= seg / 2; i++) { const a = PI / 2 + PI * i / (seg / 2); o.push([x - d + w + w * Math.cos(a), y + w * Math.sin(a)]); }
      return o;
    }
    for (let i = 0; i < seg; i++) o.push([x + r * Math.cos(2 * PI * i / seg), y + r * Math.sin(2 * PI * i / seg)]);
    return o;
  };

  /** Středy děr v oblasti (2D). volby: tvar, velikost, rozestup (střed–střed), rozlozeni 'mrizka' | 'sachovnice', okraj.
      Díra se celá vejde do oblasti zmenšené o okraj. */
  M.MAX_DER = 5000;
  M.stredyDer = function (oblast, v) {
    const CL = globalThis.ClipperLib;
    const r = v.tvar === 'sterbina' ? v.velikost : v.velikost / 2 / (v.tvar === 'sestiuhelnik' ? Math.cos(PI / 6) : v.tvar === 'ctverec' ? Math.SQRT1_2 : 1);
    const co = new CL.ClipperOffset(2, 0.01 * S);
    co.AddPaths(oblast.map(k => k.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }))), CL.JoinType.jtRound, CL.EndType.etClosedPolygon);
    const vnitrek = new CL.Paths();
    co.Execute(vnitrek, -(v.okraj + r) * S);
    if (!vnitrek.length) return [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const k of oblast) for (const [x, y] of k) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const dx = Math.max(v.rozestup, 0.2), dy = v.rozlozeni === 'sachovnice' ? dx * Math.sqrt(3) / 2 : dx;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const nx = Math.ceil((x1 - x0) / dx) + 2, ny = Math.ceil((y1 - y0) / dy) + 2;
    // statisíce bodů by zamrzly kartu (a tisíce děr stejně nejdou spočítat ani vytisknout)
    if ((2 * nx + 1) * (2 * ny + 1) > 4 * M.MAX_DER) throw new Error(`děr by bylo příliš mnoho (víc než ${M.MAX_DER}) – zvětši rozestup`);
    const vnitrni = (x, y) => {
      // uvnitř = sudý počet obsahujících obrysů po zmenšení (díry v oblasti zůstávají dírami)
      let n = 0;
      for (const k of vnitrek) if (CL.Clipper.PointInPolygon({ X: Math.round(x * S), Y: Math.round(y * S) }, k) !== 0) n += CL.Clipper.Orientation(k) ? 1 : -1;
      return n > 0;
    };
    const out = [];
    for (let j = -ny; j <= ny; j++) for (let i = -nx; i <= nx; i++) {
      const x = cx + i * dx + (v.rozlozeni === 'sachovnice' && j % 2 ? dx / 2 : 0), y = cy + j * dy;
      if (vnitrni(x, y)) out.push([zaokr(x, 1e4), zaokr(y, 1e4)]);
    }
    if (out.length > M.MAX_DER) throw new Error(`děr by bylo ${out.length} (nejvýš ${M.MAX_DER}) – zvětši rozestup`);
    return out;
  };

  /** Hloubka tělesa pod plochou (podél −normály) – pro díry „skrz“. */
  M.hloubkaPodPlochou = function (u, bod, normala) {
    const e = M.maticeUzlu(u).elements, p = M.vrcholyUzlu(u), n = normala, b = bod;
    let max = 0;
    for (let i = 0; i < p.length; i += 3) {
      let d = 0;
      for (let k = 0; k < 3; k++) d += (e[k] * p[i] + e[4 + k] * p[i + 1] + e[8 + k] * p[i + 2] + e[12 + k] - b[k]) * n[k];
      max = Math.max(max, -d);
    }
    return max;
  };

  /** Vzor děr do tělesa: skica s dírami vytažená z plochy dovnitř, seskupená s tělesem.
      plocha = výsledek M.oblastPlochy, volby jako stredyDer + hloubka (0 = skrz).
      Vrací {dok, id (skupina), pocet}. */
  M.vzorDer = function (dok, id, plocha, v) {
    const u = M.najdiUzel(dok, id);
    if (!u || u.zamceno) return { dok, id: null, pocet: 0 };
    const stredy = M.stredyDer(plocha.oblast, v);
    if (!stredy.length) return { dok, id: null, pocet: 0 };
    const hloubka = v.hloubka > 0 ? v.hloubka : M.hloubkaPodPlochou(u, plocha.bod, plocha.normala) + 0.5;
    const preshah = 0.25;                              // díry začínají nad povrchem, ať čistě prořízne
    // skica: osa x = u, osa z = −n (vytažení do tělesa), osa y = z × x = −v → body (a, b) roviny jsou (a, −b)
    const kontury = stredy.map(([a, b]) => M.obrysDiry(v.tvar, a, -b, v.velikost));
    const n = new V(...plocha.normala), ux = new V(...plocha.u), zz = n.clone().negate(), yy = new V().crossVectors(zz, ux);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ux, yy, zz));
    const sk = M.novaSkica({ tvary: [{ typ: 'polygony', kontury, x: 0, y: 0, meritko: 1 }], vyska: hloubka + preshah, segmentu: 32 },
      { role: 'dira', nazev: 'Vzor děr' });
    const pocatek = new V(...plocha.bod).addScaledVector(n, preshah);
    const poloha = new V(...sk.stred).applyQuaternion(q).add(pocatek);
    const s = M.normalizujUzel(Object.assign({}, sk, { poloha: poloha.toArray().map(x => zaokr(x)), rotace: M.rotaceZQuat(q) }));
    const d1 = M.pridejUzly(dok, [s]);
    const r = M.seskupUzly(d1, [id, s.id], { nazev: u.nazev + ' s dírami' });
    const g = M.najdiUzel(r.dok, r.id);
    return { dok: M.upravUzly(r.dok, [r.id], { barva: u.barva }), id: g.id, pocet: stredy.length };
  };

  // ------------------------------------------------------------ přesné úpravy (zaoblení, sražení, skořepina)
  /** Obalí uzel skupinou s jedním dítětem a přesnou úpravou occt (null = jen obal pro výběr hran).
      Souřadnice hran a ploch v occt jsou v přirozených souřadnicích této skupiny. Vrací uzel skupiny. */
  M.obalUpravou = function (u, occt) {
    if (u.druh === 'skupina' && !u.occt) {
      // existující skupina bez úpravy: úprava rovnou na ni (bez dalšího obalu) – i rámec pro výběr hran je ona
      return M.normalizujUzel(Object.assign({}, u, { occt: occt || null }));
    }
    const ob = M.obalkaUzlu(u);
    const c = [0, 1, 2].map(k => zaokr((ob.min[k] + ob.max[k]) / 2));
    const zaklad = [0, 1, 2].map(k => Math.max(0.01, zaokr(ob.max[k] - ob.min[k])));
    const dite = Object.assign(M.noveIdHluboko(u), { poloha: u.poloha.map((x, k) => zaokr(x - c[k])), skryto: false, zamceno: false });
    // přípona podstatným jménem (bez shody v rodě: „Válec 1 (skořepina)“), další úprava se přidá do téže závorky
    const NAZ = { zaobleni: 'zaoblení', srazeni: 'sražení', skorepina: 'skořepina', odsazeni: 'odsazení' };
    const nazev = !occt ? u.nazev : /\((?:zaoblení|sražení|skořepina|odsazení)(?:, (?:zaoblení|sražení|skořepina|odsazení))*\)$/.test(u.nazev)
      ? u.nazev.replace(/\)$/, `, ${NAZ[occt.operace]})`) : `${u.nazev} (${NAZ[occt.operace]})`;
    return M.normalizujUzel({
      druh: 'skupina', id: u.id, nazev, deti: [dite], zaklad, rozmer: zaklad,
      poloha: c, rotace: [0, 0, 0], role: u.role, barva: u.barva, occt,
    });
  };
  /** Odsazení stěn (vůle) o h mm (kladné zvětší, záporné zmenší; 0 = odebrat). Uzel, který už má navrchu
      odsazení, dostane jen novou hodnotu. Základ a rozměr skupiny zahrnou odsazení (inspektor ukazuje skutečnou
      velikost, položení na desku sedí). Vrací nový uzel (stejné id). */
  M.odsadUzel = function (u, h) {
    const sk = u.druh === 'skupina' ? M.meritkoUzlu(u) : [1, 1, 1];
    let zaklad, rozmer, g;
    if (u.druh === 'skupina' && u.occt && u.occt.operace === 'odsazeni') {
      const h0 = u.occt.hodnota;
      zaklad = u.zaklad.map((z, i) => z - 2 * h0 / sk[i]);
      if (Math.abs(h) < 1e-9) {
        // odebrat: obal pryč, dítě zpět na místo obalu (stejné id) – jen obal, který vznikl odsazením
        // (vlastní skupina s jedním dílem zůstane skupinou, jen bez úpravy)
        if (u.deti.length === 1 && /\((?:[^()]*, )?odsazení\)$/.test(u.nazev)) {
          const d = u.deti[0];
          const W = M.maticeUzlu(Object.assign({}, u, { zaklad, rozmer: zaklad.map((z, i) => z * sk[i]) })).multiply(M.maticeUzlu(d));
          const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
          W.decompose(p, q, s);
          return M.normalizujUzel(Object.assign({}, d, { id: u.id, nazev: u.nazev.replace(/ \(odsazení\)$/, '').replace(/, odsazení\)$/, ')'),
            poloha: p.toArray().map(x => zaokr(x)), rotace: M.rotaceZQuat(q),
            rozmer: (M.maZaklad(d) ? d.zaklad : d.rozmer).map((r, i) => zaokr(r * Math.abs(s.getComponent(i)))),
            zrcadlo: [s.x < 0, s.y < 0, s.z < 0], skryto: u.skryto, zamceno: u.zamceno }));
        }
        return M.normalizujUzel(Object.assign({}, u, { occt: null, zaklad, rozmer: zaklad.map((z, i) => z * sk[i]) }));
      }
      g = u;
    } else {
      if (Math.abs(h) < 1e-9) return u;
      g = M.obalUpravou(u, { operace: 'odsazeni', hodnota: h });
      zaklad = g.zaklad;
    }
    const occt = { operace: 'odsazeni', hodnota: h, hrany: [], plochy: [] };
    const sg = g.druh === 'skupina' ? M.meritkoUzlu(g) : sk;
    const z2 = zaklad.map((z, i) => Math.max(0.01, zaokr(z + 2 * h / sg[i])));
    return M.normalizujUzel(Object.assign({}, g, { occt, zaklad: z2, rozmer: z2.map((z, i) => zaokr(z * sg[i])) }));
  };
  /** Rámec pro výběr hran/ploch skupiny s úpravou: tatáž skupina bez úpravy. */
  M.bezUpravy = g => M.normalizujUzel(Object.assign({}, g, { occt: null }));

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
