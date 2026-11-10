/* CSS hřiště – Flexbox, Grid, časovací křivky, keyframes. Jádro bez DOM (test: _test/css_hriste_test.js).
   Model nastavení → CSS + HTML kostra, sdílení přes hash (base64url JSON), vyhodnocení cubic-bezier/steps/linear(). */
(function () {
  'use strict';
  const VERZE = 1;
  const KLIC = 'webapp_css_hriste';
  const kopie = o => JSON.parse(JSON.stringify(o));
  const omez = (v, a, b, vych) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : vych; };
  const cislo = v => String(Math.round(v * 1000) / 1000);
  const zKeho = (v, seznam, vych) => (seznam.includes(v) ? v : vych);

  /* ---------- povolené hodnoty ---------- */
  const FLEX = {
    direction: ['row', 'row-reverse', 'column', 'column-reverse'],
    wrap: ['nowrap', 'wrap', 'wrap-reverse'],
    justify: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
    alignItems: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
    alignContent: ['normal', 'stretch', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
    alignSelf: ['auto', 'stretch', 'flex-start', 'center', 'flex-end', 'baseline']
  };
  const GRID = {
    items: ['stretch', 'start', 'center', 'end'],
    content: ['normal', 'start', 'center', 'end', 'stretch', 'space-between', 'space-around', 'space-evenly'],
    druhy: ['fr', 'px', '%', 'auto', 'minmax', 'repeat'],
    kolik: ['auto-fill', 'auto-fit']
  };
  const STEPS_POZICE = ['jump-end', 'jump-start', 'jump-none', 'jump-both', 'start', 'end'];
  const ANIM = {
    smer: ['normal', 'reverse', 'alternate', 'alternate-reverse'],
    fill: ['none', 'forwards', 'backwards', 'both']
  };

  /* ---------- validace délek ---------- */
  // délka pro gap, flex-basis, minmax: číslo + jednotka, 0, auto, min-content/max-content (fr jen kde dovoleno)
  function delka(s, volby) {
    volby = volby || {};
    s = String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, '');
    if (s === '0') return '0';
    if (/^(auto|min-content|max-content)$/.test(s)) return volby.bezAuto ? null : s;
    const m = /^(\d+(?:\.\d+)?|\.\d+)(px|%|fr|em|rem|vw|vh|ch)?$/.exec(s);
    if (!m) return null;
    const j = m[2] || (volby.bezJednotky || 'px');
    if (j === 'fr' && !volby.fr) return null;
    return Number(m[1]) + j;
  }
  const jeIdent = s => /^[\p{L}_][\p{L}\p{N}_-]*$/u.test(String(s || '')) && !/^(auto|span|inherit|initial|unset|none)$/i.test(s);

  /* ---------- výchozí stav a normalizace ---------- */
  const vychPolozkaFlex = () => ({ grow: 0, shrink: 1, basis: 'auto', order: 0, alignSelf: 'auto' });
  const vychPolozkaGrid = () => ({ oblast: '', sloupec: 0, radek: 0, sSpan: 1, rSpan: 1 });
  function vychozi() {
    return {
      verze: VERZE, rezim: 'flex', sirka: 800,
      flex: {
        direction: 'row', wrap: 'nowrap', justify: 'flex-start', alignItems: 'stretch', alignContent: 'normal', gap: '10px',
        polozky: [vychPolozkaFlex(), vychPolozkaFlex(), vychPolozkaFlex()], vybrana: 0
      },
      grid: {
        sloupce: [{ druh: 'px', h: 180 }, { druh: 'fr', h: 1 }],
        radky: [{ druh: 'auto' }, { druh: 'fr', h: 1 }, { druh: 'auto' }],
        gapR: '10px', gapS: '10px',
        justifyItems: 'stretch', alignItems: 'stretch', justifyContent: 'normal', alignContent: 'normal',
        oblasti: [{ nazev: 'hlavicka', r1: 1, s1: 1, r2: 1, s2: 2 }, { nazev: 'menu', r1: 2, s1: 1, r2: 2, s2: 1 },
          { nazev: 'obsah', r1: 2, s1: 2, r2: 2, s2: 2 }, { nazev: 'paticka', r1: 3, s1: 1, r2: 3, s2: 2 }],
        polozky: ['hlavicka', 'menu', 'obsah', 'paticka'].map(o => Object.assign(vychPolozkaGrid(), { oblast: o })), vybrana: 0
      },
      krivky: {
        a: { typ: 'bezier', b: [0.25, 0.1, 0.25, 1], n: 4, pozice: 'jump-end', linear: '0, 0.25 40%, 1' },
        b: { typ: 'bezier', b: [0.34, 1.56, 0.64, 1], n: 4, pozice: 'jump-end', linear: '0, 1' },
        porovnat: true, aktivni: 'a', delka: 1000
      },
      anim: {
        od: { x: 0, y: 0, r: 0, s: 1, o: 1 }, do: { x: 200, y: 0, r: 180, s: 1.2, o: 0.4 },
        delka: 1200, zpozdeni: 0, iterace: 'infinite', smer: 'alternate', fill: 'both', casovani: 'ease-in-out'
      }
    };
  }

  function normStopa(s) {
    s = s || {}; const d = zKeho(s.druh, GRID.druhy, 'fr');
    if (d === 'fr') return { druh: d, h: omez(s.h, 0, 100, 1) };
    if (d === 'px') return { druh: d, h: omez(s.h, 0, 5000, 100) };
    if (d === '%') return { druh: d, h: omez(s.h, 0, 100, 25) };
    if (d === 'auto') return { druh: d };
    const r = { druh: d, min: delka(s.min, { fr: false }) || (d === 'repeat' ? '' : '100px'), max: delka(s.max, { fr: true }) || '1fr' };
    if (d === 'repeat') {
      if (String(s.min || '').trim() === '') r.min = '';
      r.kolik = GRID.kolik.includes(s.kolik) ? s.kolik : Math.round(omez(s.kolik, 1, 50, 3));
    }
    return r;
  }
  function normKrivka(k, vych) {
    k = k || {};
    const b = Array.isArray(k.b) && k.b.length === 4 ? k.b.map((v, i) => omez(v, i % 2 ? -5 : 0, i % 2 ? 5 : 1, vych.b[i])) : vych.b.slice();
    return {
      typ: zKeho(k.typ, ['bezier', 'steps', 'linear'], 'bezier'), b,
      n: Math.round(omez(k.n, 1, 100, 4)), pozice: zKeho(k.pozice, STEPS_POZICE, 'jump-end'),
      linear: typeof k.linear === 'string' && parsujLinear(k.linear) ? k.linear.slice(0, 2000) : vych.linear
    };
  }
  function normTransform(t, v) {
    t = t || {};
    return { x: omez(t.x, -2000, 2000, v.x), y: omez(t.y, -2000, 2000, v.y), r: omez(t.r, -3600, 3600, v.r), s: omez(t.s, 0, 10, v.s), o: omez(t.o, 0, 1, v.o) };
  }
  // vstup z hashe, localStorage nebo importu → vždy platný stav (neznámé zahodí, chybné nahradí výchozím)
  function normalizuj(s) {
    const V = vychozi(); s = s && typeof s === 'object' ? s : {};
    const f = s.flex || {}, g = s.grid || {}, k = s.krivky || {}, a = s.anim || {};
    const flexPol = (Array.isArray(f.polozky) ? f.polozky : V.flex.polozky).slice(0, 40).map(p => {
      p = p || {};
      return { grow: omez(p.grow, 0, 100, 0), shrink: omez(p.shrink, 0, 100, 1), basis: delka(p.basis) || 'auto',
        order: Math.round(omez(p.order, -99, 99, 0)), alignSelf: zKeho(p.alignSelf, FLEX.alignSelf, 'auto') };
    });
    const oblasti = (Array.isArray(g.oblasti) ? g.oblasti : V.grid.oblasti).filter(o => o && jeIdent(o.nazev)).slice(0, 40).map(o => {
      const r1 = Math.round(omez(o.r1, 1, 50, 1)), s1 = Math.round(omez(o.s1, 1, 50, 1));
      return { nazev: String(o.nazev), r1, s1, r2: Math.round(omez(o.r2, r1, 50, r1)), s2: Math.round(omez(o.s2, s1, 50, s1)) };
    });
    const gridPol = (Array.isArray(g.polozky) ? g.polozky : V.grid.polozky).slice(0, 60).map(p => {
      p = p || {};
      return { oblast: jeIdent(p.oblast) ? String(p.oblast) : '', sloupec: Math.round(omez(p.sloupec, -50, 50, 0)), radek: Math.round(omez(p.radek, -50, 50, 0)),
        sSpan: Math.round(omez(p.sSpan, 1, 50, 1)), rSpan: Math.round(omez(p.rSpan, 1, 50, 1)) };
    });
    const stopy = (x, v) => (Array.isArray(x) ? x : v).slice(0, 30).map(normStopa);
    return {
      verze: VERZE, rezim: zKeho(s.rezim, ['flex', 'grid', 'krivky', 'anim'], 'flex'), sirka: Math.round(omez(s.sirka, 320, 1200, 800)),
      flex: {
        direction: zKeho(f.direction, FLEX.direction, 'row'), wrap: zKeho(f.wrap, FLEX.wrap, 'nowrap'), justify: zKeho(f.justify, FLEX.justify, 'flex-start'),
        alignItems: zKeho(f.alignItems, FLEX.alignItems, 'stretch'), alignContent: zKeho(f.alignContent, FLEX.alignContent, 'normal'),
        gap: delka(f.gap, { bezAuto: true }) || '0', polozky: flexPol, vybrana: Math.round(omez(f.vybrana, 0, Math.max(0, flexPol.length - 1), 0))
      },
      grid: {
        sloupce: stopy(g.sloupce, V.grid.sloupce), radky: stopy(g.radky, []),
        gapR: delka(g.gapR, { bezAuto: true }) || '0', gapS: delka(g.gapS, { bezAuto: true }) || '0',
        justifyItems: zKeho(g.justifyItems, GRID.items, 'stretch'), alignItems: zKeho(g.alignItems, GRID.items, 'stretch'),
        justifyContent: zKeho(g.justifyContent, GRID.content, 'normal'), alignContent: zKeho(g.alignContent, GRID.content, 'normal'),
        oblasti, polozky: gridPol, vybrana: Math.round(omez(g.vybrana, 0, Math.max(0, gridPol.length - 1), 0))
      },
      krivky: {
        a: normKrivka(k.a, V.krivky.a), b: normKrivka(k.b, V.krivky.b), porovnat: k.porovnat !== false,
        aktivni: k.aktivni === 'b' ? 'b' : 'a', delka: Math.round(omez(k.delka, 100, 10000, 1000))
      },
      anim: {
        od: normTransform(a.od, V.anim.od), do: normTransform(a.do, V.anim.do),
        delka: Math.round(omez(a.delka, 50, 20000, 1200)), zpozdeni: Math.round(omez(a.zpozdeni, -20000, 20000, 0)),
        iterace: a.iterace === 'infinite' ? 'infinite' : omez(a.iterace, 0, 1000, 1),
        smer: zKeho(a.smer, ANIM.smer, 'normal'), fill: zKeho(a.fill, ANIM.fill, 'none'),
        casovani: typeof a.casovani === 'string' && (a.casovani === 'krivka' || PRESETY.some(p => p.css === a.casovani || p.nazev === a.casovani)) ? a.casovani : 'ease'
      }
    };
  }

  /* ---------- hash: base64url(JSON) ---------- */
  function b64url(text) {
    const b = new TextEncoder().encode(text); let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function zB64url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    const bin = atob(s), b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(b);
  }
  const doHashe = stav => 's=' + b64url(JSON.stringify(normalizuj(stav)));
  // vrací normalizovaný stav nebo null (hash prázdný/poškozený)
  function zHashe(hash) {
    const m = /(?:^|[#&])s=([A-Za-z0-9_-]+)/.exec(String(hash || ''));
    if (!m) return null;
    try { return normalizuj(JSON.parse(zB64url(m[1]))); } catch (e) { return null; }
  }

  /* ---------- Flexbox ---------- */
  // které osy jsou vodorovně/svisle a kterým směrem míří (pro šipky v náhledu)
  function osyFlex(direction, wrap) {
    const radek = direction.startsWith('row'), obr = direction.endsWith('reverse'), wr = wrap === 'wrap-reverse';
    return radek
      ? { vodorovna: { osa: 'hlavní', obracene: obr }, svisla: { osa: 'příčná', obracene: wr } }
      : { vodorovna: { osa: 'příčná', obracene: wr }, svisla: { osa: 'hlavní', obracene: obr } };
  }
  function cssFlex(f) {
    const r = ['.kontejner {', '  display: flex;', `  flex-direction: ${f.direction};`, `  flex-wrap: ${f.wrap};`,
      `  justify-content: ${f.justify};`, `  align-items: ${f.alignItems};`];
    if (f.alignContent !== 'normal') r.push(`  align-content: ${f.alignContent};`);
    if (f.gap !== '0') r.push(`  gap: ${f.gap};`);
    r.push('}');
    f.polozky.forEach((p, i) => {
      const v = [];
      if (p.grow !== 0 || p.shrink !== 1 || p.basis !== 'auto') v.push(`  flex: ${cislo(p.grow)} ${cislo(p.shrink)} ${p.basis};`);
      if (p.order) v.push(`  order: ${p.order};`);
      if (p.alignSelf !== 'auto') v.push(`  align-self: ${p.alignSelf};`);
      if (v.length) r.push('', `.polozka:nth-child(${i + 1}) {`, ...v, '}');
    });
    const html = ['<div class="kontejner">', ...f.polozky.map((p, i) => `  <div class="polozka">${i + 1}</div>`), '</div>'].join('\n');
    return { css: r.join('\n'), html };
  }

  /* ---------- Grid ---------- */
  function stopaCss(s) {
    if (s.druh === 'fr') return cislo(s.h) + 'fr';
    if (s.druh === 'px') return cislo(s.h) + 'px';
    if (s.druh === '%') return cislo(s.h) + '%';
    if (s.druh === 'auto') return 'auto';
    if (s.druh === 'minmax') return `minmax(${s.min}, ${s.max})`;
    return `repeat(${s.kolik}, ${s.min ? `minmax(${s.min}, ${s.max})` : s.max})`;
  }
  const sablona = stopy => (stopy.length ? stopy.map(stopaCss).join(' ') : 'none');
  // počet explicitních stop; null = repeat(auto-fill/auto-fit), počet určí až prohlížeč
  function pocetStop(stopy) {
    let n = 0;
    for (const s of stopy) { if (s.druh !== 'repeat') n++; else if (typeof s.kolik === 'number') n += s.kolik; else return null; }
    return n;
  }
  function prekryv(a, b) { return a.r1 <= b.r2 && b.r1 <= a.r2 && a.s1 <= b.s2 && b.s1 <= a.s2; }
  // přidá/nahradí oblast; vrací { oblasti } nebo { chyba }
  function pridejOblast(oblasti, nova) {
    const n = { nazev: String(nova.nazev || '').trim(), r1: Math.min(nova.r1, nova.r2), r2: Math.max(nova.r1, nova.r2), s1: Math.min(nova.s1, nova.s2), s2: Math.max(nova.s1, nova.s2) };
    if (!jeIdent(n.nazev)) return { chyba: 'Název oblasti musí začínat písmenem a obsahovat jen písmena, číslice, - a _ (ne auto, span, none).' };
    const zbytek = oblasti.filter(o => o.nazev !== n.nazev);
    const kolize = zbytek.find(o => prekryv(o, n));
    if (kolize) return { chyba: `Oblast se překrývá s oblastí „${kolize.nazev}“. Oblasti musí být obdélníky bez překryvu.` };
    return { oblasti: zbytek.concat([n]) };
  }
  // řádky grid-template-areas pro explicitní mřížku nR×nS (oblasti mimo mřížku vynechá)
  function sablonaOblasti(oblasti, nR, nS) {
    if (!nR || !nS) return [];
    const m = Array.from({ length: nR }, () => Array(nS).fill('.'));
    let nejaka = false;
    oblasti.forEach(o => {
      if (o.r2 > nR || o.s2 > nS) return;
      nejaka = true;
      for (let r = o.r1; r <= o.r2; r++) for (let s = o.s1; s <= o.s2; s++) m[r - 1][s - 1] = o.nazev;
    });
    if (!nejaka) return [];
    const sirky = Array.from({ length: nS }, (_, s) => Math.max(...m.map(r => r[s].length)));
    return m.map(r => '"' + r.map((x, s) => x.padEnd(sirky[s])).join(' ').trimEnd() + '"');
  }
  function umisteni(p, oblastiPlatne) {
    if (p.oblast && oblastiPlatne.includes(p.oblast)) return [`  grid-area: ${p.oblast};`];
    const v = [];
    const osa = (start, span) => (start ? (span > 1 ? `${start} / span ${span}` : String(start)) : (span > 1 ? `span ${span}` : ''));
    const s = osa(p.sloupec, p.sSpan), r = osa(p.radek, p.rSpan);
    if (s) v.push(`  grid-column: ${s};`);
    if (r) v.push(`  grid-row: ${r};`);
    return v;
  }
  function cssGrid(g) {
    const nS = pocetStop(g.sloupce), nR = pocetStop(g.radky);
    const r = ['.kontejner {', '  display: grid;', `  grid-template-columns: ${sablona(g.sloupce)};`];
    if (g.radky.length) r.push(`  grid-template-rows: ${sablona(g.radky)};`);
    const obl = sablonaOblasti(g.oblasti, nR, nS);
    const platne = obl.length ? g.oblasti.filter(o => o.r2 <= nR && o.s2 <= nS).map(o => o.nazev) : [];
    if (obl.length) r.push('  grid-template-areas:', ...obl.map((x, i) => '    ' + x + (i === obl.length - 1 ? ';' : '')));
    if (g.gapR === g.gapS) { if (g.gapR !== '0') r.push(`  gap: ${g.gapR};`); }
    else r.push(`  gap: ${g.gapR} ${g.gapS};`);
    if (g.justifyItems !== 'stretch') r.push(`  justify-items: ${g.justifyItems};`);
    if (g.alignItems !== 'stretch') r.push(`  align-items: ${g.alignItems};`);
    if (g.justifyContent !== 'normal') r.push(`  justify-content: ${g.justifyContent};`);
    if (g.alignContent !== 'normal') r.push(`  align-content: ${g.alignContent};`);
    r.push('}');
    g.polozky.forEach((p, i) => {
      const v = umisteni(p, platne);
      if (v.length) r.push('', `.polozka:nth-child(${i + 1}) {`, ...v, '}');
    });
    const html = ['<div class="kontejner">', ...g.polozky.map((p, i) => `  <div class="polozka">${p.oblast && platne.includes(p.oblast) ? p.oblast : i + 1}</div>`), '</div>'].join('\n');
    return { css: r.join('\n'), html, oblastiPlatne: platne, nR, nS };
  }
  // poloha stop v ose podle změřených velikostí (getComputedStyle → px), mezery a *-content zarovnání
  function polohyStop(velikosti, mezera, prostor, zarovnani) {
    const n = velikosti.length; if (!n) return [];
    const soucet = velikosti.reduce((a, b) => a + b, 0) + mezera * (n - 1);
    const volno = Math.max(0, prostor - soucet);
    let start = 0, extra = 0;
    if (zarovnani === 'end') start = volno;
    else if (zarovnani === 'center') start = volno / 2;
    else if (zarovnani === 'space-between') extra = n > 1 ? volno / (n - 1) : 0;
    else if (zarovnani === 'space-around') { extra = volno / n; start = extra / 2; }
    else if (zarovnani === 'space-evenly') { extra = volno / (n + 1); start = extra; }
    const r = []; let x = start;
    velikosti.forEach(v => { r.push({ od: x, do: x + v }); x += v + mezera + extra; });
    return r;
  }

  /* ---------- časovací funkce ---------- */
  // cubic-bezier(x1,y1,x2,y2) v bodě x: najde t (Newton, při neúspěchu bisekce), vrátí y(t)
  function bezier(x1, y1, x2, y2, x) {
    if (x <= 0) return x1 > 0 ? (y1 / x1) * x : (x2 > 0 ? (y2 / x2) * x : 0);
    if (x >= 1) return x2 < 1 ? 1 + ((y2 - 1) / (x2 - 1)) * (x - 1) : (x1 < 1 ? 1 + ((y1 - 1) / (x1 - 1)) * (x - 1) : 1);
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx, Y = t => ((ay * t + by) * t + cy) * t;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x; if (Math.abs(e) < 1e-7) return Y(t);
      const d = dX(t); if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let a = 0, b = 1; t = x;
    for (let i = 0; i < 60; i++) {
      const v = X(t); if (Math.abs(v - x) < 1e-7) break;
      if (v < x) a = t; else b = t;
      t = (a + b) / 2;
    }
    return Y(t);
  }
  function steps(n, pozice, x) {
    let k = Math.floor(x * n);
    if (pozice === 'jump-start' || pozice === 'start' || pozice === 'jump-both') k += 1;
    const skoky = pozice === 'jump-both' ? n + 1 : pozice === 'jump-none' ? n - 1 : n;
    if (x >= 0 && k < 0) k = 0;
    if (x <= 1 && k > skoky) k = skoky;
    return skoky > 0 ? k / skoky : (x < 1 ? 0 : 1);
  }
  // linear(0, 0.25 40%, 1) → body [{y, x}] s doplněnými polohami podle specifikace; null = chyba
  function parsujLinear(text) {
    const casti = String(text || '').replace(/^\s*linear\(|\)\s*$/g, '').split(',').map(s => s.trim()).filter(Boolean);
    if (casti.length < 2) return null;
    const body = [];
    for (const c of casti) {
      const t = c.split(/\s+/);
      if (t.length > 3) return null;
      const y = Number(t[0]); if (t[0] === '' || !Number.isFinite(y)) return null;
      const pol = t.slice(1).map(p => (/^-?\d+(\.\d+)?%$/.test(p) ? parseFloat(p) / 100 : NaN));
      if (pol.some(Number.isNaN)) return null;
      if (!pol.length) body.push({ y, x: null }); else pol.forEach(p => body.push({ y, x: p }));
    }
    if (body[0].x === null) body[0].x = 0;
    if (body[body.length - 1].x === null) body[body.length - 1].x = 1;
    let max = -Infinity;
    body.forEach(b => { if (b.x !== null) { b.x = Math.max(b.x, max); max = b.x; } });
    for (let i = 1; i < body.length; i++) {
      if (body[i].x !== null) continue;
      let j = i; while (body[j].x === null) j++;
      const a = body[i - 1].x, k = (body[j].x - a) / (j - i + 1);
      for (let q = i; q < j; q++) body[q].x = a + k * (q - i + 1);
    }
    return body;
  }
  function linearHodnota(body, x) {
    let i = body.findIndex(b => b.x > x);
    if (i === -1) i = body.length - 1;
    if (i === 0) i = 1;
    const a = body[i - 1], b = body[i];
    if (b.x === a.x) return x < a.x ? a.y : b.y;
    return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
  }
  function hodnota(k, x) {
    if (k.typ === 'steps') return steps(k.n, k.pozice, x);
    if (k.typ === 'linear') { const b = parsujLinear(k.linear); return b ? linearHodnota(b, x) : x; }
    return bezier(k.b[0], k.b[1], k.b[2], k.b[3], x);
  }
  // css text časovací funkce; klíčová slova místo stejných cubic-bezier
  function cssKrivka(k) {
    if (k.typ === 'steps') return `steps(${k.n}, ${k.pozice})`;
    if (k.typ === 'linear') { const b = parsujLinear(k.linear); return b ? 'linear(' + k.linear.replace(/^\s*linear\(|\)\s*$/g, '').split(',').map(s => s.trim().replace(/\s+/g, ' ')).join(', ') + ')' : 'linear'; }
    const kl = PRESETY.find(p => /^[a-z-]+$/.test(p.css) && p.b.every((v, i) => v === k.b[i]));
    return kl ? kl.css : `cubic-bezier(${k.b.map(cislo).join(', ')})`;
  }
  // vzorkování funkce do linear() (odraz, pružina…)
  function linearZFunkce(fn, n) {
    const r = [];
    for (let i = 0; i <= n; i++) { const x = i / n; r.push(cislo(fn(x)) + (i && i < n ? ' ' + cislo(x * 100) + '%' : '')); }
    return r.join(', ');
  }
  const odraz = x => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  };
  const pruzina = x => (x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(x * 4.5 * Math.PI));

  const PRESETY = [
    ['ease', 'ease', 0.25, 0.1, 0.25, 1], ['linear', 'linear', 0, 0, 1, 1], ['ease-in', 'ease-in', 0.42, 0, 1, 1],
    ['ease-out', 'ease-out', 0, 0, 0.58, 1], ['ease-in-out', 'ease-in-out', 0.42, 0, 0.58, 1],
    ['easeInSine', '', 0.12, 0, 0.39, 0], ['easeOutSine', '', 0.61, 1, 0.88, 1], ['easeInOutSine', '', 0.37, 0, 0.63, 1],
    ['easeInQuad', '', 0.11, 0, 0.5, 0], ['easeOutQuad', '', 0.5, 1, 0.89, 1], ['easeInOutQuad', '', 0.45, 0, 0.55, 1],
    ['easeInCubic', '', 0.32, 0, 0.67, 0], ['easeOutCubic', '', 0.33, 1, 0.68, 1], ['easeInOutCubic', '', 0.65, 0, 0.35, 1],
    ['easeInQuart', '', 0.5, 0, 0.75, 0], ['easeOutQuart', '', 0.25, 1, 0.5, 1], ['easeInOutQuart', '', 0.76, 0, 0.24, 1],
    ['easeInExpo', '', 0.7, 0, 0.84, 0], ['easeOutExpo', '', 0.16, 1, 0.3, 1], ['easeInOutExpo', '', 0.87, 0, 0.13, 1],
    ['easeInCirc', '', 0.55, 0, 1, 0.45], ['easeOutCirc', '', 0, 0.55, 0.45, 1], ['easeInOutCirc', '', 0.85, 0, 0.15, 1],
    ['easeInBack', '', 0.36, 0, 0.66, -0.56], ['easeOutBack', '', 0.34, 1.56, 0.64, 1], ['easeInOutBack', '', 0.68, -0.6, 0.32, 1.6]
  ].map(([nazev, css, ...b]) => ({ nazev, b, css: css || `cubic-bezier(${b.map(cislo).join(', ')})` }));
  const PRESETY_LINEAR = [
    { nazev: 'odraz (bounce)', linear: linearZFunkce(odraz, 40) },
    { nazev: 'pružina (spring)', linear: linearZFunkce(pruzina, 40) },
    { nazev: 'zpomalení po bodech', linear: '0, 0.6 25%, 0.85 50%, 0.96 75%, 1' }
  ];
  const casovaniCss = (anim, krivkaA) => {
    if (anim.casovani === 'krivka') return cssKrivka(krivkaA);
    const p = PRESETY.find(x => x.nazev === anim.casovani || x.css === anim.casovani);
    return p ? p.css : 'ease';
  };

  function cssKrivky(k) {
    const a = cssKrivka(k.a), r = ['.prvek {', `  transition: transform ${k.delka}ms ${a};`, '}', '.prvek:hover {', '  transform: translateX(200px);', '}', '',
      '/* totéž pro animaci */', '.prvek-animace {', `  animation-timing-function: ${a};`, '}'];
    if (k.porovnat) r.push('', '/* křivka B (porovnání) */', '.prvek-b {', `  transition: transform ${k.delka}ms ${cssKrivka(k.b)};`, '}');
    return { css: r.join('\n'), html: '<div class="prvek"></div>' + (k.porovnat ? '\n<div class="prvek prvek-b"></div>' : '') };
  }

  /* ---------- keyframes ---------- */
  const transformCss = t => `translate(${cislo(t.x)}px, ${cislo(t.y)}px) rotate(${cislo(t.r)}deg) scale(${cislo(t.s)})`;
  function cssKeyframes(a, krivkaA) {
    const r = ['@keyframes pohyb {', `  0%   { transform: ${transformCss(a.od)}; opacity: ${cislo(a.od.o)}; }`,
      `  100% { transform: ${transformCss(a.do)}; opacity: ${cislo(a.do.o)}; }`, '}', '', '.animace {',
      '  animation-name: pohyb;', `  animation-duration: ${a.delka}ms;`, `  animation-timing-function: ${casovaniCss(a, krivkaA)};`];
    if (a.zpozdeni) r.push(`  animation-delay: ${a.zpozdeni}ms;`);
    r.push(`  animation-iteration-count: ${a.iterace === 'infinite' ? 'infinite' : cislo(a.iterace)};`,
      `  animation-direction: ${a.smer};`, `  animation-fill-mode: ${a.fill};`, '}');
    return { css: r.join('\n'), html: '<div class="animace"></div>' };
  }

  function css(stav) {
    if (stav.rezim === 'grid') return cssGrid(stav.grid);
    if (stav.rezim === 'krivky') return cssKrivky(stav.krivky);
    if (stav.rezim === 'anim') return cssKeyframes(stav.anim, stav.krivky.a);
    return cssFlex(stav.flex);
  }

  /* ---------- ukázky ---------- */
  const UKAZKY = [
    { nazev: 'Vycentrovat jednu věc', rezim: 'flex', data: { justify: 'center', alignItems: 'center', polozky: [vychPolozkaFlex()] } },
    { nazev: 'Navigační lišta (logo vlevo, menu vpravo)', rezim: 'flex', data: { alignItems: 'center', gap: '16px', polozky: [vychPolozkaFlex(), Object.assign(vychPolozkaFlex(), { grow: 1 }), vychPolozkaFlex(), vychPolozkaFlex()] } },
    { nazev: 'Karty se zalomením', rezim: 'flex', data: { wrap: 'wrap', gap: '12px', polozky: Array.from({ length: 6 }, () => Object.assign(vychPolozkaFlex(), { grow: 1, basis: '200px' })) } },
    { nazev: 'Rozvržení stránky (hlavička, menu, obsah, patička)', rezim: 'grid', data: vychozi().grid },
    { nazev: 'Galerie repeat(auto-fill, minmax())', rezim: 'grid', data: { sloupce: [{ druh: 'repeat', kolik: 'auto-fill', min: '150px', max: '1fr' }], radky: [], gapR: '12px', gapS: '12px', oblasti: [], polozky: Array.from({ length: 7 }, vychPolozkaGrid) } },
    { nazev: '12 sloupců (obsah přes 8, boční panel přes 4)', rezim: 'grid', data: { sloupce: [{ druh: 'repeat', kolik: 12, min: '', max: '1fr' }], radky: [], gapR: '8px', gapS: '8px', oblasti: [],
      polozky: [Object.assign(vychPolozkaGrid(), { sSpan: 12 }), Object.assign(vychPolozkaGrid(), { sSpan: 8 }), Object.assign(vychPolozkaGrid(), { sSpan: 4 })] } }
  ];
  // použije ukázku/předvolbu na stav (vrací nový normalizovaný stav)
  function pouzij(stav, rezim, data) {
    const s = kopie(stav); s.rezim = rezim;
    const V = vychozi();
    s[rezim] = Object.assign({}, rezim === 'flex' || rezim === 'grid' ? V[rezim] : s[rezim], kopie(data));
    return normalizuj(s);
  }

  const API = {
    VERZE, KLIC, FLEX, GRID, STEPS_POZICE, ANIM, PRESETY, PRESETY_LINEAR, UKAZKY,
    vychozi, normalizuj, delka, jeIdent, vychPolozkaFlex, vychPolozkaGrid, normStopa,
    doHashe, zHashe, b64url, zB64url,
    osyFlex, cssFlex, stopaCss, sablona, pocetStop, pridejOblast, sablonaOblasti, cssGrid, polohyStop,
    bezier, steps, parsujLinear, linearHodnota, hodnota, cssKrivka, linearZFunkce, cssKrivky,
    transformCss, cssKeyframes, casovaniCss, css, pouzij
  };
  if (typeof module !== 'undefined') module.exports = API; else window.CssHristeJadro = API;
})();
