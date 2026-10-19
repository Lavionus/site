/* Interaktivní 3D náhled kol (three.js r128, vlastní jednoduché orbitální ovládání).
 * Pohled3D.vytvor(element) → {nastav(site, volby), natoc(phi1, phi2), vychozi(), znic()} */
(function () {
  'use strict';
  function barvaZCss(nazev, zaloha) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nazev).trim();
    try { return new THREE.Color(v || zaloha); } catch (e) { return new THREE.Color(zaloha); }
  }

  function geometrie(sit) {
    const P = sit.pozice, T = sit.trojuhelniky;
    const pos = new Float32Array(T.length * 3);
    for (let i = 0; i < T.length; i++) { const o = T[i] * 3; pos[i * 3] = P[o]; pos[i * 3 + 1] = P[o + 1]; pos[i * 3 + 2] = P[o + 2]; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  function vytvor(el) {
    if (typeof THREE === 'undefined') { el.textContent = '3D náhled vyžaduje knihovnu three.js, která se nenačetla.'; return null; }
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch (e) { el.insertAdjacentHTML('beforeend', '<p class="chybovy">WebGL není v tomto prohlížeči dostupné – 3D náhled nelze zobrazit. Export STL funguje dál.</p>'); return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('aria-label', '3D model kola – tažením otáčet, kolečkem přibližovat, Shift + tažení posouvat');
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000);
    scena.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.75));
    const sv = new THREE.DirectionalLight(0xffffff, 0.7); sv.position.set(1, -1.5, 2); scena.add(sv);
    const sv2 = new THREE.DirectionalLight(0xffffff, 0.25); sv2.position.set(-1, 1, -1); scena.add(sv2);
    const koren = new THREE.Group(); scena.add(koren);
    let dily = [];
    // orbitální kamera v souřadnicích s osou z nahoru
    const st = { cil: new THREE.Vector3(), vzd: 100, azim: -0.6, elev: 0.75, polomer: 50 };
    function umisti() {
      const ce = Math.cos(st.elev);
      kamera.position.set(st.cil.x + st.vzd * ce * Math.cos(st.azim), st.cil.y + st.vzd * ce * Math.sin(st.azim), st.cil.z + st.vzd * Math.sin(st.elev));
      kamera.up.set(0, 0, 1); kamera.lookAt(st.cil);
      kamera.near = Math.max(0.01, st.vzd / 100); kamera.far = st.vzd * 20 + st.polomer * 10; kamera.updateProjectionMatrix();
    }
    let ceka = false;
    function kresli() { if (ceka) return; ceka = true; requestAnimationFrame(() => { ceka = false; renderer.render(scena, kamera); }); }
    function velikost() {
      const w = el.clientWidth || 300, h = el.clientHeight || 300;
      renderer.setSize(w, h); kamera.aspect = w / h; kamera.updateProjectionMatrix(); kresli();
    }
    new ResizeObserver(velikost).observe(el);
    // ovládání ukazatelem
    const ukaz = new Map(); let pinch = 0;
    const cv = renderer.domElement;
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, { x: e.clientX, y: e.clientY, shift: e.shiftKey || e.button === 2 }); });
    cv.addEventListener('pointermove', (e) => {
      const p = ukaz.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ukaz.size === 2) {
        const [a, b] = [...ukaz.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) st.vzd = Math.max(st.polomer * 0.3, Math.min(st.polomer * 30, st.vzd * pinch / d));
        pinch = d;
      } else if (p.shift) {
        const k = st.vzd / el.clientHeight * 0.8;
        const prava = new THREE.Vector3().subVectors(kamera.position, st.cil).cross(kamera.up).normalize();
        const nahoru = new THREE.Vector3().crossVectors(prava, new THREE.Vector3().subVectors(st.cil, kamera.position)).normalize();
        st.cil.addScaledVector(prava, dx * k).addScaledVector(nahoru, dy * k);
      } else {
        st.azim -= dx * 0.008; st.elev = Math.max(-1.5, Math.min(1.5, st.elev + dy * 0.008));
      }
      umisti(); kresli();
    });
    const konec = (e) => { ukaz.delete(e.pointerId); if (ukaz.size < 2) pinch = 0; };
    cv.addEventListener('pointerup', konec); cv.addEventListener('pointercancel', konec);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      st.vzd = Math.max(st.polomer * 0.3, Math.min(st.polomer * 30, st.vzd * Math.exp(e.deltaY * 0.0012)));
      umisti(); kresli();
    }, { passive: false });

    function vychozi() {
      st.cil.copy(st.stred || new THREE.Vector3()); st.vzd = st.polomer * 3.2 / Math.min(1, kamera.aspect || 1); st.azim = -0.6; st.elev = 0.75; umisti(); kresli();
    }
    /** site: [{sit, x, y, barva}] */
    function nastav(site, volby) {
      volby = volby || {};
      for (const d of dily) { koren.remove(d.skupina); d.mesh.geometry.dispose(); d.mesh.material.dispose(); }
      dily = [];
      const barvy = [barvaZCss('--accent', '#6aa6fd'), barvaZCss('--warn', '#e0a63f')];
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, maxz = 0;
      site.forEach((s, i) => {
        const mat = new THREE.MeshStandardMaterial({ color: barvy[i % 2], metalness: 0.15, roughness: 0.55, flatShading: false });
        const mesh = new THREE.Mesh(geometrie(s.sit), mat);
        const sk = new THREE.Group(); sk.add(mesh); sk.position.set(s.x || 0, s.y || 0, 0);
        koren.add(sk); dily.push({ skupina: sk, mesh });
        minx = Math.min(minx, (s.x || 0) - s.R); maxx = Math.max(maxx, (s.x || 0) + s.R);
        miny = Math.min(miny, (s.y || 0) - s.R); maxy = Math.max(maxy, (s.y || 0) + s.R); maxz = Math.max(maxz, s.b);
      });
      const novyStred = new THREE.Vector3((minx + maxx) / 2, (miny + maxy) / 2, maxz / 2);
      const novyPolomer = Math.max(maxx - minx, maxy - miny, maxz) / 2;
      const zmenaRozsahu = !st.stred || Math.abs(novyPolomer - st.polomer) / st.polomer > 0.25 || volby.vychozi;
      st.stred = novyStred; st.polomer = novyPolomer;
      if (zmenaRozsahu) vychozi(); else { umisti(); kresli(); }
      velikost();
    }
    function natoc(uhly) { uhly.forEach((u, i) => { if (dily[i]) dily[i].skupina.rotation.z = u; }); kresli(); }
    function pozadi() { scena.background = barvaZCss('--bg-input', '#1e1e1e'); dily.forEach((d, i) => d.mesh.material.color = [barvaZCss('--accent', '#6aa6fd'), barvaZCss('--warn', '#e0a63f')][i % 2]); kresli(); }
    pozadi();
    new MutationObserver(pozadi).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    umisti(); velikost();
    return { nastav, natoc, vychozi, kresli };
  }
  window.Pohled3D = { vytvor };
})();
