/* ============================================================
   Ptačí budky – 3D náhled (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Díly = hranoly z jádra (ExtrudeGeometry), otvory = tmavé stěny a terče na lících.
   Animace: složení (díly přilétají podle kroků), otevření pro čištění (stříška na pantu / otočný bok).
   Model (x, y, z nahoru) → three (x, z, −y); kreslí se jen po změně a když je vidět.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

  function vytvor(obal) {
    const THREE = koren.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e6);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x7a7060, 0.95);
    const svetlo = new THREE.DirectionalLight(0xffffff, 1.5);
    scena.add(hemi, svetlo, svetlo.target);
    const koren3 = new THREE.Group(); scena.add(koren3);
    const orbit = { az: -38, el: 22, vzd: 800, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = true, spinave = true, zrusen = false;
    let B = null, casti = [];          // [{dil, obal (pivot), mesh, rozlet, krok}]
    const anim = { slozeni: 1, cil: 1, otevreni: 0, cilOtev: 0, rychlost: 0.55 };
    let posledniCas = 0;

    function tmave() {
      const t = document.documentElement.getAttribute('data-theme') || '';
      return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches);
    }
    function zlikviduj() {
      for (const o of koren3.children.slice()) {
        koren3.remove(o);
        o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) { const m = Array.isArray(x.material) ? x.material : [x.material]; for (const q of m) q.dispose(); } });
      }
      casti = [];
    }
    const M2T = (x, y, z) => new THREE.Vector3(x, z, -y);

    /** geometrie hranolu dílu v souřadnicích three */
    function geoDilu(d) {
      const tvar = new THREE.Shape();
      d.poly.forEach((p, i) => (i ? tvar.lineTo(p[0], p[1]) : tvar.moveTo(p[0], p[1])));
      tvar.closePath();
      // otvory rovnoběžné s osou hranolu vyřízneme přímo
      for (const q of d.diry || []) {
        if (q.osa !== d.osa) continue;
        const h = new THREE.Path(), rx = q.tvar === 'oval' ? q.w / 2 : q.d / 2, ry = q.tvar === 'oval' ? q.h / 2 : q.d / 2;
        h.absellipse(q.c[0], q.c[1], rx, ry, 0, Math.PI * 2, true); tvar.holes.push(h);
      }
      const g = new THREE.ExtrudeGeometry(tvar, { depth: d.a1 - d.a0, bevelEnabled: false, curveSegments: 32 });
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const sx = p.getX(i), sy = p.getY(i), e = p.getZ(i) + d.a0;
        let x, y, z;
        if (d.osa === 'x') { x = e; y = sx; z = sy; } else if (d.osa === 'y') { x = sx; y = e; z = sy; } else { x = sx; y = sy; z = e; }
        // osa y: (sx, e, sy) je liché zrcadlení → pořadí vrcholů opravíme níže
        p.setXYZ(i, x, z, -y);
      }
      if (d.osa === 'y') { const ix = g.index; if (!ix) { for (let i = 0; i < p.count; i += 3) { const ax = p.getX(i + 1), ay = p.getY(i + 1), az = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, ax, ay, az); } } }
      p.needsUpdate = true; g.computeVertexNormals();
      return g;
    }
    /** otvory kolmé na osu hranolu: tmavá stěna + terče na obou lících */
    function otvoryDilu(d, mat) {
      const sk = new THREE.Group();
      for (const q of d.diry || []) {
        if (q.osa === d.osa && d.osa !== 'z') { /* už vyříznuto, přidat jen tmavou stěnu */ }
        let s0, s1;
        if (q.osa === d.osa) { s0 = d.a0; s1 = d.a1; }
        else {
          const i = d.osa === 'x' ? (q.osa === 'y' ? 0 : 1) : d.osa === 'y' ? (q.osa === 'x' ? 0 : 1) : (q.osa === 'x' ? 0 : 1);
          const hod = d.poly.map((p) => p[i]); s0 = Math.min(...hod); s1 = Math.max(...hod);
        }
        const rx = q.tvar === 'oval' ? q.w / 2 : q.d / 2, ry = q.tvar === 'oval' ? q.h / 2 : q.d / 2, L = s1 - s0;
        const stena = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, L, 40, 1, true), mat.stena);
        const terc = new THREE.CircleGeometry(1, 40);
        const t1 = new THREE.Mesh(terc, mat.terc), t2 = new THREE.Mesh(terc.clone(), mat.terc);
        const g = new THREE.Group();
        // místní osa válce = Y; terče v rovině XY → otočit
        stena.scale.set(rx, 1, ry);
        t1.rotation.x = -Math.PI / 2; t1.scale.set(rx, ry, 1); t1.position.y = L / 2 + 0.25;
        t2.rotation.x = Math.PI / 2; t2.scale.set(rx, ry, 1); t2.position.y = -L / 2 - 0.25;
        g.add(stena);
        if (q.osa !== d.osa) g.add(t1, t2);   // u vyříznutých otvorů je skrz vidět
        const sm = (s0 + s1) / 2;
        if (q.osa === 'y') { g.position.copy(M2T(q.c[0], sm, q.c[1])); g.rotation.x = Math.PI / 2; g.rotation.y = 0; }
        else if (q.osa === 'x') { g.position.copy(M2T(sm, q.c[0], q.c[1])); g.rotation.z = Math.PI / 2; g.rotateX(0); stena.scale.set(ry, 1, rx); t1.scale.set(ry, rx, 1); t2.scale.set(ry, rx, 1); }
        else { g.position.copy(M2T(q.c[0], q.c[1], sm)); }
        sk.add(g);
      }
      return sk;
    }

    function postav() {
      zlikviduj();
      if (!B) return;
      const tm = tmave();
      scena.background = new THREE.Color(tm ? 0x1c2127 : 0xe3eaf1);
      const u = B.dutina, W = u.W, D = u.D;
      const barvy = { predni: 0xc99a62, zadni: 0xb98a55, bokL: 0xd2a56c, bokP: 0xd2a56c, dno: 0xbf9260, strecha: 0x9c6b3e };
      const mat = { stena: new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: 1, side: THREE.DoubleSide }), terc: new THREE.MeshBasicMaterial({ color: 0x15100b }) };
      const hranyMat = new THREE.LineBasicMaterial({ color: 0x3b2a1a, transparent: true, opacity: 0.55 });
      const vzd = Math.max(W, D, u.Hf) * 0.75 + 40;
      for (const d of B.dily) {
        const g = geoDilu(d);
        const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: barvy[d.id] || (d.id.startsWith('police') ? 0xc49660 : 0xc89b63), roughness: 0.82, metalness: 0 }));
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), hranyMat));
        mesh.add(otvoryDilu(d, mat));
        if (d.id === 'predni' && B.P && B.P.vroubky !== false && B.info.otv && B.info.otv.stena === 'predni') {
          // vroubky na vnitřní straně (tenké tmavé proužky)
          const o = B.info.otv, vrch = o.c[1] - o.h / 2 - 3;
          for (let z = u.zd + 10; z < vrch; z += 10) {
            const pr = new THREE.Mesh(new THREE.BoxGeometry(Math.min(50, W - 10), 0.8, 0.6), mat.stena);
            pr.position.copy(M2T(o.c[0], 0.2, z)); mesh.add(pr);
          }
        }
        const pivot = new THREE.Group(), vnitrni = new THREE.Group();
        pivot.add(vnitrni); vnitrni.add(mesh);
        if (d.otevrit) {
          const b = M2T(...d.otevrit.bod); pivot.position.copy(b); vnitrni.position.copy(b.clone().multiplyScalar(-1));
        }
        koren3.add(pivot);
        casti.push({ dil: d, pivot, vnitrni, mesh, rozlet: M2T(...(d.rozlet || [0, 0, 0])).multiplyScalar(vzd), krok: d.krokSlozeni || 0, osaOtev: d.otevrit ? M2T(...d.otevrit.smer).normalize() : null, uhel: d.otevrit ? d.otevrit.uhel * RAD : 0 });
      }
      // moduly hmyzího hotelu
      if (B.typ === 'hotel') {
        const sk = new THREE.Group();
        for (const m of B.moduly) {
          const col = { drevo: 0xa87645, rakos: 0xd8c27c, cihla: 0xb0533b, hlina: 0x9c7b5a }[m.typ];
          const blok = new THREE.Mesh(new THREE.BoxGeometry(m.sirka, m.vyska, m.hloubka), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }));
          blok.position.copy(M2T((m.x0 + m.x1) / 2, m.hloubka / 2 + 2, (m.z0 + m.z1) / 2));
          sk.add(blok);
          if (m.diry) for (const q of m.diry) {
            const c = new THREE.Mesh(new THREE.CircleGeometry(q.d / 2, 20), mat.terc);
            c.position.copy(M2T(m.x0 + q.x, 1.7, m.z0 + q.y)); sk.add(c);
          }
          if (m.typ === 'rakos') {
            const dm = (m.prumery.reduce((a, b) => a + b, 0) / Math.max(1, m.prumery.length) || 6) + 2;
            const body = [];
            for (let z = m.z0 + dm / 2, r = 0; z <= m.z1 - dm / 2 + 1e-6; z += dm * 0.87, r++) for (let x = m.x0 + dm / 2 + (r % 2 ? dm / 2 : 0); x <= m.x1 - dm / 2 + 1e-6; x += dm) body.push([x, z]);
            const geo = new THREE.CylinderGeometry(dm / 2 - 0.3, dm / 2 - 0.3, m.hloubka, 10, 1, true);
            const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xd9c47e, roughness: 0.8, side: THREE.DoubleSide }), body.length);
            const terce = new THREE.InstancedMesh(new THREE.CircleGeometry(dm / 2 - 1.2, 10), mat.terc, body.length);
            const mm = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), s1 = new THREE.Vector3(1, 1, 1);
            body.forEach(([x, z], i) => {
              mm.compose(M2T(x, m.hloubka / 2 + 2, z), q, s1); inst.setMatrixAt(i, mm);
              mm.compose(M2T(x, 1.2, z), new THREE.Quaternion(), s1); terce.setMatrixAt(i, mm);
            });
            sk.remove(blok); blok.geometry.dispose(); blok.material.dispose();
            sk.add(inst, terce);
          }
        }
        const pivot = new THREE.Group(), vnitrni = new THREE.Group(); pivot.add(vnitrni); vnitrni.add(sk); koren3.add(pivot);
        casti.push({ dil: { id: 'moduly' }, pivot, vnitrni, mesh: sk, rozlet: M2T(0, -1, 0).multiplyScalar(vzd * 1.3), krok: 4, osaOtev: null, uhel: 0 });
      }
      // stínová podložka (stěna / kmen jako pozadí)
      const zs = B.dily.find((d) => d.id === 'zadni');
      if (zs) {
        const zz = zs.poly.map((p) => p[1]), h = Math.max(...zz) - Math.min(...zz);
        const pd = new THREE.Mesh(new THREE.PlaneGeometry(W * 3 + 200, h * 1.8 + 200), new THREE.MeshStandardMaterial({ color: tm ? 0x2b3138 : 0xcfd6dd, roughness: 1 }));
        pd.position.copy(M2T(W / 2, D + u.t + 0.5, (Math.max(...zz) + Math.min(...zz)) / 2)); koren3.add(pd);
      }
      const vn = B.vnejsi || B.info.vnejsi, m = Math.max(vn.sirka, vn.hloubka, vn.vyska);
      stred = M2T(W / 2, D / 2, (u.zr(D / 2) + 0) / 2);
      orbit.vzd = m * 2.4 + 80;
      svetlo.position.copy(M2T(W / 2 - m * 0.8, -m * 1.6, m * 1.8)); svetlo.target.position.copy(stred);
      uplatniAnimaci();
      spinave = true;
    }

    function uplatniAnimaci() {
      const kroky = Math.max(1, ...casti.map((c) => c.krok)) + 1;
      for (const c of casti) {
        const lok = ease(anim.slozeni * kroky - c.krok);
        c.pivot.position.copy(c.dil.otevrit ? M2T(...c.dil.otevrit.bod) : new THREE.Vector3()).addScaledVector(c.rozlet, 1 - lok);
        c.pivot.quaternion.identity();
        if (c.osaOtev && anim.otevreni > 0) c.pivot.quaternion.setFromAxisAngle(c.osaOtev, c.uhel * ease(anim.otevreni));
      }
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
    const mo = new MutationObserver(() => { if (B) postav(); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    (function smycka(cas) {
      if (zrusen) return;
      const dt = Math.min(0.1, Math.max(0, ((cas || 0) - posledniCas) / 1000)); posledniCas = cas || 0;
      let pohyb = false;
      for (const [k, c] of [['slozeni', 'cil'], ['otevreni', 'cilOtev']]) {
        if (anim[k] !== anim[c]) { const s = Math.sign(anim[c] - anim[k]); anim[k] += s * dt * anim.rychlost; if ((anim[c] - anim[k]) * s <= 0) anim[k] = anim[c]; pohyb = true; }
      }
      if (pohyb) { uplatniAnimaci(); spinave = true; }
      if (viditelne && spinave && !document.hidden) { spinave = false; nastavKameru(); renderer.render(scena, kamera); }
      requestAnimationFrame(smycka);
    })();
    return {
      aktualizuj(sestava) { B = sestava; postav(); },
      slozit() { if (anim.otevreni > 0) anim.cilOtev = 0; anim.slozeni = anim.cil === 1 && anim.slozeni === 1 ? 0 : anim.slozeni; anim.cil = 1; spinave = true; },
      rozlozit() { anim.cilOtev = 0; anim.cil = 0; spinave = true; },
      otevrit() { anim.cil = 1; anim.slozeni = 1; anim.cilOtev = anim.cilOtev > 0 ? 0 : 1; uplatniAnimaci(); spinave = true; },
      nastav(slozeni, otevreni) { anim.slozeni = anim.cil = slozeni; anim.otevreni = anim.cilOtev = otevreni; uplatniAnimaci(); spinave = true; },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, sirka: renderer.domElement.width, vyska: renderer.domElement.height, dilu: casti.length, slozeni: anim.slozeni, otevreni: anim.otevreni }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(); renderer.dispose(); el.remove(); },
    };
  }
  koren.PB3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
