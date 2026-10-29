/* Razítka, pečeti a reliéfy – jádro bez DOM (jde v node).
   Parametry a jejich meze, 2D motiv (text přes opentype.js, SVG přes MDL.svgNaKontury z Modeláře,
   text po kruhu, rámečky), měření nejtenčí čáry a mezery (Clipper), stavba těles přes manifold-3d,
   převisy na hotové síti, kontroly a projekt JSON.
   Souřadnice v mm, osa y nahoru, z nahoru. Deska leží na z ∈ [0, deska], reliéf nad ní,
   integrovaná rukojeť pod ní (z < 0) – to je zároveň tisková poloha (rukojeť dole na podložce).
   Motiv se drží v podobě otisku (jak se čte na papíře / v plaketě); razítko a pečeť ho na desce zrcadlí. */
(function () {
  'use strict';
  const CL = typeof module !== 'undefined' ? require('../lib/clipper.min.js') : globalThis.ClipperLib;
  const S = 1000;                       // Clipper počítá v celých µm
  const PI = Math.PI;

  const fmt = (x, des = 1) => {
    const t = (Math.round(x * 10 ** des) / 10 ** des).toFixed(des);
    return (des > 0 ? t.replace(/\.?0+$/, '') : t).replace('.', ',').replace(/^-/, '−');
  };
  const kopie = o => JSON.parse(JSON.stringify(o));
  const vezmi = (o, c) => c.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, c, h) { const k = c.split('.'); const l = k.pop(); k.reduce((a, x) => a[x], o)[l] = h; }
  function cislo(s, def) {
    if (typeof s === 'number') return Number.isFinite(s) ? s : def;
    const t = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
    const v = t === '' ? NaN : Number(t);
    return Number.isFinite(v) ? v : def;
  }

  const DRUHY = { razitko: 'Razítko', pecet: 'Pečeť do vosku', plaketa: 'Reliéf / plaketa' };
  const TVARY = { kruh: 'Kulatý', obdelnik: 'Obdélník', oval: 'Ovál' };
  const RUKOJETI = { zadna: 'Bez rukojeti (nalepit)', valcova: 'Válcová', hribova: 'Hřibová', cep: 'Na čep (2 díly)' };
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24, prutok: 6 },
    PETG: { nazev: 'PETG', hustota: 1.27, prutok: 5 },
    TPU: { nazev: 'TPU 95A', hustota: 1.21, prutok: 2.5 },
  };

  const VYCHOZI = {
    nazev: 'Razítko',
    druh: 'razitko', tvar: 'kruh',
    sirka: 40, vyska: 40, zaobleni: 2, deska: 3,
    motiv: {
      zdroj: 'text', pismo: 'libsans', text: 'SCHVÁLENO', velikost: 5, radkovani: 1.35, prostrkani: 0, zesileni: 0,
      svg: '', svgNazev: '', svgSirka: 18, svgRezim: 'plocha', posunY: 0,
    },
    obvod: { nahore: 'NOVÁK A SYN S.R.O.', dole: 'PRAHA', velikost: 3.6, odsazeni: 0.8, prostrkani: 0.3, delici: true },
    ramecek: { pocet: 1, cara: 0.9, okraj: 0.8, mezera: 0.6 },
    relief: { rezim: 'vystouply', vyska: 1.5, uhel: 30 },
    rukojet: { typ: 'hribova', prumer: 20, delka: 45, hlava: 30, cep: 8, hloubka: 3, vule: 0.25 },
    otvor: { pouzit: true, prumer: 4, odsazeni: 4 },
    tisk: { tryska: 0.4, vrstva: 0.2, material: 'PLA' },
  };
  const ROZSAHY = {
    sirka: [8, 200], vyska: [8, 200], zaobleni: [0, 50], deska: [0.8, 20],
    'motiv.velikost': [1, 80], 'motiv.radkovani': [0.8, 3], 'motiv.prostrkani': [-2, 10], 'motiv.zesileni': [-0.5, 1.5],
    'motiv.svgSirka': [2, 200], 'motiv.posunY': [-100, 100],
    'obvod.velikost': [1, 30], 'obvod.odsazeni': [0, 10], 'obvod.prostrkani': [-2, 10],
    'ramecek.pocet': [0, 3], 'ramecek.cara': [0.2, 10], 'ramecek.okraj': [0, 20], 'ramecek.mezera': [0.2, 20],
    'relief.vyska': [0.2, 10], 'relief.uhel': [0, 45],
    'rukojet.prumer': [5, 80], 'rukojet.delka': [5, 200], 'rukojet.hlava': [5, 120], 'rukojet.cep': [2, 40],
    'rukojet.hloubka': [1, 30], 'rukojet.vule': [0, 1.5],
    'otvor.prumer': [1, 30], 'otvor.odsazeni': [1, 100],
    'tisk.tryska': [0.1, 1.2], 'tisk.vrstva': [0.05, 0.6],
  };
  const VYCTY = {
    druh: Object.keys(DRUHY), tvar: Object.keys(TVARY), 'motiv.zdroj': ['text', 'svg'], 'motiv.svgRezim': ['plocha', 'obrys', 'silueta'],
    'relief.rezim': ['vystouply', 'vyhloubeny'], 'rukojet.typ': Object.keys(RUKOJETI), 'tisk.material': Object.keys(MATERIALY),
  };
  const TEXTY = { nazev: 120, 'motiv.pismo': 60, 'motiv.text': 400, 'motiv.svgNazev': 120, 'obvod.nahore': 120, 'obvod.dole': 120 };
  const LOGICKE = ['obvod.delici', 'otvor.pouzit'];
  const MAX_SVG = 400000;

  /** Libovolný vstup → úplný projekt v mezích + seznam toho, co se muselo opravit. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hlaseni = [];
    const v = vstup && typeof vstup === 'object' ? vstup : {};
    const cesty = [...Object.keys(ROZSAHY), ...Object.keys(VYCTY), ...Object.keys(TEXTY), ...LOGICKE, 'motiv.svg'];
    for (const c of cesty) {
      const h = vezmi(v, c);
      if (h === undefined) continue;
      if (ROZSAHY[c]) {
        const [a, b] = ROZSAHY[c], x = cislo(h, NaN);
        if (!Number.isFinite(x)) { hlaseni.push(`${c}: neplatné číslo, použito ${fmt(vezmi(p, c), 2)}`); continue; }
        const y = Math.min(b, Math.max(a, x));
        if (y !== x) hlaseni.push(`${c}: omezeno na ${fmt(y, 2)}`);
        poloz(p, c, c === 'ramecek.pocet' ? Math.round(y) : y);
      } else if (VYCTY[c]) {
        if (VYCTY[c].includes(h)) poloz(p, c, h); else hlaseni.push(`${c}: neznámá hodnota „${h}“`);
      } else if (TEXTY[c]) {
        poloz(p, c, String(h).slice(0, TEXTY[c]));
      } else if (c === 'motiv.svg') {
        const t = String(h || '');
        if (t.length > MAX_SVG) hlaseni.push('SVG je větší než 400 kB – nepoužito'); else p.motiv.svg = t;
      } else poloz(p, c, !!h);
    }
    if (p.druh === 'pecet') p.tvar = 'kruh';
    if (p.tvar === 'kruh') p.vyska = p.sirka;
    return { p, hlaseni };
  }

  /* ---------------- Clipper ---------------- */
  const naInt = b => b.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));
  const zInt = c => c.map(q => [q.X / S, q.Y / S]);
  function boolean(typ, a, b, pravidlo) {
    const c = new CL.Clipper();
    c.AddPaths(a, CL.PolyType.ptSubject, true);
    if (b && b.length) c.AddPaths(b, CL.PolyType.ptClip, true);
    const out = new CL.Paths();
    const ft = pravidlo === 'evenodd' ? CL.PolyFillType.pftEvenOdd : CL.PolyFillType.pftNonZero;
    c.Execute(typ, out, ft, ft);
    return out;
  }
  const sjednot = (a, pravidlo) => boolean(CL.ClipType.ctUnion, a, null, pravidlo);
  const rozdil = (a, b) => boolean(CL.ClipType.ctDifference, a, b);
  const prunik = (a, b) => boolean(CL.ClipType.ctIntersection, a, b);
  /** Offset o d mm; 'kulate' = oblé rohy (rozšíření tahu), jinak ostré (měření tloušťky zachová rohy). */
  function posun(cesty, d, kulate = true) {
    if (!cesty.length || Math.abs(d) < 1e-6) return cesty.map(c => c.slice());
    const o = new CL.ClipperOffset(8, 0.03 * S);
    o.AddPaths(cesty, kulate ? CL.JoinType.jtRound : CL.JoinType.jtMiter, CL.EndType.etClosedPolygon);
    const out = new CL.Paths();
    o.Execute(out, d * S);
    return out;
  }
  const plocha = cesty => cesty.reduce((s, c) => s + CL.Clipper.Area(c), 0) / (S * S);
  function hranice(cesty) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const c of cesty) for (const q of c) {
      const x = q.X / S, y = q.Y / S;
      if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
    }
    return b;
  }
  const zrcadli = cesty => cesty.map(c => c.map(q => ({ X: -q.X, Y: q.Y })).reverse());
  const posunInt = (cesty, dx, dy) => cesty.map(c => c.map(q => ({ X: q.X + Math.round(dx * S), Y: q.Y + Math.round(dy * S) })));

  /* ---------------- obrysy ---------------- */
  const segKruh = r => Math.max(48, Math.min(360, Math.ceil(2 * PI * r / 0.25)));
  function elipsa(a, b, cx = 0, cy = 0) {
    const n = segKruh(Math.max(a, b)), out = [];
    for (let i = 0; i < n; i++) { const t = 2 * PI * i / n; out.push([cx + a * Math.cos(t), cy + b * Math.sin(t)]); }
    return out;
  }
  function zaoblenyObdelnik(L, W, r) {
    r = Math.max(0, Math.min(r, L / 2 - 1e-3, W / 2 - 1e-3));
    if (r < 0.01) return [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]];
    const n = Math.max(3, Math.ceil(segKruh(r) / 4)), pts = [];
    for (const [cx, cy, a0] of [[L / 2 - r, -W / 2 + r, -90], [L / 2 - r, W / 2 - r, 0], [-L / 2 + r, W / 2 - r, 90], [-L / 2 + r, -W / 2 + r, 180]])
      for (let i = 0; i <= n; i++) { const a = (a0 + 90 * i / n) * PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return pts;
  }
  /** Obrys desky (proti směru hodinových ručiček, střed v počátku). */
  function obrysDesky(p) {
    if (p.tvar === 'kruh') return elipsa(p.sirka / 2, p.sirka / 2);
    if (p.tvar === 'oval') return elipsa(p.sirka / 2, p.vyska / 2);
    return zaoblenyObdelnik(p.sirka, p.vyska, p.zaobleni);
  }

  /* ---------------- text ---------------- */
  /** Křivky glyfu (opentype příkazy, y dolů) → uzavřené obrysy v mm (y nahoru). */
  function prikazyNaObrysy(cmds) {
    const out = []; let akt = null, x0 = 0, y0 = 0;
    const bod = (x, y) => akt.push([x, -y]);
    const kroku = d => Math.max(2, Math.min(24, Math.ceil(d / 0.12)));
    for (const c of cmds) {
      if (c.type === 'M') { akt = []; out.push(akt); bod(c.x, c.y); x0 = c.x; y0 = c.y; }
      else if (c.type === 'L') { bod(c.x, c.y); x0 = c.x; y0 = c.y; }
      else if (c.type === 'Q') {
        const n = kroku(Math.hypot(c.x1 - x0, c.y1 - y0) + Math.hypot(c.x - c.x1, c.y - c.y1));
        for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; bod(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y); }
        x0 = c.x; y0 = c.y;
      } else if (c.type === 'C') {
        const n = kroku(Math.hypot(c.x1 - x0, c.y1 - y0) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2));
        for (let i = 1; i <= n; i++) {
          const t = i / n, u = 1 - t;
          bod(u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y);
        }
        x0 = c.x; y0 = c.y;
      }
    }
    return out.filter(o => o.length >= 3);
  }
  const vyskaVersalek = font => {
    const em = font.unitsPerEm || 1000;
    return ((font.tables && font.tables.os2 && font.tables.os2.sCapHeight) || 0.7 * em) / em;
  };
  /** Řádek textu → glyfy s obrysy (účaří y = 0, x od 0), velikost = výška velkých písmen v mm. */
  function rozlozRadek(font, text, velikost, prostrkani) {
    const em = font.unitsPerEm || 1000, fs = velikost / vyskaVersalek(font);
    const glyfy = font.stringToGlyphs(text), out = [], chybejici = [];
    let x = 0;
    [...text].forEach(ch => { if (/\S/.test(ch) && font.charToGlyph(ch).index === 0) chybejici.push(ch); });
    glyfy.forEach((g, i) => {
      const adv = (g.advanceWidth || 0) * fs / em;
      const obrysy = prikazyNaObrysy(g.getPath(x, 0, fs).commands);
      out.push({ obrysy, x0: x, adv });
      x += adv + prostrkani;
      if (i + 1 < glyfy.length && font.getKerningValue) x += font.getKerningValue(g, glyfy[i + 1]) * fs / em;
    });
    const delka = out.length ? x - prostrkani : 0;
    return { glyfy: out, delka, chybejici };
  }
  /** Středové řádky textu → cesty (µm), blok vystředěný kolem počátku. */
  function textBlok(font, p) {
    const m = p.motiv;
    const radky = m.text.split('\n').map(t => t.trim());
    const lh = m.velikost * m.radkovani;
    const cesty = []; let chybejici = [];
    radky.forEach((t, i) => {
      if (!t) return;
      const r = rozlozRadek(font, t, m.velikost, m.prostrkani);
      chybejici = chybejici.concat(r.chybejici);
      const obr = r.glyfy.flatMap(g => g.obrysy);
      if (!obr.length) return;
      // vodorovně podle skutečného obrysu (kulaté znaky přesahují šířku znaku)
      let x0 = Infinity, x1 = -Infinity;
      for (const o of obr) for (const q of o) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); }
      const dx = -(x0 + x1) / 2, y = -i * lh;
      cesty.push(...obr.map(o => naInt(o.map(q => [q[0] + dx, q[1] + y]))));
    });
    if (!cesty.length) return { cesty: [], chybejici };
    const u = sjednot(cesty);
    // svisle: blok velkých písmen (od účaří posledního řádku po vrchol prvního) na střed
    const neprazdne = radky.map((t, i) => (t ? i : -1)).filter(i => i >= 0);
    const vrch = -neprazdne[0] * lh + m.velikost, spod = -neprazdne[neprazdne.length - 1] * lh;
    return { cesty: posunInt(u, 0, -(vrch + spod) / 2), chybejici };
  }
  /** Text po kruhu: nahoře se čte po směru hodinových ručiček (hlavy ven), dole zleva doprava (hlavy ke středu).
      rVrch = poloměr vnějšího okraje pásu textu. */
  function textPoKruhu(font, text, velikost, prostrkani, rVrch, dole) {
    const r = rozlozRadek(font, text, velikost, prostrkani);
    if (!r.glyfy.length) return { cesty: [], uhel: 0, chybejici: r.chybejici };
    const rb = dole ? rVrch : rVrch - velikost;                 // poloměr účaří
    const rm = dole ? rb - velikost / 2 : rb + velikost / 2;     // střední poloměr pásu (rozteč znaků)
    const cesty = [];
    for (const g of r.glyfy) {
      if (!g.obrysy.length) continue;
      const s = g.x0 + g.adv / 2, c = g.x0 + g.adv / 2;
      const fi = dole ? -(r.delka / 2 - s) / rm : (r.delka / 2 - s) / rm;
      const cs = Math.cos(fi), sn = Math.sin(fi);
      for (const o of g.obrysy) {
        cesty.push(naInt(o.map(([x, y]) => {
          const px = x - c, py = (dole ? -rb : rb) + y;
          return [px * cs - py * sn, px * sn + py * cs];
        })));
      }
    }
    return { cesty: sjednot(cesty), uhel: r.delka / rm, delka: r.delka, mezery: prostrkani * (r.glyfy.length - 1), chybejici: r.chybejici };
  }

  /* ---------------- SVG (MDL.ctiSvg + svgNaKontury z Modeláře) ---------------- */
  let svgCache = { klic: null, v: null };
  function svgMotiv(p) {
    const m = p.motiv;
    const MDL = globalThis.MDL;
    if (!MDL || !MDL.ctiSvg) throw new Error('import SVG se nenačetl');
    const klic = m.svgRezim + '|' + m.svg;
    if (svgCache.klic !== klic) {
      const k = MDL.svgNaKontury(MDL.ctiSvg(m.svg), m.svgRezim, 0);
      svgCache = { klic, v: k };
    }
    const k = svgCache.v, f = m.svgSirka / Math.max(1e-6, k.sirka);
    return sjednot(k.kontury.map(o => naInt(o.map(([x, y]) => [x * f, y * f]))), 'evenodd');
  }

  /* ---------------- motiv ---------------- */
  /** Pás rámečku: obrys desky zúžený o a, šířka čáry c. */
  function pasRamecku(deskaInt, a, c) {
    const vnejsi = posun(deskaInt, -a), vnitrni = posun(deskaInt, -(a + c));
    return rozdil(vnejsi, vnitrni);
  }
  /** Poloha otvoru na zavěšení (plaketa) nebo null. */
  function otvor(p) {
    if (p.druh !== 'plaketa' || !p.otvor.pouzit) return null;
    return { x: 0, y: p.vyska / 2 - p.otvor.odsazeni, r: p.otvor.prumer / 2 };
  }
  /** Úkos boků v mm (o kolik je motiv u paty širší / výřez u povrchu širší). */
  const ukos = p => p.relief.vyska * Math.tan(p.relief.uhel * PI / 180);
  const zrcadlit = p => p.druh !== 'plaketa';

  /**
   * 2D motiv. zdroje = {font} (opentype.Font, stačí když je potřeba text).
   * Vrací {deska (mm), M (µm, podoba otisku), stred, oblast, mimo, orez, obvod, chybejici, chyba}.
   */
  function motiv(p, zdroje = {}) {
    const font = zdroje.font || null;
    const deska = obrysDesky(p), deskaInt = [naInt(deska)];
    const r = p.ramecek, kruh = p.tvar === 'kruh';
    const out = { deska, deskaInt, M: [], stred: [], oblast: [], mimo: 0, orez: 0, obvod: { nahore: 0, dole: 0 }, obvodRozmer: {}, chybejici: [], chyba: null, otvor: otvor(p) };
    const casti = [];
    // rámečky
    let a = r.okraj;
    for (let i = 0; i < r.pocet; i++) { casti.push(...pasRamecku(deskaInt, a, r.cara)); a += r.cara + (i + 1 < r.pocet ? r.mezera : 0); }
    // text po obvodu (jen kulaté)
    const obvodText = kruh && (p.obvod.nahore.trim() || p.obvod.dole.trim());
    let rezerva = a + (r.pocet ? p.obvod.odsazeni : 0);
    if (obvodText) {
      if (!font) { out.chyba = 'písmo se načítá'; return out; }
      const rVrch = p.sirka / 2 - a - p.obvod.odsazeni;
      for (const [k, t] of [['nahore', p.obvod.nahore], ['dole', p.obvod.dole]]) {
        if (!t.trim()) continue;
        const x = textPoKruhu(font, t.trim(), p.obvod.velikost, p.obvod.prostrkani, rVrch, k === 'dole');
        casti.push(...(p.motiv.zesileni ? posun(x.cesty, p.motiv.zesileni) : x.cesty)); out.obvod[k] = x.uhel;
        out.obvodRozmer[k] = { delka: x.delka, mezery: x.mezery, rVrch }; out.chybejici.push(...x.chybejici);
      }
      rezerva = a + 2 * p.obvod.odsazeni + p.obvod.velikost;
      if (p.obvod.delici) { casti.push(...pasRamecku(deskaInt, rezerva, r.cara)); rezerva += r.cara + p.obvod.odsazeni; }
    }
    // oblast pro střed
    out.oblast = posun(deskaInt, -rezerva);
    // střed: text nebo SVG
    let stred = [];
    if (p.motiv.zdroj === 'svg') {
      if (p.motiv.svg) {
        try { stred = svgMotiv(p); } catch (e) { out.chyba = 'SVG: ' + e.message; return out; }
      }
    } else if (p.motiv.text.trim()) {
      if (!font) { out.chyba = 'písmo se načítá'; return out; }
      const t = textBlok(font, p);
      stred = t.cesty; out.chybejici.push(...t.chybejici);
    }
    if (stred.length) {
      if (p.motiv.zesileni) stred = posun(stred, p.motiv.zesileni);
      if (p.motiv.posunY) stred = posunInt(stred, 0, p.motiv.posunY);
      out.mimo = Math.max(0, plocha(rozdil(stred, out.oblast)));
    }
    out.stred = stred;
    out.chybejici = [...new Set(out.chybejici)];
    let M = sjednot(casti.concat(stred));
    // kolem otvoru na zavěšení 1 mm bez motivu – rámeček se před otvorem čistě přeruší
    if (out.otvor) M = rozdil(M, [naInt(elipsa(out.otvor.r + 1, out.otvor.r + 1, out.otvor.x, out.otvor.y))]);
    // motiv nesmí ven z desky (u paty ho rozšíří úkos, proto rezerva)
    const vnitrek = posun(deskaInt, -0.05);
    const pred = plocha(M);
    M = prunik(M, vnitrek);
    out.orez = Math.max(0, pred - plocha(M));
    out.M = M;
    if (!M.length || plocha(M) < 0.01) out.chyba = out.chyba || 'motiv je prázdný – zadejte text nebo nahrajte SVG';
    return out;
  }

  /* ---------------- měření ---------------- */
  /** Části užší než w: rozdíl tvaru a jeho otevření (zúžení a rozšíření o w/2 s ostrými rohy).
      Kousky menší než minPlocha (mm²) jsou jen špičky ostrých úhlů a zbytky dělení křivek. */
  function uzsiNez(cesty, w, minPlocha = 0.6 * w * w) {
    if (!cesty.length) return [];
    const otevreni = posun(posun(cesty, -w / 2, false), w / 2, false);
    // kousky i s jejich otvory – tenký prstenec (rozdíl zaokrouhlení kružnice) má velký obrys, ale skoro nulovou plochu
    const c = new CL.Clipper(), strom = new CL.PolyTree();
    c.AddPaths(cesty, CL.PolyType.ptSubject, true);
    c.AddPaths(otevreni, CL.PolyType.ptClip, true);
    c.Execute(CL.ClipType.ctDifference, strom, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    const out = [];
    for (const ex of CL.JS.PolyTreeToExPolygons(strom)) {
      const kus = [ex.outer, ...ex.holes];
      if (plocha(kus) >= minPlocha) out.push(...kus);
    }
    return out;
  }
  /** Nejmenší šířka (mm), pod kterou tvar ztrácí podstatné části; půlením mezi 0,05 a 4 mm. */
  function nejuzsi(cesty, minPlocha) {
    if (!cesty.length) return Infinity;
    let lo = 0.05, hi = 4;
    if (!uzsiNez(cesty, hi, minPlocha).length) return hi;
    if (uzsiNez(cesty, lo, minPlocha).length) return lo;
    for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; if (uzsiNez(cesty, m, minPlocha).length) hi = m; else lo = m; }
    return lo;
  }
  /**
   * Tisknutelnost motivu: horní plocha reliéfu (co se otiskne) a mezery v ní.
   * vystouplý: čáry = M, mezery = deska − M; vyhloubený: drážky = M (u dna), stěny mezi nimi = deska − (M + úkos).
   */
  function mereni(p, mot) {
    if (mot.chyba) return null;
    const u = ukos(p), tr = p.tisk.tryska;
    const vnitrek = posun(mot.deskaInt, -0.05);
    const cary = mot.M;
    const mezery = rozdil(vnitrek, p.relief.rezim === 'vyhloubeny' ? posun(cary, u) : cary);
    const mp = 0.6 * tr * tr;   // stejný práh pro hlášení i pro „nejtenčí“, ať si neodporují
    const tenke = uzsiNez(cary, tr, mp), tenkeMez = uzsiNez(mezery, tr, mp);
    return {
      cara: nejuzsi(cary, mp), mezera: nejuzsi(mezery, mp),
      tenke, tenkeMez, plochaTenkych: plocha(tenke), plochaTenkychMez: plocha(tenkeMez),
      plochaMotivu: plocha(cary), plochaDesky: plocha(mot.deskaInt), ukos: u,
    };
  }

  /* ---------------- 3D přes manifold ---------------- */
  /**
   * Tělesa. w = inicializovaný manifold-3d (po setup()).
   * Vrací {dily: [{jmeno, nazev, poz, idx, objem, rod}], chyba}.
   */
  function sestav(w, p, mot) {
    if (mot.chyba) return { dily: [], chyba: mot.chyba };
    const { Manifold: Mf, CrossSection: CS } = w;
    const smaz = [], k = x => { smaz.push(x); return x; };
    const t = p.deska, h = p.relief.vyska, u = ukos(p);
    const zr = zrcadlit(p);
    const cs = cesty => k(new CS(cesty.map(zInt).map(c => (zr ? c.map(([x, y]) => [-x, y]) : c)), 'EvenOdd'));
    const valec = (r, z0, z1, r2) => k(k(Mf.cylinder(z1 - z0, r, r2 === undefined ? r : r2, segKruh(Math.max(r, r2 || 0)), false)).translate([0, 0, z0]));
    try {
      const deska2 = k(new CS([mot.deska], 'Positive'));
      let teleso = k(deska2.extrude(t));
      const vnitrek = posun(mot.deskaInt, -0.05);
      // úkos = 2–4 stupně (asi po 0,5 mm), každý o kus širší než ten nad ním (u vyhloubení naopak);
      // jemnější schody manifold sjednocuje neúměrně déle a pevnosti už nepřidají
      const n = u > 0.01 ? Math.max(2, Math.min(4, Math.round(h / 0.5))) : 1;
      if (p.relief.rezim === 'vystouply') {
        const vrstvy = [];
        for (let i = 0; i < n; i++) {
          const d = n > 1 ? u * (n - 1 - i) / (n - 1) : 0;
          const c = prunik(posun(mot.M, d), vnitrek);
          if (!c.length) continue;
          vrstvy.push(k(k(cs(c).extrude(h * (i + 1) / n + 0.3)).translate([0, 0, t - 0.3])));
        }
        teleso = k(Mf.union([teleso, ...vrstvy]));
      } else {
        const kapsy = [];
        const okraj = posun(mot.deskaInt, -0.4);
        for (let i = 0; i < n; i++) {
          const d = n > 1 ? u * i / (n - 1) : 0;
          const c = prunik(posun(mot.M, d), okraj);
          if (!c.length) continue;
          const z0 = t - h + h * i / n;
          kapsy.push(k(k(cs(c).extrude(t + 1 - z0)).translate([0, 0, z0])));
        }
        if (kapsy.length) teleso = k(Mf.difference([teleso, ...kapsy]));
      }
      const ot = mot.otvor;
      if (ot) teleso = k(teleso.subtract(k(valec(ot.r, -1, t + h + 1).translate([ot.x, ot.y, 0]))));

      const R = p.rukojet, rh = R.prumer / 2;
      const dily = [];
      const hlavaHrib = (z0, smer) => {
        // hřibová hlavice: kotouč se sraženou hranou na podložce, nad ním kužel 45° do dříku
        const rc = Math.max(R.hlava / 2, rh + 0.5), tc = Math.max(3, Math.min(10, R.hlava * 0.18)), sr = Math.min(0.8, tc / 3);
        const zz = z => z0 + smer * z;
        const pr = (a, b, r1, r2) => (smer > 0 ? valec(r1, zz(a), zz(b), r2) : valec(r2, zz(b), zz(a), r1));
        return { casti: [pr(0, sr, rc - sr, rc), pr(sr, tc, rc, rc), pr(tc - 0.01, tc + (rc - rh), rc, rh)], vyska: tc + (rc - rh) };
      };
      if (p.druh !== 'plaketa' && (R.typ === 'valcova' || R.typ === 'hribova')) {
        // přechod deska → dřík: obal obrysu desky a kružnice dříku, sklon nejvýš 45° (tiskne se bez podpor)
        let maxR = 0; for (const [x, y] of mot.deska) maxR = Math.max(maxR, Math.hypot(x, y));
        const hlav = R.typ === 'hribova' ? hlavaHrib(-R.delka, 1) : null;
        const vyskaHlavy = hlav ? hlav.vyska : 0.8;
        const dMax = Math.max(1, R.delka - vyskaHlavy - 1);
        const d = Math.min(dMax, Math.max(1, maxR - rh));
        const body = [];
        for (const [x, y] of mot.deska) body.push([x, y, 0]);   // shodně s obrysem desky – bez schůdku na spodku desky
        const kr = elipsa(rh, rh);
        for (const [x, y] of kr) body.push([x, y, -d]);
        const casti = [teleso, k(Mf.hull(body)), valec(rh, -R.delka + (hlav ? vyskaHlavy - 0.5 : 0.8), -d + 0.3)];
        if (hlav) casti.push(...hlav.casti);
        else casti.push(valec(rh - 0.8, -R.delka, -R.delka + 0.8, rh));   // sražení konce válce
        teleso = k(Mf.union(casti));
      }
      if (p.druh !== 'plaketa' && R.typ === 'cep') {
        // deska má zespodu jamku na čep, rukojeť je samostatný díl (hlavice dole, čep nahoře)
        teleso = k(teleso.subtract(valec((R.cep + R.vule) / 2, -1, R.hloubka)));
        const hlav = hlavaHrib(0, 1);
        const zc = Math.max(R.delka, hlav.vyska + 1);
        const delkaCepu = Math.max(0.5, R.hloubka - 0.4), sr = Math.min(0.5, R.cep / 6);
        const rukojet = k(Mf.union([...hlav.casti, valec(rh, hlav.vyska - 0.5, zc),
          valec(R.cep / 2, zc - 0.3, zc + delkaCepu - sr), valec(R.cep / 2, zc + delkaCepu - sr, zc + delkaCepu, R.cep / 2 - sr)]));
        dily.push(['rukojet', 'Rukojeť', rukojet]);
      }
      const jm = { razitko: ['razitko', 'Razítko'], pecet: ['pecet', 'Pečeť'], plaketa: ['plaketa', 'Plaketa'] }[p.druh];
      dily.unshift([jm[0], R.typ === 'cep' && p.druh !== 'plaketa' ? jm[1] + ' – deska' : jm[1], teleso]);
      return {
        dily: dily.map(([jmeno, nazev, m]) => {
          const st = m.status();
          if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
          if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
          const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
          const poz = new Float32Array(vp.length / np * 3);
          for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
          return { jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), rod: m.genus() };
        }),
        chyba: null,
      };
    } catch (e) {
      return { dily: [], chyba: 'Geometrie: ' + (e && e.message || e) };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /** Převislé plochy v tiskové poloze (nejnižší bod na z = 0): víc než `uhel` od svislice, mimo podložku.
      Vodorovné spodní plochy = mosty. Plochy v mm². */
  function previsy(poz, idx, uhel = 45) {
    let zmin = Infinity;
    for (let i = 2; i < poz.length; i += 3) zmin = Math.min(zmin, poz[i]);
    const prah = -Math.sin((uhel + 1) * PI / 180);
    let previs = 0, mosty = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const a = 3 * idx[t], b = 3 * idx[t + 1], c = 3 * idx[t + 2];
      const ux = poz[b] - poz[a], uy = poz[b + 1] - poz[a + 1], uz = poz[b + 2] - poz[a + 2];
      const vx = poz[c] - poz[a], vy = poz[c + 1] - poz[a + 1], vz = poz[c + 2] - poz[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (l < 1e-12 || nz / l > prah) continue;
      if (Math.max(poz[a + 2], poz[b + 2], poz[c + 2]) - zmin < 0.05) continue;   // leží na podložce
      if (nz / l < -0.996) mosty += l / 2; else previs += l / 2;
    }
    return { previs, mosty };
  }

  /** Hmotnost, filament 1,75 mm a hrubá doba tisku. */
  function odhad(objemMm3, vyskaMm, p) {
    const m = MATERIALY[p.tisk.material];
    const cm3 = objemMm3 / 1000;
    return {
      hmotnost: cm3 * m.hustota,
      filament: objemMm3 / (PI * 0.875 * 0.875) / 1000,          // metry
      cas: (objemMm3 / m.prutok + vyskaMm / p.tisk.vrstva * 4) / 60, // minuty: objem průtokem + přejezdy po vrstvách
    };
  }

  /* ---------------- kontroly ---------------- */
  /** Hlášení {uroven: chyba|varovani|info|ok, text, pole: [cesty], oprava?: {text, pole, hodnota}}. */
  function kontroly(p, mot, mer, sit) {
    const H = [];
    const hl = (uroven, text, pole = [], oprava) => H.push({ uroven, text, pole, oprava });
    if (mot.chyba) { hl('chyba', 'Motiv: ' + mot.chyba, [p.motiv.zdroj === 'svg' ? 'motiv.svg' : 'motiv.text']); return H; }
    if (sit && sit.chyba) hl('chyba', sit.chyba, ['relief.vyska']);
    const tr = p.tisk.tryska, R = p.rukojet, u = ukos(p);
    const minRozmer = Math.min(p.sirka, p.vyska);
    // motiv
    if (mot.chybejici.length) hl('varovani', `Písmo nemá znaky ${mot.chybejici.join(' ')} – vyberte jiné písmo.`, ['motiv.pismo']);
    if (mot.mimo > 0.3) {
      // zmenšit střed tak, aby se vešel do volné oblasti
      const bs = hranice(mot.stred), bo = hranice(mot.oblast);
      const f = Math.min((bo[2] - bo[0]) / Math.max(1e-6, bs[2] - bs[0]), (bo[3] - bo[1]) / Math.max(1e-6, bs[3] - bs[1])) * 0.95;
      const zdroj = p.motiv.zdroj === 'svg' ? 'motiv.svgSirka' : 'motiv.velikost';
      const nova = Math.max(ROZSAHY[zdroj][0], Math.floor(vezmi(p, zdroj) * f * 10) / 10);
      hl('varovani', `Střed motivu přesahuje volnou plochu (${fmt(mot.mimo, 1)} mm² zasahuje do rámečku nebo textu po obvodu).`, [zdroj],
        f < 1 ? { text: `zmenšit na ${fmt(nova)} mm`, pole: zdroj, hodnota: nova } : undefined);
    }
    if (mot.orez > 0.3) hl('varovani', `Motiv přesahuje desku – ${fmt(mot.orez, 1)} mm² se ořízlo.`, [p.motiv.zdroj === 'svg' ? 'motiv.svgSirka' : 'motiv.velikost']);
    for (const k of ['nahore', 'dole']) {
      const lim = p.obvod.nahore.trim() && p.obvod.dole.trim() ? PI * 0.92 : 2 * PI * 0.9;
      if (mot.obvod[k] > lim) {
        // délka = a·v + mezery, střední poloměr = rVrch − v/2 → největší v, při kterém úhel ≤ lim
        const o = mot.obvodRozmer[k], a = (o.delka - o.mezery) / p.obvod.velikost;
        const nova = Math.floor((lim * o.rVrch - o.mezery) / (a + lim / 2) * 10) / 10;
        hl('varovani', `Text po obvodu ${k === 'nahore' ? 'nahoře' : 'dole'} je delší, než se vejde (${fmt(mot.obvod[k] * 180 / PI, 0)}°).`, ['obvod.' + k],
          { text: `písmo ${fmt(nova)} mm`, pole: 'obvod.velikost', hodnota: Math.max(1, nova) });
      }
    }
    if (mer) {
      if (mer.plochaTenkych > 0.01) {
        const potreba = Math.min(1.5, Math.ceil((tr - mer.cara) / 2 * 20) / 20 + 0.05);
        const zes = Math.round((p.motiv.zesileni + potreba) * 100) / 100;
        const vazne = mer.plochaTenkych > 0.15 * mer.plochaMotivu;
        hl(vazne ? 'chyba' : 'varovani', `Nejtenčí čára motivu ≈ ${fmt(mer.cara, 2)} mm je pod tryskou ${fmt(tr, 2)} mm – ${fmt(mer.plochaTenkych, 1)} mm² se nevytiskne (červeně v otisku).`,
          ['motiv.zesileni'], p.motiv.zesileni < zes ? { text: `zesílit tah o ${fmt(zes, 2)} mm`, pole: 'motiv.zesileni', hodnota: zes } : undefined);
      } else hl('ok', `Nejtenčí čára ≈ ${fmt(mer.cara, 2)} mm (tryska ${fmt(tr, 2)} mm).`);
      if (mer.plochaTenkychMez > 0.01) {
        const vyh = p.relief.rezim === 'vyhloubeny';
        hl('varovani', `${vyh ? 'Stěny mezi vyrytými tahy' : 'Mezery mezi tahy'} místy ≈ ${fmt(mer.mezera, 2)} mm – pod tryskou ${fmt(tr, 2)} mm ${vyh ? 'se nevytisknou' : 'se zalijí'}.`,
          [vyh && u > 0.05 ? 'relief.uhel' : 'motiv.prostrkani']);
      }
    }
    // deska a reliéf
    if (p.deska < 1.2) hl('chyba', `Deska ${fmt(p.deska)} mm je příliš tenká – zlomí se (aspoň 1,5 mm, u razítka 2–3 mm).`, ['deska'], { text: 'deska 3 mm', pole: 'deska', hodnota: 3 });
    else if (p.deska < 2 && p.druh !== 'plaketa') hl('varovani', `Deska ${fmt(p.deska)} mm je tenká – razítko se při tlaku prohne. Doporučeno 2–3 mm.`, ['deska']);
    if (p.relief.rezim === 'vyhloubeny' && p.deska - p.relief.vyska < 1.2)
      hl('chyba', `Vyhloubení ${fmt(p.relief.vyska)} mm do desky ${fmt(p.deska)} mm nechá dno tenčí než 1,2 mm.`, ['relief.vyska'], { text: `deska ${fmt(p.relief.vyska + 1.5)} mm`, pole: 'deska', hodnota: Math.round((p.relief.vyska + 1.5) * 10) / 10 });
    if (p.druh === 'razitko' && p.relief.rezim === 'vystouply') {
      if (p.relief.vyska < 0.8) hl('varovani', `Reliéf ${fmt(p.relief.vyska)} mm je nízký – razítkovací barva zašpiní i pozadí. Doporučeno 1–2 mm.`, ['relief.vyska']);
      if (p.relief.vyska > 2.5 && p.relief.uhel < 15) hl('varovani', 'Vysoký reliéf bez úkosu – tenká písmena se budou při razítkování ohýbat. Přidejte úkos 20–35°.', ['relief.uhel'], { text: 'úkos 30°', pole: 'relief.uhel', hodnota: 30 });
    }
    if (p.druh === 'pecet' && p.relief.vyska > 2) hl('varovani', 'Pečeť hlubší než 2 mm se z vosku špatně uvolňuje.', ['relief.vyska']);
    if (p.relief.uhel > 0 && u > 0.6) hl('info', `Úkos rozšíří tahy u paty o ${fmt(u, 2)} mm na každou stranu – drobné mezery se u paty mohou spojit.`, ['relief.uhel']);
    // rukojeť
    if (p.druh !== 'plaketa') {
      if (R.typ === 'cep') {
        if (p.deska - R.hloubka - (p.relief.rezim === 'vyhloubeny' ? p.relief.vyska : 0) < 1)
          hl('chyba', `Jamka na čep (${fmt(R.hloubka)} mm) je skoro stejně hluboká jako deska – nad ní zbývá méně než 1 mm.`, ['rukojet.hloubka'], { text: `deska ${fmt(R.hloubka + 2 + (p.relief.rezim === 'vyhloubeny' ? p.relief.vyska : 0))} mm`, pole: 'deska', hodnota: R.hloubka + 2 + (p.relief.rezim === 'vyhloubeny' ? p.relief.vyska : 0) });
        if (R.cep + R.vule + 2 > minRozmer) hl('chyba', 'Čep je širší než deska.', ['rukojet.cep']);
        if (R.cep > R.prumer) hl('chyba', 'Čep je širší než dřík rukojeti.', ['rukojet.cep']);
        if (R.vule < 0.1) hl('varovani', 'Vůle čepu pod 0,1 mm – tištěný čep do jamky nejspíš nepůjde.', ['rukojet.vule']);
        hl('info', `Deska se tiskne zadní stranou dolů, strop jamky Ø ${fmt(R.cep + R.vule)} mm se přemostí (bez podpor). Čep se do jamky lepí.`, ['rukojet.cep']);
      }
      if (R.typ === 'hribova' && R.hlava < R.prumer) hl('varovani', 'Hlavice hřibu je užší než dřík – nastavte hlavici aspoň o 6 mm větší.', ['rukojet.hlava']);
      if ((R.typ === 'valcova' || R.typ === 'hribova') && R.prumer > minRozmer + 4) hl('varovani', 'Rukojeť je výrazně širší než deska.', ['rukojet.prumer']);
      if (R.typ !== 'zadna' && R.prumer < 10 && R.delka > 30) hl('varovani', `Dřík Ø ${fmt(R.prumer)} mm při délce ${fmt(R.delka)} mm je štíhlý – při tisku se kýve a může prasknout po vrstvách.`, ['rukojet.prumer']);
    }
    // otvor plakety
    if (mot.otvor) {
      const o = mot.otvor;
      if (o.y + o.r > p.vyska / 2 - 1.2) hl('chyba', 'Otvor na zavěšení je příliš blízko okraje (stěna pod 1,2 mm).', ['otvor.odsazeni'], { text: `odsazení ${fmt(o.r + 2.5)} mm`, pole: 'otvor.odsazeni', hodnota: Math.round((o.r + 2.5) * 10) / 10 });
      const kolem = [naInt(elipsa(o.r + 1, o.r + 1, o.x, o.y))];
      if (plocha(prunik(mot.stred.length ? mot.stred : [], kolem)) > 0.05) hl('varovani', 'Otvor na zavěšení zasahuje do motivu.', ['otvor.odsazeni']);
    }
    // síť a převisy
    if (sit && sit.previsy) {
      const pv = sit.previsy;
      if (pv.previs > 1) hl('varovani', `Převisy nad 45°: ${fmt(pv.previs, 0)} mm² – tiskněte s podporami${R.typ === 'valcova' || R.typ === 'hribova' ? ', nebo prodlužte rukojeť (přechod do desky potřebuje výšku)' : ''}.`, ['rukojet.delka']);
      else if (pv.mosty > 1) hl('info', `Mosty (vodorovné stropy) ${fmt(pv.mosty, 0)} mm² – běžně se přemostí bez podpor.`);
      else hl('ok', 'Bez převisů – tiskne se bez podpor.');
    }
    if (sit && sit.vadna) hl('chyba', 'Síť není uzavřená – export by sliceru dělal potíže.', []);
    if (!H.some(x => x.uroven === 'chyba' || x.uroven === 'varovani')) hl('ok', 'Návrh je v pořádku.');
    return H;
  }

  /* ---------------- předvolby ---------------- */
  const SRDCE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 90"><path d="M50 88 C20 64 2 46 2 26 C2 12 13 2 27 2 C37 2 45 8 50 16 C55 8 63 2 73 2 C87 2 98 12 98 26 C98 46 80 64 50 88 Z M50 70 C70 54 84 40 84 27 C84 19 78 14 71 14 C62 14 55 22 50 32 C45 22 38 14 29 14 C22 14 16 19 16 27 C16 40 30 54 50 70 Z" fill-rule="evenodd"/></svg>';
  const PREDVOLBY = [
    { nazev: 'Firemní razítko Ø 40', popis: 'kulaté, text po obvodu, hřibová rukojeť',
      p: { nazev: 'Firemní razítko', druh: 'razitko', tvar: 'kruh', sirka: 40, deska: 3,
        motiv: { zdroj: 'text', text: 'IČO\n12345678', velikost: 3, radkovani: 1.5, prostrkani: 0.15, zesileni: 0.05 },
        obvod: { nahore: 'NOVÁK A SYN S.R.O.', dole: '• PRAHA •', velikost: 2.6, odsazeni: 0.7, prostrkani: 0.2, delici: true },
        ramecek: { pocet: 2, cara: 0.8, okraj: 0.6, mezera: 0.5 }, relief: { rezim: 'vystouply', vyska: 1.5, uhel: 30 },
        rukojet: { typ: 'hribova', prumer: 20, delka: 45, hlava: 30 } } },
    { nazev: 'Adresní razítko 60 × 24', popis: 'obdélník, tři řádky, válcová rukojeť',
      p: { nazev: 'Adresní razítko', druh: 'razitko', tvar: 'obdelnik', sirka: 60, vyska: 24, zaobleni: 1.5, deska: 3,
        motiv: { zdroj: 'text', text: 'Jan Novák\nLipová 12, 110 00 Praha 1\nIČO 12345678', velikost: 2.6, radkovani: 1.7, prostrkani: 0.15, zesileni: 0.08 },
        ramecek: { pocet: 1, cara: 0.7, okraj: 0.8, mezera: 0.6 }, relief: { rezim: 'vystouply', vyska: 1.5, uhel: 30 },
        rukojet: { typ: 'valcova', prumer: 18, delka: 50 } } },
    { nazev: 'Ovál SCHVÁLENO na čep', popis: 'dvojitý rámeček, deska + rukojeť na čep',
      p: { nazev: 'Schváleno', druh: 'razitko', tvar: 'oval', sirka: 50, vyska: 24, deska: 4.5,
        motiv: { zdroj: 'text', text: 'SCHVÁLENO', velikost: 4.2, prostrkani: 0.3, zesileni: 0 },
        ramecek: { pocet: 2, cara: 1, okraj: 0.8, mezera: 0.8 }, relief: { rezim: 'vystouply', vyska: 1.5, uhel: 30 },
        rukojet: { typ: 'cep', prumer: 20, delka: 45, hlava: 30, cep: 8, hloubka: 2.5, vule: 0.25 } } },
    { nazev: 'Pečeť s monogramem Ø 25', popis: 'vyhloubené písmeno, v vosku vystoupí',
      p: { nazev: 'Pečeť R', druh: 'pecet', tvar: 'kruh', sirka: 25, deska: 4, motiv: { zdroj: 'text', pismo: 'libserif', text: 'R', velikost: 13, zesileni: 0 },
        obvod: { nahore: '', dole: '' }, ramecek: { pocet: 1, cara: 1, okraj: 0.8, mezera: 0.6 },
        relief: { rezim: 'vyhloubeny', vyska: 1.2, uhel: 15 }, rukojet: { typ: 'hribova', prumer: 12, delka: 55, hlava: 20 } } },
    { nazev: 'Svatební pečeť Ø 32', popis: 'monogram a nápis po obvodu, vyhloubená',
      p: { nazev: 'Svatební pečeť', druh: 'pecet', tvar: 'kruh', sirka: 32, deska: 4, motiv: { zdroj: 'text', pismo: 'libserif', text: 'M&J', velikost: 4.8, prostrkani: 0.3, zesileni: 0.15 },
        obvod: { nahore: 'ANNO DOMINI', dole: 'MMXXVI', velikost: 2.6, odsazeni: 0.7, prostrkani: 0.6, delici: true },
        ramecek: { pocet: 1, cara: 0.9, okraj: 0.6, mezera: 0.6 }, relief: { rezim: 'vyhloubeny', vyska: 1, uhel: 8 },
        rukojet: { typ: 'hribova', prumer: 13, delka: 55, hlava: 22 } } },
    { nazev: 'Pečeť se srdcem (SVG)', popis: 'motiv z SVG, vypouklý',
      p: { nazev: 'Pečeť srdce', druh: 'pecet', tvar: 'kruh', sirka: 26, deska: 4,
        motiv: { zdroj: 'svg', svg: SRDCE_SVG, svgNazev: 'srdce.svg', svgSirka: 14, svgRezim: 'plocha', zesileni: 0 },
        obvod: { nahore: '', dole: '' }, ramecek: { pocet: 1, cara: 1, okraj: 0.8, mezera: 0.6 },
        relief: { rezim: 'vystouply', vyska: 1, uhel: 20 }, rukojet: { typ: 'valcova', prumer: 12, delka: 50 } } },
    { nazev: 'Cedulka na dveře 90 × 30', popis: 'plaketa, vystouplý text, otvor na zavěšení',
      p: { nazev: 'Cedulka DÍLNA', druh: 'plaketa', tvar: 'obdelnik', sirka: 90, vyska: 30, zaobleni: 4, deska: 3,
        motiv: { zdroj: 'text', pismo: 'libsans', text: 'DÍLNA', velikost: 12, zesileni: 0, posunY: -2 },
        ramecek: { pocet: 1, cara: 1.6, okraj: 2, mezera: 1 }, relief: { rezim: 'vystouply', vyska: 1.6, uhel: 0 },
        otvor: { pouzit: true, prumer: 4, odsazeni: 4.5 } } },
    { nazev: 'Kulatá plaketa vyrytá Ø 70', popis: 'vyrytý text do desky, bez otvoru',
      p: { nazev: 'Plaketa VÍTEJTE', druh: 'plaketa', tvar: 'kruh', sirka: 70, deska: 4,
        motiv: { zdroj: 'text', pismo: 'libserif', text: 'VÍTEJTE', velikost: 6.5, zesileni: 0.1 },
        obvod: { nahore: 'U NOVÁKŮ', dole: '2026', velikost: 5, odsazeni: 1.5, prostrkani: 1, delici: false },
        ramecek: { pocet: 1, cara: 1.5, okraj: 2.5, mezera: 1 }, relief: { rezim: 'vyhloubeny', vyska: 1.6, uhel: 0 },
        otvor: { pouzit: false } } },
  ];
  /** Předvolba → projekt (vnořené objekty se doplní z výchozích). */
  function zPredvolby(i) {
    const v = PREDVOLBY[i].p, p = kopie(VYCHOZI);
    for (const [k, h] of Object.entries(v)) p[k] = h && typeof h === 'object' ? Object.assign({}, VYCHOZI[k], h) : h;
    return normalizuj(p).p;
  }

  /* ---------------- projekt ---------------- */
  const FORMAT = 'webapp_razitko', VERZE = 1;
  const ulozProjekt = p => JSON.stringify({ format: FORMAT, verze: VERZE, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || o.format !== FORMAT) throw new Error('Soubor není projekt razítka (chybí "format": "webapp_razitko").');
    if (!(o.verze >= 1) || o.verze > VERZE) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }

  const API = {
    VYCHOZI, ROZSAHY, VYCTY, DRUHY, TVARY, RUKOJETI, MATERIALY, PREDVOLBY, MAX_SVG,
    normalizuj, zPredvolby, motiv, mereni, sestav, previsy, odhad, kontroly, ulozProjekt, nactiProjekt,
    obrysDesky, rozlozRadek, textPoKruhu, ukos, zrcadlit, uzsiNez, nejuzsi, plocha, hranice, zInt, naInt,
    fmt, cislo, vezmi, poloz, kopie,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.RAZ = API;
})();
