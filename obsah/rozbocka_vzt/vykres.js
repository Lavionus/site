/* Rozbočka VZT – výkres A4 na šířku (SVG v mm): řez osou a prvním vývodem se šrafami a kótami, půdorys s roztečí
   a úchyty, tabulka parametrů a popisové pole. Měřítko z normalizované řady tak, aby se pohledy vešly.
   Podklady (řez, bokorys, půdorys) dává jádro při stavbě sítě (sit.vykres). Výkres je vždy černě na bílém (papír). */
/* global ROZB_VZT */
(function () {
  'use strict';
  const MERITKA = [10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f1 = x => (Math.round(x * 10) / 10).toLocaleString('cs-CZ', { maximumFractionDigits: 1 });
  const nazevMeritka = m => (m >= 1 ? `${m} : 1` : `1 : ${Math.round(1 / m)}`);

  function obal(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  const cesta = (polys, T) => polys.map(p => 'M' + p.map(([x, y]) => { const [a, b] = T(x, y); return `${a.toFixed(2)} ${b.toFixed(2)}`; }).join('L') + 'Z').join('');

  /** Ořízne kroužky mnohoúhelníků polorovinou x·smer ≥ 0 (Sutherland–Hodgman; pro polorovinu stačí po kroužcích). */
  function orizni(polys, smer) {
    const out = [];
    for (const p of polys) {
      const q = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length], da = a[0] * smer, db = b[0] * smer;
        if (da >= 0) q.push(a);
        if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); q.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      if (q.length >= 3) out.push(q);
    }
    return out;
  }

  /** Kóta mezi body P1 a P2 (papír, mm) odsazená o `off` kolmo (kladně vlevo od směru P1→P2), text uprostřed nad čarou. */
  function kota(P1, P2, off, text, out) {
    const dx = P2[0] - P1[0], dy = P2[1] - P1[1], l = Math.hypot(dx, dy);
    if (l < 0.5) return;
    const ux = dx / l, uy = dy / l, nx = uy, ny = -ux;
    const A = [P1[0] + nx * off, P1[1] + ny * off], B = [P2[0] + nx * off, P2[1] + ny * off], pres = Math.sign(off) * 1.5;
    out.push(`<line class="pom" x1="${P1[0] + nx * Math.sign(off) * 1}" y1="${P1[1] + ny * Math.sign(off) * 1}" x2="${A[0] + nx * pres}" y2="${A[1] + ny * pres}"/>`);
    out.push(`<line class="pom" x1="${P2[0] + nx * Math.sign(off) * 1}" y1="${P2[1] + ny * Math.sign(off) * 1}" x2="${B[0] + nx * pres}" y2="${B[1] + ny * pres}"/>`);
    out.push(`<line class="kota" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" marker-start="url(#sipka)" marker-end="url(#sipka)"/>`);
    let uhel = Math.atan2(uy, ux) * 180 / Math.PI;
    if (uhel > 90.5 || uhel < -90.5) uhel += 180;
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, t = uhel * Math.PI / 180;
    // text nad čarou (ve směru „nahoru“ čitelného textu)
    const tx = mx + Math.sin(t) * 1.2, ty = my - Math.cos(t) * 1.2;
    out.push(`<text class="kt" x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" transform="rotate(${uhel.toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)})">${esc(text)}</text>`);
  }
  const osa = (x1, y1, x2, y2, out) => out.push(`<line class="osa" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);

  /** p = projekt, o = odvozené, sit = model se sit.vykres, meta = {objem, hmotnost, ztrata, datum} → SVG text */
  function sestavVykres(p, o, sit, meta) {
    const R = ROZB_VZT, V = sit.vykres, out = [];
    const spojka = !!o.spojka;
    const bR = obal(V.rez.length ? V.rez : V.bok), bB = obal(V.bok), bS = obal(V.shora);
    const xR0 = Math.min(bR.x0, bB.x0), xR1 = Math.max(bR.x1, bB.x1), zR0 = Math.min(bR.y0, bB.y0), zR1 = Math.max(bR.y1, bB.y1);
    // plochy listu (mm): řez vlevo, půdorys vpravo nahoře, tabulka a popisové pole vpravo dole
    const PR = { x: 12, y: 14, w: 168, h: 182 }, PS = { x: 186, y: 14, w: 99, h: 92 };
    const okrajR = { l: 30, r: 14, t: 22, b: 22 }, okrajS = { l: 8, r: 8, t: 8, b: 16 };
    const m = MERITKA.find(k => (xR1 - xR0) * k <= PR.w - okrajR.l - okrajR.r && (zR1 - zR0) * k <= PR.h - okrajR.t - okrajR.b
      && bS.w * k <= PS.w - okrajS.l - okrajS.r && bS.h * k <= PS.h - okrajS.t - okrajS.b) || MERITKA[MERITKA.length - 1];
    // transformace řezu: s → x, z → nahoru
    const cxR = PR.x + okrajR.l + (PR.w - okrajR.l - okrajR.r - (xR1 - xR0) * m) / 2 - xR0 * m;
    const cyR = PR.y + okrajR.t + (PR.h - okrajR.t - okrajR.b - (zR1 - zR0) * m) / 2 + zR1 * m;
    const TR = (s, z) => [cxR + s * m, cyR - z * m];
    const cxS = PS.x + okrajS.l + (PS.w - okrajS.l - okrajS.r - bS.w * m) / 2 - bS.x0 * m;
    const cyS = PS.y + okrajS.t + (PS.h - okrajS.t - okrajS.b - bS.h * m) / 2 + bS.y1 * m;
    const TS = (x, y) => [cxS + x * m, cyS - y * m];

    // --- řez A–A: celý, když proti vývodu leží další vývod (sudý počet), jinak polořez (vpravo řez, vlevo pohled) ---
    const celyRez = spojka || o.kanaly.some(k => Math.abs(Math.cos(k.fi - V.fi) + 1) < 1e-3);
    if (celyRez) {
      out.push(`<path class="obrys tenky" d="${cesta(V.bok, TR)}"/>`);
      out.push(`<path class="rez" d="${cesta(V.rez, TR)}"/>`);
    } else {
      out.push(`<path class="obrys" d="${cesta(orizni(V.bok, -1), TR)}"/>`);
      out.push(`<path class="obrys tenky" d="${cesta(orizni(V.bok, 1), TR)}"/>`);
      out.push(`<path class="rez" d="${cesta(orizni(V.rez, 1), TR)}"/>`);
    }
    const [ax] = TR(0, 0);
    osa(ax, TR(0, zR1)[1] - 6, ax, TR(0, zR0)[1] + 6, out);
    out.push(`<text class="popis" x="${PR.x + PR.w / 2}" y="${PR.y + 4}">${celyRez ? 'ŘEZ A–A' : 'POLOŘEZ A–A'}</text>`);
    const levo = TR(xR0, 0)[0], vpravo = TR(xR1, 0)[0], hore = TR(0, zR1)[1], dole = TR(0, zR0)[1];
    if (spojka) {
      const sp = o.spojka, h = sp.h;
      kota(TR(xR0, 0), TR(xR0, sp.delka), 22, `${f1(sp.delka)}`, out);
      kota(TR(xR0, 0), TR(xR0, sp.Lh), 12, `${f1(sp.Lh)}`, out);
      kota(TR(xR0, sp.Lh + sp.m), TR(xR0, sp.delka), 12, `${f1(sp.Lh)}`, out);
      kota(TR(-h.ri, 0), TR(h.ri, 0), -8 - (dole - TR(0, 0)[1]), `Ø ${f1(2 * h.ri)}`, out);
      kota(TR(-h.ro, 0), TR(h.ro, 0), -16 - (dole - TR(0, 0)[1]), `Ø ${f1(2 * h.ro)}`, out);
      if (h.rp < h.ri - 0.05) kota(TR(-h.rp, sp.delka), TR(h.rp, sp.delka), 8 + (TR(0, sp.delka)[1] - hore), `Ø ${f1(2 * h.rp)}`, out);
    } else {
      const Lv = p.vstup.delka, L = o.L, Lo = p.vyvody.delka, h0 = o.h0, h1 = o.h1;
      kota(TR(xR0, zR0), TR(xR0, zR1), 24 + (TR(xR0, 0)[0] - levo), `${f1(zR1 - zR0)}`, out);
      kota(TR(xR0, -Lv), TR(xR0, 0), 13, `${f1(Lv)}`, out);
      kota(TR(xR0, 0), TR(xR0, L), 13, `${f1(L)}`, out);
      kota(TR(xR0, L), TR(xR0, L + Lo), 13, `${f1(Lo)}`, out);
      // vstup dole: vnitřek a vnějšek hrdla
      const pod = dole - TR(0, -Lv)[1];
      kota(TR(-h0.ri, -Lv), TR(h0.ri, -Lv), -(7 + pod), `Ø ${f1(2 * h0.ri)}`, out);
      kota(TR(-h0.ro, -Lv), TR(h0.ro, -Lv), -(15 + pod), `Ø ${f1(2 * h0.ro)}`, out);
      // vývody v rovině řezu nahoře
      const vRovine = o.kanaly.map(k => Math.cos(k.fi - V.fi) * o.Rr).filter((sv, i) => Math.abs(Math.sin(o.kanaly[i].fi - V.fi)) < 0.02);
      for (const sv of vRovine) osa(TR(sv, L - 4)[0], TR(sv, L - 4)[1], TR(sv, L + Lo)[0], TR(sv, L + Lo)[1] - 6, out);
      const nad = TR(0, L + Lo)[1] - hore;
      const s1 = vRovine[0];
      kota(TR(s1 - h1.ri, L + Lo), TR(s1 + h1.ri, L + Lo), 7 + nad, `Ø ${f1(2 * h1.ri)}`, out);
      if (vRovine.length > 1) kota(TR(vRovine[1], L + Lo), TR(s1, L + Lo), 15 + nad, `${f1(Math.abs(s1 - vRovine[1]))}`, out);
      else kota(TR(0, L + Lo), TR(s1, L + Lo), 15 + nad, `R ${f1(o.Rr)}`, out);
      // úchyty – poloha dosedací plochy
      if (p.uchyty.typ === 'ouska' || p.uchyty.typ === 'priruba') {
        const zu = p.uchyty.poloha;
        out.push(`<text class="pozn" x="${(vpravo + 3).toFixed(2)}" y="${TR(0, zu)[1].toFixed(2)}">◄ dosedací plocha úchytů</text>`);
      }
    }
    // --- půdorys ---
    out.push(`<path class="obrys" d="${cesta(V.shora, TS)}"/>`);
    out.push(`<text class="popis" x="${PS.x + PS.w / 2}" y="${PS.y + 4}">POHLED SHORA (do vývodů)</text>`);
    const [ox, oy] = TS(0, 0), dl = Math.max(bS.w, bS.h) * m / 2 + 4;
    if (!spojka) {
      for (const k of o.kanaly) {
        const [x, y] = TS(k.c1[0], k.c1[1]);
        out.push(`<circle class="tenky" cx="${x}" cy="${y}" r="${(o.h1.ri * m).toFixed(2)}"/>`);
        osa(x - o.h1.ro * m - 2, y, x + o.h1.ro * m + 2, y, out); osa(x, y - o.h1.ro * m - 2, x, y + o.h1.ro * m + 2, out);
      }
      if (o.n >= 2) {
        const a = o.kanaly[0].c1, b = o.kanaly[1].c1;
        const A = TS(a[0], a[1]), B = TS(b[0], b[1]);
        out.push(`<line class="kota" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" marker-start="url(#sipka)" marker-end="url(#sipka)"/>`);
        const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
        out.push(`<text class="kt" x="${mx}" y="${my - 1.2}">rozteč ${f1(o.roztec)}</text>`);
      }
      // stopa řezu A–A
      const ux = Math.cos(V.fi), uy = Math.sin(V.fi);
      const P1 = TS(-ux * (dl / m), -uy * (dl / m)), P2 = TS(ux * (dl / m), uy * (dl / m));
      out.push(`<line class="stopa" x1="${P1[0]}" y1="${P1[1]}" x2="${P2[0]}" y2="${P2[1]}"/>`);
      out.push(`<text class="kt tucne" x="${P1[0]}" y="${P1[1] - 1.5}">A</text><text class="kt tucne" x="${P2[0]}" y="${P2[1] - 1.5}">A</text>`);
    }
    osa(ox - dl, oy, ox + dl, oy, out); osa(ox, oy - dl, ox, oy + dl, out);
    // úchyty: roztečná kružnice otvorů (ouška, příruba), u patek vzdálenost zadní desky od osy
    const U = V.uchyty;
    if (U && U.uhly) {
      out.push(`<circle class="osa" cx="${ox}" cy="${oy}" r="${(U.Rh * m).toFixed(2)}" fill="none"/>`);
      if (U.drazka) out.push(`<circle class="osa" cx="${ox}" cy="${oy}" r="${(U.drazka.rs * m).toFixed(2)}" fill="none"/>`);
    } else if (U && U.X) {
      const ux = Math.cos(U.fi), uy = Math.sin(U.fi);
      kota(TS(0, 0), TS(-U.X * ux, -U.X * uy), 0.01, `${f1(U.X)}`, out);
    }
    const sirS = bS.w, spodS = TS(0, bS.y0)[1];
    kota(TS(bS.x0, bS.y0), TS(bS.x1, bS.y0), -(7), `${f1(sirS)}`, out);
    out.push(`<text class="pozn" x="${PS.x + 2}" y="${spodS + 13}">${esc(popisUchytu(p, o, U))}</text>`);
    if (U && U.uhly) out.push(`<text class="pozn" x="${PS.x + 2}" y="${spodS + 17}">Roztečná kružnice otvorů Ø ${f1(2 * U.Rh)} (čerchovaně)${U.drazka ? `, drážka těsnění na Ø ${f1(2 * U.drazka.rs)} šířky ${f1(U.drazka.sir)}` : ''}</text>`);

    // --- tabulka ---
    const tab = radkyTabulky(p, o, meta);
    const TX = 186, TY = 112;
    out.push(`<rect class="ramec" x="${TX}" y="${TY}" width="99" height="${tab.length * 5 + 2}"/>`);
    tab.forEach(([a, b], i) => {
      const y = TY + 4.6 + i * 5;
      out.push(`<text class="tab" x="${TX + 1.5}" y="${y}">${esc(a)}</text><text class="tab tucne" x="${TX + 40}" y="${y}">${esc(b)}</text>`);
      if (i) out.push(`<line class="tenky" x1="${TX}" y1="${y - 3.7}" x2="${TX + 99}" y2="${y - 3.7}"/>`);
    });
    // --- popisové pole ---
    const PX = 186, PY = 170, pw = 99, ph = 30;
    out.push(`<rect class="ramec" x="${PX}" y="${PY}" width="${pw}" height="${ph}"/>`);
    out.push(`<line class="tenky" x1="${PX}" y1="${PY + 12}" x2="${PX + pw}" y2="${PY + 12}"/><line class="tenky" x1="${PX}" y1="${PY + 21}" x2="${PX + pw}" y2="${PY + 21}"/>`);
    out.push(`<line class="tenky" x1="${PX + 50}" y1="${PY + 12}" x2="${PX + 50}" y2="${PY + ph}"/>`);
    out.push(`<text class="nazev" x="${PX + 2}" y="${PY + 5.5}">${esc(p.nazev || R.popis(p))}</text>`);
    out.push(`<text class="tab" x="${PX + 2}" y="${PY + 10}">${esc(spojka ? 'Spojka hadic pro vzduchotechniku' : 'Rozbočka pro vzduchotechniku')} · ${esc(R.popis(p))}</text>`);
    out.push(`<text class="tab" x="${PX + 2}" y="${PY + 15.5}">Měřítko</text><text class="tab tucne" x="${PX + 2}" y="${PY + 19.5}">${nazevMeritka(m)}</text>`);
    out.push(`<text class="tab" x="${PX + 52}" y="${PY + 15.5}">Datum</text><text class="tab tucne" x="${PX + 52}" y="${PY + 19.5}">${esc(meta.datum)}</text>`);
    out.push(`<text class="tab" x="${PX + 2}" y="${PY + 24.5}">Rozměry v mm · 3D tisk FDM</text><text class="tab" x="${PX + 2}" y="${PY + 28.5}">Promítání ISO E (evropské)</text>`);
    out.push(`<text class="tab" x="${PX + 52}" y="${PY + 24.5}">List 1 / 1 · A4</text><text class="tab" x="${PX + 52}" y="${PY + 28.5}">lavionus.github.io/site</text>`);

    // pravidla jen uvnitř výkresu – vložené SVG ve stránce by jinak přestylovalo celou stránku
    const styl = `
      .vk-svg .ramec,.vk-svg .obrys,.vk-svg .rez{fill:none;stroke:#000;stroke-width:.5}
      .vk-svg .rez{fill:url(#srafy);fill-rule:evenodd}
      .vk-svg .obrys{fill:none;fill-rule:evenodd}
      .vk-svg .tenky{fill:none;stroke:#000;stroke-width:.18}
      .vk-svg .pom{stroke:#000;stroke-width:.13}
      .vk-svg .kota{stroke:#000;stroke-width:.18}
      .vk-svg .osa{stroke:#000;stroke-width:.13;stroke-dasharray:6 1.2 1 1.2}
      .vk-svg .stopa{stroke:#000;stroke-width:.35;stroke-dasharray:6 1.2 1 1.2}
      .vk-svg text{font-family:'Liberation Sans','DejaVu Sans',Arial,sans-serif;fill:#000}
      .vk-svg .kt{font-size:3px;text-anchor:middle}
      .vk-svg .popis{font-size:3.6px;font-weight:700;text-anchor:middle;letter-spacing:.3px}
      .vk-svg .pozn{font-size:2.6px}
      .vk-svg .tab{font-size:2.8px}
      .vk-svg .nazev{font-size:4.2px;font-weight:700}
      .vk-svg .tucne{font-weight:700}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="vk-svg" width="297mm" height="210mm" viewBox="0 0 297 210" data-i18n="ne">
<defs><style>${styl}</style>
<pattern id="srafy" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#000" stroke-width=".13"/></pattern>
<marker id="sipka" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="2.6" markerHeight="2.6" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 1.5L10 5L0 8.5z" fill="#000"/></marker></defs>
<rect x="0" y="0" width="297" height="210" fill="#fff"/>
<rect class="ramec" x="7" y="7" width="283" height="196"/>
${out.join('\n')}
</svg>`;
  }

  function popisUchytu(p, o, U) {
    const u = p.uchyty;
    if (o.spojka || u.typ === 'zadne') return '';
    const hl = { zadna: 'bez zahloubení', kuzel: 'zahloubení 90°', valec: 'pro válcovou hlavu', matice: 'pro šestihrannou matici' }[u.hlava];
    // jádro u lišty delší než 250 mm přidá řadu otvorů i uprostřed (v obou křídlech)
    if (u.typ === 'lista') return `Lišta po délce: ${4 * u.otvoru + (U && U.lista && U.zE - U.zA > 250 ? 2 : 0)} × Ø ${f1(u.otvor)} (${hl}), deska ${f1(u.tl)} mm, zeď ${f1(u.odsazeni)} mm od těla`;
    if (u.typ === 'zavesy') return `Závěsná oka: ${u.zavesu} × Ø ${f1(u.otvor)} napříč, ploutev ${f1(u.tl)} mm`;
        if (u.typ === 'patky') return `Patky: ${2 * u.otvoru} × Ø ${f1(u.otvor)} (${hl}), deska ${f1(u.tl)} mm, zeď ${f1(u.odsazeni)} mm od těla`;
    const n = u.typ === 'priruba' && u.tvar === 'ctverec' ? 4 : u.pocet;
    return `${u.typ === 'priruba' ? 'Příruba' : 'Ouška'}: ${n} × Ø ${f1(u.otvor)}${u.drazka > 0 ? ` ovál ${f1(u.drazka)}` : ''} (${hl}), tl. ${f1(u.tl)} mm`
      + `${u.poloha ? `, ${f1(u.poloha)} mm od vstupu` : ''}${u.typ === 'priruba' && u.tesneni > 0 ? `, drážka těsnění ${f1(u.tesneni)} mm` : ''}`;
  }

  function radkyTabulky(p, o, meta) {
    const konec = q => [q.od > 0 ? `OD ${f1(q.od)}` : '', q.id > 0 ? `ID ${f1(q.id)}` : ''].filter(Boolean).join(' / ');
    const spoj = s => (s === 'na' ? 'trubka do hrdla' : 'hrdlo do trubky');
    const r = [];
    if (o.spojka) {
      const q = o.spojka.q;
      r.push(['Trubky', `${konec(q)} mm`], ['Spoj', spoj(q.spoj)]);
    } else {
      r.push(['Vstup', `${konec(p.vstup)} mm, ${spoj(p.vstup.spoj)}`]);
      r.push(['Vývody', `${o.n} × ${konec(p.vyvody)} mm, ${spoj(p.vyvody.spoj)}`]);
      r.push(['Rozteč vývodů', `${f1(o.roztec)} mm`]);
      r.push(['Přechod', `${f1(o.L)} mm, odklon ${f1(o.odklon)}°, rozšíření ${f1(o.rozsireni)}°`]);
      if (p.zpevneni.zebra) r.push(['Zpevnění', `${{ sousede: 'žebra mezi vývody', stred: 'paprsky k ose', oboje: 'žebra + paprsky', deska: 'deska kolem hrdel' }[p.zpevneni.typ]}, ${f1(p.zpevneni.tl)} mm`]);
    }
    r.push(['Stěna / vůle', `${f1(p.tvar.stena)} / ${f1(p.tvar.vule)} mm`]);
    r.push(['Objem / hmotnost', `${f1(meta.objem / 1000)} cm³ · ${Math.round(meta.hmotnost)} g`]);
    if (meta.ztrata) r.push(['Tlaková ztráta', `${f1(meta.ztrata.celkem)} Pa při ${Math.round(meta.ztrata.Q)} m³/h (odhad)`]);
    return r;
  }

  window.ROZB_VZT_VYKRES = { sestavVykres };
})();
