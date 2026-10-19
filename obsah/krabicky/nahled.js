/* Krabičky – 3D náhled (three.js r128): vlastní orbitální ovládání, průhledné víko,
   rozložený pohled, řez, kóty a měření vzdáleností kliknutím. Osa Z nahoru, jednotky mm. */
/* global THREE */
(function () {
  'use strict';

  function vytvorNahled(kontejner, volby = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: !!volby.zachovat });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.localClippingEnabled = true;
    kontejner.appendChild(renderer.domElement);
    const platno = renderer.domElement;
    platno.style.display = 'block'; platno.style.width = '100%'; platno.style.height = '100%';
    platno.style.touchAction = 'none';
    platno.tabIndex = 0;
    platno.setAttribute('aria-label', '3D náhled krabičky – táhnutím otáčíte, kolečkem nebo dvěma prsty přibližujete');

    const vrstva = document.createElement('div');    // HTML popisky (kóty, měření)
    vrstva.className = 'popisky3d';
    kontejner.appendChild(vrstva);

    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 0.5, 5000);
    kamera.up.set(0, 0, 1);
    scena.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.75));
    const sv1 = new THREE.DirectionalLight(0xffffff, 0.65); sv1.position.set(1, -1.4, 2); scena.add(sv1);
    const sv2 = new THREE.DirectionalLight(0xffffff, 0.3); sv2.position.set(-1.5, 1, 0.6); scena.add(sv2);

    const rezRovina = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const mat = (barva, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: barva, roughness: 0.62, metalness: 0.05, flatShading: true, side: THREE.DoubleSide }, extra));
    const materialy = {
      krabicka: mat(0x4f86d9),
      viko: mat(0xe0a63f),
      deska: mat(0x2e8b57, { transparent: true, opacity: 0.55, depthWrite: false }),
      hrany: new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
      tenke: new THREE.MeshBasicMaterial({ color: 0xff2020 }),
      mereni: new THREE.MeshBasicMaterial({ color: 0xff3d7f, depthTest: false }),
      cara: new THREE.LineBasicMaterial({ color: 0xff3d7f, depthTest: false }),
      kota: new THREE.LineBasicMaterial({ color: 0x888888 }),
    };
    const skupina = new THREE.Group(); scena.add(skupina);
    const dily = {};                      // jmeno → {mesh, hrany}
    let deska = null, tenke = null, kotyG = null;
    const stav = { pruhledne: false, rozlozit: 0, rozlozitCil: 0, rez: null, koty: true, mereni: false, prichytit: false };
    let rozmer = 100, rozmeryKrab = null;
    const ovl = { cil: new THREE.Vector3(0, 0, 15), vzd: 220, azimut: -0.6, elevace: 0.55 };

    /* ---------- vykreslování na vyžádání ---------- */
    let ceka = false;
    function prekresli() {
      if (ceka) return; ceka = true;
      requestAnimationFrame(() => { ceka = false; snimek(); });
    }
    function snimek() {
      // animace rozložení
      if (Math.abs(stav.rozlozit - stav.rozlozitCil) > 0.002) {
        stav.rozlozit += (stav.rozlozitCil - stav.rozlozit) * 0.22;
        prekresli();
      } else stav.rozlozit = stav.rozlozitCil;
      if (dily.viko) {
        const z = stav.rozlozit * (rozmeryKrab ? rozmeryKrab.Hb * 0.7 + 15 : 30);
        dily.viko.mesh.position.z = z; dily.viko.hrany.position.z = z;
      }
      if (deska) deska.position.z = stav.rozlozit * (rozmeryKrab ? rozmeryKrab.Hb * 0.25 : 8);
      const ce = Math.cos(ovl.elevace);
      kamera.position.set(ovl.cil.x + ovl.vzd * ce * Math.cos(ovl.azimut), ovl.cil.y + ovl.vzd * ce * Math.sin(ovl.azimut), ovl.cil.z + ovl.vzd * Math.sin(ovl.elevace));
      kamera.lookAt(ovl.cil);
      kamera.near = Math.max(0.1, ovl.vzd / 200); kamera.far = ovl.vzd * 20 + rozmer * 10; kamera.updateProjectionMatrix();
      renderer.render(scena, kamera);
      popisky();
    }

    /* ---------- velikost ---------- */
    function velikost() {
      const w = Math.max(50, kontejner.clientWidth), h = Math.max(50, kontejner.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
      renderer.setSize(w, h, false);
      kamera.aspect = w / h; kamera.updateProjectionMatrix();
      prekresli();
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(velikost).observe(kontejner);
    window.addEventListener('resize', velikost);

    /* ---------- barvy podle tématu ---------- */
    function tema() {
      const cs = getComputedStyle(document.documentElement);
      const bg = (cs.getPropertyValue('--bg-input') || '#1e1e1e').trim();
      renderer.setClearColor(new THREE.Color(bg));
      const svetle = document.documentElement.getAttribute('data-theme') === 'light';
      materialy.hrany.color.set(svetle ? 0x000000 : 0x000000); materialy.hrany.opacity = svetle ? 0.4 : 0.55;
      materialy.kota.color.set(svetle ? 0x555555 : 0xaaaaaa);
      prekresli();
    }
    new MutationObserver(tema).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    tema();

    /* ---------- obsah scény ---------- */
    function geometrie(sit) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(sit.poz, 3));
      g.setIndex(new THREE.BufferAttribute(sit.idx, 1));
      g.computeBoundingSphere();
      return g;
    }
    function nastavDily(seznam, odv, p) {
      const prvni = !rozmeryKrab;
      rozmeryKrab = odv;
      for (const k of Object.keys(dily)) {
        skupina.remove(dily[k].mesh); skupina.remove(dily[k].hrany);
        dily[k].mesh.geometry.dispose(); dily[k].hrany.geometry.dispose(); delete dily[k];
      }
      for (const d of seznam) {
        const g = geometrie(d);
        const mesh = new THREE.Mesh(g, materialy[d.jmeno] || materialy.krabicka);
        mesh.userData.jmeno = d.jmeno;
        const hrany = new THREE.LineSegments(new THREE.EdgesGeometry(g, 28), materialy.hrany);
        skupina.add(mesh); skupina.add(hrany);
        dily[d.jmeno] = { mesh, hrany };
      }
      // deska plošných spojů jen jako pomůcka náhledu (neexportuje se)
      if (deska) { skupina.remove(deska); deska.geometry.dispose(); deska = null; }
      if (p && p.deska.pouzit) {
        const d = p.deska;
        deska = new THREE.Mesh(new THREE.BoxGeometry(d.delka, d.sirka, d.tloustka), materialy.deska);
        deska.position.set(0, 0, 0);
        deska.geometry.translate(odv.pcb0[0] + d.delka / 2, odv.pcb0[1] + d.sirka / 2, odv.pcb0[2] + d.tloustka / 2);
        deska.userData.jmeno = 'deska';
        deska.visible = stav.deska !== false;
        skupina.add(deska);
      }
      oznacTenke(null);
      rozmer = Math.max(odv.celkem[0], odv.celkem[1], odv.celkem[2]);
      if (prvni) pohled('izo');
      materialyPruhlednost();
      postavKoty();
      prepocitejMereni();
      prekresli();
    }
    function materialyPruhlednost() {
      const v = materialy.viko;
      v.transparent = stav.pruhledne; v.opacity = stav.pruhledne ? 0.28 : 1; v.depthWrite = !stav.pruhledne; v.needsUpdate = true;
      if (dily.viko) dily.viko.hrany.visible = !stav.pruhledne;
      const roviny = stav.rez === null ? [] : [rezRovina];
      for (const m of [materialy.krabicka, materialy.viko, materialy.deska, materialy.hrany, materialy.tenke]) { m.clippingPlanes = roviny; m.needsUpdate = true; }
      prekresli();
    }

    /* ---------- kóty ---------- */
    function postavKoty() {
      if (kotyG) { skupina.remove(kotyG); kotyG.traverse(o => o.geometry && o.geometry.dispose()); kotyG = null; }
      vrstva.querySelectorAll('.kota').forEach(e => e.remove());
      kotyPopisky.length = 0;
      if (!stav.koty || !rozmeryKrab) return;
      const o = rozmeryKrab, H = o.Hb + o.Hv, odst = Math.max(6, rozmer * 0.08);
      const x0 = -o.celkem[0] / 2, x1 = o.celkem[0] / 2, y0 = -o.Wo / 2, y1 = o.Wo / 2;
      kotyG = new THREE.Group();
      const cara = (body) => {
        const g = new THREE.BufferGeometry().setFromPoints(body.map(b => new THREE.Vector3(...b)));
        kotyG.add(new THREE.LineSegments(g, materialy.kota));
      };
      const t = odst * 0.25;
      // délka (X) před krabičkou
      cara([[x0, y0, 0], [x0, y0 - odst - t, 0], [x1, y0, 0], [x1, y0 - odst - t, 0], [x0, y0 - odst, 0], [x1, y0 - odst, 0]]);
      kotyPopisky.push({ bod: new THREE.Vector3(0, y0 - odst, 0), text: fmt(o.celkem[0]) + ' mm' });
      // šířka (Y) vpravo
      cara([[x1, y0, 0], [x1 + odst + t, y0, 0], [x1, y1, 0], [x1 + odst + t, y1, 0], [x1 + odst, y0, 0], [x1 + odst, y1, 0]]);
      kotyPopisky.push({ bod: new THREE.Vector3(x1 + odst, 0, 0), text: fmt(o.Wo) + ' mm' });
      // výška (Z) vlevo od levého předního rohu
      const xl = -o.Lo / 2;
      cara([[xl, y0, 0], [xl - odst - t, y0, 0], [xl, y0, H], [xl - odst - t, y0, H], [xl - odst, y0, 0], [xl - odst, y0, H]]);
      kotyPopisky.push({ bod: new THREE.Vector3(xl - odst, y0, H / 2), text: fmt(H) + ' mm' });
      skupina.add(kotyG);
      for (const k of kotyPopisky) { k.el = document.createElement('div'); k.el.className = 'kota'; k.el.textContent = k.text; vrstva.appendChild(k.el); }
    }
    const kotyPopisky = [];
    const fmt = x => (Math.round(x * 100) / 100).toString().replace('.', ',');

    /* ---------- měření ---------- */
    const mereni = { body: [], znacky: [], cara: null, el: null };
    function koule() {
      const r = Math.max(0.4, rozmer * 0.006);
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), materialy.mereni);
      m.renderOrder = 10; return m;
    }
    function smazMereni() {
      for (const z of mereni.znacky) { scena.remove(z); z.geometry.dispose(); }
      if (mereni.cara) { scena.remove(mereni.cara); mereni.cara.geometry.dispose(); }
      if (mereni.el) mereni.el.remove();
      mereni.body = []; mereni.znacky = []; mereni.cara = null; mereni.el = null;
      if (volby.priMereni) volby.priMereni(null);
      prekresli();
    }
    function pridejBod(b) {
      if (mereni.body.length >= 2) smazMereni();
      mereni.body.push(b.clone());
      const z = koule(); z.position.copy(b); scena.add(z); mereni.znacky.push(z);
      prepocitejMereni();
    }
    function prepocitejMereni() {
      if (mereni.cara) { scena.remove(mereni.cara); mereni.cara.geometry.dispose(); mereni.cara = null; }
      if (mereni.el) { mereni.el.remove(); mereni.el = null; }
      if (mereni.body.length === 2) {
        const [a, b] = mereni.body;
        mereni.cara = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), materialy.cara);
        mereni.cara.renderOrder = 10; scena.add(mereni.cara);
        const d = a.distanceTo(b);
        mereni.el = document.createElement('div'); mereni.el.className = 'kota mer';
        mereni.el.textContent = fmt(d) + ' mm';
        vrstva.appendChild(mereni.el);
        if (volby.priMereni) volby.priMereni({ d, dx: Math.abs(b.x - a.x), dy: Math.abs(b.y - a.y), dz: Math.abs(b.z - a.z), a, b });
      } else if (volby.priMereni) volby.priMereni(mereni.body.length ? { jen: mereni.body[0] } : null);
      prekresli();
    }

    /* ---------- tenká místa ---------- */
    function oznacTenke(body) {
      if (tenke) { skupina.remove(tenke); tenke.geometry.dispose(); tenke = null; }
      if (body && body.length) {
        const r = Math.max(0.35, rozmer * 0.005);
        const g = new THREE.SphereGeometry(r, 8, 6);
        tenke = new THREE.InstancedMesh(g, materialy.tenke, body.length);
        const m = new THREE.Matrix4();
        body.forEach((b, i) => { m.makeTranslation(b[0], b[1], b[2] + (b.dil === 'viko' && dily.viko ? dily.viko.mesh.position.z : 0)); tenke.setMatrixAt(i, m); });
        skupina.add(tenke);
      }
      prekresli();
    }

    /* ---------- popisky (promítnutí do 2D) ---------- */
    const v3 = new THREE.Vector3();
    function umisti(el, bod) {
      v3.copy(bod).project(kamera);
      const w = kontejner.clientWidth, h = kontejner.clientHeight;
      const vidi = v3.z < 1 && v3.z > -1;
      el.style.display = vidi ? '' : 'none';
      el.style.transform = `translate(-50%, -50%) translate(${(v3.x + 1) / 2 * w}px, ${(1 - v3.y) / 2 * h}px)`;
    }
    function popisky() {
      for (const k of kotyPopisky) if (k.el) umisti(k.el, k.bod);
      if (mereni.el && mereni.body.length === 2) umisti(mereni.el, mereni.body[0].clone().add(mereni.body[1]).multiplyScalar(0.5));
    }

    /* ---------- pohledy ---------- */
    function pohled(druh) {
      const o = rozmeryKrab;
      const H = o ? o.Hb + o.Hv : 30;
      ovl.cil.set(0, 0, H / 2);
      // vzdálenost tak, aby se model vešel i do úzkého (na výšku) okna
      const pul = Math.tan(kamera.fov * Math.PI / 360);
      ovl.vzd = (rozmer * 0.55) / (pul * Math.min(1, kamera.aspect)) + rozmer * 0.5;
      const smery = { izo: [-0.95, 0.5], shora: [-Math.PI / 2, Math.PI / 2 - 0.001], zepredu: [-Math.PI / 2, 0.02], zboku: [0, 0.02], zdola: [-Math.PI / 2, -Math.PI / 2 + 0.001] };
      const [az, el] = smery[druh] || smery.izo;
      ovl.azimut = az; ovl.elevace = el;
      prekresli();
    }

    /* ---------- ovládání myší a dotykem ---------- */
    const ukazatele = new Map();
    let tah = null, start = null;
    const ray = new THREE.Raycaster();
    function pruseciky(x, y) {
      const r = platno.getBoundingClientRect();
      const ndc = new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, kamera);
      const cile = Object.values(dily).map(d => d.mesh).filter(m => !(m.userData.jmeno === 'viko' && stav.pruhledne));
      if (deska && deska.visible) cile.push(deska);
      let hity = ray.intersectObjects(cile, false);
      if (stav.rez !== null) hity = hity.filter(h => rezRovina.distanceToPoint(h.point) >= -1e-6);
      return hity;
    }
    function kliknuti(x, y, shift) {
      if (!stav.mereni) return;
      const h = pruseciky(x, y)[0];
      if (!h) return;
      let b = h.point.clone();
      if ((shift || stav.prichytit) && h.face) {
        // přichycení k nejbližšímu vrcholu zasaženého trojúhelníku
        const pos = h.object.geometry.attributes.position;
        let nejl = null, dmin = Infinity;
        for (const i of [h.face.a, h.face.b, h.face.c]) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(h.object.matrixWorld);
          const d = v.distanceTo(h.point); if (d < dmin) { dmin = d; nejl = v; }
        }
        b = nejl;
      }
      pridejBod(b);
    }
    platno.addEventListener('contextmenu', e => e.preventDefault());
    platno.addEventListener('pointerdown', e => {
      platno.setPointerCapture(e.pointerId);
      ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
      start = { x: e.clientX, y: e.clientY, t: Date.now(), shift: e.shiftKey };
      tah = (e.button === 2 || e.button === 1 || e.ctrlKey || (e.shiftKey && !stav.mereni)) ? 'posun' : 'otoc';
    });
    platno.addEventListener('pointermove', e => {
      const p = ukazatele.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (ukazatele.size === 2) {
        const [a, b] = [...ukazatele.values()];
        const d0 = Math.hypot(a.x - b.x, a.y - b.y);
        p.x = e.clientX; p.y = e.clientY;
        const d1 = Math.hypot(a.x - b.x, a.y - b.y);
        if (d0 > 0 && d1 > 0) ovl.vzd = Math.min(rozmer * 30, Math.max(rozmer * 0.15, ovl.vzd * d0 / d1));
        posun(dx / 2, dy / 2);
        prekresli(); return;
      }
      p.x = e.clientX; p.y = e.clientY;
      if (tah === 'otoc') {
        ovl.azimut -= dx * 0.008;
        ovl.elevace = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, ovl.elevace + dy * 0.008));
      } else posun(dx, dy);
      prekresli();
    });
    function posun(dx, dy) {
      const k = ovl.vzd * 0.0018 * (480 / Math.max(200, kontejner.clientHeight));
      const vpravo = new THREE.Vector3().setFromMatrixColumn(kamera.matrix, 0);
      const nahoru = new THREE.Vector3().setFromMatrixColumn(kamera.matrix, 1);
      ovl.cil.addScaledVector(vpravo, -dx * k).addScaledVector(nahoru, dy * k);
    }
    const konec = e => {
      if (!ukazatele.has(e.pointerId)) return;
      ukazatele.delete(e.pointerId);
      if (start && ukazatele.size === 0 && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5 && Date.now() - start.t < 600 && e.type === 'pointerup')
        kliknuti(e.clientX, e.clientY, start.shift || e.shiftKey);
      if (ukazatele.size === 0) start = null;
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
      nastavDily, pohled, prekresli, smazMereni, oznacTenke,
      pruhledne(v) { stav.pruhledne = v; materialyPruhlednost(); },
      rozlozit(v) { stav.rozlozitCil = v ? 1 : 0; prekresli(); },
      deska(v) { stav.deska = v; if (deska) deska.visible = v; prekresli(); },
      koty(v) { stav.koty = v; postavKoty(); prekresli(); },
      mereni(v) { stav.mereni = v; platno.style.cursor = v ? 'crosshair' : ''; if (!v) smazMereni(); },
      prichytit(v) { stav.prichytit = v; },
      rez(podil) {
        // podil 0–1 přes šířku krabičky, null = bez řezu; ponechá se část za rovinou (y ≥ řez)
        stav.rez = podil;
        if (podil !== null && rozmeryKrab) rezRovina.constant = -(-rozmeryKrab.Wo / 2 + podil * rozmeryKrab.Wo);
        materialyPruhlednost();
      },
      snimekPNG() { snimek(); return platno.toDataURL('image/png'); },
      stav,
    };
  }

  window.KRAB_NAHLED = { vytvorNahled };
})();
