/* ============================================================
   Rostoucí židle – 3D (three.js r160): židle u stolu s postavou dítěte, přestavení podle věku (animace),
   rozložený pohled a animace montáže. Svět mm (x, y, z nahoru) → three (x, z, −y).
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180, DH = koren.DH, RZ = koren.RZ;

  function vytvor(obal) {
    const THREE = koren.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene(), kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e6);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 0.95), svetlo = new THREE.DirectionalLight(0xffffff, 1.5);
    scena.add(hemi, svetlo, svetlo.target);
    const koren3 = new THREE.Group(); scena.add(koren3);
    const orbit = { az: -125, el: 20, vzd: 2400, nasob: 1 };
    let stred = new THREE.Vector3(0, 450, -200), viditelne = true, spinave = true, zrusen = false;
    let N = null, pevne = [], pohybl = {}, dite = null, stul = null, stav = null, rozlozeno = 0, cilRozlozeni = 0, montaz = null, prechod = null, ukazDite = true, ukazStul = true;
    const V3 = (x, y, z) => new THREE.Vector3(x, z, -y);
    const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(c || '#d9b98a'), roughness: 0.75 }, o || {}));
    const tmave = () => { const t = document.documentElement.getAttribute('data-theme') || ''; return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches); };
    function uvolni(o) { o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) (Array.isArray(x.material) ? x.material : [x.material]).forEach((m) => m.dispose()); }); }
    function vycisti() { for (const o of koren3.children.slice()) { koren3.remove(o); uvolni(o); } pevne = []; pohybl = {}; dite = null; stul = null; }

    /** mesh tělesa v místních souřadnicích (počátek = min. roh), pozice zvlášť */
    function meshTelesa(t) {
      if (t.typ === 'box') { const g = new THREE.BoxGeometry(t.sx, t.sz, t.sy); g.translate(t.sx / 2, t.sz / 2, -t.sy / 2); const m = new THREE.Mesh(g, mat(t.barva)); m.userData.zakl = V3(t.x, t.y, t.z); return m; }
      if (t.typ === 'valec') { const g = new THREE.CylinderGeometry(t.r, t.r, t.h, Math.max(16, Math.round(t.r * 2))); g.rotateZ(-Math.PI / 2); g.translate(t.h / 2, 0, 0); const m = new THREE.Mesh(g, mat(t.barva, { metalness: t.dil === 'svornik' || t.dil === 'trubka' ? 0.6 : 0, roughness: 0.45 })); m.userData.zakl = V3(t.x, t.y, t.z); return m; }
      if (t.typ === 'extr') {
        const sh = new THREE.Shape(t.b.map((p) => new THREE.Vector2(p[0], p[1])));
        const g = new THREE.ExtrudeGeometry(sh, { depth: t.tl, bevelEnabled: false, curveSegments: 6 });
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const w = DH.extrNaSvet(Object.assign({}, t, { x: 0, y: 0, z: 0 }), p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, w[0], w[2], -w[1]); }
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, mat(t.barva, { side: THREE.DoubleSide })); m.userData.zakl = V3(t.x, t.y, t.z); return m;
      }
      return null;
    }

    function postav() {
      vycisti();
      if (!N) return;
      const tm = tmave(), P = N.P, K = N.K, B = K.bok;
      scena.background = new THREE.Color(tm ? 0x1d2228 : 0xe4ebf2);
      const pod = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), mat(tm ? '#2d343c' : '#d0d7de', { roughness: 1 }));
      pod.rotation.x = -Math.PI / 2; pod.position.set(K.W / 2, -0.5, 200); koren3.add(pod);
      // pevné díly
      for (const t of RZ.telesa(P, N.G, K, null)) {
        const m = meshTelesa(t); if (!m) continue;
        m.position.copy(m.userData.zakl); koren3.add(m);
        pevne.push({ m, t, rozlet: V3(...(t.rozlet || [0, 0, 0])), krok: t.sklad || 0 });
      }
      // drážky (tmavé pruhy na vnitřních lících)
      const gm = mat('#6b4a2a'), tb = P.tDeska + P.vule;
      for (const [x0, strana] of [[P.tBok, 1], [K.W - P.tBok, -1]]) {
        const sk = new THREE.Group();
        for (const g of N.G) {
          const y0 = B.yF(g + tb / 2), y1 = B.yB(g + tb / 2), geo = new THREE.BoxGeometry(0.6, tb, y1 - y0);
          const m = new THREE.Mesh(geo, gm); m.position.copy(V3(x0 + strana * 0.3, (y0 + y1) / 2, g + tb / 2)); sk.add(m);
        }
        koren3.add(sk); pevne.push({ m: sk, t: { nazev: 'drážky' }, rozlet: V3(strana < 0 ? 160 : -160, 0, 0), krok: 1, skupina: true });
      }
      // pohyblivé díly
      const Q = stav || N.vybrana;
      for (const t of RZ.telesa(P, N.G, K, Q)) {
        if (!['sedak', 'podnozka'].includes(t.dil)) continue;
        const m = meshTelesa(t); m.position.copy(m.userData.zakl); koren3.add(m);
        pohybl[t.dil] = { m, t, rozlet: V3(...t.rozlet), krok: t.sklad };
      }
      postavDite(Q); postavStul(Q); postavMadlo(Q);
      const bb = DH.bboxTeles(RZ.telesa(P, N.G, K, Q));
      stred = V3((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2 - 150, (bb.z0 + bb.z1) / 2);
      orbit.vzd = Math.max(1800, (bb.z1 - bb.z0) * 3.1);
      svetlo.position.set(stred.x - 900, 1800, stred.z + 1200); svetlo.target.position.copy(stred);
      prevezmiPolohu(Q, false);
      spinave = true;
    }
    function postavMadlo(Q) {
      if (pohybl.madlo) { koren3.remove(pohybl.madlo.m); uvolni(pohybl.madlo.m); delete pohybl.madlo; }
      const T = RZ.telesa(N.P, N.G, N.K, Q).filter((t) => t.dil === 'madlo');
      if (!T.length) return;
      const g = new THREE.Group();
      for (const t of T) { const m = meshTelesa(t); m.position.copy(m.userData.zakl); g.add(m); }
      koren3.add(g); pohybl.madlo = { m: g, t: { dil: 'madlo' }, rozlet: V3(0, -160, 100), krok: 5, skupina: true };
    }
    function postavDite(Q) {
      if (dite) { koren3.remove(dite); uvolni(dite); dite = null; }
      if (!ukazDite) return;
      const S = Q.S, P = N.P, K = N.K, T = Q.T, g = new THREE.Group();
      const kuze = mat('#f0c39b'), obl = mat('#4f8fc0'), kal = mat('#3b4a63'), bot = mat('#4a3426');
      const cx = K.W / 2, zS = Q.sedTop;
      const kvadr = (x0, x1, y0, y1, z0, z1, m) => { const geo = new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0); const o = new THREE.Mesh(geo, m); o.position.copy(V3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); g.add(o); };
      const kapsle = (a, b, r, m) => { const A = V3(...a), Bv = V3(...b), d = new THREE.Vector3().subVectors(Bv, A), l = d.length(); const geo = new THREE.CapsuleGeometry(r, Math.max(0.1, l), 4, 10); const o = new THREE.Mesh(geo, m); o.position.copy(A).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(o); };
      const yZad = Q.yOp - 2, yHyz = yZad - 0.07 * S;
      const kyc = [yHyz, zS + 0.06 * S], koleno = [Q.ysf - 0.03 * S, zS + 0.045 * S];
      const lHol = 0.24 * S, zKot = (Q.gp != null ? Q.podTop : 0) + 0.035 * S, dz = koleno[1] - zKot;
      const yKot = koleno[0] - Math.sqrt(Math.max(0, lHol * lHol - dz * dz)), zK = dz > lHol ? koleno[1] - lHol : zKot;
      const zRam = zS + T.ramena, rT = 0.045 * S;
      for (const s of [-1, 1]) {
        const x = cx + s * 0.05 * S;
        kapsle([x, kyc[0], kyc[1]], [x, koleno[0], koleno[1]], 0.045 * S, kal);
        kapsle([x, koleno[0], koleno[1]], [x, yKot, zK], 0.032 * S, kal);
        kvadr(x - 0.03 * S, x + 0.03 * S, yKot - 0.12 * S, yKot + 0.03 * S, zK - 0.035 * S, zK, bot);
        const loket = [x + s * 0.06 * S, yZad - 0.1 * S, zRam - 0.18 * S];
        kapsle([x + s * 0.065 * S, yZad - 0.06 * S, zRam - 0.02 * S], loket, rT * 0.7, obl);
        kapsle(loket, [x + s * 0.03 * S, loket[1] - 0.145 * S, Math.max(loket[2], N.P.stul + 0.02 * S)], rT * 0.55, kuze);
      }
      kvadr(cx - 0.1 * S, cx + 0.1 * S, yZad - T.trup, yZad, zS + 0.02 * S, zRam, obl);
      const r = T.hlava / 2, hl = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), kuze);
      hl.position.copy(V3(cx, yZad - T.trup / 2, zRam + 0.035 * S + r)); g.add(hl);
      kapsle([cx, yZad - T.trup / 2, zRam - 0.01 * S], [cx, yZad - T.trup / 2, zRam + 0.04 * S], 0.03 * S, kuze);
      koren3.add(g); dite = g;
    }
    function postavStul(Q) {
      if (stul) { koren3.remove(stul); uvolni(stul); stul = null; }
      if (!ukazStul) return;
      const P = N.P, K = N.K, g = new THREE.Group(), m = mat(tmave() ? '#8d9aa6' : '#c9d2da'), yt = RZ.okrajStolu(P, K, Q);
      const kv = (x0, x1, y0, y1, z0, z1) => { const geo = new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0); const o = new THREE.Mesh(geo, m); o.position.copy(V3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); g.add(o); };
      const x0 = K.W / 2 - 500, x1 = K.W / 2 + 500;
      kv(x0, x1, yt - 700, yt, P.stul - 25, P.stul);
      kv(x0 + 20, x1 - 20, yt - 60, yt - 40, P.podStolem, P.stul - 25);
      for (const [x, y] of [[x0 + 20, yt - 680], [x1 - 60, yt - 680], [x0 + 20, yt - 100], [x1 - 60, yt - 100]]) kv(x, x + 40, y, y + 40, 0, P.stul - 25);
      koren3.add(g); stul = g; stul.userData.yt = yt;
    }

    /** okamžitě nebo animovaně přesune sedák, podnožku, dítě a stůl do polohy Q */
    function prevezmiPolohu(Q, anim) {
      const cil = {};
      for (const t of RZ.telesa(N.P, N.G, N.K, Q)) if (['sedak', 'podnozka'].includes(t.dil)) cil[t.dil] = V3(t.x, t.y, t.z);
      const z = {};
      for (const k of ['sedak', 'podnozka']) {
        const p = pohybl[k];
        if (!p) continue;
        p.m.visible = !!cil[k];
        if (cil[k]) { z[k] = p.m.userData.zakl.clone(); p.m.userData.cil = cil[k]; }
      }
      if (anim) prechod = { t0: performance.now(), z, Q };
      else { for (const k of Object.keys(z)) pohybl[k].m.userData.zakl.copy(pohybl[k].m.userData.cil); dokoncePrechod(Q); }
      spinave = true;
    }
    function dokoncePrechod(Q) { stav = Q; postavDite(Q); postavStul(Q); postavMadlo(Q); umisti(); spinave = true; }
    function umisti() {
      const f = rozlozeno;
      for (const q of pevne) q.m.position.copy(q.skupina ? new THREE.Vector3() : q.m.userData.zakl).addScaledVector(q.rozlet, f);
      for (const k of Object.keys(pohybl)) { const q = pohybl[k]; q.m.position.copy(q.skupina ? new THREE.Vector3() : q.m.userData.zakl).addScaledVector(q.rozlet, f); }
      if (dite) dite.visible = f < 0.05 && !montaz;
      if (stul) stul.visible = f < 0.5;
    }
    const hladka = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    function krok(ted) {
      let bezi = false;
      if (prechod) {
        const f = hladka((ted - prechod.t0) / 700);
        for (const k of Object.keys(prechod.z)) { const p = pohybl[k]; p.m.userData.zakl.lerpVectors(prechod.z[k], p.m.userData.cil, f); }
        if (dite) dite.visible = false;
        umisti(); if (dite) dite.visible = false;
        if (f >= 1) { const Q = prechod.Q; prechod = null; dokoncePrechod(Q); } else bezi = true;
      }
      if (Math.abs(rozlozeno - cilRozlozeni) > 1e-3) { rozlozeno += Math.sign(cilRozlozeni - rozlozeno) * Math.min(Math.abs(cilRozlozeni - rozlozeno), 0.04); umisti(); bezi = true; }
      if (montaz) {
        const T = (ted - montaz.t0) / 1000, vse = pevne.concat(Object.values(pohybl)), n = 6;
        for (const q of vse) { const f = hladka((T - q.krok * 0.55) / 0.7); q.m.position.copy(q.skupina ? new THREE.Vector3() : q.m.userData.zakl).addScaledVector(q.rozlet, 2.2 * (1 - f)); q.m.visible = T >= q.krok * 0.55 - 0.05; }
        if (dite) dite.visible = false; if (stul) stul.visible = false;
        if (T > n * 0.55 + 0.8) { montaz = null; for (const q of vse) q.m.visible = q.t.dil !== 'podnozka' || !!(stav && stav.gp != null); umisti(); if (stul) stul.visible = true; } else bezi = true;
      }
      return bezi;
    }
    function nastavKameru() {
      const d = orbit.vzd * orbit.nasob, az = orbit.az * RAD, el = orbit.el * RAD;
      kamera.position.set(stred.x + d * Math.cos(el) * Math.sin(az), stred.y + d * Math.sin(el), stred.z + d * Math.cos(el) * Math.cos(az));
      kamera.lookAt(stred); kamera.near = Math.max(1, d * 0.01); kamera.far = d * 20; kamera.updateProjectionMatrix();
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
    function velikost() { const w = Math.max(10, obal.clientWidth), h = Math.max(10, obal.clientHeight); renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1)); renderer.setSize(w, h, false); kamera.aspect = w / h; spinave = true; }
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    const mo = new MutationObserver(() => { if (N) postav(); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    let snimku = 0;
    (function smycka(ted) {
      if (zrusen) return;
      const bezi = (prechod || montaz || Math.abs(rozlozeno - cilRozlozeni) > 1e-3) ? krok(ted || performance.now()) : false;
      if (viditelne && (spinave || bezi) && !document.hidden) { spinave = false; nastavKameru(); renderer.render(scena, kamera); snimku++; }
      requestAnimationFrame(smycka);
    })();
    return {
      aktualizuj(n, Q) { N = n; stav = Q || n.vybrana; postav(); },
      poloha(Q) { if (!N) return; prevezmiPolohu(Q, true); },
      rozloz(ano) { cilRozlozeni = ano ? 1 : 0; spinave = true; },
      montaz() { rozlozeno = 0; cilRozlozeni = 0; montaz = { t0: performance.now() }; },
      zobrazit(o) { if (o.dite != null) ukazDite = o.dite; if (o.stul != null) ukazStul = o.stul; if (N && stav) { postavDite(stav); postavStul(stav); umisti(); } spinave = true; },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, snimku, dilu: pevne.length + Object.keys(pohybl).length, dite: dite ? { vid: dite.visible, n: dite.children.length, p: dite.children[0] && dite.children[0].position.toArray().map(Math.round) } : null, stul: stul ? stul.userData.yt : null, animace: !!(prechod || montaz), rozlozeno }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); vycisti(); renderer.dispose(); el.remove(); },
    };
  }
  koren.RZ3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
