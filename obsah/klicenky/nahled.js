/* Klíčenky – 3D náhled (three.js r128): díly v barvách filamentu, podložka, rovina výměny barvy.
   Tažení = otáčení, pravé tlačítko / Shift = posun, kolečko = zoom, dva prsty = zoom + posun. Osa Z nahoru. */
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
    scena.add(new THREE.HemisphereLight(0xf4f7ff, 0x3a4048, 0.65));
    const sv1 = new THREE.DirectionalLight(0xffffff, 0.8); sv1.position.set(1.2, -1.6, 2.2); kamera.add(sv1);
    const sv2 = new THREE.DirectionalLight(0xdfe8ff, 0.3); sv2.position.set(-1.8, 0.4, 0.8); kamera.add(sv2);
    scena.add(kamera);
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.3 });
    const matRovina = new THREE.MeshBasicMaterial({ color: 0xe08a2c, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const matRam = new THREE.LineBasicMaterial({ color: 0xe08a2c });
    const skupina = new THREE.Group(); scena.add(skupina);
    let objekty = [], mrizka = null, roviny = [], rozmer = 60, ma = false;
    const stav = { hrany: true, roviny: true };
    const tema = { cara: 0x888888 };

    const ovl = { cil: new THREE.Vector3(), vzd: 200, azimut: -1.35, elevace: 0.9 };
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
      tema.cara = new THREE.Color(cara).getHex();
      if (hrana) matHrany.color.set(hrana);
      if (mrizka) mrizka.material.color.setHex(tema.cara);
      prekresli();
    }
    function uklid() {
      for (const o of [...objekty, ...roviny, mrizka]) if (o) { skupina.remove(o); o.geometry.dispose(); if (![matHrany, matRovina, matRam].includes(o.material)) o.material.dispose(); }
      objekty = []; roviny = []; mrizka = null;
    }
    /** dily = [{poz, idx, barva}], vysky = z rovin výměny barvy / pauzy. */
    function nastav(dily, vysky) {
      uklid();
      if (!dily || !dily.length) { ma = false; prekresli(); return; }
      const box = new THREE.Box3();
      for (const d of dily) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); g.setIndex(new THREE.BufferAttribute(d.idx, 1));
        const ng = g.toNonIndexed(); ng.computeVertexNormals(); g.dispose();
        const mesh = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ color: d.barva, roughness: 0.55, metalness: 0.02 }));
        skupina.add(mesh); objekty.push(mesh);
        const gi = new THREE.BufferGeometry();
        gi.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); gi.setIndex(new THREE.BufferAttribute(d.idx, 1));
        const hr = new THREE.LineSegments(new THREE.EdgesGeometry(gi, 35), matHrany); gi.dispose();
        hr.visible = stav.hrany; skupina.add(hr); objekty.push(hr);
        ng.computeBoundingBox(); box.union(ng.boundingBox);
      }
      const vel = new THREE.Vector3(); box.getSize(vel);
      const stred = new THREE.Vector3(); box.getCenter(stred);
      for (const z of vysky || []) {
        // rám roviny výměny kolem modelu + slabá výplň těsně nad rozhraním (ne v něm – jinak bliká se stěnou)
        const sx = vel.x / 2 + 6, sy = vel.y / 2 + 6;
        const ram = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-sx, -sy], [sx, -sy], [sx, sy], [-sx, sy]].map(([x, y]) => new THREE.Vector3(x, y, 0))), matRam);
        const vypln = new THREE.Mesh(new THREE.PlaneGeometry(2 * sx, 2 * sy), matRovina);
        for (const o of [ram, vypln]) { o.position.set(stred.x, stred.y, z + 0.04); o.visible = stav.roviny; o.renderOrder = 3; skupina.add(o); roviny.push(o); }
      }
      const novy = Math.max(vel.x, vel.y, 10);
      const n = Math.ceil(novy * 1.4 / 10);
      mrizka = new THREE.GridHelper(n * 10, n, tema.cara, tema.cara);
      mrizka.rotation.x = Math.PI / 2; mrizka.position.set(stred.x, stred.y, -0.02);
      mrizka.material.transparent = true; mrizka.material.opacity = 0.35;
      skupina.add(mrizka);
      const prvni = !ma;
      ma = true;
      if (prvni || Math.abs(novy - rozmer) / rozmer > 0.3) { rozmer = novy; ovl.cil.copy(stred); pohled(prvni ? 'iso' : 'ponech'); }
      prekresli();
    }
    function pohled(jak) {
      if (!ma) return;
      const b = new THREE.Box3(); objekty.forEach(o => b.expandByObject(o));
      const koule = new THREE.Sphere(); b.getBoundingSphere(koule); b.getCenter(ovl.cil);
      const vf = kamera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * kamera.aspect);
      ovl.vzd = koule.radius / Math.sin(Math.min(vf, hf) / 2) * 0.95;
      if (jak === 'shora') { ovl.azimut = -Math.PI / 2; ovl.elevace = Math.PI / 2 - 1e-3; }
      else if (jak === 'zboku') { ovl.azimut = -Math.PI / 2; ovl.elevace = 0.02; }
      else if (jak !== 'ponech') { ovl.azimut = -1.35; ovl.elevace = 0.9; }
      prekresli();
    }
    function prepni(co, h) {
      stav[co] = h;
      objekty.forEach(o => { if (o.isLineSegments) o.visible = stav.hrany; });
      roviny.forEach(r => { r.visible = stav.roviny; });
      prekresli();
    }

    const ukaz = new Map(); let start = null;
    const posunPohledu = (dx, dy) => {
      const k = ovl.vzd / platno.clientHeight * 0.8, prave = new THREE.Vector3(), nahoru = new THREE.Vector3();
      kamera.matrixWorld.extractBasis(prave, nahoru, new THREE.Vector3());
      ovl.cil.addScaledVector(prave, -dx * k).addScaledVector(nahoru, dy * k);
    };
    platno.addEventListener('pointerdown', e => {
      platno.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      start = { posun: e.button === 2 || e.shiftKey, vzd: ovl.vzd, roz: null };
      if (ukaz.size === 2) { const [a, b] = [...ukaz.values()]; start.roz = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    });
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
    return { nastav, pohled, prepni, png, barvy, prekresli, stav };
  }
  window.KLIC_NAHLED = { vytvorNahled };
})();
