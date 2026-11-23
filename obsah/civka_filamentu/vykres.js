/* Držák a adaptér cívky filamentu – výkres A4 naležato (bez DOM, běží i v node).
   Redukce: řez osou (pravá polovina, šrafy, kapsa ložiska, kóty průměrů a výšek; dvoudílná = díly A a B).
   Stojan: bočnice zboku s cívkou, ložisky a kótami (rozteč ložisek, výška osy, cívka nad stolem a nad lištou).
   Vodítko: bokorys s otvorem a dírami pro šrouby.
   Vpravo parametry, dole kusovník a razítko, kontrolní úsečka 50 mm.
   vykres(p, o, meta) → {W, H, prvky}; meta = {datum, kusovnik: [[název, ks, pozn.]], obrysy (z postav), hmotnost, material}
   svg(v) → text SVG v mm; pdf(jsPDF, v, {pismo, nazev}) → dokument jsPDF. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const K = uzel ? require('./jadro.js') : window.CIVKA;
  const f = (x, d = 1) => K.fmt(x, d);
  const W0 = 297, H0 = 210, OK = 10;
  const MERITKA = [5, 2, 1, 0.5, 0.4, 0.25, 0.2, 0.1];
  const nazevM = m => (m >= 1 ? `${f(m, 2)} : 1` : `1 : ${f(1 / m, 2)}`);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);

  function vykres(p, o, meta = {}) {
    const prvky = [];
    const L = (b, s = 0.35, z = false, d) => prvky.push({ t: 'l', b, s, z, d });
    const Kr = (x, y, r, s = 0.35, d) => prvky.push({ t: 'k', x, y, r, s, d });
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
    /** Šrafy 45° uvnitř jednoho nebo více obrysů (sudý–lichý: díry se nešrafují). */
    const srafy = (polys, krok) => {
      if (typeof polys[0][0] === 'number') polys = [polys];
      const Q = polys.map(poly => poly.map(([x, y]) => [x - y, x + y]));
      const vse = Q.flat();
      const u0 = Math.min(...vse.map(a => a[0])), u1 = Math.max(...vse.map(a => a[0]));
      for (let u = Math.ceil(u0 / krok) * krok; u < u1; u += krok) {
        const xs = [];
        for (const q of Q) for (let i = 0; i < q.length; i++) {
          const [a1, b1] = q[i], [a2, b2] = q[(i + 1) % q.length];
          if ((a1 <= u && a2 > u) || (a2 <= u && a1 > u)) xs.push(b1 + (b2 - b1) * (u - a1) / (a2 - a1));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) L([[(u + xs[i]) / 2, (xs[i] - u) / 2], [(u + xs[i + 1]) / 2, (xs[i + 1] - u) / 2]], 0.13);
      }
    };
    const A = { x: OK + 4, y: OK + 10, w: 132, h: 104 };
    let mHl = 1;
    const radky = [];

    if (p.druh === 'redukce') {
      /* ---------- řez redukcí: osa svisle, příruba dole ---------- */
      // řez z modelu (mezi paprsky, s dutinou), jinak plný řez z parametrů zrcadlený na obě strany
      const r = p.redukce, rz = (meta.obrysy && meta.obrysy.rezy) || [];
      const plny = rez => [rez.map(([a, z]) => [a, z]), rez.map(([a, z]) => [-a, z])];
      const dily = r.dvoudilna ? [['A', rz[0] || plny(K.rezRedukce(o, o.HA))], ['B', rz[1] || plny(K.rezRedukce(o, o.HB, o.HBs))]] : [['', rz[0] || plny(K.rezRedukce(o, o.H))]];
      const MEZ = 34, sirka = dily.length * 2 * o.Rp + (dily.length - 1) * MEZ, vyska = Math.max(...dily.map(d => Math.max(...d[1].flat().map(q => q[1]))));
      const m = mHl = MERITKA.find(q => (sirka + 30) * q <= A.w && (vyska + 16) * q <= A.h - 8) || MERITKA[MERITKA.length - 1];
      dily.forEach(([jm, rez], i) => {
        const cx = A.x + A.w / 2 + (i - (dily.length - 1) / 2) * (2 * o.Rp + MEZ) * m, cy = A.y + A.h / 2 + vyska * m / 2;
        const Pp = (rr, z) => [cx + rr * m, cy - z * m];
        const Hd = Math.max(...rez.flat().map(q => q[1]));
        const polys = rez.map(b => b.map(([rr, z]) => Pp(rr, z)));
        for (const b of polys) L(b, 0.5, true);
        srafy(polys, 1.4);
        for (const s of [1, -1]) {
          if (o.L) { const b = [Pp(s * o.L.d / 2, 0), Pp(s * o.L.D / 2, 0), Pp(s * o.L.D / 2, o.L.B), Pp(s * o.L.d / 2, o.L.B)]; L(b, 0.3, true); L([b[0], b[2]], 0.18); L([b[1], b[3]], 0.18); }
        }
        L([Pp(0, -4 / m), Pp(0, Hd + 4 / m)], 0.18, false, 'o');
        kota(Pp(-o.Rp, 0), Pp(o.Rp, 0), -6, `Ø ${f(2 * o.Rp, 1)}`);
        kota(Pp(-o.R, Hd), Pp(o.R, Hd), 6, `Ø ${f(2 * o.R, 2)}`);
        kota(Pp(o.Rp, 0), Pp(o.Rp, Hd), -6, f(Hd, 1));
        if (!i) kota(Pp(-o.Rp, 0), Pp(-o.Rp, o.tp), 6, f(o.tp, 1));
        if (o.L) kota(Pp(-o.rk, 0), Pp(o.rk, 0), -13, `Ø ${f(2 * o.rk, 2)}`);
        else kota(Pp(-o.rb, Hd * 0.6), Pp(o.rb, Hd * 0.6), 0, `Ø ${f(2 * o.rb, 2)}`);
        if (jm) T(cx, A.y + 4, `Díl ${jm}`, 3, 'c');
      });
      T(A.x, A.y - 3, `Řez redukcí osou · ${nazevM(m)}`, 3.4);
      radky.push(['Otvor cívky', `Ø ${f(p.civka.otvor, 1)} (typické – ověřit měřením)`], ['Redukce', `Ø ${f(2 * o.R, 2)} (vůle ${f(r.vule, 2)}), příruba Ø ${f(2 * o.Rp, 1)} × ${f(o.tp, 1)}`],
        ['Uložení', o.L ? `${o.L.o}: kapsa Ø ${f(2 * o.rk, 2)} × ${f(o.L.B, 1)}, průchod Ø ${f(2 * o.rb, 1)}` : `trn Ø ${f(p.ulozeni.trn, 1)}, otvor Ø ${f(2 * o.rb, 2)}`],
        ['Sevření', K.NAZVY.sevreni[r.sevreni] + (r.sevreni === 'zebra' ? `, ${r.zeber}× ${f(r.vyskaZebra, 2)} mm` : r.sevreni === 'pera' ? `, ${r.per}× výstupek ${f(r.presahPer, 2)}` : '')],
        ['Provedení', r.dvoudilna ? `dvoudílná A + B, překryv ${f(r.prekryv)} mm` : `${r.kusu} ks, hloubka v cívce ${f(r.hloubka)} mm`]);
    } else if (p.druh === 'stojan') {
      /* ---------- bočnice zboku s cívkou ---------- */
      const Rc = o.Rc, sir = 2 * Math.max(o.e + o.rBoss, Rc) + 20, vys = o.zc + Rc + 8;
      const m = mHl = MERITKA.find(q => sir * q <= A.w && vys * q <= A.h - 6) || MERITKA[MERITKA.length - 1];
      const cx = A.x + A.w / 2, cy = A.y + A.h - 6;
      const F = (y, z) => [cx + y * m, cy - z * m];
      const obr = (meta.obrysy && meta.obrysy.bocnice) || [K.obrysBocnice(o)];
      const pol = obr.map(b => b.map(q => F(q[0], q[1])));
      for (const b of pol) L(b, 0.5, true);
      srafy(pol, 2);
      Kr(...F(0, o.zc), Rc * m, 0.25, 'c');
      Kr(...F(0, o.zc), (p.civka.otvor / 2) * m, 0.18, 'c');
      for (const s of [-1, 1]) { Kr(...F(s * o.e, o.zl), o.rl * m, 0.35); Kr(...F(s * o.e, o.zl), o.rOsa * m, 0.3); L([F(0, o.zc), F(s * o.e, o.zl)], 0.15, false, 'o'); }
      L([F(-Rc - 6, 0), F(Rc + 6, 0)], 0.3);
      L([F(-Rc - 4, o.zc), F(Rc + 4, o.zc)], 0.18, false, 'o'); L([F(0, -3), F(0, o.zc + Rc + 4)], 0.18, false, 'o');
      if (p.stojan.spoj === 'zamek') for (const s of [-1, 1]) L([F(s * o.e - p.stojan.lista / 2, 0), F(s * o.e - p.stojan.lista / 2, p.stojan.vyskaListy), F(s * o.e + p.stojan.lista / 2, p.stojan.vyskaListy), F(s * o.e + p.stojan.lista / 2, 0)], 0.25, false, 'c');
      else for (const s of [-1, 1]) Kr(...F(s * o.e, o.zr), o.rTyc * m, 0.3);
      kota(F(-o.e, o.zl), F(o.e, o.zl), -(o.zl * m + 8), `${f(2 * o.e, 1)}`);
      kota(F(-o.e - o.rBoss, 0), F(o.e + o.rBoss, 0), 14 + o.zl * 0, `${f(o.sirkaDesky, 1)}`);
      kota(F(o.e + o.rBoss, 0), F(o.e + o.rBoss, o.zl), -6, f(o.zl, 1));
      kota(F(0, 0), F(0, o.vuleStul), 0, `${f(o.vuleStul, 1)}`);
      T(cx + 2, cy - (o.zc + Rc) * m - 2, `cívka Ø ${f(2 * Rc)} · opora ${f(p.stojan.uhel, 0)}° od svislice`, 2.6, 'c');
      T(A.x, A.y - 3, `Bočnice zboku s cívkou · ${nazevM(m)}`, 3.4);
      radky.push(['Cívka', `Ø ${f(2 * Rc)} × ${f(p.civka.sirka)}, ${f(p.civka.hmotnost + p.civka.tara, 2)} kg`], ['Ložiska', `${o.loziska}× ${o.L.o}, rozteč ${f(2 * o.e, 1)}, osa ve výšce ${f(o.zl, 1)}`],
        ['Cívka nad stolem', `${f(o.vuleStul, 1)} mm, nad lištou ${f(o.vuleLista, 1)} mm`], ['Bočnice', `${f(o.sirkaDesky, 0)} × ${f(o.vyskaDesky, 0)} × ${f(o.t, 1)} mm${o.deleni ? ', ze dvou půlek' : ''}, ${o.desek} ks`],
        ['Spojení', p.stojan.spoj === 'zamek' ? `lišty ${f(p.stojan.lista)} × ${f(p.stojan.vyskaListy)}, délka ${f(o.Lb, 1)} mm${o.segmentu > 1 ? ` z ${o.segmentu} dílů` : ''}` : `2× závitová tyč M8 × ${o.lTyc}`],
        ['Rozteč bočnic', `${f(o.P, 1)} mm (šířka cívky + 2 × ${f(p.stojan.mezera, 1)} + bočnice)`]);
    } else {
      /* ---------- vodítko bokorys ---------- */
      const v = p.vodidlo, prof = K.profilVodidla(o);
      const xs = prof.flat().map(q => q[0]), zs = prof.flat().map(q => q[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs, v.typ === 'kladka' ? o.Rk : -Infinity), z0 = Math.min(...zs), z1 = Math.max(...zs, v.typ === 'kladka' ? o.H + o.Rk : -Infinity);
      const m = mHl = MERITKA.find(q => (x1 - x0 + 30) * q <= A.w && (z1 - z0 + 20) * q <= A.h - 6) || MERITKA[MERITKA.length - 1];
      const cx = A.x + A.w / 2 - (x0 + x1) / 2 * m, cy = A.y + A.h - 10 + z0 * m;
      const F = (x, z) => [cx + x * m, cy - z * m];
      const obr = K.obalka2(prof.flat());
      L(prof[0].map(q => F(...q)), 0.5, true); L(prof[1].map(q => F(...q)), 0.5, true); Kr(...F(0, o.H), o.re * m, 0.5);
      for (let i = 3; i < prof.length; i++) L(prof[i].map(q => F(...q)), 0.35, true);
      void obr;
      Kr(...F(0, o.H), o.rH * m, 0.4);
      if (v.typ === 'kladka') Kr(...F(0, o.H), o.Rk * m, 0.3, 'c');
      for (const x of o.diry) { L([F(x - o.rD, -2), F(x - o.rD, o.tb + 2)], 0.25, false, 'c'); L([F(x + o.rD, -2), F(x + o.rD, o.tb + 2)], 0.25, false, 'c'); L([F(x, -4), F(x, o.tb + 4)], 0.18, false, 'o'); }
      kota(F(o.x0, 0), F(o.x1, 0), 7, f(o.x1 - o.x0, 1));
      kota(F(o.x1, 0), F(o.x1, o.H), -6, f(o.H, 1));
      if (o.diry.length === 2) kota(F(o.diry[0], o.tb), F(o.diry[1], o.tb), -(o.tb * m + 4), f(o.diry[1] - o.diry[0], 1));
      kota(F(-o.rH, o.H + o.re), F(o.rH, o.H + o.re), -4, `Ø ${f(2 * o.rH, 2)}`);
      T(A.x, A.y - 3, `Vodítko zboku · ${nazevM(m)} · šířka ${f(o.w, 1)} mm`, 3.4);
      radky.push(['Druh', K.NAZVY.vtyp[v.typ] + ` pro filament ${f(v.filament, 2)}`], ['Úchyt', K.NAZVY.uchyt[v.uchyt] + `, díra Ø ${f(v.dira, 1)}`],
        ['Výška osy', `${f(o.H, 1)} mm nad deskou`]);
      if (v.typ === 'ptfe') radky.push(['PTFE', `kapsa Ø ${f(2 * o.rPtfe, 2)} × ${f(o.hPtfe, 1)}${o.rS ? `, ${K.SPOJKY[v.spojka].nazev} – předvrt Ø ${f(2 * o.rS, 1)}` : ''}`]);
      if (v.typ === 'kladka') radky.push(['Kladka', `Ø ${f(v.kladka)} × ${f(o.tk, 1)}, V drážka hloubka ${f(o.gv, 2)}${o.L ? `, ${o.L.o}` : ''}`]);
    }

    /* ---------- parametry ---------- */
    let y = 22;
    T(154, y - 4, 'Parametry', 3.2);
    const mat = meta.material || p.tisk.material;
    radky.push(['Materiál', `${mat}${meta.hmotnost ? `, ${f(meta.hmotnost, 0)} g` : ''}`]);
    for (const [a, b] of radky) { y += 5; T(154, y, a, 2.5); T(285, y, b, 2.4, 'r'); L([[152, y + 1.3], [287, y + 1.3]], 0.12); }

    /* ---------- kusovník ---------- */
    let yk = Math.max(y + 10, 70);
    T(154, yk, 'Kusovník', 3.2); yk += 1.5;
    const kus = (meta.kusovnik || []).slice(0, Math.floor((H0 - OK - 24 - yk) / 4.4));
    for (const [n, ks, pz] of kus) { yk += 4.4; T(161, yk, `${ks}×`, 2.5, 'r'); T(163, yk, String(n).slice(0, 56), 2.3); if (pz) T(285, yk, String(pz).slice(0, 30), 2, 'r'); L([[152, yk + 1.2], [287, yk + 1.2]], 0.12); }

    /* ---------- rám, razítko, kontrolní úsečka ---------- */
    L([[OK, OK], [W0 - OK, OK], [W0 - OK, H0 - OK], [OK, H0 - OK]], 0.5, true);
    const rx = W0 - OK - 135, ry = H0 - OK - 22;
    L([[rx, ry], [W0 - OK, ry], [W0 - OK, H0 - OK], [rx, H0 - OK]], 0.5, true);
    L([[rx, ry + 10], [W0 - OK, ry + 10]], 0.25); L([[rx + 85, ry], [rx + 85, H0 - OK]], 0.25);
    T(rx + 2, ry + 7, (p.nazev || 'Držák cívky').slice(0, 44), 4);
    T(rx + 2, ry + 15.5, 'Držák a adaptér cívky filamentu', 2.6);
    T(rx + 87, ry + 7, meta.datum || '', 2.6);
    T(rx + 87, ry + 15.5, 'rozměry v mm · list 1/1', 2.6);
    const kx = OK + 4, ky = H0 - OK - 4, dl = Math.min(50 * mHl, 120);
    L([[kx, ky], [kx + dl, ky]], 0.35); L([[kx, ky - 1.5], [kx, ky + 1]], 0.25); L([[kx + dl, ky - 1.5], [kx + dl, ky + 1]], 0.25);
    T(kx + dl + 2, ky + 1, `= ${f(dl / mHl, 0)} mm v hlavním pohledu (kontrola měřítka)`, 2.3);
    return { W: W0, H: H0, meritko: nazevM(mHl), prvky };
  }

  /* ---------- výstupy ---------- */
  const n3 = x => (Math.round(x * 1000) / 1000).toString();
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dash = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(s * 8 + 1)} ${n3(s * 5 + 0.6)}"` : d === 'o' ? ` stroke-dasharray="${n3(6)} ${n3(1.2)} ${n3(1)} ${n3(1.2)}"` : '');
  function svg(v) {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${v.W}mm" height="${v.H}mm" viewBox="0 0 ${v.W} ${v.H}" font-family="Liberation Sans, Arial, Helvetica, sans-serif"><rect width="${v.W}" height="${v.H}" fill="#ffffff"/>`;
    for (const e of v.prvky) {
      if (e.t === 'l') s += `<path d="${e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(q[1])).join('')}${e.z ? 'Z' : ''}" fill="none" stroke="#000" stroke-width="${n3(e.s)}" stroke-linecap="round" stroke-linejoin="round"${dash(e.d, e.s)}/>`;
      else if (e.t === 'k') s += `<circle cx="${n3(e.x)}" cy="${n3(e.y)}" r="${n3(e.r)}" fill="none" stroke="#000" stroke-width="${n3(e.s)}"${dash(e.d, e.s)}/>`;
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
    doc.setProperties({ title: opt.nazev || 'Výkres', creator: 'Držák a adaptér cívky filamentu – výkres' });
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
      if (e.t === 'k') doc.circle(e.x, e.y, e.r, 'S');
      else if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
      else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
      if (e.d) doc.setLineDashPattern([], 0);
    }
    return doc;
  }

  const API = { vykres, svg, pdf, MERITKA };
  if (uzel) module.exports = API; else window.CIVKA_VYK = API;
})();
