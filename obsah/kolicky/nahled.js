/* Kolíčky na prádlo – 3D náhled (three.js r128): otáčení tažením / jedním prstem, posun pravým tlačítkem / Shift / dvěma prsty, kolečko = zoom.
   Sestava = kolíček s pružinou, šňůrou a tyčí (duchové), lze ho pootevřít (rozevreni 0–1);
   tisková poloha = díly na podložce, převisy barevně. */
/* global THREE */
(function () {
  'use strict';
  // souřadnice kolíčku (x délka, y rozevření, z šířka) → scéna se z nahoru: (x, −z, y)
  const MONTAZ = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  const VZHLEDY = {
    plast: { nazev: 'barva tisku', barvy: { horni: 0x3f7bd6, dolni: 0x5d8fdc, pruzina: 0x3fae6a, cep: 0x9aa3ad, kov: 0xb9c0c7 }, kov: 0.05, drsnost: 0.42 },
    drevo: { nazev: 'dřevo (bříza)', barvy: { horni: 0xd9b382, dolni: 0xd2aa78, pruzina: 0xc79c62, cep: 0xb0b6bb, kov: 0xb9c0c7 }, kov: 0.0, drsnost: 0.75 },
    pastel: { nazev: 'pastelové barvy', barvy: { horni: 0xf29bb4, dolni: 0x8fd3c7, pruzina: 0xf5d376, cep: 0xc9ced3, kov: 0xb9c0c7 }, kov: 0.02, drsnost: 0.5 },
    bila: { nazev: 'bílá', barvy: { horni: 0xf1f1ee, dolni: 0xe6e6e2, pruzina: 0xd6d6d2, cep: 0xc9ced3, kov: 0xb9c0c7 }, kov: 0.02, drsnost: 0.5 },
    cerna: { nazev: 'černá matná', barvy: { horni: 0x2b2d31, dolni: 0x34363b, pruzina: 0x4a4d52, cep: 0x8f979f, kov: 0xb9c0c7 }, kov: 0.3, drsnost: 0.6 },
  };
  const BARVA_TRIDY = [null, [0.85, 0.66, 0.2], [0.86, 0.22, 0.2], null];
  const DUCH = { kov: [0xb9c0c7, 0.95, 0.3, 1], guma: [0x2b2b2b, 0, 0.8, 1], snura: [0xe7dcc4, 0, 0.9, 0.55], tyc: [0x9a7b55, 0.1, 0.6, 0.35], magnet: [0x6b7178, 0.8, 0.35, 1] };

  function vytvorNahled(kontejner) {
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true }); } catch (e) { return null; }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    kontejner.appendChild(renderer.domElement);
    const platno = renderer.domElement;
    Object.assign(platno.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
    platno.tabIndex = 0;
    platno.setAttribute('aria-label', '3D náhled kolíčku – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');

    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
    kamera.up.set(0, 0, 1);
    scena.add(new THREE.HemisphereLight(0xf4f7ff, 0x3a4048, 0.6));
    const sv1 = new THREE.DirectionalLight(0xffffff, 0.75); sv1.position.set(1.2, -1.6, 2.2); kamera.add(sv1);
    const sv2 = new THREE.DirectionalLight(0xdfe8ff, 0.3); sv2.position.set(-1.8, 0.4, 0.8); kamera.add(sv2);
    const sv3 = new THREE.DirectionalLight(0xffffff, 0.35); sv3.position.set(0.3, 2, -1); kamera.add(sv3);
    scena.add(kamera);
    const matDil = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.28 });
    const matDuch = {};
    for (const [k, [c, kov, dr, op]] of Object.entries(DUCH)) matDuch[k] = new THREE.MeshStandardMaterial({ color: c, metalness: kov, roughness: dr, transparent: op < 1, opacity: op, depthWrite: op >= 1 });
    // volná pružina (bez předpětí): průsvitně oranžová přes sestavu
    const matVolne = new THREE.MeshStandardMaterial({ color: 0xff8a3d, metalness: 0.1, roughness: 0.6, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });
    const skupina = new THREE.Group(); scena.add(skupina);
    let objekty = [], mrizka = null, model = null, prvni = true, posledniKlic = null;
    const tema = { mrizka: 0x888888, mrizka2: 0x555555 };
    const stav = { duchove: true, tisk: false, hrany: true, previsy: true, vzhled: 'plast', rozevreni: 0, volne: false, rozpad: 0, meritko: true };
    let pravitko = null;

    function barvy(cara, cara2, hrana) {
      if (hrana) { matHrany.color.set(hrana); tema.text = hrana; }
      tema.mrizka = new THREE.Color(cara).getHex(); tema.mrizka2 = new THREE.Color(cara2).getHex();
      if (mrizka) mrizka.material.color.setHex(tema.mrizka2);
      prekresli();
    }
    /** Normály s lomem (ostré hrany zůstanou ostré) a barva po trojúhelnících. */
    function geometrie(poz, idx, tridy, zaklad) {
      const nT = idx.length / 3, fn = new Float32Array(3 * nT), nV = poz.length / 3, kos = Math.cos(32 * Math.PI / 180);
      const sous = Array.from({ length: nV }, () => []);
      for (let t = 0; t < nT; t++) {
        const a = idx[3 * t], b = idx[3 * t + 1], c = idx[3 * t + 2];
        const ux = poz[3 * b] - poz[3 * a], uy = poz[3 * b + 1] - poz[3 * a + 1], uz = poz[3 * b + 2] - poz[3 * a + 2];
        const vx = poz[3 * c] - poz[3 * a], vy = poz[3 * c + 1] - poz[3 * a + 1], vz = poz[3 * c + 2] - poz[3 * a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
        fn[3 * t] = nx / l; fn[3 * t + 1] = ny / l; fn[3 * t + 2] = nz / l;
        sous[a].push(t); sous[b].push(t); sous[c].push(t);
      }
      const P = new Float32Array(9 * nT), N = new Float32Array(9 * nT), C = new Float32Array(9 * nT);
      for (let t = 0; t < nT; t++) {
        const bv = (tridy && stav.previsy && BARVA_TRIDY[tridy[t]]) || zaklad;
        for (let k = 0; k < 3; k++) {
          const v = idx[3 * t + k], o = 9 * t + 3 * k;
          let nx = 0, ny = 0, nz = 0;
          for (const f of sous[v]) if (fn[3 * f] * fn[3 * t] + fn[3 * f + 1] * fn[3 * t + 1] + fn[3 * f + 2] * fn[3 * t + 2] >= kos) { nx += fn[3 * f]; ny += fn[3 * f + 1]; nz += fn[3 * f + 2]; }
          const l = Math.hypot(nx, ny, nz) || 1;
          N[o] = nx / l; N[o + 1] = ny / l; N[o + 2] = nz / l;
          P[o] = poz[3 * v]; P[o + 1] = poz[3 * v + 1]; P[o + 2] = poz[3 * v + 2];
          C[o] = bv[0]; C[o + 1] = bv[1]; C[o + 2] = bv[2];
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      g.setAttribute('color', new THREE.BufferAttribute(C, 3));
      return g;
    }
    function trubka(d) {
      const body = d.body.map(b => new THREE.Vector3(b[0], b[1], b[2]));
      if (body.length === 2 && !d.uzavrena) {
        const g = new THREE.CylinderGeometry(d.r, d.r, body[0].distanceTo(body[1]), 24, 1);
        const m = new THREE.Mesh(g, matDuch[d.druh]);
        m.position.copy(body[0]).add(body[1]).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), body[1].clone().sub(body[0]).normalize());
        m.updateMatrix();
        return { g, matice: m.matrix.clone() };
      }
      const krivka = new THREE.CatmullRomCurve3(body, !!d.uzavrena, 'centripetal', 0.3);
      return { g: new THREE.TubeGeometry(krivka, Math.max(16, body.length * 6), d.r, 10, !!d.uzavrena), matice: new THREE.Matrix4() };
    }

    const ovl = { cil: new THREE.Vector3(), vzd: 300, azimut: -1.2, elevace: 0.4 };
    let ceka = false;
    function prekresli() { if (ceka) return; ceka = true; requestAnimationFrame(() => { ceka = false; snimek(); }); }
    function snimek() {
      const ce = Math.cos(ovl.elevace);
      kamera.position.set(ovl.cil.x + ovl.vzd * ce * Math.cos(ovl.azimut), ovl.cil.y + ovl.vzd * ce * Math.sin(ovl.azimut), ovl.cil.z + ovl.vzd * Math.sin(ovl.elevace));
      kamera.lookAt(ovl.cil);
      kamera.near = Math.max(0.1, ovl.vzd / 200); kamera.far = ovl.vzd * 30 + 2000; kamera.updateProjectionMatrix();
      renderer.render(scena, kamera);
    }
    function velikost() {
      const w = kontejner.clientWidth, h = kontejner.clientHeight;
      if (!w || !h) return;                                // skrytý (skicář) – nechat poslední velikost
      renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); snimek();
    }
    new ResizeObserver(velikost).observe(kontejner);

    /** Popisek pravítka: text na plátně jako sprite (velikost v mm). */
    function popisek(text, vyska) {
      const c = document.createElement('canvas'), g = c.getContext('2d');
      c.width = 256; c.height = 96;
      g.font = '600 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = tema.text || '#888'; g.fillText(text, 128, 50);
      const tx = new THREE.CanvasTexture(c);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false }));
      sp.scale.set(vyska * 256 / 96, vyska, 1);
      return sp;
    }
    /** Měřítko: pravítko v mm před kolíčkem (v tiskové poloze na podložce). */
    function postavPravitko() {
      if (pravitko) { skupina.remove(pravitko); pravitko.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); } }); pravitko = null; }
      if (!model || !stav.meritko) return;
      const b = new THREE.Box3();
      for (const o of objekty) if (!o.userData.hrany && !o.userData.okoli && !o.userData.volne && !o.userData.duch) { o.updateMatrixWorld(true); b.expandByObject(o); }
      if (b.isEmpty()) return;
      const x0 = Math.floor(b.min.x / 10) * 10, x1 = Math.ceil(b.max.x / 10) * 10, delka = x1 - x0;
      const y = b.min.y - (stav.tisk ? 8 : 6), z = stav.tisk ? 0.05 : b.min.z, jemne = delka <= 160 ? 1 : 5;
      const P = [x0, y, z, x1, y, z];
      for (let x = x0; x <= x1 + 1e-9; x += jemne) {
        const r = Math.round(x - x0), l = r % 10 === 0 ? 3 : r % 5 === 0 ? 2 : 1.1;
        P.push(x, y, z, x, y + l, z);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      pravitko = new THREE.Group();
      pravitko.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(tema.text || '#888'), transparent: true, opacity: 0.85 })));
      const krokPopisku = delka > 200 ? 50 : delka > 100 ? 20 : 10, vys = Math.max(3.4, delka / 26);
      for (let x = x0; x <= x1 + 1e-9; x += krokPopisku) { const sp = popisek(String(Math.round(x - x0)), vys); sp.position.set(x, y - vys * 0.75, z); pravitko.add(sp); }
      const mm = popisek('mm', vys); mm.position.set(x1 + vys * 1.6, y, z); pravitko.add(mm);
      skupina.add(pravitko);
    }
    function uklid() {
      for (const o of objekty) { skupina.remove(o); o.traverse(c => { if (c.geometry) c.geometry.dispose(); }); }
      if (mrizka) { skupina.remove(mrizka); mrizka.geometry.dispose(); mrizka.material.dispose(); }
      objekty = []; mrizka = null;
    }
    /** Matice pohybu dílu při rozevření θ (v souřadnicích kolíčku). */
    function pohyb(otoc) {
      const m = model, th = stav.tisk || !m ? 0 : stav.rozevreni * (m.thetaMax || 0), xp = m ? m.xp : 0;
      const kolem = (x, y, a) => new THREE.Matrix4().makeTranslation(x, y, 0).multiply(new THREE.Matrix4().makeRotationZ(a)).multiply(new THREE.Matrix4().makeTranslation(-x, -y, 0));
      const meritkoY = (yc, f) => new THREE.Matrix4().makeTranslation(0, yc, 0).multiply(new THREE.Matrix4().makeScale(1, f, 1)).multiply(new THREE.Matrix4().makeTranslation(0, -yc, 0));
      if (otoc === 'horni') return kolem(xp, 0, -th / 2);
      if (otoc === 'dolni') return kolem(xp, 0, th / 2);
      const pr = m && m.pruzina;
      if (otoc === 'jazyk' && pr) return kolem(xp, 0, th / 2).multiply(kolem(pr.xr, pr.y0, -Math.atan2(th * (pr.xk - xp), pr.L)));
      if (otoc === 'pasek' && pr) { const c = pr.c > 0 ? -1 : 1; return kolem(xp, 0, c * th / 2).multiply(kolem(pr.xr, pr.y0, c * Math.atan2(th * (pr.xk - xp), pr.L))); }
      if (otoc === 'vpruz' && pr) return meritkoY(0, Math.max(0.05, 1 - th * (pr.xk - xp) / Math.max(0.1, pr.yu - pr.yl)));
      if (otoc === 'had' && pr) return meritkoY((pr.yu + pr.yl) / 2, Math.max(0.05, 1 - th * (pr.xk - xp) / Math.max(0.1, pr.vyska)));
      return new THREE.Matrix4();
    }
    /** Rozpad na díly: ramena od sebe, čep do strany, pružina ven z kolíčku. */
    function rozpadPosun(klic) {
      const f = stav.tisk || !model ? 0 : stav.rozpad, Wm = (model && model.W) || 10, d = f * Math.max(12, 1.6 * Wm);
      const v = { horni: [0, d, 0], dolni: [0, -d, 0], cep: [0, 0, 1.8 * f * Wm + f * 10], pruzina: [0, 0, -1.6 * f * Wm - f * 8], kov: [0, 0, -1.6 * f * Wm - f * 8] }[klic] || [0, 0, 0];
      return new THREE.Matrix4().makeTranslation(v[0], v[1], v[2]);
    }
    function polohy() {
      for (const o of objekty) {
        if (!o.userData.otoc) continue;
        if (o.userData.okoli) o.visible = stav.duchove && stav.rozpad < 0.05;
        o.matrix.copy(MONTAZ).multiply(rozpadPosun(o.userData.rozpad)).multiply(pohyb(o.userData.otoc));
        if (o.userData.vlastni) o.matrix.multiply(o.userData.vlastni);
      }
    }
    /** m = {sestava: [{poz, idx, role, otoc}], tisk: [{poz, idx, tridy, role}], duchove: [...], klic, xp, thetaMax, pruzina} nebo null */
    function nastav(m) {
      // kamera se vrací na izometrii jen při jiném druhu kolíčku – ne po chvilkově neplatném modelu (rozepsané číslo)
      const zmena = !!m && m.klic !== posledniKlic;
      if (m) posledniKlic = m.klic;
      model = m;
      sestav();
      if (m && (prvni || zmena)) { pohled('iso'); prvni = false; }
    }
    const rgb = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    function sestav() {
      uklid();
      const m = model;
      if (!m) { postavPravitko(); prekresli(); return; }
      const vz = VZHLEDY[stav.vzhled] || VZHLEDY.plast;
      matDil.metalness = vz.kov; matDil.roughness = vz.drsnost; matDil.needsUpdate = true;
      for (const d of stav.tisk ? m.tisk : m.sestava) {
        const zaklad = rgb(vz.barvy[d.role] || vz.barvy.horni);
        const mesh = new THREE.Mesh(geometrie(d.poz, d.idx, stav.tisk ? d.tridy : null, zaklad), matDil);
        const gi = new THREE.BufferGeometry();
        gi.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); gi.setIndex(new THREE.BufferAttribute(d.idx, 1));
        const h = new THREE.LineSegments(new THREE.EdgesGeometry(gi, 32), matHrany); gi.dispose();
        h.visible = stav.hrany; h.userData.hrany = true;
        // díl, se kterým se kus pohybuje při rozpadu (jazýček patří k dolnímu ramenu, oblouk k nosnému)
        const rk = d.otoc === 'jazyk' ? 'dolni' : d.role;
        if (!stav.tisk) for (const o of [mesh, h]) { o.matrixAutoUpdate = false; o.userData.otoc = d.otoc || 'stred'; o.userData.rozpad = rk; }
        skupina.add(mesh, h); objekty.push(mesh, h);
      }
      if (!stav.tisk) for (const d of m.duchove) {
        const t = trubka(d), o = new THREE.Mesh(t.g, matDuch[d.druh] || matDuch.kov);
        o.matrixAutoUpdate = false; o.userData.otoc = d.otoc || 'stred'; o.userData.vlastni = t.matice;
        o.renderOrder = 2; o.visible = stav.duchove; o.userData.duch = true; o.userData.okoli = d.druh === 'snura' || d.druh === 'tyc';
        o.userData.rozpad = d.druh === 'kov' || d.druh === 'guma' ? 'kov' : d.druh === 'magnet' ? d.otoc : 'stred';
        skupina.add(o); objekty.push(o);
      }
      if (!stav.tisk) {
        for (const d of m.volne || []) {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); g.setIndex(new THREE.BufferAttribute(d.idx, 1)); g.computeVertexNormals();
          const o = new THREE.Mesh(g, matVolne);
          o.matrixAutoUpdate = false; o.renderOrder = 3; o.visible = stav.volne;
          Object.assign(o.userData, { otoc: d.otoc, volne: true, rozpad: d.otoc === 'horni' || d.otoc === 'dolni' ? d.otoc : 'pruzina' });
          skupina.add(o); objekty.push(o);
        }
        for (const d of m.volneDuchove || []) {
          const t = trubka(d), o = new THREE.Mesh(t.g, matVolne);
          o.matrixAutoUpdate = false; o.renderOrder = 3; o.visible = stav.volne;
          Object.assign(o.userData, { otoc: d.otoc || 'stred', vlastni: t.matice, volne: true, rozpad: 'kov' });
          skupina.add(o); objekty.push(o);
        }
      }
      if (!stav.tisk) polohy();
      postavPravitko();
      if (stav.tisk) {
        const b = new THREE.Box3();
        for (const o of objekty) if (!o.userData.hrany) b.expandByObject(o);
        const vel = new THREE.Vector3(); b.getSize(vel);
        const n = Math.ceil(Math.max(vel.x, vel.y, 100) * 1.25 / 10);
        mrizka = new THREE.GridHelper(n * 10, n, tema.mrizka, tema.mrizka2);
        mrizka.rotation.x = Math.PI / 2; mrizka.position.z = -0.02;
        mrizka.material.transparent = true; mrizka.material.opacity = 0.4;
        skupina.add(mrizka);
      }
      prekresli();
    }
    function pohled(jak) {
      const b = new THREE.Box3();
      for (const o of objekty) if (!o.userData.hrany && !o.userData.okoli && !o.userData.volne && o.visible) { o.updateMatrixWorld(true); b.expandByObject(o); }
      if (b.isEmpty()) return;
      if (pravitko) { pravitko.updateMatrixWorld(true); b.expandByObject(pravitko.children[0]); }
      const koule = new THREE.Sphere();
      b.getCenter(ovl.cil); b.getBoundingSphere(koule);
      const vf = kamera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * kamera.aspect);
      ovl.vzd = koule.radius / Math.sin(Math.min(vf, hf) / 2) * 1.05;
      if (jak === 'shora') { ovl.azimut = -Math.PI / 2; ovl.elevace = Math.PI / 2 - 1e-3; }
      else if (jak === 'zboku') { ovl.azimut = -Math.PI / 2; ovl.elevace = 0.02; }
      else if (jak === 'zepredu') { ovl.azimut = Math.PI; ovl.elevace = 0.02; }
      else if (stav.tisk) { ovl.azimut = -1.2; ovl.elevace = 0.75; }
      else { ovl.azimut = -1.95; ovl.elevace = 0.5; }
      prekresli();
    }
    function prepni(co, h) {
      stav[co] = h;
      if (co === 'tisk' || co === 'previsy' || co === 'vzhled') { sestav(); if (co === 'tisk') pohled('iso'); return; }
      if (co === 'rozevreni' || co === 'rozpad') { polohy(); prekresli(); return; }
      if (co === 'meritko') { postavPravitko(); prekresli(); return; }
      for (const o of objekty) o.visible = o.userData.volne ? stav.volne : o.userData.hrany ? stav.hrany : (!o.userData.duch || stav.duchove) && !(o.userData.okoli && stav.rozpad >= 0.05);
      prekresli();
    }

    // myš a dotyk
    const ukaz = new Map(); let start = null;
    platno.addEventListener('pointerdown', e => {
      try { platno.setPointerCapture(e.pointerId); } catch (err) { /* syntetická událost */ }
      ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      start = { posun: e.button === 2 || e.shiftKey, vzd: ovl.vzd, roz: null };
      if (ukaz.size === 2) { const [a, b] = [...ukaz.values()]; start.roz = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    });
    const posunPohled = (dx, dy) => {
      const k = ovl.vzd / platno.clientHeight * 0.8, prave = new THREE.Vector3(), nahoru = new THREE.Vector3();
      kamera.matrixWorld.extractBasis(prave, nahoru, new THREE.Vector3());
      ovl.cil.addScaledVector(prave, -dx * k).addScaledVector(nahoru, dy * k);
    };
    platno.addEventListener('pointermove', e => {
      if (!ukaz.has(e.pointerId) || !start) return;
      const pred = ukaz.get(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 2 && start.roz) {
        const [a, b] = [...ukaz.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        ovl.vzd = start.vzd * start.roz / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]));
        if (start.mid) posunPohled(mid[0] - start.mid[0], mid[1] - start.mid[1]);
        start.mid = mid; prekresli(); return;
      }
      const dx = e.clientX - pred[0], dy = e.clientY - pred[1];
      if (start.posun) posunPohled(dx, dy);
      else { ovl.azimut -= dx * 0.008; ovl.elevace = Math.max(-1.55, Math.min(1.55, ovl.elevace + dy * 0.008)); }
      prekresli();
    });
    const konec = e => { ukaz.delete(e.pointerId); if (!ukaz.size) start = null; };
    platno.addEventListener('pointerup', konec); platno.addEventListener('pointercancel', konec);
    platno.addEventListener('contextmenu', e => e.preventDefault());
    platno.addEventListener('wheel', e => { e.preventDefault(); ovl.vzd *= Math.exp(e.deltaY * 0.0012); prekresli(); }, { passive: false });

    const png = () => { snimek(); return platno.toDataURL('image/png'); };
    return { nastav, pohled, prepni, png, prekresli, barvy, stav, ovl };
  }
  window.KOLICKY_NAHLED = { vytvorNahled, VZHLEDY };
})();
