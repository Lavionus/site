/* Kolečka a pojezdy – výkres A4 naležato (bez DOM, běží i v node).
   Vlevo řez kolem osou (šrafy, ložiska, kóty průměrů, šířky a profilu), vpravo nahoře pohledy na držák
   (zepředu a zboku / pohled na úchyt), vpravo parametry, dole kusovník a razítko.
   vykres(p, o, meta) → {W, H, prvky}; meta = {datum, kusovnik: [[název, ks, pozn.]], hmotnost, material}
   prvek: {t:'l', b:[[x,y]…], z (uzavřený), s (tloušťka), d:'c'|'o'} | {t:'k', x, y, r, s, d} | {t:'txt', x, y, h, txt, a, u}
   svg(v) → text SVG v mm; pdf(jsPDF, v, {pismo, nazev}) → dokument jsPDF. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const K = uzel ? require('./jadro.js') : window.KOLA;
  const f = (x, d = 1) => K.fmt(x, d);
  const W0 = 297, H0 = 210, OK = 10;
  const MERITKA = [5, 2, 1, 0.5, 0.2, 0.1];
  const nazevM = m => (m >= 1 ? `${f(m, 2)} : 1` : `1 : ${f(1 / m, 2)}`);
  /** Popisky v jazyce rozhraní (I18N.preloz), jinak česky. */
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);

  function vykres(p, o, meta = {}) {
    const prvky = [];
    const L = (b, s = 0.35, z = false, d) => prvky.push({ t: 'l', b, s, z, d });
    const Kr = (x, y, r, s = 0.35, d) => prvky.push({ t: 'k', x, y, r, s, d });
    const T = (x, y, txt, h = 2.8, a = 'l', u = 0) => prvky.push({ t: 'txt', x, y, h, txt: t(String(txt)), a, u });
    /** Kóta mezi body (papír) s odsazením od kolmo; text nad kótovací čarou. */
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
      const M = kr ? [B[0] + ux * 3, B[1] + uy * 3] : [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      T(M[0] + nah[0] * 0.8, M[1] + nah[1] * 0.8, txt, 2.6, kr ? 'l' : 'c', uhel);
    };
    /** Šrafy 45° uvnitř mnohoúhelníku (papír). */
    const srafy = (poly, krok, smer = 1) => {
      const rot = ([x, y]) => [x - smer * y, x + smer * y];   // u = x − y (konst. podél šrafy)
      const q = poly.map(rot);
      const u0 = Math.min(...q.map(a => a[0])), u1 = Math.max(...q.map(a => a[0]));
      for (let u = Math.ceil(u0 / krok) * krok; u < u1; u += krok) {
        const xs = [];
        for (let i = 0; i < q.length; i++) {
          const [a1, b1] = q[i], [a2, b2] = q[(i + 1) % q.length];
          if ((a1 <= u && a2 > u) || (a2 <= u && a1 > u)) xs.push(b1 + (b2 - b1) * (u - a1) / (a2 - a1));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          const zpet = (uu, vv) => [(uu + vv) / 2, smer * (vv - uu) / 2];
          L([zpet(u, xs[i]), zpet(u, xs[i + 1])], 0.13);
        }
      }
    };
    const k = p.kolo, u = p.ulozeni, dz = p.drzak, P = o.prof, W = k.sirka, R = o.R;

    /* ---------- řez kolem: osa vodorovně (x = z kola), poloměr nahoru ---------- */
    const A = { x: OK + 4, y: OK + 8, w: 128, h: 104 };
    const sir = W + 2 * 14, vys = 2 * R + 2 * 6;
    const m = MERITKA.find(q => sir * q <= A.w && vys * q <= A.h - 6) || MERITKA[MERITKA.length - 1];
    const cx = A.x + A.w / 2 - W * m / 2, cy = A.y + (A.h - 6) / 2;
    const Pp = (z, r) => [cx + z * m, cy - r * m];
    const vnej = P.body.map(([r, z]) => [r, z]);
    const vnitr = K.vnitrniObrys(p, o);
    for (const s of [1, -1]) {
      const poly = vnej.map(([r, z]) => Pp(z, s * r)).concat(vnitr.map(([r, z]) => Pp(z, s * r)));
      L(poly, 0.5, true);
      srafy(poly, 1.4, 1);
      if (P.behoun) { const b = P.behoun.map(([r, z]) => Pp(z, s * r)); L(b, 0.5, true); srafy(b, 0.8, -1); }
      if (o.L) for (const q of o.kapsy) {
        const r0 = o.L.d / 2, r1 = o.L.D / 2, z0 = q.dole ? 0 : W - o.L.B, z1 = z0 + o.L.B;
        const b = [Pp(z0, s * r0), Pp(z1, s * r0), Pp(z1, s * r1), Pp(z0, s * r1)];
        L(b, 0.3, true); L([b[0], b[2]], 0.18); L([b[1], b[3]], 0.18);
      }
    }
    if (o.deleni === 'pulky') L([Pp(o.zs, -R - 2 / m), Pp(o.zs, R + 2 / m)], 0.25, false, 'c');
    L([Pp(-6 / m, 0), Pp(W + 6 / m, 0)], 0.18, false, 'o');
    // kóty řezu
    kota(Pp(W, -R), Pp(W, R), -(6 + 0), `Ø ${f(2 * R, 1)}`);
    kota(Pp(0, -R), Pp(W, -R), -5, f(W, 1));
    if (o.L) {
      const sed = `Ø ${f(2 * o.rp, 2)}`;
      kota(Pp(0, -o.rp), Pp(0, o.rp), 7, sed);
      kota(Pp(W / 2, -o.rr), Pp(W / 2, o.rr), 0, `Ø ${f(2 * o.rr, 1)}`);
    } else kota(Pp(0, -o.rb), Pp(0, o.rb), 7, `Ø ${f(2 * o.rb, 2)}`);
    if (P.rDno && P.rDno < R - 0.05) kota(Pp(W, -P.rDno), Pp(W, P.rDno), -14, `Ø ${f(2 * P.rDno, 1)}`);
    if (k.profil === 'vhrot' || k.profil === 'vdrazka') T(cx + W * m / 2, cy - R * m - 4, `V ${f(k.uhel, 0)}°, hloubka ${f(P.h, 1)}`, 2.6, 'c');
    if (k.profil === 'u') T(cx + W * m / 2, cy - R * m - 4, `U R ${f(P.ru, 2)}, hloubka ${f(P.h, 1)}`, 2.6, 'c');
    if (k.profil === 'korunka') T(cx + W * m / 2, cy - R * m - 4, `korunka ${f(k.korunka, 2)} (R ${f(P.rKor, 0)})`, 2.6, 'c');
    if (k.profil === 'oring') T(cx + W * m / 2, cy - R * m - 4, `drážka pro O-kroužek ${f(k.oring, 2)}: dno Ø ${f(2 * (R - P.hg), 1)}`, 2.6, 'c');
    if (u.typ === 'hridel') T(cx + W * m / 2, cy + R * m + 10, `otvor Ø ${f(2 * o.rb, 2)}, přes plošku ${f(o.plocha, 2)}`, 2.6, 'c');
    T(A.x, A.y - 2, `Řez kolem A–A · ${nazevM(m)}`, 3.4);

    /* ---------- pohledy na držák ---------- */
    const B = { x: 152, y: OK + 8, w: 135, h: 92 };
    if (dz.typ === 'vidlice' || dz.typ === 'otocna') {
      const sirX = 2 * Math.max(dz.a / 2, o.xo), sirY = Math.max(dz.b, 2 * R + 2 * Math.abs(o.yA)), H = o.zPT;
      const mb = MERITKA.find(q => (sirX + sirY + 30) * q <= B.w && (H + 12) * q <= B.h - 4) || MERITKA[MERITKA.length - 1];
      const x1 = B.x + 4 + sirX * mb / 2, y0 = B.y + B.h - 8;
      const F = (x, z) => [x1 + x * mb, y0 - z * mb];
      const obd = (xa, za, xb, zb, s = 0.4) => L([F(xa, za), F(xb, za), F(xb, zb), F(xa, zb)], s, true);
      // zepředu (pohled ve směru jízdy): kolo, nohy, deska / talíř
      obd(-W / 2, 0, W / 2, 2 * R, 0.3);
      for (const s of [-1, 1]) obd(s * o.xi, R - o.w / 2, s * o.xo, dz.typ === 'vidlice' ? o.zPB : o.zDB);
      if (dz.typ === 'otocna') obd(-o.rTal, o.zDB, o.rTal, o.zDT);
      obd(-dz.a / 2, o.zPB, dz.a / 2, o.zPT);
      L([F(-o.xo - 4, R), F(o.xo + 4, R)], 0.18, false, 'o');
      L([F(-dz.a / 2 - 4, 0), F(dz.a / 2 + 4, 0)], 0.25);
      if (dz.dira > 0) for (const s of [-1, 1]) L([F(s * dz.roztecX / 2, o.zPB - 1.5), F(s * dz.roztecX / 2, o.zPT + 1.5)], 0.18, false, 'o');
      kota(F(-dz.a / 2, o.zPT), F(dz.a / 2, o.zPT), 5, f(dz.a));
      if (dz.dira > 0) kota(F(-dz.roztecX / 2, o.zPT), F(dz.roztecX / 2, o.zPT), 10, f(dz.roztecX));
      kota(F(-dz.a / 2, 0), F(-dz.a / 2, o.zPT), 5, f(o.zPT, 1));
      kota(F(-dz.a / 2 - 0.01, 0), F(-dz.a / 2 - 0.01, R), 12, f(R, 1));
      T(x1, B.y - 2, `Zepředu · ${nazevM(mb)}`, 3, 'c');
      // zboku: kolo, noha, deska
      const x2 = x1 + sirX * mb / 2 + 14 + sirY * mb / 2;
      const S = (y, z) => [x2 + y * mb, y0 - z * mb];
      const n = 48, kb = [];
      for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; kb.push(S(o.yA + R * Math.cos(a), R + R * Math.sin(a))); }
      L(kb, 0.3, true);
      const nb = [];
      for (let i = 0; i <= 16; i++) { const a = Math.PI + Math.PI * i / 16; nb.push(S(o.yA + o.w / 2 * Math.cos(a), R + o.w / 2 * Math.sin(a))); }
      const zN = dz.typ === 'vidlice' ? o.zPB : o.zDB;
      nb.push(S(o.yA + o.w / 2, zN), S(o.yA - o.w / 2, zN));
      L(nb, 0.4, true);
      Kr(...S(o.yA, R), o.rOsa * mb, 0.3);
      if (dz.typ === 'otocna') { L([S(-o.rTal, o.zDB), S(o.rTal, o.zDB), S(o.rTal, o.zDT), S(-o.rTal, o.zDT)], 0.4, true); L([S(0, 0), S(0, o.zPT + 4)], 0.18, false, 'o'); }
      L([S(-dz.b / 2, o.zPB), S(dz.b / 2, o.zPB), S(dz.b / 2, o.zPT), S(-dz.b / 2, o.zPT)], 0.4, true);
      L([S(-dz.b / 2 - 4, 0), S(dz.b / 2 + 4, 0)], 0.25);
      kota(S(-dz.b / 2, o.zPT), S(dz.b / 2, o.zPT), 5, f(dz.b));
      if (dz.dira > 0) kota(S(-dz.roztecY / 2, o.zPT), S(dz.roztecY / 2, o.zPT), 10, f(dz.roztecY));
      if (dz.typ === 'otocna' && dz.zavlek > 0.5) kota(S(o.yA, 0), S(0, 0), -5, `závlek ${f(dz.zavlek, 1)}`);
      T(x2, B.y - 2, 'Zboku', 3, 'c');
    } else if (dz.typ === 'uchyt') {
      const obr = K.obalka2([...K.obdelnik(-dz.delka / 2, -dz.vyska / 2, dz.delka / 2, dz.vyska / 2, 3), ...K.kruh((p.excentr.pouzit ? p.excentr.prumer / 2 + 2 : o.rNab) + 2.5, dz.osaX, dz.osaY, 48)]);
      const xs = obr.map(q => q[0]).concat([dz.osaX - R, dz.osaX + R]), ys = obr.map(q => q[1]).concat([dz.osaY - R, dz.osaY + R]);
      const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
      const mb = MERITKA.find(q => (bw + 30) * q <= B.w && (bh + 20) * q <= B.h - 4) || MERITKA[MERITKA.length - 1];
      const xc = B.x + B.w / 2 - (Math.min(...xs) + Math.max(...xs)) / 2 * mb, yc = B.y + B.h / 2 + (Math.min(...ys) + Math.max(...ys)) / 2 * mb;
      const F = (x, y) => [xc + x * mb, yc - y * mb];
      L(obr.map(q => F(...q)), 0.5, true);
      for (let i = 0; i < dz.der; i++) {
        const x = (i - (dz.der - 1) / 2) * dz.roztec;
        Kr(...F(x, 0), (dz.dira / 2 + 0.15) * mb, 0.35);
        if (dz.zapustne) Kr(...F(x, 0), (dz.dira + 0.2) * mb, 0.25);
      }
      Kr(...F(dz.osaX, dz.osaY), o.rOsa * mb, 0.35);
      Kr(...F(dz.osaX, dz.osaY), R * mb, 0.25, 'o');
      L([F(dz.osaX - R - 3, dz.osaY), F(dz.osaX + R + 3, dz.osaY)], 0.18, false, 'o');
      L([F(dz.osaX, dz.osaY - R - 3), F(dz.osaX, dz.osaY + R + 3)], 0.18, false, 'o');
      kota(F(-dz.delka / 2, dz.vyska / 2), F(dz.delka / 2, dz.vyska / 2), 6, f(dz.delka));
      if (dz.der > 1) kota(F(-(dz.der - 1) / 2 * dz.roztec, 0), F((dz.der - 1) / 2 * dz.roztec, 0), -(dz.vyska / 2 * mb + 6), f(dz.roztec * (dz.der - 1)));
      kota(F(dz.delka / 2, -dz.vyska / 2), F(dz.delka / 2, dz.vyska / 2), -6, f(dz.vyska));
      if (Math.abs(dz.osaY) > 0.4) kota(F(-dz.delka / 2, 0), F(-dz.delka / 2, dz.osaY), 6, `osa ${f(dz.osaY, 1)}`);
      T(B.x + B.w / 2, B.y - 2, `Úchyt – pohled na desku · ${nazevM(mb)} · deska ${f(dz.deska, 1)}, náboj ${f(dz.naboj, 1)}`, 3, 'c');
    } else {
      const mb = MERITKA.find(q => (2 * R + 20) * q <= Math.min(B.w, B.h - 4)) || MERITKA[MERITKA.length - 1];
      const xc = B.x + B.w / 2, yc = B.y + B.h / 2;
      Kr(xc, yc, R * mb, 0.5);
      if (P.rDno && P.rDno < R - 0.05) Kr(xc, yc, P.rDno * mb, 0.25, 'c');
      if (o.L) Kr(xc, yc, o.L.D / 2 * mb, 0.3, 'c');
      Kr(xc, yc, (o.L ? o.rr : o.rb) * mb, 0.4);
      L([[xc - R * mb - 3, yc], [xc + R * mb + 3, yc]], 0.18, false, 'o');
      L([[xc, yc - R * mb - 3], [xc, yc + R * mb + 3]], 0.18, false, 'o');
      T(xc, B.y - 2, `Kolo zboku · ${nazevM(mb)}`, 3, 'c');
    }

    /* ---------- parametry ---------- */
    let y = 116;
    T(154, y, 'Parametry', 3.2); y += 1.5;
    const radky = [
      ['Kolo', `Ø ${f(2 * R, 1)} × ${f(W, 1)} mm, ${K.NAZVY.profil[k.profil].split(' – ')[0]}`],
      ['Uložení', o.L ? `${o.pocet}× ${o.L.o} (${f(o.L.d)}×${f(o.L.D)}×${f(o.L.B)}), sedlo Ø ${f(2 * o.rp, 2)}` : u.typ === 'kluzne' ? `kluzně, otvor Ø ${f(2 * o.rb, 2)} na osu Ø ${f(u.osa)}` : `hřídel Ø ${f(u.osa)} s ploškou ${f(u.plocha, 2)}`],
      ['Tisk kola', `${o.tiskKolo}${o.mostky.length ? ', ' + K.NAZVY.mostek[p.tisk.mostek] : ''}`],
      ['Držák', K.NAZVY.drzak[dz.typ] + (o.zPT ? `, montážní výška ${f(o.zPT, 1)} mm` : '')],
      ['Osa', o.M ? `šroub ${o.M} × ${o.lSroubu}` : `Ø ${f(o.osa)} × ${f(o.lOsy, 0)}`],
    ];
    if (p.excentr.pouzit) radky.push(['Excentr', `e ${f(p.excentr.e, 2)} mm, čep Ø ${f(p.excentr.prumer, 1)}, šestihran ${f(p.excentr.klic)}`]);
    if (meta.hmotnost) radky.push(['Hmotnost dílů', `${f(meta.hmotnost, 0)} g ${meta.material || ''}`]);
    if (meta.unosnost) radky.push(['Zatížení kola', meta.unosnost]);
    for (const [a, b] of radky) { y += 4.6; T(154, y, a, 2.5); T(285, y, b, 2.5, 'r'); L([[152, y + 1.3], [287, y + 1.3]], 0.12); }

    /* ---------- kusovník ---------- */
    let yk = 134;
    T(OK + 4, yk, 'Kusovník', 3.2); yk += 1.5;
    const kus = (meta.kusovnik || []).slice(0, 11);
    for (const [n, ks, pz] of kus) { yk += 4.4; T(OK + 11, yk, `${ks}×`, 2.5, 'r'); T(OK + 13, yk, n, 2.5); if (pz) T(140, yk, pz, 2.2, 'r'); L([[OK + 2, yk + 1.2], [141, yk + 1.2]], 0.12); }

    /* ---------- rám, razítko, kontrolní úsečka ---------- */
    L([[OK, OK], [W0 - OK, OK], [W0 - OK, H0 - OK], [OK, H0 - OK]], 0.5, true);
    const rx = W0 - OK - 135, ry = H0 - OK - 22;
    L([[rx, ry], [W0 - OK, ry], [W0 - OK, H0 - OK], [rx, H0 - OK]], 0.5, true);
    L([[rx, ry + 10], [W0 - OK, ry + 10]], 0.25); L([[rx + 85, ry], [rx + 85, H0 - OK]], 0.25);
    T(rx + 2, ry + 7, (p.nazev || 'Kolečko').slice(0, 44), 4);
    T(rx + 2, ry + 15.5, 'Kolečka a pojezdy – kolo a držák', 2.6);
    T(rx + 87, ry + 7, meta.datum || '', 2.6);
    T(rx + 87, ry + 15.5, 'rozměry v mm · list 1/1', 2.6);
    const kx = OK + 4, ky = H0 - OK - 4;
    L([[kx, ky], [kx + 50 * m, ky]], 0.35); L([[kx, ky - 1.5], [kx, ky + 1]], 0.25); L([[kx + 50 * m, ky - 1.5], [kx + 50 * m, ky + 1]], 0.25);
    if (50 * m < 130) T(kx + 50 * m + 2, ky + 1, `= 50 mm v řezu (kontrola měřítka)`, 2.3);
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
      else if (e.t === 'k') s += `<circle cx="${n3(e.x)}" cy="${n3(e.y)}" r="${n3(e.r)}" fill="none" stroke="#000" stroke-width="${n3(e.s)}"${dash(e.d, e.s)}/>`;
      else {
        const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(e.y)})"` : '';
        s += `<text x="${n3(e.x)}" y="${n3(e.y)}" font-size="${n3(e.h)}" text-anchor="${an}" fill="#000"${rot}>${esc(e.txt)}</text>`;
      }
    }
    return s + '</svg>';
  }
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x');
  /** opt: {pismo (TTF base64 – s ním i diakritika), nazev} */
  function pdf(jsPDF, v, opt = {}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
    let uni = false;
    if (opt.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', opt.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
    doc.setProperties({ title: opt.nazev || 'Výkres', creator: 'Kolečka a pojezdy – výkres' });
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
  if (uzel) module.exports = API; else window.KOLA_VYK = API;
})();
