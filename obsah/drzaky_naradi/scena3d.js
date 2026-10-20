/* ============================================================
   Držáky nářadí – 3D náhled sestavy (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Objekty v souřadnicích z nahoru: {sit:{poz, idx}, barva, posun:[x,y,z]} nebo {box:[x0,y0,z0,x1,y1,z1], barva}.
   Převod (x, y, z) → three (x, z, −y). Kreslí se jen po změně a když je plátno vidět.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;
  function vytvor(obal) {
    const THREE = koren.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene(), kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e6);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 0.95), svetlo = new THREE.DirectionalLight(0xffffff, 1.5);
    scena.add(hemi, svetlo, svetlo.target);
    const skupina = new THREE.Group(); scena.add(skupina);
    const orbit = { az: -32, el: 34, vzd: 600, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = true, spinave = true, zrusen = false, posledni = [];
    const tmave = () => { const t = document.documentElement.getAttribute('data-theme') || ''; return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches); };
    function zlikviduj() {
      for (const o of skupina.children.slice()) { skupina.remove(o); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); }
    }
    function nastav(objekty, o) {
      o = o || {};
      posledni = objekty; zlikviduj();
      scena.background = new THREE.Color(tmave() ? 0x1d2228 : 0xe4ebf2);
      const bb = new THREE.Box3();
      for (const ob of objekty) {
        let g;
        if (ob.box) {
          const [x0, y0, z0, x1, y1, z1] = ob.box;
          g = new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0); g.translate((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2);
        } else {
          const p = ob.sit.poz, poz = new Float32Array(p.length), d = ob.posun || [0, 0, 0];
          for (let i = 0; i < p.length; i += 3) { poz[i] = p[i] + d[0]; poz[i + 1] = p[i + 2] + d[2]; poz[i + 2] = -(p[i + 1] + d[1]); }
          const gi = new THREE.BufferGeometry(); gi.setAttribute('position', new THREE.BufferAttribute(poz, 3)); gi.setIndex(new THREE.BufferAttribute(ob.sit.idx, 1));
          g = gi.toNonIndexed(); gi.dispose(); g.computeVertexNormals();
        }
        const mat = new THREE.MeshStandardMaterial({ color: ob.barva || 0x3f8f5a, roughness: ob.drevo ? 0.85 : 0.55, metalness: 0.02, transparent: !!ob.pruhledny, opacity: ob.pruhledny ? 0.45 : 1 });
        const m = new THREE.Mesh(g, mat); skupina.add(m);
        if (!ob.pozadi) { g.computeBoundingBox(); bb.union(g.boundingBox); }
      }
      if (bb.isEmpty()) bb.set(new THREE.Vector3(-50, -50, -50), new THREE.Vector3(50, 50, 50));
      const vel = bb.getSize(new THREE.Vector3()), m = Math.max(vel.x, vel.y, vel.z);
      stred = bb.getCenter(new THREE.Vector3());
      if (!o.ponechatKameru) { orbit.vzd = m * 1.55 + 40; orbit.nasob = 1; }
      svetlo.position.set(stred.x + m * 0.6, stred.y + m * 1.3, stred.z + m * 0.9); svetlo.target.position.copy(stred);
      spinave = true;
    }
    function nastavKameru() {
      const d = orbit.vzd * orbit.nasob, az = orbit.az * RAD, el = orbit.el * RAD;
      kamera.position.set(stred.x + d * Math.cos(el) * Math.sin(az), stred.y + d * Math.sin(el), stred.z + d * Math.cos(el) * Math.cos(az));
      kamera.lookAt(stred); kamera.near = Math.max(0.5, d * 0.01); kamera.far = d * 20; kamera.updateProjectionMatrix();
    }
    const ukaz = new Map(); let pinch0 = null;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]); el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', (e) => {
      if (!ukaz.has(e.pointerId)) return;
      const [x0, y0] = ukaz.get(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 1) { orbit.az -= (e.clientX - x0) * 0.4; orbit.el = Math.max(-80, Math.min(89, orbit.el + (e.clientY - y0) * 0.3)); }
      else if (ukaz.size === 2) { const [a, b] = [...ukaz.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) orbit.nasob = Math.max(0.1, Math.min(5, orbit.nasob * pinch0 / d)); pinch0 = d; }
      spinave = true;
    });
    const pust = (e) => { ukaz.delete(e.pointerId); if (ukaz.size < 2) pinch0 = null; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', pust); el.addEventListener('pointercancel', pust);
    el.addEventListener('wheel', (e) => { e.preventDefault(); orbit.nasob = Math.max(0.1, Math.min(5, orbit.nasob * Math.exp(e.deltaY * 0.001))); spinave = true; }, { passive: false });
    function velikost() {
      const w = Math.max(10, obal.clientWidth), h = Math.max(10, obal.clientHeight);
      renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
      renderer.setSize(w, h, false); kamera.aspect = w / h; spinave = true;
    }
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    const mo = new MutationObserver(() => { nastav(posledni, { ponechatKameru: true }); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    (function smycka() {
      if (zrusen) return;
      if (viditelne && spinave && !document.hidden) { spinave = false; nastavKameru(); renderer.render(scena, kamera); }
      requestAnimationFrame(smycka);
    })();
    return {
      nastav,
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, sirka: renderer.domElement.width, vyska: renderer.domElement.height, objektu: skupina.children.length }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(); renderer.dispose(); el.remove(); },
    };
  }
  koren.DN3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
