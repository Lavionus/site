/* Skládačka soukolí – 3D náhled sestavy nad gen3d/scena.js.
   nastav(dily, {tisk, uhel, novyPohled}) – díly {id, sit: {poz, idx}, barva, x, y, z, rot, posun} (sítě v soustavě dílu);
   poloha(id, rot, posun) – jen natočení / posun hřebene při animaci (bez přestavby geometrie);
   prepni('hrany' | 'previsy' | 'pravitka', h). Převisy barevně jen v tiskové poloze. */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 0.95 });
    const stav = { hrany: true, previsy: false, pravitka: false };
    const skupiny = new Map();
    let dily = null, volby = {}, prvni = true, box = null;

    function sestav(novyPohled) {
      s.vycisti(); skupiny.clear();
      if (!dily || !dily.length) { s.stin(null); s.prekresli(); return; }
      box = new THREE.Box3();
      for (const d of dily) {
        const tridy = volby.tisk && stav.previsy ? G3D.tridyPrevisu(d.sit.poz, d.sit.idx, volby.uhel || 45) : null;
        const g = s.geometrie(d.sit.poz, d.sit.idx, { uhel: 30, barvaTroj: tridy && (t => (tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : null)) });
        const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(d.barva || '#4F86D9'), roughness: 0.45, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.5 });
        if (tridy) {   // převisy: barvy trojúhelníků, ostatní v barvě dílu
          const c = new THREE.Color(d.barva || '#4F86D9'), C = g.getAttribute('color').array;
          for (let t = 0; t < tridy.length; t++) if (tridy[t] !== 1 && tridy[t] !== 2) for (let k = 0; k < 3; k++) { C[9 * t + 3 * k] = c.r; C[9 * t + 3 * k + 1] = c.g; C[9 * t + 3 * k + 2] = c.b; }
          mat.color.set(0xffffff); mat.vertexColors = true;
        }
        const vnejsi = new THREE.Group(), vnitrni = new THREE.Group();
        const mesh = new THREE.Mesh(g, mat); mesh.userData.vlastniMat = true;
        const hr = s.hrany(d.sit.poz, d.sit.idx, 30); hr.visible = stav.hrany; hr.userData.hrany = true;
        vnitrni.add(mesh, hr); vnejsi.add(vnitrni);
        vnejsi.position.set(d.x || 0, d.y || 0, d.z || 0); vnejsi.rotation.z = d.rot || 0; vnitrni.position.x = d.posun || 0;
        s.skupina.add(vnejsi);
        skupiny.set(d.id, { vnejsi, vnitrni });
      }
      s.skupina.updateMatrixWorld(true);
      box = s.obalSkupiny();
      s.mrizka(box, !!volby.tisk);
      s.stin(box, !volby.tisk);
      if (stav.pravitka) s.pravitka(box);
      if (prvni || novyPohled) { s.pohled(prvni ? 'iso' : 'ponech', box); prvni = false; }
      else s.prekresli();
    }
    function nastav(d, v = {}) { dily = d; volby = v; sestav(v.novyPohled); }
    function poloha(id, rot, posun) {
      const q = skupiny.get(id); if (!q) return;
      q.vnejsi.rotation.z = rot; q.vnitrni.position.x = posun || 0;
    }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'previsy' || co === 'pravitka') { sestav(false); return; }
      s.skupina.traverse(o => { if (o.userData.hrany) o.visible = stav.hrany; });
      s.prekresli();
    }
    const pohled = jak => s.pohled(jak, box && !box.isEmpty() ? box : undefined);
    return { nastav, poloha, pohled, prepni, png: s.png, prekresli: s.prekresli, barvy: s.barvy, stav, scena: s };
  }
  window.SOUK_NAHLED = { vytvorNahled };
})();
