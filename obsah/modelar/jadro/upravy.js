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
      v.typ 'krivka':   cesta [[x, y(, z)], …] ve světě, rovina {bod, u, v, normala} (bez ní vodorovná XY), otevrena,
                        pocet nebo rozestup (mm, > 0 má přednost), od / do (0…1 délky), odsazeni (mm dovnitř uzavřené
                        křivky, záporné ven), natacet (kolem normály roviny podle tečny), naZacatek
      Vrací {dok, kopie, info} (info u křivky: {delka, roztec, pocet}). */
  M.poleUzlu = function (dok, ids, v) {
    const set = new Set(ids);
    let zdroje = dok.uzly.filter(u => set.has(u.id) && !u.zamceno);
    if (!zdroje.length) return { dok, kopie: [] };
    // podél křivky: body v rovině křivky; originál (střed obálky výběru) na začátek – kopie se skládají od něj
    const kr = v.typ === 'krivka' ? M.bodyKrivkyPole(v) : null;
    if (kr && v.naZacatek && kr.body.length) {
      const ob = M.obalkaVice(zdroje), c = new V(...[0, 1, 2].map(i => (ob.min[i] + ob.max[i]) / 2));
      // posun jen v rovině křivky (vzdálenost od ní – výška nad deskou, hloubka díry – zůstane)
      const d = kr.body[0].W.clone().sub(c), n = kr.rovina.n;
      d.addScaledVector(n, -d.dot(n));
      const posunute = new Map(zdroje.map(u => [u.id, M.normalizujUzel(Object.assign({}, u, { poloha: u.poloha.map((x, i) => zaokr(x + d.getComponent(i))) }))]));
      dok = Object.assign({}, dok, { uzly: dok.uzly.map(u => posunute.get(u.id) || u) });
      zdroje = zdroje.map(u => posunute.get(u.id));
    }
    const transformace = [];                             // pro každý prvek pole: {posun, uhel (° kolem Z), stred}
    if (v.typ === 'linearni') {
      const [nx, ny, nz] = (v.pocet || [1, 1, 1]).map(n => Math.max(1, Math.round(n)));
      const d = v.rozestup || [0, 0, 0];
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
        if (i || j || k) transformace.push({ posun: [i * d[0], j * d[1], k * d[2]], uhel: 0 });
    } else if (v.typ === 'krivka') {
      // kopie po délce křivky; originál odpovídá jejímu začátku (posun a natočení podle tečny kolem normály roviny)
      const body = kr.body;
      for (let i = 1; i < body.length; i++) transformace.push({ krivka: { P0: body[0].W, P: body[i].W, n: kr.rovina.n, du: body[i].uhel - body[0].uhel } });
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
      else if (t.krivka) {
        const k = t.krivka, du = v.natacet !== false ? k.du : 0;
        const qa = new THREE.Quaternion().setFromAxisAngle(k.n, du);
        p = p.clone().sub(k.P0).applyQuaternion(qa).add(k.P);
        if (v.natacet !== false) q = qa.clone().multiply(q);
      } else {
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
    return { dok: d, kopie, info: kr ? { delka: kr.delka, roztec: kr.roztec, pocet: kr.body.length } : null };
  };

  /** Body pole podél křivky: {body: [{W (Vector3 ve světě), uhel (tečna v rovině, rad)}], rovina {bod, u, v, n}
      (Vector3), delka (mm použitého úseku), roztec (mm mezi sousedy)}. Viz v.typ 'krivka' u M.poleUzlu. */
  M.bodyKrivkyPole = function (v) {
    const cesta = (v.cesta || []).filter(b => Array.isArray(b) && b.length >= 2);
    const r = v.rovina;
    const rov = r ? { bod: new V(...r.bod), u: new V(...r.u).normalize(), v: new V(...r.v).normalize(), n: new V(...r.normala).normalize() }
      : { bod: new V(0, 0, 0), u: new V(1, 0, 0), v: new V(0, 1, 0), n: new V(0, 0, 1) };
    const prazdne = { body: [], rovina: rov, delka: 0, roztec: 0 };
    if (cesta.length < 2) return prazdne;
    // do 2D roviny křivky (bez roviny: půdorys XY, výška zůstává u kopií)
    let b2 = cesta.map(b => { if (!r) return [b[0], b[1]]; const d = new V(b[0], b[1], b[2] || 0).sub(rov.bod); return [d.dot(rov.u), d.dot(rov.v)]; });
    let uzavrena = !v.otevrena;
    // odstup od uzavřené křivky: kladný dovnitř (díry 5 mm od okraje víka), záporný ven
    if (uzavrena && Math.abs(v.odsazeni || 0) > 1e-9) b2 = odsadUzavrenou(b2, v.odsazeni);
    if (b2.length < 2) return prazdne;
    // délky úseků
    const bb = uzavrena ? b2.concat([b2[0]]) : b2, L = [0];
    for (let i = 0; i + 1 < bb.length; i++) L.push(L[i] + Math.hypot(bb[i + 1][0] - bb[i][0], bb[i + 1][1] - bb[i][1]));
    const celkem = L[L.length - 1];
    if (!(celkem > 1e-9)) return prazdne;
    // úsek od–do: dál jako otevřená křivka (u uzavřené jen když není celá)
    let od = M.omez(+(v.od || 0), 0, 1), doo = M.omez(v.do == null ? 1 : +v.do, 0, 1);
    if (doo < od) [od, doo] = [doo, od];
    let cast = bb, delka = celkem;
    if (od > 1e-9 || doo < 1 - 1e-9) {
      cast = vyrizniUsek(bb, L, od * celkem, doo * celkem);
      uzavrena = false; delka = (doo - od) * celkem;
    }
    if (cast.length < 2 || !(delka > 1e-9)) return prazdne;
    // počet z rozteče: otevřená přesně po rozteči od začátku (úsek se zkrátí), uzavřená rovnoměrně dokola
    let n = Math.max(1, Math.round(v.pocet || 1)), roztec;
    if (v.rozestup > 0) {
      if (uzavrena) { n = Math.max(1, Math.round(delka / v.rozestup)); roztec = delka / n; }
      else {
        n = Math.floor(delka / v.rozestup + 1e-9) + 1; roztec = v.rozestup;
        const Lc = [0];
        for (let i = 0; i + 1 < cast.length; i++) Lc.push(Lc[i] + Math.hypot(cast[i + 1][0] - cast[i][0], cast[i + 1][1] - cast[i][1]));
        if (n > 1) cast = vyrizniUsek(cast, Lc, 0, (n - 1) * v.rozestup);
      }
      n = Math.min(n, 2000);
    } else roztec = uzavrena ? delka / n : (n > 1 ? delka / (n - 1) : 0);
    const do3D = (x, y) => rov.bod.clone().addScaledVector(rov.u, x).addScaledVector(rov.v, y);
    const body = M.bodyNaCeste(uzavrena ? cast.slice(0, -1) : cast, n, uzavrena).map(p => ({ W: do3D(p.x, p.y), uhel: p.uhel }));
    // použitý úsek křivky (pro náhled ve scéně); bez roviny ve výšce prvního kusu se nepočítá – výška 0
    return { body, rovina: rov, delka, roztec, cara: cast.map(([x, y]) => do3D(x, y)) };
  };

  /** Parametry pole uložené ve skupině (Upravit pole): {v, originalu}, nebo null. */
  M.normalizujMetuPole = function (m) {
    if (!m || typeof m !== 'object' || !m.v || !['linearni', 'kruhove', 'spiralove', 'krivka'].includes(m.v.typ)) return null;
    const c = (x, d, a = -1e6, b = 1e6) => typeof x === 'number' && isFinite(x) ? M.omez(x, a, b) : d;
    const t3 = (x, d) => [0, 1, 2].map(i => c(Array.isArray(x) ? x[i] : undefined, d[i]));
    const v = m.v, o = { typ: v.typ };
    if (v.typ === 'linearni') { o.pocet = t3(v.pocet, [1, 1, 1]).map(n => M.omez(Math.round(n), 1, 100)); o.rozestup = t3(v.rozestup, [0, 0, 0]); }
    else {
      o.pocet = M.omez(Math.round(c(v.pocet, 2)), 1, 2000);
      o.natacet = v.natacet !== false;
      if (v.typ === 'kruhove') o.uhel = c(v.uhel, 360, -3600, 3600);
      if (v.typ === 'spiralove') { o.uhelKrok = c(v.uhelKrok, 30, -360, 360); o.stoupaniKrok = c(v.stoupaniKrok, 0); o.polomerKrok = c(v.polomerKrok, 0); }
      if (v.typ !== 'krivka') o.stred = [c((v.stred || [])[0], 0), c((v.stred || [])[1], 0)];
      if (v.typ === 'krivka') {
        const cesta = (Array.isArray(v.cesta) ? v.cesta : []).slice(0, 20000).filter(b => Array.isArray(b) && b.length >= 2 && b.every(x => typeof x === 'number' && isFinite(x)))
          .map(b => b.slice(0, 3).map(x => Math.round(x * 1e6) / 1e6));
        if (cesta.length < 2) return null;
        o.cesta = cesta;
        const r = v.rovina;
        if (r && ['bod', 'u', 'v', 'normala'].every(k => Array.isArray(r[k]) && r[k].length === 3 && r[k].every(x => typeof x === 'number' && isFinite(x))))
          o.rovina = { bod: r.bod.slice(), u: r.u.slice(), v: r.v.slice(), normala: r.normala.slice() };
        o.otevrena = !!v.otevrena; o.naZacatek = v.naZacatek !== false;
        o.rozestup = Math.max(0, c(v.rozestup, 0)); o.odsazeni = c(v.odsazeni, 0, -1e4, 1e4);
        o.od = c(v.od, 0, 0, 1); o.do = c(v.do, 1, 0, 1);
        o.zdroj = v.zdroj === 'skica' ? 'skica' : 'plocha';
        if (typeof v.skica === 'string' && M.idOk(v.skica)) o.skica = v.skica;
      }
    }
    return { v: o, originalu: M.omez(Math.round(c(m.originalu, 1)), 1, 1000) };
  };
  /** Úsek lomené čáry bb (kumulované délky L) mezi vzdálenostmi s0 a s1. */
  function vyrizniUsek(bb, L, s0, s1) {
    const bod = s => {
      let j = 0;
      while (j < L.length - 2 && L[j + 1] < s) j++;
      const l = L[j + 1] - L[j], f = l > 0 ? (s - L[j]) / l : 0;
      return [bb[j][0] + (bb[j + 1][0] - bb[j][0]) * f, bb[j][1] + (bb[j + 1][1] - bb[j][1]) * f];
    };
    const out = [bod(s0)];
    for (let i = 1; i < bb.length - 1; i++) if (L[i] > s0 + 1e-9 && L[i] < s1 - 1e-9) out.push(bb[i]);
    out.push(bod(s1));
    return out;
  }
  /** Uzavřená křivka odsazená o d (kladné dovnitř). Začátek zůstane u původního začátku, směr oběhu stejný. */
  function odsadUzavrenou(b2, d) {
    const CL = globalThis.ClipperLib;
    if (!CL) return b2;
    const S2 = 1e4;
    let cesta = b2.map(([x, y]) => ({ X: Math.round(x * S2), Y: Math.round(y * S2) }));
    const kladna = CL.Clipper.Area(cesta) > 0;
    if (!kladna) cesta = cesta.slice().reverse();
    const co = new CL.ClipperOffset(2, 0.002 * S2);
    co.AddPath(cesta, CL.JoinType.jtRound, CL.EndType.etClosedPolygon);
    const res = new CL.Paths();
    co.Execute(res, -d * S2);
    if (!res.length) return [];
    let nej = res[0];
    for (const x of res) if (Math.abs(CL.Clipper.Area(x)) > Math.abs(CL.Clipper.Area(nej))) nej = x;
    let out = nej.map(q => [q.X / S2, q.Y / S2]);
    if ((CL.Clipper.Area(nej) > 0) !== kladna) out.reverse();
    // začátek u bodu nejbližšího původnímu začátku
    let k = 0, dmin = Infinity;
    out.forEach((q, i) => { const dd = Math.hypot(q[0] - b2[0][0], q[1] - b2[0][1]); if (dd < dmin) { dmin = dd; k = i; } });
    return out.slice(k).concat(out.slice(0, k));
  }

  // ------------------------------------------------------------ reliéf z obrázku a text po kružnici
  /** Uzavřená síť reliéfu z jasu jas[w × h] (0…1, řádky shora dolů): v.sirka (mm, rozměr X), v.vyska (mm reliéfu),
      v.podklad (mm), v.tmaveVys (tmavé místo = vyšší). Vrchní plocha mřížka, spodek rovina, boky svislé. */
  M.sitReliefu = function (jas, w, h, v) {
    const dx = v.sirka / (w - 1), H = (h - 1) * dx, podklad = Math.max(0.2, v.podklad), vys = Math.max(0, v.vyska);
    const poz = new Float32Array(w * h * 2 * 3), idx = [];
    const vrch = (i, j) => j * w + i, spod = (i, j) => w * h + j * w + i;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let t = jas[j * w + i];
      if (v.tmaveVys) t = 1 - t;
      const x = i * dx - v.sirka / 2, y = H / 2 - j * dx;
      poz.set([x, y, podklad + vys * t], vrch(i, j) * 3);
      poz.set([x, y, 0], spod(i, j) * 3);
    }
    for (let j = 0; j + 1 < h; j++) for (let i = 0; i + 1 < w; i++) {
      // řádky jdou dolů (y klesá): vrch proti hodinám při pohledu shora
      idx.push(vrch(i, j), vrch(i, j + 1), vrch(i + 1, j + 1), vrch(i, j), vrch(i + 1, j + 1), vrch(i + 1, j));
      idx.push(spod(i, j), spod(i + 1, j + 1), spod(i, j + 1), spod(i, j), spod(i + 1, j), spod(i + 1, j + 1));
    }
    // boky: obvod mřížky dokola
    const obvod = [];
    for (let i = 0; i < w; i++) obvod.push([i, 0]);
    for (let j = 1; j < h; j++) obvod.push([w - 1, j]);
    for (let i = w - 2; i >= 0; i--) obvod.push([i, h - 1]);
    for (let j = h - 2; j >= 1; j--) obvod.push([0, j]);
    for (let k = 0; k < obvod.length; k++) {
      const a = obvod[k], b = obvod[(k + 1) % obvod.length];
      const at = vrch(...a), bt = vrch(...b), ab = spod(...a), bb = spod(...b);
      idx.push(at, bb, ab, at, bt, bb);
    }
    return M.orientujVen({ poz, idx: Uint32Array.from(idx) });
  };

  /** Obrysy textu po kružnici (pro skicu): znaky = [{kontury (mm, účaří y = 0), sirka (posun na další znak)}],
      R = poloměr účaří, stred = úhel středu textu (°, 90 = nahoře), zvenku = čte se zvenku (po směru hodin nahoře). */
  M.textPoKruznici = function (znaky, R, stredUhel = 90, zvenku = true) {
    const celkem = znaky.reduce((s, z) => s + z.sirka, 0), out = [];
    const smer = zvenku ? -1 : 1, a0 = stredUhel * PI / 180 - smer * celkem / R / 2;
    let s = 0;
    for (const z of znaky) {
      const a = a0 + smer * (s + z.sirka / 2) / R;
      // znak vzpřímeně: nahoru = ven (zvenku) nebo dovnitř; střed znaku na úhlu a
      const rot = zvenku ? a - PI / 2 : a + PI / 2, c = Math.cos(rot), sn = Math.sin(rot);
      const px = R * Math.cos(a), py = R * Math.sin(a);
      for (const k of z.kontury) out.push(k.map(([x, y]) => { const xx = x - z.sirka / 2; return [px + xx * c - y * sn, py + xx * sn + y * c]; }));
      s += z.sirka;
    }
    return out;
  };

  // ------------------------------------------------------------ závit na válec
  /** Závit na válec id (kruhový průřez): v.typ 'vnejsi' (horní část válce se zúží na jádro závitu a přidá se
      závitová tyč – průměr = průměr válce) nebo 'vnitrni' (díra se závitem shora, průměr v.prumer).
      v.delka (mm od horní podstavy), v.stoupani (0 = podle průměru), v.vule. Vrací {dok, id} (skupina). */
  M.zavitNaValec = function (dok, id, v) {
    const u = M.najdiUzel(dok, id);
    if (!u || u.druh !== 'valec') throw new Error('vyber válec');
    if (Math.abs(u.rozmer[0] - u.rozmer[1]) > 1e-3 * u.rozmer[0]) throw new Error('válec musí mít kruhový průřez (stejný průměr X a Y)');
    if (u.role === 'dira') throw new Error('válec je díra – závit jde jen na plné těleso');
    if (u.rozmer[0] > 500) throw new Error('závit jde udělat na válec do průměru 500 mm');
    const D = u.rozmer[0], H = u.rozmer[2], L = M.omez(Number.isFinite(v.delka) ? v.delka : H / 2, 0.5, H);
    const st = Number.isFinite(v.stoupani) && v.stoupani > 0 ? v.stoupani : 0;
    const q = M.quatUzlu(u), osa = h => new V(0, 0, h).applyQuaternion(q).add(new V(...u.poloha)).toArray().map(x => zaokr(x));
    // dílu (natural z 0 … délka) se poloha udává středem obálky: horní konec v rovině horní podstavy
    if (v.typ === 'vnitrni') {
      const Dz = M.omez(Number.isFinite(v.prumer) && v.prumer > 0 ? v.prumer : D * 0.6, 1, D - 1);
      const dira = M.novyUzel('zavitDira', { param: { velikost: 'vlastni', prumer: Dz, stoupani: st, delka: L, vule: Number.isFinite(v.vule) ? M.omez(v.vule, 0, 2) : 0.2 },
        rotace: u.rotace.slice() }, dok);
      // díra přesahuje o 0,5 mm nahoře i dole (obálka −0,5 … L + 0,5): střed obálky = horní podstava − L/2
      const d1 = M.pridejUzly(dok, [Object.assign(dira, { poloha: osa(H / 2 - L / 2) })]);
      const r = M.seskupUzly(d1, [u.id, dira.id], { nazev: u.nazev + ' se závitem' });
      return { dok: r.dok, id: r.id };
    }
    const vule = Number.isFinite(v.vule) ? M.omez(v.vule, 0, 2) : 0.1;
    const tyc = M.novyUzel('sroub', { param: { velikost: 'vlastni', prumer: D, stoupani: st, delka: L, hlava: 'zadna', vule }, rotace: u.rotace.slice() }, dok);
    const z = M.udajeZavitu({ velikost: 'vlastni', prumer: D, stoupani: st });
    const jadro = Math.max(0.2, D / 2 - vule / 2 - M.hloubkaZavitu(z) + 0.05);        // o chlup přes dno závitu (spojí se)
    // prstenec, který z válce ubere materiál nad jádrem závitu
    const prsten = M.novyUzel('trubka', { rozmer: [D + 2, D + 2, L + 0.02], param: { stena: (D + 2) / 2 - jadro, segmentu: Math.max(48, u.param.segmentu || 48) },
      role: 'dira', rotace: u.rotace.slice(), poloha: osa(H / 2 - L / 2 + 0.01) }, dok);
    let d = M.pridejUzly(dok, [prsten]);
    const g1 = M.seskupUzly(d, [u.id, prsten.id], { nazev: u.nazev });
    d = M.pridejUzly(g1.dok, [Object.assign(tyc, { poloha: osa(H / 2 - L / 2) })]);
    const g2 = M.seskupUzly(d, [g1.id, tyc.id], { nazev: u.nazev + ' se závitem' });
    return { dok: g2.dok, id: g2.id };
  };

  /** Nejdelší obrys skici ve světových souřadnicích (rovina XY): [[x, y], …]. */
  M.cestaZeSkici = function (u, seg = 128) {
    if (!u || u.druh !== 'skica') return [];
    let nej = [], delka = -1;
    for (const t of u.param.tvary || []) for (const k of M.konturyTvaru(t, seg)) {
      let l = 0;
      for (let i = 0; i < k.length; i++) l += Math.hypot(k[(i + 1) % k.length][0] - k[i][0], k[(i + 1) % k.length][1] - k[i][1]);
      if (l > delka) { delka = l; nej = k; }
    }
    const m = M.maticeUzlu(u), s = u.stred;
    return nej.map(([x, y]) => { const w = new V(x - s[0], y - s[1], -s[2]).applyMatrix4(m); return [w.x, w.y]; });
  };
  /** Dráha pro tažení ze skici: nejdelší obrys jako body [x, y, z] ve světě (v rovině skici, i natočené).
      Otevřenou dráhu (bez úseku z posledního bodu na první) řeší param uzavrena tažení. */
  M.drahaZeSkici = function (u, seg = 128) {
    if (!u || u.druh !== 'skica') return [];
    let nej = [], delka = -1;
    for (const t of u.param.tvary || []) for (const k of M.konturyTvaru(t, seg)) {
      let l = 0;
      for (let i = 0; i < k.length; i++) l += Math.hypot(k[(i + 1) % k.length][0] - k[i][0], k[(i + 1) % k.length][1] - k[i][1]);
      if (l > delka) { delka = l; nej = k; }
    }
    const m = M.maticeUzlu(u), s = u.stred;
    // otevřená dráha = stejné body, jen tažení nespojí konec se začátkem (param uzavrena)
    return nej.map(([x, y]) => new V(x - s[0], y - s[1], -s[2]).applyMatrix4(m).toArray().map(c => Math.round(c * 1e6) / 1e6));
  };

  /** Tažení profilu (skica idProfil) po dráze (skica idDraha): nová skica v režimu tažení, souřadnice skici = svět.
      Profil se vycentruje na dráhu (střed jeho obrysu leží na křivce). Obě původní skici se skryjí.
      Vrací {dok, id}. */
  M.tazeniZeSkic = function (dok, idProfil, idDraha, { otevrena = false, centrovat = true } = {}) {
    const pr = M.najdiUzel(dok, idProfil), dr = M.najdiUzel(dok, idDraha);
    if (!pr || !dr || pr.druh !== 'skica' || dr.druh !== 'skica') throw new Error('vyber dvě skici: profil a dráhu');
    const body = M.drahaZeSkici(dr);
    if (body.length < 2) throw new Error('skica dráhy nemá žádný obrys');
    let tvary = pr.param.tvary.map(t => Object.assign({}, t));
    if (centrovat) {
      const { stredObrysu: c } = M.bodyObalkySkici(Object.assign({}, pr.param, { rezim: 'vytazeni' }));
      tvary = tvary.map(t => posunTvar(t, -c[0], -c[1]));
    }
    const param = Object.assign({}, pr.param, { tvary, rezim: 'tazeni', draha: 'krivka', drahaBody: body, uzavrena: !otevrena, zkrouceni: 0, horni: 100 });
    delete param.vazby;                  // vazby profilu odkazují na neposunuté tvary – po vycentrování neplatí
    const p = M.normalizujParamSkici(param);
    const r = M.rozmeryTelesaSkici(p);
    const u = M.normalizujUzel({ druh: 'skica', param: p, stred: r.stred, zaklad: r.zaklad, rozmer: r.zaklad, poloha: r.stred,
      nazev: pr.nazev + ' po dráze', barva: pr.barva });
    let d = M.upravUzly(dok, [pr.id, dr.id], { skryto: true });
    d = M.pridejUzly(d, [u]);
    return { dok: d, id: u.id };
  };
  /** Tvar skici posunutý o dx, dy. */
  function posunTvar(t, dx, dy) {
    if (t.typ === 'cesta') return Object.assign({}, t, { body: t.body.map(b => Object.assign({}, b, { x: b.x + dx, y: b.y + dy })) });
    return Object.assign({}, t, { x: (t.x || 0) + dx, y: (t.y || 0) + dy });
  }
  M.posunTvarSkici = posunTvar;

  /** n bodů rovnoměrně po délce lomené čáry (uzavřené: po celém obvodu) s úhlem tečny: [{x, y, uhel}]. */
  M.bodyNaCeste = function (cesta, n, uzavrena = true) {
    const b = cesta.slice();
    if (b.length < 2) return [];
    if (uzavrena) b.push(b[0]);
    const usek = [], L = [0];
    for (let i = 0; i + 1 < b.length; i++) { const l = Math.hypot(b[i + 1][0] - b[i][0], b[i + 1][1] - b[i][1]); usek.push(l); L.push(L[i] + l); }
    const celkem = L[L.length - 1];
    if (!(celkem > 0)) return [];
    const krok = uzavrena ? celkem / n : (n > 1 ? celkem / (n - 1) : 0), out = [];
    /** Bod ve vzdálenosti s po křivce (uzavřená dokola). */
    const bod = s => {
      if (uzavrena) s = ((s % celkem) + celkem) % celkem; else s = Math.max(0, Math.min(celkem, s));
      let j = 0;
      while (j < usek.length - 1 && L[j + 1] < s) j++;
      const f = usek[j] > 0 ? (s - L[j]) / usek[j] : 0, a = b[j], c = b[j + 1];
      return [a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f];
    };
    // tečna: u hladké křivky (kruh z mnohoúhelníku, mírné zlomy) z bodů kousek před a za – úsečka u vrcholu by dala
    // chybu ± půl úseku; když je v okolí ostrý roh (obdélník, lomená čára), směr úseku, na kterém bod leží
    const smer = j => Math.atan2(b[j + 1][1] - b[j][1], b[j + 1][0] - b[j][0]);
    const usekV = s => { let j = 0; while (j < usek.length - 1 && L[j + 1] <= s + 1e-9) j++; while (j < usek.length - 1 && usek[j] < 1e-12) j++; return j; };
    const ns = usek.length;
    // zlom ve vrcholu k (mezi úsekem k − 1 a k); u uzavřené křivky i ve vrcholu 0
    const zlomV = k => {
      if (!uzavrena && (k <= 0 || k >= ns)) return 0;
      const a = smer((k - 1 + ns) % ns), c = smer(k % ns);
      return Math.abs(Math.atan2(Math.sin(c - a), Math.cos(c - a)));
    };
    for (let i = 0; i < n; i++) {
      const s = Math.min(celkem, i * krok), p = bod(s), j = usekV(s), e = 0.75 * Math.max(usek[j], 1e-9);
      // ostrý roh v okně ±e (u uzavřené křivky i přes začátek)?
      let ostry = false;
      for (let k = 0; k <= ns && !ostry; k++) {
        let dd = Math.abs(L[k] - s);
        if (uzavrena) dd = Math.min(dd, celkem - dd);
        if (dd < e && zlomV(k) > 15 * Math.PI / 180) ostry = true;
      }
      let uhel;
      if (ostry) uhel = smer(j);
      else {
        const p0 = bod(uzavrena ? s - e : Math.max(0, s - e)), p1 = bod(uzavrena ? s + e : Math.min(celkem, s + e));
        uhel = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      }
      out.push({ x: p[0], y: p[1], uhel });
    }
    return out;
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
    let dx = Math.max(v.rozestup, 0.2), dy = v.rozlozeni === 'sachovnice' ? dx * Math.sqrt(3) / 2 : dx;
    let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    // zadaný počet děr: rozteč dopočítat tak, aby krajní díry ležely na okraji použitelné plochy (vnitřek)
    if (v.pocet && v.pocet[0] >= 1 && v.pocet[1] >= 1) {
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const k of vnitrek) for (const p of k) { a0 = Math.min(a0, p.X / S); a1 = Math.max(a1, p.X / S); b0 = Math.min(b0, p.Y / S); b1 = Math.max(b1, p.Y / S); }
      const [nx0, ny0] = v.pocet.map(n => Math.min(200, Math.round(n)));
      const out = [];
      for (let j = 0; j < ny0; j++) for (let i = 0; i < nx0; i++) {
        const x = nx0 === 1 ? (a0 + a1) / 2 : a0 + (a1 - a0) * i / (nx0 - 1), y = ny0 === 1 ? (b0 + b1) / 2 : b0 + (b1 - b0) * j / (ny0 - 1);
        out.push([x, y]);
      }
      // jen ty uvnitř (u nepravoúhlé plochy krajní body mohou padnout ven)
      const vnitrniP = (x, y) => { let n = 0; for (const k of vnitrek) if (CL.Clipper.PointInPolygon({ X: Math.round(x * S), Y: Math.round(y * S) }, k) !== 0) n += CL.Clipper.Orientation(k) ? 1 : -1; return n > 0; };
      return out.filter(([x, y]) => vnitrniP(x, y)).map(([x, y]) => [zaokr(x, 1e4), zaokr(y, 1e4)]);
    }
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

  /** Skica nakreslená na rovné ploše tělesa: osy skici x = plocha.u, y = plocha.v, z = normála ven
      (díváš se na plochu zvenku), počátek v plocha.bod. volby.operace 'pridat' = vytažení ven o param.vyska,
      'vyriznout' = kapsa do tělesa hloubky param.vyska (skrz = celé těleso); spojit = seskupit s tělesem
      (kapsa vždy). Vrací {dok, id (výsledná skupina nebo skica)}. */
  M.skicaNaPlose = function (dok, id, plocha, param, { operace = 'pridat', skrz = false, spojit = true } = {}) {
    const u = M.najdiUzel(dok, id);
    if (!u) throw new Error('těleso pod skicou už není');
    const n = new V(...plocha.normala), ux = new V(...plocha.u), vy = new V(...plocha.v);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ux, vy, n));
    const presah = 0.25;                                  // kapsa začíná kousek nad povrchem, ať čistě prořízne
    const vyriz = operace === 'vyriznout';
    const hloubka = vyriz ? (skrz ? M.hloubkaPodPlochou(u, plocha.bod, plocha.normala) + 0.5 : param.vyska) : param.vyska;
    const p = Object.assign({}, param, { rezim: 'vytazeni', vyska: vyriz ? hloubka + presah : param.vyska });
    const sk = M.novaSkica(p, vyriz ? { role: 'dira', nazev: 'Kapsa' } : { barva: u.barva }, dok);
    const pocatek = new V(...plocha.bod).addScaledVector(n, vyriz ? -hloubka : 0);
    const poloha = new V(...sk.stred).applyQuaternion(q).add(pocatek);
    const s = M.normalizujUzel(Object.assign({}, sk, { poloha: poloha.toArray().map(x => zaokr(x)), rotace: M.rotaceZQuat(q) }));
    const d1 = M.pridejUzly(dok, [s]);
    if (!vyriz && !spojit) return { dok: d1, id: s.id, skicaId: s.id };
    const r = M.seskupUzly(d1, [id, s.id], { nazev: u.nazev + (vyriz ? ' s kapsou' : '') });
    if (!r.id) return { dok: d1, id: s.id, skicaId: s.id };            // zamčené těleso: skica zůstane vedle
    return { dok: M.upravUzly(r.dok, [r.id], { barva: u.barva }), id: r.id, skicaId: s.id };
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
