/* Krabice z kartonu (FEFCO) – 3D náhled skládání (three.js 0.160, globální THREE). Kreslí se jen při změně. */
(function (koren) {
  'use strict';
  const K = koren.KrabiceFefco;

  function vytvor(kontejner) {
    const THREE = koren.THREE;
    if (!THREE) { kontejner.textContent = '3D náhled není k dispozici (nenačetla se knihovna three.js).'; return null; }
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); }
    catch (e) { kontejner.textContent = '3D náhled není k dispozici (WebGL).'; return null; }
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    kontejner.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scene = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 1, 100000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a45, 1.1));
    const sv = new THREE.DirectionalLight(0xffffff, 1.4); sv.position.set(0.6, 1, 0.8); scene.add(sv);
    const sv2 = new THREE.DirectionalLight(0xffffff, 0.35); sv2.position.set(-0.8, -0.3, -0.6); scene.add(sv2);
    const koren3 = new THREE.Group(); scene.add(koren3);
    const matVnitr = new THREE.MeshStandardMaterial({ color: 0xe9d3a8, roughness: 0.9, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const matVnej = new THREE.MeshStandardMaterial({ color: 0xbf935c, roughness: 0.85, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const matHrana = new THREE.LineBasicMaterial({ color: 0x5a4027 });
    let model = null, s = 0, cil = new THREE.Vector3(), orb = { az: -0.65, el: 0.5, dist: 1000 }, polomer = 500;
    const dily = [];

    function nastav(v) {
      model = v;
      for (const d of dily) { koren3.remove(d.skupina); d.skupina.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
      dily.length = 0;
      if (!v) { kresli(); return; }
      const dt = Math.max(0.4, Math.min(v.P.t, 8));
      for (const dz of v.dily) {
        const d = dz.dil, skup = new THREE.Group(), panely = [];
        if (d.lezato) skup.rotation.x = -Math.PI / 2;
        for (const p of d.panely) {
          const tvar = new THREE.Shape(p.poly.map(q => new THREE.Vector2(q[0], q[1])));
          const geo = new THREE.ShapeGeometry(tvar);
          const g = new THREE.Group(); g.matrixAutoUpdate = false;
          g.add(new THREE.Mesh(geo, matVnitr)); g.add(new THREE.Mesh(geo, matVnej));
          const lg = new THREE.BufferGeometry().setFromPoints(p.poly.map(q => new THREE.Vector3(q[0], q[1], 0)));
          g.add(new THREE.LineLoop(lg, matHrana));
          skup.add(g); panely.push({ p, g });
        }
        koren3.add(skup); dily.push({ d, skupina: skup, panely, dt });
      }
      // pohled nastavit podle rozloženého přířezu (největší rozsah), pak vrátit stav složení
      const sPuv = s; s = 0; aktualizuj(true); s = sPuv; aktualizuj(false);
    }
    const T = new THREE.Matrix4(), M = new THREE.Matrix4();
    function aktualizuj(prepocitatPohled) {
      for (const d of dily) {
        const mat = K.slozDil(d.d, s);
        for (const { p, g } of d.panely) {
          M.fromArray(mat.get(p.id));
          T.makeTranslation(0, 0, -p.vrstva * d.dt);
          g.matrix.multiplyMatrices(M, T); g.matrixWorldNeedsUpdate = true;
        }
      }
      koren3.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(koren3);
      if (!box.isEmpty()) {
        const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
        cil.copy(c);
        if (prepocitatPohled) { polomer = r; orb.dist = r * 1.9; }
        else polomer = Math.max(polomer, r);
      }
      kresli();
    }
    function kresli() {
      const w = kontejner.clientWidth || 300, h = kontejner.clientHeight || 300;
      renderer.setSize(w, h, false); kamera.aspect = w / h;
      kamera.near = Math.max(0.5, orb.dist / 200); kamera.far = orb.dist * 20 + polomer * 4; kamera.updateProjectionMatrix();
      const ce = Math.cos(orb.el);
      kamera.position.set(cil.x + orb.dist * ce * Math.sin(orb.az), cil.y + orb.dist * Math.sin(orb.el), cil.z + orb.dist * ce * Math.cos(orb.az));
      kamera.lookAt(cil);
      renderer.render(scene, kamera);
    }
    // ovládání: tažení = otáčení, kolečko / dva prsty = zoom
    const ukaz = new Map(); let pinch = 0;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]); el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', (e) => {
      if (!ukaz.has(e.pointerId)) return;
      const st = ukaz.get(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 2) {
        const [a, b] = [...ukaz.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) { orb.dist = Math.max(polomer * 0.6, Math.min(polomer * 12, orb.dist * pinch / dd)); kresli(); }
        pinch = dd; return;
      }
      orb.az -= (e.clientX - st[0]) * 0.008; orb.el = Math.max(-1.5, Math.min(1.5, orb.el + (e.clientY - st[1]) * 0.008)); kresli();
    });
    const konec = (e) => { ukaz.delete(e.pointerId); if (ukaz.size < 2) pinch = 0; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', konec); el.addEventListener('pointercancel', konec);
    el.addEventListener('wheel', (e) => { e.preventDefault(); orb.dist = Math.max(polomer * 0.6, Math.min(polomer * 12, orb.dist * Math.exp(e.deltaY * 0.001))); kresli(); }, { passive: false });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => kresli()) : null; if (ro) ro.observe(kontejner);
    return {
      nastav,
      slozeni(x) { s = Math.max(0, Math.min(1, x)); aktualizuj(false); },
      pohled() { orb.az = -0.65; orb.el = 0.5; const sp = s; s = 0; aktualizuj(true); s = sp; aktualizuj(false); },
      kresli
    };
  }
  koren.KrabiceNahled3D = { vytvor };
})(window);
