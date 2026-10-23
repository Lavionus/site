/* ============================================================
   Písmolijna – jadro/obtah.js
   Obtahování bitmapy (práh → hranice pixelů → střední cesta,
   rohy, vyhlazení → proložení křivkami), tisková šablona pro ruční
   písmo a rozřezání naskenované šablony na buňky (registrační
   značky + homografie). Bez DOM – data jsou pole pixelů
   (RGBA z canvasu nebo šedotón). Potřebuje model.js, krivky.js
   a operace.js (P.prolozMnohouhelnik).
   ============================================================ */
(function (G) {
  'use strict';
  const P = G.PSL || (G.PSL = {});
  const bod = (x, y) => ({ x, y });

  /* ---------- šedotón a práh ---------- */
  /* RGBA (průhlednost na bílém podkladu) nebo šedotón → Uint8Array jasů. */
  function sedotonovy(data, w, h) {
    const n = w * h;
    if (data.length === n) return data instanceof Uint8Array ? data : Uint8Array.from(data);
    if (data.length !== n * 4) throw new Error(`Data obrázku mají ${data.length} hodnot, čekáno ${n} (šedotón) nebo ${n * 4} (RGBA).`);
    const g = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const a = data[j + 3] / 255;
      const l = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
      g[i] = Math.round(255 - a * (255 - l));
    }
    return g;
  }
  P.sedotonovy = sedotonovy;

  /* Otsuova metoda: práh maximalizující rozptyl mezi třídami. */
  function otsu(g) {
    const hist = new Float64Array(256);
    for (let i = 0; i < g.length; i++) hist[g[i]]++;
    const n = g.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sB = 0, wB = 0, best = 0, prah = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = n - wB;
      if (!wF) break;
      sB += t * hist[t];
      const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) { best = v; prah = t + 1; }
    }
    return prah;
  }
  P.otsu = otsu;

  /* Spojité komponenty (8-okolí pro inkoust nebo 4-okolí). Vrací {stitky, plochy[]}. */
  function komponenty(bin, w, h, hodnota, osm) {
    const st = new Int32Array(w * h).fill(-1), plochy = [], zasobnik = new Int32Array(w * h);
    let id = 0;
    for (let s = 0; s < w * h; s++) {
      if (bin[s] !== hodnota || st[s] >= 0) continue;
      let vrch = 0, plocha = 0;
      zasobnik[vrch++] = s; st[s] = id;
      while (vrch) {
        const p = zasobnik[--vrch], x = p % w, y = (p - x) / w;
        plocha++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || (!osm && dx && dy)) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (bin[q] === hodnota && st[q] < 0) { st[q] = id; zasobnik[vrch++] = q; }
        }
      }
      plochy.push(plocha); id++;
    }
    return { stitky: st, plochy };
  }

  /* ---------- trasování hranic ----------
     Hrany mezi inkoustem a pozadím jako orientované úsečky (inkoust vpravo, osa y dolů).
     Ve vrcholu se dvěma výstupy (šachovnice) se zahýbá doprava = inkoust se spojuje i úhlopříčně. */
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  function trasuj(bin, w, h) {
    const W = w + 1, nv = W * (h + 1);
    const out1 = new Int32Array(nv).fill(-1), out2 = new Int32Array(nv).fill(-1);
    const eV = [], eD = [];
    const pridej = (vx, vy, d) => {
      const v = vy * W + vx, id = eV.length;
      eV.push(v); eD.push(d);
      if (out1[v] < 0) out1[v] = id; else out2[v] = id;
    };
    const ink = (x, y) => x >= 0 && y >= 0 && x < w && y < h && bin[y * w + x] === 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (bin[y * w + x] !== 1) continue;
      if (!ink(x, y - 1)) pridej(x, y, 0);
      if (!ink(x + 1, y)) pridej(x + 1, y, 1);
      if (!ink(x, y + 1)) pridej(x + 1, y + 1, 2);
      if (!ink(x - 1, y)) pridej(x, y + 1, 3);
    }
    const pouzita = new Uint8Array(eV.length), smycky = [];
    for (let e0 = 0; e0 < eV.length; e0++) {
      if (pouzita[e0]) continue;
      const pts = [];
      let e = e0;
      while (e >= 0 && !pouzita[e]) {
        pouzita[e] = 1;
        const v = eV[e], d = eD[e], vx = v % W, vy = (v - vx) / W;
        pts.push(bod(vx + DX[d] * 0.5, vy + DY[d] * 0.5));   // střed hrany pixelu
        const kon = (vy + DY[d]) * W + vx + DX[d];
        const a = out1[kon], b = out2[kon];
        let dalsi = -1;
        if (b < 0) dalsi = a;
        else {
          for (const pref of [(d + 1) % 4, d, (d + 3) % 4]) {
            if (!pouzita[a] && eD[a] === pref) { dalsi = a; break; }
            if (!pouzita[b] && eD[b] === pref) { dalsi = b; break; }
          }
        }
        e = dalsi;
      }
      if (pts.length >= 4) smycky.push(pts);
    }
    return smycky;
  }

  /* ---------- rohy, vyhlazení, Douglas–Peucker ---------- */
  function norm(a) { const l = Math.hypot(a.x, a.y); return l > 1e-12 ? bod(a.x / l, a.y / l) : bod(0, 0); }
  function prusecikPrimek(a1, a2, b1, b2) {
    const r = bod(a2.x - a1.x, a2.y - a1.y), s = bod(b2.x - b1.x, b2.y - b1.y);
    const den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((b1.x - a1.x) * s.y - (b1.y - a1.y) * s.x) / den;
    return bod(a1.x + t * r.x, a1.y + t * r.y);
  }
  /* Najde rohy na husté lomené čáře (úhel mezi směry přes k bodů), upřesní jejich polohu
     průsečíkem přímek sousedních úseků a vrátí {p, roh[]}. */
  function rohyAVyhlazeni(p, rohUhel, vyhlazeni) {
    const n = p.length;
    const k = Math.max(1, Math.min(3, Math.floor(n / 8)));
    const D = Math.min(5, Math.max(1.5, n / 40));   // úhel se měří na vzdálenost D px na obě strany (odolné proti šumu)
    const mez = Math.cos(rohUhel * Math.PI / 180);
    const at = i => p[((i % n) + n) % n];
    const dosah = (i, krok) => {
      let j = i;
      for (let s = 1; s < n / 3; s++) { j = i + krok * s; if (Math.hypot(at(j).x - p[i].x, at(j).y - p[i].y) >= D) break; }
      return j;
    };
    const cosU = new Float64Array(n), sirka = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const ip = dosah(i, -1), id = dosah(i, 1);
      const a = norm(bod(p[i].x - at(ip).x, p[i].y - at(ip).y)), b = norm(bod(at(id).x - p[i].x, at(id).y - p[i].y));
      cosU[i] = a.x * b.x + a.y * b.y;
      sirka[i] = Math.max(1, Math.min(i - ip, id - i));
    }
    const roh = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (cosU[i] >= mez) continue;
      let maximum = true;
      const w = sirka[i];
      for (let j = -w; j <= w && maximum; j++) {
        if (!j) continue;
        const q = ((i + j) % n + n) % n;
        if (cosU[q] < cosU[i] || (cosU[q] === cosU[i] && j < 0)) maximum = false;
      }
      if (maximum) roh[i] = 1;
    }
    // upřesnění polohy rohu: průsečík přímek z bodů před a za rohem (zkosení schodu zmizí)
    const q = [], qr = [], vynech = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (roh[i] && n > 4 * k + 4) {
      const A = at(i - k - 1), B = at(i - 2), C = at(i + 2), D = at(i + k + 1);
      const X = prusecikPrimek(A, B, C, D);
      if (X && Math.hypot(X.x - p[i].x, X.y - p[i].y) < 1.6) {
        p[i] = X;
        if (!roh[(i - 1 + n) % n]) vynech[(i - 1 + n) % n] = 1;
        if (!roh[(i + 1) % n]) vynech[(i + 1) % n] = 1;
      }
    }
    for (let i = 0; i < n; i++) if (!vynech[i] || roh[i]) { q.push(p[i]); qr.push(roh[i]); }
    // vyhlazení (1-2-1), rohy pevné
    let r = q;
    const m = r.length;
    for (let it = 0; it < vyhlazeni; it++) {
      const s = r.map((pt, i) => {
        if (qr[i]) return pt;
        const a = r[(i - 1 + m) % m], b = r[(i + 1) % m];
        return bod((a.x + 2 * pt.x + b.x) / 4, (a.y + 2 * pt.y + b.y) / 4);
      });
      r = s;
    }
    return { p: r, roh: qr };
  }
  /* Rovné úseky mezi rohy: přímka metodou nejmenších čtverců (kolmé vzdálenosti); když
     všechny body leží blíž než tol, úsek se nahradí úsečkou a rohy se posunou do průsečíků
     sousedních přímek (schody pixelů ani zkosené rohy pak nezůstanou). Vrací {p, roh}. */
  function narovnej(p, roh, tol) {
    const n = p.length, rohy = [];
    for (let i = 0; i < n; i++) if (roh[i]) rohy.push(i);
    if (rohy.length < 2) return { p, roh };
    const m = rohy.length, primky = [];
    for (let k = 0; k < m; k++) {
      const i = rohy[k], j = rohy[(k + 1) % m];
      const run = [];
      for (let q = i; ; q = (q + 1) % n) { run.push(p[q]); if (q === j) break; }
      const vnitrni = run.length >= 7 ? run.slice(2, -2) : run;
      let cx = 0, cy = 0;
      for (const q of vnitrni) { cx += q.x; cy += q.y; }
      cx /= vnitrni.length; cy /= vnitrni.length;
      let sxx = 0, syy = 0, sxy = 0;
      for (const q of vnitrni) { sxx += (q.x - cx) ** 2; syy += (q.y - cy) ** 2; sxy += (q.x - cx) * (q.y - cy); }
      const uhel = 0.5 * Math.atan2(2 * sxy, sxx - syy), dx = Math.cos(uhel), dy = Math.sin(uhel);
      let max = 0;
      for (const q of run.slice(1, -1)) max = Math.max(max, Math.abs(-(q.x - cx) * dy + (q.y - cy) * dx));
      const delka = Math.hypot(run[run.length - 1].x - run[0].x, run[run.length - 1].y - run[0].y);
      primky.push(max <= tol && delka >= 2 ? { a: bod(cx, cy), b: bod(cx + dx, cy + dy) } : null);
    }
    const nove = rohy.map(i => p[i]);
    for (let k = 0; k < m; k++) {
      const A = primky[(k - 1 + m) % m], B = primky[k], c = p[rohy[k]];
      let X = null;
      if (A && B) X = prusecikPrimek(A.a, A.b, B.a, B.b);
      if (!X || Math.hypot(X.x - c.x, X.y - c.y) > 3) {
        const L = A || B;
        if (L) {
          const d = norm(bod(L.b.x - L.a.x, L.b.y - L.a.y)), t = (c.x - L.a.x) * d.x + (c.y - L.a.y) * d.y;
          X = bod(L.a.x + d.x * t, L.a.y + d.y * t);
        }
      }
      if (X && Math.hypot(X.x - c.x, X.y - c.y) <= 3) nove[k] = X;
    }
    const out = [], outRoh = [];
    for (let k = 0; k < m; k++) {
      const i = rohy[k], j = rohy[(k + 1) % m];
      out.push(nove[k]); outRoh.push(true);
      if (primky[k]) continue;
      for (let q = (i + 1) % n; q !== j; q = (q + 1) % n) { out.push(p[q]); outRoh.push(false); }
    }
    return { p: out, roh: outRoh };
  }

  /* Douglas–Peucker na uzavřené lomené čáře s pevnými body (rohy). */
  function zjednodusLomenou(p, pevne, tol) {
    const n = p.length;
    const nech = new Uint8Array(n);
    let kotvy = [];
    for (let i = 0; i < n; i++) if (pevne[i]) kotvy.push(i);
    if (kotvy.length < 2) {
      // bez rohů: vezmi dva nejvzdálenější body (přibližně)
      let a = 0, b = 0, best = -1;
      for (let i = 0; i < n; i++) { const d = Math.hypot(p[i].x - p[0].x, p[i].y - p[0].y); if (d > best) { best = d; b = i; } }
      best = -1;
      for (let i = 0; i < n; i++) { const d = Math.hypot(p[i].x - p[b].x, p[i].y - p[b].y); if (d > best) { best = d; a = i; } }
      kotvy = Array.from(new Set([a, b, ...kotvy])).sort((x, y) => x - y);
    }
    for (const i of kotvy) nech[i] = 1;
    const usek = (i, j) => {   // i < j v cyklickém smyslu (j může být > n)
      if (j - i < 2) return;
      const A = p[i % n], B = p[j % n];
      let max = -1, mi = -1;
      for (let q = i + 1; q < j; q++) {
        const d = P.vzdalOdPrimky(p[q % n], A, B);
        if (d > max) { max = d; mi = q; }
      }
      if (max > tol) { nech[mi % n] = 1; usek(i, mi); usek(mi, j); }
    };
    for (let k = 0; k < kotvy.length; k++) {
      const i = kotvy[k], j = k + 1 < kotvy.length ? kotvy[k + 1] : kotvy[0] + n;
      usek(i, j);
    }
    const out = [], roh = [];
    for (let i = 0; i < n; i++) if (nech[i]) { out.push(p[i]); roh.push(!!pevne[i]); }
    return { p: out, roh };
  }

  /* Obtáhne bitmapu. data = RGBA nebo šedotón (řádky shora dolů), sirka × vyska px.
     volby: prah (0–255, výchozí Otsu), invertovat, minPlocha (8 px²), chyba (1 px), roh (60°),
     vyhlazeni (2), matice (px → jednotky em, výchozí identita), zaokrouhlit.
     Vrací obrysy (vnější po směru hodinových ručiček v cílových souřadnicích). */
  P.obtahniBitmapu = function (data, sirka, vyska, volby) {
    const v = volby || {}, w = sirka, h = vyska;
    const g = sedotonovy(data, w, h);
    const prah = v.prah != null ? v.prah : otsu(g);
    const bin = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) bin[i] = (g[i] < prah) !== !!v.invertovat ? 1 : 0;
    const minPlocha = v.minPlocha != null ? v.minPlocha : 8;
    if (minPlocha > 0) {
      const ink = komponenty(bin, w, h, 1, true);
      for (let i = 0; i < w * h; i++) if (bin[i] && ink.plochy[ink.stitky[i]] < minPlocha) bin[i] = 0;
      // malé dírky (pozadí nedotýkající se okraje) zaplnit
      const poz = komponenty(bin, w, h, 0, false), okraj = new Set();
      for (let x = 0; x < w; x++) { okraj.add(poz.stitky[x]); okraj.add(poz.stitky[(h - 1) * w + x]); }
      for (let y = 0; y < h; y++) { okraj.add(poz.stitky[y * w]); okraj.add(poz.stitky[y * w + w - 1]); }
      for (let i = 0; i < w * h; i++) if (!bin[i] && !okraj.has(poz.stitky[i]) && poz.plochy[poz.stitky[i]] < minPlocha) bin[i] = 1;
    }
    const chyba = v.chyba || 1, rohUhel = v.roh != null ? v.roh : 60;
    const M = v.matice || [1, 0, 0, 1, 0, 0];
    const obrysy = [];
    for (const smycka of trasuj(bin, w, h)) {
      if (Math.abs(P.plochaMnohouhelniku(smycka)) < Math.max(1, minPlocha) * 0.5) continue;
      const r = rohyAVyhlazeni(smycka, rohUhel, v.vyhlazeni != null ? v.vyhlazeni : 2);
      const rr = narovnej(r.p, r.roh, Math.max(0.35, chyba));
      // husté body nechat (extrémy pak sedí přesně); D–P jen u velmi dlouhých smyček kvůli rychlosti
      const z = rr.p.length > 4000 ? zjednodusLomenou(rr.p, rr.roh, 0.1) : rr;
      const rohy = [];
      z.roh.forEach((x, i) => { if (x) rohy.push(i); });
      const o = P.prolozMnohouhelnik(z.p, { chyba, roh: null, rohy, dlouha: Math.max(6 * chyba, 4) });
      if (!o) continue;
      for (const b of o.body) { const t = P.transformujBod(M, b.x, b.y); b.x = t.x; b.y = t.y; }
      P.slucKratkeSegmenty(o, 1);   // body blíž než 1 jednotka (v cílových souřadnicích) sloučit
      if (v.zaokrouhlit) P.zaokrouhli(o, 1);
      obrysy.push(o);
    }
    P.opravSmer(obrysy);
    return obrysy;
  };

  /* ============================================================
     Šablona pro ruční písmo
     ============================================================ */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const f2 = x => Math.round(x * 100) / 100;

  /* Tisková šablona A4 (mm). znaky = řetězec nebo pole znaků. volby: sloupce (6), info (metriky
     fontu, výchozí P.vychoziInfo()), titulek. Vrací {svg, rozlozeni, stranky:[{svg, rozlozeni}]}.
     rozlozeni = {sirka:210, vyska:297, znacky:[{x,y,velikost}] (středy v pořadí LH, PH, LD, PD),
     bunky:[{znak, uni, nazev, x, y, w, h, vnitrek:{x,y,w,h}, ucari, xVyska, verzalky, mmNaJednotku}]}. */
  P.sablonaRucnihoPisma = function (znaky, volby) {
    const v = volby || {};
    const info = Object.assign(P.vychoziInfo(), v.info || {});
    const seznam = Array.isArray(znaky) ? znaky.slice() : Array.from(znaky || '');
    const A4 = { w: 210, h: 297 }, zn = 7, zOdst = 10;
    const znacky = [[zOdst, zOdst], [A4.w - zOdst, zOdst], [zOdst, A4.h - zOdst], [A4.w - zOdst, A4.h - zOdst]].map(([x, y]) => ({ x, y, velikost: zn }));
    const sloupce = Math.max(2, v.sloupce || 6);
    const x0 = 20, x1 = A4.w - 20, y0 = 24, y1 = A4.h - 20;
    const bw = (x1 - x0) / sloupce, bh = bw * 1.3;
    const radky = Math.max(1, Math.floor((y1 - y0) / bh));
    const naStranu = radky * sloupce;
    const rozsah = info.ascender - info.descender;
    const stranky = [];
    for (let s = 0; s * naStranu < Math.max(1, seznam.length); s++) {
      const cast = seznam.slice(s * naStranu, (s + 1) * naStranu);
      const bunky = [];
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">\n`;
      svg += `<rect x="0" y="0" width="210" height="297" fill="#fff"/>\n`;
      for (const z of znacky) svg += `<rect x="${z.x - zn / 2}" y="${z.y - zn / 2}" width="${zn}" height="${zn}" fill="#000"/>\n`;
      svg += `<text x="105" y="12" font-family="sans-serif" font-size="4" fill="#9a9a9a" text-anchor="middle">${esc(v.titulek || 'Písmolijna – šablona ručního písma')} · strana ${s + 1}</text>\n`;
      cast.forEach((znak, i) => {
        const r = Math.floor(i / sloupce), c = i % sloupce;
        const x = x0 + c * bw, y = y0 + r * bh;
        const popisek = bh * 0.14;
        const vn = { x: x + bw * 0.04, y: y + popisek, w: bw * 0.92, h: bh - popisek - bh * 0.03 };
        const mmJ = vn.h / rozsah;
        const ucari = vn.y + info.ascender * mmJ;
        const b = {
          znak, uni: znak.codePointAt(0), nazev: P.nazevProUnicode(znak.codePointAt(0)),
          x, y, w: bw, h: bh, vnitrek: vn, ucari, xVyska: ucari - info.xVyska * mmJ,
          verzalky: ucari - info.vyskaVerzalek * mmJ, dotahDolu: ucari - info.descender * mmJ, mmNaJednotku: mmJ, stranka: s
        };
        bunky.push(b);
        svg += `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(bw)}" height="${f2(bh)}" fill="none" stroke="#c8c8c8" stroke-width="0.25"/>\n`;
        svg += `<line x1="${f2(x)}" y1="${f2(ucari)}" x2="${f2(x + bw)}" y2="${f2(ucari)}" stroke="#b9b9b9" stroke-width="0.3"/>\n`;
        svg += `<line x1="${f2(x)}" y1="${f2(b.xVyska)}" x2="${f2(x + bw)}" y2="${f2(b.xVyska)}" stroke="#cdcdcd" stroke-width="0.25" stroke-dasharray="1.5 1"/>\n`;
        svg += `<line x1="${f2(x)}" y1="${f2(b.verzalky)}" x2="${f2(x + bw)}" y2="${f2(b.verzalky)}" stroke="#d6d6d6" stroke-width="0.2"/>\n`;
        svg += `<text x="${f2(x + 1.2)}" y="${f2(y + popisek * 0.8)}" font-family="sans-serif" font-size="${f2(popisek * 0.7)}" fill="#a8a8a8">${esc(znak)}</text>\n`;
      });
      svg += '</svg>\n';
      stranky.push({ svg, rozlozeni: { sirka: A4.w, vyska: A4.h, znacky, bunky, stranka: s, info: { upm: info.upm, ascender: info.ascender, descender: info.descender, xVyska: info.xVyska, vyskaVerzalek: info.vyskaVerzalek } } });
    }
    return { svg: stranky[0].svg, rozlozeni: stranky[0].rozlozeni, stranky };
  };

  /* ---------- homografie ---------- */
  function resSoustavu(A, b) {   // Gaussova eliminace s výběrem pivota
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let mx = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r;
      [A[i], A[mx]] = [A[mx], A[i]]; [b[i], b[mx]] = [b[mx], b[i]];
      if (Math.abs(A[i][i]) < 1e-12) return null;
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
      x[i] = s / A[i][i];
    }
    return x;
  }
  /* Homografie ze 4 dvojic bodů (z → do). Vrací funkci (x, y) → {x, y} a koeficienty. */
  P.homografie = function (z, d) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const { x, y } = z[i], X = d[i].x, Y = d[i].y;
      A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
      A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
    }
    const h = resSoustavu(A, b);
    if (!h) return null;
    const f = (x, y) => { const w = h[6] * x + h[7] * y + 1; return bod((h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w); };
    f.koef = h;
    return f;
  };

  /* Najde 4 registrační značky: plné čtvercové tmavé komponenty, v každém rohu ta nejbližší
     k rohu obrázku (ručně psané tvary bývají dál od okraje a nejsou plné čtverce).
     ocekavanaPlocha (px², volitelně) vyřadí komponenty, které jsou mnohem menší/větší.
     Vrací středy v px v pořadí LH, PH, LD, PD, nebo null. */
  function najdiZnacky(g, w, h, prah, ocekavanaPlocha) {
    const bin = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) bin[i] = g[i] < prah ? 1 : 0;
    const k = komponenty(bin, w, h, 1, true);
    const N = k.plochy.length;
    const sx = new Float64Array(N), sy = new Float64Array(N), x0 = new Int32Array(N).fill(w), y0 = new Int32Array(N).fill(h), x1 = new Int32Array(N).fill(-1), y1 = new Int32Array(N).fill(-1);
    for (let i = 0; i < w * h; i++) {
      const s = k.stitky[i];
      if (s < 0) continue;
      const x = i % w, y = (i - x) / w;
      sx[s] += x + 0.5; sy[s] += y + 0.5;
      if (x < x0[s]) x0[s] = x; if (x > x1[s]) x1[s] = x; if (y < y0[s]) y0[s] = y; if (y > y1[s]) y1[s] = y;
    }
    const kand = [];
    for (let s = 0; s < N; s++) {
      const bw = x1[s] - x0[s] + 1, bh = y1[s] - y0[s] + 1, a = k.plochy[s];
      if (a < 16) continue;
      if (ocekavanaPlocha && (a < ocekavanaPlocha * 0.25 || a > ocekavanaPlocha * 4)) continue;
      const pomer = bw / bh, vypln = a / (bw * bh);
      if (pomer < 0.75 || pomer > 1.33 || vypln < 0.82) continue;
      kand.push({ x: sx[s] / a, y: sy[s] / a, a });
    }
    if (!kand.length) return null;
    const maxA = Math.max.apply(null, kand.map(c => c.a));
    const out = [];
    for (const [rx, ry] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      let best = null, bd = Infinity;
      for (const c of kand) {
        if ((c.x < w / 2) !== (rx === 0) || (c.y < h / 2) !== (ry === 0) || c.a < maxA * 0.2) continue;
        const d = Math.hypot(c.x - rx, c.y - ry);
        if (d < bd) { bd = d; best = c; }
      }
      if (!best) return null;
      out.push(bod(best.x, best.y));
    }
    return out;
  }
  P.najdiZnacky = najdiZnacky;

  /* Rozřeže sken šablony na buňky. data = RGBA / šedotón skenu, rozlozeni z P.sablonaRucnihoPisma.
     volby: prah (výchozí podle značek a papíru), pxNaMm (rozlišení výřezů, výchozí podle skenu),
     okraj (mm oříznutí uvnitř buňky, 0,6).
     Vrací [{znak, nazev, uni, data (šedotón), sirka, vyska, ucari, xVyska, verzalky (řádky v px výřezu),
     pxNaMm, matice (px výřezu → jednotky em, počátek x = levý okraj vnitřku buňky), prah, prazdna}]. */
  P.rozrezSken = function (data, sirka, vyska, rozlozeni, volby) {
    const v = volby || {};
    const g = sedotonovy(data, sirka, vyska);
    const hrubyPrah = otsu(g);
    // očekávaná velikost značky, když sken zhruba pokrývá stránku
    const odhadPxMm = Math.min(sirka / rozlozeni.sirka, vyska / rozlozeni.vyska);
    const zv = rozlozeni.znacky[0].velikost * odhadPxMm;
    const zn = najdiZnacky(g, sirka, vyska, v.prah != null ? v.prah : Math.min(hrubyPrah, 100), v.ocekavanaZnacka === false ? 0 : zv * zv);
    if (!zn) throw new Error('Na skenu se nepodařilo najít čtyři registrační značky v rozích.');
    const H = P.homografie(rozlozeni.znacky.map(z => bod(z.x, z.y)), zn);
    if (!H) throw new Error('Registrační značky jsou v nemožné poloze (homografie nejde spočítat).');
    // rozlišení skenu (px/mm) a práh mezi papírem a černou značek
    const dmm = Math.hypot(rozlozeni.znacky[1].x - rozlozeni.znacky[0].x, rozlozeni.znacky[1].y - rozlozeni.znacky[0].y);
    const pxMm = Math.hypot(zn[1].x - zn[0].x, zn[1].y - zn[0].y) / dmm;
    let cerna = 0, nc = 0;
    for (const z of zn) { const i = Math.round(z.y) * sirka + Math.round(z.x); if (g[i] != null) { cerna += g[i]; nc++; } }
    cerna /= nc || 1;
    const hist = new Uint32Array(256);
    for (let i = 0; i < g.length; i += 7) hist[g[i]]++;
    let papir = 255, mx = 0;
    for (let i = 128; i < 256; i++) if (hist[i] > mx) { mx = hist[i]; papir = i; }
    const prah = v.prah != null ? v.prah : Math.round(cerna + (papir - cerna) * 0.5);
    const r = v.pxNaMm || Math.max(2, Math.round(pxMm * 10) / 10);
    const okraj = v.okraj != null ? v.okraj : 0.6;
    const vzorek = (x, y) => {
      if (x < 0 || y < 0 || x > sirka - 1 || y > vyska - 1) return 255;
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const x2 = Math.min(sirka - 1, xi + 1), y2 = Math.min(vyska - 1, yi + 1);
      const a = g[yi * sirka + xi], b = g[yi * sirka + x2], c = g[y2 * sirka + xi], d = g[y2 * sirka + x2];
      return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
    };
    const out = [];
    for (const b of rozlozeni.bunky) {
      const vn = { x: b.vnitrek.x + okraj, y: b.vnitrek.y + okraj, w: b.vnitrek.w - 2 * okraj, h: b.vnitrek.h - 2 * okraj };
      const W = Math.max(1, Math.round(vn.w * r)), Hh = Math.max(1, Math.round(vn.h * r));
      const d = new Uint8Array(W * Hh);
      let inkoust = 0;
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const p = H(vn.x + (x + 0.5) / r, vn.y + (y + 0.5) / r);
        const val = Math.round(vzorek(p.x - 0.5, p.y - 0.5));
        d[y * W + x] = val;
        if (val < prah) inkoust++;
      }
      const ucari = (b.ucari - vn.y) * r, s = 1 / (b.mmNaJednotku * r);
      out.push({
        znak: b.znak, nazev: b.nazev, uni: b.uni, data: d, sirka: W, vyska: Hh,
        ucari, xVyska: (b.xVyska - vn.y) * r, verzalky: (b.verzalky - vn.y) * r, pxNaMm: r,
        matice: [s, 0, 0, -s, okraj / b.mmNaJednotku, ucari * s],
        prah, prazdna: inkoust < Math.max(6, W * Hh * 0.0008)
      });
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
