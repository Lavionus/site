/* ============================================================
   Segmentové soustružení – 3D náhled (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Režimy: „hrubé kroužky“ (hranoly segmentů) a „po soustružení“ (plochy rotace omezené na úhlový rozsah
   každého kusu – proto je vidět, kde které dřevo je). Dřevo = procedurální textura v prostoru (letokruhy
   kolem osy vláken; osa vláken = podélný směr segmentu, dřeň pod prknem) – na čelech kroužky, na ploše pruhy.
   Řez: rovina přes osu (ořezová rovina + víčka řezu). Animace skládání vrstev odspodu.
   Souřadnice nádoby (x = r·cos φ, y = r·sin φ, z nahoru) → three (x, z, −y). Kreslí se jen po změně a když je vidět.
   ============================================================ */
(function (koren) {
  'use strict';
  const PI = Math.PI, RAD = PI / 180;

  function linearni(hex) {
    const v = parseInt(String(hex).slice(1), 16), f = (c) => Math.pow(c / 255, 2.2);
    return [f((v >> 16) & 255), f((v >> 8) & 255), f(v & 255)];
  }
  function hash(a, b) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }

  /** sběrač trojúhelníků s atributy dřeva */
  function Stavba() {
    const pos = [], nor = [], sv = [], tm = [], osa = [], st = [];
    let A = null;
    return {
      pos,
      nastav(at) { A = at; },
      tri(p1, p2, p3, n1, n2, n3) {
        for (const [p, n] of [[p1, n1], [p2, n2 || n1], [p3, n3 || n1]]) {
          pos.push(p[0], p[2], -p[1]); nor.push(n[0], n[2], -n[1]);
          sv.push(...A.sv); tm.push(...A.tm); osa.push(...A.osa); st.push(...A.st);
        }
      },
      quad(a, b, c, d, na, nb, nc, nd) { this.tri(a, b, c, na, nb, nc); this.tri(a, c, d, na, nc, nd); },
      geometrie(THREE) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('aSv', new THREE.Float32BufferAttribute(sv, 3));
        g.setAttribute('aTm', new THREE.Float32BufferAttribute(tm, 3));
        g.setAttribute('aOsa', new THREE.Float32BufferAttribute(osa, 3));
        g.setAttribute('aSt', new THREE.Float32BufferAttribute(st, 3));
        g.computeBoundingSphere();
        return g;
      },
    };
  }

  /** atributy dřeva kusu (osa vláken a dřeň v souřadnicích nádoby) */
  function atributyKusu(q, K, v, D, i) {
    const b = linearni(D[q.druh].barva), sv = b.map((c) => Math.min(1, c * 1.18 + 0.02)), tm = b.map((c) => c * 0.58);
    const zm = (v.z0 + v.z1) / 2, hs = hash(K.i * 7 + v.s, q.j + (q.typ === 'dyha' ? 50 : 0));
    let osa, st;
    if (q.typ === 'disk') { osa = [1, 0, 0]; st = [0, 40 + 60 * hs, zm - 120 - 80 * hs]; }
    else if (q.typ === 'dyha') { osa = [0, 0, 1]; const r = q.aOut + 60; st = [r * Math.cos(q.th), r * Math.sin(q.th), 0]; }
    else {
      const rm = (q.aIn + q.aOut) / 2 + (hs - 0.5) * (q.aOut - q.aIn) * 2, d = v.h * 2 + 35 + hs * 60;
      osa = [-Math.sin(q.th), Math.cos(q.th), 0];
      st = [rm * Math.cos(q.th), rm * Math.sin(q.th), zm + (hs > 0.5 ? -d : d)];
    }
    // three: (x, z, −y)
    return { sv, tm, osa: [osa[0], osa[2], -osa[1]], st: [st[0], st[2], -st[1]], i };
  }

  /* ---------- hrubé kroužky ---------- */
  function hrubyKus(B, q, z0, z1) {
    if (q.typ === 'disk') {
      const n = 96, R = q.R, Ri = q.Rin;
      for (let k = 0; k < n; k++) {
        const a = 2 * PI * k / n, b = 2 * PI * (k + 1) / n, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        const o1 = [R * ca, R * sa], o2 = [R * cb, R * sb], i1 = [Ri * ca, Ri * sa], i2 = [Ri * cb, Ri * sb];
        B.quad([...o1, z0], [...o2, z0], [...o2, z1], [...o1, z1], [ca, sa, 0], [cb, sb, 0], [cb, sb, 0], [ca, sa, 0]);
        if (Ri > 0) B.quad([...i1, z0], [...i1, z1], [...i2, z1], [...i2, z0], [-ca, -sa, 0], [-ca, -sa, 0], [-cb, -sb, 0], [-cb, -sb, 0]);
        B.quad([...i1, z1], [...o1, z1], [...o2, z1], [...i2, z1], [0, 0, 1]);
        B.quad([...i1, z0], [...i2, z0], [...o2, z0], [...o1, z0], [0, 0, -1]);
      }
      return;
    }
    const c = koren.SEGJ.rohy(q), P = (p, z) => [p[0], p[1], z];
    B.quad(P(c[0], z1), P(c[1], z1), P(c[2], z1), P(c[3], z1), [0, 0, 1]);
    B.quad(P(c[0], z0), P(c[3], z0), P(c[2], z0), P(c[1], z0), [0, 0, -1]);
    for (let k = 0; k < 4; k++) {
      const a = c[k], b = c[(k + 1) % 4], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, n = [dy / l, -dx / l, 0];
      B.quad(P(a, z0), P(b, z0), P(b, z1), P(a, z1), n);
    }
  }

  /* ---------- po soustružení ---------- */
  function hotovyKus(B, q, P, z0, z1) {
    const J = koren.SEGJ;
    const a = Math.max(0, z0), b = Math.min(P.H, z1);
    if (b <= a + 1e-6) return;
    const nz = Math.max(2, Math.ceil((b - a) / 2)), zs = [];
    for (let k = 0; k <= nz; k++) zs.push(a + (b - a) * k / nz);
    const rm = (P.rOut((a + b) / 2) + Math.max(0, P.rIn((a + b) / 2))) / 2;
    const u0 = J.uhly(q, Math.max(rm, 1));
    const m = Math.max(2, Math.ceil((u0[1] - u0[0]) / (3 * RAD)));
    const uhel = (r, k) => { const u = J.uhly(q, Math.max(r, 1e-3)); return u[0] + (u[1] - u[0]) * k / m; };
    const bod = (r, f, z) => [r * Math.cos(f), r * Math.sin(f), z];
    const sklon = (fn, z) => { const e = 0.4, z1_ = Math.min(P.H, z + e), z0_ = Math.max(0, z - e); return (fn(z1_) - fn(z0_)) / (z1_ - z0_ || 1); };
    // vnější plocha
    const plast = (fn, zz, ven) => {
      for (let i = 0; i < zz.length - 1; i++) {
        const za = zz[i], zb = zz[i + 1], ra = fn(za), rb = fn(zb), sa = sklon(fn, za), sb = sklon(fn, zb);
        if (!(ra > 0.01) || !(rb > 0.01)) continue;
        for (let k = 0; k < m; k++) {
          const f1 = uhel(ra, k), f2 = uhel(ra, k + 1), g1 = uhel(rb, k), g2 = uhel(rb, k + 1);
          const n = (f, s) => { const l = Math.hypot(1, s); return ven ? [Math.cos(f) / l, Math.sin(f) / l, -s / l] : [-Math.cos(f) / l, -Math.sin(f) / l, s / l]; };
          B.quad(bod(ra, f1, za), bod(ra, f2, za), bod(rb, g2, zb), bod(rb, g1, zb), n(f1, sa), n(f2, sa), n(g2, sb), n(g1, sb));
        }
      }
    };
    plast(P.rOut, zs, true);
    if (b > P.tb) {
      const zi = [Math.max(a, P.tb)];
      for (const z of zs) if (z > zi[0] + 1e-6) zi.push(z);
      if (zi.length > 1) plast((z) => Math.max(0, P.rIn(z)), zi, false);
    }
    // vodorovné plochy: mezikruží na hranách pásma, vnitřní dno
    const mezikruzi = (z, r1, r2, nahoru) => {
      if (!(r2 > r1 + 0.01)) return;
      const nr = 3;
      for (let i = 0; i < nr; i++) {
        const ra = r1 + (r2 - r1) * i / nr, rb = r1 + (r2 - r1) * (i + 1) / nr;
        for (let k = 0; k < m; k++) {
          const p = [bod(ra, uhel(ra, k), z), bod(ra, uhel(ra, k + 1), z), bod(rb, uhel(rb, k + 1), z), bod(rb, uhel(rb, k), z)];
          B.quad(p[0], p[1], p[2], p[3], [0, 0, nahoru ? 1 : -1]);
        }
      }
    };
    const ri = (z) => (z < P.tb - 1e-9 ? 0 : Math.max(0, P.rIn(z)));
    mezikruzi(a, a < P.tb ? 0 : ri(a), P.rOut(a), false);
    mezikruzi(b, ri(b), P.rOut(b), true);
    if (P.tb > a && P.tb < b) mezikruzi(P.tb, 0, Math.max(0, P.rIn(P.tb)), true);
    // boky bloků otevřeného segmentování
    if (q.typ === 'blok') for (const [hr, zn] of [[q.L, 1], [q.R, -1]]) {
      const nn = [zn * Math.sin(hr.a), -zn * Math.cos(hr.a), 0];
      for (let i = 0; i < zs.length - 1; i++) {
        const za = zs[i], zb = zs[i + 1];
        const pts = (z) => { const r0 = Math.max(ri(z), Math.abs(hr.c) + 0.01), r1 = P.rOut(z); return [0, 1, 2, 3].map((t) => { const r = r0 + (r1 - r0) * t / 3; return bod(r, hr.a + Math.asin(Math.max(-1, Math.min(1, hr.c / r))), z); }); };
        const A = pts(za), C = pts(zb);
        for (let t = 0; t < 3; t++) B.quad(A[t], A[t + 1], C[t + 1], C[t], nn);
      }
    }
  }

  /** interval r na paprsku úhlu ψ, kde paprsek leží v kusu (lineární omezení) */
  function intervalNaPaprsku(q, psi) {
    if (q.typ === 'disk') return [q.Rin, q.R];
    let lo = 0, hi = Infinity;
    const omez = (s, c, vetsi) => {   // r·s ≥ c (vetsi) nebo r·s ≤ c
      if (Math.abs(s) < 1e-12) { if (vetsi ? 0 < c - 1e-12 : 0 > c + 1e-12) hi = -1; return; }
      const r = c / s;
      if ((s > 0) === vetsi) lo = Math.max(lo, r); else hi = Math.min(hi, r);
    };
    omez(Math.sin(psi - q.L.a), q.L.c, true);
    omez(Math.sin(psi - q.R.a), q.R.c, false);
    const cd = Math.cos(psi - q.th);
    omez(cd, q.aIn, true); omez(cd, q.aOut, false);
    return hi > lo ? [lo, hi] : null;
  }

  function vytvor(obal) {
    const THREE = koren.THREE, J = koren.SEGJ;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(32, 1, 1, 1e5);
    scena.add(new THREE.HemisphereLight(0xffffff, 0x6d6152, 0.95));
    const sv = new THREE.DirectionalLight(0xfff4e0, 1.7); scena.add(sv, sv.target);
    const sv2 = new THREE.DirectionalLight(0xdde8ff, 0.5); sv2.position.set(-0.8, 0.3, -0.6); scena.add(sv2);
    const skupina = new THREE.Group(); scena.add(skupina);
    const rovina = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    const orbit = { az: -28, el: 24, vzd: 600, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = true, spinave = true, zrusen = false;
    let nav = null, volby = { rezim: 'hotovy', rez: false }, krouzky = [], anim = null, tAnim = 1;

    function material(orez) {
      const m = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, side: THREE.DoubleSide, clippingPlanes: orez ? [rovina] : [] });
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec3 aSv; attribute vec3 aTm; attribute vec3 aOsa; attribute vec3 aSt;
varying vec3 vDrevo; varying vec3 vSv; varying vec3 vTm; varying vec3 vOsa; varying vec3 vSt;`)
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDrevo = position; vSv = aSv; vTm = aTm; vOsa = aOsa; vSt = aSt;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vDrevo; varying vec3 vSv; varying vec3 vTm; varying vec3 vOsa; varying vec3 vSt;
float hsh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float sum3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 osa = normalize(vOsa); vec3 p = vDrevo - vSt; float al = dot(p, osa); vec3 pr = p - osa * al;
  float r = length(pr);
  r += 2.0 * sum3(vDrevo * 0.012) + 1.1 * sin(al * 0.023) + 0.5 * sum3(vDrevo * 0.06 + vec3(al * 0.02));
  float k = fract(r / 3.2);
  float leto = smoothstep(0.0, 0.2, k) * (1.0 - smoothstep(0.6, 1.0, k));
  vec3 c = mix(vTm, vSv, 0.35 + 0.65 * leto);
  float por = sum3(vec3(pr * 1.6) + osa * al * 0.08);
  c *= 0.9 + 0.13 * por;
  diffuseColor.rgb = c; }`);
      };
      m.customProgramCacheKey = () => 'segdrevo' + (orez ? 'o' : '');
      return m;
    }
    const matPlny = material(false), matOrez = material(true);

    function tmave() {
      const t = document.documentElement.getAttribute('data-theme') || '';
      return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches);
    }
    function zlikviduj() { for (const o of skupina.children.slice()) { skupina.remove(o); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); } krouzky = []; }

    function postav() {
      zlikviduj();
      scena.background = new THREE.Color(tmave() ? 0x1d2228 : 0xe4ebf2);
      if (!nav) return;
      const P = nav.P, D = nav.dreviny, hruby = volby.rezim === 'hruby', rez = !!volby.rez;
      for (const K of nav.krouzky) {
        const B = Stavba(), V = Stavba();
        for (const v of K.vrstvy) for (const q of v.kusy) {
          const at = atributyKusu(q, K, v, D, K.i);
          B.nastav(at);
          if (hruby) hrubyKus(B, q, v.z0, v.z1); else hotovyKus(B, q, P, v.z0, v.z1);
          // víčka řezu v rovině φ = 0 a φ = π
          if (rez) {
            V.nastav(at);
            for (const psi of [0, PI]) {
              const sm = psi ? -1 : 1, bod = (r, z) => [sm * r, 0, z];
              if (hruby) {
                const iv = intervalNaPaprsku(q, psi);
                if (!iv) continue;
                V.quad(bod(iv[0], v.z0), bod(iv[1], v.z0), bod(iv[1], v.z1), bod(iv[0], v.z1), [0, -1, 0]);
              } else {
                const a = Math.max(0, v.z0), b = Math.min(P.H, v.z1);
                if (b <= a) continue;
                const nz = Math.max(2, Math.ceil((b - a) / 2));
                for (let i = 0; i < nz; i++) {
                  const za = a + (b - a) * i / nz, zb = a + (b - a) * (i + 1) / nz;
                  const ri = (z) => (z < P.tb ? 0 : Math.max(0, P.rIn(z)));
                  // patří paprsek ψ na poloměru stěny k tomuto kusu?
                  const rmid = (P.rOut((za + zb) / 2) + ri((za + zb) / 2)) / 2;
                  let uv = J.uhly(q, Math.max(rmid, 1)), f = psi;
                  while (f < uv[0]) f += 2 * PI; while (f - 2 * PI >= uv[0]) f -= 2 * PI;
                  if (!(q.typ === 'disk' || f <= uv[1])) continue;
                  V.quad(bod(ri(za), za), bod(P.rOut(za), za), bod(P.rOut(zb), zb), bod(ri(zb), zb), [0, -1, 0]);
                }
              }
            }
          }
        }
        const g = new THREE.Group();
        if (B.pos.length) g.add(new THREE.Mesh(B.geometrie(THREE), rez ? matOrez : matPlny));
        if (V.pos.length) g.add(new THREE.Mesh(V.geometrie(THREE), matPlny));
        g.userData.z0 = K.z0;
        skupina.add(g); krouzky.push(g);
      }
      const Rm = Math.max(...nav.krouzky.map((K) => K.aOut)), H = P.H;
      stred = new THREE.Vector3(0, H * 0.45, 0);
      orbit.vzd = Math.max(2.2 * Rm, H * 1.25) * 1.9 + 60;
      sv.position.set(Rm * 1.5, H * 2 + Rm, Rm * 1.8); sv.target.position.copy(stred);
      rozloz();
      spinave = true;
    }
    /** poloha kroužků při animaci skládání (t ∈ [0, 1]) */
    function rozloz() {
      const n = krouzky.length, H = nav ? nav.P.H : 100, vys = H * 0.9 + 120;
      krouzky.forEach((g, i) => {
        const z = 0.8 * i / Math.max(1, n - 1), e = Math.max(0, Math.min(1, (tAnim - z) / 0.2)), ee = 1 - Math.pow(1 - e, 3);
        g.visible = tAnim >= 1 || e > 0;
        g.position.y = (1 - ee) * vys;
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
    const mo = new MutationObserver(() => { scena.background = new THREE.Color(tmave() ? 0x1d2228 : 0xe4ebf2); spinave = true; }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    (function smycka(cas) {
      if (zrusen) return;
      if (anim && viditelne) {
        if (anim.t0 == null) anim.t0 = cas;
        tAnim = Math.min(1, (cas - anim.t0) / anim.trvani);
        rozloz();
        if (tAnim >= 1) { const hotovo = anim.hotovo; anim = null; if (hotovo) hotovo(); }
      }
      if (viditelne && spinave && !document.hidden) { spinave = false; nastavKameru(); renderer.render(scena, kamera); }
      requestAnimationFrame(smycka);
    })(0);
    return {
      nastav(n, o) { nav = n; volby = Object.assign(volby, o || {}); postav(); },
      volby(o) { volby = Object.assign(volby, o || {}); postav(); },
      animuj(hotovo) { tAnim = 0; anim = { t0: null, trvani: 900 + 380 * krouzky.length, hotovo }; rozloz(); },
      zastav() { anim = null; tAnim = 1; rozloz(); },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, sirka: renderer.domElement.width, vyska: renderer.domElement.height, krouzku: krouzky.length, trojuhelniku: skupina.children.reduce((s, g) => s + g.children.reduce((a, m) => a + m.geometry.getAttribute('position').count / 3, 0), 0), rezim: volby.rezim, rez: volby.rez, anim: !!anim }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(); matPlny.dispose(); matOrez.dispose(); renderer.dispose(); el.remove(); },
    };
  }
  const API = { vytvor, intervalNaPaprsku, atributyKusu };
  koren.SEG3D = API;
})(typeof window !== 'undefined' ? window : globalThis);
