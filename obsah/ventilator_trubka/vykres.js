/* Ventilátor → trubka – výkres A4 na šířku (SVG v mm, černě na bílém):
   vlevo pohled na desku / mřížku (obrys rámu, díry v rozteči, otvor nebo vzor mřížky),
   vpravo řez A–A rovinou osy (díly sestavy bez ventilátoru, ventilátor čárkovaně), dole parametry, kusovník, popisové pole.
   sestavVykres(p, o, model, meta) → text SVG; model = výsledek VENTT.postav (vzor2d, rez), meta = {datum, kusovnik: [[název, ks]]}. */
/* global VENTT */
(function () {
  'use strict';
  const V = typeof module !== 'undefined' ? require('./jadro.js') : window.VENTT;
  const MERITKA = [2, 1, 0.5, 0.4, 0.25, 0.2, 0.1, 0.05];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (x, d = 1) => V.fmt(x, d);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);
  const nazevMeritka = m => (m >= 1 ? `${m} : 1` : `1 : ${f(1 / m, 1)}`);
  const cesta = (polys, T) => polys.map(p => 'M' + p.map(([x, y]) => { const [a, b] = T(x, y); return `${a.toFixed(2)} ${b.toFixed(2)}`; }).join('L') + 'Z').join('');
  const kruh = (cx, cy, r, n = 32) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);

  function kota(P1, P2, off, text, out) {
    const dx = P2[0] - P1[0], dy = P2[1] - P1[1], l = Math.hypot(dx, dy);
    if (l < 0.5) return;
    const ux = dx / l, uy = dy / l, nx = uy, ny = -ux, sg = Math.sign(off) || 1;
    const A = [P1[0] + nx * off, P1[1] + ny * off], B = [P2[0] + nx * off, P2[1] + ny * off];
    out.push(`<line class="pom" x1="${(P1[0] + nx * sg).toFixed(2)}" y1="${(P1[1] + ny * sg).toFixed(2)}" x2="${(A[0] + nx * sg * 1.5).toFixed(2)}" y2="${(A[1] + ny * sg * 1.5).toFixed(2)}"/>`);
    out.push(`<line class="pom" x1="${(P2[0] + nx * sg).toFixed(2)}" y1="${(P2[1] + ny * sg).toFixed(2)}" x2="${(B[0] + nx * sg * 1.5).toFixed(2)}" y2="${(B[1] + ny * sg * 1.5).toFixed(2)}"/>`);
    out.push(`<line class="kota" x1="${A[0].toFixed(2)}" y1="${A[1].toFixed(2)}" x2="${B[0].toFixed(2)}" y2="${B[1].toFixed(2)}" marker-start="url(#sipka)" marker-end="url(#sipka)"/>`);
    let uhel = Math.atan2(uy, ux) * 180 / Math.PI;
    if (uhel > 90.5 || uhel < -90.5) uhel += 180;
    const tu = uhel * Math.PI / 180, mx = (A[0] + B[0]) / 2 + Math.sin(tu) * 1.2, my = (A[1] + B[1]) / 2 - Math.cos(tu) * 1.2;
    out.push(`<text class="kt" x="${mx.toFixed(2)}" y="${my.toFixed(2)}" transform="rotate(${uhel.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)})">${esc(text)}</text>`);
  }
  function obal(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  /** Měřítko a převod pro plochu P (mm papíru) s okraji ok tak, aby se obsah bb vešel a byl vystředěný. */
  function umisti(bb, P, ok) {
    const m = MERITKA.find(k => bb.w * k <= P.w - ok.l - ok.r && bb.h * k <= P.h - ok.t - ok.b) || MERITKA[MERITKA.length - 1];
    const x0 = P.x + ok.l + (P.w - ok.l - ok.r - bb.w * m) / 2 - bb.x0 * m, y0 = P.y + ok.t + (P.h - ok.t - ok.b - bb.h * m) / 2 + bb.y1 * m;
    return { m, T: (x, y) => [x0 + x * m, y0 - y * m] };
  }

  function sestavVykres(p, o, model, meta) {
    const out = [], v = p.vent, mrizka = p.druh === 'mrizka';
    /* ---- pohled na desku / mřížku ---- */
    const PR = { x: 12, y: 12, w: 140, h: 120 };
    const SA = V.polygon(o.SA, 128);
    const vnejsi = mrizka && p.mrizka.uchyceni === 'nasazovaci' ? V.polygon({ a: o.Ain / 2 + o.sts, rr: Math.min(v.roh, v.A / 2) + o.sts }, 128) : SA;
    const bP = obal([vnejsi]), U = umisti(bP, PR, { l: 16, r: 14, t: 12, b: 16 }), TP = U.T;
    const vzor = model.vzor2d && (mrizka ? model.vzor2d.mrizka : model.vzor2d.deska);
    out.push(`<path class="obrys plocha" d="${cesta([vnejsi], TP)}"/>`);
    if (vnejsi !== SA) out.push(`<path class="skryta" d="${cesta([SA], TP)}"/>`);
    if (vzor) out.push(`<path class="dira" fill-rule="evenodd" d="${cesta(vzor, TP)}"/>`);
    else out.push(`<path class="dira" d="${cesta([V.polygon(o.otvorDesky || o.oblast, 128)], TP)}"/>`);
    const diry = !mrizka || p.mrizka.uchyceni === 'srouby';
    const rD = mrizka ? v.dira / 2 + 0.1 : o.diraD / 2;
    if (diry) for (const [a, b] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) out.push(`<path class="dira" d="${cesta([kruh(a * o.r2, b * o.r2, rD)], TP)}"/>`);
    const osa = (a, b) => out.push(`<line class="osa" x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}"/>`);
    osa(TP(bP.x0 - 4, 0), TP(bP.x1 + 4, 0)); osa(TP(0, bP.y0 - 4), TP(0, bP.y1 + 4));
    out.push(`<line class="rezcara" x1="${TP(bP.x0 - 6, 0)[0].toFixed(2)}" y1="${TP(0, 0)[1].toFixed(2)}" x2="${TP(bP.x0 - 2, 0)[0].toFixed(2)}" y2="${TP(0, 0)[1].toFixed(2)}"/>`);
    out.push(`<text class="kt b" x="${(TP(bP.x0 - 4, 0)[0]).toFixed(2)}" y="${(TP(0, 0)[1] - 1.5).toFixed(2)}">A</text>`);
    kota(TP(bP.x0, bP.y0), TP(bP.x1, bP.y0), -7, f(bP.w, 1), out);
    if (diry) {
      kota(TP(-o.r2, o.r2), TP(o.r2, o.r2), o.SA.a - o.r2 + 5, f(v.roztec, 1), out);
      const [hx, hy] = TP(o.r2, -o.r2);
      out.push(`<line class="pom" x1="${hx.toFixed(2)}" y1="${hy.toFixed(2)}" x2="${(hx + 9).toFixed(2)}" y2="${(hy + 9).toFixed(2)}"/><text class="kt" x="${(hx + 10).toFixed(2)}" y="${(hy + 11).toFixed(2)}" text-anchor="start">4× Ø ${esc(f(2 * rD, 1))}</text>`);
    }
    const nadpisP = mrizka ? t('Mřížka – pohled') : t('Deska ventilátoru – pohled zespodu');
    out.push(`<text class="nadpis" x="${PR.x + PR.w / 2}" y="${PR.y + PR.h - 1}">${esc(nadpisP)} · ${nazevMeritka(U.m)}</text>`);

    /* ---- řez A–A ---- */
    const PS = { x: 156, y: 12, w: 130, h: 120 };
    const rezy = model.rez || [];
    const vse = rezy.flatMap(r => r.polys);
    const fan = [[-v.A / 2, -v.tl], [v.A / 2, -v.tl], [v.A / 2, 0], [-v.A / 2, 0]];
    const bS = obal(vse.concat([fan])), US = umisti(bS, PS, { l: 16, r: 18, t: 10, b: 14 }), TS = US.T;
    out.push(`<path class="skryta" d="${cesta([fan], TS)}"/>`);
    for (const r of rezy) {
      const cls = r.jmeno === 'filtr' ? 'filtr' : 'rez';
      out.push(`<path class="${cls}" fill-rule="evenodd" d="${cesta(r.polys, TS)}"/><path class="obrys" fill-rule="evenodd" d="${cesta(r.polys, TS)}"/>`);
    }
    osa(TS(0, bS.y0 - 3), TS(0, bS.y1 + 3));
    if (!mrizka) {
      const xr = o.SA.a;
      kota(TS(-xr, bS.y1), TS(-xr, 0), 8, f(bS.y1, 1), out);
      kota(TS(xr, 0), TS(xr, o.tp), -5, f(o.tp, 1), out);
      if (p.vystup.typ === 'na' || p.vystup.typ === 'do') {
        const h = o.h, z = o.zL1 + h.L;
        kota(TS(-h.ro, z), TS(h.ro, z), 4, `Ø ${f(2 * h.ro, 2)}`, out);
        kota(TS(-h.ri, o.zL1 + h.L * 0.5), TS(h.ri, o.zL1 + h.L * 0.5), 0.01, `Ø ${f(2 * h.ri, 2)}`, out);
        kota(TS(h.ro, o.zL1), TS(h.ro, z), -6, f(h.L, 1), out);
      } else if (p.vystup.typ === 'jamka') {
        kota(TS(-o.kh.Rs, o.zS), TS(o.kh.Rs, o.zS), 0.01, `Ø ${f(2 * o.kh.Rs, 2)}`, out);
      }
      if (o.L > 0) kota(TS(xr + 2, o.zL0), TS(xr + 2, o.zL1), -4, f(o.L, 1), out);
    } else kota(TS(bS.x1, bS.y0), TS(bS.x1, bS.y1), -5, f(bS.h, 1), out);
    out.push(`<text class="nadpis" x="${PS.x + PS.w / 2}" y="${PS.y + PS.h - 1}">${esc(t('Řez A–A'))} · ${nazevMeritka(US.m)}</text>`);

    /* ---- parametry, kusovník, popisové pole ---- */
    const radky = [[t('Ventilátor'), `${f(v.A)} × ${f(v.A)} × ${f(v.tl)} mm, ${t('rozteč')} ${f(v.roztec, 1)}, Ø ${f(v.dira, 1)}`]];
    if (mrizka) {
      radky.push([t('Vzor'), `${t(V.NAZVY.vzor[p.mrizka.vzor])}, ${t('rozteč')} ${f(p.mrizka.roztec, 1)}, ${t('žebro')} ${f(p.mrizka.zebro, 1)} mm`]);
      radky.push([t('Volná plocha'), `${f(o.vzor.podil * 100, 0)} % (${f(o.vzor.otvor / 100, 1)} cm²)`]);
    } else {
      radky.push([t('Výstup'), t(V.NAZVY.vystup[p.vystup.typ])]);
      if (o.h) radky.push([t('Hrdlo'), `Ø ${f(2 * o.h.ro, 2)} / Ø ${f(2 * o.h.ri, 2)} × ${f(o.h.L, 1)} mm`]);
      if (o.kh) radky.push([t('Jamka'), `${t('koule')} Ø ${f(p.jamka.koule, 1)}, ${t('kanál')} Ø ${f(p.jamka.kanal, 1)}`]);
      if (o.L > 0) radky.push([t('Přechod'), `${f(o.L, 1)} mm, ${t(V.NAZVY.profil[p.prechod.profil])}`]);
      if (o.filtr) radky.push([t('Filtr'), `${f(o.filtrRozmer, 0)} × ${f(o.filtrRozmer, 0)} × ${f(p.filtr.tl, 1)} mm`]);
    }
    radky.push([t('Údaje ventilátorů'), `${t('typické')} ${V.DATUM_VENT} – ${t('ověřit měřením')}`]);
    let y = 140;
    out.push(`<text class="nadpis l" x="14" y="${y}">${esc(t('Parametry'))}</text>`);
    for (const [a, b] of radky) { y += 5; out.push(`<text class="tab" x="14" y="${y}">${esc(a)}</text><text class="tab b" x="140" y="${y}" text-anchor="end">${esc(b)}</text><line class="pom" x1="12" y1="${y + 1.4}" x2="142" y2="${y + 1.4}"/>`); }
    y = 140;
    out.push(`<text class="nadpis l" x="158" y="${y}">${esc(t('Kusovník'))}</text>`);
    for (const [a, b] of meta.kusovnik.slice(0, 9)) {
      y += 4.3;
      const nz = String(t(a)); out.push(`<text class="tab" x="158" y="${y}">${esc(nz.length > 62 ? nz.slice(0, 61) + '…' : nz)}</text><text class="tab b" x="285" y="${y}" text-anchor="end">${esc(t(b))}</text>`);
    }
    const py = 184;
    out.push(`<rect class="ram" x="158" y="${py}" width="127" height="16"/><line class="ram" x1="158" y1="${py + 8}" x2="285" y2="${py + 8}"/><line class="ram" x1="240" y1="${py}" x2="240" y2="${py + 16}"/>`);
    out.push(`<text class="pole b" x="160" y="${py + 5.5}">${esc(p.nazev || 'Ventilátor → trubka')}</text>`);
    out.push(`<text class="pole" x="242" y="${py + 5.5}">${esc(meta.datum)}</text>`);
    out.push(`<text class="pole" x="160" y="${py + 13.5}">${esc(t(V.NAZVY.druh[p.druh]))}</text>`);
    out.push(`<text class="pole" x="242" y="${py + 13.5}">${esc(t('rozměry v mm · list 1/1'))}</text>`);

    return `<svg class="vk-svg" xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210" font-family="Arial, Helvetica, sans-serif">
<defs><pattern id="srafy" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#000" stroke-width="0.18"/></pattern>
<pattern id="tecky" width="1.2" height="1.2" patternUnits="userSpaceOnUse"><circle cx="0.6" cy="0.6" r="0.18" fill="#000"/></pattern>
<marker id="sipka" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" fill="#000"/></marker>
<style>.vk-svg .rez{fill:url(#srafy);stroke:none}.vk-svg .filtr{fill:url(#tecky);stroke:none}.vk-svg .dira{fill:#fff;stroke:#000;stroke-width:0.25}.vk-svg .plocha{fill:#eee}
.vk-svg .obrys{fill:none;stroke:#000;stroke-width:0.4;stroke-linejoin:round}.vk-svg .obrys.plocha{fill:#eee}
.vk-svg .skryta{fill:none;stroke:#000;stroke-width:0.2;stroke-dasharray:2 1}.vk-svg .rezcara{stroke:#000;stroke-width:0.45}
.vk-svg .osa{stroke:#000;stroke-width:0.18;stroke-dasharray:6 1.5 1 1.5}.vk-svg .kota{stroke:#000;stroke-width:0.18}.vk-svg .pom{stroke:#000;stroke-width:0.13}
.vk-svg .kt{font-size:2.5px;text-anchor:middle}.vk-svg .nadpis{font-size:3.5px;font-weight:bold;text-anchor:middle}.vk-svg .nadpis.l{text-anchor:start}
.vk-svg .tab{font-size:2.6px}.vk-svg .b{font-weight:bold}.vk-svg .ram{fill:none;stroke:#000;stroke-width:0.35}.vk-svg .pole{font-size:3px}</style></defs>
<rect x="0" y="0" width="297" height="210" fill="#fff"/><rect class="ram" x="8" y="8" width="281" height="194"/>
${out.join('\n')}
</svg>`;
  }

  const API = { sestavVykres };
  if (typeof module !== 'undefined') module.exports = API; else window.VENTT_VYK = API;
})();
