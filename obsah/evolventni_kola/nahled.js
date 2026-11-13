/* Evolventní kola – 3D náhled nad společnou scénou gen3d/scena.js.
   nastav(dily, {tisk, uhel, novyPohled}) – díly {poz, idx, barva, x}; každý díl je ve vlastní skupině
   posunuté o d.x, aby šel natáčet kolem své osy (natoc([φ1, φ2]) – animace záběru; v tiskové poloze se nenatáčí).
   prepni('hrany'|'rez'|'previsy'|'pravitka', h), pohled(jak), png(). */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvor(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 0.95, popis: '3D model kola – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte' });
    const stav = { hrany: true, rez: false, previsy: false, pravitka: false };
    let dily = null, volby = {}, rozmer = 50, prvni = true, skupiny = [];
    const rez = () => (stav.rez ? [s.rovinaRezu] : []);

    function sestav(novyPohled) {
      s.vycisti(); skupiny = [];
      if (!dily || !dily.length) { s.stin(null); s.prekresli(); return; }
      const box = new THREE.Box3();
      for (const d of dily) {
        const sk = new THREE.Group(); sk.position.x = d.x || 0;
        const tridy = volby.tisk && stav.previsy ? G3D.tridyPrevisu(d.poz, d.idx, volby.uhel || 45) : null;
        const g = s.geometrie(d.poz, d.idx, { uhel: 30, barvaTroj: tridy && (t => (tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : null)) });
        const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(d.barva), roughness: 0.45, metalness: 0.08, clearcoat: 0.3, clearcoatRoughness: 0.5, clippingPlanes: rez() });
        if (tridy) {
          const c = new THREE.Color(d.barva), C = g.getAttribute('color').array;
          for (let t = 0; t < tridy.length; t++) if (tridy[t] !== 1 && tridy[t] !== 2) for (let k = 0; k < 3; k++) { C[9 * t + 3 * k] = c.r; C[9 * t + 3 * k + 1] = c.g; C[9 * t + 3 * k + 2] = c.b; }
          mat.color.set(0xffffff); mat.vertexColors = true;
        }
        const mesh = new THREE.Mesh(g, mat); mesh.userData.vlastniMat = true; mesh.userData.zakl = true;
        sk.add(mesh);
        const vn = new THREE.Mesh(g, s.matVnitrek); vn.visible = stav.rez; vn.userData.vnitrek = true; vn.userData.model = false;
        sk.add(vn);
        const mh = new THREE.LineBasicMaterial({ color: s.matHrany.color, transparent: true, opacity: s.matHrany.opacity, clippingPlanes: rez() });
        const hr = s.hrany(d.poz, d.idx, 30, mh); hr.visible = stav.hrany; hr.userData.hrany = true; hr.userData.vlastniMat = true;
        sk.add(hr);
        s.skupina.add(sk); skupiny.push(sk);
        g.computeBoundingBox(); const bb = g.boundingBox.clone(); bb.min.x += sk.position.x; bb.max.x += sk.position.x; box.union(bb);
      }
      const vel = new THREE.Vector3(); box.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      s.mrizka(box, !!volby.tisk);
      s.stin(box, !volby.tisk);
      if (stav.pravitka) s.pravitka(box);
      if (prvni || Math.abs(novy - rozmer) / rozmer > 0.3 || novyPohled) { rozmer = novy; s.pohled(prvni ? 'iso' : 'ponech', box); prvni = false; }
      else { box.getCenter(s.ovl.cil); s.prekresli(); }
    }
    function nastav(d, v = {}) { dily = d; volby = v; sestav(v.novyPohled); }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'previsy' || co === 'pravitka') { sestav(false); return; }
      s.skupina.traverse(o => {
        if (o.userData.hrany) { o.visible = stav.hrany; o.material.clippingPlanes = rez(); }
        if (o.userData.zakl) o.material.clippingPlanes = rez();
        if (o.userData.vnitrek) o.visible = stav.rez;
        if (o.material) o.material.needsUpdate = true;
      });
      s.prekresli();
    }
    function natoc(uhly) {
      if (volby.tisk) return;
      uhly.forEach((u, i) => { if (skupiny[i]) skupiny[i].rotation.z = u; });
      s.prekresli();
    }
    return { nastav, prepni, natoc, pohled: jak => s.pohled(jak), png: s.png, prekresli: s.prekresli, barvy: s.barvy, stav, scena: s };
  }
  window.EVOL_NAHLED = { vytvor };
})();
