/* ============================================================
   Sluneční hodiny – 3D pohled (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Geometrie i stín přicházejí ze SHP.sestava (přesný průmět gnomonu do roviny ciferníku),
   three.js je jen kreslí. Kreslí se na vyžádání (po změně nebo pohybu kamery) a jen když je plátno vidět.
   Souřadnice: svět (V, S, N) v mm → three (x = V, y = N(ahoru), z = −S).
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;

  function vytvor(obal) {
    const THREE = koren.THREE;
    const v3 = (p) => new THREE.Vector3(p[0], p[2], -p[1]);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(38, 1, 1, 1e6);
    const ambient = new THREE.HemisphereLight(0xffffff, 0x8a8170, 0.75);
    const slunceSvetlo = new THREE.DirectionalLight(0xfff3d6, 1.4);
    scena.add(ambient, slunceSvetlo, slunceSvetlo.target);
    const staticka = new THREE.Group(), dynamicka = new THREE.Group();
    scena.add(staticka, dynamicka);
    let R0 = null, textura = null, texturaKlic = '', meritko = 300, stred = new THREE.Vector3();
    const orbit = { az: -35, el: 32, vzd: 1, vzdNasob: 1 };
    let viditelne = true, spinave = true, zrusen = false, tema = null;

    function zlikviduj(g) {
      for (const o of g.children.slice()) {
        g.remove(o);
        o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) { const m = Array.isArray(x.material) ? x.material : [x.material]; for (const q of m) { if (q.map && q.map !== textura) q.map.dispose(); q.dispose(); } } });
      }
    }
    function barvyTematu() {
      const tmave = (document.documentElement.getAttribute('data-theme') || '') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
      return tmave ? { pozadi: 0x1d2228, zem: 0x3b4637, text: '#e8e8e8' } : { pozadi: 0xdfe9f3, zem: 0xb9c9a6, text: '#1d2a36' };
    }
    function stitek(text, barva, vel) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      const g = c.getContext('2d'); g.fillStyle = barva; g.font = 'bold 84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 68);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
      s.scale.set(vel, vel, 1); s.renderOrder = 5; return s;
    }
    /** mnohoúhelník v rovině F (body v souřadnicích roviny) s UV do textury ciferníku */
    function plochaMesh(F, sc, mat, posun) {
      const r = F.rect, body = [];
      if (F.kruh) { const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, rr = (r.x1 - r.x0) / 2; for (let i = 0; i < 64; i++) { const a = i / 64 * 2 * Math.PI; body.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } }
      else body.push([r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]);
      const poz = [], uv = [], idx = [];
      for (const q of body) {
        const P = koren.SHP.zRoviny(F, q), d = posun || 0;
        poz.push(...v3([P[0] + F.n[0] * d, P[1] + F.n[1] * d, P[2] + F.n[2] * d]).toArray());
        uv.push((q[0] - sc.x0) / sc.w, (q[1] + sc.y1) / sc.h);
      }
      for (let i = 1; i < body.length - 1; i++) idx.push(0, i, i + 1);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      // orientace: normála trojúhelníků musí souhlasit s F.n (jinak prohodit pořadí)
      const n0 = new THREE.Vector3().fromBufferAttribute(g.getAttribute('normal'), 0), nf = v3(F.n);
      if (n0.dot(nf) < 0) { const ii = []; for (let i = 0; i < idx.length; i += 3) ii.push(idx[i], idx[i + 2], idx[i + 1]); g.setIndex(ii); g.computeVertexNormals(); }
      return new THREE.Mesh(g, mat);
    }
    function valec(A, B, r, mat) {
      const a = v3(A), b = v3(B), d = b.clone().sub(a), L = d.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 16), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      return m;
    }
    function cara(body, barva, carkovane, sirka) {
      const g = new THREE.BufferGeometry().setFromPoints(body.map(v3));
      const m = carkovane ? new THREE.LineDashedMaterial({ color: barva, dashSize: meritko * 0.02, gapSize: meritko * 0.015, transparent: true, opacity: 0.8 }) : new THREE.LineBasicMaterial({ color: barva, linewidth: sirka || 1 });
      const l = new THREE.Line(g, m); if (carkovane) l.computeLineDistances(); return l;
    }

    async function texturaCiferniku(R) {
      const klic = R.cifernik.prvky.length + ':' + R.cifernik.w + ':' + R.cifernik.h + ':' + JSON.stringify(R.p);
      if (klic === texturaKlic && textura) return textura;
      const svg = koren.SHV.svg(R.cifernik, { okraj: 0, pomoc: R.p.popisky, vlozitPismo: true });
      const img = new Image();
      await new Promise((ok, chyba) => { img.onload = ok; img.onerror = chyba; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      const max = Math.min(renderer.capabilities.maxTextureSize, 2048), k = max / Math.max(R.cifernik.w, R.cifernik.h);
      const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(R.cifernik.w * k)); c.height = Math.max(2, Math.round(R.cifernik.h * k));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      if (textura) textura.dispose();
      textura = new THREE.CanvasTexture(c); textura.colorSpace = THREE.SRGBColorSpace; textura.anisotropy = 4;
      texturaKlic = klic;
      return textura;
    }

    let poslSestava = null, cekaTextura = false;
    async function aktualizuj(R, sest) {
      if (zrusen) return;
      poslSestava = sest;
      if (R !== R0) {
        R0 = R; cekaTextura = true;
        try { await texturaCiferniku(R); } catch (e) { textura = null; }
        cekaTextura = false;
        if (zrusen || R !== R0) return;
        postavStatickou(R, poslSestava);
      }
      if (!cekaTextura) postavDynamickou(R0, poslSestava);
    }

    function postavStatickou(R, sest) {
      zlikviduj(staticka);
      meritko = sest.meritko;
      tema = barvyTematu();
      scena.background = new THREE.Color(tema.pozadi);
      const z0 = sest.podlaha;
      const zem = new THREE.Mesh(new THREE.CircleGeometry(meritko * 1.6, 64), new THREE.MeshLambertMaterial({ color: tema.zem }));
      zem.rotation.x = -Math.PI / 2; zem.position.y = z0; staticka.add(zem);
      // světové strany
      const Rk = meritko * 1.25;
      for (const [t, e, n] of [['S', 0, 1], ['J', 0, -1], ['V', 1, 0], ['Z', -1, 0]]) {
        const s = stitek(t, t === 'S' ? '#d33' : tema.text, meritko * 0.14); s.position.copy(v3([e * Rk, n * Rk, z0 + meritko * 0.05])); staticka.add(s);
        staticka.add(cara([[0, 0, z0 + 0.2], [e * Rk * 0.92, n * Rk * 0.92, z0 + 0.2]], t === 'S' ? 0xcc3333 : 0x666666));
      }
      if (R.p.typ === 'svisle' || R.p.typ === 'deklinujici') {
        // stěna za ciferníkem
        const F = sest.plochy[0], r = F.rect, m = Math.max(r.x1 - r.x0, r.y1 - r.y0) * 0.6;
        const stena = { O3: F.O3.map((x, i) => x - F.n[i] * 1.5), ex: F.ex, ey: F.ey, n: F.n, rect: { x0: r.x0 - m, x1: r.x1 + m, y0: z0 - F.O3[2] - 1, y1: r.y1 + m } };
        staticka.add(plochaMesh(stena, { x0: 0, w: 1, y1: 0, h: 1 }, new THREE.MeshLambertMaterial({ color: 0xc8b9a3 })));
      }
      stred = v3(sest.typStred || [0, 0, (sest.plochy[0] ? sest.plochy[0].O3[2] : 0)]);
      if (R.p.typ === 'kapesni') stred = v3([0, 0, R.info.rozvin.vyska * 0.6]);
      orbit.vzd = meritko * 1.75;
      spinave = true;
    }

    function postavDynamickou(R, sest) {
      if (!R || !sest) return;
      zlikviduj(dynamicka);
      const matCif = textura ? new THREE.MeshLambertMaterial({ map: textura }) : new THREE.MeshLambertMaterial({ color: 0xffffff });
      const matRub = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
      const kap = R.p.typ === 'kapesni';
      for (const F of sest.plochy) {
        dynamicka.add(plochaMesh(F, R.cifernik, matCif));
        if (!kap && R.p.typ !== 'ekvatorialni') {
          const rub = Object.assign({}, F, { n: F.n.map((x) => -x), O3: F.O3.map((x, i) => x - F.n[i] * 0.8) });
          dynamicka.add(plochaMesh(rub, R.cifernik, matRub));
        }
      }
      if (kap) {
        // horní a dolní podstava hranolu (šedě)
        const vrch = [], spod = [];
        for (const F of sest.plochy) { const a = koren.SHP.zRoviny(F, [F.rect.x0, 0]); vrch.push(v3(a)); spod.push(v3([a[0], a[1], a[2] - R.info.rozvin.vyska])); }
        for (const body of [vrch, spod]) {
          const g = new THREE.BufferGeometry().setFromPoints(body), ii = []; for (let i = 1; i < body.length - 1; i++) ii.push(0, i, i + 1);
          g.setIndex(ii); g.computeVertexNormals();
          dynamicka.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xb0a080, side: THREE.DoubleSide })));
        }
      }
      // gnomon
      const kov = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide });
      for (const g of sest.gnomony) {
        if (g.t === 'troj' || g.t === 'deska') {
          const geo = new THREE.BufferGeometry().setFromPoints(g.body.map(v3));
          geo.setIndex(g.t === 'troj' ? [0, 1, 2] : [0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
          dynamicka.add(new THREE.Mesh(geo, kov));
          dynamicka.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(g.body.map(v3)), new THREE.LineBasicMaterial({ color: 0x3a2a10 })));
        } else if (g.t === 'tyc' || g.t === 'kolik') dynamicka.add(valec(g.body[0], g.body[1], g.r, kov));
        else if (g.t === 'retez') dynamicka.add(cara(g.body, 0xd4af37));
      }
      for (const nd of sest.nodusy || (sest.nodus ? [sest.nodus] : [])) {
        const k = new THREE.Mesh(new THREE.SphereGeometry(meritko * 0.008 + 0.4, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7, roughness: 0.3 }));
        k.position.copy(v3(nd)); dynamicka.add(k);
      }
      // stín (přesný průmět)
      if (sest.stin) {
        const F = sest.plochy[sest.stin.plocha], zR = (q) => koren.SHP.zRoviny(F, q);
        const odsaz = Math.max(0.15, meritko * 0.0008), mat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
        let body = sest.stin.body2D;
        if (sest.stin.cara) {
          const [A, B] = body, dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1, s = Math.max(0.6, (+R.p.prumerTyce || 2) / 2, kap ? 0.4 : meritko * 0.004);
          body = [[A[0] - dy / l * s, A[1] + dx / l * s], [B[0] - dy / l * s, B[1] + dx / l * s], [B[0] + dy / l * s, B[1] - dx / l * s], [A[0] + dy / l * s, A[1] - dx / l * s]];
        }
        const pts = body.map((q) => { const P = zR(q); return v3([P[0] + F.n[0] * odsaz, P[1] + F.n[1] * odsaz, P[2] + F.n[2] * odsaz]); });
        const geo = new THREE.BufferGeometry().setFromPoints(pts), ii = []; for (let i = 1; i < pts.length - 1; i++) ii.push(0, i, i + 1); geo.setIndex(ii);
        const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; dynamicka.add(m);
        const tecka = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.5, meritko * 0.006), 10, 6), new THREE.MeshBasicMaterial({ color: 0xd04a00 }));
        const Q = sest.stin.bod3D; tecka.position.copy(v3([Q[0] + F.n[0] * odsaz, Q[1] + F.n[1] * odsaz, Q[2] + F.n[2] * odsaz])); dynamicka.add(tecka);
      }
      // Slunce a jeho dráhy (koule o poloměru Rs kolem středu hodin)
      const Rs = meritko * 0.85, c0 = [stred.x, -stred.z, stred.y];
      const naKouli = (v) => [c0[0] + v[0] * Rs, c0[1] + v[1] * Rs, c0[2] + v[2] * Rs];
      const usek = (pole, barva, cark) => { let cur = []; for (const v of pole.concat([null])) { if (v) cur.push(naKouli(v)); else { if (cur.length > 1) dynamicka.add(cara(cur, barva, cark)); cur = []; } } };
      usek(sest.drahy.den, 0xffa000, false);
      usek(sest.drahy.leto, 0xb0b0b0, true);
      usek(sest.drahy.zima, 0xb0b0b0, true);
      const sv = sest.slunce.v, nad = sest.slunce.vyska > 0;
      const slunce = new THREE.Mesh(new THREE.SphereGeometry(meritko * 0.045, 20, 14), new THREE.MeshBasicMaterial({ color: nad ? 0xffd23f : 0x887744 }));
      slunce.position.copy(v3(naKouli(sv))); dynamicka.add(slunce);
      slunceSvetlo.position.copy(v3(naKouli(sv))); slunceSvetlo.target.position.copy(stred);
      slunceSvetlo.intensity = nad ? 1.4 : 0.05; ambient.intensity = nad ? 0.75 : 0.35;
      spinave = true;
    }

    /* ---------- kamera: tažení myší / prstem, kolečko, dva prsty ---------- */
    function nastavKameru() {
      const d = orbit.vzd * orbit.vzdNasob, az = orbit.az * RAD, el = orbit.el * RAD;
      kamera.position.set(stred.x + d * Math.cos(el) * Math.sin(az), stred.y + d * Math.sin(el), stred.z + d * Math.cos(el) * Math.cos(az));
      kamera.lookAt(stred); kamera.near = Math.max(0.1, d * 0.01); kamera.far = d * 20; kamera.updateProjectionMatrix();
    }
    const ukaz = new Map(); let pinch0 = null;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]); el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', (e) => {
      if (!ukaz.has(e.pointerId)) return;
      const [x0, y0] = ukaz.get(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 1) { orbit.az -= (e.clientX - x0) * 0.4; orbit.el = Math.max(-5, Math.min(89, orbit.el + (e.clientY - y0) * 0.3)); }
      else if (ukaz.size === 2) { const [a, b] = [...ukaz.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) orbit.vzdNasob = Math.max(0.2, Math.min(5, orbit.vzdNasob * pinch0 / d)); pinch0 = d; }
      spinave = true;
    });
    const pusť = (e) => { ukaz.delete(e.pointerId); if (ukaz.size < 2) pinch0 = null; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', pusť); el.addEventListener('pointercancel', pusť);
    el.addEventListener('wheel', (e) => { e.preventDefault(); orbit.vzdNasob = Math.max(0.2, Math.min(5, orbit.vzdNasob * Math.exp(e.deltaY * 0.001))); spinave = true; }, { passive: false });

    /* ---------- velikost a vykreslování na vyžádání ---------- */
    function velikost() {
      const w = Math.max(10, obal.clientWidth), h = Math.max(10, obal.clientHeight);
      renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      kamera.aspect = w / h; spinave = true;
    }
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    const mo = new MutationObserver(() => { spinave = true; }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; });
    io.observe(obal);
    velikost();
    function smycka() {
      if (zrusen) return;
      if (viditelne && spinave && !document.hidden) {
        spinave = false;
        const t = barvyTematu(); if (tema && t.pozadi !== tema.pozadi && R0 && poslSestava) postavStatickou(R0, poslSestava);
        nastavKameru(); renderer.render(scena, kamera);
      }
      requestAnimationFrame(smycka);
    }
    requestAnimationFrame(smycka);
    return {
      aktualizuj,
      vychoziPohled() { orbit.az = -35; orbit.el = 32; orbit.vzdNasob = 1; spinave = true; },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; spinave = true; },
      get stav() { return { viditelne, sirka: renderer.domElement.width, vyska: renderer.domElement.height, pomer: renderer.getPixelRatio(), objektu: dynamicka.children.length }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(staticka); zlikviduj(dynamicka); if (textura) textura.dispose(); renderer.dispose(); el.remove(); },
    };
  }

  koren.SH3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
