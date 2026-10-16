/* Modelář 3D – zobrazení těles ve 3D scéně.
   Drží objekty three.js ve shodě s dokumentem (M.app.dok): vytváří, mění
   a ruší je, sdílí geometrii mezi uzly se stejným tvarem (počítání odkazů),
   zvýrazňuje výběr a hledá těleso pod kurzorem. Díra se kreslí
   poloprůhledně šedě jako v Tinkercadu.
   Skupiny počítá worker (M.spocitejSkupinu); dokud nový výsledek nedorazí,
   zůstává vidět předchozí geometrie (o.zobrazenyKlic), takže nic nebliká.
   Objekt drží odkaz na požadovanou geometrii (o.klic) a navíc na zobrazenou,
   pokud se liší. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  M.vytvorTelesa = function (S) {
    const objekty = new Map();          // id → {skupina, mesh, hrany, ram, klic, uzel}
    const geometrie = new Map();        // klíč → {geom, hrany, odkazu}

    /** Obrysové hrany tělesa (čáry). U obřích sítí se nestaví – EdgesGeometry milionu trojúhelníků
        zablokuje hlavní vlákno na sekundy a čáry by stejně splynuly. Bez geometrie (díl selhal) prázdné. */
    const MAX_TROJ_HRANY = 300000;
    function naplnHrany(cil, geom) {
      const p = geom.getAttribute('position');
      if (!p || p.count / 3 > MAX_TROJ_HRANY) { cil.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3)); return cil; }
      const e = new THREE.EdgesGeometry(geom, 25);
      cil.setAttribute('position', e.getAttribute('position'));
      cil.computeBoundingSphere();
      e.dispose();
      return cil;
    }
    const hranyZ = geom => naplnHrany(new THREE.BufferGeometry(), geom);

    /** Spustí výpočet geometrie skupiny / dílu ve workeru; výsledek (nebo chybu) zapíše do g. */
    function spust(gg, klic, uzel) {
      M.spocitejSkupinu(uzel).then(d => {
        gg.geom.setAttribute('position', new THREE.BufferAttribute(d.pozice, 3));
        gg.geom.setAttribute('normal', new THREE.BufferAttribute(d.normaly, 3));
        if (d.barvy) gg.geom.setAttribute('color', new THREE.BufferAttribute(d.barvy, 3));
        gg.geom.computeBoundingBox(); gg.geom.computeBoundingSphere();
        naplnHrany(gg.hrany, gg.geom);
        Object.assign(gg, { trojuhelniku: d.trojuhelniku, objem: d.objem, ceka: false });
        T.hotovaGeometrie(klic);
      }, err => {
        // zůstane náhled z plných dílů a stavový řádek ukáže chybu
        Object.assign(gg, { ceka: false, chyba: String(err.message || err), casChyby: Date.now() });
        naplnHrany(gg.hrany, gg.geom);
        console.error('Modelář: výpočet skupiny selhal: ' + gg.chyba);
        M.vysli('chybaVypoctu', gg.chyba);
        T.hotovaGeometrie(klic);
      });
    }

    function ziskejGeometrii(klic, uzel) {
      let g = geometrie.get(klic);
      if (!g && M.pocitaWorker(uzel)) {
        g = { geom: new THREE.BufferGeometry(), hrany: new THREE.BufferGeometry(), odkazu: 0, trojuhelniku: 0, ceka: true, chyba: null };
        geometrie.set(klic, g);
        const gg = g;
        // hned náhled z plných dílů (díry neodečtené), aby místo nebylo prázdné
        if (uzel.druh === 'skupina') try {
          const n = M.zobrazovaciData(M.nahradniSitSkupiny(uzel), 30);
          gg.geom.setAttribute('position', new THREE.BufferAttribute(n.pozice, 3));
          gg.geom.setAttribute('normal', new THREE.BufferAttribute(n.normaly, 3));
          gg.geom.computeBoundingBox(); gg.geom.computeBoundingSphere();
        } catch (e) { /* náhled je jen pomůcka */ }
        spust(gg, klic, uzel);
      } else if (g && g.chyba && /paměti/.test(g.chyba) && Date.now() - (g.casChyby || 0) > 3000 && M.pocitaWorker(uzel)) {
        // nedostatek paměti bývá přechodný (worker se restartoval): při dalším použití zkusit znovu
        Object.assign(g, { ceka: true, chyba: null });
        spust(g, klic, uzel);
      }
      if (!g) {
        const sit = M.sitUzlu(uzel);
        let geom;
        const b = M.barvySite(uzel);
        if (b) {
          // importovaný model s barvami ze souboru (3MF, OBJ + MTL): barvy po vrcholech
          const d = M.zobrazovaciData(sit, 30, b.barvyTroj, b.paleta);
          geom = new THREE.BufferGeometry();
          geom.setAttribute('position', new THREE.BufferAttribute(d.pozice, 3));
          geom.setAttribute('normal', new THREE.BufferAttribute(d.normaly, 3));
          geom.setAttribute('color', new THREE.BufferAttribute(d.barvy, 3));
          geom.computeBoundingBox(); geom.computeBoundingSphere();
        } else geom = M.geometrieProZobrazeni(sit, 30);
        g = { geom, hrany: hranyZ(geom), odkazu: 0, trojuhelniku: sit.idx.length / 3 };
        geometrie.set(klic, g);
      }
      g.odkazu++;
      return g;
    }
    function uvolniGeometrii(klic) {
      const g = geometrie.get(klic);
      if (!g || --g.odkazu > 0) return;
      g.geom.dispose(); g.hrany.dispose();
      geometrie.delete(klic);
    }

    const ramGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const matRam = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9, depthTest: false });
    const matHrany = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
    const matHranyVyber = new THREE.LineBasicMaterial({ depthTest: true });
    const matHranyDira = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7 });

    function materialTelesa(barva) {
      return new THREE.MeshStandardMaterial({
        color: barva, roughness: 0.62, metalness: 0.0,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      });
    }
    /** Materiál podle uzlu: díra, barevná skupina (barvy po vrcholech), jinak barva. */
    function materialPro(u) {
      if (u.role === 'dira') return materialDiry();
      if ((u.druh === 'skupina' && u.barevne) || M.barvySite(u)) {
        const m = materialTelesa('#ffffff'); m.vertexColors = true; return m;
      }
      return materialTelesa(u.barva);
    }
    const druhMaterialu = u => u.role === 'dira' ? 'dira' : ((u.druh === 'skupina' && u.barevne) || M.barvySite(u) ? 'barevny' : 'barva');

    function materialDiry() {
      return new THREE.MeshStandardMaterial({
        color: M.svetlaScena() ? 0x8f99a6 : 0xaab3bf, roughness: 0.8, transparent: true, opacity: 0.38,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      });
    }

    function vytvor(u) {
      const klic = M.klicGeometrie(u);
      const g = ziskejGeometrii(klic, u);
      const skupina = new THREE.Group();
      skupina.matrixAutoUpdate = false;
      const mesh = new THREE.Mesh(g.geom, materialPro(u));
      mesh.userData.id = u.id;
      const hrany = new THREE.LineSegments(g.hrany, matHrany);
      hrany.raycast = () => {};
      const ram = new THREE.LineSegments(ramGeom, matRam);
      ram.raycast = () => {};
      ram.renderOrder = 3;
      ram.visible = false;
      skupina.add(mesh, hrany, ram);
      S.model.add(skupina);
      return { skupina, mesh, hrany, ram, klic, zobrazenyKlic: klic, uzel: null };
    }

    /** Zobrazí požadovanou geometrii, jakmile je hotová (do té doby zůstává stará). */
    function zobraz(o) {
      const g = geometrie.get(o.klic);
      if (!g || (g.ceka && o.zobrazenyKlic && o.zobrazenyKlic !== o.klic)) return;
      if (o.zobrazenyKlic && o.zobrazenyKlic !== o.klic) uvolniGeometrii(o.zobrazenyKlic);
      o.zobrazenyKlic = o.klic;
      o.mesh.geometry = g.geom;
      o.hrany.geometry = g.hrany;
    }

    function aktualizuj(o, u, vybrany) {
      const klic = M.klicGeometrie(u);
      if (klic !== o.klic) {
        // dosud požadovaná, ale nezobrazená geometrie už není potřeba
        if (o.klic !== o.zobrazenyKlic) uvolniGeometrii(o.klic);
        // návrat ke zobrazené geometrii (Zpět, Esc dřív, než výpočet doběhl): odkaz už drží, nový nebrat
        if (klic !== o.zobrazenyKlic) ziskejGeometrii(klic, u);
        o.klic = klic;
        zobraz(o);
      }
      if (!o.uzel || druhMaterialu(o.uzel) !== druhMaterialu(u)) {
        o.mesh.material.dispose();
        o.mesh.material = materialPro(u);
      } else if (druhMaterialu(u) === 'barva' && o.uzel.barva !== u.barva) {
        o.mesh.material.color.set(u.barva);
      }
      M.maticeUzlu(u, o.skupina.matrix);
      o.skupina.matrixWorldNeedsUpdate = true;
      o.skupina.visible = !u.skryto;
      // rámeček je v přirozených souřadnicích (matice skupiny už nese měřítko)
      const k = M.meritkoUzlu(u);
      o.ram.scale.set(...u.rozmer.map((v, i) => (v + 0.02) / k[i]));
      o.ram.visible = vybrany;
      o.hrany.material = vybrany ? matHranyVyber : (u.role === 'dira' ? matHranyDira : matHrany);
      o.uzel = u;
    }

    const T = {
      /** Srovná scénu s dokumentem a výběrem. */
      sync() {
        const dok = M.app.dok, vyber = new Set(M.app.vyber);
        const ids = new Set();
        for (const u of dok.uzly) {
          ids.add(u.id);
          let o = objekty.get(u.id);
          if (!o) { o = vytvor(u); objekty.set(u.id, o); }
          if (o.uzel !== u || o.vybrany !== vyber.has(u.id)) {
            aktualizuj(o, u, vyber.has(u.id));
            o.vybrany = vyber.has(u.id);
          }
        }
        for (const [id, o] of objekty) {
          if (ids.has(id)) continue;
          S.model.remove(o.skupina);
          o.mesh.material.dispose();
          uvolniGeometrii(o.klic);
          if (o.zobrazenyKlic && o.zobrazenyKlic !== o.klic) uvolniGeometrii(o.zobrazenyKlic);
          objekty.delete(id);
        }
        M.prekresli();
      },

      /** Těleso pod pixelem: {id, bod, normala} nebo null (skrytá se přeskočí). */
      zasah(px, py) {
        const ray = new THREE.Raycaster();
        ray.ray.copy(S.kamera.paprsek(px, py));
        const meshe = [];
        for (const o of objekty.values()) if (o.skupina.visible) meshe.push(o.mesh);
        S.model.updateMatrixWorld();
        const z = ray.intersectObjects(meshe, false)[0];
        if (!z) return null;
        // normálu inverzní transpozicí (skupina, import, skica a díl mají nerovnoměrné měřítko – transformDirection
        // by ji u roztaženého tělesa odklonila až o desítky stupňů)
        const n = z.face ? z.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(z.object.matrixWorld)).normalize() : new THREE.Vector3(0, 0, 1);
        return { id: z.object.userData.id, bod: z.point, normala: n, trojuhelnik: z.faceIndex };
      },

      /** Zakrývá něco světové body? Pro každý bod true, když paprsek z kamery k němu narazí na
          viditelné těleso dřív než tol mm před bodem (hrana za stěnou). Body mimo obraz = false. */
      zakryte(body, tol = 0.2) {
        const ray = new THREE.Raycaster();
        const meshe = [];
        for (const o of objekty.values()) if (o.skupina.visible) meshe.push(o.mesh);
        S.model.updateMatrixWorld();
        return body.map(b => {
          const p = S.naObrazovku(b);
          if (!p) return false;
          ray.ray.copy(S.kamera.paprsek(p[0], p[1]));
          const d = b.clone().sub(ray.ray.origin).dot(ray.ray.direction);
          if (!(d > tol)) return false;
          ray.near = 0; ray.far = d - tol;
          return ray.intersectObjects(meshe, false).length > 0;
        });
      },

      /** Světová síť zobrazeného tělesa {poz, idx} (z dat pro zobrazení: funguje i pro skupiny a díly). */
      svetovaSit(id) {
        const o = objekty.get(id);
        if (!o) return null;
        const p = o.mesh.geometry.getAttribute('position');
        if (!p) return null;
        const e = o.skupina.matrix.elements, a = p.array, poz = new Float32Array(a.length);
        for (let i = 0; i < a.length; i += 3)
          for (let k = 0; k < 3; k++) poz[i + k] = e[k] * a[i] + e[4 + k] * a[i + 1] + e[8 + k] * a[i + 2] + e[12 + k];
        const idx = new Uint32Array(a.length / 3);
        for (let i = 0; i < idx.length; i++) idx[i] = i;
        // zrcadlené těleso: otočit pořadí, ať normály míří ven
        if (o.skupina.matrix.determinant() < 0) for (let i = 0; i < idx.length; i += 3) { const x = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = x; }
        return { poz, idx };
      },

      /** Pixelová obálka tělesa (pro výběr obdélníkem): [x0, y0, x1, y1] nebo null. */
      obalkaNaObrazovce(id) {
        const o = objekty.get(id);
        if (!o || !o.skupina.visible) return null;
        const km = M.meritkoUzlu(o.uzel);
        const k = S.kamera.aktivni(), h = o.uzel.rozmer.map((v, i) => v / 2 / km[i]);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const v = new THREE.Vector3();
        for (let i = 0; i < 8; i++) {
          v.set(i & 1 ? h[0] : -h[0], i & 2 ? h[1] : -h[1], i & 4 ? h[2] : -h[2]).applyMatrix4(o.skupina.matrix).project(k);
          if (v.z > 1 || v.z < -1) continue;                 // roh za kamerou: promítnutí by obálku převrátilo
          const x = (v.x + 1) / 2 * S.kamera.sirka, y = (1 - v.y) / 2 * S.kamera.vyska;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        return x0 === Infinity ? null : [x0, y0, x1, y1];
      },

      /** Motiv webu se změnil: barvy rámečků a děr. */
      motiv() {
        const akc = M.barvaCss('--accent', '#6aa6fd');
        matRam.color.set(akc);
        matHranyVyber.color.set(akc);
        matHranyDira.color.set(M.svetlaScena() ? 0x5d6672 : 0xc4ccd6);
        for (const o of objekty.values()) if (o.uzel && o.uzel.role === 'dira') {
          o.mesh.material.dispose(); o.mesh.material = materialDiry();
        }
        M.prekresli();
      },

      /** Výsledek výpočtu dorazil: objekty, které na něj čekají, ho zobrazí. */
      hotovaGeometrie(klic) {
        for (const o of objekty.values()) if (o.klic === klic) zobraz(o);
        M.vysli('geometrie', klic);
        M.prekresli();
      },

      /** Statistika pro testy a stavový řádek. */
      info() {
        let troj = 0, ceka = 0;
        const chyby = [];
        for (const o of objekty.values()) {
          const g = geometrie.get(o.zobrazenyKlic) || geometrie.get(o.klic);
          if (g) troj += g.trojuhelniku;
          const gk = geometrie.get(o.klic);
          if (gk && gk.ceka) ceka++;
          if (gk && gk.chyba) chyby.push(gk.chyba);
        }
        return { objektu: objekty.size, geometrii: geometrie.size, trojuhelniku: troj, ceka, chyby };
      },
      /** Data geometrie objektu (pro testy): objem skupiny, počet trojúhelníků, barvy. */
      geometrieObjektu(id) {
        const o = objekty.get(id);
        const g = o && geometrie.get(o.klic);
        return g ? { trojuhelniku: g.trojuhelniku, objem: g.objem, ceka: !!g.ceka, chyba: g.chyba,
                     zobrazena: o.zobrazenyKlic === o.klic, barvy: !!g.geom.getAttribute('color'),
                     vrcholu: g.geom.getAttribute('position') ? g.geom.getAttribute('position').count : 0 } : null;
      },

      // náhled při přetahování z knihovny (poloprůhledný, mimo dokument)
      nahled: null,
      ukazNahled(uzel) {
        if (!uzel) {
          if (T.nahled) {
            S.scena.remove(T.nahled.mesh); T.nahled.mesh.material.dispose();
            if (T.nahled.vlastni) T.nahled.mesh.geometry.dispose(); else uvolniGeometrii(T.nahled.klic);
            T.nahled = null;
          }
          M.prekresli();
          return;
        }
        // díly a skici se počítají ve workeru: náhled je jejich obalový kvádr
        const box = M.pocitaWorker(uzel);
        // vlastní kvádr náhledu má jiný klíč než sdílená geometrie tvaru Kvádr (tu by dispose rozbil)
        const klic = box ? 'nahled-box|' + uzel.zaklad.join(',') : M.klicGeometrie(uzel);
        if (!T.nahled || T.nahled.klic !== klic) {
          T.ukazNahled(null);
          const g = box ? { geom: new THREE.BoxGeometry(...uzel.zaklad) } : ziskejGeometrii(klic, uzel);
          const mat = materialTelesa(uzel.barva);
          mat.transparent = true; mat.opacity = 0.6;
          const mesh = new THREE.Mesh(g.geom, mat);
          mesh.matrixAutoUpdate = false;
          mesh.raycast = () => {};
          S.scena.add(mesh);
          T.nahled = { mesh, klic, vlastni: box };
        }
        M.maticeUzlu(uzel, T.nahled.mesh.matrix);
        T.nahled.mesh.matrixWorldNeedsUpdate = true;
        M.prekresli();
      },
    };
    T.motiv();
    new MutationObserver(T.motiv).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    M.na('dokument', T.sync);
    M.na('vyber', T.sync);
    return T;
  };
})(MDL);
