/* ============================================================
   zaplavy/pohled3d.js – 3D náhled terénu s vodou (three.js r128, globální THREE).
   Síť je převzorkovaná na nejvýš ~240 × 240 vrcholů. Hladina je druhá síť:
   mokré vrcholy leží ve výšce hladiny, suché těsně pod terénem, takže se
   břehová čára vytvoří sama průnikem obou ploch.
   Ovládání: tažení = otáčení, kolečko / dva prsty = přiblížení, Shift+tažení = posun.
   ============================================================ */
(function () {
  'use strict';
  function vytvor(kont, volby) {
    const THREE = window.THREE;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(dpr);
    kont.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block'; renderer.domElement.style.touchAction = 'none';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(45, 1, 1, 1e6);
    scena.add(new THREE.AmbientLight(0xffffff, 0.75));
    const svetlo = new THREE.DirectionalLight(0xffffff, 0.5); svetlo.position.set(-1, 2, -1); scena.add(svetlo);
    let teren = null, voda = null, data = null, prevyseni = 2;
    const orb = { az: 0.6, el: 0.7, r: 1000, cil: new THREE.Vector3() };

    function velikost() {
      const w = Math.max(10, kont.clientWidth), h = Math.max(10, kont.clientHeight);
      renderer.setSize(w, h); kamera.aspect = w / h; kamera.updateProjectionMatrix(); kresli();
    }
    function kresli() {
      kamera.position.set(orb.cil.x + orb.r * Math.cos(orb.el) * Math.sin(orb.az), orb.cil.y + orb.r * Math.sin(orb.el), orb.cil.z + orb.r * Math.cos(orb.el) * Math.cos(orb.az));
      kamera.lookAt(orb.cil);
      renderer.render(scena, kamera);
    }
    const ro = new ResizeObserver(velikost); ro.observe(kont);

    /** m: mřížka (vysky už s úpravami), stin: Uint8Array, barva(e) → [r,g,b] 0–255, bunka: rozměr buňky na zemi (m) */
    function nastavTeren(m, stin, barva, bunka) {
      [teren, voda].forEach(o => { if (o) { scena.remove(o); o.geometry.dispose(); o.material.dispose(); } });
      const krok = Math.max(1, Math.ceil(Math.max(m.sirka, m.vyska) / 240));
      const nx = Math.floor((m.sirka - 1) / krok) + 1, ny = Math.floor((m.vyska - 1) / krok) + 1;
      let min = Infinity; for (const e of m.vysky) if (e === e && e < min) min = e;
      const idx = new Int32Array(nx * ny), vys = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * krok * m.sirka + i * krok, e = m.vysky[k];
        idx[j * nx + i] = k; vys[j * nx + i] = e === e ? e : min;
      }
      const sx = (nx - 1) * krok * bunka, sz = (ny - 1) * krok * bunka;
      const geo = () => {
        const g = new THREE.BufferGeometry(), poz = new Float32Array(nx * ny * 3), ind = [];
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const p = (j * nx + i) * 3; poz[p] = i * krok * bunka - sx / 2; poz[p + 2] = j * krok * bunka - sz / 2; }
        for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; ind.push(a, c, b, b, c, d); }
        g.setIndex(ind); g.setAttribute('position', new THREE.BufferAttribute(poz, 3));
        g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nx * ny * 3), 3));
        return g;
      };
      const gt = geo(), bar = gt.attributes.color.array;
      for (let v = 0; v < nx * ny; v++) { const c = barva(vys[v]), s = 0.35 + 0.65 * (stin ? stin[idx[v]] : 200) / 255; bar[v * 3] = c[0] / 255 * s; bar[v * 3 + 1] = c[1] / 255 * s; bar[v * 3 + 2] = c[2] / 255 * s; }
      teren = new THREE.Mesh(gt, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      voda = new THREE.Mesh(geo(), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      scena.add(teren, voda);
      data = { nx, ny, idx, vys, min, sx, sz };
      orb.r = Math.max(sx, sz) * 1.15; orb.cil.set(0, 0, 0);
      kamera.near = orb.r / 1000; kamera.far = orb.r * 20; kamera.updateProjectionMatrix();
      vyskyTerenu();
    }
    function vyskyTerenu() {
      if (!data) return;
      const p = teren.geometry.attributes.position.array;
      for (let v = 0; v < data.nx * data.ny; v++) p[v * 3 + 1] = (data.vys[v] - data.min) * prevyseni;
      teren.geometry.attributes.position.needsUpdate = true; teren.geometry.computeBoundingSphere();
    }
    /** klic: přelivové výšky (nebo výšky), L: hladina, barvaH(h) → [r,g,b] */
    function nastavVodu(klic, L, barvaH, bezVody) {
      if (!data) return;
      const p = voda.geometry.attributes.position.array, c = voda.geometry.attributes.color.array;
      let nic = true;
      for (let v = 0; v < data.nx * data.ny; v++) {
        const e = data.vys[v], mokra = !bezVody && klic && klic[data.idx[v]] < L;
        p[v * 3 + 1] = mokra ? (L - data.min) * prevyseni : (e - data.min) * prevyseni - 3 * prevyseni;
        if (mokra) { nic = false; const b = barvaH(L - e); c[v * 3] = b[0] / 255; c[v * 3 + 1] = b[1] / 255; c[v * 3 + 2] = b[2] / 255; }
      }
      voda.visible = !nic;
      voda.geometry.attributes.position.needsUpdate = true; voda.geometry.attributes.color.needsUpdate = true; voda.geometry.computeBoundingSphere();
      voda.geometry.computeVertexNormals();
      data.posledni = [klic, L, barvaH, bezVody];
      kresli();
    }
    function nastavPrevyseni(f) { prevyseni = f; vyskyTerenu(); if (data && data.posledni) nastavVodu(...data.posledni); else kresli(); }

    // ovládání
    const ukaz = new Map(); let pinch = 0;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
    el.addEventListener('pointerup', e => { ukaz.delete(e.pointerId); pinch = 0; });
    el.addEventListener('pointercancel', e => { ukaz.delete(e.pointerId); pinch = 0; });
    el.addEventListener('pointermove', e => {
      const p = ukaz.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ukaz.size === 2) {
        const [a, b] = [...ukaz.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) orb.r = Math.max(10, orb.r * pinch / d); pinch = d;
      } else if (e.shiftKey) {
        const s = orb.r / kont.clientHeight;
        // vpravo = (cos az, 0, −sin az), od kamery dopředu = (−sin az, 0, −cos az)
        orb.cil.x += (-dx * Math.cos(orb.az) - dy * Math.sin(orb.az)) * s;
        orb.cil.z += (dx * Math.sin(orb.az) - dy * Math.cos(orb.az)) * s;
      } else {
        orb.az -= dx * 0.008; orb.el = Math.max(0.08, Math.min(1.5, orb.el + dy * 0.006));
      }
      kresli();
    });
    el.addEventListener('wheel', e => { e.preventDefault(); orb.r = Math.max(10, orb.r * Math.exp(e.deltaY * 0.0012)); kresli(); }, { passive: false });

    velikost();
    return {
      nastavTeren, nastavVodu, nastavPrevyseni, kresli,
      snimek: () => { kresli(); return renderer.domElement.toDataURL('image/png'); },
      zrus: () => { ro.disconnect(); [teren, voda].forEach(o => { if (o) { o.geometry.dispose(); o.material.dispose(); } }); renderer.dispose(); el.remove(); },
      platno: el
    };
  }
  window.ZaplavyPohled3d = { vytvor };
})();
