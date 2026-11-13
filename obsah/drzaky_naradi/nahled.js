/* ============================================================
   Držáky nářadí – 3D náhled sestavy nad gen3d/scena.js (three.js r128, osa z nahoru).
   Objekty: {sit: {poz, idx}, barva, posun: [x,y,z]} nebo {box: [x0,y0,z0,x1,y1,z1], barva} (box = pozadí: zeď, deska).
   nastav(objekty, {tisk, uhel, liceY, novyPohled}) – liceY = líc sestavy míří k +y (stěna, pegboard) → kamera z druhé strany
   prepni('hrany' | 'rez' | 'previsy' | 'pravitka', h); řez rovinou středem sestavy kolmo k pohledu zepředu.
   ============================================================ */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvor(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 1 });
    const stav = { hrany: true, rez: false, previsy: false, pravitka: false };
    let obj = [], volby = {}, prvni = true, box = null;
    const rez = () => (stav.rez ? [s.rovinaRezu] : []);

    function sestav(novyPohled) {
      s.vycisti();
      box = new THREE.Box3();
      for (const ob of obj) {
        if (ob.box) {
          const [x0, y0, z0, x1, y1, z1] = ob.box;
          const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
          const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: ob.barva, roughness: 0.9, metalness: 0 }));
          m.userData.vlastniMat = true; m.userData.model = false;
          s.skupina.add(m);
          continue;
        }
        const d = ob.posun || [0, 0, 0], P = ob.sit.poz, poz = new Float32Array(P.length);
        for (let i = 0; i < P.length; i += 3) { poz[i] = P[i] + d[0]; poz[i + 1] = P[i + 1] + d[1]; poz[i + 2] = P[i + 2] + d[2]; }
        const tridy = volby.tisk && stav.previsy ? G3D.tridyPrevisu(poz, ob.sit.idx, volby.uhel || 45) : null;
        const g = s.geometrie(poz, ob.sit.idx, { uhel: 30, barvaTroj: tridy && (t => (tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : null)) });
        const barva = new THREE.Color(ob.barva);
        const mat = new THREE.MeshPhysicalMaterial({ color: barva, roughness: ob.drevo ? 0.85 : 0.5, metalness: 0.03, clearcoat: ob.drevo ? 0 : 0.25, clearcoatRoughness: 0.5, clippingPlanes: rez() });
        if (tridy) {
          const C = g.getAttribute('color').array;
          for (let t = 0; t < tridy.length; t++) if (tridy[t] !== 1 && tridy[t] !== 2) for (let k = 0; k < 3; k++) { C[9 * t + 3 * k] = barva.r; C[9 * t + 3 * k + 1] = barva.g; C[9 * t + 3 * k + 2] = barva.b; }
          mat.color.set(0xffffff); mat.vertexColors = true;
        }
        const mesh = new THREE.Mesh(g, mat); mesh.userData.vlastniMat = true; mesh.userData.zakl = true;
        s.skupina.add(mesh);
        const vn = new THREE.Mesh(g, s.matVnitrek); vn.visible = stav.rez; vn.userData.vnitrek = true; vn.userData.model = false;
        s.skupina.add(vn);
        if (!ob.drevo) {
          const mh = new THREE.LineBasicMaterial({ color: s.matHrany.color, transparent: true, opacity: s.matHrany.opacity, clippingPlanes: rez() });
          const hr = s.hrany(poz, ob.sit.idx, 30, mh); hr.visible = stav.hrany; hr.userData.hrany = true; hr.userData.vlastniMat = true;
          s.skupina.add(hr);
        }
        g.computeBoundingBox(); box.union(g.boundingBox);
      }
      if (box.isEmpty()) box.set(new THREE.Vector3(-50, -50, 0), new THREE.Vector3(50, 50, 50));
      // řez středem sestavy; ponechá polovinu dál od kamery (pohled zepředu)
      const st = new THREE.Vector3(); box.getCenter(st);
      if (volby.liceY) s.rovinaRezu.set(new THREE.Vector3(0, -1, 0), st.y); else s.rovinaRezu.set(new THREE.Vector3(0, 1, 0), -st.y);
      s.mrizka(box, !!volby.tisk);
      s.stin(box, !volby.tisk && !volby.liceY);
      if (stav.pravitka) s.pravitka(box);
      if (prvni || novyPohled) { pohled(prvni ? 'iso' : novyPohled === true ? 'ponech' : novyPohled); prvni = false; }
      else s.prekresli();
    }
    /** Pohled; u stěny a pegboardu je líc ve směru +y → otočit azimut o 180°. */
    function pohled(jak) {
      const u = G3D.POHLEDY[jak];
      if (u && volby.liceY) s.pohled({ azimut: u[0] + Math.PI, elevace: jak === 'iso' ? 0.32 : u[1] }, box);
      else s.pohled(jak, box);
    }
    function nastav(o, v = {}) { obj = o || []; volby = v; sestav(v.novyPohled); }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'previsy' || co === 'pravitka') { sestav(false); return; }
      for (const o of s.skupina.children) {
        if (o.userData.hrany) { o.visible = stav.hrany; o.material.clippingPlanes = rez(); }
        if (o.userData.zakl) o.material.clippingPlanes = rez();
        if (o.userData.vnitrek) o.visible = stav.rez;
        if (o.material) o.material.needsUpdate = true;
      }
      s.prekresli();
    }
    return { nastav, pohled, prepni, png: s.png, prekresli: s.prekresli, barvy: s.barvy, stav, scena: s };
  }
  window.DN_NAHLED = { vytvor };
})();
