/* Herní kostky a žetony – 3D náhled (three.js r128): díly na podložce v tiskové poloze, rytí zvýrazněné barvou.
   Tažení = otáčení, pravé tlačítko / Shift = posun, kolečko / dva prsty = přiblížení. */
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
    const sv3 = new THREE.DirectionalLight(0xffffff, 0.3); sv3.position.set(0.3, 2, -1); kamera.add(sv3);
    scena.add(kamera);
    const skupina = new THREE.Group(); scena.add(skupina);
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.25 });
    let mrizka = null, model = [], rozmer = 50, cara = 0x888888, rucne = false;   // rucne = uživatel přiblížil / posunul
    const stav = { hrany: true, barvaRyti: true };
    const ovl = { cil: new THREE.Vector3(), vzd: 200, azimut: -1.2, elevace: 0.75 };

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
      renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix();
      if (!rucne) pohled('ponech');
      snimek();   // hned: změna velikosti plátno vymaže
    }
    new ResizeObserver(velikost).observe(kontejner);
    function barvy(cara2) { cara = new THREE.Color(cara2).getHex(); if (mrizka) mrizka.material.color.setHex(cara); prekresli(); }

    /** Plochá geometrie (bez sdílených vrcholů) s barvou po trojúhelnících: tělo = barva dílu, rytí tmavší. */
    function geometrie(d) {
      const P = d.poz, I = d.idx, nT = I.length / 3;
      const pos = new Float32Array(nT * 9), col = new Float32Array(nT * 9);
      const zak = new THREE.Color(d.barva || '#cccccc'), tm = zak.clone();
      const svetla = zak.r + zak.g + zak.b > 1.6;
      tm.lerp(new THREE.Color(svetla ? 0x1d3f7a : 0xffffff), svetla ? 0.85 : 0.7);
      for (let t = 0; t < nT; t++) {
        const c = stav.barvaRyti && d.znacky && d.znacky[t] ? tm : zak;
        for (let k = 0; k < 3; k++) {
          const v = I[3 * t + k], o = 9 * t + 3 * k;
          pos[o] = P[3 * v]; pos[o + 1] = P[3 * v + 1]; pos[o + 2] = P[3 * v + 2];
          col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      return g;
    }
    const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.02, clearcoat: 0.3, clearcoatRoughness: 0.5, flatShading: true });
    let posledni = null;
    function nastav(dily) {
      posledni = dily;
      for (const o of model) { skupina.remove(o); o.geometry.dispose(); }
      model = [];
      if (mrizka) { skupina.remove(mrizka); mrizka.geometry.dispose(); mrizka = null; }
      if (!dily || !dily.length) { prekresli(); return; }
      // stejné sítě (kopie) sdílejí geometrii
      const pamet = new Map();
      for (const d of dily) {
        let g = pamet.get(d.idx) && pamet.get(d.idx).get(d.barva);
        if (!g) {
          g = geometrie({ poz: d.zdroj || d.poz, idx: d.idx, znacky: d.znacky, barva: d.barva });
          if (!pamet.has(d.idx)) pamet.set(d.idx, new Map());
          pamet.get(d.idx).set(d.barva, g);
        }
        const m = new THREE.Mesh(g, mat);
        const b0 = d.posunZdroje || [0, 0, 0];
        m.position.set(b0[0], b0[1], b0[2]);
        skupina.add(m); model.push(m);
        if (stav.hrany) {
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), matHrany);
          e.position.copy(m.position); skupina.add(e); model.push(e);
        }
      }
      const b = new THREE.Box3().setFromObject(skupina), vel = new THREE.Vector3(); b.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      const krok = novy > 150 ? 10 : 5;
      const n = Math.ceil(novy * 1.4 / krok);
      mrizka = new THREE.GridHelper(n * krok, n, cara, cara);
      mrizka.rotation.x = Math.PI / 2; mrizka.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, -0.02);
      mrizka.material.transparent = true; mrizka.material.opacity = 0.35;
      skupina.add(mrizka);
      if (!nastav.uz || Math.abs(novy - rozmer) / rozmer > 0.3 || !rucne) { rozmer = novy; pohled(nastav.uz ? 'ponech' : 'iso'); nastav.uz = true; }
      prekresli();
    }
    function pohled(jak) {
      if (!model.length) return;
      const b = new THREE.Box3(); model.forEach(o => b.expandByObject(o));
      const koule = new THREE.Sphere(); b.getBoundingSphere(koule); b.getCenter(ovl.cil);
      const vf = kamera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * kamera.aspect);
      ovl.vzd = koule.radius / Math.sin(Math.min(vf, hf) / 2) * 1.02;
      if (jak !== 'ponech') rucne = false;
      if (jak === 'shora') { ovl.azimut = -Math.PI / 2; ovl.elevace = Math.PI / 2 - 1e-3; }
      else if (jak === 'zboku') { ovl.azimut = -Math.PI / 2; ovl.elevace = 0.02; }
      else if (jak !== 'ponech') { ovl.azimut = -1.2; ovl.elevace = 0.75; }
      prekresli();
    }
    function prepni(co, h) { stav[co] = h; nastav(posledni); }

    const ukaz = new Map(); let start = null;
    platno.addEventListener('pointerdown', e => {
      platno.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      start = { posun: e.button === 2 || e.shiftKey, vzd: ovl.vzd, roz: null };
      if (ukaz.size === 2) { const [a, b] = [...ukaz.values()]; start.roz = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    });
    const posunCil = (dx, dy) => {
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
        if (start.mid) posunCil(mid[0] - start.mid[0], mid[1] - start.mid[1]);
        start.mid = mid; rucne = true; prekresli(); return;
      }
      const dx = e.clientX - pred[0], dy = e.clientY - pred[1];
      if (start.posun) { posunCil(dx, dy); rucne = true; }
      else { ovl.azimut -= dx * 0.008; ovl.elevace = Math.max(-1.55, Math.min(1.55, ovl.elevace + dy * 0.008)); }
      prekresli();
    });
    const konec = e => { ukaz.delete(e.pointerId); if (!ukaz.size) start = null; };
    platno.addEventListener('pointerup', konec); platno.addEventListener('pointercancel', konec);
    platno.addEventListener('contextmenu', e => e.preventDefault());
    platno.addEventListener('wheel', e => { e.preventDefault(); rucne = true; ovl.vzd *= Math.exp(e.deltaY * 0.0012); prekresli(); }, { passive: false });
    const png = () => { snimek(); return platno.toDataURL('image/png'); };
    return { nastav, pohled, prepni, png, prekresli, barvy, stav, ladeni: () => ({ ovl, deti: skupina.children.length, aspect: kamera.aspect, w: platno.width, h: platno.height }) };
  }
  window.KOSTKY3D_NAHLED = { vytvorNahled };
})();
