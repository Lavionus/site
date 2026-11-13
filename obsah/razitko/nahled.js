/* Razítka – 3D náhled nad společnou scénou gen3d/scena.js (stejný jako knofliky/nahled.js, jen bližší a vyšší pohled na reliéf).
   nastav(dily, {tisk, novyPohled}) – díly {poz, idx, barva, barvy}; řez rovinou y = 0 ukáže kapsy a díry uvnitř;
   v tiskové poloze volitelně převisy barevně (stav.previsy, uhel z nastav({uhel})). */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 0.8, pohledy: { iso: [-1.2, 0.8] } });
    const stav = { hrany: true, rez: false, previsy: false, pravitka: false };
    let dily = null, volby = {}, rozmer = 50, prvni = true;
    const rez = () => (stav.rez ? [s.rovinaRezu] : []);

    function sestav(novyPohled) {
      s.vycisti();
      if (!dily || !dily.length) { s.stin(null); s.prekresli(); return; }
      const box = new THREE.Box3();
      for (const d of dily) {
        const tridy = volby.tisk && stav.previsy ? G3D.tridyPrevisu(d.poz, d.idx, volby.uhel || 45) : null;
        const g = s.geometrie(d.poz, d.idx, { uhel: 30, barvyVrcholu: d.barvy, barvaTroj: tridy && (t => (tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : null)) });
        // d.barvy = vlastní barvy vrcholů (např. simulace svícení) – bez stínování scény
        let mat;
        if (d.barvy) mat = new THREE.MeshBasicMaterial({ vertexColors: true, clippingPlanes: rez() });
        else {
          mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(d.barva || '#4F86D9'), roughness: 0.45, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.5, clippingPlanes: rez() });
          if (tridy) {   // převisy: barvy trojúhelníků, ostatní v barvě dílu
            const c = new THREE.Color(d.barva || '#4F86D9'), C = g.getAttribute('color').array;
            for (let t = 0; t < tridy.length; t++) if (tridy[t] !== 1 && tridy[t] !== 2) for (let k = 0; k < 3; k++) { C[9 * t + 3 * k] = c.r; C[9 * t + 3 * k + 1] = c.g; C[9 * t + 3 * k + 2] = c.b; }
            mat.color.set(0xffffff); mat.vertexColors = true;
          }
        }
        const mesh = new THREE.Mesh(g, mat); mesh.userData.vlastniMat = true; mesh.userData.zakl = true;
        s.skupina.add(mesh);
        const vn = new THREE.Mesh(g, s.matVnitrek); vn.visible = stav.rez; vn.userData.vnitrek = true; vn.userData.model = false;
        s.skupina.add(vn);
        const mh = new THREE.LineBasicMaterial({ color: s.matHrany.color, transparent: true, opacity: s.matHrany.opacity, clippingPlanes: rez() });
        const hr = s.hrany(d.poz, d.idx, 30, mh); hr.visible = stav.hrany; hr.userData.hrany = true; hr.userData.vlastniMat = true;
        s.skupina.add(hr);
        g.computeBoundingBox(); box.union(g.boundingBox);
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
      for (const o of s.skupina.children) {
        if (o.userData.hrany) { o.visible = stav.hrany; o.material.clippingPlanes = rez(); }
        if (o.userData.zakl) o.material.clippingPlanes = rez();
        if (o.userData.vnitrek) o.visible = stav.rez;
        if (o.material) o.material.needsUpdate = true;
      }
      s.prekresli();
    }
    const pohled = jak => s.pohled(jak);
    return { nastav, pohled, prepni, png: s.png, prekresli: s.prekresli, barvy: s.barvy, stav, ovl: s.ovl, scena: s.scena };
  }
  window.RAZ_NAHLED = { vytvorNahled };
})();
