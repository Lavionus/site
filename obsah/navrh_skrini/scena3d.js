/* ============================================================
   Návrh skříní – 3D náhled sestavy (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Souřadnice modelu (x doprava, y nahoru, z dopředu) = souřadnice three (pravotočivé), jen posunuté na střed sestavy.
   Dvířka se otáčejí kolem svislé osy na straně závěsů, zásuvky (čelo + korpus) se vysouvají po z,
   rozložený pohled odsouvá dílce od středu jejich korpusu. Kreslí se jen když je plátno vidět a něco se změnilo.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;

  function texturaDreva(THREE, barva, vlakna, seed) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = barva; g.fillRect(0, 0, 256, 256);
    if (vlakna) {
      let s = seed || 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 90; i++) {
        const x = rnd() * 256, w = 0.6 + rnd() * 2.2, a = 0.05 + rnd() * 0.12;
        g.strokeStyle = `rgba(60,35,10,${a})`; g.lineWidth = w; g.beginPath();
        for (let y = 0; y <= 256; y += 16) { const xx = x + Math.sin(y / 40 + i) * 3 + (rnd() - 0.5) * 1.5; if (y) g.lineTo(xx, y); else g.moveTo(xx, y); }
        g.stroke();
      }
    } else {
      const d = g.getImageData(0, 0, 256, 256);
      let s = seed || 3; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < d.data.length; i += 4) { const n = (rnd() - 0.5) * 8; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
      g.putImageData(d, 0, 0);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  }

  function vytvor(obal) {
    const THREE = koren.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(32, 1, 1, 1e6);
    scena.add(new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.0));
    const svetlo = new THREE.DirectionalLight(0xffffff, 1.5); scena.add(svetlo, svetlo.target);
    const svetlo2 = new THREE.DirectionalLight(0xffffff, 0.5); scena.add(svetlo2);
    const koren3 = new THREE.Group(); scena.add(koren3);
    const orbit = { az: -28, el: 18, vzd: 3000, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = true, spinave = true, zrusen = false;
    const cil = { dvere: 0, zasuvky: 0, rozlozit: 0 }, akt = { dvere: 0, zasuvky: 0, rozlozit: 0 };
    let pohyblive = [], materialy = new Map(), V = null;

    function tmave() {
      const t = document.documentElement.getAttribute('data-theme') || '';
      return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches);
    }
    function zlikviduj() {
      for (const o of koren3.children.slice()) { koren3.remove(o); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); }
      for (const m of materialy.values()) { if (m.map) m.map.dispose(); m.dispose(); }
      materialy = new Map(); pohyblive = [];
    }
    function material(mat, skupina) {
      const NS = koren.NS, k = `${mat.druh}|${mat.dekor}|${skupina === 'zada' ? 'z' : ''}`;
      if (materialy.has(k)) return materialy.get(k);
      const D = NS.DEKORY[mat.dekor] || { barva: '#dddddd' };
      const m = new THREE.MeshStandardMaterial({ map: texturaDreva(THREE, D.barva, NS.maVlakna(mat), k.length * 31 + 7), roughness: mat.druh === 'MDF' ? 0.45 : 0.7, metalness: 0 });
      materialy.set(k, m);
      return m;
    }
    const caryMat = new THREE.LineBasicMaterial({ color: 0x3a3127, transparent: true, opacity: 0.45 });

    function postav(vysledek) {
      V = vysledek;
      zlikviduj();
      scena.background = new THREE.Color(tmave() ? 0x1d2228 : 0xe7ecf1);
      if (!V || !V.dilce.length) return;
      const S = V.sestava, sx = (S.x0 + S.x1) / 2, sy = 0, sz = (S.z0 + S.z1) / 2;
      stred = new THREE.Vector3(0, (S.y1 - S.y0) / 2, 0);
      const stredKorpusu = V.korpusy.map((K) => new THREE.Vector3(K.ox + +K.k.sirka / 2 - sx, K.oy + +K.k.vyska / 2 - sy, +K.k.hloubka / 2 - sz));
      const zasMapa = new Map(V.zasuvky.map((z) => [z.id, z]));
      // podlaha
      const podl = new THREE.Mesh(new THREE.PlaneGeometry((S.x1 - S.x0) + 2000, 2400), new THREE.MeshStandardMaterial({ color: tmave() ? 0x2c3238 : 0xd4d9de, roughness: 1 }));
      podl.rotation.x = -Math.PI / 2; podl.position.set(0, -0.5, 400); koren3.add(podl);
      for (const d of V.dilce) {
        const b = d.box, w = b.x1 - b.x0, h = b.y1 - b.y0, l = b.z1 - b.z0;
        const geo = new THREE.BoxGeometry(w, h, l);
        // UV: textura má vlákna svisle (podél v); u dílců s vlákny podél x (dno, police) nebo z (bok zásuvky) prohodit u ↔ v
        if (d.osaD === 'x' || (d.osaD === 'z' && d.osaT === 'x')) {
          const uv = geo.attributes.uv;
          for (let i = 0; i < uv.count; i++) { const u = uv.getX(i); uv.setXY(i, uv.getY(i), u); }
        }
        const mat = material(d.mat, d.skupina);
        const mesh = new THREE.Mesh(geo, mat);
        const hrany = new THREE.LineSegments(new THREE.EdgesGeometry(geo), caryMat);
        const g = new THREE.Group(); g.add(mesh, hrany);
        const c = new THREE.Vector3((b.x0 + b.x1) / 2 - sx, (b.y0 + b.y1) / 2 - sy, (b.z0 + b.z1) / 2 - sz);
        const rozp = d.korpus >= 0 ? c.clone().sub(stredKorpusu[d.korpus]) : new THREE.Vector3(0, 400, 0);
        const info = { d, g, c, rozp, typ: null };
        if (d.pohyb && d.pohyb.typ === 'dvere') {
          // pivot na zadní hraně dvířek u závěsů
          const L = d.pohyb.zaves !== 'P';
          const pivot = new THREE.Group();
          const px = (L ? b.x0 : b.x1) - sx, pz = b.z0 - sz;
          pivot.position.set(px, c.y, pz);
          g.position.set(c.x - px, 0, c.z - pz);
          pivot.add(g); koren3.add(pivot);
          Object.assign(info, { typ: 'dvere', pivot, L, p0: pivot.position.clone() });
        } else if (d.pohyb && d.pohyb.typ === 'zasuvka') {
          g.position.copy(c); koren3.add(g);
          const z = zasMapa.get(d.pohyb.id);
          Object.assign(info, { typ: 'zasuvka', L: z ? z.L : 300 });
        } else { g.position.copy(c); koren3.add(g); }
        pohyblive.push(info);
      }
      // nožičky
      const nmat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.3 });
      materialy.set('_nozicky', nmat);
      for (const K of V.korpusy) {
        if (K.rozmery.sokl !== 'nozicky') continue;
        const W = +K.k.sirka, D = +K.k.hloubka, hv = K.rozmery.sv;
        const xs = W > 900 ? [50, W / 2, W - 50] : [50, W - 50];
        for (const x of xs) for (const z of [60, D - 80]) {
          const n = new THREE.Mesh(new THREE.CylinderGeometry(15, 18, hv, 16), nmat);
          n.position.set(K.ox + x - sx, hv / 2, z - sz);
          const st = stredKorpusu[K.index];
          pohyblive.push({ g: n, c: n.position.clone(), rozp: n.position.clone().sub(st), typ: 'noha' });
          koren3.add(n);
        }
      }
      const m = Math.max(S.x1 - S.x0, S.y1 - S.y0, 600);
      orbit.vzd = m * 2.1 + 400;
      svetlo.position.set(m * 0.5, m * 1.4, m * 1.4); svetlo.target.position.copy(stred);
      svetlo2.position.set(-m, m * 0.5, m * 0.6);
      pohyb(true);
      spinave = true;
    }

    function pohyb() {
      for (const p of pohyblive) {
        const ex = p.rozp.clone().multiplyScalar(akt.rozlozit * 0.9);
        if (p.typ === 'dvere') {
          p.pivot.rotation.y = (p.L ? -1 : 1) * akt.dvere * 100 * RAD;
          p.pivot.position.copy(p.p0).add(ex).add(new THREE.Vector3(0, 0, akt.rozlozit * 220));
        } else if (p.typ === 'zasuvka') {
          p.g.position.copy(p.c).add(ex).add(new THREE.Vector3(0, 0, akt.zasuvky * p.L * 0.8 + akt.rozlozit * 120));
        } else p.g.position.copy(p.c).add(ex);
      }
    }

    function nastavKameru() {
      const d = orbit.vzd * orbit.nasob, az = orbit.az * RAD, el = orbit.el * RAD;
      kamera.position.set(stred.x + d * Math.cos(el) * Math.sin(az), stred.y + d * Math.sin(el), stred.z + d * Math.cos(el) * Math.cos(az));
      kamera.lookAt(stred); kamera.near = Math.max(1, d * 0.01); kamera.far = d * 20; kamera.updateProjectionMatrix();
    }
    const ukaz = new Map(); let pinch0 = null;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]); el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', (e) => {
      if (!ukaz.has(e.pointerId)) return;
      const [x0, y0] = ukaz.get(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 1) { orbit.az -= (e.clientX - x0) * 0.4; orbit.el = Math.max(-30, Math.min(89, orbit.el + (e.clientY - y0) * 0.3)); }
      else if (ukaz.size === 2) { const [a, b] = [...ukaz.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) orbit.nasob = Math.max(0.15, Math.min(4, orbit.nasob * pinch0 / d)); pinch0 = d; }
      spinave = true;
    });
    const pust = (e) => { ukaz.delete(e.pointerId); if (ukaz.size < 2) pinch0 = null; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', pust); el.addEventListener('pointercancel', pust);
    el.addEventListener('wheel', (e) => { e.preventDefault(); orbit.nasob = Math.max(0.15, Math.min(4, orbit.nasob * Math.exp(e.deltaY * 0.001))); spinave = true; }, { passive: false });

    function velikost() {
      const w = Math.max(10, obal.clientWidth), h = Math.max(10, obal.clientHeight);
      renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
      renderer.setSize(w, h, false); kamera.aspect = w / h; spinave = true;
    }
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    const mo = new MutationObserver(() => { if (V) postav(V); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    let tPred = 0;
    (function smycka(tt) {
      if (zrusen) return;
      const dt = Math.min(0.1, Math.max(0, ((tt || 0) - tPred) / 1000)); tPred = tt || 0;
      let anim = false;
      for (const k of Object.keys(cil)) {
        const r = cil[k] - akt[k];
        if (Math.abs(r) > 1e-3) { akt[k] += Math.sign(r) * Math.min(Math.abs(r), dt * 1.4); anim = true; } else akt[k] = cil[k];
      }
      if (anim) { pohyb(); spinave = true; }
      if (viditelne && spinave && !document.hidden) { spinave = false; nastavKameru(); renderer.render(scena, kamera); }
      requestAnimationFrame(smycka);
    })();
    return {
      postav,
      nastav(o) { Object.assign(cil, o); spinave = true; },
      okamzite(o) { Object.assign(cil, o); Object.assign(akt, o); pohyb(); spinave = true; },
      get cil() { return Object.assign({}, cil); },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, sirka: renderer.domElement.width, vyska: renderer.domElement.height, objektu: koren3.children.length, akt: Object.assign({}, akt) }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(); renderer.dispose(); el.remove(); },
    };
  }
  koren.NS3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
