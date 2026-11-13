/* Krabička s víčkem na pantu – 3D náhled nad společnou scénou gen3d/scena.js: otevírání víka a chlopní
   kolem os pantů, průhledné víko, úchyty, jejichž tažením se mění vnitřní rozměry, řez kolmo na X / Y,
   tisková poloha s převisy a pravítka. Osa Z nahoru, jednotky mm. Úchyt X a Y mění rozměr symetricky (posun × 2), úchyt Z výšku.
   const n = KPANT_NAHLED.vytvorNahled(kontejner, {hodnoty, priTazeni})
   n.nastavDily(dily, odv, texty, kov, {tisk: [díly v tiskové poloze] | null, uhel})
   n.prepni(co, h) – hrany | previsy | pravitka | pruhledne | uchyty · n.uhly(viko, chlopen) · n.rez(osa | null, podil) */
/* global THREE, G3D */
(function () {
  'use strict';
  const fmt = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
  const BARVY = { krabicka: 0x4f86d9, viko: 0xe0a63f, chlopen: 0x4caf7a, vlozka: 0xa77bd6, kov: 0xb8c0c8, plast: 0xd8d8d8 };
  const POHLEDY = { zezadu: [Math.PI / 2, 0.25] };

  function vytvorNahled(kontejner, volby = {}) {
    // náhled se po výrazné změně poměru stran (úzký displej, přepnutí boxu) znovu vejde – jádro to samo nedělá
    let posledniBox = null, pomer = 0;
    const prizpusob = (w, h) => { if (posledniBox && Math.abs(w / h - pomer) / pomer > 0.15) s.pohled('ponech', posledniBox); pomer = w / h; };
    const s = G3D.scena(kontejner, { pohledy: POHLEDY, odstup: 1, zmenaVelikosti: prizpusob, popis: '3D náhled krabičky – táhnutím otáčíte, barevnými úchyty měníte rozměry, kolečkem přibližujete' });
    const vrstva = document.createElement('div');
    vrstva.className = 'popisky3d';
    kontejner.appendChild(vrstva);
    const UCHYTY = {
      x: { barva: 0xe5484d, smer: new THREE.Vector3(1, 0, 0), faktor: 2, nazev: 'Délka' },
      y: { barva: 0x30a46c, smer: new THREE.Vector3(0, -1, 0), faktor: 2, nazev: 'Šířka' },
      z: { barva: 0x3e8ef7, smer: new THREE.Vector3(0, 0, 1), faktor: 1, nazev: 'Výška' },
    };
    let pivotViko = null, pivotyChl = [], uchytyG = null, odv = null, rozmer = 100, prvni = true;
    let posledni = null;                                  // argumenty posledního nastavDily (přestavba po přepnutí)
    const uchyty = {};
    const stav = { viko: 0, chlopen: 0, pruhledne: false, uchyty: true, rez: null, hrany: true, previsy: true, pravitka: false, tisk: false };
    const roviny = () => (stav.rez ? [s.rovinaRezu] : []);

    /* ---------- díly ---------- */
    function pridej(rodic, d, barva, tridy, x = 0) {
      const g = s.geometrie(d.poz, d.idx, { uhel: 28, barvaTroj: tridy && (t => (tridy[t] === 1 || tridy[t] === 2 ? G3D.BARVY_TRID[tridy[t]] : null)), zaklad: new THREE.Color(barva).toArray() });
      const kov = barva === BARVY.kov;
      const mat = new THREE.MeshPhysicalMaterial({ color: barva, roughness: kov ? 0.3 : 0.5, metalness: kov ? 0.8 : 0.05, clearcoat: 0.2, clearcoatRoughness: 0.6, clippingPlanes: roviny() });
      if (tridy) { mat.color.set(0xffffff); mat.vertexColors = true; }   // převisy: barvy trojúhelníků, ostatní v barvě dílu (zaklad)
      const m = new THREE.Mesh(g, mat); m.userData = { vlastniMat: true, zakl: true, jmeno: d.jmeno };
      const vn = new THREE.Mesh(g, s.matVnitrek); vn.visible = !!stav.rez; vn.userData = { vnitrek: true, model: false };
      const mh = new THREE.LineBasicMaterial({ color: s.matHrany.color, transparent: true, opacity: s.matHrany.opacity, clippingPlanes: roviny() });
      const e = s.hrany(d.poz, d.idx, 28, mh); e.visible = stav.hrany; e.userData = { hrany: true, vlastniMat: true, jmeno: d.jmeno };
      m.position.x = vn.position.x = e.position.x = x;
      rodic.add(m, vn, e);
      g.computeBoundingBox();
      return g.boundingBox.clone().translate(new THREE.Vector3(x, 0, 0));
    }
    function nastavDily(dily, o, texty, kov, v = {}) {
      posledni = [dily, o, texty, kov, v];
      s.vycisti(); pivotViko = null; pivotyChl = []; uchytyG = null;
      vrstva.querySelectorAll('.uchyt-popis').forEach(e => e.remove());
      for (const k of Object.keys(uchyty)) delete uchyty[k];
      if (!dily) { odv = null; s.stin(null); s.prekresli(); return; }
      odv = o;
      stav.tisk = !!v.tisk;
      const box = new THREE.Box3();
      if (stav.tisk) {
        // díly v tiskové poloze vedle sebe na podložce, převisy barevně
        for (const d of v.tisk) {
          const tridy = stav.previsy ? G3D.tridyPrevisu(d.poz, d.idx, v.uhel || 45) : null;
          box.union(pridej(s.skupina, d, d.jmeno.startsWith('cep') ? (kov ? BARVY.kov : BARVY.plast) : BARVY[d.jmeno] || BARVY.krabicka, tridy));
        }
      } else {
        const { yA, zA } = o.pant, { zF } = o.zap;
        pivotViko = new THREE.Group(); const vnitrekViko = new THREE.Group();
        pivotViko.add(vnitrekViko); pivotViko.position.set(0, yA, zA); vnitrekViko.position.set(0, -yA, -zA);
        s.skupina.add(pivotViko);
        // díl zapínání: skupina otočená na stranu (kolem Z), v ní kloub v místě (x, y) osy
        const naStranu = (um, kloub) => {
          const st = new THREE.Group(); st.rotation.z = um.phi * Math.PI / 180;
          const piv = new THREE.Group(), vn = new THREE.Group();
          piv.position.set(um.x, um.y, zF); vn.position.set(0, 0, -zF);
          piv.add(vn); st.add(piv); vnitrekViko.add(st);
          if (kloub) pivotyChl.push(piv);
          return vn;
        };
        const bCep = kov ? BARVY.kov : BARVY.plast;
        for (const d of dily) {
          if (d.jmeno === 'krabicka' || d.jmeno === 'vlozka') box.union(pridej(s.skupina, d, BARVY[d.jmeno]));
          else if (d.jmeno === 'cepPant') for (const x of d.xs) pridej(s.skupina, d, bCep, null, x);
          else if (d.jmeno === 'viko') box.union(pridej(vnitrekViko, d, BARVY.viko));
          else if (d.jmeno === 'cepZap') for (const um of d.umisteni) pridej(naStranu(um, false), d, bCep);
          else if (d.jmeno === 'chlopen') for (const um of d.umisteni) pridej(naStranu(um, true), d, BARVY.chlopen);
        }
        box.min.x = Math.min(box.min.x, -o.celkem[0] / 2); box.max.x = Math.max(box.max.x, o.celkem[0] / 2);
        box.min.y = Math.min(box.min.y, -o.celkem[1] / 2); box.max.y = Math.max(box.max.y, o.celkem[1] / 2);
        postavUchyty(texty);
      }
      rozmer = Math.max(...o.celkem);
      s.mrizka(box, stav.tisk);
      s.stin(box, !stav.tisk);
      if (stav.pravitka) s.pravitka(box);
      nastavRez(); pruhlednost();
      posledniBox = box;
      if (prvni || v.novyPohled) { s.pohled(prvni ? 'iso' : 'ponech', box); prvni = false; }
      s.prekresli();
    }
    const obnov = () => { if (posledni) nastavDily(...posledni); };

    function pruhlednost() {
      const pr = stav.pruhledne && !stav.tisk;
      s.skupina.traverse(ob => {
        if (ob.userData.zakl && (ob.userData.jmeno === 'viko' || ob.userData.jmeno === 'chlopen')) {
          ob.material.transparent = pr; ob.material.opacity = pr ? 0.3 : 1; ob.material.depthWrite = !pr; ob.material.needsUpdate = true;
        }
      });
      s.prekresli();
    }

    /* ---------- řez: ponechá se část modelu s x (nebo y) menším než poloha řezu ---------- */
    function nastavRez() {
      const r = stav.rez;
      if (r && odv) {
        // rozsah posuvníku: celá délka, v Y souměrně až za články pantu
        const i = r.osa === 'y' ? 1 : 0, L = i ? 2 * (odv.pant.yA + 2 * odv.pant.Rk) : odv.celkem[0] + 2;
        s.rovinaRezu.normal.set(i ? 0 : -1, i ? -1 : 0, 0);
        s.rovinaRezu.constant = -L / 2 + r.podil * L;
      }
      s.skupina.traverse(ob => {
        if (ob.userData.zakl || ob.userData.hrany) { ob.material.clippingPlanes = roviny(); ob.material.needsUpdate = true; }
        if (ob.userData.vnitrek) ob.visible = !!r;
      });
      s.prekresli();
    }

    /* ---------- úchyty rozměrů ---------- */
    function postavUchyty(texty) {
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
        koule.position.copy(b); koule.renderOrder = 20; koule.userData = { osa, model: false, vlastniMat: true };
        const cara = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: u.barva, depthTest: false }));
        cara.renderOrder = 19; cara.userData.vlastniMat = true;
        uchytyG.add(koule, cara);
        const el = document.createElement('div'); el.className = 'kota uchyt-popis';
        el.textContent = texty && texty[osa] ? texty[osa] : u.nazev;
        el.hidden = !stav.uchyty;
        vrstva.appendChild(el);
        uchyty[osa] = { koule, bod: b, smer: u.smer, faktor: u.faktor, el, r };
      }
      s.skupina.add(uchytyG);
    }

    /* ---------- každý snímek: úhly víka a chlopní, popisky úchytů ---------- */
    const v3 = new THREE.Vector3();
    s.scena.onBeforeRender = () => {
      if (pivotViko) pivotViko.rotation.x = -stav.viko * Math.PI / 180;
      for (const g of pivotyChl) g.rotation.x = -stav.chlopen * Math.PI / 180;
      s.skupina.updateMatrixWorld(true);
      const w = kontejner.clientWidth, h = kontejner.clientHeight;
      for (const u of Object.values(uchyty)) {
        v3.copy(u.bod).addScaledVector(u.smer, u.r * 2.2).project(s.kamera);
        u.el.style.display = v3.z < 1 && v3.z > -1 ? '' : 'none';
        u.el.style.transform = `translate(-50%, -50%) translate(${(v3.x + 1) / 2 * w}px, ${(1 - v3.y) / 2 * h}px)`;
      }
    };

    /* ---------- tažení úchytů (před otáčením scény: zachytí se ve fázi capture na kontejneru) ---------- */
    const ray = new THREE.Raycaster();
    function paprsek(x, y) {
      const r = s.platno.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), s.kamera);
      return ray.ray;
    }
    function zasahUchytu(x, y) {
      if (!stav.uchyty || !uchytyG || stav.tisk) return null;
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
    let tah = null;
    kontejner.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !volby.hodnoty || e.target !== s.platno) return;
      const osa = zasahUchytu(e.clientX, e.clientY); if (!osa) return;
      const u = uchyty[osa], s0 = naOse(paprsek(e.clientX, e.clientY), u.bod, u.smer);
      if (s0 === null) return;
      e.stopPropagation();
      try { kontejner.setPointerCapture(e.pointerId); } catch (er) { /* ukazatel už není aktivní */ }
      tah = { id: e.pointerId, osa, s0, h0: volby.hodnoty()[osa], bod: u.bod.clone(), posl: null };
    }, true);
    kontejner.addEventListener('pointermove', e => {
      if (!tah) { if (!e.buttons && e.target === s.platno) s.platno.style.cursor = zasahUchytu(e.clientX, e.clientY) ? 'grab' : ''; return; }
      if (e.pointerId !== tah.id) return;
      const u = UCHYTY[tah.osa], q = naOse(paprsek(e.clientX, e.clientY), tah.bod, u.smer);
      if (q === null) return;
      const krok = e.shiftKey ? 0.1 : 1;
      const h = Math.round((tah.h0 + u.faktor * (q - tah.s0)) / krok) * krok;
      s.platno.style.cursor = 'grabbing';
      if (h !== tah.posl) { tah.posl = h; volby.priTazeni(tah.osa, h, false); }
    });
    const konec = e => {
      if (!tah || e.pointerId !== tah.id) return;
      const t = tah; tah = null; s.platno.style.cursor = '';
      if (t.posl !== null) volby.priTazeni(t.osa, t.posl, true);
    };
    kontejner.addEventListener('pointerup', konec);
    kontejner.addEventListener('pointercancel', konec);

    function prepni(co, h) {
      stav[co] = h;
      if (co === 'hrany') { s.skupina.traverse(ob => { if (ob.userData.hrany) ob.visible = h; }); s.prekresli(); return; }
      if (co === 'pruhledne') { pruhlednost(); return; }
      if (co === 'uchyty') { if (uchytyG) uchytyG.visible = h; for (const u of Object.values(uchyty)) u.el.hidden = !h; s.prekresli(); return; }
      obnov();   // převisy, pravítka
    }
    return {
      nastavDily, prepni, stav,
      pohled: jak => s.pohled(jak === 'izo' ? 'iso' : jak),
      prekresli: s.prekresli,
      uhly(viko, chlopen) { stav.viko = viko; stav.chlopen = chlopen; s.prekresli(); },
      rez(osa, podil) { stav.rez = osa ? { osa, podil } : null; nastavRez(); },
      pruhledne(v) { prepni('pruhledne', v); },
      zobrazUchyty(v) { prepni('uchyty', v); },
      barvy(cara, cara2, hrana) { s.barvy(cara, cara2, hrana); s.skupina.traverse(ob => { if (ob.userData.hrany) ob.material.color.copy(s.matHrany.color); }); },
      tahne: () => !!tah,
      png: s.png, snimekPNG: s.png,
      // pro testy: střed úchytu v pixelech plátna
      poziceUchytu(osa) {
        const u = uchyty[osa]; if (!u) return null;
        s.snimek();
        v3.copy(u.bod).project(s.kamera);
        const r = s.platno.getBoundingClientRect();
        return { x: r.left + (v3.x + 1) / 2 * r.width, y: r.top + (1 - v3.y) / 2 * r.height };
      },
    };
  }

  /* ---------- malý prohlížeč dílů (měrka vůlí, zkušební chlopně): podložka, díly v tiskové poloze, popisky ----------
     zobraz([{poz, idx, barva}], [{bod: [x, y, z], text, zvyraznit}]) */
  function vytvorProhlizec(kontejner) {
    const s = G3D.scena(kontejner, { odstup: 0.9, popis: 'Náhled dílů v tiskové poloze – táhnutím otáčíte, kolečkem přibližujete' });
    const vrstva = document.createElement('div'); vrstva.className = 'popisky3d'; kontejner.appendChild(vrstva);
    let popisky = [];
    const v = new THREE.Vector3();
    s.scena.onBeforeRender = () => {
      const w = kontejner.clientWidth, h = kontejner.clientHeight;
      for (const p of popisky) {
        v.set(...p.bod).project(s.kamera);
        p.el.style.transform = `translate(-50%, -100%) translate(${(v.x + 1) / 2 * w}px, ${(1 - v.y) / 2 * h - 6}px)`;
      }
    };
    function zobraz(dily, novePopisky) {
      s.vycisti();
      const box = new THREE.Box3();
      for (const d of dily) {
        const g = s.geometrie(d.poz, d.idx, { uhel: 28 });
        const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: d.barva || 0x4f86d9, roughness: 0.5, metalness: 0.05 }));
        m.userData.vlastniMat = true;
        s.skupina.add(m, s.hrany(d.poz, d.idx, 28));
        g.computeBoundingBox(); box.union(g.boundingBox);
      }
      // podložka tiskárny jako mřížka 10 mm pod díly
      const vel = box.getSize(new THREE.Vector3()), stred = box.getCenter(new THREE.Vector3());
      const rozmer = Math.max(vel.x, vel.y, vel.z, 10), n = Math.ceil(rozmer * 1.6 / 10) * 2;
      const mriz = new THREE.GridHelper(n * 10 / 2, n / 2, 0x888888, 0x888888);
      mriz.rotation.x = Math.PI / 2; mriz.position.set(stred.x, stred.y, 0);
      mriz.material.transparent = true; mriz.material.opacity = 0.35; mriz.userData.model = false;
      s.skupina.add(mriz);
      vrstva.innerHTML = '';
      popisky = (novePopisky || []).map(p => {
        const el = document.createElement('div'); el.className = 'kota' + (p.zvyraznit ? ' zvyraznena' : ''); el.textContent = p.text;
        vrstva.appendChild(el); return { bod: p.bod, el };
      });
      // zepředu a mírně shora – otvory měrky jsou vidět čelně a popisky se nepřekrývají
      const pohled = () => s.pohled({ azimut: -Math.PI / 2 - 0.25, elevace: 0.42 }, box);
      pohled(); requestAnimationFrame(pohled);   // okno se právě otevřelo – po změně velikosti ještě jednou
    }
    return { zobraz, prekresli: s.prekresli };
  }

  window.KPANT_NAHLED = { vytvorNahled, vytvorProhlizec, fmt };
})();
