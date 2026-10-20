/* ============================================================
   Ostření – 3D náhled (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Režim 'vozik': kámen, vozík s válečkem, svěrkou a nožem v poloze pro dané vyložení,
   animace tahu po kameni (úhel se při tahu nemění). Režim 'dil': síť přípravku z manifoldu.
   Rám vozíku (x k čelu, z kolmo k loži, y napříč) → three (x, y nahoru, z napříč).
   Kreslí se jen při změně / animaci a když je plátno vidět.
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
    const kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e5);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 0.95);
    const svetlo = new THREE.DirectionalLight(0xffffff, 1.5);
    scena.add(hemi, svetlo, svetlo.target);
    const skupina = new THREE.Group(); scena.add(skupina);
    const orbit = { az: 28, el: 22, vzd: 400, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = true, spinave = true, zrusen = false;
    let stav = { rezim: 'vozik', data: null, animace: false };
    let vozikSk = null, popisek = null, faze = 0, posledni = 0, amplituda = 40;

    const tmave = () => { const t = document.documentElement.getAttribute('data-theme') || ''; return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches); };
    function zlikviduj() {
      for (const o of skupina.children.slice()) {
        skupina.remove(o);
        o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) { const m = Array.isArray(x.material) ? x.material : [x.material]; for (const q of m) { if (q.map) q.map.dispose(); q.dispose(); } } });
      }
      vozikSk = null; popisek = null;
    }
    const mat = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.6 : r, metalness: m || 0 });
    /** vytažený polygon v rovině (x, y) → three: x, y, napříč z ∈ [z0, z1] */
    function vytah(pts, z0, z1, m) {
      const tv = new THREE.Shape(); pts.forEach((p, i) => (i ? tv.lineTo(p[0], p[1]) : tv.moveTo(p[0], p[1]))); tv.closePath();
      const g = new THREE.ExtrudeGeometry(tv, { depth: z1 - z0, bevelEnabled: false, curveSegments: 16 });
      g.translate(0, 0, z0);
      return new THREE.Mesh(g, m);
    }
    function textura(txt) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 96;
      const g = c.getContext('2d'); g.fillStyle = 'rgba(179,38,30,0.92)'; g.beginPath(); g.roundRect(4, 8, 248, 80, 16); g.fill();
      g.fillStyle = '#ffffff'; g.font = 'bold 54px Liberation Sans, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, 50);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    }

    function postavVozik(d) {
      const { v, theta, L, nuz, kamen, s } = d, tm = tmave();
      scena.background = new THREE.Color(tm ? 0x1d2228 : 0xe4ebf2);
      // pracovní deska a kámen
      const Lk = kamen.delka, Wk = kamen.sirka, Tk = kamen.vyska;
      const deska = new THREE.Mesh(new THREE.BoxGeometry(Lk + 160, 6, Math.max(160, v.B + 80)), mat(tm ? 0x5b4a36 : 0xcdb38c, 0.9));
      deska.position.set(0, (s > 0 ? 0 : -Tk) - 3, 0); skupina.add(deska);
      const kam = new THREE.Mesh(new THREE.BoxGeometry(Lk, Tk, Wk), mat(kamen.rezim === 'sklo' ? 0x7d8a96 : 0x8b8f97, 0.95));
      kam.position.set(0, s - Tk / 2, 0); skupina.add(kam);
      // vozík (vlastní skupina – při animaci se posouvá)
      const vg = new THREE.Group();
      const zel = mat(0x3f8f5a, 0.55), ocel = mat(0xc4ccd4, 0.35, 0.25), tmavaOcel = mat(0x5c6066, 0.4, 0.6);
      vg.add(vytah(v.profil, -v.B / 2, -v.ws / 2, zel), vytah(v.profil, v.ws / 2, v.B / 2, zel));
      // most lože nad válečkem
      vg.add(vytah([[-(v.r + 1.5), v.zs], [v.r + 1.5, v.zs], [v.r + 1.5, v.H], [-(v.r + 1.5), v.H]], -v.ws / 2, v.ws / 2, zel));
      const val = new THREE.Mesh(new THREE.CylinderGeometry(v.r, v.r, v.wr, 40), mat(0xd0d4da, 0.35, 0.5)); val.rotation.x = Math.PI / 2; vg.add(val);
      const osa = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, v.B + 14, 16), tmavaOcel); osa.rotation.x = Math.PI / 2; vg.add(osa);
      // nůž
      const t = nuz.tloustka, D = L + v.a, w = Math.min(nuz.sirka, v.sevreni - 1), xb = D - 170;
      vg.add(vytah([[xb, v.H], [D - t / Math.tan(theta * RAD), v.H], [D, v.H + t], [xb, v.H + t]], -w / 2, w / 2, ocel));
      // svěrka a šrouby
      vg.add(vytah([[v.xs - v.lc / 2, v.H + t], [v.xs + v.lc / 2, v.H + t], [v.xs + v.lc / 2, v.H + t + v.tc], [v.xs - v.lc / 2, v.H + t + v.tc]], -v.B / 2, v.B / 2, zel));
      for (const y of [-v.ys, v.ys]) {
        const h = v.H + t + v.tc + 10 - v.zTop, sr = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, h, 14), tmavaOcel);
        sr.position.set(v.xs, v.zTop + h / 2, y); vg.add(sr);
        const kr = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 26), tmavaOcel); kr.position.set(v.xs, v.H + t + v.tc + 6, y); vg.add(kr);
      }
      vg.rotation.z = -theta * RAD;
      vozikSk = new THREE.Group(); vozikSk.add(vg); vg.position.set(0, v.r, 0);
      skupina.add(vozikSk);
      // posun, aby ostří bylo uprostřed kamene: E_x = ostří od osy válečku
      const Ex = (v.H + t) * Math.sin(theta * RAD) + D * Math.cos(theta * RAD);
      vozikSk.userData.x0 = -Ex / 2 - 10;
      vozikSk.position.x = vozikSk.userData.x0;
      amplituda = Math.max(0, (Lk - Ex - v.r * 2 - 20) / 2 - 5);
      // popisek úhlu u ostří
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura(String(Math.round(theta * 10) / 10).replace('.', ',') + '°'), depthTest: false }));
      spr.scale.set(36, 13.5, 1); spr.position.set(Ex - 16, s + 22, w / 2 + 12); spr.renderOrder = 5;
      vozikSk.add(spr); popisek = spr;
      // oblouk úhlu
      const body = []; for (let i = 0; i <= 20; i++) { const a = (180 - theta * i / 20) * RAD; body.push(new THREE.Vector3(Ex + 26 * Math.cos(a), s + 0.4 + 26 * Math.sin(a), w / 2 + 1)); }
      const car = new THREE.Line(new THREE.BufferGeometry().setFromPoints(body), new THREE.LineBasicMaterial({ color: 0xb3261e, depthTest: false }));
      car.renderOrder = 4; vozikSk.add(car);
      const m = Math.max(Lk, 220);
      stred = new THREE.Vector3(0, s + 20, 0); orbit.vzd = m * 1.35 + 80;
      svetlo.position.set(m * 0.4, m * 1.1, m * 0.8); svetlo.target.position.copy(stred);
    }
    function postavDil(d) {
      const tm = tmave();
      scena.background = new THREE.Color(tm ? 0x1d2228 : 0xe4ebf2);
      const g = new THREE.BufferGeometry(), p = d.sit.poz, poz = new Float32Array(p.length);
      for (let i = 0; i < p.length; i += 3) { poz[i] = p[i]; poz[i + 1] = p[i + 2]; poz[i + 2] = -p[i + 1]; }
      g.setAttribute('position', new THREE.BufferAttribute(poz, 3)); g.setIndex(new THREE.BufferAttribute(d.sit.idx, 1));
      const g2 = g.toNonIndexed(); g.dispose(); g2.computeVertexNormals();
      skupina.add(new THREE.Mesh(g2, mat(0x3f8f5a, 0.5)));
      const [sx, sy, sz] = d.sit.rozmer, m = Math.max(sx, sy, sz, 30);
      const pod = new THREE.Mesh(new THREE.BoxGeometry(Math.max(220, sx + 40), 2, Math.max(220, sy + 40)), mat(tm ? 0x30363d : 0xcfd6de, 0.95));
      pod.position.y = -1; skupina.add(pod);
      stred = new THREE.Vector3(0, sz / 2, 0); orbit.vzd = m * 2.2 + 40;
      svetlo.position.set(m, m * 2, m * 1.4); svetlo.target.position.copy(stred);
    }
    function aktualizuj(d) {
      stav = Object.assign(stav, d);
      zlikviduj();
      if (!stav.data) return;
      if (stav.rezim === 'dil' && stav.data.sit) postavDil(stav.data); else if (stav.data.v) postavVozik(stav.data);
      spinave = true;
    }
    function nastavKameru() {
      const d = orbit.vzd * orbit.nasob, az = orbit.az * RAD, el = orbit.el * RAD;
      kamera.position.set(stred.x + d * Math.cos(el) * Math.sin(az), stred.y + d * Math.sin(el), stred.z + d * Math.cos(el) * Math.cos(az));
      kamera.lookAt(stred); kamera.near = Math.max(0.5, d * 0.01); kamera.far = d * 20; kamera.updateProjectionMatrix();
    }
    const ukaz = new Map(); let pinch0 = null;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]); el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', (e) => {
      if (!ukaz.has(e.pointerId)) return;
      const [x0, y0] = ukaz.get(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 1) { orbit.az -= (e.clientX - x0) * 0.4; orbit.el = Math.max(-80, Math.min(89, orbit.el + (e.clientY - y0) * 0.3)); }
      else if (ukaz.size === 2) { const [a, b] = [...ukaz.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) orbit.nasob = Math.max(0.15, Math.min(5, orbit.nasob * pinch0 / d)); pinch0 = d; }
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
    const mo = new MutationObserver(() => aktualizuj({})); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    (function smycka(cas) {
      if (zrusen) return;
      const dt = posledni ? Math.min(0.1, (cas - posledni) / 1000) : 0; posledni = cas || 0;
      if (viditelne && !document.hidden) {
        if (stav.animace && vozikSk) { faze += dt * 1.6; vozikSk.position.x = vozikSk.userData.x0 + amplituda * Math.sin(faze); spinave = true; }
        if (spinave) { spinave = false; nastavKameru(); renderer.render(scena, kamera); }
      }
      requestAnimationFrame(smycka);
    })();
    return {
      aktualizuj,
      animace(a) { stav.animace = !!a; spinave = true; },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, sirka: renderer.domElement.width, vyska: renderer.domElement.height, objektu: skupina.children.length, rezim: stav.rezim, animace: stav.animace, x: vozikSk ? vozikSk.position.x : null }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(); renderer.dispose(); el.remove(); },
    };
  }
  koren.OSTR3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
