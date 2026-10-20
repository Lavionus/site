/* ============================================================
   Vrtací šablony – 2D náhledy (řetězce SVG, bez DOM)
   - deska(dil, nast)       → deska v měřítku s dírami, obrysem šablony, referenčními hranami a kótami
   - rez(dil, nast)         → boční řez hloubek: díry v tloušťce desky, přípravek, hloubkový kroužek
   - listy(dil, nast)       → scéna šablony s rozdělením na listy
   Souřadnice SVG = mm dílu, y převrácené (viewBox v záporných y).
   ============================================================ */
(function (koren) {
  'use strict';
  const VS = koren.VS, VSV = koren.VSV;
  const n = (x) => (Math.round(x * 100) / 100).toString();
  const cz = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const DREVO = '#e9d3ab', DREVO_H = '#c8a26b', ZED = '#eceae4', KOTA = '#1f5fa8', REF = '#d04a00', SABL = '#2c8a4a';

  function kotaH(x0, x1, y, txt, fs, nahoru) {
    // vodorovná kóta v souřadnicích SVG (y dolů)
    const s = fs * 0.07, a = fs * 0.45;
    return `<path d="M${n(x0)} ${n(y)}H${n(x1)}M${n(x0)} ${n(y - a)}V${n(y + a)}M${n(x1)} ${n(y - a)}V${n(y + a)}" stroke="${KOTA}" stroke-width="${n(s)}" fill="none"/>`
      + `<text x="${n((x0 + x1) / 2)}" y="${n(nahoru === false ? y + fs * 1.05 : y - fs * 0.3)}" font-size="${n(fs)}" text-anchor="middle" fill="${KOTA}">${esc(txt)}</text>`;
  }
  function kotaV(x, y0, y1, txt, fs, vlevo) {
    const s = fs * 0.07, a = fs * 0.45, tx = vlevo === false ? x + fs * 0.35 : x - fs * 0.35, ty = (y0 + y1) / 2;
    return `<path d="M${n(x)} ${n(y0)}V${n(y1)}M${n(x - a)} ${n(y0)}H${n(x + a)}M${n(x - a)} ${n(y1)}H${n(x + a)}" stroke="${KOTA}" stroke-width="${n(s)}" fill="none"/>`
      + `<text x="${n(tx)}" y="${n(ty)}" font-size="${n(fs)}" text-anchor="middle" fill="${KOTA}" transform="rotate(-90 ${n(tx)} ${n(ty)})" dominant-baseline="${vlevo === false ? 'hanging' : 'auto'}">${esc(txt)}</text>`;
  }

  /** náhled desky; o: {vybrana: index díry, kurzor: true} */
  function deska(dil, nast, o) {
    o = o || {};
    const W = dil.w, H = dil.h, fs = Math.max(6, Math.min(40, Math.max(W, H) / 38)), obl = dil.oblast;
    const uniq = (a) => [...new Set(a.map((x) => Math.round(x * 100) / 100))].sort((p, q) => p - q);
    const xs = uniq(dil.diry.map((q) => q.x)), ys = uniq(dil.diry.map((q) => q.y));
    const mkx = xs.length <= 14, mky = ys.length <= 14;
    const levo = fs * (mky ? 7 : 4), dole = fs * (mkx ? 7 : 4), m = fs * 2.2;
    const vb = [-levo, -H - m - fs, W + levo + m, H + m + fs + dole];
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(n).join(' ')}" font-family="Liberation Sans, Arial, sans-serif" data-meritko="1">`;
    // deska
    const barva = dil.zed ? ZED : DREVO;
    if (dil.kruh) s += `<circle cx="${n(W / 2)}" cy="${n(-H / 2)}" r="${n(W / 2)}" fill="${barva}" stroke="${DREVO_H}" stroke-width="${n(fs * 0.12)}"/>`;
    else s += `<rect x="0" y="${n(-H)}" width="${n(W)}" height="${n(H)}" fill="${barva}" stroke="${dil.zed ? '#9a968c' : DREVO_H}" stroke-width="${n(fs * 0.12)}"/>`;
    if (dil.zed && dil.podlaha != null && !dil.prehled) s += `<text x="${n(W / 2)}" y="${n(-H / 2)}" font-size="${n(fs * 1.2)}" text-anchor="middle" fill="#9a968c">${esc(dil.nazev)}</text>`;
    for (const q of dil.obrysy || []) s += `<rect x="${n(q.x0)}" y="${n(-q.y1)}" width="${n(q.x1 - q.x0)}" height="${n(q.y1 - q.y0)}" fill="${q.carkovane ? 'none' : '#fff'}" stroke="#555" stroke-width="${n(fs * 0.1)}"${q.carkovane ? ` stroke-dasharray="${n(fs * 0.5)} ${n(fs * 0.3)}"` : ''}/>`
      + (q.popis && !q.carkovane ? `<text x="${n((q.x0 + q.x1) / 2)}" y="${n(-(q.y0 + q.y1) / 2)}" font-size="${n(fs)}" text-anchor="middle" fill="#666">${esc(q.popis)}</text>` : '');
    for (const q of dil.osy || []) {
      if (q.osa === 'x') s += `<path d="M${n(q.hodnota)} ${n(-H)}V0" stroke="${KOTA}" stroke-width="${n(fs * 0.06)}" stroke-dasharray="${n(fs)} ${n(fs * 0.3)} ${n(fs * 0.15)} ${n(fs * 0.3)}" opacity=".7"/>`;
      else s += `<path d="M0 ${n(-q.hodnota)}H${n(W)}" stroke="${KOTA}" stroke-width="${n(fs * 0.06)}" stroke-dasharray="${n(fs)} ${n(fs * 0.3)} ${n(fs * 0.15)} ${n(fs * 0.3)}" opacity=".7"/>`;
    }
    if (dil.vodovaha != null) s += `<path d="M0 ${n(-dil.vodovaha)}H${n(W)}" stroke="#b3261e" stroke-width="${n(fs * 0.08)}" stroke-dasharray="${n(fs * 0.6)} ${n(fs * 0.4)}"/>`;
    // obrys šablony
    if (obl && !dil.prehled) {
      const P = obl.papir;
      s += `<rect x="${n(P.x0)}" y="${n(-P.y1)}" width="${n(P.x1 - P.x0)}" height="${n(P.y1 - P.y0)}" fill="${SABL}" fill-opacity=".07" stroke="${SABL}" stroke-width="${n(fs * 0.12)}" stroke-dasharray="${n(fs * 0.6)} ${n(fs * 0.3)}"/>`;
    }
    // referenční hrany
    const r = dil.ref || {}, tl = fs * 0.35;
    if (r.x === 'L') s += `<path d="M0 0V${n(-H)}" stroke="${REF}" stroke-width="${n(tl)}"/>`;
    if (r.x === 'P') s += `<path d="M${n(W)} 0V${n(-H)}" stroke="${REF}" stroke-width="${n(tl)}"/>`;
    if (r.y === 'D') s += `<path d="M0 0H${n(W)}" stroke="${REF}" stroke-width="${n(tl)}"/>`;
    if (r.y === 'H') s += `<path d="M0 ${n(-H)}H${n(W)}" stroke="${REF}" stroke-width="${n(tl)}"/>`;
    if (r.x || r.y) {
      const t = [r.x ? (r.nx || VS.NAZEV_HRANY[r.x]) : '', r.y ? (r.ny || VS.NAZEV_HRANY[r.y]) : ''].filter(Boolean).join(' + ');
      s += `<text x="${n(r.x === 'P' ? W : 0)}" y="${n(-H - m - fs * 0.15)}" font-size="${n(fs * 0.95)}" text-anchor="${r.x === 'P' ? 'end' : 'start'}" fill="${REF}">ref.: ${esc(t)}</text>`;
    }
    // díry
    dil.diry.forEach((q, i) => {
      const vyb = o.vybrana === i;
      s += `<g data-i="${i}"><circle cx="${n(q.x)}" cy="${n(-q.y)}" r="${n(Math.max(q.d / 2, fs * 0.12))}" fill="${q.hl ? '#5b3d17' : '#222'}" fill-opacity="${q.hl ? 0.75 : 0.9}" stroke="${vyb ? '#d04a00' : '#000'}" stroke-width="${n(fs * (vyb ? 0.25 : 0.06))}"/>`;
      if (dil.diry.length <= 40) s += `<text x="${n(q.x + q.d / 2 + fs * 0.2)}" y="${n(-q.y - q.d / 2 - fs * 0.15)}" font-size="${n(fs * 0.8)}" fill="#333">${i + 1}</text>`;
      s += '</g>';
    });
    for (const q of dil.znacky || []) if (q.typ === 'stred') s += `<path d="M${n(q.x - fs)} ${n(-q.y)}H${n(q.x + fs)}M${n(q.x)} ${n(-q.y - fs)}V${n(-q.y + fs)}" stroke="${KOTA}" stroke-width="${n(fs * 0.1)}"/>`;
    // kóty: celkové rozměry
    if (!dil.kruh) {
      s += kotaH(0, W, -H - m * 0.55, cz(W), fs);
      s += kotaV(W + m * 0.55, -H, 0, cz(H), fs, false);
    } else s += kotaH(0, W, -H - m * 0.55, 'Ø ' + cz(W), fs);
    // kóty děr od referenčních hran (pořadnice pod a vlevo od desky)
    const odX = r.x === 'P' ? (x) => W - x : (x) => x, odY = r.y === 'H' ? (y) => H - y : (y) => y;
    if (!dil.kruh && dil.diry.length) {
      const xRef = r.x === 'P' ? W : 0, yRef = r.y === 'H' ? -H : 0;
      if (mkx) xs.forEach((x, i) => { s += kotaH(Math.min(xRef, x), Math.max(xRef, x), fs * (2 + i % 3 * 1.6), cz(odX(x)), fs * 0.85, false); });
      else s += `<text x="${n(W / 2)}" y="${n(fs * 2.5)}" font-size="${n(fs)}" text-anchor="middle" fill="${KOTA}">${xs.length} poloh v x: ${cz(odX(xs[0]))} … ${cz(odX(xs[xs.length - 1]))}</text>`;
      if (mky) ys.forEach((y, i) => { s += kotaV(-fs * (2 + i % 3 * 1.6), Math.min(yRef, -y), Math.max(yRef, -y), cz(odY(y)), fs * 0.85); });
      else {
        const tx = -fs * 2, ty = -H / 2;
        s += `<text x="${n(tx)}" y="${n(ty)}" font-size="${n(fs)}" text-anchor="middle" fill="${KOTA}" transform="rotate(-90 ${n(tx)} ${n(ty)})">${ys.length} poloh v y: ${cz(odY(ys[0]))} … ${cz(odY(ys[ys.length - 1]))}</text>`;
      }
    }
    if (dil.pcd) s += `<circle cx="${n(dil.pcd.cx)}" cy="${n(-dil.pcd.cy)}" r="${n(dil.pcd.D / 2)}" fill="none" stroke="${KOTA}" stroke-width="${n(fs * 0.06)}" stroke-dasharray="${n(fs * 0.8)} ${n(fs * 0.3)}"/>`;
    return s + '</svg>';
  }

  /** boční řez: typy děr (Ø, hloubka) v tloušťce desky, přípravek a nastavení kroužku */
  function rez(dil, nast) {
    const N = Object.assign({}, VS.NASTAVENI, nast || {});
    const typy = [];
    for (const q of dil.diry) if (!typy.some((t) => t.d === q.d && t.hl === q.hl)) typy.push({ d: q.d, hl: q.hl });
    typy.sort((a, b) => b.d - a.d);
    const T = typy.slice(0, 4), t = dil.t || 18, Tp = +N.stlTl || 6, ved = +N.vedeni || 0;
    const sirky = T.map((q) => Math.max(q.d, 6) + 22), Wc = Math.max(60, sirky.reduce((a, b) => a + b, 0));
    const hlMax = Math.max(t, ...T.map((q) => q.hl || t)), fs = Math.max(3, Math.min(8, Wc / 16));
    const Hc = Tp + ved + hlMax + fs * 7;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(-fs * 4)} ${n(-Tp - ved - fs * 2.5)} ${n(Wc + fs * 4 + 34)} ${n(Hc)}" font-family="Liberation Sans, Arial, sans-serif">`;
    // deska v řezu (y dolů = do hloubky)
    s += `<rect x="0" y="0" width="${n(Wc)}" height="${n(t)}" fill="${dil.zed ? ZED : DREVO}" stroke="${DREVO_H}" stroke-width="0.3"/>`;
    // přípravek (čárkovaně) nad deskou
    s += `<rect x="0" y="${n(-Tp)}" width="${n(Wc)}" height="${n(Tp)}" fill="#9fc5a8" fill-opacity=".35" stroke="${SABL}" stroke-width="0.25" stroke-dasharray="1.5 1"/>`;
    s += `<text x="${n(Wc + 1)}" y="${n(-Tp / 2 + fs * 0.35)}" font-size="${n(fs * 0.8)}" fill="${SABL}">přípravek ${cz(Tp)}${ved ? ' + ' + cz(ved) : ''}</text>`;
    let x = 0;
    T.forEach((q, i) => {
      const cx = x + sirky[i] / 2, r = q.d / 2, hl = q.hl || t, skrz = !q.hl;
      const tip = skrz ? 0 : Math.min(r / Math.tan(59 * Math.PI / 180), r);
      if (!skrz && q.d >= 15) s += `<path d="M${n(cx - r)} 0V${n(hl)}H${n(cx + r)}V0Z" fill="#fff" stroke="#000" stroke-width="0.25"/>`;
      else s += `<path d="M${n(cx - r)} 0V${n(skrz ? t : hl)}${skrz ? `H${n(cx + r)}` : `L${n(cx)} ${n(hl + tip)}L${n(cx + r)} ${n(hl)}`}V0Z" fill="#fff" stroke="#000" stroke-width="0.25"/>`;
      // vedení / otvor v přípravku
      const op = VS.otvorPripravku(q.d, N);
      s += `<rect x="${n(cx - op.d / 2)}" y="${n(-Tp - ved)}" width="${n(op.d)}" height="${n(Tp + ved)}" fill="#fff" stroke="${SABL}" stroke-width="0.2"/>`;
      if (ved) s += `<rect x="${n(cx - op.d / 2 - (+N.vedeniStena || 3))}" y="${n(-Tp - ved)}" width="${n(op.d + 2 * (+N.vedeniStena || 3))}" height="${n(ved)}" fill="none" stroke="${SABL}" stroke-width="0.2"/>`;
      s += `<path d="M${n(cx)} ${n(-Tp - ved - 1)}V${n(hl + tip + 1)}" stroke="#1f5fa8" stroke-width="0.15" stroke-dasharray="2 0.8 0.4 0.8"/>`;
      s += `<text x="${n(cx)}" y="${n(-Tp - ved - fs * 0.8)}" font-size="${n(fs)}" text-anchor="middle">Ø${cz(q.d)}</text>`;
      // kóta hloubky
      if (!skrz) {
        const kx = cx + r + 2;
        s += `<path d="M${n(kx)} 0V${n(hl)}M${n(kx - 1)} 0H${n(kx + 1)}M${n(kx - 1)} ${n(hl)}H${n(kx + 1)}" stroke="${KOTA}" stroke-width="0.2"/>`;
        s += `<text x="${n(kx + 0.8)}" y="${n(hl / 2 + fs * 0.35)}" font-size="${n(fs * 0.85)}" fill="${KOTA}">${cz(hl)}</text>`;
        const zbyva = t - hl;
        if (!dil.zed && !dil.celo) s += `<text x="${n(cx)}" y="${n(t + fs * 1.2)}" font-size="${n(fs * 0.75)}" text-anchor="middle" fill="${zbyva < 3 ? '#b3261e' : '#666'}">zbývá ${cz(zbyva)}</text>`;
        const kr = VS.nastaveniKrouzku(q, N, false);
        s += `<text x="${n(cx)}" y="${n(t + fs * 2.3)}" font-size="${n(fs * 0.75)}" text-anchor="middle" fill="${SABL}">kroužek ${cz(kr)}</text>`;
      } else s += `<text x="${n(cx)}" y="${n(t + fs * 1.2)}" font-size="${n(fs * 0.75)}" text-anchor="middle" fill="#666">skrz</text>`;
      x += sirky[i];
    });
    // tloušťka desky
    s += `<path d="M${n(-2)} 0V${n(t)}M-3 0H-1M-3 ${n(t)}H-1" stroke="${KOTA}" stroke-width="0.2"/>`;
    s += `<text x="-3" y="${n(t / 2)}" font-size="${n(fs * 0.85)}" fill="${KOTA}" text-anchor="middle" transform="rotate(-90 -3 ${n(t / 2)})" dy="-0.6">${dil.zed ? 'zeď' : cz(t)}</text>`;
    if (typy.length > 4) s += `<text x="0" y="${n(t + fs * 3.6)}" font-size="${n(fs * 0.75)}" fill="#666">… a dalších ${typy.length - 4} typů děr</text>`;
    return s + '</svg>';
  }

  /** šablona s vyznačením listů (užitné plochy listů čárkovaně) */
  function listy(dil, nast) {
    const N = Object.assign({}, VS.NASTAVENI, nast || {});
    const sc = VSV.scena(dil, N), [pw, ph] = VS.rozmerPapiru(N);
    const maxD = Math.max(0, ...dil.diry.map((q) => q.d));
    const rv = VS.rozvrhListu(dil.oblast.papir, pw, ph, N, maxD);
    let navic = '';
    rv.listy.forEach((l, i) => {
      navic += `<rect x="${n(l.x0)}" y="${n(-l.y1)}" width="${n(l.x1 - l.x0)}" height="${n(l.y1 - l.y0)}" fill="none" stroke="#d04a00" stroke-width="0.5" stroke-dasharray="4 3" opacity=".75"/>`;
      if (rv.listy.length > 1) navic += `<text x="${n(l.x0 + 3)}" y="${n(-l.y1 + 9)}" font-size="7" fill="#d04a00" opacity=".8">${i + 1}</text>`;
    });
    const x0 = Math.min(sc.x0, ...rv.listy.map((l) => l.x0)), x1 = Math.max(sc.x1, ...rv.listy.map((l) => l.x1));
    const y0 = Math.min(sc.y0, ...rv.listy.map((l) => l.y0)), y1 = Math.max(sc.y1, ...rv.listy.map((l) => l.y1));
    return { svg: VSV.svg(Object.assign({}, sc, { x0, x1, y0, y1 }), { sirkaPx: true, okraj: 2, navic }), rv };
  }

  koren.VSN = { deska, rez, listy };
})(typeof window !== 'undefined' ? window : globalThis);
