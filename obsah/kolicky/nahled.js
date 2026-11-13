/* Kolíčky na prádlo – 3D náhled nad společnou scénou gen3d/scena.js (orbit, světla, mřížka, stín, pravítka, PNG).
   Sestava = kolíček s pružinou, šňůrou a tyčí (duchové), lze ho pootevřít (rozevreni 0–1);
   tisková poloha = díly na podložce, převisy barevně. */
/* global THREE, G3D */
(function () {
  'use strict';
  // souřadnice kolíčku (x délka, y rozevření, z šířka) → scéna se z nahoru: (x, −z, y)
  const MONTAZ = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  const VZHLEDY = {
    plast: { nazev: 'barva tisku', barvy: { horni: 0x3f7bd6, dolni: 0x5d8fdc, pruzina: 0x3fae6a, cep: 0x9aa3ad, kov: 0xb9c0c7 }, kov: 0.05, drsnost: 0.42 },
    drevo: { nazev: 'dřevo (bříza)', barvy: { horni: 0xd9b382, dolni: 0xd2aa78, pruzina: 0xc79c62, cep: 0xb0b6bb, kov: 0xb9c0c7 }, kov: 0.0, drsnost: 0.75 },
    pastel: { nazev: 'pastelové barvy', barvy: { horni: 0xf29bb4, dolni: 0x8fd3c7, pruzina: 0xf5d376, cep: 0xc9ced3, kov: 0xb9c0c7 }, kov: 0.02, drsnost: 0.5 },
    bila: { nazev: 'bílá', barvy: { horni: 0xf1f1ee, dolni: 0xe6e6e2, pruzina: 0xd6d6d2, cep: 0xc9ced3, kov: 0xb9c0c7 }, kov: 0.02, drsnost: 0.5 },
    cerna: { nazev: 'černá matná', barvy: { horni: 0x2b2d31, dolni: 0x34363b, pruzina: 0x4a4d52, cep: 0x8f979f, kov: 0xb9c0c7 }, kov: 0.3, drsnost: 0.6 },
  };
  const DUCH = { kov: [0xb9c0c7, 0.95, 0.3, 1], guma: [0x2b2b2b, 0, 0.8, 1], snura: [0xe7dcc4, 0, 0.9, 0.55], tyc: [0x9a7b55, 0.1, 0.6, 0.35], magnet: [0x6b7178, 0.8, 0.35, 1] };

  function vytvorNahled(kontejner) {
    let s;
    try {
      // pohledy kolíčku: zboku = boční profil (rozevření vidět), zepředu = na čelisti
      s = G3D.scena(kontejner, { odstup: 1.05, popis: '3D náhled kolíčku – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte',
        pohledy: { zboku: [-Math.PI / 2, 0.02], zepredu: [Math.PI, 0.02] } });
    } catch (e) { return null; }
    if (!s.renderer.getContext()) return null;
    const skupina = s.skupina, ovl = s.ovl;
    const matDil = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    const matHrany = s.matHrany;
    const matDuch = {};
    for (const [k, [c, kov, dr, op]] of Object.entries(DUCH)) matDuch[k] = new THREE.MeshStandardMaterial({ color: c, metalness: kov, roughness: dr, transparent: op < 1, opacity: op, depthWrite: op >= 1 });
    // volná pružina (bez předpětí): průsvitně oranžová přes sestavu
    const matVolne = new THREE.MeshStandardMaterial({ color: 0xff8a3d, metalness: 0.1, roughness: 0.6, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });
    let objekty = [], model = null, prvni = true, posledniKlic = null;
    const stav = { duchove: true, tisk: false, hrany: true, previsy: true, vzhled: 'plast', rozevreni: 0, volne: false, rozpad: 0, pravitka: true };

    // pozadí popisků pravítek podle tématu (G3D.scena.barvy ho nenastavuje)
    const barvy = (cara, cara2, hrana, pozadi) => { if (pozadi) s.tema.pozadi = pozadi; s.barvy(cara, cara2, hrana); };
    /** Normály s lomem (ostré hrany zůstanou ostré) a barva po trojúhelnících (převisy v tiskové poloze). */
    const geometrie = (poz, idx, tridy, zaklad) => s.geometrie(poz, idx, { uhel: 32, barvaTroj: t => (tridy && stav.previsy && (tridy[t] === 1 || tridy[t] === 2) && G3D.BARVY_TRID[tridy[t]]) || zaklad });
    function trubka(d) {
      const body = d.body.map(b => new THREE.Vector3(b[0], b[1], b[2]));
      if (body.length === 2 && !d.uzavrena) {
        const g = new THREE.CylinderGeometry(d.r, d.r, body[0].distanceTo(body[1]), 24, 1);
        const m = new THREE.Mesh(g, matDuch[d.druh]);
        m.position.copy(body[0]).add(body[1]).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), body[1].clone().sub(body[0]).normalize());
        m.updateMatrix();
        return { g, matice: m.matrix.clone() };
      }
      const krivka = new THREE.CatmullRomCurve3(body, !!d.uzavrena, 'centripetal', 0.3);
      return { g: new THREE.TubeGeometry(krivka, Math.max(16, body.length * 6), d.r, 10, !!d.uzavrena), matice: new THREE.Matrix4() };
    }

    /** Obal viditelného kolíčku (bez hran, okolí, volné pružiny a duchů). */
    function obalModelu(sDuchy) {
      const b = new THREE.Box3();
      for (const o of objekty) if (!o.userData.hrany && !o.userData.okoli && !o.userData.volne && (sDuchy || !o.userData.duch) && o.visible) { o.updateMatrixWorld(true); b.expandByObject(o); }
      return b;
    }
    /** Pravítka v mm po hranách kolíčku (gen3d/koty.js). */
    function postavPravitko() { s.pravitka(model && stav.pravitka ? obalModelu(false) : null); }
    function uklid() { s.vycisti(); objekty = []; }
    /** Matice pohybu dílu při rozevření θ (v souřadnicích kolíčku). */
    function pohyb(otoc) {
      const m = model, th = stav.tisk || !m ? 0 : stav.rozevreni * (m.thetaMax || 0), xp = m ? m.xp : 0;
      const kolem = (x, y, a) => new THREE.Matrix4().makeTranslation(x, y, 0).multiply(new THREE.Matrix4().makeRotationZ(a)).multiply(new THREE.Matrix4().makeTranslation(-x, -y, 0));
      const meritkoY = (yc, f) => new THREE.Matrix4().makeTranslation(0, yc, 0).multiply(new THREE.Matrix4().makeScale(1, f, 1)).multiply(new THREE.Matrix4().makeTranslation(0, -yc, 0));
      if (otoc === 'horni') return kolem(xp, 0, -th / 2);
      if (otoc === 'dolni') return kolem(xp, 0, th / 2);
      const pr = m && m.pruzina;
      if (otoc === 'jazyk' && pr) return kolem(xp, 0, th / 2).multiply(kolem(pr.xr, pr.y0, -Math.atan2(th * (pr.xk - xp), pr.L)));
      if (otoc === 'pasek' && pr) { const c = pr.c > 0 ? -1 : 1; return kolem(xp, 0, c * th / 2).multiply(kolem(pr.xr, pr.y0, c * Math.atan2(th * (pr.xk - xp), pr.L))); }
      if (otoc === 'vpruz' && pr) return meritkoY(0, Math.max(0.05, 1 - th * (pr.xk - xp) / Math.max(0.1, pr.yu - pr.yl)));
      if (otoc === 'had' && pr) return meritkoY((pr.yu + pr.yl) / 2, Math.max(0.05, 1 - th * (pr.xk - xp) / Math.max(0.1, pr.vyska)));
      return new THREE.Matrix4();
    }
    /** Rozpad na díly: ramena od sebe, čep do strany, pružina ven z kolíčku. */
    function rozpadPosun(klic) {
      const f = stav.tisk || !model ? 0 : stav.rozpad, Wm = (model && model.W) || 10, d = f * Math.max(12, 1.6 * Wm);
      const v = { horni: [0, d, 0], dolni: [0, -d, 0], cep: [0, 0, 1.8 * f * Wm + f * 10], pruzina: [0, 0, -1.6 * f * Wm - f * 8], kov: [0, 0, -1.6 * f * Wm - f * 8] }[klic] || [0, 0, 0];
      return new THREE.Matrix4().makeTranslation(v[0], v[1], v[2]);
    }
    function polohy() {
      for (const o of objekty) {
        if (!o.userData.otoc) continue;
        if (o.userData.okoli) o.visible = stav.duchove && stav.rozpad < 0.05;
        o.matrix.copy(MONTAZ).multiply(rozpadPosun(o.userData.rozpad)).multiply(pohyb(o.userData.otoc));
        if (o.userData.vlastni) o.matrix.multiply(o.userData.vlastni);
      }
    }
    /** m = {sestava: [{poz, idx, role, otoc}], tisk: [{poz, idx, tridy, role}], duchove: [...], klic, xp, thetaMax, pruzina} nebo null */
    function nastav(m) {
      // kamera se vrací na izometrii jen při jiném druhu kolíčku – ne po chvilkově neplatném modelu (rozepsané číslo)
      const zmena = !!m && m.klic !== posledniKlic;
      if (m) posledniKlic = m.klic;
      model = m;
      sestav();
      if (m && (prvni || zmena)) { pohled('iso'); prvni = false; }
    }
    const rgb = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    function sestav() {
      uklid();
      const m = model;
      if (!m) { s.stin(null); s.prekresli(); return; }
      const vz = VZHLEDY[stav.vzhled] || VZHLEDY.plast;
      matDil.metalness = vz.kov; matDil.roughness = vz.drsnost; matDil.needsUpdate = true;
      for (const d of stav.tisk ? m.tisk : m.sestava) {
        const zaklad = rgb(vz.barvy[d.role] || vz.barvy.horni);
        const mesh = new THREE.Mesh(geometrie(d.poz, d.idx, stav.tisk ? d.tridy : null, zaklad), matDil);
        const gi = new THREE.BufferGeometry();
        gi.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); gi.setIndex(new THREE.BufferAttribute(d.idx, 1));
        const h = new THREE.LineSegments(new THREE.EdgesGeometry(gi, 32), matHrany); gi.dispose();
        h.visible = stav.hrany; h.userData.hrany = true;
        // díl, se kterým se kus pohybuje při rozpadu (jazýček patří k dolnímu ramenu, oblouk k nosnému)
        const rk = d.otoc === 'jazyk' ? 'dolni' : d.role;
        if (!stav.tisk) for (const o of [mesh, h]) { o.matrixAutoUpdate = false; o.userData.otoc = d.otoc || 'stred'; o.userData.rozpad = rk; }
        skupina.add(mesh, h); objekty.push(mesh, h);
      }
      if (!stav.tisk) for (const d of m.duchove) {
        const t = trubka(d), o = new THREE.Mesh(t.g, matDuch[d.druh] || matDuch.kov);
        o.matrixAutoUpdate = false; o.userData.otoc = d.otoc || 'stred'; o.userData.vlastni = t.matice;
        o.renderOrder = 2; o.visible = stav.duchove; o.userData.duch = true; o.userData.okoli = d.druh === 'snura' || d.druh === 'tyc';
        o.userData.rozpad = d.druh === 'kov' || d.druh === 'guma' ? 'kov' : d.druh === 'magnet' ? d.otoc : 'stred';
        skupina.add(o); objekty.push(o);
      }
      if (!stav.tisk) {
        for (const d of m.volne || []) {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); g.setIndex(new THREE.BufferAttribute(d.idx, 1)); g.computeVertexNormals();
          const o = new THREE.Mesh(g, matVolne);
          o.matrixAutoUpdate = false; o.renderOrder = 3; o.visible = stav.volne;
          Object.assign(o.userData, { otoc: d.otoc, volne: true, rozpad: d.otoc === 'horni' || d.otoc === 'dolni' ? d.otoc : 'pruzina' });
          skupina.add(o); objekty.push(o);
        }
        for (const d of m.volneDuchove || []) {
          const t = trubka(d), o = new THREE.Mesh(t.g, matVolne);
          o.matrixAutoUpdate = false; o.renderOrder = 3; o.visible = stav.volne;
          Object.assign(o.userData, { otoc: d.otoc || 'stred', vlastni: t.matice, volne: true, rozpad: 'kov' });
          skupina.add(o); objekty.push(o);
        }
      }
      if (!stav.tisk) polohy();
      const box = obalModelu(true);
      s.mrizka(box.isEmpty() ? null : box, stav.tisk, 0.4);
      s.stin(box.isEmpty() ? null : box, !stav.tisk);
      postavPravitko();
      s.prekresli();
    }
    function pohled(jak) {
      const b = obalModelu(false);
      if (b.isEmpty()) return;
      // izometrie kolíčku: v sestavě víc zboku, na podložce víc shora
      s.pohled(jak === 'iso' || !jak ? (stav.tisk ? { azimut: -1.2, elevace: 0.75 } : { azimut: -1.95, elevace: 0.5 }) : jak, b);
    }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'tisk' || co === 'previsy' || co === 'vzhled') { sestav(); if (co === 'tisk') pohled('iso'); return; }
      if (co === 'rozevreni' || co === 'rozpad') { polohy(); s.prekresli(); return; }
      if (co === 'pravitka') { postavPravitko(); return; }
      for (const o of objekty) o.visible = o.userData.volne ? stav.volne : o.userData.hrany ? stav.hrany : (!o.userData.duch || stav.duchove) && !(o.userData.okoli && stav.rozpad >= 0.05);
      s.prekresli();
    }
    // PNG i ze skrytého náhledu (skicář): plátno nejdřív na velikost kontejneru
    function png() {
      const w = kontejner.clientWidth, h = kontejner.clientHeight;
      if (w && h) { s.renderer.setSize(w, h, false); s.kamera.aspect = w / h; s.kamera.updateProjectionMatrix(); }
      return s.png();
    }
    return { nastav, pohled, prepni, png, prekresli: s.prekresli, barvy, stav, ovl };
  }
  window.KOLICKY_NAHLED = { vytvorNahled, VZHLEDY };
})();
