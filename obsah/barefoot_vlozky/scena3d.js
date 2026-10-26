/* ============================================================
   Barefoot vložky – 3D náhled (three.js r160, globální THREE).
   Vložka = vytažený obrys o tloušťce materiálu, otvory perforace, na horní ploše
   obrys chodidla a ořezové čáry. Souřadnice jádra (x, y, z nahoru) → three otočením kořene.
   ============================================================ */
(function (koren) {
  'use strict';

  function vytvor(obal) {
    const THREE = koren.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e5);
    scena.add(new THREE.HemisphereLight(0xffffff, 0x6d6152, 1.1));
    const sv = new THREE.DirectionalLight(0xfff4e0, 1.6); sv.position.set(0.4, 1, 0.6); scena.add(sv);
    const koren3 = new THREE.Group(); koren3.rotation.x = -Math.PI / 2; scena.add(koren3);
    const orbit = { az: -25, el: 48, vzd: 700, stred: new THREE.Vector3() };
    let spinave = true, zrusen = false;

    const tmave = () => { const dt = document.documentElement.getAttribute('data-theme'); return dt === 'dark' || (!dt && matchMedia('(prefers-color-scheme: dark)').matches); };
    function zlikviduj() {
      for (const o of [...koren3.children]) { koren3.remove(o); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); }
    }
    const cara = (body, z, barva, uzavrit) => {
      const pts = body.map(([x, y]) => new THREE.Vector3(x, y, z));
      if (uzavrit) pts.push(pts[0].clone());
      return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: barva }));
    };

    /* v = výsledek BFJ.spocitej */
    function nastav(v) {
      zlikviduj();
      if (!v.nohy.length) { spinave = true; return; }   // prázdný projekt: prázdná scéna, ne starý model
      const p = v.p, J = koren.BFJ, t = p.rezim === 'vlozka' ? p.tloustka : 1.2;
      const barva = p.rezim === 'vlozka' ? J.MATERIALY[p.material].barva : '#d9cfb8';
      let ox = 0, maxL = 0;
      for (const n of v.nohy) {
        const obrys = n.tab ? n.tab.obrys : n.vlozka;
        const tvar = new THREE.Shape(obrys.map(([x, y]) => new THREE.Vector2(x, y)));
        for (const q of n.perf) { const h = new THREE.Path(); h.absarc(q.x, q.y, q.r, 0, Math.PI * 2, true); tvar.holes.push(h); }
        if (n.tab) { const h = new THREE.Path(), o = n.tab.otvor; h.absarc(o.x, o.y, o.r, 0, Math.PI * 2, true); tvar.holes.push(h); }
        const geo = new THREE.ExtrudeGeometry(tvar, { depth: t, bevelEnabled: true, bevelThickness: Math.min(0.6, t / 4), bevelSize: Math.min(0.6, t / 4), bevelSegments: 2, curveSegments: 16 });
        const sk = new THREE.Group(); sk.position.x = ox;
        const svrchni = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: barva, roughness: 0.92, metalness: 0 }));
        sk.add(svrchni);
        /* spodní vrstva (menší, jiný materiál) pod svrchní, podpory jako nízké vyvýšení pod ní */
        let pod = 0;
        if (n.vrstva2 && n.vrstva2.length > 8) {
          const t2 = p.tloustka2, g2 = new THREE.ExtrudeGeometry(new THREE.Shape(n.vrstva2.map(([x, y]) => new THREE.Vector2(x, y))), { depth: t2, bevelEnabled: false, curveSegments: 8 });
          sk.add(new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ color: J.MATERIALY[p.material2].barva, roughness: 0.95, metalness: 0 })));
          pod = t2;
        }
        for (const q of n.podpory || []) {
          const g3 = new THREE.ExtrudeGeometry(new THREE.Shape(q.body.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 3, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 2, bevelSegments: 3 });
          const m3 = new THREE.Mesh(g3, new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.9 }));
          m3.position.z = -3 - 1.2; sk.add(m3);
        }
        svrchni.position.z = pod;
        const z = pod + t + Math.min(0.6, t / 4) + 0.15;
        if (p.noha) sk.add(cara(n.noha, z, 0x1f5fa8, true));
        for (const r of n.orez) sk.add(cara(r.body, z, 0xc0392b, false));
        for (const q of n.znacky) sk.add(cara([[q.x0 + 2, q.y], [q.x1 - 2, q.y]], z, 0x1e7d3a, false));
        koren3.add(sk);
        ox += n.Wt + 25; maxL = Math.max(maxL, n.Lt);
      }
      const sirka = ox - 25;
      orbit.stred.set(sirka / 2, 0, -maxL / 2 + (p.rezim === 'kontrolni' ? p.jazyk / 2 : 0));
      orbit.vzd = Math.max(sirka, maxL) * 2.1;
      spinave = true;
    }

    function velikost() {
      const w = obal.clientWidth || 300, h = obal.clientHeight || 300;
      renderer.setSize(w, h, true);   // true = nastaví i CSS rozměr (jinak na HiDPI přeteče)
      kamera.aspect = w / h; kamera.updateProjectionMatrix(); spinave = true;
    }
    function smycka() {
      if (zrusen) return;
      requestAnimationFrame(smycka);
      if (!spinave) return;
      spinave = false;
      scena.background = new THREE.Color(tmave() ? 0x1d2228 : 0xe7ebef);
      const a = orbit.az * Math.PI / 180, e = orbit.el * Math.PI / 180;
      kamera.position.set(orbit.stred.x + orbit.vzd * Math.cos(e) * Math.sin(a), orbit.stred.y + orbit.vzd * Math.sin(e), orbit.stred.z + orbit.vzd * Math.cos(e) * Math.cos(a));
      kamera.lookAt(orbit.stred);
      renderer.render(scena, kamera);
    }
    let tah = null;
    renderer.domElement.addEventListener('pointerdown', (e) => { tah = { x: e.clientX, y: e.clientY }; renderer.domElement.setPointerCapture(e.pointerId); renderer.domElement.style.cursor = 'grabbing'; });
    renderer.domElement.addEventListener('pointermove', (e) => {
      if (!tah) return;
      orbit.az -= (e.clientX - tah.x) * 0.4; orbit.el = Math.max(5, Math.min(89, orbit.el + (e.clientY - tah.y) * 0.3));
      tah = { x: e.clientX, y: e.clientY }; spinave = true;
    });
    const pust = () => { tah = null; renderer.domElement.style.cursor = 'grab'; };
    renderer.domElement.addEventListener('pointerup', pust);
    renderer.domElement.addEventListener('pointercancel', pust);
    renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); orbit.vzd = Math.max(80, Math.min(4000, orbit.vzd * (e.deltaY > 0 ? 1.1 : 0.9))); spinave = true; }, { passive: false });
    new ResizeObserver(velikost).observe(obal);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { spinave = true; });
    new MutationObserver(() => { spinave = true; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    velikost(); smycka();

    return {
      nastav,
      pohled(az, el) { orbit.az = az; orbit.el = el; spinave = true; },
      zrus() { zrusen = true; zlikviduj(); renderer.dispose(); },
      get renderer() { return renderer; },
    };
  }

  koren.BF3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
