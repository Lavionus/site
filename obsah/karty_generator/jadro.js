/* ============================================================
   GENERÁTOR KARET – jádro bez DOM
   Šablona karty = vrstvy v milimetrech (počátek v levém horním rohu
   ořezu, spadávka leží v záporných souřadnicích a za šířkou/výškou).
   Data = tabulka { sloupce: [...], radky: [[...], ...] }.
   Jádro umí: dosazení proměnných {sloupec|výchozí}, podmíněné styly,
   CSV/TSV, rozbalení kopií podle sloupce „pocet“, zalomení a zmenšení
   písma (měření textu se předává zvenku – v prohlížeči z plátna,
   v testu odhadem), rozložení karet na arch, zrcadlení rubu a ořezové
   značky. Vystavené jako window.KARTY a module.exports.
   ============================================================ */
(function (koren) {
'use strict';

const PT_MM = 25.4 / 72;

const FORMATY = {
  poker:   { n: 'Poker 63 × 88', w: 63, h: 88 },
  bridz:   { n: 'Bridž 57 × 89', w: 57, h: 89 },
  tarot:   { n: 'Tarot 70 × 120', w: 70, h: 120 },
  mini:    { n: 'Mini 44 × 63', w: 44, h: 63 },
  ctverec: { n: 'Čtverec 70 × 70', w: 70, h: 70 },
  a7:      { n: 'A7 74 × 105', w: 74, h: 105 },
  a6:      { n: 'A6 105 × 148', w: 105, h: 148 },
  vizitka: { n: 'Vizitka 85 × 55', w: 85, h: 55 },
  vlastni: { n: 'Vlastní…', w: 0, h: 0 }
};
const PAPIRY = {
  a4:     { n: 'A4', w: 210, h: 297 },
  a3:     { n: 'A3', w: 297, h: 420 },
  letter: { n: 'Letter', w: 215.9, h: 279.4 }
};
const OPERATORY = {
  '=': 'je rovno', '!=': 'není rovno', 'obsahuje': 'obsahuje', 'zacina': 'začíná na',
  '>': 'větší než', '<': 'menší než', '>=': 'aspoň', '<=': 'nejvýš',
  'prazdne': 'je prázdné', 'neprazdne': 'není prázdné'
};
const SLOUPCE_POCTU = ['pocet', 'počet', 'count', 'qty', 'kusu', 'kusů', 'ks'];

/* ---------- pomocné ---------- */
const kopie = o => JSON.parse(JSON.stringify(o));
const norm = s => String(s == null ? '' : s).trim().toLowerCase();
function cislo(s) {
  const t = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.');
  return t !== '' && isFinite(t) ? +t : NaN;
}

/* ---------- proměnné ---------- */
// řádek tabulky → objekt; klíče i v malých písmenech, ať {Nazev} najde sloupec „název“ i „Nazev“
function radekObjekt(data, i) {
  const o = {}, r = data.radky[i] || [];
  data.sloupce.forEach((s, j) => {
    const v = r[j] == null ? '' : String(r[j]);
    o[s] = v;
    if (!(norm(s) in o)) o[norm(s)] = v;
  });
  return o;
}
function hodnota(radek, jmeno) {
  if (jmeno in radek) return radek[jmeno];
  const n = norm(jmeno);
  return n in radek ? radek[n] : undefined;
}
/* {nazev} · {nazev|výchozí} · {#} pořadí karty · {celkem} · \{ = složená závorka */
function dosad(text, radek, extra) {
  if (typeof text !== 'string' || text.indexOf('{') < 0) return text;
  const ex = extra || {};
  return text.replace(/\\\{|\{([^{}]*)\}/g, (cele, obsah) => {
    if (cele === '\\{') return '{';
    const i = obsah.indexOf('|');
    const jmeno = (i < 0 ? obsah : obsah.slice(0, i)).trim(), vychozi = i < 0 ? '' : obsah.slice(i + 1);
    let v = jmeno === '#' ? ex.poradi : jmeno === 'celkem' ? ex.celkem : hodnota(radek, jmeno);
    v = v == null ? '' : String(v);
    return v === '' ? vychozi : v;
  });
}
function promenneVTextu(text) {
  const out = [];
  String(text || '').replace(/\\\{|\{([^{}|]*)(\|[^{}]*)?\}/g, (c, j) => { if (j != null && j.trim()) out.push(j.trim()); return c; });
  return out;
}

/* ---------- podmínky ---------- */
function splnena(p, radek) {
  const v = hodnota(radek, p.sloupec);
  const a = v == null ? '' : String(v).trim(), b = String(p.hodnota == null ? '' : p.hodnota).trim();
  const na = cislo(a), nb = cislo(b), cisla = !isNaN(na) && !isNaN(nb);
  switch (p.op) {
    case '=': return cisla ? na === nb : norm(a) === norm(b);
    case '!=': return cisla ? na !== nb : norm(a) !== norm(b);
    case 'obsahuje': return norm(a).includes(norm(b));
    case 'zacina': return norm(a).startsWith(norm(b));
    case '>': return cisla ? na > nb : norm(a) > norm(b);
    case '<': return cisla ? na < nb : norm(a) < norm(b);
    case '>=': return cisla ? na >= nb : norm(a) >= norm(b);
    case '<=': return cisla ? na <= nb : norm(a) <= norm(b);
    case 'prazdne': return a === '';
    case 'neprazdne': return a !== '';
  }
  return false;
}

/* Vyhodnocení jedné strany karty pro daný řádek:
   pravidla (v pořadí, pozdější přebíjí) → dosazení proměnných ve všech
   textových vlastnostech → skrytí prázdných. Vrací nový objekt. */
function vyhodnotStranu(strana, podminky, radek, extra) {
  const s = kopie(strana);
  (podminky || []).forEach(p => {
    if (!p || !p.vlastnost || !splnena(p, radek)) return;
    if (p.vrstva === 'karta') { s[p.vlastnost] = p.nastav; return; }
    s.vrstvy.forEach(v => {
      if (v.id === p.vrstva || (p.vrstva === '*' + v.typ)) v[p.vlastnost] = p.nastav;
    });
  });
  for (const k in s) if (typeof s[k] === 'string') s[k] = dosad(s[k], radek, extra);
  s.vrstvy = s.vrstvy.filter(v => {
    for (const k in v) if (typeof v[k] === 'string' && k !== 'id' && k !== 'typ') v[k] = dosad(v[k], radek, extra);
    if (v.skryta === true || v.skryta === 'ano') return false;
    if (v.skrytPrazdne && (v.typ === 'text' || v.typ === 'ikona') && !String(v.text).trim()) return false;
    if (v.skrytPrazdne && v.typ === 'obrazek' && !String(v.src).trim()) return false;
    return true;
  });
  return s;
}

/* ---------- CSV / TSV ---------- */
function odhadniOddelovac(text) {
  const radek = text.split(/\r?\n/).find(r => r.trim()) || '';
  let nej = ',', max = -1;
  for (const o of ['\t', ';', ',', '|']) {
    let n = 0, uv = false;
    for (const c of radek) { if (c === '"') uv = !uv; else if (c === o && !uv) n++; }
    if (n > max) { max = n; nej = o; }
  }
  return nej;
}
function parseCSV(text, oddelovac) {
  text = String(text || '').replace(/^﻿/, '');
  const o = oddelovac || odhadniOddelovac(text);
  const radky = []; let radek = [], pole = '', uv = false, i = 0, bylo = false;
  while (i < text.length) {
    const c = text[i];
    if (uv) {
      if (c === '"') { if (text[i + 1] === '"') { pole += '"'; i += 2; continue; } uv = false; i++; continue; }
      pole += c; i++; continue;
    }
    if (c === '"' && pole === '') { uv = true; bylo = true; i++; continue; }
    if (c === o) { radek.push(pole); pole = ''; bylo = true; i++; continue; }
    if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      radek.push(pole); radky.push(radek); radek = []; pole = ''; bylo = false; i++; continue;
    }
    pole += c; bylo = true; i++;
  }
  if (bylo || pole !== '' || radek.length) { radek.push(pole); radky.push(radek); }
  return radky.filter(r => r.some(v => String(v).trim() !== ''));
}
function doCSV(data, oddelovac) {
  const o = oddelovac || ';';
  const pole = v => { const s = String(v == null ? '' : v); return /["\r\n]/.test(s) || s.includes(o) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [data.sloupce, ...data.radky].map(r => data.sloupce.map((_, j) => pole(r[j])).join(o)).join('\r\n') + '\r\n';
}
/* 2D pole (první řádek = hlavička) → tabulka; prázdná a stejná jména sloupců se dočíslují */
function tabulkaZPoli(pole) {
  if (!pole.length) return { sloupce: [], radky: [] };
  const sirka = Math.max(...pole.map(r => r.length));
  const pouzite = new Set();
  const sloupce = [];
  for (let j = 0; j < sirka; j++) {
    let s = String(pole[0][j] == null ? '' : pole[0][j]).trim() || 'sloupec' + (j + 1), z = s, n = 2;
    while (pouzite.has(norm(z))) z = s + '_' + n++;
    pouzite.add(norm(z)); sloupce.push(z);
  }
  const radky = pole.slice(1).map(r => sloupce.map((_, j) => r[j] == null ? '' : String(r[j])));
  return { sloupce, radky };
}

/* ---------- kopie podle sloupce „pocet“ ---------- */
function sloupecPoctu(data) {
  return data.sloupce.findIndex(s => SLOUPCE_POCTU.includes(norm(s)));
}
function pocetKopii(data, i) {
  const j = sloupecPoctu(data);
  if (j < 0) return 1;
  const v = String((data.radky[i] || [])[j] == null ? '' : data.radky[i][j]).trim();
  if (v === '') return 1;
  const n = Math.floor(cislo(v));
  return isNaN(n) ? 1 : Math.max(0, Math.min(999, n));
}
/* seznam karet k tisku: [{ radek: index, kopie: 0.. }] */
function balicek(data) {
  const out = [];
  if (!data.radky.length) return [{ radek: -1, kopie: 0 }];   // bez dat aspoň jedna karta ze šablony
  data.radky.forEach((_, i) => { const n = pocetKopii(data, i); for (let k = 0; k < n; k++) out.push({ radek: i, kopie: k }); });
  return out;
}

/* ---------- zalomení a přizpůsobení písma ----------
   mer(text, velikostMm) → šířka v mm. Explicitní \n se dodrží, příliš
   dlouhé slovo se rozdělí po znacích. */
function zalom(text, velikost, sirka, mer) {
  const radky = [];
  String(text == null ? '' : text).split(/\r?\n/).forEach(odst => {
    const slova = odst.split(/ +/).filter(s => s !== '');
    if (!slova.length) { radky.push(''); return; }
    let rad = '';
    for (let slovo of slova) {
      const zkus = rad ? rad + ' ' + slovo : slovo;
      if (mer(zkus, velikost) <= sirka) { rad = zkus; continue; }
      if (rad) { radky.push(rad); rad = ''; }
      // samotné slovo je moc široké → po znacích
      while (mer(slovo, velikost) > sirka && slovo.length > 1) {
        let k = 1;
        while (k < slovo.length && mer(slovo.slice(0, k + 1), velikost) <= sirka) k++;
        radky.push(slovo.slice(0, k)); slovo = slovo.slice(k);
      }
      rad = slovo;
    }
    radky.push(rad);
  });
  return radky;
}
/* největší velikost (mm) ≤ max, při které se text vejde do w × h bez dělení slov */
function prizpusob(text, w, h, o, mer) {
  const max = o.max, min = Math.min(o.min || max * 0.3, max), lh = o.radkovani || 1.2;
  const vejde = s => {
    const r = zalom(text, s, w, mer);
    const slovaCela = String(text).split(/\s+/).every(sl => !sl || mer(sl, s) <= w);
    return { r, ok: slovaCela && r.length * s * lh <= h + 1e-6 && (!o.maxRadku || r.length <= o.maxRadku) };
  };
  if (o.prizpusobit === false) return { velikost: max, radky: zalom(text, max, w, mer), preteka: !vejde(max).ok };
  let v = vejde(max);
  if (v.ok) return { velikost: max, radky: v.r, preteka: false };
  // zalomení není přísně monotónní → sestup po 3 %, pak jemné doladění nahoru
  let s = max;
  while (s > min) {
    s = Math.max(min, s * 0.97);
    v = vejde(s);
    if (v.ok) {
      let hore = s * 1.03;
      while (hore - s > 0.01) { const m = (s + hore) / 2; const t = vejde(m); if (t.ok) { s = m; v = t; } else hore = m; }
      return { velikost: s, radky: v.r, preteka: false };
    }
    if (s === min) break;
  }
  return { velikost: min, radky: zalom(text, min, w, mer), preteka: true };
}

/* ---------- rozložení na arch ---------- */
function rozlozJednou(pw, ph, w, h, b, g, m) {
  const cw = w + 2 * b, ch = h + 2 * b;
  const sl = Math.max(0, Math.floor((pw - 2 * m + g) / (cw + g) + 1e-9));
  const ra = Math.max(0, Math.floor((ph - 2 * m + g) / (ch + g) + 1e-9));
  const gw = sl * cw + Math.max(0, sl - 1) * g, gh = ra * ch + Math.max(0, ra - 1) * g;
  return { pw, ph, sl, ra, cw, ch, ox: (pw - gw) / 2, oy: (ph - gh) / 2, gw, gh };
}
/* a = { papir, orientace: 'auto'|'na-vysku'|'na-sirku', okraj, mezera, otocit }, karta = { w, h, spadavka } */
function rozloz(karta, a) {
  const pap = PAPIRY[a.papir] || PAPIRY.a4;
  let w = +karta.w, h = +karta.h;
  if (a.otocit) [w, h] = [h, w];
  const b = Math.max(0, +karta.spadavka || 0), g = Math.max(0, +a.mezera || 0), m = Math.max(0, +a.okraj || 0);
  const vy = rozlozJednou(pap.w, pap.h, w, h, b, g, m), si = rozlozJednou(pap.h, pap.w, w, h, b, g, m);
  const L = a.orientace === 'na-sirku' ? si : a.orientace === 'na-vysku' ? vy : (si.sl * si.ra > vy.sl * vy.ra ? si : vy);
  return Object.assign(L, { w, h, b, g, naList: L.sl * L.ra, otoceno: !!a.otocit });
}
/* levý horní roh buňky (včetně spadávky) pro pozici na listu; rub se zrcadlí
   podle hrany, přes kterou tiskárna list překlápí (dlouhá = sloupce, krátká = řádky) */
function bunka(L, i, rub, preklapeni) {
  let r = Math.floor(i / L.sl), c = i % L.sl;
  if (rub) {
    // dlouhá hrana na výšku = vodorovné zrcadlení; na šířku je dlouhá hrana vodorovná
    const naSirku = L.pw > L.ph;
    const vodorovne = (preklapeni === 'kratka') === naSirku;
    if (vodorovne) c = L.sl - 1 - c; else r = L.ra - 1 - r;
  }
  return { x: L.ox + c * (L.cw + L.g), y: L.oy + r * (L.ch + L.g), r, c };
}
/* Má se rub otočit o 180°? Karta se obrací kolem své svislé osy (jako list
   knihy). Když list papíru překlápí tiskárna kolem osy, která je pro kartu
   vodorovná (otočené karty, nebo překlápění přes krátkou hranu na výšku),
   rub by po otočení karty stál vzhůru nohama – vyrovná se to otočením. */
function rubVzhuruNohama(L, preklapeni) {
  const naSirku = L.pw > L.ph;
  const kolemSvisle = (preklapeni === 'kratka') === naSirku;   // stejná podmínka jako v bunka()
  return kolemSvisle === !!L.otoceno;
}
/* listy: [{ lic: [{karta, x, y}], rub: [...] }] – x, y = levý horní roh buňky se spadávkou */
function listy(karty, L, a) {
  const out = [];
  if (!L.naList) return out;
  for (let z = 0; z < karty.length; z += L.naList) {
    const list = { lic: [], rub: [] };
    karty.slice(z, z + L.naList).forEach((k, i) => {
      const p = bunka(L, i, false);
      list.lic.push({ karta: k, x: p.x, y: p.y });
      const q = bunka(L, i, true, a.preklapeni);
      list.rub.push({ karta: k, x: q.x + (+a.posunX || 0), y: q.y + (+a.posunY || 0) });
    });
    out.push(list);
  }
  return out;
}
/* ořezové značky: krátké úsečky v okraji na prodloužení hran ořezu (mm) */
function orezoveZnacky(L, delka, odstup) {
  const d = delka == null ? 5 : delka, o = odstup == null ? 1.5 : odstup;
  const xs = new Set(), ys = new Set();
  for (let c = 0; c < L.sl; c++) { const x = L.ox + c * (L.cw + L.g) + L.b; xs.add(+x.toFixed(3)); xs.add(+(x + L.w).toFixed(3)); }
  for (let r = 0; r < L.ra; r++) { const y = L.oy + r * (L.ch + L.g) + L.b; ys.add(+y.toFixed(3)); ys.add(+(y + L.h).toFixed(3)); }
  const del = Math.min(d, L.ox - o - 0.5, L.oy - o - 0.5);
  const out = [];
  if (del < 1) return out;
  const hore = L.oy - o, dole = L.oy + L.gh + o, vlevo = L.ox - o, vpravo = L.ox + L.gw + o;
  xs.forEach(x => { out.push({ x1: x, y1: hore - del, x2: x, y2: hore }, { x1: x, y1: dole, x2: x, y2: dole + del }); });
  ys.forEach(y => { out.push({ x1: vlevo - del, y1: y, x2: vlevo, y2: y }, { x1: vpravo, y1: y, x2: vpravo + del, y2: y }); });
  return out;
}

/* ---------- obrázky podle jména ---------- */
function klicObrazku(jmeno) {
  return norm(String(jmeno || '').split(/[\\/]/).pop());
}
/* najde jméno v knihovně: přesně, pak bez přípony (meč → meč.png) */
function najdiObrazek(jmeno, jmena) {
  const k = klicObrazku(jmeno);
  if (!k) return null;
  const mapa = new Map(), bez = new Map();
  jmena.forEach(j => { mapa.set(klicObrazku(j), j); const b = klicObrazku(j).replace(/\.[a-z0-9]+$/, ''); if (!bez.has(b)) bez.set(b, j); });
  return mapa.get(k) || bez.get(k) || bez.get(k.replace(/\.[a-z0-9]+$/, '')) || null;
}

/* ---------- projekt ---------- */
let citac = 0;
function noveId(typ) { return (typ || 'v') + Date.now().toString(36).slice(-4) + (citac++).toString(36); }

const VYCHOZI_VRSTVY = {
  text:    { nazev: 'Text', x: 5, y: 5, w: 53, h: 12, text: '{nazev}', pismo: 'sans-serif', velikost: 14, minVelikost: 5, tucne: false, kurziva: false, barva: '#222222', zarovnani: 'stred', svisle: 'stred', radkovani: 1.15, prizpusobit: true, obrys: '', obrysSila: 0, skrytPrazdne: false },
  ikona:   { nazev: 'Ikona', x: 21, y: 30, w: 21, h: 21, text: '⭐', barva: '#222222', pismo: 'sans-serif', skrytPrazdne: false },
  obrazek: { nazev: 'Obrázek', x: 5, y: 18, w: 53, h: 35, src: '{obrazek}', prizpusobeni: 'vyplnit', zaobleni: 2, pruhlednost: 1, skrytPrazdne: true },
  tvar:    { nazev: 'Tvar', x: 5, y: 5, w: 53, h: 12, druh: 'obdelnik', vypln: '#e8e2d0', obrys: '', obrysSila: 0.4, zaobleni: 2, pruhlednost: 1 },
  ramecek: { nazev: 'Rámeček', odsazeni: 2.5, sila: 1.2, barva: '#333333', zaobleni: 2, dvojity: false }
};
function novaVrstva(typ, prepis) {
  return Object.assign({ id: noveId(typ.slice(0, 2)), typ, otoceni: 0, skryta: false }, kopie(VYCHOZI_VRSTVY[typ]), prepis || {});
}
function novyProjekt() {
  return {
    verze: 1, nazev: 'Nový balíček',
    karta: { format: 'poker', w: 63, h: 88, spadavka: 3, bezpecna: 3, zaobleni: 3 },
    lic: { pozadi: '#ffffff', vrstvy: [] },
    rub: { pozadi: '#2b3a55', vrstvy: [] },
    rubRezim: 'ne',
    podminky: [],
    data: { sloupce: ['nazev', 'pocet'], radky: [['Karta', '1']] },
    arch: { papir: 'a4', orientace: 'auto', okraj: 8, mezera: 0, otocit: false, znacky: true, obrysRezu: false, preklapeni: 'dlouha', posunX: 0, posunY: 0, dpi: 300 }
  };
}
/* doplní chybějící části (import JSON, starší verze) a ověří typy */
function normalizuj(p) {
  if (!p || typeof p !== 'object') throw new Error('Soubor neobsahuje projekt karet.');
  const z = novyProjekt();
  const out = Object.assign({}, z, p);
  out.karta = Object.assign({}, z.karta, p.karta);
  out.arch = Object.assign({}, z.arch, p.arch);
  for (const s of ['lic', 'rub']) {
    out[s] = Object.assign({}, z[s], p[s]);
    if (!Array.isArray(out[s].vrstvy)) out[s].vrstvy = [];
    out[s].vrstvy = out[s].vrstvy.filter(v => v && VYCHOZI_VRSTVY[v.typ])
      .map(v => Object.assign({ id: noveId(v.typ.slice(0, 2)), otoceni: 0, skryta: false }, kopie(VYCHOZI_VRSTVY[v.typ]), v));
  }
  if (!Array.isArray(out.podminky)) out.podminky = [];
  if (!p.data || !Array.isArray(p.data.sloupce) || !Array.isArray(p.data.radky)) out.data = z.data;
  else out.data = { sloupce: p.data.sloupce.map(String), radky: p.data.radky.map(r => p.data.sloupce.map((_, j) => r && r[j] != null ? String(r[j]) : '')) };
  if (!['ne', 'spolecny', 'data'].includes(out.rubRezim)) out.rubRezim = 'ne';
  if (!(+out.karta.w > 5 && +out.karta.h > 5)) throw new Error('Neplatný rozměr karty.');
  return out;
}
/* proměnné použité v šabloně, které v datech chybí */
function chybejiciSloupce(p) {
  const mam = new Set(p.data.sloupce.map(norm));
  const chybi = new Set();
  [...p.lic.vrstvy, ...(p.rubRezim === 'ne' ? [] : p.rub.vrstvy)].forEach(v => {
    for (const k in v) if (typeof v[k] === 'string') promenneVTextu(v[k]).forEach(j => { if (j !== '#' && j !== 'celkem' && !mam.has(norm(j))) chybi.add(j); });
  });
  return [...chybi];
}

const API = {
  PT_MM, FORMATY, PAPIRY, OPERATORY, SLOUPCE_POCTU, VYCHOZI_VRSTVY,
  kopie, cislo, radekObjekt, dosad, promenneVTextu, splnena, vyhodnotStranu,
  odhadniOddelovac, parseCSV, doCSV, tabulkaZPoli, sloupecPoctu, pocetKopii, balicek,
  zalom, prizpusob, rozloz, bunka, rubVzhuruNohama, listy, orezoveZnacky,
  klicObrazku, najdiObrazek, noveId, novaVrstva, novyProjekt, normalizuj, chybejiciSloupce
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else koren.KARTY = API;
})(typeof window !== 'undefined' ? window : this);
