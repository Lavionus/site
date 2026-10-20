/* ============================================================
   Ohýbání dřeva – 3D náhled a animace (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Laminace: lamely se z rovného stavu ohýbají do formy (křivost × u) a negativ dosedá.
   Pára: přířez s pásem se ohýbá přes kopyto. Zářezy: řetěz bloků se zavírá.
   Model (x, y v mm, z = šířka) → three (x, y, z). Kreslí se jen po změně a když je vidět.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;

  function vytvor(obal) {
    const THREE = koren.THREE, OHD = koren.OHD;
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
    const pevne = new THREE.Group(), pohyb = new THREE.Group();
    scena.add(pevne, pohyb);
    const orbit = { az: -28, el: 24, vzd: 800, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = true, spinave = true, zrusen = false;
    let N = null, u = 1, hraje = false, t0 = 0, naZmenuU = null;
    const negativy = [];
    const MAT = {
      P: new THREE.MeshStandardMaterial({ color: 0xd9c28f, roughness: 0.9 }),
      N: new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.9 }),
      L1: new THREE.MeshStandardMaterial({ color: 0xc27f40, roughness: 0.7 }),
      L2: new THREE.MeshStandardMaterial({ color: 0xa96a30, roughness: 0.7 }),
      pas: new THREE.MeshStandardMaterial({ color: 0x7d858f, roughness: 0.35, metalness: 0.7 }),
      blok: new THREE.MeshStandardMaterial({ color: 0xd8c39a, roughness: 0.85 }),
    };
    const tmave = () => { const t = document.documentElement.getAttribute('data-theme') || ''; return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches); };
    const uvolni = (g) => { for (const o of g.children.slice()) { g.remove(o); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); } };

    function tvarZ(obrys, diry) {
      const s = new THREE.Shape(obrys.map((p) => new THREE.Vector2(p[0], p[1])));
      for (const d of diry || []) { const h = new THREE.Path(); h.absarc(d.x, d.y, d.r, 0, Math.PI * 2, true); s.holes.push(h); }
      return s;
    }
    function vytlac(obrys, diry, hl, mat) {
      const g = new THREE.ExtrudeGeometry(tvarZ(obrys, diry), { depth: hl, bevelEnabled: false, curveSegments: 20 });
      g.translate(0, 0, -hl / 2);
      return new THREE.Mesh(g, mat);
    }
    /** pás obdélníkového průřezu t × w podél lomené čáry b (střednice) */
    function pasGeo(b, t, w, uz) {
      const n = b.length, poz = [], idx = [];
      for (let i = 0; i < n; i++) {
        const a = b[i > 0 ? i - 1 : uz ? n - 1 : 0], c = b[i < n - 1 ? i + 1 : uz ? 0 : n - 1];
        const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * t / 2, ny = dx / l * t / 2;
        poz.push(b[i][0] - nx, b[i][1] - ny, -w / 2, b[i][0] + nx, b[i][1] + ny, -w / 2, b[i][0] + nx, b[i][1] + ny, w / 2, b[i][0] - nx, b[i][1] - ny, w / 2);
      }
      const m = uz ? n : n - 1;
      for (let i = 0; i < m; i++) {
        const A = i * 4, B = ((i + 1) % n) * 4;
        for (let s = 0; s < 4; s++) { const s2 = (s + 1) % 4; idx.push(A + s, B + s, B + s2, A + s, B + s2, A + s2); }
      }
      if (!uz) { const e = (n - 1) * 4; idx.push(0, 2, 1, 0, 3, 2, e, e + 1, e + 2, e, e + 2, e + 3); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3)); g.setIndex(idx);
      const g2 = g.toNonIndexed(); g.dispose(); g2.computeVertexNormals();
      return g2;
    }

    function postav() {
      uvolni(pevne); negativy.length = 0;
      if (!N) return;
      scena.background = new THREE.Color(tmave() ? 0x1d2228 : 0xe4ebf2);
      const g = N.geo;
      let ob;
      if (N.metoda === 'zarezy') {
        const r = OHD.retezZarezu(g, 1), body = r.bloky.flat().concat(OHD.retezZarezu(g, 0).bloky.flat());
        ob = OHD.ohraniceni(body);
      } else {
        const hl = g.nVrstev * g.mdf;
        for (const d of N.dily) {
          const neg = d.id[0] === 'N', m = vytlac(d.obrys, d.diry, hl, neg ? MAT.N : MAT.P);
          if (neg) {
            const o = OHD.ohraniceni(d.obrys), cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2, l = Math.hypot(cx, cy) || 1;
            negativy.push({ m, smer: g.uzavrena ? [cx / l, cy / l] : [0, 1] });
          }
          pevne.add(m);
        }
        ob = OHD.ohraniceni(N.dily.map((d) => d.obrys).flat());
      }
      const W = ob.w, H = ob.h, m = Math.max(W, H);
      stred = new THREE.Vector3((ob.x0 + ob.x1) / 2, (ob.y0 + ob.y1) / 2, 0);
      orbit.vzd = m * 1.7 + 80;
      svetlo.position.set(stred.x + m * 0.5, stred.y + m * 1.1, m * 1.2); svetlo.target.position.copy(stred);
      pohybuj();
    }
    function pohybuj() {
      uvolni(pohyb);
      if (!N) return;
      const g = N.geo, uu = Math.max(0, Math.min(1, u));
      if (N.metoda === 'zarezy') {
        const r = OHD.retezZarezu(g, uu), hl = Math.min(g.sirka, Math.max(120, g.Lcelk * 0.4));
        for (const b of r.bloky) pohyb.add(vytlac(b, [], hl, MAT.blok));
        spinave = true; return;
      }
      const zdvih = Math.max(40, g.T * 3), sirka = g.sirka;
      for (const x of negativy) x.m.position.set(x.smer[0] * zdvih * (1 - uu) * 1.4, x.smer[1] * zdvih * (1 - uu) * 1.4, 0);
      const lam = N.metoda === 'para' ? [g.strednice] : g.lamely;
      lam.forEach((b, i) => {
        let bb = b;
        if (!g.uzavrena) { bb = OHD.skalujKrivost(b, uu); if (uu < 1) { const dy = zdvih * (1 - uu) * 0.6; bb = bb.map((p) => [p[0], p[1] + dy]); } }
        else if (uu < 1) { const k = 1 + (1 - uu) * 0.25; bb = b.map((p) => [p[0] * k, p[1] * k]); }
        pohyb.add(new THREE.Mesh(pasGeo(bb, Math.max(0.3, g.t * 0.985), sirka, g.uzavrena), i % 2 ? MAT.L2 : MAT.L1));
        if (N.metoda === 'para' && g.pas) {
          const ps = OHD.odsad(bb, g.t / 2 + 1, g.uzavrena);
          pohyb.add(new THREE.Mesh(pasGeo(ps, Math.max(0.8, g.pasTl), sirka + 10, g.uzavrena), MAT.pas));
        }
      });
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
    const mo = new MutationObserver(() => { scena.background = new THREE.Color(tmave() ? 0x1d2228 : 0xe4ebf2); spinave = true; }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    (function smycka(cas) {
      if (zrusen) return;
      if (hraje && viditelne && !document.hidden) {
        // 0 → 1 za 3 s, 1 s výdrž, znovu
        const f = ((cas - t0) / 4000) % 1, nu = Math.min(1, f / 0.75);
        if (Math.abs(nu - u) > 1e-4) { u = nu; pohybuj(); if (naZmenuU) naZmenuU(u); }
      }
      if (viditelne && spinave && !document.hidden) { spinave = false; nastavKameru(); renderer.render(scena, kamera); }
      requestAnimationFrame(smycka);
    })(0);
    return {
      aktualizuj(n) { N = n; postav(); },
      nastavU(x) { u = x; hraje = false; pohybuj(); },
      hraj(ano) { hraje = !!ano; t0 = performance.now(); if (ano) { u = 0; pohybuj(); } else spinave = true; },
      get hraje() { return hraje; },
      set naZmenuU(f) { naZmenuU = f; },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, sirka: renderer.domElement.width, vyska: renderer.domElement.height, objektu: pevne.children.length + pohyb.children.length, u }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); uvolni(pevne); uvolni(pohyb); renderer.dispose(); el.remove(); },
    };
  }
  koren.OHD3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
