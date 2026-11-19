/* Adaptér nářadí → vysavač – výkres A4 na šířku (SVG v mm, černě na bílém):
   vlevo řez sestavou v rovině ohybu (všechny díly i nástrčky spojky na svém místě, šrafy, kóty lícovaných průměrů
   a délek zasunutí, celkové rozměry), vpravo tabulka parametrů, kusovník a popisové pole.
   sestavVykres(p, nv, meta) → text SVG; meta = {datum, hmotnost, material, dp, kusovnik: [[nazev, ks], …]}. */
/* global ADVYS */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.ADVYS;
  const MERITKA = [5, 2, 1, 0.5, 0.2, 0.1, 0.05];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (x, d = 1) => K.fmt(x, d);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);
  const nazevMeritka = m => (m >= 1 ? `${m} : 1` : `1 : ${Math.round(1 / m)}`);
  const cesta = (polys, T) => polys.map(p => 'M' + p.map(([x, y]) => { const [a, b] = T(x, y); return `${a.toFixed(2)} ${b.toFixed(2)}`; }).join('L') + 'Z').join('');

  /** Řez dílem v rovině XZ jeho souřadnic: dvě stěny (vlevo, vpravo) jako mnohoúhelníky [x, z]. */
  function rezDilu(n) {
    const S = new Set();
    for (const q of n.rIn.concat(n.rOut)) if (q[0] >= 0 && q[0] <= n.S) S.add(+q[0].toFixed(4));
    for (const c of n.cesta) {
      S.add(+c.s0.toFixed(4)); S.add(+c.s1.toFixed(4));
      if (c.typ === 'oblouk') { const m = Math.ceil(c.uhel / 2); for (let i = 1; i < m; i++) S.add(c.s0 + (c.s1 - c.s0) * i / m); }
    }
    const ss = [...S].sort((a, b) => a - b);
    const steny = [];
    for (const sg of [1, -1]) {
      const ven = [], vni = [];
      for (const s of ss) {
        const F = K.ramec(n.cesta, s), ro = K.rV(n.rOut, s), ri = K.rV(n.rIn, s);
        ven.push([F.P[0] + sg * ro * F.X[0], F.P[2] + sg * ro * F.X[2]]);
        vni.push([F.P[0] + sg * ri * F.X[0], F.P[2] + sg * ri * F.X[2]]);
      }
      steny.push(ven.concat(vni.reverse()));
    }
    return steny;
  }
  /** Bod v rovině XZ po umístění M. */
  const vXZ = (M, x, z) => { const q = K.doSveta(M, x, 0, z); return [q[0], q[2]]; };
  function obal(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  /** Kóta mezi body A a B (papír) posunutá o vektor v (papír), text uprostřed podél čáry. */
  function kota(A, B, v, text, out) {
    const a = [A[0] + v[0], A[1] + v[1]], b = [B[0] + v[0], B[1] + v[1]], l = Math.hypot(v[0], v[1]) || 1, e = [v[0] / l * 1.5, v[1] / l * 1.5];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5) return;
    const L = (p, q) => `x1="${p[0].toFixed(2)}" y1="${p[1].toFixed(2)}" x2="${q[0].toFixed(2)}" y2="${q[1].toFixed(2)}"`;
    out.push(`<line class="pom" ${L([A[0] + v[0] / l, A[1] + v[1] / l], [a[0] + e[0], a[1] + e[1]])}/>`);
    out.push(`<line class="pom" ${L([B[0] + v[0] / l, B[1] + v[1] / l], [b[0] + e[0], b[1] + e[1]])}/>`);
    out.push(`<line class="kota" ${L(a, b)} marker-start="url(#sipka)" marker-end="url(#sipka)"/>`);
    let u = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    if (u > 90.5 || u < -90.5) u += 180;
    const tu = u * Math.PI / 180, mx = (a[0] + b[0]) / 2 + Math.sin(tu) * 1.2, my = (a[1] + b[1]) / 2 - Math.cos(tu) * 1.2;
    out.push(`<text class="kt" x="${mx.toFixed(2)}" y="${my.toFixed(2)}" transform="rotate(${u.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)})">${esc(text)}</text>`);
  }

  function sestavVykres(p, nv, meta) {
    const out = [], polys = [], tenke = [];
    nv.dily.forEach((n, i) => polys.push(...rezDilu(n).map(st => st.map(([x, z]) => vXZ(nv.ramy[i], x, z)))));
    for (const X of Object.keys(nv.umisteniVykres)) {
      const n = nv.konce[X].protikus, U = nv.umisteniVykres[X];
      tenke.push(...rezDilu(n).map(st => st.map(([x, z]) => vXZ(U, x, z))));
    }
    const vse = polys.concat(tenke);
    const PR = { x: 12, y: 12, w: 168, h: 168 }, ok = { l: 30, r: 30, t: 22, b: 24 };
    const bR = obal(vse);
    const m = MERITKA.find(k => bR.w * k <= PR.w - ok.l - ok.r && bR.h * k <= PR.h - ok.t - ok.b) || MERITKA[MERITKA.length - 1];
    const cx = PR.x + ok.l + (PR.w - ok.l - ok.r - bR.w * m) / 2 - bR.x0 * m, cy = PR.y + ok.t + (PR.h - ok.t - ok.b - bR.h * m) / 2 + bR.y1 * m;
    const T = (x, z) => [cx + x * m, cy - z * m];
    out.push(`<path class="rez" d="${cesta(polys, T)}"/><path class="obrys" d="${cesta(polys, T)}"/>`);
    if (tenke.length) out.push(`<path class="rez2" d="${cesta(tenke, T)}"/><path class="obrys" d="${cesta(tenke, T)}"/>`);
    // osa
    nv.dily.forEach((n, i) => {
      const b = [];
      for (let s = -4; s <= n.S + 4; s += Math.max(1, n.S / 60)) { const F = K.ramec(n.cesta, s); b.push(vXZ(nv.ramy[i], F.P[0], F.P[2])); }
      out.push(`<polyline class="osa" points="${b.map(q => T(q[0], q[1]).map(x => x.toFixed(2)).join(',')).join(' ')}"/>`);
    });
    // kóty konců: lícovaný průměr u ústí a v hloubce, délka zasunutí
    const pap = (M, x, z) => { const q = vXZ(M, x, z); return T(q[0], q[1]); };
    const smer = (M, dx, dz) => { const a = pap(M, 0, 0), b = pap(M, dx, dz), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    for (const X of ['A', 'B']) {
      const Kc = nv.konce[X], fit = Kc.fit;
      let M;
      if (Kc.protikus) M = K.sloz(nv.umisteniVykres[X], K.ramecKonce(Kc.protikus, 'spodek'));
      else if (X === 'A') M = K.sloz(nv.ramy[0], K.ramecKonce(nv.dily[0], nv.dily[0].kdeA));
      else M = K.sloz(nv.ramy[nv.dilu - 1], K.ramecKonce(nv.dily[nv.dilu - 1], nv.dily[nv.dilu - 1].kdeB));
      const r0 = fit.lic[0] / 2, r1 = fit.lic[1] / 2, ro = Math.max(...fit.rOut.map(q => q[1]));
      const ven = smer(M, 0, -1), bok = smer(M, -1, 0);
      const u0 = Math.min(1, fit.L / 4);
      kota(pap(M, -r0, u0), pap(M, r0, u0), [ven[0] * (6 + (ro - r0) * m), ven[1] * (6 + (ro - r0) * m)], `Ø ${f(2 * r0, 2)}`, out);
      if (Math.abs(r1 - r0) > 0.02) kota(pap(M, -r1, fit.L), pap(M, r1, fit.L), [0, 0], `Ø ${f(2 * r1, 2)}`, out);
      kota(pap(M, -ro, 0), pap(M, -ro, fit.L), [bok[0] * 6, bok[1] * 6], `${f(fit.L, 1)}`, out);
      const st = pap(M, 0, 0);
      out.push(`<text class="znak" x="${(st[0] + ven[0] * (14 + (ro - r0) * m)).toFixed(2)}" y="${(st[1] + ven[1] * (14 + (ro - r0) * m) + 1).toFixed(2)}">${X}</text>`);
    }
    // celkové rozměry
    kota(T(bR.x0, bR.y0), T(bR.x1, bR.y0), [0, 12], f(bR.w, 0), out);
    kota(T(bR.x1, bR.y0), T(bR.x1, bR.y1), [12, 0], f(bR.h, 0), out);
    const osa = p.osa.typ === 'ohyb' && p.osa.uhel > 0.01 ? `${t('ohyb')} ${f(p.osa.uhel)}° · R ${f(nv.Rb, 0)}${nv.dilu > 1 ? ` · ${nv.dilu} ${t('díly')}` : ''}`
      : p.osa.typ === 'posun' && p.osa.posun > 0.01 ? `${t('posun os')} ${f(p.osa.posun)} mm · R ${f(nv.Rb, 0)}` : '';
    out.push(`<text class="nadpis" x="${PR.x + PR.w / 2}" y="${PR.y + 6}">${esc(t('Řez sestavou v rovině osy'))} · ${nazevMeritka(m)}${osa ? ' · ' + esc(osa) : ''}</text>`);

    /* ---- tabulka parametrů ---- */
    const N = K.NAZVY, radky = [];
    for (const X of ['A', 'B']) {
      const e = p[X];
      radky.push([X === 'A' ? 'Konec A – nářadí' : 'Konec B – vysavač', '', true]);
      radky.push(['Protikus', K.nazevKonce(e)]);
      radky.push([e.typ === 'vnejsi' ? 'Čep protikusu (vnější Ø)' : 'Hrdlo protikusu (vnitřní Ø)', `Ø ${f(e.d0, 2)} → Ø ${f(e.d1, 2)} · ${f(e.L)} mm`]);
      const spoj = e.spoj === 'zavit' ? `${t(N.spoj.zavit)} P ${f(e.stoupani, 1)} × ${f(e.hloubka, 1)}` : e.spoj === 'kuzel' ? `${t(N.spoj.kuzel)} ${f(e.kuzel, 2)}°` : t(N.spoj.rovne);
      radky.push(['Spoj', `${spoj} · ${t('vůle')} ${f(e.vule, 2)}${e.oring && nv.konce[X].fit.oring ? ' · O-kroužek' : ''}`]);
      if (e.spojka !== 'zadna') radky.push(['Rychlospojka', `${t(N.spojka[e.spojka])} Ø ${f(2 * nv.konce[X].Rc, 2)}`]);
    }
    radky.push(['Stěna / přechod', `${f(p.stena, 1)} / ${f(nv.dily[0].Lp, 1)} mm`]);
    if (meta.prumer) radky.push(['Nejužší průchod', `Ø ${f(meta.prumer, 1)} mm`]);
    if (meta.dp) radky.push(['Tlaková ztráta', meta.dp]);
    radky.push(['Hmotnost (plné díly)', `${f(meta.hmotnost, 0)} g ${meta.material}`]);
    let y = 14;
    out.push(`<text class="nadpis l" x="188" y="${y}">${esc(t('Parametry'))}</text>`);
    for (const [a, b, nad] of radky) {
      y += nad ? 5.6 : 4.4;
      if (nad) { out.push(`<text class="tab b" x="188" y="${y}">${esc(t(a))}</text>`); continue; }
      out.push(`<text class="tab" x="190" y="${y}">${esc(t(a))}</text><text class="tab b" x="285" y="${y}" text-anchor="end">${esc(b.length > 52 ? b.slice(0, 51) + '…' : b)}</text><line class="pom" x1="188" y1="${y + 1.3}" x2="285" y2="${y + 1.3}"/>`);
    }
    y += 6;
    out.push(`<text class="pozn" x="188" y="${y}">${esc(t('Rozměry vývodů a koncovek z databáze jsou typické – ověřit měřením.'))}</text>`);
    y += 3.5;
    out.push(`<text class="pozn" x="188" y="${y}">${esc(t('Databáze rozměrů:'))} ${esc(K.DB.DATUM)}</text>`);
    // kusovník
    y += 8;
    out.push(`<text class="nadpis l" x="188" y="${y}">${esc(t('Kusovník'))}</text>`);
    for (const [a, b] of meta.kusovnik.slice(0, 9)) {
      y += 4.4;
      out.push(`<text class="tab" x="190" y="${y}">${esc(a.length > 48 ? a.slice(0, 47) + '…' : a)}</text><text class="tab b" x="285" y="${y}" text-anchor="end">${esc(String(b))}</text>`);
    }
    // popisové pole
    const py = 184;
    out.push(`<rect class="ram" x="170" y="${py}" width="115" height="16"/><line class="ram" x1="170" y1="${py + 8}" x2="285" y2="${py + 8}"/><line class="ram" x1="240" y1="${py}" x2="240" y2="${py + 16}"/>`);
    out.push(`<text class="pole b" x="172" y="${py + 5.5}">${esc((p.nazev || 'Adaptér na vysavač').slice(0, 40))}</text>`);
    out.push(`<text class="pole" x="242" y="${py + 5.5}">${esc(meta.datum)}</text>`);
    out.push(`<text class="pole" x="172" y="${py + 13.5}">${esc(t('Adaptér nářadí → vysavač'))}</text>`);
    out.push(`<text class="pole" x="242" y="${py + 13.5}">${esc(t('rozměry v mm · list 1/1'))}</text>`);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210" font-family="Arial, Helvetica, sans-serif">
<defs><pattern id="srafy" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#000" stroke-width="0.18"/></pattern>
<pattern id="srafy2" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="2.4" stroke="#000" stroke-width="0.18"/></pattern>
<marker id="sipka" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" fill="#000"/></marker>
<style>.rez{fill:url(#srafy);stroke:none}.rez2{fill:url(#srafy2);stroke:none}.obrys{fill:none;stroke:#000;stroke-width:0.45;stroke-linejoin:round}
.osa{fill:none;stroke:#000;stroke-width:0.18;stroke-dasharray:6 1.5 1 1.5}.kota{stroke:#000;stroke-width:0.18}.pom{stroke:#000;stroke-width:0.13}
.kt{font-size:2.5px;text-anchor:middle}.znak{font-size:5px;font-weight:bold;text-anchor:middle}.nadpis{font-size:3.5px;font-weight:bold;text-anchor:middle}.nadpis.l{text-anchor:start}
.tab{font-size:2.5px}.pozn{font-size:2.3px;font-style:italic}.b{font-weight:bold}.ram{fill:none;stroke:#000;stroke-width:0.35}.pole{font-size:3px}</style></defs>
<rect x="0" y="0" width="297" height="210" fill="#fff"/><rect class="ram" x="8" y="8" width="281" height="194"/>
${out.join('\n')}
</svg>`;
  }

  const API = { sestavVykres, rezDilu };
  if (typeof module !== 'undefined') module.exports = API; else window.ADVYS_VYK = API;
})();
