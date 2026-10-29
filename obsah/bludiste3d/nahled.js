/* Bludiště – 3D náhled (three.js r128): díly ve složené nebo tiskové poloze, rozložení, průhlednost,
   řešení jako trubička, kulička na startu. Otáčení tažením, posun pravým tlačítkem / Shift, kolečko a dva prsty = zoom. */
/* global THREE, BLUD */
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
    platno.setAttribute('aria-label', '3D náhled bludiště – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');

    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
    kamera.up.set(0, 0, 1);
    scena.add(new THREE.HemisphereLight(0xf4f7ff, 0x3a4048, 0.62));
    const sv1 = new THREE.DirectionalLight(0xffffff, 0.8); sv1.position.set(1.2, -1.6, 2.2); kamera.add(sv1);
    const sv2 = new THREE.DirectionalLight(0xdfe8ff, 0.28); sv2.position.set(-1.8, 0.4, 0.8); kamera.add(sv2);
    const sv3 = new THREE.DirectionalLight(0xffffff, 0.35); sv3.position.set(0.3, 2, -1); kamera.add(sv3);
    scena.add(kamera);
    const matHrany = new THREE.LineBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0.32 });
    const matCesta = new THREE.MeshStandardMaterial({ color: 0xffc000, roughness: 0.4, emissive: 0x805000 });   // řešení: sytě žluté v obou tématech
    const matKulicka = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.18 });
    const skupina = new THREE.Group(); scena.add(skupina);
    let objekty = [], mrizka = null, model = null, dily = null, rozmer = 100;
    const tema = { mrizka: 0x888888, mrizka2: 0x555555 };
    const stav = { reseni: true, rozlozit: false, pruhledne: true, hrany: true, tisk: false };

    function barvy(cara, cara2, hrana) {
      if (hrana) matHrany.color.set(hrana);
      tema.mrizka = new THREE.Color(cara).getHex(); tema.mrizka2 = new THREE.Color(cara2).getHex();
      if (mrizka) mrizka.material.color.setHex(tema.mrizka2);
      prekresli();
    }

    /** Geometrie s lomenými normálami (ostré hrany chodeb nevyhlazovat). */
    function geometrie(poz, idx) {
      const nT = idx.length / 3, P = new Float32Array(9 * nT);
      for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const v = idx[3 * t + k]; P.set([poz[3 * v], poz[3 * v + 1], poz[3 * v + 2]], 9 * t + 3 * k); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.computeVertexNormals();
      return g;
    }
    function uklid() {
      for (const o of objekty) { skupina.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose && o.userData.vlastniMat) o.material.dispose(); }
      objekty = [];
      if (mrizka) { skupina.remove(mrizka); mrizka.geometry.dispose(); mrizka = null; }
    }
    const pridej = o => { skupina.add(o); objekty.push(o); return o; };

    /** Rozložení: posun dílu nahoru podle jeho pořadí (kostka po vrstvách, víko nad krabičkou). */
    function posunRozlozeni(d, i) {
      if (!stav.rozlozit || !model) return 0;
      const p = model.p;
      if (p.rezim === 'valec') return d.jmeno === 'pouzdro' ? model.vyskaPouzdra + 12 : 0;
      if (p.rezim === 'kostka') return i * Math.max(12, model.krok);
      return d.jmeno === 'viko' ? 30 : d.jmeno === 'plexi' ? 15 : 0;
    }
    function sestav() {
      uklid();
      if (!model || !dily) { prekresli(); return; }
      const p = model.p;
      const zobrazit = stav.tisk ? BLUD.rozmisti(dily.filter(d => d.tisk)) : dily;
      zobrazit.forEach((d, i) => {
        const pruh = !stav.tisk && stav.pruhledne && (d.jmeno !== 'nadoba' && d.jmeno !== 'zaklad' && d.jmeno !== 'vrstva1');
        const mat = new THREE.MeshPhysicalMaterial({ color: d.barva || '#4F86D9', roughness: 0.45, metalness: 0.03, clearcoat: 0.3, side: THREE.DoubleSide,
          transparent: pruh || d.jmeno === 'plexi', opacity: d.jmeno === 'plexi' ? 0.25 : pruh ? 0.32 : 1, depthWrite: !(pruh || d.jmeno === 'plexi') });
        const g = geometrie(d.poz, d.idx);
        const sit = pridej(new THREE.Mesh(g, mat)); sit.userData.vlastniMat = true;
        if (pruh) sit.renderOrder = 3;
        if (stav.hrany) {
          const gi = new THREE.BufferGeometry();
          gi.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); gi.setIndex(new THREE.BufferAttribute(d.idx, 1));
          const h = pridej(new THREE.LineSegments(new THREE.EdgesGeometry(gi, 32), matHrany)); gi.dispose();
          h.userData.dil = sit;
        }
        if (!stav.tisk) {
          const dz = d.sestava.dz + posunRozlozeni(d, i);
          for (const o of objekty.slice(-(stav.hrany ? 2 : 1))) { o.rotation.z = d.sestava.rotZ; o.position.z = dz; }
        }
      });
      if (!stav.tisk && stav.reseni) {
        const body = BLUD.bodyReseni(model).map(b => {
          let dz = 0;
          if (p.rezim === 'kostka' && stav.rozlozit) dz = Math.floor(b[2] / model.krok) * Math.max(12, model.krok);
          return new THREE.Vector3(b[0], b[1], b[2] + dz);
        });
        if (body.length > 1) {
          class Lomena extends THREE.Curve {
            constructor(B) { super(); this.B = B; this.L = [0]; for (let i = 1; i < B.length; i++) this.L.push(this.L[i - 1] + B[i].distanceTo(B[i - 1])); }
            getPoint(t, cil = new THREE.Vector3()) {
              const s = t * this.L[this.L.length - 1]; let i = 1; while (i < this.L.length - 1 && this.L[i] < s) i++;
              const u = (s - this.L[i - 1]) / Math.max(1e-9, this.L[i] - this.L[i - 1]);
              return cil.copy(this.B[i - 1]).lerp(this.B[i], Math.min(1, Math.max(0, u)));
            }
          }
          const r = Math.max(0.45, (p.rezim === 'valec' ? p.kulicka : model.w) * 0.16);
          pridej(new THREE.Mesh(new THREE.TubeGeometry(new Lomena(body), Math.min(4000, body.length * 6), r, 6, false), matCesta));
          // začátek a konec řešení
          for (const [b, c] of [[body[0], 0x30b070], [body[body.length - 1], 0xe04030]]) {
            const s = pridej(new THREE.Mesh(new THREE.SphereGeometry(r * 2.4, 16, 12), new THREE.MeshStandardMaterial({ color: c })));
            s.userData.vlastniMat = true; s.position.copy(b);
          }
        }
      }
      if (!stav.tisk && p.rezim !== 'valec') {
        const s = BLUD.stredBunky(model, model.b.start);
        const kul = pridej(new THREE.Mesh(new THREE.SphereGeometry(p.kulicka / 2, 32, 20), matKulicka));
        const dz = p.rezim === 'kostka' && stav.rozlozit ? Math.floor(s[2] / model.krok) * Math.max(12, model.krok) : 0;
        kul.position.set(s[0], s[1], s[2] + dz);
      }
      // podložka pod modelem
      const b = new THREE.Box3().setFromObject(skupina), vel = new THREE.Vector3(); b.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      const pg = new THREE.GridHelper(Math.ceil(novy * 1.6 / 10) * 10, Math.ceil(novy * 1.6 / 10), tema.mrizka, tema.mrizka2);
      pg.rotation.x = Math.PI / 2; pg.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, Math.min(0, b.min.z) - 0.02);
      pg.material.transparent = true; pg.material.opacity = 0.35;
      mrizka = pg; skupina.add(pg);
      // nový pohled při první sestavě, jiném typu nebo velké změně velikosti – jinak natočení od uživatele zůstane
      if (!sestav.uz || sestav.rezim !== p.rezim || Math.abs(novy - rozmer) / rozmer > 0.3) { rozmer = novy; pohled(sestav.uz ? 'ponech' : 'iso'); sestav.uz = true; sestav.rezim = p.rezim; }
      prekresli();
    }
    function nastav(m, d) { model = m && !m.chyba ? m : null; dily = model ? d : null; sestav(); }

    const ovl = { cil: new THREE.Vector3(), vzd: 300, azimut: -1.2, elevace: 0.6 };
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
      if (!objekty.length) return;
      const b = new THREE.Box3();
      for (const o of objekty) b.expandByObject(o);
      const koule = new THREE.Sphere(); b.getBoundingSphere(koule); ovl.cil.copy(koule.center);
      const vf = kamera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * kamera.aspect);
      ovl.vzd = koule.radius / Math.sin(Math.min(vf, hf) / 2) * 1.05;
      if (jak === 'shora') { ovl.azimut = -Math.PI / 2; ovl.elevace = Math.PI / 2 - 1e-3; }
      else if (jak === 'zboku') { ovl.azimut = -Math.PI / 2; ovl.elevace = 0.02; }
      else if (jak !== 'ponech') { ovl.azimut = -1.2; ovl.elevace = 0.6; }
      prekresli();
    }
    function prepni(co, h) { stav[co] = h; sestav(); if (co === 'tisk' || co === 'rozlozit') pohled('ponech'); }

    // myš a dotyk (stejné ovládání jako ostatní 3D generátory)
    const ukaz = new Map(); let start = null;
    platno.addEventListener('pointerdown', e => {
      platno.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      start = { posun: e.button === 2 || e.shiftKey, vzd: ovl.vzd, roz: null };
      if (ukaz.size === 2) { const [a, b] = [...ukaz.values()]; start.roz = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    });
    const posunPohledu = (dx, dy) => {
      const kk = ovl.vzd / platno.clientHeight * 0.8, prave = new THREE.Vector3(), nahoru = new THREE.Vector3();
      kamera.matrixWorld.extractBasis(prave, nahoru, new THREE.Vector3());
      ovl.cil.addScaledVector(prave, -dx * kk).addScaledVector(nahoru, dy * kk);
    };
    platno.addEventListener('pointermove', e => {
      if (!ukaz.has(e.pointerId) || !start) return;
      const pred = ukaz.get(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 2 && start.roz) {
        const [a, b] = [...ukaz.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        ovl.vzd = start.vzd * start.roz / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]));
        if (start.mid) posunPohledu(mid[0] - start.mid[0], mid[1] - start.mid[1]);
        start.mid = mid; prekresli(); return;
      }
      const dx = e.clientX - pred[0], dy = e.clientY - pred[1];
      if (start.posun) posunPohledu(dx, dy);
      else { ovl.azimut -= dx * 0.008; ovl.elevace = Math.max(-1.55, Math.min(1.55, ovl.elevace + dy * 0.008)); }
      prekresli();
    });
    const konec = e => { ukaz.delete(e.pointerId); if (!ukaz.size) start = null; };
    platno.addEventListener('pointerup', konec); platno.addEventListener('pointercancel', konec);
    platno.addEventListener('contextmenu', e => e.preventDefault());
    platno.addEventListener('wheel', e => { e.preventDefault(); ovl.vzd *= Math.exp(e.deltaY * 0.0012); prekresli(); }, { passive: false });

    const png = () => { snimek(); return platno.toDataURL('image/png'); };
    return { nastav, pohled, prepni, png, prekresli, barvy, stav };
  }
  window.BLUD_NAHLED = { vytvorNahled };
})();
