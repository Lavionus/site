/* Kloubová hadice – výkres A4 na šířku (SVG v mm, černě na bílém):
   vlevo řez článkem osou (šrafy, kóty koule, jamky, hrdla, kanálu, rozteče a výšky), vpravo nahoře bokorys sestavy
   v rovině ohybu s kótami vyložení a výšky, vpravo dole tabulka, kusovník a popisové pole.
   sestavVykres(p, o, model, meta) → text SVG; meta = {datum, hmotnost, material, dp, delka}. */
/* global KHAD */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.KHAD;
  const MERITKA = [10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (x, d = 1) => K.fmt(x, d);
  /** Popisky výkresu v jazyce rozhraní (I18N.preloz umí i vzory s čísly); bez překladu čeština. */
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);
  const nazevMeritka = m => (m >= 1 ? `${m} : 1` : `1 : ${Math.round(1 / m)}`);
  const cesta = (polys, T) => polys.map(p => 'M' + p.map(([x, y]) => { const [a, b] = T(x, y); return `${a.toFixed(2)} ${b.toFixed(2)}`; }).join('L') + 'Z').join('');

  /** Kóta mezi body P1 a P2 (papír, mm) odsazená o off kolmo, text nad čarou. */
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
    out.push(`<text class="kt" x="${mx.toFixed(2)}" y="${my.toFixed(2)}" transform="rotate(${uhel.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)})">${esc(t(text))}</text>`);
  }
  function obal(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  /** Konvexní obálka 2D bodů (monotónní řetězec). */
  function obalka(b) {
    const p = b.slice().sort((a, c) => a[0] - c[0] || a[1] - c[1]), x = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
    const d = [], h = [];
    for (const q of p) { while (d.length >= 2 && x(d[d.length - 2], d[d.length - 1], q) <= 0) d.pop(); d.push(q); }
    for (const q of p.reverse()) { while (h.length >= 2 && x(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); }
    return d.slice(0, -1).concat(h.slice(0, -1));
  }
  /** Obrys dílu v jeho místní rovině XZ: obálka vrcholů sítě (patka, tryska). */
  function obrysSite(d) {
    const b = [];
    for (let i = 0; i < d.poz.length; i += 3 * 2) b.push([d.poz[i], d.poz[i + 2]]);   // každý 2. vrchol – obálka je přesná na desetiny
    return obalka(b);
  }

  function sestavVykres(p, o, model, meta) {
    const out = [], sek = K.sekceClanku(o);
    const rezP = sek, rezL = sek.map(([r, z]) => [-r, z]).reverse();
    /* ---- řez článkem: plocha vlevo ---- */
    const PR = { x: 12, y: 14, w: 152, h: 166 }, ok = { l: 26, r: 26, t: 12, b: 18 };
    const bR = obal([rezP, rezL]);
    const mR = MERITKA.find(k => bR.w * k <= PR.w - ok.l - ok.r && bR.h * k <= PR.h - ok.t - ok.b) || MERITKA[MERITKA.length - 1];
    const cx = PR.x + ok.l + (PR.w - ok.l - ok.r) / 2, cy = PR.y + ok.t + (PR.h - ok.t - ok.b - bR.h * mR) / 2 + bR.y1 * mR;
    const T = (r, z) => [cx + r * mR, cy - z * mR];
    out.push(`<path class="rez" d="${cesta([rezP, rezL], T)}"/>`);
    // vnější obrys silně (bez šraf kanálu)
    out.push(`<path class="obrys" d="${cesta([rezP, rezL], T)}"/>`);
    const osa = (a, b) => out.push(`<line class="osa" x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}"/>`);
    osa(T(0, bR.y0 - 4 / mR), T(0, bR.y1 + 4 / mR));
    for (const z of [0, o.L]) osa(T(-o.Ro - 3 / mR, z), T(o.Ro + 3 / mR, z));
    // kóty
    kota(T(-o.Rk, 0), T(o.Rk, 0), -(o.a * mR + 6), `Ø ${f(2 * o.Rk, 2)} koule`, out);
    kota(T(-o.Ro, o.L), T(o.Ro, o.L), o.ztop * mR + 9, `Ø ${f(2 * o.Ro, 1)}`, out);
    kota(T(-o.Rs, o.L), T(o.Rs, o.L), 0, `Ø ${f(2 * o.Rs, 2)} jamka`, out);
    kota(T(-o.rl, o.L + o.zl), T(o.rl, o.L + o.zl), (o.ztop - o.zl) * mR + 4, `Ø ${f(2 * o.rl, 2)} hrdlo`, out);
    if (o.rc > 0) kota(T(-o.rc, -o.a), T(o.rc, -o.a), -(o.a * mR + 14) + o.a * mR, `Ø ${f(2 * o.rc, 1)} kanál`, out);
    kota(T(-o.Ro - 2 / mR, o.L), T(-o.Ro - 2 / mR, 0), -8, `${f(o.L, 1)} rozteč`, out);
    kota(T(o.Ro + 2 / mR, -o.a), T(o.Ro + 2 / mR, o.L + o.ztop), -8, `${f(o.vyska, 1)} výška`, out);
    out.push(`<text class="nadpis" x="${PR.x + PR.w}" y="${PR.y + PR.h - 1}" text-anchor="end" style="text-anchor:end">${esc(t('Řez článkem A–A'))} · ${nazevMeritka(mR)}</text>`);

    /* ---- bokorys sestavy v rovině XZ (první větev) ---- */
    const PB = { x: 170, y: 14, w: 115, h: 100 };
    const polys = [];
    const doSveta = (ram, r, z) => [ram.P[0] + ram.R[0] * r + ram.R[6] * z, ram.P[2] + ram.R[2] * r + ram.R[8] * z];
    const ven = [...K.sekceClanku(o)].filter(([r]) => r >= o.rc - 1e-9);
    const obrysCl = (() => { const pr = ven.slice(1, ven.findIndex(q => Math.abs(q[0] - (o.rl + o.c)) < 1e-9 && q[1] > o.L) + 1); return pr.concat(pr.map(([r, z]) => [-r, z]).reverse()); })();
    const ramy = model.ramy[0], n = p.retez.pocet;
    polys.push(obrysSite(model.patka));
    // rovinný tvar: obrys článku z profilu (pěkný pas krčku); prostorový (natočení ≠ 0): průmět sítě do roviny XZ (obálka)
    const rovinny = K.natoceniRetezu(p).every(a => a === 0);
    for (let i = 0; i < n; i++) polys.push(rovinny ? obrysCl.map(([r, z]) => doSveta(ramy[i], r, z)) : obrysSite({ poz: K.presun(model.clanek, ramy[i]) }));
    polys.push(rovinny ? obrysSite(model.tryska).map(([x, z]) => doSveta(ramy[n], x, z)) : obrysSite({ poz: K.presun(model.tryska, ramy[n]) }));
    const bB = obal(polys), okB = { l: 16, r: 8, t: 12, b: 14 };
    const mB = MERITKA.find(k => bB.w * k <= PB.w - okB.l - okB.r && bB.h * k <= PB.h - okB.t - okB.b) || MERITKA[MERITKA.length - 1];
    const bx = PB.x + okB.l + (PB.w - okB.l - okB.r - bB.w * mB) / 2 - bB.x0 * mB, by = PB.y + okB.t + (PB.h - okB.t - okB.b - bB.h * mB) / 2 + bB.y1 * mB;
    const TB = (x, z) => [bx + x * mB, by - z * mB];
    out.push(`<path class="obrys tenky" d="${cesta(polys, TB)}"/>`);
    out.push(`<line class="osa" x1="${TB(bB.x0 - 3, 0)[0].toFixed(2)}" y1="${TB(0, 0)[1].toFixed(2)}" x2="${TB(bB.x1 + 3, 0)[0].toFixed(2)}" y2="${TB(0, 0)[1].toFixed(2)}"/>`);
    kota(TB(bB.x0, bB.y0), TB(bB.x1, bB.y0), -6, `${f(bB.w, 0)}`, out);
    kota(TB(bB.x0, bB.y0), TB(bB.x0, bB.y1), 6, `${f(bB.h, 0)}`, out);
    out.push(`<text class="nadpis" x="${PB.x + PB.w / 2}" y="${PB.y + 6}">${esc(t('Sestava – bokorys'))} · ${nazevMeritka(mB)}</text>`);

    /* ---- tabulka, kusovník, popisové pole ---- */
    const k = p.kloub, radky = [
      ['Kanál / koule', `Ø ${f(k.kanal)} / Ø ${f(k.koule)} mm`], ['Přesah hrdla / vůle', `${f(k.presah, 2)} / ${f(k.vule, 2)} mm`],
      ['Rozteč článků', `${f(k.roztec, 1)} mm`], ['Mezní ohyb kloubu', `${f(o.ohybMax, 1)}°`],
      ['Zářezy hrdla', k.zarezu >= 2 ? `${k.zarezu} × ${f(k.sirkaZarezu, 1)} mm` : 'bez zářezů'],
      ['Délka natažená', `${f(meta.delka, 0)} mm`], ['Hmotnost (plast)', `${f(meta.hmotnost, 0)} g ${meta.material}`],
    ];
    if (meta.dp) radky.push(['Tlaková ztráta', meta.dp]);
    let y = 114;
    out.push(`<text class="nadpis l" x="172" y="${y}">${esc(t('Parametry'))}</text>`); y += 2;
    for (const [a, b] of radky) { y += 5; out.push(`<text class="tab" x="172" y="${y}">${esc(t(a))}</text><text class="tab b" x="283" y="${y}" text-anchor="end">${esc(t(b))}</text><line class="pom" x1="170" y1="${y + 1.4}" x2="285" y2="${y + 1.4}"/>`); }
    // kusovník vlevo dole pod řezem
    y = 184;
    out.push(`<text class="nadpis l" x="14" y="${y}">${esc(t('Kusovník'))}</text>`); y += 1;
    meta.kusovnik.slice(0, 6).forEach(([a, b], i) => {
      const x = 14 + (i % 2) * 74, yy = y + 4.5 * (Math.floor(i / 2) + 1);
      out.push(`<text class="tab" x="${x}" y="${yy}">${esc(t(a))}</text><text class="tab b" x="${x + 66}" y="${yy}" text-anchor="end">${esc(t(`${b} ks`))}</text>`);
    });
    // popisové pole
    const py = 184;
    out.push(`<rect class="ram" x="170" y="${py}" width="115" height="16"/><line class="ram" x1="170" y1="${py + 8}" x2="285" y2="${py + 8}"/><line class="ram" x1="240" y1="${py}" x2="240" y2="${py + 16}"/>`);
    out.push(`<text class="pole b" x="172" y="${py + 5.5}">${esc(p.nazev || 'Kloubová hadice')}</text>`);
    out.push(`<text class="pole" x="242" y="${py + 5.5}">${esc(meta.datum)}</text>`);
    out.push(`<text class="pole" x="172" y="${py + 13.5}">${esc(t('Kloubová hadice – článek a sestava'))}</text>`);
    out.push(`<text class="pole" x="242" y="${py + 13.5}">${esc(t('rozměry v mm · list 1/1'))}</text>`);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210" font-family="Arial, Helvetica, sans-serif">
<defs><pattern id="srafy" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#000" stroke-width="0.18"/></pattern>
<marker id="sipka" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" fill="#000"/></marker>
<style>.rez{fill:url(#srafy);stroke:none}.obrys{fill:none;stroke:#000;stroke-width:0.5;stroke-linejoin:round}.obrys.tenky{stroke-width:0.3;fill:#f2f2f2}
.osa{stroke:#000;stroke-width:0.18;stroke-dasharray:6 1.5 1 1.5}.kota{stroke:#000;stroke-width:0.18}.pom{stroke:#000;stroke-width:0.13}
.kt{font-size:2.5px;text-anchor:middle}.nadpis{font-size:3.5px;font-weight:bold;text-anchor:middle}.nadpis.l{text-anchor:start}
.tab{font-size:2.6px}.b{font-weight:bold}.ram{fill:none;stroke:#000;stroke-width:0.35}.pole{font-size:3px}</style></defs>
<rect x="0" y="0" width="297" height="210" fill="#fff"/><rect class="ram" x="8" y="8" width="281" height="194"/>
${out.join('\n')}
</svg>`;
  }

  const API = { sestavVykres, obalka };
  if (typeof module !== 'undefined') module.exports = API; else window.KHAD_VYK = API;
})();
