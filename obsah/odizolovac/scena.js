/* ============================================================
   odizolovac/scena.js – 3D náhled (three.js r160, klasický skript).
   Souřadnice mm, Z nahoru. Těleso + čepele (kosodélníkové hranoly)
   + vodiče ležící ve drážkách. Tažení = otáčení, pravé tl./Shift =
   posun, kolečko / dva prsty = přiblížení. Kreslí se na vyžádání.
   ============================================================ */
window.ODIZ_SCENA = (function () {
  'use strict';
  let renderer = null, scene = null, camera = null, kont = null, svetla = null, mrizka = null, skupina = null;
  const kam = { az: -0.6, el: 0.55, dist: 150, cil: [0, 0, 0] };
  const ukazatele = new Map(); let pinch = null, pozadavek = 0;
  let velikost = 60, stred = [0, 0, 0];
  const volby = { pruhledne: false, rez: false, cepele: true, vodice: true };
  const rovinaRezu = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let posledni = null, stisk = 0, horniSkupina = null, listMesh = null;

  const css = (n, z) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || z;

  function init(el) {
    if (renderer) return;
    kont = el;
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.localClippingEnabled = true;
    const c = renderer.domElement;
    c.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', '3D model stahováku – tažením otáčejte, kolečkem přibližujte');
    el.appendChild(c);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
    camera.up.set(0, 0, 1);
    svetla = new THREE.Group();
    svetla.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.4));
    const s1 = new THREE.DirectionalLight(0xffffff, 1.8); svetla.add(s1);
    const s2 = new THREE.DirectionalLight(0xffffff, 0.5); s2.position.set(-1.5, 1, -0.5); svetla.add(s2);
    scene.add(svetla);
    skupina = new THREE.Group(); scene.add(skupina);
    tema();
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => { try { c.setPointerCapture(e.pointerId); } catch (x) { /* syntetická událost */ } ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY, posun: e.button === 2 || e.shiftKey }); pinch = null; });
    c.addEventListener('pointermove', e => {
      const u = ukazatele.get(e.pointerId);
      if (!u) return;
      const dx = e.clientX - u.x, dy = e.clientY - u.y;
      u.x = e.clientX; u.y = e.clientY;
      if (ukazatele.size === 1) {
        if (u.posun) posun(dx, dy);
        else { kam.az += dx * 0.008; kam.el = Math.max(-1.5, Math.min(1.5, kam.el + dy * 0.008)); }
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
  const omez = d => Math.max(velikost * 0.25, Math.min(velikost * 12, d));
  function posun(dx, dy) {
    const k = kam.dist * 0.0018;
    const pravo = [Math.cos(kam.az), -Math.sin(kam.az), 0];
    const nahoru = [Math.sin(kam.az) * Math.sin(kam.el), Math.cos(kam.az) * Math.sin(kam.el), Math.cos(kam.el)];
    for (let i = 0; i < 3; i++) kam.cil[i] += (-dx * pravo[i] + dy * nahoru[i]) * k;
  }
  function tema() {
    if (!scene) return;
    scene.background = new THREE.Color(css('--bg-input', '#1e1e1e'));
    if (mrizka) mrizka.material.color.set(document.documentElement.getAttribute('data-theme') === 'light' ? 0x9aa3ad : 0x6a717a);
  }

  function material(barva, o) {
    o = o || {};
    const m = new THREE.MeshStandardMaterial({ color: barva, roughness: o.kov ? 0.25 : 0.6, metalness: o.kov ? 0.85 : 0.04, side: THREE.DoubleSide });
    if (o.pruhledne) { m.transparent = true; m.opacity = o.opacity || 0.4; m.depthWrite = false; }
    if (volby.rez && !o.bezRezu) m.clippingPlanes = [rovinaRezu];
    return m;
  }
  function geometrieSite(sit) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sit.poz), 3));
    g.setIndex(new THREE.BufferAttribute(sit.idx, 1));
    const ne = g.toNonIndexed(); g.dispose();
    ne.computeVertexNormals();
    return ne;
  }
  /* kosodélníkový hranol čepele; osa 'X' = ostří podél X v rovině y = poloha */
  function cepelMesh(c, obrys) {
    const tvar = new THREE.Shape(obrys.map(([u, z]) => new THREE.Vector2(u, z)));
    const g = new THREE.ExtrudeGeometry(tvar, { depth: c.t, bevelEnabled: false });
    g.translate(0, 0, -c.t / 2);                       // (u, z, tloušťka)
    const m = new THREE.Mesh(g, material(0xc9cdd3, { kov: true }));
    // Matrix4.set bere řádky: obrys (u, z) a tloušťka → svět
    if (c.osa === 'X') m.matrix.set(1, 0, 0, 0, 0, 0, 1, c.poloha, 0, 1, 0, 0, 0, 0, 0, 1);         // u→x, z→z, tl→y
    else m.matrix.set(0, 0, 1, c.poloha, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);                        // u→y, z→z, tl→x
    m.matrixAutoUpdate = false;
    return m;
  }
  function vodicMesh(v) {
    const g = new THREE.Group(), delka = v.y1 - v.y0;
    if (v.profil === 'kruhX') {                                                  // kabel napříč čelistí (podél X)
      const dl = v.x1 - v.x0;
      const iz = new THREE.CylinderGeometry(v.D / 2, v.D / 2, dl, 48); iz.rotateZ(Math.PI / 2);
      const mi = new THREE.Mesh(iz, material(0x3b7fd9, { pruhledne: true, opacity: 0.55 }));
      mi.position.set((v.x0 + v.x1) / 2, v.yc, v.zDno + v.D / 2); g.add(mi);
      const jg = new THREE.CylinderGeometry(v.d / 2, v.d / 2, dl + 6, 32); jg.rotateZ(Math.PI / 2);
      const mj = new THREE.Mesh(jg, material(0x9aa0a8, { pruhledne: true, opacity: 0.7 }));
      mj.position.set((v.x0 + v.x1) / 2, v.yc, v.zDno + v.D / 2); g.add(mj);
      return g;
    }
    if (v.profil === 'kruh') {
      const iz = new THREE.CylinderGeometry(v.D / 2, v.D / 2, delka, 48, 1, false);   // osa válce = Y
      const mi = new THREE.Mesh(iz, material(0x3b7fd9, { pruhledne: true, opacity: 0.55 }));
      mi.position.set(v.xc, (v.y0 + v.y1) / 2, v.zDno + v.D / 2);
      g.add(mi);
      const jg = new THREE.CylinderGeometry(v.d / 2, v.d / 2, delka + 8, 24);
      const mj = new THREE.Mesh(jg, material(0xd08a3c, { kov: true }));
      mj.position.set(v.xc, (v.y0 + v.y1) / 2 + 4, v.zDno + v.D / 2);
      g.add(mj);
    } else {
      const iz = new THREE.BoxGeometry(v.S, delka, v.H);
      const mi = new THREE.Mesh(iz, material(0x9aa0a8, { pruhledne: true, opacity: 0.55 }));
      mi.position.set(v.xc, (v.y0 + v.y1) / 2, v.zDno + v.H / 2);
      g.add(mi);
    }
    return g;
  }

  function vycisti(g) {
    for (const o of [...g.children]) {
      g.remove(o);
      o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); });
    }
  }

  /* data: {sit, roz, obrysy[]}; zachovatKameru = při změně parametru neskákat */
  function nastavModel(data, zachovatKameru) {
    posledni = data;
    const prvni = !skupina.children.length;
    vycisti(skupina);
    horniSkupina = null; listMesh = null;
    if (data.dily) {
      // sešívačka: spodní díl pevně, horní rameno se natáčí podle stisku, list se ohýbá
      skupina.add(new THREE.Mesh(geometrieSite(data.dily.dolni), material(0xe0a040, { pruhledne: volby.pruhledne, opacity: 0.35 })));
      horniSkupina = new THREE.Group();
      horniSkupina.matrixAutoUpdate = false;
      horniSkupina.add(new THREE.Mesh(geometrieSite(data.dily.horni), material(0xc98b3a, { pruhledne: volby.pruhledne, opacity: 0.35 })));
      skupina.add(horniSkupina);
      const kl = data.roz.kloub, n = 64;
      const g = new THREE.BoxGeometry(kl.Bx, kl.tf, kl.L, 1, 1, n);
      g.translate(kl.Bx / 2, 0, kl.L / 2);
      g.userData.vychozi = Float32Array.from(g.attributes.position.array);
      listMesh = new THREE.Mesh(g, material(0x62b67a, {}));
      skupina.add(listMesh);
      if (volby.cepele) data.roz.cepele.forEach((c, i) => (c.dil === 'horni' ? horniSkupina : skupina).add(cepelMesh(c, data.obrysy[i])));
      nastavStisk(stisk, true);
    } else {
      const telo = new THREE.Mesh(geometrieSite(data.sit), material(0xe0a040, { pruhledne: volby.pruhledne, opacity: 0.35 }));
      skupina.add(telo);
      if (volby.cepele) data.roz.cepele.forEach((c, i) => skupina.add(cepelMesh(c, data.obrysy[i])));
    }
    if (volby.vodice) data.roz.vodice.forEach(v => skupina.add(vodicMesh(v)));
    const r = data.roz.rozmery;
    velikost = Math.max(r.x, r.y, r.z);
    stred = [r.x / 2, r.y / 2, r.z / 2];
    if (mrizka) { scene.remove(mrizka); mrizka.geometry.dispose(); mrizka.material.dispose(); }
    const s = Math.ceil(velikost * 1.8 / 10) * 10;
    mrizka = new THREE.GridHelper(s, s / 5, 0x666666, 0x666666);
    mrizka.rotation.x = Math.PI / 2;
    mrizka.position.set(stred[0], stred[1], -0.05);
    mrizka.material.transparent = true; mrizka.material.opacity = 0.5;
    scene.add(mrizka);
    tema();
    const c0 = data.roz.cepele[0];
    if (c0 && c0.osa === 'X') { rovinaRezu.normal.set(0, 1, 0); rovinaRezu.constant = -c0.poloha; }
    else if (c0) { rovinaRezu.normal.set(1, 0, 0); rovinaRezu.constant = -c0.poloha; }
    if (prvni || !zachovatKameru) { kam.cil = stred.slice(); kam.dist = velikost * 2.8; }
    vykresli();
  }
  /* Stisk sešívačky 0 (tisková poloha, rozevřeno) … 1 (čelisti sevřené). Model listu: oblouk stálé křivosti. */
  function nastavStisk(s, bezKresleni) {
    stisk = Math.max(0, Math.min(1, s));
    if (!horniSkupina || !posledni) return;
    const kl = posledni.roz.kloub, phi = kl.th * stisk;
    const tip = window.ODIZ.bodOblouku(kl, phi, kl.L), a = phi - kl.th, ca = Math.cos(a), sa = Math.sin(a);
    // p' = tip + R(a)(p − Tc) v rovině YZ
    const ty = tip[0] - (ca * kl.Tc[0] - sa * kl.Tc[1]), tz = tip[1] - (sa * kl.Tc[0] + ca * kl.Tc[1]);
    horniSkupina.matrix.set(1, 0, 0, 0, 0, ca, -sa, ty, 0, sa, ca, tz, 0, 0, 0, 1);
    horniSkupina.matrixWorldNeedsUpdate = true;
    const at = listMesh.geometry.attributes.position, v0 = listMesh.geometry.userData.vychozi;
    for (let i = 0; i < at.count; i++) {
      const x = v0[i * 3], o = v0[i * 3 + 1], b = window.ODIZ.bodOblouku(kl, phi, v0[i * 3 + 2], o);
      at.array[i * 3] = x; at.array[i * 3 + 1] = b[0]; at.array[i * 3 + 2] = b[1];
    }
    at.needsUpdate = true;
    listMesh.geometry.computeVertexNormals();
    listMesh.geometry.computeBoundingSphere();
    if (!bezKresleni) vykresli();
  }
  function nastavVolby(v) {
    Object.assign(volby, v);
    if (posledni) nastavModel(posledni, true);
  }
  function pohled(druh) {
    const P = { iso: [-0.6, 0.55], predni: [0, 0.02], bocni: [-Math.PI / 2, 0.02], shora: [0, 1.5] }[druh] || [-0.6, 0.55];
    kam.az = P[0]; kam.el = P[1]; kam.cil = stred.slice(); kam.dist = velikost * 2.8;
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
    camera.position.set(kam.cil[0] - kam.dist * ce * Math.sin(kam.az), kam.cil[1] - kam.dist * ce * Math.cos(kam.az), kam.cil[2] + kam.dist * Math.sin(kam.el));
    camera.near = Math.max(0.1, kam.dist / 200); camera.far = kam.dist * 50;
    camera.updateProjectionMatrix();
    camera.lookAt(kam.cil[0], kam.cil[1], kam.cil[2]);
    svetla.children[1].position.set(camera.position.x - kam.cil[0] + kam.dist * 0.3, camera.position.y - kam.cil[1], camera.position.z - kam.cil[2] + kam.dist * 0.6);
    renderer.render(scene, camera);
  }
  return { init, nastavModel, nastavVolby, nastavStisk, pohled, vykresli, kresli };
})();
