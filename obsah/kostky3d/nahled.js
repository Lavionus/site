/* Herní kostky a žetony – 3D náhled nad společnou scénou gen3d/scena.js: díly na podložce v tiskové poloze,
   rytí zvýrazněné barvou, převisy barevně, pravítka. Pohled se při změně velikosti přizpůsobí, dokud uživatel sám nepřiblíží / neposune. */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    let rucne = false;   // rucne = uživatel přiblížil / posunul
    const s = G3D.scena(kontejner, { odstup: 1.02, zmenaVelikosti: () => { if (!rucne && box) s.pohled('ponech', box); } });
    s.ovl.elevace = 0.75;
    s.platno.addEventListener('wheel', () => { rucne = true; });
    s.platno.addEventListener('pointerdown', e => { if (e.button === 2 || e.shiftKey) rucne = true; });
    s.platno.addEventListener('touchstart', e => { if (e.touches.length > 1) rucne = true; });
    s.matHrany.opacity = 0.25;
    const stav = { hrany: true, barvaRyti: true, previsy: false, pravitka: false };
    const POHLEDY = Object.assign({}, G3D.POHLEDY, { iso: [-1.2, 0.75] });
    const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.02, clearcoat: 0.3, clearcoatRoughness: 0.5, flatShading: true });
    let posledni = null, rozmer = 50, uz = false, box = null;

    /** Barvy trojúhelníků: tělo = barva dílu, rytí tmavší (světlejší u tmavých dílů), převisy podle tříd. */
    function barvyDilu(d, tridy) {
      const zak = new THREE.Color(d.barva || '#cccccc'), tm = zak.clone();
      const svetla = zak.r + zak.g + zak.b > 1.6;
      tm.lerp(new THREE.Color(svetla ? 0x1d3f7a : 0xffffff), svetla ? 0.85 : 0.7);
      const Z = [zak.r, zak.g, zak.b], T = [tm.r, tm.g, tm.b];
      return t => (tridy && (tridy[t] === 1 || tridy[t] === 2) ? G3D.BARVY_TRID[tridy[t]] : stav.barvaRyti && d.znacky && d.znacky[t] ? T : Z);
    }
    function nastav(dily) {
      posledni = dily;
      s.vycisti(); box = null;
      if (!dily || !dily.length) { s.prekresli(); return; }
      // stejné sítě (kopie) sdílejí geometrii; geometrie je ve zdrojové poloze, díl se posune na místo
      const pamet = new Map(), B = new THREE.Box3();
      for (const d of dily) {
        const kl = d.barva;
        let g = pamet.get(d.idx) && pamet.get(d.idx).get(kl);
        if (!g) {
          const tridy = stav.previsy ? G3D.tridyPrevisu(d.poz, d.idx, 45) : null;
          g = s.geometrie(d.zdroj || d.poz, d.idx, { uhel: 1, barvaTroj: barvyDilu(d, tridy) });
          g.computeBoundingBox();
          if (!pamet.has(d.idx)) pamet.set(d.idx, new Map());
          pamet.get(d.idx).set(kl, g);
        }
        const b0 = d.posunZdroje || [0, 0, 0];
        const m = new THREE.Mesh(g, mat); m.position.set(b0[0], b0[1], b0[2]); s.skupina.add(m);
        if (stav.hrany) { const e = s.hrany(d.zdroj || d.poz, d.idx, 30); e.position.copy(m.position); s.skupina.add(e); }
        B.union(g.boundingBox.clone().translate(m.position));
      }
      box = B;
      const vel = new THREE.Vector3(); B.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      const pod = B.clone(); pod.min.z = 0;
      s.mrizka(pod, true);
      if (stav.pravitka) s.pravitka(B);
      if (!uz || Math.abs(novy - rozmer) / rozmer > 0.3 || !rucne) { rozmer = novy; s.pohled(uz ? 'ponech' : { azimut: POHLEDY.iso[0], elevace: POHLEDY.iso[1] }, B); uz = true; }
      else s.prekresli();
    }
    function pohled(jak) {
      if (!box) return;
      rucne = false;
      const u = POHLEDY[jak];
      s.pohled(u ? { azimut: u[0], elevace: u[1] } : jak, box);
    }
    function prepni(co, h) { stav[co] = h; nastav(posledni); }
    // pozadí popisků pravítek podle tématu (scena.barvy ho nemění)
    function barvy(cara, text, pozadi) {
      if (pozadi) s.tema.pozadi = pozadi;
      if (text) s.tema.text = text;   // jen popisky pravítek – hrany zůstávají tmavé jako dřív
      s.barvy(cara, cara);
      if (stav.pravitka && box) s.pravitka(box);
    }
    return { nastav, pohled, prepni, png: s.png, prekresli: s.prekresli, barvy, stav,
      ladeni: () => ({ ovl: s.ovl, deti: s.skupina.children.length, aspect: s.kamera.aspect, w: s.platno.width, h: s.platno.height }) };
  }
  window.KOSTKY3D_NAHLED = { vytvorNahled };
})();
