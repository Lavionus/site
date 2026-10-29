/* Knoflíky a hlavice – 3D náhled (three.js r128): tažení = otáčení, pravé tl. / Shift = posun, kolečko / dva prsty = zoom.
   nastav(dily, {tisk}) – díly {poz, idx, barva}; řez rovinou y = 0 ukáže kapsy a díry uvnitř. */
/* global THREE */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.localClippingEnabled = true;
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
    const rovinaRezu = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);   // ponechá y ≥ 0, řez míří ke kameře
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.32 });
    const matVnitrek = new THREE.MeshBasicMaterial({ color: 0xc0504d, side: THREE.BackSide, clippingPlanes: [rovinaRezu] });
    const stinTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const stin = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: stinTex, transparent: true, depthWrite: false }));
    stin.renderOrder = -1; scena.add(stin);
    const skupina = new THREE.Group(); scena.add(skupina);
    let objekty = [], mrizka = null, rozmer = 50, prvni = true;
    const tema = { mrizka: 0x888888, mrizka2: 0x555555 };
    const stav = { hrany: true, rez: false };

    function barvy(cara, cara2, hrana) {
      if (hrana) matHrany.color.set(hrana);
      tema.mrizka = new THREE.Color(cara).getHex(); tema.mrizka2 = new THREE.Color(cara2).getHex();
      if (mrizka) mrizka.material.color.setHex(tema.mrizka2);
      prekresli();
    }
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
    const ovl = { cil: new THREE.Vector3(), vzd: 200, azimut: -1.2, elevace: 0.6 };
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

    function uklid() {
      for (const o of objekty) { skupina.remove(o); o.geometry.dispose(); if (o.userData.vlastniMat) o.material.dispose(); }
      objekty = [];
      if (mrizka) { skupina.remove(mrizka); mrizka.geometry.dispose(); mrizka = null; }
    }
    function nastav(dily, volby = {}) {
      uklid();
      if (!dily || !dily.length) { stin.visible = false; prekresli(); return; }
      const box = new THREE.Box3();
      for (const d of dily) {
        const g = lomenaGeometrie(d.poz, d.idx, 30);
        const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(d.barva || '#4F86D9'), roughness: 0.45, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.5,
          clippingPlanes: stav.rez ? [rovinaRezu] : [] });
        const mesh = new THREE.Mesh(g, mat); mesh.userData.vlastniMat = true; mesh.userData.zakl = true;
        skupina.add(mesh); objekty.push(mesh);
        const vn = new THREE.Mesh(g, matVnitrek); vn.visible = stav.rez; vn.userData.vnitrek = true;
        skupina.add(vn); objekty.push(vn);
        const gi = new THREE.BufferGeometry();
        gi.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); gi.setIndex(new THREE.BufferAttribute(d.idx, 1));
        const mh = new THREE.LineBasicMaterial({ color: matHrany.color, transparent: true, opacity: matHrany.opacity, clippingPlanes: stav.rez ? [rovinaRezu] : [] });
        const hr = new THREE.LineSegments(new THREE.EdgesGeometry(gi, 30), mh); gi.dispose();
        hr.visible = stav.hrany; hr.userData.hrany = true; hr.userData.vlastniMat = true;
        skupina.add(hr); objekty.push(hr);
        g.computeBoundingBox(); box.union(g.boundingBox);
      }
      const vel = new THREE.Vector3(); box.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      const strana = Math.ceil(novy * 1.6 / 10) * 10;
      const pg = new THREE.GridHelper(strana, strana / 5, tema.mrizka, tema.mrizka2);
      pg.rotation.x = Math.PI / 2; pg.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.min.z - 0.02);
      pg.material.transparent = true; pg.material.opacity = 0.35; pg.visible = !!volby.tisk;
      mrizka = pg; skupina.add(pg);
      stin.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.min.z - 0.05);
      stin.scale.set(vel.x * 1.5 + 8, vel.y * 1.5 + 8, 1); stin.visible = !volby.tisk;
      const stred = new THREE.Vector3(); box.getCenter(stred);
      if (prvni || Math.abs(novy - rozmer) / rozmer > 0.3 || volby.novyPohled) { rozmer = novy; pohled(prvni ? 'iso' : 'ponech', box); prvni = false; }
      else ovl.cil.copy(stred);
      prekresli();
    }
    function pohled(jak, box) {
      if (!objekty.length) return;
      const b = box || new THREE.Box3().setFromObject(skupina), koule = new THREE.Sphere();
      b.getCenter(ovl.cil); b.getBoundingSphere(koule);
      const vf = kamera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * kamera.aspect);
      ovl.vzd = koule.radius / Math.sin(Math.min(vf, hf) / 2) * 0.95;
      if (jak === 'shora') { ovl.azimut = -Math.PI / 2; ovl.elevace = Math.PI / 2 - 1e-3; }
      else if (jak === 'zboku') { ovl.azimut = -Math.PI / 2; ovl.elevace = 0.02; }
      else if (jak === 'zespodu') { ovl.azimut = -Math.PI / 2; ovl.elevace = -Math.PI / 2 + 1e-3; }
      else if (jak !== 'ponech') { ovl.azimut = -1.2; ovl.elevace = 0.6; }
      prekresli();
    }
    function prepni(co, h) {
      stav[co] = h;
      for (const o of objekty) {
        if (o.userData.hrany) { o.visible = stav.hrany; o.material.clippingPlanes = stav.rez ? [rovinaRezu] : []; }
        if (o.userData.zakl) o.material.clippingPlanes = stav.rez ? [rovinaRezu] : [];
        if (o.userData.vnitrek) o.visible = stav.rez;
        o.material.needsUpdate = true;
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
      const posun = (dx, dy) => {
        const k = ovl.vzd / platno.clientHeight * 0.8, prave = new THREE.Vector3(), nahoru = new THREE.Vector3();
        kamera.matrixWorld.extractBasis(prave, nahoru, new THREE.Vector3());
        ovl.cil.addScaledVector(prave, -dx * k).addScaledVector(nahoru, dy * k);
      };
      if (ukaz.size === 2 && start.roz) {
        const [a, b] = [...ukaz.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        ovl.vzd = start.vzd * start.roz / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]));
        if (start.mid) posun(mid[0] - start.mid[0], mid[1] - start.mid[1]);
        start.mid = mid; prekresli(); return;
      }
      const dx = e.clientX - pred[0], dy = e.clientY - pred[1];
      if (start.posun) posun(dx, dy);
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
  window.KNOF_NAHLED = { vytvorNahled };
})();
