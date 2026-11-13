/* S hák – 3D náhled nad společnou scénou gen3d/scena.js (kamera, světla, myš a dotyk, mřížka, stín, pravítka).
   Síť háku je v tiskové poloze: osa Z nahoru = tisková výška (šířka průřezu), hák leží v rovině XY jako na podložce.
   Montážní poloha = hák s trubkami otočený o 90° kolem X (visí na trubkách). */
/* global THREE, G3D */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 1.35, pohledy: { iso: [-1.2, 0.75] },
      popis: '3D náhled háku – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte' });
    const matHak = new THREE.MeshPhysicalMaterial({ color: 0x3f7bd6, roughness: 0.42, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    const matNapeti = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, clearcoat: 0.2, side: THREE.DoubleSide });
    const matPrevisy = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    const matTrubka = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
    const stav = { trubky: true, napeti: false, tisk: false, hrany: true, previsy: true, pravitka: false };
    let obsah = null, hak = null, hrany = null, trubky = [], model = null, barvyNap = null, uhel = 45, rozmer = 100, stred0 = null;
    const MODRA = new THREE.Color(0x3f7bd6).toArray();

    /** Materiál a barvy: převisy (jen v tiskové poloze) mají přednost před napětím. */
    function material() {
      if (!hak) return;
      const tridy = stav.tisk && stav.previsy ? G3D.tridyPrevisu(model.poz, model.idx, uhel) : null;
      const C = hak.geometry.getAttribute('color');
      if (tridy) {
        for (let t = 0; t < tridy.length; t++) {
          const b = tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : MODRA;
          for (let k = 0; k < 3; k++) C.array.set(b, 9 * t + 3 * k);
        }
        C.needsUpdate = true; hak.material = matPrevisy;
      } else if (stav.napeti && barvyNap) {
        const I = model.idx;
        for (let i = 0; i < I.length; i++) C.array.set(barvyNap.subarray(3 * I[i], 3 * I[i] + 3), 3 * i);
        C.needsUpdate = true; hak.material = matNapeti;
      } else hak.material = matHak;
    }
    function nastav(m, barvy, volby = {}) {
      model = m; barvyNap = barvy; if (volby.uhel) uhel = volby.uhel;
      s.vycisti(); hak = hrany = obsah = null; trubky = [];
      if (!m || m.chyba) { s.stin(null); s.prekresli(); return; }
      obsah = new THREE.Group(); s.skupina.add(obsah);
      const g = s.geometrie(m.poz, m.idx, { uhel: 32, barvaTroj: () => [0, 0, 0] });   // barvy trojúhelníků plní material()
      hak = new THREE.Mesh(g, matHak); obsah.add(hak);
      hrany = s.hrany(m.poz, m.idx, 32); hrany.visible = stav.hrany; obsah.add(hrany);
      const vyska = m.pr.sirka;
      for (const [C, D] of [[m.tr.C1, m.p.trubka1], [m.tr.C2, m.p.trubka2]]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(D / 2, D / 2, vyska + 30, 64, 1, true), matTrubka);
        c.rotation.x = Math.PI / 2; c.position.set(C[0], C[1], vyska / 2);
        c.visible = stav.trubky; c.renderOrder = 2; c.userData.model = false;
        obsah.add(c); trubky.push(c);
      }
      material();
      g.computeBoundingBox();
      const vel = new THREE.Vector3(), st = new THREE.Vector3(); g.boundingBox.getSize(vel); g.boundingBox.getCenter(st);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      natoc();
      // nový pohled při první sestavě, velké změně velikosti nebo když model uteče ze středu; jinak natočení od uživatele zůstane
      if (!stred0 || Math.abs(novy - rozmer) / rozmer > 0.3 || st.distanceTo(stred0) > 0.35 * novy) {
        pohled(stred0 ? 'ponech' : 'iso'); rozmer = novy; stred0 = st.clone();
      }
      s.prekresli();
    }
    /** Montážní poloha: S hák visí (rovina háku svisle, trubky vodorovně); tisková: leží na podložce. Mřížka, stín a pravítka podle polohy. */
    function natoc() {
      if (!obsah) return;
      obsah.rotation.set(stav.tisk ? 0 : Math.PI / 2, 0, 0);
      obsah.updateMatrixWorld(true);
      const b = obalHaku();
      s.mrizka(b, stav.tisk);
      s.stin(b, true);
      s.pravitka(stav.pravitka ? b : null);
    }
    const obalHaku = () => new THREE.Box3().setFromObject(hak);
    /** Záběr na hák i trubky. */
    function pohled(jak) {
      if (!hak) return;
      const b = obalHaku();
      for (const t of trubky) if (t.visible) b.expandByObject(t);
      s.pohled(jak, b);
    }
    function prepni(co, h) {
      stav[co] = h;
      trubky.forEach(t => { t.visible = stav.trubky; });
      if (hrany) hrany.visible = stav.hrany;
      if (co === 'napeti' || co === 'previsy' || co === 'tisk') material();
      if (co === 'tisk') { natoc(); pohled('iso'); }
      if (co === 'pravitka' && hak) s.pravitka(h ? obalHaku() : null);
      s.prekresli();
    }
    /** Snímek náhledu; meritko > 1 = vyšší rozlišení (technický list), pak se vrátí původní. */
    const png = (meritko = 1) => {
      const r = s.renderer, pr0 = r.getPixelRatio();
      if (meritko > 1) r.setPixelRatio(meritko);
      s.snimek(); const url = s.platno.toDataURL('image/png');
      if (meritko > 1) { r.setPixelRatio(pr0); s.snimek(); }
      return url;
    };
    /** Barvy z proměnných stránky (téma); první argument (pozadí) se nepoužívá – pozadí dává CSS. */
    const barvy = (pozadi, cara, cara2, hrana) => s.barvy(cara, cara2, hrana);
    return { nastav, pohled, prepni, png, prekresli: s.prekresli, barvy, stav, ovl: s.ovl, scena: s.scena };
  }
  window.SHAK_NAHLED = { vytvorNahled };
})();
