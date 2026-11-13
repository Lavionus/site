/* Krabičky – 3D náhled nad společnou scénou gen3d/scena.js: průhledné víko, rozložený pohled, deska plošných spojů,
   kóty, měření vzdáleností kliknutím, tenká místa, řez posuvnou rovinou, tisková poloha s převisy, pravítka.
   Osa Z nahoru, jednotky mm.
   const n = KRAB_NAHLED.vytvorNahled(kontejner, {priMereni})
   n.nastav(dily, odv, p) · n.prepni(co, h) – hrany | tisk | previsy | pravitka | pruhledne | rozlozit | deska | koty | mereni
   n.rez(podil | null) · n.pohled(jak) · n.oznacTenke(body) · n.smazMereni() · n.png() · n.barvy(…) */
/* global THREE, G3D, KRAB */
(function () {
  'use strict';
  const BARVY = { krabicka: '#4F86D9', viko: '#E0A63F' };
  const fmt = x => (Math.round(x * 100) / 100).toString().replace('.', ',');

  function vytvorNahled(kontejner, volby = {}) {
    // náhled se po výrazné změně poměru stran (úzký displej, přepnutí boxu) znovu vejde – jádro to samo nedělá
    let posledniBox = null, pomer = 0;
    const prizpusob = (w, h) => { if (posledniBox && Math.abs(w / h - pomer) / pomer > 0.15) s.pohled('ponech', posledniBox); pomer = w / h; };
    const s = G3D.scena(kontejner, { odstup: 1.05, zmenaVelikosti: prizpusob, popis: '3D náhled krabičky – táhnutím otáčíte, kolečkem nebo dvěma prsty přibližujete, pravým tlačítkem posouváte' });
    const vrstva = document.createElement('div');    // HTML popisky (kóty, měření)
    vrstva.className = 'popisky3d';
    kontejner.appendChild(vrstva);
    const stav = { hrany: true, tisk: false, previsy: true, pravitka: false, pruhledne: false, rozlozit: 0, rozlozitCil: 0, rez: null, deska: true, koty: true, mereni: false, uhel: 45 };
    const matDeska = new THREE.MeshStandardMaterial({ color: 0x2e8b57, transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.7 });
    const matTenke = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    const matKota = new THREE.LineBasicMaterial({ color: 0x888888 });
    const matMereni = new THREE.MeshBasicMaterial({ color: 0xff3d7f, depthTest: false });
    const matCara = new THREE.LineBasicMaterial({ color: 0xff3d7f, depthTest: false });
    let dily = null, odv = null, proj = null, prvni = true, rozmer = 100;
    let skupiny = {}, deska = null, tenkeBody = null;
    const kotyPopisky = [];
    const roviny = () => (stav.rez === null ? [] : [s.rovinaRezu]);

    /* ---------- obsah scény ---------- */
    function sestav(novyPohled) {
      s.vycisti(); skupiny = {}; deska = null;
      vrstva.querySelectorAll('.kota:not(.mer)').forEach(e => e.remove()); kotyPopisky.length = 0;
      if (!dily || !dily.length) { s.stin(null); s.prekresli(); return; }
      const sestava = !stav.tisk;
      const zobrazene = sestava ? dily : KRAB.tiskoveRozlozeni(dily);
      const box = new THREE.Box3();
      for (const d of zobrazene) {
        const tridy = stav.tisk && stav.previsy ? G3D.tridyPrevisu(d.poz, d.idx, stav.uhel) : null;
        const barva = BARVY[d.jmeno] || BARVY.krabicka;
        const g = s.geometrie(d.poz, d.idx, { uhel: 28, barvaTroj: tridy && (t => (tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : null)), zaklad: new THREE.Color(barva).toArray() });
        const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(barva), roughness: 0.5, metalness: 0.05, clearcoat: 0.2, clearcoatRoughness: 0.6, clippingPlanes: roviny() });
        if (tridy) { mat.color.set(0xffffff); mat.vertexColors = true; }   // převisy: barvy trojúhelníků, ostatní v barvě dílu (zaklad)
        const gr = new THREE.Group(); gr.userData.jmeno = d.jmeno;
        const mesh = new THREE.Mesh(g, mat); mesh.userData = { vlastniMat: true, zakl: true, jmeno: d.jmeno };
        const vn = new THREE.Mesh(g, s.matVnitrek); vn.visible = stav.rez !== null; vn.userData = { vnitrek: true, model: false };
        const mh = new THREE.LineBasicMaterial({ color: s.matHrany.color, transparent: true, opacity: s.matHrany.opacity, clippingPlanes: roviny() });
        const hr = s.hrany(d.poz, d.idx, 28, mh); hr.visible = stav.hrany; hr.userData = { hrany: true, vlastniMat: true, jmeno: d.jmeno };
        gr.add(mesh, vn, hr); s.skupina.add(gr); skupiny[d.jmeno] = gr;
        g.computeBoundingBox(); box.union(g.boundingBox);
      }
      // deska plošných spojů jen jako pomůcka náhledu (neexportuje se)
      if (sestava && proj && proj.deska.pouzit) {
        const dk = proj.deska;
        const geo = new THREE.BoxGeometry(dk.delka, dk.sirka, dk.tloustka);
        geo.translate(odv.pcb0[0] + dk.delka / 2, odv.pcb0[1] + dk.sirka / 2, odv.pcb0[2] + dk.tloustka / 2);
        deska = new THREE.Mesh(geo, matDeska); deska.userData = { jmeno: 'deska', model: false };
        deska.visible = stav.deska;
        s.skupina.add(deska);
      }
      if (sestava) postavKoty();
      if (sestava && tenkeBody) kresliTenke();
      const vel = new THREE.Vector3(); box.getSize(vel);
      const novy = Math.max(vel.x, vel.y, vel.z, 10);
      s.mrizka(box, stav.tisk);
      s.stin(box, !stav.tisk);
      if (stav.pravitka) s.pravitka(box);
      nastavRovinu(); pruhlednost(); poloha();
      posledniBox = box;
      if (prvni || Math.abs(novy - rozmer) / rozmer > 0.3 || novyPohled) { s.pohled(prvni ? 'iso' : 'ponech', box); prvni = false; }
      else s.prekresli();
      rozmer = novy;
    }
    function nastav(seznam, o, p, v = {}) { dily = seznam; odv = o; proj = p; sestav(v.novyPohled); }

    function pruhlednost() {
      const g = skupiny.viko; if (!g) return;
      const pr = stav.pruhledne && !stav.tisk;
      for (const o of g.children) {
        if (o.userData.zakl) { o.material.transparent = pr; o.material.opacity = pr ? 0.28 : 1; o.material.depthWrite = !pr; o.material.needsUpdate = true; }
        if (o.userData.hrany) o.visible = stav.hrany && !pr;
        if (o.userData.vnitrek) o.visible = stav.rez !== null && !pr;
      }
      s.prekresli();
    }
    function nastavRovinu() {
      // podíl 0–1 přes šířku krabičky; ponechá se část za rovinou (y ≥ řez)
      if (stav.rez !== null && odv) s.rovinaRezu.constant = -(-odv.Wo / 2 + stav.rez * odv.Wo);
      for (const o of s.skupina.children) o.traverse(c => {
        if (c.userData.zakl || c.userData.hrany) { c.material.clippingPlanes = roviny(); c.material.needsUpdate = true; }
        if (c.userData.vnitrek) c.visible = stav.rez !== null;
      });
      matDeska.clippingPlanes = matTenke.clippingPlanes = roviny(); matDeska.needsUpdate = matTenke.needsUpdate = true;
    }
    // poloha víka a desky v rozloženém pohledu
    function poloha() {
      const z = stav.tisk ? 0 : stav.rozlozit * (odv ? odv.Hb * 0.7 + 15 : 30);
      if (skupiny.viko) skupiny.viko.position.z = z;
      if (deska) deska.position.z = stav.rozlozit * (odv ? odv.Hb * 0.25 : 8);
    }

    /* ---------- kóty ---------- */
    function postavKoty() {
      if (!stav.koty || !odv) return;
      const o = odv, H = o.Hb + o.Hv, odst = Math.max(6, Math.max(...o.celkem) * 0.08);
      const x0 = -o.celkem[0] / 2, x1 = o.celkem[0] / 2, y0 = -o.Wo / 2, y1 = o.Wo / 2;
      const g = new THREE.Group(); g.userData.model = false;
      const cara = body => {
        const geo = new THREE.BufferGeometry().setFromPoints(body.map(b => new THREE.Vector3(...b)));
        g.add(new THREE.LineSegments(geo, matKota));
      };
      const t = odst * 0.25;
      // délka (X) před krabičkou, šířka (Y) vpravo, výška (Z) vlevo od levého předního rohu
      cara([[x0, y0, 0], [x0, y0 - odst - t, 0], [x1, y0, 0], [x1, y0 - odst - t, 0], [x0, y0 - odst, 0], [x1, y0 - odst, 0]]);
      kotyPopisky.push({ bod: new THREE.Vector3(0, y0 - odst, 0), text: fmt(o.celkem[0]) + ' mm' });
      cara([[x1, y0, 0], [x1 + odst + t, y0, 0], [x1, y1, 0], [x1 + odst + t, y1, 0], [x1 + odst, y0, 0], [x1 + odst, y1, 0]]);
      kotyPopisky.push({ bod: new THREE.Vector3(x1 + odst, 0, 0), text: fmt(o.Wo) + ' mm' });
      const xl = -o.Lo / 2;
      cara([[xl, y0, 0], [xl - odst - t, y0, 0], [xl, y0, H], [xl - odst - t, y0, H], [xl - odst, y0, 0], [xl - odst, y0, H]]);
      kotyPopisky.push({ bod: new THREE.Vector3(xl - odst, y0, H / 2), text: fmt(H) + ' mm' });
      s.skupina.add(g);
      for (const k of kotyPopisky) { k.el = document.createElement('div'); k.el.className = 'kota'; k.el.textContent = k.text; vrstva.appendChild(k.el); }
    }

    /* ---------- měření ---------- */
    const mereni = { body: [], znacky: [], cara: null, el: null };
    function smazMereni() {
      for (const z of mereni.znacky) { s.scena.remove(z); z.geometry.dispose(); }
      if (mereni.cara) { s.scena.remove(mereni.cara); mereni.cara.geometry.dispose(); }
      if (mereni.el) mereni.el.remove();
      mereni.body = []; mereni.znacky = []; mereni.cara = null; mereni.el = null;
      if (volby.priMereni) volby.priMereni(null);
      s.prekresli();
    }
    function pridejBod(b) {
      if (mereni.body.length >= 2) smazMereni();
      mereni.body.push(b.clone());
      const z = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.4, rozmer * 0.006), 12, 8), matMereni);
      z.renderOrder = 10; z.position.copy(b); s.scena.add(z); mereni.znacky.push(z);
      if (mereni.body.length === 2) {
        const [a, c] = mereni.body;
        mereni.cara = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, c]), matCara);
        mereni.cara.renderOrder = 10; s.scena.add(mereni.cara);
        const d = a.distanceTo(c);
        mereni.el = document.createElement('div'); mereni.el.className = 'kota mer'; mereni.el.textContent = fmt(d) + ' mm';
        vrstva.appendChild(mereni.el);
        if (volby.priMereni) volby.priMereni({ d, dx: Math.abs(c.x - a.x), dy: Math.abs(c.y - a.y), dz: Math.abs(c.z - a.z), a, b: c });
      } else if (volby.priMereni) volby.priMereni({ jen: mereni.body[0] });
      s.prekresli();
    }
    const ray = new THREE.Raycaster();
    function kliknuti(x, y, shift) {
      const r = s.platno.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), s.kamera);
      const cile = [];
      s.skupina.traverse(o => { if (o.userData.zakl && !(o.userData.jmeno === 'viko' && stav.pruhledne && !stav.tisk)) cile.push(o); });
      if (deska && deska.visible) cile.push(deska);
      let hity = ray.intersectObjects(cile, false);
      if (stav.rez !== null) hity = hity.filter(h => s.rovinaRezu.distanceToPoint(h.point) >= -1e-6);
      const h = hity[0]; if (!h) return;
      let b = h.point.clone();
      if (shift && h.face) {
        // přichycení k nejbližšímu vrcholu zasaženého trojúhelníku
        const pos = h.object.geometry.attributes.position;
        let dmin = Infinity;
        for (const i of [h.face.a, h.face.b, h.face.c]) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(h.object.matrixWorld);
          const d = v.distanceTo(h.point); if (d < dmin) { dmin = d; b = v; }
        }
      }
      pridejBod(b);
    }
    let start = null;
    s.platno.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY, t: Date.now(), shift: e.shiftKey, n: (start ? start.n : 0) + 1 }; });
    s.platno.addEventListener('pointerup', e => {
      if (stav.mereni && start && start.n === 1 && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5 && Date.now() - start.t < 600) kliknuti(e.clientX, e.clientY, start.shift || e.shiftKey);
      start = null;
    });
    s.platno.addEventListener('pointercancel', () => { start = null; });

    /* ---------- tenká místa ---------- */
    function kresliTenke() {
      if (!tenkeBody || !tenkeBody.length) return;
      const g = new THREE.SphereGeometry(Math.max(0.35, rozmer * 0.005), 8, 6);
      const m = new THREE.InstancedMesh(g, matTenke, tenkeBody.length), M = new THREE.Matrix4();
      tenkeBody.forEach((b, i) => { M.makeTranslation(b[0], b[1], b[2]); m.setMatrixAt(i, M); });
      m.userData.model = false;
      const kam = skupiny.krabicka || s.skupina;
      // body víka jedou s víkem (rozložený pohled)
      const vik = tenkeBody.filter(b => b.dil === 'viko'), krab = tenkeBody.filter(b => b.dil !== 'viko');
      if (vik.length && skupiny.viko) {
        const mv = new THREE.InstancedMesh(g.clone(), matTenke, vik.length);
        vik.forEach((b, i) => { M.makeTranslation(b[0], b[1], b[2]); mv.setMatrixAt(i, M); });
        skupiny.viko.add(mv);
        krab.forEach((b, i) => { M.makeTranslation(b[0], b[1], b[2]); m.setMatrixAt(i, M); });
        m.count = krab.length;
      }
      kam.add(m);
    }
    function oznacTenke(body) { tenkeBody = body && body.length ? body : null; sestav(false); }

    /* ---------- každý snímek: animace rozložení a popisky ---------- */
    const v3 = new THREE.Vector3();
    function umisti(el, bod) {
      v3.copy(bod).project(s.kamera);
      const w = kontejner.clientWidth, h = kontejner.clientHeight;
      el.style.display = v3.z < 1 && v3.z > -1 ? '' : 'none';
      el.style.transform = `translate(-50%, -50%) translate(${(v3.x + 1) / 2 * w}px, ${(1 - v3.y) / 2 * h}px)`;
    }
    s.scena.onBeforeRender = () => {
      if (Math.abs(stav.rozlozit - stav.rozlozitCil) > 0.002) { stav.rozlozit += (stav.rozlozitCil - stav.rozlozit) * 0.22; s.prekresli(); }
      else stav.rozlozit = stav.rozlozitCil;
      poloha();
      s.skupina.updateMatrixWorld(true);
      for (const k of kotyPopisky) if (k.el) umisti(k.el, k.bod);
      if (mereni.el && mereni.body.length === 2) umisti(mereni.el, mereni.body[0].clone().add(mereni.body[1]).multiplyScalar(0.5));
    };

    function prepni(co, h) {
      stav[co] = h;
      if (co === 'hrany') { s.skupina.traverse(o => { if (o.userData.hrany) o.visible = h; }); pruhlednost(); return; }
      if (co === 'pruhledne') { pruhlednost(); return; }
      if (co === 'rozlozit') { stav.rozlozitCil = h ? 1 : 0; s.prekresli(); return; }
      if (co === 'deska') { if (deska) deska.visible = h; s.prekresli(); return; }
      if (co === 'mereni') { s.platno.style.cursor = h ? 'crosshair' : ''; if (!h) smazMereni(); return; }
      sestav(co === 'tisk');   // tisk, převisy, pravítka, kóty
    }
    return {
      nastav, prepni, oznacTenke, smazMereni, stav,
      rez(podil) { stav.rez = podil; nastavRovinu(); pruhlednost(); },
      pohled: jak => s.pohled(jak === 'izo' ? 'iso' : jak),
      barvy(cara, cara2, hrana, kota) { s.barvy(cara, cara2, hrana); matKota.color.set(kota || hrana); s.skupina.traverse(o => { if (o.userData.hrany) o.material.color.copy(s.matHrany.color); }); },
      png: s.png, snimekPNG: s.png, prekresli: s.prekresli, scena: s,
    };
  }

  window.KRAB_NAHLED = { vytvorNahled };
})();
