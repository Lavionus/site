/* ============================================================
   Šablony truhlářských spojů – 3D náhled (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Díly = vytažené mnohoúhelníky z jádra (ExtrudeGeometry), procedurální textura dřeva počítaná
   v prostoru (letokruhy kolem osy vláken – na čele jsou vidět kroužky, na ploše pruhy).
   Rozložení / složení podle S.rozlozeni, průhled, řez rovinou, kreslení na vyžádání.
   Souřadnice: jádro (x, y, z) v mm, z nahoru → three (x, z, −y).
   ============================================================ */
(function (koren) {
  'use strict';

  const DREVO = {
    A: { svetla: [0.86, 0.66, 0.42], tmava: [0.66, 0.45, 0.25] },
    B: { svetla: [0.72, 0.50, 0.30], tmava: [0.50, 0.32, 0.17] },
    C: { svetla: [0.93, 0.82, 0.60], tmava: [0.78, 0.64, 0.42] },
  };
  const VOLBA = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

  function vytvor(obal) {
    const THREE = koren.THREE, J = koren.TSJ, STL = koren.TSSTL;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e5);
    scena.add(new THREE.HemisphereLight(0xffffff, 0x6d6152, 0.9));
    const sv = new THREE.DirectionalLight(0xfff4e0, 1.6); sv.position.set(0.6, 1, 0.8); scena.add(sv);
    const sv2 = new THREE.DirectionalLight(0xdde8ff, 0.5); sv2.position.set(-0.8, 0.3, -0.6); scena.add(sv2);
    const koren3 = new THREE.Group();
    // jádro (x, y, z) → three (x, z, −y): otočení o −90° kolem x
    koren3.rotation.x = -Math.PI / 2;
    scena.add(koren3);
    const orbit = { az: -40, el: 28, vzd: 400, stred: new THREE.Vector3() };
    let S = null, dily = [], t = 0, prehrava = false, pruhled = false, rez = { osa: null, poloha: 0.5 }, spinave = true, zrusen = false, popisky = true;
    const rovina = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

    function barvaPozadi() {
      const dt = document.documentElement.getAttribute('data-theme');
      const tmave = dt === 'dark' || (!dt && matchMedia('(prefers-color-scheme: dark)').matches);
      return tmave ? 0x1d2228 : 0xe7ebef;
    }
    function materialDreva(id, osa, stred, rozsah) {
      const D = DREVO[id] || DREVO.A;
      const m = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0, side: THREE.DoubleSide, clippingPlanes: [], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      m.userData.u = {
        uOsa: { value: new THREE.Vector3(...osa) }, uStred: { value: new THREE.Vector3(...stred) },
        uSvetla: { value: new THREE.Vector3(...D.svetla) }, uTmava: { value: new THREE.Vector3(...D.tmava) }, uRoztec: { value: rozsah },
      };
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, m.userData.u);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDrevo;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDrevo = position;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vDrevo; uniform vec3 uOsa; uniform vec3 uStred; uniform vec3 uSvetla; uniform vec3 uTmava; uniform float uRoztec;
float hsh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float sum3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 p = vDrevo; float al = dot(p, uOsa); vec3 pr = p - uOsa * al - uStred;
  float r = length(pr - uOsa * dot(pr, uOsa));
  r += 2.2 * sum3(vec3(p * 0.012)) + 1.2 * sin(al * 0.021) + 0.6 * sum3(p * 0.05 + vec3(al * 0.02));
  float k = fract(r / uRoztec);
  float leto = smoothstep(0.0, 0.18, k) * (1.0 - smoothstep(0.62, 1.0, k));
  vec3 c = mix(uTmava, uSvetla, 0.4 + 0.6 * leto);
  float por = sum3(vec3(pr.x * 1.7, pr.y * 1.7, pr.z * 1.7) + uOsa * al * 0.08);
  c *= 0.9 + 0.12 * por;
  diffuseColor.rgb = c; }`);
      };
      m.customProgramCacheKey = () => 'drevo';
      return m;
    }
    function geometrieTelesa(T) {
      const tvar = new THREE.Shape(T.poly.map((q) => new THREE.Vector2(q[0], q[1])));
      for (const D of T.diry || []) tvar.holes.push(new THREE.Path(D.map((q) => new THREE.Vector2(q[0], q[1]))));
      const g = new THREE.ExtrudeGeometry(tvar, { depth: T.w1 - T.w0, bevelEnabled: false, curveSegments: 1 });
      g.translate(0, 0, T.w0);
      g.applyMatrix4(new THREE.Matrix4().fromArray(STL.MAT[T.osa]));
      return g;
    }
    /** vyhodí hrany, které leží uvnitř rovné plochy dílu (styk dvou těles téhož dílu) */
    function hranyDilu(eg, d) {
      if (d.telesa.length < 2) return eg;
      const a = eg.getAttribute('position').array, out = [], E = 0.05;
      for (let i = 0; i < a.length; i += 6) {
        const A = [a[i], a[i + 1], a[i + 2]], B = [a[i + 3], a[i + 4], a[i + 5]];
        const dv = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(...dv) || 1, dn = dv.map((x) => x / L);
        const pom = Math.abs(dn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        let e1 = [dn[1] * pom[2] - dn[2] * pom[1], dn[2] * pom[0] - dn[0] * pom[2], dn[0] * pom[1] - dn[1] * pom[0]];
        const l1 = Math.hypot(...e1); e1 = e1.map((x) => x / l1);
        const e2 = [dn[1] * e1[2] - dn[2] * e1[1], dn[2] * e1[0] - dn[0] * e1[2], dn[0] * e1[1] - dn[1] * e1[0]];
        const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
        const q = (s1, s2) => J.bodVDilu(d, [M[0] + (e1[0] * s1 + e2[0] * s2) * E, M[1] + (e1[1] * s1 + e2[1] * s2) * E, M[2] + (e1[2] * s1 + e2[2] * s2) * E]);
        const pp = q(1, 1), pm = q(1, -1), mp = q(-1, 1), mm = q(-1, -1);
        if ((pp === pm && mp === mm) || (pp === mp && pm === mm)) continue;
        out.push(...A, ...B);
      }
      eg.dispose();
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); return g;
    }
    function zlikviduj() {
      for (const d of dily) { koren3.remove(d.g); d.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
      dily = [];
    }
    function stitek(text) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      const g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(64, 64, 46, 0, 2 * Math.PI); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 68);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true }));
      s.renderOrder = 10; return s;
    }

    function nastav(nove) {
      S = nove; zlikviduj();
      const z = S.zona, vel = Math.max(z[1] - z[0], z[3] - z[2], z[5] - z[4]);
      for (const d of S.dily) {
        const g = new THREE.Group();
        const m = J.mezeDilu(d), osa = VOLBA[d.vlakno] || [1, 0, 0];
        // dřeň mimo prkno ve směru nejtenčího rozměru → letokruhy jako oblouky
        const roz = [m[1] - m[0], m[3] - m[2], m[5] - m[4]], ia = 'xyz'.indexOf(d.vlakno);
        let it = -1; for (let i = 0; i < 3; i++) if (i !== ia && (it < 0 || roz[i] < roz[it])) it = i;
        const stred = [(m[0] + m[1]) / 2, (m[2] + m[3]) / 2, (m[4] + m[5]) / 2]; stred[it] -= roz[it] * 4 + 60;
        const mat = materialDreva(d.id, osa, stred, d.kolik || d.lamela ? 1.6 : Math.max(2.4, Math.min(5, roz[it] / 4)));
        const cary = new THREE.LineBasicMaterial({ color: 0x2b1d10, transparent: true, opacity: 0.55, clippingPlanes: [] });
        for (const T of d.telesa) {
          const geo = geometrieTelesa(T);
          const mesh = new THREE.Mesh(geo, mat); g.add(mesh);
          const e = new THREE.LineSegments(hranyDilu(new THREE.EdgesGeometry(geo, 25), d), cary); g.add(e);
        }
        const st = stitek(d.id); st.scale.set(vel * 0.06, vel * 0.06, 1);
        // štítek do středu viditelné části dílu v zóně
        st.position.set(Math.max(z[0], Math.min(z[1], (Math.max(m[0], z[0]) + Math.min(m[1], z[1])) / 2)), (Math.max(m[2], z[2]) + Math.min(m[3], z[3])) / 2, Math.min(m[5], z[5]) + vel * 0.05);
        st.visible = popisky && !(d.kolik || d.lamela);
        g.add(st);
        koren3.add(g);
        dily.push({ d, g, mat, cary, st });
      }
      orbit.stred.set((z[0] + z[1]) / 2, (z[4] + z[5]) / 2, -(z[2] + z[3]) / 2);
      orbit.vzd = vel * 2.6;
      kamera.near = vel / 50; kamera.far = vel * 80; kamera.updateProjectionMatrix();
      nastavPruhled(pruhled); nastavRez(rez.osa, rez.poloha); polohy();
    }
    function polohy() {
      if (!S) return;
      const kroky = Math.max(1, ...S.rozlozeni.map((r) => r.krok + 1));
      for (const x of dily) {
        x.g.position.set(0, 0, 0);
        for (const r of S.rozlozeni) if (r.dil === x.d.id) {
          const f = Math.max(0, Math.min(1, t * kroky - r.krok)), e = f * f * (3 - 2 * f);
          x.g.position.set(r.smer[0] * r.vzdal * e, r.smer[1] * r.vzdal * e, r.smer[2] * r.vzdal * e);
        }
      }
      spinave = true;
    }
    function nastavPruhled(ano) {
      pruhled = ano;
      for (const x of dily) { x.mat.transparent = ano; x.mat.opacity = ano ? 0.38 : 1; x.mat.depthWrite = !ano; x.mat.needsUpdate = true; x.cary.opacity = ano ? 0.9 : 0.55; }
      spinave = true;
    }
    function nastavRez(osa, poloha) {
      rez = { osa, poloha };
      const pl = osa ? [rovina] : [];
      if (osa && S) {
        const z = S.zona, i = 'xyz'.indexOf(osa), a = z[2 * i], b = z[2 * i + 1], c = a + (b - a) * poloha;
        // rovina v souřadnicích jádra → do three přes otočení kořene
        const n = new THREE.Vector3(...VOLBA[osa]).applyEuler(koren3.rotation), bod = new THREE.Vector3(...VOLBA[osa]).multiplyScalar(c).applyEuler(koren3.rotation);
        rovina.setFromNormalAndCoplanarPoint(n.negate(), bod);
      }
      for (const x of dily) { x.mat.clippingPlanes = pl; x.cary.clippingPlanes = pl; x.mat.needsUpdate = true; }
      spinave = true;
    }
    function pohled(jaky) {
      const P = { iso: [-40, 28], predni: [0, 0.01], shora: [0, 89.9], zleva: [-90, 0.01], zezadu: [180, 15] }[jaky] || [-40, 28];
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
      scena.background = new THREE.Color(barvaPozadi());
      renderer.render(scena, kamera);
    }
    let tPosl = 0, smerAnim = 1, pauza = 0;
    function smycka(ts) {
      if (zrusen) return;
      requestAnimationFrame(smycka);
      const dt = Math.min(0.05, (ts - (tPosl || ts)) / 1000); tPosl = ts;
      if (prehrava) {
        if (pauza > 0) pauza -= dt;
        else {
          t += smerAnim * dt / 2.2;
          if (t >= 1) { t = 1; smerAnim = -1; pauza = 0.8; } else if (t <= 0) { t = 0; smerAnim = 1; pauza = 0.8; }
          polohy(); if (api.priZmeneT) api.priZmeneT(t);
        }
      }
      if (spinave && obal.offsetParent !== null) { spinave = false; kresli(); }
    }
    // ovládání myší / dotykem
    const ukazatele = new Map(); let pinch0 = 0;
    renderer.domElement.addEventListener('pointerdown', (e) => { renderer.domElement.setPointerCapture(e.pointerId); ukazatele.set(e.pointerId, [e.clientX, e.clientY]); renderer.domElement.style.cursor = 'grabbing'; });
    renderer.domElement.addEventListener('pointermove', (e) => {
      if (!ukazatele.has(e.pointerId)) return;
      const p = ukazatele.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
      ukazatele.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukazatele.size === 1) { orbit.az -= dx * 0.4; orbit.el = Math.max(-89.9, Math.min(89.9, orbit.el + dy * 0.4)); }
      else if (ukazatele.size === 2) {
        const [a, b] = [...ukazatele.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch0) orbit.vzd = Math.max(20, orbit.vzd * pinch0 / d); pinch0 = d;
      }
      spinave = true;
    });
    const konec = (e) => { ukazatele.delete(e.pointerId); pinch0 = 0; renderer.domElement.style.cursor = 'grab'; };
    renderer.domElement.addEventListener('pointerup', konec); renderer.domElement.addEventListener('pointercancel', konec);
    renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); orbit.vzd = Math.max(20, orbit.vzd * Math.exp(e.deltaY * 0.0012)); spinave = true; }, { passive: false });
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    new MutationObserver(() => { spinave = true; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    velikost(); requestAnimationFrame(smycka);
    const api = {
      nastav, pohled, nastavPruhled, nastavRez,
      nastavT(v) { t = Math.max(0, Math.min(1, v)); polohy(); },
      prehraj(ano) { prehrava = ano == null ? !prehrava : ano; if (prehrava) { smerAnim = t >= 1 ? -1 : 1; pauza = 0; } return prehrava; },
      popisky(ano) { popisky = ano; for (const x of dily) x.st.visible = ano && !(x.d.kolik || x.d.lamela); spinave = true; },
      prekresli() { spinave = true; },
      snimek() { kresli(); return renderer.domElement.toDataURL('image/png'); },
      get t() { return t; }, get prehrava() { return prehrava; },
      zrus() { zrusen = true; ro.disconnect(); zlikviduj(); renderer.dispose(); },
      priZmeneT: null,
    };
    return api;
  }
  koren.TS3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
