/* ============================================================
   Písmolijna – jadro/import.js
   Načtení fontu (TTF / OTF / WOFF přes opentype.js) do modelu
   včetně kerningu a ligatur, import SVG souboru do glyfu
   (bez DOMParseru, běží i v node), projekt .pismo.json.
   Potřebuje model.js a krivky.js.
   ============================================================ */
(function (G) {
  'use strict';
  const P = G.PSL || (G.PSL = {});

  /* ---------- opentype.js → model ---------- */
  function jmeno(names, klic) {
    const z = names && names[klic];
    if (!z) return '';
    if (typeof z === 'string') return z;
    return z.en || z['en-US'] || z.cs || z[Object.keys(z)[0]] || '';
  }

  /* path.commands (y nahoru) → obrysy kubického modelu */
  P.prikazyNaObrysy = function (prikazy) {
    const obrysy = [];
    let cur = null, px = 0, py = 0;
    const uzavri = () => {
      if (!cur) return;
      const b = cur.body, a = b[0], z = b[b.length - 1];
      if (b.length > 1 && Math.abs(a.x - z.x) < 1e-9 && Math.abs(a.y - z.y) < 1e-9) { a.t = z.t; b.pop(); }
      else a.t = 'l';
      if (b.length) obrysy.push(P.urciHladkost(cur));
      cur = null;
    };
    const bodik = (x, y, t) => ({ x, y, t, s: false });
    for (const c of prikazy) {
      switch (c.type) {
        case 'M': uzavri(); cur = { body: [bodik(c.x, c.y, 'l')] }; px = c.x; py = c.y; break;
        case 'L':
          if (!cur) cur = { body: [bodik(px, py, 'l')] };
          // opentype.js u TrueType dává M a hned L na tentýž bod – nulový úsek vynechat
          if (Math.abs(c.x - px) > 1e-9 || Math.abs(c.y - py) > 1e-9) cur.body.push(bodik(c.x, c.y, 'l'));
          px = c.x; py = c.y; break;
        case 'Q':
          if (!cur) cur = { body: [bodik(px, py, 'l')] };
          cur.body.push(bodik(px + 2 / 3 * (c.x1 - px), py + 2 / 3 * (c.y1 - py), 'o'),
            bodik(c.x + 2 / 3 * (c.x1 - c.x), c.y + 2 / 3 * (c.y1 - c.y), 'o'), bodik(c.x, c.y, 'c'));
          px = c.x; py = c.y; break;
        case 'C':
          if (!cur) cur = { body: [bodik(px, py, 'l')] };
          cur.body.push(bodik(c.x1, c.y1, 'o'), bodik(c.x2, c.y2, 'o'), bodik(c.x, c.y, 'c'));
          px = c.x; py = c.y; break;
        case 'Z': uzavri(); break;
      }
    }
    uzavri();
    return obrysy;
  };

  P.zOpentype = function (ot) {
    const font = { format: 'pismolijna', verze: 1, info: P.vychoziInfo(), poradi: [], glyfy: {},
      kerning: {}, skupiny: {}, ligatury: [], vodidla: [] };
    const T = ot.tables || {}, N = ot.names || {};
    const head = T.head || {}, hhea = T.hhea || {}, os2 = T.os2 || {}, post = T.post || {};
    const info = font.info;
    info.rodina = jmeno(N, 'preferredFamily') || jmeno(N, 'fontFamily') || info.rodina;
    info.styl = jmeno(N, 'preferredSubfamily') || jmeno(N, 'fontSubfamily') || 'Regular';
    const verze = jmeno(N, 'version');
    if (verze) info.verzeFontu = verze.replace(/^\s*version\s*/i, '').split(';')[0].trim() || info.verzeFontu;
    else if (head.fontRevision) info.verzeFontu = (+head.fontRevision).toFixed(3);
    info.copyright = jmeno(N, 'copyright');
    info.designer = jmeno(N, 'designer') || jmeno(N, 'manufacturer');
    info.licence = jmeno(N, 'license') || '';
    info.licenceUrl = jmeno(N, 'licenseURL') || '';
    info.url = jmeno(N, 'designerURL') || jmeno(N, 'manufacturerURL') || '';
    info.popis = jmeno(N, 'description') || '';
    info.upm = ot.unitsPerEm || head.unitsPerEm || 1000;
    info.ascender = hhea.ascender != null ? hhea.ascender : (ot.ascender || os2.sTypoAscender || Math.round(info.upm * 0.8));
    info.descender = hhea.descender != null ? hhea.descender : (ot.descender || os2.sTypoDescender || -Math.round(info.upm * 0.2));
    info.lineGap = hhea.lineGap != null ? hhea.lineGap : (os2.sTypoLineGap || 0);
    info.sklon = +post.italicAngle || 0;
    if (post.underlinePosition != null) info.podtrzeniPoz = post.underlinePosition;
    if (post.underlineThickness) info.podtrzeniTl = post.underlineThickness;
    if (os2.usWeightClass) info.vaha = os2.usWeightClass;
    if (os2.usWidthClass) info.sirkaTrida = os2.usWidthClass;

    // glyfy
    const n = ot.numGlyphs || (ot.glyphs && ot.glyphs.length) || 0;
    const nazvy = [];
    const pouzite = new Set();
    for (let i = 0; i < n; i++) {
      const g = ot.glyphs.get(i);
      let nazev = i === 0 ? '.notdef' : (g && g.name) || '';
      const uni = g && g.unicodes ? g.unicodes.slice() : (g && g.unicode != null ? [g.unicode] : []);
      if (!P.platnyNazev(nazev) || pouzite.has(nazev) || (i > 0 && nazev === '.notdef')) {
        nazev = uni.length ? P.nazevProUnicode(uni[0]) : 'glyph' + i;
        if (pouzite.has(nazev)) { let k = 1; while (pouzite.has(nazev + '.' + k)) k++; nazev += '.' + k; }
      }
      pouzite.add(nazev);
      nazvy.push(nazev);
      const glyf = P.novyGlyf(nazev, uni, Math.round(g && g.advanceWidth != null ? g.advanceWidth : 0));
      let prikazy = [];
      try { prikazy = (g && g.path && g.path.commands) || []; } catch (e) { prikazy = []; }
      glyf.obrysy = P.prikazyNaObrysy(prikazy);
      font.glyfy[nazev] = glyf;
      font.poradi.push(nazev);
    }

    // x-výška a výška verzálek: z OS/2, jinak změřit x a H
    const zmer = cp => {
      const m = P.cmap(font);
      const g = m.has(cp) && font.glyfy[m.get(cp)];
      const o = g && P.obalkaGlyfu(font, g);
      return o ? Math.round(o.y1) : 0;
    };
    info.xVyska = os2.sxHeight || zmer(0x78) || Math.round(info.upm * 0.5);
    info.vyskaVerzalek = os2.sCapHeight || zmer(0x48) || Math.round(info.upm * 0.7);

    // kerning: tabulka kern, jinak GPOS (jen latinka, ať to netrvá)
    const kp = ot.kerningPairs || {};
    let pocet = 0;
    for (const k in kp) {
      const v = kp[k];
      if (!v) continue;
      const [l, r] = k.split(',').map(Number);
      if (nazvy[l] == null || nazvy[r] == null) continue;
      (font.kerning[nazvy[l]] || (font.kerning[nazvy[l]] = {}))[nazvy[r]] = v;
      pocet++;
    }
    if (!pocet && ot.position && T.gpos) {
      try { kerningZGpos(ot, font, nazvy); } catch (e) { /* GPOS, který opentype.js nepřečte, se přeskočí */ }
    }

    // ligatury
    try {
      if (ot.substitution && T.gsub) {
        const videno = new Set();
        for (const l of ot.substitution.getLigatures('liga') || []) {
          const z = (l.sub || []).map(i => nazvy[i]);
          const na = nazvy[l.by];
          if (z.length < 2 || z.some(x => x == null) || na == null) continue;
          const k = z.join(' ');
          if (videno.has(k)) continue;
          videno.add(k);
          font.ligatury.push({ z, na });
        }
      }
    } catch (e) { /* bez ligatur */ }

    return P.normalizuj(font);
  };

  function kerningZGpos(ot, font, nazvy) {
    const pos = ot.position;
    const tabulky = pos.defaultKerningTables || (pos.getKerningTables && pos.getKerningTables(pos.getDefaultScriptName && pos.getDefaultScriptName()));
    if (!tabulky || !tabulky.length) return;
    // kandidáti: glyfy se znakem U+0020–U+024F
    const kand = [];
    for (let i = 0; i < nazvy.length; i++) {
      const u = font.glyfy[nazvy[i]].uni;
      if (u.some(c => c >= 0x20 && c <= 0x24F)) kand.push(i);
    }
    // levý glyf musí být v pokrytí aspoň jedné podtabulky
    const podtab = [];
    for (const t of tabulky) for (const s of t.subtables || []) if (s && s.coverage) podtab.push(s);
    const leve = kand.filter(i => podtab.some(s => pos.getCoverageIndex(s.coverage, i) >= 0));
    const limit = 200000;
    let hotovo = 0;
    for (const l of leve) {
      for (const r of kand) {
        const v = pos.getKerningValue(tabulky, l, r);
        if (v) (font.kerning[nazvy[l]] || (font.kerning[nazvy[l]] = {}))[nazvy[r]] = v;
        if (++hotovo > limit * 10) return;
      }
    }
  }

  /* ---------- načtení souboru ---------- */
  P.nactiFont = function (arrayBuffer) {
    const b = new Uint8Array(arrayBuffer instanceof ArrayBuffer ? arrayBuffer : arrayBuffer.buffer || arrayBuffer);
    const sig = String.fromCharCode(b[0] || 0, b[1] || 0, b[2] || 0, b[3] || 0);
    if (sig === 'wOF2') throw new Error('Formát WOFF2 Písmolijna neumí načíst – převeďte font nejdřív na TTF, OTF nebo WOFF.');
    // projekt .pismo.json (případně s BOM a mezerami na začátku)
    let i = 0;
    if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) i = 3;
    while (i < b.length && (b[i] === 0x20 || b[i] === 0x0A || b[i] === 0x0D || b[i] === 0x09)) i++;
    if (b[i] === 0x7B) return P.nactiProjekt(new TextDecoder('utf-8').decode(b.subarray(i)));
    const ot = G.opentype;
    if (!ot || !ot.parse) throw new Error('Chybí knihovna opentype.js (lib/opentype.min.js).');
    let otf;
    const buf = b.byteOffset === 0 && b.byteLength === b.buffer.byteLength ? b.buffer : b.slice().buffer;
    try { otf = ot.parse(buf); } catch (e) {
      throw new Error('Soubor se nepodařilo přečíst jako font (TTF, OTF, WOFF): ' + (e && e.message || e));
    }
    if (!otf || !otf.glyphs) throw new Error('Soubor se nepodařilo přečíst jako font.');
    return P.zOpentype(otf);
  };

  /* ---------- import SVG do glyfu ---------- */
  function atributy(s) {
    const a = {};
    const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = re.exec(s))) a[m[1]] = m[2] != null ? m[2] : m[3];
    if (a.style) for (const cast of a.style.split(';')) {
      const k = cast.indexOf(':');
      if (k > 0) { const kl = cast.slice(0, k).trim(); if (!(kl in a)) a[kl] = cast.slice(k + 1).trim(); }
    }
    return a;
  }
  function cisla(s) { return (String(s || '').match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || []).map(Number); }

  /* transform="…" → matice [a,b,c,d,e,f] */
  P.svgTransformace = function (s) {
    let m = [1, 0, 0, 1, 0, 0];
    const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
    let t;
    while ((t = re.exec(s || ''))) {
      const c = cisla(t[2]);
      let x = [1, 0, 0, 1, 0, 0];
      switch (t[1]) {
        case 'matrix': if (c.length >= 6) x = c.slice(0, 6); break;
        case 'translate': x = [1, 0, 0, 1, c[0] || 0, c[1] || 0]; break;
        case 'scale': x = [c[0] == null ? 1 : c[0], 0, 0, c[1] == null ? (c[0] == null ? 1 : c[0]) : c[1], 0, 0]; break;
        case 'rotate': {
          const a = (c[0] || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
          x = [cs, sn, -sn, cs, 0, 0];
          if (c.length >= 3) x = P.nasobMatice([1, 0, 0, 1, c[1], c[2]], P.nasobMatice(x, [1, 0, 0, 1, -c[1], -c[2]]));
          break;
        }
        case 'skewX': x = [1, 0, Math.tan((c[0] || 0) * Math.PI / 180), 1, 0, 0]; break;
        case 'skewY': x = [1, Math.tan((c[0] || 0) * Math.PI / 180), 0, 1, 0, 0]; break;
      }
      m = P.nasobMatice(m, x);   // transformace se skládají zleva doprava
    }
    return m;
  };

  /* Prvek SVG → atribut d */
  function tvarNaD(tag, a) {
    const n = k => parseFloat(a[k]) || 0;
    switch (tag) {
      case 'path': return a.d || '';
      case 'rect': {
        const x = n('x'), y = n('y'), w = n('width'), h = n('height');
        if (w <= 0 || h <= 0) return '';
        let rx = a.rx != null ? n('rx') : (a.ry != null ? n('ry') : 0), ry = a.ry != null ? n('ry') : rx;
        rx = Math.min(Math.max(0, rx), w / 2); ry = Math.min(Math.max(0, ry), h / 2);
        if (!rx || !ry) return 'M' + x + ' ' + y + 'H' + (x + w) + 'V' + (y + h) + 'H' + x + 'Z';
        return 'M' + (x + rx) + ' ' + y + 'H' + (x + w - rx) + 'A' + rx + ' ' + ry + ' 0 0 1 ' + (x + w) + ' ' + (y + ry) +
          'V' + (y + h - ry) + 'A' + rx + ' ' + ry + ' 0 0 1 ' + (x + w - rx) + ' ' + (y + h) +
          'H' + (x + rx) + 'A' + rx + ' ' + ry + ' 0 0 1 ' + x + ' ' + (y + h - ry) +
          'V' + (y + ry) + 'A' + rx + ' ' + ry + ' 0 0 1 ' + (x + rx) + ' ' + y + 'Z';
      }
      case 'circle': case 'ellipse': {
        const cx = n('cx'), cy = n('cy');
        const rx = tag === 'circle' ? n('r') : n('rx'), ry = tag === 'circle' ? n('r') : n('ry');
        if (rx <= 0 || ry <= 0) return '';
        return 'M' + (cx - rx) + ' ' + cy + 'A' + rx + ' ' + ry + ' 0 1 1 ' + (cx + rx) + ' ' + cy +
          'A' + rx + ' ' + ry + ' 0 1 1 ' + (cx - rx) + ' ' + cy + 'Z';
      }
      case 'polygon': case 'polyline': {
        const c = cisla(a.points);
        if (c.length < 4) return '';
        let d = 'M' + c[0] + ' ' + c[1];
        for (let i = 2; i + 1 < c.length; i += 2) d += 'L' + c[i] + ' ' + c[i + 1];
        return d + 'Z';
      }
    }
    return '';
  }

  /* Všechny vyplněné tvary SVG souboru jako obrysy (souřadnice SVG, y dolů).
     Vrací {obrysy, viewBox: [x, y, w, h] | null}. */
  P.svgNaObrysySouboru = function (svgText) {
    const text = String(svgText).replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
    const re = /<(\/?)([a-zA-Z][\w:.-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
    const zasobnik = [[1, 0, 0, 1, 0, 0]];
    const skryte = new Set(['defs', 'clipPath', 'mask', 'symbol', 'pattern', 'marker', 'linearGradient', 'radialGradient', 'style', 'title', 'desc', 'metadata', 'filter']);
    const tvary = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline']);
    const obrysy = [];
    let viewBox = null, skryto = 0, m;
    const otevrene = [];   // zásobník otevřených prvků: {tag, transform?, skryty?}
    while ((m = re.exec(text))) {
      const zavira = m[1] === '/', tag = m[2].replace(/^svg:/, ''), samo = m[4] === '/';
      if (zavira) {
        // zavřít až po odpovídající prvek
        for (let i = otevrene.length - 1; i >= 0; i--) {
          if (otevrene[i].tag === tag) {
            while (otevrene.length > i) {
              const o = otevrene.pop();
              if (o.skryty) skryto--;
              if (o.transform) zasobnik.pop();
            }
            break;
          }
        }
        continue;
      }
      const a = atributy(m[3]);
      if (tag === 'svg' && !viewBox) {
        if (a.viewBox) { const c = cisla(a.viewBox); if (c.length === 4 && c[2] > 0 && c[3] > 0) viewBox = c; }
        else if (a.width && a.height && parseFloat(a.width) > 0 && parseFloat(a.height) > 0) viewBox = [0, 0, parseFloat(a.width), parseFloat(a.height)];
      }
      const mat = a.transform ? P.nasobMatice(zasobnik[zasobnik.length - 1], P.svgTransformace(a.transform)) : zasobnik[zasobnik.length - 1];
      if (tvary.has(tag) && !skryto) {
        const bezVyplne = a.fill === 'none' || a.display === 'none' || a.visibility === 'hidden';
        const d = bezVyplne ? '' : tvarNaD(tag, a);
        if (d) for (const o of P.svgNaObrysy(d, mat)) obrysy.push(o);
      }
      if (!samo) {
        const zaz = { tag };
        if (skryte.has(tag) || a.display === 'none') { zaz.skryty = true; skryto++; }
        if (a.transform) { zaz.transform = true; zasobnik.push(mat); }
        otevrene.push(zaz);
      }
    }
    return { obrysy: obrysy.filter(o => !o.otevreny), viewBox };
  };

  /* Import SVG do glyfu. volby: {meritko: 'verzalky'|'em'|'puvodni', pridat: bool, mezera: 50}.
     Vrací {obrysu, meritko}. */
  P.svgDoGlyfu = function (svgText, font, glyf, volby) {
    const v = volby || {};
    const rezim = v.meritko || 'verzalky';
    const mezera = v.mezera == null ? 50 : v.mezera;
    const info = font.info;
    const { obrysy, viewBox } = P.svgNaObrysySouboru(svgText);
    if (!obrysy.length) throw new Error('V SVG nebyl nalezen žádný vyplněný tvar (path, rect, circle, ellipse, polygon).');
    // převrátit y (SVG má y dolů)
    for (const o of obrysy) for (const b of o.body) b.y = -b.y;
    const ob = P.obalkaObrysu(obrysy);
    const vys = ob.y1 - ob.y0;
    let s = 1, dy;
    if (rezim === 'verzalky') {
      s = vys > 0 ? (info.vyskaVerzalek || info.upm * 0.7) / vys : 1;
      dy = -ob.y0 * s;                      // spodek obsahu na účaří
    } else if (rezim === 'em' && viewBox) {
      s = (info.ascender - info.descender) / viewBox[3];
      dy = info.ascender + viewBox[1] * s;  // horní okraj viewBoxu = ascender
    } else if (rezim === 'em') {
      s = vys > 0 ? info.upm / vys : 1;
      dy = -ob.y0 * s;
    } else {
      dy = -ob.y0;
    }
    const dx = mezera - ob.x0 * s;
    for (const o of obrysy) for (const b of o.body) { b.x = b.x * s + dx; b.y = b.y * s + dy; }
    if (!v.pridat) { glyf.obrysy = []; glyf.komponenty = []; }
    for (const o of obrysy) glyf.obrysy.push(o);
    P.opravSmer(glyf.obrysy);
    const nova = P.obalkaGlyfu(font, glyf);
    if (nova) glyf.sirka = Math.round(nova.x1 + mezera);
    return { obrysu: obrysy.length, meritko: s };
  };

  /* ---------- projekt ---------- */
  function zaokrouhli(x, klic) {
    if (typeof x === 'number') {
      if (!isFinite(x)) return 0;
      return Math.round(x * 100) / 100;
    }
    if (Array.isArray(x)) {
      // matice komponent potřebují víc desetinných míst (F2Dot14)
      if (klic === 'm') return x.map((v, i) => i < 4 ? Math.round(v * 1e5) / 1e5 : Math.round(v * 100) / 100);
      return x.map(v => zaokrouhli(v));
    }
    if (x && typeof x === 'object') {
      const r = {};
      for (const k in x) if (x[k] !== undefined && typeof x[k] !== 'function') r[k] = zaokrouhli(x[k], k);
      return r;
    }
    return x;
  }

  P.ulozProjekt = function (font) {
    return JSON.stringify(zaokrouhli(font));
  };

  P.nactiProjekt = function (text) {
    let f;
    try { f = JSON.parse(text); } catch (e) { throw new Error('Soubor projektu není platný JSON: ' + e.message); }
    if (!f || typeof f !== 'object' || (f.format && f.format !== 'pismolijna')) throw new Error('Soubor není projekt Písmolijny.');
    return P.normalizuj(f);
  };
})(typeof window !== 'undefined' ? window : globalThis);
