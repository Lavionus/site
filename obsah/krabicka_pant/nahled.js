/* Krabička s víčkem na pantu – 3D náhled (three.js r128): orbitální ovládání, otevírání víka a chlopní
   kolem os pantů, průhledné víko a úchyty, jejichž tažením se mění vnitřní rozměry.
   Osa Z nahoru, jednotky mm. Úchyt X a Y mění rozměr symetricky (posun × 2), úchyt Z výšku. */
/* global THREE */
(function () {
  'use strict';
  const fmt = x => (Math.round(x * 10) / 10).toString().replace('.', ',');

  function vytvorNahled(kontejner, volby = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!volby.zachovat });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.localClippingEnabled = true;
    kontejner.appendChild(renderer.domElement);
    const platno = renderer.domElement;
    platno.style.display = 'block'; platno.style.width = '100%'; platno.style.height = '100%';
    platno.style.touchAction = 'none';
    platno.tabIndex = 0;
    platno.setAttribute('aria-label', '3D náhled krabičky – táhnutím otáčíte, barevnými úchyty měníte rozměry, kolečkem přibližujete');
    const vrstva = document.createElement('div');
    vrstva.className = 'popisky3d';
    kontejner.appendChild(vrstva);

    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 0.5, 5000);
    kamera.up.set(0, 0, 1);
    scena.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.75));
    const sv1 = new THREE.DirectionalLight(0xffffff, 0.65); sv1.position.set(1, -1.4, 2); scena.add(sv1);
    const sv2 = new THREE.DirectionalLight(0xffffff, 0.3); sv2.position.set(-1.5, 1, 0.6); scena.add(sv2);

    const mat = (barva, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: barva, roughness: 0.62, metalness: 0.05, flatShading: true, side: THREE.DoubleSide }, extra));
    const materialy = {
      krabicka: mat(0x4f86d9), viko: mat(0xe0a63f), chlopen: mat(0x4caf7a), vlozka: mat(0xa77bd6),
      kov: mat(0xb8c0c8, { metalness: 0.8, roughness: 0.3 }), plast: mat(0xd8d8d8),
      hrany: new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }),
    };
    const UCHYTY = {
      x: { barva: 0xe5484d, smer: new THREE.Vector3(1, 0, 0), faktor: 2, nazev: 'Délka' },
      y: { barva: 0x30a46c, smer: new THREE.Vector3(0, -1, 0), faktor: 2, nazev: 'Šířka' },
      z: { barva: 0x3e8ef7, smer: new THREE.Vector3(0, 0, 1), faktor: 1, nazev: 'Výška' },
    };

    const skupina = new THREE.Group(); scena.add(skupina);
    const pivotViko = new THREE.Group(), vnitrekViko = new THREE.Group();
    pivotViko.add(vnitrekViko);
    let pivotyChl = [], stranyChl = [], objekty = [], uchytyG = null, odv = null, rozmer = 100;
    const uchyty = {};
    const stav = { viko: 0, chlopen: 0, pruhledne: false, uchyty: true, rez: null };
    const rovinaRezu = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    const ovl = { cil: new THREE.Vector3(0, 0, 15), vzd: 260, azimut: -0.95, elevace: 0.5 };

    let ceka = false;
    function prekresli() { if (ceka) return; ceka = true; requestAnimationFrame(() => { ceka = false; snimek(); }); }
    function snimek() {
      pivotViko.rotation.x = -stav.viko * Math.PI / 180;
      for (const g of pivotyChl) g.rotation.x = -stav.chlopen * Math.PI / 180;
      const ce = Math.cos(ovl.elevace);
      kamera.position.set(ovl.cil.x + ovl.vzd * ce * Math.cos(ovl.azimut), ovl.cil.y + ovl.vzd * ce * Math.sin(ovl.azimut), ovl.cil.z + ovl.vzd * Math.sin(ovl.elevace));
      kamera.lookAt(ovl.cil);
      kamera.near = Math.max(0.1, ovl.vzd / 200); kamera.far = ovl.vzd * 20 + rozmer * 10; kamera.updateProjectionMatrix();
      renderer.render(scena, kamera);
      popisky();
    }

    function velikost() {
      const w = Math.max(50, kontejner.clientWidth), h = Math.max(50, kontejner.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
      renderer.setSize(w, h, false);
      kamera.aspect = w / h; kamera.updateProjectionMatrix();
      prekresli();
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(velikost).observe(kontejner);
    window.addEventListener('resize', velikost);

    function tema() {
      const bg = (getComputedStyle(document.documentElement).getPropertyValue('--bg-input') || '#1e1e1e').trim();
      renderer.setClearColor(new THREE.Color(bg));
      materialy.hrany.opacity = document.documentElement.getAttribute('data-theme') === 'light' ? 0.4 : 0.55;
      prekresli();
    }
    new MutationObserver(tema).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    tema();

    /* ---------- díly ---------- */
    function geometrie(sit) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(sit.poz, 3));
      g.setIndex(new THREE.BufferAttribute(sit.idx, 1));
      g.computeBoundingSphere();
      return g;
    }
    function pridej(rodic, g, hr, material, x = 0) {
      const m = new THREE.Mesh(g, material), e = new THREE.LineSegments(hr, materialy.hrany);
      m.position.x = e.position.x = x;
      rodic.add(m); rodic.add(e);
      objekty.push(m, e);
      return m;
    }
    function nastavDily(dily, o, texty, kov) {
      const prvni = !odv;
      odv = o;
      for (const ob of objekty) { ob.parent.remove(ob); }
      const geo = new Set(objekty.map(ob => ob.geometry));
      geo.forEach(g => g.dispose());
      objekty = [];
      for (const g of stranyChl) vnitrekViko.remove(g);
      pivotyChl = []; stranyChl = [];
      skupina.remove(pivotViko);

      const { yA, zA } = o.pant, { zF } = o.zap;
      // díl zapínání: skupina otočená na stranu (kolem Z), v ní kloub v místě (x, y) osy
      const naStranu = (um, kloub) => {
        const st = new THREE.Group(); st.rotation.z = um.phi * Math.PI / 180;
        const piv = new THREE.Group(), vn = new THREE.Group();
        piv.position.set(um.x, um.y, zF); vn.position.set(0, 0, -zF);
        piv.add(vn); st.add(piv); vnitrekViko.add(st); stranyChl.push(st);
        if (kloub) pivotyChl.push(piv);
        return vn;
      };
      pivotViko.position.set(0, yA, zA);
      vnitrekViko.position.set(0, -yA, -zA);
      skupina.add(pivotViko);
      const mCep = kov ? materialy.kov : materialy.plast;
      for (const d of dily) {
        const g = geometrie(d), hr = new THREE.EdgesGeometry(g, 28);
        if (d.jmeno === 'krabicka') pridej(skupina, g, hr, materialy.krabicka);
        else if (d.jmeno === 'cepPant') for (const x of d.xs) pridej(skupina, g, hr, mCep, x);
        else if (d.jmeno === 'viko') pridej(vnitrekViko, g, hr, materialy.viko);
        else if (d.jmeno === 'vlozka') pridej(skupina, g, hr, materialy.vlozka);
        else if (d.jmeno === 'cepZap') for (const um of d.umisteni) pridej(naStranu(um, false), g, hr, mCep);
        else if (d.jmeno === 'chlopen') for (const um of d.umisteni) pridej(naStranu(um, true), g, hr, materialy.chlopen);
      }
      rozmer = Math.max(...o.celkem);
      postavUchyty(texty);
      nastavRez();
      pruhlednost();
      if (prvni) pohled('izo');
      prekresli();
    }

    function pruhlednost() {
      for (const k of ['viko', 'chlopen']) {
        const m = materialy[k];
        m.transparent = stav.pruhledne; m.opacity = stav.pruhledne ? 0.3 : 1; m.depthWrite = !stav.pruhledne; m.needsUpdate = true;
      }
      prekresli();
    }

    /* ---------- řez: ponechá se část modelu s x (nebo y) menším než poloha řezu ---------- */
    function nastavRez() {
      const r = stav.rez, roviny = r ? [rovinaRezu] : [];
      if (r && odv) {
        // rozsah posuvníku: celá délka, v Y souměrně až za články pantu
        const i = r.osa === 'y' ? 1 : 0, L = i ? 2 * (odv.pant.yA + 2 * odv.pant.Rk) : odv.celkem[0] + 2;
        rovinaRezu.normal.set(i ? 0 : -1, i ? -1 : 0, 0);
        rovinaRezu.constant = -L / 2 + r.podil * L;
      }
      for (const m of Object.values(materialy)) { m.clippingPlanes = roviny; m.needsUpdate = true; }
      prekresli();
    }

    /* ---------- úchyty rozměrů ---------- */
    function postavUchyty(texty) {
      if (uchytyG) { skupina.remove(uchytyG); uchytyG.traverse(ob => { if (ob.geometry) ob.geometry.dispose(); if (ob.material) ob.material.dispose(); }); }
      vrstva.querySelectorAll('.uchyt-popis').forEach(e => e.remove());
      uchytyG = new THREE.Group(); uchytyG.visible = stav.uchyty;
      const o = odv, off = Math.max(8, rozmer * 0.12), r = Math.max(1.6, rozmer * 0.022);
      // počátek úchytu = bod na povrchu, osa = směr tažení
      const zaklad = {
        x: new THREE.Vector3(o.Lo / 2, 0, o.Hb / 2),
        y: new THREE.Vector3(0, -o.Wo / 2, 0),
        z: new THREE.Vector3(0, 0, o.Hb + o.tv),
      };
      for (const [osa, u] of Object.entries(UCHYTY)) {
        const a = zaklad[osa], b = a.clone().addScaledVector(u.smer, off);
        const m = new THREE.MeshBasicMaterial({ color: u.barva, depthTest: false, transparent: true, opacity: 0.95 });
        const koule = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m);
        koule.position.copy(b); koule.renderOrder = 20; koule.userData.osa = osa;
        const cara = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: u.barva, depthTest: false }));
        cara.renderOrder = 19;
        uchytyG.add(koule, cara);
        const el = document.createElement('div'); el.className = 'kota uchyt-popis';
        el.textContent = texty && texty[osa] ? texty[osa] : u.nazev;
        el.hidden = !stav.uchyty;
        vrstva.appendChild(el);
        uchyty[osa] = { koule, bod: b, smer: u.smer, faktor: u.faktor, el, r };
      }
      skupina.add(uchytyG);
    }

    const v3 = new THREE.Vector3();
    function popisky() {
      const w = kontejner.clientWidth, h = kontejner.clientHeight;
      for (const u of Object.values(uchyty)) {
        if (!u.el) continue;
        v3.copy(u.bod).addScaledVector(u.smer, u.r * 2.2).project(kamera);
        u.el.style.display = v3.z < 1 && v3.z > -1 ? '' : 'none';
        u.el.style.transform = `translate(-50%, -50%) translate(${(v3.x + 1) / 2 * w}px, ${(1 - v3.y) / 2 * h}px)`;
      }
    }

    /* ---------- pohledy ---------- */
    function pohled(druh) {
      const H = odv ? odv.celkem[2] : 30;
      ovl.cil.set(0, 0, H / 2);
      const pul = Math.tan(kamera.fov * Math.PI / 360);
      ovl.vzd = (rozmer * 0.62) / (pul * Math.min(1, kamera.aspect)) + rozmer * 0.5;
      const smery = { izo: [-0.95, 0.5], shora: [-Math.PI / 2, Math.PI / 2 - 0.001], zepredu: [-Math.PI / 2, 0.02], zboku: [0, 0.02], zezadu: [Math.PI / 2, 0.25] };
      [ovl.azimut, ovl.elevace] = smery[druh] || smery.izo;
      prekresli();
    }

    /* ---------- myš a dotyk ---------- */
    const ray = new THREE.Raycaster();
    function paprsek(x, y) {
      const r = platno.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), kamera);
      return ray.ray;
    }
    function zasahUchytu(x, y) {
      if (!stav.uchyty || !uchytyG) return null;
      paprsek(x, y);
      const h = ray.intersectObjects(Object.values(uchyty).map(u => u.koule), false)[0];
      return h ? h.object.userData.osa : null;
    }
    /** Parametr nejbližšího bodu přímky P0 + s·d k paprsku. */
    function naOse(r, P0, d) {
      const w0 = P0.clone().sub(r.origin);
      const b = d.dot(r.direction), c = r.direction.dot(r.direction), dd = d.dot(w0), e = r.direction.dot(w0);
      const jm = d.dot(d) * c - b * b;
      return Math.abs(jm) < 1e-6 ? null : (b * e - c * dd) / jm;
    }

    const ukazatele = new Map();
    let tah = null;
    platno.addEventListener('contextmenu', e => e.preventDefault());
    platno.addEventListener('pointerdown', e => {
      platno.setPointerCapture(e.pointerId);
      ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const osa = ukazatele.size === 1 && e.button === 0 ? zasahUchytu(e.clientX, e.clientY) : null;
      if (osa && volby.hodnoty) {
        const u = uchyty[osa];
        const s0 = naOse(paprsek(e.clientX, e.clientY), u.bod, u.smer);
        if (s0 !== null) { tah = { druh: 'uchyt', osa, s0, h0: volby.hodnoty()[osa], bod: u.bod.clone(), posl: null }; return; }
      }
      tah = { druh: (e.button === 2 || e.button === 1 || e.ctrlKey || e.shiftKey) ? 'posun' : 'otoc' };
    });
    platno.addEventListener('pointermove', e => {
      const p = ukazatele.get(e.pointerId);
      if (!p) { platno.style.cursor = zasahUchytu(e.clientX, e.clientY) ? 'grab' : ''; return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      const d0 = ukazatele.size === 2 ? vzdalenostPrstu() : 0;
      p.x = e.clientX; p.y = e.clientY;
      if (tah && tah.druh === 'uchyt') {
        const u = UCHYTY[tah.osa];
        const s = naOse(paprsek(e.clientX, e.clientY), tah.bod, u.smer);
        if (s === null) return;
        const krok = e.shiftKey ? 0.1 : 1;
        const h = Math.round((tah.h0 + u.faktor * (s - tah.s0)) / krok) * krok;
        platno.style.cursor = 'grabbing';
        if (h !== tah.posl) { tah.posl = h; volby.priTazeni(tah.osa, h, false); }
        return;
      }
      if (ukazatele.size === 2) {
        const d1 = vzdalenostPrstu();
        if (d0 > 0 && d1 > 0) ovl.vzd = Math.min(rozmer * 30, Math.max(rozmer * 0.15, ovl.vzd * d0 / d1));
        posun(dx / 2, dy / 2);
      } else if (tah && tah.druh === 'otoc') {
        ovl.azimut -= dx * 0.008;
        ovl.elevace = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, ovl.elevace + dy * 0.008));
      } else posun(dx, dy);
      prekresli();
    });
    function vzdalenostPrstu() { const [a, b] = [...ukazatele.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
    function posun(dx, dy) {
      const k = ovl.vzd * 0.0018 * (480 / Math.max(200, kontejner.clientHeight));
      const vpravo = new THREE.Vector3().setFromMatrixColumn(kamera.matrix, 0);
      const nahoru = new THREE.Vector3().setFromMatrixColumn(kamera.matrix, 1);
      ovl.cil.addScaledVector(vpravo, -dx * k).addScaledVector(nahoru, dy * k);
    }
    const konec = e => {
      if (!ukazatele.has(e.pointerId)) return;
      ukazatele.delete(e.pointerId);
      if (tah && tah.druh === 'uchyt' && tah.posl !== null) volby.priTazeni(tah.osa, tah.posl, true);
      if (ukazatele.size === 0) { tah = null; platno.style.cursor = ''; }
    };
    platno.addEventListener('pointerup', konec);
    platno.addEventListener('pointercancel', konec);
    platno.addEventListener('wheel', e => {
      e.preventDefault();
      ovl.vzd = Math.min(rozmer * 30, Math.max(rozmer * 0.15, ovl.vzd * Math.exp(e.deltaY * 0.0012)));
      prekresli();
    }, { passive: false });

    velikost();
    return {
      nastavDily, pohled, prekresli,
      uhly(viko, chlopen) { stav.viko = viko; stav.chlopen = chlopen; prekresli(); },
      rez(osa, podil) { stav.rez = osa ? { osa, podil } : null; nastavRez(); },
      pruhledne(v) { stav.pruhledne = v; pruhlednost(); },
      zobrazUchyty(v) { stav.uchyty = v; if (uchytyG) uchytyG.visible = v; for (const u of Object.values(uchyty)) u.el.hidden = !v; prekresli(); },
      tahne: () => !!(tah && tah.druh === 'uchyt'),
      snimekPNG() { snimek(); return platno.toDataURL('image/png'); },
      // pro testy: střed úchytu v pixelech plátna
      poziceUchytu(osa) {
        const u = uchyty[osa]; if (!u) return null;
        snimek();
        v3.copy(u.bod).project(kamera);
        const r = platno.getBoundingClientRect();
        return { x: r.left + (v3.x + 1) / 2 * r.width, y: r.top + (1 - v3.y) / 2 * r.height };
      },
      stav,
    };
  }

  /* ---------- malý prohlížeč dílů (měrka vůlí): podložka, díly v tiskové poloze, popisky ----------
     zobraz([{poz, idx, barva}], [{bod: [x, y, z], text, zvyraznit}]) */
  function vytvorProhlizec(kontejner) {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    kontejner.appendChild(renderer.domElement);
    const platno = renderer.domElement;
    platno.style.display = 'block'; platno.style.width = '100%'; platno.style.height = '100%'; platno.style.touchAction = 'none';
    platno.setAttribute('aria-label', 'Náhled dílů v tiskové poloze – táhnutím otáčíte, kolečkem přibližujete');
    const vrstva = document.createElement('div'); vrstva.className = 'popisky3d'; kontejner.appendChild(vrstva);
    const scena = new THREE.Scene(), kamera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
    kamera.up.set(0, 0, 1);
    scena.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.8));
    const sv = new THREE.DirectionalLight(0xffffff, 0.7); sv.position.set(1, -1.5, 2.5); scena.add(sv);
    const skupina = new THREE.Group(); scena.add(skupina);
    // zepředu a mírně shora – otvory měrky jsou vidět čelně a popisky se nepřekrývají
    const ovl = { cil: new THREE.Vector3(), vzd: 100, azimut: -Math.PI / 2 - 0.25, elevace: 0.42 };
    let popisky = [], rozmer = 50;
    function snimek() {
      const ce = Math.cos(ovl.elevace);
      kamera.position.set(ovl.cil.x + ovl.vzd * ce * Math.cos(ovl.azimut), ovl.cil.y + ovl.vzd * ce * Math.sin(ovl.azimut), ovl.cil.z + ovl.vzd * Math.sin(ovl.elevace));
      kamera.lookAt(ovl.cil); kamera.updateProjectionMatrix();
      renderer.render(scena, kamera);
      const w = kontejner.clientWidth, h = kontejner.clientHeight, v = new THREE.Vector3();
      for (const p of popisky) {
        v.set(...p.bod).project(kamera);
        p.el.style.transform = `translate(-50%, -100%) translate(${(v.x + 1) / 2 * w}px, ${(1 - v.y) / 2 * h - 6}px)`;
      }
    }
    let ceka = false;
    const prekresli = () => { if (ceka) return; ceka = true; requestAnimationFrame(() => { ceka = false; snimek(); }); };
    function velikost() {
      const w = Math.max(50, kontejner.clientWidth), h = Math.max(50, kontejner.clientHeight);
      renderer.setSize(w, h, false); kamera.aspect = w / h; prekresli();
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(velikost).observe(kontejner);
    const bg = () => renderer.setClearColor(new THREE.Color((getComputedStyle(document.documentElement).getPropertyValue('--bg-input') || '#1e1e1e').trim()));
    bg(); new MutationObserver(() => { bg(); prekresli(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const ukaz = new Map();
    platno.addEventListener('pointerdown', e => { platno.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
    platno.addEventListener('pointermove', e => {
      const p = ukaz.get(e.pointerId); if (!p) return;
      ovl.azimut -= (e.clientX - p.x) * 0.008;
      ovl.elevace = Math.max(0.05, Math.min(Math.PI / 2 - 0.01, ovl.elevace + (e.clientY - p.y) * 0.008));
      p.x = e.clientX; p.y = e.clientY; prekresli();
    });
    const pust = e => ukaz.delete(e.pointerId);
    platno.addEventListener('pointerup', pust); platno.addEventListener('pointercancel', pust);
    platno.addEventListener('wheel', e => { e.preventDefault(); ovl.vzd = Math.min(rozmer * 10, Math.max(rozmer * 0.4, ovl.vzd * Math.exp(e.deltaY * 0.0012))); prekresli(); }, { passive: false });

    function zobraz(dily, novePopisky) {
      skupina.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      skupina.clear();
      const box = new THREE.Box3();
      for (const d of dily) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(d.poz, 3)); g.setIndex(new THREE.BufferAttribute(d.idx, 1));
        g.computeBoundingBox(); box.union(g.boundingBox);
        skupina.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: d.barva || 0x4f86d9, roughness: 0.6, flatShading: true, side: THREE.DoubleSide })));
        skupina.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 28), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 })));
      }
      // podložka tiskárny jako mřížka 10 mm pod díly
      const vel = box.getSize(new THREE.Vector3()), stred = box.getCenter(new THREE.Vector3());
      rozmer = Math.max(vel.x, vel.y, vel.z, 10);
      const n = Math.ceil(rozmer * 1.6 / 10) * 2, mriz = new THREE.GridHelper(n * 10 / 2, n / 2, 0x888888, 0x888888);
      mriz.rotation.x = Math.PI / 2; mriz.position.set(stred.x, stred.y, 0);
      mriz.material.transparent = true; mriz.material.opacity = 0.35;
      skupina.add(mriz);
      vrstva.innerHTML = '';
      popisky = (novePopisky || []).map(p => {
        const el = document.createElement('div'); el.className = 'kota' + (p.zvyraznit ? ' zvyraznena' : ''); el.textContent = p.text;
        vrstva.appendChild(el); return { bod: p.bod, el };
      });
      ovl.cil.copy(stred);
      ovl.vzd = rozmer * 0.55 / Math.tan(kamera.fov * Math.PI / 360) / Math.min(1, kamera.aspect || 1) + rozmer * 0.2;
      velikost();
    }
    return { zobraz, prekresli: velikost };
  }

  window.KPANT_NAHLED = { vytvorNahled, vytvorProhlizec, fmt };
})();
