/* ============================================================
   Kolíkovací a kapsové přípravky – 3D náhled s animací (three.js r160, globální THREE)
   Postup: přiložit přípravek → vrtat (vrták s kroužkem) → sejmout → protikus → spojit.
   Rám sestavy je z nahoru; kořenová skupina ho otočí do os three (y nahoru).
   Kreslí se jen po změně a když je karta vidět.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;
  const KP = koren.KP;

  function vytvor(obal) {
    const THREE = koren.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 1, 1e6);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 0.9), svetlo = new THREE.DirectionalLight(0xffffff, 1.5);
    scena.add(hemi, svetlo, svetlo.target);
    const koren3 = new THREE.Group(); koren3.rotation.x = -Math.PI / 2; scena.add(koren3);
    const orbit = { az: -35, el: 30, vzd: 600, nasob: 1 };
    let stred = new THREE.Vector3(), viditelne = true, spinave = true, zrusen = false, model = null, t = 0.25;

    const tmave = () => { const a = document.documentElement.getAttribute('data-theme') || ''; return a === 'dark' || (!a && matchMedia('(prefers-color-scheme: dark)').matches); };
    const MAT = {};
    function materialy() {
      for (const k of Object.keys(MAT)) MAT[k].dispose();
      Object.assign(MAT, {
        A: new THREE.MeshStandardMaterial({ color: 0xe2c08a, roughness: 0.85, transparent: true, opacity: 0.82 }),
        B: new THREE.MeshStandardMaterial({ color: 0xc89c62, roughness: 0.85, transparent: true, opacity: 0.82 }),
        dira: new THREE.MeshStandardMaterial({ color: 0x3a2a14, roughness: 1 }),
        jig: new THREE.MeshStandardMaterial({ color: 0x3f9a62, roughness: 0.55, transparent: true, opacity: 1 }),
        kov: new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.3, metalness: 0.8 }),
        krouzek: new THREE.MeshStandardMaterial({ color: 0x3b6fb6, roughness: 0.5 }),
        kolik: new THREE.MeshStandardMaterial({ color: 0xb98345, roughness: 0.8 }),
        znacka: new THREE.MeshBasicMaterial({ color: 0xd03020 }),
      });
    }
    materialy();
    function zlikviduj(g) {
      for (const o of g.children.slice()) { g.remove(o); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); }
    }
    const kvadr = (x0, y0, z0, x1, y1, z1, m) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); const o = new THREE.Mesh(g, m); o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return o; };
    const OSA_Y = new THREE.Vector3(0, 1, 0);
    function valec(a, b, r, m, seg) {
      const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), L = d.length() || 0.01;
      const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg || 24), m);
      o.position.copy(A).add(Bv).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(OSA_Y, d.normalize()); return o;
    }
    function sitNaMesh(s, m) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(s.poz, 3)); g.setIndex(new THREE.BufferAttribute(s.idx, 1));
      const g2 = g.toNonIndexed(); g.dispose(); g2.computeVertexNormals();
      return new THREE.Mesh(g2, m);
    }
    /** vrták: hrot v počátku, tělo podél +z místního rámu; kroužek ve vzdálenosti od řezné hrany */
    function vrtak(d, delka, krouzek, stupen) {
      const g = new THREE.Group();
      const add = (o) => { g.add(o); return o; };
      if (stupen) {
        add(valec([0, 0, 0.6], [0, 0, stupen.delka], stupen.d / 2, MAT.kov));
        add(valec([0, 0, stupen.delka], [0, 0, delka], d / 2, MAT.kov));
      } else add(valec([0, 0, d * 0.3], [0, 0, delka], d / 2, MAT.kov));
      const hrot = new THREE.Mesh(new THREE.ConeGeometry((stupen ? stupen.d : d) / 2, (stupen ? stupen.d : d) * 0.3, 20), MAT.kov);
      hrot.rotation.x = -Math.PI / 2; hrot.position.z = (stupen ? stupen.d : d) * 0.15; add(hrot);
      if (krouzek) add(valec([0, 0, krouzek.od], [0, 0, krouzek.od + krouzek.v], krouzek.D / 2, MAT.krouzek, 32));
      return g;
    }
    const orientuj = (o, smer) => o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...smer).normalize());
    const matice = (M) => { const m = new THREE.Matrix4(); m.set(M.R[0][0], M.R[0][1], M.R[0][2], M.t[0], M.R[1][0], M.R[1][1], M.R[1][2], M.t[1], M.R[2][0], M.R[2][1], M.R[2][2], M.t[2], 0, 0, 0, 1); return m; };
    const lin = (a, b, x) => Math.max(0, Math.min(1, (x - a) / (b - a)));
    const hladko = (x) => x * x * (3 - 2 * x);

    /* ---------------- stavba modelu ---------------- */
    function postav(R, P, site) {
      zlikviduj(koren3);
      scena.background = new THREE.Color(tmave() ? 0x1d2228 : 0xe4ebf2);
      model = { R, akce: [] };
      if (!R) return;
      if (R.rezim === 'kapsa') postavKapsu(R, P, site); else if (R.rezim === 'centr') postavCentr(R, site); else postavSpoj(R, P, site);
      // kamera
      const bb = new THREE.Box3().setFromObject(koren3), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
      stred = c; orbit.vzd = Math.max(sz.x, sz.y, sz.z) * 2.3 + 80;
      svetlo.position.set(c.x + orbit.vzd * 0.5, c.y + orbit.vzd, c.z + orbit.vzd * 0.7); svetlo.target.position.copy(c);
      nastavCas(t);
    }

    function postavSpoj(R, P, site) {
      const S = R.spoj, D = R.rozmery, J = Object.assign({}, KP.vychoziProjekt().pripravek, P.pripravek || {});
      const gA = new THREE.Group(), gB = new THREE.Group();
      const mA = matice(R.sestava.A), mB = matice(R.sestava.B);
      gB.matrixAutoUpdate = false; gB.matrix.copy(mB);
      const vlA = new THREE.Group(); vlA.matrixAutoUpdate = false; vlA.matrix.copy(mA); vlA.add(gA);
      koren3.add(vlA, gB);
      gA.add(kvadr(0, 0, 0, D.A[0], D.A[1], D.A[2], MAT.A));
      gB.add(kvadr(0, 0, 0, D.B[0], D.B[1], D.B[2], MAT.B));
      // díry
      const diry = (g, list) => list.map((q) => { const o = valec(q.p, [q.p[0] + q.n[0] * q.hl, q.p[1] + q.n[1] * q.hl, q.p[2] + q.n[2] * q.hl], q.d / 2 + 0.05, MAT.dira, 20); o.visible = false; g.add(o); return { o, q }; });
      const dA = diry(gA, R.diryA.concat(R.diryAplocha || [])), dB = diry(gB, R.diryB);
      // přípravky
      const jigy = (dil) => {
        const g = new THREE.Group();
        const s = (site || []).filter((x) => x.dil === dil && x.sit);
        if (s.length) for (const x of s) g.add(sitNaMesh(x.sit, MAT.jig));
        else for (const p of R.pripravky.filter((p) => p.dil === dil)) for (const c of p.casti) {
          if (p.druh === 'hrana') g.add(kvadr(c.x0, -p.Hv, -p.stena, c.x1, 0, p.t + p.stena, MAT.jig));
          else g.add(kvadr(c.x0, 0, p.plocha, c.x1, p.y1, p.plocha + p.Hv, MAT.jig));
        }
        return g;
      };
      const jA = jigy('A');
      let jB = jigy('B');
      if (!R.pripravky.some((p) => p.dil === 'B')) jB = jigy('A');   // stejný přípravek i pro B
      gA.add(jA); gB.add(jB);
      const pA = R.pripravky[0], pB = R.pripravky.find((p) => p.dil === 'B') || pA;
      // vrtáky
      const kr = (dil) => R.krouzky.find((k) => k.nazev.startsWith(dil + ':')) || R.krouzky[0];
      const mkV = (d, k) => vrtak(d, (k ? k.vzdalenost : 40) + 50, k ? { od: k.vzdalenost, v: +J.krouzekV || 10, D: Math.max(k.sedlo + 8, (k.opora || 0) + 5, 14) } : null);
      const vA = mkV(R.dA, kr('A')), vB = mkV(R.dB, R.pripravky.some((p) => p.dil === 'B' && p.pruchozi) ? null : (R.krouzky.find((k) => k.nazev.startsWith('B:')) || null));
      gA.add(vA); gB.add(vB);
      let vC = null;
      if (R.diryAplocha && R.diryAplocha.length) { const k = R.krouzky.find((x) => /Forstner/.test(x.nazev)); vC = mkV(R.prvek.d, k); gA.add(vC); }
      // spojovací prvky
      const prvky = new THREE.Group(); gA.add(prvky);
      const Pr = Object.assign({}, KP.PRAVIDLA, P.pravidla || {});
      if (R.rezim === 'kolik') for (const q of R.diryA) {
        const inA = Math.min(R.hA - Pr.vuleDno, R.delka - 1);
        prvky.add(valec([q.p[0], q.p[1] + inA, q.p[2]], [q.p[0], q.p[1] + inA - R.delka, q.p[2]], R.dA / 2 - 0.1, MAT.kolik, 20));
      }
      const sroubyB = new THREE.Group(); gB.add(sroubyB);
      if (R.rezim === 'konfirmat') for (const q of R.diryB) sroubyB.add(valec([q.p[0], q.p[1], -1], [q.p[0], q.p[1], q.p[2] + R.hA - 2], R.dA / 2, MAT.kov, 16), valec([q.p[0], q.p[1], -1.5], [q.p[0], q.p[1], 3], R.prvek.hlava / 2, MAT.kov, 20));
      if (R.rezim === 'excentr') {
        for (const q of R.diryB) sroubyB.add(valec([q.p[0], q.p[1], q.p[2] - R.hB], [q.p[0], q.p[1], q.p[2] + R.prvek.odHrany], R.dB / 2, MAT.kov, 16));
        for (const q of R.diryAplocha) prvky.add(valec([q.p[0], q.p[1], q.p[2]], [q.p[0], q.p[1], q.p[2] - q.hl + 0.5], q.d / 2 - 0.2, MAT.kov, 24));
      }
      // posun dílu A ze sestavy (rozložení) ve směru od spoje
      const rozloz = 70;
      model.akce = (x) => {
        // časová osa
        const fazeA = [0.02, 0.1], vrtA = [0.1, 0.4], pryc = [0.4, 0.46], fazeB = [0.47, 0.55], vrtB = [0.55, 0.76], prycB = [0.76, 0.81], kol = [0.81, 0.88], slozit = [0.88, 0.98];
        const kA = hladko(lin(fazeA[0], fazeA[1], x)) * (1 - hladko(lin(pryc[0], pryc[1], x)));
        jA.visible = kA > 0.01; jA.position.set(0, -(1 - kA) * 60, 0);
        const kB = hladko(lin(fazeB[0], fazeB[1], x)) * (1 - hladko(lin(prycB[0], prycB[1], x)));
        jB.visible = kB > 0.01;
        if (pB.druh === 'deska') jB.position.set(0, 0, (1 - kB) * 60); else jB.position.set(0, -(1 - kB) * 60, 0);
        // vrtání
        const vrtej = (V, list, okno, Hv) => {
          V.visible = false;
          const n = list.length; if (!n) return;
          for (let i = 0; i < n; i++) {
            const a = okno[0] + (okno[1] - okno[0]) * i / n, b = okno[0] + (okno[1] - okno[0]) * (i + 1) / n, f = lin(a, b, x);
            const { o, q } = list[i];
            o.visible = x >= a + (b - a) * 0.5;
            if (f > 0 && f < 1) {
              const hl = Math.sin(Math.PI * f) * (q.hl + Hv + 20) - Hv - 20, tip = [q.p[0] + q.n[0] * hl, q.p[1] + q.n[1] * hl, q.p[2] + q.n[2] * hl];
              V.visible = true; V.position.set(...tip); orientuj(V, [-q.n[0], -q.n[1], -q.n[2]]); V.rotateZ(f * 60);
            }
          }
        };
        const sp = dA.filter((z) => z.q.typ !== 'excentr'), ex = dA.filter((z) => z.q.typ === 'excentr');
        if (ex.length && vC) {
          const m = vrtA[0] + (vrtA[1] - vrtA[0]) * 0.6;
          vrtej(vA, sp, [vrtA[0], m], pA.Hv); vrtej(vC, ex, [m, vrtA[1]], pA.kridlo ? pA.kridlo.tl : 8);
        } else vrtej(vA, sp, vrtA, pA.Hv);
        if (x < vrtA[0]) for (const z of dA) z.o.visible = false;
        vrtej(vB, dB, vrtB, pB.Hv);
        if (x < vrtB[0]) for (const z of dB) z.o.visible = false;
        // kolíky / prvky
        const kk = hladko(lin(kol[0], kol[1], x));
        prvky.visible = R.rezim === 'kolik' ? kk > 0.01 : x >= slozit[1] - 0.01;
        if (R.rezim === 'kolik') prvky.position.set(0, (1 - kk) * -40, 0);
        sroubyB.visible = x >= slozit[1] - 0.01;
        const ks = hladko(lin(slozit[0], slozit[1], x));
        gA.position.set(0, (1 - ks) * rozloz, 0);
      };
    }

    function postavKapsu(R, P, site) {
      const tA = R.tA, tB = R.tB, Wd = R.sirka, LA = Math.max(140, -R.pripravek.xBack + 50);
      const g = new THREE.Group(); koren3.add(g);
      g.add(kvadr(-LA, 0, 0, 0, Wd, tA, MAT.A));
      const gB = new THREE.Group(); g.add(gB);
      if (R.typ === 'rovina') gB.add(kvadr(0, 0, 0, 120, Wd, tB, MAT.B)); else gB.add(kvadr(0, 0, -50, tB, Wd, tA + 50, MAT.B));
      const P3 = (p2, y) => [p2[0], y, p2[1]];
      const kapsy = R.ys.map((y) => {
        const o = new THREE.Group();
        o.add(valec(P3(R.sedlo, y), P3(R.I, y), R.Dk / 2, MAT.dira, 24), valec(P3(R.sedlo, y), P3(R.E, y), R.dp / 2 + 0.05, MAT.dira, 12));
        o.visible = false; g.add(o); return o;
      });
      const jig = new THREE.Group(); g.add(jig);
      const s = (site || []).find((x) => x.druh === 'kapsa');
      if (s) jig.add(sitNaMesh(s.sit, MAT.jig));
      else { const Pj = R.pripravek; jig.add(kvadr(Pj.xBack, -Pj.sirka, tA, Pj.s, 0, tA + 20, MAT.jig)); }
      const k = R.krouzky[0];
      const V = vrtak(R.Dk, k.vzdalenost + R.Ls + 40, { od: R.Ls + k.vzdalenost, v: 10, D: Math.max(k.sedlo + 8, (k.opora || 0) + 5, 14) }, { d: R.dp, delka: R.Ls });
      g.add(V);
      const vruty = new THREE.Group(); g.add(vruty);
      for (const y of R.ys) {
        const hl = [R.sedlo[0] + R.u[0] * R.Lv, R.sedlo[1] + R.u[1] * R.Lv];
        vruty.add(valec(P3(R.sedlo, y), P3(hl, y), 2, MAT.kov, 12), valec(P3([R.sedlo[0] - R.u[0] * 2.5, R.sedlo[1] - R.u[1] * 2.5], y), P3(R.sedlo, y), R.Dk / 2 - 0.6, MAT.kov, 20));
      }
      const g0 = R.pripravek.vedeni[0];
      model.akce = (x) => {
        const n = R.ys.length, okno = [0.12, 0.55];
        // přípravek: příchod, posun mezi kapsami, odchod
        const kIn = hladko(lin(0.02, 0.1, x)) * (1 - hladko(lin(0.56, 0.62, x)));
        let j = Math.min(n - 1, Math.max(0, Math.floor((x - okno[0]) / (okno[1] - okno[0]) * n)));
        jig.visible = kIn > 0.01; jig.position.set(0, R.ys[j] + g0, (1 - kIn) * 50);
        V.visible = false;
        for (let i = 0; i < n; i++) {
          const a = okno[0] + (okno[1] - okno[0]) * i / n, b = okno[0] + (okno[1] - okno[0]) * (i + 1) / n, f = lin(a, b, x);
          kapsy[i].visible = x >= a + (b - a) * 0.5;
          if (f > 0.1 && f < 0.9) {
            const ff = (f - 0.1) / 0.8, hl = Math.sin(Math.PI * ff) * 30 - 30;   // posun podél osy (0 = kroužek na vedení)
            const tip = [R.hrotPilotu[0] + R.u[0] * hl, R.hrotPilotu[1] + R.u[1] * hl];
            V.visible = true; V.position.set(tip[0], R.ys[i], tip[1]); orientuj(V, [R.b[0], 0, R.b[1]]); V.rotateZ(ff * 90);
          }
        }
        if (x < okno[0]) for (const o of kapsy) o.visible = false;
        const kb = hladko(lin(0.62, 0.76, x));
        gB.position.set((1 - kb) * 60, 0, 0);
        const kv = hladko(lin(0.78, 0.96, x));
        vruty.visible = x > 0.78; vruty.position.set(-R.u[0] * (1 - kv) * 25, 0, -R.u[1] * (1 - kv) * 25);
      };
    }

    function postavCentr(R, site) {
      const g = new THREE.Group(); koren3.add(g);
      const n = Math.min(4, R.kusy.length), roz = 40, W = 50 + n * roz;
      g.add(kvadr(0, 0, -18, W, 60, 0, MAT.A));
      const gB = new THREE.Group(); g.add(gB); gB.add(kvadr(0, 0, 0, W, 60, 18, MAT.B));
      const kusy = [], znacky = [];
      R.kusy.slice(0, n).forEach((q, i) => {
        const x = 40 + i * roz, y = 30;
        g.add(valec([x, y, 0.05], [x, y, -14], q.d / 2 + 0.05, MAT.dira, 20));
        const c = new THREE.Group(); c.position.set(x, y, 0); g.add(c);
        c.add(valec([0, 0, -q.delkaCepu], [0, 0, 0], q.rCep, MAT.jig, 24), valec([0, 0, 0], [0, 0, q.tlLimec], q.rLimec, MAT.jig, 24));
        const h = new THREE.Mesh(new THREE.ConeGeometry(q.rHrot, Math.max(q.hrot, q.rHrot), 20), MAT.jig); h.rotation.x = Math.PI / 2; h.position.z = q.tlLimec + Math.max(q.hrot, q.rHrot) / 2; c.add(h);
        kusy.push(c);
        const z = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), MAT.znacka); z.position.set(x, y, -0.05); z.rotation.x = Math.PI; gB.add(z); znacky.push(z);
      });
      model.akce = (x) => {
        const kc = hladko(lin(0.05, 0.3, x));
        kusy.forEach((c) => { c.position.z = (1 - kc) * 40; });
        const dol = hladko(lin(0.35, 0.6, x)), nah = hladko(lin(0.7, 0.95, x));
        const tl = (kusy.length ? 2.2 + Math.max(R.kusy[0].hrot, R.kusy[0].rHrot) : 4);
        gB.position.z = 70 - dol * (70 - tl) + nah * 70;
        znacky.forEach((z) => { z.visible = x > 0.62; });
        kusy.forEach((c) => { c.visible = true; });
      };
      void site;
    }

    function nastavCas(x) { t = Math.max(0, Math.min(1, x)); if (model && typeof model.akce === 'function') model.akce(t); spinave = true; }

    /* ---------------- ovládání kamery ---------------- */
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
    let posledni = null;
    const mo = new MutationObserver(() => { materialy(); if (posledni) postav(...posledni); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    let prehrava = false, t0 = 0, pri = null;
    (function smycka(cas) {
      if (zrusen) return;
      if (prehrava && viditelne && !document.hidden) {
        if (!t0) t0 = cas - t * 9000;
        const x = (cas - t0) / 9000;
        if (x >= 1) { prehrava = false; t0 = 0; nastavCas(1); } else nastavCas(x);
        if (pri) pri(t, prehrava);
      }
      if (viditelne && spinave && !document.hidden) { spinave = false; nastavKameru(); renderer.render(scena, kamera); }
      requestAnimationFrame(smycka);
    })(0);
    return {
      aktualizuj(R, P, site) { posledni = [R, P, site]; postav(R, P, site); },
      cas: nastavCas,
      prehraj(cb) { pri = cb || pri; if (t >= 0.999) nastavCas(0); prehrava = true; t0 = 0; },
      zastav() { prehrava = false; t0 = 0; },
      get t() { return t; }, get hraje() { return prehrava; },
      pohled(az, elv) { orbit.az = az; orbit.el = elv; orbit.nasob = 1; spinave = true; },
      get stav() { return { viditelne, sirka: renderer.domElement.width, vyska: renderer.domElement.height, objektu: koren3.children.length, t, vzd: orbit.vzd, stred: [stred.x, stred.y, stred.z] }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(koren3); renderer.dispose(); el.remove(); },
    };
  }
  koren.KP3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
