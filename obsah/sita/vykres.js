/* Síta a mřížky – výkres A4 na šířku (SVG v mm, černě na bílém):
   vlevo půdorys prvního dílu (obrys, vnitřní stěna, hranice oka, otvory), vpravo nahoře řez rovinou y = 0 (průsečíky sítě),
   uprostřed vpravo detail oka se zvětšením, dole parametry, výpočty, kusovník a popisové pole.
   sestavVykres(p, model, meta) → text SVG; meta = {datum, hmotnost, material, kusovnik, vypocty}. */
/* global SITA */
(function () {
  'use strict';
  const S = typeof module !== 'undefined' ? require('./jadro.js') : window.SITA;
  const MERITKA = [20, 10, 5, 2, 1, 0.5, 0.25, 0.2, 0.1, 0.05];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (x, d = 1) => S.fmt(x, d);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);
  const nazevMeritka = m => (m >= 1 ? `${m} : 1` : `1 : ${Math.round(1 / m)}`);
  const cesta = (polys, T, zavrit = true) => polys.map(p => 'M' + p.map(([x, y]) => { const [a, b] = T(x, y); return `${a.toFixed(2)} ${b.toFixed(2)}`; }).join('L') + (zavrit ? 'Z' : '')).join('');

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
  /** Konvexní obálka 2D bodů. */
  function obalka(b) {
    const p = b.slice().sort((a, c) => a[0] - c[0] || a[1] - c[1]), x = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
    const d = [], h = [];
    for (const q of p) { while (d.length >= 2 && x(d[d.length - 2], d[d.length - 1], q) <= 0) d.pop(); d.push(q); }
    for (const q of p.reverse()) { while (h.length >= 2 && x(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); }
    return d.slice(0, -1).concat(h.slice(0, -1));
  }
  /** Úsečky řezu sítě rovinou y = 0 v souřadnicích (x, z). */
  function rezSite(d) {
    const P = d.poz, I = d.idx, out = [];
    for (let t3 = 0; t3 < I.length; t3 += 3) {
      const v = [3 * I[t3], 3 * I[t3 + 1], 3 * I[t3 + 2]], body = [];
      for (let k = 0; k < 3; k++) {
        const a = v[k], b = v[(k + 1) % 3], ya = P[a + 1], yb = P[b + 1];
        if ((ya < 0) !== (yb < 0)) { const s = ya / (ya - yb); body.push([P[a] + s * (P[b] - P[a]), P[a + 2] + s * (P[b + 2] - P[a + 2])]); }
      }
      if (body.length === 2) out.push(body);
    }
    return out;
  }
  const obalBodu = polys => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  };

  function sestavVykres(p, model, meta) {
    const out = [], vk = model.vykres, d0 = model.dily.find(d => /^sit|^mriz/.test(d.jmeno)) || model.dily[0];
    let zmin = Infinity; for (let i = 2; i < d0.poz.length; i += 3) zmin = Math.min(zmin, d0.poz[i]);

    /* ---- půdorys ---- */
    const PP = { x: 12, y: 14, w: 150, h: 128 }, ok = 14;
    const body = []; for (let i = 0; i < d0.poz.length; i += 9) body.push([d0.poz[i], d0.poz[i + 1]]);
    const obrysDilu = obalka(body);
    const bP = obalBodu([obrysDilu]);
    const mP = MERITKA.find(k => bP.w * k <= PP.w - 2 * ok && bP.h * k <= PP.h - 2 * ok) || MERITKA[MERITKA.length - 1];
    const cx = PP.x + PP.w / 2 - (bP.x0 + bP.x1) / 2 * mP, cy = PP.y + PP.h / 2 + (bP.y0 + bP.y1) / 2 * mP;
    const T = (x, y) => [cx + x * mP, cy - y * mP];
    out.push(`<path class="obrys tenky" d="${cesta([obrysDilu], T)}"/>`);
    if (vk) {
      out.push(`<path class="obrys" d="${cesta(vk.obrys, T)}"/>`);
      out.push(`<path class="obrys tenky bez" d="${cesta(vk.vnitrni, T)}"/>`);
      out.push(`<path class="skryta" d="${cesta(vk.pole, T)}"/>`);
      if (vk.otvory) out.push(`<path class="otvor" d="${cesta(vk.otvory, T)}"/>`);
      else out.push(`<text class="tab" x="${PP.x + 2}" y="${PP.y + PP.h - 2}">${esc(t(`otvorů ${vk.pocet} – na výkrese jen detail oka`))}</text>`);
    }
    const osa = (a, b) => out.push(`<line class="osa" x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}"/>`);
    osa(T(bP.x0 - 4 / mP, 0), T(bP.x1 + 4 / mP, 0)); osa(T(0, bP.y0 - 4 / mP), T(0, bP.y1 + 4 / mP));
    kota(T(bP.x0, bP.y0), T(bP.x1, bP.y0), -6, f(bP.w, 1), out);
    kota(T(bP.x0, bP.y0), T(bP.x0, bP.y1), 6, f(bP.h, 1), out);
    out.push(`<text class="nadpis l" x="${PP.x}" y="${PP.y - 2}">${esc(t('Půdorys'))} · ${nazevMeritka(mP)}</text>`);

    /* ---- řez A–A ---- */
    const PR = { x: 172, y: 14, w: 113, h: 62 }, okR = 12;
    const rez = rezSite(d0).map(s => s.map(([x, z]) => [x, z - zmin]));
    if (rez.length) {
      const bR = obalBodu(rez);
      const mR = MERITKA.find(k => bR.w * k <= PR.w - 2 * okR && bR.h * k <= PR.h - 2 * okR) || MERITKA[MERITKA.length - 1];
      const rx = PR.x + PR.w / 2 - (bR.x0 + bR.x1) / 2 * mR, ry = PR.y + PR.h / 2 + (bR.y0 + bR.y1) / 2 * mR;
      const TR = (x, z) => [rx + x * mR, ry - z * mR];
      out.push(`<path class="obrys" d="${cesta(rez, TR, false)}"/>`);
      osa(TR(0, bR.y0 - 3 / mR), TR(0, bR.y1 + 3 / mR));
      kota(TR(bR.x0, bR.y0), TR(bR.x1, bR.y0), -6, f(bR.w, 1), out);
      kota(TR(bR.x1, bR.y0), TR(bR.x1, bR.y1), -6, f(bR.h, 1), out);
      out.push(`<text class="nadpis l" x="${PR.x}" y="${PR.y - 2}">${esc(t('Řez A–A (osou)'))} · ${nazevMeritka(mR)}</text>`);
    }

    /* ---- detail oka ---- */
    const s0 = model.sita[0], a = s0.a, bz = p.oko.zebro, PD = { x: 172, y: 86, w: 52, h: 52 };
    const okno = Math.max(3 * (a + bz), p.oko.typ === 'sterbiny' || p.oko.typ === 'radialni' ? 1.5 * p.oko.delka : 0);
    const mD = PD.w / okno, vz = S.vzor(p.oko.typ === 'radialni' ? Object.assign({}, p.oko, { typ: 'sterbiny' }) : p.oko, a, bz, okno);
    const TD = (x, y) => [PD.x + PD.w / 2 + x * mD, PD.y + PD.h / 2 - y * mD];
    const vOkne = pl => pl.some(([x, y]) => Math.abs(x) < okno / 2 && Math.abs(y) < okno / 2);
    out.push(`<defs><clipPath id="oknoDet"><rect x="${PD.x}" y="${PD.y}" width="${PD.w}" height="${PD.h}"/></clipPath></defs>`);
    out.push(`<rect class="ram tenky" x="${PD.x}" y="${PD.y}" width="${PD.w}" height="${PD.h}"/>`);
    if (vz.vrstvy) {
      out.push(`<g clip-path="url(#oknoDet)"><path class="pas" d="${cesta(vz.vrstvy[0].filter(vOkne), TD)}"/><path class="pas h" d="${cesta(vz.vrstvy[1].filter(vOkne), TD)}"/></g>`);
    } else {
      out.push(`<g clip-path="url(#oknoDet)"><rect class="hmota" x="${PD.x}" y="${PD.y}" width="${PD.w}" height="${PD.h}"/><path class="otvor velky" d="${cesta(vz.polys.filter(vOkne), TD)}"/></g>`);
    }
    if (p.oko.typ === 'ctverec' || p.oko.typ === 'tkana') {
      kota(TD(-a / 2, -a / 2), TD(a / 2, -a / 2), 0, f(a, 2), out);
      kota(TD(a / 2, a / 2 + 0.3 * a), TD(a / 2 + bz, a / 2 + 0.3 * a), 0, f(bz, 2), out);
    }
    out.push(`<text class="nadpis l" x="${PD.x}" y="${PD.y - 2}">${esc(t('Detail oka'))} · ${nazevMeritka(Math.round(mD * 10) / 10)}</text>`);
    const radkyOka = [
      ['Druh oka', S.NAZVY.oko[p.oko.typ]], ['Oko / žebro', `${model.sita.map(s => f(s.a, 1)).join(' / ')} / ${f(bz, 2)} mm`],
      ['Tloušťka síta', `${f(p.oko.tl, 2)} mm`], ['Volná plocha', model.sita.map(s => `${f(100 * s.otvory / s.vnitrni, 0)} %`).join(' / ')],
    ];
    if (p.oko.typ === 'sterbiny' || p.oko.typ === 'radialni') radkyOka.push(['Délka štěrbiny', `${f(p.oko.delka, 1)} mm`]);
    if (p.oko.uhel) radkyOka.push(['Natočení vzoru', `${f(p.oko.uhel, 0)}°`]);
    let y = PD.y + 3;
    for (const [k, v] of radkyOka) { y += 5; out.push(`<text class="tab" x="228" y="${y}">${esc(t(k))}</text><text class="tab b" x="285" y="${y}" text-anchor="end">${esc(t(v))}</text>`); }

    /* ---- parametry, výpočty, kusovník, popisové pole ---- */
    const o = model.o, rad = [
      ['Druh', S.NAZVY.druh[p.druh]], ['Stěna / okraj', `${f(p.lem.tl, 2)} / ${f(p.lem.okraj, 1)} mm`],
    ];
    if (p.druh === 'vlozka') rad.push(['Otvor / vůle', `${p.tvar.typ === 'kruh' ? 'Ø ' + f(p.tvar.prumer) : f(p.tvar.sirka) + ' × ' + f(p.tvar.delka)} / ${f(p.vlozka.vule, 2)} mm`], ['Límec / nákružek', `${f(p.vlozka.presah)} / ${f(p.vlozka.hloubka)} mm`]);
    else if (p.druh === 'kuzel') rad.push(['Kužel', p.kuzel.typ === 'miska' ? `Ø ${f(p.kuzel.prumer)} / dno Ø ${f(p.kuzel.dno)}, stěna ${f(o.k.alfa, 1)}°` : `sedlo Ø ${f(p.kuzel.prumer)}, ${f(2 * p.kuzel.uhel)}°`]);
    else rad.push(['Výška obruby', `${f(p.lem.vyska)} mm`]);
    if (p.druh === 'vez') rad.push(['Nákružek / vůle', `${f(p.vez.nakruzek)} / ${f(p.vez.vule, 2)} mm`]);
    if (meta.vypocty && meta.vypocty[0]) {
      const v = meta.vypocty[0];
      rad.push(['Průtok vody', v.prutok.drzi ? `drží do ${f(v.prutok.hMin, 0)} mm` : `≈ ${f(v.prutok.lmin, 1)} l/min při ${f(p.vypocet.hladina)} mm`]);
      rad.push(['Průhyb pod nákladem', `${f(v.pevnost.pruhyb, 2)} mm / ${f(v.pevnost.zatizeni, 1)} kg`]);
    }
    rad.push(['Hmotnost', `${f(meta.hmotnost, 0)} g ${meta.material}`]);
    y = 150;
    out.push(`<text class="nadpis l" x="14" y="${y}">${esc(t('Parametry'))}</text>`);
    rad.forEach(([k, v], i) => {
      const x = 14 + (i % 2) * 76, yy = y + 5 * (Math.floor(i / 2) + 1);
      out.push(`<text class="tab" x="${x}" y="${yy}">${esc(t(k))}</text><text class="tab b" x="${x + 72}" y="${yy}" text-anchor="end">${esc(t(v))}</text>`);
    });
    y = 146;
    out.push(`<text class="nadpis l" x="172" y="${y}">${esc(t('Kusovník'))}</text>`);
    meta.kusovnik.slice(0, 6).forEach(([nazev, ks, pozn], i) => {
      const yy = y + 4.5 * (i + 1);
      out.push(`<text class="tab" x="172" y="${yy}">${esc(t(nazev))}${pozn ? ' · ' + esc(t(pozn)) : ''}</text><text class="tab b" x="285" y="${yy}" text-anchor="end">${esc(t(`${ks} ks`))}</text>`);
    });
    const py = 184;
    out.push(`<rect class="ram" x="170" y="${py}" width="115" height="16"/><line class="ram" x1="170" y1="${py + 8}" x2="285" y2="${py + 8}"/><line class="ram" x1="240" y1="${py}" x2="240" y2="${py + 16}"/>`);
    out.push(`<text class="pole b" x="172" y="${py + 5.5}">${esc(p.nazev || 'Síto')}</text>`);
    out.push(`<text class="pole" x="242" y="${py + 5.5}">${esc(meta.datum)}</text>`);
    out.push(`<text class="pole" x="172" y="${py + 13.5}">${esc(t('Síta a mřížky – 3D tisk'))}</text>`);
    out.push(`<text class="pole" x="242" y="${py + 13.5}">${esc(t('rozměry v mm · list 1/1'))}</text>`);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210" font-family="Arial, Helvetica, sans-serif">
<defs><marker id="sipka" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" fill="#000"/></marker>
<style>.obrys{fill:none;stroke:#000;stroke-width:0.45;stroke-linejoin:round}.obrys.tenky{stroke-width:0.25;fill:#f4f4f4}.obrys.tenky.bez{fill:none}
.skryta{fill:none;stroke:#000;stroke-width:0.18;stroke-dasharray:2 1}.otvor{fill:#fff;stroke:#000;stroke-width:0.08}.otvor.velky{stroke-width:0.25}
.hmota{fill:#d8d8d8}.pas{fill:#c4c4c4;stroke:#000;stroke-width:0.2}.pas.h{fill:#9a9a9a;fill-opacity:0.85}
.osa{stroke:#000;stroke-width:0.18;stroke-dasharray:6 1.5 1 1.5}.kota{stroke:#000;stroke-width:0.18}.pom{stroke:#000;stroke-width:0.13}
.kt{font-size:2.5px;text-anchor:middle}.nadpis{font-size:3.5px;font-weight:bold;text-anchor:middle}.nadpis.l{text-anchor:start}
.tab{font-size:2.6px}.b{font-weight:bold}.ram{fill:none;stroke:#000;stroke-width:0.35}.ram.tenky{stroke-width:0.2}.pole{font-size:3px}</style></defs>
<rect x="0" y="0" width="297" height="210" fill="#fff"/><rect class="ram" x="8" y="8" width="281" height="194"/>
${out.join('\n')}
</svg>`;
  }

  const API = { sestavVykres, rezSite, obalka };
  if (typeof module !== 'undefined') module.exports = API; else window.SITA_VYK = API;
})();
