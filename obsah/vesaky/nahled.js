/* Věšáky – 3D náhled nad společnou scénou gen3d/scena.js (kamera, světla, myš a dotyk, mřížka, pravítka, PNG).
   Sestava = díly na zdi (zeď průhledně), vruty a hmoždinky jako kov / nylon; ROZPAD NA DÍLY: každý díl má vektor
   `rozpad` (posun při plném rozpadu) a montážní čáru od smontované polohy; přechod se animuje.
   Tisková poloha = díly na podložce, převisy barevně. */
/* global THREE, G3D */
(function () {
  'use strict';
  // souřadnice zdi (x do šířky, y nahoru, z ven ze zdi) → scéna se z nahoru: (x, −z, y)
  const MONTAZ = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  const VZHLEDY = {
    plast: { nazev: 'barva tisku', barvy: { hlavni: 0x3f7bd6, deska: 0x5d8fdc }, kov: 0.05, drsnost: 0.42 },
    nerez: { nazev: 'nerez', barvy: { hlavni: 0xc9ced3, deska: 0xbfc5cb }, kov: 0.85, drsnost: 0.32 },
    mosaz: { nazev: 'mosaz', barvy: { hlavni: 0xd2a84a, deska: 0xc79c40 }, kov: 0.8, drsnost: 0.3 },
    cerna: { nazev: 'černá matná', barvy: { hlavni: 0x2b2d31, deska: 0x34363b }, kov: 0.35, drsnost: 0.6 },
    bila: { nazev: 'bílá', barvy: { hlavni: 0xf1f1ee, deska: 0xe8e8e4 }, kov: 0.02, drsnost: 0.5 },
  };
  const BARVA_TRIDY = [null, G3D.BARVY_TRID[1], G3D.BARVY_TRID[2], null];   // most žlutě, převis červeně
  const DUCH = { zed: 0xb8ad9e, dvere: 0xb89c7a, zamek: 0x8f979f, vreteno: 0x6f7880, vlozka: 0xc9a54a };

  /** Síť válce / kužele v ose z (poloměr r0 v z0, r1 v z1) se středem v (x, y), uzavřená. */
  function sitValce(x, y, r0, r1, z0, z1, n = 20) {
    const poz = [x, y, z0, x, y, z1], idx = [];
    for (let k = 0; k < n; k++) { const f = 2 * Math.PI * k / n, c = Math.cos(f), s = Math.sin(f); poz.push(x + r0 * c, y + r0 * s, z0, x + r1 * c, y + r1 * s, z1); }
    for (let k = 0; k < n; k++) {
      const a = 2 + 2 * k, b = 2 + 2 * ((k + 1) % n);
      idx.push(0, b, a, 1, a + 1, b + 1, a, b, b + 1, a, b + 1, a + 1);
    }
    return { poz: new Float32Array(poz), idx: new Uint32Array(idx) };
  }
  /** Spojí více sítí do jedné. */
  function spoj(site) {
    let nv = 0, ni = 0; for (const s of site) { nv += s.poz.length; ni += s.idx.length; }
    const poz = new Float32Array(nv), idx = new Uint32Array(ni); let ov = 0, oi = 0;
    for (const s of site) { poz.set(s.poz, ov); for (let i = 0; i < s.idx.length; i++) idx[oi + i] = s.idx[i] + ov / 3; ov += s.poz.length; oi += s.idx.length; }
    return { poz, idx };
  }

  function vytvorNahled(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 1.08, popis: '3D náhled věšáku – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte' });
    const matDil = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    const matKov = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide });
    const matCara = new THREE.LineDashedMaterial({ color: 0xd98a1f, dashSize: 3, gapSize: 2, transparent: true, opacity: 0.9, depthTest: false });
    let rozpad = 0, cil = 0, cary = null;
    const matDuch = {};
    for (const [k, c] of Object.entries(DUCH)) matDuch[k] = new THREE.MeshStandardMaterial({ color: c, metalness: 0.2, roughness: 0.6, transparent: true,
      opacity: k === 'dvere' ? 0.22 : 0.4, depthWrite: false, side: THREE.DoubleSide });
    const matHranyDuch = new THREE.LineBasicMaterial({ color: 0x55606a, transparent: true, opacity: 0.4, depthWrite: false });
    let objekty = [], model = null, prvni = true;
    const stav = { duchove: true, tisk: false, hrany: true, previsy: true, vzhled: 'plast', rozpad: false, pravitka: false };

    /** m = {montaz: [{poz, idx, role}], tisk: [{poz, idx, tridy, role}], duchove: [{druh, min, max}], klic} nebo null */
    function nastav(m) {
      const zmena = !model || !m || model.klic !== m.klic;
      model = m;
      sestav();
      if (m && (prvni || zmena)) { pohled('iso'); prvni = false; }
    }
    const rgb = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    function sestav() {
      s.vycisti(); objekty = []; cary = null;
      const m = model;
      if (!m) { s.prekresli(); return; }
      const vz = stav.tisk ? VZHLEDY.plast : VZHLEDY[stav.vzhled] || VZHLEDY.plast;
      matDil.metalness = vz.kov; matDil.roughness = vz.drsnost; matDil.clearcoat = vz.kov > 0.5 ? 0.6 : 0.3; matDil.needsUpdate = true;
      for (const d of stav.tisk ? m.tisk : m.montaz) {
        const zaklad = d.barva ? rgb(d.barva) : rgb(vz.barvy[d.role === 'hlavni' ? 'hlavni' : 'deska']), tridy = stav.tisk && stav.previsy ? d.tridy : null;
        const mesh = new THREE.Mesh(s.geometrie(d.poz, d.idx, { uhel: 32, barvaTroj: t => (tridy && BARVA_TRIDY[tridy[t]]) || zaklad }), d.kov && !stav.tisk ? matKov : matDil);
        const h = s.hrany(d.poz, d.idx, 32);
        h.visible = stav.hrany; h.userData.hrany = true;
        if (!stav.tisk) for (const o of [mesh, h]) { o.matrixAutoUpdate = false; o.matrix.copy(MONTAZ); o.userData.rozpad = d.rozpad || null; }
        s.skupina.add(mesh, h); objekty.push(mesh, h);
      }
      if (!stav.tisk) for (const d of m.duchove) {
        const g = new THREE.BoxGeometry(d.max[0] - d.min[0], d.max[1] - d.min[1], d.max[2] - d.min[2]);
        const o = new THREE.Mesh(g, matDuch[d.druh] || matDuch.zamek);
        o.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), matHranyDuch));
        o.matrixAutoUpdate = false;
        o.matrix.copy(MONTAZ).multiply(new THREE.Matrix4().makeTranslation((d.min[0] + d.max[0]) / 2, (d.min[1] + d.max[1]) / 2, (d.min[2] + d.max[2]) / 2));
        o.renderOrder = 2; o.visible = stav.duchove; o.userData.duch = true; o.userData.model = false;
        s.skupina.add(o); objekty.push(o);
      }
      if (!stav.tisk && m.montaz.some(d => d.rozpad && d.kotva)) {
        // montážní čáry: od smontované polohy kotvy dílu k rozložené
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * m.montaz.filter(d => d.rozpad && d.kotva).length), 3));
        cary = new THREE.LineSegments(g, matCara); cary.matrixAutoUpdate = false; cary.matrix.copy(MONTAZ); cary.renderOrder = 3;
        cary.userData.zdroj = m.montaz.filter(d => d.rozpad && d.kotva);
        s.skupina.add(cary);
      }
      umistiRozpad();
      if (stav.tisk) s.mrizka(obalDilu(false), true);
      if (stav.pravitka) s.pravitka(obalDilu(false));
      s.prekresli();
    }
    /** Obal dílů (bez zdi a hran); i = včetně plně rozložené polohy. */
    function obalDilu(i) {
      const b = new THREE.Box3();
      for (const o of objekty) if (!o.userData.hrany && !o.userData.duch) {
        o.updateMatrixWorld(true); b.expandByObject(o);
        if (i && o.userData.rozpad && !stav.tisk) { const v = o.userData.rozpad, pm = o.matrix.clone(); o.matrix.copy(MONTAZ).multiply(new THREE.Matrix4().makeTranslation(v[0], v[1], v[2])); o.updateMatrixWorld(true); b.expandByObject(o); o.matrix.copy(pm); o.updateMatrixWorld(true); }
      }
      return b;
    }
    /** Polohy dílů podle současné míry rozpadu (0 = smontováno, 1 = rozloženo). */
    function umistiRozpad() {
      const f = rozpad * rozpad * (3 - 2 * rozpad);
      for (const o of objekty) if (o.userData.rozpad) {
        const v = o.userData.rozpad;
        o.matrix.copy(MONTAZ).multiply(new THREE.Matrix4().makeTranslation(v[0] * f, v[1] * f, v[2] * f));
      }
      if (cary) {
        const a = cary.geometry.attributes.position;
        cary.userData.zdroj.forEach((d, i) => { const k = d.kotva, v = d.rozpad; a.setXYZ(2 * i, k[0], k[1], k[2]); a.setXYZ(2 * i + 1, k[0] + v[0] * f, k[1] + v[1] * f, k[2] + v[2] * f); });
        a.needsUpdate = true; cary.geometry.computeBoundingSphere(); cary.computeLineDistances(); cary.visible = f > 0.02;
      }
    }
    let animace = null;
    function animujRozpad() {
      if (animace) return;
      const krok = () => {
        const d = cil - rozpad;
        if (Math.abs(d) < 0.01) { rozpad = cil; animace = null; umistiRozpad(); if (stav.pravitka) s.pravitka(obalDilu(false)); s.prekresli(); return; }
        rozpad += Math.sign(d) * Math.min(Math.abs(d), 0.045);
        umistiRozpad(); s.snimek();
        animace = requestAnimationFrame(krok);
      };
      animace = requestAnimationFrame(krok);
    }
    /** Pohled zahrne smontovanou i rozloženou polohu; izometrie se liší pro sestavu na zdi a pro podložku. */
    function pohled(jak) {
      const b = obalDilu(stav.rozpad);
      if (b.isEmpty()) return;
      s.pohled(jak === 'iso' || !G3D.POHLEDY[jak] ? (stav.tisk ? { azimut: -1.2, elevace: 0.75 } : { azimut: -2.0, elevace: 0.42 }) : jak, b);
    }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'rozpad') {
        cil = h ? 1 : 0;
        if (h) pohled('iso');   // záběr na rozloženou sestavu (pohled počítá s oběma polohami)
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { rozpad = cil; umistiRozpad(); if (stav.pravitka) s.pravitka(obalDilu(false)); s.prekresli(); } else animujRozpad();
        return;
      }
      if (co === 'tisk' || co === 'previsy' || co === 'vzhled' || co === 'pravitka') { sestav(); if (co === 'tisk') pohled('iso'); if (co === 'pravitka' && !h) s.pravitka(null); return; }
      for (const o of objekty) o.visible = o.userData.hrany ? stav.hrany : (!o.userData.duch || stav.duchove);
      s.prekresli();
    }
    return { nastav, pohled, prepni, png: s.png, prekresli: s.prekresli, barvy: s.barvy, stav, ovl: s.ovl, scena: s.scena };
  }
  window.VESAKY_NAHLED = { vytvorNahled, VZHLEDY, sitValce, spoj };
})();
