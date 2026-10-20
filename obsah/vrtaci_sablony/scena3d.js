/* ============================================================
   Vrtací šablony – 3D náhled (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Deska = vytažený obrys s otvory (slepé díry mají dno), nad ní přiložená papírová šablona
   (textura ze SVG) nebo přípravek ze sítě manifoldu. Kreslí se jen po změně a když je vidět.
   Souřadnice dílu (x, y, z nahoru) → three (x − w/2, z, −(y − h/2)).
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
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 0.9);
    const svetlo = new THREE.DirectionalLight(0xffffff, 1.6);
    scena.add(hemi, svetlo, svetlo.target);
    const skupina = new THREE.Group(); scena.add(skupina);
    const orbit = { az: -30, el: 38, vzd: 800, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = true, spinave = true, zrusen = false, textura = null;
    let stav = { dil: null, prilozit: true, sit: null };

    function tmave() {
      const t = document.documentElement.getAttribute('data-theme') || '';
      return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches);
    }
    function zlikviduj() {
      for (const o of skupina.children.slice()) {
        skupina.remove(o);
        o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) { const m = Array.isArray(x.material) ? x.material : [x.material]; for (const q of m) { if (q.map) q.map.dispose(); q.dispose(); } } });
      }
    }
    async function texturaZSvg(svg, w, h) {
      const img = new Image();
      await new Promise((ok, chyba) => { img.onload = ok; img.onerror = chyba; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      const max = Math.min(renderer.capabilities.maxTextureSize, 2048), k = max / Math.max(w, h);
      const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w * k)); c.height = Math.max(2, Math.round(h * k));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    }

    let poradi = 0;
    async function aktualizuj(dil, o) {
      stav = Object.assign(stav, { dil }, o || {});
      const moje = ++poradi;
      let tex = null;
      if (stav.prilozit && !stav.sit && stav.svg) { try { tex = await texturaZSvg(stav.svg, stav.svgW, stav.svgH); } catch (e) { tex = null; } }
      if (moje !== poradi || zrusen) { if (tex) tex.dispose(); return; }
      postav(tex);
    }

    function postav(tex) {
      zlikviduj();
      const dil = stav.dil;
      if (!dil) return;
      const tm = tmave();
      scena.background = new THREE.Color(tm ? 0x1d2228 : 0xe4ebf2);
      const W = dil.w, H = dil.h, t = Math.max(2, dil.t || 18);
      const X = (x) => x - W / 2, Z = (y) => -(y - H / 2);
      // deska s otvory
      const tvar = new THREE.Shape();
      if (dil.kruh) tvar.absarc(0, 0, W / 2, 0, Math.PI * 2, false);
      else { tvar.moveTo(-W / 2, -H / 2); tvar.lineTo(W / 2, -H / 2); tvar.lineTo(W / 2, H / 2); tvar.lineTo(-W / 2, H / 2); tvar.closePath(); }
      // otvory v obrysu (překrývající se nebo zasahující přes okraj se vynechají – triangulace by selhala)
      const diry = [];
      for (const q of dil.diry) {
        if (dil.kruh ? Math.hypot(q.x - W / 2, q.y - H / 2) + q.d / 2 > W / 2 - 0.5 : (q.x - q.d / 2 < 0.3 || q.x + q.d / 2 > W - 0.3 || q.y - q.d / 2 < 0.3 || q.y + q.d / 2 > H - 0.3)) continue;
        if (diry.some((p) => Math.hypot(p.x - q.x, p.y - q.y) < (p.d + q.d) / 2 + 0.3)) continue;
        diry.push(q);
        const p = new THREE.Path(); p.absarc(X(q.x), q.y - H / 2, q.d / 2, 0, Math.PI * 2, true); tvar.holes.push(p);
      }
      const geo = new THREE.ExtrudeGeometry(tvar, { depth: t, bevelEnabled: false, curveSegments: 28 });
      geo.rotateX(-Math.PI / 2); geo.translate(0, -t, 0);
      const barva = dil.zed ? 0xe8e4da : 0xd9b98a;
      const mat = new THREE.MeshStandardMaterial({ color: barva, roughness: 0.85, metalness: 0 });
      skupina.add(new THREE.Mesh(geo, mat));
      // dna slepých děr
      const dno = new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.9 });
      for (const q of diry) {
        if (!q.hl || q.hl >= t) continue;
        const c = new THREE.Mesh(new THREE.CylinderGeometry(q.d / 2, q.d / 2, t - q.hl, 28), dno);
        c.position.set(X(q.x), -q.hl - (t - q.hl) / 2, Z(q.y)); skupina.add(c);
      }
      // šablona nebo přípravek
      if (stav.sit) {
        const g = new THREE.BufferGeometry(), p = stav.sit.poz, poz = new Float32Array(p.length);
        for (let i = 0; i < p.length; i += 3) { poz[i] = X(p[i]); poz[i + 1] = p[i + 2] + (stav.prilozit ? 0.05 : 40 + t); poz[i + 2] = Z(p[i + 1]); }
        g.setAttribute('position', new THREE.BufferAttribute(poz, 3)); g.setIndex(new THREE.BufferAttribute(stav.sit.idx, 1));
        // (x, y, z) → (x, z, −y) je otočení, pořadí vrcholů zůstává; neindexovaně = ostré hrany bez vyhlazení
        const g2 = g.toNonIndexed(); g.dispose(); g2.computeVertexNormals();
        skupina.add(new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ color: 0x3f8f5a, roughness: 0.55, metalness: 0.05 })));
      } else if (tex && stav.oblast) {
        const P = stav.oblast;
        const pw = P.x1 - P.x0, ph = P.y1 - P.y0;
        const papir = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.93, side: THREE.DoubleSide }));
        papir.rotation.x = -Math.PI / 2;
        papir.position.set(X((P.x0 + P.x1) / 2), stav.prilozit ? 0.25 : 30 + t, Z((P.y0 + P.y1) / 2));
        skupina.add(papir);
      }
      const m = Math.max(W, H);
      stred = new THREE.Vector3(0, -t / 2, 0);
      orbit.vzd = m * 1.6 + 60;
      svetlo.position.set(m * 0.6, m * 1.2, m * 0.9); svetlo.target.position.copy(stred);
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
    const mo = new MutationObserver(() => { if (stav.dil) postav(null); spinave = true; }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    (function smycka() {
      if (zrusen) return;
      if (viditelne && spinave && !document.hidden) { spinave = false; nastavKameru(); renderer.render(scena, kamera); }
      requestAnimationFrame(smycka);
    })();
    return {
      aktualizuj,
      prekresli() { aktualizuj(stav.dil); },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, sirka: renderer.domElement.width, vyska: renderer.domElement.height, objektu: skupina.children.length, sit: !!stav.sit, prilozit: stav.prilozit }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(); renderer.dispose(); el.remove(); },
    };
  }
  koren.VS3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
