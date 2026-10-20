/* ============================================================
   Intarzie a parketáž – výstupy bez DOM: scény (sestava 1:1, listy řezného plánu, laser),
   SVG, DXF (R12), PDF 1:1 s dělením na listy a kontrolními úsečkami 50/100 mm v X i Y.
   Scéna = {x0, y0, w, h, prvky}; prvky:
     {t:'l', b:[[x,y]…], z:uzavřená, v:vrstva, s:tloušťka, d:čárkovaně, c:barva}
     {t:'p', b:[kruhy], v, f:barva výplně}
     {t:'txt', x, y, h (výška písma mm), txt, a:'l'|'c'|'r', u:otočení °, v, c}
   jsPDF se předává parametrem.
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.INTJ || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const fmt = J.fmt;
  const BARVY_VRSTEV = { vypln: '#ffffff', obrys: '#000000', rez: '#d0021b', list: '#1f5fa8', sipka: '#1f5fa8', cislo: '#000000', pismeno: '#b3261e', text: '#000000', nadpis: '#000000', pomoc: '#8a8a8a', deska: '#000000', gravir: '#1f5fa8' };
  const PORADI = ['vypln', 'list', 'pomoc', 'deska', 'obrys', 'rez', 'sipka', 'gravir', 'pismeno', 'cislo', 'text', 'nadpis'];
  const DXF_BARVA = { obrys: 7, rez: 1, list: 5, sipka: 5, cislo: 7, pismeno: 1, text: 7, nadpis: 7, pomoc: 8, deska: 7, gravir: 5 };
  // barvy řezů po dřevinách (laserové programy berou barvy jako vrstvy)
  const LASER_BARVY = ['#ff0000', '#0000ff', '#00a000', '#ff00ff', '#00a0a0', '#a0a000', '#ff8000', '#8000ff', '#808080', '#000000'];
  const n = (x) => { const v = Math.round(x * 1000) / 1000; return Number.isFinite(v) ? String(v) : '0'; };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const svetle = (hex, k) => { const c = J.hexRgb(hex) || [220, 200, 160]; return J.rgbHex(c.map((x) => x + (255 - x) * k)); };

  /* ---------------- stavební prvky ---------------- */
  const vyskaCisla = (d) => Math.max(1.2, Math.min(6, Math.sqrt(Math.max(1, d.plocha || J.plochaDilku(d))) * 0.2));
  /** oboustranná šipka vláken v bodě p podél úhlu u, délka L */
  function sipka(p, u, L, v, s) {
    const [sx, sy] = J.smer(u), a = [p[0] - sx * L / 2, p[1] - sy * L / 2], b = [p[0] + sx * L / 2, p[1] + sy * L / 2];
    const hl = Math.min(L * 0.25, Math.max(0.8, L * 0.16)), q = [-sy, sx];
    const hrot = (k, sm) => [[k[0] + sm * sx * hl + q[0] * hl * 0.45, k[1] + sm * sy * hl + q[1] * hl * 0.45], k, [k[0] + sm * sx * hl - q[0] * hl * 0.45, k[1] + sm * sy * hl - q[1] * hl * 0.45]];
    return [{ t: 'l', b: [a, b], v: v || 'sipka', s: s || 0.2 }, { t: 'l', b: hrot(a, 1), v: v || 'sipka', s: s || 0.2 }, { t: 'l', b: hrot(b, -1), v: v || 'sipka', s: s || 0.2 }];
  }
  /** popisek dílku: číslo + písmeno dřeviny a šipka vláken (posunuté kolmo, aby se nepřekrývaly) */
  function popisDilku(d, o, cil) {
    const p = J.bodPopisku(d), h = vyskaCisla(d) * (o.velPisma || 1);
    const ch = J.tetiva(d, p, d.vlakno), L = Math.max(0, Math.min((ch[1] - ch[0]) * 0.6, 40));
    const [sx, sy] = J.smer(d.vlakno), kol = [-sy, sx];
    const jeSipka = o.sipky !== false && L > 2.4;
    const posun = jeSipka ? h * 0.7 : 0;
    if (o.cisla !== false) {
      const t = String(d.id) + (o.pismeno ? o.pismeno : '') + (d.zrcadlo && o.zrcadla ? ' Z' : '');
      cil.push({ t: 'txt', x: p[0] + kol[0] * posun, y: p[1] + kol[1] * posun, h, txt: t, a: 'c', u: o.otacetText ? textUhel(d.vlakno) : 0, v: 'cislo' });
    }
    if (jeSipka) {
      const c = [p[0] - kol[0] * h * 0.55, p[1] - kol[1] * h * 0.55];
      if (J.bodVDilku(c, d)) for (const e of sipka(c, d.vlakno, L, 'sipka', Math.max(0.12, Math.min(0.3, h * 0.08)))) cil.push(e);
    }
  }
  const textUhel = (u) => { const v = J.normUhel(u); return v > 90 ? v - 180 : v; };
  const kruhyDilku = (d) => [d.obrys].concat(d.diry || []);

  /** sestava (montážní výkres) 1:1 */
  function scenaSestavy(S, sloty, o) {
    o = Object.assign({ barvy: true, cisla: true, sipky: true }, o || {});
    const prvky = [], [x0, y0, x1, y1] = S.deska;
    for (const d of S.dilky) {
      const dr = J.DREVINY[(sloty[d.slot] || {}).drevina] || J.DREVINY.javor;
      if (o.barvy) prvky.push({ t: 'p', b: kruhyDilku(d), v: 'vypln', f: svetle((sloty[d.slot] || {}).barva || dr.sv, 0.55) });
      for (const r of kruhyDilku(d)) prvky.push({ t: 'l', b: r, z: true, v: 'obrys', s: 0.18 });
      popisDilku(d, Object.assign({}, o, { pismeno: J.PISMENA[d.slot] || '', zrcadla: true }), prvky);
    }
    prvky.push({ t: 'l', b: J.obdelnik(x0, y0, x1, y1), z: true, v: 'deska', s: 0.35 });
    return { x0, y0, w: x1 - x0, h: y1 - y0, prvky };
  }
  /** jeden list dýhy z řezného plánu 1:1; o.kerf > 0 přidá kompenzovaný obrys řezu */
  function scenaListu(list, S, sloty, o) {
    o = Object.assign({ cisla: true, sipky: true, kerf: 0, nadpis: true }, o || {});
    const prvky = [], sl = sloty[list.slot] || {}, dr = J.DREVINY[sl.drevina] || J.DREVINY.javor;
    prvky.push({ t: 'l', b: J.obdelnik(0, 0, list.delka, list.sirka), z: true, v: 'list', s: 0.25, d: true });
    const ps = { id: 0 };
    for (const k of list.kusy) {
      const d = Object.assign({}, S.dilky.find((q) => q.id === k.id) || ps, { obrys: k.obrys, diry: k.diry, vlakno: 0 });
      for (const r of kruhyDilku(d)) prvky.push({ t: 'l', b: r, z: true, v: 'obrys', s: 0.18 });
      if (o.kerf > 0) for (const e of J.kerf(d, o.kerf, 'dilek')) for (const r of kruhyDilku(e)) prvky.push({ t: 'l', b: r, z: true, v: 'rez', s: 0.1 });
      popisDilku(d, Object.assign({}, o, { pismeno: '', zrcadla: true }), prvky);
    }
    // směr vláken listu
    const ax = 8, ay = list.sirka + 6;
    for (const e of sipka([ax + 12, ay], 0, 24, 'list', 0.25)) prvky.push(e);
    const txt = `vlákna listu · ${J.PISMENA[list.slot] || ''} ${dr.nazev} · list ${list.cislo} · ${fmt(list.delka, 0)} × ${fmt(list.sirka, 0)} mm`;
    prvky.push({ t: 'txt', x: ax + 28, y: ay, h: 3, txt, a: 'l', v: 'text' });
    return { x0: 0, y0: 0, w: list.delka, h: list.sirka + 10, prvky };
  }
  /** laserové řezy: všechny listy pod sebou, obrysy s kompenzací kerf, vrstva podle dřeviny */
  function scenaLaser(plan, S, sloty, o) {
    o = Object.assign({ kerf: 0.2, gravir: false, listy: true, mezera: 15 }, o || {});
    const prvky = []; let y = 0, w = 0;
    for (const l of plan.listy) {
      const vr = 'rez_' + (J.PISMENA[l.slot] || 'X');
      if (o.listy) prvky.push({ t: 'l', b: J.obdelnik(0, y, l.delka, y + l.sirka), z: true, v: 'list', s: 0.1 });
      for (const k of l.kusy) {
        const d = { obrys: k.obrys.map((p) => [p[0], p[1] + y]), diry: k.diry.map((r) => r.map((p) => [p[0], p[1] + y])) };
        for (const e of J.kerf(d, o.kerf, 'dilek')) for (const r of kruhyDilku(e)) prvky.push({ t: 'l', b: r, z: true, v: vr, s: 0.05, c: LASER_BARVY[l.slot % LASER_BARVY.length] });
        if (o.gravir) { const p = J.bodPopisku(d); prvky.push({ t: 'txt', x: p[0], y: p[1], h: Math.max(1.2, Math.min(4, Math.sqrt(J.plochaDilku(d)) * 0.18)), txt: String(k.id), a: 'c', v: 'gravir' }); }
      }
      prvky.push({ t: 'txt', x: 0, y: y + l.sirka + 4, h: 3, txt: `${J.PISMENA[l.slot] || ''} ${(J.DREVINY[(sloty[l.slot] || {}).drevina] || {}).nazev || ''} – list ${l.cislo} (${fmt(l.delka, 0)} × ${fmt(l.sirka, 0)} mm, vlákna vodorovně), kerf ${fmt(o.kerf, 2)} mm`, a: 'l', v: 'list' });
      y += l.sirka + o.mezera; w = Math.max(w, l.delka);
    }
    return { x0: 0, y0: 0, w, h: Math.max(10, y - o.mezera + 8), prvky };
  }

  /** jedinečné tvary 1:1 v mřížce (šablony / přípravky), jen tvary s počtem ≥ min */
  function scenaTvaru(tvary, sloty, o) {
    o = Object.assign({ min: 2, sirka: 190, max: 60 }, o || {});
    const prvky = [], vyber = tvary.filter((q) => q.pocet >= o.min).slice(0, o.max);
    let x = 0, y = 0, radek = 0, w = 0;
    vyber.forEach((q, i) => {
      if (x > 0 && x + q.w > o.sirka) { x = 0; y += radek + 14; radek = 0; }
      const t = q.obrys.map((p) => [p[0] + x, p[1] + y + 6]);
      prvky.push({ t: 'l', b: t, z: true, v: 'obrys', s: 0.25 });
      const c = J.teziste(t);
      for (const e of sipka(c, 0, Math.min(q.w * 0.6, 40), 'sipka', 0.2)) prvky.push(e);
      const sl = Object.entries(q.poSlotech).map(([s, n]) => `${J.PISMENA[s] || '?'} ${n}`).join(', ');
      prvky.push({ t: 'txt', x, y: y + 2, h: 2.6, txt: `T${i + 1}: ${q.pocet} ks (${sl}) · ${fmt(q.w, 1)} × ${fmt(q.h, 1)} mm`, a: 'l', v: 'text' });
      x += Math.max(q.w, 62) + 8; radek = Math.max(radek, q.h); w = Math.max(w, x);
    });
    return { x0: 0, y0: 0, w: Math.max(10, w - 8), h: y + radek + 8, prvky, pocet: vyber.length };
  }

  /* ---------------- SVG ---------------- */
  const barvaPrvku = (e, typ) => (typ === 'f' ? (e.f || '#dddddd') : (e.c || BARVY_VRSTEV[e.v] || '#000000'));
  function svgPrvek(e) {
    if (e.t === 'l') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + n(q[0]) + ' ' + n(q[1])).join('') + (e.z ? 'Z' : '');
      const s = e.s || 0.2;
      return `<path d="${d}" fill="none" stroke="${barvaPrvku(e, 'c')}" stroke-width="${n(s)}" stroke-linecap="round" stroke-linejoin="round"${e.d ? ` stroke-dasharray="${n(Math.max(1.2, s * 8))} ${n(Math.max(0.8, s * 5))}"` : ''}/>`;
    }
    if (e.t === 'p') {
      const d = e.b.map((R) => R.map((q, i) => (i ? 'L' : 'M') + n(q[0]) + ' ' + n(q[1])).join('') + 'Z').join('');
      return `<path d="${d}" fill="${barvaPrvku(e, 'f')}" fill-rule="evenodd"/>`;
    }
    if (e.t === 'txt') {
      const an = e.a === 'l' ? 'start' : e.a === 'r' ? 'end' : 'middle', by = e.y + 0.35 * e.h;
      const rot = e.u ? ` transform="rotate(${n(-e.u)} ${n(e.x)} ${n(e.y)})"` : '';
      return `<text x="${n(e.x)}" y="${n(by)}" font-size="${n(e.h)}" text-anchor="${an}" fill="${barvaPrvku(e, 'c')}"${e.v === 'nadpis' || e.v === 'cislo' ? ' font-weight="bold"' : ''}${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  function vrstvySceny(sc) {
    const v = [...new Set(sc.prvky.map((e) => e.v))];
    return v.sort((a, b) => ((PORADI.indexOf(a.split('_')[0]) + 1 || 99) - (PORADI.indexOf(b.split('_')[0]) + 1 || 99)));
  }
  /** o: {okraj, sirkaPx (true = width 100 %), meritko (kontrolní úsečky)} */
  function svg(sc, o) {
    o = Object.assign({ okraj: 4 }, o || {});
    const m = o.okraj, x = sc.x0 - m, y = sc.y0 - m, w = sc.w + 2 * m, h = sc.h + 2 * m + (o.meritko ? 14 : 0);
    const rozm = o.sirkaPx ? 'width="100%"' : `width="${n(w)}mm" height="${n(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n(x)} ${n(y)} ${n(w)} ${n(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`;
    if (!o.bezPozadi) s += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#ffffff"/>`;
    for (const v of vrstvySceny(sc)) s += `<g id="vrstva-${esc(v)}">` + sc.prvky.filter((e) => e.v === v).map(svgPrvek).join('') + '</g>';
    if (o.meritko) {
      const yy = sc.y0 + sc.h + m + 8, xx = sc.x0;
      s += `<g id="meritko"><path d="M${n(xx)} ${n(yy)}h100" stroke="#000" stroke-width="0.3" fill="none"/>`;
      for (let i = 0; i <= 10; i++) s += `<path d="M${n(xx + i * 10)} ${n(yy)}v${i % 5 ? -1.2 : -2.6}" stroke="#000" stroke-width="0.25"/>`;
      s += `<text x="${n(xx + 103)}" y="${n(yy)}" font-size="2.6" fill="#000">0 – 50 – 100 mm: kontrola měřítka 1:1</text></g>`;
    }
    return s + '</svg>';
  }
  /** víc scén pod sebe do jedné */
  function poskladej(sceny, mezera) {
    mezera = mezera == null ? 12 : mezera;
    const prvky = []; let y = 0, w = 0;
    for (const sc of sceny) {
      const dx = -sc.x0, dy = y - sc.y0, t = (q) => [q[0] + dx, q[1] + dy];
      for (const e of sc.prvky) {
        if (e.t === 'txt') prvky.push(Object.assign({}, e, { x: e.x + dx, y: e.y + dy }));
        else if (e.t === 'p') prvky.push(Object.assign({}, e, { b: e.b.map((R) => R.map(t)) }));
        else prvky.push(Object.assign({}, e, { b: e.b.map(t) }));
      }
      y += sc.h + mezera; w = Math.max(w, sc.w);
    }
    return { x0: 0, y0: 0, w, h: Math.max(0, y - mezera), prvky };
  }

  /* ---------------- DXF (R12, mm, osa y nahoru) ---------------- */
  function dxf(sc, o) {
    o = Object.assign({ texty: true }, o || {});
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    const vrstvy = vrstvySceny(sc).filter((v) => v !== 'vypln');
    const barvaDxf = (v) => { if (v.startsWith('rez_')) return 1 + (J.PISMENA.indexOf(v.slice(4)) % 6); return DXF_BARVA[v] || 7; };
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrstvy.length);
    for (const v of vrstvy) { g(0, 'LAYER'); g(2, v.toUpperCase()); g(70, 0); g(62, barvaDxf(v)); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const Y = (y) => -y;
    const poly = (b, z, ly) => {
      g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, z ? 1 : 0);
      for (const q of b) { g(0, 'VERTEX'); g(8, ly); g(10, n(q[0])); g(20, n(Y(q[1]))); g(30, 0); }
      g(0, 'SEQEND'); g(8, ly);
    };
    for (const e of sc.prvky) {
      if (e.v === 'vypln') continue;
      const ly = e.v.toUpperCase();
      if (e.t === 'l') poly(e.b, e.z, ly);
      else if (e.t === 'txt' && o.texty) {
        const al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1, by = e.y + 0.35 * e.h;
        g(0, 'TEXT'); g(8, ly); g(10, n(e.x)); g(20, n(Y(by))); g(30, 0); g(40, n(e.h * 0.72)); g(1, J.bezDiakritiky ? J.bezDiakritiky(e.txt) : String(e.txt).normalize('NFD').replace(/[̀-ͯ]/g, ''));
        if (e.u) g(50, n(e.u));
        if (al) { g(72, al); g(11, n(e.x)); g(21, n(Y(by))); g(31, 0); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------------- dělení na listy papíru ---------------- */
  const PATA = 12, PRAVY = 9; // rezervy pro kontrolní úsečky (pata a pravý pás)
  function rozvrhListu(sc, pw, ph, okraj, prekryv) {
    const varianta = (W, H) => {
      const uw = W - 2 * okraj - PRAVY, uh = H - 2 * okraj - PATA;
      if (sc.w <= uw + 1e-6 && sc.h <= uh + 1e-6) return { W, H, uw, uh, nx: 1, ny: 1, jeden: true };
      const g = Math.min(prekryv, uw / 3, uh / 3);
      const nx = Math.max(1, Math.ceil((sc.w - g) / (uw - g) - 1e-9)), ny = Math.max(1, Math.ceil((sc.h - g) / (uh - g) - 1e-9));
      return { W, H, uw, uh, nx, ny, g, jeden: false };
    };
    const a = varianta(pw, ph), b = varianta(ph, pw);
    const v = b.nx * b.ny < a.nx * a.ny ? b : a;
    const listy = [];
    if (v.jeden) listy.push({ sx: sc.x0 - (v.uw - sc.w) / 2, sy: sc.y0 - (v.uh - sc.h) / 2, r: 0, c: 0 });
    else {
      const cw = v.nx * (v.uw - v.g) + v.g, chh = v.ny * (v.uh - v.g) + v.g;
      const ox = sc.x0 - (cw - sc.w) / 2, oy = sc.y0 - (chh - sc.h) / 2;
      for (let r = 0; r < v.ny; r++) for (let c = 0; c < v.nx; c++) listy.push({ sx: ox + c * (v.uw - v.g), sy: oy + r * (v.uh - v.g), r, c });
    }
    return Object.assign(v, { listy });
  }

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/·/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/×/g, 'x').replace(/²/g, '2').replace(/[↗↖↘↔]/g, '');
  J.bezDiakritiky = bezDiakritiky;
  function rgb(hex) { const c = J.hexRgb(hex) || [0, 0, 0]; return c; }
  /**
   * stranky = [{scena, nadpis, deleni:true} | {scena, nadpis} (zmenšit) | {text:[řádky], nadpis, ctverec, tabulka}]
   * o: {papir:[w,h], okraj, prekryv, pismo (TTF base64), nazev, cernobile}
   */
  function pdf(jsPDF, stranky, o) {
    o = Object.assign({ papir: [210, 297], okraj: 8, prekryv: 12 }, o || {});
    const [pw, ph] = o.papir;
    let doc = null, uni = false;
    const T = (s) => (uni ? String(s).replace(/[↗↖↘↔]/g, '') : bezDiakritiky(s));
    const novaStrana = (W, H) => {
      if (doc) { doc.addPage([W, H], W > H ? 'l' : 'p'); return; }
      doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: W > H ? 'l' : 'p', compress: true });
      if (o.pismo) {
        try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; }
        catch (e) { doc.setFont('helvetica', 'normal'); }
      }
      doc.setProperties({ title: o.nazev || 'Intarzie a parketáž', creator: 'Intarzie a parketáž' });
    };
    const text = (txt, x, y, h, a, u, c) => {
      doc.setFont(uni ? 'LS' : 'helvetica', 'normal'); doc.setFontSize(h / 0.3528); doc.setTextColor(...rgb(c || '#000000'));
      const t = T(txt), w = doc.getTextWidth(t), uu = (u || 0) * Math.PI / 180;
      const bx = x + Math.sin(uu) * 0.35 * h, by = y + Math.cos(uu) * 0.35 * h, k = a === 'r' ? w : a === 'c' ? w / 2 : 0;
      doc.text(t, bx - Math.cos(uu) * k, by + Math.sin(uu) * k, u ? { angle: u } : undefined);
    };
    const cesta = (R, X, Y) => { const b = R.map((q) => [X(q[0]), Y(q[1])]), seg = []; for (let i = 1; i < b.length; i++) seg.push([b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]]); return { b, seg }; };
    const kresli = (e, X, Y, k) => {
      if (e.t === 'l') {
        const c = o.cernobile && e.v !== 'rez' ? [0, 0, 0] : rgb(barvaPrvku(e, 'c'));
        doc.setDrawColor(...c); doc.setLineWidth(Math.max(0.05, (e.s || 0.2) * (k < 1 ? Math.max(0.5, k) : 1)));
        if (e.d) { const s = e.s || 0.2; doc.setLineDashPattern([Math.max(1.2, s * 8), Math.max(0.8, s * 5)], 0); }
        const { b, seg } = cesta(e.b, X, Y);
        if (seg.length) doc.lines(seg, b[0][0], b[0][1], [1, 1], 'S', !!e.z);
        if (e.d) doc.setLineDashPattern([], 0);
      } else if (e.t === 'p') {
        if (o.cernobile) return;
        doc.setFillColor(...rgb(barvaPrvku(e, 'f')));
        if (e.b.length > 1) {
          const cc = [];
          for (const R of e.b) { cc.push({ op: 'm', c: [X(R[0][0]), Y(R[0][1])] }); for (let i = 1; i < R.length; i++) cc.push({ op: 'l', c: [X(R[i][0]), Y(R[i][1])] }); cc.push({ op: 'h', c: [] }); }
          try { doc.path(cc); doc.fillEvenOdd(); return; } catch (er) { /* níže */ }
        }
        const { b, seg } = cesta(e.b[0], X, Y);
        if (seg.length) doc.lines(seg, b[0][0], b[0][1], [1, 1], 'F', true);
      } else if (e.t === 'txt') text(e.txt, X(e.x), Y(e.y), e.h * (k || 1), e.a, e.u, o.cernobile ? '#000000' : barvaPrvku(e, 'c'));
    };
    const vse = (sc, X, Y, k) => {
      const vr = vrstvySceny(sc);
      for (const v of vr) for (const e of sc.prvky) if (e.v === v) kresli(e, X, Y, k);
    };
    /** kontrolní úsečky: vodorovně 100 mm v patě, svisle 100 mm v pravém pásu */
    const meritko = (W, H) => {
      const y = H - o.okraj - 3, x = o.okraj;
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
      doc.line(x, y, x + 100, y);
      for (let i = 0; i <= 10; i++) doc.line(x + i * 10, y - (i % 5 ? 1 : 2.2), x + i * 10, y);
      text('0', x, y + 1.8, 2, 'c'); text('50', x + 50, y + 1.8, 2, 'c'); text('100 mm', x + 100, y + 1.8, 2, 'c');
      const xs = W - o.okraj - 2, ys = o.okraj;
      if (H - 2 * o.okraj - PATA >= 100) {
        doc.line(xs, ys, xs, ys + 100);
        for (let i = 0; i <= 10; i++) doc.line(xs - (i % 5 ? 1 : 2.2), ys + i * 10, xs, ys + i * 10);
        text('svisle 50 / 100 mm', xs - 3.4, ys + 50, 2, 'c', 90);
      }
    };
    const ctverec = (x, y) => {
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25); doc.rect(x, y, 50, 50, 'S');
      text('50 × 50 mm', x + 25, y + 25, 4, 'c');
      text('Po tisku změřte: čtverec musí mít přesně 50 mm (tisk „skutečná velikost“, ne „přizpůsobit“).', x, y + 54, 2.8, 'l');
    };
    for (const st of stranky) {
      if (st.scena && st.deleni) {
        const rv = rozvrhListu(st.scena, pw, ph, o.okraj, o.prekryv), N = rv.listy.length;
        for (const l of rv.listy) {
          novaStrana(rv.W, rv.H);
          const X = (x) => o.okraj + (x - l.sx), Y = (y) => o.okraj + (y - l.sy);
          doc.saveGraphicsState();
          doc.rect(o.okraj, o.okraj, rv.uw, rv.uh, null); doc.clip(); doc.discardPath();
          vse(st.scena, X, Y, 1);
          doc.restoreGraphicsState();
          if (!rv.jeden) {
            doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.2); doc.setLineDashPattern([2, 1.5], 0);
            if (l.c < rv.nx - 1) doc.line(o.okraj + rv.uw - rv.g, o.okraj, o.okraj + rv.uw - rv.g, o.okraj + rv.uh);
            if (l.r < rv.ny - 1) doc.line(o.okraj, o.okraj + rv.uh - rv.g, o.okraj + rv.uw, o.okraj + rv.uh - rv.g);
            doc.setLineDashPattern([], 0); doc.setDrawColor(0, 0, 0);
            for (const [x, y] of [[o.okraj, o.okraj], [o.okraj + rv.uw, o.okraj], [o.okraj, o.okraj + rv.uh], [o.okraj + rv.uw, o.okraj + rv.uh]]) { doc.line(x - 3, y, x + 3, y); doc.line(x, y - 3, x, y + 3); }
            if (l.c > 0 || l.r > 0) text('ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', o.okraj + 2, o.okraj - 2.4, 2.3, 'l', 0, '#555555');
          }
          const pata = rv.H - o.okraj - 8.5;
          text([st.nadpis, N > 1 ? `list ${l.r * rv.nx + l.c + 1}/${N} (řádek ${l.r + 1}, sloupec ${l.c + 1})` : '', 'tiskněte 1:1'].filter(Boolean).join(' · '), o.okraj + 112, rv.H - o.okraj - 2.4, 2.5, 'l');
          meritko(rv.W, rv.H);
          if (N > 1) {
            const mx = rv.W - o.okraj - PRAVY - 3 * rv.nx, my = pata - 3 * rv.ny + 2;
            doc.setLineWidth(0.15); doc.setDrawColor(0, 0, 0);
            for (let r = 0; r < rv.ny; r++) for (let c = 0; c < rv.nx; c++) {
              if (r === l.r && c === l.c) { doc.setFillColor(80, 80, 80); doc.rect(mx + c * 3, my + r * 3, 2.6, 2.6, 'FD'); } else doc.rect(mx + c * 3, my + r * 3, 2.6, 2.6, 'S');
            }
          }
        }
      } else {
        novaStrana(pw, ph);
        let y = o.okraj + 6;
        if (st.nadpis) { text(st.nadpis, o.okraj, y, 5.2, 'l'); y += 8; }
        if (st.scena) {
          const sc = st.scena, k = Math.min(1, (pw - 2 * o.okraj) / sc.w, Math.max(30, ph - y - o.okraj - 14) / sc.h);
          const X = (x) => o.okraj + (x - sc.x0) * k, Y = (yy) => y + (yy - sc.y0) * k;
          vse(sc, X, Y, k);
          y += sc.h * k + 4;
          text(k < 0.999 ? `Zmenšeno v měřítku 1:${fmt(1 / k, 2)} – jen pro orientaci, neměřit.` : 'Měřítko 1:1.', o.okraj, y, 2.6, 'l', 0, '#555555');
          y += 6;
        }
        if (st.tabulka) {
          const tb = st.tabulka, sl = tb.sloupce, sirky = tb.sirky, vel = 2.7;
          const radek = (bunky, tucne) => {
            if (y > ph - o.okraj - 10) { novaStrana(pw, ph); y = o.okraj + 6; }
            let x = o.okraj;
            bunky.forEach((b, i) => { text(String(b), x + (sl[i] === 'r' ? sirky[i] - 1 : 0), y, vel, sl[i] === 'r' ? 'r' : 'l', 0, tucne ? '#000000' : '#222222'); x += sirky[i]; });
            doc.setDrawColor(190, 190, 190); doc.setLineWidth(0.15); doc.line(o.okraj, y + 1.6, o.okraj + sirky.reduce((a, b) => a + b, 0), y + 1.6);
            y += vel * 1.7;
          };
          radek(tb.hlavicka, true);
          for (const r of tb.radky) radek(r, false);
          y += 4;
        }
        for (const r of st.text || []) {
          const tucne = r.startsWith('# '), t = tucne ? r.slice(2) : r, vel = tucne ? 3.8 : 3;
          doc.setFont(uni ? 'LS' : 'helvetica', 'normal'); doc.setFontSize(vel / 0.3528);
          for (const rr of doc.splitTextToSize(T(t), pw - 2 * o.okraj)) {
            if (y > ph - o.okraj - 8) { novaStrana(pw, ph); y = o.okraj + 6; }
            doc.setFontSize(vel / 0.3528); doc.setTextColor(0, 0, 0); doc.text(rr, o.okraj, y); y += vel * 1.45;
          }
          y += tucne ? 0.6 : 0.8;
        }
        if (st.ctverec) { if (y + 60 > ph - o.okraj) { novaStrana(pw, ph); y = o.okraj + 6; } ctverec(o.okraj, y + 2); }
      }
    }
    if (!doc) novaStrana(pw, ph);
    return doc;
  }

  const API = { scenaSestavy, scenaListu, scenaLaser, scenaTvaru, sipka, svg, svgPrvek, poskladej, dxf, pdf, rozvrhListu, bezDiakritiky, LASER_BARVY, svetle };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.INTV = API;
})(typeof window !== 'undefined' ? window : globalThis);
