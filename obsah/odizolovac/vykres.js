/* ============================================================
   odizolovac/vykres.js – analytický řez stahovákem rovinou kolmou
   na osu Y (pohled zepředu) a detail řezu izolace. Vrací SVG text.
   Barvy přes CSS proměnné (třídy v odizolovac.html).
   ============================================================ */
(function () {
  'use strict';
  const J = (typeof module !== 'undefined') ? require('./jadro.js') : window.ODIZ;
  const G = (typeof module !== 'undefined') ? require('./geometrie.js') : window.ODIZ_GEO;
  const f = (x) => (Math.round(x * 1000) / 1000).toString();

  /* Řezy, které stojí za to ukázat: rovina každé čepele (příčná přímo v ní, podélná uprostřed). */
  function roviny(roz) {
    if (roz.vsechnyCepele) return [{ y: roz.souhrn.yb, nazev: 'Pohled zepředu – všechny čtyři čepele (sevřeno)', cepel: 0 }];
    if (roz.rezim === 'podelny') return [{ y: roz.souhrn.yg, nazev: 'Řez podél kabelu rovinou čepele (sevřeno)' }, { yz: true, x: roz.souhrn.xT, y: roz.souhrn.yg, nazev: 'Řez napříč kabelem u špičky' }];
    if (roz.rezim === 'merka') return [{ pudorys: true, y: 0, nazev: 'Pohled shora' }];
    if (roz.rezim === 'sesivacka') return [{ y: roz.cepele[0].poloha, nazev: 'Řez rovinou čepelí (sevřeno)', cepel: 0 }];
    return roz.cepele.map((c, i) => c.osa === 'X'
      ? { y: c.poloha, nazev: 'Řez rovinou příčné čepele', cepel: i }
      : { y: c.zacatek + (c.P + c.presah) / 2, nazev: 'Řez napříč podélnou čepelí', cepel: i });
  }

  /* Prvky řezu v rovině y: obdélníky tělesa, výřezy, čepele, vodiče. */
  function prvky(roz, y) {
    const zony = roz.zony.filter(z => y >= z.y0 && y <= z.y1);
    const drazky = roz.drazky.filter(g => g.profil === 'valecX' ? Math.abs(y - g.yc) < g.sirka / 2 : (y >= g.y0 && y <= g.y1));
    const strbiny = roz.strbiny.filter(s => s.osa === 'X' ? Math.abs(y - s.poloha) <= s.tl / 2 + 1e-9 : (y >= s.od && y <= s.do));
    const koliky = roz.koliky.filter(k => k.osa === 'Y' ? (y >= k.y0 && y <= k.y1) : Math.abs(y - k.y) < k.d / 2);
    const cepele = [];
    roz.cepele.forEach((c, i) => {
      if (c.osa === 'X' && (roz.vsechnyCepele || Math.abs(y - c.poloha) <= c.t / 2 + 1e-9)) cepele.push({ typ: 'plocha', obrys: G.obrysCepele(c), c, i });
      if (c.osa === 'Y') {
        // průřez kosodélníku v místě y: ostří [a, a+P] nahoře, hřbet [a+pr, a+pr+P] dole
        const a0 = c.zacatek, pr = c.presah, zO = c.zOstri, zH = zO - c.W;
        if (y < a0 || y > a0 + c.P + pr) return;
        const sklon = u => pr > 0 ? (zO - zH) * u / pr : Infinity;
        let z0 = zH, z1 = zO;
        if (y < a0 + pr) z0 = zO - sklon(y - a0);                   // levá šikmá hrana
        if (y > a0 + c.P) z1 = zO - sklon(y - a0 - c.P);             // pravá šikmá hrana
        if (z1 > z0) cepele.push({ typ: 'prurez', x: c.poloha, t: c.t, z0, z1, c, i });
      }
    });
    const vodice = roz.vodice.filter(v => v.profil === 'kruhX' ? Math.abs(y - v.yc) < v.D / 2 : (y >= v.y0 && y <= v.y1));
    return { zony, drazky, strbiny, koliky, cepele, vodice };
  }

  /* Hlavní řez. volby: {sirka px (jen poměr), oznacit: index drážky pro zvýraznění} */
  function rezSvg(roz, y, volby) {
    volby = volby || {};
    if (roz.rezim === 'merka') return pudorysSvg(roz);
    if (roz.rezim === 'podelny' && volby.rovina && volby.rovina.yz) return rezYZ(roz);
    // těleso se kreslí těsně za příčnou štěrbinou (v její rovině by byl vidět jen prázdný průřez štěrbiny);
    // čepel a vodiče se kreslí z roviny řezu přes něj
    const P = prvky(roz, y), R = roz.rozmery;
    const sX = roz.strbiny.find(s => s.osa === 'X' && Math.abs(y - s.poloha) <= s.tl / 2 + 1e-9);
    const T = sX ? prvky(roz, sX.poloha + sX.tl / 2 + 0.05) : P;
    const okraj = Math.max(4, R.x * 0.06), vrch = Math.max(...roz.zony.map(z => z.z1));
    const x0 = -okraj, x1 = R.x + okraj, z0 = -okraj * 1.6, z1 = vrch + okraj + 2;
    const sx = v => f(v), sz = v => f(-v);
    const o = [];
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(-z1)} ${f(x1 - x0)} ${f(z1 - z0)}" class="rez-svg" role="img" aria-label="Řez stahovákem v rovině y = ${J.fmt(y)} mm">`);
    o.push('<defs><pattern id="srafa" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" class="srafa"/></pattern></defs>');
    // těleso
    const zz0 = z => z.z0 || 0;
    for (const z of T.zony) o.push(`<rect class="teleso bez${z.dil === 'horni' ? ' horni' : ''}" x="${sx(z.x0)}" y="${sz(z.z1)}" width="${f(z.x1 - z.x0)}" height="${f(z.z1 - zz0(z))}"/>`);
    for (const z of T.zony) o.push(`<rect fill="url(#srafa)" x="${sx(z.x0)}" y="${sz(z.z1)}" width="${f(z.x1 - z.x0)}" height="${f(z.z1 - zz0(z))}"/>`);
    // obrys tělesa (schodovitá horní plocha), výřezy ho pak přeruší
    if (T.zony.some(z => z.dil)) for (const z of T.zony) o.push(`<rect class="obrys" x="${sx(z.x0)}" y="${sz(z.z1)}" width="${f(z.x1 - z.x0)}" height="${f(z.z1 - zz0(z))}"/>`);
    else if (T.zony.length) {
      const zs = T.zony.slice().sort((a, b) => a.x0 - b.x0);
      let d = `M${sx(zs[0].x0)} ${sz(0)}`;
      for (const z of zs) d += ` L${sx(z.x0)} ${sz(z.z1)} L${sx(z.x1)} ${sz(z.z1)}`;
      d += ` L${sx(zs[zs.length - 1].x1)} ${sz(0)} Z`;
      o.push(`<path class="obrys" d="${d}"/>`);
    }
    // výřezy (barvou pozadí)
    for (const g of T.drazky) {
      const r = g.sirka / 2;
      if (g.profil === 'prizmaY') o.push(`<polygon class="vyrez" points="${g.polygon.map(([x, z]) => sx(Math.max(x0, Math.min(x1, x))) + ',' + sz(z)).join(' ')}"/>`);
      else if (g.profil === 'valecX') o.push(`<rect class="vyrez" x="${sx(x0)}" y="${sz(g.zStred + Math.sqrt(Math.max(0, (g.sirka / 2) ** 2 - (y - g.yc) ** 2)))}" width="${f(x1 - x0)}" height="${f(2 * Math.sqrt(Math.max(0, (g.sirka / 2) ** 2 - (y - g.yc) ** 2)))}"/>`);
      else if (g.profil === 'valec') o.push(`<circle class="vyrez" cx="${sx(g.xc)}" cy="${sz(g.zStred)}" r="${f(r)}"/>`);
      else if (g.profil === 'kruh') {
        o.push(`<path class="vyrez" d="M${sx(g.xc - r)} ${sz(vrch + 3)} L${sx(g.xc - r)} ${sz(g.zDno + r)} A${f(r)} ${f(r)} 0 0 0 ${sx(g.xc + r)} ${sz(g.zDno + r)} L${sx(g.xc + r)} ${sz(vrch + 3)} Z"/>`);
      } else o.push(`<rect class="vyrez" x="${sx(g.xc - r)}" y="${sz(vrch + 3)}" width="${f(2 * r)}" height="${f(vrch + 3 - g.zDno)}"/>`);
    }
    for (const g of T.drazky) {
      const r = g.sirka / 2, z = T.zony.find(q => g.xc >= q.x0 && g.xc <= q.x1), zt = z ? z.z1 : vrch;
      if (g.profil === 'prizmaY' || g.profil === 'valecX') continue;
      if (g.profil === 'valec') { o.push(`<circle class="obrys" cx="${sx(g.xc)}" cy="${sz(g.zStred)}" r="${f(r)}"/>`); continue; }
      o.push(g.profil === 'kruh'
        ? `<path class="obrys" d="M${sx(g.xc - r)} ${sz(zt)} L${sx(g.xc - r)} ${sz(g.zDno + r)} A${f(r)} ${f(r)} 0 0 0 ${sx(g.xc + r)} ${sz(g.zDno + r)} L${sx(g.xc + r)} ${sz(zt)}"/>`
        : `<path class="obrys" d="M${sx(g.xc - r)} ${sz(zt)} L${sx(g.xc - r)} ${sz(g.zDno)} L${sx(g.xc + r)} ${sz(g.zDno)} L${sx(g.xc + r)} ${sz(zt)}"/>`);
    }
    const poly = (pts, cls) => `<polygon class="${cls}" points="${pts.map(([x, z]) => sx(Math.max(x0, Math.min(x1, x))) + ',' + sz(z)).join(' ')}"/>`;
    for (const s of T.strbiny) {
      if (s.polygony) for (const q of s.polygony) o.push(poly(q, 'vyrez'));
      else if (s.osa === 'X') o.push(`<rect class="vyrez" x="${sx(Math.max(s.od, x0))}" y="${sz(s.z1)}" width="${f(Math.min(s.do, x1) - Math.max(s.od, x0))}" height="${f(s.z1 - s.z0)}"/>`);
      else o.push(`<rect class="vyrez" x="${sx(s.poloha - s.tl / 2)}" y="${sz(s.z1)}" width="${f(s.tl)}" height="${f(s.z1 - s.z0)}"/>`);
    }
    for (const k of P.koliky.filter(q => q.osa === 'Y')) o.push(`<circle class="kolik" cx="${sx(k.x)}" cy="${sz(k.z)}" r="${f(k.d / 2)}"/>`);
    for (const k of T.koliky.filter(q => q.osa !== 'Y')) {
      const sir = 2 * Math.sqrt(Math.max(0, (k.d / 2) ** 2 - (y - k.y) ** 2));
      const ka = k.z0 !== undefined ? Math.max(k.z0, 0) : -1, kb = k.z1 !== undefined ? Math.min(k.z1, vrch) : vrch + 3;
      o.push(`<rect class="vyrez" x="${sx(k.x - sir / 2)}" y="${sz(kb)}" width="${f(sir)}" height="${f(kb - ka)}"/>`);
      o.push(`<rect class="kolik" x="${sx(k.x - 0.8)}" y="${sz(kb - 0.3)}" width="1.6" height="${f(kb - ka - 0.6)}"/>`);
    }
    if (roz.kloub) o.push(`<clipPath id="orez"><rect x="0" y="${sz(vrch)}" width="${f(roz.kloub.Bx)}" height="${f(vrch)}"/></clipPath><g clip-path="url(#orez)">`);
    for (const s of roz.strbiny.filter(q => q.osa === 'X' && (roz.vsechnyCepele || Math.abs(y - q.poloha) <= q.tl / 2 + 1e-9) && q.polygony)) for (const q of s.polygony) o.push(poly(q, 'strbina'));
    if (roz.kloub) o.push('</g>');
    if (sX && !sX.polygony) o.push(`<rect class="strbina" x="${sx(Math.max(sX.od, x0))}" y="${sz(sX.z1)}" width="${f(Math.min(sX.do, x1) - Math.max(sX.od, x0))}" height="${f(sX.z1 - sX.z0)}"/>`);
    // čepele
    for (const c of P.cepele) {
      if (c.typ === 'plocha') o.push(`<polygon class="cepel za" points="${c.obrys.map(([u, z]) => sx(u) + ',' + sz(z)).join(' ')}"/>`);
      else o.push(`<rect class="cepel" x="${sx(c.x - c.t / 2)}" y="${sz(c.z1)}" width="${f(c.t)}" height="${f(c.z1 - c.z0)}"/>`);
    }
    // vodiče
    for (const v of P.vodice) {
      if (v.profil === 'kruhX') {
        o.push(`<rect class="izolace" x="${sx(x0)}" y="${sz(v.zDno + v.D)}" width="${f(x1 - x0)}" height="${f(v.D)}"/>`);
        o.push(`<rect class="jadro" opacity="0.35" x="${sx(x0)}" y="${sz(v.zDno + (v.D + v.d) / 2)}" width="${f(x1 - x0)}" height="${f(v.d)}"/>`);
      } else if (v.profil === 'kruh') {
        o.push(`<circle class="izolace" cx="${sx(v.xc)}" cy="${sz(v.zDno + v.D / 2)}" r="${f(v.D / 2)}"/>`);
        o.push(`<circle class="jadro" cx="${sx(v.xc)}" cy="${sz(v.zDno + v.D / 2)}" r="${f(v.d / 2)}"/>`);
      } else {
        o.push(`<rect class="izolace" x="${sx(v.xc - v.S / 2)}" y="${sz(v.zDno + v.H)}" width="${f(v.S)}" height="${f(v.H)}" rx="${f(v.H / 2.4)}"/>`);
        o.push(`<rect class="jadro-pl" x="${sx(v.xc - v.S / 2 + v.t)}" y="${sz(v.zDno + v.H - v.t)}" width="${f(v.S - 2 * v.t)}" height="${f(v.H - 2 * v.t)}" rx="${f(v.H / 3)}"/>`);
      }
    }
    // výška ostří
    for (const c of P.cepele) {
      if (c.c.sklonCepele !== undefined) {                                         // šikmý kus: zvýraznit jen ostří a šipku tahu
        const [E0, E1] = c.obrys;
        o.push(`<line class="ostri" x1="${sx(E0[0])}" y1="${sz(E0[1])}" x2="${sx(E1[0])}" y2="${sz(E1[1])}"/>`);
        const ya = roz.souhrn.zTop + 1.2;
        const sm = roz.souhrn.smerPosunu || -1, xa = sm > 0 ? x0 + 1 : x1 - 2, xb = sm > 0 ? x1 - 2 : x0 + 1;
        o.push(`<path class="sipka" d="M${sx(xa)} ${sz(ya)} L${sx(xb)} ${sz(ya)} M${sx(xb - sm * 1.2)} ${sz(ya + 0.9)} L${sx(xb)} ${sz(ya)} L${sx(xb - sm * 1.2)} ${sz(ya - 0.9)}"/>`);
        continue;
      }
      if (c.typ !== 'plocha') { o.push(`<line class="ostri" x1="${sx(x0)}" y1="${sz(roz.zE)}" x2="${sx(x1)}" y2="${sz(roz.zE)}"/>`); continue; }
      const [E0, E1] = c.obrys, k = (E1[1] - E0[1]) / (E1[0] - E0[0]), zz = x => E0[1] + k * (x - E0[0]);
      o.push(`<line class="ostri" x1="${sx(x0)}" y1="${sz(zz(x0))}" x2="${sx(x1)}" y2="${sz(zz(x1))}"/>`);
    }
    if (roz.souhrn && roz.souhrn.zJ !== undefined) o.push(`<line class="dosed" x1="${sx(x0)}" y1="${sz(roz.souhrn.zJ)}" x2="${sx(x1)}" y2="${sz(roz.souhrn.zJ)}"/>`);
    // čísla drážek
    const fs = Math.max(1.6, Math.max(x1 - x0, z1 - z0) / 40);
    P.drazky.filter(g => g.profil !== 'prizmaY' && g.profil !== 'valecX').forEach(g => {
      const j = roz.drazky.indexOf(g);
      o.push(`<text class="popis${volby.oznacit === j ? ' vybrany' : ''}" x="${sx(g.xc)}" y="${sz(z0 + fs * 0.4)}" font-size="${f(fs)}" text-anchor="middle">${j + 1}</text>`);
    });
    if (roz.rezim === 'podelny') o.push(`<text class="popis" x="${sx(x0 + 1)}" y="${sz(roz.souhrn.zTop + 1.2) - fs * 0.35}" font-size="${f(fs * 0.8)}">posun objímky po kabelu (kabel se táhne opačně)</text>`);
    else if (!roz.vsechnyCepele) o.push(`<text class="popis" x="${sx(x1 - 0.5)}" y="${sz(roz.zE) - fs * 0.35}" font-size="${f(fs * 0.8)}" text-anchor="end">ostří z = ${J.fmt(roz.zE)}</text>`);
    o.push('</svg>');
    return o.join('');
  }

  /* Detail jedné drážky: vodič na dně, ostří, hloubka řezu a zbytek izolace. */
  function detailSvg(roz, j) {
    if (roz.nastaveni) return detailV(roz, j);
    if (roz.rezim === 'merka') return '';
    if (roz.rezim === 'podelny') return detailSpicky(roz);
    const g = roz.drazky[j];
    if (!g) return '';
    const v = roz.vodice.find(q => Math.abs(q.xc - g.xc) < 1e-6) || null;
    const r = J.rozborDrazky(roz, j);
    const D = v ? (v.profil === 'kruh' ? v.D : v.H) : g.sirka;
    const sir = g.sirka / 2 + 1.2, xL = g.xc - sir, xR = g.xc + sir;
    const zL = g.zDno - 1.4 - (g.sirka / 2 + 1.2) * 2 / 15 * 2.4, zH = g.zDno + Math.min(D, 3.2) + 0.6;
    const o = [];
    if (g.profil === 'valec') return detailValec(roz, g, v, r);
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(xL)} ${f(-zH)} ${f(xR - xL)} ${f(zH - zL)}" class="rez-svg detail" role="img" aria-label="Detail řezu izolace">`);
    o.push(`<rect class="teleso" x="${f(xL)}" y="${f(-g.zDno)}" width="${f(xR - xL)}" height="${f(g.zDno - zL)}"/>`);
    const R = g.sirka / 2;
    if (g.profil === 'kruh') {
      o.push(`<path class="teleso" d="M${f(xL)} ${f(-zH)} L${f(g.xc - R)} ${f(-zH)} L${f(g.xc - R)} ${f(-(g.zDno + R))} A${f(R)} ${f(R)} 0 0 0 ${f(g.xc + R)} ${f(-(g.zDno + R))} L${f(g.xc + R)} ${f(-zH)} L${f(xR)} ${f(-zH)} L${f(xR)} ${f(-g.zDno)} L${f(xL)} ${f(-g.zDno)} Z"/>`);
    } else {
      o.push(`<rect class="teleso" x="${f(xL)}" y="${f(-zH)}" width="${f(g.xc - R - xL)}" height="${f(zH - g.zDno)}"/>`);
      o.push(`<rect class="teleso" x="${f(g.xc + R)}" y="${f(-zH)}" width="${f(xR - g.xc - R)}" height="${f(zH - g.zDno)}"/>`);
    }
    // čepel vychází zespodu až do výšky ostří
    const c = roz.cepele.find(q => q.osa === 'X' ? (g.xc > q.zacatek && g.xc < q.zacatek + q.P + q.presah) : Math.abs(q.poloha - g.xc) < g.sirka / 2) || roz.cepele[0];
    if (c.osa === 'X') o.push(`<rect class="cepel" x="${f(xL)}" y="${f(-roz.zE)}" width="${f(xR - xL)}" height="${f(roz.zE - zL)}" opacity="0.55"/>`);
    else o.push(`<rect class="cepel" x="${f(c.poloha - c.t / 2)}" y="${f(-roz.zE)}" width="${f(c.t)}" height="${f(roz.zE - zL)}"/>`);
    if (v && v.profil === 'kruh') {
      o.push(`<circle class="izolace" cx="${f(g.xc)}" cy="${f(-(g.zDno + v.D / 2))}" r="${f(v.D / 2)}"/>`);
      o.push(`<circle class="jadro" cx="${f(g.xc)}" cy="${f(-(g.zDno + v.D / 2))}" r="${f(v.d / 2)}"/>`);
    } else if (v) {
      o.push(`<rect class="izolace" x="${f(g.xc - v.S / 2)}" y="${f(-(g.zDno + v.H))}" width="${f(v.S)}" height="${f(v.H)}" rx="${f(v.H / 2.4)}"/>`);
      o.push(`<rect class="jadro-pl" x="${f(g.xc - v.S / 2 + v.t)}" y="${f(-(g.zDno + v.H - v.t))}" width="${f(v.S - 2 * v.t)}" height="${f(v.H - 2 * v.t)}" rx="${f(v.H / 3)}"/>`);
    }
    o.push(`<line class="ostri" x1="${f(xL)}" y1="${f(-roz.zE)}" x2="${f(xR)}" y2="${f(-roz.zE)}"/>`);
    // kóty: c (dno → ostří) a zbytek izolace (ostří → jádro)
    const xk = c.osa === 'X' ? g.xc + Math.min(R * 0.45, 1.2) : c.poloha + 0.5, fs = (xR - xL) / 15;
    o.push(`<line class="kota" x1="${f(xk)}" y1="${f(-g.zDno)}" x2="${f(xk)}" y2="${f(-roz.zE)}"/>`);
    if (r.zbytek > 0) o.push(`<line class="kota zbytek" x1="${f(xk)}" y1="${f(-roz.zE)}" x2="${f(xk)}" y2="${f(-(roz.zE + r.zbytek))}"/>`);
    o.push(`<rect class="stitek" x="${f(xL)}" y="${f(-zL - 2.25 * fs)}" width="${f(xR - xL)}" height="${f(2.25 * fs)}"/>`);
    o.push(`<text class="kota-text" x="${f(g.xc)}" y="${f(-zL - 1.3 * fs)}" font-size="${f(fs)}" text-anchor="middle">řez c = ${J.fmt(r.c)} mm</text>`);
    o.push(`<text class="kota-text zb" x="${f(g.xc)}" y="${f(-zL - 0.3 * fs)}" font-size="${f(fs * 0.85)}" text-anchor="middle">do jádra zbývá ${J.fmt(r.zbytek)} mm</text>`);
    o.push('</svg>');
    return o.join('');
  }

  /* Detail drážky sešívačky: vodič sevřený mezi spodním a horním ostřím. */
  function detailValec(roz, g, v, r) {
    const R = g.sirka / 2, fs = (2 * R + 2.4) / 15;
    const xL = g.xc - R - 1.2, xR = g.xc + R + 1.2, zH = g.zStred + R + 1.2, zL = g.zStred - R - 1.2 - 2.4 * fs;
    const zJ = roz.souhrn.zJ, cd = roz.cepele.find(c => c.smer === 1), ch = roz.cepele.find(c => c.smer === -1);
    const lin = c => { const [E0, E1] = G.obrysCepele(c), k = (E1[1] - E0[1]) / (E1[0] - E0[0]); return x => E0[1] + k * (x - E0[0]); };
    const zd = lin(cd), zh = lin(ch);
    const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(xL)} ${f(-zH)} ${f(xR - xL)} ${f(zH - zL)}" class="rez-svg detail" role="img" aria-label="Detail řezu izolace">`];
    o.push(`<rect class="teleso" x="${f(xL)}" y="${f(-zJ)}" width="${f(xR - xL)}" height="${f(zJ - zL)}"/>`);
    o.push(`<rect class="teleso horni" x="${f(xL)}" y="${f(-zH)}" width="${f(xR - xL)}" height="${f(zH - zJ)}"/>`);
    o.push(`<circle class="vyrez" cx="${f(g.xc)}" cy="${f(-g.zStred)}" r="${f(R)}"/><circle class="obrys" cx="${f(g.xc)}" cy="${f(-g.zStred)}" r="${f(R)}"/>`);
    o.push(`<polygon class="cepel" opacity="0.55" points="${f(xL)},${f(-zd(xL))} ${f(xR)},${f(-zd(xR))} ${f(xR)},${f(-zL)} ${f(xL)},${f(-zL)}"/>`);
    o.push(`<polygon class="cepel" opacity="0.55" points="${f(xL)},${f(-zh(xL))} ${f(xR)},${f(-zh(xR))} ${f(xR)},${f(-zH)} ${f(xL)},${f(-zH)}"/>`);
    if (v) {
      o.push(`<circle class="izolace" cx="${f(g.xc)}" cy="${f(-(g.zDno + v.D / 2))}" r="${f(v.D / 2)}"/>`);
      o.push(`<circle class="jadro" cx="${f(g.xc)}" cy="${f(-(g.zDno + v.D / 2))}" r="${f(v.d / 2)}"/>`);
    }
    o.push(`<line class="ostri" x1="${f(xL)}" y1="${f(-zd(xL))}" x2="${f(xR)}" y2="${f(-zd(xR))}"/><line class="ostri" x1="${f(xL)}" y1="${f(-zh(xL))}" x2="${f(xR)}" y2="${f(-zh(xR))}"/>`);
    o.push(`<line class="dosed" x1="${f(xL)}" y1="${f(-zJ)}" x2="${f(xR)}" y2="${f(-zJ)}"/>`);
    o.push(`<rect class="stitek" x="${f(xL)}" y="${f(-zL - 2.25 * fs)}" width="${f(xR - xL)}" height="${f(2.25 * fs)}"/>`);
    o.push(`<text class="kota-text" x="${f(g.xc)}" y="${f(-zL - 1.3 * fs)}" font-size="${f(fs)}" text-anchor="middle">řez dole ${J.fmt(r.c)} · nahoře ${J.fmt(r.cH)} mm</text>`);
    o.push(`<text class="kota-text zb" x="${f(g.xc)}" y="${f(-zL - 0.3 * fs)}" font-size="${f(fs * 0.85)}" text-anchor="middle">do jádra zbývá nejméně ${J.fmt(r.zbytek)} mm</text>`);
    o.push('</svg>');
    return o.join('');
  }

  /* Kleště s V: kosočtverec čtyř ostří při nastavení pro vodič j, vodič uprostřed. */
  function detailV(roz, j) {
    const n = roz.nastaveni[j];
    if (!n) return '';
    const S = roz.souhrn, k = S.k, xc = S.xc, zv = S.zv, h = n.h, zc = zv + h / 2, R = n.D / 2;
    const a = R + 0.9, xL = xc - a, xR = xc + a, zH = zc + a, zL0 = zc - a, fs = 2 * a / 14, zL = zL0 - 2.4 * fs;
    const lin = (z0, kk) => x => z0 + kk * (x - xc);
    const hrany = [lin(zv, k), lin(zv, -k), lin(zv + h, k), lin(zv + h, -k)];
    const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(xL)} ${f(-zH)} ${f(xR - xL)} ${f(zH - zL)}" class="rez-svg detail" role="img" aria-label="Kosočtverec ostří">`];
    // čepele: spodní pod svými ostřími, horní nad
    const pas = (fz, dolu) => `<polygon class="cepel" opacity="0.4" points="${f(xL)},${f(-fz(xL))} ${f(xR)},${f(-fz(xR))} ${f(xR)},${f(dolu ? -zL0 : -zH)} ${f(xL)},${f(dolu ? -zL0 : -zH)}"/>`;
    o.push(pas(hrany[0], true), pas(hrany[1], true), pas(hrany[2], false), pas(hrany[3], false));
    o.push(`<circle class="izolace" cx="${f(xc)}" cy="${f(-zc)}" r="${f(R)}"/><circle class="jadro" cx="${f(xc)}" cy="${f(-zc)}" r="${f(n.d / 2)}"/>`);
    for (const fz of hrany) o.push(`<line class="ostri" x1="${f(xL)}" y1="${f(-fz(xL))}" x2="${f(xR)}" y2="${f(-fz(xR))}"/>`);
    o.push(`<circle class="kota" fill="none" cx="${f(xc)}" cy="${f(-zc)}" r="${f(n.r)}" stroke-dasharray="0.15 0.1"/>`);
    o.push(`<rect class="stitek" x="${f(xL)}" y="${f(-zL0)}" width="${f(xR - xL)}" height="${f(2.4 * fs)}"/>`);
    o.push(`<text class="kota-text" x="${f(xc)}" y="${f(-zL0 + 1.05 * fs)}" font-size="${f(fs)}" text-anchor="middle">šroub ${n.otacky === null ? '–' : J.fmt(n.otacky, 2) + ' ot.'} · ⌀ ${J.fmt(2 * n.r)} mm</text>`);
    o.push(`<text class="kota-text zb" x="${f(xc)}" y="${f(-zL0 + 2.1 * fs)}" font-size="${f(fs * 0.85)}" text-anchor="middle">řez ${J.fmt(n.c)} z izolace ${J.fmt(n.t)} mm</text>`);
    o.push('</svg>');
    return o.join('');
  }

  /* Objímka: řez napříč kabelem (rovina YZ) – čelisti, válcová drážka, kabel, čepel z boku. */
  function rezYZ(roz, detail) {
    const g = roz.drazky[0], c = roz.cepele[0], v = roz.vodice[0], S = roz.souhrn, R = g.sirka / 2;
    let y0 = -3, y1 = S.yJ + 3, z0 = -3, z1 = S.zTop + 3;
    if (detail) { y0 = g.yc - R * 0.6; y1 = g.yc + R * 0.6; z0 = g.zDno - 1.2; z1 = g.zDno + Math.min(2.6, R); }
    const fs = Math.max(0.3, (y1 - y0) / (detail ? 14 : 28));
    const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(y0)} ${f(-z1)} ${f(y1 - y0)} ${f(z1 - z0 + (detail ? 2.4 * fs : 0))}" class="rez-svg${detail ? ' detail' : ''}" role="img" aria-label="Řez napříč kabelem">`];
    o.push('<defs><pattern id="srafa2" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" class="srafa"/></pattern></defs>');
    o.push(`<rect class="teleso bez" x="0" y="${f(-S.zJ)}" width="${f(S.yJ)}" height="${f(S.zJ)}"/><rect class="teleso bez horni" x="0" y="${f(-S.zTop)}" width="${f(S.yJ)}" height="${f(S.zTop - S.zJ)}"/>`);
    o.push(`<rect fill="url(#srafa2)" x="0" y="${f(-S.zTop)}" width="${f(S.yJ)}" height="${f(S.zTop)}"/>`);
    o.push(`<circle class="vyrez" cx="${f(g.yc)}" cy="${f(-g.zStred)}" r="${f(R)}"/><circle class="obrys" cx="${f(g.yc)}" cy="${f(-g.zStred)}" r="${f(R)}"/>`);
    o.push(`<rect class="obrys" x="0" y="${f(-S.zTop)}" width="${f(S.yJ)}" height="${f(S.zTop)}"/>`);
    o.push(`<rect class="cepel" x="${f(c.poloha - c.t / 2)}" y="${f(-c.zOstri)}" width="${f(c.t)}" height="${f(c.W * Math.cos(c.sklonCepele || 0))}"/>`);
    o.push(`<circle class="izolace" cx="${f(g.yc)}" cy="${f(-(g.zDno + v.D / 2))}" r="${f(v.D / 2)}"/><circle class="jadro" opacity="0.5" cx="${f(g.yc)}" cy="${f(-(g.zDno + v.D / 2))}" r="${f(v.d / 2)}"/>`);
    o.push(`<line class="ostri" x1="${f(y0)}" y1="${f(-c.zOstri)}" x2="${f(y1)}" y2="${f(-c.zOstri)}"/><line class="dosed" x1="${f(y0)}" y1="${f(-S.zJ)}" x2="${f(y1)}" y2="${f(-S.zJ)}"/>`);
    if (detail) {
      const r = J.rozborDrazky(roz, 0);
      o.push(`<rect class="stitek" x="${f(y0)}" y="${f(-z0)}" width="${f(y1 - y0)}" height="${f(2.4 * fs)}"/>`);
      o.push(`<text class="kota-text" x="${f((y0 + y1) / 2)}" y="${f(-z0 + 1.05 * fs)}" font-size="${f(fs)}" text-anchor="middle">řez c = ${J.fmt(r.c)} mm</text>`);
      o.push(`<text class="kota-text zb" x="${f((y0 + y1) / 2)}" y="${f(-z0 + 2.1 * fs)}" font-size="${f(fs * 0.85)}" text-anchor="middle">z pláště zbývá ${J.fmt(r.zbytek)} mm</text>`);
    } else o.push(`<text class="popis" x="${f(y1 - 0.5)}" y="${f(-c.zOstri - fs * 0.35)}" font-size="${f(fs)}" text-anchor="end">ostří z = ${J.fmt(c.zOstri)}</text>`);
    o.push('</svg>');
    return o.join('');
  }

  /* Objímka: detail špičky podél kabelu – dno drážky, plášť, odkrytá část ostří. */
  function detailSpicky(roz) {
    const g = roz.drazky[0], c = roz.cepele[0], v = roz.vodice[0], r = J.rozborDrazky(roz, 0), S = roz.souhrn;
    const xT = S.xT, zT = c.zOstri, a = Math.max(2.2, S.delkaSpicky * 1.6), sm = S.smerPosunu || -1;
    const xL = sm < 0 ? xT - a : xT - a * 0.6, xR = sm < 0 ? xT + a * 0.6 : xT + a, zL0 = g.zDno - a * 0.55, zH = g.zDno + a * 0.65, fs = (xR - xL) / 14, zL = zL0 - 2.4 * fs;
    const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(xL)} ${f(-zH)} ${f(xR - xL)} ${f(zH - zL)}" class="rez-svg detail" role="img" aria-label="Detail špičky čepele">`];
    o.push(`<rect class="teleso" x="${f(xL)}" y="${f(-g.zDno)}" width="${f(xR - xL)}" height="${f(g.zDno - zL0)}"/>`);
    o.push(`<rect class="izolace" x="${f(xL)}" y="${f(-(g.zDno + v.D))}" width="${f(xR - xL)}" height="${f(v.D)}"/>`);
    o.push(`<rect class="jadro" opacity="0.35" x="${f(xL)}" y="${f(-(g.zDno + v.D) + (v.D - v.d) / 2)}" width="${f(xR - xL)}" height="${f(v.d)}"/>`);
    o.push(`<polygon class="cepel" points="${c.obrys.map(([x, z]) => f(x) + ',' + f(-z)).join(' ')}"/>`);
    const [E0, E1] = c.obrys;
    o.push(`<line class="ostri" x1="${f(E0[0])}" y1="${f(-E0[1])}" x2="${f(E1[0])}" y2="${f(-E1[1])}"/>`);
    o.push(`<line class="dosed" x1="${f(xL)}" y1="${f(-g.zDno)}" x2="${f(xR)}" y2="${f(-g.zDno)}"/>`);
    const xk = sm < 0 ? xL + 0.3 : xR - 0.3;
    o.push(`<path class="sipka" d="M${f(xT)} ${f(-zH + 0.6)} L${f(xk)} ${f(-zH + 0.6)} M${f(xk - sm * 0.5)} ${f(-zH + 0.25)} L${f(xk)} ${f(-zH + 0.6)} L${f(xk - sm * 0.5)} ${f(-zH + 0.95)}"/>`);
    o.push(`<rect class="stitek" x="${f(xL)}" y="${f(-zL0)}" width="${f(xR - xL)}" height="${f(2.4 * fs)}"/>`);
    o.push(`<text class="kota-text" x="${f((xL + xR) / 2)}" y="${f(-zL0 + 1.05 * fs)}" font-size="${f(fs)}" text-anchor="middle">špička ${J.fmt(r.c)} mm nad dnem · ostří ${J.fmt(S.delkaSpicky)} mm</text>`);
    o.push(`<text class="kota-text zb" x="${f((xL + xR) / 2)}" y="${f(-zL0 + 2.1 * fs)}" font-size="${f(fs * 0.85)}" text-anchor="middle">z pláště zbývá ${J.fmt(r.zbytek)} mm</text>`);
    o.push('</svg>');
    return o.join('');
  }

  /* Měrka: pohled shora (Y nahoru = dozadu). */
  function pudorysSvg(roz) {
    const D = roz.deska, Y = v => D.y - v;
    const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${f(D.x + 4)} ${f(D.y + 6)}" class="rez-svg" role="img" aria-label="Měrka shora">`];
    o.push(`<rect class="teleso" x="0" y="0" width="${f(D.x)}" height="${f(D.y)}"/>`);
    for (const c of roz.kanaly) o.push(`<rect class="vyrez" x="${f(c.xc - c.w / 2)}" y="${f(Y(c.L))}" width="${f(c.w)}" height="${f(c.L)}"/><rect class="obrys" x="${f(c.xc - c.w / 2)}" y="${f(Y(c.L))}" width="${f(c.w)}" height="${f(c.L + 0.01)}"/>`);
    for (const h of roz.otvory) o.push(`<circle class="vyrez" cx="${f(h.x)}" cy="${f(Y(h.y))}" r="${f(h.d / 2)}"/><circle class="obrys" cx="${f(h.x)}" cy="${f(Y(h.y))}" r="${f(h.d / 2)}"/>`);
    for (const r of roz.obdelniky) o.push(`<rect class="ryti" x="${f(r[0])}" y="${f(Y(r[3]))}" width="${f(r[2] - r[0])}" height="${f(r[3] - r[1])}"/>`);
    o.push(`<text class="popis" x="${f(D.x / 2)}" y="${f(D.y + 3.4)}" font-size="2.2" text-anchor="middle">přední hrana – místo řezu při odměřování</text>`);
    o.push('</svg>');
    return o.join('');
  }

  const api = { roviny, prvky, rezSvg, detailSvg };
  if (typeof module !== 'undefined') module.exports = api; else window.ODIZ_VYKRES = api;
})();
