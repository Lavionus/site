/* Spojky – 3D náhled nad společnou scénou gen3d/scena.js (orbit, světla, mřížka, pohledy, pravítka, png).
   Používají ho i cleat, uhelniky, rozbocka_vzt a nacrt3d.
   Montážní poloha = spojka s průhlednými trubkami / profily; tisková = otočená na podložce, převisy barevně.
   nastav(model) – model = {poz, idx, duchove, tisk: {poz, tridy}, barvy, klic} nebo null
     tridy (na trojúhelník): 0 ok, 1 most (žlutě), 2 převis (červeně), 3 podložka, 4 odlomitelná podpora (šedě) = G3D.BARVY_TRID
     barvy = RGB na trojúhelník (mapa napětí), kreslí se při stav.napeti
   prepni('duchove' | 'tisk' | 'hrany' | 'previsy' | 'napeti' | 'pravitka' | 'rez', h), pohled(iso|shora|zepredu|zboku|zespodu),
   png(), prekresli(), barvy(), pruhlednost(dil, duch), stav, ovl, scena (stránka si může přidat vlastní vrstvy – kóty) */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 1.15, popis: '3D náhled spojky – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte' });
    const matDil = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    const matHranyDuch = new THREE.LineBasicMaterial({ color: 0x55606a, transparent: true, opacity: 0.45, depthWrite: false });
    const matDuch = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    let dil = null, hrany = null, vnitrek = null, duchove = [], model = null, prvni = true;
    const stav = { duchove: true, tisk: false, hrany: true, previsy: true, napeti: false, pravitka: false, rez: false };   // napeti: model.barvy (RGB na trojúhelník), když je stránka dodá
    const BARVA = G3D.BARVY_TRID;

    function duch(d) {
      let m;
      if (d.typ === 'sit') {
        // obecná síť (např. průřez hliníkového profilu) s jemnými obrysovými hranami
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); g.setIndex(new THREE.BufferAttribute(d.idx, 1)); g.computeVertexNormals();
        m = new THREE.Mesh(g, matDuch);
        m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), matHranyDuch));
      } else if (d.typ === 'box') {
        m = new THREE.Mesh(new THREE.BoxGeometry(d.max[0] - d.min[0], d.max[1] - d.min[1], d.max[2] - d.min[2]), matDuch);
        m.position.set((d.min[0] + d.max[0]) / 2, (d.min[1] + d.max[1]) / 2, (d.min[2] + d.max[2]) / 2);
      } else {
        const L = d.do - d.od, sz = d.sez;
        const g = sz.typ === 'kruh' ? new THREE.CylinderGeometry(sz.r, sz.r, L, 48, 1, true) : new THREE.BoxGeometry(2 * sz.hu, L, 2 * sz.hv);
        m = new THREE.Mesh(g, matDuch);
        const u = new THREE.Vector3(...d.u), dd = new THREE.Vector3(...d.d), z = new THREE.Vector3().crossVectors(u, dd);
        m.matrixAutoUpdate = false;
        m.matrix.makeBasis(u, dd, z).setPosition(dd.clone().multiplyScalar((d.od + d.do) / 2));
      }
      m.renderOrder = 2; m.userData.model = false;
      return m;
    }

    const rez = () => (stav.rez ? [s.rovinaRezu] : []);
    // v řezu jen líc dílu – rubové plochy pak kreslí matVnitrek (červeně), ať je vidět, kde je materiál
    const nastavRez = () => { matDil.clippingPlanes = rez(); matDil.side = stav.rez ? THREE.FrontSide : THREE.DoubleSide; matDil.needsUpdate = true; };
    function obalDilu() { const b = new THREE.Box3(); if (dil) { dil.geometry.computeBoundingBox(); b.copy(dil.geometry.boundingBox); } return b; }
    /** model = {poz, idx, duchove, tisk: {poz, tridy}} nebo null */
    function nastav(m) {
      const zmenaTypu = !model || !m || (model.klic !== m.klic);
      model = m;
      sestav();
      if (m && (prvni || zmenaTypu)) { pohled('iso'); prvni = false; }
    }
    function sestav() {
      s.vycisti();
      dil = hrany = vnitrek = null; duchove = [];
      const m = model;
      if (!m) { s.prekresli(); return; }
      const poz = stav.tisk ? m.tisk.poz : m.poz, tridy = m.tisk.tridy, bv = m.barvy && stav.napeti ? m.barvy : null;
      const g = s.geometrie(poz, m.idx, {
        uhel: 32,
        barvaTroj: t => (bv ? [bv[3 * t], bv[3 * t + 1], bv[3 * t + 2]] : BARVA[tridy && (stav.tisk && stav.previsy || tridy[t] === 4) ? tridy[t] : 0]),
      });
      nastavRez();
      dil = new THREE.Mesh(g, matDil);
      s.skupina.add(dil);
      vnitrek = new THREE.Mesh(g, s.matVnitrek); vnitrek.visible = stav.rez; vnitrek.userData.model = false;
      s.skupina.add(vnitrek);
      if (stav.hrany) stavHrany();      // obrysové hrany jen když jsou zapnuté (u velkých sítí drahé)
      if (!stav.tisk) for (const d of m.duchove || []) { const o = duch(d); o.visible = stav.duchove && matDuch.opacity > 0.001; s.skupina.add(o); duchove.push(o); }
      const b = obalDilu(), vel = new THREE.Vector3(); b.getSize(vel);
      s.rozmer = Math.max(vel.x, vel.y, vel.z, 10);
      if (stav.tisk) s.mrizka(b, true, 0.4);
      if (stav.pravitka) s.pravitka(b);
      s.prekresli();
    }
    function stavHrany() {
      const m = model; if (!m || hrany) return;
      hrany = s.hrany(stav.tisk ? m.tisk.poz : m.poz, m.idx, 32, new THREE.LineBasicMaterial({ color: s.matHrany.color, transparent: true, opacity: s.matHrany.opacity, clippingPlanes: rez() }));
      hrany.userData.vlastniMat = true;
      s.skupina.add(hrany);
    }
    function pohled(jak) { if (dil) s.pohled(jak, obalDilu()); }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'tisk' || co === 'previsy' || co === 'napeti' || co === 'pravitka') { sestav(); if (co === 'tisk') pohled('iso'); return; }
      if (co === 'rez') {
        nastavRez();
        if (vnitrek) vnitrek.visible = h;
        if (hrany) { hrany.material.clippingPlanes = rez(); hrany.material.needsUpdate = true; }
      }
      duchove.forEach(o => { o.visible = stav.duchove && matDuch.opacity > 0.001; });
      if (stav.hrany) stavHrany();
      if (hrany) hrany.visible = stav.hrany;
      s.prekresli();
    }
    /** Průhlednost dílu a duchů (0 = neviditelné, 1 = plné); null = beze změny. */
    function pruhlednost(d, du) {
      if (d != null) { matDil.opacity = d; matDil.transparent = d < 0.999; matDil.depthWrite = d >= 0.999; matDil.needsUpdate = true; }
      if (du != null) { matDuch.opacity = du; matHranyDuch.opacity = Math.min(1, du * 1.3); matDuch.needsUpdate = true; }
      for (const o of duchove) o.visible = stav.duchove && matDuch.opacity > 0.001;
      s.prekresli();
    }
    // barvy(cara, cara2, hrana, kryti): hrany už vytvořené dostanou novou barvu taky
    function barvy(cara, cara2, hrana, kryti) {
      s.barvy(cara, cara2, hrana, kryti);
      if (hrany) { hrany.material.color.copy(s.matHrany.color); hrany.material.opacity = s.matHrany.opacity; }
    }
    return { nastav, pohled, prepni, png: s.png, prekresli: s.prekresli, barvy, pruhlednost, stav, ovl: s.ovl, scena: s.scena, g3d: s };
  }
  // stránky bez gen3d/scena.js v hlavičce (nacrt3d): scéna se donačte, SPOJKY_NAHLED vznikne až potom
  function zverejni() { window.SPOJKY_NAHLED = { vytvorNahled }; }
  if (window.G3D && G3D.scena) zverejni();
  else {
    const nacti = src => new Promise((ok, chyba) => { const e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = chyba; document.head.appendChild(e); });
    const zde = document.currentScript ? new URL('../gen3d/', document.currentScript.src).href : 'gen3d/';
    Promise.all([nacti(zde + 'scena.js'), nacti(zde + 'koty.js'), window.G3D && G3D.BARVY_TRID ? null : nacti(zde + 'zaklad.js')]).then(zverejni, e => console.error('spojky/nahled.js: gen3d se nenačetlo', e));
  }
})();
