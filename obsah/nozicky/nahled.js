/* Nožičky – 3D náhled (three.js r128): díly v tiskové poloze na podložce, průhledná noha / trubka,
   řez rovinou XZ, obrysové hrany. Tažení = otáčení, pravé tl. / Shift = posun, kolečko a dva prsty = zoom. */
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
    platno.setAttribute('aria-label', '3D náhled dílu – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');

    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
    kamera.up.set(0, 0, 1);
    scena.add(new THREE.HemisphereLight(0xf4f7ff, 0x3a4048, 0.62));
    const sv1 = new THREE.DirectionalLight(0xffffff, 0.8); sv1.position.set(1.2, -1.6, 2.2); kamera.add(sv1);
    const sv2 = new THREE.DirectionalLight(0xdfe8ff, 0.28); sv2.position.set(-1.8, 0.4, 0.8); kamera.add(sv2);
    const sv3 = new THREE.DirectionalLight(0xffffff, 0.35); sv3.position.set(0.3, 2, -1); kamera.add(sv3);
    scena.add(kamera);
    const rovinaRezu = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.32 });
    const matDuch = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.4, roughness: 0.45, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    const skupina = new THREE.Group(); scena.add(skupina);
    const stav = { sada: true, duch: true, rez: false, hrany: true };
    const tema = { mrizka: 0x888888, mrizka2: 0x555555 };
    let objekty = [], mrizka = null, data = null, rozmer = 100, prvni = true;

    function barvy(cara, cara2, hrana) {
      if (hrana) matHrany.color.set(hrana);
      tema.mrizka = new THREE.Color(cara).getHex(); tema.mrizka2 = new THREE.Color(cara2).getHex();
      if (data) sestav(); else prekresli();
    }

    /** Normály s lomem: plochy svírající víc než `uhel` se nevyhlazují. */
    function geometrie(poz, idx, uhel) {
      const g0 = new THREE.BufferGeometry();
      g0.setAttribute('position', new THREE.BufferAttribute(poz, 3)); g0.setIndex(new THREE.BufferAttribute(idx, 1));
      const g = g0.toNonIndexed(); g0.dispose();
      // vyhlazení jen v rámci téhož „směru“ (válcové plochy hladké, hrany ostré)
      const P = g.getAttribute('position').array, nT = P.length / 9, fn = new Float32Array(nT * 3);
      const mapa = new Map(), klic = i => `${Math.round(P[i] * 1e4)},${Math.round(P[i + 1] * 1e4)},${Math.round(P[i + 2] * 1e4)}`;
      for (let t = 0; t < nT; t++) {
        const o = 9 * t, ux = P[o + 3] - P[o], uy = P[o + 4] - P[o + 1], uz = P[o + 5] - P[o + 2], vx = P[o + 6] - P[o], vy = P[o + 7] - P[o + 1], vz = P[o + 8] - P[o + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
        fn[3 * t] = nx / l; fn[3 * t + 1] = ny / l; fn[3 * t + 2] = nz / l;
        for (let k = 0; k < 3; k++) { const kk = klic(o + 3 * k); if (!mapa.has(kk)) mapa.set(kk, []); mapa.get(kk).push(t); }
      }
      const kos = Math.cos(uhel * Math.PI / 180), N = new Float32Array(P.length);
      for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) {
        const o = 9 * t + 3 * k; let nx = 0, ny = 0, nz = 0;
        for (const f of mapa.get(klic(o))) {
          if (fn[3 * f] * fn[3 * t] + fn[3 * f + 1] * fn[3 * t + 1] + fn[3 * f + 2] * fn[3 * t + 2] >= kos) { nx += fn[3 * f]; ny += fn[3 * f + 1]; nz += fn[3 * f + 2]; }
        }
        const l = Math.hypot(nx, ny, nz) || 1; N[o] = nx / l; N[o + 1] = ny / l; N[o + 2] = nz / l;
      }
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      return g;
    }

    function uklid() {
      for (const o of objekty) { skupina.remove(o); o.geometry.dispose(); if (o.material !== matHrany && o.material !== matDuch) o.material.dispose(); }
      objekty = [];
      if (mrizka) { skupina.remove(mrizka); mrizka.geometry.dispose(); mrizka = null; }
    }
    /** model = { dily: rozmístěná sada, kus: díly jednoho kusu, duchy: noha/trubka k jednomu kusu } */
    function nastav(model) { data = model; sestav(); }
    function sestav() {
      uklid();
      if (!data) { prekresli(); return; }
      const rez = stav.rez ? [rovinaRezu] : [];
      const dily = stav.sada ? data.dily : data.kus;
      for (const d of dily) {
        const g = geometrie(d.poz, d.idx, 35);
        const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: d.barva || 0x3f7bd6, roughness: d.druh === 'vlozka' ? 0.8 : 0.42, metalness: 0.03,
          clearcoat: d.druh === 'vlozka' ? 0 : 0.3, side: THREE.DoubleSide, clippingPlanes: rez }));
        skupina.add(m); objekty.push(m);
        const gi = new THREE.BufferGeometry();
        gi.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); gi.setIndex(new THREE.BufferAttribute(d.idx, 1));
        const h = new THREE.LineSegments(new THREE.EdgesGeometry(gi, 35), stav.rez ? new THREE.LineBasicMaterial({ color: matHrany.color, transparent: true, opacity: 0.32, clippingPlanes: rez }) : matHrany);
        gi.dispose(); h.visible = stav.hrany; skupina.add(h); objekty.push(h);
      }
      if (!stav.sada && stav.duch) for (const d of data.duchy || []) {
        const m = new THREE.Mesh(geometrie(d.poz, d.idx, 35), matDuch); m.renderOrder = 2;
        skupina.add(m); objekty.push(m);
      }
      const b = new THREE.Box3(); objekty.forEach(o => b.expandByObject(o));
      const vel = new THREE.Vector3(); b.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      const krok = novy > 150 ? 20 : novy > 40 ? 10 : 5, sir = Math.ceil(Math.max(vel.x, vel.y) * 1.4 / krok + 2) * krok;
      mrizka = new THREE.GridHelper(sir, sir / krok, tema.mrizka, tema.mrizka2);
      mrizka.rotation.x = Math.PI / 2; mrizka.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, -0.02);
      mrizka.material.transparent = true; mrizka.material.opacity = 0.4;
      skupina.add(mrizka);
      if (prvni || Math.abs(novy - rozmer) / rozmer > 0.3) { rozmer = novy; pohled(prvni ? 'iso' : 'ponech'); prvni = false; }
      prekresli();
    }

    const ovl = { cil: new THREE.Vector3(), vzd: 300, azimut: -1.1, elevace: 0.6 };
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
      renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); snimek();   // hned – změna velikosti plátno smaže
    }
    new ResizeObserver(velikost).observe(kontejner);

    function pohled(jak) {
      if (!objekty.length) return;
      const b = new THREE.Box3(); objekty.forEach(o => b.expandByObject(o));
      const koule = new THREE.Sphere(); b.getBoundingSphere(koule); ovl.cil.copy(koule.center);
      const vf = kamera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * kamera.aspect);
      ovl.vzd = koule.radius / Math.sin(Math.min(vf, hf) / 2) * 1.05;
      if (jak === 'shora') { ovl.azimut = -Math.PI / 2; ovl.elevace = Math.PI / 2 - 1e-3; }
      else if (jak === 'zboku') { ovl.azimut = -Math.PI / 2; ovl.elevace = 0.02; }
      else if (jak === 'zespodu') { ovl.azimut = -Math.PI / 2; ovl.elevace = -Math.PI / 2 + 1e-3; }
      else if (jak !== 'ponech') { ovl.azimut = -1.1; ovl.elevace = 0.6; }
      prekresli();
    }
    function prepni(co, h) { stav[co] = h; if (co === 'sada') prvni = true; sestav(); }

    // myš a dotyk
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
    return { nastav, pohled, prepni, png, barvy, stav, ovl, get pocet() { return objekty.length; } };
  }
  window.NOZ_NAHLED = { vytvorNahled };
})();
