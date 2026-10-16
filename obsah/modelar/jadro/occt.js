/* Modelář 3D – přesné jádro OpenCascade (occt-wasm), bez DOM (worker i node).
   M.vytvorOcct(m) – m = modul occt-wasm (surové embind API). Vrací funkce:
     brep(uzel, site)       – objem přesného tělesa uzlu
     hrany(uzel, site)      – hrany pro výběr: [{stred, delka, body}] (body = lomená čára)
     plochy(uzel, site)     – rovinné plochy: [{stred, normala, plocha}]
     sitUzlu(uzel, site)    – trojúhelníková síť přesného tělesa (svařená, vodotěsná)
     step(polozky)          – STEP z [{uzel, matice (12 čísel řádkově), site, sit?}]
     importStep(text)       – {sit} z textu STEP
   site = { klicGeometrie → {poz, idx} } pro uzly, které OCCT neumí postavit samo
   (skica, díly, importované sítě – jejich síť dodá hlavní vlákno z manifoldu).
   Tělesa: analyticky kvádr (i se zaoblením), válec, koule, kužel, trubka, torus,
   polokoule, kapsle (nerovnoměrné měřítko přes generalTransform); jinak z rovinných
   ploch sítě (koplanární trojúhelníky sjednocené clipperem, sešité do tělesa –
   do 6000 trojúhelníků). Skupina = booleany OCCT; skupina s polem occt = zaoblení,
   sražení nebo skořepina vybraných hran / ploch (hledají se geometricky: střed + délka,
   resp. střed + normála), takže úprava přežije posun i změnu měřítka skupiny. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const PI = Math.PI;
  const MAX_TROJ_PLOCH = 6000;
  const MAX_TROJ_STEP = 12000;
  let proStep = false;                         // brep se staví pro export STEP (jiná hláška u velké sítě)                 // síť jako trojúhelníky do STEP: nejvýš ~60 MB

  M.vytvorOcct = function (m) {
    const k = new m.OcctKernel();
    const vec32 = a => { const v = new m.VectorUint32(); for (const x of a) v.push_back(x); return v; };
    const vecD = a => { const v = new m.VectorDouble(); for (const x of a) v.push_back(x); return v; };
    const pole = v => { const o = []; for (let i = 0; i < v.size(); i++) o.push(v.get(i)); v.delete(); return o; };
    const zprava = e => {
      if (m.getExceptionMessage) { try { return m.getExceptionMessage(e)[1]; } catch (x) { /* nic */ } }
      return String(e && e.message || e);
    };
    /** Zavolá OCCT a přeloží výjimku WebAssembly na čitelnou chybu. */
    // chyba pro uživatele bez technických hlášek jádra (ty jdou jen do konzole)
    const occC = (popis, f) => { try { return f(); } catch (e) { console.warn('OpenCascade:', zprava(e)); throw new Error(popis); } };
    const occ = (popis, f) => { try { return f(); } catch (e) { throw new Error(popis + ': ' + zprava(e)); } };
    const PRAZDNE = 'výsledek je prázdný – těleso je na přesné jádro příliš tenké nebo malé (zvětši stěnu či rozměr)';

    /** THREE.Matrix4 → 12 čísel 3×4 po řádcích (formát occt-wasm). */
    const radky = mat => { const e = mat.elements; return [e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]]; };
    /** Převede těleso maticí: tuhá → transform (přesné), jinak generalTransform. */
    function preved(id, mat) {
      const e = mat.elements;
      const sl = [0, 1, 2].map(c => Math.hypot(e[c * 4], e[c * 4 + 1], e[c * 4 + 2]));
      // tuhá nebo podobnost (stejné měřítko ve všech osách) → transform: roviny zůstanou rovinami, úsečky
      // úsečkami (generalTransform dělá ze všeho B-spline, na kterém pak selžou zaoblení i záložní postupy)
      // (rozdíl pod 1e-6 je zaokrouhlení rozměru na miliontiny, ne skutečné nerovnoměrné zvětšení)
      const stejne = sl.every(x => Math.abs(x - sl[0]) < 1e-6 * Math.max(1, sl[0]));
      if (stejne && sl.some(x => x !== sl[0])) {
        // srovnat na průměrné měřítko – transform chce přesnou podobnost
        const s0 = (sl[0] + sl[1] + sl[2]) / 3, m2 = mat.clone(), e2 = m2.elements;
        for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) e2[c * 4 + r] *= s0 / sl[c];
        return preved(id, m2);
      }
      // zrcadlení se stejným měřítkem: nejdřív přesné zrcadlo přes rovinu x = 0, pak zbytek jako podobnost
      if (stejne && mat.determinant() < 0) {
        const z = occ('zrcadlení', () => k.mirror(id, 0, 0, 0, 1, 0, 0));
        return preved(z, mat.clone().multiply(new THREE.Matrix4().makeScale(-1, 1, 1)));
      }
      const podobnost = stejne && mat.determinant() > 0;
      const v = vecD(radky(mat));
      try { return occ('transformace', () => podobnost ? k.transform(id, v) : k.generalTransform(id, v)); } finally { v.delete(); }
    }
    const meritko = (id, sx, sy, sz) => preved(id, new THREE.Matrix4().makeScale(sx, sy, sz));
    const posun = (id, x, y, z) => preved(id, new THREE.Matrix4().makeTranslation(x, y, z));

    // ------------------------------------------------------------ síť → těleso z rovinných ploch
    /** Těleso ze sítě: koplanární trojúhelníky = jedna plocha (s otvory), sešité do tělesa. */
    let zeSite = 0;              // kolik těles se při stavbě postavilo z trojúhelníků sítě (filtr mělkých hran)
    function zRovinnychPloch(sit, nazev) {
      zeSite++;
      const p = sit.poz, idx = sit.idx, nt = idx.length / 3;
      if (nt > MAX_TROJ_PLOCH) throw new Error(`${nazev || 'tvar'} je pro přesnou úpravu příliš složitý (${nt} trojúhelníků, nejvýš ${MAX_TROJ_PLOCH})`);
      const CL = globalThis.ClipperLib, S = 1e5;
      const V = (i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
      const shluky = new Map();
      for (let f = 0; f < nt; f++) {
        const a = V(idx[f * 3]), b = V(idx[f * 3 + 1]), c = V(idx[f * 3 + 2]);
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
        const l = Math.hypot(...n);
        // jehlicovitý trojúhelník (earcut + zaokrouhlení na float32 mu může otočit normálu): vynechat,
        // jinak by tvořil vlastní „plochu“ s opačnou normálou a sešití by se rozpadlo
        const e2 = Math.max(u[0] * u[0] + u[1] * u[1] + u[2] * u[2], w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);
        if (l < 1e-12 || l < 1e-7 * e2) continue;
        n = n.map(x => x / l);
        const d = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
        // přísná tolerance: na zakřivené ploše musí být každý trojúhelník zvlášť, jinak drát není rovinný
        const klic = n.map(x => Math.round(x * 1e6)).join(',') + '|' + Math.round(d * 1e4);
        let s = shluky.get(klic);
        if (!s) shluky.set(klic, s = { n, d, troj: [] });
        s.troj.push(f);
      }
      const plochy = [];
      for (const s of shluky.values()) {
        // báze roviny; body 2D na celá čísla, zpětné mapování na přesné vrcholy sítě
        const n = s.n;
        let u = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        const dot = u[0] * n[0] + u[1] * n[1] + u[2] * n[2];
        u = [u[0] - n[0] * dot, u[1] - n[1] * dot, u[2] - n[2] * dot];
        const lu = Math.hypot(...u); u = u.map(x => x / lu);
        const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
        const zpet = new Map();
        const do2 = i => {
          const q = V(i), pt = { X: Math.round((q[0] * u[0] + q[1] * u[1] + q[2] * u[2]) * S), Y: Math.round((q[0] * v[0] + q[1] * v[1] + q[2] * v[2]) * S) };
          zpet.set(pt.X + ',' + pt.Y, q);
          return pt;
        };
        const c = new CL.Clipper();
        c.PreserveCollinear = true;                        // ponechat všechny vrcholy: sousední plochy pak na hranách sedí
        for (const f of s.troj) {
          const t = [do2(idx[f * 3]), do2(idx[f * 3 + 1]), do2(idx[f * 3 + 2])];
          if (CL.Clipper.Area(t) < 0) t.reverse();
          c.AddPath(t, CL.PolyType.ptSubject, true);
        }
        const strom = new CL.PolyTree();
        c.Execute(CL.ClipType.ctUnion, strom, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
        const doDrat = obrys => {
          // bod, který clipper vymyslel (průsečík hran po zaokrouhlení), nemá předlohu: zpět do roviny plochy
          const dRov = s.d;
          const body = obrys.map(pt => zpet.get(pt.X + ',' + pt.Y) || [0, 1, 2].map(i => n[i] * dRov + u[i] * pt.X / S + v[i] * pt.Y / S));
          const hrany = [];
          for (let i = 0; i < body.length; i++) {
            const a = body[i], b = body[(i + 1) % body.length];
            if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-9) continue;
            hrany.push(occ('hrana', () => k.makeLineEdge(a[0], a[1], a[2], b[0], b[1], b[2])));
          }
          const vh = vec32(hrany);
          try { return occ('drát', () => k.makeWire(vh)); } finally { vh.delete(); }
        };
        const pridej = uzel => {
          let face = occ('plocha', () => k.makeFace(doDrat(uzel.Contour())));
          const diry = uzel.Childs().map(d => doDrat(d.Contour()));
          if (diry.length) { const vd = vec32(diry); try { face = occ('otvory plochy', () => k.addHolesInFace(face, vd)); } finally { vd.delete(); } }
          plochy.push(face);
          for (const d of uzel.Childs()) for (const ostrov of d.Childs()) pridej(ostrov);
        };
        const pred = plochy.length;
        try { for (const vnejsi of strom.Childs()) pridej(vnejsi); }
        catch (e) {
          // spojená plocha nejde postavit (degenerovaný obrys po zaokrouhlení): plochu po trojúhelnících
          console.warn('OpenCascade (plocha po trojúhelnících):', e.message);
          plochy.length = pred;
          for (const f of s.troj) {
            const a = V(idx[f * 3]), b = V(idx[f * 3 + 1]), c3 = V(idx[f * 3 + 2]);
            if (Math.hypot(...[0, 1, 2].map(i => (b[(i + 1) % 3] - a[(i + 1) % 3]) * (c3[(i + 2) % 3] - a[(i + 2) % 3]) - (b[(i + 2) % 3] - a[(i + 2) % 3]) * (c3[(i + 1) % 3] - a[(i + 1) % 3]))) < 1e-12) continue;
            const hr = [[a, b], [b, c3], [c3, a]].map(([p0, p1]) => occC('plocha tělesa nejde postavit', () => k.makeLineEdge(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2])));
            const vh = vec32(hr);
            try { plochy.push(occC('plocha tělesa nejde postavit', () => k.makeFace(k.makeWire(vh)))); } finally { vh.delete(); }
          }
        }
      }
      const vp = vec32(plochy);
      try {
        const t = occ('sešití ploch', () => k.sewAndSolidify(vp, 1e-4));
        if (k.getShapeType(t) !== 'solid' && k.getShapeType(t) !== 'compsolid') {
          const solid = pole(k.getSubShapes(t, 'solid'));
          if (solid.length) return solid[0];
          throw new Error(`${nazev || 'tvar'}: plochy se nepodařilo sešít do tělesa`);
        }
        return t;
      } finally { vp.delete(); }
    }

    // ------------------------------------------------------------ tělesa uzlů
    /** Těleso tvaru vyplňující kvádr rozmer se středem v počátku. */
    function tvar(u) {
      const [sx, sy, sz] = u.rozmer, p = u.param, kruh = Math.abs(sx - sy) < 1e-9;
      const naStred = id => posun(id, 0, 0, -sz / 2);
      switch (u.druh) {
        case 'kvadr': {
          let b = posun(occ('kvádr', () => k.makeBox(sx, sy, sz)), -sx / 2, -sy / 2, -sz / 2);
          const r = Math.min(p.zaobleni || 0, 0.499 * Math.min(sx, sy, sz));
          if (r > 1e-6) { const vh = vec32(pole(k.getSubShapes(b, 'edge'))); try { b = occ('zaoblení kvádru', () => k.fillet(b, vh, r)); } finally { vh.delete(); } }
          return b;
        }
        case 'valec': {
          const z = Math.min(p.zaobleni || 0, 0.499 * sz);
          if (z > 1e-6) {
            // zaoblené hrany: kruhový válec přesně (zaoblení OCCT), eliptický ze sítě
            if (!kruh || z > 0.49 * sx / 2) break;
            const c = naStred(k.makeCylinder(sx / 2, sz));
            const kruhy = pole(k.getSubShapes(c, 'edge')).filter(e => Math.abs(k.getLength(e) - PI * sx) < 1e-6 * sx);
            const vh = vec32(kruhy);
            try { return k.fillet(c, vh, z); } catch (e) { break; } finally { vh.delete(); }
          }
          return kruh ? naStred(k.makeCylinder(sx / 2, sz)) : naStred(meritko(k.makeCylinder(0.5, 1), sx, sy, sz));
        }
        case 'koule': return Math.abs(sx - sz) < 1e-9 && kruh ? k.makeSphere(sx / 2) : meritko(k.makeSphere(0.5), sx, sy, sz);
        case 'kuzel': {
          // kruhový kužel přímo (analytická plocha – skořepina i zaoblení s ní umí), eliptický měřítkem
          // horní průměr = dolní: válec (makeCone se stejnými poloměry neumí)
          if (p.horni >= 100 - 1e-9) return kruh ? naStred(k.makeCylinder(sx / 2, sz)) : naStred(meritko(k.makeCylinder(0.5, 1), sx, sy, sz));
          if (kruh) return naStred(k.makeCone(sx / 2, sx / 2 * p.horni / 100, sz));
          const c = k.makeCone(0.5, 0.5 * p.horni / 100, 1);
          return naStred(meritko(c, sx, sy, sz));
        }
        case 'trubka': {
          const t = Math.min(p.stena, 0.49 * Math.min(sx, sy));
          const vnej = kruh ? k.makeCylinder(sx / 2, sz) : meritko(k.makeCylinder(0.5, 1), sx, sy, sz);
          const vnit = kruh ? k.makeCylinder(sx / 2 - t, sz + 2) : meritko(k.makeCylinder(0.5, 1), sx - 2 * t, sy - 2 * t, sz + 2);
          return naStred(occ('trubka', () => k.cut(vnej, posun(vnit, 0, 0, -1))));
        }
        case 'torus': {
          // eliptický torus má v Modeláři trubici stálé tloušťky kolem elipsy – to OCCT měřítkem neudělá
          if (!kruh) break;
          const a = sx / 2, w = M.polosirkaTorusu(u.rozmer, p);
          const t = k.makeTorus(a - w, w);                   // v rovině XY, výška 2w
          return meritko(t, 1, sy / sx, sz / (2 * w));
        }
        case 'polokoule': {
          // horní polovina jednotkové koule (z 0..1), roztažená do kvádru a posunutá na střed
          const pulKoule = (a, b, c) => meritko(occ('polokoule', () => k.common(k.makeSphere(1), posun(k.makeBox(4, 4, 2), -2, -2, 0))), a, b, c);
          const t = Math.min(p.stena || 0, 0.9 * Math.min(sx / 2, sy / 2, sz));
          if (t > 1e-6) {
            // dutá kopule: vnější bez vnitřní (poloosy menší o stěnu), vnitřní o kus pod spodek, ať se odečte čistě
            const vnitrni = posun(meritko(occ('kopule', () => k.fuse(pulKoule(1, 1, 1), posun(k.makeCylinder(1, 1), 0, 0, -1))), sx / 2 - t, sy / 2 - t, sz - t), 0, 0, 0);
            return naStred(occ('dutá polokoule', () => k.cut(pulKoule(sx / 2, sy / 2, sz), vnitrni)));
          }
          // kruhová polokoule s výškou = poloměr: přesná koule bez měřítka
          if (kruh && Math.abs(sz - sx / 2) < 1e-9) return naStred(occ('polokoule', () => k.common(k.makeSphere(sx / 2), posun(k.makeBox(2 * sx, 2 * sx, sx), -sx, -sx, 0))));
          return naStred(pulKoule(sx / 2, sy / 2, sz));
        }
        case 'kapsle': {
          const rz = Math.min(Math.min(sx, sy) / 2, sz / 2), r = Math.min(sx, sy) / 2, h = sz - 2 * rz;
          // kruhová kapsle poloměru r, výška upravená měřítkem v Z, pak eliptický průřez
          let t = k.makeSphere(r);
          if (h > 1e-6) t = occ('kapsle', () => k.fuse(k.fuse(posun(k.makeSphere(r), 0, 0, h), k.makeCylinder(r, h)), t));
          const nat = posun(t, 0, 0, -h / 2);
          return meritko(nat, sx / (2 * r), sy / (2 * r), sz / (h + 2 * r));
        }
      }
      // mnohostěn (hranol, jehlan, hvězda…): jeho rovné plochy jsou skutečné – mělké hrany mezi nimi se nabízejí
      const t = zRovinnychPloch(M.sitTvaru(u.druh, u.rozmer, u.param), M.popisDruhu(u.druh).nazev);
      if (MNOHOSTENY.has(u.druh)) zeSite--;
      return t;
    }
    const MNOHOSTENY = new Set(['hranol', 'jehlan', 'strecha', 'klin', 'hvezda', 'sipka', 'kriz', 'schody', 'nosnik', 'brana', 'ramecek']);

    /** Díly, které jde postavit přesně (válce místo plošek sítě): díra pro šroub. V přirozených souřadnicích
        dílu (síť z manifoldu minus stred). Jinak null – díl půjde jako síť. */
    function dilPresne(u) {
      if (u.druh === 'sloupek' && M.rozmerySloupku && u.stred) {
        const p = Object.assign({}, M.DILY.sloupek.param, u.param), r = M.rozmerySloupku(p);
        let t = k.makeCylinder(r.R, p.vyska);
        const hloubka = Math.max(0, p.vyska - Math.min(p.dno, p.vyska - 0.5));
        if (hloubka >= 0.2) t = occ('sloupek', () => k.cut(t, posun(k.makeCylinder(r.r, hloubka + 0.5), 0, 0, p.vyska - hloubka)));
        return posun(t, -u.stred[0], -u.stred[1], -u.stred[2]);
      }
      if (u.druh !== 'diraSroub' || !M.rozmeryDiry || !u.stred) return null;
      const p = Object.assign({}, M.DILY && M.DILY.diraSroub ? M.DILY.diraSroub.param : {}, u.param), r = M.rozmeryDiry(p);
      let t = posun(k.makeCylinder(r.r, p.delka + 1), 0, 0, -0.5);
      const z0 = p.delka - r.hloubka;
      let hlava = null;
      if (p.druh === 'kuzelova') hlava = posun(occ('kužel díry', () => k.makeCone(r.r, r.R + 0.5, r.hloubka + 0.5)), 0, 0, z0);
      else if (p.druh === 'zahloubena') hlava = posun(k.makeCylinder(r.R, r.hloubka + 0.5), 0, 0, z0);
      else if (p.druh === 'sestihran') {
        const R = r.klic / Math.cos(Math.PI / 6) / 2, b = [];
        for (let i = 0; i < 6; i++) b.push([R * Math.cos(i * Math.PI / 3), R * Math.sin(i * Math.PI / 3)]);
        const hr = b.map((a, i) => { const c = b[(i + 1) % 6]; return k.makeLineEdge(a[0], a[1], z0, c[0], c[1], z0); });
        const vh = vec32(hr);
        try { hlava = occ('šestihran díry', () => k.extrude(k.makeFace(k.makeWire(vh)), 0, 0, r.hloubka + 0.5)); } finally { vh.delete(); }
      }
      if (hlava) t = occ('díra pro šroub', () => k.fuse(t, hlava));
      try { t = k.unifySameDomain(t); } catch (e) { /* nechat */ }
      return posun(t, -u.stred[0], -u.stred[1], -u.stred[2]);
    }
    const JEDNA = [1, 1, 1];
    const jeJedna = S => S.every(x => Math.abs(x - 1) < 1e-12);
    const krat = (a, b) => a.map((x, i) => x * b[i]);
    /** Těleso uzlu ve zvětšení S (vektor os): vrací {t, z}, skutečné těleso je Diag(z)·t = Diag(S)·(přirozené
        souřadnice uzlu); z = měřítko, které se ještě nepoužilo – použije se až tam, kde je opravdu potřeba
        (u úpravy, při umístění do rodiče, u sítě lineárně na vrcholech).
        Zvětšení se protlačí dovnitř jen přes obal úpravy (skupina s jedním dítětem = jedno těleso
        s úpravami): základní tvar se postaví rovnou ve skutečné velikosti (rovné plochy zůstanou rovinami,
        zaoblení kruhová) a vnitřní úpravy se spočítají ve skutečné velikosti – žádné zvětšení tam a zpět,
        na kterém zaoblení B-spline ploch selhávalo a skořepina trvala desítky sekund. Skupina více těles
        zvětšení nepropouští: děti v přirozené velikosti, zvětšení lineárně – stejně jako zobrazení (manifold),
        takže úprava přidaná vnější skupině nezmění tvar ničeho uvnitř. */
    function brepR(u, site, S) {
      if (u.druh !== 'skupina') {
        if (u.druh === 'sit' && M.zdroje.get(u.zdroj) && M.zdroje.get(u.zdroj).step) {
          // importovaný STEP: přesná geometrie, vycentrovaná stejně jako síť
          const z = M.zdroje.get(u.zdroj);
          return { t: posun(occ('import STEP', () => k.importStep(z.step)), -z.stredStep[0], -z.stredStep[1], -z.stredStep[2]), z: S };
        }
        const dil = dilPresne(u);
        if (dil) return { t: dil, z: S };
        if (M.TVARY[u.druh]) return jeJedna(S) ? { t: tvar(u), z: JEDNA } : { t: tvar(Object.assign({}, u, { rozmer: krat(u.rozmer, S) })), z: JEDNA };
        const s = site[M.klicGeometrie(u)] || (u.druh === 'sit' ? M.zdroje.get(u.zdroj) : null);
        if (!s) throw new Error(`přesné těleso pro „${u.nazev}“ chybí (síť nedodána)`);
        // velká síť (import STL, závit): těleso z trojúhelníků místo slučování rovinných ploch
        return { t: zRovinnychPlochNeboTrojuhelniky(s, u.nazev, proStep), z: S };
      }
      const obal = u.deti.length === 1;
      const stejne = S.every(x => Math.abs(x - S[0]) < 1e-6 * Math.max(1, S[0]));
      const plne = [], diry = [];
      let zbyva = S;                                   // měřítko, které výsledek skupiny ještě potřebuje
      for (const d of u.deti) {
        const sc = M.meritkoUzlu(d), zr = d.zrcadlo || [false, false, false];
        const nenatocene = !d.rotace || d.rotace.every(x => Math.abs(x) < 1e-9);
        const tuha = (poloha, z) => new THREE.Matrix4().compose(new THREE.Vector3(...poloha), M.quatUzlu(d),
          new THREE.Vector3(...z.map((x, i) => x * (zr[i] ? -1 : 1))));
        // natočení po 90° (osy dítěte leží na osách skupiny): zvětšení jde přeskládat na osy dítěte
        let Sd = null;
        if (obal && !nenatocene && !stejne) {
          const R = new THREE.Matrix4().makeRotationFromQuaternion(M.quatUzlu(d)).elements;
          const perm = [0, 1, 2].map(j => [0, 1, 2].find(i => Math.abs(Math.abs(R[j * 4 + i]) - 1) < 1e-9));
          if (perm.every(i => i !== undefined) && new Set(perm).size === 3) Sd = perm.map(i => S[i]);
        }
        let t;
        if (obal && (nenatocene || stejne || Sd)) {
          // obal úpravy: dítě ve skutečné velikosti, umístěné v souřadnicích Diag(S)·skupina
          const r = brepR(d, site, krat(Sd || S, sc));
          t = preved(r.t, tuha(krat(d.poloha, S), r.z));
          zbyva = JEDNA;
        } else {
          // dítě ve vlastní velikosti (jako v zobrazení), umístěné v přirozených souřadnicích skupiny
          const r = brepR(d, site, sc);
          t = preved(r.t, tuha(d.poloha, r.z));
        }
        (d.role === 'dira' ? diry : plne).push(t);
      }
      let t;
      if (!plne.length) { const v = vec32(diry); try { t = occ('sjednocení děr', () => k.fuseAll(v)); } finally { v.delete(); } }
      else {
        if (u.operace === 'prunik') { t = plne[0]; for (let i = 1; i < plne.length; i++) t = occ('průnik', () => k.common(t, plne[i])); }
        else if (plne.length === 1) t = plne[0];
        else { const v = vec32(plne); try { t = occ('sjednocení', () => k.fuseAll(v)); } finally { v.delete(); } }
        if (diry.length) { const v = vec32(diry); try { t = occ('odečtení děr', () => k.cutAll(t, v)); } finally { v.delete(); } }
      }
      // boolean nechá rozdělené plochy a nadbytečné hrany (švy na styku těles): sloučit, jinak
      // zaoblení a sražení na takové hraně selže („no suitable edges“) a výběr hran je zmatený
      if (u.deti.length > 1) { try { t = k.unifySameDomain(t); } catch (e) { /* nechat jak je */ } }
      if (!u.occt) return { t, z: zbyva };
      // úprava ve skutečné velikosti (stěna 2 mm zůstane 2 mm i po roztažení): hrany a plochy úpravy jsou
      // v přirozených souřadnicích skupiny – do Diag(S)
      if (!jeJedna(zbyva)) t = meritko(t, ...zbyva);
      if (jeJedna(S)) {
        try { return { t: uprav(t, u.occt), z: JEDNA }; }
        catch (e) {
          // hrany vybrané při jiném zvětšení (délka oblouku změřená ve 2×): dohledat bez délky
          if (!/nenašla/.test(e.message) || !(u.occt.hrany || []).length) throw e;
          return { t: uprav(t, Object.assign({}, u.occt, { hrany: u.occt.hrany.map(h => Object.assign({}, h, { delka: null, bezDelky: true })) })), z: JEDNA };
        }
      }
      const o = Object.assign({}, u.occt, {
        hrany: (u.occt.hrany || []).map(h => ({ stred: krat(h.stred, S), delka: null, bod: h.bod ? krat(h.bod, S) : null,
          konce: h.konce ? h.konce.map(p => krat(p, S)) : null, odchylka: Math.max(...S.map(x => Math.abs(1 - 1 / x))) })),
        plochy: (u.occt.plochy || []).map(f => {
          const n = f.normala.map((x, i) => x / S[i]), l = Math.hypot(...n) || 1;
          return { stred: krat(f.stred, S), normala: n.map(x => x / l) };
        }),
      });
      return { t: uprav(t, o), z: JEDNA };
    }
    /** Těleso uzlu ve skutečné velikosti jeho vlastního měřítka: {t, z, f} – přirozené souřadnice = f·(Diag(z)·t),
        f = 1 / vlastní měřítko (síť a body hran se převedou lineárně, bez další transformace tělesa). */
    function brepSkut(u, site = {}) {
      const s = M.meritkoUzlu(u), r = brepR(u, site, s);
      return { t: r.t, f: r.z.map((x, i) => x / s[i]) };
    }
    /** Síť přesného tělesa převedená lineárně do přirozených souřadnic. */
    function sitPrirozena(r) {
      const s = sitZTelesa(r.t);
      if (!jeJedna(r.f)) for (let i = 0; i < s.poz.length; i += 3) for (let j = 0; j < 3; j++) s.poz[i + j] *= r.f[j];
      return s;
    }

    // ------------------------------------------------------------ hrany a plochy
    const stredHrany = e => { const c = k.getLinearCenterOfMass(e); const o = [c.get(0), c.get(1), c.get(2)]; c.delete(); return o; };
    /** filtrUhlu: nenabízet hrany se zlomem pod 20° mezi rovinami – jen u těles s plochami ze sítě (plošky oblouku,
        přechodu); skutečné mělké hrany (hřeben ploché střechy, 24boký hranol) zůstanou. Při dohledávání uložených
        hran (uprav) se nefiltruje nikdy – starší projekty by hranu nenašly. */
    function popisHran(t, filtrUhlu = false) {
      let povrchT = null;
      const povrch = () => povrchT != null ? povrchT : (povrchT = pole(k.getSubShapes(t, 'face')).reduce((a, g) => a + k.getSurfaceArea(g), 0));
      // šev (hrana mezi plochou a jí samou – válec, koule) zaoblit ani srazit nejde: nenabízet
      // ani hladký přechod (plochy na hraně tečné – třeba vnitřek skořepiny zaobleného kvádru): už je oblý, OCCT
      // ho zaoblit neumí („no suitable edges“) a jen by mátl
      const nevhodna = e => {
        try {
          const f = pole(k.adjacentFaces(t, e));
          if (f.length < 2 || (f.length === 2 && k.isSame(f[0], f[1]))) return true;
          if (f.length !== 2) return false;
          // bod NA hraně (těžiště kruhové hrany je střed kruhu – normály by vyšly nesmyslné)
          const q = bodHrany(e);
          const n = f.map(g => {
            const uv = k.uvFromPoint(g, q[0], q[1], q[2]), u = [uv.get(0), uv.get(1)]; uv.delete();
            const v = k.surfaceNormal(g, u[0], u[1]), o = [v.get(0), v.get(1), v.get(2)]; v.delete();
            return o;
          });
          const cos = n[0][0] * n[1][0] + n[0][1] * n[1][1] + n[0][2] * n[1][2];
          if (cos > 0.9995) return true;                       // hladký přechod
          // zlom pod 20° mezi rovinami u těles ze sítě: plošky zakřivené plochy (oblouk, přechod) – stovky hran,
          // na kterých úprava nic viditelného neudělá a OCCT ji počítá sekundy
          // (velká rovina – plochá střecha, 24boký hranol – je skutečná plocha, ne ploška)
          return filtrUhlu && cos > Math.cos(20 * Math.PI / 180) && f.every(jeRovina) && f.every(g => k.getSurfaceArea(g) < 0.05 * povrch());
        } catch (x) { return false; }
      };
      return pole(k.getSubShapes(t, 'edge')).filter(e => !nevhodna(e)).map(e => ({ id: e, stred: stredHrany(e), delka: k.getLength(e), bod: bodHrany(e), konce: jeUsecka(e) ? konceHrany(e) : null }));
    }
    /** Rovná plocha: rovina, nebo B-spline z nerovnoměrného zvětšení s nulovou křivostí a stálou normálou. */
    function jeRovina(f) {
      try {
        const typ = k.surfaceType(f);
        if (typ === 'plane') return true;
        if (typ !== 'bspline' && typ !== 'bezier') return false;
        const kr = k.surfaceCurvature(f, 0, 0), a = k.surfaceNormal(f, 0, 0), b = k.surfaceNormal(f, 0.5, 0.5);
        const kv = Array.from({ length: kr.size() }, (_, j) => kr.get(j));
        const ano = kv.every(x => Math.abs(x) < 1e-9) && Math.abs(a.get(0) * b.get(0) + a.get(1) * b.get(1) + a.get(2) * b.get(2) - 1) < 1e-9;
        kr.delete(); a.delete(); b.delete();
        return ano;
      } catch (e) { return false; }
    }
    /** Koncové body hrany. */
    function konceHrany(e) {
      const vv = pole(k.getSubShapes(e, 'vertex'));
      if (vv.length < 1) return null;
      return [vv[0], vv[vv.length - 1]].map(q => { const p = k.vertexPosition(q), o = [p.get(0), p.get(1), p.get(2)]; p.delete(); return o; });
    }
    /** Rovná hrana: úsečka, nebo B-spline z nerovnoměrného zvětšení, která je stejně dlouhá jako spojnice konců. */
    function jeUsecka(e) {
      try {
        const typ = k.curveType(e);
        if (typ === 'line') return true;
        if (typ !== 'bspline' && typ !== 'bezier') return false;
        const kk = konceHrany(e), L = k.getLength(e);
        return !!kk && Math.abs(Math.hypot(kk[1][0] - kk[0][0], kk[1][1] - kk[0][1], kk[1][2] - kk[0][2]) - L) < 1e-7 * Math.max(1, L);
      } catch (e2) { return false; }
    }
    /** Bod uprostřed parametru hrany – při zvětšení skupiny se zobrazí přesně (na rozdíl od těžiště oblouku). */
    function bodHrany(e) {
      try {
        const p = k.curveParameters(e), a = p.get(0), b = p.get(1); p.delete();
        const q = k.curvePointAtParam(e, (a + b) / 2), o = [q.get(0), q.get(1), q.get(2)]; q.delete();
        return o;
      } catch (x) { return null; }
    }
    function popisPloch(t) {
      return pole(k.getSubShapes(t, 'face')).map(f => {
        const c = k.getSurfaceCenterOfMass(f), stred = [c.get(0), c.get(1), c.get(2)]; c.delete();
        const rovina = jeRovina(f);
        let normala = null;
        if (rovina) { const n = k.surfaceNormal(f, 0, 0); normala = [n.get(0), n.get(1), n.get(2)]; n.delete(); }   // normála už počítá s orientací plochy (ven z tělesa)
        return { id: f, stred, normala, rovina, plocha: k.getSurfaceArea(f) };
      });
    }
    /** Nejbližší hrana k popisu {stred, delka} ze seznamu hran (nebo null). */
    function nejblizsiHrana(vse, h) {
      // rovná hrana: na stejné přímce s největším překryvem (po zvětšení skupiny s vnořenou úpravou se konce
      // posunou – zaoblení uvnitř zůstává ve skutečné velikosti)
      if (h.konce) {
        const [A, B] = h.konce, ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(...ab);
        if (L > 1e-9) {
          const u = ab.map(c => c / L);
          let nej = null, skore = 0;
          for (const e of vse) {
            if (!e.konce) continue;
            const t = e.konce.map(p => { const w = [p[0] - A[0], p[1] - A[1], p[2] - A[2]], q = w[0] * u[0] + w[1] * u[1] + w[2] * u[2];
              return { q, dist: Math.hypot(w[0] - q * u[0], w[1] - q * u[1], w[2] - q * u[2]) }; });
            if (t.some(x => x.dist > 1e-3 + 1e-5 * L)) continue;
            const prekryv = Math.min(L, Math.max(t[0].q, t[1].q)) - Math.max(0, Math.min(t[0].q, t[1].q));
            if (prekryv > 0.2 * Math.min(L, e.delka) && prekryv > skore) { skore = prekryv; nej = e; }
          }
          if (nej) return nej;
        }
      }
      // jinak podle bodu uprostřed hrany (ten se při zvětšení skupiny zobrazí přesně)
      if (h.bod) {
        let nej = null, d0 = Infinity;
        for (const e of vse) {
          if (!e.bod) continue;
          const d = Math.hypot(e.bod[0] - h.bod[0], e.bod[1] - h.bod[1], e.bod[2] - h.bod[2]);
          if (d < d0) { d0 = d; nej = e; }
        }
        if (nej && d0 <= 1e-3 + 1e-4 * (h.delka || 10)) return nej;
      }
      let nej = null, d0 = Infinity;
      for (const e of vse) {
        const d = Math.hypot(e.stred[0] - h.stred[0], e.stred[1] - h.stred[1], e.stred[2] - h.stred[2]);
        if (d < d0 && (h.delka == null || Math.abs(e.delka - h.delka) <= 0.05 * h.delka + 0.01)) { d0 = d; nej = e; }
      }
      // délka neznámá (zvětšená skupina – hrana se natáhla podle směru): jen podle středu
      if (nej && d0 <= (h.delka != null ? 0.05 * h.delka + 0.05 : 0.1)) return nej;
      // skupina zvětšená po výběru hran a vnořená úprava (zaoblení uvnitř) zůstala ve skutečné velikosti: hrany se
      // posunuly – nejbližší hrana stejného druhu (rovná ve stejném směru / oblá) v okolí do 15 % velikosti tělesa
      if (h.delka != null) return null;
      // opakování v měřítku 1: rovná hrana jen na své přímce (výše) – soused o kus vedle by se zaoblil místo ní
      if (h.bezDelky && h.konce) return null;
      let x0 = Infinity, x1 = -Infinity;
      for (const e of vse) for (let i = 0; i < 3; i++) { x0 = Math.min(x0, e.stred[i]); x1 = Math.max(x1, e.stred[i]); }
      // posun vnitřních hran roste se zvětšením (stěna zůstává ve skutečné velikosti): okolí úměrné odchylce měřítka,
      // ať se při malém zvětšení nevezme sousední hrana místo zmizelé
      const tol = 0.15 * Math.max(1, x1 - x0) * Math.min(1, 4 * (h.odchylka != null ? h.odchylka : 1)) + 0.05;
      const smer = h.konce ? (() => { const [A, B] = h.konce, v = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], l = Math.hypot(...v) || 1; return v.map(c => c / l); })() : null;
      nej = null; d0 = Infinity;
      for (const e of vse) {
        if (!!smer !== !!e.konce) continue;
        if (smer) {
          const [A, B] = e.konce, v = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], l = Math.hypot(...v) || 1;
          if (Math.abs(v[0] * smer[0] + v[1] * smer[1] + v[2] * smer[2]) / l < 0.999) continue;
        }
        const c = h.bod && e.bod ? [e.bod, h.bod] : [e.stred, h.stred];
        const d = Math.hypot(c[0][0] - c[1][0], c[0][1] - c[1][1], c[0][2] - c[1][2]);
        if (d < d0) { d0 = d; nej = e; }
      }
      return nej && d0 <= tol ? nej : null;
    }
    function nejblizsiPlocha(vse, h) {
      let nej = null, d0 = Infinity;
      for (const f of vse) {
        if (f.normala[0] * h.normala[0] + f.normala[1] * h.normala[1] + f.normala[2] * h.normala[2] < 0.999) continue;
        // musí ležet ve stejné rovině (jinak by se otevřela úplně jiná stěna se stejnou normálou)
        const vRovine = Math.abs((f.stred[0] - h.stred[0]) * h.normala[0] + (f.stred[1] - h.stred[1]) * h.normala[1] + (f.stred[2] - h.stred[2]) * h.normala[2]);
        if (vRovine > 0.05) continue;
        const d = Math.hypot(f.stred[0] - h.stred[0], f.stred[1] - h.stred[1], f.stred[2] - h.stred[2]);
        if (d < d0) { d0 = d; nej = f; }
      }
      return nej;
    }
    /** Samostatná tělesa (solid) výsledku: sjednocení a odečtení vrací compound, se kterým
        zaoblení ani skořepina neumí („TopoDS::Solid“). */
    function telesa(t) {
      if (k.getShapeType(t) === 'solid') return [t];
      const s = pole(k.getSubShapes(t, 'solid'));
      return s.length ? s : [t];
    }
    function slozit(casti) {
      if (casti.length === 1) return casti[0];
      const v = vec32(casti);
      try { return occ('složení těles', () => k.makeCompound(v)); } finally { v.delete(); }
    }
    /** Záloha skořepiny s otevřenými plochami (OCCT shell selhal, třeba u zaoblených hran):
        uzavřená dutina a pak průraz – vnitřek posunutý ven přes každou otevřenou plochu. */
    function otevrenaDutina(x, plochy, t, v0) {
      const platne = y => { try { return k.isValid(y); } catch (e) { return true; } };
      for (const spoj of [0, 1]) {
        try {
          const vnitrek = k.offsetWithJoin(x, -t, 1e-3, spoj);
          const vv = k.getVolume(vnitrek);
          if (!(vv > 1e-9 && vv < v0) || !platne(vnitrek)) continue;
          const bb = k.getBoundingBox(vnitrek, false);
          let nastroj = vnitrek;
          for (const f of plochy) {
            const n = k.surfaceNormal(f, 0, 0), nn = [n.get(0), n.get(1), n.get(2)]; n.delete();
            const rozsah = Math.abs(nn[0]) * (bb.xmax - bb.xmin) + Math.abs(nn[1]) * (bb.ymax - bb.ymin) + Math.abs(nn[2]) * (bb.zmax - bb.zmin);
            const d = Math.min(2 * t, 0.9 * rozsah);
            if (d < 1.05 * t) throw new Error('dutina je na průraz moc mělká');
            nastroj = k.fuse(nastroj, posun(vnitrek, nn[0] * d, nn[1] * d, nn[2] * d));
          }
          const y = k.cut(x, nastroj), v = k.getVolume(y);
          if (v > 1e-9 && v < v0 && platne(y)) return y;
        } catch (e) { /* další způsob */ }
      }
      return null;
    }
    const ZPRAVA = { zaobleni: 'zaoblení hran se nepodařilo (zkus menší poloměr nebo méně hran)',
      srazeni: 'sražení hran se nepodařilo (zkus menší vzdálenost nebo méně hran)', skorepina: 'skořepina se nepodařila (zkus tenčí stěnu)' };
    /** Zaoblení, sražení nebo skořepina – každé těleso výsledku zvlášť, s hranami/plochami, které mu patří. */
    function uprav(t, o) {
      const tl = telesa(t);
      if (o.operace === 'odsazeni') {
        // odsazení stěn: kladné zvětší (vypouklé rohy zaoblí), záporné zmenší; objem se musí změnit správným směrem
        const odsad = x => {
          const v0 = k.getVolume(x);
          for (const spoj of [0, 1]) {
            try {
              const y = k.offsetWithJoin(x, o.hodnota, 1e-3, spoj), s = telesa(y), v = k.getVolume(y);
              if (s.length === 1 && isFinite(v) && v > 1e-9 && (o.hodnota > 0 ? v > v0 : v < v0) && k.isValid(s[0])) return s[0];
            } catch (e) { /* další způsob spojení */ }
          }
          return null;
        };
        return slozit(tl.map(x => {
          let y = odsad(x);
          // B-spline plochy (eliptický válec, roztažená koule…) OCCT odsadit neumí: těleso z jeho triangulace
          if (!y && pole(k.getSubShapes(x, 'face')).some(f => { try { return k.surfaceType(f) === 'bspline'; } catch (e) { return false; } })) {
            // (jen u jednoduché triangulace – tisíce plošek by OCCT počítalo desítky sekund a stejně selhalo)
            try { const sit = sitZTelesa(k.copy(x), undefined); if (sit.idx.length / 3 <= 1500) y = odsad(zRovinnychPlochNeboTrojuhelniky(sit, 'těleso', false)); } catch (e) { y = null; }
          }
          if (y) return y;
          // „tenčí než dvojnásobek“ jen tam, kde to opravdu platí (nejmenší rozměr obálky)
          const bb = k.getBoundingBox(x, false), nejmensi = Math.min(bb.xmax - bb.xmin, bb.ymax - bb.ymin, bb.zmax - bb.zmin);
          throw new Error(o.hodnota < 0 && nejmensi <= 2 * Math.abs(o.hodnota) + 1e-6 ? 'zmenšení se nepodařilo – těleso je tenčí než dvojnásobek odsazení'
            : 'přesné jádro tohle těleso odsadit neumí (oblé plochy po nerovnoměrném roztažení nebo složitý průnik) – zkus menší hodnotu, nebo odsazení udělej před roztažením');
        }));
      }
      if (o.operace === 'skorepina') {
        const plochy = tl.map(x => popisPloch(x).filter(f => f.rovina));
        const vybrane = tl.map(() => []);
        for (const h of o.plochy || []) {
          let nej = null, kde = -1;
          plochy.forEach((seznam, i) => { const f = nejblizsiPlocha(seznam, h); if (f && (!nej || Math.hypot(...f.stred.map((x, j) => x - h.stred[j])) < Math.hypot(...nej.stred.map((x, j) => x - h.stred[j])))) { nej = f; kde = i; } });
          if (!nej) throw new Error('vybraná plocha se v tělese nenašla');
          vybrane[kde].push(nej.id);
        }
        const otevrit = (o.plochy || []).length > 0;
        // výsledek musí mít kladný objem menší než těleso (OCCT u špiček – kužel – vrací i nesmysl bez chyby)
        const objem = x => { try { return k.getVolume(x); } catch (e) { return NaN; } };
        const platne = y => { try { return k.isValid(y); } catch (e) { return true; } };
        const rozumne = (y, v0) => { const v = objem(y); return isFinite(v) && v > 1e-9 && v < v0 * (1 - 1e-9) && platne(y); };
        /** Zkusí spojení oblouky (hladší rohy), pak průsečíky (zvládne i vrchol kužele). */
        const zkus = (f, v0) => {
          let chyba = null;
          for (const spoj of [null, 1]) {
            try { const y = f(spoj); if (rozumne(y, v0)) return y; } catch (e) { chyba = e; }
          }
          if (chyba) console.warn('OpenCascade:', zprava(chyba));
          throw new Error(ZPRAVA.skorepina);
        };
        return slozit(tl.map((x, i) => {
          const v0 = objem(x);
          if (!otevrit) {
            // uzavřená dutina: těleso bez zmenšené kopie (shell bez otevřené plochy dává jen vnitřní stěnu)
            return zkus(spoj => {
              const vnitrek = spoj == null ? k.offset(x, -o.hodnota, 1e-3) : k.offsetWithJoin(x, -o.hodnota, 1e-3, spoj);
              if (!rozumne(vnitrek, v0)) throw new Error('offset');
              return k.cut(x, vnitrek);
            }, v0);
          }
          if (!vybrane[i].length) return x;            // těleso bez otevřené plochy zůstane plné
          // každá otevřená plocha musí být opravdu otevřená: kousek pod jejím středem (v původním materiálu)
          // je po skořepině prázdno. OCCT u B-spline ploch (natočené a roztažené těleso) občas vrátí zavřenou dutinu.
          const zkouska = plochy[i].filter(f => vybrane[i].includes(f.id) && f.normala)
            .map(f => f.stred.map((c, j) => c - f.normala[j] * o.hodnota / 2))
            .filter(q => { try { return k.containsPoint(x, q[0], q[1], q[2], 1e-6); } catch (e) { return false; } });
          // ověřuje se na síti (to se zobrazí a exportuje); klasifikátor OCCT u těchto těles sám chybuje
          const otevrena = y => {
            if (!zkouska.length) return true;
            let sit;
            try { sit = sitZTelesa(k.copy(y)); } catch (e) { return false; }
            return zkouska.every(q => !M.bodVSiti(sit, q));
          };
          const v = vec32(vybrane[i]);
          try {
            return zkus(spoj => {
              const y = spoj == null ? k.shell(x, v, o.hodnota, 1e-3) : k.shellWithJoin(x, v, o.hodnota, 1e-3, spoj);
              if (!otevrena(y)) throw new Error('plocha zůstala zavřená');
              return y;
            }, v0);
          } catch (e) {
            const y = otevrenaDutina(x, vybrane[i], o.hodnota, v0);
            if (y && otevrena(y)) return y;
            if (pole(k.getSubShapes(x, 'face')).some(f => { try { return k.surfaceType(f) === 'bspline'; } catch (z) { return false; } }))
              throw new Error('skořepina u oblých ploch po nerovnoměrném roztažení (eliptický válec, roztažená koule) v přesném jádru nejde – udělej ji před roztažením, nebo použij kruhový tvar');
            throw e;
          } finally { v.delete(); }
        }));
      }
      if (!(o.hrany || []).length) return t;
      const hrany = tl.map(x => popisHran(x));
      const vybrane = tl.map(() => []);
      let chybi = 0;
      for (const h of o.hrany) {
        let nej = null, kde = -1, d0 = Infinity;
        hrany.forEach((seznam, i) => {
          const e = nejblizsiHrana(seznam, h);
          if (!e) return;
          const d = Math.hypot(e.stred[0] - h.stred[0], e.stred[1] - h.stred[1], e.stred[2] - h.stred[2]);
          if (d < d0) { d0 = d; nej = e; kde = i; }
        });
        // hranu po sloučení ploch (starší projekt) nebo po změně tvaru nenajde: vynechat, pokud zbydou jiné
        if (!nej) {
          // nová data (s bodem hrany) chybu ohlásí – tiše vynechaná hrana by dala jiný tvar
          if (h.bod) throw new Error('vybraná hrana se v tělese nenašla (změnil se tvar?) – otevři úpravu a vyber hrany znovu');
          chybi++; continue;
        }
        if (!vybrane[kde].includes(nej.id)) vybrane[kde].push(nej.id);
      }
      if (chybi === o.hrany.length) throw new Error('vybraná hrana se v tělese nenašla (změnil se tvar?)');
      return slozit(tl.map((x, i) => {
        if (!vybrane[i].length) return x;
        try { return hranyNativne(x, vybrane[i], o.operace, o.hodnota); }
        catch (e) {
          // naráz to OCCT neumí (vnitřní i vnější hrany okraje, vyduté vedle vypouklých): po skupinách –
          // nejdřív vyduté, pak vypouklé (a obráceně); hrany druhé skupiny se v novém tělese dohledají
          const zn = vybrane[i].map(h => vypuklost(x, h));
          const vydute = vybrane[i].filter((h, j) => zn[j] < 0), ostatni = vybrane[i].filter((h, j) => zn[j] >= 0);
          if (vydute.length && ostatni.length) {
            for (const [prvni, druhe] of [[vydute, ostatni], [ostatni, vydute]]) {
              try {
                const popis = druhe.map(h => popisHranyProDohledani(x, h));
                const y1 = hranyNativne(x, prvni, o.operace, o.hodnota);
                const dalsi = popis.map(d => dohledejHranu(y1, d));
                if (dalsi.some(h => h == null)) continue;
                return hranyNativne(y1, dalsi, o.operace, o.hodnota);
              } catch (e2) { /* další pořadí */ }
            }
            // vypouklé záložním ořezem a pak vyduté přesně (přesné zaoblení rohu pak dosedne až na ořezaný okraj)
            try {
              const popis = vydute.map(h => popisHranyProDohledani(x, h));
              const y1 = hranyBooleanem(x, ostatni, o.operace, o.hodnota);
              if (y1) {
                const dalsi = popis.map(d => dohledejHranu(y1, d));
                if (!dalsi.some(h => h == null)) return hranyNativne(y1, dalsi, o.operace, o.hodnota);
              }
            } catch (e4) { if (/větší, než je plocha/.test(e4.message)) throw e4; }
            // vyduté přesně a vypouklé záložním ořezem (v rohu na sebe hladce navážou)
            try {
              const popis = ostatni.map(h => popisHranyProDohledani(x, h));
              const y1 = hranyNativne(x, vydute, o.operace, o.hodnota);
              const dalsi = popis.map(d => dohledejHranu(y1, d));
              if (!dalsi.some(h => h == null)) {
                const y2 = hranyBooleanem(y1, dalsi, o.operace, o.hodnota);
                if (y2) return y2;
              }
            } catch (e3) { if (/větší, než je plocha/.test(e3.message)) throw e3; }
          }
          // OCCT neumí třeba sražení hrany, která končí v zaoblení: rovné hrany mezi rovinami ořezat booleanem
          const y = hranyBooleanem(x, vybrane[i], o.operace, o.hodnota);
          if (y) return y;
          throw e;
        }
      }));
    }

    /** Zaoblení / sražení přímo jádrem OCCT, s kontrolou výsledku (OCCT občas vrátí bez chyby rozbité těleso –
        překrývající se zaoblení na tenké stěně; isValid ho nepozná, ale vypouklé hrany musí objem zmenšit,
        vyduté zvětšit). */
    function hranyNativne(x, hrany, op, h) {
      const v = vec32(hrany);
      try {
        const y = op === 'srazeni' ? occC(ZPRAVA.srazeni, () => k.chamfer(x, v, h)) : occC(ZPRAVA.zaobleni, () => k.fillet(x, v, h));
        let platne = true;
        try {
          platne = k.isValid(y) && telesa(y).length === 1;
          const zn = hrany.map(e => vypuklost(x, e)), v0 = k.getVolume(x), v1 = k.getVolume(y);
          if (zn.every(z => z > 0) && !(v1 < v0)) platne = false;
          if (zn.every(z => z < 0) && !(v1 > v0)) platne = false;
          if (platne && Math.abs(v1 - v0) > mezZmenyObjemu(x, hrany, op, h)) platne = false;
        } catch (x2) { /* bez kontroly */ }
        // u smíšených hran objem nic neřekne: rozbité těleso pozná až síť (děravá); síť nejde = rozbité.
        // Síť z kopie – triangulace v tělese by rozbila pozdější nerovnoměrné měřítko (zvětšená skupina)
        if (platne) { try { if (!M.zkontrolujSit(sitZTelesa(k.copy(y))).vodotesna) platne = false; } catch (x3) { platne = false; } }
        if (!platne) throw new Error(op === 'srazeni' ? ZPRAVA.srazeni : ZPRAVA.zaobleni);
        return y;
      } finally { v.delete(); }
    }

    /** Popis hrany, podle kterého se najde i po úpravě sousedních hran (zkrácená, posunutý střed):
        úsečka = přímka a úsek, jinak střed a délka. */
    function popisHranyProDohledani(x, e) {
      const d = { stred: stredHrany(e), delka: k.getLength(e), primka: null };
      try {
        if (jeUsecka(e)) d.primka = konceHrany(e);
      } catch (z) { /* jen střed */ }
      return d;
    }
    function dohledejHranu(y, d) {
      let nej = null, skore = -Infinity;
      for (const e of pole(k.getSubShapes(y, 'edge'))) {
        if (d.primka) {
          if (!jeUsecka(e)) continue;
          const [A, B] = d.primka, ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(...ab), u = ab.map(c => c / L);
          const vv = pole(k.getSubShapes(e, 'vertex'));
          const body = [vv[0], vv[vv.length - 1]].map(q => { const p = k.vertexPosition(q), o = [p.get(0), p.get(1), p.get(2)]; p.delete(); return o; });
          // oba konce na přímce původní hrany a úsek se s ní překrývá
          const t = body.map(p => { const w = [p[0] - A[0], p[1] - A[1], p[2] - A[2]], s = w[0] * u[0] + w[1] * u[1] + w[2] * u[2];
            return { s, dist: Math.hypot(w[0] - s * u[0], w[1] - s * u[1], w[2] - s * u[2]) }; });
          if (t.some(q => q.dist > 1e-4 * Math.max(1, L))) continue;
          const prekryv = Math.min(L, Math.max(t[0].s, t[1].s)) - Math.max(0, Math.min(t[0].s, t[1].s));
          if (prekryv > 1e-6 && prekryv > skore) { skore = prekryv; nej = e; }
        } else {
          const c = stredHrany(e), dl = k.getLength(e);
          const s2 = -Math.hypot(c[0] - d.stred[0], c[1] - d.stred[1], c[2] - d.stred[2]) - Math.abs(dl - d.delka);
          if (s2 > -0.1 * Math.max(1, d.delka) && s2 > skore) { skore = s2; nej = e; }
        }
      }
      return nej;
    }

    /** Záloha zaoblení / sražení: každá vybraná hrana musí být úsečka mezi dvěma rovinami.
        Sražení = klín (trojúhelník podél hrany), zaoblení = klín bez válce; vypouklá hrana se
        odečte, vydutá přidá. Konce klínu přesahují tam, kde za hranou těleso není (ořízne i
        sousední zaoblení), jinak končí přesně na konci hrany. Vrací těleso nebo null. */
    /** +1 vypouklá, −1 vydutá, 0 nevím (hrana není úsečka mezi dvěma rovinami). */
    function vypuklost(x, e) {
      try {
        if (!jeUsecka(e)) return 0;
        const f = pole(k.adjacentFaces(x, e));
        if (f.length !== 2 || f.some(g => !jeRovina(g))) return 0;
        const c = k.getLinearCenterOfMass(e), q = [c.get(0), c.get(1), c.get(2)]; c.delete();
        const n = f.map(g => { const v = k.surfaceNormal(g, 0, 0), o = [v.get(0), v.get(1), v.get(2)]; v.delete(); return o; });
        // bod kousek nad první plochou a „za“ druhou (směr n1 − n2): u vypouklé hrany je mimo těleso,
        // u vyduté v materiálu za druhou plochou (součet normál by byl mimo těleso v obou případech)
        const s = [n[0][0] - n[1][0], n[0][1] - n[1][1], n[0][2] - n[1][2]], l = Math.hypot(...s);
        if (l < 1e-6) return 0;
        const d = M.omez(k.getLength(e) * 1e-3, 1e-3, 0.05);
        return k.containsPoint(x, q[0] + s[0] / l * d, q[1] + s[1] / l * d, q[2] + s[2] / l * d, 1e-7) ? -1 : 1;
      } catch (z) { return 0; }
    }
    /** Horní mez změny objemu (mm³) zaoblením / sražením hran: průřez odebraného (u vydutých přidaného)
        materiálu z úhlu ploch – zaoblení r²·(tg(φ/2) − φ/2), sražení ½·d²·sin φ (φ = úhel mezi normálami) –
        krát délka hrany, s trojnásobnou rezervou a rohy (r³ na konec). Výsledek nad mezí je rozbitý, i když je
        vodotěsný a isValid ho pustí (zaoblení skoro rovné hrany na plochách z trojúhelníků přidalo 68 mm³ místo
        0,001). Úhel nejde zjistit = bez meze. */
    /** Konce hrany s tečnami mířícími DO hrany: [{bod, smer}, {bod, smer}] (nebo null). */
    function konceSTecnou(e) {
      try {
        const p = k.curveParameters(e), a = p.get(0), b = p.get(1); p.delete();
        const bod = t => { const q = k.curvePointAtParam(e, t), o = [q.get(0), q.get(1), q.get(2)]; q.delete(); return o; };
        const eps = (b - a) * 1e-4;
        const ven = (P, Q) => { const d = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]], l = Math.hypot(...d) || 1; return d.map(x => x / l); };
        const A = bod(a), B = bod(b);
        return [{ bod: A, smer: ven(A, bod(a + eps)) }, { bod: B, smer: ven(B, bod(b - eps)) }];
      } catch (z) { return null; }
    }
    /** Délka tečně navazujícího řetězu hran od hrany e (OCCT zaoblí / srazí celý řetěz – třeba okraj
        kolem už zaoblených rohů). */
    function delkaRetezu(x, e, vse, kon) {
      // (jádro vrací pro tutéž hranu při každém dotazu jiné id – vlastní hranu najít přes isSame)
      const sama = vse.find(f => { try { return k.isSame(f, e); } catch (z) { return false; } });
      if (sama === undefined) return k.getLength(e);
      const hotovo = new Set([sama]), fronta = [sama];
      let L = 0;
      while (fronta.length) {
        const f = fronta.pop();
        L += k.getLength(f);
        const kf = kon.get(f);
        if (!kf || hotovo.size > 200) continue;
        for (const g of vse) {
          if (hotovo.has(g)) continue;
          const kg = kon.get(g);
          if (!kg) continue;
          // sdílený konec a tečny proti sobě (hrana plynule pokračuje)
          if (kf.some(a => kg.some(b => Math.hypot(a.bod[0] - b.bod[0], a.bod[1] - b.bod[1], a.bod[2] - b.bod[2]) < 1e-5
            && a.smer[0] * b.smer[0] + a.smer[1] * b.smer[1] + a.smer[2] * b.smer[2] < -0.999))) { hotovo.add(g); fronta.push(g); }
        }
      }
      return L;
    }
    function mezZmenyObjemu(x, hrany, op, h) {
      let mez = 0;
      const vse = pole(k.getSubShapes(x, 'edge'));
      const kon = new Map(vse.map(f => [f, konceSTecnou(f)]));        // tečny konců jednou pro všechny vybrané hrany
      for (const e of hrany) {
        try {
          const f = pole(k.adjacentFaces(x, e));
          if (f.length !== 2) return Infinity;
          const q = bodHrany(e);
          const n = f.map(g => {
            const uv = k.uvFromPoint(g, q[0], q[1], q[2]), u = [uv.get(0), uv.get(1)]; uv.delete();
            const v = k.surfaceNormal(g, u[0], u[1]), o = [v.get(0), v.get(1), v.get(2)]; v.delete();
            return o;
          });
          const fi = Math.min(Math.PI - 0.05, Math.acos(M.omez(n[0][0] * n[1][0] + n[0][1] * n[1][1] + n[0][2] * n[1][2], -1, 1)));
          const prurez = op === 'srazeni' ? 0.5 * h * h * Math.sin(fi) : h * h * (Math.tan(fi / 2) - fi / 2);
          mez += 3 * prurez * delkaRetezu(x, e, vse, kon) + 2 * h * h * h;
        } catch (z) { return Infinity; }
      }
      return mez + 1e-3;
    }
    function UzkaPlocha() {}
    function hranyBooleanem(x, hrany, op, h) {
      const T = THREE.Vector3;
      const pole3 = v => { const o = new T(v.get(0), v.get(1), v.get(2)); v.delete(); return o; };
      const uvnitr = p => { try { return k.containsPoint(x, p.x, p.y, p.z, 1e-6); } catch (e) { return true; } };
      const nastroje = [];
      try {
        // záloha umí jen úsečky mezi dvěma rovinami: ověřit u všech hran dopředu – jinak by kontrola šířky
        // u první hrany ohlásila „větší než plocha“, i když opravdovou překážkou je jiná (oblá) hrana
        for (const e of hrany) {
          if (!jeUsecka(e)) return null;
          const f = pole(k.adjacentFaces(x, e));
          if (f.length !== 2 || f.some(g => !jeRovina(g))) return null;
        }
        // konce všech vybraných hran (pro pokos tam, kde se dvě upravované hrany potkají)
        const konce = hrany.map(e => {
          try { const vv = pole(k.getSubShapes(e, 'vertex')); return [pole3(k.vertexPosition(vv[0])), pole3(k.vertexPosition(vv[vv.length - 1]))]; }
          catch (z) { return null; }
        });
        for (const [ei, e] of hrany.entries()) {
          if (!jeUsecka(e)) return null;
          const vv = pole(k.getSubShapes(e, 'vertex'));
          if (vv.length < 2) return null;
          const A = pole3(k.vertexPosition(vv[0])), B = pole3(k.vertexPosition(vv[vv.length - 1]));
          const L = A.distanceTo(B);
          if (L < 1e-9) return null;
          const smer = B.clone().sub(A).normalize();
          const plochy = pole(k.adjacentFaces(x, e));
          if (plochy.length !== 2 || plochy.some(f => !jeRovina(f))) return null;
          const stred = A.clone().add(B).multiplyScalar(0.5);
          const normaly = plochy.map(f => pole3(k.surfaceNormal(f, 0, 0)));
          const [w1, w2] = plochy.map(f => {
            const n = pole3(k.surfaceNormal(f, 0, 0));
            const w = new T().crossVectors(n, smer).normalize();
            // do plochy, ne ven z ní: kousek od hrany pod plochou je materiál a nad ní není
            // (těžiště plochy nestačí – u plochy s otvorem, třeba okraje krabičky, leží v otvoru)
            const eps = M.omez(L * 1e-3, 1e-3, 0.05);
            const spravne = w2 => uvnitr(stred.clone().addScaledVector(w2, eps).addScaledVector(n, -eps / 4))
              && !uvnitr(stred.clone().addScaledVector(w2, eps).addScaledVector(n, eps / 4));
            if (!spravne(w)) { w.negate(); if (!spravne(w)) throw new Error('směr plochy u hrany nejde určit'); }
            return w;
          });
          const n1 = pole3(k.surfaceNormal(plochy[0], 0, 0));
          const vypukla = n1.dot(w2) < 0;
          const cosT = M.omez(w1.dot(w2), -1, 1), theta = Math.acos(cosT);
          // skoro rovná hrana (plochy z trojúhelníků): směr do plochy nejde spolehlivě určit, klín by ujel
          if (theta < 1e-3 || theta > Math.PI - 15 * Math.PI / 180) return null;
          const t = op === 'srazeni' ? h : h / Math.tan(theta / 2);
          // obě plochy musí být od hrany široké aspoň t (jinak by klín ukousl i sousední stěnu – třeba
          // zaoblení vnitřní hrany skořepiny poloměrem větším, než je stěna): v celé délce hrany
          if (vypukla) for (const f of [0.02, 0.25, 0.5, 0.75, 0.98]) {
            const q = A.clone().lerp(B, f);
            for (const [w, n] of [[w1, normaly[0]], [w2, normaly[1]]]) {
              const p = q.clone().addScaledVector(w, t * 0.999).addScaledVector(n, -Math.max(1e-3, t * 0.01));
              if (!uvnitr(p)) throw new UzkaPlocha();
            }
          }
          // přesah konců: klín pokračuje za konec hrany, dokud je v jeho průřezu těleso jen zčásti
          // (zaoblení nebo sražení sousední hrany – ořízne se rovinou sražení až ven); celý průřez
          // plný = souvislý materiál (rameno L, sousední stěna) → tam klín končí
          const presah = (P, sm) => {
            if (!vypukla) return 0;
            const krok = Math.max(t / 3, 0.05), max = 4 * t + 2 * h + 1;
            const vzorky = [[0.02, 0.02], [0.9, 0.05], [0.05, 0.9], [0.33, 0.33], [0.6, 0.2], [0.2, 0.6]];
            for (let d = krok; d <= max + 1e-9; d += krok) {
              const Q = P.clone().addScaledVector(smer, sm * d);
              const v = vzorky.map(([a, b]) => uvnitr(Q.clone().addScaledVector(w1, a * t).addScaledVector(w2, b * t)));
              if (v.every(Boolean)) return Math.max(0, d - krok);      // dál pokračuje plné těleso
              if (!v.some(Boolean)) return d + 0.05;                   // za tělesem
            }
            return max;
          };
          let m0 = presah(A, -1), m1 = presah(B, 1);
          // konec, kde dál pokračuje těleso, ale navazuje jiná upravovaná hrana (vnitřní roh okraje
          // krabičky): klín prodloužit a seříznout rovinou pokosu mezi oběma hranami – jinak v rohu
          // zůstane neořezaný zub
          const pokosy = [];
          for (const [P, sm, j] of [[A, -1, 0], [B, 1, 1]]) {
            if (!vypukla) continue;
            const ven = smer.clone().multiplyScalar(sm);              // směr za konec hrany
            let nej = null;
            for (const [oi, ko] of konce.entries()) {
              if (oi === ei || !ko) continue;
              // přímka jiné vybrané hrany: průsečík s přímkou téhle hrany za jejím koncem (sdílený vrchol, nebo roh,
              // ze kterého zbylo zaoblení – hrany se už nedotýkají, ale jejich přímky se pořád potkají v původním rohu)
              const d2 = ko[1].clone().sub(ko[0]), L2 = d2.length();
              if (L2 < 1e-9) continue;
              d2.divideScalar(L2);
              const w0 = P.clone().sub(ko[0]), b = ven.dot(d2), dd = ven.dot(w0), ee = d2.dot(w0), den = 1 - b * b;
              if (den < 1e-6) continue;                                // rovnoběžné
              const s1 = (b * ee - dd) / den, s2 = (ee - b * dd) / den;
              const Q1 = P.clone().addScaledVector(ven, s1), Q2 = ko[0].clone().addScaledVector(d2, s2);
              if (Q1.distanceTo(Q2) > 1e-4 * Math.max(1, L)) continue;   // mimoběžky
              if (s1 < -1e-6 || s1 > 4 * t + 2 * h + 1) continue;        // průsečík musí být kousek za koncem
              // druhá hrana musí ležet u průsečíku (ne někde daleko na téže přímce)
              const blizko = Math.min(Math.abs(s2), Math.abs(s2 - L2));
              if (s2 < -1e-6 && blizko > 4 * t + 2 * h + 1 || s2 > L2 + 1e-6 && blizko > 4 * t + 2 * h + 1) continue;
              if (!nej || s1 < nej.s1) {
                // cizí směr od průsečíku do druhé hrany
                const daleko = ko[0].distanceTo(Q1) > ko[1].distanceTo(Q1) ? ko[0] : ko[1];
                nej = { s1, Q: Q1, cizi: daleko.clone().sub(Q1).normalize() };
              }
            }
            if (!nej) continue;
            const m = ven.clone().negate().sub(nej.cizi);
            if (m.length() < 1e-6) continue;
            pokosy.push({ P: nej.Q, m: m.normalize() });
            const pr = nej.s1 + 2 * t + 0.05;
            if (j === 0) m0 = Math.max(m0, pr); else m1 = Math.max(m1, pr);
          }
          const A0 = A.clone().addScaledVector(smer, -m0), delka = L + m0 + m1;
          const P1 = A0.clone().addScaledVector(w1, t), P2 = A0.clone().addScaledVector(w2, t);
          const hr = [[A0, P1], [P1, P2], [P2, A0]].map(([a, b]) => k.makeLineEdge(a.x, a.y, a.z, b.x, b.y, b.z));
          const vh = vec32(hr);
          let klin;
          try { klin = k.extrude(k.makeFace(k.makeWire(vh)), smer.x * delka, smer.y * delka, smer.z * delka); } finally { vh.delete(); }
          if (op !== 'srazeni') {
            // válec poloměru h tečný k oběma plochám; delší než klín, ať se odečte čistě
            const C = A0.clone().addScaledVector(w1.clone().add(w2).normalize(), h / Math.sin(theta / 2)).addScaledVector(smer, -1);
            const u = new T().crossVectors(smer, Math.abs(smer.z) < 0.9 ? new T(0, 0, 1) : new T(1, 0, 0)).normalize(), v2 = new T().crossVectors(smer, u);
            const mat = new THREE.Matrix4().makeBasis(u, v2, smer).setPosition(C);
            klin = k.cut(klin, preved(k.makeCylinder(h, delka + 2), mat));
          }
          // seříznutí pokosem: pryč poloprostor za rovinou (na straně druhé hrany)
          for (const { P, m } of pokosy) {
            const S = 4 * (L + 4 * t + 10);
            const u = new T().crossVectors(m, Math.abs(m.z) < 0.9 ? new T(0, 0, 1) : new T(1, 0, 0)).normalize(), v3 = new T().crossVectors(m, u);
            const poz = P.clone().addScaledVector(m, -S).addScaledVector(u, -S / 2).addScaledVector(v3, -S / 2);
            klin = k.cut(klin, preved(k.makeBox(S, S, S), new THREE.Matrix4().makeBasis(m, u, v3).setPosition(poz)));
          }
          nastroje.push({ klin, vypukla });
        }
        const v0 = k.getVolume(x);
        let y = x;
        for (const { klin, vypukla } of nastroje) y = vypukla ? k.cut(y, klin) : k.fuse(y, klin);
        try { y = k.unifySameDomain(y); } catch (e) { /* nechat */ }
        const s = telesa(y);
        const v = k.getVolume(y);
        if (s.length !== 1 || !(v > 1e-9) || Math.abs(v - v0) > v0 * 0.5) return null;
        if (Math.abs(v - v0) > mezZmenyObjemu(x, hrany, op, h)) return null;
        try { if (!M.zkontrolujSit(sitZTelesa(k.copy(s[0]))).vodotesna) return null; } catch (e) { /* bez kontroly */ }
        try { if (!k.isValid(s[0])) return null; } catch (e) { /* bez kontroly */ }
        return s[0];
      } catch (e) {
        if (e instanceof UzkaPlocha) throw new Error(`${op === 'srazeni' ? 'sražení' : 'poloměr'} ${M.mm(h, 2)} mm je větší, než je plocha u vybrané hrany široká (třeba stěna skořepiny) – zkus menší ${op === 'srazeni' ? 'vzdálenost' : 'poloměr'}`);
        console.warn('OpenCascade (záloha hran):', zprava(e));
        return null;
      }
    }

    // ------------------------------------------------------------ síť z tělesa
    function sitZTelesa(t, presnost) {
      const bb = occC(PRAZDNE, () => k.getBoundingBox(t, false));
      if (![bb.xmin, bb.xmax, bb.ymin, bb.ymax, bb.zmin, bb.zmax].every(isFinite) || bb.xmax < bb.xmin) throw new Error(PRAZDNE);
      const vel = Math.hypot(bb.xmax - bb.xmin, bb.ymax - bb.ymin, bb.zmax - bb.zmin);
      const r = occ('tessellace', () => k.tessellate(t, presnost || Math.max(0.005, vel * 0.0012), 0.25));
      try {
        const poz = new Float32Array(m.HEAPF32.buffer.slice(r.getPositionsPtr(), r.getPositionsPtr() + r.positionCount * 4));
        const idx = new Uint32Array(m.HEAPU32.buffer.slice(r.getIndicesPtr(), r.getIndicesPtr() + r.indexCount * 4));
        return M.orientujVen(M.svarSit(poz, idx, 1e-5));
      } finally { r.delete(); }
    }

    /** Spustí f s úklidem: všechna tělesa vytvořená během f se uvolní. Výjimka WebAssembly (není Error,
        uživateli by se ukázalo „[object WebAssembly.Exception]“) se převede na českou chybu. */
    function sUklidem(f) {
      const znacka = k.checkpoint();
      try { return f(); }
      catch (e) {
        if (e instanceof Error) throw e;
        const z = zprava(e);
        console.warn('OpenCascade:', z);
        throw new Error(/no geometry|null shape|is null|empty/i.test(z) ? PRAZDNE : 'přesné jádro výpočet nezvládlo (' + z + ')');
      } finally { k.releaseSince(znacka); }
    }

    return {
      kernel: k, modul: m,
      brep: (u, site) => sUklidem(() => { const r = brepSkut(u, site); return { objem: occC(PRAZDNE, () => k.getVolume(r.t)) * r.f[0] * r.f[1] * r.f[2] }; }),
      hrany: (u, site) => sUklidem(() => {
        zeSite = 0;
        const r = brepSkut(u, site), f = r.f, jedna = jeJedna(f);
        return popisHran(r.t, zeSite > 0).map(e => {
          const w = occ('drátový model', () => k.wireframe(e.id, 0.02, 0));
          try {
            const body = new Float32Array(m.HEAPF32.buffer.slice(w.getPointsPtr(), w.getPointsPtr() + w.pointCount * 4));
            if (jedna) return { stred: e.stred, delka: e.delka, bod: e.bod, konce: e.konce, body };
            // do přirozených souřadnic lineárně (délka z lomené čáry)
            let delka = 0;
            for (let i = 0; i < body.length; i += 3) for (let j = 0; j < 3; j++) body[i + j] *= f[j];
            for (let i = 3; i < body.length; i += 3) delka += Math.hypot(body[i] - body[i - 3], body[i + 1] - body[i - 2], body[i + 2] - body[i - 1]);
            return { stred: krat(e.stred, f), delka, bod: e.bod && krat(e.bod, f), konce: e.konce && e.konce.map(q => krat(q, f)), body };
          } finally { w.delete(); }
        }).filter(e => e.body.length >= 6);
      }),
      plochy: (u, site) => sUklidem(() => {
        const r = brepSkut(u, site), f = r.f, det = f[0] * f[1] * f[2];
        return popisPloch(r.t).filter(x => x.rovina).map(({ stred, normala, plocha }) => {
          if (jeJedna(f)) return { stred, normala, plocha };
          const n = normala.map((x, i) => x / f[i]), l = Math.hypot(...n) || 1;
          return { stred: krat(stred, f), normala: n.map(x => x / l), plocha: plocha * Math.abs(det) * l };
        });
      }),
      sitUzlu: (u, site) => sUklidem(() => {
        const r = brepSkut(u, site), s = sitPrirozena(r);
        // přesná úprava, ze které vyjde děravá síť (OCCT ji „povolil“): chyba místo rozbitého tělesa
        if (u.occt && !M.zkontrolujSit(s).vodotesna) throw new Error({ zaobleni: ZPRAVA.zaobleni, srazeni: ZPRAVA.srazeni, skorepina: ZPRAVA.skorepina }[u.occt.operace] || 'přesná úprava dala děravé těleso');
        // getVolume u těles z generalTransform (B-spline po nerovnoměrném zvětšení) ujede až o procento:
        // když se od sítě liší víc než o půl procenta, platí síť
        const vo = occC(PRAZDNE, () => k.getVolume(r.t)) * Math.abs(r.f[0] * r.f[1] * r.f[2]), vs = Math.abs(M.objemSite(s));
        return Object.assign(s, { objem: Math.abs(vo - vs) > 0.005 * vs ? vs : vo });
      }),
      step: polozky => sUklidem(() => {
        proStep = true;
        let casti;
        try {
          casti = polozky.map(p => {
            const mat = new THREE.Matrix4(); mat.set(...p.matice, 0, 0, 0, 1);
            if (p.sit) return preved(zRovinnychPlochNeboTrojuhelniky(p.sit, p.uzel && p.uzel.nazev), mat);
            // těleso ve skutečné velikosti: matice světa bez vlastního měřítka (u upravené skupiny tuhá –
            // roviny zůstanou rovinami i ve STEP)
            const r = brepSkut(p.uzel, p.site);
            return preved(r.t, mat.multiply(new THREE.Matrix4().makeScale(...r.f)));
          });
        } finally { proStep = false; }
        const v = vec32(casti);
        try { return occ('export STEP', () => k.exportStep(casti.length === 1 ? casti[0] : k.makeCompound(v))); } finally { v.delete(); }
      }),
      importStep: text => sUklidem(() => {
        let t;
        try { t = k.importStep(text); } catch (e) { throw new Error('STEP se nepodařilo přečíst – soubor je poškozený nebo neobsahuje žádné těleso (' + zprava(e) + ')'); }
        const bb = k.getBoundingBox(t, false);
        return { sit: sitZTelesa(t), stred: [(bb.xmin + bb.xmax) / 2, (bb.ymin + bb.ymax) / 2, (bb.zmin + bb.zmax) / 2], objem: k.getVolume(t) };
      }),
    };

    /** Pro STEP: síť z rovinných ploch, a když je moc složitá, jako trojúhelníky (STL). */
    function zRovinnychPlochNeboTrojuhelniky(sit, nazev, proStep = true) {
      zeSite++;
      if (sit.idx.length / 3 <= MAX_TROJ_PLOCH) { try { return zRovinnychPloch(sit, nazev); } catch (e) { /* zkusit trojúhelníky */ } }
      // ve STEP je každý trojúhelník samostatná plocha (~5 kB): šroub se závitem by měl stovky MB
      const n = sit.idx.length / 3;
      if (n > MAX_TROJ_STEP && !proStep) throw new Error(`„${nazev || 'těleso'}“ je pro přesnou úpravu příliš složité (${Math.round(n).toLocaleString('cs')} trojúhelníků, nejvýš ${MAX_TROJ_STEP.toLocaleString('cs')}).`);
      if (n > MAX_TROJ_STEP) throw new Error(`„${nazev || 'těleso'}“ má ${Math.round(n).toLocaleString('cs')} trojúhelníků – ve STEP by mělo asi ${Math.round(n * 5 / 1024)} MB. `
        + 'Díly se závity a velké importované sítě exportuj do STL nebo 3MF (nebo je ze STEP vynech).');
      return occ('síť do STEP', () => k.importStlBinary(M.stl.zapis([bezDegenerovanych(sit)])));
    }
    /** OCCT odmítne celé STL kvůli jedinému zdegenerovanému trojúhelníku (po zaokrouhlení na float32). */
    function bezDegenerovanych(sit) {
      const p = sit.poz, t = sit.idx, f = Math.fround, idx = [];
      const V = j => [f(p[j * 3]), f(p[j * 3 + 1]), f(p[j * 3 + 2])];
      for (let i = 0; i < t.length; i += 3) {
        const a = V(t[i]), b = V(t[i + 1]), c = V(t[i + 2]);
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
        const e = Math.min(Math.hypot(...u), Math.hypot(...v), Math.hypot(b[0] - c[0], b[1] - c[1], b[2] - c[2]));
        if (n >= 1e-6 && e >= 1e-4) idx.push(t[i], t[i + 1], t[i + 2]);
      }
      return { poz: p, idx };
    }
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
