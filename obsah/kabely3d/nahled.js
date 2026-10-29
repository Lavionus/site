/* Kabelové průchodky – 3D náhled (three.js r128): tažení = otáčení, pravé tlačítko / Shift = posun,
   kolečko nebo dva prsty = zoom. Osa Z nahoru. Díly jsou plné, deska a kabely průhledné (jen pro představu). */
/* global THREE */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    kontejner.appendChild(renderer.domElement);
    const platno = renderer.domElement;
    Object.assign(platno.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
    platno.tabIndex = 0;
    platno.setAttribute('aria-label', '3D náhled – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');

    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
    kamera.up.set(0, 0, 1);
    scena.add(new THREE.HemisphereLight(0xf4f7ff, 0x3a4048, 0.62));
    const sv1 = new THREE.DirectionalLight(0xffffff, 0.8); sv1.position.set(1.2, -1.6, 2.2); kamera.add(sv1);
    const sv2 = new THREE.DirectionalLight(0xdfe8ff, 0.28); sv2.position.set(-1.8, 0.4, 0.8); kamera.add(sv2);
    const sv3 = new THREE.DirectionalLight(0xffffff, 0.35); sv3.position.set(0.3, 2, -1); kamera.add(sv3);
    scena.add(kamera);
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.32 });
    const matDeska = new THREE.MeshStandardMaterial({ color: 0xc8a477, roughness: 0.8, transparent: true, opacity: 0.28, depthWrite: false });
    const matKabel = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.6, transparent: true, opacity: 0.45, depthWrite: false });
    const skupina = new THREE.Group(); scena.add(skupina);
    const stav = { pomocne: true, hrany: true };
    let objekty = [], mrizka = null, rozmer = 100, prvni = true;
    const tema = { mrizka: 0x888888 };

    /** Normály s lomem: plochy svírající víc než „uhel“ se nevyhlazují. */
    function lomenaGeometrie(poz, idx, uhel) {
      const nT = idx.length / 3, fn = new Float32Array(3 * nT), nV = poz.length / 3, kos = Math.cos(uhel * Math.PI / 180);
      const sous = Array.from({ length: nV }, () => []);
      for (let t = 0; t < nT; t++) {
        const a = idx[3 * t], b = idx[3 * t + 1], c = idx[3 * t + 2];
        const ux = poz[3 * b] - poz[3 * a], uy = poz[3 * b + 1] - poz[3 * a + 1], uz = poz[3 * b + 2] - poz[3 * a + 2];
        const vx = poz[3 * c] - poz[3 * a], vy = poz[3 * c + 1] - poz[3 * a + 1], vz = poz[3 * c + 2] - poz[3 * a + 2];
        fn[3 * t] = uy * vz - uz * vy; fn[3 * t + 1] = uz * vx - ux * vz; fn[3 * t + 2] = ux * vy - uy * vx;
        sous[a].push(t); sous[b].push(t); sous[c].push(t);
      }
      const delka = t => Math.hypot(fn[3 * t], fn[3 * t + 1], fn[3 * t + 2]) || 1;
      const P = new Float32Array(9 * nT), N = new Float32Array(9 * nT);
      for (let t = 0; t < nT; t++) {
        const lt = delka(t);
        for (let k = 0; k < 3; k++) {
          const v = idx[3 * t + k], o = 9 * t + 3 * k;
          let nx = 0, ny = 0, nz = 0;
          for (const f of sous[v]) {
            if ((fn[3 * f] * fn[3 * t] + fn[3 * f + 1] * fn[3 * t + 1] + fn[3 * f + 2] * fn[3 * t + 2]) / (delka(f) * lt) >= kos) { nx += fn[3 * f]; ny += fn[3 * f + 1]; nz += fn[3 * f + 2]; }
          }
          const l = Math.hypot(nx, ny, nz) || 1;
          N[o] = nx / l; N[o + 1] = ny / l; N[o + 2] = nz / l;
          P[o] = poz[3 * v]; P[o + 1] = poz[3 * v + 1]; P[o + 2] = poz[3 * v + 2];
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      return g;
    }
    const ovl = { cil: new THREE.Vector3(), vzd: 300, azimut: -1.2, elevace: 0.75 };
    let ceka = false;
    function prekresli() { if (ceka) return; ceka = true; requestAnimationFrame(() => { ceka = false; snimek(); }); }
    function snimek() {
      const ce = Math.cos(ovl.elevace);
      kamera.position.set(ovl.cil.x + ovl.vzd * ce * Math.cos(ovl.azimut), ovl.cil.y + ovl.vzd * ce * Math.sin(ovl.azimut), ovl.cil.z + ovl.vzd * Math.sin(ovl.elevace));
      kamera.lookAt(ovl.cil);
      kamera.near = Math.max(0.1, ovl.vzd / 200); kamera.far = ovl.vzd * 20 + rozmer * 10; kamera.updateProjectionMatrix();
      renderer.render(scena, kamera);
    }
    function velikost() {
      const w = kontejner.clientWidth || 1, h = kontejner.clientHeight || 1;
      renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); prekresli();
    }
    new ResizeObserver(velikost).observe(kontejner);

    function barvy(cara, hrana) {
      if (hrana) matHrany.color.set(hrana);
      tema.mrizka = new THREE.Color(cara).getHex();
      if (mrizka) mrizka.material.color.setHex(tema.mrizka);
      prekresli();
    }
    function vycisti() {
      for (const o of objekty) { skupina.remove(o); o.geometry.dispose(); if (o.userData.vlastniMat) o.material.dispose(); }
      objekty = [];
      if (mrizka) { skupina.remove(mrizka); mrizka.geometry.dispose(); mrizka = null; }
    }
    /** m = {dily: [{poz, idx, barva}], pomocne: [{druh, poz, idx}], tisk: bool} */
    function nastav(m) {
      vycisti();
      if (!m) { prekresli(); return; }
      const box = new THREE.Box3();
      for (const d of m.dily) {
        const g = lomenaGeometrie(d.poz, d.idx, 32);
        const mat = new THREE.MeshPhysicalMaterial({ color: d.barva || 0x3f7bd6, roughness: 0.42, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(g, mat); mesh.userData.vlastniMat = true;
        skupina.add(mesh); objekty.push(mesh);
        g.computeBoundingBox(); box.union(g.boundingBox);
        const gi = new THREE.BufferGeometry();
        gi.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); gi.setIndex(new THREE.BufferAttribute(d.idx, 1));
        const hr = new THREE.LineSegments(new THREE.EdgesGeometry(gi, 32), matHrany); gi.dispose();
        hr.userData.hrany = true; hr.visible = stav.hrany; skupina.add(hr); objekty.push(hr);
      }
      for (const x of m.pomocne || []) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(x.poz, 3)); g.setIndex(new THREE.BufferAttribute(x.idx, 1)); g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, x.druh === 'kabel' ? matKabel : matDeska);
        mesh.renderOrder = 2; mesh.userData.pomocny = true; mesh.visible = stav.pomocne;
        skupina.add(mesh); objekty.push(mesh);
      }
      const vel = new THREE.Vector3(); box.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      if (m.tisk) {
        const n = Math.ceil(Math.max(vel.x, vel.y) * 1.4 / 10 + 1);
        mrizka = new THREE.GridHelper(n * 10, n, tema.mrizka, tema.mrizka);
        mrizka.rotation.x = Math.PI / 2; mrizka.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, -0.02);
        mrizka.material.transparent = true; mrizka.material.opacity = 0.35;
        skupina.add(mrizka);
      }
      const stred = new THREE.Vector3(); box.getCenter(stred);
      if (prvni || Math.abs(novy - rozmer) / rozmer > 0.3 || m.tisk !== nastav.tisk || m.typ !== nastav.typ) {
        rozmer = novy; nastav.box = box; pohled(prvni ? 'iso' : 'ponech'); prvni = false;
      }
      nastav.box = box; nastav.tisk = m.tisk; nastav.typ = m.typ;
      ovl.cil.copy(stred);
      prekresli();
    }
    function pohled(jak) {
      const box = nastav.box; if (!box) return;
      const koule = new THREE.Sphere(); box.getBoundingSphere(koule); box.getCenter(ovl.cil);
      const vf = kamera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * kamera.aspect);
      ovl.vzd = Math.max(20, koule.radius) / Math.sin(Math.min(vf, hf) / 2) * 1.05;
      if (jak === 'shora') { ovl.azimut = -Math.PI / 2; ovl.elevace = Math.PI / 2 - 1e-3; }
      else if (jak === 'zepredu') { ovl.azimut = -Math.PI / 2; ovl.elevace = 0.02; }
      else if (jak === 'zboku') { ovl.azimut = 0; ovl.elevace = 0.02; }
      else if (jak !== 'ponech') { ovl.azimut = -1.2; ovl.elevace = 0.6; }
      prekresli();
    }
    function prepni(co, h) {
      stav[co] = h;
      for (const o of objekty) {
        if (o.userData.pomocny) o.visible = stav.pomocne;
        if (o.userData.hrany) o.visible = stav.hrany;
      }
      prekresli();
    }

    const ukaz = new Map(); let start = null;
    platno.addEventListener('pointerdown', e => {
      platno.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      start = { posun: e.button === 2 || e.shiftKey, vzd: ovl.vzd, roz: null };
      if (ukaz.size === 2) { const [a, b] = [...ukaz.values()]; start.roz = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    });
    platno.addEventListener('pointermove', e => {
      if (!ukaz.has(e.pointerId) || !start) return;
      const pred = ukaz.get(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      const posunPohledu = (dx, dy) => {
        const k = ovl.vzd / platno.clientHeight * 0.8, prave = new THREE.Vector3(), nahoru = new THREE.Vector3();
        kamera.matrixWorld.extractBasis(prave, nahoru, new THREE.Vector3());
        ovl.cil.addScaledVector(prave, -dx * k).addScaledVector(nahoru, dy * k);
      };
      if (ukaz.size === 2 && start.roz) {
        const [a, b] = [...ukaz.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        ovl.vzd = start.vzd * start.roz / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]));
        if (start.mid) posunPohledu(mid[0] - start.mid[0], mid[1] - start.mid[1]);
        start.mid = mid; prekresli(); return;
      }
      const dx = e.clientX - pred[0], dy = e.clientY - pred[1];
      if (start.posun) posunPohledu(dx, dy);
      else { ovl.azimut -= dx * 0.008; ovl.elevace = Math.max(-1.55, Math.min(1.55, ovl.elevace + dy * 0.008)); }
      prekresli();
    });
    const konec = e => { ukaz.delete(e.pointerId); if (!ukaz.size) start = null; };
    platno.addEventListener('pointerup', konec); platno.addEventListener('pointercancel', konec);
    platno.addEventListener('contextmenu', e => e.preventDefault());
    platno.addEventListener('wheel', e => { e.preventDefault(); ovl.vzd *= Math.exp(e.deltaY * 0.0012); prekresli(); }, { passive: false });

    const png = () => { snimek(); return platno.toDataURL('image/png'); };
    return { nastav, pohled, prepni, png, prekresli, barvy, stav };
  }
  window.KAB_NAHLED = { vytvorNahled };
})();
