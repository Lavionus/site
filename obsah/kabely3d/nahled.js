/* Kabelové průchodky – 3D náhled nad společnou scénou gen3d/scena.js (orbit myš/dotyk, pohledy, mřížka, pravítka, PNG).
   nastav({dily: [{poz, idx, barva}], pomocne: [{druh: 'deska'|'kabel', poz, idx}], tisk, typ, uhel}) | null
   Díly jsou plné, deska a kabely průhledné (jen pro představu). Řez rovinou y = 0, převisy barevně v tiskové poloze. */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 1.05, pohledy: { iso: [-1.2, 0.6] } });
    const matDeska = new THREE.MeshStandardMaterial({ color: 0xc8a477, roughness: 0.8, transparent: true, opacity: 0.28, depthWrite: false });
    const matKabel = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.6, transparent: true, opacity: 0.45, depthWrite: false });
    const stav = { pomocne: true, hrany: true, rez: false, previsy: false, pravitka: false };
    let m = null, rozmer = 100, prvni = true, posl = {};
    const rez = () => (stav.rez ? [s.rovinaRezu] : []);
    // díly z obou stran (jako dřív); v řezu jen líc, jinak by rub zakryl červený vnitřek
    const strana = () => (stav.rez ? THREE.FrontSide : THREE.DoubleSide);

    function sestav(novyPohled) {
      s.vycisti();
      if (!m) { s.stin(null); s.prekresli(); return; }
      const box = new THREE.Box3();
      for (const d of m.dily) {
        const tridy = m.tisk && stav.previsy ? G3D.tridyPrevisu(d.poz, d.idx, m.uhel || 45) : null;
        const zakl = new THREE.Color(d.barva || 0x3f7bd6);
        const g = s.geometrie(d.poz, d.idx, { uhel: 32, barvaTroj: tridy && (t => (tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : [zakl.r, zakl.g, zakl.b])) });
        const mat = new THREE.MeshPhysicalMaterial({ color: tridy ? 0xffffff : zakl, vertexColors: !!tridy, roughness: 0.42, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.5, side: strana(), clippingPlanes: rez() });
        const mesh = new THREE.Mesh(g, mat); mesh.userData.vlastniMat = true; mesh.userData.zakl = true;
        s.skupina.add(mesh);
        const vn = new THREE.Mesh(g, s.matVnitrek); vn.visible = stav.rez; vn.userData.vnitrek = true; vn.userData.model = false;
        s.skupina.add(vn);
        const mh = new THREE.LineBasicMaterial({ color: s.matHrany.color, transparent: true, opacity: s.matHrany.opacity, clippingPlanes: rez() });
        const hr = s.hrany(d.poz, d.idx, 32, mh); hr.visible = stav.hrany; hr.userData.hrany = true; hr.userData.vlastniMat = true;
        s.skupina.add(hr);
        g.computeBoundingBox(); box.union(g.boundingBox);
      }
      for (const x of m.pomocne || []) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(x.poz, 3)); g.setIndex(new THREE.BufferAttribute(x.idx, 1)); g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, x.druh === 'kabel' ? matKabel : matDeska);
        mesh.renderOrder = 2; mesh.userData.pomocny = true; mesh.userData.model = false; mesh.visible = stav.pomocne;
        s.skupina.add(mesh);
      }
      const vel = new THREE.Vector3(); box.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      s.mrizka(box, !!m.tisk);
      if (stav.pravitka) s.pravitka(box);
      // nový pohled: poprvé, při velké změně rozměru, přepnutí montáž/tisk nebo typu dílu
      if (prvni || novyPohled || Math.abs(novy - rozmer) / rozmer > 0.3 || m.tisk !== posl.tisk || m.typ !== posl.typ) {
        rozmer = novy; s.pohled(prvni ? 'iso' : 'ponech', box); prvni = false;
      } else { box.getCenter(s.ovl.cil); s.prekresli(); }
      posl = { tisk: m.tisk, typ: m.typ, box };
    }
    function nastav(x) { m = x; sestav(false); }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'previsy' || co === 'pravitka') { sestav(false); return; }
      for (const o of s.skupina.children) {
        if (o.userData.pomocny) o.visible = stav.pomocne;
        if (o.userData.hrany) { o.visible = stav.hrany; o.material.clippingPlanes = rez(); }
        if (o.userData.zakl) { o.material.clippingPlanes = rez(); o.material.side = strana(); }
        if (o.userData.vnitrek) o.visible = stav.rez;
        if (o.material) o.material.needsUpdate = true;
      }
      s.prekresli();
    }
    // pohled na model bez průhledné desky a kabelů (obal jen dílů)
    const pohled = jak => { if (posl.box && !posl.box.isEmpty()) s.pohled(jak, posl.box); };
    /** barvy(mřížka, hrany) – jako dřív; mřížka v jedné barvě */
    const barvy = (cara, hrana) => s.barvy(cara, cara, hrana);
    return { nastav, pohled, prepni, png: s.png, prekresli: s.prekresli, barvy, stav, ovl: s.ovl };
  }
  window.KAB_NAHLED = { vytvorNahled };
})();
