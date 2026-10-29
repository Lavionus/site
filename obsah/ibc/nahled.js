/* IBC napojení – 3D náhled (three.js r128), převzato ze spojky/nahled.js: otáčení tažením / jedním prstem,
   posun pravým tlačítkem / Shift / dvěma prsty, kolečko = zoom.
   Montážní poloha = díl s průhledným hrdlem ventilu / hadicí / stěnou; tisková = na podložce, převisy barevně. */
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
    platno.setAttribute('aria-label', '3D náhled dílu – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');

    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
    kamera.up.set(0, 0, 1);
    scena.add(new THREE.HemisphereLight(0xf4f7ff, 0x3a4048, 0.62));
    const sv1 = new THREE.DirectionalLight(0xffffff, 0.8); sv1.position.set(1.2, -1.6, 2.2); kamera.add(sv1);
    const sv2 = new THREE.DirectionalLight(0xdfe8ff, 0.28); sv2.position.set(-1.8, 0.4, 0.8); kamera.add(sv2);
    const sv3 = new THREE.DirectionalLight(0xffffff, 0.35); sv3.position.set(0.3, 2, -1); kamera.add(sv3);
    scena.add(kamera);
    const matDil = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.32 });
    const matDuch = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    const skupina = new THREE.Group(); scena.add(skupina);
    let dil = null, hrany = null, mrizka = null, duchove = [], model = null, rozmer = 100, prvni = true;
    const tema = { mrizka: 0x888888, mrizka2: 0x555555 };
    const stav = { duchove: true, tisk: false, hrany: true, previsy: true };
    const BARVA = [[0.25, 0.48, 0.84], [0.85, 0.66, 0.2], [0.86, 0.22, 0.2], [0.25, 0.48, 0.84]];

    function barvy(cara, cara2, hrana) {
      if (hrana) matHrany.color.set(hrana);
      tema.mrizka = new THREE.Color(cara).getHex(); tema.mrizka2 = new THREE.Color(cara2).getHex();
      if (mrizka) mrizka.material.color.setHex(tema.mrizka2);
      prekresli();
    }
    /** Normály s lomem (ostré hrany zůstanou ostré) a barva po trojúhelnících. */
    function geometrie(poz, idx, tridy) {
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
        const bv = BARVA[tridy && stav.tisk && stav.previsy ? tridy[t] : 0];
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
    /** Duch = průhledná trubka podél osy Z (hrdlo ventilu, hadice, trubka, stěna s otvorem). */
    function duch(d) {
      const prof = [new THREE.Vector2(d.ri || 0, d.z0), new THREE.Vector2(d.r, d.z0), new THREE.Vector2(d.r, d.z1), new THREE.Vector2(d.ri || 0, d.z1)];
      if (d.ri) prof.push(new THREE.Vector2(d.ri, d.z0));
      const g = new THREE.LatheGeometry(prof, 64);
      g.rotateX(Math.PI / 2);       // osa lathe = Y → Z
      const m = new THREE.Mesh(g, matDuch);
      m.position.set(d.x || 0, d.y || 0, 0);
      m.renderOrder = 2;
      return m;
    }

    const ovl = { cil: new THREE.Vector3(), vzd: 300, azimut: -1.2, elevace: 0.6 };
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
      for (const o of [dil, hrany, mrizka, ...duchove]) if (o) { skupina.remove(o); o.geometry.dispose(); }
      dil = hrany = mrizka = null; duchove = [];
    }
    /** model = {poz, idx, duchove, tisk: {poz, tridy}} nebo null */
    function nastav(m) {
      const zmenaTypu = !model || !m || (model.klic !== m.klic);
      model = m;
      sestav();
      if (m && (prvni || zmenaTypu)) { pohled('iso'); prvni = false; }
    }
    function sestav() {
      uklid();
      const m = model;
      if (!m) { prekresli(); return; }
      const poz = stav.tisk ? m.tisk.poz : m.poz;
      dil = new THREE.Mesh(geometrie(poz, m.idx, m.tisk.tridy), matDil);
      skupina.add(dil);
      const gi = new THREE.BufferGeometry();
      gi.setAttribute('position', new THREE.BufferAttribute(poz, 3)); gi.setIndex(new THREE.BufferAttribute(m.idx, 1));
      hrany = new THREE.LineSegments(new THREE.EdgesGeometry(gi, 32), matHrany); gi.dispose();
      hrany.visible = stav.hrany; skupina.add(hrany);
      if (!stav.tisk) for (const d of m.duchove) { const o = duch(d); o.visible = stav.duchove; skupina.add(o); duchove.push(o); }
      dil.geometry.computeBoundingBox();
      const b = dil.geometry.boundingBox, vel = new THREE.Vector3(); b.getSize(vel);
      rozmer = Math.max(vel.x, vel.y, vel.z, 10);
      if (stav.tisk) {
        const n = Math.ceil(rozmer * 1.8 / 10);
        mrizka = new THREE.GridHelper(n * 10, n, tema.mrizka, tema.mrizka2);
        mrizka.rotation.x = Math.PI / 2; mrizka.position.z = -0.02;
        mrizka.material.transparent = true; mrizka.material.opacity = 0.4;
        skupina.add(mrizka);
      }
      prekresli();
    }
    function pohled(jak) {
      if (!dil) return;
      const b = new THREE.Box3().setFromObject(dil), koule = new THREE.Sphere();
      b.getCenter(ovl.cil); b.getBoundingSphere(koule);
      const vf = kamera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * kamera.aspect);
      ovl.vzd = koule.radius / Math.sin(Math.min(vf, hf) / 2) * 1.15;
      if (jak === 'shora') { ovl.azimut = -Math.PI / 2; ovl.elevace = Math.PI / 2 - 1e-3; }
      else if (jak === 'zepredu') { ovl.azimut = -Math.PI / 2; ovl.elevace = 0.02; }
      else if (jak === 'zboku') { ovl.azimut = 0; ovl.elevace = 0.02; }
      else { ovl.azimut = -1.2; ovl.elevace = 0.6; }
      prekresli();
    }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'tisk' || co === 'previsy') { sestav(); if (co === 'tisk') pohled('iso'); return; }
      duchove.forEach(o => { o.visible = stav.duchove; });
      if (hrany) hrany.visible = stav.hrany;
      prekresli();
    }

    // myš a dotyk
    const ukaz = new Map(); let start = null;
    platno.addEventListener('pointerdown', e => {
      platno.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
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
  window.IBC_NAHLED = { vytvorNahled };
})();
