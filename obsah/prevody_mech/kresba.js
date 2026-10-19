/* Návrhář mechanických převodů – geometrie pro kreslení a export SVG (bez DOM).
 * Obrysy jsou ilustrační (lichoběžníkové boky zubů, ne evolventa) – slouží k vizualizaci kinematiky,
 * ne k výrobě. Výrobní geometrii zubů řeší stránka ozubena_kola.html.
 * Souřadnice v mm, osa y nahoru, úhly v radiánech (kladně proti směru hodinových ručiček).
 */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' ? require('./jadro.js') : window.PREVODY;

  const kruh = (r, cx, cy, kroku) => {
    const n = kroku || Math.max(24, Math.min(160, Math.round(r * 1.2)));
    const b = [];
    for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; b.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
    return b;
  };
  const otoc = (body, u, cx, cy) => {
    const c = Math.cos(u), s = Math.sin(u);
    return body.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
  };

  /* Ozubený věnec (vnější = zuby ven, vnitřní = zuby dovnitř), zub č. 0 na úhlu 0. */
  function ozubeni(z, m, alfaSt, vnitrni) {
    const r = m * z / 2, ta = Math.tan((alfaSt || 20) * Math.PI / 180);
    const wp = Math.PI / (2 * z);                         // polovina šířky zubu na roztečné kružnici
    const rHlava = vnitrni ? r - m : r + m, rPata = vnitrni ? r + 1.25 * m : r - 1.25 * m;
    const sirka = rho => {
      // lichoběžníková aproximace boku: vnější zub se k hlavě zužuje, vnitřní k hlavě (dovnitř) také
      const w = vnitrni ? wp + (rho - r) * ta / rho : wp + (r - rho) * ta / rho;
      return Math.max(0.15 * wp, Math.min(w, 0.98 * Math.PI / z));
    };
    const body = [], K = 4;
    for (let j = 0; j < z; j++) {
      const c = 2 * Math.PI * j / z;
      const levy = [], pravy = [];
      for (let i = 0; i <= K; i++) {
        const rho = rPata + (rHlava - rPata) * i / K;
        const w = sirka(rho);
        levy.push([rho * Math.cos(c - w), rho * Math.sin(c - w)]);
        pravy.push([rho * Math.cos(c + w), rho * Math.sin(c + w)]);
      }
      // patní oblouk před zubem (střed mezery)
      const cm = c - Math.PI / z;
      body.push([rPata * Math.cos(cm), rPata * Math.sin(cm)]);
      body.push(...levy);
      body.push([rHlava * Math.cos(c), rHlava * Math.sin(c)]);
      body.push(...pravy.reverse());
    }
    return body;
  }

  /* Obrys řetězového kola: hlavová kružnice s lůžky válečků na roztečné kružnici. */
  function retezoveObrys(z, p) {
    const rp = p / Math.sin(Math.PI / z) / 2;
    const ra = P.obrys({ typ: 'retezove', z, p }).rout;
    const rs = 0.34 * p;                                   // poloměr lůžka (válec ~0,63 p)
    const n = Math.max(z * 10, 120), body = [];
    for (let i = 0; i < n; i++) {
      const t = 2 * Math.PI * i / n;
      let rho = ra;
      const j = Math.round(t * z / (2 * Math.PI));
      const c = 2 * Math.PI * j / z;
      const h = rp * Math.abs(Math.sin(t - c)), t0 = rp * Math.cos(t - c);
      if (h < rs) rho = Math.min(ra, t0 - Math.sqrt(rs * rs - h * h));
      body.push([rho * Math.cos(t), rho * Math.sin(t)]);
    }
    return body;
  }

  /* Tvary komponenty v lokálních souřadnicích (střed 0,0, natočení 0).
   * Vrací pole skupin {druh, cesty:[[x,y]...]}; každá skupina se plní pravidlem evenodd. */
  function tvarKomponenty(k) {
    const r = P.rozdelovaciPrumer(k) / 2;
    const skupiny = [];
    if (k.typ === 'kolo') {
      const rf = r - 1.25 * k.m;
      const diraR = Math.max(1.5, Math.min(0.22 * rf, 12));
      skupiny.push({ druh: 'telo', cesty: [ozubeni(k.z, k.m, k.alfa, false), kruh(diraR, 0, 0, 32)] });
      if (rf > 4 * diraR) skupiny.push({ druh: 'znacka', cesty: [kruh(0.12 * rf, 0.62 * rf, 0, 20)] });
    } else if (k.typ === 'vnitrni') {
      const o = P.obrys(k);
      skupiny.push({ druh: 'telo', cesty: [kruh(o.rout, 0, 0, 180), ozubeni(k.z, k.m, k.alfa, true)] });
      skupiny.push({ druh: 'znacka', cesty: [kruh(0.3 * (o.rout - r - 1.25 * k.m), (o.rout + r + 1.25 * k.m) / 2, 0, 16)] });
    } else if (k.typ === 'retezove') {
      const rf = r - 0.34 * k.p;
      const diraR = Math.max(1.5, Math.min(0.22 * rf, 12));
      skupiny.push({ druh: 'telo', cesty: [retezoveObrys(k.z, k.p), kruh(diraR, 0, 0, 32)] });
      if (rf > 4 * diraR) skupiny.push({ druh: 'znacka', cesty: [kruh(0.12 * rf, 0.62 * rf, 0, 20)] });
    } else if (k.typ === 'remenice') {
      const ro = P.obrys(k).rout, ri = Math.max(r - Math.max(3, 0.14 * r), 0.55 * r);
      const rn = Math.max(4, 0.2 * r), diraR = Math.max(1.5, 0.45 * rn);
      skupiny.push({ druh: 'telo', cesty: [kruh(ro, 0, 0), kruh(ri, 0, 0)] });
      const paprsky = [];
      const w = Math.max(1.5, 0.08 * r);
      for (let i = 0; i < 4; i++) {
        const u = i * Math.PI / 2;
        paprsky.push(otoc([[rn * 0.9, -w / 2], [ri + 0.5, -w / 2], [ri + 0.5, w / 2], [rn * 0.9, w / 2]], u, 0, 0));
      }
      skupiny.push({ druh: 'telo', cesty: [kruh(rn, 0, 0, 40), kruh(diraR, 0, 0, 24)] });
      for (const pp of paprsky) skupiny.push({ druh: 'telo', cesty: [pp] });
      skupiny.push({ druh: 'drazka', cesty: [kruh(r, 0, 0)], otevrena: true });
    }
    return skupiny;
  }

  /* Smyčka řemene/řetězu kolem dvou kružnic jako lomená čára (uzavřená) se známou délkou.
   * Směr průchodu: po kružnici 1 ve směru hodinových ručiček (u otevřeného i kříženého). */
  function smycka(c1, r1, c2, r2, krizeny) {
    const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
    const phi = Math.atan2(dy, dx);
    const cg = krizeny ? (r1 + r2) / d : (r1 - r2) / d;
    if (!(d > 0) || Math.abs(cg) >= 1) return null;
    const g = Math.acos(cg);
    const n1 = phi + g, n2 = phi - g;                   // normály tečen
    const bod = (c, r, u) => [c[0] + r * Math.cos(u), c[1] + r * Math.sin(u)];
    const oblouk = (c, r, u0, u1, out) => {
      const n = Math.max(4, Math.ceil(Math.abs(u1 - u0) * Math.max(r, 2) / 1.5));
      for (let i = 0; i <= n; i++) out.push(bod(c, r, u0 + (u1 - u0) * i / n));
    };
    const b = [];
    if (!krizeny) {
      b.push(bod(c1, r1, n1));
      oblouk(c2, r2, n1, n2, b);                         // P2+ → P2− přes vzdálenou stranu (klesající úhel)
      oblouk(c1, r1, n2, n1 - 2 * Math.PI, b);           // P1− → P1+ přes vzdálenou stranu
    } else {
      b.push(bod(c1, r1, n1));
      oblouk(c2, r2, n1 - Math.PI, n2 + Math.PI, b);     // na kružnici 2 opačný smysl
      oblouk(c1, r1, n2, n1 - 2 * Math.PI, b);
    }
    b.pop();                                             // poslední = první
    let L = 0; const kum = [0];
    for (let i = 0; i < b.length; i++) {
      const p = b[i], q = b[(i + 1) % b.length];
      L += Math.hypot(q[0] - p[0], q[1] - p[1]); kum.push(L);
    }
    return { body: b, kum, delka: L };
  }
  /* Bod na smyčce ve vzdálenosti s od začátku (s se bere modulo délka). */
  function bodNaSmycce(sm, s) {
    const L = sm.delka; s = ((s % L) + L) % L;
    let lo = 0, hi = sm.kum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (sm.kum[mid] <= s) lo = mid; else hi = mid; }
    const p = sm.body[lo], q = sm.body[(lo + 1) % sm.body.length];
    const t = (s - sm.kum[lo]) / ((sm.kum[lo + 1] - sm.kum[lo]) || 1);
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  }

  /* Ohraničení návrhu (mm). */
  function meze(navrh) {
    const H = new Map(navrh.hridele.map(h => [h.id, h]));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k of navrh.komponenty) {
      const h = H.get(k.hridel); if (!h) continue;
      const r = P.obrys(k).rout;
      if (!isFinite(r)) continue;
      x0 = Math.min(x0, h.x - r); x1 = Math.max(x1, h.x + r); y0 = Math.min(y0, h.y - r); y1 = Math.max(y1, h.y + r);
    }
    for (const h of navrh.hridele) { x0 = Math.min(x0, h.x - 5); x1 = Math.max(x1, h.x + 5); y0 = Math.min(y0, h.y - 5); y1 = Math.max(y1, h.y + 5); }
    if (!isFinite(x0)) return { x0: -50, y0: -50, x1: 50, y1: 50 };
    return { x0, y0, x1, y1 };
  }

  /* Úhly komponent v čase t (s). */
  function uhly(vysledek, fazeK, t) {
    const u = {};
    for (const k of vysledek.navrh.komponenty) {
      const hs = vysledek.hridele[k.hridel];
      u[k.id] = (fazeK[k.id] || 0) + (hs && hs.dosazen ? hs.wReal * t : 0);
    }
    return u;
  }

  /* ---------- SVG ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cislo = x => (Math.round(x * 100) / 100).toString();
  const dCesty = (body, zavrit) => body.map((p, i) => (i ? 'L' : 'M') + cislo(p[0]) + ' ' + cislo(-p[1])).join('') + (zavrit === false ? '' : 'Z');

  const BARVY_ROVIN = ['#3d7bd9', '#d9822b', '#2e9e6a', '#9b59b6', '#c0392b', '#16a085'];

  /* Celý návrh jako samostatný SVG dokument (světlé barvy pro tisk). */
  function svg(vysledek, fazeK, volby) {
    volby = volby || {};
    const n = vysledek.navrh, H = new Map(n.hridele.map(h => [h.id, h])), K = new Map(n.komponenty.map(k => [k.id, k]));
    const u = uhly(vysledek, fazeK || {}, volby.t || 0);
    const m = meze(n), okraj = Math.max(10, 0.06 * Math.max(m.x1 - m.x0, m.y1 - m.y0));
    const x0 = m.x0 - okraj, y0 = -(m.y1 + okraj), w = m.x1 - m.x0 + 2 * okraj, h = m.y1 - m.y0 + 2 * okraj;
    const pismo = Math.max(3, 0.025 * Math.max(w, h));
    const o = [];
    o.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cislo(x0)} ${cislo(y0)} ${cislo(w)} ${cislo(h)}" width="${cislo(w)}mm" height="${cislo(h)}mm" font-family="sans-serif">`);
    o.push(`<title>${esc(n.nazev || 'Návrh převodu')}</title>`);
    o.push(`<rect x="${cislo(x0)}" y="${cislo(y0)}" width="${cislo(w)}" height="${cislo(h)}" fill="#ffffff"/>`);
    // roviny odspodu
    const roviny = [...new Set(n.komponenty.map(k => k.rovina))].sort((a, b) => a - b);
    const chybne = new Set(); for (const z of vysledek.zpravy) if (z.uroven === 'chyba') z.prvky.forEach(p => chybne.add(p));
    for (const rv of roviny) {
      o.push(`<g data-rovina="${rv}">`);
      const barva = BARVY_ROVIN[((rv % BARVY_ROVIN.length) + BARVY_ROVIN.length) % BARVY_ROVIN.length];
      for (const k of n.komponenty.filter(k => k.rovina === rv)) {
        const hh = H.get(k.hridel); if (!hh) continue;
        if (!(P.rozdelovaciPrumer(k) > 0)) continue;
        for (const g of tvarKomponenty(k)) {
          const d = g.cesty.map(c => dCesty(otoc(c, u[k.id], hh.x, hh.y), !g.otevrena)).join('');
          if (g.druh === 'telo') o.push(`<path d="${d}" fill="${barva}" fill-opacity="0.28" fill-rule="evenodd" stroke="${chybne.has(k.id) ? '#c0392b' : barva}" stroke-width="${cislo(pismo * 0.08)}"/>`);
          else if (g.druh === 'znacka') o.push(`<path d="${d}" fill="#ffffff" stroke="${barva}" stroke-width="${cislo(pismo * 0.06)}"/>`);
          else o.push(`<path d="${d}" fill="none" stroke="${barva}" stroke-width="${cislo(pismo * 0.04)}" stroke-dasharray="${cislo(pismo * 0.3)} ${cislo(pismo * 0.2)}"/>`);
        }
      }
      // řemeny a řetězy v této rovině
      for (const e of n.vazby) {
        if (e.typ === 'zaber') continue;
        const ka = K.get(e.a), kb = K.get(e.b);
        if (!ka || !kb || ka.rovina !== rv) continue;
        const ha = H.get(ka.hridel), hb = H.get(kb.hridel);
        if (!ha || !hb) continue;
        const sm = smycka([ha.x, ha.y], P.rozdelovaciPrumer(ka) / 2, [hb.x, hb.y], P.rozdelovaciPrumer(kb) / 2, e.krizeny);
        if (!sm) continue;
        if (e.typ === 'remen') o.push(`<path d="${dCesty(sm.body)}" fill="none" stroke="#333" stroke-width="${cislo(Math.max(1.5, pismo * 0.35))}" stroke-opacity="0.75" stroke-linejoin="round"/>`);
        else {
          o.push(`<path d="${dCesty(sm.body)}" fill="none" stroke="#555" stroke-width="${cislo(ka.p * 0.45)}" stroke-opacity="0.55"/>`);
          const N = Math.max(2, Math.round(sm.delka / ka.p));
          for (let i = 0; i < N; i++) {
            const b = bodNaSmycce(sm, i * sm.delka / N);
            o.push(`<circle cx="${cislo(b[0])}" cy="${cislo(-b[1])}" r="${cislo(ka.p * 0.3)}" fill="#444"/>`);
          }
        }
      }
      o.push('</g>');
    }
    // hřídele a popisky
    for (const hh of n.hridele) {
      const hs = vysledek.hridele[hh.id];
      o.push(`<circle cx="${cislo(hh.x)}" cy="${cislo(-hh.y)}" r="${cislo(pismo * 0.35)}" fill="#222"/>`);
      let txt = hh.id;
      if (hs && hs.dosazen) txt += ` · ${P.fmt(hs.nReal, 1)} min⁻¹ ${hs.smer === 'cw' ? '↻' : '↺'}`;
      if (hh.id === n.vstup.hridel) txt += ' · vstup';
      if (hh.id === n.vystup) txt += ' · výstup';
      o.push(`<text x="${cislo(hh.x + pismo * 0.6)}" y="${cislo(-hh.y - pismo * 0.6)}" font-size="${cislo(pismo)}" fill="#111" stroke="#fff" stroke-width="${cislo(pismo * 0.18)}" paint-order="stroke">${esc(txt)}</text>`);
    }
    if (volby.popis !== false) {
      o.push(`<text x="${cislo(x0 + pismo * 0.5)}" y="${cislo(y0 + h - pismo * 0.5)}" font-size="${cislo(pismo * 0.8)}" fill="#555">${esc((n.nazev || '') + ' – obrysy zubů jsou jen ilustrační (měřítko 1 jednotka = 1 mm)')}</text>`);
    }
    o.push('</svg>');
    return o.join('\n');
  }

  const API = { kruh, otoc, ozubeni, retezoveObrys, tvarKomponenty, smycka, bodNaSmycce, meze, uhly, svg, BARVY_ROVIN };
  if (typeof module !== 'undefined') module.exports = API; else window.PREVODY_KRESBA = API;
})();
