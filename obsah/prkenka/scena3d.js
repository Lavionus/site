/* ============================================================
   Prkénka – 3D náhled (three.js r160, globální THREE)
   a) hotové prkénko: horní plocha jako výšková síť (zkosení / zaoblení hran, šťávová drážka),
      textury z 2D kresby (letokruhy), boky, spodek, nožičky, otvor;
   b) krok postupu: kusy jako hranoly s procedurální texturou dřeva (letokruhy kolem dřeně v prostoru),
      animace skupin z polohy před krokem do polohy po kroku.
   Souřadnice jádra (x, y, z nahoru) → three (x, z, −y) otočením kořene.
   ============================================================ */
(function (koren) {
  'use strict';
  const hex3 = (h) => { const v = parseInt(h.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255].map((c) => Math.pow(c, 2.2)); };

  function vytvor(obal) {
    const THREE = koren.THREE, J = koren.PKJ, K = koren.PKK;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e5);
    scena.add(new THREE.HemisphereLight(0xffffff, 0x6d6152, 1.0));
    const sv = new THREE.DirectionalLight(0xfff4e0, 1.7); sv.position.set(0.5, 1, 0.7); scena.add(sv);
    const sv2 = new THREE.DirectionalLight(0xdde8ff, 0.45); sv2.position.set(-0.8, 0.4, -0.6); scena.add(sv2);
    const koren3 = new THREE.Group(); koren3.rotation.x = -Math.PI / 2; scena.add(koren3);
    const orbit = { az: -35, el: 32, vzd: 900, stred: new THREE.Vector3() };
    let rezim = null, V = null, krok = null, skupiny = [], t = 1, prehrava = false, spinave = true, zrusen = false, viditelne = true, verze = 0;

    function barvaPozadi() {
      const dt = document.documentElement.getAttribute('data-theme');
      const tm = dt === 'dark' || (!dt && matchMedia('(prefers-color-scheme: dark)').matches);
      return tm ? 0x1d2228 : 0xe7ebef;
    }
    function zlikviduj() {
      for (const o of [...koren3.children]) { koren3.remove(o); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); const ms = x.material ? (Array.isArray(x.material) ? x.material : [x.material]) : []; for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); } }); }
      skupiny = [];
    }

    /* ---------- materiál dřeva pro hranoly (atributy aOsa, aSt v lokálních souřadnicích) ---------- */
    const matCache = new Map();
    function materialDreva(id, pruhl) {
      const kl = id + (pruhl ? '_p' : '');
      if (matCache.has(kl)) return matCache.get(kl);
      const D = J.DREVINY[id] || J.DREVINY.javor;
      const m = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, side: THREE.DoubleSide, transparent: !!pruhl, opacity: pruhl ? 0.3 : 1, depthWrite: !pruhl, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const u = { uSvetla: { value: new THREE.Vector3(...hex3(D.svetla)) }, uTmava: { value: new THREE.Vector3(...hex3(D.tmava)) }, uRoztec: { value: D.letokruh * 1.6 } };
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aOsa; attribute vec3 aSt; varying vec3 vP; varying vec3 vOsa; varying vec3 vSt;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position; vOsa = aOsa; vSt = aSt;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vP; varying vec3 vOsa; varying vec3 vSt; uniform vec3 uSvetla; uniform vec3 uTmava; uniform float uRoztec;
float hsh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float sum3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 o = normalize(vOsa); vec3 d = vP - vSt; float al = dot(d, o); float r = length(d - o * al);
  r += 0.9 * sum3(vP * 0.03) + 0.5 * sin(al * 0.03);
  float k = fract(r / uRoztec);
  float leto = smoothstep(0.0, 0.2, k) * (1.0 - smoothstep(0.65, 1.0, k));
  vec3 c = mix(uTmava, uSvetla, 0.35 + 0.65 * leto);
  c *= 0.92 + 0.1 * sum3(vec3(d.x * 1.3, d.y * 1.3, d.z * 1.3) + o * al * 0.06);
  diffuseColor.rgb = c; }`);
      };
      m.customProgramCacheKey = () => 'prkenko_drevo';
      matCache.set(kl, m);
      return m;
    }
    /** geometrie skupiny kusů (sloučená, skupiny podle dřeviny) */
    function geometrieKusu(kusy) {
      const podle = new Map();
      for (const k of kusy) { const kl = k.d + (k.odpad ? '_o' : ''); if (!podle.has(kl)) podle.set(kl, []); podle.get(kl).push(k); }
      const pos = [], nor = [], osa = [], st = [], mats = [], g = new THREE.BufferGeometry();
      let start = 0, mi = 0;
      for (const [kl, ks] of podle) {
        for (const k of ks) {
          const [iu, iv] = J.UV[k.osa], io = J.OSA_I[k.osa];
          const P3 = (q, w) => { const p = [0, 0, 0]; p[iu] = q[0]; p[iv] = q[1]; p[io] = w; return p; };
          const nW = [0, 0, 0]; nW[io] = 1;
          const tri = THREE.ShapeUtils.triangulateShape(k.poly.map((q) => new THREE.Vector2(q[0], q[1])), []);
          const push = (p, n) => { pos.push(...p); nor.push(...n); osa.push(...k.v); st.push(...k.st); };
          for (const [a, b, c] of tri) {
            push(P3(k.poly[a], k.w1), nW); push(P3(k.poly[b], k.w1), nW); push(P3(k.poly[c], k.w1), nW);
            const nd = nW.map((x) => -x);
            push(P3(k.poly[a], k.w0), nd); push(P3(k.poly[c], k.w0), nd); push(P3(k.poly[b], k.w0), nd);
          }
          const N = k.poly.length;
          for (let i = 0; i < N; i++) {
            const A = k.poly[i], B = k.poly[(i + 1) % N], e = [B[0] - A[0], B[1] - A[1]], l = Math.hypot(...e) || 1;
            const n2 = [e[1] / l, -e[0] / l], n = [0, 0, 0]; n[iu] = n2[0]; n[iv] = n2[1];
            const a0 = P3(A, k.w0), b0 = P3(B, k.w0), a1 = P3(A, k.w1), b1 = P3(B, k.w1);
            push(a0, n); push(b0, n); push(b1, n); push(a0, n); push(b1, n); push(a1, n);
          }
        }
        const pocet = pos.length / 3 - start;
        g.addGroup(start, pocet, mi++); start += pocet;
        mats.push(materialDreva(kl.replace(/_o$/, ''), kl.endsWith('_o')));
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('aOsa', new THREE.Float32BufferAttribute(osa, 3));
      g.setAttribute('aSt', new THREE.Float32BufferAttribute(st, 3));
      return { g, mats };
    }
    function hrany(geom) { return new THREE.LineSegments(new THREE.EdgesGeometry(geom, 25), new THREE.LineBasicMaterial({ color: 0x2a1d12, transparent: true, opacity: 0.35 })); }

    /* ---------- krok postupu ---------- */
    function postavKrok(v, kr) {
      zlikviduj(); rezim = 'krok'; V = v; krok = kr;
      const A = kr.anim;
      const sady = [];
      if (A && A.typ === 'presun') for (const s of A.skupiny) sady.push({ kusy: s.kusy, R: s.R, t: s.t });
      else sady.push({ kusy: kr.kusy, R: null, t: null });
      if (A && A.typ === 'nahrada') sady.push({ kusy: A.pred, pred: true });
      for (const s of sady) {
        const ob = J.obalka(s.kusy), c0 = [(ob.min[0] + ob.max[0]) / 2, (ob.min[1] + ob.max[1]) / 2, (ob.min[2] + ob.max[2]) / 2];
        const { g, mats } = geometrieKusu(s.kusy);
        g.translate(-c0[0], -c0[1], -c0[2]);
        const mesh = new THREE.Mesh(g, mats);
        const obj = new THREE.Group(); obj.add(mesh);
        if (s.kusy.length < 300) { const h = hrany(g); obj.add(h); }
        // aSt je v lokálních souřadnicích kusu → posunout spolu s geometrií
        const a = g.getAttribute('aSt'); for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) - c0[0], a.getY(i) - c0[1], a.getZ(i) - c0[2]);
        koren3.add(obj);
        let q1 = new THREE.Quaternion(), c1 = c0;
        if (s.R) {
          const R = s.R, m = new THREE.Matrix4().set(R[0][0], R[0][1], R[0][2], 0, R[1][0], R[1][1], R[1][2], 0, R[2][0], R[2][1], R[2][2], 0, 0, 0, 0, 1);
          q1.setFromRotationMatrix(m);
          const rc = J.mv(R, c0); c1 = [rc[0] + s.t[0], rc[1] + s.t[1], rc[2] + s.t[2]];
        }
        const otoc = s.R && Math.abs(q1.w) < 0.9999;
        skupiny.push({ obj, c0, c1, q1, otoc, pred: !!s.pred, lift: Math.min(Math.max(ob.roz[0], ob.roz[1], ob.roz[2]) * 0.3, 120) });
      }
      const vse = kr.kusy.concat(...sady.map((x) => x.kusy)), oz = J.obalka(vse), zv = Math.max(0, ...skupiny.map((x) => (x.otoc ? x.lift : 0)));
      oz.max[2] += zv; oz.roz[2] += zv;
      zamer(oz);
      polohy();
    }
    function polohy() {
      if (rezim !== 'krok') return;
      const nahr = krok.anim && krok.anim.typ === 'nahrada';
      const e = t * t * (3 - 2 * t);
      for (const s of skupiny) {
        if (nahr) { s.obj.visible = s.pred ? t < 0.5 : t >= 0.5; s.obj.position.set(...s.c0); continue; }
        const z = s.otoc ? Math.sin(Math.PI * e) * s.lift : 0;
        s.obj.position.set(s.c0[0] + (s.c1[0] - s.c0[0]) * e, s.c0[1] + (s.c1[1] - s.c0[1]) * e, s.c0[2] + (s.c1[2] - s.c0[2]) * e + z);
        s.obj.quaternion.copy(new THREE.Quaternion().slerp(s.q1, e));
      }
      spinave = true;
    }
    function zamer(ob) {
      const c = [(ob.min[0] + ob.max[0]) / 2, (ob.min[1] + ob.max[1]) / 2, (ob.min[2] + ob.max[2]) / 2];
      orbit.stred.set(c[0], c[2], -c[1]);
      orbit.vzd = Math.max(ob.roz[0], ob.roz[1], ob.roz[2], 100) * 1.75 + 80;
      spinave = true;
    }

    /* ---------- hotové prkénko ---------- */
    function texturaZeSceny(sc, px) {
      return new Promise((ok) => {
        const svg = K.svg(sc, { pozadi: true });
        const k = Math.min(px / sc.w, px / sc.h);
        const c = document.createElement('canvas'); c.width = Math.max(4, Math.round(sc.w * k)); c.height = Math.max(4, Math.round(sc.h * k));
        const img = new Image();
        const url = URL.createObjectURL(new Blob([svg.replace('<svg ', `<svg width="${c.width}" height="${c.height}" preserveAspectRatio="none" `)], { type: 'image/svg+xml' }));
        img.onload = () => { const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; ok(tx); };
        img.onerror = () => { URL.revokeObjectURL(url); ok(null); };
        img.src = url;
      });
    }
    function sdfObdelnik(x, y, cx, cy, hx, hy, r) {
      const qx = Math.abs(x - cx) - (hx - r), qy = Math.abs(y - cy) - (hy - r);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    }
    async function postavHotove(v) {
      const moje = ++verze;
      rezim = 'hotove'; V = v; krok = null;
      const p = v.p, D = v.dokonceni, L = D.L, W = D.W, T = v.rozmer.T;
      const kusy = v.akt;
      const [txTop, txY, txX] = await Promise.all([texturaZeSceny(K.scenaPlochy(kusy, 'z'), 2048), texturaZeSceny(K.scenaPlochy(kusy, 'y'), 1536), texturaZeSceny(K.scenaPlochy(kusy, 'x'), 1536)]);
      if (moje !== verze || zrusen) return;
      zlikviduj();
      const mat = (tx) => new THREE.MeshStandardMaterial({ map: tx, roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
      const mTop = mat(txTop), mY = mat(txY), mX = mat(txX);
      const r = D.rohR, c = p.hranaTyp === 'zadna' ? 0 : Math.min(p.hrana, T / 3), dr = D.drazka;
      const krokS = Math.max(1.2, Math.max(L, W) / 320);
      const nx = Math.ceil(L / krokS), ny = Math.ceil(W / krokS);
      const otv = D.otvor;
      const vyska = (x, y) => {
        const d = -sdfObdelnik(x, y, L / 2, W / 2, L / 2, W / 2, r); // vzdálenost dovnitř
        let z = T;
        if (c > 0 && d < c) z -= p.hranaTyp === 'zkoseni' ? c - Math.max(0, d) : c - Math.sqrt(Math.max(0, c * c - (c - Math.max(0, d)) ** 2));
        if (dr) {
          const e = dr.odstupOsy, dg = Math.abs(sdfObdelnik(x, y, L / 2, W / 2, L / 2 - e, W / 2 - e, dr.r)), b2 = p.drazkaSirka / 2;
          if (dg < b2) z -= p.drazkaHloubka * Math.sqrt(1 - (dg / b2) ** 2);
        }
        return z;
      };
      // výšková síť horní plochy; body mimo obrys se přitáhnou na obrys
      const pos = [], uv = [];
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        let x = L * i / nx, y = W * j / ny;
        const s = sdfObdelnik(x, y, L / 2, W / 2, L / 2, W / 2, r);
        if (s > 0) { const h = 0.01, gx = (sdfObdelnik(x + h, y, L / 2, W / 2, L / 2, W / 2, r) - sdfObdelnik(x - h, y, L / 2, W / 2, L / 2, W / 2, r)) / (2 * h), gy = (sdfObdelnik(x, y + h, L / 2, W / 2, L / 2, W / 2, r) - sdfObdelnik(x, y - h, L / 2, W / 2, L / 2, W / 2, r)) / (2 * h), gl = Math.hypot(gx, gy) || 1; x -= gx / gl * s; y -= gy / gl * s; }
        pos.push(x, y, vyska(x, y)); uv.push(x / L, y / W);
      }
      const idx = [];
      const vOtv = (x, y) => otv && Math.hypot(x - otv.x, y - otv.y) < otv.r;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + 1, cc = a + nx + 1, d = cc + 1;
        const mx = pos[a * 3] / 2 + pos[d * 3] / 2, my = pos[a * 3 + 1] / 2 + pos[d * 3 + 1] / 2;
        if (vOtv(mx, my)) continue;
        idx.push(a, b, d, a, d, cc);
      }
      const gTop = new THREE.BufferGeometry();
      gTop.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gTop.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gTop.setIndex(idx); gTop.computeVertexNormals();
      koren3.add(new THREE.Mesh(gTop, mTop));
      // spodek
      const gBot = gTop.clone(); const pb = gBot.getAttribute('position'); for (let i = 0; i < pb.count; i++) pb.setZ(i, 0); gBot.computeVertexNormals();
      koren3.add(new THREE.Mesh(gBot, mTop));
      // boky
      const obr = J.zaoblenyObdelnik(0, 0, L, W, r, 3), zH = T - c;
      const bok = (vyber, m, osaU, delkaU) => {
        const P = [], U = [];
        for (let i = 0; i < obr.length; i++) {
          const A = obr[i], B = obr[(i + 1) % obr.length], nn = [B[1] - A[1], -(B[0] - A[0])];
          if (!vyber(nn)) continue;
          const u = (q) => q[osaU] / delkaU;
          P.push(A[0], A[1], 0, B[0], B[1], 0, B[0], B[1], zH, A[0], A[1], 0, B[0], B[1], zH, A[0], A[1], zH);
          U.push(u(A), 0, u(B), 0, u(B), zH / T, u(A), 0, u(B), zH / T, u(A), zH / T);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals();
        koren3.add(new THREE.Mesh(g, m));
      };
      bok((n) => Math.abs(n[1]) >= Math.abs(n[0]), mY, 0, L);
      bok((n) => Math.abs(n[1]) < Math.abs(n[0]), mX, 1, W);
      // stěna otvoru
      if (otv) {
        const g = new THREE.CylinderGeometry(otv.r, otv.r, T, 40, 1, true); g.rotateX(Math.PI / 2); g.translate(otv.x, otv.y, T / 2);
        koren3.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xb08a60, roughness: 0.8, side: THREE.DoubleSide })));
      }
      // nožičky
      for (const n of D.nozicky) {
        const g = new THREE.CylinderGeometry(n.r * 0.85, n.r, 8, 28); g.rotateX(Math.PI / 2); g.translate(n.x, n.y, -4);
        koren3.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 })));
      }
      zamer({ min: [0, 0, -8], max: [L, W, T], roz: [L, W, T + 8] });
      spinave = true;
    }

    /* ---------- kamera, smyčka, ovládání ---------- */
    function velikost() {
      const w = Math.max(10, obal.clientWidth), h = Math.max(10, obal.clientHeight);
      renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
      renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); spinave = true;
    }
    function kresli() {
      const az = orbit.az * Math.PI / 180, el = orbit.el * Math.PI / 180;
      kamera.position.set(orbit.stred.x + orbit.vzd * Math.cos(el) * Math.sin(az), orbit.stred.y + orbit.vzd * Math.sin(el), orbit.stred.z + orbit.vzd * Math.cos(el) * Math.cos(az));
      kamera.near = orbit.vzd / 100; kamera.far = orbit.vzd * 20; kamera.updateProjectionMatrix();
      kamera.lookAt(orbit.stred);
      scena.background = new THREE.Color(barvaPozadi());
      renderer.render(scena, kamera);
    }
    let tPosl = 0;
    function smycka(ts) {
      if (zrusen) return;
      requestAnimationFrame(smycka);
      const dt = Math.min(0.05, (ts - (tPosl || ts)) / 1000); tPosl = ts;
      if (prehrava && rezim === 'krok') {
        t += dt / 2.4;
        if (t >= 1) { t = 1; prehrava = false; if (api.priKonci) api.priKonci(); }
        polohy(); if (api.priZmeneT) api.priZmeneT(t);
      }
      if (spinave && viditelne && !document.hidden) { spinave = false; kresli(); }
    }
    const ukaz = new Map(); let pinch0 = 0;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]); el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', (e) => {
      if (!ukaz.has(e.pointerId)) return;
      const q = ukaz.get(e.pointerId), dx = e.clientX - q[0], dy = e.clientY - q[1];
      ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 1) { orbit.az -= dx * 0.4; orbit.el = Math.max(-89, Math.min(89.9, orbit.el + dy * 0.4)); }
      else if (ukaz.size === 2) { const [a, b] = [...ukaz.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) orbit.vzd = Math.max(30, orbit.vzd * pinch0 / d); pinch0 = d; }
      spinave = true;
    });
    const pust = (e) => { ukaz.delete(e.pointerId); pinch0 = 0; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', pust); el.addEventListener('pointercancel', pust);
    el.addEventListener('wheel', (e) => { e.preventDefault(); orbit.vzd = Math.max(30, orbit.vzd * Math.exp(e.deltaY * 0.0012)); spinave = true; }, { passive: false });
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    const mo = new MutationObserver(() => { spinave = true; }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost(); requestAnimationFrame(smycka);

    const api = {
      hotove(v) { prehrava = false; return postavHotove(v); },
      krok(v, kr, tt) { verze++; prehrava = false; t = tt == null ? 1 : tt; postavKrok(v, kr); },
      nastavT(x) { t = Math.max(0, Math.min(1, x)); polohy(); },
      prehraj() { if (rezim !== 'krok') return false; if (t >= 1) t = 0; prehrava = true; return true; },
      zastav() { prehrava = false; },
      pohled(jaky) { const P = { iso: [-35, 32], shora: [0, 89.9], predni: [0, 4], bok: [-90, 4] }[jaky] || [-35, 32]; orbit.az = P[0]; orbit.el = P[1]; spinave = true; },
      prekresli() { spinave = true; },
      snimek() { kresli(); return el.toDataURL('image/png'); },
      get stav() { return { rezim, t, prehrava, objektu: koren3.children.length, sirka: el.width, vyska: el.height, viditelne }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(); for (const m of matCache.values()) m.dispose(); renderer.dispose(); el.remove(); },
      priZmeneT: null, priKonci: null,
    };
    return api;
  }
  koren.PK3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
