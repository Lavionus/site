/* ============================================================
   Přípravky pro pilu a vrtačku – 3D náhled (three.js r160, globální THREE)
   Svět: x vpravo, y od obsluhy (posuv), z nahoru → three: (x, z, −y).
   Stroj se kreslí zjednodušeně podle sestava.stroj; přípravek z dílů (desky = vytažený obrys,
   tištěné díly = síť z manifoldu, dokud není načtená, obalový kvádr). Animace použití: posuv saní,
   zdvih kotouče, sklopení hlavy pokosové pily, vrtání. Kreslí se jen když je vidět.
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
    const kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e6);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 0.95), svetlo = new THREE.DirectionalLight(0xffffff, 1.5);
    scena.add(hemi, svetlo, svetlo.target);
    const koren3 = new THREE.Group(); koren3.rotation.x = -Math.PI / 2; scena.add(koren3);   // svět z nahoru → three y nahoru
    const orbit = { az: -35, el: 32, vzd: 1500, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = true, spinave = true, zrusen = false, hraje = true, t0 = performance.now();
    let anim = null, data = null, site = {};

    const tmave = () => { const t = document.documentElement.getAttribute('data-theme') || ''; return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches); };
    function zlikviduj() {
      for (const o of koren3.children.slice()) {
        koren3.remove(o);
        o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) (Array.isArray(x.material) ? x.material : [x.material]).forEach((m) => m.dispose()); });
      }
    }
    const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0 }, o || {}));
    function box(g, a, b, m) { const s = new THREE.Mesh(new THREE.BoxGeometry(b[0] - a[0], b[1] - a[1], b[2] - a[2]), m); s.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); g.add(s); return s; }
    /** válec s osou 'x' | 'y' | 'z' */
    function valec(g, osa, c, r, h, m, n) { const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, n || 48), m); if (osa === 'z') s.rotation.x = Math.PI / 2; else if (osa === 'x') s.rotation.z = Math.PI / 2; s.position.set(c[0], c[1], c[2]); g.add(s); return s; }
    function matice(u) {
      const U = new THREE.Vector3(...u.u), V = new THREE.Vector3(...u.v), Nn = new THREE.Vector3().crossVectors(U, V);
      const M = new THREE.Matrix4().makeBasis(U, V, Nn); M.setPosition(u.o[0], u.o[1], u.o[2]); return M;
    }
    function deskaMesh(d, barva) {
      const tvar = new THREE.Shape(d.obrys.map((p) => new THREE.Vector2(p[0], p[1])));
      for (const q of d.otvory || []) { const p = new THREE.Path(); p.absarc(q.x, q.y, q.d / 2, 0, Math.PI * 2, true); tvar.holes.push(p); }
      for (const v of d.vyrezy || []) tvar.holes.push(new THREE.Path(v.map((p) => new THREE.Vector2(p[0], p[1]))));
      const geo = new THREE.ExtrudeGeometry(tvar, { depth: d.tl3d || d.tl, bevelEnabled: false, curveSegments: 20 });
      geo.applyMatrix4(matice(d.um));
      return new THREE.Mesh(geo, mat(barva));
    }
    function tiskMesh(d) {
      const s = site[d.id];
      let geo;
      if (s) {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(s.poz), 3)); g.setIndex(new THREE.BufferAttribute(new Uint32Array(s.idx), 1));
        geo = g.toNonIndexed(); g.dispose();
      } else {
        const b = koren.PP.bboxCSG(d.csg); geo = new THREE.BoxGeometry(b.b[0] - b.a[0], b.b[1] - b.a[1], b.b[2] - b.a[2]); geo.translate((b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2, (b.a[2] + b.b[2]) / 2);
      }
      geo.applyMatrix4(matice(d.um)); geo.computeVertexNormals();
      return new THREE.Mesh(geo, mat(s ? 0xe0782e : 0xe8a873, { roughness: 0.5, transparent: !s, opacity: s ? 1 : 0.6 }));
    }

    function postav() {
      zlikviduj(); anim = null;
      if (!data) return;
      const N = data, S = N.sestava, s = N.s, tm = tmave();
      scena.background = new THREE.Color(tm ? 0x1d2228 : 0xe4ebf2);
      const kov = mat(0x9aa3ab, { metalness: 0.45, roughness: 0.45 }), tmavy = mat(0x3a3f44, { metalness: 0.3, roughness: 0.6 }), cepel = mat(0xc7ccd1, { metalness: 0.25, roughness: 0.35 });
      const drevo = mat(0xc49a63), cerv = mat(0xc0392b);
      const stroj = new THREE.Group(), pohyb = new THREE.Group(), pevne = new THREE.Group();
      koren3.add(stroj, pevne, pohyb);
      const A = { typ: S.stroj, pohyb, start: 0 };
      if (S.stroj === 'stolni') {
        const H = s.stulHloubka, yb = H / 2, R = s.kotoucD / 2, e = S.vyskaKotouce || 30;
        box(stroj, [-s.stulL, 0, -30], [s.stulP, H, 0], kov);
        const drazky = [[-s.drazkaL - s.drazkaS / 2, -s.drazkaL + s.drazkaS / 2]];
        if (s.drazkaP > 0) drazky.push([s.kerf + s.drazkaP - s.drazkaS / 2, s.kerf + s.drazkaP + s.drazkaS / 2]);
        for (const [a, b] of drazky) box(stroj, [a, 0, -0.3], [b, H, 0.15], tmavy);
        box(stroj, [-12, yb - R - 10, -0.3], [12 + s.kerf, yb + R + 10, 0.12], tmavy);   // otvor vložky
        const kot = new THREE.Group(); kot.position.set(s.kerf / 2, yb, -(R - e)); stroj.add(kot);
        valec(kot, 'x', [0, 0, 0], R, s.kerf, cepel, 72); valec(kot, 'x', [0, 0, 0], 22, s.kerf + 6, tmavy, 24);
        for (let i = 0; i < 24; i++) { const z = new THREE.Mesh(new THREE.BoxGeometry(s.kerf + 0.4, 6, 4), tmavy); const u = i / 24 * Math.PI * 2; z.position.set(0, (R - 2) * Math.cos(u), (R - 2) * Math.sin(u)); z.rotation.x = u; kot.add(z); }
        A.kotouc = kot; A.R = R; A.e = e;
        if (S.ripX != null) box(stroj, [S.ripX, -20, 0], [S.ripX + (S.ripS || 50), H + 20, S.ripV || 60], mat(0x5d6d7e, { metalness: 0.4 }));
        if (S.vlozka) A.kotZ0 = -(R - e);
      } else if (S.stroj === 'okruzni') {
        const sx = 0, pila = new THREE.Group(); pohyb.add(pila);
        box(pila, [sx, S.pravW + 0.5, S.tlZ], [sx + 300, S.pravW + S.patkaW, S.tlZ + 4], kov);
        const yk = S.pravW + S.offset + S.kerf / 2;
        valec(pila, 'y', [sx + 160, yk, S.tlZ + 8], 82, S.kerf, cepel, 64);
        box(pila, [sx + 70, yk - 8, S.tlZ + 4], [sx + 250, yk + 8, S.tlZ + 100], mat(0x6c7a89, { transparent: true, opacity: 0.55 }));
        valec(pila, 'y', [sx + 160, yk + 60, S.tlZ + 70], 45, 90, mat(0xd35400, { roughness: 0.5 }));
        box(pila, [sx + 120, yk + 20, S.tlZ + 115], [sx + 260, yk + 40, S.tlZ + 135], tmavy);
        box(stroj, [-100, -200, -60], [S.Lr + 100, 500, -18 - 0.1], mat(0x7b6a58));
      } else if (S.stroj === 'pokosova') {
        box(stroj, [-450, -250, -40], [450, 250, 0], kov);
        valec(stroj, 'z', [0, -40, -1], 160, 2, tmavy);
        box(stroj, [-450, 0, 0], [-8, S.pravTl, S.pravV], mat(0x5d6d7e, { metalness: 0.4 })); box(stroj, [8, 0, 0], [450, S.pravTl, S.pravV], mat(0x5d6d7e, { metalness: 0.4 }));
        box(stroj, [-20, 120, 0], [20, 170, 220], tmavy);
        const hl = new THREE.Group(); hl.position.set(0, 145, 200); stroj.add(hl);
        const vnitr = new THREE.Group(); vnitr.position.set(0, -145, -200 + 150); hl.add(vnitr);
        valec(vnitr, 'x', [0, -20, 0], 127, 2.8, cepel, 72);
        box(vnitr, [-6, -130, 0], [6, 60, 140], mat(0x6c7a89, { transparent: true, opacity: 0.6 }));
        valec(vnitr, 'x', [70, -20, 30], 50, 120, mat(0x2e86c1, { roughness: 0.5 }));
        box(vnitr, [-15, -200, 80], [15, -130, 110], tmavy);
        A.hlava = hl;
      } else if (S.stroj === 'vrtacka') {
        box(stroj, [-170, -140, -30], [170, 140, 0], kov);
        valec(stroj, 'z', [0, 210, 150], 38, 720, kov, 32);
        box(stroj, [-130, -40, -360], [130, 300, -330], tmavy);
        box(stroj, [-90, 40, 380], [90, 260, 520], mat(0x2e86c1, { roughness: 0.5 }));
        const vreteno = new THREE.Group(); stroj.add(vreteno);
        valec(vreteno, 'z', [0, 0, 330], 22, 100, kov, 32); valec(vreteno, 'z', [0, 0, 262], 26, 36, tmavy, 32);
        valec(vreteno, 'z', [0, 0, 200], 4, 90, cepel, 16);
        A.vreteno = vreteno;
      } else if (S.stroj === 'dilna') {
        box(stroj, [-200, -700, -60], [500, 200, -0.1], mat(0x7b6a58));
        const vrt = new THREE.Group(); stroj.add(vrt);
        for (const x of S.pohyb.xs) valec(vrt, 'y', [x, 160, S.pohyb.z], S.pohyb.d / 2, 220, cepel, 16);
        box(vrt, [S.pohyb.xs[0] - 40, 270, S.pohyb.z - 40], [S.pohyb.xs[0] + 40, 380, S.pohyb.z + 40], mat(0x27ae60, { roughness: 0.5 }));
        A.vrtak = vrt;
      }
      // obrobky
      for (const o of S.obrobky || []) {
        const g = o.pohyb ? pohyb : pevne;
        if (o.valec) { valec(g, 'y', [0, 0, o.z], o.d / 2, o.L, drevo, 40); continue; }
        if (o.naklon != null) {
          const L = o.b[0] - o.a[0], W = o.b[1] - o.a[1], T = o.b[2] - o.a[2], u = o.naklon * RAD;
          const m = new THREE.Mesh(new THREE.BoxGeometry(L, W, T), drevo); m.rotation.y = -u;
          const hc = o.z0 + (L / 2 - 10) * Math.tan(u) + T / 2 / Math.cos(u); m.position.set(0, 0, hc); pevne.add(m); continue;
        }
        box(g, o.a, o.b, drevo);
      }
      // díly přípravku
      for (const d of N.dily) {
        if (!d.um || d.jenStl) continue;
        const m = d.druh === 'deska' ? deskaMesh(d, /MDF|HDF/.test(d.material) ? 0xb59a74 : /HDPE|tvrdé/.test(d.material) ? 0x8d6e4a : /Šablona|šablona/.test(d.nazev) ? 0x9db3c9 : 0xdcbc8c) : tiskMesh(d);
        if (/šablona|Šablona/.test(d.nazev) && d.druh === 'deska' && d.jenNahled) { m.material.transparent = true; m.material.opacity = 0.55; }
        (d.pohyb ? pohyb : pevne).add(m);
      }
      if (S.pohyb && S.pohyb.v) { A.v = S.pohyb.v; A.od = S.pohyb.od; A.do = S.pohyb.do; }
      A.typPohybu = S.pohyb && S.pohyb.typ;
      anim = A;
      // kamera podle obalu přípravku (bez stroje)
      const bb = new THREE.Box3();
      const zdroj = pevne.children.length + pohyb.children.length ? [pevne, pohyb] : [stroj];
      for (const g of zdroj) bb.expandByObject(g);
      if (bb.isEmpty()) bb.expandByObject(stroj);
      const vel = bb.getSize(new THREE.Vector3()), st = bb.getCenter(new THREE.Vector3());
      stred = st.clone();   // obal je už v souřadnicích three (koren3 je otočený)
      const m = Math.max(vel.x, vel.y, vel.z, 150);
      orbit.vzd = m * 2.3 + 200;
      svetlo.position.set(stred.x + m, stred.y + m * 1.6, stred.z + m * 1.1); svetlo.target.position.copy(stred);
      krok(performance.now());
      spinave = true;
    }

    function krok(t) {
      const A = anim; if (!A) return;
      const f = (1 - Math.cos(((t - t0) / 1000) * 2 * Math.PI / 6)) / 2;   // 0 → 1 → 0 za 6 s
      if (A.kotouc && hraje) A.kotouc.rotation.x -= 0.25;
      if (A.v) { const d = A.od + (A.do - A.od) * f; A.pohyb.position.set(A.v[0] * d, A.v[1] * d, A.v[2] * d); }
      if (A.typPohybu === 'kotouc' && A.kotouc) A.kotouc.position.z = -(A.R + 3 - (A.e + 3) * f);
      if (A.hlava) A.hlava.rotation.x = -(1 - f) * 28 * RAD;
      if (A.vreteno) A.vreteno.position.z = -60 * f;
      if (A.vrtak) A.vrtak.position.y = -(30 + 40) * f;
    }

    function nastavKameru() {
      const d = orbit.vzd * orbit.nasob, az = orbit.az * RAD, el = orbit.el * RAD;
      kamera.position.set(stred.x + d * Math.cos(el) * Math.sin(az), stred.y + d * Math.sin(el), stred.z + d * Math.cos(el) * Math.cos(az));
      kamera.lookAt(stred); kamera.near = Math.max(0.5, d * 0.01); kamera.far = d * 30; kamera.updateProjectionMatrix();
    }
    const ukaz = new Map(); let pinch0 = null; const el = renderer.domElement;
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
      renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1)); renderer.setSize(w, h, false); kamera.aspect = w / h; spinave = true;
    }
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    const mo = new MutationObserver(() => { postav(); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    (function smycka(t) {
      if (zrusen) return;
      if (viditelne && !document.hidden && (spinave || hraje)) { spinave = false; if (hraje) krok(t || performance.now()); nastavKameru(); renderer.render(scena, kamera); }
      requestAnimationFrame(smycka);
    })();
    return {
      aktualizuj(N, siteDilu) { data = N; site = siteDilu || {}; postav(); },
      hraj(b) { hraje = b == null ? !hraje : !!b; if (hraje) t0 = performance.now(); spinave = true; return hraje; },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, hraje, sirka: renderer.domElement.width, vyska: renderer.domElement.height, objektu: koren3.children.reduce((a, g) => a + g.children.length, 0), siti: Object.keys(site).length }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(); renderer.dispose(); el.remove(); },
    };
  }
  koren.PP3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
