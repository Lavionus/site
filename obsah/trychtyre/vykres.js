/* Trychtýře – výkres A4 na šířku (SVG v mm, černě na bílém):
   vlevo řez sestavou rovinou osy (řez sítí dílů rovinou y ≈ 0, šrafy, kóty ústí, výšky, výpusti a spoje s hrdlem),
   vpravo tabulka parametrů, stupnice objemu, kusovník a popisové pole.
   sestavVykres(p, model, meta) → text SVG; meta = {datum, hmotnost, material, prutok, kusovnik: [[nazev, ks], …]}. */
/* global TRYCH, I18N */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.TRYCH;
  const MERITKA = [5, 2, 1, 0.5, 0.2, 0.1, 0.05];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (x, d = 1) => K.fmt(x, d);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);
  const nazevMeritka = m => (m >= 1 ? `${m} : 1` : `1 : ${Math.round(1 / m)}`);

  /** Řez sítě rovinou y = y0: uzavřené smyčky [[x, z], …] (průsečíky hran spojené přes sdílené hrany). */
  function rezSite(d, y0 = 0.0123) {
    const P = d.poz, I = d.idx, bod = new Map();
    const klic = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
    const pr = (a, b) => {
      const k = klic(a, b);
      if (!bod.has(k)) { const ya = P[3 * a + 1] - y0, yb = P[3 * b + 1] - y0, u = ya / (ya - yb); bod.set(k, [P[3 * a] + (P[3 * b] - P[3 * a]) * u, P[3 * a + 2] + (P[3 * b + 2] - P[3 * a + 2]) * u]); }
      return k;
    };
    const sous = new Map();
    const pridej = (x, y) => { if (!sous.has(x)) sous.set(x, []); sous.get(x).push(y); };
    for (let i = 0; i < I.length; i += 3) {
      const v = [I[i], I[i + 1], I[i + 2]], s = v.map(q => P[3 * q + 1] > y0);
      const hr = [];
      for (let j = 0; j < 3; j++) if (s[j] !== s[(j + 1) % 3]) hr.push(pr(v[j], v[(j + 1) % 3]));
      if (hr.length === 2) { pridej(hr[0], hr[1]); pridej(hr[1], hr[0]); }
    }
    const navst = new Set(), smycky = [];
    for (const start of sous.keys()) {
      if (navst.has(start)) continue;
      const sm = [];
      let cur = start, pred = null;
      while (cur && !navst.has(cur)) {
        navst.add(cur); sm.push(bod.get(cur));
        const n = (sous.get(cur) || []).find(x => x !== pred && !navst.has(x));
        pred = cur; cur = n;
      }
      if (sm.length > 2) smycky.push(sm);
    }
    return smycky;
  }
  function obal(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  function kota(A, B, v, text, out) {
    const a = [A[0] + v[0], A[1] + v[1]], b = [B[0] + v[0], B[1] + v[1]], l = Math.hypot(v[0], v[1]) || 1, e = [v[0] / l * 1.5, v[1] / l * 1.5];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5) return;
    const L = (p, q) => `x1="${p[0].toFixed(2)}" y1="${p[1].toFixed(2)}" x2="${q[0].toFixed(2)}" y2="${q[1].toFixed(2)}"`;
    if (l > 0.01) {
      out.push(`<line class="pom" ${L([A[0] + v[0] / l, A[1] + v[1] / l], [a[0] + e[0], a[1] + e[1]])}/>`);
      out.push(`<line class="pom" ${L([B[0] + v[0] / l, B[1] + v[1] / l], [b[0] + e[0], b[1] + e[1]])}/>`);
    }
    out.push(`<line class="kota" ${L(a, b)} marker-start="url(#sipka)" marker-end="url(#sipka)"/>`);
    let u = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    if (u > 90.5 || u < -90.5) u += 180;
    const tu = u * Math.PI / 180, mx = (a[0] + b[0]) / 2 + Math.sin(tu) * 1.2, my = (a[1] + b[1]) / 2 - Math.cos(tu) * 1.2;
    out.push(`<text class="kt" x="${mx.toFixed(2)}" y="${my.toFixed(2)}" transform="rotate(${u.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)})">${esc(text)}</text>`);
  }

  function sestavVykres(p, model, meta) {
    const o = model.o, out = [];
    const dily = model.sestava.filter(d => !['stojanek', 'vicko', 'zatka'].includes(d.jmeno));
    const polys = [];
    for (const d of dily) polys.push(...rezSite(d));
    const PR = { x: 12, y: 12, w: 168, h: 168 }, ok = { l: 26, r: 26, t: 18, b: 22 };
    const bR = obal(polys);
    const m = MERITKA.find(k => bR.w * k <= PR.w - ok.l - ok.r && bR.h * k <= PR.h - ok.t - ok.b) || MERITKA[MERITKA.length - 1];
    const cx = PR.x + ok.l + (PR.w - ok.l - ok.r - bR.w * m) / 2 - bR.x0 * m, cy = PR.y + ok.t + (PR.h - ok.t - ok.b - bR.h * m) / 2 + bR.y1 * m;
    const T = (x, z) => [cx + x * m, cy - z * m];
    const cesta = polys.map(q => 'M' + q.map(([x, z]) => T(x, z).map(v => v.toFixed(2)).join(' ')).join('L') + 'Z').join('');
    out.push(`<path class="rez" fill-rule="evenodd" d="${cesta}"/><path class="obrys" d="${cesta}"/>`);
    // osa těla
    out.push(`<line class="osa" x1="${T(0, o.zTop + 4)[0].toFixed(2)}" y1="${T(0, o.zTop + 4)[1].toFixed(2)}" x2="${T(0, bR.y0 - 3)[0].toFixed(2)}" y2="${T(0, bR.y0 - 3)[1].toFixed(2)}"/>`);
    // kóty: ústí, výška těla, celková výška, výpust
    const Rv = o.plochy ? o.a : o.Rout;
    kota(T(-Rv, o.zTop), T(Rv, o.zTop), [0, -8], o.plochy ? `${f(2 * o.a)} × ${f(2 * o.b)}` : `Ø ${f(2 * o.Rout)}`, out);
    kota(T(bR.x1, 0), T(bR.x1, o.zTop), [8, 0], f(o.zTop), out);
    kota(T(bR.x1, bR.y0), T(bR.x1, o.zTop), [16, 0], f(o.zTop - bR.y0, 0), out);
    const kon = K.konecVypusti(o);
    if (o.ohyb === 0) {
      const r0 = o.prof[0][0];
      kota(T(-r0, kon[2]), T(r0, kon[2]), [0, 7], `Ø ${f(2 * r0, 2)}`, out);
      out.push(`<text class="kt l" x="${(T(r0, kon[2])[0] + 3).toFixed(2)}" y="${(T(r0, kon[2])[1] + 2.5).toFixed(2)}">${esc(t('průchod'))} Ø ${f(2 * o.ri, 1)}</text>`);
    } else {
      const q = T(kon[0], kon[2]);
      out.push(`<text class="kt l" x="${(q[0] + 4).toFixed(2)}" y="${(q[1] + 2).toFixed(2)}">${esc(t('ohyb'))} ${f(o.ohyb)}° · R ${f(o.Rb, 0)} · Ø ${f(2 * o.prof[0][0], 2)}</text>`);
    }
    if (o.cap) kota(T(-o.cap.rMaj, -o.cap.Lz), T(o.cap.rMaj, -o.cap.Lz), [0, 5 + (o.cap.Rc - o.cap.rMaj) * m], `${t('závit')} Ø ${f(2 * o.cap.rMaj, 2)} × ${f(o.cap.p, 2)}`, out);
    if (o.lim) kota(T(-o.lim.rsi, -o.lim.tl - o.lim.hs), T(o.lim.rsi, -o.lim.tl - o.lim.hs), [0, 6], `Ø ${f(2 * o.lim.rsi, 2)}`, out);
    out.push(`<text class="nadpis" x="${PR.x + PR.w / 2}" y="${PR.y + 5}">${esc(t('Řez rovinou osy'))} · ${nazevMeritka(m)}</text>`);

    /* ---- tabulka ---- */
    const N = K.NAZVY, H = p.hrdlo, x = K.zdrojHrdla(p), radky = [];
    radky.push(['Tělo', p.telo.tvar === 'plochy' ? `${t(N.tvar.plochy)} ${f(p.telo.sirka)} × ${f(p.telo.hloubkaO)}` : `${t(N.tvar[p.telo.tvar])} Ø ${f(p.telo.prumer)} · ${f(o.uhelMax)}°`]);
    radky.push(['Stěna těla / výpusti', `${f(p.telo.stena, 2)} / ${f(p.vypust.stena, 2)} mm`]);
    radky.push(['Hrdlo', x ? x.nazev : t('vlastní rozměr')]);
    radky.push(['Spoj', t(N.rezim[H.rezim])]);
    if (H.rezim === 'zasun') radky.push(['Kónus', `Ø ${f(2 * o.rw, 2)} ${t('v hloubce')} ${f(H.hloubka)} · ${f(H.kuzel, 1)}°`]);
    if (H.rezim === 'stupne') radky.push(['Stupně', o.stupne.map(d => f(d, 1)).join(' / ') + ' mm']);
    if (H.rezim === 'zavit') radky.push(['Závit čepičky', `Ø ${f(2 * o.cap.rMaj, 2)} × P ${f(o.cap.p, 2)} × ${f(o.cap.h, 2)} · ${f(o.cap.Lz)} mm`]);
    if (H.rezim === 'limec') radky.push(['Límec / sukně', `Ø ${f(2 * o.lim.Rl, 1)} / Ø ${f(2 * o.lim.rsi, 2)} × ${f(o.lim.hs)}`]);
    radky.push(['Výpust', `${t(N.vypust[p.vypust.tvar])} · ${f(o.delkaVypusti, 0)} mm · ${t('průchod')} Ø ${f(2 * o.ri, 1)}`]);
    radky.push(['Odvzdušnění', p.odvz.typ === 'trubicka' ? `${t(N.odvz.trubicka)} Ø ${f(p.odvz.trubicka, 1)}` : p.odvz.typ === 'zadne' ? t(N.odvz.zadne) : `${p.odvz.pocet} × ${t(N.odvz[p.odvz.typ])} ${f(p.odvz.sirka, 1)} × ${f(p.odvz.hloubka, 1)}`]);
    radky.push(['Objem', `${f(o.objemCelkem, 0)} ml`]);
    if (meta.prutok) radky.push(['Průtok', meta.prutok]);
    radky.push(['Hmotnost (plné díly)', `${f(meta.hmotnost, 0)} g ${meta.material}`]);
    let y = 14;
    out.push(`<text class="nadpis l" x="188" y="${y}">${esc(t('Parametry'))}</text>`);
    for (const [a, b] of radky) {
      y += 4.4;
      out.push(`<text class="tab" x="190" y="${y}">${esc(t(a))}</text><text class="tab b" x="285" y="${y}" text-anchor="end">${esc(b.length > 50 ? b.slice(0, 49) + '…' : b)}</text><line class="pom" x1="188" y1="${y + 1.3}" x2="285" y2="${y + 1.3}"/>`);
    }
    y += 5;
    out.push(`<text class="pozn" x="188" y="${y}">${esc(t('Rozměry hrdel z databáze jsou typické – ověřit měřením.'))} (${esc(K.DATUM)})</text>`);
    if (o.rysky.length) {
      y += 7;
      out.push(`<text class="nadpis l" x="188" y="${y}">${esc(t('Stupnice'))}</text>`);
      const r = o.rysky.filter(q => q.dlouha).slice(0, 8);
      y += 4.4;
      out.push(`<text class="tab" x="190" y="${y}">${esc(r.map(q => `${f(q.V, 0)} ml @ ${f(q.z, 1)}`).join(' · ').slice(0, 95))}</text>`);
    }
    y += 8;
    out.push(`<text class="nadpis l" x="188" y="${y}">${esc(t('Kusovník'))}</text>`);
    for (const [a, b] of meta.kusovnik.slice(0, 10)) {
      y += 4.4;
      out.push(`<text class="tab" x="190" y="${y}">${esc(a.length > 48 ? a.slice(0, 47) + '…' : a)}</text><text class="tab b" x="285" y="${y}" text-anchor="end">${esc(String(b))}</text>`);
    }
    const py = 184;
    out.push(`<rect class="ram" x="170" y="${py}" width="115" height="16"/><line class="ram" x1="170" y1="${py + 8}" x2="285" y2="${py + 8}"/><line class="ram" x1="240" y1="${py}" x2="240" y2="${py + 16}"/>`);
    out.push(`<text class="pole b" x="172" y="${py + 5.5}">${esc((p.nazev || 'Trychtýř').slice(0, 40))}</text>`);
    out.push(`<text class="pole" x="242" y="${py + 5.5}">${esc(meta.datum)}</text>`);
    out.push(`<text class="pole" x="172" y="${py + 13.5}">${esc(t('Trychtýř na míru'))}</text>`);
    out.push(`<text class="pole" x="242" y="${py + 13.5}">${esc(t('rozměry v mm · list 1/1'))}</text>`);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210" font-family="Arial, Helvetica, sans-serif">
<defs><pattern id="srafy" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#000" stroke-width="0.18"/></pattern>
<marker id="sipka" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" fill="#000"/></marker>
<style>.rez{fill:url(#srafy);stroke:none}.obrys{fill:none;stroke:#000;stroke-width:0.4;stroke-linejoin:round}
.osa{fill:none;stroke:#000;stroke-width:0.18;stroke-dasharray:6 1.5 1 1.5}.kota{stroke:#000;stroke-width:0.18}.pom{stroke:#000;stroke-width:0.13}
.kt{font-size:2.5px;text-anchor:middle}.kt.l{text-anchor:start}.nadpis{font-size:3.5px;font-weight:bold;text-anchor:middle}.nadpis.l{text-anchor:start}
.tab{font-size:2.5px}.pozn{font-size:2.3px;font-style:italic}.b{font-weight:bold}.ram{fill:none;stroke:#000;stroke-width:0.35}.pole{font-size:3px}</style></defs>
<rect x="0" y="0" width="297" height="210" fill="#fff"/><rect class="ram" x="8" y="8" width="281" height="194"/>
${out.join('\n')}
</svg>`;
  }

  const API = { sestavVykres, rezSite };
  if (typeof module !== 'undefined') module.exports = API; else window.TRYCH_VYK = API;
})();
