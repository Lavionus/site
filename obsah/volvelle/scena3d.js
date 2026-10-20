/* ============================================================
   Volvelle – 3D náhled (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Papírové vrstvy jako ploché tvary s okénky, textura = SVG vrstvy. Rozložení posouvá vrstvy nad sebe.
   Souřadnice: vrstva (x, y dolů) → three (x, 0, z = y), otočení po směru ručiček = rotace kolem +Y o −ρ.
   Kreslí se na vyžádání (změna, pohyb kamery) a jen když je plátno vidět.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;

  function vytvor(obal) {
    const THREE = koren.THREE, K = koren.VOLV_KRESBA, O = koren.VOLV_VYSTUP;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(36, 1, 1, 1e5);
    scena.add(new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.1));
    const svetlo = new THREE.DirectionalLight(0xffffff, 1.4); svetlo.position.set(-0.5, 1.4, 0.8); scena.add(svetlo);
    const skupina = new THREE.Group(); scena.add(skupina);
    const orbit = { az: 20, el: 48, vzd: 1 };
    let model = null, uhly = [], rozlozeni = 0.35, R0 = 100, sloty = [], spinave = true, viditelne = true, verze = 0, nyt = null;

    function zlikviduj() {
      for (const o of skupina.children.slice()) {
        skupina.remove(o);
        o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) for (const m of [].concat(x.material)) { if (m.map) m.map.dispose(); m.dispose(); } });
      }
      sloty = []; nyt = null;
    }
    function tvar(v) {
      const b = K.obrysBody(v.tvar, 160).map((q) => new THREE.Vector2(q[0], -q[1]));
      const sh = new THREE.Shape(b);
      for (const o of v.okna || []) sh.holes.push(new THREE.Path(K.oknoBody(o).map((q) => new THREE.Vector2(q[0], -q[1]))));
      const g = new THREE.ShapeGeometry(sh, 6), R = v.R, pos = g.getAttribute('position'), uv = g.getAttribute('uv');
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + R) / (2 * R), (pos.getY(i) + R) / (2 * R));
      uv.needsUpdate = true;
      return g;
    }
    /** textura z SVG vrstvy (s vloženými písmy stylu) */
    function textura(v, st, i, ver) {
      const R = v.R, px = Math.min(2048, Math.max(512, Math.round(R * 2 * 7)));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${-R} ${-R} ${2 * R} ${2 * R}" font-family="${O.rodina(st, false).replace(/"/g, "'")}">${O.fontFace(st)}${O.svgVrstva(v, st, { id: 't' + i })}</svg>`;
      const c = document.createElement('canvas'); c.width = c.height = px;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      img.onload = () => { if (ver === verze) { c.getContext('2d').drawImage(img, 0, 0, px, px); tex.needsUpdate = true; spinave = true; } URL.revokeObjectURL(url); };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
      return tex;
    }
    function nastavModel(m, uh) {
      verze++; zlikviduj(); model = m; uhly = uh.slice();
      R0 = Math.max(...m.vrstvy.map((v) => v.R));
      const st = m.styl, papir = new THREE.Color(st.barvy.papir || '#ffffff');
      m.vrstvy.forEach((v, i) => {
        const g = tvar(v), slot = new THREE.Group(), drz = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ map: textura(v, st, i, verze), roughness: 0.92, metalness: 0, side: THREE.FrontSide, transparent: !!v.pruhledna, opacity: v.pruhledna ? 0.45 : 1 });
        const lic = new THREE.Mesh(g, mat), rub = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: papir.clone().multiplyScalar(0.9), roughness: 1, side: THREE.BackSide, transparent: !!v.pruhledna, opacity: v.pruhledna ? 0.45 : 1 }));
        for (const x of [lic, rub]) { x.rotation.x = -Math.PI / 2; drz.add(x); }
        slot.add(drz); skupina.add(slot); sloty.push({ slot, drz });
      });
      nyt = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1, 24), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.7, roughness: 0.35 }));
      skupina.add(nyt);
      rozmisti(); nastavKameru(); spinave = true;
    }
    function rozmisti() {
      const gap = 0.6 + rozlozeni * R0 * 0.32;
      sloty.forEach((s, i) => { s.slot.position.y = i * gap; s.drz.rotation.y = -(uhly[i] || 0) * RAD; });
      if (nyt) { const h = (sloty.length - 1) * gap + 2.4; nyt.scale.y = h; nyt.position.y = h / 2 - 1.2; }
      spinave = true;
    }
    function nastavKameru() {
      const d = R0 * 3.4 * orbit.vzd, az = orbit.az * RAD, el = orbit.el * RAD, sy = (sloty.length - 1) * (0.6 + rozlozeni * R0 * 0.32) / 2;
      kamera.position.set(d * Math.cos(el) * Math.sin(az), sy + d * Math.sin(el), d * Math.cos(el) * Math.cos(az));
      kamera.lookAt(0, sy, 0); kamera.near = d / 50; kamera.far = d * 10; kamera.updateProjectionMatrix();
      spinave = true;
    }
    function velikost() {
      const w = obal.clientWidth || 300, h = obal.clientHeight || 300;
      renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); spinave = true;
    }
    function tema() {
      const tm = (document.documentElement.getAttribute('data-theme') || '') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
      scena.background = new THREE.Color(tm ? 0x1d2228 : 0xe4e9ee);
      spinave = true;
    }
    // ovládání kamery
    const ukaz = new Map(); let pinch0 = 0, vzd0 = 1;
    renderer.domElement.addEventListener('pointerdown', (e) => { renderer.domElement.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]); if (ukaz.size === 2) { const [a, b] = [...ukaz.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); vzd0 = orbit.vzd; } });
    renderer.domElement.addEventListener('pointermove', (e) => {
      if (!ukaz.has(e.pointerId)) return;
      const p = ukaz.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
      ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 2) { const [a, b] = [...ukaz.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0 > 0) orbit.vzd = Math.max(0.3, Math.min(3, vzd0 * pinch0 / d)); }
      else { orbit.az -= dx * 0.4; orbit.el = Math.max(5, Math.min(89, orbit.el + dy * 0.3)); }
      nastavKameru();
    });
    const konec = (e) => { ukaz.delete(e.pointerId); pinch0 = 0; };
    renderer.domElement.addEventListener('pointerup', konec); renderer.domElement.addEventListener('pointercancel', konec);
    renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); orbit.vzd = Math.max(0.3, Math.min(3, orbit.vzd * (e.deltaY > 0 ? 1.1 : 0.9))); nastavKameru(); }, { passive: false });
    new ResizeObserver(velikost).observe(obal);
    new IntersectionObserver((z) => { viditelne = z[0].isIntersecting; if (viditelne) spinave = true; }).observe(obal);
    new MutationObserver(tema).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    tema(); velikost();
    (function smycka() {
      requestAnimationFrame(smycka);
      if (!spinave || !viditelne || !model) return;
      spinave = false; renderer.render(scena, kamera);
    })();
    return {
      nastavModel,
      otoceni(uh) { uhly = uh.slice(); rozmisti(); },
      rozlozeni(t) { rozlozeni = t; rozmisti(); nastavKameru(); },
      pohled(az, el) { orbit.az = az; orbit.el = el; orbit.vzd = 1; nastavKameru(); },
      get stav() { return { rozlozeni, orbit: Object.assign({}, orbit) }; },
    };
  }
  koren.VOLV_3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
