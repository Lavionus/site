/* Samozavlažovací květináče – výkres A4 naležato (bez DOM, běží i v node).
   Vlevo řez sestavou svislou rovinou osou (směr plnění – přepad): šrafované stěny, hladina přepadu, úroveň substrátu, kóty průměrů a výšek.
   Vpravo parametry, objemy a kusovník, dole razítko a kontrolní úsečka.
   vykres(p, model, meta) → {W, H, meritko, prvky}; meta = {datum, vypocty (z KVET.vypocty), kusovnik: [[název, ks, pozn.]]}
   svg(v) → text SVG v mm; pdf(jsPDF, v, {pismo, nazev}) → dokument jsPDF. */
/* global I18N */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const K = uzel ? require('./jadro.js') : window.KVET;
  const f = (x, d = 1) => K.fmt(x, d);
  const W0 = 297, H0 = 210, OK = 10;
  const MERITKA = [2, 1, 0.5, 0.4, 0.25, 0.2, 0.1];
  const nazevM = m => (m >= 1 ? `${f(m, 2)} : 1` : `1 : ${f(1 / m, 2)}`);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);

  /** Řez sítě svislou rovinou procházející osou Z ve směru th: uzavřené smyčky [[u, z]], u = vodorovná souřadnice v rovině. */
  function rezSite(d, th, posun = 0.0137) {
    const P = d.poz, I = d.idx, c = Math.cos(th), s = Math.sin(th), bod = new Map(), sous = new Map();
    const vzd = i => -P[3 * i] * s + P[3 * i + 1] * c - posun;
    const klic = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
    const pr = (a, b) => {
      const kl = klic(a, b);
      if (!bod.has(kl)) { const da = vzd(a), db = vzd(b), q = da / (da - db), x = P[3 * a] + (P[3 * b] - P[3 * a]) * q, y = P[3 * a + 1] + (P[3 * b + 1] - P[3 * a + 1]) * q; bod.set(kl, [x * c + y * s, P[3 * a + 2] + (P[3 * b + 2] - P[3 * a + 2]) * q]); }
      return kl;
    };
    const pridej = (x, y) => { if (!sous.has(x)) sous.set(x, []); sous.get(x).push(y); };
    for (let i = 0; i < I.length; i += 3) {
      const v = [I[i], I[i + 1], I[i + 2]], z = v.map(q => vzd(q) > 0), hr = [];
      for (let j = 0; j < 3; j++) if (z[j] !== z[(j + 1) % 3]) hr.push(pr(v[j], v[(j + 1) % 3]));
      if (hr.length === 2) { pridej(hr[0], hr[1]); pridej(hr[1], hr[0]); }
    }
    const navst = new Set(), smycky = [];
    for (const start of sous.keys()) {
      if (navst.has(start)) continue;
      const sm = [];
      let cur = start, pred = null;
      while (cur && !navst.has(cur)) { navst.add(cur); sm.push(bod.get(cur)); const n = (sous.get(cur) || []).find(x => x !== pred && !navst.has(x)); pred = cur; cur = n; }
      if (sm.length > 2) smycky.push(sm);
    }
    return smycky;
  }

  function vykres(p, model, meta = {}) {
    const o = model.o, prvky = [];
    const L = (b, s = 0.35, z = false, d) => prvky.push({ t: 'l', b, s, z, d });
    const T = (x, y, txt, h = 2.8, a = 'l', u = 0) => prvky.push({ t: 'txt', x, y, h, txt: t(String(txt)), a, u });
    const kota = (P1, P2, od, txt) => {
      const dx = P2[0] - P1[0], dy = P2[1] - P1[1], l = Math.hypot(dx, dy);
      if (l < 0.3) return;
      const ux = dx / l, uy = dy / l, nx = uy, ny = -ux;
      const A = [P1[0] + nx * od, P1[1] + ny * od], B = [P2[0] + nx * od, P2[1] + ny * od], sg = Math.sign(od) || 1;
      L([[P1[0] + nx * sg, P1[1] + ny * sg], [A[0] + nx * sg * 1.5, A[1] + ny * sg * 1.5]], 0.18);
      L([[P2[0] + nx * sg, P2[1] + ny * sg], [B[0] + nx * sg * 1.5, B[1] + ny * sg * 1.5]], 0.18);
      L([A, B], 0.18);
      const sip = (Q, s) => L([[Q[0] + s * (ux * 2.2 - uy * 0.7), Q[1] + s * (uy * 2.2 + ux * 0.7)], Q, [Q[0] + s * (ux * 2.2 + uy * 0.7), Q[1] + s * (uy * 2.2 - ux * 0.7)]], 0.18);
      sip(A, 1); sip(B, -1);
      let uhel = Math.atan2(-uy, ux) * 180 / Math.PI;
      if (uhel > 90.5 || uhel <= -89.5) uhel += 180;
      if (uhel > 180) uhel -= 360;
      const ur = uhel * Math.PI / 180, nah = [-Math.sin(ur), -Math.cos(ur)], kr = l < 10;
      const Mq = kr ? [B[0] + ux * 3, B[1] + uy * 3] : [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      T(Mq[0] + nah[0] * 0.8, Mq[1] + nah[1] * 0.8, txt, 2.6, kr ? 'l' : 'c', uhel);
    };
    /** Šrafy ±45° uvnitř obrysů jednoho dílu (sudý–lichý: dutiny se nešrafují). */
    const srafy = (polys, krok, sm) => {
      const Q = polys.map(poly => poly.map(([x, y]) => [x - sm * y, x + sm * y]));
      const vse = Q.flat();
      if (!vse.length) return;
      const u0 = Math.min(...vse.map(a => a[0])), u1 = Math.max(...vse.map(a => a[0]));
      for (let u = Math.ceil(u0 / krok) * krok; u < u1; u += krok) {
        const xs = [];
        for (const q of Q) for (let i = 0; i < q.length; i++) {
          const [a1, b1] = q[i], [a2, b2] = q[(i + 1) % q.length];
          if ((a1 <= u && a2 > u) || (a2 <= u && a1 > u)) xs.push(b1 + (b2 - b1) * (u - a1) / (a2 - a1));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) L([[(u + xs[i]) / 2, sm * (xs[i] - u) / 2], [(u + xs[i + 1]) / 2, sm * (xs[i + 1] - u) / 2]], 0.13);
      }
    };

    /* ---------- řez ---------- */
    const th = (o.t0 || 0) * Math.PI / 180;
    const rezy = model.sestava.map(d => ({ d, sm: rezSite(d, th) })).filter(x => x.sm.length);
    const body = rezy.flatMap(x => x.sm.flat());
    const u0 = Math.min(...body.map(b => b[0])), u1 = Math.max(...body.map(b => b[0])), z0 = Math.min(...body.map(b => b[1])), z1 = Math.max(...body.map(b => b[1]));
    const A = { x: OK + 4, y: OK + 12, w: 148, h: 150 }, okr = { l: 30, r: 24, t: 14, b: 16 };
    const m = MERITKA.find(q => (u1 - u0) * q <= A.w - okr.l - okr.r && (z1 - z0) * q <= A.h - okr.t - okr.b) || MERITKA[MERITKA.length - 1];
    const cx = A.x + okr.l + (A.w - okr.l - okr.r - (u1 - u0) * m) / 2 - u0 * m, cy = A.y + okr.t + (A.h - okr.t - okr.b - (z1 - z0) * m) / 2 + z1 * m;
    const B = (u, z) => [cx + u * m, cy - z * m];
    rezy.forEach((x, i) => {
      const polys = x.sm.map(sm => sm.map(q => B(q[0], q[1])));
      if (x.d.kontext) { for (const q of polys) L(q, 0.25, true, 'c'); return; }
      srafy(polys, 1.6, i % 2 ? -1 : 1);
      for (const q of polys) L(q, 0.4, true);
    });
    L([B(0, z1 + 5 / m), B(0, z0 - 4 / m)], 0.18, false, 'o');
    T(A.x, A.y - 4, `${t(o.N === 4 ? 'Řez osou úhlopříčně' : 'Řez osou')} · ${nazevM(m)}`, 3.2);   // u čtverce jsou šachta i přepad v rozích

    /* ---------- kóty a hladiny ---------- */
    const radky = [], N = K.NAZVY, v = meta.vypocty || {};
    const prumer = (z, e) => [-o.rho(z, e, th + Math.PI), o.rho(z, e, th)];
    if (p.druh !== 'podmiska') {
      const ven = z => -o.stenaV(z), [a0, a1] = prumer(o.H, ven(o.H)), [b0, b1] = prumer(0, ven(0));
      kota(B(a0, z1), B(a1, z1), 7, (o.kulaty ? 'Ø ' : '') + f(a1 - a0));
      kota(B(b0, z0), B(b1, z0), -7, (o.kulaty ? 'Ø ' : '') + f(b1 - b0));
      kota(B(u1, 0), B(u1, o.H), -8, f(o.H));
      if (o.maVlozku) {
        const [i0, i1] = prumer(o.zHl, 0);
        L([B(i0, o.zHl), B(i1, o.zHl)], 0.25, false, 'c');
        T(B(i1, o.zHl)[0] - 1, B(0, o.zHl)[1] - 1, 'max. hladina', 2.3, 'r');
        kota(B(u0, o.zDno), B(u0, o.zHl), 8, f(o.zHl - o.zDno));
        kota(B(u0, o.zDno), B(u0, o.zK), 16, f(o.zK - o.zDno));
        if (o.noha) T(B(o.rk, 0)[0] + 1.5, B(0, (o.zN + o.zK) / 2)[1] + 1, 'Ø ' + f(2 * o.rk), 2.3);
      }
      if (o.zSub) {
        const e = o.maVlozku ? o.eIn(o.zSub) : 0, [s0, s1] = prumer(o.zSub, e);
        L([B(s0, o.zSub), B(s1, o.zSub)], 0.2, false, 'c');
        T(B(0, o.zSub)[0] + 2, B(0, o.zSub)[1] - 1, 'substrát', 2.3);
      }
    } else {
      const D = o.pod, a = K.rho(o.N, D.S(D.dno, false).a, D.S(D.dno, false).rc, th);
      kota(B(-a, z0), B(a, z0), -7, (o.kulaty ? 'Ø ' : '') + f(2 * a) + ' ' + t('uvnitř'));
      kota(B(u1, z0), B(u1, z1), -8, f(z1 - z0));
    }

    /* ---------- parametry ---------- */
    radky.push(['Druh', t(N.druh[p.druh])]);
    radky.push(['Tvar', t(N.tvar[p.plast.tvar]) + (o.N > 4 ? ` (${o.N})` : '')]);
    if (o.maNadobu) {
      radky.push(['Plášť vně', `${f(2 * o.Rh)} / ${f(2 * o.Rd)} × ${f(o.H)} mm`]);
      radky.push(['Stěna / dno', `${f(o.t, 2)} / ${f(o.zDno, 2)} mm`]);
      radky.push(['Povrch', t(N.povrch[o.povrch])]);
    }
    if (p.druh === 'vlozka') radky.push(['Obal uvnitř', `${f(p.obal.prumerH)} / ${f(p.obal.prumerD)} × ${f(p.obal.vyska)} mm`]);
    if (o.maVlozku) {
      radky.push(['Vložka', `${t('stěna')} ${f(o.tv, 2)} · ${t('vůle')} ${f(o.eOut, 2)} mm · ${t(N.ulozeni[o.lem ? 'lem' : 'nozky'])}`]);
      radky.push(['Vzlínání', o.noha ? `${t('noha')} Ø ${f(2 * o.rk)} mm` : `${p.knot.pocet}× ${t('knot')} Ø ${f(p.knot.prumer)} mm`]);
      radky.push(['Max. hladina', `${f(o.zHl - o.zDno)} mm ${t('nade dnem')}` + (o.prepad ? ` · ${t('přepad')} Ø ${f(2 * o.prepad.r)}` : '')]);
      radky.push(['Dno vložky nad hladinou', `${f(o.zK - o.zHl)} mm`]);
      radky.push(['Plnění / vodoznak', `${t(N.plneni[o.plneni])} / ${t(N.vodoznak[o.vodoznak])}`]);
    }
    if (o.pod) radky.push(['Podmiska', `${f(2 * o.pod.a0)} × ${f(o.pod.h)} mm · ${t('vůle')} ${f(p.podmiska.vule)} mm`]);
    if (v.substrat) radky.push(['Substrát', `${f(v.substrat / 1e6, 2)} l`]);
    if (v.voda) { radky.push(['Zásoba vody', `${f(v.voda / 1000, 0)} ml`]); radky.push(['Výdrž zásoby', `≈ ${f(v.vydrz, 0)} ${t('dní při')} ${f(v.spotreba, 0)} ml/${t('den')}`]); }
    if (v.mCelkem) radky.push(['Hmotnost naplněného', `≈ ${f(v.mCelkem / 1000, 2)} kg`]);
    radky.push(['Materiál', (meta.material || '') + ` · ${t('převis do')} ${f(p.tisk.uhel, 0)}°`]);
    let y = OK + 8;
    T(170, y, 'Parametry', 3.2); y += 1.5;
    for (const [a, b] of radky) { y += 5; T(170, y, a, 2.5); T(285, y, b.length > 62 ? b.slice(0, 61) + '…' : b, 2.4, 'r'); L([[168, y + 1.3], [287, y + 1.3]], 0.12); }

    /* ---------- kusovník ---------- */
    let yk = y + 10;
    T(170, yk, 'Kusovník', 3.2); yk += 1.5;
    for (const [n, ks, pz] of (meta.kusovnik || []).slice(0, Math.floor((H0 - OK - 26 - yk) / 4.4))) { yk += 4.4; T(177, yk, `${ks}×`, 2.5, 'r'); T(179, yk, String(n).slice(0, 50), 2.3); if (pz) T(285, yk, String(pz).slice(0, 30), 2, 'r'); L([[168, yk + 1.2], [287, yk + 1.2]], 0.12); }

    /* ---------- rám, razítko, kontrolní úsečka ---------- */
    L([[OK, OK], [W0 - OK, OK], [W0 - OK, H0 - OK], [OK, H0 - OK]], 0.5, true);
    const rx = W0 - OK - 119, ry = H0 - OK - 22;
    L([[rx, ry], [W0 - OK, ry], [W0 - OK, H0 - OK], [rx, H0 - OK]], 0.5, true);
    L([[rx, ry + 10], [W0 - OK, ry + 10]], 0.25); L([[rx + 75, ry], [rx + 75, H0 - OK]], 0.25);
    T(rx + 2, ry + 7, (p.nazev || 'Květináč').slice(0, 40), 4);
    T(rx + 2, ry + 15.5, 'Samozavlažovací květináče', 2.6);
    T(rx + 77, ry + 7, meta.datum || '', 2.6);
    T(rx + 77, ry + 15.5, 'rozměry v mm · list 1/1', 2.6);
    const kx = OK + 4, ky = H0 - OK - 4, dl = 50 * m;
    L([[kx, ky], [kx + dl, ky]], 0.35); L([[kx, ky - 1.5], [kx, ky + 1]], 0.25); L([[kx + dl, ky - 1.5], [kx + dl, ky + 1]], 0.25);
    T(kx + dl + 2, ky + 1, '= 50 mm v řezu (kontrola měřítka)', 2.3);
    return { W: W0, H: H0, meritko: nazevM(m), prvky };
  }

  /* ---------- výstupy ---------- */
  const n3 = x => (Math.round(x * 1000) / 1000).toString();
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const carky = (d, s) => (d === 'c' ? [s * 8 + 1, s * 5 + 0.6] : d === 'o' ? [6, 1.2, 1, 1.2] : null);
  function svg(v) {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${v.W}mm" height="${v.H}mm" viewBox="0 0 ${v.W} ${v.H}" font-family="Liberation Sans, Arial, Helvetica, sans-serif"><rect width="${v.W}" height="${v.H}" fill="#ffffff"/>`;
    for (const e of v.prvky) {
      if (e.t === 'l') {
        const c = carky(e.d, e.s);
        s += `<path d="${e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(q[1])).join('')}${e.z ? 'Z' : ''}" fill="none" stroke="#000" stroke-width="${n3(e.s)}" stroke-linecap="round" stroke-linejoin="round"${c ? ` stroke-dasharray="${c.map(n3).join(' ')}"` : ''}/>`;
      } else {
        const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(e.y)})"` : '';
        s += `<text x="${n3(e.x)}" y="${n3(e.y)}" font-size="${n3(e.h)}" text-anchor="${an}" fill="#000"${rot}>${esc(e.txt)}</text>`;
      }
    }
    return s + '</svg>';
  }
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/≈/g, '~').replace(/…/g, '...');
  function pdf(jsPDF, v, opt = {}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
    let uni = false;
    if (opt.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', opt.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
    doc.setProperties({ title: opt.nazev || 'Výkres', creator: 'Samozavlažovací květináče – výkres' });
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
      const c = carky(e.d, e.s);
      if (c) doc.setLineDashPattern(c, 0);
      if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
      else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
      if (c) doc.setLineDashPattern([], 0);
    }
    return doc;
  }

  const API = { vykres, svg, pdf, rezSite, MERITKA };
  if (uzel) module.exports = API; else window.KVET_VYK = API;
})();
