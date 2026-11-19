/* Kopírovací kroužky – výkres v mm, MĚŘÍTKO 1 : 1 (vrtací a kontrolní šablona patky):
   nahoře podložka pohledem shora (strana k patce frézky), středy děr s křížky, rozteč,
   kontrolní úsečka 100 mm; dole polořez kroužku (1 : 1 nebo 2 : 1) s kótami, parametry, odsazení šablony a kusovník.
   Velikost listu: A4 na výšku, když se podložka vejde, jinak A3, jinak list podle podložky (tisk na velký formát / plotr).
   sestavVykres(p, o, model, meta) → {svg, sirka, vyska}; meta = {datum, kusovnik: [[název, množství]]}. */
/* global KROUZKY */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.KROUZKY;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (x, d = 1) => K.fmt(x, d);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);
  const n2 = x => x.toFixed(2);

  function kota(P1, P2, off, text, out) {
    const dx = P2[0] - P1[0], dy = P2[1] - P1[1], l = Math.hypot(dx, dy);
    if (l < 0.5) return;
    const ux = dx / l, uy = dy / l, nx = uy, ny = -ux, sg = Math.sign(off) || 1;
    const A = [P1[0] + nx * off, P1[1] + ny * off], B = [P2[0] + nx * off, P2[1] + ny * off];
    out.push(`<line class="pom" x1="${n2(P1[0] + nx * sg)}" y1="${n2(P1[1] + ny * sg)}" x2="${n2(A[0] + nx * sg * 1.5)}" y2="${n2(A[1] + ny * sg * 1.5)}"/>`);
    out.push(`<line class="pom" x1="${n2(P2[0] + nx * sg)}" y1="${n2(P2[1] + ny * sg)}" x2="${n2(B[0] + nx * sg * 1.5)}" y2="${n2(B[1] + ny * sg * 1.5)}"/>`);
    out.push(`<line class="kota" x1="${n2(A[0])}" y1="${n2(A[1])}" x2="${n2(B[0])}" y2="${n2(B[1])}" marker-start="url(#sipka)" marker-end="url(#sipka)"/>`);
    let uhel = Math.atan2(uy, ux) * 180 / Math.PI;
    if (uhel > 90.5 || uhel < -90.5) uhel += 180;
    const tu = uhel * Math.PI / 180, mx = (A[0] + B[0]) / 2 + Math.sin(tu) * 1.2, my = (A[1] + B[1]) / 2 - Math.cos(tu) * 1.2;
    out.push(`<text class="kt" x="${n2(mx)}" y="${n2(my)}" transform="rotate(${n2(uhel)} ${n2(mx)} ${n2(my)})">${esc(t(text))}</text>`);
  }
  const cesta = (polys, T) => polys.map(p => 'M' + p.map(([x, y]) => { const [a, b] = T(x, y); return `${n2(a)} ${n2(b)}`; }).join('L') + 'Z').join('');
  const kruhSvg = (T, x, y, r, cls) => { const [a, b] = T(x, y); return `<circle class="${cls}" cx="${n2(a)}" cy="${n2(b)}" r="${n2(r)}"/>`; };
  const kriz = (T, x, y, r) => { const [a, b] = T(x, y), d = r + 2.5; return `<line class="osa" x1="${n2(a - d)}" y1="${n2(b)}" x2="${n2(a + d)}" y2="${n2(b)}"/><line class="osa" x1="${n2(a)}" y1="${n2(b - d)}" x2="${n2(a)}" y2="${n2(b + d)}"/>`; };

  function sestavVykres(p, o, model, meta) {
    const out = [], M = 12;               // okraj listu
    /* ---- podložka 1:1 ---- */
    const polys = (model && model.obrysPodlozky) || (p.dily.podlozka ? o.obrysy : null);
    let bb = null;
    if (p.dily.podlozka && polys) {
      bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const P of polys) for (const [x, y] of P) { bb.x0 = Math.min(bb.x0, x); bb.x1 = Math.max(bb.x1, x); bb.y0 = Math.min(bb.y0, y); bb.y1 = Math.max(bb.y1, y); }
    }
    const spodek = 86;                    // výška pásu s řezem kroužku, tabulkami a popisovým polem
    const w0 = bb ? bb.x1 - bb.x0 + 24 : 0, h0 = bb ? bb.y1 - bb.y0 + 36 : 0;
    let W = 210, H = 297;
    if (w0 + 2 * M > W || h0 + spodek + 2 * M > H) { W = 297; H = 420; }
    if (w0 + 2 * M > W || h0 + spodek + 2 * M > H) { W = Math.ceil(Math.max(297, w0 + 2 * M)); H = Math.ceil(Math.max(420, h0 + spodek + 2 * M)); }
    let yPas = M + 4;
    if (bb) {
      const ox = W / 2 - (bb.x0 + bb.x1) / 2, oy = M + 16 + bb.y1;   // shora: +y nahoru na papíře
      const T = (x, y) => [ox + x, oy - y];
      out.push(`<text class="nadpis" x="${W / 2}" y="${M + 6}">${esc(t('Podložka – pohled shora, MĚŘÍTKO 1 : 1'))}</text>`);
      out.push(`<path class="obrys tenky" d="${cesta(polys, T)}" fill-rule="evenodd"/>`);
      const pd = p.podlozka;
      if (pd.otvor === 'krouzky') out.push(kruhSvg(T, 0, 0, o.Rc, 'skryta'));
      out.push(kruhSvg(T, 0, 0, o.Rotvor, 'obrys'));
      out.push(kriz(T, 0, 0, Math.max(o.Rc, o.Rotvor) + 4));
      if (pd.pocet) {
        out.push(kruhSvg(T, 0, 0, pd.roztec / 2, 'osa'));
        for (const [x, y] of o.sroubyP) { out.push(kruhSvg(T, x, y, o.sroubP.otvor / 2, 'obrys'), kruhSvg(T, x, y, o.sroubP.hlava / 2, 'skryta'), kriz(T, x, y, o.sroubP.hlava / 2)); }
      }
      if (pd.otvor === 'krouzky') for (const [x, y] of o.sroubyK) out.push(kruhSvg(T, x, y, o.sroubK.jadro / 2, 'obrys'), kriz(T, x, y, 1.5));
      for (const d of o.dirKruzitka) out.push(kruhSvg(T, d.x, d.y, o.rd, 'obrys'));
      if (o.dirKruzitka.length) {
        const a = o.dirKruzitka[0], b = o.dirKruzitka[o.dirKruzitka.length - 1], [bx, by] = T(b.x, b.y);
        out.push(`<text class="tab" x="${n2(bx)}" y="${n2(by - o.rd - 2)}" text-anchor="middle">R ${f(a.R)}–${f(b.R)} / ${f(p.kruzitko.krok)}</text>`);
      }
      if (p.madlo.zapnuto && o.madloBod) out.push(kruhSvg(T, o.madloBod[0], o.madloBod[1], p.madlo.prumer / 2, 'skryta'));
      if (p.vyvod.zapnuto && o.base) {
        const v = p.vyvod, sa = Math.sin(o.alfa), a = [o.base[0] - o.u[0] * o.h.rb / sa, o.base[1] - o.u[1] * o.h.rb / sa], b = [o.base[0] + o.u[0] * o.h.rb / sa, o.base[1] + o.u[1] * o.h.rb / sa];
        const n = [-o.u[1] * o.h.rb, o.u[0] * o.h.rb];
        out.push(`<path class="skryta" d="${cesta([[[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]]], T)}"/>`);
        const g = v.drazka / 2, gn = [-o.u[1] * g, o.u[0] * g];
        out.push(`<path class="skryta" d="${cesta([[[gn[0], gn[1]], [o.u[0] * o.rp + gn[0], o.u[1] * o.rp + gn[1]], [o.u[0] * o.rp - gn[0], o.u[1] * o.rp - gn[1]], [-gn[0], -gn[1]]]], T)}"/>`);
      }
      // kóty: šířka, výška, rozteč
      kota(T(bb.x0, bb.y0), T(bb.x1, bb.y0), 7, `${f(bb.x1 - bb.x0, 1)}`, out);
      kota(T(bb.x1, bb.y0), T(bb.x1, bb.y1), 7, `${f(bb.y1 - bb.y0, 1)}`, out);
      if (pd.pocet) {
        const a = Math.PI / 4;
        kota(T(-pd.roztec / 2 * Math.cos(a), -pd.roztec / 2 * Math.sin(a)), T(pd.roztec / 2 * Math.cos(a), pd.roztec / 2 * Math.sin(a)), 0, `Ø ${f(pd.roztec, 1)} · ${pd.pocet}× ${K.SROUBY[pd.sroub].nazev}`, out);
      }
      // kontrolní úsečka 100 mm
      const ky = oy - bb.y0 + 12;
      out.push(`<line class="ram" x1="${M + 4}" y1="${n2(ky)}" x2="${M + 104}" y2="${n2(ky)}"/><line class="ram" x1="${M + 4}" y1="${n2(ky - 2)}" x2="${M + 4}" y2="${n2(ky + 2)}"/><line class="ram" x1="${M + 104}" y1="${n2(ky - 2)}" x2="${M + 104}" y2="${n2(ky + 2)}"/>`);
      out.push(`<text class="tab" x="${M + 106}" y="${n2(ky - 0.6)}">${esc(t('kontrola: po tisku musí mít úsečka přesně 100 mm (tisk „skutečná velikost“)'))}</text>`);
      out.push(`<text class="tab" x="${M + 106}" y="${n2(ky + 3)}">${esc(t('na patku přiložte list potiskem k patce (zrcadlově)'))}</text>`);
      yPas = ky + 8;
    }
    /* ---- polořez kroužku ---- */
    const Px = M + 2, Py = yPas, Pw = 92, Ph = Math.max(50, H - M - 20 - yPas);
    if (p.dily.krouzek) {
      const kr = o.kr, zTop = kr.tp + (o.matice ? o.Hn : 0), vys = zTop + kr.L, sir = Math.max(o.Rp, kr.R) * 2;
      const m = sir * 2 <= Pw - 14 && vys * 2 <= Math.min(Ph, 70) - 26 ? 2 : 1;
      const cx = Px + Pw / 2, cy = Py + 12 + zTop * m;
      const T = (r, z) => [cx + r * m, cy - z * m];
      const prof = [[kr.rb, -kr.L], [kr.R - kr.c, -kr.L], [kr.R, -kr.L + kr.c], [kr.R, 0], [o.Rp, 0], [o.Rp, kr.tp]];
      if (o.matice) prof.push([o.Rk, kr.tp + o.w], [o.Rk, zTop], [kr.rb, zTop]); else prof.push([kr.rb, kr.tp]);
      for (const sg of [1, -1]) {
        const P = prof.map(([r, z]) => [sg * r, z]);
        out.push(`<path class="rez" d="${cesta([P], T)}"/><path class="obrys" d="${cesta([P], T)}"/>`);
      }
      out.push(`<line class="osa" x1="${n2(cx)}" y1="${n2(cy - (zTop + 3) * m)}" x2="${n2(cx)}" y2="${n2(cy + (kr.L + 3) * m)}"/>`);
      kota(T(-kr.R, -kr.L), T(kr.R, -kr.L), -5, `Ø ${f(kr.Dv, 2)}`, out);
      kota(T(-kr.rb, zTop), T(kr.rb, zTop), 4, `Ø ${f(kr.d, 2)}`, out);
      kota(T(-o.Rp, 0), T(o.Rp, 0), -(kr.L * m + 11), `Ø ${f(2 * o.Rp, 1)}`, out);
      kota(T(o.Rp, 0), T(o.Rp, kr.tp), -4, f(kr.tp, 1), out);
      kota(T(kr.R, -kr.L), T(kr.R, 0), -4, f(kr.L, 1), out);
      out.push(`<text class="nadpis" x="${n2(cx)}" y="${n2(cy + kr.L * m + 19)}">${esc(t('Kroužek – řez'))} · ${m} : 1</text>`);
    }
    /* ---- parametry a kusovník ---- */
    const X = Px + Pw + 6, Xr = W - M - 2;
    let y = yPas + 4;
    const radek = (a, b) => { y += 4.4; out.push(`<text class="tab" x="${X}" y="${n2(y)}">${esc(t(a))}</text><text class="tab b" x="${Xr}" y="${n2(y)}" text-anchor="end">${esc(t(b))}</text><line class="pom" x1="${X}" y1="${n2(y + 1.3)}" x2="${Xr}" y2="${n2(y + 1.3)}"/>`); };
    out.push(`<text class="nadpis l" x="${X}" y="${n2(y)}">${esc(t('Parametry'))}</text>`);
    if (p.dily.krouzek) {
      const ods = K.odsazeni(o.kr.Dv, o.kr.d, p.vypocty.freza);
      radek('Kroužek / průchod / límec', `Ø ${f(o.kr.Dv, 2)} / Ø ${f(o.kr.d, 2)} / ${f(o.kr.L, 1)} mm`);
      radek(`Odsazení šablony pro frézu Ø ${f(p.vypocty.freza, 2)}`, `${f(ods.o, 2)} mm (otvor šablony = tvar + ${f(2 * ods.o, 2)})`);
      radek('Rozhraní', p.rozhrani.typ === 'srouby' ? `příruba Ø ${f(2 * o.Rp, 1)} × ${f(o.tp, 1)}, ${p.rozhrani.pocet}× ${o.sroubK.nazev} na Ø ${f(p.rozhrani.roztec, 1)}` : `příruba Ø ${f(2 * o.Rp, 1)} × ${f(o.tp, 1)}, krk Ø ${f(2 * o.Rk, 1)} × ${f(p.rozhrani.stoupani, 2)}`);
    }
    if (p.dily.podlozka) {
      radek('Podložka', `${K.NAZVY.tvar[p.podlozka.tvar]}, tl. ${f(o.t, 1)} mm`);
      radek('Středový otvor / zahloubení', p.podlozka.otvor === 'krouzky' ? `Ø ${f(2 * o.Rotvor, 1)} / Ø ${f(2 * o.Rc, 2)} × ${f(o.tp, 1)}` : `Ø ${f(2 * o.Rotvor, 1)}`);
      if (p.podlozka.pocet) radek('Šrouby patky (zápustné 90°)', `${p.podlozka.pocet}× ${o.sroubP.nazev} na Ø ${f(p.podlozka.roztec, 1)}, natočení ${f(p.podlozka.natoceni, 0)}°`);
    }
    if (p.dily.trn) radek('Centrovací trn', `stopka Ø ${f(p.trn.stopka, 2)}, kužel Ø ${f(p.trn.dMin, 1)}–${f(p.trn.dMax, 1)}`);
    y += 6;
    out.push(`<text class="nadpis l" x="${X}" y="${n2(y)}">${esc(t('Kusovník'))}</text>`);
    for (const [a, b] of meta.kusovnik.slice(0, 8)) {
      y += 4.2;
      const nz = String(t(a)), max = Math.floor((Xr - X - 14) / 1.25);
      out.push(`<text class="tab" x="${X}" y="${n2(y)}">${esc(nz.length > max ? nz.slice(0, max - 1) + '…' : nz)}</text><text class="tab b" x="${Xr}" y="${n2(y)}" text-anchor="end">${esc(t(b))}</text>`);
    }
    const py = H - M - 16, pw = Math.min(150, W - 2 * M - 4), px = W - M - 2 - pw;
    out.push(`<rect class="ram" x="${px}" y="${py}" width="${pw}" height="16"/><line class="ram" x1="${px}" y1="${py + 8}" x2="${px + pw}" y2="${py + 8}"/><line class="ram" x1="${px + pw - 40}" y1="${py}" x2="${px + pw - 40}" y2="${py + 16}"/>`);
    out.push(`<text class="pole b" x="${px + 2}" y="${py + 5.5}">${esc(p.nazev || 'Kopírovací kroužek')}</text>`);
    out.push(`<text class="pole" x="${px + pw - 38}" y="${py + 5.5}">${esc(meta.datum)}</text>`);
    out.push(`<text class="pole" x="${px + 2}" y="${py + 13.5}">${esc(t('Kopírovací kroužek a podložka – 1 : 1'))}</text>`);
    out.push(`<text class="pole" x="${px + pw - 38}" y="${py + 13.5}">${esc(t('rozměry v mm'))}</text>`);

    const svg = `<svg class="vk-svg" xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">
<defs><pattern id="srafy" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#000" stroke-width="0.18"/></pattern>
<marker id="sipka" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" fill="#000"/></marker>
<style>.vk-svg .rez{fill:url(#srafy);stroke:none}.vk-svg .obrys{fill:none;stroke:#000;stroke-width:0.4;stroke-linejoin:round}.vk-svg .obrys.tenky{stroke-width:0.35;fill:#f4f4f4}
.vk-svg .skryta{fill:none;stroke:#000;stroke-width:0.2;stroke-dasharray:2 1}.vk-svg .osa{fill:none;stroke:#000;stroke-width:0.15;stroke-dasharray:6 1.5 1 1.5}
.vk-svg .kota{stroke:#000;stroke-width:0.18}.vk-svg .pom{stroke:#000;stroke-width:0.13}.vk-svg .kt{font-size:2.6px;text-anchor:middle}
.vk-svg .nadpis{font-size:3.5px;font-weight:bold;text-anchor:middle}.vk-svg .nadpis.l{text-anchor:start}.vk-svg .tab{font-size:2.6px}.vk-svg .b{font-weight:bold}
.vk-svg .ram{fill:none;stroke:#000;stroke-width:0.35}.vk-svg .pole{font-size:3px}</style></defs>
<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/><rect class="ram" x="${M - 4}" y="${M - 4}" width="${W - 2 * M + 8}" height="${H - 2 * M + 8}"/>
${out.join('\n')}
</svg>`;
    return { svg, sirka: W, vyska: H };
  }

  const API = { sestavVykres };
  if (typeof module !== 'undefined') module.exports = API; else window.KROUZKY_VYK = API;
})();
