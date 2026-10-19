/* ============================================================
   mapa_souvislosti/formaty.js – import a export cizích formátů mapy souvislostí.
   Čistý modul bez DOM (testuje se v node: _test/mapa_souvislosti_formaty_test.js).

   Importy (zGraphML, zGEXF, zCSV, zCSVDvojice, zDOT, dekodujOdkaz) jen PŘEVÁDĚJÍ do vlastního
   formátu mapy { format:'mapa-souvislosti', nazev, popis, uzly, hrany, typy?, typyVztahu?, skupiny?, varovani[] };
   normalizaci, validaci a přejmenování duplicit dělá až MapaJadro.nactiData(data).
   Pole „varovani“ nese poznámky převodu (nactiData ho ignoruje).

   Exporty (doGraphML, doGEXF, doCSV, doDOT, doMermaid, doMarkdown, zakodujOdkaz) berou hotovou mapu
   (z nactiData / novaMapa) – uzly mají x, y = střed.

   Souřadnice: GraphML (i yEd) i CSV mají y dolů jako obrazovka; GEXF (Gephi) a DOT (Graphviz)
   mají y nahoru – při exportu se y otáčí a při importu vrací.
   ============================================================ */
(function () {
  'use strict';

  const FORMAT = 'mapa-souvislosti';

  /* jádro je potřeba jen pro výchozí typy (porovnání, převod názvů typů na id) */
  let jadroCache = null;
  function jadro() {
    if (jadroCache) return jadroCache;
    if (typeof window !== 'undefined' && window.MapaJadro) jadroCache = window.MapaJadro;
    else if (typeof require === 'function') { try { jadroCache = require('./jadro.js'); } catch (e) { jadroCache = null; } }
    return jadroCache;
  }
  const vychoziTypy = () => (jadro() ? jadro().VYCHOZI_TYPY : []);
  const vychoziTypyVztahu = () => (jadro() ? jadro().VYCHOZI_TYPY_VZTAHU : []);

  /* ---------- pomocné ---------- */
  class ChybaFormatu extends Error {}
  const chyba = m => { throw new ChybaFormatu(m); };
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  /* klíč sloupce / atributu: malá písmena bez diakritiky, mezer, podtržítek, pomlček a teček */
  const norm = s => bezDiakritiky(String(s == null ? '' : s).trim().toLowerCase()).replace(/[\s_\-.]+/g, '');
  const konecne = v => typeof v === 'number' && isFinite(v);
  const jeHex = v => typeof v === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v);
  function hexBarva(v) {
    if (v == null) return null;
    let s = String(v).trim();
    if (/^#?[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) { if (s[0] !== '#') s = '#' + s; return s.slice(0, 7).toLowerCase(); }
    if (/^#[0-9a-f]{3}$/i.test(s)) return s.toLowerCase();
    const m = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (m) return zRGB(+m[1], +m[2], +m[3]);
    return null;
  }
  function zRGB(r, g, b) {
    const h = v => Math.max(0, Math.min(255, Math.round(+v || 0))).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  }
  function rozRGB(hex) {
    let s = String(hex).slice(1);
    if (s.length === 3) s = s.split('').map(c => c + c).join('');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  function cisloZ(v) {
    if (v == null) return undefined;
    let s = String(v).trim();
    if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return undefined;
    const n = parseFloat(s);
    return isFinite(n) ? n : undefined;
  }
  function jsonNebo(s, varovani, co) {
    if (s == null || s === '') return null;
    try { return JSON.parse(s); } catch (e) { if (varovani) varovani.push('Nepodařilo se přečíst ' + co + ' – použity výchozí.'); return null; }
  }
  function tagyZ(v) {
    if (Array.isArray(v)) return v.map(String);
    const s = String(v == null ? '' : v).trim();
    if (!s) return [];
    if (s[0] === '[') { try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map(String); } catch (e) { /* jako text */ } }
    return s.split(/[;|]/).map(t => t.trim()).filter(Boolean);
  }
  const tagyNa = tagy => (tagy.some(t => /[;|]/.test(t)) ? JSON.stringify(tagy) : tagy.join('; '));
  const prazdnaData = nazev => ({ format: FORMAT, verze: 2, nazev: nazev || 'Importovaná mapa', popis: '', uzly: [], hrany: [], varovani: [] });

  function smerZ(v) {
    const s = norm(v);
    if (v === '->' || v === '-->' || ['true', '1', 'yes', 'ano', 'directed', 'forward', 'orientovany', 'sipka'].indexOf(s) >= 0) return '->';
    if (v === '<->' || v === '<-->' || ['both', 'mutual', 'bidirectional', 'oboustranny', 'obe'].indexOf(s) >= 0) return '<->';
    if (v === '--' || v === '---' || ['false', '0', 'no', 'ne', 'none', 'undirected', 'neorientovany', 'bezsmeru'].indexOf(s) >= 0) return '--';
    if (v === '<-' || s === 'back' || s === 'reverse' || s === 'zpet') return '<-';
    return null;
  }
  function stylZ(v) {
    const s = norm(v);
    if (['plna', 'solid', 'line', 'plny'].indexOf(s) >= 0) return 'plna';
    if (['carkovana', 'dashed', 'dash', 'dasheddotted', 'carkovany'].indexOf(s) >= 0) return 'carkovana';
    if (['teckovana', 'dotted', 'dot', 'teckovany'].indexOf(s) >= 0) return 'teckovana';
    return undefined;
  }

  /* význam klíčů z cizích souborů (GraphML attr.name, GEXF title, CSV hlavička) */
  const VYZNAM_UZLU = {
    id: 'id', label: 'nazev', name: 'nazev', nazev: 'nazev', title: 'nazev', jmeno: 'nazev',
    description: 'popis', popis: 'popis', desc: 'popis', note: 'popis', notes: 'popis', poznamka: 'popis', tooltip: 'popis',
    type: 'typ', typ: 'typ', group: 'typ', category: 'typ', kategorie: 'typ', kind: 'typ', druh: 'typ',
    date: 'datum', datum: 'datum', start: 'datum', datumod: 'datum',
    dateend: 'datumDo', datumdo: 'datumDo', end: 'datumDo', konec: 'datumDo',
    tags: 'tagy', tagy: 'tagy', tag: 'tagy', stitky: 'tagy', keywords: 'tagy',
    url: 'odkaz', odkaz: 'odkaz', link: 'odkaz', href: 'odkaz', uri: 'odkaz', web: 'odkaz',
    x: 'x', y: 'y', color: 'barva', colour: 'barva', barva: 'barva',
    image: 'obrazek', obrazek: 'obrazek', img: 'obrazek', picture: 'obrazek',
    skupina: 'skupina', r: 'r', g: 'g', b: 'b'
  };
  const VYZNAM_HRAN = {
    id: 'id', source: 'od', from: 'od', od: 'od', zdroj: 'od', src: 'od',
    target: 'do', to: 'do', do: 'do', cil: 'do', dst: 'do',
    label: 'popis', popis: 'popis', vztah: 'popis', relation: 'popis', relationship: 'popis', description: 'popis', name: 'popis', nazev: 'popis',
    type: 'typ', typ: 'typ', kind: 'typ', druh: 'typ',
    smer: 'smer', direction: 'smer', directed: 'smer', dir: 'smer',
    sila: 'sila', weight: 'sila', vaha: 'sila', strength: 'sila',
    styl: 'styl', style: 'styl', color: 'barva', colour: 'barva', barva: 'barva', r: 'r', g: 'g', b: 'b'
  };
  const PREDPONA_ATR = 'atribut:';
  /* atribut uzlu se jménem, které by se spletlo s vestavěným polem, dostane předponu */
  const jmenoAtributu = k => (VYZNAM_UZLU[norm(k)] || VYZNAM_HRAN[norm(k)] || String(k).toLowerCase().startsWith(PREDPONA_ATR) ? PREDPONA_ATR + k : k);
  const vyznamUzlu = k => (String(k).toLowerCase().startsWith(PREDPONA_ATR) ? 'atribut' : VYZNAM_UZLU[norm(k)] || null);
  const bezPredpony = k => (String(k).toLowerCase().startsWith(PREDPONA_ATR) ? String(k).slice(PREDPONA_ATR.length) : String(k));

  /* uzel ze slovníku {význam: hodnota}; neznámé klíče → atributy */
  function uzelZPoli(pole, atributy) {
    const u = {};
    for (const [vyz, v] of pole) {
      if (v == null || v === '') continue;
      if (vyz === 'x' || vyz === 'y') { const n = cisloZ(v); if (n !== undefined) u[vyz] = n; }
      else if (vyz === 'tagy') u.tagy = tagyZ(v);
      else if (vyz === 'barva') { const b = hexBarva(v); if (b) u.barva = b; }
      else if (vyz === 'r' || vyz === 'g' || vyz === 'b') { (u._rgb = u._rgb || {})[vyz] = +v; }
      else if (vyz === 'skupina') u._skupina = String(v);
      else if (u[vyz] == null) u[vyz] = String(v);
    }
    if (u._rgb) { if (!u.barva && u._rgb.r != null && u._rgb.g != null && u._rgb.b != null) u.barva = zRGB(u._rgb.r, u._rgb.g, u._rgb.b); delete u._rgb; }
    if (atributy && atributy.length) u.atributy = atributy;
    return u;
  }

  /* typ uzlu / vztahu: přijme id i název (bez ohledu na velikost a diakritiku) */
  function typPodleNazvu(v, typy) {
    if (v == null || v === '') return v;
    const k = norm(v);
    const t = typy.find(t => norm(t.id) === k) || typy.find(t => norm(t.nazev) === k);
    return t ? t.id : String(v);
  }
  /* neznámé typy vztahů z cizích souborů založí jako nové typy */
  function zajistiTypyVztahu(data, hrany) {
    const typy = (data.typyVztahu || vychoziTypyVztahu()).map(t => Object.assign({}, t));
    let pridano = false;
    for (const h of hrany) {
      if (h.typ == null || h.typ === '') { h.typ = null; continue; }
      const id = typPodleNazvu(h.typ, typy);
      if (!typy.some(t => t.id === id)) { typy.push({ id: String(id).slice(0, 40), nazev: String(id).slice(0, 60), barva: null, styl: 'plna', smer: '->' }); pridano = true; }
      h.typ = String(id).slice(0, 40);
    }
    if (pridano || data.typyVztahu) data.typyVztahu = typy;
  }
  function prevedTypyUzlu(uzly, typy) {
    const t = typy || vychoziTypy();
    for (const u of uzly) if (u.typ != null && u.typ !== '') u.typ = typPodleNazvu(u.typ, t);
  }

  /* ============================================================
     XML – malý parser (bez DOMParser, běží v node i v prohlížeči)
     → { jmeno, atributy:{}, deti:[elementy], text } – text = spojený přímý text a CDATA
     ============================================================ */
  const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  function dekodujEntity(s) {
    if (s.indexOf('&') < 0) return s;
    return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return c > 0 && c <= 0x10FFFF && !(c >= 0xD800 && c <= 0xDFFF) ? String.fromCodePoint(c) : m;
      }
      return Object.prototype.hasOwnProperty.call(ENTITY, e) ? ENTITY[e] : m;
    });
  }
  function parsujXML(text) {
    const s = String(text == null ? '' : text);
    const n = s.length;
    let i = s.charCodeAt(0) === 0xFEFF ? 1 : 0;
    const radek = pos => { let r = 1; for (let k = 0; k < pos && k < n; k++) if (s.charCodeAt(k) === 10) r++; return r; };
    const err = (m, pos) => chyba('Chybné XML na řádku ' + radek(pos) + ': ' + m);
    const dokument = { jmeno: '#dokument', atributy: {}, deti: [], text: '' };
    const zasobnik = [dokument];
    let koren = null;
    const jeMezera = c => c === 32 || c === 9 || c === 10 || c === 13;
    const ctiJmeno = () => {
      const z = i;
      while (i < n) { const c = s.charCodeAt(i); if (jeMezera(c) || c === 47 || c === 62 || c === 61 || c === 60) break; i++; }
      return s.slice(z, i);
    };
    const preskocMezery = () => { while (i < n && jeMezera(s.charCodeAt(i))) i++; };
    while (i < n) {
      const lt = s.indexOf('<', i);
      const konecTextu = lt < 0 ? n : lt;
      if (konecTextu > i) {
        const t = s.slice(i, konecTextu);
        const vrch = zasobnik[zasobnik.length - 1];
        if (vrch === dokument) { if (t.trim()) err('text mimo kořenový element', i); }
        else vrch.text += dekodujEntity(t);
      }
      if (lt < 0) break;
      i = lt;
      if (s.startsWith('<!--', i)) {
        const k = s.indexOf('-->', i + 4);
        if (k < 0) err('neukončený komentář <!--', i);
        i = k + 3; continue;
      }
      if (s.startsWith('<![CDATA[', i)) {
        const k = s.indexOf(']]>', i + 9);
        if (k < 0) err('neukončená sekce CDATA', i);
        const vrch = zasobnik[zasobnik.length - 1];
        if (vrch === dokument) err('CDATA mimo kořenový element', i);
        vrch.text += s.slice(i + 9, k);
        i = k + 3; continue;
      }
      if (s.startsWith('<?', i)) {
        const k = s.indexOf('?>', i + 2);
        if (k < 0) err('neukončená instrukce <?', i);
        i = k + 2; continue;
      }
      if (s.startsWith('<!', i)) {   /* DOCTYPE i s vnitřní částí [ … ] */
        const z = i;
        let hloubka = 0; i += 2;
        while (i < n) {
          const c = s[i];
          if (c === '"' || c === "'") { const k = s.indexOf(c, i + 1); if (k < 0) err('neukončený řetězec v deklaraci', z); i = k + 1; continue; }
          if (c === '[') hloubka++;
          else if (c === ']') hloubka--;
          else if (c === '>' && hloubka <= 0) break;
          i++;
        }
        if (i >= n) err('neukončená deklarace <!', z);
        i++; continue;
      }
      if (s[i + 1] === '/') {
        const z = i;
        i += 2;
        const jm = ctiJmeno();
        preskocMezery();
        if (s[i] !== '>') err('chybí „>“ v uzavírací značce </' + jm, z);
        i++;
        const vrch = zasobnik[zasobnik.length - 1];
        if (vrch === dokument) err('uzavírací značka </' + jm + '> bez otevírací', z);
        if (vrch.jmeno !== jm) err('očekávána </' + vrch.jmeno + '>, nalezena </' + jm + '>', z);
        zasobnik.pop();
        continue;
      }
      /* otevírací značka */
      const z = i;
      i++;
      const jm = ctiJmeno();
      if (!jm) err('chybí jméno elementu za „<“', z);
      const el = { jmeno: jm, atributy: {}, deti: [], text: '' };
      let samo = false;
      for (;;) {
        preskocMezery();
        if (i >= n) err('neukončená značka <' + jm, z);
        const c = s[i];
        if (c === '>') { i++; break; }
        if (c === '/' && s[i + 1] === '>') { i += 2; samo = true; break; }
        const an = ctiJmeno();
        if (!an) err('neočekávaný znak „' + s[i] + '“ ve značce <' + jm + '>', i);
        preskocMezery();
        if (s[i] !== '=') err('atribut „' + an + '“ ve značce <' + jm + '> nemá hodnotu', i);
        i++;
        preskocMezery();
        const q = s[i];
        if (q !== '"' && q !== "'") err('hodnota atributu „' + an + '“ není v uvozovkách', i);
        const k = s.indexOf(q, i + 1);
        if (k < 0) err('neukončená hodnota atributu „' + an + '“', i);
        const hodnota = s.slice(i + 1, k);
        if (hodnota.indexOf('<') >= 0) err('znak „<“ v hodnotě atributu „' + an + '“', i);
        el.atributy[an] = dekodujEntity(hodnota.replace(/[\t\n\r]/g, ' '));
        i = k + 1;
      }
      const vrch = zasobnik[zasobnik.length - 1];
      if (vrch === dokument) { if (koren) err('dokument má víc kořenových elementů', z); koren = el; }
      vrch.deti.push(el);
      if (!samo) zasobnik.push(el);
    }
    if (zasobnik.length > 1) err('neuzavřený element <' + zasobnik[zasobnik.length - 1].jmeno + '>', n);
    if (!koren) chyba('Chybné XML: dokument neobsahuje žádný element.');
    return koren;
  }
  const lokal = jm => { const k = jm.indexOf(':'); return k >= 0 ? jm.slice(k + 1) : jm; };
  const deti = (el, jm) => el.deti.filter(d => lokal(d.jmeno) === jm);
  const dite = (el, jm) => el.deti.find(d => lokal(d.jmeno) === jm) || null;
  function potomek(el, jm) {
    const z = [el];
    while (z.length) {
      const e = z.shift();
      for (const d of e.deti) { if (lokal(d.jmeno) === jm) return d; z.push(d); }
    }
    return null;
  }
  function potomci(el, jm) {
    /* v pořadí dokumentu (průchod do hloubky bez rekurze) */
    const v = [], z = el.deti.slice().reverse();
    while (z.length) { const d = z.pop(); if (lokal(d.jmeno) === jm) v.push(d); for (let k = d.deti.length - 1; k >= 0; k--) z.push(d.deti[k]); }
    return v;
  }
  /* escapování: atribut (i konce řádků, aby přežily normalizaci) a text; neplatné řídicí znaky XML 1.0 pryč */
  const bezRidicich = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
  const xA = s => bezRidicich(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    .replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');
  const xT = s => bezRidicich(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#13;');
  const cislo1 = v => String(Math.round(v * 100) / 100);

  /* ============================================================
     GraphML
     ============================================================ */
  const KLICE_UZLU = [
    ['nazev', 'label', 'string'], ['typ', 'type', 'string'], ['popis', 'description', 'string'], ['datum', 'date', 'string'],
    ['datumDo', 'dateEnd', 'string'], ['tagy', 'tags', 'string'], ['odkaz', 'url', 'string'], ['x', 'x', 'double'], ['y', 'y', 'double'],
    ['barva', 'color', 'string'], ['obrazek', 'image', 'string']
  ];
  const KLICE_HRAN = [['popis', 'label', 'string'], ['typ', 'type', 'string'], ['smer', 'direction', 'string'], ['styl', 'style', 'string'],
    ['sila', 'weight', 'double'], ['barva', 'color', 'string']];
  const TVAR_YED = { zaobleny: 'roundrectangle', kapsle: 'roundrectangle', ostry: 'rectangle', elipsa: 'ellipse' };

  const typMapy = (mapa, u) => (mapa.typy || []).find(t => t.id === u.typ) || (mapa.typy || [])[0] || { id: 'pojem', nazev: 'Pojem', barva: '#7b8794', tvar: 'zaobleny', ikona: '' };
  const typVztahuMapy = (mapa, h) => (h.typ ? (mapa.typyVztahu || []).find(t => t.id === h.typ) || null : null);
  const stitek = (mapa, h) => h.popis || (typVztahuMapy(mapa, h) || {}).nazev || '';
  const platneHrany = mapa => { const ids = new Set(mapa.uzly.map(u => u.id)); return mapa.hrany.filter(h => ids.has(h.od) && ids.has(h.do)); };
  const rozmer = (volby, mapa, u) => {
    const g = (volby && volby.geo) || mapa.geo;
    const r = g && typeof g.get === 'function' ? g.get(u.id) : null;
    return r && konecne(r.w) && konecne(r.h) ? r : { w: 160, h: 40 };
  };
  const skupinyBezPrazdnych = mapa => (mapa.skupiny || []).map(s => ({ id: s.id, nazev: s.nazev, barva: s.barva, uzly: s.uzly.slice() }));
  const typyJSON = mapa => JSON.stringify(mapa.typy || []);
  const typyVztahuJSON = mapa => JSON.stringify(mapa.typyVztahu || []);

  function doGraphML(mapa, volby) {
    const o = [];
    o.push('<?xml version="1.0" encoding="UTF-8"?>');
    o.push('<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:y="http://www.yworks.com/xml/graphml" xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://www.yworks.com/xml/schema/graphml/1.1/ygraphml.xsd">');
    o.push('  <!-- Mapa souvislostí – GraphML; data uzlů a vztahů v klíčích níže, grafika pro yEd v y:ShapeNode -->');
    o.push('  <key id="g_nazev" for="graph" attr.name="name" attr.type="string"/>');
    o.push('  <key id="g_popis" for="graph" attr.name="description" attr.type="string"/>');
    o.push('  <key id="g_typy" for="graph" attr.name="mapa:typy" attr.type="string"/>');
    o.push('  <key id="g_typyVztahu" for="graph" attr.name="mapa:typyVztahu" attr.type="string"/>');
    o.push('  <key id="g_skupiny" for="graph" attr.name="mapa:skupiny" attr.type="string"/>');
    for (const [p, jm, t] of KLICE_UZLU) o.push('  <key id="n_' + p + '" for="node" attr.name="' + jm + '" attr.type="' + t + '"/>');
    /* každý klíč atributu jako vlastní sloupec (pořadí prvního výskytu) */
    const atrKlice = new Map();
    for (const u of mapa.uzly) for (const [k] of u.atributy || []) if (!atrKlice.has(k)) atrKlice.set(k, 'a' + atrKlice.size);
    for (const [k, id] of atrKlice) o.push('  <key id="' + id + '" for="node" attr.name="' + xA(jmenoAtributu(k)) + '" attr.type="string"/>');
    for (const [p, jm, t] of KLICE_HRAN) o.push('  <key id="e_' + p + '" for="edge" attr.name="' + jm + '" attr.type="' + t + '"/>');
    o.push('  <key id="n_yed" for="node" yfiles.type="nodegraphics"/>');
    o.push('  <key id="e_yed" for="edge" yfiles.type="edgegraphics"/>');
    o.push('  <graph id="G" edgedefault="directed">');
    const data = (k, v) => '<data key="' + k + '">' + xT(v) + '</data>';
    o.push('    ' + data('g_nazev', mapa.nazev || ''));
    if (mapa.popis) o.push('    ' + data('g_popis', mapa.popis));
    o.push('    ' + data('g_typy', typyJSON(mapa)));
    o.push('    ' + data('g_typyVztahu', typyVztahuJSON(mapa)));
    if ((mapa.skupiny || []).length) o.push('    ' + data('g_skupiny', JSON.stringify(skupinyBezPrazdnych(mapa))));
    for (const u of mapa.uzly) {
      const t = typMapy(mapa, u);
      const r = ['    <node id="' + xA(u.id) + '">'];
      r.push(data('n_nazev', u.nazev));
      if (u.typ) r.push(data('n_typ', u.typ));
      if (u.popis) r.push(data('n_popis', u.popis));
      if (u.datum) r.push(data('n_datum', u.datum));
      if (u.datumDo) r.push(data('n_datumDo', u.datumDo));
      if (u.tagy && u.tagy.length) r.push(data('n_tagy', tagyNa(u.tagy)));
      if (u.odkaz) r.push(data('n_odkaz', u.odkaz));
      if (konecne(u.x) && konecne(u.y)) { r.push(data('n_x', cislo1(u.x))); r.push(data('n_y', cislo1(u.y))); }
      if (u.barva) r.push(data('n_barva', u.barva));
      if (u.obrazek) r.push(data('n_obrazek', u.obrazek));
      for (const [k, v] of u.atributy || []) r.push(data(atrKlice.get(k), v));
      const g = rozmer(volby, mapa, u);
      const geom = konecne(u.x) && konecne(u.y) ? '<y:Geometry x="' + cislo1(u.x - g.w / 2) + '" y="' + cislo1(u.y - g.h / 2) + '" width="' + cislo1(g.w) + '" height="' + cislo1(g.h) + '"/>' : '';
      r.push('<data key="n_yed"><y:ShapeNode>' + geom + '<y:Fill color="' + xA(u.barva || t.barva || '#7b8794') + '" transparent="false"/>' +
        '<y:NodeLabel>' + xT(u.nazev) + '</y:NodeLabel><y:Shape type="' + (TVAR_YED[t.tvar] || 'roundrectangle') + '"/></y:ShapeNode></data>');
      o.push(r.join('') + '</node>');
    }
    for (const h of platneHrany(mapa)) {
      const tv = typVztahuMapy(mapa, h);
      const r = ['    <edge id="' + xA(h.id) + '" source="' + xA(h.od) + '" target="' + xA(h.do) + '"' + (h.smer === '--' ? ' directed="false"' : '') + '>'];
      if (h.popis) r.push(data('e_popis', h.popis));
      if (h.typ) r.push(data('e_typ', h.typ));
      r.push(data('e_smer', h.smer || '->'));
      if (h.styl && h.styl !== 'plna') r.push(data('e_styl', h.styl));
      if (h.sila && h.sila !== 1) r.push(data('e_sila', String(h.sila)));
      if (h.barva) r.push(data('e_barva', h.barva));
      const lt = h.styl === 'carkovana' ? 'dashed' : h.styl === 'teckovana' ? 'dotted' : 'line';
      const st = stitek(mapa, h);
      r.push('<data key="e_yed"><y:PolyLineEdge><y:LineStyle color="' + xA(h.barva || (tv && tv.barva) || '#7b8794') + '" type="' + lt + '" width="' + (h.sila || 1) + '"/>' +
        '<y:Arrows source="' + (h.smer === '<->' ? 'standard' : 'none') + '" target="' + (h.smer === '--' ? 'none' : 'standard') + '"/>' +
        (st ? '<y:EdgeLabel>' + xT(st) + '</y:EdgeLabel>' : '') + '</y:PolyLineEdge></data>');
      o.push(r.join('') + '</edge>');
    }
    o.push('  </graph>');
    o.push('</graphml>');
    return o.join('\n') + '\n';
  }

  function zGraphML(text) {
    const koren = parsujXML(text);
    if (lokal(koren.jmeno) !== 'graphml') chyba('Soubor není GraphML (kořenový element je <' + koren.jmeno + '>, čekám <graphml>).');
    const varovani = [];
    const klice = new Map();
    for (const k of deti(koren, 'key')) {
      const id = k.atributy.id;
      if (id == null) continue;
      const def = dite(k, 'default');
      klice.set(id, { id, pro: k.atributy.for || 'all', jmeno: k.atributy['attr.name'] != null ? k.atributy['attr.name'] : id,
        yfiles: k.atributy['yfiles.type'] || null, vychozi: def ? def.text : null });
    }
    const graf = dite(koren, 'graph');
    if (!graf) chyba('GraphML neobsahuje žádný <graph>.');
    const klicePro = pro => [...klice.values()].filter(k => !k.yfiles && (k.pro === pro || k.pro === 'all'));
    const klUzlu = klicePro('node'), klHran = klicePro('edge');
    const d = prazdnaData('Importovaná mapa');
    d.varovani = varovani;
    /* data grafu */
    for (const el of deti(graf, 'data')) {
      const k = klice.get(el.atributy.key);
      const jm = k ? k.jmeno : el.atributy.key;
      const v = el.text;
      if (jm === 'mapa:typy') { const t = jsonNebo(v, varovani, 'typy uzlů'); if (Array.isArray(t)) d.typy = t; }
      else if (jm === 'mapa:typyVztahu') { const t = jsonNebo(v, varovani, 'typy vztahů'); if (Array.isArray(t)) d.typyVztahu = t; }
      else if (jm === 'mapa:skupiny') { const t = jsonNebo(v, varovani, 'skupiny'); if (Array.isArray(t)) d.skupiny = t; }
      else if (['name', 'label', 'title', 'nazev'].indexOf(norm(jm)) >= 0) { if (v.trim()) d.nazev = v.trim(); }
      else if (['description', 'popis'].indexOf(norm(jm)) >= 0) d.popis = v;
    }
    const nas = !!d.typy;
    const vychoziHranove = graf.atributy.edgedefault === 'undirected' ? '--' : '->';
    const skupiny = [];
    const hrany = [];
    const hodnotyDat = (el, kl) => {
      const m = new Map();
      for (const k of kl) if (k.vychozi != null) m.set(k.id, k.vychozi);
      for (const dd of deti(el, 'data')) { const k = klice.get(dd.atributy.key); if (k && k.yfiles) continue; m.set(dd.atributy.key, dd.text); }
      return m;
    };
    const grafikaYEd = el => {
      for (const dd of deti(el, 'data')) { const k = klice.get(dd.atributy.key); if (k && k.yfiles) return dd; }
      return null;
    };
    const textStitku = (g, jm) => {
      if (!g) return '';
      for (const l of potomci(g, jm)) if (l.text.trim()) return l.text.trim();
      return '';
    };
    const projdi = (g, skupinaId) => {
      for (const n of deti(g, 'node')) {
        const id = n.atributy.id;
        const vnoreny = dite(n, 'graph');
        const hod = hodnotyDat(n, klUzlu);
        const pole = [], atributy = [];
        for (const [kid, v] of hod) {
          const k = klice.get(kid);
          const jm = k ? k.jmeno : kid;
          const vyz = vyznamUzlu(jm);
          if (vyz === 'atribut') atributy.push([bezPredpony(jm), v]);
          else if (vyz && vyz !== 'id') pole.push([vyz, v]);
          else if (!vyz && v !== '') atributy.push([jm, v]);
        }
        const u = uzelZPoli(pole, atributy);
        const gr = grafikaYEd(n);
        if (gr) {
          if (!u.nazev) { const t = textStitku(gr, 'NodeLabel'); if (t) u.nazev = u.nazev || t; }
          if (!nas && !u.barva) { const f = potomek(gr, 'Fill'); const b = f && hexBarva(f.atributy.color); if (b) u.barva = b; }
          if (u.x === undefined || u.y === undefined) {
            const ge = potomek(gr, 'Geometry');
            if (ge) {
              const x = cisloZ(ge.atributy.x), y = cisloZ(ge.atributy.y), w = cisloZ(ge.atributy.width) || 0, h = cisloZ(ge.atributy.height) || 0;
              if (x !== undefined && y !== undefined) { u.x = x + w / 2; u.y = y + h / 2; }
            }
          }
        }
        if (vnoreny) {   /* skupinový uzel yEd → skupina (uzel se nezakládá) */
          skupiny.push({ id: id != null ? String(id) : 'sk' + skupiny.length, nazev: u.nazev || 'Skupina', barva: u.barva || null, uzly: [] });
          projdi(vnoreny, skupiny[skupiny.length - 1].id);
          continue;
        }
        if (id == null) { varovani.push('Uzel bez id přeskočen.'); continue; }
        u.id = String(id);
        if (u.nazev == null) u.nazev = u.id;
        if (skupinaId != null) { const sk = skupiny.find(s => s.id === skupinaId); if (sk) sk.uzly.push(u.id); }
        d.uzly.push(u);
      }
      for (const e of deti(g, 'edge')) {
        const hod = hodnotyDat(e, klHran);
        const h = { od: e.atributy.source, do: e.atributy.target };
        if (e.atributy.id != null) h.id = e.atributy.id;
        let smer = null;
        for (const [kid, v] of hod) {
          const k = klice.get(kid);
          const vyz = VYZNAM_HRAN[norm(k ? k.jmeno : kid)];
          if (!vyz || v === '') continue;
          if (vyz === 'smer') smer = smerZ(v) || smer;
          else if (vyz === 'sila') { const s = cisloZ(v); if (s !== undefined) h.sila = s; }
          else if (vyz === 'styl') { const s = stylZ(v); if (s) h.styl = s; }
          else if (vyz === 'barva') { const b = hexBarva(v); if (b) h.barva = b; }
          else if (vyz === 'r' || vyz === 'g' || vyz === 'b') (h._rgb = h._rgb || {})[vyz] = +v;
          else if (vyz === 'popis' || vyz === 'typ') { if (h[vyz] == null) h[vyz] = v; }
        }
        if (h._rgb) { if (!h.barva && h._rgb.r != null && h._rgb.g != null && h._rgb.b != null) h.barva = zRGB(h._rgb.r, h._rgb.g, h._rgb.b); delete h._rgb; }
        const gr = grafikaYEd(e);
        if (gr) {
          if (!nas && h.popis == null) { const t = textStitku(gr, 'EdgeLabel'); if (t) h.popis = t; }
          const ls = potomek(gr, 'LineStyle');
          if (ls) {
            if (!h.styl) { const s = stylZ(ls.atributy.type); if (s) h.styl = s; }
            if (!nas && !h.barva) { const b = hexBarva(ls.atributy.color); if (b) h.barva = b; }
            if (h.sila == null) { const w = cisloZ(ls.atributy.width); if (w !== undefined) h.sila = w >= 3 ? 3 : w >= 2 ? 2 : 1; }
          }
          const ar = potomek(gr, 'Arrows');
          if (ar && !smer) {
            const zS = ar.atributy.source && ar.atributy.source !== 'none', zC = ar.atributy.target && ar.atributy.target !== 'none';
            smer = zS && zC ? '<->' : zC ? '->' : zS ? '<-' : '--';
          }
        }
        if (!smer) smer = e.atributy.directed === 'false' ? '--' : e.atributy.directed === 'true' ? '->' : vychoziHranove;
        if (smer === '<-') { const t = h.od; h.od = h.do; h.do = t; smer = '->'; }
        h.smer = smer;
        hrany.push(h);
      }
    };
    projdi(graf, null);
    if (deti(koren, 'graph').length > 1) varovani.push('Soubor obsahuje více grafů – načten jen první.');
    d.hrany = hrany;
    if (!nas) {
      prevedTypyUzlu(d.uzly, null);
      zajistiTypyVztahu(d, hrany);
      if (skupiny.length) d.skupiny = skupiny.filter(s => s.uzly.length).map(s => Object.assign(s, { barva: s.barva || undefined }));
    } else if (skupiny.length && !d.skupiny) d.skupiny = skupiny.filter(s => s.uzly.length);
    return d;
  }

  /* ============================================================
     GEXF 1.3 (import i 1.1 / 1.2 z Gephi)
     ============================================================ */
  const ATR_GEXF_UZLU = [['typ', 'type'], ['popis', 'description'], ['datum', 'date'], ['datumDo', 'dateEnd'], ['tagy', 'tags'], ['odkaz', 'url'], ['barva', 'color'], ['obrazek', 'image']];
  const ATR_GEXF_HRAN = [['typ', 'type'], ['smer', 'direction'], ['styl', 'style'], ['barva', 'color']];

  const vizBarva = hex => { const [r, g, b] = rozRGB(hex); return '<viz:color r="' + r + '" g="' + g + '" b="' + b + '"/>'; };

  function doGEXF(mapa) {
    const o = [];
    o.push('<?xml version="1.0" encoding="UTF-8"?>');
    o.push('<gexf xmlns="http://gexf.net/1.3" xmlns:viz="http://gexf.net/1.3/viz" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://gexf.net/1.3 http://gexf.net/1.3/gexf.xsd" version="1.3">');
    o.push('  <meta><creator>Mapa souvislostí</creator><title>' + xT(mapa.nazev || '') + '</title>' + (mapa.popis ? '<description>' + xT(mapa.popis) + '</description>' : '') + '</meta>');
    o.push('  <graph defaultedgetype="directed" mode="static">');
    o.push('    <attributes class="node">');
    for (const [p, t] of ATR_GEXF_UZLU) o.push('      <attribute id="' + p + '" title="' + t + '" type="string"/>');
    const atrKlice = new Map();
    for (const u of mapa.uzly) for (const [k] of u.atributy || []) if (!atrKlice.has(k)) atrKlice.set(k, 'a' + atrKlice.size);
    for (const [k, id] of atrKlice) o.push('      <attribute id="' + id + '" title="' + xA(jmenoAtributu(k)) + '" type="string"/>');
    /* definice typů a skupin nemají v GEXF místo – nesou je výchozí hodnoty zvláštních atributů */
    o.push('      <attribute id="mapa_typy" title="mapa:typy" type="string"><default>' + xT(typyJSON(mapa)) + '</default></attribute>');
    o.push('      <attribute id="mapa_typyVztahu" title="mapa:typyVztahu" type="string"><default>' + xT(typyVztahuJSON(mapa)) + '</default></attribute>');
    if ((mapa.skupiny || []).length) o.push('      <attribute id="mapa_skupiny" title="mapa:skupiny" type="string"><default>' + xT(JSON.stringify(skupinyBezPrazdnych(mapa))) + '</default></attribute>');
    o.push('    </attributes>');
    o.push('    <attributes class="edge">');
    for (const [p, t] of ATR_GEXF_HRAN) o.push('      <attribute id="e_' + p + '" title="' + t + '" type="string"/>');
    o.push('    </attributes>');
    o.push('    <nodes>');
    const av = (id, v) => '<attvalue for="' + id + '" value="' + xA(v) + '"/>';
    for (const u of mapa.uzly) {
      const t = typMapy(mapa, u);
      const a = [];
      if (u.typ) a.push(av('typ', u.typ));
      if (u.popis) a.push(av('popis', u.popis));
      if (u.datum) a.push(av('datum', u.datum));
      if (u.datumDo) a.push(av('datumDo', u.datumDo));
      if (u.tagy && u.tagy.length) a.push(av('tagy', tagyNa(u.tagy)));
      if (u.odkaz) a.push(av('odkaz', u.odkaz));
      if (u.barva) a.push(av('barva', u.barva));
      if (u.obrazek) a.push(av('obrazek', u.obrazek));
      for (const [k, v] of u.atributy || []) a.push(av(atrKlice.get(k), v));
      o.push('      <node id="' + xA(u.id) + '" label="' + xA(u.nazev) + '">' + (a.length ? '<attvalues>' + a.join('') + '</attvalues>' : '') +
        (konecne(u.x) && konecne(u.y) ? '<viz:position x="' + cislo1(u.x) + '" y="' + cislo1(-u.y) + '" z="0"/>' : '') +
        vizBarva(jeHex(u.barva) ? u.barva : jeHex(t.barva) ? t.barva : '#7b8794') + '</node>');
    }
    o.push('    </nodes>');
    o.push('    <edges>');
    for (const h of platneHrany(mapa)) {
      const tv = typVztahuMapy(mapa, h);
      const a = [];
      if (h.typ) a.push(av('e_typ', h.typ));
      a.push(av('e_smer', h.smer || '->'));
      if (h.styl && h.styl !== 'plna') a.push(av('e_styl', h.styl));
      if (h.barva) a.push(av('e_barva', h.barva));
      const bar = h.barva || (tv && tv.barva);
      o.push('      <edge id="' + xA(h.id) + '" source="' + xA(h.od) + '" target="' + xA(h.do) + '" type="' + (h.smer === '--' ? 'undirected' : h.smer === '<->' ? 'mutual' : 'directed') + '"' +
        ' weight="' + (h.sila || 1) + '"' + (h.popis ? ' label="' + xA(h.popis) + '"' : '') + '><attvalues>' + a.join('') + '</attvalues>' +
        (jeHex(bar) ? vizBarva(bar) : '') + '</edge>');
    }
    o.push('    </edges>');
    o.push('  </graph>');
    o.push('</gexf>');
    return o.join('\n') + '\n';
  }

  function zGEXF(text) {
    const koren = parsujXML(text);
    if (lokal(koren.jmeno) !== 'gexf') chyba('Soubor není GEXF (kořenový element je <' + koren.jmeno + '>, čekám <gexf>).');
    const graf = dite(koren, 'graph');
    if (!graf) chyba('GEXF neobsahuje žádný <graph>.');
    const varovani = [];
    const d = prazdnaData('Importovaná mapa');
    d.varovani = varovani;
    const meta = dite(koren, 'meta');
    if (meta) {
      const t = dite(meta, 'title'), p = dite(meta, 'description');
      if (t && t.text.trim()) d.nazev = t.text.trim();
      if (p) d.popis = p.text;
    }
    const atributy = { node: new Map(), edge: new Map() };
    for (const a of deti(graf, 'attributes')) {
      const tr = a.atributy.class === 'edge' ? 'edge' : 'node';
      for (const at of deti(a, 'attribute')) {
        const def = dite(at, 'default');
        atributy[tr].set(at.atributy.id, { jmeno: at.atributy.title != null ? at.atributy.title : at.atributy.id, vychozi: def ? def.text : null });
      }
    }
    for (const [id, a] of atributy.node) {
      if (a.jmeno === 'mapa:typy') { const t = jsonNebo(a.vychozi, varovani, 'typy uzlů'); if (Array.isArray(t)) d.typy = t; atributy.node.delete(id); }
      else if (a.jmeno === 'mapa:typyVztahu') { const t = jsonNebo(a.vychozi, varovani, 'typy vztahů'); if (Array.isArray(t)) d.typyVztahu = t; atributy.node.delete(id); }
      else if (a.jmeno === 'mapa:skupiny') { const t = jsonNebo(a.vychozi, varovani, 'skupiny'); if (Array.isArray(t)) d.skupiny = t; atributy.node.delete(id); }
    }
    const nas = !!d.typy;
    const deklBarvy = [...atributy.node.values()].some(a => vyznamUzlu(a.jmeno) === 'barva');
    const deklBarvyH = [...atributy.edge.values()].some(a => VYZNAM_HRAN[norm(a.jmeno)] === 'barva');
    const hodnoty = (el, tr) => {
      const m = new Map();
      for (const [id, a] of atributy[tr]) if (a.vychozi != null) m.set(id, a.vychozi);
      const avs = dite(el, 'attvalues');
      if (avs) for (const v of deti(avs, 'attvalue')) { const k = v.atributy.for != null ? v.atributy.for : v.atributy.id; if (k != null) m.set(k, v.atributy.value != null ? v.atributy.value : ''); }
      return m;
    };
    const barvaViz = el => {
      const c = dite(el, 'color');
      if (!c) return null;
      if (c.atributy.hex) return hexBarva(c.atributy.hex);
      if (c.atributy.r != null && c.atributy.g != null && c.atributy.b != null) return zRGB(c.atributy.r, c.atributy.g, c.atributy.b);
      return null;
    };
    const uzlyEl = dite(graf, 'nodes');
    for (const n of uzlyEl ? potomci(uzlyEl, 'node') : []) {
      const id = n.atributy.id;
      if (id == null) { varovani.push('Uzel bez id přeskočen.'); continue; }
      const pole = [], atr = [];
      for (const [k, v] of hodnoty(n, 'node')) {
        const a = atributy.node.get(k);
        const jm = a ? a.jmeno : k;
        const vyz = vyznamUzlu(jm);
        if (vyz === 'atribut') atr.push([bezPredpony(jm), v]);
        else if (vyz && vyz !== 'id' && vyz !== 'nazev') pole.push([vyz, v]);
        else if (!vyz && v !== '') atr.push([jm, v]);
        else if (vyz === 'nazev' && n.atributy.label == null) pole.push([vyz, v]);
      }
      const u = uzelZPoli(pole, atr);
      u.id = String(id);
      u.nazev = n.atributy.label != null && n.atributy.label !== '' ? n.atributy.label : u.nazev || u.id;
      const pos = dite(n, 'position');
      if (pos) { const x = cisloZ(pos.atributy.x), y = cisloZ(pos.atributy.y); if (x !== undefined && y !== undefined) { u.x = x; u.y = y === 0 ? 0 : -y; } }
      if (!deklBarvy && !nas && !u.barva) { const b = barvaViz(n); if (b) u.barva = b; }
      d.uzly.push(u);
    }
    const vychozi = graf.atributy.defaultedgetype === 'undirected' ? '--' : graf.atributy.defaultedgetype === 'mutual' ? '<->' : '->';
    const hranyEl = dite(graf, 'edges');
    for (const e of hranyEl ? deti(hranyEl, 'edge') : []) {
      const h = { od: e.atributy.source, do: e.atributy.target };
      if (e.atributy.id != null) h.id = e.atributy.id;
      if (e.atributy.label) h.popis = e.atributy.label;
      let smer = null;
      for (const [k, v] of hodnoty(e, 'edge')) {
        const a = atributy.edge.get(k);
        const vyz = VYZNAM_HRAN[norm(a ? a.jmeno : k)];
        if (!vyz || v === '') continue;
        if (vyz === 'smer') smer = smerZ(v) || smer;
        else if (vyz === 'styl') { const s = stylZ(v); if (s) h.styl = s; }
        else if (vyz === 'barva') { const b = hexBarva(v); if (b) h.barva = b; }
        else if (vyz === 'sila') { const s = cisloZ(v); if (s !== undefined) h.sila = s; }
        else if (vyz === 'popis' || vyz === 'typ') { if (h[vyz] == null) h[vyz] = v; }
      }
      if (h.sila == null && e.atributy.weight != null && nas) { const w = cisloZ(e.atributy.weight); if (w !== undefined) h.sila = w; }
      if (!smer) { const t = e.atributy.type; smer = t === 'undirected' ? '--' : t === 'mutual' ? '<->' : t === 'directed' ? '->' : vychozi; }
      if (smer === '<-') { const t = h.od; h.od = h.do; h.do = t; smer = '->'; }
      h.smer = smer;
      if (!deklBarvyH && !nas && !h.barva) { const b = barvaViz(e); if (b) h.barva = b; }
      d.hrany.push(h);
    }
    if (!nas) { prevedTypyUzlu(d.uzly, null); zajistiTypyVztahu(d, d.hrany); }
    return d;
  }

  /* ============================================================
     CSV
     ============================================================ */
  /* RFC 4180 – uvozovky, zdvojené uvozovky, konce řádků v buňce; vrací pole řádků (pole buněk) */
  function parsujCSV(text, oddelovac) {
    let s = String(text == null ? '' : text);
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    const radky = [];
    let radek = [], bunka = '', i = 0, vUvoz = false, zacatekUvoz = 0, cisloRadku = 1, radekZacatku = 1;
    const n = s.length;
    while (i < n) {
      const c = s[i];
      if (vUvoz) {
        if (c === '"') {
          if (s[i + 1] === '"') { bunka += '"'; i += 2; continue; }
          vUvoz = false; i++; continue;
        }
        if (c === '\n') cisloRadku++;
        bunka += c; i++; continue;
      }
      if (c === '"' && bunka.trim() === '') { vUvoz = true; bunka = ''; zacatekUvoz = cisloRadku; i++; continue; }
      if (c === oddelovac) { radek.push(bunka); bunka = ''; i++; continue; }
      if (c === '\r' || c === '\n') {
        radek.push(bunka); bunka = '';
        radky.push({ bunky: radek, radek: radekZacatku });
        radek = [];
        if (c === '\r' && s[i + 1] === '\n') i++;
        i++; cisloRadku++; radekZacatku = cisloRadku; continue;
      }
      bunka += c; i++;
    }
    if (vUvoz) chyba('Chybné CSV: neukončené uvozovky (od řádku ' + zacatekUvoz + ').');
    if (bunka !== '' || radek.length) { radek.push(bunka); radky.push({ bunky: radek, radek: radekZacatku }); }
    return radky.filter(r => r.bunky.some(b => b.trim() !== ''));
  }
  function odhadniOddelovac(text) {
    const s = String(text).replace(/^﻿/, '');
    const pocty = { ',': 0, ';': 0, '\t': 0 };
    let vUvoz = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') vUvoz = !vUvoz;
      else if (!vUvoz && (c === '\n' || c === '\r')) break;
      else if (!vUvoz && pocty[c] !== undefined) pocty[c]++;
    }
    let nej = ',';
    for (const k of ['\t', ';', ',']) if (pocty[k] > pocty[nej]) nej = k;
    return nej;
  }
  /* ochrana proti „CSV injection“: vzorec v tabulkovém procesoru se nespustí; čistá čísla zůstanou čísly */
  const NEBEZPECNE = /^'*[=+\-@\t\r]/;
  function bunkaCSV(v, oddelovac) {
    let s = v == null ? '' : String(v);
    if (NEBEZPECNE.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    if (s.indexOf(oddelovac) >= 0 || /["\r\n]/.test(s) || /^\s|\s$/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  const odBunky = s => (/^'+[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

  function doCSV(mapa, volby) {
    const od = (volby && volby.oddelovac) || ',';
    const bom = !(volby && volby.bom === false) ? '﻿' : '';
    const radek = bunky => bunky.map(b => bunkaCSV(b, od)).join(od);
    const atrKlice = [];
    for (const u of mapa.uzly) for (const [k] of u.atributy || []) if (atrKlice.indexOf(k) < 0) atrKlice.push(k);
    const skupinaUzlu = new Map();
    for (const s of mapa.skupiny || []) for (const id of s.uzly) if (!skupinaUzlu.has(id)) skupinaUzlu.set(id, s.nazev);
    const maSkupiny = skupinaUzlu.size > 0;
    const hl = ['id', 'nazev', 'typ', 'popis', 'datum', 'datumDo', 'tagy', 'odkaz', 'x', 'y', 'barva', 'obrazek'];
    if (maSkupiny) hl.push('skupina');
    const U = [radek(hl.concat(atrKlice.map(jmenoAtributu)))];
    for (const u of mapa.uzly) {
      const a = new Map(u.atributy || []);
      const b = [u.id, u.nazev, u.typ, u.popis, u.datum, u.datumDo, tagyNa(u.tagy || []), u.odkaz,
        konecne(u.x) ? cislo1(u.x) : '', konecne(u.y) ? cislo1(u.y) : '', u.barva || '', u.obrazek || ''];
      if (maSkupiny) b.push(skupinaUzlu.get(u.id) || '');
      U.push(radek(b.concat(atrKlice.map(k => (a.has(k) ? a.get(k) : '')))));
    }
    const H = [radek(['id', 'od', 'do', 'popis', 'typ', 'smer', 'styl', 'sila', 'barva'])];
    for (const h of platneHrany(mapa)) H.push(radek([h.id, h.od, h.do, h.popis, h.typ || '', h.smer || '->', h.styl || 'plna', h.sila || 1, h.barva || '']));
    return { uzly: bom + U.join('\r\n') + '\r\n', hrany: bom + H.join('\r\n') + '\r\n' };
  }

  /* tabulka → {druh:'hrany'|'uzly', hlavicka, radky, sloupce:{význam: index}} */
  function rozeberTabulku(text) {
    if (String(text == null ? '' : text).replace(/^﻿/, '').trim() === '') chyba('CSV je prázdné.');
    const odd = odhadniOddelovac(text);
    const radky = parsujCSV(text, odd);
    if (!radky.length) chyba('CSV je prázdné.');
    const hlavicka = radky[0].bunky.map(b => odBunky(b.trim()));
    const vyzH = hlavicka.map(h => VYZNAM_HRAN[norm(h)] || null);
    const jeHrany = vyzH.indexOf('od') >= 0 && vyzH.indexOf('do') >= 0;
    const sloupce = {};
    if (jeHrany) vyzH.forEach((v, i) => { if (v && sloupce[v] == null) sloupce[v] = i; });
    else hlavicka.forEach((h, i) => { const v = vyznamUzlu(h); if (v && v !== 'atribut' && sloupce[v] == null) sloupce[v] = i; });
    return { druh: jeHrany ? 'hrany' : 'uzly', oddelovac: odd, hlavicka, radky: radky.slice(1), sloupce };
  }
  function uzlyZTabulky(tab, varovani) {
    const s = tab.sloupce;
    if (s.nazev == null && s.id == null) chyba('V tabulce uzlů chybí sloupec s názvem (název / name / label) i id; pro tabulku vztahů čekám sloupce od/do (source/target).');
    const uzly = [], skupiny = new Map();
    const pouzite = new Set();
    let spatne = 0;
    for (const r of tab.radky) {
      if (r.bunky.length !== tab.hlavicka.length) spatne++;
      const b = i => (i == null || i >= r.bunky.length ? '' : odBunky(r.bunky[i]));
      const pole = [], atr = [];
      tab.hlavicka.forEach((h, i) => {
        const v = b(i);
        if (v === '') return;
        const vyz = vyznamUzlu(h);
        if (vyz === 'atribut') atr.push([bezPredpony(h), v]);
        else if (!vyz || s[vyz] !== i) { if (!vyz) atr.push([h, v]); }
        else if (vyz !== 'id') pole.push([vyz, v]);
      });
      const u = uzelZPoli(pole, atr);
      const id = b(s.id).trim();
      if (id) { u.id = id; pouzite.add(id); }
      if (!u.nazev && !id) continue;
      if (!u.nazev) u.nazev = id;
      uzly.push(u);
    }
    let k = 1;
    for (const u of uzly) {
      if (u.id == null) { while (pouzite.has('u' + k)) k++; u.id = 'u' + k; pouzite.add(u.id); }
      if (u._skupina) {
        const kl = u._skupina.toLowerCase();
        if (!skupiny.has(kl)) skupiny.set(kl, { id: 's' + (skupiny.size + 1), nazev: u._skupina, uzly: [] });
        skupiny.get(kl).uzly.push(u.id);
      }
      delete u._skupina;
    }
    if (spatne) varovani.push(spatne + ' řádků má jiný počet buněk než hlavička.');
    return { uzly, skupiny: [...skupiny.values()] };
  }
  function hranyZTabulky(tab, varovani) {
    const s = tab.sloupce;
    const hrany = [];
    let chybi = 0, spatne = 0;
    for (const r of tab.radky) {
      if (r.bunky.length !== tab.hlavicka.length) spatne++;
      const b = i => (i == null || i >= r.bunky.length ? '' : odBunky(r.bunky[i]).trim());
      const od = b(s.od), doU = b(s.do);
      if (!od || !doU) { chybi++; continue; }
      const h = { od, do: doU };
      if (b(s.id)) h.id = b(s.id);
      if (b(s.popis)) h.popis = b(s.popis);
      if (b(s.typ)) h.typ = b(s.typ);
      let smer = s.smer != null ? smerZ(b(s.smer)) : null;
      if (smer === '<-') { h.od = doU; h.do = od; smer = '->'; }
      if (smer) h.smer = smer;
      const st = stylZ(b(s.styl)); if (st) h.styl = st;
      const si = cisloZ(b(s.sila)); if (si !== undefined) h.sila = si;
      const ba = hexBarva(b(s.barva)); if (ba) h.barva = ba;
      hrany.push(h);
    }
    if (chybi) varovani.push(chybi + ' řádků tabulky vztahů nemá vyplněný začátek nebo konec – vynecháno.');
    if (spatne) varovani.push(spatne + ' řádků má jiný počet buněk než hlavička.');
    return hrany;
  }
  /* napojí konce hran na uzly podle id, pak podle názvu; chybějící uzly založí */
  function napojHrany(uzly, hrany, varovani) {
    const podleId = new Map(uzly.map(u => [u.id, u]));
    const podleNazvu = new Map();
    for (const u of uzly) { const k = String(u.nazev).toLowerCase(); if (!podleNazvu.has(k)) podleNazvu.set(k, u); }
    let nove = 0;
    const najdi = jm => {
      if (podleId.has(jm)) return podleId.get(jm).id;
      const k = jm.toLowerCase();
      if (podleNazvu.has(k)) return podleNazvu.get(k).id;
      let id = jm, n = 2;
      while (podleId.has(id)) id = jm + ' (' + n++ + ')';
      const u = { id, nazev: jm };
      uzly.push(u); podleId.set(id, u); podleNazvu.set(k, u); nove++;
      return id;
    };
    for (const h of hrany) { h.od = najdi(h.od); h.do = najdi(h.do); }
    return nove;
  }
  function zCSV(text) {
    const tab = rozeberTabulku(text);
    const d = prazdnaData('Importovaná tabulka');
    if (tab.druh === 'hrany') {
      d.hrany = hranyZTabulky(tab, d.varovani);
      napojHrany(d.uzly, d.hrany, d.varovani);
    } else {
      const r = uzlyZTabulky(tab, d.varovani);
      d.uzly = r.uzly;
      if (r.skupiny.length) d.skupiny = r.skupiny;
    }
    prevedTypyUzlu(d.uzly, null);
    zajistiTypyVztahu(d, d.hrany);
    d.tabulka = tab.druh;
    return d;
  }
  function zCSVDvojice(uzlyText, hranyText) {
    const d = prazdnaData('Importovaná tabulka');
    if (uzlyText && String(uzlyText).trim()) {
      const tab = rozeberTabulku(uzlyText);
      if (tab.druh === 'hrany') chyba('První soubor vypadá jako tabulka vztahů (má sloupce od/do) – čekám tabulku uzlů.');
      const r = uzlyZTabulky(tab, d.varovani);
      d.uzly = r.uzly;
      if (r.skupiny.length) d.skupiny = r.skupiny;
    }
    if (hranyText && String(hranyText).trim()) {
      const tab = rozeberTabulku(hranyText);
      if (tab.druh !== 'hrany') chyba('Druhý soubor nemá sloupce začátku a konce vztahu (od/do, source/target, from/to, zdroj/cíl).');
      d.hrany = hranyZTabulky(tab, d.varovani);
      const nove = napojHrany(d.uzly, d.hrany, d.varovani);
      if (nove && d.uzly.length > nove) d.varovani.push(nove + ' uzlů z tabulky vztahů v tabulce uzlů chybělo – doplněny podle názvu.');
    }
    prevedTypyUzlu(d.uzly, null);
    zajistiTypyVztahu(d, d.hrany);
    return d;
  }

  /* ============================================================
     DOT (Graphviz)
     ============================================================ */
  const dotStr = s => '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n').replace(/\r/g, '\\n') + '"';
  const TVAR_DOT = { zaobleny: 'shape=box, style="rounded"', kapsle: 'shape=box, style="rounded,bold"', ostry: 'shape=box', elipsa: 'shape=ellipse' };

  function doDOT(mapa) {
    const o = [];
    o.push('digraph ' + dotStr(mapa.nazev || 'mapa') + ' {');
    o.push('  graph [label=' + dotStr(mapa.nazev || '') + ', labelloc=t, fontname="Helvetica", overlap=false' +
      (mapa.popis ? ', popis=' + dotStr(mapa.popis) : '') + ', mapa_typy=' + dotStr(typyJSON(mapa)) + ', mapa_typyVztahu=' + dotStr(typyVztahuJSON(mapa)) + '];');
    o.push('  node [fontname="Helvetica", fontsize=11];');
    o.push('  edge [fontname="Helvetica", fontsize=9];');
    const veSkupine = new Map();
    for (const s of mapa.skupiny || []) for (const id of s.uzly) if (!veSkupine.has(id)) veSkupine.set(id, s.id);
    const uzel = (u, odsaz) => {
      const t = typMapy(mapa, u);
      const a = ['label=' + dotStr(u.nazev), TVAR_DOT[t.tvar] || TVAR_DOT.zaobleny, 'color=' + dotStr(u.barva || t.barva || '#7b8794')];
      if (u.typ) a.push('typ=' + dotStr(u.typ));
      if (u.popis) a.push('tooltip=' + dotStr(u.popis), 'popis=' + dotStr(u.popis));
      if (u.datum) a.push('datum=' + dotStr(u.datum));
      if (u.datumDo) a.push('datumDo=' + dotStr(u.datumDo));
      if (u.tagy && u.tagy.length) a.push('tagy=' + dotStr(tagyNa(u.tagy)));
      if (u.odkaz) a.push('URL=' + dotStr(u.odkaz));
      if (u.barva) a.push('barva=' + dotStr(u.barva));
      if (u.obrazek) a.push('obrazek=' + dotStr(u.obrazek));
      if (konecne(u.x) && konecne(u.y)) a.push('pos=' + dotStr(cislo1(u.x) + ',' + cislo1(-u.y) + '!'));
      for (const [k, v] of u.atributy || []) a.push(dotStr(PREDPONA_ATR + k) + '=' + dotStr(v));
      o.push(odsaz + dotStr(u.id) + ' [' + a.join(', ') + '];');
    };
    for (const u of mapa.uzly) uzel(u, '  ');   /* všechny uzly v původním pořadí; clustery na ně jen odkazují */
    const podleId = new Map(mapa.uzly.map(u => [u.id, u]));
    (mapa.skupiny || []).forEach((s, i) => {
      o.push('  subgraph ' + dotStr('cluster_' + i) + ' {');
      o.push('    label=' + dotStr(s.nazev) + '; color=' + dotStr(s.barva || '#7b8794') + '; skupina=' + dotStr(s.id) + ';');
      for (const id of s.uzly) if (veSkupine.get(id) === s.id && podleId.has(id)) o.push('    ' + dotStr(id) + ';');
      o.push('  }');
    });
    for (const h of platneHrany(mapa)) {
      const tv = typVztahuMapy(mapa, h);
      const a = [];
      const st = stitek(mapa, h);
      if (st) a.push('label=' + dotStr(st));
      if (st && !h.popis) a.push('popis=""');
      a.push('id=' + dotStr(h.id));
      if (h.smer === '--') a.push('dir=none'); else if (h.smer === '<->') a.push('dir=both');
      if (h.typ) a.push('typ=' + dotStr(h.typ));
      const bar = h.barva || (tv && tv.barva);
      if (bar) a.push('color=' + dotStr(bar));
      if (h.barva) a.push('barva=' + dotStr(h.barva));
      if (h.styl === 'carkovana') a.push('style=dashed'); else if (h.styl === 'teckovana') a.push('style=dotted');
      if (h.sila && h.sila !== 1) a.push('penwidth=' + h.sila);
      o.push('  ' + dotStr(h.od) + ' -> ' + dotStr(h.do) + ' [' + a.join(', ') + '];');
    }
    o.push('}');
    return o.join('\n') + '\n';
  }

  function tokenyDOT(text) {
    const s = String(text == null ? '' : text).replace(/^﻿/, '');
    const n = s.length;
    const t = [];
    let i = 0, radek = 1, zacRadku = true;
    const err = m => chyba('Chybný DOT na řádku ' + radek + ': ' + m);
    while (i < n) {
      const c = s[i];
      if (c === '\n') { radek++; i++; zacRadku = true; continue; }
      if (c === ' ' || c === '\t' || c === '\r' || c === '\f') { i++; continue; }
      if (c === '#' && zacRadku) { while (i < n && s[i] !== '\n') i++; continue; }
      zacRadku = false;
      if (c === '/' && s[i + 1] === '/') { while (i < n && s[i] !== '\n') i++; continue; }
      if (c === '/' && s[i + 1] === '*') {
        const k = s.indexOf('*/', i + 2);
        if (k < 0) err('neukončený komentář /*');
        for (let j = i; j < k; j++) if (s[j] === '\n') radek++;
        i = k + 2; continue;
      }
      if (c === '"') {
        const r0 = radek;
        let v = '';
        i++;
        for (;;) {
          if (i >= n) { radek = r0; err('neukončený řetězec v uvozovkách'); }
          const z = s[i];
          if (z === '\\' && s[i + 1] === '"') { v += '"'; i += 2; continue; }
          if (z === '\\' && s[i + 1] === '\n') { i += 2; radek++; continue; }
          if (z === '\\' && s[i + 1] === '\r' && s[i + 2] === '\n') { i += 3; radek++; continue; }
          if (z === '\\' && s[i + 1] === '\\') { v += '\\\\'; i += 2; continue; }
          if (z === '"') { i++; break; }
          if (z === '\n') radek++;
          v += z; i++;
        }
        const pred = t[t.length - 1];
        if (pred && pred.spojit) { pred.v += v; pred.spojit = false; }
        else t.push({ t: 'str', v, radek: r0 });
        continue;
      }
      if (c === '+' && t.length && t[t.length - 1].t === 'str') { t[t.length - 1].spojit = true; i++; continue; }
      if (c === '<') {
        const r0 = radek;
        let h = 1, j = i + 1;
        while (j < n && h > 0) { if (s[j] === '<') h++; else if (s[j] === '>') h--; else if (s[j] === '\n') radek++; j++; }
        if (h > 0) { radek = r0; err('neukončený HTML popisek <…>'); }
        t.push({ t: 'html', v: s.slice(i + 1, j - 1), radek: r0 });
        i = j; continue;
      }
      if (c === '-' && (s[i + 1] === '>' || s[i + 1] === '-')) { t.push({ t: 'op', v: s.slice(i, i + 2), radek }); i += 2; continue; }
      if ('{}[];,=:'.indexOf(c) >= 0) { t.push({ t: 'p', v: c, radek }); i++; continue; }
      const m = /^(-?(?:\.\d+|\d+(?:\.\d*)?)|[A-Za-z_\u0080-￿][\w\u0080-￿]*)/.exec(s.slice(i, i + 400));
      if (m) { t.push({ t: 'id', v: m[1], radek }); i += m[1].length; continue; }
      err('neočekávaný znak „' + c + '“');
    }
    return t;
  }
  function textDOT(tok, idUzlu) {
    if (!tok) return '';
    if (tok.t === 'html') return tok.v.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    if (tok.t !== 'str') return tok.v;
    return tok.v.replace(/\\(.)/g, (m, z) => (z === 'n' || z === 'l' || z === 'r' ? '\n' : z === '\\' ? '\\' : z === 'N' && idUzlu != null ? idUzlu : m));
  }

  function zDOT(text) {
    const T = tokenyDOT(text);
    let p = 0;
    const varovani = [];
    const kde = () => (T[p] ? T[p].radek : (T.length ? T[T.length - 1].radek : 1));
    const err = m => chyba('Chybný DOT na řádku ' + kde() + ': ' + m);
    const je = (t, v) => T[p] && T[p].t === t && (v == null || T[p].v === v);
    const klic = v => T[p] && T[p].t === 'id' && T[p].v.toLowerCase() === v;
    const ocekavej = (t, v) => { if (!je(t, v)) err('čekám „' + v + '“' + (T[p] ? ', nalezeno „' + T[p].v + '“' : ', soubor ale skončil')); return T[p++]; };
    const jeId = () => T[p] && (T[p].t === 'id' || T[p].t === 'str' || T[p].t === 'html');
    if (klic('strict')) p++;
    let orient;
    if (klic('digraph')) orient = true; else if (klic('graph')) orient = false;
    else err('soubor nezačíná „graph“ ani „digraph“');
    p++;
    let jmenoGrafu = null;
    if (jeId()) jmenoGrafu = textDOT(T[p++]);
    ocekavej('p', '{');
    const uzly = new Map();   /* id → {atributy} */
    const poradi = [];
    const hrany = [];
    const atrGrafu = {};
    const skupiny = [];
    const priradit = new Map();   /* uzel → skupina (nejvnitřnější) */
    const atrSeznam = () => {
      const a = {};
      while (je('p', '[')) {
        p++;
        while (!je('p', ']')) {
          if (!T[p]) err('neukončený seznam atributů [');
          if (!jeId()) err('čekám jméno atributu, nalezeno „' + T[p].v + '“');
          const k = textDOT(T[p++]);
          if (je('p', '=')) { p++; if (!jeId()) err('chybí hodnota atributu „' + k + '“'); a[k] = T[p++]; }
          else a[k] = { t: 'id', v: 'true' };
          if (je('p', ',') || je('p', ';')) p++;
        }
        p++;
      }
      return a;
    };
    const zajistiUzel = (id, rozsah) => {
      if (!uzly.has(id)) { uzly.set(id, Object.assign({}, rozsah.uzel)); poradi.push(id); }
      for (const m of rozsah.cleni) m.add(id);
      return uzly.get(id);
    };
    const idUzlu = () => {
      const id = textDOT(T[p++]);
      if (je('p', ':')) { p++; if (jeId()) p++; if (je('p', ':')) { p++; if (jeId()) p++; } }   /* porty se zahodí */
      return id;
    };
    const podgraf = rozsah => {
      let jm = null;
      if (klic('subgraph')) { p++; if (jeId()) jm = textDOT(T[p++]); }
      ocekavej('p', '{');
      const clenove = new Set();
      const vnitrni = { uzel: Object.assign({}, rozsah.uzel), hrana: Object.assign({}, rozsah.hrana), graf: {}, cleni: rozsah.cleni.concat([clenove]) };
      prikazy(vnitrni);
      ocekavej('p', '}');
      if (jm && /^cluster/i.test(jm)) {
        const g = vnitrni.graf;
        const sk = { id: g.skupina ? textDOT(g.skupina) : 'sk' + (skupiny.length + 1), nazev: g.label ? textDOT(g.label) : jm.replace(/^cluster_?/i, '') || 'Skupina', barva: hexBarva(g.color ? textDOT(g.color) : g.fillcolor ? textDOT(g.fillcolor) : null) || undefined, uzly: [] };
        for (const id of clenove) if (!priradit.has(id)) { priradit.set(id, sk); sk.uzly.push(id); }
        skupiny.push(sk);
      }
      return [...clenove];
    };
    const operand = rozsah => (je('p', '{') || klic('subgraph') ? podgraf(rozsah) : [zajistiUzelVrat(idUzlu(), rozsah)]);
    const zajistiUzelVrat = (id, rozsah) => { zajistiUzel(id, rozsah); return id; };
    const prikaz = rozsah => {
      if ((klic('graph') || klic('node') || klic('edge')) && T[p + 1] && T[p + 1].t === 'p' && T[p + 1].v === '[') {
        const co = T[p++].v.toLowerCase();
        const a = atrSeznam();
        if (co === 'graph') Object.assign(rozsah.graf, a);
        else Object.assign(co === 'node' ? rozsah.uzel : rozsah.hrana, a);
        return;
      }
      if (jeId() && !klic('subgraph') && T[p + 1] && T[p + 1].t === 'p' && T[p + 1].v === '=') {
        const k = textDOT(T[p]); p += 2;
        if (!jeId()) err('chybí hodnota za „' + k + ' =“');
        rozsah.graf[k] = T[p++];
        return;
      }
      if (!jeId() && !je('p', '{') && !klic('subgraph')) err('neočekávané „' + (T[p] ? T[p].v : 'konec souboru') + '“');
      const prvni = je('p', '{') || klic('subgraph');
      let leve = operand(rozsah);
      if (!je('op')) {
        if (!prvni) { const a = atrSeznam(); Object.assign(uzly.get(leve[0]), a); }
        return;
      }
      const useky = [];
      while (je('op')) {
        const op = T[p++].v;
        if (op === '->' && !orient) varovani.push('Řádek ' + T[p - 1].radek + ': „->“ v neorientovaném grafu.');
        if (!jeId() && !je('p', '{') && !klic('subgraph')) err('vztahu chybí cílový uzel');
        const prave = operand(rozsah);
        useky.push([leve, prave, op]);
        leve = prave;
      }
      const a = Object.assign({}, rozsah.hrana, atrSeznam());
      for (const [L, P, op] of useky) for (const x of L) for (const y of P) hrany.push({ od: x, do: y, op, a });
    };
    const prikazy = rozsah => {
      while (T[p] && !je('p', '}')) {
        if (je('p', ';')) { p++; continue; }
        prikaz(rozsah);
        if (je('p', ';')) p++;
      }
    };
    const horni = { uzel: {}, hrana: {}, graf: atrGrafu, cleni: [] };
    prikazy(horni);
    ocekavej('p', '}');
    if (T[p]) varovani.push('Text za koncem grafu (řádek ' + T[p].radek + ') ignorován.');

    const d = prazdnaData(jmenoGrafu || 'Importovaný graf');
    d.varovani = varovani;
    const ga = k => (atrGrafu[k] ? textDOT(atrGrafu[k]) : null);
    if (ga('label')) d.nazev = ga('label').trim() || d.nazev;
    if (ga('popis')) d.popis = ga('popis'); else if (ga('comment')) d.popis = ga('comment');
    const t1 = jsonNebo(ga('mapa_typy'), varovani, 'typy uzlů'); if (Array.isArray(t1)) d.typy = t1;
    const t2 = jsonNebo(ga('mapa_typyVztahu'), varovani, 'typy vztahů'); if (Array.isArray(t2)) d.typyVztahu = t2;
    const nas = !!d.typy;
    for (const id of poradi) {
      const a = uzly.get(id);
      const v = k => (a[k] ? textDOT(a[k], id) : null);
      const u = { id, nazev: v('label') != null && v('label') !== '' ? v('label') : id };
      const typ = v('typ') || v('type') || v('group');
      if (typ) u.typ = typ;
      const popis = v('popis') != null ? v('popis') : v('tooltip') || v('comment');
      if (popis) u.popis = popis;
      if (v('datum')) u.datum = v('datum');
      if (v('datumDo')) u.datumDo = v('datumDo');
      if (v('tagy')) u.tagy = tagyZ(v('tagy'));
      const url = v('URL') || v('href') || v('url') || v('odkaz');
      if (url) u.odkaz = url;
      if (v('obrazek')) u.obrazek = v('obrazek');
      const b = v('barva') ? hexBarva(v('barva')) : nas ? null : hexBarva(v('fillcolor') || v('color'));
      if (b) u.barva = b;
      const pos = v('pos');
      if (pos) { const m = pos.match(/^\s*(-?[\d.]+(?:e[-+]?\d+)?)\s*,\s*(-?[\d.]+(?:e[-+]?\d+)?)/i); if (m) { u.x = +m[1]; u.y = -m[2] || 0; } }
      const atr = [];
      for (const k of Object.keys(a)) if (k.toLowerCase().startsWith(PREDPONA_ATR)) atr.push([k.slice(PREDPONA_ATR.length), textDOT(a[k], id)]);
      if (atr.length) u.atributy = atr;
      d.uzly.push(u);
    }
    for (const e of hrany) {
      const v = k => (e.a[k] ? textDOT(e.a[k]) : null);
      const h = { od: e.od, do: e.do };
      if (v('id')) h.id = v('id');
      const popis = v('popis') != null ? v('popis') : v('label') || v('xlabel');
      if (popis) h.popis = popis;
      if (v('typ') || v('type')) h.typ = v('typ') || v('type');
      const dir = (v('dir') || '').toLowerCase();
      let smer = e.op === '--' ? '--' : '->';
      if (dir === 'none') smer = '--';
      else if (dir === 'both') smer = '<->';
      else if (dir === 'forward') smer = '->';
      else if (dir === 'back') { h.od = e.do; h.do = e.od; smer = '->'; }
      h.smer = smer;
      const styl = (v('style') || '').toLowerCase();
      if (/dashed/.test(styl)) h.styl = 'carkovana'; else if (/dotted/.test(styl)) h.styl = 'teckovana';
      const pw = cisloZ(v('penwidth')); if (pw !== undefined) h.sila = pw;
      const b = v('barva') ? hexBarva(v('barva')) : nas ? null : hexBarva(v('color'));
      if (b) h.barva = b;
      d.hrany.push(h);
    }
    if (skupiny.length) d.skupiny = skupiny.filter(s => s.uzly.length);
    if (!nas) { prevedTypyUzlu(d.uzly, null); zajistiTypyVztahu(d, d.hrany); }
    return d;
  }

  /* ============================================================
     Mermaid (flowchart) – jen export
     ============================================================ */
  /* text do uvozovek Mermaidu: vše, co by mohlo rozbít syntaxi, jako číselná entita #NN; */
  const mText = s => String(s == null ? '' : s).replace(/\r/g, '')
    .replace(/["#&<>()[\]{}|;`\\]/g, c => (c === '"' ? '#quot;' : '#' + c.codePointAt(0) + ';'))
    .replace(/\n/g, '<br/>');
  function doMermaid(mapa) {
    const o = ['flowchart LR'];
    if (mapa.nazev) o.push('  %% ' + String(mapa.nazev).replace(/[\r\n]+/g, ' '));
    const mid = new Map(mapa.uzly.map((u, i) => [u.id, 'n' + i]));
    const typId = new Map((mapa.typy || []).map((t, i) => [t.id, 't' + i]));
    const tvar = (u, txt) => {
      const tv = typMapy(mapa, u).tvar;
      const q = '"' + txt + '"';
      return tv === 'kapsle' ? '([' + q + '])' : tv === 'ostry' ? '[' + q + ']' : tv === 'elipsa' ? '((' + q + '))' : '(' + q + ')';
    };
    const uzel = (u, odsaz) => {
      const t = typMapy(mapa, u);
      const txt = (t.ikona ? mText(t.ikona) + ' ' : '') + mText(u.nazev);
      o.push(odsaz + mid.get(u.id) + tvar(u, txt));
    };
    const veSkupine = new Map();
    for (const s of mapa.skupiny || []) for (const id of s.uzly) if (!veSkupine.has(id) && mid.has(id)) veSkupine.set(id, s.id);
    for (const u of mapa.uzly) if (!veSkupine.has(u.id)) uzel(u, '  ');
    const podleId = new Map(mapa.uzly.map(u => [u.id, u]));
    (mapa.skupiny || []).forEach((s, i) => {
      const clenove = s.uzly.filter(id => veSkupine.get(id) === s.id);
      if (!clenove.length) return;
      o.push('  subgraph sg' + i + '["' + mText(s.nazev) + '"]');
      for (const id of clenove) uzel(podleId.get(id), '    ');
      o.push('  end');
    });
    const styly = [];
    platneHrany(mapa).forEach((h, i) => {
      const tl = (h.sila || 1) >= 3, car = h.styl === 'carkovana' || h.styl === 'teckovana';
      let sip;
      if (h.smer === '--') sip = tl ? '===' : car ? '-.-' : '---';
      else if (h.smer === '<->') sip = tl ? '<==>' : car ? '<-.->' : '<-->';
      else sip = tl ? '==>' : car ? '-.->' : '-->';
      const st = stitek(mapa, h);
      o.push('  ' + mid.get(h.od) + ' ' + sip + (st ? '|"' + mText(st) + '"|' : '') + ' ' + mid.get(h.do));
      const tv = typVztahuMapy(mapa, h);
      const bar = h.barva || (tv && tv.barva);
      if (jeHex(bar)) styly.push('  linkStyle ' + i + ' stroke:' + bar + (h.styl === 'teckovana' ? ',stroke-dasharray:2 4' : ''));
    });
    for (const t of mapa.typy || []) {
      const cl = typId.get(t.id);
      const ids = mapa.uzly.filter(u => typMapy(mapa, u).id === t.id).map(u => mid.get(u.id));
      if (!ids.length) continue;
      o.push('  classDef ' + cl + ' fill:#ffffff,stroke:' + (jeHex(t.barva) ? t.barva : '#7b8794') + ',stroke-width:2px,color:#1f2328');
      o.push('  class ' + ids.join(',') + ' ' + cl);
    }
    for (const u of mapa.uzly) if (jeHex(u.barva)) o.push('  style ' + mid.get(u.id) + ' stroke:' + u.barva);
    (mapa.skupiny || []).forEach((s, i) => { if (jeHex(s.barva) && s.uzly.some(id => veSkupine.get(id) === s.id)) o.push('  style sg' + i + ' stroke:' + s.barva + ',fill:none'); });
    return o.concat(styly).join('\n') + '\n';
  }

  /* ============================================================
     Markdown – čitelná osnova
     ============================================================ */
  const mdE = s => String(s == null ? '' : s).replace(/\r/g, '').replace(/([\\`*_{}[\]<>#|!~])/g, '\\$1');
  const mdOdst = s => mdE(s).split('\n').map(r => r.replace(/^(\s*)([-+]|\d+\.)(\s)/, '$1\\$2$3')).join('  \n');
  function doMarkdown(mapa) {
    const o = ['# ' + mdE(mapa.nazev || 'Mapa souvislostí'), ''];
    if (mapa.popis) o.push(mdOdst(mapa.popis), '');
    const podleId = new Map(mapa.uzly.map(u => [u.id, u]));
    const hrany = platneHrany(mapa);
    const ven = new Map(), dovnitr = new Map();
    for (const h of hrany) {
      if (!ven.has(h.od)) ven.set(h.od, []); ven.get(h.od).push(h);
      if (!dovnitr.has(h.do)) dovnitr.set(h.do, []); dovnitr.get(h.do).push(h);
    }
    const nm = id => '**' + mdE(podleId.get(id).nazev) + '**';
    const sipka = (h, ven) => {
      const st = stitek(mapa, h);
      if (h.smer === '<->') return '↔ ' + (st ? mdE(st) + ' ↔ ' : '');
      if (h.smer === '--') return '— ' + (st ? mdE(st) + ' — ' : '');
      return ven ? '→ ' + (st ? mdE(st) + ' → ' : '') : '← ' + (st ? mdE(st) + ' ← ' : '');
    };
    const uzel = u => {
      const hl = ['**' + mdE(u.nazev) + '**'];
      if (u.datum) hl.push(mdE(u.datum + (u.datumDo ? ' – ' + u.datumDo : '')));
      o.push('### ' + hl.join(' · '), '');
      if (u.popis) o.push(mdOdst(u.popis), '');
      const od = [];
      for (const [k, v] of u.atributy || []) od.push('- ' + mdE(k) + ': ' + mdE(v));
      if (u.tagy && u.tagy.length) od.push('- Štítky: ' + u.tagy.map(t => '`' + String(t).replace(/`/g, "'") + '`').join(', '));
      if (u.odkaz) od.push('- Odkaz: ' + (/^https?:\/\/[^\s<>]+$/i.test(u.odkaz) ? '<' + u.odkaz + '>' : mdE(u.odkaz)));
      if (od.length) o.push(...od, '');
      const sv = [];
      for (const h of ven.get(u.id) || []) sv.push('- ' + sipka(h, true) + nm(h.do));
      for (const h of dovnitr.get(u.id) || []) sv.push('- ' + sipka(h, false) + nm(h.od));
      if (sv.length) o.push('Souvislosti:', '', ...sv, '');
    };
    for (const t of mapa.typy || []) {
      const uz = mapa.uzly.filter(u => typMapy(mapa, u).id === t.id);
      if (!uz.length) continue;
      o.push('## ' + (t.ikona ? t.ikona + ' ' : '') + mdE(t.nazev) + ' (' + uz.length + ')', '');
      uz.forEach(uzel);
    }
    const sk = (mapa.skupiny || []).filter(s => s.uzly.some(id => podleId.has(id)));
    if (sk.length) {
      o.push('## Skupiny', '');
      for (const s of sk) {
        o.push('### ' + mdE(s.nazev), '');
        for (const id of s.uzly) if (podleId.has(id)) o.push('- ' + mdE(podleId.get(id).nazev));
        o.push('');
      }
    }
    return o.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n');
  }

  /* ============================================================
     Sdílení odkazem – kompaktní JSON → deflate-raw → base64url
     Kód začíná verzí: „1“ = zkomprimováno, „0“ = bez komprese (když CompressionStream chybí).
     ============================================================ */
  const b64url = bytes => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const zB64url = s => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  };
  async function proud(bytes, transformace) {
    const r = new Blob([bytes]).stream().pipeThrough(transformace).getReader();
    const kusy = [];
    let delka = 0;
    for (;;) { const { done, value } = await r.read(); if (done) break; kusy.push(value); delka += value.length; }
    const v = new Uint8Array(delka);
    let k = 0;
    for (const c of kusy) { v.set(c, k); k += c.length; }
    return v;
  }
  const stejne = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function kompaktni(mapa) {
    let vynechano = 0;
    const o = { v: 1, n: mapa.nazev || '' };
    if (mapa.popis) o.p = mapa.popis;
    const typy = mapa.typy || [];
    if (!stejne(typy, vychoziTypy())) o.t = typy.map(t => [t.id, t.nazev, t.ikona || '', t.barva, t.tvar]);
    if (!stejne(mapa.typyVztahu || [], vychoziTypyVztahu())) o.r = (mapa.typyVztahu || []).map(t => [t.id, t.nazev, t.barva || 0, t.styl, t.smer]);
    const prvniTyp = typy[0] ? typy[0].id : null;
    const index = new Map(mapa.uzly.map((u, i) => [u.id, i]));
    o.u = mapa.uzly.map((u, i) => {
      const z = { n: u.nazev };
      if (u.id !== 'u' + (i + 1)) z.i = u.id;
      if (u.typ && u.typ !== prvniTyp) z.t = u.typ;
      if (u.popis) z.p = u.popis;
      if (u.datum) z.d = u.datum;
      if (u.datumDo) z.e = u.datumDo;
      if (u.tagy && u.tagy.length) z.g = u.tagy;
      if (u.odkaz) z.o = u.odkaz;
      if (konecne(u.x) && konecne(u.y)) { z.x = Math.round(u.x); z.y = Math.round(u.y); }
      if (u.barva) z.b = u.barva;
      if (u.rozbaleny) z.R = 1;
      if (u.zamceny) z.Z = 1;
      if (u.atributy && u.atributy.length) z.a = u.atributy;
      if (u.obrazek) { if (/^data:/i.test(u.obrazek)) vynechano++; else z.m = u.obrazek; }
      return z;
    });
    o.h = [];
    mapa.hrany.forEach(h => {
      if (!index.has(h.od) || !index.has(h.do)) return;
      const z = [index.get(h.od), index.get(h.do)];
      const x = {};
      if (h.id !== 'h' + (o.h.length + 1)) x.i = h.id;
      if (h.popis) x.p = h.popis;
      if (h.typ) x.t = h.typ;
      if (h.smer && h.smer !== '->') x.s = h.smer;
      if (h.styl && h.styl !== 'plna') x.l = h.styl;
      if (h.sila && h.sila !== 1) x.w = h.sila;
      if (h.barva) x.b = h.barva;
      if (Object.keys(x).length) z.push(x);
      o.h.push(z);
    });
    const idx = ids => ids.filter(id => index.has(id)).map(id => index.get(id));
    if ((mapa.skupiny || []).length) o.s = mapa.skupiny.map((s, i) => { const z = { n: s.nazev, u: idx(s.uzly) }; if (s.id !== 's' + (i + 1)) z.i = s.id; if (s.barva) z.b = s.barva; return z; });
    if ((mapa.pribehy || []).length) o.k = mapa.pribehy.map(p => ({ i: p.id, n: p.nazev, s: (p.kroky || []).map(k => { const z = { i: k.id, u: idx(k.uzly || []) }; if (k.titulek) z.t = k.titulek; if (k.poznamka) z.p = k.poznamka; return z; }) }));
    return { o, vynechano };
  }
  function zKompaktni(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.u)) chyba('Odkaz neobsahuje mapu.');
    const d = { format: FORMAT, verze: 2, nazev: o.n || 'Sdílená mapa', popis: o.p || '' };
    if (Array.isArray(o.t)) d.typy = o.t.map(t => ({ id: t[0], nazev: t[1], ikona: t[2], barva: t[3], tvar: t[4] }));
    if (Array.isArray(o.r)) d.typyVztahu = o.r.map(t => ({ id: t[0], nazev: t[1], barva: t[2] || null, styl: t[3], smer: t[4] }));
    const typy = d.typy || vychoziTypy();
    const prvni = typy[0] ? typy[0].id : undefined;
    d.uzly = o.u.map((z, i) => {
      z = z || {};
      const u = { id: z.i != null ? z.i : 'u' + (i + 1), nazev: z.n, typ: z.t != null ? z.t : prvni, popis: z.p || '', datum: z.d || '', datumDo: z.e || '',
        tagy: z.g || [], odkaz: z.o || '', barva: z.b || null, atributy: z.a || [], obrazek: z.m || '' };
      if (z.x != null && z.y != null) { u.x = z.x; u.y = z.y; }
      if (z.R) u.rozbaleny = true;
      if (z.Z) u.zamceny = true;
      return u;
    });
    const id = i => (d.uzly[i] ? d.uzly[i].id : null);
    d.hrany = (Array.isArray(o.h) ? o.h : []).map((z, k) => {
      if (!Array.isArray(z)) return null;
      const x = z[2] || {};
      return { id: x.i != null ? x.i : 'h' + (k + 1), od: id(z[0]), do: id(z[1]), popis: x.p || '', typ: x.t || null, smer: x.s || '->', styl: x.l || 'plna', sila: x.w || 1, barva: x.b || null };
    }).filter(Boolean);
    if (Array.isArray(o.s)) d.skupiny = o.s.map((s, i) => ({ id: s.i != null ? s.i : 's' + (i + 1), nazev: s.n, barva: s.b, uzly: (s.u || []).map(id).filter(Boolean) }));
    if (Array.isArray(o.k)) d.pribehy = o.k.map(p => ({ id: p.i, nazev: p.n, kroky: (p.s || []).map(k => ({ id: k.i, titulek: k.t || '', poznamka: k.p || '', uzly: (k.u || []).map(id).filter(Boolean) })) }));
    d.varovani = [];
    return d;
  }
  const lzeKomprimovat = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function' && typeof Blob === 'function';
  async function zakodujOdkaz(mapa) {
    const { o, vynechano } = kompaktni(mapa);
    const bajty = new TextEncoder().encode(JSON.stringify(o));
    let kod;
    if (lzeKomprimovat()) kod = '1' + b64url(await proud(bajty, new CompressionStream('deflate-raw')));
    else kod = '0' + b64url(bajty);
    return { kod, delka: kod.length, vynechanoObrazku: vynechano };
  }
  async function dekodujOdkaz(retezec) {
    let s = String(retezec == null ? '' : retezec).trim();
    if (s.indexOf('#') >= 0) s = s.slice(s.lastIndexOf('#') + 1);
    s = s.replace(/^[a-z]+=/i, '');
    try { s = decodeURIComponent(s); } catch (e) { /* nechat */ }
    if (!/^[01][A-Za-z0-9_-]+$/.test(s)) chyba('Odkaz na mapu je neplatný nebo neúplný.');
    let bajty;
    try { bajty = zB64url(s.slice(1)); } catch (e) { chyba('Odkaz na mapu je poškozený (neplatné znaky).'); }
    if (s[0] === '1') {
      if (!lzeKomprimovat()) chyba('Tento prohlížeč neumí rozbalit zkomprimovaný odkaz.');
      try { bajty = await proud(bajty, new DecompressionStream('deflate-raw')); } catch (e) { chyba('Odkaz na mapu je poškozený nebo zkrácený.'); }
    }
    let o;
    try { o = JSON.parse(new TextDecoder().decode(bajty)); } catch (e) { chyba('Odkaz na mapu je poškozený (data nejsou čitelná).'); }
    return zKompaktni(o);
  }

  /* ============================================================
     Rozpoznání formátu souboru
     ============================================================ */
  function rozpoznej(text, nazevSouboru) {
    const s = String(text == null ? '' : text).replace(/^﻿/, '');
    const pr = (String(nazevSouboru || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
    const zacatek = s.trimStart();
    const vysl = (format, data) => ({ format, data: data || null, varovani: data && data.varovani ? data.varovani : [] });
    let format = null;
    if (pr === 'json' || pr === 'cyjs') format = 'json';
    else if (pr === 'graphml') format = 'graphml';
    else if (pr === 'gexf') format = 'gexf';
    else if (pr === 'csv' || pr === 'tsv') format = 'csv';
    else if (pr === 'dot' || pr === 'gv') format = 'dot';
    if (!format) {
      if (/^[{[]/.test(zacatek)) format = 'json';
      else if (/^</.test(zacatek)) {
        const m = zacatek.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/gi, '').trimStart().match(/^<([\w:.-]+)/);
        const k = m ? lokal(m[1]).toLowerCase() : '';
        format = k === 'gexf' ? 'gexf' : k === 'graphml' ? 'graphml' : 'text';
      } else if (/^(\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*|#[^\n]*\n\s*)*(strict\s+)?(di)?graph\b[^{\n]*\{/i.test(zacatek)) format = 'dot';
      else if (jakoCSV(s)) format = 'csv';
      else format = 'text';
    }
    if (format === 'json' || format === 'text') return vysl(format, null);
    const prevod = { graphml: zGraphML, gexf: zGEXF, csv: zCSV, dot: zDOT }[format];
    return vysl(format, prevod(s));
  }
  /* vypadá text jako tabulka s hlavičkou, kterou poznáme? */
  function jakoCSV(s) {
    const prvni = s.split(/\r?\n/)[0] || '';
    const odd = odhadniOddelovac(s);
    if (prvni.indexOf(odd) < 0) return false;
    let hl;
    try { hl = parsujCSV(prvni, odd)[0].bunky; } catch (e) { return false; }
    if (hl.length < 2) return false;
    const vyz = hl.map(h => VYZNAM_HRAN[norm(h)] || VYZNAM_UZLU[norm(h)]);
    return (hl.some(h => VYZNAM_HRAN[norm(h)] === 'od') && hl.some(h => VYZNAM_HRAN[norm(h)] === 'do')) || vyz.some(v => v === 'nazev' || v === 'id');
  }

  const FORMATY = [
    { id: 'graphml', nazev: 'GraphML', pripona: '.graphml', mime: 'application/graphml+xml', popis: 'Pro yEd, Gephi, Cytoscape a networkx – všechna pole, typy i skupiny.' },
    { id: 'gexf', nazev: 'GEXF', pripona: '.gexf', mime: 'application/gexf+xml', popis: 'Nativní formát Gephi (1.3) – pozice, barvy a atributy.' },
    { id: 'csv', nazev: 'CSV (uzly + vztahy)', pripona: '.csv', mime: 'text/csv', popis: 'Dvě tabulky pro Excel a tabulkové procesory: …_uzly.csv a …_vztahy.csv.' },
    { id: 'dot', nazev: 'Graphviz DOT', pripona: '.dot', mime: 'text/vnd.graphviz', popis: 'Pro Graphviz (dot, neato) a nástroje, které DOT čtou.' },
    { id: 'mermaid', nazev: 'Mermaid', pripona: '.mmd', mime: 'text/plain', popis: 'Diagram flowchart pro Markdown na GitHubu, GitLabu, Obsidianu či Notionu.' },
    { id: 'markdown', nazev: 'Markdown – osnova', pripona: '.md', mime: 'text/markdown', popis: 'Čitelný přehled pojmů podle typů s jejich souvislostmi.' }
  ];

  /* chyby uvnitř převodu (nečekaná struktura) přeložit na srozumitelnou hlášku */
  const chranene = (fn, co) => function () {
    try { return fn.apply(null, arguments); }
    catch (e) { if (e instanceof ChybaFormatu) throw new Error(e.message); throw new Error(co + ': soubor má nečekanou strukturu (' + e.message + ').'); }
  };
  const chraneneAsync = (fn, co) => async function () {
    try { return await fn.apply(null, arguments); }
    catch (e) { if (e instanceof ChybaFormatu) throw new Error(e.message); throw new Error(co + ': ' + e.message); }
  };

  const API = {
    FORMATY,
    parsujXML: chranene(parsujXML, 'XML'), parsujCSV: chranene((t, o) => parsujCSV(t, o || odhadniOddelovac(t)).map(r => r.bunky), 'CSV'),
    doGraphML, zGraphML: chranene(zGraphML, 'GraphML'),
    doGEXF, zGEXF: chranene(zGEXF, 'GEXF'),
    doCSV, zCSV: chranene(zCSV, 'CSV'), zCSVDvojice: chranene(zCSVDvojice, 'CSV'),
    doDOT, zDOT: chranene(zDOT, 'DOT'),
    doMermaid, doMarkdown,
    zakodujOdkaz, dekodujOdkaz: chraneneAsync(dekodujOdkaz, 'Odkaz'),
    rozpoznej: chranene(rozpoznej, 'Import')
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.MapaFormaty = API;
})();
