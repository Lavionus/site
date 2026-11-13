/* Brýlové obroučky – 3D náhled nad společnou scénou gen3d/scena.js (orbit, světla, mřížka, stín, pravítka, PNG).
   Sestava = díly na svých místech (skla průhledně); tisková poloha = díly na podložce, převisy barevně. */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    // zepředu = na obličejovou stranu brýlí (přední díl leží v rovině xz, díváme se od +y)
    const s = G3D.scena(kontejner, { odstup: 1.05, popis: '3D náhled obroučky – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte',
      pohledy: { zepredu: [Math.PI / 2, 0.02] } });
    const matDil = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.03, clearcoat: 0.15, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    const matSklo = new THREE.MeshPhysicalMaterial({ color: 0x9fd0ee, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
    let objekty = [], model = null, prvni = true;
    const stav = { skla: true, tisk: false, hrany: true, previsy: true, pravitka: false };
    const ZAKLAD = { predni: [0.17, 0.34, 0.7], stranice: [0.21, 0.4, 0.74], cocka: [0.45, 0.68, 0.82] };

    // pozadí popisků pravítek podle tématu (G3D.scena.barvy ho nenastavuje)
    function barvy(cara, cara2, hrana, pozadi) { if (pozadi) s.tema.pozadi = pozadi; s.barvy(cara, cara2, hrana); }
    /** Normály s lomem (ostré hrany zůstanou ostré) a barva po trojúhelnících (převisy v tiskové poloze). */
    const geometrie = (poz, idx, tridy, zaklad) => s.geometrie(poz, idx, { uhel: 32, barvaTroj: t => (tridy && stav.tisk && stav.previsy && (tridy[t] === 1 || tridy[t] === 2) && G3D.BARVY_TRID[tridy[t]]) || zaklad });

    /** Obal dílů (bez hran; skla jen viditelná). */
    function obal() {
      const b = new THREE.Box3();
      for (const o of objekty) if (!o.userData.hrany && o.visible) { o.updateMatrixWorld(true); b.expandByObject(o); }
      return b;
    }
    /** model = {dily: [{poz, idx, role, montaz, duch, tisk: {poz, tridy}}], klic} nebo null */
    function nastav(m) {
      const zmena = !model || !m || model.klic !== m.klic;
      model = m;
      sestav();
      if (m && (prvni || zmena)) { pohled('iso'); prvni = false; }
    }
    function sestav() {
      s.vycisti(); objekty = [];
      const m = model;
      if (!m) { s.stin(null); s.prekresli(); return; }
      for (const d of m.dily) {
        if (stav.tisk && (d.duch || !d.tisk)) continue;
        const poz = stav.tisk ? d.tisk.poz : d.poz;
        const sklo = d.duch;
        const mesh = new THREE.Mesh(sklo ? (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(poz, 3)); g.setIndex(new THREE.BufferAttribute(d.idx, 1)); g.computeVertexNormals(); return g; })()
          : geometrie(poz, d.idx, stav.tisk ? d.tisk.tridy : null, ZAKLAD[d.role] || ZAKLAD.predni), sklo ? matSklo : matDil);
        if (!stav.tisk) { mesh.matrixAutoUpdate = false; const a = d.montaz; mesh.matrix.set(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], 0, 0, 0, 1); }
        mesh.visible = !sklo || stav.skla; mesh.renderOrder = sklo ? 2 : 0; mesh.userData.sklo = sklo;
        s.skupina.add(mesh); objekty.push(mesh);
        if (!sklo) {
          const h = s.hrany(poz, d.idx, 32);
          if (!stav.tisk) { h.matrixAutoUpdate = false; h.matrix.copy(mesh.matrix); }
          h.visible = stav.hrany; h.userData.hrany = true; s.skupina.add(h); objekty.push(h);
        }
      }
      const box = obal();
      s.mrizka(box, stav.tisk, 0.4);
      s.stin(box, !stav.tisk);
      s.pravitka(stav.pravitka ? box : null);
      s.prekresli();
    }
    function pohled(jak) {
      const b = obal();
      if (b.isEmpty()) return;
      // izometrie brýlí: v sestavě zepředu šikmo, na podložce víc shora
      s.pohled(jak === 'iso' || !jak ? (stav.tisk ? { azimut: -1.2, elevace: 0.75 } : { azimut: 1.05, elevace: 0.38 }) : jak, b);
    }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'tisk' || co === 'previsy' || co === 'pravitka') { sestav(); if (co === 'tisk') pohled('iso'); return; }
      for (const o of objekty) o.visible = o.userData.hrany ? stav.hrany : (!o.userData.sklo || stav.skla);
      s.prekresli();
    }
    return { nastav, pohled, prepni, png: s.png, prekresli: s.prekresli, barvy, stav, ovl: s.ovl };
  }
  window.BRYLE_NAHLED = { vytvorNahled };
})();
