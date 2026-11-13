/* Kliky a knoby – 3D náhled nad společnou scénou gen3d/scena.js (používá ho i knob.html).
   Sestava = díly na dveřích (dveře, zámek a čtyřhran průhledně), vzhled kovu / plastu;
   tisková poloha = díly na podložce, převisy barevně; pravítka; měřítko dole uprostřed.
   nastav({montaz: [{poz, idx, role}], tisk: [{poz, idx, tridy, role}], duchove: [{druh, min, max}], klic} | null)
   prepni('duchove' | 'tisk' | 'hrany' | 'previsy' | 'pravitka' | 'vzhled', h), pohled(jak), png(), barvy(…), stav */
/* global THREE, G3D */
(function () {
  'use strict';
  // dveřní souřadnice (x podél dveří, y nahoru, z ven) → scéna se z nahoru: (x, −z, y)
  const MONTAZ = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  const VZHLEDY = {
    plast: { nazev: 'barva tisku', barvy: { hlavni: 0x3f7bd6, deska: 0x5d8fdc }, kov: 0.05, drsnost: 0.42 },
    nerez: { nazev: 'nerez', barvy: { hlavni: 0xc9ced3, deska: 0xbfc5cb }, kov: 0.85, drsnost: 0.32 },
    mosaz: { nazev: 'mosaz', barvy: { hlavni: 0xd2a84a, deska: 0xc79c40 }, kov: 0.8, drsnost: 0.3 },
    cerna: { nazev: 'černá matná', barvy: { hlavni: 0x2b2d31, deska: 0x34363b }, kov: 0.35, drsnost: 0.6 },
    bila: { nazev: 'bílá', barvy: { hlavni: 0xf1f1ee, deska: 0xe8e8e4 }, kov: 0.02, drsnost: 0.5 },
  };
  const DUCH = { dvere: 0xb89c7a, zamek: 0x8f979f, vreteno: 0x6f7880, vlozka: 0xc9a54a };

  function vytvorNahled(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 1.08, popis: '3D náhled kliky – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte' });
    s.matHrany.opacity = 0.3;
    const matDil = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    const matDuch = {};
    for (const [k, c] of Object.entries(DUCH)) matDuch[k] = new THREE.MeshStandardMaterial({ color: c, metalness: 0.2, roughness: 0.6, transparent: true,
      opacity: k === 'dvere' ? 0.22 : 0.4, depthWrite: false, side: THREE.DoubleSide });
    const matHranyDuch = new THREE.LineBasicMaterial({ color: 0x55606a, transparent: true, opacity: 0.4, depthWrite: false });
    // měřítko: úsečka kulaté délky (1, 2, 5 × 10ⁿ mm) platná v ohnisku pohledu (u středu modelu)
    const meritko = document.createElement('div');
    meritko.className = 'meritko3d'; meritko.setAttribute('aria-hidden', 'true');
    meritko.innerHTML = '<span class="meritko3d-cara"></span><span class="meritko3d-text"></span>';
    kontejner.appendChild(meritko);
    function obnovMeritko() {
      const h = s.platno.clientHeight || 1, mmNaPx = 2 * s.ovl.vzd * Math.tan(s.kamera.fov * Math.PI / 360) / h;
      const cil = mmNaPx * 90, rad = 10 ** Math.floor(Math.log10(cil)), delka = [1, 2, 5, 10].map(k => k * rad).filter(d => d <= cil * 1.4).pop() || rad;
      meritko.querySelector('.meritko3d-cara').style.width = `${Math.round(delka / mmNaPx)}px`;
      meritko.querySelector('.meritko3d-text').textContent = `${String(+delka.toPrecision(3)).replace('.', ',')} mm`;
      meritko.hidden = !model;
    }
    s.scena.onAfterRender = obnovMeritko;   // po každém snímku scény (otáčení, zoom, pohledy)

    let model = null, prvni = true, box = null;
    const stav = { duchove: true, tisk: false, hrany: true, previsy: true, pravitka: false, vzhled: 'plast' };
    const rgb = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

    /** Obal dílů (bez hran a duchů) v souřadnicích scény. */
    function obalModelu() {
      const b = new THREE.Box3();
      for (const o of s.skupina.children) if (o.userData.dil) { o.updateMatrixWorld(true); b.expandByObject(o); }
      return b;
    }
    let posledniKlic = null;   // pohled se resetuje jen při změně druhu modelu, ne po chvilkovém výpadku (chyba stavby)
    function nastav(m) {
      model = m;
      sestav();
      if (m && (prvni || m.klic !== posledniKlic)) { pohled('iso'); prvni = false; }
      if (m) posledniKlic = m.klic;
    }
    function sestav() {
      s.vycisti(); box = null;
      const m = model;
      if (!m) { s.prekresli(); return; }
      const vz = stav.tisk ? VZHLEDY.plast : VZHLEDY[stav.vzhled] || VZHLEDY.plast;
      matDil.metalness = vz.kov; matDil.roughness = vz.drsnost; matDil.clearcoat = vz.kov > 0.5 ? 0.6 : 0.3; matDil.needsUpdate = true;
      for (const d of stav.tisk ? m.tisk : m.montaz) {
        const zaklad = rgb(vz.barvy[d.role === 'hlavni' ? 'hlavni' : 'deska']), tridy = stav.tisk && stav.previsy ? d.tridy : null;
        const mesh = new THREE.Mesh(s.geometrie(d.poz, d.idx, { uhel: 32, barvaTroj: t => (tridy && (tridy[t] === 1 || tridy[t] === 2) ? G3D.BARVY_TRID[tridy[t]] : zaklad) }), matDil);
        mesh.userData.dil = true;
        const h = s.hrany(d.poz, d.idx, 32);
        h.visible = stav.hrany; h.userData.hrany = true; h.userData.model = false;
        if (!stav.tisk) for (const o of [mesh, h]) { o.matrixAutoUpdate = false; o.matrix.copy(MONTAZ); }
        s.skupina.add(mesh, h);
      }
      if (!stav.tisk) for (const d of m.duchove) {
        const g = new THREE.BoxGeometry(d.max[0] - d.min[0], d.max[1] - d.min[1], d.max[2] - d.min[2]);
        const o = new THREE.Mesh(g, matDuch[d.druh] || matDuch.zamek);
        o.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), matHranyDuch));
        o.matrixAutoUpdate = false;
        o.matrix.copy(MONTAZ).multiply(new THREE.Matrix4().makeTranslation((d.min[0] + d.max[0]) / 2, (d.min[1] + d.max[1]) / 2, (d.min[2] + d.max[2]) / 2));
        o.renderOrder = 2; o.visible = stav.duchove; o.userData.duch = true; o.userData.model = false;
        s.skupina.add(o);
      }
      box = obalModelu();
      if (stav.tisk) {
        // podložka aspoň 100 mm, mřížka po 10 mm
        const vel = new THREE.Vector3(); box.getSize(vel);
        const pul = Math.ceil(Math.max(vel.x, vel.y, 100) * 1.25 / 10) * 5, c = new THREE.Vector3(); box.getCenter(c);
        const g = s.mrizka(new THREE.Box3(new THREE.Vector3(c.x - pul / 1.6, c.y - pul / 1.6, 0), new THREE.Vector3(c.x + pul / 1.6, c.y + pul / 1.6, 0)), true, 0.4);
        if (g) g.userData.vlastniMat = true;   // GridHelper si materiál vytváří pokaždé nový
      }
      if (stav.pravitka) s.pravitka(box);
      s.prekresli();
    }
    // iso: sestava zepředu zleva, tisková poloha víc shora
    function pohled(jak) {
      if (!box || box.isEmpty()) return;
      s.pohled(jak === 'iso' || !G3D.POHLEDY[jak] ? (stav.tisk ? { azimut: -1.2, elevace: 0.75 } : { azimut: -2.0, elevace: 0.42 }) : jak, box);
    }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'tisk' || co === 'previsy' || co === 'vzhled' || co === 'pravitka') { sestav(); if (co === 'tisk') pohled('iso'); return; }
      for (const o of s.skupina.children) {
        if (o.userData.hrany) o.visible = stav.hrany;
        else if (o.userData.duch) o.visible = stav.duchove;
      }
      s.prekresli();
    }
    return { nastav, pohled, prepni, png: s.png, prekresli: s.prekresli, barvy: s.barvy, stav, ovl: s.ovl, scena: s };
  }
  window.KLIKY_NAHLED = { vytvorNahled, VZHLEDY };
})();
