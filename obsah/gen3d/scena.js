/* ============================================================
   gen3d/scena.js – společná 3D scéna generátorů (three.js r128).
   Tažení = otáčení, pravé tl. / Shift = posun, kolečko / dva prsty = zoom (+ posun).

   const s = G3D.scena(kontejner, {popis, odstup, pohledy})
     s.skupina            – sem patří objekty modelu (s.vycisti() je uklidí i s geometriemi)
     s.geometrie(poz, idx, {uhel, barvyVrcholu, barvaTroj(t) → [r,g,b] | null, zaklad: [r,g,b]}) – normály s lomem
     s.hrany(poz, idx, uhel, mat)      – obrysové hrany (LineSegments)
     s.mrizka(box, vid) / s.stin(box, vid) – podložka a měkký stín pod modelem
     s.rovinaRezu, s.matVnitrek        – řez rovinou y = 0 (vnitřek obarvený)
     s.pohled(jak, box)                – 'iso' | 'shora' | 'zepredu' | 'zboku' | 'zespodu' | 'ponech' | {azimut, elevace}
     s.pravitka(box | null)            – pravítka s dílky po hranách obalu (potřebuje gen3d/koty.js)
     s.barvy(cara, cara2, hrana, kryti, pozadi), s.prekresli(), s.snimek(), s.png()   (pozadi = podklad popisků pravítek)
   ============================================================ */
