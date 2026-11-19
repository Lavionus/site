/* Šnekový převod – výkres A4 na šířku (bez DOM, běží i v node).
   Vlevo nahoře šnek (pohled s osovým profilem závitu), vlevo dole řez kolem osou a schéma záběru s roztečí os,
   vpravo tabulka parametrů ozubení, kusovník a popisové pole.
   vykres(p, o, model, {datum, kusovnik}) → {W, H, prvky}   (mm papíru, y dolů; prvky: {t:'l', b, s, d, z} | {t:'txt', x, y, txt, h, a})
   svg(v) → text SVG; pdf(jsPDF, v, {pismo, nazev}) → dokument jsPDF (jako cleat/vykres.js). */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.SNEK;
  const f = (x, d = 2) => K.fmt(x, d);
  const W = 297, H = 210, OKRAJ = 10;
  const MERITKA = [[5, '5:1'], [4, '4:1'], [2, '2:1'], [1, '1:1'], [0.5, '1:2'], [0.4, '1:2,5'], [0.2, '1:5'], [0.1, '1:10']];
  const S = { vid: 0.5, tenka: 0.25, skr: 0.25, osa: 0.18, kota: 0.18 };
  /** Popisky v jazyce rozhraní (I18N.preloz), bez překladu česky. */
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);

  function vykres(p, o, model, opt = {}) {
    const prvky = [];
    const L = (b, typ = 'vid', z) => prvky.push({ t: 'l', b, s: S[typ] || typ, d: typ === 'skr' ? 'c' : typ === 'osa' ? 'o' : undefined, z });
    const Tx = (x, y, txt, h = 3, a = 'l', u = 0) => prvky.push({ t: 'txt', x, y, txt: t(txt), h, a, u });
    function kota(P1, P2, n, od, txt) {
      const d = [P2[0] - P1[0], P2[1] - P1[1]], l = Math.hypot(d[0], d[1]);
      if (l < 0.3) return;
      const u = [d[0] / l, d[1] / l], D1 = [P1[0] + n[0] * od, P1[1] + n[1] * od], D2 = [P2[0] + n[0] * od, P2[1] + n[1] * od];
      const sg = Math.sign(od) || 1;
      L([[P1[0] + n[0] * sg, P1[1] + n[1] * sg], [D1[0] + n[0] * 1.5 * sg, D1[1] + n[1] * 1.5 * sg]], 'kota');
      L([[P2[0] + n[0] * sg, P2[1] + n[1] * sg], [D2[0] + n[0] * 1.5 * sg, D2[1] + n[1] * 1.5 * sg]], 'kota');
      L([D1, D2], 'kota');
      const sip = (B, s) => L([[B[0] + s * (u[0] * 2.2 - u[1] * 0.7), B[1] + s * (u[1] * 2.2 + u[0] * 0.7)], B, [B[0] + s * (u[0] * 2.2 + u[1] * 0.7), B[1] + s * (u[1] * 2.2 - u[0] * 0.7)]], 'kota');
      sip(D1, 1); sip(D2, -1);
      let uhel = Math.atan2(-u[1], u[0]) * 180 / Math.PI;
      if (uhel > 90.5 || uhel <= -89.5) uhel += 180;
      if (uhel > 180) uhel -= 360;
      const ur = uhel * Math.PI / 180, nahoru = [-Math.sin(ur), -Math.cos(ur)];
      const kratka = l < 10, M = kratka ? [D2[0] + u[0] * 3, D2[1] + u[1] * 3] : [(D1[0] + D2[0]) / 2, (D1[1] + D2[1]) / 2];
      prvky.push({ t: 'txt', x: M[0] + nahoru[0] * 0.8, y: M[1] + nahoru[1] * 0.8, txt: txt, h: 2.6, a: kratka ? 'l' : 'c', u: uhel });
    }
    /** Šrafy 45° (rozestup 2 mm papíru) v obdélníku papíru. */
    function srafy(x0, y0, x1, y1) {
      for (let c = x0 - y1 + 2; c < x1 - y0; c += 2) {
        const a = [Math.max(x0, c + y0), 0], b = [Math.min(x1, c + y1), 0];
        a[1] = a[0] - c; b[1] = b[0] - c;
        if (b[0] - a[0] > 0.2) L([a, b], 'kota');
      }
    }
    const meritko = (w, h, W0, H0) => MERITKA.find(m => w * m[0] <= W0 && h * m[0] <= H0) || MERITKA[MERITKA.length - 1];

    /* ---------- 1) šnek ---------- */
    const cepy = p.snek.ulozeni === 'cepy', rc = p.snek.cep / 2, Jl = cepy ? p.snek.cepDelka : 0;
    const Lw = K.delkaSneku(p, o), kuzel = cepy ? Math.max(0, o.rf1 - 0.3 - rc) : 0;
    const zt0 = Jl + kuzel, zt1 = zt0 + o.L1, wc = (zt0 + zt1) / 2;
    {
      const A = { x: 14, y: 20, w: 172, h: 60 };
      const [m, mt] = meritko(Lw + 20, 2 * o.ra1 + 12, A.w - 20, A.h);
      const cx = A.x + A.w / 2, cy = A.y + A.h / 2 + 2, T = (x, y) => [cx + (x - wc) * m, cy - y * m];
      Tx(A.x, A.y - 6, `Šnek (${mt})`, 3.5);
      const Re = o.ra1 + 0.3, ch = Re - (o.rf1 - 0.3);
      const obal = w => (w < zt0 || w > zt1) ? 0 : Math.min(Re, o.rf1 - 0.3 + Math.min(w - zt0, zt1 - w));
      const profil = (w, fi) => Math.min(obal(w), K.profilSneku(o, (w - wc) - o.h * o.k * fi, o.wp));
      for (const [fi, sg] of [[Math.PI / 2, 1], [-Math.PI / 2, -1]]) {
        const b = [];
        for (let w = zt0; w <= zt1 + 1e-9; w += Math.min(0.05, o.L1 / 400)) b.push(T(w, sg * profil(w, fi)));
        L(b, 'vid');
        L([T(zt0, sg * (o.rf1 - 0.3)), T(zt0, 0)], 'vid'); L([T(zt1, sg * (o.rf1 - 0.3)), T(zt1, 0)], 'vid');
      }
      L([T(zt0, o.rf1), T(zt1, o.rf1)], 'skr'); L([T(zt0, -o.rf1), T(zt1, -o.rf1)], 'skr');
      L([T(zt0 + ch, o.r1), T(zt1 - ch, o.r1)], 'osa'); L([T(zt0 + ch, -o.r1), T(zt1 - ch, -o.r1)], 'osa');
      if (cepy) for (const [a, b, c] of [[0, Jl, zt0 + 0.3], [Lw, Lw - Jl, zt1 - 0.3]]) {
        L([T(b, rc), T(a, rc), T(a, -rc), T(b, -rc)], 'vid');
        L([T(b, rc), T(c, o.rf1 - 0.3)], 'vid'); L([T(b, -rc), T(c, -(o.rf1 - 0.3))], 'vid');
      } else {
        const rd = o.rDiraSnek;
        L([T(0, rd), T(Lw, rd)], 'skr'); L([T(0, -rd), T(Lw, -rd)], 'skr');
      }
      L([T(-3, 0), T(Lw + 3, 0)], 'osa');
      kota(T(zt0, o.ra1), T(zt1, o.ra1), [0, -1], 6, `${f(o.L1, 1)}`);
      kota(T(wc - o.px / 2, o.ra1), T(wc + o.px / 2, o.ra1), [0, -1], 12, `px ${f(o.px, 3)}`);
      if (cepy) kota(T(0, -o.ra1), T(Lw, -o.ra1), [0, 1], 6, `${f(Lw, 1)}`);
      kota(T(Lw + 2, o.ra1), T(Lw + 2, -o.ra1), [1, 0], 6, `Ø ${f(2 * o.ra1)}`);
      kota(T(-2, o.r1), T(-2, -o.r1), [-1, 0], 4, `Ø ${f(2 * o.r1)}`);
      Tx(A.x, A.y + A.h + 2, `df1 = Ø ${f(2 * o.rf1)} (čárkovaně) · ${o.h > 0 ? 'pravý' : 'levý'} · ${o.z1} ${o.z1 === 1 ? 'chod' : o.z1 < 5 ? 'chody' : 'chodů'} · γ = ${f(o.ga * 180 / Math.PI, 2)}°`, 2.6);
    }

    /* ---------- 2) kolo – řez osou ---------- */
    {
      const A = { x: 14, y: 92, w: 82, h: 92 };
      const R = model ? model.R : null, b2 = o.b2, zTop = b2 / 2 + o.naboj;
      const rMax = Math.max(...Array.from({ length: 41 }, (_, i) => o.rPolotovar(-b2 / 2 + b2 * i / 40)));
      const [m, mt] = meritko(2 * rMax + 14, zTop + b2 / 2 + 10, A.w, A.h - 10);
      const cx = A.x + A.w / 2, cy = A.y + A.h / 2, T = (r, z) => [cx + r * m, cy - (z - o.naboj / 2) * m];
      Tx(A.x, A.y - 6, `Kolo – řez osou (${mt})`, 3.5);
      const zs = R ? R.zs : [-b2 / 2, b2 / 2];
      const pata = R ? R.rez.map(r => Math.min(...r)) : zs.map(() => o.rf2);
      const rd = o.rDiraKolo;
      for (const sg of [1, -1]) {
        const ob = [T(sg * rd, -b2 / 2)];
        for (let i = 0; i <= 40; i++) { const z = -b2 / 2 + b2 * i / 40; ob.push(T(sg * o.rPolotovar(z), z)); }
        if (o.naboj > 0) ob.push(T(sg * o.rNaboj, b2 / 2), T(sg * o.rNaboj, zTop));
        ob.push(T(sg * rd, zTop));
        L(ob, 'vid');
        L(zs.map((z, i) => T(sg * pata[i], z)), 'tenka');
        L([T(sg * rd, -b2 / 2), T(sg * rd, zTop)], 'vid');
        L([T(sg * o.r2, -b2 / 2 - 2), T(sg * o.r2, b2 / 2 + 2)], 'osa');
        // šrafy 45° v řezu věnce (obdélník mezi dírou a patou zubů)
        const [ax, ay] = T(sg * rd, b2 / 2), [bx, by] = T(sg * Math.min(...pata), -b2 / 2);
        srafy(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by));
      }
      if (p.kolo.pulky) L([T(-rMax - 2, 0), T(rMax + 2, 0)], 'tenka');
      L([T(0, -b2 / 2 - 4), T(0, zTop + 4)], 'osa');
      kota(T(-o.ra2, 0), T(o.ra2, 0), [0, -1], (b2 / 2 + o.naboj) * m + 6, `Ø ${f(2 * o.ra2)}`);
      kota(T(-rMax, -b2 / 2), T(rMax, -b2 / 2), [0, 1], 6, `Ø ${f(2 * rMax)}`);
      kota(T(rMax, -b2 / 2), T(rMax, b2 / 2), [1, 0], 5, `${f(b2, 1)}`);
      kota(T(-o.r2, -b2 / 2), T(o.r2, -b2 / 2), [0, 1], 13, `Ø ${f(2 * o.r2)}`);
      kota(T(-rd, zTop), T(rd, zTop), [0, -1], 4, `Ø ${f(2 * rd)}`);
      Tx(A.x, A.y + A.h, `df2 = Ø ${f(2 * o.rf2)} (tenká čára) · ${K.NAZVY.druh[p.kolo.druh]}${p.kolo.pulky ? ' z půlek' : ''}`, 2.6);
    }

    /* ---------- 3) schéma záběru – rozteč os ---------- */
    {
      const A = { x: 104, y: 92, w: 82, h: 92 };
      const sir = Math.max(2 * o.ra2 + 6, o.L1 + 6), vys = o.a + o.ra2 + o.ra1 + 6;
      const [m, mt] = meritko(sir, vys, A.w, A.h - 12);
      const cx = A.x + A.w / 2, cy = A.y + A.h - 10 - o.ra2 * m, T = (x, y) => [cx + x * m, cy - y * m];
      Tx(A.x, A.y - 6, `Záběr shora (${mt})`, 3.5);
      const kruh = (r, typ) => { const b = []; for (let i = 0; i <= 96; i++) { const u = 2 * Math.PI * i / 96; b.push(T(r * Math.cos(u), r * Math.sin(u))); } L(b, typ); };
      kruh(o.ra2, 'vid'); kruh(o.r2, 'osa'); kruh(o.rf2, 'tenka');
      const x0 = -o.L1 / 2, x1 = o.L1 / 2;
      L([T(x0, o.a + o.ra1), T(x1, o.a + o.ra1), T(x1, o.a - o.ra1), T(x0, o.a - o.ra1)], 'vid', true);
      L([T(x0 - 3, o.a), T(x1 + 3, o.a)], 'osa');
      L([T(x0, o.a - o.r1), T(x1, o.a - o.r1)], 'osa');
      L([T(0, -o.ra2 - 3), T(0, o.a + o.ra1 + 3)], 'osa');
      kota(T(0, 0), T(0, o.a), [1, 0], o.L1 / 2 * m + 6, `a = ${f(o.a, 2)}`);
      Tx(A.x, A.y + A.h, `a = (d1 + d2)/2${Math.abs(o.x2) > 1e-6 ? ' + x2·m' : ''} = ${f(o.a, 3)} mm`, 2.6);
    }

    /* ---------- tabulka, kusovník, popisové pole ---------- */
    const rx = 194, rw = W - OKRAJ - rx;
    const radky = [
      ['Modul osový m', f(o.m, 3) + ' mm'], ['Počet chodů z1', String(o.z1)], ['Počet zubů z2', String(o.z2)], ['Převod i', '1 : ' + f(o.i, 2)],
      ['Součinitel q', f(o.q, 2)], ['Úhel záběru α (osový)', f(p.zaber.uhel, 1) + '°'], ['Úhel stoupání γ', f(o.ga * 180 / Math.PI, 3) + '°'],
      ['Smysl stoupání', o.h > 0 ? 'pravý' : 'levý'], ['Rozteč os a', f(o.a, 3) + ' mm'], ['Posunutí kola x2', f(o.x2, 3)],
      ['Rozteč px / stoupání pz', `${f(o.px, 3)} / ${f(o.pz, 3)}`], ['Šnek d1 / da1 / df1', `${f(2 * o.r1)} / ${f(2 * o.ra1)} / ${f(2 * o.rf1)}`],
      ['Kolo d2 / da2 / df2', `${f(2 * o.r2)} / ${f(2 * o.ra2)} / ${f(2 * o.rf2)}`], ['Kolo – šířka b2', f(o.b2, 1) + ' mm'],
      ['Boční vůle j / hlavová c', `${f(o.j, 2)} / ${f(o.c, 2)} mm`], ['Profil šneku', 'ZA (archimedovský)'],
    ];
    let y = 18;
    Tx(rx, 14, 'Parametry ozubení', 3.5);
    L([[rx, y - 0.5], [rx + rw, y - 0.5]], 'tenka');
    for (const [a, b] of radky) { Tx(rx + 1, y + 3.3, a, 2.5); Tx(rx + rw - 1, y + 3.3, b, 2.5, 'r'); y += 4.6; L([[rx, y - 0.5], [rx + rw, y - 0.5]], 'kota'); }
    y += 5;
    Tx(rx, y, 'Kusovník', 3.5); y += 4;
    L([[rx, y - 0.5], [rx + rw, y - 0.5]], 'tenka');
    for (const [nazev, ks, pozn] of (opt.kusovnik || []).slice(0, 10)) {
      Tx(rx + 1, y + 3.3, `${ks}× ${nazev}`.slice(0, 44), 2.5); if (pozn) Tx(rx + rw - 1, y + 3.3, String(pozn).slice(0, 22), 2.3, 'r');
      y += 4.6; L([[rx, y - 0.5], [rx + rw, y - 0.5]], 'kota');
    }
    L([[OKRAJ, OKRAJ], [W - OKRAJ, OKRAJ], [W - OKRAJ, H - OKRAJ], [OKRAJ, H - OKRAJ]], 'vid', true);
    const by = H - OKRAJ - 22;
    L([[rx, by], [W - OKRAJ, by], [W - OKRAJ, H - OKRAJ], [rx, H - OKRAJ]], 'vid', true);
    L([[rx, by + 10], [W - OKRAJ, by + 10]], 'tenka');
    Tx(rx + 2, by + 7, (p.nazev || 'Šnekový převod').slice(0, 34), 4);
    Tx(rx + 2, by + 15, `Rozměry v mm · ${opt.datum || ''}`, 2.6);
    Tx(rx + 2, by + 20, 'github_site – Šnekový převod', 2.6);
    return { W, H, prvky };
  }

  /* ---------- výstupy ---------- */
  const n3 = x => (Math.round(x * 1000) / 1000).toString();
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dash = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(s * 8)} ${n3(s * 5)}"` : d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '');
  function svg(v, o = {}) {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${o.sirkaPx ? 'width="100%"' : `width="${v.W}mm" height="${v.H}mm"`} viewBox="0 0 ${v.W} ${v.H}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`
      + `<rect width="${v.W}" height="${v.H}" fill="#ffffff"/>`;
    for (const e of v.prvky) {
      if (e.t === 'l') s += `<path d="${e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(q[1])).join('')}${e.z ? 'Z' : ''}" fill="none" stroke="#000" stroke-width="${n3(e.s)}" stroke-linecap="round" stroke-linejoin="round"${dash(e.d, Math.max(0.2, e.s))}/>`;
      else {
        const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(e.y)})"` : '';
        s += `<text x="${n3(e.x)}" y="${n3(e.y)}" font-size="${n3(e.h)}" text-anchor="${an}" fill="#000"${rot}>${esc(e.txt)}</text>`;
      }
    }
    return s + '</svg>';
  }
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/[αγ]/g, c => ({ α: 'alfa', γ: 'gama' }[c]));
  function pdf(jsPDF, v, opt = {}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
    let uni = false;
    if (opt.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', opt.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
    doc.setProperties({ title: opt.nazev || 'Výkres', creator: 'Šnekový převod – výkres' });
    doc.setDrawColor(0, 0, 0); doc.setTextColor(0, 0, 0);
    for (const e of v.prvky) {
      if (e.t === 'txt') {
        const s = uni ? e.txt : bezDiakritiky(e.txt);
        doc.setFontSize(e.h / 0.3528);
        const w = doc.getTextWidth(s), kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0, ur = (e.u || 0) * Math.PI / 180;
        doc.text(s, e.x - Math.cos(ur) * kk, e.y + Math.sin(ur) * kk, e.u ? { angle: e.u } : undefined);
        continue;
      }
      doc.setLineWidth(e.s);
      const sd = Math.max(0.2, e.s);
      if (e.d === 'c') doc.setLineDashPattern([sd * 8, sd * 5], 0); else if (e.d === 'o') doc.setLineDashPattern([sd * 30, sd * 8, sd * 4, sd * 8], 0);
      if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
      else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
      if (e.d) doc.setLineDashPattern([], 0);
    }
    return doc;
  }

  const API = { vykres, svg, pdf };
  if (typeof module !== 'undefined') module.exports = API; else window.SNEK_VYK = API;
})();
