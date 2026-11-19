/* Příchytky trubek – výkres A4 naležato (bez DOM, běží i v node).
   Vlevo průřez příchytky (u klipu, omegy, objímky a řady) nebo čelní pohled držáku hadice s kótami,
   vpravo pohled od zdi = vrtací šablona (obrys základny, středy děr), dole tabulka, kusovník a razítko,
   kontrolní úsečka 50 mm (při tisku 1 : 1 musí měřit 50 mm).
   vykres(p, model, meta) → {W, H, meritko, prvky};  prvek: {t:'l', b:[[x,y]…], z (uzavřít), s (tloušťka), d:'c'|'o'} | {t:'k', x, y, r, s, d} | {t:'txt', x, y, h, txt, a, b (tučně)}
   svg(v) → text SVG (mm);  pdf(jsPDF, v, {pismo, nazev}) → dokument jsPDF. */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.PRICH;
  const f = (x, d = 1) => K.fmt(x, d);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);
  const W = 297, H = 210;
  const MERITKA = [1, 0.5, 0.2, 0.1];
  const nazevM = m => (m >= 1 ? '1 : 1' : `1 : ${Math.round(1 / m)}`);
  const S = { vid: 0.5, ten: 0.25, osa: 0.18, kota: 0.18 };

  function vykres(p, model, meta = {}) {
    const o = model.o, P = [];
    const cara = (b, s = S.vid, z = false, d) => P.push({ t: 'l', b, s, z, d });
    const kruh = (x, y, r, s = S.ten, d) => P.push({ t: 'k', x, y, r, s, d });
    const text = (x, y, txt, h = 2.6, a = 'l', b = false) => P.push({ t: 'txt', x, y, h, txt: t(String(txt)), a, b });
    /** Kóta mezi body papíru A, B, odsazená o od (kolmo, mm papíru), text nad čarou. */
    function kota(A, B, od, txt) {
      const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
      if (l < 0.3) return;
      const nx = dy / l, ny = -dx / l, A2 = [A[0] + nx * od, A[1] + ny * od], B2 = [B[0] + nx * od, B[1] + ny * od];
      cara([A, [A2[0] + nx * Math.sign(od) * 1.2, A2[1] + ny * Math.sign(od) * 1.2]], S.kota);
      cara([B, [B2[0] + nx * Math.sign(od) * 1.2, B2[1] + ny * Math.sign(od) * 1.2]], S.kota);
      cara([A2, B2], S.kota);
      for (const [Q, s] of [[A2, 1], [B2, -1]]) { const ux = dx / l * s, uy = dy / l * s; cara([[Q[0] + ux * 2.2 + nx * 0.7, Q[1] + uy * 2.2 + ny * 0.7], Q, [Q[0] + ux * 2.2 - nx * 0.7, Q[1] + uy * 2.2 - ny * 0.7]], S.kota); }
      const mx = (A2[0] + B2[0]) / 2 + nx * 1.1 * Math.sign(od || 1), my = (A2[1] + B2[1]) / 2 + ny * 1.1 * Math.sign(od || 1);
      text(mx, my + (Math.abs(dx) >= Math.abs(dy) ? 0 : 0.9), txt, 2.4, 'c');
    }
    const osa = (A, B) => cara([A, B], S.osa, false, 'o');

    /* ---- obsah: obrys průřezu (model, mm) + obrys půdorysu (pohled od zdi) ---- */
    let prurez, pudorys, diry, nadpisL;
    if (o.druh === 'hadice') {
      const r = o.hadice;
      // čelní pohled: x podél zdi, y nahoru
      const usec = R => { const b = [], a0 = Math.asin(Math.min(1, Math.sqrt(Math.max(0, R * R - r.yc * r.yc)) / R)); for (let i = 0; i <= 48; i++) { const a = -a0 + 2 * a0 * i / 48; b.push([R * Math.sin(a), r.yc + R * Math.cos(a)]); } return b; };
      prurez = [[[-r.sirkaDesky / 2, 0], [r.sirkaDesky / 2, 0], [r.sirkaDesky / 2, r.vyskaDesky], [-r.sirkaDesky / 2, r.vyskaDesky]], usec(r.Rs)];
      if (p.hadice.lem > 0) prurez.push(usec(r.Rl));
      if (r.dutina) prurez.push(r.dutina.map(q => q.slice()));
      pudorys = { x0: -r.sirkaDesky / 2, x1: r.sirkaDesky / 2, y0: 0, y1: r.vyskaDesky };
      diry = o.diry.map(d => ({ x: d.x, y: d.y, r: d.ro }));
      nadpisL = 'Pohled zepředu';
    } else {
      const hl = model.dily[0];
      prurez = (hl.prurez || []).map(q => q.slice());
      if (model.dily[1] && model.dily[1].prurez) for (const q of model.dily[1].prurez) prurez.push(q.slice());
      const [ua, ub] = o.uRozsah;
      pudorys = { x0: ua, x1: ub, y0: 0, y1: o.b + o.wExt };
      diry = o.diry.map(d => ({ x: d.u, y: d.w, r: d.ro }));
      nadpisL = 'Průřez (rovina kolmá na trubku)';
    }
    const obal = polys => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of polys) for (const [x, y] of q) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 }; };
    const bP = obal(prurez.length ? prurez : [[[0, 0], [1, 1]]]), bD = { x0: pudorys.x0, x1: pudorys.x1, y0: pudorys.y0, y1: pudorys.y1, w: pudorys.x1 - pudorys.x0, h: pudorys.y1 - pudorys.y0 };
    const PL = { x: 14, y: 16, w: 150, h: 120 }, PR = { x: 172, y: 16, w: 112, h: 120 };
    let m = MERITKA.find(k => bP.w * k <= PL.w - 30 && bP.h * k <= PL.h - 26) || MERITKA[MERITKA.length - 1];
    const mR = MERITKA.find(k => bD.w * k <= PR.w - 24 && bD.h * k <= PR.h - 26) || MERITKA[MERITKA.length - 1];
    // levý pohled
    const lx = PL.x + PL.w / 2 - (bP.x0 + bP.w / 2) * m, ly = PL.y + PL.h / 2 + (bP.y0 + bP.h / 2) * m + 4;
    const TL = (x, y) => [lx + x * m, ly - y * m];
    for (const q of prurez) cara(q.map(([x, y]) => TL(x, y)), S.vid, true);
    // zeď (v = 0) – čerchovaně
    if (o.druh !== 'hadice') {
      osa(TL(bP.x0 - 6 / m, 0), TL(bP.x1 + 6 / m, 0));
      text(TL(bP.x1 + 6 / m, 0)[0] - 1, TL(0, 0)[1] - 1, 'zeď', 2.2, 'r');
      for (const r of o.kruhy) {
        kruh(TL(r.uc, r.vc)[0], TL(r.uc, r.vc)[1], r.D / 2 * m, S.ten, 'c');
        osa(TL(r.uc - r.Ro - 2, r.vc), TL(r.uc + r.Ro + 2, r.vc)); osa(TL(r.uc, r.vc - r.Ro - 2), TL(r.uc, r.vc + r.Ro + 2));
      }
      const r0 = o.kruhy[0];
      kota(TL(r0.uc - r0.R, r0.vc), TL(r0.uc + r0.R, r0.vc), 0, `Ø ${f(2 * r0.R, 2)}`);
      if (o.druh === 'klip' || o.druh === 'rada') kota(TL(r0.uc - r0.w / 2, r0.vc + r0.R * Math.cos(r0.g)), TL(r0.uc + r0.w / 2, r0.vc + r0.R * Math.cos(r0.g)), -(r0.t || o.t) * m - (r0.vc + r0.Ro - (r0.vc + r0.R * Math.cos(r0.g))) * m - 3, `ústí ${f(r0.w, 1)}`);
      const xl = TL(bP.x0, 0)[0] - 6;
      kota([xl, TL(0, o.vz0)[1]], [xl, TL(0, r0.vc)[1]], 0, `${f(r0.vc - o.vz0, 1)}`);
      kota(TL(bP.x0, bP.y0), TL(bP.x1, bP.y0), -7, `${f(bP.w, 1)}`);
      if (o.kruhy.length > 1) for (let i = 1; i < o.kruhy.length; i++) { const a = o.kruhy[i - 1], c = o.kruhy[i], y = Math.max(a.vc + a.Ro, c.vc + c.Ro) + 4; kota(TL(a.uc, y), TL(c.uc, y), 0, f(c.uc - a.uc, 1)); }
    } else {
      const r = o.hadice;
      osa(TL(0, -3), TL(0, r.vyskaDesky + 3));
      kota(TL(-r.sirkaDesky / 2, 0), TL(r.sirkaDesky / 2, 0), -7, f(r.sirkaDesky, 1));
      kota(TL(r.sirkaDesky / 2, 0), TL(r.sirkaDesky / 2, r.vyskaDesky), -5, f(r.vyskaDesky, 1));
      kota(TL(-r.polTetivy, 0), TL(-r.polTetivy, r.vys), 6, f(r.vys, 1));
      text(TL(-r.polTetivy * 0.55, r.vys)[0], TL(0, r.vys)[1] - 3, `R ${f(r.Rs, 0)}`, 2.6, 'r');
      for (const d of diry) kruh(TL(d.x, d.y)[0], TL(d.x, d.y)[1], d.r * m);
    }
    text(PL.x + PL.w / 2, PL.y + 3, `${nadpisL} · ${nazevM(m)}`, 3.2, 'c', true);
    // pravý pohled: vrtací šablona
    const mL = m; m = mR;
    const rx = PR.x + PR.w / 2 - (bD.x0 + bD.w / 2) * m, ry = PR.y + PR.h / 2 + (bD.y0 + bD.h / 2) * m + 4;
    const TR = (x, y) => [rx + x * m, ry - y * m];
    cara([TR(bD.x0, bD.y0), TR(bD.x1, bD.y0), TR(bD.x1, bD.y1), TR(bD.x0, bD.y1)], S.vid, true);
    for (const d of diry) {
      const [cx, cy] = TR(d.x, d.y);
      kruh(cx, cy, d.r * m);
      cara([[cx - d.r * m - 2, cy], [cx + d.r * m + 2, cy]], S.osa); cara([[cx, cy - d.r * m - 2], [cx, cy + d.r * m + 2]], S.osa);
    }
    if (diry.length) {
      const xs = [...new Set(diry.map(d => Math.round(d.x * 100) / 100))].sort((a, b) => a - b);
      const yRet = TR(0, bD.y1)[1] - 6;
      const body = [bD.x0, ...xs, bD.x1];
      for (let i = 1; i < body.length; i++) kota([TR(body[i - 1], 0)[0], yRet], [TR(body[i], 0)[0], yRet], 0, f(body[i] - body[i - 1], 1));
      const d0 = diry[0];
      kota([TR(bD.x1, 0)[0] + 5, TR(0, bD.y0)[1]], [TR(bD.x1, 0)[0] + 5, TR(0, d0.y)[1]], 0, f(d0.y - bD.y0, 1));
    } else text(PR.x + PR.w / 2, ry + 6, o.uchyceni === 'paska' ? 'plocha pro pásku' : o.uchyceni === 'cleat' ? 'zavěšení na lištu' : 'bez děr', 2.6, 'c');
    text(PR.x + PR.w / 2, PR.y + 3, `${o.druh === 'hadice' ? 'Deska od zdi' : 'Pohled od zdi'} – vrtací šablona · ${nazevM(m)}`, 3.2, 'c', true);
    /* ---- tabulka a razítko ---- */
    const radky = meta.radky || [];
    let y = 146;
    text(16, y, 'Parametry', 3.2, 'l', true);
    radky.slice(0, 9).forEach(([a, b], i) => { const yy = y + 5 + i * 4.6; text(16, yy, a, 2.6); text(150, yy, b, 2.6, 'r', true); cara([[16, yy + 1.3], [150, yy + 1.3]], 0.1); });
    text(172, y, 'Kusovník', 3.2, 'l', true);
    (meta.kusovnik || []).slice(0, 7).forEach(([a, b], i) => { const yy = y + 5 + i * 4.6; text(172, yy, a, 2.4); text(284, yy, b, 2.4, 'r', true); });
    // kontrolní úsečka 50 mm
    const k0 = 172, ky = 186;
    cara([[k0, ky], [k0 + 50, ky]], 0.35); cara([[k0, ky - 1.5], [k0, ky + 1.5]], 0.35); cara([[k0 + 50, ky - 1.5], [k0 + 50, ky + 1.5]], 0.35);
    text(k0 + 25, ky - 1.4, 'kontrola tisku: 50 mm', 2.2, 'c');
    // razítko
    const ry0 = 190;
    cara([[172, ry0], [285, ry0], [285, 202], [172, 202]], 0.35, true);
    cara([[172, ry0 + 6], [285, ry0 + 6]], 0.2); cara([[244, ry0], [244, 202]], 0.2);
    text(174, ry0 + 4.3, meta.nazev || p.nazev || 'Příchytka', 3, 'l', true);
    text(246, ry0 + 4.3, meta.datum || '', 2.6);
    text(174, ry0 + 10.3, meta.popis || '', 2.4);
    text(246, ry0 + 10.3, 'rozměry v mm', 2.4);
    cara([[8, 8], [289, 8], [289, 202], [8, 202]], 0.35, true);
    return { W, H, meritko: mL, meritkoSablony: mR, prvky: P };
  }

  /** Vrtací šablona 1 : 1 na samostatný list A4 (naležato): obrys základny od zdi, středy a průměry děr, vrták pro hmoždinku. */
  function sablona(p, model, meta = {}) {
    const o = model.o, P = [];
    const cara = (b, s = S.vid, z = false, d) => P.push({ t: 'l', b, s, z, d });
    const text = (x, y, txt, h = 3, a = 'l', b = false) => P.push({ t: 'txt', x, y, h, txt: t(String(txt)), a, b });
    let bD, diry;
    if (o.druh === 'hadice') { const r = o.hadice; bD = { x0: -r.sirkaDesky / 2, x1: r.sirkaDesky / 2, y0: 0, y1: r.vyskaDesky }; diry = o.diry.map(d => ({ x: d.x, y: d.y, r: d.ro })); }
    else { bD = { x0: o.uRozsah[0], x1: o.uRozsah[1], y0: 0, y1: o.b + o.wExt }; diry = o.diry.map(d => ({ x: d.u, y: d.w, r: d.ro })); }
    const cx = W / 2 - (bD.x0 + bD.x1) / 2, cy = H / 2 + (bD.y0 + bD.y1) / 2;
    const T = (x, y) => [cx + x, cy - y];
    cara([T(bD.x0, bD.y0), T(bD.x1, bD.y0), T(bD.x1, bD.y1), T(bD.x0, bD.y1)], S.vid, true, 'c');
    for (const d of diry) {
      const [x, y] = T(d.x, d.y);
      P.push({ t: 'k', x, y, r: d.r, s: S.ten });
      cara([[x - d.r - 6, y], [x + d.r + 6, y]], S.ten); cara([[x, y - d.r - 6], [x, y + d.r + 6]], S.ten);
    }
    text(14, 18, `${meta.nazev || p.nazev || 'Příchytka'} – vrtací šablona 1 : 1`, 4.2, 'l', true);
    text(14, 25, meta.vrtak || '', 3.2);
    text(14, 31, 'Přiložte čárkovaný obrys na zeď (strana příchytky u zdi), středy děr propíchněte důlčíkem.', 3);
    cara([[14, 196], [64, 196]], 0.4); cara([[14, 194], [14, 198]], 0.4); cara([[64, 194], [64, 198]], 0.4);
    text(39, 193, 'musí měřit 50 mm (tisk 100 %)', 2.6, 'c');
    const prilis = bD.x1 - bD.x0 > W - 20 || bD.y1 - bD.y0 > H - 50;
    if (prilis) text(W - 14, 18, 'Obrys je větší než list – přeměřte díry podle kót výkresu.', 3, 'r');
    return { W, H, meritko: 1, prvky: P };
  }

  const n3 = x => (Math.round(x * 1000) / 1000).toString();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dash = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(s * 8)} ${n3(s * 5)}"` : d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '');
  function svg(v) {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${v.W}mm" height="${v.H}mm" viewBox="0 0 ${v.W} ${v.H}" font-family="Arial, Helvetica, sans-serif"><rect width="${v.W}" height="${v.H}" fill="#fff"/>`;
    for (const e of v.prvky) {
      if (e.t === 'l') s += `<${e.z ? 'polygon' : 'polyline'} points="${e.b.map(([x, y]) => n3(x) + ',' + n3(y)).join(' ')}" fill="none" stroke="#000" stroke-width="${n3(e.s)}" stroke-linejoin="round"${dash(e.d, Math.max(0.2, e.s))}/>`;
      else if (e.t === 'k') s += `<circle cx="${n3(e.x)}" cy="${n3(e.y)}" r="${n3(e.r)}" fill="none" stroke="#000" stroke-width="${n3(e.s)}"${dash(e.d, Math.max(0.2, e.s))}/>`;
      else s += `<text x="${n3(e.x)}" y="${n3(e.y)}" font-size="${n3(e.h)}" text-anchor="${e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start'}"${e.b ? ' font-weight="bold"' : ''} fill="#000">${esc(e.txt)}</text>`;
    }
    return s + '</svg>';
  }
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/²/g, '2');
  function pdf(jsPDF, v, opt = {}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
    let uni = false;
    if (opt.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', opt.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
    doc.setProperties({ title: opt.nazev || 'Výkres', creator: 'Příchytky trubek – výkres' });
    doc.setDrawColor(0, 0, 0); doc.setTextColor(0, 0, 0);
    for (const e of v.prvky) {
      if (e.t === 'txt') {
        const tx = uni ? e.txt : bezDiakritiky(e.txt);
        doc.setFontSize(e.h / 0.3528);
        const w = doc.getTextWidth(tx);
        doc.text(tx, e.x - (e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0), e.y);
        continue;
      }
      doc.setLineWidth(e.s);
      const sd = Math.max(0.2, e.s);
      if (e.d === 'c') doc.setLineDashPattern([sd * 8, sd * 5], 0); else if (e.d === 'o') doc.setLineDashPattern([sd * 30, sd * 8, sd * 4, sd * 8], 0);
      if (e.t === 'k') doc.circle(e.x, e.y, e.r, 'S');
      else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
      if (e.d) doc.setLineDashPattern([], 0);
    }
    return doc;
  }

  const API = { vykres, sablona, svg, pdf, MERITKA };
  if (typeof module !== 'undefined') module.exports = API; else window.PRICH_VYK = API;
})();
