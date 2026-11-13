/* Formy na odlévání – 3D náhled nad společnou scénou gen3d/scena.js: díly formy, model obarvený podle podkosů, rovina / hladina,
   rozložená sestava nebo tisková poloha; převisy barevně (v tiskové poloze), řez rovinou y = 0, pravítka. */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 0.8, popis: '3D náhled formy – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte' });
    const matRovina = new THREE.MeshBasicMaterial({ color: 0x3aa0ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    const stav = { pruhledna: true, podkosy: true, rovina: true, hrany: true, tisk: false, rozlozit: 0, previsy: false, rez: false, pravitka: false };
    let data = null, rozmer = 100, uz = false, box = null;
    const rez = () => (stav.rez ? [s.rovinaRezu] : []);
    const barvaTroj = B => (B ? t => [B[3 * t], B[3 * t + 1], B[3 * t + 2]] : null);

    /** d = {dily, tiskDily, dutina:{poz,idx}, barvyPloch (Float32 3/trojúhelník), barvyZaklad, kopie:[[dx,dy,dz]], rovina:{h, box}, chyba} */
    function nastav(d) { data = d; postavScenu(); }
    function postavScenu(novyPohled) {
      s.vycisti(); box = null;
      const d = data;
      if (!d || d.chyba) { s.prekresli(); return; }
      const dily = stav.tisk ? d.tiskDily : d.dily;
      const B = new THREE.Box3();
      dily.forEach((dil, i) => {
        const tridy = stav.tisk && stav.previsy ? G3D.tridyPrevisu(dil.poz, dil.idx, 45) : null;
        const c = new THREE.Color(dil.barva);
        const g = s.geometrie(dil.poz, dil.idx, { uhel: 35, barvaTroj: tridy && (t => (tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : [c.r, c.g, c.b])) });
        const pr = stav.pruhledna && !stav.tisk && dil.jmeno !== 'model';
        const mat = new THREE.MeshPhysicalMaterial({ color: tridy ? 0xffffff : c, vertexColors: !!tridy, roughness: 0.5, metalness: 0.02, clearcoat: 0.2,
          side: stav.rez ? THREE.FrontSide : THREE.DoubleSide, clippingPlanes: rez(), transparent: pr, opacity: pr ? 0.32 : 1, depthWrite: !pr });
        const m = new THREE.Mesh(g, mat); m.userData.vlastniMat = true;
        const sk = new THREE.Group(); sk.add(m);
        if (stav.rez && !pr) { const vn = new THREE.Mesh(g, s.matVnitrek); vn.userData.model = false; sk.add(vn); }
        if (stav.hrany) {
          const mh = new THREE.LineBasicMaterial({ color: s.matHrany.color, transparent: true, opacity: 0.3, clippingPlanes: rez() });
          const h = s.hrany(dil.poz, dil.idx, 35, mh); h.userData.vlastniMat = true; sk.add(h);
        }
        // rozložená sestava: horní díl / rámeček nahoru
        if (!stav.tisk && stav.rozlozit && (dil.jmeno === 'horni' || dil.jmeno === 'ramecek')) sk.position.z = stav.rozlozit;
        if (pr) m.renderOrder = 2 + i;
        s.skupina.add(sk);
        g.computeBoundingBox(); B.union(g.boundingBox.clone().translate(sk.position));
      });
      if (!stav.tisk && d.dutina && d.kopie) {
        const g = s.geometrie(d.dutina.poz, d.dutina.idx, { uhel: 35, barvaTroj: barvaTroj(d.barvyPloch && stav.podkosy ? d.barvyPloch : d.barvyZaklad) });
        const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05, clearcoat: 0.3, side: THREE.DoubleSide, clippingPlanes: rez() });
        for (const [dx, dy, dz] of d.kopie) {
          const m = new THREE.Mesh(g, mat); m.userData.vlastniMat = true; m.position.set(dx, dy, dz); m.renderOrder = 1; s.skupina.add(m);
        }
      }
      if (!stav.tisk && stav.rovina && d.rovina) {
        const r = d.rovina, sz = new THREE.Vector3(), c = new THREE.Vector3(); B.getSize(sz); B.getCenter(c);
        let m;
        if (r.box) {
          // silikonová lázeň: průsvitný kvádr od osazení po hladinu
          const b = r.box;
          m = new THREE.Mesh(new THREE.BoxGeometry(b.L, b.W, b.fill - b.zPl), matRovina);
          m.position.set(c.x, c.y, (b.zPl + b.fill) / 2);
        } else {
          m = new THREE.Mesh(new THREE.PlaneGeometry(sz.x * 1.25 + 10, sz.y * 1.25 + 10), matRovina);
          m.position.set(c.x, c.y, r.h);
        }
        m.renderOrder = 10; m.userData.model = false; s.skupina.add(m);
      }
      box = B;
      s.mrizka(B, true);
      if (stav.pravitka) s.pravitka(B);
      const sz = new THREE.Vector3(); B.getSize(sz);
      const novy = Math.max(sz.x, sz.y, sz.z, 10);
      if (!uz || Math.abs(novy - rozmer) / rozmer > 0.3 || novyPohled) { rozmer = novy; s.pohled(novyPohled === 'iso' ? 'iso' : uz ? 'ponech' : 'iso', B); uz = true; }
      else s.prekresli();
    }
    const pohled = jak => { if (box) s.pohled(jak, box); };
    function prepni(co, h) { stav[co] = h; if (data) postavScenu(co === 'tisk' ? 'iso' : false); }
    // pozadí popisků pravítek podle tématu (scena.barvy ho nemění)
    function barvy(cara, cara2, hrana, pozadi) {
      if (pozadi) s.tema.pozadi = pozadi;
      s.barvy(cara, cara2, hrana);
      if (data) postavScenu();
    }
    return { nastav, pohled, prepni, png: s.png, prekresli: s.prekresli, barvy, stav, ovl: s.ovl };
  }
  window.FORMY_NAHLED = { vytvorNahled };
})();