/* global THREE */
(function () {
  'use strict';
  const POHLEDY = {
    iso: [-1.2, 0.6],
    shora: [-Math.PI / 2, Math.PI / 2 - 1e-3],
    zepredu: [-Math.PI / 2, 0.02],
    zboku: [0, 0.02],
    zespodu: [-Math.PI / 2, -Math.PI / 2 + 1e-3],
  };

  function scena(kontejner, volby = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.localClippingEnabled = true;
    kontejner.appendChild(renderer.domElement);
    const platno = renderer.domElement;
    Object.assign(platno.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
    platno.tabIndex = 0;
    platno.setAttribute('aria-label', volby.popis || '3D náhled – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');

    const sc = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(volby.fov || 35, 1, 0.5, 20000);
    kamera.up.set(0, 0, 1);
    sc.add(new THREE.HemisphereLight(0xf4f7ff, 0x3a4048, 0.62));
    const sv1 = new THREE.DirectionalLight(0xffffff, 0.8); sv1.position.set(1.2, -1.6, 2.2); kamera.add(sv1);
    const sv2 = new THREE.DirectionalLight(0xdfe8ff, 0.28); sv2.position.set(-1.8, 0.4, 0.8); kamera.add(sv2);
    const sv3 = new THREE.DirectionalLight(0xffffff, 0.35); sv3.position.set(0.3, 2, -1); kamera.add(sv3);
    sc.add(kamera);
    const skupina = new THREE.Group(); sc.add(skupina);
    const rovinaRezu = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);   // ponechá y ≥ 0, řez míří ke kameře
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.32 });
    const matVnitrek = new THREE.MeshBasicMaterial({ color: 0xc0504d, side: THREE.BackSide, clippingPlanes: [rovinaRezu] });
    const tema = { mrizka: 0x888888, mrizka2: 0x555555, text: '#223', pozadi: '#fff' };
    const pohledy = Object.assign({}, POHLEDY, volby.pohledy || {});
    const ovl = { cil: new THREE.Vector3(), vzd: 200, azimut: -1.2, elevace: 0.6 };
    let rozmer = 50, objMrizka = null, objPravitka = null, boxPravitek = null;

    const stinTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
    })();
    const objStin = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: stinTex, transparent: true, depthWrite: false }));
    objStin.renderOrder = -1; objStin.visible = false; sc.add(objStin);

    function barvy(cara, cara2, hrana, kryti, pozadi) {
      if (hrana) matHrany.color.set(hrana);
      if (kryti != null) matHrany.opacity = kryti;
      tema.mrizka = new THREE.Color(cara).getHex(); tema.mrizka2 = new THREE.Color(cara2).getHex();
      const text = hrana || tema.text, pod = pozadi || (getComputedStyle(document.documentElement).getPropertyValue('--bg-panel').trim() || tema.pozadi);
      const zmena = text !== tema.text || pod !== tema.pozadi;
      tema.text = text; tema.pozadi = pod;
      if (objMrizka) objMrizka.material.color.setHex(tema.mrizka2);
      if (zmena && objPravitka && boxPravitek) pravitka(boxPravitek);   // popisky pravítek v barvách tématu
      prekresli();
    }

    /** Normály s lomem (plochy svírající víc než „uhel“ se nevyhlazují), volitelně barvy vrcholů nebo trojúhelníků. */
    function geometrie(poz, idx, o = {}) {
      const nT = idx.length / 3, fn = new Float32Array(3 * nT), nV = poz.length / 3, kos = Math.cos((o.uhel ?? 30) * Math.PI / 180);
      const start = new Int32Array(nV + 1), sous = new Int32Array(3 * nT);
      for (let i = 0; i < 3 * nT; i++) start[idx[i] + 1]++;
      for (let v = 0; v < nV; v++) start[v + 1] += start[v];
      const plneni = start.slice(0, nV);
      for (let t = 0; t < nT; t++) {
        const a = idx[3 * t], b = idx[3 * t + 1], c = idx[3 * t + 2];
        const ux = poz[3 * b] - poz[3 * a], uy = poz[3 * b + 1] - poz[3 * a + 1], uz = poz[3 * b + 2] - poz[3 * a + 2];
        const vx = poz[3 * c] - poz[3 * a], vy = poz[3 * c + 1] - poz[3 * a + 1], vz = poz[3 * c + 2] - poz[3 * a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
        fn[3 * t] = nx / l; fn[3 * t + 1] = ny / l; fn[3 * t + 2] = nz / l;
        sous[plneni[a]++] = t; sous[plneni[b]++] = t; sous[plneni[c]++] = t;
      }
      const bv = o.barvyVrcholu, bt = o.barvaTroj;
      const P = new Float32Array(9 * nT), N = new Float32Array(9 * nT), C = bv || bt ? new Float32Array(9 * nT) : null;
      for (let t = 0; t < nT; t++) {
        const barva = bt ? bt(t) : null;
        for (let k = 0; k < 3; k++) {
          const v = idx[3 * t + k], q = 9 * t + 3 * k;
          let nx = 0, ny = 0, nz = 0;
          for (let i = start[v], e = start[v + 1]; i < e; i++) {
            const f = sous[i];
            if (fn[3 * f] * fn[3 * t] + fn[3 * f + 1] * fn[3 * t + 1] + fn[3 * f + 2] * fn[3 * t + 2] >= kos) { nx += fn[3 * f]; ny += fn[3 * f + 1]; nz += fn[3 * f + 2]; }
          }
          const l = Math.hypot(nx, ny, nz) || 1;
          N[q] = nx / l; N[q + 1] = ny / l; N[q + 2] = nz / l;
          P[q] = poz[3 * v]; P[q + 1] = poz[3 * v + 1]; P[q + 2] = poz[3 * v + 2];
          if (barva) { C[q] = barva[0]; C[q + 1] = barva[1]; C[q + 2] = barva[2]; }
          else if (bv) { C[q] = bv[3 * v]; C[q + 1] = bv[3 * v + 1]; C[q + 2] = bv[3 * v + 2]; }
          else if (C) { const z = o.zaklad || [1, 1, 1]; C[q] = z[0]; C[q + 1] = z[1]; C[q + 2] = z[2]; }   // trojúhelník bez barvy: základní barva (bílá = barva materiálu)
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      if (C) g.setAttribute('color', new THREE.BufferAttribute(C, 3));
      return g;
    }
    function hrany(poz, idx, uhel = 30, mat = matHrany) {
      const gi = new THREE.BufferGeometry();
      gi.setAttribute('position', new THREE.BufferAttribute(poz, 3)); gi.setIndex(new THREE.BufferAttribute(idx, 1));
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(gi, uhel), mat); gi.dispose();
      return l;
    }
    /** Mřížka podložky pod obalem; vid = viditelná (typicky v tiskové poloze). */
    function mrizka(box, vid, kryti = 0.35) {
      if (objMrizka) { skupina.remove(objMrizka); objMrizka.geometry.dispose(); objMrizka = null; }
      if (!box) return null;
      const vel = new THREE.Vector3(); box.getSize(vel);
      const strana = Math.ceil(Math.max(vel.x, vel.y, vel.z, 10) * 1.6 / 10) * 10;
      const g = new THREE.GridHelper(strana, strana / 5, tema.mrizka, tema.mrizka2);
      g.rotation.x = Math.PI / 2; g.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.min.z - 0.02);
      g.material.transparent = true; g.material.opacity = kryti; g.visible = !!vid;
      g.userData.vlastniMat = true;
      objMrizka = g; skupina.add(g);
      return g;
    }
    function stin(box, vid) {
      objStin.visible = !!(box && vid);
      if (!box) return;
      const vel = new THREE.Vector3(); box.getSize(vel);
      objStin.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.min.z - 0.05);
      objStin.scale.set(vel.x * 1.5 + 8, vel.y * 1.5 + 8, 1);
    }
    /** Uklidí skupinu modelu (geometrie; materiály jen s userData.vlastniMat). Mřížku i pravítka zahodí také. */
    function vycisti() {
      for (const o of [...skupina.children]) {
        skupina.remove(o);
        o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.userData.vlastniMat && c.material) c.material.dispose(); });
      }
      objMrizka = null; objPravitka = null;
    }
    function obalSkupiny() {
      skupina.updateMatrixWorld(true);
      const b = new THREE.Box3();
      const mimo = o => { for (let x = o; x && x !== skupina; x = x.parent) if (x.userData.model === false || !x.visible) return true; return false; };
      skupina.traverse(o => { if (o.isMesh && !mimo(o)) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); b.union(bb); } });
      return b;
    }

    let ceka = false;
    function prekresli() { if (ceka) return; ceka = true; requestAnimationFrame(() => { ceka = false; snimek(); }); }
    function snimek() {
      const ce = Math.cos(ovl.elevace);
      kamera.position.set(ovl.cil.x + ovl.vzd * ce * Math.cos(ovl.azimut), ovl.cil.y + ovl.vzd * ce * Math.sin(ovl.azimut), ovl.cil.z + ovl.vzd * Math.sin(ovl.elevace));
      kamera.lookAt(ovl.cil);
      kamera.near = Math.max(0.1, ovl.vzd / 200); kamera.far = ovl.vzd * 20 + rozmer * 10; kamera.updateProjectionMatrix();
      renderer.render(sc, kamera);
    }
    // kreslit hned (ne v rAF): celostránkový snímek po změně velikosti jinak zachytí prázdné plátno
    function velikost() {
      if (!kontejner.clientWidth || !kontejner.clientHeight) return;   // skrytý kontejner – plátno nechat, jak je
      const w = kontejner.clientWidth, h = kontejner.clientHeight;
      renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix();
      if (cekajiciPohled) { const j = cekajiciPohled; cekajiciPohled = null; pohled(j.jak, j.box); }   // pohled spočtený bez velikosti
      else if (posledniBox && Math.abs(kamera.aspect / aspektPohledu - 1) > 0.15) pohled('ponech', posledniBox);   // výrazně jiný poměr stran: model znovu vměstnat
      snimek();
      if (volby.zmenaVelikosti) volby.zmenaVelikosti(w, h);
    }
    new ResizeObserver(velikost).observe(kontejner);

    let cekajiciPohled = null, posledniBox = null, aspektPohledu = 1;
    function pohled(jak, box) {
      if (!kontejner.clientWidth || !kontejner.clientHeight) cekajiciPohled = { jak, box };
      const b = box || obalSkupiny();
      if (b.isEmpty()) return;
      if (kontejner.clientWidth && kontejner.clientHeight) { kamera.aspect = kontejner.clientWidth / kontejner.clientHeight; kamera.updateProjectionMatrix(); }
      posledniBox = b.clone(); aspektPohledu = kamera.aspect || 1;
      const koule = new THREE.Sphere(), vel = new THREE.Vector3();
      b.getCenter(ovl.cil); b.getBoundingSphere(koule); b.getSize(vel);
      rozmer = Math.max(vel.x, vel.y, vel.z, 10);
      const vf = kamera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * kamera.aspect);
      ovl.vzd = koule.radius / Math.sin(Math.min(vf, hf) / 2) * (volby.odstup || 1);
      const u = typeof jak === 'object' && jak ? [jak.azimut, jak.elevace] : jak === 'ponech' ? null : (pohledy[jak] || pohledy.iso);
      if (u) { ovl.azimut = u[0]; ovl.elevace = u[1]; }
      prekresli();
    }

    /** Pravítka s dílky po třech hranách obalu (x, y dole vpředu, z vlevo vzadu). */
    function pravitka(box) {
      if (objPravitka) { skupina.remove(objPravitka); objPravitka.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); } }); objPravitka = null; }
      boxPravitek = box || null;
      if (!box || box.isEmpty() || !window.G3D || !G3D.koty) { prekresli(); return; }
      const a = box.min, b = box.max, vel = new THREE.Vector3(); box.getSize(vel);
      objPravitka = G3D.koty.postav(THREE, {
        barva: tema.text, pozadi: tema.pozadi, velikost: Math.max(vel.x, vel.y, vel.z),
        pravitka: [
          { a: [a.x, a.y, a.z], b: [b.x, a.y, a.z], n: [0, -1, 0] },
          { a: [b.x, a.y, a.z], b: [b.x, b.y, a.z], n: [1, 0, 0] },
          { a: [a.x, b.y, a.z], b: [a.x, b.y, b.z], n: [-1, 0, 0] },
        ],
      });
      objPravitka.userData.model = false;
      skupina.add(objPravitka); prekresli();
    }

    // myš a dotyk
    const ukaz = new Map(); let start = null;
    platno.addEventListener('pointerdown', e => {
      try { platno.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
      ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      start = { posun: e.button === 2 || e.shiftKey, vzd: ovl.vzd, roz: null };
      if (ukaz.size === 2) { const [p, q] = [...ukaz.values()]; start.roz = Math.hypot(p[0] - q[0], p[1] - q[1]); }
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
        const [p, q] = [...ukaz.values()], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        ovl.vzd = start.vzd * start.roz / Math.max(1, Math.hypot(p[0] - q[0], p[1] - q[1]));
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
    return {
      renderer, platno, scena: sc, kamera, skupina, ovl, tema, matHrany, matVnitrek, rovinaRezu,
      geometrie, hrany, mrizka, stin, vycisti, obalSkupiny, pohled, pravitka, barvy, prekresli, snimek, png,
      get rozmer() { return rozmer; }, set rozmer(x) { rozmer = x; },
    };
  }
  window.G3D = Object.assign(window.G3D || {}, { scena, POHLEDY });
})();
