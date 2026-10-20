/* ============================================================
   Šablony pro horní frézku – 3D animace (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Obrobek, šablona (vytažený obrys s otvory), dorazy, frézka s kroužkem a frézou; fréza jede po dráze
   středu kroužku a za ní se kreslí řez (pás šířky frézy). Kruhové rameno se otáčí kolem čepu.
   Model (x, y, z nahoru) → three (x, z, −y). Kreslí se jen když je vidět (a když se hýbe nebo změní).
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;

  function vytvor(obal) {
    const THREE = koren.THREE, G = koren.SFG;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene(), kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e6);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 0.9), svetlo = new THREE.DirectionalLight(0xffffff, 1.5);
    scena.add(hemi, svetlo, svetlo.target);
    const skupina = new THREE.Group(); scena.add(skupina);
    const orbit = { az: -28, el: 42, vzd: 800, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = true, spinave = true, zrusen = false;
    let anim = { bezi: true, t: 0, rychlost: 1, delka: 1, draha: null, frezka: null, pas: null, pasN: 0, otoc: null, kumul: null, posl: 0 };

    const tmave = () => { const t = document.documentElement.getAttribute('data-theme') || ''; return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches); };
    function zlikviduj() {
      for (const o of skupina.children.slice()) {
        skupina.remove(o);
        o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) { const m = Array.isArray(x.material) ? x.material : [x.material]; for (const q of m) q.dispose(); } });
      }
    }
    /** oblast → THREE.Shape[] (vnější + díry) */
    function tvary(polys) {
      const out = [];
      for (const k of G.komponenty(polys)) {
        const sh = new THREE.Shape(k[0].map((q) => new THREE.Vector2(q[0], q[1])));
        for (const d of k.slice(1)) sh.holes.push(new THREE.Path(d.map((q) => new THREE.Vector2(q[0], q[1]))));
        out.push(sh);
      }
      return out;
    }
    function vytah(polys, z0, z1, mat) {
      const g = new THREE.ExtrudeGeometry(tvary(polys), { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
      g.rotateX(-Math.PI / 2); g.translate(0, z0, 0);
      return new THREE.Mesh(g, mat);
    }
    const P3 = (x, y, z) => new THREE.Vector3(x, z, -y);

    function postav(dil, N) {
      zlikviduj();
      if (!dil) return;
      const tm = tmave();
      scena.background = new THREE.Color(tm ? 0x1d2228 : 0xe4ebf2);
      const T = N.tlSablony, tob = N.tlObrobku, V = dil.V, ob = dil.deska.obal;
      const hl = Math.min(dil.hloubka || N.hloubka, tob), hk = Math.min(N.vyskaKrouzku, T - 0.2);
      // obrobek
      const mx = 40, wx = ob.x1 - ob.x0 + 2 * mx, wy = ob.y1 - ob.y0 + 2 * mx;
      const obr = new THREE.Mesh(new THREE.BoxGeometry(wx, tob, wy), new THREE.MeshStandardMaterial({ color: 0xd9b98a, roughness: 0.85 }));
      let oy0 = ob.y0 - mx, oy1 = ob.y1 + mx;
      if (dil.hrana) { oy0 = 0; oy1 = dil.hrana.tl; }
      else if ((dil.dorazy || []).length) oy0 = 0;
      obr.scale.set(1, 1, (oy1 - oy0) / wy);
      obr.position.copy(P3((ob.x0 + ob.x1) / 2, (oy0 + oy1) / 2, -tob / 2));
      skupina.add(obr);
      // řez = pás šířky frézy podél dráhy (kreslí se postupně)
      const draha = (dil.draha || []).filter((p) => p.length >= 2);
      const jig = new THREE.Group(), jigVnitrek = new THREE.Group(); jig.add(jigVnitrek); skupina.add(jig);
      const plMat = new THREE.MeshStandardMaterial({ color: 0x5f9e6e, roughness: 0.6, transparent: true, opacity: 0.88 });
      if (dil.deska.polys.length) jigVnitrek.add(vytah(dil.deska.polys, 0.02, T, plMat));
      for (const d of dil.dorazy || []) jigVnitrek.add(vytah(d.polys, -(d.v || 15), 0.02, new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.7 })));
      // frézka
      const fr = new THREE.Group();
      const kov = new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.6, roughness: 0.35 });
      const zakl = new THREE.Mesh(new THREE.CylinderGeometry(N.Dz / 2, N.Dz / 2, 6, 48), new THREE.MeshStandardMaterial({ color: 0x9aa6b2, transparent: true, opacity: 0.45 }));
      zakl.position.y = T + 3; fr.add(zakl);
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(38, 42, 120, 32), new THREE.MeshStandardMaterial({ color: 0x3a6fb0, transparent: true, opacity: 0.35, roughness: 0.5 }));
      motor.position.y = T + 70; fr.add(motor);
      if (!V.lozisko) { const kr = new THREE.Mesh(new THREE.CylinderGeometry(V.Rv, V.Rv, hk + 4, 32), new THREE.MeshStandardMaterial({ color: 0x2f62b8, metalness: 0.4, roughness: 0.4 })); kr.position.y = T - hk + (hk + 4) / 2; fr.add(kr); }
      const fz = new THREE.Mesh(new THREE.CylinderGeometry(V.Rf, V.Rf, T + 30 + hl, 24), new THREE.MeshStandardMaterial({ color: 0xd04a00, metalness: 0.5, roughness: 0.3 }));
      fz.position.y = (T + 30 - hl) / 2; fr.add(fz);
      if (V.lozisko) { const lz = new THREE.Mesh(new THREE.CylinderGeometry(V.Rv, V.Rv, Math.min(6, T), 32), kov); lz.position.y = T / 2; fr.add(lz); }
      // pás řezu
      let pas = null, kumul = [0], body = [];
      for (const p of draha) for (let i = 0; i <= p.length; i++) body.push({ q: p[i % p.length], skok: i === 0 && body.length > 0 });
      for (let i = 1; i < body.length; i++) kumul.push(kumul[i - 1] + (body[i].skok ? 0 : G.vzd(body[i - 1].q, body[i].q)));
      if (body.length > 1) {
        const n = body.length - 1, poz = new Float32Array(n * 18);
        for (let i = 0; i < n; i++) {
          const a = body[i].q, b = body[i + 1].q;
          if (body[i + 1].skok) continue;
          const d = G.jednot(G.odecti(b, a)), nn = [-d[1] * V.Rf, d[0] * V.Rf];
          const A1 = P3(a[0] + nn[0], a[1] + nn[1], 0.15), A2 = P3(a[0] - nn[0], a[1] - nn[1], 0.15), B1 = P3(b[0] + nn[0], b[1] + nn[1], 0.15), B2 = P3(b[0] - nn[0], b[1] - nn[1], 0.15);
          const v = [A1, A2, B1, A2, B2, B1];
          for (let j = 0; j < 6; j++) { poz[i * 18 + j * 3] = v[j].x; poz[i * 18 + j * 3 + 1] = v[j].y; poz[i * 18 + j * 3 + 2] = v[j].z; }
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(poz, 3)); g.setDrawRange(0, 0);
        pas = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x4a2c10, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
        skupina.add(pas);
      }
      if (dil.pohyb === 'otoc' && dil.pivot) {
        // rameno: frézka pevně na rameni, celé se otáčí kolem čepu
        jigVnitrek.add(fr);
        const pv = P3(dil.pivot.x, dil.pivot.y, 0);
        jig.position.copy(pv); jigVnitrek.position.set(-pv.x, 0, -pv.z);
        const cep = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, T + 14, 16), kov); cep.position.set(pv.x, T / 2, pv.z); skupina.add(cep);
        anim.otoc = jig;
      } else { skupina.add(fr); anim.otoc = null; }
      Object.assign(anim, { body, kumul, delka: Math.max(1, kumul[kumul.length - 1]), frezka: fr, pas, pasN: body.length - 1, t: anim.t || 0 });
      polohuj();
      const m = Math.max(ob.x1 - ob.x0, ob.y1 - ob.y0);
      stred = P3((ob.x0 + ob.x1) / 2, (ob.y0 + ob.y1) / 2, 0);
      orbit.vzd = m * 1.5 + 160;
      svetlo.position.set(stred.x + m * 0.6, m * 1.2 + 200, stred.z + m * 0.9); svetlo.target.position.copy(stred);
      spinave = true;
    }

    function polohuj() {
      const A = anim;
      if (!A.frezka || A.body.length < 2) return;
      const s = (A.t % 1) * A.delka;
      let i = 1; while (i < A.kumul.length - 1 && A.kumul[i] < s) i++;
      const a = A.body[i - 1].q, b = A.body[i].q, l = A.kumul[i] - A.kumul[i - 1], f = l > 1e-9 ? (s - A.kumul[i - 1]) / l : 0;
      if (A.otoc) { A.otoc.rotation.y = (A.t % 1) * Math.PI * 2; A.frezka.position.set(0, 0, 0); }
      else A.frezka.position.copy(P3(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0));
      if (A.pas) A.pas.geometry.setDrawRange(0, Math.min(A.pasN, i) * 6);
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
      else if (ukaz.size === 2) { const [a, b] = [...ukaz.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) orbit.nasob = Math.max(0.1, Math.min(5, orbit.nasob * pinch0 / d)); pinch0 = d; }
      spinave = true;
    });
    const pust = (e) => { ukaz.delete(e.pointerId); if (ukaz.size < 2) pinch0 = null; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', pust); el.addEventListener('pointercancel', pust);
    el.addEventListener('wheel', (e) => { e.preventDefault(); orbit.nasob = Math.max(0.1, Math.min(5, orbit.nasob * Math.exp(e.deltaY * 0.001))); spinave = true; }, { passive: false });

    function velikost() {
      const w = Math.max(10, obal.clientWidth), h = Math.max(10, obal.clientHeight);
      renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
      renderer.setSize(w, h, false); kamera.aspect = w / h; spinave = true;
    }
    let posledni = { dil: null, N: null };
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    const mo = new MutationObserver(() => { if (posledni.dil) postav(posledni.dil, posledni.N); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    (function smycka(cas) {
      if (zrusen) return;
      const dt = anim.posl ? Math.min(0.1, (cas - anim.posl) / 1000) : 0; anim.posl = cas;
      if (viditelne && !document.hidden) {
        if (anim.bezi && anim.body && anim.body.length > 1) { anim.t += dt * anim.rychlost * 60 / anim.delka; polohuj(); spinave = true; }
        if (spinave) { spinave = false; nastavKameru(); renderer.render(scena, kamera); }
      }
      requestAnimationFrame(smycka);
    })(0);
    return {
      aktualizuj(dil, N) { posledni = { dil, N }; anim.t = 0; postav(dil, N); },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      prehraj(b) { anim.bezi = b == null ? !anim.bezi : !!b; spinave = true; return anim.bezi; },
      rychlost(k) { anim.rychlost = k; },
      get stav() { return { viditelne, sirka: renderer.domElement.width, vyska: renderer.domElement.height, objektu: skupina.children.length, t: anim.t, bezi: anim.bezi }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(); renderer.dispose(); el.remove(); },
    };
  }
  koren.SF3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
