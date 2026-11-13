/* Klíčenky – 3D náhled nad společnou scénou gen3d/scena.js: díly v barvách filamentu, podložka, roviny výměny barvy,
   převisy barevně, pravítka. Tažení = otáčení, pravé tlačítko / Shift = posun, kolečko = zoom, dva prsty = zoom + posun. Osa Z nahoru.
   API: vytvorNahled(kontejner) → {nastav(dily, vysky), pohled(jak), prepni(co, h), png(), barvy(cara, hrana), prekresli(), stav, ovl} */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 0.95, pohledy: { iso: [-1.35, 0.9] } });
    const matRovina = new THREE.MeshBasicMaterial({ color: 0xe08a2c, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const matRam = new THREE.LineBasicMaterial({ color: 0xe08a2c });
    const stav = { hrany: true, roviny: true, previsy: false, pravitka: false };
    let dily = null, vysky = [], rozmer = 60, ma = false;

    function barvy(cara, hrana) { s.barvy(cara, cara, hrana); }
    /** dily = [{poz, idx, barva}], vysky = z rovin výměny barvy / pauzy. */
    function nastav(d, v) { dily = d && d.length ? d : null; vysky = v || []; sestav(true); }
    function sestav(novaData) {
      s.vycisti();
      if (!dily) { ma = false; s.prekresli(); return; }
      const box = new THREE.Box3();
      for (const d of dily) {
        const tridy = stav.previsy ? G3D.tridyPrevisu(d.poz, d.idx, 45, 0) : null;
        const g = s.geometrie(d.poz, d.idx, { uhel: 30, barvaTroj: tridy && (t => (tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : null)) });
        const mat = new THREE.MeshStandardMaterial({ color: d.barva, roughness: 0.55, metalness: 0.02 });
        if (tridy) {
          const c = new THREE.Color(d.barva), C = g.getAttribute('color').array;
          for (let t = 0; t < tridy.length; t++) if (tridy[t] !== 1 && tridy[t] !== 2) for (let k = 0; k < 3; k++) { C[9 * t + 3 * k] = c.r; C[9 * t + 3 * k + 1] = c.g; C[9 * t + 3 * k + 2] = c.b; }
          mat.color.set(0xffffff); mat.vertexColors = true;
        }
        const mesh = new THREE.Mesh(g, mat); mesh.userData.vlastniMat = true;
        s.skupina.add(mesh);
        const hr = s.hrany(d.poz, d.idx, 35); hr.visible = stav.hrany; hr.userData.hrany = true; hr.userData.model = false;
        s.skupina.add(hr);
        g.computeBoundingBox(); box.union(g.boundingBox);
      }
      const vel = new THREE.Vector3(); box.getSize(vel);
      const stred = new THREE.Vector3(); box.getCenter(stred);
      for (const z of vysky) {
        // rám roviny výměny kolem modelu + slabá výplň těsně nad rozhraním (ne v něm – jinak bliká se stěnou)
        const sx = vel.x / 2 + 6, sy = vel.y / 2 + 6;
        const ram = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-sx, -sy], [sx, -sy], [sx, sy], [-sx, sy]].map(([x, y]) => new THREE.Vector3(x, y, 0))), matRam);
        const vypln = new THREE.Mesh(new THREE.PlaneGeometry(2 * sx, 2 * sy), matRovina);
        for (const o of [ram, vypln]) { o.position.set(stred.x, stred.y, z + 0.04); o.visible = stav.roviny; o.renderOrder = 3; o.userData.rovina = true; o.userData.model = false; s.skupina.add(o); }
      }
      s.mrizka(box, true);
      if (stav.pravitka) s.pravitka(box);
      const novy = Math.max(vel.x, vel.y, 10);
      const prvni = !ma;
      ma = true;
      if (novaData && (prvni || Math.abs(novy - rozmer) / rozmer > 0.3)) { rozmer = novy; s.pohled(prvni ? 'iso' : 'ponech', box); }
      else s.prekresli();
    }
    function pohled(jak) { if (ma) s.pohled(jak); }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'previsy' || co === 'pravitka') { sestav(false); return; }
      for (const o of s.skupina.children) {
        if (o.userData.hrany) o.visible = stav.hrany;
        if (o.userData.rovina) o.visible = stav.roviny;
      }
      s.prekresli();
    }
    return { nastav, pohled, prepni, png: s.png, barvy, prekresli: s.prekresli, stav, ovl: s.ovl, scena: s };
  }
  window.KLIC_NAHLED = { vytvorNahled };
})();
