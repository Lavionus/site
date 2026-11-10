/* Věšáky – výkresy jako SVG řetězce (bez DOM, běží i v node): náhled profilu do galerie, technický výkres
   (profil zboku, pohled zepředu, průřez úchytu 2:1, kóty), vrtací šablona 1:1 a technický list k tisku.
   Jednotky SVG = mm (výkres i šablona se tisknou ve skutečném měřítku). */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.VESAKY;
  const fmt = K.fmt, n = v => (Math.round(v * 100) / 100).toString();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** Mnohoúhelníky ramene pro kreslení (z, y): trasa = obrys páteře + kruh konce, blok / kolík = jejich tvar. */
  function polygonyRamene(r, a, telo) {
    if (r.druh && r.druh !== 'trasa') return K.polygonyRamene(r, telo);
    const ob = obrysRamene(r, a), [cx, cy, rr] = ob.tip, kruh = [];
    for (let i = 0; i < 32; i++) { const f = 2 * Math.PI * i / 32; kruh.push([cx + rr * Math.cos(f), cy + rr * Math.sin(f)]); }
    return [ob.obrys, kruh];
  }
  /** Obrys ramene v rovině (z, y): levá a pravá strana páteře + kruh konce. */
  function obrysRamene(r, a) {
    const b = a.body, L = [], P = [];
    for (const s of b) { const nx = -Math.sin(s.h), ny = Math.cos(s.h); L.push([s.z + nx * s.t / 2, s.y + ny * s.t / 2]); P.push([s.z - nx * s.t / 2, s.y - ny * s.t / 2]); }
    const t = b[b.length - 1];
    return { obrys: L.concat(P.reverse()), tip: [t.z, t.y, K.polomerKonce(r)] };
  }
  /** Cesta SVG vlastního obrysu (úsečky L, křivky C) v souřadnicích výkresu. */
  function cestaObrysu(ob, X, Y) {
    let d = `M${n(X(ob.body[0].x))} ${n(Y(ob.body[0].y))}`;
    ob.body.forEach((P, i) => {
      const k = K.usek(ob, i), Q = ob.body[(i + 1) % ob.body.length];
      d += k ? `C${n(X(k[1][0]))} ${n(Y(k[1][1]))} ${n(X(k[2][0]))} ${n(Y(k[2][1]))} ${n(X(Q.x))} ${n(Y(Q.y))}` : `L${n(X(Q.x))} ${n(Y(Q.y))}`;
    });
    return d + 'Z';
  }
  const cestaZY = (body, X, Y) => 'M' + body.map(([z, y]) => n(X(z)) + ' ' + n(Y(y))).join('L') + 'Z';
  /** Obrys těla zboku (přední rohy zaoblené). */
  function cestaTela(tl, X, Y) {
    const r = Math.max(0, Math.min(tl.roh, tl.hloubka - 0.5, tl.vyska / 2 - 0.5)), D = tl.hloubka, H = tl.vyska;
    const sx = Math.abs(X(1) - X(0)), R = r * sx;
    return `M${n(X(0))} ${n(Y(0))}L${n(X(D - r))} ${n(Y(0))}` + (r > 0.2 ? `A${n(R)} ${n(R)} 0 0 0 ${n(X(D))} ${n(Y(r))}` : '')
      + `L${n(X(D))} ${n(Y(H - r))}` + (r > 0.2 ? `A${n(R)} ${n(R)} 0 0 0 ${n(X(D - r))} ${n(Y(H))}` : '') + `L${n(X(0))} ${n(Y(H))}Z`;
  }

  /** Štítek zboku: obdélník hloubka × výška obalu štítku, čelo zkosené o hranu. */
  function cestaStitkuZboku(p, o, X, Y) {
    const D = p.telo.hloubka, b = o.obalStitku, h = Math.max(0, Math.min(p.telo.hrana, D - p.uchyt.hloubka - p.uchyt.vule - 0.5, (b[3] - b[1]) / 2));
    return `M${n(X(0))} ${n(Y(b[1]))}L${n(X(D - h))} ${n(Y(b[1]))}L${n(X(D))} ${n(Y(b[1] + h))}L${n(X(D))} ${n(Y(b[3] - h))}L${n(X(D - h))} ${n(Y(b[3]))}L${n(X(0))} ${n(Y(b[3]))}Z`;
  }
  /** Malý profil zboku do galerie (CSS třídy .tvar a .zed). */
  function profilSvg(q) {
    const o = K.odvozene(q), c = [], X = z => z, Y = y => -y;
    q.ramena.forEach((r, i) => {
      for (const poly of polygonyRamene(r, o.ramena[i], q.telo)) c.push(`<path class="tvar" d="${cestaZY(poly, X, Y)}"/>`);
    });
    for (const ob of q.obrysy || []) c.push(`<path class="${ob.dira ? 'dira' : 'tvar'}" d="${cestaObrysu(ob, X, Y)}"/>`);
    const m = 4, w = o.zMax + 2 * m, hh = o.yMax - o.yMin + 2 * m, s = Math.max(w, hh);
    const x0 = -m - (s - w) / 2, y0 = -o.yMax - m - (s - hh) / 2;
    return `<svg viewBox="${n(x0)} ${n(y0)} ${n(s)} ${n(s)}" aria-hidden="true"><line class="zed" x1="0" y1="${n(y0)}" x2="0" y2="${n(y0 + s)}"/>`
      + `<path class="tvar" d="${cestaStitkuZboku(q, o, X, Y)}"/>${c.join('')}</svg>`;
  }

  /* ---------- kóty ---------- */
  function koty(out, vel) {
    const txt = (x, y, t, kotva = 'middle', rot = 0) => out.push(`<text x="${n(x)}" y="${n(y)}" font-size="${n(vel)}" text-anchor="${kotva}"`
      + (rot ? ` transform="rotate(${rot} ${n(x)} ${n(y)})"` : '') + `>${esc(t)}</text>`);
    return {
      txt,
      /** Vodorovná kóta mezi x1 a x2 ve výšce y, vynášecí čáry od yOd. */
      h(x1, x2, y, t, yOd) {
        if (yOd != null) out.push(`<path class="pomocna" d="M${n(x1)} ${n(yOd)}V${n(y)}M${n(x2)} ${n(yOd)}V${n(y)}"/>`);
        out.push(`<path class="kota" d="M${n(x1)} ${n(y)}H${n(x2)}" marker-start="url(#sip)" marker-end="url(#sip)"/>`);
        txt((x1 + x2) / 2, y - vel * 0.35, t);
      },
      /** Svislá kóta mezi y1 a y2 ve vzdálenosti x, vynášecí čáry od xOd. */
      v(y1, y2, x, t, xOd) {
        if (xOd != null) out.push(`<path class="pomocna" d="M${n(xOd)} ${n(y1)}H${n(x)}M${n(xOd)} ${n(y2)}H${n(x)}"/>`);
        out.push(`<path class="kota" d="M${n(x)} ${n(y1)}V${n(y2)}" marker-start="url(#sip)" marker-end="url(#sip)"/>`);
        txt(x - vel * 0.35, (y1 + y2) / 2, t, 'middle', -90);
      },
    };
  }
  const STYL = `<style>.obrys{fill:#fff;stroke:#000;stroke-width:.35}.skryta{fill:none;stroke:#000;stroke-width:.2;stroke-dasharray:1.6 .8}
    .osa{fill:none;stroke:#000;stroke-width:.15;stroke-dasharray:4 .8 .6 .8}.kota{fill:none;stroke:#000;stroke-width:.18}.pomocna{fill:none;stroke:#000;stroke-width:.12}
    .zed{fill:none;stroke:#000;stroke-width:.25}.slaba{fill:none;stroke:#888;stroke-width:.2}text{fill:#000;font-family:sans-serif}</style>`;
  const SIPKA = '<marker id="sip" viewBox="0 0 6 6" refX="5.5" refY="3" markerWidth="2.6" markerHeight="2.6" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 1L6 3L0 5Z" fill="#000"/></marker>';

  /** Technický výkres: {svg, sirka, vyska, meritko} v mm. maxSirka = šířka listu pro výběr měřítka. */
  function vykresSvg(p, o, maxSirka = 190) {
    const tl = p.telo, u = p.uchyt, uch = o.uch, Ws = o.obalStitku[2] - o.obalStitku[0], W = o.xMax - o.xMin;
    const sirkaPohledu = o.zMax + 26 + W + 34;
    const vyskaPohledu = o.yMax - o.yMin + 26;
    const m = sirkaPohledu + 2 * u.sirka + 30 <= maxSirka ? 1 : sirkaPohledu / 2 + 2 * u.sirka + 30 <= maxSirka ? 0.5 : 0.25;
    const vel = 3, out = [], k = koty(out, vel);
    const top = 14, Y = y => top + (o.yMax - y) * m;
    // --- profil zboku
    const X = z => 12 + z * m;
    out.push(`<path class="zed" d="M${n(X(0))} ${n(Y(o.yMax + 6))}V${n(Y(o.yMin - 6))}"/>`);
    for (let y = o.yMin - 4; y < o.yMax + 6; y += 6 / m) out.push(`<path class="zed" d="M${n(X(0))} ${n(Y(y))}l-3 3"/>`);
    p.ramena.forEach((r, i) => {
      for (const poly of polygonyRamene(r, o.ramena[i], tl)) out.push(`<path class="obrys" d="${cestaZY(poly, X, Y)}"/>`);
    });
    out.push(`<path class="obrys" d="${cestaStitkuZboku(p, o, X, Y)}"/>`);
    for (const ob of p.obrysy) if (!ob.dira) out.push(`<path class="obrys" d="${cestaObrysu(ob, X, Y)}"/>`);
    for (const ob of p.obrysy) if (ob.dira) out.push(`<path class="obrys" d="${cestaObrysu(ob, X, Y)}" style="fill:#fff;stroke-dasharray:none"/>`);
    out.push(`<path class="skryta" d="M${n(X(0))} ${n(Y(uch.vrchKapsy))}H${n(X(u.hloubka + u.vule))}V${n(Y(0))}"/>`);
    for (const y of uch.srouby) out.push(`<path class="osa" d="M${n(X(-4))} ${n(Y(y + uch.dole))}H${n(X(u.hloubka + 3))}"/>`);
    k.txt(X(o.zMax / 2), top - 7, `Profil zboku${m !== 1 ? '' : ''}`);
    k.h(X(0), X(tl.hloubka), Y(o.yMin) + 6, fmt(tl.hloubka), Y(0));
    if (o.zMax > tl.hloubka + 1) k.h(X(0), X(o.zMax), Y(o.yMin) + 12, fmt(o.zMax), Y(o.yMin));
    const hS = o.obalStitku[3] - o.obalStitku[1];
    k.v(Y(o.obalStitku[1]), Y(o.obalStitku[3]), X(o.zMax) + 7, fmt(hS), X(tl.hloubka));
    if (o.yMax - o.yMin > hS + 1) k.v(Y(o.yMin), Y(o.yMax), X(o.zMax) + 13, fmt(o.yMax - o.yMin), X(o.zMax));
    p.ramena.forEach((r, i) => k.txt(X(tl.hloubka) + 1.5, Y(r.y) - 1, `${i + 1}`, 'start'));
    // --- pohled zepředu (silueta = pásy výšky, kde je profil)
    const X0 = X(o.zMax) + 22, Xf = x => X0 + (x - o.xMin) * m;
    // pásy ramen a bočních obrysů (zepředu obdélníky dané šířky), přes ně štítek skutečným tvarem
    const pasy = [];
    o.ramena.forEach((a, i) => {
      const rk = K.polomerKonce(p.ramena[i]), t = a.body[a.body.length - 1];
      const r = p.ramena[i];
      pasy.push([r.sirka > 0 ? r.sirka : o.sirkaRamen, Math.min(a.yMin, t.y - rk), Math.max(a.yMax, t.y + rk), r.x]);
    });
    for (const ob of p.obrysy) if (!ob.dira) { const b = K.obalObrysu([ob]); pasy.push([ob.sirka > 0 ? ob.sirka : o.sirkaRamen, b[1], b[3], ob.x || 0]); }
    for (const [sw, y0, y1, px] of pasy) out.push(`<rect class="obrys" x="${n(Xf(px - sw / 2))}" y="${n(Y(y1))}" width="${n(sw * m)}" height="${n((y1 - y0) * m)}"/>`);
    const Yf = Y;
    for (const ob of o.stitek) out.push(`<path class="obrys" d="${cestaObrysu(ob, Xf, Yf)}"${ob.dira ? ' style="fill:#fff"' : ''}/>`);
    const sl = [[o.obalStitku[1]]];
    const sV = uch.sirkaKapsy;
    out.push(`<path class="skryta" d="M${n(Xf(-sV(o.obalStitku[1])))} ${n(Y(o.obalStitku[1]))}L${n(Xf(-sV(uch.vrchKapsy)))} ${n(Y(uch.vrchKapsy))}H${n(Xf(sV(uch.vrchKapsy)))}L${n(Xf(sV(o.obalStitku[1])))} ${n(Y(o.obalStitku[1]))}"/>`);
    out.push(`<path class="osa" d="M${n(Xf(0))} ${n(Y(o.yMax + 3))}V${n(Y(o.yMin - 3))}"/>`);
    for (const y of uch.srouby) {
      const yy = Y(y + uch.dole), r = uch.sr.hlava / 2 * m;
      out.push(`<circle class="skryta" cx="${n(Xf(0))}" cy="${n(yy)}" r="${n(r)}"/><path class="osa" d="M${n(Xf(0) - r - 2)} ${n(yy)}H${n(Xf(0) + r + 2)}"/>`);
    }
    k.txt(Xf(0), top - 7, 'Zepředu');
    k.h(Xf(o.obalStitku[0]), Xf(o.obalStitku[2]), Y(o.yMin) + 6, fmt(Ws), Y(sl[0][0]));
    const ys = uch.srouby.map(y => y + uch.dole);
    k.v(Y(0), Y(ys[0]), Xf(o.xMax) + 6, fmt(ys[0]), Xf(0));
    if (ys.length > 1) k.v(Y(ys[0]), Y(ys[ys.length - 1]), Xf(o.xMax) + 12, fmt(ys[ys.length - 1] - ys[0]), Xf(0));
    // --- průřez úchytu 2:1
    const Xs0 = Xf(o.xMax) + 24, ms = 2, ys0 = top + 8;
    const Xs = c => Xs0 + (c + u.sirka / 2) * ms, Ys = a => ys0 + (u.hloubka - a) * ms;
    out.push(`<path class="obrys" d="M${uch.pr.map(([c, a]) => n(Xs(c)) + ' ' + n(Ys(a))).join('L')}Z"/>`);
    out.push(`<path class="zed" d="M${n(Xs(-u.sirka / 2 - 3))} ${n(Ys(0))}H${n(Xs(u.sirka / 2 + 3))}"/>`);
    k.txt(Xs(0), top - 7, 'Úchyt – řez 2:1');
    k.h(Xs(-u.sirka / 2), Xs(u.sirka / 2), ys0 - 4, fmt(u.sirka), Ys(u.hloubka));
    k.h(Xs(-uch.uzky / 2), Xs(uch.uzky / 2), Ys(0) + 7, fmt(uch.uzky), Ys(0));
    k.v(Ys(0), Ys(u.hloubka), Xs(u.sirka / 2) + 6, fmt(u.hloubka), Xs(u.sirka / 2));
    k.txt(Xs(0), Ys(0) + 15, u.profil === 'T' ? `T, přesah ${fmt(u.presah)}, spodek hlavy 45°` : `rybina ${fmt(u.uhel)}°`);
    k.txt(Xs(0), Ys(0) + 19.5, `výška ${fmt(u.vyska)}, klín ${fmt(u.klin)}`);
    k.txt(Xs(0), Ys(0) + 24, `vůle ${fmt(u.vule, 2)} na stranu`);
    const sirka = Math.max(Xs(u.sirka / 2) + 12, Xs0 + 40), vyska = Math.max(top + vyskaPohledu * m + 6, ys0 + u.hloubka * ms + 30);
    k.txt(2, vyska - 1, `Měřítko pohledů ${m === 1 ? '1:1' : m === 0.5 ? '1:2' : '1:4'}, rozměry v mm`, 'start');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(sirka)}mm" height="${n(vyska)}mm" viewBox="0 0 ${n(sirka)} ${n(vyska)}">`
      + `<defs>${SIPKA}</defs>${STYL}${out.join('')}</svg>`;
    return { svg, sirka, vyska, meritko: m };
  }

  /** Vrtací šablona 1:1 pro řadu věšáků: {svg, sirka, vyska, nakresleno}. Pohled na zeď, y = výška nad spodkem věšáku. */
  function sablonaSvg(p, o, maxSirka = 190) {
    const u = p.uchyt, uch = o.uch, W = 2 * Math.max(-o.xMin, o.xMax), rozestup = p.montaz.rozestup, vel = 3;
    const kolik = Math.max(1, Math.min(p.montaz.pocet, Math.floor((maxSirka - 30 - W - 24) / rozestup) + 1));
    const out = [], k = koty(out, vel), vrt = K.vrtak(p);
    const okraj = 30, horni = 22, H = o.obalStitku[3];
    const X = x => okraj + W / 2 + x, Y = y => horni + (H + 8 - y);
    const sirka = Math.max(X((kolik - 1) * rozestup) + W / 2 + 24, 150), yVrut = uch.srouby.map(y => y + uch.dole);
    // vodorovná čára přes horní vrut (vodováha) a spodek věšáku
    out.push(`<path class="osa" d="M4 ${n(Y(yVrut[yVrut.length - 1]))}H${n(sirka - 4)}"/>`);
    k.txt(4, Y(yVrut[yVrut.length - 1]) - 1.2, 'vodorovně (vodováha)', 'start');
    out.push(`<path class="pomocna" d="M4 ${n(Y(0))}H${n(sirka - 4)}"/>`);
    k.txt(4, Y(0) + 4, p.montaz.vyska > 0 ? `spodek věšáku – ${fmt(p.montaz.vyska, 0)} mm nad podlahou` : 'spodek věšáku', 'start');
    for (let i = 0; i < kolik; i++) {
      const x = i * rozestup;
      for (const ob of o.stitek) out.push(`<path class="slaba" d="${cestaObrysu(ob, q => X(x + q), Y)}"/>`);
      const sV = y => u.sirka * (1 - (1 - uch.sNahore) * y / u.vyska) / 2;
      const y0 = uch.dole, y1 = uch.dole + u.vyska;
      out.push(`<path class="skryta" d="M${n(X(x - sV(0)))} ${n(Y(y0))}L${n(X(x - sV(u.vyska)))} ${n(Y(y1))}H${n(X(x + sV(u.vyska)))}L${n(X(x + sV(0)))} ${n(Y(y0))}Z"/>`);
      out.push(`<path class="osa" d="M${n(X(x))} ${n(Y(H + 6))}V${n(Y(-6))}"/>`);
      for (const y of yVrut) {
        const cx = X(x), cy = Y(y);
        out.push(`<circle class="obrys" cx="${n(cx)}" cy="${n(cy)}" r="${n(vrt / 2)}" style="fill:none"/><path class="kota" d="M${n(cx - 6)} ${n(cy)}H${n(cx + 6)}M${n(cx)} ${n(cy - 6)}V${n(cy + 6)}"/>`);
      }
      k.txt(X(x), Y(H) - 2, `${i + 1}`);
    }
    // kóty u prvního věšáku
    k.v(Y(0), Y(yVrut[0]), X(-W / 2) - 6, fmt(yVrut[0]), X(0));
    if (yVrut.length > 1) k.v(Y(yVrut[0]), Y(yVrut[yVrut.length - 1]), X(-W / 2) - 12, fmt(yVrut[yVrut.length - 1] - yVrut[0]), X(0));
    if (kolik > 1) k.h(X(0), X(rozestup), Y(H) - 8, `rozestup ${fmt(rozestup)}`, Y(H));
    const hlVrt = o.zed.kotva + p.montaz.omitka + 5;
    const leg = [`Ø ${fmt(vrt, 1)} mm = ${p.montaz.zed === 'drevo' ? 'předvrt' : 'vrták pro hmoždinku'}, hloubka ≈ ${fmt(hlVrt, 0)} mm (zeď: ${o.zed.nazev})`,
      `vruty ${fmt(uch.sr.d)} × ${fmt(o.delkaVrutu)} mm se zápustnou hlavou, ${p.uchyt.pocet} na věšák`,
      'plná čára = obrys věšáku, čárkovaně úchyt na zeď (po dosednutí věšáku)'];
    if (p.montaz.pocet > kolik) {
      leg.push(`na list se ${kolik === 1 ? 'vejde 1 věšák' : `vejdou ${kolik} věšáky`} z ${p.montaz.pocet} – šablonu posouvejte po vodorovné čáře o rozestup ${fmt(rozestup)} mm;`);
      const osy = []; for (let i = 0; i < p.montaz.pocet; i++) osy.push(fmt(i * rozestup));
      leg.push(`osy věšáků od prvního: ${osy.join(' · ')} mm (celkem ${fmt((p.montaz.pocet - 1) * rozestup + W)} mm)`);
    }
    const yl = Y(-6) + 8;
    leg.forEach((t, i) => k.txt(4, yl + i * 4.5, t, 'start'));
    const ym = yl + leg.length * 4.5 + 6;
    out.push(`<path class="zed" d="M4 ${n(ym)}h50m-50 -2v4m50 -4v4"/>`);
    k.txt(4, ym - 2.5, '50 mm – ověřte pravítkem', 'start');
    const vyska = ym + 4;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(sirka)}mm" height="${n(vyska)}mm" viewBox="0 0 ${n(sirka)} ${n(vyska)}">`
      + `<defs>${SIPKA}</defs>${STYL}${out.join('')}</svg>`;
    return { svg, sirka, vyska, nakresleno: kolik };
  }

  /** Popis trasy ramene slovy (do technického listu). */
  function popisTrasy(r) {
    // každý úsek zvlášť přes I18N.t – vnořené parametry by překlad stránky nezachytil
    const T = (txt, par) => (typeof I18N !== 'undefined' && I18N.t ? I18N.t(txt, par) : txt.replace(/\{(\w+)\}/g, (_, k) => par[k]));
    return r.trasa.map(g => g.t === 'r' ? T('rovně {d}', { d: fmt(g.d) }) : g.t === 'z' ? T('zlom {u}°', { u: fmt(g.u) })
      : g.t === 's' ? T('spirála R {r}→{r1}, {u}°', { r: fmt(g.r), r1: fmt(g.r1), u: fmt(g.u) }) : T('oblouk R {r}, {u}°', { r: fmt(g.r), u: fmt(g.u) })).join(' · ') || '–';
  }

  /** Popis ramene podle druhu (do technického listu). */
  function popisRamene(r) {
    const pos = (r.x ? `, posun ${fmt(r.x)}` : '') + (r.sirka ? `, šířka ${fmt(r.sirka)}` : '');
    if (r.druh === 'blok') return `blok: horní hrana ve výšce ${fmt(r.y)}, délka ${fmt(r.delka)}, výška ${fmt(r.h0)} → ${fmt(r.h1)}, sklon ${fmt(r.sklon)}°, zub ${fmt(r.zub)}${pos}`;
    if (r.druh === 'hrib') return `kolík s hlavou: osa ve výšce ${fmt(r.y)}, úhel ${fmt(r.uhel)}°, délka ${fmt(r.delka)}, dřík ${fmt(r.tl)}, hlava +${fmt(r.nahoru)} / −${fmt(r.dolu)} × ${fmt(r.hlavaTl)}${pos}`;
    return `kořen ve výšce ${fmt(r.y)}, úhel ${fmt(r.uhel)}°, tl. ${fmt(r.tl0)} → ${fmt(r.tl1)}, ${K.KONCE[r.konec]}${r.konec === 'koule' ? ` R ${fmt(r.rKonec)}` : ''}${pos}; ${popisTrasy(r)}`;
  }
  /** Technický list (HTML k tisku na A4): výkres, parametry, pevnost, kusovník, montáž. */
  function technickyList(p, o, pev, souhrn) {
    const v = vykresSvg(p, o, 186), u = p.uchyt, kus = K.kusovnik(p, o), zed = o.zed;
    const tab = (hlava, radky) => `<table><tr>${hlava.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${radky.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
    const parametry = [
      ['Štítek', `${K.TVARY_STITKU[p.telo.tvar].nazev}, ${fmt(o.obalStitku[2] - o.obalStitku[0])} × ${fmt(o.obalStitku[3] - o.obalStitku[1])} × ${fmt(p.telo.hloubka)} mm, hrany ${K.HRANY[p.telo.hranaTyp]} ${fmt(p.telo.hrana)}`],
      ['Úchyt', `${K.PROFILY_UCHYTU[u.profil].nazev}, ${fmt(u.sirka)} × ${fmt(u.vyska)} × ${fmt(u.hloubka)} mm, ${u.profil === 'T' ? `přesah ${fmt(u.presah)}` : `úhel ${fmt(u.uhel)}°`}, klín ${fmt(u.klin)}, vůle ${fmt(u.vule, 2)}, spodek ${fmt(o.uch.y0)} mm nad spodkem štítku`],
      ...p.ramena.map((r, i) => [`Rameno ${i + 1}`, popisRamene(r)]),
      ['Tisk', `${K.MATERIALY[p.tisk.material].nazev}, výplň ${fmt(p.tisk.vypln, 0)} %, věšák ${o.orientace === 'zada' ? 'zády dolů' : 'na boku'}, úchyt zády dolů${souhrn ? '; ' + souhrn : ''}`],
    ];
    const pevnost = pev.radky.map(r => [r.co, r.napeti != null ? `${fmt(r.napeti, 1)} MPa` : `${fmt(r.sila, 0)} N`, `× ${r.k > 99 ? '>99' : fmt(r.k, 1)}`, r.unese > 99 ? '> 99 kg' : `${fmt(r.unese, 1)} kg`]);
    const hlVrt = zed.kotva + p.montaz.omitka + 5;
    const postup = [
      `Vytiskněte vrtací šablonu 1:1 (ověřte měřítko 50 mm), přiložte ji na zeď${p.montaz.vyska > 0 ? ` spodkem věšáku ${fmt(p.montaz.vyska, 0)} mm nad podlahou` : ''} a vyrovnejte vodováhou.`,
      `Vyvrtejte otvory Ø ${fmt(K.vrtak(p), 1)} mm do hloubky ≈ ${fmt(hlVrt, 0)} mm${p.montaz.zed === 'drevo' ? ' (předvrt)' : ` a vložte ${zed.hmozdinka}`}.`,
      `Přišroubujte úchyt (užším koncem nahoru${u.klin > 0 ? ' – je to klín' : ''}) vruty ${fmt(o.uch.sr.d)} × ${fmt(o.delkaVrutu)} mm; hlavy musí být pod přední plochou úchytu.`,
      `Nasuňte věšák shora a dotlačte dolů${u.klin > 0 ? ` – s klínem dosedne asi ${fmt(o.uch.pokles)} mm pod vršek úchytu a přestane se viklat` : ''}. Sundává se tahem nahoru.`,
    ];
    return `<div class="list-hlava"><b>${esc(p.nazev || 'Věšák')}</b> – technický list · ${esc(K.popis(p))}</div>`
      + `<div class="list-vykres">${v.svg}</div>`
      + `<h3>Parametry</h3>${tab(['', ''], parametry)}`
      + `<h3>Pevnost (zátěž ${fmt(p.zatez.kg)} kg na každém rameni)</h3>${tab(['Místo', 'Napětí / síla', 'Bezpečnost', 'Unese na rameno'], pevnost)}`
      + `<h3>Kusovník pro ${p.montaz.pocet} ${p.montaz.pocet === 1 ? 'věšák' : p.montaz.pocet < 5 ? 'věšáky' : 'věšáků'}</h3>${tab(['Ks', 'Položka', 'Poznámka'], kus.map(x => [String(x.ks), x.co, x.pozn]))}`
      + `<h3>Montáž</h3><ol>${postup.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`
      + `<p class="list-pozn">Pevnosti a únosnosti hmoždinek jsou orientační (stav ${K.DATUM_DAT}) – řiďte se údaji výrobce hmoždinky a vyzkoušejte zkušební kus.</p>`;
  }

  const API = { polygonyRamene, cestaObrysu, cestaTela, cestaStitkuZboku, profilSvg, vykresSvg, sablonaSvg, technickyList, popisTrasy, obrysRamene };
  if (typeof module !== 'undefined') module.exports = API; else window.VESAKY_VYKRES = API;
})();
