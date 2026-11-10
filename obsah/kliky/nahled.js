/* Kliky a knoby – 3D náhled (three.js r128): otáčení tažením / jedním prstem, posun pravým tlačítkem / Shift / dvěma prsty, kolečko = zoom.
   Sestava = díly na dveřích (dveře, zámek a čtyřhran průhledně), vzhled kovu / plastu;
   tisková poloha = díly na podložce, převisy barevně. */
/* global THREE */
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
  const BARVA_TRIDY = [null, [0.85, 0.66, 0.2], [0.86, 0.22, 0.2], null];
  const DUCH = { dvere: 0xb89c7a, zamek: 0x8f979f, vreteno: 0x6f7880, vlozka: 0xc9a54a };

  function vytvorNahled(kontejner) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    kontejner.appendChild(renderer.domElement);
    const platno = renderer.domElement;
    Object.assign(platno.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
    platno.tabIndex = 0;
    platno.setAttribute('aria-label', '3D náhled kliky – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');

    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
    kamera.up.set(0, 0, 1);
    scena.add(new THREE.HemisphereLight(0xf4f7ff, 0x3a4048, 0.6));
    const sv1 = new THREE.DirectionalLight(0xffffff, 0.75); sv1.position.set(1.2, -1.6, 2.2); kamera.add(sv1);
    const sv2 = new THREE.DirectionalLight(0xdfe8ff, 0.3); sv2.position.set(-1.8, 0.4, 0.8); kamera.add(sv2);
    const sv3 = new THREE.DirectionalLight(0xffffff, 0.35); sv3.position.set(0.3, 2, -1); kamera.add(sv3);
    scena.add(kamera);
    const matDil = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.3 });
    const matDuch = {};
    for (const [k, c] of Object.entries(DUCH)) matDuch[k] = new THREE.MeshStandardMaterial({ color: c, metalness: 0.2, roughness: 0.6, transparent: true,
      opacity: k === 'dvere' ? 0.22 : 0.4, depthWrite: false, side: THREE.DoubleSide });
    const matHranyDuch = new THREE.LineBasicMaterial({ color: 0x55606a, transparent: true, opacity: 0.4, depthWrite: false });
    const skupina = new THREE.Group(); scena.add(skupina);
    // měřítko: úsečka kulaté délky (1, 2, 5 × 10ⁿ mm) platná v ohnisku pohledu (u středu modelu)
    const meritko = document.createElement('div');
    meritko.className = 'meritko3d'; meritko.setAttribute('aria-hidden', 'true');
    meritko.innerHTML = '<span class="meritko3d-cara"></span><span class="meritko3d-text"></span>';
    kontejner.appendChild(meritko);
    function obnovMeritko() {
      const h = platno.clientHeight || 1, mmNaPx = 2 * ovl.vzd * Math.tan(kamera.fov * Math.PI / 360) / h;
      const cil = mmNaPx * 90, rad = 10 ** Math.floor(Math.log10(cil)), delka = [1, 2, 5, 10].map(k => k * rad).filter(d => d <= cil * 1.4).pop() || rad;
      meritko.querySelector('.meritko3d-cara').style.width = `${Math.round(delka / mmNaPx)}px`;
      meritko.querySelector('.meritko3d-text').textContent = `${String(+delka.toPrecision(3)).replace('.', ',')} mm`;
      meritko.hidden = !model;
    }
    let objekty = [], mrizka = null, model = null, prvni = true;
    const tema = { mrizka: 0x888888, mrizka2: 0x555555 };
    const stav = { duchove: true, tisk: false, hrany: true, previsy: true, vzhled: 'plast' };

    function barvy(cara, cara2, hrana) {
      if (hrana) matHrany.color.set(hrana);
      tema.mrizka = new THREE.Color(cara).getHex(); tema.mrizka2 = new THREE.Color(cara2).getHex();
      if (mrizka) mrizka.material.color.setHex(tema.mrizka2);
      prekresli();
    }
    /** Normály s lomem (ostré hrany zůstanou ostré) a barva po trojúhelnících. */
    function geometrie(poz, idx, tridy, zaklad) {
      const nT = idx.length / 3, fn = new Float32Array(3 * nT), nV = poz.length / 3, kos = Math.cos(32 * Math.PI / 180);
      const sous = Array.from({ length: nV }, () => []);
      for (let t = 0; t < nT; t++) {
        const a = idx[3 * t], b = idx[3 * t + 1], c = idx[3 * t + 2];
        const ux = poz[3 * b] - poz[3 * a], uy = poz[3 * b + 1] - poz[3 * a + 1], uz = poz[3 * b + 2] - poz[3 * a + 2];
        const vx = poz[3 * c] - poz[3 * a], vy = poz[3 * c + 1] - poz[3 * a + 1], vz = poz[3 * c + 2] - poz[3 * a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
        fn[3 * t] = nx / l; fn[3 * t + 1] = ny / l; fn[3 * t + 2] = nz / l;
        sous[a].push(t); sous[b].push(t); sous[c].push(t);
      }
      const P = new Float32Array(9 * nT), N = new Float32Array(9 * nT), C = new Float32Array(9 * nT);
      for (let t = 0; t < nT; t++) {
        const bv = (tridy && stav.previsy && BARVA_TRIDY[tridy[t]]) || zaklad;
        for (let k = 0; k < 3; k++) {
          const v = idx[3 * t + k], o = 9 * t + 3 * k;
          let nx = 0, ny = 0, nz = 0;
          for (const f of sous[v]) if (fn[3 * f] * fn[3 * t] + fn[3 * f + 1] * fn[3 * t + 1] + fn[3 * f + 2] * fn[3 * t + 2] >= kos) { nx += fn[3 * f]; ny += fn[3 * f + 1]; nz += fn[3 * f + 2]; }
          const l = Math.hypot(nx, ny, nz) || 1;
          N[o] = nx / l; N[o + 1] = ny / l; N[o + 2] = nz / l;
          P[o] = poz[3 * v]; P[o + 1] = poz[3 * v + 1]; P[o + 2] = poz[3 * v + 2];
          C[o] = bv[0]; C[o + 1] = bv[1]; C[o + 2] = bv[2];
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      g.setAttribute('color', new THREE.BufferAttribute(C, 3));
      return g;
    }

    const ovl = { cil: new THREE.Vector3(), vzd: 300, azimut: -1.2, elevace: 0.4 };
    let ceka = false;
    function prekresli() { if (ceka) return; ceka = true; requestAnimationFrame(() => { ceka = false; snimek(); }); }
    function snimek() {
      const ce = Math.cos(ovl.elevace);
      kamera.position.set(ovl.cil.x + ovl.vzd * ce * Math.cos(ovl.azimut), ovl.cil.y + ovl.vzd * ce * Math.sin(ovl.azimut), ovl.cil.z + ovl.vzd * Math.sin(ovl.elevace));
      kamera.lookAt(ovl.cil);
      kamera.near = Math.max(0.1, ovl.vzd / 200); kamera.far = ovl.vzd * 30 + 2000; kamera.updateProjectionMatrix();
      renderer.render(scena, kamera);
      obnovMeritko();
    }
    function velikost() {
      const w = kontejner.clientWidth || 1, h = kontejner.clientHeight || 1;
      renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); prekresli();
    }
    new ResizeObserver(velikost).observe(kontejner);

    function uklid() {
      for (const o of [...objekty, mrizka]) if (o) { skupina.remove(o); o.traverse(c => { if (c.geometry) c.geometry.dispose(); }); }
      if (mrizka) mrizka.material.dispose();   // GridHelper si materiál vytváří pokaždé nový
      objekty = []; mrizka = null;
    }
    /** m = {montaz: [{poz, idx, role}], tisk: [{poz, idx, tridy, role}], duchove: [{druh, min, max}], klic} nebo null */
    let posledniKlic = null;   // pohled se resetuje jen při změně druhu modelu, ne po chvilkovém výpadku (chyba stavby)
    function nastav(m) {
      model = m;
      sestav();
      if (m && (prvni || m.klic !== posledniKlic)) { pohled('iso'); prvni = false; }
      if (m) posledniKlic = m.klic;
    }
    const rgb = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    function sestav() {
      uklid();
      const m = model;
      if (!m) { prekresli(); return; }
      const vz = stav.tisk ? VZHLEDY.plast : VZHLEDY[stav.vzhled] || VZHLEDY.plast;
      matDil.metalness = vz.kov; matDil.roughness = vz.drsnost; matDil.clearcoat = vz.kov > 0.5 ? 0.6 : 0.3; matDil.needsUpdate = true;
      for (const d of stav.tisk ? m.tisk : m.montaz) {
        const zaklad = rgb(vz.barvy[d.role === 'hlavni' ? 'hlavni' : 'deska']);
        const mesh = new THREE.Mesh(geometrie(d.poz, d.idx, stav.tisk ? d.tridy : null, zaklad), matDil);
        const gi = new THREE.BufferGeometry();
        gi.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); gi.setIndex(new THREE.BufferAttribute(d.idx, 1));
        const h = new THREE.LineSegments(new THREE.EdgesGeometry(gi, 32), matHrany); gi.dispose();
        h.visible = stav.hrany; h.userData.hrany = true;
        if (!stav.tisk) for (const o of [mesh, h]) { o.matrixAutoUpdate = false; o.matrix.copy(MONTAZ); }
        skupina.add(mesh, h); objekty.push(mesh, h);
      }
      if (!stav.tisk) for (const d of m.duchove) {
        const g = new THREE.BoxGeometry(d.max[0] - d.min[0], d.max[1] - d.min[1], d.max[2] - d.min[2]);
        const o = new THREE.Mesh(g, matDuch[d.druh] || matDuch.zamek);
        o.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), matHranyDuch));
        o.matrixAutoUpdate = false;
        o.matrix.copy(MONTAZ).multiply(new THREE.Matrix4().makeTranslation((d.min[0] + d.max[0]) / 2, (d.min[1] + d.max[1]) / 2, (d.min[2] + d.max[2]) / 2));
        o.renderOrder = 2; o.visible = stav.duchove; o.userData.duch = true;
        skupina.add(o); objekty.push(o);
      }
      if (stav.tisk) {
        const b = new THREE.Box3();
        for (const o of objekty) if (!o.userData.hrany) b.expandByObject(o);
        const vel = new THREE.Vector3(); b.getSize(vel);
        const n = Math.ceil(Math.max(vel.x, vel.y, 100) * 1.25 / 10);
        mrizka = new THREE.GridHelper(n * 10, n, tema.mrizka, tema.mrizka2);
        mrizka.rotation.x = Math.PI / 2; mrizka.position.z = -0.02;
        mrizka.material.transparent = true; mrizka.material.opacity = 0.4;
        skupina.add(mrizka);
      }
      prekresli();
    }
    function pohled(jak) {
      const b = new THREE.Box3();
      for (const o of objekty) if (!o.userData.hrany && !o.userData.duch) { o.updateMatrixWorld(true); b.expandByObject(o); }
      if (b.isEmpty()) return;
      const koule = new THREE.Sphere();
      b.getCenter(ovl.cil); b.getBoundingSphere(koule);
      const vf = kamera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * kamera.aspect);
      ovl.vzd = koule.radius / Math.sin(Math.min(vf, hf) / 2) * 1.08;
      if (jak === 'shora') { ovl.azimut = -Math.PI / 2; ovl.elevace = Math.PI / 2 - 1e-3; }
      else if (jak === 'zepredu') { ovl.azimut = -Math.PI / 2; ovl.elevace = 0.02; }
      else if (jak === 'zboku') { ovl.azimut = 0; ovl.elevace = 0.02; }
      else if (stav.tisk) { ovl.azimut = -1.2; ovl.elevace = 0.75; }
      else { ovl.azimut = -2.0; ovl.elevace = 0.42; }
      prekresli();
    }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'tisk' || co === 'previsy' || co === 'vzhled') { sestav(); if (co === 'tisk') pohled('iso'); return; }
      for (const o of objekty) o.visible = o.userData.hrany ? stav.hrany : (!o.userData.duch || stav.duchove);
      prekresli();
    }

    // myš a dotyk
    const ukaz = new Map(); let start = null;
    platno.addEventListener('pointerdown', e => {
      try { platno.setPointerCapture(e.pointerId); } catch (err) { /* syntetická událost */ }
      ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      start = { posun: e.button === 2 || e.shiftKey, vzd: ovl.vzd, roz: null };
      if (ukaz.size === 2) { const [a, b] = [...ukaz.values()]; start.roz = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    });
    const posunPohled = (dx, dy) => {
      const k = ovl.vzd / platno.clientHeight * 0.8, prave = new THREE.Vector3(), nahoru = new THREE.Vector3();
      kamera.matrixWorld.extractBasis(prave, nahoru, new THREE.Vector3());
      ovl.cil.addScaledVector(prave, -dx * k).addScaledVector(nahoru, dy * k);
    };
    platno.addEventListener('pointermove', e => {
      if (!ukaz.has(e.pointerId) || !start) return;
      const pred = ukaz.get(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 2 && start.roz) {
        const [a, b] = [...ukaz.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        ovl.vzd = start.vzd * start.roz / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]));
        if (start.mid) posunPohled(mid[0] - start.mid[0], mid[1] - start.mid[1]);
        start.mid = mid; prekresli(); return;
      }
      const dx = e.clientX - pred[0], dy = e.clientY - pred[1];
      if (start.posun) posunPohled(dx, dy);
      else { ovl.azimut -= dx * 0.008; ovl.elevace = Math.max(-1.55, Math.min(1.55, ovl.elevace + dy * 0.008)); }
      prekresli();
    });
    const konec = e => { ukaz.delete(e.pointerId); if (!ukaz.size) start = null; };
    platno.addEventListener('pointerup', konec); platno.addEventListener('pointercancel', konec);
    platno.addEventListener('contextmenu', e => e.preventDefault());
    platno.addEventListener('wheel', e => { e.preventDefault(); ovl.vzd *= Math.exp(e.deltaY * 0.0012); prekresli(); }, { passive: false });

    const png = () => { snimek(); return platno.toDataURL('image/png'); };
    return { nastav, pohled, prepni, png, prekresli, barvy, stav, ovl };
  }
  window.KLIKY_NAHLED = { vytvorNahled, VZHLEDY };
})();
