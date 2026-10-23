/* ============================================================
   Písmolijna – jadro/export.js
   Vlastní zápis TrueType (head, hhea, maxp, OS/2, hmtx, cmap 4+12,
   loca, glyf, name, post v2, kern, GPOS kern, GSUB liga), zabalení
   do WOFF 1.0 (deflate přes CompressionStream), OTF/CFF přes
   opentype.js, SVG font a SVG jednoho glyfu.
   Potřebuje model.js a krivky.js. Bez DOM – běží i v node.
   ============================================================ */
(function (G) {
  'use strict';
  const P = G.PSL || (G.PSL = {});

  /* ---------- zápis bajtů ---------- */
  function Bajty() { this.a = []; }
  Bajty.prototype = {
    u8(v) { this.a.push(v & 255); return this; },
    u16(v) { v = Math.round(v); this.a.push((v >> 8) & 255, v & 255); return this; },
    i16(v) { v = Math.max(-32768, Math.min(32767, Math.round(v))); return this.u16(v < 0 ? v + 65536 : v); },
    u32(v) { v = v >>> 0; this.a.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); return this; },
    i32(v) { return this.u32(Math.round(v) | 0); },
    fixed(v) { return this.i32(Math.round(v * 65536)); },
    f2dot14(v) { return this.i16(Math.round(v * 16384)); },
    tag(s) { for (let i = 0; i < 4; i++) this.u8(i < s.length ? s.charCodeAt(i) : 32); return this; },
    bajty(b) { for (let i = 0; i < b.length; i++) this.a.push(b[i]); return this; },
    datum(d) {   // LONGDATETIME: sekundy od 1. 1. 1904
      const s = Math.floor(d.getTime() / 1000) + 2082844800;
      return this.u32(Math.floor(s / 4294967296)).u32(s % 4294967296);
    },
    zarovnej(n) { while (this.a.length % (n || 4)) this.a.push(0); return this; },
    set16(pos, v) { this.a[pos] = (v >> 8) & 255; this.a[pos + 1] = v & 255; },
    get delka() { return this.a.length; },
    vysledek() { return Uint8Array.from(this.a); }
  };

  function kontrolniSoucet(b, od, delka) {
    let s = 0;
    const n = (delka + 3) & ~3;
    for (let i = 0; i < n; i += 4) {
      const v = (((b[od + i] || 0) << 24) | ((i + 1 < delka ? b[od + i + 1] : 0) << 16) |
        ((i + 2 < delka ? b[od + i + 2] : 0) << 8) | (i + 3 < delka ? b[od + i + 3] : 0)) >>> 0;
      s = (s + v) >>> 0;
    }
    return s;
  }
  function ctiU32(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
  function ctiU16(b, o) { return (b[o] << 8) | b[o + 1]; }

  /* Tabulky {tag: Uint8Array} → sfnt (seřazené podle tagu, zarovnané na 4 bajty,
     kontrolní součty a head.checkSumAdjustment). */
  function sestavSfnt(tabulky, verze) {
    const tagy = Object.keys(tabulky).sort();
    const n = tagy.length;
    let mocnina = 1, log = 0;
    while (mocnina * 2 <= n) { mocnina *= 2; log++; }
    let celkem = 12 + 16 * n;
    for (const t of tagy) celkem += (tabulky[t].length + 3) & ~3;
    const out = new Uint8Array(celkem);
    const zapis32 = (o, v) => { out[o] = (v >>> 24) & 255; out[o + 1] = (v >>> 16) & 255; out[o + 2] = (v >>> 8) & 255; out[o + 3] = v & 255; };
    const zapis16 = (o, v) => { out[o] = (v >> 8) & 255; out[o + 1] = v & 255; };
    zapis32(0, verze == null ? 0x00010000 : verze);
    zapis16(4, n); zapis16(6, mocnina * 16); zapis16(8, log); zapis16(10, n * 16 - mocnina * 16);
    let pos = 12 + 16 * n, headPos = -1;
    tagy.forEach((t, i) => {
      const d = tabulky[t];
      if (t === 'head') { d[8] = d[9] = d[10] = d[11] = 0; headPos = pos; }
      const r = 12 + 16 * i;
      for (let k = 0; k < 4; k++) out[r + k] = t.charCodeAt(k);
      zapis32(r + 4, kontrolniSoucet(d, 0, d.length));
      zapis32(r + 8, pos); zapis32(r + 12, d.length);
      out.set(d, pos);
      pos += (d.length + 3) & ~3;
    });
    if (headPos >= 0) zapis32(headPos + 8, (0xB1B0AFBA - kontrolniSoucet(out, 0, out.length)) >>> 0);
    return out;
  }

  /* sfnt → {verze, tabulky: {tag: Uint8Array}} */
  function rozeberSfnt(b) {
    const verze = ctiU32(b, 0), n = ctiU16(b, 4), tabulky = {};
    for (let i = 0; i < n; i++) {
      const r = 12 + 16 * i;
      const tag = String.fromCharCode(b[r], b[r + 1], b[r + 2], b[r + 3]);
      const off = ctiU32(b, r + 8), len = ctiU32(b, r + 12);
      tabulky[tag] = b.slice(off, off + len);
    }
    return { verze, tabulky };
  }
  P.rozeberSfnt = rozeberSfnt;

  /* ---------- standardní názvy Macintosh (post) ---------- */
  const MAC_NAZVY = ('.notdef .null nonmarkingreturn space exclam quotedbl numbersign dollar percent ampersand quotesingle ' +
    'parenleft parenright asterisk plus comma hyphen period slash zero one two three four five six seven eight nine colon ' +
    'semicolon less equal greater question at A B C D E F G H I J K L M N O P Q R S T U V W X Y Z bracketleft backslash ' +
    'bracketright asciicircum underscore grave a b c d e f g h i j k l m n o p q r s t u v w x y z braceleft bar braceright ' +
    'asciitilde Adieresis Aring Ccedilla Eacute Ntilde Odieresis Udieresis aacute agrave acircumflex adieresis atilde aring ' +
    'ccedilla eacute egrave ecircumflex edieresis iacute igrave icircumflex idieresis ntilde oacute ograve ocircumflex ' +
    'odieresis otilde uacute ugrave ucircumflex udieresis dagger degree cent sterling section bullet paragraph germandbls ' +
    'registered copyright trademark acute dieresis notequal AE Oslash infinity plusminus lessequal greaterequal yen mu ' +
    'partialdiff summation product pi integral ordfeminine ordmasculine Omega ae oslash questiondown exclamdown logicalnot ' +
    'radical florin approxequal Delta guillemotleft guillemotright ellipsis nonbreakingspace Agrave Atilde Otilde OE oe ' +
    'endash emdash quotedblleft quotedblright quoteleft quoteright divide lozenge ydieresis Ydieresis fraction currency ' +
    'guilsinglleft guilsinglright fi fl daggerdbl periodcentered quotesinglbase quotedblbase perthousand Acircumflex ' +
    'Ecircumflex Aacute Edieresis Egrave Iacute Icircumflex Idieresis Igrave Oacute Ocircumflex apple Ograve Uacute ' +
    'Ucircumflex Ugrave dotlessi circumflex tilde macron breve dotaccent ring cedilla hungarumlaut ogonek caron Lslash ' +
    'lslash Scaron scaron Zcaron zcaron brokenbar Eth eth Yacute yacute Thorn thorn minus multiply onesuperior twosuperior ' +
    'threesuperior onehalf onequarter threequarters franc Gbreve gbreve Idotaccent Scedilla scedilla Cacute cacute Ccaron ' +
    'ccaron dcroat').split(' ');
  const MAC_INDEX = new Map(MAC_NAZVY.map((n, i) => [n, i]));
  P.MAC_NAZVY = MAC_NAZVY;

  /* ---------- pomocné ---------- */
  function infoFontu(font) { return Object.assign(P.vychoziInfo(), font.info || {}); }

  function stylFontu(info) {
    const s = String(info.styl || 'Regular').trim() || 'Regular';
    const tucne = /(^|[\s-])(bold|tučn[éýá])($|[\s-])/i.test(s);
    const kurziva = /(italic|oblique|kurzív|skloněn)/i.test(s) || (+info.sklon || 0) !== 0;
    const ribbi = ['regular', 'bold', 'italic', 'bold italic'].indexOf(s.toLowerCase()) >= 0;
    const zakladni = tucne && kurziva ? 'Bold Italic' : tucne ? 'Bold' : kurziva ? 'Italic' : 'Regular';
    return { styl: s, tucne, kurziva, ribbi, zakladni };
  }

  /* Název PostScript: jen ASCII 33–126 bez []{}()<>/% a mezer, max. 63 znaků. */
  function psNazev(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\x21-\x7E]|[\[\](){}<>\/%]/g, '');
  }
  function psJmenoFontu(info) {
    const r = psNazev(info.rodina) || 'Pismo', s = psNazev(info.styl) || 'Regular';
    return (r + '-' + s).slice(0, 63);
  }

  /* Glyfy připravené k zápisu: obrysy jako kvadratické kontury TrueType,
     nebo seznam komponent (složený glyf). */
  function pripravGlyfy(font, volby, varovani) {
    const poradi = font.poradi;
    if (poradi.length > 65535) throw new Error('Font má víc než 65 535 glyfů – TrueType víc neumí.');
    if (poradi[0] !== '.notdef') varovani.push('Glyf 0 není .notdef.');
    const gid = new Map(poradi.map((n, i) => [n, i]));
    const tol = volby.tol || 0.5;

    // hloubka komponent s ochranou proti cyklu (Infinity = cyklus)
    const hloubky = new Map();
    function hloubka(n, cesta) {
      if (hloubky.has(n)) return hloubky.get(n);
      if (cesta.has(n)) return Infinity;
      const g = font.glyfy[n];
      if (!g || !(g.komponenty || []).length) { hloubky.set(n, 0); return 0; }
      cesta.add(n);
      let h = 0;
      for (const k of g.komponenty) h = Math.max(h, 1 + hloubka(k.glyf, cesta));
      cesta.delete(n);
      hloubky.set(n, h);
      return h;
    }

    const f2ok = v => { const r = Math.round(v * 16384); return r >= -32768 && r <= 32767; };
    const i16ok = v => { const r = Math.round(v); return r >= -32768 && r <= 32767; };

    return poradi.map((n, i) => {
      const g = font.glyfy[n];
      const zaznam = { nazev: n, gid: i, sirka: Math.max(0, Math.round(g.sirka || 0)), kontury: [], komponenty: null };
      const uzavrene = P.obrysySeZrcadlem(font, g).filter(o => !o.otevreny);
      const komp = (g.komponenty || []).filter(k => font.glyfy[k.glyf] && gid.has(k.glyf));
      let slozeny = komp.length > 0 && uzavrene.length === 0;
      if (slozeny) {
        for (const k of komp) {
          const m = k.m || [1, 0, 0, 1, 0, 0];
          if (!f2ok(m[0]) || !f2ok(m[1]) || !f2ok(m[2]) || !f2ok(m[3]) || !i16ok(m[4]) || !i16ok(m[5])) slozeny = false;
        }
        if (slozeny && hloubka(n, new Set()) > 8) slozeny = false;
      }
      if (slozeny) {
        zaznam.komponenty = komp.map(k => {
          const m = k.m || [1, 0, 0, 1, 0, 0];
          // matice kvantovaná tak, jak ji uloží F2Dot14 a celočíselný posun
          const q = v => Math.round(v * 16384) / 16384;
          return { gid: gid.get(k.glyf), m: [q(m[0]), q(m[1]), q(m[2]), q(m[3]), Math.round(m[4]), Math.round(m[5])] };
        });
        return zaznam;
      }
      const obrysy = komp.length ? P.plneObrysy(font, g).filter(o => !o.otevreny) : uzavrene;
      for (const o of obrysy) {
        const k = konturaTT(o, tol);
        if (k && k.length) zaznam.kontury.push(k);
      }
      return zaznam;
    });
  }

  /* Kubický obrys → body TrueType [{x, y, on}] (celá čísla, bez implicitních bodů). */
  function konturaTT(obrys, tol) {
    const seg = P.segmenty(obrys);
    if (!seg.length) {
      const b = obrys.body.filter(p => p.t !== 'o');
      return b.length ? b.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), on: true })) : null;
    }
    const pts = [{ x: seg[0].p0.x, y: seg[0].p0.y, on: true }];
    for (const s of seg) {
      if (s.typ === 'l') pts.push({ x: s.p3.x, y: s.p3.y, on: true });
      else for (const q of P.kubikaNaKvadratiky(s.p0, s.p1, s.p2, s.p3, tol)) {
        pts.push({ x: q.c.x, y: q.c.y, on: false }, { x: q.p.x, y: q.p.y, on: true });
      }
    }
    for (const p of pts) { p.x = Math.round(p.x); p.y = Math.round(p.y); }
    // uzavřený obrys končí v bodě, kde začal
    const a = pts[0], z = pts[pts.length - 1];
    if (pts.length > 1 && z.on && a.x === z.x && a.y === z.y) pts.pop();
    // totožné sousední body na křivce
    let r = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = r[r.length - 1];
      if (q && p.on && q.on && p.x === q.x && p.y === q.y) continue;
      r.push(p);
    }
    while (r.length > 1 && r[r.length - 1].on && r[0].on && r[r.length - 1].x === r[0].x && r[r.length - 1].y === r[0].y) r.pop();
    // implicitní body: bod na křivce přesně uprostřed dvou řídicích se vynechá (první bod se nechává)
    const n = r.length;
    if (n > 3) {
      r = r.filter((p, i) => {
        if (i === 0 || !p.on) return true;
        const u = r[i - 1], v = r[(i + 1) % n];
        return !(!u.on && !v.on && u.x + v.x === 2 * p.x && u.y + v.y === 2 * p.y);
      });
    }
    return r;
  }

  /* ---------- glyf ---------- */
  function zakodujJednoduchy(kontury) {
    const pts = [].concat(...kontury);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
    const w = new Bajty();
    w.i16(kontury.length).i16(x0).i16(y0).i16(x1).i16(y1);
    let konec = -1;
    for (const k of kontury) { konec += k.length; w.u16(konec); }
    w.u16(0);   // bez instrukcí
    const flagy = [], xs = new Bajty(), ys = new Bajty();
    let px = 0, py = 0;
    for (const p of pts) {
      let f = p.on ? 1 : 0;
      const dx = p.x - px, dy = p.y - py;
      if (dx === 0) f |= 16;
      else if (dx > -256 && dx < 256) { f |= 2; if (dx > 0) f |= 16; xs.u8(Math.abs(dx)); }
      else xs.i16(dx);
      if (dy === 0) f |= 32;
      else if (dy > -256 && dy < 256) { f |= 4; if (dy > 0) f |= 32; ys.u8(Math.abs(dy)); }
      else ys.i16(dy);
      flagy.push(f); px = p.x; py = p.y;
    }
    for (let i = 0; i < flagy.length;) {
      let j = i + 1;
      while (j < flagy.length && flagy[j] === flagy[i] && j - i - 1 < 255) j++;
      const opak = j - i - 1;
      if (opak > 0) { w.u8(flagy[i] | 8).u8(opak); } else w.u8(flagy[i]);
      i = j;
    }
    w.bajty(xs.a).bajty(ys.a);
    return { data: w.a, obalka: { x0, y0, x1, y1 }, bodu: pts.length, kontur: kontury.length };
  }

  function zakodujSlozeny(komponenty, obalka) {
    const w = new Bajty();
    w.i16(-1).i16(obalka.x0).i16(obalka.y0).i16(obalka.x1).i16(obalka.y1);
    komponenty.forEach((k, i) => {
      const m = k.m;
      let f = 0x0002 | 0x0004;   // ARGS_ARE_XY_VALUES | ROUND_XY_TO_GRID
      const slova = m[4] < -128 || m[4] > 127 || m[5] < -128 || m[5] > 127;
      if (slova) f |= 0x0001;
      let tr = 0;
      if (m[1] !== 0 || m[2] !== 0) { f |= 0x0080; tr = 3; }
      else if (m[0] !== m[3]) { f |= 0x0040; tr = 2; }
      else if (m[0] !== 1) { f |= 0x0008; tr = 1; }
      if (i < komponenty.length - 1) f |= 0x0020;
      w.u16(f).u16(k.gid);
      if (slova) w.i16(m[4]).i16(m[5]);
      else w.u8(m[4] < 0 ? m[4] + 256 : m[4]).u8(m[5] < 0 ? m[5] + 256 : m[5]);
      if (tr === 1) w.f2dot14(m[0]);
      else if (tr === 2) w.f2dot14(m[0]).f2dot14(m[3]);
      else if (tr === 3) w.f2dot14(m[0]).f2dot14(m[1]).f2dot14(m[2]).f2dot14(m[3]);
    });
    return w.a;
  }

  /* Zakóduje všechny glyfy; spočítá obálky, maxp údaje a body složených glyfů. */
  function zakodujGlyfy(zaznamy) {
    const bodyCache = new Map();   // gid → [{x,y}] všech bodů (pro obálku složených)
    const info = new Map();        // gid → {bodu, kontur, hloubka, komponent}
    function body(gid, cesta) {
      if (bodyCache.has(gid)) return bodyCache.get(gid);
      const z = zaznamy[gid];
      let r = [];
      if (z.komponenty && !cesta.has(gid)) {
        cesta.add(gid);
        for (const k of z.komponenty) {
          const m = k.m;
          for (const p of body(k.gid, cesta)) r.push({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
        }
        cesta.delete(gid);
      } else if (!z.komponenty) r = [].concat(...z.kontury);
      bodyCache.set(gid, r);
      return r;
    }
    function souhrn(gid, cesta) {
      if (info.has(gid)) return info.get(gid);
      const z = zaznamy[gid];
      let s;
      if (!z.komponenty) s = { bodu: z.kontury.reduce((a, k) => a + k.length, 0), kontur: z.kontury.length, hloubka: 0, komponent: 0 };
      else {
        s = { bodu: 0, kontur: 0, hloubka: 1, komponent: z.komponenty.length };
        if (!cesta.has(gid)) {
          cesta.add(gid);
          for (const k of z.komponenty) {
            const d = souhrn(k.gid, cesta);
            s.bodu += d.bodu; s.kontur += d.kontur; s.hloubka = Math.max(s.hloubka, d.hloubka + 1);
          }
          cesta.delete(gid);
        }
      }
      info.set(gid, s);
      return s;
    }
    const zaok = v => Math.floor(v + 0.5);
    return zaznamy.map(z => {
      const s = souhrn(z.gid, new Set());
      if (z.komponenty) {
        const pts = body(z.gid, new Set());
        if (!pts.length) return { data: [], obalka: null, slozeny: true, souhrn: s };
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
        const obalka = { x0: zaok(x0), y0: zaok(y0), x1: zaok(x1), y1: zaok(y1) };
        return { data: zakodujSlozeny(z.komponenty, obalka), obalka, slozeny: true, souhrn: s };
      }
      if (!z.kontury.length) return { data: [], obalka: null, slozeny: false, souhrn: s };
      const k = zakodujJednoduchy(z.kontury);
      return { data: k.data, obalka: k.obalka, slozeny: false, souhrn: s };
    });
  }

  /* ---------- cmap ---------- */
  function tabulkaCmap(mapa) {
    // mapa: [[cp, gid]] seřazené podle cp
    const bmp = mapa.filter(([c]) => c < 0xFFFF);
    const mimo = mapa.some(([c]) => c > 0xFFFF);

    // format 4
    const segs = [];
    for (let i = 0; i < bmp.length;) {
      let j = i + 1;
      while (j < bmp.length && bmp[j][0] === bmp[j - 1][0] + 1) j++;
      const beh = bmp.slice(i, j);
      // rozdělit běh na úseky se stejným rozdílem gid − cp; krátké úseky spojit do pole
      let k = 0;
      while (k < beh.length) {
        let l = k + 1;
        while (l < beh.length && beh[l][1] - beh[l][0] === beh[k][1] - beh[k][0]) l++;
        if (l - k >= 4 || (k === 0 && l === beh.length)) { segs.push({ od: beh[k][0], do: beh[l - 1][0], delta: beh[k][1] - beh[k][0] }); k = l; continue; }
        // pole: dokud nenarazí na delší úsek se stálým rozdílem
        let m = k;
        while (m < beh.length) {
          let e = m + 1;
          while (e < beh.length && beh[e][1] - beh[e][0] === beh[m][1] - beh[m][0]) e++;
          if (e - m >= 4) break;
          m = e;
        }
        segs.push({ od: beh[k][0], do: beh[m - 1][0], pole: beh.slice(k, m).map(x => x[1]) });
        k = m;
      }
      i = j;
    }
    segs.push({ od: 0xFFFF, do: 0xFFFF, delta: 1 });
    const n = segs.length;
    let mocnina = 1, log = 0;
    while (mocnina * 2 <= n) { mocnina *= 2; log++; }
    const f4 = new Bajty();
    f4.u16(4).u16(0).u16(0).u16(n * 2).u16(mocnina * 2).u16(log).u16(n * 2 - mocnina * 2);
    for (const s of segs) f4.u16(s.do);
    f4.u16(0);
    for (const s of segs) f4.u16(s.od);
    for (const s of segs) f4.u16(s.pole ? 0 : ((s.delta % 65536) + 65536) % 65536);
    let poleOff = 0;
    const polePos = [];
    segs.forEach((s, i) => {
      if (s.pole) { f4.u16(2 * (n - i) + poleOff); polePos.push(s.pole); poleOff += 2 * s.pole.length; }
      else f4.u16(0);
    });
    for (const p of polePos) for (const g of p) f4.u16(g);
    if (f4.delka > 65535) throw new Error('Tabulka cmap (formát 4) je příliš velká.');
    f4.set16(2, f4.delka);

    // format 12
    let f12 = null;
    if (mimo) {
      const skup = [];
      for (const [c, g] of mapa) {
        const s = skup[skup.length - 1];
        if (s && c === s.do + 1 && g === s.g + (c - s.od)) s.do = c;
        else skup.push({ od: c, do: c, g });
      }
      f12 = new Bajty();
      f12.u16(12).u16(0).u32(16 + 12 * skup.length).u32(0).u32(skup.length);
      for (const s of skup) f12.u32(s.od).u32(s.do).u32(s.g);
    }

    const zaznamy = [[0, 3, f4]];
    if (f12) zaznamy.push([0, 4, f12]);
    zaznamy.push([3, 1, f4]);
    if (f12) zaznamy.push([3, 10, f12]);
    const w = new Bajty();
    w.u16(0).u16(zaznamy.length);
    let off = 4 + 8 * zaznamy.length;
    const f4off = off, f12off = off + f4.delka;
    for (const [p, e, t] of zaznamy) w.u16(p).u16(e).u32(t === f4 ? f4off : f12off);
    w.bajty(f4.a);
    if (f12) w.bajty(f12.a);
    return w.vysledek();
  }

  /* ---------- name ---------- */
  function tabulkaName(info, s) {
    const verze = String(info.verzeFontu || '1.000').trim() || '1.000';
    const ps = psJmenoFontu(info);
    const rodina = String(info.rodina || 'Pismo').trim() || 'Pismo';
    const zaznamy = [];
    const pridej = (id, text) => { if (text != null && String(text).length) zaznamy.push([id, String(text)]); };
    pridej(0, info.copyright);
    if (s.ribbi) {
      pridej(1, rodina);
      pridej(2, s.zakladni);
    } else {
      pridej(1, rodina + ' ' + s.styl);
      pridej(2, s.zakladni);
    }
    pridej(3, verze + ';NONE;' + ps);
    pridej(4, s.styl.toLowerCase() === 'regular' ? rodina : rodina + ' ' + s.styl);
    pridej(5, /^version/i.test(verze) ? verze : 'Version ' + verze);
    pridej(6, ps);
    pridej(8, info.designer);
    pridej(9, info.designer);
    pridej(10, info.popis);
    pridej(11, info.url);
    pridej(13, info.licence);
    pridej(14, info.licenceUrl);
    if (!s.ribbi) { pridej(16, rodina); pridej(17, s.styl); }
    zaznamy.sort((a, b) => a[0] - b[0]);
    const w = new Bajty(), data = new Bajty();
    w.u16(0).u16(zaznamy.length).u16(6 + 12 * zaznamy.length);
    for (const [id, text] of zaznamy) {
      const od = data.delka;
      for (let i = 0; i < text.length; i++) data.u16(text.charCodeAt(i));   // UTF-16BE
      w.u16(3).u16(1).u16(0x409).u16(id).u16(data.delka - od).u16(od);
    }
    w.bajty(data.a);
    return w.vysledek();
  }

  /* ---------- Unicode rozsahy a kódové stránky pro OS/2 ---------- */
  const UNI_BITY = [
    [0, 0x0000, 0x007F], [1, 0x0080, 0x00FF], [2, 0x0100, 0x017F], [3, 0x0180, 0x024F], [4, 0x0250, 0x02AF],
    [4, 0x1D00, 0x1DBF], [5, 0x02B0, 0x02FF], [6, 0x0300, 0x036F], [7, 0x0370, 0x03FF], [9, 0x0400, 0x052F],
    [29, 0x1E00, 0x1EFF], [31, 0x2000, 0x206F], [32, 0x2070, 0x209F], [33, 0x20A0, 0x20CF], [35, 0x2100, 0x214F],
    [36, 0x2150, 0x218F], [37, 0x2190, 0x21FF], [38, 0x2200, 0x22FF], [39, 0x2300, 0x23FF], [43, 0x2500, 0x257F],
    [44, 0x2580, 0x259F], [45, 0x25A0, 0x25FF], [46, 0x2600, 0x26FF], [47, 0x2700, 0x27BF], [60, 0xE000, 0xF8FF],
    [62, 0xFB00, 0xFB4F]
  ];
  const CESKE_ZNAKY = 'ČčĎďĚěŇňŘřŠšŤťŮůŽžĹĺĽľŔŕŁłŃńŚśŹźŻżĄąĘęŐőŰű'.split('').map(c => c.codePointAt(0));

  function os2Rozsahy(kody) {
    const r = [0, 0, 0, 0];
    const nastav = b => { r[b >> 5] = (r[b >> 5] | (1 << (b & 31))) >>> 0; };
    for (const c of kody) {
      if (c > 0xFFFF) { nastav(57); continue; }
      for (const [b, a, z] of UNI_BITY) if (c >= a && c <= z) nastav(b);
    }
    const ma = c => kody.has(c);
    let cp1 = 0;
    const cpBit = b => { cp1 = (cp1 | (1 << b)) >>> 0; };
    let latinka = false;
    for (let c = 0x41; c <= 0x7A; c++) if (ma(c)) { latinka = true; break; }
    if (latinka) cpBit(0);                                   // Latin 1 (1252)
    if (CESKE_ZNAKY.some(ma)) cpBit(1);                       // Latin 2 – střední Evropa (1250)
    let azbuka = false, recke = false;
    for (const c of kody) { if (c >= 0x400 && c <= 0x45F) azbuka = true; if (c >= 0x391 && c <= 0x3CE) recke = true; }
    if (azbuka) cpBit(2);
    if (recke) cpBit(3);
    if (!cp1) cpBit(0);
    return { uni: r, cp1, cp2: 0 };
  }

  /* ---------- kerning: kern a GPOS ---------- */
  function kernPary(font, gid, varovani) {
    const out = [];
    for (const p of P.kernPary(font)) {
      if (!gid.has(p.l) || !gid.has(p.r)) continue;
      const v = Math.max(-32768, Math.min(32767, Math.round(p.v)));
      if (v) out.push({ l: gid.get(p.l), r: gid.get(p.r), v });
    }
    out.sort((a, b) => a.l - b.l || a.r - b.r);
    return out;
  }

  const KERN_MAX_PODTAB = Math.floor((65535 - 14) / 6);   // 10 920 párů do jedné podtabulky
  function tabulkaKern(pary, varovani, limit) {
    let p = pary;
    if (p.length > limit) {
      varovani.push('Tabulka kern: ' + p.length + ' párů je víc než limit ' + limit + ', zbytek je jen v GPOS.');
      p = p.slice(0, limit);
    }
    const casti = [];
    for (let i = 0; i < p.length; i += KERN_MAX_PODTAB) casti.push(p.slice(i, i + KERN_MAX_PODTAB));
    if (casti.length > 1) varovani.push('Tabulka kern je rozdělená do ' + casti.length + ' podtabulek – starší programy čtou jen první.');
    const w = new Bajty();
    w.u16(0).u16(casti.length);
    for (const c of casti) {
      const n = c.length;
      let mocnina = 1, log = 0;
      while (mocnina * 2 <= n) { mocnina *= 2; log++; }
      if (!n) { mocnina = 0; }
      w.u16(0).u16(14 + 6 * n).u16(0x0001).u16(n).u16(mocnina * 6).u16(n ? log : 0).u16(n * 6 - mocnina * 6);
      for (const q of c) w.u16(q.l).u16(q.r).i16(q.v);
    }
    return w.vysledek();
  }

  function pokryti(gidy) {   // Coverage format 1 (seřazené gid)
    const w = new Bajty();
    w.u16(1).u16(gidy.length);
    for (const g of gidy) w.u16(g);
    return w.a;
  }

  /* Společná kostra GPOS/GSUB: skripty DFLT + latn, jedna vlastnost, jedno vyhledávání.
     Když se podtabulky nevejdou do 16bitových posunů, použije se rozšíření (typ 9 / 7). */
  function sestavLayout(vlastnost, typ, typRozsireni, podtabulky) {
    const w = new Bajty();
    w.u16(1).u16(0).u16(10).u16(0).u16(0);
    // ScriptList
    w.u16(2).tag('DFLT').u16(14).tag('latn').u16(26);
    for (let i = 0; i < 2; i++) w.u16(4).u16(0).u16(0).u16(0xFFFF).u16(1).u16(0);
    w.set16(6, w.delka);
    // FeatureList
    w.u16(1).tag(vlastnost).u16(8).u16(0).u16(1).u16(0);
    w.set16(8, w.delka);
    // LookupList
    w.u16(1).u16(4);
    const n = podtabulky.length, hlav = 6 + 2 * n;
    const celkem = podtabulky.reduce((a, s) => a + s.length, 0);
    if (hlav + celkem <= 0xFFFF) {
      w.u16(typ).u16(0).u16(n);
      let off = hlav;
      for (const s of podtabulky) { w.u16(off); off += s.length; }
      for (const s of podtabulky) w.bajty(s);
    } else {
      w.u16(typRozsireni).u16(0).u16(n);
      for (let i = 0; i < n; i++) w.u16(hlav + 8 * i);
      let off = hlav + 8 * n;
      for (let i = 0; i < n; i++) { w.u16(1).u16(typ).u32(off - (hlav + 8 * i)); off += podtabulky[i].length; }
      for (const s of podtabulky) w.bajty(s);
    }
    return w.vysledek();
  }

  function tabulkaGPOS(pary, varovani) {
    // seskupit podle levého glyfu
    const leve = new Map();
    for (const p of pary) { if (!leve.has(p.l)) leve.set(p.l, []); leve.get(p.l).push(p); }
    const klice = Array.from(leve.keys()).sort((a, b) => a - b);
    const podtabulky = [];
    let davka = [], velikost = 0;
    const vyprazdni = () => {
      if (!davka.length) return;
      const w = new Bajty();
      const n = davka.length;
      w.u16(1).u16(0).u16(0x0004).u16(0).u16(n);
      let off = 10 + 2 * n;
      for (const l of davka) { w.u16(off); off += 2 + 4 * leve.get(l).length; }
      for (const l of davka) {
        const sada = leve.get(l);
        w.u16(sada.length);
        for (const q of sada) w.u16(q.r).i16(q.v);
      }
      w.set16(2, w.delka);
      w.bajty(pokryti(davka));
      podtabulky.push(w.a);
      davka = []; velikost = 0;
    };
    for (const l of klice) {
      let sada = leve.get(l);
      if (sada.length > 16000) {
        varovani.push('GPOS: glyf ' + l + ' má příliš mnoho párů, ořezáno na 16 000.');
        sada = sada.slice(0, 16000); leve.set(l, sada);
      }
      const pridat = 2 + 4 * sada.length + 4;
      if (velikost + pridat > 60000) vyprazdni();
      davka.push(l); velikost += pridat;
    }
    vyprazdni();
    return sestavLayout('kern', 2, 9, podtabulky);
  }

  function tabulkaGSUB(ligatury) {
    // ligatury: [{z: [gid…], na: gid}]
    const podle = new Map();
    for (const l of ligatury) { if (!podle.has(l.z[0])) podle.set(l.z[0], []); podle.get(l.z[0]).push(l); }
    const prvni = Array.from(podle.keys()).sort((a, b) => a - b);
    const w = new Bajty();
    const n = prvni.length;
    w.u16(1).u16(0).u16(n);
    const sady = prvni.map(g => {
      const s = podle.get(g).slice().sort((a, b) => b.z.length - a.z.length);   // nejdelší vyhrává
      const b = new Bajty();
      b.u16(s.length);
      let off = 2 + 2 * s.length;
      for (const l of s) { b.u16(off); off += 4 + 2 * (l.z.length - 1); }
      for (const l of s) { b.u16(l.na).u16(l.z.length); for (let i = 1; i < l.z.length; i++) b.u16(l.z[i]); }
      return b.a;
    });
    let off = 6 + 2 * n;
    for (const s of sady) { w.u16(off); off += s.length; }
    for (const s of sady) w.bajty(s);
    w.set16(2, w.delka);
    w.bajty(pokryti(prvni));
    return sestavLayout('liga', 4, 7, [w.a]);
  }

  function ligaturyGid(font, gid, varovani) {
    const out = [], videno = new Set();
    for (const l of font.ligatury || []) {
      if (!l || !Array.isArray(l.z) || l.z.length < 2) continue;
      if (!gid.has(l.na) || !l.z.every(n => gid.has(n))) { varovani.push('Ligatura ' + (l.z || []).join('+') + ' → ' + l.na + ' odkazuje na chybějící glyf, vynechána.'); continue; }
      const k = l.z.join(' ');
      if (videno.has(k)) continue;
      videno.add(k);
      out.push({ z: l.z.map(n => gid.get(n)), na: gid.get(l.na) });
    }
    return out;
  }

  /* ============================================================
     TTF
     ============================================================ */
  /* Glyfy připravené v mřížce, ale nenakreslené, se do fontu nezapisují
     (jako ve FontForge) – jinak by text místo záložního písma ukázal prázdno.
     Mezery, .notdef a glyfy, na které odkazuje komponenta nebo ligatura, zůstávají. */
  const MEZERY = new Set([0x20, 0xA0, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x200B, 0x202F, 0x205F, 0x3000, 0x200C, 0x200D, 0xAD]);
  const VIDITELNY = /^[\p{L}\p{N}\p{P}\p{S}]$/u;
  P.bezPrazdnych = function (font) {
    const pouzite = new Set(['.notdef']);
    for (const n of font.poradi) for (const k of font.glyfy[n].komponenty || []) pouzite.add(k.glyf);
    for (const l of font.ligatury || []) { pouzite.add(l.na); for (const z of l.z) pouzite.add(z); }
    for (const l in font.kerning || {}) { pouzite.add(l); for (const r in font.kerning[l]) pouzite.add(r); }
    const vyhodit = font.poradi.filter(n => {
      const g = font.glyfy[n];
      if (pouzite.has(n) || !P.glyfJePrazdny(g) || !(g.uni || []).length) return false;
      // jen viditelné znaky (písmeno, číslice, interpunkce, symbol); mezery a řídicí znaky zůstávají
      return g.uni.every(u => !MEZERY.has(u) && VIDITELNY.test(String.fromCodePoint(u)));
    });
    if (!vyhodit.length) return font;
    const pryc = new Set(vyhodit), f = Object.assign({}, font);
    f.poradi = font.poradi.filter(n => !pryc.has(n));
    f.glyfy = {}; for (const n of f.poradi) f.glyfy[n] = font.glyfy[n];
    return f;
  };

  P.exportTTF = function (font, volby) {
    const v = volby || {};
    if (!v.vcetnePrazdnych) font = P.bezPrazdnych(font);
    const varovani = [];
    const info = infoFontu(font);
    const st = stylFontu(info);
    const upm = Math.round(info.upm) || 1000;
    const zaznamy = pripravGlyfy(font, v, varovani);
    const kod = zakodujGlyfy(zaznamy);
    const gid = new Map(font.poradi.map((n, i) => [n, i]));
    const numGlyphs = zaznamy.length;

    // glyf + loca
    const glyf = new Bajty(), offs = [];
    for (const k of kod) { offs.push(glyf.delka); glyf.bajty(k.data); glyf.zarovnej(4); }
    offs.push(glyf.delka);
    const kratka = glyf.delka <= 0x1FFFE;
    const loca = new Bajty();
    for (const o of offs) kratka ? loca.u16(o / 2) : loca.u32(o);

    // metriky
    let hx0 = Infinity, hy0 = Infinity, hx1 = -Infinity, hy1 = -Infinity;
    let awMax = 0, minLsb = Infinity, minRsb = Infinity, maxExt = -Infinity;
    let maxPoints = 0, maxContours = 0, maxCompPoints = 0, maxCompContours = 0, maxCompEl = 0, maxCompDepth = 0;
    let sumaSirek = 0, pocetSirek = 0;
    const lsb = [];
    zaznamy.forEach((z, i) => {
      const k = kod[i], o = k.obalka;
      awMax = Math.max(awMax, z.sirka);
      if (z.sirka > 0) { sumaSirek += z.sirka; pocetSirek++; }
      if (o) {
        hx0 = Math.min(hx0, o.x0); hy0 = Math.min(hy0, o.y0); hx1 = Math.max(hx1, o.x1); hy1 = Math.max(hy1, o.y1);
        minLsb = Math.min(minLsb, o.x0); minRsb = Math.min(minRsb, z.sirka - o.x1); maxExt = Math.max(maxExt, o.x1);
      }
      lsb.push(o ? o.x0 : 0);
      const s = k.souhrn;
      if (k.slozeny) {
        maxCompPoints = Math.max(maxCompPoints, s.bodu); maxCompContours = Math.max(maxCompContours, s.kontur);
        maxCompEl = Math.max(maxCompEl, s.komponent); maxCompDepth = Math.max(maxCompDepth, s.hloubka);
      } else { maxPoints = Math.max(maxPoints, s.bodu); maxContours = Math.max(maxContours, s.kontur); }
    });
    if (hx0 === Infinity) { hx0 = hy0 = hx1 = hy1 = 0; minLsb = minRsb = maxExt = 0; }

    // hmtx (konec se stejnou šířkou stačí jednou)
    let nMetrik = numGlyphs;
    while (nMetrik > 1 && zaznamy[nMetrik - 1].sirka === zaznamy[nMetrik - 2].sirka) nMetrik--;
    const hmtx = new Bajty();
    for (let i = 0; i < numGlyphs; i++) {
      if (i < nMetrik) hmtx.u16(zaznamy[i].sirka);
      hmtx.i16(lsb[i]);
    }

    const cas = v.cas instanceof Date ? v.cas : new Date();
    const tabulky = {};

    // head
    const macStyle = (st.tucne ? 1 : 0) | (st.kurziva ? 2 : 0);
    const revize = parseFloat(String(info.verzeFontu).replace(/^[^0-9]*/, '')) || 1;
    tabulky.head = new Bajty().u32(0x00010000).fixed(revize).u32(0).u32(0x5F0F3CF5).u16(0x000B).u16(upm)
      .datum(cas).datum(cas).i16(hx0).i16(hy0).i16(hx1).i16(hy1).u16(macStyle).u16(8).i16(2)
      .i16(kratka ? 0 : 1).i16(0).vysledek();

    // hhea
    const asc = Math.round(info.ascender), desc = Math.round(info.descender), gap = Math.round(info.lineGap || 0);
    const sklon = +info.sklon || 0;
    let caretRise = 1, caretRun = 0;
    if (sklon) { caretRise = upm; caretRun = Math.round(Math.tan(-sklon * Math.PI / 180) * upm); }
    tabulky.hhea = new Bajty().u32(0x00010000).i16(asc).i16(desc).i16(gap).u16(awMax).i16(minLsb).i16(minRsb).i16(maxExt)
      .i16(caretRise).i16(caretRun).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(nMetrik).vysledek();

    // maxp 1.0
    tabulky.maxp = new Bajty().u32(0x00010000).u16(numGlyphs).u16(maxPoints).u16(maxContours).u16(maxCompPoints)
      .u16(maxCompContours).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(maxCompEl).u16(maxCompDepth).vysledek();

    // cmap
    const mapa = [];
    for (const [cp, n] of P.cmap(font)) if (gid.has(n) && cp >= 0 && cp <= 0x10FFFF && cp !== 0xFFFF) mapa.push([cp, gid.get(n)]);
    mapa.sort((a, b) => a[0] - b[0]);
    tabulky.cmap = tabulkaCmap(mapa);

    // kerning a ligatury
    const pary = kernPary(font, gid, varovani);
    const lig = ligaturyGid(font, gid, varovani);
    const kernRezim = v.kern || 'oba';
    if (pary.length && (kernRezim === 'oba' || kernRezim === 'kern')) tabulky.kern = tabulkaKern(pary, varovani, v.kernLimit || 10000);
    if (pary.length && (kernRezim === 'oba' || kernRezim === 'gpos')) tabulky.GPOS = tabulkaGPOS(pary, varovani);
    if (lig.length) tabulky.GSUB = tabulkaGSUB(lig);

    // OS/2 verze 4
    const kody = new Set(mapa.map(x => x[0]));
    const roz = os2Rozsahy(kody);
    const prvniZnak = mapa.length ? Math.min(mapa[0][0], 0xFFFF) : 0x20;
    const posledniZnak = mapa.length ? Math.min(mapa[mapa.length - 1][0], 0xFFFF) : 0x20;
    let fsSel = 0x80;   // USE_TYPO_METRICS
    if (st.kurziva) fsSel |= 0x01;
    if (st.tucne) fsSel |= 0x20;
    if (!st.kurziva && !st.tucne) fsSel |= 0x40;
    const maxKontext = Math.max(pary.length ? 2 : 0, lig.reduce((a, l) => Math.max(a, l.z.length), 0));
    const xv = Math.round(info.xVyska || 0), cap = Math.round(info.vyskaVerzalek || 0);
    const vaha = Math.max(1, Math.min(1000, Math.round(info.vaha || 400)));
    const sirkaTr = Math.max(1, Math.min(9, Math.round(info.sirkaTrida || 5)));
    const os2 = new Bajty().u16(4).i16(pocetSirek ? Math.round(sumaSirek / pocetSirek) : 0).u16(vaha).u16(sirkaTr).u16(0)
      .i16(Math.round(upm * 0.65)).i16(Math.round(upm * 0.6)).i16(0).i16(Math.round(upm * 0.075))
      .i16(Math.round(upm * 0.65)).i16(Math.round(upm * 0.6)).i16(0).i16(Math.round(upm * 0.35))
      .i16(Math.round(info.podtrzeniTl || upm * 0.05)).i16(Math.round(xv ? xv * 0.5 + (info.podtrzeniTl || 0) * 0.5 : upm * 0.25))
      .i16(0);
    for (let i = 0; i < 10; i++) os2.u8(0);   // PANOSE
    os2.u32(roz.uni[0]).u32(roz.uni[1]).u32(roz.uni[2]).u32(roz.uni[3]).tag('NONE').u16(fsSel)
      .u16(prvniZnak).u16(posledniZnak).i16(asc).i16(desc).i16(gap)
      .u16(Math.max(0, Math.max(asc, hy1))).u16(Math.max(0, Math.max(-desc, -hy0)))
      .u32(roz.cp1).u32(roz.cp2).i16(xv).i16(cap).u16(0).u16(0x20).u16(maxKontext);
    tabulky['OS/2'] = os2.vysledek();

    // name
    tabulky.name = tabulkaName(info, st);

    // post 2.0
    const sirky = zaznamy.map(z => z.sirka).filter(x => x > 0);
    const pevna = sirky.length > 1 && sirky.every(x => x === sirky[0]) ? 1 : 0;
    const post = new Bajty().u32(0x00020000).fixed(sklon).i16(Math.round(info.podtrzeniPoz || 0))
      .i16(Math.round(info.podtrzeniTl || 0)).u32(pevna).u32(0).u32(0).u32(0).u32(0).u16(numGlyphs);
    const vlastni = [], pouzite = new Set();
    for (let i = 0; i < numGlyphs; i++) {
      let n = zaznamy[i].nazev;
      if (!P.platnyNazev(n) || pouzite.has(n) || /[^\x21-\x7E]/.test(n)) {
        const puv = n;
        n = 'glyph' + i;
        while (pouzite.has(n)) n += '_';
        varovani.push('Neplatný nebo zdvojený název glyfu „' + puv + '“ zapsán jako ' + n + '.');
      }
      pouzite.add(n);
      if (MAC_INDEX.has(n)) post.u16(MAC_INDEX.get(n));
      else { post.u16(258 + vlastni.length); vlastni.push(n); }
    }
    for (const n of vlastni) { post.u8(n.length); for (let i = 0; i < n.length; i++) post.u8(n.charCodeAt(i)); }
    tabulky.post = post.vysledek();

    tabulky.hmtx = hmtx.vysledek();
    tabulky.loca = loca.vysledek();
    tabulky.glyf = glyf.vysledek();

    const out = sestavSfnt(tabulky, 0x00010000);
    out.varovani = varovani;
    if (Array.isArray(v.varovani)) for (const x of varovani) v.varovani.push(x);
    return out;
  };

  /* ============================================================
     WOFF 1.0
     ============================================================ */
  async function deflate(data) {
    if (typeof CompressionStream === 'undefined') return null;
    const proud = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(proud).arrayBuffer());
  }

  P.sfntNaWoff = async function (sfnt) {
    const { verze, tabulky } = rozeberSfnt(sfnt);
    const tagy = Object.keys(tabulky).sort();
    const n = tagy.length;
    const polozky = [];
    for (const t of tagy) {
      const d = tabulky[t];
      const z = await deflate(d);
      const c = z && z.length < d.length ? z : d;
      polozky.push({ t, d, c, soucet: kontrolniSoucet(d, 0, d.length) });
    }
    let celkem = 44 + 20 * n;
    let sfntVel = 12 + 16 * n;
    for (const p of polozky) { celkem += (p.c.length + 3) & ~3; sfntVel += (p.d.length + 3) & ~3; }
    const head = tabulky.head;
    const w = new Bajty();
    w.tag('wOFF').u32(verze).u32(celkem).u16(n).u16(0).u32(sfntVel)
      .u16(head ? ctiU16(head, 4) : 1).u16(head ? ctiU16(head, 6) : 0)
      .u32(0).u32(0).u32(0).u32(0).u32(0);
    let off = 44 + 20 * n;
    for (const p of polozky) {
      w.tag(p.t).u32(off).u32(p.c.length).u32(p.d.length).u32(p.soucet);
      off += (p.c.length + 3) & ~3;
    }
    const out = new Uint8Array(celkem);
    out.set(w.a, 0);
    off = 44 + 20 * n;
    for (const p of polozky) { out.set(p.c, off); off += (p.c.length + 3) & ~3; }
    return out;
  };

  P.exportWOFF = async function (font, volby) {
    const ttf = P.exportTTF(font, volby);
    const woff = await P.sfntNaWoff(ttf);
    woff.varovani = ttf.varovani;
    return woff;
  };

  /* ============================================================
     OTF (CFF) přes opentype.js
     ============================================================ */
  P.exportOTF = function (font, volby) {
    if (!(volby && volby.vcetnePrazdnych)) font = P.bezPrazdnych(font);
    const ot = G.opentype;
    if (!ot || !ot.Font) throw new Error('Chybí knihovna opentype.js (lib/opentype.min.js).');
    const v = volby || {};
    const info = infoFontu(font);
    const st = stylFontu(info);
    const varovani = [];
    const glyfy = font.poradi.map(n => {
      const g = font.glyfy[n];
      const cesta = new ot.Path();
      for (const o of P.plneObrysy(font, g)) {
        if (o.otevreny) continue;
        // CFF: vnější obrysy proti směru hodinových ručiček (opak TrueType)
        const seg = P.segmenty({ body: P.obratBody(o.body) });
        if (!seg.length) continue;
        const r = Math.round;
        cesta.moveTo(r(seg[0].p0.x), r(seg[0].p0.y));
        for (const s of seg) {
          if (s.typ === 'l') cesta.lineTo(r(s.p3.x), r(s.p3.y));
          else cesta.curveTo(r(s.p1.x), r(s.p1.y), r(s.p2.x), r(s.p2.y), r(s.p3.x), r(s.p3.y));
        }
        cesta.close();
      }
      const uni = (g.uni || []).filter(u => u >= 0 && u <= 0x10FFFF);
      const gl = new ot.Glyph({
        name: n, unicode: uni[0], unicodes: uni,
        advanceWidth: Math.max(0, Math.round(g.sirka || 0)), path: cesta
      });
      gl.unicodes = uni.slice();   // opentype.js 1.3 z voleb převezme jen první znak
      return gl;
    });
    const otf = new ot.Font({
      familyName: String(info.rodina || 'Pismo'), styleName: st.styl,
      postScriptName: psJmenoFontu(info),
      unitsPerEm: Math.round(info.upm) || 1000,
      ascender: Math.round(info.ascender), descender: Math.round(info.descender),
      designer: info.designer || '', designerURL: info.url || '', manufacturer: info.designer || '',
      manufacturerURL: info.url || '', license: info.licence || '', licenseURL: info.licenceUrl || '',
      version: String(info.verzeFontu || '1.000'), description: info.popis || '', copyright: info.copyright || '',
      glyphs: glyfy
    });
    if (otf.tables && otf.tables.os2) {
      otf.tables.os2.usWeightClass = Math.max(1, Math.min(1000, Math.round(info.vaha || 400)));
      otf.tables.os2.usWidthClass = Math.max(1, Math.min(9, Math.round(info.sirkaTrida || 5)));
    }
    const sfnt = new Uint8Array(otf.toArrayBuffer());
    // doplnit vlastní name (české znaky jen v UTF-16), GPOS kern a GSUB liga
    const { verze, tabulky } = rozeberSfnt(sfnt);
    const gid = new Map(font.poradi.map((n, i) => [n, i]));
    tabulky.name = tabulkaName(info, st);
    const pary = kernPary(font, gid, varovani);
    if (pary.length) tabulky.GPOS = tabulkaGPOS(pary, varovani);
    const lig = ligaturyGid(font, gid, varovani);
    if (lig.length) tabulky.GSUB = tabulkaGSUB(lig);
    else delete tabulky.GSUB;
    const out = sestavSfnt(tabulky, verze);
    if (Array.isArray(v.varovani)) for (const x of varovani) v.varovani.push(x);
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  };

  /* ============================================================
     SVG
     ============================================================ */
  function xmlText(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }
  function znakXml(cp) {
    // znaky, které by v atributu dělaly potíže, jako číselnou entitu
    if (cp < 0x20 || cp === 0x22 || cp === 0x26 || cp === 0x3C || cp === 0x3E || cp > 0x7E) return '&#x' + cp.toString(16).toUpperCase() + ';';
    return String.fromCodePoint(cp);
  }
  function uzavreneObrysy(font, g) { return P.plneObrysy(font, g).filter(o => !o.otevreny); }

  P.exportSVGFont = function (font) {
    font = P.bezPrazdnych(font);
    const info = infoFontu(font);
    const st = stylFontu(info);
    const id = psJmenoFontu(info);
    const radky = [];
    radky.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
    radky.push('<svg xmlns="http://www.w3.org/2000/svg" version="1.1">');
    radky.push('<metadata>' + xmlText((info.copyright || '') + (info.designer ? ' – ' + info.designer : '')) + '</metadata>');
    radky.push('<defs>');
    const prum = Math.round(info.upm * 0.5);
    radky.push('<font id="' + xmlText(id) + '" horiz-adv-x="' + prum + '">');
    radky.push('<font-face font-family="' + xmlText(info.rodina) + '" font-weight="' + Math.round(info.vaha || 400) +
      '" font-style="' + (st.kurziva ? 'italic' : 'normal') + '" units-per-em="' + Math.round(info.upm) +
      '" ascent="' + Math.round(info.ascender) + '" descent="' + Math.round(info.descender) +
      '" x-height="' + Math.round(info.xVyska || 0) + '" cap-height="' + Math.round(info.vyskaVerzalek || 0) +
      '" underline-position="' + Math.round(info.podtrzeniPoz || 0) + '" underline-thickness="' + Math.round(info.podtrzeniTl || 0) +
      (info.sklon ? '" slope="' + (+info.sklon) : '') + '"/>');
    const nd = font.glyfy['.notdef'];
    if (nd) radky.push('<missing-glyph horiz-adv-x="' + Math.round(nd.sirka) + '" d="' + P.obrysyNaSvg(uzavreneObrysy(font, nd)) + '"/>');
    const pouzite = new Set();
    for (const n of font.poradi) {
      const g = font.glyfy[n];
      if (n === '.notdef') continue;
      const d = P.obrysyNaSvg(uzavreneObrysy(font, g));
      const zaklad = ' glyph-name="' + xmlText(n) + '" horiz-adv-x="' + Math.round(g.sirka) + '"' + (d ? ' d="' + d + '"' : '');
      const uni = (g.uni || []).filter(u => !pouzite.has(String(u)));
      if (!uni.length) radky.push('<glyph' + zaklad + '/>');
      for (const u of uni) { pouzite.add(String(u)); radky.push('<glyph unicode="' + znakXml(u) + '"' + zaklad + '/>'); }
    }
    // ligatury: glyf s víceznakovým unicode (jen když všechny části mají znak)
    for (const l of font.ligatury || []) {
      const g = font.glyfy[l.na];
      if (!g || !Array.isArray(l.z)) continue;
      const casti = l.z.map(n => font.glyfy[n] && (font.glyfy[n].uni || [])[0]);
      if (casti.some(u => u == null)) continue;
      const klic = casti.join(',');
      if (pouzite.has(klic)) continue;
      pouzite.add(klic);
      const d = P.obrysyNaSvg(uzavreneObrysy(font, g));
      radky.push('<glyph unicode="' + casti.map(znakXml).join('') + '" glyph-name="' + xmlText(l.na) +
        '" horiz-adv-x="' + Math.round(g.sirka) + '"' + (d ? ' d="' + d + '"' : '') + '/>');
    }
    for (const p of P.kernPary(font)) {
      radky.push('<hkern g1="' + xmlText(p.l) + '" g2="' + xmlText(p.r) + '" k="' + (-p.v) + '"/>');
    }
    radky.push('</font>');
    radky.push('</defs>');
    radky.push('</svg>');
    return radky.join('\n') + '\n';
  };

  P.exportSVGGlyf = function (font, nazev) {
    const g = font.glyfy[nazev];
    if (!g) throw new Error('Glyf „' + nazev + '“ neexistuje.');
    const info = infoFontu(font);
    const asc = Math.round(info.ascender), desc = Math.round(info.descender);
    const vys = asc - desc;
    const o = P.obalkaGlyfu(font, g);
    let x0 = 0, sirka = Math.round(g.sirka);
    if (o && (o.x0 < 0 || o.x1 > sirka)) { x0 = Math.floor(Math.min(0, o.x0)); sirka = Math.ceil(Math.max(sirka, o.x1)) - x0; }
    if (sirka <= 0) sirka = Math.round(info.upm * 0.5);
    const flip = ob => ({ body: ob.body.map(b => Object.assign({}, b, { y: asc - b.y })), otevreny: ob.otevreny });
    const vse = P.plneObrysy(font, g).map(flip);
    const plne = P.obrysyNaSvg(vse.filter(x => !x.otevreny));
    const otevrene = P.obrysyNaSvg(vse.filter(x => x.otevreny));
    let s = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n';
    s += '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="' + x0 + ' 0 ' + sirka + ' ' + vys +
      '" width="' + sirka + '" height="' + vys + '">\n';
    s += '<title>' + xmlText(nazev) + '</title>\n';
    if (plne) s += '<path d="' + plne + '" fill="currentColor"/>\n';
    if (otevrene) s += '<path d="' + otevrene + '" fill="none" stroke="currentColor" stroke-width="' + Math.max(1, Math.round(info.upm / 200)) + '"/>\n';
    s += '</svg>\n';
    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
