/* S hák – 3D náhled (three.js r128): otáčení tažením, posun pravým tlačítkem / Shift, kolečko = zoom.
   Osa Z nahoru = tisková výška (šířka průřezu), hák leží v rovině XY jako na podložce. */
/* global THREE */
(function () {
  'use strict';
  function vytvorNahled(kontejner) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setClearColor(0x000000, 0);   // pozadí dává CSS (studiový přechod podle tématu)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    kontejner.appendChild(renderer.domElement);
    const platno = renderer.domElement;
    Object.assign(platno.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
    platno.tabIndex = 0;
    platno.setAttribute('aria-label', '3D náhled háku – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');

    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
    kamera.up.set(0, 0, 1);
    // studiové světlo: obloha + hlavní zepředu shora, doplňkové zleva, kontra zezadu
    scena.add(new THREE.HemisphereLight(0xf4f7ff, 0x3a4048, 0.62));
    const sv1 = new THREE.DirectionalLight(0xffffff, 0.8); sv1.position.set(1.2, -1.6, 2.2); kamera.add(sv1);
    const sv2 = new THREE.DirectionalLight(0xdfe8ff, 0.28); sv2.position.set(-1.8, 0.4, 0.8); kamera.add(sv2);
    const sv3 = new THREE.DirectionalLight(0xffffff, 0.35); sv3.position.set(0.3, 2, -1); kamera.add(sv3);
    scena.add(kamera);   // světla jdou s kamerou – model je osvětlený z každé strany stejně
    const matHak = new THREE.MeshPhysicalMaterial({ color: 0x3f7bd6, roughness: 0.42, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    const matNapeti = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, clearcoat: 0.2, side: THREE.DoubleSide });
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.32 });
    // kontaktní stín: měkká skvrna pod modelem (textura z radiálního přechodu)
    const stinTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const stin = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: stinTex, transparent: true, depthWrite: false }));
    stin.renderOrder = -1; scena.add(stin);
    let hrany = null;
    const matTrubka = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
    const skupina = new THREE.Group(); scena.add(skupina);
    let hak = null, trubky = [], mrizka = null, rozmer = 100, model = null;
    const tema = { mrizka: 0x888888, mrizka2: 0x555555 };
    /** Barvy z proměnných stránky (téma): pozadí plochy a čáry mřížky. */
    function barvy(pozadi, cara, cara2, hrana) {
      if (hrana) matHrany.color.set(hrana);
      tema.mrizka = new THREE.Color(cara).getHex(); tema.mrizka2 = new THREE.Color(cara2).getHex();
      if (mrizka) { mrizka.material.color.setHex(tema.mrizka2); }
      prekresli();
    }
    const stav = { trubky: true, napeti: false, tisk: false, hrany: true };
    /** Montážní poloha: S hák visí (rovina háku svisle, trubky vodorovně); tisková poloha: leží na podložce. */
    function natoc() {
      skupina.rotation.set(0, 0, 0);
      if (!stav.tisk && model && !model.chyba) {
        skupina.rotation.x = Math.PI / 2;
      }
      if (mrizka) mrizka.visible = stav.tisk;
      skupina.updateMatrixWorld(true);
      // stín pod model (na podlahu montážní polohy nebo na podložku tisku)
      if (hak) {
        const b = new THREE.Box3().setFromObject(hak), vel = new THREE.Vector3(); b.getSize(vel);
        stin.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z - 0.3);
        stin.scale.set(vel.x * 1.5 + 10, vel.y * 1.5 + 10, 1); stin.visible = true;
      } else stin.visible = false;
    }
    /** Normály s lomem: plochy svírající víc než „uhel“ se nevyhlazují (ostré hrany čel a rohů průřezu). */
    function lomenaGeometrie(poz, idx, barvy, uhel) {
      const nT = idx.length / 3, fn = new Float32Array(3 * nT), nV = poz.length / 3, kos = Math.cos(uhel * Math.PI / 180);
      const sous = Array.from({ length: nV }, () => []);
      for (let t = 0; t < nT; t++) {
        const a = idx[3 * t], b = idx[3 * t + 1], c = idx[3 * t + 2];
        const ux = poz[3 * b] - poz[3 * a], uy = poz[3 * b + 1] - poz[3 * a + 1], uz = poz[3 * b + 2] - poz[3 * a + 2];
        const vx = poz[3 * c] - poz[3 * a], vy = poz[3 * c + 1] - poz[3 * a + 1], vz = poz[3 * c + 2] - poz[3 * a + 2];
        fn[3 * t] = uy * vz - uz * vy; fn[3 * t + 1] = uz * vx - ux * vz; fn[3 * t + 2] = ux * vy - uy * vx;   // velikost = 2 × plocha
        sous[a].push(t); sous[b].push(t); sous[c].push(t);
      }
      const delka = t => Math.hypot(fn[3 * t], fn[3 * t + 1], fn[3 * t + 2]) || 1;
      const P = new Float32Array(9 * nT), N = new Float32Array(9 * nT), Cb = barvy ? new Float32Array(9 * nT) : null;
      for (let t = 0; t < nT; t++) {
        const lt = delka(t);
        for (let k = 0; k < 3; k++) {
          const v = idx[3 * t + k], o = 9 * t + 3 * k;
          let nx = 0, ny = 0, nz = 0;
          for (const f of sous[v]) {
            const lf = delka(f);
            if ((fn[3 * f] * fn[3 * t] + fn[3 * f + 1] * fn[3 * t + 1] + fn[3 * f + 2] * fn[3 * t + 2]) / (lf * lt) >= kos) { nx += fn[3 * f]; ny += fn[3 * f + 1]; nz += fn[3 * f + 2]; }
          }
          const l = Math.hypot(nx, ny, nz) || 1;
          N[o] = nx / l; N[o + 1] = ny / l; N[o + 2] = nz / l;
          P[o] = poz[3 * v]; P[o + 1] = poz[3 * v + 1]; P[o + 2] = poz[3 * v + 2];
          if (Cb) { Cb[o] = barvy[3 * v]; Cb[o + 1] = barvy[3 * v + 1]; Cb[o + 2] = barvy[3 * v + 2]; }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      if (Cb) g.setAttribute('color', new THREE.BufferAttribute(Cb, 3));
      return g;
    }
    const ovl = { cil: new THREE.Vector3(), vzd: 300, azimut: -1.2, elevace: 0.75 };

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

    const uvolni = o => { if (o) { skupina.remove(o); o.geometry.dispose(); } };
    function nastav(m, barvy) {
      model = m;
      uvolni(hak); trubky.forEach(uvolni); trubky = [];
      if (hrany) { skupina.remove(hrany); hrany.geometry.dispose(); hrany = null; }
      if (mrizka) { skupina.remove(mrizka); mrizka.geometry.dispose(); mrizka = null; }
      if (!m || m.chyba) { prekresli(); return; }
      const g = lomenaGeometrie(m.poz, m.idx, barvy, 32);
      hak = new THREE.Mesh(g, stav.napeti && barvy ? matNapeti : matHak);
      skupina.add(hak);
      // obrysové hrany jako v CADu (jen ostré lomy)
      const gi = new THREE.BufferGeometry();
      gi.setAttribute('position', new THREE.BufferAttribute(m.poz, 3)); gi.setIndex(new THREE.BufferAttribute(m.idx, 1));
      hrany = new THREE.LineSegments(new THREE.EdgesGeometry(gi, 32), matHrany); gi.dispose();
      hrany.visible = stav.hrany; skupina.add(hrany);
      const vyska = m.pr.sirka;
      for (const [C, D] of [[m.tr.C1, m.p.trubka1], [m.tr.C2, m.p.trubka2]]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(D / 2, D / 2, vyska + 30, 64, 1, true), matTrubka);
        c.rotation.x = Math.PI / 2; c.position.set(C[0], C[1], vyska / 2);
        c.visible = stav.trubky; c.renderOrder = 2;
        skupina.add(c); trubky.push(c);
      }
      g.computeBoundingBox();
      const b = g.boundingBox, vel = new THREE.Vector3(); b.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      const pg = new THREE.GridHelper(Math.ceil(novy * 1.6 / 10) * 10, Math.ceil(novy * 1.6 / 10), tema.mrizka, tema.mrizka2);
      pg.rotation.x = Math.PI / 2; pg.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, -0.01);
      pg.material.transparent = true; pg.material.opacity = 0.35;
      mrizka = pg; skupina.add(pg);
      const stred = new THREE.Vector3(); b.getCenter(stred);
      // nový pohled při první sestavě, změně typu háku, velké změně velikosti nebo když model uteče ze středu
      natoc();
      if (!nastav.uz || Math.abs(novy - rozmer) / rozmer > 0.3 || stred.distanceTo(nastav.stred || stred) > 0.35 * novy) {
        // první sestavení = izometrie, jinak jen přepočítat vzdálenost a cíl – natočení od uživatele zůstane
        rozmer = novy; pohled(nastav.uz ? 'ponech' : 'iso'); nastav.uz = true; nastav.stred = stred.clone();
      }
      prekresli();
    }
    function pohled(jak) {
      if (!model || model.chyba) return;
      const b = new THREE.Box3().setFromObject(skupina), koule = new THREE.Sphere();
      new THREE.Box3().setFromObject(hak).getCenter(ovl.cil);
      b.getBoundingSphere(koule);
      // celá koule (hák a trubky) do užšího ze zorných úhlů
      const vf = kamera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * kamera.aspect);
      ovl.vzd = (koule.radius + koule.center.distanceTo(ovl.cil)) / Math.sin(Math.min(vf, hf) / 2) * 0.72;
      if (jak === 'shora') { ovl.azimut = -Math.PI / 2; ovl.elevace = Math.PI / 2 - 1e-3; }
      else if (jak === 'zboku') { ovl.azimut = -Math.PI / 2; ovl.elevace = 0.02; }
      else if (jak !== 'ponech') { ovl.azimut = -1.2; ovl.elevace = 0.75; }
      prekresli();
    }
    function prepni(co, h) {
      stav[co] = h;
      trubky.forEach(t => { t.visible = stav.trubky; });
      if (hak) hak.material = stav.napeti && hak.geometry.getAttribute('color') ? matNapeti : matHak;
      if (hrany) hrany.visible = stav.hrany;
      if (co === 'tisk') { natoc(); pohled('iso'); }
      prekresli();
    }

    // ovládání myší a dotykem
    const ukaz = new Map(); let start = null;
    platno.addEventListener('pointerdown', e => {
      platno.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      start = { posun: e.button === 2 || e.shiftKey, x: e.clientX, y: e.clientY, vzd: ovl.vzd, roz: null };
      if (ukaz.size === 2) { const [a, b] = [...ukaz.values()]; start.roz = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    });
    platno.addEventListener('pointermove', e => {
      if (!ukaz.has(e.pointerId) || !start) return;
      const pred = ukaz.get(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 2 && start.roz) {
        // dva prsty: roztažení = přiblížení, posun středu = posun pohledu
        const [a, b] = [...ukaz.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        ovl.vzd = start.vzd * start.roz / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]));
        if (start.mid) {
          const k = ovl.vzd / platno.clientHeight * 0.8, prave = new THREE.Vector3(), nahoru = new THREE.Vector3();
          kamera.matrixWorld.extractBasis(prave, nahoru, new THREE.Vector3());
          ovl.cil.addScaledVector(prave, -(mid[0] - start.mid[0]) * k).addScaledVector(nahoru, (mid[1] - start.mid[1]) * k);
        }
        start.mid = mid; prekresli(); return;
      }
      const dx = e.clientX - pred[0], dy = e.clientY - pred[1];
      if (start.posun) {
        const k = ovl.vzd / platno.clientHeight * 0.8;
        const prave = new THREE.Vector3(), nahoru = new THREE.Vector3();
        kamera.matrixWorld.extractBasis(prave, nahoru, new THREE.Vector3());
        ovl.cil.addScaledVector(prave, -dx * k).addScaledVector(nahoru, dy * k);
      } else {
        ovl.azimut -= dx * 0.008; ovl.elevace = Math.max(-1.55, Math.min(1.55, ovl.elevace + dy * 0.008));
      }
      prekresli();
    });
    const konec = e => { ukaz.delete(e.pointerId); if (!ukaz.size) start = null; };
    platno.addEventListener('pointerup', konec); platno.addEventListener('pointercancel', konec);
    platno.addEventListener('contextmenu', e => e.preventDefault());
    platno.addEventListener('wheel', e => { e.preventDefault(); ovl.vzd *= Math.exp(e.deltaY * 0.0012); prekresli(); }, { passive: false });

    /** Snímek náhledu; meritko > 1 = vyšší rozlišení (technický list), pak se vrátí původní. */
    const png = (meritko = 1) => {
      const pr0 = renderer.getPixelRatio();
      if (meritko > 1) renderer.setPixelRatio(meritko);
      snimek(); const url = platno.toDataURL('image/png');
      if (meritko > 1) { renderer.setPixelRatio(pr0); snimek(); }
      return url;
    };
    return { nastav, pohled, prepni, png, prekresli, barvy, stav, ovl };
  }
  window.SHAK_NAHLED = { vytvorNahled };
})();
