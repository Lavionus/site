/* ============================================================
   schodiste/3d.js – 3D náhled schodiště (three.js r160, načítá se
   až při otevření záložky). Kreslí se jen na vyžádání (po změně
   návrhu, otočení, změně velikosti), žádná trvalá smyčka.
   Půdorys (x, y) → three (x, −y), výška → three y.
   ============================================================ */
const SCHOD_3D = (function () {
  'use strict';
  let renderer = null, scene = null, camera = null, kont = null, skup = null, ro = null;
  const kam = { az: -0.9, el: 0.55, dist: 7000, cil: [0, 1200, 0] };
  let ukazatele = new Map(), pinchStart = null, pozadavek = 0;

  function init(el) {
    if (renderer) return true;
    if (typeof THREE === 'undefined') return false;
    kont = el;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { renderer = null; throw new Error('WebGL není k dispozici – 3D náhled nelze zobrazit.'); }
    renderer.domElement.addEventListener('webglcontextlost', ev => { ev.preventDefault(); if (kont) kont.dispatchEvent(new CustomEvent('schod3dchyba', { detail: 'Grafický kontext WebGL byl ztracen – přepněte záložku nebo obnovte stránku.' })); });
    renderer.domElement.addEventListener('webglcontextrestored', () => vykresli());
    renderer.domElement.setAttribute('role', 'img');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('aria-label', '3D náhled schodiště – táhněte pro otočení, kolečkem nebo dvěma prsty přiblížení');
    el.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, 50, 200000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.6));
    const sl = new THREE.DirectionalLight(0xffffff, 1.6); sl.position.set(4000, 9000, 6000); scene.add(sl);
    const sl2 = new THREE.DirectionalLight(0xffffff, 0.5); sl2.position.set(-5000, 3000, -4000); scene.add(sl2);
    const c = renderer.domElement;
    c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); ukazatele.set(e.pointerId, [e.clientX, e.clientY]); pinchStart = null; });
    c.addEventListener('pointermove', e => {
      if (!ukazatele.has(e.pointerId)) return;
      const pred = ukazatele.get(e.pointerId); ukazatele.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukazatele.size === 1) {
        kam.az -= (e.clientX - pred[0]) * 0.008;
        kam.el = Math.max(-0.2, Math.min(1.5, kam.el + (e.clientY - pred[1]) * 0.008));
      } else if (ukazatele.size === 2) {
        const [a, b] = [...ukazatele.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinchStart) kam.dist = Math.max(800, Math.min(60000, kam.dist * pinchStart / d));
        pinchStart = d;
      }
      vykresli();
    });
    const konec = e => { ukazatele.delete(e.pointerId); pinchStart = null; };
    c.addEventListener('pointerup', konec); c.addEventListener('pointercancel', konec);
    c.addEventListener('wheel', e => { e.preventDefault(); kam.dist = Math.max(800, Math.min(60000, kam.dist * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.001)))); vykresli(); }, { passive: false });   // Ctrl = sevření prstů na touchpadu
    ro = new ResizeObserver(() => vykresli());
    ro.observe(el);
    return true;
  }

  function material(barva, prusvit) {
    const m = new THREE.MeshStandardMaterial({ color: barva, roughness: 0.75, metalness: 0.05 });
    if (prusvit) { m.transparent = true; m.opacity = prusvit; m.depthWrite = false; }
    return m;
  }
  function deska(poly, z0, tl, mat) {
    const sh = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(1, tl), bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat); m.position.y = z0; return m;
  }
  function kvadr(a, b, z0, z1, tl, posun, mat) {
    /* svislá deska nad úsečkou a→b, tloušťka tl, posunutá kolmo o posun */
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 1) return null;
    const g = new THREE.BoxGeometry(L, Math.max(1, z1 - z0), Math.max(1, tl));
    const m = new THREE.Mesh(g, mat);
    const nx = -dy / L, ny = dx / L;
    m.position.set((a[0] + b[0]) / 2 + nx * posun, (z0 + z1) / 2, -((a[1] + b[1]) / 2 + ny * posun));
    m.rotation.y = Math.atan2(dy, dx);
    return m;
  }

  function postav(v, barvy) {
    if (!scene) return;
    if (skup) { scene.remove(skup); skup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    scene.background = new THREE.Color(barvy.pozadi);
    skup = sestav(v, barvy);
    scene.add(skup);
    /* kamera na střed */
    const bb = v.g.bbox, c = [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2];
    kam.cil = [c[0], v.H * 0.45, -c[1]];
    /* při výrazné změně velikosti schodiště znovu zaměřit kameru */
    const rozmer = Math.round(Math.hypot(bb.w, bb.h, v.H) / 500);
    if (!postav.uz || rozmer + '' !== posledniRozmer) { kam.dist = Math.max(3500, Math.hypot(bb.w, bb.h, v.H) * 1.6); postav.uz = true; }
    posledniRozmer = rozmer + '';
    vykresli();
  }

  /* sestavení scény bez rendereru (testuje se i v node) */
  function sestav(v, barvy) {
    const skup = new THREE.Group();
    const s = v.s, g = v.g, h = v.h;
    const barvaNosne = s.material === 'zb' ? 0xb9b9b4 : s.material === 'ocel' ? 0x4a5560 : 0xb07a45;
    const barvaStupne = s.material === 'zb' ? 0xc9c9c4 : 0xc89664;
    const mStup = material(barvaStupne), mNos = material(barvaNosne), mPod = material(0xb8a48c);
    const mStrop = material(barvy.strop, 0.45), mPodlaha = material(barvy.podlaha);
    const tSt = s.material === 'zb' ? 0 : Math.max(20, s.tlStupnice);
    const cosA = Math.cos(v.alfa * Math.PI / 180);
    /* stupně */
    for (const st of g.stupne.concat(g.plosina ? [g.plosina] : [])) {
      if (s.material === 'zb') {
        const tl = st.typ === 'podesta' || st.typ === 'plosina' ? s.deskaTl : h + s.deskaTl / cosA;
        skup.add(deska(st.poly, st.z - tl, tl, mStup));
      } else skup.add(deska(st.poly, st.z - tSt, tSt, st.typ === 'podesta' || st.typ === 'plosina' ? mPod : mStup));
    }
    /* podstupnice */
    if (s.material === 'drevo' && s.podstupnice) {
      const N = g.nosy;
      for (let k = 1; k <= v.n; k++) {
        const q = N[k - 1]; const smer = k < v.n ? [N[k].W[0] - q.W[0], N[k].W[1] - q.W[1]] : g.vystupSmer;
        const L = Math.hypot(smer[0], smer[1]) || 1;
        const kolmo = [smer[0] / L, smer[1] / L];
        const strana = Math.sign((q.O[0] - q.I[0]) * kolmo[1] - (q.O[1] - q.I[1]) * kolmo[0]) || 1;
        const m = kvadr(q.I, q.O, (k - 1) * h, k * h - tSt, s.tlPodstupnice, -strana * (s.nos + s.tlPodstupnice / 2), mPod);
        if (m) skup.add(m);
      }
    }
    /* schodnice přímých ramen */
    if (s.material !== 'zb') {
      g.ramena.forEach((r, i) => {
        if (r.typ !== 'prime') return;
        const sch = SCHOD.schodnice(v, i);
        if (!sch) return;
        const A = g.nosy[r.k0 - 1];
        const sh = new THREE.Shape(sch.poly.map(p => new THREE.Vector2(p[0], p[1])));
        const geo = new THREE.ExtrudeGeometry(sh, { depth: s.schodniceTl, bevelEnabled: false });
        const ex = new THREE.Vector3(r.smer[0], 0, -r.smer[1]).normalize();
        const ey = new THREE.Vector3(0, 1, 0);
        const ez = new THREE.Vector3().crossVectors(ex, ey);
        const kI = [A.I[0] - A.O[0], A.I[1] - A.O[1]], Lk = Math.hypot(kI[0], kI[1]) || 1;
        const kv = new THREE.Vector3(kI[0] / Lk, 0, -kI[1] / Lk);     // směr O → I
        const ven = ez.dot(kv) > 0;
        const t = s.schodniceTl;
        for (const [bod, jeI] of [[A.I, true], [A.O, false]]) {
          const pos = new THREE.Vector3(bod[0], 0, -bod[1]);
          if (jeI && ven) pos.add(kv.clone().multiplyScalar(-t));
          if (!jeI && !ven) pos.add(kv.clone().multiplyScalar(t));
          const m = new THREE.Mesh(geo, mNos);
          m.applyMatrix4(new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(pos));
          skup.add(m);
        }
      });
    }
    if (g.tocite && g.tocite.Rin < 160) {
      const c = g.tocite.stred;
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(40, g.tocite.Rin), Math.max(40, g.tocite.Rin), v.H + 200, 24), mNos);
      sl.position.set(c[0], (v.H + 200) / 2, -c[1]); skup.add(sl);
    }
    /* podlaha dole a strop s otvorem */
    const bb = g.bbox, okr = 900;
    const podl = [[bb.x0 - okr, bb.y0 - okr], [bb.x1 + okr, bb.y0 - okr], [bb.x1 + okr, bb.y1 + okr], [bb.x0 - okr, bb.y1 + okr]];
    skup.add(deska(podl, -s.podlahaDole - 30, s.podlahaDole + 30 - 2, mPodlaha));
    const o = v.podchod.otvor;
    const sh = new THREE.Shape(podl.map(p => new THREE.Vector2(p[0], p[1])));
    if (o && o.obrys) for (const sm of o.obrys) sh.holes.push(new THREE.Path(sm.map(p => new THREE.Vector2(p[0], p[1]))));
    const zs = SCHOD.stropSpodni(v);
    const gs = new THREE.ExtrudeGeometry(sh, { depth: v.H - zs, bevelEnabled: false }); gs.rotateX(-Math.PI / 2);
    const strop = new THREE.Mesh(gs, mStrop); strop.position.y = zs; skup.add(strop);
    /* výstupní čára */
    const body = g.vystupniBody.map(q => new THREE.Vector3(q.p[0], SCHOD.vyskaVystupni(v, q.t) + 15, -q.p[1]));
    skup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(body), new THREE.LineBasicMaterial({ color: barvy.akcent })));
    /* zábradlí: madlo + příčle na volných okrajích */
    const z = SCHOD.zabradli(v);
    const mZ = material(s.material === 'drevo' ? 0x8a5a30 : 0x333a40);
    for (const strana of z.strany) {
      const madlo = [];
      g.nosy.forEach((q, i) => {
        const p = strana === 'vnitrni' ? q.I : q.O;
        madlo.push(new THREE.Vector3(p[0], q.z + z.vyska, -p[1]));
        if (i < g.nosy.length - 1 && g.stupne[i].typ !== 'podesta') {
          const C = g.nosy[i + 1], pc = strana === 'vnitrni' ? C.I : C.O;
          const pocet = (z.poStupnich[strana] || [])[i] || 1;
          for (let j = 0; j < pocet; j++) {
            const f = (j + 0.5) / pocet, x = p[0] + (pc[0] - p[0]) * f, y = p[1] + (pc[1] - p[1]) * f;
            const zz = q.z, vy = z.vyska + h * f - 40;
            const tyc = new THREE.Mesh(new THREE.BoxGeometry(s.prickaTl, vy, s.prickaTl), mZ);
            tyc.position.set(x, zz + vy / 2, -y); skup.add(tyc);
          }
        }
      });
      const krivka = new THREE.CatmullRomCurve3(madlo, false, 'catmullrom', 0.1);
      skup.add(new THREE.Mesh(new THREE.TubeGeometry(krivka, Math.max(20, madlo.length * 6), 22, 8, false), mZ));
    }
    return skup;
  }

  function vykresli() {
    if (!renderer || pozadavek) return;
    pozadavek = requestAnimationFrame(() => {
      pozadavek = 0;
      const w = kont.clientWidth, h = kont.clientHeight;
      if (w < 2 || h < 2) return;
      const pr = Math.min(window.devicePixelRatio || 1, 2.5);
      if (renderer.getPixelRatio() !== pr) renderer.setPixelRatio(pr);
      const sz = renderer.getSize(new THREE.Vector2());
      if (sz.x !== w || sz.y !== h) renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const [cx, cy, cz] = kam.cil;
      camera.position.set(cx + kam.dist * Math.cos(kam.el) * Math.cos(kam.az), cy + kam.dist * Math.sin(kam.el), cz + kam.dist * Math.cos(kam.el) * Math.sin(kam.az));
      camera.lookAt(cx, cy, cz);
      renderer.render(scene, camera);
    });
  }
  let posledniRozmer = '';
  function vychozi() { postav.uz = false; kam.az = -0.9; kam.el = 0.55; }
  function resetPohledu(v) { vychozi(); if (v) { const bb = v.g.bbox; kam.dist = Math.max(3500, Math.hypot(bb.w, bb.h, v.H) * 1.6); postav.uz = true; } vykresli(); }

  return { init, postav, sestav, vykresli, vychozi, resetPohledu };
})();
if (typeof module !== 'undefined') module.exports = SCHOD_3D;
