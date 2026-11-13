/* Nožičky – 3D náhled nad společnou scénou gen3d/scena.js (používají ho i Odměrky):
   díly v tiskové poloze na podložce, průhledná noha / trubka, řez rovinou XZ, obrysové hrany,
   převisy barevně, pravítka. Tažení = otáčení, pravé tl. / Shift = posun, kolečko a dva prsty = zoom.
   API: vytvorNahled(kontejner) → {nastav(model), pohled(jak), prepni(co, h), png(), barvy(cara, cara2, hrana), stav, ovl, pocet}
     model = {dily: rozmístěná sada, kus: díly jednoho kusu, duchy: noha/trubka k jednomu kusu}
     stav = {sada, duch, rez, hrany, previsy, pravitka, uhel} – uhel = největší převis od svislice (°) */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 1.05, pohledy: { iso: [-1.1, 0.6] }, popis: '3D náhled dílu – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte' });
    const matDuch = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.4, roughness: 0.45, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    const stav = { sada: true, duch: true, rez: false, hrany: true, previsy: false, pravitka: false, uhel: 45 };
    let data = null, rozmer = 100, prvni = true;

    function barvy(cara, cara2, hrana) {
      s.barvy(cara, cara2, hrana);
      if (data) sestav();
    }
    /** model = { dily: rozmístěná sada, kus: díly jednoho kusu, duchy: noha/trubka k jednomu kusu } */
    function nastav(model) { data = model; sestav(); }
    function sestav() {
      s.vycisti();
      if (!data) { s.prekresli(); return; }
      const rez = stav.rez ? [s.rovinaRezu] : [];
      const dily = stav.sada ? data.dily : data.kus;
      const box = new THREE.Box3();
      for (const d of dily) {
        // převisy: třídy trojúhelníků v tiskové poloze (díly leží na z = 0)
        const tridy = stav.previsy ? G3D.tridyPrevisu(d.poz, d.idx, stav.uhel || 45, 0) : null;
        const g = s.geometrie(d.poz, d.idx, { uhel: 35, barvaTroj: tridy && (t => (tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : null)) });
        const mat = new THREE.MeshPhysicalMaterial({ color: d.barva || 0x3f7bd6, roughness: d.druh === 'vlozka' ? 0.8 : 0.42, metalness: 0.03,
          clearcoat: d.druh === 'vlozka' ? 0 : 0.3, side: THREE.DoubleSide, clippingPlanes: rez });
        if (tridy) {   // ostatní trojúhelníky v barvě dílu
          const c = new THREE.Color(d.barva || 0x3f7bd6), C = g.getAttribute('color').array;
          for (let t = 0; t < tridy.length; t++) if (tridy[t] !== 1 && tridy[t] !== 2) for (let k = 0; k < 3; k++) { C[9 * t + 3 * k] = c.r; C[9 * t + 3 * k + 1] = c.g; C[9 * t + 3 * k + 2] = c.b; }
          mat.color.set(0xffffff); mat.vertexColors = true;
        }
        const m = new THREE.Mesh(g, mat); m.userData.vlastniMat = true;
        s.skupina.add(m);
        const mh = new THREE.LineBasicMaterial({ color: s.matHrany.color, transparent: true, opacity: s.matHrany.opacity, clippingPlanes: rez });
        const h = s.hrany(d.poz, d.idx, 35, mh); h.visible = stav.hrany; h.userData.vlastniMat = true; h.userData.model = false;
        s.skupina.add(h);
        g.computeBoundingBox(); box.union(g.boundingBox);
      }
      if (!stav.sada && stav.duch) for (const d of data.duchy || []) {
        const m = new THREE.Mesh(s.geometrie(d.poz, d.idx, { uhel: 35 }), matDuch); m.renderOrder = 2;
        s.skupina.add(m);
      }
      const b = s.obalSkupiny();
      const vel = new THREE.Vector3(); b.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      if (!box.isEmpty()) {
        s.mrizka(new THREE.Box3(new THREE.Vector3(b.min.x, b.min.y, 0), new THREE.Vector3(b.max.x, b.max.y, Math.max(0.1, box.max.z))), true, 0.4);
        if (stav.pravitka) s.pravitka(box);
      }
      if (prvni || Math.abs(novy - rozmer) / rozmer > 0.3) { rozmer = novy; s.pohled(prvni ? 'iso' : 'ponech', b); prvni = false; }
      s.prekresli();
    }

    function pohled(jak) { s.pohled(jak); }
    function prepni(co, h) { stav[co] = h; if (co === 'sada') prvni = true; sestav(); }

    return { nastav, pohled, prepni, png: s.png, barvy, stav, ovl: s.ovl, scena: s, get pocet() { return s.skupina.children.length; } };
  }
  window.NOZ_NAHLED = { vytvorNahled };
})();
