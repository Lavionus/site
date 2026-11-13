/* Návrhář ozubených soukolí – 3D náhled nad společnou scénou gen3d/scena.js.
   OZK_NAHLED.vytvor(kontejner) → {nastav, poloz, pohled, prepni, png, barvy, stav, box}
   nastav(dily, {tisk, uhel, novyPohled}) – díly [{nazev, barva, telesa: [{pos, idx, barva, pruhledne}]}];
     každý díl je vlastní skupina, poloz([{x, y, rot}]) je posouvá a natáčí (animace záběru).
   V tiskové poloze volitelně převisy barevně (stav.previsy); řez rovinou y = 0 ukáže otvory a náboje. */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvor(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 0.85, fov: 38 });
    const stav = { hrany: true, rez: false, previsy: false, pravitka: false };
    let dily = null, volby = {}, skupiny = [], prvni = true;
    const rez = () => (stav.rez ? [s.rovinaRezu] : []);

    function sestav(novyPohled) {
      s.vycisti(); skupiny = [];
      if (!dily || !dily.length) { s.stin(null); s.prekresli(); return; }
      for (const d of dily) {
        const g = new THREE.Group();
        let zmin = Infinity;
        for (const t of d.telesa) for (let i = 2; i < t.pos.length; i += 3) zmin = Math.min(zmin, t.pos[i]);
        for (const t of d.telesa) {
          const barva = new THREE.Color(t.barva || d.barva);
          let tridy = null;
          if (volby.tisk && stav.previsy) {
            tridy = G3D.tridyPrevisu(t.pos, t.idx, volby.uhel || 45, zmin);
            // spodní víko tělesa, které stojí na jiném tělese téhož dílu (náboj na kole), není převis
            let z0 = Infinity; for (let i = 2; i < t.pos.length; i += 3) z0 = Math.min(z0, t.pos[i]);
            if (z0 > zmin + 0.01) for (let k = 0; k < tridy.length; k++) {
              const a = 3 * t.idx[3 * k], b = 3 * t.idx[3 * k + 1], c = 3 * t.idx[3 * k + 2];
              if (Math.max(t.pos[a + 2], t.pos[b + 2], t.pos[c + 2]) < z0 + 0.01) tridy[k] = 0;
            }
          }
          const zakl = [barva.r, barva.g, barva.b];
          const geo = s.geometrie(t.pos, t.idx, { uhel: 30, barvaTroj: k => (tridy && (tridy[k] === 1 || tridy[k] === 2) ? G3D.BARVY_TRID[tridy[k]] : zakl) });
          const pr = !!t.pruhledne;
          const mat = new THREE.MeshStandardMaterial({ color: tridy ? 0xffffff : barva, vertexColors: !!tridy, metalness: 0.15, roughness: 0.55,
            transparent: pr, opacity: pr ? 0.45 : 1, side: THREE.DoubleSide, clippingPlanes: rez() });
          const mesh = new THREE.Mesh(geo, mat); mesh.userData.vlastniMat = true; mesh.userData.zakl = true;
          g.add(mesh);
          const vn = new THREE.Mesh(geo, s.matVnitrek); vn.visible = stav.rez; vn.userData.vnitrek = true; vn.userData.model = false;
          g.add(vn);
          if (t.idx.length / 3 < 120000) {
            const mh = new THREE.LineBasicMaterial({ color: s.matHrany.color, transparent: true, opacity: s.matHrany.opacity, clippingPlanes: rez() });
            const hr = s.hrany(t.pos, t.idx, 32, mh); hr.visible = stav.hrany; hr.userData.hrany = true; hr.userData.vlastniMat = true;
            g.add(hr);
          }
        }
        s.skupina.add(g); skupiny.push(g);
      }
      const b = box();
      s.mrizka(b, !!volby.tisk);
      s.stin(b, !volby.tisk);
      if (stav.pravitka) s.pravitka(b);
      if (prvni || novyPohled) { s.pohled('iso', b); prvni = false; } else s.prekresli();
    }
    function box() { s.skupina.updateMatrixWorld(true); return s.obalSkupiny(); }
    function nastav(d, v = {}) { dily = d; volby = v; sestav(v.novyPohled); }
    /** Polohy dílů v sestavě (animace): [{x, y, rot}] ve stejném pořadí jako díly. */
    function poloz(polohy) {
      skupiny.forEach((g, i) => { const p = polohy[i]; if (p) { g.position.set(p.x, p.y, 0); g.rotation.set(0, 0, p.rot); } });
      s.prekresli();
    }
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
    const pohled = jak => { s.skupina.updateMatrixWorld(true); s.pohled(jak, box()); };
    return { nastav, poloz, pohled, prepni, box, png: s.png, prekresli: s.prekresli, barvy: s.barvy, stav, platno: s.platno };
  }
  window.OZK_NAHLED = { vytvor };
})();
