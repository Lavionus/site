/* Kliky a ruční kola na hřídel – výkres A4 naležato (bez DOM, běží i v node).
   Vlevo pohled zepředu (průmět tělesa), vpravo nahoře řez osou náboje a ramene, vedle řez držadlem a kroužkem stupnice,
   dole parametry, kusovník, tabulka stupnice, kontrolní úsečka 50 mm a razítko.
   vykres(p, model, meta) → {W, H, prvky}; prvek: {t:'l', b:[[x,y]…], z, s, d:'c'|'o'} | {t:'k', x, y, r, s, d} | {t:'txt', x, y, h, txt, a, b}
   svg(v) → text SVG (mm); pdf(jsPDF, v, {pismo, nazev}) → dokument jsPDF (prvky jako prichytky_trubek/vykres.js). */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.KLH;
  const f = (x, d = 1) => K.fmt(x, d);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);
  const W = 297, H = 210;
  const MERITKA = [2, 1, 0.5, 0.25, 0.2, 0.1, 0.05];
  const nazevM = m => (m >= 1 ? `${m} : 1` : `1 : ${Math.round(1 / m)}`);
  const S = { vid: 0.5, ten: 0.25, osa: 0.18, kota: 0.18 };
  const obal = polys => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of polys) for (const [x, y] of q) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 }; };

  function vykres(p, model, meta = {}) {
    const o = model.o, P = [], vy = model.vykres;
    const cara = (b, s = S.vid, z = false, d) => P.push({ t: 'l', b, s, z, d });
    const text = (x, y, txt, h = 2.6, a = 'l', b = false) => P.push({ t: 'txt', x, y, h, txt: t(String(txt)), a, b });
    function kota(A, B, od, txt) {
      const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
      if (l < 0.3) return;
      const nx = dy / l, ny = -dx / l, A2 = [A[0] + nx * od, A[1] + ny * od], B2 = [B[0] + nx * od, B[1] + ny * od], sg = Math.sign(od) || 1;
      cara([A, [A2[0] + nx * sg * 1.2, A2[1] + ny * sg * 1.2]], S.kota);
      cara([B, [B2[0] + nx * sg * 1.2, B2[1] + ny * sg * 1.2]], S.kota);
      cara([A2, B2], S.kota);
      for (const [Q, s] of [[A2, 1], [B2, -1]]) { const ux = dx / l * s, uy = dy / l * s; cara([[Q[0] + ux * 2.2 + nx * 0.7, Q[1] + uy * 2.2 + ny * 0.7], Q, [Q[0] + ux * 2.2 - nx * 0.7, Q[1] + uy * 2.2 - ny * 0.7]], S.kota); }
      const mx = (A2[0] + B2[0]) / 2 + nx * 1.1 * sg, my = (A2[1] + B2[1]) / 2 + ny * 1.1 * sg;
      text(mx, my + (Math.abs(dx) >= Math.abs(dy) ? 0 : 0.9), txt, 2.4, 'c');
    }
    const osa = (A, B) => cara([A, B], S.osa, false, 'o');
    /** Pohled do obdélníku R {x, y, w, h}: vybere měřítko, vrátí převod T a měřítko. */
    function pohled(polys, R, nadpis) {
      const b = obal(polys.length ? polys : [[[0, 0], [1, 1]]]);
      const m = MERITKA.find(k => b.w * k <= R.w - 22 && b.h * k <= R.h - 20) || MERITKA[MERITKA.length - 1];
      const cx = R.x + R.w / 2 - (b.x0 + b.w / 2) * m, cy = R.y + R.h / 2 + (b.y0 + b.h / 2) * m + 3;
      const T = (x, y) => [cx + x * m, cy - y * m];
      for (const q of polys) cara(q.map(([x, y]) => T(x, y)), S.vid, true);
      text(R.x + R.w / 2, R.y + 3, `${nadpis} · ${nazevM(m)}`, 3, 'c', true);
      return { T, m, b };
    }
    /* ---- pohled zepředu ---- */
    const PL = { x: 12, y: 14, w: 132, h: 124 };
    const A = pohled(vy.celo, PL, 'Pohled zepředu (od obsluhy)');
    {
      const { T, b } = A;
      osa(T(-o.Rn - 4, 0), T(Math.max(b.x1, o.Rn) + 4, 0)); osa(T(0, -o.Rn - 4), T(0, o.Rn + 4));
      const ym = T(0, b.y0)[1] + 7;
      kota([T(b.x0, 0)[0], T(0, b.y0)[1]], [T(b.x1, 0)[0], T(0, b.y0)[1]], -6, f(b.w, 1));
      if (p.druh === 'klika' || p.druh === 'sklopna') kota(T(0, b.y1), T(p.rameno.delka, b.y1), 5, `R ${f(p.rameno.delka, 1)}`);
      if (p.druh === 'paka') kota(T(0, b.y1), T(o.konec[0], b.y1), 5, f(o.konec[0], 1));
      if (p.druh === 'kolo' && p.kolo.drzadlo) kota(T(0, b.y1), T(o.Rr, b.y1), 5, `R ${f(o.Rr, 1)}`);
      void ym;
    }
    /* ---- řez osou ---- */
    const PR = { x: 150, y: 14, w: 92, h: 124 };
    const B = pohled(vy.rez, PR, 'Řez A–A osou náboje');
    {
      const { T, b } = B;
      osa(T(0, b.y0 - 3), T(0, b.y1 + 3));
      const xl = T(b.x0, 0)[0] - 5;
      kota([xl, T(0, 0)[1]], [xl, T(0, o.H)[1]], 0, f(o.H, 1));
      kota([T(b.x1, 0)[0] + 4, T(0, 0)[1]], [T(b.x1, 0)[0] + 4, T(0, p.druh === 'kolo' ? o.hv : o.t)[1]], 0, f(p.druh === 'kolo' ? o.hv : o.t, 1));
      kota(T(-o.Rn, o.H), T(o.Rn, o.H), 5 + (o.Rd && o.Rd > o.Rn ? (o.Rd - o.Rn) * B.m : 0), `Ø ${f(2 * o.Rn, 1)}`);
      text(PR.x + 2, PR.y + PR.h - 2, '↑ ke stroji · podložka = přední čelo', 2.2);
    }
    /* ---- držadlo a kroužek ---- */
    const PD = { x: 244, y: 14, w: 44, h: 80 };
    if (vy.rezDrzadla) {
      const D = pohled(vy.rezDrzadla, PD, 'Držadlo');
      const { T, b } = D;
      osa(T(0, b.y0 - 2), T(0, b.y1 + 2));
      kota([T(b.x1, 0)[0] + 3, T(0, b.y0)[1]], [T(b.x1, 0)[0] + 3, T(0, b.y1)[1]], 0, f(b.h, 1));
    }
    if (vy.rezKrouzku) {
      const PK = { x: 244, y: 96, w: 44, h: 42 };
      const Kr = pohled(vy.rezKrouzku, PK, 'Kroužek');
      const { T, b } = Kr;
      kota(T(b.x0, b.y0), T(b.x1, b.y0), -4, `Ø ${f(b.w, 1)}`);
    }
    /* ---- tabulky ---- */
    const radky = meta.radky || [];
    let y = 146;
    text(14, y, 'Parametry', 3.2, 'l', true);
    radky.slice(0, 9).forEach(([a, b], i) => { const yy = y + 5 + i * 4.4; text(14, yy, a, 2.5); text(118, yy, b, 2.5, 'r', true); cara([[14, yy + 1.2], [118, yy + 1.2]], 0.1); });
    text(126, y, 'Kusovník', 3.2, 'l', true);
    (meta.kusovnik || []).slice(0, 9).forEach(([a, b], i) => { const yy = y + 5 + i * 4.4; text(126, yy, a, 2.3); text(214, yy, b, 2.3, 'r', true); });
    if (meta.stupnice) {
      text(222, y, 'Stupnice', 3.2, 'l', true);
      meta.stupnice.slice(0, 5).forEach(([a, b], i) => { const yy = y + 5 + i * 4.4; text(222, yy, a, 2.3); text(285, yy, b, 2.3, 'r', true); });
    }
    const k0 = 222, ky = 178;
    cara([[k0, ky], [k0 + 50, ky]], 0.35); cara([[k0, ky - 1.5], [k0, ky + 1.5]], 0.35); cara([[k0 + 50, ky - 1.5], [k0 + 50, ky + 1.5]], 0.35);
    text(k0 + 25, ky - 1.6, 'kontrola tisku: 50 mm', 2.2, 'c');
    const ry0 = 188;
    cara([[172, ry0], [285, ry0], [285, 202], [172, 202]], 0.35, true);
    cara([[172, ry0 + 6], [285, ry0 + 6]], 0.2); cara([[244, ry0], [244, 202]], 0.2);
    text(174, ry0 + 4.3, meta.nazev || p.nazev || 'Klika', 3, 'l', true);
    text(246, ry0 + 4.3, meta.datum || '', 2.6);
    text(174, ry0 + 10.3, meta.popis || '', 2.2);
    text(246, ry0 + 10.3, 'rozměry v mm', 2.4);
    cara([[8, 8], [289, 8], [289, 202], [8, 202]], 0.35, true);
    return { W, H, meritko: A.m, prvky: P };
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
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/[″]/g, '"').replace(/[↑·]/g, '-');
  function pdf(jsPDF, v, opt = {}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
    let uni = false;
    if (opt.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', opt.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
    doc.setProperties({ title: opt.nazev || 'Výkres', creator: 'Kliky a ruční kola na hřídel – výkres' });
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

  const API = { vykres, svg, pdf, MERITKA };
  if (typeof module !== 'undefined') module.exports = API; else window.KLH_VYK = API;
})();
