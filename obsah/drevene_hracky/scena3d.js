/* ============================================================
   Dřevěné hračky – 3D náhled (three.js r160, globální THREE) s animací skládání a kuličky
   Svět (mm): x vpravo, y dozadu, z nahoru → three (x, z, −y). Kreslí se jen po změně / při animaci a když je vidět.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;
  const DH = koren.DH;

  function vytvor(obal) {
    const THREE = koren.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e6);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 0.95);
    const svetlo = new THREE.DirectionalLight(0xffffff, 1.5);
    scena.add(hemi, svetlo, svetlo.target);
    const skupina = new THREE.Group(); scena.add(skupina);
    const orbit = { az: -35, el: 28, vzd: 800, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = true, spinave = true, zrusen = false;
    let N = null, objekty = [], kulicka = null, textura = null, podlaha = null;
    const anim = { sklad: null, kulicka: null, rychlost: 1 };
    const naThree = (x, y, z) => new THREE.Vector3(x, z, -y);

    function tmave() {
      const t = document.documentElement.getAttribute('data-theme') || '';
      return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches);
    }
    function zlikviduj() {
      for (const o of skupina.children.slice()) {
        skupina.remove(o);
        o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) { const m = Array.isArray(x.material) ? x.material : [x.material]; for (const q of m) { if (q.map && q.map !== textura) q.map.dispose(); q.dispose(); } } });
      }
      objekty = []; kulicka = null; podlaha = null;
    }
    const mat = (barva, o) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(barva || '#d9b98a'), roughness: 0.78, metalness: 0 }, o || {}));

    /** extruze polygonu (lokálně u, v, tloušťka w) → geometrie ve světě three */
    function geoExtr(t) {
      const tvar = new THREE.Shape(t.b.map((p) => new THREE.Vector2(p[0], p[1])));
      for (const d of t.diry || []) tvar.holes.push(new THREE.Path(d.map((p) => new THREE.Vector2(p[0], p[1]))));
      const g = new THREE.ExtrudeGeometry(tvar, { depth: t.tl, bevelEnabled: false, curveSegments: 4 });
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const w = DH.extrNaSvet(t, p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, w[0], w[2], -w[1]); }
      g.computeVertexNormals();
      return g;
    }
    /** modul dráhy: stěny + dno se sklonem + propad */
    function geoModul(t) {
      const M = t.M, c = t.bunka, grp = new THREE.Group(), m1 = mat(t.barva), m2 = mat('#a77c4f');
      if (!c) { const g = new THREE.BoxGeometry(M, M, M); g.translate(t.x + M / 2, t.z + M / 2, -(t.y + M / 2)); grp.add(new THREE.Mesh(g, m1)); return grp; }
      const kanal = DH.kanalDrazky(c, t.w, M, t.otvor);
      const steny = DH.rozdil([DH.obdelnik(0, 0, M, M)], kanal);
      const tvar = (pole) => DH.skupiny(pole).map((s) => { const sh = new THREE.Shape(s.b.map((p) => new THREE.Vector2(p[0], p[1]))); for (const d of s.diry) sh.holes.push(new THREE.Path(d.map((p) => new THREE.Vector2(p[0], p[1])))); return sh; });
      const prevod = (g, fz) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i); let w = p.getZ(i); if (fz) w = fz(u, v, w); p.setXYZ(i, t.x + u, t.z + w, -(t.y + v)); } g.computeVertexNormals(); return g; };
      for (const sh of tvar(steny)) grp.add(new THREE.Mesh(prevod(new THREE.ExtrudeGeometry(sh, { depth: M, bevelEnabled: false, curveSegments: 6 })), m1));
      let dno = kanal;
      if (c.vystup === 'dolu') dno = DH.rozdil(kanal, [DH.kruh(M / 2, M / 2, t.otvor / 2, 40)]);
      const hMax = M - c.eIn;
      const zDna = (u, v) => {
        let nej = 0, nd = Infinity;
        for (const q of c.pts) { const d = (q[0] - u) ** 2 + (q[1] - v) ** 2; if (d < nd) { nd = d; nej = q[2]; } }
        return M - (c.eIn + (c.eOut - c.eIn) * nej / (c.delka || 1));
      };
      for (const sh of tvar(dno)) grp.add(new THREE.Mesh(prevod(new THREE.ExtrudeGeometry(sh, { depth: hMax, bevelEnabled: false, curveSegments: 6 }), (u, v, w) => (w > hMax - 0.01 ? zDna(u, v) : w)), m2));
      return grp;
    }
    function objekt(t) {
      let o;
      if (t.typ === 'box') { const g = new THREE.BoxGeometry(t.sx, t.sz, t.sy); g.translate(t.x + t.sx / 2, t.z + t.sz / 2, -(t.y + t.sy / 2)); o = new THREE.Mesh(g, mat(t.barva)); }
      else if (t.typ === 'valec') {
        const g = new THREE.CylinderGeometry(t.r, t.r, t.h, Math.max(16, Math.min(64, Math.round(t.r * 2))));
        if (t.osa === 'x') g.rotateZ(-Math.PI / 2); else if (t.osa === 'y') g.rotateX(Math.PI / 2);
        const s = DH.stredTelesa(t); g.translate(s[0], s[2], -s[1]);
        o = new THREE.Mesh(g, mat(t.barva));
      } else if (t.typ === 'koule') { const g = new THREE.SphereGeometry(t.r, 24, 16); g.translate(t.x, t.z, -t.y); o = new THREE.Mesh(g, mat(t.barva)); }
      else if (t.typ === 'extr') {
        const g = geoExtr(t);
        if (N.obrazek3d && textura && !t.bezObrazku) {
          // UV čel extruze = souřadnice tvaru (mm puzzle) → obrázek přes celou plochu W × H
          const R = N.obrazekRam || { w: 1, h: 1 }, tx = textura.clone(); tx.needsUpdate = true;
          tx.repeat.set(1 / R.w, 1 / R.h); tx.offset.set(0, 0);
          o = new THREE.Mesh(g, [new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7, side: THREE.DoubleSide }), mat(t.barva, { side: THREE.DoubleSide })]);
        } else o = new THREE.Mesh(g, mat(t.barva, { side: THREE.DoubleSide }));
        if (t.detaily && t.detaily.length) {
          const cary = new THREE.Group(), lm = new THREE.LineBasicMaterial({ color: 0x3a2a1a });
          for (const w of [-0.4, t.tl + 0.4]) for (const d of t.detaily) {
            const body = d.b.map((p) => { const q = DH.extrNaSvet(t, p[0], p[1], w); return naThree(q[0], q[1], q[2]); });
            if (!d.otevrena) body.push(body[0].clone());
            cary.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(body), lm));
          }
          const grp = new THREE.Group(); grp.add(o, cary); o = grp;
        }
      } else if (t.typ === 'modul') o = geoModul(t);
      else return null;
      return o;
    }

    function postav() {
      zlikviduj();
      if (!N) return;
      const tm = tmave();
      scena.background = new THREE.Color(tm ? 0x1d2228 : 0xe4ebf2);
      const bb = DH.bboxTeles(N.telesa);
      for (const t of N.telesa) {
        const o = objekt(t); if (!o) continue;
        skupina.add(o);
        const vyska = bb.z1 - bb.z0;
        const r = t.rozlet || [0, 0, Math.max(60, vyska * 0.8)];
        objekty.push({ o, t, cil: new THREE.Vector3(0, 0, 0), rozlet: naThree(r[0], r[1], r[2]), poradi: t.sklad || 0 });
      }
      // pořadí skládání
      const por = [...new Set(objekty.map((q) => q.poradi))].sort((a, b) => a - b);
      for (const q of objekty) q.krok = por.indexOf(q.poradi);
      anim.kroku = por.length;
      // podlaha
      const sx = bb.x1 - bb.x0, sy = bb.y1 - bb.y0, m = Math.max(sx, sy, bb.z1 - bb.z0, 50);
      const pg = new THREE.PlaneGeometry(Math.max(sx, 40) * 1.8 + 80, Math.max(sy, 40) * 1.8 + 80);
      pg.rotateX(-Math.PI / 2); pg.translate((bb.x0 + bb.x1) / 2, bb.z0 - 0.3, -(bb.y0 + bb.y1) / 2);
      podlaha = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: tm ? 0x2d343c : 0xd0d7de, roughness: 1 }));
      skupina.add(podlaha);
      if (N.sim && N.kulicka) {
        const g = new THREE.SphereGeometry(N.kulicka.r, 24, 16);
        kulicka = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x2f6fe0, emissive: 0x1a3fa0, roughness: 0.15, metalness: 0.1 }));
        const s0 = N.sim.snimky[0]; if (s0) kulicka.position.copy(naThree(s0[1], s0[2], s0[3]));
        skupina.add(kulicka);
      }
      stred = naThree((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2, (bb.z0 + bb.z1) / 2);
      orbit.vzd = m * 2.1 + 80;
      svetlo.position.set(stred.x + m * 0.7, stred.y + m * 1.6, stred.z + m * 1.1); svetlo.target.position.copy(stred);
      spinave = true;
    }

    function aktualizuj(n, o) {
      N = n; o = o || {};
      if (o.obrazek !== undefined) {
        if (textura) { textura.dispose(); textura = null; }
        if (o.obrazek) { textura = new THREE.Texture(o.obrazek); textura.colorSpace = THREE.SRGBColorSpace; textura.needsUpdate = true; textura.wrapS = textura.wrapT = THREE.ClampToEdgeWrapping; }
      }
      anim.sklad = null; anim.kulicka = null;
      postav();
    }

    /* ---------- animace ---------- */
    const hladka = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    function krokAnimace(ted) {
      let bezi = false;
      if (anim.sklad) {
        const T = (ted - anim.sklad.t0) / 1000 * anim.rychlost, n = Math.max(1, anim.kroku), d = Math.min(0.6, 4 / n);
        for (const q of objekty) { const f = hladka((T - q.krok * d) / 0.6); q.o.position.copy(q.rozlet).multiplyScalar(1 - f); q.o.visible = T >= q.krok * d - 0.05; }
        if (T > n * d + 0.7) { anim.sklad = null; for (const q of objekty) { q.o.position.set(0, 0, 0); q.o.visible = true; } } else bezi = true;
      }
      if (anim.kulicka && kulicka && N.sim) {
        const T = (ted - anim.kulicka.t0) / 1000 * anim.rychlost, S = N.sim.snimky;
        let i = anim.kulicka.i || 0; while (i < S.length - 1 && S[i + 1][0] < T) i++;
        anim.kulicka.i = i;
        const a = S[i], b = S[Math.min(S.length - 1, i + 1)], f = b[0] > a[0] ? Math.max(0, Math.min(1, (T - a[0]) / (b[0] - a[0]))) : 0;
        kulicka.position.copy(naThree(a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f));
        if (anim.kulicka.cb) anim.kulicka.cb(Math.min(T, S[S.length - 1][0]));
        if (i >= S.length - 1) { anim.kulicka = null; setTimeout(() => { if (!anim.kulicka) pruhledne(false); }, 1500); } else bezi = true;
      }
      return bezi;
    }

    /** moduly dráhy průhledné, aby byla kulička uvnitř věže vidět */
    function pruhledne(ano) {
      for (const q of objekty) q.o.traverse((x) => { if (x.isMesh && x.material && !Array.isArray(x.material)) { x.material.transparent = ano; x.material.opacity = ano ? 0.22 : 1; x.material.depthWrite = !ano; x.material.needsUpdate = true; } });
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
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    const mo = new MutationObserver(() => { if (N) postav(); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    let snimku = 0;
    (function smycka(ted) {
      if (zrusen) return;
      const bezi = (anim.sklad || anim.kulicka) ? krokAnimace(ted || performance.now()) : false;
      if (viditelne && (spinave || bezi) && !document.hidden) { spinave = false; nastavKameru(); renderer.render(scena, kamera); snimku++; }
      requestAnimationFrame(smycka);
    })();
    return {
      aktualizuj,
      skladej() { if (!objekty.length) return; anim.sklad = { t0: performance.now() }; anim.kulicka = null; },
      pustKulicku(cb) { if (!kulicka || !N.sim) return false; pruhledne(true); anim.kulicka = { t0: performance.now(), i: 0, cb }; return true; },
      zastav() { anim.sklad = null; anim.kulicka = null; pruhledne(false); for (const q of objekty) { q.o.position.set(0, 0, 0); q.o.visible = true; } spinave = true; },
      set rychlost(v) { anim.rychlost = v; },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, sirka: renderer.domElement.width, vyska: renderer.domElement.height, objektu: objekty.length, snimku, kulicka: !!kulicka, animace: !!(anim.sklad || anim.kulicka) }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(); if (textura) textura.dispose(); renderer.dispose(); el.remove(); },
    };
  }
  koren.DH3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
