/* Náhled vytažených dílů (vykrajovátko, 3D text) nad společnou scénou gen3d/scena.js.
   nastav(dily, volby) – dily [{poz, idx, barva, kryti}] v osách tiskárny (Z nahoru);
     volby {tisk (převisy jen v tiskové poloze), uhel, pozadi (barva | null = podle motivu), navic (Object3D, např. obrys podložky), novyPohled}
   vytvorNahled(kontejner, {pohledy}) – vlastní úhly pohledů pro G3D.scena (např. iso pro text čelem ke kameře).
   prepni('hrany'|'rez'|'previsy'|'pravitka'|'mrizka', h) – mřížka po 10 mm pod modelem, bez ní měkký stín. */
/* global THREE, G3D */
(function () {
  'use strict';
  const css = (n, z) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || z;

  function vytvorNahled(kontejner, volbySceny = {}) {
    const s = G3D.scena(kontejner, Object.assign({ odstup: 1 }, volbySceny));
    const stav = { hrany: true, rez: false, previsy: true, pravitka: false, mrizka: true };
    let dily = null, volby = {}, rozmer = 50, prvni = true;
    const rez = () => (stav.rez ? [s.rovinaRezu] : []);

    function mrizka10(box) {
      const vel = Math.max(box.max.x - box.min.x, box.max.y - box.min.y);
      const dilku = Math.max(6, Math.ceil(vel * 1.6 / 10));
      const g = new THREE.GridHelper(dilku * 10, dilku, new THREE.Color(css('--accent', '#6aa6fd')), new THREE.Color(css('--border-strong', '#4a4a4a')));
      g.rotation.x = Math.PI / 2;
      g.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.min.z - 0.02);
      g.material.transparent = true; g.material.opacity = 0.45;
      g.userData.model = false; g.userData.vlastniMat = true;
      return g;
    }

    function sestav(novyPohled) {
      s.vycisti();
      s.scena.background = volby.pozadi ? new THREE.Color(volby.pozadi) : null;
      if (!dily || !dily.length) { s.stin(null); s.prekresli(); return; }
      const box = new THREE.Box3();
      for (const d of dily) {
        const tridy = volby.tisk && stav.previsy ? G3D.tridyPrevisu(d.poz, d.idx, volby.uhel || 45) : null;
        const g = s.geometrie(d.poz, d.idx, { uhel: 30, barvaTroj: tridy && (t => (tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : null)) });
        const kryti = d.kryti == null ? 1 : d.kryti;
        const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(d.barva || '#4F86D9'), roughness: 0.5, metalness: 0.04, clearcoat: 0.2, clearcoatRoughness: 0.6,
          transparent: kryti < 1, opacity: kryti, clippingPlanes: rez() });
        if (tridy) {   // převisy: barvy trojúhelníků, ostatní v barvě dílu
          const c = new THREE.Color(d.barva || '#4F86D9'), C = g.getAttribute('color').array;
          for (let t = 0; t < tridy.length; t++) if (tridy[t] !== 1 && tridy[t] !== 2) for (let k = 0; k < 3; k++) { C[9 * t + 3 * k] = c.r; C[9 * t + 3 * k + 1] = c.g; C[9 * t + 3 * k + 2] = c.b; }
          mat.color.set(0xffffff); mat.vertexColors = true;
        }
        const mesh = new THREE.Mesh(g, mat); mesh.userData.vlastniMat = true; mesh.userData.zakl = true;
        s.skupina.add(mesh);
        const vn = new THREE.Mesh(g, s.matVnitrek); vn.visible = stav.rez; vn.userData.vnitrek = true; vn.userData.model = false;
        s.skupina.add(vn);
        const mh = new THREE.LineBasicMaterial({ color: s.matHrany.color, transparent: true, opacity: s.matHrany.opacity, clippingPlanes: rez() });
        const hr = s.hrany(d.poz, d.idx, 28, mh); hr.visible = stav.hrany; hr.userData.hrany = true; hr.userData.vlastniMat = true; hr.userData.model = false;
        s.skupina.add(hr);
        g.computeBoundingBox(); box.union(g.boundingBox);
      }
      if (volby.navic) { volby.navic.userData.model = false; volby.navic.traverse(o => { o.userData.vlastniMat = true; }); s.skupina.add(volby.navic); }
      const vel = new THREE.Vector3(); box.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      if (stav.mrizka) s.skupina.add(mrizka10(box));
      s.stin(box, !stav.mrizka);
      if (stav.pravitka) s.pravitka(box);
      if (prvni || Math.abs(novy - rozmer) / rozmer > 0.3 || novyPohled) { rozmer = novy; s.pohled(prvni ? 'iso' : 'ponech', box); prvni = false; }
      else { box.getCenter(s.ovl.cil); s.prekresli(); }
    }
    function nastav(d, v = {}) { dily = d; volby = v; sestav(v.novyPohled); }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'previsy' || co === 'pravitka' || co === 'mrizka') { sestav(false); return; }
      for (const o of s.skupina.children) {
        if (o.userData.hrany) { o.visible = stav.hrany; o.material.clippingPlanes = rez(); }
        if (o.userData.zakl) o.material.clippingPlanes = rez();
        if (o.userData.vnitrek) o.visible = stav.rez;
        if (o.material) o.material.needsUpdate = true;
      }
      s.prekresli();
    }
    /** Barva a průhlednost bez přestavby (tažení barvou / posuvníkem). */
    function vzhled(i, barva, kryti) {
      const m = s.skupina.children.filter(o => o.userData.zakl)[i];
      if (!m) return;
      if (barva && !m.material.vertexColors) m.material.color.set(barva);
      if (kryti != null) { m.material.transparent = kryti < 1; m.material.opacity = kryti; m.material.needsUpdate = true; }
      s.prekresli();
    }
    // dvojklik = vycentrovat (natočení zůstane)
    s.platno.addEventListener('dblclick', () => s.pohled('ponech'));
    return { nastav, prepni, vzhled, pohled: jak => s.pohled(jak), png: s.png, prekresli: s.prekresli, barvy: s.barvy, stav, ovl: s.ovl, scena: s.scena, s };
  }
  window.CC_NAHLED = { vytvorNahled };
})();
