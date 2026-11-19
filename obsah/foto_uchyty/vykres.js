/* Foto a kamerové úchyty – výkres A4 na šířku (SVG, jednotky mm): bokorys sestavy (obrysy dílů = konvexní obálky
   průmětů, body spojů, úhly), detail prstů s kótami, tabulka závitů a patky, kusovník a tabulka spojů.
   Bez DOM – jde require v node (test). */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const K = uzel ? require('./jadro.js') : window.FOTU;
  const fmt = K.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** Konvexní obálka 2D bodů (monotónní řetěz). */
  function obalka(B) {
    const b = B.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    if (b.length < 3) return b;
    const kriz = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
    const lo = [], hi = [];
    for (const p of b) { while (lo.length >= 2 && kriz(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = b.length - 1; i >= 0; i--) { const p = b[i]; while (hi.length >= 2 && kriz(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  const tx = (x, y, t, o = {}) => `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${o.v || 2.6}" ${o.a ? `text-anchor="${o.a}"` : ''} ${o.b ? 'font-weight="700"' : ''} fill="${o.c || '#111'}">${esc(t)}</text>`;
  const ln = (x1, y1, x2, y2, w = 0.25, d) => `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#111" stroke-width="${w}" ${d ? `stroke-dasharray="${d}"` : ''}/>`;
  const sipky = '<defs><marker id="sip" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z" fill="#111"/></marker></defs>';
  const kota = (x1, y1, x2, y2, t, dx = 0, dy = 0) => `<line x1="${(x1 + dx).toFixed(2)}" y1="${(y1 + dy).toFixed(2)}" x2="${(x2 + dx).toFixed(2)}" y2="${(y2 + dy).toFixed(2)}" stroke="#111" stroke-width="0.18" marker-start="url(#sip)" marker-end="url(#sip)"/>`
    + tx((x1 + x2) / 2 + dx + (y1 === y2 ? 0 : 1), (y1 + y2) / 2 + dy - (y1 === y2 ? 0.8 : 0), t, { v: 2.2, a: y1 === y2 ? 'middle' : 'start' });

  /** SVG výkresu; info = {datum, material, hmotnost, kusovnik: [[název, ks, rozměr, poloha]], spoje: [[spoj, typ, úhel]]}. */
  function sestavVykres(p, model, info) {
    const W = 297, H = 210, P = [];
    P.push(`<rect x="5" y="5" width="${W - 10}" height="${H - 10}" fill="none" stroke="#111" stroke-width="0.5"/>`);
    // --- bokorys sestavy (rovina XZ světa) ---
    const ram = { x: 10, y: 10, w: 150, h: 120 };
    P.push(tx(ram.x, ram.y + 3, 'Sestava – bokorys (X–Z)', { b: true, v: 3 }));
    const obr = model.sestava.map(d => { const B = []; for (let i = 0; i < d.poz.length; i += 9) B.push([d.poz[i], d.poz[i + 2]]); for (let i = 3; i < d.poz.length; i += 9) B.push([d.poz[i], d.poz[i + 2]]); return { d, o: obalka(B) }; });
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const { o } of obr) for (const [x, z] of o) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const m = Math.min((ram.w - 10) / Math.max(1, x1 - x0), (ram.h - 16) / Math.max(1, z1 - z0));
    const mer = [5, 2, 1, 0.5, 0.2, 0.1].find(s => s <= m) || 0.1;
    const X = x => ram.x + 5 + (x - x0) * mer + ((ram.w - 10) - (x1 - x0) * mer) / 2, Y = z => ram.y + ram.h - 4 - (z - z0) * mer;
    for (const { d, o } of obr) {
      P.push(`<polygon points="${o.map(([x, z]) => `${X(x).toFixed(2)},${Y(z).toFixed(2)}`).join(' ')}" fill="${d.netisk ? 'none' : '#e8ecf3'}" stroke="#111" stroke-width="${d.netisk ? 0.25 : 0.35}" ${d.netisk ? 'stroke-dasharray="1.5 1"' : ''}/>`);
    }
    for (const s of model.spoje) { P.push(`<circle cx="${X(s.P[0]).toFixed(2)}" cy="${Y(s.P[2]).toFixed(2)}" r="1" fill="#c0392b"/>`); P.push(tx(X(s.P[0]) + 1.6, Y(s.P[2]) - 1, `${s.i}–${s.i + 1}`, { v: 2.2, c: '#c0392b' })); }
    for (const v of model.vnitrni) P.push(`<circle cx="${X(v.P[0]).toFixed(2)}" cy="${Y(v.P[2]).toFixed(2)}" r="1" fill="none" stroke="#c0392b" stroke-width="0.35"/>`);
    P.push(kota(X(x0), Y(z0) + 3, X(x1), Y(z0) + 3, `${fmt(x1 - x0, 0)} mm`));
    P.push(kota(X(x1) + 3, Y(z0), X(x1) + 3, Y(z1), `${fmt(z1 - z0, 0)} mm`));
    P.push(tx(ram.x + ram.w, ram.y + 3, `měřítko ${mer >= 1 ? fmt(mer, 1) + ':1' : '1:' + fmt(1 / mer, 1)}`, { a: 'end', v: 2.4 }));
    // --- detail prstů ---
    const q = p.prsty, t = q.tl, gp = t + q.vule, dx = 168, dy = 14, s = 3;
    P.push(tx(dx, dy - 1, 'Detail prstů (M5, kompatibilní s akčními kamerami)', { b: true, v: 3 }));
    // bokorys prstu
    const R = q.R, h = q.h, cx = dx + 4 + R * s, base = dy + 4 + (h + R) * s;
    const prof = [[-R, 0], [R, 0], [R, h + 0.4142 * R], [0.7071 * R, h + 0.7071 * R], [0, h + R], [-0.7071 * R, h + 0.7071 * R], [-R, h + 0.4142 * R]];
    P.push(`<polygon points="${prof.map(([u, v]) => `${(cx + u * s).toFixed(2)},${(base - v * s).toFixed(2)}`).join(' ')}" fill="#e8ecf3" stroke="#111" stroke-width="0.35"/>`);
    P.push(`<circle cx="${cx.toFixed(2)}" cy="${(base - h * s).toFixed(2)}" r="${(q.dira / 2 * s).toFixed(2)}" fill="#fff" stroke="#111" stroke-width="0.3"/>`);
    P.push(kota(cx - R * s, base + 3, cx + R * s, base + 3, `${fmt(2 * R, 1)}`));
    P.push(kota(cx + R * s + 3, base, cx + R * s + 3, base - h * s, `${fmt(h, 1)}`));
    P.push(tx(cx, base - h * s - q.dira / 2 * s - 1.5, `Ø ${fmt(q.dira, 1)}`, { a: 'middle', v: 2.2 }));
    // pohled zepředu: 3 prsty a 2 prsty
    const fx = dx + 2 * R * s + 16, fy = base;
    const sk = 1.6;
    const pr = (st, x0, nadpis) => {
      let o = tx(x0 + 12, fy - (h + R) * sk - 2, nadpis, { v: 2.4, a: 'middle' });
      for (const c of st) o += `<rect x="${(x0 + 12 + (c - t / 2) * sk).toFixed(2)}" y="${(fy - (h + R) * sk).toFixed(2)}" width="${(t * sk).toFixed(2)}" height="${((h + R) * sk).toFixed(2)}" fill="#e8ecf3" stroke="#111" stroke-width="0.3"/>`;
      return o;
    };
    P.push(pr([-gp, 0, gp], fx, '3 prsty'));
    P.push(pr([-gp / 2, gp / 2], fx + 30, '2 prsty'));
    P.push(tx(fx, fy + 5, `prst ${fmt(t, 2)} mm · mezera ${fmt(gp, 2)} mm (vůle ${fmt(q.vule, 2)})`, { v: 2.3 }));
    P.push(tx(fx, fy + 8.5, `natočení ±${fmt(K.mezPrstu(p), 0)}° · typické rozměry – ověřit měřením`, { v: 2.1, c: '#555' }));
    // --- závity a patka ---
    let ty = 108;
    P.push(tx(dx, ty, 'Závity a patka', { b: true, v: 3 })); ty += 4;
    for (const [kl, z] of Object.entries(K.ZAVITY)) {
      const L = kl === '14' ? p.zavit.delka14 : p.zavit.delka38;
      P.push(tx(dx, ty, `${z.nazev}: Ø ${fmt(z.d, 3)}, stoupání ${fmt(z.p, 3)} mm, šroub ${fmt(L, 1)} mm, vůle ${fmt(p.zavit.vule, 2)}${p.zavit.kov ? ` · kovová matice ${fmt(z.maticeS, 2)} × ${fmt(z.maticeV, 2)}` : ' · tištěný'}`, { v: 2.3 })); ty += 3.6;
    }
    const a = p.patka;
    P.push(tx(dx, ty, `Studená patka: nožka ${fmt(a.sirka)} × ${fmt(a.delka)} × ${fmt(a.tl, 1)}, krk ${fmt(a.krkSirka)} × ${fmt(a.krk, 1)}, vůle ${fmt(a.vule, 2)} (ISO 518 – typické)`, { v: 2.3 }));
    if (p.clanky.some(c => /^k[vd]$/.test(c.a) || /^k[vd]$/.test(c.b))) {
      const k = p.kostky; ty += 3.6;
      P.push(tx(dx, ty, `Kostky (kompatibilní s LEGO®): ${k.nx} × ${k.ny}, rozteč ${fmt(k.roztec, 2)}, výstupek Ø ${fmt(k.vystupek + k.vuleVyst, 2)} × ${fmt(k.vyskaVyst, 1)}, trubička Ø ${fmt(k.trubicka + k.vuleTrub, 2)}, stěna ${fmt(k.stena, 1)} (typické)`, { v: 2.3 }));
    }
    // --- spoje ---
    ty = 134;
    P.push(tx(10, ty, 'Spoje', { b: true, v: 3 })); ty += 4;
    for (const r of info.spoje.slice(0, 10)) { P.push(tx(10, ty, r[0], { v: 2.3 }) + tx(40, ty, r[1], { v: 2.3 }) + tx(118, ty, r[2], { v: 2.3, a: 'end' })); ty += 3.4; }
    // --- kusovník ---
    let ky = 134;
    const kx = 128;
    P.push(tx(kx, ky, 'Kusovník', { b: true, v: 3 })); ky += 4;
    P.push(tx(kx, ky, 'Díl', { v: 2.2, c: '#555' }) + tx(kx + 78, ky, 'ks', { v: 2.2, c: '#555', a: 'end' }) + tx(kx + 82, ky, 'rozměr (mm)', { v: 2.2, c: '#555' }) + tx(kx + 112, ky, 'tisk', { v: 2.2, c: '#555' })); ky += 1;
    P.push(ln(kx, ky, W - 10, ky, 0.2)); ky += 3.2;
    for (const r of info.kusovnik.slice(0, 11)) {
      const navic = String(r[0]).startsWith('+');   // spojovací materiál přes celou šířku
      P.push(navic ? tx(kx, ky, String(r[0]).slice(0, 96), { v: 2.1 }) : tx(kx, ky, String(r[0]).slice(0, 52), { v: 2.3 }) + tx(kx + 78, ky, String(r[1]), { v: 2.3, a: 'end' }) + tx(kx + 82, ky, r[2] || '', { v: 2.3 }) + tx(kx + 112, ky, r[3] || '', { v: 2.1 }));
      ky += 3.3;
    }
    // --- rohové razítko ---
    const rx = W - 10 - 100, ry = H - 10 - 16;
    P.push(`<rect x="${rx}" y="${ry}" width="100" height="16" fill="#fff" stroke="#111" stroke-width="0.4"/>`);
    P.push(tx(rx + 2, ry + 5, p.nazev || 'Foto úchyty', { b: true, v: 3.2 }));
    P.push(tx(rx + 2, ry + 10, `${info.material} · ${fmt(info.hmotnost, 0)} g dílů · ${info.datum}`, { v: 2.3 }));
    P.push(tx(rx + 2, ry + 14, 'Foto a kamerové úchyty – generátor pro 3D tisk', { v: 2, c: '#555' }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" font-family="DejaVu Sans, Arial, sans-serif">${sipky}<rect width="${W}" height="${H}" fill="#fff"/>${P.join('')}</svg>`;
  }

  const API = { sestavVykres, obalka };
  if (uzel) module.exports = API; else window.FOTU_VYK = API;
})();
