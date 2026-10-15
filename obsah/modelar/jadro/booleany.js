/* Modelář 3D – booleovské operace skupin přes manifold-3d (bez DOM).
   Běží ve workeru, v hlavním vlákně (záloha) i v node testech; dostane
   načtený modul manifoldu (await Module(); w.setup()).
   Skupina: výsledek = sjednocení (nebo průnik) plných dětí − sjednocení děr;
   skupina samých děr = jejich sjednocení (a sama je díra). Vnořené skupiny
   se počítají rekurzivně ve svých přirozených souřadnicích a vloží se
   s maticí (včetně měřítka rozmer/zaklad). Výsledek je vždy vodotěsný.
   Barvy: každé dítě dostane vlastní originalID (asOriginal), výsledek nese
   runOriginalID → barva; nebarevná vnořená skupina vystupuje jednou barvou.
   Mezipaměť: Manifold objekty podle klíče podstromu (LRU, mazání přes delete()). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  M.vytvorBooleany = function (w, limitCache = 64) {
    const { Manifold, Mesh } = w;
    const cache = new Map();                 // klíč → {m: Manifold, barvy: Map(originalID → barva), diry: Set(originalID)}

    function zCache(klic) {
      const z = cache.get(klic);
      if (z) { cache.delete(klic); cache.set(klic, z); }   // naposledy použitý na konec
      return z;
    }
    // mezipaměť omezená i velikostí: 64 výsledků s milionem trojúhelníků by vyčerpalo 4 GB paměti WASM
    const MAX_TROJ_CACHE = 6e6;
    let trojVCache = 0;
    function doCache(klic, z) {
      z.troj = z.m.numTri ? z.m.numTri() : 0;
      cache.set(klic, z);
      trojVCache += z.troj;
      while (cache.size > 1 && (cache.size > limitCache || trojVCache > MAX_TROJ_CACHE)) {
        const [k, stary] = cache.entries().next().value;
        cache.delete(k);
        trojVCache -= stary.troj || 0;
        stary.m.delete();
      }
    }

    /** Síť {poz, idx} → Manifold (svaří shodné vrcholy, ověří stav). */
    function manifoldZeSite(sit) {
      const mesh = new Mesh({ numProp: 3, vertProperties: new Float32Array(sit.poz), triVerts: new Uint32Array(sit.idx) });
      mesh.merge();
      const m = new Manifold(mesh);
      if (m.status() !== 'NoError') { const st = m.status(); m.delete(); throw new Error('síť není uzavřená: ' + st); }
      return m;
    }

    /** Přirozená geometrie uzlu jako {m, barvy}; m patří volajícímu (smaže ho). */
    function prirozena(u) {
      if (M.maPrirozene(u)) {
        const klic = M.klicGeometrie(u);
        let z = zCache(klic);
        if (!z) {
          const m0 = u.druh === 'skica' ? M.manifoldSkici(w, u.param) : M.manifoldDilu(w, u.druh, u.param);
          const m1 = m0.translate([-u.stred[0], -u.stred[1], -u.stred[2]]); m0.delete();
          const m = m1.asOriginal(); m1.delete();
          z = { m, barvy: new Map([[m.originalID(), u.barva]]), diry: new Set() };
          doCache(klic, z);
        }
        // každá kopie vlastní originalID: stejné díly s různou barvou (nebo jeden jako díra) se v barevné skupině nepletou
        const c = z.m.translate([0, 0, 0]), m = c.asOriginal(); c.delete();
        return { m, barvy: new Map([[m.originalID(), u.barva]]), diry: new Set(u.role === 'dira' ? [m.originalID()] : []) };
      }
      if (u.druh !== 'skupina') {
        // importovaný model s barvami trojúhelníků (3MF, OBJ s MTL): každá barva vlastní původní id, ať je barevná
        // skupina (a export po barvách) zachová
        const bs = M.barvySite(u);
        if (bs && u.role !== 'dira') {
          const sit = M.sitUzlu(u), nt = sit.idx.length / 3, poradi = [];
          for (let i = 0; i < nt; i++) poradi.push(i);
          poradi.sort((a, b) => bs.barvyTroj[a] - bs.barvyTroj[b]);
          const tri = new Uint32Array(sit.idx.length), runy = [0], barvyRunu = [];
          poradi.forEach((t, j) => {
            tri[j * 3] = sit.idx[t * 3]; tri[j * 3 + 1] = sit.idx[t * 3 + 1]; tri[j * 3 + 2] = sit.idx[t * 3 + 2];
            if (j === 0 || bs.barvyTroj[t] !== bs.barvyTroj[poradi[j - 1]]) { if (j) runy.push(j * 3); barvyRunu.push(bs.paleta[bs.barvyTroj[t]] || u.barva); }
          });
          runy.push(tri.length);
          const id0 = Manifold.reserveIDs(barvyRunu.length);
          const mesh = new Mesh({ numProp: 3, vertProperties: new Float32Array(sit.poz), triVerts: tri,
            runIndex: new Uint32Array(runy), runOriginalID: new Uint32Array(barvyRunu.map((x, i) => id0 + i)) });
          mesh.merge();
          const m = new Manifold(mesh);
          if (m.status() === 'NoError') return { m, barvy: new Map(barvyRunu.map((b, i) => [id0 + i, b])), diry: new Set() };
          m.delete();
        }
        const m0 = manifoldZeSite(M.sitUzlu(u));
        const m = m0.asOriginal(); m0.delete();
        return { m, barvy: new Map([[m.originalID(), u.barva]]), diry: new Set(u.role === 'dira' ? [m.originalID()] : []) };
      }
      const klic = M.klicVypoctu(u);
      let z = zCache(klic);
      if (!z && u.occt) {
        // skupina s přesnou úpravou: síť dodalo přesné jádro (OCCT) přes registr zdrojů
        const sit = M.zdroje.get(M.klicOcct(u));
        if (!sit) throw new Error('přesná úprava „' + u.nazev + '“ ještě není spočítaná');
        const m0 = manifoldZeSite(sit);
        const m = m0.asOriginal(); m0.delete();
        z = { m, barvy: new Map([[m.originalID(), u.barva]]), diry: new Set() };
        doCache(klic, z);
      }
      if (!z) {
        z = spocitejSkupinu(u);
        doCache(klic, z);
      }
      // kopie, ať volající může mazat bez rozbití mezipaměti
      return { m: z.m.translate([0, 0, 0]), barvy: z.barvy, diry: z.diry };
    }

    /** Dítě umístěné ve skupině (matice dítěte), nebarevná skupina jednou barvou. */
    function umistene(d) {
      const p = prirozena(d);
      const m = p.m.transform(Array.from(M.maticeUzlu(d).elements));
      p.m.delete();
      if (d.druh === 'skupina' && !d.barevne) {
        const o = m.asOriginal(); m.delete();
        return { m: o, barvy: new Map([[o.originalID(), d.barva]]), diry: new Set(d.role === 'dira' ? [o.originalID()] : []) };
      }
      // barevná skupina jako díra: celá je jedna díra s vlastním id (stěny dostanou barvu tělesa, do kterého řežou;
      // sdílená id z mezipaměti by jinak označila za díru i stejnou skupinu použitou jako těleso)
      if (d.role === 'dira') { const o = m.asOriginal(); m.delete(); return { m: o, barvy: new Map([[o.originalID(), d.barva]]), diry: new Set([o.originalID()]) }; }
      return { m, barvy: p.barvy, diry: p.diry };
    }

    function spocitejSkupinu(g) {
      const plne = [], diry = [], barvy = new Map(), diraIds = new Set();
      try {
        for (const d of g.deti) {
          const x = umistene(d);
          for (const [k, v] of x.barvy) barvy.set(k, v);
          for (const k of x.diry) diraIds.add(k);
          (d.role === 'dira' ? diry : plne).push(x.m);
        }
        let m;
        if (!plne.length) m = Manifold.union(diry);
        else {
          const zaklad = g.operace === 'prunik' ? Manifold.intersection(plne) : Manifold.union(plne);
          if (diry.length) {
            const d = Manifold.union(diry);
            m = zaklad.subtract(d);
            zaklad.delete(); d.delete();
          } else m = zaklad;
        }
        return { m, barvy, diry: diraIds };
      } finally {
        for (const x of plne.concat(diry)) x.delete();
      }
    }

    /** Manifold → indexovaná síť {poz, idx}. */
    function sitZManifoldu(m) {
      const mesh = m.getMesh();
      const poz = new Float32Array(mesh.vertProperties.length / mesh.numProp * 3);
      for (let i = 0, j = 0; i < mesh.vertProperties.length; i += mesh.numProp, j += 3) {
        poz[j] = mesh.vertProperties[i]; poz[j + 1] = mesh.vertProperties[i + 1]; poz[j + 2] = mesh.vertProperties[i + 2];
      }
      return { poz, idx: new Uint32Array(mesh.triVerts) };
    }

    /** Plné části skupiny podle barev (přirozené souřadnice): Map barva → Manifold (patří volajícímu).
        Barevná vnořená skupina se rozloží rekurzivně, ostatní děti jsou jednou barvou. */
    function castiPodleBarev(g) {
      const mapa = new Map();
      const pridej = (barva, m) => {
        const s = mapa.get(barva);
        if (!s) { mapa.set(barva, m); return; }
        const u = Manifold.union([s, m]); s.delete(); m.delete();
        mapa.set(barva, u);
      };
      try {
        for (const d of g.deti) {
          if (d.role === 'dira') continue;
          const mat = Array.from(M.maticeUzlu(d).elements);
          if (d.druh === 'skupina' && d.barevne) {
            for (const [b, m] of castiPodleBarev(d)) { const t = m.transform(mat); m.delete(); pridej(b, t); }
          } else {
            const p = prirozena(d);
            const t = p.m.transform(mat); p.m.delete();
            pridej(d.barva, t);
          }
        }
      } catch (e) { for (const m of mapa.values()) m.delete(); throw e; }
      return mapa;
    }

    /** Skupina rozdělená podle barev na uzavřená, navzájem se nepřekrývající tělesa
        (pro vícebarevný tisk: každá barva = jeden objekt / jedno STL). Každá barva =
        její plné části ∩ výsledek skupiny (díry i průnik už v něm jsou) − barvy dřív v pořadí dětí.
        Vrací [{barva, sit, objem}] v přirozených souřadnicích skupiny. */
    function vysledekPodleBarev(g) {
      if (g.druh !== 'skupina' || !g.barevne) {
        const r = vysledekSkupiny(g);
        return [{ barva: g.barva, sit: r.sit, objem: r.objem }];
      }
      const celek = prirozena(g).m;
      let casti;
      try { casti = castiPodleBarev(g); } catch (e) { celek.delete(); throw e; }
      const out = [];
      let hotovo = null;
      try {
        for (const [barva, m] of casti) {
          let k = m.intersect(celek);
          if (hotovo) { const k2 = k.subtract(hotovo); k.delete(); k = k2; }
          const h = hotovo ? Manifold.union([hotovo, m]) : m.translate([0, 0, 0]);
          if (hotovo) hotovo.delete();
          hotovo = h;
          if (k.volume() > 1e-9) out.push({ barva, sit: sitZManifoldu(k), objem: k.volume() });
          k.delete();
        }
      } finally {
        for (const m of casti.values()) m.delete();
        if (hotovo) hotovo.delete();
        celek.delete();
      }
      return out;
    }

    /** Výsledek skupiny v přirozených souřadnicích:
        { sit: {poz, idx}, barvyTroj: Uint16Array (index do paleta), paleta: ['#…'], objem, prazdna }. */
    function vysledekSkupiny(g) {
      const p = prirozena(g);
      try {
        const mesh = p.m.getMesh();
        const poz = new Float32Array(mesh.vertProperties.length / mesh.numProp * 3);
        for (let i = 0, j = 0; i < mesh.vertProperties.length; i += mesh.numProp, j += 3) {
          poz[j] = mesh.vertProperties[i]; poz[j + 1] = mesh.vertProperties[i + 1]; poz[j + 2] = mesh.vertProperties[i + 2];
        }
        const idx = new Uint32Array(mesh.triVerts);
        const nt = idx.length / 3;
        const paleta = [], kde = new Map();
        const barvyTroj = new Uint16Array(nt);
        const runy = mesh.runIndex, puvod = mesh.runOriginalID;
        const index = b => { if (!kde.has(b)) { kde.set(b, paleta.length); paleta.push(b); } return kde.get(b); };
        // stěny vyříznuté dírou dostanou barvu plné části, ve které leží (díra barvu nemá)
        const plne = (g.deti || []).filter(d => d.role !== 'dira').map(d => ({ o: M.obalkaUzlu(d), b: d.barva }));
        const barvaVBode = (x, y, z) => {
          for (const c of plne) if (x >= c.o.min[0] - 1e-3 && x <= c.o.max[0] + 1e-3 && y >= c.o.min[1] - 1e-3
            && y <= c.o.max[1] + 1e-3 && z >= c.o.min[2] - 1e-3 && z <= c.o.max[2] + 1e-3) return c.b;
          return plne.length ? plne[0].b : g.barva;
        };
        for (let r = 0; r < puvod.length; r++) {
          const zDiry = p.diry.has(puvod[r]);
          const b = p.barvy.get(puvod[r]) || g.barva;
          for (let t = runy[r] / 3; t < runy[r + 1] / 3; t++) {
            if (!zDiry) { barvyTroj[t] = index(b); continue; }
            const a = idx[t * 3] * 3, c = idx[t * 3 + 1] * 3, e = idx[t * 3 + 2] * 3;
            barvyTroj[t] = index(barvaVBode((poz[a] + poz[c] + poz[e]) / 3, (poz[a + 1] + poz[c + 1] + poz[e + 1]) / 3, (poz[a + 2] + poz[c + 2] + poz[e + 2]) / 3));
          }
        }
        return { sit: { poz, idx }, barvyTroj, paleta, objem: p.m.volume(), prazdna: nt === 0 };
      } finally {
        p.m.delete();
      }
    }

    return {
      vysledekSkupiny,
      vysledekPodleBarev,
      /** Vyčistí mezipaměť (uvolní paměť WASM). */
      vycisti() { for (const z of cache.values()) z.m.delete(); cache.clear(); trojVCache = 0; },
      velikostCache: () => cache.size,
    };
  };

  /** Náhradní síť skupiny bez manifoldu: plné díly vedle sebe (díry neodečtené).
      Ukazuje se, než dorazí výsledek, a když výpočet selže. Není vodotěsná v průnicích. */
  M.nahradniSitSkupiny = function (g) {
    const poz = [], idx = [];
    const pridej = (u, matice) => {
      if (u.druh === 'skupina') {
        const m = matice.clone().multiply(M.maticeUzlu(u));
        for (const d of M.plneDeti(u)) pridej(d, m);
        return;
      }
      if (M.maPrirozene(u)) return;                      // skica a díly se bez manifoldu nespočítají
      const sit = M.sitUzlu(u), m = matice.clone().multiply(M.maticeUzlu(u));
      const zac = poz.length / 3, v = new THREE.Vector3(), otoc = m.determinant() < 0;
      for (let i = 0; i < sit.poz.length; i += 3) poz.push(...v.set(sit.poz[i], sit.poz[i + 1], sit.poz[i + 2]).applyMatrix4(m).toArray());
      for (let i = 0; i < sit.idx.length; i += 3)
        idx.push(zac + sit.idx[i], zac + sit.idx[otoc ? i + 2 : i + 1], zac + sit.idx[otoc ? i + 1 : i + 2]);
    };
    for (const d of M.plneDeti(g)) pridej(d, new THREE.Matrix4());
    return { poz: new Float32Array(poz), idx: new Uint32Array(idx) };
  };

  /** Data pro zobrazení (neindexovaná, normály se zlomem, volitelně barvy po vrcholech). */
  M.zobrazovaciData = function (sit, uhel = 30, barvyTroj = null, paleta = null) {
    const g = M.geometrieProZobrazeni(sit, uhel);
    const pozice = g.getAttribute('position').array, normaly = g.getAttribute('normal').array;
    let barvy = null;
    if (barvyTroj && paleta) {
      const c = paleta.map(b => new THREE.Color(b));
      barvy = new Float32Array(pozice.length);
      for (let t = 0; t < barvyTroj.length; t++) {
        const k = c[barvyTroj[t]];
        for (let v = 0; v < 3; v++) { const o = (t * 3 + v) * 3; barvy[o] = k.r; barvy[o + 1] = k.g; barvy[o + 2] = k.b; }
      }
    }
    g.dispose();
    return { pozice, normaly, barvy };
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
