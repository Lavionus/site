/* ============================================================
   Písmolijna – jadro/kontrola.js
   Kontrola fontu (jako Find Problems / Validate ve FontForge):
   otevřené obrysy, směr, extrémy, body blízko sebe, samoprůniky,
   překryvy, neceločíselné souřadnice, metriky, názvy, Unicode,
   komponenty, kerning, ligatury, chybějící glyfy. Každý nález může
   nést opravu, kterou provede PSL.opravNalez. Bez DOM.
   ============================================================ */
(function (G) {
  'use strict';
  const P = G.PSL || (G.PSL = {});

  const CESKE = 'ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž';
  const MEZERY = new Set([0x20, 0xA0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF, 0x180E, 0x034F, 0x00AD]);
  for (let c = 0x2000; c <= 0x200F; c++) MEZERY.add(c);
  for (let c = 0x2060; c <= 0x2064; c++) MEZERY.add(c);
  const jeMezera = u => u < 0x20 || (u >= 0x7F && u < 0xA0) || MEZERY.has(u);
  const jeKombinacni = u => (u >= 0x300 && u <= 0x36F) || (u >= 0x1AB0 && u <= 0x1AFF) || (u >= 0x1DC0 && u <= 0x1DFF) || (u >= 0x20D0 && u <= 0x20FF) || (u >= 0xFE20 && u <= 0xFE2F);

  /* Průsečík úseček ab a cd (vlastní, ne v koncových bodech) → {x, y} nebo null. */
  function prusecik(a, b, c, d) {
    const r1 = b.x - a.x, r2 = b.y - a.y, s1 = d.x - c.x, s2 = d.y - c.y;
    const den = r1 * s2 - r2 * s1;
    if (Math.abs(den) < 1e-12) return null;
    const t = ((c.x - a.x) * s2 - (c.y - a.y) * s1) / den, u = ((c.x - a.x) * r2 - (c.y - a.y) * r1) / den;
    const e = 1e-9;
    if (t <= e || t >= 1 - e || u <= e || u >= 1 - e) return null;
    return { x: a.x + t * r1, y: a.y + t * r2 };
  }
  /* Hrany mnohoúhelníku s obálkami; uzavřený = poslední hrana zpět na začátek. */
  function hrany(pol, uzavreny) {
    const out = [], n = pol.length;
    for (let i = 0; i < (uzavreny ? n : n - 1); i++) {
      const a = pol[i], b = pol[(i + 1) % n];
      out.push({ a, b, i, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) });
    }
    return out;
  }
  /* Samoprůniky mnohoúhelníku (O(n²) s předfiltrem obálkou; hrany seřazené podle x0). */
  function samopruniky(pol, uzavreny, max) {
    const H = hrany(pol, uzavreny), n = H.length, out = [];
    const S = H.slice().sort((p, q) => p.x0 - q.x0);
    for (let k = 0; k < S.length && out.length < (max || 20); k++) {
      const e = S[k];
      for (let m = k + 1; m < S.length && S[m].x0 <= e.x1; m++) {
        const f = S[m];
        if (f.y0 > e.y1 || f.y1 < e.y0) continue;
        const d = Math.abs(e.i - f.i);
        if (d <= 1 || (uzavreny && d === n - 1)) continue;   // sousední hrany
        const p = prusecik(e.a, e.b, f.a, f.b);
        if (p) { out.push(p); if (out.length >= (max || 20)) break; }
      }
    }
    return out;
  }
  /* První průsečík hran dvou mnohoúhelníků nebo null. */
  function prunikDvou(A, B) {
    const HA = hrany(A, true), HB = hrany(B, true).sort((p, q) => p.x0 - q.x0);
    for (const e of HA) {
      for (const f of HB) {
        if (f.x0 > e.x1) break;
        if (f.x1 < e.x0 || f.y0 > e.y1 || f.y1 < e.y0) continue;
        const p = prusecik(e.a, e.b, f.a, f.b);
        if (p) return p;
      }
    }
    return null;
  }
  const obalkaPol = pol => P.obalkaBodu(pol);
  const prekryvObalek = (a, b) => a && b && a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

  /* Hlavní kontrola. volby: glyfy (seznam názvů, výchozí všechny), jen (pole druhů),
     maxNalezu (5000). Vrací pole nálezů. */
  P.zkontroluj = function (font, volby) {
    const v = volby || {}, info = font.info, upm = info.upm || 1000;
    const out = [];
    const jen = v.jen ? new Set(v.jen) : null;
    const max = v.maxNalezu || 5000;
    const pridej = (n) => { if ((!jen || jen.has(n.druh)) && out.length < max) out.push(n); };
    const chci = d => !jen || jen.has(d);
    const nazvy = v.glyfy || font.poradi;

    /* ---------- info fontu ---------- */
    if (info.descender > 0) pridej({ glyf: null, druh: 'info', zavaznost: 'chyba', zprava: 'Dotah dolů (descender) je kladný – musí být záporný nebo nula.', oprava: 'opravDescender' });
    if (info.xVyska > info.vyskaVerzalek) pridej({ glyf: null, druh: 'info', zavaznost: 'varovani', zprava: `x-výška (${info.xVyska}) je větší než výška verzálek (${info.vyskaVerzalek}).` });
    if (info.ascender <= 0) pridej({ glyf: null, druh: 'info', zavaznost: 'chyba', zprava: 'Dotah nahoru (ascender) musí být kladný.' });

    /* ---------- povinné glyfy ---------- */
    if (!font.glyfy['.notdef']) pridej({ glyf: '.notdef', druh: 'chybiGlyf', zavaznost: 'chyba', zprava: 'Chybí povinný glyf .notdef.', oprava: 'vytvorGlyf' });
    const cmap = P.cmap(font);
    if (!cmap.has(0x20)) pridej({ glyf: 'space', druh: 'chybiGlyf', zavaznost: 'varovani', zprava: 'Chybí mezera (U+0020).', oprava: 'vytvorGlyf' });
    if (chci('chybiCeske')) {
      let latinka = 0;
      for (let c = 0x41; c <= 0x5A; c++) { if (cmap.has(c)) latinka++; if (cmap.has(c + 0x20)) latinka++; }
      if (latinka >= 40) {
        const chybi = Array.from(CESKE).filter(ch => !cmap.has(ch.codePointAt(0)));
        if (chybi.length) pridej({
          glyf: null, druh: 'chybiCeske', zavaznost: 'info',
          zprava: `Chybí česká písmena: ${chybi.join(' ')}.`, oprava: 'sestavAkcenty',
          data: { nazvy: chybi.map(ch => P.nazevProUnicode(ch.codePointAt(0))) }
        });
      }
    }
    /* mezery stejné šířky */
    if (cmap.has(0x20) && cmap.has(0xA0)) {
      const a = font.glyfy[cmap.get(0x20)], b = font.glyfy[cmap.get(0xA0)];
      if (a !== b && a.sirka !== b.sirka) pridej({ glyf: b.nazev, druh: 'mezery', zavaznost: 'info', zprava: `Nezlomitelná mezera má jinou šířku (${b.sirka}) než mezera (${a.sirka}).`, oprava: 'srovnejMezery' });
    }

    /* ---------- duplicitní Unicode ---------- */
    const kde = new Map();
    for (const n of font.poradi) for (const u of font.glyfy[n].uni || []) {
      if (kde.has(u)) pridej({ glyf: n, druh: 'duplicitniUnicode', zavaznost: 'chyba', zprava: `Kód U+${u.toString(16).toUpperCase().padStart(4, '0')} má už glyf „${kde.get(u)}“.`, oprava: 'zrusUnicode', data: { uni: u } });
      else kde.set(u, n);
    }

    /* ---------- glyfy ---------- */
    for (const nazev of nazvy) {
      const g = font.glyfy[nazev];
      if (!g) continue;
      if (!P.platnyNazev(nazev)) pridej({ glyf: nazev, druh: 'nazev', zavaznost: 'chyba', zprava: `Neplatný název glyfu „${nazev}“ (povolené A–Z a–z 0–9 . _, nezačíná číslicí, max. 63 znaků).`, oprava: 'prejmenuj' });
      const uni = g.uni || [];
      const kombinacni = uni.some(jeKombinacni) || /comb$/.test(nazev);
      const prazdny = P.glyfJePrazdny(g);
      if (g.sirka < 0) pridej({ glyf: nazev, druh: 'zapornaSirka', zavaznost: 'chyba', zprava: `Záporná šířka (${g.sirka}).`, oprava: 'opravSirku' });
      if (prazdny && uni.length && !uni.some(jeMezera)) pridej({ glyf: nazev, druh: 'prazdny', zavaznost: 'info', zprava: 'Glyf má Unicode, ale nemá žádný tvar.' });
      if (!prazdny && g.sirka === 0 && !kombinacni && g.obrysy.length) pridej({ glyf: nazev, druh: 'nulovaSirka', zavaznost: 'varovani', zprava: 'Glyf s obrysy má šířku 0.', oprava: 'opravSirku' });

      /* komponenty */
      (g.komponenty || []).forEach((k, i) => {
        if (!font.glyfy[k.glyf]) pridej({ glyf: nazev, druh: 'komponenta', zavaznost: 'chyba', zprava: `Komponenta odkazuje na chybějící glyf „${k.glyf}“.`, oprava: 'smazKomponentu', data: { index: i } });
      });
      if ((g.komponenty || []).length) {
        const cyk = najdiCyklus(font, nazev);
        if (cyk) pridej({ glyf: nazev, druh: 'cyklus', zavaznost: 'chyba', zprava: `Cyklus komponent: ${cyk.join(' → ')}.`, oprava: 'smazKomponentu', data: { index: g.komponenty.findIndex(k => k.glyf === cyk[1]) } });
      }

      /* svislé meze */
      if (!prazdny && chci('mimoMeze')) {
        const o = bezpecnaObalka(font, g);
        if (o && (o.y1 > info.ascender + 0.2 * upm || o.y0 < info.descender - 0.2 * upm))
          pridej({ glyf: nazev, druh: 'mimoMeze', zavaznost: 'varovani', zprava: `Glyf přesahuje svislé meze (${Math.round(o.y0)} až ${Math.round(o.y1)}).`, x: (o.x0 + o.x1) / 2, y: o.y1 > info.ascender + 0.2 * upm ? o.y1 : o.y0 });
      }

      /* body celkem */
      const bodu = g.obrysy.reduce((s, o) => s + o.body.length, 0);
      if (bodu > 1500) pridej({ glyf: nazev, druh: 'mnohoBodu', zavaznost: 'varovani', zprava: `Příliš mnoho bodů (${bodu}).`, oprava: 'zjednodus' });

      /* neceločíselné souřadnice (jen body na křivce – řídicí body přesně převedených
         kvadratik z TrueType jsou zlomkové oprávněně a export je stejně zaokrouhlí) */
      if (chci('necelociselne')) {
        let nec = null;
        for (let oi = 0; oi < g.obrysy.length && !nec; oi++) g.obrysy[oi].body.forEach((b, bi) => { if (!nec && b.t !== 'o' && (b.x !== Math.round(b.x) || b.y !== Math.round(b.y))) nec = { oi, bi, b }; });
        if (!nec) for (const a of g.kotvy || []) if (a.x !== Math.round(a.x) || a.y !== Math.round(a.y)) { nec = { oi: undefined, bi: undefined, b: a }; break; }
        if (!nec && g.sirka !== Math.round(g.sirka)) nec = { b: { x: g.sirka, y: 0 } };
        if (nec) pridej({ glyf: nazev, druh: 'necelociselne', zavaznost: 'info', zprava: 'Neceločíselné souřadnice.', obrys: nec.oi, bod: nec.bi, x: nec.b.x, y: nec.b.y, oprava: 'zaokrouhli' });
      }

      /* obrysy */
      const pols = [];
      g.obrysy.forEach((o, oi) => {
        const b = o.body;
        pols[oi] = null;
        if (o.otevreny) pridej({ glyf: nazev, druh: 'otevreny', zavaznost: 'chyba', zprava: 'Otevřený obrys.', obrys: oi, x: b[0] && b[0].x, y: b[0] && b[0].y, oprava: 'uzavri' });
        const naKrivce = b.filter(p => p.t !== 'o').length;
        if (b.length < 3 || naKrivce < 2) {
          pridej({ glyf: nazev, druh: 'malyObrys', zavaznost: 'chyba', zprava: `Obrys má jen ${b.length} ${b.length === 1 ? 'bod' : 'body'}.`, obrys: oi, x: b[0] && b[0].x, y: b[0] && b[0].y, oprava: 'smazObrys' });
          return;
        }
        const pol = P.zplostni(o, 0.5);
        pols[oi] = pol;
        const sp = chci('samopruniky') || !o.otevreny ? samopruniky(pol, !o.otevreny, 1) : [];
        if (!o.otevreny && Math.abs(P.plochaMnohouhelniku(pol)) < 1 && !sp.length) {
          pridej({ glyf: nazev, druh: 'malyObrys', zavaznost: 'chyba', zprava: 'Obrys má nulovou plochu.', obrys: oi, x: b[0].x, y: b[0].y, oprava: 'smazObrys' });
          pols[oi] = null;
          return;
        }
        if (chci('extremy')) {
          const ex = chybejiciExtremy(o);
          if (ex.length) pridej({ glyf: nazev, druh: 'extremy', zavaznost: 'varovani', zprava: `Chybí ${ex.length === 1 ? 'bod' : ex.length + ' body'} na extrémech.`, obrys: oi, x: ex[0].x, y: ex[0].y, oprava: 'pridejExtremy' });
        }
        if (chci('blizkeBody') || chci('zbytecnyBod')) kontrolaBodu(o).forEach(z => pridej(Object.assign({ glyf: nazev, obrys: oi }, z)));
        if (chci('samopruniky')) {
          if (sp.length) pridej({ glyf: nazev, druh: 'samopruniky', zavaznost: 'chyba', zprava: 'Obrys protíná sám sebe.', obrys: oi, x: sp[0].x, y: sp[0].y, oprava: 'sjednot' });
        }
      });

      /* překryvy obrysů a směr */
      const uz = g.obrysy.map((o, i) => (!o.otevreny && pols[i]) ? i : -1).filter(i => i >= 0);
      const obal = []; for (const i of uz) obal[i] = obalkaPol(pols[i]);
      const protinajici = new Set();
      if (chci('prekryv') || chci('smer')) {
        for (let a = 0; a < uz.length; a++) for (let c = a + 1; c < uz.length; c++) {
          const i = uz[a], j = uz[c];
          if (!prekryvObalek(obal[i], obal[j])) continue;
          const p = prunikDvou(pols[i], pols[j]);
          if (p) {
            protinajici.add(i); protinajici.add(j);
            pridej({ glyf: nazev, druh: 'prekryv', zavaznost: 'varovani', zprava: `Obrysy ${i + 1} a ${j + 1} se překrývají (lze sjednotit).`, obrys: i, x: p.x, y: p.y, oprava: 'sjednot', data: { obrysy: [i, j] } });
          }
        }
      }
      if (chci('smer')) {
        for (const i of uz) {
          if (protinajici.has(i)) continue;
          const hloubka = P.hloubkaVnoreni(pols, uz, i);
          const chciPoSmeru = hloubka % 2 === 0, jePoSmeru = P.plochaMnohouhelniku(pols[i]) < 0;
          if (jePoSmeru !== chciPoSmeru) {
            const b0 = g.obrysy[i].body[0];
            pridej({ glyf: nazev, druh: 'smer', zavaznost: 'varovani', zprava: chciPoSmeru ? 'Vnější obrys jde proti směru hodinových ručiček.' : 'Díra jde po směru hodinových ručiček.', obrys: i, x: b0.x, y: b0.y, oprava: 'opravSmer' });
          }
        }
      }
    }

    /* ---------- kerning a skupiny ---------- */
    const existuje = n => n.charAt(0) === '@' ? !!(font.skupiny || {})[n] : !!font.glyfy[n];
    for (const l in font.kerning || {}) {
      if (!existuje(l)) { pridej({ glyf: null, druh: 'kerning', zavaznost: 'varovani', zprava: `Kerning odkazuje na neexistující ${l.charAt(0) === '@' ? 'skupinu' : 'glyf'} „${l}“.`, oprava: 'smazKerning', data: { l } }); continue; }
      for (const r in font.kerning[l]) if (!existuje(r))
        pridej({ glyf: null, druh: 'kerning', zavaznost: 'varovani', zprava: `Kerning „${l}“ – „${r}“: „${r}“ neexistuje.`, oprava: 'smazKerning', data: { l, r } });
    }
    for (const s in font.skupiny || {}) {
      const chybi = font.skupiny[s].filter(n => !font.glyfy[n]);
      if (chybi.length) pridej({ glyf: null, druh: 'kerning', zavaznost: 'varovani', zprava: `Skupina ${s} obsahuje neexistující glyfy: ${chybi.join(', ')}.`, oprava: 'vycistiSkupinu', data: { skupina: s } });
    }
    (font.ligatury || []).forEach((l, i) => {
      const chybi = l.z.concat([l.na]).filter(n => !font.glyfy[n]);
      if (chybi.length) pridej({ glyf: font.glyfy[l.na] ? l.na : null, druh: 'ligatura', zavaznost: 'chyba', zprava: `Ligatura ${l.z.join('+')} → ${l.na}: chybí ${chybi.join(', ')}.`, oprava: 'smazLigaturu', data: { index: i, z: l.z.slice(), na: l.na } });
    });
    return out;
  };

  function bezpecnaObalka(font, g) {
    try { return P.obalkaGlyfu(font, g); } catch (e) { return null; }
  }

  function najdiCyklus(font, start) {
    const cesta = [start];
    const navst = new Set();
    function dfs(n) {
      const g = font.glyfy[n];
      if (!g) return null;
      for (const k of g.komponenty || []) {
        if (k.glyf === start) return cesta.concat([start]);
        if (navst.has(k.glyf)) continue;
        navst.add(k.glyf);
        cesta.push(k.glyf);
        const r = dfs(k.glyf);
        if (r) return r;
        cesta.pop();
      }
      return null;
    }
    return dfs(start);
  }

  /* Extrémy kubik, které vybočují za koncové body o víc než 0,5 (stejně jako P.pridejExtremy). */
  function chybejiciExtremy(o) {
    const out = [];
    for (const s of P.segmenty(o)) {
      if (s.typ !== 'c') continue;
      for (const t of P.extremyKubiky(s)) {
        if (t <= 0.02 || t >= 0.98) continue;
        const p = P.kubika(s.p0, s.p1, s.p2, s.p3, t);
        const venku = p.x < Math.min(s.p0.x, s.p3.x) - 0.5 || p.x > Math.max(s.p0.x, s.p3.x) + 0.5 ||
          p.y < Math.min(s.p0.y, s.p3.y) - 0.5 || p.y > Math.max(s.p0.y, s.p3.y) + 0.5;
        if (venku) out.push(p);
      }
    }
    return out;
  }

  /* Body na křivce skoro totožné (< 1 jednotka) a zbytečné body uprostřed přímky. */
  function kontrolaBodu(o) {
    const out = [], b = o.body, n = b.length;
    const naKrivce = [];
    for (let i = 0; i < n; i++) if (b[i].t !== 'o') naKrivce.push(i);
    const m = naKrivce.length;
    let blizke = null, zbytecny = null;
    for (let k = 0; k < m; k++) {
      if (o.otevreny && k === m - 1) break;
      const i = naKrivce[k], j = naKrivce[(k + 1) % m];
      if (i === j) continue;
      const d = Math.hypot(b[j].x - b[i].x, b[j].y - b[i].y);
      // řídicí body mezi nimi také blízko → opravdu zbytečný segment
      let ridiciDaleko = false;
      for (let q = (i + 1) % n; q !== j; q = (q + 1) % n) if (Math.hypot(b[q].x - b[i].x, b[q].y - b[i].y) > 1) ridiciDaleko = true;
      if (d < 1 && !ridiciDaleko && !blizke) blizke = { druh: 'blizkeBody', zavaznost: 'varovani', zprava: `Body ${i + 1} a ${j + 1} jsou skoro totožné (${d.toFixed(2)}).`, bod: j, x: b[j].x, y: b[j].y, oprava: 'vycisti' };
    }
    for (let k = 0; k < m; k++) {
      if (o.otevreny && (k === 0 || k === m - 1)) continue;
      const i = naKrivce[k], p = naKrivce[(k - 1 + m) % m], q = naKrivce[(k + 1) % m];
      if (b[i].t !== 'l' || ((i + 1) % n) !== q || b[q].t !== 'l') continue;   // úsečka do i a z i
      if (((p + 1) % n) !== i) continue;
      const A = b[p], B = b[i], C = b[q];
      if (Math.hypot(C.x - A.x, C.y - A.y) < 1e-9) continue;
      const dist = P.vzdalOdPrimky(B, A, C);
      const dx = C.x - A.x, dy = C.y - A.y, t = ((B.x - A.x) * dx + (B.y - A.y) * dy) / (dx * dx + dy * dy);
      if (dist < 0.5 && t > 0 && t < 1 && !zbytecny) zbytecny = { druh: 'zbytecnyBod', zavaznost: 'info', zprava: `Bod ${i + 1} leží na přímce mezi sousedy (zbytečný).`, bod: i, x: B.x, y: B.y, oprava: 'vycisti' };
    }
    if (blizke) out.push(blizke);
    if (zbytecny) out.push(zbytecny);
    return out;
  }

  /* Provede opravu nálezu. Vrací true, když se něco změnilo.
     Po opravě je vhodné spustit kontrolu znovu (indexy obrysů se mohou posunout). */
  P.opravNalez = function (font, nalez) {
    if (!nalez || !nalez.oprava) return false;
    const g = nalez.glyf ? font.glyfy[nalez.glyf] : null;
    const o = g && nalez.obrys != null ? g.obrysy[nalez.obrys] : null;
    const d = nalez.data || {};
    switch (nalez.oprava) {
      case 'opravSmer': return !!g && P.opravSmer(g.obrysy) > 0;
      case 'pridejExtremy': {
        if (!o) return false;
        if (P.pridejExtremyGlyf) return P.pridejExtremyGlyf(g, [nalez.obrys]) > 0;
        return P.pridejExtremy(o) > 0;
      }
      case 'zaokrouhli': {
        if (!g) return false;
        if (P.zaokrouhliGlyf) return P.zaokrouhliGlyf(g) > 0;
        for (const ob of g.obrysy) P.zaokrouhli(ob, 1);
        return true;
      }
      case 'uzavri': {
        if (!o || !o.otevreny) return false;
        delete o.otevreny;
        if (o.body.length > 1) {
          const a = o.body[0], z = o.body[o.body.length - 1];
          if (Math.hypot(a.x - z.x, a.y - z.y) < 1e-6 && z.t !== 'o') { a.t = z.t; o.body.pop(); }
          else if (a.t !== 'o') a.t = 'l';
        }
        return true;
      }
      case 'vycisti': {
        if (!o) return false;
        const pred = o.body.length;
        P.vycisti(o, 0.5);
        // vycisti nemaže krátké úsečky – skoro totožné body spojit ručně
        const b = o.body;
        for (let i = 0; i < b.length && b.length > 3; i++) {
          const j = (i + 1) % b.length;
          if (b[i].t !== 'o' && b[j].t === 'l' && Math.hypot(b[j].x - b[i].x, b[j].y - b[i].y) < 1) { b.splice(j, 1); i--; }
        }
        return o.body.length !== pred;
      }
      case 'smazBod': {
        if (!o || nalez.bod == null) return false;
        return smazBod(o, nalez.bod);
      }
      case 'smazObrys': {
        if (!g || nalez.obrys == null || !g.obrysy[nalez.obrys]) return false;
        g.obrysy.splice(nalez.obrys, 1);
        return true;
      }
      case 'sjednot': {
        if (!g || !P.sjednot) return false;
        P.sjednot(g, d.obrysy || null);
        return true;
      }
      case 'zjednodus': return !!g && !!P.zjednodusGlyf && P.zjednodusGlyf(g, 1) > 0;
      case 'opravSirku': {
        if (!g) return false;
        const ob = P.obalkaGlyfu(font, g);
        g.sirka = ob ? Math.max(0, Math.round(ob.x1 + Math.max(0, ob.x0))) : 0;
        return true;
      }
      case 'smazKomponentu': {
        if (!g || d.index == null || d.index < 0 || !g.komponenty[d.index]) return false;
        g.komponenty.splice(d.index, 1);
        return true;
      }
      case 'zrusUnicode': {
        if (!g) return false;
        const i = g.uni.indexOf(d.uni);
        if (i < 0) return false;
        g.uni.splice(i, 1);
        return true;
      }
      case 'prejmenuj': {
        if (!g) return false;
        let n = nalez.glyf.replace(/[^A-Za-z0-9._]/g, '_');
        if (/^[0-9]/.test(n)) n = '_' + n;
        n = n.slice(0, 60) || 'glyf';
        n = P.volnyNazev(font, n);
        return P.prejmenujGlyf(font, nalez.glyf, n);
      }
      case 'vytvorGlyf': {
        if (nalez.glyf === '.notdef') { P.normalizuj(font); return !!font.glyfy['.notdef']; }
        if (nalez.glyf === 'space') {
          if (font.glyfy.space) { if (font.glyfy.space.uni.indexOf(0x20) < 0) font.glyfy.space.uni.push(0x20); return true; }
          P.pridejGlyf(font, P.novyGlyf('space', 0x20, Math.round(font.info.upm * 0.25)));
          return true;
        }
        return false;
      }
      case 'sestavAkcenty': {
        if (!P.sestavAkcenty) return false;
        return P.sestavAkcenty(font, d.nazvy || null).length > 0;
      }
      case 'opravDescender': font.info.descender = -Math.abs(font.info.descender); return true;
      case 'srovnejMezery': {
        const m = P.cmap(font);
        const a = font.glyfy[m.get(0x20)], b = font.glyfy[m.get(0xA0)];
        if (!a || !b) return false;
        b.sirka = a.sirka; return true;
      }
      case 'smazKerning': {
        if (d.r == null) { delete font.kerning[d.l]; return true; }
        if (!font.kerning[d.l]) return false;
        delete font.kerning[d.l][d.r];
        if (!Object.keys(font.kerning[d.l]).length) delete font.kerning[d.l];
        return true;
      }
      case 'vycistiSkupinu': {
        const s = font.skupiny[d.skupina];
        if (!s) return false;
        font.skupiny[d.skupina] = s.filter(n => font.glyfy[n]);
        return true;
      }
      case 'smazLigaturu': {
        const i = font.ligatury.findIndex(l => l.na === d.na && l.z.join(' ') === (d.z || []).join(' '));
        if (i < 0) return false;
        font.ligatury.splice(i, 1);
        return true;
      }
    }
    return false;
  };

  /* Smaže bod na křivce. Mezi dvěma kubikami zůstanou vnější řídicí body (o1 o2 P o3 o4 → o1 o4),
     kubika + úsečka se spojí do kubiky, dvě úsečky do jedné. */
  function smazBod(o, i) {
    const b = o.body, n = b.length;
    if (i < 0 || i >= n || b[i].t === 'o') return false;
    if (b.filter(p => p.t !== 'o').length <= 2) return false;
    const k = d => ((i + d) % n + n) % n;
    let pryc, naKubiku = null;
    if (b[k(-1)].t === 'o' && b[k(1)].t === 'o') {
      if (b[k(-2)].t !== 'o' || b[k(2)].t !== 'o') return false;
      pryc = new Set([k(-1), i, k(1)]);
    } else if (b[k(-1)].t === 'o') {
      pryc = new Set([i]);
      naKubiku = k(1);   // řídicí body před P teď vedou rovnou do dalšího bodu
    } else {
      pryc = new Set([i]);
    }
    if (n - pryc.size < 3) return false;
    if (naKubiku != null) b[naKubiku].t = 'c';
    o.body = b.filter((_, q) => !pryc.has(q));
    return true;
  }
})(typeof window !== 'undefined' ? window : globalThis);
