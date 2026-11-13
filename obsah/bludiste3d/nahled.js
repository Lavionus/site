/* Bludiště – 3D náhled nad společnou scénou gen3d/scena.js: díly ve složené nebo tiskové poloze, rozložení, průhlednost,
   řešení jako trubička, kulička na startu; převisy barevně (v tiskové poloze), řez rovinou y = 0, pravítka. */
/* global THREE, G3D, BLUD */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 1.05, popis: '3D náhled bludiště – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte' });
    const matCesta = new THREE.MeshStandardMaterial({ color: 0xffc000, roughness: 0.4, emissive: 0x805000 });   // řešení: sytě žluté v obou tématech
    const matKulicka = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.18 });
    let model = null, dily = null, rozmer = 100, uz = false, rezim = null, box = null;
    const stav = { reseni: true, rozlozit: false, pruhledne: true, hrany: true, tisk: false, previsy: false, rez: false, pravitka: false };
    const rez = () => (stav.rez ? [s.rovinaRezu] : []);

    /** Rozložení: posun dílu nahoru podle jeho pořadí (kostka po vrstvách, víko nad krabičkou). */
    function posunRozlozeni(d, i) {
      if (!stav.rozlozit || !model) return 0;
      const p = model.p;
      if (p.rezim === 'valec') return d.jmeno === 'pouzdro' ? model.vyskaPouzdra + 12 : 0;
      if (p.rezim === 'kostka') return i * Math.max(12, model.krok);
      return d.jmeno === 'viko' ? 30 : d.jmeno === 'plexi' ? 15 : 0;
    }
    function sestav(novyPohled) {
      s.vycisti(); box = null;
      if (!model || !dily) { s.prekresli(); return; }
      const p = model.p;
      matCesta.clippingPlanes = rez(); matKulicka.clippingPlanes = rez(); matCesta.needsUpdate = matKulicka.needsUpdate = true;
      const zobrazit = stav.tisk ? BLUD.rozmisti(dily.filter(d => d.tisk)) : dily;
      const B = new THREE.Box3();
      zobrazit.forEach((d, i) => {
        const pruh = !stav.tisk && stav.pruhledne && (d.jmeno !== 'nadoba' && d.jmeno !== 'zaklad' && d.jmeno !== 'vrstva1');
        const tridy = stav.tisk && stav.previsy ? G3D.tridyPrevisu(d.poz, d.idx, 45) : null;
        const c = new THREE.Color(d.barva || '#4F86D9');
        const g = s.geometrie(d.poz, d.idx, { uhel: 30, barvaTroj: tridy && (t => (tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : [c.r, c.g, c.b])) });
        const mat = new THREE.MeshPhysicalMaterial({ color: tridy ? 0xffffff : c, vertexColors: !!tridy, roughness: 0.45, metalness: 0.03, clearcoat: 0.3,
          side: stav.rez ? THREE.FrontSide : THREE.DoubleSide, clippingPlanes: rez(),
          transparent: pruh || d.jmeno === 'plexi', opacity: d.jmeno === 'plexi' ? 0.25 : pruh ? 0.32 : 1, depthWrite: !(pruh || d.jmeno === 'plexi') });
        const sk = new THREE.Group();
        const sit = new THREE.Mesh(g, mat); sit.userData.vlastniMat = true;
        if (pruh) sit.renderOrder = 3;
        sk.add(sit);
        if (stav.rez) { const vn = new THREE.Mesh(g, s.matVnitrek); vn.userData.model = false; sk.add(vn); }
        if (stav.hrany) {
          const mh = new THREE.LineBasicMaterial({ color: s.matHrany.color, transparent: true, opacity: s.matHrany.opacity, clippingPlanes: rez() });
          const h = s.hrany(d.poz, d.idx, 32, mh); h.userData.vlastniMat = true; sk.add(h);
        }
        if (!stav.tisk) { sk.rotation.z = d.sestava.rotZ; sk.position.z = d.sestava.dz + posunRozlozeni(d, i); }
        s.skupina.add(sk);
        sk.updateMatrixWorld(true);
        g.computeBoundingBox(); B.union(g.boundingBox.clone().applyMatrix4(sit.matrixWorld));
      });
      if (!stav.tisk && stav.reseni) {
        const body = BLUD.bodyReseni(model).map(b => {
          let dz = 0;
          if (p.rezim === 'kostka' && stav.rozlozit) dz = Math.floor(b[2] / model.krok) * Math.max(12, model.krok);
          return new THREE.Vector3(b[0], b[1], b[2] + dz);
        });
        if (body.length > 1) {
          class Lomena extends THREE.Curve {
            constructor(P) { super(); this.B = P; this.L = [0]; for (let i = 1; i < P.length; i++) this.L.push(this.L[i - 1] + P[i].distanceTo(P[i - 1])); }
            getPoint(t, cil = new THREE.Vector3()) {
              const d = t * this.L[this.L.length - 1]; let i = 1; while (i < this.L.length - 1 && this.L[i] < d) i++;
              const u = (d - this.L[i - 1]) / Math.max(1e-9, this.L[i] - this.L[i - 1]);
              return cil.copy(this.B[i - 1]).lerp(this.B[i], Math.min(1, Math.max(0, u)));
            }
          }
          const r = Math.max(0.45, (p.rezim === 'valec' ? p.kulicka : model.w) * 0.16);
          s.skupina.add(new THREE.Mesh(new THREE.TubeGeometry(new Lomena(body), Math.min(4000, body.length * 6), r, 6, false), matCesta));
          // začátek a konec řešení
          for (const [b, c] of [[body[0], 0x30b070], [body[body.length - 1], 0xe04030]]) {
            const k = new THREE.Mesh(new THREE.SphereGeometry(r * 2.4, 16, 12), new THREE.MeshStandardMaterial({ color: c, clippingPlanes: rez() }));
            k.userData.vlastniMat = true; k.position.copy(b); s.skupina.add(k);
          }
        }
      }
      if (!stav.tisk && p.rezim !== 'valec') {
        const st = BLUD.stredBunky(model, model.b.start);
        const kul = new THREE.Mesh(new THREE.SphereGeometry(p.kulicka / 2, 32, 20), matKulicka);
        const dz = p.rezim === 'kostka' && stav.rozlozit ? Math.floor(st[2] / model.krok) * Math.max(12, model.krok) : 0;
        kul.position.set(st[0], st[1], st[2] + dz); s.skupina.add(kul);
      }
      box = B;
      const pod = B.clone(); pod.min.z = Math.min(0, B.min.z);
      s.mrizka(pod, true);
      if (stav.pravitka) s.pravitka(B);
      const vel = new THREE.Vector3(); B.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      // nový pohled při první sestavě, jiném typu nebo velké změně velikosti – jinak natočení od uživatele zůstane
      if (!uz || rezim !== p.rezim || Math.abs(novy - rozmer) / rozmer > 0.3 || novyPohled) { rozmer = novy; s.pohled(uz ? 'ponech' : 'iso', B); uz = true; rezim = p.rezim; }
      else s.prekresli();
    }
    function nastav(m, d) { model = m && !m.chyba ? m : null; dily = model ? d : null; sestav(); }
    const pohled = jak => { if (box) s.pohled(jak, box); };
    function prepni(co, h) { stav[co] = h; sestav(co === 'tisk' || co === 'rozlozit'); }
    // pozadí popisků pravítek podle tématu (scena.barvy ho nemění)
    function barvy(cara, cara2, hrana, pozadi) {
      if (pozadi) s.tema.pozadi = pozadi;
      s.barvy(cara, cara2, hrana);
      if (stav.pravitka && box) s.pravitka(box);
    }
    return { nastav, pohled, prepni, png: s.png, prekresli: s.prekresli, barvy, stav, ovl: s.ovl };
  }
  window.BLUD_NAHLED = { vytvorNahled };
})();
