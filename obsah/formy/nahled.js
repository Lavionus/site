/* Formy na odlévání – 3D náhled (three.js r128): díly formy, model obarvený podle podkosů, rovina / hladina,
   rozložená sestava nebo tisková poloha. Otáčení tažením, posun pravým tlačítkem / Shift, kolečko = zoom, dva prsty. */
/* global THREE */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    kontejner.appendChild(renderer.domElement);
    const platno = renderer.domElement;
    Object.assign(platno.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
    platno.tabIndex = 0;
    platno.setAttribute('aria-label', '3D náhled formy – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');

    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
    kamera.up.set(0, 0, 1);
    scena.add(new THREE.HemisphereLight(0xf4f7ff, 0x3a4048, 0.62));
    const sv1 = new THREE.DirectionalLight(0xffffff, 0.8); sv1.position.set(1.2, -1.6, 2.2); kamera.add(sv1);
    const sv2 = new THREE.DirectionalLight(0xdfe8ff, 0.28); sv2.position.set(-1.8, 0.4, 0.8); kamera.add(sv2);
    const sv3 = new THREE.DirectionalLight(0xffffff, 0.35); sv3.position.set(0.3, 2, -1); kamera.add(sv3);
    scena.add(kamera);
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.3 });
    const matModel = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05, clearcoat: 0.3, side: THREE.DoubleSide });
    const matRovina = new THREE.MeshBasicMaterial({ color: 0x3aa0ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    const skupina = new THREE.Group(); scena.add(skupina);
    const tema = { mrizka: 0x888888, mrizka2: 0x555555 };
    const stav = { pruhledna: true, podkosy: true, rovina: true, hrany: true, tisk: false, rozlozit: 0 };
    let data = null, rozmer = 100, uz = false;

    function barvy(cara, cara2, hrana) {
      if (hrana) matHrany.color.set(hrana);
      tema.mrizka = new THREE.Color(cara).getHex(); tema.mrizka2 = new THREE.Color(cara2).getHex();
      if (data) postavScenu(); else prekresli();
    }

    /** Geometrie bez indexu s lomenými normálami (ostré hrany nad „uhel“) a volitelnou barvou po trojúhelnících. */
    function geometrie(poz, idx, barvyTr, uhel) {
      const nT = idx.length / 3, fn = new Float32Array(3 * nT), nV = poz.length / 3, kos = Math.cos(uhel * Math.PI / 180);
      const sous = Array.from({ length: nV }, () => []);
      for (let t = 0; t < nT; t++) {
        const a = idx[3 * t], b = idx[3 * t + 1], c = idx[3 * t + 2];
        const ux = poz[3 * b] - poz[3 * a], uy = poz[3 * b + 1] - poz[3 * a + 1], uz = poz[3 * b + 2] - poz[3 * a + 2];
        const vx = poz[3 * c] - poz[3 * a], vy = poz[3 * c + 1] - poz[3 * a + 1], vz = poz[3 * c + 2] - poz[3 * a + 2];
        let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const l = Math.hypot(x, y, z) || 1;
        fn[3 * t] = x / l; fn[3 * t + 1] = y / l; fn[3 * t + 2] = z / l;
        sous[a].push(t); sous[b].push(t); sous[c].push(t);
      }
      const P = new Float32Array(9 * nT), N = new Float32Array(9 * nT), C = barvyTr ? new Float32Array(9 * nT) : null;
      for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) {
        const v = idx[3 * t + k], o = 9 * t + 3 * k;
        let nx = 0, ny = 0, nz = 0;
        for (const f of sous[v]) if (fn[3 * f] * fn[3 * t] + fn[3 * f + 1] * fn[3 * t + 1] + fn[3 * f + 2] * fn[3 * t + 2] >= kos) { nx += fn[3 * f]; ny += fn[3 * f + 1]; nz += fn[3 * f + 2]; }
        const l = Math.hypot(nx, ny, nz) || 1;
        N[o] = nx / l; N[o + 1] = ny / l; N[o + 2] = nz / l;
        P[o] = poz[3 * v]; P[o + 1] = poz[3 * v + 1]; P[o + 2] = poz[3 * v + 2];
        if (C) { C[o] = barvyTr[3 * t]; C[o + 1] = barvyTr[3 * t + 1]; C[o + 2] = barvyTr[3 * t + 2]; }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      if (C) g.setAttribute('color', new THREE.BufferAttribute(C, 3));
      return g;
    }
    function hranyDilu(d) {
      const gi = new THREE.BufferGeometry();
      gi.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); gi.setIndex(new THREE.BufferAttribute(d.idx, 1));
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(gi, 35), matHrany); gi.dispose();
      return l;
    }
    function vycisti() {
      for (const o of [...skupina.children]) {
        skupina.remove(o);
        o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material && x.material !== matHrany && x.material !== matModel && x.material !== matRovina) x.material.dispose(); });
      }
    }

    /** d = {dily, tiskDily, dutina:{poz,idx}, barvyPloch (Float32 3/trojúhelník), kopie:[[dx,dy,dz]], rovina:{h, box}, chyba} */
    function nastav(d) { data = d; postavScenu(); }
    function postavScenu() {
      vycisti();
      const d = data;
      if (!d || d.chyba) { prekresli(); return; }
      const dily = stav.tisk ? d.tiskDily : d.dily;
      const box = new THREE.Box3();
      dily.forEach((dil, i) => {
        const g = geometrie(dil.poz, dil.idx, null, 35);
        const pr = stav.pruhledna && !stav.tisk && dil.jmeno !== 'model';
        const mat = new THREE.MeshPhysicalMaterial({ color: dil.barva, roughness: 0.5, metalness: 0.02, clearcoat: 0.2, side: THREE.DoubleSide,
          transparent: pr, opacity: pr ? 0.32 : 1, depthWrite: !pr });
        const m = new THREE.Mesh(g, mat);
        const sk = new THREE.Group(); sk.add(m);
        if (stav.hrany) sk.add(hranyDilu(dil));
        // rozložená sestava: horní díl / rámeček nahoru
        if (!stav.tisk && stav.rozlozit && (dil.jmeno === 'horni' || dil.jmeno === 'ramecek')) sk.position.z = stav.rozlozit;
        if (pr) m.renderOrder = 2 + i;
        skupina.add(sk);
        g.computeBoundingBox(); box.union(g.boundingBox.clone().translate(sk.position));
      });
      if (!stav.tisk && d.dutina && d.kopie) {
        const g = geometrie(d.dutina.poz, d.dutina.idx, d.barvyPloch && stav.podkosy ? d.barvyPloch : d.barvyZaklad, 35);
        for (const [dx, dy, dz] of d.kopie) { const m = new THREE.Mesh(g, matModel); m.position.set(dx, dy, dz); m.renderOrder = 1; skupina.add(m); }
      }
      if (!stav.tisk && stav.rovina && d.rovina) {
        const r = d.rovina, sz = new THREE.Vector3(), c = new THREE.Vector3(); box.getSize(sz); box.getCenter(c);
        let m;
        if (r.box) {
          // silikonová lázeň: průsvitný kvádr od osazení po hladinu
          const b = r.box;
          m = new THREE.Mesh(new THREE.BoxGeometry(b.L, b.W, b.fill - b.zPl), matRovina);
          m.position.set(c.x, c.y, (b.zPl + b.fill) / 2);
        } else {
          m = new THREE.Mesh(new THREE.PlaneGeometry(sz.x * 1.25 + 10, sz.y * 1.25 + 10), matRovina);
          m.position.set(c.x, c.y, r.h);
        }
        m.renderOrder = 10; skupina.add(m);
      }
      // mřížka podložky
      const sz = new THREE.Vector3(); box.getSize(sz);
      const novy = Math.max(sz.x, sz.y, sz.z, 10);
      const pg = new THREE.GridHelper(Math.ceil(novy * 1.6 / 10) * 10, Math.ceil(novy * 1.6 / 10), tema.mrizka, tema.mrizka2);
      pg.rotation.x = Math.PI / 2; const c = new THREE.Vector3(); box.getCenter(c); pg.position.set(c.x, c.y, box.min.z - 0.05);
      pg.material.transparent = true; pg.material.opacity = 0.35; skupina.add(pg);
      if (!uz || Math.abs(novy - rozmer) / rozmer > 0.3) { rozmer = novy; pohled(uz ? 'ponech' : 'iso'); uz = true; }
      prekresli();
    }

    const ovl = { cil: new THREE.Vector3(), vzd: 300, azimut: -1.1, elevace: 0.6 };
    let ceka = false;
    function prekresli() { if (ceka) return; ceka = true; requestAnimationFrame(() => { ceka = false; snimek(); }); }
    function snimek() {
      const ce = Math.cos(ovl.elevace);
      kamera.position.set(ovl.cil.x + ovl.vzd * ce * Math.cos(ovl.azimut), ovl.cil.y + ovl.vzd * ce * Math.sin(ovl.azimut), ovl.cil.z + ovl.vzd * Math.sin(ovl.elevace));
      kamera.lookAt(ovl.cil);
      kamera.near = Math.max(0.1, ovl.vzd / 200); kamera.far = ovl.vzd * 20 + rozmer * 10; kamera.updateProjectionMatrix();
      renderer.render(scena, kamera);
    }
    function velikost() {
      const w = kontejner.clientWidth || 1, h = kontejner.clientHeight || 1;
      renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); prekresli();
    }
    new ResizeObserver(velikost).observe(kontejner);

    function pohled(jak) {
      if (!skupina.children.length) return;
      const b = new THREE.Box3().setFromObject(skupina), koule = new THREE.Sphere();
      b.getCenter(ovl.cil); b.getBoundingSphere(koule);
      const vf = kamera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * kamera.aspect);
      ovl.vzd = koule.radius / Math.sin(Math.min(vf, hf) / 2) * 0.8;
      if (jak === 'shora') { ovl.azimut = -Math.PI / 2; ovl.elevace = Math.PI / 2 - 1e-3; }
      else if (jak === 'zepredu') { ovl.azimut = -Math.PI / 2; ovl.elevace = 0.02; }
      else if (jak === 'zboku') { ovl.azimut = 0; ovl.elevace = 0.02; }
      else if (jak !== 'ponech') { ovl.azimut = -1.1; ovl.elevace = 0.6; }
      prekresli();
    }
    function prepni(co, h) {
      stav[co] = h;
      if (data) postavScenu();
      if (co === 'tisk') pohled('iso');
    }

    const ukaz = new Map(); let start = null;
    platno.addEventListener('pointerdown', e => {
      platno.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
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
  window.FORMY_NAHLED = { vytvorNahled };
})();
