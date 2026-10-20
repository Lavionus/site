/* ============================================================
   Intarzie a parketáž – 3D náhled (three.js r160, globální THREE)
   Stolová deska na nohách nebo krabička s dýhovaným víkem. Líc nese mapu barvy z 2D náhledu;
   volitelná chatoyance: vlákna jsou v pásech kresby střídavě skloněná (mapa „pásy“) a podle
   směru vláken (mapa „úhel“) se počítá anizotropní lesk – při otáčení světla / pohledu pásy
   mění jas jako skutečná leštěná dýha.
   Souřadnice: deska x → three x, deska y (dolů) → three z, výška → three y.
   ============================================================ */
(function (koren) {
  'use strict';

  function vytvor(obal) {
    const THREE = koren.THREE, N = koren.INTN, J = koren.INTJ;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e5);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x6d6152, 0.75); scena.add(hemi);
    const sv = new THREE.DirectionalLight(0xfff2dc, 1.9); scena.add(sv);
    const sv2 = new THREE.DirectionalLight(0xdde8ff, 0.35); sv2.position.set(-0.7, 0.4, 0.6); scena.add(sv2);
    const skupina = new THREE.Group(); scena.add(skupina);
    const orbit = { az: -28, el: 34, vzd: 1500, stred: new THREE.Vector3() };
    let S = null, sloty = [], typ = 'deska', chat = 0.7, svetloAz = 35, svetloEl = 50, otacet = false, spinave = true, zrusen = false;
    const uni = { uUhel: { value: null }, uPasy: { value: null }, uChat: { value: chat }, uSvetloDir: { value: new THREE.Vector3(0, 1, 0) } };

    function barvaPozadi() {
      const dt = document.documentElement.getAttribute('data-theme');
      const tmave = dt === 'dark' || (!dt && matchMedia('(prefers-color-scheme: dark)').matches);
      return tmave ? 0x1c2026 : 0xe6e9ec;
    }
    function texturaZ(c, barevna) {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = barevna ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      t.needsUpdate = true; return t;
    }
    function materialLice(map) {
      const m = new THREE.MeshStandardMaterial({ map, roughness: 0.38, metalness: 0 });
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uni);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSvet;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSvet = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSvet; uniform sampler2D uUhel; uniform sampler2D uPasy; uniform float uChat; uniform vec3 uSvetloDir;')
          .replace('#include <opaque_fragment>', `
{ vec2 a2 = texture2D(uUhel, vMapUv).rg * 2.0 - 1.0;
  float th = 0.5 * atan(a2.y, a2.x);
  vec3 T = normalize(vec3(cos(th), 0.0, -sin(th)));
  float pas = texture2D(uPasy, vMapUv).r * 2.0 - 1.0;
  vec3 Nn = vec3(0.0, 1.0, 0.0);
  vec3 F = normalize(T + Nn * 0.42 * pas);
  vec3 V = normalize(cameraPosition - vSvet), L = normalize(uSvetloDir), H = normalize(L + V);
  float fh = dot(F, H);
  float an = pow(sqrt(max(0.0, 1.0 - fh * fh)), 48.0) * max(0.0, dot(Nn, L));
  vec2 hp = normalize(vec2(H.x, H.z) + 1e-5);
  float pruh = pas * dot(hp, vec2(T.x, T.z));
  outgoingLight *= 1.0 + uChat * 0.32 * pruh;
  outgoingLight += uChat * an * vec3(1.0, 0.93, 0.82) * 0.55;
}
#include <opaque_fragment>`);
      };
      m.customProgramCacheKey = () => 'intarzie-lic';
      return m;
    }
    function zlikviduj() {
      skupina.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) for (const m of [].concat(o.material)) { if (m.map) m.map.dispose(); m.dispose(); } });
      skupina.clear();
      if (uni.uUhel.value) uni.uUhel.value.dispose(); if (uni.uPasy.value) uni.uPasy.value.dispose();
    }
    function postav() {
      zlikviduj();
      if (!S) return;
      const W = S.deska[2] - S.deska[0], H = S.deska[3] - S.deska[1], vel = Math.max(W, H);
      const M = N.mapy(S, sloty, 2, 2048);
      const mapa = texturaZ(M.barva, true);
      uni.uUhel.value = texturaZ(M.uhel, false); uni.uPasy.value = texturaZ(M.pasy, false);
      const lic = materialLice(mapa);
      // boky: masiv / dýha dřeviny bordury (nebo první dřeviny)
      const slotBok = S.dilky.some((d) => d.druh === 'bordura') ? S.dilky.find((d) => d.druh === 'bordura').slot : 0;
      const dr = J.DREVINY[(sloty[slotBok] || {}).drevina] || J.DREVINY.dub;
      const tb = N.textura((sloty[slotBok] || {}).drevina, dr, 7 + slotBok * 13).barva;
      const bokMap = texturaZ(tb, true); bokMap.wrapS = bokMap.wrapT = THREE.RepeatWrapping; bokMap.repeat.set(vel / 256, 0.15);
      const bok = new THREE.MeshStandardMaterial({ map: bokMap, roughness: 0.55 });
      const spod = new THREE.MeshStandardMaterial({ color: 0x9c8364, roughness: 0.8 });
      if (typ === 'deska') {
        const t = Math.max(18, Math.min(40, vel * 0.035));
        const g = new THREE.BoxGeometry(W, t, H);
        const deska = new THREE.Mesh(g, [bok, bok, lic, spod, bok, bok]);
        const vyska = Math.min(W, H) * 0.75;
        deska.position.y = vyska + t / 2; skupina.add(deska);
        const n = Math.max(30, Math.min(70, vel * 0.06)), od = n * 0.9;
        const nohaMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.6 });
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const noha = new THREE.Mesh(new THREE.BoxGeometry(n, vyska, n), nohaMat);
          noha.position.set(x * (W / 2 - od), vyska / 2, z * (H / 2 - od)); skupina.add(noha);
        }
        orbit.stred.set(0, vyska * 0.85, 0);
      } else {
        const hb = Math.min(W, H) * 0.42, tv = Math.max(10, Math.min(24, vel * 0.04));
        const telo = new THREE.Mesh(new THREE.BoxGeometry(W * 0.985, hb, H * 0.985), [bok, bok, spod, spod, bok, bok]);
        telo.position.y = hb / 2; skupina.add(telo);
        const viko = new THREE.Mesh(new THREE.BoxGeometry(W, tv, H), [bok, bok, lic, spod, bok, bok]);
        viko.position.y = hb + tv / 2 + 0.6; skupina.add(viko);
        const spara = new THREE.Mesh(new THREE.BoxGeometry(W * 0.99, 1.2, H * 0.99), new THREE.MeshBasicMaterial({ color: 0x1a120b }));
        spara.position.y = hb + 0.2; skupina.add(spara);
        orbit.stred.set(0, hb * 0.7, 0);
      }
      const podl = new THREE.Mesh(new THREE.CircleGeometry(vel * 1.6, 48), new THREE.MeshStandardMaterial({ color: 0x8d8478, roughness: 1 }));
      podl.rotation.x = -Math.PI / 2; podl.position.y = -0.5; skupina.add(podl);
      orbit.vzd = vel * 2.3;
      kamera.near = vel / 100; kamera.far = vel * 40; kamera.updateProjectionMatrix();
      svetlo(); spinave = true;
    }
    function svetlo() {
      const a = svetloAz * Math.PI / 180, e = svetloEl * Math.PI / 180;
      sv.position.set(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
      uni.uSvetloDir.value.copy(sv.position).normalize();
      spinave = true;
    }
    function velikost() {
      const w = obal.clientWidth || 300, h = obal.clientHeight || 300;
      renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); spinave = true;
    }
    function kresli() {
      const az = orbit.az * Math.PI / 180, el = orbit.el * Math.PI / 180;
      kamera.position.set(orbit.stred.x + orbit.vzd * Math.cos(el) * Math.sin(az), orbit.stred.y + orbit.vzd * Math.sin(el), orbit.stred.z + orbit.vzd * Math.cos(el) * Math.cos(az));
      kamera.lookAt(orbit.stred);
      scena.background = new THREE.Color(barvaPozadi());
      renderer.render(scena, kamera);
    }
    let tPosl = 0;
    function smycka(ts) {
      if (zrusen) return;
      requestAnimationFrame(smycka);
      const dt = Math.min(0.05, (ts - (tPosl || ts)) / 1000); tPosl = ts;
      const vidi = obal.offsetParent !== null && api.viditelne;
      if (otacet && vidi) { svetloAz = (svetloAz + dt * 40) % 360; svetlo(); if (api.priZmeneSvetla) api.priZmeneSvetla(svetloAz); }
      if (spinave && vidi) { spinave = false; kresli(); }
    }
    const ukazatele = new Map(); let pinch0 = 0;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); ukazatele.set(e.pointerId, [e.clientX, e.clientY]); el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', (e) => {
      if (!ukazatele.has(e.pointerId)) return;
      const p = ukazatele.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
      ukazatele.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukazatele.size === 1) { orbit.az -= dx * 0.4; orbit.el = Math.max(3, Math.min(89.5, orbit.el + dy * 0.4)); }
      else if (ukazatele.size === 2) { const [a, b] = [...ukazatele.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) orbit.vzd = Math.max(50, orbit.vzd * pinch0 / d); pinch0 = d; }
      spinave = true;
    });
    const konec = (e) => { ukazatele.delete(e.pointerId); pinch0 = 0; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', konec); el.addEventListener('pointercancel', konec);
    el.addEventListener('wheel', (e) => { e.preventDefault(); orbit.vzd = Math.max(50, orbit.vzd * Math.exp(e.deltaY * 0.0012)); spinave = true; }, { passive: false });
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    new MutationObserver(() => { spinave = true; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    velikost(); requestAnimationFrame(smycka);
    const api = {
      viditelne: true,
      nastav(noveS, noveSloty) { S = noveS; sloty = noveSloty; postav(); },
      typ(t) { typ = t; postav(); },
      chatoyance(k) { chat = k; uni.uChat.value = k; spinave = true; },
      svetlo(az, el2) { if (az != null) svetloAz = az; if (el2 != null) svetloEl = el2; svetlo(); },
      otacetSvetlo(ano) { otacet = ano == null ? !otacet : ano; return otacet; },
      pohled(jaky) { const P = { iso: [-28, 34], shora: [0, 89.5], bok: [-60, 12] }[jaky] || [-28, 34]; orbit.az = P[0]; orbit.el = P[1]; spinave = true; },
      prekresli() { spinave = true; },
      snimek() { kresli(); return renderer.domElement.toDataURL('image/png'); },
      zrus() { zrusen = true; ro.disconnect(); zlikviduj(); renderer.dispose(); },
      priZmeneSvetla: null,
    };
    return api;
  }
  koren.INT3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
