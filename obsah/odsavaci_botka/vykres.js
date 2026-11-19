/* Odsávací botka – výkres A4 na šířku (SVG v mm, černě na bílém):
   vlevo půdorys (obrys příruby, stěna, drážka kartáče, vřeteno, magnety, vývod, uši objímky),
   vpravo nahoře řez A–A osou vřetene ve směru vývodu (komora, deska s objímkou, kartáč, hrdlo, nástroj),
   dole parametry, kusovník a popisové pole. sestavVykres(p, o, meta) → text SVG; meta = {datum, kusovnik: [[název, ks, pozn]]}. */
/* global BOTKA */
(function () {
  'use strict';
  const B = typeof module !== 'undefined' ? require('./jadro.js') : window.BOTKA;
  const MERITKA = [2, 1, 0.5, 0.4, 0.25, 0.2, 0.1, 0.05];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (x, d = 1) => B.fmt(x, d);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);
  const nazevMeritka = m => (m >= 1 ? `${m} : 1` : `1 : ${f(1 / m, 1)}`);
  const cesta = (polys, T) => polys.map(p => 'M' + p.map(([x, y]) => { const [a, b] = T(x, y); return `${a.toFixed(2)} ${b.toFixed(2)}`; }).join('L') + 'Z').join('');
  const kruh = (cx, cy, r, n = 48) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);

  function kota(P1, P2, off, text, out) {
    const dx = P2[0] - P1[0], dy = P2[1] - P1[1], l = Math.hypot(dx, dy);
    if (l < 0.5) return;
    const ux = dx / l, uy = dy / l, nx = uy, ny = -ux, sg = Math.sign(off) || 1;
    const A = [P1[0] + nx * off, P1[1] + ny * off], Bq = [P2[0] + nx * off, P2[1] + ny * off];
    out.push(`<line class="pom" x1="${(P1[0] + nx * sg).toFixed(2)}" y1="${(P1[1] + ny * sg).toFixed(2)}" x2="${(A[0] + nx * sg * 1.5).toFixed(2)}" y2="${(A[1] + ny * sg * 1.5).toFixed(2)}"/>`);
    out.push(`<line class="pom" x1="${(P2[0] + nx * sg).toFixed(2)}" y1="${(P2[1] + ny * sg).toFixed(2)}" x2="${(Bq[0] + nx * sg * 1.5).toFixed(2)}" y2="${(Bq[1] + ny * sg * 1.5).toFixed(2)}"/>`);
    out.push(`<line class="kota" x1="${A[0].toFixed(2)}" y1="${A[1].toFixed(2)}" x2="${Bq[0].toFixed(2)}" y2="${Bq[1].toFixed(2)}" marker-start="url(#sipka)" marker-end="url(#sipka)"/>`);
    let uhel = Math.atan2(uy, ux) * 180 / Math.PI;
    if (uhel > 90.5 || uhel < -90.5) uhel += 180;
    const tu = uhel * Math.PI / 180, mx = (A[0] + Bq[0]) / 2 + Math.sin(tu) * 1.2, my = (A[1] + Bq[1]) / 2 - Math.cos(tu) * 1.2;
    out.push(`<text class="kt" x="${mx.toFixed(2)}" y="${my.toFixed(2)}" transform="rotate(${uhel.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)})">${esc(t(text))}</text>`);
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

  function sestavVykres(p, o, meta) {
    const out = [], T0 = o.T, K = o.K;
    const linie = (pts, T, cls) => out.push(`<path class="${cls}" d="${cesta([pts], T)}"/>`);
    /* ---- půdorys ---- */
    const PR = { x: 12, y: 12, w: 140, h: 120 };
    const priruba = o.zas ? (() => { let P = B.obrys(T0, o.t + o.f, K); P = B.orizni(P, o.v, o.zas.Yl); P = B.orizni(P, [-o.v[0], -o.v[1]], o.zas.Yp); return B.orizni(P, o.u, o.zas.Xf); })() : B.obrys(T0, o.t + o.f, K);
    const vnejsiK = B.obrys(T0, o.t + o.f, K);
    const polys = [vnejsiK, priruba];
    if (o.usti) polys.push([[o.usti[0], o.usti[1]], [o.base[0], o.base[1]]]);
    const bP = obal(polys), U = umisti(bP, PR, { l: 18, r: 12, t: 12, b: 16 }), TP = U.T;
    out.push(`<path class="obrys tenky" d="${cesta([priruba], TP)}"/>`);
    if (o.zas) linie(vnejsiK, TP, 'skryta');
    linie(B.obrys(T0, o.t, K), TP, 'obrys');
    linie(B.obrys(T0, 0, K), TP, 'obrys');
    linie(B.obrys(T0, o.dc, K), TP, 'skryta');
    linie(kruh(0, 0, p.vreteno.prumer / 2), TP, 'obrys');
    linie(kruh(0, 0, o.Rring), TP, 'obrys');
    for (const [x, y] of o.magnety.body) linie(kruh(x, y, o.mR, 24), TP, 'skryta');
    // vývod: obrys hrdla v půdorysu (obdélník podél osy)
    {
      const ca = Math.cos(o.alfa), h = o.h, sA = Math.max(o.sO, p.vyvod.umisteni === 'deska' ? 0 : o.sO), sE = o.sE;
      const a = [o.base[0] + o.u[0] * ca * sA, o.base[1] + o.u[1] * ca * sA], b = [o.base[0] + o.u[0] * ca * sE, o.base[1] + o.u[1] * ca * sE];
      const n = [o.v[0] * h.roMax, o.v[1] * h.roMax];
      linie([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], TP, 'obrys');
    }
    if (p.objimka.upnuti === 'sroub') {
      const c = Math.cos(o.psiC), s = Math.sin(o.psiC), Uc = o.ucho, R = ([r, w]) => [r * c - w * s, r * s + w * c];
      linie([[o.Rring, -(o.sw / 2 + Uc.wn)], [Uc.r1, -(o.sw / 2 + Uc.wn)], [Uc.r1, o.sw / 2 + Uc.wh], [o.Rring, o.sw / 2 + Uc.wh]].map(R), TP, 'obrys');
    }
    const osaH = (a, b) => out.push(`<line class="osa" x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}"/>`);
    osaH(TP(bP.x0 - 4, 0), TP(bP.x1 + 4, 0)); osaH(TP(0, bP.y0 - 4), TP(0, bP.y1 + 4));
    // řez A–A ve směru vývodu
    const L = Math.max(bP.w, bP.h) * 0.55, A1 = TP(-o.u[0] * L, -o.u[1] * L), A2 = TP(o.u[0] * L, o.u[1] * L);
    out.push(`<line class="rezcara" x1="${A1[0].toFixed(2)}" y1="${A1[1].toFixed(2)}" x2="${A2[0].toFixed(2)}" y2="${A2[1].toFixed(2)}"/>`);
    out.push(`<text class="kt b" x="${A2[0].toFixed(2)}" y="${(A2[1] - 1.5).toFixed(2)}">A</text><text class="kt b" x="${A1[0].toFixed(2)}" y="${(A1[1] - 1.5).toFixed(2)}">A</text>`);
    const bK = obal([vnejsiK]);
    kota(TP(bK.x0, bK.y0), TP(bK.x1, bK.y0), -7, `${f(bK.w, 1)}`, out);
    kota(TP(bK.x1, bK.y0), TP(bK.x1, bK.y1), -7, `${f(bK.h, 1)}`, out);
    const bI = obal([B.obrys(T0, 0, K)]);
    kota(TP(bI.x0, bI.y1), TP(bI.x1, bI.y1), 6, `${f(bI.w, 1)} ${t('vnitřní')}`, out);
    out.push(`<text class="nadpis" x="${PR.x + PR.w / 2}" y="${PR.y + PR.h - 1}">${esc(t('Půdorys'))} · ${nazevMeritka(U.m)}</text>`);

    /* ---- řez A–A ---- */
    const PS = { x: 156, y: 12, w: 130, h: 120 };
    const ray = (d, smer) => B.paprsek(B.obrys(T0, d, K), [0, 0], smer);
    const um = [-o.u[0], -o.u[1]];
    const stenaProfil = [[o.dOut, o.zkb], [o.dOut, o.zkb + o.hL], [o.t, o.zkb + o.hL + o.nabehVen], [o.t, o.zfb0], [o.t + o.f, o.zfb0 + o.f], [o.t + o.f, o.zpb],
      [0, o.zpb], [0, o.zkb + o.hL + o.nabehDovnitr], [o.dIn, o.zkb + o.hL], [o.dIn, o.zkb]];
    const stena = sg => stenaProfil.map(([d, z]) => [sg * ray(d, sg > 0 ? o.u : um), z]);
    const drazka = sg => [[o.dc - o.wg / 2, o.zkb], [o.dc + o.wg / 2, o.zkb], [o.dc + o.wg / 2, o.zkb + o.hd], [o.dc - o.wg / 2, o.zkb + o.hd]].map(([d, z]) => [sg * ray(d, sg > 0 ? o.u : um), z]);
    const kart = sg => [[o.dc - p.kartac.pasek / 2, o.zBr], [o.dc + p.kartac.pasek / 2, o.zBr], [o.dc + p.kartac.pasek / 2, o.zkb + o.hd], [o.dc - p.kartac.pasek / 2, o.zkb + o.hd]].map(([d, z]) => [sg * ray(d, sg > 0 ? o.u : um), z]);
    const okrajDesky = sg => (o.zas ? (sg > 0 ? o.zas.Xf : ray(o.t + o.f, um)) : ray(o.t + o.f, sg > 0 ? o.u : um));
    const deska = sg => [[sg * o.Rb, o.zpb], [sg * okrajDesky(sg), o.zpb], [sg * okrajDesky(sg), o.zpt], [sg * o.Rring, o.zpt], [sg * o.Rring, o.zTop], [sg * o.Rb, o.zTop]];
    // hrdlo v rovině řezu (souřadnice: vzdálenost ve směru u, výška)
    const vRovine = p.vyvod.umisteni === 'deska' || Math.abs(o.e || 0) < 0.5;
    const ca = Math.cos(o.alfa), sa = Math.sin(o.alfa), bu = o.base[0] * o.u[0] + o.base[1] * o.u[1];
    const naOse = (r, s) => [bu + s * ca - r * sa, o.base[2] + s * sa + r * ca];
    const prof = B.profilHrdla(o.h, o.sO, o.sB, o.sN, o.sE);
    const plast = pr => pr.map(([r, s]) => naOse(r, s)).concat(pr.slice().reverse().map(([r, s]) => naOse(-r, s)));
    const nadDeskou = q => (p.vyvod.umisteni === 'deska' ? B.orizni(q, [0, -1], -o.zpb) : q);
    const hrdloV = nadDeskou(plast(prof.ven)), hrdloI = nadDeskou(plast(prof.vrt.filter(([, s]) => s <= o.sE + 0.5)));
    const polS = [stena(1), stena(-1), deska(1), deska(-1), [[0, o.zTip - 4], [0, o.zTop + 6]]];
    if (vRovine) polS.push(hrdloV);
    const bS = obal(polS), US = umisti(bS, PS, { l: 16, r: 16, t: 10, b: 14 }), TS = US.T;
    for (const sg of [1, -1]) {
      out.push(`<path class="rez" d="${cesta([stena(sg)], TS)}"/><path class="obrys" d="${cesta([stena(sg)], TS)}"/>`);
      out.push(`<path class="dira" d="${cesta([drazka(sg)], TS)}"/>`);
      out.push(`<path class="kartac" d="${cesta([kart(sg)], TS)}"/>`);
      out.push(`<path class="rez" d="${cesta([deska(sg)], TS)}"/><path class="obrys" d="${cesta([deska(sg)], TS)}"/>`);
    }
    if (vRovine) {
      out.push(`<path class="rez" d="${cesta([hrdloV], TS)}"/><path class="dira" d="${cesta([hrdloI], TS)}"/><path class="obrys" d="${cesta([hrdloV], TS)}"/>`);
      out.push(`<path class="obrys tenky0" d="${cesta([hrdloI], TS)}"/>`);
    }
    // vřeteno a nástroj (tence)
    const Dv = p.vreteno.prumer / 2;
    out.push(`<path class="skryta" d="${cesta([[[-Dv, 0], [Dv, 0], [Dv, o.zTop + 6], [-Dv, o.zTop + 6]], [[-3, o.zTip], [3, o.zTip], [3, 0], [-3, 0]]], TS)}"/>`);
    const osa = TS(0, bS.y0 - 3), osa2 = TS(0, bS.y1 + 3);
    out.push(`<line class="osa" x1="${osa[0].toFixed(2)}" y1="${osa[1].toFixed(2)}" x2="${osa2[0].toFixed(2)}" y2="${osa2[1].toFixed(2)}"/>`);
    const xl = -ray(o.t + o.f, um), xr = ray(o.t + o.f, o.u);
    kota(TS(xl, o.zkb), TS(xl, o.zpb), 7, `${f(o.Hk, 1)}`, out);
    kota(TS(-o.Rring, o.zpt), TS(-o.Rring, o.zTop), -5, `${f(p.objimka.vyska, 1)}`, out);
    kota(TS(Dv + 2, 0), TS(Dv + 2, o.zpb), -4, `${f(o.zpb, 1)}`, out);
    kota(TS(-Dv, o.zTop + 6), TS(Dv, o.zTop + 6), 4, `Ø ${f(p.vreteno.prumer, 1)}`, out);
    kota(TS(4, o.zTip), TS(4, 0), -3, `${f(p.vreteno.vylozeni, 1)}`, out);
    kota(TS(xr, o.zBr), TS(xr, o.zkb), -6, `${f(o.Lv, 1)}`, out);
    if (vRovine) kota(TS(...naOse(-o.h.roMax, o.sE)), TS(...naOse(o.h.roMax, o.sE)), 4, `Ø ${f(2 * (o.h.zasun ? o.h.rs1 : o.h.os1), 1)}`, out);
    out.push(`<text class="nadpis" x="${PS.x + PS.w / 2}" y="${PS.y + PS.h - 1}">${esc(t('Řez A–A'))} · ${nazevMeritka(US.m)}</text>`);
    if (!vRovine) out.push(`<text class="tab" x="${PS.x + 2}" y="${PS.y + 6}">${esc(t('vývod je tečně – mimo rovinu řezu'))}</text>`);

    /* ---- parametry, kusovník, popisové pole ---- */
    const h = o.h, radky = [
      ['Vřeteno / otvor objímky', `Ø ${f(p.vreteno.prumer, 1)} / Ø ${f(2 * o.Rb, 2)} mm`],
      ['Komora (vnitřní)', `${f(bI.w, 1)} × ${f(bI.h, 1)} × ${f(o.Hk, 1)} mm`],
      ['Drážka kartáče', `${f(o.wg, 2)} × ${f(o.hd, 1)} mm, obvod ${f(o.obvodKartace, 0)} mm`],
      ['Vývod', `${h.zasun ? 'hrdlo Ø ' + f(2 * h.rs0, 2) + '–' + f(2 * h.rs1, 2) : 'trn Ø ' + f(2 * h.os0, 2) + '–' + f(2 * h.os1, 2)} mm, sklon ${f(p.vyvod.sklon, 0)}°`],
      ['Uchycení komory', p.uchyceni.typ === 'magnety' ? `${o.magnety.body.length} × Ø ${f(p.uchyceni.prumer)} × ${f(p.uchyceni.vyska)} mm, kapsa Ø ${f(2 * o.mR, 2)}` : `zásuv, vůle ${f(p.uchyceni.vuleZasuvu, 2)} mm`],
    ];
    let y = 140;
    out.push(`<text class="nadpis l" x="14" y="${y}">${esc(t('Parametry'))}</text>`);
    for (const [a, b] of radky) { y += 5; out.push(`<text class="tab" x="14" y="${y}">${esc(t(a))}</text><text class="tab b" x="140" y="${y}" text-anchor="end">${esc(t(b))}</text><line class="pom" x1="12" y1="${y + 1.4}" x2="142" y2="${y + 1.4}"/>`); }
    y = 140;
    out.push(`<text class="nadpis l" x="158" y="${y}">${esc(t('Kusovník'))}</text>`);
    for (const [a, b] of meta.kusovnik.slice(0, 9)) {
      y += 4.3;
      const nz = String(t(a)); out.push(`<text class="tab" x="158" y="${y}">${esc(nz.length > 58 ? nz.slice(0, 57) + '…' : nz)}</text><text class="tab b" x="285" y="${y}" text-anchor="end">${esc(t(b))}</text>`);
    }
    const py = 184;
    out.push(`<rect class="ram" x="158" y="${py}" width="127" height="16"/><line class="ram" x1="158" y1="${py + 8}" x2="285" y2="${py + 8}"/><line class="ram" x1="240" y1="${py}" x2="240" y2="${py + 16}"/>`);
    out.push(`<text class="pole b" x="160" y="${py + 5.5}">${esc(p.nazev || 'Odsávací botka')}</text>`);
    out.push(`<text class="pole" x="242" y="${py + 5.5}">${esc(meta.datum)}</text>`);
    out.push(`<text class="pole" x="160" y="${py + 13.5}">${esc(t('Odsávací botka – půdorys a řez'))}</text>`);
    out.push(`<text class="pole" x="242" y="${py + 13.5}">${esc(t('rozměry v mm · list 1/1'))}</text>`);

    return `<svg class="vk-svg" xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210" font-family="Arial, Helvetica, sans-serif">
<defs><pattern id="srafy" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#000" stroke-width="0.18"/></pattern>
<marker id="sipka" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" fill="#000"/></marker>
<style>.vk-svg .rez{fill:url(#srafy);stroke:none}.vk-svg .dira{fill:#fff;stroke:#000;stroke-width:0.25}.vk-svg .kartac{fill:#bbb;stroke:#000;stroke-width:0.18}
.vk-svg .obrys{fill:none;stroke:#000;stroke-width:0.45;stroke-linejoin:round}.vk-svg .obrys.tenky{stroke-width:0.3;fill:#f2f2f2}.vk-svg .tenky0{stroke-width:0.25}
.vk-svg .skryta{fill:none;stroke:#000;stroke-width:0.2;stroke-dasharray:2 1}.vk-svg .rezcara{stroke:#000;stroke-width:0.35;stroke-dasharray:8 1.5 1 1.5}
.vk-svg .osa{stroke:#000;stroke-width:0.18;stroke-dasharray:6 1.5 1 1.5}.vk-svg .kota{stroke:#000;stroke-width:0.18}.vk-svg .pom{stroke:#000;stroke-width:0.13}
.vk-svg .kt{font-size:2.5px;text-anchor:middle}.vk-svg .nadpis{font-size:3.5px;font-weight:bold;text-anchor:middle}.vk-svg .nadpis.l{text-anchor:start}
.vk-svg .tab{font-size:2.6px}.vk-svg .b{font-weight:bold}.vk-svg .ram{fill:none;stroke:#000;stroke-width:0.35}.vk-svg .pole{font-size:3px}</style></defs>
<rect x="0" y="0" width="297" height="210" fill="#fff"/><rect class="ram" x="8" y="8" width="281" height="194"/>
${out.join('\n')}
</svg>`;
  }

  const API = { sestavVykres };
  if (typeof module !== 'undefined') module.exports = API; else window.BOTKA_VYK = API;
})();
