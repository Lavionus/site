/* Razítka – 3D náhled (three.js r128) dílů v tiskové poloze: tažení = otáčení, pravé tlačítko / Shift = posun,
   kolečko nebo dva prsty = přiblížení. Osa Z nahoru, podložka v z = 0. */
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
    const sv2 = new THREE.DirectionalLight(0xdfe8ff, 0.3); sv2.position.set(-1.8, 0.4, 0.8); kamera.add(sv2);
    const sv3 = new THREE.DirectionalLight(0xffffff, 0.35); sv3.position.set(0.3, 2, -1); kamera.add(sv3);
    scena.add(kamera);
    const BARVY = [0x3f7bd6, 0xd98a4f];
    const materialy = BARVY.map(c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, metalness: 0.05, clearcoat: 0.08, clearcoatRoughness: 0.6 }));
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.3 });
    const skupina = new THREE.Group(); scena.add(skupina);
    let objekty = [], mrizka = null, rozmer = 60, ma = false;
    const stav = { hrany: true };
    const tema = { mrizka: 0x888888, mrizka2: 0x555555 };
    function barvy(cara, cara2, hrana) {
      tema.mrizka = new THREE.Color(cara).getHex(); tema.mrizka2 = new THREE.Color(cara2).getHex();
      if (hrana) matHrany.color.set(hrana);
      if (mrizka) mrizka.material.color.setHex(tema.mrizka2);
      prekresli();
    }
    const ovl = { cil: new THREE.Vector3(), vzd: 200, azimut: -1.2, elevace: 0.8 };
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

    /** dily = [{poz, idx}] už v tiskové poloze. */
    function nastav(dily) {
      for (const o of objekty) { skupina.remove(o); o.geometry.dispose(); }
      objekty = [];
      if (mrizka) { skupina.remove(mrizka); mrizka.geometry.dispose(); mrizka = null; }
      if (!dily || !dily.length) { prekresli(); return; }
      const b = new THREE.Box3();
      dily.forEach((d, i) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); g.setIndex(new THREE.BufferAttribute(d.idx, 1));
        const ploche = g.toNonIndexed(); ploche.computeVertexNormals();
        const m = new THREE.Mesh(ploche, materialy[i % materialy.length]);
        skupina.add(m); objekty.push(m);
        const h = new THREE.LineSegments(new THREE.EdgesGeometry(g, 35), matHrany);
        h.visible = stav.hrany; skupina.add(h); objekty.push(h);
        g.dispose();
        ploche.computeBoundingBox(); b.union(ploche.boundingBox);
      });
      const vel = new THREE.Vector3(); b.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      const n = Math.ceil(novy * 1.6 / 10);
      mrizka = new THREE.GridHelper(n * 10, n, tema.mrizka, tema.mrizka2);
      mrizka.rotation.x = Math.PI / 2; mrizka.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, -0.01);
      mrizka.material.transparent = true; mrizka.material.opacity = 0.35;
      skupina.add(mrizka);
      const stred = new THREE.Vector3(); b.getCenter(stred);
      if (!ma || Math.abs(novy - rozmer) / rozmer > 0.3) { rozmer = novy; ovl.cil.copy(stred); ovl.vzd = novy * 2.6; if (!ma) { ovl.azimut = -1.2; ovl.elevace = 0.8; } ma = true; }
      else ovl.cil.copy(stred);
      prekresli();
    }
    function pohled(jak) {
      if (!objekty.length) return;
      ovl.vzd = rozmer * 2.6;
      if (jak === 'shora') { ovl.azimut = -Math.PI / 2; ovl.elevace = Math.PI / 2 - 1e-3; }
      else if (jak === 'zboku') { ovl.azimut = -Math.PI / 2; ovl.elevace = 0.02; }
      else if (jak === 'zespodu') { ovl.azimut = -Math.PI / 2; ovl.elevace = -Math.PI / 2 + 1e-3; }
      else { ovl.azimut = -1.2; ovl.elevace = 0.8; }
      prekresli();
    }
    function prepni(co, h) {
      stav[co] = h;
      objekty.forEach(o => { if (o.isLineSegments) o.visible = stav.hrany; });
      prekresli();
    }

    const ukaz = new Map(); let start = null;
    platno.addEventListener('pointerdown', e => {
      platno.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      start = { posun: e.button === 2 || e.shiftKey, vzd: ovl.vzd, roz: null };
      if (ukaz.size === 2) { const [a, b] = [...ukaz.values()]; start.roz = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    });
    const posunPohledu = (dx, dy) => {
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
    return { nastav, pohled, prepni, png, barvy, stav, ovl };
  }
  window.RAZ_NAHLED = { vytvorNahled };
})();
