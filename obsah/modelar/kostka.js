/* Modelář 3D – kostka pohledů (ViewCube) v rohu plátna.
   Klik na stěnu, hranu nebo roh otočí pohled do jednoho z 26 směrů,
   tažení po kostce otáčí jako pravé tlačítko na ploše.
   Kostka má vlastní malé plátno a renderer, otáčí se se scénou. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const V = THREE.Vector3;

  /** Z bodu na povrchu kostky (strana 2, střed v počátku) určí směr
      oblasti pod ním: složka, která je blízko okraje, dostane znaménko.
      Vrací vektor se složkami −1/0/1 (stěna, hrana nebo roh). */
  M.oblastKostky = function (bod) {
    const s = new V();
    const prah = 0.62;
    const p = [bod.x, bod.y, bod.z];
    // osa stěny, na které bod leží, má vždy znaménko
    let hlavni = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(p[i]) > Math.abs(p[hlavni])) hlavni = i;
    const v = p.map((x, i) => (i === hlavni || Math.abs(x) > prah) ? Math.sign(x) : 0);
    return s.set(v[0], v[1], v[2]);
  };

  /** Popisky a orientace stěn: normála, vektor „doprava“ a „nahoru“ textu. */
  const STENY = [
    { text: 'PŘEDNÍ', n: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1] },
    { text: 'ZADNÍ', n: [0, 1, 0], r: [-1, 0, 0], u: [0, 0, 1] },
    { text: 'PRAVÁ', n: [1, 0, 0], r: [0, 1, 0], u: [0, 0, 1] },
    { text: 'LEVÁ', n: [-1, 0, 0], r: [0, -1, 0], u: [0, 0, 1] },
    { text: 'HORNÍ', n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] },
    { text: 'DOLNÍ', n: [0, 0, -1], r: [1, 0, 0], u: [0, -1, 0] },
  ];

  function texturaSteny(text, b) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = b.stena; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = b.okraj; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
    g.fillStyle = b.text;
    g.font = `600 ${text.length > 5 ? 22 : 25}px ${M.barvaCss('--font', 'sans-serif')}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 66);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  /** Vytvoří kostku v daném prvku; naPohled(smer) se zavolá po kliknutí. */
  M.vytvorKostku = function (obal, kamera, naPohled, naOtoceni) {
    const vel = 116;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(vel, vel);
    renderer.domElement.className = 'kostka';
    renderer.domElement.title = 'Kostka pohledů: klik na stěnu, hranu nebo roh, tažení otáčí';
    obal.appendChild(renderer.domElement);

    const scena = new THREE.Scene();
    const kam = new THREE.OrthographicCamera(-1.75, 1.75, 1.75, -1.75, 0.1, 20);
    kam.up.set(0, 0, 1);
    const skupina = new THREE.Group();
    scena.add(skupina);
    const steny = STENY.map(s => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial());
      const n = new V(...s.n), r = new V(...s.r), u = new V(...s.u);
      m.matrix.makeBasis(r, u, n).setPosition(n);
      m.matrixAutoUpdate = false;
      m.userData.popis = s.text;
      skupina.add(m);
      return m;
    });
    const hrany = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)),
      new THREE.LineBasicMaterial());
    skupina.add(hrany);
    // zvýraznění oblasti pod myší
    const zvyr = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthTest: false }));
    zvyr.visible = false;
    zvyr.renderOrder = 2;
    skupina.add(zvyr);
    // malé osy u rohu (X červená, Y zelená, Z modrá)
    const osy = new THREE.Group();
    [[1, 0, 0, '#e05a4f'], [0, 1, 0, '#4caf6a'], [0, 0, 1, '#4f8fe0']].forEach(([x, y, z, b]) => {
      const g = new THREE.BufferGeometry().setFromPoints([new V(-1, -1, -1), new V(-1 + 2.5 * x, -1 + 2.5 * y, -1 + 2.5 * z)]);
      osy.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: b })));
    });
    skupina.add(osy);

    const k = { renderer, oblast: null };

    k.motiv = function () {
      const sv = M.svetlaScena();
      const b = sv ? { stena: '#f3f5f8', okraj: '#c3ccd8', text: '#3b4450', hrana: '#7d8a9c' }
                   : { stena: '#3a4049', okraj: '#4d5562', text: '#e3e7ec', hrana: '#9aa6b6' };
      steny.forEach(m => {
        if (m.material.map) m.material.map.dispose();
        m.material.map = texturaSteny(m.userData.popis, b);
        m.material.needsUpdate = true;
      });
      hrany.material.color.set(b.hrana);
      zvyr.material.color.set(M.barvaCss('--accent', '#6aa6fd'));
    };

    k.vykresli = function () {
      const d = M.smerPohledu(kamera.az, kamera.el);
      kam.position.copy(d.multiplyScalar(8));
      kam.lookAt(0, 0, 0);
      renderer.render(scena, kam);
    };

    /** Bod kostky (souřadnice −1..1) → [clientX, clientY] na stránce (pro testy). */
    k.naObrazovce = function (x, y, z) {
      k.vykresli();
      const p = new V(x, y, z).project(kam);
      const r = renderer.domElement.getBoundingClientRect();
      return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height];
    };

    function oblastPodMysi(e) {
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, kam);
      const zasah = ray.intersectObjects(steny, false)[0];
      return zasah ? M.oblastKostky(zasah.point) : null;
    }

    function ukazOblast(o) {
      const klic = o ? o.toArray().join() : '';
      if (klic === (k.oblast ? k.oblast.toArray().join() : '')) return;
      k.oblast = o;
      if (o) {
        // v ose se znaménkem tenká vrstva u okraje (0,6–1,04), jinak střed stěny (±0,64)
        zvyr.scale.set(...[o.x, o.y, o.z].map(c => c ? 0.44 : 1.28));
        zvyr.position.set(o.x * 0.82, o.y * 0.82, o.z * 0.82);
      }
      zvyr.visible = !!o;
      k.vykresli();
    }

    // tažení otáčí, krátký klik bez pohybu vybere pohled
    let tah = null;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      tah = { x: e.clientX, y: e.clientY, pohyb: 0 };
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      if (tah) {
        const dx = e.clientX - tah.x, dy = e.clientY - tah.y;
        tah.pohyb += Math.abs(dx) + Math.abs(dy);
        tah.x = e.clientX; tah.y = e.clientY;
        if (tah.pohyb > 4) { naOtoceni(dx, dy); ukazOblast(null); }
        return;
      }
      ukazOblast(oblastPodMysi(e));
    });
    el.addEventListener('pointerup', e => {
      if (tah && tah.pohyb <= 4) {
        const o = oblastPodMysi(e);
        if (o) naPohled(o);
      }
      tah = null;
    });
    el.addEventListener('pointercancel', () => { tah = null; });     // dotyk přerušený systémem – tah nesmí zůstat viset
    el.addEventListener('pointerleave', () => { if (!tah) ukazOblast(null); });
    el.addEventListener('contextmenu', e => e.preventDefault());

    k.motiv();
    return k;
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
