/* ============================================================
   Šablony pro horní frézku – 2D náhledy (SVG řetězce, bez DOM)
   - hlavni(dil, nast, o): šablona vs. výsledný řez – deska, otvor, dráha středu kroužku, hrana frézy (řez), odchylky
   - pudorys(dil, nast): technický půdorys s kótami
   - rez(dil, nast): řez A–A (obrobek, šablona, kroužek, fréza, hloubka, ofset)
   Barvy jsou pevné (náhled leží na bílém „papíru“ v obou tématech).
   ============================================================ */
(function (koren) {
  'use strict';
  const SF = koren.SF, G = koren.SFG;
  const n2 = (x) => (Math.round(x * 100) / 100).toString();
  const cz = (x, d) => SF.cz(x, d);
  const cesta = (polys) => polys.map((p) => p.map((q, i) => (i ? 'L' : 'M') + n2(q[0]) + ' ' + n2(-q[1])).join('') + 'Z').join('');
  const kontCesta = (kk) => kk.map((k) => G.konturaNaSvg(k, n2)).join('');
  const BARVA = { deska: '#cfe3c4', deskaH: '#2c7a3a', tvar: '#333333', osa: '#1f5fa8', rez: '#d04a00', chyba: '#d01818', doraz: '#8a5a20', kota: '#1f5fa8' };

  /** kótovací čára (vodorovná / svislá) v souřadnicích SVG (y už převrácené) */
  function kota(x1, y1, x2, y2, txt, posun, vel) {
    const v = vel || 3, svisla = Math.abs(x1 - x2) < 1e-9;
    const dx = svisla ? posun : 0, dy = svisla ? 0 : posun;
    const a = [x1 + dx, y1 + dy], b = [x2 + dx, y2 + dy];
    let s = `<g stroke="${BARVA.kota}" stroke-width="1" vector-effect="non-scaling-stroke" fill="none">`;
    s += `<path d="M${n2(x1)} ${n2(y1)}L${n2(a[0] + Math.sign(dx) * v * 0.6)} ${n2(a[1] + Math.sign(dy) * v * 0.6)}M${n2(x2)} ${n2(y2)}L${n2(b[0] + Math.sign(dx) * v * 0.6)} ${n2(b[1] + Math.sign(dy) * v * 0.6)}" stroke-opacity=".5" vector-effect="non-scaling-stroke"/>`;
    s += `<path d="M${n2(a[0])} ${n2(a[1])}L${n2(b[0])} ${n2(b[1])}" vector-effect="non-scaling-stroke"/>`;
    // šipky
    const sm = svisla ? [0, Math.sign(b[1] - a[1]) || 1] : [Math.sign(b[0] - a[0]) || 1, 0], q = v * 0.9, w = v * 0.35;
    const sip = (p, d) => `<path d="M${n2(p[0])} ${n2(p[1])}L${n2(p[0] + d[0] * q - d[1] * w)} ${n2(p[1] + d[1] * q + d[0] * w)}L${n2(p[0] + d[0] * q + d[1] * w)} ${n2(p[1] + d[1] * q - d[0] * w)}Z" fill="${BARVA.kota}" stroke="none"/>`;
    s += sip(a, sm) + sip(b, [-sm[0], -sm[1]]) + '</g>';
    const tx = (a[0] + b[0]) / 2 + (svisla ? -v * 0.5 : 0), ty = (a[1] + b[1]) / 2 - (svisla ? 0 : v * 0.5);
    s += `<text x="${n2(tx)}" y="${n2(ty)}" font-size="${n2(v * 1.25)}" fill="${BARVA.kota}" text-anchor="middle"${svisla ? ` transform="rotate(-90 ${n2(tx)} ${n2(ty)})"` : ''}>${txt}</text>`;
    return s;
  }

  /** hlavní náhled: šablona vs. výsledný řez */
  function hlavni(dil, nast, o) {
    o = o || {};
    const ob = dil.deska.obal, V = dil.V;
    const vse = [dil.deska.polys, dil.rez || [], dil.stred || []].flat();
    for (const d of dil.dorazy || []) for (const p of d.polys) vse.push(p);
    const b = G.obal(vse), m = Math.max(8, Math.max(b.w, b.h) * 0.06);
    const vb = [b.x0 - m, -b.y1 - m, b.w + 2 * m, b.h + 2 * m], vel = Math.max(b.w, b.h) / 60;
    const ns = 'vector-effect="non-scaling-stroke"';
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(n2).join(' ')}" font-family="Liberation Sans, Arial, sans-serif" role="img" aria-label="Náhled šablony a výsledného řezu">`;
    s += `<rect x="${n2(vb[0])}" y="${n2(vb[1])}" width="${n2(vb[2])}" height="${n2(vb[3])}" fill="#ffffff"/>`;
    // obrobek pod šablonou
    if (dil.hrana) s += `<rect x="${n2(ob.x0)}" y="${n2(-dil.hrana.tl)}" width="${n2(ob.x1 - ob.x0)}" height="${n2(dil.hrana.tl)}" fill="#e8d3ad" opacity=".7"/>`;
    for (const d of dil.dorazy || []) s += `<path d="${cesta(d.polys)}" fill="#e0c79c" stroke="${BARVA.doraz}" stroke-width="1" stroke-dasharray="4 3" ${ns}/>`;
    s += `<path d="${dil.deska.kontury ? kontCesta(dil.deska.kontury) : cesta(dil.deska.polys)}" fill="${BARVA.deska}" fill-opacity=".85" fill-rule="nonzero" stroke="${BARVA.deskaH}" stroke-width="1.6" ${ns}/>`;
    if (dil.ukazka) s += `<path d="${cesta(dil.ukazka)}" fill="none" stroke="${BARVA.deskaH}" stroke-dasharray="3 2" ${ns}/>`;
    // výsledný řez
    if (dil.rez && dil.rez.length) s += `<path d="${cesta(dil.rez)}" fill="${BARVA.rez}" fill-opacity=".16" stroke="${BARVA.rez}" stroke-width="1.6" ${ns}/>`;
    // zadaný tvar
    if (dil.tvar && dil.tvar.polys) s += `<path d="${dil.tvar.kontury ? kontCesta(dil.tvar.kontury) : cesta(dil.tvar.polys)}" fill="none" stroke="${BARVA.tvar}" stroke-width="1" stroke-dasharray="5 3" ${ns}/>`;
    // dráha středu kroužku
    for (const p of dil.draha || []) s += `<path d="${cesta([p])}" fill="none" stroke="${BARVA.osa}" stroke-width="1.2" stroke-dasharray="9 3 2 3" ${ns}/>`;
    // odchylky a nedosažitelné rohy
    if (dil.odchylka && dil.odchylka.length) s += `<path d="${cesta(dil.odchylka)}" fill="${BARVA.chyba}" fill-opacity=".55" stroke="${BARVA.chyba}" stroke-width="1" ${ns}/>`;
    if (dil.nedos && dil.nedos.length) for (const c of G.komponenty(dil.nedos)) { const ob2 = G.obal(c), r = Math.max(vel * 0.9, Math.max(ob2.w, ob2.h) * 0.8); s += `<circle cx="${n2((ob2.x0 + ob2.x1) / 2)}" cy="${n2(-(ob2.y0 + ob2.y1) / 2)}" r="${n2(r)}" fill="none" stroke="${BARVA.chyba}" stroke-width="1.6" ${ns}/>`; }
    // ukázka kroužku a frézy na dráze
    if (V && dil.draha && dil.draha[0] && dil.draha[0].length > 2 && dil.druh === 'sablona') {
      const p = dil.draha[0], i = Math.floor(p.length * 0.12), q = p[i];
      s += `<circle cx="${n2(q[0])}" cy="${n2(-q[1])}" r="${n2(V.Rv)}" fill="${BARVA.osa}" fill-opacity=".12" stroke="${BARVA.osa}" stroke-width="1.4" ${ns}/>`;
      s += `<circle cx="${n2(q[0])}" cy="${n2(-q[1])}" r="${n2(V.Rf)}" fill="${BARVA.rez}" fill-opacity=".35" stroke="${BARVA.rez}" stroke-width="1.2" ${ns}/>`;
    }
    if (dil.cepy) for (const c of dil.cepy) if (c === dil.pivot) s += `<circle cx="${n2(c.x)}" cy="${n2(-c.y)}" r="${n2(Math.max(4, vel * 1.5))}" fill="none" stroke="${BARVA.osa}" stroke-width="2" ${ns}/>`;
    for (const z of dil.znacky || []) s += `<path d="M${z.b.map((q) => n2(q[0]) + ' ' + n2(-q[1])).join('L')}" stroke="${z.v === 'hrana' ? '#d04a00' : '#2c7a3a'}" stroke-width="1" fill="none"${z.c ? ' stroke-dasharray="6 4"' : ''} ${ns}/>`;
    for (const t of dil.texty || []) s += `<text x="${n2(t.x)}" y="${n2(-t.y)}" font-size="${n2(t.h || 3)}" text-anchor="${t.a === 'c' ? 'middle' : 'start'}" dominant-baseline="central" fill="#2c7a3a"${t.u ? ` transform="rotate(${-t.u} ${n2(t.x)} ${n2(-t.y)})"` : ''}>${t.txt}</text>`;
    // celkové kóty
    s += kota(ob.x0, -ob.y0, ob.x1, -ob.y0, cz(ob.x1 - ob.x0, 1), m * 0.55, vel);
    s += kota(ob.x1, -ob.y1, ob.x1, -ob.y0, cz(ob.y1 - ob.y0, 1), m * 0.55, vel);
    return s + '</svg>';
  }

  /** průsečíky vodorovné přímky y s oblastí → intervaly [x0, x1] uvnitř */
  function intervaly(polys, y) {
    const xs = [];
    for (const p of polys) for (let i = 0, n = p.length; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push([a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]), b[1] > a[1] ? 1 : -1]);
    }
    xs.sort((p, q) => p[0] - q[0]);
    const out = []; let w = 0, x0 = 0;
    for (const [x, d] of xs) { const w0 = w; w += d; if (w0 === 0 && w !== 0) x0 = x; else if (w0 !== 0 && w === 0) out.push([x0, x]); }
    return out;
  }

  /** technický půdorys s kótami otvoru a desky */
  function pudorys(dil) {
    const ob = dil.deska.obal, b = G.obal(dil.deska.polys.concat((dil.dorazy || []).flatMap((d) => d.polys))), m = Math.max(b.w, b.h) * 0.16 + 10, vel = Math.max(b.w, b.h) / 38;
    const vb = [b.x0 - m, -b.y1 - m, b.w + 2 * m, b.h + 2 * m], ns = 'vector-effect="non-scaling-stroke"';
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(n2).join(' ')}" font-family="Liberation Sans, Arial, sans-serif" role="img" aria-label="Půdorys s kótami"><rect x="${n2(vb[0])}" y="${n2(vb[1])}" width="${n2(vb[2])}" height="${n2(vb[3])}" fill="#fff"/>`;
    for (const d of dil.dorazy || []) s += `<path d="${cesta(d.polys)}" fill="none" stroke="#555" stroke-dasharray="4 3" ${ns}/>`;
    s += `<path d="${dil.deska.kontury ? kontCesta(dil.deska.kontury) : cesta(dil.deska.polys)}" fill="none" stroke="#000" stroke-width="1.5" ${ns}/>`;
    // osy
    const c = dil.sab && dil.sab.polys.length ? G.obal(dil.sab.polys) : null;
    if (c) {
      const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
      s += `<path d="M${n2(ob.x0 - 4)} ${n2(-cy)}H${n2(ob.x1 + 4)}M${n2(cx)} ${n2(-ob.y0 + 4)}V${n2(-ob.y1 - 4)}" stroke="#1f5fa8" stroke-dasharray="10 3 2 3" ${ns}/>`;
      s += kota(c.x0, -c.y1, c.x1, -c.y1, (dil.kop === 'vnejsi' ? '' : 'otvor ') + cz(c.w, 2), -(c.y1 - ob.y1) - m * 0.3, vel);
      s += kota(c.x0, -c.y1, c.x0, -c.y0, cz(c.h, 2), -(c.x0 - ob.x0) - m * 0.3, vel);
      if (dil.kop !== 'vnejsi') {
        s += kota(ob.x0, -cy, c.x0, -cy, cz(c.x0 - ob.x0, 1), 0, vel * 0.9);
        s += kota(ob.x1, -ob.y0, ob.x1, -c.y0, cz(c.y0 - ob.y0, 1), m * 0.25, vel * 0.9);
      }
      s += `<text x="${n2(cx)}" y="${n2(-cy + vel * 1.4)}" font-size="${n2(vel * 1.3)}" text-anchor="middle" fill="#000">A</text>`;
    }
    for (const q of dil.srouby || []) s += `<circle cx="${n2(q.c[0])}" cy="${n2(-q.c[1])}" r="${n2(q.zahl / 2)}" fill="none" stroke="#2c7a3a" stroke-dasharray="2 1.5" ${ns}/>`;
    s += kota(ob.x0, -ob.y0, ob.x1, -ob.y0, cz(ob.x1 - ob.x0, 1), m * 0.55, vel);
    s += kota(ob.x1, -ob.y1, ob.x1, -ob.y0, cz(ob.y1 - ob.y0, 1), m * 0.55, vel);
    // řezová rovina A–A
    const ys = c ? (c.y0 + c.y1) / 2 : (dil.pivot ? dil.pivot.y : (ob.y0 + ob.y1) / 2);
    s += `<path d="M${n2(ob.x0 - m * 0.35)} ${n2(-ys)}h${n2(m * 0.25)}M${n2(ob.x1 + m * 0.1)} ${n2(-ys)}h${n2(m * 0.25)}" stroke="#000" stroke-width="2.4" ${ns}/>`;
    s += `<text x="${n2(ob.x0 - m * 0.3)}" y="${n2(-ys - vel)}" font-size="${n2(vel * 1.4)}" fill="#000">A</text><text x="${n2(ob.x1 + m * 0.2)}" y="${n2(-ys - vel)}" font-size="${n2(vel * 1.4)}" fill="#000">A</text>`;
    return s + '</svg>';
  }

  /** řez A–A: obrobek, šablona, dorazy, kroužek a fréza u levé hrany otvoru, hloubka */
  function rez(dil, nast) {
    const N = SF.normNast(nast), V = dil.V, T = N.tlSablony, tob = N.tlObrobku, ob = dil.deska.obal;
    const c = dil.sab && dil.sab.polys.length ? G.obal(dil.sab.polys) : null;
    const ys = c ? (c.y0 + c.y1) / 2 : (dil.pivot ? dil.pivot.y : (ob.y0 + ob.y1) / 2);
    const desky = intervaly(dil.deska.polys, ys), kapsy = intervaly(dil.kop === 'vnejsi' && dil.stred.length ? G.rozdil(G.ofset(dil.stred, dil.V.Rf), dil.rez) : (dil.rez || []), ys);
    const hl = Math.min(dil.hloubka || N.hloubka, tob + 2), hk = Math.min(N.vyskaKrouzku, T - 0.2);
    const x0 = ob.x0 - 20, x1 = ob.x1 + 20, Zt = T + 70, Zb = -tob - 24, ns = 'vector-effect="non-scaling-stroke"', vel = Math.max(3, (x1 - x0) / 50);
    // z nahoru → y SVG = −z
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n2(x0)} ${n2(-Zt)} ${n2(x1 - x0)} ${n2(Zt - Zb)}" font-family="Liberation Sans, Arial, sans-serif" role="img" aria-label="Řez A–A"><rect x="${n2(x0)}" y="${n2(-Zt)}" width="${n2(x1 - x0)}" height="${n2(Zt - Zb)}" fill="#fff"/>`;
    s += `<defs><pattern id="srafa" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V4" stroke="#8a6a3e" stroke-width=".6"/></pattern><pattern id="srafa2" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><path d="M0 0V3" stroke="#2c7a3a" stroke-width=".5"/></pattern></defs>`;
    // obrobek s kapsami
    const ox0 = ob.x0 - 15, ox1 = ob.x1 + 15;
    let d = `M${n2(ox0)} 0`;
    const kap = kapsy.filter((k) => k[1] > ox0 && k[0] < ox1).map((k) => [Math.max(ox0, k[0]), Math.min(ox1, k[1])]);
    for (const k of kap) d += `H${n2(k[0])}V${n2(Math.min(hl, tob + 1) >= tob ? tob : hl)}H${n2(k[1])}V0`;
    d += `H${n2(ox1)}V${n2(tob)}H${n2(ox0)}Z`;
    s += `<path d="${d}" fill="#e8d3ad" stroke="#6b4f2a" stroke-width="1.2" ${ns}/><path d="${d}" fill="url(#srafa)" stroke="none"/>`;
    // šablona
    for (const iv of desky) s += `<rect x="${n2(iv[0])}" y="${n2(-T)}" width="${n2(iv[1] - iv[0])}" height="${n2(T)}" fill="${BARVA.deska}" stroke="${BARVA.deskaH}" stroke-width="1.2" ${ns}/><rect x="${n2(iv[0])}" y="${n2(-T)}" width="${n2(iv[1] - iv[0])}" height="${n2(T)}" fill="url(#srafa2)"/>`;
    for (const dz of dil.dorazy || []) for (const iv of intervaly(dz.polys, ys)) s += `<rect x="${n2(iv[0])}" y="0" width="${n2(iv[1] - iv[0])}" height="${n2(dz.v || 15)}" fill="#e0c79c" stroke="${BARVA.doraz}" ${ns}/>`;
    // kroužek a fréza u levé hrany otvoru
    if (V && dil.druh === 'sablona' && dil.draha && dil.draha[0]) {
      const dr = intervaly(dil.stred, ys);
      if (dr.length) {
        const xc = dil.kop === 'vnejsi' ? dr[0][0] : dr[0][0];
        const zakl = N.Dz / 2;
        s += `<rect x="${n2(xc - zakl)}" y="${n2(-T - 6)}" width="${n2(2 * zakl)}" height="6" fill="#9aa6b2" fill-opacity=".6" stroke="#445" ${ns}/>`;
        s += `<rect x="${n2(xc - 32)}" y="${n2(-T - 60)}" width="64" height="54" rx="6" fill="#b8c0c8" fill-opacity=".45" stroke="#445" ${ns}/>`;
        if (!V.lozisko) s += `<rect x="${n2(xc - V.Rv)}" y="${n2(-T - 0.01)}" width="${n2(2 * V.Rv)}" height="${n2(hk)}" fill="${BARVA.osa}" fill-opacity=".5" stroke="${BARVA.osa}" ${ns}/>`;
        s += `<rect x="${n2(xc - V.Rf)}" y="${n2(-T - 30)}" width="${n2(2 * V.Rf)}" height="${n2(T + 30 + Math.min(hl, tob + 1))}" fill="${BARVA.rez}" fill-opacity=".7" stroke="#702000" ${ns}/>`;
        if (V.lozisko) s += `<rect x="${n2(xc - V.Rv)}" y="${n2(-T + 0.5)}" width="${n2(2 * V.Rv)}" height="${n2(T - 1)}" rx="1" fill="${BARVA.osa}" fill-opacity=".6" stroke="${BARVA.osa}" ${ns}/>`;
        s += `<path d="M${n2(xc)} ${n2(-T - 64)}V${n2(tob + 4)}" stroke="#1f5fa8" stroke-dasharray="6 2 1 2" ${ns}/>`;
        // kóty o, hloubka
        const sg = dil.kop === 'vnejsi' ? 1 : -1, hrana = xc + sg * V.Rv;
        s += kota(Math.min(hrana, xc), -T - 2, Math.max(hrana, xc), -T - 2, 'Rk ' + cz(V.Rv, 2), -12, vel * 0.8);
        s += kota(Math.min(hrana, xc + sg * V.Rf), Math.min(hl, tob), Math.max(hrana, xc + sg * V.Rf), Math.min(hl, tob), 'o ' + cz(V.o, 2), 14, vel * 0.8);
        s += kota(xc + V.Rf + 4, 0, xc + V.Rf + 4, Math.min(hl, tob), 'hl. ' + cz(Math.min(hl, tob), 1), vel * 2.5, vel * 0.8);
      }
    }
    s += kota(x1 - 8, -T, x1 - 8, 0, 'T ' + cz(T, 1), 0, vel * 0.8);
    s += `<text x="${n2(x0 + 4)}" y="${n2(-Zt + vel * 2)}" font-size="${n2(vel * 1.4)}" fill="#000">Řez A–A</text>`;
    return s + '</svg>';
  }

  koren.SFN = { hlavni, pudorys, rez, intervaly };
})(typeof window !== 'undefined' ? window : globalThis);
