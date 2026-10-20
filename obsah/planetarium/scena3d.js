/* ============================================================
   Planetárium – 3D sestava (three.js r160, globální THREE z obsah/lib/three.0.160.0.min.js)
   Rozměry v mm. Světové souřadnice: ekliptika (X k jarnímu bodu, Y, Z nahoru) → three (x = X, y = Z, z = −Y).
   Rameno je skupina natočená o heliocentrickou délku Země; kola v ní se točí o ψ (vůči rameni).
   Glóbus, Měsíc a kotouč uzlů se umisťují ve světě (nosič osy Země se vůči podstavci nenatáčí).
   Lampa = bodové světlo bez útlumu → den/noc na glóbu, fáze Měsíce, stín Země při zatmění.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;

  function vytvor(obal, volby) {
    volby = volby || {};
    const THREE = koren.THREE, EK = koren.EvolKola, S = koren.PLANSit;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    obal.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(36, 1, 1, 1e5);
    const ambient = new THREE.AmbientLight(0xffffff, 0.06);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x554433, 0.16);
    const lampa = new THREE.PointLight(0xfff1d0, 3.6, 0, 0);
    lampa.castShadow = true; lampa.shadow.mapSize.set(1024, 1024); lampa.shadow.bias = -0.002; lampa.shadow.camera.near = 5;
    scena.add(ambient, hemi, lampa);
    const staticka = new THREE.Group(), rameno = new THREE.Group(), svet = new THREE.Group();
    scena.add(staticka, rameno, svet);
    const v3 = (x, y, z) => new THREE.Vector3(x, z, -y);
    let mech = null, stredY = 60, meritko = 200, tema = null, spinave = true, zrusen = false, viditelne = true;
    const orbit = { az: -28, el: 30, vzdNasob: 1, cil: null };
    const kolaMesh = new Map(), klikaci = [];
    let globus = null, globusOsa = null, globusRot = null, mesic = null, mesicDuch = null, ramMesice = null, tyckaMesice = null, kotouc = null, pastorek = null, klika = null, planety = [];
    let texturaZeme = null, texturaSlib = null;

    function zlikviduj(g) {
      for (const o of g.children.slice()) {
        g.remove(o);
        o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) { const m = Array.isArray(x.material) ? x.material : [x.material]; for (const q of m) { if (q.map && q.map !== texturaZeme) q.map.dispose(); q.dispose(); } } });
      }
    }
    function barvyTematu() {
      const at = document.documentElement.getAttribute('data-theme') || '';
      const tmave = at === 'dark' || (!at && matchMedia('(prefers-color-scheme: dark)').matches);
      return tmave ? { pozadi: 0x111419, text: '#e8e8e8', deska: 0x5a4a35 } : { pozadi: 0x2a3140, text: '#f0f0f0', deska: 0x8a6d47 };
    }
    function nactiTexturu() {
      if (texturaSlib) return texturaSlib;
      texturaSlib = new Promise((ok) => {
        const img = new Image();
        img.onload = () => {
          try {
            const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            texturaZeme = new THREE.CanvasTexture(c); texturaZeme.colorSpace = THREE.SRGBColorSpace; texturaZeme.anisotropy = 4;
            ok(texturaZeme);
          } catch (e) { ok(null); }
        };
        img.onerror = () => ok(null);
        img.src = volby.textura || 'textures/8k_earth_daymap.jpg';
      });
      return texturaSlib;
    }
    function materialKola(vlak, vybrane) {
      const b = { den: 0xc07a3a, zeme: 0x3f7fd0, mesic: 0xb8b8b8, uzly: 0x9b6fd0, pohon: 0x4f9d5a }[vlak] || 0xaaaaaa;
      return new THREE.MeshStandardMaterial({ color: b, metalness: 0.35, roughness: 0.45, emissive: vybrane ? 0x553300 : 0x000000 });
    }
    function geometrieKola(z, otvor, b, m) {
      const g = EK.kolo({ m: m || mech.p.m, z, alfa: mech.p.alfa || 20, b, dOtvor: otvor, tol: 0.06 });
      const body = EK.obrysBody(g, 0.06);
      const tvar = new THREE.Shape(body.map((q) => new THREE.Vector2(q[0], q[1])));
      if (otvor > 0) { const d = new THREE.Path(); d.absarc(0, 0, otvor / 2, 0, Math.PI * 2, true); tvar.holes.push(d); }
      const geo = new THREE.ExtrudeGeometry(tvar, { depth: b, bevelEnabled: false, curveSegments: 6 });
      geo.rotateX(-Math.PI / 2);
      return geo;
    }
    function valec(r, h, mat, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 20), mat); return m; }
    function texturaKalendare(R) {
      const c = document.createElement('canvas'); c.width = c.height = 1024;
      const g = c.getContext('2d'), k = 512 / R;
      g.fillStyle = '#7a5f3c'; g.fillRect(0, 0, 1024, 1024);
      g.translate(512, 512);
      g.strokeStyle = '#f4e6c8'; g.fillStyle = '#f4e6c8'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, (R - 4) * k, 0, 2 * Math.PI); g.stroke();
      g.beginPath(); g.arc(0, 0, (R - 22) * k, 0, 2 * Math.PI); g.stroke();
      const MES = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
      const rok = 2026;
      for (let mi = 0; mi < 12; mi++) for (let d = 1; d <= 31; d++) {
        const dt = new Date(Date.UTC(rok, mi, d)); if (dt.getUTCMonth() !== mi) break;
        const lam = koren.PLAN.idealni(koren.PLAN.jdZData(dt)).zeme * RAD, x = Math.cos(lam), y = -Math.sin(lam);
        const L = d === 1 ? 14 : d % 5 === 0 ? 8 : 4;
        g.lineWidth = d === 1 ? 3 : 1.4;
        g.beginPath(); g.moveTo(x * (R - 4) * k, y * (R - 4) * k); g.lineTo(x * (R - 4 - L) * k, y * (R - 4 - L) * k); g.stroke();
        if (d === 15) {
          g.save(); g.rotate(Math.atan2(y, x) + Math.PI / 2); g.font = `bold ${Math.round(9 * k)}px sans-serif`; g.textAlign = 'center';
          g.fillText(MES[mi], 0, -(R - 32) * k); g.restore();
        }
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    }

    function postav(m) {
      mech = m;
      zlikviduj(staticka); zlikviduj(rameno); zlikviduj(svet);
      kolaMesh.clear(); klikaci.length = 0; planety = [];
      tema = barvyTematu();
      scena.background = new THREE.Color(tema.pozadi);
      const p = m.p, tl = p.tlRamene, D = m.D, Hg = m.Hg;
      const zA0 = -tl - p.mezera - p.b, zDeck = zA0 - p.mezera;
      meritko = D + (p.mesic ? p.mesicR : p.globus);
      stredY = Hg * 0.55;
      // podstavec s kalendářem
      const Rp = D + (p.mesic ? p.mesicR + p.mesicD : p.globus) + 12;
      const deska = new THREE.Mesh(new THREE.CylinderGeometry(Rp, Rp, 6, 96), new THREE.MeshStandardMaterial({ color: tema.deska, roughness: 0.8 }));
      deska.position.y = zDeck - 3; staticka.add(deska);
      // kalendář: kruh v rovině ekliptiky, uv = (x/2R + ½, y/2R + ½) → stejné úhly jako délka Země
      const kal = new THREE.Mesh(new THREE.CircleGeometry(Rp, 96), new THREE.MeshStandardMaterial({ map: texturaKalendare(Rp), roughness: 0.85 }));
      kal.rotation.x = -Math.PI / 2; kal.position.y = zDeck + 0.05; kal.receiveShadow = true; staticka.add(kal);
      // nožky
      for (let i = 0; i < 4; i++) { const a = (i + 0.5) * Math.PI / 2, n = valec(5, 40, new THREE.MeshStandardMaterial({ color: 0x3a2d1e })); n.position.set(Math.cos(a) * Rp * 0.8, zDeck - 26, Math.sin(a) * Rp * 0.8); staticka.add(n); }
      // sloup a lampa
      const kov = new THREE.MeshStandardMaterial({ color: 0xb0b4ba, metalness: 0.7, roughness: 0.35 });
      const sloup = valec(p.dStred / 2, Hg - zDeck, kov); sloup.position.y = (Hg + zDeck) / 2; staticka.add(sloup);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(p.lampa / 2, 40, 24), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      lamp.position.y = Hg; staticka.add(lamp);
      const zare = new THREE.Mesh(new THREE.SphereGeometry(p.lampa / 2 * 1.35, 32, 16), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.18, depthWrite: false }));
      zare.position.y = Hg; staticka.add(zare);
      lampa.position.set(0, Hg, 0); lampa.shadow.camera.far = (D + p.mesicR) * 3;
      // pastorek kliky a klika (pod podstavcem)
      const aK = m.pohon.aK, uK = -Math.PI / 2;
      const kx = aK * Math.cos(uK), ky = aK * Math.sin(uK);
      pastorek = new THREE.Group(); pastorek.position.copy(v3(kx, ky, zA0));
      const pm = new THREE.Mesh(geometrieKola(p.zK, p.dHridel + p.vuleOtvor, p.b), materialKola('pohon')); pastorek.add(pm); staticka.add(pastorek);
      pm.userData = { klika: true }; klikaci.push(pm);
      const hK = valec(p.dHridel / 2, zA0 + p.b - zDeck + 30, kov); hK.position.copy(v3(kx, ky, (zA0 + p.b + zDeck - 30) / 2)); staticka.add(hK);
      klika = new THREE.Group(); klika.position.copy(v3(kx, ky, zDeck - 30));
      const ram = new THREE.Mesh(new THREE.BoxGeometry(34, 4, 6), new THREE.MeshStandardMaterial({ color: 0x8a1f1f, roughness: 0.5 })); ram.position.x = 15; klika.add(ram);
      const knob = valec(4, 16, new THREE.MeshStandardMaterial({ color: 0x222222 })); knob.position.set(30, -9, 0); klika.add(knob);
      ram.userData = knob.userData = { klika: true }; klikaci.push(ram, knob);
      staticka.add(klika);

      // rameno (deska s otvory)
      const R = m.rameno, tvar = new THREE.Shape(R.obrys.map((q) => new THREE.Vector2(q[0], q[1])));
      for (const o of R.otvory) { const d = new THREE.Path(); d.absarc(o.x, o.y, o.otvor, 0, Math.PI * 2, true); tvar.holes.push(d); }
      const gr = new THREE.ExtrudeGeometry(tvar, { depth: tl, bevelEnabled: false, curveSegments: 16 }); gr.rotateX(-Math.PI / 2); gr.translate(0, -tl, 0);
      rameno.add(new THREE.Mesh(gr, new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.7 })));
      // kolo ramene (pod ramenem)
      const kA = new THREE.Mesh(geometrieKola(p.zA, p.dStred + p.vuleOtvor, p.b), materialKola('pohon')); kA.position.y = zA0; rameno.add(kA);
      kA.userData = { klika: true }; klikaci.push(kA);
      // kola na rameni
      for (const g of m.kola) {
        const sk = new THREE.Group(); sk.position.copy(v3(g.x, g.y, g.z0));
        let mesh;
        if (g.remenice) {
          mesh = new THREE.Mesh(new THREE.CylinderGeometry(g.d / 2 + 1.5, g.d / 2 + 1.5, p.b, 40), materialKola(g.vlak)); mesh.position.y = p.b / 2;
        } else mesh = new THREE.Mesh(geometrieKola(g.z, g.otvor, p.b, g.m), materialKola(g.vlak, volby.vybrane === g.poz));
        mesh.userData = { poz: g.poz }; klikaci.push(mesh);
        sk.add(mesh); rameno.add(sk); kolaMesh.set(g.poz, { sk, g, mesh });
      }
      for (const e of m.zabery.filter((z) => z.remen)) {
        // řemínek – dvě tečné úsečky
        const r = e.a.d / 2, pts = [];
        for (const s of [1, -1]) { pts.push(v3(e.a.x, e.a.y + s * r, e.a.z0 + p.b / 2), v3(e.b.x, e.b.y + s * r, e.b.z0 + p.b / 2)); }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        rameno.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x111111 })));
      }
      // čepy a trubky, horní můstek
      for (const h of m.hridele) {
        if (h.id === 'O') continue;
        const kol = m.kola.filter((g) => g.hr === h);
        const top = h.id === 'E' ? m.zRamMesice + 4 : h.shora ? m.zMustek + tl : Math.max(...kol.map((g) => g.z0 + p.b)) + 1.5;
        const spod = h.shora ? Math.min(...kol.map((g) => g.z0)) - 1 : -tl;
        const r = h.id === 'E' ? (h.rVnejsi || 2) : p.dHridel / 2;
        const c = valec(r, top - spod, kov, 16); c.position.copy(v3(h.x, h.y, (top + spod) / 2)); rameno.add(c);
      }
      if (m.mustek) {
        const gm = gr.clone(); gm.translate(0, m.zMustek + tl, 0);
        rameno.add(new THREE.Mesh(gm, new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.7, transparent: true, opacity: 0.45, depthWrite: false })));
      }
      // svět: glóbus (nosič osy se nenatáčí), Měsíc, kotouč uzlů, planety
      const nosic = valec(1.6, Hg - m.zRamMesice, kov, 12); nosic.userData.nosic = true; svet.add(nosic);
      globusOsa = new THREE.Group(); svet.add(globusOsa);
      globusOsa.rotation.order = 'YXZ';
      globusRot = new THREE.Group(); globusOsa.add(globusRot);
      const matZ = new THREE.MeshStandardMaterial({ color: texturaZeme ? 0xffffff : 0x3d78c9, map: texturaZeme, roughness: 0.9, metalness: 0 });
      globus = new THREE.Mesh(new THREE.SphereGeometry(p.globus / 2, 64, 40), matZ);
      globus.castShadow = true; globus.receiveShadow = true; globusRot.add(globus);
      const osa = valec(0.8, p.globus + 16, new THREE.MeshStandardMaterial({ color: 0xb3261e })); globusOsa.add(osa);
      if (!texturaZeme) nactiTexturu().then((t) => { if (t && globus && !zrusen) { globus.material.map = t; globus.material.color.set(0xffffff); globus.material.needsUpdate = true; spinave = true; } });
      if (p.mesic) {
        mesic = new THREE.Mesh(new THREE.SphereGeometry(p.mesicD / 2, 40, 24), new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 1 }));
        mesic.castShadow = true; mesic.receiveShadow = true; svet.add(mesic);
        mesicDuch = new THREE.Mesh(new THREE.SphereGeometry(p.mesicD / 2 * 1.02, 16, 10), new THREE.MeshBasicMaterial({ color: 0x66ff99, wireframe: true, transparent: true, opacity: 0.55 }));
        svet.add(mesicDuch);
        ramMesice = new THREE.Mesh(new THREE.BoxGeometry(p.mesicR + 8, 3, 6), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.4, roughness: 0.5 }));
        svet.add(ramMesice);
        tyckaMesice = valec(1.2, 1, kov, 10); svet.add(tyckaMesice);
        if (p.naklon) {
          const k = S.kotoucUzlu(m), sit = S.sitKrouzku(k.r1, k.r2, k.h, p.sklonMesice);
          const geo = new THREE.BufferGeometry();
          const poz = new Float32Array(sit.pozice.length);
          for (let i = 0; i < sit.pozice.length; i += 3) { poz[i] = sit.pozice[i]; poz[i + 1] = sit.pozice[i + 2]; poz[i + 2] = -sit.pozice[i + 1]; }
          geo.setAttribute('position', new THREE.BufferAttribute(poz, 3)); geo.setIndex(new THREE.BufferAttribute(sit.trojuhelniky, 1)); geo.computeVertexNormals();
          kotouc = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9b6fd0, roughness: 0.6, transparent: true, opacity: 0.5, depthWrite: false }));
          svet.add(kotouc);
        } else kotouc = null;
      } else { mesic = mesicDuch = ramMesice = tyckaMesice = kotouc = null; }
      for (const pl of m.planety) {
        const kul = new THREE.Mesh(new THREE.SphereGeometry(pl.id === 'venuse' ? 6 : 4, 24, 16), new THREE.MeshStandardMaterial({ color: pl.id === 'venuse' ? 0xe8d29a : 0xa89f94, roughness: 0.9 }));
        const tyc = new THREE.Mesh(new THREE.BoxGeometry(pl.r, 2, 3), kov);
        svet.add(kul, tyc); planety.push({ pl, kul, tyc });
      }
      spinave = true;
    }

    function aktualizuj(st, rezim) {
      if (!mech || zrusen) return;
      const p = mech.p, idealni = rezim === 'idealni';
      const data = idealni ? st.idealni : st.model;
      // rameno = poloha Země (stejná v obou režimech)
      rameno.rotation.y = st.thR;
      kolaMesh.forEach(({ sk, g }, poz) => { const i = mech.kola.findIndex((k) => k.poz === poz); sk.rotation.y = st.kola[i]; });
      const otA = st.otacky * TAU0;
      pastorek.rotation.y = -otA * mech.p.zA / mech.p.zK; klika.rotation.y = pastorek.rotation.y;
      const lamE = st.rameno * RAD, Ex = mech.D * Math.cos(lamE), Ey = mech.D * Math.sin(lamE);
      const Hg = mech.Hg;
      globusOsa.position.copy(v3(Ex, Ey, Hg));
      globusOsa.rotation.set(-p.sklon * RAD, 0, 0);
      const gmst = idealni ? st.idealni.gmst : (st.model.gmst != null ? st.model.gmst : st.idealni.gmst0 || 0);
      globusRot.rotation.y = gmst * RAD;
      const nos = svet.children.find((o) => o.userData && o.userData.nosic);
      if (nos) { nos.position.copy(v3(Ex, Ey, (Hg + mech.zRamMesice) / 2 - p.globus / 4)); nos.scale.y = 1; }
      if (mesic) {
        const lm = data.mesic * RAD, uz = (idealni ? st.idealni.uzel : st.model.uzel) * RAD;
        const naklon = p.naklon || idealni, dz = naklon ? p.mesicR * Math.tan(p.sklonMesice * RAD) * Math.sin(lm - uz) : 0;
        const Mx = Ex + p.mesicR * Math.cos(lm), My = Ey + p.mesicR * Math.sin(lm);
        mesic.position.copy(v3(Mx, My, Hg + dz));
        ramMesice.position.copy(v3(Ex + (p.mesicR / 2) * Math.cos(lm), Ey + (p.mesicR / 2) * Math.sin(lm), mech.zRamMesice + 1.5));
        ramMesice.rotation.y = lm;
        const zSp = p.naklon ? mech.zUzly + 2.5 + p.mesicR * Math.tan(p.sklonMesice * RAD) * (1 + Math.sin(lm - uz)) : mech.zRamMesice;
        tyckaMesice.position.copy(v3(Mx, My, (zSp + Hg + dz) / 2)); tyckaMesice.scale.y = Math.max(1, Hg + dz - zSp);
        if (kotouc) { kotouc.position.copy(v3(Ex, Ey, mech.zUzly)); kotouc.rotation.y = (idealni ? st.idealni.uzel : st.model.uzel) * RAD; kotouc.visible = !!p.naklon; }
        const ukazDuch = !idealni && volby.duch !== false;
        mesicDuch.visible = ukazDuch;
        if (ukazDuch) {
          const li = st.idealni.mesic * RAD, ui = st.idealni.uzel * RAD, dzi = p.mesicR * Math.tan(p.sklonMesice * RAD) * Math.sin(li - ui) * (p.naklon ? 1 : 0);
          mesicDuch.position.copy(v3(Ex + p.mesicR * Math.cos(li), Ey + p.mesicR * Math.sin(li), Hg + dzi));
        }
      }
      for (const { pl, kul, tyc } of planety) {
        const s = st.planety.find((q) => q.id === pl.id), a = (idealni ? s.idealni : s.model) * RAD;
        kul.position.copy(v3(pl.r * Math.cos(a), pl.r * Math.sin(a), Hg + (pl.id === 'venuse' ? 3 : -3)));
        tyc.position.copy(v3(pl.r / 2 * Math.cos(a), pl.r / 2 * Math.sin(a), Hg + (pl.id === 'venuse' ? 3 : -3) - 4)); tyc.rotation.y = a;
      }
      spinave = true;
    }
    const TAU0 = Math.PI * 2;

    function vyber(poz) {
      volby.vybrane = poz;
      kolaMesh.forEach(({ mesh, g }) => { if (mesh.material && mesh.material.emissive) mesh.material.emissive.set(g.poz === poz ? 0x664400 : 0x000000); });
      spinave = true;
    }

    /* ---------- kamera ---------- */
    function nastavKameru() {
      const d = meritko * 2.6 * orbit.vzdNasob, az = orbit.az * RAD, el = orbit.el * RAD;
      const c = orbit.cil ? (orbit.cil === 'zeme' && globusOsa ? globusOsa.position.clone() : new THREE.Vector3(0, stredY, 0)) : new THREE.Vector3(0, stredY, 0);
      kamera.position.set(c.x + d * Math.cos(el) * Math.sin(az), c.y + d * Math.sin(el), c.z + d * Math.cos(el) * Math.cos(az));
      kamera.lookAt(c); kamera.near = Math.max(1, d * 0.02); kamera.far = d * 10; kamera.updateProjectionMatrix();
    }
    const ukaz = new Map(); let pinch0 = null, start = null;
    const el = renderer.domElement, ray = new THREE.Raycaster();
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]); start = [e.clientX, e.clientY, ukaz.size]; el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', (e) => {
      if (!ukaz.has(e.pointerId)) return;
      const [x0, y0] = ukaz.get(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 1) { orbit.az -= (e.clientX - x0) * 0.4; orbit.el = Math.max(-20, Math.min(89, orbit.el + (e.clientY - y0) * 0.3)); }
      else if (ukaz.size === 2) { const [a, b] = [...ukaz.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) orbit.vzdNasob = Math.max(0.15, Math.min(4, orbit.vzdNasob * pinch0 / d)); pinch0 = d; }
      spinave = true;
    });
    const pust = (e) => {
      if (start && start[2] === 1 && ukaz.size === 1 && Math.hypot(e.clientX - start[0], e.clientY - start[1]) < 5) {
        const r = el.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), kamera);
        const zas = ray.intersectObjects(klikaci, false)[0];
        if (zas && zas.object.userData.klika && volby.naKliku) volby.naKliku();
        else if (zas && zas.object.userData.poz && volby.naKolo) volby.naKolo(zas.object.userData.poz);
        else if (!zas && volby.naKolo) volby.naKolo(null);
      }
      ukaz.delete(e.pointerId); if (ukaz.size < 2) pinch0 = null; start = null; el.style.cursor = 'grab';
    };
    el.addEventListener('pointerup', pust); el.addEventListener('pointercancel', (e) => { ukaz.delete(e.pointerId); start = null; });
    el.addEventListener('wheel', (e) => { e.preventDefault(); orbit.vzdNasob = Math.max(0.15, Math.min(4, orbit.vzdNasob * Math.exp(e.deltaY * 0.001))); spinave = true; }, { passive: false });

    function velikost() {
      const w = Math.max(10, obal.clientWidth), h = Math.max(10, obal.clientHeight);
      renderer.setPixelRatio(Math.min(2, koren.devicePixelRatio || 1));
      renderer.setSize(w, h, false); kamera.aspect = w / h; spinave = true;
    }
    const ro = new ResizeObserver(velikost); ro.observe(obal);
    const mo = new MutationObserver(() => { if (mech) { const t = barvyTematu(); if (!tema || t.pozadi !== tema.pozadi) { tema = t; scena.background = new THREE.Color(t.pozadi); } } spinave = true; });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const io = new IntersectionObserver((z) => { viditelne = z.some((x) => x.isIntersecting); if (viditelne) spinave = true; }); io.observe(obal);
    velikost();
    function smycka() {
      if (zrusen) return;
      if (viditelne && spinave && !document.hidden) { spinave = false; nastavKameru(); renderer.render(scena, kamera); }
      requestAnimationFrame(smycka);
    }
    requestAnimationFrame(smycka);
    return {
      postav, aktualizuj, vyber, nactiTexturu,
      vychoziPohled() { orbit.az = -28; orbit.el = 30; orbit.vzdNasob = 1; orbit.cil = null; spinave = true; },
      pohled(az, elv, nas, cil) { orbit.az = az; orbit.el = elv; if (nas) orbit.vzdNasob = nas; orbit.cil = cil || null; spinave = true; },
      get stav() { return { sirka: renderer.domElement.width, vyska: renderer.domElement.height, kol: kolaMesh.size, textura: !!texturaZeme }; },
      zrus() { zrusen = true; ro.disconnect(); io.disconnect(); mo.disconnect(); zlikviduj(staticka); zlikviduj(rameno); zlikviduj(svet); renderer.dispose(); el.remove(); }
    };
  }
  koren.PLAN3D = { vytvor };
})(typeof window !== 'undefined' ? window : globalThis);
