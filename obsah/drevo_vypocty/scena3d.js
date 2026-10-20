/* ============================================================
   Dřevo – pohyb, průhyb, povrchy · 3D náhled průhybu police (three.js r160, globální THREE)
   Police a lišty jako kvádry dělené po délce; vrcholy posunuté o průhyb × zvětšení.
   Barva desky podle velikosti průhybu (volitelně), podpěry jako kolíčky, knihy jako kvádry.
   Kreslí se jen na vyžádání a jen když je plátno vidět.
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
    const kamera = new THREE.PerspectiveCamera(32, 1, 1, 1e5);
    scena.add(new THREE.HemisphereLight(0xffffff, 0x6d6152, 1.0));
    const sv = new THREE.DirectionalLight(0xfff4e0, 1.5); sv.position.set(0.5, 1, 0.9); scena.add(sv);
    const sv2 = new THREE.DirectionalLight(0xdde8ff, 0.4); sv2.position.set(-0.7, 0.3, -0.8); scena.add(sv2);
    const skupina = new THREE.Group(); scena.add(skupina);
    const orbit = { az: -28, el: 22, vzd: 1500, stred: new THREE.Vector3() };
    let spinave = true, zrusen = false, viditelne = true;

    function tmave() {
      const dt = document.documentElement.getAttribute('data-theme');
      return dt !== 'light';
    }
    function kamUpdate() {
      const a = orbit.az * Math.PI / 180, e = orbit.el * Math.PI / 180;
      kamera.position.set(orbit.stred.x + orbit.vzd * Math.cos(e) * Math.sin(a), orbit.stred.y + orbit.vzd * Math.sin(e), orbit.stred.z + orbit.vzd * Math.cos(e) * Math.cos(a));
      kamera.lookAt(orbit.stred); spinave = true;
    }
    function vycisti() {
      while (skupina.children.length) {
        const o = skupina.children.pop();
        o.traverse((q) => { if (q.geometry) q.geometry.dispose(); if (q.material) q.material.dispose(); });
      }
    }
    // průhyb v x (lineární interpolace mezi uzly MKP)
    function interp(xs, ws, x) {
      if (x <= xs[0]) return ws[0];
      for (let i = 1; i < xs.length; i++) if (x <= xs[i]) { const u = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ws[i - 1] * (1 - u) + ws[i] * u; }
      return ws[ws.length - 1];
    }
    function kvadr(x0, x1, y0, y1, z0, z1, xs, ws, zv, barva, barvit, wMax) {
      const dl = Math.max(1, Math.round((x1 - x0) / 10));
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0, dl, 1, 1);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      const pos = g.attributes.position, barvy = new Float32Array(pos.count * 3);
      const c0 = new THREE.Color(barva), cMax = new THREE.Color(0xd04030), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), w = interp(xs, ws, x);
        pos.setY(i, pos.getY(i) - w * zv);
        const k = barvit && wMax > 0 ? Math.min(1, Math.abs(w) / wMax) : 0;
        c.copy(c0).lerp(cMax, k * 0.85);
        barvy[i * 3] = c.r; barvy[i * 3 + 1] = c.g; barvy[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(barvy, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 }));
      const hr = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: 0x3b2a18, transparent: true, opacity: 0.45 }));
      const s = new THREE.Group(); s.add(m, hr); return s;
    }

    /** v = výsledek DVJ.police, p = vstup, o = { zvetseni, barvit, knihy } */
    function nastav(v, p, o) {
      vycisti();
      scena.background = new THREE.Color(tmave() ? 0x1d2228 : 0xe7ebef);
      const L = p.delka, D = p.hloubka, xs = v.okamzite.x, ws = v.dlouhodobe.w;
      const wMax = Math.max(...ws.map(Math.abs));
      const zv = o.zvetseni || 1;
      // osa x = délka, y = nahoru, z = k divákovi (předek)
      for (const c of v.casti) {
        let z0, z1;
        if (c.nazev === 'deska') { z0 = -D / 2; z1 = D / 2; }
        else if (c.nazev === 'přední lišta') { z0 = D / 2; z1 = D / 2 + c.b; }
        else { z0 = -D / 2 - c.b; z1 = -D / 2; }
        skupina.add(kvadr(0, L, c.y, c.y + c.h, z0, z1, xs, ws, zv, c.nazev === 'deska' ? 0xd9a66a : 0xa9733f, o.barvit && c.nazev === 'deska', wMax));
      }
      // podpory – kolíčky pod deskou u předního a zadního kraje / u vetknutí stěna
      const yMin = v.prurez.yMin;
      for (const sp of p.podpory) {
        const w = interp(xs, ws, sp.x) * zv;
        if (sp.vetknuti) {
          const g = new THREE.BoxGeometry(18, 220, D + 60); g.translate(sp.x < L / 2 ? -9 : L + 9, 40 - w, 0);
          skupina.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x8c949c, roughness: 0.9, transparent: true, opacity: 0.55 })));
          continue;
        }
        for (const z of [-D / 2 + 40, D / 2 - 40]) {
          const g = new THREE.CylinderGeometry(3, 3, 24, 16); g.rotateX(Math.PI / 2); g.translate(sp.x, yMin - 3 - w, z);
          skupina.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xb0b6bc, roughness: 0.35, metalness: 0.8 })));
          const g2 = new THREE.BoxGeometry(14, 6, 14); g2.translate(sp.x, yMin - 3 - w, z);
          skupina.add(new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.7 })));
        }
      }
      // knihy (náznak zatížení)
      if (o.knihy && p.kgm > 0) {
        const barvy = [0x4b6a8a, 0x8a4b4b, 0x5d7a4b, 0x7a6a4b, 0x5b4b7a, 0x3d5c5c];
        let x = 8, i = 0;
        while (x < L - 30) {
          const tl = 22 + ((i * 37) % 23), vy = 190 + ((i * 53) % 70), hl = Math.min(D - 20, 150 + ((i * 29) % 60));
          const w = interp(xs, ws, x + tl / 2) * zv, sk = (interp(xs, ws, x + tl) - interp(xs, ws, x)) * zv / tl;
          const g = new THREE.BoxGeometry(tl - 1.5, vy, hl);
          const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: barvy[i % barvy.length], roughness: 0.85 }));
          m.position.set(x + tl / 2, p.tloustka + vy / 2 - w, -D / 2 + hl / 2 + 6);
          m.rotation.z = -Math.atan(sk);
          skupina.add(m);
          x += tl; i++;
        }
      }
      orbit.stred.set(L / 2, 0, 0);
      orbit.vzd = Math.max(L, D * 2) * 1.6;
      kamUpdate();
    }

    // ovládání myší / prstem
    let tah = null;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => { tah = { x: e.clientX, y: e.clientY, az: orbit.az, el: orbit.el }; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', (e) => { if (!tah) return; orbit.az = tah.az - (e.clientX - tah.x) * 0.4; orbit.el = Math.max(-80, Math.min(85, tah.el + (e.clientY - tah.y) * 0.3)); kamUpdate(); });
    el.addEventListener('pointerup', () => { tah = null; el.style.cursor = 'grab'; });
    el.addEventListener('wheel', (e) => { e.preventDefault(); orbit.vzd *= Math.exp(e.deltaY * 0.001); kamUpdate(); }, { passive: false });

    function velikost() {
      const w = obal.clientWidth, h = obal.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); spinave = true;
    }
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    if ('IntersectionObserver' in koren) new IntersectionObserver((z) => { viditelne = z.some((q) => q.isIntersecting); if (viditelne) spinave = true; }).observe(obal);
    new MutationObserver(() => { scena.background = new THREE.Color(tmave() ? 0x1d2228 : 0xe7ebef); spinave = true; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    velikost();
    (function smycka() {
      if (zrusen) return;
      if (spinave && viditelne && obal.clientWidth) { renderer.render(scena, kamera); spinave = false; }
      requestAnimationFrame(smycka);
    })();
    return {
      nastav, pohled(az, el) { orbit.az = az; orbit.el = el; kamUpdate(); },
      png() { renderer.render(scena, kamera); return renderer.domElement.toDataURL('image/png'); },
      zrus() { zrusen = true; ro.disconnect(); vycisti(); renderer.dispose(); },
    };
  }
  koren.DV3 = { vytvor };
})(window);
