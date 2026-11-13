/* IBC napojení – 3D náhled nad společnou scénou gen3d/scena.js (orbit, světla, mřížka, stín, pravítka, řez, PNG).
   Montážní poloha = díl s průhledným hrdlem ventilu / hadicí / stěnou; tisková = na podložce, převisy barevně;
   řez rovinou y = 0 ukáže průchod a závity uvnitř. */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 1.15, popis: '3D náhled dílu – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte' });
    const matDil = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.32 });
    const matDuch = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    let dil = null, hrany = null, vnitrek = null, duchove = [], model = null, prvni = true;
    const stav = { duchove: true, tisk: false, hrany: true, previsy: true, rez: false, pravitka: false };
    const BARVA = [[0.25, 0.48, 0.84], [0.85, 0.66, 0.2], [0.86, 0.22, 0.2], [0.25, 0.48, 0.84]];
    const rez = () => (stav.rez ? [s.rovinaRezu] : []);

    // pozadí popisků pravítek podle tématu (G3D.scena.barvy ho nenastavuje)
    function barvy(cara, cara2, hrana, pozadi) {
      if (pozadi) s.tema.pozadi = pozadi;
      if (hrana) matHrany.color.set(hrana);
      s.barvy(cara, cara2, hrana);
    }
    /** Normály s lomem (ostré hrany zůstanou ostré) a barva po trojúhelnících. */
    const geometrie = (poz, idx, tridy) => s.geometrie(poz, idx, { uhel: 32, barvaTroj: t => BARVA[tridy && stav.tisk && stav.previsy ? tridy[t] : 0] });
    /** Duch = průhledná trubka podél osy Z (hrdlo ventilu, hadice, trubka, stěna s otvorem). */
    function duch(d) {
      const prof = [new THREE.Vector2(d.ri || 0, d.z0), new THREE.Vector2(d.r, d.z0), new THREE.Vector2(d.r, d.z1), new THREE.Vector2(d.ri || 0, d.z1)];
      if (d.ri) prof.push(new THREE.Vector2(d.ri, d.z0));
      const g = new THREE.LatheGeometry(prof, 64);
      g.rotateX(Math.PI / 2);       // osa lathe = Y → Z
      const m = new THREE.Mesh(g, matDuch);
      m.position.set(d.x || 0, d.y || 0, 0);
      m.renderOrder = 2;
      return m;
    }

    /** model = {poz, idx, duchove, tisk: {poz, tridy}} nebo null */
    function nastav(m) {
      const zmenaTypu = !model || !m || (model.klic !== m.klic);
      model = m;
      sestav();
      if (m && (prvni || zmenaTypu)) { pohled('iso'); prvni = false; }
    }
    function orez() {
      for (const m of [matDil, matHrany, matDuch]) { m.clippingPlanes = rez(); m.needsUpdate = true; }
      if (vnitrek) vnitrek.visible = stav.rez;
    }
    function sestav() {
      s.vycisti(); dil = hrany = vnitrek = null; duchove = [];
      const m = model;
      if (!m) { s.stin(null); s.prekresli(); return; }
      const poz = stav.tisk ? m.tisk.poz : m.poz;
      dil = new THREE.Mesh(geometrie(poz, m.idx, m.tisk.tridy), matDil);
      s.skupina.add(dil);
      vnitrek = new THREE.Mesh(dil.geometry, s.matVnitrek); vnitrek.userData.model = false; s.skupina.add(vnitrek);
      hrany = s.hrany(poz, m.idx, 32, matHrany);
      hrany.visible = stav.hrany; s.skupina.add(hrany);
      if (!stav.tisk) for (const d of m.duchove) { const o = duch(d); o.visible = stav.duchove; o.userData.model = false; s.skupina.add(o); duchove.push(o); }
      orez();
      dil.geometry.computeBoundingBox();
      const b = dil.geometry.boundingBox;
      s.mrizka(b, stav.tisk, 0.4);
      s.stin(b, !stav.tisk);
      s.pravitka(stav.pravitka ? b : null);
      s.prekresli();
    }
    function pohled(jak) {
      if (!dil) return;
      dil.geometry.computeBoundingBox();
      s.pohled(jak, dil.geometry.boundingBox);
    }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'tisk' || co === 'previsy' || co === 'pravitka') { sestav(); if (co === 'tisk') pohled('iso'); return; }
      if (co === 'rez') orez();
      duchove.forEach(o => { o.visible = stav.duchove; });
      if (hrany) hrany.visible = stav.hrany;
      s.prekresli();
    }
    return { nastav, pohled, prepni, png: s.png, prekresli: s.prekresli, barvy, stav, ovl: s.ovl };
  }
  window.IBC_NAHLED = { vytvorNahled };
})();
