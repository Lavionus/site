/* Origami – 3D náhled skládání (three.js r128, globální THREE). Kreslí snímek z jádra:
   plošky jako dvoubarevné polygony, otáčení tažením myší/prstem, kolečko = přiblížení. */
(function () {
  'use strict';
  const J = window.OrigamiJadro;

  function vytvor(kontejner) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    kontejner.appendChild(renderer.domElement);
    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    scena.add(new THREE.AmbientLight(0xffffff, 0.55));
    const svetlo = new THREE.DirectionalLight(0xffffff, 0.6);
    svetlo.position.set(1, 2, 3);
    scena.add(svetlo);
    const skupina = new THREE.Group();
    scena.add(skupina);
    let azimut = 0.5, elevace = 0.75, vzdal = 3.2, stred = new THREE.Vector3();

    function umistiKameru() {
      kamera.position.set(stred.x + vzdal * Math.cos(elevace) * Math.sin(azimut), stred.y - vzdal * Math.cos(elevace) * Math.cos(azimut), stred.z + vzdal * Math.sin(elevace));
      kamera.up.set(0, 0, 1);
      kamera.lookAt(stred);
    }
    function velikost() {
      const w = kontejner.clientWidth || 300, h = kontejner.clientHeight || 300;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
      kamera.aspect = w / h; kamera.updateProjectionMatrix();
    }
    const material = {};
    const mat = (barva, strana) => material[barva + strana] || (material[barva + strana] = new THREE.MeshLambertMaterial({ color: barva, side: strana, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    const matCara = new THREE.LineBasicMaterial({ color: 0x222222 });

    function zobraz(stav, polys, barvy) {
      for (const o of skupina.children.slice()) { skupina.remove(o); o.geometry.dispose(); }
      for (const p of polys) {
        if (p.pruhl !== undefined && p.pruhl < 0.5) continue;
        const v = p.b.map(q => new THREE.Vector3(q[0], -q[1], q[2]));
        const poz = [];
        for (let i = 1; i < v.length - 1; i++) poz.push(v[0].x, v[0].y, v[0].z, v[i].x, v[i].y, v[i].z, v[i + 1].x, v[i + 1].y, v[i + 1].z);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
        g.computeVertexNormals();
        const n = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0]));
        const vid = barvaPolygonu(stav, p, barvy, true), jina = barvaPolygonu(stav, p, barvy, false);
        const [predni, zadni] = n.z >= 0 ? [vid, jina] : [jina, vid];
        skupina.add(new THREE.Mesh(g, mat(predni, THREE.FrontSide)));
        skupina.add(new THREE.Mesh(g.clone(), mat(zadni, THREE.BackSide)));
        const hr = [];
        for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; hr.push(a.x, a.y, a.z, b.x, b.y, b.z); }
        const gl = new THREE.BufferGeometry();
        gl.setAttribute('position', new THREE.Float32BufferAttribute(hr, 3));
        skupina.add(new THREE.LineSegments(gl, matCara));
      }
      kresli();
    }
    function barvaPolygonu(stav, p, barvy, viditelna) {
      const b = J.BARVY, l = stav.listy[p.s] || stav.listy[0];
      const lic = (p.horni === !l.rubNahoru) === viditelna;
      return lic ? (p.s ? barvy.lic2 || b.lic2 : barvy.lic || b.lic) : (barvy.rub || b.rub);
    }
    function vycentruj(stav) {
      const o = J.ohraniceni(stav.facety);
      stred.set(o.st[0], -o.st[1], 0);
      vzdal = Math.max(o.w, o.h) * 2.6 + 0.3;
      umistiKameru();
    }
    function kresli() { umistiKameru(); renderer.render(scena, kamera); }

    // ovládání tažením
    let tah = null;
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => { tah = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (!tah) return;
      azimut -= (e.clientX - tah.x) * 0.01;
      elevace = Math.max(-1.5, Math.min(1.5, elevace + (e.clientY - tah.y) * 0.01));
      tah = { x: e.clientX, y: e.clientY };
      kresli();
    });
    el.addEventListener('pointerup', () => { tah = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); vzdal = Math.max(0.5, Math.min(20, vzdal * (e.deltaY > 0 ? 1.1 : 0.9))); kresli(); }, { passive: false });
    new ResizeObserver(() => { velikost(); kresli(); }).observe(kontejner);
    velikost();
    return { zobraz, vycentruj, kresli, pohledShora: () => { azimut = 0; elevace = 1.5; kresli(); } };
  }

  window.OrigamiNahled3D = { vytvor };
})();
