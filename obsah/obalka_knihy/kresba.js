/* ============================================================
   obalka_knihy/kresba.js – scéna obálky a její vykreslení
   do plátna (náhled, PNG) a do PDF (jsPDF).

   Vrstvy:
     raster  – pozadí (barva / přechod), obrázek přes arch, obrázek
               přední strany, logo. V PDF jde jako obrázek 300 DPI.
     vektory – texty jako obrysy písmen (opentype.js), čárový kód.
               V náhledu, PNG i PDF se kreslí z týchž příkazů,
               takže PDF vypadá přesně jako náhled a česká
               diakritika nezávisí na písmech PDF prohlížeče.
     vodítka – ořez, spadávka, bezpečná zóna, hřbet, drážky.
   Délky v mm, počátek vlevo nahoře na hraně archu.
   ============================================================ */
(function () {
  'use strict';
  const O = window.OBALKA;
  const PT = 25.4 / 72;

  /* ---------- text → obrysy ---------- */
  function glyfy(font, text, vel, prostrkani) {
    const g = font.stringToGlyphs(text), k = vel / font.unitsPerEm, trk = (prostrkani || 0) / 1000 * vel;
    const pozice = []; let x = 0;
    for (let i = 0; i < g.length; i++) {
      pozice.push(x);
      x += g[i].advanceWidth * k;
      if (i < g.length - 1) x += font.getKerningValue(g[i], g[i + 1]) * k + trk;
    }
    return { g, pozice, sirka: x };
  }
  const sirkaTextu = (font, text, vel, prostrkani) => glyfy(font, text, vel, prostrkani).sirka;
  const chybejici = (font, text) => [...new Set([...text].filter(z => z.trim() && font.charToGlyphIndex(z) === 0))];

  /* příkazy obrysů textu; tr(x, y) převede místní souřadnice (účaří, y dolů) na arch */
  function obrysy(font, text, vel, prostrkani, tr, ven) {
    const { g, pozice } = glyfy(font, text, vel, prostrkani);
    for (let i = 0; i < g.length; i++) {
      for (const c of g[i].getPath(pozice[i], 0, vel).commands) {
        const p = { type: c.type };
        if (c.type !== 'Z') { const b = tr(c.x, c.y); p.x = b[0]; p.y = b[1]; }
        if (c.type === 'Q' || c.type === 'C') { const b = tr(c.x1, c.y1); p.x1 = b[0]; p.y1 = b[1]; }
        if (c.type === 'C') { const b = tr(c.x2, c.y2); p.x2 = b[0]; p.y2 = b[1]; }
        ven.push(p);
      }
    }
  }
  const vyskaVersalek = font => {
    const os2 = font.tables.os2;
    return (os2 && os2.sCapHeight ? os2.sCapHeight : 0.7 * font.unitsPerEm) / font.unitsPerEm;
  };
  const nahoru = font => font.ascender / font.unitsPerEm;

  /* ---------- obrázek „na výplň“ s posunem a zvětšením ---------- */
  function umisteniObr(img, box, o) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const s = Math.max(box.w / iw, box.h / ih) * Math.max(1, +o.zoom || 1);
    const dw = iw * s, dh = ih * s;
    return { x: box.x + (box.w - dw) * (0.5 + (+o.posX || 0) / 200), y: box.y + (box.h - dh) * (0.5 + (+o.posY || 0) / 200), w: dw, h: dh };
  }

  /* oblast obrázku přední strany */
  function boxPredni(a, o) {
    const p = a.predni;
    if (!(+o.okraj > 0)) {
      const box = { x: p.x, y: 0, w: a.sirka - p.x, h: a.vyska };
      const v = Math.min(100, Math.max(10, +o.vyska || 100));
      if (v >= 100) return box;
      const h = p.h * v / 100;
      if (o.svisle === 'dole') return { x: box.x, y: p.y + p.h - h, w: box.w, h: a.vyska - (p.y + p.h - h) };
      if (o.svisle === 'stred') return { x: box.x, y: p.y + (p.h - h) / 2, w: box.w, h };
      return { x: box.x, y: 0, w: box.w, h: p.y + h };
    }
    const r = O.zmensi(p, +o.okraj);
    const h = r.h * Math.min(100, Math.max(10, +o.vyska || 100)) / 100;
    const y = o.svisle === 'dole' ? r.y + r.h - h : o.svisle === 'stred' ? r.y + (r.h - h) / 2 : r.y;
    return { x: r.x, y, w: r.w, h };
  }

  /* ---------- sestavení scény ----------
     n = návrh, zdroje = {pisma: {id: opentype.Font}, obrazky: {id: Image}}, nahradni = id písma, když chybí */
  function sestav(n, zdroje) {
    const R = O.zNavrhu(n.kniha), a = R.arch, k = n.kniha;
    const tisk = O.TISKARNY[k.tiskarna] || O.TISKARNY.obecna;
    const sc = { R, a, raster: [], vektory: [], voditka: [], chybi: {}, cekaNaPisma: [], info: {} };
    const pismo = id => {
      const f = zdroje.pisma[id];
      if (!f) { sc.cekaNaPisma.push(id); return null; }
      return f;
    };
    const obr = id => (id && zdroje.obrazky[id]) || null;

    /* raster */
    const pz = n.pozadi;
    sc.raster.push(pz.typ === 'prechod'
      ? { druh: 'prechod', x: 0, y: 0, w: a.sirka, h: a.vyska, barva1: pz.barva1, barva2: pz.barva2, uhel: +pz.uhel || 0 }
      : { druh: 'barva', x: 0, y: 0, w: a.sirka, h: a.vyska, barva: pz.barva1 });
    const ia = obr(n.obrArch.id);
    if (ia) { const box = { x: 0, y: 0, w: a.sirka, h: a.vyska }; sc.raster.push({ druh: 'obr', img: ia, box, kam: umisteniObr(ia, box, n.obrArch), kryti: (+n.obrArch.kryti || 100) / 100 }); }
    const ip = obr(n.obrPredni.id);
    if (ip) { const box = boxPredni(a, n.obrPredni); sc.raster.push({ druh: 'obr', img: ip, box, kam: umisteniObr(ip, box, n.obrPredni), kryti: 1, predni: true }); }
    sc.boxPredni = boxPredni(a, n.obrPredni);
    const il = obr(n.logo.id);
    const okrH = tisk.okrajHrbetu;
    let logoHrbetVyska = 0;
    if (il) {
      const iw = il.naturalWidth || il.width, ih = il.naturalHeight || il.height;
      if (n.logo.kde === 'hrbet' || n.logo.kde === 'oboje') {
        const w = Math.min(+n.logo.sirka, a.hrbet.w - 2 * okrH);
        if (w > 0) {
          const h = w * ih / iw;
          logoHrbetVyska = h;
          sc.raster.push({ druh: 'logo', img: il, x: a.hrbet.x + (a.hrbet.w - w) / 2, y: a.hrbet.y + a.hrbet.h - R.bezpecna - h, w, h });
        }
      }
      if (n.logo.kde === 'zadni' || n.logo.kde === 'oboje') {
        const w = +n.logo.sirka, h = w * ih / iw;
        const s = O.zmensi(a.zadni, R.bezpecna);
        sc.raster.push({ druh: 'logo', img: il, x: s.x, y: s.y + s.h - h, w, h });
      }
    }

    /* texty přední strany */
    const bez = O.zmensi(a.predni, R.bezpecna);
    for (const klic of ['nazev', 'podtitul', 'autor']) {
      const t = n[klic], f = pismo(t.pismo);
      if (!t.text.trim() || !f) continue;
      const vel = t.velikost * PT, rad = vel * (+t.radkovani || 1.2);
      const chybi = chybejici(f, t.text); if (chybi.length) sc.chybi[klic] = chybi;
      let y = a.predni.y + a.predni.h * t.y / 100 + nahoru(f) * vel;
      const cesty = [];
      for (const radek of t.text.split('\n')) {
        const w = sirkaTextu(f, radek, vel, t.prostrkani);
        const x = t.zarovnani === 'vlevo' ? bez.x : t.zarovnani === 'vpravo' ? bez.x + bez.w - w : bez.x + (bez.w - w) / 2;
        if (w > bez.w + 0.01) sc.info.siroky = (sc.info.siroky || []).concat(klic);
        const yy = y;
        obrysy(f, radek, vel, t.prostrkani, (u, v) => [x + u, yy + v], cesty);
        y += rad;
      }
      sc.vektory.push({ druh: 'cesta', prikazy: cesty, barva: t.barva, co: klic, obrys: +t.obrys || 0, barvaObrysu: t.barvaObrysu });
    }

    /* hřbet */
    const h = n.hrbet, fh = pismo(h.pismo);
    const textHrbetu = (h.text || '').trim();
    sc.info.maHrbetText = !!textHrbetu;
    if (textHrbetu && fh) {
      const vel = h.velikost * PT;
      const chybi = chybejici(fh, textHrbetu); if (chybi.length) sc.chybi.hrbet = chybi;
      const w = sirkaTextu(fh, textHrbetu, vel, h.prostrkani), cap = vyskaVersalek(fh) * vel;
      const desc = -fh.descender / fh.unitsPerEm * vel;
      sc.info.hrbetTextVyska = cap + desc;   // versálky + dotahy (j, p, ý…)
      sc.info.hrbetTextDelka = w + (logoHrbetVyska ? logoHrbetVyska + 4 : 0);
      const cx = a.hrbet.x + a.hrbet.w / 2;
      const prostor = a.hrbet.h - (logoHrbetVyska ? logoHrbetVyska + R.bezpecna + 2 : 0);
      const stred = a.hrbet.y + prostor / 2 + (+h.posun || 0);
      const u0 = -w / 2, v0 = cap / 2;           // střed versálek na ose hřbetu
      const tr = h.smer === 'zdola'
        ? (u, v) => [cx + (v - v0) * 1, stred - (u + u0)]
        : (u, v) => [cx - (v - v0), stred + (u + u0)];
      const cesty = [];
      obrysy(fh, textHrbetu, vel, h.prostrkani, tr, cesty);
      sc.vektory.push({ druh: 'cesta', prikazy: cesty, barva: h.barva, co: 'hrbet', obrys: +h.obrys || 0, barvaObrysu: h.barvaObrysu });
    }

    /* anotace */
    const an = n.anotace, fa = pismo(an.pismo);
    if (an.text.trim() && fa) {
      const vel = an.velikost * PT, rad = vel * (+an.radkovani || 1.4);
      const chybi = chybejici(fa, an.text); if (chybi.length) sc.chybi.anotace = chybi;
      const s = O.zmensi(a.zadni, Math.max(R.bezpecna, +an.okraj || 0));
      const mezera = sirkaTextu(fa, ' ', vel, 0);
      let y = a.zadni.y + a.zadni.h * an.y / 100 + nahoru(fa) * vel;
      const cesty = [];
      for (const r of O.zalom(an.text, s.w, sl => sirkaTextu(fa, sl, vel, 0))) {
        if (r.prazdny) { y += rad * 0.6; continue; }
        const ws = r.slova.map(sl => sirkaTextu(fa, sl, vel, 0));
        const soucet = ws.reduce((p, q) => p + q, 0);
        let m = mezera, x;
        const cela = soucet + mezera * (r.slova.length - 1);
        if (an.zarovnani === 'blok' && !r.posledni && r.slova.length > 1) { m = (s.w - soucet) / (r.slova.length - 1); x = s.x; }
        else x = an.zarovnani === 'stred' ? s.x + (s.w - cela) / 2 : an.zarovnani === 'vpravo' ? s.x + s.w - cela : s.x;
        const yy = y;
        r.slova.forEach((sl, i) => { const xx = x; obrysy(fa, sl, vel, 0, (u, v) => [xx + u, yy + v], cesty); x += ws[i] + m; });
        y += rad;
      }
      sc.info.anotaceKonec = y - rad + (-fa.descender / fa.unitsPerEm) * vel;
      sc.info.anotaceDno = s.y + s.h;
      sc.vektory.push({ druh: 'cesta', prikazy: cesty, barva: an.barva, co: 'anotace' });
    }

    /* čárový kód */
    const ri = O.rozborIsbn(n.isbn.text);
    sc.info.isbn = ri;
    const dopl = String(n.isbn.doplnek || '').replace(/\D/g, '');
    if (ri.platne) {
      const kod = O.carovyKod({ isbn13: ri.isbn13, doplnek: dopl.length === 5 ? dopl : '', zvetseni: (+n.isbn.zvetseni || 100) / 100,
        bwr: +n.isbn.bwr || 0, vyskaPruhu: (+n.isbn.vyskaPruhu || 100) / 100, textIsbn: n.isbn.popisek ? O.textIsbn(n.isbn.text, ri.isbn13) : '' });
      const s = O.zmensi(a.zadni, R.bezpecna);
      const x = n.isbn.pozice === 'vlevo' ? s.x : n.isbn.pozice === 'stred' ? a.zadni.x + (a.zadni.w - kod.sirka) / 2 : s.x + s.w - kod.sirka;
      const y = s.y + s.h - kod.vyska;
      sc.kod = { x, y, w: kod.sirka, h: kod.vyska };
      sc.vektory.push({ druh: 'obdelnik', x, y, w: kod.sirka, h: kod.vyska, barva: '#ffffff' });
      const pr = [];
      for (const b of kod.pruhy) pr.push({ type: 'M', x: x + b.x, y: y + b.y }, { type: 'L', x: x + b.x + b.w, y: y + b.y },
        { type: 'L', x: x + b.x + b.w, y: y + b.y + b.h }, { type: 'L', x: x + b.x, y: y + b.y + b.h }, { type: 'Z' });
      const fk = pismo('lsans');
      if (fk) {
        for (const t of kod.texty) {
          const vel = t.velikost / vyskaVersalek(fk);
          if (t.zarovnani === 'roztec') {
            [...t.text].forEach((z, i) => {
              const w = sirkaTextu(fk, z, vel, 0), cx = x + t.x + i * t.krok + 3.5 * kod.modul - w / 2;
              obrysy(fk, z, vel, 0, (u, v) => [cx + u, y + t.y + v], pr);
            });
          } else {
            const w = sirkaTextu(fk, t.text, vel, 0);
            let vv = vel;
            if (t.sirka && w > t.sirka) vv = vel * t.sirka / w;          // dlouhé ISBN s pomlčkami zúžit
            const ww = sirkaTextu(fk, t.text, vv, 0);
            const x0 = x + (t.zarovnani === 'vpravo' ? t.x - ww : t.x);
            obrysy(fk, t.text, vv, 0, (u, v) => [x0 + u, y + t.y + v], pr);
          }
        }
      }
      sc.vektory.push({ druh: 'cesta', prikazy: pr, barva: '#000000', co: 'kod' });
    }

    /* vodítka */
    const V = sc.voditka;
    V.push({ typ: 'orez', druh: 'obdelnik', ...a.orez });
    if (a.vazba === 'pevna') {
      V.push({ typ: 'orez', druh: 'obdelnik', ...a.zadni }, { typ: 'orez', druh: 'obdelnik', ...a.predni }, { typ: 'orez', druh: 'obdelnik', ...a.hrbet });
      for (const x of a.drazky) V.push({ typ: 'drazky', druh: 'cara', x1: x, y1: a.orez.y, x2: x, y2: a.orez.y + a.orez.h });
    } else {
      for (const x of a.drazky) V.push({ typ: 'hrbet', druh: 'cara', x1: x, y1: 0, x2: x, y2: a.vyska });
    }
    for (const p of [a.zadni, a.predni]) V.push({ typ: 'bezpecna', druh: 'obdelnik', ...O.zmensi(p, R.bezpecna) });
    if (a.hrbet.w > 2 * okrH) V.push({ typ: 'bezpecna', druh: 'obdelnik', x: a.hrbet.x + okrH, y: a.hrbet.y + R.bezpecna, w: a.hrbet.w - 2 * okrH, h: a.hrbet.h - 2 * R.bezpecna });
    if (k.tiskarna === 'kdp' && tisk.kod && !ri.platne) {
      const kk = tisk.kod;
      V.push({ typ: 'kdp', druh: 'obdelnik', x: a.hrbet.x - kk.odHrbetu - kk.sirka, y: a.orez.y + a.orez.h - kk.odSpodu - kk.vyska, w: kk.sirka, h: kk.vyska, popis: 'Místo pro čárový kód KDP' });
    }
    return sc;
  }

  /* ---------- plátno ---------- */
  function cestaNaPlatno(ctx, prikazy) {
    ctx.beginPath();
    for (const c of prikazy) {
      if (c.type === 'M') ctx.moveTo(c.x, c.y);
      else if (c.type === 'L') ctx.lineTo(c.x, c.y);
      else if (c.type === 'Q') ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y);
      else if (c.type === 'C') ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
      else ctx.closePath();
    }
  }
  function smerPrechodu(r, uhel) {
    const u = uhel * Math.PI / 180, dx = Math.sin(u), dy = -Math.cos(u);
    const L = Math.abs(r.w / 2 * dx) + Math.abs(r.h / 2 * dy), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    return [cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L];
  }
  /* ctx je už přeškálovaný na mm */
  function kresliRaster(ctx, sc) {
    for (const r of sc.raster) {
      if (r.druh === 'barva') { ctx.fillStyle = r.barva; ctx.fillRect(r.x, r.y, r.w, r.h); }
      else if (r.druh === 'prechod') {
        const g = ctx.createLinearGradient(...smerPrechodu(r, r.uhel));
        g.addColorStop(0, r.barva1); g.addColorStop(1, r.barva2);
        ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
      } else if (r.druh === 'obr') {
        ctx.save(); ctx.beginPath(); ctx.rect(r.box.x, r.box.y, r.box.w, r.box.h); ctx.clip();
        ctx.globalAlpha = r.kryti; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(r.img, r.kam.x, r.kam.y, r.kam.w, r.kam.h); ctx.restore();
      } else if (r.druh === 'logo') { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(r.img, r.x, r.y, r.w, r.h); }
    }
  }
  function kresliVektory(ctx, sc) {
    for (const v of sc.vektory) {
      ctx.fillStyle = v.barva;
      if (v.druh === 'obdelnik') { ctx.fillRect(v.x, v.y, v.w, v.h); continue; }
      cestaNaPlatno(ctx, v.prikazy);
      if (v.obrys > 0) {        // obrys (vnější polovina tahu) – pod výplní, aby písmena nehubla
        ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 2 * v.obrys; ctx.strokeStyle = v.barvaObrysu || '#000'; ctx.stroke(); ctx.restore();
      }
      ctx.fill('nonzero');
    }
  }
  const BARVY_VOD = { orez: '#e6007e', hrbet: '#00a0e0', drazky: '#ff8a00', bezpecna: '#00b050', kdp: '#f2c200' };
  /* zap = {orez, hrbet, drazky, bezpecna, kdp}, tl = tloušťka čáry v mm */
  function kresliVoditka(ctx, sc, zap, tl) {
    ctx.save(); ctx.lineWidth = tl;
    for (const v of sc.voditka) {
      if (!zap[v.typ]) continue;
      ctx.strokeStyle = BARVY_VOD[v.typ];
      ctx.setLineDash(v.typ === 'bezpecna' || v.typ === 'kdp' ? [tl * 6, tl * 4] : []);
      ctx.beginPath();
      if (v.druh === 'cara') { ctx.moveTo(v.x1, v.y1); ctx.lineTo(v.x2, v.y2); } else ctx.rect(v.x, v.y, v.w, v.h);
      ctx.stroke();
      if (v.typ === 'kdp') { ctx.fillStyle = 'rgba(242,194,0,.25)'; ctx.fillRect(v.x, v.y, v.w, v.h); }
    }
    ctx.restore();
  }
  /* jen náhled: ztlumená spadávka/obtah */
  function kresliSpad(ctx, sc) {
    const a = sc.a, o = a.orez;
    ctx.save(); ctx.fillStyle = 'rgba(128,128,128,.45)';
    ctx.beginPath(); ctx.rect(0, 0, a.sirka, a.vyska); ctx.rect(o.x, o.y, o.w, o.h); ctx.fill('evenodd');
    ctx.restore();
  }

  /* plátno celého archu v daném DPI (PNG, raster do PDF) */
  /* jen přední strana (ořez), výška v px – obálka e-knihy, obrázek do e-shopu */
  function platnoPredni(sc, vyskaPx) {
    const p = sc.a.predni, k = vyskaPx / p.h;
    const c = document.createElement('canvas');
    c.width = Math.round(p.w * k); c.height = Math.round(vyskaPx);
    const ctx = c.getContext('2d');
    ctx.setTransform(k, 0, 0, k, -p.x * k, -p.y * k);
    kresliRaster(ctx, sc); kresliVektory(ctx, sc);
    return c;
  }
  function platno(sc, dpi, co) {
    const k = dpi / 25.4;
    const c = document.createElement('canvas');
    c.width = Math.round(sc.a.sirka * k); c.height = Math.round(sc.a.vyska * k);
    const ctx = c.getContext('2d');
    ctx.setTransform(c.width / sc.a.sirka, 0, 0, c.height / sc.a.vyska, 0, 0);
    kresliRaster(ctx, sc);
    if (co.vektory) kresliVektory(ctx, sc);
    if (co.voditka) kresliVoditka(ctx, sc, co.voditka, 0.2);
    return c;
  }

  /* ---------- PDF ----------
     volby = {voditka: {...}|null, znacky: bool, dpi: 300, nazev, autor} */
  function pdf(jsPDF, sc, volby) {
    const a = sc.a, m = volby.znacky ? 12 : 0;
    const W = a.sirka + 2 * m, H = a.vyska + 2 * m;
    const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: W > H ? 'landscape' : 'portrait', compress: true });
    doc.setDocumentProperties({ title: volby.nazev || 'Obálka knihy', author: volby.autor || '', creator: 'Obálka knihy k tisku' });
    const jenBarva = sc.raster.length === 1 && sc.raster[0].druh === 'barva';
    if (jenBarva) { doc.setFillColor(sc.raster[0].barva); doc.rect(m, m, a.sirka, a.vyska, 'F'); }
    else {
      const c = platno(sc, O.bezpecneDpi(a.sirka, a.vyska, volby.dpi || 300), {});
      doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, a.sirka, a.vyska, undefined, 'NONE');
      c.width = c.height = 0;
    }
    const cesta = prikazy => {
      let px = 0, py = 0, otevreno = false;
      for (const c of prikazy) {
        if (c.type === 'M') { doc.moveTo(m + c.x, m + c.y); otevreno = true; }
        else if (c.type === 'L') doc.lineTo(m + c.x, m + c.y);
        else if (c.type === 'Q') {      // kvadratická → kubická
          doc.curveTo(m + px + 2 / 3 * (c.x1 - px), m + py + 2 / 3 * (c.y1 - py), m + c.x + 2 / 3 * (c.x1 - c.x), m + c.y + 2 / 3 * (c.y1 - c.y), m + c.x, m + c.y);
        } else if (c.type === 'C') doc.curveTo(m + c.x1, m + c.y1, m + c.x2, m + c.y2, m + c.x, m + c.y);
        else { doc.close(); }
        if (c.type !== 'Z') { px = c.x; py = c.y; }
      }
      return otevreno;
    };
    for (const v of sc.vektory) {
      doc.setFillColor(v.barva);
      if (v.druh === 'obdelnik') { doc.rect(m + v.x, m + v.y, v.w, v.h, 'F'); continue; }
      if (!v.prikazy.length) continue;
      if (v.obrys > 0) {
        doc.setDrawColor(v.barvaObrysu || '#000000'); doc.setLineWidth(2 * v.obrys); doc.setLineJoin('round');
        if (cesta(v.prikazy)) doc.stroke();
        doc.setLineJoin('miter');
      }
      if (cesta(v.prikazy)) doc.fill();
    }
    if (volby.voditka) {
      doc.setLineWidth(0.2);
      for (const v of sc.voditka) {
        if (!volby.voditka[v.typ]) continue;
        doc.setDrawColor(BARVY_VOD[v.typ]);
        doc.setLineDashPattern(v.typ === 'bezpecna' || v.typ === 'kdp' ? [1.2, 0.8] : [], 0);
        if (v.druh === 'cara') doc.line(m + v.x1, m + v.y1, m + v.x2, m + v.y2);
        else doc.rect(m + v.x, m + v.y, v.w, v.h, 'S');
      }
      doc.setLineDashPattern([], 0);
    }
    if (m) {   // ořezové značky a značky přehybů mimo spadávku
      doc.setDrawColor('#000000'); doc.setLineWidth(0.1);
      const o = a.orez, od = a.spad + 1;   // značka začíná 1 mm za hranou spadávky a končí 1 mm před krajem stránky
      const svisle = x => { doc.line(m + x, m + o.y - od, m + x, 1); doc.line(m + x, m + o.y + o.h + od, m + x, H - 1); };
      const vodorovne = y => { doc.line(m + o.x - od, m + y, 1, m + y); doc.line(m + o.x + o.w + od, m + y, W - 1, m + y); };
      [o.x, o.x + o.w].forEach(svisle); [o.y, o.y + o.h].forEach(vodorovne);
      doc.setLineDashPattern([1, 0.6], 0);
      a.drazky.forEach(svisle);
      doc.setLineDashPattern([], 0);
    }
    return doc;
  }

  window.OBALKA_KRESBA = { platnoPredni, sestav, kresliRaster, kresliVektory, kresliVoditka, kresliSpad, platno, pdf, umisteniObr, boxPredni, sirkaTextu, chybejici, BARVY_VOD, PT };
})();
