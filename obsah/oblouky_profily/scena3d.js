/* ============================================================
   Šablony oblouků a profilů – 3D náhled (three.js r160, globální THREE)
   teleso: {typ:'vytlac', tvary:[{obrys, diry, h, barva}], stojici, lista}
           {typ:'rotace', body:[[z, r]], ctyrhrany:[{z0, z1, a}]}
           {typ:'loft', rezy:[{z, x0, x1, y0, y1}], a}
   Kreslí se jen po změně a když je karta vidět.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;

  function vytvor(obal) {
    const THREE = koren.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene(), kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e6);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 0.95), svetlo = new THREE.DirectionalLight(0xffffff, 1.7);
    scena.add(hemi, svetlo, svetlo.target);
    const skupina = new THREE.Group(); scena.add(skupina);
    const orbit = { az: -35, el: 28, vzd: 800, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = true, spinave = true, zrusen = false, teleso = null;

    const tmave = () => { const t = document.documentElement.getAttribute('data-theme') || ''; return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches); };
    function zlikviduj() {
      for (const o of skupina.children.slice()) { skupina.remove(o); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); }
    }
    const drevo = (barva) => new THREE.MeshStandardMaterial({ color: barva || 0xd9b98a, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    function tvar(obrys, diry) {
      const s = new THREE.Shape(obrys.map((q) => new THREE.Vector2(q[0], q[1])));
      for (const d of diry || []) s.holes.push(new THREE.Path(d.map((q) => new THREE.Vector2(q[0], q[1]))));
      return s;
    }
    function postav() {
      zlikviduj();
      const tm = tmave();
      scena.background = new THREE.Color(tm ? 0x1d2228 : 0xe4ebf2);
      const T = teleso; if (!T) { spinave = true; return; }
      const g = new THREE.Group();
      if (T.typ === 'vytlac') {
        for (const q of T.tvary) {
          if (!q.obrys || q.obrys.length < 3) continue;
          const geo = new THREE.ExtrudeGeometry(tvar(q.obrys, q.diry), { depth: q.h, bevelEnabled: false, curveSegments: 4 });
          g.add(new THREE.Mesh(geo, drevo(q.barva)));
        }
        // model: x, y v rovině výkresu, z = tloušťka. Ležící díl: rovina výkresu vodorovně.
        if (T.lista) { g.rotation.y = Math.PI / 2; }                 // lišta: řez v rovině y–z, délka podél x
        else if (!T.stojici) g.rotation.x = -Math.PI / 2;
      } else if (T.typ === 'rotace') {
        const pts = T.body.map((q) => new THREE.Vector2(Math.max(0, q[1]), q[0]));
        const geo = new THREE.LatheGeometry(pts, 96);
        g.add(new THREE.Mesh(geo, drevo(0xc9975c)));
        for (const c of T.ctyrhrany || []) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(c.a, c.z1 - c.z0, c.a), drevo(0xc08a50));
          b.position.y = (c.z0 + c.z1) / 2; g.add(b);
        }
        g.rotation.z = -Math.PI / 2;                                  // osa vodorovně (jako na soustruhu)
      } else if (T.typ === 'loft') {
        const R = T.rezy, poz = [], idx = [];
        // každý řez = obdélník [x0,x1] × [y0,y1] ve výšce z; čtyři boční pásy + víka
        for (const r of R) poz.push(r.x0, r.z, r.y0, r.x1, r.z, r.y0, r.x1, r.z, r.y1, r.x0, r.z, r.y1);
        for (let i = 0; i + 1 < R.length; i++) for (let s = 0; s < 4; s++) {
          const a = i * 4 + s, b = i * 4 + (s + 1) % 4, c2 = a + 4, d = b + 4;
          idx.push(a, b, d, a, d, c2);
        }
        const n = (R.length - 1) * 4;
        idx.push(0, 2, 1, 0, 3, 2, n, n + 1, n + 2, n, n + 2, n + 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3)); geo.setIndex(idx);
        const g2 = geo.toNonIndexed(); geo.dispose(); g2.computeVertexNormals();
        g.add(new THREE.Mesh(g2, drevo(0xc9975c)));
        // obrys polotovaru (drátěný)
        const a = T.a || 50, h = R[R.length - 1].z;
        const hr = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(a, h, a)), new THREE.LineBasicMaterial({ color: tm ? 0x8899aa : 0x667788 }));
        hr.position.set(a / 2, h / 2, a / 2); g.add(hr);
      }
      skupina.add(g);
      const box = new THREE.Box3().setFromObject(g), vel = box.getSize(new THREE.Vector3());
      stred = box.getCenter(new THREE.Vector3());
      const m = Math.max(vel.x, vel.y, vel.z, 10);
      orbit.vzd = m * 1.45;
      svetlo.position.set(stred.x + m * 0.7, stred.y + m * 1.3, stred.z + m * 0.9); svetlo.target.position.copy(stred);
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
      if (ukaz.size === 1) { orbit.az -= (e.clientX - x0) * 0.4; orbit.el = Math.max(-85, Math.min(89, orbit.el + (e.clientY - y0) * 0.3)); }
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
    const mo = new MutationObserver(() => { postav(); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    (function smycka() {
      if (zrusen) return;
      if (viditelne && spinave && !document.hidden) { spinave = false; nastavKameru(); renderer.render(scena, kamera); }
      requestAnimationFrame(smycka);
    })();
    return {
      aktualizuj(t) { teleso = t; postav(); },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, sirka: renderer.domElement.width, vyska: renderer.domElement.height, objektu: skupina.children.length, typ: teleso && teleso.typ }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(); renderer.dispose(); el.remove(); },
    };
  }
  koren.OBL3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
