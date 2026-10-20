/* Modelář 3D – magnet: přisazení plochou na plochu. Klik na plochu tělesa (oranžově zvýrazněná)
   → klik na plochu jiného tělesa (pod kurzorem zeleně) → první těleso se otočí a posune tak, aby jeho
   plocha dosedla na druhou (středem na místo kliknutí). Jeden krok historie, Esc zruší.
   Rovná plocha se bere celá (M.oblastPlochy), na oblé ploše jen trojúhelník pod kurzorem. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const V = THREE.Vector3;

  M.vytvorMagnet = function (S, T) {
    let prvni = null;                 // {id, plocha: {bod, normala, kontury3d}}
    let vrstvaA = null, vrstvaB = null, klicB = '';
    const matA = new THREE.MeshBasicMaterial({ color: 0xf39c12, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const matB = new THREE.MeshBasicMaterial({ color: 0x3cae5c, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });

    /** Plocha pod zásahem: {id, bod (střed plochy), normala, mesh (zvýraznění)} nebo null. */
    function plochaZasahu(zasah) {
      const u = zasah && M.najdiUzel(M.app.dok, zasah.id);
      if (!u || zasah.trojuhelnik == null) return null;
      const sit = T.svetovaSit(u.id);
      if (!sit) return null;
      const n = zasah.normala.clone().normalize();
      let geom = null, bod = zasah.bod.clone();
      try {
        const p = M.oblastPlochy(sit, zasah.trojuhelnik);
        if (p.oblast.length) {
          // vnější obrys a jeho díry; střed plochy = těžiště vnějšího obrysu (bez děr – přisazuje se celá stěna)
          const vnejsi = p.oblast[0];
          let A = 0, cx = 0, cy = 0;
          for (let i = 0; i < vnejsi.length; i++) {
            const [x0, y0] = vnejsi[i], [x1, y1] = vnejsi[(i + 1) % vnejsi.length], k = x0 * y1 - x1 * y0;
            A += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
          }
          const uu = new V(...p.u), vv = new V(...p.v), b0 = new V(...p.bod);
          if (Math.abs(A) > 1e-9) bod = b0.clone().addScaledVector(uu, cx / (3 * A)).addScaledVector(vv, cy / (3 * A));
          const tvar = new THREE.Shape(vnejsi.map(([x, y]) => new THREE.Vector2(x, y)));
          for (const d of p.oblast.slice(1)) tvar.holes.push(new THREE.Path(d.map(([x, y]) => new THREE.Vector2(x, y))));
          geom = new THREE.ShapeGeometry(tvar);
          geom.applyMatrix4(new THREE.Matrix4().makeBasis(uu, vv, new V(...p.normala)).setPosition(b0));
          n.set(...p.normala).normalize();
        }
      } catch (e) { /* oblá plocha: jen trojúhelník */ }
      if (!geom) {
        const t = zasah.trojuhelnik * 3, poz = [];
        for (let k = 0; k < 3; k++) { const i = sit.idx[t + k] * 3; poz.push(sit.poz[i], sit.poz[i + 1], sit.poz[i + 2]); }
        geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
      }
      return { id: u.id, bod: bod.toArray(), normala: n.toArray(), geom };
    }
    function ukaz(plocha, mat) {
      const m = new THREE.Mesh(plocha.geom, mat);
      m.renderOrder = 6;
      m.userData.prekryv = true;                       // do náhledu projektu a obrázku nepatří
      S.scena.add(m);
      return m;
    }
    function uklid(m) { if (m) { S.scena.remove(m); m.geometry.dispose(); } return null; }
    function zrus() {
      prvni = null; klicB = '';
      vrstvaA = uklid(vrstvaA); vrstvaB = uklid(vrstvaB);
      M.prekresli();
    }

    /** Klik v režimu magnet / magnet2 (z vyber.js). */
    M.klikMagnet = function (zasah) {
      if (!zasah) { if (!prvni) Dialog.info('Klikni na plochu tělesa, kterou chceš přisadit.'); return; }
      const u = M.najdiUzel(M.app.dok, zasah.id);
      if (!prvni) {
        if (!u || u.zamceno) { Dialog.chyba('Zamčené těleso se nepřisazuje – vyber plochu jiného.'); return; }
        const p = plochaZasahu(zasah);
        if (!p) return;
        prvni = p;
        vrstvaA = ukaz(p, matA);
        M.nastavVyber([p.id]);
        M.nastavRezim('magnet2');
        return;
      }
      if (zasah.id === prvni.id) { Dialog.info('Druhá plocha musí být na jiném tělese.'); return; }
      const b = plochaZasahu(zasah);
      if (!b) return;
      b.geom.dispose();
      const a = prvni;
      zrus();
      M.nastavRezim(null);
      // na cílovou plochu dosedne střed přisazované plochy – v místě kliknutí
      const dok = M.prisadPlochu(M.app.dok, a.id, a, { bod: zasah.bod.toArray(), normala: b.normala });
      M.zmenDokument(dok, 'Magnet');
      M.nastavVyber([a.id]);
    };

    // náhled cílové plochy pod kurzorem (nejvýš jednou za snímek)
    const platno = S.renderer.domElement;
    let plan = 0, mys = null;
    platno.addEventListener('pointermove', e => {
      if (M.app.rezim !== 'magnet2' || e.buttons) return;
      const r = platno.getBoundingClientRect();
      mys = [e.clientX - r.left, e.clientY - r.top];
      if (plan) return;
      plan = requestAnimationFrame(() => {
        plan = 0;
        if (M.app.rezim !== 'magnet2' || !mys) return;
        const z = T.zasah(mys[0], mys[1]);
        const k = z && z.id !== (prvni && prvni.id) ? z.id + '|' + z.trojuhelnik : '';
        if (k === klicB) return;
        klicB = k;
        vrstvaB = uklid(vrstvaB);
        if (k) { const p = plochaZasahu(z); if (p) vrstvaB = ukaz(p, matB); }
        M.prekresli();
      });
    });
    // konec režimu (Esc, jiný nástroj): zvýraznění pryč
    M.na('rezim', r => { if (r !== 'magnet' && r !== 'magnet2' && (prvni || vrstvaB)) zrus(); });
    M.na('dokument', e => { if (prvni && !(e && e.docasne) && !M.najdiUzel(M.app.dok, prvni.id)) { zrus(); M.nastavRezim(null); } });

    M.prepniMagnet = function () {
      if (M.app.rezim === 'magnet' || M.app.rezim === 'magnet2') { M.nastavRezim(null); return; }
      zrus();
      M.nastavRezim('magnet');
    };
    // pro testy
    M.magnetStav = () => ({ rezim: M.app.rezim, prvni: prvni && { id: prvni.id, bod: prvni.bod, normala: prvni.normala }, zvyrazneniA: !!vrstvaA, zvyrazneniB: !!vrstvaB });
  };
})(MDL);
