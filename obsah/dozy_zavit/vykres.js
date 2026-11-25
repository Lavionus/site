/* Dózy a víčka se závitem – výkres A4 naležato (bez DOM, běží i v node).
   Vlevo řez sestavou rovinou osy (pravá polovina v úhlu 0°, levá v 180° – závit je na obou stranách posunutý
   o půl stoupání, jak to ve skutečném řezu je), šrafy, kóty průměrů a výšek. Pod ním detail profilu závitu
   (vnější závit tlustě, vnitřní závit s vůlí tence) s kótami rozteče a hloubky. Vpravo parametry, kusovník, razítko.
   vykres(p, o, meta) → {W, H, prvky}; meta = {datum, kusovnik: [[název, ks, pozn.]], hmotnost, material}
   svg(v) → text SVG v mm; pdf(jsPDF, v, {pismo, nazev}) → dokument jsPDF. (Výstupy převzaty z civka_filamentu/vykres.js.) */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const K = uzel ? require('./jadro.js') : window.DOZY;
  const f = (x, d = 1) => K.fmt(x, d);
  const W0 = 297, H0 = 210, OK = 10;
  const MERITKA = [20, 10, 5, 2, 1, 0.5, 0.4, 0.25, 0.2, 0.1];
  const nazevM = m => (m >= 1 ? `${f(m, 2)} : 1` : `1 : ${f(1 / m, 2)}`);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);

  function vykres(p, o, meta = {}) {
    const prvky = [], Z = o.Z;
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
    /** Šrafy pod 45° (smer = 1) nebo 135° (smer = −1) uvnitř obrysu. */
    const srafy = (poly, krok, smer = 1) => {
      const q = poly.map(([x, y]) => [x - smer * y, x + smer * y]);
      const u0 = Math.min(...q.map(a => a[0])), u1 = Math.max(...q.map(a => a[0]));
      for (let u = Math.ceil(u0 / krok) * krok; u < u1; u += krok) {
        const xs = [];
        for (let i = 0; i < q.length; i++) {
          const [a1, b1] = q[i], [a2, b2] = q[(i + 1) % q.length];
          if ((a1 <= u && a2 > u) || (a2 <= u && a1 > u)) xs.push(b1 + (b2 - b1) * (u - a1) / (a2 - a1));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) L([[(u + xs[i]) / 2, smer * (xs[i] - u) / 2], [(u + xs[i + 1]) / 2, smer * (xs[i + 1] - u) / 2]], 0.13);
      }
    };

    /* ---------- řez sestavou ---------- */
    const A = { x: OK + 4, y: OK + 10, w: 132, h: 104 };
    const prava = K.rezy(p, o, 0), leva = K.rezy(p, o, Math.PI);
    const body = prava.flatMap(d => d.b), Rm = Math.max(...body.map(q => q[0])), z0 = Math.min(...body.map(q => q[1])), z1 = Math.max(...body.map(q => q[1]));
    const m = MERITKA.find(q => 2 * Rm * q + 44 <= A.w && (z1 - z0) * q + 30 <= A.h) || MERITKA[MERITKA.length - 1];
    const cx = A.x + A.w / 2, cy = A.y + A.h / 2 + (z0 + z1) / 2 * m;
    const F = (r, z) => [cx + r * m, cy - z * m];
    prava.forEach((d, i) => {
      for (const [dil, s] of [[d, 1], [leva[i], -1]]) {
        const pol = dil.b.map(([r, z]) => F(s * r, z));
        L(pol, d.kontext ? 0.25 : 0.5, true, d.kontext ? 'c' : undefined);
        if (!d.kontext) srafy(pol, i % 2 ? 2 : 1.4, i % 2 ? -1 : 1);
      }
    });
    L([F(0, z0 - 4 / m), F(0, z1 + 4 / m)], 0.18, false, 'o');
    const nazvy = { doza: 'Řez dózou s víčkem', vicko: 'Řez víčkem na hrdle (hrdlo čárkovaně)', hrdlo: 'Řez hrdlem', zatka: 'Řez zátkou (tisková poloha)', vzorek: 'Řez čepem s kroužkem' };
    T(A.x, A.y - 3, `${t(nazvy[p.druh])} · ${nazevM(m)}`, 3.4);
    const radky = [];
    const zav = Z.chodu > 1 ? `Ø ${f(Z.d, 2)} × ${f(Z.p, 2)} · počet chodů ${Z.chodu}, stoupání ${f(Z.lead, 2)}` : `Ø ${f(Z.d, 2)} × ${f(Z.p, 2)} · jednochodý`;
    kota(F(-Z.rMaj, o.zT + Z.L * 0.5), F(Z.rMaj, o.zT + Z.L * 0.5), 0, `Ø ${f(Z.d, 2)}`);
    if (p.druh === 'doza') {
      kota(F(-o.Ri, o.H * 0.35), F(o.Ri, o.H * 0.35), 0, `Ø ${f(2 * o.Ri, 1)}`);
      kota(F(-o.RL, o.top), F(o.RL, o.top), 6, `Ø ${f(2 * o.RL, 1)}`);
      kota(F(-o.Ro, 0), F(o.Ro, 0), -6, `Ø ${f(2 * o.Ro, 1)}`);
      kota(F(o.RL, 0), F(o.RL, o.top), -8, f(o.top, 1));
      kota(F(-o.RL, 0), F(-o.RL, o.H), 8, f(o.H, 1));
      kota(F(-o.RL, o.zT), F(-o.RL, o.H), 15, f(Z.L, 1));
      radky.push(['Dutina dózy', `Ø ${f(2 * o.Ri, 1)} × ${f(o.hv, 1)} mm = ${f(o.objem, 0)} ml`], ['Stěna / dno', `${f(p.doza.stena, 1)} / ${f(p.doza.dno, 1)} mm`], ['Plášť dózy', K.NAZVY.plast[p.doza.plast]]);
    } else if (p.druh === 'vicko') {
      kota(F(-o.RL, o.top), F(o.RL, o.top), 6, `Ø ${f(2 * o.RL, 1)}`);
      kota(F(o.RL, o.zOpen), F(o.RL, o.top), -8, f(o.top - o.zOpen, 1));
      radky.push(['Hrdlo', Z.db ? Z.db.nazev : 'vlastní rozměr']);
      if (Z.db) radky.push(['Rozměry hrdla', K.OVERIT]);
    } else {
      kota(F(-Rm, z0), F(Rm, z0), -6, `Ø ${f(2 * Rm, 1)}`);
      kota(F(Rm, z0), F(Rm, z1), -8, f(z1 - z0, 1));
      kota(F(-Rm, o.zT), F(-Rm, o.zT + (p.druh === 'vzorek' ? o.Lc : Z.L)), 8, f(p.druh === 'vzorek' ? o.Lc : Z.L, 1));
      if (p.druh === 'hrdlo') radky.push(['Hrdlo', `otvor Ø ${f(2 * o.ri, 1)}, příruba Ø ${f(2 * o.Rp, 1)} × ${f(o.tp, 1)}`]);
    }
    radky.push(['Závit', zav], ['Vnější závit', `Ø ${f(Z.d, 2)} / jádro Ø ${f(2 * Z.rMin, 2)}`]);
    if (p.druh !== 'hrdlo' && p.druh !== 'zatka') radky.push(['Vnitřní závit', `Ø ${f(2 * o.PI.rMaj, 2)} / Ø ${f(2 * (o.PI.rMaj - Z.h), 2)} (vůle ${f(p.zavit.vule, 2)} na poloměr)`]);
    radky.push(['Profil závitu', Z.soumerny ? `hloubka ${f(Z.h, 2)}, boky ${f(Z.bok, 0)}°, hřbet ${f(Z.wc, 2)} mm` : `hloubka ${f(Z.h, 2)}, boky ${f(Z.bok, 0)}° / ${f(Z.bok2, 0)}°, hřbet ${f(Z.wc, 2)} mm`], ['Výška závitu', `${f(Z.L, 1)} mm, náběh ${f(o.nabeh, 1)} mm`]);
    if (o.otacek !== undefined) radky.push(['Zavření', `${f(o.otacek, 2)} otáčky (${f(o.otacek * 360, 0)}°)`]);
    if (o.oring) radky.push(['Těsnění', `O-kroužek Ø ${f(2 * o.oring.rg0, 1)} × ${f(o.oring.d2, 1)}, drážka ${f(o.oring.bg, 2)} × ${f(o.oring.hg, 2)}`]);
    if (o.ploche) radky.push(['Těsnění', `ploché Ø ${f(o.ploche.D, 1)} / ${f(o.ploche.d, 1)} × ${f(o.ploche.t, 1)}`]);

    /* ---------- detail profilu závitu ---------- */
    {
      const B = { x: OK + 4, y: 136, w: 132, h: 44 }, v = p.druh === 'hrdlo' || p.druh === 'zatka' ? 0 : (p.druh === 'vzorek' ? o.vule[o.iStred] : p.zavit.vule);
      const PI = K.profil(Z, v), n = 2.5, md = MERITKA.find(q => n * Z.p * q <= B.w - 40 && (Z.h + v + 1.5) * q <= B.h - 16) || 1;
      const x0 = B.x + 6, yb = B.y + B.h - 6;                         // osa z vodorovně, poloměr nahoru
      const D = (z, r) => [x0 + (z + 0.25 * Z.p) * md, yb - (r - Z.rMin + 0.8) * md];
      const cara = P => { const b = []; for (let i = 0; i <= 300; i++) { const z = -0.25 * Z.p + n * Z.p * i / 300; b.push(D(z, K.polomer(z, P))); } return b; };
      const ext = cara(o.PE);
      L(ext, 0.5);
      const dole = [D(-0.25 * Z.p, Z.rMin - 0.8), D((n - 0.25) * Z.p, Z.rMin - 0.8)];
      srafy(ext.concat([dole[1], dole[0]]), 1.4);
      if (p.druh !== 'hrdlo' && p.druh !== 'zatka') L(cara(PI), 0.25);
      kota(D(0, Z.rMaj), D(Z.p, Z.rMaj), 5 + v * md, `P ${f(Z.p, 2)}`);
      kota(D((n - 0.25) * Z.p, Z.rMin), D((n - 0.25) * Z.p, Z.rMaj), -5, f(Z.h, 2));
      T(B.x, B.y - 1, `Detail profilu závitu · ${nazevM(md)}`, 3);
      T(B.x + B.w, B.y - 1, `nosný bok ${f(Z.bok, 0)}° je vlevo od hřbetu`, 2.3, 'r');
      if (p.druh !== 'hrdlo' && p.druh !== 'zatka') T(B.x + B.w, B.y + 2.5, `tence: vnitřní závit s vůlí ${f(v, 2)} mm`, 2.3, 'r');
    }

    /* ---------- parametry ---------- */
    let y = 22;
    T(154, y - 4, 'Parametry dílu', 3.2);
    const mat = meta.material || p.tisk.material;
    radky.push(['Materiál', `${mat}${meta.hmotnost ? `, ${f(meta.hmotnost, 0)} g` : ''}`]);
    for (const [a, b] of radky) { y += 5; T(154, y, a, 2.5); T(285, y, b, 2.4, 'r'); L([[152, y + 1.3], [287, y + 1.3]], 0.12); }

    /* ---------- kusovník ---------- */
    let yk = Math.max(y + 10, 84);
    T(154, yk, 'Kusovník', 3.2); yk += 1.5;
    const kus = (meta.kusovnik || []).slice(0, Math.floor((H0 - OK - 24 - yk) / 4.4));
    for (const [nz, ks, pz] of kus) { yk += 4.4; T(161, yk, `${ks}×`, 2.5, 'r'); T(163, yk, String(nz).slice(0, 56), 2.3); if (pz) T(285, yk, String(pz).slice(0, 34), 2, 'r'); L([[152, yk + 1.2], [287, yk + 1.2]], 0.12); }

    /* ---------- rám, razítko, kontrolní úsečka ---------- */
    L([[OK, OK], [W0 - OK, OK], [W0 - OK, H0 - OK], [OK, H0 - OK]], 0.5, true);
    const rx = W0 - OK - 135, ry = H0 - OK - 22;
    L([[rx, ry], [W0 - OK, ry], [W0 - OK, H0 - OK], [rx, H0 - OK]], 0.5, true);
    L([[rx, ry + 10], [W0 - OK, ry + 10]], 0.25); L([[rx + 85, ry], [rx + 85, H0 - OK]], 0.25);
    T(rx + 2, ry + 7, (p.nazev || 'Dóza').slice(0, 44), 4);
    T(rx + 2, ry + 15.5, 'Dózy a víčka se závitem', 2.6);
    T(rx + 87, ry + 7, meta.datum || '', 2.6);
    T(rx + 87, ry + 15.5, 'rozměry v mm · list 1/1', 2.6);
    const kx = OK + 4, ky = H0 - OK - 4, dl = Math.min(50 * m, 120);
    L([[kx, ky], [kx + dl, ky]], 0.35); L([[kx, ky - 1.5], [kx, ky + 1]], 0.25); L([[kx + dl, ky - 1.5], [kx + dl, ky + 1]], 0.25);
    T(kx + dl + 2, ky + 1, `= ${f(dl / m, 0)} mm v řezu (kontrola měřítka)`, 2.3);
    return { W: W0, H: H0, meritko: nazevM(m), prvky };
  }

  /* ---------- výstupy ---------- */
  const n3 = x => (Math.round(x * 1000) / 1000).toString();
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dash = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(s * 8 + 1)} ${n3(s * 5 + 0.6)}"` : d === 'o' ? ` stroke-dasharray="${n3(6)} ${n3(1.2)} ${n3(1)} ${n3(1.2)}"` : '');
  function svg(v) {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${v.W}mm" height="${v.H}mm" viewBox="0 0 ${v.W} ${v.H}" font-family="Liberation Sans, Arial, Helvetica, sans-serif"><rect width="${v.W}" height="${v.H}" fill="#ffffff"/>`;
    for (const e of v.prvky) {
      if (e.t === 'l') s += `<path d="${e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(q[1])).join('')}${e.z ? 'Z' : ''}" fill="none" stroke="#000" stroke-width="${n3(e.s)}" stroke-linecap="round" stroke-linejoin="round"${dash(e.d, e.s)}/>`;
      else {
        const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(e.y)})"` : '';
        s += `<text x="${n3(e.x)}" y="${n3(e.y)}" font-size="${n3(e.h)}" text-anchor="${an}" fill="#000"${rot}>${esc(e.txt)}</text>`;
      }
    }
    return s + '</svg>';
  }
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x');
  function pdf(jsPDF, v, opt = {}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
    let uni = false;
    if (opt.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', opt.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
    doc.setProperties({ title: opt.nazev || 'Výkres', creator: 'Dózy a víčka se závitem – výkres' });
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
      if (e.d === 'c') doc.setLineDashPattern([e.s * 8 + 1, e.s * 5 + 0.6], 0); else if (e.d === 'o') doc.setLineDashPattern([6, 1.2, 1, 1.2], 0);
      if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
      else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
      if (e.d) doc.setLineDashPattern([], 0);
    }
    return doc;
  }

  const API = { vykres, svg, pdf, MERITKA };
  if (uzel) module.exports = API; else window.DOZY_VYK = API;
})();
