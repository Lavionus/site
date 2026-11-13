/* ============================================================
   text3d/jadro.js – 3D text z písma bez DOM (v node ho čtou _test/text3d_tesnost.js, text3d_oblouk_kolik.js, text3d_test.js).
   Potřebuje THREE (r128, ExtrudeGeometry), ClipperLib, opentype font (načítá stránka), gen3d/zaklad.js (G3D.normalizuj).
   TEXT3D         – geometrie: rozvrhni, model (díly = vodorovné vrstvy {ex, z0, z1}), trojúhelníky, objem
   TEXT3D_EXPORT  – STL, 3MF (díly pro 2 barvy), ZIP, SVG
   TEXT3D_PROJEKT – stav stránky (VYCHOZI, normalizuj, starý odkaz #n=), předvolby, podložka tiskárny, rozložení písmen
   ============================================================ */
  /* ====================================================================
     1. GEOMETRIE – čisté funkce bez DOM (window.TEXT3D kvůli testům)
     ==================================================================== */
  const TEXT3D = (function () {
    const SC = 1000;            // Clipper počítá v celých číslech: 1 mm = 1000 jednotek
    const C = ClipperLib;

    function vyskaVersalky(font) {
      const os2 = font.tables.os2;
      if (os2 && os2.sCapHeight > 0) return os2.sCapHeight;
      const g = font.charToGlyph('H');
      if (g && g.index) { const b = g.getBoundingBox(); if (b.y2 > 0) return b.y2; }
      return font.unitsPerEm * 0.7;
    }

    /* Křivky glyfu → lomené čáry v mm. Počet úseků se řídí průhybem
       křivky (druhou diferencí řídicích bodů): odchylka tětivy od
       oblouku zůstane pod `tol` mm, ať je písmo malé, nebo metrové.
       Rovné úseky tak nedostanou zbytečné body, které by jen
       zpomalovaly sjednocení a nafukovaly STL.                      */
    function obrysyGlyfu(glyph, ox, oy, s, tol) {
      const cmds = glyph.path.commands;
      const vysledek = [];
      let cur = null, x = 0, y = 0;
      const P = (px, py) => ({ x: (ox + px) * s, y: (oy + py) * s });
      const useku = (dd, k) => Math.max(1, Math.min(64, Math.ceil(Math.sqrt(k * dd * s / tol))));
      for (const c of cmds) {
        if (c.type === 'M') {
          if (cur && cur.length > 2) vysledek.push(cur);
          cur = [P(c.x, c.y)]; x = c.x; y = c.y;
        } else if (c.type === 'L') {
          cur.push(P(c.x, c.y)); x = c.x; y = c.y;
        } else if (c.type === 'Q') {
          const n = useku(Math.hypot(x - 2 * c.x1 + c.x, y - 2 * c.y1 + c.y), 0.25);
          for (let i = 1; i <= n; i++) {
            const t = i / n, u = 1 - t;
            cur.push(P(u * u * x + 2 * u * t * c.x1 + t * t * c.x, u * u * y + 2 * u * t * c.y1 + t * t * c.y));
          }
          x = c.x; y = c.y;
        } else if (c.type === 'C') {
          const n = useku(Math.max(Math.hypot(x - 2 * c.x1 + c.x2, y - 2 * c.y1 + c.y2),
                                   Math.hypot(c.x1 - 2 * c.x2 + c.x, c.y1 - 2 * c.y2 + c.y)), 0.75);
          for (let i = 1; i <= n; i++) {
            const t = i / n, u = 1 - t;
            cur.push(P(u * u * u * x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
                       u * u * u * y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y));
          }
          x = c.x; y = c.y;
        } else if (c.type === 'Z') {
          if (cur && cur.length > 2) vysledek.push(cur);
          cur = null;
        }
      }
      if (cur && cur.length > 2) vysledek.push(cur);
      return vysledek;
    }

    function glyfyRadku(font, radek) {
      try { return font.stringToGlyphs(radek); }
      catch (e) { return Array.from(radek).map(ch => font.charToGlyph(ch)); }
    }

    /* Rozvrhne text do řádků a vrátí obrysy v mm (osa y nahoru).
       Znaménka s nulovou šířkou (tehtar tengwaru, kombinující diakritika)
       se vystředí nad předchozí písmeno – opentype.js totiž neumí
       kotvy GPOS, podle kterých je umisťuje prohlížeč.               */
    function rozvrhni(font, text, o) {
      const upm = font.unitsPerEm;
      const cap = vyskaVersalky(font);
      const radky = text.replace(/\t/g, ' ').replace(/\r/g, '').split('\n');
      const chybi = new Set();
      for (const ch of text) {
        if (/\s/.test(ch)) continue;
        if (font.charToGlyphIndex(ch) === 0) chybi.add(ch);
      }

      function sestav(s) {
        const vyskaRadku = (font.ascender - font.descender) * o.radkovani;
        const mezera = o.mezery / s;          // mm → jednotky fontu
        const krok = 0.03;           // dovolená odchylka od křivky v mm
        const radkoveSkupiny = [];
        radky.forEach((radek, ri) => {
          const glyfy = glyfyRadku(font, radek);
          // skupina = písmeno i se znaménky, která k němu patří (kvůli oblouku
          // se natáčí jako celek, aby tehta neujela od své souhlásky)
          const skupiny = [];
          let x = 0, posledni = null;
          const y = -ri * vyskaRadku;
          for (let i = 0; i < glyfy.length; i++) {
            const g = glyfy[i];
            if (!g) continue;
            const znamenko = !g.advanceWidth && g.path && g.path.commands.length;
            if (znamenko && posledni) {
              const bb = g.getBoundingBox();
              const posun = posledni.stredJ - (bb.x1 + bb.x2) / 2;
              if (g.index) posledni.obrysy.push(...obrysyGlyfu(g, posun, y, s, krok));
              continue;
            }
            if (i > 0 && glyfy[i - 1]) {
              try { x += font.getKerningValue(glyfy[i - 1], g) || 0; } catch (e) { /* bez kerningu */ }
            }
            if (g.index) {
              const bb = g.getBoundingBox();
              const ma = isFinite(bb.x1) && bb.x2 > bb.x1;
              posledni = { obrysy: obrysyGlyfu(g, x, y, s, krok), stredJ: x + (ma ? (bb.x1 + bb.x2) / 2 : (g.advanceWidth || 0) / 2) };
              posledni.stred = posledni.stredJ * s;
              skupiny.push(posledni);
              if (!ma) posledni = null;
            }
            x += (g.advanceWidth || 0) + mezera;
          }
          const sirka = Math.max(0, x - (glyfy.length ? mezera : 0)) * s;
          radkoveSkupiny.push({ skupiny, sirka, zaklad: y * s });
        });
        // zarovnání řádků
        const maxS = Math.max(0, ...radkoveSkupiny.map(r => r.sirka));
        for (const r of radkoveSkupiny) {
          const dx = o.zarovnani === 'vlevo' ? 0 : o.zarovnani === 'vpravo' ? maxS - r.sirka : (maxS - r.sirka) / 2;
          for (const g of r.skupiny) { g.stred += dx; g.obrysy = g.obrysy.map(c => c.map(p => ({ x: p.x + dx, y: p.y }))); }
        }
        const vse = [];
        const uhel = (o.oblouk || 0) * Math.PI / 180;
        if (Math.abs(uhel) < 1e-4 || maxS <= 0) {
          for (const r of radkoveSkupiny) for (const g of r.skupiny) vse.push(...g.obrysy);
          return vse;
        }
        /* Oblouk: nejdelší řádek se ohne o zadaný úhel. Kladný úhel = text
           na horní straně kružnice (střed pod ním), záporný = „úsměv“.
           Vzdálenosti mezi písmeny se zachovávají v polovině výšky písmen
           (ne na účaří) – jinak by se u „úsměvu“ vršky slévaly a u oblouku
           nahoru rozjížděly. Další řádky leží na soustředných kružnicích. */
        const hm = cap * s / 2;
        const R = maxS / Math.abs(uhel), nahoru = uhel > 0;
        const z0 = radkoveSkupiny[0].zaklad, stredX = maxS / 2;
        const C = { x: stredX, y: nahoru ? z0 + hm - R : z0 + hm + R };
        for (const r of radkoveSkupiny) {
          const Rz = nahoru ? R - hm + (r.zaklad - z0) : R + hm - (r.zaklad - z0);   // poloměr účaří
          const Rs = nahoru ? Rz + hm : Rz - hm;                                      // poloměr poloviny výšky
          for (const g of r.skupiny) {
            const a = (g.stred - stredX) / Math.max(Rs, 1e-3);
            const sn = Math.sin(a), cs = Math.cos(a);
            for (const c of g.obrysy) vse.push(c.map(p => {
              const dx = p.x - g.stred, h = p.y - r.zaklad;
              return nahoru
                ? { x: C.x + (Rz + h) * sn + dx * cs, y: C.y + (Rz + h) * cs - dx * sn }
                : { x: C.x + (Rz - h) * sn + dx * cs, y: C.y - (Rz - h) * cs + dx * sn };
            }));
          }
        }
        return vse;
      }

      let s = o.vyska / cap;
      let obrysy = sestav(s);
      if (o.mereni === 'celek' && obrysy.length) {
        const b = mezeBodu(obrysy);
        const h = b.y1 - b.y0;
        if (h > 1e-6) { s *= o.vyska / h; obrysy = sestav(s); }
      }
      return { obrysy, chybi: [...chybi], meritko: s, upm };
    }

    function mezeBodu(obrysy) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of obrysy) for (const p of c) {
        if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
        if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
      }
      return { x0, x1, y0, y1 };
    }

    /* ---------- Clipper: sjednocení, rozdíl, offset ----------
       „Ex“ = {obrys: cesta, diry: [cesty]} – přesně to, co potřebuje
       THREE.Shape. Cesty jsou pole {X, Y} v celých µm.              */
    function naCesty(obrysy) {
      return obrysy.map(c => c.map(p => ({ X: Math.round(p.x * SC), Y: Math.round(p.y * SC) })));
    }
    function stromNaEx(strom) {
      const out = [];
      const projdi = uzel => {
        for (const vnejsi of uzel.Childs()) {
          const ex = { obrys: vnejsi.Contour(), diry: [] };
          for (const dira of vnejsi.Childs()) {
            ex.diry.push(dira.Contour());
            projdi(dira);           // ostrůvky uvnitř díry (tečka v O apod.)
          }
          if (ex.obrys.length > 2) out.push(ex);
        }
      };
      projdi(strom);
      return out;
    }
    function exNaCesty(exy) {
      const p = [];
      for (const e of exy) { p.push(e.obrys); for (const d of e.diry) p.push(d); }
      return p;
    }
    function operace(typ, a, b, pravidlo) {
      const c = new C.Clipper();
      c.StrictlySimple = true;
      if (a.length) c.AddPaths(a, C.PolyType.ptSubject, true);
      if (b && b.length) c.AddPaths(b, C.PolyType.ptClip, true);
      const strom = new C.PolyTree();
      const pf = pravidlo || C.PolyFillType.pftNonZero;
      c.Execute(typ, strom, pf, pf);
      return stromNaEx(strom);
    }
    const sjednot = (cesty, pravidlo) => operace(C.ClipType.ctUnion, cesty, null, pravidlo);
    const odecti = (exA, exB) => operace(C.ClipType.ctDifference, exNaCesty(exA), exNaCesty(exB));
    const prunik = (exA, exB) => operace(C.ClipType.ctIntersection, exNaCesty(exA), exNaCesty(exB));
    // `ostre` = rohy se nezaoblují (rychlejší; stačí pro odhad tenkých tahů)
    function offset(exy, mm, ostre) {
      if (!mm) return exy;
      const co = new C.ClipperOffset(2, 0.04 * SC);
      co.AddPaths(exNaCesty(exy), ostre ? C.JoinType.jtMiter : C.JoinType.jtRound, C.EndType.etClosedPolygon);
      const strom = new C.PolyTree();
      co.Execute(strom, mm * SC);
      return stromNaEx(strom);
    }
    function plocha(exy) {
      let a = 0;
      for (const e of exy) { a += Math.abs(C.Clipper.Area(e.obrys)); for (const d of e.diry) a -= Math.abs(C.Clipper.Area(d)); }
      return a / (SC * SC);
    }
    function meze(exy) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const e of exy) for (const p of e.obrys) {
        if (p.X < x0) x0 = p.X; if (p.X > x1) x1 = p.X;
        if (p.Y < y0) y0 = p.Y; if (p.Y > y1) y1 = p.Y;
      }
      return { x0: x0 / SC, x1: x1 / SC, y0: y0 / SC, y1: y1 / SC };
    }
    const bodyNaEx = body => [{ obrys: body.map(p => ({ X: Math.round(p.x * SC), Y: Math.round(p.y * SC) })), diry: [] }];
    function kruh(cx, cy, r, n) {
      const b = [];
      n = n || 64;
      for (let i = 0; i < n; i++) b.push({ x: cx + r * Math.cos(2 * Math.PI * i / n), y: cy + r * Math.sin(2 * Math.PI * i / n) });
      return b;
    }

    /* ---------- deska ---------- */
    function deska(textEx, o) {
      const m = meze(textEx);
      const cx = (m.x0 + m.x1) / 2, cy = (m.y0 + m.y1) / 2;
      const w = m.x1 - m.x0 + 2 * o.okraj, h = m.y1 - m.y0 + 2 * o.okraj;
      let obrys, otvory = [];
      const d = o.otvorPrumer;
      const odKraje = Math.max(d / 2 + 1.2, o.okraj / 2);
      if (o.tvar === 'obrys') {
        // obrys textu roztažený o okraj, bez vnitřních děr (vnitřek O apod.)
        // díry i jemné detaily obrysu jsou pro desku zbytečné a offset zdržují
        const hrube = textEx.map(e => ({ obrys: C.Clipper.CleanPolygon(e.obrys, 0.08 * SC), diry: [] })).filter(e => e.obrys.length > 2);
        obrys = offset(sjednot(exNaCesty(hrube)), Math.max(o.okraj, 0.5)).map(e => ({ obrys: e.obrys, diry: [] }));
        obrys = sjednot(exNaCesty(obrys));
      } else if (o.tvar === 'oval') {
        const a = (m.x1 - m.x0) / 2 * Math.SQRT2 + o.okraj, b = (m.y1 - m.y0) / 2 * Math.SQRT2 + o.okraj;
        const body = [];
        for (let i = 0; i < 128; i++) body.push({ x: cx + a * Math.cos(Math.PI * 2 * i / 128), y: cy + b * Math.sin(Math.PI * 2 * i / 128) });
        obrys = bodyNaEx(body);
        if (o.otvory === 2) otvory = [[cx - a + odKraje, cy], [cx + a - odKraje, cy]];
        else if (o.otvory === 4) {
          const k = Math.SQRT1_2;
          const ra = a - odKraje * 1.2, rb = b - odKraje * 1.2;
          otvory = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [cx + sx * ra * k, cy + sy * rb * k]);
        }
      } else {
        const r = Math.max(0, Math.min(o.rohy, w / 2 - 0.01, h / 2 - 0.01));
        const zaklad = bodyNaEx([
          { x: cx - w / 2 + r, y: cy - h / 2 + r }, { x: cx + w / 2 - r, y: cy - h / 2 + r },
          { x: cx + w / 2 - r, y: cy + h / 2 - r }, { x: cx - w / 2 + r, y: cy + h / 2 - r }]);
        obrys = r > 0 ? offset(zaklad, r) : zaklad;
        const kx = w / 2 - Math.max(odKraje, r * 0.35 + d / 2 + 1), ky = h / 2 - Math.max(odKraje, r * 0.35 + d / 2 + 1);
        if (o.otvory === 2) otvory = [[cx - (w / 2 - odKraje), cy], [cx + (w / 2 - odKraje), cy]];
        else if (o.otvory === 4) otvory = [[cx - kx, cy - ky], [cx + kx, cy - ky], [cx + kx, cy + ky], [cx - kx, cy + ky]];
      }
      const diryEx = otvory.length ? sjednot(exNaCesty(otvory.flatMap(([x, y]) => bodyNaEx(kruh(x, y, d / 2, 48))))) : [];
      return { obrys, diryEx };
    }

    /* Postaví díly modelu. Každý díl = vrstvy {ex, z0, z1} – vodorovné
       desky vytažené z 2D oblastí. Nic víc než vytažení není potřeba:
       rytina i šablona jsou jen rozdíl oblastí v jiné výšce.           */
    function model(fontObj, text, o) {
      const r = rozvrhni(fontObj, text, o);
      const hlaseni = [];
      if (r.chybi.length) hlaseni.push({ chyba: false, text: 'Font nemá znaky: ' + r.chybi.join(' ') + ' – na jejich místě je mezera.' });
      let textEx = sjednot(naCesty(r.obrysy));
      if (o.tucnost) textEx = offset(textEx, o.tucnost);
      // vycentrovat na počátek
      if (textEx.length) {
        const m = meze(textEx);
        const dx = Math.round(-(m.x0 + m.x1) / 2 * SC), dy = Math.round(-(m.y0 + m.y1) / 2 * SC);
        for (const e of textEx) for (const c of [e.obrys, ...e.diry]) for (const p of c) { p.X += dx; p.Y += dy; }
      }
      const dily = { text: [], deska: [] };
      if (!textEx.length) return { dily, textEx, hlaseni, desk: null };

      // tenké tahy: co zmizí po „otevření“ (zúžit a zase rozšířit)
      const minTah = 0.8;
      const otevrene = offset(offset(textEx, -minTah / 2, true), minTah / 2, true);
      const ztrata = 1 - plocha(otevrene) / Math.max(plocha(textEx), 1e-9);
      if (ztrata > 0.03) hlaseni.push({ chyba: false, text: `Některé tahy jsou tenčí než ${minTah} mm (${Math.round(ztrata * 100)} % plochy písma). Zvětšete písmo nebo je ztučněte.` });

      const h = o.hloubka;
      let desk = null;
      let kusy = null;
      if (o.rezim === 'pismena') {
        kusy = textEx.map(ex => ({ ex, otvory: [] }));
        if (o.kolik && o.kolikPrumer > 0) {
          const hk = Math.min(o.kolikHloubka, h - 0.8);
          if (hk < 0.4) hlaseni.push({ chyba: false, text: 'Otvory na kolíky se nevejdou – písmena jsou na ně příliš tenká (potřeba aspoň o 1,2 mm víc než hloubka otvoru).' });
          else {
            let bez = 0;
            for (const k of kusy) {
              k.otvory = otvoryKusu(k.ex, o.kolikPrumer, o.kolik);
              if (!k.otvory.length && plocha([k.ex]) > 4 * o.kolikPrumer * o.kolikPrumer) bez++;
            }
            if (bez) hlaseni.push({ chyba: false, text: `U ${bez} ${bez === 1 ? 'dílu' : 'dílů'} se otvor ø ${o.kolikPrumer} mm nevejde (tah je moc úzký). Zmenšete průměr nebo ztučněte písmo.` });
            for (const k of kusy) k.hloubkaOtvoru = hk;
          }
        }
        dily.text.push(...vrstvyKusu(kusy, h));
      } else {
        desk = deska(textEx, o);
        const p = o.deskaTl;
        const plna = odecti(desk.obrys, desk.diryEx);
        if (desk.diryEx.length && prunik(desk.diryEx, textEx).length) hlaseni.push({ chyba: false, text: 'Otvory na šrouby zasahují do písmen – zvětšete okraj.' });
        if (o.rezim === 'relief') {
          dily.deska.push({ ex: plna, z0: 0, z1: p });
          dily.text.push({ ex: prunik(textEx, desk.obrys), z0: p, z1: p + h });
        } else if (o.rezim === 'ryti') {
          const d = Math.min(o.ryti, p - 0.4);
          dily.deska.push({ ex: plna, z0: 0, z1: p - d });
          dily.deska.push({ ex: odecti(plna, textEx), z0: p - d, z1: p });
          if (o.vypln) dily.text.push({ ex: prunik(textEx, desk.obrys), z0: p - d, z1: p });
        } else if (o.rezim === 'sablona') {
          const s = odecti(plna, textEx);
          dily.deska.push({ ex: s, z0: 0, z1: p });
          if (s.length > 1) hlaseni.push({ chyba: false, text: `Šablona se rozpadne na ${s.length} kusy – vnitřky písmen (O, A, 8…) nejsou ničím drženy. Pomůže šablonové písmo (Saira Stencil One, Black Ops One).` });
        }
        if (o.ramSirka > 0) {
          const vnitrek = offset(desk.obrys, -o.ramSirka);
          const prstenec = odecti(odecti(desk.obrys, vnitrek), desk.diryEx);
          dily.deska.push({ ex: prstenec, z0: p, z1: p + o.ramVyska });
        }
      }
      return { dily, textEx, hlaseni, desk, kusy };
    }

    /* ---------- otvory na kolíky ----------
       Slepé otvory ze zadní strany samostatných písmen (tisknou se na
       podložce, otvor je zespodu otevřený). Střed otvoru smí ležet jen
       tam, kde kolem něj zbude stěna: to je písmeno zúžené o poloměr
       otvoru a stěnu. Ze zbylé plochy se vezme bod co nejblíž těžišti,
       u dvou otvorů pak ještě bod co nejdál od prvního.              */
    function otvoryKusu(ex, prumer, pocet) {
      const stena = 1.2, r = prumer / 2;
      const oblast = offset([{ obrys: ex.obrys, diry: ex.diry }], -(r + stena), true);
      if (!oblast.length) return [];
      const body = [];
      for (const e of oblast) for (const p of C.Clipper.CleanPolygon(e.obrys, 0.3 * SC)) body.push({ x: p.X / SC, y: p.Y / SC });
      if (!body.length) return [];
      const m = meze([ex]);
      const t = { x: (m.x0 + m.x1) / 2, y: (m.y0 + m.y1) / 2 };
      const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      const prvni = body.reduce((a, b) => d2(b, t) < d2(a, t) ? b : a);
      const stredy = [prvni];
      if (pocet >= 2) {
        const druhy = body.reduce((a, b) => d2(b, prvni) > d2(a, prvni) ? b : a);
        if (Math.sqrt(d2(druhy, prvni)) >= prumer + 2 * stena) stredy.push(druhy);
      }
      return sjednot(exNaCesty(stredy.map(c => bodyNaEx(kruh(c.x, c.y, r, 40))[0])));
    }
    // vrstvy dílu: dole písmeno s otvory, nad nimi plné
    function vrstvyKusu(kusy, h) {
      const sOtvory = kusy.filter(k => k.otvory.length);
      const bez = kusy.filter(k => !k.otvory.length);
      const vrstvy = [];
      if (bez.length) vrstvy.push({ ex: bez.map(k => k.ex), z0: 0, z1: h });
      if (sOtvory.length) {
        const hk = sOtvory[0].hloubkaOtvoru;
        vrstvy.push({ ex: sOtvory.flatMap(k => odecti([k.ex], k.otvory)), z0: 0, z1: hk });
        vrstvy.push({ ex: sOtvory.map(k => k.ex), z0: hk, z1: h });
      }
      return vrstvy;
    }

    /* ---------- trojúhelníky ---------- */
    /* Body ležící na přímce mezi sousedy se musí odstranit předem:
       triangulace víka (earcut) je sama vynechá, boční stěna by je
       ale měla – vznikl by T-spoj a síť by nebyla těsná.            */
    const vycisti = c => C.Clipper.CleanPolygon(c, 2);
    function exNaTvary(exy) {
      const tvary = [];
      for (const e of exy) {
        const obrys = vycisti(e.obrys);
        if (obrys.length < 3) continue;
        const tvar = new THREE.Shape(obrys.map(p => new THREE.Vector2(p.X / SC, p.Y / SC)));
        for (const d0 of e.diry) {
          const d = vycisti(d0);
          if (d.length >= 3) tvar.holes.push(new THREE.Path(d.map(p => new THREE.Vector2(p.X / SC, p.Y / SC))));
        }
        tvary.push(tvar);
      }
      return tvary;
    }
    function geometrieVrstvy(v) {
      if (!v.ex.length || v.z1 - v.z0 <= 1e-6) return null;
      const g = new THREE.ExtrudeGeometry(exNaTvary(v.ex), { depth: v.z1 - v.z0, bevelEnabled: false, curveSegments: 1, steps: 1 });
      g.translate(0, 0, v.z0);
      return g;
    }
    // `surove` = bez opravy T-spojů (na objem stačí a je rychlejší)
    function trojuhelniky(geometrie, surove) {
      let t = [];
      for (const g of geometrie) {
        const gg = g.index ? g.toNonIndexed() : g;
        const a = gg.attributes.position.array;
        const tg = [];
        for (let i = 0; i < a.length; i += 9) tg.push([[a[i], a[i + 1], a[i + 2]], [a[i + 3], a[i + 4], a[i + 5]], [a[i + 6], a[i + 7], a[i + 8]]]);
        t = t.concat(surove ? tg : opravTSpoje(tg));
      }
      return t;
    }

    /* Earcut občas nechá bod díry ležet přesně na hraně sousedního
       trojúhelníku víka (když je vrchol obrysu na jedné přímce s hranou
       díry), nebo vyrobí trojúhelník s nulovou plochou. Tvar je v pořádku,
       ale síť má T-spoj: hrana na jedné straně nemá protějšek a slicer
       hlásí „opravené chyby“. Oprava: ploché trojúhelníky pryč, a kde
       hrana nemá protějšek a leží na ní cizí vrchol, trojúhelník se
       v tom vrcholu rozdělí.                                          */
    function opravTSpoje(tri) {
      const k = v => Math.round(v[0] * 1e4) + ',' + Math.round(v[1] * 1e4) + ',' + Math.round(v[2] * 1e4);
      const plocha2 = ([a, b, c]) => {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      };
      tri = tri.filter(t => plocha2(t) > 1e-8);
      for (let kolo = 0; kolo < 4; kolo++) {
        const hrany = new Set();
        const kl = tri.map(t => [k(t[0]), k(t[1]), k(t[2])]);
        for (const q of kl) for (let e = 0; e < 3; e++) hrany.add(q[e] + '|' + q[(e + 1) % 3]);
        const osirele = [];
        kl.forEach((q, i) => { for (let e = 0; e < 3; e++) if (!hrany.has(q[(e + 1) % 3] + '|' + q[e])) osirele.push([i, e]); });
        if (!osirele.length) break;
        const kandidati = new Map();
        for (const [i, e] of osirele) for (const j of [e, (e + 1) % 3]) kandidati.set(kl[i][j], tri[i][j]);
        const deleni = new Map();
        for (const [i, e] of osirele) {
          if (deleni.has(i)) continue;
          const p = tri[i][e], q = tri[i][(e + 1) % 3];
          const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
          const L2 = dx * dx + dy * dy + dz * dz;
          const body = [];
          for (const [kv, v] of kandidati) {
            if (kv === kl[i][e] || kv === kl[i][(e + 1) % 3]) continue;
            const t = ((v[0] - p[0]) * dx + (v[1] - p[1]) * dy + (v[2] - p[2]) * dz) / L2;
            if (t <= 1e-9 || t >= 1 - 1e-9) continue;
            const ox = p[0] + dx * t - v[0], oy = p[1] + dy * t - v[1], oz = p[2] + dz * t - v[2];
            if (ox * ox + oy * oy + oz * oz < 1e-10) body.push([t, v]);
          }
          if (body.length) deleni.set(i, { e, body: body.sort((x, y) => x[0] - y[0]).map(x => x[1]) });
        }
        if (!deleni.size) break;
        const nove = [];
        tri.forEach((t, i) => {
          const d = deleni.get(i);
          if (!d) { nove.push(t); return; }
          const p = t[d.e], q = t[(d.e + 1) % 3], r = t[(d.e + 2) % 3];
          const rada = [p, ...d.body, q];
          for (let j = 0; j + 1 < rada.length; j++) nove.push([rada[j], rada[j + 1], r]);
        });
        tri = nove;
      }
      return tri;
    }
    function objem(tri) {
      let v = 0;
      for (const [a, b, c] of tri) v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
      return v;
    }

    return { SC, rozvrhni, model, geometrieVrstvy, trojuhelniky, objem, meze, plocha, exNaCesty, sjednot, offset, vrstvyKusu };
  })();
  window.TEXT3D = TEXT3D;

  /* ====================================================================
     2. EXPORT – STL, 3MF, SVG, ZIP
     ==================================================================== */
  const EXPORT = (function () {
    function normala(t) {
      const [a, b, c] = t;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const d = Math.hypot(nx, ny, nz) || 1;
      return [nx / d, ny / d, nz / d];
    }
    function stl(tri, popis) {
      const buf = new ArrayBuffer(84 + tri.length * 50);
      const dv = new DataView(buf);
      const hl = ('3D text: ' + popis).replace(/[^\x20-\x7e]/g, '?').slice(0, 80);
      for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i));
      dv.setUint32(80, tri.length, true);
      let p = 84;
      for (const t of tri) {
        const n = normala(t);
        for (const k of n) { dv.setFloat32(p, k, true); p += 4; }
        for (const v of t) for (const k of v) { dv.setFloat32(p, k, true); p += 4; }
        dv.setUint16(p, 0, true); p += 2;
      }
      return new Uint8Array(buf);
    }

    // síť s indexy (3MF chce sdílené vrcholy)
    function indexuj(tri) {
      const mapa = new Map(), vrcholy = [], troj = [];
      const id = v => {
        const k = v[0].toFixed(4) + ',' + v[1].toFixed(4) + ',' + v[2].toFixed(4);
        let i = mapa.get(k);
        if (i === undefined) { i = vrcholy.length; vrcholy.push(v); mapa.set(k, i); }
        return i;
      };
      for (const t of tri) {
        const a = id(t[0]), b = id(t[1]), c = id(t[2]);
        if (a !== b && b !== c && a !== c) troj.push([a, b, c]);
      }
      return { vrcholy, troj };
    }
    function mf3(dily) {
      // dily: [{nazev, tri, barva}] – jeden objekt složený z dílů
      const obj = [];
      let id = 1;
      const barvy = dily.map(d => `<base name="${d.nazev}" displaycolor="${d.barva.toUpperCase()}FF"/>`).join('');
      const komp = [];
      dily.forEach((d, i) => {
        const m = indexuj(d.tri);
        const v = m.vrcholy.map(p => `<vertex x="${p[0].toFixed(4)}" y="${p[1].toFixed(4)}" z="${p[2].toFixed(4)}"/>`).join('');
        const t = m.troj.map(q => `<triangle v1="${q[0]}" v2="${q[1]}" v3="${q[2]}"/>`).join('');
        obj.push(`<object id="${id + 1}" name="${d.nazev}" type="model" pid="1" pindex="${i}"><mesh><vertices>${v}</vertices><triangles>${t}</triangles></mesh></object>`);
        komp.push(`<component objectid="${id + 1}"/>`);
        id++;
      });
      const hlavni = id + 1;
      const model = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<model unit="millimeter" xml:lang="cs-CZ" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
        + '<metadata name="Title">3D text</metadata><resources>'
        + `<basematerials id="1">${barvy}</basematerials>`
        + obj.join('')
        + `<object id="${hlavni}" name="3D text" type="model"><components>${komp.join('')}</components></object>`
        + `</resources><build><item objectid="${hlavni}"/></build></model>`;
      const typy = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
      const rels = '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
      const enc = new TextEncoder();
      return zip([
        { jmeno: '[Content_Types].xml', data: enc.encode(typy) },
        { jmeno: '_rels/.rels', data: enc.encode(rels) },
        { jmeno: '3D/3dmodel.model', data: enc.encode(model) },
      ]);
    }

    /* ZIP bez komprese („uloženo“) + CRC32 – na STL a 3MF stačí. */
    const CRC = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
      return t;
    })();
    function crc32(d) { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
    function zip(soubory) {
      const enc = new TextEncoder();
      const casti = [], centralni = [];
      let pos = 0;
      for (const s of soubory) {
        const jm = enc.encode(s.jmeno);
        const crc = crc32(s.data);
        const h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
        h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
        h.setUint32(14, crc, true); h.setUint32(18, s.data.length, true); h.setUint32(22, s.data.length, true);
        h.setUint16(26, jm.length, true); h.setUint16(28, 0, true);
        casti.push(new Uint8Array(h.buffer), jm, s.data);
        const c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
        c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true);
        c.setUint32(16, crc, true); c.setUint32(20, s.data.length, true); c.setUint32(24, s.data.length, true);
        c.setUint16(28, jm.length, true); c.setUint32(42, pos, true);
        centralni.push(new Uint8Array(c.buffer), jm);
        pos += 30 + jm.length + s.data.length;
      }
      const velC = centralni.reduce((a, b) => a + b.length, 0);
      const k = new DataView(new ArrayBuffer(22));
      k.setUint32(0, 0x06054b50, true); k.setUint16(8, soubory.length, true); k.setUint16(10, soubory.length, true);
      k.setUint32(12, velC, true); k.setUint32(16, pos, true);
      return new Blob([...casti, ...centralni, new Uint8Array(k.buffer)], { type: 'application/zip' });
    }

    function svg(textEx, deskaEx, SC) {
      const vse = textEx.concat(deskaEx || []);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const e of vse) for (const p of e.obrys) { x0 = Math.min(x0, p.X); x1 = Math.max(x1, p.X); y0 = Math.min(y0, p.Y); y1 = Math.max(y1, p.Y); }
      x0 /= SC; x1 /= SC; y0 /= SC; y1 /= SC;
      const ok = 2, w = x1 - x0 + 2 * ok, h = y1 - y0 + 2 * ok;
      const d = exy => exy.map(e => [e.obrys, ...e.diry].map(c => c.map((p, i) => `${i ? 'L' : 'M'}${(p.X / SC - x0 + ok).toFixed(3)},${(y1 - p.Y / SC + ok).toFixed(3)}`).join(' ') + ' Z').join(' ')).join(' ');
      return new Blob([
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">\n`,
        deskaEx ? `<path d="${d(deskaEx)}" fill="none" stroke="#888" stroke-width="0.3" fill-rule="evenodd"/>\n` : '',
        `<path d="${d(textEx)}" fill="#000" fill-rule="evenodd"/>\n</svg>\n`,
      ], { type: 'image/svg+xml' });
    }

    function stahni(blob, jmeno) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = jmeno;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    return { stl, mf3, zip, svg, stahni, indexuj };
  })();
  window.TEXT3D_EXPORT = EXPORT;

  /* ====================================================================
     3. PROJEKT – stav stránky (plochý objekt, dřív localStorage „webapp_text3d“
        a odkaz #n=), předvolby, podložka tiskárny
     ==================================================================== */
  const TEXT3D_PROJEKT = (function () {
    const G = typeof G3D !== 'undefined' ? G3D : require('../gen3d/zaklad.js');
    const VYCHOZI = {
      nazev: '',
      text: '42', zarovnani: 'stred', prepis: 'zadny', tehta: 'predchozi', font: 'bebas',
      vyska: 80, mereni: 'versalka', hloubka: 6, mezery: 0, radkovani: 1, tucnost: 0,
      rezim: 'pismena', tvar: 'obdelnik', okraj: 8, deskaTl: 3, rohy: 4, ryti: 1.6,
      ramSirka: 0, ramVyska: 2, otvory: 0, otvorPrumer: 4.5, vypln: false,
      barvaText: '#e8b04a', barvaDeska: '#5a6470', tiskarna: '', podlozkaX: 220, podlozkaY: 220, oblouk: 0, kolik: 0, kolikPrumer: 4.2, kolikHloubka: 5,
    };
    // posuvník je na hrubé nastavení, číslo vedle něj smí za jeho rozsah (metrový nápis) – meze čísla
    const MEZE = {
      vyska: [3, 1000], hloubka: [0.4, 100], mezery: [-30, 100], radkovani: [0.3, 4], tucnost: [-5, 10], oblouk: [-340, 340],
      okraj: [0, 100], deskaTl: [0.6, 30], rohy: [0, 100], ryti: [0.2, 29], ramSirka: [0, 30], ramVyska: [0.2, 30],
      otvorPrumer: [1, 20], kolikPrumer: [1, 20], kolikHloubka: [1, 40], podlozkaX: [30, 1000], podlozkaY: [30, 1000],
    };
    const TISKARNY = ['', '250x210', '250x220', '180x180', '360x360', '256x256', '180x180b', '220x220', '300x300', 'vlastni'];
    const VYCTY = {
      zarovnani: ['vlevo', 'stred', 'vpravo'], mereni: ['versalka', 'celek'], rezim: ['pismena', 'relief', 'ryti', 'sablona'],
      tvar: ['obdelnik', 'oval', 'obrys'], otvory: [0, 2, 4], kolik: [0, 1, 2], tehta: ['predchozi', 'nasledujici'], tiskarna: TISKARNY,
    };
    const normalizuj = q => G.normalizuj(q, { VYCHOZI, MEZE, VYCTY });

    /** Starý odkaz #n=… (base64url z JSON, bez komprese) → objekt nastavení. */
    function zeStarehoOdkazu(t) {
      const b = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))));
    }

    const PREDLOHY = [
      { nazev: '🏠 Číslo domu', popis: 'číslice 12 cm s otvory na kolíky', s: { text: '42', prepis: 'zadny', font: 'anton', rezim: 'pismena', mereni: 'versalka', vyska: 120, hloubka: 8, mezery: 4, tucnost: 0, radkovani: 1, kolik: 2, kolikPrumer: 4.2, kolikHloubka: 5 } },
      { nazev: '🪧 Cedulka', popis: 'adresa na desce s rámečkem', s: { text: 'Nerudova\n1234', prepis: 'zadny', font: 'alfaslab', rezim: 'relief', mereni: 'versalka', vyska: 40, hloubka: 2.5, mezery: 0, tucnost: 0, radkovani: 1, tvar: 'obdelnik', okraj: 12, deskaTl: 3, rohy: 6, ramSirka: 3, ramVyska: 2.5, otvory: 4, otvorPrumer: 4.5 } },
      { nazev: '🏷 Jmenovka', popis: 'psací písmo na obrysu', s: { text: 'Anežka', prepis: 'zadny', font: 'pacifico', rezim: 'relief', mereni: 'versalka', vyska: 25, hloubka: 2, mezery: 0, tucnost: 0.2, tvar: 'obrys', okraj: 4, deskaTl: 2, ramSirka: 0, otvory: 0 } },
      { nazev: '🎨 Dvoubarevná', popis: 'vyrytý text s výplní', s: { text: 'Vítejte', prepis: 'zadny', font: 'cinzel', rezim: 'ryti', vypln: true, mereni: 'versalka', vyska: 30, mezery: 0, tucnost: 0, tvar: 'obdelnik', okraj: 10, deskaTl: 4, ryti: 1.2, rohy: 5, ramSirka: 0, otvory: 2, otvorPrumer: 4 } },
      { nazev: '✂ Šablona', popis: 'na sprej, prořezaná', s: { text: 'STOP', prepis: 'zadny', font: 'saira', rezim: 'sablona', mereni: 'versalka', vyska: 60, mezery: 2, tucnost: 0, tvar: 'obdelnik', okraj: 15, deskaTl: 1.2, rohy: 3, ramSirka: 0, otvory: 0 } },
      { nazev: '🌈 Oblouk', popis: 'nápis ohnutý nad deskou', s: { text: 'Chata U Lesa', prepis: 'zadny', font: 'pirata', rezim: 'relief', mereni: 'versalka', oblouk: 70, vyska: 30, hloubka: 2.5, mezery: 1, tucnost: 0, tvar: 'obrys', okraj: 6, deskaTl: 3, ramSirka: 0, otvory: 0 } },
      { nazev: '🧝 Elfí nápis', popis: 'tengwar na oválu', s: { text: 'Mellon', prepis: 'tengwar', font: 'tengwar', rezim: 'relief', mereni: 'celek', vyska: 30, hloubka: 2.5, mezery: 0, tucnost: 0, tvar: 'oval', okraj: 8, deskaTl: 3, ramSirka: 2, ramVyska: 2, otvory: 2, otvorPrumer: 4 } },
    ];
    const TEXTY_PREDLOH = new Set(PREDLOHY.map(p => p.s.text).concat(['', '42']));
    /** Předvolba na projekt: napsaný vlastní text se nepřepisuje (font, který chybí, → Bebas Neue). */
    function predvolba(p, i, maFont) {
      const d = PREDLOHY[i].s, vlastniText = !TEXTY_PREDLOH.has(String(p.text).trim());
      const q = Object.assign(G.kopie(p), { oblouk: 0, kolik: 0 }, G.kopie(d));
      if (vlastniText) q.text = p.text;
      if (maFont && !maFont(q.font)) q.font = 'bebas';
      return q;
    }

    function rozmerPodlozky(p) {
      if (!p.tiskarna) return null;
      if (p.tiskarna === 'vlastni') return [p.podlozkaX, p.podlozkaY];
      const m = /^(\d+)x(\d+)/.exec(p.tiskarna);
      return m ? [+m[1], +m[2]] : null;
    }
    // Vejde se obdélník w × h na podložku W × H, případně natočený?
    // Vrací úhel natočení ve stupních (0 = beze změny), nebo null.
    function uhelNaPodlozku(w, h, W, H) {
      for (let a = 0; a <= 90; a++) {
        const r = a * Math.PI / 180, c = Math.cos(r), s2 = Math.sin(r);
        if (w * c + h * s2 <= W && w * s2 + h * c <= H) return a;
      }
      return null;
    }
    /** Model w × h mm na podložce: {uhel, trida: ''|'otocit'|'nevejde', text}. */
    function stavPodlozky(w, h, p) {
      const [W, H] = rozmerPodlozky(p);
      const uhel = uhelNaPodlozku(w, h, W, H);
      const f = n => n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });
      if (uhel === 0) return { uhel, trida: '', text: `✓ Model ${f(w)} × ${f(h)} mm se vejde na podložku ${W} × ${H} mm.` };
      if (uhel !== null) return { uhel, trida: 'otocit', text: `↻ Vejde se, když ho ve sliceru natočíte o ${uhel}°.` };
      // největší zmenšení, při kterém se model vejde (i natočený)
      let k0 = 0, k1 = 1;
      for (let i = 0; i < 30; i++) { const k = (k0 + k1) / 2; if (uhelNaPodlozku(w * k, h * k, W, H) !== null) k0 = k; else k1 = k; }
      return { uhel, trida: 'nevejde', text: `✗ Model ${f(w)} × ${f(h)} mm se na podložku ${W} × ${H} mm nevejde. `
        + (p.rezim === 'pismena' ? 'Písmena ale můžete rozložit na podložku (Soubor → Rozložit písmena), nebo ' : '')
        + `zmenšete výšku písmen asi na ${f(p.vyska * k0 * 0.97)} mm.` };
    }

    /* Samostatná písmena, která se najednou nevejdou, se rozloží po
       řádcích („regálové“ skládání, nejvyšší napřed); co se nevejde
       na jednu podložku, jde na další. Písmeno větší než podložka se
       zkusí otočit o 90°.                                            */
    function rozlozNaPodlozky(kusy, W, H, mezera) {
      const SC = TEXT3D.SC;
      // kus = {ex, otvory, hloubkaOtvoru}; otvory se hýbou s písmenem
      const naEx = (ex, f) => ({ obrys: ex.obrys.map(f), diry: ex.diry.map(d => d.map(f)) });
      const preved = (kus, f) => Object.assign({}, kus, { ex: naEx(kus.ex, f), otvory: kus.otvory.map(o => naEx(o, f)) });
      const posun = (kus, dx, dy) => preved(kus, p => ({ X: p.X + dx, Y: p.Y + dy }));
      const otoc = kus => preved(kus, p => ({ X: -p.Y, Y: p.X }));
      const volne = [W - 2 * mezera, H - 2 * mezera];
      const pripravene = kusy.map(kus => {
        let m = TEXT3D.meze([kus.ex]);
        if ((m.x1 - m.x0 > volne[0] || m.y1 - m.y0 > volne[1]) && m.y1 - m.y0 <= volne[0] && m.x1 - m.x0 <= volne[1]) { kus = otoc(kus); m = TEXT3D.meze([kus.ex]); }
        return { kus, m, w: m.x1 - m.x0, h: m.y1 - m.y0 };
      });
      const velke = pripravene.filter(k => k.w > volne[0] + 1e-6 || k.h > volne[1] + 1e-6);
      if (velke.length) return { chyba: `${velke.length} ${velke.length === 1 ? 'písmeno se' : 'písmena se'} nevejde na podložku ani otočené – zmenšete výšku písmen.` };
      pripravene.sort((a, b) => b.h - a.h);
      const podlozky = [];
      let akt = null, x = 0, y = 0, radek = 0;
      const nova = () => { akt = []; podlozky.push(akt); x = 0; y = 0; radek = 0; };
      nova();
      for (const k of pripravene) {
        if (x > 0 && x + k.w > volne[0]) { y += radek + mezera; x = 0; radek = 0; }
        if (y + k.h > volne[1]) nova();
        // levý dolní roh volného místa → posun kusu v µm, střed podložky v počátku
        const cx = -W / 2 + mezera + x, cy = -H / 2 + mezera + y;
        akt.push(posun(k.kus, Math.round((cx - k.m.x0) * SC), Math.round((cy - k.m.y0) * SC)));
        x += k.w + mezera; radek = Math.max(radek, k.h);
      }
      return { podlozky };
    }

    const jmenoSouboru = text => {
      const t = String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 30);
      return 'text3d_' + (t || 'model');
    };
    /** Geometrie vrstev (BufferGeometry bez indexu) → jedna síť {poz, idx} pro náhled a převisy. */
    function naPozIdx(geometrie) {
      let n = 0;
      for (const g of geometrie) n += g.attributes.position.count;
      const poz = new Float32Array(3 * n), idx = new Uint32Array(n);
      let o = 0;
      for (const g of geometrie) {
        const gg = g.index ? g.toNonIndexed() : g, a = gg.attributes.position.array;
        poz.set(a, 3 * o); o += a.length / 3;
      }
      for (let i = 0; i < n; i++) idx[i] = i;
      return { poz, idx };
    }
    const popis = p => `${String(p.text).split('\n')[0].slice(0, 24)} · ${p.vyska} mm · ${{ pismena: 'písmena', relief: 'na desce', ryti: 'vyrytý', sablona: 'šablona' }[p.rezim]}`;

    return { VYCHOZI, MEZE, VYCTY, TISKARNY, normalizuj, zeStarehoOdkazu, PREDLOHY, predvolba, rozmerPodlozky, uhelNaPodlozku, stavPodlozky, rozlozNaPodlozky, jmenoSouboru, naPozIdx, popis };
  })();
  if (typeof window !== 'undefined') window.TEXT3D_PROJEKT = TEXT3D_PROJEKT;
