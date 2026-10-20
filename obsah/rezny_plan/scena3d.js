/* ============================================================
   Řezný plán – 3D stoh desek (three.js r160, globální THREE)
   Každá deska = deska v barvě dřeva, dílce jako vystouplé kvádry v barvě řádku, zbytky zeleně.
   Rozložení stohu nastavitelné (0 = desky na sobě, 1 = rozložené nad sebou). Kreslí se jen když je vidět.
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
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e6);
    scena.add(new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.0));
    const svetlo = new THREE.DirectionalLight(0xffffff, 1.5); scena.add(svetlo, svetlo.target);
    const skupina = new THREE.Group(); scena.add(skupina);
    const orbit = { az: -35, el: 32, vzd: 6000, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = false, spinave = true, zrusen = false, data = null, rozlozit = 0.6;
    const tmave = () => { const t = document.documentElement.getAttribute('data-theme') || ''; return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches); };
    function zlikviduj() {
      for (const o of skupina.children.slice()) { skupina.remove(o); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); }
    }
    function postav() {
      zlikviduj();
      scena.background = new THREE.Color(tmave() ? 0x16191d : 0xe9edf1);
      if (!data || !data.desky.length) return;
      const pal = data.paleta, materialy = new Map();
      const mat = (hex) => { if (!materialy.has(hex)) materialy.set(hex, new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.75, metalness: 0 })); return materialy.get(hex); };
      const drevo = mat('#c9a978'), zbytek = mat('#8fcf8a'), hrana = mat('#2f5fd0');
      let maxW = 0, maxH = 0, z = 0;
      const box = new THREE.BoxGeometry(1, 1, 1);
      data.desky.forEach((d, i) => {
        const tl = Math.max(3, d.tl || 18), mezera = rozlozit * Math.max(d.W, d.H) * 0.22;
        const g = new THREE.Group();
        const zakl = new THREE.Mesh(box, drevo); zakl.scale.set(d.W, tl * 0.98, d.H); zakl.position.set(d.W / 2, tl / 2, -d.H / 2); g.add(zakl);
        for (const q of d.dily) {
          const m = new THREE.Mesh(box, mat(pal[q.di % pal.length]));
          m.scale.set(q.w, tl, q.h); m.position.set(q.x + q.w / 2, tl / 2 + tl * 0.08 + rozlozit * tl * 0.6, -(q.y + q.h / 2)); g.add(m);
        }
        for (const zb of d.zbytky || []) if (zb.pouzitelny) {
          const m = new THREE.Mesh(box, zbytek); m.scale.set(zb.w, tl * 1.02, zb.h); m.position.set(zb.x + zb.w / 2, tl / 2 + tl * 0.04, -(zb.y + zb.h / 2)); g.add(m);
        }
        g.position.y = z; z += tl * 1.4 + mezera;
        skupina.add(g); maxW = Math.max(maxW, d.W); maxH = Math.max(maxH, d.H);
        void i; void hrana;
      });
      skupina.position.set(-maxW / 2, 0, maxH / 2);
      stred = new THREE.Vector3(0, z / 2, 0);
      orbit.vzd = Math.max(maxW, maxH, z) * 1.7 + 200;
      svetlo.position.set(maxW * 0.5, z + maxH * 1.4, maxH);
      svetlo.target.position.copy(stred);
      spinave = true;
    }
    function nastavKameru() {
      const d = orbit.vzd * orbit.nasob, az = orbit.az * RAD, el = orbit.el * RAD;
      kamera.position.set(stred.x + d * Math.cos(el) * Math.sin(az), stred.y + d * Math.sin(el), stred.z + d * Math.cos(el) * Math.cos(az));
      kamera.lookAt(stred); kamera.near = Math.max(1, d * 0.01); kamera.far = d * 20; kamera.updateProjectionMatrix();
    }
    const ukaz = new Map(); let pinch0 = null; const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]); el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', (e) => {
      if (!ukaz.has(e.pointerId)) return;
      const [x0, y0] = ukaz.get(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 1) { orbit.az -= (e.clientX - x0) * 0.4; orbit.el = Math.max(-10, Math.min(89, orbit.el + (e.clientY - y0) * 0.3)); }
      else if (ukaz.size === 2) { const [a, b] = [...ukaz.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) orbit.nasob = Math.max(0.15, Math.min(5, orbit.nasob * pinch0 / dd)); pinch0 = dd; }
      spinave = true;
    });
    const pust = (e) => { ukaz.delete(e.pointerId); if (ukaz.size < 2) pinch0 = null; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', pust); el.addEventListener('pointercancel', pust);
    el.addEventListener('wheel', (e) => { e.preventDefault(); orbit.nasob = Math.max(0.15, Math.min(5, orbit.nasob * Math.exp(e.deltaY * 0.001))); spinave = true; }, { passive: false });
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
      aktualizuj(d) { data = d; postav(); },
      rozloz(f) { rozlozit = f; postav(); },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, objektu: skupina.children.length, sirka: renderer.domElement.width }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(); renderer.dispose(); el.remove(); },
    };
  }
  koren.RP3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
