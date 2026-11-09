/* Úhelníky a odsávání – technický výkres (bez DOM, běží i v node).
   Tři pravoúhlé pohledy metodou E (ISO): nárys vlevo nahoře, bokorys (pohled zleva) vpravo, půdorys pod nárysem,
   kóty, popis otvorů, rohové razítko a kontrolní úsečka 50 mm. List A4 naležato, měřítko 1:1 / 1:2 / 1:5 / 1:10.
   vykres(p, o, {datum}) → {W, H, meritko, prvky}  (mm papíru, y dolů)
   prvek: {t:'l', b:[[x,y]..], z, s, d:'c'(čárkovaně)|'o'(čerchovaně)} | {t:'k', x, y, r, s, d} | {t:'txt', x, y, h, txt, a:'l'|'c'|'r', u (° proti směru hod.)}
   svg(v) → text SVG v mm; pdf(jsPDF, v, {pismo, nazev}) → dokument jsPDF. */
(function () {
  'use strict';
  const U = typeof module !== 'undefined' ? require('./jadro.js') : window.UHELNIKY;
  const fmt = (x, d = 1) => U.fmt(x, d);
  const S = { vid: 0.5, skr: 0.3, osa: 0.18, kota: 0.18 };   // tloušťky čar
  const W = 297, H = 210, OKRAJ = 10;
  const MERITKA = [[1, '1:1'], [0.5, '1:2'], [0.2, '1:5'], [0.1, '1:10']];

  /* ---------- pohled v souřadnicích modelu (u doprava, v nahoru) ---------- */
  function pohled(nazev) {
    const P = { nazev, prvky: [], koty: [], pozn: [] };
    P.cara = (b, typ = 'vid', z = false) => { P.prvky.push({ t: 'l', b, z, typ }); return P; };
    P.kruh = (x, y, r, typ = 'vid') => { P.prvky.push({ t: 'k', x, y, r, typ }); return P; };
    P.osa = (a, b) => P.cara([a, b], 'osa');
    P.kriz = (x, y, r) => { P.osa([x - r - 1.5, y], [x + r + 1.5, y]); P.osa([x, y - r - 1.5], [x, y + r + 1.5]); return P; };
    /** kóta mezi body p1, p2; n = jednotkový směr odsazení (model), od = odsazení v mm papíru */
    P.kota = (p1, p2, n, od, txt) => { P.koty.push({ p1, p2, n, od, txt }); return P; };
    /** řetěz kót po jedné přímce: body seřazené podél směru */
    P.retez = (body, n, od) => { for (let i = 1; i < body.length; i++) P.kota(body[i - 1], body[i], n, od, null); return P; };
    /** drážka (ovál) se středem x, y, poloměrem r a délkou l ve směru vodorovně / svisle */
    P.dirka = (x, y, r, l, vodorovne, typ = 'vid') => {
      if (l <= 0.01) return P.kruh(x, y, r, typ);
      const b = [], [dx, dy] = vodorovne ? [l / 2, 0] : [0, l / 2], n = 24;
      for (let i = 0; i <= n; i++) { const f = (vodorovne ? -Math.PI / 2 : 0) + Math.PI * i / n; b.push([x + dx + r * Math.cos(f), y + dy + r * Math.sin(f)]); }
      for (let i = 0; i <= n; i++) { const f = (vodorovne ? Math.PI / 2 : Math.PI) + Math.PI * i / n; b.push([x - dx + r * Math.cos(f), y - dy + r * Math.sin(f)]); }
      return P.cara(b, typ, true);
    };
    return P;
  }
  const oblouk = (cx, cy, r, f0, f1, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const f = (f0 + (f1 - f0) * i / n) * Math.PI / 180; return [cx + r * Math.cos(f), cy + r * Math.sin(f)]; });
  /** obdélník se zaoblenými rohy jen na straně 'x+' nebo 'y+' */
  function zaoblenyObdelnik(x0, y0, x1, y1, r, strana) {
    if (r <= 0.01) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    if (strana === 'x+') return [[x0, y0], ...oblouk(x1 - r, y0 + r, r, -90, 0), ...oblouk(x1 - r, y1 - r, r, 0, 90), [x0, y1]];
    return [[x0, y0], [x1, y0], ...oblouk(x1 - r, y1 - r, r, 0, 90), ...oblouk(x0 + r, y1 - r, r, 90, 180)];
  }

  /* ---------- úhelník ---------- */
  function uhelnik(p, o) {
    const { t, A, B, ri, cv } = o, Wd = o.W, d = o.otvor;
    const ovX = d.napric ? 0 : d.oval, ovY = d.napric ? d.oval : 0;   // ovál podél ramene / napříč
    // NÁRYS (x, z)
    const N = pohled('NÁRYS');
    const obr = [cv > 0.05 ? [cv, 0] : [0, 0], [A, 0], [A, t]];
    if (ri > 0.05) obr.push(...oblouk(t + ri, t + ri, ri, -90, -180)); else obr.push([t, t]);
    obr.push([t, B], [0, B]);
    if (cv > 0.05) obr.push([0, cv]);
    N.cara(obr, 'vid', true);
    const kl = o.klic, hk = kl ? kl.h : 0, RA = o.ramenoA, RB = o.ramenoB;
    // výstupky: podél ramene = obdélník pod ramenem, kolmo (napříč úhelníkem) = lichoběžník v řezu
    if (kl) {
      if (RA.kolmo) RA.drazky.forEach(c => N.cara([[c - kl.wk, 0], [c - kl.wk + kl.c, -hk], [c + kl.wk - kl.c, -hk], [c + kl.wk, 0]]));
      else N.cara([[0.3, 0], [0.3, -hk], [A - 0.3, -hk], [A - 0.3, 0]]);
      if (RB.kolmo) RB.drazky.forEach(c => N.cara([[0, c - kl.wk], [-hk, c - kl.wk + kl.c], [-hk, c + kl.wk - kl.c], [0, c + kl.wk]]));
      else N.cara([[0, 0.3], [-hk, 0.3], [-hk, B - 0.3], [0, B - 0.3]]);
    }
    if (o.pasy.length) N.cara(o.vyztuhaObrys);
    for (const x of o.ramenoA.x) {
      const r = d.ro + ovX / 2;
      N.cara([[x - r, -hk], [x - r, t - d.hz]], 'skr').cara([[x + r, -hk], [x + r, t - d.hz]], 'skr');
      if (d.hz > 0) N.cara([[x - r, t - d.hz], [x - r - d.hz, t]], 'skr').cara([[x + r, t - d.hz], [x + r + d.hz, t]], 'skr');
      N.osa([x, -2], [x, t + 2]);
    }
    for (const z of o.ramenoB.x) {
      const r = d.ro + ovX / 2;
      N.cara([[-hk, z - r], [t - d.hz, z - r]], 'skr').cara([[-hk, z + r], [t - d.hz, z + r]], 'skr');
      if (d.hz > 0) N.cara([[t - d.hz, z - r], [t, z - r - d.hz]], 'skr').cara([[t - d.hz, z + r], [t, z + r + d.hz]], 'skr');
      N.osa([-2, z], [t + 2, z]);
    }
    N.kota([0, 0], [A, 0], [0, -1], 10, null).kota([0, 0], [0, B], [-1, 0], 10, null).kota([A, 0], [A, t], [1, 0], 6, null);
    if (ri > 0.05) N.pozn.push(`R${fmt(ri)} vnitřní žlábek`);
    if (cv > 0.05) N.pozn.push(`sražení ${fmt(cv)} × 45°`);
    if (o.pasy.length) N.pozn.push(`výztuha ${fmt(o.ga)} × ${fmt(o.gb)}, tl. ${fmt(o.tz)}${o.sp > 0.05 ? `, špičky seříznuté na ${fmt(o.sp)}` : ''}`);

    // BOKORYS – pohled zleva na vnější plochu svislého ramene (u = −y, z)
    const Bk = pohled('BOKORYS');
    Bk.cara(zaoblenyObdelnik(-Wd, 0, 0, B, o.r, 'y+'), 'vid', true);
    // výstupky na vnější ploše svislého ramene: horní hrana (plná) a zkosení (užší pás)
    if (kl) for (const c of RB.drazky) for (const w of [kl.wk, kl.wk - kl.c]) {
      if (RB.kolmo) Bk.cara([[-Wd + 0.3, c - w], [-0.3, c - w]]).cara([[-Wd + 0.3, c + w], [-0.3, c + w]]);
      else Bk.cara([[-c - w, 0.3], [-c - w, B - 0.3]]).cara([[-c + w, 0.3], [-c + w, B - 0.3]]);
    }
    if (cv > 0.05) Bk.cara([[-Wd, cv], [0, cv]]);
    for (const s of RB.sloupce) for (const z of RB.x) {
      Bk.dirka(-s.y, z, d.ro, d.oval, d.napric).kriz(-s.y, z, d.ro + d.oval / 2);
      if (d.hz > 0) Bk.dirka(-s.y, z, d.ro + d.hz, d.oval, d.napric, 'skr');
    }
    Bk.kota([-Wd, 0], [0, 0], [0, -1], 10, null);
    if (RB.x.length && RB.sloupce.length) {
      Bk.retez([[0, 0], ...RB.x.map(z => [0, z])], [1, 0], 8);
      Bk.retez([[0, 0], ...RB.sloupce.map(s => [-s.y, 0])], [0, -1], 18);
    }

    // PŮDORYS (x, y) – zadní strana (+y) nahoře, u nárysu
    const Pd = pohled('PŮDORYS');
    Pd.cara(zaoblenyObdelnik(0, 0, A, Wd, o.r, 'x+'), 'vid', true);
    if (kl) for (const c of RA.drazky) for (const zn of [-1, 1]) {
      if (RA.kolmo) Pd.cara([[c + zn * kl.wk, 0.3], [c + zn * kl.wk, Wd - 0.3]], 'skr');
      else Pd.cara([[0.3, c + zn * kl.wk], [A - 0.3, c + zn * kl.wk]], 'skr');
    }
    Pd.cara([[t, 0], [t, Wd]]);
    for (const [a, b] of o.pasy) { const xk = o.vyztuhaObrys[0][0]; Pd.cara([[t, a], [xk, a], [xk, b], [t, b]]); }
    for (const s of RA.sloupce) for (const x of RA.x) {
      Pd.dirka(x, s.y, d.ro, ovX || ovY, !ovY);
      if (d.hz > 0) Pd.dirka(x, s.y, d.ro + d.hz, ovX || ovY, !ovY);
      Pd.kriz(x, s.y, d.ro + d.hz + (ovX || ovY) / 2);
    }
    if (RB.x.length) for (const s of RB.sloupce) { const r = d.ro + ovY / 2; Pd.cara([[0, s.y - r], [t, s.y - r]], 'skr').cara([[0, s.y + r], [t, s.y + r]], 'skr'); }
    if (RA.x.length && RA.sloupce.length) Pd.retez([[0, 0], ...RA.x.map(x => [x, 0])], [0, -1], 8);
    Pd.kota([A, 0], [A, Wd], [1, 0], 8, null);
    if (RA.x.length && RA.sloupce.length) Pd.retez([[A, 0], ...RA.sloupce.map(s => [A, s.y])], [1, 0], 16);
    if (o.pocetOtvoru) Pd.pozn.push(popisOtvoru(o.pocetOtvoru, d));
    if (kl) Pd.pozn.push(`výstupek do drážky ${fmt(2 * kl.wk, 2)} × ${fmt(kl.h)}, boky 45°, profil ${p.otvory.profil}`);
    if (o.profil) Pd.pozn.push(`profil u ramene A ${RA.kolmo ? 'kolmo k rameni' : 'podél ramene'}, u ramene B ${RB.kolmo ? 'kolmo k rameni' : 'podél ramene'}`);
    return [N, Bk, Pd];
  }
  function popisOtvoru(n, d) {
    return `${n}× Ø${fmt(d.v.otvor)} skrz` + (d.oval > 0 ? `, ovál ${fmt(d.oval)} ${d.napric ? 'napříč' : 'podél'}` : '')
      + (d.hz > 0 ? `, zahloubení 90° na Ø${fmt(2 * (d.ro + d.hz))}` : '') + ` – ${d.v.nazev}`;
  }

  /* ---------- odsávání ---------- */
  function odsavani(p, o) {
    const q = p.odsavani, { D, s, tf } = o, Hk = o.H, Wk = o.W, Wp = o.sirkaPriruby, d = o.otvor;
    const zOut = x => Hk * (1 - x / D);
    const n = o.osa, hd = q.hrdloDelka, K = o.hrdloK, Pf = K.map((x, i) => x - n[i] * hd);
    const vnejsi = (x, z) => x < 0 || z < 0 || x / D + z / Hk > 1 + 1e-9;
    // povrchová přímka hrdla v rovině řezu (posun e kolmo k ose): z hloubky komory k místu volné délky, pak kužel k ústí
    function primka(e, rZ, rK, proj) {
      const a = o.hrdloZ.map((x, i) => x + e[i] * rZ), b = Pf.map((x, i) => x + e[i] * rZ), c = K.map((x, i) => x + e[i] * rK);
      // část uvnitř komory se nekreslí: najít, kde úsečka a→b opouští klín
      let lo = 0, hi = 1;
      if (vnejsi(a[0], a[2])) lo = 0; else if (!vnejsi(b[0], b[2])) lo = 1; else { for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (vnejsi(a[0] + (b[0] - a[0]) * m, a[2] + (b[2] - a[2]) * m)) hi = m; else lo = m; } lo = hi; }
      const st = a.map((x, i) => x + (b[i] - x) * lo);
      return [proj(st), proj(b), proj(c)];
    }
    const e1 = [n[2], 0, -n[0]], e2 = [0, 1, 0];
    const ustí = (proj, r) => Array.from({ length: 49 }, (_, i) => { const f = 2 * Math.PI * i / 48; return proj(K.map((x, j) => x + r * (Math.cos(f) * e1[j] + Math.sin(f) * e2[j]))); });

    // NÁRYS – bok komory (x, z)
    const N = pohled('NÁRYS');
    N.cara([[0, 0], [D, 0], [tf, zOut(tf)], [tf, Hk], [0, Hk]], 'vid', true);
    if (o.platny) N.cara(o.vnitrek.map(([x, z]) => [x, Math.max(0, z)]), 'skr', true);
    const zw0 = q.dno ? s : 0;
    if (o.oknoS > 0 && o.oknoV > 0) N.cara([[0, zw0], [tf, zw0], [tf, o.oknoV], [0, o.oknoV]], 'skr', true);
    const pXZ = b => [b[0], b[2]];
    for (const zn of [1, -1]) {
      N.cara(primka(e1.map(x => x * zn), o.RoZ, o.RoK, pXZ));
      N.cara(primka(e1.map(x => x * zn), o.RiZ, o.RiK, pXZ), 'skr');
    }
    N.cara(ustí(pXZ, o.RoK)).cara(ustí(pXZ, o.RiK), 'skr');
    N.osa(pXZ(o.P.map((x, i) => x - n[i] * 5)), pXZ(K.map((x, i) => x + n[i] * 5)));
    for (const [, z] of o.otvory.filter(([y]) => y > 0)) { const r = d.ro + (d.napric ? 0 : d.oval / 2); N.cara([[0, z - r], [tf, z - r]], 'skr').cara([[0, z + r], [tf, z + r]], 'skr'); }
    N.kota([0, 0], [D, 0], [0, -1], 10, null).kota([0, 0], [0, Hk], [-1, 0], 10, null);
    const rMax = Math.max(o.RoZ, o.RoK);
    const eu = e1[2] < 0 ? e1.map(x => -x) : e1;   // kóta délky hrdla na horní straně
    const pp = [Pf, K].map(b => pXZ(b.map((x, i) => x + eu[i] * rMax)));
    N.kota(pp[0], pp[1], [eu[0], eu[2]], 6, null);
    N.pozn.push(`hrdlo Ø${fmt(2 * o.Ri, 2)} uvnitř / Ø${fmt(2 * o.Ro, 2)} vně (v půli délky)${q.kuzel > 0 ? `, kužel ${fmt(q.kuzel)}°` : ''}`);
    N.pozn.push(`stěna ${fmt(s)}, příruba ${fmt(tf)}${q.dno ? ', s dnem' : ', bez dna'}`);

    // BOKORYS – pohled zleva na přírubu (u = −y, z)
    const Bk = pohled('BOKORYS');
    Bk.cara([[-Wp / 2, 0], [Wp / 2, 0], [Wp / 2, Hk], [-Wp / 2, Hk]], 'vid', true);
    if (o.oknoS > 0 && o.oknoV > 0) Bk.cara([[-o.oknoS / 2, zw0], [-o.oknoS / 2, o.oknoV], [o.oknoS / 2, o.oknoV], [o.oknoS / 2, zw0]], 'vid', zw0 > 0);
    if (q.ucho > 0) Bk.cara([[-Wk / 2, 0], [-Wk / 2, Hk]], 'skr').cara([[Wk / 2, 0], [Wk / 2, Hk]], 'skr');
    for (const [y, z] of o.otvory) {
      Bk.dirka(-y, z, d.ro, d.oval, d.napric).kriz(-y, z, d.ro + d.oval / 2);
      if (d.hz > 0) Bk.dirka(-y, z, d.ro + d.hz, d.oval, d.napric, 'skr');
    }
    Bk.kota([-Wp / 2, 0], [Wp / 2, 0], [0, -1], 10, null);
    if (q.ucho > 0) Bk.kota([-Wk / 2, Hk], [Wk / 2, Hk], [0, 1], 6, null);
    if (o.oknoS > 0 && o.oknoV > 0) {
      Bk.kota([-o.oknoS / 2, o.oknoV], [o.oknoS / 2, o.oknoV], [0, 1], q.ucho > 0 ? 12 : 6, null);
      Bk.kota([-o.oknoS / 2, 0], [-o.oknoS / 2, o.oknoV], [-1, 0], 3, null);
    }
    const prave = o.otvory.filter(([y]) => y < 0).map(([y, z]) => [Wp / 2, z]);
    if (prave.length) Bk.retez([[Wp / 2, 0], ...prave], [1, 0], 8);
    Bk.kota([Wp / 2, 0], [Wp / 2, Hk], [1, 0], prave.length ? 16 : 8, null);
    if (o.pocetOtvoru) Bk.pozn.push(popisOtvoru(o.pocetOtvoru, d));

    // PŮDORYS (x, y)
    const Pd = pohled('PŮDORYS');
    Pd.cara([[0, -Wp / 2], [tf, -Wp / 2], [tf, Wp / 2], [0, Wp / 2]], 'vid', true);
    Pd.cara([[tf, -Wk / 2], [D, -Wk / 2], [D, Wk / 2], [tf, Wk / 2]]);
    const pXY = b => [b[0], b[1]];
    if (Math.abs(n[2]) > 0.999) Pd.kruh(K[0], 0, o.RoK).kruh(K[0], 0, o.RiK).kriz(K[0], 0, o.RoK);
    else {
      for (const zn of [1, -1]) {
        const e = [0, zn, 0], a = o.P.map((x, i) => x + e[i] * o.RoZ), b = Pf.map((x, i) => x + e[i] * o.RoZ), c = K.map((x, i) => x + e[i] * o.RoK);
        Pd.cara([pXY(a), pXY(b), pXY(c)]);
      }
      Pd.cara(ustí(pXY, o.RoK)).osa([o.P[0] - 5, 0], [K[0] + 5, 0]);
    }
    const xr = Math.max(D, K[0] + (Math.abs(n[2]) > 0.999 ? o.RoK : 0));
    Pd.kota([xr, -Wk / 2], [xr, Wk / 2], [1, 0], 8, null);
    Pd.kota([0, Wp / 2], [tf, Wp / 2], [0, 1], 6, null);
    return [N, Bk, Pd];
  }

  /* ---------- rozvržení na list ---------- */
  /** Místo kolem pohledu na kóty (mm papíru) podle nejvzdálenější kóty na každé straně; nahoře navíc nadpis. */
  function rezervy(P) {
    const R = { l: 6, r: 6, t: 6, b: 6 };
    for (const k of P.koty) {
      const m = k.od + 7, [nx, ny] = k.n;
      if (Math.abs(nx) > 0.7) R[nx < 0 ? 'l' : 'r'] = Math.max(R[nx < 0 ? 'l' : 'r'], m);
      else if (Math.abs(ny) > 0.7) R[ny > 0 ? 't' : 'b'] = Math.max(R[ny > 0 ? 't' : 'b'], m);
      else for (const s of ['l', 'r', 't', 'b']) R[s] = Math.max(R[s], m);
    }
    R.t += 8;
    return R;
  }
  function meze(P) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    const bod = ([x, y]) => { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); };
    for (const e of P.prvky) { if (e.t === 'l') e.b.forEach(bod); else if (e.t === 'k') { bod([e.x - e.r, e.y - e.r]); bod([e.x + e.r, e.y + e.r]); } }
    return b;
  }
  function vykres(p, o, opt = {}) {
    const pohledy = p.typ === 'odsavani' ? odsavani(p, o) : uhelnik(p, o);
    const bb = pohledy.map(meze), rez = pohledy.map(rezervy);
    // šířka buňky: pohled s kótami, nebo poznámky pod ním (≈ 1,45 mm na znak písma 2,8 mm), co je širší
    const textu = i => Math.max(0, ...pohledy[i].pozn.map(t => t.length * 1.45 + 4));
    const vel = (b, m, i) => [Math.max((b[2] - b[0]) * m + rez[i].l + rez[i].r, rez[i].l + textu(i)), (b[3] - b[1]) * m + rez[i].t + rez[i].b + 5 * pohledy[i].pozn.length];
    let volba = MERITKA[MERITKA.length - 1], rozm = null;
    for (const mm of MERITKA) {
      const [nN, nB, nP] = bb.map((b, i) => vel(b, mm[0], i));
      const sir = Math.max(nN[0], nP[0]) + nB[0], vys = Math.max(nN[1], nB[1]) + nP[1];
      const razitko = Math.max(nN[0], nP[0]) + 95 <= W - 2 * OKRAJ || Math.max(nN[1], nB[1]) + nP[1] + 26 <= H - 2 * OKRAJ;
      if (sir <= W - 2 * OKRAJ && vys <= H - 2 * OKRAJ - 6 && razitko) { volba = mm; rozm = { nN, nB, nP }; break; }
    }
    const m = volba[0];
    if (!rozm) { const [nN, nB, nP] = bb.map((b, i) => vel(b, m, i)); rozm = { nN, nB, nP }; }
    const sl1 = Math.max(rozm.nN[0], rozm.nP[0]), r1 = Math.max(rozm.nN[1], rozm.nB[1]);
    const x0 = OKRAJ + 2, y0 = OKRAJ + 1;
    const polohy = [[x0, y0], [x0 + sl1, y0], [x0, y0 + r1]];
    const prvky = [];
    const L = (b, typ, z) => prvky.push({ t: 'l', b, z, s: S[typ] || typ, d: typ === 'skr' ? 'c' : typ === 'osa' ? 'o' : undefined });
    const T = (x, y, txt, h = 3, a = 'l', u = 0) => prvky.push({ t: 'txt', x, y, txt, h, a, u });
    pohledy.forEach((P, i) => {
      const b = bb[i], [ox, oy] = polohy[i], REZ = rez[i];
      const map = ([u, v]) => [ox + REZ.l + (u - b[0]) * m, oy + REZ.t + (b[3] - v) * m];
      T(ox + REZ.l, oy + 5, P.nazev, 3.5);
      for (const e of P.prvky) {
        if (e.t === 'l') L(e.b.map(map), e.typ, e.z);
        else { const [x, y] = map([e.x, e.y]); prvky.push({ t: 'k', x, y, r: e.r * m, s: S[e.typ], d: e.typ === 'skr' ? 'c' : undefined }); }
      }
      for (const k of P.koty) kota(map(k.p1), map(k.p2), [k.n[0], -k.n[1]], k.od, k.txt != null ? k.txt : fmt(Math.hypot(k.p2[0] - k.p1[0], k.p2[1] - k.p1[1]) , 1), L, T);
      const yp = oy + REZ.t + (b[3] - b[1]) * m + REZ.b;
      P.pozn.forEach((t, j) => T(ox + REZ.l, yp + 5 * j, t, 2.8));
    });
    // rám, razítko, kontrolní úsečka
    L([[OKRAJ, OKRAJ], [W - OKRAJ, OKRAJ], [W - OKRAJ, H - OKRAJ], [OKRAJ, H - OKRAJ]], 0.5, true);
    const rx = W - OKRAJ - 95, ry = H - OKRAJ - 24;
    L([[rx, ry], [W - OKRAJ, ry], [W - OKRAJ, H - OKRAJ], [rx, H - OKRAJ]], 0.5, true);
    L([[rx, ry + 10], [W - OKRAJ, ry + 10]], 0.25); L([[rx + 45, ry + 10], [rx + 45, H - OKRAJ]], 0.25);
    T(rx + 2, ry + 7, (p.nazev || U.TYPY[p.typ]).slice(0, 48), 4.2);
    T(rx + 2, ry + 15, `Měřítko ${volba[1]}`, 3); T(rx + 2, ry + 21, 'Rozměry v mm', 2.6);
    T(rx + 47, ry + 15, `${U.MATERIALY[p.tisk.material].nazev} · ${opt.datum || ''}`, 2.6);
    T(rx + 47, ry + 21, 'github_site – Úhelníky', 2.6);
    const kx = OKRAJ + 4, ky = H - OKRAJ - 4;
    L([[kx, ky], [kx + 50 * m, ky]], 0.35); L([[kx, ky - 1.5], [kx, ky + 1]], 0.25); L([[kx + 50 * m, ky - 1.5], [kx + 50 * m, ky + 1]], 0.25);
    T(kx + 50 * m + 2, ky + 1, `= 50 mm (kontrola měřítka – tiskněte ve skutečné velikosti 100 %)`, 2.4);
    return { W, H, meritko: volba[1], m, prvky };
  }
  /** Kóta v papíru: vynášecí čáry, kótovací čára se šipkami, číslo nad čarou (čitelné zdola / zprava). */
  function kota(P1, P2, n, od, txt, L, T) {
    const d = [P2[0] - P1[0], P2[1] - P1[1]], l = Math.hypot(d[0], d[1]);
    if (l < 0.3) return;
    const u = [d[0] / l, d[1] / l], D1 = [P1[0] + n[0] * od, P1[1] + n[1] * od], D2 = [P2[0] + n[0] * od, P2[1] + n[1] * od];
    L([[P1[0] + n[0], P1[1] + n[1]], [D1[0] + n[0] * 1.5, D1[1] + n[1] * 1.5]], 'kota');
    L([[P2[0] + n[0], P2[1] + n[1]], [D2[0] + n[0] * 1.5, D2[1] + n[1] * 1.5]], 'kota');
    L([D1, D2], 'kota');
    const sip = (B, s) => L([[B[0] + s * (u[0] * 2.5 - u[1] * 0.8), B[1] + s * (u[1] * 2.5 + u[0] * 0.8)], B, [B[0] + s * (u[0] * 2.5 + u[1] * 0.8), B[1] + s * (u[1] * 2.5 - u[0] * 0.8)]], 'kota');
    sip(D1, 1); sip(D2, -1);
    let uhel = Math.atan2(-u[1], u[0]) * 180 / Math.PI;   // ° proti směru hodin na papíře
    if (uhel > 90.5 || uhel <= -89.5) uhel += 180;
    if (uhel > 180) uhel -= 360;
    const ur = uhel * Math.PI / 180, nahoru = [-Math.sin(ur), -Math.cos(ur)];   // kolmo „nad“ text
    const kratka = l < 9, M = kratka ? [D2[0] + u[0] * 4, D2[1] + u[1] * 4] : [(D1[0] + D2[0]) / 2, (D1[1] + D2[1]) / 2];
    T(M[0] + nahoru[0] * 0.8, M[1] + nahoru[1] * 0.8, txt, 2.8, kratka ? 'l' : 'c', uhel);
  }

  /* ---------- výstupy ---------- */
  const n3 = x => (Math.round(x * 1000) / 1000).toString();
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dash = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(s * 8)} ${n3(s * 5)}"` : d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '');
  function svg(v, o = {}) {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${o.sirkaPx ? 'width="100%"' : `width="${v.W}mm" height="${v.H}mm"`} viewBox="0 0 ${v.W} ${v.H}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`
      + `<rect width="${v.W}" height="${v.H}" fill="#ffffff"/>`;
    for (const e of v.prvky) {
      if (e.t === 'l') s += `<path d="${e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(q[1])).join('')}${e.z ? 'Z' : ''}" fill="none" stroke="#000" stroke-width="${n3(e.s)}" stroke-linecap="round" stroke-linejoin="round"${dash(e.d, Math.max(0.2, e.s))}/>`;
      else if (e.t === 'k') s += `<circle cx="${n3(e.x)}" cy="${n3(e.y)}" r="${n3(e.r)}" fill="none" stroke="#000" stroke-width="${n3(e.s)}"${dash(e.d, Math.max(0.2, e.s))}/>`;
      else {
        const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(e.y)})"` : '';
        s += `<text x="${n3(e.x)}" y="${n3(e.y)}" font-size="${n3(e.h)}" text-anchor="${an}" fill="#000"${rot}>${esc(e.txt)}</text>`;
      }
    }
    return s + '</svg>';
  }
  const bezDiakritiky = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x');
  /** opt: {pismo (TTF base64 – s ním i diakritika), nazev} */
  function pdf(jsPDF, v, opt = {}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
    let uni = false;
    if (opt.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', opt.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
    doc.setProperties({ title: opt.nazev || 'Výkres', creator: 'Úhelníky – výkres' });
    doc.setDrawColor(0, 0, 0); doc.setTextColor(0, 0, 0);
    for (const e of v.prvky) {
      if (e.t === 'txt') {
        const t = uni ? e.txt : bezDiakritiky(e.txt);
        doc.setFontSize(e.h / 0.3528);
        const w = doc.getTextWidth(t), kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0, ur = (e.u || 0) * Math.PI / 180;
        doc.text(t, e.x - Math.cos(ur) * kk, e.y + Math.sin(ur) * kk, e.u ? { angle: e.u } : undefined);
        continue;
      }
      doc.setLineWidth(e.s);
      const sd = Math.max(0.2, e.s);
      if (e.d === 'c') doc.setLineDashPattern([sd * 8, sd * 5], 0); else if (e.d === 'o') doc.setLineDashPattern([sd * 30, sd * 8, sd * 4, sd * 8], 0);
      if (e.t === 'k') doc.circle(e.x, e.y, e.r, 'S');
      else if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
      else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
      if (e.d) doc.setLineDashPattern([], 0);
    }
    return doc;
  }

  const API = { vykres, svg, pdf, MERITKA };
  if (typeof module !== 'undefined') module.exports = API; else window.UHELNIKY_VYKRES = API;
})();
