/* ============================================================
   panty/scena.js – 3D náhled (three.js r160, klasický skript).
   Souřadnice modelu: mm, Z nahoru (kamera má up = Z).
   Vlastní jednoduché ovládání kamery: tažení = otáčení, pravé
   tlačítko / Shift = posun, kolečko / dva prsty = přiblížení.
   Kreslí se jen na vyžádání (žádná trvalá smyčka – tu řídí animace v UI).
   ============================================================ */
window.PANTY_SCENA = (function () {
  'use strict';
  let renderer = null, scene = null, camera = null, kont = null, svetla = null, mrizka = null;
  let skupina = null, kolizni = null, pasekMesh = null;
  const kam = { az: -0.75, el: 0.5, dist: 120, cil: [0, 0, 0] };
  const ukazatele = new Map(); let pinch = null, pozadavek = 0;
  let model = null, pohybliveMeshe = [], volby = { rez: false, pruhledne: false };
  const rovinaRezu = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

  function css(nazev, nahrada) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nazev).trim();
    return v || nahrada;
  }

  function init(el) {
    if (renderer) return;
    kont = el;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.localClippingEnabled = true;
    const c = renderer.domElement;
    c.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', '3D model kloubu – tažením otáčejte, kolečkem přibližujte, pravým tlačítkem posouvejte');
    c.addEventListener('webglcontextlost', e => { e.preventDefault(); el.dispatchEvent(new CustomEvent('scenachyba', { detail: 'Grafický kontext WebGL byl ztracen – obnovte stránku.' })); });
    c.addEventListener('webglcontextrestored', () => { el.dispatchEvent(new CustomEvent('scenaobnovena')); vykresli(); });
    el.appendChild(c);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
    camera.up.set(0, 0, 1);
    svetla = new THREE.Group();
    svetla.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.5));
    const s1 = new THREE.DirectionalLight(0xffffff, 1.7); s1.position.set(1, -1.4, 2); svetla.add(s1);
    const s2 = new THREE.DirectionalLight(0xffffff, 0.5); s2.position.set(-1.5, 1, -0.5); svetla.add(s2);
    scene.add(svetla);
    skupina = new THREE.Group(); scene.add(skupina);
    tema();

    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY, posun: e.button === 2 || e.shiftKey }); pinch = null; });
    c.addEventListener('pointermove', e => {
      const u = ukazatele.get(e.pointerId);
      if (!u) return;
      const dx = e.clientX - u.x, dy = e.clientY - u.y;
      u.x = e.clientX; u.y = e.clientY;
      if (ukazatele.size === 1) {
        if (u.posun) posun(dx, dy);
        else { kam.az -= dx * 0.008; kam.el = Math.max(-1.5, Math.min(1.5, kam.el + dy * 0.008)); }
      } else if (ukazatele.size === 2) {
        const [a, b] = [...ukazatele.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) kam.dist = omez(kam.dist * pinch / d);
        pinch = d;
      }
      vykresli();
    });
    const konec = e => { ukazatele.delete(e.pointerId); pinch = null; };
    c.addEventListener('pointerup', konec); c.addEventListener('pointercancel', konec);
    c.addEventListener('wheel', e => { e.preventDefault(); kam.dist = omez(kam.dist * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0012))); vykresli(); }, { passive: false });
    new ResizeObserver(() => vykresli()).observe(el);
    new MutationObserver(() => { tema(); vykresli(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  const omez = d => Math.max(model ? model.velikost * 0.2 : 5, Math.min(model ? model.velikost * 12 : 5000, d));
  function posun(dx, dy) {
    const k = kam.dist * 0.0018;
    const pravo = [Math.cos(kam.az), -Math.sin(kam.az), 0];
    const nahoru = [Math.sin(kam.az) * Math.sin(kam.el), Math.cos(kam.az) * Math.sin(kam.el), Math.cos(kam.el)];
    for (let i = 0; i < 3; i++) kam.cil[i] += (-dx * pravo[i] + dy * nahoru[i]) * k;
  }
  function tema() {
    if (!scene) return;
    scene.background = new THREE.Color(css('--bg-input', '#1e1e1e'));
    if (mrizka) { const svetle = document.documentElement.getAttribute('data-theme') === 'light'; mrizka.material.color.set(svetle ? 0x9aa3ad : 0x6a717a); }
  }

  function material(barva) {
    const m = new THREE.MeshStandardMaterial({ color: barva, roughness: 0.62, metalness: 0.04, flatShading: false, side: THREE.DoubleSide });
    if (volby.pruhledne) { m.transparent = true; m.opacity = 0.45; m.depthWrite = false; }
    if (volby.rez) m.clippingPlanes = [rovinaRezu];
    return m;
  }
  /* Geometrie ze sítě {poz, idx} s plochým stínováním (ostré hrany zůstanou ostré). */
  function geometrie(sit) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sit.poz), 3));
    g.setIndex(new THREE.BufferAttribute(sit.idx, 1));
    const ne = g.toNonIndexed();
    g.dispose();
    ne.computeVertexNormals();
    return ne;
  }

  /* Nový model: dily (sítě + barvy + role), pasek pro pružný spoj, stred a velikost pro kameru. */
  function nastavModel(m, site, zachovatKameru) {
    const prvni = !model;
    model = m;
    vycisti(skupina);
    pohybliveMeshe = []; pasekMesh = null; kolizni = null;
    m.dily.forEach((d, i) => {
      const mesh = new THREE.Mesh(geometrie(site[i]), material(d.barva));
      mesh.matrixAutoUpdate = false;
      mesh.userData.role = d.role;
      skupina.add(mesh);
      if (d.role === 'pohyblivy') pohybliveMeshe.push(mesh);
    });
    if (m.pasek) {
      const q = m.pasek, g = new THREE.BoxGeometry(q.L, q.Lf, q.tf, Math.max(1, Math.round(q.L / 6)), 24, 1);
      g.translate(q.L / 2, q.Lf / 2, q.tf / 2);
      g.userData.vychozi = Float32Array.from(g.attributes.position.array);
      pasekMesh = new THREE.Mesh(g, material(q.barva));
      skupina.add(pasekMesh);
    }
    // mřížka pod modelem (podložka)
    if (mrizka) { scene.remove(mrizka); mrizka.geometry.dispose(); mrizka.material.dispose(); }
    const s = Math.ceil(m.velikost * 1.6 / 10) * 10;
    mrizka = new THREE.GridHelper(s, s / 5, 0x666666, 0x666666);
    mrizka.rotation.x = Math.PI / 2;
    const zmin = Math.min(...site.map(x => { let z = Infinity; for (let i = 2; i < x.poz.length; i += 3) z = Math.min(z, x.poz[i]); return z; }));
    mrizka.position.set(m.stred[0], m.stred[1], zmin - 0.05);
    mrizka.material.transparent = true; mrizka.material.opacity = 0.55;
    scene.add(mrizka);
    tema();
    rovinaRezu.constant = m.rezim === 'kulovy' ? 0 : m.stred[0];
    rovinaRezu.normal.set(m.rezim === 'kulovy' ? 0 : -1, m.rezim === 'kulovy' ? -1 : 0, 0);
    if (prvni || !zachovatKameru) { kam.cil = m.stred.slice(); kam.dist = m.velikost * 2.6; }
  }
  function vycisti(g) {
    for (const o of [...g.children]) { g.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }
  }

  /* Poloha pohyblivých dílů (matice 4×4 po sloupcích) a ohnutí pásku. */
  function nastavPolohu(matice, pasekBod) {
    const M = new THREE.Matrix4().fromArray(matice);
    for (const mesh of pohybliveMeshe) { mesh.matrix.copy(M); mesh.matrixWorldNeedsUpdate = true; }
    if (pasekMesh && pasekBod) {
      const a = pasekMesh.geometry.attributes.position, v0 = pasekMesh.geometry.userData.vychozi;
      for (let i = 0; i < a.count; i++) {
        const b = pasekBod([v0[i * 3], v0[i * 3 + 1], v0[i * 3 + 2]]);
        a.array[i * 3] = b[0]; a.array[i * 3 + 1] = b[1]; a.array[i * 3 + 2] = b[2];
      }
      a.needsUpdate = true;
      pasekMesh.geometry.computeVertexNormals();
      pasekMesh.geometry.computeBoundingSphere();
    }
  }
  /* Červeně zvýrazněný průnik (pole sítí), přes ostatní díly. */
  function nastavKolizi(site) {
    if (kolizni) { skupina.remove(kolizni); vycisti(kolizni); kolizni = null; }
    if (!site || !site.length) return;
    kolizni = new THREE.Group();
    for (const s of site) {
      const m = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometrie(s), m);
      mesh.renderOrder = 10;
      kolizni.add(mesh);
    }
    skupina.add(kolizni);
  }
  function nastavVolby(v) {
    Object.assign(volby, v);
    for (const o of skupina.children) if (o.isMesh) {
      const b = o.material.color.getHex(); o.material.dispose(); o.material = material(b);
    }
    vykresli();
  }
  function pohled(druh) {
    if (!model) return;
    const P = { iso: [-0.75, 0.5], predni: [-Math.PI / 2, 0.02], bocni: [0, 0.02], shora: [-Math.PI / 2, 1.5] }[druh] || [-0.75, 0.5];
    kam.az = P[0]; kam.el = P[1]; kam.cil = model.stred.slice(); kam.dist = model.velikost * 2.6;
    vykresli();
  }

  function vykresli() {
    if (!renderer || pozadavek) return;
    pozadavek = requestAnimationFrame(kresli);
  }
  function kresli() {
    pozadavek = 0;
    const w = kont.clientWidth, h = kont.clientHeight;
    if (!w || !h) return;
    const vel = renderer.getSize(new THREE.Vector2());
    if (vel.x !== w || vel.y !== h) renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const ce = Math.cos(kam.el);
    camera.position.set(kam.cil[0] + kam.dist * ce * Math.sin(kam.az) * -1, kam.cil[1] - kam.dist * ce * Math.cos(kam.az), kam.cil[2] + kam.dist * Math.sin(kam.el));
    camera.near = Math.max(0.1, kam.dist / 200); camera.far = kam.dist * 50;
    camera.updateProjectionMatrix();
    camera.lookAt(kam.cil[0], kam.cil[1], kam.cil[2]);
    svetla.children[1].position.set(camera.position.x - kam.cil[0] + kam.dist * 0.3, camera.position.y - kam.cil[1], camera.position.z - kam.cil[2] + kam.dist * 0.6);
    renderer.render(scene, camera);
  }
  /* Snímek plátna jako dataURL (pro test a uložení obrázku). */
  function snimek() { kresli(); return renderer.domElement.toDataURL('image/png'); }

  return { init, nastavModel, nastavPolohu, nastavKolizi, nastavVolby, pohled, vykresli, snimek };
})();
