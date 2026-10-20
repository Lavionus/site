/* ============================================================
   Planetárium – výkresy pro stránku (SVG řetězce, bez DOM)
   - pudorys(mech): rameno, kola s ozubením, osy, kóty roztečí
   - bok(mech): boční pohled (průmět do roviny O–E) s výškami vrstev a kótami
   - schema(mech): kinematické schéma = rozvinutý řez podél každého soukolí
   - faze(D, r): ikona fáze Měsíce
   Kreslí se na bílý „papír“ (pevné barvy), aby výkres vypadal stejně ve světlém i tmavém tématu.
   ============================================================ */
(function (koren) {
  'use strict';
  const P = koren.PLAN || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const EK = koren.EvolKola || (typeof require !== 'undefined' ? require('../evolventni_kola/jadro.js') : null);
  const RAD = Math.PI / 180, fmt = P.fmt;
  const n = (x) => (Math.round(x * 100) / 100).toString();
  const BARVY = { den: '#b0552b', zeme: '#2463b0', mesic: '#6b6b6b', uzly: '#7a3fa0', pohon: '#2f7d3a' };
  const SVETLE = { den: '#f3d9cc', zeme: '#d4e3f6', mesic: '#e6e6e6', uzly: '#eadcf3', pohon: '#d7ecd9' };
  let KT = 1; // měřítko písma podle šířky výkresu
  const txt = (x, y, t, o) => { o = o || {}; return `<text x="${n(x)}" y="${n(y)}" font-size="${n((o.h || 3) * KT)}" text-anchor="${o.a || 'middle'}" fill="${o.c || '#222'}"${o.b ? ' font-weight="600"' : ''}${o.rot ? ` transform="rotate(${o.rot} ${n(x)} ${n(y)})"` : ''}>${t}</text>`; };
  const cara = (x1, y1, x2, y2, o) => { o = o || {}; return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${o.c || '#222'}" stroke-width="${n(o.s || 0.3)}"${o.d ? ` stroke-dasharray="${o.d}"` : ''}/>`; };
  /** kóta mezi body (x1,y1)–(x2,y2), odsazená o off (kolmo), text uprostřed */
  function kota(x1, y1, x2, y2, t, off, h) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const a = [x1 + nx * off, y1 + ny * off], b = [x2 + nx * off, y2 + ny * off], s = (h || 2.6) * KT;
    const sip = (p, q) => { const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L, w = s * 0.35, l = s * 0.9; return `<path d="M${n(p[0])} ${n(p[1])}L${n(p[0] + ux * l + uy * w)} ${n(p[1] + uy * l - ux * w)}L${n(p[0] + ux * l - uy * w)} ${n(p[1] + uy * l + ux * w)}Z" fill="#222"/>`; };
    let u = Math.atan2(dy, dx) / RAD; if (u > 90) u -= 180; if (u < -90) u += 180;
    return cara(x1, y1, a[0] + nx * 1, a[1] + ny * 1, { s: 0.15, c: '#555' }) + cara(x2, y2, b[0] + nx * 1, b[1] + ny * 1, { s: 0.15, c: '#555' }) +
      cara(a[0], a[1], b[0], b[1], { s: 0.2 }) + sip(a, b) + sip(b, a) +
      txt((a[0] + b[0]) / 2 + nx * s * 0.45, (a[1] + b[1]) / 2 + ny * s * 0.45 + s * 0.35, t, { h: s / KT, rot: u });
  }

  const cacheObrysu = new Map();
  function obrysKola(m, z, alfa) {
    const k = m + ':' + z + ':' + alfa;
    if (cacheObrysu.has(k)) return cacheObrysu.get(k);
    let body = null;
    try { const g = EK.kolo({ m, z, alfa: alfa || 20, b: 1, dOtvor: 0, tol: 0.05 }); if (g.obrys) body = EK.obrysBody(g, 0.05); } catch (e) { body = null; }
    cacheObrysu.set(k, body); return body;
  }
  const cesta = (b, tx, ty, uhel, fy) => {
    const c = Math.cos(uhel), s = Math.sin(uhel);
    return 'M' + b.map((q) => n(tx + c * q[0] - s * q[1]) + ' ' + n(ty + fy * (s * q[0] + c * q[1]))).join('L') + 'Z';
  };

  /* ---------- půdorys ---------- */
  function pudorys(mech, o) {
    o = o || {};
    const R = mech.rameno, okr = 14;
    let x0 = R.x0, x1 = R.x1, y0 = R.y0, y1 = R.y1;
    for (const g of mech.kola) { x0 = Math.min(x0, g.x - g.ra); x1 = Math.max(x1, g.x + g.ra); y0 = Math.min(y0, g.y - g.ra); y1 = Math.max(y1, g.y + g.ra); }
    x0 -= okr; x1 += okr; y0 -= okr + 8; y1 += okr;
    const W = x1 - x0, H = y1 - y0;
    KT = Math.max(1, W / 240);
    const fy = -1, Ty = (y) => -y;   // v SVG přes viewBox s převrácením y
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x0)} ${n(-y1)} ${n(W)} ${n(H)}" role="img" aria-label="Půdorys ramene s koly">`;
    s += `<path d="M${R.obrys.map((q) => n(q[0]) + ' ' + n(Ty(q[1]))).join('L')}Z" fill="#efe7d6" stroke="#8a7a5a" stroke-width="0.4"/>`;
    const kola = mech.kola.slice().sort((a, b) => a.vrstva - b.vrstva);
    for (const g of kola) {
      const bar = BARVY[g.vlak] || '#333';
      const vybr = o.vybrane && o.vybrane === g.poz;
      if (!g.remenice && o.zuby !== false) {
        const b = obrysKola(g.m || mech.p.m, g.z, mech.p.alfa);
        if (b) s += `<path d="${cesta(b, g.x, Ty(g.y), -(g.psi0 || 0), fy)}" fill="${SVETLE[g.vlak]}" fill-opacity="0.55" stroke="${bar}" stroke-width="${vybr ? 0.7 : 0.25}"/>`;
      } else s += `<circle cx="${n(g.x)}" cy="${n(Ty(g.y))}" r="${n(g.ra)}" fill="${SVETLE[g.vlak]}" fill-opacity="0.55" stroke="${bar}" stroke-width="0.3"/>`;
      s += `<circle cx="${n(g.x)}" cy="${n(Ty(g.y))}" r="${n(g.d / 2)}" fill="none" stroke="${bar}" stroke-width="0.18" stroke-dasharray="1.5 1"/>`;
    }
    // řemínek
    for (const e of mech.zabery.filter((z) => z.remen)) {
      const r = e.a.d / 2;
      s += cara(e.a.x, Ty(e.a.y) - r, e.b.x, Ty(e.b.y) - r, { c: BARVY.zeme, s: 0.6 }) + cara(e.a.x, Ty(e.a.y) + r, e.b.x, Ty(e.b.y) + r, { c: BARVY.zeme, s: 0.6 });
    }
    // osy a kóty roztečí
    for (const e of mech.zabery) {
      const d = Math.hypot(e.a.x - e.b.x, e.a.y - e.b.y);
      s += cara(e.a.x, Ty(e.a.y), e.b.x, Ty(e.b.y), { c: '#555', s: 0.15, d: '3 1 0.6 1' });
      if (o.koty !== false) s += kota(e.a.x, Ty(e.a.y), e.b.x, Ty(e.b.y), 'a = ' + fmt(d, 2), e.a.vrstva % 2 ? -4 : 4, 2.4);
    }
    for (const h of mech.hridele) {
      const r = h.id === 'O' ? mech.p.dStred / 2 : h.id === 'E' ? (h.rVnejsi || 2) : mech.p.dHridel / 2;
      s += `<circle cx="${n(h.x)}" cy="${n(Ty(h.y))}" r="${n(r)}" fill="#fff" stroke="#111" stroke-width="0.35"/>`;
      s += cara(h.x - r - 2, Ty(h.y), h.x + r + 2, Ty(h.y), { s: 0.15 }) + cara(h.x, Ty(h.y) - r - 2, h.x, Ty(h.y) + r + 2, { s: 0.15 });
      s += txt(h.x + r + 1.5, Ty(h.y) - r - 1, h.id === 'O' ? 'O · Slunce' : h.id === 'E' ? 'E · Země' : h.id, { h: 2.6, a: 'start', b: true });
    }
    s += kota(0, Ty(0), mech.D, Ty(0), 'D = ' + fmt(mech.D, 1), -y0 - 9, 3);
    // popisky kol
    for (const g of kola) s += txt(g.x, Ty(g.y) + g.d / 2 * 0.55 + 1, g.remenice ? 'Ø' + fmt(g.d, 0) : 'z' + g.z, { h: 2.4, c: BARVY[g.vlak], b: true });
    return s + '</svg>';
  }

  /* ---------- boční pohled ---------- */
  function bok(mech) {
    const p = mech.p, tl = p.tlRamene, Hg = mech.Hg, Rg = p.globus / 2;
    const zA0 = -tl - p.mezera - p.b, zDeck = zA0 - p.mezera - 3;
    const xMin = Math.min(-mech.pohon.aK - p.m * (p.zK + 2) / 2, mech.rameno.x0) - 26, xMax = Math.max(mech.D + (p.mesic ? p.mesicR + p.mesicD : Rg) + 8, mech.rameno.x1) + 10;
    const zMax = Hg + Rg + 12, zMin = zDeck - 22;
    const W = xMax - xMin, H = zMax - zMin, Z = (z) => -z;
    KT = Math.max(1, W / 260);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(xMin)} ${n(-zMax)} ${n(W)} ${n(H)}" role="img" aria-label="Boční pohled s kótami">`;
    // podstavec
    s += `<rect x="${n(xMin + 18)}" y="${n(Z(zDeck))}" width="${n(W - 26)}" height="3" fill="#c9b48f" stroke="#7a6440" stroke-width="0.3"/>`;
    // sloup a lampa
    s += `<rect x="${n(-p.dStred / 2)}" y="${n(Z(Hg))}" width="${n(p.dStred)}" height="${n(Hg - zDeck)}" fill="#bbb" stroke="#555" stroke-width="0.25"/>`;
    s += `<circle cx="0" cy="${n(Z(Hg))}" r="${n(p.lampa / 2)}" fill="#ffe27a" stroke="#c99a00" stroke-width="0.4"/>` + txt(0, Z(Hg) + 1, 'lampa', { h: 2.6 });
    // rameno (a horní můstek)
    s += `<rect x="${n(mech.rameno.x0)}" y="${n(Z(0))}" width="${n(mech.rameno.delka)}" height="${n(tl)}" fill="#e3d6b8" stroke="#8a7a5a" stroke-width="0.3"/>`;
    if (mech.mustek) s += `<rect x="${n(mech.rameno.x0)}" y="${n(Z(mech.zMustek + tl))}" width="${n(mech.rameno.delka)}" height="${n(tl)}" fill="#e3d6b8" fill-opacity="0.75" stroke="#8a7a5a" stroke-width="0.3"/>` + txt(mech.rameno.x0 + 2, Z(mech.zMustek + tl) - 1.2, 'horní můstek', { h: 2.4, a: 'start', c: '#6a5a3a' });
    // kolo ramene a pastorek kliky
    const rA = p.m * (p.zA + 2) / 2, rK = p.m * (p.zK + 2) / 2;
    s += `<rect x="${n(-rA)}" y="${n(Z(zA0 + p.b))}" width="${n(2 * rA)}" height="${n(p.b)}" fill="${SVETLE.pohon}" stroke="${BARVY.pohon}" stroke-width="0.3"/>`;
    s += `<rect x="${n(-mech.pohon.aK - rK)}" y="${n(Z(zA0 + p.b))}" width="${n(2 * rK)}" height="${n(p.b)}" fill="${SVETLE.pohon}" stroke="${BARVY.pohon}" stroke-width="0.3"/>`;
    s += cara(-mech.pohon.aK, Z(zDeck), -mech.pohon.aK, Z(zA0 + p.b + 1), { s: 0.8, c: '#444' });
    s += txt(-mech.pohon.aK, Z(zDeck) + 6, 'klika K', { h: 2.6 });
    // kola
    for (const g of mech.kola.slice().sort((a, b) => b.y - a.y)) {
      s += `<rect x="${n(g.x - g.ra)}" y="${n(Z(g.z0 + p.b))}" width="${n(2 * g.ra)}" height="${n(p.b)}" fill="${SVETLE[g.vlak]}" fill-opacity="0.85" stroke="${BARVY[g.vlak]}" stroke-width="0.25"/>`;
    }
    // hřídele
    for (const h of mech.hridele) {
      if (h.id === 'O') continue;
      const kol = mech.kola.filter((g) => g.hr === h);
      const top = h.id === 'E' ? Hg - Rg : h.shora ? mech.zMustek + tl : Math.max(...kol.map((g) => g.z0 + p.b)) + 1;
      const spod = h.shora ? Math.min(...kol.map((g) => g.z0)) - 1 : -tl;
      const r = h.id === 'E' ? (h.rVnejsi || 2) : p.dHridel / 2;
      s += `<rect x="${n(h.x - r)}" y="${n(Z(top))}" width="${n(2 * r)}" height="${n(top - spod)}" fill="#999" stroke="#444" stroke-width="0.2"/>`;
    }
    // kotouč uzlů, rameno Měsíce, glóbus, Měsíc
    if (p.mesic) {
      if (p.naklon) {
        const r2 = p.mesicR + 4, t = Math.tan(p.sklonMesice * RAD) * r2;
        s += `<path d="M${n(mech.D - r2)} ${n(Z(mech.zUzly))}L${n(mech.D + r2)} ${n(Z(mech.zUzly))}L${n(mech.D + r2)} ${n(Z(mech.zUzly + 2.5 + 2 * t))}L${n(mech.D - r2)} ${n(Z(mech.zUzly + 2.5))}Z" fill="${SVETLE.uzly}" stroke="${BARVY.uzly}" stroke-width="0.3"/>`;
      }
      s += `<rect x="${n(mech.D - 4)}" y="${n(Z(mech.zRamMesice + 3))}" width="${n(p.mesicR + 8)}" height="3" fill="${SVETLE.mesic}" stroke="${BARVY.mesic}" stroke-width="0.3"/>`;
      s += cara(mech.D + p.mesicR, Z(mech.zRamMesice - 2), mech.D + p.mesicR, Z(Hg), { s: 1, c: '#777' });
      s += `<circle cx="${n(mech.D + p.mesicR)}" cy="${n(Z(Hg))}" r="${n(p.mesicD / 2)}" fill="#ddd" stroke="#666" stroke-width="0.3"/>` + txt(mech.D + p.mesicR, Z(Hg) - p.mesicD / 2 - 1.5, 'Měsíc', { h: 2.6 });
    }
    s += `<circle cx="${n(mech.D)}" cy="${n(Z(Hg))}" r="${n(Rg)}" fill="#cfe1f7" stroke="#2463b0" stroke-width="0.4"/>`;
    const ax = Math.sin(p.sklon * RAD) * (Rg + 6), az = Math.cos(p.sklon * RAD) * (Rg + 6);
    s += cara(mech.D - ax, Z(Hg - az), mech.D + ax, Z(Hg + az), { s: 0.4, c: '#b3261e', d: '2 1' }) + txt(mech.D + ax + 1, Z(Hg + az) - 1, fmt(p.sklon, 2) + '°', { h: 2.6, a: 'start', c: '#b3261e' });
    // kóty
    s += kota(0, Z(zDeck - 4), mech.D, Z(zDeck - 4), 'D = ' + fmt(mech.D, 1) + ' mm', -8, 3);
    s += kota(xMax - 8, Z(0), xMax - 8, Z(Hg), 'výška středu glóbu ' + fmt(Hg, 1), -4, 2.6);
    const xk = xMin + 10;
    s += kota(xk, Z(-tl), xk, Z(0), fmt(tl, 1), 3, 2.2);
    for (let k = 0; k < mech.vrstev; k++) {
      const z0 = mech.zVrstvy(k);
      s += cara(xk + 4, Z(z0), xk + 7, Z(z0), { s: 0.15 }) + txt(xk + 8, Z(z0 + p.b / 2) + 1, `${k + 1}: ${fmt(z0, 1)}–${fmt(z0 + p.b, 1)}`, { h: 2.1, a: 'start', c: '#444' });
    }
    s += txt(xk + 8, Z(mech.zTop) - 3, 'vrstvy kol (z nad ramenem, mm)', { h: 2.1, a: 'start', c: '#444' });
    return s + '</svg>';
  }

  /* ---------- kinematické schéma (rozvinutý řez) ---------- */
  function schema(mech) {
    const p = mech.p, tl = p.tlRamene, sloupce = [];
    let maxX = 0;
    for (const v of mech.vlaky) {
      if (!v.rozvrh || !v.rozvrh.ok) continue;
      const kola = mech.kola.filter((g) => g.vlak === v.id), hrIds = [];
      for (const g of kola) if (!hrIds.includes(g.hr)) hrIds.push(g.hr);
      // pořadí hřídelů podle cesty, poloha = součet úseků
      const pos = new Map(); let x = 0; pos.set(hrIds[0], 0);
      for (let i = 1; i < hrIds.length; i++) { const a = hrIds[i - 1], b = hrIds[i]; x += Math.hypot(a.x - b.x, a.y - b.y); pos.set(b, x); }
      maxX = Math.max(maxX, x);
      sloupce.push({ v, kola, pos, delka: x });
    }
    const zMax = mech.zTop + 14, zMin = -tl - 18, x0 = -40, x1 = maxX + 120;
    const Z = (z) => -z;
    KT = Math.max(1, (x1 - x0) / 300);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x0)} ${n(-zMax)} ${n(x1 - x0)} ${n(zMax - zMin)}" role="img" aria-label="Kinematické schéma">`;
    // nehybný sloup (šrafovaný)
    s += `<defs><pattern id="srafa" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#555" stroke-width="0.4"/></pattern></defs>`;
    s += `<rect x="${n(-p.dStred / 2)}" y="${n(Z(zMax - 6))}" width="${n(p.dStred)}" height="${n(zMax - 6 - zMin - 6)}" fill="url(#srafa)" stroke="#333" stroke-width="0.3"/>`;
    s += txt(0, Z(zMin + 2), 'O – nehybný sloup', { h: 2.6 });
    s += `<rect x="0" y="${n(Z(0))}" width="${n(maxX + 6)}" height="${n(tl)}" fill="#e3d6b8" stroke="#8a7a5a" stroke-width="0.3"/>`;
    s += txt(maxX / 2, Z(-tl) + 4, 'rameno – 1 otáčka za rok (vstup, ω_r = 1)', { h: 2.6 });
    if (mech.mustek) s += `<rect x="0" y="${n(Z(mech.zMustek + tl))}" width="${n(maxX + 6)}" height="${n(tl)}" fill="#e3d6b8" fill-opacity="0.7" stroke="#8a7a5a" stroke-width="0.3"/>` + txt(maxX / 2, Z(mech.zMustek + tl) - 1.5, 'horní můstek (pevně s ramenem)', { h: 2.4 });
    for (const sl of sloupce) {
      const { v, kola, pos } = sl;
      for (const [h, x] of pos) {
        if (h.id === 'O') continue;
        const vl = kola.filter((g) => g.hr === h);
        const top = h.shora ? mech.zMustek : Math.max(...vl.map((g) => g.z0 + p.b)) + (h.id === 'E' ? 4 : 1.5);
        const spod = h.shora ? Math.min(...vl.map((g) => g.z0)) - 1.5 : 0;
        s += cara(x, Z(spod), x, Z(top), { s: h.id === 'E' ? 1.1 : 0.7, c: '#444' });
        if (h.id === 'E') s += txt(x + 1.5, Z(top) + 1, 'E', { h: 2.6, a: 'start', b: true });
      }
      for (const g of kola) {
        const x = pos.get(g.hr), r = g.d / 2, bar = BARVY[g.vlak];
        s += `<rect x="${n(x - r)}" y="${n(Z(g.z0 + p.b))}" width="${n(2 * r)}" height="${n(p.b)}" fill="${g.pevne ? 'url(#srafa)' : SVETLE[g.vlak]}" stroke="${bar}" stroke-width="0.35"/>`;
        s += txt(x, Z(g.z0 + p.b / 2) + 1, (g.remenice ? 'Ø' + fmt(g.d, 0) : 'z' + g.z), { h: 2.4, b: true, c: bar });
        s += txt(x, Z(g.z0 + p.b) - 0.8, (g.pevne ? 'ω=0' : 'ω=' + fmt(g.omegaAbs, 3)), { h: 1.8, c: '#444' });
      }
      const fin = kola.find((g) => g.hr.id === 'E');
      if (fin) s += txt(sl.delka + 6, Z(fin.z0 + p.b / 2) + 1, `${v.nazev}: ${fmt(fin.omegaAbs, 5)} ot./rok`, { h: 2.4, a: 'start', c: BARVY[v.id], b: true });
    }
    return s + '</svg>';
  }

  /* ---------- fáze Měsíce ---------- */
  function faze(D, vel) {
    const r = (vel || 40) / 2 - 1, c = r + 1, e = ((D % 360) + 360) % 360, k = Math.cos(e * RAD);
    // osvětlená část: půlkruh na straně Slunce + elipsa terminátoru (pohled ze severní polokoule)
    const vpravo = e < 180, rx = Math.abs(k) * r;
    const sw1 = vpravo ? 1 : 0;
    const sw2 = (e < 90 || e > 270) ? (vpravo ? 0 : 1) : (vpravo ? 1 : 0);
    const d = `M${n(c)} ${n(c - r)}A${n(r)} ${n(r)} 0 0 ${sw1} ${n(c)} ${n(c + r)}A${n(rx)} ${n(r)} 0 0 ${sw2} ${n(c)} ${n(c - r)}Z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(2 * c)} ${n(2 * c)}" width="${n(2 * c)}" height="${n(2 * c)}" role="img" aria-label="fáze Měsíce"><circle cx="${n(c)}" cy="${n(c)}" r="${n(r)}" fill="#2a2d33" stroke="#888" stroke-width="0.6"/><path d="${d}" fill="#f2efe4"/></svg>`;
  }

  const API = { pudorys, bok, schema, faze, kota, BARVY, SVETLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PLANKresba = API;
})(typeof window !== 'undefined' ? window : globalThis);
