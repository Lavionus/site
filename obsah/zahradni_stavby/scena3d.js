/* ============================================================
   Zahradní stavby – 3D náhled (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Díly z jádra (kvádry s vlastní bází, hranoly náplně), procedurální textura dřeva (letokruhy),
   stavba po krocích (díly aktuálního kroku „spadnou“ na místo), stín od Slunce (směrové světlo
   podle polohy Slunce), růžice se severem. Kreslí se jen při změně a jen když je plátno vidět.
   Souřadnice: jádro (x, y, z) v mm, z nahoru → three (x, z, −y) otočením kořenové skupiny.
   ============================================================ */
(function (koren) {
  'use strict';
  const BARVY = { beton: 0xb9b9b4, ocel: 0x8a9096, zed: 0xe8e2d6, pletivo: 0x9aa0a6, folie: 0x1f1f1f };
  const DREVO = [[0.86, 0.66, 0.42], [0.66, 0.45, 0.25]];

  function vytvor(obal) {
    const THREE = koren.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 10, 1e6);
    const nebe = new THREE.HemisphereLight(0xdfeaff, 0x5b5040, 0.75); scena.add(nebe);
    const slunce = new THREE.DirectionalLight(0xfff1dc, 2.2); slunce.castShadow = true;
    slunce.shadow.mapSize.set(2048, 2048); slunce.shadow.bias = -0.0004; slunce.shadow.normalBias = 2;
    scena.add(slunce); scena.add(slunce.target);
    const koren3 = new THREE.Group(); koren3.rotation.x = -Math.PI / 2; scena.add(koren3);
    const orbit = { az: -35, el: 26, vzd: 6000, stred: new THREE.Vector3() };
    let S = null, dily = [], t = 1e9, nKroku = 1, prehrava = false, spinave = true, zrusen = false, teren = null, sever = null, smerSl = [0.3, -0.5, 0.8];

    function tmave() { const dt = document.documentElement.getAttribute('data-theme'); return dt === 'dark' || (!dt && matchMedia('(prefers-color-scheme: dark)').matches); }
    function materialDreva(roz, odstin) {
      const m = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const tenky = roz[1] < roz[2] ? 1 : 2, st = [0, 0, 0]; st[tenky] = -(Math.min(roz[1], roz[2]) * 4 + 60);
      const k = 0.92 + 0.16 * odstin;
      m.userData.u = { uStred: { value: new THREE.Vector3(...st) }, uSvetla: { value: new THREE.Vector3(...DREVO[0].map((x) => x * k)) }, uTmava: { value: new THREE.Vector3(...DREVO[1].map((x) => x * k)) }, uRoztec: { value: Math.max(2.4, Math.min(6, Math.min(roz[1], roz[2]) / 5)) } };
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, m.userData.u);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDrevo;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDrevo = position;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vDrevo; uniform vec3 uStred; uniform vec3 uSvetla; uniform vec3 uTmava; uniform float uRoztec;
float hsh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float sum3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 p = vDrevo; float al = p.x; vec2 pr = p.yz - uStred.yz;
  float r = length(pr) + 2.2 * sum3(vec3(p * 0.012)) + 1.2 * sin(al * 0.021) + 0.6 * sum3(p * 0.05);
  float k = fract(r / uRoztec);
  float leto = smoothstep(0.0, 0.18, k) * (1.0 - smoothstep(0.62, 1.0, k));
  vec3 c = mix(uTmava, uSvetla, 0.4 + 0.6 * leto);
  c *= 0.9 + 0.12 * sum3(vec3(al * 0.08, pr * 1.7));
  diffuseColor.rgb = c; }`);
      };
      m.customProgramCacheKey = () => 'zs_drevo';
      return m;
    }
    function material(d, i) {
      if (d.mat === 'drevo') return materialDreva(d.roz, ((i * 7919) % 100) / 100);
      if (d.mat === 'vrstva') return new THREE.MeshStandardMaterial({ color: new THREE.Color(d.barva), roughness: 1 });
      if (d.mat === 'pletivo') return new THREE.MeshStandardMaterial({ color: BARVY.pletivo, roughness: 0.5, metalness: 0.6, transparent: true, opacity: 0.45, depthWrite: false });
      if (d.mat === 'folie') return new THREE.MeshStandardMaterial({ color: BARVY.folie, roughness: 0.4, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
      return new THREE.MeshStandardMaterial({ color: BARVY[d.mat] || 0x999999, roughness: d.mat === 'ocel' ? 0.45 : 0.95, metalness: d.mat === 'ocel' ? 0.6 : 0 });
    }
    function geometrie(d) {
      if (d.tvar === 'hranol') {
        const tvar = new THREE.Shape(d.poly.map((q) => new THREE.Vector2(q[0], q[1])));
        const g = new THREE.ExtrudeGeometry(tvar, { depth: d.z1 - d.z0, bevelEnabled: false, curveSegments: 1 });
        g.translate(0, 0, d.z0); return g;
      }
      return new THREE.BoxGeometry(d.roz[0], d.roz[1], d.roz[2]);
    }
    function zlikviduj() {
      for (const x of dily) { koren3.remove(x.g); x.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
      dily = [];
      if (teren) { koren3.remove(teren); teren.geometry.dispose(); teren.material.dispose(); teren = null; }
      if (sever) { koren3.remove(sever); sever.material.map.dispose(); sever.material.dispose(); sever = null; }
    }
    function stitek(text) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      const g = c.getContext('2d'); g.fillStyle = 'rgba(180,30,30,0.85)'; g.beginPath(); g.arc(64, 64, 46, 0, 2 * Math.PI); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 68);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: true, transparent: true })); return s;
    }

    function nastav(nove) {
      const stejnyTyp = S && S.typ === nove.typ;
      S = nove; zlikviduj();
      const z = S.zona, vel = Math.max(z[1] - z[0], z[3] - z[2], z[5] - z[4], 500);
      S.dily.forEach((d, i) => {
        const g = new THREE.Group();
        const mesh = new THREE.Mesh(geometrie(d), material(d, i));
        mesh.castShadow = d.mat !== 'pletivo' && d.mat !== 'folie'; mesh.receiveShadow = true;
        g.add(mesh);
        if (d.mat === 'drevo' || d.mat === 'beton' || d.mat === 'ocel') {
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), new THREE.LineBasicMaterial({ color: 0x2b1d10, transparent: true, opacity: 0.35 }));
          g.add(e);
        }
        if (d.tvar !== 'hranol') {
          const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(...d.u), new THREE.Vector3(...d.v), new THREE.Vector3(...d.w));
          M.setPosition(d.c[0], d.c[1], d.c[2]);
          mesh.applyMatrix4(M); g.children[1] && g.children[1].applyMatrix4(M);
        }
        koren3.add(g);
        dily.push({ d, g });
      });
      nKroku = Math.max(1, S.kroky.length);
      // terén
      const tw = (z[1] - z[0]) + vel * 3, th = (z[3] - z[2]) + vel * 3;
      teren = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), new THREE.MeshStandardMaterial({ color: tmave() ? 0x3f5a32 : 0x7fa35f, roughness: 1, transparent: true, opacity: 0.82, depthWrite: true }));
      teren.position.set((z[0] + z[1]) / 2, (z[2] + z[3]) / 2, -1); teren.receiveShadow = true; koren3.add(teren);
      sever = stitek('S'); sever.scale.set(vel * 0.07, vel * 0.07, 1); koren3.add(sever);
      nastavSever(S.p.orientace);
      orbit.stred.set((z[0] + z[1]) / 2, Math.max(0, (z[4] + z[5]) / 2) * 0.8, -(z[2] + z[3]) / 2);
      if (!stejnyTyp) orbit.vzd = vel * 2.4;
      kamera.near = vel / 100; kamera.far = vel * 100; kamera.updateProjectionMatrix();
      const sc = slunce.shadow.camera, r = vel * 1.1;
      sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 10; sc.far = vel * 8; sc.updateProjectionMatrix();
      if (t > nKroku) t = nKroku;
      nastavSlunce(smerSl); polohy();
    }
    function nastavSever(orientace) {
      if (!sever || !S) return;
      const a = (orientace || 0) * Math.PI / 180, z = S.zona, vel = Math.max(z[1] - z[0], z[3] - z[2]);
      const c = [(z[0] + z[1]) / 2, (z[2] + z[3]) / 2];
      sever.position.set(c[0] + Math.cos(a) * vel * 0.75, c[1] + Math.sin(a) * vel * 0.75, 30);
      spinave = true;
    }
    /** směr ke Slunci v souřadnicích stavby (jednotkový), null = pod obzorem */
    function nastavSlunce(v) {
      smerSl = v;
      if (!S) return;
      const z = S.zona, vel = Math.max(z[1] - z[0], z[3] - z[2], z[5] - z[4], 500);
      const c = new THREE.Vector3((z[0] + z[1]) / 2, (z[2] + z[3]) / 2, 0);
      if (!v || v[2] <= 0.01) { slunce.intensity = 0; nebe.intensity = 0.45; }
      else {
        slunce.intensity = 2.4 * Math.min(1, v[2] * 3); nebe.intensity = 0.75;
        const P = new THREE.Vector3(c.x + v[0] * vel * 3, c.y + v[1] * vel * 3, v[2] * vel * 3).applyEuler(koren3.rotation);
        slunce.position.copy(P); slunce.target.position.copy(c.clone().applyEuler(koren3.rotation));
        slunce.target.updateMatrixWorld();
      }
      spinave = true;
    }
    function polohy() {
      if (!S) return;
      const z = S.zona, pad = Math.max(400, (z[5] - z[4]) * 0.8);
      for (const x of dily) {
        const k = x.d.krok || 0, f = Math.max(0, Math.min(1, t - k));
        x.g.visible = t >= k + 1e-6 || t >= nKroku;
        const e = f * f * (3 - 2 * f);
        x.g.position.set(0, 0, (1 - e) * pad);
        if (t >= nKroku) x.g.position.set(0, 0, 0);
      }
      spinave = true;
    }
    function pohled(jaky) {
      const P = { iso: [-35, 26], predni: [0, 4], shora: [0, 89.9], zboku: [-90, 4], zezadu: [180, 20] }[jaky] || [-35, 26];
      orbit.az = P[0]; orbit.el = P[1]; spinave = true;
    }
    function velikost() {
      const w = obal.clientWidth || 300, h = obal.clientHeight || 300;
      renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); spinave = true;
    }
    function kresli() {
      const az = orbit.az * Math.PI / 180, el = orbit.el * Math.PI / 180;
      kamera.position.set(orbit.stred.x + orbit.vzd * Math.cos(el) * Math.sin(az), orbit.stred.y + orbit.vzd * Math.sin(el), orbit.stred.z + orbit.vzd * Math.cos(el) * Math.cos(az));
      kamera.lookAt(orbit.stred);
      scena.background = new THREE.Color(tmave() ? 0x1d2228 : 0xdfe7ee);
      if (teren) teren.material.color.set(tmave() ? 0x3f5a32 : 0x7fa35f);
      renderer.render(scena, kamera);
    }
    let tPosl = 0;
    function smycka(ts) {
      if (zrusen) return;
      requestAnimationFrame(smycka);
      const dt = Math.min(0.05, (ts - (tPosl || ts)) / 1000); tPosl = ts;
      if (prehrava) {
        t += dt / 1.1;
        if (t >= nKroku + 1.2) t = 0;
        polohy(); if (api.priZmeneT) api.priZmeneT(Math.min(t, nKroku));
      }
      if (spinave && obal.offsetParent !== null) { spinave = false; kresli(); }
    }
    const ukazatele = new Map(); let pinch0 = 0;
    renderer.domElement.addEventListener('pointerdown', (e) => { renderer.domElement.setPointerCapture(e.pointerId); ukazatele.set(e.pointerId, [e.clientX, e.clientY]); renderer.domElement.style.cursor = 'grabbing'; });
    renderer.domElement.addEventListener('pointermove', (e) => {
      if (!ukazatele.has(e.pointerId)) return;
      const p = ukazatele.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
      ukazatele.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukazatele.size === 1) { orbit.az -= dx * 0.4; orbit.el = Math.max(-5, Math.min(89.9, orbit.el + dy * 0.4)); }
      else if (ukazatele.size === 2) { const [a, b] = [...ukazatele.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) orbit.vzd = Math.max(200, orbit.vzd * pinch0 / d); pinch0 = d; }
      spinave = true;
    });
    const konec = (e) => { ukazatele.delete(e.pointerId); pinch0 = 0; renderer.domElement.style.cursor = 'grab'; };
    renderer.domElement.addEventListener('pointerup', konec); renderer.domElement.addEventListener('pointercancel', konec);
    renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); orbit.vzd = Math.max(200, orbit.vzd * Math.exp(e.deltaY * 0.0012)); spinave = true; }, { passive: false });
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    new MutationObserver(() => { spinave = true; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    velikost(); requestAnimationFrame(smycka);
    const api = {
      nastav, pohled, nastavSlunce, nastavSever,
      nastavT(v) { t = Math.max(0, v); polohy(); },
      prehraj(ano) { prehrava = ano == null ? !prehrava : ano; if (prehrava && t >= nKroku) t = 0; return prehrava; },
      prekresli() { spinave = true; },
      snimek() { kresli(); return renderer.domElement.toDataURL('image/png'); },
      get t() { return t; }, get nKroku() { return nKroku; }, get prehrava() { return prehrava; },
      zrus() { zrusen = true; ro.disconnect(); zlikviduj(); renderer.dispose(); },
      priZmeneT: null,
    };
    return api;
  }
  koren.ZS3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
